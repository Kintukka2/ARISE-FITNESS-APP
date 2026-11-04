/**
 * The hunter's gear, in the System's frame: the bag (`INVENTORY`), every set and design found (its Sets
 * view), the piece itself (`ITEM: {name}`), and what is worn (`EQUIPMENT`), on a figure, with loadouts.
 * Every number comes from `core/gear.ts` and `core/shop.ts`; the screens only show and ask.
 */
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import { ascensionOpen, overCap } from '@/core/ascension';
import { walkerOf } from '@/core/walkers';
import { OVERCHARGE } from '@/data/ascension';
import { dungeonById } from '@/core/gates';
import { licensedRank } from '@/core/licence';
import { rankOf } from '@/core/progression';
import * as shop from '@/core/shop';
import type { GearDef, Item, Rank, Save, SlotKey, Stat } from '@/core/types';
import { RANKS, STATS } from '@/core/types';
import { group } from '@/core/util';
import { FUSE, setById, SETS, type GearSet } from '@/data/sets';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import * as system from '@/ui/system';
import { Btn, Empty, GearArt, IconBtn, RankPlate, Section, SetMark, Shards } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, STAT_ICON, Sigil } from '@/ui/icons';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';

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
type Only = 'better' | 'sets' | 'starred' | 'fuse';
const ONLY: { key: Only; name: string }[] = [
  { key: 'better', name: 'Better' }, { key: 'fuse', name: 'Fusable' }, { key: 'sets', name: 'Set pieces' }, { key: 'starred', name: 'Starred' },
];

/** INVENTORY: everything held, a square each, or every set and design found. */
export function openInventory(view: View = 'items') {
  openSheet({ title: 'Inventory', system: { icon: null, kind: 'gear' }, render: () => <Bag initial={view} /> });
}

