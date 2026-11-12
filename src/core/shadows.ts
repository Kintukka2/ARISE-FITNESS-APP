/**
 * The Shadow army. A creature you felled can linger after a clear; reach for it with mana and it may
 * follow you home. A bound Shadow fights beside you and levels on every creature it helps fell, as far
 * as its rank's cap, where it takes no more XP. Promotion, claimed one rank at a time from its card,
 * costs Shadow Essence and wants bosses felled, and lifts the cap; the level stays where it was. Essence comes from a creature
 * extracted again when one like it already serves, and from a Shadow released. A Sworn Shadow
 * remembers a second ability.
 */
import { AWAKENING, ECHO, ECHO_COST, ESSENCE, GROWTH_PER_LEVEL, LEVEL_XP, SECOND_AT, SHADOW_RANKS, SHADOW_XP, SLOTS } from '@/data/shadows';
import { powerOf } from './combat';
import { ALL_ENEMIES, enemyById } from './gates';
import * as kin from './kin';
import { licensedRank } from './licence';
import { MISSIONS } from './missions';
import type { Attrs, Enemy, Rank, Save, Shadow } from './types';
import { STATS } from './types';
import { clamp, dayKey, uid } from './util';

export const EXTRACT_MP: Record<string, number> = { E: 50, D: 60, C: 70, B: 80, A: 90, S: 100 };
/** A lingering Shadow can be reached for this many times, until it holds; each reach costs `step` times the one before. */
export const EXTRACT_TRIES = { max: 3, step: 2 } as const;

export { AWAKENING, ECHO, ECHO_COST, ESSENCE, GROWTH_PER_LEVEL, LEVEL_XP, SECOND_AT, SHADOW_RANKS, SHADOW_XP, SLOTS };

// ------------------------------------------------------------------ levels

/** The highest level any Shadow reaches: the last rank's cap. */
export const MAX_LEVEL = SHADOW_RANKS[SHADOW_RANKS.length - 1].cap;
/** Experience from `level` to the one above it. */
export const xpToNext = (level: number) => LEVEL_XP.base + Math.floor(level * LEVEL_XP.step);
/** Experience a Shadow needs, all told, to stand at `level`. Level 1 needs none. */
export const xpAt = (level: number) => {
  let n = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) n += xpToNext(l);
  return n;
};
/** The level an amount of experience reaches, before any rank caps it. */
export function levelFor(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpAt(l + 1)) l++;
  return l;
}

/** The rank a Shadow holds, by index. */
export const rankIndex = (sh: Shadow) => Math.max(0, Math.min(SHADOW_RANKS.length - 1, sh.rank ?? 0));
export const rankOf = (sh: Shadow) => SHADOW_RANKS[rankIndex(sh)];
export const nextRank = (sh: Shadow) => SHADOW_RANKS[rankIndex(sh) + 1] ?? null;
/** The level a Shadow fights at: what its experience reaches, as far as its rank's cap. */
export const levelOf = (sh: Shadow) => Math.min(rankOf(sh).cap, levelFor(sh.xp ?? 0));
/** Its level stands at its rank's cap. */
export const atCap = (sh: Shadow) => levelOf(sh) >= rankOf(sh).cap;
/** XP into the level it holds, and what the next one needs. At the cap it needs nothing: it takes no more. */
export function progress(sh: Shadow): { into: number; need: number } {
  const l = levelOf(sh);
  if (atCap(sh)) return { into: 0, need: 0 };
  return { into: Math.max(0, (sh.xp ?? 0) - xpAt(l)), need: xpToNext(l) };
}
/** What a run's creatures pay a Shadow in XP, before its cap. */
export const xpFrom = (kills: number, bosses: number) => kills * SHADOW_XP.kill + bosses * (SHADOW_XP.boss - SHADOW_XP.kill);
/** XP a Shadow still has room for under its rank's cap. */
export const xpRoom = (sh: Shadow) => Math.max(0, xpAt(rankOf(sh).cap) - (sh.xp ?? 0));
/** Pay a Shadow XP, as far as its cap: what lies past it is not kept. Returns what it took. Mutates. */
export function earn(sh: Shadow, xp: number): number {
  const took = Math.max(0, Math.min(xp, xpRoom(sh)));
  sh.xp = (sh.xp ?? 0) + took;
  return took;
}

