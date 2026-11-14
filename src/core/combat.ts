/**
 * The fight. Deterministic, seeded and round-based. `battle` pauses on the
 * hunter's turn for an order; given the same seed and the same orders it
 * plays out the same way every time, so a fight can be replayed from its
 * orders alone. Nobody waits in `fight`: the auto policy plays everyone.
 *
 * Foes show their hand. Each one settles its next action (ability and first
 * target) as soon as its last one is done, and then does exactly that,
 * unless the target fell first or it is stunned.
 *
 * Everything a unit is worth comes from its five attributes. Abilities and
 * passives are data; statuses are a table of multipliers.
 */
import { ABILITIES, CLASS_PASSIVES, CLASS_SKILLS, PASSIVES } from '@/data/abilities';
import { boonById, boonValue, GRUDGE_MAX } from '@/data/blessings';
import { EDGE, TREE_PASSIVES, TREE_SKILLS } from '@/data/tree';
import { ENGRAVE, ENGRAVE_PASSIVES, engravingById, engraveStyle, type EngravingId } from '@/data/engravings';
import { at as byGrade, TRICK, TRICKS, type TrickId } from '@/data/tricks';
import type { Ability, Attrs, Order, Tactic } from './types';
import { clamp, type Rand } from './util';

export interface Derived {
  maxHp: number; patk: number; mpow: number; defense: number; resist: number;
  accuracy: number; evasion: number; crit: number; initiative: number;
  /** Bonus percentage points on landing a status, and on resisting one. */
  statusChance: number; statusSave: number;
  /** Fraction added to between-chamber healing. */
  recovery: number;
}

/** A critical hit's multiplier, and the most critical chance a hunter can have from stats alone, and with gear. */
export const CRIT = { mult: 1.5, base: 50, max: 60 } as const;
/** The least and the most a hit can be, as a chance, whatever the accuracy and the evasion. */
export const HIT = { min: 5, max: 95 } as const;

export function derive(b: Attrs): Derived {
  const { STR: s, VIT: v, AGI: a, INT: i, PER: p } = b;
  return {
    maxHp: 50 + v * 15 + s * 2,
    patk: 5 + s * 4 + a,
    mpow: i * 5 + p,
    defense: v * 3 + s,
    resist: v * 2 + i * 2,
    accuracy: 50 + p * 2 + a,
    evasion: a * 1.5 + p * 0.5,
    crit: Math.min(CRIT.base, 2 + a * 0.18 + p * 0.3),
    initiative: a * 2 + p,
    statusChance: 0, statusSave: 0, recovery: 0,
  };
}

/** Apply gear roll bonuses (flat, or fractions for pct stats). */
export function applyBonuses(d: Derived, bonus: Record<string, number>): Derived {
  const pct = new Set(['maxHp', 'patk', 'mpow', 'defense', 'resist', 'recovery']);
  const out = { ...d };
  for (const [k, v] of Object.entries(bonus)) {
    const key = k as keyof Derived;
    if (!(key in out)) continue;
    if (key === 'recovery') out.recovery += v;
    else if (pct.has(key)) out[key] = out[key] * (1 + v);
    else out[key] = out[key] + v;
  }
  out.crit = Math.min(CRIT.max, out.crit);
  return out;
}

export const STATUS: Record<string, { turns: number; dot?: number; pdef?: number; mdef?: number; eva?: number; ini?: number; acc?: number; atk?: number; skip?: boolean; good?: boolean }> = {
  Bleeding: { turns: 3, dot: 0.06 },
  Poisoned: { turns: 3, dot: 0.05 },
  Burning: { turns: 3, dot: 0.07 },
  Staggered: { turns: 2, pdef: 0.75 },
  Cursed: { turns: 3, mdef: 0.75 },
  Marked: { turns: 3, eva: 0.7 },
  Rooted: { turns: 2, eva: 0.75, ini: 0.75 },
  Corroded: { turns: 3, acc: 0.85 },
  Stunned: { turns: 1, skip: true },
  Weakened: { turns: 3, atk: 0.75 },
  Chilled: { turns: 3, ini: 0.75 },
  Rallied: { turns: 3, good: true, ini: 1.2, acc: 1.1 },
  Veiled: { turns: 2, good: true, eva: 1.5 },
  // Two, so it outlives the end of the round it was raised in; the unit's next turn takes it down.
  Guarded: { turns: 2, good: true },
  // A creature's own: a pack rallied, a creature enraged (each by its grade's share), a wind-up broken.
  Emboldened: { turns: TRICK.rally.turns, good: true },
  Enraged: { turns: 99, good: true },
  Broken: { turns: TRICK.windup.broken.turns, pdef: TRICK.windup.broken.def, mdef: TRICK.windup.broken.def },
  // Held while the guardian stands by it: its next action takes it down.
  Shielded: { turns: 99, good: true },
};

const pctOf = (x: number) => Math.round(Math.abs(1 - x) * 100);
/** What a status does, read from STATUS, name before value (docs/VOICE.md). */
export const STATUS_TEXT: Record<string, string> = Object.fromEntries(Object.entries(STATUS).map(([k, st]) => {
  const parts: string[] = [];
  if (st.dot) parts.push(`HP -${Math.round(st.dot * 100)}% each round`);
  const sign = (x: number) => (x > 1 ? '+' : '-');
  if (st.pdef) parts.push(`Physical defence ${sign(st.pdef)}${pctOf(st.pdef)}%`);
  if (st.mdef) parts.push(`Magical resistance ${sign(st.mdef)}${pctOf(st.mdef)}%`);
  if (st.eva) parts.push(`Evasion ${sign(st.eva)}${pctOf(st.eva)}%`);
  if (st.acc) parts.push(`Accuracy ${st.acc > 1 ? '+' : '-'}${pctOf(st.acc)}%`);
  if (st.atk) parts.push(`Attack ${sign(st.atk)}${pctOf(st.atk)}%`);
  if (st.ini) parts.push(`Initiative ${st.ini > 1 ? '+' : '-'}${pctOf(st.ini)}%`);
  if (st.skip) parts.push('Next action lost');
  return [k, parts.join(' · ')];
}));

const REACH: Record<string, number> = { single: 1, cleave: 2, volley: 3, spread: 3, burst: 4, wild: 3, all: 99, support: 0, taunt: 0 };
/** How many an ability reaches, by its profile. */
export const reachOf = (profile: string) => REACH[profile] ?? 1;
export const REACH_TEXT: Record<string, string> = {
  single: 'one target', cleave: 'two targets', volley: 'three targets', spread: 'three targets',
  burst: 'four targets', wild: 'three targets', all: 'every foe', support: 'the whole party', taunt: 'every foe',
};

const STRIKE: Ability = { name: 'Strike', type: 'physical', profile: 'single', mult: 1, cd: 0, inflicts: [] };
export { STRIKE };
/** What a guarding unit takes of every hit. */
export const GUARD = 0.5;
STATUS_TEXT.Guarded = `Damage taken -${(1 - GUARD) * 100}% until its next turn`;
STATUS_TEXT.Shielded = `Damage taken -${Math.round((1 - TRICK.shield.taken) * 100)}% while its guardian stands by it`;
STATUS_TEXT.Emboldened = `Attack +${Math.round(TRICK.rally.atk[0] * 100)}-${Math.round(TRICK.rally.atk[5] * 100)}% by grade`;
STATUS_TEXT.Enraged = `Attack +${Math.round(TRICK.enrage.atk[0] * 100)}-${Math.round(TRICK.enrage.atk[5] * 100)}% by grade`;
/** A Health Potion restores this share of the drinker's maximum HP, in a fight or out of one. */
export const POTION_HEAL = 0.25;

/**
 * What the hunter can throw on their turn, from the bag: each lands its status on the foes it reaches,
 * the foe aimed at first, with no roll, unless the foe is immune to it. `reach` as an ability's.
 */
export const THROWABLES = [
  { id: 'flash', name: 'Flash Vial', status: 'Stunned', reach: 1 },
  { id: 'cord', name: 'Binding Cord', status: 'Rooted', reach: 1 },
  { id: 'ember', name: 'Ember Flask', status: 'Burning', reach: 3 },
] as const;
export type ThrowId = (typeof THROWABLES)[number]['id'];
export const throwable = (id: string) => THROWABLES.find((x) => x.id === id);
/** A throw as an order names it: `Throw:flash`. */
export const throwOrder = (id: ThrowId) => `Throw:${id}`;
export const thrownBy = (use: string) => (use.startsWith('Throw:') ? throwable(use.slice(6)) : undefined);
/** Cover, the hunter's fourth action: what is aimed at the ally covered comes at the hunter, guarding. */
export const COVER = 'Cover';
const abilityMap = new Map<string, Ability>([...ABILITIES, ...CLASS_SKILLS, ...TREE_SKILLS].map((a) => [a.name, a]));
const ALL_PASSIVES = [...PASSIVES, ...CLASS_PASSIVES, ...TREE_PASSIVES, ...ENGRAVE_PASSIVES];
const passiveMap = new Map<string, string>(ALL_PASSIVES.map((p) => [p.name, p.style]));
export const ability = (n: string) => abilityMap.get(n);
export const passiveStyle = (n: string) => passiveMap.get(n);
export const passiveText = (n: string) => ALL_PASSIVES.find((p) => p.name === n)?.text ?? '';

const BASE_STATUS = 35;
const SWING = 0.15;
export const ROUND_CAP = 40;
const SIGNATURE: Record<string, keyof Derived> = { STR: 'patk', AGI: 'evasion', PER: 'accuracy', VIT: 'maxHp', INT: 'mpow' };

