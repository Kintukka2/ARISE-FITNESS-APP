/**
 * Engravings: a power cut into a piece that changes a rule of the fight, not a number on a stat. Each
 * family of creature has its own, left by its bosses and Gatekeepers on a piece found whole. Recycling an
 * engraved piece keeps its power in the Codex for good; a power from the Codex is cut into any piece of
 * its kind for Ascendant Ember. A worn piece's engraving is live, one to each kind of gear: weapon,
 * armour and jewellery (docs/DESIGN.md, "Engravings and a Codex").
 *
 * The kind follows the part the family leaves, so the families that leave bone (the armed ones) cut
 * weapons, those that leave hide cut armour, and those that leave a core cut jewellery.
 */
import type { Rank } from '@/core/types';

export type EngraveGroup = 'weapon' | 'armour' | 'jewellery';

export type EngravingId =
  | 'orc' | 'giantkin' | 'undead' | 'goblinoid' | 'humanoid'
  | 'beast' | 'dragonkin' | 'chimera' | 'aquatic' | 'insectoid'
  | 'demon' | 'elemental' | 'slime' | 'construct' | 'aberration' | 'plant';

/** What each engraving does, as numbers the fight and the cards both read. */
export const ENGRAVE = {
  /** Warcry: defeating a foe leaves every Shadow Rallied for these turns. */
  warcry: 2,
  /** Siegebreaker: the extra break pips each hit takes off a foe Charging or Channelling. */
  siege: 1,
  /** Withering Strike: Strike inflicts Weakened for these turns. */
  wither: 2,
  /** Flask Thrower: what is thrown also hits each foe it reaches for this share of a Strike. */
  flask: 0.6,
  /** Pack Hide: Guard inflicts Weakened for these turns on each foe aimed at the hunter. */
  pack: 2,
  /** Shapeshift: Cover leaves the ally Veiled for these turns. */
  shift: 2,
  /** Tidewater: a Health Potion leaves the hunter Veiled for these turns. */
  tide: 1,
  /** Overcharge: critical hits inflict Chilled for these turns. */
  overcharge: 2,
  /** Engulf: defeating a foe restores this share of each Shadow's maximum HP. */
  engulf: 0.1,
  /** Unseen: the hunter starts each fight Veiled for these turns. */
  unseen: 2,
  /** Overgrowth: each Shadow restores this share of its maximum HP at the end of each round. */
  overgrowth: 0.03,
} as const;

const pct = (x: number) => Math.round(x * 100);
const turns = (n: number) => (n === 1 ? '1 turn' : `${n} turns`);

export interface Engraving {
  id: EngravingId;
  /** The family whose bosses and Gatekeepers leave it. */
  family: string;
  group: EngraveGroup;
  name: string;
  /** The rule, one line, its numbers read from `ENGRAVE`. */
  text: string;
  /** Needs the hunter's own hands: it rides on Guard, Cover, a potion or a throw, which Auto never orders. */
  hands?: boolean;
}

