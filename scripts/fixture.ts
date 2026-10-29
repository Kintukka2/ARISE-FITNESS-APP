/**
 * Writes e2e/fixtures/veteran.json: a hunter a couple of months in — C-Rank,
 * classed, geared, with Shadows and a training history — built by the engine
 * itself, so it is always a valid save.
 *
 *   node scripts/run.mjs scripts/fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { defaults } from '@/core/save';
import { forge } from '@/core/coach';
import { autoAllocate, grantXP, syncClass, totalXpFor } from '@/core/progression';
import { autoEquip, grant, ofRank } from '@/core/gear';
import { bind } from '@/core/shadows';
import { rollDay } from '@/core/quests';
import * as boon from '@/core/boon';
import { BEATS } from '@/data/narrative';
import { addDays, dayKey, rng } from '@/core/util';
import { MISSIONS } from '@/core/missions';

const today = dayKey();
const s = defaults();
s.onboarded = true;
s.createdAt = new Date(Date.now() - 64 * 864e5).toISOString();
s.hunter.name = 'KINTUKKA';
s.hunter.regNo = 'E-048213';
Object.assign(s.profile, { goal: 'strength', experience: 'trained', days: 4, minutes: 45, equipment: ['dumbbell', 'pullupbar', 'bench'], limitations: [], focus: 'upper' });
s.training.certified = true;
grantXP(s, totalXpFor(32) + 400, { raw: true });
s.hunter.attrs.STR += 12;
autoAllocate(s);
s.hunter.points = 4;
syncClass(s);
forge(s, { week: 3 });
s.program!.completed = [s.program!.days[0].id];
const r = rng('fixture');
for (const rank of ['D', 'C', 'C', 'B'] as const) for (const slot of ['Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Weapon', 'Off-Hand', 'Amulet', 'Ring']) {
  const pool = ofRank(rank).filter((d) => d.slot === slot);
  if (r() < 0.55) grant(s, pool[Math.floor(r() * pool.length)].id);
}
grant(s, ofRank('S').find((d) => d.slot === 'Weapon')!.id);
autoEquip(s);
for (const id of ['ENM-007', 'ENM-030', 'ENM-052']) bind(s, id, addDays(today, -20));
s.shadows.army[0].kills = 14;
s.shadows.army[1].kills = 6;
s.shadows.fresh = [s.shadows.army[2].id];
s.streak = { current: 23, best: 31, lastDay: addDays(today, -1) };
s.questDays = Array.from({ length: 60 }, (_, i) => addDays(today, -60 + i)).filter((_, i) => i !== 12 && i !== 13);
s.daily = { date: addDays(today, -1), quest: null, cleared: true, penalty: null };
rollDay(s, today);
s.daily.quest!.items[0].done = 20;
s.boon = boon.blank(addDays(today, -1));
boon.log(s, 'bench_press', 8, addDays(today, -1));
boon.log(s, 'pullup', 5, today);
s.wallet = { shards: 2480, earned: 6200, spent: 3720 };
s.gates.clears = 23; s.gates.fails = 3; s.gates.withdrawn = 2;
s.gates.cleared = ['DNG-000', 'DNG-001', 'DNG-002', 'DNG-004', 'DNG-007', 'DNG-009', 'DNG-011', 'DNG-013', 'DNG-015'];
s.gates.bosses = [...s.gates.cleared, 'DNG-019'];
s.stats = { ...s.stats, questsCleared: 58, questsFailed: 2, penaltiesCleared: 2, sessions: 31, totalReps: 6420, totalSeconds: 2900, totalMeters: 4000, totalVolumeKg: 21800, programRuns: 28, templateRuns: 2, boons: 17, boonPoints: 36, extractions: 7, extractionsWon: 3 };
for (let i = 0; i < 30; i++) {
  const day = addDays(today, -i * 2 - 1);
  s.history.push({ day, kind: 'program', title: s.program!.days[i % 4].name, minutes: 38 + (i % 9), sets: 18 + (i % 5), setsAsked: 20, ratio: 0.85 + (i % 4) * 0.07, rating: ['right', 'hard', 'right', 'easy'][i % 4], patterns: { push: 6, pull: 5, squat: 4, core: 3 }, xp: 280 });
}
s.lifts.bench_press = { best: 8, heaviest: 72.5, lastWeight: 70, sets: 64, volume: 28000, history: [{ day: addDays(today, -2), sets: 4, top: 8, weight: 70 }, { day: addDays(today, -6), sets: 4, top: 7, weight: 67.5 }] };
s.templates.push({ id: 'tp-fixture', name: 'Hotel Room Circuit', slots: [{ exId: 'pushup', sets: 4, target: 20, rest: 45, load: false }, { exId: 'bw_squat', sets: 4, target: 25, rest: 45, load: false }, { exId: 'plank', sets: 3, target: 60, rest: 30, load: false }], runs: 2, lastRun: addDays(today, -9) });
s.story = BEATS.filter((b) => { try { return b.when(s); } catch { return false; } }).map((b) => b.id);
s.hunter.missions = MISSIONS.filter((m) => { try { return m.check(s); } catch { return false; } }).map((m) => m.id);
s.seen = ['questWalk', 'gates-visited', 'shadows-visited', 'intake', 'ob-licence', 'penalty-told', 'shop-visited'];
s.vitals = { hp: 520, mp: 120, fatigue: 22, at: Date.now(), lockedUntil: null };
writeFileSync('e2e/fixtures/veteran.json', JSON.stringify(s));
console.log('veteran: level', s.hunter.level, 'class', s.hunter.classId, 'items', s.items.length, 'equipped', Object.keys(s.equipped).length);
