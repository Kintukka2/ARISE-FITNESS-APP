/** Lookups and filters over the movement codex. */
import { EXERCISES, GEAR, LIMITATIONS } from '@/data/exercises';
import type { Exercise, Save, Stat } from './types';

const byIdMap = new Map(EXERCISES.map((x) => [x.id, x]));

export const exById = (id: string) => byIdMap.get(id);
export const ALL_EXERCISES = EXERCISES;
export { GEAR, LIMITATIONS };

export const statsOf = (ex: Exercise | undefined): Stat[] =>
  (ex?.stats?.length ? ex.stats : ['VIT']) as Stat[];

export const owns = (ex: Exercise, equipment: string[]) =>
  ex.equip.some((e) => e === 'none' || equipment.includes(e));

export const hurts = (ex: Exercise, limitations: string[]) =>
  ex.flags.some((f) => limitations.includes(f));

/** Everything this kit and body can do, optionally up to a tier. */
export function available(equipment: string[], limitations: string[], maxTier = 4): Exercise[] {
  return EXERCISES.filter((x) => x.tier <= maxTier && owns(x, equipment) && !hurts(x, limitations));
}

/**
 * The pool the coach draws from: what the hunter can do, minus what they
 * struck off. If striking things off would empty a whole movement pattern,
 * that pattern's techniques come back so no session is ever starved.
 */
export function allowed(s: Save, maxTier = 4): Exercise[] {
  const fits = available(s.profile.equipment, s.profile.limitations, maxTier);
  const out = new Set(s.training.excluded);
  const kept = fits.filter((x) => !out.has(x.id));
  const alive = new Set(kept.map((x) => x.pattern));
  return fits.filter((x) => !out.has(x.id) || !alive.has(x.pattern));
}

export function fmtAmount(ex: Exercise | undefined, v: number): string {
  if (!ex) return String(v);
  if (ex.unit === 'sec') return v >= 120 ? `${Math.round(v / 60)} min` : `${v}s`;
  if (ex.unit === 'm') return v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`;
  return `${v} reps`;
}

export const unitShort = (ex: Exercise | undefined) =>
  ex?.unit === 'sec' ? 'SEC' : ex?.unit === 'm' ? 'M' : 'REPS';

export const stepOf = (ex: Exercise | undefined) => (ex?.unit === 'sec' ? 5 : ex?.unit === 'm' ? 50 : 1);

export const PATTERN_NAMES: Record<string, string> = {
  push: 'Push', vpush: 'Overhead', pull: 'Row', vpull: 'Pull', squat: 'Squat', hinge: 'Hinge',
  lunge: 'Lunge', core: 'Core', carry: 'Carry', cardio: 'Conditioning', plyo: 'Plyometric', mobility: 'Mobility',
};
