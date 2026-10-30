/**
 * The opening, in three acts.
 *   1. The Association desk: assessment, name, licence. Valcorde does not know the System exists.
 *   2. The cut: the System speaks for the first time.
 *   3. Enrolment: the nine-question intake, started later from the Training tab.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { archetype, DAYS_OPTIONS, EXPERIENCE, FOCUS, forge, GOALS, MINUTES_OPTIONS, slotCount, summary } from '@/core/coach';
import { exById, fmtAmount, GEAR, LIMITATIONS } from '@/core/exercises';
import { regNo } from '@/core/gates';
import * as quests from '@/core/quests';
import * as story from '@/core/story';
import type { Profile } from '@/core/types';
import { ASSESSMENT, HANDOVER } from '@/data/narrative';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Card, Fold } from '@/ui/components';
import { buzz, flash } from '@/ui/feedback';
import { CoachPortrait, Sigil } from '@/ui/icons';
import { HoldButton, sys } from '@/ui/overlays';

// ------------------------------------------------------------------ typing

function useTyped(text: string, speed = 15) {
  const [n, setN] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fast = store.get().settings.fastText;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    sfx.stopTicker();
  };
  useEffect(() => {
    setN(0);
    if (!text) return;
    sfx.startTicker();
    let i = 0;
    timer.current = setInterval(() => {
      i += fast ? 6 : 1;
      setN(Math.min(i, text.length));
      if (i >= text.length) stop();
    }, fast ? 1 : speed);
    return stop;
  }, [text]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => { stop(); setN(text.length); } };
}

/** Valcorde talking, one line per tap. Calls `onDone` after the last. */
function Coach({ lines, onDone, onLine, hot }: { lines: string[]; onDone: () => void; onLine?: (i: number) => void; hot?: boolean }) {
  const [i, setI] = useState(0);
  const { shown, done, skip } = useTyped(lines[i] ?? '', 15);
  const finished = useRef(false);
  const tap = () => {
    if (!done) return skip();
    if (finished.current) return;
    sfx.tap();
    onLine?.(i);
    if (i + 1 < lines.length) setI(i + 1);
    else { finished.current = true; onDone(); }
  };
  return (
    <button type="button" class={`coachcard ${hot ? 'is-hot' : ''}`} onClick={tap} aria-live="polite">
      <CoachPortrait size={56} />
      <div class="coachcard__body">
        <b class="coachcard__name">Ryn Valcorde</b>
        <small class="label">Instructor · Hunter Training</small>
        <p class="coachcard__line">{shown}{!done && <span class="caret" />}</p>
        {done && !finished.current && <span class="cue">Tap to continue ▸</span>}
      </div>
    </button>
  );
}

function Licence({ name, reg }: { name?: string; reg?: string }) {
  return (
    <div class="licence reveal">
      <header>
        <div><span class="label">Hunter Association</span><b>Hunter Licence</b></div>
        <Sigil rank="E" size={40} />
      </header>
      <dl>
        <dt>Name</dt><dd>{name || '— — — — —'}</dd>
        <dt>Guild</dt><dd class="is-none">None</dd>
        <dt>Registry No.</dt><dd class="num">{reg || '—'}</dd>
      </dl>
    </div>
  );
}

// ------------------------------------------------------------------ act 1 and 2

type Step = 'splash' | 'assess' | 'name' | 'handover' | 'cut';

export function Awakening() {
  const s = useSave();
  const [step, setStep] = useState<Step>(story.seen(s, 'ob-licence') ? 'handover' : 'splash');
  const [showCard, setShowCard] = useState(false);
  const [name, setName] = useState('');

  if (step === 'splash') return <Splash onDone={() => setStep('assess')} />;

  if (step === 'assess' || step === 'name') {
    return (
      <main class="awaken">
        <Coach hot lines={[...ASSESSMENT, 'Right. What name am I putting on this thing? It goes on the licence, and the Association does not do reprints.']}
          onLine={(i) => { if (i === 2) { setShowCard(true); sfx.ping(); flash(); } }}
          onDone={() => setStep('name')} />
        {showCard && <Licence />}
        {step === 'name' && (
          <form class="card stack reveal" onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            sfx.success();
            flash();
            const n = name.trim().toUpperCase();
            store.update((x) => { x.hunter.name = n; x.hunter.regNo = regNo(n); story.markOnce(x, 'ob-licence'); });
            setStep('handover');
          }}>
            <label class="label" for="hunter-name">Name for the licence</label>
            <input id="hunter-name" class="input" maxLength={18} placeholder="Enter your name" autoComplete="off" spellcheck={false}
              value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} autoFocus />
            <small class="muted">This is how every Association record will refer to you.</small>
            <Btn kind="primary" size="lg" block type="submit" disabled={!name.trim()} sound="blip">Issue Licence</Btn>
          </form>
        )}
      </main>
    );
  }

  if (step === 'handover') {
    return <Handover name={s.hunter.name} reg={s.hunter.regNo} onDone={() => setStep('cut')} />;
  }
  return <Cut />;
}

