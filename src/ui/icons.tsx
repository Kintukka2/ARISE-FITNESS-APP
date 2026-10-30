/** Every icon in the app: inline SVG paths on a 24-unit grid, drawn in currentColor. */

const P: Record<string, string> = {
  // navigation
  quests: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  training: 'M2 8h3v8H2zM6 6h3v12H6zM9.5 10.5h5v3h-5zM15 6h3v12h-3zM19 8h3v8h-3z',
  profile: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-8 18a8 8 0 0 1 16 0z',
  gates: 'M3 21V10a9 9 0 0 1 18 0v11h-6v-8a3 3 0 0 0-6 0v8zm6-13.5a5.5 5.5 0 0 1 6 0V9a5.5 5.5 0 0 0-6 0z',
  shadows: 'M15.5 5.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8zM9 21.6a6.5 6.5 0 0 1 13 0z',
  shadowsBack: 'M8.5 4.3a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM2.3 19.5a6.2 6.2 0 0 1 12.4 0z',
  lock: 'M12 2a5 5 0 0 1 5 5v2h1.5A1.5 1.5 0 0 1 20 10.5v9A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-9A1.5 1.5 0 0 1 5.5 9H7V7a5 5 0 0 1 5-5zm0 2.4A2.6 2.6 0 0 0 9.4 7v2h5.2V7A2.6 2.6 0 0 0 12 4.4z',
  unlock: 'M12 2a5 5 0 0 1 5 5h-2.4A2.6 2.6 0 0 0 9.4 7v2h9.1A1.5 1.5 0 0 1 20 10.5v9A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-9A1.5 1.5 0 0 1 5.5 9H7V7a5 5 0 0 1 5-5z',
  // tools
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z',
  cog: 'M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3H9l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  chart: 'M3 3h2v16h16v2H3zm4.5 9h2.6v5H7.5zm4.6-4h2.6v9h-2.6zm4.6-3.4h2.6V17h-2.6zM7.4 9.6 6 8.1l4.9-4.6 3.4 2.7L19.6 2l1.4 1.5-6.6 5.6-3.4-2.7z',
  cert: 'M10.9 13.4 8.2 10.7l-1.5 1.5 4.2 4.2 7-7-1.5-1.5zM12 1.8 14.5 4l3-.5.9 2.9 2.7 1.4-1.2 2.8 1.2 2.8-2.7 1.4-.9 2.9-3-.5L12 19.2 9.5 17l-3 .5-.9-2.9-2.7-1.4L4.1 10.4 2.9 7.6l2.7-1.4.9-2.9 3 .5z',
  roster: 'M9 4a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 9 4zm7.4 1.2a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM9 12.2c3.6 0 6.4 1.8 6.4 4v1.8H2.6v-1.8c0-2.2 2.8-4 6.4-4zm7.6.4c2.9.2 4.8 1.7 4.8 3.6V18h-4.2v-1.8c0-1.4-.6-2.6-1.7-3.5z',
  help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2zm2.1-7.8-.9.9c-.7.7-1.2 1.3-1.2 2.9h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3a1.9 1.9 0 0 0 .6-1.4 2 2 0 0 0-4 0H8a4 4 0 0 1 8 0c0 .9-.4 1.7-.9 2.2z',
  bag: 'M4 7h16l-1.2 13.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8zm4 0a4 4 0 0 1 8 0h-2a2 2 0 0 0-4 0z',
  book: 'M5 3h10a4 4 0 0 1 4 4v14H8a3 3 0 0 1-3-3zm3 13a1 1 0 0 0 0 2h9v-2zM8 6v2h8V6z',
  // actions
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  minus: 'M5 11h14v2H5z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z',
  swap: 'M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
  star: 'm12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z',
  timer: 'M9 1h6v2H9zm3 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 1-1.6-4-2.4V8z',
  chevron: 'M9.4 5 8 6.4l5.6 5.6L8 17.6 9.4 19l7-7z',
  back: 'M14.6 5 16 6.4 10.4 12l5.6 5.6-1.4 1.4-7-7z',
  up: 'm12 7-7 7 1.4 1.4L12 9.8l5.6 5.6L19 14z',
  down: 'm12 17 7-7-1.4-1.4-5.6 5.6-5.6-5.6L5 10z',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6z',
  exit: 'M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zm-1.6 5.4L5.8 11H15v2H5.8l2.6 2.6L7 17l-5-5 5-5z',
  recall: 'M12 4a8 8 0 1 1-7.8 9.8l2-.4A6 6 0 1 0 12 6v3L7 5l5-4z',
  potion: 'M9 2h6v2h-1v4.2l5 8.3A3 3 0 0 1 16.4 21H7.6A3 3 0 0 1 5 16.5l5-8.3V4H9zm-1.6 13h9.2L13.8 10h-3.6z',
  heart: 'M12 21 3.5 12.7A5.2 5.2 0 0 1 12 6.1a5.2 5.2 0 0 1 8.5 6.6z',
  eye: 'M12 5c5 0 9 4.2 10 7-1 2.8-5 7-10 7S3 14.8 2 12c1-2.8 5-7 10-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  brain: 'M9 3a3 3 0 0 1 3 1.6A3 3 0 0 1 17.5 6 3.5 3.5 0 0 1 20 12a3.5 3.5 0 0 1-2 5.5A3.5 3.5 0 0 1 12 19a3.5 3.5 0 0 1-6-1.5A3.5 3.5 0 0 1 4 12a3.5 3.5 0 0 1 2.5-6A3 3 0 0 1 9 3zm2 3v12h2V6z',
  dash: 'M14 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8.5 8.5 12 7l3 2 2 3h3v2h-4l-2-2.4-1.3 3.6 2.8 2.8V22h-2v-4.2l-2.6-2.4-1.4 3.4L4 20l-.8-1.8 3.6-1.4 2.4-6.2-1.6.7-1.4 3-1.8-.9z',
  fist: 'M7 4h3v3H7zm4-1h3v4h-3zm4 1h3v4h-3zM5 8h14v4a7 7 0 0 1-7 7h-1v3H9v-3.6A6 6 0 0 1 5 13z',
  hp: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  mp: 'M12 2c3 4.5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7.5 6-12z',
  skull: 'M12 2.2c-4.6 0-8.3 3.3-8.3 7.6 0 2.1.9 4 2.3 5.4L5.4 21l3-1.5.9 2.3 1.5-2 1.2 1.9 1.2-1.9 1.5 2 .9-2.3 3 1.5-.6-5.8c1.4-1.4 2.3-3.3 2.3-5.4 0-4.3-3.7-7.6-8.3-7.6zM8.6 9.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zm6.8 0a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM12 13.6l1.2 2.2h-2.4z',
  unknown: 'M12 2.2c-4.6 0-8.3 3.3-8.3 7.6 0 2.1.9 4 2.3 5.4L5.4 21l3-1.5.9 2.3 1.5-2 1.2 1.9 1.2-1.9 1.5 2 .9-2.3 3 1.5-.6-5.8c1.4-1.4 2.3-3.3 2.3-5.4 0-4.3-3.7-7.6-8.3-7.6zm1 13.8h-2v-2h2zm1.8-6.4-.8.8c-.6.6-1 1.1-1 2.4h-2v-.4c0-1 .4-1.8 1-2.4l1-1.1a1.6 1.6 0 1 0-2.7-1.2H8.5a3.5 3.5 0 1 1 6.3 1.9z',
  warn: 'M12 2 1 21h22zm1 16h-2v-2h2zm0-4h-2v-5h2z',
  crown: 'M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5zm2.4 13.5h13.2V22H5.4z',
  // gear slots
  Weapon: 'M12 1.5l2 4v7.5h-4V5.5zM6.5 13h11v2h-11zM11 15h2v5h-2zM9.5 20h5v2h-5z',
  'Off-Hand': 'M12 2l8 3v6c0 4.5-3.4 8.2-8 11-4.6-2.8-8-6.5-8-11V5z',
  Head: 'M12 2C7.6 2 4.5 5.2 4.5 9.5V11h15V9.5C19.5 5.2 16.4 2 12 2zM4.5 14h4.2v7H4.5zm6.4 0h2.2v7h-2.2zm4.4 0h3.2v7h-3.2z',
  Chest: 'M9 3l3 2.5L15 3l5 2.5-1.5 4.5-2-1V21H7.5V9l-2 1L4 5.5z',
  Hands: 'M6.5 12V5a1.6 1.6 0 0 1 3.2 0v4h.8V3.4a1.6 1.6 0 0 1 3.2 0V9h.8V5.2a1.6 1.6 0 0 1 3.2 0V13.5c0 4.7-2.6 7.5-5.9 7.5S6.5 18.2 6.5 13.5z',
  Legs: 'M6 3h4.6l-.6 18H7.2zM13.4 3H18l-1.2 18h-2.8z',
  Feet: 'M7.5 2h6v9.6l4.3 2.3c1.2.7 1.9 1.7 1.9 3V21H7.5z',
  Amulet: 'M12 3a7 7 0 0 0-7 7h2.6A4.4 4.4 0 0 1 12 5.6 4.4 4.4 0 0 1 16.4 10H19a7 7 0 0 0-7-7zm0 8.5L8.5 15l3.5 6 3.5-6z',
  Ring: 'M12 2l3 3.5-3 2.2-3-2.2zM12 8a6.5 6.5 0 1 1 0 13 6.5 6.5 0 1 1 0-13zM12 11a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z',
};