export interface UnitSpec {
  uid: string;
  name: string;
  side: 'p' | 'e';
  base: Attrs;
  kit?: string[];
  /** The unit's own versions of abilities in its kit, by name: a hunter's skills at the levels learned. */
  own?: Ability[];
  passives?: string[];
  imm?: string[];
  res?: string[];
  bonus?: Record<string, number>;
  /** Multipliers applied after everything else (the hunter's own edge, encounter scaling). */
  hpMult?: number;
  atkMult?: number;
  tag?: 'hero' | 'ally' | 'shadow' | 'foe';
  ref?: string;
  /** A creature's behaviours (`data/tricks.ts`), and the grade its numbers are read at. */
  tricks?: TrickId[];
  grade?: string;
  /** The hunter's blessings for the run (`data/blessings.ts`), by id, at their tiers 1 to 3. */
  boons?: Record<string, number>;
}

/** A foe's next action as shown: an ability and the unit it goes at first, or one of its behaviours. */
export interface Intent {
  ab: string;
  at?: string;
  /** A behaviour taken instead of an attack: a shield on an ally, a rally, a mark, a drink. */
  kind?: 'shield' | 'rally' | 'mark' | 'drink';
  /** How much harder than the ability's own it lands: a wind-up's, a channel's, a marked target's strike. */
  mult?: number;
  /** A wind-up or a channel: the actions until it lands (1, the next), and its break pips left of `max`. */
  wind?: number;
  pips?: number;
  max?: number;
}

/** No blessings: every foe's, and a hunter's without any. */
const NONE: Record<string, number> = {};

export class Unit {
  uid: string; name: string; side: 'p' | 'e'; base: Attrs; d: Derived;
  maxHp: number; hp: number; kit: string[]; styles: string[]; names: string[];
  imm: string[]; res: string[]; status: Record<string, number> = {}; cd: Record<string, number> = {};
  esc = 0; aura = { ini: 0, acc: 0 }; spent = new Set<string>(); kin: Unit[] = [];
  /** Foes this unit has put down this fight, for Rampage. */
  mom = 0;
  own: Map<string, Ability>;
  atkMult: number; tag: UnitSpec['tag']; ref?: string;
  /** The last foe to land a hit on this unit, for allies told to protect it. */
  hitBy?: Unit;
  /** Everyone who landed a hit on this unit: each helped fell it. */
  hurtBy = new Set<Unit>();
  /** A foe's next action, settled in advance and shown: an ability, and the unit it goes at first. */
  intent?: Intent;
  /** A creature's behaviours, and the grade it has them at. */
  tricks: Set<TrickId>;
  grade: string;
  /** A wind-up or a channel underway: what lands, on whom, when, how much harder, and the pips left. */
  wind?: { ab: string; at?: string; left: number; pips: number; max: number; mult: number };
  /** An assassin's marked target, struck with its next action. */
  quarry?: Unit;
  /** The guardian shielding this creature until the guardian's next action. */
  shieldOf?: Unit;
  /** A rally's share and an enrage's on its attack, the hits its bloodlust has counted, and what it has spent. */
  bold = 0; rage = 0; lust = 0; hardUsed = false; rising = false; drank = false;
  /** The ally covering this unit until that ally's next turn: what is aimed at this unit goes at them. */
  coveredBy?: Unit;
  /** The hunter's blessings, by id, at their tiers; and, on a foe, the hunter it fights, whose blessings reach it. */
  boons: Record<string, number>;
  against?: Unit;
  /** What blessings have gathered this fight: a Bloodrush waiting, Grudge's hits taken, Thousand Cuts' hits landed, Killing Gaze's quarry, Iron Skin spent this round. */
  rush = false; grudge = 0; cuts = 0; gaze?: string; ironUsed = false;

  constructor(sp: UnitSpec) {
    this.uid = sp.uid; this.name = sp.name; this.side = sp.side; this.base = sp.base;
    this.tag = sp.tag; this.ref = sp.ref;
    this.tricks = new Set(sp.tricks ?? []);
    this.boons = sp.boons && Object.keys(sp.boons).length ? sp.boons : NONE;
    this.grade = sp.grade ?? 'E';
    this.kit = sp.kit ?? [];
    this.own = new Map((sp.own ?? []).map((a) => [a.name, a]));
    this.names = sp.passives ?? [];
    this.styles = this.names.map((n) => passiveStyle(n) ?? '');
    this.imm = sp.imm ?? []; this.res = sp.res ?? [];
    // Dragonscale: no burn and no poison take.
    if (this.has(engraveStyle('dragonkin'))) this.imm = [...new Set([...this.imm, 'Burning', 'Poisoned'])];
    this.atkMult = sp.atkMult ?? 1;
    const d = applyBonuses(derive(sp.base), sp.bonus ?? {});
    if (this.has('identity')) {
      const lead = (Object.keys(SIGNATURE) as (keyof Attrs)[]).reduce((a, b) => (sp.base[b] > sp.base[a] ? b : a));
      const key = SIGNATURE[lead];
      d[key] = d[key] * 1.1;
    }
    if (this.has('brace')) d.defense *= 1.2;
    if (this.has('arcane')) d.resist += 15;
    if (this.has('bulwark')) d.maxHp *= 1.2;
    if (this.has('bladework')) d.crit = Math.min(CRIT.max, d.crit + 12);
    if (this.has('keen')) d.accuracy += 15;
    this.d = d;
    this.maxHp = Math.round(d.maxHp * (sp.hpMult ?? 1));
    this.hp = this.maxHp;
  }

  has(style: string) { return this.styles.includes(style); }
  /** A blessing's tier on this unit, 0 for none; and its number at that tier. */
  boon(id: string) { return this.boons[id] ?? 0; }
  bv(id: string) { return boonValue(id, this.boon(id)); }
  /** An ability as this unit uses it: its own version if it has one. */
  ab(n: string) { return this.own.get(n) ?? ability(n); }
  named(style: string) { return this.names[this.styles.indexOf(style)] ?? style; }
  alive() { return this.hp > 0; }
  mod(key: 'pdef' | 'mdef' | 'eva' | 'ini' | 'acc' | 'atk') {
    let m = 1;
    for (const k of Object.keys(this.status)) m *= STATUS[k]?.[key] ?? 1;
    return m;
  }
  atk(magic: boolean) {
    const own = (this.status.Emboldened ? 1 + this.bold : 1) * (this.status.Enraged ? 1 + this.rage : 1) * (1 + this.lust * TRICK.bloodlust.step);
    return ((magic ? this.d.mpow : this.d.patk + this.esc * 4)) * this.mod('atk') * this.atkMult * (1 + this.mom * EDGE.momentum.step) * own;
  }
  /** It has this behaviour. */
  does(t: TrickId) { return this.tricks.has(t); }
  def(magic: boolean) {
    const pack = this.has('pack') ? Math.min(2, this.kin.filter((k) => k !== this && k.alive() && k.has('pack')).length) * 5 : 0;
    return magic ? (this.d.resist + pack) * this.mod('mdef') : (this.d.defense + pack) * this.mod('pdef');
  }
  tempo() { return this.has('tempo') && !this.status.Rooted ? 10 : 0; }
  ini() { return (this.d.initiative + this.aura.ini + this.tempo()) * this.mod('ini'); }
  acc() { return (this.d.accuracy + this.aura.acc) * this.mod('acc'); }
  eva() { return (this.d.evasion + this.tempo()) * this.mod('eva') * (this.status.Guarded && this.boon('sidestep') ? 1 + this.bv('sidestep') : 1); }
}

export type Ev =
  | { t: 'round'; n: number }
  | { t: 'hit'; a: string; v: string; ab: string; dmg: number; crit: boolean; hp: number }
  | { t: 'miss'; a: string; v: string; ab: string }
  /** `s`: the status it granted the side; unset is Rallied, null none (a heal). */
  | { t: 'support'; a: string; ab: string; s?: string | null }
  /** A curse cast, or a taunt: no damage. `n` counts the foes a taunt turned. */
  | { t: 'cast'; a: string; ab: string; k: 'curse' | 'taunt'; n?: number }
  | { t: 'stun'; a: string }
  | { t: 'status'; v: string; s: string }
  | { t: 'tick'; v: string; s: string; dmg: number; hp: number }
  | { t: 'expire'; v: string; s: string }
  | { t: 'down'; v: string }
  /** A creature felled the way its condition asks: it leaves more (`data/drops.ts`). */
  | { t: 'drop'; v: string }
  | { t: 'guard'; a: string }
  /** Cover: `a` covers `v`; `n` counts the foes it turned. */
  | { t: 'cover'; a: string; v: string; n: number }
  /** A throw from the bag: what, and on whom. What it inflicts follows as `status` events. */
  | { t: 'throw'; a: string; item: string; v: string[] }
  /** A creature's behaviour taken instead of an attack: `v` the ally shielded or the target marked. */
  | { t: 'trick'; a: string; k: 'shield' | 'rally' | 'mark' | 'drink'; v?: string }
  /** A wind-up or a channel gathering: `left` actions until it lands. */
  | { t: 'charge'; a: string; ab: string; left: number }
  /** A hit took a pip off a wind-up or a channel: `left` remain. */
  | { t: 'pip'; v: string; left: number }
  /** A wind-up or a channel broken: the creature is Stunned and its defences down. */
  | { t: 'break'; v: string }
  | ({ t: 'intent'; u: string } & Intent)
  /** `ab`: the support that healed; unset is a Health Potion. */
  | { t: 'heal'; a: string; amt: number; hp: number; ab?: string }
  | { t: 'passive'; u: string; p: string; k: string; hp?: number; amt?: number };

