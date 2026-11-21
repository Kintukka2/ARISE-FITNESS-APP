/**
 * The Shadow army, as a bento grid: the Army, its squad over the reserve, opening the roster where the
 * squad is made; and the Orders under it.
 */
import { powerText } from '@/ui/power';
import { sfx } from '@/audio/audio';
import { ability, passiveFor, TACTICS } from '@/core/combat';
import { dungeonById, enemyById } from '@/core/gates';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Empty, Facts, RankPlate, Section } from '@/ui/components';
import * as kin from '@/core/kin';
import type { Enemy, Save, Shadow, Stat, Tactic } from '@/core/types';
import { RANKS } from '@/core/types';
import type { RaidResult } from '@/core/raid';
import * as system from '@/ui/system';
import { skillLine } from './Skills';
import { SysAlert, SysFrame } from '@/ui/frame';
import { Glyph } from '@/ui/icons';
import { FamilyGlyph, Insignia, ShadowEmblem } from '@/ui/emblems';
import { Portrait } from '@/ui/portraits';
import { familyTip, KIN_TIER, KinHex, KinTracker, ROLE_TIER, roleTip } from '@/ui/kin';
import { InfoTag } from '@/ui/infotag';
import { STYLE_GLYPH, styleOf, styleTip } from '@/ui/stand';
import { HoldButton, openSheet, sys, toast } from '@/ui/overlays';
import { buzz, flash } from '@/ui/feedback';
import { claimAll, claimPromotion } from '@/app/flow';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useDrag } from '@/ui/drag';
import { KeyedTips, WardLines } from '@/ui/wards';
import { StatRow } from '@/ui/statrow';
import { statTip } from '@/ui/stattip';
import { Tip, tipAt, type TipAt, type TipText } from '@/ui/tip';
import { ago, ordinal } from '@/ui/when';

