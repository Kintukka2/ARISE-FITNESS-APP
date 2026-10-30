/**
 * Instructor Ryn Valcorde: the intake interview, forging a weekly programme
 * from it, and adapting that programme after every session.
 */
import { DEBRIEF } from '@/data/narrative';
import { allowed, GEAR, LIMITATIONS, available, ALL_EXERCISES } from './exercises';
import { techTier } from './progression';
import type { Day, Exercise, Experience, Focus, Goal, Program, Save, Slot } from './types';
import { clamp, dayKey, pick, rng, type Rand } from './util';

export const GOALS: { id: Goal; name: string; desc: string; sets: number; reps: number; rest: number; volMod: number; cardio: number }[] = [
  { id: 'strength', name: 'Get Strong', desc: 'Heavy, low reps, long rests. Numbers on a bar.', sets: 5, reps: 5, rest: 150, volMod: 0.75, cardio: 0.5 },
  { id: 'muscle', name: 'Build Muscle', desc: 'Moderate load, controlled tempo, real fatigue.', sets: 4, reps: 10, rest: 90, volMod: 1, cardio: 0.6 },
  { id: 'lean', name: 'Get Lean', desc: 'Density work. Short rests, circuits, conditioning finishers.', sets: 3, reps: 15, rest: 45, volMod: 1.2, cardio: 1.4 },
  { id: 'endurance', name: 'Last Forever', desc: 'High volume, long efforts, aerobic base.', sets: 3, reps: 20, rest: 45, volMod: 1.35, cardio: 1.6 },
  { id: 'athletic', name: 'Move Like An Athlete', desc: 'Power, speed, and the ability to change direction.', sets: 4, reps: 8, rest: 75, volMod: 0.95, cardio: 1.1 },
];

export const EXPERIENCE: { id: Experience; name: string; desc: string; factor: number }[] = [
  { id: 'novice', name: 'Never Really Trained', desc: 'Or it has been years. We start from the floor.', factor: 0.75 },
  { id: 'trained', name: 'On And Off', desc: 'You know the movements. Consistency is the gap.', factor: 1 },
  { id: 'seasoned', name: 'Consistent For Years', desc: 'You need a reason to keep showing up, not instruction.', factor: 1.18 },
  { id: 'elite', name: 'Competitive', desc: 'You are here for the systems, not the coaching.', factor: 1.35 },
];

export const FOCUS: { id: Focus; name: string; desc: string }[] = [
  { id: 'balanced', name: 'Balanced', desc: 'Nothing neglected.' },
  { id: 'upper', name: 'Upper Body', desc: 'Extra pressing and pulling volume.' },
  { id: 'lower', name: 'Lower Body', desc: 'Extra squat, hinge, and single-leg work.' },
  { id: 'core', name: 'Core & Midline', desc: 'Extra bracing, anti-rotation, and carries.' },
];

export const DAYS_OPTIONS = [
  { id: 2, name: '2 Sessions', desc: 'Minimum effective schedule.' },
  { id: 3, name: '3 Sessions', desc: 'The sweet spot for almost everyone.' },
  { id: 4, name: '4 Sessions', desc: 'Real split training. Needs real recovery.' },
  { id: 5, name: '5 Sessions', desc: 'Serious. Life has to be arranged around it.' },
  { id: 6, name: '6 Sessions', desc: 'Advanced only. I will build in a deload and you will take it.' },
];

/** Bands, stored as the bottom of the band so a programme always fits inside it. */
export const MINUTES_OPTIONS = [
  { id: 25, name: '20–30 Minutes', desc: 'Tight and dense. No wasted sets.' },
  { id: 45, name: '40–60 Minutes', desc: 'Standard. Room for accessories.' },
  { id: 75, name: '1 Hour+', desc: 'Heavy work with proper recovery between sets.' },
];

