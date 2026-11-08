/**
 * A Gate's map. A Gate is a dungeon: rooms joined by corridors, drawn on a grid, the entrance at
 * its foot and the boss at its head. A road of rooms runs between them, side rooms branch off it,
 * and a corridor or two closes a loop. The hunter enters any room next to one already cleared, and
 * walks back through cleared rooms as they please. Where the Gate has a Gatekeeper, it sits at the
 * end of a branch and carries what opens the Gate's sealed vault. Rests are rare and can be anywhere.
 *
 * A tower is climbed instead, floor by floor and only up: a block of the Pale Spire, layers of
 * choices then a rest and its boss; a Trial, one of the Chosen to a floor.
 *
 * Either is drawn from the Gate and the day, so the brief can show it before you go in and everyone
 * who enters that day walks the same one.
 */
import { BLESSINGS, EVENTS, type NodeKind } from '@/data/nodes';
import { enemyById, isPractice } from './gates';
import type { Dungeon } from './types';
import { rng, weighted, type Rand } from './util';

export interface MapNode {
  id: string;
  /** Unique on its map: the number a room shows, and what seeds its fight. On a tower, its floor. */
  n: number;
  /** A tower's floor, from 0. A room's corridors from the entrance. */
  layer: number;
  kind: NodeKind;
  /** A tower: the ids on the floor above it leads to. A room: the rooms its corridors join, both ways. */
  next: string[];
  /** A room's cell on the plan, from the top left. */
  x?: number;
  y?: number;
  /** A room's hidden passages, both ways: one opens once a room at either end is cleared. */
  hidden?: string[];
  /** Who waits in a fight, a Gatekeeper's room or the boss's. */
  foes?: string[];
  /** The event drawn for an event node. */
  event?: string;
  /** The two blessings a shrine offers. */
  offer?: string[];
}

export interface GateMap {
  /** Climbed floor by floor, or explored room by room. */
  tower: boolean;
  /** A tower's floors, foot to top. Empty for a dungeon. */
  layers: MapNode[][];
  nodes: MapNode[];
  byId: Record<string, MapNode>;
  /** A dungeon's entrance. Null for a tower. */
  start: string | null;
  /** The node the boss holds. */
  boss: string;
  /** A dungeon's plan, in cells. */
  cols: number;
  rows: number;
}

/** How an open run's map is drawn. Runs opened before the dungeons walk the floors they began on. */
export type Layout = 'rooms' | 'layers';

/** A fight. A champion is one of the Trial's Chosen before the last: fought with a boss's health, but not the end of the run. */
export interface Chamber { label: string; foes: string[]; boss: boolean; elite: boolean; champion?: boolean }

/** The seed a gate's map is drawn from: the same all day. */
export const mapSeed = (d: Dungeon, day: string) => `${d.id}|${day}`;

/** Rooms on a dungeon's road before the boss, or a tower block's floors of choices. The old straight line had this many chambers. */
export const choiceLayers = (d: Dungeon) => d.mobRounds + (d.elite ? 1 : 0);

const index = (layers: MapNode[][]) => {
  const byId: Record<string, MapNode> = {};
  for (const row of layers) for (const x of row) byId[x.id] = x;
  return byId;
};

/** Fill in who waits in a fight, what an event is and what a shrine offers, each drawn for its node. */
function furnish(d: Dungeon, seed: string, nodes: MapNode[]) {
  for (const x of nodes) {
    const rr = rng(`arise|node|${seed}|${x.id}`);
    if (x.kind === 'fight') {
      // The practice Gate's fights are one or two creatures: a first dungeon is not lost.
      const count = 1 + Math.floor(rr() * (isPractice(d) ? 2 : 3));
      x.foes = Array.from({ length: count }, () => d.mobs[Math.floor(rr() * d.mobs.length)]);
    } else if (x.kind === 'elite') x.foes = [d.elite!];
    else if (x.kind === 'boss') x.foes = [d.boss];
    else if (x.kind === 'event') x.event = EVENTS[Math.floor(rr() * EVENTS.length)].id;
    else if (x.kind === 'shrine') {
      const pool = BLESSINGS.map((b) => b.id);
      const first = pool.splice(Math.floor(rr() * pool.length), 1)[0];
      x.offer = [first, pool[Math.floor(rr() * pool.length)]];
    }
  }
}

