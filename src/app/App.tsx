/** The root: onboarding until the Awakening is done, then the four screens and whatever is on top of them. */
import { useEffect } from 'preact/hooks';
import { useSave } from '@/store';
import { Overlays } from '@/ui/overlays';
import { Awakening } from '@/screens/Onboarding';
import { Inventory } from '@/screens/Inventory';
import { Gates } from '@/screens/Gates';
import { Quests } from '@/screens/Quests';
import { Arena } from '@/screens/Arena';
import { Shadows } from '@/screens/Shadows';
import { Fx, NavBar, TopBar } from './shell';
import { arena, go, route } from './router';
import { catchUp } from './flow';

const SCREENS = { inventory: Inventory, gates: Gates, quests: Quests, shadows: Shadows };

export function App() {
  const s = useSave();
  const r = route.use();
  const a = arena.use();

  useEffect(() => {
    // The Awakening belongs to no screen: a save wiped from the Gates must not keep their orange.
    if (!s.onboarded) { delete document.documentElement.dataset.screen; return; }
    go('gates');
    void catchUp();
  }, [s.onboarded]);

  if (!s.onboarded) return <><Fx /><Awakening /><Overlays /></>;

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
      {a && <Arena />}
      <Overlays />
    </>
  );
}
