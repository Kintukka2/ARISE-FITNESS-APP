/**
 * Kin and Formation: what the squad's make-up gives, on top of what each Shadow brings (DESIGN.md,
 * "Kin and Formation"). Both are numbers on the fight's stats, fixed as a run walks in, so they change
 * how hard a blow lands or how often it does, never what a creature means to do.
 *
 * Kin: two deployed Shadows of one family each take their family's boon; three or more take it twice
 * over. Formation: each distinct role in the squad adds its aura to the hunter and every Shadow.
 * Numbers here are rules; the Guide and the Army sheet quote them.
 */

/** The Shadows of one family a Kin's tiers ask for: tier I at the first, tier II at the second. */
export const KIN_AT = [2, 3] as const;

/** Each family's boon at tier I, as gear's bonuses are written (fractions for the shares, points for the rest). Tier II is twice it. */
export const KIN: Record<string, Record<string, number>> = {
  Undead: { maxHp: 0.08, statusSave: 8 },
  Beast: { initiative: 6, patk: 0.05 },
  Goblinoid: { crit: 4, accuracy: 6 },
  Insectoid: { defense: 0.08, evasion: 4 },
  Slime: { maxHp: 0.12 },
  Plant: { statusChance: 10, resist: 0.06 },
  Construct: { defense: 0.1, resist: 0.06 },
  Humanoid: { accuracy: 8, initiative: 4 },
  Aquatic: { evasion: 6, resist: 0.06 },
  Elemental: { mpow: 0.1 },
  Orc: { patk: 0.1 },
  Giantkin: { maxHp: 0.1, patk: 0.04 },
  Demon: { mpow: 0.06, crit: 4 },
  Chimera: { patk: 0.06, mpow: 0.06 },
  Dragonkin: { resist: 0.1, mpow: 0.06 },
};

/**
 * The family that is kin to every other: one of it deployed counts toward every family beside it, and
 * takes the boon of every Kin it completes. It has no boon of its own: there is only one of it.
 */
export const KIN_ALL = 'Aberration';

/** Each role's aura, given to the hunter and every Shadow while one Shadow of that role is deployed. */
export const FORMATION: Record<string, Record<string, number>> = {
  Brute: { patk: 0.04 },
  Assassin: { crit: 3 },
  Flier: { evasion: 4 },
  'Archer / Shooter': { accuracy: 5 },
  Guardian: { defense: 0.05 },
  Caster: { mpow: 0.05 },
  Leader: { initiative: 4 },
  'Status Specialist': { statusChance: 6 },
};

/**
 * What Auto Deploy counts a point of each bonus as, as a share of a Shadow's power: a share bonus is
 * its own share, a point of the rest about what a percent of the stats it moves is worth in a fight.
 * Only Auto Deploy reads it, to weigh a squad's Kin and Formation against raw power.
 */
export const WORTH: Record<string, number> = {
  maxHp: 1, patk: 1, mpow: 1, defense: 1, resist: 1,
  initiative: 0.01, accuracy: 0.008, evasion: 0.01, crit: 0.012, statusChance: 0.005, statusSave: 0.005,
};
