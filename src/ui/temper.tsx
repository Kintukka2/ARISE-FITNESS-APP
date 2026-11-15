/**
 * Tempering on screen (`core/temper.ts`), the System's, in the gear's cyan: the Temper slot on a perfect piece's
 * card, the tempered property among its properties, and the TEMPER window. The window follows Diablo IV's
 * tempering, where the property is chosen, and Warframe's Riven cycle and Diablo IV's enchanting, where the new
 * roll stands beside the old to keep either: the slot's properties with their ranges, the price, a roll swept
 * across its range as it lands, and then Held against New.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as forge from '@/core/forge';
import * as gear from '@/core/gear';
import * as temper from '@/core/temper';
import type { Item, Temper } from '@/core/types';
import { group } from '@/core/util';
import { EMBER } from '@/data/forge';
import { TEMPER_FROM } from '@/data/temper';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, GearArt, Section, Shards } from './components';
import { buzz } from './feedback';
import { CostGrid, MatArt } from './forge';
import { Glyph } from './icons';
import { openSheet, toast } from './overlays';

const unit = (x: number) => Math.max(0, Math.min(1, x));
/** A temper's size as its property is written: `+11.2%`, `+6`. */
export const temperValue = (t: Temper) => `+${Math.round(t.v * 10) / 10}${temper.pctOf(t.stat) ? '%' : ''}`;
/** A property's name as a piece's card writes it: `Crit Chance`. */
const nameOf = (stat: string) => gear.rollName(stat);
const rangeText = (stat: string, rank: string) => {
  const r = temper.rangeOf(stat, rank);
  return r ? `${r.min}-${r.max}${temper.pctOf(stat) ? '%' : ''}` : '';
};

/** A temper's place in its range: a bar, its fill gold, a mark where it sits. */
function RangeBar({ at, class: cls }: { at: number; class?: string }) {
  return <i class={`tbar ${cls ?? ''}`} aria-hidden="true"><i style={`width: ${unit(at) * 100}%`} /><b style={`left: ${unit(at) * 100}%`} /></i>;
}

/** The tempered property among a piece's properties: its name and size, its bar, its range, and the hammer. */
export function TemperLine({ it }: { it: Item }) {
  const t = it.temper;
  const d = gear.defOf(it);
  if (!t || !d) return null;
  return (
    <li class="itemrolls__temper">
      <span class="itemrolls__name"><Glyph name="hammer" class="itemrolls__hammer" />{nameOf(t.stat)} <b class="num">{temperValue(t)}</b></span>
      <RangeBar at={temper.share(it, t)} class="itemrolls__bar" />
      <small class="num muted">{rangeText(t.stat, d.rank)}</small>
    </li>
  );
}

/**
 * The Temper slot on a piece's card: what it holds, or that it is open, a new roll waiting if one is, and the
 * way to the TEMPER window. A piece short of perfect, or below C-Rank, has no slot.
 */
export function TemperBlock({ it }: { it: Item }) {
  const s = useSave();
  if (!temper.temperable(it)) return null;
  const t = it.temper;
  const price = temper.cost(it);
  return (
    <Section title="Temper" right={<span class="tprice"><MatArt id={EMBER.id} size={16} /><b class="num">{group(price.mats[EMBER.id] ?? 0)}</b></span>}>
      <div class={`temperslot ${t ? 'is-held' : 'is-open'} ${it.temperNew ? 'is-waiting' : ''}`}>
        <span class="temperslot__mark"><Glyph name="hammer" /></span>
        <span class="temperslot__text">
          {t ? <><b>{nameOf(t.stat)} <span class="num">{temperValue(t)}</span></b><RangeBar at={temper.share(it, t)} /></> : <b>Temper slot open</b>}
          {it.temperNew && <small class="temperslot__wait">New roll waiting: {nameOf(it.temperNew.stat)} {temperValue(it.temperNew)}</small>}
        </span>
        <Btn kind={it.temperNew ? 'gold' : 'ghost'} onClick={() => openTemper(it.id)}>{it.temperNew ? 'Choose' : t ? 'Temper Again' : 'Temper'}</Btn>
      </div>
      {!forge.affords(s, price) && !it.temperNew && <small class="hint">Not enough {s.wallet.shards < price.shards ? 'Mana Shards' : 'Ascendant Ember'}.</small>}
    </Section>
  );
}

/** TEMPER: one piece's Temper slot. */
export function openTemper(itemId: string) {
  openSheet({ title: 'Temper', system: { icon: null, kind: 'gear' }, render: () => <TemperWindow itemId={itemId} /> });
}

