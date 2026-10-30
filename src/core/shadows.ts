/**
 * The Shadow army. A creature you felled can linger after a clear; reach for
 * it with mana and it may follow you home. A bound Shadow fights beside you,
 * and grows a little with every kill it lands.
 */
import { enemyById } from './gates';
import { licensedRank } from './licence';
import type { Attrs, Rank, Save, Shadow } from './types';
import { STATS } from './types';
import { clamp, dayKey, uid } from './util';

export const SLOTS: Record<Rank, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 };
export const EXTRACT_MP: Record<string, number> = { E: 50, D: 60, C: 70, B: 80, A: 90, S: 100 };
/** +1% to every attribute per kill, up to +50%. */
const GROWTH_PER_KILL = 0.01;
const GROWTH_CAP = 0.5;

export const slots = (s: Save) => SLOTS[licensedRank(s)];
export const squad = (s: Save) => s.shadows.squad.slice(0, slots(s)).map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x);
export const freeSlots = (s: Save) => Math.max(0, Math.min(slots(s), s.shadows.army.length) - squad(s).length);
export const isBound = (s: Save, enemyId: string) => s.shadows.army.some((x) => x.enemyId === enemyId);

export const growth = (sh: Shadow) => Math.min(GROWTH_CAP, sh.kills * GROWTH_PER_KILL);

export function statsOf(sh: Shadow): Attrs {
  const e = enemyById(sh.enemyId)!;
  const k = 1 + growth(sh);
  return Object.fromEntries(STATS.map((st) => [st, Math.round(e.base[st] * k)])) as Attrs;
}

export function toggleDeploy(s: Save, id: string): boolean {
  const i = s.shadows.squad.indexOf(id);
  if (i >= 0) { s.shadows.squad.splice(i, 1); return false; }
  if (squad(s).length >= slots(s)) return false;
  s.shadows.squad = s.shadows.squad.filter((x) => s.shadows.army.some((a) => a.id === x));
  s.shadows.squad.push(id);
  return true;
}

export function bind(s: Save, enemyId: string, day = dayKey()): Shadow {
  const sh: Shadow = { id: uid('sh'), enemyId, boundAt: day, out: 0, kills: 0, bosses: 0 };
  s.shadows.army.push(sh);
  s.shadows.fresh.push(sh.id);
  // Fill a free slot automatically: a bound Shadow that is not deployed does nothing.
  if (squad(s).length < slots(s)) s.shadows.squad.push(sh.id);
  return sh;
}

/** Odds a reach holds, read off Intelligence. Shown to the player as is. */
export const holdChance = (s: Save) => clamp(0.45 + s.hunter.attrs.INT * 0.004, 0.45, 0.9);
/** Per-kill odds a felled creature lingers. The boss is far likelier to. */
export const lingerChance = (s: Save, boss: boolean) => (boss ? 0.12 + s.hunter.attrs.INT * 0.0012 : 0.02 + s.hunter.attrs.INT * 0.0002);
