/**
 * A raid, room by room through the Gate's map. The hunter enters any room next
 * to one cleared, walks back through cleared rooms as they please, rests once at
 * each rest they have found, and withdraws from the entrance. Up a tower, it is
 * floor by floor, and only a rest lets them withdraw. Every order and every
 * choice is written to the save before it plays out, and health after every
 * step, so closing the app can neither dodge a loss nor reroll a turn. What the
 * run finds is banked on it and paid out once, in `finish`.
 */
import { BLUEPRINTS, CACHE, DROPS, FAMILY_PART, FORGED } from '@/data/forge';
import { GATE_TUNE } from '@/data/gatetune';
import { classFor } from '@/data/classes';
import { BLESSINGS, blessingById, eventById, FIGHT_PURSE, REST_HEAL, TRAP, type Choice, type Effect, type GateEvent } from '@/data/nodes';
import { SETS } from '@/data/sets';
import { battle, POTION_HEAL, STATUS, Unit, type Ev, type FightResult, type Turn, type UnitSpec } from './combat';
import { across, build, chamberOf, choiceLayers, isFight, mapSeed, next, reach, sight, systemPick, systemRoad, type Chamber, type GateMap, type MapNode } from './map';
import { enemyById, allies as alliesFor, isPractice, type Ally, seal, rankIdx } from './gates';
import { boosted, grant, make, ofRank, rollBonuses, setBonuses, setPieces, sumBonuses, worn as wornItems } from './gear';
import * as forge from './forge';
import { BOOST_CAP, GATE_XP, grantXP, kitFor, practiceAward, type XpResult } from './progression';
import * as tree from './skilltree';
import { licensedRank } from './licence';
import * as asc from './ascension';
import * as contracts from './contracts';
import * as marks from './marks';
import * as walkers from './walkers';
import * as shadows from './shadows';
import * as spire from './spire';
import { isTrial } from './trial';
import * as association from './association';
import * as clock from './clock';
import { LOG_MAX } from './save';
import type { AssocMove } from './association';
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


/** The hunter as they will actually fight: attributes, class, skill tree and gear, worn down by fatigue. */
export function heroSpec(s: Save, now = Date.now(), level = 0): UnitSpec {
  const items = wornItems(s);
  const base = vitals.worn(boosted(s.hunter.attrs, items, tree.flatBonus(s), BOOST_CAP), Math.min(vitals.FATIGUE_MAX, vitals.read(s, now).fatigue * asc.dragShare(level)));
  // The skill tree: the skills taken in at their levels, every passive learned, and its fight bonuses;
  // and what the worn weapon's familiarity adds.
  const b = tree.buildOf(s);
  return { uid: 'hero', name: s.hunter.name, side: 'p', base, kit: b.kit, own: b.own, passives: b.passives, bonus: sumBonuses(rollBonuses(items), setBonuses(items), forge.familiarityBonus(s), marks.heroBonus(s), b.bonus), hpMult: HERO.hp, atkMult: HERO.atk, tag: 'hero' };
}

export function allySpec(a: Ally, i: number): UnitSpec {
  const cls = classFor(a.base, a.rank);
  // The Association's hunters fight with every rung's first option.
  const k = cls ? kitFor(cls.lead, cls.tier) : { kit: [], passives: [] };
  return { uid: `a${i}`, name: a.name, side: 'p', base: a.base, ...k, tag: 'ally', ref: a.id, atkMult: a.atkMult };
}

/** A Shadow as it fights. `bonus` is what the hunter's marks give every Shadow. */
export function shadowSpec(sh: Shadow, i: number, bonus: Record<string, number> = {}): UnitSpec {
  const e = enemyById(sh.enemyId)!;
  return { uid: `s${i}`, name: shadows.nameOf(sh), side: 'p', base: shadows.statsOf(sh), kit: shadows.kitOf(sh), passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, bonus, tag: 'shadow', ref: sh.id };
}

/** The hunters the Association sends with you at an Ascension level. The Trial is the System's, so it sends none there. */
export function alliesAt(d: Dungeon, day: string, rank: Rank, level = 0): Ally[] {
  if (isTrial(d)) return [];
  const all = alliesFor(d, day, rank);
  return all.slice(0, Math.max(0, all.length - asc.alliesCut(level)));
}

export function partySpecs(s: Save, d: Dungeon, day: string, squadIds?: string[], now = Date.now(), level = 0): UnitSpec[] {
  const squad = squadIds ? squadIds.map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x) : shadows.squad(s);
  const bonus = marks.shadowBonus(s);
  return [heroSpec(s, now, level), ...alliesAt(d, day, licensedRank(s), level).map(allySpec), ...(isPractice(d) ? [] : squad).map((sh, i) => shadowSpec(sh, i, bonus))];
}

/** The share of a gate's fatigue a run costs: more at Heavy Legs, less for every Mark of the Long Stride. */
export const fatigueShare = (s: Save, level: number) => asc.fatigueShare(level) * marks.fatigueShare(s);

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

