/**
 * A crest to each rank, drawn behind the licence where its letter used to stand. Each rank's crest is
 * the one below it with something won: the hunter's arms build up piece by piece, so the climb reads at
 * a glance, from a lone dagger at E to the Sovereign's crown, eye and wings in a ring of light. Line work
 * in the rank's colour, faint, so the licence reads over it.
 *
 *   E  a dagger                                      the first blade a hunter carries
 *   D  the dagger on a round buckler                 a guard to stand behind
 *   C  a longsword on a heater shield                a hunter's own arms
 *   B  two swords crossed behind the shield          a fighter the party leans on
 *   A  the crossed swords and shield, winged         a hunter the Association sends ahead
 *   S  the winged arms crowned, in rays of light     the few the nation counts on
 *   N  a spiked crown over an open eye, great wings  the Sovereign, above every rank
 *      and swords below, in a ring of light
 */

/** The line every crest is drawn in. */
const LINE = { stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;
/** An outline alone. */
const S = { ...LINE, fill: 'none' } as const;
/**
 * A solid piece: its outline over a dark fill touched with the rank's colour (`.rc-f` in the styles). The
 * crest is faded as one picture, so a piece in front hides what stands behind it, as a carving would.
 */
const TINT = { ...LINE, class: 'rc-f' } as const;
/** A piece lit a little brighter: a crown, a wing's coverts. */
const LIT = { ...LINE, class: 'rc-f rc-f--lit' } as const;
const FINE = { ...S, 'stroke-width': 1.2 } as const;

/** A sword, point up along x = 50, its tip at `top` and its pommel at `foot`, `w` wide at the blade. */
function Sword({ top, foot, w = 7, guard = 16 }: { top: number; foot: number; w?: number; guard?: number }) {
  const len = foot - top;
  const g = top + len * 0.68;
  return (
    <g>
      <path d={`M50 ${top} L${50 + w} ${top + w * 1.8} V${g} H${50 - w} V${top + w * 1.8} Z`} {...TINT} />
      <path d={`M50 ${top + w * 2.4} V${g - 4}`} {...FINE} />
      <path d={`M${50 - guard} ${g} Q50 ${g + 6} ${50 + guard} ${g} L${50 + guard - 3} ${g + 5} Q50 ${g + 10} ${50 - guard + 3} ${g + 5} Z`} {...TINT} />
      <path d={`M${50 - 3.2} ${g + 8} H${50 + 3.2} V${foot - 7} H${50 - 3.2} Z`} {...TINT} />
      <circle cx="50" cy={foot - 3.5} r="4" {...TINT} />
    </g>
  );
}

/** A sword turned about (50, 55): two of them, turned each way, cross behind a shield. */
const Turned = ({ deg, children }: { deg: number; children: preact.ComponentChildren }) => <g transform={`rotate(${deg} 50 55)`}>{children}</g>;

/** A heater shield, its device a chevron, scaled about its centre. */
function Heater({ scale = 1, device = true }: { scale?: number; device?: boolean }) {
  return (
    <g transform={`translate(50 54) scale(${scale}) translate(-50 -54)`}>
      <path d="M50 18 L78 26 V50 C78 69 65 81 50 89 C35 81 22 69 22 50 V26 Z" {...LIT} />
      <path d="M50 24 L72 30.5 V50 C72 65 62 75 50 82 C38 75 28 65 28 50 V30.5 Z" {...FINE} />
      {device && <path d="M31 58 L50 44 L69 58 M34 66 L50 54 L66 66" {...S} stroke-width={2} />}
    </g>
  );
}

/** A wing, its feathers fanning from the shoulder, longest at the top: `dir` 1 to the right, -1 to the left. */
function Wing({ dir, y, span = 40, n = 5, shoulder = 9, lift = -42, drop = 22 }: { dir: 1 | -1; y: number; span?: number; n?: number; shoulder?: number; lift?: number; drop?: number }) {
  const x = 50 + shoulder;
  const feathers = Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    const a = ((lift + (drop - lift) * t) * Math.PI) / 180;
    const len = span * (1 - 0.38 * t);
    const w = 5.6 + 2.8 * (1 - t);
    const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
    const px = -Math.sin(a) * w, py = Math.cos(a) * w;
    const mx = x + Math.cos(a) * len * 0.55, my = y + Math.sin(a) * len * 0.55;
    return { d: `M${x} ${y} Q${mx + px} ${my + py} ${tx} ${ty} Q${mx - px} ${my - py} ${x} ${y} Z`, vein: `M${x} ${y} L${x + Math.cos(a) * len * 0.82} ${y + Math.sin(a) * len * 0.82}` };
  });
  // The coverts over the feathers' roots.
  const cover = `M${x - 2} ${y + 6} C${x + 4} ${y - 12} ${x + span * 0.45} ${y - 22} ${x + span * 0.72} ${y - 26} C${x + span * 0.62} ${y - 10} ${x + span * 0.4} ${y + 5} ${x - 2} ${y + 6} Z`;
  return (
    <g transform={dir < 0 ? 'translate(100 0) scale(-1 1)' : undefined}>
      {feathers.slice().reverse().map((f, i) => <g key={i}><path d={f.d} {...TINT} stroke-width={1.6} /><path d={f.vein} {...FINE} stroke-width={0.8} /></g>)}
      <path d={cover} {...LIT} stroke-width={1.6} />
    </g>
  );
}

