/**
 * Blessings in a run: what a shrine offers, what a Font raises, what the System takes, and what the
 * hunter carries into each fight. A shrine's Path is drawn from the run and the node, leaning toward
 * the Path the hunter has spent most in as they walked in (`run.lean`); its offer is drawn when the
 * hunter steps in and written to the run (`run.offers`) before it plays. Never touches the DOM.
 */
import { BOON_LIST, BOONS, boonById, FONT_OFFER, OFFER, STEER, TIER_ODDS, type BoonDef } from '@/data/blessings';
import { blessingById } from '@/data/nodes';
import { PATHS } from '@/data/tree';
import * as skilltree from './skilltree';
import type { MapNode } from './map';
import type { Save, Stat } from './types';
import { rng, type Rand } from './util';

/** One blessing offered: what it is, and the tier it comes at, or a Font would raise it to. */
export interface Pick { id: string; tier: number }
/** What a shrine or a Font offers, as written to the run when the hunter steps in. */
export interface Offer { path: Stat; font?: boolean; picks: Pick[] }

/** The part of a run the blessings read. An open run is one; the projection keeps its own. */
export interface Held {
  seed: string;
  lean?: Stat;
  blessings: string[];
  tiers?: Record<string, number>;
  offers?: Record<string, Offer>;
}

/** The Path the hunter has spent the most Skill Points in; with none spent, their class's. */
export function leanOf(s: Save): Stat {
  const order = skilltree.pathOrder(s);
  return order.reduce((a, b) => (skilltree.inPath(s, b) > skilltree.inPath(s, a) ? b : a), order[0]);
}

/** A blessing's tier in the run: 0 if it is not held. A blessing of the old five holds at I. */
export const tierOf = (run: Held, id: string) => (run.blessings.includes(id) ? run.tiers?.[id] ?? 1 : 0);

/** The run's blessings as the fight reads them: by id, at their tiers. The old five are stats, and stay out. */
export function boonsOf(run: Held): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of run.blessings) if (BOONS[id]) out[id] = tierOf(run, id);
  return out;
}

/** A shrine's Path: drawn from the run and the node, the hunter's own Path `STEER` times as often as each other. */
export function shrinePath(run: Held, x: MapNode): Stat {
  const keys = PATHS.map((p) => p.key);
  const lean = run.lean ?? keys[0];
  const weights = keys.map((k) => (k === lean ? STEER : 1));
  let roll = rng(`arise|path|${run.seed}|${x.id}`)() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) if ((roll -= weights[i]) < 0) return keys[i];
  return lean;
}

const holds = (run: Held, id: string) => run.blessings.includes(id);
const pathHeld = (run: Held, p: Stat) => run.blessings.some((id) => BOONS[id]?.kind === 'path' && BOONS[id].paths[0] === p);

/** Whether a blessing can be offered to the run: not held, and a Duo's or a Capstone's needs met. */
export function eligible(run: Held, b: BoonDef): boolean {
  if (holds(run, b.id)) return false;
  if (b.kind === 'duo') return b.paths.every((p) => pathHeld(run, p));
  if (b.kind === 'capstone') return (b.needs ?? []).filter((id) => holds(run, id)).length >= 2;
  return true;
}

/** What a shrine of `path` can offer the run: its Path's, its Capstone and the Duos it is half of, that the run can take. */
export const poolOf = (run: Held, path: Stat) => BOON_LIST.filter((b) => b.paths.includes(path) && eligible(run, b));

const tierRoll = (r: Rand) => {
  let roll = r();
  for (let i = 0; i < TIER_ODDS.length; i++) if ((roll -= TIER_ODDS[i]) < 0) return i + 1;
  return 1;
};

/** Draw `n` from a pool, each once, in the order drawn. */
function draw<T>(pool: T[], n: number, r: Rand): T[] {
  const left = pool.slice();
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(r() * left.length), 1)[0]);
  return out;
}

/** The blessings held that a Font can raise: below tier III. The old five have no tiers. */
export const raisable = (run: Held) => run.blessings.filter((id) => BOONS[id] && tierOf(run, id) < 3);

/**
 * What a shrine or a Font offers the run, drawn from the run and the node. A shrine offers `OFFER` of its
 * Path's blessings at drawn tiers; with its Path spent, any Path's. A Font offers up to `FONT_OFFER` of the
 * blessings held to raise a tier; with none to raise, it offers as a shrine.
 */
export function offerFor(run: Held, x: MapNode): Offer {
  const r = rng(`arise|offer|${run.seed}|${x.id}`);
  const path = shrinePath(run, x);
  if (x.kind === 'font') {
    const up = raisable(run);
    if (up.length) return { path, font: true, picks: draw(up, FONT_OFFER, r).map((id) => ({ id, tier: tierOf(run, id) + 1 })) };
  }
  let pool = poolOf(run, path);
  if (!pool.length) pool = BOON_LIST.filter((b) => eligible(run, b));
  return { path, picks: draw(pool, OFFER, r).map((b) => ({ id: b.id, tier: tierRoll(r) })) };
}

/** The offer written to the run for a node, or the one it would draw. */
export const offerAt = (run: Held, x: MapNode): Offer => run.offers?.[x.id] ?? offerFor(run, x);

/**
 * The System's pick from an offer: never one only a hand plays, then the highest tier (a Font, the lowest
 * held, so the climb is even), then a Capstone before a Duo before a Path's, then the first offered.
 */
export function systemPick(o: Offer, run?: Held): number {
  if (!o.picks.length) return 0;
  const rank = { capstone: 2, duo: 1, path: 0 };
  const score = (p: Pick) => {
    const b = boonById(p.id);
    if (!b) return -1;
    const tier = o.font && run ? 3 - tierOf(run, p.id) : p.tier;
    return (b.hands ? 0 : 1000) + tier * 10 + rank[b.kind];
  };
  return o.picks.reduce((best, p, i) => (score(p) > score(o.picks[best]) ? i : best), 0);
}

/** Take a pick: a new blessing at its tier, or, at a Font, a blessing held raised to it. Mutates. */
export function take(run: Held, p: Pick) {
  if (!holds(run, p.id)) run.blessings = [...run.blessings, p.id];
  run.tiers = { ...(run.tiers ?? {}), [p.id]: Math.min(3, Math.max(p.tier, tierOf(run, p.id))) };
}

/** An event's blessing: one of the hunter's own Path the run does not hold, at tier I. Null if none is left. */
export function gift(run: Held, r: Rand): Pick | null {
  let pool = poolOf(run, run.lean ?? PATHS[0].key).filter((b) => b.kind === 'path');
  if (!pool.length) pool = BOON_LIST.filter((b) => b.kind === 'path' && eligible(run, b));
  const b = pool[Math.floor(r() * pool.length)];
  return b ? { id: b.id, tier: 1 } : null;
}

/** A blessing's name and what it does at a tier, for the screens: the five Paths', and the old five's. */
export function describe(id: string, tier = 1): { name: string; text: string } {
  const b = boonById(id);
  if (b) return { name: b.name, text: b.text(b.v[Math.min(3, Math.max(1, tier)) - 1]) };
  const old = blessingById(id);
  return { name: old?.name ?? id, text: old ? `${old.text}.` : '' };
}
