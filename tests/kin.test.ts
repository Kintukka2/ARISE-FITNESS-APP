import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { Unit } from '@/core/combat';
import { ALL_ENEMIES, dungeonById, PRACTICE_GATE } from '@/core/gates';
import * as kin from '@/core/kin';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import type { Enemy, Save } from '@/core/types';

const now = Date.parse('2026-02-04T12:00:00');
const day = '2026-02-04';
const of = (family: string, role?: string) => ALL_ENEMIES.filter((e) => e.family === family && (!role || e.role === role));
/** A hunter with `n` Shadow slots: the grade's one, and Secret Quests' for the rest. */
function hunter(n: number): Save {
  const s = defaults();
  s.hunter.missions.push(...['first_sworn', 'shadow_legion', 'shadow_ascendant'].slice(0, n - 1));
  expect(shadows.slots(s)).toBe(n);
  return s;
}
const bindAll = (s: Save, es: Enemy[], rank = 1) => es.map((e) => shadows.raise(shadows.bind(s, e.id), rank));

describe('Kin and Formation, as data', () => {
  it('every family has a boon but the one kin to all, and every role an aura', () => {
    const families = new Set(ALL_ENEMIES.map((e) => e.family));
    const roles = new Set(ALL_ENEMIES.map((e) => e.role));
    expect(families.has(kin.KIN_ALL)).toBe(true);
    for (const f of families) expect(!!kin.KIN[f]).toBe(f !== kin.KIN_ALL);
    for (const f of Object.keys(kin.KIN)) expect(families.has(f)).toBe(true);
    expect(new Set(Object.keys(kin.FORMATION))).toEqual(roles);
  });

  it('a Kin opens at two of a family and doubles at three', () => {
    expect([0, 1, 2, 3, 4, 6].map(kin.tierFor)).toEqual([0, 0, 1, 2, 2, 2]);
    for (const f of Object.keys(kin.KIN)) {
      expect(kin.kinBoon(f, 0)).toEqual({});
      const one = kin.kinBoon(f, 1);
      const two = kin.kinBoon(f, 2);
      for (const k of Object.keys(one)) expect(two[k]).toBeCloseTo(one[k] * 2, 6);
    }
  });
});

describe('a squad’s make-up', () => {
  it('counts each family and every distinct role, the auras summed', () => {
    const m = kin.makeFrom([
      { family: 'Undead', role: 'Brute' }, { family: 'Undead', role: 'Caster' }, { family: 'Beast', role: 'Brute' },
    ]);
    expect(m.kin).toEqual([{ family: 'Undead', n: 2, tier: 1 }, { family: 'Beast', n: 1, tier: 0 }]);
    expect(m.roles).toEqual(['Brute', 'Caster']);
    expect(m.aura).toEqual({ ...kin.FORMATION.Brute, ...kin.FORMATION.Caster });
    expect(kin.kinBonusFor('Undead', m)).toEqual(kin.kinBoon('Undead', 1));
    expect(kin.kinBonusFor('Beast', m)).toEqual({});
  });

  it('the family kin to all counts in every family beside it, and takes every boon it completes', () => {
    const m = kin.makeFrom([
      { family: kin.KIN_ALL, role: 'Caster' }, { family: 'Undead', role: 'Brute' }, { family: 'Beast', role: 'Brute' }, { family: 'Beast', role: 'Flier' },
    ]);
    expect(m.wild).toBe(1);
    expect(m.kin).toEqual([{ family: 'Beast', n: 3, tier: 2 }, { family: 'Undead', n: 2, tier: 1 }]);
    expect(kin.kinBonusFor('Undead', m)).toEqual(kin.kinBoon('Undead', 1));
    expect(kin.kinBonusFor('Beast', m)).toEqual(kin.kinBoon('Beast', 2));
    const all = kin.kinBonusFor(kin.KIN_ALL, m);
    for (const [k, v] of Object.entries(kin.kinBoon('Beast', 2))) expect(all[k]).toBeCloseTo(v + (kin.kinBoon('Undead', 1)[k] ?? 0), 6);
    // Alone, it completes nothing.
    expect(kin.kinBonusFor(kin.KIN_ALL, kin.makeFrom([{ family: kin.KIN_ALL, role: 'Caster' }]))).toEqual({});
  });
});

