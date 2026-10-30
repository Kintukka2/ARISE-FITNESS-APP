/**
 * A raid, chamber by chamber. Each chamber is fought in full, then replayed;
 * between chambers the hunter decides to press on or withdraw. Health is
 * written back after every chamber, so closing the app cannot dodge a loss.
 */
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { LOOT } from '@/data/dungeons';
import { GATE_TUNE } from '@/data/gatetune';
import { classById, classFor } from '@/data/classes';
import { fight, Unit, type Ev, type UnitSpec } from './combat';
import { enemyById, allies as alliesFor, isPractice, type Ally, seal, rankIdx } from './gates';
import { boosted, grant, make, ofRank, rollBonuses, worn as wornItems } from './gear';
import { BOOST_CAP, classBonus, GATE_XP, grantXP, practiceAward, type XpResult } from './progression';
import { licensedRank } from './licence';
import * as shadows from './shadows';
import * as shop from './shop';
import type { Dungeon, Item, OpenRaid, Rank, Save, Shadow } from './types';
import { RANKS } from './types';
import { clamp, dayKey, rng } from './util';
import * as vitals from './vitals';

/** The hunter is the protagonist: an edge on top of their attributes. */
export const HERO = { hp: 2, atk: 1.5 };
/** Enemies scale to an expected party, never the actual one, so every extra body helps. */
export const EXPECTED_PARTY: Record<string, number> = { E: 4, D: 4, C: 5, B: 5, A: 6, S: 6 };
const BOSS_HP = 2.5;
const ROOM_RECOVERY = 0.25;
/** A downed hunter is pulled back up between chambers if the party held. */
const REVIVE = 0.15;
/** What being carried out pays, as a share of a clear. Withdrawing pays this plus a share of the chambers won. */
export const FAIL_SHARE = 0.15;
const WITHDRAW_CAP = 0.6;

export interface Chamber { label: string; foes: string[]; boss: boolean; elite: boolean }

export function plan(d: Dungeon, seed: string): Chamber[] {
  const r = rng('arise|plan|' + seed);
  const out: Chamber[] = [];
  for (let i = 0; i < d.mobRounds; i++) {
    const n = 1 + Math.floor(r() * 3);
    out.push({ label: `Chamber ${i + 1}`, foes: Array.from({ length: n }, () => d.mobs[Math.floor(r() * d.mobs.length)]), boss: false, elite: false });
  }
  if (d.elite) out.push({ label: 'Gatekeeper', foes: [d.elite], boss: false, elite: true });
  out.push({ label: enemyById(d.boss)?.name ?? 'Boss', foes: [d.boss], boss: true, elite: false });
  return out;
}

function classKit(lead: string, tier: number) {
  return {
    kit: CLASS_SKILLS.filter((x) => x.line === lead && x.rung <= tier).map((x) => x.name),
    passives: CLASS_PASSIVES.filter((x) => x.line === lead && x.rung <= tier).map((x) => x.name),
  };
}

/** The hunter as they will actually fight: attributes + class + gear, worn down by fatigue. */
export function heroSpec(s: Save, now = Date.now()): UnitSpec {
  const items = wornItems(s);
  const base = vitals.worn(boosted(s.hunter.attrs, items, classBonus(s), BOOST_CAP), vitals.read(s, now).fatigue);
  const cls = classById(s.hunter.classId);
  const k = cls ? classKit(cls.lead, cls.tier) : { kit: [], passives: [] };
  return { uid: 'hero', name: s.hunter.name, side: 'p', base, ...k, bonus: rollBonuses(items), hpMult: HERO.hp, atkMult: HERO.atk, tag: 'hero' };
}

export function allySpec(a: Ally, i: number): UnitSpec {
  const cls = classFor(a.base, a.rank);
  const k = cls ? classKit(cls.lead, cls.tier) : { kit: [], passives: [] };
  return { uid: `a${i}`, name: a.name, side: 'p', base: a.base, ...k, tag: 'ally', ref: a.id };
}

export function shadowSpec(sh: Shadow, i: number): UnitSpec {
  const e = enemyById(sh.enemyId)!;
  return { uid: `s${i}`, name: e.shadow, side: 'p', base: shadows.statsOf(sh), kit: e.kit, passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, tag: 'shadow', ref: sh.id };
}

export function partySpecs(s: Save, d: Dungeon, day: string, squadIds?: string[], now = Date.now()): UnitSpec[] {
  const squad = squadIds ? squadIds.map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x) : shadows.squad(s);
  return [heroSpec(s, now), ...alliesFor(d, day, licensedRank(s)).map(allySpec), ...(isPractice(d) ? [] : squad).map(shadowSpec)];
}

export interface RosterRow { uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[] }

