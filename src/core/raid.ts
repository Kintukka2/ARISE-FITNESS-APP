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
import { blessingById, eventById, FIGHT_PURSE, HONE_LEVELS, HONE_PAST, NOTICE, REST_HEAL, REST_LINE, STEADY_POTIONS, TOLL, TRAP, type Choice, type Effect, type GateEvent } from '@/data/nodes';
import { landmarkEvent } from '@/data/landmarks';
import { NODES } from '@/data/tree';
import * as blessings from './blessings';
import { SETS } from '@/data/sets';
import { tricksOf, type TrickId } from '@/data/tricks';
import { battle, POTION_HEAL, STATUS, THROWABLES, thrownBy, throwOrder, Unit, type Ev, type FightResult, type ThrowId, type Turn, type UnitSpec } from './combat';
import { across, build, chamberOf, choiceLayers, isFight, mapSeed, next, pairKey, passages, reach, sight, systemPick, systemRoad, systemWalk, type Chamber, type GateMap, type MapNode, type Openings } from './map';
import { enemyById, allies as alliesFor, isPractice, type Ally, seal, rankIdx } from './gates';
import { boosted, grant, make, ofRank, rollBonuses, setBonuses, setBoons, setPieces, sumBonuses, worn as wornItems } from './gear';
import * as forge from './forge';
import { BOOST_CAP, GATE_XP, grantXP, kitFor, practiceAward, type XpResult } from './progression';
import * as tree from './skilltree';
import { licensedRank } from './licence';
import * as asc from './ascension';
import * as contracts from './contracts';
import * as kin from './kin';
import * as marks from './marks';
import * as walkers from './walkers';
import * as shadows from './shadows';
import * as spire from './spire';
import { isTrial } from './trial';
import * as association from './association';
import * as clock from './clock';
import * as sealing from './seals';
import type { SealId } from '@/data/seals';
import { BOSS_CONDITION, CONDITION, DROP, FAMILY_CONDITION, type ConditionId } from '@/data/drops';
import { sealEmber } from '@/data/seals';
import { FEAT_PAY, type FeatId } from '@/data/feats';
import * as feats from './feats';
import { LOG_MAX } from './save';
import type { AssocMove } from './association';
import * as shop from './shop';
import type { Dungeon, Item, OpenRaid, Order, Rank, RunTally, Save, Shadow, Tactic } from './types';
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
  // An armour set's 4-piece grants a blessing for every Gate, as a shrine's would.
  const boons = setBoons(items);
  return { uid: 'hero', name: s.hunter.name, side: 'p', base, kit: b.kit, own: b.own, passives: b.passives, bonus: sumBonuses(rollBonuses(items), setBonuses(items), forge.familiarityBonus(s), marks.heroBonus(s), b.bonus), hpMult: HERO.hp, atkMult: HERO.atk, tag: 'hero', ...(Object.keys(boons).length ? { boons } : {}) };
}

export function allySpec(a: Ally, i: number): UnitSpec {
  const cls = classFor(a.base, a.rank);
  // The Association's hunters fight with every rung's first option.
  const k = cls ? kitFor(cls.lead, cls.tier) : { kit: [], passives: [] };
  return { uid: `a${i}`, name: a.name, side: 'p', base: a.base, ...k, tag: 'ally', ref: a.id, atkMult: a.atkMult };
}

/** A Shadow as it fights. `bonus` is what it takes beyond its own: the hunter's marks, its Kin's boon and the Formation's auras. */
export function shadowSpec(sh: Shadow, i: number, bonus: Record<string, number> = {}): UnitSpec {
  const e = enemyById(sh.enemyId)!;
  return { uid: `s${i}`, name: shadows.nameOf(sh), side: 'p', base: shadows.statsOf(sh), kit: shadows.kitOf(sh), passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, bonus, tag: 'shadow', ref: sh.id };
}

/** The hunters the Association sends with you at an Ascension level, and under the Seals taken. The Trial is the System's, so it sends none there. */
export function alliesAt(d: Dungeon, day: string, rank: Rank, level = 0, seals: readonly SealId[] = []): Ally[] {
  if (isTrial(d)) return [];
  const all = alliesFor(d, day, rank);
  return all.slice(0, Math.max(0, all.length - asc.alliesCut(level) - sealing.alliesCut(seals)));
}

/**
 * Who walks in: the hunter, the Association's hunters, the Shadows deployed. The squad's Kin and
 * Formation (`core/kin.ts`) are worked in here, so a run keeps them as it walked in: each Shadow takes
 * its Kin's boon, and the hunter and every Shadow the Formation's auras. The Association's hunters fight
 * as they are. The Practice Gate takes no Shadows, and so none of either.
 */
export function partySpecs(s: Save, d: Dungeon, day: string, squadIds?: string[], now = Date.now(), level = 0, seals: readonly SealId[] = []): UnitSpec[] {
  const squad = isPractice(d) ? [] : squadIds ? squadIds.map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x) : shadows.squad(s);
  const bonus = marks.shadowBonus(s);
  const built = kin.makeOf(squad);
  const hero = heroSpec(s, now, level);
  const lead = Object.keys(built.aura).length ? { ...hero, bonus: sumBonuses(hero.bonus ?? {}, built.aura) } : hero;
  return [lead, ...alliesAt(d, day, licensedRank(s), level, seals).map(allySpec), ...squad.map((sh, i) => shadowSpec(sh, i, sumBonuses(bonus, built.aura, kin.kinBonusOf(sh, built))))];
}

