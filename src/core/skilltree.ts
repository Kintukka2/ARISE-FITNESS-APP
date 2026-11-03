/**
 * The skill tree: Skill Points, and what the hunter has spent them on.
 *
 * Skill Points are never stored. A hunter has what their level and the ranks they have claimed have
 * earned (`earned`), less the points held in the tree (`spent`). A point goes into one node at a time
 * (`learn`): a skill's next level, a stat's next rank, or a passive. A tier of a Path opens when the
 * hunter holds its rank and has spent enough in that Path (`TIER_GATE`); a node also needs the one it
 * grows from, and a fork's two halves seal each other. Nothing is unlearned one point at a time: a
 * reset (`reset`) hands every point back, the first for free.
 *
 * The skills learned are taken into a fight in slot order (`equip`), as many as the rank held has
 * slots for. `buildOf` is the tree as the fight reads it, through `raid.heroSpec`.
 */
import { CLASS_SKILLS } from '@/data/abilities';
import { classById } from '@/data/classes';
import { NODES, nodeById, PATHS, RESET, SKILL_POINTS, SKILL_SLOTS, TIER_GATE, TIER_RANKS, type TreeNode } from '@/data/tree';
import { gateRank, leadStat, RANK_LADDER, rankOf } from './progression';
import * as shop from './shop';
import type { Ability, Attrs, Save, Stat } from './types';
import { STATS } from './types';

export type { TreeNode };

const treeOf = (s: Save) => (s.hunter.tree ??= { learned: {}, equip: [], resets: 0 });

/** Points held in a node: a skill's level, a stat's rank, 1 for a passive learned. */
export const levelOf = (s: Save, id: string) => treeOf(s).learned[id] ?? 0;

/** Skill Points earned: each level past the first, and each rank claimed. */
export const earned = (s: Save) => (s.hunter.level - 1) * SKILL_POINTS.level + RANK_LADDER.indexOf(rankOf(s)) * SKILL_POINTS.rank;
export const spent = (s: Save) => Object.values(treeOf(s).learned).reduce((a, b) => a + b, 0);
/** Skill Points to spend. */
export const points = (s: Save) => Math.max(0, earned(s) - spent(s));

/** The highest tier the rank held opens: -1 at E-Rank, 0 at D, 4 at S and beyond. */
export const rankTier = (s: Save) => Math.min(TIER_RANKS.length - 1, RANK_LADDER.indexOf(rankOf(s)) - 1);
/** The tree opens with the class, at D-Rank. */
export const isOpen = (s: Save) => rankTier(s) >= 0;

/** Points spent in a Path. */
export const inPath = (s: Save, path: string) => NODES.reduce((t, n) => t + (n.path === path ? levelOf(s, n.id) : 0), 0);
export const tierOpen = (s: Save, path: string, tier: number) => rankTier(s) >= tier && inPath(s, path) >= TIER_GATE[tier];

/** Why a node cannot take a point now, or null if it can. Checked in this order. */
export type Block = 'max' | 'rank' | 'path' | 'req' | 'fork' | 'points';
export function blocked(s: Save, n: TreeNode): Block | null {
  if (levelOf(s, n.id) >= n.max) return 'max';
  if (rankTier(s) < n.tier) return 'rank';
  if (inPath(s, n.path) < TIER_GATE[n.tier]) return 'path';
  if (n.req && levelOf(s, n.req) < 1) return 'req';
  if (n.fork && levelOf(s, n.fork) > 0) return 'fork';
  if (points(s) < 1) return 'points';
  return null;
}
export const canLearn = (s: Save, n: TreeNode) => blocked(s, n) === null;

/** Whether a point can go anywhere: what the Skills tile and the Inventory tab call the hunter for. */
export const canSpend = (s: Save) => points(s) > 0 && NODES.some((n) => canLearn(s, n));
/** How many nodes could take a point now. */
export const learnable = (s: Save) => NODES.filter((n) => canLearn(s, n));

/** Skill slots: how many skills the hunter takes into a fight. */
export const slots = (s: Save) => SKILL_SLOTS[rankOf(s).key];

