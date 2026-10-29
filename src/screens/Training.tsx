/** Hunter Training: Basic Training, Ryn's week, your own programmes, and the controls around them. */
import { useState } from 'preact/hooks';
import { archetype, forge, goalOf, nextDay } from '@/core/coach';
import { available, exById, fmtAmount, PATTERN_NAMES } from '@/core/exercises';
import * as sessions from '@/core/sessions';
import * as story from '@/core/story';
import * as templates from '@/core/templates';
import type { Save, Slot, Template } from '@/core/types';
import { CERTIFIED_LINES, TRAINING_BLURB } from '@/data/narrative';
import { dayKey, pick, rng, whenDay } from '@/core/util';
import { intake, player } from '@/app/router';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, Card, Chip, Empty, IconBtn, Panel, Section, Stepper, Tile, Voice } from '@/ui/components';
import { Glyph } from '@/ui/icons';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { openLift, pickExercise } from '@/ui/picker';

export function Training() {
  const s = useSave();
  if (!s.program) return <NoProgramme />;
  if (!s.training.certified) return <Uncertified />;
  return <Certified />;
}

function NoProgramme() {
  return (
    <div class="stack">
      <Voice who="coach">You found it. Good. Nine questions and I will build you something you can actually follow — your rank is fixed, your training is not, and only one of those decides what you can do next week.</Voice>
      <Panel title="Hunter Training" tools={<Chip>Recruit</Chip>}>
        <Card hot>
          <span class="label">Basic Hunter Training · Learning The Ropes</span>
          <p class="muted">{TRAINING_BLURB}</p>
        </Card>
        <Card tour="enrol">
          <b>Interview with Ryn Valcorde</b>
          <p class="muted">Nine questions: what you are after, what you have done before, how often you can train, what equipment you can reach, and anything that hurts. Two minutes, once. Valcorde builds the week from your answers and it adapts on its own after that.</p>
          <Btn kind="primary" size="lg" block sound="gate" onClick={() => intake.set(true)}>Begin Interview</Btn>
        </Card>
        <p class="muted center">Daily Quests run with or without a programme.</p>
      </Panel>
    </div>
  );
}

function Uncertified() {
  const s = useSave();
  const slots = sessions.basicSlots(s);
  return (
    <div class="stack">
      <Voice who="coach">Fundamentals, once through. You will find them boring — that is precisely what makes them fundamentals. Finish it and you are on file as trained.</Voice>
      <Panel title="Hunter Training" tools={<Chip tone="ember">Uncertified</Chip>}>
        <Card hot tour="basic">
          <span class="label">Basic Hunter Training — the session player, end to end</span>
          <p class="muted">{sessions.BASIC_BRIEF}</p>
          <ul class="slotlist">{slots.map((sl) => <li key={sl.exId}><span>{exById(sl.exId)?.name}</span><span class="num">{sl.sets} × {fmtAmount(exById(sl.exId), sl.target)}</span></li>)}</ul>
          <Btn kind="primary" size="lg" block sound="gate" onClick={() => { store.update((x) => sessions.startBasic(x)); player.set(true); }}>Begin Basic Hunter Training</Btn>
        </Card>
        <Section title="The Week" right="Locked" />
        <Card class="is-locked">
          <b><Glyph name="lock" /> Sessions locked</b>
          <p class="muted">Your week is built and waiting. It opens the moment Basic Hunter Training is done, which is one session away.</p>
        </Card>
      </Panel>
      <Controls certified={false} />
    </div>
  );
}

function Certified() {
  const s = useSave();
  const [tab, setTab] = useState<'week' | 'mine'>('week');
  const line = pick(CERTIFIED_LINES, rng(dayKey() + '|academy|' + s.hunter.name));
  return (
    <div class="stack">
      <Voice who="coach">{line}</Voice>
      <Panel title="Hunter Training" tools={<><IconBtn icon="cert" label="Certification" onClick={certWindow} /><IconBtn icon="chart" label="Training stats" onClick={openStats} /></>}>
        <div class="tabs" role="tablist" data-tour="blocktabs">
          <button type="button" role="tab" aria-selected={tab === 'week'} class={`tab ${tab === 'week' ? 'is-on' : ''}`} onClick={() => setTab('week')}>Ryn’s Week</button>
          <button type="button" role="tab" aria-selected={tab === 'mine'} class={`tab ${tab === 'mine' ? 'is-on' : ''}`} onClick={() => setTab('mine')}>
            Your Programmes {s.templates.length > 0 && <span class="badge badge--plain">{s.templates.length}</span>}
          </button>
        </div>
        {tab === 'week' ? <Week /> : <Mine />}
      </Panel>
      <Controls certified />
    </div>
  );
}

