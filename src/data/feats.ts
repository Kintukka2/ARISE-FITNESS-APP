/**
 * Feats: three stated objectives on every Gate, each paying once, the first time it is met on that Gate
 * with the Gate cleared. They are the same three every day, so a Gate's Feats are a list to finish. The
 * brief says how often the System met each in its runs. Numbers here are rules; the screens quote them.
 */
export type FeatId = 'unbroken' | 'swift' | 'breaker' | 'keeper' | 'thorough' | 'steady';

/** How many Feats a Gate holds. */
export const FEATS_PER_GATE = 3;

/** The numbers each Feat is judged by. */
export const FEAT = {
  /** The boss falls within this many rounds of its chamber. */
  swift: { rounds: 5 },
  /** The hunter's HP never falls below this share of its maximum, in any fight. */
  steady: { above: 0.5 },
} as const;

/** What a Feat pays, the first time it is met on a Gate: a blueprint of the Gate's grade. */
export const FEAT_PAY = { blueprints: 1 } as const;

const pct = (x: number) => Math.round(x * 100);

/** Each Feat's name and its objective, read from the numbers above. */
export const FEATS: Record<FeatId, { name: string; text: string }> = {
  unbroken: { name: 'Unbroken', text: 'Clear the Gate with no one in the party falling' },
  swift: { name: 'Swift End', text: `Defeat the boss within ${FEAT.swift.rounds} rounds` },
  breaker: { name: 'Breaker', text: 'Break the boss’s wind-up' },
  keeper: { name: 'Wardenbane', text: 'Defeat the Gatekeeper' },
  thorough: { name: 'Thorough', text: 'Clear every room on the plan' },
  steady: { name: 'Steady Hand', text: `Keep your HP above ${pct(FEAT.steady.above)}% in every fight` },
};

export const FEAT_IDS = Object.keys(FEATS) as FeatId[];
