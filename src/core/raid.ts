/**
 * A raid, step by step down the gate's map. The hunter picks each step and
 * fights their own turns; only a rest lets them withdraw. Every order and
 * every choice is written to the save before it plays out, and health after
 * every step, so closing the app can neither dodge a loss nor reroll a turn.
 * What the run finds is banked on it and paid out once, in `finish`.
 */
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { LOOT } from '@/data/dungeons';
import { GATE_TUNE } from '@/data/gatetune';
import { classById, classFor } from '@/data/classes';
import { BLESSINGS, blessingById, eventById, FIGHT_PURSE, REST_HEAL, TRAP, type Choice, type Effect, type GateEvent } from '@/data/nodes';
import { battle, STATUS, Unit, type Ev, type FightResult, type Turn, type UnitSpec } from './combat';
import { build, chamberOf, isFight, mapSeed, next, systemRoad, type Chamber, type GateMap, type MapNode } from './map';
import { enemyById, allies as alliesFor, isPractice, type Ally, seal, rankIdx } from './gates';
import { boosted, grant, make, ofRank, rollBonuses, worn as wornItems } from './gear';
import { BOOST_CAP, classBonus, GATE_XP, grantXP, practiceAward, type XpResult } from './progression';
import { licensedRank } from './licence';
import * as contracts from './contracts';
import * as shadows from './shadows';
import * as spire from './spire';
import * as shop from './shop';
import type { Dungeon, Item, OpenRaid, Order, Rank, Save, Shadow, Tactic } from './types';
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
/** What being carried out pays, as a share of a clear. Withdrawing pays this plus a share of the steps taken. */
export const FAIL_SHARE = 0.15;
const WITHDRAW_CAP = 0.6;

export type { Chamber };

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
  return { uid: `a${i}`, name: a.name, side: 'p', base: a.base, ...k, tag: 'ally', ref: a.id, atkMult: a.atkMult };
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

/** Per-gate difficulty, from calibration, or a Spire block's own. Exported so the calibrator can drive it. */
export const tuneOf = (d: Dungeon) => d.scale ?? GATE_TUNE[d.id] ?? 1;

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

/** A chamber being fought, one hunter's turn at a time. */
export interface ChamberFight {
  /** Everyone as the chamber opened, for the arena to draw from. */
  roster: RosterRow[];
  /** Every event so far. It grows as the fight goes on. */
  log: Ev[];
  /** The hunter's turn, waiting for an order. Null once the chamber is decided. */
  turn: Turn | null;
  /** Answer the waiting turn: an order, or null to let the System choose. */
  play(order: Order | null): void;
  /** The decided chamber. Throws while it is still being fought. */
  result(): ChamberResult;
}

export interface ChamberOpts {
  /** The hunter fights their own turns. Otherwise the auto policy fights them, and nothing waits. */
  manual?: boolean;
  tactic?: Tactic;
  /** Field potions the hunter has to drink in this chamber. */
  potions?: number;
  /** Orders already given in this chamber, replayed silently to bring it back to where it was. */
  orders?: (Order | null)[];
}

/** Open one chamber, `index` steps into the gate. Mutates the party's units (health, statuses) as it is fought. */
export function openChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, opts: ChamberOpts = {}): ChamberFight {
  const foes = foeUnits(c, d, index);
  const roster: RosterRow[] = [...party, ...foes].map((u) => ({ uid: u.uid, name: u.name, side: u.side, tag: u.tag, mx: u.maxHp, hp: Math.max(0, Math.round(u.hp)), status: Object.keys(u.status) }));
  const kills: ChamberResult['kills'] = {};
  const felled: string[] = [];
  const log: Ev[] = [];
  const g = battle(party, foes, rng(`arise|raid|${seed}|${index}`), enemyActions(d), (killer, victim) => {
    if (victim.side === 'e' && victim.ref) felled.push(victim.ref);
    if (killer?.tag === 'shadow' && killer.ref && victim.side === 'e') {
      const t = (kills[killer.ref] ??= { kills: 0, bosses: 0 });
      t.kills++;
      if (c.boss) t.bosses++;
    }
  }, log, { hero: opts.manual ? party[0]?.uid : undefined, tactic: opts.tactic, potions: opts.potions });
  let step: IteratorResult<Turn, FightResult> = g.next();
  for (const o of opts.orders ?? []) if (!step.done) step = g.next(o);
  let done: ChamberResult | null = null;
  return {
    roster,
    log,
    get turn() { return step.done ? null : step.value; },
    play(order) { if (!step.done) step = g.next(order); },
    result() {
      if (!step.done) throw new Error('The chamber is still being fought.');
      if (done) return done;
      const res = step.value;
      if (res.won) {
        for (const u of party) {
          if (u.alive()) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * (ROOM_RECOVERY + u.d.recovery));
          else if (u.tag === 'hero') u.hp = Math.round(u.maxHp * REVIVE);
        }
      }
      done = { index, label: c.label, boss: c.boss, won: res.won, rounds: res.rounds, log: res.log, roster, felled, kills };
      return done;
    },
  };
}

