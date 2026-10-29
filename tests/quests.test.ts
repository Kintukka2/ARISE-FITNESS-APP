import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { buildQuest, clearDaily, clearPenalty, logItem, rollDay, isComplete } from '@/core/quests';
import * as boon from '@/core/boon';

describe('daily quest', () => {
  it('is push-ups, sit-ups and squats, ten each on day one', () => {
    const q = buildQuest(defaults());
    expect(q.items.map((i) => i.exId)).toEqual(['pushup', 'situp', 'bw_squat']);
    expect(q.items.every((i) => i.target === 10)).toBe(true);
  });

  it('routes around a limitation without losing a slot', () => {
    const s = defaults();
    s.profile.limitations = ['wrist', 'knee'];
    const q = buildQuest(s);
    expect(q.items).toHaveLength(3);
    expect(q.items[0].exId).not.toBe('pushup');
    expect(q.items[2].exId).not.toBe('bw_squat');
  });

  it('grows with the streak and caps at a hundred', () => {
    const s = defaults();
    s.streak.current = 40;
    expect(buildQuest(s).items[0].target).toBe(50);
    s.streak.current = 400;
    expect(buildQuest(s).items[0].target).toBe(100);
  });

  it('a missed day resets the streak, issues a penalty and applies Hollow', () => {
    const s = defaults();
    rollDay(s, '2026-01-01');
    s.streak.current = 9;
    const ev = rollDay(s, '2026-01-02');
    expect(ev.some((e) => e.type === 'penalty')).toBe(true);
    expect(s.streak.current).toBe(0);
    expect(s.flags.hollow).toBe(true);
    expect(s.daily.penalty?.items[0].target).toBe(15);
    expect(s.daily.penalty?.xp).toBe(0);
    clearPenalty(s);
    expect(s.flags.hollow).toBe(false);
  });

  it('clearing builds the streak day over day and pays shards and Boon sets', () => {
    const s = defaults();
    rollDay(s, '2026-01-01');
    s.daily.quest!.items.forEach((_, i) => logItem(s, s.daily.quest!, i, 10));
    expect(isComplete(s.daily.quest)).toBe(true);
    const r = clearDaily(s, new Date(2026, 0, 1, 12))!;
    expect(r.streak).toBe(1);
    expect(r.shards).toBe(15);
    expect(s.boon.sets).toBe(3);
    rollDay(s, '2026-01-02');
    clearDaily(s, new Date(2026, 0, 2, 12));
    expect(s.streak.current).toBe(2);
    expect(s.stats.totalReps).toBe(30);
  });

  it('the clock going backwards forgives rather than punishes', () => {
    const s = defaults();
    rollDay(s, '2026-01-05');
    expect(rollDay(s, '2026-01-03')).toEqual([]);
    expect(s.flags.hollow).toBe(false);
  });
});

describe('boon', () => {
  it('pays the top tier only across enough sets and days', () => {
    const s = defaults();
    s.boon = boon.blank('2026-01-01');
    for (const d of ['2026-01-01', '2026-01-02', '2026-01-03']) boon.log(s, 'pushup', 12, d);
    const res = boon.assess(s);
    expect(res.tier.name).toBe('Exalted');
    expect(res.grant.STR).toBe(3);
    expect(res.free).toBe(1);
    boon.settle(s, '2026-01-04');
    expect(s.hunter.attrs.STR).toBe(8);
    expect(s.hunter.points).toBe(1);
  });

  it('one huge day cannot buy more than one tier step', () => {
    const s = defaults();
    boon.log(s, 'pushup', 40, '2026-01-01');
    expect(boon.tierFor(s.boon).name).toBe('Acknowledged');
  });
});
