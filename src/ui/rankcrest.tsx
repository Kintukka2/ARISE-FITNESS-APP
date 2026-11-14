/**
 * A crest to each rank, drawn behind the licence where its letter used to stand: the hunter's arms rising
 * with the rank, from a dagger at E to a crown over shadow's wings for the Sovereign. Line work in the
 * rank's colour, faint, so the licence reads over it.
 *
 *   E  a dagger                    the first blade a hunter carries
 *   D  a round shield              the guard that keeps them standing
 *   C  a longsword                 a hunter's own weapon
 *   B  a sword over a heater       blade and guard together
 *   A  a winged sword              a hunter the Association sends ahead
 *   S  a crowned sword in laurel   the few the nation counts on
 *   N  a crown over spread wings   the Sovereign, above the ranks
 */

const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;
const TINT = { fill: 'currentColor', 'fill-opacity': 0.14 } as const;

/** A sword, point up, its tip at `top` and its pommel at `foot`, `w` wide at the blade. */
function Sword({ top, foot, w = 7, guard = 16 }: { top: number; foot: number; w?: number; guard?: number }) {
  const len = foot - top;
  const g = top + len * 0.66;
  return (
    <g>
      <path d={`M50 ${top} L${50 + w} ${top + w * 1.8} V${g} H${50 - w} V${top + w * 1.8} Z`} {...TINT} {...S} />
      <path d={`M50 ${top + w * 2.4} V${g - 4}`} {...S} stroke-width={1.4} />
      <path d={`M${50 - guard} ${g} Q50 ${g + 6} ${50 + guard} ${g} L${50 + guard - 3} ${g + 5} Q50 ${g + 10} ${50 - guard + 3} ${g + 5} Z`} {...TINT} {...S} />
      <path d={`M${50 - 3.5} ${g + 8} H${50 + 3.5} V${foot - 7} H${50 - 3.5} Z`} {...TINT} {...S} />
      <circle cx="50" cy={foot - 3.5} r="4.2" {...TINT} {...S} />
    </g>
  );
}

/** A wing to one side, feathered: `dir` 1 to the right, -1 to the left. */
function Wing({ dir, y = 46, span = 40 }: { dir: 1 | -1; y?: number; span?: number }) {
  const x = (d: number) => 50 + dir * d;
  return (
    <g>
      <path d={`M${x(8)} ${y} C${x(20)} ${y - 18} ${x(span - 6)} ${y - 22} ${x(span)} ${y - 26} C${x(span - 2)} ${y - 12} ${x(span - 8)} ${y + 2} ${x(span - 14)} ${y + 8} C${x(span - 20)} ${y + 6} ${x(span - 24)} ${y + 12} ${x(span - 30)} ${y + 14} C${x(18)} ${y + 12} ${x(12)} ${y + 8} ${x(8)} ${y} Z`} {...TINT} {...S} />
      <path d={`M${x(14)} ${y + 2} C${x(22)} ${y - 6} ${x(30)} ${y - 12} ${x(span - 4)} ${y - 20}`} {...S} stroke-width={1.3} />
      <path d={`M${x(16)} ${y + 7} C${x(24)} ${y + 2} ${x(30)} ${y - 2} ${x(span - 10)} ${y - 4}`} {...S} stroke-width={1.3} />
    </g>
  );
}

/** A crown of `points` points, its band at `y`. */
function Crown({ y, w = 22, h = 14, points = 3 }: { y: number; w?: number; h?: number; points?: 3 | 5 }) {
  const xs = points === 3 ? [-w, 0, w] : [-w, -w / 2, 0, w / 2, w];
  let d = `M${50 - w} ${y}`;
  xs.forEach((dx, i) => {
    d += ` L${50 + dx} ${y - h - (points === 5 && i === 2 ? 4 : 0)}`;
    if (i < xs.length - 1) d += ` L${50 + (dx + xs[i + 1]) / 2} ${y - h * 0.45}`;
  });
  d += ` L${50 + w} ${y} Z`;
  return (
    <g>
      <path d={d} {...TINT} {...S} />
      <path d={`M${50 - w - 2} ${y} H${50 + w + 2} V${y + 6} H${50 - w - 2} Z`} {...TINT} {...S} />
      {xs.map((dx) => <circle key={dx} cx={50 + dx} cy={y - h - 2.5} r="2" fill="currentColor" />)}
    </g>
  );
}