/** Every attribute's growth over its creature's own: GROWTH_PER_LEVEL for each level, and AWAKENING's for each star. */
export const growth = (sh: Shadow) => levelOf(sh) * GROWTH_PER_LEVEL + starsOf(sh) * AWAKENING.growth;
/** The most growth a Shadow reaches: the top level, every star. */
export const MAX_GROWTH = MAX_LEVEL * GROWTH_PER_LEVEL + AWAKENING.cost.length * AWAKENING.growth;

// ------------------------------------------------------------------ awakening

/** The stars a Shadow can be awakened to. */
export const MAX_STARS = AWAKENING.cost.length;
export const starsOf = (sh: Shadow) => Math.max(0, Math.min(MAX_STARS, sh.stars ?? 0));
/** Ascendant at its cap: the rank and level awakening asks for. */
export const atTop = (sh: Shadow) => rankIndex(sh) === SHADOW_RANKS.length - 1 && atCap(sh);
/** What the next star costs, or null once every star is held. */
export const awakenCost = (sh: Shadow) => AWAKENING.cost[starsOf(sh)] ?? null;
/** Ascendant at its cap, with a star still to take and the Essence it costs. */
export const canAwaken = (s: Save, sh: Shadow) => atTop(sh) && awakenCost(sh) !== null && (s.shadows.essence ?? 0) >= awakenCost(sh)!;
export const awakenable = (s: Save) => s.shadows.army.filter((sh) => canAwaken(s, sh));
/** Awaken a Shadow one star, spending the Essence it costs. Returns the stars before and after, or null. Mutates. */
export function awaken(s: Save, id: string): { id: string; from: number; to: number; essence: number } | null {
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh || !canAwaken(s, sh)) return null;
  const from = starsOf(sh);
  const cost = awakenCost(sh)!;
  s.shadows.essence = (s.shadows.essence ?? 0) - cost;
  sh.stars = from + 1;
  return { id, from, to: from + 1, essence: cost };
}
/** A Shadow waiting on the hunter: a promotion or a star it can take now. */
export const waiting = (s: Save, sh: Shadow) => canPromote(s, sh) || canAwaken(s, sh);
export const waitingAll = (s: Save) => s.shadows.army.filter((sh) => waiting(s, sh));
/** Every star the Essence left after promotions pays for, the deployed Shadows first: what a hunter who keeps up does. Mutates. */
export function awakenAll(s: Save) {
  const out = squad(s);
  const order = s.shadows.army.slice().sort((a, b) => Number(out.includes(b)) - Number(out.includes(a)) || starsOf(a) - starsOf(b));
  for (let more = true; more;) {
    more = false;
    for (const sh of order) if (awaken(s, sh.id)) more = true;
  }
}

// ------------------------------------------------------------------ promotion

export interface Requirement { key: 'level' | 'essence' | 'bosses'; label: string; have: number; need: number; met: boolean }
/** What the rank above asks: its current cap reached, the Essence it costs, the bosses it wants felled. Empty at the top. */
export function requirements(s: Save, sh: Shadow): Requirement[] {
  const next = nextRank(sh);
  if (!next) return [];
  const need: Requirement[] = [{ key: 'level', label: 'Level', have: levelOf(sh), need: rankOf(sh).cap, met: atCap(sh) }];
  if (next.essence) need.push({ key: 'essence', label: 'Shadow Essence', have: s.shadows.essence ?? 0, need: next.essence, met: (s.shadows.essence ?? 0) >= next.essence });
  if (next.bosses) need.push({ key: 'bosses', label: 'Bosses defeated', have: sh.bosses, need: next.bosses, met: sh.bosses >= next.bosses });
  return need;
}
/** Everything the rank above asks is met. */
export const canPromote = (s: Save, sh: Shadow) => !!nextRank(sh) && requirements(s, sh).every((r) => r.met);
/** Every Shadow that can be promoted now. */
export const promotable = (s: Save) => s.shadows.army.filter((sh) => canPromote(s, sh));

export interface Promotion { id: string; from: number; to: number; second: string | null; essence: number }
/** Promote a Shadow one rank, spending the Essence it costs. Its level stays; its cap rises. Returns what changed, or null. Mutates. */
export function promote(s: Save, id: string): Promotion | null {
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh || !canPromote(s, sh)) return null;
  const from = rankIndex(sh);
  const cost = SHADOW_RANKS[from + 1].essence;
  s.shadows.essence = (s.shadows.essence ?? 0) - cost;
  // Nothing past the old cap carries into the new rank: it starts the next level from nothing.
  sh.xp = Math.min(sh.xp ?? 0, xpAt(SHADOW_RANKS[from].cap));
  sh.rank = from + 1;
  const e = enemyById(sh.enemyId);
  return { id, from, to: from + 1, second: from + 1 === SECOND_AT && e ? secondOf(e) : null, essence: cost };
}
/**
 * Every promotion the Essence pays for, the deployed Shadows first and the highest level before the
 * rest: what a hunter who keeps up does after every run. Mutates.
 */
