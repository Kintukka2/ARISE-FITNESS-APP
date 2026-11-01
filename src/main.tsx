import { render } from 'preact';
import { armAudio, configure } from '@/audio/audio';
import * as store from '@/store';
import { back, toast } from '@/ui/overlays';
import { App } from '@/app/App';
import { catchUp } from '@/app/flow';
import { go, route, arena } from '@/app/router';
import { initBilling, onReminderTap, syncReminders } from '@/platform/native';
import './styles/theme.css';
import './styles/ui.css';
import './styles/screens.css';

store.init({ onWriteFail: () => toast('Save failed: storage unavailable.', 'bad') });
void store.durable();
configure({ sound: () => store.get().settings.sound, music: () => store.get().settings.music });
armAudio();
document.documentElement.dataset.screen = route.get();

void initBilling();
onReminderTap(() => { if (!arena.get() && store.get().onboarded) go('gates'); });
store.subscribe(() => void syncReminders(store.get()));

// Coming back to the app settles the vitals; the board and the shelf read the date on every render.
const wake = () => { if (!document.hidden) void catchUp(); };
document.addEventListener('visibilitychange', wake);
window.addEventListener('focus', wake);

// Android back: unwind one overlay, else go home, else a second press leaves.
let armed = false;
const trap = () => { try { history.pushState({ arise: 1 }, ''); } catch { /* sandboxed */ } };
trap();
window.addEventListener('popstate', () => {
  if (back()) return trap();
  if (route.get() !== 'gates' && store.get().onboarded) { go('gates'); return trap(); }
  if (!armed) {
    armed = true;
    toast('Back again to leave Arise.', 'warn');
    setTimeout(() => { armed = false; trap(); }, 2200);
  }
});

render(<App />, document.getElementById('root')!);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
