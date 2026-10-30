/** The root: onboarding until the Awakening is done, then the three screens and whatever is on top of them. */
import { useEffect } from 'preact/hooks';
import { useSave } from '@/store';
import { Overlays } from '@/ui/overlays';
import { Awakening } from '@/screens/Onboarding';
import { Profile } from '@/screens/Profile';
import { Gates } from '@/screens/Gates';
import { Arena } from '@/screens/Arena';
import { Shadows } from '@/screens/Shadows';
import { Fx, NavBar, TopBar } from './shell';
import { arena, go, route } from './router';
import { catchUp } from './flow';

const SCREENS = { profile: Profile, gates: Gates, shadows: Shadows };

export function App() {
  const s = useSave();
  const r = route.use();
  const a = arena.use();

  useEffect(() => {
    if (!s.onboarded) return;
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
