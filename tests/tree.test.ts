import { describe, expect, it } from 'vitest';
import { ability, battle, fight, passiveStyle, passiveText, STATUS, STATUS_TEXT, Unit, type Ev, type UnitSpec } from '@/core/combat';
import { grantXP, kitFor, reclassifyAll, syncClass, totalXpFor } from '@/core/progression';
import * as raid from '@/core/raid';
import { defaults, migrate, merge, SAVE_VERSION } from '@/core/save';
import * as tree from '@/core/skilltree';
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { EDGE, isUtility, NODES, nodeById, PATHS, RESET, SKILL_POINTS, SKILL_SLOTS, TIER_GATE, TREE_PASSIVES } from '@/data/tree';
import { STATS } from '@/core/types';
import { rng } from '@/core/util';

const now = Date.parse('2026-02-04T12:00:00');

/** A hunter of a level with every rank claimed, every Ability Point in STR, nothing yet learned. */
function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  s.hunter.attrs.STR += s.hunter.points;
  s.hunter.points = 0;
  syncClass(s);
  return s;
}

const learnAll = (s: ReturnType<typeof hunter>, ids: string[]) => ids.forEach((id) => expect(tree.learn(s, id), id).not.toBeNull());

describe('the tree', () => {
  it('has five Paths of sixteen nodes, every one of them sound', () => {
    expect(PATHS.map((p) => p.key).sort()).toEqual([...STATS].sort());
    for (const p of PATHS) {
      const nodes = NODES.filter((n) => n.path === p.key);
      expect(nodes).toHaveLength(16);
      // Every class skill of the line is in its Path, and every class passive, and one skill that does no damage.
      const skills = CLASS_SKILLS.filter((x) => x.line === p.key).map((x) => x.name);
      const own = nodes.filter((n) => n.kind === 'skill').map((n) => n.skill!);
      expect(own.filter((n) => skills.includes(n)).sort()).toEqual([...skills].sort());
      const util = own.filter((n) => !skills.includes(n));
      expect(util).toHaveLength(1);
      expect(isUtility(ability(util[0])!)).toBe(true);
      for (const x of CLASS_PASSIVES.filter((y) => y.line === p.key)) expect(nodes.some((n) => n.passive === x.name)).toBe(true);
    }
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    for (const n of NODES) {
      if (n.req) {
        const r = nodeById(n.req)!;
        expect(r, n.id).toBeTruthy();
        expect(r.path).toBe(n.path);
        expect(r.tier).toBeLessThan(n.tier);
      }
      if (n.fork) expect(nodeById(n.fork)!.fork).toBe(n.id);
      if (n.kind === 'skill') expect(ability(n.skill!)).toBeTruthy();
      if (n.kind === 'passive') {
        expect(passiveStyle(n.passive!)).toBeTruthy();
        expect(passiveText(n.passive!)).not.toBe('');
      }
      if (n.kind === 'stat') expect(Object.keys({ ...n.attrs, ...n.bonus }).length).toBe(1);
    }
    // The tree's own passives each play a style nothing else has.
    const own = TREE_PASSIVES.map((p) => p.style);
    expect(new Set(own).size).toBe(own.length);
    for (const st of own) expect([...CLASS_PASSIVES].some((p) => p.style === st)).toBe(false);
  });

  it('can never be filled: not even a Sovereign at Level 100 has the points for every node', () => {
    const cap = NODES.filter((n) => !n.fork || n.col === 1).reduce((t, n) => t + n.max, 0);
    const s = hunter(100);
    expect(s.hunter.rank).toBe('N');
    expect(tree.earned(s)).toBe(99 * SKILL_POINTS.level + 6 * SKILL_POINTS.rank);
    expect(tree.earned(s)).toBeLessThan(cap);
  });
});

