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
import { FONT_SHARE } from '@/data/blessings';
import { landmarkOf, leadFamily } from '@/data/landmarks';
import { EVENTS, type NodeKind } from '@/data/nodes';
import { enemyById, isPractice } from './gates';
import { powerOf } from './combat';
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
  /** The event drawn for an event node, or a landmark's own. */
  event?: string;
  /**
   * The later plans' (`labyrinth2`): a room's corridors from the System's road (0 on it), the third of its
   * floor it lies in from the foot (0 to 2), and whether it is the floor's first fight, held by one creature.
   */
  off?: number;
  band?: number;
  threshold?: boolean;
  /** Deep: two corridors or more off the road, behind a Gatekeeper, behind a hidden passage or a toll door. A cache finds at the Gate's own grade, a fight banks more. */
  deep?: boolean;
  /** A room behind a hidden passage and nothing else: found only when the passage is. */
  secret?: boolean;
  /** A room in a Gatekeeper's wing: reached through the Gatekeeper's room alone. The Gatekeeper's id. */
  wing?: string;
  /** The rooms its toll doors lead to, both ways: a sealed corridor that opens when its toll is paid. */
  toll?: string[];
  /** A landmark's family. */
  landmark?: string;
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
  /** The later plans' (`labyrinth2`): a hidden passage opens only when it is noticed or charted. */
  secrets?: boolean;
}

/**
 * What a run has opened on its map beyond its corridors: the hidden passages it noticed (`notice`, asked of
 * each passage with a cleared room at either end), every passage at once once the map is charted, and the
 * toll doors it paid for, by `pairKey`.
 */
export interface Openings { notice?: (a: string, b: string) => boolean; charted?: boolean; tolls?: ReadonlySet<string> }

/** Two rooms joined by a passage or a toll door, as one key, the same either way round. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * How an open run's map is drawn: a Gate's floors of labyrinth with landmarks, secrets, Gatekeepers' wings,
 * toll doors and gradients (`labyrinth2`). Runs opened before them walk the plain labyrinths (`labyrinth`), runs opened before the
 * labyrinths walk the smaller floors they began on (`floors`), runs opened before the floors one floor
 * of rooms (`rooms`), and runs opened before the dungeons the tower they began on (`layers`).
 */
export type Layout = 'labyrinth2' | 'labyrinth' | 'floors' | 'rooms' | 'layers';

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
      // The practice Gate's fights are one or two creatures: a first dungeon is not lost. On the later
      // plans, fights grow toward the floor's head and on every floor down, and a floor opens on one creature.
      const band = x.band;
      const span = band === undefined ? null : x.threshold ? [1, 1] : [Math.min(3, GRADIENT.lo[band] + (x.floor ?? 0)), Math.min(3, GRADIENT.hi[band] + (x.floor ?? 0))];
      const count = span ? span[0] + Math.floor(rr() * (span[1] - span[0] + 1)) : 1 + Math.floor(rr() * (isPractice(d) ? 2 : 3));
      x.foes = Array.from({ length: count }, () => d.mobs[Math.floor(rr() * d.mobs.length)]);
    } else if (x.kind === 'elite') x.foes = [d.elite!];
    else if (x.kind === 'boss') x.foes = [d.boss];
    else if (x.kind === 'event') x.event = EVENTS[Math.floor(rr() * EVENTS.length)].id;
    else if (x.kind === 'landmark') x.event = landmarkOf(x.landmark ?? '')?.event.id;
    // A shrine is now and then a Font. What either offers is the run's, drawn as the hunter steps in.
    else if (x.kind === 'shrine' && !isPractice(d) && rr() < FONT_SHARE) x.kind = 'font';
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

// ------------------------------------------------------------------ the later plans (labyrinth2)

