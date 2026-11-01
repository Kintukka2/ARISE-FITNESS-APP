/**
 * Quests: everything the System has set the hunter, one QUEST INFO window each, and every Secret
 * Quest they have completed. Nothing here pays: each quest is settled where it always was (Daily
 * Quests in `raid.finish`, a rank in `grantXP`, the Spire's week in `spire.settle`, a Trial and the
 * Chosen in `raid.finish`). This screen only says where each one stands.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import * as ascension from '@/core/ascension';
import * as contracts from '@/core/contracts';
import { board, dungeonById, entryBlock } from '@/core/gates';
import { overCap, RARITY } from '@/core/gear';
import { licensedRank } from '@/core/licence';
import { MARKS_MOST } from '@/core/marks';
import { grantText, MISSIONS, TIER_NAMES, type Mission, type MissionTier } from '@/core/missions';
import { reclassification } from '@/core/quests';
import * as shop from '@/core/shop';
import * as spire from '@/core/spire';
import { trialRounds } from '@/core/trial';
import type { Rank } from '@/core/types';
import { dayKey, group, hhmmss, msUntilMidnight, msUntilWeek } from '@/core/util';
import * as walkers from '@/core/walkers';
import { ASCENSION_FROM, OVERCHARGE, PROOF, WALKERS } from '@/data/ascension';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { SPIRE_NAME } from '@/data/spire';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, Panel, Tile, useNow } from '@/ui/components';
import { ContractsWindow, QuestGoal, QuestWindow } from '@/ui/contracts';
import { toast } from '@/ui/overlays';
import { openBrief } from './Gates';

export function Quests() {
  const s = useSave();
  useNow();
  const day = dayKey();
  // Showing today's Daily Quests issues them, if nothing has yet, and clears the badge on the tab.
  useEffect(() => {
    const now = store.get();
    if (contracts.contractsOpen(now) && !(now.contracts.day === day && now.contracts.seen)) store.update((x) => contracts.show(x, day));
  }, [day]);
  const held = s.hunter.missions.map((id) => MISSIONS.find((m) => m.id === id)).filter((m): m is Mission => !!m);
  return (
    <div class="stack">
      <Panel title="Quests">
        <div class="tiles tiles--3">
          <Tile label="Daily" value={s.stats.contracts} sub="completed" />
          <Tile label="Full days" value={s.stats.contractDays} sub={`all ${CONTRACTS_PER_DAY} done`} />
          <Tile label="Secret" value={held.length} sub="completed" />
        </div>
      </Panel>
      <Daily />
      <Reclassification />
      <SpireWeek />
      <TrialQuest />
      <ChosenQuest />
      <SecretQuests held={held} />
    </div>
  );
}

/** Today's Daily Quests. */
function Daily() {
  const s = useSave();
  if (!contracts.contractsOpen(s)) return null;
  return (
    <ContractsWindow c={contracts.today(s)}>
      <small class="questinfo__when">New Daily Quests in: <b class="num countdown">{hhmmss(msUntilMidnight())}</b></small>
    </ContractsWindow>
  );
}

/** The next rank: the level it needs, and what reaching it brings. A choice of rank is advancement, so the frame is gold. */
function Reclassification() {
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
    <QuestWindow name={`Reclassification: ${q.to.name}`} kind="gold" class="quest-rank"
      goals={<QuestGoal id="rank" text={`Reach Level ${q.to.min}.`} hint={`Experience needed: ${group(q.left)}`}
        got={s.hunter.level} need={q.to.min} done={false} pct={q.share} />}
      rewards={rewards} />
  );
}

