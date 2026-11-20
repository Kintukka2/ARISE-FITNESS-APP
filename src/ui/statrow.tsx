/**
 * A stat as a row, the one look for the Status sheet and an Association hunter's card (the owner's call: the two set
 * out alike, open, a hairline between rows and no box round each stat):
 * - its mark in the System's cyan, its key;
 * - a bar toward the Ability Points' limit;
 * - what stands beside the figure: the hunter's own points before class, skills and gear, or `Best` on a hunter's
 *   card, the stat their class leads with, lit in advancement's gold;
 * - the figure, and on the Status sheet a + while a point can go there.
 * A tap opens the one stat tooltip (`ui/stattip.tsx`), anchored to the row, or spends a point.
 */
import type { ComponentChildren } from 'preact';
import { STAT_CAP } from '@/core/progression';
import type { Stat } from '@/core/types';
import { Glyph, STAT_ICON } from './icons';

export function StatRow({ k, value, bar, aside, best, open, plus, label, onTap }: {
  k: Stat;
  value: number;
  /** What the bar measures toward the Ability Points' limit: the hunter's own points, or an Association hunter's stat. */
  bar: number;
  aside?: ComponentChildren;
  best?: boolean;
  open?: boolean;
  /** The Status sheet's + : true while a point can go here, false to keep its place empty, left out where nothing is spent. */
  plus?: boolean;
  label: string;
  onTap: (el: Element) => void;
}) {
  return (
    <button type="button" class={`statrow ${best ? 'is-best' : ''} ${open ? 'is-open' : ''} ${plus !== undefined ? 'has-plus' : ''}`}
      aria-label={label} aria-expanded={plus ? undefined : !!open} onClick={(e) => onTap(e.currentTarget as Element)}>
      <Glyph name={STAT_ICON[k] ?? 'star'} />
      <span class="statrow__k">{k}</span>
      <i class="statrow__bar" aria-hidden="true"><i style={`width: ${Math.round(Math.max(0, Math.min(1, bar / STAT_CAP)) * 100)}%`} /></i>
      <small class="statrow__aside num">{aside}</small>
      <b class="statrow__v num">{Math.round(value)}</b>
      {plus !== undefined && (plus ? <span class="statrow__plus"><Glyph name="plus" /></span> : <span class="statrow__plus is-none" />)}
    </button>
  );
}
