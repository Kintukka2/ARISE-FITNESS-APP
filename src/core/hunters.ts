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

/**
 * Their record beside the hunter, as their card's `History` reads it: the Gates walked together (never fewer than the
 * clears, which were kept before the runs were), the Gates cleared, carried out of and withdrawn from together, what
 * they helped defeat, when you first and last walked one together, and where they stand among every hunter you have
 * walked with, by Gates walked (`place`, 1 the most often; null until you have walked one).
 */
export function recordOf(s: Save, id: string) {
  const all = s.gates.walked ?? {};
  const w = all[id];
  const cleared = s.gates.together[id] ?? 0;
  const runs = Math.max(w?.runs ?? 0, cleared);
  const partners = new Set([...Object.keys(all), ...Object.keys(s.gates.together)]);
  const partiesOf = (x: string) => Math.max(all[x]?.runs ?? 0, s.gates.together[x] ?? 0);
  const place = runs ? 1 + [...partners].filter((x) => x !== id && partiesOf(x) > runs).length : null;
  const carried = w?.carried ?? 0;
  return {
    // Every Gate walked together ends cleared, carried out or withdrawn from: the last is what the other two leave.
    runs, cleared, carried, withdrawn: Math.max(0, runs - cleared - carried), kills: w?.kills ?? 0, bosses: w?.bosses ?? 0,
    first: w?.first ?? null, last: w?.last ?? null, place, partners: partners.size,
  };
}

/** Whether the hunter has starred this Association hunter on their card. */
export const isFavourite = (s: Save, id: string) => (s.gates.favourites ?? []).includes(id);

/** Star an Association hunter on their card, or take the star off. Returns whether they are starred now. Mutates. */
export function toggleFavourite(s: Save, id: string): boolean {
  const list = (s.gates.favourites ??= []);
  const at = list.indexOf(id);
  if (at >= 0) list.splice(at, 1);
  else list.push(id);
  return at < 0;
}

/** Write one run into each of its hunters' records, as `raid.finish` settles it. Mutates. */
export function log(s: Save, ids: readonly string[], kills: Record<string, { kills: number; bosses: number }>, day: string, outcome?: string) {
  const all = (s.gates.walked ??= {});
  for (const id of ids) {
    const w = (all[id] ??= { runs: 0, kills: 0, bosses: 0, first: day, last: day });
    w.runs++;
    if (outcome === 'defeated') w.carried = (w.carried ?? 0) + 1;
    w.kills += kills[id]?.kills ?? 0;
    w.bosses += kills[id]?.bosses ?? 0;
    w.last = day;
  }
}
