/** Shared shapes for the game data and the save. */
import type { ContractKind } from '@/data/contracts';
import type { UnitSpec } from './combat';

export const STATS = ['STR', 'AGI', 'PER', 'VIT', 'INT'] as const;
export type Stat = (typeof STATS)[number];
export type Attrs = Record<Stat, number>;

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

// ------------------------------------------------------------------ gear

export type SlotKey = 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'weapon' | 'offhand' | 'amulet' | 'ring1' | 'ring2';
export type GearSlot = 'Head' | 'Chest' | 'Hands' | 'Legs' | 'Feet' | 'Weapon' | 'Off-Hand' | 'Amulet' | 'Ring';

export interface GearRoll { stat: string; min: number; max: number; pct: boolean }

export interface GearDef {
  id: string;
  name: string;
  rank: Rank;
  slot: GearSlot | string;
  core: Partial<Attrs>;
  set?: string;
  rolls?: GearRoll[];
  issued?: boolean;
  desc?: string;
}

/** A loadout: what was worn in each slot when it was saved. */
export interface Loadout { slots: Partial<Record<SlotKey, string>>; at: string }

export interface Item {
  id: string;
  defId: string;
  /** Multiplier on the core bonus, 0.75–1.25. 1 for issued kit. */
  q: number;
  /** One value per def roll. */
  rolls: number[];
  /** Upgrade steps bought for it at the Exchange. */
  up?: number;
  /** Of those, the steps taken past its design's best. */
  over?: number;
  /** A masterwork: the Ascension level of the Chosen that left it. */
  master?: number;
}

// ------------------------------------------------------------------ combat data

export type AbilityProfile = 'single' | 'cleave' | 'volley' | 'spread' | 'burst' | 'wild' | 'all' | 'support' | 'taunt';

export interface Ability {
  name: string;
  type: 'physical' | 'magic';
  /** Who it reaches. `support` is the user's whole side; `taunt` turns every foe's next action on the user. */
  profile: AbilityProfile | string;
  /** Its force. 0 is a curse: it does no damage, cannot miss, and what it inflicts lands unless the target is immune. */
  mult: number;
  cd: number;
  inflicts: string[];
  /** A support's share of each ally's maximum HP restored. */
  heal?: number;
  /** A support's good status for the whole side. A support with neither this nor `heal` rallies. */
  grant?: string;
}

export type PassiveStyle =
  | 'identity' | 'tempo' | 'brace' | 'escalation' | 'targeting' | 'survival'
  | 'leadership' | 'arcane' | 'pack' | 'hazard' | 'bulwark' | 'bladework' | 'keen'
  // The skill tree's own: only a hunter has them (`data/tree.ts`).
  | 'vamp' | 'momentum' | 'ambush' | 'flurry' | 'execute' | 'deadeye' | 'thorns' | 'stalwart' | 'affliction' | 'exploit';

export interface Passive { name: string; style: PassiveStyle | string; text: string }

export interface Enemy {
  id: string;
  name: string;
  /** What it is called once it has been bound as a Shadow. */
  shadow: string;
  rank: Rank | string;
  family: string;
  role: string;
  base: Attrs;
  kit: string[];
  passive?: string;
  imm: string[];
  res: string[];
}

export interface Dungeon {
  id: string;
  rank: Rank | string;
  name: string;
  theme: string;
  identity: string;
  mobs: string[];
  elite?: string;
  boss: string;
  mobRounds: number;
  /** A block of the Spire: the floor it starts on, its difficulty, which no calibrated gate holds, and the gate it takes the shape of. */
  floor?: number;
  scale?: number;
  shape?: string;
  /** A Trial of Ascension: how many of the Chosen stand in it, one to a layer, and the round of the first. */
  trial?: number;
  trialFrom?: number;
}

// ------------------------------------------------------------------ orders

/** What the hunter does with a turn: a skill from the kit by name, or `Strike`, `Guard` or `Potion`. `at` is the foe aimed at. */
export interface Order { use: string; at?: string }

/** Standing orders: whom the hunter's Shadows aim at, and the hunter too when Auto fights their turns. The Association's hunters pick their own. */
export type Tactic = 'default' | 'finish' | 'protect' | 'spread';

// ------------------------------------------------------------------ save

export interface Shadow {
  /** Unique per binding. */
  id: string;
  /** The enemy it was. */
  enemyId: string;
  boundAt: string;
  /** Runs it walked into. */
  out: number;
  /** Creatures it helped fell: it landed a hit on each, whoever landed the last. */
  kills: number;
  /** Of those, bosses. */
  bosses: number;
  /** The rank it holds, by index into SHADOW_RANKS. The hunter claims the next, for Shadow Essence. */
  rank: number;
  /** Experience, all told. Its level is what this reaches, as far as its rank's cap; the rest is banked. */
  xp: number;
  /** Awakening stars, bought with Shadow Essence once Ascendant at its cap. */
  stars?: number;
  /** The name the hunter bestowed on it, if any. Unset, it goes by what it was: `Shadow {creature}`. */
  name?: string;
}

