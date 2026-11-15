/**
 * Par on screen (`core/par.ts`), the System's, in the Gates' orange with each medal in its metal: a medal struck
 * with the hourglass of rounds; the brief's Par card, after Honkai: Star Rail's star conditions and Rogue Legacy 2's
 * Scars, the road's par large and the three medals beside the rounds each allows, what each pays the first time and
 * how often the System reached it today; the results' card, after Advance Wars' rank screen and a golf scorecard,
 * the rounds against the par, the difference, and the medal struck; and the medal held on a Gate's row of the board.
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
 * The brief's Par card: the par of today's road large, the rounds the System's middle clear took beside it; then
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
      <div class="bpar__top">
        <span class="bpar__par"><b class="num">{road}</b><small>rounds</small></span>
        <span class="bpar__sys"><small>System</small><b class="num">{rounds ?? '-'}</b></span>
      </div>
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
 * The results' Par card, as a scorecard: the rounds the clear took against the par of the fights it won, the
 * difference (under par in green, over in red), the medal struck large, or none; the three medals, those the
 * Gate now holds lit and those reached here for the first time marked New; and the Ember they paid.
 */
export function ParResult({ r }: { r: NonNullable<RaidResult['par']> }) {
  const diff = r.rounds - r.par;
  return (
    <section class={`rsec rpar ${r.medal ? `is-${r.medal}` : 'is-none'}`} aria-label="Par">
      <header class="exsec__head"><span class="label">Par</span><i aria-hidden="true" /></header>
      <div class="rpar__card">
        <span class={`rpar__strike ${r.medal ? '' : 'is-none'}`}>
          {r.medal ? <Medal id={r.medal} size={68} /> : <Medal id="bronze" size={68} on={false} />}
          <b>{r.medal ? NAME[r.medal] : 'No medal'}</b>
        </span>
        <span class="rpar__score">
          <span class="rpar__cell"><small>Rounds</small><b class="num">{r.rounds}</b></span>
          <span class="rpar__cell"><small>Par</small><b class="num">{r.par}</b></span>
          <span class={`rpar__cell rpar__diff ${diff <= 0 ? 'is-under' : 'is-over'}`}><small>{diff < 0 ? 'Under' : diff > 0 ? 'Over' : 'Level'}</small><b class="num">{diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '0'}</b></span>
        </span>
      </div>
      <ol class="rpar__track" aria-label="Medals earned">
        {UP.map((m) => {
          const fresh = r.fresh.includes(m);
          return (
            <li key={m} class={`${par.reaches(r.best, m) ? 'is-held' : ''} ${fresh ? 'is-fresh' : ''}`}>
              <Medal id={m} size={26} on={par.reaches(r.best, m)} />
              <small>{NAME[m]}</small>
              {fresh && <i class="rpar__new">New</i>}
            </li>
          );
        })}
      </ol>
      {r.ember > 0 && <p class="rpar__paid"><span>First time</span><b class="num"><MatArt id={EMBER.id} size={16} />+{group(r.ember)}</b></p>}
    </section>
  );
}
