/**
 * Secret Missions: unpublished citations. Nothing says one exists until it is
 * done. Each pays once, into named attributes or as free points.
 */
import { DUNGEONS } from '@/data/dungeons';
import { BEATS } from '@/data/narrative';
import { ISSUED } from '@/data/equipment';
import * as boon from './boon';
import { defOf, power, SLOTS, worn } from './gear';
import { gateRank, resonance, STAT_CAP } from './progression';
import type { Attrs, Save, Stat } from './types';
import { STATS } from './types';

export type MissionTier = 'minor' | 'major' | 'legend' | 'myth';
export const TIER_NAMES: Record<MissionTier, string> = { minor: 'Mission', major: 'Directive', legend: 'Edict', myth: 'Testament' };

type Grant = Partial<Attrs> & { free?: number; all?: number };

export interface Mission { id: string; name: string; tier: MissionTier; did: string; grant: Grant; check: (s: Save) => boolean }

const EXALTED = boon.TIERS[boon.TIERS.length - 1];
const fromGate = (s: Save) => s.items.some((it) => !defOf(it)?.issued);
const metGrades = (s: Save) => new Set(s.gates.met.map((id) => id.split('-')[1]));

export const MISSIONS: Mission[] = [
  // Mission — 1 point
  { id: 'first_light', name: 'First Light', tier: 'minor', did: 'Cleared a Daily Quest.', grant: { VIT: 1 }, check: (s) => s.stats.questsCleared >= 1 },
  { id: 'trained', name: 'Trained', tier: 'minor', did: 'Finished Basic Hunter Training.', grant: { PER: 1 }, check: (s) => s.training.certified },
  { id: 'first_impressions', name: 'First Impressions Don’t Matter', tier: 'minor', did: 'Walked straight past Ryn Valcorde’s training plan without reading it.', grant: { INT: -2, VIT: 1 }, check: (s) => s.flags.ignoredPlan },
  { id: 'seven_straight', name: 'Seven Straight', tier: 'minor', did: 'Held Resonance for seven consecutive days.', grant: { AGI: 1 }, check: (s) => s.streak.best >= 7 },
  { id: 'iron_debt', name: 'Iron Debt', tier: 'minor', did: 'Missed a day, paid the Penalty Quest, and came back anyway.', grant: { INT: 1 }, check: (s) => s.stats.penaltiesCleared >= 1 },
  { id: 'acknowledged', name: 'Acknowledged', tier: 'minor', did: 'Received a Boon.', grant: { PER: 1 }, check: (s) => s.stats.boons >= 1 },
  { id: 'nobody_saw', name: 'Nobody Saw It', tier: 'minor', did: 'Cleared a Daily Quest before seven in the morning.', grant: { PER: 1 }, check: (s) => s.stats.earlyClears >= 1 },
  { id: 'under_tension', name: 'Under Tension', tier: 'minor', did: 'Held position for a cumulative hour.', grant: { VIT: 1 }, check: (s) => s.stats.totalSeconds >= 3600 },
  { id: 'gatebreaker', name: 'Gatebreaker', tier: 'minor', did: 'Cleared a dungeon.', grant: { STR: 1 }, check: (s) => s.gates.clears >= 1 },
  { id: 'first_artifact', name: 'Salvage', tier: 'minor', did: 'Carried something out of a Gate that Hunter Training did not issue you.', grant: { AGI: 1 }, check: fromGate },
  { id: 'first_shadow', name: 'Something Followed You Home', tier: 'minor', did: 'Bound your first Shadow.', grant: { free: 1 }, check: (s) => s.shadows.army.length >= 1 },
  { id: 'classified', name: 'Classified', tier: 'minor', did: 'Trained long enough for the System to put a name to what you are.', grant: { free: 1 }, check: (s) => !!s.hunter.classId },
  {
    id: 'standard_issue', name: 'Standard Issue', tier: 'minor', did: 'Wore the issued kit entire — the sword, the shield and the grey.', grant: { free: 1 },
    check: (s) => { const ids = worn(s).map((i) => i.defId); return ISSUED.every((d) => ids.includes(d.id)); },
  },
  { id: 'names_on_board', name: 'Names On The Board', tier: 'minor', did: 'Stood in a party with ten different hunters.', grant: { PER: 1 }, check: (s) => s.gates.met.length >= 10 },
  { id: 'own_programme', name: 'Your Own Hand', tier: 'minor', did: 'Wrote a programme of your own and ran it.', grant: { INT: 1 }, check: (s) => s.stats.templateRuns >= 1 },

  // Directive — 2–3 points
  { id: 'thirty_unbroken', name: 'Thirty Unbroken', tier: 'major', did: 'Held Resonance for thirty consecutive days.', grant: { STR: 1, VIT: 1 }, check: (s) => s.streak.best >= 30 },
  { id: 'exalted', name: 'Exalted', tier: 'major', did: `Banked ${EXALTED.min} sets across ${EXALTED.days} days in one period — the top of the ladder.`, grant: { INT: 1, PER: 1 }, check: (s) => s.boon.last?.tier === EXALTED.name },
  { id: 'well_rounded', name: 'No Weak Side', tier: 'major', did: 'Brought every one of the five attributes to twenty or above.', grant: { INT: 2 }, check: (s) => STATS.every((k) => s.hunter.attrs[k] >= 20) },
  { id: 'specialist', name: 'Specialist', tier: 'major', did: 'Drove a single attribute to fifty. Everything went into one place.', grant: { free: 3 }, check: (s) => STATS.some((k) => s.hunter.attrs[k] >= 50) },
  { id: 'ten_thousand', name: 'Ten Thousand', tier: 'major', did: 'Logged ten thousand repetitions.', grant: { STR: 3 }, check: (s) => s.stats.totalReps >= 10000 },
  { id: 'the_distance', name: 'The Distance', tier: 'major', did: 'Covered a marathon — 42,195 metres, in total.', grant: { AGI: 2, VIT: 1 }, check: (s) => s.stats.totalMeters >= 42195 },
  { id: 'tonnage', name: 'Tonnage', tier: 'major', did: 'Moved fifty tonnes of load. The bar does not care how you felt about it.', grant: { STR: 2 }, check: (s) => s.stats.totalVolumeKg >= 50000 },
  { id: 'hundred_sessions', name: 'A Hundred Sessions', tier: 'major', did: 'Logged one hundred training sessions.', grant: { VIT: 1, INT: 1, PER: 1 }, check: (s) => s.stats.sessions >= 100 },
  { id: 'two_hundred_quests', name: 'Two Hundred Mornings', tier: 'major', did: 'Cleared two hundred Daily Quests.', grant: { free: 3 }, check: (s) => s.stats.questsCleared >= 200 },
  { id: 'delver', name: 'Delver', tier: 'major', did: 'Cleared ten dungeons.', grant: { STR: 2, VIT: 1 }, check: (s) => s.gates.clears >= 10 },
  { id: 'legendary_find', name: 'Legendary Find', tier: 'major', did: 'Recovered an S-Rank artifact.', grant: { PER: 3 }, check: (s) => s.items.some((it) => defOf(it)?.rank === 'S') },
  { id: 'fully_kitted', name: 'Fully Kitted', tier: 'major', did: 'Filled every one of the ten equipment slots.', grant: { free: 2 }, check: (s) => worn(s).length >= SLOTS.length },
  { id: 'well_equipped', name: 'Kitted Properly', tier: 'major', did: 'Reached 300 Equipment Score. Filling the slots is not the same as filling them well.', grant: { STR: 1, VIT: 2 }, check: (s) => power(s) >= 300 },
  { id: 'shadow_army', name: 'An Army Of Your Own', tier: 'major', did: 'Bound five Shadows.', grant: { free: 3 }, check: (s) => s.shadows.army.length >= 5 },
  { id: 'read_everything', name: 'The Whole Record', tier: 'major', did: 'Saw every transmission the System had to send. All of it.', grant: { INT: 2, PER: 1 }, check: (s) => BEATS.every((b) => s.story.includes(b.id)) },
  { id: 'regular_company', name: 'Regular Company', tier: 'major', did: 'Cleared ten Gates alongside the same hunter.', grant: { STR: 1, VIT: 1 }, check: (s) => Object.values(s.gates.together).some((n) => n >= 10) },
  { id: 'wide_acquaintance', name: 'A Wide Acquaintance', tier: 'major', did: 'Stood in a party with a hundred different hunters.', grant: { PER: 2, INT: 1 }, check: (s) => s.gates.met.length >= 100 },
  { id: 'every_grade', name: 'The Whole Ladder', tier: 'major', did: 'Raided beside a hunter of every grade the Association licenses — E through S.', grant: { PER: 3 }, check: (s) => ['E', 'D', 'C', 'B', 'A', 'S'].every((r) => metGrades(s).has(r)) },

  // Edict — 4–5 points
  { id: 'perfect_resonance', name: 'Perfect Resonance', tier: 'legend', did: 'Reached the Resonance ceiling — ×2.00, one hundred consecutive days.', grant: { all: 1 }, check: (s) => resonance(s).atMax },
  { id: 'never_missed', name: 'Not Once', tier: 'legend', did: 'Reached fifty days of Resonance having never failed a Daily Quest.', grant: { all: 1 }, check: (s) => s.streak.best >= 50 && s.stats.questsFailed === 0 },
  { id: 'three_hundred', name: 'Three Hundred', tier: 'legend', did: 'Logged three hundred training sessions.', grant: { STR: 2, VIT: 2, INT: 1 }, check: (s) => s.stats.sessions >= 300 },
  { id: 'six_figures', name: 'Six Figures', tier: 'legend', did: 'Earned one hundred thousand lifetime experience.', grant: { free: 5 }, check: (s) => s.stats.xpTotal >= 100000 },
  { id: 'every_gate', name: 'Nothing Left Standing', tier: 'legend', did: 'Cleared every dungeon the Association has on file. All fifty.', grant: { STR: 2, AGI: 2 }, check: (s) => DUNGEONS.every((d) => s.gates.cleared.includes(d.id)) },
  { id: 's_rank', name: 'The Highest Grant', tier: 'legend', did: 'Reached S-Rank. The Association has run out of letters.', grant: { free: 4 }, check: (s) => gateRank(s) === 'S' },
  { id: 'sovereign', name: 'Beyond Classification', tier: 'legend', did: 'Reached Sovereign — Level 100. The System has nothing left to award.', grant: { all: 1 }, check: (s) => s.hunter.level >= 100 },
  { id: 'walked_out_together', name: 'Someone To Walk Out With', tier: 'legend', did: 'Cleared twenty-five Gates alongside the same hunter.', grant: { PER: 2, VIT: 2 }, check: (s) => Object.values(s.gates.together).some((n) => n >= 25) },

  // Testament — 6 or more
  { id: 's_gate', name: 'What Walked Out', tier: 'myth', did: 'Cleared an S-Rank dungeon. Something went in. This came out.', grant: { all: 2 }, check: (s) => s.gates.cleared.some((id) => DUNGEONS.find((d) => d.id === id)?.rank === 'S') },
  { id: 'monarch_slain', name: 'The Hollow Throne', tier: 'myth', did: 'Walked into the Hollow Throne and out again. The thing that sat on it is smaller than you now.', grant: { all: 3 }, check: (s) => s.gates.cleared.includes('DNG-HOLLOW') },
];