export function Shadows() {
  const s = useSave();
  useEffect(() => { if (!story.seen(s, 'shadows-visited')) store.update((x) => story.markOnce(x, 'shadows-visited')); }, []);
  const fresh = s.shadows.fresh;
  // What joined since the last visit, held for this visit: the router clears `fresh` a few seconds in.
  const [news] = useState(() => [...fresh]);
  const joined = news.length === 1 ? enemyById(s.shadows.army.find((x) => x.id === news[0])?.enemyId ?? '')?.shadow : null;
  return (
    <div class="stack shadowhome">
      {news.length > 0 && (
        <SysAlert kind="shadow" fyi icon={<Glyph name="shadows" />} class="shadownews">
          {joined ? <><strong>[{joined}]</strong> has joined your army.</> : `[${news.length} Shadows have joined your army.]`}
        </SysAlert>
      )}
      <ArmyStage news={news} />
      <OrdersBand />
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

/**
 * Where each Shadow of the squad stands on the stage, after the Army of Shadows of Solo Leveling: Arise:
 * the first deployed in front at its centre, the rest in a V behind it, each a little smaller and higher,
 * a sixth on the ridge behind them. `x` is across the stage, `y` how far back, `s` its size.
 */
const FORMATION_AT: { x: number; y: number; s: number }[] = [
  { x: 50, y: 0, s: 1 }, { x: 25, y: 14, s: 0.66 }, { x: 75, y: 14, s: 0.66 },
  { x: 8, y: 26, s: 0.52 }, { x: 92, y: 26, s: 0.52 }, { x: 50, y: 40, s: 0.46 },
];

/** How many of the reserve stand in the fog behind the squad. */
const RESERVE_SHOWN = 6;

/**
 * The army, as Solo Leveling: Arise sets its Army of Shadows: a stage of violet fog with the squad
 * standing on it, the first deployed large and lit in front, the rest in a V behind it, the free slots
 * as outlines where a Shadow would stand, and the reserve as their families' shapes in the fog. Over it,
 * the squad's count and its power; under it, what its Kin and Formation give, as Teamfight Tactics lights
 * its traits, and the Essence, the bound and the reserve. A tap on the stage opens the Army. A promotion
 * or a star waiting lights the stage gold and puts the act at its foot.
 */
function ArmyStage({ news }: { news: string[] }) {
  const s = useSave();
  const n = shadows.slots(s);
  const squad = shadows.squad(s);
  const reserve = ranked(s).filter((x) => !squad.includes(x));
  const waiting = shadows.waitingAll(s);
  const lead = squad[0];
  const leadE = lead && enemyById(lead.enemyId);
  const m = kin.makeOf(squad);
  const lit = [
    ...m.kin.filter((k) => k.tier > 0).map((k) => ({ key: `kin:${k.family}`, family: k.family, role: undefined as string | undefined, n: k.n, name: `${k.family} ${KIN_TIER[k.tier - 1]}` })),
    ...m.roleLines.map((l) => ({ key: `role:${l.role}`, family: undefined as string | undefined, role: l.role, n: l.n, name: `${l.role} ${ROLE_TIER[l.tier - 1]}` })),
  ];
  const call = waiting.length > 0 || shadows.freeSlots(s) > 0;
  const places = Array.from({ length: Math.min(n, FORMATION_AT.length) }, (_, i) => i);
  const promos = shadows.promotable(s).length;
  return (
    <SysFrame kind="shadow" class={`armystage ${call ? 'is-call' : ''}`} label="Army">
      <header class="armystage__head">
        <span class="armystage__title">
          <small>Army of Shadows</small>
          <b>Squad <span class="num">{squad.length}/{n}</span></b>
        </span>
        <span class="armystage__power"><small>Squad Power</small><b class="num">{powerText(shadows.squadPower(s))}</b></span>
      </header>
      <button type="button" class="armystage__stage" onClick={() => { sfx.tap(); openArmy(news); }}
        aria-label={`Army. Squad ${squad.length} of ${n}${lead ? `, led by ${shadows.nameOf(lead)}` : ''}. Open the Army.`}>
        <span class="armystage__beam" aria-hidden="true" />
        <span class="armystage__fog" aria-hidden="true"><i /><i /><i /></span>
        <span class="armystage__ghosts" aria-hidden="true">
          {reserve.slice(0, RESERVE_SHOWN).map((sh, i) => (
            <i key={sh.id} style={`--i: ${i}; --x: ${8 + (i * 84) / Math.max(1, Math.min(reserve.length, RESERVE_SHOWN) - 1)}`}><Portrait id={sh.enemyId} size={36} tone="shadow" /></i>
          ))}
        </span>
        <span class="armystage__floor" aria-hidden="true" />
        <span class="armystage__line" aria-hidden="true">
          {places.map((i) => {
            const at = FORMATION_AT[i];
            const sh = squad[i];
            const e = sh && enemyById(sh.enemyId);
            const style = `--x: ${at.x}; --y: ${at.y}; --s: ${at.s}; --i: ${i}; z-index: ${10 - i}`;
            if (!sh || !e) return <span key={`free-${i}`} class="armystage__one is-free" style={style}><Glyph name="plus" /></span>;
            return (
              <span key={sh.id} class={`armystage__one ${i === 0 ? 'is-lead' : ''} ${shadows.waiting(s, sh) ? 'is-ready' : ''}`} style={style}>
                {i === 0 && <span class="armystage__aura" />}
                <ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(sh)} size={92} />
                {i > 0 && <small>{shortName(sh)}</small>}
              </span>
            );
          })}
        </span>
        <span class="armystage__lead">
          {lead && leadE
            ? <>
              <b>{shortName(lead)}</b>
              <small><Insignia rank={shadows.rankIndex(lead)} size={12} /><Facts items={[shadows.rankOf(lead).name, <span class="num">Lv.{shadows.levelOf(lead)}</span>]} />{shadows.starsOf(lead) > 0 && <span class="armystage__stars"> {'★'.repeat(shadows.starsOf(lead))}</span>}</small>
            </>
            : <b>No Shadow deployed</b>}
        </span>
      </button>
      {lit.length > 0 && (
        <ul class="armystage__traits" aria-label="Kin and role bonuses">
          {lit.map((t) => (
            <li key={t.key} title={t.name}>
              <KinHex family={t.family} role={t.role} on />
              <span><b class="num">{t.n}</b> {t.name}</span>
            </li>
          ))}
        </ul>
      )}
      {waiting.length > 0
        ? <button type="button" class="armystage__call" onClick={(ev) => { sfx.tap(); void claimAll(ev.currentTarget); }}>
          <Glyph name="up" /><span>{promos ? 'Promotion ready' : 'Awakening ready'}: <b class="num">{waiting.length}</b></span><Glyph name="chevron" class="armystage__go" />
        </button>
        : shadows.freeSlots(s) > 0
          ? <button type="button" class="armystage__call" onClick={() => { sfx.tap(); openArmy(news); }}>
            <Glyph name="plus" /><span>Shadow slots free: <b class="num">{shadows.freeSlots(s)}</b></span><Glyph name="chevron" class="armystage__go" />
          </button>
          : null}
      <footer class="armystage__foot">
        <span class="armystage__stat"><EssenceMark /><b class="num">{s.shadows.essence ?? 0}</b><small>Shadow Essence</small></span>
        <span class="armystage__stat"><b class="num">{s.shadows.army.length}</b><small>Bound</small></span>
        <span class="armystage__stat"><b class="num">{reserve.length}</b><small>Reserve</small></span>
      </footer>
    </SysFrame>
  );
}

/**
 * The standing orders, set where they are read: a mark over a name each, the one set lit, and what it
 * does under them. A tap sets it at once; a step underway keeps the orders it opened with.
 */
function OrdersBand() {
  const s = useSave();
  const t = s.gates.tactic ?? 'default';
  const run = s.gates.raid;
  const held = run && run.tactic !== t ? tacticName(run.tactic) : null;
  const set = (k: Tactic) => {
    if (k === t) return;
    store.update((x) => { const r = x.gates.raid ?? null; raid.setTactic(x, r ? dungeonById(r.dungeonId) ?? null : null, r, k); });
    sfx.blip();
  };
  const now = TACTICS.find((x) => x.key === t) ?? TACTICS[0];
  return (
    <SysFrame kind="shadow" class="ordersband" label="Standing orders">
      <header class="ordersband__head"><span class="label">Standing Orders</span><small>Shadows and Auto</small></header>
      <div class="ordersband__set" role="radiogroup" aria-label="Standing orders">
        {TACTICS.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={x.key === t} class={`ordersband__one ${x.key === t ? 'is-on' : ''}`} onClick={() => set(x.key)}>
            <Glyph name={TACTIC_GLYPH[x.key]} />
            <small>{x.name}</small>
          </button>
        ))}
      </div>
      <p class="ordersband__desc">{now.desc}</p>
      {held && <small class="ordersband__held">Step underway: {held}</small>}
    </SysFrame>
  );
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
export function openArmy(news: string[] = []) {
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
        <span><b class="num">{powerText(shadows.squadPower(s))}</b><small>Squad Power</small></span>
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
      <Section title="Squad" right={(
        <span class="roster__headacts">
          <Btn class="roster__act" size="sm" disabled={settled} onClick={() => { store.update((x) => shadows.autoDeploy(x)); sfx.blip(); toast('Squad deployed.', 'good'); }}><Glyph name="shadows" /> Auto Deploy</Btn>
          <Btn class="roster__act" size="sm" disabled={!squad.length} title="Recall the squad" onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall</Btn>
          <span class="num roster__count">{squad.length}/{n}</span>
        </span>
      )}>
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
                  <span class="roster__slot-badge"><ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(sh)} size={40} /></span>
                  <b>{shortName(sh)}</b>
                  <small class="num"><Facts items={[`Lv.${shadows.levelOf(sh)}`, `Power ${powerText(shadows.power(sh))}`]} /></small>
                </button>
                <button type="button" class="roster__slot-x" aria-label={`Take out: ${shadows.nameOf(sh)}`} title="Take out"
                  onPointerDown={(ev) => ev.stopPropagation()} onClick={() => move(sh.id)}><Glyph name="close" /></button>
              </div>
            );
          })}
        </div>
        <KinTracker squad={squad} />
      </Section>
      <div class={`roster__out ${drag.over === 'out' && held && squad.includes(held) ? 'is-over' : ''}`} data-drop="out">
      <div class="roster__tools" ref={listRef}>
        <div class="rostabs" role="tablist" aria-label="Show">
          {SHOWS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={show === x.key} class={`rostab ${show === x.key ? 'is-on' : ''} ${x.key === 'ready' && counts.ready ? 'is-call' : ''}`} onClick={() => pick(x.key)}>
              {x.name}<small class="num">{counts[x.key]}</small>
            </button>
          ))}
        </div>
        <div class="roster__bar">
          <button type="button" class="roster__sort" onClick={() => order(SORTS[(SORTS.findIndex((x) => x.key === sort) + 1) % SORTS.length].key)}>
            <Glyph name="swap" /> Sort: {SORTS.find((x) => x.key === sort)!.name}
          </button>
          <span class="roster__views">
            {(['list', 'grid'] as const).map((k) => (
              <button key={k} type="button" aria-label={k === 'list' ? 'List' : 'Grid'} aria-pressed={view === k} class={`roster__view ${view === k ? 'is-on' : ''}`} onClick={() => look(k)}><Glyph name={k} /></button>
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
          {held && heldE && <><ShadowEmblem family={heldE.family} id={heldE.id} rank={shadows.rankIndex(held)} size={40} /><b>{shortName(held)}</b></>}
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
          <ShadowEmblem family={e.family} id={e.id} rank={at} size={40} />
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
        <b class="roster__power num">{powerText(shadows.power(sh))}</b>
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
      <span class="rostercard__top"><RankPlate rank={e.rank} size={14} /><b class="num">{powerText(shadows.power(sh))}</b></span>
      <span class="rostercard__art">
        <svg viewBox="0 0 100 100" class="rostercard__ring" aria-hidden="true">
          <circle cx="50" cy="50" r="40" class="rostercard__track" />
          <circle cx="50" cy="50" r="40" class="rostercard__fill" style={`stroke-dasharray: ${c * share(sh)} ${c}`} />
        </svg>
        <ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(sh)} size={40} />
      </span>
      <small class="rostercard__name">{shortName(sh)}</small>
      <small class="rostercard__lv num"><Facts items={[`Lv.${shadows.levelOf(sh)}`, ready ? 'Ready' : fresh ? 'New' : null]} /></small>
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

// ------------------------------------------------------------------ the card

/**
 * Open a Shadow's card. Its header reads its name as it stands, so a name bestowed from the pencil at the header's
 * right shows at once.
 */
export function openShadow(id: string) {
  const was = (() => { const at = store.get().shadows.army.find((x) => x.id === id); return at && enemyById(at.enemyId); })();
  openSheet({
    title: () => {
      const at = store.get().shadows.army.find((x) => x.id === id);
      return `Shadow: ${at ? shadows.nameOf(at) : 'Unknown'}`;
    },
    system: { icon: was ? <CardBadge id={id} /> : null, kind: 'shadow' },
    extra: () => <NameEdit id={id} />,
    render: (close) => <ShadowCard id={id} close={close} />,
  });
}

/** The card's badge, in its icon box: the rank it holds, as it changes. */
function CardBadge({ id }: { id: string }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  const e = sh && enemyById(sh.enemyId);
  return e ? <ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(sh!)} size={44} /> : null;
}

/**
 * The pencil at the far right of the card's header, where a hunter's card keeps its star (the owner's call, where a
 * `Name` button stood under the head): a tap opens the window that bestows a name.
 */
function NameEdit({ id }: { id: string }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return null;
  return (
    <button type="button" class="headedit" aria-label={sh.name ? `Rename ${shadows.nameOf(sh)}` : `Name ${shadows.nameOf(sh)}`}
      onClick={() => { sfx.tap(); void nameShadow(id); }}>
      <Glyph name="edit" />
    </button>
  );
}

const ORDER = ['STR', 'VIT', 'AGI', 'INT', 'PER'] as const;
const unit = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(x * 100);

/**
 * A Shadow's card, set out as an Association hunter's is (the owner's call): its head, then `Stats`, `Skills & Traits`
 * and `History`, each opening on its label and a hairline in the Shadows' violet; then its release. What its next rank
 * asks is its rank's tooltip, and a promotion or a star waiting turns the rank gold.
 */
function ShadowCard({ id, close }: { id: string; close: () => void }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return <Empty>That Shadow is gone.</Empty>;
  const e = enemyById(sh.enemyId)!;
  return (
    <div class="stack shadowcard">
      <Profile sh={sh} e={e} />
      <Stats sh={sh} e={e} />
      <Kit sh={sh} e={e} />
      <History sh={sh} />
      <Release sh={sh} close={close} />
    </div>
  );
}

/**
 * The head of the card, after the info panel of Solo Leveling: Arise's Army of Shadows: its badge inside the ring of
 * its next level, its creature's grade pinned to the badge's corner; beside it what it was (small, as the panel's
 * epithet), whether it is deployed on a row of its own, then a row to each of `Rank | Bound`, `Lv. | 3/10` over its XP,
 * and `Power | 80`; its family, role and how it fights under them.
 * - `Deployed` and `Not deployed` are the one button that puts it in the squad or takes it out (the owner's call, where
 *   `Deploy` and `Recall` stood under the head).
 * - Its rank tells what the next asks when tapped (`rankTip`); while a promotion or a star waits, the whole head is
 *   lit gold, `Promotion ready` at its corner, and a tap anywhere on it opens it (`openRankUp`).
 */
function Profile({ sh, e }: { sh: Shadow; e: Enemy }) {
  const s = useSave();
  const squad = shadows.squad(s);
  const on = squad.includes(sh);
  const full = !on && squad.length >= shadows.slots(s);
  // The breakpoint its family's Kin reaches in the squad as it stands, lit in its tooltip.
  const make = kin.makeOf(squad);
  const kinTier = e.family === kin.KIN_ALL ? Math.max(0, ...make.kin.map((k) => k.tier)) : make.kin.find((k) => k.family === e.family)?.tier ?? 0;
  const roleTier = make.roleLines.find((l) => l.role === e.role)?.tier ?? 0;
  const at = shadows.rankIndex(sh);
  const lv = shadows.levelOf(sh);
  const p = shadows.progress(sh);
  const top = lv >= shadows.MAX_LEVEL;
  const ready = shadows.waiting(s, sh);
  const share = p.need ? p.into / p.need : 1;
  const c = 2 * Math.PI * 52;
  const name = shadows.nameOf(sh);
  // A promotion or a star waiting on the hunter: the whole head turns gold and opens it (the owner's call, where the
  // rank alone was a gold button).
  const promote = shadows.canPromote(s, sh);
  const call = promote || shadows.canAwaken(s, sh);
  const rankUp = () => { sfx.tap(); openRankUp(sh.id); };
  const deploy = (ev: Event) => {
    ev.stopPropagation();
    if (full) { sfx.tap(); toast('The squad is full.', 'warn'); return; }
    store.update((x) => shadows.toggleDeploy(x, sh.id));
    sfx.blip();
  };
  return (
    <section class={`sysbox sp-head sp-head--shadow ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''} ${call ? 'is-call' : ''} ${p.need ? '' : 'is-capped'}`}
      {...(call ? {
        role: 'button', tabIndex: 0, 'aria-haspopup': 'dialog' as const,
        'aria-label': `${name}: ${promote ? 'Promotion' : 'Awakening'} ready. Open it`,
        onClick: rankUp,
        onKeyDown: (ev: KeyboardEvent) => { if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); rankUp(); } },
      } : {})}>
      {call && <span class="sp-head__call" aria-hidden="true">{promote ? 'Promotion ready' : 'Awakening ready'}<Glyph name="chevron" /></span>}
      <div class="sp-head__badge">
        <svg viewBox="0 0 120 120" class="sp-ring" aria-hidden="true">
          <circle cx="60" cy="60" r="58" class="sp-ring__runes" />
          <circle cx="60" cy="60" r="52" class="sp-ring__track" />
          <circle cx="60" cy="60" r="52" class="sp-ring__fill" style={`stroke-dasharray: ${c * unit(share)} ${c}`} />
        </svg>
        <span class="sp-head__smoke" />
        <ShadowEmblem family={e.family} id={e.id} rank={at} size={62} />
        {shadows.starsOf(sh) > 0 && <span class="sp-head__stars"><Stars n={shadows.starsOf(sh)} /></span>}
        {/* Its creature's grade, pinned to the badge's corner as a unit portrait wears its grade (the owner's call, where it led the tags). */}
        <span class="sp-head__grade" role="img" aria-label={`${e.rank}-Rank`}><RankPlate rank={e.rank} size={20} /></span>
      </div>
      <div class="sp-head__who">
        {/* What it was, one line: every Shadow's other name is only `Shadow` and this. */}
        <span class="sp-head__was"><span class="sp-head__kind">{e.name}</span></span>
        {/* Whether it is in the squad, on a row of its own so a long name never moves it (the owner's call); a tap changes it. */}
        <button type="button" class={`sp-tag sp-head__state ${on ? 'is-on' : ''} ${full ? 'is-full' : ''}`} aria-pressed={on}
          aria-label={on ? `Deployed. Take ${name} out of the squad` : full ? 'Not deployed. The squad is full' : `Not deployed. Deploy ${name}`}
          onClick={deploy}>
          <Glyph name={on ? 'check' : 'plus'} />{on ? 'Deployed' : 'Not deployed'}
        </button>
        <dl class="sp-rows">
          <div class="sp-row">
            <dt>Rank</dt>
            <dd class="sp-row__rank"><RankWord sh={sh} e={e} plain={call} /></dd>
          </div>
          <div class="sp-row sp-row--lv">
            <dt>Lv.</dt>
            <dd class="num"><span>{top ? 'MAX' : lv}{!top && <small>/{shadows.rankOf(sh).cap}</small>}</span></dd>
          </div>
          {/* Its XP beside the bar, on the bar's own line, so a narrow phone never runs the level into it. At the cap the
              full bar and `10/10` say so, and no figure stands beside it. */}
          <div class="sp-xp">
            <span class="sp-exp" aria-hidden="true"><i style={`width: ${pct(unit(share))}%`} /></span>
            {!top && p.need > 0 && <small class="sp-xp__n num">XP {p.into}/{p.need}</small>}
          </div>
          <div class="sp-row">
            <dt>Power</dt>
            <dd class="sp-row__power num">{powerText(shadows.power(sh))}</dd>
          </div>
        </dl>
      </div>
      {/* Under the badge and the rows, across the panel, so its three tags keep one line on a phone. */}
      <span class="sp-head__tags">
        {/* Family and role tell what they are to the squad when tapped, and how it fights where it takes its place. */}
        <InfoTag class="sp-tag" tip={familyTip(e.family, kinTier)}><FamilyGlyph family={e.family} size={13} />{e.family}</InfoTag>
        <InfoTag class="sp-tag" tip={roleTip(e.role, roleTier)}>{e.role}</InfoTag>
        <InfoTag class="sp-tag sp-tag--style" tip={styleTip(e.role)}><Glyph name={STYLE_GLYPH[styleOf(e.role)]} />{styleOf(e.role)}</InfoTag>
      </span>
    </section>
  );
}