const TEMPLATES: Record<string, { name: string; patterns: string[] }> = {
  fullA: { name: 'Full Body — Alpha', patterns: ['squat', 'push', 'pull', 'hinge', 'core', 'cardio'] },
  fullB: { name: 'Full Body — Beta', patterns: ['hinge', 'vpush', 'vpull', 'lunge', 'core', 'cardio'] },
  fullC: { name: 'Full Body — Gamma', patterns: ['lunge', 'push', 'pull', 'squat', 'carry', 'cardio'] },
  push: { name: 'Push Protocol', patterns: ['push', 'vpush', 'push', 'core', 'cardio'] },
  pull: { name: 'Pull Protocol', patterns: ['vpull', 'pull', 'pull', 'core', 'carry'] },
  legs: { name: 'Leg Protocol', patterns: ['squat', 'hinge', 'lunge', 'plyo', 'core'] },
  upper: { name: 'Upper Protocol', patterns: ['push', 'vpull', 'vpush', 'pull', 'core'] },
  lower: { name: 'Lower Protocol', patterns: ['squat', 'hinge', 'lunge', 'core', 'cardio'] },
  cond: { name: 'Conditioning Raid', patterns: ['cardio', 'plyo', 'cardio', 'core', 'mobility'] },
};

const RATIONALE: Record<string, string[]> = {
  push: ['Pressing volume. Elbows and shoulders do the talking.', 'Everything that pushes away from you.'],
  pull: ['Pull day. Most people under-train this and then wonder why their shoulders hurt.', 'Row volume. Your posture will thank me in six weeks.'],
  legs: ['Legs. The largest engine you own, and the one you skip.', 'Lower body. This session is the one that changes your body composition.'],
  lower: ['Lower body under load. Brace before every rep.', 'Hips and knees. Full range or it does not count.'],
  upper: ['Upper body, balanced push to pull. No favourites.', 'Torso day. Equal volume both directions.'],
  cond: ['Conditioning. The point is to be uncomfortable and keep going anyway.', 'Engine work. Hard is the mechanism, not a side effect.'],
  fullA: ['Full body. Every pattern gets touched.', 'One session, whole system. Efficient and honest.'],
  fullB: ['Full body, second variation. Different angles, same intent.', 'Rotating stimulus so nothing stalls.'],
  fullC: ['Full body, third variation. Keeps adaptation from settling.', 'Same coverage, new positions.'],
};

const FALLBACK: Record<string, string[]> = {
  push: ['vpush', 'core'], vpush: ['push', 'core'], pull: ['vpull', 'core'], vpull: ['pull', 'core'],
  squat: ['lunge', 'hinge'], hinge: ['squat', 'core'], lunge: ['squat', 'core'], plyo: ['cardio', 'lunge'],
  cardio: ['core', 'mobility'], carry: ['core', 'hinge'], core: ['mobility'], mobility: ['core'],
};

export function splitFor(days: number, goal: Goal, experience: Experience): string[] {
  const novice = experience === 'novice';
  switch (days) {
    case 2: return ['fullA', 'fullB'];
    case 3: return novice ? ['fullA', 'fullB', 'fullC'] : goal === 'strength' ? ['fullA', 'lower', 'upper'] : ['push', 'pull', 'legs'];
    case 4: return goal === 'strength' ? ['upper', 'lower', 'upper', 'lower'] : novice ? ['fullA', 'fullB', 'fullC', 'cond'] : ['push', 'pull', 'legs', 'cond'];
    case 5: return goal === 'endurance' || goal === 'lean' ? ['push', 'legs', 'cond', 'pull', 'cond'] : ['push', 'pull', 'legs', 'upper', 'cond'];
    case 6: return ['push', 'pull', 'legs', 'push', 'pull', 'cond'];
    default: return ['fullA', 'fullB', 'fullC'];
  }
}

/** Exercises per session for each time band: 20–30 min, 40–60 min, an hour or more. */
export const slotCount = (minutes: number) => (minutes <= 30 ? 4 : minutes <= 60 ? 5 : 6);

/** Deload every fifth week; otherwise +6% a week inside the block. */
export function weekMultiplier(week: number): number {
  if (week > 1 && week % 5 === 0) return 0.65;
  return 1 + ((week - 1) % 5) * 0.06;
}

export const goalOf = (id: Goal) => GOALS.find((g) => g.id === id) ?? GOALS[1];

export function volumeFactor(s: Save): number {
  const exp = EXPERIENCE.find((e) => e.id === s.profile.experience)?.factor ?? 1;
  const lvl = Math.min(1.6, 1 + s.hunter.level * 0.012);
  const adapt = s.program?.adapt ?? 1;
  const a = s.hunter.attrs;
  return exp * lvl * adapt * (1 + (a.VIT + a.STR - 10) * 0.004);
}

