/** Which screen is showing, and whether a raid is being played over it. */
import { music, type Mood } from '@/audio/audio';
import { shadowsOpen } from '@/core/progression';
import { createStore } from '@/store';
import * as store from '@/store';
import { closeAllSheets, sys } from '@/ui/overlays';

export type Route = 'profile' | 'gates' | 'shadows';

export const route = createStore<Route>('gates');
/** A raid is being played in the arena. */
export const arena = createStore<string | null>(null);

const MOOD: Record<Route, Mood> = { profile: 'calm', gates: 'gates', shadows: 'shadow' };

let shutOpen = false;

export function go(to: Route) {
  const s = store.get();
  if (to === 'shadows' && !shadowsOpen(s)) {
    if (shutOpen) return;
    shutOpen = true;
    void sys({ title: 'Notification', kind: 'shadow', lines: ['Shadow…? I’m not sure what this is…'], actions: [{ label: 'Continue', value: false, primary: true }] })
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
