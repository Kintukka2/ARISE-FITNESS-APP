import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById, enemyById, opening, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed, systemRoad } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as raid from '@/core/raid';
import { autoAllocate, GATE_XP, grantXP, syncClass, totalXpFor } from '@/core/progression';
import { GATE_SHARDS } from '@/core/shop';
import type { Contract, Rank, Save } from '@/core/types';
import { RANKS } from '@/core/types';
import { addDays } from '@/core/util';
import { CONTRACT_BONUS, CONTRACT_PAY, CONTRACTS_PER_DAY } from '@/data/contracts';
import { walk } from './walk';

const day = '2026-02-02';
const now = Date.parse(day + 'T12:00:00');

/** A hunter past the practice gate, so the System issues them contracts. */
function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  autoAllocate(s);
  syncClass(s);
  s.gates.cleared.push(PRACTICE_GATE.id);
  return s;
}

const deed = (x: Partial<contracts.Deed> = {}): contracts.Deed => ({
  rank: 'E', cleared: true, fatigue: 0, felled: [], shadowKills: 0, elites: 0, offroad: false, ...x,
});

/** Hand the hunter a day of contracts of our choosing. */
function give(s: Save, list: Partial<Contract>[], grade: Rank = 'E') {
  s.contracts = { day, grade, bonus: false, list: list.map((c) => ({ kind: 'clear', need: 1, got: 0, done: false, ...c }) as Contract) };
}

describe('the draw', () => {
  it('is three different contracts, the same for everyone of a grade on a day, and every one can be done', () => {
    for (const grade of RANKS) for (let i = 0; i < 40; i++) {
      const d = addDays(day, i);
      for (const out of [0, 2]) {
        const list = contracts.draw(d, grade, out);
        expect(contracts.draw(d, grade, out)).toEqual(list);
        expect(list).toHaveLength(CONTRACTS_PER_DAY);
        expect(new Set(list.map((c) => c.kind)).size).toBe(CONTRACTS_PER_DAY);
        const open = opening(grade, d);
        for (const c of list) {
          expect(c.need).toBeGreaterThan(0);
          if (c.kind === 'shadows') expect(out).toBeGreaterThan(0);
          if (c.kind === 'shadows') expect(grade).not.toBe('E');
          if (c.kind === 'fell') {
            // The family is somewhere on the board this morning, in the gates the contract names.
            expect(c.where!.length).toBeGreaterThan(0);
            for (const id of c.where!) {
              expect(open.map((g) => g.id)).toContain(id);
              expect(dungeonById(id)!.mobs.some((m) => enemyById(m)?.family === c.family)).toBe(true);
            }
          }
          if (c.kind === 'gatekeeper') {
            expect(c.where!.length).toBeGreaterThan(0);
            for (const id of c.where!) {
              const g = dungeonById(id)!;
              expect(build(g, mapSeed(g, d)).layers.flat().some((x) => x.kind === 'elite')).toBe(true);
            }
          }
        }
      }
    }
  });

  it('is written the first time it is shown, and a level-up later that day does not redraw it', () => {
    const s = hunter(9);
    const shown = contracts.today(s, day);
    expect(s.contracts.day).toBeNull();
    contracts.issue(s, day);
    expect(s.contracts).toEqual(shown);
    grantXP(s, totalXpFor(30));
    expect(contracts.issue(s, day)).toEqual(shown);
    expect(contracts.today(s, day)).toEqual(shown);
    // The next day is drawn for the grade the hunter holds by then.
    expect(contracts.issue(s, addDays(day, 1)).grade).not.toBe(shown.grade);
  });

  it('is not issued before the practice gate', () => {
    const s = defaults();
    contracts.issue(s, day);
    expect(s.contracts.day).toBeNull();
    expect(contracts.count(s, deed(), day).done).toEqual([]);
  });
});

describe('counting', () => {
  it('a clear counts at the grade or above, a defeat never does, and kills count however the run ends', () => {
    const s = hunter(5);
    give(s, [{ kind: 'clear', need: 3 }, { kind: 'fell', need: 5, family: 'Undead' }, { kind: 'gatekeeper' }]);
    const undead = dungeonById('DNG-001')!.mobs.slice(0, 3);
    expect(undead.every((id) => enemyById(id)?.family === 'Undead')).toBe(true);
    contracts.count(s, deed({ cleared: false, felled: undead, elites: 1 }), day);
    expect(s.contracts.list.map((c) => c.got)).toEqual([0, undead.length, 1]);
    expect(s.contracts.list[2].done).toBe(true);
    contracts.count(s, deed({ rank: 'D' }), day);
    contracts.count(s, deed({ rank: 'E' }), day);
    s.contracts.grade = 'D';
    contracts.count(s, deed({ rank: 'E' }), day);
    expect(s.contracts.list[0].got).toBe(2);
  });

  it('pays each contract once, when it is done, and the bonus once, with the last', () => {
    const s = hunter(5);
    give(s, [{ kind: 'clear' }, { kind: 'offroad' }, { kind: 'tired', at: 15 }]);
    const pay = CONTRACT_PAY.shards * GATE_SHARDS.E;
    const xp = Math.round(GATE_XP.E * CONTRACT_PAY.xp);
    const a = contracts.count(s, deed(), day);
    expect(a.done.map((c) => c.kind)).toEqual(['clear']);
    expect(a).toMatchObject({ shards: pay, xp, bonus: false });
    expect(contracts.count(s, deed(), day).done).toEqual([]);
    expect(contracts.count(s, deed({ offroad: true, fatigue: 14 }), day).done.map((c) => c.kind)).toEqual(['offroad']);
    const last = contracts.count(s, deed({ fatigue: 15 }), day);
    expect(last.bonus).toBe(true);
    expect(last.shards).toBe(pay + CONTRACT_BONUS.shards * GATE_SHARDS.E);
    expect(last.xp).toBe(xp + Math.round(GATE_XP.E * CONTRACT_BONUS.xp));
    expect(contracts.count(s, deed({ fatigue: 99, offroad: true }), day)).toMatchObject({ shards: 0, xp: 0, bonus: false });
    expect(s.stats.contracts).toBe(3);
    expect(s.stats.contractDays).toBe(1);
  });

  it('pays at the grade it was issued for, not the one the hunter has levelled into', () => {
    const s = hunter(70);
    give(s, [{ kind: 'clear' }, { kind: 'offroad' }], 'C');
    expect(contracts.count(s, deed({ rank: 'S', offroad: true }), day).shards).toBe(2 * GATE_SHARDS.C + CONTRACT_BONUS.shards * GATE_SHARDS.C);
  });
});