function choose(pool: Exercise[], pattern: string, used: string[], counts: Record<string, number>, r: Rand): Exercise | null {
  const fb = FALLBACK[pattern] ?? [];
  const chain = (counts[pattern] ?? 0) >= 2 ? [...fb, pattern] : [pattern, ...fb];
  const best = (cands: Exercise[]) => {
    const top = Math.max(...cands.map((x) => x.tier));
    return pick(cands.filter((x) => x.tier >= top - 1), r);
  };
  // First pass refuses regressions; only if the whole chain is empty do we accept one.
  for (let pass = 0; pass < 2; pass++) {
    for (const p of chain) {
      const c = pool.filter((x) => x.pattern === p && !used.includes(x.id) && (pass === 1 || !x.regress));
      if (c.length) return best(c);
    }
  }
  const any = pool.filter((x) => !used.includes(x.id));
  const real = any.filter((x) => !x.regress);
  const from = real.length ? real : any.length ? any : pool;
  return from.length ? pick(from, r) : null;
}

/** One slot's prescription for one exercise at the hunter's current volume. */
export function slotFor(s: Save, ex: Exercise, week = s.program?.week ?? 1): Slot {
  const g = goalOf(s.profile.goal);
  const vf = volumeFactor(s);
  const wf = weekMultiplier(week);
  let sets = g.sets;
  let target: number;
  if (ex.unit === 'reps') {
    target = Math.max(3, Math.round(ex.base * (g.reps / 10) * vf * wf * g.volMod));
    if (ex.tier >= 3) target = Math.max(3, Math.round(target * 0.7));
  } else if (ex.unit === 'sec') {
    target = Math.max(15, Math.round((ex.base * vf * wf * (ex.pattern === 'cardio' ? g.cardio : 1)) / 5) * 5);
    sets = Math.max(2, g.sets - 1);
  } else {
    target = Math.max(200, Math.round((ex.base * vf * wf * g.cardio) / 100) * 100);
    sets = 1;
  }
  if (ex.pattern === 'mobility') { sets = 1; target = Math.round(target * 1.2); }
  if (ex.pattern === 'plyo') sets = Math.max(3, g.sets - 1);
  // Agility shortens rests, a little.
  const rest = clamp(Math.round((ex.unit === 'm' ? 120 : g.rest) * (1 - (s.hunter.attrs.AGI - 5) * 0.006)), 20, 240);
  return { exId: ex.id, sets, target, rest, load: !!ex.load };
}

function focusPattern(focus: Focus, r: Rand): string | null {
  if (focus === 'upper') return pick(['push', 'pull', 'vpull', 'vpush'], r);
  if (focus === 'lower') return pick(['squat', 'hinge', 'lunge'], r);
  if (focus === 'core') return pick(['core', 'carry'], r);
  return null;
}

/** Build a full week from the profile. Mutates `s.program`. */
export function forge(s: Save, opts: { week?: number; salt?: string } = {}): Program {
  const p = s.profile;
  const week = opts.week ?? s.program?.week ?? 1;
  const seed = `${p.goal}|${p.experience}|${p.days}|${p.equipment.join(',')}|w${week}|${opts.salt ?? ''}`;
  const r = rng(seed);
  // Nothing above the hunter's tier: the higher of what their rank and their declared history allow.
  const pool = allowed(s, techTier(s));
  const n = slotCount(p.minutes);
  const adapt = s.program?.adapt ?? 1;
  // volumeFactor reads program.week/adapt, so park a stub while slots are built.
  s.program = { seed, week, adapt, days: [], completed: [], weekStarted: dayKey(), deload: false };

  const days: Day[] = splitFor(p.days, p.goal, p.experience).map((key, di) => {
    const tpl = TEMPLATES[key];
    const patterns = tpl.patterns.slice();
    const extra = focusPattern(p.focus, r);
    if (extra) patterns.splice(Math.min(2, patterns.length), 0, extra);
    const used: string[] = [];
    const counts: Record<string, number> = {};
    const slots: Slot[] = [];
    for (let i = 0; i < n; i++) {
      const ex = choose(pool, patterns[i % patterns.length], used, counts, r);
      if (!ex) continue;
      used.push(ex.id);
      counts[ex.pattern] = (counts[ex.pattern] ?? 0) + 1;
      const slot = slotFor(s, ex, week);
      if (slots.length === 0) slot.note = 'Primary lift — this is the one that matters today.';
      slots.push(slot);
    }
    return { id: `${key}-${di}`, key, name: tpl.name, rationale: pick(RATIONALE[key] ?? ['Get through it.'], r), slots };
  });

  s.program = { seed, week, adapt, days, completed: [], weekStarted: dayKey(), deload: weekMultiplier(week) < 1 };
  return s.program;
}