export function promoteAll(s: Save) {
  const out = squad(s);
  const order = s.shadows.army.slice().sort((a, b) => Number(out.includes(b)) - Number(out.includes(a)) || levelOf(b) - levelOf(a));
  for (const sh of order) while (canPromote(s, sh)) promote(s, sh.id);
}

export interface Claimed { promoted: Promotion[]; awakened: { id: string; from: number; to: number; essence: number }[]; essence: number }

/**
 * Claim every Shadow waiting on the hunter, as the Army's Ready count offers: each promotion first, one
 * rank apiece, the deployed and the highest level before the rest; then one star apiece for each
 * awakening the Essence left pays for, the deployed first. What the Essence cannot pay for waits. Mutates.
 */
export function claimAll(s: Save): Claimed {
  const out = squad(s);
  const first = (a: Shadow, b: Shadow) => Number(out.includes(b)) - Number(out.includes(a));
  const had = s.shadows.essence ?? 0;
  const promoted: Promotion[] = [];
  for (const sh of s.shadows.army.slice().sort((a, b) => first(a, b) || levelOf(b) - levelOf(a))) {
    const p = promote(s, sh.id);
    if (p) promoted.push(p);
  }
  const awakened: Claimed['awakened'] = [];
  for (const sh of s.shadows.army.slice().sort((a, b) => first(a, b) || starsOf(a) - starsOf(b))) {
    if (promoted.some((p) => p.id === sh.id)) continue;
    const w = awaken(s, sh.id);
    if (w) awakened.push(w);
  }
  return { promoted, awakened, essence: had - (s.shadows.essence ?? 0) };
}

/** Set a Shadow at a rank and its cap, as the balance tools' hunters are. Mutates. */
export function raise(sh: Shadow, rank: number) {
  sh.rank = Math.max(0, Math.min(SHADOW_RANKS.length - 1, rank));
  sh.xp = xpAt(SHADOW_RANKS[sh.rank].cap);
  return sh;
}

// ------------------------------------------------------------------ essence

/** The Essence a creature already in the army gives when it is extracted again. */
export const essenceOf = (e: Pick<Enemy, 'rank'>, boss: boolean) => (ESSENCE[e.rank as Rank] ?? 1) * (boss ? 2 : 1);
/** What a Shadow's ranks and stars cost in Essence, all told. */
export const spentOn = (sh: Shadow) => SHADOW_RANKS.slice(1, rankIndex(sh) + 1).reduce((n, r) => n + r.essence, 0)
  + AWAKENING.cost.slice(0, starsOf(sh)).reduce((n, c) => n + c, 0);
/** What releasing a Shadow returns: its creature's Essence, and half of what its ranks and stars cost. */
export const releaseValue = (sh: Shadow) => {
  const e = enemyById(sh.enemyId);
  return (e ? essenceOf(e, false) : 1) + Math.floor(spentOn(sh) / 2);
};
/** A Shadow walking an open run: it cannot be released until the run is over. */
export const inRun = (s: Save, id: string) => !!s.gates.raid?.squad.includes(id);
/** Release a Shadow from the army for its Essence. Returns the Essence it gave, or null. Mutates. */
export function release(s: Save, id: string): number | null {
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh || inRun(s, id)) return null;
  const got = releaseValue(sh);
  s.shadows.army = s.shadows.army.filter((x) => x.id !== id);
  s.shadows.squad = s.shadows.squad.filter((x) => x !== id);
  s.shadows.fresh = s.shadows.fresh.filter((x) => x !== id);
  s.shadows.essence = (s.shadows.essence ?? 0) + got;
  return got;
}

/** The longest name a Shadow can be given. */
export const NAME_MAX = 16;
/** What a Shadow goes by: the name bestowed on it, or what it was. */
export const nameOf = (sh: Shadow) => sh.name || enemyById(sh.enemyId)?.shadow || 'Shadow';
/** A name as it is kept: trimmed, single-spaced, letters, digits, spaces, apostrophes and hyphens only, and no longer than NAME_MAX. */
export const cleanName = (raw: string) => raw.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
/** Bestow a name on a Shadow, or take it away with an empty one. Returns the name kept. Mutates. */
export function rename(s: Save, id: string, raw: string): string | null {
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return null;
  const name = cleanName(raw);
  if (name) sh.name = name;
  else delete sh.name;
  return name || null;
}

