import { describe, expect, it } from 'vitest';
import { defaults, parse } from '@/core/save';
import { ALL_DUNGEONS, dungeonById, PRACTICE_GATE } from '@/core/gates';
import { build, isFight, mapSeed, next, passages, reach, RESTS_MAX, sight, systemRoad, unsealed, type GateMap, type MapNode } from '@/core/map';
import * as shop from '@/core/shop';
import * as forge from '@/core/forge';
import { CACHE } from '@/data/forge';
import type { Dungeon, OpenRaid, Rank, Save } from '@/core/types';
import * as raid from '@/core/raid';
import { autoAllocate, grantXP, syncClass, totalXpFor, reclassifyAll } from '@/core/progression';
import { EVENTS, REST_HEAL, TRAP } from '@/data/nodes';
import * as vitals from '@/core/vitals';
import { walk } from './walk';

const now = Date.parse('2026-02-02T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  autoAllocate(s);
  syncClass(s);
  return s;
}

/** Every room the entrance can reach by corridor. */
function reachable(m: GateMap) {
  const seen = new Set<string>();
  const stack = [m.start!];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...m.byId[id].next);
  }
  return seen;
}

/** The fewest corridors from the entrance to a room, and the rooms on that way, the room last. */
function wayTo(m: GateMap, id: string): string[] {
  const from: Record<string, string> = {};
  const queue = [m.start!];
  const seen = new Set(queue);
  while (queue.length) {
    const at = queue.shift()!;
    for (const nb of m.byId[at].next) if (!seen.has(nb)) { seen.add(nb); from[nb] = at; queue.push(nb); }
  }
  const out = [id];
  while (from[out[0]] && from[out[0]] !== m.start) out.unshift(from[out[0]]);
  return out;
}

const DAYS = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 1, 1 + i * 3)).toISOString().slice(0, 10));

