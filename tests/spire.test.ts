import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById, entryBlock, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed } from '@/core/map';
import * as raid from '@/core/raid';
import * as spire from '@/core/spire';
import { autoAllocate, GATE_XP, grantXP, syncClass, totalXpFor } from '@/core/progression';
import { GATE_SHARDS } from '@/core/shop';
import { RANKS } from '@/core/types';
import { addDays, dayKey } from '@/core/util';
import { BLOCK, SEASON_PAY, SPIRE_FLOORS, SPIRE_GROWTH, SPIRE_TOP } from '@/data/spire';
import { SPIRE_TUNE } from '@/data/gatetune';
import { walk } from './walk';
import { typicalHunter } from '../scripts/hunters';

// A Wednesday. Its week began on Monday the 2nd.
const day = '2026-02-04';
const now = Date.parse(day + 'T12:00:00');
const nextWeek = Date.parse('2026-02-09T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  autoAllocate(s);
  syncClass(s);
  s.gates.cleared.push(PRACTICE_GATE.id);
  s.gates.clears = 10;
  return s;
}

/** Climb the next block down the System's road, and settle it. */
function climb(s: ReturnType<typeof hunter>, at = now) {
  const d = spire.nextSpire(s, dayKey(at));
  const run = raid.begin(s, d, at);
  const { won } = walk(s, d, at);
  return { d, res: raid.finish(s, d, run, won ? 'cleared' : 'defeated', at) };
}

