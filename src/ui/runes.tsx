/**
 * The engravings' marks, a line of sixteen drawn for them alone. They follow The Witcher 3's runestones:
 * a carved stone, one glyph cut into it, lit in its own colour once it is had. They also follow
 * Baldur's Gate 3's spell icons: bright line art on the dark with a glow about it, a hot core down each
 * stroke, and a colour to each power.
 *
 * The stone's shape tells the kind: a shard for a weapon, a broad slab for armour, a cut gem for jewellery.
 * The glyph tells the rule: Withering Strike is a blade wilting at its tip, Unseen a closed eye.
 *
 * A mark has four states:
 * - sealed: the stone grey, the glyph a dark groove. Its power is not kept in the Codex.
 * - kept: the glyph lit in its colour.
 * - attuned: lit, with an aura about the stone and motes rising from it.
 * - dormant: lit dimly. A second piece of its kind worn holds the attuned one.
 *
 * Each colour belongs to its mark alone, the way a rarity colours a piece's art. No text takes it, so it
 * cannot be mistaken for the colours that carry meaning (docs/VOICE.md, "Colour and emphasis").
 */
import type { EngraveGroup, Engraving, EngravingId } from '@/data/engravings';

export type RuneState = 'sealed' | 'kept' | 'attuned' | 'dormant';

