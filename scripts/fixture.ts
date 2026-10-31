/**
 * Writes e2e/fixtures/veteran.json: a hunter a few weeks in — C-Rank,
 * classed, geared, with Shadows and a run of Gates behind them — built by the
 * engine itself, so it is always a valid save.
 *
 *   node scripts/run.mjs scripts/fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { defaults } from '@/core/save';
import { autoAllocate, grantXP, optionsAt, pick, syncClass, totalXpFor } from '@/core/progression';
import { autoEquip, grant, issueKit, ofRank, setPieces, upgradeStep } from '@/core/gear';
import { bind } from '@/core/shadows';
import { BEATS } from '@/data/narrative';
import { addDays, dayKey, rng } from '@/core/util';
import { MISSIONS } from '@/core/missions';
import { issue } from '@/core/contracts';
import { seasonOf } from '@/core/spire';

const today = dayKey();
const s = defaults();
s.onboarded = true;
s.createdAt = new Date(Date.now() - 34 * 864e5).toISOString();
s.hunter.name = 'KINTUKKA';
s.hunter.regNo = 'E-048213';
issueKit(s);
grantXP(s, totalXpFor(32) + 400);
s.hunter.attrs.STR += 12;
autoAllocate(s);
s.hunter.points = 4;
syncClass(s);
// The D-Rank skill chosen, the C-Rank one still waiting.
pick(s, 0, optionsAt('STR', 0).names[1]);
const r = rng('fixture');
for (const rank of ['D', 'C', 'C', 'B'] as const) for (const slot of ['Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Weapon', 'Off-Hand', 'Amulet', 'Ring']) {
  const pool = ofRank(rank).filter((d) => d.slot === slot);
  if (r() < 0.55) grant(s, pool[Math.floor(r() * pool.length)].id);
}
grant(s, ofRank('S').find((d) => d.slot === 'Weapon')!.id);
// Two pieces of the Warden set, and the third still to find.
for (const d of setPieces('Warden').slice(0, 2)) grant(s, d.id, `fixture|${d.id}`);
autoEquip(s);
// Something worn, upgraded three steps at the Exchange.
const worn = s.items.findIndex((it) => it.id === s.equipped.hands);
if (worn >= 0) for (let k = 0; k < 3; k++) s.items[worn] = upgradeStep(s.items[worn]) ?? s.items[worn];
for (const id of ['ENM-007', 'ENM-030', 'ENM-052']) bind(s, id, addDays(today, -20));
// One Sworn, with orders of its own; one still Bound.
s.shadows.army[0].kills = 31;
s.shadows.army[0].tactic = 'finish';
s.shadows.army[1].kills = 6;
s.shadows.fresh = [s.shadows.army[2].id];
s.wallet = { shards: 2480, earned: 6200, spent: 3720, bought: 0, receipts: [] };
s.gates.clears = 61; s.gates.fails = 3; s.gates.withdrawn = 4;
s.gates.cleared = ['DNG-000', 'DNG-001', 'DNG-002', 'DNG-004', 'DNG-007', 'DNG-009', 'DNG-011', 'DNG-013', 'DNG-015'];
s.gates.bosses = [...s.gates.cleared, 'DNG-019'];
s.gates.last = 'cleared'; s.gates.unbroken = 11; s.gates.bestUnbroken = 19;
s.gates.sealed = { day: today, ids: ['DNG-015'] };
s.stats = { ...s.stats, extractions: 7, extractionsWon: 3, reachClears: 4, comebacks: 1, killsByFamily: { Undead: 140, Beast: 96, Goblinoid: 61, Orc: 44, Plant: 30 } };
s.log = Array.from({ length: 12 }, (_, i) => ({ day: addDays(today, -Math.floor(i / 3)), kind: 'gate' as const, name: `${['Champion’s Burial March', 'Moonfang Hunting Grounds', 'Totemscar Encampment'][i % 3]} — cleared`, xp: [650, 300, 300][i % 3] }));
// Today's contracts: one done, one under way.
const [done, going] = issue(s, today).list;
Object.assign(done, { got: done.need, done: true });
going.got = Math.floor(going.need / 2);
// A few weeks on the Spire, and this week's climb under way. Last week's pay has been told.
const lastWeek = seasonOf(addDays(today, -7));
s.spire = { season: seasonOf(today), best: 25, top: 40, seasons: 3, last: { season: lastWeek, best: 40, tier: 'B-Rank', shards: 168, item: null } };
// Ascension: three levels open, the second chosen, and half the proof of the fourth.
s.ascension = { level: 2, unlocked: 3, best: 3, proof: { gates: ['DNG-015', 'DNG-016'] }, trialDay: null, trials: 3 };
s.stats.contracts = 41;
s.stats.contractDays = 9;
s.story = BEATS.filter((b) => { try { return b.when(s); } catch { return false; } }).map((b) => b.id);
s.hunter.missions = MISSIONS.filter((m) => { try { return m.check(s); } catch { return false; } }).map((m) => m.id);
s.seen = ['gates-visited', 'shadows-visited', 'ob-licence', 'shop-visited', `spire-week-${lastWeek}`];
s.vitals = { hp: 520, mp: 120, fatigue: 22, at: Date.now(), lockedUntil: null };
writeFileSync('e2e/fixtures/veteran.json', JSON.stringify(s));
console.log('veteran: level', s.hunter.level, 'class', s.hunter.classId, 'items', s.items.length, 'equipped', Object.keys(s.equipped).length);
