/**
 * Engravings on screen (`core/engravings.ts`), all of it the System's: its window in the gear's cyan, each
 * engraving's mark lit in its own colour (`ui/runes.tsx`).
 *
 * - The three attuned: a socket to each kind of gear, holding the engraving in play from what is worn.
 *   Drawn the same on Equipment and at the head of the CODEX, as Hollow Knight sets the charms worn above
 *   the charms found.
 * - The CODEX window: every engraving as a stone in a grid by kind, lit once kept, and the one chosen read
 *   large in a turning circle, after Baldur's Gate 3's spell tooltip and The Witcher 3's runestones. Opened
 *   for a piece, it offers to cut each power kept into it.
 * - A piece's engraving on its card, and the cutting of a power into a piece.
 */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as engr from '@/core/engravings';
import * as forge from '@/core/forge';
import * as gear from '@/core/gear';
import type { Item, Save } from '@/core/types';
import { group } from '@/core/util';
import { ENGRAVINGS, GROUPS, type EngraveGroup, type Engraving, type EngravingId } from '@/data/engravings';
import * as store from '@/store';
import { useSave } from '@/store';
import { buzz } from './feedback';
import { Btn, GearArt } from './components';
import { MatArt } from './forge';
import { Glyph } from './icons';
import { openSheet, sys, toast } from './overlays';
import { ArcaneRing, EmptyStone, RUNE, RuneGlyph, Runestone, type RuneState } from './runes';
import * as system from './system';

const ember = (s: Save) => s.materials?.[forge.EMBER.id] ?? 0;
const groupName = (g: EngraveGroup) => GROUPS.find((x) => x.key === g)!.name;
const hue = (e: Engraving) => `--rh: ${RUNE[e.id].hue}`;

/** How a power stands with the hunter: attuned from a piece worn, kept in the Codex, or not kept. */
function standing(s: Save, e: Engraving, live = engr.liveItems(s)): RuneState {
  if (live[e.group]?.engr === e.id) return 'attuned';
  return engr.known(s, e.id) ? 'kept' : 'sealed';
}
const STANDING: Record<RuneState, string> = { attuned: 'Attuned', kept: 'Kept', sealed: 'Not kept', dormant: 'Dormant' };

/** The small mark a piece carries on its tile while it is engraved: its glyph alone, dim while dormant. */
export const EngravedBadge = ({ e, dormant }: { e: Engraving; dormant?: boolean }) => (
  <span class={`engbadge ${dormant ? 'is-dormant' : ''}`} aria-label={dormant ? `Engraved: ${e.name}, dormant` : `Engraved: ${e.name}`}>
    <RuneGlyph e={e} size={14} dim={dormant} />
  </span>
);

/**
 * The three attuned, a socket to each kind of gear: the engraving in play from what is worn, or the kind's
 * stone, empty. Each socket is a button; `onPick` gets its kind and what it holds.
 */
