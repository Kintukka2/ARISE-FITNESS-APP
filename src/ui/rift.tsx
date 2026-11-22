/**
 * The Daily Rift on screen (`core/rift.ts`), in the Gates' orange: the tear it opens as; its modifiers a row
 * to each, each seal embossed with its own sign (`ui/seals.tsx`); the days played as a row of bars kept on the
 * phone, after Shattered Pixel Dungeon's local history; and its results, after Solo Leveling: Arise's
 * `Rank SSS`, Helldivers 2's mission summary and Isaac's score sheet: a rating stamped beside the score, and the
 * score worked out a row at a time, each row its mark, its count and its points.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as rift from '@/core/rift';
import type { Dungeon, Rank, RiftDay, Save } from '@/core/types';
import { dayKey, group } from '@/core/util';
import { EMBER } from '@/data/forge';
import { RIFT_NAME } from '@/data/rift';
import type { SealId } from '@/data/seals';
import { MatArt } from './forge';
import { Glyph } from './icons';
import { SealArt } from './seals';
import { Facts } from './components';

const DAY = 864e5;
const noon = (day: string) => Date.parse(`${day}T12:00:00`);

/** A day as the Rift names it: `Sat 14 Nov`. */
export const riftDate = (day: string) => new Date(noon(day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** How a day's Rift ended, in a word. */
export const OUTCOME: Record<RiftDay['outcome'], string> = { cleared: 'Cleared', defeated: 'Carried out', withdrawn: 'Withdrawn', open: 'Underway' };

/** The Rift as it opens: a tear of light down the middle of a ring, flickering. */
export function RiftTear({ size = 56 }: { size?: number }) {
  return (
    <span class="rifttear" style={`--s: ${size}px`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <ellipse class="rifttear__halo" cx="24" cy="24" rx="15" ry="21" />
        <ellipse class="rifttear__ring" cx="24" cy="24" rx="12.5" ry="19" />
        <path class="rifttear__glow" d="M26.5 6.5 19.5 21h5.5l-4.5 15.5 9-17h-5.6l4.8-13z" />
        <path class="rifttear__core" d="M26.5 6.5 19.5 21h5.5l-4.5 15.5 9-17h-5.6l4.8-13z" />
        <circle class="rifttear__mote" cx="15" cy="31" r="0.9" />
        <circle class="rifttear__mote is-b" cx="33" cy="16" r="0.7" />
        <circle class="rifttear__mote is-c" cx="31" cy="34" r="0.6" />
      </svg>
    </span>
  );
}

/** A rating stamped in its grade's colour: the letter in a cut plate. */
export function RatingMark({ rating, size = 72, stamp = false }: { rating: Rank; size?: number; stamp?: boolean }) {
  return (
    <span class={`ratingmark ${stamp ? 'is-stamp' : ''}`} style={`--rr: var(--rank-${rating}); --s: ${size}px`} role="img" aria-label={`Rating ${rating}`}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <path class="ratingmark__plate" d="M14 3h20l11 11v20L34 45H14L3 34V14z" />
        <path class="ratingmark__inner" d="M16 8h16l8 8v16l-8 8H16l-8-8V16z" />
      </svg>
      <b>{rating}</b>
    </span>
  );
}

/**
 * The days played, a bar to each of the last `n`, today's at the right: as tall as its score against the best
 * of them, in its rating's colour where it earned one, else red for one carried out, grey walked out of, a dashed gap for a day not played; a
 * fortnight's bars carry their rating over them. A day missed costs nothing, so it is only a gap.
 */
export function RiftHistory({ s, day = dayKey(), n = 14 }: { s: Save; day?: string; n?: number }) {
  const days = Array.from({ length: n }, (_, i) => dayKey(noon(day) - (n - 1 - i) * DAY));
  const got = days.map((d) => rift.attempt(s, d));
  const top = Math.max(1, ...got.map((x) => x?.score ?? 0));
  const played = got.filter(Boolean).length;
  return (
    <figure class="rifthist" style={`--n: ${n}`} aria-label={`${played} of the last ${n} days played`}>
      <ol class="rifthist__bars">
        {days.map((d, i) => {
          const x = got[i];
          const h = x ? Math.max(0.06, x.score / top) : 0;
          return (
            <li key={d} class={`${x ? `is-${x.outcome}` : 'is-none'} ${x?.rating ? 'is-rated' : ''} ${d === day ? 'is-today' : ''}`}
              style={`--h: ${h}; --i: ${i}${x?.rating ? `; --rr: var(--rank-${x.rating})` : ''}`}
              aria-label={x ? `${riftDate(d)}: ${OUTCOME[x.outcome]}, ${group(x.score)}${x.rating ? `, rating ${x.rating}` : ''}` : `${riftDate(d)}: not played`}>
              {n <= 14 && <em>{x?.rating ?? ''}</em>}
              <i />
              {/* A fortnight is numbered day by day; a month only every seventh day back from today. */}
              <small class="num">{n <= 14 || (n - 1 - i) % 7 === 0 ? Number(d.slice(8)) : ''}</small>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** A figure counted up from nothing once it shows, after a pause. */
function useCount(to: number, ms = 900, wait = 350): number {
  const [v, setV] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + wait;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(to * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
      else done.current = true;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

/** Each line of the score: its mark, its name, and how its count is written. */
const LINE: Record<rift.ScoreKey, { glyph: string; name: string; count?: (n: number) => string }> = {
  fight: { glyph: 'crossed', name: 'Fights won', count: (n) => `×${n}` },
  keeper: { glyph: 'roomKeeper', name: 'Gatekeeper defeated' },
  boss: { glyph: 'roomBoss', name: 'Boss defeated' },
  feat: { glyph: 'star', name: 'Feats met', count: (n) => `×${n}` },
  pace: { glyph: 'timer', name: 'Rounds under par', count: (n) => `×${n}` },
  health: { glyph: 'heart', name: 'HP left', count: (n) => `${n}%` },
};

/**
 * A Rift's results, in place of a Gate's head: the title card over the tear, the Gate and the modifiers'
 * seals; the rating stamped beside the score, counted up, with a new best in gold; a row to each part of the
 * score, its mark, its name, its count and its points, landing one after another; and what the run paid. A
 * Gate with no Gatekeeper has no row for one.
 */
export function RiftResults({ d, r, title, line, xp, shards, ember, mods }: {
  d: Dungeon; r: rift.RiftResult; title: string; line: string | null; xp: number; shards: ComponentChildren; ember: number; mods: readonly SealId[];
}) {
  const rows = r.lines.filter((x) => x.key !== 'keeper' || !!d.elite);
  const total = useCount(r.total, 900, 300 + rows.length * 120);
  const rating = r.rating ?? 'E';
  return (
    <section class={`riftres ${r.newBest ? 'is-best' : ''}`} style={`--rr: var(--rank-${rating})`}>
      <header class="riftres__title">
        <span class="riftres__tear" aria-hidden="true"><RiftTear size={96} /></span>
        <small class="label"><Facts items={[RIFT_NAME, riftDate(rift.riftDay(d))]} /></small>
        <h2>{title}</h2>
        <i class="rhead__rule" aria-hidden="true" />
        <span class="riftres__gate">
          <b>{d.name.replace(`${RIFT_NAME}: `, '')}</b>
          {mods.map((id) => <SealArt key={id} id={id} size={20} class="is-on" />)}
        </span>
        {line && <p class="muted">{line}</p>}
      </header>
      <div class="riftres__hero">
        <RatingMark rating={rating} size={88} stamp />
        <span class="riftres__score">
          <small>Score</small>
          <b class="num">{group(Math.round(total))}</b>
          {r.newBest ? <i class="riftres__new">New best</i> : <i>Best <b class="num">{group(r.best)}</b></i>}
        </span>
      </div>
      <ol class="riftres__lines" aria-label="Score">
        {rows.map((x, i) => {
          const L = LINE[x.key];
          return (
            <li key={x.key} class={x.pts ? '' : 'is-none'} style={`--i: ${i}`}>
              <span class="riftres__mark"><Glyph name={L.glyph} /></span>
              <span class="riftres__name">{L.name}</span>
              <span class="riftres__count num">{x.pts && L.count ? L.count(x.n) : ''}</span>
              <b class="num">{x.pts ? `+${group(x.pts)}` : '0'}</b>
            </li>
          );
        })}
      </ol>
      <div class="rpay riftres__pay">
        <div class="rpay__one"><small>XP</small><b class="num grant">+{group(xp)}</b></div>
        <div class="rpay__one"><small>Shards</small><b>{shards}</b></div>
        {ember > 0 && <div class="rpay__one"><small>Ember</small><b class="num riftres__ember"><MatArt id={EMBER.id} size={22} />+{group(ember)}</b></div>}
      </div>
    </section>
  );
}