/** The later plans' fights by the third of the floor they lie in, foot to head: the fewest and the most creatures, before one more for each floor down (to 3). */
export const GRADIENT = { lo: [1, 1, 2], hi: [2, 3, 3] } as const;
/** The road's one odd room, in its middle third: never a rest (a floor's rest is off the road), never a trap before the stairs or the boss. */
const ROAD2: { kind: NodeKind; w: number }[] = [{ kind: 'event', w: 30 }, { kind: 'shrine', w: 26 }, { kind: 'trap', w: 22 }, { kind: 'treasure', w: 22 }];
/** A side room one corridor off the road, and one two or more off it, which hold the finds more often. */
const SIDE2: { kind: NodeKind; w: number }[] = [{ kind: 'fight', w: 34 }, { kind: 'treasure', w: 20 }, { kind: 'event', w: 18 }, { kind: 'trap', w: 16 }, { kind: 'shrine', w: 12 }];
const SIDE_DEEP: { kind: NodeKind; w: number }[] = [{ kind: 'treasure', w: 32 }, { kind: 'fight', w: 24 }, { kind: 'shrine', w: 22 }, { kind: 'event', w: 14 }, { kind: 'trap', w: 8 }];
/** A floor's one rest is drawn this often, by grade, one corridor off the road beside a road room past halfway. */
export const REST_CHANCE: Record<string, number> = { E: 0.3, D: 0.4, C: 0.45, B: 0.5, A: 0.6, S: 0.7 };
/** A Gatekeeper's wing: the rooms behind it before its vault, and what they hold; a rest only at A and S. */
export const WING = { rooms: [1, 3], restFrom: 'A' } as const;
const WING_ROOMS: { kind: NodeKind; w: number }[] = [{ kind: 'treasure', w: 45 }, { kind: 'shrine', w: 25 }, { kind: 'event', w: 20 }, { kind: 'rest', w: 10 }];
/** Gatekeepers on a Gate of these grades: one wing to every two floors. */
export const WINGS: Record<string, number> = { E: 1, D: 1, C: 1, B: 1, A: 2, S: 2 };
/** A secret cache is drawn on this share of floors, in a cell beside at least `beside` rooms, joined to one by a hidden passage. */
export const SECRET_CACHE = { chance: 0.6, beside: 2 } as const;
/** A toll door is drawn on this share of floors: a shortcut between rooms at least `apart` corridors apart, or else the one way into a cache. */
export const TOLL_DOOR = { chance: 0.5, apart: 4 } as const;

/**
 * A floor of the later plans. Drawn as a labyrinth's, then: its Gatekeeper guards a wing of rooms before
 * its vault; its road opens on one creature and holds one odd room, in its middle third; its fights grow
 * toward its head; its side rooms two corridors off the road hold the finds; its one rest, if it has one,
 * sits one corridor off the road past halfway; a landmark of the Gate's leading family stands off the road
 * in its middle third; a secret cache may sit behind a hidden passage, and a toll door seal a shortcut or
 * a cache.
 */
