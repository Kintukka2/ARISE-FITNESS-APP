/**
 * Ascension: a ladder of harder rules for a hunter who has outgrown the board.
 * Level L plays its own rule and every rule below it. Every level also makes
 * the foes stronger, by a share calibration sets (`ASCENSION_TUNE`), and pays
 * more. A hunter opens each level by proving the one below it. Numbers here are
 * rules; the screens quote them.
 */
import type { Rank } from '@/core/types';

export const ASCENSION_TOP = 10;

/** The grade from which a hunter's clears count toward proving a level. */
export const ASCENSION_FROM: Rank = 'C';

/** What proves a level: this many different gates of the hunter's grade cleared at it, and the top of their grade's floors on the Spire. */
export const PROOF = { gates: 4 } as const;

/** Each level pays this share more experience and shards on a gate than the level below. */
export const ASCENSION_PAY = 0.1;

/** The rule each level adds, and its numbers. A level plays every rule at or below it. */
export const RULES = {
  /** Rests heal this share of what they would. */
  thinRest: { at: 2, heal: 0.5 },
  /** The Association sends this many hunters fewer. */
  shortHanded: { at: 3, allies: 1 },
  /** A gate costs this much more fatigue to walk into. */
  heavyLegs: { at: 4, fatigue: 1.5 },
  /** A gatekeeper is this much stronger than its gate's other creatures. */
  wardens: { at: 5, elite: 1.25 },
  /** Every choice that rolls goes well this much less often. */
  crooked: { at: 6, odds: 0.15 },
  /** Reaching for a lingering Shadow costs this much more mana. */
  hungryDark: { at: 7, mana: 2 },
  /** The boss never fights alone: one of its gate's creatures stands with it. */
  guarded: { at: 8 },
  /** Fatigue drags the hunter down this much harder. */
  wornThin: { at: 9, drag: 2 },
  /** Auto will not fight the boss: every order in its chamber is the hunter's. */
  watched: { at: 10 },
} as const;

/** The levels' names, one to a rule. Level 1 adds no rule but the stronger foes. */
export const ASCENSION_NAMES: string[] = [
  'Heavier Air', 'Thin Rest', 'Short-Handed', 'Heavy Legs', 'Wardens Wake',
  'Crooked Luck', 'Hungry Dark', 'Never Alone', 'Worn Thin', 'The System Watches',
];

/**
 * The clear rate calibration aims a hunter who keeps up at, level by level. Such a hunter clears nearly
 * everything at level 0; this brings them down to about half at the top.
 */
export const ASCENSION_TARGET = (level: number) => 0.88 - 0.035 * level;
