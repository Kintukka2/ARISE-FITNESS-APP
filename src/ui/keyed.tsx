/**
 * A line told as the reference games colour a tip (Slay the Spire's: "Take 50% more damage from Attacks
 * for 1 turn."): its figures in the System's blue, its keywords in gold, the statuses and the stats a
 * creature's line names, the rest as it stands. Read from the engine's own names, so a new status or stat is
 * coloured the day it is added. Every tooltip's lines go through it (`ui/tip.tsx`).
 */
import { STATUS } from '@/core/combat';
import { STAT_WORDS } from '@/core/gear';

/** The statuses, every stat as a tooltip names it (`STAT_WORDS`), the two rows, and Shadow Essence, which a rank asks for. */
const KEYWORDS = [...new Set([...Object.keys(STATUS), ...Object.values(STAT_WORDS), 'Attack', 'HP', 'MP', 'defence', 'Shadow Essence', 'Shadow', 'Front', 'Rear'])];
/**
 * How many a skill reaches, one figure with its word (`2 targets`, `every foe`; the owner's call: how many it hits is
 * as much a skill's worth as its multiplier and its cooldown), set in the figures' blue.
 */
const REACH = '\\d+ targets?\\b|\\bevery foe\\b';
const RX = new RegExp(`(${REACH}|[×+-]?\\d+(?:[.,]\\d+)?%?|\\b(?:${KEYWORDS.sort((a, b) => b.length - a.length).join('|')})\\b)`, 'g');
const IS_REACH = new RegExp(`^(?:${REACH})$`);

/** A line split as `Keyed` colours it: the plain text at even places, its figures and keywords at odd ones. */
export const keyedParts = (text: string) => text.split(RX);

/** How a figure or a keyword is set: a reach and every figure in the System's blue, a status or a stat in gold. */
export const keyedClass = (p: string) => (IS_REACH.test(p) ? 'kw-num kw-reach' : /\d/.test(p) ? 'kw-num' : 'kw');

export function Keyed({ text }: { text: string }) {
  const parts = keyedParts(text);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} class={keyedClass(p)}>{p}</b> : p))}</>;
}
