/**
 * Quests: everything the System has set the hunter, as a log on one page. Ryn's job first; then a rail
 * of rings, one to each quest, that jumps to it; then the quests in their frames: the day's, the
 * climbs, the week's and the record, a row to each with its bar and what it pays. A row opens its
 * QUEST INFO window in a sheet. Nothing here pays: each quest is settled where it always was (Daily Quests in `raid.finish`,
 * a rank in `grantXP`, the Spire's week in `spire.settle`, a Trial and the Chosen in `raid.finish`).
 * This screen only says where each one stands.
 */
import { claimRank, playBeats } from '@/app/flow';
import * as association from '@/core/association';
import { AssocCard, firstJob } from '@/ui/assoc';
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as ascension from '@/core/ascension';
import * as contracts from '@/core/contracts';
import { board, dungeonById, entryBlock } from '@/core/gates';
import { RARITY } from '@/core/gear';
import { overCap } from '@/core/ascension';
import { licensedRank } from '@/core/licence';
import { MARKS_MOST } from '@/core/marks';
import { earned, grantText, MISSIONS, TIER_NAMES, type Mission, type MissionTier } from '@/core/missions';
import { reclassification } from '@/core/quests';
import * as shop from '@/core/shop';
import * as spire from '@/core/spire';
import { trialRounds } from '@/core/trial';
import type { Rank, Save } from '@/core/types';
import { STATS } from '@/core/types';
import { dayKey, group, hhmmss, msUntilMidnight, msUntilWeek } from '@/core/util';
import * as walkers from '@/core/walkers';
import { OVERCHARGE, PROOF, WALKERS } from '@/data/ascension';
import { SPIRE_NAME } from '@/data/spire';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, useNow } from '@/ui/components';
import { ContractsWindow, Pay, QuestGoal, QuestWindow, Ring } from '@/ui/contracts';
import { Field, SysFrame, type FrameKind } from '@/ui/frame';
import { CoachPortrait, Glyph, Sigil } from '@/ui/icons';
import { HoldButton, openSheet, toast } from '@/ui/overlays';
import { openBrief } from './Gates';

/** Open a quest's QUEST INFO window, in the System's frame, or gold for advancement. */
const openQuest = (Body: FunctionComponent<{ close: () => void }>, kind: FrameKind = 'system') =>
  openSheet({ title: 'Quest Info', system: { kind }, render: (close) => <Body close={close} /> });

/** One quest on the log, as the rail rings it: how far it stands, and whether it waits on the hunter. */
interface Entry {
  key: 'assoc' | 'daily' | 'rank' | 'spire' | 'trial' | 'chosen' | 'secret';
  label: string;
  icon: string;
  kind: FrameKind;
  p: number;
  count: string;
  call?: boolean;
  done?: boolean;
  /** Ryn's job: his face in the ring and his blue, for his channel's. */
  coach?: boolean;
}

export function Quests() {
  const s = useSave();
  useNow();
  const day = dayKey();
  // Showing today's Daily Quests issues them, if nothing has yet, and clears the badge on the tab. The first
  // visit is also when the System announces them (the `contracts_issued` beat).
  useEffect(() => {
    const now = store.get();
    if (contracts.contractsOpen(now) && !(now.contracts.day === day && now.contracts.seen)) store.update((x) => contracts.show(x, day));
    // Ryn's Association work is handed over the first time the screen shows it, and kept from then.
    if (association.open(now) && !association.current(now)) store.update((x) => association.issue(x));
    void playBeats().then(firstJob);
  }, [day]);
  const job = assocEntry(s);
  const daily = dailyEntry(s, day), rank = rankEntry(s), spireE = spireEntry(s, day), trial = trialEntry(s, day), chosen = chosenEntry(s, day), secret = secretEntry(s);
  // A rank waiting to be claimed leads the climbs.
  const entries = [job, daily, rank, trial, chosen, spireE, secret].filter((e): e is Entry => !!e);
  return (
    <div class="stack qlog">
      <AssocCard />
      <QuestRail entries={entries} />
      {daily && <DailySection s={s} day={day} />}
      {(rank || trial || chosen) && (
        <SysFrame class="qsec" label="Advancement">
          <span class="label qsec__label">Advancement</span>
          {rank && <RankRow s={s} />}
          {trial && <TrialRow s={s} day={day} />}
          {chosen && <ChosenRow s={s} day={day} />}
        </SysFrame>
      )}
      {spireE && (
        <SysFrame class="qsec" kind="gates" label="Weekly Quest">
          <span class="label qsec__label">Weekly</span>
          <SpireRow s={s} day={day} />
        </SysFrame>
      )}
      <SysFrame class="qsec" label="Secret Quests">
        <span class="label qsec__label">Record</span>
        <SecretRow s={s} />
      </SysFrame>
    </div>
  );
}

