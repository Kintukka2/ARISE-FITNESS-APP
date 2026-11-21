/**
 * Shadow equipment (`data/shadowgear.ts`): a piece for each of a Shadow's four slots, found in a Shadows' cache. A piece
 * held and worn by none is in `s.shadows.items`; a piece worn is held inside its Shadow (`Shadow.gear`), so a Shadow's
 * stats (`shadows.statsOf`) read what it wears without the save, and an open run keeps the Shadows it walked in with.
 * Engine functions take the save and mutate it.
 */
import { ROLL, SHADOW_GEAR_STAT, SHADOW_SLOTS, type ShadowSlot, type ShadowSlotDef } from '@/data/shadowgear';
import type { Attrs, Rank, Save, Shadow, ShadowItem, Stat } from './types';
import { STATS } from './types';
import { uid, type Rand } from './util';

export { SHADOW_SLOTS };
export type { ShadowSlot };

export const slotDef = (k: ShadowSlot): ShadowSlotDef => SHADOW_SLOTS.find((x) => x.key === k)!;
/** A piece's name: its grade's name for its slot. */
export const nameOf = (it: ShadowItem) => slotDef(it.slot).names[it.rank];

/** Draw a piece of a grade, its slot, its leading stat and its roll from `roll`. */
export function draw(rank: Rank, roll: Rand, id = uid('sg')): ShadowItem {
  const def = SHADOW_SLOTS[Math.floor(roll() * SHADOW_SLOTS.length)];
  const lead = def.lead[Math.floor(roll() * def.lead.length)];
  const q = Math.round((ROLL.min + (ROLL.max - ROLL.min) * roll()) * 100) / 100;
  const base = SHADOW_GEAR_STAT[rank] * q;
  const stats: Partial<Record<Stat, number>> = { [lead]: Math.round(base) };
  stats[def.second] = (stats[def.second] ?? 0) + Math.round(base / 2);
  return { id, slot: def.key, rank, q, stats };
}

/** What every piece a Shadow wears adds to its stats. */
export function bonusOf(sh: Shadow): Attrs {
  const out = Object.fromEntries(STATS.map((k) => [k, 0])) as Attrs;
  for (const it of Object.values(sh.gear ?? {})) if (it) for (const k of STATS) out[k] += it.stats[k] ?? 0;
  return out;
}

/** The pieces held and worn by none. */
export const held = (s: Save): ShadowItem[] => s.shadows.items ?? [];
/** Who wears a piece, if anyone. */
export const wearer = (s: Save, id: string): Shadow | undefined => s.shadows.army.find((sh) => Object.values(sh.gear ?? {}).some((it) => it?.id === id));
/** Every piece, held or worn. */
export const all = (s: Save): ShadowItem[] => [...held(s), ...s.shadows.army.flatMap((sh) => Object.values(sh.gear ?? {}).filter((x): x is ShadowItem => !!x))];

/** Put pieces found into the hold. Mutates. */
export function give(s: Save, items: ShadowItem[]) {
  if (!items.length) return;
  s.shadows.items = [...held(s), ...items];
}

/**
 * Put a piece on a Shadow, from the hold or from another Shadow; what it wore there goes back to the hold. False if the
 * piece or the Shadow is not found. Mutates.
 */
export function equip(s: Save, shadowId: string, itemId: string): boolean {
  const sh = s.shadows.army.find((x) => x.id === shadowId);
  if (!sh) return false;
  let it = held(s).find((x) => x.id === itemId);
  if (it) s.shadows.items = held(s).filter((x) => x.id !== itemId);
  else {
    const from = wearer(s, itemId);
    if (!from) return false;
    it = Object.values(from.gear ?? {}).find((x) => x?.id === itemId)!;
    delete from.gear![it.slot];
  }
  const was = sh.gear?.[it.slot];
  if (was) s.shadows.items = [...held(s), was];
  sh.gear = { ...(sh.gear ?? {}), [it.slot]: it };
  return true;
}

/** Take a piece off a Shadow, back to the hold. False if it wears nothing there. Mutates. */
export function unequip(s: Save, shadowId: string, slot: ShadowSlot): boolean {
  const sh = s.shadows.army.find((x) => x.id === shadowId);
  const it = sh?.gear?.[slot];
  if (!sh || !it) return false;
  delete sh.gear![slot];
  s.shadows.items = [...held(s), it];
  return true;
}

/** A piece's worth, for sorting: the stats it adds, all told. */
export const worth = (it: ShadowItem) => STATS.reduce((n, k) => n + (it.stats[k] ?? 0), 0);

/** Put the best piece held in every empty or weaker slot of a Shadow. Returns how many slots changed. Mutates. */
export function autoEquip(s: Save, shadowId: string): number {
  const sh = s.shadows.army.find((x) => x.id === shadowId);
  if (!sh) return 0;
  let n = 0;
  for (const def of SHADOW_SLOTS) {
    const best = held(s).filter((x) => x.slot === def.key).sort((a, b) => worth(b) - worth(a))[0];
    const now = sh.gear?.[def.key];
    if (best && (!now || worth(best) > worth(now))) { equip(s, shadowId, best.id); n++; }
  }
  return n;
}

/** Remove a Shadow's pieces when it is released: back to the hold. Mutates. */
export function strip(s: Save, sh: Shadow) {
  const worn = Object.values(sh.gear ?? {}).filter((x): x is ShadowItem => !!x);
  if (worn.length) s.shadows.items = [...held(s), ...worn];
  sh.gear = {};
}
