/**
 * Quests: everything the System has set the hunter, on one page. Each quest is a tile in its
 * subject's frame, with a picture of where it stands; tapping one opens its QUEST INFO window in a
 * sheet. Nothing here pays: each quest is settled where it always was (Daily Quests in `raid.finish`,
 * a rank in `grantXP`, the Spire's week in `spire.settle`, a Trial and the Chosen in `raid.finish`).
 * This screen only says where each one stands.
 */
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as ascension from '@/core/ascension';
import * as contracts from '@/core/contracts';
import { board, dungeonById, entryBlock } from '@/core/gates';
import { overCap, RARITY } from '@/core/gear';
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
import { ASCENSION_FROM, OVERCHARGE, PROOF, WALKERS } from '@/data/ascension';
import { SPIRE_NAME } from '@/data/spire';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, useNow } from '@/ui/components';
import { ContractsWindow, QuestGoal, QuestWindow } from '@/ui/contracts';
import { Field, SysFrame, type FrameKind } from '@/ui/frame';
import { Glyph, Sigil } from '@/ui/icons';
import { openSheet, toast } from '@/ui/overlays';
import { openBrief } from './Gates';

/** A quest as the grid shows it: its tile, and the window its sheet opens. */
interface Tile {
  key: 'daily' | 'rank' | 'spire' | 'trial' | 'chosen' | 'secret';
  kind: FrameKind;
  /** The quest's name with its type, bracketed on the tile and in its window. */
  name: string;
  icon: ComponentChildren;
  /** One line under the name. */
  status: ComponentChildren;
  count: ComponentChildren;
  /** The picture of where it stands. */
  art: ComponentChildren;
  wide: boolean;
  /** Something can be done about it now. */
  hot?: boolean;
  done?: boolean;
  Body: FunctionComponent<{ close: () => void }>;
}

export function Quests() {
  const s = useSave();
  useNow();
  const day = dayKey();
  // Showing today's Daily Quests issues them, if nothing has yet, and clears the badge on the tab.
  useEffect(() => {
    const now = store.get();
    if (contracts.contractsOpen(now) && !(now.contracts.day === day && now.contracts.seen)) store.update((x) => contracts.show(x, day));
  }, [day]);
  return <div class="questgrid">{tiles(s, day).map((t) => <QuestTile key={t.key} t={t} />)}</div>;
}

/**
 * Every quest that stands, in the grid's order: the day's first, then the climbs, then the record.
 * A tile on its own in a row would leave a hole beside it, so the last of an odd number spans both.
 */
function tiles(s: Save, day: string): Tile[] {
  const singles = [rankTile(s), spireTile(s, day), trialTile(s, day), chosenTile(s, day)].filter((t): t is Tile => !!t);
  if (singles.length % 2) singles[singles.length - 1].wide = true;
  return [dailyTile(s, day), ...singles, secretTile(s)].filter((t): t is Tile => !!t);
}

/** A name with its hyphenated words kept whole, so a narrow tile wraps `B-Rank` onto one line, never across it. */
const whole = (name: string) => name.split(' ').flatMap((w, i) => [i ? ' ' : '', w.includes('-') ? <span class="nowrap">{w}</span> : w]);

function QuestTile({ t }: { t: Tile }) {
  const open = () => {
    sfx.tap();
    openSheet({ title: 'Quest Info', system: { kind: t.kind }, render: (close) => <t.Body close={close} /> });
  };
  return (
    <SysFrame kind={t.kind} label={t.name}
      class={`questtile questtile--${t.key} ${t.wide ? 'is-wide' : ''} ${t.hot ? 'is-hot' : ''} ${t.done ? 'is-done' : ''}`}>
      <button type="button" class="questtile__hit" onClick={open}>
        <span class="questtile__art" aria-hidden="true">{t.art}</span>
        <span class="questtile__foot">
          <span class="sysbox questtile__icon" aria-hidden="true">{t.icon}</span>
          <span class="questtile__text"><strong>[{whole(t.name)}]</strong><small>{t.status}</small></span>
          <span class="sysbox questtile__count num">{t.count}</span>
          <Glyph name="chevron" class="questtile__go" />
        </span>
      </button>
    </SysFrame>
  );
}

// ------------------------------------------------------------------ the Daily Quests