/** The share of a gate's fatigue a run costs: more at Heavy Legs, less for every Mark of the Long Stride. */
export const fatigueShare = (s: Save, level: number) => asc.fatigueShare(level) * marks.fatigueShare(s);

export interface RosterRow {
  uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[]; tricks?: TrickId[];
  /** A foe's grade, which sets its behaviours' numbers. */
  grade?: string;
  /** A foe's creature, its condition drop, and whether it is the chamber's boss. */
  ref?: string; cond?: ConditionId; boss?: boolean;
}

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
  /** The creatures felled the way their condition asks, by id. */
  drops: { ref: string; boss: boolean }[];
}

/** A creature's condition drop: its family's, or a boss's. */
export const conditionOf = (ref: string, boss: boolean) => (boss ? BOSS_CONDITION : FAMILY_CONDITION[enemyById(ref)?.family ?? ''] ?? null);

/** Per-gate difficulty, from calibration, or a Spire block's own. Exported so the calibrator can drive it. */
export const tuneOf = (d: Dungeon) => d.scale ?? GATE_TUNE[d.id] ?? 1;

function foeUnits(c: Chamber, d: Dungeon, index: number, level = 0, might = 1, seals: readonly SealId[] = []): Unit[] {
  // The run's Seals: Heavier Air fights a level up, Wardens Wake wakes the Gatekeeper, Swollen swells every creature.
  const k = (EXPECTED_PARTY[d.rank] ?? 4) / 3 * sealing.hpShare(seals);
  const t = tuneOf(d) * asc.ascensionTune(level + sealing.levelsUp(seals)) * (c.elite ? asc.eliteShare(level) * sealing.eliteShare(seals) : 1) * might;
  const units = c.foes.map((id, j) => {
    const e = enemyById(id)!;
    // Its behaviours: its role's, its family's from C-Rank, and a wind-up for the chamber's boss or Gatekeeper.
    const head = j === 0 && (c.boss || c.elite || !!c.champion);
    return new Unit({ uid: `e${index}-${j}`, name: e.name, side: 'e', base: e.base, kit: e.kit, passives: e.passive ? [e.passive] : [], imm: e.imm, res: e.res, hpMult: k * t * (c.boss || c.champion ? BOSS_HP : 1), atkMult: t, tag: 'foe', ref: e.id, tricks: tricksOf(e, head), grade: String(e.rank) });
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
  /** What the hunter has to throw in this chamber, by kind. */
  throws?: Partial<Record<ThrowId, number>>;
  /** Orders already given in this chamber, replayed silently to bring it back to where it was. */
  orders?: (Order | null)[];
  /** The Ascension level the run was entered at. */
  ascension?: number;
  /** How much stronger the Gate clock has made its creatures: stirring, or a Red Gate (`clock.mightOf`). */
  might?: number;
  /** The Seals the run walked in with. */
  seals?: readonly SealId[];
}

/** Open one chamber, `index` steps into the gate. Mutates the party's units (health, statuses) as it is fought. */
export function openChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, opts: ChamberOpts = {}): ChamberFight {
  const foes = foeUnits(c, d, index, opts.ascension ?? 0, opts.might ?? 1, opts.seals ?? []);
  const roster: RosterRow[] = [...party, ...foes].map((u) => {
    const boss = u.side === 'e' && c.boss && u === foes[0];
    const cond = u.side === 'e' && u.ref ? conditionOf(u.ref, boss) ?? undefined : undefined;
    return { uid: u.uid, name: u.name, side: u.side, tag: u.tag, mx: u.maxHp, hp: Math.max(0, Math.round(u.hp)), status: Object.keys(u.status), tricks: u.tricks.size ? [...u.tricks] : undefined, ...(u.side === 'e' ? { grade: u.grade } : {}), ...(cond ? { ref: u.ref, cond, boss } : {}) };
  });
  const kills: ChamberResult['kills'] = {};
  const felled: string[] = [];
  const drops: ChamberResult['drops'] = [];
  const log: Ev[] = [];
  const g = battle(party, foes, rng(`arise|raid|${seed}|${index}`), enemyActions(d), (killer, victim) => {
    if (victim.side === 'e' && victim.ref) felled.push(victim.ref);
    if (victim.side !== 'e') return;
    // Felled the way its condition asks: read as it falls, however it was felled.
    const boss = c.boss && victim === foes[0];
    const want = victim.ref ? conditionOf(victim.ref, boss) : null;
    if (want && victim.ref) {
      const k = CONDITION[want];
      const round = log.reduce((n, e) => (e.t === 'round' ? n + 1 : n), 0);
      const met = (!k.status || !!victim.status[k.status]) && (!k.rounds || round <= k.rounds) && (!k.by || killer?.tag === k.by);
      if (met) { drops.push({ ref: victim.ref, boss }); log.push({ t: 'drop', v: victim.uid }); }
    }
    // Every Shadow that landed a hit helped fell it, whoever landed the last.
    const helped = new Set([...victim.hurtBy, ...(killer ? [killer] : [])]);
    for (const u of helped) {
      if (u.tag !== 'shadow' || !u.ref) continue;
      const t = (kills[u.ref] ??= { kills: 0, bosses: 0 });
      t.kills++;
      if (c.boss && victim === foes[0]) t.bosses++;
    }
  }, log, { hero: opts.manual ? party[0]?.uid : undefined, tactic: opts.tactic, potions: opts.potions, throws: opts.throws });
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
        // A Dry Gate heals nothing after a fight.
        const dry = !sealing.potionsAllowed(opts.seals ?? []);
        for (const u of party) {
          if (u.alive()) u.hp = Math.min(u.maxHp, u.hp + (dry ? 0 : u.maxHp * (ROOM_RECOVERY + u.d.recovery)));
          else if (u.tag === 'hero') u.hp = Math.round(u.maxHp * REVIVE);
        }
      }
      done = { index, label: c.label, boss: c.boss, won: res.won, rounds: res.rounds, log: res.log, roster, felled, kills, drops };
      return done;
    },
  };
}