describe('Skill Points', () => {
  it('come from levels and ranks claimed, and are not stored', () => {
    const s = hunter(25);
    expect(s.hunter.rank).toBe('C');
    expect(tree.points(s)).toBe(24 * SKILL_POINTS.level + 2 * SKILL_POINTS.rank);
    grantXP(s, totalXpFor(26) - totalXpFor(25));
    expect(tree.points(s)).toBe(25 * SKILL_POINTS.level + 2 * SKILL_POINTS.rank);
    tree.learn(s, 'STR:hammerblow');
    expect(tree.points(s)).toBe(25 * SKILL_POINTS.level + 2 * SKILL_POINTS.rank - 1);
  });

  it('wait at E-Rank, when the tree is shut', () => {
    const s = hunter(8);
    expect(tree.isOpen(s)).toBe(false);
    expect(tree.points(s)).toBe(7);
    expect(tree.learn(s, 'STR:hammerblow')).toBeNull();
    expect(tree.canSpend(s)).toBe(false);
  });
});

describe('learning', () => {
  it('a tier opens at its rank and once its Path holds enough points', () => {
    const s = hunter(25);
    expect(tree.blocked(s, nodeById('STR:sundering-arc')!)).toBe('path');
    learnAll(s, ['STR:hammerblow', 'STR:might', 'STR:might']);
    expect(tree.inPath(s, 'STR')).toBe(TIER_GATE[1]);
    expect(tree.canLearn(s, nodeById('STR:sundering-arc')!)).toBe(true);
    // B tier: the rank is not held.
    expect(tree.blocked(s, nodeById('STR:blood-up')!)).toBe('rank');
  });

  it('a node needs the one it grows from', () => {
    const s = hunter(25);
    learnAll(s, ['STR:hammerblow', 'STR:might', 'STR:might']);
    expect(tree.blocked(s, nodeById('STR:skullsplitter')!)).toBe('req');
    learnAll(s, ['STR:rend', 'STR:skullsplitter']);
  });

  it('a skill levels up to its Lv.MAX, and each level is what it fights with', () => {
    const s = hunter(25);
    const n = nodeById('STR:hammerblow')!;
    learnAll(s, [n.id, n.id, n.id]);
    expect(tree.blocked(s, n)).toBe('max');
    const a = tree.skillAt(n, 3);
    expect(a.mult).toBeCloseTo(ability('Hammerblow')!.mult + 0.2);
    expect(a.inflicts).toContain('Staggered');
    const hero = raid.heroSpec(s, now);
    expect(hero.kit).toEqual(['Hammerblow']);
    expect(hero.own?.[0]).toEqual(a);
    // The unit uses its own version.
    expect(new Unit(hero).ab('Hammerblow')).toEqual(a);
  });

  it('a fork seals its other half', () => {
    const s = hunter(40);
    learnAll(s, ['STR:hammerblow', 'STR:hammerblow', 'STR:hammerblow', 'STR:might', 'STR:might', 'STR:might', 'STR:heavy-hands', 'STR:heavy-hands']);
    learnAll(s, ['STR:blood-up']);
    expect(tree.blocked(s, nodeById('STR:scarred-hide')!)).toBe('fork');
    expect(raid.heroSpec(s, now).passives).toContain('Blood Up');
  });

  it('stats add their points and bonuses to the hunter', () => {
    const s = hunter(25);
    const before = new Unit(raid.heroSpec(s, now)).d;
    learnAll(s, ['STR:might', 'STR:might', 'STR:hammerblow', 'STR:heavy-hands']);
    expect(tree.flatBonus(s).STR).toBe(4 + 5);
    const after = new Unit(raid.heroSpec(s, now)).d;
    expect(after.patk).toBeGreaterThan(before.patk * 1.04);
  });

  it('runs out of points', () => {
    const s = hunter(12);
    while (tree.canSpend(s)) tree.learn(s, tree.learnable(s)[0].id);
    expect(tree.points(s) === 0 || tree.learnable(s).length === 0).toBe(true);
    expect(tree.learn(s, 'AGI:quick-cut')).toBeNull();
  });
});

