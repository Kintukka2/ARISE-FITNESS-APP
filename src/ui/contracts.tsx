/**
 * QUEST INFO windows: one quest each, its name, its goals and what it pays, as the source sets them.
 * The day's Daily Quests are one, opened from the Quests screen (a run's results show only the ones it moved); the
 * Quests screen builds every other quest from the same pieces.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bonusOf, contractHint, contractText, payOf, type ContractReport, type Contracts, type Moved } from '@/core/contracts';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { Bar } from './components';
import { Rewards, SysAlert, SysFrame, type FrameKind } from './frame';
import { Glyph, Shard } from './icons';

/** One goal: the order, a hint under it while it is undone, a bar for a count above one, and the count. */
export function QuestGoal({ id, text, hint, got, need, done, fresh, count, pct }: {
  id?: string;
  text: ComponentChildren;
  hint?: ComponentChildren;
  got: number;
  need: number;
  done: boolean;
  /** Completed by the run just settled. */
  fresh?: boolean;
  /** What the count box shows, if not `got/need`. */
  count?: ComponentChildren;
  /** How full the bar is, from 0 to 1, when that is not `got/need`: experience toward a level, say. */
  pct?: number;
}) {
  const bar = pct ?? (need > 1 ? Math.min(got, need) / need : null);
  return (
    <li class={`contract ${done ? 'is-done' : ''} ${fresh ? 'is-fresh' : ''}`} data-contract={id}>
      <span class="contract__mark" aria-hidden="true">{done && <Glyph name="check" />}</span>
      <div class="contract__body">
        <b>{text}</b>
        {!done && hint && <small>{hint}</small>}
        {!done && bar !== null && <Bar pct={bar * 100} thin label={`${Math.min(got, need)} of ${need}`} />}
      </div>
      <span class="contract__count num">{count ?? `${Math.min(got, need)}/${need}`}</span>
    </li>
  );
}

/**
 * A QUEST INFO window: the quest's bracketed name, GOAL, REWARDS, then whatever follows them. `bare`
 * leaves the frame off, for a sheet opened with `system`, which draws the frame and its header itself.
 */
export function QuestWindow({ name, lead, kind = 'system', goals, rewards, rewardsLead, class: cls, label, tour, bare, children }: {
  /** The quest's name with its type, as the window brackets it: `Daily Quests`, `Reclassification: D-Rank`. */
  name: string;
  /** What stands under the name, before GOAL: a Reclassification's rank plates. */
  lead?: ComponentChildren;
  kind?: FrameKind;
  goals: ComponentChildren;
  rewards: ComponentChildren[];
  /** A line between REWARDS and the list, as Quest Rewards sets `You got rewards.` */
  rewardsLead?: string;
  class?: string;
  label?: string;
  tour?: string;
  bare?: boolean;
  children?: ComponentChildren;
}) {
  const body = (
    <>
      <p class="questinfo__name"><strong>[{name}]</strong></p>
      {lead}
      <span class="label questinfo__head">Goal</span>
      <ul class="questinfo__goals">{goals}</ul>
      <span class="label questinfo__head">Rewards</span>
      {rewardsLead && <p class="questinfo__note">{rewardsLead}</p>}
      <Rewards items={rewards} />
      {children}
    </>
  );
  if (bare) return <div class={`questinfo questinfo--bare ${cls ?? ''}`} aria-label={label ?? name}>{body}</div>;
  return (
    <SysFrame title="Quest Info" kind={kind} class={`questinfo ${cls ?? ''}`} label={label ?? name} tour={tour}>
      {body}
    </SysFrame>
  );
}

