/**
 * Tempering on screen (`core/temper.ts`), the System's, in the gear's cyan: the Temper slot on a perfect piece's
 * card, the tempered property among its properties, and the TEMPER window. The window follows Diablo IV's
 * tempering, where the property is chosen, and Warframe's Riven cycle and Diablo IV's enchanting, where the new
 * roll stands beside the old to keep either: the slot's properties with their ranges, a roll swept across its
 * range as it lands, and then Current against New, the better marked green as a piece's card marks a stat
 * that rises, and Keep Current or Use New, as NIKKE's and Honkai: Star Rail's keep-one windows word it. The price
 * is Ember alone, carried on the button, as Warframe's `CYCLE FOR 7,000` carries it.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import * as temper from '@/core/temper';
import type { Item, Temper } from '@/core/types';
import { group } from '@/core/util';
import { EMBER } from '@/data/forge';
import { TEMPER_FROM } from '@/data/temper';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, GearArt, Section } from './components';
import { buzz } from './feedback';
import { MatArt } from './forge';
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

/** The Temper slot's mark: a diamond, lit gold once it holds a temper, the hammer at its heart. */
function TemperMark({ on, size = 44 }: { on: boolean; size?: number }) {
  return (
    <span class={`tmark ${on ? 'is-on' : ''}`} style={`--s: ${size}px`} aria-hidden="true">
      <svg viewBox="0 0 44 44"><path class="tmark__d" d="M22 2.5 41.5 22 22 41.5 2.5 22z" /><path class="tmark__in" d="M22 8 36 22 22 36 8 22z" /></svg>
      <Glyph name="hammer" />
    </span>
  );
}

/** A temper's price as a button carries it: the Ember mark and the count, red while the Ember held falls short. */
export function EmberCost({ n, short = false }: { n: number; short?: boolean }) {
  return <span class={`embercost ${short ? 'is-short' : ''}`}><MatArt id={EMBER.id} size={18} /><b class="num">{group(n)}</b></span>;
}

/**
 * The Temper slot on a piece's card, a panel as Familiarity's is: the slot's mark and what it holds, its place in
 * its range, or the properties it can take while it is empty; a new roll waiting, if one is; and the way to the
 * TEMPER window, with the next temper's Ember on it. A piece short of perfect, or below C-Rank, has no slot.
 */
export function TemperBlock({ it }: { it: Item }) {
  const s = useSave();
  const d = gear.defOf(it);
  if (!d || !temper.temperable(it)) return null;
  const t = it.temper;
  const ember = temper.emberFor(it);
  const short = (s.materials?.[EMBER.id] ?? 0) < ember;
  const n = temper.count(it);
  return (
    <Section title="Temper" right={n ? <span class="num">Tempered {n} {n === 1 ? 'time' : 'times'}</span> : undefined}>
      <div class={`sysbox temperslot ${t ? 'is-held' : 'is-open'} ${it.temperNew ? 'is-waiting' : ''}`}>
        <div class="temperslot__row">
          <TemperMark on={!!t} />
          {t ? (
            <span class="temperslot__text">
              <span class="temperslot__line"><b>{nameOf(t.stat)}</b><span class="temperslot__v num">{temperValue(t)}</span></span>
              <span class="temperslot__range"><RangeBar at={temper.share(it, t)} /><small class="num">{rangeText(t.stat, d.rank)}</small></span>
            </span>
          ) : (
            <span class="temperslot__text">
              <b>Empty</b>
              <small class="temperslot__can">{temper.statsFor(it).map(nameOf).join(', ')}</small>
            </span>
          )}
        </div>
        {it.temperNew && (
          <p class="temperslot__wait"><span class="label">New roll</span><b>{nameOf(it.temperNew.stat)} <span class="num">{temperValue(it.temperNew)}</span></b></p>
        )}
        <Btn kind={it.temperNew ? 'gold' : undefined} block class="temperslot__go" onClick={() => openTemper(it.id)}>
          {it.temperNew ? 'Choose' : <><Glyph name="hammer" /> {t ? 'Temper Again' : 'Temper'} <i class="tsep" aria-hidden="true" /> <EmberCost n={ember} short={short} /></>}
        </Btn>
      </div>
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
  const ember = temper.emberFor(it);
  const held = s.materials?.[EMBER.id] ?? 0;
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
  // The better of the two, by its place in its range: the same property compares by size. Level, neither is.
  const gap = it.temper && it.temperNew ? temper.share(it, it.temperNew) - temper.share(it, it.temper) : 0;
  const newBetter = gap > 1e-9;
  const oldBetter = gap < -1e-9;
  return (
    <div class="stack temperwin">
      <header class="temperwin__head">
        <GearArt item={it} size={48} />
        <span class="temperwin__name"><b>{d.name}</b><small>{temper.count(it) ? `Tempered ${temper.count(it)} ${temper.count(it) === 1 ? 'time' : 'times'}` : 'Never tempered'}</small></span>
        <span class={`temperwin__held ${held < ember ? 'is-short' : ''}`} aria-label={`Ascendant Ember held: ${held}`}><MatArt id={EMBER.id} size={22} /><b class="num">{group(held)}</b></span>
      </header>
      {landing && !done && (
        <section class="temperroll" aria-live="polite">
          <span class="label">{nameOf(landing.roll.stat)}</span>
          <RangeBar at={sweep ?? 0} class="is-rolling" />
        </section>
      )}
      {waiting && it.temper && it.temperNew ? (
        <section class="tcompare" aria-label="Current or new">
          {(['current', 'new'] as const).map((k) => {
            const x = k === 'current' ? it.temper! : it.temperNew!;
            const better = k === 'new' ? newBetter : oldBetter;
            return (
              <div key={k} class={`tcompare__one is-${k} ${better ? 'is-better' : ''}`}>
                <span class="tcompare__top">
                  <span class="label">{k === 'current' ? 'Current' : 'New'}</span>
                  {better && <span class="tbetter"><i aria-hidden="true">▲</i>Better</span>}
                </span>
                <b>{nameOf(x.stat)}</b>
                <span class="tcompare__v num">{temperValue(x)}</span>
                <RangeBar at={temper.share(it, x)} />
                <small class="num muted">{rangeText(x.stat, d.rank)}</small>
              </div>
            );
          })}
          <div class="tcompare__act">
            <Btn kind={oldBetter ? 'primary' : undefined} onClick={() => settle(false)}>Keep Current</Btn>
            <Btn kind={newBetter ? 'primary' : undefined} onClick={() => settle(true)}>Use New</Btn>
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
                    <span class="tstat__end">
                      {it.temper?.stat === x && <small class="tstat__held">Current {temperValue(it.temper)}</small>}
                      <small class="num muted">{rangeText(x, d.rank)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <Btn kind="primary" block class="temperwin__go" disabled={!!short} onClick={roll}>
            {short === 'short'
              ? <>Ascendant Ember <span class="num">{group(held)}/{group(ember)}</span></>
              : <><Glyph name="hammer" /> {it.temper ? 'Temper Again' : 'Temper'} <i class="tsep" aria-hidden="true" /> <EmberCost n={ember} /></>}
          </Btn>
        </>
      )}
    </div>
  );
}
