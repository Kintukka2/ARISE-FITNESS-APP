/**
 * The Gate board and the hunters the Association sends in with you.
 *
 * Ten gates stand open at a time: one of every grade so the whole ladder is
 * visible, at least two at the hunter's own, the rest at random. A gate up to
 * one grade above your own can be entered. Clearing one closes it, and
 * another of the same grade opens in its place; the board redraws at
 * midnight. Fatigue, not the board, is what paces a hunter.
 */
import { DUNGEONS } from '@/data/dungeons';
import { ENEMIES } from '@/data/enemies';
import { HOLLOW_MONARCH, HOLLOW_THRONE, PRACTICE_GATE } from '@/data/special';
import { licensedRank } from './licence';
import { isSpire, spireById } from './spire';
import type { Attrs, Dungeon, Enemy, Rank, Save } from './types';
import { RANKS, STATS } from './types';
import { dayKey, hash, rng, weighted } from './util';
import * as vitals from './vitals';

export const OPEN_PER_DAY = 10;
const MIN_AT_RANK = 2;

const enemyMap = new Map<string, Enemy>([...ENEMIES, HOLLOW_MONARCH].map((e) => [e.id, e]));
export const enemyById = (id: string) => enemyMap.get(id);
export const ALL_ENEMIES = ENEMIES;

const dungeonMap = new Map<string, Dungeon>([...DUNGEONS, HOLLOW_THRONE, PRACTICE_GATE].map((d) => [d.id, d]));
/** A gate by id: one on file, or a block of the Spire, which is drawn from its id. */
export const dungeonById = (id: string) => dungeonMap.get(id) ?? spireById(id);
export const ALL_DUNGEONS = DUNGEONS;
export { HOLLOW_THRONE, PRACTICE_GATE };

export const isPractice = (d: Dungeon) => d.id === PRACTICE_GATE.id;
export const rankIdx = (r: string) => RANKS.indexOf(r as Rank);

/**
 * The grade of each of today's ten slots. Deterministic per day and grade:
 * one of every grade, then your own until there are two, then grades drawn
 * the way the dungeons are spread.
 */
function slotGrades(mine: Rank, day: string): Rank[] {
  const r = rng('arise|gates|' + day);
  const out: Rank[] = [...RANKS];
  while (out.filter((g) => g === mine).length < MIN_AT_RANK) out.push(mine);
  while (out.length < OPEN_PER_DAY) out.push(DUNGEONS[Math.floor(r() * DUNGEONS.length)].rank as Rank);
  return out;
}

