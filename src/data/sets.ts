/**
 * Gear sets. Every set in `equipment.ts` has three pieces, and wearing two or
 * all three of them pays a bonus, in the units the combat engine's gear
 * bonuses use (fractions for attack, magic, defence, resistance, maximum HP and
 * healing; flat points for the rest). Each set has a home gate: a clear there
 * leaves one of its pieces. Numbers here are rules; the screens quote them.
 */
export interface GearSet {
  /** The name equipment designs carry in `set`. */
  id: string;
  /** The gate whose clears leave its pieces. */
  home: string;
  two: Record<string, number>;
  three: Record<string, number>;
}

export const SETS: GearSet[] = [
  // Rare
  { id: 'Champion', home: 'DNG-015', two: { patk: 0.08, mpow: 0.08 }, three: { crit: 6, accuracy: 6 } },
  { id: 'Runic', home: 'DNG-027', two: { statusChance: 6 }, three: { mpow: 0.14 } },
  { id: 'Ravager', home: 'DNG-019', two: { crit: 5 }, three: { patk: 0.14 } },
  { id: 'Warden', home: 'DNG-018', two: { defense: 0.1 }, three: { maxHp: 0.12, resist: 0.1 } },
  // Epic
  { id: 'Dread', home: 'DNG-029', two: { statusChance: 8 }, three: { patk: 0.12, mpow: 0.12, crit: 4 } },
  { id: 'Infernal', home: 'DNG-032', two: { resist: 0.14 }, three: { mpow: 0.18 } },
  { id: 'Chimeric', home: 'DNG-035', two: { evasion: 6 }, three: { initiative: 10, crit: 6 } },
  { id: 'Void', home: 'DNG-042', two: { accuracy: 8 }, three: { mpow: 0.12, statusSave: 10 } },
  // Heroic
  { id: 'Phylactery', home: 'DNG-043', two: { maxHp: 0.14 }, three: { recovery: 0.15, statusSave: 12 } },
  { id: 'Drake Lord', home: 'DNG-045', two: { patk: 0.12 }, three: { crit: 10 } },
  { id: 'Titan', home: 'DNG-047', two: { defense: 0.15 }, three: { patk: 0.18, maxHp: 0.1 } },
  { id: 'Triune', home: 'DNG-047', two: { statusSave: 12 }, three: { initiative: 12, accuracy: 10 } },
  // Legendary
  { id: 'Ancient Dragon', home: 'DNG-048', two: { maxHp: 0.18 }, three: { patk: 0.2, mpow: 0.2 } },
  { id: 'Demon Lord', home: 'DNG-049', two: { statusChance: 12 }, three: { mpow: 0.24 } },
  { id: 'Death Sovereign', home: 'DNG-050', two: { crit: 10 }, three: { initiative: 14, patk: 0.15 } },
  { id: 'Eclipse', home: 'DNG-050', two: { evasion: 10 }, three: { resist: 0.2, defense: 0.2 } },
];

export const setById = (id: string | undefined) => SETS.find((x) => x.id === id);

/**
 * Auto Equip's lean toward a set the hunter holds two or more pieces of: each
 * piece counts this share of its rarity's score more, for each other piece held.
 * It is more than quality can span, so a set piece beats any piece of its own
 * rarity, and only a much rarer one beats the set.
 */
export const SET_KEEP = 0.6;

/**
 * Upgrading: each step moves a piece's quality and every property `share` of
 * the way across its design's range, toward the best, and costs `rate` shards
 * for each point of score the step adds to a piece of its rarity.
 */
export const UPGRADE = { share: 0.1, rate: 50 } as const;
