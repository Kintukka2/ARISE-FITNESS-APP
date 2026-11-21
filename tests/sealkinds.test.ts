import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { ALL_DUNGEONS } from '@/core/gates';
import { build, mapSeed, pairKey, sealOf, systemRoad, tollDoors, type GateMap, type MapNode } from '@/core/map';
import * as raid from '@/core/raid';
import * as forge from '@/core/forge';
import * as vitals from '@/core/vitals';
import * as shadowgear from '@/core/shadowgear';
import * as shadows from '@/core/shadows';
import { autoAllocate, grantXP, syncClass, totalXpFor, reclassifyAll } from '@/core/progression';
import { TOLL } from '@/data/nodes';
import { SHADOW_GEAR_STAT } from '@/data/shadowgear';
import type { Dungeon } from '@/core/types';
import { rng } from '@/core/util';

const DAYS = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 1, 1 + i * 2)).toISOString().slice(0, 10));
const GATES = ALL_DUNGEONS.filter((g) => !g.floor && !g.trial);

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  autoAllocate(s);
  syncClass(s);
  return s;
}

function* maps(): Generator<{ d: Dungeon; day: string; m: GateMap }> {
  for (const d of GATES) for (const day of DAYS) yield { d, day, m: build(d, mapSeed(d, day), 'labyrinth5') };
}

/** The rooms on the way from the entrance to a room, by corridor. */
function wayTo(m: GateMap, id: string): string[] {
  const from: Record<string, string> = {};
  const queue = [m.start!];
  const seen = new Set(queue);
  while (queue.length) {
    const at = queue.shift()!;
    for (const nb of m.byId[at].next) if (!seen.has(nb)) { seen.add(nb); from[nb] = at; queue.push(nb); }
  }
  if (!seen.has(id)) return [];
  const out = [id];
  while (from[out[0]] && from[out[0]] !== m.start) out.unshift(from[out[0]]);
  return out;
}

/** A Gate and day whose toll door asks as given, and the room on the near side of it reached by corridor. */
function doorOf(kind: string): { d: Dungeon; day: string; m: GateMap; near: MapNode; far: string; at: number } {
  for (const { d, day, m } of maps()) {
    for (const [a, b] of tollDoors(m)) {
      if (sealOf(m, a, b) !== kind) continue;
      for (const [n, f] of [[a, b], [b, a]]) {
        if (wayTo(m, n).length || n === m.start) return { d, day, m, near: m.byId[n], far: f, at: Date.parse(`${day}T12:00:00`) };
      }
    }
  }
  throw new Error(`no ${kind} seal`);
}

function standAt(s: ReturnType<typeof hunter>, d: Dungeon, m: GateMap, near: MapNode, at: number) {
  const run = raid.begin(s, d, at);
  const way = wayTo(m, near.id);
  run.path = way;
  run.at = way.length;
  run.pos = near.id;
  return run;
}

