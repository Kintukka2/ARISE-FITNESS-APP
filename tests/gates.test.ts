import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { board, allies, dungeonById, entryBlock, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import { grant, autoEquip, ofRank, upgradeCount, power } from '@/core/gear';
import { totalXpFor, grantXP, autoAllocate } from '@/core/progression';

const day = '2026-02-02';
const now = Date.parse(day + 'T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level), { raw: true });
  autoAllocate(s);
  s.training.certified = true;
  return s;
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
    const run = raid.begin(s, d, now);
    const chambers = raid.plan(d, run.seed);
    let won = true;
    for (let i = 0; i < chambers.length && won; i++) {
      const party = raid.partyFor(s, d, run, now);
      const ch = raid.runChamber(d, run.seed, i, party, chambers);
      raid.record(s, d, run, party, ch, now);
      won = ch.won;
    }
    const res = raid.finish(s, d, run, won ? 'cleared' : 'defeated', now);
    if (won) {
      expect(res.shards).toBe(shop.GATE_SHARDS.E);
      expect(res.bounty).toBe(shop.GATE_SHARDS.E * 2);
      expect(s.gates.clears).toBe(1);
      expect(entryBlock(s, d, now)).toBe('sealed');
    } else {
      expect(s.vitals.lockedUntil).toBeGreaterThan(now);
    }
    expect(s.gates.raid).toBeNull();
    expect(s.vitals.fatigue).toBeGreaterThan(0);
  });

  it('the practice gate is won and pays a ring', () => {
    const s = hunter(5);
    const p = raid.project(s, PRACTICE_GATE, 10, now);
    expect(p.rate).toBe(1);
  });

  it('a stronger hunter clears more', () => {
    const d = dungeonById('DNG-020')!;
    const weak = raid.project(hunter(10), d, 30, now).rate;
    const strong = raid.project(hunter(45), d, 30, now).rate;
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
