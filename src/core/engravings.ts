/**
 * Engravings and the Codex (`data/engravings.ts`). A worn piece's engraving is live, one to each kind of
 * gear; recycling an engraved piece keeps its power in the Codex for good; a power from the Codex is cut
 * into a piece of its kind for Ascendant Ember. A Gate's boss and Gatekeeper leave a piece found whole
 * with their family's engraving at stated odds, drawn from the run's own seed apart from every other draw
 * a run makes, so nothing else it leaves moves.
 *
 * Engravings reach the fight only through `raid.heroSpec`, as passives by name, and an open run keeps
 * the hero it walked in with.
 */
import { AUTO_ENGRAVE, ENGRAVE_EMBER, ENGRAVED, ENGRAVINGS, GROUPS, engravingById, engravingOfFamily, groupOfSlot, type EngraveGroup, type EngravingId } from '@/data/engravings';
import { EMBER } from '@/data/forge';
import { defOf, ofRank, SLOTS, equippedIn } from './gear';
import { enemyById } from './gates';
import type { Dungeon, Item, Rank, Save } from './types';
import { rng } from './util';

export { ENGRAVINGS, GROUPS, engravingById, groupOfSlot };
export type { EngraveGroup, EngravingId };

/** The kind of gear a piece is, for its engraving. */
export const groupOf = (it: Item | null | undefined) => groupOfSlot(defOf(it ?? undefined)?.slot);

/** The powers in the Codex. */
export const codex = (s: Save): EngravingId[] => (s.codex ?? []) as EngravingId[];
export const known = (s: Save, id: string) => codex(s).includes(id as EngravingId);

/** Keep a power in the Codex for good. Returns true if it was new. Mutates. */
export function learn(s: Save, id: string | undefined): boolean {
  if (!id || !engravingById(id) || known(s, id)) return false;
  s.codex = [...codex(s), id as EngravingId];
  return true;
}

/**
 * The worn pieces whose engravings are live: in the order Equipment lists its slots, the first engraved
 * piece of each kind. Another engraved piece of a kind already taken is dormant.
 */
export function liveItems(s: Save): Partial<Record<EngraveGroup, Item>> {
  const out: Partial<Record<EngraveGroup, Item>> = {};
  for (const sl of SLOTS) {
    const it = equippedIn(s, sl.key);
    const g = groupOf(it);
    if (it?.engr && g && !out[g] && engravingById(it.engr)) out[g] = it;
  }
  return out;
}

/** The engravings live on the hunter, one to each kind at most. */
export const live = (s: Save): EngravingId[] => Object.values(liveItems(s)).map((it) => it!.engr as EngravingId);

/** Whether a worn engraved piece is dormant: another piece of its kind holds the live engraving. */
export function dormant(s: Save, it: Item): boolean {
  const g = groupOf(it);
  if (!it.engr || !g) return false;
  const on = liveItems(s)[g];
  return !!on && on.id !== it.id && SLOTS.some((sl) => s.equipped[sl.key] === it.id);
}

/** What cutting a power into a piece costs, in Ascendant Ember. */
export const cost = (it: Item | null | undefined) => ENGRAVE_EMBER[(defOf(it ?? undefined)?.rank ?? 'E') as Rank];

/** Why a power cannot be cut into a piece, or null when it can. */
export function blocked(s: Save, itemId: string, id: string): 'unknown' | 'kind' | 'same' | 'ember' | null {
  const it = s.items.find((i) => i.id === itemId);
  const e = engravingById(id);
  if (!it || !e || !known(s, id)) return 'unknown';
  if (groupOf(it) !== e.group) return 'kind';
  if (it.engr === id) return 'same';
  if ((s.materials?.[EMBER.id] ?? 0) < cost(it)) return 'ember';
  return null;
}

/**
 * Cut a power from the Codex into a piece, for its Ember. A power it replaces goes into the Codex, so
 * nothing found is lost. Returns what it held before and what it holds now, or null. Mutates.
 */
export function engrave(s: Save, itemId: string, id: EngravingId): { from?: EngravingId; to: EngravingId } | null {
  if (blocked(s, itemId, id)) return null;
  const it = s.items.find((i) => i.id === itemId)!;
  s.materials[EMBER.id] = (s.materials[EMBER.id] ?? 0) - cost(it);
  const from = it.engr as EngravingId | undefined;
  learn(s, from);
  it.engr = id;
  return { from, to: id };
}

/**
 * The engraved pieces a run's clear leaves: its boss's family's engraving at `ENGRAVED.boss`, and its
 * Gatekeeper's, if it fell, at `ENGRAVED.keeper`, each on a design of the Gate's grade and of the
 * engraving's kind. Drawn from the run's seed apart from every other draw. A Trial, which leaves a
 * masterwork, leaves none.
 */
export function engravedDrops(d: Dungeon, seed: string, keeperFell: boolean): { defId: string; engr: EngravingId }[] {
  if (d.trial || d.id === 'DNG-000') return [];
  const r = rng(`${seed}|engrave`);
  const out: { defId: string; engr: EngravingId }[] = [];
  const leave = (enemy: string | undefined, odds: number) => {
    const roll = r();
    const e = engravingOfFamily(enemyById(enemy ?? '')?.family);
    if (!e || roll >= odds) return;
    const slots = GROUPS.find((g) => g.key === e.group)!.slots;
    const pool = ofRank(d.rank as Rank).filter((g) => slots.includes(g.slot));
    const def = pool[Math.floor(r() * pool.length)];
    if (def) out.push({ defId: def.id, engr: e.id });
  };
  leave(d.boss, ENGRAVED.boss);
  if (keeperFell && d.elite) leave(d.elite, ENGRAVED.keeper);
  return out;
}

/** The engraving a Gate's boss and Gatekeeper leave, for the brief to name. */
export const leftBy = (d: Dungeon) => ({
  boss: engravingOfFamily(enemyById(d.boss)?.family),
  keeper: d.elite ? engravingOfFamily(enemyById(d.elite)?.family) : undefined,
});

/**
 * The System's engravings, for the balance tools' hunter who keeps up: every power known, and the first
 * of `AUTO_ENGRAVE` for each kind cut into the first worn piece of that kind, without Ember. Mutates.
 */
export function autoEngrave(s: Save) {
  s.codex = ENGRAVINGS.map((e) => e.id);
  for (const g of GROUPS) {
    const sl = SLOTS.find((x) => g.slots.includes(x.accepts) && equippedIn(s, x.key));
    const it = sl ? equippedIn(s, sl.key) : null;
    if (it) it.engr = AUTO_ENGRAVE[g.key][0];
  }
}
