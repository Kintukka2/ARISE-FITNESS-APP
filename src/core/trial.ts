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
/** How many of the Chosen stand in the Trial that proves `level`. */
export const trialRounds = (level: number) => level + TRIAL.extra;
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
  const f = 1 + TRIAL.step * (round - 1);
  const name = CHOSEN[(round - 1) % CHOSEN.length];
  return {
    ...base,
    id: `CHO-${round}-${grade}`, name, shadow: `Shadow of ${name}`,
    base: Object.fromEntries(STATS.map((k) => [k, Math.round(base.base[k] * f)])) as Attrs,
  };
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
    identity: 'Chosen', mobs: [], boss: chosen(rounds, grade).id, mobRounds: 0,
    trial: rounds, scale: trialTune(level),
  };
}

export function trialById(id: string): Dungeon | undefined {
  const m = TRIAL_ID.exec(id);
  return m ? trialDungeon(m[1] as Rank, Number(m[2])) : undefined;
}

/** The level a Trial proves, read from its id. */
export const trialLevel = (d: { id: string }) => Number(TRIAL_ID.exec(d.id)?.[2] ?? 0);
