/** A line typing out, a character at a time: Valcorde saying it, as he says it. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as store from '@/store';
import { reducedMotion } from './feedback';

/**
 * Type `text` out. Fast text types it six characters a tick; reduced motion shows it whole at once.
 * `sound` plays the ticker while it types, as the onboarding does; a line on a screen types silently.
 */
export function useTyped(text: string, { speed = 15, sound = true }: { speed?: number; sound?: boolean } = {}) {
  const [n, setN] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fast = store.get().settings.fastText;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (sound) sfx.stopTicker();
  };
  useEffect(() => {
    if (!text) { setN(0); return; }
    if (reducedMotion()) { setN(text.length); return; }
    setN(0);
    if (sound) sfx.startTicker();
    let i = 0;
    timer.current = setInterval(() => {
      i += fast ? 6 : 1;
      setN(Math.min(i, text.length));
      if (i >= text.length) stop();
    }, fast ? 1 : speed);
    return stop;
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => { stop(); setN(text.length); } };
}