export interface OpenRaid {
  dungeonId: string;
  seed: string;
  /** The day it was entered: the allies are drawn from it. */
  day: string;
  /** Steps on the map already done. */
  at: number;
  squad: string[];
  /** Party hp/status carried between chambers. */
  carried: { hp: number; status: Record<string, number> }[];
  won: number;
  felled: string[];
  kills: Record<string, { kills: number; bosses: number }>;
  startHp: number;
  bossFaced: boolean;
  /** Everyone as they walked in, fixed for the whole run so a chamber always replays the same. */
  party: UnitSpec[];
  /** The standing orders its fights are fought on. Set while a step is underway, they reach the run when its next step is chosen. */
  tactic: Tactic;
  /**
   * The hunter's orders so far in the chamber being fought, null where the
   * System chose. The fight is deterministic, so these replay it exactly.
   */
  orders: (Order | null)[];
  /** The map's seed, and the steps chosen on it so far, the last of them perhaps still underway. */
  map: string;
  path: string[];
  /** How the map is drawn: a Gate's labyrinth floors. Runs opened before them walk the smaller floors (`floors`), one floor of rooms (`rooms`), or the tower they began on (none). */
  layout?: 'labyrinth' | 'floors' | 'rooms' | 'layers';
  /** The room the hunter stands in: the last entered, or walked back to. Unset, the entrance. */
  pos?: string;
  /** The rests the run has used: each heals once. */
  rested?: string[];
  /** Gear, materials and shards found on the way, paid out when the run ends unless the party is carried out. */
  haul: string[];
  stash?: Record<string, number>;
  purse: number;
  /** The design of the weapon carried in: the creatures the run fells are points toward knowing it. */
  weapon?: string | null;
  /** Blessings picked up at shrines and events, on the hunter for the rest of the run. */
  blessings: string[];
  /** A chamber was lost: the run is over, waiting to be settled. */
  lost: boolean;
  /** The hunter's fatigue as they walked in, before this gate added its own. */
  fatigue: number;
  /** The Ascension level it was entered at. */
  ascension?: number;
  /** The level of the Chosen met in the boss's place, if one held the gate and the run was entered high enough. */
  chosen?: number | null;
  /**
   * The Gate's budget of moves, fixed as the run walked in (`clock.budgetOf`). Unset, the run has no clock:
   * a tower, the Practice Gate, or a run opened before the clock.
   */
  clock?: number;
  /** Moves walked so far: rooms entered and corridors walked back through (`clock.walkMoves`). */
  moves?: number;
  /** The hunter's rank as they walked in: what a Red Gate raises its creatures above. Sovereign is a grade past S. */
  held?: Rank | 'N';
}

/** What a week on the Spire paid when it closed. */
export interface SeasonPay {
  /** The Monday it began. */
  season: string;
  best: number;
  tier: string;
  shards: number;
  /** The design of the piece of gear it paid, if any (weeks closed before the Forge). */
  item: string | null;
  /** The blueprint it paid, if any; or, every design of its rarity known, the alloy it paid instead. */
  blueprint?: string | null;
  mats?: Record<string, number>;
}

/** One of the day's System contracts, and how far along it is. */
export interface Contract {
  kind: ContractKind;
  /** How many it takes, and how many are in. */
  need: number;
  got: number;
  done: boolean;
  /** The family to fell. */
  family?: string;
  /** The fatigue to walk in carrying. */
  at?: number;
  /** Gates open this morning where it can be done, where that depends on the gate. */
  where?: string[];
}

export interface LogEntry { day: string; kind: 'gate'; name: string; xp: number }

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  fastText: boolean;
  /** A phone notification when fatigue has faded or the lockout has lifted. */
  reminders: { on: boolean };
  /** Purchases and uses the hunter has asked not to be asked about again, by key (`buy:hp`, `drink:mp`, `buy:shelf`). */
  skipAsk: string[];
}

/** What can be held in stock: the four potions, the Association's Gate Survey, and what the hunter throws. */
export type StockId = 'hp' | 'mp' | 'fatigue' | 'elixir' | 'survey' | 'flash' | 'cord' | 'ember';

export interface Stats {
  xpTotal: number;
  extractions: number;
  extractionsWon: number;
  killsByFamily: Record<string, number>;
  /** Gates cleared above the hunter's own grade. */
  reachClears: number;
  /** Clears that came straight after being carried out. */
  comebacks: number;
  /** System contracts completed, and days on which every one of them was. */
  contracts: number;
  contractDays: number;
  /** Pieces forged at the Forge. */
  crafted: number;
  /** Gates cleared with every room in them cleared too. */
  charted: number;
}

export interface Save {
  v: number;
  createdAt: string;
  onboarded: boolean;

