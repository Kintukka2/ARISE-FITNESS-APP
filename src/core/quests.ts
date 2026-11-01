/**
 * Quests the Quests screen reads off the save rather than issues: the next rank, and what reaching
 * it brings. Nothing here writes and nothing here pays. A rank still pays through `grantXP`, and a
 * class still changes through `syncClass`, exactly as before; this only says what they will do.
 */
import { CLASS_RANKS, classById, classFor } from '@/data/classes';
import { HOLLOW_THRONE } from '@/data/special';
import { SLOTS } from '@/data/shadows';
import { licenceRequired, licensedRank, UNLICENSED_CAP } from './licence';
import { bankedXp, nextRank, optionsAt, RANK_UP_POINTS, rankFor, totalXpFor, type RankInfo } from './progression';
import type { Rank, Save, Stat } from './types';
import { RANKS } from './types';

export interface Reclass {
  from: RankInfo;
  to: RankInfo;
  /** Experience still to earn before the rank, and how far through this rank's levels the hunter is, from 0 to 1. */
  left: number;
  share: number;
  /** Ability Points the rank pays on top of its level's. */
  points: number;
  /** The class the rank assigns as the hunter's stats stand, and the one it replaces. Null at Sovereign, which assigns none. */
  cls: { was: string | null; is: string; lead: Stat; bonus: number } | null;
  /** The choice of skill or passive the rank opens in that class's line. */
  pick: { kind: 'skill' | 'passive'; names: string[] } | null;
  /** Shadow slots before and after, when the rank adds some. */
  slots: [number, number] | null;
  /** The rank opens the Hollow Throne. */
  throne: boolean;
}

/** The grade the board would answer to at a rank, with the Association Licence's hold applied. */
function gradeAt(s: Save, rank: Rank | 'N'): Rank {
  const r: Rank = rank === 'N' ? 'S' : rank;
  return licenceRequired(s) && RANKS.indexOf(r) > RANKS.indexOf(UNLICENSED_CAP) ? UNLICENSED_CAP : r;
}

/** The next rank up the ladder, how near it is, and what it brings. Null at Sovereign. */
export function reclassification(s: Save): Reclass | null {
  const level = s.hunter.level;
  const to = nextRank(level);
  if (!to) return null;
  const from = rankFor(level);
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
    points: RANK_UP_POINTS,
    cls: next ? { was: classById(s.hunter.classId)?.name ?? null, is: next.name, lead: next.lead, bonus: next.bonus } : null,
    pick: next && rung >= 0 ? optionsAt(next.lead, rung) : null,
    slots: SLOTS[after] > SLOTS[grade] ? [SLOTS[grade], SLOTS[after]] : null,
    throne: after === 'S' && grade !== 'S' && !s.gates.cleared.includes(HOLLOW_THRONE.id),
  };
}
