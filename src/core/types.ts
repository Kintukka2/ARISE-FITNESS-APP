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

export interface Item {
  id: string;
  defId: string;
  /** Multiplier on the core bonus, 0.75–1.25. 1 for issued kit. */
  q: number;
  /** One value per def roll. */
  rolls: number[];
  /** Upgrade steps bought for it at the Exchange. */
  up?: number;
}

// ------------------------------------------------------------------ combat data

export type AbilityProfile = 'single' | 'cleave' | 'volley' | 'spread' | 'burst' | 'wild' | 'all' | 'support';

export interface Ability {
  name: string;
  type: 'physical' | 'magic';
  profile: AbilityProfile | string;
  mult: number;
  cd: number;
  inflicts: string[];
}

export type PassiveStyle =
  | 'identity' | 'tempo' | 'brace' | 'escalation' | 'targeting' | 'survival'
  | 'leadership' | 'arcane' | 'pack' | 'hazard' | 'bulwark' | 'bladework' | 'keen';

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
}

// ------------------------------------------------------------------ orders

/** What the hunter does with a turn: a skill from the kit by name, or `Strike`, `Guard` or `Potion`. `at` is the foe aimed at. */
export interface Order { use: string; at?: string }

/** Standing orders for allies and Shadows, set before a gate. */
export type Tactic = 'default' | 'finish' | 'protect' | 'spread';

// ------------------------------------------------------------------ save

export interface Shadow {
  /** Unique per binding. */
  id: string;
  /** The enemy it was. */
  enemyId: string;
  boundAt: string;
  out: number;
  kills: number;
  bosses: number;
  /** Standing orders of its own. Unset, it follows the party's. */
  tactic?: Tactic;
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
  /** The standing orders the party went in with; they hold for the whole run. */
  tactic: Tactic;
  /**
   * The hunter's orders so far in the chamber being fought, null where the
   * System chose. The fight is deterministic, so these replay it exactly.
   */
  orders: (Order | null)[];
  /** The map's seed, and the steps chosen on it so far, the last of them perhaps still underway. */
  map: string;
  path: string[];
  /** Gear and shards found on the way, paid out when the run ends unless the party is carried out. */
  haul: string[];
  purse: number;
  /** Blessings picked up at shrines and events, on the hunter for the rest of the run. */
  blessings: string[];
  /** A chamber was lost: the run is over, waiting to be settled. */
  lost: boolean;
  /** The hunter's fatigue as they walked in, before this gate added its own. */
  fatigue: number;
}

/** What a week on the Spire paid when it closed. */
export interface SeasonPay {
  /** The Monday it began. */
  season: string;
  best: number;
  tier: string;
  shards: number;
  /** The design of the piece of gear it paid, if any. */
  item: string | null;
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
}

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
    attrs: Attrs;
    points: number;
    classId: string | null;
    missions: string[];
    /**
     * The skill or passive kept at each of a class line's rungs, keyed `LINE:rung`, and the
     * class tier it was chosen at: a choice holds until the hunter reaches a higher rank.
     */
    picks: Record<string, { name: string; at: number }>;
  };

  vitals: { hp: number | null; mp: number | null; fatigue: number; at: number | null; lockedUntil: number | null };
  /** `bought` counts shards paid for with money; `receipts` are store transactions already credited. */
  wallet: { shards: number; earned: number; spent: number; bought: number; receipts: string[] };

  items: Item[];
  equipped: Partial<Record<SlotKey, string>>;
  favourites: string[];
  /** Every design id ever held. */
  found: string[];

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
  /** Today's System contracts, as issued: for the grade the hunter held when they were first shown. */
  contracts: { day: string | null; grade: Rank; list: Contract[]; bonus: boolean };
  /** Field potions carried into Gates, drunk on the hunter's turn. */
  satchel: number;

  log: LogEntry[];
  story: string[];
  /** One-shot flags: walkthroughs seen, notices read. */
  seen: string[];
  licence: { granted: boolean; at: string | null; tx: string | null };
  stats: Stats;
  settings: Settings;
}