// ------------------------------------------------------------------ towers

const WEIGHTS: { kind: NodeKind; w: number }[] = [
  { kind: 'fight', w: 44 }, { kind: 'elite', w: 11 }, { kind: 'treasure', w: 9 }, { kind: 'shrine', w: 9 },
  { kind: 'trap', w: 9 }, { kind: 'event', w: 12 }, { kind: 'rest', w: 6 },
];
/** The practice gate teaches the map without punishing it. */
const PRACTICE: { kind: NodeKind; w: number }[] = [{ kind: 'fight', w: 60 }, { kind: 'treasure', w: 20 }, { kind: 'shrine', w: 20 }];

const tower = (layers: MapNode[][], seed: string, d: Dungeon): GateMap => {
  const nodes = layers.flat();
  furnish(d, seed, nodes);
  const top = layers[layers.length - 1][0];
  return { tower: true, layers, nodes, byId: index(layers), start: null, boss: top.id, cols: Math.max(...layers.map((r) => r.length)), rows: layers.length };
};

/** A Trial's map: one of the Chosen to a floor, the last of them its boss. Nothing to choose, and nowhere to rest. */
function trialMap(d: Dungeon): GateMap {
  const n = d.trial ?? 1;
  const layers: MapNode[][] = Array.from({ length: n }, (_, k) => [{
    id: `${k}-0`, n: k, layer: k, kind: k === n - 1 ? 'boss' : 'elite', next: k === n - 1 ? [] : [`${k + 1}-0`],
    foes: [`CHO-${(d.trialFrom ?? 1) + k}-${d.rank}`],
  }]);
  const byId = index(layers);
  return { tower: true, layers, nodes: layers.flat(), byId, start: null, boss: layers[n - 1][0].id, cols: 1, rows: n };
}

/** A tower block: floors of choices, a rest, then the boss. Every floor holds a fight, the first nothing else. */
function layered(d: Dungeon, seed: string): GateMap {
  const r = rng('arise|map|' + seed);
  const practice = isPractice(d);
  const n = choiceLayers(d);
  const layers: MapNode[][] = [];
  for (let k = 0; k < n; k++) {
    const width = k === 0 || practice ? 2 : 2 + (r() < 0.55 ? 1 : 0);
    const pool = (practice ? PRACTICE : WEIGHTS).filter((x) =>
      (x.kind !== 'elite' || !!d.elite) && (x.kind !== 'rest' || k >= 2));
    const row: MapNode[] = Array.from({ length: width }, (_, i) => ({
      id: `${k}-${i}`, n: k, layer: k, kind: k === 0 ? 'fight' : weighted(pool, r()).kind, next: [],
    }));
    if (!row.some((x) => x.kind === 'fight')) row[Math.floor(r() * width)].kind = 'fight';
    layers.push(row);
  }
  layers.push([{ id: `${n}-0`, n, layer: n, kind: 'rest', next: [] }]);
  layers.push([{ id: `${n + 1}-0`, n: n + 1, layer: n + 1, kind: 'boss', next: [] }]);

  // Edges: each node leads to the node above it, and sometimes a neighbour. Nothing is left unreachable.
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
  return tower(layers, seed, d);
}

// ------------------------------------------------------------------ dungeons

/** A dungeon's plan is this many cells across. */
export const COLS = 5;
/** A room on the road past the first is something other than a fight this often, and no more than `ROAD_ODD.most` of them are. */
const ROAD_ODD = { chance: 0.3, most: 2 } as const;
const ROAD: { kind: NodeKind; w: number }[] = [
  { kind: 'event', w: 30 }, { kind: 'shrine', w: 22 }, { kind: 'trap', w: 22 }, { kind: 'treasure', w: 14 }, { kind: 'rest', w: 12 },
];
/** What a side room holds: the finds are off the road. */
const SIDE: { kind: NodeKind; w: number }[] = [
  { kind: 'fight', w: 30 }, { kind: 'treasure', w: 22 }, { kind: 'event', w: 16 }, { kind: 'shrine', w: 13 }, { kind: 'trap', w: 11 }, { kind: 'rest', w: 8 },
];
/** Rests are rare: never more than this many in one Gate. */
export const RESTS_MAX = 2;
/** A hidden passage is drawn in this share of Gates, between rooms at least `HIDDEN_PASSAGE.apart` corridors apart. */
export const HIDDEN_PASSAGE = { chance: 0.5, apart: 3 } as const;
/** Two rooms side by side are joined by a second corridor this often, where it does not shorten the road. */
const LOOP = 0.3;

