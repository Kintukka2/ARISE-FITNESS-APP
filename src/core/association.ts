/**
 * Association Quests, handed out by Ryn Valcorde one at a time. Each is a job on one Gate of the
 * hunter's grade, which the Association pins to the board until the job is done: fell a number of
 * one of its creatures, clear it, or fell its boss. Progress is counted in `raid.finish`, with
 * everything else a run settles. Done, the hunter reports to him (`report`): he pays a little
 * experience, and most jobs something more, then hands over the next. A job is written to the save
 * when it is handed over, so nothing redraws it.
 */
import { ASSOC, ASSOC_LOOP, ASSOC_PAY, type AssocKind } from '@/data/association';
import { DUNGEONS } from '@/data/dungeons';
import { powerOf } from './combat';
import * as forge from './forge';
import { enemyById, PRACTICE_GATE } from './gates';
import { licensedRank } from './licence';
import { GATE_XP, grantXP, type XpResult } from './progression';
import * as shop from './shop';
import type { Dungeon, OpenRaid, Rank, Save } from './types';
import { RANKS } from './types';
import { rng } from './util';

export type AssocReward =
  | { kind: 'potion'; id: 'hp' | 'mp' | 'fatigue'; n: number }
  | { kind: 'shards' | 'survey' | 'satchel' | 'blueprint' | 'alloy'; n: number };

export interface AssocQuest {
  /** Its place in the line, from 0. */
  n: number;
  kind: AssocKind;
  grade: Rank;
  /** The Gate the Association pins to the board for it. */
  gate: string;
  /** The creature to fell, for a hunt; the boss, for a boss job. */
  target?: string;
  need: number;
  got: number;
  xp: number;
  /** What it pays besides the experience, or nothing. */
  reward: AssocReward | null;
}

/** The line opens once the Practice Gate is behind the hunter, with the Quests screen. */
export const open = (s: Save) => s.gates.cleared.includes(PRACTICE_GATE.id);
export const current = (s: Save) => s.assoc?.quest ?? null;
export const done = (q: AssocQuest | null) => !!q && q.got >= q.need;
/** Whether a job is waiting to be reported. */
export const ready = (s: Save) => done(current(s));

/** A grade's Gates, weakest boss first. */
const ladder = (g: Rank) => DUNGEONS.filter((d) => d.rank === g)
  .map((d) => ({ d, p: powerOf(enemyById(d.boss)?.base ?? { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 }) }))
  .sort((a, b) => a.p - b.p).map((x) => x.d);

/** The job at place `n` in the line, for a hunter of grade `g`. The same n and grade always draw the same job. */
export function make(n: number, g: Rank): AssocQuest {
  const r = rng(`arise|assoc|${n}|${g}`);
  const kind = ASSOC_LOOP[n % ASSOC_LOOP.length];
  const round = Math.floor(n / ASSOC_LOOP.length);
  const gates = ladder(g);
  // Early jobs keep to the grade's weakest Gates; every time round the loop reaches one further.
  const reach = Math.min(gates.length, ASSOC.reach.first + ASSOC.reach.step * round);
  const gate = gates[Math.floor(r() * reach)];
  const target = kind === 'hunt' ? gate.mobs[Math.floor(r() * gate.mobs.length)] : kind === 'boss' ? gate.boss : undefined;
  const need = kind === 'hunt' ? Math.min(ASSOC.hunt.max, ASSOC.hunt.base + ASSOC.hunt.step * round) : 1;
  return { n, kind, grade: g, gate: gate.id, target, need, got: 0, xp: Math.round(GATE_XP[g] * ASSOC.xp), reward: rewardAt(n, g) };
}

/** What the job at place `n` pays besides its experience. */
export function rewardAt(n: number, g: Rank): AssocReward | null {
  if ((ASSOC.satchelAt as readonly number[]).includes(n)) return { kind: 'satchel', n: 1 };
  const r = rng(`arise|assoc-pay|${n}|${g}`);
  if (r() < ASSOC.bare) return null;
  const total = ASSOC_PAY.reduce((t, x) => t + x.weight, 0);
  let roll = r() * total;
  const pick = ASSOC_PAY.find((x) => (roll -= x.weight) < 0) ?? ASSOC_PAY[0];
  const count = pick.n[0] + Math.floor(r() * (pick.n[1] - pick.n[0] + 1));
  return pick.kind === 'potion' ? { kind: 'potion', id: pick.id!, n: count } : { kind: pick.kind, n: count };
}

