/**
 * Par: a Gate's clear graded against the rounds its fights should take (docs/DESIGN.md, "Par — built"). Each
 * fight won carries a par, by its kind and the Gate's grade; the run's par is theirs added up, so a room off the
 * road brings its own par with it and exploring costs nothing. A clear within par earns Bronze, well under it
 * Silver, far under it Gold, and each medal pays once on its Gate, the first time it is reached. The pars are what
 * the System takes, on average, at the grade's own level: Auto reaches Bronze about as often as not, and the rest
 * is for the hunter's hands. Numbers here are rules; the screens quote them.
 */
import type { Rank } from '@/core/types';

export type FightKind = 'fight' | 'elite' | 'boss';
export type MedalId = 'bronze' | 'silver' | 'gold';

/**
 * Rounds a fight should take, by the Gate's grade and the fight's kind: the System's average at the grade's
 * own level (`npm run parstats`), a Gatekeeper's halfway between a fight's and the boss's.
 */
export const PAR: Record<Rank, Record<FightKind, number>> = {
  E: { fight: 5.3, elite: 8.3, boss: 11.3 },
  D: { fight: 3.6, elite: 7, boss: 10.4 },
  C: { fight: 2.2, elite: 5.2, boss: 8.1 },
  B: { fight: 3.1, elite: 5.1, boss: 7.1 },
  A: { fight: 2.4, elite: 4.8, boss: 7.1 },
  S: { fight: 3.4, elite: 4.5, boss: 5.6 },
};

/**
 * The medals, best first, and the share of par in rounds each asks for at most (whole rounds, rounded down). The
 * System's clears at the grade's own level spread wide: about half come within par, one in five within 65% of it
 * and one in twenty within half, so Silver and Gold are for the hunter's hands, or for a hunter come back stronger.
 */
export const MEDALS: { id: MedalId; name: string; at: number }[] = [
  { id: 'gold', name: 'Gold', at: 0.5 },
  { id: 'silver', name: 'Silver', at: 0.65 },
  { id: 'bronze', name: 'Bronze', at: 1 },
];

/** What each medal pays, the first time it is reached on a Gate: Ascendant Ember, this many times the grade's own. */
export const MEDAL_PAY: Record<MedalId, number> = { bronze: 1, silver: 1, gold: 2 };

/** A medal's Ember at each grade, before `MEDAL_PAY`. */
export const PAR_EMBER: Record<Rank, number> = { E: 2, D: 3, C: 5, B: 7, A: 10, S: 13 };
