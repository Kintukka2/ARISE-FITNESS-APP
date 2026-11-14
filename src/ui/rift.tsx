/**
 * The Daily Rift on screen (`core/rift.ts`), in the Gates' orange: the tear it opens as, its modifiers one a
 * line with their wax seals after Slay the Spire's Daily Climb, the days walked as a row of bars kept on the
 * phone after Shattered Pixel Dungeon's local history, and the score worked out a line at a time after Dead
 * Cells' and Shattered Pixel Dungeon's.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import * as rift from '@/core/rift';
import type { RiftDay, Save } from '@/core/types';
import { dayKey, group } from '@/core/util';
import { SEALS, type SealId } from '@/data/seals';
import { SealArt } from './seals';

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

/** A Rift's modifiers, one a line: the seal, its name and its rule. */
export function ModList({ mods }: { mods: readonly SealId[] }) {
  return (
    <ul class="riftmods">
      {mods.map((id, i) => (
        <li key={id} style={`--i: ${i}`}>
          <SealArt size={26} class="is-on" />
          <span><b>{SEALS[id].name}</b><small>{SEALS[id].rule}</small></span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The days walked, a bar to each of the last `n`, today's at the right: as tall as its score against the best
 * of them, green for a clear, red for one carried out, grey walked out of, empty for a day not walked. A day
 * missed costs nothing, so it is only a gap.
 */
export function RiftHistory({ s, day = dayKey(), n = 14 }: { s: Save; day?: string; n?: number }) {
  const days = Array.from({ length: n }, (_, i) => dayKey(noon(day) - (n - 1 - i) * DAY));
  const got = days.map((d) => rift.attempt(s, d));
  const top = Math.max(1, ...got.map((x) => x?.score ?? 0));
  const walked = got.filter(Boolean).length;
  return (
    <figure class="rifthist" style={`--n: ${n}`} aria-label={`${walked} of the last ${n} days walked`}>
      <ol class="rifthist__bars">
        {days.map((d, i) => {
          const x = got[i];
          const h = x ? Math.max(0.06, x.score / top) : 0;
          return (
            <li key={d} class={`${x ? `is-${x.outcome}` : 'is-none'} ${d === day ? 'is-today' : ''}`} style={`--h: ${h}; --i: ${i}`}
              aria-label={x ? `${riftDate(d)}: ${OUTCOME[x.outcome]}, ${group(x.score)}` : `${riftDate(d)}: not walked`}>
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** A line of the score, as the results write it. */
export function scoreLabel(x: rift.ScoreLine): string {
  switch (x.key) {
    case 'fight': return plural(x.n, 'fight won', 'fights won');
    case 'keeper': return 'Gatekeeper defeated';
    case 'boss': return 'Boss defeated';
    case 'feat': return plural(x.n, 'Feat met', 'Feats met');
    case 'pace': return plural(x.n, 'round under par', 'rounds under par');
    case 'health': return `HP left: ${x.n}%`;
  }
}

/** The run's score on its results: each line and its points, then the total counted up, and the best. */
export function RiftScore({ r }: { r: rift.RiftResult }) {
  const total = useCount(r.total);
  return (
    <section class={`rsec rscore ${r.newBest ? 'is-best' : ''}`} aria-label={`Rift score: ${group(r.total)}`}>
      <header class="exsec__head">
        <span class="label">Rift Score</span><i aria-hidden="true" />
        {r.newBest ? <small class="rscore__new">New best</small> : <small>Best <b class="num">{group(r.best)}</b></small>}
      </header>
      <ul class="rscore__lines">
        {r.lines.map((x, i) => (
          <li key={x.key} class={x.pts ? '' : 'is-none'} style={`--i: ${i}`}>
            <span>{scoreLabel(x)}</span><b class="num">{x.pts ? `+${group(x.pts)}` : '0'}</b>
          </li>
        ))}
      </ul>
      <div class="rscore__total"><span class="label">Total</span><b class="num">{group(Math.round(total))}</b></div>
    </section>
  );
}
