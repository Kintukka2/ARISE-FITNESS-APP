/**
 * Par on screen (`core/par.ts`), the System's, in the Gates' orange with each medal in its metal: a medal struck
 * with the hourglass of rounds; the brief's Par card, after Honkai: Star Rail's star conditions and Rogue Legacy 2's
 * Scars, the road's par large and the three medals beside the rounds each allows, what each pays the first time and
 * how often the System reached it today; and the medal held on a Gate's row of the board. The results' Challenges
 * strike it beside the rounds against the par (`ui/challenges.tsx`).
 */
import { useId, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { Tip, tipAt, tipSaid, type TipAt, type TipText } from './tip';
import * as par from '@/core/par';
import type { Dungeon } from '@/core/types';
import { EMBER } from '@/data/forge';
import { MEDAL_PAY, MEDALS, PAR_EMBER, type MedalId } from '@/data/par';
import { MatArt } from './forge';
import { glyphPath } from './icons';

/** The medals worst first, as they are reached. */
const UP: MedalId[] = ['bronze', 'silver', 'gold'];
export const NAME: Record<MedalId, string> = Object.fromEntries(MEDALS.map((x) => [x.id, x.name])) as Record<MedalId, string>;

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
 * unearned: its outline dashed, no metal. `shine` sends a glint across a medal earned, every few seconds, as the
 * results' Challenges strike it.
 */
export function Medal({ id, size = 24, on = true, shine, class: cls }: { id: MedalId; size?: number; on?: boolean; shine?: boolean; class?: string }) {
  const mark = glyphPath('timer');
  const clip = `medal-${useId()}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`medal is-${id} ${on ? 'is-on' : 'is-off'} ${cls ?? ''}`} role="img" aria-label={`${NAME[id]}${on ? '' : ', not reached'}`}>
      <path class="medal__rim" d={RIM} />
      <circle class="medal__face" cx="12" cy="12" r="8.4" />
      <circle class="medal__ring" cx="12" cy="12" r="7.1" />
      {mark && <path class="medal__mark" d={mark} transform="translate(7.2 7.2) scale(0.4)" />}
      {shine && on && <>
        <clipPath id={clip}><path d={RIM} /></clipPath>
        <g clip-path={`url(#${clip})`}><rect class="shine" x="-6" y="-6" width="5" height="36" /></g>
      </>}
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
 * The brief's `Gate Clear Par` card (the owner's call, where it read `Par`, and where it gave how the System fared: the
 * hunter does not need to know it):
 * - the par of today's road and the hunter's own best clear of this Gate, in rounds, side by side;
 * - a row to each medal, worst first, its medal lit once held here, the rounds it allows, and the Ember it pays the
 *   first time, or that it is earned;
 * - once all three are earned, one row in their place (`ParDone`): the three medals shining in a light that crosses
 *   it, `All medals earned` and the best, and a tap tells what each medal asked.
 */
export function ParCard({ d, best, road, mine }: { d: Dungeon; best: MedalId | null; road: number; mine: number | null }) {
  const marks = par.marks(road);
  return (
    <section class="bbox bpar" aria-label="Gate Clear Par">
      <span class="label bbox__head">Gate Clear Par<small class="bbox__right bpar__held">{UP.map((m) => <Medal key={m} id={m} size={14} on={par.reaches(best, m)} />)}</small></span>
      {best === 'gold'
        ? <ParDone road={road} mine={mine} marks={marks} />
        : <>
          <dl class="bpar__facts">
            <div><dt>Par today</dt><dd><b class="num">{road}</b><small>rounds</small></dd></div>
            <div><dt>Personal best</dt><dd><b class="num">{mine ?? '-- --'}</b>{mine !== null && <small>rounds</small>}</dd></div>
          </dl>
          <ol class="bpar__rows">
            {UP.map((m, i) => {
              const held = par.reaches(best, m);
              return (
                <li key={m} class={`bpar__row is-${m} ${held ? 'is-held' : ''}`} style={`--i: ${i}`}>
                  <Medal id={m} size={30} on={held} />
                  <span class="bpar__body">
                    <b>{NAME[m]}</b>
                    <small class="num">Within {marks.find((x) => x.id === m)!.rounds} rounds</small>
                  </span>
                  <span class="bpar__side">
                    {held ? <small class="bpar__got">Earned</small> : <small class="bpar__pay"><MatArt id={EMBER.id} size={14} /><span class="num">+{payOf(d, m)}</span></small>}
                  </span>
                </li>
              );
            })}
          </ol>
          <small class="bpar__note">A fight won off the road adds its own par.</small>
        </>}
    </section>
  );
}

/** Every medal earned on this Gate: one row, the three medals shining, the best beside them; a tap tells what each asked. */
function ParDone({ road, mine, marks }: { road: number; mine: number | null; marks: ReturnType<typeof par.marks> }) {
  const [at, setAt] = useState<TipAt | null>(null);
  const within = (m: MedalId) => marks.find((x) => x.id === m)!.rounds;
  const tip: TipText = {
    title: 'Gate Clear Par', kind: 'Par', tone: 'gate',
    mark: <span class="tip__mark"><Medal id="gold" size={16} /></span>,
    lines: [
      `Par today: ${road} rounds. Bronze within ${within('bronze')} rounds, Silver within ${within('silver')}, Gold within ${within('gold')}.`,
      ...(mine !== null ? [`Your best clear: ${mine} rounds.`] : []),
    ],
  };
  return (
    <>
      <button type="button" class={`bdone bdone--par ${at ? 'is-open' : ''}`} aria-haspopup="dialog" aria-expanded={!!at} aria-label={tipSaid(tip)}
        onClick={(e) => { sfx.blip(); setAt(at ? null : tipAt(e.currentTarget as Element)); }}>
        <span class="bdone__marks">{UP.map((m) => <Medal key={m} id={m} size={30} on shine />)}</span>
        <span class="bdone__text"><b>All medals earned</b>{mine !== null && <small class="num">Best: {mine} rounds</small>}</span>
      </button>
      {at && <Tip tip={tip} at={at} close={() => setAt(null)} />}
    </>
  );
}
