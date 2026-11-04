import { describe, expect, it } from 'vitest';
import { defaults, parse } from '@/core/save';
import { Unit } from '@/core/combat';
import { ALL_ENEMIES, dungeonById, enemyById } from '@/core/gates';
import { MISSIONS, sweep } from '@/core/missions';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import { autoAllocate, grantXP, totalXpFor, reclassifyAll } from '@/core/progression';
import type { Shadow } from '@/core/types';
import * as vitals from '@/core/vitals';
import { walk } from './walk';

const now = Date.parse('2026-02-04T12:00:00');
const one = ALL_ENEMIES.find((e) => e.kit.length === 1)!;
const two = ALL_ENEMIES.find((e) => e.kit.length === 2)!;
/** A Shadow at a level, holding a rank. */
const shadow = (enemyId: string, level = 1, rank = 0): Shadow => ({ id: `sh-${enemyId}-${level}-${rank}`, enemyId, boundAt: '2026-02-04', out: 0, kills: 0, bosses: 0, rank, xp: shadows.xpAt(level) });

describe('levels', () => {
  it('experience climbs level by level, each a little longer than the last', () => {
    expect(shadows.xpAt(1)).toBe(0);
    for (let l = 1; l < shadows.MAX_LEVEL; l++) {
      expect(shadows.xpAt(l + 1) - shadows.xpAt(l)).toBe(shadows.xpToNext(l));
      expect(shadows.xpToNext(l + 1)).toBeGreaterThanOrEqual(shadows.xpToNext(l));
      expect(shadows.levelFor(shadows.xpAt(l + 1) - 1)).toBe(l);
      expect(shadows.levelFor(shadows.xpAt(l + 1))).toBe(l + 1);
    }
    expect(shadows.levelFor(1e9)).toBe(shadows.MAX_LEVEL);
  });

  it('the rank held caps the level, and a Shadow at its cap takes no more XP', () => {
    const R = shadows.SHADOW_RANKS;
    const sh = shadow(two.id, 1);
    expect(shadows.earn(sh, shadows.xpAt(R[0].cap) + 25)).toBe(shadows.xpAt(R[0].cap));
    expect(shadows.levelOf(sh)).toBe(R[0].cap);
    expect(shadows.atCap(sh)).toBe(true);
    expect(shadows.progress(sh)).toEqual({ into: 0, need: 0 });
    expect(shadows.earn(sh, 40)).toBe(0);
    expect(sh.xp).toBe(shadows.xpAt(R[0].cap));
    expect(shadows.growth(sh)).toBeCloseTo(R[0].cap * shadows.GROWTH_PER_LEVEL);
    // The ranks' caps keep the growth the old kill limits allowed: +25%, +50%, +75%, +100%.
    expect(R.map((r) => r.cap * shadows.GROWTH_PER_LEVEL)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('a promotion lifts the cap and leaves the level where it was', () => {
    const R = shadows.SHADOW_RANKS;
    const s = defaults();
    const sh = shadows.bind(s, two.id);
    // Even XP past the cap, from a save that once kept it, does not carry into the new rank.
    sh.xp = shadows.xpAt(R[0].cap) + 60;
    s.shadows.essence = R[1].essence;
    expect(shadows.promote(s, sh.id)?.to).toBe(1);
    expect(shadows.levelOf(sh)).toBe(R[0].cap);
    expect(shadows.progress(sh)).toEqual({ into: 0, need: shadows.xpToNext(R[0].cap) });
  });

  it('stats grow with the level', () => {
    const low = shadows.statsOf(shadow(two.id, 1));
    const high = shadows.statsOf(shadows.raise(shadow(two.id, 1), 3));
    for (const k of ['STR', 'VIT', 'AGI', 'INT', 'PER'] as const) {
      expect(high[k]).toBe(Math.round(two.base[k] * 2));
      expect(high[k]).toBeGreaterThanOrEqual(low[k]);
    }
  });
});

describe('promotion', () => {
  it('asks for the level at the cap, the Essence it costs and the bosses it wants, and spends the Essence', () => {
    const R = shadows.SHADOW_RANKS;
    const s = defaults();
    const sh = shadows.bind(s, one.id);
    expect(shadows.requirements(s, sh).map((r) => r.key)).toEqual(['level', 'essence']);
    expect(shadows.promote(s, sh.id)).toBeNull();
    sh.xp = shadows.xpAt(R[0].cap);
    expect(shadows.canPromote(s, sh)).toBe(false);
    s.shadows.essence = R[1].essence + 3;
    expect(shadows.promotable(s)).toEqual([sh]);
    const first = shadows.promote(s, sh.id)!;
    // Sworn remembers a second ability, and the promotion says so.
    expect(first).toEqual({ id: sh.id, from: 0, to: 1, second: shadows.secondOf(one), essence: R[1].essence });
    expect(s.shadows.essence).toBe(3);
    expect(shadows.kitOf(sh)).toHaveLength(2);
    // Vanguard wants bosses felled as well.
    sh.xp = shadows.xpAt(R[1].cap);
    s.shadows.essence = R[2].essence;
    expect(shadows.requirements(s, sh).find((r) => r.key === 'bosses')?.met).toBe(false);
    expect(shadows.promote(s, sh.id)).toBeNull();
    sh.bosses = R[2].bosses;
    expect(shadows.promote(s, sh.id)?.to).toBe(2);
    expect(s.shadows.essence).toBe(0);
    // At the top, nothing more is asked.
    shadows.raise(sh, 3);
    expect(shadows.requirements(s, sh)).toEqual([]);
    expect(shadows.canPromote(s, sh)).toBe(false);
  });

  it('a hunter who keeps up spends the Essence on the deployed Shadows first', () => {
    const R = shadows.SHADOW_RANKS;
    const s = defaults();
    for (let i = 0; i < 3; i++) shadows.bind(s, ALL_ENEMIES[i].id).xp = shadows.xpAt(R[0].cap);
    s.shadows.squad = [s.shadows.army[2].id];
    s.shadows.essence = R[1].essence;
    shadows.promoteAll(s);
    expect(s.shadows.army.map((x) => x.rank)).toEqual([0, 0, 1]);
  });

  it('a Bound Shadow fights with one ability, and a Sworn one remembers a second', () => {
    expect(shadows.kitOf(shadow(two.id))).toEqual([two.kit[0]]);
    expect(shadows.kitOf(shadow(two.id, 12, shadows.SECOND_AT))).toEqual(two.kit);
    // At its cap and not yet promoted, it fights as the rank it holds.
    expect(shadows.kitOf(shadow(two.id, 30, 0))).toEqual([two.kit[0]]);
    // A creature with only one learns its second from its kin.
    const learned = shadows.kitOf(shadow(one.id, 12, shadows.SECOND_AT))[1];
    expect(learned).toBeTruthy();
    expect(one.kit).not.toContain(learned);
    expect(ALL_ENEMIES.some((k) => k.family === one.family && k.kit.includes(learned))).toBe(true);
  });

  it('every creature has a second ability to remember', () => {
    for (const e of ALL_ENEMIES) expect(shadows.secondOf(e)).toBeTruthy();
  });

  it('a save from before levels its Shadows from their kills, takes the rank they earned, and drops their own orders', () => {
    const old = JSON.parse(JSON.stringify(defaults()));
    old.v = 6;
    delete old.shadows.essence;
    old.shadows.army = [[0, 0], [30, 1], [80, 1], [400, 3]].map(([kills, rank], i) => ({ id: `sh${i}`, enemyId: two.id, boundAt: '2026-02-04', out: 1, kills, bosses: 0, rank, tactic: 'finish' }));
    const s = parse(JSON.stringify(old))!;
    expect(s.v).toBe(7);
    expect(s.shadows.essence).toBe(0);
    expect(s.shadows.army.map((x) => x.rank)).toEqual([0, 1, 2, 3]);
    expect(s.shadows.army.map((x) => shadows.levelOf(x))).toEqual([1, 12, 30, 40]);
    expect(s.shadows.army.every((x) => !('tactic' in x))).toBe(true);
    // Its power is what its kills had grown it to.
    expect(shadows.growth(s.shadows.army[2])).toBeCloseTo(0.75);
  });
});

describe('the kills a Shadow takes part in', () => {
  it('every Shadow that landed a hit on a creature helped fell it, whoever landed the last', () => {
    const d = dungeonById('DNG-001')!;
    const s = defaults();
    const a = shadows.raise(shadows.bind(s, two.id), 3);
    const b = shadows.raise(shadows.bind(s, one.id), 3);
    const party = [new Unit(raid.shadowSpec(a, 0)), new Unit(raid.shadowSpec(b, 1))];
    const c = { label: 'Test', foes: [d.mobs[0], d.mobs[0], d.mobs[0]], boss: false, elite: false };
    const res = raid.openChamber(d, 'helped', 0, party, c).result();
    // What the log shows: for each foe that went down, every Shadow that hit it before.
    const hit = new Map<string, Set<string>>();
    const want: Record<string, number> = {};
    for (const ev of res.log) {
      if (ev.t === 'hit' && ev.a.startsWith('s')) (hit.get(ev.v) ?? hit.set(ev.v, new Set()).get(ev.v)!).add(ev.a);
      if (ev.t === 'down' && ev.v.startsWith('e')) for (const u of hit.get(ev.v) ?? []) want[u] = (want[u] ?? 0) + 1;
    }
    const ids: Record<string, string> = { s0: a.id, s1: b.id };
    const got = Object.fromEntries(Object.entries(want).map(([u, n]) => [ids[u], n]));
    expect(Object.fromEntries(Object.entries(res.kills).map(([id, k]) => [id, k.kills]))).toEqual(got);
    // Two Shadows can share one kill: together they have more than were felled.
    if (Object.keys(got).length === 2) expect(Object.values(got).reduce((x, y) => x + y, 0)).toBeGreaterThanOrEqual(res.felled.length);
  });

  it('a run pays each deployed Shadow its XP, a boss five times a creature, as far as its cap', () => {
    const s = defaults();
    grantXP(s, totalXpFor(20));
    reclassifyAll(s);
    autoAllocate(s);
    const d = dungeonById('DNG-001')!;
    const sh = shadows.bind(s, d.mobs[0]);
    const cap = shadows.SHADOW_RANKS[0].cap;
    sh.xp = shadows.xpAt(cap - 1);
    s.shadows.essence = shadows.SHADOW_RANKS[1].essence;
    const run = raid.begin(s, d, now);
    walk(s, d, now);
    run.kills[sh.id] = { kills: 20, bosses: 1 };
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(sh.kills).toBe(20);
    expect(sh.bosses).toBe(1);
    // It had room for one level's XP; the rest of what the creatures paid is not kept.
    const room = shadows.xpToNext(cap - 1);
    expect(shadows.xpFrom(20, 1)).toBe(19 * shadows.SHADOW_XP.kill + shadows.SHADOW_XP.boss);
    expect(shadows.xpFrom(20, 1)).toBeGreaterThan(room);
    expect(sh.xp).toBe(shadows.xpAt(cap));
    expect(res.grew).toEqual([{ id: sh.id, kills: 20, xp: room, from: cap - 1, to: cap }]);
    // It reached its cap with the Essence held: the run reports it ready, and promotes nothing.
    expect(res.ready).toEqual([{ id: sh.id, rank: shadows.SHADOW_RANKS[1].name }]);
    expect(sh.rank).toBe(0);
    // Ready already, the next run reports it no more, and pays it nothing.
    const again = raid.begin(s, d, now);
    walk(s, d, now);
    again.kills[sh.id] = { kills: 2, bosses: 0 };
    const next = raid.finish(s, d, again, 'cleared', now);
    expect(next.ready).toEqual([]);
    expect(next.grew[0].xp).toBe(0);
  });

});

describe('Shadow Essence', () => {
  it('releasing a Shadow gives its creature’s Essence and half of what its ranks cost, and takes it from the squad', () => {
    const s = defaults();
    const sh = shadows.bind(s, two.id);
    shadows.raise(sh, 2);
    const spent = shadows.SHADOW_RANKS[1].essence + shadows.SHADOW_RANKS[2].essence;
    const value = shadows.essenceOf(two, false) + Math.floor(spent / 2);
    expect(shadows.releaseValue(sh)).toBe(value);
    expect(s.shadows.squad).toContain(sh.id);
    expect(shadows.release(s, sh.id)).toBe(value);
    expect(s.shadows.essence).toBe(value);
    expect(s.shadows.army).toHaveLength(0);
    expect(s.shadows.squad).toHaveLength(0);
    expect(shadows.release(s, sh.id)).toBeNull();
  });

  it('a Shadow walking an open run cannot be released', () => {
    const s = defaults();
    grantXP(s, totalXpFor(20));
    const d = dungeonById('DNG-001')!;
    const sh = shadows.bind(s, d.mobs[0]);
    raid.begin(s, d, now);
    expect(shadows.inRun(s, sh.id)).toBe(true);
    expect(shadows.release(s, sh.id)).toBeNull();
    expect(s.shadows.army).toHaveLength(1);
  });
});

describe('slots', () => {
  it('Secret Missions make room for more Shadows than the grade allows', () => {
    const s = defaults();
    const base = shadows.slots(s);
    const granting = MISSIONS.filter((m) => m.grant.slot);
    expect(granting.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 10; i++) shadows.bind(s, ALL_ENEMIES[i].id);
    s.shadows.army[0].xp = shadows.xpAt(shadows.SHADOW_RANKS[0].cap);
    s.shadows.essence = shadows.SHADOW_RANKS[1].essence;
    // Ready for Sworn, but the quest is for a Sworn Shadow: it pays once it is promoted.
    sweep(s);
    expect(shadows.missionSlots(s)).toBe(1);
    shadows.promote(s, s.shadows.army[0].id);
    sweep(s);
    expect(shadows.missionSlots(s)).toBe(2);
    expect(shadows.slots(s)).toBe(base + 2);
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

  it('a reach that holds a creature already in the army gives Shadow Essence, and binds nothing', () => {
    const { s, l } = reaching();
    shadows.bind(s, one.id);
    l.boss = true;
    expect(raid.extract(s, l, 0, now)).toBe('essence');
    expect(l.essence).toBe(shadows.essenceOf(one, true));
    expect(s.shadows.essence).toBe(2 * shadows.ESSENCE[one.rank as 'E']);
    expect(s.shadows.army).toHaveLength(1);
    expect(raid.reachesLeft(l)).toBe(0);
  });

  it('a creature already in the army costs half the mana to reach for', () => {
    const d = dungeonById('DNG-015')!;
    let owned = 0;
    for (let k = 0; k < 16; k++) {
      for (const own of [false, true]) {
        const s = defaults();
        grantXP(s, totalXpFor(24));
        reclassifyAll(s);
        autoAllocate(s);
        if (own) for (const e of ALL_ENEMIES) shadows.bind(s, e.id);
        const at = now + k * 86_400_000;
        const run = raid.begin(s, d, at);
        const { won } = walk(s, d, at);
        if (!won) continue;
        for (const l of raid.finish(s, d, run, 'cleared', at).lingering) {
          const full = shadows.EXTRACT_MP[enemyById(l.enemyId)!.rank];
          expect(!!l.essence).toBe(own);
          expect(l.cost).toBe(own ? Math.round(full * shadows.ECHO_COST) : full);
          if (own) owned++;
        }
      }
    }
    expect(owned).toBeGreaterThan(0);
  });

  it('a creature already in the army lingers more often, marked for its Essence', () => {
    const s = defaults();
    expect(shadows.lingerChance(s, false, true)).toBeCloseTo(shadows.lingerChance(s, false) * shadows.ECHO);
    expect(shadows.lingerChance(s, true, true)).toBeLessThanOrEqual(0.9);
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

describe('awakening', () => {
  it('lets an Ascendant at its cap take stars for Shadow Essence, each growing it further', () => {
    const s = defaults();
    const sh = shadows.bind(s, two.id);
    shadows.raise(sh, 2);
    s.shadows.essence = 1000;
    // Not Ascendant: no star to take.
    expect(shadows.canAwaken(s, sh)).toBe(false);
    shadows.raise(sh, 3);
    const before = shadows.growth(sh);
    expect(shadows.awaken(s, sh.id)).toEqual({ id: sh.id, from: 0, to: 1, essence: shadows.AWAKENING.cost[0] });
    expect(s.shadows.essence).toBe(1000 - shadows.AWAKENING.cost[0]);
    expect(shadows.growth(sh)).toBeCloseTo(before + shadows.AWAKENING.growth);
    // Every star, and no more.
    shadows.awakenAll(s);
    expect(shadows.starsOf(sh)).toBe(shadows.MAX_STARS);
    expect(shadows.awakenCost(sh)).toBeNull();
    expect(shadows.awaken(s, sh.id)).toBeNull();
    expect(shadows.growth(sh)).toBeCloseTo(shadows.MAX_GROWTH);
    expect(s.shadows.essence).toBe(1000 - shadows.AWAKENING.cost.reduce((a, b) => a + b, 0));
  });

  it('asks for the cap, and the Essence the star costs', () => {
    const s = defaults();
    const sh = shadows.raise(shadows.bind(s, two.id), 3);
    sh.xp = shadows.xpAt(shadows.MAX_LEVEL - 1);
    s.shadows.essence = 1000;
    expect(shadows.canAwaken(s, sh)).toBe(false);
    shadows.raise(sh, 3);
    s.shadows.essence = shadows.AWAKENING.cost[0] - 1;
    expect(shadows.canAwaken(s, sh)).toBe(false);
    expect(shadows.waiting(s, sh)).toBe(false);
    s.shadows.essence += 1;
    expect(shadows.waiting(s, sh)).toBe(true);
  });

  it('releasing an awakened Shadow returns half of what its stars cost too', () => {
    const s = defaults();
    const sh = shadows.raise(shadows.bind(s, two.id), 3);
    s.shadows.essence = shadows.AWAKENING.cost[0];
    shadows.awaken(s, sh.id);
    const ranks = shadows.SHADOW_RANKS.slice(1).reduce((n, r) => n + r.essence, 0);
    expect(shadows.releaseValue(sh)).toBe(shadows.essenceOf(two, false) + Math.floor((ranks + shadows.AWAKENING.cost[0]) / 2));
  });
});

describe('the squad', () => {
  it('Auto Deploy puts the strongest in, as many as the slots hold, and the squad’s power is theirs summed', () => {
    const s = defaults();
    for (const e of ALL_ENEMIES.slice(0, 8)) shadows.bind(s, e.id);
    s.shadows.army.forEach((sh, i) => shadows.raise(sh, 1 + i * 2));
    s.shadows.squad = [s.shadows.army[0].id];
    const n = shadows.slots(s);
    const ids = shadows.autoDeploy(s);
    expect(ids).toHaveLength(n);
    const best = s.shadows.army.map(shadows.power).sort((a, b) => b - a).slice(0, n);
    expect(shadows.squad(s).map(shadows.power)).toEqual(best);
    expect(shadows.bestSquad(s)).toEqual(ids);
    expect(shadows.squadPower(s)).toBe(best.reduce((a, b) => a + b, 0));
  });

  it('a drop places a Shadow: two deployed change places, one from the reserve takes the place, a free slot takes it at the end, and -1 takes it out', () => {
    const s = defaults();
    grantXP(s, totalXpFor(60));
    reclassifyAll(s);
    const [a, b, c] = ALL_ENEMIES.slice(0, 3).map((e) => shadows.bind(s, e.id).id);
    s.shadows.squad = [a, b];
    const ids = () => shadows.squad(s).map((x) => x.id);
    expect(shadows.slots(s)).toBeGreaterThanOrEqual(3);
    expect(shadows.placeAt(s, b, 0)).toBe(true);
    expect(ids()).toEqual([b, a]);
    expect(shadows.placeAt(s, b, 0)).toBe(false);
    expect(shadows.placeAt(s, c, 1)).toBe(true);
    expect(ids()).toEqual([b, c]);
    expect(shadows.placeAt(s, b, -1)).toBe(true);
    expect(ids()).toEqual([c]);
    expect(shadows.placeAt(s, b, -1)).toBe(false);
    const n = shadows.slots(s);
    expect(shadows.placeAt(s, a, n - 1)).toBe(true);
    expect(ids()).toEqual([c, a]);
    expect(shadows.placeAt(s, c, n - 1)).toBe(true);
    expect(ids()).toEqual([a, c]);
    expect(shadows.placeAt(s, 'no-such-shadow', 0)).toBe(false);
    expect(shadows.placeAt(s, a, n)).toBe(false);
  });
});
