/**
 * Tempering (`data/temper.ts`): a perfect piece's one Temper slot. A temper is a property of the piece's slot's
 * list and its size, rolled within that property's range at the piece's rarity from the piece and its count of
 * tempers, so the same piece tempered the same number of times rolls the same. The first fills the slot; each
 * after it waits, beside the one held, until the hunter keeps one of the two (`settle`). Paid in Ember alone
 * (`cost`), more each time up to a cap.
 *
 * A temper reaches the fight as one more property of the piece, through `gear.rollBonuses`.
 */
import { EQUIPMENT } from '@/data/equipment';
import { EMBER } from '@/data/forge';
import { AUTO_TEMPER, TEMPER_CAP, TEMPER_EMBER, TEMPER_FROM, TEMPER_STEP } from '@/data/temper';
import { spend, affords, type Cost } from './forge';
import { defOf, ROLL_EFFECT, stepsToPerfect, worn } from './gear';
import type { Item, Rank, Save, Temper } from './types';
import { RANKS } from './types';
import { rng } from './util';

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Each property's range at each rarity, as the designs roll it. */
const RANGE = new Map<string, { min: number; max: number }>();
/** Each slot's properties, in the order the fight lists them. */
const SLOT_STATS = new Map<string, string[]>();
const ORDER = Object.keys(ROLL_EFFECT);
for (const d of EQUIPMENT) {
  for (const r of d.rolls ?? []) {
    const k = `${r.stat}|${d.rank}`;
    const x = RANGE.get(k);
    RANGE.set(k, x ? { min: Math.min(x.min, r.min), max: Math.max(x.max, r.max) } : { min: r.min, max: r.max });
    const list = SLOT_STATS.get(d.slot) ?? [];
    if (!list.includes(r.stat) && ROLL_EFFECT[r.stat]) SLOT_STATS.set(d.slot, [...list, r.stat].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)));
  }
}

/** A property's range at a rarity. */
export const rangeOf = (stat: string, rank: Rank | string) => RANGE.get(`${stat}|${rank}`) ?? null;
/** Whether a property is written as a percentage. */
export const pctOf = (stat: string) => EQUIPMENT.some((d) => d.rolls?.some((r) => r.stat === stat && r.pct));
/** The properties a piece can be tempered with: its slot's. */
export const statsFor = (it: Item | null | undefined): string[] => SLOT_STATS.get(defOf(it ?? undefined)?.slot ?? '') ?? [];

/** Whether a piece can be tempered: of C-Rank or higher, not issued kit, and perfect. */
export function temperable(it: Item | null | undefined): boolean {
  const d = defOf(it ?? undefined);
  if (!it || !d || d.issued || RANKS.indexOf(d.rank as Rank) < RANKS.indexOf(TEMPER_FROM)) return false;
  return stepsToPerfect(it) === 0;
}

/** How many times a piece has been tempered. */
export const count = (it: Item) => it.tempers ?? 0;

/** The Ember the next temper on a piece takes: more each time, up to the cap. */
export function emberFor(it: Item): number {
  const r = (defOf(it)?.rank ?? 'C') as Rank;
  return Math.round(TEMPER_EMBER[r] * Math.min(TEMPER_CAP, 1 + TEMPER_STEP * count(it)));
}

/** What the next temper on a piece takes, as the Forge counts a price: its Ember, and no shards. */
export const cost = (it: Item): Cost => ({ shards: 0, mats: { [EMBER.id]: emberFor(it) } });

/** A roll's place in its range, 0 to 1, drawn from the piece and its count of tempers. */
const fraction = (it: Item, n: number) => rng(`arise|temper|${it.id}|${n}`)();

/** The size a property rolls at on a piece's `n`th temper. */
export function rollAt(it: Item, stat: string, n: number): number {
  const range = rangeOf(stat, defOf(it)?.rank ?? '');
  if (!range) return 0;
  return round2(range.min + fraction(it, n) * (range.max - range.min));
}

/** Where a temper sits in its range, 0 to 1. */
export function share(it: Item, t: Temper): number {
  const range = rangeOf(t.stat, defOf(it)?.rank ?? '');
  return range && range.max > range.min ? (t.v - range.min) / (range.max - range.min) : 1;
}

/** Why a piece cannot be tempered with a property now, or null when it can. */
export function blocked(s: Save, itemId: string, stat: string): 'not' | 'stat' | 'waiting' | 'short' | null {
  const it = s.items.find((x) => x.id === itemId);
  if (!it || !temperable(it)) return 'not';
  if (!statsFor(it).includes(stat)) return 'stat';
  if (it.temperNew) return 'waiting';
  return affords(s, cost(it)) ? null : 'short';
}

/**
 * Temper a piece with a property: pay, roll its size, and fill the slot, or, with one already held, set the
 * new roll beside it to be kept or turned down (`settle`). Returns the roll, or null. Mutates.
 */
export function temper(s: Save, itemId: string, stat: string): Temper | null {
  if (blocked(s, itemId, stat)) return null;
  const it = s.items.find((x) => x.id === itemId)!;
  if (!spend(s, cost(it))) return null;
  const roll: Temper = { stat, v: rollAt(it, stat, count(it)) };
  it.tempers = count(it) + 1;
  if (it.temper) it.temperNew = roll;
  else it.temper = roll;
  return roll;
}

/** Keep the new roll waiting on a piece (`take`), or the one it held. Mutates. */
export function settle(s: Save, itemId: string, take: boolean): boolean {
  const it = s.items.find((x) => x.id === itemId);
  if (!it?.temperNew) return false;
  if (take) it.temper = it.temperNew;
  delete it.temperNew;
  return true;
}

/** The System's property for a piece: the first of `AUTO_TEMPER` its slot offers. */
export const systemStat = (it: Item) => AUTO_TEMPER.find((x) => statsFor(it).includes(x)) ?? statsFor(it)[0];

/**
 * The balance tools' hunter who keeps up: every perfect piece worn tempered with the System's property, at
 * the middle of its range, without cost. Mutates.
 */
export function autoTemper(s: Save) {
  for (const it of worn(s)) {
    if (!temperable(it)) continue;
    const stat = systemStat(it);
    const range = stat ? rangeOf(stat, defOf(it)!.rank) : null;
    if (stat && range) it.temper = { stat, v: round2((range.min + range.max) / 2) };
  }
}