/** The skills taken into a fight, in slot order. */
export function equipped(s: Save): TreeNode[] {
  return treeOf(s).equip.map(nodeById).filter((n): n is TreeNode => !!n && n.kind === 'skill' && levelOf(s, n.id) > 0).slice(0, slots(s));
}
export const isEquipped = (s: Save, id: string) => equipped(s).some((n) => n.id === id);

export interface Learned { node: TreeNode; from: number; to: number; equipped: boolean }

/** Put a point into a node. A skill newly learned is taken into the fight while a slot is free. Null if it cannot. Mutates. */
export function learn(s: Save, id: string): Learned | null {
  const n = nodeById(id);
  if (!n || !canLearn(s, n)) return null;
  const t = treeOf(s);
  const from = t.learned[id] ?? 0;
  t.learned[id] = from + 1;
  let on = false;
  if (n.kind === 'skill' && from === 0) {
    t.equip = equipped(s).map((x) => x.id);
    if (t.equip.length < slots(s)) { t.equip.push(id); on = true; }
  }
  return { node: n, from, to: from + 1, equipped: on };
}

/**
 * Take a learned skill into the fight. With every slot full, it takes the place of `replace`, or of
 * the last slot's. False if it is not a learned skill, or is in already. Mutates.
 */
export function equip(s: Save, id: string, replace?: string): boolean {
  const n = nodeById(id);
  if (!n || n.kind !== 'skill' || levelOf(s, id) < 1 || isEquipped(s, id)) return false;
  const t = treeOf(s);
  const on = equipped(s).map((x) => x.id);
  if (on.length < slots(s)) on.push(id);
  else {
    const at = replace && on.includes(replace) ? on.indexOf(replace) : on.length - 1;
    if (at < 0) return false;
    on[at] = id;
  }
  t.equip = on;
  return true;
}

/** Leave a skill out of the fight. Mutates. */
export function unequip(s: Save, id: string): boolean {
  if (!isEquipped(s, id)) return false;
  const t = treeOf(s);
  t.equip = equipped(s).map((x) => x.id).filter((x) => x !== id);
  return true;
}

/** Move an equipped skill one slot up (-1) or down (+1). Mutates. */
export function shift(s: Save, id: string, by: -1 | 1): boolean {
  const on = equipped(s).map((x) => x.id);
  const i = on.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= on.length) return false;
  [on[i], on[j]] = [on[j], on[i]];
  treeOf(s).equip = on;
  return true;
}

/** What a reset costs now, in Mana Shards: nothing for the first. */
export const resetCost = (s: Save) => (treeOf(s).resets < RESET.free ? 0 : shop.gateShards(gateRank(s), RESET.share));

/** Hand every point back. Null if nothing is spent, or the shards fall short. Mutates. */
export function reset(s: Save): { refunded: number; cost: number } | null {
  const refunded = spent(s);
  const cost = resetCost(s);
  if (!refunded || !shop.pay(s, cost)) return null;
  const t = treeOf(s);
  t.learned = {};
  t.equip = [];
  t.resets += 1;
  return { refunded, cost };
}

// ------------------------------------------------------------------ the tree as a fight reads it

const baseSkill = new Map<string, Ability>(CLASS_SKILLS.map(({ line: _l, rung: _r, ...a }) => [a.name, a]));

/** A skill as it fights at a level: Lv.1 is the ability as written, each level past it adds its step. */
export function skillAt(n: TreeNode, level: number): Ability {
  const a = baseSkill.get(n.skill ?? n.name)!;
  const out: Ability = { ...a, inflicts: [...a.inflicts] };
  for (const up of (n.up ?? []).slice(0, Math.max(0, level - 1))) {
    if (up.mult) out.mult = Math.round((out.mult + up.mult) * 100) / 100;
    if (up.cd) out.cd = Math.max(0, out.cd + up.cd);
    if (up.inflicts) out.inflicts = [...new Set([...out.inflicts, ...up.inflicts])];
    if (up.profile) out.profile = up.profile;
  }
  return out;
}

