/**
 * The hunter's gear, in the System's frame: the bag (`INVENTORY`), every set and design found (its Sets
 * view), the piece itself (`ITEM: {name}`), and what is worn (`EQUIPMENT`): the hunter's figure with a
 * square to each slot, each slot's own window (`EQUIPMENT: {Slot}`) to swap what is worn there, a set's
 * own window (`SET: {name}`), and the loadouts.
 * Pieces are forged at the Forge (`screens/Forge.tsx`) and recycled here for materials. Every number
 * comes from `core/gear.ts` and `core/forge.ts`; the screens only show and ask.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import { ascensionOpen, overCap } from '@/core/ascension';
import { walkerOf } from '@/core/walkers';
import { OVERCHARGE } from '@/data/ascension';
import { dungeonById } from '@/core/gates';
import * as forge from '@/core/forge';
import type { GearDef, Item, Rank, Save, SlotKey, Stat } from '@/core/types';
import { RANKS, STATS } from '@/core/types';
import { group } from '@/core/util';
import { setById, SETS, type GearSet } from '@/data/sets';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import * as system from '@/ui/system';
import { Btn, Empty, GearArt, IconBtn, RankPlate, Section, SetMark, Shards } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { CostGrid, MatList, bundleText } from '@/ui/forge';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { openSheet, sys, toast } from '@/ui/overlays';
import { Familiarity, openBlueprint } from './Forge';

const unit = (x: number) => Math.max(0, Math.min(1, x));
const signed = (n: number, digits = 1) => `${n < 0 ? '-' : '+'}${Math.abs(n).toFixed(digits).replace(/\.0$/, '')}`;
const rarity = (r: string) => gear.RARITY[r as Rank]?.name ?? r;

/** The kinds of piece, in the order the bag's tabs and the figure's slots use. */
const KINDS = ['Weapon', 'Off-Hand', 'Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Amulet', 'Ring'] as const;

// ------------------------------------------------------------------ the bag

type View = 'items' | 'sets';
type Sort = 'score' | 'rarity' | 'newest' | 'quality';
const SORTS: { key: Sort; name: string }[] = [
  { key: 'score', name: 'Score' }, { key: 'rarity', name: 'Rarity' }, { key: 'newest', name: 'Newest' }, { key: 'quality', name: 'Quality' },
];
type Only = 'better' | 'sets' | 'starred';
const ONLY: { key: Only; name: string }[] = [
  { key: 'better', name: 'Upgrades' }, { key: 'sets', name: 'Set pieces' }, { key: 'starred', name: 'Starred' },
];

/**
 * ITEM BAG: everything held, a card each, or every set and design found. Named apart from the Inventory
 * screen that opens it (the owner's call: two windows called Inventory read as one).
 */
export function openInventory(view: View = 'items') {
  openSheet({ title: 'Item Bag', system: { icon: null, kind: 'gear' }, render: () => <Bag initial={view} /> });
}

function Bag({ initial }: { initial: View }) {
  const s = useSave();
  const [view, setView] = useState<View>(initial);
  // Leaving the bag is looking at it: nothing in it is New after.
  useEffect(() => () => { if ((store.get().newItems ?? []).length) store.update(gear.seeAllItems); }, []);
  const complete = SETS.filter((x) => gear.heldOf(s, x.id).size >= gear.setPieces(x.id).length).length;
  return (
    <div class="stack bag">
      <BagHead />
      <div class="seg bag__views" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'items'} class={`seg__btn ${view === 'items' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('items'); }}>Items · {s.items.length}</button>
        <button type="button" role="tab" aria-selected={view === 'sets'} class={`seg__btn ${view === 'sets' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('sets'); }}>Sets · {complete}/{SETS.length}</button>
      </div>
      {view === 'items' ? <Items /> : <Codex />}
    </div>
  );
}

/** The bag's head: its sign, how many items, what is worn, new and starred, and what it holds by rarity as one strip. */
function BagHead() {
  const s = useSave();
  const fresh = (s.newItems ?? []).length;
  const by = (['S', 'A', 'B', 'C', 'D', 'E'] as const).map((r) => [r, s.items.filter((it) => gear.defOf(it)?.rank === r).length] as const).filter(([, n]) => n > 0);
  return (
    <div class="baghead">
      <span class="baghead__icon" aria-hidden="true"><Glyph name="bag" /></span>
      <span class="baghead__count"><b class="num">{s.items.length}</b><small class="label">Items</small></span>
      <span class="baghead__facts">
        <span><small>Worn</small><b class="num">{gear.worn(s).length}</b></span>
        <span class={fresh ? 'is-new' : ''}><small>New</small><b class="num">{fresh}</b></span>
        <span><small>Starred</small><b class="num">{s.favourites.length}</b></span>
      </span>
      {by.length > 0 && (
        <span class="baghead__spread" role="img" aria-label={by.map(([r, n]) => `${rarity(r)} ${n}`).join(', ')}>
          {by.map(([r, n]) => <i key={r} data-rarity={r} style={`flex: ${n}`}><b class="num">{n}</b></i>)}
        </span>
      )}
    </div>
  );
}

const sorted = (s: Save, list: Item[], by: Sort) => {
  const order = new Map(s.items.map((x, i) => [x.id, i]));
  const rk = (it: Item) => RANKS.indexOf((gear.defOf(it)?.rank ?? 'E') as Rank);
  return list.slice().sort((a, b) => {
    if (by === 'rarity') return rk(b) - rk(a) || gear.score(b) - gear.score(a);
    if (by === 'newest') return (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0);
    if (by === 'quality') return gear.quality(b) + (b.over ?? 0) * 10 - gear.quality(a) - (a.over ?? 0) * 10 || gear.score(b) - gear.score(a);
    return gear.score(b) - gear.score(a);
  });
};

/** A piece that can go: not worn, not starred. Issued kit can go as well, once it is outgrown. */
const loose = (s: Save, it: Item) => !gear.slotOf(s, it) && !s.favourites.includes(it.id);

