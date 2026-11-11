/**
 * Blessings as the arena shows them: a card to each one a shrine or a Font offers, after the boon cards
 * of the reference games (its Path's mark at its left, its name over what it does, its tier in pips),
 * and a chip to each one the run holds. What a blessing does is read from `data/blessings.ts`.
 */
import { boonById, TIERS } from '@/data/blessings';
import { pathOf } from '@/data/tree';
import { describe } from '@/core/blessings';
import { Glyph, STAT_ICON } from './icons';
import { Keyed } from './keyed';

/** A blessing's Paths by name: `Ruin`, or a Duo's `Ruin + Tempest`. */
export const pathsOf = (id: string) => (boonById(id)?.paths ?? []).map((k) => pathOf(k)?.name ?? k).join(' + ');

/** What kind of blessing it is, as its card's small line says it: `Ruin`, `Duo · Ruin + Tempest`, `Capstone · Ruin`. */
function kindLine(id: string): string {
  const b = boonById(id);
  if (!b) return '';
  return b.kind === 'duo' ? `Duo · ${pathsOf(id)}` : b.kind === 'capstone' ? `Capstone · ${pathsOf(id)}` : pathsOf(id);
}

/**
 * What a Font's raise does, as the reference games show an upgrade: the number that moves, old then new
 * (`Strike inflicts Bleeding for 3 → 4 turns.`).
 */
export function raiseText(id: string, from: number, to: number): string {
  // A figure whole, its sign and its percent with it: `+40%` becomes `+40% → +55%`.
  const cut = (t: string) => t.split(/([+-]?\d+%?)/);
  const was = cut(describe(id, from).text);
  const now = cut(describe(id, to).text);
  const i = now.findIndex((x, k) => /\d/.test(x) && x !== was[k]);
  return i >= 0 && was.length === now.length ? [...now.slice(0, i), `${was[i]} → ${now[i]}`, ...now.slice(i + 1)].join('') : describe(id, to).text;
}

/** Its tier in pips, filled to the tier: gold, advancement's. */
export function TierPips({ tier, from }: { tier: number; from?: number }) {
  return (
    <span class="tierpips" aria-label={`Tier ${TIERS[tier - 1]}`}>
      {TIERS.map((t, i) => <i key={t} class={i < tier ? (from !== undefined && i >= from ? 'is-new' : 'is-on') : ''} />)}
      <b>{TIERS[tier - 1]}</b>
    </span>
  );
}

/**
 * One blessing offered. At a Font, `from` is the tier held, and the card shows what it does at the tier
 * it would reach. `onPick` takes it.
 */
export function BoonCard({ id, tier, from, onPick }: { id: string; tier: number; from?: number; onPick?: () => void }) {
  const b = boonById(id);
  const said = describe(id, tier);
  if (!b) return null;
  const marks = b.paths.map((k) => STAT_ICON[k] ?? 'star');
  const body = (
    <>
      <span class={`boonc__seal ${marks.length > 1 ? 'is-duo' : ''}`} aria-hidden="true">
        {marks.map((g, i) => <Glyph key={i} name={g} />)}
      </span>
      <span class="boonc__body">
        <span class="boonc__head"><b class="boonc__name">{said.name}</b><TierPips tier={tier} from={from} /></span>
        <small class="boonc__kind">{kindLine(id)}{from !== undefined ? ` · Tier ${TIERS[from - 1]} → ${TIERS[tier - 1]}` : ''}</small>
        <span class="boonc__text"><Keyed text={from !== undefined ? raiseText(id, from, tier) : said.text} /></span>
        {b.hands && <small class="boonc__hand">Auto never plays it</small>}
      </span>
    </>
  );
  const cls = `boonc boonc--t${tier} boonc--${b.kind}`;
  return onPick
    ? <button type="button" class={cls} onClick={onPick} aria-label={`${said.name}, tier ${TIERS[tier - 1]}: ${said.text}`}>{body}</button>
    : <div class={cls}>{body}</div>;
}

/**
 * A blessing the run holds, as the run strip shows it: its Path's mark in a diamond and its tier's numeral,
 * nothing more. A tap tells its name and what it does, in the tip the fight's words open (`tell`).
 */
export function BoonChip({ id, tier, tell }: { id: string; tier: number; tell: (el: Element, title: string, lines: string[]) => void }) {
  const said = describe(id, tier);
  const b = boonById(id);
  const title = `${said.name}${b ? ` ${TIERS[tier - 1]}` : ''}`;
  return (
    <button type="button" class="boon" aria-label={`${title}: ${said.text}`} onClick={(e) => tell(e.currentTarget, title, [said.text])}>
      <span class="boon__mark" aria-hidden="true">{(b?.paths ?? ['']).map((k, i) => <Glyph key={i} name={STAT_ICON[k] ?? 'star'} />)}</span>
      {b && <b class="boon__tier" aria-hidden="true">{TIERS[tier - 1]}</b>}
    </button>
  );
}