describe('the map', () => {
  it('is the same all day: rooms on a grid, every one reachable from the entrance, the boss alone at the head', () => {
    for (const d of [...ALL_DUNGEONS, PRACTICE_GATE].filter((g) => !g.floor && !g.trial)) for (const day of ['2026-02-02', '2026-07-19']) {
      const m = build(d, mapSeed(d, day));
      expect(build(d, mapSeed(d, day))).toEqual(m);
      expect(m.tower).toBe(false);
      expect(m.byId[m.start!].kind).toBe('entrance');
      expect([...reachable(m)].sort()).toEqual(m.nodes.map((x) => x.id).sort());
      // Corridors run both ways, between rooms side by side, one room to a cell.
      const cells = new Set<string>();
      for (const x of m.nodes) {
        cells.add(`${x.x},${x.y}`);
        expect(x.x).toBeGreaterThanOrEqual(0);
        expect(x.x).toBeLessThan(m.cols);
        for (const id of [...x.next, ...(x.hidden ?? [])]) {
          const y = m.byId[id];
          expect(y.next.includes(x.id) || (y.hidden ?? []).includes(x.id)).toBe(true);
          expect(Math.abs(x.x! - y.x!) + Math.abs(x.y! - y.y!)).toBe(1);
        }
      }
      expect(cells.size).toBe(m.nodes.length);
      const boss = m.byId[m.boss];
      expect(m.nodes.filter((x) => x.kind === 'boss')).toEqual([boss]);
      expect(boss.y).toBe(0);
      expect(m.nodes.filter((x) => x.y === 0)).toEqual([boss]);
      expect(boss.next).toHaveLength(1);
      expect(m.byId[m.start!].y).toBe(m.rows - 1);
      // The first room on the road is a fight; every room is numbered once, from the entrance out.
      expect(m.byId[systemRoad(m)[0]].kind).toBe('fight');
      expect(m.nodes.map((x) => x.n).sort((a, b) => a - b)).toEqual(m.nodes.map((_, i) => i));
      expect(m.nodes.filter((x) => x.kind === 'rest').length).toBeLessThanOrEqual(RESTS_MAX);
    }
  });

  it('a Gate with a Gatekeeper holds it at the end of a branch, and its vault, sealed, at the end of another', () => {
    for (const d of ALL_DUNGEONS.filter((g) => !g.floor && !g.trial)) for (const day of DAYS.slice(0, 4)) {
      const m = build(d, mapSeed(d, day));
      const keepers = m.nodes.filter((x) => x.kind === 'elite');
      const vaults = m.nodes.filter((x) => x.kind === 'vault');
      expect(keepers).toHaveLength(d.elite ? 1 : 0);
      expect(vaults).toHaveLength(d.elite ? 1 : 0);
      for (const x of [...keepers, ...vaults]) {
        expect(x.next).toHaveLength(1);
        expect(x.hidden).toBeUndefined();
      }
      if (d.elite) expect(keepers[0].next).not.toContain(vaults[0].id);
      const seen = new Set([m.start!]);
      expect(reach(m, seen).some((x) => x.kind === 'vault')).toBe(false);
      expect(unsealed(m, new Set([m.start!, keepers[0]?.id ?? '']))).toBe(!!d.elite);
    }
  });

  it('rests are rare, and found anywhere, not only before the boss', () => {
    let maps = 0, withRest = 0, onRoad = 0, offRoad = 0, beforeBoss = 0;
    for (const d of ALL_DUNGEONS.filter((g) => !g.floor && !g.trial)) for (const day of DAYS) {
      const m = build(d, mapSeed(d, day));
      const road = systemRoad(m);
      const rests = m.nodes.filter((x) => x.kind === 'rest');
      maps++;
      if (rests.length) withRest++;
      for (const x of rests) {
        if (road.includes(x.id)) onRoad++; else offRoad++;
        if (m.byId[m.boss].next.includes(x.id)) beforeBoss++;
      }
    }
    expect(withRest / maps).toBeGreaterThan(0.2);
    expect(withRest / maps).toBeLessThan(0.65);
    expect(onRoad).toBeGreaterThan(0);
    expect(offRoad).toBeGreaterThan(onRoad);
    expect(beforeBoss / (onRoad + offRoad)).toBeLessThan(0.15);
  });

  it('the practice Gate holds no traps, events or gatekeepers, fights of one or two, and a rest before its boss', () => {
    for (const day of ['2026-02-02', '2026-03-03', '2026-04-04', '2026-05-05']) {
      const m = build(PRACTICE_GATE, mapSeed(PRACTICE_GATE, day));
      const kinds = m.nodes.map((x) => x.kind);
      for (const k of ['trap', 'event', 'elite', 'vault']) expect(kinds).not.toContain(k);
      const road = systemRoad(m);
      expect(m.byId[road[road.length - 2]].kind).toBe('rest');
      expect(road.slice(0, -2).every((id) => m.byId[id].kind === 'fight')).toBe(true);
      for (const x of m.nodes.filter((y) => y.kind === 'fight')) expect(x.foes!.length).toBeLessThanOrEqual(2);
    }
  });

  it('the System’s road is the fewest rooms from the entrance to the boss, past no Gatekeeper and no vault', () => {
    for (const d of ALL_DUNGEONS.filter((g) => !g.floor && !g.trial).slice(0, 12)) for (const day of DAYS.slice(0, 6)) {
      const m = build(d, mapSeed(d, day));
      const road = systemRoad(m);
      expect(road[road.length - 1]).toBe(m.boss);
      expect(road).toHaveLength(wayTo(m, m.boss).length);
      [m.start!, ...road].slice(0, -1).forEach((id, i) => expect(m.byId[id].next).toContain(road[i]));
      for (const id of road) expect(['elite', 'vault', 'entrance']).not.toContain(m.byId[id].kind);
    }
  });

  it('a tower is climbed floor by floor, and a run opened before the dungeons keeps its floors', () => {
    const d = dungeonById('DNG-016')!;
    const m = build(d, mapSeed(d, '2026-02-02'), 'layers');
    expect(m.tower).toBe(true);
    expect(m.layers[0].every((x) => x.kind === 'fight')).toBe(true);
    for (const row of m.layers.slice(0, -2)) expect(row.some((x) => x.kind === 'fight')).toBe(true);
    expect(m.layers[m.layers.length - 2].map((x) => x.kind)).toEqual(['rest']);
    expect(m.layers[m.layers.length - 1].map((x) => x.kind)).toEqual(['boss']);
    const road = systemRoad(m);
    expect(road).toHaveLength(m.layers.length);
    road.forEach((id, i) => expect(next(m, road.slice(0, i)).map((x) => x.id)).toContain(id));
    const s = hunter(20);
    const run = raid.begin(s, d, now);
    delete run.layout;
    expect(raid.mapOf(d, run).tower).toBe(true);
    expect(raid.options(d, run).map((x) => x.id)).toEqual(m.layers[0].map((x) => x.id));
  });
});

