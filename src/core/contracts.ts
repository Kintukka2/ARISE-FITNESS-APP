/**
 * The System's contracts. Three a day, drawn for the hunter's grade and
 * written to the save the first time the day's are shown, so a level-up at
 * noon cannot redraw them. A finished run is counted against them in
 * `raid.finish`, and a contract pays the moment it is done. Nothing lapsing
 * at midnight costs anything.
 */
import {
  CLEAR_COUNT, CONTRACT_BONUS, CONTRACT_KINDS, CONTRACT_PAY, CONTRACTS_PER_DAY, FELL_COUNT, SHADOW_KILLS_PER,
  TIRED_GATES, TIRED_MAX, type ContractKind,
} from '@/data/contracts';
import { dungeonById, enemyById, opening, PRACTICE_GATE, rankIdx } from './gates';
import { licensedRank } from './licence';
import { build, mapSeed } from './map';
import { GATE_XP } from './progression';
import * as shadows from './shadows';
import * as shop from './shop';
import type { Contract, Dungeon, Rank, Save } from './types';
import { dayKey, rng, weighted } from './util';
import { drag, RAID_FATIGUE } from './vitals';

export type Contracts = Save['contracts'];

/** Contracts begin once the practice gate is behind the hunter. */
export const contractsOpen = (s: Save) => s.gates.cleared.includes(PRACTICE_GATE.id);

