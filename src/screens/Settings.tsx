/** SETTINGS: sound, display, the reminder and the save itself, in the System's frame at the owner's call. Its words stay the interface's. */
import { useEffect, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import { defaults, parse } from '@/core/save';
import { askNotifications, remindersAvailable, syncReminders } from '@/platform/native';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn } from '@/ui/components';
import { askName } from '@/ui/ask';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { Glyph } from '@/ui/icons';
import { openGuide } from './Guide';

export function openSettings() {
  openSheet({ title: 'Settings', system: { icon: null }, render: () => <Settings /> });
}

function Toggle({ label, note, on, onChange }: { label: string; note?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle">
      <span class="toggle__text"><b>{label}</b>{note && <small class="muted">{note}</small>}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => { sfx.tap(); onChange((e.target as HTMLInputElement).checked); }} />
      <span class="toggle__track" aria-hidden="true" />
    </label>
  );
}

function Settings() {
  const s = useSave();
  const [durable, setDurable] = useState<boolean | null>(null);
  useEffect(() => { void store.durable().then(setDurable); }, []);
  const set = (fn: (x: typeof s) => void) => store.update(fn);
  const Head = ({ label, right }: { label: string; right?: string }) => (
    <header class="exsec__head"><span class="label">{label}</span><i aria-hidden="true" />{right && <small>{right}</small>}</header>
  );
  return (
    <div class="stack settings">
      {/* The Guide first, as a card: every rule, with its numbers read from the engine. */}
      <button type="button" class="setguide" onClick={() => { sfx.tap(); openGuide(); }}>
        <span class="setguide__mark"><Glyph name="book" /></span>
        <span class="setguide__text"><b>How Arise Works</b><small>The Guide: every rule, with its numbers.</small></span>
        <Glyph name="chevron" class="setguide__go" />
      </button>

      <section class="setsec">
        <Head label="Sound and display" />
        <div class="toggles">
          <Toggle label="Sound" on={s.settings.sound} onChange={(v) => set((x) => { x.settings.sound = v; })} />
          <Toggle label="Music" note="Plays quietly and changes with the screen." on={s.settings.music} onChange={(v) => { set((x) => { x.settings.music = v; }); music.refresh(); }} />
          <Toggle label="Haptics" on={s.settings.haptics} onChange={(v) => set((x) => { x.settings.haptics = v; })} />
          <Toggle label="Fast story text" note="System windows appear at once instead of typing out." on={s.settings.fastText} onChange={(v) => set((x) => { x.settings.fastText = v; })} />
        </div>
      </section>

      {remindersAvailable() && (
        <section class="setsec">
          <Head label="Reminder" />
          <div class="toggles">
            <Toggle label="Tell me when I am rested" note="One notification when fatigue reaches 0 or the Gate lockout ends." on={s.settings.reminders.on} onChange={async (v) => {
              if (v && !(await askNotifications())) { sfx.alarm(); toast('Notifications are blocked for Arise. Allow them in Android settings.', 'warn'); return; }
              set((x) => { x.settings.reminders.on = v; });
              void syncReminders(store.get());
            }} />
          </div>
          <small class="muted">Scheduled on this phone by the app. Nothing is sent anywhere.</small>
        </section>
      )}

      {(s.settings.skipAsk ?? []).length > 0 && (
        <section class="setsec">
          <Head label="Purchases" right={`Not asked: ${s.settings.skipAsk.length}`} />
          <ul class="asklist">{s.settings.skipAsk.map((k) => <li key={k}>{askName(k)}</li>)}</ul>
          <Btn kind="ghost" block onClick={() => { set((x) => { x.settings.skipAsk = []; }); toast('Every purchase asks first again.', 'good'); }}>Ask Before Every Purchase</Btn>
        </section>
      )}

      <section class="setsec">
        <Head label="Your save" />
        <p class="setsave">
          <span class={`setsave__store ${durable ? 'is-safe' : durable === false ? 'is-risk' : ''}`}><i aria-hidden="true" />{durable === null ? 'Unknown' : durable ? 'Persistent' : 'Best-effort'}</span>
          <span class="muted">Everything lives on this device.{durable === false ? ' The browser may clear it under storage pressure, so export now and then.' : ''}</span>
        </p>
        <div class="setsave__btns">
          <Btn kind="ghost" onClick={exportSave}>Export Save</Btn>
          <Btn kind="ghost" onClick={importSave}>Import Save</Btn>
        </div>
        {store.backup() && <Btn kind="ghost" block onClick={restoreBackup}>Restore Previous Save</Btn>}
      </section>
      <Btn kind="danger" block onClick={erase}>Erase Everything</Btn>
      <small class="muted center">Arise v{__APP_VERSION__} · Instructor Ryn Valcorde · all data stored on this device</small>
    </div>
  );
}

function exportSave() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arise-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Save exported.', 'xp');
}

function importSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const next = parse(await file.text());
    if (!next) return toast('That is not an Arise save file.', 'bad');
    if (!(await confirm('Import Save', `Replace this hunter with <strong>${next.hunter.name.replace(/</g, '&lt;')}</strong>, Level ${next.hunter.level}? The current save is kept as a backup you can restore.`, 'Import', true))) return;
    store.replace(next);
    toast('Save imported.', 'xp');
    location.reload();
  };
  input.click();
}

async function restoreBackup() {
  const raw = store.backup();
  const prev = raw && parse(raw);
  if (!prev) return toast('No usable backup.', 'bad');
  if (!(await confirm('Restore Previous Save', `Swap back to <strong>${prev.hunter.name.replace(/</g, '&lt;')}</strong>, Level ${prev.hunter.level}? The current save becomes the backup.`, 'Restore'))) return;
  store.replace(prev);
  location.reload();
}

async function erase() {
  if (!(await confirm('Erase Save', 'Every level, Shadow, stat and item is deleted. A single backup is kept until the next import or erase.', 'Erase', true))) return;
  const v = await sys({ title: 'Confirm Erasure', kind: 'app', typed: false, lines: ['This cannot be undone.'], actions: [{ label: 'Cancel', value: false }, { label: 'Erase Everything', value: true, danger: true }] });
  if (!v) return;
  store.replace(defaults());
  location.reload();
}
