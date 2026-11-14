/**
 * Engravings on screen (`core/engravings.ts`): the CODEX window, after Diablo III's Kanai's Cube and
 * Diablo IV's Codex of Power (a slot to each kind of gear over the powers kept, every power listed with
 * where it is found); a piece's engraving on its card; and the cutting of a power into a piece. All of it
 * the System's, in the gear's cyan.
 */
import { sfx } from '@/audio/audio';
import * as engr from '@/core/engravings';
import * as forge from '@/core/forge';
import * as gear from '@/core/gear';
import type { Item, Save } from '@/core/types';
import { group } from '@/core/util';
import { ENGRAVINGS, GROUPS, type EngraveGroup, type Engraving } from '@/data/engravings';
import * as store from '@/store';
import { useSave } from '@/store';
import { buzz } from './feedback';
import { FamilyGlyph } from './emblems';
import { Btn, GearArt } from './components';
import { MatArt } from './forge';
import { Glyph } from './icons';
import { openSheet, sys, toast } from './overlays';
import * as system from './system';

const ember = (s: Save) => s.materials?.[forge.EMBER.id] ?? 0;
const groupName = (g: EngraveGroup) => GROUPS.find((x) => x.key === g)!.name;

/** A power's mark: its family's sign in a cut diamond. */
export function EngraveMark({ e, size = 30, dim = false }: { e: Engraving; size?: number; dim?: boolean }) {
  return (
    <span class={`engmark ${dim ? 'is-dim' : ''}`} style={`--s: ${size}px`} aria-hidden="true">
      <FamilyGlyph family={e.family} size={Math.round(size * 0.52)} />
    </span>
  );
}

/** The small rune a piece carries on its tile while it is engraved. */
export const EngravedBadge = ({ dormant }: { dormant?: boolean }) => (
  <span class={`engbadge ${dormant ? 'is-dormant' : ''}`} aria-label={dormant ? 'Engraved, dormant' : 'Engraved'}><Glyph name="engrave" /></span>
);

/**
 * A piece's engraving on its card: its mark, `[Engraving: Name]` and its rule; whether it is live,
 * dormant (another piece of its kind holds the live one) or not worn; and the way to the Codex. With no
 * engraving, the card offers to cut one while the Codex holds a power of its kind.
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
  return (
    <section class={`engblock ${e ? '' : 'is-empty'} ${dormant ? 'is-dormant' : ''}`}>
      {e ? (
        <div class="engblock__power">
          <EngraveMark e={e} size={40} dim={dormant} />
          <span class="engblock__text">
            <span class="engblock__state">{dormant ? 'Dormant' : worn ? 'Live' : 'Engraving'}</span>
            <b>[Engraving: {e.name}]</b>
            <small>{e.text}</small>
            {dormant && <small class="hint">Another {groupName(g).toLowerCase()} piece worn holds the live engraving.</small>}
            {!engr.known(s, e.id) && <small class="hint">Not in the Codex.</small>}
          </span>
        </div>
      ) : (
        <p class="engblock__none"><Glyph name="engrave" /> No engraving.</p>
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
 * CODEX: the three kinds of gear, each with the engraving live on what is worn and the powers of its
 * kind under it, a row to each: its mark, its name and rule, lit while it is kept, dark with where it is
 * found while it is not. Opened for a piece, it shows that piece's kind and each power kept is cut into it.
 */
export function openCodex(itemId?: string) {
  const close = openSheet({ title: 'Codex', system: { icon: null, kind: 'gear' }, render: () => <Codex itemId={itemId} close={() => close()} /> });
}

function Codex({ itemId, close }: { itemId?: string; close: () => void }) {
  const s = useSave();
  const it = itemId ? s.items.find((x) => x.id === itemId) : undefined;
  const only = it ? engr.groupOf(it) : undefined;
  const live = engr.liveItems(s);
  const kept = engr.codex(s).length;
  return (
    <div class="stack codex">
      <header class="codexhead">
        <span class="codexhead__n"><b class="num">{kept}<small>/{ENGRAVINGS.length}</small></b><small>Kept</small></span>
        <span class="codexhead__ember"><MatArt id={forge.EMBER.id} size={30} /><span><small>Ascendant Ember</small><b class="num">{group(ember(s))}</b></span></span>
      </header>
      {it && (
        <div class="codexfor">
          <GearArt item={it} size={40} />
          <span><small>Engrave</small><b>{gear.defOf(it)?.name}</b></span>
          <span class="codexfor__cost"><small>Price</small><b class="num">{group(engr.cost(it))}</b></span>
        </div>
      )}
      {GROUPS.filter((g) => !only || g.key === only).map((g) => {
        const on = live[g.key];
        const onE = engr.engravingById(on?.engr);
        return (
          <section key={g.key} class="codexgroup">
            <header class="exsec__head"><span class="label">{g.name}</span><i aria-hidden="true" /><small>{onE ? <>Live: <b>{onE.name}</b></> : 'Live: -- --'}</small></header>
            <ul class="codexlist">
              {ENGRAVINGS.filter((e) => e.group === g.key).map((e) => {
                const have = engr.known(s, e.id);
                const here = it?.engr === e.id;
                return (
                  <li key={e.id} class={`codexrow ${have ? 'is-kept' : ''} ${onE?.id === e.id ? 'is-live' : ''}`}>
                    <EngraveMark e={e} dim={!have} />
                    <span class="codexrow__text">
                      <b>{e.name}{e.hands && <small class="codexrow__hands">Auto never plays it</small>}</b>
                      <small>{e.text}</small>
                      {!have && <small class="codexrow__where">Left by {e.family} bosses and Gatekeepers.</small>}
                    </span>
                    {it && have && (here
                      ? <span class="codexrow__on">Engraved</span>
                      : <Btn size="sm" kind={ember(s) >= engr.cost(it) ? 'primary' : undefined} onClick={() => void cut(it.id, e, close)}>Engrave</Btn>)}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** A toast when a recycled piece's engraving goes to the Codex. */
export function learnedToast(before: number, s: Save) {
  const now = engr.codex(s);
  if (now.length > before) toast(`[Engraving: ${engr.engravingById(now[now.length - 1])?.name}] kept in the Codex.`, 'good');
}
