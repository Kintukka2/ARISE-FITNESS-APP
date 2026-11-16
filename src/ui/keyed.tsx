/**
 * A line told as the reference games colour a tip (Slay the Spire's: "Take 50% more damage from Attacks
 * for 1 turn."): its figures in the System's blue, its keywords in gold, the statuses and the stats a
 * creature's line names, the rest as it stands. Read from the engine's own names, so a new status or stat is
 * coloured the day it is added. Every tooltip's lines go through it (`ui/tip.tsx`).
 */
import { STATUS } from '@/core/combat';
import { STAT_WORDS } from '@/core/gear';

/** The statuses, every stat as a tooltip names it (`STAT_WORDS`), and the two ranks. */
const KEYWORDS = [...new Set([...Object.keys(STATUS), ...Object.values(STAT_WORDS), 'Attack', 'HP', 'MP', 'defence', 'Shadow', 'Front', 'Rear'])];
const RX = new RegExp(`([×+-]?\\d+(?:[.,]\\d+)?%?|\\b(?:${KEYWORDS.sort((a, b) => b.length - a.length).join('|')})\\b)`, 'g');

export function Keyed({ text }: { text: string }) {
  const parts = text.split(RX);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} class={/\d/.test(p) ? 'kw-num' : 'kw'}>{p}</b> : p))}</>;
}
