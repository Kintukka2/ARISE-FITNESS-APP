/**
 * Press and drag, for rearranging a list by hand. A mouse lifts what it pressed once it moves; a
 * finger once it has held still for `HOLD_MS`, so a swipe still scrolls the sheet under it. While
 * something is lifted, the ghost follows the pointer, the sheet scrolls when the pointer nears its
 * edge, and the element under the pointer that carries `data-drop` is the target. Letting go over a
 * target drops onto it; anywhere else puts it back. The click a drag ends on is swallowed.
 */
import { useRef, useState } from 'preact/hooks';
import { buzz } from './feedback';

/** How long a finger holds still before it lifts what it pressed. */
export const HOLD_MS = 260;
/** How far a pointer may wander before a press is a swipe (a finger) or a drag (a mouse). */
const SLOP = { mouse: 4, touch: 10 } as const;
/** How near the scrolling sheet's edge the pointer comes before the sheet scrolls, and how fast. */
const EDGE = 64;
const SPEED = 14;

const scroller = (el: HTMLElement | null): HTMLElement | null => {
  for (let x = el?.parentElement; x; x = x.parentElement) {
    const o = getComputedStyle(x).overflowY;
    if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x;
  }
  return null;
};

export function useDrag(onDrop: (id: string, target: string) => void) {
  const [lifted, setLifted] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const swallow = useRef(false);

  const start = (id: string, e: PointerEvent) => {
    if (e.button > 0 || lifted) return;
    const mouse = e.pointerType === 'mouse';
    const x0 = e.clientX, y0 = e.clientY;
    const pane = scroller(e.currentTarget as HTMLElement);
    let live = false, x = x0, y = y0, target: string | null = null, frame = 0;
    const aim = () => {
      if (ghost.current) ghost.current.style.transform = `translate(${x}px, ${y}px)`;
      const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]');
      const t = hit?.dataset.drop ?? null;
      if (t !== target) { target = t; setOver(t); }
    };
    // Near the sheet's edge, it scrolls; the target under the pointer moves with it.
    const roll = () => {
      if (!live) return;
      if (pane) {
        const r = pane.getBoundingClientRect();
        const dy = y < r.top + EDGE ? -SPEED : y > r.bottom - EDGE ? SPEED : 0;
        if (dy) { pane.scrollTop += dy; aim(); }
      }
      frame = requestAnimationFrame(roll);
    };
    const lift = () => {
      live = true;
      swallow.current = true;
      setLifted(id);
      buzz(12);
      aim();
      frame = requestAnimationFrame(roll);
    };
    const move = (ev: PointerEvent) => {
      x = ev.clientX; y = ev.clientY;
      if (live) { aim(); return; }
      if (Math.hypot(x - x0, y - y0) > (mouse ? SLOP.mouse : SLOP.touch)) {
        if (mouse) lift();
        else stop();
      }
    };
    // Once lifted, a finger's move drags; it does not scroll the sheet.
    const hold = (ev: TouchEvent) => { if (live && ev.cancelable) ev.preventDefault(); };
    const menu = (ev: Event) => { if (live) ev.preventDefault(); };
    const stop = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('touchmove', hold);
      document.removeEventListener('contextmenu', menu);
    };
    const up = (ev: PointerEvent) => {
      stop();
      if (!live) return;
      live = false;
      if (ev.type === 'pointerup' && target) onDrop(id, target);
      setLifted(null);
      setOver(null);
      // The click this ends on is the drag's, not a tap; if none comes, the next tap is the hunter's.
      setTimeout(() => { swallow.current = false; }, 350);
    };
    const timer = mouse ? 0 : window.setTimeout(lift, HOLD_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('touchmove', hold, { passive: false });
    document.addEventListener('contextmenu', menu);
  };

  return {
    /** What is lifted, and the drop target under it. */
    lifted, over, ghost,
    /** Spread on an element that can be dragged. */
    handle: (id: string) => ({ 'data-drag': id, onPointerDown: (e: PointerEvent) => start(id, e) }),
    /** Spread on the container: the click a drag ends on opens nothing. */
    guard: { onClickCapture: (e: Event) => { if (swallow.current) { e.preventDefault(); e.stopPropagation(); swallow.current = false; } } },
  };
}