/** Each engraving's colour and glyph, the glyph in strokes on a 24-unit grid. */
export const RUNE: Record<EngravingId, { hue: string; glyph: string }> = {
  // Weapons: shards.
  /** Warcry: a stave, and the cry spreading from it. */
  orc: { hue: '#ff5a3c', glyph: 'M6 4v16M10.5 8.5 14 12l-3.5 3.5M15 5.5l5.5 6.5-5.5 6.5' },
  /** Siegebreaker: a column broken through its shaft. */
  giantkin: { hue: '#ffcf4a', glyph: 'M7 3.5h10M9 3.5v6.5M15 3.5v6.5M9 14.5V20M15 14.5V20M6.5 20.5h11M8 10.6l2.4 2 1.6-1.6 1.6 1.6 2.4-2' },
  /** Withering Strike: a blade, its tip wilting, motes falling from it. */
  undead: { hue: '#d27cff', glyph: 'M12 3v10.5M8.5 6.5h7M12 13.5c0 3.6-2.6 6.2-6.2 6.2M15.6 15.4l1.2 1.4M18.2 18.4l1 1.2' },
  /** Dirty Trick: a dagger driven at a foe held fast. */
  goblinoid: { hue: '#ff5fc6', glyph: 'M4.5 19.5l8-8M6.2 13.6l4.2 4.2M13.3 7.5a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0' },
  /** Flask Thrower: a flask, its draught, and what flies from it. */
  humanoid: { hue: '#2fe6d8', glyph: 'M10 3.5h4M10.8 3.5v5L6.6 17.4c-.6 1.3.3 2.6 1.7 2.6h7.4c1.4 0 2.3-1.3 1.7-2.6L13.2 8.5v-5M8.7 13.6h6.6M18.6 5.6l2-2M19.6 9l2.4-.6' },
  // Armour: slabs.
  /** Pack Hide: three claws raked across a guard. */
  beast: { hue: '#e8bd8e', glyph: 'M5.5 5q2.4 5.4 5.6 9.6M10 3.6q2.4 6.2 5.8 10.4M14.8 3.8q2 4.8 4.8 8.4M4.5 18.6q7.5 3.6 15 0' },
  /** Dragonscale: scales laid row over row, as a hide lies. */
  dragonkin: { hue: '#ff9330', glyph: 'M9 5a3 3 0 0 0 6 0M6 10.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0M3 16a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0' },
  /** Shapeshift: two forms laid over each other, the eye where they meet. */
  chimera: { hue: '#a98bff', glyph: 'M4 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M10 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 8.6v6.8' },
  /** Tidewater: a drop over the swell. */
  aquatic: { hue: '#3d9dff', glyph: 'M12 3.5c2.2 3 3.8 5 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2 1.6-4 3.8-7zM4 16.5q2-1.8 4 0t4 0 4 0 4 0M4 20.5q2-1.8 4 0t4 0 4 0 4 0' },
  /** Carapace: a shell inside a shell. */
  insectoid: { hue: '#cfe84a', glyph: 'M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3zM12 8l4 2.3v4.4L12 17l-4-2.3v-4.4z' },
  // Jewellery: cut gems.
  /** Hellbrand: a horned brand. */
  demon: { hue: '#ff2e64', glyph: 'M4.5 4q1 6.5 7.5 6.5T19.5 4M12 10.5v10M8 16h8' },
  /** Overcharge: a bolt, and frost at its spark. */
  elemental: { hue: '#a6f0ff', glyph: 'M12.5 3 7.5 12.5H13L9 21M18 3.5v5M15.8 4.8l4.4 2.4M15.8 7.2l4.4-2.4' },
  /** Engulf: a spiral that swallows. */
  slime: { hue: '#8fe35a', glyph: 'M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0' },
  /** Bulwark Core: a core held in a frame's corners. */
  construct: { hue: '#8eaaff', glyph: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 1 0 0-5.6zM4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15' },
  /** Unseen: a closed eye. */
  aberration: { hue: '#7d6dff', glyph: 'M4 10.5q8 7.5 16 0M7.2 14.2l-1.6 2.6M12 15.9V19M16.8 14.2l1.6 2.6M7 6q5-2.5 10 0' },
  /** Overgrowth: a stave in leaf. */
  plant: { hue: '#3fe39a', glyph: 'M12 21V5M12 11.5c-4.2 0-6.2-2.2-6.5-5.8 4 .2 6.2 2.2 6.5 5.8zM12 16c4.2 0 6.2-2.2 6.5-5.8-4 .2-6.2 2.2-6.5 5.8zM8.5 21h7' },
};

/** Each kind's stone, on a 48-unit grid: its outline, and the faint facets a gem is cut with. */
const STONE: Record<EngraveGroup, { body: string; facets?: string; glyph: string }> = {
  weapon: {
    body: 'M24 3.5c3 1.5 7.5 5 10 9 2.8 4.5 4 12.5 2.6 19-1.2 5.5-5.6 10.9-10.6 12.7-4.4 1.4-9.6-.6-12.6-4.6-3.2-4.2-3.8-11.6-2.8-18 1-6.6 4-12 8.4-15.6 1.6-1.4 3.4-2.6 5-2.5z',
    glyph: 'translate(11.4 12) scale(1.02)',
  },
  armour: {
    body: 'M9.5 13.5c3-6.5 11.5-8.9 19-8.1 7.1.8 12.9 5.2 14.1 12.6 1.2 7.6-.6 15.6-5.8 20.8-5.2 5.2-14.2 6.2-21 3.4C9.2 39.6 5.4 33 5.2 26c-.2-4.6 1.8-8.4 4.3-12.5z',
    glyph: 'translate(12 12.2)',
  },
  jewellery: {
    body: 'M18 4.5h12L41.5 15v16.5l-11 12h-13l-11-12V15z',
    facets: 'M19.6 10.5h8.8l7 6.6V29l-7 7.5h-8.8l-7-7.5V17.1zM18 4.5l1.6 6M30 4.5l-1.6 6M41.5 15l-6.1 2.1M41.5 31.5l-6.1-2.5M30.5 43.5l-2.1-7M17.5 43.5l2.1-7M6.5 31.5l6.1-2.5M6.5 15l6.1 2.1',
    glyph: 'translate(12 11.8)',
  },
};

/** A few flecks in the stone, the same for an engraving every time it is drawn. */
function flecks(id: string): { x: number; y: number; r: number; d: boolean }[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const next = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  return Array.from({ length: 6 }, () => ({ x: 14 + next() * 20, y: 12 + next() * 24, r: 0.35 + next() * 0.55, d: next() > 0.5 }));
}

/** The glyph's strokes alone, for a mark too small for its stone (a tile's corner, a find). */
export function RuneGlyph({ e, size = 16, dim = false }: { e: Engraving; size?: number; dim?: boolean }) {
  const r = RUNE[e.id];
  return (
    <svg class={`runeglyph ${dim ? 'is-dim' : ''}`} style={`--rh: ${r.hue}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={r.glyph} />
    </svg>
  );
}

/**
 * An engraving's mark: its stone, its glyph and, while attuned, its aura. `drawn` cuts the glyph in
 * stroke by stroke, as it does when the mark is first chosen.
 */
export function Runestone({ e, size = 48, state = 'kept', drawn = false }: { e: Engraving; size?: number; state?: RuneState; drawn?: boolean }) {
  const r = RUNE[e.id];
  const st = STONE[e.group];
  return (
    <span class={`rune is-${state} ${drawn ? 'is-drawn' : ''} ${size >= 56 ? 'is-big' : ''}`} style={`--rh: ${r.hue}; --s: ${size}px`} aria-hidden="true">
      {state === 'attuned' && size >= 40 && (
        <span class="rune__motes">
          <i /><i /><i /><i />
        </span>
      )}
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <ellipse class="rune__shade" cx="24" cy="44.5" rx="14" ry="2.6" />
        <path class="rune__body" d={st.body} />
        <path class="rune__face" d={st.body} transform="translate(1.2 1) scale(0.9)" />
        {st.facets && <path class="rune__facets" d={st.facets} />}
        {flecks(e.id).map((f, i) => <circle key={i} class={f.d ? 'rune__fleck is-dark' : 'rune__fleck'} cx={f.x} cy={f.y} r={f.r} />)}
        <g transform={st.glyph}>
          <path class="rune__groove" d={r.glyph} transform="translate(0.45 0.65)" />
          <path class="rune__cut" d={r.glyph} pathLength={100} />
          <path class="rune__core" d={r.glyph} />
        </g>
      </svg>
    </span>
  );
}

/** A socket with nothing attuned in it: the kind's stone, outlined and empty. */
export function EmptyStone({ group, size = 48 }: { group: EngraveGroup; size?: number }) {
  return (
    <span class="rune is-empty" style={`--s: ${size}px`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <path class="rune__hollow" d={STONE[group].body} />
      </svg>
    </span>
  );
}

/** The circle drawn behind a mark being read: two rings of ticks and notches, turning slowly opposite ways. */
export function ArcaneRing({ size = 140 }: { size?: number }) {
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  const notches = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg class="arcring" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <g class="arcring__outer">
        <circle cx="50" cy="50" r="47" />
        <circle cx="50" cy="50" r="43.5" class="is-faint" />
        {ticks.map((i) => <line key={i} x1="50" y1="3" x2="50" y2={i % 4 === 0 ? 7.4 : 5.2} transform={`rotate(${i * 7.5} 50 50)`} />)}
      </g>
      <g class="arcring__inner">
        <circle cx="50" cy="50" r="36" class="is-faint" />
        {notches.map((i) => <path key={i} d="M50 11.5l2.4 3.6h-4.8z" transform={`rotate(${i * 45 + 22.5} 50 50)`} />)}
        <path class="is-faint" d="M50 14 81.2 68 18.8 68zM50 86 18.8 32 81.2 32z" />
      </g>
    </svg>
  );
}