/** The day's Daily Quests. */
export function ContractsWindow({ c, fresh = [], bare, children }: {
  c: Contracts;
  /** Kinds the run just settled completed. */
  fresh?: string[];
  bare?: boolean;
  children?: ComponentChildren;
}) {
  const pay = payOf(c.grade);
  const bonus = bonusOf(c.grade);
  return (
    <QuestWindow name="Daily Quests" class="contracts" label="Daily Quests" bare={bare}
      goals={c.list.map((k) => (
        <QuestGoal key={k.kind} id={k.kind} text={contractText(k, c.grade)} hint={contractHint(k)} got={k.got} need={k.need} done={k.done}
          fresh={fresh.includes(k.kind)} count={k.done ? (fresh.includes(k.kind) ? 'Done' : 'Paid') : undefined} />
      ))}
      rewards={[
        <>Each quest: Mana Shards <b class="num grant">+{pay.shards}</b> · XP <b class="num grant">+{pay.xp}</b></>,
        <>All {CONTRACTS_PER_DAY}: {c.bonus ? 'paid' : <>Mana Shards <b class="num grant">+{bonus.shards}</b> · XP <b class="num grant">+{bonus.xp}</b></>}</>,
      ]}>
      {children}
    </QuestWindow>
  );
}

/**
 * What a run did to the day's Daily Quests, on its results, in the Gates' orange: a line to each quest
 * the run moved, its ring filling from where it stood to where it stands, then its count, or what it
 * paid once done; and a line for the completion bonus when this run earned it. On the results it
 * stands in for QUEST INFO and QUEST REWARDS (docs/VOICE.md, "Announcements").
 */
/**
 * The Daily Quests a run moved, on its results: one System alert each, `Quest Info` while it is under
 * way and `Quest Rewards` once it is done, with what it paid. The ring and the count move a beat
 * after the alert lands, to where the run left them.
 */
export function QuestLines({ c, report }: { c: Contracts; report: ContractReport }) {
  const pay = payOf(c.grade);
  const bonus = bonusOf(c.grade);
  return (
    <div class="alerts questlines" aria-label="Daily Quests">
      {report.moved.map((k, i) => <QuestLine key={k.kind} k={k} grade={c.grade} pay={pay} delay={300 + i * 180} />)}
      {report.bonus && (
        <SysAlert head="Quest Rewards" fyi class="is-done" delay={300 + report.moved.length * 180} icon={<Ring p={1} done mark="star" />} aside={<Pay {...bonus} />}>
          <strong>[Daily Quests]</strong> Completion bonus.
        </SysAlert>
      )}
    </div>
  );
}

function QuestLine({ k, grade, pay, delay }: { k: Moved; grade: Contracts['grade']; pay: { shards: number; xp: number }; delay: number }) {
  const [at, setAt] = useState(k.from);
  useEffect(() => {
    const t = setTimeout(() => setAt(k.got), delay + 450);
    return () => clearTimeout(t);
  }, []);
  const done = k.done && at >= k.got;
  return (
    <SysAlert head={done ? 'Quest Rewards' : 'Quest Info'} fyi class={done ? 'is-done' : ''} delay={delay} attrs={{ 'data-contract': k.kind }}
      icon={<Ring p={Math.min(1, at / Math.max(1, k.need))} done={done} />}
      aside={done ? <Pay {...pay} /> : <span class="num">{Math.min(at, k.need)}/{k.need}</span>}>
      {contractText(k, grade)}
    </SysAlert>
  );
}

/** How far a quest has come, as a ring; a tick, or a star for the bonus, once it is done. */
export function Ring({ p, done, mark = 'check' }: { p: number; done?: boolean; mark?: 'check' | 'star' }) {
  const C = 2 * Math.PI * 12;
  return (
    <svg class="qline__ring" viewBox="0 0 30 30" aria-hidden="true">
      <circle class="qline__track" cx="15" cy="15" r="12" />
      <circle class="qline__arc" cx="15" cy="15" r="12" style={{ strokeDasharray: `${C}`, strokeDashoffset: `${C * (1 - p)}` }} />
      {done && (mark === 'star'
        ? <path class="qline__mark" d="M15 8.5l1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5z" />
        : <path class="qline__mark qline__mark--tick" d="M10 15.4l3.3 3.2 6.7-7" />)}
    </svg>
  );
}

/** What a quest paid, name first, as every gain is. */
export function Pay({ xp, shards }: { xp: number; shards: number }) {
  return (
    <span class="qline__pay">
      <span>XP <b class="grant num">+{xp}</b></span>
      <span class="qline__shards"><Shard size={12} /><b class="grant num">+{shards}</b></span>
    </span>
  );
}
