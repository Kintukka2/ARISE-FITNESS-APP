/**
 * The Pale Spire, beside the board. It is climbed a block at a time: five
 * floors, three of them choices, then a rest and a boss, played as a gate of
 * its own. Floor N is built for a hunter of Level N as far as the top floor,
 * and it keeps getting harder after that. The week's best floor is kept; the
 * week's end pays by how high it reached, and the climb starts again.
 */
import { DUNGEONS } from '@/data/dungeons';
import { BLOCK_TUNE, SPIRE_TUNE } from '@/data/gatetune';
import { BLOCK, SEASON_PAY, SPIRE_FLOORS, SPIRE_GROWTH, SPIRE_NAME, SPIRE_OPENS, SPIRE_THEME, SPIRE_TOP } from '@/data/spire';
import { grant, ofRank } from './gear';
import { licensedRank } from './licence';
import * as shop from './shop';
import type { Dungeon, Rank, Save, SeasonPay } from './types';
import { RANKS } from './types';
import { dayKey, rng, weekStart } from './util';

export const spireOpen = (s: Save) => s.gates.clears >= SPIRE_OPENS;

/** A week on the Spire is named for the Monday it began. */
export const seasonOf = (day: string) => weekStart(day);

export const floorGrade = (floor: number): Rank => [...RANKS].reverse().find((r) => floor >= SPIRE_FLOORS[r]) ?? 'E';
export const blockOf = (floor: number) => Math.floor((Math.max(1, floor) - 1) / BLOCK);
export const firstFloor = (b: number) => b * BLOCK + 1;
export const lastFloor = (b: number) => (b + 1) * BLOCK;
/** The level a block is built for: that of its middle floor. Above the top floor, it is built for nobody. */
export const builtFor = (b: number) => firstFloor(b) + Math.floor(BLOCK / 2);

const ID = /^SPR-(\d{4}-\d{2}-\d{2})-(\d+)$/;
export const isSpire = (d: { id: string }) => ID.test(d.id);

/** How much harder a block is than its grade's middle: calibrated to its level, and growing past the top. */
export function spireTune(b: number): number {
  const n = SPIRE_TUNE.length;
  if (!n) return 1;
  return b < n ? SPIRE_TUNE[b] : SPIRE_TUNE[n - 1] * SPIRE_GROWTH ** (b - n + 1);
}

/** The gate whose shape a block takes this week: one of its grade's. */
export function shapeOf(season: string, b: number): Dungeon {
  const pool = DUNGEONS.filter((d) => d.rank === floorGrade(firstFloor(b)));
  return pool[Math.floor(rng(`arise|spire|${season}|${b}`)() * pool.length)];
}

/** A block of the Spire in the shape of a gate: its creatures, its gatekeeper and its boss, over a block's floors. */
export function blockFrom(season: string, b: number, g: Dungeon): Dungeon {
  return {
    id: `SPR-${season}-${b}`, rank: floorGrade(firstFloor(b)), name: `${SPIRE_NAME} · Floors ${firstFloor(b)} to ${lastFloor(b)}`,
    theme: `${SPIRE_THEME} This week, Floors ${firstFloor(b)} to ${lastFloor(b)} match ${g.name}.`, identity: g.identity,
    mobs: g.mobs, elite: g.elite, boss: g.boss,
    // Choices, then the rest and the boss the map always ends on: a block's worth of floors.
    mobRounds: BLOCK - 2 - (g.elite ? 1 : 0),
    floor: firstFloor(b),
    shape: g.id,
    // As hard as that gate's creatures make a block at its grade's middle, then the Spire's own scaling.
    scale: (BLOCK_TUNE[g.id] ?? 1) * spireTune(b),
  };
}

/** One block of the Spire, as it stands this week until Monday. */
export const spireBlock = (season: string, b: number): Dungeon => blockFrom(season, b, shapeOf(season, b));

export function spireById(id: string): Dungeon | undefined {
  const m = ID.exec(id);
  return m ? spireBlock(m[1], Number(m[2])) : undefined;
}

/** The block the hunter climbs next: the one above their best this week, or their own grade's first, whichever is higher. */
export function nextBlock(s: Save, day = dayKey()): number {
  const best = s.spire.season === seasonOf(day) ? s.spire.best : 0;
  return blockOf(Math.max(best + 1, SPIRE_FLOORS[licensedRank(s)]));
}

export const nextSpire = (s: Save, day = dayKey()) => spireBlock(seasonOf(day), nextBlock(s, day));

/** This week's best floor, read without writing anything. */
export const weekBest = (s: Save, day = dayKey()) => (s.spire.season === seasonOf(day) ? s.spire.best : 0);

/** What a week that reached `best` pays when it closes. */
export function seasonTier(best: number): { tier: string; rank: Rank; shards: number } | null {
  if (best <= 0) return null;
  const beyond = best > SPIRE_TOP ? Math.ceil((best - SPIRE_TOP) / SEASON_PAY.beyond) : 0;
  const rank = floorGrade(best);
  return {
    tier: beyond ? `${rank}+${beyond}` : `${rank}-Rank`, rank,
    shards: shop.gateShards(rank, SEASON_PAY.shards * (1 + SEASON_PAY.step * beyond)),
  };
}

/** The first floor whose week pays a tier above one that reached `best`: the next grade's floors, then every `beyond` past the top. */
export function nextTier(best: number): number {
  const up = RANKS.find((r) => SPIRE_FLOORS[r] > best);
  if (up) return SPIRE_FLOORS[up];
  const past = best > SPIRE_TOP ? Math.ceil((best - SPIRE_TOP) / SEASON_PAY.beyond) : 0;
  return SPIRE_TOP + past * SEASON_PAY.beyond + 1;
}

/**
 * The week's next goal: the floor where the next tier begins, counted from where the hunter climbs
 * from this week, so a hunter who starts above the first floors is never set one below them.
 */
export const tierGoal = (s: Save, day = dayKey()) => nextTier(Math.max(weekBest(s, day), firstFloor(nextBlock(s, day)) - 1));

/**
 * Close the week if a new one has begun: pay what the last one reached, once,
 * and start the climb over. Null when nothing closed. Mutates.
 */
export function settle(s: Save, now = Date.now()): SeasonPay | null {
  const season = seasonOf(dayKey(now));
  if (s.spire.season === season) return null;
  const was = s.spire.season;
  const best = s.spire.best;
  s.spire.season = season;
  s.spire.best = 0;
  const pay = was ? seasonTier(best) : null;
  if (!was || !pay) return null;
  const pool = ofRank(pay.rank);
  const def = pool[Math.floor(rng(`arise|season|${was}|${s.hunter.regNo}`)() * pool.length)];
  const item = def ? grant(s, def.id, `season|${was}`) : null;
  s.spire.seasons++;
  s.spire.last = { season: was, best, tier: pay.tier, shards: shop.earn(s, pay.shards), item: item?.defId ?? null };
  return s.spire.last;
}

/**
 * A block cleared: the week's best rises to its top floor, as long as the
 * week it was entered in is still this one. Mutates.
 */
export function climbed(s: Save, d: Dungeon, now = Date.now()): { floor: number; best: boolean } {
  const m = ID.exec(d.id);
  const floor = m ? lastFloor(Number(m[2])) : 0;
  settle(s, now);
  if (!m || m[1] !== s.spire.season) return { floor, best: false };
  const best = floor > s.spire.best;
  s.spire.best = Math.max(s.spire.best, floor);
  s.spire.top = Math.max(s.spire.top, floor);
  return { floor, best };
}