function floorPlan2(d: Dungeon, seed: string, o: FloorOpts & { size: FloorSize }) {
  const r: Rand = rng('arise|plan|' + seed);
  const rv: Rand = rng('arise|shape|' + seed);
  const rk: Rand = rng('arise|plan2|' + seed);
  const L = o.size;
  const cols0 = L.cols;
  const footX = Math.floor(rv() * cols0);
  let beyond = Math.floor(rv() * (BEYOND_FOOT + 1));
  const nodes: MapNode[] = [];
  const byId: Record<string, MapNode> = {};
  const cells = new Map<string, MapNode>();
  const parent: Record<string, string> = {};
  const at = (x: number, y: number) => cells.get(`${x},${y}`);
  const add = (x: number, y: number, kind: NodeKind) => {
    const node: MapNode = { id: `${o.prefix}${nodes.length}`, n: 0, layer: 0, kind, next: [], x, y, floor: o.floor };
    nodes.push(node);
    byId[node.id] = node;
    cells.set(`${x},${y}`, node);
    return node;
  };
  const link = (a: MapNode, b: MapNode) => { a.next.push(b.id); b.next.push(a.id); };

  const entrance = add(footX, 0, o.floor === 0 ? 'entrance' : 'up');
  const road: MapNode[] = [];
  let prev = entrance;
  let along = 0;
  let ups = 0;
  for (let i = 0; i < o.road; i++) {
    const sideways: { dx: number; w: number }[] = [];
    if (i > 0 && along < L.along) for (const dx of [-1, 1]) if (!at(prev.x! + dx, prev.y!) && prev.x! + dx >= 0 && prev.x! + dx < cols0) sideways.push({ dx, w: 1.5 });
    const capped = ups >= PLAN_MAX.rows - 3 && sideways.length > 0;
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
  beyond = Math.min(beyond, PLAN_MAX.rows - 2 + top);
  const boss = add(prev.x!, top - 1, o.floor === o.floors - 1 ? 'boss' : 'down');
  link(prev, boss);

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
    const c = options[Math.floor(r() * options.length)];
    const room = add(c.x, c.y, kind);
    link(c.parent, room);
    parent[room.id] = c.parent.id;
    depth[room.id] = (depth[c.parent.id] ?? 0) + 1;
    return room;
  };
  let deep = L.depth;
  const growing = (x: MapNode) => (x.kind === 'fight' || x === entrance) && depth[x.id] !== undefined && depth[x.id] < deep && !x.wing;
  const sides: MapNode[] = [];
  const roomier = () => {
    if (2 - top + beyond < PLAN_MAX.rows) { beyond++; return true; }
    if (deep < 8) { deep++; return true; }
    return false;
  };
  const want = L.rooms - 2 - road.length - (o.keeper ? 1 : 0) - (o.vault ? 1 : 0);
  while (sides.length < want) {
    const room = branch(growing, 'fight');
    if (room) sides.push(room);
    else if (!roomier()) break;
  }

  // The Gatekeeper at the mouth of a wing: rooms behind it, reached through its room and nowhere else, its vault at the far end.
  let keeper: MapNode | null = null;
  const wing: MapNode[] = [];
  let vault: MapNode | null = null;
  const behind = (x: number, y: number) => DIRS.map(([dx, dy]) => [x + dx, y + dy] as const).filter(([bx, by]) => free(bx, by));
  if (o.keeper) {
    let spots = sprouts((x) => sides.includes(x) && x.next.length === 1).filter((c) => behind(c.x, c.y).length);
    if (!spots.length) spots = sprouts(growing).filter((c) => behind(c.x, c.y).length);
    while (!spots.length && roomier()) spots = sprouts((x) => sides.includes(x) || x === entrance).filter((c) => behind(c.x, c.y).length);
    if (spots.length) {
      const c = spots[Math.floor(r() * spots.length)];
      keeper = add(c.x, c.y, 'elite');
      link(c.parent, keeper);
      parent[keeper.id] = c.parent.id;
      depth[keeper.id] = (depth[c.parent.id] ?? 0) + 1;
      // The wing grows out from the Gatekeeper's room: each room beside the last, or the Gatekeeper's.
      const size = WING.rooms[0] + Math.floor(rk() * (WING.rooms[1] - WING.rooms[0] + 1));
      const into = (from: MapNode[]) => from.flatMap((p) => behind(p.x!, p.y!).map(([x, y]) => ({ p, x, y })));
      for (let k = 0; k < size; k++) {
        const opts = into(wing.length ? [wing[wing.length - 1], keeper] : [keeper]);
        if (!opts.length) break;
        const c2 = opts[Math.floor(rk() * opts.length)];
        const room = add(c2.x, c2.y, 'treasure');
        room.wing = keeper.id;
        link(c2.p, room);
        parent[room.id] = c2.p.id;
        depth[room.id] = depth[c2.p.id] + 1;
        wing.push(room);
      }
      if (o.vault) {
        // The vault at the wing's far end; with no room left for it, the wing's last room is the vault.
        const opts = into([...wing].reverse().concat(keeper));
        if (opts.length) {
          const c2 = opts[0];
          vault = add(c2.x, c2.y, 'vault');
          vault.wing = keeper.id;
          link(c2.p, vault);
          depth[vault.id] = depth[c2.p.id] + 1;
        } else if (wing.length) {
          vault = wing.pop()!;
          vault.kind = 'vault';
        }
      }
    }
  }

  // A second corridor between rooms side by side, now and then, never into a wing, the entrance or the boss, and never one that shortens the road.
  const shut = (x: MapNode) => x === entrance || x === boss || x === keeper || !!x.wing;
  const pairs: [MapNode, MapNode][] = [];
  for (const a of nodes) for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const b = at(a.x! + dx, a.y! + dy);
    if (b && !shut(a) && !shut(b) && !a.next.includes(b.id)) pairs.push([a, b]);
  }
  let roadDist = distances(nodes, byId, entrance.id)[boss.id];
  for (const [a, b] of pairs) {
    if (r() >= L.loop) continue;
    link(a, b);
    const now = distances(nodes, byId, entrance.id)[boss.id];
    if (now < roadDist) { a.next.pop(); b.next.pop(); } else roadDist = now;
  }

  // Where each room lies: its corridors from the road, and the third of the floor it lies in from the foot.
  const fromFoot = distances(nodes, byId, entrance.id);
  const span = Math.max(1, fromFoot[boss.id]);
  const onRoad = new Set([entrance.id, boss.id, ...road.map((x) => x.id)]);
  const fromRoad = (() => {
    const dist: Record<string, number> = {};
    const q = [...onRoad];
    for (const id of q) dist[id] = 0;
    while (q.length) {
      const id = q.shift()!;
      for (const nb of byId[id].next) if (dist[nb] === undefined) { dist[nb] = dist[id] + 1; q.push(nb); }
    }
    return dist;
  })();
  for (const x of nodes) {
    x.off = fromRoad[x.id] ?? 0;
    const t = Math.min(1, (fromFoot[x.id] ?? span) / span);
    x.band = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
    if (x.off >= 2 || x.wing) x.deep = true;
  }

  // What waits in each room. The road opens on one creature and holds one odd room, in its middle third.
  road[0].threshold = true;
  const mids = road.map((_, i) => i).filter((i) => i >= Math.max(1, Math.ceil(road.length / 3)) && i <= Math.floor((2 * road.length) / 3) && i < road.length - 1);
  if (mids.length) {
    const room = road[mids[Math.floor(r() * mids.length)]];
    room.kind = weighted(ROAD2, r()).kind;
  }
  for (const x of sides) x.kind = weighted(x.off! >= 2 ? SIDE_DEEP : SIDE2, r()).kind;
  for (const x of wing) x.kind = weighted(WING_ROOMS.filter((k) => k.kind !== 'rest' || RANKS_FROM(d.rank, WING.restFrom)), rk()).kind;
  // The floor's one rest: one corridor off the road, beside a road room past halfway, where the System steps in as it passes.
  const half = Math.ceil(road.length / 2);
  const restSpots = sides.filter((x) => x.off === 1 && road.findIndex((y) => y.id === parent[x.id]) >= half);
  if (restSpots.length && rk() < (REST_CHANCE[d.rank] ?? 0.4)) restSpots[Math.floor(rk() * restSpots.length)].kind = 'rest';
  // The floor's landmark: off the road, in its middle third, of the family that leads the Gate.
  const family = leadFamily(d.identity ?? '');
  if (landmarkOf(family)) {
    const middle = sides.filter((x) => x.kind !== 'rest' && x.band === 1);
    const pool = middle.length ? middle : sides.filter((x) => x.kind !== 'rest');
    if (pool.length) {
      const lm = pool[Math.floor(rk() * pool.length)];
      lm.kind = 'landmark';
      lm.landmark = family;
    }
  }

  // A hidden passage: a wall between two rooms far apart by corridor; on these plans the hunter must notice it.
  for (let k = 0; k < L.passages; k++) {
    if (r() >= HIDDEN_PASSAGE.chance) continue;
    const far = pairs.filter(([a, b]) => !a.hidden && !b.hidden && !a.next.includes(b.id) && distances(nodes, byId, a.id)[b.id] >= HIDDEN_PASSAGE.apart);
    if (far.length) {
      const [a, b] = far[Math.floor(r() * far.length)];
      a.hidden = [b.id];
      b.hidden = [a.id];
    }
  }
  // A secret cache: a cell with no corridor, beside rooms enough that the plan's shape gives it away, behind a hidden passage.
  const beside = (x: number, y: number) => DIRS.map(([dx, dy]) => at(x + dx, y + dy)).filter((n): n is MapNode => !!n && !shut(n) && n.kind !== 'landmark');
  if (rk() < SECRET_CACHE.chance) {
    const holes: { x: number; y: number }[] = [];
    for (let y = top; y <= beyond; y++) for (let x = 0; x < cols0; x++) if (free(x, y) && beside(x, y).length >= SECRET_CACHE.beside) holes.push({ x, y });
    if (holes.length) {
      const h = holes[Math.floor(rk() * holes.length)];
      const nbs = beside(h.x, h.y);
      const n = nbs[Math.floor(rk() * nbs.length)];
      const room = add(h.x, h.y, 'treasure');
      room.secret = true;
      room.deep = true;
      room.off = (n.off ?? 0) + 1;
      room.band = n.band;
      room.hidden = [n.id];
      n.hidden = [...(n.hidden ?? []), room.id];
    }
  }
  // A toll door: a shortcut between rooms far apart, or else the one way into a cache of its own.
  if (rk() < TOLL_DOOR.chance) {
    const cut = pairs.filter(([a, b]) => !a.next.includes(b.id) && !a.hidden?.includes(b.id) && !a.secret && !b.secret && distances(nodes, byId, a.id)[b.id] >= TOLL_DOOR.apart);
    if (cut.length && rk() < 0.5) {
      const [a, b] = cut[Math.floor(rk() * cut.length)];
      a.toll = [b.id];
      b.toll = [a.id];
    } else {
      const spots = sprouts((x) => !shut(x) && !x.secret && x.kind !== 'landmark' && (x.off ?? 0) >= 1);
      if (spots.length) {
        const c = spots[Math.floor(rk() * spots.length)];
        const room = add(c.x, c.y, 'treasure');
        room.deep = true;
        room.off = (c.parent.off ?? 0) + 1;
        room.band = c.parent.band;
        room.toll = [c.parent.id];
        c.parent.toll = [...(c.parent.toll ?? []), room.id];
      }
    }
  }

  // Number the rooms from the foot out, as a plan would, every way into them counted, and set the head's row at the top.
  const made = new Map(nodes.map((x, i) => [x.id, i]));
  for (const x of nodes) x.next.sort((p, q) => made.get(p)! - made.get(q)!);
  const all = (() => {
    const dist: Record<string, number> = { [entrance.id]: 0 };
    const q = [entrance.id];
    while (q.length) {
      const id = q.shift()!;
      const x = byId[id];
      for (const nb of [...x.next, ...(x.hidden ?? []), ...(x.toll ?? [])]) if (dist[nb] === undefined) { dist[nb] = dist[id] + 1; q.push(nb); }
    }
    return dist;
  })();
  const order = nodes.slice().sort((a, b) => all[a.id] - all[b.id] || b.y! - a.y! || a.x! - b.x!);
  order.forEach((x, i) => { x.n = i; x.layer = all[x.id]; });
  const bottom = Math.max(...nodes.map((x) => x.y!));
  for (const x of nodes) x.y = x.y! - (top - 1);
  let rows = bottom - (top - 1) + 1;
  let cols = cols0;
  const turns = rows <= cols0 ? TURNS : TURNS.filter((t) => t.turn === 'up' || t.turn === 'down');
  const { turn } = weighted(turns, rv());
  for (const x of nodes) {
    const [px, py] = [x.x!, x.y!];
    if (turn === 'down') x.y = rows - 1 - py;
    else if (turn === 'left') { x.x = py; x.y = px; }
    else if (turn === 'right') { x.x = rows - 1 - py; x.y = px; }
  }
  if (turn === 'left' || turn === 'right') [cols, rows] = [rows, cols0];
  furnish(d, seed, nodes);
  return { nodes, byId, start: entrance, end: boss, rows, cols };
}