function Splash({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  const a = useTyped(line >= 1 ? 'Awakening registered.' : '', 34);
  const b = useTyped(line >= 2 ? 'Assessment pending.' : '', 34);
  useEffect(() => {
    const t = [setTimeout(() => { sfx.blip(); setLine(1); }, 1300), setTimeout(() => { sfx.blip(); setLine(2); }, 3000), setTimeout(onDone, 4800)];
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <main class="awaken awaken--splash" onClick={onDone}>
      <div class="awaken__sigil" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eafaff" /><stop offset="55%" stop-color="#4fd6ff" /><stop offset="100%" stop-color="#9b6bff" /></linearGradient></defs>
          <polygon points="60,6 107,33 107,87 60,114 13,87 13,33" fill="none" stroke="url(#sg)" stroke-width="3" />
          <polygon points="60,24 91,42 91,78 60,96 29,78 29,42" fill="none" stroke="url(#sg)" stroke-width="1.5" opacity=".55" />
          <path d="M60 36 79 72H41Z" fill="url(#sg)" />
        </svg>
      </div>
      <h1 class="wordmark" aria-label="ARISE">ARISE</h1>
      <p class="awaken__sub">Hunter Association · Awakening Assessment · Regional Office</p>
      <div class="awaken__type"><p>{a.shown}</p><p>{b.shown}</p></div>
    </main>
  );
}

function Handover({ name, reg, onDone }: { name: string; reg: string; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { sfx.success(); flash(); }, []);
  return (
    <main class="awaken">
      <Licence name={name} reg={reg} />
      <Coach lines={HANDOVER} onDone={() => setReady(true)} />
      {ready && <Btn kind="primary" size="lg" block class="reveal" sound="gate" onClick={onDone}>Leave The Office</Btn>}
    </main>
  );
}

function Cut() {
  useEffect(() => {
    let live = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 1400));
      if (!live) return;
      sfx.gate();
      flash();
      await new Promise((r) => setTimeout(r, 500));
      await sys({
        title: 'Notification', kind: 'system', center: true,
        lines: ['You have acquired the qualifications to be a <em>Player</em>. Will you accept?'],
        hold: { label: 'Hold To Accept', ms: 5000, ticks: 5, holding: 'Accepting…', done: 'Accepted', tick: sfx.awakenGong, seal: sfx.awakenSeal, after: 1500 },
      });
      await sys({ title: 'Notification', kind: 'system', center: true, lines: ['Congratulations on becoming a <em>Player</em>.'], actions: [{ label: 'Continue', value: true, primary: true }] });
      store.update((x) => { x.onboarded = true; quests.rollDay(x); });
    })();
    return () => { live = false; };
  }, []);
  return <main class="awaken" />;
}

// ------------------------------------------------------------------ act 3: enrolment

type Draft = Pick<Profile, 'goal' | 'experience' | 'days' | 'minutes' | 'equipment' | 'limitations' | 'focus'> & { age: number | null; weight: number | null; units: 'kg' | 'lb' };

interface Option { id: string | number; name: string; desc: string }
type Q =
  | { id: string; coach: string; q: string; hint?: string; type: 'single'; field: keyof Draft; options: Option[] }
  | { id: string; coach: string; q: string; hint?: string; type: 'multi'; field: 'equipment' | 'limitations'; options: Option[] }
  | { id: string; coach: string; q: string; hint?: string; type: 'body' }
  | { id: string; coach: string; q: string; hint?: string; type: 'oath' };

