/**
 * Shadow equipment (the owner's call): a Shadow wears four pieces where the hunter wears ten, a weapon, an off-hand, an
 * armour and an accessory. A piece is found only in a Shadows' cache, the cache behind a seal of Shadow Essence
 * (`data/nodes.ts`, `SEALS`), at the Gate's grade. Each piece adds to the stats of the Shadow wearing it: its slot's
 * leading stat in full and its second at half, the grade's figure times the piece's roll (`ROLL`).
 */
import type { Rank, Stat } from '@/core/types';

export type ShadowSlot = 'weapon' | 'offhand' | 'armour' | 'accessory';

export interface ShadowSlotDef {
  key: ShadowSlot;
  name: string;
  /** The glyph its tile wears (`ui/icons.tsx`). */
  glyph: string;
  /** The stats a piece of it can lead with, and the one it adds at half. */
  lead: Stat[];
  second: Stat;
  /** Each grade's piece's name, E to S. */
  names: Record<Rank, string>;
}

export const SHADOW_SLOTS: ShadowSlotDef[] = [
  {
    key: 'weapon', name: 'Weapon', glyph: 'Weapon', lead: ['STR', 'INT'], second: 'AGI',
    names: { E: 'Gloom Fang', D: 'Dusk Blade', C: 'Umbral Edge', B: 'Nightrend', A: 'Abyssal Reaver', S: 'Monarch’s Fang' },
  },
  {
    key: 'offhand', name: 'Off-Hand', glyph: 'Off-Hand', lead: ['VIT'], second: 'PER',
    names: { E: 'Shade Ward', D: 'Veil Buckler', C: 'Umbral Aegis', B: 'Night Bulwark', A: 'Abyssal Bastion', S: 'Monarch’s Aegis' },
  },
  {
    key: 'armour', name: 'Armour', glyph: 'Chest', lead: ['VIT'], second: 'STR',
    names: { E: 'Gloom Wrap', D: 'Dusk Mail', C: 'Umbral Plate', B: 'Night Carapace', A: 'Abyssal Harness', S: 'Monarch’s Mantle' },
  },
  {
    key: 'accessory', name: 'Accessory', glyph: 'Ring', lead: ['AGI', 'PER'], second: 'INT',
    names: { E: 'Shade Bead', D: 'Dusk Charm', C: 'Umbral Sigil', B: 'Night Seal', A: 'Abyssal Eye', S: 'Monarch’s Signet' },
  },
];

/** A piece's leading stat at each grade, before its roll; its second stat takes half. */
export const SHADOW_GEAR_STAT: Record<Rank, number> = { E: 4, D: 6, C: 9, B: 13, A: 18, S: 25 };
/** A piece's roll, from the least to the most of its grade's figure. */
export const ROLL = { min: 0.7, max: 1 } as const;