export function AttunedTriad({ onPick, chosen }: { onPick: (g: EngraveGroup, id?: EngravingId) => void; chosen?: EngravingId }) {
  const s = useSave();
  const live = engr.liveItems(s);
  return (
    <div class="triad">
      {GROUPS.map((g) => {
        const e = engr.engravingById(live[g.key]?.engr);
        return (
          <button
            key={g.key}
            type="button"
            class={`triad__sock ${e ? 'is-on' : ''} ${e && chosen === e.id ? 'is-chosen' : ''}`}
            style={e ? hue(e) : undefined}
            aria-label={e ? `${g.name}: ${e.name}, attuned` : `${g.name}: nothing attuned`}
            onClick={() => onPick(g.key, e?.id)}
          >
            <span class="triad__well">{e ? <Runestone e={e} size={46} state="attuned" /> : <EmptyStone group={g.key} size={40} />}</span>
            <small>{g.name}</small>
            <b>{e ? e.name : 'None'}</b>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A piece's engraving on its card: its mark, whether it is attuned, dormant (another piece of its kind
 * holds the attuned one) or on a piece not worn, `[Engraving: Name]` and its rule; and the way to the Codex.
 * With no engraving, the card offers to cut one while the Codex holds a power of its kind.
 */
export function EngravingBlock({ it }: { it: Item }) {
  const s = useSave();
  const g = engr.groupOf(it);
  const e = engr.engravingById(it.engr);
  if (!g || gear.defOf(it)?.issued) return null;
  const options = ENGRAVINGS.filter((x) => x.group === g && engr.known(s, x.id) && x.id !== it.engr);
  const worn = !!gear.slotOf(s, it);
  const dormant = engr.dormant(s, it);
  if (!e && !options.length) return null;
  const state: RuneState = dormant ? 'dormant' : worn ? 'attuned' : 'kept';
  return (
    <section class={`engblock ${e ? `is-${state}` : 'is-empty'}`} style={e ? hue(e) : undefined}>
      {e ? (
        <button type="button" class="engblock__power" onClick={() => { sfx.tap(); openCodex(undefined, e.id); }} aria-label={`[Engraving: ${e.name}] in the Codex`}>
          <Runestone e={e} size={56} state={state} />
          <span class="engblock__text">
            <span class="engblock__state">{dormant ? 'Dormant' : worn ? 'Attuned' : 'Engraved'}</span>
            <b>[Engraving: {e.name}]</b>
            <small>{e.text}</small>
            {dormant && <small class="hint">Another {groupName(g).toLowerCase()} piece worn holds the attuned engraving.</small>}
            {!engr.known(s, e.id) && <small class="hint">Not in the Codex.</small>}
          </span>
        </button>
      ) : (
        <p class="engblock__none"><EmptyStone group={g} size={30} /> No engraving.</p>
      )}
      {options.length > 0 && (
        <Btn kind="ghost" block onClick={() => openCodex(it.id)}><Glyph name="engrave" /> {e ? 'Engrave Anew' : 'Engrave'}</Btn>
      )}
    </section>
  );
}

/** Cut a power into a piece, asked first, with its Ember. */
async function cut(itemId: string, e: Engraving, close?: () => void) {
  const s = store.get();
  const it = s.items.find((x) => x.id === itemId);
  const d = gear.defOf(it);
  if (!it || !d) return;
  const price = engr.cost(it);
  if (ember(s) < price) {
    await sys(system.refuse([`Not enough Ascendant Ember. (${group(ember(s))}/${group(price)})`], 'gear'));
    return;
  }
  const was = engr.engravingById(it.engr);
  const yes = await sys(system.offer([
    'Would you like to engrave this item?',
    system.tag(d.name, 'Item'),
    `${system.tag(e.name, 'Engraving')} ${e.text}`,
    ...(was ? [system.red(`It replaces [Engraving: ${was.name}], which is kept in the Codex.`)] : []),
    `Price: ${group(price)} Ascendant Ember · Held: ${group(ember(s))}`,
  ], 'gear', 'Engrave', 'Cancel'));
  if (yes !== true) return;
  const done = store.update((x) => engr.engrave(x, itemId, e.id));
  if (!done) return;
  sfx.success();
  buzz([14, 30, 22]);
  close?.();
  await sys({ ...system.notify([`${system.tag(e.name, 'Engraving')} has been cut into ${system.tag(d.name, 'Item')}.`, e.text], 'gear'), typed: false });
}

/**
 * CODEX. Opened alone, it heads with the three attuned; opened for a piece, with that piece and its price,
 * and only its kind. `focus` opens it on an engraving, or on a kind.
 */
export function openCodex(itemId?: string, focus?: EngravingId | EngraveGroup) {
  const close = openSheet({ title: 'Codex', system: { icon: null, kind: 'gear' }, render: () => <Codex itemId={itemId} focus={focus} close={() => close()} /> });
}

function Codex({ itemId, focus, close }: { itemId?: string; focus?: EngravingId | EngraveGroup; close: () => void }) {
  const s = useSave();
  const it = itemId ? s.items.find((x) => x.id === itemId) : undefined;
  const only = it ? engr.groupOf(it) : undefined;
  const live = engr.liveItems(s);
  const focused = engr.engravingById(focus);
  /** The engraving a kind opens on: what is attuned, else the first kept, else the first. */
  const opening = (g: EngraveGroup): EngravingId => {
    const of = ENGRAVINGS.filter((e) => e.group === g);
    if (it) return (of.find((e) => engr.known(s, e.id) && e.id !== it.engr) ?? of.find((e) => e.id === it.engr) ?? of[0]).id;
    return (of.find((e) => live[g]?.engr === e.id) ?? of.find((e) => engr.known(s, e.id)) ?? of[0]).id;
  };
  const first: EngraveGroup = only ?? focused?.group ?? (GROUPS.find((g) => g.key === focus)?.key) ?? 'weapon';
  const [tab, setTab] = useState<EngraveGroup>(first);
  const [sel, setSel] = useState<EngravingId>(focused && (!only || focused.group === only) ? focused.id : opening(first));
  const pick = (id: EngravingId) => {
    if (id === sel) return;
    sfx.tap();
    buzz(6);
    setSel(id);
  };
  const toTab = (g: EngraveGroup, id?: EngravingId) => {
    if (g !== tab) setTab(g);
    pick(id ?? opening(g));
  };
  const e = engr.engravingById(sel)!;
  const kept = engr.codex(s).length;
  return (
    <div class="stack cx">
      <header class="cx-head">
        <span class="cx-head__n"><b class="num">{kept}<small>/{ENGRAVINGS.length}</small></b><small>Kept</small></span>
        <span class="cx-head__ember"><MatArt id={forge.EMBER.id} size={28} /><span><small>Ascendant Ember</small><b class="num">{group(ember(s))}</b></span></span>
      </header>
      {it ? <ForPiece it={it} /> : (
        <div class="cx-attuned">
          <span class="label">Attuned</span>
          <AttunedTriad chosen={sel} onPick={(g, id) => toTab(g, id)} />
        </div>
      )}
      <Inscription e={e} it={it} close={close} />
      {!only && (
        <div class="cx-tabs" role="tablist">
          {GROUPS.map((g) => {
            const of = ENGRAVINGS.filter((x) => x.group === g.key);
            return (
              <button key={g.key} type="button" role="tab" aria-selected={tab === g.key} class={`cx-tab ${tab === g.key ? 'is-on' : ''}`} onClick={() => toTab(g.key)}>
                {g.name}<small class="num">{of.filter((x) => engr.known(s, x.id)).length}/{of.length}</small>
              </button>
            );
          })}
        </div>
      )}
      <ul class="cx-grid" role="listbox" aria-label={`${groupName(tab)} engravings`}>
        {ENGRAVINGS.filter((x) => x.group === tab).map((x) => {
          const st = standing(s, x, live);
          const here = it?.engr === x.id;
          return (
            <li key={x.id}>
              <button type="button" role="option" aria-selected={sel === x.id} class={`cx-cell is-${st} ${sel === x.id ? 'is-sel' : ''}`} style={hue(x)} onClick={() => pick(x.id)}>
                <Runestone e={x} size={54} state={st} />
                <b>{x.name}</b>
                <small>{here ? 'Engraved' : st === 'attuned' ? 'Attuned' : ''}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The piece the Codex was opened for: its art and name, the engraving it holds, and the price. */
function ForPiece({ it }: { it: Item }) {
  const was = engr.engravingById(it.engr);
  return (
    <div class="cx-for">
      <GearArt item={it} size={44} />
      <span class="cx-for__name">
        <small>Engrave</small>
        <b>{gear.defOf(it)?.name}</b>
        <i>{was ? <><RuneGlyph e={was} size={13} /> {was.name}</> : 'No engraving'}</i>
      </span>
      <span class="cx-for__cost"><small>Price</small><b class="num">{group(engr.cost(it))}</b></span>
    </div>
  );
}

/**
 * The engraving chosen, read large: its stone in a turning circle, cut in again each time it is chosen;
 * how it stands and its kind; its name and rule; where it is attuned, or where it is found; and, opened for
 * a piece, Engrave.
 */
function Inscription({ e, it, close }: { e: Engraving; it?: Item; close: () => void }) {
  const s = useSave();
  const live = engr.liveItems(s);
  const st = standing(s, e, live);
  const holder = st === 'attuned' ? live[e.group] : undefined;
  const have = st !== 'sealed';
  const here = it?.engr === e.id;
  const price = it ? engr.cost(it) : 0;
  return (
    <section class={`cx-ins is-${st}`} style={hue(e)} aria-live="polite">
      <div class="cx-ins__art" key={e.id}>
        <span class="cx-ins__ring"><ArcaneRing size={128} /></span>
        <Runestone e={e} size={78} state={st} drawn />
      </div>
      <div class="cx-ins__text" key={`t-${e.id}`}>
        <span class="cx-ins__state">{STANDING[st]} · {groupName(e.group)}</span>
        <b class="cx-ins__name">{e.name}</b>
        <p>{e.text}</p>
        {holder && <span class="cx-ins__on"><GearArt item={holder} size={22} />{gear.defOf(holder)?.name}</span>}
        {!have && <small class="cx-ins__where">Left by {e.family} bosses and Gatekeepers.</small>}
        {e.hands && <small class="cx-ins__hands">Auto never plays it</small>}
      </div>
      {it && have && (
        <div class="cx-ins__act">
          {here
            ? <span class="cx-ins__done"><Glyph name="engrave" /> Engraved</span>
            : <Btn kind={ember(s) >= price ? 'primary' : undefined} block onClick={() => void cut(it.id, e, close)}><Glyph name="engrave" /> Engrave <span class="cx-ins__price"><MatArt id={forge.EMBER.id} size={16} />{group(price)}</span></Btn>}
        </div>
      )}
    </section>
  );
}

/** A toast when a recycled piece's engraving goes to the Codex. */
export function learnedToast(before: number, s: Save) {
  const now = engr.codex(s);
  if (now.length > before) toast(`[Engraving: ${engr.engravingById(now[now.length - 1])?.name}] kept in the Codex.`, 'good');
}
