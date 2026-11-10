import { describe, expect, it } from 'vitest';
import { battle, COVER, THROWABLES, throwOrder, Unit, type Ev, type Turn } from '@/core/combat';
import { dungeonById, enemyById } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import { defaults } from '@/core/save';
import { autoAllocate, grantXP, reclassifyAll, syncClass, totalXpFor } from '@/core/progression';
import { autoLearn } from '@/core/skilltree';
import type { Order, Save } from '@/core/types';
import { rng } from '@/core/util';
import { toBoss } from './walk';

const now = Date.parse('2026-02-02T12:00:00');
const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  autoAllocate(s);
  syncClass(s);
  autoLearn(s);
  return s;
}

/** Play a fight to the end, the hunter's turns chosen by `pick`, every order written as the arena writes it. */
function play(party: Unit[], foes: Unit[], seed: string, pick: (t: Turn) => Order | null, opts = {}) {
  const log: Ev[] = [];
  const g = battle(party, foes, rng(seed), 2, () => {}, log, { hero: 'hero', ...opts });
  let step = g.next();
  while (!step.done) step = g.next(pick(step.value));
  return log;
}

describe('Cover', () => {
  it('turns every foe action aimed at the ally on the hunter, who guards, until the hunter acts again', () => {
    let covered = 0;
    for (let n = 0; n < 30; n++) {
      const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base: { ...base, VIT: 20 }, tag: 'hero', hpMult: 40 });
      const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base, tag: 'ally', hpMult: 10 });
      const foes = [0, 1, 2].map((j) => new Unit({ uid: `e${j}`, name: `F${j}`, side: 'e', base: { ...base, AGI: 5 + j * 4 }, hpMult: 6 }));
      // Cover the ally every turn: nothing a foe settles on it may land on it.
      const log = play([hero, ally], foes, `cover|${n}`, (t) => (t.allies.includes('a0') ? { use: COVER, at: 'a0' } : null));
      let cover = false;
      for (const e of log) {
        if (e.t === 'cover') { cover = true; covered++; expect(e.a).toBe('hero'); expect(e.v).toBe('a0'); continue; }
        if (e.t === 'hit' && e.a.startsWith('e')) expect(cover ? e.v : 'hero').toBe('hero');
        if (e.t === 'intent' && cover) expect(e.at === 'a0').toBe(false);
      }
    }
    expect(covered).toBeGreaterThan(30);
  });

  it('a foe still does exactly what it last showed, the cover having shown its new target first', () => {
    let checked = 0;
    for (let n = 0; n < 20; n++) {
      const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base: { ...base, VIT: 25 }, tag: 'hero', hpMult: 30 });
      const allies = [0, 1].map((j) => new Unit({ uid: `a${j}`, name: `A${j}`, side: 'p', base, tag: 'ally', hpMult: 8 }));
      const foes = [0, 1].map((j) => new Unit({ uid: `e${j}`, name: `F${j}`, side: 'e', base: { ...base, AGI: 3 + j * 9 }, kit: ['Grave Strike'], hpMult: 8 }));
      const r = rng(`promise|${n}`);
      const log = play([hero, ...allies], foes, `promise|${n}`, (t) => (r() < 0.6 && t.allies.length ? { use: COVER, at: t.allies[Math.floor(r() * t.allies.length)] } : null));
      const intent: Record<string, { ab: string; at?: string }> = {};
      const fresh = new Set<string>();
      const down = new Set<string>();
      for (const e of log) {
        if (e.t === 'intent') { intent[e.u] = { ab: e.ab, at: e.at }; fresh.add(e.u); continue; }
        if (e.t === 'down') { down.add(e.v); continue; }
        if (e.t !== 'hit' && e.t !== 'miss') continue;
        if (!e.a.startsWith('e') || !fresh.has(e.a)) continue;
        fresh.delete(e.a);
        expect(e.ab).toBe(intent[e.a].ab);
        const at = intent[e.a].at;
        if (at && !down.has(at)) expect(e.v).toBe(at);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('shows on the turn what the hunter would take of each hit on an ally, covering it', () => {
    const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base: { ...base, AGI: 30 }, tag: 'hero', hpMult: 40 });
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base, tag: 'ally', hpMult: 10 });
    const foe = new Unit({ uid: 'e0', name: 'F', side: 'e', base: { ...base, STR: 30 }, hpMult: 10 });
    const g = battle([hero, ally], [foe], rng('cover-reckon'), 1, () => {}, [], { hero: 'hero' });
    let t = g.next();
    for (let k = 0; k < 8 && !t.done && !t.value.threats.some((x) => x.at === 'a0'); k++) t = g.next({ use: 'Guard' });
    if (t.done) return;
    const at = t.value.threats.find((x) => x.at === 'a0')!;
    expect(at.hit).not.toBeNull();
    expect(at.guarded).not.toBeNull();
    expect(at.guarded!.hi).toBeLessThan(at.hit!.hi * 1.5);
  });
});