/** Clear the step the run is on, the System's way: a fight to its end, a choice the System's. */
function clearStep(s: Save, d: Dungeon, run: OpenRaid) {
  const x = raid.pending(d, run);
  if (!x) return;
  if (isFight(x)) {
    const { party, ch } = raid.resume(s, d, run, now);
    while (ch.turn) ch.play(raid.order(s, run, null));
    raid.record(s, d, run, party, ch.result(), now);
  } else raid.resolve(s, d, run, raid.systemChoice(x), now);
}

/** A Gate and a day whose map holds a room of this kind, and the map. */
function gateWith(kind: string, where: (m: GateMap, x: MapNode) => boolean = () => true) {
  for (const day of DAYS) for (const d of ALL_DUNGEONS.filter((g) => !g.floor && !g.trial)) {
    const m = build(d, mapSeed(d, day));
    const x = m.nodes.find((y) => y.kind === kind && where(m, y));
    if (x) return { d, day, m, x, at: Date.parse(`${day}T12:00:00`) };
  }
  throw new Error(`no Gate held a ${kind}`);
}

/** Stand an open run in front of a room: every room on the way to it cleared, as written. */
function before(run: OpenRaid, m: GateMap, id: string) {
  const way = wayTo(m, id);
  run.path = way.slice(0, -1);
  run.at = run.path.length;
  run.pos = run.path[run.path.length - 1];
}

describe('the fog', () => {
  it('hides every room but the entrance, the boss and the rooms next to one cleared', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const start = m.byId[m.start!];
    expect([...raid.seen(s, d, run)].sort()).toEqual([m.start!, m.boss, ...start.next].sort());
    const road = systemRoad(m);
    raid.choose(s, d, run, road[0], now);
    clearStep(s, d, run);
    const seen = raid.seen(s, d, run);
    for (const id of m.byId[road[0]].next) expect(seen.has(id)).toBe(true);
    expect(m.nodes.some((x) => !seen.has(x.id))).toBe(true);
  });

  it('remembers what a run saw, for another run on the same map', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const road = systemRoad(m);
    raid.choose(s, d, run, road[0], now);
    clearStep(s, d, run);
    raid.moveTo(d, run, m.start!);
    const saw = raid.seen(s, d, run);
    raid.finish(s, d, run, 'withdrawn', now);
    const again = raid.begin(s, d, now + 60_000);
    expect(again.at).toBe(0);
    const seen = raid.seen(s, d, again);
    for (const id of saw) expect(seen.has(id)).toBe(true);
  });

  it('a Gate Survey inside the Gate charts every room of the map it walks, once', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    expect(raid.survey(s, d, now)).toBe(false);
    shop.stockUp(s, 'survey', 2);
    expect(raid.surveyable(s, d, now)).toBe(true);
    expect(raid.survey(s, d, now)).toBe(true);
    expect([...raid.seen(s, d, run)].sort()).toEqual(m.nodes.map((x) => x.id).sort());
    expect(raid.surveyable(s, d, now)).toBe(false);
    expect(shop.held(s, 'survey')).toBe(1);
  });

  it('a tower has none', () => {
    const d = dungeonById('DNG-016')!;
    const m = build(d, mapSeed(d, '2026-02-02'), 'layers');
    expect(sight(m, new Set()).size).toBe(m.nodes.length);
  });
});

