/**
 * Asking before a purchase or a use, unless the hunter has said not to. The System's offer carries a
 * toggle under its lines, the interface's own control: ticked when the act is taken, that offer is
 * not shown again, and the act goes through on the tap. Settings brings every one of them back.
 */
import { useState } from 'preact/hooks';
import * as store from '@/store';
import { POTIONS } from '@/core/shop';
import { sys, type WinOpts } from './overlays';

/** Whether the hunter has asked not to be asked about this again. */
export const skips = (key: string) => store.get().settings.skipAsk?.includes(key) ?? false;

/** What a key is, for the list in Settings. */
export function askName(key: string): string {
  const [act, what] = key.split(':');
  const name = POTIONS.find((p) => p.id === what)?.name ?? (what === 'field' ? 'Field Potion' : what === 'shelf' ? 'Gear on the shelf' : what === 'survey' ? 'Gate Survey' : what);
  return `${act === 'drink' ? 'Drinking' : act === 'use' ? 'Using' : 'Buying'}: ${name}`;
}

/**
 * Ask with `opts`, an offer whose yes resolves `true`, unless `key` has been skipped: then it is yes
 * at once. Ticking the toggle and saying yes skips it from then on.
 */
export async function ask(key: string, opts: WinOpts): Promise<boolean> {
  if (skips(key)) return true;
  let skip = false;
  const v = await sys({ ...opts, body: () => <DontAsk onChange={(on) => { skip = on; }} /> });
  if (v === true && skip) store.update((x) => { x.settings.skipAsk = [...new Set([...(x.settings.skipAsk ?? []), key])]; });
  return v === true;
}

function DontAsk({ onChange }: { onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" class={`sysbox dontask ${on ? 'is-on' : ''}`} role="checkbox" aria-checked={on}
      onClick={() => { setOn(!on); onChange(!on); }}>
      <span class="dontask__box" aria-hidden="true">{on ? '✓' : ''}</span>
      Do not ask again
    </button>
  );
}
