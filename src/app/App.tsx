/** The root: onboarding until the Awakening is done, then the five screens and whatever is on top of them. */
import { useEffect } from 'preact/hooks';
import { useSave } from '@/store';
import * as store from '@/store';
import { parse } from '@/core/save';
import { Overlays, confirm } from '@/ui/overlays';
import { Awakening, Intake } from '@/screens/Onboarding';
import { Quests } from '@/screens/Quests';
import { Training } from '@/screens/Training';
import { SessionPlayer } from '@/screens/Session';
import { Profile } from '@/screens/Profile';
import { Gates } from '@/screens/Gates';
import { Arena } from '@/screens/Arena';
import { Shadows } from '@/screens/Shadows';
import { Fx, NavBar, TopBar } from './shell';
import { arena, intake, player, route, go } from './router';
import { catchUp, playBeats } from './flow';

const SCREENS = { quests: Quests, training: Training, profile: Profile, gates: Gates, shadows: Shadows };

export function App() {
  const s = useSave();
  const r = route.use();
  const p = player.use();
  const a = arena.use();
  const iv = intake.use();

  useEffect(() => {
    if (!s.onboarded) {
      void offerLegacy();
      return;
    }
    void (async () => {
      await catchUp();
      if (store.get().session && !player.get()) {
        const resume = await confirm('Session Interrupted', `An unfinished session is still open: <em>${store.get().session!.title}</em>.`, 'Resume');
        if (resume) player.set(true);
        else store.update((x) => { x.session = null; });
      }
    })();
  }, [s.onboarded]);

  if (!s.onboarded) return <><Fx /><Awakening /><Overlays /></>;
  if (iv) return <><Fx /><Intake onDone={() => { intake.set(false); go('training'); void playBeats(); }} /><Overlays /></>;

  const Screen = SCREENS[r];
  return (
    <>
      <Fx />
      <div class="app">
        <TopBar />
        <main class="screen" key={r} id="main">
          <Screen />
        </main>
        <NavBar />
      </div>
      {p && <SessionPlayer />}
      {a && <Arena />}
      <Overlays />
    </>
  );
}

/** A save from the original app is offered once, before the Awakening. */
async function offerLegacy() {
  const raw = store.legacySave();
  if (!raw) return;
  const old = parse(raw);
  store.dismissLegacy();
  if (!old) return;
  const yes = await confirm('Record Found', `A hunter record from an earlier version of ARISE is on this device: <strong>${old.hunter.name.replace(/</g, '&lt;')}</strong>, Level ${old.hunter.level}. Carry it forward? Level, attributes, streak, shards, gear and Shadows come across.`, 'Carry It Forward');
  if (yes) store.replace(old);
}
