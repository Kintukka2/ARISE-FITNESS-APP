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
    crit: Math.min(50, 2 + a * 0.18 + p * 0.3),
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
  out.crit = Math.min(60, out.crit);
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
  // Two, so it outlives the end of the round it was raised in; the unit's next turn takes it down.
  Guarded: { turns: 2, good: true },
};

const pctOf = (x: number) => Math.round(Math.abs(1 - x) * 100);
/** What a status does, read from STATUS, name before value (docs/VOICE.md). */
export const STATUS_TEXT: Record<string, string> = Object.fromEntries(Object.entries(STATUS).map(([k, st]) => {
  const parts: string[] = [];
  if (st.dot) parts.push(`HP -${Math.round(st.dot * 100)}% a round`);
  if (st.pdef) parts.push(`Physical defence -${pctOf(st.pdef)}%`);
  if (st.mdef) parts.push(`Magical resistance -${pctOf(st.mdef)}%`);
  if (st.eva) parts.push(`Evasion -${pctOf(st.eva)}%`);
  if (st.acc) parts.push(`Accuracy ${st.acc > 1 ? '+' : '-'}${pctOf(st.acc)}%`);
  if (st.atk) parts.push(`Attack -${pctOf(st.atk)}%`);
  if (st.ini) parts.push(`Initiative ${st.ini > 1 ? '+' : '-'}${pctOf(st.ini)}%`);
  if (st.skip) parts.push('Next action lost');
  return [k, parts.join(' · ')];
}));

const REACH: Record<string, number> = { single: 1, cleave: 2, volley: 3, spread: 3, burst: 4, wild: 3, all: 99, support: 0 };
/** How many an ability reaches, by its profile. */
export const reachOf = (profile: string) => REACH[profile] ?? 1;
export const REACH_TEXT: Record<string, string> = {
  single: 'one target', cleave: 'two targets', volley: 'three targets', spread: 'three targets',
  burst: 'four targets', wild: 'three targets', all: 'every foe', support: 'the whole party',
};

const STRIKE: Ability = { name: 'Strike', type: 'physical', profile: 'single', mult: 1, cd: 0, inflicts: [] };
export { STRIKE };
/** What a guarding unit takes of every hit. */
export const GUARD = 0.5;
STATUS_TEXT.Guarded = `Damage taken -${(1 - GUARD) * 100}% until its next turn`;
/** A field potion restores this share of the drinker's maximum HP. */
export const FIELD_POTION_HEAL = 0.3;
const abilityMap = new Map<string, Ability>([...ABILITIES, ...CLASS_SKILLS].map((a) => [a.name, a]));
const passiveMap = new Map<string, string>([...PASSIVES, ...CLASS_PASSIVES].map((p) => [p.name, p.style]));
export const ability = (n: string) => abilityMap.get(n);
export const passiveStyle = (n: string) => passiveMap.get(n);
export const passiveText = (n: string) => [...PASSIVES, ...CLASS_PASSIVES].find((p) => p.name === n)?.text ?? '';

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
  passives?: string[];
  imm?: string[];
  res?: string[];
  bonus?: Record<string, number>;
  /** Multipliers applied after everything else (the hunter's own edge, encounter scaling). */
  hpMult?: number;
  atkMult?: number;
  tag?: 'hero' | 'ally' | 'shadow' | 'foe';
  ref?: string;
  /** Standing orders of its own, over the party's. */
  tactic?: Tactic;
}

export class Unit {
  uid: string; name: string; side: 'p' | 'e'; base: Attrs; d: Derived;
  maxHp: number; hp: number; kit: string[]; styles: string[]; names: string[];
  imm: string[]; res: string[]; status: Record<string, number> = {}; cd: Record<string, number> = {};
  esc = 0; aura = { ini: 0, acc: 0 }; spent = new Set<string>(); kin: Unit[] = [];
  atkMult: number; tag: UnitSpec['tag']; ref?: string; tactic?: Tactic;
  /** The last foe to land a hit on this unit, for allies told to protect it. */
  hitBy?: Unit;
  /** A foe's next action, settled in advance and shown: an ability, and the unit it goes at first. */
  intent?: { ab: string; at?: string };

  constructor(sp: UnitSpec) {
    this.uid = sp.uid; this.name = sp.name; this.side = sp.side; this.base = sp.base;
    this.tag = sp.tag; this.ref = sp.ref; this.tactic = sp.tactic;
    this.kit = sp.kit ?? [];
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
    if (this.has('bladework')) d.crit = Math.min(60, d.crit + 12);
    if (this.has('keen')) d.accuracy += 15;
    this.d = d;
    this.maxHp = Math.round(d.maxHp * (sp.hpMult ?? 1));
    this.hp = this.maxHp;
  }