describe('in a fight', () => {
  const d = dungeonById('DNG-016')!;

  it('each Shadow takes its Kin’s boon, the hunter and every Shadow the auras, the Association’s hunters neither', () => {
    const s = hunter(3);
    const orcs = of('Orc').slice(0, 2);
    const other = ALL_ENEMIES.find((e) => e.family !== kin.KIN_ALL && e.family !== 'Orc')!;
    bindAll(s, [...orcs, other]);
    const specs = raid.partySpecs(s, d, day, undefined, now);
    const m = kin.makeOf(shadows.squad(s));
    expect(m.kin.find((k) => k.family === 'Orc')?.tier).toBe(1);
    const hero = specs.find((u) => u.tag === 'hero')!;
    const bare = raid.heroSpec(s, now);
    for (const [k, v] of Object.entries(m.aura)) expect((hero.bonus![k] ?? 0) - (bare.bonus![k] ?? 0)).toBeCloseTo(v, 6);
    for (const a of specs.filter((u) => u.tag === 'ally')) expect(a.bonus ?? {}).toEqual({});
    for (const sp of specs.filter((u) => u.tag === 'shadow')) {
      const sh = s.shadows.army.find((x) => x.id === sp.ref)!;
      const want = kin.kinBonusOf(sh, m);
      for (const [k, v] of Object.entries(m.aura)) expect(sp.bonus![k] ?? 0).toBeCloseTo(v + (want[k] ?? 0), 6);
      for (const [k, v] of Object.entries(want)) expect(sp.bonus![k] ?? 0).toBeCloseTo(v + (m.aura[k] ?? 0), 6);
    }
    // The Orcs' attack is up by their Kin's share, and the auras', over a squad where they stand alone.
    const lone = hunter(1);
    bindAll(lone, [orcs[0]]);
    const alone = new Unit(raid.partySpecs(lone, d, day, undefined, now).find((u) => u.tag === 'shadow')!);
    const kept = new Unit(specs.find((u) => u.ref === s.shadows.army[0].id)!);
    expect(kept.d.patk / alone.d.patk).toBeCloseTo((1 + kin.KIN.Orc.patk + (m.aura.patk ?? 0)) / (1 + (kin.makeOf([s.shadows.army[0]]).aura.patk ?? 0)), 6);
  });

  it('the Practice Gate takes no Shadows, and so neither', () => {
    const s = hunter(2);
    bindAll(s, of('Orc').slice(0, 2));
    const specs = raid.partySpecs(s, PRACTICE_GATE, day, undefined, now);
    expect(specs.some((u) => u.tag === 'shadow')).toBe(false);
    expect(specs[0]).toEqual(raid.heroSpec(s, now));
  });

  it('an open run keeps the Kin and the auras it walked in with', () => {
    const s = hunter(2);
    bindAll(s, of('Orc').slice(0, 2));
    s.gates.cleared.push(PRACTICE_GATE.id);
    const run = raid.begin(s, d, now);
    const was = JSON.stringify(run.party);
    s.shadows.squad = [];
    expect(JSON.stringify(s.gates.raid!.party)).toBe(was);
    expect(run.party!.filter((u) => u.tag === 'shadow').every((u) => (u.bonus!.patk ?? 0) >= kin.KIN.Orc.patk)).toBe(true);
  });
});

describe('Auto Deploy weighs whole squads', () => {
  it('with no Kin or role to weigh, it deploys the strongest', () => {
    const s = hunter(2);
    // One family and one role: every squad has the same make-up, so power alone decides.
    const pool = ALL_ENEMIES.filter((e) => e.family === 'Undead' && e.role === 'Brute');
    expect(pool.length).toBeGreaterThanOrEqual(3);
    bindAll(s, pool);
    const best = s.shadows.army.slice().sort((a, b) => shadows.power(b) - shadows.power(a)).slice(0, 2);
    expect(shadows.bestSquad(s)).toEqual(best.map((x) => x.id));
  });

  it('a pair of one family beats a stronger Shadow standing alone when the Kin is worth more', () => {
    const s = hunter(2);
    const [a, b] = of('Orc');
    bindAll(s, [a, b]);
    // A stronger loner, of a family no other deployed Shadow shares, and of a role the pair already has.
    const loner = ALL_ENEMIES
      .filter((e) => e.family !== 'Orc' && e.family !== kin.KIN_ALL && [a.role, b.role].includes(e.role))
      .map((e) => ({ e, p: shadows.power(shadows.raise({ id: 'x', enemyId: e.id, boundAt: day, out: 0, kills: 0, bosses: 0, rank: 1, xp: 0 }, 1)) }))
      .filter(({ p }) => p > Math.min(...s.shadows.army.map(shadows.power)))
      .sort((x, y) => x.p - y.p)[0].e;
    shadows.raise(shadows.bind(s, loner.id), 1);
    const ids = shadows.bestSquad(s);
    const pick = ids.map((id) => s.shadows.army.find((x) => x.id === id)!);
    const powerOnly = s.shadows.army.slice().sort((x, y) => shadows.power(y) - shadows.power(x)).slice(0, 2);
    // Whichever it deploys weighs at least as much as the strongest pair.
    expect(shadows.squadScore(s, pick)).toBeGreaterThanOrEqual(shadows.squadScore(s, powerOnly) - 1e-9);
    // And it weighs the most of every pair the army can make.
    const army = s.shadows.army;
    for (let i = 0; i < army.length; i++) for (let j = i + 1; j < army.length; j++) {
      expect(shadows.squadScore(s, pick)).toBeGreaterThanOrEqual(shadows.squadScore(s, [army[i], army[j]]) - 1e-9);
    }
  });

  it('finds the squad that weighs most, over every squad the army can make', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = hunter(3);
      // A mixed army of 9, drawn the same way each time for a seed.
      const picks = ALL_ENEMIES.filter((_, i) => (i * 7 + seed * 13) % 11 === 0).slice(0, 9);
      bindAll(s, picks, seed % 3);
      const army = s.shadows.army;
      let most = -Infinity;
      for (let i = 0; i < army.length; i++) for (let j = i + 1; j < army.length; j++) for (let k = j + 1; k < army.length; k++) {
        most = Math.max(most, shadows.squadScore(s, [army[i], army[j], army[k]]));
      }
      const got = shadows.bestSquad(s).map((id) => army.find((x) => x.id === id)!);
      expect(got).toHaveLength(3);
      expect(shadows.squadScore(s, got)).toBeCloseTo(most, 6);
      // The same army, the same squad.
      expect(shadows.bestSquad(s)).toEqual(shadows.bestSquad(s));
    }
  });

  it('an army no bigger than the squad is deployed whole', () => {
    const s = hunter(3);
    bindAll(s, ALL_ENEMIES.slice(0, 2));
    expect(new Set(shadows.bestSquad(s))).toEqual(new Set(s.shadows.army.map((x) => x.id)));
  });
});
