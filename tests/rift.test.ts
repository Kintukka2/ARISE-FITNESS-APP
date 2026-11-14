import { describe, expect, it } from 'vitest';
import * as asc from '@/core/ascension';
import { dungeonById, entryBlock } from '@/core/gates';
import { build, isFight, mapSeed } from '@/core/map';
import * as raid from '@/core/raid';
import * as rift from '@/core/rift';
import * as sealing from '@/core/seals';
import type { Dungeon, Rank, Save } from '@/core/types';
import { RANKS } from '@/core/types';
import { dayKey } from '@/core/util';
import { EMBER } from '@/data/forge';
import { RIFT_EMBER, RIFT_KEPT, RIFT_MODIFIERS, RIFT_OPENS, RIFT_PAR, SCORE } from '@/data/rift';
import { typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-03-04T12:00:00');
const day = dayKey(now);
const DAY = 864e5;

/** Win the fight underway without fighting it, in `rounds` rounds. */
function winPending(s: Save, d: Dungeon, rounds = 3) {
  const run = s.gates.raid!;
  const x = raid.pending(d, run)!;
  raid.record(s, d, run, raid.partyFor(s, d, run, now), { index: x.n, label: '', boss: x.kind === 'boss', won: true, rounds, log: [], roster: [], felled: [], kills: {}, drops: [] }, now);
}

/** Walk the System's way to the boss's fall, every fight won unfought. */
function systemClear(s: Save, d: Dungeon) {
  const run = s.gates.raid!;
  for (let guard = 0; guard < 200 && !raid.bossDown(d, run); guard++) {
    const x = raid.pending(d, run);
    if (x && isFight(x)) { winPending(s, d); continue; }
    if (x) { raid.resolve(s, d, run, raid.systemChoice(x), now); continue; }
    if (!raid.systemMove(s, d, run, now)) break;
  }
}

/** A hunter of a grade with the Rift open. */
function hunter(rank: Rank = 'C', seed = 'rift') {
  const s = typicalHunter(30, rank, seed);
  s.gates.clears = Math.max(s.gates.clears, RIFT_OPENS);
  return s;
}

describe('the Daily Rift', () => {
  it('is drawn from the date and the grade alone: the same Gate, the same map, every time', () => {
    for (const r of RANKS) {
      const a = rift.riftDungeon(day, r);
      expect(rift.riftDungeon(day, r)).toEqual(a);
      expect(dungeonById(a.id)).toEqual(a);
      expect(a.rank).toBe(r);
      expect(rift.isRift(a)).toBe(true);
      expect(rift.riftDay(a)).toBe(day);
      expect(dungeonById(a.shape!)?.rank).toBe(r);
      expect(build(a, mapSeed(a, day))).toEqual(build(rift.riftDungeon(day, r), mapSeed(a, day)));
    }
    // A month of days takes the shape of more than one Gate.
    const shapes = new Set(Array.from({ length: 30 }, (_, i) => rift.riftDungeon(dayKey(now + i * DAY), 'C').shape));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('plays two of the Seals’ rules, drawn from its id, each one that changes something; never Heavier Air', () => {
    for (let i = 0; i < 40; i++) {
      const d = rift.riftDungeon(dayKey(now + i * DAY), RANKS[i % RANKS.length]);
      const mods = sealing.riftSeals(d);
      expect(mods).toHaveLength(RIFT_MODIFIERS);
      expect(new Set(mods).size).toBe(RIFT_MODIFIERS);
      expect(mods).not.toContain('heavier');
      if (mods.includes('wardens')) expect(d.elite).toBeTruthy();
      if (mods.includes('lightless')) expect(build(d, mapSeed(d, rift.riftDay(d))).nodes.some((x) => x.kind === 'rest')).toBe(true);
      expect(sealing.riftSeals(dungeonById(d.id)!)).toEqual(mods);
    }
    // The board's Seals are not offered on a Rift: its modifiers are fixed.
    const s = hunter('B');
    expect(sealing.offered(s, rift.riftFor(s, day), day)).toEqual([]);
  });

  it('opens after a few Gates cleared, and is walked into once a day', () => {
    const s = hunter('C');
    const d = rift.riftFor(s, day);
    s.gates.clears = RIFT_OPENS - 1;
    expect(entryBlock(s, d, now)).toBe('spent');
    s.gates.clears = RIFT_OPENS;
    expect(entryBlock(s, d, now)).toBeNull();
    // Yesterday's is gone.
    expect(entryBlock(s, rift.riftFor(s, dayKey(now - DAY)), now)).toBe('spent');
    const run = raid.begin(s, d, now);
    expect(rift.attempt(s, day)?.outcome).toBe('open');
    // Abandoned, it is carried out: the day's attempt is spent all the same.
    raid.finish(s, d, run, 'defeated', now);
    expect(entryBlock(s, d, now)).toBe('spent');
    expect(rift.attempt(s, day)).toMatchObject({ outcome: 'defeated', score: 0 });
    // Tomorrow's stands open.
    expect(rift.canEnter(s, rift.riftFor(s, dayKey(now + DAY)), dayKey(now + DAY))).toBe(true);
  });

  it('is entered at the Ascension chosen, on its modifiers, seeded by its id, and proves the Gate it takes the shape of', () => {
    // An S-Rank hunter, where Ascension is played, with level 3 chosen and level 3 opened.
    const s = typicalHunter(85, 'S', 'asc');
    s.gates.clears = Math.max(s.gates.clears, RIFT_OPENS);
    s.ascension.unlocked = 3;
    asc.choose(s, 3);
    expect(asc.proving(s)).toBe(true);
    const d = rift.riftFor(s, day);
    const run = raid.begin(s, d, now, ['swollen', 'dry', 'heavier']);
    expect(asc.levelOf(run)).toBe(3);
    expect(run.seals).toEqual(sealing.riftSeals(d));
    expect(run.seed).toBe(d.id);
    expect(run.chosen ?? null).toBeNull();
    expect(s.gates.entered).not.toContain(d.id);
    systemClear(s, d);
    raid.finish(s, d, s.gates.raid!, 'cleared', now);
    expect(s.ascension.proof.gates).toContain(d.shape);
    expect(s.ascension.proof.gates).not.toContain(d.id);
  });

  it('scores the way gone, the Gatekeeper and the boss; on a clear its Feats, its pace and the health left', () => {
    const none = rift.scoreOf({ won: 0, keeper: false, cleared: false, feats: 0, rounds: 0, hp: 1 });
    expect(none.total).toBe(0);
    const partway = rift.scoreOf({ won: 3, keeper: true, cleared: false, feats: 2, rounds: 4, hp: 0.5 });
    expect(partway.total).toBe(2 * SCORE.fight + SCORE.keeper);
    const clear = rift.scoreOf({ won: 5, keeper: true, cleared: true, feats: 2, rounds: 14, hp: 0.5 });
    const under = RIFT_PAR * 5 - 14;
    expect(clear.lines.map((x) => [x.key, x.n])).toEqual([['fight', 3], ['keeper', 1], ['boss', 1], ['feat', 2], ['pace', under], ['health', 50]]);
    expect(clear.total).toBe(3 * SCORE.fight + SCORE.keeper + SCORE.boss + 2 * SCORE.feat + under * SCORE.pace + SCORE.health / 2);
    // Slower than par scores no pace, never less than nothing.
    expect(rift.scoreOf({ won: 2, keeper: false, cleared: true, feats: 0, rounds: 99, hp: 1 }).lines.find((x) => x.key === 'pace')!.pts).toBe(0);
  });

  it('a clear pays as its Gate, counted as that Gate; the Rift’s Ember and no Seal’s; and is written to the history', () => {
    const s = hunter('C', 'pay');
    const d = rift.riftFor(s, day);
    const home = dungeonById(d.shape!)!;
    const ember = s.materials[EMBER.id] ?? 0;
    const had = s.gates.cleared.includes(home.id);
    const metBefore = [...(s.gates.feats?.[home.id] ?? [])];
    raid.begin(s, d, now);
    systemClear(s, d);
    const res = raid.finish(s, d, s.gates.raid!, 'cleared', now);
    // Its first clear, and its Feats met for the first time, are its Gate's.
    expect(res.bounty > 0).toBe(!had);
    expect(s.gates.cleared).toContain(home.id);
    expect(s.gates.cleared).not.toContain(d.id);
    expect(res.feats.fresh).toEqual(res.feats.met.filter((id) => !metBefore.includes(id)));
    expect(s.gates.feats?.[d.id]).toBeUndefined();
    // Its modifiers pay no Seal's Ember: the Rift pays its own.
    expect(res.seals).toEqual([]);
    expect(res.mats[EMBER.id]).toBe(RIFT_EMBER.C);
    expect(s.materials[EMBER.id]).toBe(ember + RIFT_EMBER.C);
    // It keeps no tally of its own, and the board's Gate is not sealed by it.
    expect(s.gates.runs[d.id]).toBeUndefined();
    expect(res.rift!.total).toBeGreaterThanOrEqual(SCORE.boss);
    expect(res.rift!.newBest).toBe(true);
    expect(rift.attempt(s, day)).toMatchObject({ outcome: 'cleared', score: res.rift!.total, grade: 'C', shape: d.shape });
    expect(rift.best(s)).toBe(res.rift!.total);
  });

  it('keeps a month of days, newest first, and the best of them', () => {
    const s = hunter('D', 'hist');
    for (let i = 0; i < RIFT_KEPT + 5; i++) {
      const d = rift.riftFor(s, dayKey(now + i * DAY));
      rift.enter(s, d, []);
      rift.settle(s, d, 'cleared', { lines: [], total: 100 + i });
    }
    expect(rift.days(s)).toHaveLength(RIFT_KEPT);
    expect(rift.days(s)[0].day).toBe(dayKey(now + (RIFT_KEPT + 4) * DAY));
    expect(rift.best(s)).toBe(100 + RIFT_KEPT + 4);
  });
});