function certWindow() {
  void sys({
    title: 'Certified', kind: 'gold', center: true, glyph: 'check',
    lines: [
      '<strong>Basic Hunter Training complete.</strong> One session, start to finish.',
      'You know how to train now. Ryn Valcorde is still here if you ever need anything; he is simply no longer standing over you.',
      'Train on Ryn Valcorde’s programme, or build your own. The choice of exercises is yours either way.',
    ],
    actions: [{ label: 'Continue', value: true, primary: true }],
  });
}

function Week() {
  const s = useSave();
  const p = s.program!;
  const [sel, setSel] = useState(() => nextDay(s)?.id ?? p.days[0]?.id);
  const day = p.days.find((d) => d.id === sel) ?? p.days[0];
  const done = p.completed.length;
  const g = goalOf(s.profile.goal);
  const isDone = p.completed.includes(day.id);
  const minutes = templates.minutes(day.slots);
  return (
    <div class="stack">
      <div class="plates">
        <div class="plate"><span class="label">Training block</span><b>Week {p.week}{p.deload ? ' · Deload' : ''}</b></div>
        <div class="plate"><span class="label">Valcorde’s assessment</span><b>{archetype(s)}</b></div>
      </div>
      <p class="muted">{g.name} · {s.profile.days} sessions a week · volume {Math.round(p.adapt * 100)}%</p>
      <Bar pct={(done / p.days.length) * 100} tone={done >= p.days.length ? 'verdant' : 'mana'} label="Week progress" />
      <small class="muted">{done} of {p.days.length} sessions cleared this week</small>
      <div class="dayboxes" data-tour="days">
        {p.days.map((d, i) => (
          <button type="button" key={d.id} class={`daybox ${d.id === day.id ? 'is-on' : ''} ${p.completed.includes(d.id) ? 'is-done' : ''}`} onClick={() => setSel(d.id)} aria-pressed={d.id === day.id}>
            <b class="num">{p.completed.includes(d.id) ? '✓' : i + 1}</b><small>{d.name.replace(/ Protocol| —/g, '')}</small>
          </button>
        ))}
      </div>
      <Card>
        <div class="row between"><span class="label">Session {p.days.indexOf(day) + 1} of {p.days.length}{isDone ? ' — cleared' : ''}</span><span class="muted num">~{minutes} min</span></div>
        <b>{day.name}</b>
        <p class="muted">{day.rationale}</p>
        <ul class="slotlist">
          {day.slots.map((sl) => (
            <li key={sl.exId}>
              <button type="button" class="linkish" onClick={() => openLift(sl.exId)}>{exById(sl.exId)?.name}</button>
              <span class="num">{sl.sets} × {fmtAmount(exById(sl.exId), sl.target)}{sl.weight ? ` @ ${showKg(s, sl.weight)}` : ''}</span>
            </li>
          ))}
        </ul>
        <Btn kind={isDone ? 'ghost' : 'primary'} size="lg" block sound="gate" tour="begin"
          onClick={() => { store.update((x) => sessions.startProgram(x, day.id)); player.set(true); }}>{isDone ? 'Repeat Session' : 'Begin Session'}</Btn>
      </Card>
    </div>
  );
}

export const showKg = (s: Save, kg: number) => (s.settings.units === 'lb' ? `${Math.round(kg / 0.45359237)} lb` : `${Math.round(kg * 10) / 10} kg`);

function Mine() {
  const s = useSave();
  if (!s.templates.length) {
    return (
      <div class="stack">
        <Empty title="Nothing saved yet">Build one: pick the exercises, set the sets, the weight and the rest, and it is yours to run whenever you like.</Empty>
        <Btn kind="primary" block onClick={() => openBuilder()}>Create Workout Programme</Btn>
      </div>
    );
  }
  return (
    <div class="stack">
      {s.templates.map((t) => (
        <Card key={t.id} class="tplcard">
          <div class="row between">
            <b>{t.name}</b>
            <div class="row">
              <IconBtn icon="info" label={`Edit ${t.name}`} onClick={() => openBuilder(t)} />
              <IconBtn icon="trash" label={`Delete ${t.name}`} onClick={async () => {
                if (await confirm('Delete Programme', `Delete <em>${t.name.replace(/</g, '&lt;')}</em>? Sessions already logged from it stay on the record.`, 'Delete', true)) {
                  store.update((x) => templates.remove(x, t.id));
                  toast('Deleted.', 'warn');
                }
              }} />
            </div>
          </div>
          <small class="muted">{t.slots.length} exercises · {t.slots.reduce((n, x) => n + x.sets, 0)} sets · ~{templates.minutes(t.slots)} min · {t.lastRun ? `last run ${whenDay(t.lastRun)}` : 'never run'}</small>
          <Btn kind={t.runs ? 'ghost' : 'primary'} block sound="gate" onClick={() => { store.update((x) => sessions.startTemplate(x, t.id)); player.set(true); }}>{t.runs ? 'Repeat' : 'Begin'} {t.name}</Btn>
        </Card>
      ))}
      <Btn kind="ghost" block onClick={() => openBuilder()}><Glyph name="plus" /> New Programme</Btn>
    </div>
  );
}

