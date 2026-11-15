/**
 * Tempering: Ascendant Ember's sink at perfect (docs/DESIGN.md, "Tempering — built"). A piece of C-Rank or
 * higher, perfect, opens one Temper slot. The hunter chooses one of its slot's properties; its size rolls
 * within that property's range at the piece's rarity, seeded from the piece and how often it has been
 * tempered. A second temper shows the new roll against the old, and the hunter keeps either, so nothing is
 * ever lost. Each costs more than the last, up to a cap. Numbers here are rules; the screens quote them.
 */
import type { Rank } from '@/core/types';

/** The lowest rarity a piece can be tempered at: the first whose designs carry properties. */
export const TEMPER_FROM: Rank = 'C';

/** A first temper's Ascendant Ember, by the piece's rarity. */
export const TEMPER_EMBER: Record<Rank, number> = { E: 0, D: 0, C: 8, B: 12, A: 20, S: 30 };

/** Its Mana Shards, in Gate clears' worth of the piece's grade. */
export const TEMPER_SHARDS = 1;

/** Each temper after the first on a piece costs this share of the first more, up to `TEMPER_CAP` times it. */
export const TEMPER_STEP = 0.5;
export const TEMPER_CAP = 3;

/**
 * The System's choice of property, best first: the balance tools' hunter who keeps up tempers each perfect
 * piece it wears with the first of these its slot offers, at the middle of its range (`temper.autoTemper`).
 */
export const AUTO_TEMPER = [
  'Critical Chance', 'Max HP', 'Defense', 'Accuracy', 'Physical Attack', 'Magic Power', 'Resistance', 'Evasion',
  'Status Save', 'Initiative', 'Status Chance', 'Status Potency', 'Healing Received',
];
