/**
 * HP, MP and Fatigue: the raid economy. Spent by raiding, recovered on a
 * clock that runs while the app is closed.
 */
import type { Attrs, Save } from './types';
import { clamp } from './util';

const HOUR = 36e5;
const FLAT_PER_HOUR = 10;
export const PCT_PER_HOUR = 0.05;
export const FATIGUE_PER_HOUR = 5;
export const FATIGUE_MAX = 100;
export const RAID_FATIGUE: Record<string, number> = { E: 5, D: 8, C: 12, B: 16, A: 22, S: 30 };
/**
 * Carried out of a Gate: on your feet, barely. HP falls to this, never to 0, which is death, and Fatigue rises to its
 * most, so the next Gate is fought at half strength until it eases (the owner's call: no lockout; the hunter decides
 * when to go back in, and rests, or drinks, first).
 */
export const WIPE_HP = 1;

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
  // There is no lockout any more: an older save's lifts as it is read.
  v.lockedUntil = null;
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
  return {
    hp: Math.floor(hp),
    hpMax: max.hp,
    mp: Math.floor(mp),
    mpMax: max.mp,
    fatigue: Math.round(fatigue),
    drag: drag(fatigue),
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

/** Add fatigue, to the most there is. Returns what was added. Mutates. */
export function tire(s: Save, n: number, now = Date.now()) {
  settle(s, now);
  const was = s.vitals.fatigue;
  s.vitals.fatigue = Math.min(FATIGUE_MAX, was + n);
  return Math.round(s.vitals.fatigue - was);
}

export function ease(s: Save, n: number, now = Date.now()) {
  settle(s, now);
  const was = s.vitals.fatigue;
  s.vitals.fatigue = Math.max(0, was - n);
  return Math.round(was - s.vitals.fatigue);
}

/** Whether the hunter can walk into a Gate: only while they have HP. Nothing locks them out. */
export function canRaid(s: Save, now = Date.now()): { ok: true } | { ok: false; why: 'down' } {
  const v = read(s, now);
  if (v.hp <= 0) return { ok: false, why: 'down' };
  return { ok: true };
}

/** Fatigue is charged once, on the way in: a gate's grade's worth, times `share` (Ascension's Heavy Legs). */
export function addRaidFatigue(s: Save, rank: string, now = Date.now(), share = 1) {
  settle(s, now);
  s.vitals.fatigue = Math.min(FATIGUE_MAX, s.vitals.fatigue + Math.round((RAID_FATIGUE[rank] ?? 10) * share));
}

/** Write the hunter's raid health back as a fraction of their real maximum. */
export function setHpFraction(s: Save, frac: number, now = Date.now()) {
  settle(s, now);
  s.vitals.hp = clamp(Math.round(maxima(s).hp * frac), 0, maxima(s).hp);
}

/** A hunter who leaves a Gate leaves alive: their health never below `WIPE_HP`, downed in the last fight or not. Mutates. */
export function standUp(s: Save, now = Date.now()) {
  settle(s, now);
  s.vitals.hp = Math.max(WIPE_HP, s.vitals.hp ?? maxima(s).hp);
}

/** A party wipe: carried out with `WIPE_HP`, Fatigue at its most, and nothing locked. Mutates. */
export function wipe(s: Save, now = Date.now()) {
  settle(s, now);
  s.vitals.hp = WIPE_HP;
  s.vitals.fatigue = FATIGUE_MAX;
  s.vitals.lockedUntil = null;
}
