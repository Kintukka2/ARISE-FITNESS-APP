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

/** What proves a level: this many different gates of the hunter's grade cleared at it, and then the Trial. */
export const PROOF = { gates: 4 } as const;

/**
 * The Trial: the gauntlet that opens each level. Proving level L means beating `L + 2` of the Chosen
 * in a row, with no rest between them and no way out but through. Each Chosen is one of the hunter's
 * grade's gate bosses, weakest first, made this much stronger for every round before it. The Trial
 * can be entered once a day.
 */
export const TRIAL = { extra: 2, step: 0.06 } as const;

/** The Chosen, round by round. Each takes the shape of a boss of the hunter's own grade. */
export const CHOSEN: string[] = [
  'The Gatewatcher', 'The Pale Hound', 'The Iron Penitent', 'The Drowned Bell', 'The Cinder Saint',
  'The Thousand-Eyed', 'The Hollow Herald', 'The Last Knight', 'The Weeping Colossus', 'The Starless',
  'The Unnamed King', 'The Ninth Door',
];

/**
 * Marks: what a hunter keeps from every level they open, after Gladiator Manager's reincarnation
 * bonuses, without the reincarnation. Each level opened earns one mark, set for good on one of these.
 * Each mark set adds its numbers once, up to `MARK_MAX` on any one. `hero` and `shadows` are bonuses
 * as gear's are; `fatigue` is the share less fatigue a gate costs.
 */
export interface Mark { id: string; name: string; hero?: Record<string, number>; shadows?: Record<string, number>; fatigue?: number }
export const MARKS: Mark[] = [
  { id: 'edge', name: 'Mark of the Edge', hero: { patk: 0.04, mpow: 0.04 } },
  { id: 'bulwark', name: 'Mark of the Bulwark', hero: { maxHp: 0.06 } },
  { id: 'ward', name: 'Mark of the Ward', hero: { defense: 0.05, resist: 0.05 } },
  { id: 'legion', name: 'Mark of the Legion', shadows: { patk: 0.05, mpow: 0.05, maxHp: 0.05 } },
  { id: 'stride', name: 'Mark of the Long Stride', fatigue: 0.06 },
];
export const MARK_MAX = 4;

/**
 * Past perfect: every level opened lets a piece take one more upgrade step past its design's best.
 * Each such step moves its quality and every property `share` of the way across the design's range,
 * and the k-th costs (1 + k) times what the score it adds would cost at the usual rate.
 */
export const OVERCHARGE = { per: 1, share: 0.05 } as const;

/**
 * The Chosen sent into the world, after Gladiator Manager's: winning the Trial that opens level L sends
 * its last Chosen out into the gates. Each day one of them holds a gate of the hunter's grade, and shows
 * itself only to a hunter who walks in at its level or higher, in the boss's place. The first time it
 * falls it leaves a masterwork for the slot it guards (`MASTERWORK_SLOTS`, by level): a piece of the
 * gate's grade, perfect and L steps past it. After that it pays `bounty` clears' worth of shards.
 */
export const WALKERS = { bounty: 2 } as const;
export const MASTERWORK_SLOTS: string[] = ['Weapon', 'Chest', 'Off-Hand', 'Head', 'Hands', 'Legs', 'Feet', 'Amulet', 'Ring', 'Ring'];

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
  'Crooked Luck', 'Hungry Dark', 'Never Alone', 'Worn Thin', 'By Hand',
];

/**
 * The clear rate calibration aims a hunter who keeps up at, level by level. Such a hunter clears nearly
 * everything at level 0; this brings them down to about half at the top.
 */
export const ASCENSION_TARGET = (level: number) => 0.88 - 0.035 * level;
