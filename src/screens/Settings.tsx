/** The System Console: settings, reminders and the save itself. */
import { useEffect, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import { defaults, parse } from '@/core/save';
import { askNotifications, remindersAvailable, syncReminders } from '@/platform/native';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Section } from '@/ui/components';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { Glyph } from '@/ui/icons';
import { openGuide } from './Guide';

export function openSettings() {
  openSheet({ title: 'System Console', render: () => <Settings /> });
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
  return (
    <div class="stack">
      <Btn kind="ghost" block onClick={openGuide}><Glyph name="help" /> How ARISE Works</Btn>
      <Section title="System settings">
        <div class="toggles">
          <Toggle label="Sound" on={s.settings.sound} onChange={(v) => set((x) => { x.settings.sound = v; })} />
          <Toggle label="Music" note="Plays quietly and changes with the screen. It goes silent while you log a session." on={s.settings.music} onChange={(v) => { set((x) => { x.settings.music = v; }); music.refresh(); }} />
          <Toggle label="Haptics" on={s.settings.haptics} onChange={(v) => set((x) => { x.settings.haptics = v; })} />
          <Toggle label="Auto rest timer" note="Starts the prescribed rest after every set but the last." on={s.settings.autoRest} onChange={(v) => set((x) => { x.settings.autoRest = v; })} />
          <Toggle label="Fast story text" note="System windows appear at once instead of typing out." on={s.settings.fastText} onChange={(v) => set((x) => { x.settings.fastText = v; })} />
          <div class="toggle">
            <span class="toggle__text"><b>Weight units</b><small class="muted">Weights are stored in kilograms and shown in the unit you choose.</small></span>
            <div class="seg" role="radiogroup" aria-label="Weight units">
              {(['kg', 'lb'] as const).map((u) => <button type="button" role="radio" aria-checked={s.settings.units === u} key={u} class={`seg__btn ${s.settings.units === u ? 'is-on' : ''}`} onClick={() => { sfx.tap(); set((x) => { x.settings.units = u; }); }}>{u.toUpperCase()}</button>)}
            </div>
          </div>
        </div>
      </Section>

      {remindersAvailable() && (
        <Section title="Reminders">
          <div class="toggles">
            <Toggle label="Daily Quest reminder" on={s.settings.reminders.on} onChange={async (v) => {
              if (v && !(await askNotifications())) { sfx.alarm(); toast('Notifications are blocked for ARISE. Allow them in Android settings.', 'warn'); return; }
              set((x) => { x.settings.reminders.on = v; });
              void syncReminders(store.get());
            }} />
            {s.settings.reminders.on && (
              <>
                <label class="toggle"><span class="toggle__text"><b>Remind me at</b></span>
                  <input class="input input--time" type="time" value={s.settings.reminders.at} onChange={(e) => { set((x) => { x.settings.reminders.at = (e.target as HTMLInputElement).value || '10:00'; }); void syncReminders(store.get()); }} /></label>
                <Toggle label="Last call at 20:00" on={s.settings.reminders.lastCall} onChange={(v) => { set((x) => { x.settings.reminders.lastCall = v; }); void syncReminders(store.get()); }} />
                <Toggle label="Gates & Exchange at 17:00" on={s.settings.reminders.refresh} onChange={(v) => { set((x) => { x.settings.reminders.refresh = v; }); void syncReminders(store.get()); }} />
              </>
            )}
          </div>
          <small class="muted">Scheduled on this phone by the app, a week ahead. Nothing is sent anywhere.</small>
        </Section>
      )}

      <Section title="Your save">
        <p class="muted">Everything lives on this device. Save storage: <b>{durable === null ? 'unknown' : durable ? 'persistent' : 'best-effort'}</b>{durable === false ? ' — the browser may clear it under storage pressure, so export now and then.' : '.'}</p>
        <div class="stack stack--tight">
          <Btn kind="ghost" block onClick={exportSave}>Export Save</Btn>
          <Btn kind="ghost" block onClick={importSave}>Import Save</Btn>
          {store.backup() && <Btn kind="ghost" block onClick={restoreBackup}>Restore Previous Save</Btn>}
          <Btn kind="danger" block onClick={erase}>Erase Everything</Btn>
        </div>
      </Section>
      <small class="muted center">ARISE v{__APP_VERSION__} · Instructor Ryn Valcorde · all data stored on this device</small>
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
    if (!next) return toast('That is not an ARISE save. Use a file Export Save wrote, or one from the original app.', 'bad');
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
  if (!(await confirm('Erase Save', 'Every level, Shadow, attribute and day of streak is deleted. A single backup is kept until the next import or erase.', 'Erase', true))) return;
  const v = await sys({ title: 'Confirm Erasure', kind: 'danger', typed: false, lines: ['Last chance.'], actions: [{ label: 'Cancel', value: false }, { label: 'Erase Everything', value: true, danger: true }] });
  if (!v) return;
  store.replace(defaults());
  location.reload();
}
