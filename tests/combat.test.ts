import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById, entryBlock, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import { battle, fight, POTION_HEAL, GUARD, Unit } from '@/core/combat';
import { autoAllocate, grantXP, syncClass, totalXpFor, reclassifyAll } from '@/core/progression';
import { autoLearn } from '@/core/skilltree';
import { SKILL_SLOTS } from '@/data/tree';
import type { Order, Save } from '@/core/types';
import { rng } from '@/core/util';
import { chamberOf } from '@/core/map';
import { isFight, toBoss, walk } from './walk';

const now = Date.parse('2026-02-02T12:00:00');
const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  s.hunter.attrs.STR += 6;
  autoAllocate(s);
  syncClass(s);
  autoLearn(s);
  return s;
}

/** Enter a gate and step into its first fight. */
function enter(s: Save, id: string) {
  const d = dungeonById(id)!;
  const run = raid.begin(s, d, now);
  raid.choose(s, d, run, raid.options(d, run)[0].id, now);
  return run;
}

/** Open a run at its boss: the chamber with turns enough to test. */
function atBoss(s: Save, id: string) {
  const d = dungeonById(id)!;
  return toBoss(d, raid.begin(s, d, now));
}

/** Fight the open chamber to the end, choosing each turn with `pick`, and record every order as the arena does. */
function fightOut(s: Save, pick: (t: NonNullable<raid.ChamberFight['turn']>) => Order | null) {
  const d = dungeonById(s.gates.raid!.dungeonId)!;
  const { ch } = raid.resume(s, d, s.gates.raid!, now);
  while (ch.turn) ch.play(raid.order(s, s.gates.raid!, pick(ch.turn)));
  return ch;
}

