/**
 * The results' Challenges, after Helldivers 2's mission summary and the star reveals of Cut the Rope and Angry Birds:
 * one band, the medal against par first, then the Gate's Feats, a row to each. What the clear met lights one row after
 * another: its star or medal struck in gold with a flash and a burst of sparks, a chime a step higher each time, then
 * what it paid the first time slides in at its right. A material or Ember is its art and the figure; a blueprint is
 * its box, face down, turned over and opened from the row. A row it did not meet stands dim from the start. A struck
 * star or medal keeps a glint crossing it.
 */
import { useEffect, useId, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { sfx } from '@/audio/audio';
import * as forge from '@/core/forge';
import type { FeatPay, RaidResult } from '@/core/raid';
import { group } from '@/core/util';
import { FEATS } from '@/data/feats';
import { EMBER } from '@/data/forge';
import { Facts } from './components';
import { buzz, reducedMotion } from './feedback';
import { MatArt } from './forge';
import type { Loot, useReveal } from './loot';
import { LootCell } from './loot';
import { Medal, NAME } from './par';

/** When the first row met is struck, and the beat between one and the next, in ms. */
const FIRST = 650;
const BEAT = 720;
/** Sparks thrown from a star or medal as it is struck. */
const SPARKS = 8;

/** A five-pointed star, drawn to fill: the Feat's mark. */
const STAR = 'M12 2L14.65 9.16L22.27 9.46L16.28 14.19L18.35 21.54L12 17.3L5.65 21.54L7.72 14.19L1.73 9.46L9.35 9.16z';

/** The blueprints the Feats paid, in their rows' order: these turn over in the Challenges, not among the Spoils. */
export function featFinds(r: RaidResult): Loot[] {
  return r.feats.asked.flatMap((id) => r.feats.pay[id]?.blueprints ?? []).map((defId) => ({ defId, blueprint: true }));
}

/** What the Feats paid in materials, all together: the Spoils show what the run left besides. */
export function featMats(r: RaidResult): forge.Bundle {
  return forge.addUp(...r.feats.asked.map((id) => r.feats.pay[id]?.mats ?? {}));
}

/**
 * The Challenges band. `turn` turns over the Feats' blueprints (`featFinds`), kept by the results so leaving with one
 * face down is caught as any find is; `onOpen` opens a blueprint's card once it is turned.
 */
export function Challenges({ r, turn, onOpen }: { r: RaidResult; turn: ReturnType<typeof useReveal>; onOpen: (defId: string) => void }) {
  // The rows met, in the order they light: the medal first, then each Feat met.
  const order = [...(r.par?.medal ? ['par'] : []), ...r.feats.asked.filter((id) => r.feats.met.includes(id))];
  const lit = useStrikes(order.length);
  const isLit = (key: string) => order.indexOf(key) >= 0 && order.indexOf(key) < lit;
  const found = featFinds(r);
  let find = 0;
  return (
    <section class="rsec rband rchal" aria-label="Challenges">
      <header class="exsec__head"><span class="label">Challenges</span><i aria-hidden="true" />{r.feats.asked.length > 0 && <small class="num">Feats {r.feats.met.length}/{r.feats.asked.length}</small>}</header>
      <ol class="rchal__rows">
        {r.par && <ParRow r={r.par} lit={isLit('par')} />}
        {r.feats.asked.map((id) => {
          const met = r.feats.met.includes(id);
          const pay = r.feats.pay[id];
          const finds = (pay?.blueprints ?? []).map(() => find++);
          return (
            <li key={id} class={`rchal__row ${met ? 'is-met' : 'is-missed'} ${isLit(id) ? 'is-lit' : ''}`}>
              <span class="rchal__mark"><FeatStar on={isLit(id)} />{isLit(id) && <Burst />}</span>
              <span class="rchal__body"><b>{FEATS[id].name}</b><small>{FEATS[id].text}</small></span>
              <span class="rchal__side">
                {!met ? <small class="muted">Not met</small>
                  : pay ? <Paid pay={pay}>{finds.map((i) => (
                    <LootCell key={i} small loot={found[i]} i={i} state={turn.stateOf(i)} onTap={() => turn.reveal(i)}
                      onOpen={() => { sfx.tap(); onOpen((found[i] as { defId: string }).defId); }} />
                  ))}</Paid>
                    : <small class="rchal__met">Met</small>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The clear against its par, the band's first row: the medal struck, its name, the rounds against the par and the
 * difference (under in green, over in red); at its right, the Ember it paid the first time, or the best the Gate holds.
 */
function ParRow({ r, lit }: { r: NonNullable<RaidResult['par']>; lit: boolean }) {
  const diff = r.rounds - r.par;
  return (
    <li class={`rchal__row rchal__par ${r.medal ? `is-met is-${r.medal}` : 'is-missed'} ${lit ? 'is-lit' : ''}`}>
      <span class="rchal__mark rchal__medal"><Medal id={r.medal ?? 'bronze'} size={40} on={!!r.medal && lit} shine />{lit && <Burst />}</span>
      <span class="rchal__body">
        <b>{r.medal ? `${NAME[r.medal]} medal` : 'No medal'}</b>
        <small class="num">
          <Facts items={[`${r.rounds} rounds`, `Par ${r.par}`, <span class={diff <= 0 ? 'rchal__under' : 'rchal__over'}>{diff < 0 ? `${-diff} under` : diff > 0 ? `${diff} over` : 'level'}</span>]} />
        </small>
      </span>
      <span class="rchal__side">
        {r.medal && r.fresh.length > 0
          ? <Paid pay={{ mats: { [EMBER.id]: r.ember }, blueprints: [] }} />
          : <small class="muted">{r.best ? `Best: ${NAME[r.best]}` : 'Par'}</small>}
      </span>
    </li>
  );
}

/** What a challenge paid, at its row's right: each material or Ember as its art and the figure, then any blueprint's box. */
function Paid({ pay, children }: { pay: FeatPay; children?: ComponentChildren }) {
  return (
    <span class="rchal__pay">
      {Object.entries(pay.mats).filter(([, n]) => n > 0).map(([id, n]) => (
        <span key={id} class={`rchal__gain ${id === EMBER.id ? 'is-ember' : ''}`}>
          <MatArt id={id} size={26} />
          <b class="num">+{group(n)}</b>
          <span class="sr-only">{forge.materialById(id)?.name ?? id}</span>
        </span>
      ))}
      {children}
    </span>
  );
}

/** The Feat's star: an outline until it is struck, then gold, a glint crossing it every few seconds. */
function FeatStar({ on }: { on: boolean }) {
  const id = useId();
  return (
    <svg class={`fstar ${on ? 'is-on' : 'is-off'}`} viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stop-color="#fff4c9" />
          <stop offset="0.42" stop-color="#ffcb5c" />
          <stop offset="1" stop-color="#c4801a" />
        </linearGradient>
        <clipPath id={`${id}-c`}><path d={STAR} /></clipPath>
      </defs>
      {/* The gold is set inline: the outline's fill in the stylesheet would beat an attribute. */}
      <path class="fstar__body" d={STAR} style={on ? { fill: `url(#${id}-g)` } : undefined} />
      {on && <g clip-path={`url(#${id}-c)`}><rect class="shine" x="-6" y="-6" width="5" height="36" /></g>}
    </svg>
  );
}

/** The strike: a flash, a ring going out and sparks thrown round, once, as the row lights. */
function Burst() {
  return (
    <span class="rchal__burst" aria-hidden="true">
      <i class="rchal__flash" />
      <i class="rchal__ring" />
      {Array.from({ length: SPARKS }, (_, k) => <i key={k} class="rchal__spark" style={`--a: ${k * (360 / SPARKS) + 22}deg; --d: ${22 + (k % 2) * 8}px`} />)}
    </span>
  );
}

/** How many of `n` rows are struck: one more every beat, from a moment after the results land; all at once without motion. */
function useStrikes(n: number) {
  const calm = reducedMotion();
  const [lit, setLit] = useState(calm ? n : 0);
  useEffect(() => {
    if (calm || !n) return;
    const ts = Array.from({ length: n }, (_, k) => window.setTimeout(() => {
      setLit(k + 1);
      sfx.strike(k);
      buzz([14, 30, 22]);
    }, FIRST + k * BEAT));
    return () => ts.forEach(clearTimeout);
  }, []);
  return lit;
}
