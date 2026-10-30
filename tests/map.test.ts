import { describe, expect, it } from 'vitest';
import { defaults, parse } from '@/core/save';
import { ALL_DUNGEONS, dungeonById, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed, next, systemRoad, type GateMap } from '@/core/map';
import * as raid from '@/core/raid';
import { autoAllocate, grantXP, syncClass, totalXpFor } from '@/core/progression';
import { REST_HEAL, TRAP } from '@/data/nodes';
import { walk } from './walk';

const now = Date.parse('2026-02-02T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  autoAllocate(s);
  syncClass(s);
  return s;
}

/** Every node the start can reach. */
function reachable(m: GateMap) {
  const seen = new Set<string>();
  const stack = m.layers[0].map((x) => x.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...m.byId[id].next);
  }
  return seen;
}

describe('the map', () => {
  it('is the same all day, and every node can be reached and leads to the boss', () => {
    for (const d of [...ALL_DUNGEONS, PRACTICE_GATE]) for (const day of ['2026-02-02', '2026-07-19']) {
      const m = build(d, mapSeed(d, day));
      expect(build(d, mapSeed(d, day))).toEqual(m);
      const ids = m.layers.flat().map((x) => x.id);
      expect([...reachable(m)].sort()).toEqual(ids.sort());
      for (const x of m.layers.flat()) if (x.kind !== 'boss') expect(x.next.length).toBeGreaterThan(0);
      // The first layer is all fights, every choice layer holds one, then a rest, then the boss.
      expect(m.layers[0].every((x) => x.kind === 'fight')).toBe(true);
      const choices = m.layers.slice(0, -2);
      for (const row of choices) expect(row.some((x) => x.kind === 'fight')).toBe(true);
      expect(m.layers[m.layers.length - 2].map((x) => x.kind)).toEqual(['rest']);
      expect(m.layers[m.layers.length - 1].map((x) => x.kind)).toEqual(['boss']);
      if (!d.elite) expect(m.layers.flat().some((x) => x.kind === 'elite')).toBe(false);
    }
  });

  it('the practice gate holds no traps, events or gatekeepers', () => {
    for (const day of ['2026-02-02', '2026-03-03', '2026-04-04', '2026-05-05']) {
      const kinds = build(PRACTICE_GATE, mapSeed(PRACTICE_GATE, day)).layers.flat().map((x) => x.kind);
      for (const k of ['trap', 'event', 'elite']) expect(kinds).not.toContain(k);
    }
  });

  it('the System’s road is a real road', () => {
    const d = dungeonById('DNG-016')!;
    const m = build(d, mapSeed(d, '2026-02-02'));
    const road = systemRoad(m);
    expect(road).toHaveLength(m.layers.length);
    road.forEach((id, i) => expect(next(m, road.slice(0, i)).map((x) => x.id)).toContain(id));
  });
});

describe('walking it', () => {
  it('only steps to a node the last one leads to, and one step at a time', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    expect(raid.choose(s, d, run, m.layers[1][0].id, now)).toBeNull();
    expect(raid.choose(s, d, run, m.layers[0][0].id, now)).not.toBeNull();
    // A fight is underway: nothing else can be taken until it is done.
    expect(raid.options(d, run)).toEqual([]);
    expect(raid.choose(s, d, run, m.layers[0][1].id, now)).toBeNull();
  });

  it('a rest heals, and is the only place to withdraw from', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const road = systemRoad(raid.mapOf(d, run));
    // Walk to the rest by hand, wounding the hunter on the way.
    let step = 0;
    while (raid.mapOf(d, run).byId[road[step]].kind !== 'rest') {
      expect(raid.canWithdraw(d, run)).toBe(false);
      raid.choose(s, d, run, road[step], now);
      const x = raid.pending(d, run);
      if (x?.kind === 'fight' || x?.kind === 'elite') {
        const { party, ch } = raid.resume(s, d, run, now);
        while (ch.turn) ch.play(raid.order(s, run, null));
        raid.record(s, d, run, party, ch.result(), now);
      } else if (x) raid.resolve(s, d, run, raid.systemChoice(x), now);
      step++;
    }
    expect(() => raid.finish(structuredClone(s), d, structuredClone(run), 'withdrawn', now)).toThrow();
    run.carried[0].hp = 10;
    const max = raid.partyFor(s, d, run, now)[0].maxHp;
    raid.choose(s, d, run, road[step], now);
    expect(run.carried[0].hp).toBeCloseTo(Math.min(max, 10 + max * REST_HEAL), 5);
    expect(raid.canWithdraw(d, run)).toBe(true);
    expect(raid.finish(s, d, run, 'withdrawn', now).outcome).toBe('withdrawn');
  });

  it('what the run finds is paid when it ends on its feet, and lost when it is carried out', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    raid.begin(s, d, now);
    walk(s, d, now);
    const kept = structuredClone(s);
    const lost = structuredClone(s);
    kept.gates.raid!.purse = 50;
    lost.gates.raid!.purse = 50;
    const a = raid.finish(kept, d, kept.gates.raid!, 'cleared', now);
    expect(a.banked).toBe(50);
    const b = raid.finish(lost, d, lost.gates.raid!, 'defeated', now);
    expect(b.banked).toBe(0);
    expect(b.loot).toEqual([]);
  });

  it('a cache banks a piece of gear, paid out with the clear', () => {
    const s = hunter(30);
    for (const d of ALL_DUNGEONS) {
      const day = '2026-02-02';
      const m = build(d, mapSeed(d, day));
      const cache = m.layers.flat().find((x) => x.kind === 'treasure');
      if (!cache) continue;
      const run = raid.begin(structuredClone(s), d, now);
      const x = structuredClone(s);
      x.gates.raid = run;
      // Find a road through the cache.
      const back = (id: string): string[] => {
        const layer = m.byId[id].layer;
        if (layer === 0) return [id];
        const parent = m.layers[layer - 1].find((p) => p.next.includes(id))!;
        return [...back(parent.id), id];
      };
      const road = back(cache.id);
      run.path = road.slice(0, -1);
      run.at = run.path.length;
      const res = raid.choose(x, d, run, cache.id, now);
      expect(res?.item).toBeTruthy();
      expect(run.haul).toContain(res!.item);
      return;
    }
    throw new Error('no gate held a cache today');
  });
});

