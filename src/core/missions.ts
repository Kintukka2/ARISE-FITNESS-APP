/**
 * Secret Quests: unpublished. Nothing says one exists until it is done. Each
 * pays once, into named stats or as free Ability Points. `did` is the goal.
 */
import { DUNGEONS } from '@/data/dungeons';
import { BEATS } from '@/data/narrative';
import { ISSUED } from '@/data/equipment';
import { SHADOW_RANKS } from '@/data/shadows';
import { BLOCK, SPIRE_TOP } from '@/data/spire';
import { defOf, power, setPieces, setsIn, SLOTS, worn } from './gear';
import { gateRank, STAT_CAP } from './progression';
import type { Attrs, Save, Stat } from './types';
import { STATS } from './types';

export type MissionTier = 'minor' | 'major' | 'legend' | 'myth';
export const TIER_NAMES: Record<MissionTier, string> = { minor: 'Citation', major: 'Directive', legend: 'Edict', myth: 'Testament' };

type Grant = Partial<Attrs> & { free?: number; all?: number; slot?: number };

export interface Mission { id: string; name: string; tier: MissionTier; did: string; grant: Grant; check: (s: Save) => boolean }

const fromGate = (s: Save) => s.items.some((it) => !defOf(it)?.issued);
const metGrades = (s: Save) => new Set(s.gates.met.map((id) => id.split('-')[1]));
const felled = (s: Save) => Object.values(s.stats.killsByFamily).reduce((a, b) => a + b, 0);
const families = (s: Save) => Object.keys(s.stats.killsByFamily).length;
const bestShadow = (s: Save) => s.shadows.army.reduce((n, x) => Math.max(n, x.kills), 0);

