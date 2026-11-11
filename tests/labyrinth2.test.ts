import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { ALL_DUNGEONS, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed, pairKey, reach, sight, systemRoad, systemWalk, tollDoors, type GateMap, type MapNode } from '@/core/map';
import * as raid from '@/core/raid';
import * as forge from '@/core/forge';
import * as shop from '@/core/shop';
import { autoAllocate, grantXP, syncClass, totalXpFor, reclassifyAll } from '@/core/progression';
import { landmarkOf, LANDMARKS, leadFamily } from '@/data/landmarks';
import { NOTICE, TOLL } from '@/data/nodes';
import type { Dungeon, Rank } from '@/core/types';

const DAYS = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 1, 1 + i * 3)).toISOString().slice(0, 10));
const GATES = ALL_DUNGEONS.filter((g) => !g.floor && !g.trial);

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  autoAllocate(s);
  syncClass(s);
  return s;
}

/** Every map of every Gate over some days, on the later plans. */
function* maps(days = DAYS.slice(0, 6)): Generator<{ d: Dungeon; day: string; m: GateMap }> {
  for (const d of GATES) for (const day of days) yield { d, day, m: build(d, mapSeed(d, day)) };
}

/** A Gate and day whose map holds a room as asked. */
function find(where: (m: GateMap, x: MapNode) => boolean) {
  for (const day of DAYS) for (const d of GATES) {
    const m = build(d, mapSeed(d, day));
    const x = m.nodes.find((y) => where(m, y));
    if (x) return { d, day, m, x, at: Date.parse(`${day}T12:00:00`) };
  }
  throw new Error('no such room');
}

describe('the later plans', () => {
  it('give every floor a landmark of the family that leads the Gate, off the road, seen from the start', () => {
    expect(new Set(LANDMARKS.map((l) => l.family)).size).toBe(LANDMARKS.length);
    for (const { d, m } of maps()) {
      const lm = m.nodes.filter((x) => x.kind === 'landmark');
      if (!landmarkOf(leadFamily(d.identity))) { expect(lm).toHaveLength(0); continue; }
      expect(lm).toHaveLength(m.floors.length);
      for (const x of lm) {
        expect(x.landmark).toBe(leadFamily(d.identity));
        expect(x.event).toBe(landmarkOf(x.landmark!)!.event.id);
        expect(x.off).toBeGreaterThanOrEqual(1);
        expect(systemRoad(m)).not.toContain(x.id);
      }
      const seen = sight(m, new Set([m.start!]));
      for (const x of lm) expect(seen.has(x.id)).toBe(true);
    }
  });

  it('a landmark holds a choice with its odds stated, and the System’s way past it never hurts', () => {
    for (const l of LANDMARKS) {
      const sys = l.event.choices.filter((c) => c.system);
      expect(sys).toHaveLength(1);
      expect(sys[0].win.hurt ?? 0).toBe(0);
      expect(sys[0].win.status).toBeUndefined();
      expect(l.event.choices.some((c) => !c.system && (c.odds !== undefined || c.check))).toBe(true);
    }
  });

  it('open each floor on one creature, and grow the fights toward its head', () => {
    const byBand: number[][] = [[], [], []];
    for (const { m } of maps()) {
      const thresholds = m.nodes.filter((x) => x.threshold);
      expect(thresholds).toHaveLength(m.floors.length);
      for (const x of thresholds) if (x.kind === 'fight') expect(x.foes).toHaveLength(1);
      for (const x of m.nodes) if (x.kind === 'fight' && !x.threshold && x.band !== undefined) byBand[x.band].push(x.foes!.length);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(byBand[0])).toBeLessThan(mean(byBand[1]));
    expect(mean(byBand[1])).toBeLessThan(mean(byBand[2]));
  });

  it('hold at most one rest a floor outside a wing, one corridor off the road', () => {
    for (const { m } of maps()) {
      m.floors.forEach((_, k) => {
        const rests = m.nodes.filter((x) => x.kind === 'rest' && (x.floor ?? 0) === k && !x.wing);
        expect(rests.length).toBeLessThanOrEqual(1);
        for (const x of rests) expect(x.off).toBe(1);
      });
    }
  });

  it('the System’s way steps into every rest beside its road, and never into a wing, a secret or a toll door', () => {
    for (const { m } of maps()) {
      const road = new Set(systemRoad(m));
      const walk = systemWalk(m);
      const entered = new Set(walk.flatMap((w) => ('enter' in w ? [w.enter] : [])));
      for (const x of m.nodes) {
        if (x.kind === 'rest' && !x.wing && x.next.some((id) => road.has(id))) expect(entered.has(x.id)).toBe(true);
        if (x.wing || x.secret || x.kind === 'landmark') expect(entered.has(x.id)).toBe(false);
      }
      for (const [a, b] of tollDoors(m)) expect(walk.some((w, i) => i > 0 && 'enter' in w && 'enter' in walk[i - 1] && pairKey((walk[i - 1] as { enter: string }).enter, w.enter) === pairKey(a, b))).toBe(false);
    }
  });

  it('hide a secret cache behind a hidden passage alone, off the plan until the passage opens', () => {
    const { m, x } = find((_, y) => !!y.secret);
    expect(x.next).toEqual([]);
    expect(x.hidden).toHaveLength(1);
    expect(x.deep).toBe(true);
    const n = x.hidden![0];
    const cleared = new Set([m.start!, n]);
    expect(sight(m, cleared).has(x.id)).toBe(false);
    expect(reach(m, cleared).map((y) => y.id)).not.toContain(x.id);
    expect(sight(m, cleared, [], { notice: () => true }).has(x.id)).toBe(true);
    expect(reach(m, cleared, { notice: () => true }).map((y) => y.id)).toContain(x.id);
  });

  it('leave the Practice Gate as the first dungeon it always was', () => {
    const m = build(PRACTICE_GATE, mapSeed(PRACTICE_GATE, '2026-02-02'));
    expect(m.secrets).toBeUndefined();
    expect(m.nodes.some((x) => x.kind === 'landmark' || x.secret || x.toll || x.wing)).toBe(false);
  });
});

