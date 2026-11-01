/**
 * The Trial: Ascension's gauntlet, after Gladiator Manager's Ascension
 * tournament. To open level L + 1 a hunter beats L + 2 of the Chosen in a
 * row: a gate with one boss to a layer, no rest, and nothing to withdraw to.
 * The Trial and its Chosen are drawn from their ids, as a Spire block is, so
 * the whole raid engine plays them.
 */
import { CHOSEN, TRIAL } from '@/data/ascension';
import { DUNGEONS } from '@/data/dungeons';
import { ENEMIES } from '@/data/enemies';
import { TRIAL_TUNE } from '@/data/gatetune';
import { powerOf } from './combat';
import type { Attrs, Dungeon, Enemy, Rank } from './types';
import { STATS } from './types';

const TRIAL_ID = /^TRL-([EDCBAS])-(\d+)$/;
const CHOSEN_ID = /^CHO-(\d+)-([EDCBAS])$/;

export const isTrial = (d: { id: string }) => TRIAL_ID.test(d.id);
/** The round of the last Chosen in the Trial that proves `level`: the one it sends into the world. */
export const trialLast = (level: number) => level + TRIAL.extra;
/** How many of the Chosen stand in the Trial that proves `level`: the last `TRIAL.most` of them, at most. */
export const trialRounds = (level: number) => Math.min(trialLast(level), TRIAL.most);
/** The round of the first of them. */
export const trialFirst = (level: number) => trialLast(level) - trialRounds(level) + 1;
/** How much harder the Trial is than its Chosen alone, at the level it proves; from calibration. */
export const trialTune = (level: number) => TRIAL_TUNE[level] ?? TRIAL_TUNE[TRIAL_TUNE.length - 1] ?? 1;

const byId = new Map(ENEMIES.map((e) => [e.id, e]));

/** The bosses of a grade's gates, weakest first: what the Chosen are made of. */
function ladder(grade: Rank): Enemy[] {
  const seen = new Set<string>();
  const out: Enemy[] = [];
  for (const d of DUNGEONS) {
    if (d.rank !== grade || seen.has(d.boss)) continue;
    const e = byId.get(d.boss);
    if (e) { seen.add(d.boss); out.push(e); }
  }
  return out.sort((a, b) => powerOf(a.base) - powerOf(b.base));
}

/** The Chosen of a round (from 1) for a grade: one of its bosses, stronger for every round before it. */
export function chosen(round: number, grade: Rank): Enemy {
  const bosses = ladder(grade);
  const base = bosses[Math.min(round - 1, bosses.length - 1)];
  // Stronger for every round before it, up to the most a Trial holds; past that, the level grows them.
  const f = 1 + TRIAL.step * (Math.min(round, TRIAL.most) - 1);
  const name = chosenName(round);
  return {
    ...base,
    id: `CHO-${round}-${grade}`, name, shadow: `Shadow of ${name}`,
    base: Object.fromEntries(STATS.map((k) => [k, Math.round(base.base[k] * f)])) as Attrs,
  };
}

/** A Chosen's name: past the last of them, the names come round again with a numeral. */
export function chosenName(round: number): string {
  const cycle = Math.floor((round - 1) / CHOSEN.length) + 1;
  return CHOSEN[(round - 1) % CHOSEN.length] + (cycle > 1 ? ` ${numeral(cycle)}` : '');
}

const ROMAN: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function numeral(n: number): string {
  let out = '';
  for (const [v, r] of ROMAN) for (; n >= v; n -= v) out += r;
  return out;
}

export function chosenById(id: string): Enemy | undefined {
  const m = CHOSEN_ID.exec(id);
  return m ? chosen(Number(m[1]), m[2] as Rank) : undefined;
}

/** The Trial that proves `level` for a hunter of a grade, as a gate. */
export function trialDungeon(grade: Rank, level: number): Dungeon {
  const rounds = trialRounds(level);
  return {
    id: `TRL-${grade}-${level}`, rank: grade, name: `The Trial of Ascension ${level + 1}`,
    theme: `${rounds} of the Chosen, one after another, and nothing between them: no rest, no way out but through. Win, and Ascension ${level + 1} opens.`,
    identity: 'Chosen', mobs: [], boss: chosen(trialLast(level), grade).id, mobRounds: 0,
    trial: rounds, trialFrom: trialFirst(level), scale: trialTune(level),
  };
}

export function trialById(id: string): Dungeon | undefined {
  const m = TRIAL_ID.exec(id);
  return m ? trialDungeon(m[1] as Rank, Number(m[2])) : undefined;
}

/** The level a Trial proves, read from its id. */
export const trialLevel = (d: { id: string }) => Number(TRIAL_ID.exec(d.id)?.[2] ?? 0);
