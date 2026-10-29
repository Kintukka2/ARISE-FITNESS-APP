/** One exercise picker for every purpose: building a programme, swapping mid-session, and the lift dossier. */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { ALL_EXERCISES, exById, fmtAmount, GEAR, hurts, LIMITATIONS, owns, PATTERN_NAMES, statsOf } from '@/core/exercises';
import type { Exercise, Save } from '@/core/types';
import * as store from '@/store';
import { Chip, Empty, Section, Tile } from './components';
import { Glyph } from './icons';
import { openSheet } from './overlays';

const REGIONS: { key: string; name: string; patterns: string[] }[] = [
  { key: 'all', name: 'All', patterns: [] },
  { key: 'push', name: 'Push', patterns: ['push', 'vpush'] },
  { key: 'pull', name: 'Pull', patterns: ['pull', 'vpull'] },
  { key: 'legs', name: 'Legs', patterns: ['squat', 'hinge', 'lunge', 'plyo'] },
  { key: 'core', name: 'Core', patterns: ['core', 'carry'] },
  { key: 'cond', name: 'Cardio', patterns: ['cardio'] },
  { key: 'mob', name: 'Mobility', patterns: ['mobility'] },
];

let lastRegion = 'all';

function warnings(s: Save, ex: Exercise): string[] {
  const out: string[] = [];
  if (!owns(ex, s.profile.equipment)) out.push(`needs ${GEAR.find((g) => ex.equip.includes(g.id))?.name.toLowerCase() ?? 'kit'}`);
  if (hurts(ex, s.profile.limitations)) out.push(`loads your ${ex.flags.filter((f) => s.profile.limitations.includes(f)).map((f) => LIMITATIONS.find((l) => l.id === f)?.name.toLowerCase()).join(' and ')}`);
  return out;
}

export function Picker({ onPick, current, pattern }: { onPick: (ex: Exercise) => void; current?: string; pattern?: string }) {
  const s = store.get();
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(pattern ? REGIONS.find((r) => r.patterns.includes(pattern))?.key ?? 'all' : lastRegion);
  const reg = REGIONS.find((r) => r.key === region)!;
  const list = ALL_EXERCISES
    .filter((x) => !x.regress || x.id === current)
    .filter((x) => (q ? x.name.toLowerCase().includes(q.toLowerCase()) : region === 'all' || reg.patterns.includes(x.pattern)))
    .sort((a, b) => Number(!owns(a, s.profile.equipment)) - Number(!owns(b, s.profile.equipment)) || a.name.localeCompare(b.name));
  return (
    <div class="stack">
      <input class="input" type="search" placeholder="Search the codex" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search exercises" />
      {!q && (
        <div class="chips">
          {REGIONS.map((r) => <Chip key={r.key} on={region === r.key} onClick={() => { setRegion(r.key); lastRegion = r.key; }}>{r.name}</Chip>)}
        </div>
      )}
      {list.length === 0 && <Empty>Nothing in the codex goes by that name.</Empty>}
      <ul class="picklist">
        {list.map((ex) => {
          const w = warnings(s, ex);
          return (
            <li key={ex.id}>
              <button type="button" class={`pickrow ${ex.id === current ? 'is-current' : ''}`} onClick={() => { sfx.blip(); onPick(ex); }}>
                <span class="pickrow__text">
                  <b>{ex.name}</b>
                  <small>{PATTERN_NAMES[ex.pattern] ?? ex.pattern} · {fmtAmount(ex, ex.base)}{ex.load ? ' · weighted' : ''} · Tier {ex.tier}</small>
                  {w.length > 0 && <small class="warn">⚠ {w.join(' · ')}</small>}
                </span>
                {ex.id === current ? <span class="chip">Current</span> : <Glyph name="chevron" />}
              </button>
            </li>
          );
        })}
      </ul>
      <small class="muted">{list.length} of {ALL_EXERCISES.length} techniques.</small>
    </div>
  );
}

export function pickExercise(title: string, onPick: (ex: Exercise) => void, opts: { current?: string; pattern?: string } = {}) {
  const close = openSheet({ title, render: () => <Picker current={opts.current} pattern={opts.pattern} onPick={(ex) => { close(); onPick(ex); }} /> });
}

/** Everything known about one technique, and what it has done for you. */
export function openLift(exId: string) {
  const ex = exById(exId);
  if (!ex) return;
  openSheet({
    title: ex.name,
    render: () => {
      const s = store.get();
      const rec = s.lifts[exId];
      const units = s.settings.units;
      const w = (kg: number) => (units === 'lb' ? Math.round(kg / 0.45359237) : Math.round(kg * 10) / 10);
      return (
        <div class="stack">
          <p>{ex.cue}</p>
          <div class="chips">
            <Chip>{PATTERN_NAMES[ex.pattern] ?? ex.pattern}</Chip><Chip>Tier {ex.tier}</Chip><Chip>{fmtAmount(ex, ex.base)} baseline</Chip>
            {ex.load && <Chip tone="gold">Weighted</Chip>}
          </div>
          <Section title="Trains">
            <div class="chips">{statsOf(ex).map((k, i) => <Chip key={k} tone="mana">{k}{i === 0 ? ' · primary' : ''}</Chip>)}</div>
          </Section>
          <Section title="Needs">
            <div class="chips">{ex.equip.map((e) => <Chip key={e}>{GEAR.find((g) => g.id === e)?.name ?? e}</Chip>)}</div>
          </Section>
          {ex.flags.length > 0 && (
            <Section title="Filtered out by">
              <div class="chips">{ex.flags.map((f) => <Chip key={f} tone="blood">{LIMITATIONS.find((l) => l.id === f)?.name ?? f}</Chip>)}</div>
            </Section>
          )}
          {rec ? (
            <>
              <div class="tiles">
                <Tile label="Best set" value={fmtAmount(ex, rec.best)} />
                {ex.load && <Tile label="Heaviest" value={`${w(rec.heaviest)} ${units}`} />}
                <Tile label="Sets" value={rec.sets} />
                {ex.load && <Tile label="Moved" value={`${w(rec.volume).toLocaleString()} ${units}`} />}
              </div>
              <Section title="History" right={`last ${rec.history.length}`}>
                <ul class="history">
                  {rec.history.map((h, i) => <li key={i}><span>{h.day}</span><span class="num">{h.sets} sets · top {fmtAmount(ex, h.top)}{h.weight ? ` @ ${w(h.weight)} ${units}` : ''}</span></li>)}
                </ul>
              </Section>
            </>
          ) : <Empty>Nothing logged for this yet. Train it once and its record starts here.</Empty>}
        </div>
      );
    },
  });
}