export const STAT_ICON: Record<string, string> = { STR: 'fist', AGI: 'dash', PER: 'eye', VIT: 'heart', INT: 'brain' };

export function Glyph({ name, size, class: cls }: { name: string; size?: number; class?: string }) {
  const d = P[name] ?? name;
  return (
    <svg viewBox="0 0 24 24" class={`ico ${cls ?? ''}`} width={size} height={size} aria-hidden="true">
      {name === 'shadows' && <path d={P.shadowsBack} opacity=".42" />}
      <path d={d} />
    </svg>
  );
}

export function Shard({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class="shard" aria-hidden="true">
      <path fill="currentColor" d="M12 1.6 20.4 8l-3.2 12.4H6.8L3.6 8z" opacity=".28" />
      <path fill="currentColor" d="M12 1.6 20.4 8l-3.2 12.4H6.8L3.6 8zm0 3.1L6.4 9l2.2 8.6h6.8L17.6 9z" />
      <path fill="currentColor" d="M12 6.7 15.3 9.6 13.9 16h-3.8L8.7 9.6z" opacity=".65" />
    </svg>
  );
}

export function Flame({ tier }: { tier: string }) {
  return (
    <span class="flame" data-streak={tier} aria-hidden="true">
      <svg viewBox="0 0 24 24" class="flame__body"><path d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.3-2-.9-2.9C18.7 9.6 20 12 20 14a8 8 0 1 1-16 0C4 8 9 6 12 2z" /></svg>
      <svg viewBox="0 0 24 24" class="flame__core"><path d="M12 9c.6 2-1.2 2.6-1.2 4.4a3.2 3.2 0 0 0 6.4 0c0-2.2-2.6-3.6-5.2-4.4z" /></svg>
      <i class="flame__spark" /><i class="flame__spark" /><i class="flame__spark" />
    </span>
  );
}

