import type { Rank } from '@/core/types';

/** Shadows a hunter can deploy at each grade, before Secret Quests add more. */
export const SLOTS: Record<Rank, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 };

/**
 * The ranks of the Shadow army. A Shadow is promoted by the kills it lands,
 * and each rank lifts how far those kills can grow it. Numbers here are rules;
 * the screens quote them.
 */
export const SHADOW_RANKS: { name: string; kills: number; cap: number }[] = [
  { name: 'Bound', kills: 0, cap: 0.25 },
  { name: 'Sworn', kills: 25, cap: 0.5 },
  { name: 'Vanguard', kills: 75, cap: 0.75 },
  { name: 'Ascendant', kills: 150, cap: 1 },
];

/** The rank, by index, at which a Shadow remembers its second ability. */
export const SECOND_AT = 1;
