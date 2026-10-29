/** Programmes the hunter writes themselves: a named list of exercises with sets, target, load and rest. */
import { exById } from './exercises';
import type { Save, Slot, Template } from './types';
import { uid } from './util';

export const NAME_MAX = 40;
export const ITEMS_MAX = 15;
export const SETS_MAX = 12;
export const TEMPLATES_MAX = 30;

export function defaultRest(exId: string): number {
  const ex = exById(exId);
  if (!ex) return 90;
  if (ex.load) return 120;
  return ex.unit === 'reps' ? 90 : 60;
}

export function newSlot(exId: string): Slot {
  const ex = exById(exId);
  return { exId, sets: 3, target: ex?.base ?? 10, rest: defaultRest(exId), load: !!ex?.load };
}

export function problems(t: Pick<Template, 'name' | 'slots'>): string[] {
  const out: string[] = [];
  if (!t.name.trim()) out.push('Give it a name.');
  if (t.name.length > NAME_MAX) out.push('The name is too long.');
  if (!t.slots.length) out.push('Add at least one exercise.');
  for (const sl of t.slots) {
    if (!exById(sl.exId)) out.push('One of the exercises is no longer in the codex.');
    else if (sl.sets < 1) out.push(`${exById(sl.exId)!.name} has no sets.`);
    else if (sl.target < 1) out.push(`${exById(sl.exId)!.name} has nothing to do in a set.`);
  }
  return out;
}

/** Save a new or edited template. False if it is invalid or the shelf is full. */
export function save(s: Save, t: Omit<Template, 'id' | 'runs' | 'lastRun'> & { id?: string }): Template | null {
  if (problems(t).length) return null;
  const existing = t.id ? s.templates.find((x) => x.id === t.id) : undefined;
  if (existing) {
    existing.name = t.name.trim();
    existing.slots = t.slots.map((x) => ({ ...x }));
    return existing;
  }
  if (s.templates.length >= TEMPLATES_MAX) return null;
  const made: Template = { id: uid('tp'), name: t.name.trim(), slots: t.slots.map((x) => ({ ...x })), runs: 0, lastRun: null };
  s.templates.push(made);
  return made;
}

export function remove(s: Save, id: string) {
  s.templates = s.templates.filter((t) => t.id !== id);
}

/** Rough minutes: reps at 3s each, holds as given, metres at 0.35s, plus every rest but the last. */
export function minutes(slots: Slot[]): number {
  let sec = 0;
  for (const sl of slots) {
    const ex = exById(sl.exId);
    const per = ex?.unit === 'sec' ? sl.target : ex?.unit === 'm' ? sl.target * 0.35 : sl.target * 3;
    sec += per * sl.sets + sl.rest * Math.max(0, sl.sets - 1);
  }
  return Math.max(1, Math.round(sec / 60));
}
