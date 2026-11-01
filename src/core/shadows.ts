/**
 * The Shadow army. A creature you felled can linger after a clear; reach for
 * it with mana and it may follow you home. A bound Shadow fights beside you,
 * and grows a little with every kill it lands, as far as its rank allows;
 * enough kills promote it, and a Sworn Shadow remembers a second ability.
 */
import { SECOND_AT, SHADOW_RANKS, SLOTS } from '@/data/shadows';
import { ALL_ENEMIES, enemyById } from './gates';
import { licensedRank } from './licence';
import { MISSIONS } from './missions';
import type { Attrs, Enemy, Save, Shadow, Tactic } from './types';
import { STATS } from './types';
import { clamp, dayKey, uid } from './util';

export const EXTRACT_MP: Record<string, number> = { E: 50, D: 60, C: 70, B: 80, A: 90, S: 100 };
/** +1% to every attribute per kill, up to its rank's cap. */
export const GROWTH_PER_KILL = 0.01;

export { SECOND_AT, SHADOW_RANKS, SLOTS };

export const rankIndex = (sh: Shadow) => SHADOW_RANKS.reduce((n, r, i) => (sh.kills >= r.kills ? i : n), 0);
export const rankOf = (sh: Shadow) => SHADOW_RANKS[rankIndex(sh)];
export const nextRank = (sh: Shadow) => SHADOW_RANKS[rankIndex(sh) + 1] ?? null;

/** Shadow slots the Secret Missions have paid for, on top of the grade's. */
export const missionSlots = (s: Save) => MISSIONS.filter((m) => m.grant.slot && s.hunter.missions.includes(m.id)).reduce((n, m) => n + (m.grant.slot ?? 0), 0);

export const slots = (s: Save) => SLOTS[licensedRank(s)] + missionSlots(s);
export const squad = (s: Save) => s.shadows.squad.slice(0, slots(s)).map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x);
export const freeSlots = (s: Save) => Math.max(0, Math.min(slots(s), s.shadows.army.length) - squad(s).length);
export const isBound = (s: Save, enemyId: string) => s.shadows.army.some((x) => x.enemyId === enemyId);

export const growth = (sh: Shadow) => Math.min(rankOf(sh).cap, sh.kills * GROWTH_PER_KILL);

/**
 * A creature's second ability: the second in its own kit, or, for one that has
 * only one, the first ability of its kin it does not have, its family's first and
 * then, for a family that shares one ability, its role's.
 */
export function secondOf(e: Enemy): string | null {
  if (e.kit[1]) return e.kit[1];
  for (const kin of [(k: Enemy) => k.family === e.family, (k: Enemy) => k.role === e.role]) {
    for (const k of ALL_ENEMIES) if (kin(k) && k.id !== e.id) for (const a of k.kit) if (!e.kit.includes(a)) return a;
  }
  return null;
}

/** What a Shadow fights with: its creature's first ability, and from Sworn its second. */
export function kitOf(sh: Shadow): string[] {
  const e = enemyById(sh.enemyId)!;
  const second = rankIndex(sh) >= SECOND_AT ? secondOf(e) : null;
  return second ? [e.kit[0], second] : [e.kit[0]];
}

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

/** Give a Shadow standing orders of its own, or null to have it follow the party's. Mutates. */
export function setTactic(s: Save, id: string, tactic: Tactic | null) {
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return;
  if (tactic) sh.tactic = tactic;
  else delete sh.tactic;
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
