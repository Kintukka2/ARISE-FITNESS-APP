/**
 * Every sound in the app, synthesised with WebAudio: no files, no network.
 * Effects and the score share one context, started by the first gesture.
 */

let ctx: AudioContext | null = null;
let fx: GainNode | null = null;
let bus: GainNode | null = null;
let unlocked = false;
let soundOn = () => true;
let musicOn = () => true;

export function configure(opts: { sound: () => boolean; music: () => boolean }) {
  soundOn = opts.sound;
  musicOn = opts.music;
}

function ac(): AudioContext | null {
  // Browsers refuse audio before a gesture; asking early only earns a console warning.
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    fx = ctx.createGain();
    fx.gain.value = 0.22;
    fx.connect(ctx.destination);
    bus = ctx.createGain();
    bus.gain.value = 1e-4;
    bus.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number, out?: AudioNode) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(1e-4, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
  o.connect(g);
  g.connect(out ?? fx!);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noise(start: number, dur: number, gain = 0.15, hz = 1200, type: BiquadFilterType = 'lowpass', out?: AudioNode, at?: number) {
  const c = ac();
  if (!c) return;
  const t0 = at ?? c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(out ?? fx!);
  src.start(t0);
}

// ------------------------------------------------------------------ sustained voices

const noop = () => {};

/** A sound that lasts until it is cut: everything in it runs through one gain, and `stop` fades it. */
interface Voice { c: AudioContext; out: GainNode; keep: (src: AudioScheduledSourceNode) => void; stop: (fade?: number) => void }

function voice(): Voice | null {
  const c = ac();
  if (!c) return null;
  const out = c.createGain();
  out.connect(fx!);
  const held: AudioScheduledSourceNode[] = [];
  let done = false;
  return {
    c,
    out,
    keep: (src) => void held.push(src),
    stop: (fade = 0.04) => {
      if (done) return;
      done = true;
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(1e-4, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(1e-4, t + fade);
      for (const s of held) { try { s.stop(t + fade + 0.02); } catch { /* already stopped */ } }
      setTimeout(() => out.disconnect(), (fade + 0.2) * 1000);
    },
  };
}

let hissBuf: AudioBuffer | null = null;
function hissSource(c: AudioContext) {
  if (!hissBuf) {
    hissBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = hissBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = hissBuf;
  src.loop = true;
  return src;
}

/** An oscillator that swells from one gain to another across its length, then cuts dead. */
function swell(out: AudioNode, freq: number, slideTo: number, start: number, dur: number, type: OscillatorType, from: number, to: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(Math.max(1e-4, from), t0);
  g.gain.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
  o.connect(g);
  g.connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Filtered noise that swells and sweeps across its length, then cuts dead. */
function hiss(out: AudioNode, start: number, dur: number, type: BiquadFilterType, hz: number, hzTo: number, from: number, to: number, q = 1) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const src = hissSource(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(hz, t0);
  f.frequency.exponentialRampToValueAtTime(hzTo, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(1e-4, from), t0);
  g.gain.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.linearRampToValueAtTime(0, t0 + dur + 0.02);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** A steady tone held in a voice until the voice stops. */
function drone(v: Voice, freq: number, gain: number, type: OscillatorType = 'sine') {
  const o = v.c.createOscillator();
  const g = v.c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(v.out);
  o.start();
  v.keep(o);
}

const on = () => soundOn();
let ticker: ReturnType<typeof setInterval> | null = null;

export const sfx = {
  unlock: () => void ac(),
  tap: () => on() && tone(520, 0, 0.05, 'triangle', 0.09),
  blip: () => on() && tone(880, 0, 0.07, 'square', 0.1),
  ping: () => {
    if (!on()) return;
    tone(1320, 0, 0.1, 'sine', 0.24);
    tone(1760, 0.055, 0.22, 'sine', 0.18);
    tone(880, 0.02, 0.3, 'triangle', 0.07);
  },
  success: () => {
    if (!on()) return;
    tone(660, 0, 0.09, 'sine', 0.2);
    tone(990, 0.07, 0.16, 'sine', 0.18);
  },
  signTick: (step: number, of: number) => {
    if (!on()) return;
    const p = of ? step / of : 0;
    tone(300 + p * 420, 0, 0.07, 'triangle', 0.075, 340 + p * 480);
    noise(0, 0.05, 0.035, 900 + p * 1400);
  },
  sealed: () => {
    if (!on()) return;
    tone(140, 0, 0.26, 'sawtooth', 0.2, 60);
    noise(0, 0.22, 0.14, 700);
    [784, 1047, 1568].forEach((f, i) => tone(f, 0.1 + i * 0.07, 0.5, 'sine', 0.19));
    tone(196, 0.1, 0.9, 'triangle', 0.08);
  },
  awakenGong: (step: number, of: number) => {
    if (!on()) return;
    const p = Math.min(1, step / Math.max(1, of));
    const root = 62 - p * 16;
    const loud = 0.16 + p * 0.3;
    const ring = 1.8 + p * 1.6;
    noise(0, 0.09 + p * 0.05, 0.1 + p * 0.1, 2200 + p * 1800);
    tone(root * 6, 0, 0.16, 'square', 0.03 + p * 0.03, root * 3);
    tone(root, 0, ring, 'sine', loud, root * 0.86);
    tone(root * 2.01, 0, ring * 0.7, 'sine', loud * 0.5);
    tone(root * 2.76, 0, ring * 0.5, 'triangle', loud * 0.26);
    tone(root * 4.09, 0, ring * 0.34, 'triangle', loud * 0.14);
    if (p > 0.5) noise(0.02, ring * 0.5, 0.012 + (p - 0.5) * 0.03, 6000);
  },
  awakenSeal: () => {
    if (!on()) return;
    tone(44, 0, 3.2, 'sine', 0.34, 30);
    noise(0, 0.5, 0.1, 900);
    [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98, 2093].forEach((f, i) => {
      tone(f, 0.18 + i * 0.075, 1.5 - i * 0.08, 'sine', 0.2 - i * 0.014);
      tone(f * 2, 0.18 + i * 0.075, 0.5, 'triangle', 0.045);
    });
    [261.63, 392, 587.33].forEach((f) => tone(f, 0.6, 2.6, 'sine', 0.055));
    noise(0.7, 1.8, 0.02, 9000);
  },

  // The Arrival (ui/arrival.ts), between the office and the first Notification. Its lock catches on
  // C minor and it breaks open on a bare fifth, so the seal's C major above is where it resolves.

  /** The room going wrong: a low beating hum that swells for `secs`, then holds until it is stopped. */
  hum: (secs: number): (() => void) => {
    if (!on()) return noop;
    const v = voice();
    if (!v) return noop;
    const t = v.c.currentTime;
    v.out.gain.setValueAtTime(1e-4, t);
    v.out.gain.exponentialRampToValueAtTime(0.55, t + 1.4);
    v.out.gain.linearRampToValueAtTime(1, t + Math.max(1.5, secs));
    drone(v, 65.41, 0.24);
    drone(v, 66.07, 0.2);
    drone(v, 130.81, 0.05, 'triangle');
    drone(v, 196.5, 0.016);
    const n = hissSource(v.c);
    const f = v.c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = v.c.createGain();
    g.gain.value = 0.07;
    n.connect(f); f.connect(g); g.connect(v.out);
    n.start();
    v.keep(n);
    return () => v.stop(0.05);
  },
  /** One heartbeat, lub and dub. `p` from 0 to 1 brings it closer and louder. */
  heartbeat: (p: number) => {
    if (!on()) return;
    const g = 0.42 + p * 0.22;
    const dub = 0.21 - p * 0.05;
    tone(74, 0, 0.21, 'sine', g, 36);
    tone(148, 0, 0.09, 'sine', g * 0.32, 72);
    noise(0, 0.05, 0.09, 240);
    tone(64, dub, 0.18, 'sine', g * 0.72, 34);
    tone(128, dub, 0.07, 'sine', g * 0.24, 64);
  },
  /** The lock's rings drawing out of the dark. */
  lockForm: () => {
    if (!on()) return;
    tone(98, 0, 1.2, 'triangle', 0.1, 392);
    tone(196, 0.05, 1, 'sine', 0.06, 784);
    [1568, 2093, 2637, 3136, 4186].forEach((f, i) => tone(f, 0.14 + i * 0.075, 0.4, 'triangle', 0.032));
    noise(0.05, 0.8, 0.03, 5200, 'highpass');
  },
  /** A ring of the lock catching: a tumbler's clunk under a note that climbs C minor. */
  lockCatch: (step: number, of: number) => {
    if (!on()) return;
    const p = of > 1 ? (step - 1) / (of - 1) : 1;
    const f = [523.25, 622.25, 783.99, 1046.5][Math.round(p * 3)];
    tone(132 - p * 30, 0, 0.24, 'sine', 0.36 + p * 0.1, 46);
    tone(2400 + p * 900, 0, 0.03, 'square', 0.05);
    noise(0, 0.09, 0.16, 2600 + p * 1400, 'bandpass');
    tone(f, 0.03, 1, 'sine', 0.13);
    tone(f * 2.01, 0.03, 0.45, 'sine', 0.045);
    tone(f / 2, 0.03, 0.8, 'triangle', 0.05);
  },
  /** Light pouring through the open lock: a riser across `secs`, cut by the returned stop. */
  surge: (secs: number): (() => void) => {
    if (!on()) return noop;
    const v = voice();
    if (!v) return noop;
    hiss(v.out, 0, secs, 'bandpass', 380, 7200, 0.012, 0.22, 1.4);
    swell(v.out, 65.41, 261.63, 0, secs, 'sawtooth', 0.01, 0.06);
    swell(v.out, 98, 392, 0, secs, 'sawtooth', 0.006, 0.04);
    swell(v.out, 523.25, 2093, 0, secs, 'sine', 0.004, 0.05);
    return () => v.stop(0.03);
  },
  /** Everything drawn into one point across `secs`, ending dead on the silence. */
  fold: (secs: number) => {
    if (!on() || !ac()) return;
    hiss(fx!, 0, secs, 'highpass', 900, 5200, 0.01, 0.26);
    swell(fx!, 420, 38, 0, secs, 'sine', 0.05, 0.34);
    swell(fx!, 840, 76, 0, secs, 'triangle', 0.01, 0.07);
  },
  /** The lock breaking open: a crack, a long boom, and a bare fifth ringing over it. */
  breach: () => {
    if (!on()) return;
    tone(58, 0, 2.9, 'sine', 0.5, 26);
    tone(116, 0, 1.3, 'sine', 0.18, 52);
    tone(190, 0, 0.45, 'triangle', 0.22, 60);
    noise(0, 0.14, 0.32, 2600, 'highpass');
    noise(0, 1.7, 0.2, 1100);
    noise(0.05, 2.5, 0.03, 8000, 'highpass');
    [523.25, 783.99, 1046.5, 1567.98, 2093, 3135.96].forEach((f, i) => {
      tone(f, 0.04 + i * 0.045, 2.5 - i * 0.2, 'sine', 0.13 - i * 0.012);
      tone(f * 1.003, 0.06 + i * 0.045, 1.7 - i * 0.15, 'triangle', 0.03);
    });
  },
  /** What is left after: an open fifth held low until it is stopped. */
  afterglow: (): (() => void) => {
    if (!on()) return noop;
    const v = voice();
    if (!v) return noop;
    const t = v.c.currentTime;
    v.out.gain.setValueAtTime(1e-4, t);
    v.out.gain.exponentialRampToValueAtTime(1, t + 3.5);
    drone(v, 130.81, 0.05);
    drone(v, 131.42, 0.035);
    drone(v, 196, 0.032);
    drone(v, 261.63, 0.016, 'triangle');
    return () => v.stop(1.6);
  },

  /** A piece of loot turning over. The higher its grade (E to S), the more of it rings. */
  loot: (rank: string) => {
    if (!on()) return;
    const n = Math.max(0, 'EDCBAS'.indexOf(rank));
    if (n === 0) {
      tone(620, 0, 0.08, 'triangle', 0.1, 760);
      noise(0, 0.05, 0.05, 3200, 'highpass');
      return;
    }
    // A bright climb, one note more for every grade.
    [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98].slice(0, n + 1).forEach((f, i) => {
      tone(f, i * 0.055, 0.32 + n * 0.06, 'sine', 0.11 + n * 0.012);
      tone(f * 2, i * 0.055, 0.16, 'triangle', 0.028);
    });
    noise(0, 0.08 + n * 0.03, 0.05 + n * 0.015, 4200 + n * 700, 'highpass');
    // Weight under it from Epic up.
    if (n >= 3) tone(118 - n * 8, 0, 0.5 + n * 0.18, 'sine', 0.18 + n * 0.04, 48);
    // Heroic holds a chord over the climb.
    if (n >= 4) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.32 + i * 0.04, 1.5, 'sine', 0.06));
      noise(0.05, 1.3, 0.03, 9000, 'highpass');
    }
    // Legendary breaks open: a boom, a crack, and a shimmer that hangs.
    if (n >= 5) {
      tone(55, 0, 2.4, 'sine', 0.46, 27);
      noise(0, 0.14, 0.26, 2400, 'highpass');
      [1046.5, 1318.51, 1567.98, 2093, 2637.02].forEach((f, i) => tone(f, 0.5 + i * 0.07, 1.8 - i * 0.12, 'sine', 0.07));
    }
  },
  /** Loot of a high grade gathering itself before it turns over, across `secs`. */
  lootCharge: (rank: string, secs: number) => {
    if (!on() || !ac()) return;
    const n = Math.max(0, 'EDCBAS'.indexOf(rank));
    swell(fx!, 200 + n * 40, 760 + n * 220, 0, secs, 'triangle', 0.01, 0.07 + n * 0.02);
    hiss(fx!, 0, secs, 'bandpass', 600, 4800 + n * 600, 0.005, 0.07 + n * 0.02, 1.2);
    if (n >= 4) swell(fx!, 55, 82, 0, secs, 'sine', 0.02, 0.22);
  },
  levelUp: () => {
    if (!on()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone(f, i * 0.085, 0.42, 'sine', 0.22);
      tone(f / 2, i * 0.085, 0.42, 'triangle', 0.08);
    });
    noise(0.42, 0.7, 0.06, 4000);
  },
  /** A point going into the skill tree: a crystal chime, higher for a higher tier, and a deeper one under a new skill or passive. */
  learn: (tier: number, fresh: boolean) => {
    if (!on()) return;
    const root = 523 * Math.pow(2, tier / 6);
    tone(root, 0, 0.32, 'sine', 0.2);
    tone(root * 1.5, 0.06, 0.36, 'sine', 0.16);
    tone(root * 2, 0.12, 0.5, 'triangle', 0.08);
    if (fresh) {
      tone(root / 2, 0, 0.7, 'sine', 0.16, root / 4);
      tone(root * 3, 0.2, 0.6, 'sine', 0.07);
      noise(0.05, 0.5, 0.05, 5200);
    }
  },
  rankUp: () => {
    if (!on()) return;
    tone(110, 0, 1.5, 'sawtooth', 0.1, 220);
    [392, 523, 659, 784, 1047, 1568].forEach((f, i) => tone(f, 0.18 + i * 0.1, 0.6, 'sine', 0.2));
    noise(0.1, 1.4, 0.08, 2600);
  },
  alarm: () => {
    if (!on()) return;
    tone(220, 0, 0.35, 'sawtooth', 0.22, 90);
    tone(233, 0.28, 0.4, 'sawtooth', 0.2, 80);
    noise(0, 0.5, 0.1, 700);
  },
  window: (kind: string) => {
    if (!on()) return;
    const danger = kind === 'danger';
    tone(danger ? 44 : 58, 0, 0.85, 'sine', 0.3, danger ? 26 : 34);
    noise(0, 0.3, danger ? 0.16 : 0.11, danger ? 500 : 1400);
    tone(danger ? 210 : 1320, 0.1, 0.13, danger ? 'sawtooth' : 'sine', 0.24);
    tone(danger ? 233 : 1760, 0.17, 0.26, danger ? 'sawtooth' : 'sine', 0.19);
    const base = danger ? 330 : kind === 'gold' ? 784 : 1174;
    [1, 1.5, 2.02, 2.51].forEach((m, i) => tone(base * m, 0.22 + i * 0.05, 0.5, 'triangle', 0.05));
    if (kind === 'gold') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.42 + i * 0.09, 0.5, 'sine', 0.17));
    if (kind === 'shadow') {
      tone(48, 0, 1.6, 'sine', 0.22, 30);
      tone(72, 0.05, 1.4, 'triangle', 0.12, 46);
      noise(0.15, 1, 0.06, 420);
      [196, 233].forEach((f, i) => tone(f, 0.5 + i * 0.16, 0.9, 'sine', 0.08));
    }
    if (kind === 'gates') {
      tone(70, 0, 1.1, 'sawtooth', 0.16, 40);
      noise(0.08, 0.5, 0.1, 900);
      [392, 523, 659].forEach((f, i) => tone(f, 0.26 + i * 0.09, 0.55, 'triangle', 0.15));
    }
    if (kind === 'gear') {
      tone(2093, 0.3, 0.16, 'sine', 0.16);
      tone(1568, 0.38, 0.36, 'sine', 0.14);
      noise(0.3, 0.1, 0.05, 5200);
    }
  },
  /** The Gate turning red: a boom that falls away under a long rumble. */
  redGate: () => {
    if (!on()) return;
    tone(98, 0, 2.6, 'sawtooth', 0.26, 31);
    tone(46, 0, 3, 'sine', 0.34, 24);
    tone(139, 0.05, 1.8, 'square', 0.07, 52);
    noise(0, 2.6, 0.16, 320);
  },
  /** A count climbing: a tick that rises with it, `p` from 0 to 1. */
  countTick: (p: number) => on() && tone(260 + p * 900, 0, 0.03, 'square', 0.05 + p * 0.04),
  /** A count landing on its number, hard. */
  slam: () => {
    if (!on()) return;
    tone(70, 0, 0.5, 'sine', 0.42, 30);
    tone(180, 0, 0.18, 'sawtooth', 0.2, 60);
    noise(0, 0.35, 0.22, 900);
  },
  shadowLost: () => {
    if (!on()) return;
    tone(150, 0, 0.9, 'sine', 0.16, 44);
    tone(110, 0.12, 1.1, 'triangle', 0.12, 34);
    noise(0.1, 0.8, 0.05, 300);
  },
  gate: () => {
    if (!on()) return;
    tone(60, 0, 2, 'sawtooth', 0.16, 150);
    tone(90, 0.2, 1.6, 'square', 0.06, 240);
    noise(0, 1.8, 0.11, 900);
  },
  hit: (pitch = 0) => {
    if (!on()) return;
    tone(160 + pitch, 0, 0.12, 'square', 0.16, 60);
    noise(0, 0.14, 0.1, 1800);
  },
  startTicker: () => {
    if (!on() || ticker) return;
    ticker = setInterval(() => tone(1500 + Math.random() * 700, 0, 0.014, 'square', 0.022), 46);
  },
  stopTicker: () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  },
};

