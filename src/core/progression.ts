/**
 * Levels, rank, Resonance, attributes and class.
 *
 * One rank ladder. It is earned by level, and level is earned by training and
 * the Daily Quest — never by a simulated fight. Gates pay gear, shards and
 * Shadows; they do not pay experience.
 */
import { classById, classFor } from '@/data/classes';
import type { Attrs, Rank, Save, Stat } from './types';
import { STATS } from './types';
import { clamp } from './util';

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
  { key: 'AGI', name: 'Agility', desc: 'Speed: initiative, evasion, critical hits, and shorter rests.' },
  { key: 'PER', name: 'Perception', desc: 'Awareness: accuracy and critical hits.' },
  { key: 'VIT', name: 'Vitality', desc: 'Resilience. Sets HP and defence.' },
  { key: 'INT', name: 'Intelligence', desc: 'Judgement under fatigue. Sets MP, magic, and the odds of binding a Shadow.' },
];

export const STAT_CAP = 100;
export const BOOST_CAP = 200;
export const POINTS_PER_LEVEL = 3;
export const RANK_UP_POINTS = 5;
export const CERT_LEVEL = 5;
/** Basic Training always pays at least this much, even past Level 5. */
const BASIC_MIN = 300;

export const RESONANCE = { perDay: 0.01, max: 2, maxDays: 100 } as const;
export const RESONANCE_TIERS = [
  { key: 'dormant', min: 0, name: 'Dormant' },
  { key: 'ember', min: 1, name: 'Ember' },
  { key: 'kindled', min: 10, name: 'Kindled' },
  { key: 'burning', min: 20, name: 'Burning' },
  { key: 'searing', min: 50, name: 'Searing' },
  { key: 'perfect', min: 100, name: 'Perfect Resonance' },
] as const;

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

export function techTier(s: Save): number {
  const byExp = { novice: 1, trained: 2, seasoned: 3, elite: 4 }[s.profile.experience] ?? 1;
  return clamp(Math.max(rankFor(s.hunter.level).tier, byExp), 1, 4);
}

export function resonance(s: Save) {
  const days = Math.max(0, s.streak.current);
  const raw = 1 + days * RESONANCE.perDay;
  const mult = Math.min(RESONANCE.max, raw);
  let tier: (typeof RESONANCE_TIERS)[number] = RESONANCE_TIERS[0];
  for (const t of RESONANCE_TIERS) if (days >= t.min) tier = t;
  return {
    days,
    mult,
    atMax: raw >= RESONANCE.max,
    daysToMax: Math.max(0, RESONANCE.maxDays - days),
    pct: clamp(((mult - 1) / (RESONANCE.max - 1)) * 100, 0, 100),
    tier,
  };
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
  mult: number;
}

/** Award experience: Resonance and Hollow apply unless `raw`. Mutates. */
export function grantXP(s: Save, amount: number, opts: { raw?: boolean } = {}): XpResult {
  let mult = opts.raw ? 1 : resonance(s).mult;
  if (s.flags.hollow && !opts.raw) mult *= 0.5;
  const gained = Math.max(1, Math.round(amount * mult));
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
  return { gained, levels: to - from, from, to, points: s.hunter.points - pointsBefore, rankUp, mult };
}

/** What an amount will actually pay right now, for honest labels. */
export function previewXP(s: Save, amount: number): number {
  return Math.max(1, Math.round(amount * resonance(s).mult * (s.flags.hollow ? 0.5 : 1)));
}

/** Exactly the shortfall to Level 5, so finishing Basic Training lands you on it. */
export function basicAward(s: Save): number {
  return Math.max(totalXpFor(CERT_LEVEL) - bankedXp(s), BASIC_MIN);
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

export const gatesOpen = (s: Save) => s.training.certified;
export const shadowsOpen = (s: Save) => s.shadows.army.length > 0;
