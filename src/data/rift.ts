/**
 * The Daily Rift: one Gate a day, drawn from the date alone, so every hunter of a grade walks the same one
 * (docs/DESIGN.md, "The Daily Rift — built"). It plays two of the Seals' rules as its modifiers, at the
 * Ascension the hunter has chosen, once a day, and is scored line by line into a history kept on the phone. Numbers here are rules;
 * the screens quote them.
 */
import type { Rank } from '@/core/types';

export const RIFT_NAME = 'Daily Rift';
export const RIFT_THEME = 'A Gate that opens at midnight and is gone by the next. Every hunter of a grade walks the same one, once.';

/** Gates cleared before the Rift opens. */
export const RIFT_OPENS = 3;

/** How many of the Seals' rules a Rift plays, drawn from its date: its modifiers. */
export const RIFT_MODIFIERS = 2;

/** What a Rift cleared pays beyond its Gate's clear: Ascendant Ember, by its grade. */
export const RIFT_EMBER: Record<Rank, number> = { E: 2, D: 3, C: 5, B: 7, A: 10, S: 13 };

/** The score, worked a line at a time. */
export const SCORE = {
  /** Each fight won on the way, the Gatekeeper's and the boss's apart. */
  fight: 100,
  /** The Gatekeeper defeated. */
  keeper: 300,
  /** The boss defeated: the Rift cleared. */
  boss: 600,
  /** Each of the Gate's Feats met, on a clear. */
  feat: 200,
  /** Each round under par, on a clear. */
  pace: 15,
  /** The hunter's HP left at the end of a clear, as a share, times this. */
  health: 400,
} as const;

/** Par: this many rounds to every fight won. */
export const RIFT_PAR = 4;

/** Days the history keeps. */
export const RIFT_KEPT = 30;
