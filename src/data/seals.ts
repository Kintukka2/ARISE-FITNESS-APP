/**
 * Seals: risk a hunter takes on for pay stated up front. Each Gate on the board offers up to three, drawn
 * from its day's map, and each is one of Ascension's rules taken alone. A Seal taken on the brief moves the
 * assessment and the pay together, and the run keeps what it walked in with (`run.seals`). Seals pay in
 * Ascendant Ember, the steps past perfect's own, on a clear: never Mana Shards, which a pack can buy.
 * Numbers here are rules; the screens quote them.
 */
import type { Rank } from '@/core/types';

export type SealId = 'swollen' | 'lightless' | 'shorthanded' | 'wardens' | 'dry' | 'alone' | 'heavier';

/** The grade a hunter's licence must reach for the board to offer Seals. */
export const SEALS_FROM: Rank = 'D';
/** How many Seals a Gate offers, at most. */
export const SEALS_PER_GATE = 3;

/**
 * Each Seal's rule, and its weight: the Ember it pays on a clear is its weight times the Gate's grade's
 * share (`SEAL_GRADE`). Wardens Wake pays only when the Gatekeeper it wakes falls.
 */
export const SEAL = {
  /** Every creature's HP +25%. */
  swollen: { hp: 1.25, ember: 2 },
  /** Rests heal nothing. */
  lightless: { rest: 0, ember: 1 },
  /** The Association sends one hunter fewer. */
  shorthanded: { allies: 1, ember: 2 },
  /** The Gatekeeper is 25% stronger. Paid only if it falls. */
  wardens: { elite: 1.25, ember: 2 },
  /** No Health Potion, in a fight or between steps, and nothing healed after a fight won. */
  dry: { ember: 2 },
  /** The boss stands with one of its Gate's creatures. */
  alone: { ember: 3 },
  /** The creatures fight as if one Ascension level higher. */
  heavier: { levels: 1, ember: 3 },
} as const;

/** What a Seal's weight is worth in Ember, by the Gate's grade. */
export const SEAL_GRADE: Record<Rank, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 };

/** The Ember a Seal pays on a clear of a Gate of this grade. */
export const sealEmber = (id: SealId, rank: string) => SEAL[id].ember * (SEAL_GRADE[rank as Rank] ?? 1);

const pct = (x: number) => Math.round(x * 100);

/** Each Seal's name and its rule, read from the numbers above. Its pay is `sealEmber`, by grade. */
export const SEALS: Record<SealId, { name: string; rule: string; note?: string }> = {
  swollen: { name: 'Swollen', rule: `Creatures: HP +${pct(SEAL.swollen.hp - 1)}%` },
  lightless: { name: 'Lightless', rule: 'Rests heal nothing' },
  shorthanded: { name: 'Short-Handed', rule: `The Association sends ${SEAL.shorthanded.allies} hunter fewer` },
  wardens: { name: 'Wardens Wake', rule: `The Gatekeeper: strength +${pct(SEAL.wardens.elite - 1)}%`, note: 'paid only if it falls' },
  dry: { name: 'Dry', rule: 'No Health Potion, and nothing healed after a fight' },
  alone: { name: 'Never Alone', rule: 'The boss stands with one of its creatures' },
  heavier: { name: 'Heavier Air', rule: `Creatures fight as if Ascension +${SEAL.heavier.levels}` },
};

export const SEAL_IDS = Object.keys(SEALS) as SealId[];