const hitChance = (acc: number, eva: number) => clamp((100 * acc) / (acc + eva), HIT.min, HIT.max);

/**
 * One hit's damage, rounded, before a ward: `swing` is where it falls in the swing, 0 to 1, and
 * `crit` whether it is critical. The fight passes its rolls; the reckoning passes the ends of the range.
 */
function blow(u: Unit, t: Unit, a: Ability, swing: number, crit: boolean, guarded = !!t.status.Guarded, plain = false): number {
  const magic = a.type === 'magic';
  const power = u.atk(magic);
  let dmg = Math.max(1, ((power * a.mult * power) / (power + t.def(magic))) * (1 - SWING + swing * 2 * SWING));
  // Juggernaut: a Strike carries a share of the hunter's maximum HP.
  if (a.name === STRIKE.name && u.boon('jugg')) dmg += u.maxHp * u.bv('jugg');
  if (crit) dmg *= u.has('deadeye') && t.status.Marked ? EDGE.deadeye : CRIT.mult;
  dmg *= edgeOf(u, t, crit, plain);
  if (u.has('execute') && t.hp < t.maxHp * EDGE.execute.below) dmg *= EDGE.execute.mult;
  if (u.has('exploit') && Object.keys(t.status).some((k) => STATUS[k] && !STATUS[k].good)) dmg *= EDGE.exploit;
  if (t.has('stalwart') && t.hp > t.maxHp * EDGE.stalwart.above) dmg *= EDGE.stalwart.mult;
  // A creature's own: frenzy on the wounded, the first hit a hardened one takes each round, a shield an ally holds.
  if (u.does('frenzy') && t.hp < t.maxHp * TRICK.frenzy.below) dmg *= 1 + TRICK.frenzy.dmg;
  if (t.does('hardened') && !t.hardUsed) dmg *= TRICK.hardened.taken;
  if (t.shieldOf?.alive()) dmg *= TRICK.shield.taken;
  if (guarded) dmg *= GUARD * (1 - t.bv('aegis'));
  return Math.round(dmg);
}

const debuffs = (t: Unit) => Object.keys(t.status).filter((k) => STATUS[k] && !STATUS[k].good).length;

/**
 * What the blessings make of one hit from `u` on `t`, as a multiplier: the attacker's against what the
 * target is carrying or doing, and the target's own against the hit. `plain`, a counter or a splash,
 * spends nothing and is raised by nothing waiting for the next hit.
 */
function edgeOf(u: Unit, t: Unit, crit: boolean, plain: boolean): number {
  let m = 1;
  if (t.status.Bleeding) m *= 1 + u.bv('butcher') + (crit ? u.bv('storm') : 0);
  if (t.status.Broken || t.status.Stunned) m *= 1 + u.bv('shatter');
  if (u.boon('wither')) m *= 1 + u.bv('wither') * debuffs(t);
  if (t.intent?.at === u.uid) m *= 1 + u.bv('read');
  if (t.wind) m *= 1 + u.bv('weak');
  if (!plain) {
    if (u.rush) m *= 1 + u.bv('rush');
    if (u.boon('quick') && !u.spent.has('quick')) m *= 1 + u.bv('quick');
    if (u.boon('snap') && !t.spent.has(`first:${u.uid}`)) m *= 1 + u.bv('snap');
    if (u.grudge) m *= 1 + u.grudge * u.bv('grudge');
  }
  if (t.boon('iron') && !t.ironUsed) m *= 1 - t.bv('iron');
  if (t.hp < t.maxHp / 2) m *= 1 - t.bv('last');
  return m;
}

/** A unit's chance to land a critical hit on `t`, as a percentage: what its blessings make certain, or its own. */
function critOf(u: Unit, t: Unit): number {
  if (engraved(u, 'goblinoid') && (t.status.Rooted || t.status.Stunned)) return 100;
  if (u.boon('killshot') && t.hp < t.maxHp * u.bv('killshot')) return 100;
  if (u.gaze && u.gaze === t.uid) return 100;
  if (u.boon('cuts') && (u.cuts + 1) % u.bv('cuts') === 0) return 100;
  return u.d.crit + (t.status.Marked ? u.bv('deadshot') : 0);
}

/** A Strike as a blessing makes it: Twin Fangs strikes twice, each lighter. */
const struck = (u: Unit, a: Ability): { a: Ability; times: number } =>
  (a.name === STRIKE.name && u.boon('twin') ? { a: { ...a, mult: a.mult * u.bv('twin') }, times: 2 } : { a, times: 1 });

/** What one hit would do as things stand: the odds it lands and crits, as percentages, and its damage. */
export interface Reckoning {
  chance: number;
  crit: number;
  /** Damage at the bottom and the top of the swing, and the most a critical hit does. */
  lo: number;
  hi: number;
  critHi: number;
  /** Whether a hit that lands fells the target: every time, on a high roll or a critical hit, or never. */
  kill: 'sure' | 'maybe' | null;
}

/**
 * Reckon one hit of `a` from `u` on `t`, from the engine's own numbers and never a roll, so it shows
 * what can happen and not what will. `guarded` sets whether the target takes it guarding; unset, it
 * does if it is now. A curse, a support or a taunt does no damage, and reckons to null.
 */
export function reckon(u: Unit, t: Unit, a: Ability, guarded = !!t.status.Guarded): Reckoning | null {
  if (a.mult === 0 || a.profile === 'support' || a.profile === 'taunt') return null;
  const magic = a.type === 'magic';
  const chance = Math.round(hitChance(u.acc() + (u.has('targeting') && t.status.Marked ? 10 : 0), t.eva()));
  // Ambush makes the first hit of the fight critical, whatever the roll; and a blessing can.
  const sure = (u.has('ambush') && !u.spent.has('ambush')) || critOf(u, t) >= 100;
  const crit = sure ? 100 : Math.round(Math.min(100, critOf(u, t)));
  const ward = (n: number) => (magic && t.has('arcane') && !t.spent.has('ward') ? Math.max(1, Math.round(n / 2)) : n);
  // Twin Fangs: a Strike is two hits, reckoned together.
  const { a: one, times } = struck(u, a);
  const lo = ward(blow(u, t, one, 0, sure, guarded)) * times;
  const hi = ward(blow(u, t, one, 1, sure, guarded)) * times;
  const critHi = ward(blow(u, t, one, 1, true, guarded)) * times;
  // A unit that stands at 1 HP once is not defeated by the hit that would have defeated it.
  const stands = (t.has('survival') && !t.spent.has('stand')) || (t.boon('unbroken') > 0 && !t.spent.has('unbroken'));
  // Red Harvest: a Bleeding foe left below its mark is defeated.
  const need = u.boon('harvest') && t.status.Bleeding ? Math.min(t.hp, Math.floor(t.hp - t.maxHp * u.bv('harvest')) + 1) : t.hp;
  const kill = stands ? null : lo >= need ? 'sure' : (crit > 0 ? critHi : hi) >= need ? 'maybe' : null;
  return { chance, crit, lo, hi, critHi, kill };
}

function statusLands(src: Unit, t: Unit, st: string) {
  if (src.does('virulent') && !t.imm.includes(st)) return 100;
  if (t.imm.includes(st)) return 0;
  let c = BASE_STATUS + src.d.statusChance - Math.round(t.d.resist / 5) - t.d.statusSave;
  if (t.res.includes(st)) c -= 15;
  return Math.max(5, c);
}

/** The auto policy's pick. `ahead` counts the cooldown ticks that will pass before the action happens. */
function choose(u: Unit, r: Rand, ahead = 0): Ability {
  const ready = u.kit.map((n) => u.ab(n)).filter((a): a is Ability => !!a && (u.cd[a.name] ?? 0) <= ahead);
  if (!ready.length) return STRIKE;
  if (ready.length === 1) return ready[0];
  const heavy = ready.reduce((a, b) => (b.mult > a.mult ? b : a));
  return r() < 0.6 ? heavy : ready[Math.floor(r() * ready.length)];
}

