import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById, entryBlock, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import { battle, fight, FIELD_POTION_HEAL, GUARD, Unit } from '@/core/combat';
import { autoAllocate, grantXP, syncClass, totalXpFor } from '@/core/progression';
import type { Order, Save } from '@/core/types';
import { rng } from '@/core/util';

const now = Date.parse('2026-02-02T12:00:00');
const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  s.hunter.attrs.STR += 6;
  autoAllocate(s);
  syncClass(s);
  return s;
}

/** Open a run at its boss: the chamber with turns enough to test. */
function atBoss(s: Save, id: string) {
  const d = dungeonById(id)!;
  const run = raid.begin(s, d, now);
  run.at = raid.plan(d, run.seed).length - 1;
  return run;
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
    const run = raid.begin(s, d, now);
    const auto = raid.runChamber(d, run.seed, 0, raid.partyFor(s, d, run, now));
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
    const d = dungeonById('DNG-015')!;
    raid.begin(s, d, now);
    const aimed: string[] = [];
    const ch = fightOut(s, (t) => { const at = t.foes[t.foes.length - 1]; aimed.push(at); return { use: 'Strike', at }; });
    const swings = ch.log.filter((e): e is Extract<typeof e, { t: 'hit' | 'miss' }> => (e.t === 'hit' || e.t === 'miss') && e.a === 'hero');
    expect(swings.length).toBe(aimed.length);
    swings.forEach((e, i) => expect(e.v).toBe(aimed[i]));
  });

  it('a skill still cooling down is not used, and the System chooses instead', () => {
    // A B-Rank class has a second skill, and the second one has a cooldown.
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

  it('a field potion is bought into the satchel, paid for when ordered, and heals', () => {
    const s = hunter(20);
    s.wallet.shards = 1000;
    for (let i = 0; i < shop.FIELD_POTION.max + 1; i++) shop.buyField(s);
    expect(s.satchel).toBe(shop.FIELD_POTION.max);
    expect(s.wallet.shards).toBe(1000 - shop.FIELD_POTION.max * shop.FIELD_POTION.price);
    s.vitals = { hp: 40, mp: 60, fatigue: 0, at: now, lockedUntil: null };
    atBoss(s, 'DNG-015');
    let drank = false;
    const ch = fightOut(s, () => (drank ? null : (drank = true, { use: 'Potion' })));
    expect(s.satchel).toBe(shop.FIELD_POTION.max - 1);
    const heal = ch.log.find((e) => e.t === 'heal');
    expect(heal && 'amt' in heal && heal.amt).toBeGreaterThan(0);
    expect(heal && 'amt' in heal && heal.amt).toBeLessThanOrEqual(Math.round(ch.roster[0].mx * FIELD_POTION_HEAL) + 1);
  });

  it('a potion the satchel cannot pay for is recorded as the System’s choice', () => {
    const s = hunter(20);
    const run = raid.begin(s, dungeonById('DNG-015')!, now);
    expect(raid.order(s, run, { use: 'Potion' })).toBeNull();
    expect(run.orders).toEqual([null]);
    expect(s.satchel).toBe(0);
  });

  it('a resumed chamber still has the potions its satchel paid for', () => {
    const s = hunter(20);
    s.satchel = 1;
    const d = dungeonById('DNG-015')!;
    raid.begin(s, d, now);
    const { ch } = raid.resume(s, d, s.gates.raid!, now);
    ch.play(raid.order(s, s.gates.raid!, { use: 'Potion' }));
    expect(s.satchel).toBe(0);
    const back = raid.resume(s, d, s.gates.raid!, now).ch;
    expect(back.log.filter((e) => e.t === 'heal')).toHaveLength(1);
  });

  it('recording a chamber clears its orders for the next', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-015')!;
    raid.begin(s, d, now);
    const ch = fightOut(s, () => ({ use: 'Strike' }));
    expect(s.gates.raid!.orders.length).toBeGreaterThan(0);
    raid.record(s, d, s.gates.raid!, raid.partyFor(s, d, s.gates.raid!, now), ch.result(), now);
    expect(s.gates.raid!.orders).toEqual([]);
  });
});

describe('the practice gate', () => {
  it('leaves the kills to the hunter, so it teaches turns, and is never lost', () => {
    for (let k = 0; k < 20; k++) {
      const s = defaults();
      const at = now + k * 7919000;
      raid.begin(s, PRACTICE_GATE, at);
      const run = s.gates.raid!;
      let turns = 0;
      let won = true;
      for (let i = 0; i < raid.plan(PRACTICE_GATE, run.seed).length && won; i++) {
        const { party, ch } = raid.resume(s, PRACTICE_GATE, run, at);
        while (ch.turn) { turns++; ch.play(raid.order(s, run, { use: 'Strike', at: ch.turn.foes[0] })); }
        const res = ch.result();
        won = res.won;
        raid.record(s, PRACTICE_GATE, run, party, res, at);
      }
      expect(won).toBe(true);
      expect(turns).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('standing orders', () => {
  it('finish sends every ally at the foe nearest to falling', () => {
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base, tag: 'ally' });
    const weak = new Unit({ uid: 'e0', name: 'W', side: 'e', base, hpMult: 1 });
    const strong = new Unit({ uid: 'e1', name: 'S', side: 'e', base, hpMult: 20 });
    weak.hp = 5;
    const res = fight([ally], [strong, weak], rng('finish'), 1, () => {}, 'finish');
    const first = res.log.find((e) => (e.t === 'hit' || e.t === 'miss') && e.a === 'a0');
    expect(first && 'v' in first && first.v).toBe('e0');
  });

  it('the run keeps the orders it went in with', () => {
    const s = hunter(20);
    s.gates.tactic = 'protect';
    const run = raid.begin(s, dungeonById('DNG-015')!, now);
    s.gates.tactic = 'spread';
    expect(run.tactic).toBe('protect');
  });

  it('the brief projects with the party’s actual orders', () => {
    const s = hunter(16);
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