function dailyTile(s: Save, day: string): Tile | null {
  if (!contracts.contractsOpen(s)) return null;
  const c = contracts.today(s, day);
  const done = c.list.filter((k) => k.done).length;
  return {
    key: 'daily', kind: 'system', name: 'Daily Quests', icon: <Glyph name="quest" />, wide: true,
    count: `${done}/${c.list.length}`, done: done === c.list.length,
    status: <>New Daily Quests in: <b class="num">{hhmmss(msUntilMidnight())}</b></>,
    art: (
      <span class="qa-list">
        {c.list.map((k, i) => (
          <span key={k.kind} class={`sysbox qa-row ${k.done ? 'is-done' : ''}`} style={{ animationDelay: `${120 + i * 160}ms` }}>
            <span class="qa-row__mark">{k.done && <Glyph name="check" />}</span>
            <span class="qa-row__text">{contracts.contractText(k, c.grade)}</span>
            <span class="num">{Math.min(k.got, k.need)}/{k.need}</span>
          </span>
        ))}
      </span>
    ),
    Body: DailyBody,
  };
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

/** The next rank: a choice of rank is advancement, so the frame is gold. */
function rankTile(s: Save): Tile | null {
  const q = reclassification(s);
  if (!q) return null;
  return {
    key: 'rank', kind: 'gold', name: `Reclassification: ${q.to.name}`, icon: <Glyph name="up" />, wide: false,
    count: `${s.hunter.level}/${q.to.min}`,
    status: <>Experience needed: <b class="num">{group(q.left)}</b></>,
    art: (
      <span class="qa-rank">
        <Sigil rank={q.from.key} size={34} />
        <span class="qa-rank__path" style={`--p: ${q.share}`}><i /></span>
        <span class="qa-rank__next"><Sigil rank={q.to.key} size={34} /></span>
      </span>
    ),
    Body: RankBody,
  };
}

function RankBody() {
  const s = useSave();
  const q = reclassification(s);
  if (!q) return null;
  const to = q.to.key === 'N' ? q.to.name : q.to.key;
  const kind = q.pick?.kind === 'skill' ? 'Skill' : 'Passive';
  const rewards: ComponentChildren[] = [
    <>Rank: {q.from.key} → {to}</>,
    <>Ability Points <b class="num grant">+{q.points}</b></>,
  ];
  if (q.cls && !q.cls.was) rewards.push(<span class="grant">ACCESS GRANTED: CLASS</span>);
  if (q.cls?.was) rewards.push(<>Class: {q.cls.was} → <strong>[Class: {q.cls.is}]</strong> · {q.cls.lead} <b class="num grant">+{q.cls.bonus}</b></>);
  if (q.cls?.was && q.pick) rewards.push(<>{kind} available: <strong>[{kind}: {q.pick.names[0]}]</strong> or <strong>[{kind}: {q.pick.names[1]}]</strong></>);
  if (q.slots) rewards.push(<>Shadow slots: {q.slots[0]} → {q.slots[1]}</>);
  if (q.throne) rewards.push(<span class="grant">ACCESS GRANTED: THE HOLLOW THRONE</span>);
  return (
    <QuestWindow bare name={`Reclassification: ${q.to.name}`} class="quest-rank"
      goals={<QuestGoal id="rank" text={`Reach Level ${q.to.min}.`} hint={`Experience needed: ${group(q.left)}`}
        got={s.hunter.level} need={q.to.min} done={false} pct={q.share} />}
      rewards={rewards} />
  );
}

// ------------------------------------------------------------------ the Pale Spire's week

/** The tower's storeys on the tile: lit up to the week's best, the next one waiting. */
const STOREYS = 7;

/** The Spire's week: Gates are orange. */
function spireTile(s: Save, day: string): Tile | null {
  if (!spire.spireOpen(s)) return null;
  const best = spire.weekBest(s, day);
  const goal = spire.tierGoal(s, day);
  const b = spire.blockOf(spire.nextSpire(s, day).floor ?? 1);
  const lit = Math.min(STOREYS - 1, Math.floor((STOREYS * best) / goal));
  return {
    key: 'spire', kind: 'gates', name: `Weekly Quest: ${SPIRE_NAME}`, icon: <Glyph name="spire" />, wide: false,
    count: `${best}/${goal}`,
    status: `Floors ${spire.firstFloor(b)} to ${spire.lastFloor(b)} next.`,
    art: (
      <span class="qa-tower">
        {Array.from({ length: STOREYS }, (_, i) => <i key={i} class={i < lit ? 'is-lit' : i === lit ? 'is-next' : ''} style={{ width: `${72 - i * 7}px` }} />)}
      </span>
    ),
    Body: SpireBody,
  };
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
      goals={<QuestGoal id="spire" text={`Clear Floor ${goal}.`} hint={`Floors ${from} to ${to} next.`} got={best} need={goal} done={false} />}
      rewards={[
        <>Reward tier: {pay.tier}</>,
        <>Mana Shards <b class="num grant">+{group(pay.shards)}</b></>,
        <>{RARITY[pay.rank].name} gear <b class="num grant">+1</b></>,
      ]}>
      {now && <p class="questinfo__note">This week: Floor {best} · Reward tier: {now.tier}</p>}
      <small class="questinfo__when">New week in: <b class="num countdown">{days ? `${days}d ` : ''}{hhmmss(left % 864e5)}</b></small>
      <Btn kind="primary" block onClick={() => {
        if (locked) return toast(`Floors ${from} to ${to} are ${d.rank}-Rank. Your licence does not cover ${d.rank}-Rank yet.`, 'warn');
        close();
        openBrief(d);
      }}>Brief: Floors {from} to {to}</Btn>
    </QuestWindow>
  );
}