/** The family most of these gates' creatures belong to. */
function commonest(gates: Dungeon[]): string | null {
  const share: Record<string, number> = {};
  for (const d of gates) for (const id of d.mobs) {
    const f = enemyById(id)?.family;
    if (f) share[f] = (share[f] ?? 0) + 1 / d.mobs.length;
  }
  return Object.entries(share).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/**
 * A day's contracts for a grade, read off the gates that open the day at it.
 * Pure: the same day, grade and number of Shadows out draw the same contracts.
 */
export function draw(day: string, grade: Rank, shadowsOut: number): Contract[] {
  const r = rng(`arise|contracts|${day}|${grade}|${shadowsOut}`);
  const open = opening(grade, day);
  const family = commonest(open);
  const keepers = open.filter((d) => build(d, mapSeed(d, day)).layers.some((row) => row.some((x) => x.kind === 'elite')));
  const can: Record<ContractKind, boolean> = {
    clear: true, fell: !!family, offroad: true, gatekeeper: keepers.length > 0,
    shadows: shadowsOut > 0 && SHADOW_KILLS_PER[grade] > 0, tired: true,
  };
  const make = (kind: ContractKind): Contract => {
    const c: Contract = { kind, need: 1, got: 0, done: false };
    if (kind === 'clear') c.need = r() < CLEAR_COUNT.moreOdds ? CLEAR_COUNT.more : CLEAR_COUNT.base;
    if (kind === 'fell') Object.assign(c, { need: FELL_COUNT[grade], family, where: open.filter((d) => d.mobs.some((id) => enemyById(id)?.family === family)).map((d) => d.id) });
    if (kind === 'shadows') c.need = Math.ceil(SHADOW_KILLS_PER[grade] * shadowsOut);
    if (kind === 'tired') c.at = Math.min(TIRED_MAX, TIRED_GATES * (RAID_FATIGUE[grade] ?? 10));
    if (kind === 'gatekeeper') c.where = keepers.map((d) => d.id);
    return c;
  };
  const pool = CONTRACT_KINDS.filter((k) => can[k.kind]);
  const out: Contract[] = [];
  while (out.length < CONTRACTS_PER_DAY && pool.length) {
    const k = weighted(pool, r());
    pool.splice(pool.indexOf(k), 1);
    out.push(make(k.kind));
  }
  return out;
}

/** Today's contracts as they stand, writing nothing: what was issued, or what would be. */
export function today(s: Save, day = dayKey()): Contracts {
  if (s.contracts.day === day) return s.contracts;
  const grade = licensedRank(s);
  return { day, grade, list: draw(day, grade, shadows.squad(s).length), bonus: false, seen: false };
}

/** Write today's contracts to the save, if they are not there yet. Mutates. */
export function issue(s: Save, day = dayKey()): Contracts {
  if (contractsOpen(s) && s.contracts.day !== day) s.contracts = today(s, day);
  return s.contracts;
}

/** The Quests screen has shown today's contracts: issue them, and mark them seen. Mutates. */
export function show(s: Save, day = dayKey()) {
  if (!contractsOpen(s)) return;
  issue(s, day).seen = true;
}

/** How many of today's contracts are undone and not yet shown on the Quests screen: 0 once they have been. */
export function unseen(s: Save, day = dayKey()): number {
  if (!contractsOpen(s) || (s.contracts.day === day && s.contracts.seen)) return 0;
  return today(s, day).list.filter((k) => !k.done).length;
}

/** The gates today's undone contracts name as where they can be done. */
export function named(s: Save, day = dayKey()): Set<string> {
  if (!contractsOpen(s)) return new Set();
  return new Set(today(s, day).list.filter((k) => !k.done).flatMap((k) => k.where ?? []));
}

/** What one finished run did, as the contracts count it. */
export interface Deed {
  rank: string;
  cleared: boolean;
  /** Fatigue as the hunter walked in. */
  fatigue: number;
  felled: string[];
  shadowKills: number;
  /** Gatekeepers beaten. */
  elites: number;
  /** The road walked was not the one the System marked. */
  offroad: boolean;
}

/** How far one run takes a contract. Kills count however the run ends; the rest need a clear. */
export function progress(c: Contract, grade: Rank, x: Deed): number {
  switch (c.kind) {
    case 'clear': return x.cleared && rankIdx(x.rank) >= rankIdx(grade) ? 1 : 0;
    case 'fell': return x.felled.filter((id) => enemyById(id)?.family === c.family).length;
    case 'shadows': return x.shadowKills;
    case 'tired': return x.cleared && x.fatigue >= (c.at ?? 0) ? 1 : 0;
    case 'gatekeeper': return x.elites;
    case 'offroad': return x.cleared && x.offroad ? 1 : 0;
  }
}

/** What one contract pays at a grade, and what a full day pays on top. */
export const payOf = (grade: Rank) => ({ shards: shop.gateShards(grade, CONTRACT_PAY.shards), xp: Math.round(GATE_XP[grade] * CONTRACT_PAY.xp) });
export const bonusOf = (grade: Rank) => ({ shards: shop.gateShards(grade, CONTRACT_BONUS.shards), xp: Math.round(GATE_XP[grade] * CONTRACT_BONUS.xp) });

export interface ContractReport {
  /** Contracts this run completed, as they stood when it did. */
  done: Contract[];
  grade: Rank;
  /** It completed the last of the day's, and the bonus with it. */
  bonus: boolean;
  /** Shards paid, and experience due: `finish` grants it with the gate's, in one go. */
  shards: number;
  xp: number;
}

export const nothing = (grade: Rank = 'E'): ContractReport => ({ done: [], grade, bonus: false, shards: 0, xp: 0 });

/** Count a finished run against today's contracts and pay the shards of any it completes. Mutates. */
export function count(s: Save, x: Deed, day: string): ContractReport {
  if (!contractsOpen(s)) return nothing(licensedRank(s));
  const c = issue(s, day);
  const out = nothing(c.grade);
  for (const k of c.list) {
    if (k.done) continue;
    k.got = Math.min(k.need, k.got + progress(k, c.grade, x));
    if (k.got < k.need) continue;
    k.done = true;
    const p = payOf(c.grade);
    out.shards += shop.earn(s, p.shards);
    out.xp += p.xp;
    out.done.push({ ...k });
    s.stats.contracts++;
  }
  if (!c.bonus && c.list.length && c.list.every((k) => k.done)) {
    c.bonus = true;
    out.bonus = true;
    const b = bonusOf(c.grade);
    out.shards += shop.earn(s, b.shards);
    out.xp += b.xp;
    s.stats.contractDays++;
  }
  return out;
}

// ------------------------------------------------------------------ the words

const names = (ids: string[] = []) => {
  const xs = ids.map((id) => dungeonById(id)?.name).filter(Boolean) as string[];
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join('');
};

export function contractText(c: Contract, grade: Rank): string {
  switch (c.kind) {
    case 'clear': return `Clear ${c.need} Gates of ${grade}-Rank or higher.`;
    case 'fell': return `Fell ${c.need} ${c.family} creatures.`;
    case 'shadows': return `Let your Shadows land ${c.need} kills.`;
    case 'tired': return `Clear a Gate you walked into carrying ${c.at} fatigue or more.`;
    case 'gatekeeper': return 'Defeat a Gatekeeper.';
    case 'offroad': return 'Clear a Gate off the marked road.';
  }
}

/** Where, or how, it can be done. */
export function contractHint(c: Contract): string {
  switch (c.kind) {
    case 'clear': return 'Only a clear counts.';
    case 'fell': return `Found in: ${names(c.where)}. Kills in any Gate count, cleared or not.`;
    case 'shadows': return 'Kills by any deployed Shadow count, cleared or not.';
    case 'tired': return `Fatigue is read on entry. At ${c.at} fatigue you fight at ${Math.round(drag(c.at ?? 0) * 100)}% strength.`;
    case 'gatekeeper': return `Found in: ${names(c.where)}. It is off the marked road.`;
    case 'offroad': return 'Any step off the marked road counts.';
  }
}
