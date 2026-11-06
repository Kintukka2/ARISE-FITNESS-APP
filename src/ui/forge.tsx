/**
 * The Forge's pieces of screen: a material's art (an ingot in its rarity's colour, a hide, a bone, a
 * mana core, a trophy, the Ember), a material and its count, a bundle of them, and a recipe's
 * materials as held over needed, green when there is enough and red when there is not.
 */
import * as forge from '@/core/forge';
import type { Save } from '@/core/types';
import { group } from '@/core/util';
import { Glyph } from './icons';

const GLYPH: Record<string, string> = { alloy: 'ingot', part: 'hide', trophy: 'trophy', ember: 'ember' };
const PART_GLYPH: Record<string, string> = { 'part-hide': 'hide', 'part-bone': 'bone', 'part-core': 'core' };

/** A material's square: its kind's mark, an alloy in its rarity's colour. */
export function MatArt({ id, size = 40 }: { id: string; size?: number }) {
  const m = forge.materialById(id);
  const glyph = m?.kind === 'part' ? PART_GLYPH[id] ?? 'hide' : GLYPH[m?.kind ?? 'alloy'];
  return (
    <span class={`matart is-${m?.kind ?? 'alloy'} ${PART_GLYPH[id] ? `is-${PART_GLYPH[id]}` : ''}`} data-rarity={m?.rank} style={{ width: `${size}px`, height: `${size}px` }}
      title={m?.name} aria-hidden="true">
      <span class="matart__glow" />
      <Glyph name={glyph} class="matart__glyph" />
    </span>
  );
}

/** A material with how many: `Monster Bone +3` for what was gained, `Monster Bone 41` for what is held. */
export function MatChip({ id, n, gain, size = 22 }: { id: string; n: number; gain?: boolean; size?: number }) {
  const m = forge.materialById(id);
  return (
    <span class="matchip" data-rarity={m?.rank}>
      <MatArt id={id} size={size} />
      <span class="matchip__name">{m?.name ?? id}</span>
      <b class={`num ${gain ? 'grant' : ''}`}>{gain ? '+' : ''}{group(n)}</b>
    </span>
  );
}

/** Materials in the order the Forge lists them: alloys by rarity, then parts, trophies and the Ember. */
export function ordered(b: forge.Bundle): [string, number][] {
  const order = forge.allMaterials().map((m) => m.id);
  return Object.entries(b).filter(([, n]) => n > 0).sort(([a], [z]) => order.indexOf(a) - order.indexOf(z));
}

/** A bundle of materials, as chips. */
export function MatList({ b, gain }: { b: forge.Bundle; gain?: boolean }) {
  const list = ordered(b);
  if (!list.length) return null;
  return <span class="matlist">{list.map(([id, n]) => <MatChip key={id} id={id} n={n} gain={gain} />)}</span>;
}

/** A bundle in words, for a toast or a System line: `Iron Scrap +3 · Monster Hide +1`. */
export const bundleText = (b: forge.Bundle) => ordered(b).map(([id, n]) => `${forge.materialById(id)?.name ?? id} +${n}`).join(' · ');

/** A cost's materials, a tile to each, held over needed; and its Mana Shards. */
export function CostGrid({ s, c }: { s: Save; c: forge.Cost }) {
  return (
    <div class="costgrid">
      {forge.lines(s, c).map((x) => {
        const m = forge.materialById(x.id);
        const ok = x.have >= x.need;
        return (
          <span key={x.id} class={`sysbox costgrid__one ${ok ? 'is-ok' : 'is-short'}`} aria-label={`${m?.name}: ${x.have} of ${x.need}`}>
            <MatArt id={x.id} size={34} />
            <small class="costgrid__name">{m?.name}</small>
            <b class="num">{group(x.have)}<span>/{x.need}</span></b>
          </span>
        );
      })}
    </div>
  );
}
