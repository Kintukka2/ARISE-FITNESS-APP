/**
 * The Forge (`data/forge.ts` holds its numbers). Gear is made from blueprints and materials: a
 * blueprint, once learned, forges its design as often as the materials allow, every piece rolled
 * anew, and a piece recycled gives materials back. Upgrades take alloys and Mana Shards. The weapon a
 * hunter carries grows familiar: each rank adds to attack and magic while it is worn, and lifts the
 * floor of every roll when its design is forged.
 *
 * Everything a run leaves is settled in `raid.finish`, which calls `spoils` here. Nothing in a fight
 * reads this module except `familiarityBonus`, through `raid.heroSpec`.
 */
import { DUNGEONS } from '@/data/dungeons';
import { ENEMIES } from '@/data/enemies';
import { ALLOYS, BLUEPRINTS, EMBER, FAMILIARITY, FAMILIARITY_MAX, FAMILY_PART as PART_FOR_FAMILY, PART_FOR, PARTS, RECIPE, SALVAGE, UPGRADE_COST, type Material, type PartKey } from '@/data/forge';
import { OVERCHARGE } from '@/data/ascension';
import { SETS, UPGRADE } from '@/data/sets';
import { ALL_GEAR, defOf, equippedIn, gearDef, grant, ofRank, Q_HIGH, Q_LOW, RARITY, setPieces, SLOTS, upgradeStep } from './gear';
import * as shop from './shop';
import type { Dungeon, GearDef, Item, Rank, Save } from './types';
import { RANKS } from './types';
import { rng, uid } from './util';

export { ALLOYS, EMBER, FAMILIARITY, FAMILIARITY_MAX, PARTS, RECIPE };

// ------------------------------------------------------------------ materials

const enemyName = (id: string) => ENEMIES.find((e) => e.id === id)?.name ?? id;

/** The trophies: one to the boss of each Gate a set calls home, by that Gate's id. */
let trophies: Map<string, Material> | null = null;
export function trophyTable(): Map<string, Material> {
  if (trophies) return trophies;
  trophies = new Map();
  const homes = [...new Set(SETS.map((x) => x.home))].map((id) => DUNGEONS.find((x) => x.id === id)).filter((d): d is Dungeon => !!d);
  for (const d of homes) {
    // A boss that rules two home Gates is told apart by the Gate's grade.
    const twin = homes.some((x) => x !== d && enemyName(x.boss) === enemyName(d.boss));
    trophies.set(d.id, {
      id: `trophy-${d.id}`, name: `${enemyName(d.boss)} Trophy${twin ? ` (${d.rank}-Rank)` : ''}`, kind: 'trophy',
      desc: `Taken from the boss of ${d.name}. The sets it is home to are forged with it.`,
    });
  }
  return trophies;
}

/** Every material, alloys first, then the parts, the trophies and the Ember. */
export function allMaterials(): Material[] {
  return [...RANKS.map((r) => ALLOYS[r]), ...Object.values(PARTS), ...trophyTable().values(), EMBER];
}
export const materialById = (id: string): Material | undefined => allMaterials().find((m) => m.id === id);

export const alloyId = (r: Rank) => ALLOYS[r].id;
export const partId = (k: PartKey) => PARTS[k].id;
/** The part a piece of this kind is made of. */
export const partFor = (slot: string): string => partId(PART_FOR[slot] ?? 'hide');
/** The trophy a set's pieces are forged with: its home Gate's boss's. */
export const trophyOfSet = (set: string | undefined) => {
  const home = SETS.find((x) => x.id === set)?.home;
  return home ? trophyTable().get(home)?.id ?? null : null;
};
/** The trophy a Gate's clear leaves, if its sets call it home (a block of the Spire, the Gate whose shape it takes). */
export const trophyAt = (d: Dungeon) => trophyTable().get(d.shape ?? d.id)?.id ?? null;

export type Bundle = Record<string, number>;