describe('choices', () => {
  it('a choice goes well as often as its odds say', () => {
    const s = hunter(20);
    const c = TRAP.choices[0];
    const odds = raid.oddsOf(c, raid.heroSpec(s, now));
    let won = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const d = dungeonById('DNG-016')!;
      const x = structuredClone(s);
      const run = raid.begin(x, d, now + i * 1000);
      const m = raid.mapOf(d, run);
      const trap = m.layers.flat().find((y) => y.kind === 'trap');
      if (!trap) throw new Error('no trap on today’s map');
      // Stand the run on the trap; each entry is a fresh seed, so a fresh roll.
      run.path = [trap.id];
      run.at = 0;
      if (raid.resolve(x, d, run, 0, now)?.won) won++;
    }
    expect(Math.abs(won / n - odds)).toBeLessThan(0.08);
  });

  it('Perception makes a trap easier to see', () => {
    const c = TRAP.choices[0];
    const low = raid.heroSpec(hunter(5), now);
    const high = raid.heroSpec(hunter(5), now);
    high.base = { ...high.base, PER: high.base.PER + 40 };
    expect(raid.oddsOf(c, high)).toBeGreaterThan(raid.oddsOf(c, low));
  });

  it('a blessing of iron raises the hunter’s maximum HP, and their HP with it', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-016')!;
    const run = raid.begin(s, d, now);
    const party = raid.partyFor(s, d, run, now);
    party[0].hp = party[0].maxHp / 2;
    const after = raid.rebless(party, run.party, ['iron']);
    expect(after[0].maxHp).toBeGreaterThan(party[0].maxHp);
    // Health is written back as a share of the maximum: the blessing must not lower it.
    expect(after[0].hp / after[0].maxHp).toBeGreaterThanOrEqual(party[0].hp / party[0].maxHp);
  });
});

describe('the verdict and the save', () => {
  it('the brief assesses the System’s road through today’s map', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-016')!;
    const p = raid.project(s, d, 6, now);
    expect(p.road).toEqual(systemRoad(build(d, mapSeed(d, '2026-02-02'))));
  });

  it('a run left open in an older save starts its map over, or stays lost', () => {
    const s = defaults();
    const raw = JSON.parse(JSON.stringify(s));
    raw.v = 1;
    raw.gates.raid = { dungeonId: 'DNG-001', seed: 'x', day: '2026-02-02', at: 2, won: 1, squad: [], carried: [], felled: [], kills: {}, startHp: 100, bossFaced: false, party: [], tactic: 'default', orders: [] };
    const back = parse(JSON.stringify(raw))!;
    expect(back.gates.raid!.path).toEqual([]);
    expect(back.gates.raid!.at).toBe(0);
    expect(back.gates.raid!.lost).toBe(true);
    expect(back.gates.raid!.map).toBe('DNG-001|2026-02-02');
  });
});