export interface Build {
  /** The skills taken in, by name, in slot order; and each as its level makes it. */
  kit: string[];
  own: Ability[];
  passives: string[];
  /** Flat attribute points, added with the class's. */
  attrs: Partial<Attrs>;
  /** Fight bonuses, in the units gear rolls use. */
  bonus: Record<string, number>;
}

export function buildOf(s: Save): Build {
  const kit = equipped(s);
  const attrs: Partial<Attrs> = {};
  const bonus: Record<string, number> = {};
  const passives: string[] = [];
  for (const n of NODES) {
    const k = levelOf(s, n.id);
    if (!k) continue;
    if (n.kind === 'passive' && n.passive) passives.push(n.passive);
    for (const [a, v] of Object.entries(n.attrs ?? {})) attrs[a as Stat] = (attrs[a as Stat] ?? 0) + v * k;
    for (const [b, v] of Object.entries(n.bonus ?? {})) bonus[b] = Math.round(((bonus[b] ?? 0) + v * k) * 1000) / 1000;
  }
  return { kit: kit.map((n) => n.name), own: kit.map((n) => skillAt(n, levelOf(s, n.id))), passives, attrs, bonus };
}

/** The class's flat points and the tree's, together: what is added to the hunter's base stats. */
export function flatBonus(s: Save): Partial<Attrs> {
  const out: Partial<Attrs> = {};
  const cls = classById(s.hunter.classId);
  if (cls) out[cls.lead] = cls.bonus;
  for (const [k, v] of Object.entries(buildOf(s).attrs)) out[k as Stat] = (out[k as Stat] ?? 0) + v;
  return out;
}

/** The tree's flat points alone. */
export const treeAttrs = (s: Save): Partial<Attrs> => buildOf(s).attrs;

// ------------------------------------------------------------------ the System's way

/** The Paths in the order the System spends into them: the hunter's highest stat first. */
export function pathOrder(s: Save): Stat[] {
  const a = s.hunter.attrs;
  const lead = classById(s.hunter.classId)?.lead ?? leadStat(a);
  return [lead, ...STATS.filter((k) => k !== lead).sort((x, y) => a[y] - a[x] || STATS.indexOf(x) - STATS.indexOf(y))];
}

/** How much the System wants a node next: passives, then new skills down the left, then stats, then levels. */
function worth(s: Save, n: TreeNode): number {
  const held = levelOf(s, n.id);
  const left = n.col <= 1;
  const base = n.kind === 'passive' ? (n.fork && !left ? 20 : 100)
    : n.kind === 'skill' ? (held ? (left ? 50 : 30) : left ? 90 : 60)
      : 40;
  return base + n.tier;
}

/**
 * Spend every point the System's way: into the hunter's class Path until nothing there can take
 * one, then the next highest stat's, and on. Then fill the skill slots. Returns the points spent.
 * The balance tools' hunters, and a hunter who presses Auto Assign. Mutates.
 */
export function autoLearn(s: Save): number {
  if (!isOpen(s)) return 0;
  let n = 0;
  for (const path of pathOrder(s)) {
    for (let guard = 0; guard < 200; guard++) {
      const best = NODES.filter((x) => x.path === path && canLearn(s, x)).sort((a, b) => worth(s, b) - worth(s, a))[0];
      if (!best) break;
      learn(s, best.id);
      n++;
    }
  }
  autoEquip(s);
  return n;
}

/** Fill the skill slots with the strongest skills learned: the highest tier first, the class's Path before others. Mutates. */
export function autoEquip(s: Save): void {
  const lead = pathOrder(s)[0];
  const order = NODES.filter((n) => n.kind === 'skill' && levelOf(s, n.id) > 0)
    .sort((a, b) => b.tier - a.tier || Number(b.path === lead) - Number(a.path === lead) || a.col - b.col || levelOf(s, b.id) - levelOf(s, a.id));
  treeOf(s).equip = order.slice(0, slots(s)).map((n) => n.id);
}

/** A Path's name and its nodes, for the screens. */
export const paths = () => PATHS.map((p) => ({ ...p, nodes: NODES.filter((n) => n.path === p.key) }));
