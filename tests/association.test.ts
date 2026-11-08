import { describe, expect, it } from 'vitest';
import * as association from '@/core/association';
import { board, dungeonById, mapKnown, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import * as shop from '@/core/shop';
import { ASSOC, ASSOC_LOOP, SURVEY } from '@/data/association';
import { CONTRACT_BONUS } from '@/data/contracts';
import { DUNGEONS } from '@/data/dungeons';
import { typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');
const day = '2026-02-04';

function hunter() {
  const s = typicalHunter(27, 'C', 'assoc-test');
  s.gates.cleared.push(PRACTICE_GATE.id);
  return s;
}

/** Settle a run at a gate with these creatures felled, without fighting it. */
function settle(s: ReturnType<typeof hunter>, id: string, felled: string[], outcome: 'cleared' | 'defeated' = 'cleared') {
  const d = dungeonById(id)!;
  const run = raid.begin(s, d, now);
  run.felled.push(...felled);
  if (outcome === 'defeated') run.lost = true;
  s.vitals.lockedUntil = null;
  return raid.finish(s, d, run, outcome, now);
}

describe('the Association’s line', () => {
  it('opens after the Practice Gate, and hands over one job at a time, the same each time it is drawn', () => {
    const fresh = defaults();
    expect(association.issue(fresh)).toBeNull();
    const s = hunter();
    const q = association.issue(s)!;
    expect(q).toEqual(association.make(0, 'C'));
    expect(association.issue(s)).toBe(q);
    expect(q.kind).toBe(ASSOC_LOOP[0]);
    expect(dungeonById(q.gate)!.rank).toBe('C');
  });

  it('loops through its kinds, and asks more as it goes round', () => {
    const jobs = Array.from({ length: 24 }, (_, n) => association.make(n, 'C'));
    jobs.forEach((q, n) => expect(q.kind).toBe(ASSOC_LOOP[n % ASSOC_LOOP.length]));
    const hunts = jobs.filter((q) => q.kind === 'hunt').map((q) => q.need);
    for (let i = 1; i < hunts.length; i++) expect(hunts[i]).toBeGreaterThanOrEqual(hunts[i - 1]);
    expect(hunts[hunts.length - 1]).toBeGreaterThan(hunts[0]);
    expect(Math.max(...hunts)).toBeLessThanOrEqual(ASSOC.hunt.max);
    for (const q of jobs) {
      if (q.kind === 'hunt') expect(dungeonById(q.gate)!.mobs).toContain(q.target);
      if (q.kind === 'boss') expect(q.target).toBe(dungeonById(q.gate)!.boss);
      expect(q.xp).toBeGreaterThan(0);
    }
  });

  it('pays nothing but experience about as often as the rule says, and a wider satchel at its milestones', () => {
    const rewards = Array.from({ length: 400 }, (_, n) => association.rewardAt(n, 'C'));
    const bare = rewards.filter((w, n) => !w && !ASSOC.satchelAt.includes(n as never)).length / rewards.length;
    expect(bare).toBeGreaterThan(ASSOC.bare - 0.08);
    expect(bare).toBeLessThan(ASSOC.bare + 0.08);
    for (const n of ASSOC.satchelAt) expect(association.rewardAt(n, 'C')).toEqual({ kind: 'satchel', n: 1 });
  });

  it('pins its Gate to the board until the job is done', () => {
    const s = hunter();
    const without = board(hunter(), day).map((d) => d.id);
    const q = association.issue(s)!;
    expect(board(s, day).map((d) => d.id)).toContain(q.gate);
    // Done, it is no longer pinned: the board is the day's own again.
    q.got = q.need;
    expect(board(s, day).map((d) => d.id)).toEqual(without);
  });
});

describe('a job', () => {
  it('counts its creature felled in any Gate, however the run ends', () => {
    const s = hunter();
    s.assoc = { n: 0, quest: null, reported: 0 };
    const q = association.issue(s)!;
    expect(q.kind).toBe('hunt');
    const elsewhere = DUNGEONS.find((d) => d.rank === 'C' && d.id !== q.gate)!.id;
    const res = settle(s, elsewhere, [q.target!, q.target!, 'ENM-XXX'], 'defeated');
    expect(res.assoc).toEqual({ from: 0, to: 2, need: q.need });
    expect(association.current(s)!.got).toBe(2);
  });

  it('counts a clear only of its own Gate, and only when it clears', () => {
    const s = hunter();
    s.assoc = { n: 1, quest: null, reported: 0 };
    const q = association.issue(s)!;
    expect(q.kind).toBe('clear');
    const elsewhere = DUNGEONS.find((d) => d.rank === 'C' && d.id !== q.gate)!.id;
    expect(settle(s, elsewhere, []).assoc).toBeNull();
    expect(settle(s, q.gate, [], 'defeated').assoc).toBeNull();
    expect(settle(s, q.gate, []).assoc).toEqual({ from: 0, to: 1, need: 1 });
    expect(association.ready(s)).toBe(true);
  });

  it('is reported for its pay, and the next job follows', () => {
    const s = hunter();
    s.assoc = { n: 0, quest: null, reported: 0 };
    const q = association.issue(s)!;
    expect(association.report(s)).toBeNull();
    q.got = q.need;
    q.reward = { kind: 'potion', id: 'hp', n: 2 };
    const xp = s.stats.xpTotal;
    const paid = association.report(s)!;
    expect(s.stats.xpTotal - xp).toBe(q.xp);
    expect(shop.held(s, 'hp')).toBe(2);
    expect(paid.next).toEqual(association.make(1, 'C'));
    expect(s.assoc.reported).toBe(1);
    expect(association.current(s)).toBe(paid.next);
  });

  it('pays a field potion the satchel has no room for in shards, and widens the satchel at a milestone', () => {
    const s = hunter();
    s.assoc = { n: 0, quest: null, reported: 0 };
    s.satchel = shop.satchelMax(s);
    const q = association.issue(s)!;
    q.got = q.need;
    q.reward = { kind: 'field', n: 2 };
    const purse = s.wallet.shards;
    const paid = association.report(s)!;
    expect(paid.field).toBe(0);
    expect(s.wallet.shards - purse).toBe(2 * shop.FIELD_POTION.price);
    const next = association.current(s)!;
    next.got = next.need;
    next.reward = { kind: 'satchel', n: 1 };
    association.report(s);
    expect(shop.satchelMax(s)).toBe(shop.FIELD_POTION.max + 1);
  });

  it('a held potion is drunk before one is bought', () => {
    const s = hunter();
    s.vitals.hp = 1;
    shop.stockUp(s, 'hp', 1);
    const purse = s.wallet.shards;
    expect(shop.drink(s, 'hp', now)).not.toBeNull();
    expect(shop.held(s, 'hp')).toBe(0);
    expect(s.wallet.shards).toBe(purse);
  });

  it('a Gate Survey charts a Gate’s whole map before the hunter has been in, and is kept when nothing is left to chart', () => {
    const s = hunter();
    const d = DUNGEONS.find((x) => x.rank === 'C' && !mapKnown(s, x))!;
    expect(raid.survey(s, d, now)).toBe(false);
    shop.stockUp(s, 'survey', 2);
    expect(raid.survey(s, d, now)).toBe(true);
    expect(mapKnown(s, d)).toBe(true);
    expect(shop.held(s, 'survey')).toBe(1);
    expect(raid.survey(s, d, now)).toBe(false);
    expect(shop.held(s, 'survey')).toBe(1);
  });

  it('the Exchange sells a Gate Survey, and a full day of Daily Quests pays one', () => {
    const s = hunter();
    s.wallet.shards = SURVEY.price - 1;
    expect(shop.buySurvey(s)).toBe(false);
    s.wallet.shards = SURVEY.price;
    expect(shop.buySurvey(s)).toBe(true);
    expect(shop.held(s, 'survey')).toBe(1);
    expect(s.wallet.shards).toBe(0);
    expect(CONTRACT_BONUS.survey).toBeGreaterThan(0);
  });
});

describe('a job left behind', () => {
  it('is drawn again at the hunter’s grade once they climb past it, in the same place in the line', () => {
    const s = hunter();
    s.assoc = { n: 3, quest: null, reported: 3 };
    const q = association.issue(s)!;
    q.got = 0;
    expect(q.grade).toBe('C');
    s.hunter.rank = 'B';
    const again = association.issue(s)!;
    expect(again).toEqual(association.make(3, 'B'));
    // Done, it stays to be reported, whatever the grade.
    again.got = again.need;
    s.hunter.rank = 'A';
    expect(association.issue(s)).toBe(again);
  });
});
