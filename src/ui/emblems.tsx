/**
 * What a creature is, at a glance. Every family has a glyph of its own, drawn in strokes on a
 * 24-unit grid: a creature shows it alone (`FamilyGlyph`), and a Shadow shows it doubled in violet,
 * the creature and the shadow behind it, on its badge with the insignia of its rank (`ShadowEmblem`).
 * The insignia are chevrons, after an army's: one for Bound, then two and three, and a rocker under
 * three for Ascendant.
 *
 * The parts are path data, so the promotion's cinematic draws the same badge on its canvas
 * (`emblemParts`, read by `ui/arrival.ts`).
 */
import { SHADOW_RANKS } from '@/data/shadows';

const dot = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Each family's glyph, stroked. */
export const FAMILY: Record<string, string> = {
  Undead: `M6.5 13.5V11a5.5 5.5 0 0 1 11 0v2.5l-1.8 1.6V18H8.3v-2.9zM10.6 18v-2M13.4 18v-2M11.4 14.4 12 13.2l.6 1.2${dot(9.6, 11, 1.25)}${dot(14.4, 11, 1.25)}`,
  Beast: `M8.2 16.6c0-2.3 1.7-4.3 3.8-4.3s3.8 2 3.8 4.3c0 1.4-1 2.4-2.3 2.4-.6 0-1-.3-1.5-.3s-.9.3-1.5.3c-1.3 0-2.3-1-2.3-2.4z${dot(6.6, 11.2, 1.5)}${dot(9.6, 7.4, 1.5)}${dot(14.4, 7.4, 1.5)}${dot(17.4, 11.2, 1.5)}`,
  Goblinoid: `M8.4 11.2 3.4 8l4.6 5.6M15.6 11.2l5-3.2-4.6 5.6M8 12.6a4 4.6 0 1 0 8 0a4 4.6 0 1 0-8 0M10.3 15.2q1.7 1.2 3.4 0${dot(10.4, 12, 0.8)}${dot(13.6, 12, 0.8)}`,
  Orc: 'M7 10.5c0-2.8 2.2-5 5-5s5 2.2 5 5v3.5c0 2.6-2.2 4.5-5 4.5s-5-1.9-5-4.5zM8.6 10.4l2.2 1M15.4 10.4l-2.2 1M9.4 17.8c-.7-1.4-.5-2.9.4-4M14.6 17.8c.7-1.4.5-2.9-.4-4',
  Plant: 'M5.5 18.5c0-7.5 5-12.5 13-13 0 8-5 13-13 13zM5.5 18.5l9-9M9.6 14.4h3M12.1 11.9V9.1',
  Slime: `M12 4.5c2.6 3.6 6 6.8 6 10.2a6 6 0 0 1-12 0c0-3.4 3.4-6.6 6-10.2zM10.5 17.4q1.5.8 3 0${dot(10, 14.5, 0.8)}${dot(14, 14.5, 0.8)}`,
  Construct: `M12 4.2V7M12 17v2.8M4.2 12H7M17 12h2.8M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2${dot(12, 12, 5)}${dot(12, 12, 2)}`,
  Demon: 'M8.2 9.2C5.6 8.6 4.4 6.4 5 3.8c.9 1.8 2.4 2.8 4.4 3.2M15.8 9.2c2.6-.6 3.8-2.8 3.2-5.4-.9 1.8-2.4 2.8-4.4 3.2M7.6 9.5h8.8l-1 5.6L12 18.5l-3.4-3.4zM9.6 11.8l1.6.8M14.4 11.8l-1.6.8',
  Dragonkin: 'M4.5 6.5c5 .2 10 2.8 15 8M4.5 6.5 6.8 18M4.5 6.5l6.6 9.8M4.5 6.5l11 7.4M6.8 18q1.6-2.4 4.3-1.7 1.8-2.6 4.4-2.4 2-1.2 4-.4',
  Elemental: 'M12 3.5c1.4 3 5 5.2 5 9.8a5 5 0 0 1-10 0c0-2 .9-3.4 2-4.4.1 1.8.9 3 2.1 3.2-.4-3.2.2-6 .9-8.6zM12 18.3a2 2 0 0 1-2-2c0-1.2 1-2.2 2-3.4 1 1.2 2 2.2 2 3.4a2 2 0 0 1-2 2z',
  Giantkin: 'M7 10.6V8.8a1.4 1.4 0 0 1 2.8 0V8a1.4 1.4 0 0 1 2.8 0v.3a1.4 1.4 0 0 1 2.8 0v1a1.4 1.4 0 0 1 2.6.7v4.5c0 3-2.4 5-5.4 5h-1.3C8.9 19.5 7 17.6 7 15zM7 12.6h3.2a1.45 1.45 0 0 1 0 2.9H9M9.8 8.8v2M12.6 8.3v2.4M15.4 8.6v2',
  Humanoid: `M6 19.5c0-7 2.6-12.3 6-13.8 3.4 1.5 6 6.8 6 13.8M9.2 19.5c0-3.6 1.2-6.4 2.8-6.4s2.8 2.8 2.8 6.4${dot(10.9, 15.6, 0.6)}${dot(13.1, 15.6, 0.6)}`,
  Insectoid: 'M12 8.6c2.4 0 3.8 2.4 3.8 5.6s-1.5 5.3-3.8 5.3-3.8-2.1-3.8-5.3S9.6 8.6 12 8.6zM12 9.2v10M10.4 8.8a1.6 1.6 0 0 1 3.2 0M11.2 7.4 9.4 4.6M12.8 7.4l1.8-2.8M8.5 11.6 5.6 10.2M8.2 14.2h-3M8.5 16.8l-2.9 1.4M15.5 11.6l2.9-1.4M15.8 14.2h3M15.5 16.8l2.9 1.4',
  Aberration: `M4.5 10c2.1-3 4.6-4.5 7.5-4.5s5.4 1.5 7.5 4.5c-2.1 3-4.6 4.5-7.5 4.5S6.6 13 4.5 10zM8.4 13.6c-1 1.8-.6 3.8 1 5.4M12 14.5v5M15.6 13.6c1 1.8.6 3.8-1 5.4${dot(12, 10, 2)}`,
  Aquatic: 'M6.5 15.5c2.4-1.4 4.4-5.4 5.4-10.5 1.2 4.6 3.2 8.4 6.2 10.5M3 18.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0',
  Chimera: `M12 19.5v-5.2M12 14.3 7.4 10.8M12 14.3l4.6-3.5M12 14.3V8.6${dot(6.6, 9.6, 1.9)}${dot(12, 6.6, 1.9)}${dot(17.4, 9.6, 1.9)}`,
};
/** A family not drawn yet falls back to the unknown mark. */
const UNKNOWN = `M9.2 9.2a2.8 2.8 0 1 1 3.8 2.6c-.7.3-1 .8-1 1.5v1M12 17.6v.01${dot(12, 12, 8)}`;
export const familyPath = (family: string) => FAMILY[family] ?? UNKNOWN;

