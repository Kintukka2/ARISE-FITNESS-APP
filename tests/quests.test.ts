import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { reclassification } from '@/core/quests';
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
