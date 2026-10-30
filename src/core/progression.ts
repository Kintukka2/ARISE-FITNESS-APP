/**
 * Levels, rank, attributes and class.
 *
 * One rank ladder, earned by level. Level is earned in the Gates: every run
 * pays experience by the gate's grade, settled once in `raid.finish`.
 */
import { classById, classFor } from '@/data/classes';
import type { Attrs, Rank, Save, Stat } from './types';
import { STATS } from './types';

export type HunterRank = Rank | 'N';

export interface RankInfo {
  key: HunterRank;
  name: string;
  min: number;
  /** Highest technique tier this rank opens. */
  tier: number;
  blurb: string;
}

export const RANK_LADDER: RankInfo[] = [
  { key: 'E', name: 'E-Rank', min: 1, tier: 1, blurb: 'Awakened. Barely.' },
  { key: 'D', name: 'D-Rank', min: 10, tier: 2, blurb: 'The System is paying attention.' },
  { key: 'C', name: 'C-Rank', min: 20, tier: 2, blurb: 'Classified. You have a shape now.' },
  { key: 'B', name: 'B-Rank', min: 35, tier: 3, blurb: 'Top two percent of the Awakened.' },
  { key: 'A', name: 'A-Rank', min: 50, tier: 4, blurb: 'Your Shadows move without orders.' },
  { key: 'S', name: 'S-Rank', min: 70, tier: 4, blurb: 'The highest the Association may grant.' },
  { key: 'N', name: 'Sovereign', min: 100, tier: 4, blurb: 'Beyond classification.' },
];

export const ATTRS: { key: Stat; name: string; desc: string }[] = [
  { key: 'STR', name: 'Strength', desc: 'Force. Drives physical damage.' },
  { key: 'AGI', name: 'Agility', desc: 'Speed: initiative, evasion and critical hits.' },
  { key: 'PER', name: 'Perception', desc: 'Awareness: accuracy and critical hits.' },
  { key: 'VIT', name: 'Vitality', desc: 'Resilience. Sets HP and defence.' },
  { key: 'INT', name: 'Intelligence', desc: 'Sets MP, magic, and the odds of binding a Shadow.' },
];

export const STAT_CAP = 100;
export const BOOST_CAP = 200;
export const POINTS_PER_LEVEL = 3;
export const RANK_UP_POINTS = 5;
/** Clearing the practice gate lands you here: the System counts your first kill. */
export const PRACTICE_LEVEL = 5;
/** Experience a cleared gate pays, by grade. A first clear pays it twice; withdrawing or being carried out pays a share. */
export const GATE_XP: Record<Rank, number> = { E: 120, D: 300, C: 650, B: 1000, A: 1600, S: 2700 };

export const xpToNext = (level: number) => Math.floor(4.5 * Math.pow(level, 1.8)) + 55;

export function totalXpFor(level: number): number {
  let n = 0;
  for (let l = 1; l < level; l++) n += xpToNext(l);
  return n;
}

export const bankedXp = (s: Save) => totalXpFor(s.hunter.level) + s.hunter.xp;

export function rankFor(level: number): RankInfo {
  let r = RANK_LADDER[0];
  for (const x of RANK_LADDER) if (level >= x.min) r = x;
  return r;
}

export function nextRank(level: number): RankInfo | null {
  return RANK_LADDER.find((x) => x.min > level) ?? null;
}

/** The letter the Gates and the Exchange read. Sovereign counts as S. */
export function gateRank(s: Save): Rank {
  const k = rankFor(s.hunter.level).key;
  return k === 'N' ? 'S' : k;
}

/** Flat attribute points from the class. */
export function classBonus(s: Save): Partial<Attrs> {
  const c = classById(s.hunter.classId);
  return c ? { [c.lead]: c.bonus } : {};
}

export interface XpResult {
  gained: number;
  levels: number;
  from: number;
  to: number;
  points: number;
  rankUp: RankInfo | null;
}

/** Award experience. Mutates. */
export function grantXP(s: Save, amount: number): XpResult {
  const gained = Math.max(0, Math.round(amount));
  const from = s.hunter.level;
  const fromRank = rankFor(from).key;
  const pointsBefore = s.hunter.points;

  s.hunter.xp += gained;
  s.stats.xpTotal += gained;
  let guard = 0;
  while (s.hunter.xp >= xpToNext(s.hunter.level) && guard++ < 500) {
    s.hunter.xp -= xpToNext(s.hunter.level);
    s.hunter.level += 1;
    s.hunter.points += POINTS_PER_LEVEL;
  }
  const to = s.hunter.level;
  let rankUp: RankInfo | null = null;
  if (rankFor(to).key !== fromRank) {
    rankUp = rankFor(to);
    // One bonus per rank crossed, so a big payout across two ranks pays both.
    const crossed = RANK_LADDER.filter((r) => r.min > from && r.min <= to).length;
    s.hunter.points += RANK_UP_POINTS * crossed;
  }
  return { gained, levels: to - from, from, to, points: s.hunter.points - pointsBefore, rankUp };
}

/** Exactly the shortfall to the practice level, so clearing the practice gate lands you on it. */
export function practiceAward(s: Save): number {
  return Math.max(0, totalXpFor(PRACTICE_LEVEL) - bankedXp(s));
}

/** Spend one point. False means nothing moved and nothing was charged. */
export function spendPoint(s: Save, stat: Stat): boolean {
  if (s.hunter.points <= 0 || s.hunter.attrs[stat] >= STAT_CAP) return false;
  s.hunter.points -= 1;
  s.hunter.attrs[stat] += 1;
  return true;
}

/**
 * Spread every unspent point, lowest attribute first among those the hunter
 * has invested in most — keeps the class lead while filling weak sides.
 */
export function autoAllocate(s: Save): number {
  let spent = 0;
  const lead = leadStat(s.hunter.attrs);
  while (s.hunter.points > 0) {
    const open = STATS.filter((k) => s.hunter.attrs[k] < STAT_CAP);
    if (!open.length) break;
    // Every third point goes to the lead; the rest raise the weakest.
    const k = spent % 3 === 0 && open.includes(lead)
      ? lead
      : open.reduce((a, b) => (s.hunter.attrs[b] < s.hunter.attrs[a] ? b : a));
    spendPoint(s, k);
    spent++;
  }
  return spent;
}

export function leadStat(a: Attrs): Stat {
  return STATS.reduce((best, k) => (a[k] > a[best] ? k : best), 'STR' as Stat);
}

/** Reclassify from the leading attribute and current rank. Returns the change, if any. */
export function syncClass(s: Save) {
  const c = classFor(s.hunter.attrs, rankFor(s.hunter.level).key);
  if (!c || c.id === s.hunter.classId) return null;
  const was = classById(s.hunter.classId);
  s.hunter.classId = c.id;
  return { cls: c, was };
}

export const shadowsOpen = (s: Save) => s.shadows.army.length > 0;