describe('the loadout', () => {
  it('takes a skill in while a slot is free, and no more than the rank has slots for', () => {
    const s = hunter(25);
    expect(tree.slots(s)).toBe(SKILL_SLOTS.C);
    learnAll(s, ['STR:hammerblow', 'STR:rend', 'VIT:shield-blow']);
    expect(tree.equipped(s).map((n) => n.id)).toEqual(['STR:hammerblow', 'STR:rend', 'VIT:shield-blow']);
    learnAll(s, ['AGI:quick-cut']);
    expect(tree.isEquipped(s, 'AGI:quick-cut')).toBe(false);
    expect(tree.equip(s, 'AGI:quick-cut', 'STR:rend')).toBe(true);
    expect(raid.heroSpec(s, now).kit).toEqual(['Hammerblow', 'Quick Cut', 'Shield Blow']);
    expect(tree.unequip(s, 'STR:hammerblow')).toBe(true);
    expect(tree.shift(s, 'VIT:shield-blow', -1)).toBe(true);
    expect(raid.heroSpec(s, now).kit).toEqual(['Shield Blow', 'Quick Cut']);
    // Nothing unlearned goes in.
    expect(tree.equip(s, 'STR:cataclysm')).toBe(false);
  });

  it('a skill left out is not fought with', () => {
    const s = hunter(25);
    learnAll(s, ['STR:hammerblow', 'STR:rend']);
    tree.unequip(s, 'STR:rend');
    const hero = raid.heroSpec(s, now);
    const foes = [0, 1, 2].map((j): UnitSpec => ({ uid: `e${j}`, name: `F${j}`, side: 'e', base: { STR: 30, AGI: 30, PER: 30, VIT: 60, INT: 30 } }));
    const res = fight([new Unit(hero)], foes.map((f) => new Unit(f)), rng('tree'), 1);
    expect(res.log.some((e) => 'ab' in e && e.ab === 'Rend')).toBe(false);
    expect(res.log.some((e) => 'ab' in e && e.ab === 'Hammerblow')).toBe(true);
  });
});

describe('a reset', () => {
  it('hands every point back, free the first time, then for a clear’s shards', () => {
    const s = hunter(25);
    learnAll(s, ['STR:hammerblow', 'STR:might']);
    const all = tree.points(s) + 2;
    expect(tree.resetCost(s)).toBe(0);
    expect(tree.reset(s)).toEqual({ refunded: 2, cost: 0 });
    expect(tree.points(s)).toBe(all);
    expect(tree.equipped(s)).toEqual([]);
    learnAll(s, ['STR:hammerblow']);
    const cost = tree.resetCost(s);
    expect(cost).toBeGreaterThan(0);
    expect(RESET.free).toBe(1);
    s.wallet.shards = cost - 1;
    expect(tree.reset(s)).toBeNull();
    s.wallet.shards = cost;
    expect(tree.reset(s)).toEqual({ refunded: 1, cost });
    expect(s.wallet.shards).toBe(0);
    expect(tree.reset(s)).toBeNull();
  });
});

describe('the System’s way', () => {
  it('spends every point it can, the class’s Path first, and fills the slots', () => {
    for (const level of [10, 25, 40, 60, 85]) {
      const s = hunter(level);
      tree.autoLearn(s);
      expect(tree.canSpend(s)).toBe(false);
      expect(tree.equipped(s).length).toBe(tree.slots(s));
      expect(tree.inPath(s, 'STR')).toBe(Math.max(...STATS.map((k) => tree.inPath(s, k))));
      // The class's first options are all in it: the kit a line gave before the tree.
      const cls = kitFor('STR', Math.min(4, tree.rankTier(s)));
      for (const p of cls.passives) expect(raid.heroSpec(s, now).passives).toContain(p);
    }
  });

  it('the Association’s hunters still fight with each rung’s first option', () => {
    expect(kitFor('STR', 4)).toEqual({ kit: ['Hammerblow', 'Sundering Arc', 'Cataclysm'], passives: ['Blood Up', 'Immovable Guard'] });
  });
});

