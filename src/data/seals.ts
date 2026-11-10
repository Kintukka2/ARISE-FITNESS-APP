/**
 * Seals: risk a hunter takes on for pay stated up front. Each Gate on the board offers up to three, drawn
 * from its day's map, and each pairs one of Ascension's rules with a kind of pay. A Seal taken on the brief
 * moves the assessment and the pay together, and the run keeps what it walked in with (`run.seals`).
 * Seals pay in materials only, never Mana Shards: what a shard pack buys, a Seal never pays. Numbers here
 * are rules; the screens quote them.
 */
import type { Rank } from '@/core/types';

export type SealId = 'swollen' | 'lightless' | 'shorthanded' | 'wardens' | 'dry' | 'alone' | 'heavier';

/** The grade a hunter's licence must reach for the board to offer Seals. */
export const SEALS_FROM: Rank = 'D';
/** How many Seals a Gate offers, at most. */
export const SEALS_PER_GATE = 3;

/** Each Seal's rule and its pay, as numbers. */
export const SEAL = {
  /** Every creature's HP +25%; the alloy the run leaves +40%. */
  swollen: { hp: 1.25, alloy: 0.4 },
  /** Rests heal nothing; every fight won leaves one more part. */
  lightless: { rest: 0, part: 1 },
  /** The Association sends one hunter fewer; a clear leaves every part +2. */
  shorthanded: { allies: 1, parts: 2 },
  /** The Gatekeeper is 25% stronger; its vault, opened, always leaves a blueprint. */
  wardens: { elite: 1.25 },
  /** No Health Potion, in a fight or between steps, and nothing healed after a fight won; a clear leaves one more blueprint. */
  dry: { blueprints: 1 },
  /** The boss stands with one of its Gate's creatures; a clear leaves a blueprint of the grade above. */
  alone: { up: 1 },
  /** The creatures fight as if one Ascension level higher; a clear leaves Ascendant Ember +2. */
  heavier: { levels: 1, ember: 2 },
} as const;

const pct = (x: number) => Math.round(x * 100);

/** Each Seal's name, its rule and its pay, in a line each, read from the numbers above. */
export const SEALS: Record<SealId, { name: string; rule: string; pay: string }> = {
  swollen: { name: 'Swollen', rule: `Creatures: HP +${pct(SEAL.swollen.hp - 1)}%`, pay: `Alloy +${pct(SEAL.swollen.alloy)}%` },
  lightless: { name: 'Lightless', rule: 'Rests heal nothing', pay: `Each fight won: part +${SEAL.lightless.part}` },
  shorthanded: { name: 'Short-Handed', rule: `The Association sends ${SEAL.shorthanded.allies} hunter fewer`, pay: `Clear: every part +${SEAL.shorthanded.parts}` },
  wardens: { name: 'Wardens Wake', rule: `The Gatekeeper: strength +${pct(SEAL.wardens.elite - 1)}%`, pay: 'Its vault: a blueprint, always' },
  dry: { name: 'Dry', rule: 'No Health Potion, and nothing healed after a fight', pay: `Clear: blueprint +${SEAL.dry.blueprints}` },
  alone: { name: 'Never Alone', rule: 'The boss stands with one of its creatures', pay: 'Clear: a blueprint of the grade above' },
  heavier: { name: 'Heavier Air', rule: `Creatures fight as if Ascension +${SEAL.heavier.levels}`, pay: `Clear: Ascendant Ember +${SEAL.heavier.ember}` },
};

export const SEAL_IDS = Object.keys(SEALS) as SealId[];