/** A crown of `points` points, its band at `y`; a spiked crown's points rise sharper and higher. */
function Crown({ y, w = 22, h = 14, points = 3, spiked = false }: { y: number; w?: number; h?: number; points?: 3 | 5; spiked?: boolean }) {
  const xs = points === 3 ? [-w, 0, w] : [-w, -w / 2, 0, w / 2, w];
  const lift = (i: number) => (spiked ? [0, 4, 9, 4, 0][i] ?? 0 : points === 5 && i === 2 ? 4 : 0);
  let d = `M${50 - w} ${y}`;
  xs.forEach((dx, i) => {
    d += ` L${50 + dx} ${y - h - lift(i)}`;
    if (i < xs.length - 1) d += ` L${50 + (dx + xs[i + 1]) / 2} ${y - h * (spiked ? 0.32 : 0.45)}`;
  });
  d += ` L${50 + w} ${y} Z`;
  return (
    <g>
      <path d={d} {...LIT} />
      <path d={`M${50 - w - 2} ${y} H${50 + w + 2} V${y + 6} H${50 - w - 2} Z`} {...TINT} />
      {xs.map((dx, i) => <circle key={dx} cx={50 + dx} cy={y - h - lift(i) - 2.5} r={spiked ? 1.6 : 2} fill="currentColor" />)}
      {[-w / 2, 0, w / 2].map((dx) => <path key={dx} d={`M${50 + dx} ${y + 1} L${50 + dx + 2} ${y + 3} L${50 + dx} ${y + 5} L${50 + dx - 2} ${y + 3} Z`} fill="currentColor" />)}
    </g>
  );
}

/** Rays of light round the centre, long and short in turn. */
function Rays({ r = 46, n = 24, cy = 52 }: { r?: number; n?: number; cy?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const long = i % 2 === 0;
        const r0 = r - (long ? 10 : 6);
        return <line key={i} x1={50 + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={50 + Math.cos(a) * r} y2={cy + Math.sin(a) * r} {...FINE} stroke-width={long ? 1.4 : 0.9} />;
      })}
    </g>
  );
}

export function RankCrest({ rank, class: cls }: { rank: string; class?: string }) {
  let art: preact.JSX.Element;
  switch (rank) {
    case 'E':
      art = <Sword top={18} foot={90} w={6} guard={12} />;
      break;
    case 'D':
      // The dagger, now on a round buckler.
      art = (
        <g>
          <circle cx="50" cy="55" r="30" {...TINT} />
          <circle cx="50" cy="55" r="23" {...FINE} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={50 + Math.cos((i / 8) * Math.PI * 2 + 0.39) * 26.5} cy={55 + Math.sin((i / 8) * Math.PI * 2 + 0.39) * 26.5} r="1.6" fill="currentColor" />)}
          <Sword top={14} foot={94} w={6} guard={13} />
        </g>
      );
      break;
    case 'C':
      // A longsword on a heater shield, the shield's device a chevron.
      art = (
        <g>
          <Heater />
          <Sword top={4} foot={98} w={7} guard={18} />
        </g>
      );
      break;
    case 'B':
      // Two swords crossed behind the shield.
      art = (
        <g>
          <Turned deg={-38}><Sword top={2} foot={104} w={6} guard={14} /></Turned>
          <Turned deg={38}><Sword top={2} foot={104} w={6} guard={14} /></Turned>
          <Heater scale={0.86} />
        </g>
      );
      break;
    case 'A':
      // The crossed arms, winged.
      art = (
        <g>
          <Wing dir={-1} y={44} span={30} n={5} shoulder={19} lift={-62} drop={14} />
          <Wing dir={1} y={44} span={30} n={5} shoulder={19} lift={-62} drop={14} />
          <Turned deg={-38}><Sword top={4} foot={102} w={5.5} guard={13} /></Turned>
          <Turned deg={38}><Sword top={4} foot={102} w={5.5} guard={13} /></Turned>
          <Heater scale={0.8} />
        </g>
      );
      break;
    case 'S':
      // The winged arms crowned, rays of light behind.
      art = (
        <g>
          <Rays r={50} n={28} cy={50} />
          <Wing dir={-1} y={48} span={31} n={6} shoulder={18} lift={-62} drop={18} />
          <Wing dir={1} y={48} span={31} n={6} shoulder={18} lift={-62} drop={18} />
          <Turned deg={-36}><Sword top={10} foot={100} w={5} guard={12} /></Turned>
          <Turned deg={36}><Sword top={10} foot={100} w={5} guard={12} /></Turned>
          <g transform="translate(0 6)"><Heater scale={0.68} /></g>
          <Crown y={22} w={14} h={11} points={3} />
        </g>
      );
      break;
    default:
      // The Sovereign: a ring of light, great wings of shadow, swords below pointing down, an open eye in a
      // gem, and a spiked crown of five over it all.
      art = (
        <g>
          <circle cx="50" cy="52" r="47" {...FINE} />
          <circle cx="50" cy="52" r="43" {...FINE} stroke-dasharray="1.5 3" />
          <Rays r={42} n={32} cy={52} />
          <Wing dir={-1} y={52} span={40} n={7} shoulder={8} lift={-50} drop={32} />
          <Wing dir={1} y={52} span={40} n={7} shoulder={8} lift={-50} drop={32} />
          <Turned deg={180 - 30}><Sword top={20} foot={96} w={4.5} guard={10} /></Turned>
          <Turned deg={180 + 30}><Sword top={20} foot={96} w={4.5} guard={10} /></Turned>
          <path d="M50 34 L64 54 L50 76 L36 54 Z" {...LIT} />
          <path d="M50 40 L59 54 L50 69 L41 54 Z" {...FINE} />
          <path d="M39 54 Q50 45 61 54 Q50 63 39 54 Z" {...TINT} stroke-width={1.6} />
          <circle cx="50" cy="54" r="3.4" fill="currentColor" />
          <Crown y={28} w={20} h={13} points={5} spiked />
        </g>
      );
  }
  return <svg class={`rankcrest ${cls ?? ''}`} viewBox="0 0 100 100" aria-hidden="true">{art}</svg>;
}
