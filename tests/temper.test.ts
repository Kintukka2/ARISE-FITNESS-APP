import { describe, expect, it } from 'vitest';
import * as forge from '@/core/forge';
import { defOf, equip, grant, ofRank, rollBonuses, ROLL_EFFECT, upgradeStep } from '@/core/gear';
import { defaults } from '@/core/save';
import * as temper from '@/core/temper';
import type { Item, Save } from '@/core/types';
import { EMBER } from '@/data/forge';
import { TEMPER_CAP, TEMPER_EMBER, TEMPER_STEP } from '@/data/temper';

/** A piece of a slot and rarity, granted, worn, and upgraded to perfect. */
function perfect(s: Save, slot = 'Weapon', rank = 'A', id = 'temper-test'): Item {
  const def = ofRank(rank as 'A').find((d) => d.slot === slot && ((d.rolls ?? []).length || rank === 'E' || rank === 'D'))!;
  let it = grant(s, def.id, id)!;
  for (let k = 0; k < 40; k++) it = upgradeStep(it) ?? it;
  s.items = s.items.map((x) => (x.id === id ? it : x));
  equip(s, id);
  return s.items.find((x) => x.id === id)!;
}

const rich = (s: Save) => { s.wallet.shards = 1e6; s.materials = { ...s.materials, [EMBER.id]: 1e4 }; return s; };

describe('Tempering', () => {
  it('opens on a perfect piece of C-Rank or higher, never on issued kit or a piece short of perfect', () => {
    const s = defaults();
    const a = perfect(s, 'Weapon', 'A', 'a');
    expect(temper.temperable(a)).toBe(true);
    const raw = grant(s, ofRank('A').find((d) => d.slot === 'Ring' && d.rolls?.length)!.id, 'raw')!;
    raw.q = 0.8;
    expect(temper.temperable(raw)).toBe(false);
    const e = perfect(s, 'Ring', 'E', 'e');
    expect(temper.temperable(e)).toBe(false);
  });

  it('offers its slot’s properties, each within its range at the piece’s rarity, the same roll every time', () => {
    const s = rich(defaults());
    const it = perfect(s, 'Weapon', 'S', 'w');
    const stats = temper.statsFor(it);
    expect(stats).toEqual(expect.arrayContaining(['Critical Chance', 'Accuracy']));
    for (const st of stats) {
      const range = temper.rangeOf(st, 'S')!;
      const v = temper.rollAt(it, st, 0);
      expect(v).toBeGreaterThanOrEqual(range.min);
      expect(v).toBeLessThanOrEqual(range.max);
      expect(temper.rollAt(it, st, 0)).toBe(v);
    }
    // Choosing another property moves nothing: the roll's place in its range is the piece's and the count's.
    const [x, y] = stats;
    expect(temper.share(it, { stat: x, v: temper.rollAt(it, x, 0) })).toBeCloseTo(temper.share(it, { stat: y, v: temper.rollAt(it, y, 0) }), 1);
  });

  it('fills the slot, then sets each new roll beside the old to keep either: nothing is ever lost', () => {
    const s = rich(defaults());
    const it = perfect(s, 'Weapon', 'A', 'w');
    const first = temper.temper(s, it.id, 'Critical Chance')!;
    expect(it.temper).toEqual(first);
    expect(it.temperNew).toBeUndefined();
    const second = temper.temper(s, it.id, 'Accuracy')!;
    expect(it.temper).toEqual(first);
    expect(it.temperNew).toEqual(second);
    // Waiting on a choice, it cannot be tempered again.
    expect(temper.blocked(s, it.id, 'Critical Chance')).toBe('waiting');
    temper.settle(s, it.id, false);
    expect(it.temper).toEqual(first);
    temper.temper(s, it.id, 'Accuracy');
    temper.settle(s, it.id, true);
    expect(it.temper?.stat).toBe('Accuracy');
    expect(temper.count(it)).toBe(3);
  });

  it('costs Ember alone, more each time, up to the cap', () => {
    const s = rich(defaults());
    const it = perfect(s, 'Weapon', 'A', 'w');
    const ember = (n: number) => temper.cost({ ...it, tempers: n }).mats[EMBER.id];
    expect(ember(0)).toBe(TEMPER_EMBER.A);
    expect(ember(1)).toBe(Math.round(TEMPER_EMBER.A * (1 + TEMPER_STEP)));
    expect(ember(50)).toBe(Math.round(TEMPER_EMBER.A * TEMPER_CAP));
    expect(temper.cost(it).shards).toBe(0);
    expect(temper.emberFor({ ...it, tempers: 1 })).toBe(ember(1));
    const before = s.materials[EMBER.id];
    const shards = s.wallet.shards;
    temper.temper(s, it.id, 'Critical Chance');
    expect(s.materials[EMBER.id]).toBe(before - TEMPER_EMBER.A);
    expect(s.wallet.shards).toBe(shards);
    // Short of Ember, no temper.
    const poor = defaults();
    const p = perfect(poor, 'Weapon', 'A', 'p');
    poor.wallet.shards = 1e6;
    expect(temper.blocked(poor, p.id, 'Critical Chance')).toBe('short');
    expect(temper.temper(poor, p.id, 'Critical Chance')).toBeNull();
  });

  it('reaches the fight as one more property of the piece', () => {
    const s = rich(defaults());
    const it = perfect(s, 'Weapon', 'A', 'w');
    const before = rollBonuses([it]);
    temper.temper(s, it.id, 'Critical Chance');
    const after = rollBonuses([it]);
    const key = ROLL_EFFECT['Critical Chance'].key;
    expect((after[key] ?? 0) - (before[key] ?? 0)).toBeCloseTo(it.temper!.v, 5);
    // Recycled, its temper goes with it.
    expect(defOf(it)).toBeTruthy();
    expect(forge.recycle(s, it.id)).toBeNull(); // worn: never recycled
  });

  it('the balance tools’ hunter who keeps up carries the System’s property at the middle of its range', () => {
    const s = defaults();
    const it = perfect(s, 'Weapon', 'S', 'w');
    temper.autoTemper(s);
    expect(it.temper?.stat).toBe(temper.systemStat(it));
    expect(temper.share(it, it.temper!)).toBeCloseTo(0.5, 2);
  });
});