/** A roll landing: its value sweeping across its range to where it lands, as a reel stops. */
function useSweep(to: number | null, ms = 1100): number | null {
  const [v, setV] = useState<number | null>(null);
  const raf = useRef(0);
  useEffect(() => {
    if (to === null) { setV(null); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      // Back and forth across the whole range, then easing from its top to where the roll lands.
      const swing = 0.55;
      const e = (x: number) => 1 - (1 - x) ** 3;
      setV(k >= 1 ? to : k < swing ? 0.5 + 0.5 * Math.sin((k / swing) * Math.PI * 3 - Math.PI / 2) : 1 + (to - 1) * e((k - swing) / (1 - swing)));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return v;
}

function TemperWindow({ itemId }: { itemId: string }) {
  const s = useSave();
  const it = s.items.find((x) => x.id === itemId);
  const d = gear.defOf(it);
  const [stat, setStat] = useState<string | null>(it?.temper?.stat ?? (it ? temper.systemStat(it) ?? null : null));
  const [landing, setLanding] = useState<{ roll: Temper; at: number } | null>(null);
  const sweep = useSweep(landing?.at ?? null);
  const done = landing !== null && sweep === landing.at;
  if (!it || !d) return null;
  if (!temper.temperable(it)) return <p class="hint">A piece is tempered once it is perfect, from {TEMPER_FROM}-Rank.</p>;
  const price = temper.cost(it);
  const short = stat ? temper.blocked(s, it.id, stat) : 'stat';
  const roll = () => {
    if (!stat) return;
    const got = store.update((x) => temper.temper(x, it.id, stat));
    if (!got) return;
    sfx.stamp();
    buzz([10, 40, 10, 40, 24]);
    setLanding({ roll: got, at: temper.share(it, got) });
  };
  const settle = (take: boolean) => {
    const was = it.temperNew;
    if (!store.update((x) => temper.settle(x, it.id, take))) return;
    if (take && was) { sfx.success(); toast(`Tempered: ${nameOf(was.stat)} ${temperValue(was)}`, 'good'); } else sfx.tap();
    setLanding(null);
  };
  const waiting = it.temperNew && (!landing || done);
  // The better of the two, by its place in its range: the same property compares by size.
  const newBetter = !!(it.temper && it.temperNew && temper.share(it, it.temperNew) > temper.share(it, it.temper));
  return (
    <div class="stack temperwin">
      <header class="temperwin__head">
        <GearArt item={it} size={48} />
        <span class="temperwin__name"><b>{d.name}</b><small>{temper.count(it) ? `Tempered ${temper.count(it)} ${temper.count(it) === 1 ? 'time' : 'times'}` : 'Never tempered'}</small></span>
        <span class="temperwin__held"><MatArt id={EMBER.id} size={22} /><b class="num">{group(s.materials?.[EMBER.id] ?? 0)}</b></span>
      </header>
      {landing && !done && (
        <section class="temperroll" aria-live="polite">
          <span class="label">{nameOf(landing.roll.stat)}</span>
          <RangeBar at={sweep ?? 0} class="is-rolling" />
        </section>
      )}
      {waiting && it.temper && it.temperNew ? (
        <section class="tcompare" aria-label="Held or new">
          {(['held', 'new'] as const).map((k) => {
            const t = k === 'held' ? it.temper! : it.temperNew!;
            const better = k === 'new' ? newBetter : !newBetter;
            return (
              <div key={k} class={`tcompare__one is-${k} ${better ? 'is-better' : ''}`}>
                <span class="label">{k === 'held' ? 'Held' : 'New'}</span>
                <b>{nameOf(t.stat)}</b>
                <span class="tcompare__v num">{temperValue(t)}</span>
                <RangeBar at={temper.share(it, t)} />
                <small class="num muted">{rangeText(t.stat, d.rank)}</small>
              </div>
            );
          })}
          <div class="tcompare__act">
            <Btn kind={newBetter ? undefined : 'gold'} onClick={() => settle(false)}>Keep Held</Btn>
            <Btn kind={newBetter ? 'gold' : undefined} onClick={() => settle(true)}>Take New</Btn>
          </div>
        </section>
      ) : landing && done && !it.temperNew ? (
        <section class="tresult">
          <span class="label">Tempered</span>
          <b>{nameOf(landing.roll.stat)} <span class="num">{temperValue(landing.roll)}</span></b>
          <RangeBar at={landing.at} />
        </section>
      ) : null}
      {!it.temperNew && !(landing && !done) && (
        <>
          <section class="tstats" aria-label="Properties">
            <span class="label">Choose a property</span>
            <ul>
              {temper.statsFor(it).map((x) => (
                <li key={x}>
                  <button type="button" class={`tstat ${stat === x ? 'is-on' : ''} ${it.temper?.stat === x ? 'is-held' : ''}`} aria-pressed={stat === x} onClick={() => { sfx.tap(); setStat(x); }}>
                    <span class="tstat__dot" aria-hidden="true" />
                    <span class="tstat__name">{nameOf(x)}</span>
                    {it.temper?.stat === x && <small class="tstat__held">Held {temperValue(it.temper)}</small>}
                    <small class="num muted">{rangeText(x, d.rank)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section class="tprice-row">
            <span class="label">Price</span>
            <CostGrid s={s} c={price} />
          </section>
          <Btn kind="primary" block disabled={!!short} onClick={roll}>
            {short === 'short' ? (s.wallet.shards < price.shards ? `Mana Shards ${group(s.wallet.shards)}/${group(price.shards)}` : 'Not enough Ascendant Ember')
              : <><Glyph name="hammer" /> {it.temper ? 'Temper Again' : 'Temper'} · <Shards n={price.shards} /></>}
          </Btn>
        </>
      )}
    </div>
  );
}
