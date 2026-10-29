/**
 * The save: defaults, migration, and the importer for saves from the original
 * app (ARISE 5.x, localStorage key `arise.save.v1`).
 *
 * Adding a field with a sensible default needs no migration: `merge` fills it
 * in. Bump SAVE_VERSION and add a step only when existing data must change shape.
 */
import * as boon from './boon';
import { gearDef, make } from './gear';
import type { Save } from './types';
import { STATS } from './types';
import { dayKey } from './util';
import { EXERCISES } from '@/data/exercises';
import { classById } from '@/data/classes';

export const SAVE_VERSION = 1;
export const STORAGE_KEY = 'arise:save';
export const BACKUP_KEY = 'arise:backup';
export const LEGACY_KEY = 'arise.save.v1';

export function defaults(): Save {
  return {
    v: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    onboarded: false,
    hunter: {
      name: 'HUNTER', regNo: '', level: 1, xp: 0,
      attrs: { STR: 5, AGI: 5, PER: 5, VIT: 5, INT: 5 },
      points: 0, classId: null, missions: [],
    },
    profile: {
      goal: 'muscle', experience: 'novice', days: 3, minutes: 45,
      equipment: [], limitations: [], focus: 'balanced', age: 28, weight: 75,
    },
    program: null,
    templates: [],
    lifts: {},
    session: null,
    history: [],
    training: { certified: false, excluded: [] },
    daily: { date: null, quest: null, cleared: false, penalty: null },
    questDays: [],
    streak: { current: 0, best: 0, lastDay: null },
    boon: boon.blank(),
    vitals: { hp: null, mp: null, fatigue: 0, at: null, lockedUntil: null },
    wallet: { shards: 0, earned: 0, spent: 0 },
    items: [],
    equipped: {},
    favourites: [],
    found: [],
    gates: {
      clears: 0, fails: 0, withdrawn: 0, cleared: [], sealed: { day: null, ids: [] },
      runs: {}, raid: null, met: [], together: {}, bosses: [],
    },
    shadows: { army: [], squad: [], fresh: [] },
    shop: { day: null, taken: [] },
    log: [],
    story: [],
    seen: [],
    flags: { hollow: false, ignoredPlan: false },
    licence: { granted: false, at: null, tx: null },
    stats: {
      questsCleared: 0, questsFailed: 0, penaltiesCleared: 0, sessions: 0,
      totalReps: 0, totalSeconds: 0, totalMeters: 0, totalVolumeKg: 0,
      earlyClears: 0, comebacks: 0, prevBestStreak: 0, perfectDays: 0, xpTotal: 0,
      boons: 0, boonPoints: 0, boonsMissed: 0, extractions: 0, extractionsWon: 0,
      killsByFamily: {}, programRuns: 0, templateRuns: 0,
    },
    settings: {
      sound: true, music: true, haptics: true, units: 'kg', autoRest: true, fastText: false,
      reminders: { on: false, at: '10:00', lastCall: true, refresh: true },
    },
  };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Deep-merge a saved object over the defaults. Arrays and scalars are taken
 * whole; keys the defaults do not name are kept, because many save fields are
 * records keyed by id (equipped slots, lift ledgers, gate tallies).
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

const MIGRATIONS: Record<number, (s: Obj) => Obj> = {};

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
  if (isLegacy(raw)) return fromLegacy(raw);
  return merge(defaults(), migrate(raw));
}

/** The original app's saves carry `association` and `tribute`, which this one does not. */
export const isLegacy = (raw: Obj) => 'association' in raw || 'tribute' in raw || ('inventory' in raw && !('items' in raw));

/**
 * Carry a save from the original app forward. Everything with an equivalent
 * comes across: level, attributes, points, streak, profile, stats, shards,
 * gear that still exists, Shadows, clears, Secret Missions. The programme is
 * re-forged on first open from the profile it was built on.
 */
