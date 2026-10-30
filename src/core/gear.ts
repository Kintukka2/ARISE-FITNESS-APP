/**
 * Equipment: ten slots, six rarities. Every piece's core bonus rolls between
 * 75% and 125% of its design, and its unique properties roll inside their
 * ranges. Both are seeded off the item id, so a piece never changes unless it
 * is upgraded. Three-piece sets pay a bonus for two pieces worn, and for all three.
 */
import { EQUIPMENT, ISSUED } from '@/data/equipment';
import { SET_KEEP, setById, UPGRADE } from '@/data/sets';
import type { Attrs, GearDef, Item, Rank, Save, SlotKey, Stat } from './types';
import { STATS } from './types';
import { rng, round2, uid } from './util';

export const SLOTS: { key: SlotKey; name: string; accepts: string; side: 'l' | 'r' }[] = [
  { key: 'head', name: 'Head', accepts: 'Head', side: 'l' },
  { key: 'chest', name: 'Chest', accepts: 'Chest', side: 'l' },
  { key: 'hands', name: 'Hands', accepts: 'Hands', side: 'l' },
  { key: 'legs', name: 'Legs', accepts: 'Legs', side: 'l' },
  { key: 'feet', name: 'Feet', accepts: 'Feet', side: 'l' },
  { key: 'weapon', name: 'Weapon', accepts: 'Weapon', side: 'r' },
  { key: 'offhand', name: 'Off-Hand', accepts: 'Off-Hand', side: 'r' },
  { key: 'amulet', name: 'Amulet', accepts: 'Amulet', side: 'r' },
  { key: 'ring1', name: 'Ring I', accepts: 'Ring', side: 'r' },
  { key: 'ring2', name: 'Ring II', accepts: 'Ring', side: 'r' },
];

export const RARITY: Record<Rank, { name: string; score: number }> = {
  E: { name: 'Common', score: 8 },
  D: { name: 'Uncommon', score: 14 },
  C: { name: 'Rare', score: 24 },
  B: { name: 'Epic', score: 40 },
  A: { name: 'Heroic', score: 66 },
  S: { name: 'Legendary', score: 108 },
};

export const Q_LOW = 0.75;
export const Q_HIGH = 1.25;

const defs = new Map<string, GearDef>([...EQUIPMENT, ...ISSUED].map((d) => [d.id, d]));
export const gearDef = (id: string) => defs.get(id);
export const defOf = (it: Item | undefined | null) => (it ? defs.get(it.defId) : undefined);
export const ALL_GEAR = EQUIPMENT;
export { ISSUED };

export const slotsFor = (d: GearDef | undefined) => (d ? SLOTS.filter((s) => s.accepts === d.slot) : []);
export const ofRank = (r: Rank) => EQUIPMENT.filter((d) => d.rank === r);

/** Roll a new instance of a design. */
export function make(defId: string, id = uid('it')): Item {
  const d = defs.get(defId)!;
  const r = rng('arise|item|' + id);
  const q = d.issued ? 1 : round2(Q_LOW + r() * (Q_HIGH - Q_LOW));
  const rolls = (d.rolls ?? []).map((x) => round2(x.min + r() * (x.max - x.min)));
  return { id, defId, q, rolls };
}

/** The kit the Association hands over with the licence. Returns what was new. */
export function issueKit(s: Save): Item[] {
  const out: Item[] = [];
  for (const d of ISSUED) {
    if (s.items.some((i) => i.defId === d.id)) continue;
    const it = grant(s, d.id);
    if (it) out.push(it);
  }
  autoEquip(s);
  return out;
}

export function grant(s: Save, defId: string, id?: string): Item | null {
  if (!defs.has(defId)) return null;
  const it = make(defId, id);
  s.items.push(it);
  if (!s.found.includes(defId)) s.found.push(defId);
  return it;
}

export function score(it: Item): number {
  const d = defOf(it);
  return d ? round2(RARITY[d.rank].score * it.q) : 0;
}

