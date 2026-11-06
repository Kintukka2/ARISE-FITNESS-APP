/**
 * Quests the Quests screen reads off the save rather than issues: the next rank, and what claiming
 * it brings, and what the Quests tab counts. Nothing here writes and nothing here pays. A rank pays
 * through `reclassify` when the hunter claims it, and a class changes through `syncClass`; this only
 * says what they will do.
 */
import { CLASS_RANKS, classById, classFor } from '@/data/classes';
import { ASCENSION_FROM } from '@/data/ascension';
import { HOLLOW_THRONE } from '@/data/special';
import { SLOTS } from '@/data/shadows';
import { trialReady } from './ascension';
import { ready as assocReady } from './association';
import { unseen } from './contracts';
import { licenceRequired, licensedRank, UNLICENSED_CAP } from './licence';
import { SKILL_POINTS, SKILL_SLOTS } from '@/data/tree';
import { bankedXp, canReclassify, nextRankOf, RANK_UP_POINTS, rankOf, reclassify, syncClass, totalXpFor, type RankInfo } from './progression';
import * as forge from './forge';
import { BLUEPRINTS } from '@/data/forge';
import type { Rank, Save, Stat } from './types';
import { RANKS } from './types';
import { dayKey } from './util';

export interface Reclass {
  from: RankInfo;
  to: RankInfo;
  /** Experience still to earn before the rank, and how far through this rank's levels the hunter is, from 0 to 1. */
  left: number;
  share: number;
  /** The level is reached: the rank is the hunter's to claim. */
  ready: boolean;
  /** Ability Points the rank pays on top of its level's. */
  points: number;
  /** The class the rank assigns as the hunter's stats stand, and the one it replaces. Null at Sovereign, which assigns none. */
  cls: { was: string | null; is: string; lead: Stat; bonus: number } | null;
  /** What the rank does for the skill tree: the Skill Points it pays, the tier it opens, and skill slots before and after when it adds one. */
  skills: { points: number; tier: Rank | null; slots: [number, number] | null };
  /** Shadow slots before and after, when the rank adds some. */
  slots: [number, number] | null;
  /** The rank opens the Hollow Throne. */
  throne: boolean;
  /** The rank opens Ascension. */
  ascension: boolean;
  /** Blueprints of the rank's grade it pays, and the rarity they are. */
  blueprints: { n: number; rank: Rank };
}

/** The grade the board would answer to at a rank, with the Association Licence's hold applied. */
function gradeAt(s: Save, rank: Rank | 'N'): Rank {
  const r: Rank = rank === 'N' ? 'S' : rank;
  return licenceRequired(s) && RANKS.indexOf(r) > RANKS.indexOf(UNLICENSED_CAP) ? UNLICENSED_CAP : r;
}

/** The rank above the one held, how near its level is, and what claiming it brings. Null at Sovereign. */
export function reclassification(s: Save): Reclass | null {
  const to = nextRankOf(s);
  if (!to) return null;
  const from = rankOf(s);
  const floor = totalXpFor(from.min);
  const need = totalXpFor(to.min) - floor;
  const banked = bankedXp(s) - floor;
  const next = to.key === 'N' ? null : classFor(s.hunter.attrs, to.key);
  const rung = CLASS_RANKS.indexOf(to.key as Rank);
  const grade = licensedRank(s);
  const after = gradeAt(s, to.key);
  return {
    from, to,
    left: Math.max(0, need - banked),
    share: need > 0 ? Math.max(0, Math.min(1, banked / need)) : 1,
    ready: canReclassify(s),
    points: RANK_UP_POINTS,
    cls: next ? { was: classById(s.hunter.classId)?.name ?? null, is: next.name, lead: next.lead, bonus: next.bonus } : null,
    skills: {
      points: SKILL_POINTS.rank,
      tier: rung >= 0 ? CLASS_RANKS[rung] : null,
      slots: SKILL_SLOTS[to.key] > SKILL_SLOTS[from.key] ? [SKILL_SLOTS[from.key], SKILL_SLOTS[to.key]] : null,
    },
    slots: SLOTS[after] > SLOTS[grade] ? [SLOTS[grade], SLOTS[after]] : null,
    throne: after === 'S' && grade !== 'S' && !s.gates.cleared.includes(HOLLOW_THRONE.id),
    ascension: RANKS.indexOf(after) >= RANKS.indexOf(ASCENSION_FROM) && RANKS.indexOf(grade) < RANKS.indexOf(ASCENSION_FROM),
    blueprints: { n: BLUEPRINTS.rank, rank: (to.key === 'N' ? 'S' : to.key) as Rank },
  };
}

/**
 * Claim the next rank: `progression.reclassify`, then the blueprints of its grade it pays
 * (`forge.rankBlueprints`). Null if the level does not reach it yet. Mutates.
 */
export function claim(s: Save) {
  const r = reclassify(s);
  if (!r) return null;
  return { ...r, ...forge.rankBlueprints(s, r.to.key) };
}

/** Claim every rank the level has reached, then the class: a hunter who keeps up, as the campaign plays one. Mutates. */
export function claimAll(s: Save): number {
  let n = 0;
  while (claim(s)) n++;
  if (n) syncClass(s);
  return n;
}

/**
 * What the Quests tab counts: today's Daily Quests until the screen has shown them, the Trial while
 * it stands open and today's attempt is unused, and a rank waiting to be claimed, as the Inventory tab
 * counts unspent points.
 */
export const waiting = (s: Save, day = dayKey()) => unseen(s, day) + (trialReady(s, day) ? 1 : 0) + (canReclassify(s) ? 1 : 0) + (assocReady(s) ? 1 : 0);