export const held = (s: Save, id: string) => s.materials?.[id] ?? 0;

/** Add materials to what is held. Mutates. */
export function give(s: Save, b: Bundle) {
  s.materials ??= {};
  for (const [k, n] of Object.entries(b)) if (n > 0) s.materials[k] = (s.materials[k] ?? 0) + Math.round(n);
}

/** Bundles added together. */
export function addUp(...bs: Bundle[]): Bundle {
  const out: Bundle = {};
  for (const b of bs) for (const [k, n] of Object.entries(b)) if (n > 0) out[k] = (out[k] ?? 0) + n;
  return out;
}

/** What it takes: Mana Shards and materials. */
export interface Cost { shards: number; mats: Bundle }

/** Each material a cost asks for, what is held and what is needed. */
export function lines(s: Save, c: Cost): { id: string; have: number; need: number }[] {
  return Object.entries(c.mats).map(([id, need]) => ({ id, have: held(s, id), need }));
}

export const affords = (s: Save, c: Cost) => s.wallet.shards >= c.shards && lines(s, c).every((x) => x.have >= x.need);

/** Pay a cost, all of it or none. False if anything is short. Mutates. */
export function spend(s: Save, c: Cost): boolean {
  if (!affords(s, c) || !shop.pay(s, c.shards)) return false;
  for (const [id, n] of Object.entries(c.mats)) s.materials[id] = held(s, id) - n;
  return true;
}

const idx = (r: Rank | string) => Math.max(0, RANKS.indexOf(r as Rank));
const below = (r: Rank): Rank | null => (idx(r) > 0 ? RANKS[idx(r) - 1] : null);

// ------------------------------------------------------------------ tracking

/** Whether the hunter has tagged a material to find. */
export const isTracked = (s: Save, id: string) => (s.tracked ?? []).includes(id);

/** Tag a material to find, or untag it. Returns whether it is tagged now. Mutates. */
export function toggleTrack(s: Save, id: string): boolean {
  if (!materialById(id)) return false;
  s.tracked ??= [];
  const i = s.tracked.indexOf(id);
  if (i >= 0) { s.tracked.splice(i, 1); return false; }
  s.tracked.push(id);
  return true;
}

/**
 * The materials a Gate leaves, as the board marks them: its grade's alloy and the grade below's, the
 * parts its creatures' families leave, its boss's trophy where its sets call it home, and Ember when it
 * is walked into at an Ascension `level`. Every clear leaves one of each part besides; those are not
 * where a part is found.
 */
export function sourcesOf(d: Dungeon, level = 0): string[] {
  const g = idx(d.rank);
  const out = [alloyId(RANKS[g])];
  if (g > 0) out.push(alloyId(RANKS[g - 1]));
  const fams = [...d.mobs, d.elite, d.boss].map((id) => ENEMIES.find((e) => e.id === id)?.family).filter((f): f is string => !!f);
  for (const k of new Set(fams.map((f) => PART_FOR_FAMILY[f] ?? 'hide'))) out.push(partId(k));
  const t = trophyAt(d);
  if (t) out.push(t);
  if (level > 0) out.push(EMBER.id);
  return out;
}

/** The materials a cost is short of. */
export const missing = (s: Save, c: Cost) => lines(s, c).filter((x) => x.have < x.need).map((x) => x.id);

/**
 * Track every material a cost is short of, or, when all of them are tracked already, stop tracking
 * them. Returns whether they are tracked now. Mutates.
 */
export function trackMissing(s: Save, c: Cost): boolean {
  const ids = missing(s, c);
  if (!ids.length) return false;
  s.tracked ??= [];
  if (ids.every((id) => isTracked(s, id))) {
    s.tracked = s.tracked.filter((id) => !ids.includes(id));
    return false;
  }
  for (const id of ids) if (!isTracked(s, id)) s.tracked.push(id);
  return true;
}

