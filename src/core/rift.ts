/**
 * The Daily Rift (`data/rift.ts`). A day's Rift is a Gate of the hunter's grade, drawn from the date alone,
 * so it is the same map, the same creatures and the same modifiers on every phone: its id (`RFT-<day>-<grade>`)
 * is the run's seed, and `gates.dungeonById` resolves it as it does a block of the Spire. It plays two of the
 * Seals' rules (`seals.riftSeals`), at the Ascension each hunter has chosen, once a day, and is scored a line at a time into a history
 * kept on the phone. Its score and its pay are settled in `raid.finish`.
 */
import { DUNGEONS } from '@/data/dungeons';
import { GATE_TUNE } from '@/data/gatetune';
import { RIFT_KEPT, RIFT_NAME, RIFT_OPENS, RIFT_PAR, RIFT_THEME, SCORE } from '@/data/rift';
import type { SealId } from '@/data/seals';
import { licensedRank } from './licence';
import type { Outcome } from './raid';
import type { Dungeon, Rank, RiftDay, Save } from './types';
import { dayKey, rng } from './util';

const ID = /^RFT-(\d{4}-\d{2}-\d{2})-([EDCBAS])$/;

export const isRift = (d: { id: string } | null | undefined) => !!d && ID.test(d.id);
/** The day a Rift opened on, read from its id. */
export const riftDay = (d: { id: string }) => ID.exec(d.id)?.[1] ?? '';
/** The Rift opens once the hunter has cleared `RIFT_OPENS` Gates. */
export const riftOpen = (s: Save) => s.gates.clears >= RIFT_OPENS;

/** The Gate a day's Rift takes the shape of, for a grade: one of the grade's, drawn from the date alone. */
export function shapeOf(day: string, grade: Rank): Dungeon {
  const pool = DUNGEONS.filter((d) => d.rank === grade);
  return pool[Math.floor(rng(`arise|rift|${day}|${grade}`)() * pool.length)];
}

/** A day's Rift for a grade: its Gate's creatures, Gatekeeper and boss, as hard as that Gate is tuned. */
export function riftDungeon(day: string, grade: Rank): Dungeon {
  const g = shapeOf(day, grade);
  return {
    id: `RFT-${day}-${grade}`, rank: grade, name: `${RIFT_NAME} · ${g.name}`,
    theme: `${RIFT_THEME} Today it opens on ${g.name}.`, identity: g.identity,
    mobs: g.mobs, elite: g.elite, boss: g.boss, mobRounds: g.mobRounds,
    shape: g.id, scale: GATE_TUNE[g.id] ?? 1,
  };
}

export function riftById(id: string): Dungeon | undefined {
  const m = ID.exec(id);
  return m ? riftDungeon(m[1], m[2] as Rank) : undefined;
}

/** Today's Rift for the hunter: of the grade their licence covers. */
export const riftFor = (s: Save, day = dayKey()) => riftDungeon(day, licensedRank(s));

/** The history, newest first. */
export const days = (s: Save): RiftDay[] => s.rift?.days ?? [];
/** The day's attempt, if one was made. */
export const attempt = (s: Save, day = dayKey()) => days(s).find((x) => x.day === day);
/** The best score ever walked out with. */
export const best = (s: Save) => s.rift?.best ?? 0;

/** Whether the hunter may walk into this Rift: open, today's, and not yet tried. */
export function canEnter(s: Save, d: Dungeon, day = dayKey()): boolean {
  return riftOpen(s) && riftDay(d) === day && !attempt(s, day);
}

/** The attempt is made as the hunter walks in: one a day, whatever comes of it. Mutates. */
export function enter(s: Save, d: Dungeon, mods: readonly SealId[]) {
  const was = days(s).filter((x) => x.day !== riftDay(d));
  const entry: RiftDay = { day: riftDay(d), grade: d.rank as Rank, shape: d.shape ?? d.id, mods: [...mods], score: 0, outcome: 'open' };
  s.rift = { days: [entry, ...was].slice(0, RIFT_KEPT), best: best(s) };
}

export type ScoreKey = 'fight' | 'keeper' | 'boss' | 'feat' | 'pace' | 'health';
/** A line of the score: how many, and the points they make. */
export interface ScoreLine { key: ScoreKey; n: number; pts: number }
export interface RiftScore { lines: ScoreLine[]; total: number }

/** What a run did, as the score reads it. */
export interface RiftRun {
  /** Chambers won, the boss's and the Gatekeeper's among them. */
  won: number;
  keeper: boolean;
  cleared: boolean;
  /** Feats met, on a clear. */
  feats: number;
  /** Rounds fought in every chamber. */
  rounds: number;
  /** The hunter's HP left at the end, as a share. */
  hp: number;
}

/** The score, a line at a time: the way gone, the Gatekeeper and the boss; on a clear, Feats, pace and health. */
export function scoreOf(r: RiftRun): RiftScore {
  const fights = Math.max(0, r.won - (r.cleared ? 1 : 0) - (r.keeper ? 1 : 0));
  const under = r.cleared ? Math.max(0, RIFT_PAR * r.won - r.rounds) : 0;
  const hp = r.cleared ? Math.max(0, Math.min(1, r.hp)) : 0;
  const lines: ScoreLine[] = [
    { key: 'fight', n: fights, pts: fights * SCORE.fight },
    { key: 'keeper', n: r.keeper ? 1 : 0, pts: r.keeper ? SCORE.keeper : 0 },
    { key: 'boss', n: r.cleared ? 1 : 0, pts: r.cleared ? SCORE.boss : 0 },
    { key: 'feat', n: r.cleared ? r.feats : 0, pts: r.cleared ? r.feats * SCORE.feat : 0 },
    { key: 'pace', n: under, pts: under * SCORE.pace },
    { key: 'health', n: Math.round(hp * 100), pts: Math.round(hp * SCORE.health) },
  ];
  return { lines, total: lines.reduce((n, x) => n + x.pts, 0) };
}

/** What the Rift's end wrote: the score, the best before it, and whether it beat it. */
export interface RiftResult extends RiftScore { best: number; newBest: boolean }

/** The day's attempt settled with what it scored. Mutates. */
export function settle(s: Save, d: Dungeon, outcome: Outcome, score: RiftScore): RiftResult {
  const was = best(s);
  const day = riftDay(d);
  const list = days(s);
  const at = list.find((x) => x.day === day) ?? { day, grade: d.rank as Rank, shape: d.shape ?? d.id, mods: [], score: 0, outcome: 'open' as const };
  const entry: RiftDay = { ...at, score: score.total, outcome };
  s.rift = { days: [entry, ...list.filter((x) => x.day !== day)].slice(0, RIFT_KEPT), best: Math.max(was, score.total) };
  return { ...score, best: was, newBest: score.total > was };
}