/** Who an ability lands on. A `first` target is always among them; the rest are drawn at random. */
function targets(a: Ability, foes: Unit[], r: Rand, first?: Unit): Unit[] {
  const live = foes.filter((f) => f.alive());
  const n = REACH[a.profile] ?? 1;
  // Reaching everyone still means the one aimed at is hit first.
  if (n >= live.length) return first && live.includes(first) ? [first, ...live.filter((x) => x !== first)] : live;
  const pool = live.slice();
  const out: Unit[] = [];
  if (first && pool.includes(first)) out.push(...pool.splice(pool.indexOf(first), 1));
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/** A unit's heaviest ready ability, for a wind-up: its own most powerful hit. */
function heaviest(u: Unit): Ability | null {
  const all = u.kit.map((n) => u.ab(n)).filter((a): a is Ability => !!a && a.mult > 0 && a.profile !== 'support' && a.profile !== 'taunt');
  return all.length ? all.reduce((a, b) => (b.mult > a.mult ? b : a)) : null;
}

/** Where an action settled on `t` goes: at whoever covers it, while the cover stands. */
const through = (t?: Unit) => (t?.coveredBy?.alive() ? t.coveredBy : t);

/**
 * Settle a foe's next action and show it. A wind-up or a channel underway carries on; otherwise a
 * creature may take one of its behaviours (a drink, a shield, a rally, a mark), strike its marked
 * target, or attack, winding up or channelling the attack if it can. Mutates.
 */
function foresee(u: Unit, enemy: Unit[], r: Rand, log: Ev[], ahead: number) {
  const show = (i: Intent) => { u.intent = i; log.push({ t: 'intent', u: u.uid, ...i }); };
  const live = enemy.filter((x) => x.alive());
  if (u.wind) {
    const t = through(live.find((x) => x.uid === u.wind!.at));
    if (u.wind.at && !t) u.wind.at = live[Math.floor(r() * live.length)]?.uid;
    else if (t) u.wind.at = t.uid;
    return show({ ab: u.wind.ab, at: u.wind.at, mult: u.wind.mult, wind: u.wind.left, pips: u.wind.pips, max: u.wind.max });
  }
  if (u.does('secondwind') && !u.drank && u.hp < u.maxHp * TRICK.secondwind.below) return show({ ab: TRICKS.secondwind.name, kind: 'drink' });
  const kin = u.kin.filter((k) => k !== u && k.alive());
  if (u.does('shield') && kin.length && r() < TRICK.shield.chance) {
    const ward = kin.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    return show({ ab: 'Shield', kind: 'shield', at: ward.uid });
  }
  if (u.does('rally') && !u.kin.some((k) => k.alive() && k.status.Emboldened) && r() < TRICK.rally.chance) return show({ ab: 'Rally', kind: 'rally' });
  if (u.does('mark') && live.length) {
    const q = u.quarry?.alive() ? through(u.quarry) : undefined;
    const hit = heaviest(u) ?? STRIKE;
    if (q) return show({ ab: hit.name, at: q.uid, mult: TRICK.mark.mult });
    if (r() < TRICK.mark.chance) return show({ ab: 'Mark', kind: 'mark', at: through(live[Math.floor(r() * live.length)])!.uid });
  }
  const a = choose(u, r, ahead);
  const aimed = a.profile !== 'support' && a.profile !== 'all' && live.length > 0;
  // Picking off goes for the one with the least HP; everyone else draws a target.
  let t = !aimed ? undefined : u.does('pickoff') ? live.reduce((x, y) => (y.hp < x.hp ? y : x)) : live[Math.floor(r() * live.length)];
  t = through(t);
  const heavy = heaviest(u);
  if (u.does('windup') && heavy && a.name === heavy.name && r() < TRICK.windup.chance) {
    const max = byGrade(TRICK.windup.pips, u.grade);
    u.wind = { ab: a.name, at: t?.uid, left: TRICK.windup.ahead, pips: max, max, mult: TRICK.windup.mult };
    return show({ ab: a.name, at: t?.uid, mult: u.wind.mult, wind: u.wind.left, pips: max, max });
  }
  if (u.does('channel') && a.mult > 0 && r() < TRICK.channel.chance) {
    const max = byGrade(TRICK.channel.pips, u.grade);
    u.wind = { ab: a.name, at: t?.uid, left: 1, pips: max, max, mult: TRICK.channel.mult };
    return show({ ab: a.name, at: t?.uid, mult: u.wind.mult, wind: 1, pips: max, max });
  }
  show({ ab: a.name, at: t?.uid });
}

/** The ability a foe settled on, if it can still use it. */
function intended(u: Unit): Ability | null {
  if (!u.intent || u.intent.kind) return null;
  const a = u.intent.ab === STRIKE.name ? STRIKE : u.ab(u.intent.ab);
  // A wind-up or a channel waits on no cooldown: it was settled ready.
  if (!a || (u.cd[a.name] && !u.intent.wind)) return null;
  return u.intent.mult ? { ...a, mult: a.mult * u.intent.mult } : a;
}

/** The hunter's order, if it names something they can use right now. */
function ordered(u: Unit, o: Order): Ability | null {
  if (o.use === STRIKE.name) return STRIKE;
  if (!u.kit.includes(o.use) || u.cd[o.use]) return null;
  return u.ab(o.use) ?? null;
}

/** The standing orders, as the map between fights offers them, and as one Shadow's own. */
export const TACTICS: { key: Tactic; name: string; desc: string }[] = [
  { key: 'default', name: 'As They See Fit', desc: 'Your Shadows pick their own targets, and so does Auto.' },
  { key: 'finish', name: 'Finish The Weakest', desc: 'Your Shadows go for the foe nearest to falling, and so does Auto.' },
  { key: 'protect', name: 'Protect The Hunter', desc: 'Your Shadows go for what is about to hit you, then what last hit you, then what hits hardest. So does Auto.' },
  { key: 'spread', name: 'Spread The Pain', desc: 'Your Shadows aim their bleeds, curses and stuns at foes not already carrying them. So does Auto.' },
];

const threat = (f: Unit) => Math.max(f.atk(false), f.atk(true));

/**
 * Where standing orders point a Shadow, and the hunter when nobody gives their turn an order (Auto,
 * the projection). The Association's hunters pick their own targets. Undefined leaves it to chance.
 */
function aim(u: Unit, a: Ability, foes: Unit[], tactic: Tactic, hero?: Unit): Unit | undefined {
  if (u.side !== 'p' || u.tag === 'ally') return undefined;
  const live = foes.filter((f) => f.alive());
  if (!live.length) return undefined;
  // Whatever the orders, a foe winding up or channelling comes first: the one nearest to breaking.
  const winding = live.filter((f) => f.wind);
  if (winding.length) return winding.reduce((x, y) => (y.wind!.pips < x.wind!.pips ? y : x));
  if (tactic === 'default') return undefined;
  if (tactic === 'finish') return live.reduce((x, y) => (y.hp < x.hp ? y : x));
  if (tactic === 'protect') {
    // Whatever is about to hit the hunter, then whatever last did, then whatever hits hardest.
    const coming = live.filter((f) => hero && f.intent?.at === hero.uid);
    if (coming.length) return coming.reduce((x, y) => (threat(y) > threat(x) ? y : x));
    const last = hero?.hitBy;
    return last && last.alive() && live.includes(last) ? last : live.reduce((x, y) => (threat(y) > threat(x) ? y : x));
  }
  // Spread: the healthiest foe not already carrying what this ability inflicts.
  const bare = live.filter((f) => a.inflicts.some((st) => STATUS[st] && !f.status[st] && !f.imm.includes(st)));
  return bare.length ? bare.reduce((x, y) => (y.hp > x.hp ? y : x)) : undefined;
}

/** What a turn can do beyond its unit: the party's standing orders, its hunter, and potions left. */
interface Ctx { tactic: Tactic; hero?: Unit; potions: number; throws: Partial<Record<ThrowId, number>> }

function survive(t: Unit, log: Ev[]) {
  if (t.hp <= 0 && t.does('undying') && !t.spent.has('undying')) {
    // Undying: it stands at 1 HP, and rises at the round's end.
    t.spent.add('undying');
    t.hp = 1;
    t.rising = true;
    log.push({ t: 'passive', u: t.uid, p: TRICKS.undying.name, k: 'stand', hp: 1 });
    return;
  }
  if (t.hp <= 0 && t.boon('unbroken') && !t.spent.has('unbroken')) {
    // Unbreakable: the hunter stands at 1 HP once, and recovers.
    t.spent.add('unbroken');
    t.hp = 1 + Math.round(t.maxHp * t.bv('unbroken'));
    log.push({ t: 'passive', u: t.uid, p: BOON_NAME('unbroken'), k: 'stand', hp: Math.round(t.hp) });
    return;
  }
  if (t.hp > 0 || !t.has('survival') || t.spent.has('stand')) return;
  t.spent.add('stand');
  t.hp = 1;
  log.push({ t: 'passive', u: t.uid, p: t.named('survival'), k: 'stand', hp: 1 });
}

/** A creature that enrages, wounded past its mark, enrages. Mutates. */
function enrage(t: Unit, log: Ev[]) {
  if (!t.does('enrage') || t.status.Enraged || !t.alive() || t.hp >= t.maxHp * TRICK.enrage.below) return;
  t.rage = byGrade(TRICK.enrage.atk, t.grade);
  t.status.Enraged = STATUS.Enraged.turns;
  log.push({ t: 'status', v: t.uid, s: 'Enraged' });
}

/** A hit landed on a creature winding up or channelling takes a pip off; the last breaks it. Mutates. */
function chip(t: Unit, log: Ev[], by?: Unit) {
  if (!t.wind || !t.alive()) return;
  // Siegebreaker: the hunter's hits take more off.
  t.wind.pips = Math.max(0, t.wind.pips - 1 - (by && engraved(by, 'giantkin') ? ENGRAVE.siege : 0));
  log.push({ t: 'pip', v: t.uid, left: t.wind.pips });
  if (t.wind.pips > 0) return;
  t.wind = undefined;
  t.status.Stunned = STATUS.Stunned.turns;
  t.status.Broken = STATUS.Broken.turns;
  log.push({ t: 'break', v: t.uid });
  log.push({ t: 'status', v: t.uid, s: 'Stunned' });
  log.push({ t: 'status', v: t.uid, s: 'Broken' });
}

/** A creature's behaviour, as it showed it. Mutates. */
function trick(u: Unit, foes: Unit[], friends: Unit[], log: Ev[]) {
  const i = u.intent!;
  if (i.kind === 'drink') {
    u.drank = true;
    const was = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * TRICK.secondwind.heal);
    log.push({ t: 'trick', a: u.uid, k: 'drink' });
    log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp), ab: TRICKS.secondwind.name });
  } else if (i.kind === 'shield') {
    const ward = friends.find((f) => f.uid === i.at && f.alive());
    if (ward) { ward.shieldOf = u; ward.status.Shielded = STATUS.Shielded.turns; }
    log.push({ t: 'trick', a: u.uid, k: 'shield', v: ward?.uid });
  } else if (i.kind === 'rally') {
    for (const f of friends) if (f.alive()) { f.status.Emboldened = STATUS.Emboldened.turns; f.bold = byGrade(TRICK.rally.atk, u.grade); }
    log.push({ t: 'trick', a: u.uid, k: 'rally' });
  } else if (i.kind === 'mark') {
    const t = foes.find((f) => f.uid === i.at && f.alive());
    if (t) { u.quarry = t; t.status.Marked = STATUS.Marked.turns; }
    log.push({ t: 'trick', a: u.uid, k: 'mark', v: t?.uid });
    if (t) log.push({ t: 'status', v: t.uid, s: 'Marked' });
  }
}

