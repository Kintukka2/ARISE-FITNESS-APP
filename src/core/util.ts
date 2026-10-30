/** Small pure helpers shared by the engine and the UI. No DOM in here. */

export const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** FNV-1a. Stable string hash for seeding. */
export function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export type Rand = () => number;

/** Mulberry32, seeded from a string or number. Same seed, same sequence. */
export function rng(seed: string | number): Rand {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(xs: readonly T[], r: Rand = Math.random): T => xs[Math.floor(r() * xs.length)];


export function weighted<T extends { w: number }>(xs: readonly T[], roll: number): T {
  let v = roll * sum(xs.map((x) => x.w));
  for (const x of xs) {
    v -= x.w;
    if (v <= 0) return x;
  }
  return xs[xs.length - 1];
}

// ------------------------------------------------------------------ calendar
// Day keys are local-time YYYY-MM-DD strings. The calendar is the device's.

export function dayKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** The Monday that starts the week a day falls in: weeks run Monday to Sunday, on the device's calendar. */
export function weekStart(key: string): string {
  return addDays(key, -((parseDay(key).getDay() + 6) % 7));
}

/** Until the next Monday's midnight. */
export function msUntilWeek(now: Date = new Date()): number {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7 - ((day.getDay() + 6) % 7));
  return next.getTime() - now.getTime();
}

export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Days since the epoch in local time, for rotating anything on a daily cadence. */
export function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// ------------------------------------------------------------------ format

export function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((x) => String(x).padStart(2, '0')).join(':');
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 10_000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
}

export const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');


export function whenDay(key: string, today = dayKey()): string {
  const gap = daysBetween(key, today);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Yesterday';
  const d = parseDay(key);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

let seq = 0;
/** A unique id, sortable by creation time within one device. */
export function uid(prefix = 'x'): string {
  seq = (seq + 1) % 1296;
  return prefix + Date.now().toString(36) + seq.toString(36).padStart(2, '0');
}
