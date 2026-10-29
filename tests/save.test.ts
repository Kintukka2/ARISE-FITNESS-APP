import { describe, expect, it } from 'vitest';
import { defaults, parse, fromLegacy } from '@/core/save';

describe('save', () => {
  it('round-trips and fills in missing fields', () => {
    const s = defaults();
    s.hunter.name = 'TEST';
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.stats.comebacks;
    delete raw.settings;
    const back = parse(JSON.stringify(raw))!;
    expect(back.hunter.name).toBe('TEST');
    expect(back.stats.comebacks).toBe(0);
    expect(back.settings.sound).toBe(true);
  });

  it('keeps records keyed by id across a reload', () => {
    const s = defaults();
    s.equipped.head = 'it1';
    s.lifts.pushup = { best: 20, heaviest: 0, lastWeight: null, sets: 3, volume: 0, history: [] };
    s.gates.runs['DNG-001'] = { fought: 2, cleared: 1 };
    const back = parse(JSON.stringify(s))!;
    expect(back.equipped.head).toBe('it1');
    expect(back.lifts.pushup.best).toBe(20);
    expect(back.gates.runs['DNG-001'].cleared).toBe(1);
  });

  it('a field of the wrong type falls back to its default', () => {
    const raw = JSON.parse(JSON.stringify(defaults()));
    raw.items = 'garbage';
    raw.hunter.level = 'nine';
    const back = parse(JSON.stringify(raw))!;
    expect(back.items).toEqual([]);
    expect(back.hunter.level).toBe(1);
  });

  it('rejects things that are not saves', () => {
    expect(parse('nope')).toBeNull();
    expect(parse('{"a":1}')).toBeNull();
  });

  it('carries an original ARISE 5.x save forward', () => {
    const old = {
      v: 9, onboarded: true,
      hunter: { name: 'KINTUKKA', level: 24, xp: 10, attrs: { STR: 40, AGI: 26, PER: 17, VIT: 29, INT: 22 }, points: 8, classId: 'berserker', achievements: ['first_light'] },
      profile: { goal: 'strength', experience: 'trained', days: 4, minutes: 40, equipment: ['none', 'dumbbell'], limitations: [], bodyFocus: 'upper', age: 30, weight: 80 },
      streak: { current: 41, best: 41, lastDay: '2026-01-01' },
      training: { basic: [1], excluded: ['pushup'] },
      wallet: { shards: 1200, earned: 3000, spent: 1800 },
      inventory: [{ id: 'it1', defId: 'EQP-CHAMPION_HELM' }, { id: 'it2', defId: 'EQP-GONE' }],
      equipped: { head: 'it1' },
      association: { ap: 4000, clears: 6, fails: 1, cleared: ['DNG-001'], army: ['ENM-001', 'ENM-002'], squad: ['ENM-001'] },
      tribute: { start: '2026-01-01' },
      stats: { questsCleared: 50, sessions: 20, tributes: 4 },
    };
    const s = parse(JSON.stringify(old))!;
    expect(s.hunter.level).toBe(24);
    expect(s.hunter.attrs.STR).toBe(40);
    expect(s.profile.equipment).toEqual(['dumbbell']);
    expect(s.profile.minutes).toBe(45);
    expect(s.training.certified).toBe(true);
    expect(s.items).toHaveLength(1);
    expect(s.equipped.head).toBe('it1');
    expect(s.shadows.army).toHaveLength(2);
    expect(s.shadows.squad).toHaveLength(1);
    expect(s.stats.boons).toBe(4);
    expect(s.wallet.shards).toBe(1200);
    expect(fromLegacy(old as never).gates.clears).toBe(6);
  });
});
