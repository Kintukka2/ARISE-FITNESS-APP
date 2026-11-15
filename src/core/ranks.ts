/**
 * Front and rear (`data/ranks.ts`), as the engine sets them: where a creature, a Shadow, an Association hunter and the
 * hunter stand, and whether their hits are shots or reach past the front. A unit's place rides on its spec
 * (`UnitSpec.row`), so an open run keeps the places it walked in with; the fight reads them (`combat.reachable`).
 */
import { classById } from '@/data/classes';
import { LEAD_ROW, RANGED_LEADS, RANGED_ROLES, REACHING_LEADS, REACHING_ROLES, ROLE_ROW, type Row } from '@/data/ranks';
import type { Save, Stat } from './types';

export interface Stand { row: Row; ranged?: boolean; reaching?: boolean }

/** Where a creature of a role stands, and how its hits reach; a boss stands in front, whatever its role. */
export function byRole(role: string, boss = false): Stand {
  const row: Row = boss ? 'front' : ROLE_ROW[role] ?? 'front';
  return { row, ...(RANGED_ROLES.includes(role) ? { ranged: true } : {}), ...(REACHING_ROLES.includes(role) ? { reaching: true } : {}) };
}

/** Where a hunter of a class's lead stands by default, and how their hits reach; unclassed, in front. */
export function byLead(lead: Stat | null | undefined): Stand {
  if (!lead) return { row: 'front' };
  return { row: LEAD_ROW[lead], ...(RANGED_LEADS.includes(lead) ? { ranged: true } : {}), ...(REACHING_LEADS.includes(lead) ? { reaching: true } : {}) };
}

/** The hunter's class's lead, if classed. */
export const leadOf = (s: Save): Stat | null => classById(s.hunter.classId)?.lead ?? null;

/** Where the hunter stands: where they chose, or their class's place. */
export const heroRow = (s: Save): Row => s.hunter.stand ?? byLead(leadOf(s)).row;

/** The hunter's place and reach, as their spec carries them. */
export const heroStand = (s: Save): Stand => ({ ...byLead(leadOf(s)), row: heroRow(s) });

/** Choose where the hunter stands. Mutates. */
export function setStand(s: Save, row: Row) {
  s.hunter.stand = row;
}