export function CoachPortrait({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} class="portrait" aria-hidden="true">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4fd6ff" stop-opacity=".95" />
          <stop offset="100%" stop-color="#12325e" stop-opacity=".9" />
        </linearGradient>
      </defs>
      <path d="M50 14c14 0 22 10 22 24 0 9-3 14-3 18l10 7c6 4 9 10 9 17v6H12v-6c0-7 3-13 9-17l10-7c0-4-3-9-3-18 0-14 8-24 22-24z" fill="url(#cg)" />
      <path d="M50 14c14 0 22 10 22 24 0 4-.6 7-1.4 9.6-3-6-9-9-20.6-9s-17.6 3-20.6 9C28.6 45 28 42 28 38c0-14 8-24 22-24z" fill="#08172c" opacity=".55" />
      <rect x="36" y="44" width="10" height="4" rx="2" fill="#eafaff" />
      <rect x="54" y="44" width="10" height="4" rx="2" fill="#eafaff" />
      <path d="M40 62h20" stroke="#08172c" stroke-width="3" stroke-linecap="round" opacity=".7" />
    </svg>
  );
}

export function SystemMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class="sysmark" aria-hidden="true">
      <path d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path d="M12 6.5 16.5 15h-9z" fill="currentColor" />
    </svg>
  );
}

