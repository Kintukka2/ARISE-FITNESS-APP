/**
 * The Chosen sent into the world, after Gladiator Manager's. Winning the Trial
 * that opens a level sends its last Chosen out into the gates. Each day one of
 * them holds the first gate of the hunter's grade in the day's order, and shows
 * itself only to a hunter who walks in at its level or higher: then it stands
 * in the boss's place. A clear of that gate, met or not, closes it for the day.
 * The first time a Chosen falls it leaves a masterwork; after that, a bounty.
 * All of it is settled in `raid.finish`.
 */
import { MASTERWORK_SLOTS, WALKERS } from '@/data/ascension';
import { dayOrder } from './gates';
import { grant, ofRank, pastPerfect } from './gear';
import { licensedRank } from './licence';
import * as shop from './shop';
import { chosen } from './trial';
import type { Dungeon, Item, OpenRaid, Rank, Save } from './types';
import { rng } from './util';

/** The Chosen the Trial that opens `level` ends with: the one it sends into the world. */
export const walkerOf = (level: number, grade: Rank) => chosen(level + 1, grade);

/** The slot a level's Chosen guards: what its masterwork is for. */
export const slotOf = (level: number) => MASTERWORK_SLOTS[(level - 1) % MASTERWORK_SLOTS.length];

/** Send the Chosen of a newly opened level into the world. Mutates. */
export function send(s: Save, level: number) {
  if (!s.ascension.sent.includes(level)) s.ascension.sent.push(level);
}

export interface Walker { level: number; gateId: string; name: string }

/**
 * The Chosen out in the gates today, and the gate it holds: drawn from the day, among those not yet
 * felled while there are any. Null until a Trial has sent one.
 */
export function walking(s: Save, day: string): Walker | null {
  const { sent, felled } = s.ascension;
  if (!sent.length) return null;
  const standing = sent.filter((L) => !felled.includes(L));
  const pool = (standing.length ? standing : sent).slice().sort((a, b) => a - b);
  const level = pool[Math.floor(rng(`arise|walk|${day}`)() * pool.length)];
  const grade = licensedRank(s);
  return { level, gateId: dayOrder(grade, day)[0], name: walkerOf(level, grade).name };
}

/** The level of the Chosen a run at this gate would meet, entered at `entry`: null if none holds it, or it stays hidden. */
export function meets(s: Save, d: Dungeon, day: string, entry: number): number | null {
  const w = walking(s, day);
  return w && w.gateId === d.id && entry >= w.level ? w.level : null;
}

/** What felling a Chosen pays: a masterwork the first time, a bounty after. */
export interface Felled { level: number; name: string; item: Item | null; shards: number }

/**
 * A run that met a Chosen cleared its gate, so the Chosen fell. The first time, it leaves a masterwork
 * of the gate's grade for the slot it guards, perfect and its level's steps past it; after that, a
 * bounty, paid at the run's Ascension pay. Mutates.
 */
export function fell(s: Save, d: Dungeon, run: OpenRaid, pay: number): Felled | null {
  const level = run.chosen;
  if (!level) return null;
  const name = walkerOf(level, d.rank as Rank).name;
  if (s.ascension.felled.includes(level)) return { level, name, item: null, shards: shop.earn(s, shop.gateShards(d.rank, WALKERS.bounty * pay)) };
  s.ascension.felled.push(level);
  const pool = ofRank(d.rank as Rank).filter((g) => g.slot === slotOf(level) && !g.issued);
  if (!pool.length) return { level, name, item: null, shards: 0 };
  const def = pool[Math.floor(rng(`arise|masterwork|${run.seed}`)() * pool.length)];
  const it = grant(s, def.id, `${run.seed}|masterwork`);
  if (!it) return { level, name, item: null, shards: 0 };
  const i = s.items.indexOf(it);
  s.items[i] = { ...pastPerfect(it, level), master: level };
  return { level, name, item: s.items[i], shards: 0 };
}