const BOON_NAME = (id: string) => boonById(id)?.name ?? id;

/** Whether a unit carries an engraving, and the engraving's name for the log. */
const engraved = (u: Unit, id: EngravingId) => u.has(engraveStyle(id));
const ENGRAVE_NAME = (id: EngravingId) => engravingById(id)?.name ?? id;
/** The unit's Shadows on its side, standing. */
const shadowsOf = (u: Unit) => (u.kin ?? []).filter((f) => f !== u && f.tag === 'shadow' && f.alive());

/** What an engraving adds when a status lands from `u` on `t`: Hellbrand curses what it burns. Mutates. */
function branded(u: Unit, t: Unit, st: string, turns: number, log: Ev[]) {
  if (st !== 'Burning' || t === u || !engraved(u, 'demon') || !t.alive() || t.imm.includes('Cursed')) return;
  t.status.Cursed = Math.max(t.status.Cursed ?? 0, turns);
  log.push({ t: 'status', v: t.uid, s: 'Cursed' });
}

/** The turns past its own a debuff `u` inflicts lasts: Lingering Curse's and Lingering Dark's, and Deep Cuts' on a wound. */
function longer(u: Unit, st: string): number {
  const s = STATUS[st];
  if (!s || s.skip || s.good) return 0;
  return (u.has('affliction') ? EDGE.affliction : 0) + u.bv('linger') + (st === 'Bleeding' || st === 'Poisoned' ? u.bv('deep') : 0);
}

/**
 * A status a blessing inflicts: it lands unless the target is immune, for `turns` and what makes the
 * unit's debuffs last longer, and never shortens one already there. A first stagger is braced. Mutates.
 */
function inflict(u: Unit, t: Unit, st: string, turns: number, log: Ev[]) {
  if (!t.alive() || !STATUS[st] || t.imm.includes(st)) return;
  if (st === 'Staggered' && t.has('brace') && !t.spent.has('brace')) {
    t.spent.add('brace');
    log.push({ t: 'passive', u: t.uid, p: t.named('brace'), k: 'brace' });
    return;
  }
  t.status[st] = Math.max(t.status[st] ?? 0, turns + longer(u, st));
  log.push({ t: 'status', v: t.uid, s: st });
  branded(u, t, st, t.status[st], log);
}

/** A blessing's heal: a share of the unit's maximum HP, said under the blessing's name. Mutates. */
function mend(u: Unit, share: number, id: string, log: Ev[]) {
  if (!u.alive() || share <= 0 || u.hp >= u.maxHp) return;
  const was = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + u.maxHp * share);
  log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp), ab: BOON_NAME(id) });
}

/** `u` defeats `t`: it goes down, and what defeating a foe brings comes. `foes` are `u`'s. Mutates. */
function downed(u: Unit, t: Unit, foes: Unit[], log: Ev[], onKill: (killer: Unit, victim: Unit) => void) {
  log.push({ t: 'down', v: t.uid });
  if (u.has('momentum') && u.mom < EDGE.momentum.max) u.mom += 1;
  onKill(u, t);
  // Warcry rallies the hunter's Shadows; Engulf mends them.
  if (engraved(u, 'orc')) for (const f of shadowsOf(u)) inflict(u, f, 'Rallied', ENGRAVE.warcry, log);
  if (engraved(u, 'slime')) for (const f of shadowsOf(u)) mend(f, ENGRAVE.engulf, ENGRAVE_NAME('slime'), log);
  if (!u.boon('feast') && !u.boon('rush') && !u.boon('after') && !u.boon('gale') && !u.boon('contagion') && !u.boon('gaze')) return;
  const live = foes.filter((f) => f.alive() && f !== t);
  mend(u, u.bv('feast'), 'feast', log);
  if (u.boon('rush')) u.rush = true;
  if (u.boon('after') && u.alive()) inflict(u, u, 'Veiled', u.bv('after'), log);
  if (u.boon('gale')) {
    let moved = false;
    for (const k of Object.keys(u.cd)) { moved = true; u.cd[k] -= u.bv('gale'); if (u.cd[k] <= 0) delete u.cd[k]; }
    if (moved) log.push({ t: 'passive', u: u.uid, p: BOON_NAME('gale'), k: 'flurry' });
  }
  const most = live.length ? live.reduce((x, y) => (y.hp > x.hp ? y : x)) : undefined;
  if (u.boon('contagion') && most) {
    // Contagion: what the foe carried passes on; a stun and a break stay with the fallen.
    for (const st of Object.keys(t.status)) if (STATUS[st] && !STATUS[st].good && !STATUS[st].skip && st !== 'Broken') inflict(u, most, st, u.bv('contagion'), log);
  }
  if (u.boon('gaze') && t.status.Marked && most) {
    inflict(u, most, 'Marked', u.bv('gaze'), log);
    u.gaze = most.uid;
  }
}

/**
 * Damage a blessing deals outside an ability's own hits: a counter, a splash, a curse's burn. It needs no
 * roll and is never critical; it can break a wind-up and defeat. `foes` are `u`'s. Mutates.
 */
function extra(u: Unit, t: Unit, dmg: number, id: string, foes: Unit[], log: Ev[], onKill: (killer: Unit, victim: Unit) => void) {
  if (!u.alive() || !t.alive() || dmg <= 0) return;
  t.hp -= dmg;
  t.hitBy = u;
  t.hurtBy.add(u);
  survive(t, log);
  enrage(t, log);
  chip(t, log, u);
  log.push({ t: 'hit', a: u.uid, v: t.uid, ab: BOON_NAME(id), dmg, crit: false, hp: Math.max(0, Math.round(t.hp)) });
  if (!t.alive()) downed(u, t, foes, log, onKill);
}

/** One hit of a Strike at a share of its strength, from `u` on `t`, for a counter or a splash: the middle of its swing. */
const strikeOf = (u: Unit, t: Unit, share: number, magic = false) => blow(u, t, { ...STRIKE, mult: share, type: magic ? 'magic' : 'physical' }, 0.5, false, undefined, true);

