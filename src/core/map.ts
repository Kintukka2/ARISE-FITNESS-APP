/**
 * A gate's map: a few layers of choices, a rest, then the boss. It is drawn
 * from the gate and the day, so the brief can show it before you go in and
 * everyone who enters that day walks the same one.
 *
 * Every layer holds at least one fight, the first holds nothing else, and
 * every node can be reached and leads on to the boss.
 */
import { BLESSINGS, EVENTS, type NodeKind } from '@/data/nodes';
import { enemyById, isPractice } from './gates';
import type { Dungeon } from './types';
import { rng, weighted } from './util';

export interface MapNode {
  id: string;
  layer: number;
  kind: NodeKind;
  /** Ids in the next layer this node leads to. */
  next: string[];
  /** Who waits in a fight, a gatekeeper's room or the boss's. */
  foes?: string[];
  /** The event drawn for an event node. */
  event?: string;
  /** The two blessings a shrine offers. */
  offer?: string[];
}

export interface GateMap { layers: MapNode[][]; byId: Record<string, MapNode> }

/** A fight. A champion is one of the Trial's Chosen before the last: fought with a boss's health, but not the end of the run. */
export interface Chamber { label: string; foes: string[]; boss: boolean; elite: boolean; champion?: boolean }

/** The seed a gate's map is drawn from: the same all day. */
export const mapSeed = (d: Dungeon, day: string) => `${d.id}|${day}`;

/** Layers of choices before the rest and the boss. The old straight line had this many chambers. */
export const choiceLayers = (d: Dungeon) => d.mobRounds + (d.elite ? 1 : 0);

const WEIGHTS: { kind: NodeKind; w: number }[] = [
  { kind: 'fight', w: 44 }, { kind: 'elite', w: 11 }, { kind: 'treasure', w: 9 }, { kind: 'shrine', w: 9 },
  { kind: 'trap', w: 9 }, { kind: 'event', w: 12 }, { kind: 'rest', w: 6 },
];
/** The practice gate teaches the map without punishing it. */
const PRACTICE: { kind: NodeKind; w: number }[] = [{ kind: 'fight', w: 60 }, { kind: 'treasure', w: 20 }, { kind: 'shrine', w: 20 }];

/** A Trial's map: one of the Chosen to a layer, the last of them its boss. Nothing to choose, and nowhere to rest. */
function trialMap(d: Dungeon): GateMap {
  const n = d.trial ?? 1;
  const layers: MapNode[][] = Array.from({ length: n }, (_, k) => [{
    id: `${k}-0`, layer: k, kind: k === n - 1 ? 'boss' : 'elite', next: k === n - 1 ? [] : [`${k + 1}-0`],
    foes: [`CHO-${(d.trialFrom ?? 1) + k}-${d.rank}`],
  }]);
  const byId: Record<string, MapNode> = {};
  for (const row of layers) for (const x of row) byId[x.id] = x;
  return { layers, byId };
}