// ------------------------------------------------------------------ the score

type Mood = 'calm' | 'gates' | 'raid' | 'boss' | 'shadow' | 'redgate';
interface MoodDef {
  root: number; bpm: number; chords: number[][]; pad: number; arp: number; bass: number; pulse: number; drone: number; arpEvery: number; filter: number; wave: OscillatorType;
  /** A heartbeat under the bar, lub and dub on its first and third beats, at this level. */
  heart?: number;
}

const MOODS: Record<Mood, MoodDef> = {
  calm: { root: 220, bpm: 68, chords: [[0, 3, 7, 10], [0, 3, 7, 14], [-4, 3, 8, 12], [-2, 3, 7, 10]], pad: 0.115, arp: 0.055, bass: 0.075, pulse: 0, drone: 0, arpEvery: 2, filter: 1500, wave: 'triangle' },
  shadow: { root: 174.61, bpm: 60, chords: [[0, 3, 7, 10], [-2, 1, 5, 10], [-4, 0, 3, 8], [-5, -2, 2, 7]], pad: 0.12, arp: 0.04, bass: 0.09, pulse: 0, drone: 0.04, arpEvery: 2, filter: 1000, wave: 'triangle' },
  gates: { root: 164.81, bpm: 80, chords: [[0, 1, 7, 12], [0, 1, 8, 12], [-2, 1, 5, 10], [0, 1, 7, 13]], pad: 0.125, arp: 0.045, bass: 0.1, pulse: 0.055, drone: 0.03, arpEvery: 2, filter: 1100, wave: 'sawtooth' },
  raid: { root: 146.83, bpm: 124, chords: [[0, 3, 7, 12], [0, 3, 9, 12], [-3, 4, 7, 12], [0, 3, 7, 10]], pad: 0.075, arp: 0.055, bass: 0.135, pulse: 0.085, drone: 0, arpEvery: 1, filter: 1700, wave: 'sawtooth' },
  // A Red Gate: low and slow, a minor second and a tritone in every chord, a drone under it and a heartbeat.
  redgate: { root: 73.42, bpm: 54, chords: [[0, 1, 6, 12], [0, 3, 6, 11], [-1, 2, 6, 11], [0, 1, 6, 13]], pad: 0.15, arp: 0.03, bass: 0.17, pulse: 0, drone: 0.1, arpEvery: 4, filter: 640, wave: 'sawtooth', heart: 0.2 },
  boss: { root: 196, bpm: 132, chords: [[0, 3, 7, 12], [-1, 3, 6, 11], [0, 3, 8, 12], [-2, 2, 7, 10]], pad: 0.085, arp: 0.06, bass: 0.145, pulse: 0.095, drone: 0.055, arpEvery: 1, filter: 2000, wave: 'sawtooth' },
};

