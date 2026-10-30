/** A gate's map, drawn top to bottom: entrance to boss. Read-only in the brief; in the arena, where you step next. */
import type { GateMap } from '@/core/map';
import { NODE } from '@/data/nodes';
import { sfx } from '@/audio/audio';
import { Glyph } from './icons';

export function MapView({ m, path = [], at = 0, options = [], road = [], onPick, compact }: {
  m: GateMap;
  /** Steps chosen, and how many of them are done. */
  path?: string[];
  at?: number;
  /** Where the walker can step now. Tappable, with `onPick`. */
  options?: string[];
  /** A road to mark: the one the System assessed. */
  road?: string[];
  onPick?: (id: string) => void;
  compact?: boolean;
}) {
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
    <div class={`gmap ${compact ? 'gmap--compact' : ''}`} style={{ '--rows': rows } as Record<string, number>} role="group" aria-label="Map of the gate">
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
            const kind = NODE[n.kind];
            const next = options.includes(n.id);
            const state = done.has(n.id) ? 'is-done' : walked.has(n.id) ? 'is-here' : next ? 'is-next' : road.includes(n.id) ? 'is-road' : '';
            const body = <><Glyph name={kind.glyph} /><small>{kind.name}</small></>;
            return (
              <div class="gmap__cell" key={n.id}>
                {next && onPick
                  ? <button type="button" class={`gnode gnode--${n.kind} ${state}`} data-node={n.id} aria-label={`${kind.name}: ${kind.desc}`} title={kind.desc}
                    onClick={() => { sfx.tap(); onPick(n.id); }}>{body}</button>
                  : <span class={`gnode gnode--${n.kind} ${state}`} title={`${kind.name}: ${kind.desc}`}>{body}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
