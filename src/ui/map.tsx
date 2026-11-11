/**
 * A Gate's map. A dungeon is drawn as its plan, a floor at a time: rooms on a grid, joined by
 * corridors, the entrance (or stairs up) at the foot and the boss (or stairs down) at the head, every
 * other room in the fog until it is seen. A tower is drawn
 * floor by floor. Read-only in the brief; in the arena, the rooms the hunter can enter glow, and a
 * cleared room can be walked back to. On the Gate clock, every room the hunter can enter or walk to shows
 * what it costs in moves; past the budget the plan stirs, and a Red Gate's plan is red, its entrance sealed.
 */
import { across, passages, threatOf, unsealed, type GateMap, type MapNode } from '@/core/map';
import { HIDDEN, HIDDEN_IN_ROOMS, NODE, type NodeKind } from '@/data/nodes';
import type { ComponentChildren } from 'preact';
import { sfx } from '@/audio/audio';
import { Glyph } from './icons';

interface MapProps {
  m: GateMap;
  /** Steps chosen, and how many of them are done. */
  path?: string[];
  at?: number;
  /** Where the walker can step now. Tappable, with `onPick`. */
  options?: string[];
  /** A road to mark: the one the System assessed. */
  road?: string[];
  onPick?: (id: string) => void;
  /** A dungeon: the room the hunter stands in, the rests used, and walking back to a cleared room. */
  pos?: string;
  rested?: string[];
  onWalk?: (id: string) => void;
  /** A dungeon: the rooms seen through the fog. Unset, every room is seen. */
  seen?: Set<string>;
  /** A dungeon of floors: the floor to draw (the hunter's, unset), and choosing another, which shows the floors as tabs. */
  floor?: number;
  onFloor?: (k: number) => void;
  /** Set at the plan's top right: the Gate Survey, while one can be used. */
  corner?: ComponentChildren;
  compact?: boolean;
  /** On the Gate clock: the moves to enter or walk to each room the hunter can, by id. */
  costs?: Record<string, number>;
  /** On the Gate clock: how far the Gate has stirred, 0 to 1 on the way to red, and whether it has turned. */
  stir?: number;
  red?: boolean;
  /** Inside a run: the name of each shrine's Path, shown on it once it is seen. */
  shrinePath?: (x: MapNode) => string | undefined;
}

export function MapView(p: MapProps) {
  if (!p.m.tower) return <RoomsView {...p} />;
  if (!p.corner) return <TowerView {...p} />;
  // A tower's corner sits over it, as a dungeon's does.
  return (
    <div class={`dmapwrap ${p.compact ? 'is-compact' : ''}`}>
      <div class="dmap__bar"><span aria-hidden="true" /><span aria-hidden="true" /><span class="dmap__corner">{p.corner}</span></div>
      <TowerView {...p} />
    </div>
  );
}