function Controls({ certified }: { certified: boolean }) {
  const s = useSave();
  const fits = available(s.profile.equipment, s.profile.limitations);
  const on = fits.filter((x) => !s.training.excluded.includes(x.id)).length;
  return (
    <Section title="Training Controls">
      <div class="controls">
        <Btn kind="ghost" block onClick={openRegime}><Glyph name="book" /> Choose Your Exercises <span class="num muted">{on} / {fits.length}</span></Btn>
        {certified && <Btn kind="ghost" block onClick={async () => {
          if (await confirm('Re-Roll Week', 'Valcorde will rebuild this week with a different selection of exercises at the same difficulty. Completed sessions are cleared.', 'Re-Roll')) {
            store.update((x) => forge(x, { week: x.program!.week, salt: 'reroll-' + Date.now() }));
            toast('Week re-forged.', 'warn');
          }
        }}><Glyph name="swap" /> Re-Roll This Week</Btn>}
        <Btn kind="ghost" block onClick={async () => {
          if (await confirm('New Intake', 'Your goal, schedule, equipment and limitations are asked again and the week is rebuilt. Level, attributes, Shadows and streak are all kept.', 'Start Interview')) intake.set(true);
        }}><Glyph name="profile" /> Interview With Valcorde Again</Btn>
        {certified && <Btn kind="ghost" block onClick={() => openBuilder()}><Glyph name="plus" /> Create Your Own Programme</Btn>}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ the Regime

function openRegime() {
  openSheet({
    title: 'Choose Your Exercises',
    render: () => {
      const s = store.get();
      const fits = available(s.profile.equipment, s.profile.limitations);
      const groups = [...new Set(fits.map((x) => x.pattern))];
      return (
        <div class="stack">
          <p class="muted">Every technique your kit and body allow. Selected ones are what Valcorde may prescribe; tap one to strike it off. Changes apply the next time the week is built. If you strike off a whole pattern, it comes back — a leg day has to contain legs.</p>
          {s.training.excluded.length > 0 && <Btn kind="ghost" size="sm" onClick={() => store.update((x) => { x.training.excluded = []; })}>Restore all {s.training.excluded.length}</Btn>}
          {groups.map((g) => (
            <Section key={g} title={PATTERN_NAMES[g] ?? g} right={`${fits.filter((x) => x.pattern === g && !s.training.excluded.includes(x.id)).length}/${fits.filter((x) => x.pattern === g).length}`}>
              <div class="chips">
                {fits.filter((x) => x.pattern === g).map((x) => (
                  <Chip key={x.id} on={!s.training.excluded.includes(x.id)} onClick={() => store.update((y) => {
                    const i = y.training.excluded.indexOf(x.id);
                    if (i >= 0) y.training.excluded.splice(i, 1);
                    else y.training.excluded.push(x.id);
                  })}>{x.name} <small>T{x.tier}</small></Chip>
                ))}
              </div>
            </Section>
          ))}
          <small class="muted">Techniques that need kit you have not declared, or that load a joint you flagged, are not listed. Change those through the interview.</small>
        </div>
      );
    },
  });
}

// ------------------------------------------------------------------ the builder

function openBuilder(existing?: Template) {
  let draft: { id?: string; name: string; slots: Slot[] } = existing
    ? { id: existing.id, name: existing.name, slots: existing.slots.map((x) => ({ ...x })) }
    : { name: '', slots: [] };
  let dirty = false;
  const close = openSheet({
    title: existing ? 'Edit Programme' : 'New Programme',
    onClose: () => { /* discarded: nothing is written until Save */ },
    render: () => <Builder initial={draft} onChange={(d) => { draft = d; dirty = true; }} onSave={() => {
      const saved = store.update((x) => templates.save(x, draft));
      if (!saved) return toast(store.get().templates.length >= templates.TEMPLATES_MAX ? 'You are holding 30 programmes. Delete one first.' : templates.problems(draft)[0], 'bad');
      toast(`“${saved.name}” saved.`, 'good');
      void dirty;
      close();
    }} />,
  });
}

function Builder({ initial, onChange, onSave }: { initial: { id?: string; name: string; slots: Slot[] }; onChange: (d: { id?: string; name: string; slots: Slot[] }) => void; onSave: () => void }) {
  const [d, setD] = useState(initial);
  const s = store.get();
  const set = (next: typeof d) => { setD(next); onChange(next); };
  const setSlot = (i: number, patch: Partial<Slot>) => set({ ...d, slots: d.slots.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const problems = templates.problems(d);
  const lb = s.settings.units === 'lb';
  return (
    <div class="stack">
      <div class="row">
        <input class="input grow" maxLength={templates.NAME_MAX} placeholder="Name it to save it" value={d.name} aria-label="Programme name"
          onInput={(e) => set({ ...d, name: (e.target as HTMLInputElement).value })} />
        <Btn kind="primary" size="sm" sound="success" class={problems.length ? 'is-dim' : ''} onClick={onSave}>Save</Btn>
      </div>
      {d.slots.length === 0 && <Empty>Nothing in it yet. Add an exercise, then set how many sets, how much and how long you rest.</Empty>}
      {d.slots.map((sl, i) => {
        const ex = exById(sl.exId);
        return (
          <Card key={sl.exId + i} class="tplslot">
            <div class="row between">
              <button type="button" class="linkish" onClick={() => openLift(sl.exId)}><b>{ex?.name}</b></button>
              <div class="row">
                <IconBtn icon="up" label="Move up" disabled={i === 0} onClick={() => { const a = d.slots.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ ...d, slots: a }); }} />
                <IconBtn icon="swap" label="Swap exercise" onClick={() => pickExercise('Swap Exercise', (x) => setSlot(i, { exId: x.id, target: x.unit === ex?.unit ? sl.target : x.base, load: !!x.load, weight: x.load ? sl.weight ?? null : null }), { current: sl.exId })} />
                <IconBtn icon="trash" label="Remove" onClick={() => set({ ...d, slots: d.slots.filter((_, j) => j !== i) })} />
              </div>
            </div>
            <div class="tplslot__grid">
              <label><span class="label">Sets</span><Stepper value={sl.sets} step={1} min={1} max={templates.SETS_MAX} label="sets" onCommit={(v) => setSlot(i, { sets: v })} /></label>
              <label><span class="label">{ex?.unit === 'sec' ? 'Seconds' : ex?.unit === 'm' ? 'Metres' : 'Reps'}</span><Stepper value={sl.target} step={ex?.unit === 'sec' ? 5 : ex?.unit === 'm' ? 50 : 1} min={1} max={ex?.unit === 'm' ? 20000 : 600} label="target" onCommit={(v) => setSlot(i, { target: v })} /></label>
              {sl.load && <label><span class="label">Weight ({lb ? 'lb' : 'kg'})</span><Stepper value={sl.weight ? Math.round((lb ? sl.weight / 0.45359237 : sl.weight) * 10) / 10 : 0} step={lb ? 5 : 2.5} min={0} max={lb ? 1300 : 600} label="weight" onCommit={(v) => setSlot(i, { weight: v > 0 ? (lb ? v * 0.45359237 : v) : null })} /></label>}
              <label><span class="label">Rest</span>
                <select class="input" value={sl.rest} onChange={(e) => setSlot(i, { rest: Number((e.target as HTMLSelectElement).value) })}>
                  {[0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map((r) => <option key={r} value={r}>{r === 0 ? 'none' : r < 60 ? `${r}s` : `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`}</option>)}
                </select>
              </label>
            </div>
          </Card>
        );
      })}
      <Btn kind="primary" block disabled={d.slots.length >= templates.ITEMS_MAX} onClick={() => pickExercise('Add Exercise', (x) => set({ ...d, slots: [...d.slots, templates.newSlot(x.id)] }))}><Glyph name="plus" /> Add Exercise</Btn>
      <div class="row between"><small class="muted">{d.slots.length} exercises · {d.slots.reduce((n, x) => n + x.sets, 0)} sets</small><small class="muted num">~{templates.minutes(d.slots)} min</small></div>
      {problems[0] && d.slots.length > 0 && <p class="hint">{problems[0]}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ stats

function openStats() {
  openSheet({ title: 'Training Stats', render: () => <Stats s={store.get()} /> });
}

function Stats({ s }: { s: Save }) {
  const [range, setRange] = useState<4 | 12 | 0>(12);
  const today = dayKey();
  const cutoff = range ? new Date(Date.now() - range * 7 * 864e5) : null;
  const hist = s.history.filter((h) => !cutoff || h.day >= dayKey(cutoff));
  if (!hist.length) {
    return <div class="stack"><RangeChips range={range} setRange={setRange} /><Empty>No sessions in this window. Train one and everything below fills in.</Empty></div>;
  }
  const sets = hist.reduce((n, h) => n + h.sets, 0);
  const asked = hist.reduce((n, h) => n + h.setsAsked, 0);
  const mins = hist.reduce((n, h) => n + h.minutes, 0);
  const days = new Set(hist.map((h) => h.day)).size;
  const patterns: Record<string, number> = {};
  for (const h of hist) for (const [p, n] of Object.entries(h.patterns)) patterns[p] = (patterns[p] ?? 0) + n;
  const topP = Math.max(1, ...Object.values(patterns));
  const ratings: Record<string, number> = {};
  for (const h of hist) if (h.rating) ratings[h.rating] = (ratings[h.rating] ?? 0) + 1;
  // Sessions per Monday-week, last 8 weeks.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - (7 - i) * 7 + 7);
    const start = dayKey(d);
    const end = dayKey(new Date(d.getTime() + 7 * 864e5));
    return { start, n: s.history.filter((h) => h.day >= start && h.day < end).length };
  });
  const maxW = Math.max(s.profile.days, ...weeks.map((w) => w.n));
  return (
    <div class="stack">
      <RangeChips range={range} setRange={setRange} />
      <div class="tiles">
        <Tile label="Volume scalar" value={`${Math.round((s.program?.adapt ?? 1) * 100)}%`} sub="of baseline · moves every session" />
        <Tile label="Sessions" value={hist.length} sub={`${days} separate days`} />
        <Tile label="Sets logged" value={sets} sub={`of ${asked} prescribed`} />
        <Tile label="Time training" value={`${Math.floor(mins / 60)}h ${mins % 60}m`} />
      </div>
      <Section title="Consistency" right={`target ${s.profile.days} a week`}>
        <div class="cols" aria-label="Sessions per week">
          {weeks.map((w, i) => <div key={w.start} class={`cols__col ${w.n >= s.profile.days ? 'is-hit' : ''} ${i === weeks.length - 1 ? 'is-now' : ''}`} style={{ height: `${(w.n / maxW) * 100}%` }} title={`${w.start}: ${w.n}`}><span class="num">{w.n}</span></div>)}
          <div class="cols__target" style={{ bottom: `${(s.profile.days / maxW) * 100}%` }} />
        </div>
        <small class="muted">Green weeks hit your own target. The last column is this week, still in progress.</small>
      </Section>
      <Section title="Where the work went" right={`${sets} sets`}>
        <div class="ledger">
          {Object.entries(patterns).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
            <div key={p} class="ledger__row"><span class="label">{PATTERN_NAMES[p] ?? p}</span><Bar pct={(n / topP) * 100} thin /><span class="num">{n}</span></div>
          ))}
        </div>
      </Section>
      {Object.keys(ratings).length > 0 && (
        <Section title="How it felt" right={`${Object.values(ratings).reduce((a, b) => a + b, 0)} debriefs`}>
          <div class="chips">{['easy', 'right', 'hard', 'brutal'].map((r) => <Chip key={r}>{r[0].toUpperCase() + r.slice(1)} · {ratings[r] ?? 0}</Chip>)}</div>
          <small class="muted">Your own answer at the end of each session. It is the biggest single input to next week’s volume.</small>
        </Section>
      )}
      <div class="tiles">
        <Tile label="Repetitions" value={s.stats.totalReps.toLocaleString()} sub="lifetime" />
        <Tile label="Under tension" value={`${Math.round(s.stats.totalSeconds / 60)} min`} sub="holds" />
        <Tile label="Distance" value={`${(s.stats.totalMeters / 1000).toFixed(1)} km`} />
        <Tile label="Load moved" value={showKg(s, s.stats.totalVolumeKg)} />
      </div>
      <small class="muted">{today}</small>
    </div>
  );
}

function RangeChips({ range, setRange }: { range: number; setRange: (r: 4 | 12 | 0) => void }) {
  return <div class="chips">{([4, 12, 0] as const).map((r) => <Chip key={r} on={range === r} onClick={() => setRange(r)}>{r ? `${r} weeks` : 'All time'}</Chip>)}</div>;
}

export const trainingSeen = (s: Save) => story.seen(s, 'intake');