describe('the tree’s passives', () => {
  const foe = (over: Partial<UnitSpec> = {}): Unit => new Unit({ uid: 'e0', name: 'F', side: 'e', base: { STR: 20, AGI: 1, PER: 1, VIT: 20, INT: 1 }, hpMult: 40, ...over });
  const hero = (passives: string[], over: Partial<UnitSpec> = {}): Unit => new Unit({ uid: 'hero', name: 'H', side: 'p', base: { STR: 40, AGI: 1, PER: 60, VIT: 20, INT: 20 }, tag: 'hero', hpMult: 40, passives, ...over });
  const run = (h: Unit, f: Unit, seed = 'edge') => fight([h], [f], rng(seed), 1);

  it('Bloodthirst heals for a share of the damage dealt', () => {
    const h = hero(['Bloodthirst']);
    h.hp = 1;
    const res = run(h, foe());
    const healed = res.log.filter((e) => e.t === 'passive' && e.k === 'vamp');
    expect(healed.length).toBeGreaterThan(0);
  });

  it('Ambush makes the first hit of a fight a critical hit', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const res = run(hero(['Ambush'], { base: { STR: 40, AGI: 1, PER: 99, VIT: 20, INT: 20 } }), foe(), seed);
      const first = res.log.find((e) => e.t === 'hit' && e.a === 'hero');
      expect(first && first.t === 'hit' && first.crit).toBe(true);
    }
  });

  it('Spiked Guard hurts whatever hits the hunter', () => {
    const res = run(hero(['Spiked Guard']), foe({ base: { STR: 30, AGI: 1, PER: 99, VIT: 20, INT: 1 } }));
    expect(res.log.some((e) => e.t === 'tick' && e.v === 'e0' && e.s === 'Spiked Guard')).toBe(true);
  });

  it('Rampage raises attack for every foe put down', () => {
    const h = hero(['Rampage']);
    const foes = [0, 1, 2].map((j) => new Unit({ uid: `e${j}`, name: `F${j}`, side: 'e', base: { STR: 1, AGI: 1, PER: 1, VIT: 1, INT: 1 } }));
    const before = h.atk(false);
    fight([h], foes, rng('rampage'), 1);
    expect(h.mom).toBe(Math.min(EDGE.momentum.max, 3));
    expect(h.atk(false)).toBeCloseTo(before * (1 + EDGE.momentum.step * h.mom));
  });

  it('Lingering Curse makes a debuff last longer', () => {
    for (const [passives, extra] of [[[], 0], [['Lingering Curse'], EDGE.affliction]] as const) {
      const h = hero([...passives], { kit: ['Hex'], bonus: { statusChance: 60 }, base: { STR: 1, AGI: 1, PER: 99, VIT: 20, INT: 80 } });
      const f = foe({ base: { STR: 1, AGI: 1, PER: 1, VIT: 1, INT: 1 } });
      const g = battle([h], [f], rng('curse'), 1, () => {}, [], { hero: 'hero' });
      g.next();
      g.next({ use: 'Hex', at: 'e0' });
      // A round has ended since: the curse has lost one turn of its length.
      expect(f.status.Cursed).toBe(STATUS.Cursed.turns + extra - 1);
    }
  });

  it('Unbroken softens hits while the hunter is healthy', () => {
    const a = run(hero([]), foe({ base: { STR: 40, AGI: 1, PER: 99, VIT: 20, INT: 1 } }), 'u');
    const b = run(hero(['Unbroken']), foe({ base: { STR: 40, AGI: 1, PER: 99, VIT: 20, INT: 1 } }), 'u');
    const firstHit = (r: typeof a) => r.log.find((e) => e.t === 'hit' && e.a === 'e0');
    const x = firstHit(a), y = firstHit(b);
    expect(x && y && x.t === 'hit' && y.t === 'hit' && y.dmg < x.dmg).toBe(true);
  });
});

describe('an older save', () => {
  it('keeps what its rungs gave, learned at Lv.1, and the rest waits to be spent', () => {
    const s = hunter(40);
    const raw = JSON.parse(JSON.stringify(s));
    raw.v = 5;
    delete raw.hunter.tree;
    raw.hunter.picks = { 'STR:0': { name: 'Rend', at: 0 }, 'AGI:1': { name: 'Hamstring', at: 1 } };
    const out = merge(defaults(), migrate(raw));
    expect(out.v).toBe(SAVE_VERSION);
    expect('picks' in out.hunter).toBe(false);
    expect(Object.keys(out.hunter.tree.learned).sort()).toEqual(['STR:blood-up', 'STR:rend', 'STR:sundering-arc']);
    expect(out.hunter.tree.equip).toEqual(['STR:rend', 'STR:sundering-arc']);
    expect(raid.heroSpec(out, now).kit).toEqual(['Rend', 'Sundering Arc']);
    expect(tree.points(out)).toBe(tree.earned(out) - 3);
  });
});

