/** The day's Daily Quests, in a QUEST INFO window: on the board, and again when a run is settled. */
import type { ComponentChildren } from 'preact';
import { bonusOf, contractHint, contractText, payOf, type Contracts } from '@/core/contracts';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { Bar } from './components';
import { SysFrame } from './frame';
import { Glyph } from './icons';

export function ContractsWindow({ c, fresh = [], children }: {
  c: Contracts;
  /** Kinds the run just settled completed. */
  fresh?: string[];
  children?: ComponentChildren;
}) {
  const pay = payOf(c.grade);
  const bonus = bonusOf(c.grade);
  return (
    <SysFrame title="Quest Info" class="contracts" label="Daily Quests">
      <p class="contracts__name"><strong>[Daily Quests]</strong></p>
      <span class="label">Goal</span>
      <ul class="contracts__list">
        {c.list.map((k) => (
          <li key={k.kind} class={`contract ${k.done ? 'is-done' : ''} ${fresh.includes(k.kind) ? 'is-fresh' : ''}`} data-contract={k.kind}>
            <span class="contract__mark" aria-hidden="true">{k.done && <Glyph name="check" />}</span>
            <div class="contract__body">
              <b>{contractText(k, c.grade)}</b>
              {!k.done && <small>{contractHint(k)}</small>}
              {!k.done && k.need > 1 && <Bar pct={(k.got / k.need) * 100} thin label={`${k.got} of ${k.need}`} />}
            </div>
            <span class="contract__count num">{k.done ? (fresh.includes(k.kind) ? 'Done' : 'Paid') : `${k.got}/${k.need}`}</span>
          </li>
        ))}
      </ul>
      <span class="label">Rewards</span>
      <ol class="sysbox contracts__pay">
        <li>Each quest: Mana Shards <b class="num grant">+{pay.shards}</b> · Experience <b class="num grant">+{pay.xp}</b></li>
        <li>All {CONTRACTS_PER_DAY}: {c.bonus ? 'paid' : <>Mana Shards <b class="num grant">+{bonus.shards}</b> · Experience <b class="num grant">+{bonus.xp}</b></>}</li>
      </ol>
      {children}
    </SysFrame>
  );
}