/** The tracked materials a Gate leaves. */
export const trackedAt = (s: Save, d: Dungeon, level = 0) => (s.tracked?.length ? sourcesOf(d, level).filter((id) => isTracked(s, id)) : []);

// ------------------------------------------------------------------ blueprints

export const knows = (s: Save, defId: string) => (s.blueprints ?? []).includes(defId);

/** Learn a blueprint. False if it was known already. Mutates. */
export function learn(s: Save, defId: string): boolean {
  if (!gearDef(defId) || knows(s, defId)) return false;
  (s.blueprints ??= []).push(defId);
  return true;
}

/** Every design that can be forged: issued kit is the Association's, and has no blueprint. */
export const FORGEABLE = ALL_GEAR;

/**
 * A blueprint to leave, at a rarity: a design not yet known, of the kind of piece whose best blueprint
 * known is the weakest (none at all first), and among those the kind known fewest of at that rarity,
 * so the first few cover the figure and an empty slot is filled before a full one is bettered. From
 * `pool` when it is given (a set's pieces). Null when every design there is known.
 */
export function pickBlueprint(s: Save, rank: Rank, r: () => number, pool?: GearDef[]): string | null {
  const all = pool ?? ofRank(rank);
  const unknown = all.filter((d) => !knows(s, d.id));
  if (!unknown.length) return null;
  const best = (slot: string) => Math.max(-1, ...(s.blueprints ?? []).map((id) => gearDef(id)).filter((d) => d?.slot === slot).map((d) => idx(d!.rank)));
  const known = (slot: string) => all.filter((d) => d.slot === slot && knows(s, d.id)).length;
  const weight = (d: GearDef) => best(d.slot) * 100 + known(d.slot);
  const least = Math.min(...unknown.map(weight));
  const pick = unknown.filter((d) => weight(d) === least);
  return pick[Math.floor(r() * pick.length)]?.id ?? null;
}

/** A blueprint left at a rarity, learned; or, if every design there is known, its alloy. Mutates. */
export function leaveBlueprint(s: Save, rank: Rank, r: () => number, pool?: GearDef[]): { blueprint: string | null; mats: Bundle } {
  const id = pickBlueprint(s, rank, r, pool);
  if (id) { learn(s, id); return { blueprint: id, mats: {} }; }
  const mats = { [alloyId(rank)]: BLUEPRINTS.known };
  give(s, mats);
  return { blueprint: null, mats };
}

/**
 * A rank claimed: its grade's blueprints, as many as the rule says, of the kinds of piece known fewest
 * of, so a new grade starts with something to forge. Sovereign's grade is S. Mutates.
 */
export function rankBlueprints(s: Save, to: string): { blueprints: string[]; mats: Bundle } {
  const grade = (to === 'N' ? 'S' : to) as Rank;
  const r = rng(`arise|rank-blueprints|${to}|${s.hunter.regNo}|${s.hunter.name}`);
  const out = { blueprints: [] as string[], mats: {} as Bundle };
  for (let k = 0; k < BLUEPRINTS.rank; k++) {
    const got = leaveBlueprint(s, grade, r);
    if (got.blueprint) out.blueprints.push(got.blueprint);
    out.mats = addUp(out.mats, got.mats);
  }
  return out;
}

/** The blueprints of a set not yet known. */
export const setBlueprintsLeft = (s: Save, set: string) => setPieces(set).filter((d) => !knows(s, d.id));

// ------------------------------------------------------------------ recipes and forging

/** What forging a design takes. */
export function recipe(d: GearDef): Cost {
  const r = d.rank as Rank;
  const i = idx(r);
  const mats: Bundle = { [alloyId(r)]: RECIPE.alloy[i] };
  const lo = below(r);
  if (lo && RECIPE.lower[i]) mats[alloyId(lo)] = RECIPE.lower[i];
  mats[partFor(d.slot)] = RECIPE.part[i];
  const t = trophyOfSet(d.set);
  if (t) mats[t] = RECIPE.trophy;
  return { shards: shop.gateShards(r, RECIPE.shards), mats };
}