  hunter: {
    name: string;
    regNo: string;
    level: number;
    xp: number;
    /**
     * The rank the hunter holds. A level only qualifies them for the next one; they claim it from its
     * Reclassification quest (`progression.reclassify`). Sovereign is `N`.
     */
    rank: Rank | 'N';
    attrs: Attrs;
    points: number;
    classId: string | null;
    missions: string[];
    /**
     * The skill tree (`core/skilltree.ts`): the points held in each node by its id, the skills
     * taken into a fight in slot order, and how many times the tree has been reset. Skill Points
     * are not stored: they are what the level and the rank have earned, less what is held here.
     */
    tree: { learned: Record<string, number>; equip: string[]; resets: number };
  };

  vitals: { hp: number | null; mp: number | null; fatigue: number; at: number | null; lockedUntil: number | null };
  /** `bought` counts shards paid for with money; `receipts` are store transactions already credited. */
  wallet: { shards: number; earned: number; spent: number; bought: number; receipts: string[] };

  items: Item[];
  equipped: Partial<Record<SlotKey, string>>;
  favourites: string[];
  /** Every design id ever held. */
  found: string[];
  /** Items come into the bag since the hunter last looked: marked New until they have been. */
  newItems: string[];
  /** Equipment saved to be worn again in one tap, a slot to item map each. Three at most. */
  loadouts: (Loadout | null)[];
  /** The Forge (`core/forge.ts`): materials held by id, the designs whose blueprints are known, and each weapon design's familiarity in points. */
  materials: Record<string, number>;
  blueprints: string[];
  familiarity: Record<string, number>;
  /** Materials the hunter has tagged to find: the board marks the Gates that leave them. */
  tracked: string[];

  gates: {
    clears: number;
    fails: number;
    withdrawn: number;
    /** Distinct dungeon ids ever cleared. */
    cleared: string[];
    /** Gates closed by clearing them today. */
    sealed: { day: string | null; ids: string[] };
    runs: Record<string, { fought: number; cleared: number }>;
    raid: OpenRaid | null;
    /** Distinct NPC hunter ids raided beside, and clears shared with each. */
    met: string[];
    together: Record<string, number>;
    bosses: string[];
    /** Every Gate the hunter has walked into: the brief shows its map from then on (`gates.mapKnown`). */
    entered: string[];
    /** Every Gate a Gate Survey has shown the map of, before the hunter went in. */
    surveyed: string[];
    /** The rooms seen through the fog of each map, by its seed: remembered for as long as the map stands. */
    seen: Record<string, string[]>;
    /** How the last run ended, and clears since the last time you were carried out. */
    last: 'cleared' | 'withdrawn' | 'defeated' | null;
    unbroken: number;
    bestUnbroken: number;
    /** Standing orders for the allies and Shadows who go in with you. */
    tactic: Tactic;
  };

  shadows: {
    army: Shadow[];
    /** Shadow ids deployed with the hunter. */
    squad: string[];
    /** Bound since the Shadows screen was last opened. */
    fresh: string[];
    /** Shadow Essence, spent on promotions. */
    essence: number;
  };

  shop: { day: string | null; taken: number[] };
  /** The Pale Spire: this week's highest floor cleared, the highest ever, and what the last week paid. */
  spire: {
    season: string | null;
    best: number;
    top: number;
    seasons: number;
    last: SeasonPay | null;
  };
  /**
   * Ascension: the level the next run is entered at, the highest the hunter has opened and ever reached,
   * the proof of the highest so far (different gates of their grade cleared at it), the day they last
   * walked into a Trial, the marks set from the levels opened, by mark, the levels whose Chosen have been
   * sent into the world, and those whose Chosen have fallen to the hunter.
   */
  ascension: {
    level: number; unlocked: number; best: number; proof: { gates: string[] }; trialDay: string | null; trials: number;
    marks: Record<string, number>; sent: number[]; felled: number[];
  };
  /**
   * Today's System contracts, as issued: for the grade the hunter held when they were first shown.
   * `seen` is whether the Quests screen has shown them yet; a new day's arrive unseen.
   */
  contracts: { day: string | null; grade: Rank; list: Contract[]; bonus: boolean; seen?: boolean };
  /** Room in the satchel past the Exchange's, given by the Association: the satchel carries Health Potions (`stock.hp`). */
  satchelPlus: number;
  /** Ryn Valcorde's Association Quests: the place in the line, the job in hand, and how many reported. */
  assoc: { n: number; quest: import('./association').AssocQuest | null; reported: number };
  /** What the hunter holds to use later, by kind: potions (Health Potions as many as the satchel carries), and Gate Surveys. Each is used before one is bought. */
  stock: Partial<Record<StockId, number>>;

  log: LogEntry[];
  story: string[];
  /** One-shot flags: walkthroughs seen, notices read. */
  seen: string[];
  licence: { granted: boolean; at: string | null; tx: string | null };
  stats: Stats;
  settings: Settings;
}
