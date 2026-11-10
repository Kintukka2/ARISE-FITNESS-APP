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
import { EDGE, TREE_PASSIVES, TREE_SKILLS } from '@/data/tree';
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
const ALL_PASSIVES = [...PASSIVES, ...CLASS_PASSIVES, ...TREE_PASSIVES];
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
}

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
  intent?: { ab: string; at?: string };
  /** The ally covering this unit until that ally's next turn: what is aimed at this unit goes at them. */
  coveredBy?: Unit;

  constructor(sp: UnitSpec) {
    this.uid = sp.uid; this.name = sp.name; this.side = sp.side; this.base = sp.base;
    this.tag = sp.tag; this.ref = sp.ref;
    this.kit = sp.kit ?? [];
    this.own = new Map((sp.own ?? []).map((a) => [a.name, a]));
    this.names = sp.passives ?? [];
    this.styles = this.names.map((n) => passiveStyle(n) ?? '');
    this.imm = sp.imm ?? []; this.res = sp.res ?? [];
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
  /** An ability as this unit uses it: its own version if it has one. */
  ab(n: string) { return this.own.get(n) ?? ability(n); }
  named(style: string) { return this.names[this.styles.indexOf(style)] ?? style; }
  alive() { return this.hp > 0; }
  mod(key: 'pdef' | 'mdef' | 'eva' | 'ini' | 'acc' | 'atk') {
    let m = 1;
    for (const k of Object.keys(this.status)) m *= STATUS[k]?.[key] ?? 1;
    return m;
  }
  atk(magic: boolean) { return ((magic ? this.d.mpow : this.d.patk + this.esc * 4)) * this.mod('atk') * this.atkMult * (1 + this.mom * EDGE.momentum.step); }
  def(magic: boolean) {
    const pack = this.has('pack') ? Math.min(2, this.kin.filter((k) => k !== this && k.alive() && k.has('pack')).length) * 5 : 0;
    return magic ? (this.d.resist + pack) * this.mod('mdef') : (this.d.defense + pack) * this.mod('pdef');
  }
  tempo() { return this.has('tempo') && !this.status.Rooted ? 10 : 0; }
  ini() { return (this.d.initiative + this.aura.ini + this.tempo()) * this.mod('ini'); }
  acc() { return (this.d.accuracy + this.aura.acc) * this.mod('acc'); }
  eva() { return (this.d.evasion + this.tempo()) * this.mod('eva'); }
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
  | { t: 'guard'; a: string }
  /** Cover: `a` covers `v`; `n` counts the foes it turned. */
  | { t: 'cover'; a: string; v: string; n: number }
  /** A throw from the bag: what, and on whom. What it inflicts follows as `status` events. */
  | { t: 'throw'; a: string; item: string; v: string[] }
  | { t: 'intent'; u: string; ab: string; at?: string }
  /** `ab`: the support that healed; unset is a Health Potion. */
  | { t: 'heal'; a: string; amt: number; hp: number; ab?: string }
  | { t: 'passive'; u: string; p: string; k: string; hp?: number; amt?: number };

const hitChance = (acc: number, eva: number) => clamp((100 * acc) / (acc + eva), HIT.min, HIT.max);

/**
 * One hit's damage, rounded, before a ward: `swing` is where it falls in the swing, 0 to 1, and
 * `crit` whether it is critical. The fight passes its rolls; the reckoning passes the ends of the range.
 */
function blow(u: Unit, t: Unit, a: Ability, swing: number, crit: boolean, guarded = !!t.status.Guarded): number {
  const magic = a.type === 'magic';
  const power = u.atk(magic);
  let dmg = Math.max(1, ((power * a.mult * power) / (power + t.def(magic))) * (1 - SWING + swing * 2 * SWING));
  if (crit) dmg *= u.has('deadeye') && t.status.Marked ? EDGE.deadeye : CRIT.mult;
  if (u.has('execute') && t.hp < t.maxHp * EDGE.execute.below) dmg *= EDGE.execute.mult;
  if (u.has('exploit') && Object.keys(t.status).some((k) => STATUS[k] && !STATUS[k].good)) dmg *= EDGE.exploit;
  if (t.has('stalwart') && t.hp > t.maxHp * EDGE.stalwart.above) dmg *= EDGE.stalwart.mult;
  if (guarded) dmg *= GUARD;
  return Math.round(dmg);
}

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
  // Ambush makes the first hit of the fight critical, whatever the roll.
  const sure = u.has('ambush') && !u.spent.has('ambush');
  const crit = sure ? 100 : Math.round(Math.min(100, u.d.crit));
  const ward = (n: number) => (magic && t.has('arcane') && !t.spent.has('ward') ? Math.max(1, Math.round(n / 2)) : n);
  const lo = ward(blow(u, t, a, 0, sure, guarded));
  const hi = ward(blow(u, t, a, 1, sure, guarded));
  const critHi = ward(blow(u, t, a, 1, true, guarded));
  // A unit that stands at 1 HP once is not felled by the hit that would have felled it.
  const stands = t.has('survival') && !t.spent.has('stand');
  const kill = stands ? null : lo >= t.hp ? 'sure' : (crit > 0 ? critHi : hi) >= t.hp ? 'maybe' : null;
  return { chance, crit, lo, hi, critHi, kill };
}

