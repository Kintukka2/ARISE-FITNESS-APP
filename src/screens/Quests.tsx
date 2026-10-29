/** The Quests screen: what you owe the System today. */
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as boon from '@/core/boon';
import { exById, stepOf, unitShort } from '@/core/exercises';
import { previewXP, resonance } from '@/core/progression';
import * as quests from '@/core/quests';
import * as story from '@/core/story';
import type { Quest, Save } from '@/core/types';
import { addDays, dayKey, daysBetween, hhmmss, msUntilMidnight, pick, rng } from '@/core/util';
import { rewardChain } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, Card, IconBtn, Panel, Section, Shards, Stepper, Tile, useNow, Voice } from '@/ui/components';
import { buzz, flash } from '@/ui/feedback';
import { Flame, Glyph } from '@/ui/icons';
import { openSheet, sys, tour } from '@/ui/overlays';
import { PRAISE } from '@/data/narrative';

const SYSTEM_LINES = {
  hollow: ['A debt is outstanding. Experience gain is halved until the Penalty Quest is cleared.', 'Hollow is active. Pay the penalty before anything else.'],
  fresh: ['A new record begins today. Clear the quest and Resonance kindles.', 'Day one. The System is watching to see if there is a day two.'],
  building: ['Resonance is holding. The quest grows by one of each every day you keep it.', 'The record continues. So does the quest.', 'The streak is the multiplier. Do not break it for a bad mood.'],
  high: ['Thirty days and counting. The System has adjusted its expectations of you upward.', 'A long run. Every day added is worth more than the last.'],
  max: ['Perfect Resonance. There is nothing higher. There is only keeping it.'],
};

function systemLine(s: Save) {
  const r = rng(dayKey() + '|sys|' + s.hunter.name);
  if (s.flags.hollow) return pick(SYSTEM_LINES.hollow, r);
  const d = s.streak.current;
  return pick(d >= 100 ? SYSTEM_LINES.max : d >= 30 ? SYSTEM_LINES.high : d > 0 ? SYSTEM_LINES.building : SYSTEM_LINES.fresh, r);
}

export function Quests() {
  const s = useSave();
  useNow();
  useEffect(() => {
    if (!story.seen(s, 'questWalk')) {
      store.update((x) => story.markOnce(x, 'questWalk'));
      setTimeout(() => void walk(), 600);
    }
  }, []);
  const res = resonance(s);
  return (
    <div class="stack">
      <Voice who="system">{systemLine(s)}</Voice>
      <Panel title="Quests" tools={<IconBtn icon="chart" label="Daily Quest stats" onClick={openStats} />}>
        {s.flags.hollow && s.daily.penalty && <QuestCard which="penalty" q={s.daily.penalty} />}
        {s.daily.quest && !s.daily.cleared && <QuestCard which="daily" q={s.daily.quest} />}
        {s.daily.cleared && (
          <Card hot class="cleared">
            <Glyph name="check" />
            <div class="grow"><b>Daily Quest cleared</b><small class="muted">Next quest issues at midnight.</small></div>
            <span class="num countdown">{hhmmss(msUntilMidnight())}</span>
          </Card>
        )}
        <Section title="Resonance" />
        <div class={`resonance ${res.atMax ? 'is-max' : ''}`} data-tour="streak">
          <div class="resonance__left">
            <Flame tier={res.tier.key} />
            <div><span class="label">Consecutive days</span><b class="num big">{res.days}</b></div>
          </div>
          <div class="resonance__right"><span class="label">All experience</span><b class="num big">×{res.mult.toFixed(2)}</b><small class="muted">{res.tier.name}</small></div>
          <Bar pct={res.pct} tone={res.atMax ? 'gold' : 'mana'} label="Resonance" />
        </div>
      </Panel>
      <BoonCard />
    </div>
  );
}