function act(u: Unit, foes: Unit[], friends: Unit[], r: Rand, log: Ev[], onKill: (killer: Unit, victim: Unit) => void, o: Order | null, ctx: Ctx) {
  if (u.status.Guarded) {
    delete u.status.Guarded;
    log.push({ t: 'expire', v: u.uid, s: 'Guarded' });
  }
  // A cover holds until the one covering acts again, and so does a guardian's shield.
  for (const f of friends) {
    if (f.coveredBy === u) f.coveredBy = undefined;
    if (f.shieldOf === u) { f.shieldOf = undefined; if (f.status.Shielded) { delete f.status.Shielded; log.push({ t: 'expire', v: f.uid, s: 'Shielded' }); } }
  }
  if (u.status.Stunned) {
    // A stun costs the next action, whenever in the round it landed, and whatever it was gathering.
    delete u.status.Stunned;
    u.wind = undefined;
    log.push({ t: 'stun', a: u.uid });
    return;
  }
  if (u.side === 'e' && u.intent?.kind) {
    trick(u, foes, friends, log);
    if (u.does('aloft')) { u.status.Veiled = TRICK.aloft.turns; log.push({ t: 'status', v: u.uid, s: 'Veiled' }); }
    return;
  }
  // A wind-up gathering: the action is spent on it, and it is one action nearer.
  if (u.side === 'e' && u.wind && u.wind.left > 1) {
    u.wind.left -= 1;
    log.push({ t: 'charge', a: u.uid, ab: u.wind.ab, left: u.wind.left });
    return;
  }
  if (o?.use === 'Guard') {
    u.status.Guarded = STATUS.Guarded.turns;
    log.push({ t: 'guard', a: u.uid });
    // Shield Wall mends every ally; Forewarned marks whatever is coming at the hunter.
    if (u.boon('wall')) for (const f of friends) if (f !== u) mend(f, u.bv('wall'), 'wall', log);
    if (u.boon('forewarn')) for (const f of foes) if (f.alive() && f.intent?.at === u.uid) inflict(u, f, 'Marked', u.bv('forewarn'), log);
    // Pack Hide weakens what is coming; Bulwark Core guards the Shadows too.
    if (engraved(u, 'beast')) for (const f of foes) if (f.alive() && f.intent?.at === u.uid) inflict(u, f, 'Weakened', ENGRAVE.pack, log);
    if (engraved(u, 'construct')) for (const f of shadowsOf(u)) { f.status.Guarded = STATUS.Guarded.turns; log.push({ t: 'status', v: f.uid, s: 'Guarded' }); }
    return;
  }
  const ward = o?.use === COVER ? friends.find((f) => f.uid === o.at && f !== u && f.alive()) : undefined;
  if (o?.use === COVER && ward) {
    // Every foe's next action aimed at the ally turns on the one covering, shown before it comes, and so
    // does every action settled on the ally until the cover's next turn. The one covering guards.
    u.status.Guarded = STATUS.Guarded.turns;
    ward.coveredBy = u;
    let n = 0;
    for (const f of foes) {
      if (!f.alive() || f.intent?.at !== ward.uid) continue;
      f.intent = { ...f.intent, at: u.uid };
      if (f.wind) f.wind.at = u.uid;
      if (f.quarry === ward) f.quarry = u;
      log.push({ t: 'intent', u: f.uid, ...f.intent });
      n++;
    }
    log.push({ t: 'cover', a: u.uid, v: ward.uid, n });
    mend(ward, u.bv('warden'), 'warden', log);
    if (engraved(u, 'chimera')) inflict(u, ward, 'Veiled', ENGRAVE.shift, log);
    return;
  }
  const thrown = o ? thrownBy(o.use) : undefined;
  if (thrown && (ctx.throws[thrown.id] ?? 0) > 0) {
    ctx.throws[thrown.id] = (ctx.throws[thrown.id] ?? 0) - 1;
    const first = foes.find((f) => f.uid === o!.at && f.alive());
    const hit = targets({ ...STRIKE, profile: thrown.reach > 1 ? 'volley' : 'single' }, foes, r, first);
    log.push({ t: 'throw', a: u.uid, item: thrown.id, v: hit.map((t) => t.uid) });
    for (const t of hit) {
      if (t.imm.includes(thrown.status)) continue;
      // Ritual Flask: what is thrown lasts longer.
      t.status[thrown.status] = STATUS[thrown.status].turns + u.bv('ritual');
      log.push({ t: 'status', v: t.uid, s: thrown.status });
      branded(u, t, thrown.status, t.status[thrown.status], log);
    }
    // Flask Thrower: what is thrown lands as a hit too.
    if (engraved(u, 'humanoid')) for (const t of hit) extra(u, t, strikeOf(u, t, ENGRAVE.flask), ENGRAVE_NAME('humanoid'), foes, log, onKill);
    return;
  }
  if (o?.use === 'Potion' && ctx.potions > 0) {
    ctx.potions -= 1;
    const was = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * POTION_HEAL);
    log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp) });
    // Tidewater: the potion washes the debuffs off, and veils.
    if (engraved(u, 'aquatic')) {
      for (const st of Object.keys(u.status)) if (STATUS[st] && !STATUS[st].good && !STATUS[st].skip) { delete u.status[st]; log.push({ t: 'expire', v: u.uid, s: st }); }
      inflict(u, u, 'Veiled', ENGRAVE.tide, log);
    }
    return;
  }
  const a = (o && ordered(u, o)) ?? intended(u) ?? choose(u, r);
  if (a.cd) u.cd[a.name] = a.cd;
  if (a.profile === 'support') {
    // A heal, a status for the side, or, with neither, a rally.
    const grant = a.grant ?? (a.heal ? null : 'Rallied');
    if (grant) for (const f of friends) if (f.alive()) f.status[grant] = STATUS[grant]?.turns ?? 2;
    log.push({ t: 'support', a: u.uid, ab: a.name, s: grant === 'Rallied' ? undefined : grant });
    if (a.heal) {
      for (const f of friends) {
        if (!f.alive() || f.hp >= f.maxHp) continue;
        const was = f.hp;
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * a.heal);
        log.push({ t: 'heal', a: f.uid, amt: Math.round(f.hp - was), hp: Math.round(f.hp), ab: a.name });
      }
    }
    return;
  }
  if (a.profile === 'taunt') {
    // Every foe's next action, shown, turns on the one who taunted: the intent it shows is still what it
    // does. The taunter guards until its next turn.
    u.status.Guarded = STATUS.Guarded.turns;
    let n = 0;
    for (const f of foes) {
      // Only what is aimed at the taunter's side turns: a shield on a creature's ally stays where it is.
      if (!f.alive() || !f.intent?.at || f.intent.at === u.uid || !friends.some((x) => x.uid === f.intent!.at)) continue;
      f.intent = { ...f.intent, at: u.uid };
      if (f.wind) f.wind.at = u.uid;
      if (f.quarry) f.quarry = u;
      log.push({ t: 'intent', u: f.uid, ...f.intent });
      n++;
    }
    log.push({ t: 'cast', a: u.uid, ab: a.name, k: 'taunt', n });
    return;
  }
  const magic = a.type === 'magic';
  const meant = u.intent?.ab === a.name ? u.intent.at : undefined;
  const at = o?.at ?? meant;
  const first = at ? foes.find((f) => f.uid === at && f.alive()) : aim(u, a, foes, ctx.tactic, ctx.hero);
  if (a.mult === 0) {
    // A curse: no damage and no roll; what it inflicts lands on every target unless it is immune.
    log.push({ t: 'cast', a: u.uid, ab: a.name, k: 'curse' });
    for (const t of targets(a, foes, r, first)) {
      for (const st of a.inflicts) {
        if (!STATUS[st] || t.imm.includes(st)) continue;
        t.status[st] = STATUS[st].turns + longer(u, st);
        log.push({ t: 'status', v: t.uid, s: st });
      }
      // Evil Eye marks what the curse reaches; Hexfire burns it.
      if (u.boon('eye')) inflict(u, t, 'Marked', u.bv('eye'), log);
      if (u.boon('hexfire')) extra(u, t, strikeOf(u, t, u.bv('hexfire'), true), 'hexfire', foes, log, onKill);
    }
    return;
  }
  let drawn = 0;
  let sipped = 0;
  let quick = false;
  // Twin Fangs strikes twice: the same targets again, each hit lighter.
  const { a: one, times } = struck(u, a);
  const aimedAt = targets(a, foes, r, first);
  let landed: Unit | undefined;
  let last = 0;
  for (let k = 0; k < times; k++) for (const t of aimedAt) {
    // Put down by a foe's spikes partway through, it does no more.
    if (!u.alive()) break;
    if (!t.alive()) continue;
    const aim = u.acc() + (u.has('targeting') && t.status.Marked ? 10 : 0);
    if (r() * 100 > hitChance(aim, t.eva())) {
      log.push({ t: 'miss', a: u.uid, v: t.uid, ab: a.name });
      // Riposte: a miss on the hunter is answered.
      if (t.boon('riposte')) extra(t, u, strikeOf(t, u, t.bv('riposte')), 'riposte', friends, log, onKill);
      continue;
    }
    const swing = r();
    let crit = r() * 100 < critOf(u, t);
    if (u.has('ambush') && !u.spent.has('ambush')) {
      u.spent.add('ambush');
      if (!crit) log.push({ t: 'passive', u: u.uid, p: u.named('ambush'), k: 'ambush' });
      crit = true;
    }
    const marked = !!t.status.Marked;
    let dmg = blow(u, t, one, swing, crit);
    // What waited for this hit is spent on it.
    u.rush = false;
    u.grudge = 0;
    if (u.boon('quick')) u.spent.add('quick');
    if (u.gaze === t.uid) u.gaze = undefined;
    if (u.boon('cuts')) u.cuts += 1;
    const fresh = !t.spent.has(`first:${u.uid}`);
    t.spent.add(`first:${u.uid}`);
    if (t.boon('iron')) t.ironUsed = true;
    if (t.does('hardened')) t.hardUsed = true;
    if (crit && u.has('flurry')) quick = true;
    if (magic && t.has('arcane') && !t.spent.has('ward')) {
      t.spent.add('ward');
      const half = Math.max(1, Math.round(dmg / 2));
      log.push({ t: 'passive', u: t.uid, p: t.named('arcane'), k: 'ward' });
      dmg = half;
    }
    // Carapace: the first hit the hunter takes in a fight deals nothing.
    if (engraved(t, 'insectoid') && !t.spent.has('carapace') && dmg > 0) {
      t.spent.add('carapace');
      log.push({ t: 'passive', u: t.uid, p: ENGRAVE_NAME('insectoid'), k: 'ward' });
      dmg = 0;
    }
    const was = t.alive();
    // Red Harvest: a Bleeding foe this hit leaves below its mark goes down with it.
    if (u.boon('harvest') && t.status.Bleeding && t.hp - dmg > 0 && t.hp - dmg < t.maxHp * u.bv('harvest')) dmg = Math.ceil(t.hp);
    const took = Math.min(dmg, Math.max(0, t.hp));
    t.hp -= dmg;
    t.hitBy = u;
    t.hurtBy.add(u);
    landed ??= t;
    last = dmg;
    survive(t, log);
    enrage(t, log);
    chip(t, log, u);
    if (u.does('bloodlust') && u.lust < TRICK.bloodlust.max) u.lust += 1;
    if (u.has('escalation') && u.esc < 2) u.esc += 1;
    if (u.has('vamp')) drawn += took * EDGE.vamp;
    if (magic) sipped += took * u.bv('siphon');
    log.push({ t: 'hit', a: u.uid, v: t.uid, ab: a.name, dmg, crit, hp: Math.max(0, Math.round(t.hp)) });
    // Spikes: the one who landed it takes a share back, and can fall to it.
    if ((t.has('thorns') || t.does('backlash')) && was) {
      const back = Math.max(1, Math.round(dmg * (t.has('thorns') ? EDGE.thorns : TRICK.backlash.back)));
      u.hp -= back;
      log.push({ t: 'tick', v: u.uid, s: t.has('thorns') ? t.named('thorns') : TRICKS.backlash.name, dmg: back, hp: Math.max(0, Math.round(u.hp)) });
      survive(u, log);
      if (!u.alive()) { log.push({ t: 'down', v: u.uid }); onKill(t, u); }
    }
    // What the hunter's blessings do to a foe that lands a hit on them, or on an ally.
    if (was && t.boons !== NONE) answer(u, t, dmg, friends, log, onKill);
    // Overwatch: the hunter answers a hit on an ally, once a round.
    const watch = foes.find((f) => f !== t && f.alive() && f.boon('overwatch') && !f.spent.has('watch'));
    if (watch && was && u.alive()) {
      watch.spent.add('watch');
      extra(watch, u, strikeOf(watch, u, watch.bv('overwatch')), 'overwatch', friends, log, onKill);
    }
    if (was && !t.alive()) {
      downed(u, t, foes, log, onKill);
      continue;
    }
    for (const st of a.inflicts) {
      if (!STATUS[st] || r() * 100 >= statusLands(u, t, st)) continue;
      if (st === 'Staggered' && t.has('brace') && !t.spent.has('brace')) {
        t.spent.add('brace');
        log.push({ t: 'passive', u: t.uid, p: t.named('brace'), k: 'brace' });
        continue;
      }
      t.status[st] = STATUS[st].turns + longer(u, st) + (u.does('virulent') && !STATUS[st].skip ? TRICK.virulent.turns : 0);
      log.push({ t: 'status', v: t.uid, s: st });
      branded(u, t, st, t.status[st], log);
    }
    // What the hunter's engravings leave on a foe they hit: Withering Strike weakens, Overcharge chills.
    if (a.name === STRIKE.name && engraved(u, 'undead')) inflict(u, t, 'Weakened', ENGRAVE.wither, log);
    if (crit && engraved(u, 'elemental')) inflict(u, t, 'Chilled', ENGRAVE.overcharge, log);
    // What the hunter's blessings leave on a foe they hit.
    if (u.boons !== NONE) {
      if (a.name === STRIKE.name && u.boon('rend')) inflict(u, t, 'Bleeding', u.bv('rend'), log);
      if (a.name !== STRIKE.name && u.boon('sunder')) inflict(u, t, 'Staggered', u.bv('sunder'), log);
      if (crit && u.boon('vein')) inflict(u, t, 'Bleeding', u.bv('vein'), log);
      if (magic && u.boon('kindle')) inflict(u, t, 'Burning', u.bv('kindle'), log);
      if (marked && u.boon('head')) inflict(u, t, 'Bleeding', u.bv('head'), log);
      if (fresh && u.boon('spotter')) inflict(u, t, 'Marked', u.bv('spotter'), log);
      if (crit && u.boon('expose')) inflict(u, t, 'Marked', u.bv('expose'), log);
    }
  }
  if (a.name === STRIKE.name && landed && u.alive()) {
    // Wide Swing carries the Strike on to another foe; Spellblade follows it with magic.
    if (u.boon('sweep')) {
      const rest = foes.filter((f) => f.alive() && !aimedAt.includes(f));
      const next = rest.length ? rest.reduce((x, y) => (y.hp < x.hp ? y : x)) : undefined;
      if (next) extra(u, next, Math.max(1, Math.round(last * u.bv('sweep'))), 'sweep', foes, log, onKill);
    }
    if (u.boon('spell') && landed.alive()) extra(u, landed, strikeOf(u, landed, u.bv('spell'), true), 'spell', foes, log, onKill);
  }
  // What a wind-up, a channel or a marked strike gathered is spent with the action.
  if (u.side === 'e') {
    if (u.wind) u.wind = undefined;
    if (u.intent?.mult && u.quarry) u.quarry = undefined;
    if (u.does('aloft') && u.alive()) { u.status.Veiled = TRICK.aloft.turns; log.push({ t: 'status', v: u.uid, s: 'Veiled' }); }
  }
  // Bloodthirst: what the action drew comes back at once, as one heal.
  const heal = Math.min(Math.round(drawn), Math.round(u.maxHp - u.hp));
  if (heal > 0 && u.alive()) {
    u.hp += heal;
    log.push({ t: 'passive', u: u.uid, p: u.named('vamp'), k: 'vamp', amt: heal, hp: Math.round(u.hp) });
  }
  // Siphon: so does what its magic drew.
  const sip = Math.min(Math.round(sipped), Math.round(u.maxHp - u.hp));
  if (sip > 0 && u.alive()) {
    u.hp += sip;
    log.push({ t: 'passive', u: u.uid, p: BOON_NAME('siphon'), k: 'vamp', amt: sip, hp: Math.round(u.hp) });
  }
  // Flurry: a critical hit takes a turn off every other skill's cooldown, once an action.
  if (quick) {
    let moved = false;
    for (const k of Object.keys(u.cd)) {
      if (k === a.name) continue;
      moved = true;
      if (--u.cd[k] <= 0) delete u.cd[k];
    }
    if (moved) log.push({ t: 'passive', u: u.uid, p: u.named('flurry'), k: 'flurry' });
  }
}

