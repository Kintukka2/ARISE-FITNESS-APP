/**
 * A weapon's Familiarity on its card, rebuilt at the owner's call (pips, a bar and a line of facts read as clutter):
 * a dial after the mastery rings of Destiny's weapon crafting and Monster Hunter's weapon tree, a segment to each rank
 * round its rim lit gold to the rank reached, the rank in progress filling its own segment, and the rank large at its
 * heart over `/5`. Beside it the points to the next rank, then what the rank gives, each with what the next adds in
 * gold: `Attack and magic +4%` with `▲ +6%`, `Forged quality from 16%` with `▲ 24%`. At the last rank, `Mastered`.
 */
import * as forge from '@/core/forge';
import { group } from '@/core/util';
import { useSave } from '@/store';

const R = 34;
const C = 42;
const GAP = 7; // degrees between segments
/** An arc of the dial from `a` to `b` degrees, 0 at the top, clockwise. */
function arc(a: number, b: number, r = R) {
  const p = (d: number) => [C + r * Math.sin((d * Math.PI) / 180), C - r * Math.cos((d * Math.PI) / 180)];
  const [x0, y0] = p(a);
  const [x1, y1] = p(b);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** The dial: a segment to each rank, the reached lit, the one in progress filled to its share. */
function Dial({ rank, share }: { rank: number; share: number }) {
  const n = forge.FAMILIARITY_MAX;
  const span = 360 / n;
  return (
    <span class="famdial" aria-hidden="true">
      <svg viewBox="0 0 84 84">
        <circle class="famdial__face" cx={C} cy={C} r={R - 7} />
        {Array.from({ length: n }, (_, i) => {
          const a = i * span + GAP / 2;
          const b = (i + 1) * span - GAP / 2;
          const lit = i < rank;
          const now = i === rank;
          return (
            <g key={i}>
              <path class="famdial__seg" d={arc(a, b)} />
              {lit && <path class="famdial__seg is-on" d={arc(a, b)} style={`--k: ${i}`} />}
              {now && share > 0.01 && <path class="famdial__seg is-part" d={arc(a, a + (b - a) * share)} />}
            </g>
          );
        })}
        {Array.from({ length: 24 }, (_, i) => {
          const d = (i * 15 * Math.PI) / 180;
          return <line key={i} class="famdial__tick" x1={C + (R - 11) * Math.sin(d)} y1={C - (R - 11) * Math.cos(d)} x2={C + (R - 13) * Math.sin(d)} y2={C - (R - 13) * Math.cos(d)} />;
        })}
      </svg>
      <span class="famdial__n"><b class="num">{rank}</b><small class="num">/{n}</small></span>
    </span>
  );
}

/** A weapon design's familiarity: its dial, the points to the next rank, and what this rank and the next give. */
export function Familiarity({ defId }: { defId: string }) {
  const s = useSave();
  const f = forge.familiarity(s, defId);
  const share = f.next ? (f.points - f.from) / Math.max(1, f.next - f.from) : 1;
  const pct = (k: number) => Math.round(k * 100);
  const max = f.next === null;
  const boons = [
    { name: 'Attack and magic', now: `+${pct(forge.FAMILIARITY.bonus * f.rank)}%`, next: `+${pct(forge.FAMILIARITY.bonus * (f.rank + 1))}%` },
    { name: 'Forged quality from', now: `${pct(forge.FAMILIARITY.floor * f.rank)}%`, next: `${pct(forge.FAMILIARITY.floor * (f.rank + 1))}%` },
  ];
  return (
    <section class={`sysbox famcard ${max ? 'is-max' : ''}`} aria-label={`Familiarity ${f.rank} of ${forge.FAMILIARITY_MAX}`}>
      <Dial rank={f.rank} share={max ? 0 : share} />
      <div class="famcard__body">
        <span class="famcard__head">
          <b class="famcard__rank">Rank <span class="num">{f.rank}</span></b>
          {max ? <span class="famcard__max">Mastered</span> : <small class="num famcard__pts">{group(f.points)}/{group(f.next!)}</small>}
        </span>
        {!max && <i class="famcard__bar" aria-hidden="true"><i style={`width: ${Math.round(share * 100)}%`} /></i>}
        {!max && <small class="famcard__to"><span class="num">{group(f.next! - f.points)}</span> to Rank {f.rank + 1}</small>}
      </div>
      <ul class="famcard__boons">
        {boons.map((b) => (
          <li key={b.name}>
            <span>{b.name}</span>
            <span><b class="num">{b.now}</b>{!max && <small class="num famcard__next" aria-label={`Rank ${f.rank + 1}: ${b.next}`}>▲ {b.next}</small>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
