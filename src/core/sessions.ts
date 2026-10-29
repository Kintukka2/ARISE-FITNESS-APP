/**
 * The session lifecycle. Ticking a set only changes the session; every
 * reward — experience, the Boon ledger, lifetime totals, lift records,
 * programme adaptation — is settled once, at finish, from what was logged.
 */
import { ISSUED } from '@/data/equipment';
import { exById, hurts, owns, available } from './exercises';
import * as boon from './boon';
import * as coach from './coach';
import { autoEquip, grant } from './gear';
import * as lifts from './lifts';
import { basicAward, grantXP, type XpResult } from './progression';
import type { ActiveSession, Save, SessionItem, Slot } from './types';
import { dayKey, uid } from './util';

// ------------------------------------------------------------------ Basic Hunter Training

const BASIC_PICKS = [
  { ids: ['pushup', 'incline_pushup', 'knee_pushup'], reps: 5, secs: 20 },
  { ids: ['bw_squat', 'wall_sit', 'crunch'], reps: 8, secs: 20 },
  { ids: ['plank', 'dead_bug', 'bird_dog'], reps: 8, secs: 20 },
];

export const BASIC_TITLE = 'Basic Hunter Training';
export const BASIC_BRIEF = 'Three movements, three sets each. Small numbers. You are here to learn where the buttons are, and I will talk you through them while you do it.';

/** The three movements, resolved against what the hunter can do. Never prescribes what hurts. */
export function basicSlots(s: Save): Slot[] {
  const { equipment, limitations } = s.profile;
  const ok = (id: string, used: string[]) => {
    const ex = exById(id);
    return !!ex && ex.tier === 1 && !used.includes(id) && owns(ex, equipment) && !hurts(ex, limitations);
  };
  const used: string[] = [];
  return BASIC_PICKS.map((p) => {
    let id = p.ids.find((x) => ok(x, used));
    if (!id) {
      const pattern = exById(p.ids[0])!.pattern;
      id = available(equipment, limitations, 1).find((x) => x.pattern === pattern && !used.includes(x.id))?.id
        ?? available(equipment, limitations, 1).find((x) => !x.flags.length && !used.includes(x.id))?.id
        ?? p.ids[p.ids.length - 1];
    }
    used.push(id);
    const ex = exById(id)!;
    return { exId: id, sets: 3, target: ex.unit === 'sec' ? p.secs : ex.unit === 'm' ? p.reps * 40 : p.reps, rest: ex.unit === 'sec' ? 45 : 60, load: false };
  });
}

// ------------------------------------------------------------------ starting

function itemsFrom(s: Save, slots: Slot[]): SessionItem[] {
  return slots.map((sl) => {
    const weight = sl.load ? sl.weight ?? lifts.lastWeight(s, sl.exId) : null;
    return { ...sl, log: Array.from({ length: Math.max(1, sl.sets) }, () => ({ target: sl.target, done: sl.target, weight, ok: false })) };
  });
}

function open(kind: ActiveSession['kind'], ref: string | null, title: string, subtitle: string, items: SessionItem[], now: number): ActiveSession {
  return { id: uid('ss'), kind, ref, title, subtitle, startedAt: now, activeMs: 0, lastTick: now, restEndsAt: null, restSpan: 0, items, at: 0, taught: [] };
}

export function startBasic(s: Save, now = Date.now()): ActiveSession {
  s.session = open('basic', null, BASIC_TITLE, 'Learning the ropes', itemsFrom(s, basicSlots(s)), now);
  return s.session;
}

export function startProgram(s: Save, dayId: string, now = Date.now()): ActiveSession | null {
  const day = s.program?.days.find((d) => d.id === dayId);
  if (!day) return null;
  s.session = open('program', day.id, day.name, `Week ${s.program!.week}${s.program!.deload ? ' · Deload' : ''}`, itemsFrom(s, day.slots), now);
  return s.session;
}

