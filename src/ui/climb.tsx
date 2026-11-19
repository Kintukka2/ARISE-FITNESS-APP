/**
 * The climb to the next rank, one bar wherever it is drawn: the Reclassification window's GOAL and the Status sheet's
 * head (the owner's call: a level bar that shows the progress, where a thin line said `Level 100 for Sovereign.`).
 * - A notch to each level, from where the rank held starts to the level the next one asks, lit as far as the hunter
 *   stands; the level under way fills by its XP.
 * - A light runs along what is lit; once the level is reached every notch is gold and the light runs the whole way.
 * - Every fifth or tenth level is marked under it, the two ranks' plates and levels at its ends.
 * - The hunter's level is pinned over the notch they are on.
 */
import { xpToNext } from '@/core/progression';
import type { Reclass } from '@/core/quests';
import { Sigil } from './icons';

export function RankClimb({ q, level, xp }: { q: Reclass; level: number; xp: number }) {
  const span = Math.max(1, q.to.min - q.from.min);
  // How far into the level now: its XP over what the level asks, until the level asked is reached.
  const into = level >= q.to.min ? 0 : Math.max(0, Math.min(1, xp / xpToNext(level)));
  const notch = (i: number) => { const at = q.from.min + i; return level > at ? 1 : level === at ? into : 0; };
  const pin = Math.min(1, (Math.min(level, q.to.min) - q.from.min + into) / span);
  // The levels marked under the notches: every fifth on a short climb, every tenth on a long one.
  const step = span > 15 ? 10 : 5;
  const marks: number[] = [];
  for (let lv = Math.ceil((q.from.min + 1) / step) * step; lv < q.to.min; lv += step) marks.push(lv);
  return (
    <div class={`rclclimb ${q.ready ? 'is-ready' : ''}`} style={`--pin: ${pin}`} role="img" aria-label={`Level ${level} of ${q.to.min}`}>
      <span class="rclclimb__notches" style={`--n: ${span}`}>
        {Array.from({ length: span }, (_, i) => {
          const f = notch(i);
          const lv = q.from.min + i + 1;
          return <i key={i} class={`${f >= 1 ? 'is-on' : f > 0 ? 'is-part' : ''} ${lv % step === 0 ? 'is-mark' : ''}`} style={`--f: ${f}; --i: ${i}`} />;
        })}
      </span>
      {!q.ready && <span class="rclclimb__pin"><b class="num">Level {level}</b></span>}
      <span class="rclclimb__ends">
        <small><Sigil rank={q.from.key} size={14} /><span class="num">{q.from.min}</span></small>
        <span class="rclclimb__marks" aria-hidden="true">
          {marks.map((lv) => <small key={lv} class="num" style={`left: ${((lv - q.from.min) / span) * 100}%`}>{lv}</small>)}
        </span>
        <small><span class="num">{q.to.min}</span><Sigil rank={q.to.key} size={14} /></small>
      </span>
    </div>
  );
}