describe('noticing', () => {
  it('a run notices a passage or not, once for the run, and Perception makes it likelier', () => {
    const { d, x, at } = find((_, y) => !!y.hidden && !y.secret);
    const rate = (per: number) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const s = hunter(20);
        const run = raid.begin(s, d, at + i * 1000);
        run.party[0] = { ...run.party[0], base: { ...run.party[0].base, PER: per } };
        const o = raid.openings(run);
        expect(o.notice!(x.id, x.hidden![0])).toBe(o.notice!(x.hidden![0], x.id));
        if (o.notice!(x.id, x.hidden![0])) n++;
      }
      return n / 300;
    };
    const low = rate(0);
    const high = rate(80);
    expect(Math.abs(low - NOTICE.base)).toBeLessThan(0.08);
    expect(high).toBeGreaterThan(low + 0.2);
  });

  it('a Gate Survey charts the map: every passage opens with no noticing, inside the run and for one begun after it', () => {
    const { d, at } = find((_, y) => !!y.hidden);
    const s = hunter(20);
    shop.stockUp(s, 'survey');
    expect(raid.survey(s, d, at)).toBe(true);
    const run = raid.begin(s, d, at);
    expect(run.charted).toBe(true);
    expect(raid.openings(run).charted).toBe(true);
  });
});

describe('toll doors', () => {
  it('open for good when the hunter pays their HP standing at one, and not when too hurt to pay', () => {
    const { d, m, x, at } = find((mm, y) => !!y.toll && y.next.length > 0 && !y.wing && wayLen(mm, y) > 0);
    const s = hunter(30);
    const run = raid.begin(s, d, at);
    // Stand in the room at the door, every room on the way there cleared.
    const way = wayTo(m, x.id);
    run.path = way;
    run.at = way.length;
    run.pos = x.id;
    const to = x.toll![0];
    expect(raid.tollsHere(d, run).map((t) => t.to)).toContain(to);
    expect(raid.options(d, run).map((y) => y.id)).not.toContain(to);
    const hero = raid.partyFor(s, d, run, at)[0];
    const hp = hero.hp;
    expect(raid.payToll(s, d, run, to, at)).toBe(true);
    expect(run.carried[0].hp).toBe(hp - Math.round(hero.maxHp * TOLL.hp));
    expect(run.tolls).toContain(pairKey(x.id, to));
    expect(raid.tollsHere(d, run).map((t) => t.to)).not.toContain(to);
    if (!run.path.includes(to)) expect(raid.options(d, run).map((y) => y.id)).toContain(to);
    // Paid once, it stays open; and a hunter too hurt to pay cannot.
    expect(raid.payToll(s, d, run, to, at)).toBe(false);
    const s2 = hunter(30);
    const run2 = raid.begin(s2, d, at);
    run2.path = way;
    run2.at = way.length;
    run2.pos = x.id;
    run2.carried[0].hp = 2;
    expect(raid.payToll(s2, d, run2, to, at)).toBe(false);
  });
});

describe('deep rooms', () => {
  it('a cache two corridors off the road finds at the Gate’s own grade', () => {
    const { d, m, x, at } = find((mm, y) => y.kind === 'treasure' && !!y.deep && !y.secret && !y.wing && y.next.length > 0 && wayLen(mm, y) > 0);
    const s = hunter(30);
    const run = raid.begin(s, d, at);
    const way = wayTo(m, x.id);
    run.path = way.slice(0, -1);
    run.at = run.path.length;
    run.pos = run.path[run.path.length - 1] ?? m.start!;
    const res = raid.choose(s, d, run, x.id, at)!;
    if (res.mats) expect(Object.keys(res.mats)).toContain(forge.alloyId(d.rank as Rank));
  });
});

/** The fewest corridors from the entrance to a room: the rooms on that way, the room last. */
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
const wayLen = (m: GateMap, x: MapNode) => wayTo(m, x.id).length;