/** Whether a design can be forged now: its blueprint known and everything its recipe asks for held. */
export const canForge = (s: Save, d: GearDef) => knows(s, d.id) && affords(s, recipe(d));

/**
 * The designs that can be forged now and are rarer than what is worn where they go (or go where
 * nothing is worn): what the Forge tile calls the hunter to.
 */
export function betterForges(s: Save): GearDef[] {
  return FORGEABLE.filter((d) => {
    if (!canForge(s, d)) return false;
    const slots = SLOTS.filter((x) => x.accepts === d.slot).map((x) => equippedIn(s, x.key));
    return slots.some((it) => !it || idx(defOf(it)?.rank ?? 'E') < idx(d.rank) || !!defOf(it)?.issued);
  });
}

/** The floor of a forged roll, as a share of the way from worst to best: what familiarity with the design has raised it to. */
export const floorOf = (s: Save, defId: string) => FAMILIARITY.floor * familiarityRank(s, defId);

/** The quality a forged piece of this design can roll, as 0–100 grades: from the familiar floor to the best. */
export const forgeRange = (s: Save, defId: string): [number, number] => [Math.round(floorOf(s, defId) * 100), 100];

/**
 * Forge a design: pay its recipe, roll a new piece of it, the floor of every roll raised by
 * familiarity, and put it in the bag, New. Null if the blueprint is not known or something is short. Mutates.
 */
export function forge(s: Save, defId: string, id = uid('it')): Item | null {
  const d = gearDef(defId);
  if (!d || d.issued || !knows(s, defId) || !spend(s, recipe(d))) return null;
  const it = grant(s, defId, id, floorOf(s, defId));
  if (it) s.stats.crafted = (s.stats.crafted ?? 0) + 1;
  return it;
}

// ------------------------------------------------------------------ recycling

/** What recycling a piece gives back: a share of its recipe's alloy and part, and of what its upgrades took. */
export function salvage(it: Item): Bundle {
  const d = defOf(it);
  if (!d) return {};
  if (d.issued) return { [alloyId('E')]: SALVAGE.issued };
  const r = d.rank as Rank;
  const i = idx(r);
  const out: Bundle = {};
  const steps = Math.max(0, (it.up ?? 0) - (it.over ?? 0));
  const over = it.over ?? 0;
  const master = it.master ? SALVAGE.masterwork : 1;
  out[alloyId(r)] = Math.max(1, Math.round((RECIPE.alloy[i] * SALVAGE.alloy) * master + (steps * UPGRADE_COST.alloy[i] + over * UPGRADE_COST.overAlloy) * SALVAGE.upgrades));
  out[partFor(d.slot)] = Math.max(1, Math.round(RECIPE.part[i] * SALVAGE.part * master));
  return out;
}

/** Recycle a held piece that is not worn. Returns what it gave, or null. Mutates. */
export function recycle(s: Save, itemId: string): Bundle | null {
  const it = s.items.find((i) => i.id === itemId);
  if (!it || !defOf(it) || Object.values(s.equipped).includes(itemId)) return null;
  const got = salvage(it);
  s.items = s.items.filter((i) => i.id !== itemId);
  s.favourites = s.favourites.filter((f) => f !== itemId);
  s.newItems = (s.newItems ?? []).filter((f) => f !== itemId);
  give(s, got);
  return got;
}

/** What these pieces would give, together. */
export const salvageOf = (items: Item[]) => addUp(...items.map(salvage));

/** Recycle the pieces chosen, skipping any worn or starred. Returns how many went and what they gave. Mutates. */
export function recycleSome(s: Save, ids: string[]): { count: number; got: Bundle } {
  const parts: Bundle[] = [];
  for (const id of ids) {
    if (s.favourites.includes(id)) continue;
    const got = recycle(s, id);
    if (got) parts.push(got);
  }
  return { count: parts.length, got: addUp(...parts) };
}