describe('walking it', () => {
  it('enters only a room next to one cleared, and one at a time', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const road = systemRoad(m);
    expect(raid.options(d, run).map((x) => x.id)).toEqual(m.byId[m.start!].next.filter((id) => m.byId[id].kind !== 'vault'));
    expect(raid.choose(s, d, run, road[1], now)).toBeNull();
    expect(raid.choose(s, d, run, m.boss, now)).toBeNull();
    expect(raid.choose(s, d, run, road[0], now)).not.toBeNull();
    expect(raid.standing(d, run)!.id).toBe(road[0]);
    // A fight is underway: nothing else can be taken, and nowhere walked to, until it is done.
    expect(raid.options(d, run)).toEqual([]);
    expect(raid.moveTo(d, run, m.start!)).toBe(false);
    expect(raid.choose(s, d, run, road[1], now)).toBeNull();
  });

  it('walks back through cleared rooms, and only through them', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const road = systemRoad(m);
    raid.choose(s, d, run, road[0], now);
    clearStep(s, d, run);
    raid.choose(s, d, run, road[1], now);
    clearStep(s, d, run);
    expect(raid.moveTo(d, run, road[3])).toBe(false);
    expect(raid.moveTo(d, run, m.boss)).toBe(false);
    expect(raid.moveTo(d, run, m.start!)).toBe(true);
    expect(raid.standing(d, run)!.id).toBe(m.start);
    expect(raid.moveTo(d, run, road[0])).toBe(true);
    // Walking changes nothing else: the rooms on offer are the same from anywhere.
    const offered = raid.options(d, run).map((x) => x.id);
    raid.moveTo(d, run, road[1]);
    expect(raid.options(d, run).map((x) => x.id)).toEqual(offered);
    expect(offered).toContain(road[2]);
  });

  it('a rest is found, kept, and used once, whenever the hunter comes back to it', () => {
    const s = hunter(30);
    const { d, m, x, at } = gateWith('rest');
    const run = raid.begin(s, d, at);
    before(run, m, x.id);
    run.carried[0].hp = 10;
    const max = raid.partyFor(s, d, run, at)[0].maxHp;
    raid.choose(s, d, run, x.id, at);
    // Found, not taken.
    expect(run.carried[0].hp).toBe(10);
    expect(raid.canRest(d, run)).toBe(true);
    raid.moveTo(d, run, m.start!);
    expect(raid.canRest(d, run)).toBe(false);
    expect(raid.restHere(s, d, run, at)).toBe(false);
    raid.moveTo(d, run, x.id);
    expect(raid.restHere(s, d, run, at)).toBe(true);
    expect(run.carried[0].hp).toBeCloseTo(Math.min(max, 10 + max * REST_HEAL), 5);
    expect(raid.canRest(d, run)).toBe(false);
    expect(raid.restHere(s, d, run, at)).toBe(false);
  });

  it('withdraws only from the entrance, once a room is cleared', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    expect(raid.canWithdraw(d, run)).toBe(false);
    raid.choose(s, d, run, systemRoad(m)[0], now);
    expect(raid.canWithdraw(d, run)).toBe(false);
    clearStep(s, d, run);
    expect(raid.canWithdraw(d, run)).toBe(false);
    expect(() => raid.finish(structuredClone(s), d, structuredClone(run), 'withdrawn', now)).toThrow();
    raid.moveTo(d, run, m.start!);
    expect(raid.canWithdraw(d, run)).toBe(true);
    const res = raid.finish(s, d, run, 'withdrawn', now);
    expect(res.outcome).toBe('withdrawn');
    expect(res.rooms).toBe(m.nodes.length - 1);
    expect(res.steps).toBe(1);
  });

  it('the System rests before the boss at a rest it found, as the brief assessed it', () => {
    const s = hunter(30);
    const { d, m, x, at } = gateWith('rest', (mm, y) => systemRoad(mm).includes(y.id));
    const run = raid.begin(s, d, at);
    const road = systemRoad(m);
    run.path = road.slice(0, -1);
    run.at = run.path.length;
    run.pos = run.path[run.at - 1];
    expect(raid.systemNext(d, run)).toEqual({ rest: x.id });
    raid.systemMove(s, d, run, at);
    expect(run.rested).toEqual([x.id]);
    expect(raid.systemNext(d, run)).toEqual({ enter: m.boss });
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

  it('a cache banks what it holds, materials or a piece found whole, paid out with the clear', () => {
    const s = hunter(30);
    const { d, m, x, at } = gateWith('treasure');
    const run = raid.begin(s, d, at);
    before(run, m, x.id);
    const res = raid.choose(s, d, run, x.id, at)!;
    if (res.item) expect(run.haul).toContain(res.item);
    else {
      expect(Object.keys(res.mats ?? {}).length).toBeGreaterThan(0);
      expect(run.stash).toEqual(res.mats);
    }
  });

  it('the vault opens once the Gatekeeper is down, and holds the Gate’s own grade', () => {
    const s = hunter(30);
    const { d, m, x, at } = gateWith('vault');
    const keeper = m.nodes.find((y) => y.kind === 'elite')!;
    const run = raid.begin(s, d, at);
    before(run, m, x.id);
    if (run.path.includes(keeper.id)) run.path = run.path.filter((id) => id !== keeper.id);
    run.at = run.path.length;
    expect(raid.options(d, run).map((y) => y.id)).not.toContain(x.id);
    expect(raid.choose(s, d, run, x.id, at)).toBeNull();
    run.path = [...run.path, keeper.id];
    run.at += 1;
    expect(raid.options(d, run).map((y) => y.id)).toContain(x.id);
    const res = raid.choose(s, d, run, x.id, at)!;
    if (res.item) expect(run.haul).toContain(res.item);
    else expect(res.mats![forge.alloyId(d.rank as Rank)]).toBeGreaterThanOrEqual(CACHE.vault);
  });

  it('a hidden passage opens once a room at either end is cleared', () => {
    const { m, x } = gateWith('fight', (_, y) => !!y.hidden);
    const other = x.hidden![0];
    expect(passages(m, new Set([m.start!]))).toEqual([]);
    const open = passages(m, new Set([m.start!, x.id]));
    expect(open).toHaveLength(1);
    expect(open[0]).toContain(other);
    expect(reach(m, new Set([m.start!, x.id])).map((y) => y.id)).toContain(other);
  });
});