/**
 * The rank in its row (the owner's call, where a `Next rank` box stood under the head): the word alone, underlined as
 * every word that tells what it is, opening what the next rank asks. While a promotion or a star waits (`plain`), the
 * word stands plain in gold: the head round it is the button. The badge beside it wears the rank's chevrons, so the
 * row carries no insignia of its own.
 */
function RankWord({ sh, e, plain }: { sh: Shadow; e: Enemy; plain?: boolean }) {
  const s = useSave();
  const name = shadows.rankOf(sh).name;
  if (plain) return <span class="sp-rank is-ready">{name}</span>;
  return <InfoTag class="sp-rank" tip={rankTip(s, sh, e)}><span class="sp-rank__name">{name}</span></InfoTag>;
}

const bosses = (n: number) => `${n} ${n === 1 ? 'boss' : 'bosses'}`;

/**
 * A Shadow's rank in the game's one tooltip: its insignia and name, `Rank` at the right; what raises it to the next and
 * what that brings, told as a fight's tip tells a habit; then what it asks, each met or not (`TipText.needs`). At the top
 * rank, what a star of Awakening asks and adds, until every star is held.
 */
export function rankTip(s: Save, sh: Shadow, e: Enemy): TipText {
  const at = shadows.rankIndex(sh);
  const here = shadows.rankOf(sh);
  const next = shadows.nextRank(sh);
  const head = { title: `${here.name} Rank`, kind: 'Rank', tone: 'shadow' as const, mark: <span class="tip__mark"><Insignia rank={at} size={16} /></span> };
  if (next) {
    const second = at + 1 === shadows.SECOND_AT ? shadows.secondOf(e) : null;
    const by = [`At Level ${here.cap}`, ...(next.bosses ? [`with ${bosses(next.bosses)} defeated`] : [])].join(', ');
    return {
      ...head,
      lines: [
        next.essence ? `${by}, ${next.essence} Shadow Essence raises it to ${next.name} Rank.` : `${by}, it rises to ${next.name} Rank.`,
        `Level cap: ${here.cap} → ${next.cap}.${second ? ` Learns ${second}.` : ''}`,
      ],
      needs: shadows.requirements(s, sh).map((r) => ({ label: r.label, have: r.have, need: r.need, met: r.met })),
    };
  }
  const cost = shadows.awakenCost(sh);
  if (cost === null) return { ...head, lines: ['The highest rank, every star awakened.', `Every stat is grown +${pct(shadows.growth(sh))}%.`] };
  const essence = s.shadows.essence ?? 0;
  return {
    ...head,
    lines: [
      `The highest rank. At Level ${shadows.MAX_LEVEL}, ${cost} Shadow Essence awakens it a star.`,
      `Each star grows every stat +${pct(shadows.AWAKENING.growth)}% more.`,
    ],
    needs: [
      { label: 'Level', have: shadows.levelOf(sh), need: shadows.MAX_LEVEL, met: shadows.atTop(sh) },
      { label: 'Shadow Essence', have: essence, need: cost, met: essence >= cost },
    ],
  };
}

