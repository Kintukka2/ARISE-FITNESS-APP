/**
 * The opening, in two acts.
 *   1. The Association desk: assessment, name, licence, kit. Valcorde does not know the System exists.
 *   2. The cut: the Arrival (ui/arrival.ts) takes the office away, and the System speaks for the
 *      first time.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { regNo } from '@/core/gates';
import { issueKit } from '@/core/gear';
import * as story from '@/core/story';
import { ASSESSMENT, HANDOVER, NAME_PROMPT } from '@/data/narrative';
import * as store from '@/store';
import { useSave } from '@/store';
import { arrival, T, type ArrivalCtl } from '@/ui/arrival';
import { Btn, CoachHead } from '@/ui/components';
import { useTyped } from '@/ui/typed';
import { flash } from '@/ui/feedback';
import { Sigil } from '@/ui/icons';
import { sys } from '@/ui/overlays';

/** Valcorde talking, one line per tap. Calls `onDone` after the last. */
function Coach({ lines, onDone, onLine, hot }: { lines: string[]; onDone: () => void; onLine?: (i: number) => void; hot?: boolean }) {
  const [i, setI] = useState(0);
  const { shown, done, skip } = useTyped(lines[i] ?? '', { speed: 15 });
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
    <button type="button" class={`coachcard coachframe ${hot ? 'is-hot' : ''}`} onClick={tap} aria-live="polite">
      <CoachHead speaking={!done} size={48} />
      <p class="coachcard__line">{shown}{!done && <span class="caret" />}</p>
      {done && !finished.current && <span class="cue">Tap to continue ▸</span>}
    </button>
  );
}

/** `lifted` hides the rank plate while the Arrival carries its copy away. */
function Licence({ name, reg, lifted }: { name?: string; reg?: string; lifted?: boolean }) {
  return (
    <div class={`licence reveal ${lifted ? 'is-lifted' : ''}`}>
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
  // Once the Arrival's dark has closed over the office, the office goes.
  const [dark, setDark] = useState(false);

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

  // The office stays under the cut until the dark has covered it, so the plate lifts off a real licence.
  return (
    <>
      {!dark && <Handover name={s.hunter.name} reg={s.hunter.regNo} leaving={step === 'cut'} onDone={() => setStep('cut')} />}
      {step === 'cut' && <Cut onDark={() => setDark(true)} />}
    </>
  );
}

function Splash({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  const a = useTyped(line >= 1 ? 'Awakening registered.' : '', { speed: 34 });
  const b = useTyped(line >= 2 ? 'Assessment pending.' : '', { speed: 34 });
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
      <h1 class="wordmark" aria-label="Arise">ARISE</h1>
      <p class="awaken__sub">Hunter Association · Awakening Assessment · Regional Office</p>
      <div class="awaken__type"><p>{a.shown}</p><p>{b.shown}</p></div>
    </main>
  );
}

function Handover({ name, reg, leaving, onDone }: { name: string; reg: string; leaving: boolean; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { sfx.success(); flash(); }, []);
  return (
    <main class="awaken">
      <Licence name={name} reg={reg} lifted={leaving} />
      <Coach lines={HANDOVER} onDone={() => setReady(true)} />
      {ready && <Btn kind="primary" size="lg" block class="reveal" disabled={leaving} onClick={onDone}>Leave The Office</Btn>}
    </main>
  );
}

/**
 * The Arrival, then the System's first two windows over what it leaves behind. The hold drives the
 * light: each gong brightens the lock, the seal blows it apart. A hunter who has watched it to the
 * end once may tap through it to the breach.
 */
function Cut({ onDark }: { onDark: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<ArrivalCtl | null>(null);
  // Before paint, so the plate on the licence and the one the Arrival lifts never show together or not at all.
  useLayoutEffect(() => {
    const plate = document.querySelector('.licence .sigil')?.getBoundingClientRect();
    const from = plate?.width ? { x: plate.left + plate.width / 2, y: plate.top + plate.height / 2, size: plate.width } : null;
    const a = arrival(ref.current!, { from, skippable: story.seen(store.get(), 'ob-arrival') });
    ctl.current = a;
    const gone = setTimeout(onDark, T.dark);
    let live = true;
    (async () => {
      await a.ready;
      if (!live) return;
      store.update((x) => { story.markOnce(x, 'ob-arrival'); });
      await sys({
        title: 'Notification', kind: 'system', center: true,
        lines: ['You have acquired the qualifications to be a <em>Player</em>. Will you accept?'],
        hold: {
          label: 'Hold To Accept', ms: 5000, ticks: 5, holding: 'Accepting…', done: 'Accepted', after: 1500,
          tick: (n, of) => { sfx.awakenGong(n, of); a.charge(n, of); },
          seal: () => { sfx.awakenSeal(); a.seal(); },
        },
      });
      if (!live) return;
      await sys({ title: 'Notification', kind: 'system', center: true, lines: ['Congratulations on becoming a <em>Player</em>.'], actions: [{ label: 'Close', value: true, primary: true }] });
      if (!live) return;
      await a.leave();
      if (!live) return;
      store.update((x) => { x.onboarded = true; });
    })();
    return () => { live = false; clearTimeout(gone); a.stop(); };
  }, []);
  return <canvas ref={ref} class="arrival" aria-hidden="true" onPointerDown={() => ctl.current?.skip()} />;
}
