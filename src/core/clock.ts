/**
 * The Gate clock. A Gate gives a run a budget of moves: entering a room is one, and so is every corridor
 * walked back through rooms already cleared, the shortest way. Past the budget the Gate stirs: every
 * creature not yet fought, and the boss, is a share stronger for each move over. At `CLOCK.red` moves
 * over, it turns red: they fight as if `CLOCK.grades` grades above the rank the hunter walked in with, and
 * the way out seals until the boss falls. Towers (the Pale Spire's blocks, the Trials) and the Practice
 * Gate have no clock.
 *
 * A floor's stairs down and the stairs up they lead to are one place: taking them is one move, and walking
 * back across them costs nothing more. The budget is counted on those places, as `npm run mapstats` counts
 * a Gate's rooms. Nothing here reads a roll or the clock on the wall.
 */
import { across, passages, systemWalk, tollsOpen, type GateMap, type Openings } from './map';
import { rankIdx } from './gates';
import { RANKS } from './types';

export const CLOCK = {
  /** The budget, as a share of the Gate's rooms. */
  budget: 1.2,
  /**
   * How much stronger every creature not yet fought grows for each move past the budget. Measured, every
   * fight on the System's road 10% stronger costs a typical hunter 8 to 22 points of the clear rate.
   */
  stir: 0.01,
  /** Moves past the budget at which the Gate turns red. */
  red: 20,
  /** In a Red Gate, creatures fight as if this many grades above the hunter's rank. */
  grades: 3,
  /**
   * How much stronger each grade is than the one below: a typical hunter's party at the middle of each
   * grade, its HP times its hit, grows about half again from grade to grade (1.49 measured, E to S).
   */
  step: 1.5,
} as const;

/** The map as places: a floor's stairs up stand for the stairs down that lead to them. */
export function placeOf(m: GateMap): (id: string) => string {
  return (id: string) => {
    const x = m.byId[id];
    if (!x || x.kind !== 'up') return id;
    return x.next.find((n) => m.byId[n]?.kind === 'down' && (m.byId[n].floor ?? 0) !== (x.floor ?? 0)) ?? id;
  };
}

/** How many places a Gate's map has: its rooms, a floor's stairs down and up counted as one. Zero for a tower. */
export function placesOf(m: GateMap): number {
  if (m.tower) return 0;
  const rep = placeOf(m);
  return new Set(m.nodes.map((x) => rep(x.id))).size;
}

/** A Gate's budget of moves, from its map. Zero for a tower. */
export const budgetOf = (m: GateMap) => (m.tower ? 0 : Math.round(CLOCK.budget * placesOf(m)));

/**
 * The fewest moves from one room to every place it can be walked to: through rooms cleared, by corridor
 * or an opened passage, with a floor's stairs as one place, and one step on into any room not yet cleared
 * beside them. Keyed by place (`placeOf`); the room it starts in is 0.
 */
export function walksFrom(m: GateMap, cleared: Set<string>, from: string, o: Openings = {}): Map<string, number> {
  const rep = placeOf(m);
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const ra = rep(a), rb = rep(b);
    if (ra === rb) return;
    if (!adj.has(ra)) adj.set(ra, new Set());
    if (!adj.has(rb)) adj.set(rb, new Set());
    adj.get(ra)!.add(rb);
    adj.get(rb)!.add(ra);
  };
  for (const x of m.nodes) for (const n of x.next) link(x.id, n);
  for (const [a, b] of passages(m, cleared, o)) link(a, b);
  for (const [a, b] of tollsOpen(m, o)) link(a, b);
  // Only cleared places are walked through; a room not yet cleared is where a walk ends.
  const walkable = new Set([...cleared].map(rep));
  const start = rep(from);
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const c = q.shift()!;
    for (const n of adj.get(c) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(c)! + 1);
      if (walkable.has(n)) q.push(n);
    }
  }
  return dist;
}

/**
 * The fewest moves from one room to another (`walksFrom`). `to` may be a room not yet cleared, entered
 * from one that is. Infinity if there is no way; 0 if they are the same place.
 */
export const walkMoves = (m: GateMap, cleared: Set<string>, from: string, to: string, o: Openings = {}) => walksFrom(m, cleared, from, o).get(placeOf(m)(to)) ?? Infinity;

/** Where a run stands on its clock. */
export interface ClockState {
  budget: number;
  moves: number;
  /** Moves left in the budget. */
  left: number;
  /** Moves past it. */
  over: number;
  /** How much stronger every creature not yet fought is, as a share: 0.06 is 6%. */
  stir: number;
  /** Moves past the budget before the Gate turns red; 0 once it has. */
  toRed: number;
  red: boolean;
}

/** A clock with this budget, this many moves walked. */
export function clockAt(budget: number, moves: number): ClockState {
  const over = Math.max(0, moves - budget);
  return { budget, moves, left: Math.max(0, budget - moves), over, stir: Math.round(over * CLOCK.stir * 1000) / 1000, toRed: Math.max(0, CLOCK.red - over), red: over >= CLOCK.red };
}

/** A rank's grade, from E at 0: Sovereign stands a grade past S. */
const gradeOf = (rank: string) => (rank === 'N' ? RANKS.length : Math.max(0, rankIdx(rank)));

/** How many grades a Red Gate raises a Gate's creatures by, for a hunter of `held` rank: to `CLOCK.grades` above it. */
export const redGrades = (gate: string, held: string) => Math.max(0, gradeOf(held) + CLOCK.grades - gradeOf(gate));

/**
 * How strong a creature not yet fought is on this clock, against its Gate as tuned: the stirring's share
 * on top, and in a Red Gate `CLOCK.step` for each grade it is raised by.
 */
export function mightOf(c: ClockState, gate: string, held: string): number {
  return (1 + c.stir) * (c.red ? CLOCK.step ** redGrades(gate, held) : 1);
}

/**
 * The moves the System's way through a Gate takes (`map.systemWalk`): its road, room by room, the steps
 * into the rests beside it, and before the boss the walk back to a rest it kept. What Auto, the brief and
 * calibration walk. Zero for a tower.
 */
export function systemMoves(m: GateMap): number {
  if (m.tower) return 0;
  const done = new Set([m.start!]);
  let at = m.start!;
  let moves = 0;
  for (const step of systemWalk(m)) {
    const id = 'enter' in step ? step.enter : step.rest;
    moves += walkMoves(m, done, at, id);
    at = id;
    if (!('enter' in step)) continue;
    done.add(id);
    const x = m.byId[id];
    const below = across(m, x);
    if (x.kind === 'down' && below) { done.add(below.id); at = below.id; }
  }
  return moves;
}
