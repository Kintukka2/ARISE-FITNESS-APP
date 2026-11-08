/**
 * Mana Shards and the Exchange. A shelf of blueprints a day, redrawn at midnight
 * with the Gate board, most at the hunter's grade and some well above it at a
 * premium. Potions are always in stock: most are drunk on purchase, and
 * field potions go in the satchel for the hunter's turn in a fight.
 */
import { EQUIPMENT } from '@/data/equipment';
import { BLUEPRINTS } from '@/data/forge';
import { SURVEY } from '@/data/association';
import * as forge from './forge';
import { gearDef, RARITY } from './gear';
import type { Rank, Save, StockId } from './types';
import { RANKS } from './types';
import { dayIndex, dayKey, rng } from './util';
import * as vitals from './vitals';
import { FIELD_POTION_HEAL } from './combat';
import { licensedRank } from './licence';

export const STOCK = BLUEPRINTS.shelf;
export const BLUEPRINT_SHELF = STOCK;
export const GATE_SHARDS: Record<Rank, number> = { E: 10, D: 16, C: 26, B: 42, A: 68, S: 110 };
export const REACH_PREMIUM = 0.5;

/** How far from the hunter's grade an offer lands, and how often. */
const SPREAD = [
  { at: -2, upTo: 0.1 }, { at: -1, upTo: 0.32 }, { at: 0, upTo: 0.62 }, { at: 1, upTo: 0.84 },
  { at: 2, upTo: 0.93 }, { at: 3, upTo: 0.97 }, { at: 4, upTo: 0.99 }, { at: 5, upTo: 1 },
];

export const shards = (s: Save) => s.wallet.shards;

export function earn(s: Save, n: number): number {
  const add = Math.max(0, Math.round(n));
  s.wallet.shards += add;
  s.wallet.earned += add;
  return add;
}

/** Shards paid for with money, credited once per store transaction. */
export function deposit(s: Save, n: number, receipt: string): boolean {
  if (s.wallet.receipts.includes(receipt)) return false;
  s.wallet.receipts.push(receipt);
  s.wallet.shards += n;
  s.wallet.bought += n;
  return true;
}

export function pay(s: Save, n: number): boolean {
  const cost = Math.max(0, Math.round(n));
  if (s.wallet.shards < cost) return false;
  s.wallet.shards -= cost;
  s.wallet.spent += cost;
  return true;
}

export const gateShards = (rank: string, share = 1) => Math.round((GATE_SHARDS[rank as Rank] ?? 0) * share);

const round5 = (n: number) => Math.round(n / 5) * 5;
/** What a blueprint costs at the Exchange: its design's score at its middle roll, at a price a point. */
export const blueprintPrice = (defId: string) => {
  const d = gearDef(defId);
  return d ? round5(RARITY[d.rank as Rank].score * BLUEPRINTS.price) : 0;
};

const GEAR_BY_RANK: Record<Rank, string[]> = { E: [], D: [], C: [], B: [], A: [], S: [] };
for (const d of EQUIPMENT) GEAR_BY_RANK[d.rank as Rank]?.push(d.id);

export interface Offer { index: number; defId: string; price: number; reach: number; sold: boolean; known: boolean }

/** Today's shelf of blueprints. Deterministic per day and grade; `sold` and `known` read the save. */
export function shelf(s: Save, day = dayKey()): Offer[] {
  const win = dayIndex(day);
  const r = rng('arise|shop|' + win);
  const mine = RANKS.indexOf(licensedRank(s));
  const used = new Set<string>();
  const out: Offer[] = [];
  let guard = 0;
  while (out.length < STOCK && guard++ < 400) {
    const roll = r();
    const step = SPREAD.find((x) => roll < x.upTo)?.at ?? 0;
    const at = Math.max(0, Math.min(RANKS.length - 1, mine + step));
    const pool = GEAR_BY_RANK[RANKS[at]].filter((d) => !used.has(d));
    if (!pool.length) continue;
    const defId = pool[Math.floor(r() * pool.length)];
    used.add(defId);
    const index = out.length;
    const reach = Math.max(0, at - mine - 1);
    out.push({
      index, defId, reach, price: round5(blueprintPrice(defId) * (1 + REACH_PREMIUM * reach)),
      sold: s.shop.day === day && s.shop.taken.includes(index), known: forge.knows(s, defId),
    });
  }
  return out;
}

