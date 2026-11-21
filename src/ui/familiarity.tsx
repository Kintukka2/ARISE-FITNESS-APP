/**
 * A weapon's Familiarity on its card, set out as Destiny 2's crafted weapons set their Weapon Level and Call of Duty
 * its weapon levels (the owner's call, where a dial, a bar, `2/5`, `Rank 2` and `110 to Rank 3` all said the same):
 * the rank said once, large, and one track under it, a segment to each rank, lit gold to the rank reached and the
 * rank in progress filling its own segment, the points at the track's right. Under it what the rank gives as it
 * stands, in plain words and as a total, never the next rank's figure beside it: `Attack and magic` `+4%`, and
 * `Forged copies` `16% quality or better`. The rank is a told word: a tap opens the one tooltip on how Familiarity
 * is earned and what each rank adds, its figures read from `FAMILIARITY`. At the last rank, `Mastered`.
 */
import * as forge from '@/core/forge';
import { group } from '@/core/util';
import { useSave } from '@/store';
import { Glyph } from './icons';
import { InfoTag } from './infotag';

const pct = (k: number) => Math.round(k * 100);

/** What Familiarity is, for its tooltip: how a point is earned, and what a rank adds. */
const famTip = () => ({
  title: 'Familiarity',
  kind: 'Weapon',
  tone: 'system' as const,
  mark: <Glyph name="up" />,
  lines: [
    'Each creature defeated while you carry this weapon is a point toward knowing its design.',
    `Each rank adds ${pct(forge.FAMILIARITY.bonus)}% to attack and magic while it is worn, and raises the least quality a copy forged from its blueprint can roll by ${pct(forge.FAMILIARITY.floor)}%.`,
  ],
});

/** A weapon design's familiarity: its rank, one track to the last rank, and what the rank gives. */
export function Familiarity({ defId }: { defId: string }) {
  const s = useSave();
  const f = forge.familiarity(s, defId);
  const share = f.next ? (f.points - f.from) / Math.max(1, f.next - f.from) : 1;
  const max = f.next === null;
  const boons = [
    { name: 'Attack and magic', value: `+${pct(forge.FAMILIARITY.bonus * f.rank)}%` },
    { name: 'Forged copies', value: `${pct(forge.FAMILIARITY.floor * f.rank)}% quality or better` },
  ];
  return (
    <section class={`sysbox famcard ${max ? 'is-max' : ''} ${f.rank ? '' : 'is-none'}`} aria-label={`Familiarity: rank ${f.rank} of ${forge.FAMILIARITY_MAX}`}>
      <span class="famcard__head">
        <InfoTag class="famcard__rank" tip={famTip()}>Rank <b class="num">{f.rank}</b></InfoTag>
        {max ? <span class="famcard__max">Mastered</span> : <small class="num famcard__pts">{group(f.points)}/{group(f.next!)}</small>}
      </span>
      <span class="famtrack" aria-hidden="true">
        {Array.from({ length: forge.FAMILIARITY_MAX }, (_, i) => (
          <i key={i} class={i < f.rank ? 'is-on' : i === f.rank ? 'is-now' : ''} style={i < f.rank ? `--k: ${i}` : i === f.rank ? `--f: ${Math.round(share * 100)}%` : undefined} />
        ))}
      </span>
      <dl class="famcard__boons">
        {boons.map((b) => (
          <div key={b.name}>
            <dt>{b.name}</dt>
            <dd class="num">{b.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