/**
 * A promotion or a star waiting, in a window of its own, opened by the gold rank on the card: the badge now and at the
 * rank above, what it asks and brings, and the hold that claims it. The window closes once it is claimed.
 */
export function openRankUp(id: string) {
  const sh = store.get().shadows.army.find((x) => x.id === id);
  if (!sh) return;
  openSheet({
    title: shadows.nextRank(sh) ? 'Promotion' : 'Awakening',
    system: { icon: <CardBadge id={id} />, kind: 'shadow' },
    render: (close) => <RankUp id={id} close={close} />,
  });
}

function RankUp({ id, close }: { id: string; close: () => void }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return <Empty>That Shadow is gone.</Empty>;
  const e = enemyById(sh.enemyId)!;
  return shadows.nextRank(sh) ? <Promotion sh={sh} e={e} close={close} /> : <Awakening sh={sh} close={close} />;
}

/**
 * The rank above: what it asks, each met or not, and what it brings; once all is met, its badge now and at the rank
 * above, and the hold that claims it. The badge lifts off into the promotion (`claimPromotion`).
 */
function Promotion({ sh, e, close }: { sh: Shadow; e: Enemy; close: () => void }) {
  const s = useSave();
  const badge = useRef<HTMLSpanElement>(null);
  const next = shadows.nextRank(sh)!;
  const at = shadows.rankIndex(sh);
  const need = shadows.requirements(s, sh);
  const ready = need.every((r) => r.met);
  const second = at + 1 === shadows.SECOND_AT ? shadows.secondOf(e) : null;
  return (
    <section class={`sysbox sp-next ${ready ? 'promote' : ''}`} key={at}>
      <header class="sp-next__head">
        <span class="label">{shadows.nameOf(sh)}</span>
        <span class="sa-rank"><Insignia rank={at + 1} size={14} />{next.name} Rank</span>
      </header>
      <div class="rankplates promote__plates" aria-label={`${shadows.rankOf(sh).name} Rank to ${next.name} Rank`}>
        <span class="rankplates__from" ref={badge}><ShadowEmblem family={e.family} id={e.id} rank={at} size={60} /></span>
        <span class="rankplates__path" style="--p: 1" aria-hidden="true"><i /></span>
        <span class="rankplates__to"><ShadowEmblem family={e.family} id={e.id} rank={at + 1} size={60} /></span>
      </div>
      <Asks needs={need} />
      <ul class="promote__gains">
        <li>Level cap: {shadows.rankOf(sh).cap} → <span class="grant">{next.cap}</span></li>
        {second && <li>Skill: <strong>[{second}]</strong></li>}
      </ul>
      {ready && <HoldButton hold={{ label: 'Hold To Promote', ms: 2000, ticks: 5, holding: 'Promoting…', done: 'Promoted', after: 260 }}
        onFire={() => void claimPromotion(sh.id, badge.current?.querySelector('svg') ?? badge.current).then(close)} />}
    </section>
  );
}