describe('the skills that do no damage', () => {
  const foe = (uid: string, over: Partial<UnitSpec> = {}): Unit => new Unit({ uid, name: uid, side: 'e', base: { STR: 20, AGI: 1, PER: 1, VIT: 20, INT: 99 }, hpMult: 40, kit: ['Strike'], ...over });
  const hero = (kit: string[], over: Partial<UnitSpec> = {}): Unit => new Unit({ uid: 'hero', name: 'H', side: 'p', base: { STR: 20, AGI: 99, PER: 20, VIT: 20, INT: 20 }, tag: 'hero', hpMult: 40, kit, ...over });
  /** The hero's first turn, given an order, then everything up to their next. */
  function turn(h: Unit, party: Unit[], foes: Unit[], use: string) {
    const log: Ev[] = [];
    const g = battle([h, ...party], foes, rng('util'), 1, () => {}, log, { hero: 'hero' });
    g.next();
    const at = log.length;
    g.next({ use });
    return log.slice(at);
  }

  it('a curse lands on every foe, without a roll and without damage, unless it is immune', () => {
    const foes = [foe('e0'), foe('e1', { imm: ['Weakened'] }), foe('e2')];
    const ev = turn(hero(['Dread Roar']), [], foes, 'Dread Roar');
    expect(ev.some((e) => e.t === 'cast' && e.ab === 'Dread Roar')).toBe(true);
    expect(ev.filter((e) => e.t === 'hit' && e.a === 'hero')).toHaveLength(0);
    expect(foes.map((f) => !!f.status.Weakened)).toEqual([true, false, true]);
  });

  it('a taunt turns every foe’s shown next action on the hunter, and they do what they show', () => {
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base: { STR: 10, AGI: 1, PER: 10, VIT: 10, INT: 10 }, tag: 'ally', hpMult: 40 });
    const foes = [foe('e0'), foe('e1')];
    const h = hero(['Challenge']);
    const ev = turn(h, [ally], foes, 'Challenge');
    const cast = ev.findIndex((e) => e.t === 'cast' && e.k === 'taunt');
    expect(cast).toBeGreaterThanOrEqual(0);
    // Each foe's next blow, after the taunt, goes at the hunter, who guards.
    const blows = ev.slice(cast).filter((e) => (e.t === 'hit' || e.t === 'miss') && e.a.startsWith('e'));
    expect(blows.length).toBeGreaterThan(0);
    for (const b of blows.slice(0, foes.length)) expect('v' in b && b.v).toBe('hero');
    expect(ev.some((e) => e.t === 'expire' && e.v === 'hero' && e.s === 'Guarded') || !!h.status.Guarded).toBe(true);
  });

  it('a heal restores a share of every ally’s HP, and a veil grants its status to the side', () => {
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base: { STR: 10, AGI: 1, PER: 10, VIT: 10, INT: 10 }, tag: 'ally', hpMult: 40 });
    const h = hero(['Renewal', 'Smoke Veil']);
    h.hp = h.maxHp / 2;
    ally.hp = ally.maxHp / 2;
    const ev = turn(h, [ally], [foe('e0')], 'Renewal');
    const heals = ev.filter((e) => e.t === 'heal' && e.ab === 'Renewal');
    expect(heals.map((e) => e.t === 'heal' && e.a).sort()).toEqual(['a0', 'hero']);
    const v = hero(['Smoke Veil']);
    const ev2 = turn(v, [ally], [foe('e0')], 'Smoke Veil');
    expect(ev2.some((e) => e.t === 'support' && e.s === 'Veiled')).toBe(true);
    expect(STATUS.Veiled.good).toBe(true);
    expect(STATUS_TEXT.Veiled).toBe('Evasion +50%');
  });

  it('the System fills its slots with skills that do damage first', () => {
    const s = hunter(45);
    tree.autoLearn(s);
    const kit = raid.heroSpec(s, now).kit!;
    const utility = kit.filter((n) => isUtility(ability(n)!));
    const damage = NODES.filter((n) => n.kind === 'skill' && tree.levelOf(s, n.id) > 0 && !isUtility(ability(n.skill!)!)).length;
    if (damage >= tree.slots(s)) expect(utility).toHaveLength(0);
  });
});