/** The hunter's blessings, answering a foe `u` that has just hit them (`t`) for `dmg`. Mutates. */
function answer(u: Unit, t: Unit, dmg: number, friends: Unit[], log: Ev[], onKill: (killer: Unit, victim: Unit) => void) {
  if (!u.alive()) return;
  if (t.boon('grudge')) t.grudge = Math.min(GRUDGE_MAX, t.grudge + 1);
  if (t.boon('thornward')) inflict(t, u, 'Cursed', t.bv('thornward'), log);
  if (t.boon('vigil')) inflict(t, u, 'Marked', t.bv('vigil'), log);
  if (t.boon('rebuke')) extra(t, u, Math.max(1, Math.round(dmg * t.bv('rebuke'))), 'rebuke', friends, log, onKill);
  if (t.status.Guarded && t.boon('brutal')) extra(t, u, strikeOf(t, u, t.bv('brutal')), 'brutal', friends, log, onKill);
}

function endOfRound(u: Unit, log: Ev[], onKill: (killer: Unit | null, victim: Unit) => void) {
  if (u.esc) u.esc -= 1;
  u.hardUsed = false;
  u.ironUsed = false;
  u.spent.delete('watch');
  // Undying rises; regrowth heals.
  const heal = (share: number, ab: string) => {
    const was = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * share);
    if (u.hp > was) log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp), ab });
  };
  if (u.rising && u.alive()) { u.rising = false; heal(TRICK.undying.heal, TRICKS.undying.name); }
  if (u.does('regrowth') && u.alive()) heal(byGrade(TRICK.regrowth.heal, u.grade), TRICKS.regrowth.name);
  if (u.boon('breath') && u.alive()) heal(u.bv('breath'), BOON_NAME('breath'));
  // Overgrowth: the hunter's Shadows mend at the round's end.
  if (u.tag === 'shadow' && u.alive() && (u.kin ?? []).some((k) => k.alive() && engraved(k, 'plant'))) heal(ENGRAVE.overgrowth, ENGRAVE_NAME('plant'));
  // The hunter's blessings reach the foes they fight: Doom on the Cursed, Black Sun on every debuff.
  const h = u.against;
  if (h && u.alive()) {
    const share = (u.status.Cursed ? h.bv('doom') : 0) + h.bv('sun') * debuffs(u);
    if (share > 0) {
      const d = Math.max(1, Math.round(u.maxHp * share));
      u.hp -= d;
      log.push({ t: 'tick', v: u.uid, s: BOON_NAME(u.status.Cursed && h.boon('doom') ? 'doom' : 'sun'), dmg: d, hp: Math.max(0, Math.round(u.hp)) });
      survive(u, log);
      enrage(u, log);
      if (!u.alive()) { log.push({ t: 'down', v: u.uid }); onKill(null, u); }
    }
  }
  for (const st of Object.keys(u.status)) {
    if (STATUS[st]?.skip) continue;
    // Hemorrhage: a foe's wounds and burns run deeper.
    const dot = (STATUS[st]?.dot ?? 0) * (h && (st === 'Bleeding' || st === 'Burning') ? 1 + h.bv('hemo') : 1);
    if (dot && u.alive()) {
      const d = Math.max(1, Math.round(u.maxHp * dot));
      u.hp -= d;
      log.push({ t: 'tick', v: u.uid, s: st, dmg: d, hp: Math.max(0, Math.round(u.hp)) });
      survive(u, log);
      enrage(u, log);
      if (!u.alive()) { log.push({ t: 'down', v: u.uid }); onKill(null, u); }
    }
    u.status[st] -= 1;
    if (u.status[st] <= 0) {
      delete u.status[st];
      if (u.alive()) log.push({ t: 'expire', v: u.uid, s: st });
    }
  }
  for (const k of Object.keys(u.cd)) if (--u.cd[k] <= 0) delete u.cd[k];
}

function hazard(u: Unit, foes: Unit[], r: Rand, log: Ev[]) {
  if (!u.alive() || !u.has('hazard')) return;
  const live = foes.filter((f) => f.alive());
  if (!live.length) return;
  const t = live[Math.floor(r() * live.length)];
  const st = u.kit.map((n) => u.ab(n)).flatMap((a) => a?.inflicts ?? []).find((s) => STATUS[s]?.dot) ?? 'Poisoned';
  if (r() * 100 >= statusLands(u, t, st)) return;
  t.status[st] = Math.max(t.status[st] ?? 0, 1);
  log.push({ t: 'passive', u: u.uid, p: u.named('hazard'), k: 'hazard' });
  log.push({ t: 'status', v: t.uid, s: st });
}

