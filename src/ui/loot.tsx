/**
 * Loot, felt by its grade: the face-down box, the moment it turns over, and the light each grade keeps.
 * The results of a run turn over everything it found; a cache turns over what it held.
 *
 * From Rare up a piece gathers itself first, the box trembling in its grade's colour, the longer the
 * higher it is. Then it breaks open with a ring, sparks and a sound that rise with the grade, Heroic
 * lighting the screen gold and Legendary lighting it red and shaking it. Each keeps the light it earns:
 * a glow from Uncommon, a pulse from Rare, turning rays from Epic, orbiting sparks from Heroic, and at
 * Legendary all of it, floating. The styles are `.haul__item`, `.aura` and `.lootflash` in screens.css.
 */
import { engravingById } from '@/data/engravings';
import { RUNE, RuneGlyph } from './runes';
import { useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import type { Item } from '@/core/types';
import { GearArt } from './components';
import { Glyph } from './icons';
import { buzz, reducedMotion } from './feedback';

/** How long loot of each grade gathers itself before it turns over, in ms, and how it lands in the hand. */
const CHARGE: Record<string, number> = { E: 0, D: 0, C: 220, B: 420, A: 720, S: 1150 };
const BUZZ: Record<string, number[]> = {
  E: [8], D: [12], C: [14, 30, 22], B: [20, 40, 30, 40, 50], A: [30, 40, 30, 40, 90], S: [60, 40, 60, 40, 220],
};
/** Sparks thrown out when it opens. */
const SPARKS: Record<string, number> = { E: 0, D: 0, C: 8, B: 12, A: 18, S: 26 };

export type LootState = 'down' | 'charging' | 'open';

/**
 * A find to turn over: an item the hunter holds, a design found and not yet granted (a cache's, until
 * the run is settled), or a blueprint learned.
 */
export type Loot = { item: Item } | { defId: string; blueprint?: boolean };
const defOf = (l: Loot) => ('item' in l ? gear.defOf(l.item) : gear.gearDef(l.defId));

/**
 * Turning a set of loot over. `reveal` gathers a piece (by its grade) then opens it; `revealAll`
 * turns over the rest, a beat apart. `flash` is the screen's light for Heroic and Legendary, to be
 * rendered once; `quake` is true while a Legendary shakes what holds it.
 */
export function useReveal(loot: Loot[]) {
  const [open, setOpen] = useState<number[]>([]);
  const [charging, setCharging] = useState<number[]>([]);
  const [burst, setBurst] = useState<{ rank: string; k: number } | null>(null);
  const [quake, setQuake] = useState(false);
  const turning = useRef(new Set<number>());
  const bursts = useRef(0);
  const rankOf = (i: number) => defOf(loot[i])?.rank ?? 'E';

  const land = (i: number) => {
    const rank = rankOf(i);
    setCharging((c) => c.filter((x) => x !== i));
    setOpen((o) => (o.includes(i) ? o : [...o, i]));
    sfx.loot(rank);
    buzz(BUZZ[rank] ?? 10);
    if (rank === 'A' || rank === 'S') setBurst({ rank, k: ++bursts.current });
    if (rank === 'S' && !reducedMotion()) { setQuake(true); setTimeout(() => setQuake(false), 520); }
  };
  const reveal = (i: number) => {
    if (turning.current.has(i)) return;
    turning.current.add(i);
    const rank = rankOf(i);
    const wait = reducedMotion() ? Math.min(CHARGE[rank] ?? 0, 200) : CHARGE[rank] ?? 0;
    if (!wait) return land(i);
    setCharging((c) => [...c, i]);
    sfx.lootCharge(rank, wait / 1000);
    buzz(10);
    setTimeout(() => land(i), wait);
  };
  const revealAll = () => {
    let n = 0;
    loot.forEach((_, i) => { if (!turning.current.has(i)) setTimeout(() => reveal(i), n++ * 260); });
  };
  return {
    stateOf: (i: number): LootState => (open.includes(i) ? 'open' : charging.includes(i) ? 'charging' : 'down'),
    reveal,
    revealAll,
    faceDown: loot.length - open.length,
    quake,
    flash: burst ? <div key={burst.k} class="lootflash" data-rarity={burst.rank} aria-hidden="true" /> : null,
  };
}

/** One piece: face down, gathering itself, or open in the light it keeps. Once open, `onOpen` (if given) opens its card. */
export function LootCell({ loot, i, state, onTap, onOpen }: { loot: Loot; i: number; state: LootState; onTap: () => void; onOpen?: () => void }) {
  const def = defOf(loot);
  const rank = def?.rank ?? 'E';
  const sparks = state === 'open' ? SPARKS[rank] ?? 0 : 0;
  const bp = 'blueprint' in loot && !!loot.blueprint;
  // A piece found engraved shows its engraving's name over its own, and the rune on its art.
  const engraving = 'item' in loot ? engravingById(loot.item.engr) : undefined;
  const name = `${bp ? 'Blueprint: ' : ''}${gear.RARITY[rank as keyof typeof gear.RARITY]?.name ?? ''} ${def?.name ?? ''}${engraving ? `, engraved: ${engraving.name}` : ''}`.trim();
  return (
    <button type="button" class={`haul__item flip is-${state} ${state === 'open' && onOpen ? 'is-link' : ''} ${bp ? 'is-blueprint' : ''}`} style={`--i:${i}`} data-rarity={rank}
      aria-label={state === 'open' ? (onOpen ? `${name}, open its card` : name) : 'Reveal this item'}
      onClick={() => { if (state === 'down') onTap(); else if (state === 'open') onOpen?.(); }}>
      <span class="loot-cell">
        <span class="aura" aria-hidden="true">
          <i class="aura__glow" />
          <i class="aura__rays" />
          {state === 'open' && rank !== 'E' && <i class="aura__ring" />}
          {Array.from({ length: sparks }, (_, k) => <i key={k} class="aura__spark" style={`--a:${(k * 137.5) % 360}deg;--d:${30 + (k % 4) * 10 + (rank === 'S' ? 18 : rank === 'A' ? 10 : 0)}px;--t:${(k % 5) * 22}ms`} />)}
          {state === 'open' && (rank === 'A' || rank === 'S') && <><i class="aura__orbit" /><i class="aura__orbit aura__orbit--2" /></>}
        </span>
        {state === 'open' ? ('item' in loot ? <GearArt item={loot.item} size={56} /> : <GearArt defId={loot.defId} size={56} />) : <span class="flip__back">?</span>}
        {state === 'open' && bp && <span class="haul__bp" aria-hidden="true"><Glyph name="blueprint" /></span>}
        {state === 'open' && engraving && <span class="haul__engr" style={`--rh: ${RUNE[engraving.id].hue}`} aria-hidden="true"><RuneGlyph e={engraving} size={14} /></span>}
      </span>
      <small>{state === 'open' ? <>{bp && <b class="haul__bpname">Blueprint</b>}{engraving && <b class="haul__engrname">{engraving.name}</b>}{def?.name}</> : ''}</small>
    </button>
  );
}
