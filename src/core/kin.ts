/**
 * Kin and Formation: what a squad's make-up gives (`data/kin.ts`). Read from the Shadows deployed as a
 * run walks in (`raid.partySpecs`), so a run keeps what it walked in with, and only as numbers on the
 * fight's stats: a Kin's boon on each Shadow of its family, the Formation's auras on the hunter and on
 * every Shadow. Auto Deploy weighs them (`shadows.bestSquad`). Never touches the DOM.
 */
import { FORMATION, KIN, KIN_ALL, KIN_AT, WORTH } from '@/data/kin';
import { enemyById } from './gates';
import { sumBonuses } from './gear';
import type { Shadow } from './types';

export { FORMATION, KIN, KIN_ALL, KIN_AT };

/** A family in the squad: how many count toward it (the one kin to every family included), and the tier reached, 0 for none. */
export interface KinLine { family: string; n: number; tier: number }

/** A squad's make-up: its Kin, how many of the family kin to every other it holds, its roles, and the auras they give. */
export interface Make { kin: KinLine[]; wild: number; roles: string[]; aura: Record<string, number> }

/** A bonus `n` times over. */
export const times = (b: Record<string, number>, n: number): Record<string, number> =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * n * 1000) / 1000]));

/** The tier `n` Shadows of one family reach: 0 under the first step, then 1, then 2. */
export const tierFor = (n: number) => KIN_AT.reduce((t, at) => (n >= at ? t + 1 : t), 0);

/** A family's boon at a tier: tier II is tier I twice over. Nothing at 0, or for a family with none. */
export const kinBoon = (family: string, tier: number) => (tier > 0 && KIN[family] ? times(KIN[family], tier) : {});

/** The auras the roles give together. */
export const auraOf = (roles: readonly string[]) => sumBonuses(...roles.map((r) => FORMATION[r] ?? {}));

/**
 * The make-up of a squad, from its creatures' families and roles: each family counted (the family kin to
 * every other counted in each of them), the strongest tier first; every distinct role, in the order the
 * auras are listed.
 */
export function makeFrom(members: readonly { family: string; role: string }[]): Make {
  const wild = members.filter((m) => m.family === KIN_ALL).length;
  const count = new Map<string, number>();
  for (const m of members) if (m.family !== KIN_ALL) count.set(m.family, (count.get(m.family) ?? 0) + 1);
  const kin = [...count].map(([family, n]) => ({ family, n: n + wild, tier: tierFor(n + wild) }))
    .sort((a, b) => b.tier - a.tier || b.n - a.n || a.family.localeCompare(b.family));
  const have = new Set(members.map((m) => m.role));
  const roles = Object.keys(FORMATION).filter((r) => have.has(r));
  return { kin, wild, roles, aura: auraOf(roles) };
}

/** The creature a Shadow is. */
const creature = (sh: Shadow) => enemyById(sh.enemyId);

/** The make-up of a squad of Shadows. */
export const makeOf = (squad: readonly Shadow[]): Make =>
  makeFrom(squad.map(creature).filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({ family: e.family, role: e.role })));

/** The Kin boon a member of a squad takes: its family's at the tier reached, or, kin to every family, every boon it completes. */
export function kinBonusFor(family: string, make: Make): Record<string, number> {
  if (family === KIN_ALL) return sumBonuses(...make.kin.map((k) => kinBoon(k.family, k.tier)));
  return kinBoon(family, make.kin.find((k) => k.family === family)?.tier ?? 0);
}

/** The Kin boon a deployed Shadow takes in this squad. */
export const kinBonusOf = (sh: Shadow, make: Make) => {
  const e = creature(sh);
  return e ? kinBonusFor(e.family, make) : {};
};

/** What Auto Deploy counts a bonus as, a share of power (`WORTH`). */
export const worth = (b: Record<string, number>) => Object.entries(b).reduce((n, [k, v]) => n + v * (WORTH[k] ?? 0), 0);