export function coreOf(it: Item): Partial<Attrs> {
  const d = defOf(it);
  if (!d) return {};
  const out: Partial<Attrs> = {};
  for (const k of Object.keys(d.core) as Stat[]) out[k] = round2((d.core[k] ?? 0) * it.q);
  return out;
}

/** Quality as a 0–100 grade for display. */
export const quality = (it: Item) => Math.round(((it.q - Q_LOW) / (Q_HIGH - Q_LOW)) * 100);
export const rollTag = (it: Item) => (defOf(it)?.issued ? null : it.q >= Q_HIGH - 0.005 ? 'perfect' : it.q <= Q_LOW + 0.005 ? 'dead' : null);

export function equippedIn(s: Save, slot: SlotKey): Item | null {
  const id = s.equipped[slot];
  return id ? s.items.find((i) => i.id === id) ?? null : null;
}

export const slotOf = (s: Save, it: Item) => SLOTS.find((sl) => s.equipped[sl.key] === it.id)?.key ?? null;
export const worn = (s: Save) => SLOTS.map((sl) => equippedIn(s, sl.key)).filter((x): x is Item => !!x);

export function equip(s: Save, itemId: string, slot?: SlotKey): boolean {
  const it = s.items.find((i) => i.id === itemId);
  const fits = slotsFor(defOf(it));
  if (!it || !fits.length) return false;
  const held = slotOf(s, it);
  let target = slot && fits.some((f) => f.key === slot) ? slot : undefined;
  if (!target) target = fits.find((f) => !s.equipped[f.key])?.key;
  if (!target) target = fits.slice().sort((a, b) => score(equippedIn(s, a.key)!) - score(equippedIn(s, b.key)!))[0].key;
  if (held && held !== target) delete s.equipped[held];
  s.equipped[target] = it.id;
  return true;
}

export function unequip(s: Save, slot: SlotKey) {
  delete s.equipped[slot];
}

/** The pieces of a set the hunter holds, by design: what Auto Equip and the item sheet count. */
export const heldOf = (s: Save, set: string) => new Set(s.items.map((i) => defOf(i)).filter((d) => d?.set === set).map((d) => d!.id));

/**
 * Value used to rank pieces for auto-equip: score first, then the stat total. A
 * piece of a set the hunter holds two or more of leans a share of its rarity's
 * score higher for each other piece, so Auto Equip keeps a set together unless
 * something is a good deal better.
 */
function worth(s: Save, it: Item) {
  const d = defOf(it);
  const held = d?.set ? heldOf(s, d.set).size : 0;
  const lean = d && held >= 2 ? RARITY[d.rank].score * SET_KEEP * (held - 1) : 0;
  return (score(it) + lean) * 1000 + Object.values(coreOf(it)).reduce((a, b) => a + (b ?? 0), 0);
}

/** The best piece for every slot: a plan of slot → item id (or null to clear). */
export function autoPlan(s: Save): Partial<Record<SlotKey, string | null>> {
  const plan: Partial<Record<SlotKey, string | null>> = {};
  const groups = new Map<string, SlotKey[]>();
  for (const sl of SLOTS) groups.set(sl.accepts, [...(groups.get(sl.accepts) ?? []), sl.key]);
  for (const [type, keys] of groups) {
    const best = s.items.filter((i) => defOf(i)?.slot === type).sort((a, b) => worth(s, b) - worth(s, a)).slice(0, keys.length);
    const settled: Partial<Record<SlotKey, string>> = {};
    const placed = new Set<string>();
    for (const k of keys) {
      const cur = s.equipped[k];
      if (cur && best.some((b) => b.id === cur)) { settled[k] = cur; placed.add(cur); }
    }
    const spare = best.filter((b) => !placed.has(b.id));
    for (const k of keys) if (!settled[k]) settled[k] = spare.shift()?.id;
    for (const k of keys) if ((settled[k] ?? null) !== (s.equipped[k] ?? null)) plan[k] = settled[k] ?? null;
  }
  return plan;
}