export const advanceWeek = (s: Save) => forge(s, { week: (s.program?.week ?? 1) + 1, salt: `w${Date.now()}` });

export function nextDay(s: Save): Day | null {
  if (!s.program) return null;
  return s.program.days.find((d) => !s.program!.completed.includes(d.id)) ?? null;
}

export type Rating = 'easy' | 'right' | 'hard' | 'brutal';
export type Bucket = keyof typeof DEBRIEF;

/** Move the volume scalar from the rating and the completion ratio. */
export function adapt(s: Save, ratio: number, rating: Rating) {
  let delta = { easy: 0.06, right: 0.02, hard: -0.01, brutal: -0.09 }[rating];
  if (ratio >= 1.1) delta += 0.03;
  else if (ratio < 0.7) delta -= 0.06;
  else if (ratio < 0.9) delta -= 0.02;
  const from = s.program?.adapt ?? 1;
  const to = clamp(from + delta, 0.55, 1.9);
  if (s.program) s.program.adapt = to;
  let bucket: Bucket = 'onTarget';
  if (rating === 'brutal') bucket = 'brutal';
  else if (ratio >= 1.05 && (rating === 'easy' || rating === 'right')) bucket = 'crushed';
  else if (ratio < 0.85) bucket = 'struggled';
  return { bucket, line: pick(DEBRIEF[bucket]), from, to };
}

/** A long absence: soften everything and say so. */
export function softReset(s: Save): string {
  if (s.program) {
    s.program.adapt = clamp(s.program.adapt * 0.8, 0.55, 1.9);
    forge(s, { week: s.program.week, salt: `return-${Date.now()}` });
  }
  return pick(DEBRIEF.returning);
}


/** Plain-language notes on the forged programme, for the reveal. */
export function summary(s: Save): string[] {
  const p = s.profile;
  const g = goalOf(p.goal);
  const exp = EXPERIENCE.find((e) => e.id === p.experience)!;
  const kit = ['Bare Hands', ...p.equipment.map((id) => GEAR.find((e) => e.id === id)?.name ?? id)];
  const fits = available(p.equipment, p.limitations).length;
  const notes = [
    `Goal locked to <em>${g.name}</em>: ${g.sets} sets, roughly ${g.reps} reps, ${g.rest}s between sets.`,
    `Split: <em>${p.days} sessions per week</em>, ${slotCount(p.minutes)} exercises each, sized for your time window.`,
    `Equipment: <em>${kit.join(', ')}</em>. <em>${fits}</em> of the codex’s ${ALL_EXERCISES.length} techniques suit that kit.`,
  ];
  const lim = p.limitations.filter((l) => l !== 'none');
  if (lim.length) {
    const names = lim.map((id) => LIMITATIONS.find((x) => x.id === id)?.name.toLowerCase() ?? id);
    notes.push(`Struck off everything that loads your <em>${names.join(' and ')}</em>. Nothing that hurts gets prescribed.`);
  }
  notes.push(`Starting volume set at <em>${Math.round(volumeFactor(s) * 100)}%</em> of baseline for a ${exp.name.toLowerCase()} athlete. It moves every session based on what you actually finish.`);
  notes.push('Every fifth week is a <em>deload</em>. The System will force it. Do not argue.');
  return notes;
}

const ARCHETYPES: Record<string, string> = {
  'strength:novice': 'The Stubborn Beginning', 'strength:trained': 'The Heavy Hand', 'strength:seasoned': 'The Load-Bearer', 'strength:elite': 'The Anvil',
  'muscle:novice': 'The Blank Page', 'muscle:trained': 'The Builder', 'muscle:seasoned': 'The Architect', 'muscle:elite': 'The Colossus',
  'lean:novice': 'The First Cut', 'lean:trained': 'The Whetstone', 'lean:seasoned': 'The Blade', 'lean:elite': 'The Edge',
  'endurance:novice': 'The Long Road', 'endurance:trained': 'The Pacer', 'endurance:seasoned': 'The Unending', 'endurance:elite': 'The Tireless',
  'athletic:novice': 'The Late Start', 'athletic:trained': 'The Quick', 'athletic:seasoned': 'The Predator', 'athletic:elite': 'The Apex',
};
export const archetype = (s: Save) => ARCHETYPES[`${s.profile.goal}:${s.profile.experience}`] ?? 'The Awakened';