const QUESTIONS: Q[] = [
  { id: 'goal', type: 'single', field: 'goal', coach: 'Enrolment, then. One goal — not four. People who chase four goals get four mediocre outcomes.', q: 'What do you want to improve?', options: GOALS },
  { id: 'experience', type: 'single', field: 'experience', coach: 'Be honest here. If you lie, the first week will hurt and you will blame me.', q: 'What is your training experience?', options: EXPERIENCE },
  { id: 'days', type: 'single', field: 'days', coach: 'Pick the number you will hit on your worst week, not your best one.', q: 'How many sessions a week?', options: DAYS_OPTIONS },
  { id: 'minutes', type: 'single', field: 'minutes', coach: 'Time budget. I would rather give you twenty honest minutes than sixty you skip.', q: 'How long can each session be?', options: MINUTES_OPTIONS },
  {
    id: 'equipment', type: 'multi', field: 'equipment', coach: 'Tell me what you actually own and can reach today. Not what is in the garage under a tarp.',
    q: 'What can you train with?', hint: 'Bare hands are always included. Select everything else you can reach.', options: GEAR.filter((g) => g.id !== 'none'),
  },
  { id: 'focus', type: 'single', field: 'focus', coach: 'Emphasis, not exclusion. I will still train everything.', q: 'Any particular emphasis?', options: FOCUS },
  {
    id: 'limits', type: 'multi', field: 'limitations', coach: 'Anything that hurts, I route around. This is the question people lie about and then get hurt.',
    q: 'Anything that hurts right now?', hint: 'Nothing that loads these will ever be prescribed. Leave it empty if nothing flares up.', options: LIMITATIONS,
  },
  { id: 'body', type: 'body', coach: 'Numbers for the register. They only affect intensity estimates — nothing here is a judgement.', q: 'Age and bodyweight?', hint: 'Optional. Everything stays on this device.' },
  { id: 'oath', type: 'oath', coach: 'Last thing. Every student signs this, and most of them mean it for about a fortnight.', q: 'Training Terms', hint: 'Agree to all four to enrol.' },
];

const TERMS = [
  'I will log honest numbers, not flattering ones.',
  'I will take the deload weeks the programme puts in front of me.',
  'I will tell the instructor when something hurts, before it becomes an injury.',
  'I accept that an E-Rank who trains beats an E-Rank who does not.',
];

const KG_PER_LB = 0.45359237;

export function Intake({ onDone }: { onDone: () => void }) {
  const s = useSave();
  const [first] = useState(() => !s.program && !story.seen(s, 'intake'));
  const [draft, setDraft] = useState<Draft>(() => ({
    goal: s.profile.goal, experience: s.profile.experience, days: s.profile.days, minutes: s.profile.minutes,
    equipment: s.profile.equipment.slice(), limitations: s.profile.limitations.slice(), focus: s.profile.focus,
    age: s.program ? s.profile.age : null, weight: s.program ? s.profile.weight : null, units: s.settings.units,
  }));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'ask' | 'forge' | 'reveal'>('ask');

  if (phase === 'forge') return <Forge draft={draft} onDone={() => setPhase('reveal')} />;
  if (phase === 'reveal') return <Reveal first={first} onDone={onDone} />;

  const q = QUESTIONS[i];
  const next = () => (i + 1 < QUESTIONS.length ? setI(i + 1) : setPhase('forge'));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const answered = q.type !== 'single' || draft[q.field] !== undefined;

  return (
    <main class="intake">
      <div class="intake__progress"><span style={{ transform: `scaleX(${(i + 1) / QUESTIONS.length})` }} /></div>
      <Coach key={q.id} lines={[q.coach]} onDone={() => {}} />
      <section class="card stack">
        <span class="label">Question {i + 1} of {QUESTIONS.length}</span>
        <h2 class="intake__q">{q.q}</h2>
        {q.hint && <p class="muted">{q.hint}</p>}
        {q.type === 'single' && (
          <div class="choices" role="radiogroup">
            {q.options.map((o) => (
              <button type="button" role="radio" aria-checked={draft[q.field] === o.id} key={o.id}
                class={`choice ${draft[q.field] === o.id ? 'is-on' : ''}`}
                onClick={() => { sfx.tap(); set(q.field, o.id as never); }}>
                <span class="choice__mark" /><span class="choice__text"><b>{o.name}</b><small>{o.desc}</small></span>
              </button>
            ))}
          </div>
        )}
        {q.type === 'multi' && (
          <div class="choices">
            {q.options.map((o) => {
              const list = draft[q.field] as string[];
              const on = list.includes(String(o.id));
              return (
                <button type="button" role="checkbox" aria-checked={on} key={o.id} class={`choice choice--multi ${on ? 'is-on' : ''}`}
                  onClick={() => { sfx.tap(); set(q.field, (on ? list.filter((x) => x !== o.id) : [...list, String(o.id)]) as never); }}>
                  <span class="choice__mark" /><span class="choice__text"><b>{o.name}</b><small>{o.desc}</small></span>
                </button>
              );
            })}
          </div>
        )}
        {q.type === 'body' && <BodyStats draft={draft} set={set} />}
        {q.type === 'oath' && <Oath onSigned={next} />}
      </section>
      {q.type !== 'oath' && (
        <div class="row">
          {i > 0 && <Btn kind="ghost" onClick={() => setI(i - 1)}>Back</Btn>}
          <Btn kind="primary" size="lg" class="grow" disabled={!answered} onClick={next}>Continue</Btn>
        </div>
      )}
      {q.type === 'oath' && <Btn kind="ghost" onClick={() => setI(i - 1)}>Back</Btn>}
    </main>
  );
}