const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

/** Corridors from `from` to every room, through `next` only. */
function distances(nodes: MapNode[], byId: Record<string, MapNode>, from: string): Record<string, number> {
  const dist: Record<string, number> = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    for (const nb of byId[id].next) if (dist[nb] === undefined) { dist[nb] = dist[id] + 1; queue.push(nb); }
  }
  for (const x of nodes) dist[x.id] ??= Infinity;
  return dist;
}

/** A Gate as a dungeon: rooms on a grid, joined by corridors. */
function dungeon(d: Dungeon, seed: string): GateMap {
  const r: Rand = rng('arise|plan|' + seed);
  const practice = isPractice(d);
  // The practice Gate is a first dungeon, made easy: a rest waits in the room before the boss.
  const roadLength = choiceLayers(d) + (practice ? 1 : 0);
  const nodes: MapNode[] = [];
  const byId: Record<string, MapNode> = {};
  const cells = new Map<string, MapNode>();
  const at = (x: number, y: number) => cells.get(`${x},${y}`);
  const add = (x: number, y: number, kind: NodeKind) => {
    const node: MapNode = { id: `r${nodes.length}`, n: 0, layer: 0, kind, next: [], x, y };
    nodes.push(node);
    byId[node.id] = node;
    cells.set(`${x},${y}`, node);
    return node;
  };
  const link = (a: MapNode, b: MapNode) => { a.next.push(b.id); b.next.push(a.id); };

  // The road climbs from the entrance: up, or along, never down, never across itself, never more than two along in a row.
  const entrance = add(2, 0, 'entrance');
  const road: MapNode[] = [];
  let prev = entrance;
  let along = 0;
  for (let i = 0; i < roadLength; i++) {
    const ways: { dx: number; w: number }[] = [{ dx: 0, w: 2 }];
    if (i > 0 && along < 2) for (const dx of [-1, 1]) if (!at(prev.x! + dx, prev.y!) && prev.x! + dx >= 0 && prev.x! + dx < COLS) ways.push({ dx, w: 1 });
    const { dx } = weighted(ways, r());
    along = dx ? along + 1 : 0;
    const room = add(prev.x! + dx, prev.y! + (dx ? 0 : -1), 'fight');
    link(prev, room);
    road.push(room);
    prev = room;
  }
  const top = Math.min(...road.map((x) => x.y!));
  const boss = add(prev.x!, top - 1, 'boss');
  link(prev, boss);

  // Side rooms branch off the road, one or two deep. None is ever beside the boss: its row is its own.
  const depth: Record<string, number> = { [entrance.id]: 0 };
  for (const x of road) depth[x.id] = 0;
  const free = (x: number, y: number) => x >= 0 && x < COLS && y >= top && y <= 0 && !at(x, y);
  const sprouts = (from: (x: MapNode) => boolean) => {
    const out: { parent: MapNode; x: number; y: number }[] = [];
    for (const p of nodes) {
      if (!from(p)) continue;
      for (const [dx, dy] of DIRS) if (free(p.x! + dx, p.y! + dy)) out.push({ parent: p, x: p.x! + dx, y: p.y! + dy });
    }
    return out;
  };
  const branch = (from: (x: MapNode) => boolean, kind: NodeKind) => {
    const options = sprouts(from);
    if (!options.length) return null;
    const o = options[Math.floor(r() * options.length)];
    const room = add(o.x, o.y, kind);
    link(o.parent, room);
    depth[room.id] = (depth[o.parent.id] ?? 0) + 1;
    return room;
  };
  const growing = (x: MapNode) => (x.kind === 'fight' || x.kind === 'entrance') && depth[x.id] !== undefined && depth[x.id] < 2;
  const sideCount = practice ? 2 : Math.round(roadLength * 0.8) + (r() < 0.5 ? 1 : 0);
  const sides: MapNode[] = [];
  for (let i = 0; i < sideCount; i++) {
    const room = branch(growing, 'fight');
    if (room) sides.push(room);
  }

  // The Gatekeeper holds the end of a branch, the deeper the better; its vault is sealed somewhere else.
  let keeper: MapNode | null = null;
  let vault: MapNode | null = null;
  if (d.elite) {
    keeper = branch((x) => sides.includes(x) && x.next.length === 1, 'elite') ?? branch(growing, 'elite');
    if (keeper) {
      const fromKeeper = distances(nodes, byId, keeper.id);
      const options = sprouts((x) => x !== keeper && x.kind !== 'boss');
      const far = Math.max(...options.map((o) => fromKeeper[o.parent.id]));
      const pick = options.filter((o) => fromKeeper[o.parent.id] >= far - 1);
      if (pick.length) {
        const o = pick[Math.floor(r() * pick.length)];
        vault = add(o.x, o.y, 'vault');
        link(o.parent, vault);
      }
    }
  }

  // What waits in each room: the road is mostly fights, the side rooms hold the finds.
  let odd = 0;
  road.forEach((x, i) => {
    if (practice && i === roadLength - 1) x.kind = 'rest';
    if (i === 0 || practice || r() >= ROAD_ODD.chance || odd >= ROAD_ODD.most) return;
    x.kind = weighted(ROAD, r()).kind;
    odd++;
  });
  sides.forEach((x, i) => { x.kind = practice ? (i === 0 ? 'treasure' : 'shrine') : weighted(SIDE, r()).kind; });
  let rests = 0;
  for (const x of [...road, ...sides]) if (x.kind === 'rest' && ++rests > RESTS_MAX) x.kind = 'event';

  // A second corridor between rooms side by side, now and then: never into the entrance, the boss, the
  // Gatekeeper or the vault, and never one that shortens the road.
  const shut = (x: MapNode) => x === entrance || x === boss || x === keeper || x === vault;
  const pairs: [MapNode, MapNode][] = [];
  for (const a of nodes) for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const b = at(a.x! + dx, a.y! + dy);
    if (b && !shut(a) && !shut(b) && !a.next.includes(b.id)) pairs.push([a, b]);
  }
  let roadDist = distances(nodes, byId, entrance.id)[boss.id];
  for (const [a, b] of pairs) {
    if (r() >= LOOP) continue;
    link(a, b);
    const now = distances(nodes, byId, entrance.id)[boss.id];
    if (now < roadDist) { a.next.pop(); b.next.pop(); } else roadDist = now;
  }

  // A hidden passage: a wall between two rooms far apart by corridor.
  if (!practice && r() < HIDDEN_PASSAGE.chance) {
    const far = pairs.filter(([a, b]) => !a.next.includes(b.id) && distances(nodes, byId, a.id)[b.id] >= HIDDEN_PASSAGE.apart);
    if (far.length) {
      const [a, b] = far[Math.floor(r() * far.length)];
      a.hidden = [b.id];
      b.hidden = [a.id];
    }
  }

  // Number the rooms from the entrance out, as a plan would, and set the boss's row at the top.
  for (const x of nodes) x.next.sort((p, q) => Number(p.slice(1)) - Number(q.slice(1)));
  const dist = distances(nodes, byId, entrance.id);
  const order = nodes.slice().sort((a, b) => dist[a.id] - dist[b.id] || b.y! - a.y! || a.x! - b.x!);
  order.forEach((x, i) => { x.n = i; x.layer = dist[x.id]; });
  for (const x of nodes) x.y = x.y! - (top - 1);
  furnish(d, seed, nodes);
  return { tower: false, layers: [], nodes, byId, start: entrance.id, boss: boss.id, cols: COLS, rows: 2 - top };
}

