import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { canReclassify, grantXP, rankOf, reclassify, reclassifyAll, totalXpFor, practiceAward, PRACTICE_LEVEL, rankFor, spendPoint, autoAllocate, syncClass, xpToNext } from '@/core/progression';

describe('progression', () => {
  it('levels up and pays three points per level; a rank is the hunter’s to claim, and pays when claimed', () => {
    const s = defaults();
    const r = grantXP(s, totalXpFor(10));
    expect(s.hunter.level).toBe(10);
    expect(r.qualifies?.key).toBe('D');
    expect(rankOf(s).key).toBe('E');
    expect(s.hunter.points).toBe(9 * 3);
    expect(canReclassify(s)).toBe(true);
    expect(reclassify(s)).toMatchObject({ from: { key: 'E' }, to: { key: 'D' }, points: 5 });
    expect(rankOf(s).key).toBe('D');
    expect(s.hunter.points).toBe(9 * 3 + 5);
    expect(canReclassify(s)).toBe(false);
    expect(reclassify(s)).toBeNull();
  });

  it('claims one rung at a time, and never past the level', () => {
    const s = defaults();
    expect(reclassify(s)).toBeNull();
    grantXP(s, totalXpFor(25));
    expect(reclassify(s)?.to.key).toBe('D');
    expect(reclassify(s)?.to.key).toBe('C');
    expect(reclassify(s)).toBeNull();
    expect(s.hunter.points).toBe(24 * 3 + 2 * 5);
    const t = defaults();
    grantXP(t, totalXpFor(35));
    t.hunter.attrs.INT = 30;
    expect(reclassifyAll(t)).toBe(3);
    expect(rankOf(t).key).toBe('B');
    expect(t.hunter.classId).not.toBeNull();
  });

  it('pays experience as given, with no multiplier', () => {
    const s = defaults();
    expect(grantXP(s, 37).gained).toBe(37);
    expect(s.stats.xpTotal).toBe(37);
  });

  it('the practice award lands exactly on the practice level, and nothing past it', () => {
    const s = defaults();
    grantXP(s, 40);
    grantXP(s, practiceAward(s));
    expect(s.hunter.level).toBe(PRACTICE_LEVEL);
    expect(s.hunter.xp).toBe(0);
    expect(practiceAward(s)).toBe(0);
  });

  it('refuses to spend past the cap', () => {
    const s = defaults();
    s.hunter.points = 2;
    s.hunter.attrs.STR = 100;
    expect(spendPoint(s, 'STR')).toBe(false);
    expect(s.hunter.points).toBe(2);
    expect(spendPoint(s, 'AGI')).toBe(true);
  });

  it('auto-allocate spends everything and keeps the class lead', () => {
    const s = defaults();
    s.hunter.attrs.VIT = 12;
    s.hunter.points = 30;
    autoAllocate(s);
    expect(s.hunter.points).toBe(0);
    expect(Object.values(s.hunter.attrs).reduce((a, b) => a + b)).toBe(25 + 7 + 30);
  });

  it('classifies from D-Rank on the leading attribute', () => {
    const s = defaults();
    expect(syncClass(s)).toBeNull();
    s.hunter.level = 10;
    s.hunter.attrs.AGI = 20;
    // The level alone assigns nothing: the class follows the rank the hunter holds.
    expect(syncClass(s)).toBeNull();
    s.hunter.rank = 'D';
    expect(syncClass(s)?.cls.id).toBe('skirmisher');
    s.hunter.level = 20;
    s.hunter.rank = 'C';
    expect(syncClass(s)?.cls.id).toBe('ranger');
  });

  it('rank ladder and curve are monotonic', () => {
    expect(rankFor(1).key).toBe('E');
    expect(rankFor(70).key).toBe('S');
    expect(rankFor(100).key).toBe('N');
    for (let l = 1; l < 100; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });
});