/** A grade at or above another, E to S. */
const RANKS_FROM = (rank: string, from: string) => 'EDCBAS'.indexOf(rank) >= 'EDCBAS'.indexOf(from);

/** A Gate as a dungeon: its floors, each a plan of its own, joined by stairs. One floor is the Gate as it always was. */
function dungeon(d: Dungeon, seed: string, floors: number, vary: boolean, size: FloorSize | null = null, v2 = false): GateMap {
  const road = size ? size.road : floorRoad(d, floors);
  // A deeper Gate's Gatekeeper and vault each keep to a floor of their own drawing.
  const pr = rng('arise|plan|' + seed + '|keeper');
  const keeperOn = floors === 1 ? 0 : Math.floor(pr() * floors);
  // Behind its Gatekeeper, the vault keeps to the Gatekeeper's floor; sealed elsewhere, to one of its own.
  const vaultOn = floors === 1 || vary ? keeperOn : Math.floor(pr() * floors);
  // On the later plans, an A- or S-Rank Gate has a Gatekeeper's wing to every two floors.
  const wings = new Set([keeperOn]);
  if (v2) {
    const want = Math.min(floors, WINGS[d.rank] ?? 1);
    for (let guard = 0; wings.size < want && guard < 20; guard++) wings.add(Math.floor(pr() * floors));
  }
  const nodes: MapNode[] = [];
  const byId: Record<string, MapNode> = {};
  const plans: GateMap['floors'] = [];
  let prev: MapNode | null = null;
  for (let k = 0; k < floors; k++) {
    const opts = { floor: k, floors, road, keeper: !!d.elite && (v2 ? wings.has(k) : keeperOn === k), vault: !!d.elite && (v2 ? wings.has(k) : vaultOn === k), prefix: floors === 1 ? 'r' : `f${k}r`, vary, size };
    const f = v2 && size ? floorPlan2(d, k === 0 ? seed : `${seed}|${k}`, { ...opts, size }) : floorPlan(d, k === 0 ? seed : `${seed}|${k}`, opts);
    const base = nodes.length;
    for (const x of f.nodes) { x.n += base; nodes.push(x); byId[x.id] = x; }
    // The stairs down from the floor above lead to this floor's stairs up.
    if (prev) { prev.next.push(f.start.id); f.start.next.unshift(prev.id); }
    plans.push({ start: f.start.id, end: f.end.id, rows: f.rows, cols: f.cols });
    prev = f.end;
  }
  return { tower: false, layers: [], nodes, byId, start: plans[0].start, boss: plans[floors - 1].end, cols: plans[0].cols, rows: plans[0].rows, floors: plans, ...(v2 && size ? { secrets: true } : {}) };
}

