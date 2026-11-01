import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { reclassification, waiting } from '@/core/quests';
import * as ascension from '@/core/ascension';
import * as contracts from '@/core/contracts';
import { PRACTICE_GATE } from '@/core/gates';
import { deltaOf, earned, freeOf, MISSIONS } from '@/core/missions';
import { autoAllocate, grantXP, RANK_LADDER, RANK_UP_POINTS, syncClass, totalXpFor } from '@/core/progression';
import { classById } from '@/data/classes';
import { SLOTS } from '@/data/shadows';
import { HOLLOW_THRONE } from '@/data/special';

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  autoAllocate(s);
  syncClass(s);
  return s;
}

describe('reclassification', () => {
  it('names the next rank on the ladder, the level it needs, and the experience left', () => {
    for (const level of [1, 5, 9, 10, 19, 34, 49, 69, 99]) {
      const s = hunter(level);
      const q = reclassification(s)!;
      const next = RANK_LADDER.find((r) => r.min > level)!;
      expect(q.to).toEqual(next);
      expect(q.left).toBe(totalXpFor(next.min) - totalXpFor(level) - s.hunter.xp);
      expect(q.share).toBeGreaterThanOrEqual(0);
      expect(q.share).toBeLessThan(1);
      expect(q.points).toBe(RANK_UP_POINTS);
    }
    expect(reclassification(hunter(100))).toBeNull();
  });

  it('says what the rank brings, as the engine will pay it', () => {
    const e = reclassification(hunter(5))!;
    expect(e.cls?.was).toBeNull();
    const c = hunter(15);
    const toC = reclassification(c)!;
    // The class it names is the one the hunter's stats would be given, once the level is reached.
    grantXP(c, totalXpFor(20) - totalXpFor(15) - c.hunter.xp);
    syncClass(c);
    expect(classById(c.hunter.classId)?.name).toBe(toC.cls?.is);
    expect(toC.slots).toEqual([SLOTS.D, SLOTS.C]);
    expect(toC.pick?.names).toHaveLength(2);
    expect(reclassification(hunter(40))!.slots).toEqual([SLOTS.B, SLOTS.A]);
    expect(reclassification(hunter(60))!.throne).toBe(true);
    const done = hunter(60);
    done.gates.cleared.push(HOLLOW_THRONE.id);
    expect(reclassification(done)!.throne).toBe(false);
    // Sovereign assigns no class of its own.
    expect(reclassification(hunter(80))!.cls).toBeNull();
  });
});

describe('the Quests tab', () => {
  const day = '2026-02-02';

  it('counts the day’s Daily Quests until shown, and the Trial while today’s attempt is unused', () => {
    const s = hunter(25);
    s.gates.cleared.push(PRACTICE_GATE.id);
    const daily = contracts.unseen(s, day);
    expect(daily).toBeGreaterThan(0);
    expect(waiting(s, day)).toBe(daily);
    // The Gates are proved: the Trial stands open.
    s.ascension.proof.gates = Array.from({ length: ascension.proofNeeds(s) }, (_, i) => `DNG-P${i}`);
    expect(ascension.trialReady(s, day)).toBe(true);
    expect(waiting(s, day)).toBe(daily + 1);
    contracts.show(s, day);
    expect(waiting(s, day)).toBe(1);
    // Walking into it spends the day's attempt, whatever comes of it.
    ascension.enterTrial(s, day);
    expect(waiting(s, day)).toBe(0);
  });

  it('counts nothing below C-Rank, where no proof counts yet', () => {
    const s = hunter(15);
    s.gates.cleared.push(PRACTICE_GATE.id);
    contracts.show(s, day);
    s.ascension.proof.gates = ['DNG-P0', 'DNG-P1', 'DNG-P2', 'DNG-P3'];
    expect(waiting(s, day)).toBe(0);
  });
});

describe('the Secret Quests window', () => {
  it('adds up what every Secret Quest held has paid, and nothing it has not', () => {
    const s = defaults();
    expect(earned(s)).toEqual({ stats: {}, free: 0, slot: 0 });
    const held = MISSIONS.filter((_, i) => i % 3 === 0);
    s.hunter.missions = held.map((m) => m.id);
    const e = earned(s);
    expect(e.free).toBe(held.reduce((n, m) => n + freeOf(m), 0));
    expect(e.slot).toBe(held.reduce((n, m) => n + (m.grant.slot ?? 0), 0));
    for (const k of ['STR', 'AGI', 'PER', 'VIT', 'INT'] as const) {
      expect(e.stats[k] ?? 0).toBe(held.reduce((n, m) => n + (deltaOf(m)[k] ?? 0), 0));
    }
  });
});
