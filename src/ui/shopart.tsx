/**
 * The Exchange's goods, drawn: each its own bottle, scroll or cord, lit in its colour, after the item
 * art of the shops in Genshin Impact and Honkai: Star Rail, where every good is a picture of the thing
 * rather than a glyph. The colours are the app's own: a Health Potion white as the HP bar is, mana blue,
 * fatigue gold, the Elixir arcane; the Gates' goods in their orange and ember.
 */
import { useMemo } from 'preact/hooks';

export type ShopArtId = 'hp' | 'mp' | 'fatigue' | 'elixir' | 'survey' | 'flash' | 'cord' | 'ember';

let seq = 0;

/** A cork, shared by the bottles. */
const Cork = ({ x, y, w, id }: { x: number; y: number; w: number; id: string }) => (
  <>
    <rect x={x} y={y} width={w} height={7} rx={2} fill={`url(#${id}-cork)`} />
    <rect x={x + 1.5} y={y + 1.2} width={w - 3} height={1.4} rx={0.7} fill="#fff" opacity=".22" />
  </>
);

export function ShopArt({ id, size = 56 }: { id: ShopArtId; size?: number }) {
  const u = useMemo(() => `sa${++seq}`, []);
  const tone: Record<ShopArtId, [string, string, string]> = {
    // glow, liquid top, liquid bottom
    hp: ['#cfeaff', '#ffffff', '#8ccfff'],
    mp: ['#4fd6ff', '#a8f2ff', '#2a6bff'],
    fatigue: ['#ffcb5c', '#fff3b0', '#ff9a1f'],
    elixir: ['#b98bff', '#ecd9ff', '#7a33ff'],
    survey: ['#ff9a3c', '#f6deaa', '#c99650'],
    flash: ['#fff1a8', '#ffffff', '#ffd84a'],
    cord: ['#e0a05a', '#f0c48a', '#a8692e'],
    ember: ['#ff7a2e', '#ffd36a', '#ff4415'],
  };
  const [glow, top, bottom] = tone[id];
  const defs = (
    <defs>
      <radialGradient id={`${u}-glow`} cx="50%" cy="58%" r="50%">
        <stop offset="0" stop-color={glow} stop-opacity=".55" />
        <stop offset="1" stop-color={glow} stop-opacity="0" />
      </radialGradient>
      <linearGradient id={`${u}-liq`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={top} />
        <stop offset="1" stop-color={bottom} />
      </linearGradient>
      <linearGradient id={`${u}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22" />
        <stop offset=".6" stop-color="#fff" stop-opacity=".04" />
        <stop offset="1" stop-color="#fff" stop-opacity=".12" />
      </linearGradient>
      <linearGradient id={`${u}-cork`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d9a46a" />
        <stop offset="1" stop-color="#7a4a24" />
      </linearGradient>
      <linearGradient id={`${u}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0b8" />
        <stop offset="1" stop-color="#d79b2a" />
      </linearGradient>
    </defs>
  );
  const glass = `url(#${u}-glass)`;
  const liq = `url(#${u}-liq)`;
  const rim = 'rgba(220, 240, 255, 0.85)';
  let body: preact.JSX.Element;
  switch (id) {
    case 'hp':
    case 'ember':
    case 'flash': {
      // A round flask: Health white with a heart, Ember orange with a flame over its cork, Flash small in a burst.
      const r = id === 'flash' ? 13 : 17;
      const cy = id === 'flash' ? 42 : 39;
      body = (
        <>
          {id === 'flash' && (
            <g opacity=".95">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                const long = i % 2 === 0;
                return <line key={i} x1={32 + Math.cos(a) * 17} y1={cy + Math.sin(a) * 17} x2={32 + Math.cos(a) * (long ? 29 : 24)} y2={cy + Math.sin(a) * (long ? 29 : 24)} stroke={long ? '#fff6c8' : '#ffd84a'} stroke-width={long ? 2.4 : 1.6} stroke-linecap="round" />;
              })}
            </g>
          )}
          <clipPath id={`${u}-clip`}><circle cx="32" cy={cy} r={r - 1.2} /></clipPath>
          <circle cx="32" cy={cy} r={r} fill={glass} />
          <path clip-path={`url(#${u}-clip)`} d={`M10 ${cy - 3} Q21 ${cy - 8} 32 ${cy - 3} T54 ${cy - 3} V64 H10 Z`} fill={liq} />
          <circle cx="32" cy={cy} r={r} fill="none" stroke={rim} stroke-width="1.6" />
          <rect x="27.5" y={cy - r - 11} width="9" height="12" rx="1.5" fill={glass} stroke={rim} stroke-width="1.4" />
          <Cork x={26} y={cy - r - 16} w={12} id={u} />
          <path d={`M${32 - r * 0.62} ${cy - r * 0.2} A${r * 0.7} ${r * 0.7} 0 0 1 ${32 - r * 0.15} ${cy - r * 0.68}`} fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round" />
          <circle cx={32 + r * 0.35} cy={cy + r * 0.35} r="1.6" fill="#fff" opacity=".6" />
          <circle cx={32 + r * 0.1} cy={cy + r * 0.55} r="1" fill="#fff" opacity=".5" />
          {id === 'hp' && <path d="M32 50.5c-4.6-3.2-7.4-5.8-7.4-8.7 0-2 1.6-3.6 3.5-3.6 1.6 0 2.9.9 3.9 2.3 1-1.4 2.3-2.3 3.9-2.3 1.9 0 3.5 1.6 3.5 3.6 0 2.9-2.8 5.5-7.4 8.7z" fill="#e6f6ff" stroke="#6fb8f0" stroke-width="1" />}
          {id === 'ember' && <path d="M32 3c3.6 4.2 5.2 7.4 4 10.4-.7 1.8-2.2 2.9-4 2.9s-3.4-1.1-4-2.9c-.6-1.7 0-3.4 1.4-5 .2 1.4.9 2.3 1.9 2.6C30.6 8.6 31 5.9 32 3z" fill="#ffb02e" stroke="#ff5a1a" stroke-width="1" />}
        </>
      );
      break;
    }
    case 'mp':
      // A tall vial, a crystal set in it.
      body = (
        <>
          <clipPath id={`${u}-clip`}><rect x="23.2" y="21.2" width="17.6" height="34.6" rx="8" /></clipPath>
          <rect x="22" y="20" width="20" height="37" rx="9" fill={glass} />
          <path clip-path={`url(#${u}-clip)`} d="M18 31 Q25 27 32 31 T46 31 V60 H18 Z" fill={liq} />
          <rect x="22" y="20" width="20" height="37" rx="9" fill="none" stroke={rim} stroke-width="1.6" />
          <rect x="27.5" y="11" width="9" height="10" rx="1.5" fill={glass} stroke={rim} stroke-width="1.4" />
          <Cork x={26} y={5} w={12} id={u} />
          <path d="M32 36 L37 43 L32 51 L27 43 Z" fill="#dffbff" stroke="#1d4fd1" stroke-width="1.1" />
          <path d="M32 36 L32 51 M27 43 H37" stroke="#1d4fd1" stroke-width=".7" opacity=".6" />
          <path d="M25.5 27 V45" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" />
        </>
      );
      break;
    case 'fatigue':
      // A squat tonic bottle, a bolt on its glass.
      body = (
        <>
          <clipPath id={`${u}-clip`}><path d="M21.3 30.5 Q21.3 25.5 27.5 24.6 V16.5 H36.5 V24.6 Q42.7 25.5 42.7 30.5 V51.5 Q42.7 55.7 38.6 55.7 H25.4 Q21.3 55.7 21.3 51.5 Z" /></clipPath>
          <path d="M20 30 Q20 24 27 23 V15 H37 V23 Q44 24 44 30 V52 Q44 57 39 57 H25 Q20 57 20 52 Z" fill={glass} />
          <path clip-path={`url(#${u}-clip)`} d="M16 34 Q24 30 32 34 T48 34 V60 H16 Z" fill={liq} />
          <path d="M20 30 Q20 24 27 23 V15 H37 V23 Q44 24 44 30 V52 Q44 57 39 57 H25 Q20 57 20 52 Z" fill="none" stroke={rim} stroke-width="1.6" />
          <Cork x={25.5} y={9} w={13} id={u} />
          <path d="M34 35 L27.5 45 H32.5 L30.5 53 L37.5 42 H32.5 Z" fill="#5a3200" stroke="#fff3c4" stroke-width="1" stroke-linejoin="round" />
          <path d="M23.5 31 V44" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" />
        </>
      );
      break;
    case 'elixir':
      // A teardrop of a bottle under a gold stopper, sparks around it.
      body = (
        <>
          <clipPath id={`${u}-clip`}><path d="M32 20 C39.5 27.5 45 33.8 45 42 A13 13 0 0 1 19 42 C19 33.8 24.5 27.5 32 20 Z" /></clipPath>
          <path d="M32 18 C40 26 46 33 46 42 A14 14 0 0 1 18 42 C18 33 24 26 32 18 Z" fill={glass} />
          <path clip-path={`url(#${u}-clip)`} d="M14 36 Q23 31 32 36 T50 36 V64 H14 Z" fill={liq} />
          <path d="M32 18 C40 26 46 33 46 42 A14 14 0 0 1 18 42 C18 33 24 26 32 18 Z" fill="none" stroke={rim} stroke-width="1.6" />
          <rect x="29" y="11" width="6" height="9" rx="1.2" fill={glass} stroke={rim} stroke-width="1.3" />
          <path d="M32 2 L37 7.5 L32 12 L27 7.5 Z" fill={`url(#${u}-gold)`} stroke="#8a5a10" stroke-width=".9" />
          <path d="M23 38 A10 10 0 0 1 27 30" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round" />
          {[[12, 22, 3.2], [52, 26, 2.6], [50, 52, 2.2], [14, 50, 2]].map(([x, y, k], i) => (
            <path key={i} d={`M${x} ${y - k * 1.6} L${x + k * 0.45} ${y - k * 0.45} L${x + k * 1.6} ${y} L${x + k * 0.45} ${y + k * 0.45} L${x} ${y + k * 1.6} L${x - k * 0.45} ${y + k * 0.45} L${x - k * 1.6} ${y} L${x - k * 0.45} ${y - k * 0.45} Z`} fill="#f2e4ff" opacity=".9" />
          ))}
        </>
      );
      break;
    case 'survey':
      // A Gate's map, unrolled between its two rods, the way through dotted in orange.
      body = (
        <>
          <path d="M14 17 H50 V47 H14 Z" fill={liq} />
          <path d="M14 17 H50 V47 H14 Z" fill="none" stroke="#7a5426" stroke-width="1.2" />
          <path d="M18 24 H30 M18 28 H26 M34 40 H46 M38 44 H46" stroke="#8a6232" stroke-width="1" opacity=".55" />
          <path d="M19 41 C24 41 24 33 30 33 S36 25 44 24" fill="none" stroke="#ff7a1a" stroke-width="2" stroke-dasharray="2.6 2.4" stroke-linecap="round" />
          <path d="M42 21.5 L46.5 26 M46.5 21.5 L42 26" stroke="#d0261a" stroke-width="2" stroke-linecap="round" />
          <circle cx="19" cy="41" r="2.2" fill="#ff7a1a" />
          <rect x="10" y="13" width="6" height="38" rx="3" fill={`url(#${u}-cork)`} stroke="#5b3416" stroke-width=".8" />
          <rect x="48" y="13" width="6" height="38" rx="3" fill={`url(#${u}-cork)`} stroke="#5b3416" stroke-width=".8" />
          <circle cx="13" cy="13" r="2" fill={`url(#${u}-gold)`} /><circle cx="13" cy="51" r="2" fill={`url(#${u}-gold)`} />
          <circle cx="51" cy="13" r="2" fill={`url(#${u}-gold)`} /><circle cx="51" cy="51" r="2" fill={`url(#${u}-gold)`} />
        </>
      );
      break;
    case 'cord':
      // A coil of binding cord, its loose end trailing.
      body = (
        <>
          {[48, 41, 34, 27].map((y, i) => (
            <g key={y}>
              <ellipse cx="32" cy={y} rx={17 - i * 0.6} ry="6.2" fill="none" stroke="#6b3f17" stroke-width="5.4" />
              <ellipse cx="32" cy={y} rx={17 - i * 0.6} ry="6.2" fill="none" stroke={liq} stroke-width="4" />
              <ellipse cx="32" cy={y} rx={17 - i * 0.6} ry="6.2" fill="none" stroke="#fff3dc" stroke-width="1" stroke-dasharray="2.5 3.2" opacity=".55" />
            </g>
          ))}
          <path d="M47 26 C54 20 52 12 45 10" fill="none" stroke="#6b3f17" stroke-width="5.4" stroke-linecap="round" />
          <path d="M47 26 C54 20 52 12 45 10" fill="none" stroke={liq} stroke-width="4" stroke-linecap="round" />
          <circle cx="44.5" cy="10" r="2.6" fill="#f0c48a" stroke="#6b3f17" stroke-width="1" />
        </>
      );
      break;
  }
  return (
    <svg class={`shopart shopart--${id}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {defs}
      <circle cx="32" cy="38" r="30" fill={`url(#${u}-glow)`} />
      {body}
    </svg>
  );
}