/** Shadow slots the Secret Missions have paid for, on top of the grade's. */
export const missionSlots = (s: Save) => MISSIONS.filter((m) => m.grant.slot && s.hunter.missions.includes(m.id)).reduce((n, m) => n + (m.grant.slot ?? 0), 0);

export const slots = (s: Save) => SLOTS[licensedRank(s)] + missionSlots(s);
export const squad = (s: Save) => s.shadows.squad.slice(0, slots(s)).map((id) => s.shadows.army.find((x) => x.id === id)).filter((x): x is Shadow => !!x);
export const freeSlots = (s: Save) => Math.max(0, Math.min(slots(s), s.shadows.army.length) - squad(s).length);
export const isBound = (s: Save, enemyId: string) => s.shadows.army.some((x) => x.enemyId === enemyId);

/**
 * A creature's second ability: the second in its own kit, or, for one that has
 * only one, the first ability of its kin it does not have, its family's first and
 * then, for a family that shares one ability, its role's.
 */
export function secondOf(e: Enemy): string | null {
  if (e.kit[1]) return e.kit[1];
  for (const kin of [(k: Enemy) => k.family === e.family, (k: Enemy) => k.role === e.role]) {
    for (const k of ALL_ENEMIES) if (kin(k) && k.id !== e.id) for (const a of k.kit) if (!e.kit.includes(a)) return a;
  }
  return null;
}

/** What a Shadow fights with: its creature's first ability, and from Sworn its second. */
export function kitOf(sh: Shadow): string[] {
  const e = enemyById(sh.enemyId)!;
  const second = rankIndex(sh) >= SECOND_AT ? secondOf(e) : null;
  return second ? [e.kit[0], second] : [e.kit[0]];
}

export function statsOf(sh: Shadow): Attrs {
  const e = enemyById(sh.enemyId)!;
  const k = 1 + growth(sh);
  return Object.fromEntries(STATS.map((st) => [st, Math.round(e.base[st] * k)])) as Attrs;
}

export function toggleDeploy(s: Save, id: string): boolean {
  const i = s.shadows.squad.indexOf(id);
  if (i >= 0) { s.shadows.squad.splice(i, 1); return false; }
  if (squad(s).length >= slots(s)) return false;
  s.shadows.squad = s.shadows.squad.filter((x) => s.shadows.army.some((a) => a.id === x));
  s.shadows.squad.push(id);
  return true;
}

/** What a Shadow's stats come to, as the screens and the squad's order read it. */
export const power = (sh: Shadow) => powerOf(statsOf(sh));

/** What the deployed Shadows' power comes to. */
export const squadPower = (s: Save) => squad(s).reduce((n, sh) => n + power(sh), 0);

/** The strongest first, and between two as strong the one bound first: an order that never wavers. */
const byPower = (a: Shadow, b: Shadow) => power(b) - power(a) || a.id.localeCompare(b.id);

/**
 * What Auto Deploy weighs a squad at: each Shadow's power, grown by what its Kin boon and the
 * Formation's auras are worth (`kin.worth`), and the hunter's own grown by the auras, which reach them too.
 */
export function squadScore(s: Save, squad: readonly Shadow[]): number {
  const make = kin.makeOf(squad);
  const aura = kin.worth(make.aura);
  return squad.reduce((n, sh) => n + power(sh) * (1 + aura + kin.worth(kin.kinBonusOf(sh, make))), 0) + powerOf(s.hunter.attrs) * aura;
}

/**
 * The squad Auto Deploy makes: the one it weighs highest (`squadScore`), strongest first. A whole squad is
 * weighed, not a Shadow alone, so a weaker Shadow earns its slot through its Kin or its role. It looks
 * among each family's strongest and each role's, starting from the strongest squad and from each family's
 * strongest together, and trades one Shadow at a time while a trade weighs more. The same army always
 * gives the same squad.
 */
