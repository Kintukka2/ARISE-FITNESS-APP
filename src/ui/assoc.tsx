/**
 * Ryn Valcorde's Association Quests on screen: his card at the top of the Quests screen, with the job
 * in hand, how far it has come, what it pays and, once it is done, the report; his windows when he pays
 * for one and hands over the next; and the strip on a run's results that says how far the run moved it.
 * All of it is his channel (docs/VOICE.md, "Valcorde's channel"): the System has no part in it.
 */
import { rewardChain } from '@/app/flow';
import * as association from '@/core/association';
import type { AssocQuest, AssocReward } from '@/core/association';
import { dungeonById, enemyById } from '@/core/gates';
import { POTIONS } from '@/core/shop';
import { gearDef } from '@/core/gear';
import { bundleText } from './forge';
import { SURVEY } from '@/data/association';
import { ASSOC_BRIEF, ASSOC_FIRST, ASSOC_PAID } from '@/data/narrative';
import * as store from '@/store';
import { useSave } from '@/store';
import { useState } from 'preact/hooks';
import { Bar } from './components';
import { sfx } from '@/audio/audio';
import { CoachPortrait, Glyph } from './icons';
import { sys } from './overlays';

/** A creature's name for more than one: "Dire Wolves", "Rootlings". */
export function plural(name: string): string {
  if (/(s|x|ch|sh)$/i.test(name)) return `${name}es`;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(wolf|elf|half)$/i.test(name)) return `${name.slice(0, -1)}ves`;
  return `${name}s`;
}

const gateName = (q: AssocQuest) => dungeonById(q.gate)?.name ?? 'the Gate';
const targetName = (q: AssocQuest) => (q.target ? enemyById(q.target)?.name : undefined) ?? 'creature';

/** What he says when he hands a job over. */
export function briefOf(q: AssocQuest): string {
  const lines = ASSOC_BRIEF[q.kind];
  return lines[q.n % lines.length]
    .replace(/\{Gate\}/g, gateName(q))
    .replace(/\{creature\}/g, plural(targetName(q)))
    .replace(/\{boss\}/g, targetName(q))
    .replace(/\{need\}/g, String(q.need));
}

/** The job, as a goal: what to do and where. */
export function goalOf(q: AssocQuest): string {
  if (q.kind === 'clear') return `Clear ${gateName(q)}.`;
  if (q.kind === 'boss') return `Fell ${targetName(q)}, in ${gateName(q)}.`;
  return `Fell ${q.need} ${plural(targetName(q))}, in any Gate.`;
}

/** What a job pays besides its experience, in words. */
export function rewardText(w: AssocReward | null): string | null {
  if (!w) return null;
  const times = w.n > 1 ? ` ×${w.n}` : '';
  if (w.kind === 'potion') return `${POTIONS.find((p) => p.id === w.id)?.name ?? 'Potion'}${times}`;
  if (w.kind === 'field') return `Field Potion${times}`;
  if (w.kind === 'survey') return `${SURVEY.name}${times}`;
  if (w.kind === 'satchel') return 'Satchel: room for one more Field Potion';
  if (w.kind === 'blueprint') return 'Blueprint';
  if (w.kind === 'alloy') return `Alloy${times}`;
  return `Mana Shards: ${w.n === 1 ? 'a clear’s worth' : `${w.n} clears’ worth`}`;
}

/**
 * His card on the Quests screen: the first section of the log, shaped as its rows are (his face where a
 * row's picture stands, the job and its count, his line, a bar and the pay as chips) but on his channel,
 * in his blue and his corner brackets. A job done waits on the hunter: the row itself is the report,
 * gold, its pay carried on the strip along its foot. Null until the line opens.
 */
