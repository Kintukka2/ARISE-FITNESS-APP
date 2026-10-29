/**
 * The Daily Quest: push-ups, sit-ups, squats. Every day, the same three.
 * Ten of each on day one, one more per day of Resonance, capped at a hundred.
 * Miss a day and the streak resets, a Penalty Quest is issued, and Hollow
 * halves experience until it is paid.
 */
import { exById, hurts, owns } from './exercises';
import { grantXP, resonance } from './progression';
import type { Quest, QuestItem, Save } from './types';
import { clamp, dayKey, daysBetween, sum } from './util';
import * as boon from './boon';
import * as coach from './coach';
import * as shop from './shop';

export const BASE_REPS = 10;
export const REPS_CAP = 100;
export const PENALTY_MULT = 1.5;

/** The group is the promise; the exact movement can change if it hurts. */
const SLOTS: { group: string; staples: string[] }[] = [
  { group: 'push', staples: ['pushup', 'knee_pushup', 'incline_pushup', 'diamond_pushup'] },
  { group: 'core', staples: ['situp', 'crunch', 'leg_raise', 'plank', 'hollow_hold'] },
  { group: 'legs', staples: ['bw_squat', 'lunge', 'step_up', 'wall_sit'] },
];
/** Unflagged floor work for when a limitation empties a whole group. */
const FILL = ['glute_bridge', 'dead_bug', 'bird_dog', 'cat_cow', 'deep_breath'];

export const dailyReps = (s: Save) => clamp(BASE_REPS + Math.max(0, s.streak.current), BASE_REPS, REPS_CAP);

function targetFor(unit: string, reps: number, mult: number): number {
  if (unit === 'sec') return clamp(Math.round((reps * 2 * mult) / 5) * 5, 20, 600);
  if (unit === 'm') return clamp(Math.round((reps * 20 * mult) / 100) * 100, 200, 12000);
  return clamp(Math.round(reps * mult), 1, Math.round(REPS_CAP * PENALTY_MULT));
}

export function buildQuest(s: Save, penalty = false): Quest {
  const mult = penalty ? PENALTY_MULT : 1;
  const reps = dailyReps(s);
  const { equipment, limitations } = s.profile;
  const used: string[] = [];
  const items: QuestItem[] = [];

  const ok = (id: string) => {
    const ex = exById(id);
    return !!ex && !used.includes(id) && owns(ex, equipment) && !hurts(ex, limitations);
  };

  for (const slot of SLOTS) {
    // Prefer a rep movement: a plank instead of sit-ups is a different kind of day.
    const reps1 = slot.staples.filter((id) => exById(id)?.unit === 'reps');
    const id = reps1.find(ok) ?? slot.staples.find(ok) ?? FILL.find(ok);
    if (!id) continue;
    used.push(id);
    items.push({ exId: id, target: targetFor(exById(id)!.unit, reps, mult), done: 0 });
  }
  return { items, xp: penalty ? 0 : 60 + s.hunter.level * 9, penalty };
}

export const progress = (q: Quest | null) =>
  !q || !q.items.length ? 0 : sum(q.items.map((it) => clamp(it.done / it.target, 0, 1))) / q.items.length;

export const isComplete = (q: Quest | null) => !!q && q.items.every((it) => it.done >= it.target);

export type RollEvent =
  | { type: 'newQuest' }
  | { type: 'penalty'; missed: number }
  | { type: 'softReset'; line: string }
  | { type: 'newWeek'; week: number; deload: boolean };

/** Advance the calendar to today. Mutates; returns what happened for the UI to narrate. */
export function rollDay(s: Save, today = dayKey()): RollEvent[] {
  const events: RollEvent[] = [];
  if (!s.daily.date) {
    s.daily = { date: today, quest: buildQuest(s), cleared: false, penalty: s.daily.penalty };
    return [{ type: 'newQuest' }];
  }
  if (s.daily.date === today) return events;

  const gap = daysBetween(s.daily.date, today);
  if (gap < 0) {
    // The clock went backwards. Re-date today without judging anyone.
    s.daily.date = today;
    return events;
  }
  const missed = (s.daily.cleared ? 0 : 1) + Math.max(0, gap - 1);
  if (missed > 0) {
    s.stats.questsFailed += missed;
    if (s.streak.current >= 14) s.stats.prevBestStreak = s.streak.current;
    s.streak.current = 0;
    s.flags.hollow = true;
    s.daily.penalty = buildQuest(s, true);
    events.push({ type: 'penalty', missed });
  }
  if (gap >= 5 && s.program) {
    events.push({ type: 'softReset', line: coach.softReset(s) });
  }
  s.daily.date = today;
  s.daily.cleared = false;
  s.daily.quest = buildQuest(s);
  events.push({ type: 'newQuest' });

  if (s.program && daysBetween(s.program.weekStarted, today) >= 7) {
    coach.advanceWeek(s);
    events.push({ type: 'newWeek', week: s.program.week, deload: s.program.deload });
  }
  return events;
}

/** Log reps against one item. Returns true the moment that item clears. */
export function logItem(s: Save, q: Quest, index: number, amount: number): boolean {
  const it = q.items[index];
  if (!it) return false;
  const was = it.done >= it.target;
  const before = it.done;
  it.done = clamp(it.done + amount, 0, it.target * 3);
  const delta = it.done - before;
  const ex = exById(it.exId);
  if (ex?.unit === 'reps') s.stats.totalReps += delta;
  else if (ex?.unit === 'sec') s.stats.totalSeconds += delta;
  else s.stats.totalMeters += delta;
  return it.done >= it.target && !was;
}

export interface ClearResult { xp: ReturnType<typeof grantXP>; shards: number; streak: number }

/** Bank today's Daily Quest. Mutates. */
export function clearDaily(s: Save, now = new Date()): ClearResult | null {
  if (s.daily.cleared || !s.daily.quest) return null;
  const today = dayKey(now);
  s.daily.cleared = true;
  s.stats.questsCleared += 1;
  const shards = shop.earn(s, shop.questShards(s));
  for (const it of s.daily.quest.items) boon.log(s, it.exId, 1, today);

  const last = s.streak.lastDay;
  if (last !== today) {
    s.streak.current = last && daysBetween(last, today) === 1 ? s.streak.current + 1 : 1;
    s.streak.lastDay = today;
  }
  s.streak.best = Math.max(s.streak.best, s.streak.current);

  if (s.stats.prevBestStreak >= 14 && s.streak.current >= 7) {
    s.stats.comebacks += 1;
    s.stats.prevBestStreak = 0;
  }
  if (now.getHours() < 7) s.stats.earlyClears += 1;
  if (resonance(s).atMax) s.stats.perfectDays += 1;

  const xp = grantXP(s, s.daily.quest.xp);
  s.log.unshift({ day: today, kind: 'quest', name: 'Daily Quest', xp: xp.gained });
  s.log.length = Math.min(s.log.length, 400);
  return { xp, shards, streak: s.streak.current };
}

/** Pay off the Penalty Quest. No experience; it lifts Hollow. */
export function clearPenalty(s: Save, today = dayKey()): boolean {
  if (!s.daily.penalty) return false;
  s.daily.penalty = null;
  s.flags.hollow = false;
  s.stats.penaltiesCleared += 1;
  s.log.unshift({ day: today, kind: 'penalty', name: 'Penalty Quest', xp: 0 });
  return true;
}
