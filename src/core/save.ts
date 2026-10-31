/**
 * The save: defaults and migration.
 *
 * Adding a field with a sensible default needs no migration: `merge` fills it
 * in. Bump SAVE_VERSION and add a step only when existing data must change shape.
 *
 * The keys are this game's own. The fitness app this was carved from kept
 * `arise:save`; a phone that has both never mixes them up.
 */
import type { Save } from './types';

export const SAVE_VERSION = 2;
export const STORAGE_KEY = 'arise-rpg:save';
export const BACKUP_KEY = 'arise-rpg:backup';

export function defaults(): Save {
  return {
    v: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    onboarded: false,
    hunter: {
      name: 'HUNTER', regNo: '', level: 1, xp: 0,
      attrs: { STR: 5, AGI: 5, PER: 5, VIT: 5, INT: 5 },
      points: 0, classId: null, missions: [], picks: {},
    },
    vitals: { hp: null, mp: null, fatigue: 0, at: null, lockedUntil: null },
    wallet: { shards: 0, earned: 0, spent: 0, bought: 0, receipts: [] },
    items: [],
    equipped: {},
    favourites: [],
    found: [],
    gates: {
      clears: 0, fails: 0, withdrawn: 0, cleared: [], sealed: { day: null, ids: [] },
      runs: {}, raid: null, met: [], together: {}, bosses: [],
      last: null, unbroken: 0, bestUnbroken: 0, tactic: 'default',
    },
    shadows: { army: [], squad: [], fresh: [] },
    shop: { day: null, taken: [] },
    contracts: { day: null, grade: 'E', list: [], bonus: false },
    spire: { season: null, best: 0, top: 0, seasons: 0, last: null },
    ascension: { level: 0, unlocked: 0, best: 0, proof: { gates: [], spire: false } },
    satchel: 0,
    log: [],
    story: [],
    seen: [],
    licence: { granted: false, at: null, tx: null },
    stats: { xpTotal: 0, extractions: 0, extractionsWon: 0, killsByFamily: {}, reachClears: 0, comebacks: 0, contracts: 0, contractDays: 0 },
    settings: { sound: true, music: true, haptics: true, fastText: false, reminders: { on: false } },
  };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Deep-merge a saved object over the defaults. Arrays and scalars are taken
 * whole; keys the defaults do not name are kept, because many save fields are
 * records keyed by id (equipped slots, gate tallies, kills by family).
 */
export function merge<T>(base: T, saved: unknown): T {
  if (saved === undefined || saved === null) return base;
  if (base === null || base === undefined) return saved as T;
  if (!isObj(base)) return (Array.isArray(base) === Array.isArray(saved) && typeof saved === typeof base ? saved : base) as T;
  if (!isObj(saved)) return base;
  const out: Obj = { ...saved };
  for (const k of Object.keys(base as Obj)) out[k] = merge((base as Obj)[k], saved[k]);
  return out as T;
}

const MIGRATIONS: Record<number, (s: Obj) => Obj> = {
  // v2: a gate is a map, not a straight line. A run left open across the change starts its map
  // from the beginning, as it stood, unless it had already lost a chamber: then it is lost.
  1: (s) => {
    const raid = isObj(s.gates) ? s.gates.raid : null;
    if (isObj(raid) && !Array.isArray(raid.path)) {
      const lost = typeof raid.won === 'number' && typeof raid.at === 'number' && raid.won < raid.at;
      Object.assign(raid, { map: `${raid.dungeonId}|${raid.day}`, path: [], haul: [], purse: 0, blessings: [], lost, at: 0, orders: [] });
    }
    return s;
  },
};

export function migrate(raw: Obj): Obj {
  let v = typeof raw.v === 'number' ? raw.v : 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) break;
    raw = step(raw);
    v += 1;
    raw.v = v;
  }
  return raw;
}

/** Parse a stored or imported JSON string into a current save. Null if it is not one. */
export function parse(json: string): Save | null {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return null; }
  if (!isObj(raw) || !isObj(raw.hunter)) return null;
  return merge(defaults(), migrate(raw));
}
