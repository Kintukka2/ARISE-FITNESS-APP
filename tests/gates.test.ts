import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { board, allies, dungeonById, entryBlock, seal, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import { grant, autoEquip, ofRank, upgradeCount, power } from '@/core/gear';
import { totalXpFor, grantXP, autoAllocate, GATE_XP, PRACTICE_LEVEL } from '@/core/progression';
import type { Dungeon, Save } from '@/core/types';
import { walk } from './walk';

import { dayKey as dayKeyOf } from '@/core/util';

const day = '2026-02-02';
const now = Date.parse(day + 'T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  autoAllocate(s);
  return s;
}

/** Play a gate to the end down the System's road. */
function play(s: Save, d: Dungeon) {
  const run = raid.begin(s, d, now);
  const { won } = walk(s, d, now);
  return { won, res: raid.finish(s, d, run, won ? 'cleared' : 'defeated', now) };
}

describe('the board', () => {
  it('opens ten gates plus the practice gate, one of every grade, two at yours', () => {
    const s = hunter(1);
    const b = board(s, day);
    expect(b[0].id).toBe(PRACTICE_GATE.id);
    const real = b.slice(1);
    expect(real).toHaveLength(10);
    for (const r of ['E', 'D', 'C', 'B', 'A', 'S']) expect(real.some((d) => d.rank === r)).toBe(true);
    expect(real.filter((d) => d.rank === 'E').length).toBeGreaterThanOrEqual(2);
  });

  it('a cleared gate leaves the board and another of its grade takes its place', () => {
    const s = hunter(1);
    const before = board(s, day).slice(1);
    const gone = before.find((d) => d.rank === 'E')!;
    seal(s, gone, day);
    const after = board(s, day).slice(1);
    expect(after).toHaveLength(10);
    expect(after.map((d) => d.id)).not.toContain(gone.id);
    expect(after.filter((d) => d.rank === 'E')).toHaveLength(before.filter((d) => d.rank === 'E').length);
    // Every other gate stays where it was.
    expect(before.filter((d) => d !== gone).every((d) => after.includes(d))).toBe(true);
  });

  it('a grade cleared out opens its gates again', () => {
    const s = hunter(1);
    for (const d of board(s, day).filter((x) => x.rank === 'S')) seal(s, d, day);
    for (let i = 0; i < 5; i++) for (const d of board(s, day).filter((x) => x.rank === 'S')) seal(s, d, day);
    expect(board(s, day).filter((d) => d.rank === 'S').length).toBeGreaterThan(0);
  });

  it('licenses one grade above and no further', () => {
    const s = hunter(1);
    expect(entryBlock(s, dungeonById('DNG-007')!, now)).toBeNull();
    expect(entryBlock(s, dungeonById('DNG-015')!, now)).toBe('licence');
  });

  it('allies are fixed per gate per day', () => {
    const d = dungeonById('DNG-020')!;
    expect(allies(d, day)).toEqual(allies(d, day));
  });
});

describe('a raid', () => {
  it('is deterministic for a seed and pays out', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    const { won, res } = play(s, d);
    if (won) {
      // The clear's own shards, and whatever the fights on the road banked.
      expect(res.shards).toBe(shop.GATE_SHARDS.E + res.banked);
      expect(res.banked).toBeGreaterThan(0);
      expect(res.bounty).toBe(shop.GATE_SHARDS.E * 2);
      expect(s.gates.clears).toBe(1);
      expect(board(s, dayKeyOf(now)).map((x) => x.id)).not.toContain(d.id);
    } else {
      expect(s.vitals.lockedUntil).toBeGreaterThan(now);
    }
    expect(s.gates.raid).toBeNull();
    expect(s.vitals.fatigue).toBeGreaterThan(0);
  });

  it('the practice gate is won by a fresh hunter, pays a ring, and lands them on the practice level', () => {
    const s = defaults();
    expect(raid.project(s, PRACTICE_GATE, 10, now).rate).toBe(1);
    const { won, res } = play(s, PRACTICE_GATE);
    expect(won).toBe(true);
    expect(s.hunter.level).toBe(PRACTICE_LEVEL);
    expect(res.xp?.to).toBe(PRACTICE_LEVEL);
    // The ring, and whatever its caches held.
    expect(res.loot.length).toBeGreaterThanOrEqual(1);
    expect(res.loot.some((it) => it.defId.length > 0)).toBe(true);
    expect(s.gates.clears).toBe(0);
  });

  it('a clear pays its grade in experience, twice the first time', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    const run = raid.begin(s, d, now);
    const first = raid.finish(s, d, run, 'cleared', now);
    expect(first.xp?.gained).toBe(GATE_XP.E * 2);
    const again = raid.begin(s, d, now);
    expect(raid.finish(s, d, again, 'cleared', now).xp?.gained).toBe(GATE_XP.E);
    expect(s.log[0].xp).toBe(GATE_XP.E);
  });

  it('being carried out pays a share, breaks the run, and a clear after it is a comeback', () => {
    const s = hunter(12);
    const d = dungeonById('DNG-001')!;
    const won = (x: Save) => raid.finish(x, d, raid.begin(x, d, now), 'cleared', now);
    won(s);
    expect(s.gates.unbroken).toBe(1);
    const lost = raid.finish(s, d, raid.begin(s, d, now), 'defeated', now);
    expect(lost.xp?.gained).toBe(Math.round(GATE_XP.E * raid.FAIL_SHARE));
    expect(s.gates.unbroken).toBe(0);
    s.vitals.lockedUntil = null;
    won(s);
    expect(s.stats.comebacks).toBe(1);
    expect(s.gates.bestUnbroken).toBe(1);
  });

  it('a clear above your grade counts as a reach, read before the experience lands', () => {
    const s = hunter(9);
    const d = dungeonById('DNG-007')!;
    const run = raid.begin(s, d, now);
    raid.finish(s, d, run, 'cleared', now);
    expect(s.hunter.level).toBeGreaterThanOrEqual(10);
    expect(s.stats.reachClears).toBe(1);
    // The hunters credited are the ones who went in, not the ones a D-Rank would be sent with.
    expect(s.gates.met).toEqual(allies(d, run.day, 'E').map((a) => a.id));
    expect(s.gates.met).not.toEqual(allies(d, run.day, 'D').map((a) => a.id));
  });

  it('a stronger hunter clears more', () => {
    const d = dungeonById('DNG-020')!;
    // Unclassed and ungeared, so far enough apart that calibration cannot close the gap.
    const weak = raid.project(hunter(10), d, 30, now).rate;
    const strong = raid.project(hunter(70), d, 30, now).rate;
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('gear and the exchange', () => {
  it('auto-equip fills slots with the best pieces', () => {
    const s = defaults();
    for (const id of ofRank('C').slice(0, 20).map((d) => d.id)) grant(s, id);
    expect(upgradeCount(s)).toBeGreaterThan(0);
    autoEquip(s);
    expect(upgradeCount(s)).toBe(0);
    expect(power(s)).toBeGreaterThan(0);
  });

  it('the shelf is eight pieces, stable for the day, and buying marks it sold', () => {
    const s = hunter(20);
    const a = shop.shelf(s, day);
    expect(a).toHaveLength(8);
    expect(shop.shelf(s, day).map((o) => o.item.defId)).toEqual(a.map((o) => o.item.defId));
    s.wallet.shards = 100000;
    expect(shop.buy(s, 0, day)).not.toBeNull();
    expect(shop.shelf(s, day)[0].sold).toBe(true);
    expect(s.items[0].q).toBe(a[0].item.q);
  });

  it('potions refuse to be wasted', () => {
    const s = defaults();
    s.wallet.shards = 500;
    expect(shop.drink(s, 'hp')).toBeNull();
    expect(s.wallet.shards).toBe(500);
  });
});

describe('combat rules', () => {
  it('a stun costs the next action even if it landed after the target acted', async () => {
    const { Unit, fight } = await import('@/core/combat');
    const { rng } = await import('@/core/util');
    const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };
    const hero = new Unit({ uid: 'hero', name: 'H', side: 'p', base });
    const foe = new Unit({ uid: 'e0', name: 'F', side: 'e', base, hpMult: 50 });
    foe.status.Stunned = 1;
    const res = fight([hero], [foe], rng('stun'), 1);
    const firstFoeEvent = res.log.find((e) => ('a' in e && e.a === 'e0'));
    expect(firstFoeEvent?.t).toBe('stun');
  });

  it('store purchases are credited once per transaction', () => {
    const s = defaults();
    expect(shop.deposit(s, 300, 'GPA.1')).toBe(true);
    expect(shop.deposit(s, 300, 'GPA.1')).toBe(false);
    expect(s.wallet.shards).toBe(300);
    expect(s.wallet.earned).toBe(0);
  });
});
