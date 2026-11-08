/**
 * The Forge: gear is made, not found. Gates leave materials, and now and then a blueprint; a
 * blueprint, once learned, is kept, and forges its design as often as the materials allow, each piece
 * rolled anew. Recycling a piece gives materials back. Numbers here are rules; the screens quote them.
 *
 * Materials, four kinds:
 * - Alloys, one to each rarity, the backbone of every recipe and every upgrade of that rarity. A Gate
 *   leaves its own grade's, and some of the grade below.
 * - Parts, left by the creatures felled, by family: Hide for armour, Bone for weapons, Mana Cores for
 *   off-hands and jewellery.
 * - Trophies, one to the boss of each Gate a set calls home: a set's pieces are forged with one.
 * - Ascendant Ember, from clears entered at an Ascension level: the steps past perfect take it.
 */
import type { Rank } from '@/core/types';

export type MaterialKind = 'alloy' | 'part' | 'trophy' | 'ember';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  /** The rarity an alloy belongs to. */
  rank?: Rank;
  desc: string;
}

/** The alloys, a rung to each rarity, Common to Legendary. */
export const ALLOYS: Record<Rank, Material> = {
  E: { id: 'alloy-E', name: 'Iron Scrap', kind: 'alloy', rank: 'E', desc: 'Iron from the first Gates, beaten flat.' },
  D: { id: 'alloy-D', name: 'Gatesteel', kind: 'alloy', rank: 'D', desc: 'Steel that came out of a Gate harder than it went in.' },
  C: { id: 'alloy-C', name: 'Mana Silver', kind: 'alloy', rank: 'C', desc: 'Silver that holds mana the way water holds heat.' },
  B: { id: 'alloy-B', name: 'Runesteel', kind: 'alloy', rank: 'B', desc: 'Steel with writing in the grain that no smith put there.' },
  A: { id: 'alloy-A', name: 'Abyssal Iron', kind: 'alloy', rank: 'A', desc: 'Black iron from the deep Gates. It is always cold.' },
  S: { id: 'alloy-S', name: 'Sovereign Steel', kind: 'alloy', rank: 'S', desc: 'Metal from the seats of the strongest. It hums when struck.' },
};

export const PARTS = {
  hide: { id: 'part-hide', name: 'Monster Hide', kind: 'part', desc: 'Hide, scale and chitin. Armour is made of it.' },
  bone: { id: 'part-bone', name: 'Monster Bone', kind: 'part', desc: 'Bone and fang, harder than steel. Weapons are made of it.' },
  core: { id: 'part-core', name: 'Mana Core', kind: 'part', desc: 'The stone a creature’s mana gathers in. Off-hands and jewellery are made of it.' },
} as const satisfies Record<string, Material>;
export type PartKey = keyof typeof PARTS;

export const EMBER: Material = { id: 'ember', name: 'Ascendant Ember', kind: 'ember', desc: 'What is left where the air was heavier. Steps past perfect take it.' };

/** What each kind of piece is made of, besides its alloy. */
export const PART_FOR: Record<string, PartKey> = {
  Head: 'hide', Chest: 'hide', Hands: 'hide', Legs: 'hide', Feet: 'hide',
  Weapon: 'bone', 'Off-Hand': 'core', Amulet: 'core', Ring: 'core',
};

/** The part each family of creature leaves. */
export const FAMILY_PART: Record<string, PartKey> = {
  Beast: 'hide', Dragonkin: 'hide', Chimera: 'hide', Aquatic: 'hide', Insectoid: 'hide',
  Undead: 'bone', Giantkin: 'bone', Orc: 'bone', Goblinoid: 'bone', Humanoid: 'bone',
  Demon: 'core', Elemental: 'core', Slime: 'core', Construct: 'core', Aberration: 'core', Plant: 'core',
};

/**
 * A recipe, by rarity (E to S in order): alloys of its own rarity, alloys of the rarity below, its
 * part, and Mana Shards. A set's piece also takes one trophy of its home Gate's boss.
 */