/** Draw a Gate's map. A Trial and a block of the Spire are towers; any other Gate is a dungeon, unless an open run began on floors. */
export function build(d: Dungeon, seed: string, layout: Layout = 'rooms'): GateMap {
  if (d.trial) return trialMap(d);
  if (d.floor || layout === 'layers') return layered(d, seed);
  return dungeon(d, seed);
}

/** Where a climber on `path` can step next, on a tower. */
export function next(m: GateMap, path: string[]): MapNode[] {
  if (!path.length) return m.layers[0];
  const last = m.byId[path[path.length - 1]];
  return (last?.next ?? []).map((id) => m.byId[id]).filter(Boolean);
}

/** The vault's seal is broken once the Gatekeeper is down. */
export const unsealed = (m: GateMap, cleared: Set<string>) => m.nodes.some((x) => x.kind === 'elite' && cleared.has(x.id));

/** The hidden passages that have opened: those with a cleared room at either end. */
export function passages(m: GateMap, cleared: Set<string>): [string, string][] {
  const out: [string, string][] = [];
  for (const x of m.nodes) for (const y of x.hidden ?? []) if (x.id < y && (cleared.has(x.id) || cleared.has(y))) out.push([x.id, y]);
  return out;
}

/**
 * What a dungeon's walker can see through the fog: the entrance and the boss's room, every room cleared
 * and every room next to one, by corridor or an opened passage, and whatever is remembered of the map.
 * Corridors are never fogged. A tower has no fog.
 */
