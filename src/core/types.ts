/** Shared shapes for the game data and the save. */

export const STATS = ['STR', 'AGI', 'PER', 'VIT', 'INT'] as const;
export type Stat = (typeof STATS)[number];
export type Attrs = Record<Stat, number>;

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

// ------------------------------------------------------------------ training

export type Pattern =
  | 'push' | 'vpush' | 'pull' | 'vpull' | 'squat' | 'hinge' | 'lunge'
  | 'core' | 'carry' | 'cardio' | 'plyo' | 'mobility';

export type Unit = 'reps' | 'sec' | 'm';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern | string;
  /** Any-of: available if the hunter owns one of these. */
  equip: string[];
  /** Attributes it trains, primary first. */
  stats: Stat[] | string[];
  tier: number;
  unit: Unit | string;
  /** A sensible starting volume for one set. */
  base: number;
  load?: boolean;
  /** An easier stand-in, only prescribed when nothing harder is free. */
  regress?: boolean;
  /** Joints it loads, matched against the hunter's limitations. */
  flags: string[];
  cue: string;
}

export interface GearKind { id: string; name: string; desc: string }
export interface Limitation { id: string; name: string; desc: string }

export type Goal = 'strength' | 'muscle' | 'lean' | 'endurance' | 'athletic';
export type Experience = 'novice' | 'trained' | 'seasoned' | 'elite';
export type Focus = 'balanced' | 'upper' | 'lower' | 'core';

export interface Profile {
  goal: Goal;
  experience: Experience;
  days: number;
  minutes: number;
  equipment: string[];
  limitations: string[];
  focus: Focus;
  age: number;
  weight: number;
}

export interface Slot {
  exId: string;
  sets: number;
  /** Target per set, in the exercise's unit. */
  target: number;
  rest: number;
  load: boolean;
  /** Working weight in kg, for loaded exercises. */
  weight?: number | null;
  note?: string;
}

export interface Day {
  id: string;
  key: string;
  name: string;
  rationale: string;
  slots: Slot[];
}

export interface Program {
  seed: string;
  week: number;
  /** Volume scalar the coach moves after every session. 0.55–1.9. */
  adapt: number;
  days: Day[];
  /** Day ids finished this week. */
  completed: string[];
  weekStarted: string;
  deload: boolean;
}

export interface SetLog { target: number; done: number; weight: number | null; ok: boolean }
export interface SessionItem extends Slot { log: SetLog[] }

export type SessionKind = 'basic' | 'program' | 'template' | 'free';

export interface ActiveSession {
  id: string;
  kind: SessionKind;
  /** Program day id or template id. */
  ref: string | null;
  title: string;
  subtitle: string;
  startedAt: number;
  /** Time actually spent in the player; gaps while the app is closed are not counted. */
  activeMs: number;
  lastTick: number;
  /** Wall-clock end of a running rest, so a locked phone does not pause it. */
  restEndsAt: number | null;
  restSpan: number;
  items: SessionItem[];
  /** Index of the exercise in focus. */
  at: number;
  /** Basic Training coaching passes already given. */
  taught: string[];
}

export interface Template {
  id: string;
  name: string;
  slots: Slot[];
  runs: number;
  lastRun: string | null;
}

export interface LiftRecord {
  /** Best single set, in the exercise's unit. */
  best: number;
  /** Heaviest load logged, kg. */
  heaviest: number;
  /** Last working weight, handed back next time. */
  lastWeight: number | null;
  sets: number;
  volume: number;
  history: { day: string; sets: number; top: number; weight: number | null }[];
}

// ------------------------------------------------------------------ daily

export interface QuestItem { exId: string; target: number; done: number }
export interface Quest { items: QuestItem[]; xp: number; penalty: boolean }

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
}

// ------------------------------------------------------------------ combat data

export type StatusName =
  | 'Bleeding' | 'Poisoned' | 'Burning' | 'Staggered' | 'Cursed' | 'Marked'
  | 'Rooted' | 'Corroded' | 'Stunned' | 'Weakened' | 'Chilled' | 'Rallied';

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
}

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
}

export interface OpenRaid {
  dungeonId: string;
  seed: string;
  /** The day it was entered: the allies are drawn from it. */
  day: string;
  /** Chambers already resolved. */
  at: number;
  squad: string[];
  /** Party hp/status carried between chambers. */
  carried: { hp: number; status: Record<string, number> }[];
  won: number;
  felled: string[];
  kills: Record<string, { kills: number; bosses: number }>;
  startHp: number;
  bossFaced: boolean;
}

export interface LogEntry { day: string; kind: 'quest' | 'penalty' | 'session' | 'boon' | 'gate'; name: string; xp: number }

export interface Message {
  id: string;
  from: 'system' | 'coach';
  title: string;
  lines: string[];
  at: number;
  read: boolean;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  units: 'kg' | 'lb';
  autoRest: boolean;
  fastText: boolean;
  reminders: { on: boolean; at: string; lastCall: boolean; refresh: boolean };
}

export interface Stats {
  questsCleared: number;
  questsFailed: number;
  penaltiesCleared: number;
  sessions: number;
  totalReps: number;
  totalSeconds: number;
  totalMeters: number;
  totalVolumeKg: number;
  earlyClears: number;
  comebacks: number;
  prevBestStreak: number;
  perfectDays: number;
  xpTotal: number;
  boons: number;
  boonPoints: number;
  boonsMissed: number;
  extractions: number;
  extractionsWon: number;
  killsByFamily: Record<string, number>;
  programRuns: number;
  templateRuns: number;
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
  };

  profile: Profile;
  program: Program | null;
  templates: Template[];
  lifts: Record<string, LiftRecord>;
  session: ActiveSession | null;

  training: {
    /** Basic Hunter Training finished. Opens the Gates. */
    certified: boolean;
    /** Techniques the hunter struck off. */
    excluded: string[];
  };

  daily: { date: string | null; quest: Quest | null; cleared: boolean; penalty: Quest | null };
  streak: { current: number; best: number; lastDay: string | null };
  boon: { start: string; points: Attrs; sets: number; days: string[]; last: { day: string; tier: string; grant: Partial<Attrs>; free: number } | null };

  vitals: { hp: number | null; mp: number | null; fatigue: number; at: number | null; lockedUntil: number | null };
  wallet: { shards: number; earned: number; spent: number };

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
  };

  shadows: {
    army: Shadow[];
    /** Shadow ids deployed with the hunter. */
    squad: string[];
    /** Bound since the Shadows screen was last opened. */
    fresh: string[];
  };

  shop: { day: string | null; taken: number[] };

  log: LogEntry[];
  inbox: Message[];
  story: string[];
  /** One-shot flags: walkthroughs seen, notices read. */
  seen: string[];
  flags: { hollow: boolean; ignoredPlan: boolean };
  licence: { granted: boolean; at: string | null; tx: string | null };
  stats: Stats;
  settings: Settings;
}