describe('choices', () => {
  it('a choice goes well as often as its odds say', () => {
    const s = hunter(20);
    const c = TRAP.choices[0];
    const odds = raid.oddsOf(c, raid.heroSpec(s, now));
    let won = 0;
    const n = 400;
    const { d, x: trap, at } = gateWith('trap');
    for (let i = 0; i < n; i++) {
      const x = structuredClone(s);
      const run = raid.begin(x, d, at + i * 1000);
      // Stand the run on the trap; each entry is a fresh seed, so a fresh roll.
      run.path = [trap.id];
      run.at = 0;
      if (raid.resolve(x, d, run, 0, at)?.won) won++;
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

describe('the events behind Unknown', () => {
  it('are many, each with exactly one choice for the System’s road, and that one never hurts or curses', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const e of EVENTS) {
      const sys = e.choices.filter((c) => c.system);
      expect(sys, e.id).toHaveLength(1);
      const c = sys[0];
      expect(c.odds === undefined && !c.check, e.id).toBe(true);
      expect(!c.win.hurt && !c.win.status && !(c.win.mana && c.win.mana < 0), e.id).toBe(true);
      for (const x of e.choices) expect(x.win.text.length, e.id).toBeGreaterThan(0);
    }
  });

  it('give and drain mana, and ease or add fatigue, on the hunter', () => {
    const s = defaults();
    s.vitals.hp = 100; s.vitals.mp = 0; s.vitals.fatigue = 50; s.vitals.at = Date.now();
    expect(vitals.restore(s, 0.5)).toBeGreaterThan(0);
    expect(vitals.tire(s, 10)).toBe(10);
    expect(vitals.ease(s, 25)).toBe(25);
    expect(vitals.read(s).fatigue).toBeCloseTo(35, 0);
    expect(vitals.tire(s, 500)).toBe(65);
  });
});