/** Fight one chamber to the end on the auto policy. Mutates the party's units (health, statuses). */
export function runChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, tactic: Tactic = 'default'): ChamberResult {
  return openChamber(d, seed, index, party, c, { tactic }).result();
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

/** The party's specs with the run's blessings worked into the hunter's. */
export function blessed(specs: UnitSpec[], blessings: string[]): UnitSpec[] {
  if (!blessings.length) return specs;
  const [hero, ...rest] = specs;
  const bonus = { ...(hero.bonus ?? {}) };
  for (const id of blessings) for (const [k, v] of Object.entries(blessingById(id)?.bonus ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
  return [{ ...hero, bonus }, ...rest];
}

// ------------------------------------------------------------------ what a step does to the party

/** A rest: the standing recover, and what ails them lifts. Mutates. */
export function rest(party: Unit[]) {
  for (const u of party) {
    if (!u.alive()) continue;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * REST_HEAL);
    for (const st of Object.keys(u.status)) if (!STATUS[st]?.good) delete u.status[st];
  }
}

/** Apply what an effect does to bodies: hurt and status land on the hunter, healing on everyone standing. Mutates. */
export function touch(party: Unit[], e: Effect) {
  const hero = party[0];
  if (e.hurt && hero) hero.hp = Math.max(1, hero.hp - hero.maxHp * e.hurt);
  if (e.heal) for (const u of party) if (u.alive()) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * e.heal);
  if (e.status && hero && STATUS[e.status]) hero.status[e.status] = STATUS[e.status].turns;
}

/** The odds a choice goes well, for this hunter. */
export function oddsOf(c: Choice, hero: UnitSpec): number {
  if (c.check) return clamp(c.check.base + hero.base[c.check.stat] * c.check.per, c.check.base, c.check.max);
  return c.odds ?? 1;
}

/** What a choice node offers: its event, or the trap. */
export const eventAt = (x: MapNode): GateEvent | null => (x.kind === 'trap' ? TRAP : x.kind === 'event' && x.event ? eventById(x.event) ?? null : null);

/** The choice the System makes at a shrine, a trap or an event. */
export const systemChoice = (x: MapNode) => (x.kind === 'shrine' ? 0 : Math.max(0, eventAt(x)?.choices.findIndex((c) => c.system) ?? 0));

// ------------------------------------------------------------------ the run, in the save

/** Enter a gate: charge fatigue, open the run. Mutates. */
export function begin(s: Save, d: Dungeon, now = Date.now()): OpenRaid {
  const day = dayKey(now);
  const fatigue = vitals.read(s, now).fatigue;
  if (!isPractice(d)) vitals.addRaidFatigue(s, d.rank, now);
  const specs = partySpecs(s, d, day, undefined, now);
  const party = buildParty(specs);
  const hero = party[0];
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  hero.hp = Math.max(1, Math.round(hero.maxHp * frac));
  s.gates.raid = {
    dungeonId: d.id, seed: `${d.id}|${now}`, day, at: 0,
    squad: isPractice(d) ? [] : shadows.squad(s).map((x) => x.id),
    carried: snapshot(party), won: 0, felled: [], kills: {}, startHp: hero.hp, bossFaced: false,
    party: specs, tactic: s.gates.tactic, orders: [],
    map: mapSeed(d, day), path: [], haul: [], purse: 0, blessings: [], lost: false, fatigue,
  };
  return s.gates.raid;
}

/** The map an open run is walking. */
export const mapOf = (d: Dungeon, run: OpenRaid): GateMap => build(d, run.map ?? mapSeed(d, run.day));

/** The step chosen but not yet done: a fight underway, or a choice waiting to be made. */
export function pending(d: Dungeon, run: OpenRaid): MapNode | null {
  const path = run.path ?? [];
  return path.length > run.at ? mapOf(d, run).byId[path[run.at]] ?? null : null;
}

/** Where the hunter can step next. Nothing, while a step is still underway. */
export function options(d: Dungeon, run: OpenRaid): MapNode[] {
  if (pending(d, run) || run.lost) return [];
  return next(mapOf(d, run), run.path ?? []);
}

/** The last step taken was a rest, and nothing else is underway: the only time a run can be walked away from. */
export function canWithdraw(d: Dungeon, run: OpenRaid): boolean {
  const path = run.path ?? [];
  if (run.at === 0 || run.lost || pending(d, run)) return false;
  return mapOf(d, run).byId[path[run.at - 1]]?.kind === 'rest';
}

/** Every step the run has finished, in order. */
export const walked = (d: Dungeon, run: OpenRaid) => {
  const m = mapOf(d, run);
  return (run.path ?? []).slice(0, run.at).map((id) => m.byId[id]).filter(Boolean);
};

/** A piece of gear for the haul, drawn for one step: at the gate's grade, or `shift` grades from it. */
function haulPiece(d: Dungeon, roll: () => number, shift: number): string | null {
  const rank = RANKS[clamp(rankIdx(d.rank) + shift, 0, 5)];
  const pool = ofRank(rank);
  return pool[Math.floor(roll() * pool.length)]?.id ?? null;
}

/** Write the run's party back after a step changed it, and the hunter's health to their vitals. Mutates. */
function settleParty(s: Save, d: Dungeon, run: OpenRaid, party: Unit[], now: number) {
  run.carried = snapshot(party);
  const hero = party[0];
  if (!isPractice(d)) vitals.setHpFraction(s, Math.max(0, hero.hp) / hero.maxHp, now);
}

export interface StepResult {
  node: MapNode;
  /** A cache's piece, banked for the end of the run. */
  item?: string;
}

/**
 * Take a step. A rest or a cache is done at once; a fight waits for the arena,
 * and a shrine, a trap or an event waits for `resolve`. Null if the step is
 * not one the hunter can take. Mutates.
 */
export function choose(s: Save, d: Dungeon, run: OpenRaid, id: string, now = Date.now()): StepResult | null {
  const x = options(d, run).find((o) => o.id === id);
  if (!x) return null;
  run.path = [...(run.path ?? []), id];
  run.orders = [];
  const out: StepResult = { node: x };
  if (x.kind === 'rest') {
    const party = partyFor(s, d, run, now);
    rest(party);
    settleParty(s, d, run, party, now);
    run.at += 1;
  } else if (x.kind === 'treasure') {
    const item = haulPiece(d, rng(`arise|cache|${run.seed}|${id}`), -1);
    if (item) { (run.haul ??= []).push(item); out.item = item; }
    run.at += 1;
  }
  return out;
}

export interface Resolution { node: MapNode; choice: number; odds: number; won: boolean; effect: Effect; item?: string; blessing?: string }

/** Make the waiting choice at a shrine, a trap or an event. The roll is the run's own. Null if nothing waits. Mutates. */
export function resolve(s: Save, d: Dungeon, run: OpenRaid, choice: number, now = Date.now()): Resolution | null {
  const x = pending(d, run);
  if (!x || isFight(x)) return null;
  const party = partyFor(s, d, run, now);
  const roll = rng(`arise|choice|${run.seed}|${x.id}`);
  let out: Resolution;
  if (x.kind === 'shrine') {
    const blessing = x.offer?.[choice] ?? x.offer?.[0];
    if (!blessing) return null;
    run.blessings = [...(run.blessings ?? []), blessing];
    out = { node: x, choice, odds: 1, won: true, effect: { text: `${blessingById(blessing)?.name}: ${blessingById(blessing)?.text}.` }, blessing };
  } else {
    const ev = eventAt(x);
    const c = ev?.choices[choice];
    if (!ev || !c) return null;
    const odds = oddsOf(c, run.party[0]);
    const won = roll() < odds;
    const effect = won ? c.win : c.lose ?? c.win;
    out = { node: x, choice, odds, won, effect };
    touch(party, effect);
    if (effect.item) {
      const item = haulPiece(d, roll, 0);
      if (item) { (run.haul ??= []).push(item); out.item = item; }
    }
    if (effect.shards && !isPractice(d)) run.purse = (run.purse ?? 0) + shop.gateShards(d.rank, effect.shards);
    if (effect.bless) {
      const free = BLESSINGS.filter((b) => !(run.blessings ?? []).includes(b.id));
      const b = free[Math.floor(roll() * free.length)];
      if (b) { run.blessings = [...(run.blessings ?? []), b.id]; out.blessing = b.id; }
    }
  }
  settleParty(s, d, run, rebless(party, run.party, run.blessings ?? []), now);
  run.at += 1;
  return out;
}

/**
 * The same bodies, rebuilt on a new set of blessings. A blessing changes what a
 * unit is, not how hurt it is; maximum HP it adds arrives as HP too, so health
 * written back as a share of the maximum does not drop.
 */
export function rebless(party: Unit[], specs: UnitSpec[], blessings: string[]): Unit[] {
  const fresh = restore(buildParty(blessed(specs, blessings)), snapshot(party));
  fresh.forEach((u, i) => {
    const grew = u.maxHp - (party[i]?.maxHp ?? u.maxHp);
    if (grew > 0 && u.alive()) u.hp = Math.min(u.maxHp, u.hp + grew);
  });
  return fresh;
}

/** The fight underway in an open run, brought back to exactly where its orders left it. */
export function resume(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()) {
  const x = pending(d, run);
  if (!x || !isFight(x)) throw new Error('No fight is underway.');
  const party = partyFor(s, d, run, now);
  const orders = run.orders ?? [];
  // The satchel has already paid for the potions this chamber's orders drank.
  const potions = s.satchel + orders.filter((o) => o?.use === 'Potion').length;
  const ch = openChamber(d, run.seed, x.layer, party, chamberOf(d, x), { manual: true, tactic: run.tactic ?? 'default', potions, orders });
  return { party, ch, node: x };
}

/**
 * Write the hunter's order to the save, before it plays out. A potion is paid
 * for here, out of the satchel; one the satchel cannot pay for becomes the
 * System's choice. Returns the order as it will be played. Mutates.
 */
export function order(s: Save, run: OpenRaid, o: Order | null): Order | null {
  let given = o;
  if (given?.use === 'Potion') {
    if (s.satchel > 0) s.satchel -= 1;
    else given = null;
  }
  run.orders = [...(run.orders ?? []), given];
  return given;
}

/**
 * Rebuild the live party for an open run, as it walked in, with the blessings
 * it has picked up since. Gear swapped, points spent or fatigue slept off do not
 * reach it: a chamber replayed from its orders must meet the same party.
 */
export function partyFor(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()) {
  const specs = run.party?.length ? run.party : partySpecs(s, d, run.day, run.squad, now);
  return restore(buildParty(blessed(specs, run.blessings ?? [])), run.carried);
}

/** Fold a fought chamber into the open run and write the hunter's health back. Mutates. */
export function record(s: Save, d: Dungeon, run: OpenRaid, party: Unit[], ch: ChamberResult, now = Date.now()) {
  const x = pending(d, run);
  run.at += 1;
  run.orders = [];
  run.felled.push(...ch.felled);
  if (ch.boss) run.bossFaced = true;
  if (ch.won) {
    run.won += 1;
    const share = x?.kind === 'fight' ? FIGHT_PURSE.fight : x?.kind === 'elite' ? FIGHT_PURSE.elite : 0;
    if (share && !isPractice(d)) run.purse = (run.purse ?? 0) + shop.gateShards(d.rank, share);
  } else run.lost = true;
  for (const [id, k] of Object.entries(ch.kills)) {
    const t = (run.kills[id] ??= { kills: 0, bosses: 0 });
    t.kills += k.kills;
    t.bosses += k.bosses;
  }
  settleParty(s, d, run, party, now);
}

export type Outcome = 'cleared' | 'withdrawn' | 'defeated';

export interface Lingering { enemyId: string; boss: boolean; cost: number }

export interface RaidResult {
  outcome: Outcome;
  dungeonId: string;
  /** Everything the run paid in shards, the clear's share and what it banked on the way. */
  shards: number;
  /** Of those, what fights and finds banked on the way. */
  banked: number;
  bounty: number;
  /** Experience paid, and the levels it bought. Null when it paid nothing. */
  xp: XpResult | null;
  loot: Item[];
  lingering: Lingering[];
  /** Steps taken, of the steps from the gate to the boss. */
  steps: number;
  depth: number;
  /** The System contracts this run completed, and what they paid. */
  contracts: contracts.ContractReport;
  /** A Spire block: the floor it reached, and whether that is the week's best. */
  spire: { floor: number; best: boolean } | null;
  /** The hunter's health afterwards, on the real (vitals) scale. */
  heroHp: number;
  heroMax: number;
  allies: string[];
}

export const withdrawShare = (done: number, total: number) => FAIL_SHARE + (1 - FAIL_SHARE) * WITHDRAW_CAP * Math.min(1, done / Math.max(1, total));

/** What the fights paid in gear: a chance per fight, a sure piece per gatekeeper, and the clear's. */
function rollLoot(d: Dungeon, r: () => number, fights: number, elites: number, complete: boolean): string[] {
  const at = rankIdx(d.rank);
  const shift = (n: number) => RANKS[clamp(at + n, 0, 5)];
  const pick = (rank: Rank) => {
    const pool = ofRank(rank);
    return pool[Math.floor(r() * pool.length)]?.id;
  };
  const out: string[] = [];
  for (let i = 0; i < fights; i++) {
    if (r() > LOOT.mobFoundChance) continue;
    const n = LOOT.mobQuantity[0] + Math.floor(r() * (LOOT.mobQuantity[1] - LOOT.mobQuantity[0] + 1));
    for (let k = 0; k < n; k++) {
      const x = r();
      const id = pick(x < LOOT.mobRank.same ? shift(0) : x < LOOT.mobRank.same + LOOT.mobRank.minus1 ? shift(-1) : shift(-2));
      if (id) out.push(id);
    }
  }
  for (let i = 0; i < elites; i++) {
    const id = pick(d.rank !== 'S' && r() > LOOT.completionRank.same ? shift(1) : shift(0));
    if (id) out.push(id);
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

/** Close an open run: pay out, record, seal. A withdrawal is only ever from a rest. Mutates. */
export function finish(s: Save, d: Dungeon, run: OpenRaid, outcome: Outcome, now = Date.now()): RaidResult {
  if (outcome === 'withdrawn' && !canWithdraw(d, run)) throw new Error('A run is only walked away from at a rest.');
  const depth = mapOf(d, run).layers.length;
  const steps = walked(d, run);
  const r = rng('arise|spoils|' + run.seed);
  const practice = isPractice(d);
  // A block of the Spire is fought and paid as a gate. It has no first clear, and is never sealed:
  // the week's best floor moves on past it instead.
  const tower = spire.isSpire(d);
  const kept = outcome !== 'defeated';
  const share = outcome === 'cleared' ? 1 : outcome === 'withdrawn' ? withdrawShare(run.at, depth) : FAIL_SHARE;
  const firstClear = outcome === 'cleared' && !tower && !s.gates.cleared.includes(d.id);
  const banked = kept && !practice ? shop.earn(s, run.purse ?? 0) : 0;
  const shards = (practice ? 0 : shop.earn(s, shop.gateShards(d.rank, share))) + banked;
  const bounty = firstClear && !practice ? shop.earn(s, shop.gateShards(d.rank, 2)) : 0;
  // Read the grade before the experience lands: a level-up must not decide whether this was a
  // reach, or redraw the allies who were actually in the party.
  const reach = outcome === 'cleared' && rankIdx(d.rank) > rankIdx(licensedRank(s));
  const allies = alliesFor(d, run.day, licensedRank(s));
  const fights = steps.filter((x) => x.kind === 'fight').length;
  const elites = steps.filter((x) => x.kind === 'elite').length;
  // The contracts count what the run did, and their experience lands with the gate's.
  const road = systemRoad(mapOf(d, run));
  const deal = practice ? contracts.nothing() : contracts.count(s, {
    rank: d.rank, cleared: outcome === 'cleared', fatigue: run.fatigue ?? 0, felled: run.felled,
    shadowKills: run.squad.reduce((n, id) => n + (run.kills[id]?.kills ?? 0), 0),
    elites: elites - (run.lost && steps[steps.length - 1]?.kind === 'elite' ? 1 : 0),
    offroad: (run.path ?? []).some((id, i) => id !== road[i]),
  }, dayKey(now));
  const gateXp = GATE_XP[d.rank as Rank] ?? 0;
  const xpDue = (practice ? (outcome === 'cleared' ? practiceAward(s) : 0) : Math.round(gateXp * share) + (firstClear ? gateXp : 0)) + deal.xp;
  const xp = xpDue > 0 ? grantXP(s, xpDue) : null;

  // Carried out, the party leaves with nothing it found; walking out, it keeps everything.
  let lootIds = kept ? [...rollLoot(d, r, fights, elites, outcome === 'cleared'), ...(run.haul ?? [])] : [];
  if (practice) {
    const rings = ofRank('E').filter((g) => g.slot === 'Ring');
    lootIds = [rings[Math.floor(rng('arise|practice|' + s.hunter.name)() * rings.length)].id, ...(kept ? run.haul ?? [] : [])];
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
    if (!tower) {
      const tally = (s.gates.runs[d.id] ??= { fought: 0, cleared: 0 });
      tally.fought++;
      if (outcome === 'cleared') tally.cleared++;
    }
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
  if (run.bossFaced && !tower && !s.gates.bosses.includes(d.id)) s.gates.bosses.push(d.id);
  const climb = tower && outcome === 'cleared' ? spire.climbed(s, d, now) : null;
  if (outcome === 'cleared' && !tower) {
    if (!s.gates.cleared.includes(d.id)) s.gates.cleared.push(d.id);
    seal(s, d, dayKey(now));
  }
  if (outcome === 'defeated' && !practice) vitals.wipe(s, now);
  const v = vitals.read(s, now);
  s.gates.raid = null;
  s.log.unshift({ day: dayKey(now), kind: 'gate', name: `${d.name} — ${outcome}`, xp: xp?.gained ?? 0 });
  s.log.length = Math.min(s.log.length, 400);
  return {
    outcome, dungeonId: d.id, shards, banked, bounty, xp, loot, lingering,
    steps: run.at, depth, contracts: deal, spire: climb,
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
 * The brief's verdict: walk the System's road through today's map headlessly
 * and count. No hand-tuned ladder to drift out of date; the engine answers for
 * itself, about the road it shows.
 */
export function project(s: Save, d: Dungeon, runs = 24, now = Date.now()) {
  const day = dayKey(now);
  const specs = partySpecs(s, d, day, undefined, now);
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  const m = build(d, mapSeed(d, day));
  const road = systemRoad(m).map((id) => m.byId[id]);
  let cleared = 0;
  let heroDown = 0;
  let reached = 0;
  for (let i = 0; i < runs; i++) {
    const seed = `proj|${d.id}|${day}|${i}`;
    let blessings: string[] = [];
    let party = buildParty(specs);
    party[0].hp = Math.max(1, Math.round(party[0].maxHp * frac));
    let won = true;
    for (const x of road) {
      if (isFight(x)) {
        if (x.kind === 'boss') reached++;
        won = runChamber(d, seed, x.layer, party, chamberOf(d, x), s.gates.tactic).won;
        if (!won) break;
      } else if (x.kind === 'rest') rest(party);
      else if (x.kind === 'shrine' && x.offer) {
        blessings = [...blessings, x.offer[systemChoice(x)]];
        party = rebless(party, specs, blessings);
      } else {
        const c = eventAt(x)?.choices[systemChoice(x)];
        if (c) touch(party, rng(`proj|choice|${seed}|${x.id}`)() < oddsOf(c, specs[0]) ? c.win : c.lose ?? c.win);
      }
    }
    if (won) cleared++;
    if (!won && party[0].hp <= 0) heroDown++;
  }
  return { runs, cleared, rate: cleared / runs, heroDown, reachedBoss: reached, road: road.map((x) => x.id) };
}

export function verdict(rate: number): { tone: 'ready' | 'even' | 'over'; text: string } {
  if (rate >= 0.9) return { tone: 'ready', text: 'The party will be fine.' };
  if (rate >= 0.7) return { tone: 'ready', text: 'The party should be fine.' };
  if (rate >= 0.4) return { tone: 'even', text: 'The party will struggle.' };
  if (rate >= 0.15) return { tone: 'over', text: 'The party will most likely be defeated.' };
  return { tone: 'over', text: 'The party is doomed.' };
}
