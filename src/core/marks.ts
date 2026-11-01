/**
 * Marks: what a hunter keeps from every level of Ascension they open, after
 * Gladiator Manager's reincarnation bonuses, without the reincarnation. Each
 * level opened earns one mark, and the hunter sets it on one of the marks for
 * good. A mark set adds its numbers once, up to `MARK_MAX` on any one. The
 * levels are tuned for a hunter who has set theirs, so a mark keeps pace with
 * the climb; it is the levels below that it makes easier.
 */
import { MARK_MAX, MARKS, type Mark } from '@/data/ascension';
import { bonusText, sumBonuses } from './gear';
import type { Save } from './types';

export const markById = (id: string) => MARKS.find((m) => m.id === id);
/** How many marks are set on one mark. */
export const setOn = (s: Save, id: string) => s.ascension.marks[id] ?? 0;
const setAll = (s: Save) => MARKS.reduce((n, m) => n + setOn(s, m.id), 0);
/** Marks earned and not yet set: one for every level opened. */
export const unset = (s: Save) => Math.max(0, s.ascension.unlocked - setAll(s));
export const canSet = (s: Save, id: string) => !!markById(id) && unset(s) > 0 && setOn(s, id) < MARK_MAX;

/** Set one earned mark on a mark, for good. False if none is waiting or that mark is full. Mutates. */
export function setMark(s: Save, id: string): boolean {
  if (!canSet(s, id)) return false;
  s.ascension.marks[id] = setOn(s, id) + 1;
  return true;
}

/** The System's choice: the mark with the fewest set, the first of them on a tie. */
export function systemMark(s: Save): string | null {
  let best: Mark | null = null;
  for (const m of MARKS) if (setOn(s, m.id) < MARK_MAX && (!best || setOn(s, m.id) < setOn(s, best.id))) best = m;
  return best?.id ?? null;
}

/** Set every waiting mark as the System would. Mutates. */
export function setAllBySystem(s: Save) {
  for (let id = systemMark(s); unset(s) > 0 && id && setMark(s, id); id = systemMark(s));
}

const times = (b: Record<string, number> | undefined, n: number) => Object.fromEntries(Object.entries(b ?? {}).map(([k, v]) => [k, Math.round(v * n * 1000) / 1000]));

/** What the marks set add to the hunter's own numbers, and to every Shadow's. */
export const heroBonus = (s: Save) => sumBonuses(...MARKS.map((m) => times(m.hero, setOn(s, m.id))));
export const shadowBonus = (s: Save) => sumBonuses(...MARKS.map((m) => times(m.shadows, setOn(s, m.id))));
/** The share of a gate's fatigue the hunter still pays. */
export const fatigueShare = (s: Save) => Math.max(0, 1 - MARKS.reduce((n, m) => n + (m.fatigue ?? 0) * setOn(s, m.id), 0));

/** What a mark does, `n` times over, in words read from its numbers: "+8% attack and magic". */
export function markText(m: Mark, n = 1): string {
  const parts: string[] = [];
  if (m.hero) parts.push(bonusText(times(m.hero, n)));
  if (m.shadows) parts.push(`${bonusText(times(m.shadows, n))} for every Shadow`);
  if (m.fatigue) parts.push(`Fatigue -${Math.round(m.fatigue * n * 100)}% for every Gate`);
  return parts.join('; ');
}
