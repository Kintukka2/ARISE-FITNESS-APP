/**
 * The cinematics: a lock of light forming around a rank plate, catching, and breaking open. Two
 * scripts play it.
 *
 * The Arrival is the cut between the Association's office and the System's first window. The rank
 * plate lifts off the licence and the office goes dark. A hum, and a heartbeat closing in. A lock
 * draws itself around the plate and its rings turn, catching one by one, until their keyways line
 * up and light pours through. The plate the Association says is fixed for life cracks, everything
 * folds into one point, a breath of silence, and it breaks open. What is left glows behind the
 * window and answers the hold: each gong brightens it, letting go lets it fade, and the seal blows
 * the lock apart.
 *
 * The rank-up is the same ceremony in advancement's gold, quicker, when a hunter claims a rank:
 * the plate lifts off its Reclassification window, the lock breaks it open, and the new rank's
 * plate rises out of the light, white-hot, cooling into its own colour.
 *
 * The promotion is the rank-up in the Shadows' violet, when a hunter promotes a Shadow: its badge
 * lifts off its card, and it rises again out of the breach wearing its new rank's insignia.
 *
 * Neither carries words, so a System window is always what speaks after (docs/VOICE.md,
 * "Surfaces"). One canvas on its own clock. Nothing here is game state, and nothing here decides
 * anything. Under reduced motion each keeps every beat and drops the movement: no shake, no spin,
 * no flying light, and the flashes are softer.
 */
import { music, sfx } from '@/audio/audio';
import { buzz, reducedMotion } from './feedback';
import { emblemParts, PLACE } from './emblems';
import { plateParts } from './icons';

/** When each beat lands, in ms from the start. */
export interface Timeline {
  dark: number; // what was on screen has gone
  beats: number[]; // the heartbeat, closing in
  form: number; // the rings draw out of the plate
  catches: number[]; // outer ring to inner; the last one opens the keyway
  fold: number; // everything drawn into the centre
  hush: number; // silence
  breach: number; // it breaks open
  open: number; // the window that speaks next may open
  tears: [number, number][]; // moments the picture tears while the light pours, and how long each lasts
}

/** The Arrival's beats, from the tap that leaves the office. */
export const T: Timeline = {
  dark: 1100,
  beats: [1300, 2250, 2950, 3450],
  form: 3650,
  catches: [5050, 5600, 6100, 6550],
  fold: 7900,
  hush: 8250,
  breach: 8600,
  open: 9450,
  tears: [[6720, 70], [7160, 90], [7470, 60], [7700, 80], [7830, 60]],
};

/** The rank-up's beats: the same shape, quicker, with two heartbeats, from the end of the hold. */
export const RANK_T: Timeline = {
  dark: 800,
  beats: [950, 1550],
  form: 1750,
  catches: [2550, 2950, 3300, 3600],
  fold: 4700,
  hush: 5000,
  breach: 5300,
  open: 6600,
  tears: [[3900, 70], [4250, 60], [4480, 60]],
};

/** A cinematic's light, as rgb triplets. Cyan is the System arriving; gold is advancement. */
interface Palette {
  glow: string; soft: string; hot: string;
  core: [number, number, number];
  /** What a plate heats towards, then what it ends at. */
  heat: [number, number, number]; white: [number, number, number];
  /** The after's dark, heart and middle. */
  deep: [string, string];
  /** The breach's flash, heart to edge. */
  flash: [string, string, string];
}
const CYAN: Palette = {
  glow: '79, 214, 255', soft: '160, 230, 255', hot: '236, 250, 255', core: [200, 238, 255],
  heat: [120, 225, 255], white: [244, 252, 255], deep: ['28, 82, 156', '12, 34, 82'],
  flash: ['244, 252, 255', '150, 228, 255', '36, 110, 190'],
};
const GOLD: Palette = {
  glow: '255, 190, 70', soft: '255, 222, 150', hot: '255, 248, 228', core: [255, 230, 182],
  heat: [255, 210, 110], white: [255, 250, 236], deep: ['112, 76, 20', '48, 32, 10'],
  flash: ['255, 252, 240', '255, 212, 120', '150, 96, 24'],
};
/** The Shadows' violet, for a Shadow's promotion. */
const VIOLET: Palette = {
  glow: '155, 107, 255', soft: '201, 170, 255', hot: '246, 238, 255', core: [214, 192, 255],
  heat: [182, 140, 255], white: [250, 246, 255], deep: ['70, 34, 140', '30, 14, 64'],
  flash: ['250, 246, 255', '190, 150, 255', '84, 40, 170'],
};

/** One playing: whose light, which plate is lifted, and which one rises out of the breach, if any. */
interface Script {
  t: Timeline;
  pal: Palette;
  plate: () => Plate;
  /** The plate the breach leaves behind. The Arrival's breach leaves only shards. */
  rise?: () => Plate;
  /** What is left of the lock glows on behind the next window and answers a hold. */
  idle: boolean;
}

export interface ArrivalCtl {
  /** Resolves when the breach has settled enough for the next window to open. */
  ready: Promise<void>;
  /** Jump to the silence before the breach. The breach itself always plays. */
  skip: () => void;
  /** The first window's hold has reached `step` of `of`. */
  charge: (step: number, of: number) => void;
  /** The hold is complete. */
  seal: () => void;
  /** Fade the whole thing out. */
  leave: () => Promise<void>;
  /** Stop drawing and silence everything. Safe to call twice. */
  stop: () => void;
}