// ------------------------------------------------------------------ the rail

/**
 * The rail: a ring to every quest that stands, filled as far as it stands, gold while it waits on the
 * hunter and green once done. A ring jumps to its quest, and lights it.
 */
function QuestRail({ entries }: { entries: Entry[] }) {
  const jump = (key: string) => {
    sfx.tap();
    const el = document.getElementById(`quest-${key}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('is-pinged');
    void el.offsetWidth;
    el.classList.add('is-pinged');
  };
  const C = 2 * Math.PI * 21;
  return (
    <SysFrame class="qrail" label="Quest log">
      <div class="qrail__rings" style={`--n: ${entries.length}`}>
        {entries.map((e, i) => (
          <button key={e.key} type="button" class={`qrail__one is-${e.kind} ${e.coach ? 'is-coach' : ''} ${e.call ? 'is-call' : ''} ${e.done ? 'is-done' : ''}`} style={`--i: ${i}`}
            aria-label={`${e.label}: ${e.count}`} onClick={() => jump(e.key)}>
            <span class="qrail__ring">
              <svg class="qrail__svg" viewBox="0 0 50 50" aria-hidden="true">
                <circle class="qrail__track" cx="25" cy="25" r="21" />
                <circle class="qrail__arc" cx="25" cy="25" r="21" style={`stroke-dasharray: ${C * Math.max(0, Math.min(1, e.p))} ${C}`} />
              </svg>
              {e.coach ? <CoachPortrait size={26} /> : <Glyph name={e.done ? 'check' : e.icon} />}
            </span>
            <b class="num">{e.count}</b>
            <small>{e.label}</small>
          </button>
        ))}
      </div>
    </SysFrame>
  );
}

/** A quest's row: its picture, its bracketed name and count, where it stands, a bar, and what it pays. It opens its window. */
function QuestRow({ id, art, name, sub, p, count, call, done, pay, onOpen }: {
  id: Entry['key']; art: ComponentChildren; name: string; sub: ComponentChildren; p: number | null; count: ComponentChildren;
  call?: boolean; done?: boolean; pay: ComponentChildren[]; onOpen: () => void;
}) {
  return (
    <button type="button" id={`quest-${id}`} class={`sysbox qrow qrow--${id} ${call ? 'is-call' : ''} ${done ? 'is-done' : ''}`} onClick={() => { sfx.tap(); onOpen(); }}>
      <span class="qrow__art" aria-hidden="true">{art}</span>
      <span class="qrow__body">
        <span class="qrow__top"><b>[{name}]</b><span class="qrow__count num">{count}</span></span>
        <small class="qrow__sub">{sub}</small>
        {p !== null && <i class="qbar" aria-hidden="true"><i style={`width: ${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`} /></i>}
        {pay.length > 0 && <span class="qrow__pay">{pay.map((x, i) => <span key={i} class="qpay">{x}</span>)}</span>}
      </span>
      <Glyph name="chevron" class="qrow__go" />
    </button>
  );
}

// ------------------------------------------------------------------ Ryn's job

/** Ryn's Association Quest on the rail, in his blue: gold once it is done and waits to be reported. */
function assocEntry(s: Save): Entry | null {
  const q = association.current(s);
  if (!q) return null;
  const done = association.done(q);
  return { key: 'assoc', label: 'Ryn', icon: 'profile', kind: 'system', coach: true, p: q.got / Math.max(1, q.need), count: done ? 'Report' : `${q.got}/${q.need}`, call: done };
}

// ------------------------------------------------------------------ the Daily Quests

function dailyEntry(s: Save, day: string): Entry | null {
  if (!contracts.contractsOpen(s)) return null;
  const c = contracts.today(s, day);
  const done = c.list.filter((k) => k.done).length;
  const p = c.list.reduce((n, k) => n + Math.min(1, k.got / Math.max(1, k.need)), 0) / Math.max(1, c.list.length);
  return { key: 'daily', label: 'Daily', icon: 'quest', kind: 'system', p, count: `${done}/${c.list.length}`, done: done === c.list.length };
}

/**
 * The day's Daily Quests: their head, the time left, and a line to each, with its bar, its count and
 * what it pays; then the completion bonus. Once all are done the block folds to its head, `Complete`
 * where the count stood. The whole block opens their window.
 */
function DailySection({ s, day }: { s: Save; day: string }) {
  const c = contracts.today(s, day);
  const pay = contracts.payOf(c.grade);
  const bonus = contracts.bonusOf(c.grade);
  const done = c.list.filter((k) => k.done).length;
  const all = done === c.list.length;
  return (
    <SysFrame class="qsec qsec--daily" label="Daily Quests">
      <button type="button" id="quest-daily" class={`qdaily ${all ? 'is-done' : ''}`} onClick={() => { sfx.tap(); openQuest(DailyBody); }}>
        <span class="qdaily__head">
          <span class="qrow__art"><Glyph name={all ? 'check' : 'quest'} /></span>
          <span class="qdaily__name"><b>[Daily Quests]</b><small>New Daily Quests in: <b class="num">{hhmmss(msUntilMidnight())}</b></small></span>
          {all
            ? <span class="qrow__count qdaily__complete" aria-label={`Complete: ${done} of ${c.list.length}`}>Complete</span>
            : <span class="qrow__count num">{done}/{c.list.length}</span>}
          <Glyph name="chevron" class="qrow__go" />
        </span>
        {!all && c.list.map((k, i) => (
          <span key={k.kind} class={`sysbox qdaily__one ${k.done ? 'is-done' : ''}`} style={`--i: ${i}`}>
            <span class="qdaily__mark">{k.done && <Glyph name="check" />}</span>
            <span class="qdaily__body">
              <b>{contracts.contractText(k, c.grade)}</b>
              <i class="qbar" aria-hidden="true"><i style={`width: ${Math.round(Math.min(1, k.got / Math.max(1, k.need)) * 100)}%`} /></i>
            </span>
            <span class="qdaily__side"><span class="num">{Math.min(k.got, k.need)}/{k.need}</span><Pay {...pay} /></span>
          </span>
        ))}
        {!all && (
          <span class="qdaily__bonus">
            <Ring p={done / Math.max(1, c.list.length)} mark="star" />
            <span>Completion bonus</span>
            <Pay {...bonus} />
          </span>
        )}
      </button>
    </SysFrame>
  );
}

function DailyBody() {
  const s = useSave();
  useNow();
  if (!contracts.contractsOpen(s)) return null;
  return (
    <ContractsWindow c={contracts.today(s)} bare>
      <small class="questinfo__when">New Daily Quests in: <b class="num countdown">{hhmmss(msUntilMidnight())}</b></small>
      <p class="questinfo__note">Daily Quests completed: {s.stats.contracts} · Full days: {s.stats.contractDays}</p>
    </ContractsWindow>
  );
}

// ------------------------------------------------------------------ the next rank

function rankEntry(s: Save): Entry | null {
  const q = reclassification(s);
  if (!q) return null;
  return { key: 'rank', label: 'Rank', icon: 'up', kind: 'system', p: q.share, count: q.ready ? 'Ready' : `${s.hunter.level}/${q.to.min}`, call: q.ready };
}

/** The next rank: the rank held and the one above it, the level it asks, and what claiming it brings. A choice of rank is advancement, so its window is gold. */
function RankRow({ s }: { s: Save }) {
  const q = reclassification(s)!;
  const pay: ComponentChildren[] = [<>Ability Points <b class="grant num">+{q.points}</b></>, <>Skill Points <b class="grant num">+{q.skills.points}</b></>];
  if (q.cls && !q.cls.was) pay.push(<span class="grant">Class</span>);
  if (q.slots) pay.push(<>Shadow slots <b class="grant num">+{q.slots[1] - q.slots[0]}</b></>);
  pay.push(<>{RARITY[q.blueprints.rank].name} blueprints <b class="grant num">+{q.blueprints.n}</b></>);
  if (q.ascension) pay.push(<span class="grant">Ascension</span>);
  return (
    <QuestRow id="rank" name={`Reclassification: ${q.to.name}`} call={q.ready} count={q.ready ? 'Ready' : `${s.hunter.level}/${q.to.min}`}
      art={<span class="qrow__ranks"><Sigil rank={q.from.key} size={22} /><Sigil rank={q.to.key} size={22} /></span>}
      sub={q.ready ? 'Requirements met.' : <>Reach Level {q.to.min} · XP needed: <b class="num">{group(q.left)}</b></>}
      p={q.share} pay={pay} onOpen={() => openQuest(RankBody, 'gold')} />
  );
}

/**
 * The Reclassification window: the rank held and the one above it, as plates; the level it asks; what
 * claiming it brings. Once the level is reached, a hold claims it, and the rank-up lifts the plate
 * off this window (`claimRank`).
 */
function RankBody() {
  const s = useSave();
  const plate = useRef<HTMLSpanElement>(null);
  const q = reclassification(s);
  if (!q) return null;
  const to = q.to.key === 'N' ? q.to.name : q.to.key;
  const rewards: ComponentChildren[] = [
    <>Rank: {q.from.key} → {to}</>,
    <>Ability Points <b class="num grant">+{q.points}</b></>,
    <>Skill Points <b class="num grant">+{q.skills.points}</b></>,
  ];
  if (q.cls && !q.cls.was) rewards.push(<span class="grant">ACCESS GRANTED: CLASS</span>);
  if (q.cls?.was) rewards.push(<>Class: {q.cls.was} → <strong>[Class: {q.cls.is}]</strong> · {q.cls.lead} <b class="num grant">+{q.cls.bonus}</b></>);
  if (q.skills.tier) rewards.push(<span class="grant">ACCESS GRANTED: {q.skills.tier}-RANK SKILLS</span>);
  if (q.skills.slots) rewards.push(<>Skill slots: {q.skills.slots[0]} → {q.skills.slots[1]}</>);
  if (q.slots) rewards.push(<>Shadow slots: {q.slots[0]} → {q.slots[1]}</>);
  rewards.push(<>{RARITY[q.blueprints.rank].name} blueprints <b class="num grant">+{q.blueprints.n}</b></>);
  if (q.throne) rewards.push(<span class="grant">ACCESS GRANTED: THE HOLLOW THRONE</span>);
  if (q.ascension) rewards.push(<span class="grant">ACCESS GRANTED: ASCENSION</span>);
  return (
    <QuestWindow bare name={`Reclassification: ${q.to.name}`} class={`quest-rank ${q.ready ? 'is-ready' : ''}`}
      lead={(
        <div class="rankplates" aria-label={`${q.from.name} to ${q.to.name}`}>
          <span class="rankplates__from" ref={plate}><Sigil rank={q.from.key} size={58} /></span>
          <span class="rankplates__path" style={`--p: ${q.share}`} aria-hidden="true"><i /></span>
          <span class="rankplates__to"><Sigil rank={q.to.key} size={58} /></span>
        </div>
      )}
      goals={<QuestGoal id="rank" text={`Reach Level ${q.to.min}.`} hint={`XP needed: ${group(q.left)}`}
        got={Math.min(s.hunter.level, q.to.min)} need={q.to.min} done={q.ready} pct={q.share} />}
      rewards={rewards}>
      {q.ready && (
        <div class="rankclaim" key={q.to.key}>
          <HoldButton hold={{ label: 'Hold To Reclassify', ms: 2400, ticks: 6, holding: 'Reclassifying…', done: 'Reclassified', after: 260 }}
            onFire={() => void claimRank(plate.current?.querySelector('svg') ?? plate.current)} />
        </div>
      )}
    </QuestWindow>
  );
}

// ------------------------------------------------------------------ the Pale Spire's week

function spireEntry(s: Save, day: string): Entry | null {
  if (!spire.spireOpen(s)) return null;
  const best = spire.weekBest(s, day);
  const goal = spire.tierGoal(s, day);
  return { key: 'spire', label: 'Weekly', icon: 'spire', kind: 'gates', p: best / Math.max(1, goal), count: `${best}/${goal}` };
}

/** The Pale Spire's week: the floor that raises what it pays, the next floors, and that pay. Gates are orange. */
function SpireRow({ s, day }: { s: Save; day: string }) {
  const best = spire.weekBest(s, day);
  const goal = spire.tierGoal(s, day);
  const pay = spire.seasonTier(goal)!;
  const b = spire.blockOf(spire.nextSpire(s, day).floor ?? 1);
  const left = msUntilWeek();
  const days = Math.floor(left / 864e5);
  return (
    <QuestRow id="spire" name={`Weekly Quest: ${SPIRE_NAME}`} count={`${best}/${goal}`}
      art={<Glyph name="spire" />}
      sub={<>Clear Floor {goal} · Floors {spire.firstFloor(b)}-{spire.lastFloor(b)} next · New week in: <b class="num">{days ? `${days}d ` : ''}{hhmmss(left % 864e5)}</b></>}
      p={best / Math.max(1, goal)}
      pay={[<>Reward tier: {pay.tier}</>, <>Mana Shards <b class="grant num">+{group(pay.shards)}</b></>, <>{RARITY[pay.rank].name} gear <b class="grant num">+1</b></>]}
      onOpen={() => openQuest(SpireBody, 'gates')} />
  );
}

function SpireBody({ close }: { close: () => void }) {
  const s = useSave();
  useNow();
  if (!spire.spireOpen(s)) return null;
  const best = spire.weekBest(s);
  const goal = spire.tierGoal(s);
  const pay = spire.seasonTier(goal)!;
  const now = spire.seasonTier(best);
  const d = spire.nextSpire(s);
  const b = spire.blockOf(d.floor ?? 1);
  const from = spire.firstFloor(b), to = spire.lastFloor(b);
  const locked = entryBlock(s, d) === 'licence';
  const left = msUntilWeek();
  const days = Math.floor(left / 864e5);
  return (
    <QuestWindow bare name={`Weekly Quest: ${SPIRE_NAME}`} class="quest-spire"
      goals={<QuestGoal id="spire" text={`Clear Floor ${goal}.`} hint={`Floors ${from}-${to} next.`} got={best} need={goal} done={false} />}
      rewards={[
        <>Reward tier: {pay.tier}</>,
        <>Mana Shards <b class="num grant">+{group(pay.shards)}</b></>,
        <>{RARITY[pay.rank].name} gear <b class="num grant">+1</b></>,
      ]}>
      {now && <p class="questinfo__note">This week: Floor {best} · Reward tier: {now.tier}</p>}
      <small class="questinfo__when">New week in: <b class="num countdown">{days ? `${days}d ` : ''}{hhmmss(left % 864e5)}</b></small>
      <Btn kind="primary" block onClick={() => {
        if (locked) return toast(`Floors ${from}-${to} are ${d.rank}-Rank. Your licence does not cover ${d.rank}-Rank yet.`, 'warn');
        close();
        openBrief(d);
      }}>Brief: Floors {from}-{to}</Btn>
    </QuestWindow>
  );
}

// ------------------------------------------------------------------ the Trial

function trialEntry(s: Save, day: string): Entry | null {
  if (!ascension.ascensionOpen(s)) return null;
  const need = ascension.proofNeeds(s);
  const got = Math.min(need, s.ascension.proof.gates.length);
  const ready = ascension.trialReady(s, day);
  return { key: 'trial', label: 'Trial', icon: 'cert', kind: 'system', p: got / Math.max(1, need), count: ready ? 'Open' : `${got}/${need}`, call: ready };
}

/** Proving the next Ascension level: the Gates, then the Trial; and what it opens. Advancement, so its window is gold. */
function TrialRow({ s, day }: { s: Save; day: string }) {
  const a = s.ascension;
  const need = ascension.proofNeeds(s);
  const got = Math.min(need, a.proof.gates.length);
  const proved = ascension.trialProved(s);
  const ready = ascension.trialReady(s, day);
  const rounds = trialRounds(a.unlocked);
  const pay: ComponentChildren[] = [<span class="grant">Ascension {a.unlocked + 1}</span>];
  if (a.unlocked < MARKS_MOST) pay.push(<>Marks <b class="grant num">+1</b></>);
  pay.push(<>Upgrade limit <b class="grant num">+{OVERCHARGE.per}</b></>);
  return (
    <QuestRow id="trial" name={`Trial: Ascension ${a.unlocked + 1}`} call={ready} count={ready ? 'Open' : `${got}/${need}`}
      art={<Glyph name="cert" />}
      sub={ready ? 'The Trial is open.' : proved ? 'Faced today.' : <>Gates proved: {got}/{need} · Then {rounds} of the Chosen</>}
      p={got / Math.max(1, need)} pay={pay} onOpen={() => openQuest(TrialBody, 'gold')} />
  );
}

function TrialBody({ close }: { close: () => void }) {
  const s = useSave();
  if (!ascension.ascensionOpen(s)) return null;
  const a = s.ascension;
  const grade = licensedRank(s);
  const need = ascension.proofNeeds(s);
  const proved = ascension.trialProved(s);
  const ready = ascension.trialReady(s);
  const trial = ascension.nextTrial(s);
  const opens = a.unlocked + 1;
  const cap = overCap(s);
  const gates = `${need < PROOF.gates ? `all ${need}` : `${need} different`} ${grade}-Rank Gates`;
  const rewards: ComponentChildren[] = [<span class="grant">ACCESS GRANTED: ASCENSION {opens}</span>];
  if (a.unlocked < MARKS_MOST) rewards.push(<>Marks to set <b class="num grant">+1</b></>);
  rewards.push(<>Upgrade limit: {cap ? `Perfect +${cap}` : 'Perfect'} → Perfect +{cap + OVERCHARGE.per}</>);
  rewards.push(<><strong>[Chosen: {walkers.walkerOf(opens, grade).name}]</strong> enters the Gates</>);
  return (
    <QuestWindow bare name={`Trial: Ascension ${opens}`} class="quest-trial"
      goals={<>
        <QuestGoal id="proof" text={a.unlocked ? `Clear ${gates} at Ascension ${a.unlocked}.` : `Clear ${gates}.`}
          hint={a.unlocked ? `Only runs entered at Ascension ${a.unlocked} count.` : undefined}
          got={a.proof.gates.length} need={need} done={proved} />
        <QuestGoal id="trial" text={`Win ${trial.name}: ${trialRounds(a.unlocked)} of the Chosen in a row.`}
          hint={!proved ? 'Opens when the first goal is done.' : ready ? 'Once each day.' : 'Faced today. It opens again tomorrow.'}
          got={0} need={1} done={false} />
      </>}
      rewards={rewards}>
      {ready && <Btn kind="gold" block onClick={() => { close(); openBrief(trial); }}>Face {trial.name}</Btn>}
    </QuestWindow>
  );
}

// ------------------------------------------------------------------ the Chosen

function chosenEntry(s: Save, day: string): Entry | null {
  const w = walkers.walking(s, day);
  const gate = w ? dungeonById(w.gateId) : undefined;
  if (!w || !gate) return null;
  const open = board(s, day).some((x) => x.id === gate.id);
  return { key: 'chosen', label: 'Chosen', icon: 'crown', kind: 'system', p: 0, count: open ? '0/1' : 'Closed' };
}

/** One of the Chosen, holding a Gate today: where, and its masterwork. Advancement, so its window is gold. */
function ChosenRow({ s, day }: { s: Save; day: string }) {
  const w = walkers.walking(s, day)!;
  const gate = dungeonById(w.gateId)!;
  const open = board(s, day).some((x) => x.id === gate.id);
  const felled = s.ascension.felled.includes(w.level);
  const at = Math.max(s.ascension.level, w.level);
  return (
    <QuestRow id="chosen" name={`Chosen: ${w.name}`} count={open ? '0/1' : 'Closed'}
      art={<Glyph name="crown" />}
      sub={open ? <>{gate.name} · From Ascension {w.level}</> : `${gate.name} is closed until tomorrow.`}
      p={null}
      pay={[felled
        ? <>Mana Shards <b class="grant num">+{group(shop.gateShards(gate.rank, WALKERS.bounty * ascension.payShare(at)))}</b></>
        : <>Masterwork: {RARITY[gate.rank as Rank].name} {walkers.slotOf(w.level)}</>]}
      onOpen={() => openQuest(ChosenBody, 'gold')} />
  );
}

function ChosenBody({ close }: { close: () => void }) {
  const s = useSave();
  const day = dayKey();
  const w = walkers.walking(s, day);
  const gate = w ? dungeonById(w.gateId) : undefined;
  if (!w || !gate) return null;
  const open = board(s, day).some((x) => x.id === gate.id);
  const felled = s.ascension.felled.includes(w.level);
  // A bounty is paid at the level the run walks in at: the one chosen now, or the lowest the Chosen shows itself at.
  const at = Math.max(s.ascension.level, w.level);
  return (
    <QuestWindow bare name={`Chosen: ${w.name}`} class="quest-chosen"
      goals={<QuestGoal id="chosen" text={<>Fell <span class="warn">[{w.name}]</span> in {gate.name}.</>}
        hint={open ? `It appears at Ascension ${w.level} or higher.` : `${gate.name} is closed until tomorrow.`}
        got={0} need={1} done={false} count={open ? undefined : 'Closed'} />}
      rewards={[felled
        ? <>Mana Shards <b class="num grant">+{group(shop.gateShards(gate.rank, WALKERS.bounty * ascension.payShare(at)))}</b> at Ascension {at}</>
        : <>Masterwork: {RARITY[gate.rank as Rank].name} {walkers.slotOf(w.level)} · Perfect +{w.level}</>]}>
      <p class="questinfo__note">Chosen felled: {s.ascension.felled.length}/{s.ascension.sent.length}</p>
      {open && <Btn kind="primary" block onClick={() => { close(); openBrief(gate); }}>Brief: {gate.name}</Btn>}
    </QuestWindow>
  );
}

// ------------------------------------------------------------------ the Secret Quests

/** The Secret Quests held, the latest first. */
const heldOf = (s: Save) => s.hunter.missions.map((id) => MISSIONS.find((m) => m.id === id)).filter((m): m is Mission => !!m).reverse();

function secretEntry(s: Save): Entry {
  const held = heldOf(s).length;
  return { key: 'secret', label: 'Secret', icon: 'eye', kind: 'system', p: held / MISSIONS.length, count: `${held}/${MISSIONS.length}`, done: held === MISSIONS.length };
}

/** The Secret Quests: how many are done of how many, the sealed, the latest done, and each tier's count. */
function SecretRow({ s }: { s: Save }) {
  const held = heldOf(s);
  const sealed = MISSIONS.length - held.length;
  const tiers = Object.keys(TIER_NAMES) as MissionTier[];
  const last = held[0];
  return (
    <QuestRow id="secret" name="Secret Quests" count={`${held.length}/${MISSIONS.length}`} done={!sealed}
      art={<Glyph name="eye" />}
      sub={last ? <>Latest: {last.name} · Sealed: {sealed}</> : `Sealed: ${sealed}`}
      p={held.length / MISSIONS.length}
      pay={tiers.map((k) => <>{TIER_NAMES[k]} <b class="num">{held.filter((m) => m.tier === k).length}/{MISSIONS.filter((m) => m.tier === k).length}</b></>)}
      onOpen={() => openQuest(SecretBody)} />
  );
}

/**
 * The Secret Quests as one QUEST INFO window: each one done is a goal ticked, with what it asked and
 * what it paid; the rest are a single `?`. What they have paid together is the reward.
 */
function SecretBody() {
  const s = useSave();
  const held = heldOf(s);
  const sealed = MISSIONS.length - held.length;
  const got = earned(s);
  const stats = STATS.filter((k) => got.stats[k]).map((k) => `${k} +${got.stats[k]}`).join(' · ');
  const rewards: ComponentChildren[] = [];
  if (stats) rewards.push(<span class="grant">{stats}</span>);
  if (got.free) rewards.push(<>Ability Points <b class="num grant">+{got.free}</b></>);
  if (got.slot) rewards.push(<>Shadow slots <b class="num grant">+{got.slot}</b></>);
  if (!rewards.length) rewards.push('-- --');
  const tiers = Object.keys(TIER_NAMES) as MissionTier[];
  return (
    <QuestWindow bare name="Secret Quests" class="quest-secret" rewardsLead={held.length ? 'You got rewards.' : undefined}
      goals={<>
        {held.map((m) => (
          <QuestGoal key={m.id} id={m.id} got={1} need={1} done count={TIER_NAMES[m.tier]}
            text={<>{m.name}<small class="questinfo__did">Goal: {m.did}</small><small class="questinfo__did grant">{grantText(m)}</small></>} />
        ))}
        {sealed > 0 && <QuestGoal id="sealed" text="?" got={0} need={1} done={false} count={`Sealed: ${sealed}`} />}
      </>}
      rewards={rewards}>
      <div class="sysfields">
        {tiers.map((t) => <Field key={t} k={TIER_NAMES[t]} v={`${held.filter((m) => m.tier === t).length}/${MISSIONS.filter((m) => m.tier === t).length}`} />)}
      </div>
    </QuestWindow>
  );
}