// ------------------------------------------------------------------ rank sigils: an engraved plate per grade

const RUNE: Record<string, string> = {
  E: 'M8.4 6.5V17.5M8.4 6.5h6.8M8.4 12h5.2M8.4 17.5h6.8',
  D: 'M8.4 6.5V17.5M8.4 6.5h4.3l3.3 3.3v4.4l-3.3 3.3H8.4',
  C: 'M15.6 8.6 13.5 6.5H10L7.9 8.6v6.8L10 17.5h3.5l2.1-2.1',
  B: 'M8.4 6.5V17.5M8.4 6.5h4.6l2.2 2.2v1.6l-1.8 1.7H8.4M13.4 12l2.2 2.1v1.2l-2.2 2.2H8.4',
  A: 'M7.6 17.5 12 6.5l4.4 11M9.6 13.8h4.8',
  S: 'M15.7 8.3 13.6 6.5h-3.4L8.1 8.6v1.7l1.9 1.6h4.3l1.7 1.7v1.8l-2.1 1.9h-3.6l-2.1-1.8',
  N: 'M4.6 12 8 8.6 11.4 12 8 15.4zM12.6 12 16 8.6 19.4 12 16 15.4z',
};
const PLATE: Record<string, [number, boolean, boolean, boolean, boolean, boolean]> = {
  // nodes, inner, spurs, outer, star, halo
  E: [0, false, false, false, false, false], D: [4, false, false, false, false, false],
  C: [4, true, false, false, false, false], B: [4, true, true, false, false, false],
  A: [8, true, true, true, false, false], S: [8, true, true, true, true, false], N: [8, true, true, true, true, true],
};
const node = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;

export function Sigil({ rank, size = 40 }: { rank: string; size?: number }) {
  const [nodes, inner, spurs, outer, star, halo] = PLATE[rank] ?? PLATE.E;
  const r = star ? 2.3 : 1.7;
  let nd = nodes ? node(12, 2.5, r) + node(12, 21.5, r) + node(2.5, 12, r) + node(21.5, 12, r) : '';
  if (nodes > 4) nd += node(5.2, 5.2, 1.3) + node(18.8, 5.2, 1.3) + node(5.2, 18.8, 1.3) + node(18.8, 18.8, 1.3);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class="sigil" data-rank={rank} role="img" aria-label={rank === 'N' ? 'Sovereign' : `${rank}-Rank`}>
      <path class="sig__frame" d="M7 2.5h10l4.5 4.5v10L17 21.5H7L2.5 17v-10z" />
      {outer && <path class="sig__outer" d="M6.4 1h11.2l5.4 5.4v11.2L17.6 23H6.4L1 17.6V6.4z" />}
      {inner && <path class="sig__inner" d="M8 5h8l3 3v8l-3 3H8l-3-3V8z" />}
      {nd && <path class="sig__node" d={nd} />}
      {spurs && <path class="sig__spur" d="M4.6 8.2 8.2 4.6M15.8 4.6l3.6 3.6M19.4 15.8l-3.6 3.6M8.2 19.4l-3.6-3.6" />}
      {star && <path class="sig__ray" d="M12 0v2M12 22v2M0 12h2M22 12h2" />}
      {halo && <g class="sig__halo">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="11.7" y="0" width=".6" height="2.2" transform={`rotate(${i * 30} 12 12)`} />)}</g>}
      <path class="sig__rune" d={RUNE[rank] ?? RUNE.E} />
    </svg>
  );
}