export const ENGRAVINGS: Engraving[] = [
  // Weapons, from the families that leave bone.
  { id: 'orc', family: 'Orc', group: 'weapon', name: 'Warcry', text: `Defeating a foe leaves every Shadow Rallied for ${turns(ENGRAVE.warcry)}.` },
  { id: 'giantkin', family: 'Giantkin', group: 'weapon', name: 'Siegebreaker', text: `Your hits on a foe Charging or Channelling take ${ENGRAVE.siege + 1} break pips, not 1.` },
  { id: 'undead', family: 'Undead', group: 'weapon', name: 'Withering Strike', text: `Strike inflicts Weakened for ${turns(ENGRAVE.wither)}.` },
  { id: 'goblinoid', family: 'Goblinoid', group: 'weapon', name: 'Dirty Trick', text: 'Your hits on a Rooted or Stunned foe are critical.' },
  { id: 'humanoid', family: 'Humanoid', group: 'weapon', name: 'Flask Thrower', hands: true, text: `What you throw also hits each foe it reaches for ${pct(ENGRAVE.flask)}% of a Strike.` },
  // Armour, from the families that leave hide.
  { id: 'beast', family: 'Beast', group: 'armour', name: 'Pack Hide', hands: true, text: `Guard also inflicts Weakened for ${turns(ENGRAVE.pack)} on each foe whose next action is aimed at you.` },
  { id: 'dragonkin', family: 'Dragonkin', group: 'armour', name: 'Dragonscale', text: 'You cannot be Burning or Poisoned.' },
  { id: 'chimera', family: 'Chimera', group: 'armour', name: 'Shapeshift', hands: true, text: `Cover also leaves the ally Veiled for ${turns(ENGRAVE.shift)}.` },
  { id: 'aquatic', family: 'Aquatic', group: 'armour', name: 'Tidewater', hands: true, text: `A Health Potion also clears your debuffs and leaves you Veiled for ${turns(ENGRAVE.tide)}.` },
  { id: 'insectoid', family: 'Insectoid', group: 'armour', name: 'Carapace', text: 'The first hit you take in each fight deals no damage.' },
  // Jewellery, from the families that leave a core.
  { id: 'demon', family: 'Demon', group: 'jewellery', name: 'Hellbrand', text: 'A foe you set Burning is also Cursed for as long.' },
  { id: 'elemental', family: 'Elemental', group: 'jewellery', name: 'Overcharge', text: `Critical hits inflict Chilled for ${turns(ENGRAVE.overcharge)}.` },
  { id: 'slime', family: 'Slime', group: 'jewellery', name: 'Engulf', text: `Defeating a foe restores ${pct(ENGRAVE.engulf)}% of each Shadow’s maximum HP.` },
  { id: 'construct', family: 'Construct', group: 'jewellery', name: 'Bulwark Core', hands: true, text: 'Guard also guards each of your Shadows until its next turn.' },
  { id: 'aberration', family: 'Aberration', group: 'jewellery', name: 'Unseen', text: `You start each fight Veiled for ${turns(ENGRAVE.unseen)}.` },
  { id: 'plant', family: 'Plant', group: 'jewellery', name: 'Overgrowth', text: `At the end of each round, each Shadow restores ${pct(ENGRAVE.overgrowth)}% of its maximum HP.` },
];

/** The style the fight reads an engraving by, as it reads a passive's. */
export const engraveStyle = (id: EngravingId) => `engrave_${id}`;

/** As passives, so the fight's units carry them by name the way they carry the tree's. */
export const ENGRAVE_PASSIVES = ENGRAVINGS.map((e) => ({ name: e.name, style: engraveStyle(e.id), text: e.text }));

export const GROUPS: { key: EngraveGroup; name: string; slots: string[] }[] = [
  { key: 'weapon', name: 'Weapon', slots: ['Weapon', 'Off-Hand'] },
  { key: 'armour', name: 'Armour', slots: ['Head', 'Chest', 'Hands', 'Legs', 'Feet'] },
  { key: 'jewellery', name: 'Jewellery', slots: ['Amulet', 'Ring'] },
];

/** The odds a Gate's boss, and its Gatekeeper, leave a piece found whole with their family's engraving. */
export const ENGRAVED = { boss: 0.08, keeper: 0.12 } as const;

/** What cutting a power from the Codex into a piece costs, in Ascendant Ember, by the piece's rarity. */
export const ENGRAVE_EMBER: Record<Rank, number> = { E: 15, D: 25, C: 40, B: 60, A: 90, S: 120 };

/**
 * The System's choice of engraving for each kind, best first among those it knows: never one that needs
 * the hunter's hands, since Auto gives no such orders. The balance tools' hunter who keeps up carries
 * the first of each (`autoEngrave`).
 */
export const AUTO_ENGRAVE: Record<EngraveGroup, EngravingId[]> = {
  weapon: ['undead', 'giantkin', 'goblinoid', 'orc'],
  armour: ['insectoid', 'dragonkin'],
  jewellery: ['plant', 'slime', 'elemental', 'aberration', 'demon'],
};

export const engravingById = (id: string | undefined) => ENGRAVINGS.find((e) => e.id === id);
export const engravingOfFamily = (family: string | undefined) => ENGRAVINGS.find((e) => e.family === family);
export const groupOfSlot = (slot: string | undefined) => GROUPS.find((g) => g.slots.includes(slot ?? ''))?.key;