/** Where the plate sits when the cut begins, in CSS pixels: its centre and width. */
export interface From { x: number; y: number; size: number }

/** The plate's place on screen, read off the element showing it. Null when it is not laid out. */
export function fromEl(el: Element | null | undefined): From | null {
  const r = el?.getBoundingClientRect();
  return r?.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width } : null;
}

// ------------------------------------------------------------------ geometry

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outCubic = (p: number) => 1 - (1 - p) ** 3;
const inCubic = (p: number) => p * p * p;
/** Out past the mark and back: a plate landing. */
const outBack = (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const mix = (a: number[], b: number[], p: number) => a.map((x, i) => Math.round(lerp(x, b[i], p))).join(', ');
const decay = (t: number, at: number, ms: number) => (t >= at ? Math.exp(-(t - at) / ms) : 0);

/** A small seeded generator, so the light falls the same way every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The lock, outer ring first. Radii and tick lengths are fractions of the screen's short side. Each
 * ring is cut into segments and has two keyways, top and bottom; `turns` is how far it spins before
 * it catches, and its sign the direction.
 */
interface Ring { r: number; w: number; segs: number; gap: number; notch: number; ticks: number; tick: number; turns: number }
const RINGS: Ring[] = [
  { r: 0.4, w: 1.2, segs: 12, gap: 0.035, notch: 0.2, ticks: 96, tick: 0.02, turns: 1.25 },
  { r: 0.325, w: 2.2, segs: 24, gap: 0.05, notch: 0.24, ticks: 0, tick: 0, turns: -1.75 },
  { r: 0.255, w: 3.6, segs: 6, gap: 0.06, notch: 0.3, ticks: 48, tick: -0.016, turns: 2.25 },
  { r: 0.185, w: 1.6, segs: 4, gap: 0.08, notch: 0.36, ticks: 36, tick: -0.013, turns: -2.75 },
];

/** Each ring's arcs, in its own frame: the right half from the top keyway down, then the left half. */
const ARCS = RINGS.map((ring) => {
  const out: [number, number][] = [];
  const half = ring.segs / 2;
  for (const side of [0, Math.PI]) {
    const a0 = -Math.PI / 2 + side + ring.notch / 2;
    const a1 = Math.PI / 2 + side - ring.notch / 2;
    const step = (a1 - a0) / half;
    for (let k = 0; k < half; k++) out.push([a0 + k * step + (k ? ring.gap / 2 : 0), a0 + (k + 1) * step - (k < half - 1 ? ring.gap / 2 : 0)]);
  }
  return out;
});

const inKeyway = (a: number, notch: number) => {
  const d = Math.abs(((a % Math.PI) + Math.PI) % Math.PI - Math.PI / 2);
  return d < notch / 2 + 0.02;
};

/** When ring `i` starts drawing: the inner one first, spreading out from the plate. */
const formAt = (T: Timeline, i: number) => T.form + (RINGS.length - 1 - i) * 130;

/** Ring `i`'s turn while the lock is working: fast, slowing, a hard stop on its catch, then a recoil. */
function lockAngle(T: Timeline, i: number, t: number) {
  const { turns } = RINGS[i];
  const at = T.catches[i];
  if (t >= at) {
    const d = t - at;
    return -Math.sign(turns) * 0.06 * Math.exp(-d / 90) * Math.sin(d / 30);
  }
  const q = 1 - span(t, formAt(T, i), at);
  return turns * TAU * (0.75 * q * q + 0.25 * q);
}

/** Cracks across the plate, in its 24-unit box: jagged lines from the middle to the rim. */
const CRACKS = (() => {
  const r = rng(7);
  return Array.from({ length: 6 }, (_, k) => {
    let a = (k / 6) * TAU + (r() - 0.5) * 0.6;
    let x = 12 + Math.cos(a) * 0.8;
    let y = 12 + Math.sin(a) * 0.8;
    const pts: [number, number][] = [[x, y]];
    while (Math.hypot(x - 12, y - 12) < 9) {
      a += (r() - 0.5) * 1.1;
      const len = 1.4 + r() * 1.4;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      pts.push([x, y]);
    }
    return pts;
  });
})();

/** A burst of light: motes and the plate's shards thrown out from the centre, all from one seed. */
interface Mote { a: number; v: number; life: number; size: number; hot: boolean }
interface Shard { a: number; v: number; spin: number; size: number; tilt: number }
function burstOf(seed: number, motes: number, shards: number) {
  const r = rng(seed);
  return {
    motes: Array.from({ length: motes }, (): Mote => ({ a: r() * TAU, v: 0.3 + r() ** 1.6 * 1.7, life: 900 + r() * 1200, size: 0.006 + r() * 0.016, hot: r() < 0.3 })),
    shards: Array.from({ length: shards }, (): Shard => ({ a: r() * TAU, v: 0.25 + r() * 0.75, spin: (r() - 0.5) * 0.02, size: 0.012 + r() * 0.02, tilt: r() * TAU })),
    rays: Array.from({ length: 16 }, () => ({ a: r() * TAU, w: 0.012 + r() * 0.04, len: 0.7 + r() * 0.5 })),
  };
}

/** The air after: motes rising through the dark. */
const DRIFT = (() => {
  const r = rng(31);
  return Array.from({ length: 54 }, () => ({ x: r(), y: r(), v: 0.012 + r() * 0.04, size: 0.003 + r() * 0.006, ph: r() * TAU }));
})();

/** The rays behind a risen plate, turning slowly. */
const HALO_RAYS = (() => {
  const r = rng(43);
  return Array.from({ length: 10 }, (_, k) => ({ a: (k / 10) * TAU + r() * 0.3, w: 0.03 + r() * 0.05, len: 1.6 + r() * 1.4 }));
})();

function sprite(rgb: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb}, 1)`);
  gr.addColorStop(0.22, `rgba(${rgb}, 0.55)`);
  gr.addColorStop(1, `rgba(${rgb}, 0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
}

