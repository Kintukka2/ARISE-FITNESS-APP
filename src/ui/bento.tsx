/**
 * The bento grid, after Magic UI's: a page of tiles, each a System frame in its subject's colour,
 * with a picture of where it stands, its name, one line and a count. Tapping a tile opens its window.
 * Every main screen is laid out with it: Inventory, Gates, Quests and Shadows.
 *
 * The tile is the System's frame without a header (docs/VOICE.md, "The look"), so what it says is
 * the System's: flat, exact, a name wearing its type. The window it opens says the rest.
 */
import type { ComponentChildren } from 'preact';
import { sfx } from '@/audio/audio';
import { SysFrame, type FrameKind } from './frame';
import { Glyph } from './icons';

export interface Tile {
  /** Unique on its screen; the tile's class is `btile--{key}`. */
  key: string;
  kind: FrameKind;
  /** The tile's name: a header word (`Status`) or a name with its type, bracketed (`Daily Quests`). */
  name: string;
  /** Set the name as a header word, in capitals, rather than a bracketed name. */
  head?: boolean;
  icon?: ComponentChildren;
  /** One line under the name. */
  status?: ComponentChildren;
  count?: ComponentChildren;
  /** The picture of where it stands. */
  art: ComponentChildren;
  /** Spans the grid. A half-width tile left alone in its row is widened by `pair`. */
  wide?: boolean;
  /** Something can be done about it now: the frame breathes. */
  hot?: boolean;
  done?: boolean;
  /** Dimmed, as a Gate the licence does not cover. */
  shut?: boolean;
  tour?: string;
  class?: string;
  /** What a screen reader hears, if not the name. */
  label?: string;
  open: () => void;
}

/**
 * Lay tiles out so the grid never leaves a hole: a run of half-width tiles between wide ones pairs up,
 * and the last of an odd run spans the row. Returns the same tiles, in order.
 */
export function pair<T extends { wide?: boolean }>(tiles: T[]): T[] {
  let run: T[] = [];
  const close = () => { if (run.length % 2) run[run.length - 1].wide = true; run = []; };
  for (const t of tiles) {
    if (t.wide) close();
    else run.push(t);
  }
  close();
  return tiles;
}

/** A name with its hyphenated words kept whole, so a narrow tile wraps `B-Rank` onto one line, never across it. */
const whole = (name: string) => name.split(' ').flatMap((w, i) => [i ? ' ' : '', w.includes('-') ? <span class="nowrap">{w}</span> : w]);

export function BentoTile({ t }: { t: Tile }) {
  return (
    <SysFrame kind={t.kind} label={t.label ?? t.name} tour={t.tour}
      class={`btile btile--${t.key} ${t.wide ? 'is-wide' : ''} ${t.hot ? 'is-hot' : ''} ${t.done ? 'is-done' : ''} ${t.shut ? 'is-shut' : ''} ${t.class ?? ''}`}>
      <button type="button" class="btile__hit" onClick={() => { sfx.tap(); t.open(); }}>
        <span class="btile__art" aria-hidden="true">{t.art}</span>
        <span class="btile__foot">
          {t.icon && <span class="sysbox btile__icon" aria-hidden="true">{t.icon}</span>}
          <span class="btile__text">
            <strong class={t.head ? 'is-head' : ''}>{t.head ? t.name : <>[{whole(t.name)}]</>}</strong>
            {t.status != null && <small>{t.status}</small>}
          </span>
          {t.count != null && <span class="sysbox btile__count num">{t.count}</span>}
          <Glyph name="chevron" class="btile__go" />
        </span>
      </button>
    </SysFrame>
  );
}

export function BentoGrid({ tiles, class: cls, tour, label }: { tiles: Tile[]; class?: string; tour?: string; label?: string }) {
  return (
    <div class={`bento ${cls ?? ''}`} data-tour={tour} aria-label={label}>
      {pair(tiles).map((t) => <BentoTile key={t.key} t={t} />)}
    </div>
  );
}