export function AssocCard() {
  const s = useSave();
  const [full, setFull] = useState(false);
  const q = association.current(s);
  if (!q) return null;
  const done = association.done(q);
  const pay = rewardText(q.reward);
  const head = (
    <header class="assoccard__head">
      <span class="assoccard__label">Association Quest · No. {q.n + 1}</span>
      <span class="assoccard__who">Ryn Valcorde</span>
    </header>
  );
  if (done) {
    return (
      <section id="quest-assoc" class="assoccard coachframe is-done" aria-label="Association Quest">
        {head}
        <button type="button" class="assoccard__row is-report" onClick={() => { sfx.tap(); void reportAssoc(); }}>
          <span class="assoccard__face coachface"><CoachPortrait size={36} /></span>
          <span class="assoccard__body">
            <span class="assoccard__goal">
              <b>{goalOf(q)}</b>
              <span class="assoccard__count num"><Glyph name="check" />{q.got}/{q.need}</span>
            </span>
            <span class="assoccard__line is-one">“{briefOf(q)}”</span>
          </span>
          <span class="assoccard__report">
            <i class="assoccard__sweep" aria-hidden="true" />
            <b>Report To Ryn</b>
            <span class="assoccard__reportpay">XP <span class="num">+{q.xp}</span>{pay ? <> · {pay}</> : null}</span>
            <Glyph name="chevron" />
          </span>
        </button>
      </section>
    );
  }
  return (
    <section id="quest-assoc" class="assoccard coachframe" aria-label="Association Quest">
      {head}
      <div class="assoccard__row">
        <span class="assoccard__face coachface"><CoachPortrait size={36} /></span>
        <div class="assoccard__body">
          <div class="assoccard__goal">
            <b>{goalOf(q)}</b>
            <span class="assoccard__count num">{q.got}/{q.need}</span>
          </div>
          {/* His line, held to two; a tap gives the whole of it. */}
          <p class={`assoccard__line ${full ? 'is-full' : ''}`} onClick={() => setFull(!full)}>“{briefOf(q)}”</p>
          <Bar pct={(q.got / Math.max(1, q.need)) * 100} tone="mana" thin />
          <span class="assoccard__pay">
            <span class="assocpay">XP <b class="num">+{q.xp}</b></span>
            {pay && <span class="assocpay">{pay}</span>}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * On a run's results: how far the run moved the job, as an alert on his channel, shaped as the
 * System's are (an icon box, a small header, one line, the count at the right) but in his blue, his
 * corner brackets and his face, never the System's frame.
 */
export function AssocStrip({ q, move }: { q: AssocQuest; move: association.AssocMove }) {
  const done = move.to >= move.need;
  return (
    <aside class={`assocalert coachframe ${done ? 'is-done' : ''}`} role="status" aria-label={`Association Quest: ${move.to} of ${move.need}`}>
      <span class="assocalert__icon"><CoachPortrait size={34} /></span>
      <div class="assocalert__body">
        <span class="assocalert__head">Association Quest</span>
        <p>{goalOf(q)}</p>
        <Bar pct={(move.to / Math.max(1, move.need)) * 100} tone={done ? 'verdant' : 'mana'} thin />
        {done && <small class="assocalert__done">Done. Report to Ryn on the Quests screen.</small>}
      </div>
      <b class="assocalert__count num">{move.to}/{move.need}</b>
      <i class="assocalert__scan" aria-hidden="true" />
    </aside>
  );
}

/** The first time the line opens: he says what it is, and hands over the first job. */
export async function firstJob() {
  const q = association.current(store.get());
  // Only before the first job is reported: a hunter already working for him needs no introduction.
  if (!q || store.get().seen.includes('assoc-told') || store.get().assoc.reported > 0) return;
  store.update((x) => { if (!x.seen.includes('assoc-told')) x.seen.push('assoc-told'); });
  await sys({ title: 'Valcorde', kind: 'coach', lines: [ASSOC_FIRST, briefOf(q)], actions: [{ label: 'On It', value: null, primary: true }] });
}

/**
 * Report the job in hand: he pays for it, and hands over the next. What it paid is settled in
 * `association.report` before he says a word, and the experience is celebrated after.
 */
export async function reportAssoc() {
  const paid = store.update((x) => association.report(x));
  if (!paid) return;
  const w = paid.quest.reward;
  const line = w?.kind === 'satchel' ? ASSOC_PAID.satchel : w?.kind === 'survey' ? ASSOC_PAID.survey
    : w ? ASSOC_PAID.paid[paid.quest.n % ASSOC_PAID.paid.length] : ASSOC_PAID.bare[paid.quest.n % ASSOC_PAID.bare.length];
  const got = [
    `XP +${paid.quest.xp}`,
    ...(w?.kind === 'field' ? [paid.field ? `Field Potion ×${paid.field}` : null, paid.shards ? `Mana Shards +${paid.shards} (the satchel was full)` : null]
      : w?.kind === 'shards' ? [`Mana Shards +${paid.shards}`]
      : w?.kind === 'blueprint' || w?.kind === 'alloy' ? [paid.blueprint ? `Blueprint: ${gearDef(paid.blueprint)?.name}` : null, Object.keys(paid.mats).length ? bundleText(paid.mats) : null]
      : [rewardText(w)]),
  ].filter((x): x is string => !!x);
  await sys({ title: 'Valcorde', kind: 'coach', lines: [line, `<em>Received:</em> ${got.join(' · ')}`], actions: [{ label: 'Next Job', value: null, primary: true }] });
  await rewardChain(paid.xp);
  if (paid.next) await sys({ title: 'Valcorde', kind: 'coach', lines: [briefOf(paid.next)], actions: [{ label: 'On It', value: null, primary: true }] });
}
