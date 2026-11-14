/**
 * Gear sets, after Genshin Impact's artifact sets and Solo Leveling: Arise's armour and accessory sets (the
 * owner's call: every set had three pieces, nearly all of them a head and a chest, so only one could be worn).
 * An armour set is five pieces, one to each armour slot (head, chest, hands, legs, feet), and pays at two
 * pieces and at four: four worn leave a slot for the best piece of any other, and two of each of two sets pay
 * both their 2-piece. Its 4-piece also grants a blessing for every Gate, at a tier by its rarity, so the set
 * changes how the hunter fights, not only how hard. A jewellery set is an amulet and a ring, paying at two,
 * and is worn beside any armour set. Weapons and off-hands belong to no set: the weapon carries Familiarity.
 * Bonuses are in the units the combat engine's gear bonuses use (fractions for attack, magic, defence,
 * resistance, maximum HP and healing; flat points for the rest). Each set has a home Gate: a clear there can
 * leave one of its blueprints, and leaves the trophy its pieces are forged with. Numbers here are rules; the
 * screens quote them.
 */
export type SetKind = 'armour' | 'jewellery';

/** What a set pays once this many of its pieces are worn: bonuses, and on an armour set's 4-piece a blessing. */
export interface SetTier {
  at: number;
  bonus: Record<string, number>;
  /** A blessing (`data/blessings.ts`) the hunter carries into every Gate while the tier is worn, and its tier, 1 to 3. */
  boon?: { id: string; tier: number };
}

export interface GearSet {
  /** The name equipment designs carry in `set`. */
  id: string;
  kind: SetKind;
  /** The gate whose clears leave its pieces. */
  home: string;
  /** What it pays, fewest pieces first. */
  tiers: SetTier[];
}

/** An armour set's two tiers: its stats at two pieces; at four its stats and a blessing. */
const armour = (id: string, home: string, two: Record<string, number>, four: Record<string, number>, boon: string, tier: number): GearSet =>
  ({ id, kind: 'armour', home, tiers: [{ at: 2, bonus: two }, { at: 4, bonus: four, boon: { id: boon, tier } }] });
/** A jewellery set: an amulet and a ring, paying when both are worn. */
const jewellery = (id: string, home: string, two: Record<string, number>): GearSet => ({ id, kind: 'jewellery', home, tiers: [{ at: 2, bonus: two }] });

export const SETS: GearSet[] = [
  // Rare: their 4-piece blessings at tier I.
  armour('Champion', 'DNG-015', { patk: 0.08, mpow: 0.08 }, { crit: 6, accuracy: 6 }, 'quick', 1),
  armour('Runic', 'DNG-027', { statusChance: 6 }, { mpow: 0.14 }, 'kindle', 1),
  armour('Ravager', 'DNG-019', { crit: 5 }, { patk: 0.14 }, 'rend', 1),
  armour('Warden', 'DNG-018', { defense: 0.1 }, { maxHp: 0.12, resist: 0.1 }, 'iron', 1),
  jewellery('Oathkeeper', 'DNG-015', { maxHp: 0.06, recovery: 0.1 }),
  // Epic: tier I.
  armour('Dread', 'DNG-029', { statusChance: 8 }, { patk: 0.12, mpow: 0.12, crit: 4 }, 'wither', 1),
  armour('Infernal', 'DNG-032', { resist: 0.14 }, { mpow: 0.18 }, 'siphon', 1),
  armour('Chimeric', 'DNG-035', { evasion: 6 }, { initiative: 10, crit: 6 }, 'riposte', 1),
  armour('Void', 'DNG-042', { accuracy: 8 }, { mpow: 0.12, statusSave: 10 }, 'linger', 1),
  jewellery('Emberheart', 'DNG-032', { patk: 0.07, mpow: 0.07 }),
  // Heroic: tier II.
  armour('Phylactery', 'DNG-043', { maxHp: 0.14 }, { recovery: 0.15, statusSave: 12 }, 'breath', 2),
  armour('Drake Lord', 'DNG-045', { patk: 0.12 }, { crit: 10 }, 'sweep', 2),
  armour('Titan', 'DNG-047', { defense: 0.15 }, { patk: 0.18, maxHp: 0.1 }, 'jugg', 2),
  armour('Triune', 'DNG-047', { statusSave: 12 }, { initiative: 12, accuracy: 10 }, 'spotter', 2),
  jewellery('Lichbound', 'DNG-043', { statusChance: 10, statusSave: 10 }),
  // Legendary: tier III.
  armour('Ancient Dragon', 'DNG-048', { maxHp: 0.18 }, { patk: 0.2, mpow: 0.2 }, 'unbroken', 3),
  armour('Demon Lord', 'DNG-049', { statusChance: 12 }, { mpow: 0.24 }, 'doom', 3),
  armour('Death Sovereign', 'DNG-050', { crit: 10 }, { initiative: 14, patk: 0.15 }, 'killshot', 3),
  armour('Eclipse', 'DNG-050', { evasion: 10 }, { resist: 0.2, defense: 0.2 }, 'after', 3),
  jewellery('Monarch', 'DNG-050', { crit: 8, initiative: 10 }),
];

export const setById = (id: string | undefined) => SETS.find((x) => x.id === id);

/**
 * Auto Equip's lean toward a set the hunter holds two or more pieces of: each piece counts this share of its
 * rarity's score more, for each other piece held, up to `SET_LEAN_MOST` others. It is more than quality can
 * span, so a set piece beats any piece of its own rarity, and only a much rarer one beats the set.
 */
export const SET_KEEP = 0.6;
/** The most other pieces of a set Auto Equip's lean counts: past a 4-piece's three others, a fifth adds nothing. */
export const SET_LEAN_MOST = 3;

/**
 * Upgrading: each step moves a piece's quality and every property `share` of
 * the way across its design's range, toward the best. `rate` prices a point of
 * the score a step adds; `data/forge.ts` says what share of it a step charges,
 * and the alloys it takes.
 */
export const UPGRADE = { share: 0.1, rate: 50 } as const;

/** Loadouts a hunter can keep: what was worn, saved to be worn again in one tap. */
export const LOADOUTS = 3;