describe('turn by turn', () => {
  it('a hunter who always lets the System choose fights exactly the auto fight', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-015')!;
    const run = enter(s, d.id);
    const x = raid.pending(d, run)!;
    const auto = raid.runChamber(d, run.seed, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
    const manual = fightOut(s, () => null).result();
    expect(manual.log).toEqual(auto.log);
    expect(manual.won).toBe(auto.won);
  });

  it('orders replay the chamber exactly, from any point', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-015')!;
    atBoss(s, d.id);
    let n = 0;
    const whole = fightOut(s, (t) => ({ use: n++ % 3 === 2 ? 'Guard' : t.skills.find((k) => !k.cd)?.ability.name ?? 'Strike', at: t.foes[t.foes.length - 1] }));
    const orders = s.gates.raid!.orders;
    expect(orders.length).toBeGreaterThan(2);
    // Close the app halfway: the save holds the first half of the orders.
    const half = structuredClone(s);
    half.gates.raid!.orders = orders.slice(0, Math.floor(orders.length / 2));
    const { ch } = raid.resume(half, d, half.gates.raid!, now);
    for (const o of orders.slice(half.gates.raid!.orders.length)) ch.play(o);
    expect(ch.turn).toBeNull();
    expect(ch.result().log).toEqual(whole.result().log);
  });

  it('a chamber replays the same after the hunter changes gear, spends points and rests', () => {
    const s = hunter(20);
    s.hunter.points = 6;
    s.wallet.shards = 0;
    const d = dungeonById('DNG-015')!;
    atBoss(s, d.id);
    const whole = fightOut(s, (t) => ({ use: 'Strike', at: t.foes[0] }));
    const orders = s.gates.raid!.orders;
    const back = structuredClone(s);
    back.gates.raid!.orders = orders.slice(0, 2);
    // Everything that makes a hunter, changed between leaving and going back in.
    back.hunter.attrs.STR += 6;
    back.hunter.points = 0;
    back.vitals.fatigue = 0;
    back.equipped = {};
    const { ch } = raid.resume(back, d, back.gates.raid!, now + 8 * 36e5);
    for (const o of orders.slice(2)) ch.play(o);
    expect(ch.result().log).toEqual(whole.result().log);
  });

  it('the foe aimed at is always among those hit or missed', () => {
    const s = hunter(20);
    enter(s, 'DNG-015');
    const aimed: string[] = [];
    const ch = fightOut(s, (t) => { const at = t.foes[t.foes.length - 1]; aimed.push(at); return { use: 'Strike', at }; });
    const swings = ch.log.filter((e): e is Extract<typeof e, { t: 'hit' | 'miss' }> => (e.t === 'hit' || e.t === 'miss') && e.a === 'hero');
    expect(swings.length).toBe(aimed.length);
    swings.forEach((e, i) => expect(e.v).toBe(aimed[i]));
  });

  it('a skill still cooling down is not used, and the System chooses instead', () => {
    // From C-Rank a class has a second skill, and the second one has a cooldown.
    const s = hunter(40);
    const run = atBoss(s, 'DNG-029');
    const d = dungeonById(run.dungeonId)!;
    const { ch } = raid.resume(s, d, run, now);
    let refused = 0;
    while (ch.turn) {
      const t = ch.turn;
      const cooling = t.skills.find((k) => k.cd > 0);
      // Fire the longest cooldown while it is ready; while it is cooling, ask for it anyway.
      const use = cooling?.ability.name ?? t.skills.reduce((a, b) => (b.ability.cd > a.ability.cd ? b : a)).ability.name;
      const from = ch.log.length;
      ch.play(raid.order(s, run, { use }));
      const did = ch.log.slice(from).find((e) => (e.t === 'hit' || e.t === 'miss' || e.t === 'support') && e.a === 'hero');
      if (cooling && did && 'ab' in did) { refused++; expect(did.ab).not.toBe(use); }
    }
    expect(refused).toBeGreaterThan(0);
  });

  it('a guard halves the hits taken until the next turn', () => {
    // Against a potion at full health, which touches no dice: the foe's rolls are the same either way.
    const hits = (use: string) => {
      const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base, hpMult: 50 });
      // Slower than the hunter, so the guard is up before it swings.
      const foe = new Unit({ uid: 'e0', name: 'F', side: 'e', base: { ...base, AGI: 1 }, hpMult: 50 });
      const log: { t: string; v?: string; dmg?: number }[] = [];
      const g = battle([hero], [foe], rng('guard'), 3, () => {}, log as never[], { hero: 'hero', potions: 1 });
      g.next();
      g.next({ use });
      return log.filter((e) => e.t === 'hit' && e.v === 'hero').map((e) => e.dmg!);
    };
    const open = hits('Potion');
    const held = hits('Guard');
    expect(held.length).toBe(open.length);
    expect(held.length).toBeGreaterThan(0);
    held.forEach((dmg, i) => expect(Math.abs(dmg - open[i] * GUARD)).toBeLessThanOrEqual(1));
  });

  it('a Health Potion is bought into the satchel, paid for when ordered, and heals', () => {
    const s = hunter(20);
    s.wallet.shards = 1000;
    const price = shop.POTIONS.find((p) => p.id === 'hp')!.price;
    for (let i = 0; i < shop.SATCHEL + 1; i++) shop.buyCarried(s, 'hp');
    expect(shop.held(s, 'hp')).toBe(shop.SATCHEL);
    expect(s.wallet.shards).toBe(1000 - shop.SATCHEL * price);
    s.vitals = { hp: 40, mp: 60, fatigue: 0, at: now, lockedUntil: null };
    atBoss(s, 'DNG-015');
    let drank = false;
    const ch = fightOut(s, () => (drank ? null : (drank = true, { use: 'Potion' })));
    expect(shop.held(s, 'hp')).toBe(shop.SATCHEL - 1);
    const heal = ch.log.find((e) => e.t === 'heal');
    expect(heal && 'amt' in heal && heal.amt).toBeGreaterThan(0);
    expect(heal && 'amt' in heal && heal.amt).toBeLessThanOrEqual(Math.round(ch.roster[0].mx * POTION_HEAL) + 1);
  });

  it('a Mana Potion is bought to carry, with no satchel to fill', () => {
    const s = hunter(20);
    s.wallet.shards = 1000;
    for (let i = 0; i < shop.SATCHEL + 2; i++) expect(shop.buyCarried(s, 'mp')).toBe(true);
    expect(shop.held(s, 'mp')).toBe(shop.SATCHEL + 2);
    expect(shop.buyCarried(s, 'fatigue')).toBe(false);
  });

  it('a potion the satchel cannot pay for is recorded as the System’s choice', () => {
    const s = hunter(20);
    const run = raid.begin(s, dungeonById('DNG-015')!, now);
    expect(raid.order(s, run, { use: 'Potion' })).toBeNull();
    expect(run.orders).toEqual([null]);
    expect(shop.held(s, 'hp')).toBe(0);
  });

  it('a resumed chamber still has the potions its satchel paid for', () => {
    const s = hunter(20);
    shop.stockUp(s, 'hp');
    const d = dungeonById('DNG-015')!;
    enter(s, d.id);
    const { ch } = raid.resume(s, d, s.gates.raid!, now);
    ch.play(raid.order(s, s.gates.raid!, { use: 'Potion' }));
    expect(shop.held(s, 'hp')).toBe(0);
    const back = raid.resume(s, d, s.gates.raid!, now).ch;
    expect(back.log.filter((e) => e.t === 'heal')).toHaveLength(1);
  });

  it('recording a chamber clears its orders for the next', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-015')!;
    enter(s, d.id);
    const ch = fightOut(s, () => ({ use: 'Strike' }));
    expect(s.gates.raid!.orders.length).toBeGreaterThan(0);
    raid.record(s, d, s.gates.raid!, raid.partyFor(s, d, s.gates.raid!, now), ch.result(), now);
    expect(s.gates.raid!.orders).toEqual([]);
  });
});

