import { describe, expect, it } from 'vitest';
import * as association from '@/core/association';
import * as forge from '@/core/forge';
import { dungeonById, PRACTICE_GATE } from '@/core/gates';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import { defaults, parse } from '@/core/save';
import * as shop from '@/core/shop';
import { claim } from '@/core/quests';
import type { Rank } from '@/core/types';
import { RANKS } from '@/core/types';
import { rng } from '@/core/util';
import { ALLOYS, BLUEPRINTS, FAMILIARITY, FAMILIARITY_MAX, PARTS, RECIPE, SALVAGE } from '@/data/forge';
import { typicalHunter } from '../scripts/hunters';
import { walk } from './walk';

const now = Date.parse('2026-02-04T12:00:00');

/** A hunter who knows a design and holds plenty of everything its recipe asks. */
function smith(defId: string) {
  const s = defaults();
  forge.learn(s, defId);
  s.wallet.shards = 1e6;
  for (const m of forge.allMaterials()) forge.give(s, { [m.id]: 1000 });
  return s;
}

describe('the recipe', () => {
  it('takes alloys of its rarity and the one below, its part, and shards; a set’s piece takes its home Gate’s trophy', () => {
    for (const r of RANKS) {
      const d = gear.ofRank(r).find((x) => !x.set && x.slot === 'Weapon')!;
      const i = RANKS.indexOf(r);
      const c = forge.recipe(d);
      expect(c.mats[ALLOYS[r].id]).toBe(RECIPE.alloy[i]);
      if (i > 0) expect(c.mats[ALLOYS[RANKS[i - 1]].id]).toBe(RECIPE.lower[i]);
      expect(c.mats[PARTS.bone.id]).toBe(RECIPE.part[i]);
      expect(c.shards).toBe(shop.gateShards(r, RECIPE.shards));
    }
    const piece = gear.setPieces('Demon Lord')[0];
    expect(forge.recipe(piece).mats[forge.trophyOfSet('Demon Lord')!]).toBe(RECIPE.trophy);
    // Armour takes hide; off-hands and jewellery take mana cores.
    expect(forge.partFor('Chest')).toBe(PARTS.hide.id);
    expect(forge.partFor('Ring')).toBe(PARTS.core.id);
  });

  it('names every trophy apart, even where one boss rules two home Gates', () => {
    const names = [...forge.trophyTable().values()].map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('forging', () => {
  const D = gear.ofRank('C').find((x) => !x.set && (x.rolls ?? []).length > 0)!;

  it('needs the blueprint, pays the recipe exactly, and rolls a new piece every time', () => {
    const s = smith(D.id);
    const before = { shards: s.wallet.shards, mats: { ...s.materials } };
    const a = forge.forge(s, D.id, 'a')!;
    const b = forge.forge(s, D.id, 'b')!;
    expect(a.defId).toBe(D.id);
    expect(a.q).not.toBe(b.q);
    const c = forge.recipe(D);
    expect(s.wallet.shards).toBe(before.shards - 2 * c.shards);
    for (const [k, n] of Object.entries(c.mats)) expect(forge.held(s, k)).toBe(before.mats[k] - 2 * n);
    expect(s.stats.crafted).toBe(2);
    expect(gear.isNew(s, a.id)).toBe(true);
    const none = defaults();
    none.wallet.shards = 1e6;
    forge.give(none, c.mats);
    expect(forge.forge(none, D.id)).toBeNull();
  });

  it('is refused when anything is short, and nothing is taken', () => {
    const s = defaults();
    forge.learn(s, D.id);
    const c = forge.recipe(D);
    forge.give(s, c.mats);
    s.wallet.shards = c.shards - 1;
    expect(forge.canForge(s, D)).toBe(false);
    expect(forge.forge(s, D.id)).toBeNull();
    expect(s.wallet.shards).toBe(c.shards - 1);
    expect(forge.held(s, ALLOYS.C.id)).toBe(c.mats[ALLOYS.C.id]);
  });

  it('lifts the floor of every roll by the design’s familiarity', () => {
    const s = smith(D.id);
    s.familiarity[D.id] = FAMILIARITY.at[FAMILIARITY_MAX - 1];
    const floor = FAMILIARITY.floor * FAMILIARITY_MAX;
    expect(forge.floorOf(s, D.id)).toBeCloseTo(floor, 6);
    for (let k = 0; k < 40; k++) {
      const it = forge.forge(s, D.id, `f${k}`)!;
      expect(it.q).toBeGreaterThanOrEqual(gear.Q_LOW + (gear.Q_HIGH - gear.Q_LOW) * floor - 0.01);
      (D.rolls ?? []).forEach((r, i) => expect(it.rolls[i]).toBeGreaterThanOrEqual(r.min + (r.max - r.min) * floor - 0.01));
    }
  });
});

describe('recycling', () => {
  it('gives back a share of the recipe’s alloy and part, and half the alloy its upgrades took', () => {
    const d = gear.ofRank('B').find((x) => x.slot === 'Weapon')!;
    const s = smith(d.id);
    const it = forge.forge(s, d.id, 'r')!;
    const i = RANKS.indexOf('B');
    expect(forge.salvage(it)).toEqual({
      [ALLOYS.B.id]: Math.round(RECIPE.alloy[i] * SALVAGE.alloy),
      [PARTS.bone.id]: Math.round(RECIPE.part[i] * SALVAGE.part),
    });
    s.items[s.items.length - 1].q = gear.Q_LOW;
    forge.upgrade(s, it.id);
    forge.upgrade(s, it.id);
    const up = s.items.find((x) => x.id === it.id)!;
    expect(forge.salvage(up)[ALLOYS.B.id]).toBeGreaterThan(forge.salvage(it)[ALLOYS.B.id]);
    const held = forge.held(s, ALLOYS.B.id);
    expect(forge.recycle(s, it.id)).toEqual(forge.salvage(up));
    expect(forge.held(s, ALLOYS.B.id)).toBe(held + forge.salvage(up)[ALLOYS.B.id]);
    expect(s.wallet.shards).toBeLessThan(1e6);
  });

  it('never recycles what is worn', () => {
    const s = defaults();
    const it = gear.grant(s, gear.ofRank('C')[0].id, 'w')!;
    gear.equip(s, it.id);
    expect(forge.recycle(s, it.id)).toBeNull();
    expect(s.items).toHaveLength(1);
  });
});

describe('blueprints', () => {
  it('are left of the kind of piece known fewest of, never one already known', () => {
    const s = defaults();
    const seen = new Set<string>();
    const r = rng('bp');
    for (let k = 0; k < 9; k++) {
      const id = forge.leaveBlueprint(s, 'C', r).blueprint!;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    // The first nine at a rarity are one of every kind of piece.
    expect(new Set([...seen].map((id) => gear.gearDef(id)!.slot)).size).toBe(9);
  });

  it('fill an empty slot before bettering a full one', () => {
    const s = defaults();
    // Every kind of piece but the amulet known at Rare: an Epic blueprint goes to the amulet first.
    for (const slot of ['Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Weapon', 'Off-Hand', 'Ring']) forge.learn(s, gear.ofRank('C').find((d) => d.slot === slot)!.id);
    const id = forge.leaveBlueprint(s, 'B', rng('weak')).blueprint!;
    expect(gear.gearDef(id)!.slot).toBe('Amulet');
  });

  it('are paid for a rank claimed, of its grade', () => {
    const s = defaults();
    s.hunter.level = 10;
    const r = claim(s)!;
    expect(r.to.key).toBe('D');
    expect(r.blueprints).toHaveLength(BLUEPRINTS.rank);
    for (const id of r.blueprints) {
      expect(gear.gearDef(id)!.rank).toBe('D');
      expect(forge.knows(s, id)).toBe(true);
    }
    expect(claim(s)).toBeNull();
  });

  it('come as alloy once every design of a rarity is known', () => {
    const s = defaults();
    for (const d of gear.ofRank('E')) forge.learn(s, d.id);
    const got = forge.leaveBlueprint(s, 'E', rng('all'));
    expect(got.blueprint).toBeNull();
    expect(got.mats).toEqual({ [ALLOYS.E.id]: BLUEPRINTS.known });
    expect(forge.held(s, ALLOYS.E.id)).toBe(BLUEPRINTS.known);
  });

  it('are known for every design a save held before the Forge', () => {
    const old = defaults() as unknown as Record<string, unknown>;
    old.v = 7;
    const def = gear.ofRank('B')[0];
    old.items = [{ id: 'x', defId: def.id, q: 1, rolls: [] }, { id: 'k', defId: gear.ISSUED[0].id, q: 1, rolls: [] }];
    delete old.blueprints;
    const s = parse(JSON.stringify(old))!;
    expect(s.blueprints).toEqual([def.id]);
    expect(s.materials).toEqual({});
  });
});

describe('what a run leaves', () => {
  it('a clear leaves alloys of the Gate’s grade and the one below, parts, and on a first clear a blueprint', () => {
    const s = typicalHunter(27, 'C', 'spoils');
    const d = dungeonById('DNG-016')!;
    expect(d.rank).toBe('C');
    const run = raid.begin(s, d, now);
    expect(walk(s, d, now).won).toBe(true);
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(res.mats[ALLOYS.C.id]).toBeGreaterThan(0);
    expect((res.mats[PARTS.hide.id] ?? 0) + (res.mats[PARTS.bone.id] ?? 0) + (res.mats[PARTS.core.id] ?? 0)).toBeGreaterThan(0);
    // The first clear's, and one for each Feat met for the first time and for the boss felled the way its condition asks.
    expect(res.blueprints).toHaveLength(1 + res.feats.fresh.length + (run.drops ?? []).filter((x) => x.boss).length);
    expect(forge.knows(s, res.blueprints[0])).toBe(true);
    for (const [k, n] of Object.entries(res.mats)) expect(forge.held(s, k)).toBe(n);
  });

  it('a party carried out leaves with nothing; the weapon still grows familiar', () => {
    const s = typicalHunter(27, 'C', 'carried');
    const d = dungeonById('DNG-016')!;
    const w = forge.weaponOf(s)!;
    const was = forge.familiarityOf(s, w);
    const run = raid.begin(s, d, now);
    run.felled.push(...d.mobs);
    run.lost = true;
    const res = raid.finish(s, d, run, 'defeated', now);
    expect(res.mats).toEqual({});
    expect(res.blueprints).toEqual([]);
    expect(res.familiarity).toMatchObject({ defId: w, from: was, to: was + d.mobs.length });
  });

  it('the Practice Gate pays a ring and the makings of a first piece', () => {
    const s = defaults();
    gear.issueKit(s);
    raid.begin(s, PRACTICE_GATE, now);
    walk(s, PRACTICE_GATE, now);
    const res = raid.finish(s, PRACTICE_GATE, s.gates.raid!, 'cleared', now);
    expect(res.loot.map((it) => gear.defOf(it)!.slot)).toEqual(['Ring']);
    expect(res.mats[ALLOYS.E.id]).toBe(RECIPE.alloy[0]);
    expect(res.familiarity).toBeNull();
  });
});

describe('weapon familiarity', () => {
  it('ranks at its thresholds and adds to attack and magic while the weapon is worn', () => {
    const s = defaults();
    const w = gear.grant(s, gear.ofRank('C').find((d) => d.slot === 'Weapon')!.id, 'w')!;
    const bare = raid.heroSpec(s, now).bonus ?? {};
    gear.equip(s, w.id);
    expect(forge.grow(s, w.defId, FAMILIARITY.at[1])).toMatchObject({ rankFrom: 0, rankTo: 2 });
    expect(forge.familiarityRank(s, w.defId)).toBe(2);
    const spec = raid.heroSpec(s, now).bonus ?? {};
    expect((spec.patk ?? 0) - (bare.patk ?? 0)).toBeCloseTo(FAMILIARITY.bonus * 2, 6);
    expect((spec.mpow ?? 0) - (bare.mpow ?? 0)).toBeCloseTo(FAMILIARITY.bonus * 2, 6);
    expect(forge.familiarity(s, w.defId)).toMatchObject({ rank: 2, from: FAMILIARITY.at[1], next: FAMILIARITY.at[2] });
    // Only weapons grow familiar.
    expect(forge.grow(s, gear.ofRank('C').find((d) => d.slot === 'Head')!.id, 50)).toBeNull();
  });
});

describe('tracking a material', () => {
  it('tags and untags it, and marks the Gates that leave it', () => {
    const s = defaults();
    const d = dungeonById('DNG-049')!;
    expect(forge.trackedAt(s, d)).toEqual([]);
    expect(forge.toggleTrack(s, ALLOYS.S.id)).toBe(true);
    expect(forge.toggleTrack(s, forge.trophyOfSet('Demon Lord')!)).toBe(true);
    expect(forge.trackedAt(s, d)).toEqual([ALLOYS.S.id, forge.trophyOfSet('Demon Lord')]);
    // The grade above leaves it as its lower alloy; a Gate two grades down does not.
    expect(forge.trackedAt(s, dungeonById('DNG-016')!)).toEqual([]);
    expect(forge.sourcesOf(dungeonById('DNG-045')!)).not.toContain(ALLOYS.S.id);
    // Its creatures' families say which parts it leaves; Ember only at an Ascension level.
    expect(forge.sourcesOf(d)).toContain(PARTS.core.id);
    expect(forge.sourcesOf(d)).not.toContain(forge.EMBER.id);
    expect(forge.sourcesOf(d, 2)).toContain(forge.EMBER.id);
    expect(forge.toggleTrack(s, ALLOYS.S.id)).toBe(false);
    expect(s.tracked).toEqual([forge.trophyOfSet('Demon Lord')]);
    expect(forge.toggleTrack(s, 'nothing')).toBe(false);
  });
});

describe('tracking what a recipe is short of', () => {
  it('tracks every missing material at once, and the same tap again stops tracking them', () => {
    const d = gear.setPieces('Demon Lord')[0];
    const s = defaults();
    const c = forge.recipe(d);
    forge.give(s, { [ALLOYS.S.id]: 999 });
    const short = forge.missing(s, c);
    expect(short).not.toContain(ALLOYS.S.id);
    expect(short).toContain(forge.trophyOfSet('Demon Lord'));
    // Iron Scrap is no part of a Legendary recipe: tracked besides, it is left alone.
    forge.toggleTrack(s, ALLOYS.E.id);
    expect(forge.trackMissing(s, c)).toBe(true);
    for (const id of short) expect(forge.isTracked(s, id)).toBe(true);
    expect(forge.trackMissing(s, c)).toBe(false);
    for (const id of short) expect(forge.isTracked(s, id)).toBe(false);
    // What was tracked besides is left as it was.
    expect(s.tracked).toEqual([ALLOYS.E.id]);
    // Nothing short, nothing to track.
    for (const [id, n] of Object.entries(c.mats)) forge.give(s, { [id]: n });
    expect(forge.missing(s, c)).toEqual([]);
    expect(forge.trackMissing(s, c)).toBe(false);
  });
});

describe('Ryn’s blueprint', () => {
  it('pays a blueprint of the job’s grade, one not yet known', () => {
    const s = typicalHunter(27, 'C', 'ryn');
    s.gates.cleared.push(PRACTICE_GATE.id);
    const q = association.issue(s)!;
    q.reward = { kind: 'blueprint', n: 1 };
    q.got = q.need;
    const paid = association.report(s)!;
    expect(paid.blueprint).not.toBeNull();
    expect(gear.gearDef(paid.blueprint!)!.rank as Rank).toBe(q.grade);
    expect(forge.knows(s, paid.blueprint!)).toBe(true);
  });
});