export function startTemplate(s: Save, id: string, now = Date.now()): ActiveSession | null {
  const t = s.templates.find((x) => x.id === id);
  if (!t || !t.slots.length) return null;
  s.session = open('template', t.id, t.name, `Your programme · run ${t.runs + 1}`, itemsFrom(s, t.slots), now);
  return s.session;
}

// ------------------------------------------------------------------ during

/** Count time in the player, ignoring gaps longer than half a minute (the app was closed). */
export function tick(sess: ActiveSession, now = Date.now()) {
  sess.activeMs += Math.max(0, Math.min(now - sess.lastTick, 30_000));
  sess.lastTick = now;
}

export function toggleSet(sess: ActiveSession, item: number, set: number): boolean {
  const row = sess.items[item]?.log[set];
  if (!row) return false;
  row.ok = !row.ok;
  return row.ok;
}

export function addSet(sess: ActiveSession, item: number) {
  const it = sess.items[item];
  if (!it) return;
  const last = it.log[it.log.length - 1];
  it.log.push({ target: it.target, done: it.target, weight: last?.weight ?? null, ok: false });
}

export function removeSet(sess: ActiveSession, item: number, set: number) {
  const it = sess.items[item];
  if (it && it.log.length > 1) it.log.splice(set, 1);
}

/** Replace an exercise mid-session with a fresh prescription for the new one. */
export function swap(s: Save, sess: ActiveSession, item: number, exId: string) {
  const ex = exById(exId);
  const it = sess.items[item];
  if (!ex || !it) return;
  const slot = coach.slotFor(s, ex);
  const weight = slot.load ? lifts.lastWeight(s, exId) : null;
  sess.items[item] = { ...slot, sets: it.log.length, log: it.log.map(() => ({ target: slot.target, done: slot.target, weight, ok: false })) };
}

export const itemDone = (it: SessionItem) => it.log.every((x) => x.ok);
export const setsTicked = (sess: ActiveSession) => sess.items.reduce((n, it) => n + it.log.filter((x) => x.ok).length, 0);

export function startRest(sess: ActiveSession, seconds: number, now = Date.now()) {
  sess.restEndsAt = now + seconds * 1000;
  sess.restSpan = seconds;
}

// ------------------------------------------------------------------ finishing

/** Rep-equivalents: reps as is, seconds / 3, metres / 50. */
function volume(unit: string, n: number) {
  return unit === 'sec' ? n / 3 : unit === 'm' ? n / 50 : n;
}

export function sessionXp(completed: number, setsDone: number) {
  return Math.round(40 + completed * 0.55 + setsDone * 9);
}

/** The second session of a day pays 60%, the third and on 30%. Repeats are allowed; farming is not. */
export function repeatFactor(s: Save, day = dayKey()) {
  const today = s.log.filter((e) => e.kind === 'session' && e.day === day).length;
  return today === 0 ? 1 : today === 1 ? 0.6 : 0.3;
}

export interface SessionReport {
  kind: ActiveSession['kind'];
  title: string;
  minutes: number;
  setsDone: number;
  setsAsked: number;
  exercises: number;
  ratio: number;
  reps: number;
  seconds: number;
  metres: number;
  loadKg: number;
  xp: XpResult;
  repeat: number;
  adapt: ReturnType<typeof coach.adapt> | null;
  prs: lifts.PR[];
  boonSets: number;
  certified: boolean;
  kit: string[];
}