function foeUnits(c: Chamber, d: Dungeon, index: number, level = 0, might = 1): Unit[] {
  const k = (EXPECTED_PARTY[d.rank] ?? 4) / 3;
  const t = tuneOf(d) * asc.ascensionTune(level) * (c.elite ? asc.eliteShare(level) : 1) * might;
  const units = c.foes.map((id, j) => {
    const e = enemyById(id)!;
    return new Unit({ uid: `e${index}-${j}`, name: e.name, side: 'e', base: e.base, kit: e.kit, passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, hpMult: k * t * (c.boss || c.champion ? BOSS_HP : 1), atkMult: t, tag: 'foe', ref: e.id });
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
  /** Health Potions the hunter has to drink in this chamber. */
  potions?: number;
  /** Orders already given in this chamber, replayed silently to bring it back to where it was. */
  orders?: (Order | null)[];
  /** The Ascension level the run was entered at. */
  ascension?: number;
  /** How much stronger the Gate clock has made its creatures: stirring, or a Red Gate (`clock.mightOf`). */
  might?: number;
}

/** Open one chamber, `index` steps into the gate. Mutates the party's units (health, statuses) as it is fought. */
export function openChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, opts: ChamberOpts = {}): ChamberFight {
  const foes = foeUnits(c, d, index, opts.ascension ?? 0, opts.might ?? 1);
  const roster: RosterRow[] = [...party, ...foes].map((u) => ({ uid: u.uid, name: u.name, side: u.side, tag: u.tag, mx: u.maxHp, hp: Math.max(0, Math.round(u.hp)), status: Object.keys(u.status) }));
  const kills: ChamberResult['kills'] = {};
  const felled: string[] = [];
  const log: Ev[] = [];
  const g = battle(party, foes, rng(`arise|raid|${seed}|${index}`), enemyActions(d), (killer, victim) => {
    if (victim.side === 'e' && victim.ref) felled.push(victim.ref);
    if (victim.side !== 'e') return;
    // Every Shadow that landed a hit helped fell it, whoever landed the last.
    const helped = new Set([...victim.hurtBy, ...(killer ? [killer] : [])]);
    for (const u of helped) {
      if (u.tag !== 'shadow' || !u.ref) continue;
      const t = (kills[u.ref] ??= { kills: 0, bosses: 0 });
      t.kills++;
      if (c.boss && victim === foes[0]) t.bosses++;
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
export function runChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, tactic: Tactic = 'default', level = 0): ChamberResult {
  return openChamber(d, seed, index, party, c, { tactic, ascension: level }).result();
}

/** The fight a node holds at an Ascension level: from Never Alone up, a boss stands with one of its gate's creatures. */
export function chamberAt(d: Dungeon, x: MapNode, level = 0, walker: number | null = null): Chamber {
  let c = chamberOf(d, x);
  // A Chosen holding the gate stands in the boss's place, for a run entered high enough to meet it.
  if (c.boss && walker) {
    const w = walkers.walkerOf(walker, d.rank as Rank);
    c = { ...c, label: w.name, foes: [w.id] };
  }
  if (!c.boss || !asc.bossGuarded(level) || !d.mobs.length) return c;
  return { ...c, foes: [...c.foes, d.mobs[x.n % d.mobs.length]] };
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
export function rest(party: Unit[], level = 0) {
  for (const u of party) {
    if (!u.alive()) continue;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * REST_HEAL * asc.restShare(level));
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
export function oddsOf(c: Choice, hero: UnitSpec, level = 0): number {
  // A certain choice stays certain; one that rolls rolls worse from Crooked Luck up.
  if (!c.check && c.odds === undefined) return 1;
  const odds = c.check ? clamp(c.check.base + hero.base[c.check.stat] * c.check.per, c.check.base, c.check.max) : c.odds!;
  return Math.max(0.05, odds - asc.oddsCut(level));
}

/** What a choice node offers: its event, or the trap. */
export const eventAt = (x: MapNode): GateEvent | null => (x.kind === 'trap' ? TRAP : x.kind === 'event' && x.event ? eventById(x.event) ?? null : null);

/** The choice the System makes at a shrine, a trap or an event. */
export const systemChoice = (x: MapNode) => (x.kind === 'shrine' ? 0 : Math.max(0, eventAt(x)?.choices.findIndex((c) => c.system) ?? 0));

// ------------------------------------------------------------------ the run, in the save

/** Enter a gate: build the party as it walks in, charge fatigue, open the run. Mutates. */
export function begin(s: Save, d: Dungeon, now = Date.now()): OpenRaid {
  const day = dayKey(now);
  const fatigue = vitals.read(s, now).fatigue;
  // The practice gate is played as it is, and a Trial at the level it proves, whatever the hunter has chosen.
  const level = asc.entryLevel(s, d, isPractice(d));
  if (isTrial(d)) asc.enterTrial(s, day);
  if (!s.gates.entered.includes(d.id)) s.gates.entered.push(d.id);
  // The party walks in as the brief assessed it: at the fatigue it walked in with. The Gate's own is
  // charged after, for the runs to come, so the fight is the one the projection and calibration played.
  const specs = partySpecs(s, d, day, undefined, now, level);
  if (!isPractice(d)) vitals.addRaidFatigue(s, d.rank, now, fatigueShare(s, level));
  const party = buildParty(specs);
  const hero = party[0];
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  hero.hp = Math.max(1, Math.round(hero.maxHp * frac));
  // A Gate's clock is set as the run walks in; a tower and the Practice Gate have none.
  const budget = isPractice(d) ? 0 : clock.budgetOf(build(d, mapSeed(d, day), 'labyrinth'));
  s.gates.raid = {
    dungeonId: d.id, seed: `${d.id}|${now}`, day, at: 0,
    squad: isPractice(d) ? [] : shadows.squad(s).map((x) => x.id),
    carried: snapshot(party), won: 0, felled: [], kills: {}, startHp: hero.hp, bossFaced: false,
    party: specs, tactic: s.gates.tactic, orders: [],
    map: mapSeed(d, day), layout: 'labyrinth', path: [], rested: [], haul: [], stash: {}, purse: 0, blessings: [], lost: false, fatigue, ascension: level, weapon: forge.weaponOf(s),
    chosen: walkers.meets(s, d, day, level),
    ...(budget ? { clock: budget, moves: 0, held: s.hunter.rank } : {}),
  };
  return s.gates.raid;
}

/** The map an open run is walking. A run opened before the dungeons walks the floors it began on. */
export const mapOf = (d: Dungeon, run: OpenRaid): GateMap => build(d, run.map ?? mapSeed(d, run.day), run.layout ?? 'layers');

/**
 * What a fight on a Gate's road pays, against the one-floor road it replaces: a deeper Gate's road is
 * longer, and its fights share out what the old road's paid. One floor, or a tower, pays in full.
 */
export function paceOf(d: Dungeon, m: GateMap): number {
  if (m.tower || m.floors.length <= 1) return 1;
  const rooms = systemRoad(m).filter((id) => !['up', 'down', 'boss'].includes(m.byId[id].kind)).length;
  return Math.min(1, choiceLayers(d) / Math.max(1, rooms));
}

/** Every step a run could take: a tower's floors, or a Gate's rooms, the entrance aside. */
export const stepsOf = (m: GateMap) => (m.tower ? m.layers.length : m.nodes.length - 1);

/** The rooms a run has cleared, the entrance among them; up a tower, the floors done. */
export const explored = (m: GateMap, run: OpenRaid) => new Set([...(m.start ? [m.start] : []), ...(run.path ?? []).slice(0, run.at)]);

/** The room the hunter stands in: the one last entered or walked back to. Null up a tower. */
export function standing(d: Dungeon, run: OpenRaid): MapNode | null {
  const m = mapOf(d, run);
  if (m.tower) return null;
  return m.byId[run.pos ?? ''] ?? m.byId[m.start!];
}

/** Where an open run stands on its Gate's clock. Null for a run without one. */
export const clockOf = (run: OpenRaid): clock.ClockState | null => (run.clock ? clock.clockAt(run.clock, run.moves ?? 0) : null);

/**
 * The moves it takes to enter a room on offer, or to walk back to one cleared, from where the hunter
 * stands. Null for a run without a clock, or a room that cannot be reached.
 */
export function movesTo(d: Dungeon, run: OpenRaid, id: string): number | null {
  if (!run.clock) return null;
  const m = mapOf(d, run);
  const n = clock.walkMoves(m, explored(m, run), standing(d, run)?.id ?? m.start!, id);
  return Number.isFinite(n) ? n : null;
}

/** The moves to every room the hunter can enter or walk back to from where they stand, by id. Empty without a clock. */
export function movesFrom(d: Dungeon, run: OpenRaid): Record<string, number> {
  if (!run.clock) return {};
  const m = mapOf(d, run);
  const done = explored(m, run);
  const dist = clock.walksFrom(m, done, standing(d, run)?.id ?? m.start!);
  const rep = clock.placeOf(m);
  const out: Record<string, number> = {};
  for (const id of [...options(d, run).map((x) => x.id), ...done]) {
    const n = dist.get(rep(id));
    if (n !== undefined) out[id] = n;
  }
  return out;
}

/** How strong a creature not yet fought in this run is against its Gate as tuned: 1 off the clock. */
export const mightOf = (d: Dungeon, run: OpenRaid) => {
  const c = clockOf(run);
  return c ? clock.mightOf(c, d.rank, run.held ?? d.rank) : 1;
};

/** The Gate has turned red and its boss still stands: the way out is sealed. */
export const sealed = (d: Dungeon, run: OpenRaid) => !!clockOf(run)?.red && !bossDown(d, run);

/** What is remembered of a map through its fog, by its seed. */
export const remembered = (s: Save, seed: string) => s.gates.seen?.[seed] ?? [];

/** The rooms an open run can see through the fog: what it has cleared and stands next to, and what is remembered of the map. */
export const seen = (s: Save, d: Dungeon, run: OpenRaid) => {
  const m = mapOf(d, run);
  return sight(m, explored(m, run), remembered(s, run.map ?? mapSeed(d, run.day)));
};

/**
 * Remember rooms seen on a map, for as long as the map stands: today's maps, and the open run's.
 * What is remembered of any other is forgotten. Mutates.
 */
function remember(s: Save, seed: string, ids: Iterable<string>, now = Date.now()) {
  const keep = new Set([dayKey(now), s.gates.raid?.day, seed.split('|').pop()]);
  const all: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(s.gates.seen ?? {})) if (keep.has(k.split('|').pop())) all[k] = v;
  all[seed] = [...new Set([...(all[seed] ?? []), ...ids])];
  s.gates.seen = all;
}

/** A Gate's map can be charted: a dungeon, with a room still in the fog. Inside it, the map the run walks; outside, today's. */
export function surveyable(s: Save, d: Dungeon, now = Date.now()): boolean {
  const run = s.gates.raid?.dungeonId === d.id ? s.gates.raid : null;
  const m = run ? mapOf(d, run) : build(d, mapSeed(d, dayKey(now)));
  if (m.tower) return false;
  const known = run ? seen(s, d, run) : sight(m, new Set(), remembered(s, mapSeed(d, dayKey(now))));
  return m.nodes.some((x) => !known.has(x.id));
}

/**
 * Use a Gate Survey on a Gate: every room of its map is charted, through the fog, for as long as the map
 * stands, and the brief shows its map from then on. Inside the Gate, it charts the map the run walks.
 * False if none is held, or nothing is left to chart. Mutates.
 */
export function survey(s: Save, d: Dungeon, now = Date.now()): boolean {
  if (shop.held(s, 'survey') <= 0 || !surveyable(s, d, now)) return false;
  const run = s.gates.raid?.dungeonId === d.id ? s.gates.raid : null;
  const seed = run ? run.map ?? mapSeed(d, run.day) : mapSeed(d, dayKey(now));
  const m = run ? mapOf(d, run) : build(d, seed);
  s.stock.survey = shop.held(s, 'survey') - 1;
  remember(s, seed, m.nodes.map((x) => x.id), now);
  if (!(s.gates.surveyed ?? []).includes(d.id)) s.gates.surveyed = [...(s.gates.surveyed ?? []), d.id];
  return true;
}

/** The boss is down, and the run waits only to be claimed. */
export const bossDown = (d: Dungeon, run: OpenRaid) => !run.lost && explored(mapOf(d, run), run).has(mapOf(d, run).boss);

/** The step chosen but not yet done: a fight underway, or a choice waiting to be made. */
export function pending(d: Dungeon, run: OpenRaid): MapNode | null {
  const path = run.path ?? [];
  return path.length > run.at ? mapOf(d, run).byId[path[run.at]] ?? null : null;
}

/**
 * Set the standing orders, from the Shadows screen. Between steps of an open run they hold for the fights
 * still to come in it. A step underway keeps the orders it opened with, since its replay reads them, so
 * orders set during one reach the run when its next step is chosen (`choose`). The hunter's next runs go
 * in with them too. True if they reached the open run now. Mutates.
 */
export function setTactic(s: Save, d: Dungeon | null, run: OpenRaid | null, t: Tactic): boolean {
  s.gates.tactic = t;
  if (!run || (d && pending(d, run))) return false;
  run.tactic = t;
  return true;
}

/** Where the hunter can step next: a room next to one cleared, or the floor above. Nothing, while a step is still underway. */
export function options(d: Dungeon, run: OpenRaid): MapNode[] {
  if (pending(d, run) || run.lost) return [];
  const m = mapOf(d, run);
  if (m.tower) return next(m, run.path ?? []);
  return bossDown(d, run) ? [] : reach(m, explored(m, run));
}

/**
 * Walk back to a room already cleared: nothing waits on the way, and on the Gate's clock each corridor
 * walked is a move. False if it is not one,
 * or the run is up a tower, or a step is underway. Mutates.
 */
export function moveTo(d: Dungeon, run: OpenRaid, id: string): boolean {
  const m = mapOf(d, run);
  if (m.tower || run.lost || pending(d, run) || !explored(m, run).has(id)) return false;
  // On the clock, every corridor walked is a move.
  if (run.clock) run.moves = (run.moves ?? 0) + (movesTo(d, run, id) ?? 0);
  run.pos = id;
  return true;
}

/** The hunter stands in a rest they have found and not yet used, and nothing is underway. */
export function canRest(d: Dungeon, run: OpenRaid): boolean {
  const x = standing(d, run);
  if (!x || x.kind !== 'rest' || run.lost || pending(d, run)) return false;
  return explored(mapOf(d, run), run).has(x.id) && !(run.rested ?? []).includes(x.id);
}

/** Rest where the hunter stands: once at each rest. False if they cannot. Mutates. */
export function restHere(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): boolean {
  if (!canRest(d, run)) return false;
  const party = partyFor(s, d, run, now);
  rest(party, asc.levelOf(run));
  settleParty(s, d, run, party, now);
  run.rested = [...(run.rested ?? []), run.pos!];
  return true;
}

/**
 * A Health Potion can be drunk between steps, in a Gate or up a tower: one is in the satchel, the hunter
 * is hurt, nothing is underway and the run is still to be won. In a fight it is the hunter's turn's.
 */
export const canDrinkHere = (s: Save, d: Dungeon, run: OpenRaid, now = Date.now()) => !drinkIdle(s, d, run, now);

/** Why a Health Potion cannot be drunk between steps now, or null if it can. */
export function drinkIdle(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): string | null {
  if (shop.held(s, 'hp') <= 0) return 'None held';
  if (run.lost || pending(d, run) || bossDown(d, run)) return 'Not now';
  const hero = partyFor(s, d, run, now)[0];
  if (!hero?.alive()) return 'Not now';
  return hero.hp < hero.maxHp ? null : 'HP full';
}

/** Drink a Health Potion between steps: the hunter's HP, up by its share of the maximum. Returns the HP it restored, 0 if it could not. Mutates. */
export function drinkPotion(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): number {
  if (!canDrinkHere(s, d, run, now)) return 0;
  const party = partyFor(s, d, run, now);
  const hero = party[0];
  const was = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * POTION_HEAL);
  s.stock.hp = shop.held(s, 'hp') - 1;
  settleParty(s, d, run, party, now);
  return Math.round(hero.hp - was);
}

/**
 * Nothing is underway and the run has cleared a room: in a Gate, while the hunter stands at the
 * entrance and the Gate has not turned red; up a tower, when the last floor done was a rest. The only
 * times a run can be walked away from.
 */
export function canWithdraw(d: Dungeon, run: OpenRaid): boolean {
  const path = run.path ?? [];
  if (run.at === 0 || run.lost || pending(d, run)) return false;
  const m = mapOf(d, run);
  if (!m.tower) return !bossDown(d, run) && !sealed(d, run) && standing(d, run)?.id === m.start;
  return m.byId[path[run.at - 1]]?.kind === 'rest';
}

/** What the System does next on the map, as Auto does it and the brief assessed it. */
export type Move = { enter: string } | { rest: string };

/**
 * The System's next move. Up a tower, its pick of the floor above. Through a Gate, the next room on
 * its road; but before the boss, a rest found and not used, first. Null when there is none to make.
 */
export function systemNext(d: Dungeon, run: OpenRaid): Move | null {
  const opts = options(d, run);
  if (!opts.length) return null;
  const m = mapOf(d, run);
  if (m.tower) return { enter: systemPick(opts).id };
  const done = explored(m, run);
  const to = systemRoad(m).find((id) => !done.has(id));
  const x = opts.find((o) => o.id === to) ?? systemPick(opts);
  if (x.kind === 'boss') {
    const spare = m.nodes.find((y) => y.kind === 'rest' && done.has(y.id) && !(run.rested ?? []).includes(y.id));
    if (spare) return { rest: spare.id };
  }
  return { enter: x.id };
}

/** Make the System's move: enter its room, or walk to its rest and use it. False if there was none. Mutates. */
export function systemMove(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): { move: Move; step: StepResult | null } | null {
  const move = systemNext(d, run);
  if (!move) return null;
  if ('rest' in move) {
    moveTo(d, run, move.rest);
    restHere(s, d, run, now);
    return { move, step: null };
  }
  return { move, step: choose(s, d, run, move.enter, now) };
}

/** Every step the run has finished, in order. */
export const walked = (d: Dungeon, run: OpenRaid) => {
  const m = mapOf(d, run);
  return (run.path ?? []).slice(0, run.at).map((id) => m.byId[id]).filter(Boolean);
};

/** The part a Gate's creatures leave most: drawn from its creatures, by family. */
const partOfGate = (d: Dungeon, roll: () => number) => {
  const e = enemyById(d.mobs[Math.floor(roll() * d.mobs.length)]);
  return forge.partId(FAMILY_PART[e?.family ?? ''] ?? 'hide');
};

/**
 * What a cache or a find leaves for the haul, drawn for one step: now and then a piece found whole, of
 * the gate's grade or `shift` grades from it; otherwise alloy of that grade and a part. Banked on the
 * run, paid when it ends. Mutates the run.
 */
function haulFind(d: Dungeon, run: OpenRaid, roll: () => number, shift: number, vault = false): { item?: string; mats?: forge.Bundle } {
  const rank = RANKS[clamp(rankIdx(d.rank) + shift, 0, 5)];
  if (roll() < (vault ? FORGED.vault : FORGED.cache)) {
    const pool = ofRank(rank);
    const item = pool[Math.floor(roll() * pool.length)]?.id;
    if (item) { (run.haul ??= []).push(item); return { item }; }
  }
  const mats = forge.addUp({ [forge.alloyId(rank)]: (vault ? CACHE.vault : CACHE.alloy) + Math.floor(roll() * 3) }, { [partOfGate(d, roll)]: 1 }, vault ? { [partOfGate(d, roll)]: 1 } : {});
  run.stash = forge.addUp(run.stash ?? {}, mats);
  return { mats };
}

/** Write the run's party back after a step changed it, and the hunter's health to their vitals. Mutates. */
function settleParty(s: Save, d: Dungeon, run: OpenRaid, party: Unit[], now: number) {
  run.carried = snapshot(party);
  const hero = party[0];
  if (!isPractice(d)) vitals.setHpFraction(s, Math.max(0, hero.hp) / hero.maxHp, now);
}

export interface StepResult {
  node: MapNode;
  /** A cache's piece found whole, banked for the end of the run. */
  item?: string;
  /** Or the materials it held, banked the same way. */
  mats?: forge.Bundle;
}

/**
 * Take a step: enter a room, or climb a floor. A rest, a cache or a vault is
 * done at once; a fight waits for the arena, and a shrine, a trap or an event
 * waits for `resolve`. A rest up a tower heals at once; one in a Gate is found,
 * and used when the hunter chooses (`restHere`). Null if the step is not one
 * the hunter can take. Mutates.
 */
export function choose(s: Save, d: Dungeon, run: OpenRaid, id: string, now = Date.now()): StepResult | null {
  const x = options(d, run).find((o) => o.id === id);
  if (!x) return null;
  const m = mapOf(d, run);
  // On the clock, the walk to the room and the step into it are moves, written before the room plays.
  if (run.clock) run.moves = (run.moves ?? 0) + (movesTo(d, run, id) ?? 1);
  run.path = [...(run.path ?? []), id];
  if (!m.tower) run.pos = id;
  run.orders = [];
  // Orders given while the last step was underway reach the run here, before this one plays.
  run.tactic = s.gates.tactic;
  const out: StepResult = { node: x };
  if (x.kind === 'rest') {
    if (m.tower) {
      const party = partyFor(s, d, run, now);
      rest(party, asc.levelOf(run));
      settleParty(s, d, run, party, now);
    }
    run.at += 1;
  } else if (x.kind === 'down') {
    // Down the stairs: the floor below's stairs up are reached at once, and the hunter stands on them.
    const below = across(m, x);
    run.at += 1;
    if (below) { run.path.push(below.id); run.at += 1; run.pos = below.id; }
  } else if (x.kind === 'treasure' || x.kind === 'vault') {
    Object.assign(out, haulFind(d, run, rng(`arise|cache|${run.seed}|${id}`), x.kind === 'vault' ? 0 : -1, x.kind === 'vault'));
    run.at += 1;
  }
  return out;
}

export interface Resolution { node: MapNode; choice: number; odds: number; won: boolean; effect: Effect; item?: string; mats?: forge.Bundle; blessing?: string }

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
    const odds = oddsOf(c, run.party[0], asc.levelOf(run));
    const won = roll() < odds;
    const effect = won ? c.win : c.lose ?? c.win;
    out = { node: x, choice, odds, won, effect };
    touch(party, effect);
    // Mana and fatigue are the hunter's own, outside the fight: they land on the hunter at once.
    if (effect.mana) {
      if (effect.mana > 0) vitals.restore(s, effect.mana, now);
      else vitals.spendMp(s, Math.min(vitals.read(s, now).mp, Math.round(vitals.maxima(s).mp * -effect.mana)), now);
    }
    if (effect.fatigue) {
      if (effect.fatigue > 0) vitals.tire(s, effect.fatigue, now);
      else vitals.ease(s, -effect.fatigue, now);
    }
    if (effect.item) Object.assign(out, haulFind(d, run, roll, 0));
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
  const potions = shop.held(s, 'hp') + orders.filter((o) => o?.use === 'Potion').length;
  const ch = openChamber(d, run.seed, x.n, party, chamberAt(d, x, asc.levelOf(run), run.chosen ?? null), { manual: true, tactic: run.tactic ?? 'default', potions, orders, ascension: asc.levelOf(run), might: mightOf(d, run) });
  return { party, ch, node: x };
}

/**
 * Write the hunter's order to the save, before it plays out. A Health Potion is
 * paid for here, out of the satchel; one the satchel cannot pay for becomes the
 * System's choice. Returns the order as it will be played. Mutates.
 */
export function order(s: Save, run: OpenRaid, o: Order | null): Order | null {
  let given = o;
  if (given?.use === 'Potion') {
    if (shop.held(s, 'hp') > 0) s.stock.hp = shop.held(s, 'hp') - 1;
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
  const specs = run.party?.length ? run.party : partySpecs(s, d, run.day, run.squad, now, asc.levelOf(run));
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
    const share = x?.kind === 'fight' ? FIGHT_PURSE.fight * paceOf(d, mapOf(d, run)) : x?.kind === 'elite' ? FIGHT_PURSE.elite : 0;
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

/** The floors of a Gate with every room on them cleared. */
export function chartedFloors(m: GateMap, cleared: Set<string>): number {
  if (m.tower) return 0;
  return m.floors.filter((_, f) => m.nodes.filter((x) => (x.floor ?? 0) === f).every((x) => cleared.has(x.id))).length;
}

/**
 * A creature lingering after a clear. `cost` is the first reach's MP; `tries` counts the reaches that
 * failed, and `bound` is set once one holds.
 */
export interface Lingering {
  enemyId: string; boss: boolean; cost: number; tries: number; bound?: boolean;
  /** Set when one like it already serves in the army: the Shadow Essence it gives when it holds. */
  essence?: number;
}

/** What the next reach for a lingering Shadow costs: the first reach's MP, doubled for every one that failed. */
export const reachCost = (l: Lingering) => Math.round(l.cost * Math.pow(shadows.EXTRACT_TRIES.step, l.tries ?? 0));
/** Reaches left before its mana disperses. None once it has been bound. */
export const reachesLeft = (l: Lingering) => (l.bound ? 0 : Math.max(0, shadows.EXTRACT_TRIES.max - (l.tries ?? 0)));

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
  /** Pieces found whole: rare, since gear is forged. */
  loot: Item[];
  /** The materials it left, what the haul banked among them. */
  mats: forge.Bundle;
  /** The blueprints it left, learned. */
  blueprints: string[];
  /** How far the weapon carried in grew familiar. */
  familiarity: forge.FamiliarityMove | null;
  lingering: Lingering[];
  /** Steps taken, of the steps from the gate to the boss: rooms entered, or floors climbed. */
  steps: number;
  depth: number;
  /** A Gate's rooms, the entrance aside. Null up a tower. */
  rooms: number | null;
  /** The System contracts this run completed, and what they paid. */
  contracts: contracts.ContractReport;
  /** A Spire block: the floor it reached, and whether that is the week's best. */
  spire: { floor: number; best: boolean } | null;
  /** What each deployed Shadow took from the run: the creatures it helped fell, the XP it took under its cap, and its level before and after. */
  grew: { id: string; kills: number; xp: number; from: number; to: number }[];
  /** Shadows the run made ready for promotion, and the rank each can now be promoted to. */
  ready: { id: string; rank: string }[];
  /** How far the run moved the Association Quest in hand. */
  assoc: AssocMove | null;
  /** An Ascension level the run's clear proved the way to, if it did. Its Trial's last Chosen is sent into the world. */
  ascended: number | null;
  /** A Chosen met in the boss's place and felled: its masterwork, or its bounty. */
  chosen: walkers.Felled | null;
  /** The hunter's health afterwards, on the real (vitals) scale. */
  heroHp: number;
  heroMax: number;
  allies: string[];
}

export const withdrawShare = (done: number, total: number) => FAIL_SHARE + (1 - FAIL_SHARE) * WITHDRAW_CAP * Math.min(1, done / Math.max(1, total));

/** The sets a gate is home to: a Spire block's are those of the gate whose shape it takes. */
export const homeSets = (d: Dungeon) => SETS.filter((x) => x.home === (d.shape ?? d.id));

/**
 * What a run leaves (`data/forge.ts`): alloy from every fight, gatekeeper and the clear, a share of the
 * grade below, parts from the creatures felled, a trophy from a set's home Gate, and Ember from a clear
 * at an Ascension level. A blueprint for a Gate's first clear (a set's own, at its home), by chance on
 * other clears and from gatekeepers; and now and then a piece found whole. Blueprints are learned here.
 * Mutates.
 */
function spoils(s: Save, d: Dungeon, run: OpenRaid, r: () => number, fights: number, elites: number, cleared: boolean, first: boolean, level: number, vault: boolean, pace = 1) {
  const g = rankIdx(d.rank);
  const rank = RANKS[g];
  const lower = RANKS[Math.max(0, g - 1)];
  const parts: forge.Bundle[] = [];
  let alloy = 0, low = 0;
  // A deeper Gate's road is longer: its fights leave the old road's alloy between them.
  for (let i = 0; i < Math.round(fights * pace); i++) {
    alloy += DROPS.fight + (r() < DROPS.fightExtra ? 1 : 0);
    if (r() < DROPS.fightLower) low++;
  }
  for (let i = 0; i < elites; i++) { alloy += DROPS.elite; parts.push({ [partOfGate(d, r)]: DROPS.elitePart }); }
  if (cleared) {
    alloy += DROPS.clear + Math.floor(r() * (DROPS.clearSpread + 1));
    low += DROPS.clearLower;
    for (const k of ['hide', 'bone', 'core'] as const) parts.push({ [forge.partId(k)]: DROPS.clearParts });
  }
  for (const id of run.felled) {
    const fam = enemyById(id)?.family;
    if (fam && r() < DROPS.part) parts.push({ [forge.partId(FAMILY_PART[fam] ?? 'hide')]: 1 });
  }
  const trophy = cleared ? forge.trophyAt(d) : null;
  const mats = forge.addUp(
    { [forge.alloyId(rank)]: alloy + (g === 0 ? low : 0) }, g > 0 ? { [forge.alloyId(lower)]: low } : {}, ...parts,
    trophy ? { [trophy]: 1 } : {}, cleared && level > 0 ? { [forge.EMBER.id]: Math.ceil(DROPS.ember * level) } : {},
  );
  // Blueprints: a set's from its home Gate, then the Gate's own.
  const blueprints: string[] = [];
  const leave = (at: Rank, pool?: ReturnType<typeof setPieces>) => {
    const got = forge.leaveBlueprint(s, at, r, pool);
    if (got.blueprint) blueprints.push(got.blueprint);
    Object.assign(mats, forge.addUp(mats, got.mats));
  };
  const up = () => (g < 5 && r() < BLUEPRINTS.up ? RANKS[g + 1] : rank);
  let firstPaid = false;
  if (cleared) {
    const sets = homeSets(d).filter((x) => forge.setBlueprintsLeft(s, x.id).length);
    if (sets.length && (first || r() < BLUEPRINTS.home)) {
      const set = sets[Math.floor(r() * sets.length)];
      leave(setPieces(set.id)[0]?.rank as Rank ?? rank, forge.setBlueprintsLeft(s, set.id));
      firstPaid = first;
    }
    if ((first && !firstPaid) || (!first && r() < BLUEPRINTS.clear)) leave(up());
  }
  for (let i = 0; i < elites; i++) if (r() < BLUEPRINTS.elite) leave(up());
  if (vault && r() < BLUEPRINTS.vault) leave(rank);
  // A piece found whole, rarely.
  const forged: string[] = [];
  if (cleared && r() < FORGED.clear) {
    const pool = ofRank(rank);
    const id = pool[Math.floor(r() * pool.length)]?.id;
    if (id) forged.push(id);
  }
  return { mats, blueprints, forged };
}

/** Close an open run: pay out, record, seal. A withdrawal is only ever from the entrance, or a tower's rest. Mutates. */
export function finish(s: Save, d: Dungeon, run: OpenRaid, outcome: Outcome, now = Date.now()): RaidResult {
  if (outcome === 'withdrawn' && !canWithdraw(d, run)) throw new Error('A run is only walked away from at the entrance, or a tower\'s rest.');
  const m = mapOf(d, run);
  const road = systemRoad(m);
  // What the run saw through the fog is remembered, for another run on the same map.
  if (!m.tower) remember(s, run.map ?? mapSeed(d, run.day), seen(s, d, run), now);
  // A share of the way: the rooms from the entrance to the boss, or a tower's floors.
  const depth = m.tower ? m.layers.length : road.length;
  const steps = walked(d, run);
  const r = rng('arise|spoils|' + run.seed);
  const practice = isPractice(d);
  // A block of the Spire is fought and paid as a gate. It has no first clear, and is never sealed:
  // the week's best floor moves on past it instead. A Trial is the same: it is not on the board.
  const tower = spire.isSpire(d) || isTrial(d);
  const kept = outcome !== 'defeated';
  // Ascension pays more for the gate itself, at the level the run was entered at.
  const level = asc.levelOf(run);
  const pay = asc.payShare(level);
  const share = outcome === 'cleared' ? 1 : outcome === 'withdrawn' ? withdrawShare(run.at, depth) : FAIL_SHARE;
  const firstClear = outcome === 'cleared' && !tower && !s.gates.cleared.includes(d.id);
  const banked = kept && !practice ? shop.earn(s, run.purse ?? 0) : 0;
  const shards = (practice ? 0 : shop.earn(s, shop.gateShards(d.rank, share * pay))) + banked;
  const bounty = firstClear && !practice ? shop.earn(s, shop.gateShards(d.rank, 2 * pay)) : 0;
  // Read the grade before the experience lands: a level-up must not decide whether this was a
  // reach, or redraw the allies who were actually in the party.
  const reach = outcome === 'cleared' && rankIdx(d.rank) > rankIdx(licensedRank(s));
  const allies = alliesAt(d, run.day, licensedRank(s), level);
  const fights = steps.filter((x) => x.kind === 'fight').length;
  const elites = steps.filter((x) => x.kind === 'elite').length;
  // The contracts count what the run did, and their experience lands with the gate's.
  const deal = practice ? contracts.nothing() : contracts.count(s, {
    rank: d.rank, cleared: outcome === 'cleared', fatigue: run.fatigue ?? 0, felled: run.felled,
    shadowKills: run.squad.reduce((n, id) => n + (run.kills[id]?.kills ?? 0), 0),
    elites: elites - (run.lost && steps[steps.length - 1]?.kind === 'elite' ? 1 : 0),
    offroad: (run.path ?? []).some((id, i) => (m.tower ? id !== road[i] : !road.includes(id))),
  }, dayKey(now));
  const gateXp = GATE_XP[d.rank as Rank] ?? 0;
  const xpDue = (practice ? (outcome === 'cleared' ? practiceAward(s) : 0) : Math.round(gateXp * share * pay) + (firstClear ? Math.round(gateXp * pay) : 0)) + deal.xp;
  const xp = xpDue > 0 ? grantXP(s, xpDue) : null;

  // Carried out, the party leaves with nothing it found; walking out, it keeps everything.
  const cleared = outcome === 'cleared';
  const vault = steps.some((x) => x.kind === 'vault');
  const left = kept && !practice ? spoils(s, d, run, r, fights, elites, cleared, firstClear, level, vault, paceOf(d, m)) : { mats: {}, blueprints: [] as string[], forged: [] as string[] };
  let lootIds = kept ? [...left.forged, ...(run.haul ?? [])] : [];
  let mats = kept ? forge.addUp(left.mats, run.stash ?? {}) : {};
  if (practice) {
    // The Practice Gate pays in kit: a ring found whole, and the iron and hide for a first piece at the Forge.
    const rings = ofRank('E').filter((g) => g.slot === 'Ring');
    lootIds = [rings[Math.floor(rng('arise|practice|' + s.hunter.name)() * rings.length)].id, ...(kept ? run.haul ?? [] : [])];
    mats = forge.addUp(mats, { [forge.alloyId('E')]: 8, [forge.partId('hide')]: 2 });
  }
  forge.give(s, mats);
  const loot = lootIds.map((id, i) => grant(s, id, `${run.seed}|${i}`) ?? make(id)).filter(Boolean);
  // The weapon carried in grows familiar with every creature the party felled, however the run ended.
  const familiarity = practice ? null : forge.grow(s, run.weapon, run.felled.length);

  const lingering: Lingering[] = [];
  if (outcome === 'cleared' && !practice) {
    const seen = new Set<string>();
    const kills = [...run.felled].reverse(); // boss last in, first considered
    for (const id of kills) {
      const e = enemyById(id);
      if (!e || seen.has(id) || lingering.length >= 2) continue;
      seen.add(id);
      const boss = id === d.boss || (!!run.chosen && id === walkers.walkerOf(run.chosen, d.rank as Rank).id);
      const owned = shadows.isBound(s, id);
      if (r() >= shadows.lingerChance(s, boss, owned)) continue;
      // One already in the army gives only Essence, so it costs less to reach for.
      const l: Lingering = { enemyId: id, boss, cost: Math.round((shadows.EXTRACT_MP[e.rank] ?? 50) * asc.manaShare(level) * (owned ? shadows.ECHO_COST : 1)), tries: 0 };
      // One like it already serves: extracted again, it gives Shadow Essence.
      if (owned) l.essence = shadows.essenceOf(e, boss);
      lingering.push(l);
    }
  }

  // Records.
  const ready: RaidResult['ready'] = [];
  const grew: RaidResult['grew'] = [];
  if (!practice) {
    if (!tower) {
      const tally = (s.gates.runs[d.id] ??= { fought: 0, cleared: 0 });
      tally.fought++;
      if (outcome === 'cleared') tally.cleared++;
    }
    if (outcome === 'cleared') s.gates.clears++;
    else if (outcome === 'withdrawn') s.gates.withdrawn++;
    else s.gates.fails++;
    // Every floor of a cleared Gate with every room on it cleared is charted.
    if (outcome === 'cleared' && !m.tower) s.stats.charted = (s.stats.charted ?? 0) + chartedFloors(m, explored(m, run));
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
      const was = shadows.canPromote(s, sh);
      const from = shadows.levelOf(sh);
      const k = run.kills[id] ?? { kills: 0, bosses: 0 };
      sh.out++;
      sh.kills += k.kills;
      sh.bosses += k.bosses;
      // At its rank's cap it takes no more XP until it is promoted.
      const xp = shadows.earn(sh, shadows.xpFrom(k.kills, k.bosses));
      grew.push({ id, kills: k.kills, xp, from, to: shadows.levelOf(sh) });
      // The hunter promotes it, from its card, once everything the rank above asks is met.
      if (!was && shadows.canPromote(s, sh)) ready.push({ id: sh.id, rank: shadows.nextRank(sh)!.name });
    }
  }
  // A Chosen in the boss's place is not the gate's own boss: meeting it shows nothing of that one.
  if (run.bossFaced && !tower && !run.chosen && !s.gates.bosses.includes(d.id)) s.gates.bosses.push(d.id);
  const climb = spire.isSpire(d) && outcome === 'cleared' ? spire.climbed(s, d, now) : null;
  const job = practice ? null : association.count(s, d, run, outcome);
  const ascended = outcome === 'cleared' && !practice ? asc.prove(s, d, run) : null;
  if (ascended) walkers.send(s, ascended);
  const chosen = outcome === 'cleared' ? walkers.fell(s, d, run, pay) : null;
  if (chosen) {
    const ember = { [forge.EMBER.id]: DROPS.chosenEmber * chosen.level };
    forge.give(s, ember);
    mats = forge.addUp(mats, ember);
  }
  if (outcome === 'cleared' && !tower) {
    if (!s.gates.cleared.includes(d.id)) s.gates.cleared.push(d.id);
    seal(s, d, dayKey(now));
  }
  if (outcome === 'defeated' && !practice) vitals.wipe(s, now);
  const v = vitals.read(s, now);
  s.gates.raid = null;
  s.log.unshift({ day: dayKey(now), kind: 'gate', name: `${d.name}: ${outcome}`, xp: xp?.gained ?? 0 });
  s.log.length = Math.min(s.log.length, LOG_MAX);
  return {
    outcome, dungeonId: d.id, shards, banked, bounty, xp, loot, mats, blueprints: left.blueprints, familiarity, lingering,
    steps: run.at, depth, rooms: m.tower ? null : m.nodes.length - 1, contracts: deal, spire: climb, grew, ready, assoc: job, ascended, chosen,
    heroHp: v.hp, heroMax: v.hpMax, allies: allies.map((a) => a.name),
  };
}

/**
 * Reach for a lingering Shadow, at what this reach costs (`reachCost`). MP is spent whether or not it
 * holds. Held, it joins the army (`bound`), or, when one like it already serves, it gives its Shadow
 * Essence (`essence`). A reach that fails leaves it lingering while reaches are left (`failed`); the
 * last to fail disperses it (`lost`). Mutates the save and the lingering.
 */
export function extract(s: Save, l: Lingering, roll: number, now = Date.now()): 'bound' | 'essence' | 'failed' | 'lost' | 'no-mana' {
  if (reachesLeft(l) <= 0) return 'lost';
  if (!vitals.spendMp(s, reachCost(l), now)) return 'no-mana';
  s.stats.extractions++;
  if (roll < shadows.holdChance(s)) {
    s.stats.extractionsWon++;
    l.bound = true;
    const e = enemyById(l.enemyId);
    if (shadows.isBound(s, l.enemyId) && e) {
      l.essence = shadows.essenceOf(e, l.boss);
      s.shadows.essence = (s.shadows.essence ?? 0) + l.essence;
      return 'essence';
    }
    delete l.essence;
    shadows.bind(s, l.enemyId, dayKey(now));
    return 'bound';
  }
  l.tries = (l.tries ?? 0) + 1;
  return reachesLeft(l) > 0 ? 'failed' : 'lost';
}

// ------------------------------------------------------------------ projection

/**
 * The brief's verdict: walk the System's road through today's map headlessly
 * and count. No hand-tuned ladder to drift out of date; the engine answers for
 * itself, about the road it shows.
 */
export function project(s: Save, d: Dungeon, runs = 24, now = Date.now()) {
  const day = dayKey(now);
  // The run would be entered at the level chosen (a Trial, at its own): the projection plays every rule it brings.
  const level = asc.entryLevel(s, d, isPractice(d));
  const walker = walkers.meets(s, d, day, level);
  const specs = partySpecs(s, d, day, undefined, now, level);
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  const m = build(d, mapSeed(d, day));
  const road = systemRoad(m).map((id) => m.byId[id]);
  let clears = 0;
  let heroDown = 0;
  let reached = 0;
  for (let i = 0; i < runs; i++) {
    const seed = `proj|${d.id}|${day}|${i}`;
    let blessings: string[] = [];
    let party = buildParty(specs);
    party[0].hp = Math.max(1, Math.round(party[0].maxHp * frac));
    let won = true;
    // A rest found in a Gate is kept for the boss, as the System keeps it.
    let kept = false;
    for (const x of road) {
      if (isFight(x)) {
        if (x.kind === 'boss') {
          reached++;
          if (kept) { rest(party, level); kept = false; }
        }
        won = runChamber(d, seed, x.n, party, chamberAt(d, x, level, walker), s.gates.tactic, level).won;
        if (!won) break;
      } else if (x.kind === 'rest') {
        if (m.tower) rest(party, level);
        else kept = true;
      }
      else if (x.kind === 'shrine' && x.offer) {
        blessings = [...blessings, x.offer[systemChoice(x)]];
        party = rebless(party, specs, blessings);
      } else {
        const c = eventAt(x)?.choices[systemChoice(x)];
        if (c) touch(party, rng(`proj|choice|${seed}|${x.id}`)() < oddsOf(c, specs[0], level) ? c.win : c.lose ?? c.win);
      }
    }
    if (won) clears++;
    if (!won && party[0].hp <= 0) heroDown++;
  }
  return { runs, cleared: clears, rate: clears / runs, heroDown, reachedBoss: reached, road: road.map((x) => x.id) };
}

/** The System's assessment of a Gate, graded from its clear rate. It reports; it does not advise. */
export const GRADES = [
  { min: 0.9, text: 'Safe', tone: 'ready' },
  { min: 0.7, text: 'Favourable', tone: 'ready' },
  { min: 0.4, text: 'Even', tone: 'even' },
  { min: 0.15, text: 'Unfavourable', tone: 'over' },
  { min: 0, text: 'Lethal', tone: 'over' },
] as const;

export function verdict(rate: number): { tone: 'ready' | 'even' | 'over'; text: string } {
  const g = GRADES.find((x) => rate >= x.min) ?? GRADES[GRADES.length - 1];
  return { tone: g.tone, text: g.text };
}