export const MISSIONS: Mission[] = [
  // Citation: 1 point
  { id: 'first_light', name: 'First Light', tier: 'minor', did: 'Clear the Practice Gate.', grant: { VIT: 1 }, check: (s) => s.gates.cleared.includes('DNG-000') },
  { id: 'knew_when', name: 'Knew When To Leave', tier: 'minor', did: 'Withdraw from a Gate at a rest.', grant: { PER: 1 }, check: (s) => s.gates.withdrawn >= 1 },
  { id: 'first_reach', name: 'Above Your Station', tier: 'minor', did: 'Clear a Gate one grade above your own.', grant: { STR: 1 }, check: (s) => s.stats.reachClears >= 1 },
  { id: 'seven_straight', name: 'Seven Straight', tier: 'minor', did: 'Clear 7 Gates in a row without being carried out.', grant: { AGI: 1 }, check: (s) => s.gates.bestUnbroken >= 7 },
  { id: 'iron_debt', name: 'Iron Debt', tier: 'minor', did: 'Clear a Gate right after being carried out of one.', grant: { INT: 1 }, check: (s) => s.stats.comebacks >= 1 },
  { id: 'spoils', name: 'Spoils', tier: 'minor', did: 'Earn 1,000 Mana Shards in total.', grant: { PER: 1 }, check: (s) => s.wallet.earned >= 1000 },
  { id: 'first_boss', name: 'Nobody Saw It', tier: 'minor', did: 'Face a Gate boss.', grant: { PER: 1 }, check: (s) => s.gates.bosses.filter((id) => id !== 'DNG-000').length >= 1 },
  { id: 'hundred_down', name: 'A Hundred Down', tier: 'minor', did: 'Fell 100 creatures.', grant: { VIT: 1 }, check: (s) => felled(s) >= 100 },
  { id: 'gatebreaker', name: 'Gatebreaker', tier: 'minor', did: 'Clear a Gate.', grant: { STR: 1 }, check: (s) => s.gates.clears >= 1 },
  { id: 'first_artifact', name: 'Salvage', tier: 'minor', did: 'Recover an item from a Gate.', grant: { AGI: 1 }, check: fromGate },
  { id: 'first_shadow', name: 'Something Followed You Home', tier: 'minor', did: 'Bind a Shadow.', grant: { free: 1 }, check: (s) => s.shadows.army.length >= 1 },
  { id: 'first_sworn', name: 'Sworn', tier: 'minor', did: `Have a Shadow reach ${SHADOW_RANKS[1].name} Rank: ${SHADOW_RANKS[1].kills} kills.`, grant: { slot: 1 }, check: (s) => bestShadow(s) >= SHADOW_RANKS[1].kills },
  { id: 'classified', name: 'Classified', tier: 'minor', did: 'Be assigned a class.', grant: { free: 1 }, check: (s) => !!s.hunter.classId },
  {
    id: 'standard_issue', name: 'Standard Issue', tier: 'minor', did: 'Equip every piece of issued kit at once.', grant: { free: 1 },
    check: (s) => { const ids = worn(s).map((i) => i.defId); return ISSUED.every((d) => ids.includes(d.id)); },
  },
  { id: 'names_on_board', name: 'Names On The Board', tier: 'minor', did: 'Raid with 10 different hunters.', grant: { PER: 1 }, check: (s) => s.gates.met.length >= 10 },
  { id: 'bestiary', name: 'Bestiary', tier: 'minor', did: 'Fell creatures of 5 different families.', grant: { INT: 1 }, check: (s) => families(s) >= 5 },
  { id: 'full_set', name: 'Matched', tier: 'minor', did: 'Equip every piece of a set at once.', grant: { free: 1 }, check: (s) => [...setsIn(worn(s))].some(([id, n]) => n >= setPieces(id).length) },
  { id: 'spire_first', name: 'Up', tier: 'minor', did: 'Clear a block of the Pale Spire.', grant: { AGI: 1 }, check: (s) => s.spire.top >= BLOCK },

  // Directive: 2 to 3 points
  { id: 'thirty_unbroken', name: 'Thirty Unbroken', tier: 'major', did: 'Clear 30 Gates in a row without being carried out.', grant: { STR: 1, VIT: 1 }, check: (s) => s.gates.bestUnbroken >= 30 },
  { id: 'reaching', name: 'Reaching', tier: 'major', did: 'Clear 10 Gates one grade above your own.', grant: { INT: 1, PER: 1 }, check: (s) => s.stats.reachClears >= 10 },
  { id: 'well_rounded', name: 'No Weak Side', tier: 'major', did: `Raise all ${STATS.length} stats to 20 or more.`, grant: { INT: 2 }, check: (s) => STATS.every((k) => s.hunter.attrs[k] >= 20) },
  { id: 'specialist', name: 'Specialist', tier: 'major', did: 'Raise one stat to 50.', grant: { free: 3 }, check: (s) => STATS.some((k) => s.hunter.attrs[k] >= 50) },
  { id: 'two_thousand_down', name: 'Two Thousand Down', tier: 'major', did: 'Fell 2,000 creatures.', grant: { STR: 3 }, check: (s) => felled(s) >= 2000 },
  { id: 'whole_bestiary', name: 'The Whole Bestiary', tier: 'major', did: 'Fell creatures of 10 different families.', grant: { AGI: 2, VIT: 1 }, check: (s) => families(s) >= 10 },
  { id: 'veteran_shadow', name: 'Veteran Of The Line', tier: 'major', did: 'Have one Shadow land 50 kills.', grant: { STR: 2 }, check: (s) => bestShadow(s) >= 50 },
  { id: 'hundred_gates', name: 'A Hundred Gates', tier: 'major', did: 'Clear 100 Gates.', grant: { VIT: 1, INT: 1, PER: 1 }, check: (s) => s.gates.clears >= 100 },
  { id: 'every_boss', name: 'Every Boss On File', tier: 'major', did: 'Face 25 different Gate bosses.', grant: { free: 3 }, check: (s) => s.gates.bosses.filter((id) => id !== 'DNG-000').length >= 25 },
  { id: 'delver', name: 'Delver', tier: 'major', did: 'Clear 10 Gates.', grant: { STR: 2, VIT: 1 }, check: (s) => s.gates.clears >= 10 },
  { id: 'legendary_find', name: 'Legendary Find', tier: 'major', did: 'Recover an S-Rank item.', grant: { PER: 3 }, check: (s) => s.items.some((it) => defOf(it)?.rank === 'S') },
  { id: 'fully_kitted', name: 'Fully Kitted', tier: 'major', did: `Fill all ${SLOTS.length} equipment slots.`, grant: { free: 2 }, check: (s) => worn(s).length >= SLOTS.length },
  { id: 'well_equipped', name: 'Kitted Properly', tier: 'major', did: 'Reach 300 Equipment Score.', grant: { STR: 1, VIT: 2 }, check: (s) => power(s) >= 300 },
  { id: 'shadow_army', name: 'An Army Of Your Own', tier: 'major', did: 'Bind 5 Shadows.', grant: { free: 3 }, check: (s) => s.shadows.army.length >= 5 },
  { id: 'shadow_legion', name: 'A Legion', tier: 'major', did: 'Bind 10 Shadows.', grant: { slot: 1 }, check: (s) => s.shadows.army.length >= 10 },
  { id: 'read_everything', name: 'The Whole Record', tier: 'major', did: 'Receive every transmission.', grant: { INT: 2, PER: 1 }, check: (s) => BEATS.every((b) => s.story.includes(b.id)) },
  { id: 'regular_company', name: 'Regular Company', tier: 'major', did: 'Clear 10 Gates with the same hunter.', grant: { STR: 1, VIT: 1 }, check: (s) => Object.values(s.gates.together).some((n) => n >= 10) },
  { id: 'wide_acquaintance', name: 'A Wide Acquaintance', tier: 'major', did: 'Raid with 100 different hunters.', grant: { PER: 2, INT: 1 }, check: (s) => s.gates.met.length >= 100 },
  { id: 'every_grade', name: 'The Whole Ladder', tier: 'major', did: 'Raid with a hunter of every grade, E to S.', grant: { PER: 3 }, check: (s) => ['E', 'D', 'C', 'B', 'A', 'S'].every((r) => metGrades(s).has(r)) },

  // Edict: 4 to 5 points
  { id: 'hundred_unbroken', name: 'A Hundred Unbroken', tier: 'legend', did: 'Clear 100 Gates in a row without being carried out.', grant: { all: 1 }, check: (s) => s.gates.bestUnbroken >= 100 },
  { id: 'never_missed', name: 'Not Once', tier: 'legend', did: 'Clear 50 Gates without ever being carried out.', grant: { all: 1 }, check: (s) => s.gates.clears >= 50 && s.gates.fails === 0 },
  { id: 'three_hundred', name: 'Three Hundred', tier: 'legend', did: 'Clear 300 Gates.', grant: { STR: 2, VIT: 2, INT: 1 }, check: (s) => s.gates.clears >= 300 },
  { id: 'six_figures', name: 'Six Figures', tier: 'legend', did: 'Earn 100,000 experience in total.', grant: { free: 5 }, check: (s) => s.stats.xpTotal >= 100000 },
  { id: 'every_gate', name: 'Nothing Left Standing', tier: 'legend', did: `Clear every Gate on file: ${DUNGEONS.length}.`, grant: { STR: 2, AGI: 2 }, check: (s) => DUNGEONS.every((d) => s.gates.cleared.includes(d.id)) },
  { id: 's_rank', name: 'The Highest Grant', tier: 'legend', did: 'Reach S-Rank.', grant: { free: 4 }, check: (s) => gateRank(s) === 'S' },
  { id: 'sovereign', name: 'Beyond Classification', tier: 'legend', did: 'Reach Level 100.', grant: { all: 1 }, check: (s) => s.hunter.level >= 100 },
  { id: 'spire_top', name: 'The Top Floor', tier: 'legend', did: `Reach Floor ${SPIRE_TOP} of the Pale Spire.`, grant: { free: 4 }, check: (s) => s.spire.top >= SPIRE_TOP },
  { id: 'shadow_ascendant', name: 'Ascendant', tier: 'legend', did: `Have a Shadow reach ${SHADOW_RANKS[3].name} Rank: ${SHADOW_RANKS[3].kills} kills.`, grant: { slot: 1 }, check: (s) => bestShadow(s) >= SHADOW_RANKS[3].kills },
  { id: 'walked_out_together', name: 'Someone To Walk Out With', tier: 'legend', did: 'Clear 25 Gates with the same hunter.', grant: { PER: 2, VIT: 2 }, check: (s) => Object.values(s.gates.together).some((n) => n >= 25) },

  // Testament: 6 or more
  { id: 's_gate', name: 'What Walked Out', tier: 'myth', did: 'Clear an S-Rank Gate.', grant: { all: 2 }, check: (s) => s.gates.cleared.some((id) => DUNGEONS.find((d) => d.id === id)?.rank === 'S') },
  { id: 'monarch_slain', name: 'The Hollow Throne', tier: 'myth', did: 'Clear the Hollow Throne.', grant: { all: 3 }, check: (s) => s.gates.cleared.includes('DNG-HOLLOW') },
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
  if (m.grant.slot) return `Shadow slots +${m.grant.slot}`;
  if (m.grant.free) return `Ability Points +${m.grant.free}`;
  if (m.grant.all) return `All stats +${m.grant.all}`;
  return Object.entries(deltaOf(m)).map(([k, v]) => `${k} ${v! < 0 ? '' : '+'}${v}`).join(' · ');
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
