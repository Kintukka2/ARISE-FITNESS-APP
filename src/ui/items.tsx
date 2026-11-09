/**
 * Items: the bag at the map's corner, in a Gate and on its brief. A tap opens a wheel of what the hunter
 * carries, a slot to each kind of item, the same slot every time; a slot shows its item and the count held,
 * the hub what a tapped item does, and Use uses it. Choosing, then Use, is the asking: nothing is used on
 * one tap. Slots past the items there are stay empty, for what comes later.
 */
import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { sfx } from '@/audio/audio';
import { Btn } from './components';
import { Glyph } from './icons';

export interface BagItem {
  id: string;
  name: string;
  glyph: string;
  /** A class that tints its glyph, as the Exchange tints a potion's. */
  tone?: string;
  /** How many are held, as the slot shows it: `2/3`, `1`. */
  held: string;
  count: number;
  /** What it does, as the hub shows it: `HP +30%`. */
  effect: string;
  /** Why it cannot be used here and now. Unset, it can. */
  off?: string;
  use: () => void;
}

/** The wheel's slots: one to each kind of item, and room for more. */
export const ITEM_SLOTS = 6;

const C = 150;
const R_OUT = 147;
const R_IN = 76;
const GAP = 0.03;

/** One slot of the wheel: the ring between the two radii, from one angle to the next. */
function slotPath(i: number): string {
  const step = (Math.PI * 2) / ITEM_SLOTS;
  // The first slot sits at the top, and the rest follow it round clockwise.
  const a0 = -Math.PI / 2 - step / 2 + i * step + GAP;
  const a1 = a0 + step - GAP * 2;
  const at = (a: number, r: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  return `M${at(a0, R_OUT)}A${R_OUT} ${R_OUT} 0 0 1 ${at(a1, R_OUT)}L${at(a1, R_IN)}A${R_IN} ${R_IN} 0 0 0 ${at(a0, R_IN)}Z`;
}

/** Where a slot's item sits, as a share of the wheel across and down. */
function slotMid(i: number) {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / ITEM_SLOTS;
  const r = (R_OUT + R_IN) / 2;
  return { left: `${((C + r * Math.cos(a)) / 3).toFixed(2)}%`, top: `${((C + r * Math.sin(a)) / 3).toFixed(2)}%` };
}

/** The bag: a tap opens the wheel. Its badge counts what it holds. */
export function ItemsMark({ items }: { items: BagItem[] }) {
  const [open, setOpen] = useState(false);
  const held = items.reduce((n, x) => n + x.count, 0);
  return (
    <>
      <button type="button" class="bagmark" aria-label={`Items, ${held} held`} title="Items" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { sfx.tap(); setOpen(true); }}>
        <Glyph name="satchel" />
        {held > 0 && <b class="bagmark__n num">{held}</b>}
      </button>
      {open && createPortal(<ItemWheel items={items} close={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ItemWheel({ items, close }: { items: BagItem[]; close: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const chosen = pick === null ? null : items[pick] ?? null;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const choose = (i: number) => { sfx.blip(); setPick(i === pick ? null : i); };
  return (
    <div class="bagwheel" role="dialog" aria-modal="true" aria-label="Items" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="bagwheel__ring">
        <svg viewBox="0 0 300 300" class="bagwheel__svg">
          {Array.from({ length: ITEM_SLOTS }, (_, i) => {
            const x = items[i];
            if (!x) return <path key={i} d={slotPath(i)} class="bagwheel__slot is-empty" aria-hidden="true" />;
            return (
              <path key={i} d={slotPath(i)} role="button" tabIndex={0} aria-pressed={pick === i}
                aria-label={`${x.name}, ${x.held} held${x.off ? `, ${x.off}` : ''}`}
                class={`bagwheel__slot ${pick === i ? 'is-picked' : ''} ${x.off ? 'is-off' : ''}`}
                onClick={() => choose(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); } }} />
            );
          })}
        </svg>
        {items.slice(0, ITEM_SLOTS).map((x, i) => (
          <span key={x.id} class={`bagwheel__item ${pick === i ? 'is-picked' : ''} ${x.off ? 'is-off' : ''}`} style={`left:${slotMid(i).left};top:${slotMid(i).top};--i:${i}`} aria-hidden="true">
            <span class={`bagwheel__glyph ${x.tone ?? ''}`}><Glyph name={x.glyph} /></span>
            <b class="num">{x.held}</b>
          </span>
        ))}
        <div class="bagwheel__hub">
          {chosen ? <>
            <span class={`bagwheel__glyph ${chosen.tone ?? ''}`}><Glyph name={chosen.glyph} /></span>
            <b class="bagwheel__name">{chosen.name}</b>
            <span class="bagwheel__effect">{chosen.effect}</span>
            <span class="bagwheel__held">Held: <span class="num">{chosen.held}</span></span>
            {chosen.off
              ? <small class="bagwheel__off">{chosen.off}</small>
              : <Btn kind="primary" size="sm" onClick={() => { close(); chosen.use(); }}>Use</Btn>}
          </> : <>
            <Glyph name="satchel" />
            <b class="bagwheel__name">Items</b>
            <small class="bagwheel__off">Tap an item.</small>
          </>}
        </div>
      </div>
      <Btn kind="ghost" size="sm" class="bagwheel__close" onClick={close}>Close</Btn>
    </div>
  );
}