export interface ChamberResult {
  index: number;
  label: string;
  boss: boolean;
  won: boolean;
  rounds: number;
  log: Ev[];
  /** Everyone as the chamber opened, for the replay to start from. */
  roster: RosterRow[];
  felled: string[];
  kills: Record<string, { kills: number; bosses: number }>;
}

/** Per-gate difficulty, from calibration. Exported so the calibrator can drive it. */
export const tuneOf = (d: Dungeon) => GATE_TUNE[d.id] ?? 1;

function foeUnits(c: Chamber, d: Dungeon, index: number): Unit[] {
  const k = (EXPECTED_PARTY[d.rank] ?? 4) / 3;
  const t = tuneOf(d);
  const units = c.foes.map((id, j) => {
    const e = enemyById(id)!;
    return new Unit({ uid: `e${index}-${j}`, name: e.name, side: 'e', base: e.base, kit: e.kit, passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, hpMult: k * t * (c.boss ? BOSS_HP : 1), atkMult: t, tag: 'foe', ref: e.id });
  });
  const seen: Record<string, number> = {};
  for (const u of units) seen[u.name] = (seen[u.name] ?? 0) + 1;
  const n: Record<string, number> = {};
  for (const u of units) if (seen[u.name] > 1) u.name = `${u.name} ${String.fromCharCode(65 + (n[u.name] = (n[u.name] ?? 0) + 1) - 1)}`;
  return units;
}

export const enemyActions = (d: Dungeon) => Math.max(1, Math.round((EXPECTED_PARTY[d.rank] ?? 4) / 3));

/** Fight one chamber. Mutates the party's units (health, statuses). */
export function runChamber(d: Dungeon, seed: string, index: number, party: Unit[], chambers = plan(d, seed)): ChamberResult {
  const c = chambers[index];
  const foes = foeUnits(c, d, index);
  const roster: RosterRow[] = [...party, ...foes].map((u) => ({ uid: u.uid, name: u.name, side: u.side, tag: u.tag, mx: u.maxHp, hp: Math.max(0, Math.round(u.hp)), status: Object.keys(u.status) }));
  const kills: ChamberResult['kills'] = {};
  const felled: string[] = [];
  const res = fight(party, foes, rng(`arise|raid|${seed}|${index}`), enemyActions(d), (killer, victim) => {
    if (victim.side === 'e' && victim.ref) felled.push(victim.ref);
    if (killer?.tag === 'shadow' && killer.ref && victim.side === 'e') {
      const t = (kills[killer.ref] ??= { kills: 0, bosses: 0 });
      t.kills++;
      if (c.boss) t.bosses++;
    }
  });
  if (res.won) {
    for (const u of party) {
      if (u.alive()) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * (ROOM_RECOVERY + u.d.recovery));
      else if (u.tag === 'hero') u.hp = Math.round(u.maxHp * REVIVE);
    }
  }
  return { index, label: c.label, boss: c.boss, won: res.won, rounds: res.rounds, log: res.log, roster, felled, kills };
}

export const snapshot = (party: Unit[]) => party.map((u) => ({ hp: Math.max(0, u.hp), status: { ...u.status } }));

export function restore(party: Unit[], carried: OpenRaid['carried']) {
  carried.forEach((c, i) => {
    const u = party[i];
    if (!u || !c) return;
    u.hp = Math.min(u.maxHp, c.hp);
    u.status = { ...c.status };
  });
  return party;
}

export const buildParty = (specs: UnitSpec[]) => specs.map((sp) => new Unit(sp));

// ------------------------------------------------------------------ the run, in the save

/** Enter a gate: charge fatigue, open the run. Mutates. */
export function begin(s: Save, d: Dungeon, now = Date.now()): OpenRaid {
  const day = dayKey(now);
  if (!isPractice(d)) vitals.addRaidFatigue(s, d.rank, now);
  const party = buildParty(partySpecs(s, d, day, undefined, now));
  const hero = party[0];
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  hero.hp = Math.max(1, Math.round(hero.maxHp * frac));
  s.gates.raid = {
    dungeonId: d.id, seed: `${d.id}|${now}`, day, at: 0,
    squad: isPractice(d) ? [] : shadows.squad(s).map((x) => x.id),
    carried: snapshot(party), won: 0, felled: [], kills: {}, startHp: hero.hp, bossFaced: false,
  };
  return s.gates.raid;
}

/** Rebuild the live party for an open run. */
export function partyFor(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()) {
  return restore(buildParty(partySpecs(s, d, run.day, run.squad, now)), run.carried);
}