const semi = (root: number, n: number) => root * Math.pow(2, n / 12);
let mood: Mood | null = null;
let want: Mood = 'calm';
let beat = 0;
let nextAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function pad(freqs: number[], at: number, dur: number, m: MoodDef) {
  const c = ctx!;
  for (const f of freqs) for (const cents of [-6, 6]) {
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(m.filter, at);
    o.type = m.wave;
    o.frequency.setValueAtTime(f * Math.pow(2, cents / 1200), at);
    g.gain.setValueAtTime(1e-4, at);
    g.gain.exponentialRampToValueAtTime(m.pad, at + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
    o.connect(lp); lp.connect(g); g.connect(bus!);
    o.start(at); o.stop(at + dur + 0.05);
  }
}

function pluck(f: number, at: number, dur: number, gain: number, wave: OscillatorType = 'triangle') {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(1e-4, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
  o.connect(g); g.connect(bus!);
  o.start(at); o.stop(at + dur + 0.03);
}

function thud(at: number, gain: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(110, at);
  o.frequency.exponentialRampToValueAtTime(38, at + 0.11);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(1e-4, at + 0.2);
  o.connect(g); g.connect(bus!);
  o.start(at); o.stop(at + 0.24);
}

function playBeat(m: MoodDef, n: number, at: number) {
  const spb = 60 / m.bpm;
  const inBar = n % 4;
  const bar = Math.floor(n / 4) % m.chords.length;
  const chord = m.chords[bar];
  if (inBar === 0) {
    pad(chord.map((x) => semi(m.root, x)), at, spb * 4 * 0.98, m);
    if (m.drone) pluck(semi(m.root, -12), at, spb * 4, m.drone, 'sawtooth');
  }
  if (m.bass && (inBar === 0 || inBar === 2)) pluck(semi(m.root, chord[0] - 12), at, spb * 0.9, m.bass);
  if (m.heart && (inBar === 0 || inBar === 2)) { thud(at, m.heart); thud(at + spb * 0.26, m.heart * 0.7); }
  if (m.pulse) {
    thud(at, m.pulse);
    noise(0, 0.06, m.pulse * 0.42, 2600, 'highpass', bus!, at + spb * 0.5);
  }
  if (m.arp && n % m.arpEvery === 0) {
    const note = chord[(n * 3 + bar) % chord.length];
    pluck(semi(m.root, note + 12 + ((n >> 1) % 3 === 2 ? 12 : 0)), at, spb * 0.8, m.arp);
  }
}

function schedule() {
  if (!ctx || !mood) return;
  while (nextAt < ctx.currentTime + 0.14) {
    // Moods change on the bar line, never mid-bar.
    if (want !== mood && beat % 4 === 0) mood = want;
    playBeat(MOODS[mood], beat, nextAt);
    beat++;
    nextAt += 60 / MOODS[mood].bpm;
  }
}

let hushed = false;
const level = () => (!musicOn() || hushed ? 1e-4 : 0.36);

function ramp(to: number, secs: number) {
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(Math.max(1e-4, bus.gain.value), t);
  bus.gain.exponentialRampToValueAtTime(Math.max(1e-4, to), t + secs);
}

export const music = {
  start() {
    if (timer || !ac()) return;
    mood = want;
    beat = 0;
    nextAt = ctx!.currentTime + 0.12;
    ramp(level(), 2.2);
    timer = setInterval(schedule, 30);
    schedule();
  },
  set(name: Mood) {
    if (name === want) return;
    want = name;
    if (ctx) {
      ramp(1e-4, 0.5);
      setTimeout(() => ramp(level(), 0.8), 500);
    }
  },
  refresh() {
    ramp(level(), 0.6);
  },
  /** Silence the score under a moment that brings its own sound (the Arrival), and bring it back. */
  hush(on: boolean) {
    if (hushed === on) return;
    hushed = on;
    ramp(level(), on ? 1.2 : 2.6);
  },
};

export type { Mood };

/** The first gesture anywhere unlocks audio and starts the score. */
export function armAudio() {
  const go = () => {
    for (const e of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(e, go);
    unlocked = true;
    sfx.unlock();
    music.start();
  };
  for (const e of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(e, go, { passive: true });
}
