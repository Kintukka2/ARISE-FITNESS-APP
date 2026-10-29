/**
 * Mana Shards and the Exchange. Eight pieces a day, redrawn at midnight with
 * the Gate board, most at the hunter's grade and some well above it at a
 * premium. Potions are always in stock and are drunk on purchase.
 */
import { EQUIPMENT } from '@/data/equipment';
import { gearDef, grant, make, score } from './gear';
import type { Item, Rank, Save } from './types';
import { RANKS } from './types';
import { dayIndex, dayKey, rng } from './util';
import * as vitals from './vitals';
import { licensedRank } from './licence';

export const STOCK = 8;
export const QUEST_SHARDS: Record<Rank, number> = { E: 15, D: 20, C: 27, B: 36, A: 45, S: 60 };
export const GATE_SHARDS: Record<Rank, number> = { E: 10, D: 16, C: 26, B: 42, A: 68, S: 110 };
export const FAIL_SHARE = 0.15;
const PRICE_PER_SCORE = 10;
const REACH_PREMIUM = 0.5;
const RECYCLE_SHARE = 0.05;

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

export function pay(s: Save, n: number): boolean {
  const cost = Math.max(0, Math.round(n));
  if (s.wallet.shards < cost) return false;
  s.wallet.shards -= cost;
  s.wallet.spent += cost;
  return true;
}

export const questShards = (s: Save) => QUEST_SHARDS[licensedRank(s)];
export const gateShards = (rank: string, share = 1) => Math.round((GATE_SHARDS[rank as Rank] ?? 0) * share);

const round5 = (n: number) => Math.round(n / 5) * 5;
export const basePrice = (it: Item) => round5(score(it) * PRICE_PER_SCORE);
export const scrapValue = (it: Item) => Math.max(1, Math.round(basePrice(it) * RECYCLE_SHARE));

const GEAR_BY_RANK: Record<Rank, string[]> = { E: [], D: [], C: [], B: [], A: [], S: [] };
for (const d of EQUIPMENT) GEAR_BY_RANK[d.rank as Rank]?.push(d.id);

export interface Offer { index: number; item: Item; price: number; reach: number; sold: boolean }

/** Today's shelf. Deterministic per day and grade; `sold` reads the save. */
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
    const item = make(defId, `shp${win}-${index}`);
    const reach = Math.max(0, at - mine - 1);
    out.push({ index, item, reach, price: round5(basePrice(item) * (1 + REACH_PREMIUM * reach)), sold: s.shop.day === day && s.shop.taken.includes(index) });
  }
  return out;
}


export function buy(s: Save, index: number, day = dayKey()): Item | null {
  const offer = shelf(s, day).find((o) => o.index === index);
  if (!offer || offer.sold || !pay(s, offer.price)) return null;
  if (s.shop.day !== day) s.shop = { day, taken: [] };
  s.shop.taken.push(index);
  return grant(s, offer.item.defId, offer.item.id);
}

export function recycle(s: Save, itemId: string): number {
  const it = s.items.find((i) => i.id === itemId);
  const d = it && gearDef(it.defId);
  if (!it || !d || d.issued || Object.values(s.equipped).includes(itemId)) return 0;
  const paid = scrapValue(it);
  s.items = s.items.filter((i) => i.id !== itemId);
  s.favourites = s.favourites.filter((f) => f !== itemId);
  earn(s, paid);
  return paid;
}

/** Everything not worn, not issued and not starred, of these grades. */
export function scrapMatches(s: Save, ranks: string[]): Item[] {
  const worn = new Set(Object.values(s.equipped));
  return s.items.filter((it) => {
    const d = gearDef(it.defId);
    return d && !d.issued && !worn.has(it.id) && !s.favourites.includes(it.id) && ranks.includes(d.rank);
  });
}

export function recycleAll(s: Save, ranks: string[]) {
  let paid = 0;
  const doomed = scrapMatches(s, ranks);
  for (const it of doomed) paid += recycle(s, it.id);
  return { count: doomed.length, paid };
}

// ------------------------------------------------------------------ potions

export type PotionId = 'hp' | 'mp' | 'fatigue' | 'elixir';

export const POTIONS: { id: PotionId; name: string; price: number; effect: string; desc: string }[] = [
  { id: 'hp', name: 'Health Potion', price: 30, effect: 'Restores 25% of maximum HP', desc: 'Sealed field ration issue. Tastes of iron and does not care.' },
  { id: 'mp', name: 'Mana Potion', price: 30, effect: 'Restores 25% of maximum MP', desc: 'Distilled from a Gate’s own residue. The Association sells it back to you.' },
  { id: 'fatigue', name: 'Fatigue Potion', price: 45, effect: 'Removes 20 Fatigue', desc: 'It does not rest you. It persuades your body it has rested.' },
  { id: 'elixir', name: 'Elixir of Rejuvenation', price: 120, effect: 'Lifts the lockout after being downed', desc: 'The only argument the Association accepts for walking back into a Gate the same day one carried you out of it.' },
];

/** Why a potion would be wasted right now, or null if it is worth drinking. */
export function potionIdle(s: Save, id: PotionId, now = Date.now()): string | null {
  const v = vitals.read(s, now);
  if (id === 'hp') return v.hp >= v.hpMax ? 'Full' : null;
  if (id === 'mp') return v.mp >= v.mpMax ? 'Full' : null;
  if (id === 'fatigue') return v.fatigue <= 0 ? 'Rested' : null;
  return v.locked ? null : 'Not locked';
}

export function drink(s: Save, id: PotionId, now = Date.now()): number | null {
  const p = POTIONS.find((x) => x.id === id)!;
  if (potionIdle(s, id, now) || !pay(s, p.price)) return null;
  if (id === 'hp') return vitals.heal(s, 0.25, now);
  if (id === 'mp') return vitals.restore(s, 0.25, now);
  if (id === 'fatigue') return vitals.ease(s, 20, now);
  return vitals.unlock(s, now);
}
