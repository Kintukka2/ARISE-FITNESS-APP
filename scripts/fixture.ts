/**
 * Writes e2e/fixtures/veteran.json: a hunter a few weeks in — C-Rank,
 * classed, geared, with Shadows and a run of Gates behind them — and
 * e2e/fixtures/ascended.json: one at S-Rank, a few levels into Ascension. Both
 * are built by the engine itself, so they are always valid saves.
 *
 *   node scripts/run.mjs scripts/fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { defaults } from '@/core/save';
import { autoAllocate, grantXP, reclassifyAll, syncClass, totalXpFor } from '@/core/progression';
import { autoLearn, equip, learn, points } from '@/core/skilltree';
import { autoEquip, defOf, grant, issueKit, ofRank, saveLoadout, setPieces, upgradeStep } from '@/core/gear';
import { bind, raise, xpAt } from '@/core/shadows';
import { BEATS } from '@/data/narrative';
import { addDays, dayKey, rng } from '@/core/util';
import { MISSIONS } from '@/core/missions';
import { issue } from '@/core/contracts';
import { seasonOf } from '@/core/spire';
import * as association from '@/core/association';

const today = dayKey();
const s = defaults();
s.onboarded = true;
s.createdAt = new Date(Date.now() - 34 * 864e5).toISOString();
s.hunter.name = 'KINTUKKA';
s.hunter.regNo = 'E-048213';
issueKit(s);
grantXP(s, totalXpFor(32) + 400);
reclassifyAll(s);
s.hunter.attrs.STR += 12;
autoAllocate(s);
s.hunter.points = 4;
syncClass(s);
// A build of their own down Ruin, a dip into Bastion, and a few Skill Points still to spend.
for (const id of [
  'STR:rend', 'STR:hammerblow', 'STR:might', 'STR:might', 'STR:might', 'STR:rend', 'STR:rend',
  'STR:heavy-hands', 'STR:heavy-hands', 'STR:skullsplitter', 'STR:skullsplitter', 'STR:sundering-arc', 'STR:hammerblow',
  'VIT:toughness', 'VIT:toughness', 'VIT:shield-blow', 'VIT:shoulder-charge', 'AGI:swiftness',
]) learn(s, id);
equip(s, 'STR:skullsplitter');
if (points(s) < 4) throw new Error(`The veteran should have Skill Points to spend, has ${points(s)}.`);
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
// Two duplicates of the worn weapon's design, to fuse; the last three pieces still New; what is worn, saved as Loadout I.
const weapon = s.items.find((it) => it.id === s.equipped.weapon);
if (weapon && !defOf(weapon)?.issued) for (let k = 0; k < 2; k++) grant(s, weapon.defId, `fixture|dupe|${k}`);
s.newItems = s.items.slice(-3).map((it) => it.id);
saveLoadout(s, 0, addDays(today, -2));
for (const id of ['ENM-007', 'ENM-030', 'ENM-052']) bind(s, id, addDays(today, -20));
// One Sworn at Level 14; one at the Bound cap with the Essence to be promoted, waiting; one new.
Object.assign(s.shadows.army[0], { rank: 1, xp: xpAt(14) + 4, kills: 58, bosses: 1, out: 19 });
Object.assign(s.shadows.army[1], { xp: xpAt(10), kills: 47, bosses: 0, out: 15 });
Object.assign(s.shadows.army[2], { xp: xpAt(3) + 1, kills: 6, out: 2 });
s.shadows.essence = 9;
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
// Ryn's sixth job in hand, half done; two Health Potions and a Gate Survey from the ones before.
s.assoc = { n: 5, quest: null, reported: 5 };
association.issue(s);
s.assoc.quest!.got = Math.floor(s.assoc.quest!.need / 2);
s.stock = { hp: 2, survey: 1 };
s.stats.contracts = 41;
s.stats.contractDays = 9;
s.story = BEATS.filter((b) => { try { return b.when(s); } catch { return false; } }).map((b) => b.id);
s.hunter.missions = MISSIONS.filter((m) => { try { return m.check(s); } catch { return false; } }).map((m) => m.id);
s.seen = ['gates-visited', 'shadows-visited', 'ob-licence', 'shop-visited', `spire-week-${lastWeek}`, 'assoc-told'];
s.vitals = { hp: 380, mp: 120, fatigue: 22, at: Date.now(), lockedUntil: null };
writeFileSync('e2e/fixtures/veteran.json', JSON.stringify(s));
console.log('veteran: level', s.hunter.level, 'class', s.hunter.classId, 'items', s.items.length, 'equipped', Object.keys(s.equipped).length);

// ------------------------------------------------------------------ the ascended hunter

const a = defaults();
a.onboarded = true;
a.createdAt = new Date(Date.now() - 70 * 864e5).toISOString();
a.hunter.name = 'KINTUKKA';
a.hunter.regNo = 'E-048213';
a.licence = { granted: true, at: a.createdAt, tx: null };
issueKit(a);
grantXP(a, totalXpFor(88) + 900);
reclassifyAll(a);
a.hunter.attrs.STR += 30;
autoAllocate(a);
syncClass(a);
autoLearn(a);
const ra = rng('fixture|ascended');
for (const rank of ['A', 'S', 'S'] as const) for (const slot of ['Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Weapon', 'Off-Hand', 'Amulet', 'Ring']) {
  const pool = ofRank(rank).filter((d) => d.slot === slot);
  grant(a, pool[Math.floor(ra() * pool.length)].id);
}
autoEquip(a);
a.newItems = [];
for (const id of ['ENM-099', 'ENM-101', 'ENM-103', 'ENM-105', 'ENM-106']) bind(a, id, addDays(today, -30));
// An Ascendant, two Vanguards and two Sworn, and the Essence towards the next.
a.shadows.army.forEach((x, i) => { raise(x, [3, 2, 2, 1, 1][i]); x.xp = Math.min(xpAt([36, 30, 27, 20, 16][i]) + 3, x.xp); x.kills = 420 - i * 70; x.bosses = 14 - i * 3; x.out = 160 - i * 25; });
// Igris at the top, two stars awakened, with the Essence for a third.
Object.assign(a.shadows.army[0], { xp: xpAt(40), stars: 2 });
a.shadows.essence = 52;
a.wallet = { shards: 6400, earned: 41000, spent: 34600, bought: 0, receipts: [] };
a.gates.clears = 240; a.gates.fails = 9; a.gates.withdrawn = 7;
a.gates.cleared = ['DNG-000', ...Array.from({ length: 50 }, (_, i) => `DNG-${String(i + 1).padStart(3, '0')}`)];
a.gates.bosses = [...a.gates.cleared];
a.gates.entered = [...a.gates.cleared];
a.gates.last = 'cleared'; a.gates.unbroken = 23; a.gates.bestUnbroken = 41;
issue(a, today);
a.contracts.seen = true;
a.spire = { season: seasonOf(today), best: 95, top: 105, seasons: 8, last: { season: lastWeek, best: 105, tier: 'S-Rank', shards: 900, item: null } };
// Ascension: three levels open, the second chosen, the S-Rank Gates proved at the third so its Trial
// stands open, one mark still to set, and the three Chosen those Trials sent out, the first felled.
a.ascension = { level: 2, unlocked: 3, best: 3, proof: { gates: ['DNG-048', 'DNG-049', 'DNG-050'] }, trialDay: null, trials: 3, marks: { edge: 1, legion: 1 }, sent: [1, 2, 3], felled: [1] };
a.story = BEATS.filter((b) => { try { return b.when(a); } catch { return false; } }).map((b) => b.id);
a.hunter.missions = MISSIONS.filter((m) => { try { return m.check(a); } catch { return false; } }).map((m) => m.id);
// Everything seen but the Ascension tile's walkthrough, which the screens capture.
a.seen = ['gates-visited', 'shadows-visited', 'ob-licence', 'shop-visited', `spire-week-${lastWeek}`, 'turn-told', 'assoc-told'];
// A Shadow with a name, and Ryn's job done, waiting to be reported.
a.shadows.army[0].name = 'Igris';
a.assoc = { n: 22, quest: null, reported: 22 };
association.issue(a);
a.assoc.quest!.got = a.assoc.quest!.need;
a.vitals = { hp: 99999, mp: 9999, fatigue: 8, at: Date.now(), lockedUntil: null };
writeFileSync('e2e/fixtures/ascended.json', JSON.stringify(a));
console.log('ascended: level', a.hunter.level, 'rank', a.hunter.rank, 'class', a.hunter.classId, 'Ascension', a.ascension.unlocked);