/** A laurel branch to one side of the centre. */
function Laurel({ dir }: { dir: 1 | -1 }) {
  const x = (d: number) => 50 + dir * d;
  const leaves = [0, 1, 2, 3, 4, 5];
  return (
    <g>
      <path d={`M${x(10)} 90 C${x(34)} 82 ${x(42)} 60 ${x(38)} 30`} {...S} stroke-width={1.6} />
      {leaves.map((i) => {
        const t = i / 5;
        const cx = x(10 + 30 * Math.sin(t * 1.4) + (1 - t) * 6);
        const cy = 88 - 56 * t;
        return <ellipse key={i} cx={cx + dir * 4} cy={cy} rx="2.3" ry="6.8" transform={`rotate(${dir * (40 - t * 30)} ${cx + dir * 4} ${cy})`} {...TINT} {...S} stroke-width={1.3} />;
      })}
    </g>
  );
}

export function RankCrest({ rank, class: cls }: { rank: string; class?: string }) {
  let art: preact.JSX.Element;
  switch (rank) {
    case 'E':
      art = <Sword top={14} foot={92} w={6} guard={13} />;
      break;
    case 'D':
      art = (
        <g>
          <circle cx="50" cy="52" r="38" {...TINT} {...S} />
          <circle cx="50" cy="52" r="28" {...S} stroke-width={1.6} />
          <path d="M50 14 V90 M12 52 H88" {...S} stroke-width={1.4} />
          <circle cx="50" cy="52" r="9" {...TINT} {...S} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={50 + Math.cos((i / 8) * Math.PI * 2 + 0.39) * 33} cy={52 + Math.sin((i / 8) * Math.PI * 2 + 0.39) * 33} r="1.8" fill="currentColor" />)}
        </g>
      );
      break;
    case 'C':
      art = <Sword top={4} foot={96} w={8} guard={20} />;
      break;
    case 'B':
      art = (
        <g>
          <path d="M50 12 L84 22 V50 C84 72 68 86 50 95 C32 86 16 72 16 50 V22 Z" {...TINT} {...S} />
          <path d="M50 19 L77 27 V50 C77 67 64 79 50 87 C36 79 23 67 23 50 V27 Z" {...S} stroke-width={1.3} />
          <Sword top={4} foot={92} w={6} guard={15} />
        </g>
      );
      break;
    case 'A':
      art = (
        <g>
          <Wing dir={-1} y={50} span={46} />
          <Wing dir={1} y={50} span={46} />
          <Sword top={4} foot={96} w={7} guard={16} />
        </g>
      );
      break;
    case 'S':
      art = (
        <g>
          <Laurel dir={-1} />
          <Laurel dir={1} />
          <Sword top={34} foot={96} w={6} guard={14} />
          <Crown y={24} w={15} h={12} points={3} />
        </g>
      );
      break;
    default:
      // The Sovereign: a crown of five points over wings of shadow spread wide, a gem between them.
      art = (
        <g>
          <Wing dir={-1} y={60} span={48} />
          <Wing dir={1} y={60} span={48} />
          <path d="M50 44 L58 58 L50 74 L42 58 Z" {...TINT} {...S} />
          <path d="M50 50 L54 58 L50 66 L46 58 Z" fill="currentColor" fill-opacity=".4" />
          <Crown y={38} w={24} h={16} points={5} />
        </g>
      );
  }
  return <svg class={`rankcrest ${cls ?? ''}`} viewBox="0 0 100 100" aria-hidden="true">{art}</svg>;
}