/** What a rank or a star asks, each a line with its own bar, ticked once met. */
function Asks({ needs }: { needs: { key: string; label: string; have: number; need: number; met: boolean }[] }) {
  return (
    <ul class="sp-reqs">
      {needs.map((r) => (
        <li key={r.key} class={r.met ? 'is-met' : ''}>
          <Glyph name={r.met ? 'check' : 'lock'} />
          <span>{r.label}</span>
          <b class="num">{r.have}/{r.need}</b>
          <i class="sp-reqs__bar" aria-hidden="true"><i style={`width: ${pct(unit(r.have / r.need))}%`} /></i>
        </li>
      ))}
    </ul>
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
 * Awakening, once a Shadow is Ascendant: its stars, what the next asks (its level at the cap and the Shadow Essence it
 * costs) and what it adds; once all is met, the hold that takes it, and the window closes on it.
 */
function Awakening({ sh, close }: { sh: Shadow; close: () => void }) {
  const s = useSave();
  const n = shadows.starsOf(sh);
  const cost = shadows.awakenCost(sh);
  const ready = shadows.canAwaken(s, sh);
  const name = shadows.nameOf(sh);
  const essence = s.shadows.essence ?? 0;
  const go = async () => {
    const was = shadows.growth(sh);
    const got = store.update((x) => shadows.awaken(x, sh.id));
    if (!got) return;
    sfx.rankUp();
    flash('shadow');
    buzz([60, 90, 30, 60, 140]);
    const now = store.get().shadows.army.find((x) => x.id === sh.id);
    close();
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
        <span class="label">{name}</span>
        <Stars n={n} of={shadows.MAX_STARS} />
      </header>
      {cost === null ? (
        <ul class="promote__gains"><li>Stats: <span class="grant">+{pct(shadows.growth(sh))}%</span></li></ul>
      ) : (
        <>
          <Asks needs={[
            { key: 'level', label: 'Level', have: shadows.levelOf(sh), need: shadows.MAX_LEVEL, met: shadows.atTop(sh) },
            { key: 'essence', label: 'Shadow Essence', have: essence, need: cost, met: essence >= cost },
          ]} />
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
 * Its stats, a row to each, as an Association hunter's card sets theirs (`ui/statrow.tsx`): the mark in the Shadows'
 * violet, the key, a bar and the figure, its best stat lit in gold under `Best`. A full bar is the most its best stat can
 * grow to, so the five read against one another and against what is still to come. Each opens the one stat tooltip,
 * which tells its creature's own figure beside what its level and stars have made of it. Over them, how far it has grown
 * of the most it can.
 */
function Stats({ sh, e }: { sh: Shadow; e: Enemy }) {
  const now = shadows.statsOf(sh);
  const fig = (k: Stat) => Math.round(now[k]);
  const best = ORDER.reduce<Stat>((b, k) => (fig(k) > fig(b) ? k : b), ORDER[0]);
  const of = Math.max(1, ...ORDER.map((k) => e.base[k])) * (1 + shadows.MAX_GROWTH);
  const [why, setWhy] = useState<{ k: Stat; at: TipAt } | null>(null);
  return (
    <Section title="Stats" right={<span class="num">Growth <span class="grant">+{pct(shadows.growth(sh))}%</span> / +{pct(shadows.MAX_GROWTH)}%</span>}>
      <div class="statrows">
        {ORDER.map((k) => (
          <StatRow key={k} k={k} value={fig(k)} bar={fig(k)} of={of} best={best === k} open={why?.k === k}
            aside={best === k ? 'Best' : undefined} label={`${k} ${fig(k)}${best === k ? ', its best' : ''}`}
            onTap={(el) => { sfx.blip(); setWhy(why?.k === k ? null : { k, at: tipAt(el) }); }} />
        ))}
      </div>
      {why && <Tip tip={statTip(why.k, { shadow: { own: e.base[why.k], now: fig(why.k), best: best === why.k } })} at={why.at} close={() => setWhy(null)} />}
    </Section>
  );
}

/**
 * `Skills & Traits`, one section as an Association hunter's card has (the owner's call): its skills, the second sealed
 * until the rank that remembers it; under them its passive, and what it wards off.
 */
function Kit({ sh, e }: { sh: Shadow; e: Enemy }) {
  const known = shadows.kitOf(sh);
  const names = [e.kit[0], shadows.secondOf(e)].filter((n): n is string => !!n);
  return (
    <Section title="Skills & Traits">
      <div class="sp-skills">
        {names.map((n) => {
          const a = ability(n);
          const on = known.includes(n);
          return (
            <div key={n} class={`sp-skill ${on ? '' : 'is-sealed'}`}>
              <span class="sp-skill__ico"><Glyph name={!on ? 'lock' : a?.type === 'magic' ? 'bolt' : 'fist'} /></span>
              <span class="sp-skill__body">
                <b>[Skill: {n}]</b>
                <small>{on ? (a ? <KeyedTips text={skillLine(a)} tone="shadow" /> : '-- --') : `${shadows.SHADOW_RANKS[shadows.SECOND_AT].name} Rank`}</small>
                {on && !e.kit.includes(n) && <small class="muted">From its kin</small>}
              </span>
            </div>
          );
        })}
        {e.passive && (
          <div class="sp-skill is-passive">
            <span class="sp-skill__ico"><Glyph name="star" /></span>
            <span class="sp-skill__body"><b>[Passive: {e.passive}]</b><small><KeyedTips text={passiveFor(e.passive, shadows.statsOf(sh))} tone="shadow" /></small></span>
          </div>
        )}
      </div>
      {/* Listed as the creature card lists them, each status's word opening what the ward does (ui/wards.tsx). */}
      {(e.imm.length > 0 || e.res.length > 0) && <div class="sp-traits"><WardLines imm={e.imm} res={e.res} tone="shadow" /></div>}
    </Section>
  );
}

/** Where it stands among the army by the Gates it has walked, said as a hunter's card says a partner's place. */
function deployedLine(place: number, of: number): string {
  if (of <= 1) return 'Your only Shadow so far.';
  if (place === 1) return `Your most deployed Shadow, of ${of}.`;
  return `Your ${ordinal(place)} most deployed Shadow, of ${of}.`;
}

/**
 * `History`, as an Association hunter's card keeps it (the owner's call, where it read `Record`): the Gates it has
 * walked, large, with where it stands among the army under it; what it has helped defeat, the creatures and the bosses;
 * and when it was bound.
 */
function History({ sh }: { sh: Shadow }) {
  const s = useSave();
  const army = s.shadows.army;
  const place = 1 + army.filter((x) => x.id !== sh.id && x.out > sh.out).length;
  return (
    <Section title="History">
      <div class="hc-history">
        {sh.out === 0
          ? <p class="hc-history__none">No Gates walked yet.</p>
          : (
            <>
              <div class="hc-history__lead">
                <b class="num">{sh.out}</b>
                <span class="hc-history__what">
                  <span>{sh.out === 1 ? 'Gate walked' : 'Gates walked'}</span>
                  <small class={place === 1 && army.length > 1 ? 'is-first' : ''}>{deployedLine(place, army.length)}</small>
                </span>
              </div>
              <div class="hc-history__figs">
                <span><b class="num">{sh.kills}</b><small>Creatures defeated</small></span>
                <span><b class="num">{sh.bosses}</b><small>Bosses defeated</small></span>
              </div>
            </>
          )}
        <dl class="hc-history__rows">
          <div><dt>Bound</dt><dd>{ago(sh.boundAt)}</dd></div>
        </dl>
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
    toast(`Released. Shadow Essence +${got}.`, 'good');
  };
  return (
    <Btn class="sp-release" block disabled={busy} onClick={() => void go()}>
      <Glyph name="trash" /> {busy ? 'In a Gate' : <>Release<span class="btn__aside">Shadow Essence <span class="num">+{n}</span></span></>}
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
            icon={<ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(sh)} size={34} />}
            meter={{ from: up ? was : Math.min(was, now), to: now, up }}
            aside={g.xp > 0 ? <span class="num">XP <span class="grant">+{g.xp}</span></span> : null}
            sub={made ? undefined : <span class="num">{up ? <>Lv.{g.from} → <span class="grant">Lv.{g.to}</span></> : `Lv.${g.to}`}{capped ? <span class="btn__aside">Level cap</span> : ''}</span>}>
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
