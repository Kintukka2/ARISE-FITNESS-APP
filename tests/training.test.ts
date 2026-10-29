import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { forge, adapt, weekMultiplier, slotCount } from '@/core/coach';
import { exById, available } from '@/core/exercises';
import { techTier } from '@/core/progression';
import * as sessions from '@/core/sessions';
import type { Experience, Goal } from '@/core/types';

describe('coach', () => {
  it('never prescribes what hurts or what the hunter cannot do', () => {
    const goals: Goal[] = ['strength', 'muscle', 'lean', 'endurance', 'athletic'];
    const exps: Experience[] = ['novice', 'trained', 'seasoned', 'elite'];
    const kits = [[], ['dumbbell'], ['barbell', 'bench'], ['band', 'pullupbar'], ['machine', 'kettlebell', 'jumprope']];
    const lims = [[], ['knee'], ['wrist', 'shoulder'], ['back', 'elbow']];
    for (const goal of goals) for (const experience of exps) for (const equipment of kits) for (const limitations of lims) for (const days of [2, 3, 4, 5, 6]) {
      const s = defaults();
      Object.assign(s.profile, { goal, experience, equipment, limitations, days });
      const p = forge(s);
      expect(p.days).toHaveLength(days);
      const ok = new Set(available(equipment, limitations).map((x) => x.id));
      for (const d of p.days) {
        expect(d.slots.length).toBeGreaterThan(0);
        const ids = d.slots.map((x) => x.exId);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(ok.has(id)).toBe(true);
        for (const id of ids) expect(exById(id)!.tier).toBeLessThanOrEqual(techTier(s));
      }
    }
  });

  it('time bands produce different session sizes', () => {
    expect(new Set([25, 45, 75].map(slotCount)).size).toBe(3);
  });

  it('deloads every fifth week', () => {
    expect(weekMultiplier(5)).toBe(0.65);
    expect(weekMultiplier(4)).toBeCloseTo(1.18);
  });

  it('adapts volume from rating and completion', () => {
    const s = defaults();
    forge(s);
    expect(adapt(s, 1.2, 'easy').bucket).toBe('crushed');
    expect(s.program!.adapt).toBeCloseTo(1.09);
    expect(adapt(s, 0.6, 'brutal').bucket).toBe('brutal');
  });
});

describe('sessions', () => {
  it('settles everything at finish and nothing before', () => {
    const s = defaults();
    forge(s);
    const sess = sessions.startProgram(s, s.program!.days[0].id)!;
    sessions.toggleSet(sess, 0, 0);
    sessions.toggleSet(sess, 0, 0); // untick
    sessions.toggleSet(sess, 0, 1);
    expect(s.boon.sets).toBe(0);
    expect(s.stats.totalReps).toBe(0);
    const rep = sessions.finish(s, sess, 'right');
    expect(rep.setsDone).toBe(1);
    expect(s.boon.sets).toBe(1);
    expect(rep.xp.gained).toBeGreaterThan(40);
    expect(s.program!.completed).toContain(s.program!.days[0].id);
    expect(s.session).toBeNull();
  });

  it('Basic Training certifies, issues the kit and lands on Level 5', () => {
    const s = defaults();
    const sess = sessions.startBasic(s);
    sess.items.forEach((it, i) => it.log.forEach((_, j) => sessions.toggleSet(sess, i, j)));
    const rep = sessions.finish(s, sess, null);
    expect(rep.certified).toBe(true);
    expect(s.hunter.level).toBe(5);
    expect(s.items).toHaveLength(5);
    expect(Object.keys(s.equipped)).toHaveLength(5);
  });

  it('Basic Training never prescribes what hurts', () => {
    const s = defaults();
    s.profile.limitations = ['wrist', 'knee', 'back', 'shoulder'];
    for (const sl of sessions.basicSlots(s)) expect(exById(sl.exId)!.flags.some((f) => s.profile.limitations.includes(f))).toBe(false);
  });

  it('repeats the same day pay less', () => {
    const s = defaults();
    expect(sessions.repeatFactor(s, '2026-01-01')).toBe(1);
    s.log.unshift({ day: '2026-01-01', kind: 'session', name: 'x', xp: 1 });
    expect(sessions.repeatFactor(s, '2026-01-01')).toBe(0.6);
  });
});