// ------------------------------------------------------------------ upgrades

/** The shards a step adds to a piece of a rarity is worth, at the upgrade rate, times the share upgrades charge. */
const stepShards = (r: Rank) => Math.max(5, Math.round((RARITY[r].score * (Q_HIGH - Q_LOW) * UPGRADE.share * UPGRADE.rate * UPGRADE_COST.shards) / 5) * 5);
const overShards = (r: Rank, k: number) => Math.max(5, Math.round((RARITY[r].score * (Q_HIGH - Q_LOW) * OVERCHARGE.share * UPGRADE.rate * UPGRADE_COST.shards * (1 + k)) / 5) * 5);

/** What the next upgrade step on a piece takes, `cap` steps past perfect allowed. Null when there is nothing left to raise. */
export function upgradeCost(it: Item, cap = 0): Cost | null {
  const d = defOf(it);
  const next = d ? upgradeStep(it, cap) : null;
  if (!d || !next) return null;
  const r = d.rank as Rank;
  if (next.over) return { shards: overShards(r, next.over), mats: { [alloyId(r)]: UPGRADE_COST.overAlloy, [EMBER.id]: UPGRADE_COST.ember * next.over } };
  return { shards: stepShards(r), mats: { [alloyId(r)]: UPGRADE_COST.alloy[idx(r)] } };
}

/** Take one upgrade step on a held piece. False if it cannot be raised or something is short. Mutates. */
export function upgrade(s: Save, itemId: string, cap = 0): boolean {
  const i = s.items.findIndex((x) => x.id === itemId);
  const it = s.items[i];
  const cost = it ? upgradeCost(it, cap) : null;
  const next = it ? upgradeStep(it, cap) : null;
  if (!cost || !next || !spend(s, cost)) return false;
  s.items[i] = next;
  return true;
}

// ------------------------------------------------------------------ familiarity

export const familiarityOf = (s: Save, defId: string) => s.familiarity?.[defId] ?? 0;

/** The rank a number of points reaches, 0 to the most. */
export const rankAt = (points: number) => FAMILIARITY.at.filter((n) => points >= n).length;
export const familiarityRank = (s: Save, defId: string) => rankAt(familiarityOf(s, defId));

/** Where a design's familiarity stands: its points, its rank, and the points of this rank and the next (null at the most). */
export function familiarity(s: Save, defId: string) {
  const points = familiarityOf(s, defId);
  const rank = rankAt(points);
  return { points, rank, from: rank ? FAMILIARITY.at[rank - 1] : 0, next: rank < FAMILIARITY_MAX ? FAMILIARITY.at[rank] : null };
}

/** What a rank adds to attack and magic while the weapon is worn, in the fight's units. */
export const bonusAt = (rank: number): Record<string, number> => (rank ? { patk: FAMILIARITY.bonus * rank, mpow: FAMILIARITY.bonus * rank } : {});

/** What the worn weapon's familiarity adds in a fight. */
export function familiarityBonus(s: Save): Record<string, number> {
  const w = equippedIn(s, 'weapon');
  return w ? bonusAt(familiarityRank(s, w.defId)) : {};
}

/** The design of the weapon worn, if any: what a run walks in carrying. */
export const weaponOf = (s: Save) => equippedIn(s, 'weapon')?.defId ?? null;

export interface FamiliarityMove { defId: string; from: number; to: number; rankFrom: number; rankTo: number }

/** Points toward a design's familiarity. Returns how far it moved, or null. Mutates. */
export function grow(s: Save, defId: string | null | undefined, n: number): FamiliarityMove | null {
  if (!defId || n <= 0 || defOf({ id: '', defId, q: 1, rolls: [] })?.slot !== 'Weapon') return null;
  s.familiarity ??= {};
  const from = familiarityOf(s, defId);
  const to = from + Math.round(n);
  s.familiarity[defId] = to;
  return { defId, from, to, rankFrom: rankAt(from), rankTo: rankAt(to) };
}