/** Settle the session. `rating` is only read for programme sessions. Mutates. */
export function finish(s: Save, sess: ActiveSession, rating: coach.Rating | null, now = Date.now()): SessionReport {
  tick(sess, now);
  const day = dayKey(now);
  let prescribed = 0, completed = 0, setsDone = 0, setsAsked = 0, reps = 0, seconds = 0, metres = 0, loadKg = 0;
  const prs: lifts.PR[] = [];
  for (const it of sess.items) {
    const ex = exById(it.exId);
    if (!ex) continue;
    setsAsked += it.log.length;
    for (const row of it.log) {
      prescribed += volume(ex.unit, row.target);
      if (!row.ok) continue;
      setsDone++;
      completed += volume(ex.unit, row.done);
      if (ex.unit === 'reps') reps += row.done;
      else if (ex.unit === 'sec') seconds += row.done;
      else metres += row.done;
      if (row.weight) loadKg += row.weight * row.done;
    }
    const ticked = it.log.filter((x) => x.ok).length;
    if (ticked) boon.log(s, it.exId, ticked, day);
    prs.push(...lifts.log(s, it.exId, it.log, day));
  }
  s.stats.totalReps += reps;
  s.stats.totalSeconds += seconds;
  s.stats.totalMeters += metres;
  s.stats.totalVolumeKg += Math.round(loadKg);
  s.stats.sessions += 1;

  const ratio = prescribed > 0 ? completed / prescribed : 1;
  const minutes = Math.max(1, Math.round(sess.activeMs / 60000));
  const repeat = sess.kind === 'basic' ? 1 : repeatFactor(s, day);
  let adapt: SessionReport['adapt'] = null;
  let xp: XpResult;
  let certified = false;
  const kit: string[] = [];

  if (sess.kind === 'basic') {
    certified = !s.training.certified;
    s.training.certified = true;
    // Exactly the shortfall to Level 5, untouched by multipliers: you walk out at Level 5.
    xp = grantXP(s, basicAward(s), { raw: true });
    for (const d of ISSUED) {
      if (s.items.some((i) => i.defId === d.id)) continue;
      grant(s, d.id);
      kit.push(d.id);
    }
    autoEquip(s);
  } else {
    xp = grantXP(s, Math.round(sessionXp(completed, setsDone) * repeat));
    if (sess.kind === 'program' && s.program) {
      s.stats.programRuns += 1;
      if (sess.ref && !s.program.completed.includes(sess.ref)) s.program.completed.push(sess.ref);
      const daySlots = s.program.days.find((d) => d.id === sess.ref)?.slots ?? [];
      for (const it of sess.items) {
        const w = Math.max(0, ...it.log.filter((x) => x.ok).map((x) => x.weight ?? 0));
        for (const sl of daySlots) if (sl.exId === it.exId && w > 0) sl.weight = w;
      }
      adapt = coach.adapt(s, ratio, rating ?? 'right');
    } else if (sess.kind === 'template') {
      s.stats.templateRuns += 1;
      const t = s.templates.find((x) => x.id === sess.ref);
      if (t) {
        t.runs += 1;
        t.lastRun = day;
        for (const it of sess.items) {
          const w = Math.max(0, ...it.log.filter((x) => x.ok).map((x) => x.weight ?? 0));
          for (const sl of t.slots) if (sl.exId === it.exId && w > 0) sl.weight = w;
        }
      }
    }
  }

  const patterns: Record<string, number> = {};
  for (const it of sess.items) {
    const p = exById(it.exId)?.pattern ?? 'other';
    const n = it.log.filter((x) => x.ok).length;
    if (n) patterns[p] = (patterns[p] ?? 0) + n;
  }
  s.history.unshift({ day, kind: sess.kind, title: sess.title, minutes, sets: setsDone, setsAsked, ratio, rating: sess.kind === 'program' ? rating ?? 'right' : null, patterns, xp: xp.gained });
  s.history.length = Math.min(s.history.length, 300);
  s.log.unshift({ day, kind: 'session', name: sess.title, xp: xp.gained });
  s.log.length = Math.min(s.log.length, 400);
  s.session = null;
  return {
    kind: sess.kind, title: sess.title, minutes, setsDone, setsAsked, exercises: sess.items.length, ratio,
    reps, seconds, metres, loadKg: Math.round(loadKg), xp, repeat, adapt, prs, boonSets: setsDone, certified, kit,
  };
}
