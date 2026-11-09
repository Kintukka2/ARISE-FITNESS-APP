/**
 * What the map generator draws: every Gate of each grade over a run of days, measured, so the shape
 * of the labyrinths is read as numbers rather than guessed from a few screenshots.
 *
 *   npm run mapstats              20 days of maps
 *   npm run mapstats -- 40        40 days
 *
 * Shape, per grade (mean, with the least and the most seen):
 *   rooms         rooms on the map, a floor's stairs down and up counted as one
 *   road          moves along the System's road, entrance to boss
 *   dead ends     rooms with one corridor, the entrance's and the boss's aside
 *   loops         corridors beyond a tree's (corridors - rooms + 1), hidden passages aside
 *   passages      hidden passages
 *   reach         the most corridors any room lies from the road
 *   see all       moves to enter every room, walking always to the nearest not yet entered
 *   at 120%       the share of rooms entered that way within a budget of 120% of the rooms
 * Contents:
 *   road odd      road rooms that are not fights (the entrance, stairs and boss aside)
 *   rests         rests on the road and off it, per map
 *   foes          creatures per fight, on the road and off it
 *   strong        fights holding a creature the plan marks strong (`threatOf` in core/map.ts)
 * Cost of a side fight, for a typical hunter in the middle of the grade, each fight entered at full
 * health with the party the board sends, after the healing every won fight brings:
 *   free          side fights that cost the hunter nothing
 *   cost          the hunter's HP lost, as a share of the maximum (mean, and the worst seen)
 */
import { ALL_DUNGEONS, isPractice } from '@/core/gates';
import { build, mapSeed, systemRoad, threatOf, type GateMap, type MapNode } from '@/core/map';
import { chamberAt, partySpecs, runChamber } from '@/core/raid';
import { Unit } from '@/core/combat';
import type { Rank } from '@/core/types';
import { LEVELS, typicalHunter } from './hunters';

const DAYS = Number(process.argv[2] ?? 20);
const NOW = Date.UTC(2026, 9, 1, 12);
const days = Array.from({ length: DAYS }, (_, i) => new Date(NOW + i * 864e5).toISOString().slice(0, 10));

/** The map as a graph of places: a floor's stairs up are reached the moment its stairs down are taken, so they are one. */
function graphOf(m: GateMap) {
  const rep = (id: string): string => {
    const x = m.byId[id];
    if (x.kind !== 'up') return id;
    return x.next.find((n) => m.byId[n].kind === 'down' && (m.byId[n].floor ?? 0) !== (x.floor ?? 0)) ?? id;
  };
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const x of m.nodes) {
    if (!adj.has(rep(x.id))) adj.set(rep(x.id), new Set());
    for (const n of x.next) link(rep(x.id), rep(n));
  }
  const bfs = (from: string[]) => {
    const dist = new Map(from.map((f) => [f, 0]));
    const q = [...from];
    while (q.length) {
      const c = q.shift()!;
      for (const n of adj.get(c)!) if (!dist.has(n)) { dist.set(n, dist.get(c)! + 1); q.push(n); }
    }
    return dist;
  };
  return { rep, adj, bfs };
}

/** Moves to enter rooms, always walking to the nearest not yet entered, until every room is entered or the budget is spent. */
function walk(g: ReturnType<typeof graphOf>, start: string, budget = Infinity) {
  const seen = new Set([start]);
  let at = start;
  let spent = 0;
  for (;;) {
    const dist = g.bfs([at]);
    let best: string | null = null;
    let bd = Infinity;
    for (const id of g.adj.keys()) if (!seen.has(id) && dist.get(id)! < bd) { bd = dist.get(id)!; best = id; }
    if (!best || spent + bd > budget) break;
    spent += bd;
    at = best;
    seen.add(best);
  }
  return { spent, seen: seen.size };
}

interface Row {
  rooms: number; road: number; deadEnds: number; loops: number; passages: number; reach: number; seeAll: number; within: number;
  roadOdd: number; restsOn: number; restsOff: number; foesOn: number[]; foesOff: number[]; strong: number; fights: number;
}

