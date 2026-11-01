import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById } from '@/core/gates';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import * as shop from '@/core/shop';
import * as spire from '@/core/spire';
import type { Save } from '@/core/types';
import { SETS, UPGRADE } from '@/data/sets';
import { walk } from './walk';
import { typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');

function holding(...ids: string[]) {
  const s = defaults();
  ids.forEach((id, i) => gear.grant(s, id, `t|${i}`));
  return s;
}

describe('sets', () => {
  it('every set has three pieces and a home gate of its own grade', () => {
    for (const set of SETS) {
      const pieces = gear.setPieces(set.id);
      expect(pieces).toHaveLength(3);
      const home = dungeonById(set.home)!;
      expect(home).toBeTruthy();
      for (const p of pieces) expect(p.rank).toBe(home.rank);
    }
  });

  it('two different pieces pay the first bonus, all three pay both, and the same design twice counts once', () => {
    const set = SETS.find((x) => x.id === 'Champion')!;
    const [a, b, c] = gear.setPieces('Champion').map((d) => d.id);
    const s = holding(a, a, b, c);
    const [a1, a2, b1, c1] = s.items;
    expect(gear.setBonuses([a1, a2])).toEqual({});
    expect(gear.setBonuses([a1, b1])).toEqual(set.two);
    expect(gear.setBonuses([a1, b1, c1])).toEqual(gear.sumBonuses(set.two, set.three));
  });

  it('a worn set reaches the hunter’s fight', () => {
    const ids = gear.setPieces('Ravager').map((d) => d.id);
    const s = holding(...ids);
    for (const it of s.items) gear.equip(s, it.id);
    const bare = raid.heroSpec(defaults(), now).bonus ?? {};
    const worn = raid.heroSpec(s, now).bonus ?? {};
    const set = SETS.find((x) => x.id === 'Ravager')!;
    expect((worn.patk ?? 0) - (bare.patk ?? 0)).toBeCloseTo(set.three.patk!, 6);
  });

  it('reads its bonus from the numbers', () => {
    expect(gear.bonusText({ patk: 0.08, mpow: 0.08 })).toBe('Attack and magic +8%');
    expect(gear.bonusText({ crit: 6, accuracy: 6 })).toBe('Critical chance +6 · Accuracy +6');
    expect(gear.bonusText({ maxHp: 0.12, resist: 0.1 })).toBe('Maximum HP +12% · Resistance +10%');
  });

  it('Auto Equip keeps a set together, unless something is a good deal better', () => {
    const [helm, plate] = gear.setPieces('Warden');
    const s = holding(helm.id, plate.id);
    const other = gear.ofRank('C').find((d) => d.slot === 'Head' && !d.set)!;
    gear.grant(s, other.id, 'other');
    // The set's helm at its worst, the other at its best: the set still wins.
    s.items[0].q = gear.Q_LOW;
    s.items[2].q = gear.Q_HIGH;
    gear.autoEquip(s);
    expect(s.equipped.head).toBe(s.items[0].id);
    // A piece a grade better takes the slot regardless.
    gear.grant(s, gear.ofRank('S').find((d) => d.slot === 'Head' && !d.set)!.id, 'better');
    gear.autoEquip(s);
    expect(s.equipped.head).toBe('better');
  });
});

describe('a set’s home gate', () => {
  function clear(s: Save, id: string) {
    const d = dungeonById(id)!;
    const run = raid.begin(s, d, now);
    const { won } = walk(s, d, now);
    expect(won).toBe(true);
    return raid.finish(s, d, run, 'cleared', now);
  }

  it('leaves a piece of its set on every clear, one the hunter does not hold yet', () => {
    const s = typicalHunter(34, 'C', 'home');
    const pieces = gear.setPieces('Champion').map((d) => d.id);
    s.items = s.items.filter((it) => !pieces.includes(it.defId));
    gear.grant(s, pieces[0], 'held');
    const res = clear(s, 'DNG-015');
    const got = res.loot.map((it) => it.defId).filter((id) => pieces.includes(id));
    expect(got.length).toBeGreaterThan(0);
    expect(got[0]).not.toBe(pieces[0]);
  });

  it('a gate that is home to no set leaves none, and a Spire block in a home gate’s shape does', () => {
    expect(raid.homeSets(dungeonById('DNG-016')!)).toEqual([]);
    const season = spire.seasonOf('2026-02-04');
    const g = dungeonById('DNG-015')!;
    const d = spire.blockFrom(season, spire.blockOf(30), g);
    expect(raid.homeSets(d).map((x) => x.id)).toEqual(['Champion']);
  });
});

describe('upgrading', () => {
  it('raises quality and every property a step at a time, to perfect, for a stated price', () => {
    const def = gear.ofRank('C').find((d) => (d.rolls ?? []).length > 0)!;
    const s = holding(def.id);
    s.wallet.shards = 100000;
    const it = () => s.items[0];
    it().q = gear.Q_LOW;
    it().rolls = (def.rolls ?? []).map((r) => r.min);
    const cost = shop.upgradeCost(it())!;
    expect(cost).toBe(shop.stepCost('C'));
    let steps = 0;
    while (shop.upgradeCost(it()) !== null) {
      const before = it();
      expect(shop.upgrade(s, before.id)).toBe(true);
      expect(it().q).toBeGreaterThanOrEqual(before.q);
      steps++;
    }
    expect(steps).toBe(Math.round(1 / UPGRADE.share));
    expect(it().q).toBe(gear.Q_HIGH);
    expect(it().rolls).toEqual((def.rolls ?? []).map((r) => r.max));
    expect(it().up).toBe(steps);
    expect(s.wallet.shards).toBe(100000 - steps * cost);
    expect(shop.upgrade(s, it().id)).toBe(false);
  });

  it('is refused when the shards are short, and the issued kit is not for upgrading', () => {
    const def = gear.ofRank('B')[0];
    const s = holding(def.id);
    s.items[0].q = gear.Q_LOW;
    s.wallet.shards = shop.stepCost('B') - 1;
    expect(shop.upgrade(s, s.items[0].id)).toBe(false);
    expect(s.items[0].q).toBe(gear.Q_LOW);
    expect(s.wallet.shards).toBe(shop.stepCost('B') - 1);
    gear.issueKit(s);
    const kit = s.items.find((x) => gear.defOf(x)?.issued)!;
    expect(shop.upgradeCost(kit)).toBeNull();
  });
});