export function build(d: Dungeon, seed: string): GateMap {
  if (d.trial) return trialMap(d);
  const r = rng('arise|map|' + seed);
  const practice = isPractice(d);
  const n = choiceLayers(d);
  const layers: MapNode[][] = [];
  for (let k = 0; k < n; k++) {
    const width = k === 0 || practice ? 2 : 2 + (r() < 0.55 ? 1 : 0);
    const pool = (practice ? PRACTICE : WEIGHTS).filter((x) =>
      (x.kind !== 'elite' || !!d.elite) && (x.kind !== 'rest' || k >= 2));
    const row: MapNode[] = Array.from({ length: width }, (_, i) => ({
      id: `${k}-${i}`, layer: k, kind: k === 0 ? 'fight' : weighted(pool, r()).kind, next: [],
    }));
    if (!row.some((x) => x.kind === 'fight')) row[Math.floor(r() * width)].kind = 'fight';
    layers.push(row);
  }
  layers.push([{ id: `${n}-0`, layer: n, kind: 'rest', next: [] }]);
  layers.push([{ id: `${n + 1}-0`, layer: n + 1, kind: 'boss', next: [], foes: [d.boss] }]);

  // Edges: each node leads to the node below it, and sometimes a neighbour. Nothing is left unreachable.
  for (let k = 0; k < layers.length - 1; k++) {
    const a = layers[k];
    const b = layers[k + 1];
    const under = (i: number, from: number, to: number) => (from <= 1 ? 0 : Math.round((i * (to - 1)) / (from - 1)));
    a.forEach((x, i) => {
      const j = b.length === 1 ? 0 : under(i, a.length, b.length);
      x.next.push(b[j].id);
      const side = j + (r() < 0.5 ? 1 : -1);
      if (b.length > 1 && r() < 0.5 && side >= 0 && side < b.length) x.next.push(b[side].id);
    });
    b.forEach((y, j) => {
      if (a.some((x) => x.next.includes(y.id))) return;
      a[b.length === 1 ? 0 : under(j, b.length, a.length)].next.push(y.id);
    });
    for (const x of a) x.next.sort();
  }

  // What waits at each node.
  for (const row of layers) for (const x of row) {
    const rr = rng(`arise|node|${seed}|${x.id}`);
    if (x.kind === 'fight') {
      const count = 1 + Math.floor(rr() * 3);
      x.foes = Array.from({ length: count }, () => d.mobs[Math.floor(rr() * d.mobs.length)]);
    } else if (x.kind === 'elite') x.foes = [d.elite!];
    else if (x.kind === 'event') x.event = EVENTS[Math.floor(rr() * EVENTS.length)].id;
    else if (x.kind === 'shrine') {
      const pool = BLESSINGS.map((b) => b.id);
      const first = pool.splice(Math.floor(rr() * pool.length), 1)[0];
      x.offer = [first, pool[Math.floor(rr() * pool.length)]];
    }
  }
  const byId: Record<string, MapNode> = {};
  for (const row of layers) for (const x of row) byId[x.id] = x;
  return { layers, byId };
}

/** Where a walker on `path` can step next. */
export function next(m: GateMap, path: string[]): MapNode[] {
  if (!path.length) return m.layers[0];
  const last = m.byId[path[path.length - 1]];
  return (last?.next ?? []).map((id) => m.byId[id]).filter(Boolean);
}

/** The order the System prefers its steps in: fight its way through, rest when it can, and leave the gambles alone. */
const SYSTEM_ROAD: NodeKind[] = ['rest', 'fight', 'shrine', 'treasure', 'event', 'trap', 'elite', 'boss'];

/** The System's own pick among the steps on offer. */
export const systemPick = (options: MapNode[]) =>
  options.slice().sort((a, b) => SYSTEM_ROAD.indexOf(a.kind) - SYSTEM_ROAD.indexOf(b.kind))[0];

/** The whole road the System walks, start to boss: what the brief assesses and Auto follows. */
export function systemRoad(m: GateMap): string[] {
  const path: string[] = [];
  for (let k = 0; k < m.layers.length; k++) path.push(systemPick(next(m, path)).id);
  return path;
}

/** The fight a node holds. */
export function chamberOf(d: Dungeon, x: MapNode): Chamber {
  const boss = x.kind === 'boss';
  const elite = x.kind === 'elite';
  if (d.trial) return { label: enemyById(x.foes?.[0] ?? '')?.name ?? 'The Chosen', foes: x.foes ?? [], boss, elite, champion: !boss };
  const label = boss ? enemyById(d.boss)?.name ?? 'Boss' : elite ? 'Gatekeeper' : d.floor ? `Floor ${d.floor + x.layer}` : `Chamber ${x.layer + 1}`;
  return { label, foes: x.foes ?? [], boss, elite };
}

export const isFight = (x: MapNode) => x.kind === 'fight' || x.kind === 'elite' || x.kind === 'boss';
