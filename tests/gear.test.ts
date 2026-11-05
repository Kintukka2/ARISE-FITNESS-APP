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

describe('fusion', () => {
  const D = 'CHAMPION_HELM';
  it('feeds a duplicate into a piece: the better rolls of the two, then steps toward perfect', () => {
    const s = holding(D, D, 'WARDEN_HELM');
    const [a, b] = s.items;
    // Make the duplicate the better roll, so the piece takes its quality.
    s.items[0] = { ...a, q: 0.8, rolls: [3.2] };
    s.items[1] = { ...b, q: 1.1, rolls: [4.6] };
    expect(gear.fodderFor(s, s.items[0]).map((x) => x.id)).toEqual([b.id]);
    const next = gear.fuse(s, a.id, b.id)!;
    expect(next.q).toBeGreaterThan(1.1);
    expect(next.rolls[0]).toBeGreaterThan(4.6);
    expect(s.items.some((x) => x.id === b.id)).toBe(false);
    expect(s.items.find((x) => x.id === a.id)).toEqual(next);
  });

  it('never fuses past perfect, a different design, a worn, starred or masterwork piece', () => {
    const s = holding(D, D, D, D, 'WARDEN_HELM');
    const [a, b, c, m, w] = s.items;
    gear.equip(s, b.id);
    gear.toggleFav(s, c.id);
    s.items[3] = { ...m, master: 1 };
    expect(gear.fodderFor(s, a).map((x) => x.id)).toEqual([]);
    expect(gear.fuse(s, a.id, w.id)).toBeNull();
    // A perfect piece takes nothing more from a duplicate.
    gear.toggleFav(s, c.id);
    let p = s.items[0];
    for (let x = gear.upgradeStep(p, 0); x; x = gear.upgradeStep(x, 0)) p = x;
    s.items[0] = p;
    expect(gear.fusedWith(p, c)).toBeNull();
    expect(gear.fuse(s, a.id, c.id)).toBeNull();
  });

  it('a hunter who keeps up feeds every duplicate into what is worn', () => {
    const s = holding(D, D, D);
    gear.equip(s, s.items[0].id);
    expect(gear.fuseWorn(s)).toBe(2);
    expect(s.items).toHaveLength(1);
  });
});

describe('loadouts', () => {
  it('saves what is worn and wears it again, emptying what it left empty', () => {
    const s = holding('CHAMPION_HELM', 'WARDEN_HELM', 'CHAMPION_BLADE');
    const [h1, h2, w] = s.items;
    gear.equip(s, h1.id);
    gear.equip(s, w.id);
    gear.saveLoadout(s, 0, '2026-02-04');
    gear.equip(s, h2.id);
    gear.unequip(s, 'weapon');
    expect(gear.wearing(s, s.loadouts[0])).toBe(false);
    expect(gear.wearLoadout(s, 1)).toBe(0);
    expect(gear.wearLoadout(s, 0)).toBe(2);
    expect(s.equipped.head).toBe(h1.id);
    expect(s.equipped.weapon).toBe(w.id);
    expect(gear.wearing(s, s.loadouts[0])).toBe(true);
  });

  it('keeps what is worn where a piece of it is gone, and counts it missing', () => {
    const s = holding('CHAMPION_HELM', 'WARDEN_HELM');
    const [h1, h2] = s.items;
    gear.equip(s, h1.id);
    gear.saveLoadout(s, 2);
    gear.equip(s, h2.id);
    shop.recycle(s, h1.id);
    expect(gear.loadoutHeld(s, s.loadouts[2]!).missing).toBe(1);
    gear.wearLoadout(s, 2);
    expect(s.equipped.head).toBe(h2.id);
  });
});

describe('the bag', () => {
  it('marks what comes in as New until it is looked at, and forgets what leaves', () => {
    const s = holding('CHAMPION_HELM', 'WARDEN_HELM', 'CHAMPION_BLADE');
    const [a, b, c] = s.items;
    expect(s.newItems).toEqual([a.id, b.id, c.id]);
    gear.seeItem(s, a.id);
    expect(gear.isNew(s, a.id)).toBe(false);
    shop.recycle(s, b.id);
    expect(s.newItems).toEqual([c.id]);
    gear.seeAllItems(s);
    expect(s.newItems).toEqual([]);
  });

  it('compares a piece with the one it would replace, the weaker ring for a ring', () => {
    const s = holding('CHAMPION_HELM', 'WARDEN_HELM');
    const [a, b] = s.items;
    expect(gear.counterpart(s, a)).toBeNull();
    gear.equip(s, b.id);
    expect(gear.counterpart(s, a)?.id).toBe(b.id);
    expect(gear.counterpart(s, b)).toBeNull();
    const d = gear.delta(a, b);
    expect(d.score).toBeCloseTo(gear.score(a) - gear.score(b), 1);
  });

  it('recycles only the pieces chosen, never a worn or starred one', () => {
    const s = holding('CHAMPION_HELM', 'WARDEN_HELM', 'CHAMPION_BLADE');
    const [a, b, c] = s.items;
    gear.equip(s, a.id);
    gear.toggleFav(s, b.id);
    const r = shop.recycleSome(s, [a.id, b.id, c.id]);
    expect(r.count).toBe(1);
    expect(s.items.map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('recycles the issued kit once it is taken off, for what its score is worth', () => {
    const s = defaults();
    gear.issueKit(s);
    const kit = s.items.filter((x) => gear.defOf(x)?.issued);
    expect(kit.length).toBe(5);
    const off = kit.find((x) => !gear.slotOf(s, x)) ?? kit[0];
    if (gear.slotOf(s, off)) gear.unequip(s, gear.slotOf(s, off)!);
    const v = shop.scrapValue(off);
    expect(v).toBeGreaterThan(0);
    expect(shop.recycle(s, off.id)).toBe(v);
    expect(s.items.some((x) => x.id === off.id)).toBe(false);
  });
});

describe('properties in a fight', () => {
  it('adds a property in the units the fight reads: points for a chance, a fraction for a multiplier', () => {
    const s = holding('CHAMPION_BLADE', 'CHAMPION_BREASTPLATE');
    const [blade, plate] = s.items;
    const b = gear.rollBonuses([blade, plate]);
    // Critical Chance +4% is 4 points of critical chance; Defence +4% multiplies defence by 1.04.
    expect(b.crit).toBeCloseTo(blade.rolls[0], 5);
    expect(b.defense).toBeCloseTo(plate.rolls[0] / 100, 5);
  });
});
