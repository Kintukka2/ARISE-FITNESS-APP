/**
 * The Boon: every completed set banks a point into the attributes that
 * technique trains. Every three days the System pays the ledger out as raw
 * attributes. It skips experience entirely, so Resonance cannot inflate it.
 */
import { STAT_CAP, ATTRS } from './progression';
import { exById, statsOf } from './exercises';
import type { Attrs, Save, Stat } from './types';
import { STATS } from './types';
import { clamp, dayKey, daysBetween, msUntilMidnight } from './util';

export const PERIOD_DAYS = 3;

/** Tiers need both enough sets and enough separate days: one marathon session cannot buy the top. */
export const TIERS = [
  { min: 0, days: 0, grant: 0, name: 'Insufficient' },
  { min: 6, days: 1, grant: 1, name: 'Acknowledged' },
  { min: 14, days: 2, grant: 2, name: 'Commended' },
  { min: 26, days: 3, grant: 3, name: 'Exalted' },
] as const;
export type Tier = (typeof TIERS)[number];

/** An exceptional period also pays one free point. */
export const FREE = { sets: 36, days: 3 };
/** If one attribute holds half the ledger, it (and anything within 90% of it) takes the grant. */
const DOMINANT = 0.5;
const CO = 0.9;

export const emptyPoints = (): Attrs => ({ STR: 0, AGI: 0, PER: 0, VIT: 0, INT: 0 });

export function blank(start = dayKey()): Save['boon'] {
  return { start, points: emptyPoints(), sets: 0, days: [], last: null };
}

export function log(s: Save, exId: string, sets: number, today = dayKey()) {
  const ex = exById(exId);
  if (!ex || !(sets > 0)) return;
  for (const k of statsOf(ex)) s.boon.points[k] += sets;
  s.boon.sets += sets;
  if (!s.boon.days.includes(today)) s.boon.days.push(today);
}

export const daysLeft = (s: Save, today = dayKey()) =>
  Math.max(0, PERIOD_DAYS - daysBetween(s.boon.start, today));

export const due = (s: Save, today = dayKey()) => daysLeft(s, today) <= 0;

export function countdown(s: Save, now = new Date()): string {
  const d = daysLeft(s, dayKey(now));
  if (d <= 0) return 'NOW';
  const ms = (d - 1) * 864e5 + msUntilMidnight(now);
  const days = Math.floor(ms / 864e5);
  const hrs = Math.floor((ms % 864e5) / 36e5);
  if (days > 0) return `${days}d ${hrs}h`;
  return hrs > 0 ? `${hrs}h` : '<1h';
}

export function tierFor(b: Save['boon']): Tier {
  let best: Tier = TIERS[0];
  for (const t of TIERS) if (b.sets >= t.min && b.days.length >= t.days) best = t;
  return best;
}

export function progress(s: Save) {
  const tier = tierFor(s.boon);
  const i = TIERS.indexOf(tier);
  const next = TIERS[i + 1] ?? null;
  const ceil = next ? next.min : FREE.sets;
  return {
    tier,
    next,
    sets: s.boon.sets,
    days: s.boon.days.length,
    pct: clamp(((s.boon.sets - tier.min) / Math.max(1, ceil - tier.min)) * 100, 0, 100),
    toNext: Math.max(0, ceil - s.boon.sets),
  };
}

export const leaders = (b: Save['boon']): Stat[] =>
  STATS.filter((k) => b.points[k] > 0).sort((a, z) => b.points[z] - b.points[a]);

export function assess(s: Save) {
  const b = s.boon;
  const tier = tierFor(b);
  const order = leaders(b);
  const grant: Partial<Attrs> = {};
  let total = 0;
  if (tier.grant > 0 && order.length) {
    const top = b.points[order[0]];
    const pool = top / b.sets >= DOMINANT ? order.filter((k) => b.points[k] >= top * CO) : order;
    for (let i = 0; i < tier.grant; i++) {
      const k = pool[i % pool.length];
      grant[k] = (grant[k] ?? 0) + 1;
      total++;
    }
  }
  const free = tier.grant >= 3 && b.sets >= FREE.sets && b.days.length >= FREE.days ? 1 : 0;
  return { tier, grant, total, free, sets: b.sets, days: b.days.length, points: { ...b.points } };
}

export type BoonResult = ReturnType<typeof assess>;

/** Pay the period out and open the next. Mutates. */
export function settle(s: Save, today = dayKey()): BoonResult {
  const res = assess(s);
  for (const k of Object.keys(res.grant) as Stat[]) {
    s.hunter.attrs[k] = Math.min(STAT_CAP, s.hunter.attrs[k] + (res.grant[k] ?? 0));
  }
  s.hunter.points += res.free;
  if (res.total || res.free) {
    s.stats.boons += 1;
    s.stats.boonPoints += res.total + res.free;
    s.log.unshift({ day: today, kind: 'boon', name: `Boon — ${res.tier.name}`, xp: 0 });
  } else {
    s.stats.boonsMissed += 1;
  }
  s.boon = blank(today);
  s.boon.last = { day: today, tier: res.tier.name, grant: res.grant, free: res.free };
  return res;
}

export const statName = (k: Stat) => ATTRS.find((a) => a.key === k)?.name ?? k;
