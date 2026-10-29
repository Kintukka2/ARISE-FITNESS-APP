/**
 * Everything that sits above a screen: System windows (queued, one at a
 * time), sheets (stacked), the spotlight tour, and toasts. The Android back
 * button unwinds them top-down through one stack.
 */
import type { ComponentChildren, VNode } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { createStore } from '@/store';
import * as store from '@/store';
import { buzz, flash } from './feedback';
import { CoachPortrait, Glyph, SystemMark } from './icons';

// ------------------------------------------------------------------ back stack

const backStack: { id: number; fn: () => boolean | void }[] = [];
let backSeq = 0;

export function pushBack(fn: () => boolean | void): () => void {
  const id = ++backSeq;
  backStack.push({ id, fn });
  return () => {
    const i = backStack.findIndex((b) => b.id === id);
    if (i >= 0) backStack.splice(i, 1);
  };
}

/** Unwind one layer. False when there was nothing to close. */
export function back(): boolean {
  const top = backStack[backStack.length - 1];
  if (!top) return false;
  top.fn();
  return true;
}

function useBack(fn: () => boolean | void, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => (active ? pushBack(() => ref.current()) : undefined), [active]);
}

// ------------------------------------------------------------------ System windows

export type Kind = 'system' | 'coach' | 'danger' | 'gold' | 'gates' | 'shadow' | 'gear' | 'app';

export interface Action { label: string; value: unknown; primary?: boolean; danger?: boolean }

export interface Hold {
  label: string;
  ms?: number;
  ticks?: number;
  holding?: string;
  done?: string;
  tick?: (step: number, of: number) => void;
  seal?: () => void;
  after?: number;
  /** The value the window resolves with once the hold completes. */
  value?: unknown;
}

export interface WinOpts {
  title?: string;
  kind?: Kind;
  lines?: string[];
  center?: boolean;
  actions?: Action[];
  hold?: Hold;
  /** Extra content under the lines; receives `close`. */
  body?: (close: (v: unknown) => void) => VNode | null;
  glyph?: string;
  /** Whether the lines type out. Default true. */
  typed?: boolean;
}

interface Queued extends WinOpts { id: number; resolve: (v: unknown) => void }

const windows = createStore<Queued[]>([]);
let winSeq = 0;

export function sys(o: WinOpts): Promise<unknown> {
  return new Promise((resolve) => windows.set([...windows.get(), { ...o, id: ++winSeq, resolve }]));
}

export async function confirm(title: string, html: string, ok = 'Confirm', danger = false): Promise<boolean> {
  const v = await sys({
    title, kind: danger ? 'danger' : 'app', lines: [html], typed: false,
    actions: [{ label: 'Cancel', value: false }, { label: ok, value: true, primary: !danger, danger }],
  });
  return v === true;
}

export const windowOpen = () => windows.get().length > 0;

/** Resolves once no System window is showing or queued. */
export function whenIdle(): Promise<void> {
  if (!windows.get().length) return Promise.resolve();
  return new Promise((resolve) => {
    const off = windows.subscribe(() => {
      if (windows.get().length) return;
      off();
      // Let anything chained after the last window queue its own first.
      setTimeout(() => (windows.get().length ? whenIdle().then(resolve) : resolve()), 250);
    });
  });
}

const BUZZ: Partial<Record<Kind, number[]>> = {
  danger: [40, 60, 120], gold: [20, 40, 20, 40, 60], gear: [14, 30, 22, 30, 70], gates: [26, 40, 20, 40, 90], shadow: [60, 90, 30, 60, 140],
};

const strip = (html: string) => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

function Typed({ lines, fast, onDone, skipRef }: { lines: string[]; fast: boolean; onDone: () => void; skipRef: { current: () => void } }) {
  const [at, setAt] = useState(0);
  const [chars, setChars] = useState(0);
  const plain = lines.map(strip);
  useEffect(() => {
    if (at >= lines.length) { sfx.stopTicker(); onDone(); return; }
    sfx.startTicker();
    const speed = fast ? 1 : 15;
    const len = plain[at].length;
    let n = 0;
    const t = setInterval(() => {
      n += fast ? 8 : 1;
      if (n >= len) { clearInterval(t); setChars(0); setAt((a) => a + 1); return; }
      setChars(n);
    }, speed);
    skipRef.current = () => { clearInterval(t); setChars(0); setAt((a) => a + 1); };
    return () => { clearInterval(t); sfx.stopTicker(); };
  }, [at]);
  return (
    <>
      {lines.map((l, i) =>
        i < at ? <p key={i} class="syswin__line" dangerouslySetInnerHTML={{ __html: l }} />
          : i === at ? <p key={i} class="syswin__line is-typing">{plain[i].slice(0, chars)}<span class="caret" /></p>
            : null)}
    </>
  );
}

