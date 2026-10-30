/**
 * The session player: full-screen, one exercise in focus, a row per set.
 * Ticking only marks the session. Everything is paid at Finish, on one
 * report screen, after an honest answer to "how did that feel?".
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import type { Rating } from '@/core/coach';
import { exById, fmtAmount, stepOf, unitShort } from '@/core/exercises';
import { gearDef } from '@/core/gear';
import * as sessions from '@/core/sessions';
import { mmss } from '@/core/util';
import { player, type Route } from '@/app/router';
import { rewardChain } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, IconBtn, Stepper, Tile } from '@/ui/components';
import { buzz, flash } from '@/ui/feedback';
import { Glyph } from '@/ui/icons';
import { confirm, pushBack, sys, tour, tourOpen, windowOpen } from '@/ui/overlays';
import { openLift, pickExercise } from '@/ui/picker';

const KG_PER_LB = 0.45359237;

const TEACH = {
  open: {
    title: 'Before you start', steps: [
      { at: 'target', say: 'That number is the target for ONE set. Not for the whole exercise — for one set. People get this wrong on their first day and then wonder why they are exhausted.' },
      { at: 'sets', say: 'One row per set. Do the set, tick the mark on its row. That is the entire job, and everything else on this screen is in service of it.' },
      { at: 'next', say: 'Everything still to come is listed there. Read it before you start so you do not spend everything on the first movement.' },
      { at: 'foot', say: 'When every row is ticked, the button at the bottom finishes the session. Three movements, three sets each. Go.' },
    ],
  },
  logged: {
    title: 'That was one set', steps: [
      { at: 'sets', say: 'The number in a row can be changed before you tick it. If I asked for five and you got three, put three. If you got twelve, put twelve.' },
      { at: 'sets', say: 'Nothing checks this. That is deliberate: the log is worth exactly what your honesty is worth.' },
      { at: 'sets', say: 'Every set you finish banks a point into the attributes that movement trains. That is what the Boon on the Quests screen pays out on.' },
      { at: 'rest', say: 'And that is the rest. The number on it is what I prescribed: rest too little and the last set is a worse version of the first. The timer starts on its own after a tick.' },
    ],
  },
  queue: {
    title: 'One movement down', steps: [
      { at: 'add', say: 'If a set was too easy, add one. I would rather you told me the prescription was light than quietly did more and let me go on prescribing light.' },
      { at: 'target', say: 'If something hurts, swap the movement for another — tap Swap. The new one is prescribed for you.' },
      { at: 'foot', say: 'On your own sessions I ask how it felt when you finish. Answer honestly: that answer moves next week’s volume.' },
    ],
  },
} as const;

export function SessionPlayer() {
  const s = useSave();
  const sess = s.session;
  const [stage, setStage] = useState<'play' | 'rate' | 'report'>('play');
  const [report, setReport] = useState<sessions.SessionReport | null>(null);
  const [now, setNow] = useState(Date.now());

  const close = () => player.set(false);
  const mutate = (fn: (x: NonNullable<typeof sess>) => void) => store.update((x) => { if (x.session) fn(x.session); });

  async function teach(key: keyof typeof TEACH) {
    const cur = store.get().session;
    if (!cur || cur.kind !== 'basic' || cur.taught.includes(key) || tourOpen()) return false;
    mutate((x) => x.taught.push(key));
    await new Promise((r) => setTimeout(r, 420));
    await tour({ who: 'coach', ...TEACH[key] } as never);
    return true;
  }

  useEffect(() => {
    music.duck(true);
    const t = setInterval(() => setNow(Date.now()), 500);
    const save = setInterval(() => store.update((x) => x.session && sessions.tick(x.session)), 10000);
    const off = pushBack(() => { if (!store.get().session) close(); });
    if (sess?.kind === 'basic') teach('open');
    return () => { clearInterval(t); clearInterval(save); off(); music.duck(false); };
  }, []);

  if (stage === 'report' && report) return <Report r={report} />;
  if (!sess) return null;
  if (stage === 'rate') return <Rate onRate={(rt) => finish(rt)} onBack={() => setStage('play')} />;

  const it = sess.items[sess.at];
  const ex = exById(it.exId);
  const elapsed = sess.activeMs + Math.min(now - sess.lastTick, 30000);
  const owed = sess.items.filter((x) => !sessions.itemDone(x)).length;
  const last = sess.at === sess.items.length - 1;
  const strict = sess.kind === 'basic';
  const lb = s.settings.units === 'lb';
  const restLeft = sess.restEndsAt ? Math.max(0, Math.ceil((sess.restEndsAt - now) / 1000)) : 0;

  const tick = async (j: number) => {
    const row = it.log[j];
    const nowOn = !row.ok;
    mutate((x) => sessions.toggleSet(x, x.at, j));
    if (!nowOn) return sfx.tap();
    sfx.success();
    buzz(20);
    const cur = store.get().session!;
    const ticked = sessions.setsTicked(cur);
    const doneHere = sessions.itemDone(cur.items[cur.at]);
    let taught = false;
    if (doneHere) taught = await teach('queue');
    else if (ticked === 1) taught = await teach('logged');
    if (!taught && !doneHere && s.settings.autoRest && it.rest > 0) mutate((x) => sessions.startRest(x, it.rest));
  };

  const abort = async () => {
    if (await confirm('Abort Session', 'Nothing from this session is kept: no experience, no Boon sets, no records. The Daily Quest is unaffected.', 'Abort', true)) {
      store.update((x) => { x.session = null; });
      close();
    }
  };

  const tryFinish = async () => {
    const ticked = sessions.setsTicked(sess);
    if (!ticked) {
      if (await confirm('Nothing Logged', 'No sets were completed. Discard this session?', 'Discard', true)) { store.update((x) => { x.session = null; }); close(); }
      return;
    }
    if (strict && owed) {
      sfx.alarm();
      await sys({ title: 'Not Yet', kind: 'coach', typed: false, lines: [`${owed} exercise${owed === 1 ? '' : 's'} still owed. Basic Training does not let you skip one — the whole session is the lesson.`], actions: [{ label: 'Back To It', value: true, primary: true }] });
      return;
    }
    if (sess.kind === 'program') setStage('rate');
    else finish(null);
  };

  function finish(rating: Rating | null) {
    const rep = store.update((x) => sessions.finish(x, x.session!, rating));
    sfx.levelUp();
    flash('gold');
    buzz([25, 40, 25, 40, 90]);
    setReport(rep);
    setStage('report');
  }

  return (
    <div class="player" role="dialog" aria-label={`${sess.title} in progress`}>
      <header class="player__top">
        <Btn kind="ghost" size="sm" onClick={abort}>Abort</Btn>
        <div class="player__title">
          <small class="label num">{sess.subtitle} · {mmss(elapsed / 1000)}</small>
          <b>{sess.title}</b>
        </div>
        <IconBtn icon="help" label="How this works" onClick={() => void tour({ who: 'coach', ...TEACH.open } as never)} />
      </header>

      <div class="player__body">
        <section class="excard" data-tour="target">
          <div class="row between">
            <button type="button" class="linkish excard__name" onClick={() => openLift(it.exId)}>{ex?.name} <Glyph name="info" /></button>
            <Btn kind="ghost" size="sm" onClick={() => swap()}><Glyph name="swap" /> Swap</Btn>
          </div>
          <p class="muted">{ex?.cue}</p>
          <div class="excard__target">
            <span class="label">Target per set</span>
            <b class="num">{fmtAmount(ex, it.target)}</b>
            {it.note && <small class="chip">{it.note}</small>}
          </div>
        </section>

        <ol class="sets" data-tour="sets">
          {it.log.map((row, j) => {
            const current = !row.ok && it.log.findIndex((x) => !x.ok) === j;
            return (
              <li key={j} class={`setrow ${row.ok ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
                <span class="setrow__n num">{j + 1}</span>
                <Stepper value={row.done} step={stepOf(ex)} min={0} label={`Set ${j + 1} ${unitShort(ex).toLowerCase()}`} unit={unitShort(ex)}
                  onCommit={(v) => mutate((x) => { x.items[x.at].log[j].done = v; })} />
                {it.load && (
                  <Stepper value={row.weight ? Math.round((lb ? row.weight / KG_PER_LB : row.weight) * 10) / 10 : 0} step={lb ? 5 : 2.5} min={0} label={`Set ${j + 1} weight`} unit={lb ? 'LB' : 'KG'}
                    onCommit={(v) => mutate((x) => { x.items[x.at].log[j].weight = v > 0 ? (lb ? v * KG_PER_LB : v) : null; })} />
                )}
                <button type="button" class={`setrow__tick ${row.ok ? 'is-on' : ''}`} aria-pressed={row.ok} aria-label={`${row.ok ? 'Untick' : 'Tick'} set ${j + 1}`} onClick={() => tick(j)}>
                  <Glyph name="check" />
                </button>
                {it.log.length > 1 && !row.ok && <IconBtn icon="trash" label={`Remove set ${j + 1}`} onClick={() => mutate((x) => sessions.removeSet(x, x.at, j))} />}
              </li>
            );
          })}
        </ol>

        <div class="row">
          <Btn kind="ghost" class="grow" tour="add" onClick={() => mutate((x) => sessions.addSet(x, x.at))}><Glyph name="plus" /> Add Set</Btn>
          <Btn kind="ghost" class="grow" tour="rest" onClick={() => mutate((x) => sessions.startRest(x, it.rest || 60))}><Glyph name="timer" /> Rest {it.rest ? `${it.rest}s` : ''}</Btn>
        </div>

        {sess.items.length > 1 && (
          <section class="queue" data-tour="next">
            <span class="label">The session · {sess.items.length - owed} of {sess.items.length} done</span>
            <ul>
              {sess.items.map((x, i) => (
                <li key={i}>
                  <button type="button" class={`queue__row ${i === sess.at ? 'is-on' : ''} ${sessions.itemDone(x) ? 'is-done' : ''}`} onClick={() => { sfx.blip(); mutate((y) => { y.at = i; }); }}>
                    <span class="num">{sessions.itemDone(x) ? '✓' : i + 1}</span>
                    <span class="grow">{exById(x.exId)?.name}</span>
                    <small class="num muted">{x.log.filter((r) => r.ok).length}/{x.log.length} × {fmtAmount(exById(x.exId), x.target)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer class="player__foot" data-tour="foot">
        {sess.at > 0 && <Btn kind="ghost" onClick={() => mutate((x) => { x.at -= 1; })}>Prev</Btn>}
        {last
          ? <Btn kind="primary" size="lg" class={`grow ${owed ? '' : 'is-ready'}`} sound="none" onClick={tryFinish}>Finish Session</Btn>
          : <Btn kind="primary" size="lg" class={`grow ${sessions.itemDone(it) ? 'is-ready' : ''}`} sound="blip" onClick={() => mutate((x) => { x.at += 1; })}>Next Exercise</Btn>}
      </footer>

      {sess.restEndsAt && <Rest left={restLeft} span={sess.restSpan} onAdjust={(d) => mutate((x) => { x.restEndsAt = Math.max(Date.now() + 5000, (x.restEndsAt ?? Date.now()) + d * 1000); x.restSpan = Math.max(x.restSpan, Math.ceil(((x.restEndsAt ?? 0) - Date.now()) / 1000)); })}
        onEnd={() => mutate((x) => { x.restEndsAt = null; })} />}
    </div>
  );

  function swap() {
    pickExercise('Swap Exercise', async (picked) => {
      const cur = store.get().session!;
      const logged = cur.items[cur.at].log.filter((x) => x.ok).length;
      if (logged && !(await confirm('Swap Exercise', `${logged} set${logged === 1 ? '' : 's'} already logged against ${ex?.name} will be discarded — they were reps of that movement, not this one.`, 'Swap', true))) return;
      store.update((x) => x.session && sessions.swap(x, x.session, x.session.at, picked.id));
    }, { current: it.exId, pattern: ex?.pattern });
  }
}

function Rest({ left, span, onAdjust, onEnd }: { left: number; span: number; onAdjust: (d: number) => void; onEnd: () => void }) {
  const beeped = useRef(-1);
  useEffect(() => {
    if (left === beeped.current) return;
    beeped.current = left;
    if (left > 0 && left <= 3) sfx.beep(false);
    if (left === 0) { sfx.beep(true); buzz([60, 40, 60]); onEnd(); }
  }, [left]);
  useEffect(() => pushBack(() => true), []);
  const skip = async () => {
    if (left > 60 && !windowOpen()) {
      const v = await sys({ title: 'Instructor Note', kind: 'coach', typed: false, lines: ['I said I would ask. Rest is not the gap between the training; on anything heavy it is part of it, and cutting it short turns strength work into conditioning.'], actions: [{ label: 'Skip Anyway', value: true }, { label: 'Keep Resting', value: false, primary: true }] });
      if (!v) return;
    }
    sfx.tap();
    onEnd();
  };
  return (
    <div class="rest" role="timer" aria-live="off">
      <span class="label">Recovery</span>
      <b class="rest__clock num">{mmss(left)}</b>
      <Bar pct={(left / Math.max(1, span)) * 100} />
      <div class="row">
        <Btn kind="ghost" onClick={() => onAdjust(-30)}>−30s</Btn>
        <Btn kind="ghost" onClick={() => onAdjust(30)}>+30s</Btn>
        <Btn kind="primary" onClick={skip} sound="none">Skip</Btn>
      </div>
    </div>
  );
}

function Rate({ onRate, onBack }: { onRate: (r: Rating) => void; onBack: () => void }) {
  const opts: { r: Rating; label: string; desc: string }[] = [
    { r: 'easy', label: 'Easy', desc: 'I had plenty left.' },
    { r: 'right', label: 'Right', desc: 'Hard, but I finished it well.' },
    { r: 'hard', label: 'Hard', desc: 'Close to my limit.' },
    { r: 'brutal', label: 'Brutal', desc: 'Too much. Something gave.' },
  ];
  return (
    <div class="player player--rate" role="dialog" aria-label="Session debrief">
      <div class="player__body stack">
        <div class="voice voice--coach"><div class="voice__body"><b class="voice__name">Ryn Valcorde</b><p class="voice__line">How did that actually feel? Answer honestly — I tune the next session off this.</p></div></div>
        {opts.map((o) => (
          <button type="button" key={o.r} class={`choice ${o.r === 'brutal' ? 'choice--danger' : ''}`} onClick={() => { sfx.tap(); onRate(o.r); }}>
            <span class="choice__mark" /><span class="choice__text"><b>{o.label}</b><small>{o.desc}</small></span>
          </button>
        ))}
        <Btn kind="ghost" onClick={onBack}>Back to the session</Btn>
      </div>
    </div>
  );
}

function Report({ r }: { r: sessions.SessionReport }) {
  const s = useSave();
  const [busy, setBusy] = useState(false);
  const done = async () => {
    if (busy) return;
    setBusy(true);
    player.set(false);
    await rewardChain(r.xp, (r.kind === 'basic' ? 'training' : undefined) as Route | undefined);
  };
  return (
    <div class="player player--report" role="dialog" aria-label="Session report">
      <div class="player__body stack">
        <header class="report__head">
          <span class="label">{r.certified ? 'Basic Hunter Training — Certified' : 'Session Logged'}</span>
          <h2>{r.title}</h2>
          <p class="muted">{r.setsDone} sets across {r.exercises} exercise{r.exercises === 1 ? '' : 's'} in {r.minutes} minute{r.minutes === 1 ? '' : 's'}.</p>
        </header>
        <div class="tiles">
          <Tile label="Experience" value={`+${r.xp.gained}`} sub={r.repeat < 1 ? `repeat session · ${Math.round(r.repeat * 100)}%` : r.xp.mult > 1 ? `×${r.xp.mult.toFixed(2)} Resonance` : r.xp.mult < 1 ? 'Hollow: halved' : 'XP'} tone="mana" />
          <Tile label="Completion" value={`${Math.round(r.ratio * 100)}%`} sub="of the prescription" />
          <Tile label="Boon sets" value={`+${r.boonSets}`} sub="banked to the ledger" tone="gold" />
          {r.xp.levels > 0 ? <Tile label="Level" value={`${r.xp.from} → ${r.xp.to}`} sub={`+${r.xp.points} points`} tone="gold" /> : <Tile label="Level" value={s.hunter.level} />}
        </div>
        {r.adapt && (
          <div class="voice voice--coach">
            <div class="voice__body">
              <b class="voice__name">Ryn Valcorde</b>
              <p class="voice__line">{r.adapt.line}</p>
              <small class="muted">Volume moved from {Math.round(r.adapt.from * 100)}% to <b>{Math.round(r.adapt.to * 100)}%</b> of baseline.</small>
            </div>
          </div>
        )}
        {r.certified && (
          <div class="voice voice--coach">
            <div class="voice__body">
              <b class="voice__name">Ryn Valcorde</b>
              <p class="voice__line">That is Basic Hunter Training. You are on file as trained, your week is open, and you walk out a Level {s.hunter.level} hunter. Your kit, on the way out — I have put it on you.</p>
            </div>
          </div>
        )}
        {r.kit.length > 0 && (
          <div class="haul">
            {r.kit.map((id) => {
              const it = s.items.find((x) => x.defId === id);
              return <div key={id} class="haul__item">{it && <GearArt item={it} size={48} equipped />}<small>{gearDef(id)?.name}</small></div>;
            })}
          </div>
        )}
        {r.prs.length > 0 && (
          <section class="card">
            <span class="label">New records</span>
            <ul class="slotlist">{r.prs.map((p, i) => <li key={i}><span>{exById(p.exId)?.name}</span><span class="num">{p.kind === 'heaviest' ? `${p.value} kg heaviest` : p.kind === 'oneRm' ? `${p.value} kg est. 1RM` : `${fmtAmount(exById(p.exId), p.value)} best set`}</span></li>)}</ul>
          </section>
        )}
        <Btn kind="primary" size="lg" block onClick={done} sound="success">Done</Btn>
      </div>
    </div>
  );
}
