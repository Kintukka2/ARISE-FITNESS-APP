/**
 * Par (`data/par.ts`), as the engine judges it: each fight won carries its par, by its kind and the Gate's grade,
 * counted into the run's tally as it is recorded (`raid.record`); a clear's rounds against the par of the fights it
 * won give its medal (`medalOf`); and each medal pays once on its Gate, the first time it is reached (`settle`),
 * whoever fought: the hunter or the System, as a Feat does. A Practice Gate, the Spire and the Trials have none.
 */
import { MEDAL_PAY, MEDALS, PAR, PAR_EMBER, type FightKind, type MedalId } from '@/data/par';
import { isFight, systemRoad, type GateMap } from './map';
import type { Dungeon, Rank, Save } from './types';

/** The rounds a fight of this kind should take, on a Gate of this grade. */
export const parOf = (rank: Rank | string, kind: string): number => PAR[rank as Rank]?.[kind as FightKind] ?? 0;

/** A run's par, in whole rounds: the par of every fight it won, added up. */
export const whole = (par: number) => Math.round(par);

/** The most rounds a medal allows against a par. */
export const limitOf = (par: number, medal: MedalId) => Math.floor(whole(par) * (MEDALS.find((x) => x.id === medal)?.at ?? 1));

/** Each medal and the most rounds it allows against a par, best first. */
export const marks = (par: number) => MEDALS.map((x) => ({ ...x, rounds: limitOf(par, x.id) }));

/** The best medal a clear in `rounds` earns against `par`, or null over par. */
export function medalOf(rounds: number, par: number): MedalId | null {
  if (par <= 0) return null;
  return MEDALS.find((x) => rounds <= limitOf(par, x.id))?.id ?? null;
}

/** The par of the System's road on a map: its fights' pars, added up. */
export function roadPar(d: Dungeon, m: GateMap): number {
  return systemRoad(m).map((id) => m.byId[id]).filter((x) => x && isFight(x)).reduce((n, x) => n + parOf(d.rank, x.kind), 0);
}

/** A medal's place, best first: Gold 0, Silver 1, Bronze 2; none past them. */
const place = (m: MedalId | null | undefined) => (m ? MEDALS.findIndex((x) => x.id === m) : MEDALS.length);

/** Whether a medal is as good as another, or better. */
export const reaches = (m: MedalId | null | undefined, than: MedalId) => place(m) <= place(than);

/** The best medal reached on a Gate. */
export const bestOn = (s: Save, d: Dungeon): MedalId | null => s.gates.par?.[d.id] ?? null;

/** Record a clear's medal on its Gate; returns the medals reached there for the first time, worst first, which pay. Mutates. */
export function settle(s: Save, d: Dungeon, medal: MedalId | null): MedalId[] {
  if (!medal) return [];
  const had = bestOn(s, d);
  const fresh = MEDALS.filter((x) => reaches(medal, x.id) && !reaches(had, x.id)).map((x) => x.id).reverse();
  if (fresh.length) s.gates.par = { ...(s.gates.par ?? {}), [d.id]: medal };
  return fresh;
}

/** The fewest rounds a clear of this Gate has taken, or null before one was graded. */
export const bestRounds = (s: Save, d: Dungeon): number | null => s.gates.parBest?.[d.id] ?? null;

/** Keep a graded clear's rounds as the Gate's best when it took fewer than any before. Mutates. */
export function recordRounds(s: Save, d: Dungeon, rounds: number) {
  const had = bestRounds(s, d);
  if (had === null || rounds < had) s.gates.parBest = { ...(s.gates.parBest ?? {}), [d.id]: rounds };
}

/** The Ember a set of medals pays on a Gate of this grade. */
export const emberFor = (rank: Rank | string, medals: readonly MedalId[]) =>
  medals.reduce((n, m) => n + (PAR_EMBER[rank as Rank] ?? 0) * MEDAL_PAY[m], 0);