function BodyStats({ draft, set }: { draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void }) {
  const lb = draft.units === 'lb';
  const shownWeight = draft.weight == null ? '' : String(Math.round(lb ? draft.weight / KG_PER_LB : draft.weight));
  return (
    <div class="grid2">
      <label class="field">
        <span class="label">Age</span>
        <input class="input num" type="number" inputMode="numeric" min={12} max={99} placeholder="28" value={draft.age ?? ''}
          onInput={(e) => { const n = parseInt((e.target as HTMLInputElement).value, 10); set('age', isFinite(n) ? Math.max(12, Math.min(99, n)) : null); }} />
      </label>
      <label class="field">
        <span class="label">Bodyweight
          <button type="button" class="unit" aria-label="Switch weight units" onClick={(e) => { e.preventDefault(); sfx.tap(); set('units', lb ? 'kg' : 'lb'); }}>{lb ? 'LB' : 'KG'}</button>
        </span>
        <input class="input num" type="number" inputMode="decimal" placeholder={lb ? '165' : '75'} value={shownWeight}
          onInput={(e) => { const n = Number((e.target as HTMLInputElement).value); set('weight', n > 0 ? Math.max(20, Math.min(250, Math.round(lb ? n * KG_PER_LB : n))) : null); }} />
      </label>
    </div>
  );
}

function Oath({ onSigned }: { onSigned: () => void }) {
  const [ticks, setTicks] = useState<boolean[]>(TERMS.map(() => false));
  const all = ticks.every(Boolean);
  return (
    <div class="stack">
      {TERMS.map((t, i) => (
        <button type="button" role="checkbox" aria-checked={ticks[i]} key={t} class={`choice choice--multi ${ticks[i] ? 'is-on' : ''}`}
          onClick={() => { sfx.tap(); setTicks(ticks.map((x, j) => (j === i ? !x : x))); }}>
          <span class="choice__mark" /><span class="choice__text"><b>{t}</b></span>
        </button>
      ))}
      <div class="contract">
        <div class="sigbox">
          <span class="label">Signed by</span>
          <HoldSign disabled={!all} onSigned={onSigned} />
          <span class="sigbox__rule" /><small>Licensed Hunter</small>
        </div>
        <div class="sigbox">
          <span class="label">Signed by</span>
          <span class="signature">Ryn Valcorde</span>
          <span class="sigbox__rule" /><small>Accredited Instructor</small>
        </div>
        <p class="fineprint">Hunter Association · Training Division · Form BHT-1. Enrolment is a training agreement and not a guarantee of rank, placement, survival, or return. Your answers stay on this device; the Association does not receive them.</p>
      </div>
    </div>
  );
}

/** The same hold gesture as the System's windows, so signing feels like the System accepting you. */
const HoldSign = ({ disabled, onSigned }: { disabled: boolean; onSigned: () => void }) =>
  <HoldButton disabled={disabled} hold={{ label: 'Hold To Sign', done: 'Signed' }} onFire={onSigned} />;

