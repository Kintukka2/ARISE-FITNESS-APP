/**
 * Association Quests: the jobs Ryn Valcorde hands the hunter for the Association, one at a time.
 * The line loops through three kinds of job, at the hunter's own grade, and grows as it goes: more
 * creatures to fell, and Gates with stronger bosses. Numbers here are rules; the screens quote them.
 */

/** The kinds of job, in the order the line loops through them. */
export const ASSOC_LOOP = ['hunt', 'clear', 'hunt', 'boss'] as const;
export type AssocKind = (typeof ASSOC_LOOP)[number];

export const ASSOC = {
  /** Creatures to fell: `base`, and `step` more for every time round the loop, to `max`. */
  hunt: { base: 5, step: 2, max: 24 },
  /** The Gates a job picks from, of the grade's, weakest boss first: `first` of them, and one more every time round. */
  reach: { first: 2, step: 1 },
  /** Every job pays this share of a clear's experience at its grade. */
  xp: 0.25,
  /** The share of jobs that pay nothing else. */
  bare: 0.3,
  /** The jobs, by their place in the line, that pay a wider satchel instead: one more field potion each. */
  satchelAt: [5, 15, 30],
} as const;

/** What else a job can pay, and how often, by weight. */
export const ASSOC_PAY: { kind: 'potion' | 'field' | 'shards' | 'survey' | 'blueprint' | 'alloy'; id?: 'hp' | 'mp' | 'fatigue'; n: [number, number]; weight: number }[] = [
  { kind: 'potion', id: 'hp', n: [1, 2], weight: 3 },
  { kind: 'potion', id: 'mp', n: [1, 2], weight: 3 },
  { kind: 'potion', id: 'fatigue', n: [1, 1], weight: 2 },
  { kind: 'field', n: [1, 2], weight: 2 },
  { kind: 'shards', n: [1, 2], weight: 3 },
  { kind: 'survey', n: [1, 1], weight: 2 },
  // The Forge: a blueprint of the job's grade, one not yet known, now and then; alloy of it more often.
  { kind: 'blueprint', n: [1, 1], weight: 1 },
  { kind: 'alloy', n: [6, 10], weight: 3 },
];

/** The Gate Survey: an Association report on a Gate, which shows its map before the hunter has been in. */
export const SURVEY = { name: 'Gate Survey', desc: 'An Association survey team’s report on a Gate: its map, before you go in.' } as const;
