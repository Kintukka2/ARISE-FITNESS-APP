/**
 * The Shadow army, as a bento grid: the Army, its squad over the reserve, opening the roster where the
 * squad is made; and the Orders under it.
 */
import { sfx } from '@/audio/audio';
import { passiveText, ability, TACTICS } from '@/core/combat';
import { dungeonById, enemyById } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, RankPlate, Section } from '@/ui/components';
import { BentoGrid, type Tile as BTile } from '@/ui/bento';
import type { Enemy, Save, Shadow, Tactic } from '@/core/types';
import { RANKS } from '@/core/types';
import type { RaidResult } from '@/core/raid';
import { dayKey, daysBetween } from '@/core/util';
import * as system from '@/ui/system';
import { skillLine } from './Skills';
import { Field, SysAlert, SysFrame } from '@/ui/frame';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { FamilyGlyph, Insignia, ShadowEmblem } from '@/ui/emblems';
import { KinOfShadow, KinTracker } from '@/ui/kin';
import { HoldButton, openSheet, sys, toast } from '@/ui/overlays';
import { buzz, flash } from '@/ui/feedback';
import { claimAll, claimPromotion } from '@/app/flow';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useDrag } from '@/ui/drag';

export function Shadows() {
  const s = useSave();
  useEffect(() => { if (!story.seen(s, 'shadows-visited')) store.update((x) => story.markOnce(x, 'shadows-visited')); }, []);
  const fresh = s.shadows.fresh;
  // What joined since the last visit, held for this visit: the router clears `fresh` a few seconds in.
  const [news] = useState(() => [...fresh]);
  const joined = news.length === 1 ? enemyById(s.shadows.army.find((x) => x.id === news[0])?.enemyId ?? '')?.shadow : null;
  return (
    <div class="stack">
      {news.length > 0 && (
        <SysFrame title="Notification" kind="shadow" class="sysnotice">
          <p>{joined ? <><strong>[{joined}]</strong> has joined your army.</> : `[${news.length} Shadows have joined your army.]`}</p>
        </SysFrame>
      )}
      <BentoGrid class="shadowgrid" tiles={tiles(s, news)} label="Shadows" />
    </div>
  );
}

/** Every Shadow bound, the deployed ones first and the strongest before the rest. */
const ranked = (s: Save) => {
  const squad = shadows.squad(s);
  return s.shadows.army.slice().sort((a, b) => Number(squad.includes(b)) - Number(squad.includes(a)) || shadows.power(b) - shadows.power(a));
};

/** A Shadow's short name, for a slot: the name bestowed, or its creature's without `Shadow`. */
const shortName = (sh: Shadow) => sh.name || (enemyById(sh.enemyId)?.shadow ?? '').replace(/^Shadow /, '');

/** How many of the reserve the Army tile shows before it counts the rest. */
const RESERVE_SHOWN = 7;

/** The Shadows screen: the Army, large, then the Orders. */
function tiles(s: Save, news: string[]): BTile[] {
  const slots = shadows.slots(s);
  const squad = shadows.squad(s);
  const army = ranked(s);
  const reserve = army.filter((x) => !squad.includes(x));
  const waiting = shadows.waitingAll(s);
  const promos = shadows.promotable(s).length;
  const armyTile: BTile = {
    key: 'army', kind: 'shadow', name: 'Army', head: true, wide: true, icon: <Glyph name="shadows" />,
    // A slot free, or a Shadow waiting to be promoted or awakened: each waits on the hunter. One just
    // bound is news, told by the notification above and its New mark, not a call.
    call: shadows.freeSlots(s) > 0 || waiting.length > 0,
    count: `${squad.length}/${slots}`,
    status: promos ? `Promotion ready: ${promos}` : waiting.length ? `Awakening ready: ${waiting.length}` : <>Bound: {army.length} · Shadow Essence: <b class="num">{s.shadows.essence ?? 0}</b></>,
    art: (
      <span class="sa-host">
        <span class="sa-host__squad">
          {Array.from({ length: slots }, (_, i) => {
            const sh = squad[i];
            const e = sh && enemyById(sh.enemyId);
            if (!sh || !e) return <span key={`free-${i}`} class="sysbox sa-host__slot is-free" style={`--i: ${i}`}><Glyph name="plus" /><small>Free</small></span>;
            return (
              <span key={sh.id} class={`sysbox sa-host__slot ${shadows.waiting(s, sh) ? 'is-ready' : ''}`} style={`--i: ${i}`}>
                <span class="sa-host__grade"><RankPlate rank={e.rank} size={16} /></span>
                <span class="sa-host__smoke" />
                <ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={40} />
                <small>{shortName(sh)}</small>
                <b class="num">Lv.{shadows.levelOf(sh)}</b>
              </span>
            );
          })}
        </span>
        {reserve.length > 0 && (
          <span class="sa-host__reserve">
            <span class="label">Reserve</span>
            <span class="sa-host__ones">
              {reserve.slice(0, RESERVE_SHOWN).map((sh, i) => (
                <span key={sh.id} class={`sa-host__one ${shadows.waiting(s, sh) ? 'is-ready' : ''} ${news.includes(sh.id) ? 'is-new' : ''}`} style={`--i: ${i}`}>
                  <FamilyGlyph family={enemyById(sh.enemyId)!.family} size={16} />
                </span>
              ))}
              {reserve.length > RESERVE_SHOWN && <span class="sa-host__more num">+{reserve.length - RESERVE_SHOWN}</span>}
            </span>
          </span>
        )}
      </span>
    ),
    open: () => openArmy(news),
  };
  const t = s.gates.tactic ?? 'default';
  const ordersTile: BTile = {
    key: 'orders', kind: 'shadow', name: 'Orders', head: true, wide: true, icon: <Glyph name="orders" />,
    status: <>Standing orders: <b>{tacticName(t)}</b></>,
    art: (
      <span class="sa-orders">
        {TACTICS.map((x) => (
          <span key={x.key} class={`sysbox sa-orders__one ${x.key === t ? 'is-on' : ''}`}><Glyph name={TACTIC_GLYPH[x.key]} /><small>{x.name}</small></span>
        ))}
      </span>
    ),
    open: openOrders,
  };
  return [armyTile, ordersTile];
}

