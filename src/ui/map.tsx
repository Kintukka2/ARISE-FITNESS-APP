/**
 * A Gate's map. A dungeon is drawn as its plan: rooms on a grid, joined by corridors, the entrance at
 * the foot and the boss at the head. A tower is drawn floor by floor. Read-only in the brief; in the
 * arena, the rooms the hunter can enter glow, and a cleared room can be walked back to.
 */
import { passages, unsealed, type GateMap, type MapNode } from '@/core/map';
import { HIDDEN, HIDDEN_IN_ROOMS, NODE, type NodeKind } from '@/data/nodes';
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
  compact?: boolean;
}

export function MapView(p: MapProps) {
  return p.m.tower ? <TowerView {...p} /> : <RoomsView {...p} />;
}

/** A dungeon's plan. */
function RoomsView({ m, path = [], at = 0, options = [], road = [], onPick, pos, rested = [], onWalk, compact }: MapProps) {
  const done = new Set([m.start!, ...path.slice(0, at)]);
  const entered = new Set(path);
  const open = unsealed(m, done);
  const here = pos ? m.byId[pos] : null;
  const way = [m.start!, ...road];
  const onRoad = (a: string, b: string) => {
    const i = way.indexOf(a);
    const j = way.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  };
  const cx = (x: MapNode) => x.x! * 10 + 5;
  const cy = (x: MapNode) => x.y! * 10 + 5;
  const halls: [MapNode, MapNode][] = [];
  for (const a of m.nodes) for (const id of a.next) if (a.id < id) halls.push([a, m.byId[id]]);
  const secret = passages(m, done).map(([a, b]) => [m.byId[a], m.byId[b]] as const);
  // What the plan shows of a room: a trap, a cache, a shrine or a rest passes for Unknown until the hunter has stood in it.
  const looksOf = (x: MapNode): NodeKind => (HIDDEN_IN_ROOMS.has(x.kind) && !entered.has(x.id) ? 'event' : x.kind);
  const shown = [...new Set(m.nodes.map(looksOf))].filter((k) => k !== 'entrance');
  return (
    <div class={`dmapwrap ${compact ? 'is-compact' : ''}`}>
      <div class={`dmap ${compact ? 'dmap--compact' : ''}`} style={{ '--cols': m.cols, '--rows': m.rows } as Record<string, number>} role="group" aria-label="Map of the Gate">
        <svg class="dmap__halls" viewBox={`0 0 ${m.cols * 10} ${m.rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
          {/* A corridor is drawn twice: its walls, then its floor between them. */}
          {[...halls.map(([a, b]) => [a, b, done.has(a.id) && done.has(b.id) ? 'is-walked' : (done.has(a.id) || done.has(b.id)) && !compact ? 'is-near' : ''] as const),
            ...secret.map(([a, b]) => [a, b, 'is-hidden'] as const)].map(([a, b, lit]) => (
            <g key={`${a.id}-${b.id}`} class={`dmap__hall ${lit}`}>
              <line class="dmap__wall" x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} />
              <line class="dmap__floor" x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} />
            </g>
          ))}
          {road.length > 0 && halls.filter(([a, b]) => onRoad(a.id, b.id)).map(([a, b]) => (
            <line key={`r${a.id}-${b.id}`} class="dmap__trail" x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} vector-effect="non-scaling-stroke" />
          ))}
        </svg>
        {m.nodes.map((x) => {
          const sealed = x.kind === 'vault' && !open;
          const looks = looksOf(x);
          const kind = NODE[looks];
          const glyph = x.kind === 'vault' ? (sealed ? 'lock' : 'unlock') : kind.glyph;
          const name = sealed ? 'Sealed' : kind.name;
          const isDone = done.has(x.id);
          const next = options.includes(x.id);
          const spent = x.kind === 'rest' && rested.includes(x.id);
          const state = [
            isDone ? 'is-done' : entered.has(x.id) ? 'is-here' : next ? 'is-next' : 'is-far',
            sealed ? 'is-sealed' : '', spent ? 'is-spent' : '', here?.id === x.id ? 'is-at' : '', road.includes(x.id) ? 'is-road' : '',
          ].filter(Boolean).join(' ');
          const body = (
            <>
              <Glyph name={glyph} />
              {!compact && <small>{spent ? 'Used' : name}</small>}
              {!compact && x.n > 0 && <i class="droom__n num" aria-hidden="true">{x.n}</i>}
              {isDone && x.kind !== 'entrance' && <i class="droom__tick" aria-hidden="true"><Glyph name="check" /></i>}
            </>
          );
          const style = { gridColumn: x.x! + 1, gridRow: x.y! + 1 };
          const cls = `gnode droom gnode--${looks} ${state}`;
          const where = x.n > 0 ? `, room ${x.n}` : '';
          if (next && onPick) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Enter ${name}${where}: ${kind.desc}`} title={kind.desc}
              onClick={() => { sfx.tap(); onPick(x.id); }}>{body}</button>;
          }
          if (isDone && onWalk && here?.id !== x.id) {
            return <button type="button" key={x.id} class={cls} style={style} data-node={x.id} aria-label={`Walk back to ${name}${where}`} title={`Walk back to ${name}`}
              onClick={() => { sfx.tap(); onWalk(x.id); }}>{body}</button>;
          }
          return <span key={x.id} class={cls} style={style} title={`${name}: ${kind.desc}`}>{body}</span>;
        })}
        {here && (
          <span class="dmap__you" aria-label={`You are here: ${NODE[looksOf(here)].name}`} style={{ left: `${((here.x! + 0.5) / m.cols) * 100}%`, top: `${((here.y! + 0.5) / m.rows) * 100}%` }}>
            <i class="dmap__you-tag">You</i>
          </span>
        )}
      </div>
      {compact && (
        <ul class="dmap__key" aria-label="Map key">
          {shown.map((k) => <li key={k}><i class={`gnode--${k}`}><Glyph name={k === 'vault' ? 'lock' : NODE[k].glyph} /></i>{NODE[k].name}</li>)}
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
            // A trap, a cache or a shrine passes for an Unknown step until the hunter is standing on it.
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
