/**
 * A line told as the reference games colour a tip (Slay the Spire's: "Take 50% more damage from Attacks
 * for 1 turn."): its figures in the System's blue, its keywords in gold, the statuses and the stats a
 * creature's line names, the rest as it stands. Read from the engine's own names, so a new status is
 * coloured the day it is added.
 */
import { STATUS } from '@/core/combat';

const KEYWORDS = [...Object.keys(STATUS), 'Attack', 'HP', 'MP', 'defence', 'Shadow'];
const RX = new RegExp(`([×+-]?\\d+(?:[.,]\\d+)?%?|\\b(?:${KEYWORDS.sort((a, b) => b.length - a.length).join('|')})\\b)`, 'g');

export function Keyed({ text }: { text: string }) {
  const parts = text.split(RX);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} class={/\d/.test(p) ? 'kw-num' : 'kw'}>{p}</b> : p))}</>;
}