// ------------------------------------------------------------------ the Trial

/** Proving the next Ascension level: the Gates, then the Trial. Advancement, so gold. */
function trialTile(s: Save, day: string): Tile | null {
  if (!ascension.ascensionOpen(s)) return null;
  const a = s.ascension;
  const need = ascension.proofNeeds(s);
  const got = Math.min(need, a.proof.gates.length);
  const proved = ascension.trialProved(s);
  const ready = ascension.trialReady(s, day);
  const rounds = trialRounds(a.unlocked);
  return {
    key: 'trial', kind: 'gold', name: `Trial: Ascension ${a.unlocked + 1}`, icon: <Glyph name="cert" />, wide: false,
    count: `${got}/${need}`, hot: ready,
    status: ready ? 'The Trial is open.' : proved ? 'Faced today.' : `Then ${rounds} of the Chosen.`,
    art: (
      <span class="qa-trial">
        <span class="qa-trial__row">{Array.from({ length: need }, (_, i) => <i key={i} class={`qa-pip ${i < got ? 'is-on' : ''}`} />)}</span>
        <span class="qa-trial__row qa-trial__row--chosen">
          {Array.from({ length: rounds }, (_, i) => <i key={i} class="qa-pip qa-pip--chosen" style={{ animationDelay: `${i * 140}ms` }} />)}
        </span>
      </span>
    ),
    Body: TrialBody,
  };
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
          hint={!ascension.proving(s) ? `Clears count from ${ASCENSION_FROM}-Rank.` : a.unlocked ? `Only runs entered at Ascension ${a.unlocked} count.` : undefined}
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

/** One of the Chosen, holding a Gate today. Its masterwork is advancement, so gold. */
function chosenTile(s: Save, day: string): Tile | null {
  const w = walkers.walking(s, day);
  const gate = w ? dungeonById(w.gateId) : undefined;
  if (!w || !gate) return null;
  const open = board(s, day).some((x) => x.id === gate.id);
  return {
    key: 'chosen', kind: 'gold', name: `Chosen: ${w.name}`, icon: <Glyph name="crown" />, wide: false,
    count: open ? '0/1' : 'Closed',
    status: open ? gate.name : `${gate.name} is closed until tomorrow.`,
    art: (
      <span class="qa-chosen">
        <i class="qa-chosen__halo" /><i class="qa-chosen__halo" />
        <Glyph name="crown" />
      </span>
    ),
    Body: ChosenBody,
  };
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

/** How many sealed cards drift past among the done ones: enough to say there are more, never what they are. */
const SEALED_SHOWN = 4;

/** Every Secret Quest done, drifting past, and the sealed ones as `?`. The System's own record, so cyan. */
function secretTile(s: Save): Tile {
  const held = heldOf(s);
  const sealed = MISSIONS.length - held.length;
  const cards = [
    ...held.map((m) => ({ key: m.id, tier: TIER_NAMES[m.tier], name: m.name, grant: grantText(m) })),
    ...Array.from({ length: Math.min(SEALED_SHOWN, sealed) }, (_, i) => ({ key: `sealed-${i}`, tier: '?', name: '?', grant: '' })),
  ];
  return {
    key: 'secret', kind: 'system', name: 'Secret Quests', icon: <Glyph name="eye" />, wide: true,
    count: `${held.length}/${MISSIONS.length}`,
    status: `Sealed: ${sealed}`,
    art: (
      <span class="qa-marquee">
        <span class="qa-marquee__track" style={`--dur: ${Math.max(24, cards.length * 5)}s`}>
          {[...cards, ...cards].map((c, i) => (
            <span key={`${c.key}-${i}`} class={`sysbox qa-card ${c.name === '?' ? 'is-sealed' : ''}`}>
              <small>{c.tier}</small><b>{c.name}</b>{c.grant && <span class="grant">{c.grant}</span>}
            </span>
          ))}
        </span>
      </span>
    ),
    Body: SecretBody,
  };
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