describe('throwables', () => {
  it('each lands its status on the foe aimed at, with no roll, and the bag pays for it as the order is written', () => {
    for (const k of THROWABLES) {
      const s = hunter(20);
      const d = dungeonById('DNG-016')!;
      toBoss(d, raid.begin(s, d, now));
      shop.stockUp(s, k.id, 1);
      const { ch } = raid.resume(s, d, s.gates.raid!, now);
      const t = ch.turn!;
      expect(t.throws[k.id]).toBe(1);
      const aim = t.foes[0];
      const given = raid.order(s, s.gates.raid!, { use: throwOrder(k.id), at: aim });
      expect(given?.use).toBe(throwOrder(k.id));
      expect(shop.held(s, k.id)).toBe(0);
      const from = ch.log.length;
      ch.play(given);
      const after = ch.log.slice(from);
      const thrown = after.find((e) => e.t === 'throw');
      expect(thrown && thrown.t === 'throw' && thrown.v[0]).toBe(aim);
      // The boss is the first foe of its chamber: it takes the status unless it is immune to it.
      const imm = enemyById(d.boss)!.imm ?? [];
      expect(after.some((e) => e.t === 'status' && e.v === aim && e.s === k.status)).toBe(!imm.includes(k.status));
      // None left: the next throw ordered is the System's choice.
      if (ch.turn) expect(raid.order(s, s.gates.raid!, { use: throwOrder(k.id), at: aim })).toBeNull();
    }
  });

  it('a resumed chamber replays what it threw, the bag having already paid for it', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-016')!;
    toBoss(d, raid.begin(s, d, now));
    shop.stockUp(s, 'flash', 1);
    const { ch } = raid.resume(s, d, s.gates.raid!, now);
    ch.play(raid.order(s, s.gates.raid!, { use: throwOrder('flash'), at: ch.turn!.foes[0] }));
    const shown = JSON.stringify(ch.log);
    const again = raid.resume(s, d, s.gates.raid!, now).ch;
    expect(JSON.stringify(again.log)).toBe(shown);
  });

  it('the one readied before the Gate is the one its fights throw, from the first chamber to the last', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-016')!;
    shop.stockUp(s, 'flash', 2);
    shop.stockUp(s, 'ember', 1);
    // Nothing readied: the first kind held. A kind not held cannot be readied; one held can.
    expect(shop.readied(s)).toBe('flash');
    expect(shop.ready(s, 'cord')).toBe(false);
    expect(shop.ready(s, 'ember')).toBe(true);
    expect(shop.readied(s)).toBe('ember');
    toBoss(d, raid.begin(s, d, now));
    const run = s.gates.raid!;
    expect(run.throw).toBe('ember');
    // Readying another once inside changes nothing for the run.
    shop.ready(s, 'flash');
    const { ch } = raid.resume(s, d, run, now);
    expect(ch.turn!.throws).toEqual({ ember: 1 });
    shop.ready(s, 'ember');
    // A kind the run did not ready is the System's choice, and the bag keeps it.
    expect(raid.order(s, run, { use: throwOrder('flash'), at: ch.turn!.foes[0] })).toBeNull();
    expect(shop.held(s, 'flash')).toBe(2);
    expect(raid.order(s, run, { use: throwOrder('ember'), at: ch.turn!.foes[0] })?.use).toBe(throwOrder('ember'));
    expect(shop.held(s, 'ember')).toBe(0);
    // Once the readied kind runs out, another held is readied in its place for the next Gate.
    expect(shop.readied(s)).toBe('flash');
  });

  it('the bag holds a stated number of each, and the Exchange sells them while there is room', () => {
    const s: Save = defaults();
    s.wallet.shards = 10_000;
    for (let i = 0; i < shop.THROW_MAX; i++) expect(shop.buyThrow(s, 'cord')).toBe(true);
    expect(shop.buyThrow(s, 'cord')).toBe(false);
    expect(shop.held(s, 'cord')).toBe(shop.THROW_MAX);
  });

  it('Auto never throws or covers: a hunter who gives no orders fights exactly the auto fight with a full bag', () => {
    const s = hunter(20);
    const d = dungeonById('DNG-016')!;
    toBoss(d, raid.begin(s, d, now));
    for (const k of THROWABLES) shop.stockUp(s, k.id, 2);
    const { ch } = raid.resume(s, d, s.gates.raid!, now);
    while (ch.turn) ch.play(raid.order(s, s.gates.raid!, null));
    expect(ch.log.some((e) => e.t === 'throw' || e.t === 'cover')).toBe(false);
    for (const k of THROWABLES) expect(shop.held(s, k.id)).toBe(2);
  });
});