function openSide(side: Unit[], log: Ev[]) {
  for (const u of side) { u.kin = side; u.esc = 0; u.mom = 0; u.spent = new Set(); u.aura = { ini: 0, acc: 0 }; u.rush = false; u.grudge = 0; u.cuts = 0; u.gaze = undefined; u.ironUsed = false; }
  // Unseen: the hunter starts the fight Veiled.
  for (const u of side) if (u.alive() && engraved(u, 'aberration')) inflict(u, u, 'Veiled', ENGRAVE.unseen, log);
  // Bannerman: the side starts the fight Rallied.
  const banner = side.find((u) => u.alive() && u.boon('banner'));
  if (banner) for (const f of side) inflict(banner, f, 'Rallied', banner.bv('banner'), log);
  for (const u of side) {
    if (!u.alive() || !u.has('leadership')) continue;
    for (const f of side) { f.aura.ini += 5; f.aura.acc += 5; }
    log.push({ t: 'passive', u: u.uid, p: u.named('leadership'), k: 'aura' });
  }
}

export interface FightResult { won: boolean; rounds: number; log: Ev[] }

/** A foe's next action as the hunter's turn sees it: what it is, when it comes, and what it would do. */
export interface Threat {
  uid: string;
  ab: string;
  at?: string;
  /** Its place among the foes' next actions, from 1. */
  order: number;
  /** It comes before the hunter's next turn: the rest of this round, or the next round ahead of the hunter. */
  soon: boolean;
  /** How many times the foe acts each round. Only the next is shown. */
  times: number;
  /** One hit on the unit aimed at, as things stand. Null for a move that does no damage, or no target. */
  hit: Reckoning | null;
  /** Aimed at the hunter: the same hit, taken guarding. Aimed at an ally: the same hit on the hunter, guarding, if they covered it. */
  guarded: Reckoning | null;
  /** A behaviour instead of an attack, as the intent shows it. */
  kind?: Intent['kind'];
  /** A wind-up or a channel: actions until it lands, and its break pips left of `max`. */
  wind?: number;
  pips?: number;
  max?: number;
}

/** The hunter's turn, as `battle` hands it out: what they can use, and who is left to aim at. */
export interface Turn {
  uid: string;
  skills: { ability: Ability; cd: number }[];
  foes: string[];
  potions: number;
  /** What the hunter can throw, by kind. */
  throws: Partial<Record<ThrowId, number>>;
  /** The allies the hunter can cover. */
  allies: string[];
  /** Every foe's next action, in the order they come. */
  threats: Threat[];
  /** One hit of each action that does damage, by its name, on each foe left, by uid. */
  aims: Record<string, Record<string, Reckoning>>;
}

export interface BattleOpts {
  /** The unit whose turns wait for an order. Unset, nobody waits and the auto policy plays everyone. */
  hero?: string;
  /** Standing orders for that unit's allies. */
  tactic?: Tactic;
  /** Health Potions the waiting unit carries. */
  potions?: number;
  /** What the waiting unit can throw, by kind. */
  throws?: Partial<Record<ThrowId, number>>;
}

/**
 * Fight until one side is down, pausing on `opts.hero`'s turns. Each pause
 * yields a `Turn` and takes back an `Order`, or null to let the auto policy
 * choose. `actions` is how many times each foe acts per round (it stands in
 * for bodies the chamber does not show). Events are written to `log` as they
 * happen, so a caller can show the fight up to the pause.
 */
export function* battle(
  party: Unit[], foes: Unit[], r: Rand, actions: number,
  onKill: (killer: Unit | null, victim: Unit) => void = () => {}, log: Ev[] = [], opts: BattleOpts = {},
): Generator<Turn, FightResult, Order | null | undefined> {
  openSide(party, log);
  openSide(foes, log);
  // The hunter's blessings reach the foes they fight.
  const hunter = party.find((u) => u.boons !== NONE);
  for (const f of foes) f.against = hunter;
  const ctx: Ctx = { tactic: opts.tactic ?? 'default', hero: party.find((u) => u.uid === opts.hero), potions: opts.potions ?? 0, throws: { ...(opts.throws ?? {}) } };
  for (const u of foes) if (u.alive()) foresee(u, party, r, log, 0);
  let round = 0;
  const any = (xs: Unit[]) => xs.some((x) => x.alive());
  while (round < ROUND_CAP && any(party) && any(foes)) {
    round++;
    log.push({ t: 'round', n: round });
    // Quickdraw: in the first round, the hunter acts first.
    const first = (u: Unit) => (round === 1 && u.boon('quick') ? 1 : 0);
    const order = [...party, ...foes].sort((a, b) => first(b) - first(a) || b.ini() - a.ini());
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      if (!u.alive()) continue;
      const enemy = u.side === 'p' ? foes : party;
      const own = u.side === 'p' ? party : foes;
      const reps = u.side === 'e' ? actions : 1;
      for (let k = 0; k < reps && any(enemy); k++) {
        // A stunned hunter has no turn to give, so nothing waits for one.
        const wait = u.uid === opts.hero && !u.status.Stunned;
        const o = wait ? (yield turnOf(u, enemy, own, ctx.potions, order.slice(i + 1), actions, ctx.throws)) ?? null : null;
        act(u, enemy, own, r, log, onKill, o, ctx);
        // A foe settles its next action at once. If that action is next round, a cooldown tick comes first.
        if (u.side === 'e' && u.alive() && any(enemy)) foresee(u, enemy, r, log, k < reps - 1 ? 0 : 1);
      }
    }
    for (const u of [...party, ...foes]) if (u.alive()) endOfRound(u, log, onKill);
    for (const u of foes) hazard(u, party, r, log);
    for (const u of party) hazard(u, foes, r, log);
  }
  // A stalemate is not a win.
  return { won: any(party) && !any(foes), rounds: round, log };
}

/**
 * The turn handed to the hunter `u`. `after` is everyone still to act this round, `actions` how often
 * each foe acts in a round. Reads the units and never a roll, so asking for it changes nothing.
 */
function turnOf(u: Unit, foes: Unit[], own: Unit[], potions: number, after: Unit[] = [], actions = 1, throws: Partial<Record<ThrowId, number>> = {}): Turn {
  const skills = u.kit.map((n) => u.ab(n)).filter((a): a is Ability => !!a).map((a) => ({ ability: a, cd: u.cd[a.name] ?? 0 }));
  const live = foes.filter((f) => f.alive());
  // The foes' next actions in the order they come: the rest of this round as it was drawn up, then the
  // next round's, by initiative as it stands now. Those ahead of the hunter in it come before their next turn.
  const now = after.filter((x) => x.side !== u.side && x.alive());
  const next = [...own, ...live].filter((x) => x.alive()).sort((a, b) => b.ini() - a.ini());
  const mine = next.indexOf(u);
  const seq = [...now, ...next.filter((x) => x.side !== u.side && !now.includes(x))];
  const threats = seq.filter((f) => f.intent).map((f, k): Threat => {
    const { ab, at, kind, wind, pips, max } = f.intent!;
    const a = intended(f);
    const t = at ? own.find((p) => p.uid === at && p.alive()) : undefined;
    // The hunter's own Guard comes down as their turn starts, so a hit on them is reckoned unguarded, then guarded.
    const hit = a && t ? reckon(f, t, a, t === u ? false : undefined) : null;
    return {
      uid: f.uid, ab, at, kind, wind, pips: wind ? f.wind?.pips ?? pips : undefined, max, order: k + 1,
      // A wind-up still gathering lands after its next action, never before the hunter's next turn.
      soon: (now.includes(f) || next.indexOf(f) < mine) && !(wind && wind > 1), times: actions, hit,
      // On an ally, what the hunter would take of it covering them.
      guarded: a && t ? reckon(f, u, a, true) : null,
    };
  });
  const aims: Turn['aims'] = {};
  for (const a of [STRIKE, ...skills.map((k) => k.ability)]) {
    for (const f of live) {
      const r = reckon(u, f, a);
      if (r) (aims[a.name] ??= {})[f.uid] = r;
    }
  }
  const allies = own.filter((x) => x !== u && x.alive()).map((x) => x.uid);
  return { uid: u.uid, skills, foes: live.map((f) => f.uid), potions, throws: { ...throws }, allies, threats, aims };
}

const KILL_RANK = { sure: 2, maybe: 1 } as const;

/**
 * The skills worth marking as finishers on `foe`: those that fell it more surely than a Strike would,
 * with how surely. A Strike is the baseline and is never marked, so when a Strike alone fells the foe
 * every time, nothing is: no skill is needed for it. A skill still cooling down is not offered.
 */
export function finishers(t: Turn, foe: string): Record<string, 'sure' | 'maybe'> {
  const rank = (r?: Reckoning) => (r?.kill ? KILL_RANK[r.kill] : 0);
  const base = rank(t.aims[STRIKE.name]?.[foe]);
  const out: Record<string, 'sure' | 'maybe'> = {};
  for (const k of t.skills) {
    const r = t.aims[k.ability.name]?.[foe];
    if (k.cd === 0 && r?.kill && rank(r) > base) out[k.ability.name] = r.kill;
  }
  return out;
}

/** Fight to the end with nobody waiting: the auto policy plays every side. */
export function fight(party: Unit[], foes: Unit[], r: Rand, actions: number, onKill: (killer: Unit | null, victim: Unit) => void = () => {}, tactic: Tactic = 'default'): FightResult {
  const g = battle(party, foes, r, actions, onKill, [], { tactic });
  let step = g.next();
  while (!step.done) step = g.next(null);
  return step.value;
}

/** Sum of attributes: the one "power" number shown anywhere. */
export const powerOf = (b: Attrs) => Math.round(b.STR + b.AGI + b.PER + b.VIT + b.INT);