/**
 * Draw a Gate's map. A Trial and a block of the Spire are towers; any other Gate is a dungeon of its
 * grade's floors, unless an open run began on a tower or on one floor of rooms.
 */
export function build(d: Dungeon, seed: string, layout: Layout = 'labyrinth2'): GateMap {
  if (d.trial) return trialMap(d);
  if (d.floor || layout === 'layers') return layered(d, seed);
  if (layout === 'rooms') return dungeon(d, seed, 1, false);
  if (layout === 'floors') return dungeon(d, seed, floorsOf(d), true);
  return dungeon(d, seed, floorsOf(d), true, floorSizeOf(d), layout === 'labyrinth2');
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

/**
 * The hidden passages that have opened: those with a cleared room at either end; on the later plans, only
 * those the run noticed, or every one once the map is charted.
 */
export function passages(m: GateMap, cleared: Set<string>, o: Openings = {}): [string, string][] {
  const out: [string, string][] = [];
  for (const x of m.nodes) for (const y of x.hidden ?? []) {
    if (x.id < y && (cleared.has(x.id) || cleared.has(y)) && (!m.secrets || o.charted || !!o.notice?.(x.id, y))) out.push([x.id, y]);
  }
  return out;
}

/** Every toll door on the map, each once. */
export function tollDoors(m: GateMap): [string, string][] {
  const out: [string, string][] = [];
  for (const x of m.nodes) for (const y of x.toll ?? []) if (x.id < y) out.push([x.id, y]);
  return out;
}

/** The toll doors the run has paid for, open for good. */
export const tollsOpen = (m: GateMap, o: Openings = {}) => tollDoors(m).filter(([a, b]) => !!o.tolls?.has(pairKey(a, b)));

/** Every way out of a room beyond its corridors that stands open: its passages opened and its toll doors paid. */
function opened(m: GateMap, cleared: Set<string>, o: Openings): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (a: string, b: string) => { out.set(a, [...(out.get(a) ?? []), b]); out.set(b, [...(out.get(b) ?? []), a]); };
  for (const [a, b] of passages(m, cleared, o)) add(a, b);
  for (const [a, b] of tollsOpen(m, o)) add(a, b);
  return out;
}