export const upgradeCount = (s: Save) => Object.keys(autoPlan(s)).length;

export function autoEquip(s: Save): number {
  const plan = autoPlan(s);
  for (const [k, v] of Object.entries(plan) as [SlotKey, string | null][]) {
    if (v) s.equipped[k] = v;
    else delete s.equipped[k];
  }
  return Object.keys(plan).length;
}

/** Would this piece improve on the weakest thing worn where it goes? */
export function beatsWorn(s: Save, it: Item): boolean {
  const fits = slotsFor(defOf(it));
  if (!fits.length || slotOf(s, it)) return false;
  let weakest = Infinity;
  for (const f of fits) {
    const w = equippedIn(s, f.key);
    if (!w) return true;
    weakest = Math.min(weakest, worth(s, w));
  }
  return worth(s, it) > weakest;
}

/** Empty slots the bag holds something for. */
export function offers(s: Save): SlotKey[] {
  const spare = new Map<string, number>();
  for (const it of s.items) {
    if (slotOf(s, it)) continue;
    const t = defOf(it)?.slot;
    if (t) spare.set(t, (spare.get(t) ?? 0) + 1);
  }
  const out: SlotKey[] = [];
  for (const sl of SLOTS) {
    if (s.equipped[sl.key]) continue;
    const n = spare.get(sl.accepts) ?? 0;
    if (n > 0) { out.push(sl.key); spare.set(sl.accepts, n - 1); }
  }
  return out;
}

/** Summed score of everything worn. */
export const power = (s: Save) => round2(worn(s).reduce((n, it) => n + score(it), 0));

/** Attributes plus what is worn, capped at the boost ceiling. */
export function boosted(base: Attrs, items: Item[], bonus: Partial<Attrs> = {}, cap = 200): Attrs {
  const out = { ...base };
  for (const k of STATS) out[k] += bonus[k] ?? 0;
  for (const it of items) {
    const c = coreOf(it);
    for (const k of STATS) out[k] += c[k] ?? 0;
  }
  for (const k of STATS) out[k] = round2(Math.min(cap, out[k]));
  return out;
}

export function remove(s: Save, itemId: string) {
  const it = s.items.find((i) => i.id === itemId);
  if (!it) return;
  const at = slotOf(s, it);
  if (at) delete s.equipped[at];
  s.items = s.items.filter((i) => i.id !== itemId);
  s.favourites = s.favourites.filter((f) => f !== itemId);
}

export function toggleFav(s: Save, id: string): boolean {
  const i = s.favourites.indexOf(id);
  if (i >= 0) { s.favourites.splice(i, 1); return false; }
  s.favourites.push(id);
  return true;
}

/** Roll-stat names to the derived combat stat they raise. */
export const ROLL_EFFECT: Record<string, { key: string; pct: boolean }> = {
  'Critical Chance': { key: 'crit', pct: false },
  'Defense': { key: 'defense', pct: true },
  'Accuracy': { key: 'accuracy', pct: false },
  'Evasion': { key: 'evasion', pct: false },
  'Status Chance': { key: 'statusChance', pct: false },
  'Status Potency': { key: 'statusChance', pct: false },
  'Status Save': { key: 'statusSave', pct: false },
  'Resistance': { key: 'resist', pct: true },
  'Physical Attack': { key: 'patk', pct: true },
  'Magic Power': { key: 'mpow', pct: true },
  'Initiative': { key: 'initiative', pct: false },
  'Max HP': { key: 'maxHp', pct: true },
  'Healing Received': { key: 'recovery', pct: true },
};

/** Every worn piece's unique rolls, summed by derived stat. Pct values are fractions. */
export function rollBonuses(items: Item[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const d = defOf(it);
    (d?.rolls ?? []).forEach((r, i) => {
      const eff = ROLL_EFFECT[r.stat];
      if (!eff) return;
      const v = it.rolls[i] ?? r.min;
      out[eff.key] = (out[eff.key] ?? 0) + (r.pct ? v / 100 : v);
    });
  }
  return out;
}