// ------------------------------------------------------------------ the army

type Show = 'all' | 'squad' | 'reserve' | 'ready';
type Sort = 'power' | 'level' | 'rank' | 'grade' | 'new';
type View = 'list' | 'grid';

const SHOWS: { key: Show; name: string }[] = [
  { key: 'all', name: 'All' }, { key: 'squad', name: 'Squad' }, { key: 'reserve', name: 'Reserve' }, { key: 'ready', name: 'Ready' },
];
const SORTS: { key: Sort; name: string }[] = [
  { key: 'power', name: 'Power' }, { key: 'level', name: 'Level' }, { key: 'rank', name: 'Rank' }, { key: 'grade', name: 'Grade' }, { key: 'new', name: 'Newest' },
];

/** How the roster was left: its tab, its sort and its view hold while the app stays open. */
const roster: { show: Show; sort: Sort; view: View } = { show: 'all', sort: 'power', view: 'list' };

/** The army in the roster's order: by what it sorts on, then by power. */
function sortArmy(s: Save, by: Sort): Shadow[] {
  const at = new Map(s.shadows.army.map((x, i) => [x.id, i]));
  const key = (sh: Shadow): number => {
    if (by === 'level') return shadows.levelOf(sh);
    if (by === 'rank') return shadows.rankIndex(sh) * 100 + shadows.starsOf(sh) * 10 + shadows.levelOf(sh) / 10;
    if (by === 'grade') return RANKS.indexOf(enemyById(sh.enemyId)!.rank as (typeof RANKS)[number]);
    if (by === 'new') return at.get(sh.id) ?? 0;
    return shadows.power(sh);
  };
  return s.shadows.army.slice().sort((a, b) => key(b) - key(a) || shadows.power(b) - shadows.power(a));
}

/** ARMY: the squad that walks into the next Gate, and every Shadow bound, a row each, made into the squad from here. */
function openArmy(news: string[]) {
  openSheet({ title: 'Army', system: { icon: <Glyph name="shadows" />, kind: 'shadow' }, render: () => <ArmySheet news={news} /> });
}

