/**
 * The one live save, persisted to localStorage. `update` mutates and saves;
 * every subscribed component re-renders. There is no second source of truth.
 */
import { useEffect, useState } from 'preact/hooks';
import { BACKUP_KEY, defaults, parse, STORAGE_KEY } from '@/core/save';
import type { Save } from '@/core/types';

type Listener = () => void;

/** A tiny observable value, for the save and for transient UI state alike. */
export function createStore<T>(initial: T) {
  let value = initial;
  const subs = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      subs.forEach((f) => f());
    },
    subscribe(f: Listener) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    use(): T {
      const [, bump] = useState(0);
      useEffect(() => {
        const f = () => bump((n) => n + 1);
        subs.add(f);
        return () => void subs.delete(f);
      }, []);
      return value;
    },
  };
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

let save: Save = defaults();
const subs = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;
let onWriteFail: () => void = () => {};

export function init(opts: { onWriteFail?: () => void } = {}) {
  onWriteFail = opts.onWriteFail ?? onWriteFail;
  const raw = read(STORAGE_KEY);
  const parsed = raw ? parse(raw) : null;
  if (parsed) save = parsed;
  else {
    // Something is stored but cannot be read: keep it aside rather than writing over the only copy.
    if (raw) write(`${STORAGE_KEY}:unreadable:${Date.now()}`, raw);
    save = defaults();
  }
  // Never lose a pending write to a closing app — but never write when nothing changed.
  const pending = () => { if (timer) flush(); };
  for (const ev of ['pagehide', 'beforeunload'] as const) window.addEventListener(ev, pending);
  document.addEventListener('visibilitychange', () => document.hidden && pending());
  return save;
}

export const get = () => save;

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!write(STORAGE_KEY, JSON.stringify(save))) onWriteFail();
}

/** Mutate the save, persist shortly, notify. */
export function update<R>(fn: (s: Save) => R): R {
  const r = fn(save);
  if (!timer) timer = setTimeout(flush, 150);
  subs.forEach((f) => f());
  return r;
}

export const notify = () => subs.forEach((f) => f());

export function subscribe(f: Listener) {
  subs.add(f);
  return () => void subs.delete(f);
}

/** Re-render on any change to the save. */
export function useSave(): Save {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), []);
  return save;
}

/** Replace the whole save (import, erase). The previous one is kept as a backup. */
export function replace(next: Save) {
  write(BACKUP_KEY, JSON.stringify(save));
  save = next;
  flush();
  notify();
}

export const backup = () => read(BACKUP_KEY);

export const exportJson = () => JSON.stringify(save, null, 2);

/** Ask the browser to keep this save under storage pressure. */
export async function durable(): Promise<boolean | null> {
  const st = navigator.storage;
  if (!st?.persist) return null;
  try { return (await st.persisted()) || (await st.persist()); } catch { return false; }
}