export function bestSquad(s: Save): string[] {
  const n = slots(s);
  const army = s.shadows.army.filter((x) => enemyById(x.enemyId)).sort(byPower);
  if (army.length <= n) return army.map((x) => x.id);
  const fam = (sh: Shadow) => enemyById(sh.enemyId)!.family;
  const role = (sh: Shadow) => enemyById(sh.enemyId)!.role;
  // Each family's strongest, as many as the slots hold, and each role's strongest: no other is worth more.
  const pool: Shadow[] = [];
  const seen = new Map<string, number>();
  for (const sh of army) {
    const f = fam(sh);
    const r = `role:${role(sh)}`;
    const keep = (seen.get(f) ?? 0) < n || !seen.has(r);
    seen.set(f, (seen.get(f) ?? 0) + 1);
    seen.set(r, (seen.get(r) ?? 0) + 1);
    if (keep) pool.push(sh);
  }
  const fill = (from: Shadow[]) => {
    const out = from.slice(0, n);
    for (const sh of pool) if (out.length < n && !out.includes(sh)) out.push(sh);
    return out;
  };
  const families = [...new Set(pool.map(fam))].filter((f) => f !== kin.KIN_ALL);
  const wild = pool.filter((sh) => fam(sh) === kin.KIN_ALL);
  const starts = [fill([]), ...families.map((f) => fill([...wild, ...pool.filter((sh) => fam(sh) === f)].slice(0, Math.min(n, kin.KIN_AT[kin.KIN_AT.length - 1]))))];
  let best: Shadow[] = starts[0];
  let bestScore = squadScore(s, best);
  for (const start of starts) {
    let cur = start;
    let score = squadScore(s, cur);
    for (;;) {
      let trade: Shadow[] | null = null;
      let tradeScore = score;
      for (let i = 0; i < cur.length; i++) {
        for (const sh of pool) {
          if (cur.includes(sh)) continue;
          const next = cur.slice();
          next[i] = sh;
          const v = squadScore(s, next);
          if (v > tradeScore + 1e-9) { trade = next; tradeScore = v; }
        }
      }
      if (!trade) break;
      cur = trade;
      score = tradeScore;
    }
    if (score > bestScore + 1e-9) { best = cur; bestScore = score; }
  }
  return best.slice().sort(byPower).map((x) => x.id);
}

/** Deploy the squad Auto Deploy weighs highest (`bestSquad`). Returns the ids deployed. Mutates. */
export function autoDeploy(s: Save): string[] {
  s.shadows.squad = bestSquad(s);
  return s.shadows.squad;
}

/**
 * Put a Shadow in a place in the squad, as a drag drops it. Onto a deployed Shadow, the two change
 * places, or, from the reserve, it takes that place and the one there goes to the reserve. Onto a
 * free slot, it joins the squad at its end. At -1 it is taken out. False if nothing changed. Mutates.
 */
export function placeAt(s: Save, id: string, at: number): boolean {
  if (!s.shadows.army.some((x) => x.id === id)) return false;
  const sq = squad(s).map((x) => x.id);
  const from = sq.indexOf(id);
  const n = slots(s);
  if (at < 0) {
    if (from < 0) return false;
    sq.splice(from, 1);
  } else if (at >= n) {
    return false;
  } else if (at >= sq.length) {
    if (from === sq.length - 1) return false;
    if (from >= 0) sq.splice(from, 1);
    else if (sq.length >= n) return false;
    sq.push(id);
  } else if (from >= 0) {
    if (from === at) return false;
    [sq[from], sq[at]] = [sq[at], sq[from]];
  } else {
    sq[at] = id;
  }
  s.shadows.squad = sq;
  return true;
}

export function bind(s: Save, enemyId: string, day = dayKey()): Shadow {
  const sh: Shadow = { id: uid('sh'), enemyId, boundAt: day, out: 0, kills: 0, bosses: 0, rank: 0, xp: 0 };
  s.shadows.army.push(sh);
  s.shadows.fresh.push(sh.id);
  // Fill a free slot automatically: a bound Shadow that is not deployed does nothing.
  if (squad(s).length < slots(s)) s.shadows.squad.push(sh.id);
  return sh;
}

/** The odds a reach holds: `base`, and `perInt` more for each point of Intelligence, up to `max`. The Guide states them. */
export const HOLD = { base: 0.45, perInt: 0.004, max: 0.9 } as const;
export const holdChance = (s: Save) => clamp(HOLD.base + s.hunter.attrs.INT * HOLD.perInt, HOLD.base, HOLD.max);
/** Per-kill odds a felled creature lingers. The boss is far likelier to, and one already in the army ECHO times as likely. */
export const lingerChance = (s: Save, boss: boolean, owned = false) => Math.min(0.9, (boss ? 0.12 + s.hunter.attrs.INT * 0.0012 : 0.02 + s.hunter.attrs.INT * 0.0002) * (owned ? ECHO : 1));
