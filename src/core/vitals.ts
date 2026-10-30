/**
 * HP, MP and Fatigue: the raid economy. Spent by raiding, recovered on a
 * clock that runs while the app is closed.
 */
import type { Attrs, Save } from './types';
import { clamp } from './util';

const HOUR = 36e5;
const FLAT_PER_HOUR = 10;
const PCT_PER_HOUR = 0.05;
const FATIGUE_PER_HOUR = 5;
export const FATIGUE_MAX = 100;
export const RAID_FATIGUE: Record<string, number> = { E: 5, D: 8, C: 12, B: 16, A: 22, S: 30 };
/** Carried out of a gate: the medics keep you this long. */
export const WIPE_LOCK = 12 * HOUR;

export function maxima(s: Save) {
  const a = s.hunter.attrs;
  const lvl = s.hunter.level;
  return { hp: 100 + a.VIT * 10 + lvl * 5, mp: 30 + a.INT * 5 + lvl * 2 };
}

const perHour = (max: number) => Math.max(FLAT_PER_HOUR, Math.round(max * PCT_PER_HOUR));

/** Bring the ledger up to now. Mutates. */
export function settle(s: Save, now = Date.now()) {
  const v = s.vitals;
  const max = maxima(s);
  if (v.at === null || v.hp === null || v.mp === null) {
    v.hp = max.hp;
    v.mp = max.mp;
    v.at = now;
    return v;
  }
  const hours = Math.max(0, (now - v.at) / HOUR);
  v.hp = Math.min(max.hp, v.hp + perHour(max.hp) * hours);
  v.mp = Math.min(max.mp, v.mp + perHour(max.mp) * hours);
  v.fatigue = Math.max(0, v.fatigue - FATIGUE_PER_HOUR * hours);
  v.at = now;
  if (v.lockedUntil && now >= v.lockedUntil) v.lockedUntil = null;
  return v;
}

/** What a screen shows, settled but without writing. */
export function read(s: Save, now = Date.now()) {
  const max = maxima(s);
  const v = s.vitals;
  const hours = v.at === null ? 0 : Math.max(0, (now - v.at) / HOUR);
  const hp = v.hp === null ? max.hp : Math.min(max.hp, v.hp + perHour(max.hp) * hours);
  const mp = v.mp === null ? max.mp : Math.min(max.mp, v.mp + perHour(max.mp) * hours);
  const fatigue = Math.max(0, v.fatigue - FATIGUE_PER_HOUR * hours);
  const locked = !!(v.lockedUntil && now < v.lockedUntil);
  return {
    hp: Math.floor(hp),
    hpMax: max.hp,
    mp: Math.floor(mp),
    mpMax: max.mp,
    fatigue: Math.round(fatigue),
    drag: drag(fatigue),
    locked,
    lockedFor: locked ? v.lockedUntil! - now : 0,
  };
}

/** At the cap you fight at half strength. */
export const drag = (fatigue: number) => 1 - Math.min(FATIGUE_MAX, fatigue) / 200;

export function worn(base: Attrs, fatigue: number): Attrs {
  const k = drag(fatigue);
  const out = { ...base };
  for (const key of Object.keys(out) as (keyof Attrs)[]) out[key] = Math.max(1, Math.round(base[key] * k * 100) / 100);
  return out;
}

export function spendMp(s: Save, cost: number, now = Date.now()): boolean {
  settle(s, now);
  if ((s.vitals.mp ?? 0) < cost) return false;
  s.vitals.mp = (s.vitals.mp ?? 0) - cost;
  return true;
}

export function heal(s: Save, frac: number, now = Date.now()) {
  settle(s, now);
  const max = maxima(s).hp;
  const was = s.vitals.hp ?? max;
  s.vitals.hp = clamp(was + max * frac, 0, max);
  return Math.round(s.vitals.hp - was);
}

export function restore(s: Save, frac: number, now = Date.now()) {
  settle(s, now);
  const max = maxima(s).mp;
  const was = s.vitals.mp ?? max;
  s.vitals.mp = clamp(was + max * frac, 0, max);
  return Math.round(s.vitals.mp - was);
}

export function ease(s: Save, n: number, now = Date.now()) {
  settle(s, now);
  const was = s.vitals.fatigue;
  s.vitals.fatigue = Math.max(0, was - n);
  return Math.round(was - s.vitals.fatigue);
}

/** Lift the wipe lockout early. Returns the ms cut short. */
export function unlock(s: Save, now = Date.now()) {
  settle(s, now);
  const until = s.vitals.lockedUntil;
  if (!until || now >= until) return 0;
  s.vitals.lockedUntil = null;
  return until - now;
}

export function canRaid(s: Save, now = Date.now()): { ok: true } | { ok: false; why: 'locked' | 'down'; ms?: number } {
  const v = read(s, now);
  if (v.locked) return { ok: false, why: 'locked', ms: v.lockedFor };
  if (v.hp <= 0) return { ok: false, why: 'down' };
  return { ok: true };
}

/** Fatigue is charged once, on the way in. */
export function addRaidFatigue(s: Save, rank: string, now = Date.now()) {
  settle(s, now);
  s.vitals.fatigue = Math.min(FATIGUE_MAX, s.vitals.fatigue + (RAID_FATIGUE[rank] ?? 10));
}

/** Write the hunter's raid health back as a fraction of their real maximum. */
export function setHpFraction(s: Save, frac: number, now = Date.now()) {
  settle(s, now);
  s.vitals.hp = clamp(Math.round(maxima(s).hp * frac), 0, maxima(s).hp);
}

/** A party wipe: carried out, and locked out for a while. */
export function wipe(s: Save, now = Date.now()) {
  settle(s, now);
  s.vitals.hp = 0;
  s.vitals.lockedUntil = now + WIPE_LOCK;
}