describe('seals on the plans of labyrinth5', () => {
  it('ask HP, MP, the Gate’s alloy or, rarely and only before a cache, Shadow Essence, and move nothing else', () => {
    const seen = new Set<string>();
    let doors = 0;
    let essence = 0;
    for (const { d, day, m } of maps()) {
      const old = build(d, mapSeed(d, day), 'labyrinth4');
      expect(old.seals).toBeUndefined();
      expect(m.nodes.map((x) => x.id)).toEqual(old.nodes.map((x) => x.id));
      expect(systemRoad(m)).toEqual(systemRoad(old));
      for (const [a, b] of tollDoors(m)) {
        doors++;
        const k = sealOf(m, a, b);
        seen.add(k);
        expect(sealOf(old, a, b)).toBe('hp');
        if (k === 'essence') {
          essence++;
          const cache = [m.byId[a], m.byId[b]].find((x) => x.kind === 'treasure' && x.shadow);
          expect(cache).toBeDefined();
          expect(cache!.next).toHaveLength(0);
        }
      }
      for (const x of m.nodes) if (x.shadow) expect(x.kind).toBe('treasure');
    }
    expect([...seen].sort()).toEqual(['essence', 'hp', 'mats', 'mp']);
    expect(essence).toBeGreaterThan(0);
    expect(essence / doors).toBeLessThan(0.15);
  });

  it('take MP, the alloy or the Essence they ask, and refuse a hunter short of it', () => {
    for (const kind of ['mp', 'mats', 'essence'] as const) {
      const { d, m, near, far, at } = doorOf(kind);
      const s = hunter(30);
      const run = standAt(s, d, m, near, at);
      const price = raid.tollPrice(s, d, run, near.id, far, at);
      expect(price.kind).toBe(kind);
      // Short of it, nothing is paid.
      if (kind === 'mats') s.materials[price.mat!] = price.n - 1;
      if (kind === 'essence') s.shadows.essence = price.n - 1;
      if (kind === 'mp') vitals.spendMp(s, vitals.read(s, at).mp - (price.n - 1), at);
      expect(raid.canPay(s, d, run, price, at)).toBe(false);
      expect(raid.payToll(s, d, run, far, at)).toBe(false);
      // With it, it is paid and the door opens.
      if (kind === 'mats') s.materials[price.mat!] = price.n + 3;
      if (kind === 'essence') s.shadows.essence = price.n + 3;
      if (kind === 'mp') vitals.restore(s, 1, at);
      const mpWas = vitals.read(s, at).mp;
      expect(raid.payToll(s, d, run, far, at)).toBe(true);
      expect(run.tolls).toContain(pairKey(near.id, far));
      if (kind === 'mats') { expect(forge.held(s, price.mat!)).toBe(3); expect(price.n).toBe(TOLL.alloy[d.rank]); }
      if (kind === 'essence') { expect(s.shadows.essence).toBe(3); expect(price.n).toBe(TOLL.essence[d.rank]); }
      if (kind === 'mp') expect(vitals.read(s, at).mp).toBe(mpWas - price.n);
    }
  });

  it('keep a Shadows’ cache behind a seal of Essence, its piece paid into the hold at the end of the run', () => {
    const { d, m, near, far, at } = doorOf('essence');
    const s = hunter(40);
    s.shadows.essence = 10;
    const run = standAt(s, d, m, near, at);
    expect(raid.payToll(s, d, run, far, at)).toBe(true);
    const cache = m.byId[far].shadow ? far : near.id;
    const got = raid.choose(s, d, run, cache, at);
    expect(got?.shadowItem).toBeDefined();
    expect(got!.shadowItem!.rank).toBe(d.rank);
    expect(run.shadowHaul).toHaveLength(1);
    // Walked back to the entrance, and out.
    raid.moveTo(d, run, m.start!);
    const res = raid.finish(s, d, run, 'withdrawn', at);
    expect(res.shadowLoot).toHaveLength(1);
    expect(shadowgear.held(s).map((x) => x.id)).toContain(got!.shadowItem!.id);
  });
});

describe('Shadow equipment', () => {
  it('adds to the stats of the Shadow wearing it, moves between Shadows and back to the hold, and leaves with a release', () => {
    const s = defaults();
    const e = ALL_DUNGEONS[0].boss;
    s.shadows.army = [
      { id: 'a', enemyId: e, boundAt: '2026-01-01', out: 0, kills: 0, bosses: 0, rank: 0, xp: 0 },
      { id: 'b', enemyId: e, boundAt: '2026-01-01', out: 0, kills: 0, bosses: 0, rank: 0, xp: 0 },
    ];
    const piece = shadowgear.draw('C', rng('test|piece'));
    expect(Object.values(piece.stats).reduce((n, v) => n + (v ?? 0), 0)).toBeLessThanOrEqual(Math.round(SHADOW_GEAR_STAT.C) + Math.round(SHADOW_GEAR_STAT.C / 2) + 1);
    shadowgear.give(s, [piece]);
    const before = shadows.statsOf(s.shadows.army[0]);
    expect(shadowgear.equip(s, 'a', piece.id)).toBe(true);
    expect(shadowgear.held(s)).toHaveLength(0);
    const after = shadows.statsOf(s.shadows.army[0]);
    for (const [k, v] of Object.entries(piece.stats)) expect(after[k as keyof typeof after]).toBe(before[k as keyof typeof before] + (v ?? 0));
    expect(shadows.power(s.shadows.army[0])).toBeGreaterThan(shadows.power(s.shadows.army[1]));
    // To another Shadow, then off again.
    expect(shadowgear.equip(s, 'b', piece.id)).toBe(true);
    expect(s.shadows.army[0].gear?.[piece.slot]).toBeUndefined();
    expect(shadowgear.wearer(s, piece.id)?.id).toBe('b');
    expect(shadowgear.unequip(s, 'b', piece.slot)).toBe(true);
    expect(shadowgear.held(s)).toHaveLength(1);
    // Released, what it wore goes back to the hold.
    shadowgear.equip(s, 'a', piece.id);
    shadows.release(s, 'a');
    expect(shadowgear.held(s).map((x) => x.id)).toEqual([piece.id]);
  });
});