/**
 * What a dungeon's walker can see through the fog: the entrance, the boss's room and every landmark, every
 * room cleared and every room next to one, by corridor, an opened passage or a toll door (sealed or not),
 * and whatever is remembered of the map. Corridors are never fogged; a room behind a hidden passage shows
 * only once it has opened. A tower has no fog.
 */
export function sight(m: GateMap, cleared: Set<string>, remembered: Iterable<string> = [], o: Openings = {}): Set<string> {
  if (m.tower) return new Set(m.nodes.map((x) => x.id));
  const out = new Set<string>([m.start!, m.boss, ...m.nodes.filter((x) => x.kind === 'landmark').map((x) => x.id), ...remembered, ...cleared]);
  for (const id of cleared) for (const nb of [...(m.byId[id]?.next ?? []), ...(m.byId[id]?.toll ?? [])]) out.add(nb);
  for (const [a, b] of passages(m, cleared, o)) { out.add(a); out.add(b); }
  return out;
}

/** The rooms a dungeon's walker can enter: any not yet cleared next to one that is, by corridor, an opened passage or a paid toll door. */
export function reach(m: GateMap, cleared: Set<string>, o: Openings = {}): MapNode[] {
  const open = unsealed(m, cleared);
  const extra = opened(m, cleared, o);
  const out = new Set<string>();
  for (const id of cleared) {
    const x = m.byId[id];
    if (!x) continue;
    for (const nb of [...x.next, ...(extra.get(id) ?? [])]) if (!cleared.has(nb) && (m.byId[nb].kind !== 'vault' || open)) out.add(nb);
  }
  return m.nodes.filter((x) => out.has(x.id));
}

