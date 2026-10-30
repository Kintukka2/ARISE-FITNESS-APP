/**
 * The Pale Spire: the one Gate that never closed. Numbers here are rules, and
 * the screens quote them from here.
 */
import type { Rank } from '@/core/types';

export const SPIRE_NAME = 'The Pale Spire';
export const SPIRE_THEME = 'The one Gate that has never closed. It opened upward over the old reservoir the year the first hunters Awakened, and every boss killed inside it opens another floor above. Its floors rearrange themselves every Monday.';

/** Floors to a block: three of choices, a rest, then a boss. A block costs the fatigue of one gate of its grade. */
export const BLOCK = 5;

/** Each grade's floors start here. A hunter climbs from the first of their own grade's, or from above their best this week. */
export const SPIRE_FLOORS: Record<Rank, number> = { E: 1, D: 11, C: 21, B: 36, A: 51, S: 71 };

/** Floor N is built for a hunter of Level N, up to this floor. Above it, every block is harder than the last by this much. */
export const SPIRE_TOP = 100;
export const SPIRE_GROWTH = 1.03;

/** The Spire opens to a hunter with this many gates cleared. */
export const SPIRE_OPENS = 5;

/**
 * What a week pays when it closes, by the grade of its highest floor: this many clears' worth of
 * shards and a piece of that grade's gear. Every `beyond` floors above the top pay `step` more.
 */
export const SEASON_PAY = { shards: 4, beyond: 10, step: 0.25 } as const;
