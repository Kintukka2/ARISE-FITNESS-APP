/**
 * A Gate's map. A Gate is a dungeon: rooms joined by corridors, drawn on a grid, the entrance at
 * its foot and the boss at its head. A road of rooms runs between them, side rooms branch off it,
 * and a corridor or two closes a loop. A deeper Gate has floors (`FLOORS`): each floor but the last
 * ends in stairs down instead of the boss, and each below the first starts at stairs up. The hunter enters any room next to one already cleared, and
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
  /** A room's cell on its floor's plan, from the top left. */
  x?: number;
  y?: number;
  /** A room's floor, from 0 at the entrance's. */
  floor?: number;
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
  /** A dungeon's plan, in cells: the first floor's. */
  cols: number;
  rows: number;
  /** A dungeon's floors, the entrance's first: where each starts and ends, and its plan's size. */
  floors: { start: string; end: string; rows: number; cols: number }[];
}

/**
 * How an open run's map is drawn: a Gate's floors of labyrinth (`labyrinth`). Runs opened before the
 * labyrinths walk the smaller floors they began on (`floors`), runs opened before the floors one floor
 * of rooms (`rooms`), and runs opened before the dungeons the tower they began on (`layers`).
 */
export type Layout = 'labyrinth' | 'floors' | 'rooms' | 'layers';

/** How many floors a Gate goes down, by its grade. */
export const FLOORS: Record<string, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 4 };
export const floorsOf = (d: Dungeon) => (isPractice(d) ? 1 : FLOORS[d.rank] ?? 1);
/** Rooms on each floor's road: a one-floor Gate keeps the old line's length; a deeper one shares a longer road out, at least three to a floor. */
export const floorRoad = (d: Dungeon, floors = floorsOf(d)) => (floors === 1 ? choiceLayers(d) : Math.max(3, Math.round((choiceLayers(d) * 1.4) / floors)));

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
  return { tower: true, layers, nodes, byId: index(layers), start: null, boss: top.id, cols: Math.max(...layers.map((r) => r.length)), rows: layers.length, floors: [] };
};

