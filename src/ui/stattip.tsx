/**
 * A stat in the game's one tooltip (`ui/tip.tsx`), the same wherever a stat is tapped: the Status sheet's rows, the
 * Stats sheet's table and an Association hunter's card (the owner's call: one tooltip for the three, where the Status
 * sheet opened a window). Its mark and name, `Stat` at the right, what it does; then, where the numbers are the
 * hunter's own, where theirs stands and how far it can go; on a hunter's card, whether it is their best; on a Shadow's
 * card, its creature's own figure and what its growth has made of it, in the Shadows' violet.
 */
import { ATTRS, BOOST_CAP, STAT_CAP } from '@/core/progression';
import type { Stat } from '@/core/types';
import { Glyph, STAT_ICON } from './icons';
import type { TipText } from './tip';

export interface StatFacts {
  /** The hunter's own figure, from Ability Points, and with class, skills and gear. */
  base?: number;
  total?: number;
  /** Whether to say how far Ability Points, and class and gear, can take it. */
  limits?: boolean;
  /** An Association hunter's best stat, the one their class leads with. */
  best?: boolean;
  /** A Shadow's: its creature's own figure, what its level and stars have grown it to, and whether it is its best. */
  shadow?: { own: number; now: number; best: boolean };
}

export function statTip(k: Stat, f: StatFacts = {}): TipText {
  const a = ATTRS.find((x) => x.key === k)!;
  const lines = [a.desc];
  if (f.base !== undefined) {
    const total = Math.round(f.total ?? f.base);
    lines.push(total !== f.base ? `Base ${f.base}, ${total} with class, skills and gear.` : `Base ${f.base}.`);
  }
  if (f.limits) lines.push(`Ability Points take it to ${STAT_CAP}, and class, skills and gear to ${BOOST_CAP}.`);
  if (f.best) lines.push('Their best stat, the one their class leads with.');
  if (f.shadow) {
    lines.push(f.shadow.now > f.shadow.own ? `Its creature's own ${f.shadow.own}, grown to ${f.shadow.now}.` : `Its creature's own ${f.shadow.own}.`);
    if (f.shadow.best) lines.push('Its best stat.');
  }
  return { title: a.name, kind: 'Stat', mark: <span class="tip__mark"><Glyph name={STAT_ICON[k] ?? 'star'} /></span>, lines, tone: f.shadow ? 'shadow' : 'system' };
}