/** A grade's own colour, read off the theme (`--rank-E` and the rest), so the canvas and the Sigil never differ. */
function rankRgb(key: string): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--rank-${key}`).trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x8a99b0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A plate, ready to draw: its parts as paths, its colour, and how heavy its rune's line is (1 for a rank's letter). */
interface Plate { frame: Path2D; rune: Path2D; extras: Path2D[]; nodes?: Path2D; rays?: Path2D; halo: boolean; rgb: [number, number, number]; weight?: number }
function plateOf(key: string): Plate {
  const p = plateParts(key);
  return {
    frame: new Path2D(p.frame),
    rune: new Path2D(p.rune),
    extras: [p.outer, p.inner, p.spurs].filter((x): x is string => !!x).map((x) => new Path2D(x)),
    nodes: p.nodes ? new Path2D(p.nodes) : undefined,
    rays: p.rays ? new Path2D(p.rays) : undefined,
    halo: p.halo,
    rgb: rankRgb(key),
  };
}

/** A path placed on the plate's grid, at [scale, x, y]. */
function placed(d: string, [k, x, y]: readonly [number, number, number]) {
  const p = new Path2D();
  p.addPath(new Path2D(d), new DOMMatrix([k, 0, 0, k, x, y]));
  return p;
}

/** A Shadow's badge, as a plate: the shield, the family glyph and its shadow, and the rank's insignia. Violet, as the Shadows are. */
function emblemOf(family: string, rank: number): Plate {
  const p = emblemParts(family, rank);
  return {
    frame: new Path2D(p.frame),
    rune: placed(p.glyph, PLACE.glyph),
    extras: [placed(p.glyph, PLACE.echo)],
    nodes: placed(p.insignia, PLACE.insignia),
    halo: false,
    rgb: VIOLET.heat,
    weight: 0.55,
  };
}

// ------------------------------------------------------------------ the scripts

/** The Arrival, on the onboarding's own canvas. */
export function arrival(canvas: HTMLCanvasElement, opts: { from?: From | null; skippable?: boolean } = {}): ArrivalCtl {
  return play(canvas, { t: T, pal: CYAN, plate: () => plateOf('E'), idle: true }, opts);
}

/** A cinematic on a canvas of its own over everything but the windows, taken away on `stop`. */
function overlay(script: Script, opts: { from?: From | null; onDark?: () => void }): ArrivalCtl {
  const canvas = document.createElement('canvas');
  canvas.className = 'arrival';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctl = play(canvas, script, opts);
  const stop = ctl.stop;
  ctl.stop = () => { stop(); canvas.remove(); };
  return ctl;
}

/**
 * A rank claimed: the plate `was` lifts off its window and the breach leaves `now`. Draws on a canvas
 * of its own over everything but the windows, and takes it away on `stop`. `onDark` runs once the
 * screen behind is covered, so what changes there is never seen changing.
 */
export function rankUp(opts: { from?: From | null; was: string; now: string; onDark?: () => void }): ArrivalCtl {
  return overlay({ t: RANK_T, pal: GOLD, plate: () => plateOf(opts.was), rise: () => plateOf(opts.now), idle: false }, opts);
}

/**
 * A Shadow promoted: its badge, of family `family` at rank `was`, lifts off its card, and the breach
 * leaves it at rank `now`. As `rankUp` in every other way.
 */
export function promotion(opts: { from?: From | null; family: string; was: number; now: number; onDark?: () => void }): ArrivalCtl {
  return overlay({ t: RANK_T, pal: VIOLET, plate: () => emblemOf(opts.family, opts.was), rise: () => emblemOf(opts.family, opts.now), idle: false }, opts);
}

// ------------------------------------------------------------------ the engine

function play(canvas: HTMLCanvasElement, script: Script, opts: { from?: From | null; skippable?: boolean; onDark?: () => void }): ArrivalCtl {
  const T = script.t;
  const P = script.pal;
  const g = canvas.getContext('2d')!;
  const calm = reducedMotion();
  const GLOW = sprite(P.glow);
  const HOT = sprite(P.hot);
  const PLATE = script.plate();
  const RISE = script.rise ? script.rise() : null;
  const RISE_GLOW = RISE ? sprite(RISE.rgb.join(', ')) : null;
  const BREACH = burstOf(11, 170, 22);
  const SEAL = burstOf(23, 120, 0);

  let W = 0, H = 0, dpr = 1, u = 1, cx = 0, cy = 0, diag = 1;
  const resize = () => {
    const iw = innerWidth, ih = innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    // Keep the canvas to about 2.4 million pixels, so a tablet draws as smoothly as a phone.
    if (iw * ih * dpr * dpr > 2.4e6) dpr = Math.sqrt(2.4e6 / (iw * ih));
    W = canvas.width = Math.round(iw * dpr);
    H = canvas.height = Math.round(ih * dpr);
    u = Math.min(W, H);
    cx = W / 2;
    cy = H / 2;
    diag = Math.hypot(W, H);
  };
  resize();
  addEventListener('resize', resize);
  document.documentElement.dataset.arrival = '';

  // ---------------------------------------------------------------- clock and cues

  let t = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;
  let stopHum = () => {};
  let stopSurge = () => {};
  let stopGlow = () => {};
  let ready!: () => void;
  const readyP = new Promise<void>((r) => { ready = r; });
  const final = T.catches.length - 1;

  const cues: { at: number; run: () => void; done?: boolean }[] = [
    { at: 0, run: () => { music.hush(true); stopHum = sfx.hum((T.fold - 400) / 1000); } },
    { at: T.dark, run: () => opts.onDark?.() },
    ...T.beats.map((at, k) => ({ at, run: () => { sfx.heartbeat(T.beats.length > 1 ? k / (T.beats.length - 1) : 1); buzz([26, 170, 16]); } })),
    { at: T.form, run: () => sfx.lockForm() },
    ...T.catches.map((at, k) => ({ at, run: () => { sfx.lockCatch(k + 1, T.catches.length); buzz(k === final ? [30, 40, 40] : 18); } })),
    { at: T.catches[final], run: () => { stopSurge = sfx.surge((T.fold - T.catches[final]) / 1000); } },
    { at: T.fold, run: () => { stopSurge(); sfx.fold((T.hush - T.fold) / 1000); } },
    { at: T.hush, run: () => stopHum() },
    { at: T.breach, run: () => { sfx.breach(); buzz([90, 40, 220]); stopGlow = sfx.afterglow(); } },
    // A rank's fanfare as its plate rises.
    ...(RISE ? [{ at: T.breach + 220, run: () => sfx.rankUp() }] : []),
    { at: T.open, run: () => ready() },
  ];

  // ---------------------------------------------------------------- the hold

  let level = 0; // how lit the lock is, eased toward `want`
  let want = 0;
  let lastTick = -1e9;
  let sealAt = 0;
  const pulses: { at: number; k: number }[] = [];
  const idle = RINGS.map((_, i) => i * 0.7);

  // ---------------------------------------------------------------- light pulled in while it pours

  interface Inflow { b: number; life: number; a0: number; r0: number; spin: number }
  const inflow: Inflow[] = [];
  const pull = rng(5);
  let owed = 0;

  // ---------------------------------------------------------------- drawing

  const lit = (a: number) => (a <= 0.002 ? 0 : a);

  function drawRing(i: number, scale: number, ang: number, alpha: number, drawIn: number, flare: number, tint?: string) {
    const ring = RINGS[i];
    const r = ring.r * u * scale;
    const a = lit(alpha);
    if (r < 1 || !a || drawIn <= 0) return;
    g.beginPath();
    for (const [a0, a1] of ARCS[i]) {
      const s = a0 + ang;
      g.moveTo(Math.cos(s) * r, Math.sin(s) * r);
      g.arc(0, 0, r, s, s + (a1 - a0) * drawIn);
    }
    const hot = Math.min(1, a * (1 + flare * 1.6));
    if (tint) {
      g.strokeStyle = `rgba(${tint}, ${0.5 * hot})`;
      g.lineWidth = (ring.w + 1) * dpr;
      g.stroke();
      return;
    }
    g.strokeStyle = `rgba(${P.glow}, ${0.16 * hot})`;
    g.lineWidth = (ring.w * 2 + 8) * dpr;
    g.stroke();
    g.strokeStyle = `rgba(${mix(P.core, [255, 255, 255], flare)}, ${0.9 * hot})`;
    g.lineWidth = ring.w * dpr;
    g.stroke();
    if (ring.ticks) {
      g.beginPath();
      const sign = Math.sign(ring.tick);
      for (let k = 0; k < ring.ticks; k++) {
        const t0 = (k / ring.ticks) * TAU;
        if (t0 / TAU > drawIn) break;
        if (inKeyway(t0, ring.notch)) continue;
        const s = t0 + ang;
        const r1 = r + sign * (ring.w + 3) * dpr;
        const r2 = r1 + ring.tick * u * scale * (k % 6 === 0 ? 1.9 : 1);
        g.moveTo(Math.cos(s) * r1, Math.sin(s) * r1);
        g.lineTo(Math.cos(s) * r2, Math.sin(s) * r2);
      }
      g.strokeStyle = `rgba(${P.soft}, ${0.5 * hot})`;
      g.lineWidth = dpr;
      g.stroke();
    }
    // The keyway's teeth: a short bar on each side of both gaps.
    g.beginPath();
    for (const side of [-Math.PI / 2, Math.PI / 2]) {
      for (const e of [-1, 1]) {
        const s = side + ang + e * (ring.notch / 2);
        g.moveTo(Math.cos(s) * (r - 5 * dpr), Math.sin(s) * (r - 5 * dpr));
        g.lineTo(Math.cos(s) * (r + 5 * dpr), Math.sin(s) * (r + 5 * dpr));
      }
    }
    g.strokeStyle = `rgba(${P.hot}, ${hot})`;
    g.lineWidth = 1.5 * dpr;
    g.stroke();
    // A catch throws light out of both keyways.
    if (flare > 0.01) {
      g.beginPath();
      g.moveTo(0, -r + 8 * dpr); g.lineTo(0, -r - 0.09 * u * scale * (1 + flare));
      g.moveTo(0, r - 8 * dpr); g.lineTo(0, r + 0.09 * u * scale * (1 + flare));
      g.strokeStyle = `rgba(${P.hot}, ${0.9 * flare * a})`;
      g.lineWidth = 2 * dpr;
      g.stroke();
      g.strokeStyle = `rgba(${P.glow}, ${0.3 * flare * a})`;
      g.lineWidth = 9 * dpr;
      g.stroke();
    }
  }

  function drawPlate(pl: Plate, x: number, y: number, size: number, alpha: number, heat: number, crack: number) {
    if (alpha <= 0.002 || size < 1) return;
    g.save();
    g.translate(x, y);
    const k = size / 24;
    g.scale(k, k);
    g.translate(-12, -12);
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(6, 14, 32, 0.94)';
    g.fill(pl.frame);
    // The grade's own colour, taking the light's as it heats, white at the last.
    const rgb = heat < 0.7 ? mix(pl.rgb, P.heat, heat / 0.7) : mix(P.heat, P.white, (heat - 0.7) / 0.3);
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const w = pl.weight ?? 1;
    g.strokeStyle = `rgba(${rgb}, ${0.22 + heat * 0.3})`;
    g.lineWidth = 3.4;
    g.stroke(pl.frame);
    g.lineWidth = 4.4 * w;
    g.stroke(pl.rune);
    g.strokeStyle = `rgb(${rgb})`;
    g.lineWidth = 1.1;
    g.stroke(pl.frame);
    g.globalAlpha = alpha * 0.6;
    for (const e of pl.extras) g.stroke(e);
    g.globalAlpha = alpha;
    if (pl.rays) { g.lineWidth = 1.4; g.stroke(pl.rays); }
    g.fillStyle = `rgb(${rgb})`;
    if (pl.nodes) g.fill(pl.nodes);
    if (pl.halo) {
      g.save();
      g.translate(12, 12);
      g.rotate(calm ? 0 : t * 0.00035);
      for (let n = 0; n < 12; n++) { g.rotate(TAU / 12); g.fillRect(-0.3, -12, 0.6, 2.2); }
      g.restore();
    }
    g.lineWidth = 1.8 * w;
    g.stroke(pl.rune);
    if (crack > 0) {
      g.beginPath();
      CRACKS.forEach((pts, n) => {
        const p = span(crack, n * 0.09, n * 0.09 + 0.5) * (pts.length - 1);
        if (p <= 0) return;
        g.moveTo(pts[0][0], pts[0][1]);
        const whole = Math.floor(p);
        for (let j = 1; j <= whole; j++) g.lineTo(pts[j][0], pts[j][1]);
        if (whole < pts.length - 1) {
          const f = p - whole;
          const [ax, ay] = pts[whole];
          const [bx, by] = pts[whole + 1];
          g.lineTo(lerp(ax, bx, f), lerp(ay, by, f));
        }
      });
      g.strokeStyle = `rgba(${P.glow}, ${0.45 * crack})`;
      g.lineWidth = 1.8;
      g.stroke();
      g.strokeStyle = `rgba(${P.hot}, ${Math.min(1, crack * 1.6)})`;
      g.lineWidth = 0.55;
      g.stroke();
    }
    g.restore();
  }

  function glow(img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number) {
    if (alpha <= 0.002 || size < 1) return;
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(img, x - size / 2, y - size / 2, size, size);
    g.globalAlpha = 1;
  }

  function drawBurst(b: ReturnType<typeof burstOf>, at: number, power: number) {
    const age = t - at;
    if (age < 0 || age > 2600) return;
    // Rays, all in one path under one gradient.
    const ray = 1 - span(age, 0, 1500);
    if (ray > 0) {
      g.beginPath();
      for (const r of b.rays) {
        const a = r.a + age * 0.00006;
        const len = r.len * diag * 0.6;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a - r.w) * len, Math.sin(a - r.w) * len);
        g.lineTo(Math.cos(a + r.w) * len, Math.sin(a + r.w) * len);
        g.closePath();
      }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, diag * 0.6);
      gr.addColorStop(0, `rgba(${P.hot}, ${0.55 * ray * ray * power * (calm ? 0.5 : 1)})`);
      gr.addColorStop(0.35, `rgba(${P.glow}, ${0.22 * ray * ray * power * (calm ? 0.5 : 1)})`);
      gr.addColorStop(1, `rgba(${P.glow}, 0)`);
      g.fillStyle = gr;
      g.fill();
    }
    if (calm) return;
    // Two shockwaves.
    for (const [delay, dur] of [[0, 950], [130, 1250]]) {
      const p = span(age, delay, delay + dur);
      if (p <= 0 || p >= 1) continue;
      const r = diag * 0.75 * outCubic(p);
      const fade = (1 - p) ** 1.4 * power;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.strokeStyle = `rgba(${P.glow}, ${0.25 * fade})`;
      g.lineWidth = (40 * (1 - p) ** 2 + 4) * dpr;
      g.stroke();
      g.strokeStyle = `rgba(${P.hot}, ${0.9 * fade})`;
      g.lineWidth = (14 * (1 - p) ** 2 + 1) * dpr;
      g.stroke();
    }
    // Motes thrown out, slowing as they go.
    const tau = 420;
    for (const m of b.motes) {
      const life = 1 - age / m.life;
      if (life <= 0) continue;
      const d = m.v * u * (tau / 1000) * (1 - Math.exp(-age / tau));
      const x = Math.cos(m.a) * d;
      const y = Math.sin(m.a) * d - age * 0.00002 * u;
      glow(m.hot ? HOT : GLOW, x, y, m.size * u * (m.hot ? 1.2 : 2), life ** 1.6 * power);
    }
    // The plate's shards, tumbling.
    for (const s of b.shards) {
      const life = 1 - age / 1700;
      if (life <= 0) continue;
      const d = s.v * u * 0.45 * (1 - Math.exp(-age / 380));
      g.save();
      g.translate(Math.cos(s.a) * d, Math.sin(s.a) * d);
      g.rotate(s.tilt + s.spin * age);
      const z = s.size * u;
      g.beginPath();
      g.moveTo(0, -z);
      g.lineTo(z * 0.7, z * 0.5);
      g.lineTo(-z * 0.5, z * 0.7);
      g.closePath();
      g.fillStyle = `rgba(${P.soft}, ${0.5 * life})`;
      g.fill();
      g.strokeStyle = `rgba(${P.hot}, ${life})`;
      g.lineWidth = dpr;
      g.stroke();
      g.restore();
    }
  }

  /** The new rank's plate out of the light: white-hot, landing, cooling into its own colour, then up out of the window's way. */
  function drawRise(sx: number, sy: number) {
    if (!RISE || !RISE_GLOW || t < T.breach) return;
    const p = span(t, T.breach + 40, T.breach + 1100);
    const land = calm ? p : Math.max(0, outBack(p));
    const up = calm ? span(t, T.open - 400, T.open) : outCubic(span(t, T.open - 400, T.open + 500));
    const y = lerp(0, H * 0.2 - cy, up);
    const size = 0.26 * u * lerp(1, 0.8, up) * land;
    const shown = Math.min(1, p * 2.2);
    const breathe = calm ? 0 : 0.12 * Math.sin(t * 0.003);
    g.setTransform(1, 0, 0, 1, cx + sx, cy + sy);
    g.globalCompositeOperation = 'lighter';
    // Rays of its own colour behind it, turning.
    g.beginPath();
    for (const r of HALO_RAYS) {
      const a = r.a + (calm ? 0 : t * 0.00012);
      const len = r.len * size;
      g.moveTo(0, y);
      g.lineTo(Math.cos(a - r.w) * len, y + Math.sin(a - r.w) * len);
      g.lineTo(Math.cos(a + r.w) * len, y + Math.sin(a + r.w) * len);
      g.closePath();
    }
    const gr = g.createRadialGradient(0, y, 0, 0, y, Math.max(1, size * 3));
    gr.addColorStop(0, `rgba(${RISE.rgb.join(', ')}, ${0.4 * shown})`);
    gr.addColorStop(1, `rgba(${RISE.rgb.join(', ')}, 0)`);
    g.fillStyle = gr;
    g.fill();
    glow(RISE_GLOW, 0, y, size * 3.4, (0.5 + breathe) * shown);
    glow(HOT, 0, y, size * 1.4, 0.5 * (1 - span(t, T.breach + 200, T.breach + 1600)) * shown);
    // Plates are drawn from the corner, as everywhere else here.
    g.setTransform(1, 0, 0, 1, sx, sy);
    drawPlate(RISE, cx, cy + y, size, shown, 1 - span(t, T.breach + 250, T.breach + 1700), 0);
  }

  function frame(now: number) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, Math.max(0, now - last));
    last = now;
    t += dt;
    for (const c of cues) if (!c.done && t >= c.at) { c.done = true; c.run(); }
    draw(dt);
  }

  function draw(dt: number) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);

    // The dark, closing over what was on screen.
    const dark = calm ? span(t, 0, T.dark) : outCubic(span(t, 0, T.dark));
    g.fillStyle = `rgba(2, 4, 11, ${dark})`;
    g.fillRect(0, 0, W, H);

    // The hold, eased. Letting go for longer than a gong's gap lets the light fall back.
    if (!sealAt && t - lastTick > 1150) want = 0;
    level += (want - level) * Math.min(1, dt / 140);

    // After the breach: the light's own dark, deepest at the heart.
    const after = outCubic(span(t, T.breach + 60, T.breach + 1900));
    if (after > 0) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.62);
      const k = after * (1 + level * 0.9);
      gr.addColorStop(0, `rgba(${P.deep[0]}, ${0.34 * k})`);
      gr.addColorStop(0.45, `rgba(${P.deep[1]}, ${0.22 * k})`);
      gr.addColorStop(1, 'rgba(2, 4, 11, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }

    // Shake: a knock at every catch, a rumble while it pours, the breach, the seal.
    let quake = 0;
    if (!calm) {
      T.catches.forEach((c, k) => { quake += (2 + k * 1.3) * decay(t, c, 110); });
      if (t < T.hush) quake += 5 * span(t, T.catches[final], T.fold) ** 2;
      quake += 14 * decay(t, T.breach, 240);
      if (sealAt) quake += 9 * decay(t, sealAt, 260);
    }
    const sx = quake * dpr * Math.sin(t * 0.093 + 1.3) * Math.cos(t * 0.041);
    const sy = quake * dpr * Math.sin(t * 0.077) * Math.cos(t * 0.057 + 0.4);
    const tear = calm ? null : T.tears.find(([at, ms]) => t >= at && t < at + ms);
    const jolt = tear ? (rng(tear[0])() - 0.5) * 22 * dpr : 0;
    g.setTransform(1, 0, 0, 1, cx + sx + jolt, cy + sy);
    g.globalCompositeOperation = 'lighter';

    // The heartbeat.
    let beat = 0;
    for (const b of T.beats) beat += decay(t, b, 200) + 0.6 * decay(t, b + 200, 180);
    beat = Math.min(1.2, beat);
    const fold = span(t, T.fold, T.hush);
    const shrink = calm ? 1 : 1 - inCubic(fold);
    const fade = calm ? 1 - fold : 1;
    const heat = span(t, T.catches[final], T.fold + 200);
    if (t < T.hush) {
      const formed = decay(t, T.form, 320);
      glow(GLOW, 0, 0, u * (0.45 + beat * 0.35 + heat * 0.5) * shrink, (0.1 + beat * 0.32 + formed * 0.5 + heat * 0.5) * span(t, 300, 1300) * fade);
      for (const b of T.beats) {
        const p = span(t, b, b + 1000);
        if (p <= 0 || p >= 1 || calm) continue;
        g.beginPath();
        g.arc(0, 0, lerp(0.09, 0.6, outCubic(p)) * u, 0, TAU);
        g.strokeStyle = `rgba(${P.glow}, ${0.22 * (1 - p) ** 2})`;
        g.lineWidth = 1.5 * dpr;
        g.stroke();
      }
    }

    // What is left of the lock after the breach, slow behind the window, answering the hold.
    if (script.idle && t > T.breach) {
      const gone = sealAt ? outCubic(span(t, sealAt, sealAt + 1400)) : 0;
      const a = (0.16 + 0.62 * level) * span(t, T.breach + 300, T.breach + 2200) * (1 - gone);
      if (!calm) RINGS.forEach((ring, i) => { idle[i] += Math.sign(ring.turns) * (0.00005 + 0.00003 * i) * (1 + 8 * level + 20 * gone) * dt; });
      for (let i = 0; i < RINGS.length; i++) drawRing(i, 1.38 + 0.05 * level + (calm ? 0 : 1.1 * gone), idle[i], a, 1, level * 0.6);
      for (const p of pulses) {
        const q = span(t, p.at, p.at + 1100);
        if (q <= 0 || q >= 1) continue;
        g.beginPath();
        g.arc(0, 0, lerp(0.2, calm ? 0.2 : 0.95, outCubic(q)) * u, 0, TAU);
        g.strokeStyle = `rgba(${P.soft}, ${0.5 * p.k * (1 - q) ** 2})`;
        g.lineWidth = (3 * (1 - q) + 1) * dpr;
        g.stroke();
      }
    }

    // The lock, working.
    if (t >= T.form && t < T.hush) {
      g.save();
      if (!calm) g.rotate(2.4 * inCubic(fold));
      g.scale(shrink, shrink);
      for (let i = 0; i < RINGS.length; i++) {
        const drawIn = calm ? span(t, formAt(T, i), formAt(T, i) + 650) : outCubic(span(t, formAt(T, i), formAt(T, i) + 650));
        const ang = calm ? 0 : lockAngle(T, i, t);
        const flare = decay(t, T.catches[i], 280) + heat * 0.5;
        const a = (calm ? drawIn : 1) * fade;
        if (tear) {
          // The tear splits the colour: a magenta ghost of the ring, knocked off register.
          g.save();
          g.translate(6 * dpr, -2 * dpr);
          drawRing(i, 1, ang, a, drawIn, flare, '255, 60, 120');
          g.restore();
        }
        drawRing(i, 1, ang, a, drawIn, flare);
      }
      // The keyway open: a beam straight through every ring, top to bottom.
      const open = outCubic(span(t, T.catches[final], T.catches[final] + 450));
      if (open > 0) {
        const grow = span(t, T.catches[final], T.fold);
        const len = lerp(RINGS[final].r * u, H / shrink, open);
        const flick = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 0.07) * Math.sin(t * 0.031);
        const gr = g.createLinearGradient(0, -len, 0, len);
        gr.addColorStop(0, `rgba(${P.glow}, 0)`);
        gr.addColorStop(0.5, `rgba(${P.hot}, 1)`);
        gr.addColorStop(1, `rgba(${P.glow}, 0)`);
        g.strokeStyle = gr;
        const wide = (2 + 10 * grow) * dpr;
        for (const [w, al] of [[wide * 6, 0.1], [wide * 2, 0.3], [wide * 0.5, 0.95]]) {
          g.globalAlpha = al * open * flick * fade;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(0, -len);
          g.lineTo(0, len);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      g.restore();
    }

    // Light drawn in from everywhere while it pours.
    if (!calm && t < T.hush) {
      if (t > T.catches[final - 1]) {
        owed += (dt / 1000) * lerp(30, 340, span(t, T.catches[final - 1], T.fold) ** 2);
        while (owed >= 1) {
          owed -= 1;
          inflow.push({ b: t, life: 500 + pull() * 550, a0: pull() * TAU, r0: (0.35 + pull() * 0.35) * diag, spin: (pull() - 0.5) * 2.6 });
        }
      }
      g.beginPath();
      for (let n = inflow.length - 1; n >= 0; n--) {
        const m = inflow[n];
        const p = (t - m.b) / m.life;
        if (p >= 1) { inflow.splice(n, 1); continue; }
        const at = (q: number) => {
          const r = m.r0 * (1 - q * q);
          const a = m.a0 + m.spin * q;
          return [Math.cos(a) * r, Math.sin(a) * r];
        };
        const [x1, y1] = at(p);
        const [x0, y0] = at(Math.max(0, p - 0.07));
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
      }
      g.strokeStyle = `rgba(${P.soft}, 0.55)`;
      g.lineWidth = 1.4 * dpr;
      g.stroke();
    } else if (inflow.length) inflow.length = 0;

    // The plate: lifted off where it was shown, carried into the dark, then cracking.
    if (t < T.hush) {
      const S = 0.17 * u * (1 + 0.07 * beat) * shrink;
      const crack = span(t, T.catches[final] + 150, T.fold);
      const f = opts.from;
      const glide = T.dark + 400;
      g.setTransform(1, 0, 0, 1, sx + jolt, sy);
      if (f && calm) {
        const k = span(t, 300, glide - 200);
        drawPlate(PLATE, f.x * dpr, f.y * dpr, f.size * dpr, 1 - k, 0, 0);
        drawPlate(PLATE, cx, cy, S, k * fade, heat, crack);
      } else if (f) {
        const k = outCubic(span(t, 150, glide));
        drawPlate(PLATE, lerp(f.x * dpr, cx, k), lerp(f.y * dpr, cy, k), lerp(f.size * dpr, S, k), fade, heat, crack);
      } else {
        drawPlate(PLATE, cx, cy, S, span(t, 200, 1000) * fade, heat, crack);
      }
      g.setTransform(1, 0, 0, 1, cx + sx + jolt, cy + sy);
      g.globalCompositeOperation = 'lighter';
      if (heat > 0) glow(HOT, 0, 0, 0.12 * u * shrink, heat * 0.6 * fade);
    }

    // One point left in the silence, trembling.
    if (t >= T.fold && t < T.breach) {
      const z = t < T.hush ? lerp(0.22, 0.05, fold) : 0.05 + 0.012 * Math.sin(t * 0.09);
      glow(HOT, calm ? 0 : Math.sin(t * 0.21) * dpr, 0, z * u, 1);
    }

    // The breach, and later the seal.
    if (t >= T.breach) drawBurst(BREACH, T.breach, 1);
    if (sealAt) drawBurst(SEAL, sealAt, 0.75);

    // Motes rising through the after.
    if (after > 0) {
      for (const m of DRIFT) {
        const y = (((m.y - (calm ? 0 : (t - T.breach) * m.v * 0.0001 * (1 + 3 * level))) % 1) + 1) % 1;
        const tw = 0.5 + 0.5 * Math.sin(t * 0.0015 + m.ph);
        glow(GLOW, m.x * W - cx, y * H - cy, m.size * u * 3, 0.5 * after * tw * (1 + level));
      }
    }

    // A rank's new plate, above everything but the flash.
    drawRise(sx, sy);

    // The tear: a few bright lines across the picture.
    if (tear) {
      const r = rng(tear[0] + Math.floor(t / 30));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'lighter';
      for (let n = 0; n < 5; n++) {
        g.fillStyle = `rgba(${r() < 0.5 ? P.soft : '255, 80, 140'}, ${0.12 + r() * 0.2})`;
        const y = r() * H;
        const x = r() * W * 0.4;
        g.fillRect(x, y, W - x * r(), (1 + r() * 5) * dpr);
      }
    }

    // The flash on top of everything.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    let white = (calm ? 0.45 : 0.95) * decay(t, T.breach, calm ? 520 : 200);
    if (sealAt) white += (calm ? 0.3 : 0.6) * decay(t, sealAt, calm ? 520 : 220);
    if (white > 0.003) {
      // White at the heart, falling off to the light's own colour, so a fading flash reads as light, not fog.
      const w = Math.min(1, white);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.6);
      gr.addColorStop(0, `rgba(${P.flash[0]}, ${w})`);
      gr.addColorStop(0.4, `rgba(${P.flash[1]}, ${w * 0.82})`);
      gr.addColorStop(1, `rgba(${P.flash[2]}, ${w * 0.6})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
  }

  // The first picture goes up before the browser paints, so the plate never blinks off where it was.
  draw(0);
  raf = requestAnimationFrame((now) => { last = now; frame(now); });

  const ctl: ArrivalCtl = {
    ready: readyP,
    skip() {
      if (!opts.skippable || t >= T.hush) return;
      t = T.hush;
      for (const c of cues) if (c.at < T.hush && !c.done) { c.done = true; if (c.at === T.dark) c.run(); }
      stopSurge();
      stopHum();
    },
    charge(step, of) {
      want = of ? clamp(step / of) : 0;
      lastTick = t;
      pulses.push({ at: t, k: want });
      if (pulses.length > 8) pulses.shift();
    },
    seal() {
      sealAt = t;
      want = 1;
      level = 1;
      // The light settles to an ember under the second window.
      setTimeout(() => { want = 0.25; }, 900);
    },
    leave() {
      canvas.classList.add('is-leaving');
      stopGlow();
      music.hush(false);
      return new Promise((r) => setTimeout(r, calm ? 80 : 760));
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      delete document.documentElement.dataset.arrival;
      stopHum();
      stopSurge();
      stopGlow();
      music.hush(false);
      ready();
    },
  };
  return ctl;
}
