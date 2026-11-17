/**
 * The Association's hunters as their card reads them (`screens/Hunter.tsx`): their class, worked out as the
 * hunter's own is from their leading stat and their grade (`classFor`), the kit it gives them (`kitFor`, every
 * rung's first option, as `raid.allySpec` fights them), where they stand by it (`ranks.byLead`), and their
 * record beside the hunter. A hunter's id fixes who they are (`gates.hunter`), so the same hunter met again on
 * another Gate is the same file, and their record follows them.
 */
import { classFor, type ClassDef } from '@/data/classes';
import { powerOf } from './combat';
import type { Ally } from './gates';
import { kitFor } from './progression';
import * as ranks from './ranks';
import type { Save } from './types';

/** Their class: none at E-Rank. */
export const classOf = (a: Ally): ClassDef | null => classFor(a.base, a.rank);

/** The skills and passives they fight with. */
export function kitOf(a: Ally): { kit: string[]; passives: string[] } {
  const c = classOf(a);
  return c ? kitFor(c.lead, c.tier) : { kit: [], passives: [] };
}

/** Where they stand and how their hits reach, by their class's leading stat. */
export const standOf = (a: Ally) => ranks.byLead(classOf(a)?.lead);

/** Their power, as the brief's party reads it. */
export const powerOfAlly = (a: Ally) => powerOf(a.base);

/** Their record beside the hunter: Gates walked in together, Gates cleared together, what they helped defeat, and when they first met. */
export function recordOf(s: Save, id: string) {
  const w = s.gates.walked?.[id];
  return { runs: w?.runs ?? 0, cleared: s.gates.together[id] ?? 0, kills: w?.kills ?? 0, bosses: w?.bosses ?? 0, first: w?.first ?? null, last: w?.last ?? null };
}

/** Write one run into each of its hunters' records, as `raid.finish` settles it. Mutates. */
export function log(s: Save, ids: readonly string[], kills: Record<string, { kills: number; bosses: number }>, day: string) {
  const all = (s.gates.walked ??= {});
  for (const id of ids) {
    const w = (all[id] ??= { runs: 0, kills: 0, bosses: 0, first: day, last: day });
    w.runs++;
    w.kills += kills[id]?.kills ?? 0;
    w.bosses += kills[id]?.bosses ?? 0;
    w.last = day;
  }
}