export function sight(m: GateMap, cleared: Set<string>, remembered: Iterable<string> = []): Set<string> {
  if (m.tower) return new Set(m.nodes.map((x) => x.id));
  const out = new Set<string>([m.start!, m.boss, ...remembered, ...cleared]);
  for (const id of cleared) for (const nb of [...(m.byId[id]?.next ?? []), ...(m.byId[id]?.hidden ?? [])]) out.add(nb);
  return out;
}

/** The rooms a dungeon's walker can enter: any not yet cleared next to one that is, by corridor or an opened passage. */
export function reach(m: GateMap, cleared: Set<string>): MapNode[] {
  const open = unsealed(m, cleared);
  const out = new Set<string>();
  for (const id of cleared) {
    const x = m.byId[id];
    if (!x) continue;
    for (const nb of [...x.next, ...(x.hidden ?? [])]) if (!cleared.has(nb) && (m.byId[nb].kind !== 'vault' || open)) out.add(nb);
  }
  return m.nodes.filter((x) => out.has(x.id));
}

/** The order the System prefers its steps in: fight its way through, rest when it can, and leave the gambles alone. */
const SYSTEM_ROAD: NodeKind[] = ['rest', 'fight', 'shrine', 'treasure', 'event', 'trap', 'elite', 'vault', 'entrance', 'boss'];
const preference = (a: MapNode, b: MapNode) => SYSTEM_ROAD.indexOf(a.kind) - SYSTEM_ROAD.indexOf(b.kind);

/** The System's own pick among the steps on offer. */
export const systemPick = (options: MapNode[]) => options.slice().sort(preference)[0];

/**
 * The whole road the System walks, to the boss: what the brief assesses and Auto follows. Up a tower,
 * its pick on every floor. Through a dungeon, the fewest rooms from the entrance to the boss, and
 * where two ways are as short, the rooms it prefers. Hidden passages are not on it.
 */
export function systemRoad(m: GateMap): string[] {
  const path: string[] = [];
  if (m.tower) {
    for (let k = 0; k < m.layers.length; k++) path.push(systemPick(next(m, path)).id);
    return path;
  }
  const dist = distances(m.nodes, m.byId, m.boss);
  let at = m.start!;
  while (at !== m.boss) {
    const here = m.byId[at];
    at = systemPick(here.next.map((id) => m.byId[id]).filter((x) => dist[x.id] === dist[at] - 1)).id;
    path.push(at);
  }
  return path;
}

/** The fight a node holds. */
export function chamberOf(d: Dungeon, x: MapNode): Chamber {
  const boss = x.kind === 'boss';
  const elite = x.kind === 'elite';
  if (d.trial) return { label: enemyById(x.foes?.[0] ?? '')?.name ?? 'The Chosen', foes: x.foes ?? [], boss, elite, champion: !boss };
  const label = boss ? enemyById(d.boss)?.name ?? 'Boss' : elite ? 'Gatekeeper' : d.floor ? `Floor ${d.floor + x.layer}` : `Chamber ${x.x === undefined ? x.layer + 1 : x.n}`;
  return { label, foes: x.foes ?? [], boss, elite };
}

export const isFight = (x: MapNode) => x.kind === 'fight' || x.kind === 'elite' || x.kind === 'boss';