/** A chevron band, filled: its point at `y`, two units thick. */
const chev = (y: number) => `M5 ${y + 4.5} 12 ${y}l7 ${4.5}v2.1L12 ${y + 2.1}l-7 ${4.5}z`;
/** Each Shadow rank's insignia, filled. */
export const INSIGNIA: string[] = [
  chev(8.6),
  chev(6.6) + chev(11),
  chev(4.6) + chev(9) + chev(13.4),
  chev(3) + chev(7.4) + chev(11.8) + 'M4.6 17.4c4.6 3.6 10.2 3.6 14.8 0v2.2c-4.6 3.6-10.2 3.6-14.8 0z',
];
export const insigniaPath = (rank: number) => INSIGNIA[Math.max(0, Math.min(INSIGNIA.length - 1, rank))];

/** The Shadow badge: a shield, the family glyph with its shadow, and the rank's insignia under them. */
export const SHIELD = 'M12 1.6 20.6 4.9v6.9c0 5.4-3.6 9.2-8.6 10.7-5-1.5-8.6-5.3-8.6-10.7V4.9z';
/** Where the parts sit on the shield, as [scale, x, y]: the glyph, its shadow, and the insignia. */
export const PLACE = { glyph: [0.48, 6.24, 2.3], echo: [0.48, 7.1, 1.5], insignia: [0.34, 7.92, 13.9] } as const;
const at = ([k, x, y]: readonly [number, number, number]) => `translate(${x} ${y}) scale(${k})`;

export interface EmblemParts { frame: string; glyph: string; insignia: string }
export const emblemParts = (family: string, rank: number): EmblemParts => ({ frame: SHIELD, glyph: familyPath(family), insignia: insigniaPath(rank) });

/** A creature's family, alone. Takes the colour it is set in. */
export function FamilyGlyph({ family, size = 24, class: cls }: { family: string; size?: number; class?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`famglyph ${cls ?? ''}`} role="img" aria-label={family}>
      <path d={familyPath(family)} />
    </svg>
  );
}

/** A rank's insignia, alone. */
export function Insignia({ rank, size = 20, class: cls }: { rank: number; size?: number; class?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`insignia ${cls ?? ''}`} data-rank={rank} role="img" aria-label={`${SHADOW_RANKS[rank]?.name ?? ''} Rank`}>
      <path d={insigniaPath(rank)} />
    </svg>
  );
}

/** A Shadow's badge: what it was, the shadow it is, and its rank. */
export function ShadowEmblem({ family, rank, size = 48, class: cls }: { family: string; rank: number; size?: number; class?: string }) {
  const p = emblemParts(family, rank);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`emblem ${cls ?? ''}`} data-rank={rank} role="img" aria-label={`${family}, ${SHADOW_RANKS[rank]?.name ?? ''} Rank`}>
      <path class="emblem__shield" d={p.frame} />
      <path class="emblem__echo" d={p.glyph} transform={at(PLACE.echo)} />
      <path class="emblem__glyph" d={p.glyph} transform={at(PLACE.glyph)} />
      <path class="emblem__insignia" d={p.insignia} transform={at(PLACE.insignia)} />
    </svg>
  );
}