describe('the floors', () => {
  it('come in blocks, each grade’s starting on a block’s first floor', () => {
    for (const r of RANKS) {
      expect((SPIRE_FLOORS[r] - 1) % BLOCK).toBe(0);
      expect(spire.floorGrade(SPIRE_FLOORS[r])).toBe(r);
    }
    expect(spire.floorGrade(SPIRE_FLOORS.D - 1)).toBe('E');
    expect(spire.floorGrade(SPIRE_TOP + 400)).toBe('S');
    expect(spire.blockOf(1)).toBe(0);
    expect(spire.blockOf(BLOCK)).toBe(0);
    expect(spire.firstFloor(spire.blockOf(BLOCK + 1))).toBe(BLOCK + 1);
  });

  it('a block is a gate of its own: a floor to every step, a rest, then the boss, the same all week', () => {
    const season = spire.seasonOf(day);
    for (const b of [0, 4, 9, 14, 19, 26]) {
      const d = spire.spireBlock(season, b);
      expect(dungeonById(d.id)).toEqual(d);
      expect(spire.isSpire(d)).toBe(true);
      expect(spire.spireBlock(spire.seasonOf(addDays(day, 3)), b)).toEqual(d);
      const m = build(d, mapSeed(d, day));
      expect(m.layers).toHaveLength(BLOCK);
      expect(m.layers[BLOCK - 2].map((x) => x.kind)).toEqual(['rest']);
      expect(m.layers[BLOCK - 1].map((x) => x.kind)).toEqual(['boss']);
      expect(d.rank).toBe(spire.floorGrade(spire.firstFloor(b)));
    }
    // The floors rearrange from one week to the next.
    const weeks = [0, 7, 14, 21].map((n) => spire.spireBlock(spire.seasonOf(addDays(day, n)), 8).boss);
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it('keeps getting harder past the top floor', () => {
    const top = SPIRE_TOP / BLOCK;
    expect(SPIRE_TUNE).toHaveLength(top);
    expect(spire.spireTune(top + 4)).toBeCloseTo(SPIRE_TUNE[top - 1] * SPIRE_GROWTH ** 5, 6);
    const s = hunter(100);
    const rate = (b: number) => raid.project(s, spire.spireBlock(spire.seasonOf(day), b), 8, now).rate;
    expect(rate(top + 30)).toBeLessThan(rate(top));
  });
});

describe('the climb', () => {
  it('starts at the hunter’s own grade’s floors, and goes on above their best', () => {
    const s = hunter(25);
    expect(spire.firstFloor(spire.nextBlock(s, day))).toBe(SPIRE_FLOORS.C);
    s.spire = { ...s.spire, season: spire.seasonOf(day), best: 30 };
    expect(spire.firstFloor(spire.nextBlock(s, day))).toBe(31);
    // A new week starts again from the grade's floors.
    expect(spire.firstFloor(spire.nextBlock(s, dayKey(nextWeek)))).toBe(SPIRE_FLOORS.C);
  });

  it('a cleared block raises the week’s best and pays like a gate, with no bounty and nothing sealed', () => {
    // Geared, and well above the floors it is built for, so it clears.
    const s = typicalHunter(19, 'D', 'spire-test');
    s.gates.cleared.push(PRACTICE_GATE.id);
    s.gates.clears = 10;
    const xp = s.stats.xpTotal;
    const { d, res } = climb(s);
    expect(res.outcome).toBe('cleared');
    expect(res.spire).toEqual({ floor: spire.lastFloor(spire.blockOf(d.floor!)), best: true });
    expect(s.spire.best).toBe(res.spire!.floor);
    expect(s.spire.top).toBe(res.spire!.floor);
    expect(res.bounty).toBe(0);
    expect(s.stats.xpTotal - xp).toBe(GATE_XP[d.rank as 'D'] + res.contracts.xp);
    expect(s.gates.cleared).not.toContain(d.id);
    expect(s.gates.sealed.ids).not.toContain(d.id);
    expect(s.gates.clears).toBe(11);
    // And the next block up is the one waiting.
    expect(spire.nextSpire(s, day).floor).toBe(res.spire!.floor + 1);
  });

  it('walking out from the rest, or being carried out, leaves the week’s best where it was', () => {
    const s = hunter(12);
    const d = spire.nextSpire(s, day);
    const run = raid.begin(s, d, now);
    run.lost = true;
    expect(raid.finish(s, d, run, 'defeated', now).spire).toBeNull();
    expect(s.spire.best).toBe(0);
  });

  it('a block two grades above the hunter’s own is not theirs to enter', () => {
    const s = hunter(25);
    s.spire = { ...s.spire, season: spire.seasonOf(day), best: SPIRE_FLOORS.A - 1 };
    expect(spire.nextSpire(s, day).rank).toBe('A');
    expect(entryBlock(s, spire.nextSpire(s, day), now)).toBe('licence');
  });
});

describe('the week', () => {
  it('pays once when it closes, by the grade of its highest floor, then starts over', () => {
    const s = hunter(40);
    const season = spire.seasonOf(day);
    s.spire = { ...s.spire, season, best: 45, top: 45 };
    expect(spire.settle(s, now)).toBeNull();
    const shards = s.wallet.shards;
    const items = s.items.length;
    const paid = spire.settle(s, nextWeek)!;
    expect(paid).toMatchObject({ season, best: 45, tier: 'B-Rank', shards: GATE_SHARDS.B * SEASON_PAY.shards });
    expect(s.wallet.shards - shards).toBe(paid.shards);
    expect(s.items.length).toBe(items + 1);
    expect(s.spire.best).toBe(0);
    expect(s.spire.top).toBe(45);
    expect(s.spire.last).toEqual(paid);
    expect(spire.settle(s, nextWeek)).toBeNull();
  });

  it('a week that climbed nothing pays nothing, and every floor far past the top pays more', () => {
    const s = hunter(40);
    s.spire = { ...s.spire, season: spire.seasonOf(day), best: 0 };
    expect(spire.settle(s, nextWeek)).toBeNull();
    const far = spire.seasonTier(SPIRE_TOP + SEASON_PAY.beyond * 2)!;
    expect(far.tier).toBe('S+2');
    expect(far.shards).toBeGreaterThan(spire.seasonTier(SPIRE_TOP)!.shards);
  });

  it('a block entered last week and cleared this one pays its clear, but not toward this week', () => {
    const s = hunter(12);
    s.spire = { ...s.spire, season: spire.seasonOf(day), best: 0 };
    const d = spire.nextSpire(s, day);
    expect(spire.climbed(s, d, nextWeek)).toEqual({ floor: spire.lastFloor(spire.blockOf(d.floor!)), best: false });
    expect(s.spire.season).toBe(spire.seasonOf(dayKey(nextWeek)));
    expect(s.spire.best).toBe(0);
  });
});

describe('the week as a quest', () => {
  it('sets the first floor of the next tier, and the tier it pays is above the one already reached', () => {
    for (let best = 0; best <= SPIRE_TOP + SEASON_PAY.beyond * 4; best += BLOCK) {
      const goal = spire.nextTier(best);
      expect(goal).toBeGreaterThan(best);
      expect(spire.seasonTier(goal)!.tier).not.toBe(spire.seasonTier(best)?.tier);
      // Nothing below the goal pays more than the week already does.
      for (let f = best + 1; f < goal; f++) expect(spire.seasonTier(f)!.tier).toBe(spire.seasonTier(best)?.tier ?? spire.seasonTier(f)!.tier);
    }
    expect(spire.nextTier(0)).toBe(SPIRE_FLOORS.E);
    expect(spire.nextTier(SPIRE_FLOORS.D)).toBe(SPIRE_FLOORS.C);
    expect(spire.nextTier(SPIRE_FLOORS.S)).toBe(SPIRE_TOP + 1);
    expect(spire.nextTier(SPIRE_TOP + 1)).toBe(SPIRE_TOP + SEASON_PAY.beyond + 1);
  });

  it('counts from where the hunter climbs from, so it never sets a floor below their first block', () => {
    const s = hunter(25);
    s.spire = { ...s.spire, season: spire.seasonOf(day), best: 0 };
    const first = spire.firstFloor(spire.nextBlock(s, day));
    expect(first).toBe(SPIRE_FLOORS.C);
    expect(spire.tierGoal(s, day)).toBe(SPIRE_FLOORS.C);
    s.spire.best = first + BLOCK - 1;
    expect(spire.tierGoal(s, day)).toBe(SPIRE_FLOORS.B);
  });
});