function Bag({ initial }: { initial: View }) {
  const s = useSave();
  const [view, setView] = useState<View>(initial);
  // Leaving the bag is looking at it: nothing in it is New after.
  useEffect(() => () => { if ((store.get().newItems ?? []).length) store.update(gear.seeAllItems); }, []);
  const complete = SETS.filter((x) => gear.heldOf(s, x.id).size >= gear.setPieces(x.id).length).length;
  return (
    <div class="stack bag">
      <div class="bag__head">
        <span><b class="num">{s.items.length}</b><small>Items</small></span>
        <span class={(s.newItems ?? []).length ? 'is-new' : ''}><b class="num">{(s.newItems ?? []).length}</b><small>New</small></span>
        <span><b class="num">{s.found.length}</b><small>Designs</small></span>
        <span><b class="num"><Shards n={s.wallet.shards} /></b><small>Mana Shards</small></span>
      </div>
      <div class="seg bag__views" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'items'} class={`seg__btn ${view === 'items' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('items'); }}>Items</button>
        <button type="button" role="tab" aria-selected={view === 'sets'} class={`seg__btn ${view === 'sets' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('sets'); }}>Sets · {complete}/{SETS.length}</button>
      </div>
      {view === 'items' ? <Items /> : <Codex />}
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

/** A piece that can go: not worn, not issued, not starred. */
const loose = (s: Save, it: Item) => !gear.slotOf(s, it) && !gear.defOf(it)?.issued && !s.favourites.includes(it.id);

function Items() {
  const s = useSave();
  const [kind, setKind] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('score');
  const [only, setOnly] = useState<Only | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const count = (k: string) => s.items.filter((it) => gear.defOf(it)?.slot === k).length;
  const match = (it: Item) => {
    const d = gear.defOf(it);
    if (kind !== 'All' && d?.slot !== kind) return false;
    if (only === 'better') return gear.beatsWorn(s, it);
    if (only === 'sets') return !!d?.set;
    if (only === 'starred') return s.favourites.includes(it.id);
    if (only === 'fuse') return gear.fodderFor(s, it).length > 0 && gear.stepsToPerfect(it) > 0;
    return true;
  };
  const list = sorted(s, s.items.filter(match), sort);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const chosen = picked.map((id) => s.items.find((x) => x.id === id)).filter((x): x is Item => !!x && loose(s, x));
  const worth = chosen.reduce((n, it) => n + shop.scrapValue(it), 0);
  /** Every duplicate but the best of its design: what fusion or the Exchange would take. */
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
      `Mana Shards ${system.gain(`+${group(worth)}`)}`,
      system.red('A recycled item cannot be recovered.'),
    ], 'system', 'Recycle', 'Cancel'));
    if (ok !== true) return;
    const r = store.update((x) => shop.recycleSome(x, chosen.map((c) => c.id)));
    sfx.success();
    toast(`Recycled: ${r.count} · Mana Shards +${r.paid}`, 'good');
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
        <div class="bagtools__row">
        <button type="button" class="sysbox bagtools__sort" onClick={() => { sfx.tap(); setSort(SORTS[(SORTS.findIndex((x) => x.key === sort) + 1) % SORTS.length].key); }}>
          <Glyph name="swap" /> Sort: {SORTS.find((x) => x.key === sort)!.name}
        </button>
        {ONLY.map((o) => (
          <button type="button" key={o.key} aria-pressed={only === o.key} class={`sysbox bagtools__only ${only === o.key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setOnly(only === o.key ? null : o.key); }}>{o.name}</button>
        ))}
        </div>
        <button type="button" aria-pressed={picking} class={`sysbox bagtools__pick ${picking ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setPicking(!picking); setPicked([]); }}>
          <Glyph name={picking ? 'close' : 'check'} /> {picking ? 'Done' : 'Select'}
        </button>
      </div>
      {picking && (
        <div class="bagpick">
          <span class="label">Select</span>
          {(['E', 'D', 'C', 'B', 'A', 'S'] as const).filter((r) => s.items.some((it) => gear.defOf(it)?.rank === r && loose(s, it))).map((r) => (
            <button type="button" key={r} class="sysbox bagpick__chip" data-rarity={r} onClick={() => { sfx.tap(); setPicked((p) => [...new Set([...p, ...s.items.filter((it) => gear.defOf(it)?.rank === r && loose(s, it)).map((x) => x.id)])]); }}>{rarity(r)}</button>
          ))}
          <button type="button" class="sysbox bagpick__chip" onClick={() => { sfx.tap(); setPicked((p) => [...new Set([...p, ...spares()])]); }}>Duplicates</button>
          {picked.length > 0 && <button type="button" class="sysbox bagpick__chip is-clear" onClick={() => { sfx.tap(); setPicked([]); }}>Clear</button>}
        </div>
      )}
      {!list.length && <Empty>{s.items.length ? 'Nothing matches.' : 'No items yet.'}</Empty>}
      {list.length > 0 && (
        <div class="baggrid">
          {list.map((it, i) => <BagTile key={it.id} it={it} i={i} picking={picking} picked={picked.includes(it.id)} locked={!loose(s, it)}
            onTap={() => (picking ? loose(s, it) && toggle(it.id) : openItem(it.id))} />)}
        </div>
      )}
      {picking && (
        <div class="sysbox bagbar">
          <span><b class="num">{chosen.length}</b> selected · Mana Shards <span class="grant num">+{group(worth)}</span></span>
          <Btn kind="danger" size="sm" disabled={!chosen.length} onClick={() => void recycle()}><Glyph name="trash" /> Recycle</Btn>
        </div>
      )}
      {picking && <small class="muted">Worn, issued and starred items cannot be selected.</small>}
    </div>
  );
}

/** One square of the bag: the piece framed by its rarity, its quality along its foot, and its marks. */
function BagTile({ it, i, picking, picked, locked, onTap }: { it: Item; i: number; picking: boolean; picked: boolean; locked: boolean; onTap: () => void }) {
  const s = useSave();
  const d = gear.defOf(it)!;
  const worn = !!gear.slotOf(s, it);
  const up = gear.beatsWorn(s, it);
  const dupes = gear.fodderFor(s, it).length;
  const fusable = dupes > 0 && gear.stepsToPerfect(it) > 0;
  const fresh = gear.isNew(s, it.id);
  return (
    <button type="button" class={`bagtile ${picked ? 'is-picked' : ''} ${picking && locked ? 'is-locked' : ''} ${fresh ? 'is-new' : ''}`} data-rarity={d.rank} style={`--i: ${Math.min(i, 24)}`}
      onClick={() => { sfx.tap(); onTap(); }}
      aria-label={`${d.name}, ${rarity(d.rank)} ${d.slot}, score ${Math.round(gear.score(it))}${worn ? ', worn' : ''}${up ? ', better than what is worn' : ''}${fresh ? ', new' : ''}`}>
      <GearArt item={it} size={62} equipped={worn} />
      <span class="bagtile__q" aria-hidden="true"><i style={`width: ${gear.quality(it)}%`} /></span>
      {fresh && <span class="bagtile__new">New</span>}
      {s.favourites.includes(it.id) && <Glyph name="star" class="bagtile__fav" />}
      {up && <span class="bagtile__up" aria-hidden="true">▲</span>}
      {fusable && <span class="bagtile__dupe num" title={`Duplicates held: ${dupes}`}>×{dupes + 1}</span>}
      {picking && <span class="bagtile__check" aria-hidden="true"><Glyph name={locked ? 'lock' : 'check'} /></span>}
    </button>
  );
}

// ------------------------------------------------------------------ the sets

/** Every set and how much of it is held and worn, and every design found, by rarity. */
function Codex() {
  const s = useSave();
  const all = [...gear.ALL_GEAR, ...gear.ISSUED];
  const found = new Set(s.found);
  return (
    <div class="stack codex">
      <Section title="Designs discovered" right={<span class="num">{s.found.length}/{all.length}</span>}>
        <ul class="codex__found">
          {(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((r) => {
            const of = gear.ALL_GEAR.filter((x) => x.rank === r);
            const n = of.filter((x) => found.has(x.id)).length;
            return (
              <li key={r} data-rarity={r}>
                <span>{rarity(r)}</span>
                <i class="codex__bar"><i style={`width: ${(n / Math.max(1, of.length)) * 100}%`} /></i>
                <b class="num">{n}/{of.length}</b>
              </li>
            );
          })}
        </ul>
      </Section>
      {(['C', 'B', 'A', 'S'] as const).map((r) => (
        <Section key={r} title={`${rarity(r)} sets`}>
          <div class="codex__sets">{SETS.filter((x) => gear.setPieces(x.id)[0]?.rank === r).map((x) => <SetCard key={x.id} set={x} />)}</div>
        </Section>
      ))}
    </div>
  );
}

/** A set: its pieces, held, worn or still to find, what two and three of them pay, and its home Gate. */
function SetCard({ set, compact }: { set: GearSet; compact?: boolean }) {
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
          return (
            <button type="button" key={p.id} class={`setpiece ${it ? 'is-held' : s.found.includes(p.id) ? 'is-seen' : 'is-unknown'} ${on ? 'is-worn' : ''}`} disabled={!it}
              onClick={() => { if (it) { sfx.tap(); openItem(it.id); } }} aria-label={`${p.name}${it ? on ? ', worn' : ', held' : ', not held'}`}>
              {it ? <GearArt item={it} size={46} /> : <span class="setpiece__ghost"><Glyph name={s.found.includes(p.id) ? p.slot : 'unknown'} /></span>}
              <small>{s.found.includes(p.id) ? p.name : '-- --'}</small>
            </button>
          );
        })}
      </div>
      <div class={`setbonus ${worn >= 2 ? 'is-on' : ''}`}><b class="num">2</b><span>{gear.bonusText(set.two)}</span></div>
      <div class={`setbonus ${worn >= 3 ? 'is-on' : ''}`}><b class="num">3</b><span>{gear.bonusText(set.three)}</span></div>
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
    system: { icon: at ? <GearArt item={at} size={58} /> : null, kind: 'gear' },
    render: () => <ItemCard id={id} close={close} />,
  });
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
  return (
    <div class="stack itemcard" data-rarity={d.rank}>
      <section class="sysbox itemhero">
        <span class="itemhero__art"><GearArt item={it} size={92} /></span>
        <div class="itemhero__who">
          <span class="itemhero__kind"><RankPlate rank={d.rank} size={18} />{rarity(d.rank)} {d.slot}</span>
          <span class="itemhero__tags">
            {worn && <span class="itag is-worn">Worn · {gear.SLOTS.find((x) => x.key === worn)?.name}</span>}
            {d.set && <span class="itag is-set" style={`--set-h: ${gear.setHue(d.set)}`}><SetMark id={d.set} />{d.set}</span>}
            {tag === 'perfect' && <span class="itag is-perfect">✦ Perfect{it.over ? ` +${it.over}` : ''}</span>}
            {tag === 'peak' && <span class="itag is-perfect">✧ Perfect quality</span>}
            {tag === 'dead' && <span class="itag is-dead">✕ Lowest roll</span>}
            {it.master && <span class="itag is-master">Masterwork</span>}
            {d.issued && <span class="itag">Issued</span>}
          </span>
          <span class="itemhero__score">
            <span class="label">Score</span><b class="num">{Math.round(gear.score(it))}</b>
            {other && <span class={`itemhero__vs num ${diff.score > 0 ? 'is-up' : diff.score < 0 ? 'is-down' : ''}`}>{diff.score > 0 ? '▲' : diff.score < 0 ? '▼' : '='} {Math.abs(Math.round(diff.score))}</span>}
          </span>
        </div>
      </section>
      {other && (
        <button type="button" class="sysbox itemvs" onClick={() => { sfx.tap(); openItem(other.id); }}>
          <span class="label">Compared with</span>
          <GearArt item={other} size={30} />
          <span class="itemvs__name">{gear.defOf(other)?.name}</span>
          <span class="num">{Math.round(gear.score(other))}</span>
        </button>
      )}
      {!d.issued && <QualityMeter it={it} />}
      <Section title="Stats">
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
      </Section>
      {(d.rolls ?? []).length > 0 && (
        <Section title="Properties">
          <ul class="itemrolls">
            {(d.rolls ?? []).map((r, k) => {
              const v = it.rolls[k] ?? r.min;
              const at = r.max > r.min ? (v - r.min) / (r.max - r.min) : 1;
              return (
                <li key={r.stat}>
                  <span class="itemrolls__name">{gear.rollText(it)[k]}</span>
                  <i class={`itemrolls__bar ${at >= 1 ? 'is-full' : ''}`} aria-hidden="true"><i style={`width: ${unit(at) * 100}%`} />{at > 1 && <b style={`width: ${Math.min(1, at - 1) * 100}%`} />}</i>
                  <small class="num muted">{r.min} to {r.max}{r.pct ? '%' : ''}</small>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {d.desc && <p class="itemcard__text">{d.desc}</p>}
      {it.master && <p class="itemcard__text hint">Masterwork of {walkerOf(it.master, d.rank).name}.</p>}
      {set && (
        <Section title={`Set: ${set.id}`} right={<span class="num">{gear.heldOf(s, set.id).size}/{gear.setPieces(set.id).length}{gear.setsIn(gear.worn(s)).get(set.id) ? ` · Worn ${gear.setsIn(gear.worn(s)).get(set.id)}` : ''}</span>}>
          <SetCard set={set} compact />
        </Section>
      )}
      {!d.issued && <Fusion it={it} />}
      {!d.issued && <Upgrade it={it} />}
      <div class="row itemacts">
        <Btn kind="primary" class="grow" sound="success" onClick={() => {
          store.update((x) => (worn ? gear.unequip(x, worn) : gear.equip(x, it.id)));
          toast(`${d.name} ${worn ? 'stowed' : 'equipped'}.`, 'xp');
          void checkAwards();
        }}>{worn ? 'Unequip' : 'Equip'}</Btn>
        <IconBtn icon="star" on={s.favourites.includes(it.id)} label={s.favourites.includes(it.id) ? 'Unstar' : 'Star: kept from recycling and fusion'} onClick={() => store.update((x) => gear.toggleFav(x, it.id))} />
      </div>
      {!d.issued && !worn && !s.favourites.includes(it.id) && (
        <Btn kind="ghost" onClick={async () => {
          const v = shop.scrapValue(it);
          if (!(await confirm('Recycle Item', `Break <em>${d.name}</em> down for <strong>${v} Mana Shards</strong>?`, 'Recycle', true))) return;
          store.update((x) => shop.recycle(x, it.id));
          toast(`${d.name} recycled · Mana Shards +${v}`, 'xp');
          close();
        }}><Glyph name="trash" /> Recycle · <Shards n={shop.scrapValue(it)} /></Btn>
      )}
    </div>
  );
}

/** A piece's quality: where it rolled between its design's worst and best, the steps still to its best, and any past it. */
function QualityMeter({ it }: { it: Item }) {
  const s = useSave();
  const q = gear.quality(it);
  const left = gear.stepsToPerfect(it);
  const cap = overCap(s);
  return (
    <div class="sysbox itemq">
      <span class="label">Quality</span>
      <b class="num">{q}%</b>
      <i class="itemq__bar" aria-hidden="true">
        <i style={`width: ${q}%`} />
        {[25, 50, 75].map((m) => <span key={m} class="itemq__tick" style={`left: ${m}%`} />)}
      </i>
      <small class="num">{left ? `Steps to perfect: ${left}` : it.over ? `Perfect +${it.over}` : 'Perfect'}</small>
      {cap > 0 && !left && (
        <span class="itemq__over" aria-label={`Past perfect: ${it.over ?? 0} of ${cap}`}>
          {Array.from({ length: cap }, (_, i) => <i key={i} class={i < (it.over ?? 0) ? 'is-on' : ''} />)}
        </span>
      )}
    </div>
  );
}

/** Fusion: a duplicate fed into this piece, the weakest first, with what it would become. */
function Fusion({ it }: { it: Item }) {
  const s = useSave();
  const fodder = gear.fodderFor(s, it);
  if (!fodder.length || !gear.stepsToPerfect(it)) return null;
  const f = fodder[0];
  const next = gear.fusedWith(it, f);
  if (!next) return null;
  const d = gear.defOf(it)!;
  const go = async () => {
    const ok = await sys(system.offer([
      'Would you like to fuse these items?',
      `${system.tag(d.name, 'Item')} ${system.gain(`Quality: ${system.change(`${gear.quality(it)}%`, `${gear.quality(next)}%`)}`)}`,
      `The duplicate is consumed. (Score ${Math.round(gear.score(f))})`,
    ], 'gear', 'Fuse', 'Cancel'));
    if (ok !== true) return;
    const got = store.update((x) => gear.fuse(x, it.id, f.id));
    if (!got) return;
    sfx.rankUp();
    buzz([20, 40, 30, 60]);
    await sys({ ...system.notify([`${system.tag(d.name, 'Item')} has been fused.`, `Quality: ${system.change(`${gear.quality(it)}%`, system.gain(`${gear.quality(got)}%`))}`], 'gear'), typed: false });
    void checkAwards();
  };
  return (
    <Section title="Fusion" right={<span class="num">Duplicates held: {fodder.length}</span>}>
      <div class="sysbox fusion">
        <span class="fusion__pair">
          <GearArt item={f} size={44} />
          <span class="fusion__arrow" aria-hidden="true"><i /><i /><i /></span>
          <GearArt item={next} size={52} />
        </span>
        <span class="fusion__what">
          <b class="num">Quality {gear.quality(it)}% → <span class="grant">{gear.quality(next)}%</span></b>
          <small>The better roll of the two, then {FUSE.steps} steps toward perfect.</small>
        </span>
        <Btn kind="gold" size="sm" onClick={() => void go()}>Fuse</Btn>
      </div>
    </Section>
  );
}

/** The next upgrade step on a piece: what it raises, and what it costs. */
function Upgrade({ it }: { it: Item }) {
  const s = useSave();
  const cap = overCap(s);
  const next = gear.upgradeStep(it, cap);
  const cost = shop.upgradeCost(it, cap);
  if (!next || cost === null) {
    const over = it.over ?? 0;
    return <p class="hint">{!ascensionOpen(s) ? 'Perfect. Nothing left to raise.'
      : `Perfect${over ? ` +${over}` : ''}. Each Ascension level opened allows ${OVERCHARGE.per === 1 ? '1 more step' : `${OVERCHARGE.per} more steps`}.`}</p>;
  }
  const short = s.wallet.shards < cost;
  return (
    <Section title={next.over ? 'Past perfect' : 'Upgrade'} right={it.up ? <span class="num">Steps taken: {it.up}</span> : 'at the Exchange'}>
      <div class="sysbox upgrade2">
        <span class="upgrade2__row"><span class="label">Quality</span><b class="num">{gear.qualityText(it)} → <span class="grant">{gear.qualityText(next)}</span></b></span>
        <span class="upgrade2__row"><span class="label">Score</span><b class="num">{Math.round(gear.score(it))} → <span class="grant">{Math.round(gear.score(next))}</span></b></span>
        <Btn kind="gold" disabled={short} onClick={() => {
          if (!store.update((x) => shop.upgrade(x, it.id))) return;
          sfx.success();
          buzz([14, 24]);
          toast(`${gear.defOf(it)?.name} upgraded.`, 'good');
          void checkAwards();
        }}>{short ? `Mana Shards ${s.wallet.shards}/${cost}` : <>Upgrade · <Shards n={cost} /></>}</Btn>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ what is worn

/** EQUIPMENT: what is worn, on a figure, what it adds, the sets it completes, and the loadouts. */
export function openEquipment() {
  openSheet({ title: 'Equipment', system: { icon: null, kind: 'gear' }, render: () => <Equipment /> });
}

/** Where each slot meets the figure, in its 100 by 220 frame. */
const NODES: Record<SlotKey, [number, number]> = {
  head: [50, 21], chest: [50, 62], hands: [17, 118], legs: [40, 158], feet: [37, 204],
  weapon: [83, 124], offhand: [17, 100], amulet: [50, 40], ring1: [86, 136], ring2: [14, 136],
};

function Equipment() {
  const s = useSave();
  const ups = gear.upgradeCount(s);
  const offers = gear.offers(s);
  const r = rankOf(s);
  const items = gear.worn(s);
  const core = gear.boosted({ STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0 }, items, {}, 999);
  const extra = gear.sumBonuses(gear.rollBonuses(items), gear.setBonuses(items));
  const lit = new Set(gear.SLOTS.filter((x) => s.equipped[x.key]).map((x) => x.key));
  const active = new Map([...gear.setsIn(items)].filter(([, n]) => n >= 2));
  const slot = (k: SlotKey) => {
    const it = gear.equippedIn(s, k);
    const def = gear.SLOTS.find((x) => x.key === k)!;
    const d = it ? gear.defOf(it) : undefined;
    const set = d?.set && active.has(d.set) ? d.set : null;
    return (
      <button type="button" key={k} class={`sysbox dollslot is-${def.side} ${it ? 'is-filled' : ''} ${set ? 'is-set' : ''}`} style={set ? `--set-h: ${gear.setHue(set)}` : undefined}
        onClick={() => { sfx.tap(); if (it) openItem(it.id); else openSlot(k); }} aria-label={it ? `${def.name}: ${d?.name}` : `${def.name}: empty`}>
        {it ? <GearArt item={it} size={40} /> : <span class="dollslot__ghost"><Glyph name={def.accepts} /></span>}
        <span class="dollslot__text">
          <small>{def.name}</small>
          <b>{d?.name ?? '-- --'}</b>
          {it && !d?.issued && <i class="dollslot__q" aria-hidden="true"><i style={`width: ${gear.quality(it)}%`} /></i>}
        </span>
        {!it && offers.includes(k) && <span class="badge badge--gold">+</span>}
      </button>
    );
  };
  return (
    <div class="stack equip2">
      <section class="sysbox equipsum">
        <span class="equipsum__power"><span class="label">Equipment score</span><b class="num">{Math.round(gear.power(s))}</b><small class="num">Slots: {items.length}/{gear.SLOTS.length}</small></span>
        <span class="equipsum__core">
          {STATS.map((k) => <span key={k} class={core[k] ? '' : 'is-none'}><Glyph name={STAT_ICON[k]} /><small>{k}</small><b class="num">+{Math.round(core[k])}</b></span>)}
        </span>
        {Object.keys(extra).length > 0 && <small class="equipsum__extra grant">{gear.bonusText(extra)}</small>}
      </section>
      <div class="doll">
        <div class="doll__col">{gear.SLOTS.filter((x) => x.side === 'l').map((x) => slot(x.key))}</div>
        <div class="doll__figure" aria-hidden="true">
          <svg viewBox="0 0 100 220" class="figure">
            <defs>
              <linearGradient id="figscan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0" /><stop offset="0.5" stop-color="currentColor" stop-opacity="0.5" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient>
            </defs>
            <g class="figure__grid">{[40, 80, 120, 160, 200].map((y) => <line key={y} x1="4" x2="96" y1={y} y2={y} />)}</g>
            <g class="figure__body">
              <circle cx="50" cy="21" r="11" />
              <path d="M50 32v8M31 46c6-5 13-6 19-6s13 1 19 6l3 24-4 22-4 18H40l-4-18-4-22z" />
              <path d="M31 46l-8 30-6 42M69 46l8 30 6 42" />
              <path d="M41 110l-3 48-2 46M59 110l3 48 2 46M36 204h-7M64 204h7" />
              <path d="M50 46v60M38 70h24M40 88h20" class="figure__seam" />
            </g>
            {(Object.entries(NODES) as [SlotKey, [number, number]][]).map(([k, [x, y]]) => (
              <g key={k} class={`figure__node ${lit.has(k) ? 'is-lit' : ''}`}><circle cx={x} cy={y} r="4.5" /><circle cx={x} cy={y} r="1.6" /></g>
            ))}
            <rect x="0" y="0" width="100" height="36" fill="url(#figscan)" class="figure__scan" />
          </svg>
          <span class="doll__sigil"><Sigil rank={r.key === 'N' ? 'N' : licensedRank(s)} size={24} /></span>
        </div>
        <div class="doll__col">{gear.SLOTS.filter((x) => x.side === 'r').map((x) => slot(x.key))}</div>
      </div>
      <Btn kind={ups ? 'primary' : undefined} block disabled={!ups} onClick={() => { const n = store.update(gear.autoEquip); sfx.success(); buzz([16, 26, 22]); toast(`${n} slot${n === 1 ? '' : 's'} improved.`, 'good'); void checkAwards(); }}>
        Auto Equip{ups ? ` · ${ups}` : ''}
      </Btn>
      <Loadouts />
      {active.size > 0 && (
        <Section title="Sets worn">
          <div class="codex__sets">{[...active.keys()].map((id) => <SetCard key={id} set={setById(id)!} />)}</div>
        </Section>
      )}
    </div>
  );
}

/** The loadouts: what was worn, saved, and worn again in one tap. */
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
      <div class="loadouts">
        {Array.from({ length: gear.LOADOUTS }, (_, i) => {
          const l = s.loadouts?.[i] ?? null;
          const on = gear.wearing(s, l);
          const held = l ? gear.loadoutHeld(s, l) : null;
          const score = held ? Object.values(held.held).reduce((n, x) => n + gear.score(x!), 0) : 0;
          return (
            <div key={i} class={`sysbox loadout ${l ? '' : 'is-empty'} ${on ? 'is-on' : ''}`}>
              <span class="loadout__head" aria-label={`Loadout ${marks[i]}`}><b>{marks[i]}</b>{on && <span class="loadout__on">Worn</span>}</span>
              {l && held ? (
                <>
                  <span class="loadout__pips" aria-hidden="true">{gear.SLOTS.map((sl) => <i key={sl.key} class={held.held[sl.key] ? 'is-on' : l.slots[sl.key] ? 'is-gone' : ''} />)}</span>
                  <small class="num">Score {Math.round(score)}{held.missing ? ` · Missing: ${held.missing}` : ''}</small>
                  <span class={`loadout__acts ${on ? 'is-one' : ''}`}>
                    {!on && <Btn size="sm" kind="primary" onClick={() => wear(i)}>Wear</Btn>}
                    <Btn size="sm" onClick={() => void save(i)}>Save</Btn>
                  </span>
                </>
              ) : (
                <>
                  <small class="muted">-- --</small>
                  <Btn size="sm" onClick={() => void save(i)}>Save Worn</Btn>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** EQUIPMENT: one empty slot, and everything held that fits it, best first. */
function openSlot(k: SlotKey) {
  const slot = gear.SLOTS.find((x) => x.key === k)!;
  const close = openSheet({
    title: `Equipment: ${slot.name}`, system: { icon: <Glyph name={slot.accepts} />, kind: 'gear' }, render: () => <SlotPicker k={k} close={() => close()} />,
  });
}

function SlotPicker({ k, close }: { k: SlotKey; close: () => void }) {
  const s = useSave();
  const slot = gear.SLOTS.find((x) => x.key === k)!;
  const list = s.items.filter((it) => gear.defOf(it)?.slot === slot.accepts && !gear.slotOf(s, it)).sort((a, b) => gear.score(b) - gear.score(a));
  if (!list.length) return <Empty>Items held: 0</Empty>;
  return (
    <div class="stack stack--tight">
      {list.map((it) => (
        <PieceRow key={it.id} it={it} onClick={() => { store.update((x) => gear.equip(x, it.id, k)); sfx.success(); toast(`${gear.defOf(it)?.name} equipped.`, 'xp'); close(); void checkAwards(); }} />
      ))}
    </div>
  );
}

/** A piece as a row: its art, name, what it gives, and its rarity, slot and score. */
function PieceRow({ it, onClick }: { it: Item; onClick: () => void }) {
  const s = useSave();
  const d = gear.defOf(it)!;
  return (
    <button type="button" class="sysbox piecerow" data-rarity={d.rank} onClick={() => { sfx.tap(); onClick(); }}>
      <GearArt item={it} size={44} />
      <span class="piecerow__text">
        <b>{d.name}{s.favourites.includes(it.id) && <Glyph name="star" class="fav" />}</b>
        <small>{gear.coreText(it)}</small>
        <small class="muted">{rarity(d.rank)} · Score {Math.round(gear.score(it))} · Quality {gear.qualityText(it)}{d.set ? ` · ${d.set}` : ''}</small>
      </span>
      {gear.beatsWorn(s, it) && <span class="piecerow__up" aria-label="Better than what is worn">▲</span>}
    </button>
  );
}