/**
 * Hand over the next job, if none is in hand. A job left unfinished below the hunter's grade, once
 * they have climbed past it, is drawn again at their grade, in the same place in the line: its
 * creatures and its Gate would never be in their way again. Returns the job in hand. Mutates.
 */
export function issue(s: Save): AssocQuest | null {
  if (!open(s)) return null;
  s.assoc ??= { n: 0, quest: null, reported: 0 };
  const g = licensedRank(s);
  const q = s.assoc.quest;
  if (!q || (!done(q) && RANKS.indexOf(q.grade) < RANKS.indexOf(g))) s.assoc.quest = make(s.assoc.n, g);
  return s.assoc.quest;
}

/** The Gate a job in hand pins to the board, if any. */
export const pinned = (s: Save) => current(s)?.gate ?? null;

/** How far a run moved the job in hand. */
export interface AssocMove { from: number; to: number; need: number }

/**
 * Count a run toward the job in hand: a clear of its Gate, or its creature or boss felled, anywhere.
 * Kills count however the run ended; a clear only when it cleared. A Chosen standing in the boss's
 * place in the job's Gate is that boss, for a boss job: a clear there fells it (as `walkers.fell`
 * has it), so the job is never shut out while the Chosen holds the Gate. Returns the move, or null. Mutates.
 */
export function count(s: Save, d: Dungeon, run: OpenRaid, outcome: 'cleared' | 'withdrawn' | 'defeated'): AssocMove | null {
  const q = current(s);
  if (!q || done(q)) return null;
  const inPlace = q.kind === 'boss' && d.id === q.gate && !!run.chosen && outcome === 'cleared' ? 1 : 0;
  const add = q.kind === 'clear' ? (d.id === q.gate && outcome === 'cleared' ? 1 : 0)
    : run.felled.filter((id) => id === q.target).length + inPlace;
  if (!add) return null;
  const from = q.got;
  q.got = Math.min(q.need, q.got + add);
  return { from, to: q.got, need: q.need };
}

export interface AssocPaid {
  /** `kept`: the potions it paid that the hunter carries; Health Potions past the satchel's room are paid in `shards`. */
  quest: AssocQuest; xp: XpResult | null; shards: number; kept: number; next: AssocQuest | null;
  /** The blueprint it paid, if it paid one; or the alloy it paid, for a blueprint when every design of its grade was known, or as alloy. */
  blueprint: string | null; mats: Record<string, number>;
}

/**
 * Report a finished job: its experience, and what else it pays, then the next job. A Health Potion
 * the satchel has no room for is paid in shards at its price. Returns what was paid, or null if the
 * job is not done. Mutates.
 */
export function report(s: Save): AssocPaid | null {
  const q = current(s);
  if (!q || !done(q)) return null;
  const xp = q.xp ? grantXP(s, q.xp) : null;
  let shards = 0;
  let kept = 0;
  const w = q.reward;
  let blueprint: string | null = null;
  let mats: Record<string, number> = {};
  if (w?.kind === 'blueprint') ({ blueprint, mats } = forge.leaveBlueprint(s, q.grade, rng(`arise|assoc-blueprint|${q.n}|${q.grade}`)));
  else if (w?.kind === 'alloy') { mats = { [forge.alloyId(q.grade)]: w.n }; forge.give(s, mats); }
  if (w?.kind === 'potion') ({ kept, shards } = shop.givePotions(s, w.id, w.n));
  else if (w?.kind === 'survey') shop.stockUp(s, 'survey', w.n);
  else if (w?.kind === 'satchel') s.satchelPlus = (s.satchelPlus ?? 0) + w.n;
  else if (w?.kind === 'shards') shards = shop.earn(s, shop.gateShards(q.grade, w.n));
  s.assoc!.reported += 1;
  s.assoc!.n += 1;
  s.assoc!.quest = null;
  const next = issue(s);
  return { quest: q, xp, shards, kept, next, blueprint, mats };
}