describe('foe intents', () => {
  it('every foe does exactly what it showed, unless its target fell first or it was stunned', () => {
    let checked = 0;
    for (const [level, id] of [[12, 'DNG-007'], [24, 'DNG-016'], [40, 'DNG-029'], [55, 'DNG-044']] as const) {
      const s = hunter(level);
      const d = dungeonById(id)!;
      const run = raid.begin(s, d, now);
      const m = raid.mapOf(d, run);
      for (const x of m.nodes.filter(isFight)) {
        const ch = raid.runChamber(d, run.seed, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
        const intent: Record<string, { ab: string; at?: string }> = {};
        const fresh = new Set<string>();
        const down = new Set<string>();
        for (const e of ch.log) {
          if (e.t === 'intent') { intent[e.u] = { ab: e.ab, at: e.at }; fresh.add(e.u); continue; }
          if (e.t === 'down') { down.add(e.v); continue; }
          if (e.t !== 'hit' && e.t !== 'miss' && e.t !== 'support' && e.t !== 'stun') continue;
          if (!e.a.startsWith('e') || !fresh.has(e.a)) continue;
          // The first event of a foe's action: it is the action it settled on.
          fresh.delete(e.a);
          if (e.t === 'stun') continue;
          expect(e.ab).toBe(intent[e.a].ab);
          const at = intent[e.a].at;
          if (at && !down.has(at) && e.t !== 'support') expect(e.v).toBe(at);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('every foe still standing has shown its next action when the hunter’s turn comes', () => {
    const s = hunter(24);
    const d = dungeonById('DNG-016')!;
    atBoss(s, d.id);
    const { ch } = raid.resume(s, d, s.gates.raid!, now);
    let turns = 0;
    while (ch.turn) {
      const shown = new Set(ch.log.filter((e) => e.t === 'intent').map((e) => ('u' in e ? e.u : '')));
      for (const f of ch.turn.foes) expect(shown.has(f)).toBe(true);
      turns++;
      ch.play(raid.order(s, s.gates.raid!, null));
    }
    expect(turns).toBeGreaterThan(2);
  });

  it('protect sends allies at the foe about to hit the hunter', () => {
    const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base: { ...base, AGI: 1, PER: 1 }, tag: 'hero', hpMult: 50 });
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base: { ...base, AGI: 30 }, tag: 'ally' });
    const foes = [0, 1, 2].map((j) => new Unit({ uid: `e${j}`, name: `F${j}`, side: 'e', base, hpMult: 20 }));
    const log: { t: string; u?: string; at?: string; a?: string; v?: string }[] = [];
    const g = battle([hero, ally], foes, rng('protect'), 1, () => {}, log as never[], { hero: 'hero', tactic: 'protect' });
    g.next();
    const coming = log.filter((e) => e.t === 'intent' && e.at === 'hero').map((e) => e.u);
    const swing = log.find((e) => (e.t === 'hit' || e.t === 'miss') && e.a === 'a0');
    if (coming.length) expect(coming).toContain(swing?.v);
  });
});

describe('skill slots', () => {
  it('fill a slot more at C and at A, and one more again at Sovereign', () => {
    const kit = (level: number) => raid.heroSpec(hunter(level), now).kit ?? [];
    expect(kit(10)).toHaveLength(SKILL_SLOTS.D);
    expect(kit(20)).toHaveLength(SKILL_SLOTS.C);
    expect(kit(35)).toHaveLength(SKILL_SLOTS.B);
    expect(kit(50)).toHaveLength(SKILL_SLOTS.A);
    expect(kit(100)).toHaveLength(SKILL_SLOTS.N);
    expect(SKILL_SLOTS.D < SKILL_SLOTS.C && SKILL_SLOTS.C < SKILL_SLOTS.A && SKILL_SLOTS.A < SKILL_SLOTS.N).toBe(true);
  });
});

describe('the practice gate', () => {
  it('leaves the kills to the hunter, so it teaches turns, and is never lost', () => {
    for (let k = 0; k < 20; k++) {
      const s = defaults();
      const at = now + k * 7919000;
      raid.begin(s, PRACTICE_GATE, at);
      const { won, turns } = walk(s, PRACTICE_GATE, at, (t) => ({ use: 'Strike', at: t.foes[0] }));
      expect(won).toBe(true);
      expect(turns).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('standing orders', () => {
  /** Who a unit of this tag goes at first, under these orders, across a run of seeds. */
  const firsts = (tag: 'shadow' | 'hero' | 'ally', tactic: 'finish' | 'default') => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => {
    const u = new Unit({ uid: 'p0', name: 'P', side: 'p', base, tag });
    const weak = new Unit({ uid: 'e0', name: 'W', side: 'e', base, hpMult: 1 });
    const strong = new Unit({ uid: 'e1', name: 'S', side: 'e', base, hpMult: 20 });
    weak.hp = 5;
    const res = fight([u], [strong, weak], rng(`finish|${seed}`), 1, () => {}, tactic);
    const first = res.log.find((e) => (e.t === 'hit' || e.t === 'miss') && e.a === 'p0');
    return first && 'v' in first ? first.v : null;
  });

  it('finish sends a Shadow, and the hunter on Auto, at the foe nearest to falling', () => {
    for (const tag of ['shadow', 'hero'] as const) expect(new Set(firsts(tag, 'finish'))).toEqual(new Set(['e0']));
  });

  it('the Association’s hunters pick their own targets, whatever the orders', () => {
    expect(firsts('ally', 'finish')).toEqual(firsts('ally', 'default'));
    expect(new Set(firsts('ally', 'finish')).size).toBe(2);
  });

  it('the run keeps its orders until they are changed, a step underway keeps its own, and the next runs go in with them', () => {
    const s = hunter(20);
    s.gates.tactic = 'protect';
    const d = dungeonById('DNG-015')!;
    const run = raid.begin(s, d, now);
    expect(run.tactic).toBe('protect');
    expect(raid.setTactic(s, d, run, 'spread')).toBe(true);
    expect(run.tactic).toBe('spread');
    expect(s.gates.tactic).toBe('spread');
    // A step underway keeps the orders it opened with; the new ones reach the run at its next step.
    const first = raid.options(d, run).find((o) => isFight(o))!;
    raid.choose(s, d, run, first.id, now);
    expect(raid.setTactic(s, d, run, 'finish')).toBe(false);
    expect(run.tactic).toBe('spread');
    expect(s.gates.tactic).toBe('finish');
    const { party, ch } = raid.resume(s, d, run, now);
    while (ch.turn) ch.play(raid.order(s, run, null));
    raid.record(s, d, run, party, ch.result(), now);
    expect(run.tactic).toBe('spread');
    raid.choose(s, d, run, raid.options(d, run)[0].id, now);
    expect(run.tactic).toBe('finish');
  });

  it('the brief projects with the hunter’s actual orders', () => {
    // A hunter who wins some and loses some, so the orders their Auto turns follow can move the count.
    const s = hunter(24);
    const moved = ['DNG-015', 'DNG-016', 'DNG-017', 'DNG-018', 'DNG-019', 'DNG-020'].some((id) => {
      const d = dungeonById(id)!;
      s.gates.tactic = 'default';
      const plain = JSON.stringify(raid.project(s, d, 12, now));
      s.gates.tactic = 'finish';
      return JSON.stringify(raid.project(s, d, 12, now)) !== plain;
    });
    expect(moved).toBe(true);
  });
});

describe('an open run', () => {
  it('blocks every other way in until it is gone back into or abandoned', () => {
    const s = hunter(12);
    raid.begin(s, dungeonById('DNG-001')!, now);
    expect(entryBlock(s, dungeonById('DNG-002')!, now)).toBe('open');
    expect(entryBlock(s, dungeonById('DNG-001')!, now)).toBe('open');
    expect(entryBlock(s, PRACTICE_GATE, now)).toBe('open');
  });
});