function measure(m: GateMap): Row {
  const g = graphOf(m);
  const start = g.rep(m.start!);
  const roadIds = systemRoad(m);
  const on = new Set([start, ...roadIds.map(g.rep)]);
  const places = [...g.adj.keys()];
  const edges = places.reduce((n, id) => n + g.adj.get(id)!.size, 0) / 2;
  const fromRoad = g.bfs([...on]);
  const end = (id: string) => ['entrance', 'boss'].includes(m.byId[id].kind);
  const fights = m.nodes.filter((x) => x.kind === 'fight');
  const threat = threatOf(m);
  const onRoad = (x: MapNode) => on.has(g.rep(x.id));
  return {
    rooms: places.length,
    road: on.size - 1,
    deadEnds: places.filter((id) => g.adj.get(id)!.size === 1 && !end(id)).length,
    loops: edges - places.length + 1,
    passages: m.nodes.reduce((n, x) => n + (x.hidden?.length ?? 0), 0) / 2,
    reach: Math.max(...places.map((id) => fromRoad.get(id) ?? 0)),
    seeAll: walk(g, start).spent,
    within: walk(g, start, Math.round(1.2 * places.length)).seen / places.length,
    roadOdd: roadIds.map((id) => m.byId[id]).filter((x) => !['fight', 'boss', 'down', 'up', 'entrance'].includes(x.kind)).length,
    restsOn: m.nodes.filter((x) => x.kind === 'rest' && onRoad(x)).length,
    restsOff: m.nodes.filter((x) => x.kind === 'rest' && !onRoad(x)).length,
    foesOn: fights.filter(onRoad).map((x) => x.foes?.length ?? 0),
    foesOff: fights.filter((x) => !onRoad(x)).map((x) => x.foes?.length ?? 0),
    strong: fights.filter((x) => threat(x).strong > 0).length,
    fights: fights.length,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const span = (xs: number[], dp = 0) => `${avg(xs).toFixed(dp)} (${Math.min(...xs).toFixed(dp)}-${Math.max(...xs).toFixed(dp)})`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

console.log(`Map statistics: every Gate of each grade over ${DAYS} days' maps, the labyrinth layout.\n`);
console.log('grade  maps  rooms         road          dead ends     loops          passages       reach       see all          at 120%');
const all: Record<string, Row[]> = {};
for (const r of ['E', 'D', 'C', 'B', 'A', 'S'] as Rank[]) {
  const rows: Row[] = [];
  for (const d of ALL_DUNGEONS.filter((x) => x.rank === r && !isPractice(x))) for (const day of days) rows.push(measure(build(d, mapSeed(d, day))));
  all[r] = rows;
  const col = (k: keyof Row, w: number, dp = 0) => span(rows.map((x) => x[k] as number), dp).padEnd(w);
  console.log(`  ${r}    ${String(rows.length).padEnd(5)} ${col('rooms', 14)}${col('road', 14)}${col('deadEnds', 14)}${col('loops', 15, 1)}${col('passages', 15, 1)}${col('reach', 12)}${col('seeAll', 17)}${pct(avg(rows.map((x) => x.within)))}`);
}

console.log('\ngrade  road odd    rests on road  rests off road  foes on road  foes off road  fights with a strong creature');
for (const r of Object.keys(all)) {
  const rows = all[r];
  const fights = rows.reduce((n, x) => n + x.fights, 0);
  console.log(`  ${r}    ${avg(rows.map((x) => x.roadOdd)).toFixed(1).padEnd(12)}${avg(rows.map((x) => x.restsOn)).toFixed(2).padEnd(15)}${avg(rows.map((x) => x.restsOff)).toFixed(2).padEnd(16)}${avg(rows.flatMap((x) => x.foesOn)).toFixed(2).padEnd(14)}${avg(rows.flatMap((x) => x.foesOff)).toFixed(2).padEnd(15)}${pct(rows.reduce((n, x) => n + x.strong, 0) / Math.max(1, fights))}`);
}

// What a side fight costs: each entered at full health, the healing every won fight brings counted.
console.log('\nA side fight, for a typical hunter in the middle of the grade, entered at full health (healing after a won fight counted):');
console.log('grade  side fights  free   cost (mean)  cost (worst)  lost');
for (const r of Object.keys(all) as Rank[]) {
  const s = typicalHunter(LEVELS[r][1], r, `mapstats|${r}`);
  const costs: number[] = [];
  let lost = 0;
  for (const d of ALL_DUNGEONS.filter((x) => x.rank === r && !isPractice(x))) {
    for (const day of days.slice(0, Math.min(DAYS, 8))) {
      const m = build(d, mapSeed(d, day));
      const g = graphOf(m);
      const on = new Set([g.rep(m.start!), ...systemRoad(m).map(g.rep)]);
      for (const x of m.nodes.filter((n) => n.kind === 'fight' && !on.has(g.rep(n.id)))) {
        const party = partySpecs(s, d, day, undefined, NOW).map((sp) => new Unit(sp));
        const hero = party[0];
        const res = runChamber(d, `mapstats|${day}`, x.n, party, chamberAt(d, x));
        if (!res.won) { lost++; continue; }
        costs.push(Math.max(0, (hero.maxHp - hero.hp) / hero.maxHp));
      }
    }
  }
  const n = costs.length + lost;
  console.log(`  ${r}    ${String(n).padEnd(13)}${pct(costs.filter((c) => c === 0).length / Math.max(1, n)).padEnd(7)}${pct(avg(costs)).padEnd(13)}${pct(Math.max(0, ...costs)).padEnd(14)}${lost}`);
}
