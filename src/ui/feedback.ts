/** Haptics and the full-screen flash. Both respect the hunter's settings. */
import * as store from '@/store';

export function buzz(pattern: number | number[]) {
  if (!store.get().settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* unsupported */ }
}

export function flash(kind: 'mana' | 'danger' | 'gold' | 'shadow' = 'mana') {
  const el = document.getElementById('fx-flash');
  if (!el) return;
  el.className = 'fx-flash';
  void el.offsetWidth;
  el.className = `fx-flash is-${kind}`;
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Trusted copy is HTML; anything the hunter typed must go through this first. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