const FORGE_LOG = (d: Draft) => [
  'Reading enrolment responses...',
  'Filtering codex against available equipment...',
  'Removing contraindicated exercises...',
  `Selecting split for ${d.days} sessions per week...`,
  `Sizing sessions to ${slotCount(d.minutes)} exercises...`,
  'Assigning sets, targets, and rest intervals...',
  'Setting week 1 volume baseline...',
  'Programme compiled.',
];

function Forge({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [n, setN] = useState(0);
  const lines = FORGE_LOG(draft);
  useEffect(() => {
    store.update((x) => {
      Object.assign(x.profile, {
        goal: draft.goal, experience: draft.experience, days: draft.days, minutes: draft.minutes,
        equipment: draft.equipment, limitations: draft.limitations, focus: draft.focus,
        age: draft.age ?? 28, weight: draft.weight ?? 75,
      });
      x.settings.units = draft.units;
      forge(x, { week: 1 });
      story.markOnce(x, 'intake');
    });
    const t = setInterval(() => setN((k) => { sfx.tap(); return k + 1; }), 210);
    const done = setTimeout(() => { clearInterval(t); sfx.gate(); flash(); onDone(); }, 210 * lines.length + 500);
    return () => { clearInterval(t); clearTimeout(done); };
  }, []);
  return (
    <main class="intake">
      <Coach lines={['Give me a moment. I am building this around what you told me, not a template.']} onDone={() => {}} />
      <section class="card">
        <span class="label">Compiling Programme</span>
        <pre class="forgelog num">{lines.slice(0, n).map((l) => `> ${l}`).join('\n')}</pre>
      </section>
    </main>
  );
}

function Reveal({ first, onDone }: { first: boolean; onDone: () => void }) {
  const s = useSave();
  const [read, setRead] = useState({ a: false, p: false });
  const p = s.program!;
  const enter = async () => {
    if (first && !(read.a && read.p)) {
      sfx.alarm();
      const v = await sys({
        title: 'Hunter Training', kind: 'coach',
        lines: [
          `Straight past it, then. I have just spent nine questions working out what you can actually do, and built you a week off the back of it, and you have looked at ${read.a || read.p ? 'half of it' : 'neither'}.`,
          'It takes about ninety seconds. Two rectangles. On the screen. Behind me.',
        ],
        actions: [{ label: 'Leave Anyway', value: 'leave', danger: true }, { label: 'Read It', value: false, primary: true }],
      });
      if (v !== 'leave') return;
      store.update((x) => { x.flags.ignoredPlan = true; });
    }
    sfx.gate();
    buzz([20, 40, 80]);
    onDone();
  };
  return (
    <main class="intake">
      <Coach lines={[first
        ? 'Enrolment is done and you are on the training roll. I finished your assessment and built a programme off the back of it — shaped by what you can reach, how long you have got, and what hurts. Both are below. Open them before you go anywhere.'
        : 'Re-assessed. Your level, attributes, Shadows and streak are untouched. Here is the week I would give you now.']} onDone={() => {}} />
      <Fold title="Assessment" right={archetype(s)} onOpen={() => setRead((r) => ({ ...r, a: true }))}>
        <h3 class="archetype">{archetype(s)}</h3>
        <ul class="notes">{summary(s).map((n) => <li key={n} dangerouslySetInnerHTML={{ __html: n }} />)}</ul>
      </Fold>
      <Fold title="Ryn’s Training Programme" right={`Week ${p.week}`} onOpen={() => setRead((r) => ({ ...r, p: true }))}>
        <div class="stack">
          {p.days.map((d, i) => (
            <Card key={d.id}>
              <div class="row between"><span class="label">Session {i + 1}</span><span class="chip">{d.slots.length} exercises</span></div>
              <b>{d.name}</b>
              <p class="muted">{d.rationale}</p>
              <ul class="slotlist">{d.slots.map((sl) => <li key={sl.exId}><span>{exById(sl.exId)?.name}</span><span class="num">{sl.sets} × {fmtAmount(exById(sl.exId), sl.target)}</span></li>)}</ul>
            </Card>
          ))}
        </div>
      </Fold>
      <Btn kind="primary" size="lg" block onClick={enter} class={first && !(read.a && read.p) ? 'is-dim' : ''} sound="none">Enter The Association</Btn>
      {first && !(read.a && read.p) && <p class="hint">{!read.a && !read.p ? 'Open the assessment and your programme first.' : `Open your ${read.a ? 'programme' : 'assessment'} as well.`}</p>}
    </main>
  );
}