/** A dungeon's plan: one floor of it, the hunter's or the one asked for. */
function RoomsView({ m, path = [], at = 0, options = [], road = [], onPick, pos, rested = [], onWalk, seen, floor, onFloor, corner, compact, costs, stir = 0, red = false, shrinePath }: MapProps) {
  const done = new Set([m.start!, ...path.slice(0, at)]);
  const entered = new Set(path);
  const open = unsealed(m, done);
  const here = pos ? m.byId[pos] : null;
  const floors = Math.max(1, m.floors.length);
  const f = Math.min(floors - 1, floor ?? here?.floor ?? 0);
  const on = (x: MapNode) => (x.floor ?? 0) === f;
  const rows = m.floors[f]?.rows ?? m.rows;
  const cols = m.floors[f]?.cols ?? m.cols;
  const way = [m.start!, ...road];
  const onRoad = (a: string, b: string) => {
    const i = way.indexOf(a);
    const j = way.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  };
  const cx = (x: MapNode) => x.x! * 10 + 5;
  const cy = (x: MapNode) => x.y! * 10 + 5;
  const rooms = m.nodes.filter(on);
  const halls: [MapNode, MapNode][] = [];
  for (const x of rooms) for (const id of x.next) if (x.id < id && on(m.byId[id])) halls.push([x, m.byId[id]]);
  const secret = passages(m, done).map(([x, y]) => [m.byId[x], m.byId[y]] as const).filter(([x]) => on(x));
  // What the plan shows of a room: a trap, a cache or a rest passes for an Event until the hunter has stood in it.
  const looksOf = (x: MapNode): NodeKind => (HIDDEN_IN_ROOMS.has(x.kind) && !entered.has(x.id) ? 'event' : x.kind);
  // A room not yet seen is fog: where it lies and its corridors show, nothing of what is in it.
  const fogged = (x: MapNode) => !!seen && !seen.has(x.id);
  const shown = [...new Set(rooms.filter((x) => !fogged(x)).map(looksOf))].filter((k) => k !== 'entrance' && k !== 'up');
  const fogs = rooms.some(fogged);
  const threat = threatOf(m);
  return (
    <div class={`dmapwrap ${compact ? 'is-compact' : ''} ${red ? 'is-red' : stir > 0 ? 'is-stir' : ''}`} style={stir > 0 && !red ? { '--stir': stir } as Record<string, number> : undefined}>
      {(floors > 1 || corner) && (
        <div class="dmap__bar">
          <span aria-hidden="true" />
          {floors > 1 ? (
            <div class="dmap__floors" role={onFloor ? 'tablist' : undefined} aria-label="Floors">
              {onFloor
                ? Array.from({ length: floors }, (_, k) => (
                  <button type="button" key={k} role="tab" aria-selected={k === f} class={`dmap__floor ${k === f ? 'is-on' : ''}`} onClick={() => { sfx.tap(); onFloor(k); }}>Floor {k + 1}</button>
                ))
                : <span class="dmap__floor is-on">Floor <b class="num">{f + 1}/{floors}</b></span>}
            </div>
          ) : <span aria-hidden="true" />}
          <span class="dmap__corner">{corner}</span>
        </div>
      )}
      <div class={`dmap ${compact ? 'dmap--compact' : ''}`} style={{ '--cols': cols, '--rows': rows } as Record<string, number>} role="group" aria-label={floors > 1 ? `Map of the Gate, floor ${f + 1} of ${floors}` : 'Map of the Gate'}>
        <svg class="dmap__halls" viewBox={`0 0 ${cols * 10} ${rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
          {/* A corridor is drawn twice: its walls, then its floor between them. */}
          {[...halls.map(([x, y]) => [x, y, done.has(x.id) && done.has(y.id) ? 'is-walked' : (done.has(x.id) || done.has(y.id)) && !compact ? 'is-near' : ''] as const),
            ...secret.map(([x, y]) => [x, y, 'is-hidden'] as const)].map(([x, y, lit]) => (
            <g key={`${x.id}-${y.id}`} class={`dmap__hall ${lit}`}>
              <line class="dmap__wall" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} />
              <line class="dmap__floor" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} />
            </g>
          ))}
          {road.length > 0 && halls.filter(([x, y]) => onRoad(x.id, y.id)).map(([x, y]) => (
            <line key={`r${x.id}-${y.id}`} class="dmap__trail" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} vector-effect="non-scaling-stroke" />
          ))}
        </svg>
        {rooms.map((x) => {
          const style = { gridColumn: x.x! + 1, gridRow: x.y! + 1 };
          if (fogged(x)) {
            return (
              <span key={x.id} class="gnode droom is-fog" style={style} title="Unseen" aria-label="Unseen room">
                <Glyph name="unknown" />{!compact && <small>Unseen</small>}
              </span>
            );
          }
          // A Red Gate's way out is sealed: its entrance shows the lock until the boss falls.
          const sealed = (x.kind === 'vault' && !open) || (red && x.kind === 'entrance');
          const looks = looksOf(x);
          const kind = NODE[looks];
          const isDone = done.has(x.id);
          // A room cleared reads as cleared, not as what it held; the rooms the hunter comes back to keep their marks.
          const plain = isDone && !['entrance', 'up', 'down', 'rest', 'boss'].includes(x.kind);
          const glyph = plain ? 'check' : sealed ? 'lock' : x.kind === 'vault' ? 'unlock' : kind.glyph;
          // A shrine seen shows its Path, as the references' doors show the god behind them.
          const path = looks === 'shrine' && !isDone ? shrinePath?.(x) : undefined;
          const name = plain ? 'Cleared' : sealed ? 'Sealed' : path ? `Shrine of ${path}` : kind.name;
          // What it costs to go there, in moves, on the Gate clock.
          const cost = costs?.[x.id];
          const moves = cost === undefined ? '' : `, ${cost} ${cost === 1 ? 'move' : 'moves'}`;
          const next = options.includes(x.id);
          const spent = x.kind === 'rest' && rested.includes(x.id);
          const stairs = x.kind === 'up' || x.kind === 'down';
          // A fight seen and not yet fought shows who waits in it: a pip to each creature, the strong ones red.
          const t = looks === 'fight' && !isDone ? threat(x) : null;
          const who = t && t.n ? `, ${t.n} ${t.n === 1 ? 'creature' : 'creatures'}${t.strong ? `, ${t.strong} strong` : ''}` : '';
          const state = [
            isDone ? 'is-done' : entered.has(x.id) ? 'is-here' : next ? 'is-next' : 'is-far', plain ? 'is-cleared' : '',
            sealed ? 'is-sealed' : '', spent ? 'is-spent' : '', here?.id === x.id ? 'is-at' : '', road.includes(x.id) ? 'is-road' : '',
          ].filter(Boolean).join(' ');
          const body = (
            <>
              {cost !== undefined && <span class="droom__cost" aria-hidden="true"><Glyph name="steps" /><b class="num">{cost}</b></span>}
              {t && t.n > 0 && (
                <span class="droom__pips" aria-hidden="true">
                  {Array.from({ length: t.n }, (_, i) => <i key={i} class={i < t.strong ? 'is-strong' : ''} />)}
                </span>
              )}
              <Glyph name={glyph} />
              {!compact && <small>{spent ? 'Used' : path ?? name}</small>}
            </>
          );
          const cls = `gnode droom gnode--${looks} ${state}`;
          if (next && onPick) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Enter ${name}${who}${moves}: ${kind.desc}`} title={kind.desc}
              onClick={() => { sfx.tap(); onPick(x.id); }}>{body}</button>;
          }
          // Stairs taken once are taken again in one tap, to the floor they lead to.
          const to = stairs && isDone ? across(m, x) : null;
          if (to && onWalk) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`${name}: to floor ${(to.floor ?? 0) + 1}${moves}`} title={`${name}: to floor ${(to.floor ?? 0) + 1}`}
              onClick={() => { sfx.tap(); onWalk(to.id); }}>{body}</button>;
          }
          if (isDone && onWalk && here?.id !== x.id) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Walk back to ${plain ? `the cleared ${kind.name}` : name}${moves}`} title={`Walk back to ${plain ? `the cleared ${kind.name}` : name}`}
              onClick={() => { sfx.tap(); onWalk(x.id); }}>{body}</button>;
          }
          return <span key={x.id} class={cls} style={style} title={`${name}: ${kind.desc}`} aria-label={`${name}${who}`}>{body}</span>;
        })}
        {here && on(here) && (
          <span class="dmap__you" aria-label={`You are here: ${NODE[looksOf(here)].name}`} style={{ left: `${((here.x! + 0.5) / cols) * 100}%`, top: `${((here.y! + 0.5) / rows) * 100}%` }}>
            <i class="dmap__you-tag">You</i>
          </span>
        )}
      </div>
      {compact && (
        <ul class="dmap__key" aria-label="Map key">
          {shown.map((k) => <li key={k}><i class={`gnode--${k}`}><Glyph name={k === 'vault' ? 'lock' : NODE[k].glyph} /></i>{NODE[k].name}</li>)}
          {fogs && <li><i class="is-fog"><Glyph name="unknown" /></i>Unseen</li>}
        </ul>
      )}
    </div>
  );
}

/** A tower, floor by floor from the foot. */
function TowerView({ m, path = [], at = 0, options = [], road = [], onPick, compact }: MapProps) {
  const rows = m.layers.length;
  const x = (i: number, w: number) => ((i + 0.5) / w) * 100;
  const y = (k: number) => (k + 0.5) * 10;
  const done = new Set(path.slice(0, at));
  const walked = new Set(path);
  const onRoad = (a: string, b: string) => {
    const ia = road.indexOf(a);
    return ia >= 0 && road[ia + 1] === b;
  };
  const onPath = (a: string, b: string) => {
    const ia = path.indexOf(a);
    return ia >= 0 && path[ia + 1] === b;
  };
  return (
    <div class={`gmap ${compact ? 'gmap--compact' : ''}`} style={{ '--rows': rows } as Record<string, number>} role="group" aria-label="Map of the Gate">
      <svg class="gmap__lines" viewBox={`0 0 100 ${rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
        {m.layers.slice(0, -1).flatMap((row, k) => row.flatMap((a, i) => a.next.map((id) => {
          const b = m.byId[id];
          const j = m.layers[k + 1].indexOf(b);
          const cls = onPath(a.id, id) ? 'is-walked' : onRoad(a.id, id) ? 'is-road' : '';
          return <line key={`${a.id}>${id}`} class={cls} x1={x(i, row.length)} y1={y(k)} x2={x(j, m.layers[k + 1].length)} y2={y(k + 1)} vector-effect="non-scaling-stroke" />;
        })))}
      </svg>
      {m.layers.map((row) => (
        <div class="gmap__row" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }} key={row[0].id}>
          {row.map((n) => {
            // A trap or a cache passes for an Event step until the hunter is standing on it.
            const looks = HIDDEN.has(n.kind) && !walked.has(n.id) ? 'event' : n.kind;
            const kind = NODE[looks];
            const next = options.includes(n.id);
            const state = done.has(n.id) ? 'is-done' : walked.has(n.id) ? 'is-here' : next ? 'is-next' : road.includes(n.id) ? 'is-road' : '';
            const body = <><Glyph name={kind.glyph} /><small>{kind.name}</small></>;
            return (
              <div class="gmap__cell" key={n.id}>
                {next && onPick
                  ? <button type="button" class={`gnode gnode--${looks} ${state}`} data-node={n.id} aria-label={`${kind.name}: ${kind.desc}`} title={kind.desc}
                    onClick={() => { sfx.tap(); onPick(n.id); }}>{body}</button>
                  : <span class={`gnode gnode--${looks} ${state}`} title={`${kind.name}: ${kind.desc}`}>{body}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