describe('in a run', () => {
  it('finish counts the run, pays the shards, and grants the experience with the gate’s', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    give(s, [{ kind: 'clear' }, { kind: 'gatekeeper' }, { kind: 'fell', need: 1, family: enemyById(d.mobs[0])!.family }], 'E');
    const run = raid.begin(s, d, now);
    const { won } = walk(s, d, now);
    expect(won).toBe(true);
    const shards = s.wallet.shards;
    const xpBefore = s.stats.xpTotal;
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(res.contracts.done.map((c) => c.kind).sort()).toEqual(['clear', 'fell']);
    expect(res.contracts.shards).toBe(2 * GATE_SHARDS.E);
    expect(s.wallet.shards - shards).toBe(res.shards + res.bounty + res.contracts.shards);
    const firstClear = GATE_XP.E * 2;
    expect(s.stats.xpTotal - xpBefore).toBe(firstClear + res.contracts.xp);
    expect(res.xp!.gained).toBe(firstClear + res.contracts.xp);
  });

  it('the run remembers how tired the hunter walked in, before the gate adds its own', () => {
    const s = hunter(12);
    s.vitals.fatigue = 30;
    s.vitals.at = now;
    const run = raid.begin(s, dungeonById('DNG-001')!, now);
    expect(run.fatigue).toBe(30);
    expect(s.vitals.fatigue).toBeGreaterThan(30);
  });

  it('a road off the System’s counts as off the road; the System’s own does not', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-001')!;
    const m = build(d, mapSeed(d, day));
    const road = systemRoad(m);
    const other = m.layers[1].find((x) => x.id !== road[1] && m.byId[road[0]].next.includes(x.id));
    give(s, [{ kind: 'offroad' }]);
    raid.begin(s, d, now);
    walk(s, d, now);
    expect(raid.finish(s, d, s.gates.raid!, 'cleared', now).contracts.done).toEqual([]);
    if (!other) return;
    give(s, [{ kind: 'offroad' }]);
    const run = raid.begin(s, d, now + 1);
    run.path = [road[0], other.id];
    run.at = 2;
    expect(raid.finish(s, d, run, 'cleared', now).contracts.done.map((c) => c.kind)).toEqual(['offroad']);
  });

  it('the practice gate counts toward nothing', () => {
    const s = hunter(1);
    give(s, [{ kind: 'clear' }]);
    const run = raid.begin(s, PRACTICE_GATE, now);
    walk(s, PRACTICE_GATE, now);
    expect(raid.finish(s, PRACTICE_GATE, run, 'cleared', now).contracts.done).toEqual([]);
    expect(s.contracts.list[0].got).toBe(0);
  });
});

describe('on the Quests screen', () => {
  it('a new day’s arrive unseen, and showing them issues them and clears the count', () => {
    const s = hunter(5);
    expect(contracts.unseen(s, day)).toBe(CONTRACTS_PER_DAY);
    contracts.issue(s, day);
    expect(contracts.unseen(s, day)).toBe(CONTRACTS_PER_DAY);
    contracts.show(s, day);
    expect(s.contracts.day).toBe(day);
    expect(contracts.unseen(s, day)).toBe(0);
    expect(contracts.unseen(s, addDays(day, 1))).toBe(CONTRACTS_PER_DAY);
  });

  it('showing them draws nothing new: the day’s stand as issued', () => {
    const s = hunter(5);
    const issued = structuredClone(contracts.issue(s, day).list);
    contracts.show(s, day);
    expect(s.contracts.list).toEqual(issued);
  });

  it('counts only what is undone, and nothing before the practice gate', () => {
    const s = hunter(5);
    give(s, [{ kind: 'clear', done: true }, { kind: 'fell', where: ['DNG-001'] }, { kind: 'gatekeeper', where: ['DNG-002'], done: true }]);
    expect(contracts.unseen(s, day)).toBe(1);
    expect([...contracts.named(s, day)]).toEqual(['DNG-001']);
    const fresh = defaults();
    expect(contracts.unseen(fresh, day)).toBe(0);
    contracts.show(fresh, day);
    expect(fresh.contracts.day).toBeNull();
  });
});