/** Fold a chamber into the open run and write the hunter's health back. Mutates. */
export function record(s: Save, d: Dungeon, run: OpenRaid, party: Unit[], ch: ChamberResult, now = Date.now()) {
  run.at = ch.index + 1;
  run.carried = snapshot(party);
  run.felled.push(...ch.felled);
  if (ch.boss) run.bossFaced = true;
  if (ch.won) run.won += 1;
  for (const [id, k] of Object.entries(ch.kills)) {
    const t = (run.kills[id] ??= { kills: 0, bosses: 0 });
    t.kills += k.kills;
    t.bosses += k.bosses;
  }
  const hero = party[0];
  if (!isPractice(d)) vitals.setHpFraction(s, Math.max(0, hero.hp) / hero.maxHp, now);
}

export type Outcome = 'cleared' | 'withdrawn' | 'defeated';

export interface Lingering { enemyId: string; boss: boolean; cost: number }

export interface RaidResult {
  outcome: Outcome;
  dungeonId: string;
  shards: number;
  bounty: number;
  /** Experience paid, and the levels it bought. Null when it paid nothing. */
  xp: XpResult | null;
  loot: Item[];
  lingering: Lingering[];
  chambersWon: number;
  chambers: number;
  /** The hunter's health afterwards, on the real (vitals) scale. */
  heroHp: number;
  heroMax: number;
  allies: string[];
}

export const withdrawShare = (done: number, total: number) => FAIL_SHARE + (1 - FAIL_SHARE) * WITHDRAW_CAP * Math.min(1, done / Math.max(1, total));

function rollLoot(d: Dungeon, r: () => number, mobChambers: number, complete: boolean): string[] {
  const at = rankIdx(d.rank);
  const shift = (n: number) => RANKS[clamp(at + n, 0, 5)];
  const pick = (rank: Rank) => {
    const pool = ofRank(rank);
    return pool[Math.floor(r() * pool.length)]?.id;
  };
  const out: string[] = [];
  for (let i = 0; i < mobChambers; i++) {
    if (r() > LOOT.mobFoundChance) continue;
    const n = LOOT.mobQuantity[0] + Math.floor(r() * (LOOT.mobQuantity[1] - LOOT.mobQuantity[0] + 1));
    for (let k = 0; k < n; k++) {
      const x = r();
      const id = pick(x < LOOT.mobRank.same ? shift(0) : x < LOOT.mobRank.same + LOOT.mobRank.minus1 ? shift(-1) : shift(-2));
      if (id) out.push(id);
    }
  }
  if (complete) {
    const n = LOOT.completionQuantity[0] + Math.floor(r() * (LOOT.completionQuantity[1] - LOOT.completionQuantity[0] + 1));
    for (let k = 0; k < n; k++) {
      const id = pick(d.rank !== 'S' && r() > LOOT.completionRank.same ? shift(1) : shift(0));
      if (id) out.push(id);
    }
  }
  return out;
}

