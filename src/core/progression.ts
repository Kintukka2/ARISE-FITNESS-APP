/**
 * Levels, rank, attributes and class.
 *
 * One rank ladder. A level qualifies the hunter for a rank (`rankFor`); the hunter claims it from its
 * Reclassification quest (`reclassify`), and holds it from then on (`rankOf`). Level is earned in the
 * Gates: every run pays experience by the gate's grade, settled once in `raid.finish`.
 */
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { classById, classFor } from '@/data/classes';
import { SLOTS } from '@/data/shadows';
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
  { key: 'E', name: 'E-Rank', min: 1, tier: 1, blurb: 'Awakened.' },
  { key: 'D', name: 'D-Rank', min: 10, tier: 2, blurb: 'Classes are assigned from this rank.' },
  { key: 'C', name: 'C-Rank', min: 20, tier: 2, blurb: 'Classified.' },
  { key: 'B', name: 'B-Rank', min: 35, tier: 3, blurb: 'Top 2% of the Awakened.' },
  { key: 'A', name: 'A-Rank', min: 50, tier: 4, blurb: `Shadow slots: ${SLOTS.A}.` },
  { key: 'S', name: 'S-Rank', min: 70, tier: 4, blurb: 'The highest rank the Association grants.' },
  { key: 'N', name: 'Sovereign', min: 100, tier: 4, blurb: 'Beyond classification.' },
];

export const ATTRS: { key: Stat; name: string; desc: string }[] = [
  { key: 'STR', name: 'Strength', desc: 'Increases physical damage.' },
  { key: 'AGI', name: 'Agility', desc: 'Increases initiative, evasion and crit chance.' },
  { key: 'PER', name: 'Perception', desc: 'Increases accuracy and crit chance.' },
  { key: 'VIT', name: 'Vitality', desc: 'Increases HP and defence.' },
  { key: 'INT', name: 'Intelligence', desc: 'Increases MP, magic damage and extraction success rate.' },
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

/** The rank a level qualifies for. The hunter holds it only once claimed: see `rankOf`. */
export function rankFor(level: number): RankInfo {
  let r = RANK_LADDER[0];
  for (const x of RANK_LADDER) if (level >= x.min) r = x;
  return r;
}

export function nextRank(level: number): RankInfo | null {
  return RANK_LADDER.find((x) => x.min > level) ?? null;
}

/** The rank the hunter holds. */
export function rankOf(s: Save): RankInfo {
  return RANK_LADDER.find((x) => x.key === s.hunter.rank) ?? RANK_LADDER[0];
}

/** The rung above the one held. Null at Sovereign. */
export function nextRankOf(s: Save): RankInfo | null {
  return RANK_LADDER[RANK_LADDER.indexOf(rankOf(s)) + 1] ?? null;
}

/** The hunter's level qualifies them for the rung above the one they hold. */
export function canReclassify(s: Save): boolean {
  const next = nextRankOf(s);
  return !!next && s.hunter.level >= next.min;
}

/**
 * Claim the next rank: the hunter now holds it, and it pays its Ability Points. One rung at a time,
 * each its own ceremony. The class it assigns follows through `syncClass`, as after any payout. Mutates.
 */
export function reclassify(s: Save): { from: RankInfo; to: RankInfo; points: number } | null {
  if (!canReclassify(s)) return null;
  const from = rankOf(s);
  const to = nextRankOf(s)!;
  s.hunter.rank = to.key;
  s.hunter.points += RANK_UP_POINTS;
  return { from, to, points: RANK_UP_POINTS };
}

/** Claim every rank the level has reached, then the class: a hunter who keeps up, as the balance tools model one. Mutates. */
export function reclassifyAll(s: Save): number {
  let n = 0;
  while (reclassify(s)) n++;
  if (n) syncClass(s);
  return n;
}

/** The letter the Gates and the Exchange read. Sovereign counts as S. */
export function gateRank(s: Save): Rank {
  const k = rankOf(s).key;
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
  /** A rank this payout's levels newly qualified the hunter for. It is theirs to claim, not yet held. */
  qualifies: RankInfo | null;
}

/** Award experience. A rank it qualifies the hunter for is claimed separately, with `reclassify`. Mutates. */
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
  const qualifies = rankFor(to).key !== fromRank ? rankFor(to) : null;
  return { gained, levels: to - from, from, to, points: s.hunter.points - pointsBefore, qualifies };
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

/** Reclassify from the leading attribute and the rank held. Returns the change, if any. */
export function syncClass(s: Save) {
  const c = classFor(s.hunter.attrs, rankOf(s).key);
  if (!c || c.id === s.hunter.classId) return null;
  const was = classById(s.hunter.classId);
  s.hunter.classId = c.id;
  return { cls: c, was };
}

export const shadowsOpen = (s: Save) => s.shadows.army.length > 0;

// ------------------------------------------------------------------ the Association's hunters' kits

/**
 * A class rung's two options, the first being what the line gave before there was a choice. The
 * hunter's own skills come from the skill tree (`core/skilltree.ts`); the Association's hunters fight
 * with each rung's first option (`kitFor`).
 */
export function optionsAt(lead: string, rung: number): { kind: 'skill' | 'passive'; names: string[] } {
  const skills = CLASS_SKILLS.filter((x) => x.line === lead && x.rung === rung).map((x) => x.name);
  if (skills.length) return { kind: 'skill', names: skills };
  return { kind: 'passive', names: CLASS_PASSIVES.filter((x) => x.line === lead && x.rung === rung).map((x) => x.name) };
}

/** The rungs of a line, in order. */
export const rungsOf = (lead: string) => [...new Set([...CLASS_SKILLS, ...CLASS_PASSIVES].filter((x) => x.line === lead).map((x) => x.rung))].sort((a, b) => a - b);

/** The skills and passives an Association hunter of a line and tier fights with: each open rung's first option. */
export function kitFor(lead: string, tier: number) {
  const kit: string[] = [];
  const passives: string[] = [];
  for (const r of rungsOf(lead).filter((x) => x <= tier)) {
    const o = optionsAt(lead, r);
    (o.kind === 'skill' ? kit : passives).push(o.names[0]);
  }
  return { kit, passives };
}
