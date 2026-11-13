/**
 * A Gate's map. A dungeon is drawn as its plan, a floor at a time: rooms on a grid, joined by
 * corridors, the entrance (or stairs up) at the foot and the boss (or stairs down) at the head, every
 * other room in the fog until it is seen. A tower is drawn
 * floor by floor. Read-only in the brief; in the arena, the rooms the hunter can enter glow, and a
 * cleared room can be walked back to. On the Gate clock, past the budget the plan stirs, and a Red Gate's plan
 * is red, its entrance sealed; what a walk costs in moves is never shown (the owner's call).
 */
import { across, pairKey, passages, threatOf, tollDoors, unsealed, type GateMap, type MapNode, type Openings } from '@/core/map';
import { landmarkOf } from '@/data/landmarks';
import { HIDDEN, HIDDEN_IN_ROOMS, NODE, type NodeKind } from '@/data/nodes';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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
  /** On the Gate clock: how far the Gate has stirred, 0 to 1 on the way to red, and whether it has turned. */
  stir?: number;
  red?: boolean;
  /** Inside a run: the name of each shrine's Path, shown on it once it is seen. */
  shrinePath?: (x: MapNode) => string | undefined;
  /** Inside a run: the passages it has noticed, a map it has charted, and the toll doors it has paid (`raid.openings`). */
  openings?: Openings;
  /** Inside a run, on the later plans: a floor's secrets found, of how many. */
  secrets?: (floor: number) => { found: number; of: number };
  /** Inside a run: the toll doors it can break, by key, with the room each opens; and breaking one, from its seal or that room. */
  tollable?: { key: string; far: string }[];
  onToll?: (key: string) => void;
  /** Inside a Gate: the rests found and not yet used, tapped to rest there (it asks first), wherever the hunter stands. */
  restable?: string[];
  onRestRoom?: (id: string) => void;
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
function RoomsView({ m, path = [], at = 0, options = [], road = [], onPick, pos, rested = [], onWalk, seen, floor, onFloor, corner, compact, stir = 0, red = false, shrinePath, openings = {}, secrets, tollable = [], onToll, restable = [], onRestRoom }: MapProps) {
  const done = new Set([m.start!, ...path.slice(0, at)]);
  const entered = new Set(path);
  const open = unsealed(m, done);
  const here = pos ? m.byId[pos] : null;
  const floors = Math.max(1, m.floors.length);
  const f = Math.min(floors - 1, floor ?? here?.floor ?? 0);
  const on = (x: MapNode) => (x.floor ?? 0) === f;
  // The plan is cropped to the floor's rooms, every one of them, found or not, so it fills the frame and never
  // shifts as a secret is found; an empty floor keeps its whole plan.
  const rooms = m.nodes.filter(on);
  const ox = rooms.length ? Math.min(...rooms.map((x) => x.x!)) : 0;
  const oy = rooms.length ? Math.min(...rooms.map((x) => x.y!)) : 0;
  const cols = rooms.length ? Math.max(...rooms.map((x) => x.x!)) - ox + 1 : m.floors[f]?.cols ?? m.cols;
  const rows = rooms.length ? Math.max(...rooms.map((x) => x.y!)) - oy + 1 : m.floors[f]?.rows ?? m.rows;
  const X = (x: MapNode) => x.x! - ox;
  const Y = (x: MapNode) => x.y! - oy;
  const way = [m.start!, ...road];
  const onRoad = (a: string, b: string) => {
    const i = way.indexOf(a);
    const j = way.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  };
  const cx = (x: MapNode) => X(x) * 10 + 5;
  const cy = (x: MapNode) => Y(x) * 10 + 5;
  const halls: [MapNode, MapNode][] = [];
  for (const x of rooms) for (const id of x.next) if (x.id < id && on(m.byId[id])) halls.push([x, m.byId[id]]);
  const secret = passages(m, done, openings).map(([x, y]) => [m.byId[x], m.byId[y]] as const).filter(([x]) => on(x));
  // A toll door is a corridor sealed in red until it is paid, its seal at its middle; paid, a corridor like any.
  const tolls = tollDoors(m).map(([x, y]) => ({ x: m.byId[x], y: m.byId[y], paid: !!openings.tolls?.has(pairKey(x, y)) })).filter((t) => on(t.x));
  const found = secrets?.(f);
  // What the plan shows of a room: a trap, a cache or a rest passes for an Event until the hunter has stood in it.
  const looksOf = (x: MapNode): NodeKind => (HIDDEN_IN_ROOMS.has(x.kind) && !entered.has(x.id) ? 'event' : x.kind);
  // A room not yet seen is fog: where it lies and its corridors show, nothing of what is in it.
  const fogged = (x: MapNode) => !!seen && !seen.has(x.id);
  const shown = [...new Set(rooms.filter((x) => !fogged(x)).map(looksOf))].filter((k) => k !== 'entrance' && k !== 'up');
  // A room behind a hidden passage is not on the plan at all until it is found: not even fog.
  const fogs = rooms.some((x) => fogged(x) && !x.secret);
  const threat = threatOf(m);
  return (
    <div class={`dmapwrap ${compact ? 'is-compact' : ''} ${red ? 'is-red' : stir > 0 ? 'is-stir' : ''}`} style={stir > 0 && !red ? { '--stir': stir } as Record<string, number> : undefined}>
      {(floors > 1 || corner || compact || (found && found.of > 0)) && (
        <div class="dmap__bar">
          {found && found.of > 0
            ? <span class="dmap__secrets" aria-label={`Secrets found on this floor: ${found.found} of ${found.of}`}><Glyph name="eye" /><small>Secrets</small><b class="num">{found.found}/{found.of}</b></span>
            : <span aria-hidden="true" />}
          {floors > 1 ? (
            <div class="dmap__floors" role={onFloor ? 'tablist' : undefined} aria-label="Floors">
              {onFloor
                ? Array.from({ length: floors }, (_, k) => (
                  <button type="button" key={k} role="tab" aria-selected={k === f} class={`dmap__floor ${k === f ? 'is-on' : ''}`} onClick={() => { sfx.tap(); onFloor(k); }}>Floor {k + 1}</button>
                ))
                : <span class="dmap__floor is-on">Floor <b class="num">{f + 1}/{floors}</b></span>}
            </div>
          ) : <span aria-hidden="true" />}
          <span class="dmap__corner">{corner}{compact && <MapKey shown={shown} fogs={fogs} />}</span>
        </div>
      )}
      <div class={`dmap ${compact ? 'dmap--compact' : ''}`} style={{ '--cols': cols, '--rows': rows } as Record<string, number>} role="group" aria-label={floors > 1 ? `Map of the Gate, floor ${f + 1} of ${floors}` : 'Map of the Gate'}>
        <svg class="dmap__halls" viewBox={`0 0 ${cols * 10} ${rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
          {/* A corridor is drawn twice: its walls, then its floor between them. */}
          {[...halls.map(([x, y]) => [x, y, done.has(x.id) && done.has(y.id) ? 'is-walked' : (done.has(x.id) || done.has(y.id)) && !compact ? 'is-near' : ''] as const),
            ...secret.map(([x, y]) => [x, y, 'is-hidden'] as const),
            ...tolls.map((t) => [t.x, t.y, t.paid ? 'is-walked' : 'is-toll'] as const)].map(([x, y, lit]) => (
            <g key={`${x.id}-${y.id}`} class={`dmap__hall ${lit}`}>
              <line class="dmap__wall" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} />
              <line class="dmap__floor" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} />
            </g>
          ))}
          {road.length > 0 && halls.filter(([x, y]) => onRoad(x.id, y.id)).map(([x, y]) => (
            <line key={`r${x.id}-${y.id}`} class="dmap__trail" x1={cx(x)} y1={cy(x)} x2={cx(y)} y2={cy(y)} vector-effect="non-scaling-stroke" />
          ))}
        </svg>
        {tolls.filter((t) => !t.paid).map((t) => {
          const style = { left: `${(((X(t.x) + X(t.y)) / 2 + 0.5) / cols) * 100}%`, top: `${(((Y(t.x) + Y(t.y)) / 2 + 0.5) / rows) * 100}%` };
          // A seal the hunter can break is tapped to break it: it asks first.
          const can = onToll ? tollable.find((k) => k.key === pairKey(t.x.id, t.y.id)) : undefined;
          return can
            ? <button type="button" key={`toll${t.x.id}-${t.y.id}`} class="dmap__toll is-live" style={style} aria-label="Toll door: break the seal" onClick={() => { sfx.tap(); onToll!(can.key); }}><Glyph name="lock" /></button>
            : <span key={`toll${t.x.id}-${t.y.id}`} class="dmap__toll" aria-hidden="true" style={style}><Glyph name="lock" /></span>;
        })}
        {rooms.map((x) => {
          const style = { gridColumn: X(x) + 1, gridRow: Y(x) + 1 };
          if (fogged(x) && x.secret) return null;
          if (fogged(x)) {
            return (
              <span key={x.id} class="gnode droom is-fog" style={style} title="Unseen" aria-label="Unseen room">
                <Glyph name="unknown" />
              </span>
            );
          }
          // A Red Gate's way out is sealed: its entrance shows the lock until the boss falls.
          const sealed = (x.kind === 'vault' && !open) || (red && x.kind === 'entrance');
          const looks = looksOf(x);
          const kind = NODE[looks];
          const isDone = done.has(x.id);
          // A room cleared reads as cleared, not as what it held; the rooms the hunter comes back to keep their marks.
          const plain = isDone && !['entrance', 'up', 'down', 'rest', 'boss', 'landmark'].includes(x.kind);
          const glyph = plain ? 'check' : sealed ? 'lock' : kind.glyph;
          // A shrine seen shows its Path, as the references' doors show the god behind them.
          const path = looks === 'shrine' && !isDone ? shrinePath?.(x) : undefined;
          // A landmark goes by its own name (`Ossuary`); a cache behind a secret by what it is.
          const named = x.kind === 'landmark' ? landmarkOf(x.landmark ?? '')?.name : undefined;
          const name = plain ? 'Cleared' : sealed ? 'Sealed' : path ? `Shrine of ${path}` : named ?? (x.secret ? 'Secret' : kind.name);
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
              {t && t.n > 0 && (
                <span class="droom__pips" aria-hidden="true">
                  {Array.from({ length: t.n }, (_, i) => <i key={i} class={i < t.strong ? 'is-strong' : ''} />)}
                </span>
              )}
              <Glyph name={glyph} />
              {!compact && !plain && <small>{spent ? 'Used' : path ?? name}</small>}
              {x.secret && <span class="droom__secret" aria-hidden="true" />}
            </>
          );
          const cls = `gnode droom gnode--${looks} ${state}`;
          // A rest found and not yet used is tapped to rest there, even where the hunter stands: it asks first.
          if (onRestRoom && restable.includes(x.id)) {
            return <button type="button" key={x.id} class={`${cls} is-restable`} style={style} data-node={x.id} aria-label={`Rest: ${kind.desc}`} title="Rest here"
              onClick={() => { sfx.tap(); onRestRoom(x.id); }}>{body}</button>;
          }
          // The room a toll door seals is tapped to break the seal: it asks first.
          const sealedBy = onToll && !next && !isDone ? tollable.find((k) => k.far === x.id) : undefined;
          if (sealedBy) {
            return <button type="button" key={x.id} class={`${cls} is-tolled`} style={style} data-node={x.id} aria-label={`${name}, behind a toll door: break the seal`} title="Behind a toll door"
              onClick={() => { sfx.tap(); onToll!(sealedBy.key); }}>{body}</button>;
          }
          if (next && onPick) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Enter ${name}${who}: ${kind.desc}`} title={kind.desc}
              onClick={() => { sfx.tap(); onPick(x.id); }}>{body}</button>;
          }
          // Stairs taken once are taken again in one tap, to the floor they lead to.
          const to = stairs && isDone ? across(m, x) : null;
          if (to && onWalk) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`${name}: to floor ${(to.floor ?? 0) + 1}`} title={`${name}: to floor ${(to.floor ?? 0) + 1}`}
              onClick={() => { sfx.tap(); onWalk(to.id); }}>{body}</button>;
          }
          if (isDone && onWalk && here?.id !== x.id) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Walk back to ${plain ? `the cleared ${kind.name}` : name}`} title={`Walk back to ${plain ? `the cleared ${kind.name}` : name}`}
              onClick={() => { sfx.tap(); onWalk(x.id); }}>{body}</button>;
          }
          return <span key={x.id} class={cls} style={style} title={`${name}: ${kind.desc}`} aria-label={`${name}${who}`}>{body}</span>;
        })}
        {here && on(here) && (
          <span class="dmap__you" aria-label={`You are here: ${NODE[looksOf(here)].name}`} style={{ left: `${((X(here) + 0.5) / cols) * 100}%`, top: `${((Y(here) + 0.5) / rows) * 100}%` }}>
            <i class="dmap__you-tag">You</i>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The plan's key, behind a button at its top right, as a strategy map keeps its legend folded: a tap drops
 * every kind of room the plan shows under it, its mark and its name, however many there are; a tap anywhere
 * else, or on the button again, folds it.
 */
function MapKey({ shown, fogs }: { shown: NodeKind[]; fogs: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  if (!shown.length && !fogs) return null;
  return (
    <span class={`dmap__keybox ${open ? 'is-open' : ''}`} ref={box}>
      <button type="button" class="dmap__keybtn" aria-expanded={open} aria-controls="dmap-key" onClick={() => { sfx.tap(); setOpen(!open); }}>
        Key<Glyph name="down" />
      </button>
      {open && (
        <ul class="dmap__key" id="dmap-key" aria-label="Map key">
          {shown.map((k) => <li key={k}><i class={`gnode--${k}`}><Glyph name={NODE[k].glyph} /></i>{NODE[k].name}</li>)}
          {fogs && <li><i class="is-fog"><Glyph name="unknown" /></i>Unseen</li>}
        </ul>
      )}
    </span>
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