/** The Pale Spire's week, as a quest: the next floor that raises what the week pays. Gates are orange. */
function SpireWeek() {
  const s = useSave();
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
    <QuestWindow name={`Weekly Quest: ${SPIRE_NAME}`} kind="gates" class="quest-spire"
      goals={<QuestGoal id="spire" text={`Clear Floor ${goal}.`} hint={`Floors ${from} to ${to} next.`} got={best} need={goal} done={false} />}
      rewards={[
        <>Reward tier: {pay.tier}</>,
        <>Mana Shards <b class="num grant">+{group(pay.shards)}</b></>,
        <>{RARITY[pay.rank].name} gear <b class="num grant">+1</b></>,
      ]}>
      {now && <p class="questinfo__note">This week: Floor {best} · Reward tier: {now.tier}</p>}
      <small class="questinfo__when">New week in: <b class="num countdown">{days ? `${days}d ` : ''}{hhmmss(left % 864e5)}</b></small>
      <Btn kind="primary" block onClick={() => {
        if (locked) toast(`Floors ${from} to ${to} are ${d.rank}-Rank. Your licence does not cover ${d.rank}-Rank yet.`, 'warn');
        else openBrief(d);
      }}>Brief: Floors {from} to {to}</Btn>
    </QuestWindow>
  );
}

/** Proving the next Ascension level: the Gates, then the Trial. Advancement, so gold. */
function TrialQuest() {
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
    <QuestWindow name={`Trial: Ascension ${opens}`} kind="gold" class="quest-trial"
      goals={<>
        <QuestGoal id="proof" text={a.unlocked ? `Clear ${gates} at Ascension ${a.unlocked}.` : `Clear ${gates}.`}
          hint={!ascension.proving(s) ? `Clears count from ${ASCENSION_FROM}-Rank.` : a.unlocked ? `Only runs entered at Ascension ${a.unlocked} count.` : undefined}
          got={a.proof.gates.length} need={need} done={proved} />
        <QuestGoal id="trial" text={`Win ${trial.name}: ${trialRounds(a.unlocked)} of the Chosen in a row.`}
          hint={!proved ? 'Opens when the first goal is done.' : ready ? 'Once each day.' : 'Faced today. It opens again tomorrow.'}
          got={0} need={1} done={false} />
      </>}
      rewards={rewards}>
      {ready && <Btn kind="gold" block onClick={() => openBrief(trial)}>Face {trial.name}</Btn>}
    </QuestWindow>
  );
}

/** One of the Chosen, holding a Gate today. Its masterwork is advancement, so gold. */
function ChosenQuest() {
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
    <QuestWindow name={`Chosen: ${w.name}`} kind="gold" class="quest-chosen"
      goals={<QuestGoal id="chosen" text={<>Fell <span class="warn">[{w.name}]</span> in {gate.name}.</>}
        hint={open ? `It appears at Ascension ${w.level} or higher.` : `${gate.name} is closed until tomorrow.`}
        got={0} need={1} done={false} count={open ? undefined : 'Closed'} />}
      rewards={[felled
        ? <>Mana Shards <b class="num grant">+{group(shop.gateShards(gate.rank, WALKERS.bounty * ascension.payShare(at)))}</b> at Ascension {at}</>
        : <>Masterwork: {RARITY[gate.rank as Rank].name} {walkers.slotOf(w.level)} · Perfect +{w.level}</>]}>
      {open && <Btn kind="primary" block onClick={() => openBrief(gate)}>Brief: {gate.name}</Btn>}
    </QuestWindow>
  );
}

const TIER_TONE: Record<MissionTier, string> = { minor: 'mana', major: 'verdant', legend: 'gold', myth: 'blood' };

/** Every Secret Quest completed, the latest first. The ones not done stay sealed: nothing names them. */
function SecretQuests({ held }: { held: Mission[] }) {
  const tiers = Object.keys(TIER_NAMES) as MissionTier[];
  return (
    <Panel title="Secret Quests" class="secretquests">
      <div class="chips">
        {tiers.map((t) => <Chip key={t} tone={TIER_TONE[t]}>{TIER_NAMES[t]} · {held.filter((m) => m.tier === t).length}/{MISSIONS.filter((m) => m.tier === t).length}</Chip>)}
      </div>
      {held.length ? (
        <ul class="missions">
          {held.slice().reverse().map((m) => (
            <li key={m.id} class={`mission mission--${m.tier}`}>
              <span class="mission__tier">{TIER_NAMES[m.tier]}</span>
              <b>{m.name}</b>
              <small>Goal: {m.did}</small>
              <small class="mission__grant">{grantText(m)}</small>
            </li>
          ))}
        </ul>
      ) : <Empty>Secret Quests completed: 0</Empty>}
      <small class="muted">Sealed: {MISSIONS.length - held.length}</small>
    </Panel>
  );
}
