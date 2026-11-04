import type { Rank } from '@/core/types';

/** Shadows a hunter can deploy at each grade, before Secret Quests add more. */
export const SLOTS: Record<Rank, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 };

/**
 * The ranks of the Shadow army. A Shadow levels on the creatures it helps fell, as far as its rank's
 * `cap`. Promotion past the cap costs Shadow Essence and wants bosses felled (`essence` and `bosses`
 * are what the rank itself asks), and it lifts the cap. Numbers here are rules; the screens quote them.
 */
export const SHADOW_RANKS: { name: string; cap: number; essence: number; bosses: number }[] = [
  { name: 'Bound', cap: 10, essence: 0, bosses: 0 },
  { name: 'Sworn', cap: 20, essence: 4, bosses: 0 },
  { name: 'Vanguard', cap: 30, essence: 12, bosses: 1 },
  { name: 'Ascendant', cap: 40, essence: 30, bosses: 4 },
];

/** The rank, by index, at which a Shadow remembers its second ability. */
export const SECOND_AT = 1;

/** Experience a Shadow takes from a creature it helped fell, and from a boss. */
export const SHADOW_XP = { kill: 1, boss: 5 } as const;

/** Experience from one level to the next: `base`, and `step` more for every level held. */
export const LEVEL_XP = { base: 2, step: 1.5 } as const;

/** Every attribute grows by this share of its creature's own for every level. */
export const GROWTH_PER_LEVEL = 0.025;

/** Shadow Essence from a creature already in the army, extracted again, by its grade. A boss gives twice as much. */
export const ESSENCE: Record<Rank, number> = { E: 1, D: 2, C: 2, B: 3, A: 3, S: 4 };

/** A creature already in the army lingers this many times as often as one that is not. */
export const ECHO = 3;