/** Buy a blueprint off the shelf: it is learned. False if it is sold, known or the shards are short. Mutates. */
export function buy(s: Save, index: number, day = dayKey()): boolean {
  const offer = shelf(s, day).find((o) => o.index === index);
  if (!offer || offer.sold || offer.known || !pay(s, offer.price)) return false;
  if (s.shop.day !== day) s.shop = { day, taken: [] };
  s.shop.taken.push(index);
  return forge.learn(s, offer.defId);
}

// ------------------------------------------------------------------ potions

export type PotionId = 'hp' | 'mp' | 'fatigue' | 'elixir';

/** What the Health and Mana Potions restore, as a share of the maximum, and what the Fatigue Potion takes off. */
export const POTION_RESTORE = 0.25;
export const POTION_EASE = 20;

export const POTIONS: { id: PotionId; name: string; price: number; effect: string; desc: string }[] = [
  { id: 'hp', name: 'Health Potion', price: 30, effect: `HP +${POTION_RESTORE * 100}%`, desc: 'A sealed field ration sold by the Hunter Association.' },
  { id: 'mp', name: 'Mana Potion', price: 30, effect: `MP +${POTION_RESTORE * 100}%`, desc: 'Distilled from Gate residue. Sold by the Hunter Association.' },
  { id: 'fatigue', name: 'Fatigue Potion', price: 45, effect: `Fatigue -${POTION_EASE}`, desc: 'A tonic that removes fatigue without rest.' },
  { id: 'elixir', name: 'Elixir of Rejuvenation', price: 120, effect: 'Gate lockout lifted', desc: 'Accepted by the Hunter Association as proof of recovery.' },
];

/** Field potions are carried, not drunk: into a Gate, for the hunter's own turn. */
export const FIELD_POTION = { price: 40, max: 3, heal: FIELD_POTION_HEAL } as const;

/** How many field potions the satchel holds: the Exchange's, and what the Association has added. */
export const satchelMax = (s: Save) => FIELD_POTION.max + (s.satchelPlus ?? 0);

/** Put a field potion in the satchel. False if it is full or the shards are short. */
export function buyField(s: Save): boolean {
  if (s.satchel >= satchelMax(s) || !pay(s, FIELD_POTION.price)) return false;
  s.satchel += 1;
  return true;
}

/** Buy a Gate Survey into stock. False if the shards are short. Mutates. */
export function buySurvey(s: Save): boolean {
  if (!pay(s, SURVEY.price)) return false;
  stockUp(s, 'survey');
  return true;
}

/** How many of a kind the hunter holds in stock. */
export const held = (s: Save, id: StockId) => s.stock?.[id] ?? 0;
/** Add to the stock. Mutates. */
export function stockUp(s: Save, id: StockId, n = 1) {
  s.stock ??= {};
  s.stock[id] = held(s, id) + n;
}

/** Why a potion would be wasted right now, or null if it is worth drinking. */
export function potionIdle(s: Save, id: PotionId, now = Date.now()): string | null {
  const v = vitals.read(s, now);
  if (id === 'hp') return v.hp >= v.hpMax ? 'Full' : null;
  if (id === 'mp') return v.mp >= v.mpMax ? 'Full' : null;
  if (id === 'fatigue') return v.fatigue <= 0 ? 'Rested' : null;
  return v.locked ? null : 'Not locked';
}

/** Drink a potion: one held in stock first, else one bought at its price. Returns what it moved, or null. Mutates. */
export function drink(s: Save, id: PotionId, now = Date.now()): number | null {
  const p = POTIONS.find((x) => x.id === id)!;
  if (potionIdle(s, id, now)) return null;
  if (held(s, id) > 0) s.stock[id] = held(s, id) - 1;
  else if (!pay(s, p.price)) return null;
  if (id === 'hp') return vitals.heal(s, POTION_RESTORE, now);
  if (id === 'mp') return vitals.restore(s, POTION_RESTORE, now);
  if (id === 'fatigue') return vitals.ease(s, POTION_EASE, now);
  return vitals.unlock(s, now);
}
