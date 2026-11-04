import { describe, expect, it } from 'vitest';
import { defaults, parse } from '@/core/save';
import { battle, Unit, type Ev } from '@/core/combat';
import { ALL_ENEMIES, dungeonById, enemyById } from '@/core/gates';
import { MISSIONS, sweep } from '@/core/missions';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import { autoAllocate, grantXP, totalXpFor, reclassifyAll } from '@/core/progression';
import type { Shadow } from '@/core/types';
import { rng } from '@/core/util';
import * as vitals from '@/core/vitals';
import { walk } from './walk';

const now = Date.parse('2026-02-04T12:00:00');
const one = ALL_ENEMIES.find((e) => e.kit.length === 1)!;
const two = ALL_ENEMIES.find((e) => e.kit.length === 2)!;
/** A Shadow with some kills, holding the rank they earned unless told otherwise. */
const shadow = (enemyId: string, kills = 0, rank = shadows.qualifiedIndex({ kills })): Shadow => ({ id: `sh-${enemyId}-${kills}`, enemyId, boundAt: '2026-02-04', out: 0, kills, bosses: 0, rank });

describe('ranks', () => {
  it('kills qualify a Shadow for a rank, and the rank it holds caps how far the kills grow it', () => {
    const R = shadows.SHADOW_RANKS;
    expect(shadows.qualifiedIndex(shadow(two.id, 0))).toBe(0);
    expect(shadows.qualifiedIndex(shadow(two.id, R[1].kills))).toBe(1);
    expect(shadows.qualifiedIndex(shadow(two.id, R[3].kills + 400))).toBe(3);
    expect(shadows.rankOf(shadow(two.id, R[3].kills + 400)).name).toBe(R[3].name);
    // Between Sworn's cap and Vanguard, kills stop counting until the promotion.
    expect(shadows.growth(shadow(two.id, R[2].kills - 1))).toBe(R[1].cap);
    expect(shadows.growth(shadow(two.id, R[2].kills))).toBe(R[2].cap);
    expect(shadows.growth(shadow(two.id, 10_000))).toBe(R[3].cap);
    // Qualified and not yet promoted, it holds its rank, and its cap.
    const waiting = shadow(two.id, R[2].kills, 1);
    expect(shadows.rankOf(waiting).name).toBe(R[1].name);
    expect(shadows.growth(waiting)).toBe(R[1].cap);
    expect(shadows.canPromote(waiting)).toBe(true);
  });

  it('a promotion is claimed one rank at a time, and only once the kills have earned it', () => {
    const R = shadows.SHADOW_RANKS;
    const s = defaults();
    const sh = shadows.bind(s, one.id);
    expect(sh.rank).toBe(0);
    expect(shadows.promote(s, sh.id)).toBeNull();
    sh.kills = R[2].kills;
    expect(shadows.promotable(s)).toEqual([sh]);
    const first = shadows.promote(s, sh.id)!;
    // Sworn remembers a second ability, and the promotion says so.
    expect(first).toEqual({ id: sh.id, from: 0, to: 1, second: shadows.secondOf(one) });
    expect(shadows.kitOf(sh)).toHaveLength(2);
    expect(shadows.promote(s, sh.id)).toEqual({ id: sh.id, from: 1, to: 2, second: null });
    expect(shadows.promote(s, sh.id)).toBeNull();
    expect(shadows.promotable(s)).toEqual([]);
    sh.kills = R[3].kills;
    shadows.promoteAll(s);
    expect(sh.rank).toBe(3);
    expect(shadows.promote(s, sh.id)).toBeNull();
  });

  it('a save from before keeps every rank its Shadows’ kills had given them', () => {
    const old = JSON.parse(JSON.stringify(defaults()));
    old.v = 4;
    old.shadows.army = [0, 30, 80, 400].map((kills, i) => ({ id: `sh${i}`, enemyId: two.id, boundAt: '2026-02-04', out: 1, kills, bosses: 0 }));
    const s = parse(JSON.stringify(old))!;
    expect(s.shadows.army.map((x) => x.rank)).toEqual([0, 1, 2, 3]);
    expect(shadows.promotable(s)).toEqual([]);
  });

  it('a Bound Shadow fights with one ability, and a Sworn one remembers a second', () => {
    const sworn = shadows.SHADOW_RANKS[shadows.SECOND_AT].kills;
    expect(shadows.kitOf(shadow(two.id))).toEqual([two.kit[0]]);
    expect(shadows.kitOf(shadow(two.id, sworn))).toEqual(two.kit);
    // Until it is promoted, it fights as the rank it holds.
    expect(shadows.kitOf(shadow(two.id, sworn, 0))).toEqual([two.kit[0]]);
    // A creature with only one learns its second from its kin.
    const learned = shadows.kitOf(shadow(one.id, sworn))[1];
    expect(learned).toBeTruthy();
    expect(one.kit).not.toContain(learned);
    expect(ALL_ENEMIES.some((k) => k.family === one.family && k.kit.includes(learned))).toBe(true);
  });

  it('every creature has a second ability to remember', () => {
    for (const e of ALL_ENEMIES) expect(shadows.secondOf(e)).toBeTruthy();
  });

  it('a run reports the Shadows its kills qualified, and promotes none of them', () => {
    const s = defaults();
    grantXP(s, totalXpFor(20));
    reclassifyAll(s);
    autoAllocate(s);
    const d = dungeonById('DNG-001')!;
    const sh = shadows.bind(s, d.mobs[0]);
    sh.kills = shadows.SHADOW_RANKS[1].kills - 1;
    const run = raid.begin(s, d, now);
    walk(s, d, now);
    run.kills[sh.id] = { kills: 3, bosses: 0 };
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(res.ready).toEqual([{ id: sh.id, rank: shadows.SHADOW_RANKS[1].name }]);
    expect(sh.rank).toBe(0);
    // Qualified already, the next run reports it no more.
    const again = raid.begin(s, d, now);
    walk(s, d, now);
    again.kills[sh.id] = { kills: 2, bosses: 0 };
    expect(raid.finish(s, d, again, 'cleared', now).ready).toEqual([]);
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
    // Its kills have earned Sworn, but the quest is for a Sworn Shadow: it pays once it is promoted.
    sweep(s);
    expect(shadows.missionSlots(s)).toBe(1);
    shadows.promote(s, s.shadows.army[0].id);
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

describe('extraction', () => {
  /** A hunter with mana enough for every reach, and a creature lingering at a first reach of 50 MP. */
  function reaching() {
    const s = defaults();
    grantXP(s, totalXpFor(60));
    s.hunter.attrs.INT = 90;
    const l: raid.Lingering = { enemyId: one.id, boss: false, cost: 50, tries: 0 };
    return { s, l, mp: () => vitals.read(s, now).mp };
  }

  it('a reach that fails leaves the Shadow lingering, each reach at twice the last, three in all', () => {
    const { s, l, mp } = reaching();
    const start = mp();
    expect(raid.reachesLeft(l)).toBe(shadows.EXTRACT_TRIES.max);
    expect(raid.reachCost(l)).toBe(50);
    expect(raid.extract(s, l, 0.99, now)).toBe('failed');
    expect(raid.reachCost(l)).toBe(100);
    expect(raid.extract(s, l, 0.99, now)).toBe('failed');
    expect(raid.reachCost(l)).toBe(200);
    expect(raid.extract(s, l, 0.99, now)).toBe('lost');
    expect(start - mp()).toBe(50 + 100 + 200);
    // Dispersed: nothing more to reach for, and nothing spent trying.
    expect(raid.reachesLeft(l)).toBe(0);
    expect(raid.extract(s, l, 0, now)).toBe('lost');
    expect(start - mp()).toBe(350);
    expect(s.shadows.army).toHaveLength(0);
    expect(s.stats.extractions).toBe(3);
  });

  it('a reach that holds binds it, at the cost it showed, and ends the reaching', () => {
    const { s, l, mp } = reaching();
    raid.extract(s, l, 0.99, now);
    const before = mp();
    expect(raid.extract(s, l, 0, now)).toBe('bound');
    expect(before - mp()).toBe(100);
    expect(s.shadows.army.map((x) => x.enemyId)).toEqual([one.id]);
    expect(raid.reachesLeft(l)).toBe(0);
    expect(raid.extract(s, l, 0, now)).toBe('lost');
    expect(s.shadows.army).toHaveLength(1);
  });

  it('a reach short of mana spends nothing and keeps its place', () => {
    const { s, l, mp } = reaching();
    raid.extract(s, l, 0.99, now);
    raid.extract(s, l, 0.99, now);
    s.vitals.mp = 150;
    s.vitals.at = now;
    expect(raid.extract(s, l, 0, now)).toBe('no-mana');
    expect(mp()).toBe(150);
    expect(raid.reachesLeft(l)).toBe(1);
  });
});
