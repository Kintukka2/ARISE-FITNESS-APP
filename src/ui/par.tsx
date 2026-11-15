/**
 * Par on screen (`core/par.ts`), the System's, in the Gates' orange with each medal in its metal: a medal struck
 * with the hourglass of rounds; the brief's Par card, after Honkai: Star Rail's star conditions and Rogue Legacy 2's
 * Scars, the road's par large and the three medals beside the rounds each allows, what each pays the first time and
 * how often the System reached it today; the first row of the results' Challenges, the medal struck beside the
 * rounds against the par; and the medal held on a Gate's row of the board.
 */
import { group } from '@/core/util';
import * as par from '@/core/par';
import type { RaidResult } from '@/core/raid';
import type { Dungeon } from '@/core/types';
import { EMBER } from '@/data/forge';
import { MEDAL_PAY, MEDALS, PAR_EMBER, type MedalId } from '@/data/par';
import { MatArt } from './forge';
import { glyphPath } from './icons';

/** The medals worst first, as they are reached. */
const UP: MedalId[] = ['bronze', 'silver', 'gold'];
const NAME: Record<MedalId, string> = Object.fromEntries(MEDALS.map((x) => [x.id, x.name])) as Record<MedalId, string>;

/** The rim of a medal: a disc milled at its edge, twenty-four teeth. */
const RIM = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 10.4 : 11.2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}z`;
})();

/**
 * A medal: a milled disc in its metal, a ring inside, the hourglass of rounds at its heart. `on` false draws it
 * unearned: its outline dashed, no metal.
 */
export function Medal({ id, size = 24, on = true, class: cls }: { id: MedalId; size?: number; on?: boolean; class?: string }) {
  const mark = glyphPath('timer');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`medal is-${id} ${on ? 'is-on' : 'is-off'} ${cls ?? ''}`} role="img" aria-label={`${NAME[id]}${on ? '' : ', not reached'}`}>
      <path class="medal__rim" d={RIM} />
      <circle class="medal__face" cx="12" cy="12" r="8.4" />
      <circle class="medal__ring" cx="12" cy="12" r="7.1" />
      {mark && <path class="medal__mark" d={mark} transform="translate(7.2 7.2) scale(0.4)" />}
    </svg>
  );
}

/** The medal a Gate holds, for its row on the board: its best, or an unearned one dashed. */
export function MedalHeld({ best, size = 16 }: { best: MedalId | null; size?: number }) {
  return (
    <span class={`gtag is-par ${best ? `is-${best}` : ''}`} aria-label={best ? `Par: ${NAME[best]} earned` : 'Par: no medal yet'}>
      <Medal id={best ?? 'bronze'} size={size} on={!!best} />
    </span>
  );
}

/** A medal's Ember the first time it is reached on a Gate of this grade. */
const payOf = (d: Dungeon, m: MedalId) => (PAR_EMBER[d.rank as keyof typeof PAR_EMBER] ?? 0) * MEDAL_PAY[m];

/**
 * The brief's Par card: the par of today's road and the rounds the System's middle clear took, two facts side by
 * side as the brief's head sets its own; then
 * a row to each medal, worst first, its medal lit once held here, the rounds it allows, how often the System
 * reached it in its runs, and the Ember it pays the first time, or that it is earned.
 */
export function ParCard({ d, best, road, rounds, medals, runs }: {
  d: Dungeon; best: MedalId | null; road: number; rounds: number | null; medals: Record<MedalId, number>; runs: number;
}) {
  const marks = par.marks(road);
  return (
    <section class="bbox bpar" aria-label="Par">
      <span class="label bbox__head">Par<small class="bbox__right bpar__held">{UP.map((m) => <Medal key={m} id={m} size={14} on={par.reaches(best, m)} />)}</small></span>
      <dl class="bpar__facts">
        <div><dt>Par today</dt><dd><b class="num">{road}</b><small>rounds</small></dd></div>
        <div><dt>The System</dt><dd><b class="num">{rounds ?? '-'}</b><small>rounds</small></dd></div>
      </dl>
      <ol class="bpar__rows">
        {UP.map((m, i) => {
          const held = par.reaches(best, m);
          const n = medals[m] ?? 0;
          return (
            <li key={m} class={`bpar__row is-${m} ${held ? 'is-held' : ''}`} style={`--i: ${i}; --odds: ${runs ? n / runs : 0}`}>
              <Medal id={m} size={30} on={held} />
              <span class="bpar__body">
                <b>{NAME[m]}</b>
                <small class="num">Within {marks.find((x) => x.id === m)!.rounds} rounds</small>
                <span class="bpar__odds" aria-hidden="true"><i /></span>
              </span>
              <span class="bpar__side">
                <small class="num" aria-label={`The System reached it in ${n} of ${runs} runs`}>System {n}/{runs}</small>
                {held ? <small class="bpar__got">Earned</small> : <small class="bpar__pay"><MatArt id={EMBER.id} size={14} /><span class="num">+{payOf(d, m)}</span></small>}
              </span>
            </li>
          );
        })}
      </ol>
      <small class="bpar__note">A fight won off the road adds its own par.</small>
    </section>
  );
}

/**
 * The clear against its par, as the first row of the results' Challenges: the medal struck, its name, the rounds
 * against the par and the difference (under in green, over in red); at its right, `New` and the Ember it paid the
 * first time, or the best the Gate holds.
 */
export function ParRow({ r }: { r: NonNullable<RaidResult['par']> }) {
  const diff = r.rounds - r.par;
  const fresh = r.fresh.length > 0;
  return (
    <li class={`rchal__row rchal__par ${r.medal ? `is-met is-${r.medal}` : 'is-missed'}`}>
      <span class="rchal__mark rchal__medal"><Medal id={r.medal ?? 'bronze'} size={40} on={!!r.medal} /></span>
      <span class="rchal__body">
        <b>{r.medal ? `${NAME[r.medal]} medal` : 'No medal'}</b>
        <small class="num">
          {r.rounds} rounds · par {r.par} · <span class={diff <= 0 ? 'rchal__under' : 'rchal__over'}>{diff < 0 ? `${-diff} under` : diff > 0 ? `${diff} over` : 'level'}</span>
        </small>
      </span>
      <span class="rchal__side">
        {fresh
          ? <><i class="rnew">New</i><small class="rchal__ember"><MatArt id={EMBER.id} size={14} /><span class="num">+{group(r.ember)}</span></small></>
          : <small class="muted">{r.best ? `Best: ${NAME[r.best]}` : 'Par'}</small>}
      </span>
    </li>
  );
}
