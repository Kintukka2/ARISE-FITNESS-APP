import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { battle, Unit, type Ev } from '@/core/combat';
import { ALL_ENEMIES, dungeonById, enemyById } from '@/core/gates';
import { MISSIONS, sweep } from '@/core/missions';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import { autoAllocate, grantXP, totalXpFor } from '@/core/progression';
import type { Shadow } from '@/core/types';
import { rng } from '@/core/util';
import { walk } from './walk';

const now = Date.parse('2026-02-04T12:00:00');
const one = ALL_ENEMIES.find((e) => e.kit.length === 1)!;
const two = ALL_ENEMIES.find((e) => e.kit.length === 2)!;
const shadow = (enemyId: string, kills = 0): Shadow => ({ id: `sh-${enemyId}-${kills}`, enemyId, boundAt: '2026-02-04', out: 0, kills, bosses: 0 });

describe('ranks', () => {
  it('kills promote a Shadow, and its rank caps how far the kills grow it', () => {
    const R = shadows.SHADOW_RANKS;
    expect(shadows.rankOf(shadow(two.id, 0)).name).toBe(R[0].name);
    expect(shadows.rankOf(shadow(two.id, R[1].kills)).name).toBe(R[1].name);
    expect(shadows.rankOf(shadow(two.id, R[3].kills + 400)).name).toBe(R[3].name);
    // Between Sworn's cap and Vanguard, kills stop counting until the promotion.
    expect(shadows.growth(shadow(two.id, R[2].kills - 1))).toBe(R[1].cap);
    expect(shadows.growth(shadow(two.id, R[2].kills))).toBe(R[2].cap);
    expect(shadows.growth(shadow(two.id, 10_000))).toBe(R[3].cap);
  });

  it('a Bound Shadow fights with one ability, and a Sworn one remembers a second', () => {
    const sworn = shadows.SHADOW_RANKS[shadows.SECOND_AT].kills;
    expect(shadows.kitOf(shadow(two.id))).toEqual([two.kit[0]]);
    expect(shadows.kitOf(shadow(two.id, sworn))).toEqual(two.kit);
    // A creature with only one learns its second from its kin.
    const learned = shadows.kitOf(shadow(one.id, sworn))[1];
    expect(learned).toBeTruthy();
    expect(one.kit).not.toContain(learned);
    expect(ALL_ENEMIES.some((k) => k.family === one.family && k.kit.includes(learned))).toBe(true);
  });

  it('every creature has a second ability to remember', () => {
    for (const e of ALL_ENEMIES) expect(shadows.secondOf(e)).toBeTruthy();
  });

  it('a run reports the Shadows its kills promoted', () => {
    const s = defaults();
    grantXP(s, totalXpFor(20));
    autoAllocate(s);
    const d = dungeonById('DNG-001')!;
    const sh = shadows.bind(s, d.mobs[0]);
    sh.kills = shadows.SHADOW_RANKS[1].kills - 1;
    const run = raid.begin(s, d, now);
    walk(s, d, now);
    run.kills[sh.id] = { kills: 3, bosses: 0 };
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(res.promoted).toEqual([{ id: sh.id, rank: shadows.SHADOW_RANKS[1].name }]);
  });
});

describe('slots', () => {
  it('Secret Missions make room for more Shadows than the grade allows', () => {
    const s = defaults();
    const base = shadows.slots(s);
    const granting = MISSIONS.filter((m) => m.grant.slot);
    expect(granting.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 10; i++) shadows.bind(s, ALL_ENEMIES[i].id);
    s.shadows.army[0].kills = shadows.SHADOW_RANKS[1].kills;
    sweep(s);
    expect(shadows.missionSlots(s)).toBe(2);
    expect(shadows.slots(s)).toBe(base + 2);
  });
});

describe('orders of its own', () => {
  it('a Shadow with orders of its own follows them over the party’s', () => {
    const s = defaults();
    const sh = shadows.bind(s, two.id);
    shadows.setTactic(s, sh.id, 'finish');
    const spec = raid.shadowSpec(s.shadows.army[0], 0);
    expect(spec.tactic).toBe('finish');
    // Three foes, one of them nearly down: under its own orders the Shadow goes for that one first.
    const base = { STR: 10, VIT: 30, AGI: 10, INT: 10, PER: 10 };
    const foes = [0, 1, 2].map((j) => new Unit({ uid: `e${j}`, name: `Foe ${j}`, side: 'e', base, kit: [] }));
    foes[2].hp = 5;
    const log: Ev[] = [];
    const g = battle([new Unit(spec)], foes, rng('orders'), 1, () => {}, log, { tactic: 'default' });
    for (let step = g.next(); !step.done; step = g.next(null));
    const first = log.find((e) => (e.t === 'hit' || e.t === 'miss') && e.a === spec.uid) as { v: string } | undefined;
    expect(first?.v).toBe('e2');
    shadows.setTactic(s, sh.id, null);
    expect(s.shadows.army[0].tactic).toBeUndefined();
    expect(enemyById(two.id)).toBeTruthy();
  });
});