export function fromLegacy(old: Obj): Save {
  const s = defaults();
  const g = (o: unknown, k: string): unknown => (isObj(o) ? o[k] : undefined);
  const num = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) ? x : d);
  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

  const h = old.hunter as Obj;
  s.onboarded = !!old.onboarded;
  s.createdAt = typeof old.createdAt === 'string' ? old.createdAt : s.createdAt;
  s.hunter.name = typeof h.name === 'string' ? h.name : s.hunter.name;
  s.hunter.regNo = typeof h.regNo === 'string' ? h.regNo : '';
  s.hunter.level = Math.max(1, num(h.level, 1));
  s.hunter.xp = Math.max(0, num(h.xp, 0));
  s.hunter.points = Math.max(0, num(h.points, 0));
  for (const k of STATS) s.hunter.attrs[k] = Math.max(1, num(g(h.attrs, k), 5));
  s.hunter.classId = typeof h.classId === 'string' && classById(h.classId) ? h.classId : null;
  s.hunter.missions = arr(h.achievements).filter((x): x is string => typeof x === 'string');

  const p = old.profile;
  if (isObj(p)) {
    s.profile = merge(s.profile, {
      goal: p.goal, experience: p.experience, days: p.days,
      minutes: num(p.minutes, 45) <= 30 ? 25 : num(p.minutes, 45) >= 60 ? 75 : 45,
      equipment: arr(p.equipment).filter((e) => e !== 'none'),
      limitations: arr(p.limitations).filter((e) => e !== 'none'),
      focus: p.bodyFocus, age: p.age, weight: p.weight,
    });
  }

  const t = old.training;
  s.training.certified = isObj(t) && arr(t.basic).length > 0;
  s.training.excluded = isObj(t) ? arr(t.excluded).filter((x): x is string => typeof x === 'string' && EXERCISES.some((e) => e.id === x)) : [];
  if (s.training.certified || old.program) {
    // A programme existed, so the intake was done; the week re-forges on first open.
    s.seen.push('intake');
  }

  s.streak = merge(s.streak, old.streak);
  s.daily = { date: null, quest: null, cleared: false, penalty: null };
  if (isObj(old.daily) && old.daily.date === dayKey()) {
    s.daily.date = old.daily.date as string;
    s.daily.cleared = !!old.daily.cleared;
  }
  s.flags.hollow = !!g(old.flags, 'hollow');
  s.flags.ignoredPlan = !!g(old.flags, 'ignoredPlan');

  s.wallet = merge(s.wallet, old.wallet);
  s.settings = merge(s.settings, old.settings);
  s.settings.fastText = !!g(old.settings, 'reducedStory');

  const st = old.stats;
  if (isObj(st)) {
    s.stats = merge(s.stats, st);
    s.stats.boons = num(st.tributes, 0);
    s.stats.boonPoints = num(st.tributePoints, 0);
    s.stats.boonsMissed = num(st.tributesMissed, 0);
    s.stats.programRuns = num(st.rynProgrammeRuns, 0);
    s.stats.templateRuns = num(st.ownProgrammeRuns, 0);
  }

  // Gear: keep every piece whose design still exists, re-rolled on its own id.
  const slotMap = old.equipped as Obj | undefined;
  for (const it of arr(old.inventory)) {
    if (!isObj(it) || typeof it.defId !== 'string' || typeof it.id !== 'string') continue;
    const defId = it.defId.replace(/^EQP-/, '');
    if (!gearDef(defId)) continue;
    s.items.push(make(defId, it.id));
    if (!s.found.includes(defId)) s.found.push(defId);
  }
  if (isObj(slotMap)) {
    for (const [k, id] of Object.entries(slotMap)) {
      if (typeof id === 'string' && s.items.some((i) => i.id === id)) (s.equipped as Obj)[k] = id;
    }
  }
  s.favourites = arr(old.favourites).filter((x): x is string => typeof x === 'string' && s.items.some((i) => i.id === x));

  // Gates and Shadows lived on the Association ledger.
  const a = old.association;
  if (isObj(a)) {
    s.gates.clears = num(a.clears, 0);
    s.gates.fails = num(a.fails, 0);
    s.gates.withdrawn = num(a.withdrawn, 0);
    s.gates.cleared = arr(a.cleared).filter((x): x is string => typeof x === 'string');
    s.gates.met = arr(a.met).filter((x): x is string => typeof x === 'string');
    s.gates.together = isObj(a.together) ? (a.together as Record<string, number>) : {};
    s.gates.bosses = arr(a.bosses).filter((x): x is string => typeof x === 'string');
    const log = isObj(old.shadowLog) ? old.shadowLog : {};
    arr(a.army).forEach((x, i) => {
      const enemyId = typeof x === 'string' ? x : isObj(x) && typeof x.id === 'string' ? x.id : null;
      if (!enemyId) return;
      const rec = g(log, enemyId);
      s.shadows.army.push({
        id: `sh-legacy-${i}`, enemyId, boundAt: dayKey(),
        out: num(g(rec, 'out'), 0), kills: num(g(rec, 'kills'), 0), bosses: num(g(rec, 'bosses'), 0),
      });
    });
    const squad = arr(a.squad);
    s.shadows.squad = s.shadows.army.filter((sh) => squad.includes(sh.enemyId)).map((sh) => sh.id);
  }
  s.story = arr(g(old.narrative, 'seen')).filter((x): x is string => typeof x === 'string');
  if (s.onboarded) s.seen.push('questWalk');
  if (isObj(old.licence) && old.licence.granted) s.licence = merge(s.licence, old.licence);
  s.questDays = [...new Set(arr(old.log).filter(isObj).filter((e) => e.kind === 'quest').map((e) => String(e.day)))].sort();
  s.log = arr(old.log)
    .filter(isObj)
    .map((e) => ({ day: String(e.day ?? dayKey()), kind: (e.kind === 'tribute' ? 'boon' : e.kind) as Save['log'][number]['kind'], name: String(e.name ?? ''), xp: num(e.xp, 0) }))
    .slice(0, 400);
  return s;
}
