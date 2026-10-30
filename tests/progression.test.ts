import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { grantXP, totalXpFor, practiceAward, PRACTICE_LEVEL, rankFor, spendPoint, autoAllocate, syncClass, xpToNext } from '@/core/progression';

describe('progression', () => {
  it('levels up and pays three points per level plus rank bonuses', () => {
    const s = defaults();
    const r = grantXP(s, totalXpFor(10));
    expect(s.hunter.level).toBe(10);
    expect(r.rankUp?.key).toBe('D');
    expect(s.hunter.points).toBe(9 * 3 + 5);
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
    expect(syncClass(s)?.cls.id).toBe('skirmisher');
    s.hunter.level = 20;
    expect(syncClass(s)?.cls.id).toBe('ranger');
  });

  it('rank ladder and curve are monotonic', () => {
    expect(rankFor(1).key).toBe('E');
    expect(rankFor(70).key).toBe('S');
    expect(rankFor(100).key).toBe('N');
    for (let l = 1; l < 100; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });
});