/** The order the System prefers its steps in: fight its way through, rest when it can, and leave the gambles alone. */
const SYSTEM_ROAD: NodeKind[] = ['rest', 'fight', 'shrine', 'treasure', 'event', 'trap', 'landmark', 'elite', 'vault', 'entrance', 'up', 'down', 'boss'];
/** A Font is a shrine's, to the System: the road it walks is the one it walked before Fonts. */
const placeIn = (k: NodeKind) => SYSTEM_ROAD.indexOf(k === 'font' ? 'shrine' : k);
const preference = (a: MapNode, b: MapNode) => placeIn(a.kind) - placeIn(b.kind);

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

/** A step of the System's way: a room entered, or a rest it has found used. */
export type WalkStep = { enter: string } | { rest: string };

/**
 * The System's whole way through a Gate, step by step: what the brief assesses, Auto follows and the clock
 * counts. Its road (`systemRoad`), and on the later plans a step into each rest one corridor off it, as it
 * passes the road room beside it. A rest found on the boss's floor is kept for the boss, and used before it;
 * one on a floor above is used at once. On the plans before (`labyrinth` and older), every rest it finds is
 * kept for the boss. Up a tower, its road alone: a tower's rest waits on it as it climbs.
 */
export function systemWalk(m: GateMap): WalkStep[] {
  const road = systemRoad(m);
  if (m.tower) return road.map((id) => ({ enter: id }));
  const onRoad = new Set([m.start!, ...road]);
  const bossFloor = m.byId[m.boss].floor ?? 0;
  const steps: WalkStep[] = [];
  const entered = new Set<string>();
  let kept: string[] = [];
  const found = (y: MapNode) => {
    if (!m.secrets || (y.floor ?? 0) === bossFloor) kept.push(y.id);
    else steps.push({ rest: y.id });
  };
  for (const id of road) {
    const x = m.byId[id];
    if (x.kind === 'boss') { for (const k of kept) steps.push({ rest: k }); kept = []; }
    steps.push({ enter: id });
    entered.add(id);
    if (x.kind === 'rest') found(x);
    if (!m.secrets) continue;
    for (const nb of x.next) {
      const y = m.byId[nb];
      if (y.kind !== 'rest' || onRoad.has(nb) || entered.has(nb)) continue;
      steps.push({ enter: nb });
      entered.add(nb);
      found(y);
    }
  }
  return steps;
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

/** A creature in a fight is marked strong when its power is this far above the mean of the Gate's fighting creatures. */
export const STRONG = 1.1;

/**
 * Who waits in each fight on the map, as the plan marks it once the room is seen: a pip to each
 * creature, and the strong ones marked, against the mean power of every creature the map's fights hold.
 */
export function threatOf(m: GateMap): (x: MapNode) => { n: number; strong: number } {
  const power = (id: string) => { const e = enemyById(id); return e ? powerOf(e.base) : 0; };
  const kinds = [...new Set(m.nodes.filter((x) => x.kind === 'fight').flatMap((x) => x.foes ?? []))];
  const mean = kinds.length ? kinds.reduce((n, id) => n + power(id), 0) / kinds.length : 0;
  return (x) => ({ n: x.foes?.length ?? 0, strong: (x.foes ?? []).filter((id) => power(id) >= mean * STRONG).length });
}
