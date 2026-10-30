/** The per-exercise ledger: bests, last weight and a short history. */
import type { LiftRecord, Save, SetLog } from './types';
import { dayKey } from './util';

const HISTORY = 30;

/** Brzycki. Honest to about twelve reps; capped there. */
export const oneRm = (weight: number, reps: number) => (reps <= 0 ? 0 : (weight * 36) / (37 - Math.min(12, reps)));

export interface PR { exId: string; kind: 'best' | 'heaviest' | 'oneRm'; value: number }

/** Fold one exercise's ticked sets into the ledger. Returns any records broken. */
export function log(s: Save, exId: string, sets: SetLog[], day = dayKey()): PR[] {
  const done = sets.filter((x) => x.ok);
  if (!done.length) return [];
  const rec: LiftRecord = s.lifts[exId] ?? { best: 0, heaviest: 0, lastWeight: null, sets: 0, volume: 0, history: [] };
  const prs: PR[] = [];
  const first = rec.sets === 0;
  const top = Math.max(...done.map((x) => x.done));
  const weights = done.map((x) => x.weight ?? 0);
  const heavy = Math.max(...weights);
  const rm = Math.max(...done.map((x) => oneRm(x.weight ?? 0, x.done)));
  const bestRm = Math.max(0, ...rec.history.map((h) => oneRm(h.weight ?? 0, h.top)));
  if (!first && top > rec.best) prs.push({ exId, kind: 'best', value: top });
  if (!first && heavy > rec.heaviest && heavy > 0) prs.push({ exId, kind: 'heaviest', value: heavy });
  if (!first && rm > bestRm && heavy > 0 && !prs.some((p) => p.kind === 'heaviest')) prs.push({ exId, kind: 'oneRm', value: Math.round(rm * 10) / 10 });
  rec.best = Math.max(rec.best, top);
  rec.heaviest = Math.max(rec.heaviest, heavy);
  rec.lastWeight = heavy > 0 ? heavy : rec.lastWeight;
  rec.sets += done.length;
  rec.volume += done.reduce((n, x) => n + x.done * (x.weight ?? 0), 0);
  const heaviestSet = done.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
  rec.history.unshift({ day, sets: done.length, top, weight: heavy > 0 ? heaviestSet.weight : null });
  rec.history.length = Math.min(rec.history.length, HISTORY);
  s.lifts[exId] = rec;
  return prs;
}

export const lastWeight = (s: Save, exId: string) => s.lifts[exId]?.lastWeight ?? null;
