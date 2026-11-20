/**
 * How the cards' History says a place and a day: `3rd`, and `Today`, `Yesterday` or `12 days ago` (an Association
 * hunter's card and a Shadow's, which read alike).
 */
import { daysBetween, dayKey } from '@/core/util';

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

export const ago = (day: string) => {
  const n = Math.max(0, daysBetween(day, dayKey()));
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
};