export function HoldButton({ hold, onFire, disabled }: { hold: Hold; onFire: () => void; disabled?: boolean }) {
  const [p, setP] = useState(0);
  const [state, setState] = useState<'idle' | 'holding' | 'done'>('idle');
  const raf = useRef(0);
  const ms = hold.ms ?? 2400;
  const ticks = hold.ticks ?? 6;
  const start = (e: Event) => {
    e.preventDefault();
    if (disabled || state === 'done') return;
    // Capture the pointer so a layout shift under the finger cannot cancel the hold.
    const pe = e as PointerEvent;
    if (pe.pointerId !== undefined) (e.currentTarget as Element).setPointerCapture?.(pe.pointerId);
    setState('holding');
    const t0 = performance.now();
    let ticked = 0;
    const step = (now: number) => {
      const f = Math.min(1, (now - t0) / ms);
      setP(f);
      const n = Math.floor(f * ticks);
      while (ticked < n && ticked < ticks) {
        ticked++;
        (hold.tick ?? sfx.signTick)(ticked, ticks);
        buzz(7);
      }
      if (f >= 1) {
        setState('done');
        (hold.seal ?? sfx.sealed)();
        buzz([24, 44, 130]);
        flash();
        setTimeout(onFire, hold.after ?? 620);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const stop = () => {
    if (state !== 'holding') return;
    cancelAnimationFrame(raf.current);
    setState('idle');
    setP(0);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button
      type="button"
      class={`holdbtn ${state === 'done' ? 'is-done' : ''} ${state === 'holding' ? 'is-holding' : ''}`}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start(e)}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span class="holdbtn__fill" style={{ transform: `scaleX(${p})` }} />
      <span class="holdbtn__label">{state === 'done' ? hold.done ?? 'Done' : state === 'holding' ? hold.holding ?? 'Hold…' : hold.label}</span>
    </button>
  );
}

function SysWindow({ w }: { w: Queued }) {
  const [typedDone, setTypedDone] = useState(w.typed === false);
  const skip = useRef<() => void>(() => {});
  const fast = store.get().settings.fastText;
  const kind = w.kind ?? 'system';
  const close = (v: unknown) => {
    windows.set(windows.get().filter((x) => x.id !== w.id));
    w.resolve(v);
  };
  useEffect(() => {
    sfx.window(kind);
    const pattern = BUZZ[kind];
    buzz(pattern ?? [18, 30, 60]);
    if (kind === 'danger') flash('danger');
  }, []);
  useBack(() => {
    if (!typedDone) { skip.current(); return; }
    if (w.hold) return;
    const acts = w.actions ?? [{ label: 'Accept', value: true }];
    const out = acts.find((a) => a.value === false) ?? (acts.length === 1 ? acts[0] : null);
    if (out) close(out.value);
  });
  const actions = w.actions ?? [{ label: 'Accept', value: true, primary: true }];
  return (
    <div class="sysgate" role="dialog" aria-modal="true" aria-label={w.title ?? 'Notification'}>
      <div class="sysgate__scrim" />
      <div class={`syswin syswin--${kind} ${w.center ? 'is-center' : ''}`} onClick={() => !typedDone && skip.current()}>
        <header class="syswin__head">
          <span class="syswin__glyph" aria-hidden="true">{w.glyph ? <Glyph name={w.glyph} /> : '!'}</span>
          <h2 class="syswin__title">{w.title ?? 'Notification'}</h2>
        </header>
        {kind === 'coach' && (
          <div class="syswin__who"><CoachPortrait size={40} /><div><b>Ryn Valcorde</b><small>Instructor · Hunter Training</small></div></div>
        )}
        <div class="syswin__body">
          {w.typed === false
            ? (w.lines ?? []).map((l, i) => <p key={i} class="syswin__line" dangerouslySetInnerHTML={{ __html: l }} />)
            : <Typed lines={w.lines ?? []} fast={fast} onDone={() => setTypedDone(true)} skipRef={skip} />}
          {typedDone && w.body?.(close)}
        </div>
        {typedDone && (
          <footer class="syswin__foot">
            {w.hold
              ? <HoldButton hold={w.hold} onFire={() => close(w.hold!.value ?? true)} />
              : actions.map((a) => (
                <button type="button" key={a.label} class={`btn ${a.primary ? 'btn--primary' : ''} ${a.danger ? 'btn--danger' : ''}`}
                  onClick={(e) => { e.stopPropagation(); sfx.tap(); close(a.value); }}>{a.label}</button>
              ))}
          </footer>
        )}
      </div>
    </div>
  );
}

function WindowHost() {
  const q = windows.use();
  const top = q[0];
  return top ? <SysWindow key={top.id} w={top} /> : null;
}

// ------------------------------------------------------------------ sheets

export type Tone = 'mana' | 'verdant' | 'ember' | 'arcane' | 'gold';

interface SheetOpts {
  title: string;
  tone?: Tone;
  render: (close: () => void) => ComponentChildren;
  onClose?: () => void;
  action?: { label: string; icon: string; onClick: () => void };
}
interface OpenSheet extends SheetOpts { id: number }

const sheets = createStore<OpenSheet[]>([]);
let sheetSeq = 0;

export function openSheet(o: SheetOpts): () => void {
  const id = ++sheetSeq;
  sheets.set([...sheets.get(), { ...o, id }]);
  return () => closeSheet(id);
}

function closeSheet(id: number) {
  const s = sheets.get().find((x) => x.id === id);
  sheets.set(sheets.get().filter((x) => x.id !== id));
  s?.onClose?.();
}

export const closeAllSheets = () => sheets.get().forEach((s) => closeSheet(s.id));

function Sheet({ s, top }: { s: OpenSheet; top: boolean }) {
  const close = () => { sfx.tap(); closeSheet(s.id); };
  useBack(close, top);
  // Re-render with the save so sheet contents stay live.
  store.useSave();
  return (
    <div class={`sheet ${top ? 'is-top' : ''}`} data-tone={s.tone ?? 'mana'} role="dialog" aria-modal="true" aria-label={s.title}>
      <div class="sheet__scrim" onClick={close} />
      <section class="sheet__panel">
        <header class="sheet__head">
          <h2 class="sheet__title">{s.title}</h2>
          {s.action && <button type="button" class="iconbtn" aria-label={s.action.label} title={s.action.label} onClick={s.action.onClick}><Glyph name={s.action.icon} /></button>}
          <button type="button" class="iconbtn" aria-label="Close" onClick={close}><Glyph name="close" /></button>
        </header>
        <div class="sheet__body">{s.render(close)}</div>
      </section>
    </div>
  );
}

function SheetHost() {
  const list = sheets.use();
  return <>{list.map((s, i) => <Sheet key={s.id} s={s} top={i === list.length - 1} />)}</>;
}

// ------------------------------------------------------------------ toasts

type ToastKind = 'good' | 'bad' | 'warn' | 'xp';
const toasts = createStore<{ id: number; msg: string; kind?: ToastKind }[]>([]);
let toastSeq = 0;

export function toast(msg: string, kind?: ToastKind) {
  const id = ++toastSeq;
  toasts.set([...toasts.get(), { id, msg, kind }].slice(-3));
  setTimeout(() => toasts.set(toasts.get().filter((t) => t.id !== id)), 2800);
}

function ToastHost() {
  const list = toasts.use();
  return (
    <div class="toasts" aria-live="polite">
      {list.map((t) => <div key={t.id} class={`toast toast--${t.kind ?? 'info'}`}>{t.msg}</div>)}
    </div>
  );
}

// ------------------------------------------------------------------ spotlight tour

export interface TourStep { at?: string; say: string }
export interface Tour { who: 'system' | 'coach'; title: string; steps: TourStep[] }

const tours = createStore<(Tour & { resolve: () => void }) | null>(null);

/** A spotlight walkthrough. It waits for any System window to finish first. */
export async function tour(t: Tour): Promise<void> {
  await whenIdle();
  if (tours.get()) return;
  return new Promise((resolve) => tours.set({ ...t, resolve }));
}

function TourView({ t }: { t: Tour & { resolve: () => void } }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = t.steps[i];
  const end = () => { tours.set(null); t.resolve(); };
  const next = () => { sfx.tap(); if (i + 1 >= t.steps.length) end(); else setI(i + 1); };
  useBack(end);
  useLayoutEffect(() => {
    const el = step.at ? (document.querySelector(`.sheet.is-top [data-tour="${step.at}"]`) ?? document.querySelector(`[data-tour="${step.at}"]`)) : null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const r = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(r); window.removeEventListener('resize', measure); };
  }, [i]);
  useEffect(() => { sfx.blip(); buzz(10); }, []);
  const pad = 8;
  const vh = window.innerHeight;
  const below = rect ? rect.bottom + pad + 14 : 0;
  const cardTop = !rect ? undefined : below + 200 < vh ? below : undefined;
  const cardBottom = rect && cardTop === undefined ? Math.max(12, vh - rect.top + pad + 14) : undefined;
  return (
    <div class="tour" onClick={next} role="dialog" aria-label={t.title}>
      <div class="tour__mask" style={rect
        ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
        : { left: '50%', top: '40%', width: 0, height: 0 }} />
      <div class={`tour__card tour__card--${t.who}`} style={rect ? { top: cardTop, bottom: cardBottom } : { bottom: 'calc(var(--nav-h) + 24px)' }}>
        <header class="tour__head">
          {t.who === 'coach' ? <CoachPortrait size={28} /> : <SystemMark size={28} />}
          <b>{t.who === 'coach' ? 'Ryn Valcorde' : 'System'}</b>
          {t.steps.length > 1 && <span class="tour__count">{i + 1}/{t.steps.length}</span>}
        </header>
        <h3 class="tour__title">{t.title}</h3>
        <p class="tour__say">{step.say}</p>
        <footer class="tour__foot">
          <button type="button" class="btn btn--sm btn--ghost" onClick={(e) => { e.stopPropagation(); end(); }}>Close</button>
          <span class="tour__cue">{i + 1 >= t.steps.length ? 'Tap to finish' : 'Tap to continue'} ▸</span>
        </footer>
      </div>
    </div>
  );
}

function TourHost() {
  const t = tours.use();
  return t ? <TourView key={t.title} t={t} /> : null;
}

export const tourOpen = () => !!tours.get();

export function Overlays() {
  return (
    <>
      <SheetHost />
      <TourHost />
      <WindowHost />
      <ToastHost />
    </>
  );
}