export const RECIPE = {
  alloy: [8, 10, 12, 16, 20, 24],
  lower: [0, 2, 3, 3, 4, 5],
  part: [2, 3, 4, 5, 6, 8],
  /** Mana Shards: this many clears' worth at the rarity's grade. */
  shards: 1.5,
  trophy: 1,
} as const;

/**
 * Upgrading, a step at a time: alloys of the piece's rarity and Mana Shards. A step past perfect also
 * takes Ascendant Ember, one more for every step already past.
 */
export const UPGRADE_COST = {
  alloy: [1, 2, 2, 3, 3, 4],
  /** The shards a step costs, as a share of the score it adds at `sets.UPGRADE.rate`. */
  shards: 0.45,
  /** Past perfect: alloys, and Ember for the k-th step past (k from 1). */
  overAlloy: 5,
  ember: 1,
} as const;

/**
 * Recycling: a share of the recipe's alloy and part back, and a share of the alloy its upgrades took.
 * Issued kit is iron, and gives Iron Scrap.
 */
export const SALVAGE = { alloy: 0.4, part: 0.5, upgrades: 0.5, issued: 2, masterwork: 2 } as const;

/** What a run leaves, by the Gate's grade. Fights, gatekeepers and the clear each leave alloy; felled creatures leave parts. */
export const DROPS = {
  /** Each fight: `fight` alloy of the grade, a chance of one more, and a chance of one of the grade below. */
  fight: 1, fightExtra: 0.35, fightLower: 0.35,
  /** Each gatekeeper: alloy of the grade, and a part. */
  elite: 2, elitePart: 1,
  /** The clear: alloy of the grade, `clear` to `clear + clearSpread`, and of the grade below. */
  clear: 2, clearSpread: 2, clearLower: 1,
  /** Each creature felled leaves its family's part this often; the clear leaves `clearParts` of every part besides. */
  part: 0.15, clearParts: 1,
  /** Ascendant Ember on a clear: this many for each Ascension level it was entered at, rounded up. */
  ember: 0.5,
  /** A Chosen felled leaves this many Ember for each of its levels. */
  chosenEmber: 2,
  /** A carried-out party leaves with nothing, as ever; a withdrawal keeps what it found. */
} as const;

/**
 * Blueprints, rare: a sure one for every Gate's first clear, a chance on any other clear and from a
 * gatekeeper, and a set's own from its home Gate. Drawn among the designs not yet known, of the kind
 * of piece the hunter knows fewest of at that rarity. When every design of a rarity is known, the
 * System leaves `known` of its alloy instead.
 */
export const BLUEPRINTS = {
  first: 1,
  clear: 0.1,
  elite: 0.03,
  /** A Gatekeeper's vault, opened, leaves a blueprint of the Gate's grade this often when the run is not carried out. */
  vault: 0.12,
  /** A set's home Gate leaves one of its blueprints not yet known this often on a clear, and surely on its first. */
  home: 0.3,
  /** A blueprint is one rarity up this often, below Legendary. */
  up: 0.15,
  known: 10,
  /** A rank claimed pays this many of its grade's blueprints, of the kinds known fewest of. */
  rank: 3,
  /** The Exchange: blueprints on the shelf each day, and the price per point of the design's score. */
  shelf: 4,
  price: 12,
} as const;

/** A forged piece found whole: rare. A clear's chance, a cache's and a vault's. */
export const FORGED = { clear: 0.04, cache: 0.1, vault: 0.2 } as const;

/**
 * A cache on the map: alloy of the grade below, `alloy` to `alloy + 2`, and a part. A Gatekeeper's
 * vault: alloy of the Gate's own grade, `vault` to `vault + 2`, and two parts.
 */
export const CACHE = { alloy: 2, vault: 5 } as const;

/**
 * Weapon Familiarity: every creature the party fells while a weapon is carried in is a point toward
 * knowing its design. Each rank adds to attack and magic while it is worn, and raises the floor of
 * every roll when the design is forged: its quality and its properties start that share of the way up.
 */
export const FAMILIARITY = {
  at: [40, 120, 260, 480, 800],
  bonus: 0.02,
  floor: 0.08,
} as const;
export const FAMILIARITY_MAX = FAMILIARITY.at.length;