function Items() {
  const s = useSave();
  const [kind, setKind] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('score');
  const [only, setOnly] = useState<Only | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const count = (k: string) => s.items.filter((it) => gear.defOf(it)?.slot === k).length;
  const match = (it: Item) => {
    const d = gear.defOf(it);
    if (kind !== 'All' && d?.slot !== kind) return false;
    if (only === 'better') return gear.beatsWorn(s, it);
    if (only === 'sets') return !!d?.set;
    if (only === 'starred') return s.favourites.includes(it.id);
    return true;
  };
  const list = sorted(s, s.items.filter(match), sort);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  /** A chip of the select row: all of its pieces picked, or, tapped again while they are, none of them. */
  const toggleAll = (ids: string[], on: boolean) => setPicked((p) => (on ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
  const chosen = picked.map((id) => s.items.find((x) => x.id === id)).filter((x): x is Item => !!x && loose(s, x));
  const worth = forge.salvageOf(chosen);
  /** Every duplicate but the best of its design: what the Forge can have back. */
  const spares = () => {
    const best = new Map<string, Item>();
    for (const it of s.items) { const b = best.get(it.defId); if (!b || gear.score(it) > gear.score(b)) best.set(it.defId, it); }
    return s.items.filter((it) => loose(s, it) && best.get(it.defId)?.id !== it.id).map((x) => x.id);
  };
  const recycle = async () => {
    if (!chosen.length) return;
    const ok = await sys(system.offer([
      'Would you like to recycle these items?',
      `Items: ${chosen.length}`,
      system.gain(bundleText(worth)),
      system.red('A recycled item cannot be recovered.'),
    ], 'system', 'Recycle', 'Cancel'));
    if (ok !== true) return;
    const r = store.update((x) => forge.recycleSome(x, chosen.map((c) => c.id)));
    sfx.success();
    toast(`Recycled: ${r.count} · ${bundleText(r.got)}`, 'good');
    setPicked([]);
    setPicking(false);
  };
  return (
    <div class={`stack bag__items ${picking ? 'is-picking' : ''}`}>
      <div class="bagkinds" role="tablist" aria-label="Kind">
        {['All', ...KINDS].map((k) => (
          <button type="button" key={k} role="tab" aria-selected={kind === k} aria-label={k} title={k} class={`sysbox bagkind ${kind === k ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setKind(k); }}>
            {k === 'All' ? <Glyph name="bag" /> : <Glyph name={k} />}
            <small class="num">{k === 'All' ? s.items.length : count(k)}</small>
          </button>
        ))}
      </div>
      <div class="bagtools">
        <button type="button" class={`sysbox bagtools__sort ${menu ? 'is-on' : ''}`} aria-expanded={menu} aria-controls="bagmenu"
          onClick={() => { sfx.tap(); setMenu(!menu); }}>
          <Glyph name="swap" />
          <span class="bagtools__what"><small>Sort</small><b>{SORTS.find((x) => x.key === sort)!.name}</b></span>
          {only && <span class="bagtools__show">{ONLY.find((o) => o.key === only)!.name}</span>}
          <Glyph name="chevron" class="bagtools__chev" />
        </button>
        <button type="button" aria-pressed={picking} class={`sysbox bagtools__pick ${picking ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setPicking(!picking); setPicked([]); setSel(null); }}>
          <Glyph name={picking ? 'close' : 'trash'} /> {picking ? 'Done' : 'Select'}
        </button>
      </div>
      {menu && (
        <div class="sysbox bagmenu" id="bagmenu">
          <span class="label">Sort by</span>
          <div class="bagmenu__opts" role="radiogroup" aria-label="Sort by">
            {SORTS.map((o) => (
              <button type="button" key={o.key} role="radio" aria-checked={sort === o.key} class={`bagmenu__opt ${sort === o.key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setSort(o.key); }}>{o.name}</button>
            ))}
          </div>
          <span class="label">Show</span>
          <div class="bagmenu__opts" role="radiogroup" aria-label="Show">
            {[{ key: null, name: 'All' } as { key: Only | null; name: string }, ...ONLY].map((o) => (
              <button type="button" key={o.name} role="radio" aria-checked={only === o.key} class={`bagmenu__opt ${only === o.key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setOnly(o.key); }}>{o.name}</button>
            ))}
          </div>
        </div>
      )}
      {picking && (
        <div class="qsel">
          <span class="qsel__head">
            <span class="label">Quick select</span>
            {picked.length > 0 && <button type="button" class="qsel__clear" onClick={() => { sfx.tap(); setPicked([]); }}>Clear</button>}
          </span>
          {/* One row of equal cells, a rarity to each, then the duplicates: what can go, counted, one tap to take it all. */}
          <div class="qsel__row" role="group" aria-label="Quick select">
            {(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((r) => {
              const ids = s.items.filter((it) => gear.defOf(it)?.rank === r && loose(s, it)).map((x) => x.id);
              const on = ids.length > 0 && ids.every((id) => picked.includes(id));
              return (
                <button type="button" key={r} aria-pressed={on} disabled={!ids.length} class={`qsel__cell ${on ? 'is-on' : ''}`} data-rarity={r}
                  aria-label={`${rarity(r)}: ${ids.length}`} title={rarity(r)} onClick={() => { sfx.tap(); toggleAll(ids, on); }}>
                  <b>{r}</b><small class="num">{ids.length}</small>
                </button>
              );
            })}
            {(() => {
              const ids = spares();
              const on = ids.length > 0 && ids.every((id) => picked.includes(id));
              return (
                <button type="button" aria-pressed={on} disabled={!ids.length} class={`qsel__cell is-dupes ${on ? 'is-on' : ''}`}
                  aria-label={`Duplicates: ${ids.length}`} title="Duplicates" onClick={() => { sfx.tap(); toggleAll(ids, on); }}>
                  <b>2×</b><small class="num">{ids.length}</small>
                </button>
              );
            })()}
          </div>
        </div>
      )}
      {!list.length && <Empty>{s.items.length ? 'Nothing matches.' : 'No items yet.'}</Empty>}
      {list.length > 0 && (
        <div class="baggrid">
          {list.map((it, i) => <BagTile key={it.id} it={it} i={i} picking={picking} picked={picked.includes(it.id)} locked={!loose(s, it)} on={sel === it.id}
            onTap={() => {
              if (picking) { if (loose(s, it)) toggle(it.id); return; }
              // A card tapped is shown in the dock; tapped again, its own card opens.
              if (sel === it.id) { openItem(it.id); return; }
              if (gear.isNew(store.get(), it.id)) store.update((x) => gear.seeItem(x, it.id));
              setSel(it.id);
            }} />)}
        </div>
      )}
      {picking && (
        <div class="sysbox bagbar">
          <span class="bagbar__sum"><b class="num">{chosen.length}</b> selected<MatList b={worth} gain /></span>
          <Btn kind="danger" size="sm" disabled={!chosen.length} onClick={() => void recycle()}><Glyph name="trash" /> Recycle</Btn>
        </div>
      )}
      {picking && <small class="muted">Worn and starred items cannot be selected.</small>}
      {!picking && sel && <Peek id={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

/**
 * One card of the bag, after Genshin Impact's and Honkai: Star Rail's: the piece on its rarity's ground,
 * New and the better mark at its top, and along its foot `Worn` or the star, its score and its quality.
 */
function BagTile({ it, i, picking, picked, locked, on, onTap }: { it: Item; i: number; picking: boolean; picked: boolean; locked: boolean; on: boolean; onTap: () => void }) {
  const s = useSave();
  const d = gear.defOf(it)!;
  const worn = !!gear.slotOf(s, it);
  const up = gear.beatsWorn(s, it);
  const fresh = gear.isNew(s, it.id);
  const starred = s.favourites.includes(it.id);
  return (
    <button type="button" class={`bagtile ${picked ? 'is-picked' : ''} ${picking && locked ? 'is-locked' : ''} ${fresh ? 'is-new' : ''} ${on ? 'is-on' : ''} ${worn ? 'is-worn' : ''}`}
      data-rarity={d.rank} style={`--i: ${Math.min(i, 24)}`} aria-pressed={picking ? picked : on}
      onClick={() => { sfx.tap(); onTap(); }}
      aria-label={`${d.name}, ${rarity(d.rank)} ${d.slot}, score ${Math.round(gear.score(it))}${worn ? ', worn' : ''}${up ? ', an upgrade on what is worn' : ''}${fresh ? ', new' : ''}${starred ? ', starred' : ''}`}>
      <span class="bagtile__art"><GearArt item={it} size={60} plain /></span>
      <span class="bagtile__foot">
        {worn ? <span class="bagtile__worn">Worn</span> : starred ? <Glyph name="star" class="bagtile__fav" /> : <span />}
        <b class="num">{Math.round(gear.score(it))}</b>
      </span>
      <span class="bagtile__q" aria-hidden="true"><i style={`width: ${gear.quality(it)}%`} /></span>
      {fresh && <span class="bagtile__new">New</span>}
      {up && <span class="bagtile__up" aria-hidden="true">▲</span>}
      {picking && <span class="bagtile__check" aria-hidden="true"><Glyph name={locked ? 'lock' : 'check'} /></span>}
    </button>
  );
}

/**
 * The dock: the card tapped, held at the foot of the bag while it is browsed, as Genshin Impact and Honkai:
 * Star Rail keep the piece picked beside their grids. Its name, rarity and quality, its stats, its score and
 * what it gains on the piece worn; Equip, the star, and its own card.
 */
function Peek({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useSave();
  const it = s.items.find((x) => x.id === id);
  if (!it) return null;
  const d = gear.defOf(it)!;
  const worn = gear.slotOf(s, it);
  const other = gear.counterpart(s, it);
  const diff = gear.delta(it, other).score;
  const starred = s.favourites.includes(it.id);
  return (
    <div class="sysbox bagpeek" data-rarity={d.rank} role="region" aria-label={d.name}>
      <button type="button" class="bagpeek__art" aria-label={`${d.name}: open`} onClick={() => { sfx.tap(); openItem(id); }}><GearArt item={it} size={64} plain /></button>
      <span class="bagpeek__text">
        <b>{d.name}</b>
        <small><span class="bagpeek__kind">{rarity(d.rank)} {d.slot}</span> · Quality {gear.qualityText(it)}{worn ? ` · Worn: ${gear.SLOTS.find((x) => x.key === worn)?.name}` : ''}</small>
        <Gains parts={statParts(it)} class="gains--stats" />
      </span>
      <span class="bagpeek__score">
        <b class="num">{Math.round(gear.score(it))}</b>
        {other && <small class={`num ${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(Math.round(diff))}</small>}
      </span>
      <span class="bagpeek__acts">
        <Btn size="sm" kind="primary" class="grow" sound="success" onClick={() => {
          store.update((x) => (worn ? gear.unequip(x, worn) : gear.equip(x, it.id)));
          toast(`${d.name} ${worn ? 'stowed' : 'equipped'}.`, 'xp');
          void checkAwards();
        }}>{worn ? 'Unequip' : 'Equip'}</Btn>
        <IconBtn icon="star" on={starred} label={starred ? 'Unstar' : 'Star: kept from recycling'} onClick={() => store.update((x) => gear.toggleFav(x, it.id))} />
        <Btn size="sm" kind="ghost" class="bagpeek__more" onClick={() => openItem(id)}>Details <Glyph name="chevron" /></Btn>
        <button type="button" class="bagpeek__close" aria-label="Close" onClick={() => { sfx.tap(); onClose(); }}><Glyph name="close" /></button>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ the sets

/** Every design found, by rarity, then every set as a row by rarity: how much of it is held, worn and known. */
function Codex() {
  const s = useSave();
  return (
    <div class="stack codex">
      <Collection />
      {(['C', 'B', 'A', 'S'] as const).map((r) => {
        const sets = SETS.filter((x) => gear.setPieces(x.id)[0]?.rank === r);
        const done = sets.filter((x) => gear.heldOf(s, x.id).size >= gear.setPieces(x.id).length).length;
        return (
          <Section key={r} title={`${rarity(r)} sets`} right={<span class="num">{done}/{sets.length}</span>}>
            <div class="setrows">{sets.map((x) => <CodexRow key={x.id} set={x} />)}</div>
          </Section>
        );
      })}
    </div>
  );
}

/**
 * Every design found, as a ring: an arc to each rarity, as long as the designs of it found, round the count,
 * after the collection rings of the reference games; beside it each rarity, its count and its bar.
 */
function Collection() {
  const s = useSave();
  const all = [...gear.ALL_GEAR, ...gear.ISSUED];
  const found = new Set(s.found);
  const R = 42;
  const C = 2 * Math.PI * R;
  let at = 0;
  const rows = (['E', 'D', 'C', 'B', 'A', 'S'] as const).map((r) => {
    const of = gear.ALL_GEAR.filter((x) => x.rank === r);
    return { r, n: of.filter((x) => found.has(x.id)).length, of: of.length };
  });
  return (
    <section class="sysbox collect" aria-label={`Designs discovered: ${s.found.length} of ${all.length}`}>
      <span class="collect__ring" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} class="collect__track" />
          {rows.map(({ r, n }) => {
            const len = (n / Math.max(1, all.length)) * C;
            const el = <circle key={r} cx="50" cy="50" r={R} class="collect__arc" data-rarity={r} stroke-dasharray={`${len} ${C - len}`} stroke-dashoffset={-at} />;
            at += len;
            return el;
          })}
        </svg>
        <span class="collect__hub"><b class="num">{s.found.length}</b><small class="num">/{all.length}</small><small class="label">Designs</small></span>
      </span>
      <ul class="collect__list">
        {rows.map(({ r, n, of }) => (
          <li key={r} data-rarity={r}>
            <span>{rarity(r)}</span>
            <i class="codex__bar"><i style={`width: ${(n / Math.max(1, of)) * 100}%`} /></i>
            <b class="num">{n}<small>/{of}</small></b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A set as a row of the Sets view: its name, how many held, a square to each piece (held, a blueprint, or still to find), and what two and three pay. It opens the set. */
function CodexRow({ set }: { set: GearSet }) {
  const s = useSave();
  const pieces = gear.setPieces(set.id);
  const held = gear.heldOf(s, set.id);
  const worn = gear.setsIn(gear.worn(s)).get(set.id) ?? 0;
  const best = (d: GearDef) => s.items.filter((x) => x.defId === d.id).sort((a, b) => gear.score(b) - gear.score(a))[0];
  return (
    <button type="button" class={`sysbox setrow codexrow ${held.size >= pieces.length ? 'is-complete' : ''} ${worn >= 2 ? 'is-on' : ''} ${held.size ? '' : 'is-none'}`}
      style={`--set-h: ${gear.setHue(set.id)}`} onClick={() => { sfx.tap(); openSet(set.id); }}
      aria-label={`Set ${set.id}: ${held.size} of ${pieces.length} held${worn ? `, ${worn} worn` : ''}`}>
      <span class="setrow__head">
        <SetMark id={set.id} />
        <b>{set.id}</b>
        <small class="num codexrow__count">{held.size}/{pieces.length}{worn ? <> <span class="codexrow__worn">Worn {worn}</span></> : null}</small>
        <Glyph name="chevron" class="setrow__go" />
      </span>
      <span class="codexrow__body">
        <span class="codexrow__pieces" aria-hidden="true">
          {pieces.map((p) => {
            const it = best(p);
            const bp = forge.knows(s, p.id);
            return (
              <span key={p.id} class={`codexrow__piece ${it ? 'is-held' : bp ? 'is-known' : s.found.includes(p.id) ? 'is-seen' : ''}`}>
                {it ? <GearArt item={it} size={34} /> : <Glyph name={bp ? 'blueprint' : s.found.includes(p.id) ? p.slot : 'unknown'} />}
              </span>
            );
          })}
        </span>
        <span class="codexrow__bonus">
          <span class={`setrow__bonus ${worn >= 2 ? 'is-on' : ''}`}><b class="pc">2-piece</b><Gains parts={bonusParts(set.two)} /></span>
          <span class={`setrow__bonus ${worn >= 3 ? 'is-on' : ''}`}><b class="pc">3-piece</b><Gains parts={bonusParts(set.three)} /></span>
        </span>
      </span>
    </button>
  );
}

/** A set: its pieces, held, worn, known as blueprints or still to find, what two and three of them pay, and its home Gate. */
export function SetCard({ set, compact }: { set: GearSet; compact?: boolean }) {
  const s = useSave();
  const pieces = gear.setPieces(set.id);
  const held = gear.heldOf(s, set.id);
  const worn = gear.setsIn(gear.worn(s)).get(set.id) ?? 0;
  const home = dungeonById(set.home);
  const best = (d: GearDef) => s.items.filter((x) => x.defId === d.id).sort((a, b) => gear.score(b) - gear.score(a))[0];
  return (
    <div class={`sysbox setcard ${held.size >= pieces.length ? 'is-complete' : ''} ${worn >= 2 ? 'is-on' : ''}`} style={`--set-h: ${gear.setHue(set.id)}`}>
      {!compact && (
        <header class="setcard__head">
          <span class="setcard__name"><SetMark id={set.id} /><strong>[Set: {set.id}]</strong></span>
          <span class="num">{held.size}/{pieces.length}{worn ? ` · Worn ${worn}` : ''}</span>
        </header>
      )}
      <div class="setcard__pieces">
        {pieces.map((p) => {
          const it = best(p);
          const on = it && gear.slotOf(s, it);
          const bp = forge.knows(s, p.id);
          const seen = bp || s.found.includes(p.id);
          return (
            <button type="button" key={p.id} class={`setpiece ${it ? 'is-held' : bp ? 'is-known' : seen ? 'is-seen' : 'is-unknown'} ${on ? 'is-worn' : ''}`} disabled={!it && !bp}
              onClick={() => { sfx.tap(); if (it) openItem(it.id); else if (bp) openBlueprint(p.id); }}
              aria-label={`${p.name}${it ? on ? ', worn' : ', held' : bp ? ', blueprint known' : ', not held'}`}>
              {it ? <GearArt item={it} size={46} /> : <span class="setpiece__ghost"><Glyph name={bp ? 'blueprint' : seen ? p.slot : 'unknown'} /></span>}
              <small>{seen ? p.name : '-- --'}</small>
            </button>
          );
        })}
      </div>
      <div class={`setbonus ${worn >= 2 ? 'is-on' : ''}`}><b class="pc">2-piece</b><Gains parts={bonusParts(set.two)} /></div>
      <div class={`setbonus ${worn >= 3 ? 'is-on' : ''}`}><b class="pc">3-piece</b><Gains parts={bonusParts(set.three)} /></div>
      {home && <small class="setcard__home"><Glyph name="gates" /> {home.name} · {home.rank}-Rank</small>}
    </div>
  );
}

// ------------------------------------------------------------------ the piece

/** ITEM: a piece of gear, on its own sheet. Opening it is looking at it: it is New no more. */
export function openItem(id: string) {
  const at = store.get().items.find((x) => x.id === id);
  const named = at ? gear.defOf(at) : undefined;
  if (at && gear.isNew(store.get(), id)) store.update((x) => gear.seeItem(x, id));
  const close = openSheet({
    title: `Item: ${named?.name ?? 'Unknown'}`,
    system: { icon: null, kind: 'gear' },
    render: () => <ItemCard id={id} close={close} />,
  });
}

/**
 * A piece shown off at the head of its card: its art large in its rarity's light, its rarity and kind,
 * its tags, its score and what it gains over the piece it would replace, and a foot (its quality).
 * The blueprint's card (`screens/Forge.tsx`) is headed the same way.
 */
export function PieceHero({ d, art, tags, score, vs, foot }: { d: GearDef; art: ComponentChildren; tags?: ComponentChildren; score: ComponentChildren; vs?: ComponentChildren; foot?: ComponentChildren }) {
  return (
    <section class="sysbox piecehero" data-rarity={d.rank}>
      <span class="piecehero__art">{art}</span>
      <div class="piecehero__who">
        <span class="piecehero__kind"><RankPlate rank={d.rank} size={18} />{rarity(d.rank)} {d.slot}</span>
        {tags && <span class="piecehero__tags">{tags}</span>}
        <span class="piecehero__score"><span class="label">Score</span><span class="piecehero__n">{score}{vs}</span></span>
      </div>
      {foot && <div class="piecehero__foot">{foot}</div>}
    </section>
  );
}

/** Another piece, as a row that opens its card: the worn piece a piece is set against. */
export function PieceLink({ it, label }: { it: Item; label: string }) {
  const d = gear.defOf(it);
  return (
    <button type="button" class="sysbox piecelink" data-rarity={d?.rank} onClick={() => { sfx.tap(); openItem(it.id); }}>
      <GearArt item={it} size={38} />
      <span class="piecelink__text"><span class="label">{label}</span><span class="piecelink__name">{d?.name}</span></span>
      <b class="num">{Math.round(gear.score(it))}</b>
      <Glyph name="chevron" class="piecelink__go" />
    </button>
  );
}

function ItemCard({ id, close }: { id: string; close: () => void }) {
  const s = useSave();
  const it = s.items.find((x) => x.id === id);
  if (!it) return <Empty>That item is gone.</Empty>;
  const d = gear.defOf(it)!;
  const worn = gear.slotOf(s, it);
  const other = gear.counterpart(s, it);
  const diff = gear.delta(it, other);
  const tag = gear.rollTag(it);
  const set = d.set ? setById(d.set) : undefined;
  const starred = s.favourites.includes(it.id);
  const recycle = async () => {
    const back = forge.salvage(it);
    const ok = await sys(system.offer([
      'Would you like to recycle this item?',
      `${system.tag(d.name, 'Item')} Quality ${gear.qualityText(it)}`,
      system.gain(bundleText(back)),
      system.red('A recycled item cannot be recovered.'),
    ], 'gear', 'Recycle', 'Cancel'));
    if (ok !== true) return;
    const got = store.update((x) => forge.recycle(x, it.id));
    if (!got) return;
    sfx.success();
    toast(`${d.name} recycled · ${bundleText(got)}`, 'good');
    close();
  };
  return (
    <div class="stack itemcard" data-rarity={d.rank}>
      <PieceHero d={d} art={<GearArt item={it} size={104} />}
        tags={<>
          {worn && <span class="itag is-worn">Worn · {gear.SLOTS.find((x) => x.key === worn)?.name}</span>}
          {d.set && <span class="itag is-set" style={`--set-h: ${gear.setHue(d.set)}`}><SetMark id={d.set} />{d.set}</span>}
          {tag === 'perfect' && <span class="itag is-perfect">✦ Perfect{it.over ? ` +${it.over}` : ''}</span>}
          {tag === 'peak' && <span class="itag is-perfect">✧ Perfect quality</span>}
          {tag === 'dead' && <span class="itag is-dead">✕ Lowest roll</span>}
          {it.master && <span class="itag is-master">Masterwork</span>}
          {d.issued && <span class="itag">Issued</span>}
        </>}
        score={<b class="num">{Math.round(gear.score(it))}</b>}
        vs={other && <span class={`piecehero__vs num ${diff.score > 0 ? 'is-up' : diff.score < 0 ? 'is-down' : ''}`}>{diff.score > 0 ? '▲' : diff.score < 0 ? '▼' : '='} {Math.abs(Math.round(diff.score))}</span>}
        foot={!d.issued && <QualityLine it={it} />} />
      {other && <PieceLink it={other} label="Compared with" />}
      <div class="pieceacts">
        <Btn kind="primary" class="grow" sound="success" onClick={() => {
          store.update((x) => (worn ? gear.unequip(x, worn) : gear.equip(x, it.id)));
          toast(`${d.name} ${worn ? 'stowed' : 'equipped'}.`, 'xp');
          void checkAwards();
        }}>{worn ? 'Unequip' : 'Equip'}</Btn>
        <IconBtn icon="star" on={starred} label={starred ? 'Unstar' : 'Star: kept from recycling'} onClick={() => store.update((x) => gear.toggleFav(x, it.id))} />
        {!worn && !starred && <IconBtn icon="trash" label="Recycle" onClick={() => void recycle()} />}
      </div>
      <section class="sysbox piecepanel">
        <span class="label">Stats</span>
        <ul class="itemstats">
          {gear.coreLines(it).map(([k, t]) => {
            const v = diff.core[k];
            return (
              <li key={k}>
                <Glyph name={STAT_ICON[k]} />
                <span>{t}</span>
                {other && v !== undefined && <small class={`num ${v > 0 ? 'is-up' : 'is-down'}`}>{v > 0 ? '▲' : '▼'} {signed(v)}</small>}
              </li>
            );
          })}
          {other && (STATS.filter((k) => !gear.coreOf(it)[k] && diff.core[k]) as Stat[]).map((k) => (
            <li key={`x${k}`} class="is-lost"><Glyph name={STAT_ICON[k]} /><span>{k} +0</span><small class="num is-down">▼ {signed(diff.core[k]!)}</small></li>
          ))}
        </ul>
        {(d.rolls ?? []).length > 0 && (
          <>
            <span class="label">Properties</span>
            <ul class="itemrolls">
              {(d.rolls ?? []).map((r, k) => {
                const v = it.rolls[k] ?? r.min;
                const at = r.max > r.min ? (v - r.min) / (r.max - r.min) : 1;
                return (
                  <li key={r.stat}>
                    <span class="itemrolls__name">{(([n, v]) => <>{n} <b class="num">{v}</b></>)(nameAndValue(gear.rollText(it)[k]))}</span>
                    <i class={`itemrolls__bar ${at >= 1 ? 'is-full' : ''}`} aria-hidden="true"><i style={`width: ${unit(at) * 100}%`} />{at > 1 && <b style={`width: ${Math.min(1, at - 1) * 100}%`} />}</i>
                    <small class="num muted">{r.min}-{r.max}{r.pct ? '%' : ''}</small>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {d.desc && <p class="itemcard__text">{d.desc}</p>}
        {it.master && <p class="itemcard__text hint">Masterwork of {walkerOf(it.master, d.rank).name}.</p>}
      </section>
      {!d.issued && <Upgrade it={it} />}
      {d.slot === 'Weapon' && !d.issued && <Familiarity defId={d.id} />}
      {set && (
        <Section title={`Set: ${set.id}`} right={<span class="num">{gear.heldOf(s, set.id).size}/{gear.setPieces(set.id).length}{gear.setsIn(gear.worn(s)).get(set.id) ? ` · Worn ${gear.setsIn(gear.worn(s)).get(set.id)}` : ''}</span>}>
          <SetCard set={set} compact />
        </Section>
      )}
      {!d.issued && forge.knows(s, d.id) && (
        <button type="button" class="sysbox piecelink piecelink--forge" onClick={() => { sfx.tap(); openBlueprint(d.id); }}>
          <span class="piecelink__icon"><Glyph name="forge" /></span>
          <span class="piecelink__text"><span class="label">Blueprint</span><span class="piecelink__name">Forge another</span></span>
          <Glyph name="chevron" class="piecelink__go" />
        </button>
      )}
    </div>
  );
}

/** A piece's quality, at the foot of its card: where it rolled between its design's worst and best, the steps still to its best, and any past it. */
function QualityLine({ it }: { it: Item }) {
  const s = useSave();
  const q = gear.quality(it);
  const left = gear.stepsToPerfect(it);
  const cap = overCap(s);
  return (
    <span class="pieceq">
      <span class="label">Quality</span>
      <b class="num">{q}%</b>
      <i class="pieceq__bar" aria-hidden="true">
        <i style={`width: ${q}%`} />
        {[25, 50, 75].map((m) => <span key={m} class="pieceq__tick" style={`left: ${m}%`} />)}
      </i>
      <small class="num">{left ? `Steps to perfect: ${left}` : it.over ? `Perfect +${it.over}` : 'Perfect'}</small>
      {cap > 0 && !left && (
        <span class="pieceq__over" aria-label={`Past perfect: ${it.over ?? 0} of ${cap}`}>
          {Array.from({ length: cap }, (_, i) => <i key={i} class={i < (it.over ?? 0) ? 'is-on' : ''} />)}
        </span>
      )}
    </span>
  );
}

/** The next upgrade step on a piece: what it raises, before and after side by side, and the alloys and shards it takes. */
function Upgrade({ it }: { it: Item }) {
  const s = useSave();
  const cap = overCap(s);
  const next = gear.upgradeStep(it, cap);
  const cost = forge.upgradeCost(it, cap);
  if (!next || !cost) {
    const over = it.over ?? 0;
    return <p class="hint">{!ascensionOpen(s) ? 'Perfect. Nothing left to raise.'
      : `Perfect${over ? ` +${over}` : ''}. Each Ascension level opened allows ${OVERCHARGE.per === 1 ? '1 more step' : `${OVERCHARGE.per} more steps`}.`}</p>;
  }
  const ok = forge.affords(s, cost);
  return (
    <Section title={next.over ? 'Past perfect' : 'Upgrade'} right={it.up ? <span class="num">Steps taken: {it.up}</span> : <Shards n={cost.shards} />}>
      <div class="sysbox pieceup">
        <span class="pieceup__pair">
          <span class="pieceup__one"><span class="label">Quality</span><b class="num">{gear.qualityText(it)}<Glyph name="chevron" /><span class="pieceup__to">{gear.qualityText(next)}</span></b></span>
          <span class="pieceup__one"><span class="label">Score</span><b class="num">{Math.round(gear.score(it))}<Glyph name="chevron" /><span class="pieceup__to">{Math.round(gear.score(next))}</span></b></span>
        </span>
        <CostGrid s={s} c={cost} />
        <Btn kind="gold" disabled={!ok} onClick={() => {
          if (!store.update((x) => forge.upgrade(x, it.id, cap))) return;
          sfx.success();
          buzz([14, 24]);
          toast(`${gear.defOf(it)?.name} upgraded.`, 'good');
          void checkAwards();
        }}>{ok ? <>Upgrade · <Shards n={cost.shards} /></> : s.wallet.shards < cost.shards ? `Mana Shards ${group(s.wallet.shards)}/${group(cost.shards)}` : 'Materials missing'}</Btn>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ what is worn

/** EQUIPMENT: what is worn, on the hunter's figure, what it adds, the sets it makes, and the loadouts. */
export function openEquipment() {
  openSheet({ title: 'Equipment', system: { icon: null, kind: 'gear' }, render: () => <Equipment /> });
}

/**
 * The hunter's figure, wearing what is worn: each slot's part of it (the head, the chest, both arms and
 * hands, the legs, the feet, the pendant, a ring on each hand, the sword in one hand and the shield at the other)
 * filled in the piece's rarity, dashed while the slot is empty; the slot pointed at glows white.
 */
export function Avatar({ s, hot }: { s: Save; hot: SlotKey | null }) {
  const at = (k: SlotKey, held = false) => {
    const it = gear.equippedIn(s, k);
    const r = it ? gear.defOf(it)?.rank : undefined;
    return { class: `av ${held ? 'av--held' : ''} ${r ? 'is-on' : ''} ${hot === k ? 'is-hot' : ''}`, style: r ? `--rc: var(--rank-${r})` : undefined };
  };
  return (
    <svg viewBox="6 0 128 226" class="avatar">
      <defs>
        <linearGradient id="avscan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0" /><stop offset="0.5" stop-color="currentColor" stop-opacity="0.5" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient>
      </defs>
      <g class="figure__grid">{[46, 92, 138, 184].map((y) => <line key={y} x1="6" x2="134" y1={y} y2={y} />)}</g>
      {/* The ground the hunter stands on. */}
      <ellipse class="avatar__ground" cx="70" cy="212" rx="40" ry="8" />
      <ellipse class="avatar__ground avatar__ground--in" cx="70" cy="212" rx="27" ry="4.6" />
      {/* What is held sits behind the hand that holds it. */}
      <g {...at('offhand', true)}><path d="M9 97 Q20 92 31 97 L30 116 Q26 128 20 134 Q14 128 10 116 Z" /><path class="av__line" d="M20 99 V129 M13 108 H27" /></g>
      <g {...at('weapon', true)}>
        <circle cx="105.5" cy="105" r="2.2" /><rect x="104.3" y="106.5" width="2.4" height="9" />
        <path d="M98 121 H113 L112 124 H99 Z" /><path d="M103 124 H108 L107.2 188 L105.5 196 L103.8 188 Z" /><path class="av__line" d="M105.5 128 V184" />
      </g>
      <g class="av-base"><path d="M65 33 H75 L76 44 H64 Z" /></g>
      {/* The arms are the hands' part, as gauntlets run up them: behind the chest, so the shoulders sit under it. */}
      <g {...at('hands')}>
        <path d="M47 48 L40 54 L34 84 L31 110 L38 111 L42 88 L50 64 Z" />
        <path d="M93 48 L100 54 L106 84 L109 110 L102 111 L98 88 L90 64 Z" />
      </g>
      <g {...at('legs')}><path d="M56 102 H69 L68 150 L66 199 H57 L56 150 Z" /><path d="M71 102 H84 L84 150 L83 199 H74 L72 150 Z" /></g>
      <g {...at('feet')}><path d="M56 199 H66 L67 211 H49 Q50 204 56 199 Z" /><path d="M84 199 H74 L73 211 H91 Q90 204 84 199 Z" /></g>
      <g {...at('chest')}><path d="M47 47 Q70 39 93 47 L91 62 L86 76 L84 102 L56 102 L54 76 L49 62 Z" /><path class="av__line" d="M70 50 V98 M58 75 H82" /></g>
      <g {...at('head')}><ellipse cx="70" cy="21" rx="11" ry="12.5" /><path class="av__line" d="M61 22 H79" /></g>
      <g {...at('amulet', true)}><path class="av__chain" d="M60 46 Q70 55 80 46" /><path d="M70 52 L74 57 L70 63 L66 57 Z" /></g>
      <g {...at('hands')}><path d="M30 109 H39 L40 119 Q38.5 124.5 34.5 124.5 Q30.5 124.5 29.3 119.5 Z" /><path d="M110 109 H101 L100 119 Q101.5 124.5 105.5 124.5 Q109.5 124.5 110.7 119.5 Z" /></g>
      <g {...at('ring2', true)}><circle class="av__ring" cx="36.5" cy="121" r="2" /></g>
      <g {...at('ring1', true)}><circle class="av__ring" cx="103.5" cy="121" r="2" /></g>
      <rect x="6" y="0" width="128" height="40" fill="url(#avscan)" class="figure__scan" />
    </svg>
  );
}

/** Bonuses side by side with space between them, no dot: `PER +4.6   AGI +2.3`. */
export function Gains({ parts, class: cls }: { parts: string[]; class?: string }) {
  return <span class={`gains ${cls ?? ''}`}>{parts.map((p, i) => <span key={i}>{p}</span>)}</span>;
}
const statParts = (it: Item) => gear.coreLines(it).map(([, t]) => t);
const bonusParts = (b: Record<string, number>) => gear.bonusText(b).split(' · ');

/** A bonus in words, its name and its value apart: `Effect chance +26.7` is `Effect chance` and `+26.7`. */
const nameAndValue = (t: string): [string, string] => {
  const i = t.lastIndexOf(' ');
  return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, ''];
};

function Equipment() {
  const s = useSave();
  const ups = gear.upgradeCount(s);
  const plan = gear.autoPlan(s);
  const offers = gear.offers(s);
  const items = gear.worn(s);
  const core = gear.boosted({ STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 }, items, {}, 999);
  const extra = gear.sumBonuses(gear.rollBonuses(items), gear.setBonuses(items));
  const props = Object.keys(extra).length ? gear.bonusText(extra).split(' · ').map(nameAndValue) : [];
  const sets = [...gear.setsIn(items)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const paying = new Set(sets.filter(([, n]) => n >= 2).map(([id]) => id));
  const [hot, setHot] = useState<SlotKey | null>(null);
  const slot = (k: SlotKey) => {
    const it = gear.equippedIn(s, k);
    const def = gear.SLOTS.find((x) => x.key === k)!;
    const d = it ? gear.defOf(it) : undefined;
    const set = d?.set && paying.has(d.set) ? d.set : null;
    // Something held would serve here better: Auto Equip would change this slot.
    const better = !!it && !!plan[k];
    const offer = !it && offers.includes(k);
    return (
      <button type="button" key={k} class={`pslot is-${def.side} ${it ? 'is-filled' : ''} ${set ? 'is-set' : ''} ${better || offer ? 'is-better' : ''}`} style={set ? `--set-h: ${gear.setHue(set)}` : undefined}
        onClick={() => { sfx.tap(); openSlot(k); }}
        onPointerEnter={() => setHot(k)} onPointerLeave={() => setHot((h) => (h === k ? null : h))} onFocus={() => setHot(k)} onBlur={() => setHot((h) => (h === k ? null : h))}
        aria-label={`${def.name}: ${d?.name ?? 'empty'}${better ? ', an upgrade is held' : offer ? ', something held fits' : ''}`}>
        <span class="pslot__box">
          {it ? <GearArt item={it} size={56} /> : <span class="pslot__ghost"><Glyph name={def.accepts} /></span>}
          {better && <span class="pslot__up" aria-hidden="true">▲</span>}
          {offer && <span class="badge badge--gold pslot__plus" aria-hidden="true">+</span>}
        </span>
        <small class="pslot__name">{def.name}</small>
        <i class="pslot__q" aria-hidden="true">{it && !d?.issued && <i style={`width: ${gear.quality(it)}%`} />}</i>
      </button>
    );
  };
  const auto = () => {
    const n = store.update(gear.autoEquip);
    sfx.success();
    buzz([16, 26, 22]);
    toast(`${n} slot${n === 1 ? '' : 's'} improved.`, 'good');
    void checkAwards();
  };
  return (
    <div class="stack armory">
      <section class="sysbox gearhead">
        <span class="gearhead__gem"><b class="num">{Math.round(gear.power(s))}</b></span>
        <span class="gearhead__what">
          <span class="label">Equipment score</span>
          <span class="gearhead__pips" aria-hidden="true">{gear.SLOTS.map((x) => <i key={x.key} class={s.equipped[x.key] ? 'is-on' : ''} />)}</span>
          <small class="num">Slots: {items.length}/{gear.SLOTS.length}</small>
        </span>
      </section>
      <div class="paperdoll">
        <div class="paperdoll__col">{gear.SLOTS.filter((x) => x.side === 'l').map((x) => slot(x.key))}</div>
        <div class="paperdoll__fig" aria-hidden="true">
          <span class="paperdoll__aura" />
          <Avatar s={s} hot={hot} />
        </div>
        <div class="paperdoll__col">{gear.SLOTS.filter((x) => x.side === 'r').map((x) => slot(x.key))}</div>
      </div>
      <div class="gearacts">
        <Btn kind={ups ? 'gold' : 'ghost'} disabled={!ups} onClick={auto}><Glyph name="up" /> Auto Equip{ups ? <b class="num gearacts__n">{ups}</b> : null}</Btn>
        <Btn kind="ghost" onClick={() => openInventory()}><Glyph name="bag" /> Item Bag <b class="num gearacts__n">{s.items.length}</b></Btn>
      </div>
      <Section title="Stats">
        <div class="sysbox gearstats">
          <span class="gearstats__core">
            {STATS.map((k) => <span key={k} class={core[k] ? '' : 'is-none'}><Glyph name={STAT_ICON[k]} /><small>{k}</small><b class="num">+{Math.round(core[k])}</b></span>)}
          </span>
          {props.length > 0 && (
            <>
              <span class="label">Properties</span>
              <ul class="gearstats__props">
                {props.map(([k, v]) => <li key={k}><small>{k}</small><b class="num">{v}</b></li>)}
              </ul>
            </>
          )}
        </div>
      </Section>
      {sets.length > 0 && (
        <Section title="Sets worn" right={<span class="num">Paying: {paying.size}</span>}>
          <div class="setrows">{sets.map(([id, n]) => <SetRow key={id} id={id} n={n} />)}</div>
        </Section>
      )}
      <Loadouts />
    </div>
  );
}

/** A set worn, as a row: its mark and name, a pip to each piece worn, and what two and three pay, lit once worn. It opens the set. */
function SetRow({ id, n }: { id: string; n: number }) {
  const set = setById(id);
  if (!set) return null;
  const all = gear.setPieces(id).length;
  return (
    <button type="button" class={`sysbox setrow ${n >= 2 ? 'is-on' : ''}`} style={`--set-h: ${gear.setHue(id)}`} onClick={() => { sfx.tap(); openSet(id); }}
      aria-label={`Set ${id}: ${n} of ${all} worn`}>
      <span class="setrow__head">
        <SetMark id={id} />
        <b>{id}</b>
        <span class="setrow__pips" aria-hidden="true">{Array.from({ length: all }, (_, i) => <i key={i} class={i < n ? 'is-on' : ''} />)}</span>
        <small class="num">{n}/{all}</small>
        <Glyph name="chevron" class="setrow__go" />
      </span>
      <span class={`setrow__bonus ${n >= 2 ? 'is-on' : ''}`}><b class="pc">2-piece</b><Gains parts={bonusParts(set.two)} /></span>
      <span class={`setrow__bonus ${n >= 3 ? 'is-on' : ''}`}><b class="pc">3-piece</b><Gains parts={bonusParts(set.three)} /></span>
    </button>
  );
}

/** SET: one set on its own: its pieces held, worn, known or still to find, what it pays, and its home Gate. */
function openSet(id: string) {
  const set = setById(id);
  if (!set) return;
  openSheet({ title: `Set: ${id}`, system: { icon: null, kind: 'gear' }, render: () => <SetCard set={set} compact /> });
}

/** The loadouts: what was worn, saved, and worn again in one tap, a row to each. */
function Loadouts() {
  const s = useSave();
  const marks = ['I', 'II', 'III'];
  const save = async (i: number) => {
    if (s.loadouts?.[i] && !(await sys(system.offer([`Would you like to save what is worn as ${system.tag(`Loadout ${marks[i]}`)}?`, system.red('What it holds now is replaced.')], 'gear', 'Save', 'Cancel')))) return;
    store.update((x) => gear.saveLoadout(x, i));
    sfx.success();
    toast(`Loadout ${marks[i]} saved.`, 'good');
  };
  const wear = (i: number) => {
    const n = store.update((x) => gear.wearLoadout(x, i));
    sfx.success();
    buzz([12, 30, 18]);
    toast(n ? `Loadout ${marks[i]} worn · Slots changed: ${n}` : `Loadout ${marks[i]} worn.`, 'good');
    void checkAwards();
  };
  return (
    <Section title="Loadouts">
      <ul class="loadrows">
        {Array.from({ length: gear.LOADOUTS }, (_, i) => {
          const l = s.loadouts?.[i] ?? null;
          const on = gear.wearing(s, l);
          const held = l ? gear.loadoutHeld(s, l) : null;
          const score = held ? Object.values(held.held).reduce((n, x) => n + gear.score(x!), 0) : 0;
          return (
            <li key={i} class={`sysbox loadrow ${l ? '' : 'is-empty'} ${on ? 'is-on' : ''}`}>
              <span class="loadrow__mark" aria-hidden="true"><b>{marks[i]}</b></span>
              <span class="loadrow__body">
                <span class="loadrow__name">Loadout {marks[i]}{on && <span class="loadrow__on">Worn</span>}</span>
                {l && held ? (
                  <>
                    <span class="loadrow__pips" aria-hidden="true">{gear.SLOTS.map((sl) => <i key={sl.key} class={held.held[sl.key] ? 'is-on' : l.slots[sl.key] ? 'is-gone' : ''} />)}</span>
                    <small class="num">Score {Math.round(score)}{held.missing ? ` · Missing: ${held.missing}` : ''}</small>
                  </>
                ) : <small class="muted">-- --</small>}
              </span>
              <span class="loadrow__acts">
                {l && !on && <Btn size="sm" kind="primary" onClick={() => wear(i)}>Wear</Btn>}
                <Btn size="sm" kind="ghost" onClick={() => void save(i)}>{l ? 'Save' : 'Save Worn'}</Btn>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * EQUIPMENT: one slot. What is worn there, then everything held that fits it, best first, each with what
 * it gains or loses on the piece worn and its Equip; Auto Equip's own pick for the slot in gold.
 */
function openSlot(k: SlotKey) {
  const slot = gear.SLOTS.find((x) => x.key === k)!;
  const close = openSheet({
    title: `Equipment: ${slot.name}`, system: { icon: null, kind: 'gear' }, render: () => <SlotWindow k={k} close={() => close()} />,
  });
}

function SlotWindow({ k, close }: { k: SlotKey; close: () => void }) {
  const s = useSave();
  const slot = gear.SLOTS.find((x) => x.key === k)!;
  const on = gear.equippedIn(s, k);
  const d = on ? gear.defOf(on) : undefined;
  const pick = gear.autoPlan(s)[k];
  // Everything held that fits, but what is worn here. A ring worn in the other ring slot moves across.
  const list = s.items.filter((it) => gear.defOf(it)?.slot === slot.accepts && it.id !== on?.id).sort((a, b) => gear.score(b) - gear.score(a));
  const wear = (it: Item) => {
    store.update((x) => gear.equip(x, it.id, k));
    sfx.success();
    buzz([12, 22]);
    toast(`${gear.defOf(it)?.name} equipped.`, 'xp');
    close();
    void checkAwards();
  };
  return (
    <div class="stack slotwin">
      <section class={`sysbox slotworn ${on ? '' : 'is-empty'}`} data-rarity={d?.rank}>
        <span class="slotworn__head">
          <span class="label">Worn</span>
          {on && d && <Btn size="sm" kind="ghost" onClick={() => { store.update((x) => gear.unequip(x, k)); toast(`${d.name} stowed.`, 'xp'); close(); }}>Unequip</Btn>}
        </span>
        {on && d ? (
          <>
            <button type="button" class="slotworn__open" onClick={() => { sfx.tap(); openItem(on.id); }} aria-label={`${d.name}: open`}>
              <GearArt item={on} size={64} />
              <span class="slotworn__text">
                <b>{d.name}</b>
                <small>{rarity(d.rank)} {d.slot} · Quality {gear.qualityText(on)}</small>
                <Gains parts={statParts(on)} class="gains--stats" />
              </span>
              <Glyph name="chevron" class="slotworn__go" />
            </button>
          </>
        ) : <span class="slotworn__none"><span class="pslot__ghost"><Glyph name={slot.accepts} /></span>-- --</span>}
      </section>
      <Section title="Held" right={<span class="num">{list.length}</span>}>
        {list.length ? (
          <ul class="slotpick">
            {list.map((it) => {
              const pd = gear.defOf(it)!;
              const diff = on ? gear.delta(it, on).score : 0;
              const elsewhere = gear.slotOf(s, it);
              return (
                <li key={it.id} class={`sysbox slotrow ${pick === it.id ? 'is-pick' : ''}`} data-rarity={pd.rank}>
                  <button type="button" class="slotrow__open" onClick={() => { sfx.tap(); openItem(it.id); }}
                    aria-label={`${pd.name}, score ${Math.round(gear.score(it))}${on ? `, ${diff >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(diff))}` : ''}: open`}>
                    <GearArt item={it} size={48} equipped={!!elsewhere} />
                    <span class="slotrow__text">
                      <b>{pd.name}{s.favourites.includes(it.id) && <Glyph name="star" class="fav" />}</b>
                      <small>{rarity(pd.rank)} · Quality {gear.qualityText(it)}</small>
                      <Gains parts={statParts(it)} class="gains--stats" />
                    </span>
                    <span class="slotrow__score">
                      <b class="num">{Math.round(gear.score(it))}</b>
                      {on && <small class={`num ${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}`}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(Math.round(diff))}</small>}
                    </span>
                  </button>
                  <Btn size="sm" kind={pick === it.id ? 'gold' : 'primary'} onClick={() => wear(it)}>Equip</Btn>
                </li>
              );
            })}
          </ul>
        ) : <Empty>Items held: 0</Empty>}
      </Section>
    </div>
  );
}