function QuestCard({ which, q }: { which: 'daily' | 'penalty'; q: Quest }) {
  const s = useSave();
  const [open, setOpen] = useState<number | null>(null);
  const pct = Math.round(quests.progress(q) * 100);
  const complete = quests.isComplete(q);
  const penalty = which === 'penalty';
  const setDone = (i: number, value: number) => {
    const just = store.update((x) => {
      const live = penalty ? x.daily.penalty! : x.daily.quest!;
      return quests.logItem(x, live, i, value - live.items[i].done);
    });
    sfx.success();
    buzz(14);
    if (just) { setOpen(null); praise(); }
  };
  const claim = async () => {
    if (penalty) {
      store.update((x) => quests.clearPenalty(x));
      flash();
      await sys({
        title: 'Debt Settled', kind: 'system',
        lines: ['The Penalty Quest has been cleared.', 'The <em>Hollow</em> debuff has been removed. Experience gain returns to normal.', 'The record shows the miss permanently. That is the point of a record.'],
      });
      return rewardChain(null);
    }
    const r = store.update((x) => quests.clearDaily(x));
    if (!r) return;
    flash();
    buzz([25, 40, 25, 40, 90]);
    await sys({
      title: 'Daily Quest Cleared', kind: 'system', center: true,
      lines: [
        `Daily Quest complete: <strong>+${r.xp.gained} XP</strong> rewarded.`,
        `<strong>+${r.shards}</strong> Mana Shards.`,
        `Resonance: <strong>${r.streak}</strong> ${r.streak === 1 ? 'day' : 'days'} · ×${resonance(store.get()).mult.toFixed(2)} on all experience.`,
        'Missing a day will reset your Resonance to zero.',
      ],
    });
    await rewardChain(r.xp);
  };
  return (
    <article class={`quest ${penalty ? 'quest--penalty' : ''} ${complete ? 'is-complete' : ''}`} data-tour={penalty ? undefined : 'quest'}>
      <header class="quest__head">
        <div>
          <span class="label">{penalty ? 'Penalty Quest' : 'Daily Quest'}</span>
          <h2 class="quest__name">{penalty ? 'Debt Collection' : 'Preparation To Become Powerful'}</h2>
        </div>
        <b class="quest__pct num">{pct}%</b>
      </header>
      <Bar pct={pct} tone={penalty ? 'blood' : 'mana'} label="Quest progress" />
      <div class="quest__meta">
        {penalty ? <span class="label">No experience awarded</span> : <><span class="label">Resets in</span><span class={`num countdown ${msUntilMidnight() < 2 * 36e5 ? 'is-critical' : ''}`}>{hhmmss(msUntilMidnight())}</span></>}
      </div>
      <ul class="quest__items">
        {q.items.map((it, i) => {
          const ex = exById(it.exId);
          const done = it.done >= it.target;
          return (
            <li key={it.exId} class={`qitem ${done ? 'is-done' : ''} ${open === i ? 'is-open' : ''}`}>
              <button type="button" class="qitem__row" aria-expanded={open === i} onClick={() => { sfx.tap(); setOpen(open === i ? null : i); }}>
                <span class="tick" aria-hidden="true">{done && <Glyph name="check" />}</span>
                <span class="qitem__text"><b>{ex?.name}</b><small>{unitShort(ex)} · {ex?.cue}</small></span>
                <span class="qitem__count num">{it.done} / {it.target}</span>
              </button>
              {open === i && (
                <div class="qitem__log">
                  <Stepper value={it.done} step={stepOf(ex) === 50 ? 50 : stepOf(ex)} min={0} max={it.target} label={`${ex?.name} logged`} onCommit={(v) => setDone(i, v)} />
                  <Btn kind={penalty ? 'danger' : 'primary'} disabled={done} onClick={() => setDone(i, it.target)} sound="none">Complete</Btn>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <footer class="quest__foot">
        {complete
          ? <Btn kind={penalty ? 'danger' : 'primary'} size="lg" block onClick={claim} sound="gate">{penalty ? 'Pay The Penalty' : 'Claim Daily Quest'}</Btn>
          : <><small class="muted">Tap to log · hold − or + to run</small><span class="chip num">{penalty ? '0 XP' : `+${previewXP(s, q.xp)} XP`}</span></>}
      </footer>
    </article>
  );
}

let lastPraise = '';
function praise() {
  let line = pick(PRAISE);
  if (line === lastPraise) line = pick(PRAISE);
  lastPraise = line;
  const el = document.createElement('div');
  el.className = 'praise';
  el.textContent = line;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function BoonCard() {
  const s = useSave();
  const pr = boon.progress(s);
  return (
    <Card class="booncard" tour="boon" onClick={openBoon}>
      <div><span class="label">Boon bestowed in</span><b class="num big">{boon.countdown(s)}</b></div>
      <div class="booncard__right"><span class="label">System satisfaction</span><b class={pr.tier.grant ? '' : 'muted'}>{pr.tier.name}</b></div>
    </Card>
  );
}

function openBoon() {
  openSheet({
    title: 'The Boon', tone: 'gold', render: () => {
      const s = store.get();
      const pr = boon.progress(s);
      const res = boon.assess(s);
      const max = Math.max(1, ...Object.values(s.boon.points));
      return (
        <div class="stack">
          <p class="muted">Every set you complete banks a point into the attributes it trains. Every {boon.PERIOD_DAYS} days the System reads the ledger and writes attributes straight into you — not experience. One enormous day cannot buy the top: it counts days as well as sets.</p>
          <div class="tiles">
            <Tile label="Bestowed in" value={boon.countdown(s)} />
            <Tile label="Assessment" value={pr.tier.name} sub={res.total ? `+${res.total} attribute${res.total === 1 ? '' : 's'}` : 'nothing, as it stands'} />
            <Tile label="Sets banked" value={pr.sets} />
            <Tile label="Days trained" value={`${pr.days} of ${boon.PERIOD_DAYS}`} />
          </div>
          {pr.next ? <p class="hint">{pr.next.name} needs {Math.max(0, pr.next.min - pr.sets)} more set{pr.next.min - pr.sets === 1 ? '' : 's'}{pr.next.days > pr.days ? ` and ${pr.next.days - pr.days} more day${pr.next.days - pr.days === 1 ? '' : 's'} trained` : ''}.</p>
            : <p class="hint">{res.free ? 'The top of the ladder, and the free point is earned.' : `The top of the ladder. The free point needs ${boon.FREE.sets} sets across all ${boon.FREE.days} days.`}</p>}
          <Section title="Ledger" right={`${s.boon.sets} sets`}>
            <div class="ledger">
              {(['STR', 'AGI', 'PER', 'VIT', 'INT'] as const).map((k) => (
                <div key={k} class={`ledger__row ${res.grant[k] ? 'is-paid' : ''}`}>
                  <span class="label">{k}</span><Bar pct={(s.boon.points[k] / max) * 100} tone={res.grant[k] ? 'gold' : 'mana'} thin /><span class="num">{s.boon.points[k]}</span>
                </div>
              ))}
            </div>
          </Section>
          <div class="tiles">
            <Tile label="Boons paid" value={s.stats.boons} sub={`${s.stats.boonPoints} attributes granted`} />
            <Tile label="Withheld" value={s.stats.boonsMissed} sub={s.stats.boonsMissed ? 'periods declined' : 'never yet'} />
          </div>
        </div>
      );
    },
  });
}

function openStats() {
  openSheet({ title: 'Daily Quest Record', render: () => <QuestStats s={store.get()} /> });
}

function QuestStats({ s }: { s: Save }) {
  const today = dayKey();
  const since = s.createdAt ? dayKey(new Date(s.createdAt)) : today;
  const window = 28;
  const days = Array.from({ length: 35 }, (_, i) => addDays(today, i - 34));
  const known = days.filter((d) => d >= since && d < today);
  const cleared = new Set(s.questDays);
  const inWindow = known.slice(-window);
  const c = inWindow.filter((d) => cleared.has(d)).length;
  const pct = inWindow.length ? Math.round((c / inWindow.length) * 100) : 0;
  const res = resonance(s);
  const verdict = !inWindow.length ? 'Nothing on record yet. Clear today and this fills in.'
    : inWindow.length < 7 ? `${c} of ${inWindow.length} days cleared. Too early to call it anything.`
      : pct === 100 ? 'Every day in the window. There is nothing to fix here.'
        : pct >= 85 ? `${inWindow.length - c} missed in ${inWindow.length} days. That is a record, not a habit problem.`
          : pct >= 50 ? `${c} of ${inWindow.length}. The quest is not the hard part — turning up on the bad days is.`
            : res.days > 0 ? `Cleared ${pct}% of the window, but the current run is alive. Start from here.` : `Cleared ${pct}% of the window. Resonance is at zero. One day fixes that.`;
  return (
    <div class="stack">
      <div class={`verdict verdict--${pct >= 85 ? 'ready' : pct >= 50 ? 'even' : 'over'}`}>{verdict}</div>
      <div class="tiles">
        <Tile label="Cleared" value={s.stats.questsCleared} sub="since you awakened" />
        <Tile label="Clear rate" value={`${pct}%`} sub={`last ${inWindow.length} days`} />
        <Tile label="Longest run" value={s.streak.best} sub={s.streak.current >= s.streak.best && s.streak.best ? 'and it is this one' : 'days'} />
        <Tile label="Failed" value={s.stats.questsFailed} sub={s.stats.penaltiesCleared ? `${s.stats.penaltiesCleared} penalties paid` : 'not one'} />
      </div>
      <Section title="Last five weeks">
        <div class="cal" role="grid" aria-label="Daily Quest calendar">
          {days.map((d) => {
            const state = d > today ? 'future' : d === today ? (cleared.has(d) ? 'cleared' : 'today') : d < since ? 'unknown' : cleared.has(d) ? 'cleared' : 'missed';
            return <span key={d} class={`cal__day is-${state}`} title={`${d}: ${state}`} />;
          })}
        </div>
        <div class="cal__key"><span class="is-cleared" />Cleared<span class="is-missed" />Missed<span class="is-unknown" />No record</div>
      </Section>
      <div class="tiles">
        <Tile label="Resonance" value={`×${res.mult.toFixed(2)}`} sub={res.tier.name} />
        <Tile label="To the ceiling" value={res.atMax ? '—' : res.daysToMax} sub={res.atMax ? '×2.00 reached' : 'more days to ×2.00'} />
      </div>
      {daysBetween(since, today) > 0 && <p class="muted">Days at Perfect Resonance: {s.stats.perfectDays}. Reps logged, all sources: {s.stats.totalReps.toLocaleString()}.</p>}
      <Shards n={s.wallet.earned} />
    </div>
  );
}

async function walk() {
  await tour({
    who: 'system', title: 'The Daily Quest', steps: [
      { at: 'quest', say: 'Your Daily Quest. Three movements, issued at midnight, the same three for every Awakened in the world. Ten of each to begin with.' },
      { at: 'quest', say: 'Tap a row to log what you did — minus, the number, plus. Hold either end to run it up. Nothing is checked. That is deliberate: a record you can falsify is a record only you can ruin.' },
      { at: 'quest', say: 'Clear all three and the day counts. Miss one and HOLLOW is applied — all experience halved until a Penalty Quest is cleared. The quest grows by one of each every day you hold it, and stops at a hundred.' },
      { at: 'streak', say: 'Resonance. Every consecutive day you clear adds one hundredth to a multiplier on everything you earn. Two days is ×1.02. One hundred days is ×2.00, and that is the ceiling.' },
      { at: 'streak', say: 'A missed day returns it to ×1.00. Nothing absorbs one for you — there is no way to buy a day you did not train.' },
      { at: 'boon', say: 'And the Boon. Train, and every few days the System writes attributes straight into you. It does not always approve. Tap it to see the ledger.' },
    ],
  });
}
