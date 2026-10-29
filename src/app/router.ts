/** Which screen is showing, and which full-screen layer (session, raid) is on top of it. */
import { music, sfx, type Mood } from '@/audio/audio';
import { gatesOpen, shadowsOpen } from '@/core/progression';
import { createStore } from '@/store';
import * as store from '@/store';
import { buzz } from '@/ui/feedback';
import { closeAllSheets, sys } from '@/ui/overlays';

export type Route = 'quests' | 'training' | 'profile' | 'gates' | 'shadows';

export const route = createStore<Route>('quests');
/** The session player is open over the screen. */
export const player = createStore(false);
/** The enrolment interview is open. */
export const intake = createStore(false);
/** A raid is being played in the arena. */
export const arena = createStore<string | null>(null);

const MOOD: Record<Route, Mood> = { quests: 'calm', training: 'calm', profile: 'calm', gates: 'gates', shadows: 'shadow' };

let shutOpen = false;

export function go(to: Route) {
  const s = store.get();
  if (to === 'gates' && !gatesOpen(s)) {
    if (shutOpen) return;
    shutOpen = true;
    sfx.alarm();
    buzz([30, 50, 30]);
    void sys({
      title: 'Not Licensed', kind: 'danger',
      lines: [
        'The Association does not let hunters into Gates until they have completed <strong>Basic Hunter Training</strong>.',
        'One session of Hunter Training. Clear it and the Gates open — and you will be Level 5 when they do.',
      ],
      actions: [{ label: 'Not Yet', value: false }, { label: 'To Training', value: true, primary: true }],
    }).then((v) => { shutOpen = false; if (v) go('training'); });
    return;
  }
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
