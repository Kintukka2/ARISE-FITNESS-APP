/** Which screen is showing, and whether a raid is being played over it. */
import { music, type Mood } from '@/audio/audio';
import { contractsOpen } from '@/core/contracts';
import { shadowsOpen } from '@/core/progression';
import type { Save } from '@/core/types';
import { createStore } from '@/store';
import * as store from '@/store';
import { closeAllSheets, sys, type Kind } from '@/ui/overlays';

export type Route = 'inventory' | 'gates' | 'quests' | 'shadows';

export const route = createStore<Route>('gates');
/** A raid is being played in the arena. */
export const arena = createStore<string | null>(null);

const MOOD: Record<Route, Mood> = { inventory: 'calm', gates: 'gates', quests: 'calm', shadows: 'shadow' };

/** A screen that is not open yet: what opens it, and the frame its notice takes. */
const SHUT: Partial<Record<Route, { open: (s: Save) => boolean; name: string; kind: Kind }>> = {
  quests: { open: contractsOpen, name: 'Quests', kind: 'system' },
  shadows: { open: shadowsOpen, name: 'Shadows', kind: 'shadow' },
};

/** The screens that are open yet. */
export const isOpen = (s: Save, to: Route) => SHUT[to]?.open(s) ?? true;

let shutOpen = false;

export function go(to: Route) {
  const s = store.get();
  const shut = SHUT[to];
  if (shut && !shut.open(s)) {
    if (shutOpen) return;
    shutOpen = true;
    void sys({ title: 'Notification', kind: shut.kind, lines: [`<span class="warn">[${shut.name}] is not available.</span>`], actions: [{ label: 'Close', value: false, primary: true }] })
      .then(() => { shutOpen = false; });
    return;
  }
  closeAllSheets();
  route.set(to);
  document.documentElement.dataset.screen = to;
  music.set(MOOD[to]);
  window.scrollTo(0, 0);
  if (to === 'shadows' && s.shadows.fresh.length) {
    // Visiting is what clears the NEW marks — after this render has shown them.
    setTimeout(() => store.update((x) => { x.shadows.fresh = []; }), 4000);
  }
}