/** Close an open run: pay out, record, seal. Mutates. */
export function finish(s: Save, d: Dungeon, run: OpenRaid, outcome: Outcome, now = Date.now()): RaidResult {
  const chambers = plan(d, run.seed);
  const r = rng('arise|spoils|' + run.seed);
  const mobChambers = Math.min(run.won, d.mobRounds);
  const practice = isPractice(d);
  const share = outcome === 'cleared' ? 1 : outcome === 'withdrawn' ? withdrawShare(run.won, chambers.length) : FAIL_SHARE;
  const firstClear = outcome === 'cleared' && !s.gates.cleared.includes(d.id);
  const shards = practice ? 0 : shop.earn(s, shop.gateShards(d.rank, share));
  const bounty = firstClear && !practice ? shop.earn(s, shop.gateShards(d.rank, 2)) : 0;
  // Read the grade before the experience lands: a level-up must not decide whether this was a
  // reach, or redraw the allies who were actually in the party.
  const reach = outcome === 'cleared' && rankIdx(d.rank) > rankIdx(licensedRank(s));
  const allies = alliesFor(d, run.day, licensedRank(s));
  const gateXp = GATE_XP[d.rank as Rank] ?? 0;
  const xpDue = practice ? (outcome === 'cleared' ? practiceAward(s) : 0) : Math.round(gateXp * share) + (firstClear ? gateXp : 0);
  const xp = xpDue > 0 ? grantXP(s, xpDue) : null;

  let lootIds = outcome === 'defeated' ? [] : rollLoot(d, r, mobChambers, outcome === 'cleared');
  if (practice) {
    const rings = ofRank('E').filter((g) => g.slot === 'Ring');
    lootIds = [rings[Math.floor(rng('arise|practice|' + s.hunter.name)() * rings.length)].id];
  }
  const loot = lootIds.map((id, i) => grant(s, id, `${run.seed}|${i}`) ?? make(id)).filter(Boolean);

  const lingering: Lingering[] = [];
  if (outcome === 'cleared' && !practice) {
    const seen = new Set<string>();
    const kills = [...run.felled].reverse(); // boss last in, first considered
    for (const id of kills) {
      const e = enemyById(id);
      if (!e || seen.has(id) || shadows.isBound(s, id) || lingering.length >= 2) continue;
      seen.add(id);
      const boss = id === d.boss;
      if (r() < shadows.lingerChance(s, boss)) lingering.push({ enemyId: id, boss, cost: shadows.EXTRACT_MP[e.rank] ?? 50 });
    }
  }

  // Records.
  if (!practice) {
    const tally = (s.gates.runs[d.id] ??= { fought: 0, cleared: 0 });
    tally.fought++;
    if (outcome === 'cleared') tally.cleared++;
    if (outcome === 'cleared') s.gates.clears++;
    else if (outcome === 'withdrawn') s.gates.withdrawn++;
    else s.gates.fails++;
    if (outcome === 'cleared') {
      if (s.gates.last === 'defeated') s.stats.comebacks++;
      if (reach) s.stats.reachClears++;
      s.gates.unbroken++;
      s.gates.bestUnbroken = Math.max(s.gates.bestUnbroken, s.gates.unbroken);
    } else if (outcome === 'defeated') s.gates.unbroken = 0;
    s.gates.last = outcome;
    for (const a of allies) {
      if (!s.gates.met.includes(a.id)) s.gates.met.push(a.id);
      if (outcome === 'cleared') s.gates.together[a.id] = (s.gates.together[a.id] ?? 0) + 1;
    }
    for (const id of run.felled) {
      const fam = enemyById(id)?.family;
      if (fam) s.stats.killsByFamily[fam] = (s.stats.killsByFamily[fam] ?? 0) + 1;
    }
    for (const id of run.squad) {
      const sh = s.shadows.army.find((x) => x.id === id);
      if (!sh) continue;
      sh.out++;
      sh.kills += run.kills[id]?.kills ?? 0;
      sh.bosses += run.kills[id]?.bosses ?? 0;
    }
  }
  if (run.bossFaced && !s.gates.bosses.includes(d.id)) s.gates.bosses.push(d.id);
  if (outcome === 'cleared') {
    if (!s.gates.cleared.includes(d.id)) s.gates.cleared.push(d.id);
    seal(s, d, dayKey(now));
  }
  if (outcome === 'defeated' && !practice) vitals.wipe(s, now);
  const v = vitals.read(s, now);
  s.gates.raid = null;
  s.log.unshift({ day: dayKey(now), kind: 'gate', name: `${d.name} — ${outcome}`, xp: xp?.gained ?? 0 });
  s.log.length = Math.min(s.log.length, 400);
  return {
    outcome, dungeonId: d.id, shards, bounty, xp, loot, lingering,
    chambersWon: run.won, chambers: chambers.length,
    heroHp: v.hp, heroMax: v.hpMax, allies: allies.map((a) => a.name),
  };
}

/** Reach for a lingering Shadow. MP is spent whether or not it holds. */
export function extract(s: Save, l: Lingering, roll: number, now = Date.now()): 'bound' | 'lost' | 'no-mana' {
  if (!vitals.spendMp(s, l.cost, now)) return 'no-mana';
  s.stats.extractions++;
  if (roll < shadows.holdChance(s)) {
    s.stats.extractionsWon++;
    shadows.bind(s, l.enemyId, dayKey(now));
    return 'bound';
  }
  return 'lost';
}

// ------------------------------------------------------------------ projection

/**
 * The brief's verdict: run the gate headlessly and count. No hand-tuned
 * ladder to drift out of date — the engine answers for itself.
 */
export function project(s: Save, d: Dungeon, runs = 24, now = Date.now()) {
  const day = dayKey(now);
  const specs = partySpecs(s, d, day, undefined, now);
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  let cleared = 0;
  let heroDown = 0;
  let reached = 0;
  for (let i = 0; i < runs; i++) {
    const seed = `proj|${d.id}|${day}|${i}`;
    const chambers = plan(d, seed);
    const party = buildParty(specs);
    party[0].hp = Math.max(1, Math.round(party[0].maxHp * frac));
    let won = true;
    for (let c = 0; c < chambers.length && won; c++) {
      const res = runChamber(d, seed, c, party, chambers);
      won = res.won;
      if (c === chambers.length - 1) reached++;
    }
    if (won) cleared++;
    if (!won && party[0].hp <= 0) heroDown++;
  }
  return { runs, cleared, rate: cleared / runs, heroDown, reachedBoss: reached };
}

export function verdict(rate: number): { tone: 'ready' | 'even' | 'over'; text: string } {
  if (rate >= 0.9) return { tone: 'ready', text: 'The party will be fine.' };
  if (rate >= 0.7) return { tone: 'ready', text: 'The party should be fine.' };
  if (rate >= 0.4) return { tone: 'even', text: 'The party will struggle.' };
  if (rate >= 0.15) return { tone: 'over', text: 'The party will most likely be defeated.' };
  return { tone: 'over', text: 'The party is doomed.' };
}
