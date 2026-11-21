/**
 * Shadow equipment on screen (`core/shadowgear.ts`), in the Shadows' violet: a piece's art (its slot's glyph in its
 * grade's light, a violet edge, as a Shadow's badge wears it), the four slots on a Shadow's card, the window a slot opens
 * (what it wears, and every piece held that fits), and the hold on the Shadows screen, where every piece found is listed
 * with who wears it.
 */
import { sfx } from '@/audio/audio';
import * as shadowgear from '@/core/shadowgear';
import * as shadows from '@/core/shadows';
import type { Rank, Save, ShadowItem } from '@/core/types';
import { STATS } from '@/core/types';
import { RARITY } from '@/core/gear';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Empty, RankPlate } from './components';
import { buzz } from './feedback';
import { Glyph } from './icons';
import { openSheet } from './overlays';

/** What a piece adds, as its card writes it: `STR +8   AGI +4`. */
export const statsText = (it: ShadowItem) => STATS.filter((k) => it.stats[k]).map((k) => `${k} +${it.stats[k]}`);

/** A piece's art: its slot's glyph in its grade's light, edged in the Shadows' violet. */
export function ShadowGearArt({ it, slot, size = 48 }: { it?: ShadowItem; slot?: shadowgear.ShadowSlot; size?: number }) {
  const def = shadowgear.slotDef(it?.slot ?? slot ?? 'weapon');
  return (
    <span class={`sgart ${it ? 'is-on' : 'is-empty'}`} data-rarity={it?.rank} style={`--s: ${size}px`} aria-hidden="true">
      <span class="sgart__glow" />
      <Glyph name={def.glyph} class="sgart__glyph" />
    </span>
  );
}

/** A piece as a row: its art, its name, its grade and slot, what it adds; and at its end, what can be done with it. */
function PieceRow({ it, end }: { it: ShadowItem; end?: preact.ComponentChildren }) {
  return (
    <div class="sysbox sgrow" data-rarity={it.rank}>
      <ShadowGearArt it={it} size={44} />
      <span class="sgrow__text">
        <b>{shadowgear.nameOf(it)}</b>
        <small><RankPlate rank={it.rank as Rank} size={13} />{RARITY[it.rank as Rank].name} {shadowgear.slotDef(it.slot).name}</small>
        <small class="sgrow__stats num">{statsText(it).map((t) => <span key={t}>{t}</span>)}</small>
      </span>
      {end}
    </div>
  );
}

/**
 * A Shadow's four slots, a tile to each, on its card: the piece it wears in its grade's light, or the slot's glyph
 * dashed; a tap opens the slot. `+` in gold on an empty slot while a piece held fits it.
 */
export function ShadowGearSlots({ shadowId }: { shadowId: string }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === shadowId);
  if (!sh) return null;
  const bag = shadowgear.held(s);
  return (
    <div class="sgslots">
      {shadowgear.SHADOW_SLOTS.map((def) => {
        const it = sh.gear?.[def.key];
        const fits = !it && bag.some((x) => x.slot === def.key);
        return (
          <button type="button" key={def.key} class={`sgslot ${it ? 'is-on' : ''} ${fits ? 'is-call' : ''}`} data-rarity={it?.rank}
            aria-label={`${def.name}: ${it ? shadowgear.nameOf(it) : 'empty'}${fits ? ', something held fits' : ''}`}
            onClick={() => { sfx.tap(); openShadowSlot(shadowId, def.key); }}>
            <ShadowGearArt it={it} slot={def.key} size={46} />
            {fits && <span class="badge badge--gold sgslot__plus" aria-hidden="true">+</span>}
            <small class="sgslot__name">{def.name}</small>
          </button>
        );
      })}
    </div>
  );
}

/** A Shadow's slot, on its own sheet: what it wears there, and every piece held that fits, the best first. */
export function openShadowSlot(shadowId: string, slot: shadowgear.ShadowSlot) {
  openSheet({ title: `Equipment: ${shadowgear.slotDef(slot).name}`, system: { icon: null, kind: 'shadow' }, render: () => <SlotWindow shadowId={shadowId} slot={slot} /> });
}

function SlotWindow({ shadowId, slot }: { shadowId: string; slot: shadowgear.ShadowSlot }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === shadowId);
  if (!sh) return <Empty>That Shadow is gone.</Empty>;
  const worn = sh.gear?.[slot];
  const fits = shadowgear.held(s).filter((x) => x.slot === slot).sort((a, b) => shadowgear.worth(b) - shadowgear.worth(a));
  // An open run keeps the Shadows it walked in with (`run.party`): what is put on now reaches the next Gate.
  const put = (id: string) => {
    store.update((x) => shadowgear.equip(x, sh.id, id));
    sfx.success();
    buzz([12, 24]);
  };
  const off = () => {
    store.update((x) => shadowgear.unequip(x, sh.id, slot));
    sfx.tap();
  };
  return (
    <div class="stack sgwin">
      <div class="section">
        <div class="section__head"><span class="label">Worn</span><span class="section__right">{shadows.nameOf(sh)}</span></div>
        {worn ? <PieceRow it={worn} end={<Btn size="sm" kind="ghost" onClick={off}>Unequip</Btn>} /> : <p class="hint">Nothing worn.</p>}
      </div>
      <div class="section">
        <div class="section__head"><span class="label">Held</span><span class="section__right num">{fits.length}</span></div>
        {fits.length
          ? <div class="stack stack--tight">{fits.map((it) => {
            const gain = shadowgear.worth(it) - (worn ? shadowgear.worth(worn) : 0);
            return (
              <PieceRow key={it.id} it={it} end={
                <span class="sgrow__end">
                  {worn && <small class={`num ${gain > 0 ? 'is-up' : gain < 0 ? 'is-down' : ''}`}>{gain > 0 ? '▲' : gain < 0 ? '▼' : '='} {Math.abs(gain)}</small>}
                  <Btn size="sm" kind="primary" onClick={() => put(it.id)}>Equip</Btn>
                </span>
              } />
            );
          })}</div>
          : <p class="hint">No {shadowgear.slotDef(slot).name.toLowerCase()} held.</p>}
      </div>
    </div>
  );
}

/**
 * The hold, on the Shadows screen: every piece of Shadow equipment found, the pieces worn by none first, the best first
 * within each, each with who wears it.
 */
export function ShadowArmoury() {
  const s = useSave();
  const all = shadowgear.all(s);
  const who = (it: ShadowItem) => shadowgear.wearer(s, it.id);
  const sorted = all.slice().sort((a, b) => Number(!!who(a)) - Number(!!who(b)) || shadowgear.worth(b) - shadowgear.worth(a));
  return (
    <div class="stack stack--tight sgarmoury">
      {sorted.length
        ? sorted.map((it) => {
          const w = who(it);
          return <PieceRow key={it.id} it={it} end={<small class={`sgrow__who ${w ? 'is-worn' : ''}`}>{w ? shadows.nameOf(w) : 'Not worn'}</small>} />;
        })
        : <p class="hint">No Shadow equipment held.</p>}
    </div>
  );
}

/** How many pieces are held and worn by none, for a count. */
export const looseCount = (s: Save) => shadowgear.held(s).length;