export function deltaOf(m: Mission): Partial<Attrs> {
  const out: Partial<Attrs> = {};
  for (const k of STATS) {
    const v = (m.grant.all ?? 0) + (m.grant[k] ?? 0);
    if (v) out[k] = v;
  }
  return out;
}

export const freeOf = (m: Mission) => m.grant.free ?? 0;

export function grantText(m: Mission): string {
  if (m.grant.free) return `+${m.grant.free} free attribute point${m.grant.free === 1 ? '' : 's'}`;
  if (m.grant.all) return `+${m.grant.all} to every attribute`;
  return Object.entries(deltaOf(m)).map(([k, v]) => `${v! < 0 ? '' : '+'}${v} ${k}`).join(' · ');
}

/** Check every unheld mission. Grants and returns the ones just completed. Mutates. */
export function sweep(s: Save): Mission[] {
  const fresh: Mission[] = [];
  for (const m of MISSIONS) {
    if (s.hunter.missions.includes(m.id)) continue;
    let ok = false;
    try { ok = m.check(s); } catch { ok = false; }
    if (!ok) continue;
    s.hunter.missions.push(m.id);
    for (const [k, v] of Object.entries(deltaOf(m)) as [Stat, number][]) {
      s.hunter.attrs[k] = Math.max(1, Math.min(STAT_CAP, s.hunter.attrs[k] + v));
    }
    s.hunter.points += freeOf(m);
    fresh.push(m);
  }
  return fresh;
}

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
