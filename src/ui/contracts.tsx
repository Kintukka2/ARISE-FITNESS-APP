/**
 * QUEST INFO windows: one quest each, its name, its goals and what it pays, as the source sets them.
 * The day's Daily Quests are one, on the Quests screen and again when a run is settled; the Quests
 * screen builds every other quest from the same pieces.
 */
import type { ComponentChildren } from 'preact';
import { bonusOf, contractHint, contractText, payOf, type Contracts } from '@/core/contracts';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { Bar } from './components';
import { Rewards, SysFrame, type FrameKind } from './frame';
import { Glyph } from './icons';

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

/** A QUEST INFO window: the quest's bracketed name, GOAL, REWARDS, then whatever follows them. */
export function QuestWindow({ name, kind = 'system', goals, rewards, class: cls, label, tour, children }: {
  /** The quest's name with its type, as the window brackets it: `Daily Quests`, `Reclassification: D-Rank`. */
  name: string;
  kind?: FrameKind;
  goals: ComponentChildren;
  rewards: ComponentChildren[];
  class?: string;
  label?: string;
  tour?: string;
  children?: ComponentChildren;
}) {
  return (
    <SysFrame title="Quest Info" kind={kind} class={`questinfo ${cls ?? ''}`} label={label ?? name} tour={tour}>
      <p class="questinfo__name"><strong>[{name}]</strong></p>
      <span class="label">Goal</span>
      <ul class="questinfo__goals">{goals}</ul>
      <span class="label">Rewards</span>
      <Rewards items={rewards} />
      {children}
    </SysFrame>
  );
}

/** The day's Daily Quests. */
export function ContractsWindow({ c, fresh = [], children }: {
  c: Contracts;
  /** Kinds the run just settled completed. */
  fresh?: string[];
  children?: ComponentChildren;
}) {
  const pay = payOf(c.grade);
  const bonus = bonusOf(c.grade);
  return (
    <QuestWindow name="Daily Quests" class="contracts" label="Daily Quests"
      goals={c.list.map((k) => (
        <QuestGoal key={k.kind} id={k.kind} text={contractText(k, c.grade)} hint={contractHint(k)} got={k.got} need={k.need} done={k.done}
          fresh={fresh.includes(k.kind)} count={k.done ? (fresh.includes(k.kind) ? 'Done' : 'Paid') : undefined} />
      ))}
      rewards={[
        <>Each quest: Mana Shards <b class="num grant">+{pay.shards}</b> · Experience <b class="num grant">+{pay.xp}</b></>,
        <>All {CONTRACTS_PER_DAY}: {c.bonus ? 'paid' : <>Mana Shards <b class="num grant">+{bonus.shards}</b> · Experience <b class="num grant">+{bonus.xp}</b></>}</>,
      ]}>
      {children}
    </QuestWindow>
  );
}
