/** The day's System contracts, in a System window: on the board, and again when a run is settled. */
import type { ComponentChildren } from 'preact';
import { bonusOf, contractHint, contractText, payOf, type Contracts } from '@/core/contracts';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { Bar, Shards } from './components';
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
    <section class="sysbox contracts" aria-label="System contracts">
      <header class="sysbox__head">
        <span class="sysbox__glyph" aria-hidden="true">!</span>
        <span class="sysbox__title">Contracts</span>
      </header>
      <div class="sysbox__body">
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
        <p class="contracts__pay">
          Each pays <Shards n={pay.shards} /> and <b class="num">{pay.xp}</b> XP.
          {' '}{c.bonus ? `All ${CONTRACTS_PER_DAY} done, and the bonus paid` : <>All {CONTRACTS_PER_DAY} pay <Shards n={bonus.shards} /> and <b class="num">{bonus.xp}</b> XP more</>}.
        </p>
        {children}
      </div>
    </section>
  );
}