/** Fight one chamber to the end on the auto policy. Mutates the party's units (health, statuses). */
export function runChamber(d: Dungeon, seed: string, index: number, party: Unit[], c: Chamber, tactic: Tactic = 'default', level = 0, seals: readonly SealId[] = []): ChamberResult {
  return openChamber(d, seed, index, party, c, { tactic, ascension: level, seals }).result();
}

/** The fight a node holds at an Ascension level: from Never Alone up, a boss stands with one of its gate's creatures. */
export function chamberAt(d: Dungeon, x: MapNode, level = 0, walker: number | null = null, seals: readonly SealId[] = []): Chamber {
  let c = chamberOf(d, x);
  // A Chosen holding the gate stands in the boss's place, for a run entered high enough to meet it.
  if (c.boss && walker) {
    const w = walkers.walkerOf(walker, d.rank as Rank);
    c = { ...c, label: w.name, foes: [w.id] };
  }
  if (!c.boss || !(asc.bossGuarded(level) || sealing.bossGuarded(seals)) || !d.mobs.length) return c;
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

/** What a run's hunter carries beyond who they walked in as: blessings at their tiers, and skills honed. */
export type Carried = blessings.Held & { honed?: string[]; levels?: Record<string, number> };

/** A skill equipped, as the tree holds it. */
const skillNode = (name: string) => NODES.find((n) => n.kind === 'skill' && n.name === name);

/**
 * The party's specs with the run's blessings worked into the hunter's, and the skills honed at its rests
 * at the levels they were honed to. The five old blessings are stats, and add as gear does.
 */
export function blessed(specs: UnitSpec[], run: Carried): UnitSpec[] {
  const honed = run.honed ?? [];
  if (!run.blessings.length && !honed.length) return specs;
  const [hero, ...rest] = specs;
  const bonus = { ...(hero.bonus ?? {}) };
  for (const id of run.blessings) for (const [k, v] of Object.entries(blessingById(id)?.bonus ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
  const own = (hero.own ?? []).map((a) => {
    const n = skillNode(a.name);
    const times = honed.filter((x) => x === a.name).length;
    if (!n || !times) return a;
    // Up to Lv.MAX a level honed is the tree's own; past it, each adds the force a level adds.
    const to = (run.levels?.[a.name] ?? 1) + times * HONE_LEVELS;
    const at = tree.skillAt(n, Math.min(n.max, to));
    return to > n.max ? { ...at, mult: Math.round((at.mult + (to - n.max) * HONE_PAST) * 100) / 100 } : at;
  });
  // The run's blessings join what the hunter's sets grant; one held both ways counts at the higher tier.
  const boons = { ...(hero.boons ?? {}) };
  for (const [id, tier] of Object.entries(blessings.boonsOf(run))) boons[id] = Math.max(boons[id] ?? 0, tier);
  return [{ ...hero, bonus, own, boons }, ...rest];
}

/** The level of each skill the hunter has equipped, by name: what a run walks in with. */
export const levelsOf = (s: Save): Record<string, number> => Object.fromEntries(tree.equipped(s).map((n) => [n.name, tree.levelOf(s, n.id)]));

/** The skills a rest can hone for this run: those equipped as it walked in, at any level. */
export const honeable = (run: Carried & { party?: UnitSpec[] }): string[] => (run.party?.[0]?.kit ?? []).filter((name) => !!skillNode(name));

/** The level a skill fights at in this run: as it walked in, and every level honed since. */
export const honedLevel = (run: Carried, name: string) => (run.levels?.[name] ?? 1) + (run.honed ?? []).filter((x) => x === name).length * HONE_LEVELS;

// ------------------------------------------------------------------ what a step does to the party

/** What a rest's Heal restores, as a share of maximum HP: less in Thin Rest, nothing in a Lightless Gate. */
export const healShare = (level = 0, seals: readonly SealId[] = []) => REST_HEAL * asc.restShare(level) * sealing.restShare(seals);

/** A rest's Heal: the standing recover. Mutates. */
export function rest(party: Unit[], level = 0, seals: readonly SealId[] = []) {
  for (const u of party) if (u.alive()) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * healShare(level, seals));
}

/** A rest's Steady: what ails the standing lifts. Mutates. */
export function steady(party: Unit[]) {
  for (const u of party) if (u.alive()) for (const st of Object.keys(u.status)) if (!STATUS[st]?.good) delete u.status[st];
}

/** What the hunter does at a rest: Heal the party, Hone one skill, or Steady the party and fill a potion. */
export type RestPick = { kind: 'heal' } | { kind: 'hone'; skill: string } | { kind: 'steady' };

/**
 * The System's pick at a rest: Heal while the hunter is below `REST_LINE` of their HP, and Hone its first
 * skill while they are not; Heal with none to hone, and with nothing to heal (Lightless), Hone, or Steady.
 */
export function systemRestPick(hp: number, run: Carried & { party?: UnitSpec[] }, level = 0, seals: readonly SealId[] = []): RestPick {
  const hone = honeable(run)[0];
  const heals = healShare(level, seals) > 0;
  if (heals && (hp < REST_LINE || !hone)) return { kind: 'heal' };
  return hone ? { kind: 'hone', skill: hone } : { kind: 'steady' };
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
export const eventAt = (x: MapNode): GateEvent | null => (x.kind === 'trap' ? TRAP : x.kind === 'event' && x.event ? eventById(x.event) ?? null : x.kind === 'landmark' && x.event ? landmarkEvent(x.event) ?? null : null);

/** The choice the System makes at a shrine, a Font, a trap or an event: at a shrine or a Font, from what it offered the run. */
export function systemChoice(x: MapNode, run?: blessings.Held): number {
  if (x.kind === 'shrine' || x.kind === 'font') return run ? blessings.systemPick(blessings.offerAt(run, x), run) : 0;
  return Math.max(0, eventAt(x)?.choices.findIndex((c) => c.system) ?? 0);
}

// ------------------------------------------------------------------ the run, in the save

/** Enter a gate: build the party as it walks in, charge fatigue, open the run. Mutates. */
export function begin(s: Save, d: Dungeon, now = Date.now(), seals: readonly SealId[] = []): OpenRaid {
  const day = dayKey(now);
  // Only Seals the Gate offers today are taken; with none asked for, the offer need not be drawn.
  const offer = seals.length ? sealing.offered(s, d, day) : [];
  const taken = seals.filter((id) => offer.includes(id));
  const fatigue = vitals.read(s, now).fatigue;
  // The practice gate is played as it is, and a Trial at the level it proves, whatever the hunter has chosen.
  const level = asc.entryLevel(s, d, isPractice(d));
  if (isTrial(d)) asc.enterTrial(s, day);
  if (!s.gates.entered.includes(d.id)) s.gates.entered.push(d.id);
  // The party walks in as the brief assessed it: at the fatigue it walked in with. The Gate's own is
  // charged after, for the runs to come, so the fight is the one the projection and calibration played.
  const specs = partySpecs(s, d, day, undefined, now, level, taken);
  if (!isPractice(d)) vitals.addRaidFatigue(s, d.rank, now, fatigueShare(s, level));
  const party = buildParty(specs);
  const hero = party[0];
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  hero.hp = Math.max(1, Math.round(hero.maxHp * frac));
  // A Gate's clock is set as the run walks in; a tower and the Practice Gate have none.
  const budget = isPractice(d) ? 0 : clock.budgetOf(build(d, mapSeed(d, day), 'labyrinth2'));
  // A map charted from the brief today is charted for the run: its hidden passages need no noticing.
  const charted = (s.gates.charted ?? []).includes(mapSeed(d, day));
  // The throwable readied is the one its fights throw, whatever is readied while it is open.
  const toss = shop.readied(s);
  s.gates.raid = {
    dungeonId: d.id, seed: `${d.id}|${now}`, day, at: 0,
    squad: isPractice(d) ? [] : shadows.squad(s).map((x) => x.id),
    carried: snapshot(party), won: 0, felled: [], kills: {}, startHp: hero.hp, bossFaced: false,
    party: specs, tactic: s.gates.tactic, orders: [],
    map: mapSeed(d, day), layout: 'labyrinth2', path: [], rested: [], haul: [], stash: {}, purse: 0, blessings: [], lost: false, fatigue, ascension: level, weapon: forge.weaponOf(s),
    lean: blessings.leanOf(s), levels: levelsOf(s),
    chosen: walkers.meets(s, d, day, level),
    ...(budget ? { clock: budget, moves: 0, held: s.hunter.rank } : {}),
    ...(toss ? { throw: toss } : {}),
    ...(taken.length ? { seals: [...taken] } : {}),
    ...(charted ? { charted: true } : {}),
    tally: { downs: 0, lowest: 1 },
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

/** The odds the hunter notices a hidden passage, by the Perception they walked in with. */
export const noticeOdds = (hero: UnitSpec | undefined) => clamp(NOTICE.base + (hero?.base.PER ?? 0) * NOTICE.per, NOTICE.base, NOTICE.max);

/**
 * What the run has opened beyond its corridors (`map.Openings`): each hidden passage it notices, decided
 * once for the run by a roll seeded from it and the passage at the odds its hunter walked in with; every
 * passage, once its map is charted; and the toll doors it has paid.
 */
export function openings(run: OpenRaid): Openings {
  const odds = noticeOdds(run.party?.[0]);
  return {
    notice: (a, b) => rng(`arise|notice|${run.seed}|${pairKey(a, b)}`)() < odds,
    charted: !!run.charted,
    tolls: new Set(run.tolls ?? []),
  };
}

/** The hidden passages the run has opened. */
export const opened = (d: Dungeon, run: OpenRaid) => { const m = mapOf(d, run); return passages(m, explored(m, run), openings(run)); };

/** A floor's secrets, on the later plans: its hidden passages, and how many of them the run has found. */
export function secretsOf(d: Dungeon, run: OpenRaid, floor: number): { found: number; of: number } {
  const m = mapOf(d, run);
  if (!m.secrets) return { found: 0, of: 0 };
  const on = (id: string) => (m.byId[id]?.floor ?? 0) === floor;
  const all = m.nodes.flatMap((x) => (x.hidden ?? []).filter((y) => x.id < y && on(x.id)).map((y) => pairKey(x.id, y)));
  const found = new Set(opened(d, run).map(([a, b]) => pairKey(a, b)));
  return { found: all.filter((k) => found.has(k)).length, of: all.length };
}

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
  const n = clock.walkMoves(m, explored(m, run), standing(d, run)?.id ?? m.start!, id, openings(run));
  return Number.isFinite(n) ? n : null;
}

/** The moves to every room the hunter can enter or walk back to from where they stand, by id. Empty without a clock. */
export function movesFrom(d: Dungeon, run: OpenRaid): Record<string, number> {
  if (!run.clock) return {};
  const m = mapOf(d, run);
  const done = explored(m, run);
  const dist = clock.walksFrom(m, done, standing(d, run)?.id ?? m.start!, openings(run));
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
  return sight(m, explored(m, run), remembered(s, run.map ?? mapSeed(d, run.day)), openings(run));
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
  // Charted, its hidden passages open as any corridor does, for the run inside and the runs to come today.
  if (run) run.charted = true;
  const keep = new Set([dayKey(now), run?.day]);
  s.gates.charted = [...new Set([...(s.gates.charted ?? []).filter((k) => keep.has(k.split('|').pop())), seed])];
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
  return bossDown(d, run) ? [] : reach(m, explored(m, run), openings(run));
}

/** The toll doors at the room the hunter stands in, sealed still: each the room beyond it and its key. Empty up a tower, or while a step is underway. */
export function tollsHere(d: Dungeon, run: OpenRaid): { to: string; key: string }[] {
  const x = standing(d, run);
  if (!x || run.lost || pending(d, run)) return [];
  const paid = new Set(run.tolls ?? []);
  return (x.toll ?? []).map((to) => ({ to, key: pairKey(x.id, to) })).filter((t) => !paid.has(t.key));
}

/**
 * The toll doors the hunter can break from where they are: sealed still, with a cleared room at one end
 * (`near`, the one they would pay at) and the room it opens at the other (`far`). Nothing while a step is
 * underway, or up a tower.
 */
export function tollDoorsOpen(d: Dungeon, run: OpenRaid): { key: string; near: string; far: string }[] {
  const m = mapOf(d, run);
  if (m.tower || run.lost || pending(d, run)) return [];
  const done = explored(m, run);
  const paid = new Set(run.tolls ?? []);
  const here = standing(d, run)?.id;
  const out: { key: string; near: string; far: string }[] = [];
  for (const x of m.nodes) for (const y of x.toll ?? []) {
    const key = pairKey(x.id, y);
    if (x.id > y || paid.has(key) || (!done.has(x.id) && !done.has(y))) continue;
    // Paid where the hunter stands if they stand at it; otherwise at the end they have cleared, the nearer if both.
    const ends = [x.id, y].filter((id) => done.has(id));
    const near = ends.includes(here ?? '') ? here! : ends.sort((a, b) => (movesTo(d, run, a) ?? 0) - (movesTo(d, run, b) ?? 0))[0];
    out.push({ key, near, far: near === x.id ? y : x.id });
  }
  return out;
}

/** What a toll costs the hunter now, in HP: `TOLL.hp` of their maximum. */
export const tollCost = (hero: { maxHp: number }) => Math.round(hero.maxHp * TOLL.hp);

/**
 * Pay a toll door where the hunter stands, in HP: it opens for good. False if there is no such door here,
 * or the hunter has too little HP to pay and still stand. Mutates.
 */
export function payToll(s: Save, d: Dungeon, run: OpenRaid, to: string, now = Date.now()): boolean {
  // Broken from the plan, the hunter walks to the door first, a move for each corridor, as walking back is.
  const far = tollDoorsOpen(d, run).find((t) => t.far === to || t.key === to);
  if (far && standing(d, run)?.id !== far.near) {
    const party = partyFor(s, d, run, now);
    if (party[0].hp <= tollCost(party[0])) return false;
    moveTo(d, run, far.near);
  }
  const door = tollsHere(d, run).find((t) => t.to === (far?.far ?? to));
  if (!door) return false;
  const party = partyFor(s, d, run, now);
  const hero = party[0];
  const cost = tollCost(hero);
  if (hero.hp <= cost) return false;
  hero.hp -= cost;
  run.tolls = [...(run.tolls ?? []), door.key];
  settleParty(s, d, run, party, now);
  return true;
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

/**
 * A rest waits on the hunter: in a Gate, they stand in one found and not yet used, and nothing is
 * underway; up a tower, the floor stepped onto is a rest.
 */
export function canRest(d: Dungeon, run: OpenRaid): boolean {
  if (run.lost) return false;
  const m = mapOf(d, run);
  if (m.tower) return pending(d, run)?.kind === 'rest';
  const x = standing(d, run);
  if (!x || x.kind !== 'rest' || pending(d, run)) return false;
  return explored(m, run).has(x.id) && !(run.rested ?? []).includes(x.id);
}

/** The rests a Gate's run has found and not yet used: each can be walked back to, and used once. */
export function restsFound(d: Dungeon, run: OpenRaid): string[] {
  const m = mapOf(d, run);
  if (m.tower || run.lost || pending(d, run) || bossDown(d, run)) return [];
  const done = explored(m, run);
  const used = new Set(run.rested ?? []);
  return m.nodes.filter((x) => x.kind === 'rest' && done.has(x.id) && !used.has(x.id)).map((x) => x.id);
}

/** What each of a rest's three would do for this run: Heal's share, the skills Hone can raise, and the potions Steady adds. */
export function restOptions(s: Save, run: OpenRaid) {
  return { heal: healShare(asc.levelOf(run), sealing.of(run)), hone: honeable(run), potions: Math.min(STEADY_POTIONS, shop.satchelRoom(s)) };
}

/** The System's pick at the rest waiting on the hunter. */
export const systemRest = (s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): RestPick => {
  const hero = partyFor(s, d, run, now)[0];
  return systemRestPick(hero.hp / hero.maxHp, run, asc.levelOf(run), sealing.of(run));
};

/**
 * Rest where the hunter stands, once at each rest: Heal the party, Hone one skill a level for the rest
 * of the Gate, or Steady the party, lifting every debuff, and add a Health Potion to the satchel. Up a
 * tower, the rest is the floor's, and the climb goes on from it. False if they cannot, or the pick is not
 * one this rest offers. Mutates.
 */
export function restHere(s: Save, d: Dungeon, run: OpenRaid, pick: RestPick = systemRest(s, d, run), now = Date.now()): boolean {
  if (!canRest(d, run)) return false;
  if (pick.kind === 'hone' && !honeable(run).includes(pick.skill)) return false;
  const party = partyFor(s, d, run, now);
  if (pick.kind === 'heal') rest(party, asc.levelOf(run), sealing.of(run));
  else if (pick.kind === 'steady') {
    steady(party);
    s.stock.hp = shop.held(s, 'hp') + Math.min(STEADY_POTIONS, shop.satchelRoom(s));
  } else run.honed = [...(run.honed ?? []), pick.skill];
  settleParty(s, d, run, pick.kind === 'hone' ? rebless(party, run.party, run) : party, now);
  if (mapOf(d, run).tower) run.at += 1;
  else run.rested = [...(run.rested ?? []), run.pos!];
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
  if (!sealing.potionsAllowed(sealing.of(run))) return 'Sealed: Dry';
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
  const m = mapOf(d, run);
  if (m.tower) return opts.length ? { enter: systemPick(opts).id } : null;
  const done = explored(m, run);
  const rested = new Set(run.rested ?? []);
  // Its own way (`systemWalk`), step by step, from the first step not yet taken.
  for (const step of systemWalk(m)) {
    if ('rest' in step) {
      if (done.has(step.rest) && !rested.has(step.rest)) return { rest: step.rest };
      continue;
    }
    if (done.has(step.enter)) continue;
    // Before the boss, any rest found and not used, whoever found it.
    if (m.byId[step.enter].kind === 'boss') {
      const spare = m.nodes.find((y) => y.kind === 'rest' && done.has(y.id) && !rested.has(y.id));
      if (spare) return { rest: spare.id };
    }
    if (opts.some((o) => o.id === step.enter)) return { enter: step.enter };
    break;
  }
  // Off its way, where the hunter walked: the next room of its road on offer, or its pick of those on offer.
  if (!opts.length) return null;
  const to = systemRoad(m).find((id) => !done.has(id));
  return { enter: (opts.find((o) => o.id === to) ?? systemPick(opts)).id };
}

/** Make the System's move: enter its room, or walk to its rest and use it. False if there was none. Mutates. */
export function systemMove(s: Save, d: Dungeon, run: OpenRaid, now = Date.now()): { move: Move; step: StepResult | null } | null {
  const move = systemNext(d, run);
  if (!move) return null;
  if ('rest' in move) {
    moveTo(d, run, move.rest);
    restHere(s, d, run, systemRest(s, d, run, now), now);
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
export function choose(s: Save, d: Dungeon, run: OpenRaid, id: string, _now = Date.now()): StepResult | null {
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
  // What a shrine or a Font offers is drawn as the hunter steps in, and written before it plays.
  if ((x.kind === 'shrine' || x.kind === 'font') && !run.offers?.[x.id]) run.offers = { ...(run.offers ?? {}), [x.id]: blessings.offerFor(run, x) };
  // A rest in a Gate is found, and used when the hunter chooses (`restHere`); up a tower it waits on them.
  if (x.kind === 'rest') {
    if (!m.tower) run.at += 1;
  } else if (x.kind === 'down') {
    // Down the stairs: the floor below's stairs up are reached at once, and the hunter stands on them.
    const below = across(m, x);
    run.at += 1;
    if (below) { run.path.push(below.id); run.at += 1; run.pos = below.id; }
  } else if (x.kind === 'treasure' || x.kind === 'vault') {
    // A cache found deep (two corridors off the road, in a wing, behind a secret or a toll) finds at the Gate's own grade.
    Object.assign(out, haulFind(d, run, rng(`arise|cache|${run.seed}|${id}`), x.kind === 'vault' || x.deep ? 0 : -1, x.kind === 'vault'));
    run.at += 1;
  }
  return out;
}

export interface Resolution { node: MapNode; choice: number; odds: number; won: boolean; effect: Effect; item?: string; mats?: forge.Bundle; blessing?: string; tier?: number }

/** Make the waiting choice at a shrine, a trap or an event. The roll is the run's own. Null if nothing waits. Mutates. */
export function resolve(s: Save, d: Dungeon, run: OpenRaid, choice: number, now = Date.now()): Resolution | null {
  const x = pending(d, run);
  if (!x || isFight(x)) return null;
  const party = partyFor(s, d, run, now);
  const roll = rng(`arise|choice|${run.seed}|${x.id}`);
  let out: Resolution;
  if (x.kind === 'shrine' || x.kind === 'font') {
    // A run that stepped in before offers were written draws its offer now, as it would have then.
    const offer = blessings.offerAt(run, x);
    run.offers = { ...(run.offers ?? {}), [x.id]: offer };
    const pick = offer.picks[choice] ?? offer.picks[0];
    if (!pick) return null;
    blessings.take(run, pick);
    const said = blessings.describe(pick.id, pick.tier);
    out = { node: x, choice, odds: 1, won: true, effect: { text: `${said.name}: ${said.text}` }, blessing: pick.id, tier: pick.tier };
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
      const b = blessings.gift(run, roll);
      if (b) { blessings.take(run, b); out.blessing = b.id; out.tier = b.tier; }
    }
  }
  settleParty(s, d, run, rebless(party, run.party, run), now);
  run.at += 1;
  return out;
}

/**
 * The same bodies, rebuilt on a new set of blessings. A blessing changes what a
 * unit is, not how hurt it is; maximum HP it adds arrives as HP too, so health
 * written back as a share of the maximum does not drop.
 */
export function rebless(party: Unit[], specs: UnitSpec[], run: Carried): Unit[] {
  const fresh = restore(buildParty(blessed(specs, run)), snapshot(party));
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
  // The satchel has already paid for the potions this chamber's orders drank, and the bag for what they threw.
  const potions = sealing.potionsAllowed(sealing.of(run)) ? shop.held(s, 'hp') + orders.filter((o) => o?.use === 'Potion').length : 0;
  const throws = Object.fromEntries(THROWABLES.filter((t) => !run.throw || t.id === run.throw).map((t) => [t.id, shop.held(s, t.id) + orders.filter((o) => o?.use === throwOrder(t.id)).length]));
  const ch = openChamber(d, run.seed, x.n, party, chamberAt(d, x, asc.levelOf(run), run.chosen ?? null, sealing.of(run)), { manual: true, tactic: run.tactic ?? 'default', potions, throws, orders, ascension: asc.levelOf(run), might: mightOf(d, run), seals: sealing.of(run) });
  return { party, ch, node: x };
}

/**
 * Write the hunter's order to the save, before it plays out. A Health Potion is
 * paid for here, out of the satchel, and a throw out of the bag; one they cannot pay for
 * becomes the System's choice. Returns the order as it will be played. Mutates.
 */
export function order(s: Save, run: OpenRaid, o: Order | null): Order | null {
  let given = o;
  if (given?.use === 'Potion') {
    if (shop.held(s, 'hp') > 0 && sealing.potionsAllowed(sealing.of(run))) s.stock.hp = shop.held(s, 'hp') - 1;
    else given = null;
  }
  // A throw is paid for out of the bag the same way; one the bag cannot pay for, or of a kind the run did
  // not ready, becomes the System's choice.
  const thrown = given ? thrownBy(given.use) : undefined;
  if (thrown) {
    if (shop.held(s, thrown.id) > 0 && (!run.throw || run.throw === thrown.id)) s.stock[thrown.id] = shop.held(s, thrown.id) - 1;
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
  const specs = run.party?.length ? run.party : partySpecs(s, d, run.day, run.squad, now, asc.levelOf(run), sealing.of(run));
  return restore(buildParty(blessed(specs, { ...run, blessings: run.blessings ?? [] })), run.carried);
}

/** Fold a fought chamber into the open run and write the hunter's health back. Mutates. */
export function record(s: Save, d: Dungeon, run: OpenRaid, party: Unit[], ch: ChamberResult, now = Date.now()) {
  const x = pending(d, run);
  run.at += 1;
  run.orders = [];
  run.felled.push(...ch.felled);
  if (ch.drops.length) run.drops = [...(run.drops ?? []), ...ch.drops];
  run.tally = feats.count(run.tally ?? { downs: 0, lowest: 1 }, ch, x?.kind === 'elite');
  if (ch.boss) run.bossFaced = true;
  if (ch.won) {
    run.won += 1;
    const share = x?.kind === 'fight' ? (x.deep ? FIGHT_PURSE.deep : FIGHT_PURSE.fight) * paceOf(d, mapOf(d, run)) : x?.kind === 'elite' ? FIGHT_PURSE.elite : 0;
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
  /** The Seals the run walked in with, whose pay is in `mats` and `blueprints`. */
  seals: SealId[];
  /** The Gate's Feats, those the clear met, and those met here for the first time, which paid. */
  feats: { asked: FeatId[]; met: FeatId[]; fresh: FeatId[] };
  /** Creatures felled the way their condition asks, kept by the run. */
  drops: number;
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
/** What a run's Seals, its condition drops and its first Feats add to what it leaves. */
interface Extras { seals: readonly SealId[]; drops: readonly { ref: string; boss: boolean }[]; feats: number }

function spoils(s: Save, d: Dungeon, run: OpenRaid, r: () => number, fights: number, elites: number, cleared: boolean, first: boolean, level: number, vault: number, pace = 1, extra: Extras = { seals: [], drops: [], feats: 0 }) {
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
  // Seals pay in Ember on a clear, by the Gate's grade; Wardens Wake only if the Gatekeeper it woke fell.
  const sealed = cleared ? extra.seals.filter((id) => id !== 'wardens' || !!run.tally?.keeper).reduce((n, id) => n + sealEmber(id, d.rank), 0) : 0;
  // A creature felled the way its condition asks leaves its family's part twice over; a boss, a blueprint below.
  for (const x of extra.drops) if (!x.boss) parts.push({ [forge.partId(FAMILY_PART[enemyById(x.ref)?.family ?? ''] ?? 'hide')]: DROP.part });
  const trophy = cleared ? forge.trophyAt(d) : null;
  const mats = forge.addUp(
    { [forge.alloyId(rank)]: alloy + (g === 0 ? low : 0) }, g > 0 ? { [forge.alloyId(lower)]: low } : {}, ...parts,
    trophy ? { [trophy]: 1 } : {}, cleared && level > 0 ? { [forge.EMBER.id]: Math.ceil(DROPS.ember * level) } : {},
    sealed ? { [forge.EMBER.id]: sealed } : {},
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
  // Each vault opened leaves a blueprint at its odds: an A- or S-Rank Gate can hold two.
  for (let k = 0; k < vault; k++) if (r() < BLUEPRINTS.vault) leave(rank);
  // A boss felled the way its condition asks, and each Feat met for the first time, leave a blueprint.
  for (const x of extra.drops) if (x.boss) leave(rank);
  for (let i = 0; i < extra.feats * FEAT_PAY.blueprints; i++) leave(rank);
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
  const vault = steps.filter((x) => x.kind === 'vault').length;
  // The Feats a clear met, of the Gate's three: each pays once, the first time it is met here.
  const asked = feats.featsOf(d);
  // A run opened before Feats were counted has no tally, and is judged on none.
  const met = cleared && !practice && !tower && run.tally ? feats.judge(asked, run.tally, !m.tower && chartedFloors(m, explored(m, run)) === m.floors.length) : [];
  const fresh = feats.settle(s, d, met);
  const extra: Extras = { seals: sealing.of(run), drops: run.drops ?? [], feats: fresh.length };
  const left = kept && !practice ? spoils(s, d, run, r, fights, elites, cleared, firstClear, level, vault, paceOf(d, m), extra) : { mats: {}, blueprints: [] as string[], forged: [] as string[] };
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
    seals: extra.seals.slice(), feats: { asked, met, fresh }, drops: kept ? extra.drops.length : 0,
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
export function project(s: Save, d: Dungeon, runs = 24, now = Date.now(), seals: readonly SealId[] = []) {
  const day = dayKey(now);
  // The run would be entered at the level chosen (a Trial, at its own): the projection plays every rule it brings, and every Seal taken.
  const level = asc.entryLevel(s, d, isPractice(d));
  const offer = seals.length ? sealing.offered(s, d, day) : [];
  const taken = seals.filter((id) => offer.includes(id));
  const walker = walkers.meets(s, d, day, level);
  const specs = partySpecs(s, d, day, undefined, now, level, taken);
  // How often the System met each of the Gate's Feats, on the clears it made.
  const asked = feats.featsOf(d);
  const featsMet = Object.fromEntries(asked.map((id) => [id, 0])) as Record<FeatId, number>;
  const frac = vitals.read(s, now).hp / Math.max(1, vitals.maxima(s).hp);
  const m = build(d, mapSeed(d, day));
  const road = systemRoad(m).map((id) => m.byId[id]);
  // The System's whole way: its road, the rests it steps into beside it, and where it rests.
  const walk = systemWalk(m);
  const lean = blessings.leanOf(s);
  const levels = levelsOf(s);
  let clears = 0;
  let heroDown = 0;
  let reached = 0;
  for (let i = 0; i < runs; i++) {
    const seed = `proj|${d.id}|${day}|${i}`;
    // What the System's run carries: the blessings it takes, and the skills it hones.
    const held: Carried & { party: UnitSpec[]; honed: string[] } = { seed, lean, blessings: [], tiers: {}, honed: [], levels, party: specs };
    let party = buildParty(specs);
    // A rest as the System uses it: Heal while the hunter is low, Hone while they are not.
    const restNow = () => {
      const pick = systemRestPick(party[0].hp / party[0].maxHp, held, level, taken);
      if (pick.kind === 'heal') rest(party, level, taken);
      else if (pick.kind === 'steady') steady(party);
      else { held.honed = [...held.honed, pick.skill]; party = rebless(party, specs, held); }
    };
    party[0].hp = Math.max(1, Math.round(party[0].maxHp * frac));
    let won = true;
    let tally: RunTally = { downs: 0, lowest: 1 };
    for (const step of walk) {
      // A rest it found, used where the System uses it: at once on a floor above the boss's, before the boss on its own.
      if ('rest' in step) { restNow(); continue; }
      const x = m.byId[step.enter];
      if (isFight(x)) {
        if (x.kind === 'boss') reached++;
        const ch = runChamber(d, seed, x.n, party, chamberAt(d, x, level, walker, taken), s.gates.tactic, level, taken);
        tally = feats.count(tally, ch, x.kind === 'elite');
        won = ch.won;
        if (!won) break;
      } else if (x.kind === 'rest') {
        // Up a tower, a rest is taken as it is reached; in a Gate, the walk says when.
        if (m.tower) restNow();
      } else if (x.kind === 'shrine' || x.kind === 'font') {
        const offer = blessings.offerFor(held, x);
        const pick = offer.picks[blessings.systemPick(offer, held)];
        if (pick) { blessings.take(held, pick); party = rebless(party, specs, held); }
      } else {
        const c = eventAt(x)?.choices[systemChoice(x)];
        if (c) touch(party, rng(`proj|choice|${seed}|${x.id}`)() < oddsOf(c, specs[0], level) ? c.win : c.lose ?? c.win);
      }
    }
    if (won) {
      clears++;
      // The System's road never clears every room, so Thorough is never the System's.
      for (const id of feats.judge(asked, tally, false)) featsMet[id]++;
    }
    if (!won && party[0].hp <= 0) heroDown++;
  }
  return { runs, cleared: clears, rate: clears / runs, heroDown, reachedBoss: reached, road: road.map((x) => x.id), feats: featsMet };
}

/** The System's assessment of a Gate, graded from its clear rate. It reports; it does not advise. */
export const GRADES = [
  { min: 0.9, text: 'Safe', tone: 'ready' },
  { min: 0.7, text: 'Likely', tone: 'ready' },
  { min: 0.4, text: 'Even', tone: 'even' },
  { min: 0.15, text: 'Unlikely', tone: 'over' },
  { min: 0, text: 'Lethal', tone: 'over' },
] as const;

export function verdict(rate: number): { tone: 'ready' | 'even' | 'over'; text: string } {
  const g = GRADES.find((x) => rate >= x.min) ?? GRADES[GRADES.length - 1];
  return { tone: g.tone, text: g.text };
}