// ------------------------------------------------------------------ sets

export const setPieces = (set: string) => EQUIPMENT.filter((d) => d.set === set);

/** Sets among these pieces, with how many different pieces of each. Two of the same design count once. */
export function setsIn(items: Item[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const it of items) {
    const d = defOf(it);
    if (!d?.set) continue;
    if (!seen.has(d.set)) seen.set(d.set, new Set());
    seen.get(d.set)!.add(d.id);
  }
  return new Map([...seen].map(([k, v]) => [k, v.size]));
}

/** What the sets among worn pieces pay, summed by derived stat, in the units of `rollBonuses`. */
export function setBonuses(items: Item[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of setsIn(items)) {
    const set = setById(id);
    if (!set) continue;
    for (const b of [n >= 2 ? set.two : {}, n >= 3 ? set.three : {}]) for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** Bonuses added together, as a hunter carries them into a fight. */
export function sumBonuses(...xs: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) for (const [k, v] of Object.entries(x)) out[k] = (out[k] ?? 0) + v;
  return out;
}

const BONUS_NAMES: Record<string, string> = {
  patk: 'attack', mpow: 'magic', defense: 'defence', resist: 'resistance', maxHp: 'maximum HP', recovery: 'healing between fights',
  crit: 'critical chance', accuracy: 'accuracy', evasion: 'evasion', initiative: 'initiative', statusChance: 'status chance', statusSave: 'status save',
};
const FRACTION = new Set(['patk', 'mpow', 'defense', 'resist', 'maxHp', 'recovery']);

/** Pairs that read as one when they are equal. */
const PAIRS: [string, string][] = [['patk', 'mpow'], ['defense', 'resist']];

/** A bonus in words, read from its numbers: "+8% attack and magic", "+6 critical chance". */
export function bonusText(b: Record<string, number>): string {
  const amount = (k: string, v: number) => (FRACTION.has(k) ? `+${Math.round(v * 100)}%` : `+${v}`);
  const left = { ...b };
  const parts: string[] = [];
  for (const [x, y] of PAIRS) {
    if (left[x] === undefined || left[x] !== left[y]) continue;
    parts.push(`${amount(x, left[x])} ${BONUS_NAMES[x]} and ${BONUS_NAMES[y]}`);
    delete left[x];
    delete left[y];
  }
  for (const [k, v] of Object.entries(left)) parts.push(`${amount(k, v)} ${BONUS_NAMES[k] ?? k}`);
  return parts.join(', ');
}

// ------------------------------------------------------------------ upgrades

/** The piece one upgrade step on: its quality and every property a share of the way closer to their best. Null when there is nothing to raise. */
export function upgradeStep(it: Item): Item | null {
  const d = defOf(it);
  if (!d || d.issued) return null;
  const q = round2(Math.min(Q_HIGH, it.q + (Q_HIGH - Q_LOW) * UPGRADE.share));
  const rolls = (d.rolls ?? []).map((r, i) => round2(Math.min(r.max, (it.rolls[i] ?? r.min) + (r.max - r.min) * UPGRADE.share)));
  if (q === it.q && rolls.every((v, i) => v === it.rolls[i])) return null;
  return { ...it, q, rolls, up: (it.up ?? 0) + 1 };
}

export function rollText(it: Item): string[] {
  const d = defOf(it);
  return (d?.rolls ?? []).map((r, i) => `+${(it.rolls[i] ?? r.min).toFixed(r.pct ? 1 : 0)}${r.pct ? '%' : ''} ${r.stat}`);
}

export function coreText(it: Item): string {
  return Object.entries(coreOf(it)).map(([k, v]) => `+${(v ?? 0).toFixed(1).replace(/\.0$/, '')} ${k}`).join(' · ');
}
