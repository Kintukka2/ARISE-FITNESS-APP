/**
 * The opening, in two acts.
 *   1. The Association desk: assessment, name, licence, kit. Valcorde does not know the System exists.
 *   2. The cut: the System speaks for the first time, and the practice gate is waiting.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { regNo } from '@/core/gates';
import { issueKit } from '@/core/gear';
import * as story from '@/core/story';
import { ASSESSMENT, HANDOVER, NAME_PROMPT } from '@/data/narrative';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn } from '@/ui/components';
import { flash } from '@/ui/feedback';
import { CoachPortrait, Sigil } from '@/ui/icons';
import { sys } from '@/ui/overlays';

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
        <dt>Name</dt><dd>{name || '-- --'}</dd>
        <dt>Guild</dt><dd class="is-none">-- --</dd>
        <dt>Registry No.</dt><dd class="num">{reg || '-- --'}</dd>
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
        <Coach hot lines={[...ASSESSMENT, NAME_PROMPT]}
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
            store.update((x) => { x.hunter.name = n; x.hunter.regNo = regNo(n); issueKit(x); story.markOnce(x, 'ob-licence'); });
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
      await sys({ title: 'Notification', kind: 'system', center: true, lines: ['Congratulations on becoming a <em>Player</em>.'], actions: [{ label: 'Close', value: true, primary: true }] });
      store.update((x) => { x.onboarded = true; });
    })();
    return () => { live = false; };
  }, []);
  return <main class="awaken" />;
}