function ArmySheet({ news }: { news: string[] }) {
  const s = useSave();
  const [show, setShow] = useState<Show>(roster.show);
  const [sort, setSort] = useState<Sort>(roster.sort);
  const [view, setView] = useState<View>(roster.view);
  const listRef = useRef<HTMLDivElement>(null);
  const squad = shadows.squad(s);
  const n = shadows.slots(s);
  const full = squad.length >= n;
  const ready = (sh: Shadow) => shadows.waiting(s, sh);
  const counts: Record<Show, number> = {
    all: s.shadows.army.length, squad: squad.length,
    reserve: s.shadows.army.length - squad.length, ready: s.shadows.army.filter(ready).length,
  };
  const match = (sh: Shadow) => show === 'all' || (show === 'squad' ? squad.includes(sh) : show === 'reserve' ? !squad.includes(sh) : ready(sh));
  const list = sortArmy(s, sort).filter(match);
  const pick = (k: Show) => { sfx.tap(); roster.show = k; setShow(k); };
  const order = (k: Sort) => { sfx.tap(); roster.sort = k; setSort(k); };
  const look = (k: View) => { sfx.tap(); roster.view = k; setView(k); };
  const move = (id: string) => { store.update((x) => shadows.toggleDeploy(x, id)); sfx.blip(); };
  // A drop onto a slot places the Shadow there; onto the list, it is taken out of the squad.
  const drag = useDrag((id, at) => {
    const slot = at === 'out' ? -1 : Number(at.replace('slot:', ''));
    if (Number.isNaN(slot)) return;
    if (store.update((x) => shadows.placeAt(x, id, slot))) sfx.blip();
  });
  const held = drag.lifted ? s.shadows.army.find((x) => x.id === drag.lifted) : undefined;
  const heldE = held && enemyById(held.enemyId);
  const best = shadows.bestSquad(s);
  const settled = best.length === squad.length && best.every((id) => squad.some((x) => x.id === id));
  return (
    <div class={`stack roster ${drag.lifted ? 'is-dragging' : ''}`} {...drag.guard}>
      <div class="bag__head roster__sum">
        <span><b class="num"><EssenceMark />{s.shadows.essence ?? 0}</b><small>Shadow Essence</small></span>
        <span><b class="num">{shadows.squadPower(s)}</b><small>Squad Power</small></span>
        <span><b class="num">{s.shadows.army.length}</b><small>Bound</small></span>
        {/* Ready waits on the hunter: a tap offers to promote and awaken them all at once. */}
        {counts.ready > 0
          ? (
            <button type="button" class="is-call roster__ready" aria-label={`Ready: ${counts.ready}. Promote all`} onClick={(ev) => { sfx.tap(); void claimAll(ev.currentTarget); }}>
              <b class="num">{counts.ready}<Glyph name="up" class="roster__ready-up" /></b><small>Ready</small>
            </button>
          )
          : <span><b class="num">0</b><small>Ready</small></span>}
      </div>
      <Section title="Squad" right={<span class="num roster__count">{squad.length}/{n}</span>}>
        <div class="roster__slots">
          {Array.from({ length: n }, (_, i) => {
            const sh = squad[i];
            const e = sh && enemyById(sh.enemyId);
            const hit = drag.over === `slot:${i}` ? 'is-over' : '';
            if (!sh || !e) {
              return (
                <button key={`free-${i}`} type="button" data-drop={`slot:${i}`} class={`sysbox roster__slot is-free ${hit}`} aria-label="Free slot: show the reserve"
                  onClick={() => { pick('reserve'); listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>
                  <Glyph name="plus" /><small>Free</small>
                </button>
              );
            }
            return (
              <div key={sh.id} data-drop={`slot:${i}`} class={`sysbox roster__slot ${ready(sh) ? 'is-ready' : ''} ${hit} ${drag.lifted === sh.id ? 'is-lifted' : ''}`} {...drag.handle(sh.id)}>
                <button type="button" class="roster__slot-open" onClick={() => { sfx.tap(); openShadow(sh.id); }}>
                  <span class="roster__slot-grade"><RankPlate rank={e.rank} size={16} /></span>
                  <span class="roster__slot-badge"><ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={40} /></span>
                  <b>{shortName(sh)}</b>
                  <small class="num">Lv.{shadows.levelOf(sh)} · {shadows.power(sh)}</small>
                </button>
                <button type="button" class="roster__slot-x" aria-label={`Take out: ${shadows.nameOf(sh)}`} title="Take out"
                  onPointerDown={(ev) => ev.stopPropagation()} onClick={() => move(sh.id)}><Glyph name="close" /></button>
              </div>
            );
          })}
        </div>
        <KinTracker squad={squad} />
        <div class="row roster__acts">
          <Btn class="grow" size="sm" disabled={settled} onClick={() => { store.update((x) => shadows.autoDeploy(x)); sfx.blip(); toast('Squad deployed.', 'good'); }}><Glyph name="shadows" /> Auto Deploy</Btn>
          <Btn size="sm" disabled={!squad.length} onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall · {squad.length}</Btn>
        </div>
      </Section>
      <div class={`roster__out ${drag.over === 'out' && held && squad.includes(held) ? 'is-over' : ''}`} data-drop="out">
      <div class="roster__tools" ref={listRef}>
        <div class="rostabs" role="tablist" aria-label="Show">
          {SHOWS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={show === x.key} class={`sysbox rostab ${show === x.key ? 'is-on' : ''} ${x.key === 'ready' && counts.ready ? 'is-call' : ''}`} onClick={() => pick(x.key)}>
              {x.name}<small class="num">{counts[x.key]}</small>
            </button>
          ))}
        </div>
        <div class="roster__bar">
          <button type="button" class="sysbox roster__sort" onClick={() => order(SORTS[(SORTS.findIndex((x) => x.key === sort) + 1) % SORTS.length].key)}>
            <Glyph name="swap" /> Sort: {SORTS.find((x) => x.key === sort)!.name}
          </button>
          <span class="roster__views">
            {(['list', 'grid'] as const).map((k) => (
              <button key={k} type="button" aria-label={k === 'list' ? 'List' : 'Grid'} aria-pressed={view === k} class={`sysbox roster__view ${view === k ? 'is-on' : ''}`} onClick={() => look(k)}><Glyph name={k} /></button>
            ))}
          </span>
        </div>
      </div>
      {!list.length && <Empty>{show === 'ready' ? 'No Shadow is ready.' : show === 'squad' ? 'No Shadow is deployed.' : 'No Shadow is held in reserve.'}</Empty>}
      {list.length > 0 && view === 'list' && (
        <div class="roster__table">
          <div class="roster__head" aria-hidden="true">
            <span /><span>Shadow</span>
            <button type="button" class={sort === 'level' ? 'is-on' : ''} tabIndex={-1} onClick={() => order('level')}>Lv</button>
            <button type="button" class={sort === 'power' ? 'is-on' : ''} tabIndex={-1} onClick={() => order('power')}>Power</button>
          </div>
          <ul class="roster__list">
            {list.map((sh, i) => <RosterRow key={sh.id} sh={sh} i={i} on={squad.includes(sh)} full={full} ready={ready(sh)} fresh={news.includes(sh.id)} move={move} drag={drag.handle(sh.id)} lifted={drag.lifted === sh.id} />)}
          </ul>
        </div>
      )}
      {list.length > 0 && view === 'grid' && (
        <div class="rostergrid">
          {list.map((sh, i) => <RosterCard key={sh.id} sh={sh} i={i} on={squad.includes(sh)} ready={ready(sh)} fresh={news.includes(sh.id)} drag={drag.handle(sh.id)} lifted={drag.lifted === sh.id} />)}
        </div>
      )}
      </div>
      {/* The ghost lives on the page, not in the sheet, so a transform on the sheet cannot move it off the pointer. */}
      {createPortal(
        <div class="dragghost" ref={drag.ghost} hidden={!held} aria-hidden="true">
          {held && heldE && <><ShadowEmblem family={heldE.family} rank={shadows.rankIndex(held)} size={40} /><b>{shortName(held)}</b></>}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** How far a Shadow stands through its rank's levels, 0 to 1. */
function share(sh: Shadow) {
  const at = shadows.rankIndex(sh);
  const floor = at ? shadows.SHADOW_RANKS[at - 1].cap : 0;
  return Math.max(0, Math.min(1, (shadows.levelOf(sh) - floor) / Math.max(1, shadows.rankOf(sh).cap - floor)));
}

/**
 * A Shadow's row: whether it is deployed, its badge, its name over its grade, family and rank, its level
 * over a bar through its rank's levels, and its power. The row opens its card; the box at its start
 * puts it in the squad or takes it out.
 */
type DragHandle = ReturnType<ReturnType<typeof useDrag>['handle']>;

function RosterRow({ sh, i, on, full, ready, fresh, move, drag, lifted }: { sh: Shadow; i: number; on: boolean; full: boolean; ready: boolean; fresh: boolean; move: (id: string) => void; drag: DragHandle; lifted: boolean }) {
  const e = enemyById(sh.enemyId)!;
  const at = shadows.rankIndex(sh);
  const stars = shadows.starsOf(sh);
  const cap = shadows.rankOf(sh).cap;
  const lv = shadows.levelOf(sh);
  return (
    <li class={`roster__row ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''} ${lifted ? 'is-lifted' : ''}`} style={`--i: ${Math.min(i, 12)}`}>
      <button type="button" class={`sysbox roster__toggle ${on ? 'is-on' : ''}`} aria-pressed={on} disabled={!on && full}
        aria-label={`${on ? 'Take out' : 'Put in'}: ${shadows.nameOf(sh)}`} title={on ? 'Take out' : full ? 'Squad full' : 'Put in'} onClick={() => move(sh.id)}>
        <Glyph name={on ? 'check' : 'plus'} />
      </button>
      <button type="button" class="roster__who" {...drag} onClick={() => { sfx.tap(); openShadow(sh.id); }}>
        <span class="roster__badge">
          <ShadowEmblem family={e.family} rank={at} size={40} />
          {ready ? <span class="roster__tag is-ready">Ready</span> : fresh ? <span class="roster__tag">New</span> : null}
        </span>
        <span class="roster__name">
          <span class="roster__line">
            <b>{shortName(sh)}</b>
            {stars > 0 && <span class="roster__stars" aria-label={`Awakening: ${stars}`}>★{stars}</span>}
          </span>
          <small>
            <RankPlate rank={e.rank} size={15} />
            <FamilyGlyph family={e.family} size={12} />
            <Insignia rank={at} size={12} />{shadows.rankOf(sh).name}
          </small>
        </span>
        <span class="roster__lv">
          <b class="num">{lv}<small>/{cap}</small></b>
          <i class="roster__bar-lv" aria-hidden="true"><i style={`width: ${Math.round(share(sh) * 100)}%`} /></i>
        </span>
        <b class="roster__power num">{shadows.power(sh)}</b>
      </button>
    </li>
  );
}

/** A Shadow on the roster's grid: its power over its badge, ringed by its levels through its rank, and its name. */
function RosterCard({ sh, i, on, ready, fresh, drag, lifted }: { sh: Shadow; i: number; on: boolean; ready: boolean; fresh: boolean; drag: DragHandle; lifted: boolean }) {
  const e = enemyById(sh.enemyId)!;
  const c = 2 * Math.PI * 40;
  return (
    <button type="button" class={`sysbox rostercard ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''} ${lifted ? 'is-lifted' : ''}`} style={`--i: ${Math.min(i, 16)}`} {...drag} onClick={() => { sfx.tap(); openShadow(sh.id); }}>
      <span class="rostercard__top"><RankPlate rank={e.rank} size={14} /><b class="num">{shadows.power(sh)}</b></span>
      <span class="rostercard__art">
        <svg viewBox="0 0 100 100" class="rostercard__ring" aria-hidden="true">
          <circle cx="50" cy="50" r="40" class="rostercard__track" />
          <circle cx="50" cy="50" r="40" class="rostercard__fill" style={`stroke-dasharray: ${c * share(sh)} ${c}`} />
        </svg>
        <ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={40} />
      </span>
      <small class="rostercard__name">{shortName(sh)}</small>
      <small class="rostercard__lv num">Lv.{shadows.levelOf(sh)}{ready ? ' · Ready' : fresh ? ' · New' : ''}</small>
    </button>
  );
}

/** Shadow Essence's mark: a drop of the dark, in violet. */
export function EssenceMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class="essence" aria-hidden="true">
      <path d="M12 2.5c3.6 4.6 6.4 8.3 6.4 11.6a6.4 6.4 0 1 1-12.8 0C5.6 10.8 8.4 7.1 12 2.5z" />
      <path d="M9.4 14.6a2.8 2.8 0 0 0 2.6 2.8" class="essence__glint" />
    </svg>
  );
}

// ------------------------------------------------------------------ orders

/** Each standing order's mark: an eye for their own judgement, a skull for the kill, the hunter, and the bolt of what spreads. */
const TACTIC_GLYPH: Record<Tactic, string> = { default: 'eye', finish: 'skull', protect: 'profile', spread: 'bolt' };
const tacticName = (t: Tactic | undefined) => TACTICS.find((x) => x.key === t)?.name ?? TACTICS[0].name;

/** ARMY: ORDERS: the standing orders the army fights on. */
function openOrders() {
  openSheet({ title: 'Army: Orders', system: { icon: <Glyph name="orders" />, kind: 'shadow' }, render: () => <OrdersSheet /> });
}

function OrdersSheet() {
  const s = useSave();
  const t = s.gates.tactic ?? 'default';
  const run = s.gates.raid;
  // A step underway keeps the orders it opened with; the new ones reach the run at its next step.
  const held = run && run.tactic !== t ? tacticName(run.tactic) : null;
  const set = (k: Tactic) => {
    if (k === t) return;
    store.update((x) => { const r = x.gates.raid ?? null; raid.setTactic(x, r ? dungeonById(r.dungeonId) ?? null : null, r, k); });
    sfx.blip();
  };
  return (
    <div class="stack">
      <Section title="Standing Orders" right="Shadows and Auto">
        <div class="ord-grid" role="radiogroup" aria-label="Standing orders">
          {TACTICS.map((x) => (
            <button key={x.key} type="button" role="radio" aria-checked={x.key === t} class={`sysbox ord-card ${x.key === t ? 'is-on' : ''}`} onClick={() => set(x.key)}>
              <span class="ord-card__ico"><Glyph name={TACTIC_GLYPH[x.key]} /></span>
              <b>{x.name}</b>
              <small>{x.desc}</small>
            </button>
          ))}
        </div>
        {held && <div class="sysfields"><Field k="Step underway" v={held} /></div>}
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ the card

function openShadow(id: string) {
  const at = store.get().shadows.army.find((x) => x.id === id);
  const was = at && enemyById(at.enemyId);
  openSheet({
    title: `Shadow: ${at ? shadows.nameOf(at) : 'Unknown'}`,
    system: { icon: was ? <CardBadge id={id} /> : null, kind: 'shadow' },
    render: (close) => <ShadowCard id={id} close={close} />,
  });
}

/** The card's badge, in its icon box: the rank it holds, as it changes. */
function CardBadge({ id }: { id: string }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  const e = sh && enemyById(sh.enemyId);
  return e ? <ShadowEmblem family={e.family} rank={shadows.rankIndex(sh!)} size={44} /> : null;
}

const ORDER = ['STR', 'VIT', 'AGI', 'INT', 'PER'] as const;
const unit = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(x * 100);

/**
 * A Shadow's card, as a profile: who it is and how far it has grown, the road of its ranks and what the
 * one above asks, its stats against its creature's own, what it fights with, its record, and its release.
 */
function ShadowCard({ id, close }: { id: string; close: () => void }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return <Empty>That Shadow is gone.</Empty>;
  const e = enemyById(sh.enemyId)!;
  return (
    <div class="stack shadowcard">
      <Profile sh={sh} e={e} close={close} />
      <NextRank sh={sh} e={e} />
      <Awakening sh={sh} />
      <Stats sh={sh} e={e} />
      {/* What it brings to a squad, under its stats, as Solo Leveling: Arise sets a Shadow's aura. */}
      <KinOfShadow sh={sh} family={e.family} role={e.role} squad={shadows.squad(s)} />
      <Kit sh={sh} e={e} />
      <Record sh={sh} />
      <Release sh={sh} close={close} />
    </div>
  );
}

/**
 * The head of the card, after the info panel of Solo Leveling: Arise's Army of Shadows: its badge inside
 * the ring of its next level, and beside it what it was (small, as the panel's epithet), then a row to
 * each of `Rank | Bound` (an arrow at its end while a promotion waits), `Lv. | 3/10` over its XP, and
 * `Power | 80`; its grade, family, role and whether it is deployed under them.
 */
function Profile({ sh, e, close }: { sh: Shadow; e: Enemy; close: () => void }) {
  const s = useSave();
  const squad = shadows.squad(s);
  const on = squad.includes(sh);
  const full = !on && squad.length >= shadows.slots(s);
  const at = shadows.rankIndex(sh);
  const lv = shadows.levelOf(sh);
  const p = shadows.progress(sh);
  const top = lv >= shadows.MAX_LEVEL;
  const ready = shadows.waiting(s, sh);
  const share = p.need ? p.into / p.need : 1;
  const c = 2 * Math.PI * 52;
  const toPromotion = () => { sfx.tap(); document.querySelector('.sheet.is-top .sp-next')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  return (
    <>
      <section class={`sysbox sp-head ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''} ${p.need ? '' : 'is-capped'}`}>
        <div class="sp-head__badge">
          <svg viewBox="0 0 120 120" class="sp-ring" aria-hidden="true">
            <circle cx="60" cy="60" r="58" class="sp-ring__runes" />
            <circle cx="60" cy="60" r="52" class="sp-ring__track" />
            <circle cx="60" cy="60" r="52" class="sp-ring__fill" style={`stroke-dasharray: ${c * unit(share)} ${c}`} />
          </svg>
          <span class="sp-head__smoke" />
          <ShadowEmblem family={e.family} rank={at} size={66} />
          {shadows.starsOf(sh) > 0 && <span class="sp-head__stars"><Stars n={shadows.starsOf(sh)} /></span>}
        </div>
        <div class="sp-head__who">
          <span class="sp-head__was">{sh.name ? `${e.name} · ${e.shadow}` : e.name}</span>
          <dl class="sp-rows">
            <div class="sp-row">
              <dt>Rank</dt>
              <dd class="sp-row__rank"><Insignia rank={at} size={14} />{shadows.rankOf(sh).name}</dd>
              {ready && <button type="button" class="sysbox sp-up" aria-label={shadows.canPromote(s, sh) ? 'Promotion ready' : 'Awakening ready'} onClick={toPromotion}><Glyph name="up" /></button>}
            </div>
            <div class="sp-row">
              <dt>Lv.</dt>
              <dd class="num"><span>{top ? 'MAX' : lv}{!top && <small>/{shadows.rankOf(sh).cap}</small>}</span></dd>
              <span class="sp-row__xp num">{top ? '' : p.need ? `XP ${p.into}/${p.need}` : 'Level cap'}</span>
            </div>
            <div class="sp-exp" aria-hidden="true"><i style={`width: ${pct(unit(share))}%`} /></div>
            <div class="sp-row">
              <dt>Power</dt>
              <dd class="sp-row__power num">{shadows.power(sh)}</dd>
            </div>
          </dl>
          <span class="sp-head__tags">
            <RankPlate rank={e.rank} size={20} />
            <span class="sp-tag"><FamilyGlyph family={e.family} size={13} />{e.family}</span>
            <span class="sp-tag">{e.role}</span>
            <span class={`sp-tag sp-head__state ${on ? 'is-on' : ''}`}>{on ? 'Deployed' : 'Not deployed'}</span>
          </span>
        </div>
      </section>
      <div class="row">
        <Btn kind={on ? undefined : 'primary'} class="grow" disabled={full} onClick={() => { store.update((x) => shadows.toggleDeploy(x, sh.id)); sfx.blip(); }}>
          <Glyph name={on ? 'recall' : 'shadows'} /> {on ? 'Recall' : full ? 'Squad Full' : 'Deploy'}
        </Btn>
        {/* A name changes the card's header, so the card opens again under it. */}
        <Btn onClick={async () => { const v = await nameShadow(sh.id); if (typeof v === 'string') { close(); openShadow(sh.id); } }}>{sh.name ? 'Rename' : 'Name'}</Btn>
      </div>
    </>
  );
}

/**
 * The rank above: what it asks, each met or not, and what it brings. Once all is met it is the
 * promotion, waiting on the hunter: its badge now and at the rank above, and the hold that claims it.
 * The badge lifts off into the promotion (`claimPromotion`).
 */
function NextRank({ sh, e }: { sh: Shadow; e: Enemy }) {
  const s = useSave();
  const badge = useRef<HTMLSpanElement>(null);
  const next = shadows.nextRank(sh);
  if (!next) return null;
  const at = shadows.rankIndex(sh);
  const need = shadows.requirements(s, sh);
  const ready = need.every((r) => r.met);
  const second = at + 1 === shadows.SECOND_AT ? shadows.secondOf(e) : null;
  return (
    <section class={`sysbox sp-next ${ready ? 'promote' : ''}`} key={at}>
      <header class="sp-next__head">
        <span class="label">{ready ? 'Promotion' : 'Next rank'}</span>
        <span class="sa-rank"><Insignia rank={at + 1} size={14} />{next.name} Rank</span>
      </header>
      {ready && (
        <div class="rankplates promote__plates" aria-label={`${shadows.rankOf(sh).name} Rank to ${next.name} Rank`}>
          <span class="rankplates__from" ref={badge}><ShadowEmblem family={e.family} rank={at} size={60} /></span>
          <span class="rankplates__path" style="--p: 1" aria-hidden="true"><i /></span>
          <span class="rankplates__to"><ShadowEmblem family={e.family} rank={at + 1} size={60} /></span>
        </div>
      )}
      <ul class="sp-reqs">
        {need.map((r) => (
          <li key={r.key} class={r.met ? 'is-met' : ''}>
            <Glyph name={r.met ? 'check' : 'lock'} />
            <span>{r.label}</span>
            <b class="num">{r.have}/{r.need}</b>
            <i class="sp-reqs__bar" aria-hidden="true"><i style={`width: ${pct(unit(r.have / r.need))}%`} /></i>
          </li>
        ))}
      </ul>
      <ul class="promote__gains">
        <li>Level cap: {shadows.rankOf(sh).cap} → <span class="grant">{next.cap}</span></li>
        {second && <li>Skill: <strong>[{second}]</strong></li>}
      </ul>
      {ready && <HoldButton hold={{ label: 'Hold To Promote', ms: 2000, ticks: 5, holding: 'Promoting…', done: 'Promoted', after: 260 }}
        onFire={() => void claimPromotion(sh.id, badge.current?.querySelector('svg') ?? badge.current)} />}
    </section>
  );
}

/** A Shadow's awakening, as stars: lit for those taken, dark for those still to take. */
function Stars({ n, of = 0 }: { n: number; of?: number }) {
  const max = Math.max(n, of);
  return (
    <span class="sp-stars" aria-label={`Awakening ${n}${of ? ` of ${of}` : ''}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} class={i < n ? 'is-on' : ''}>★</i>)}
    </span>
  );
}

/**
 * Awakening, once a Shadow is Ascendant: its stars, what the next asks (its level at the cap and the
 * Shadow Essence it costs) and what it adds; once all is met, the hold that takes it.
 */
function Awakening({ sh }: { sh: Shadow }) {
  const s = useSave();
  if (shadows.rankIndex(sh) < shadows.SHADOW_RANKS.length - 1) return null;
  const n = shadows.starsOf(sh);
  const cost = shadows.awakenCost(sh);
  const ready = shadows.canAwaken(s, sh);
  const name = shadows.nameOf(sh);
  const go = async () => {
    const was = shadows.growth(sh);
    const got = store.update((x) => shadows.awaken(x, sh.id));
    if (!got) return;
    sfx.rankUp();
    flash('shadow');
    buzz([60, 90, 30, 60, 140]);
    const now = store.get().shadows.army.find((x) => x.id === sh.id);
    await sys({
      ...system.notify([
        `${system.tag(name)} has awakened.`,
        system.gain(`Awakening ${'★'.repeat(got.to)}`),
        `Stats: ${system.change(`+${pct(was)}%`, system.gain(`+${pct(now ? shadows.growth(now) : was)}%`))}`,
      ], 'shadow'),
      typed: false,
    });
  };
  return (
    <section class={`sysbox sp-next sp-awaken ${ready ? 'promote' : ''}`} key={n}>
      <header class="sp-next__head">
        <span class="label">Awakening</span>
        <Stars n={n} of={shadows.MAX_STARS} />
      </header>
      {cost === null ? (
        <ul class="promote__gains"><li>Stats: <span class="grant">+{pct(shadows.growth(sh))}%</span></li></ul>
      ) : (
        <>
          <ul class="sp-reqs">
            <li class={shadows.atTop(sh) ? 'is-met' : ''}>
              <Glyph name={shadows.atTop(sh) ? 'check' : 'lock'} /><span>Level</span><b class="num">{shadows.levelOf(sh)}/{shadows.MAX_LEVEL}</b>
              <i class="sp-reqs__bar" aria-hidden="true"><i style={`width: ${pct(unit(shadows.levelOf(sh) / shadows.MAX_LEVEL))}%`} /></i>
            </li>
            <li class={(s.shadows.essence ?? 0) >= cost ? 'is-met' : ''}>
              <Glyph name={(s.shadows.essence ?? 0) >= cost ? 'check' : 'lock'} /><span>Shadow Essence</span><b class="num">{s.shadows.essence ?? 0}/{cost}</b>
              <i class="sp-reqs__bar" aria-hidden="true"><i style={`width: ${pct(unit((s.shadows.essence ?? 0) / cost))}%`} /></i>
            </li>
          </ul>
          <ul class="promote__gains">
            <li>Awakening: {'★'.repeat(n) || '-- --'} → <span class="grant">{'★'.repeat(n + 1)}</span></li>
            <li>Stats: +{pct(shadows.growth(sh))}% → <span class="grant">+{pct(shadows.growth(sh) + shadows.AWAKENING.growth)}%</span></li>
          </ul>
          {ready && <HoldButton hold={{ label: 'Hold To Awaken', ms: 1800, ticks: 5, holding: 'Awakening…', done: 'Awakened', after: 260 }} onFire={() => void go()} />}
        </>
      )}
    </section>
  );
}

/**
 * Its stats, as Solo Leveling: Arise lists them: a row each, its mark, its name and its value, and what
 * its level and stars have added to its creature's own, in green. Over them, how far it has grown of the
 * most it can.
 */
function Stats({ sh, e }: { sh: Shadow; e: Enemy }) {
  const now = shadows.statsOf(sh);
  return (
    <Section title="Stats" right={<span class="num">Growth <span class="grant">+{pct(shadows.growth(sh))}%</span> / +{pct(shadows.MAX_GROWTH)}%</span>}>
      <ul class="sysbox sp-statrows">
        {ORDER.map((k) => (
          <li key={k}>
            <Glyph name={STAT_ICON[k] ?? 'star'} />
            <span class="sp-statrows__name">{k}</span>
            <b class="num">{now[k]}</b>
            <small class="num grant">{now[k] > e.base[k] ? `+${now[k] - e.base[k]}` : ''}</small>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** What it fights with: its skills, the second sealed until the rank that remembers it; and its traits. */
function Kit({ sh, e }: { sh: Shadow; e: Enemy }) {
  const known = shadows.kitOf(sh);
  const names = [e.kit[0], shadows.secondOf(e)].filter((n): n is string => !!n);
  const traits = !!e.passive || e.imm.length > 0 || e.res.length > 0;
  return (
    <>
      <Section title="Skills">
        <div class="sp-skills">
          {names.map((n) => {
            const a = ability(n);
            const on = known.includes(n);
            return (
              <div key={n} class={`sysbox sp-skill ${on ? '' : 'is-sealed'}`}>
                <span class="sp-skill__ico"><Glyph name={!on ? 'lock' : a?.type === 'magic' ? 'bolt' : 'fist'} /></span>
                <span class="sp-skill__body">
                  <b>[Skill: {n}]</b>
                  <small>{on ? (a ? skillLine(a) : '-- --') : `${shadows.SHADOW_RANKS[shadows.SECOND_AT].name} Rank`}</small>
                  {on && !e.kit.includes(n) && <small class="muted">From its kin</small>}
                </span>
              </div>
            );
          })}
        </div>
      </Section>
      {traits && (
        <Section title="Traits">
          <div class="sp-traits">
            {e.passive && (
              <div class="sysbox sp-skill is-passive">
                <span class="sp-skill__ico"><Glyph name="star" /></span>
                <span class="sp-skill__body"><b>[Passive: {e.passive}]</b><small>{passiveText(e.passive)}</small></span>
              </div>
            )}
            {(e.imm.length > 0 || e.res.length > 0) && (
              <div class="chips">
                {e.imm.map((x) => <Chip key={x} tone="verdant">Immune: {x}</Chip>)}
                {e.res.map((x) => <Chip key={x}>Resists: {x}</Chip>)}
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  );
}

/** What it has done: runs walked into, creatures and bosses it helped fell, and days served. */
function Record({ sh }: { sh: Shadow }) {
  const days = Math.max(0, daysBetween(sh.boundAt, dayKey()));
  return (
    <Section title="Record">
      <div class="sp-record">
        <span><b class="num">{sh.out}</b><small>Deployed</small></span>
        <span><b class="num">{sh.kills}</b><small>Defeated</small></span>
        <span><b class="num">{sh.bosses}</b><small>Bosses</small></span>
        <span><b class="num">{days}</b><small>Days served</small></span>
      </div>
    </Section>
  );
}

/** Release, for Shadow Essence: the System's offer first, and the card closes on it. */
function Release({ sh, close }: { sh: Shadow; close: () => void }) {
  const s = useSave();
  const busy = shadows.inRun(s, sh.id);
  const n = shadows.releaseValue(sh);
  const go = async () => {
    const ok = await sys(system.offer([
      'Would you like to release this Shadow?',
      system.tag(shadows.nameOf(sh)),
      `Shadow Essence ${system.gain(system.signed(n))}`,
      system.red('A Shadow released is gone.'),
    ], 'shadow', 'Release', 'Cancel'));
    if (ok !== true) return;
    const got = store.update((x) => shadows.release(x, sh.id));
    if (got === null) return;
    close();
    sfx.blip();
    toast(`Released · Shadow Essence +${got}`, 'good');
  };
  return (
    <Btn class="sp-release" block disabled={busy} onClick={() => void go()}>
      <Glyph name="trash" /> {busy ? 'Release · In a Gate' : <>Release · Shadow Essence <span class="num">+{n}</span></>}
    </Btn>
  );
}

// ------------------------------------------------------------------ after a run

/**
 * What a run did to the deployed Shadows, on the results: an alert to each that levelled up or that the
 * run made ready for promotion, its badge, its level and the XP it took, and a meter that moves from
 * where it stood. A Shadow that only took XP gets none. One made ready says so, and nothing more: the
 * Shadows tab's mark shows where to go.
 */
export function ShadowAlerts({ grew, ready, delay = 500 }: { grew: RaidResult['grew']; ready: RaidResult['ready']; delay?: number }) {
  const s = useSave();
  const rows = grew
    .filter((g) => g.to > g.from || ready.some((p) => p.id === g.id))
    .map((g) => ({ g, sh: s.shadows.army.find((x) => x.id === g.id) }))
    .filter((x): x is { g: RaidResult['grew'][number]; sh: Shadow } => !!x.sh);
  if (!rows.length) return null;
  return (
    <div class="alerts shadowalerts" aria-label="Army">
      {rows.map(({ g, sh }, i) => {
        const e = enemyById(sh.enemyId)!;
        const made = ready.some((p) => p.id === g.id);
        const name = shadows.nameOf(sh);
        const up = g.to > g.from;
        const cap = shadows.rankOf(sh).cap;
        const capped = g.to >= cap;
        // Where the meter stood before the run, and where it stands now, as shares of a level: full at the cap.
        const share = (lv: number, xp: number) => (lv >= cap ? 1 : unit((xp - shadows.xpAt(lv)) / shadows.xpToNext(lv)));
        const now = share(g.to, sh.xp);
        const was = share(g.from, sh.xp - g.xp);
        return (
          <SysAlert key={g.id} kind="shadow" fyi delay={delay + i * 180} class={`is-shadowline ${made ? 'is-ready' : ''}`}
            icon={<ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={34} />}
            meter={{ from: up ? was : Math.min(was, now), to: now, up }}
            aside={g.xp > 0 ? <span class="num">XP <span class="grant">+{g.xp}</span></span> : null}
            sub={made ? undefined : <span class="num">{up ? <>Lv.{g.from} → <span class="grant">Lv.{g.to}</span></> : `Lv.${g.to}`}{capped ? ' · Level cap' : ''}</span>}>
            {made ? <><strong>[{name}]</strong> has met the requirements for promotion.</>
              : <><strong>[{name}]</strong> has levelled up.</>}
          </SysAlert>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ names

/**
 * "You may bestow a name.": the field across the window, how much of the name is used, and the two
 * acts under it, the way out first. Empty takes a name away.
 */
export function NameField({ id, close, skip = 'Not Now' }: { id: string; close: (v: unknown) => void; skip?: string }) {
  const sh = store.get().shadows.army.find((x) => x.id === id);
  const [v, setV] = useState(sh?.name ?? '');
  if (!sh) return null;
  const creature = enemyById(sh.enemyId)?.name ?? 'Shadow';
  const submit = (e: Event) => {
    e.preventDefault();
    const kept = store.update((x) => shadows.rename(x, id, v));
    sfx.success();
    if (kept) toast(`Named: ${kept}`, 'good');
    close(kept ?? '');
  };
  return (
    <form class="namefield" onSubmit={submit}>
      <label class="sysbox namefield__box">
        <input class="namefield__input" value={v} maxLength={shadows.NAME_MAX} placeholder={creature}
          aria-label="Name" autoComplete="off" spellcheck={false} onInput={(e) => setV((e.currentTarget as HTMLInputElement).value)} />
        <span class="namefield__count num" aria-hidden="true">{v.length}/{shadows.NAME_MAX}</span>
      </label>
      <div class="namefield__acts">
        <Btn onClick={() => close(null)}>{skip}</Btn>
        <Btn kind="primary" type="submit" disabled={!v.trim() && !sh.name}>{v.trim() || !sh.name ? 'Bestow' : 'Take Away'}</Btn>
      </div>
    </form>
  );
}

/** The System's offer of a name, for a Shadow already bound: from its card. */
export function nameShadow(id: string) {
  return sys({
    title: 'Notification', kind: 'shadow', typed: false,
    lines: ['You may bestow a name.'],
    body: (close) => <NameField id={id} close={close} skip="Cancel" />,
    actions: [],
  });
}