/** A Trial's map: one of the Chosen to a floor, the last of them its boss. Nothing to choose, and nowhere to rest. */
function trialMap(d: Dungeon): GateMap {
  const n = d.trial ?? 1;
  const layers: MapNode[][] = Array.from({ length: n }, (_, k) => [{
    id: `${k}-0`, n: k, layer: k, kind: k === n - 1 ? 'boss' : 'elite', next: k === n - 1 ? [] : [`${k + 1}-0`],
    foes: [`CHO-${(d.trialFrom ?? 1) + k}-${d.rank}`],
  }]);
  const byId = index(layers);
  return { tower: true, layers, nodes: layers.flat(), byId, start: null, boss: layers[n - 1][0].id, cols: 1, rows: n, floors: [] };
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
/** A labyrinth's side rooms hold rests half as often: a floor of them would otherwise hold its fill. */
const SIDE_LABYRINTH: { kind: NodeKind; w: number }[] = SIDE.map((x) => (x.kind === 'rest' ? { ...x, w: x.w / 2 } : x));
/** Rests are rare: never more than this many on one floor. */
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

/**
 * A labyrinth floor, by the Gate's grade: the rooms on its road, the fewest rooms it holds (its foot
 * and head among them), its plan's columns, how deep its branches go, how many rooms run along in a row
 * on its road, how often rooms side by side are joined again, and how many hidden passages it may hold.
 */
export interface FloorSize { road: number; rooms: number; cols: number; depth: number; along: number; loop: number; passages: number }
export const LABYRINTH: Record<string, FloorSize> = {
  E: { road: 4, rooms: 12, cols: 5, depth: 2, along: 3, loop: 0.25, passages: 1 },
  D: { road: 4, rooms: 14, cols: 5, depth: 3, along: 3, loop: 0.25, passages: 1 },
  C: { road: 4, rooms: 15, cols: 5, depth: 3, along: 3, loop: 0.2, passages: 1 },
  B: { road: 5, rooms: 17, cols: 5, depth: 3, along: 3, loop: 0.2, passages: 1 },
  A: { road: 5, rooms: 20, cols: 6, depth: 4, along: 4, loop: 0.18, passages: 2 },
  S: { road: 6, rooms: 24, cols: 6, depth: 4, along: 4, loop: 0.15, passages: 2 },
};
/**
 * A plan reads cleanly on a phone at six cells across and eight deep: a room's tile is then about 45
 * pixels, its mark and its name still legible. A labyrinth floor is held to that, so it never shrinks
 * below it nor scrolls.
 */
export const PLAN_MAX = { cols: 6, rows: 8 } as const;
/** A labyrinth floor's size, or none: the practice Gate keeps its small first dungeon. */
export const floorSizeOf = (d: Dungeon): FloorSize | null => (isPractice(d) ? null : LABYRINTH[d.rank] ?? null);

/** One floor of a dungeon: where it sits among the floors, its road's length, and whether it holds the Gatekeeper or its vault. */
interface FloorOpts {
  floor: number; floors: number; road: number; keeper: boolean; vault: boolean; prefix: string;
  /** A labyrinth floor's size. Unset, the floor is drawn as the floors before the labyrinths were. */
  size?: FloorSize | null;
  /**
   * Varied: the entrance stands in any column with rooms on every side of it, the plan is turned to
   * run up, down, left or right, and the vault is behind its Gatekeeper. Unset, the one-floor plan of
   * runs opened before the floors: the entrance at the foot's middle, the vault sealed elsewhere.
   */
  vary: boolean;
}

/** Which way a varied plan runs, from its foot to its head. Turned sideways only when it is no wider than the plan's columns. */
const TURNS: { turn: 'up' | 'down' | 'left' | 'right'; w: number }[] = [{ turn: 'up', w: 35 }, { turn: 'down', w: 25 }, { turn: 'left', w: 20 }, { turn: 'right', w: 20 }];
/** A varied plan has up to this many rows of rooms beyond its foot. */
const BEYOND_FOOT = 2;

/** One floor of a Gate: rooms on a grid, joined by corridors, from its foot (the entrance, or stairs up) to its head (the boss, or stairs down). */
function floorPlan(d: Dungeon, seed: string, o: FloorOpts) {
  const r: Rand = rng('arise|plan|' + seed);
  // A varied plan's shape is drawn apart, so the rooms in it are drawn as they always were.
  const rv: Rand = rng('arise|shape|' + seed);
  const practice = isPractice(d);
  // The practice Gate is a first dungeon, made easy: a rest waits in the room before the boss.
  const roadLength = o.road + (practice ? 1 : 0);
  const L = o.size ?? null;
  const cols0 = L ? L.cols : COLS;
  const footX = o.vary ? Math.floor(rv() * cols0) : 2;
  let beyond = o.vary ? Math.floor(rv() * (BEYOND_FOOT + 1)) : 0;
  const nodes: MapNode[] = [];
  const byId: Record<string, MapNode> = {};
  const cells = new Map<string, MapNode>();
  const at = (x: number, y: number) => cells.get(`${x},${y}`);
  const add = (x: number, y: number, kind: NodeKind) => {
    const node: MapNode = { id: `${o.prefix}${nodes.length}`, n: 0, layer: 0, kind, next: [], x, y, floor: o.floor };
    nodes.push(node);
    byId[node.id] = node;
    cells.set(`${x},${y}`, node);
    return node;
  };
  const link = (a: MapNode, b: MapNode) => { a.next.push(b.id); b.next.push(a.id); };

  // The road climbs from the entrance: up, or along, never down, never across itself, never more than two along in a row.
  // A labyrinth's winds: it runs along more often and further, and never climbs past the rows a plan can hold.
  const entrance = add(footX, 0, o.floor === 0 ? 'entrance' : 'up');
  const road: MapNode[] = [];
  let prev = entrance;
  let along = 0;
  let ups = 0;
  for (let i = 0; i < roadLength; i++) {
    const sideways: { dx: number; w: number }[] = [];
    if (i > 0 && along < (L ? L.along : 2)) for (const dx of [-1, 1]) if (!at(prev.x! + dx, prev.y!) && prev.x! + dx >= 0 && prev.x! + dx < cols0) sideways.push({ dx, w: L ? 1.5 : 1 });
    const capped = !!L && ups >= PLAN_MAX.rows - 3 && sideways.length > 0;
    const ways: { dx: number; w: number }[] = [...(capped ? [] : [{ dx: 0, w: 2 }]), ...sideways];
    const { dx } = weighted(ways, r());
    if (!dx) ups++;
    along = dx ? along + 1 : 0;
    const room = add(prev.x! + dx, prev.y! + (dx ? 0 : -1), 'fight');
    link(prev, room);
    road.push(room);
    prev = room;
  }
  const top = Math.min(...road.map((x) => x.y!));
  // A labyrinth's rows beyond its foot never take it past the rows a plan can hold.
  if (L) beyond = Math.min(beyond, PLAN_MAX.rows - 2 + top);
  const boss = add(prev.x!, top - 1, o.floor === o.floors - 1 ? 'boss' : 'down');
  link(prev, boss);

  // Side rooms branch off the road, one or two deep. None is ever beside the boss: its row is its own.
  const depth: Record<string, number> = { [entrance.id]: 0 };
  for (const x of road) depth[x.id] = 0;
  const free = (x: number, y: number) => x >= 0 && x < cols0 && y >= top && y <= beyond && !at(x, y);
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
  let deep = L ? L.depth : 2;
  const growing = (x: MapNode) => (x.kind === 'fight' || x === entrance) && depth[x.id] !== undefined && depth[x.id] < deep;
  const sides: MapNode[] = [];
  // A labyrinth's plan grows to hold its rooms: rows beyond the foot, as many as the plan can take, then deeper branches.
  const roomier = () => {
    if (!L) return false;
    if (2 - top + beyond < PLAN_MAX.rows) { beyond++; return true; }
    if (deep < 8) { deep++; return true; }
    return false;
  };
  if (L) {
    const want = L.rooms - 2 - road.length - (o.keeper ? 1 : 0) - (o.vault ? 1 : 0);
    while (sides.length < want) {
      const room = branch(growing, 'fight');
      if (room) sides.push(room);
      else if (!roomier()) break;
    }
  } else {
    const sideCount = practice ? 2 : Math.round(roadLength * 0.8) + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < sideCount; i++) {
      const room = branch(growing, 'fight');
      if (room) sides.push(room);
    }
  }

  // The Gatekeeper holds the end of a branch, the deeper the better; its vault is sealed somewhere else.
  let keeper: MapNode | null = null;
  let vault: MapNode | null = null;
  if (o.vary) {
    // The vault is behind its Gatekeeper: a room off the Gatekeeper's, reached through it and nowhere else.
    const behind = (x: number, y: number) => DIRS.map(([dx, dy]) => [x + dx, y + dy] as const).filter(([bx, by]) => free(bx, by));
    if (o.keeper) {
      let spots = sprouts((x) => sides.includes(x) && x.next.length === 1).filter((c) => behind(c.x, c.y).length);
      if (!spots.length) spots = sprouts(growing).filter((c) => behind(c.x, c.y).length);
      while (!spots.length && roomier()) spots = sprouts((x) => sides.includes(x) || x === entrance).filter((c) => behind(c.x, c.y).length);
      if (spots.length) {
        const c = spots[Math.floor(r() * spots.length)];
        keeper = add(c.x, c.y, 'elite');
        link(c.parent, keeper);
        depth[keeper.id] = (depth[c.parent.id] ?? 0) + 1;
        const back = behind(keeper.x!, keeper.y!);
        if (o.vault && back.length) {
          const [vx, vy] = back[Math.floor(r() * back.length)];
          vault = add(vx, vy, 'vault');
          link(keeper, vault);
        }
      }
    }
  } else if (o.keeper) keeper = branch((x) => sides.includes(x) && x.next.length === 1, 'elite') ?? branch(growing, 'elite');
  if (!o.vary && o.vault && (keeper || !o.keeper)) {
    // On the Gatekeeper's own floor, as far from it as the floor allows; on another, anywhere.
    const fromKeeper = keeper ? distances(nodes, byId, keeper.id) : null;
    const options = sprouts((x) => x !== keeper && x !== boss);
    const far = fromKeeper ? Math.max(...options.map((c) => fromKeeper[c.parent.id])) : 0;
    const pick = fromKeeper ? options.filter((c) => fromKeeper[c.parent.id] >= far - 1) : options;
    if (pick.length) {
      const c = pick[Math.floor(r() * pick.length)];
      vault = add(c.x, c.y, 'vault');
      link(c.parent, vault);
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
  sides.forEach((x, i) => { x.kind = practice ? (i === 0 ? 'treasure' : 'shrine') : weighted(L ? SIDE_LABYRINTH : SIDE, r()).kind; });
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
    if (r() >= (L ? L.loop : LOOP)) continue;
    link(a, b);
    const now = distances(nodes, byId, entrance.id)[boss.id];
    if (now < roadDist) { a.next.pop(); b.next.pop(); } else roadDist = now;
  }

  // A hidden passage: a wall between two rooms far apart by corridor. A labyrinth may hide more than one.
  for (let k = 0; k < (L ? L.passages : 1); k++) {
    if (practice || r() >= HIDDEN_PASSAGE.chance) continue;
    const far = pairs.filter(([a, b]) => !a.hidden && !b.hidden && !a.next.includes(b.id) && distances(nodes, byId, a.id)[b.id] >= HIDDEN_PASSAGE.apart);
    if (far.length) {
      const [a, b] = far[Math.floor(r() * far.length)];
      a.hidden = [b.id];
      b.hidden = [a.id];
    }
  }

  // Number the rooms from the foot out, as a plan would, and set the head's row at the top.
  const made = new Map(nodes.map((x, i) => [x.id, i]));
  for (const x of nodes) x.next.sort((p, q) => made.get(p)! - made.get(q)!);
  const dist = distances(nodes, byId, entrance.id);
  const order = nodes.slice().sort((a, b) => dist[a.id] - dist[b.id] || b.y! - a.y! || a.x! - b.x!);
  order.forEach((x, i) => { x.n = i; x.layer = dist[x.id]; });
  const bottom = Math.max(...nodes.map((x) => x.y!));
  for (const x of nodes) x.y = x.y! - (top - 1);
  let rows = bottom - (top - 1) + 1;
  let cols = cols0;
  // A varied plan is turned: its head at the top, the bottom, the left or the right.
  if (o.vary) {
    const turns = rows <= cols0 ? TURNS : TURNS.filter((t) => t.turn === 'up' || t.turn === 'down');
    const { turn } = weighted(turns, rv());
    for (const x of nodes) {
      const [px, py] = [x.x!, x.y!];
      if (turn === 'down') x.y = rows - 1 - py;
      else if (turn === 'left') { x.x = py; x.y = px; }
      else if (turn === 'right') { x.x = rows - 1 - py; x.y = px; }
    }
    if (turn === 'left' || turn === 'right') [cols, rows] = [rows, cols0];
  }
  furnish(d, seed, nodes);
  return { nodes, byId, start: entrance, end: boss, rows, cols };
}

/** A Gate as a dungeon: its floors, each a plan of its own, joined by stairs. One floor is the Gate as it always was. */
function dungeon(d: Dungeon, seed: string, floors: number, vary: boolean, size: FloorSize | null = null): GateMap {
  const road = size ? size.road : floorRoad(d, floors);
  // A deeper Gate's Gatekeeper and vault each keep to a floor of their own drawing.
  const pr = rng('arise|plan|' + seed + '|keeper');
  const keeperOn = floors === 1 ? 0 : Math.floor(pr() * floors);
  // Behind its Gatekeeper, the vault keeps to the Gatekeeper's floor; sealed elsewhere, to one of its own.
  const vaultOn = floors === 1 || vary ? keeperOn : Math.floor(pr() * floors);
  const nodes: MapNode[] = [];
  const byId: Record<string, MapNode> = {};
  const plans: GateMap['floors'] = [];
  let prev: MapNode | null = null;
  for (let k = 0; k < floors; k++) {
    const f = floorPlan(d, k === 0 ? seed : `${seed}|${k}`, {
      floor: k, floors, road, keeper: !!d.elite && keeperOn === k, vault: !!d.elite && vaultOn === k, prefix: floors === 1 ? 'r' : `f${k}r`, vary, size,
    });
    const base = nodes.length;
    for (const x of f.nodes) { x.n += base; nodes.push(x); byId[x.id] = x; }
    // The stairs down from the floor above lead to this floor's stairs up.
    if (prev) { prev.next.push(f.start.id); f.start.next.unshift(prev.id); }
    plans.push({ start: f.start.id, end: f.end.id, rows: f.rows, cols: f.cols });
    prev = f.end;
  }
  return { tower: false, layers: [], nodes, byId, start: plans[0].start, boss: plans[floors - 1].end, cols: plans[0].cols, rows: plans[0].rows, floors: plans };
}

/**
 * Draw a Gate's map. A Trial and a block of the Spire are towers; any other Gate is a dungeon of its
 * grade's floors, unless an open run began on a tower or on one floor of rooms.
 */
export function build(d: Dungeon, seed: string, layout: Layout = 'labyrinth'): GateMap {
  if (d.trial) return trialMap(d);
  if (d.floor || layout === 'layers') return layered(d, seed);
  if (layout === 'rooms') return dungeon(d, seed, 1, false);
  if (layout === 'floors') return dungeon(d, seed, floorsOf(d), true);
  return dungeon(d, seed, floorsOf(d), true, floorSizeOf(d));
}

/** The stairs a stairway leads to, on the floor above or below. */
export const across = (m: GateMap, x: MapNode) => (x.kind === 'up' || x.kind === 'down' ? x.next.map((id) => m.byId[id]).find((y) => (y.floor ?? 0) !== (x.floor ?? 0)) ?? null : null);

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
  const out = new Set<string>([m.start!, m.boss, ...m.nodes.filter((x) => x.kind === 'up' || x.kind === 'down').map((x) => x.id), ...remembered, ...cleared]);
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
const SYSTEM_ROAD: NodeKind[] = ['rest', 'fight', 'shrine', 'treasure', 'event', 'trap', 'elite', 'vault', 'entrance', 'up', 'down', 'boss'];
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
