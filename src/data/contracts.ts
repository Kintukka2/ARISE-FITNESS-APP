/**
 * The System's contracts: three a day, drawn at midnight for the hunter's
 * grade. Every contract pays the same, stated before you start it; all three
 * together pay a bonus. One left undone lapses at midnight and costs nothing.
 * Numbers here are rules, and the screens quote them from here.
 */
import type { Rank } from '@/core/types';

export const CONTRACTS_PER_DAY = 3;

/** What one contract pays, as a share of a clear at the grade it was issued for. */
export const CONTRACT_PAY = { shards: 1, xp: 0.1 } as const;
/** What all of a day's contracts pay together, on top of their own. */
export const CONTRACT_BONUS = { shards: 2, xp: 0.2 } as const;

export type ContractKind = 'clear' | 'fell' | 'shadows' | 'tired' | 'gatekeeper' | 'offroad';

/**
 * How often each kind is drawn. A kind the hunter cannot do today is left out of the draw.
 * Nothing asks for a gate above the hunter's grade: they clear about one in ten, and being
 * carried out of one would cost them the rest of the day.
 */
export const CONTRACT_KINDS: { kind: ContractKind; w: number }[] = [
  { kind: 'clear', w: 28 }, { kind: 'fell', w: 24 }, { kind: 'offroad', w: 14 }, { kind: 'gatekeeper', w: 14 },
  { kind: 'shadows', w: 12 }, { kind: 'tired', w: 8 },
];

/** Gates to clear at the hunter's grade or above: two, or now and then three. */
export const CLEAR_COUNT = { base: 2, more: 3, moreOdds: 0.35 } as const;

/**
 * Creatures of one family to fell, by grade: a run and a half's worth in a gate full of them.
 * A cleared gate shuts for the day, and some families live in one gate of a grade, so kills in
 * any gate count.
 */
export const FELL_COUNT: Record<Rank, number> = { E: 8, D: 9, C: 9, B: 9, A: 12, S: 14 };

/** Kills the deployed Shadows must land, per Shadow deployed: about two runs' worth. At E they land too few to ask. */
export const SHADOW_KILLS_PER: Record<Rank, number> = { E: 0, D: 2, C: 1.5, B: 3, A: 3, S: 3 };

/** Fatigue to walk in carrying: three gates' worth at the hunter's grade, never more than this. */
export const TIRED_GATES = 3;
export const TIRED_MAX = 60;