/** One grade's gates in today's order. The board shows them from the front. */
export function dayOrder(g: Rank, day: string): string[] {
  const r = rng(`arise|order|${day}|${g}`);
  return DUNGEONS.filter((d) => d.rank === g).map((d) => ({ id: d.id, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.id);
}

/** The gates of a grade every hunter of that grade finds open when the day starts. */
export const opening = (g: Rank, day: string): Dungeon[] => dayOrder(g, day).slice(0, MIN_AT_RANK).map((id) => dungeonById(id)!);

/**
 * Today's board, in grade order. Each grade has one shuffled order for the
 * day; its slots show the first gates in that order not cleared today, so a
 * clear swaps in the next one and leaves the others where they are. Once a
 * grade runs out, its cleared gates open again.
 */
export function board(s: Save, day = dayKey()): Dungeon[] {
  const shut = s.gates.sealed.day === day ? s.gates.sealed.ids : [];
  const grades = slotGrades(licensedRank(s), day);
  const picked: string[] = [];
  for (const g of RANKS) {
    const order = dayOrder(g, day);
    const open = [...order.filter((id) => !shut.includes(id)), ...order.filter((id) => shut.includes(id))];
    picked.push(...open.slice(0, grades.filter((x) => x === g).length));
  }
  const out = DUNGEONS.filter((d) => picked.includes(d.id));
  if (licensedRank(s) === 'S' && !s.gates.cleared.includes(HOLLOW_THRONE.id)) out.push(HOLLOW_THRONE);
  if (!s.gates.cleared.includes(PRACTICE_GATE.id)) out.unshift(PRACTICE_GATE);
  return out;
}

/** Close a cleared gate for the rest of the day: it leaves the board, and another of its grade takes its slot. */
export function seal(s: Save, d: Dungeon, day = dayKey()) {
  if (s.gates.sealed.day !== day) s.gates.sealed = { day, ids: [] };
  if (!s.gates.sealed.ids.includes(d.id)) s.gates.sealed.ids.push(d.id);
}

/** Up to one grade above your own: the "taster". */
export const licensedFor = (s: Save, d: Dungeon) => rankIdx(d.rank) <= rankIdx(licensedRank(s)) + 1;

export type EntryBlock = 'licence' | 'open' | 'locked' | 'down';

export function entryBlock(s: Save, d: Dungeon, now = Date.now()): EntryBlock | null {
  if (!licensedFor(s, d)) return 'licence';
  // A run left open is gone back into or abandoned, never entered again: that would write over it unsettled.
  if (s.gates.raid) return 'open';
  const can = vitals.canRaid(s, now);
  return can.ok ? null : can.why;
}

/** Whether the boss has been seen: cleared, or reached. */
export const bossKnown = (s: Save, d: Dungeon) => s.gates.bosses.includes(d.id) || s.gates.cleared.includes(d.id) || isPractice(d) || isSpire(d);

// ------------------------------------------------------------------ allies

const GIVEN = ['Haneul', 'Seora', 'Minjae', 'Dohyun', 'Yerin', 'Taeyang', 'Sunho', 'Jihye', 'Kanghee', 'Naeun', 'Junseo',
  'Miyeon', 'Sanghoon', 'Eunwoo', 'Hyejin', 'Doyun', 'Sori', 'Jaemin', 'Areum', 'Seojun', 'Nari', 'Hyunwoo', 'Boram',
  'Yuna', 'Jiwon', 'Marek', 'Ilse', 'Tomas', 'Renata', 'Osei', 'Amara', 'Dmitri', 'Freya', 'Kaito', 'Noor', 'Emeka',
  'Sanne', 'Rafael', 'Zaina', 'Lukas', 'Priya', 'Idris', 'Marta', 'Yusuf', 'Elena', 'Teo', 'Ines', 'Wren', 'Soren', 'Mina'];
const FAMILY = ['Baek', 'Seo', 'Hwang', 'Jung', 'Lim', 'Go', 'Nam', 'Yoo', 'Han', 'Song', 'Oh', 'Kwon', 'Shin', 'Bae', 'Moon',
  'Ryu', 'Ahn', 'Jang', 'Noh', 'Adeyemi', 'Kowalski', 'Okonjo', 'Vance', 'Halloran', 'Draken', 'Sood', 'Ferreira',
  'Nakamura', 'Osman', 'Lindqvist', 'Marchetti', 'Achterberg'];
const ROLES = [
  { key: 'Brute', w: 22, fav: ['STR', 'VIT'] },
  { key: 'Guardian', w: 16, fav: ['VIT', 'STR'] },
  { key: 'Assassin', w: 14, fav: ['AGI', 'PER'] },
  { key: 'Caster', w: 14, fav: ['INT', 'PER'] },
  { key: 'Archer', w: 12, fav: ['AGI', 'PER'] },
  { key: 'Hexer', w: 8, fav: ['INT', 'PER'] },
  { key: 'Leader', w: 6, fav: ['PER', 'VIT', 'INT'] },
];

/** Total attribute points a hunter of each grade carries. */
export const BANDS: Record<Rank, [number, number]> = { E: [15, 50], D: [51, 100], C: [101, 175], B: [176, 275], A: [276, 375], S: [376, 500] };

export interface Ally {
  id: string; name: string; rank: Rank; role: string; base: Attrs; note?: string;
  /** Below 1, a hunter who is holding back: they take the hits and leave the kills to you. */
  atkMult?: number;
}

/** How hard Valcorde hits in the practice gate. He is there to keep you alive, not to clear it for you. */
export const INSTRUCTOR_RESTRAINT = 0.08;

/** Where in their grade's band the Association's hunters sit. They are support; you are the one being watched. */
export const ALLY_TUNE = { center: 0.35, spread: 0.4, tierUp: [75, 19, 5, 1] };

export function hunter(id: string, rank: Rank, spread = ALLY_TUNE.spread, center = ALLY_TUNE.center): Ally {
  const r = rng('arise|hunter|' + id);
  const name = `${GIVEN[Math.floor(r() * GIVEN.length)]} ${FAMILY[Math.floor(r() * FAMILY.length)]}`;
  const role = weighted(ROLES, r());
  const band = BANDS[rank];
  const total = Math.round(band[0] + (center - spread / 2 + r() * spread) * (band[1] - band[0]));
  const w = Object.fromEntries(STATS.map((k) => [k, 1 + r() * 0.25 + (role.fav.includes(k) ? 1.3 : 0)])) as Attrs;
  const tw = STATS.reduce((n, k) => n + w[k], 0);
  const base = Object.fromEntries(STATS.map((k) => [k, Math.max(1, Math.floor((total * w[k]) / tw))])) as Attrs;
  const order = STATS.slice().sort((a, b) => w[b] - w[a]);
  for (let i = 0, left = total - STATS.reduce((n, k) => n + base[k], 0); left > 0; i++, left--) base[order[i % order.length]] += 1;
  return { id, name, rank, role: role.key, base };
}

/** Odds that an ally is drawn one, two or three grades above the gate. */
const tierUp = () => ALLY_TUNE.tierUp.map((w, up) => ({ up, w }));
export const PARTY_MIN = 3;
export const PARTY_MAX = 3;

/**
 * The hunters sent in with you: fixed per gate per day, drawn at your grade
 * (or the gate's, if that is lower). Reaching above your grade means going
 * in with people who are not ready for it either.
 */
export function allies(d: Dungeon, day = dayKey(), yours: Rank = d.rank as Rank): Ally[] {
  if (isPractice(d)) {
    return [
      { ...hunter('HTR-RYN', 'S', 0, 0.5), id: 'HTR-RYN', name: 'Ryn Valcorde', role: 'Leader', note: 'Your instructor', atkMult: INSTRUCTOR_RESTRAINT },
      hunter('HTR-PRACTICE-1', 'E'),
    ];
  }
  const r = rng(`arise|party|${d.id}|${day}`);
  const n = PARTY_MIN + Math.floor(r() * (PARTY_MAX - PARTY_MIN + 1));
  const at = Math.min(rankIdx(d.rank), rankIdx(yours));
  const out: Ally[] = [];
  let under = 0;
  // Reaching above your grade, the Association sends one escort of the gate's own grade.
  if (rankIdx(d.rank) > at) out.push({ ...hunter(`HTR-${d.rank}-ESC-${d.id}-${day}`, d.rank as Rank), note: 'Escort' });
  for (let i = out.length; i < n; i++) {
    let step = weighted(tierUp(), r()).up;
    if (at > 0 && under < 1 && r() < 0.25) { step = -1; under++; }
    const grade = RANKS[Math.max(0, Math.min(5, at + step))];
    const id = `HTR-${grade}-${String(1 + Math.floor(r() * 900)).padStart(3, '0')}`;
    if (out.some((a) => a.id === id)) continue;
    out.push(hunter(id, grade));
  }
  return out.sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank));
}

export const regNo = (seed: string) => 'E-' + String(hash(seed + '|arise')).padStart(6, '0').slice(0, 6);