function statusLands(src: Unit, t: Unit, st: string) {
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

/** Settle a foe's next action and show it. Mutates. */
function foresee(u: Unit, enemy: Unit[], r: Rand, log: Ev[], ahead: number) {
  const a = choose(u, r, ahead);
  const live = enemy.filter((x) => x.alive());
  const aimed = a.profile !== 'support' && a.profile !== 'all' && live.length > 0;
  let at = aimed ? live[Math.floor(r() * live.length)] : undefined;
  // A unit covered goes unhit while its cover stands: the action settled on it goes at the one covering.
  if (at?.coveredBy?.alive()) at = at.coveredBy;
  u.intent = { ab: a.name, at: at?.uid };
  log.push({ t: 'intent', u: u.uid, ab: u.intent.ab, at: u.intent.at });
}

/** The ability a foe settled on, if it can still use it. */
function intended(u: Unit): Ability | null {
  if (!u.intent) return null;
  if (u.intent.ab === STRIKE.name) return STRIKE;
  const a = u.ab(u.intent.ab);
  return a && !u.cd[a.name] ? a : null;
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
  if (u.side !== 'p' || u.tag === 'ally' || tactic === 'default') return undefined;
  const live = foes.filter((f) => f.alive());
  if (!live.length) return undefined;
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
  if (t.hp > 0 || !t.has('survival') || t.spent.has('stand')) return;
  t.spent.add('stand');
  t.hp = 1;
  log.push({ t: 'passive', u: t.uid, p: t.named('survival'), k: 'stand', hp: 1 });
}

function act(u: Unit, foes: Unit[], friends: Unit[], r: Rand, log: Ev[], onKill: (killer: Unit, victim: Unit) => void, o: Order | null, ctx: Ctx) {
  if (u.status.Guarded) {
    delete u.status.Guarded;
    log.push({ t: 'expire', v: u.uid, s: 'Guarded' });
  }
  // A cover holds until the one covering acts again.
  for (const f of friends) if (f.coveredBy === u) f.coveredBy = undefined;
  if (u.status.Stunned) {
    // A stun costs the next action, whenever in the round it landed.
    delete u.status.Stunned;
    log.push({ t: 'stun', a: u.uid });
    return;
  }
  if (o?.use === 'Guard') {
    u.status.Guarded = STATUS.Guarded.turns;
    log.push({ t: 'guard', a: u.uid });
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
      f.intent = { ab: f.intent.ab, at: u.uid };
      log.push({ t: 'intent', u: f.uid, ab: f.intent.ab, at: u.uid });
      n++;
    }
    log.push({ t: 'cover', a: u.uid, v: ward.uid, n });
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
      t.status[thrown.status] = STATUS[thrown.status].turns;
      log.push({ t: 'status', v: t.uid, s: thrown.status });
    }
    return;
  }
  if (o?.use === 'Potion' && ctx.potions > 0) {
    ctx.potions -= 1;
    const was = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * POTION_HEAL);
    log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp) });
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
      if (!f.alive() || !f.intent?.at || f.intent.at === u.uid) continue;
      f.intent = { ab: f.intent.ab, at: u.uid };
      log.push({ t: 'intent', u: f.uid, ab: f.intent.ab, at: u.uid });
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
        t.status[st] = STATUS[st].turns + (u.has('affliction') && !STATUS[st].skip && !STATUS[st].good ? EDGE.affliction : 0);
        log.push({ t: 'status', v: t.uid, s: st });
      }
    }
    return;
  }
  let drawn = 0;
  let quick = false;
  for (const t of targets(a, foes, r, first)) {
    // Put down by a foe's spikes partway through, it does no more.
    if (!u.alive()) break;
    const aim = u.acc() + (u.has('targeting') && t.status.Marked ? 10 : 0);
    if (r() * 100 > hitChance(aim, t.eva())) {
      log.push({ t: 'miss', a: u.uid, v: t.uid, ab: a.name });
      continue;
    }
    const swing = r();
    let crit = r() * 100 < u.d.crit;
    if (u.has('ambush') && !u.spent.has('ambush')) {
      u.spent.add('ambush');
      if (!crit) log.push({ t: 'passive', u: u.uid, p: u.named('ambush'), k: 'ambush' });
      crit = true;
    }
    let dmg = blow(u, t, a, swing, crit);
    if (crit && u.has('flurry')) quick = true;
    if (magic && t.has('arcane') && !t.spent.has('ward')) {
      t.spent.add('ward');
      const half = Math.max(1, Math.round(dmg / 2));
      log.push({ t: 'passive', u: t.uid, p: t.named('arcane'), k: 'ward' });
      dmg = half;
    }
    const was = t.alive();
    const took = Math.min(dmg, Math.max(0, t.hp));
    t.hp -= dmg;
    t.hitBy = u;
    t.hurtBy.add(u);
    survive(t, log);
    if (u.has('escalation') && u.esc < 2) u.esc += 1;
    if (u.has('vamp')) drawn += took * EDGE.vamp;
    log.push({ t: 'hit', a: u.uid, v: t.uid, ab: a.name, dmg, crit, hp: Math.max(0, Math.round(t.hp)) });
    // Spikes: the one who landed it takes a share back, and can fall to it.
    if (t.has('thorns') && was) {
      const back = Math.max(1, Math.round(dmg * EDGE.thorns));
      u.hp -= back;
      log.push({ t: 'tick', v: u.uid, s: t.named('thorns'), dmg: back, hp: Math.max(0, Math.round(u.hp)) });
      survive(u, log);
      if (!u.alive()) { log.push({ t: 'down', v: u.uid }); onKill(t, u); }
    }
    if (was && !t.alive()) {
      log.push({ t: 'down', v: t.uid });
      if (u.has('momentum') && u.mom < EDGE.momentum.max) u.mom += 1;
      onKill(u, t);
      continue;
    }
    for (const st of a.inflicts) {
      if (!STATUS[st] || r() * 100 >= statusLands(u, t, st)) continue;
      if (st === 'Staggered' && t.has('brace') && !t.spent.has('brace')) {
        t.spent.add('brace');
        log.push({ t: 'passive', u: t.uid, p: t.named('brace'), k: 'brace' });
        continue;
      }
      t.status[st] = STATUS[st].turns + (u.has('affliction') && !STATUS[st].skip && !STATUS[st].good ? EDGE.affliction : 0);
      log.push({ t: 'status', v: t.uid, s: st });
    }
  }
  // Bloodthirst: what the action drew comes back at once, as one heal.
  const heal = Math.min(Math.round(drawn), Math.round(u.maxHp - u.hp));
  if (heal > 0 && u.alive()) {
    u.hp += heal;
    log.push({ t: 'passive', u: u.uid, p: u.named('vamp'), k: 'vamp', amt: heal, hp: Math.round(u.hp) });
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

function endOfRound(u: Unit, log: Ev[], onKill: (killer: Unit | null, victim: Unit) => void) {
  if (u.esc) u.esc -= 1;
  for (const st of Object.keys(u.status)) {
    if (STATUS[st]?.skip) continue;
    const dot = STATUS[st]?.dot;
    if (dot && u.alive()) {
      const d = Math.max(1, Math.round(u.maxHp * dot));
      u.hp -= d;
      log.push({ t: 'tick', v: u.uid, s: st, dmg: d, hp: Math.max(0, Math.round(u.hp)) });
      survive(u, log);
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
  for (const u of side) { u.kin = side; u.esc = 0; u.mom = 0; u.spent = new Set(); u.aura = { ini: 0, acc: 0 }; }
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
  const ctx: Ctx = { tactic: opts.tactic ?? 'default', hero: party.find((u) => u.uid === opts.hero), potions: opts.potions ?? 0, throws: { ...(opts.throws ?? {}) } };
  for (const u of foes) if (u.alive()) foresee(u, party, r, log, 0);
  let round = 0;
  const any = (xs: Unit[]) => xs.some((x) => x.alive());
  while (round < ROUND_CAP && any(party) && any(foes)) {
    round++;
    log.push({ t: 'round', n: round });
    const order = [...party, ...foes].sort((a, b) => b.ini() - a.ini());
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
    const { ab, at } = f.intent!;
    const a = intended(f);
    const t = at ? own.find((p) => p.uid === at && p.alive()) : undefined;
    // The hunter's own Guard comes down as their turn starts, so a hit on them is reckoned unguarded, then guarded.
    const hit = a && t ? reckon(f, t, a, t === u ? false : undefined) : null;
    return {
      uid: f.uid, ab, at, order: k + 1, soon: now.includes(f) || next.indexOf(f) < mine, times: actions, hit,
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