  has(style: string) { return this.styles.includes(style); }
  named(style: string) { return this.names[this.styles.indexOf(style)] ?? style; }
  alive() { return this.hp > 0; }
  mod(key: 'pdef' | 'mdef' | 'eva' | 'ini' | 'acc' | 'atk') {
    let m = 1;
    for (const k of Object.keys(this.status)) m *= STATUS[k]?.[key] ?? 1;
    return m;
  }
  atk(magic: boolean) { return ((magic ? this.d.mpow : this.d.patk + this.esc * 4)) * this.mod('atk') * this.atkMult; }
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
  | { t: 'support'; a: string; ab: string }
  | { t: 'stun'; a: string }
  | { t: 'status'; v: string; s: string }
  | { t: 'tick'; v: string; s: string; dmg: number; hp: number }
  | { t: 'expire'; v: string; s: string }
  | { t: 'down'; v: string }
  | { t: 'guard'; a: string }
  | { t: 'intent'; u: string; ab: string; at?: string }
  | { t: 'heal'; a: string; amt: number; hp: number }
  | { t: 'passive'; u: string; p: string; k: string; hp?: number };

const hitChance = (acc: number, eva: number) => clamp((100 * acc) / (acc + eva), 5, 95);

function statusLands(src: Unit, t: Unit, st: string) {
  if (t.imm.includes(st)) return 0;
  let c = BASE_STATUS + src.d.statusChance - Math.round(t.d.resist / 5) - t.d.statusSave;
  if (t.res.includes(st)) c -= 15;
  return Math.max(5, c);
}

/** The auto policy's pick. `ahead` counts the cooldown ticks that will pass before the action happens. */
function choose(u: Unit, r: Rand, ahead = 0): Ability {
  const ready = u.kit.map(ability).filter((a): a is Ability => !!a && (u.cd[a.name] ?? 0) <= ahead);
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
  u.intent = { ab: a.name, at: aimed ? live[Math.floor(r() * live.length)].uid : undefined };
  log.push({ t: 'intent', u: u.uid, ab: u.intent.ab, at: u.intent.at });
}

/** The ability a foe settled on, if it can still use it. */
function intended(u: Unit): Ability | null {
  if (!u.intent) return null;
  if (u.intent.ab === STRIKE.name) return STRIKE;
  const a = ability(u.intent.ab);
  return a && !u.cd[a.name] ? a : null;
}

/** The hunter's order, if it names something they can use right now. */
function ordered(u: Unit, o: Order): Ability | null {
  if (o.use === STRIKE.name) return STRIKE;
  if (!u.kit.includes(o.use) || u.cd[o.use]) return null;
  return ability(o.use) ?? null;
}

/** The standing orders, as the brief offers them, and as one Shadow's own. */
export const TACTICS: { key: Tactic; name: string; desc: string; one: string }[] = [
  { key: 'default', name: 'As They See Fit', desc: 'Everyone picks their own targets.', one: 'It picks its own targets.' },
  { key: 'finish', name: 'Finish The Weakest', desc: 'Every ally and Shadow goes for the foe nearest to falling.', one: 'It goes for the foe nearest to falling.' },
  { key: 'protect', name: 'Protect The Hunter', desc: 'They go for what is about to hit you, then what last hit you, then what hits hardest.', one: 'It goes for what is about to hit you, then what last hit you, then what hits hardest.' },
  { key: 'spread', name: 'Spread The Pain', desc: 'They aim their bleeds, curses and stuns at foes not already carrying them.', one: 'It aims its bleeds, curses and stuns at foes not already carrying them.' },
];

const threat = (f: Unit) => Math.max(f.atk(false), f.atk(true));

/** Where standing orders point an ally or a Shadow. Undefined leaves it to chance. */
function aim(u: Unit, a: Ability, foes: Unit[], tactic: Tactic, hero?: Unit): Unit | undefined {
  if (u.side !== 'p' || u.tag === 'hero' || tactic === 'default') return undefined;
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
interface Ctx { tactic: Tactic; hero?: Unit; potions: number }

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
  if (o?.use === 'Potion' && ctx.potions > 0) {
    ctx.potions -= 1;
    const was = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * FIELD_POTION_HEAL);
    log.push({ t: 'heal', a: u.uid, amt: Math.round(u.hp - was), hp: Math.round(u.hp) });
    return;
  }
  const a = (o && ordered(u, o)) ?? intended(u) ?? choose(u, r);
  if (a.cd) u.cd[a.name] = a.cd;
  if (a.profile === 'support') {
    for (const f of friends) if (f.alive()) f.status.Rallied = STATUS.Rallied.turns;
    log.push({ t: 'support', a: u.uid, ab: a.name });
    return;
  }
  const magic = a.type === 'magic';
  const meant = u.intent?.ab === a.name ? u.intent.at : undefined;
  const at = o?.at ?? meant;
  const first = at ? foes.find((f) => f.uid === at && f.alive()) : aim(u, a, foes, u.tactic ?? ctx.tactic, ctx.hero);
  for (const t of targets(a, foes, r, first)) {
    const aim = u.acc() + (u.has('targeting') && t.status.Marked ? 10 : 0);
    if (r() * 100 > hitChance(aim, t.eva())) {
      log.push({ t: 'miss', a: u.uid, v: t.uid, ab: a.name });
      continue;
    }
    const power = u.atk(magic);
    let dmg = Math.max(1, ((power * a.mult * power) / (power + t.def(magic))) * (1 - SWING + r() * 2 * SWING));
    const crit = r() * 100 < u.d.crit;
    if (crit) dmg *= 1.5;
    if (t.status.Guarded) dmg *= GUARD;
    dmg = Math.round(dmg);
    if (magic && t.has('arcane') && !t.spent.has('ward')) {
      t.spent.add('ward');
      const half = Math.max(1, Math.round(dmg / 2));
      log.push({ t: 'passive', u: t.uid, p: t.named('arcane'), k: 'ward' });
      dmg = half;
    }
    const was = t.alive();
    t.hp -= dmg;
    t.hitBy = u;
    survive(t, log);
    if (u.has('escalation') && u.esc < 2) u.esc += 1;
    log.push({ t: 'hit', a: u.uid, v: t.uid, ab: a.name, dmg, crit, hp: Math.max(0, Math.round(t.hp)) });
    if (was && !t.alive()) {
      log.push({ t: 'down', v: t.uid });
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
      t.status[st] = STATUS[st].turns;
      log.push({ t: 'status', v: t.uid, s: st });
    }
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
  const st = u.kit.map(ability).flatMap((a) => a?.inflicts ?? []).find((s) => STATUS[s]?.dot) ?? 'Poisoned';
  if (r() * 100 >= statusLands(u, t, st)) return;
  t.status[st] = Math.max(t.status[st] ?? 0, 1);
  log.push({ t: 'passive', u: u.uid, p: u.named('hazard'), k: 'hazard' });
  log.push({ t: 'status', v: t.uid, s: st });
}

function openSide(side: Unit[], log: Ev[]) {
  for (const u of side) { u.kin = side; u.esc = 0; u.spent = new Set(); u.aura = { ini: 0, acc: 0 }; }
  for (const u of side) {
    if (!u.alive() || !u.has('leadership')) continue;
    for (const f of side) { f.aura.ini += 5; f.aura.acc += 5; }
    log.push({ t: 'passive', u: u.uid, p: u.named('leadership'), k: 'aura' });
  }
}

export interface FightResult { won: boolean; rounds: number; log: Ev[] }

/** The hunter's turn, as `battle` hands it out: what they can use, and who is left to aim at. */
export interface Turn {
  uid: string;
  skills: { ability: Ability; cd: number }[];
  foes: string[];
  potions: number;
}

export interface BattleOpts {
  /** The unit whose turns wait for an order. Unset, nobody waits and the auto policy plays everyone. */
  hero?: string;
  /** Standing orders for that unit's allies. */
  tactic?: Tactic;
  /** Field potions the waiting unit carries. */
  potions?: number;
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
  const ctx: Ctx = { tactic: opts.tactic ?? 'default', hero: party.find((u) => u.uid === opts.hero), potions: opts.potions ?? 0 };
  for (const u of foes) if (u.alive()) foresee(u, party, r, log, 0);
  let round = 0;
  const any = (xs: Unit[]) => xs.some((x) => x.alive());
  while (round < ROUND_CAP && any(party) && any(foes)) {
    round++;
    log.push({ t: 'round', n: round });
    const order = [...party, ...foes].sort((a, b) => b.ini() - a.ini());
    for (const u of order) {
      if (!u.alive()) continue;
      const enemy = u.side === 'p' ? foes : party;
      const own = u.side === 'p' ? party : foes;
      const reps = u.side === 'e' ? actions : 1;
      for (let k = 0; k < reps && any(enemy); k++) {
        // A stunned hunter has no turn to give, so nothing waits for one.
        const wait = u.uid === opts.hero && !u.status.Stunned;
        const o = wait ? (yield turnOf(u, enemy, ctx.potions)) ?? null : null;
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

function turnOf(u: Unit, foes: Unit[], potions: number): Turn {
  const skills = u.kit.map(ability).filter((a): a is Ability => !!a).map((a) => ({ ability: a, cd: u.cd[a.name] ?? 0 }));
  return { uid: u.uid, skills, foes: foes.filter((f) => f.alive()).map((f) => f.uid), potions };
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
