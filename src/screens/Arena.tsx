/**
 * The arena: the gate's map, and the fights on it. The hunter picks each step;
 * a fight is fought up to the hunter's turn by the engine, played back beat by
 * beat, then waits for an order. Every step, choice and order goes to the save
 * before it plays, so leaving at any point and coming back lands in the same place.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import type { Ev, Intent as CombatIntent, Reckoning, Threat, Turn } from '@/core/combat';
import { TRICKS, type TrickId } from '@/data/tricks';
import { Keyed } from '@/ui/keyed';
import { CONDITION, type ConditionId } from '@/data/drops';
import { FEAT_PAY, FEATS } from '@/data/feats';
import { SEALS } from '@/data/seals';
import * as sealing from '@/core/seals';
import { conditionLine, dropGlyph, dropPay } from '@/ui/conditions';
import { ability, COVER, finishers, POTION_HEAL, GUARD, STATUS, STATUS_TEXT, THROWABLES, throwOrder, type ThrowId } from '@/core/combat';
import * as skilltree from '@/core/skilltree';
import { NODES } from '@/data/tree';
import { TRICK } from '@/data/tricks';
import * as story from '@/core/story';
import type { Dungeon, Order } from '@/core/types';
import { dungeonById, enemyById, entryBlock, isPractice } from '@/core/gates';
import * as spire from '@/core/spire';
import { chamberOf, isFight, passages, type MapNode } from '@/core/map';
import { HONE_LEVELS, NODE } from '@/data/nodes';
import * as blessings from '@/core/blessings';
import { pathOf } from '@/data/tree';
import { BoonCard, BoonChip } from '@/ui/boons';
import { boonById, TIERS } from '@/data/blessings';
import { BLOCK } from '@/data/spire';
import * as ascension from '@/core/ascension';
import { isTrial } from '@/core/trial';
import { OVERCHARGE } from '@/data/ascension';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import { CLOCK, type ClockState } from '@/core/clock';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as vitals from '@/core/vitals';
import { bagFor, enterGate, rewardChain } from '@/app/flow';
import { arena } from '@/app/router';
import * as store from '@/store';
import * as system from '@/ui/system';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, HpBar, RankPlate, Shards } from '@/ui/components';
import { QuestLines } from '@/ui/contracts';
import { AssocStrip } from '@/ui/assoc';
import * as association from '@/core/association';
import { SysAlert } from '@/ui/frame';
import { FamilyGlyph, ShadowEmblem } from '@/ui/emblems';
import { MapView } from '@/ui/map';
import { ItemsMark } from '@/ui/items';
import { buzz, flash } from '@/ui/feedback';
import { Glyph, Shard, SKILL_GLYPH, STAT_ICON, THROW_GLYPH } from '@/ui/icons';
import { ringIndex, ringMid, ringSlot } from '@/ui/items';
import { drinkFlow } from './Inventory';
import { openItem } from './Gear';
import { openBlueprint } from './Forge';
import * as forge from '@/core/forge';
import { bundleText, MatList } from '@/ui/forge';
import { LootCell, useReveal, type Loot } from '@/ui/loot';
import { lines, toBeats, type Beat } from '@/ui/log';
import { HoldButton, openSheet, pushBack, sys } from '@/ui/overlays';
import { EssenceMark, NameField, ShadowAlerts } from './Shadows';

interface UnitView {
  uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[]; intent?: IntentView; tricks?: TrickId[];
  /** A foe's grade, which sets its behaviours' numbers. */
  grade?: string;
  /** A foe's creature, its condition drop, and whether it is the chamber's boss. */
  ref?: string; cond?: ConditionId; boss?: boolean;
}

/** A foe's next action as its card shows it: the engine's intent, and whether a break has cancelled it. */
type IntentView = CombatIntent & { broken?: boolean };

const PACE = { 1: 650, 2: 300, skip: 0 } as const;
type Pace = keyof typeof PACE;


/** A skill's level and readiness, for the hub: `Lv.2` or `Lv.MAX`, and `Ready` or `Ready in 2`. */
function skillState(s: ReturnType<typeof store.get>, use: string, turn: Turn): { level: string | null; ready: string | null } {
  const k = turn.skills.find((x) => x.ability.name === use);
  if (!k) return { level: null, ready: null };
  const node = NODES.find((n) => n.kind === 'skill' && n.skill === use && skilltree.levelOf(s, n.id) > 0);
  const lv = node ? skilltree.levelOf(s, node.id) : 0;
  return { level: node ? (lv >= node.max ? 'Lv.MAX' : `Lv.${lv}`) : null, ready: k.cd > 0 ? `Ready in ${k.cd}` : 'Ready' };
}

/** One slot of the action wheel: what it is, what it does on the foe aimed at, and whether it can be used. */
interface WheelAct {
  use: string;
  name: string;
  glyph: string;
  /** Why it cannot be used now. Unset, it can. */
  off?: string;
  hit?: Reckoning;
  /** It fells the foe aimed at more surely than a Strike would: a finisher. */
  fell?: 'sure' | 'maybe';
  /** How many are held, for an item: a badge on its slot. */
  count?: number;
  /** The hub's lines, as shown and as read aloud. */
  shown: string[];
  said: string;
}

/** A range as a screen reader hears it: the page writes `3-4`, the voice says "3 to 4". */
const spoken = (lo: number, hi: number) => [lo, hi].join(' to ');

/** The glyph a skill wears on the wheel: its own, or its Path's for one drawn without one. */
const skillGlyph = (name: string) => SKILL_GLYPH[name] ?? STAT_ICON[NODES.find((n) => n.kind === 'skill' && n.skill === name)?.path ?? ''] ?? 'bolt';

/** What a throwable does, as a verb: `Burn up to 3 foes`. */
const THROW_VERB: Record<ThrowId, string> = { flash: 'Stun', cord: 'Root', ember: 'Burn' };
/**
 * A status's line in the hub, where the room is a circle's: "each round" is written `each rd`, the one
 * place it is (VOICE.md). Read aloud in full.
 */
const hubStatus = (st: string) => `${st}: ${(STATUS_TEXT[st] ?? '').replace(/ each round/g, ' each rd')}`;

/** How far a finger travels before a press on the wheel becomes a drag. */
const DRAG = 10;

/**
 * The hunter's actions on their turn, as a wheel behind one button: a slot to each skill slot their rank
 * holds, then the throwable readied, Health Potion, Guard, Cover and Strike, in the same places every
 * turn. An item's slot wears the count held. Two ways to use one, and nothing is used on a first tap:
 * - press the button (or anywhere on the open wheel), drag onto a slot and the hub shows it, and let go
 *   on it to use it; let go anywhere else and nothing is used;
 * - tap a slot and the hub shows it, and tap it again to use it.
 */
function ActWheel({ turn, aim, canDrink, slots, give, picked, setPicked, open, setOpen, ward, names, toss, sight, dry = false }: {
  turn: Turn; aim: string | null; canDrink: boolean; slots: number; give: (use: string) => void;
  picked: string; setPicked: (use: string) => void; open: boolean; setOpen: (v: boolean) => void;
  /** The ally Cover would cover, and every unit's name, for the hub. */
  ward: string | null; names: Record<string, string>;
  /** The throwable the run readied: the one Throw throws. */
  toss: ThrowId | null;
  /** Foresight: what comes at the hunter or the ally, in numbers, on Guard and Cover. */
  sight: boolean;
  /** A Dry Gate: no Health Potion. */
  dry?: boolean;
}) {
  const s = useSave();
  const ring = useRef<HTMLDivElement>(null);
  /** A press underway: where it began, whether it has become a drag, and the slot it began on. */
  const press = useRef<{ x: number; y: number; id: number; moved: boolean; from: string | null } | null>(null);
  /** A tap's click that follows a drag let go on a slot is not a second tap. */
  const quiet = useRef(0);
  /** The slot under the finger while it drags, or null between slots; unset when nothing drags. */
  const [over, setOver] = useState<string | null | undefined>(undefined);
  const overRef = useRef<string | null | undefined>(undefined);
  const fin = aim ? finishers(turn, aim) : {};
  const on = (use: string): Reckoning | undefined => (aim ? turn.aims[use]?.[aim] : undefined);
  const dmg = (use: string, fell?: 'sure' | 'maybe'): Pick<WheelAct, 'shown' | 'said' | 'hit' | 'fell'> => {
    const r = on(use);
    if (!r) return { shown: ['No damage'], said: 'No damage' };
    return { hit: r, fell, shown: [`Damage ${r.lo}-${r.hi}`, `Hit ${r.chance}%`], said: `Damage ${spoken(r.lo, r.hi)}, hit chance ${r.chance}%` };
  };
  // What comes at the hunter before their next turn, and what a Guard makes of it.
  const coming = turn.threats.filter((x) => x.soon && x.at === turn.uid && x.hit && x.guarded);
  const sum = (k: 'hit' | 'guarded', end: 'lo' | 'hi') => coming.reduce((n, x) => n + (x[k]?.[end] ?? 0), 0);
  const inc = [sum('hit', 'lo'), sum('hit', 'hi'), sum('guarded', 'lo'), sum('guarded', 'hi')];
  const skills: (WheelAct | null)[] = Array.from({ length: Math.max(slots, turn.skills.length) }, (_, i) => {
    const k = turn.skills[i];
    if (!k) return null;
    const name = k.ability.name;
    const d = dmg(name, k.cd > 0 ? undefined : fin[name]);
    // What it inflicts, named: the status's own line is the Guide's and the Skills screen's.
    const inflicts = k.ability.inflicts.filter((st) => STATUS_TEXT[st]);
    return {
      use: name, name, glyph: skillGlyph(name), off: k.cd > 0 ? `Ready in ${k.cd}` : undefined, ...d,
      shown: inflicts.length ? [...d.shown, `Inflicts ${inflicts.join(', ')}`] : d.shown,
      said: inflicts.length ? `${d.said}. Inflicts ${inflicts.join(', ')}` : d.said,
    };
  });
  // Cover: what is aimed at the ally before the hunter's next turn, and what of it the hunter would take, guarding.
  const onWard = turn.threats.filter((x) => x.soon && ward && x.at === ward && x.hit && x.guarded);
  const wsum = (k: 'hit' | 'guarded', end: 'lo' | 'hi') => onWard.reduce((n, x) => n + (x[k]?.[end] ?? 0), 0);
  const who = ward ? names[ward] ?? 'Ally' : null;
  const cover: WheelAct = !who
    ? { use: COVER, name: COVER, glyph: 'cover', off: 'No ally', shown: ['No ally standing'], said: 'No ally standing' }
    : !onWard.length
      ? { use: COVER, name: COVER, glyph: 'cover', shown: [`${who}`, 'Nothing aimed at them'], said: `${who}, nothing aimed at them` }
      : sight
        ? { use: COVER, name: COVER, glyph: 'cover', shown: [`On ${who} ${wsum('hit', 'lo')}-${wsum('hit', 'hi')}`, `On you ${wsum('guarded', 'lo')}-${wsum('guarded', 'hi')}`],
          said: `${who}: incoming ${spoken(wsum('hit', 'lo'), wsum('hit', 'hi'))}. On you, guarded, ${spoken(wsum('guarded', 'lo'), wsum('guarded', 'hi'))}` }
        // Without Foresight, how many are aimed at them, and not how hard.
        : { use: COVER, name: COVER, glyph: 'cover', shown: [`${who}`, `Aimed at them: ${onWard.length}`], said: `${who}, ${onWard.length} aimed at them` };
  // Throw: the kind the run readied, and how many of it are left.
  const tk = THROWABLES.find((k) => k.id === toss);
  const left = tk ? turn.throws[tk.id] ?? 0 : 0;
  const reach = tk ? (tk.reach > 1 ? `up to ${tk.reach} foes` : 'one foe') : '';
  const thrown: WheelAct = tk
    ? { use: 'Throw', name: tk.name, glyph: THROW_GLYPH[tk.id], count: left, off: left > 0 ? undefined : 'None left',
      shown: [`${THROW_VERB[tk.id]} ${reach}`, hubStatus(tk.status)],
      said: `${tk.status} on ${reach}. ${tk.status}: ${STATUS_TEXT[tk.status]}. ${left} held` }
    : { use: 'Throw', name: 'Throw', glyph: 'flash', off: 'None readied', shown: ['Nothing to throw'], said: 'Nothing to throw' };
  const fixed: WheelAct[] = [
    thrown,
    { use: 'Potion', name: 'Health Potion', glyph: 'potion', count: turn.potions, off: dry ? 'Sealed: Dry' : !turn.potions ? 'None held' : !canDrink ? 'HP full' : undefined,
      shown: [`HP +${POTION_HEAL * 100}%`], said: `HP +${POTION_HEAL * 100}%, ${turn.potions} held` },
    { use: 'Guard', name: 'Guard', glyph: 'shield',
      // With Foresight, what is coming in numbers; without, how many are aimed at the hunter.
      shown: !coming.length ? [`Damage taken -${(1 - GUARD) * 100}%`] : sight ? [`Incoming ${inc[0]}-${inc[1]}`, `Guarded ${inc[2]}-${inc[3]}`] : [`Damage taken -${(1 - GUARD) * 100}%`, `Aimed at you: ${coming.length}`],
      said: !coming.length ? `Damage taken -${(1 - GUARD) * 100}%` : sight ? `Incoming ${spoken(inc[0], inc[1])}, guarded ${spoken(inc[2], inc[3])}` : `Damage taken -${(1 - GUARD) * 100}%, ${coming.length} aimed at you` },
    cover,
    { use: 'Strike', name: 'Strike', glyph: 'Weapon', ...dmg('Strike') },
  ];
  const acts = [...skills, ...fixed];
  const n = acts.length;
  const chosen = acts.find((a) => a?.use === picked) ?? fixed[fixed.length - 1];
  // While a finger drags, the hub shows the slot under it; between slots, the one picked.
  const dragged = over ? acts.find((a) => a?.use === over) ?? null : null;
  const shown = dragged ?? chosen;
  const st = skillState(s, shown.use, turn);
  const use = (a: WheelAct) => { if (!a.off) { setPicked(a.use); give(a.use); } };
  /** Guard and Cover are the defence's blue, Potion healing's green; the rest are the Gate's ember. */
  const kind = (a: WheelAct) => (a.use === 'Guard' || a.use === COVER ? 'guard' : a.use === 'Potion' ? 'potion' : 'act');
  const tap = (a: WheelAct) => {
    if (performance.now() < quiet.current) return;
    if (a.use === chosen.use) use(a); else { sfx.blip(); setPicked(a.use); }
  };

  /** The slot under a point on the screen, by where it falls on the ring. */
  const slotAt = (x: number, y: number): WheelAct | null => {
    const el = ring.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const i = ringIndex(((x - r.left) / r.width) * 300, ((y - r.top) / r.height) * 300, n);
    return i >= 0 ? acts[i] ?? null : null;
  };
  const hover = (v: string | null | undefined) => { overRef.current = v; setOver(v); };
  // The press, followed to its end on the window: the button it began on is gone once the wheel opens.
  const track = (e: PointerEvent, from: string | null) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, from };
    const move = (m: PointerEvent) => {
      const p = press.current;
      if (!p || m.pointerId !== p.id) return;
      if (!p.moved && Math.hypot(m.clientX - p.x, m.clientY - p.y) < DRAG) return;
      p.moved = true;
      const a = slotAt(m.clientX, m.clientY);
      const v = a?.use ?? null;
      if (v !== overRef.current) { if (a) sfx.blip(); hover(v); }
    };
    const done = (u: PointerEvent) => {
      const p = press.current;
      if (!p || u.pointerId !== p.id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
      press.current = null;
      hover(undefined);
      // A tap is the click's to settle; a drag is settled here, on the slot it is let go on.
      if (!p.moved || u.type === 'pointercancel') return;
      quiet.current = performance.now() + 400;
      const a = slotAt(u.clientX, u.clientY);
      if (a && a.use === p.from) tap(a);
      else if (a && !a.off) use(a);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  };

  if (!open) {
    return (
      <button type="button" class={`actbtn actbtn--${kind(chosen)}`} aria-expanded="false" aria-label={`Actions, ${n} slots. ${chosen.name} picked`}
        onPointerDown={(e) => { sfx.tap(); setOpen(true); track(e as unknown as PointerEvent, null); }}
        onClick={() => setOpen(true)} style={`--n:${n}`}>
        <span class="actbtn__ring" aria-hidden="true" />
        <span class="actbtn__glyph"><Glyph name={chosen.glyph} /></span>
        <b>Actions</b>
      </button>
    );
  }
  const foot = over !== undefined ? (dragged ? dragged.off ?? 'Let go to use' : '') : chosen.off ?? 'Tap again to use';
  return (
    <div class="actwheel" role="group" aria-label="Actions">
      <div class={`actwheel__ring ${over !== undefined ? 'is-dragging' : ''}`} ref={ring}
        onPointerDown={(e) => track(e as unknown as PointerEvent, slotAt(e.clientX, e.clientY)?.use ?? null)}>
        <svg viewBox="0 0 300 300" class="actwheel__svg">
          {acts.map((a, i) => a
            ? <path key={a.use} d={ringSlot(i, n)} role="button" tabIndex={0} data-act={a.use} aria-pressed={a.use === chosen.use}
              aria-label={`${a.name}. ${a.off ?? a.said}${a.fell ? `, ${a.fell === 'sure' ? 'defeats it' : 'may defeat it'}` : ''}`}
              class={`actwheel__slot actwheel__slot--${kind(a)} ${a.use === shown.use ? 'is-picked' : ''} ${a.off ? 'is-off' : ''}`}
              onClick={() => tap(a)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(a); } }} />
            : <path key={`empty${i}`} d={ringSlot(i, n)} class="actwheel__slot is-empty" aria-hidden="true" />)}
        </svg>
        {acts.map((a, i) => a && (
          <span key={a.use} class={`actwheel__item actwheel__item--${kind(a)} ${a.use === shown.use ? 'is-picked' : ''} ${a.off ? 'is-off' : ''}`} style={`left:${ringMid(i, n).left};top:${ringMid(i, n).top}`} aria-hidden="true">
            <span class="actwheel__glyph"><Glyph name={a.glyph} />{a.count !== undefined && <b class="actwheel__count num">{a.count}</b>}</span>
            <small>{a.use === 'Potion' ? 'Potion' : a.name}</small>
            <i class={`actwheel__mark ${a.fell ? `is-${a.fell}` : ''}`} />
          </span>
        ))}
        <div class={`actwheel__hub actwheel__hub--${kind(shown)}`} aria-live="polite">
          <b class="actwheel__name">{shown.name}</b>
          {/* A skill not ready says so at the hub's foot, in red: its level alone here. */}
          {(st.level || st.ready) && <small class="actwheel__ready">{[st.level, shown.off ? null : st.ready].filter(Boolean).join(' · ')}</small>}
          {shown.shown.map((l) => <span key={l} class="actwheel__num">{l}</span>)}
          {shown.fell && <span class={`actwheel__fell is-${shown.fell}`}>{shown.fell === 'maybe' ? 'May defeat it' : 'Defeats it'}</span>}
          <small class={`actwheel__foot ${(over !== undefined ? dragged?.off : chosen.off) ? 'is-off' : ''}`}>{foot}</small>
        </div>
        <button type="button" class="actwheel__close iconbtn" aria-label="Close the actions" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => { sfx.tap(); setOpen(false); }}><Glyph name="close" /></button>
      </div>
    </div>
  );
}

/** The arena's pace and Auto, behind one button in its head: the button shows the pace, and Auto when it is on. */
function PaceMenu({ pace, setPace, auto, toggleAuto }: { pace: Pace; setPace: (p: Pace) => void; auto: boolean; toggleAuto: () => void }) {
  const [open, setOpen] = useState(false);
  const label = pace === 'skip' ? 'Skip' : `${pace}×`;
  const paces: { p: Pace; name: string; desc: string }[] = [
    { p: 1, name: '1×', desc: 'Every blow at its own pace' },
    { p: 2, name: '2×', desc: 'Twice as fast' },
    { p: 'skip', name: 'Skip', desc: 'Straight to your next turn. The log keeps every line' },
  ];
  return (
    <div class="pace">
      <button type="button" class={`pacebtn ${auto ? 'is-auto' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={`Pace: ${label}${auto ? ', Auto on' : ''}`}
        onClick={() => { sfx.tap(); setOpen((x) => !x); }}>
        <Glyph name="ffwd" /><b class="num">{label}</b>{auto && <i class="pacebtn__auto">Auto</i>}
      </button>
      {open && <>
        <div class="pace__shade" onClick={() => setOpen(false)} />
        <div class="pacemenu" role="menu" aria-label="Pace">
          {paces.map((x) => (
            <button type="button" key={String(x.p)} role="menuitemradio" aria-checked={pace === x.p} data-pace={String(x.p)} class={`pacemenu__opt ${pace === x.p ? 'is-on' : ''}`}
              onClick={() => { sfx.tap(); setPace(x.p); setOpen(false); }}><b class="num">{x.name}</b><small>{x.desc}</small></button>
          ))}
          <button type="button" role="menuitemcheckbox" aria-checked={auto} data-pace="auto" class={`pacemenu__opt pacemenu__opt--auto ${auto ? 'is-on' : ''}`}
            onClick={() => { toggleAuto(); setOpen(false); }}><b>Auto</b><small>The System fights your turns and picks your way</small></button>
        </div>
      </>}
    </div>
  );
}

/** Move the arena's picture of everyone forward by one beat's events. */
function apply(local: UnitView[], b: Beat) {
  const u = (x: string) => local.find((v) => v.uid === x);
  for (const e of b.ev) {
    if (e.t === 'hit' || e.t === 'tick') { const t = u(e.v); if (t) t.hp = e.hp; }
    else if (e.t === 'heal') { const t = u(e.a); if (t) t.hp = e.hp; }
    else if (e.t === 'down') { const t = u(e.v); if (t) t.hp = 0; }
    else if (e.t === 'status') { const t = u(e.v); if (t && !t.status.includes(e.s)) t.status.push(e.s); }
    else if (e.t === 'guard') { const t = u(e.a); if (t && !t.status.includes('Guarded')) t.status.push('Guarded'); }
    else if (e.t === 'cover') {
      const t = u(e.a), w = u(e.v);
      if (t && !t.status.includes('Guarded')) t.status.push('Guarded');
      if (w && !w.status.includes('Covered')) w.status.push('Covered');
    }
    else if (e.t === 'intent') { const t = u(e.u); if (t) { const { t: _t, u: _u, ...i } = e; t.intent = i; } }
    else if (e.t === 'pip') { const t = u(e.v); if (t?.intent) t.intent = { ...t.intent, pips: e.left }; }
    else if (e.t === 'break') { const t = u(e.v); if (t?.intent) t.intent = { ...t.intent, broken: true }; }
    else if (e.t === 'expire') {
      const t = u(e.v);
      if (t) t.status = t.status.filter((x) => x !== e.s);
      // The hunter's guard coming down is their next turn starting: a cover they gave ends with it.
      if (t?.uid === 'hero' && e.s === 'Guarded') for (const v of local) v.status = v.status.filter((x) => x !== 'Covered');
    }
    else if (e.t === 'passive' && e.k === 'stand') { const t = u(e.u); if (t) t.hp = 1; }
    else if (e.t === 'passive' && e.hp !== undefined) { const t = u(e.u); if (t) t.hp = e.hp; }
    else if (e.t === 'support') {
      const st = e.s === undefined ? 'Rallied' : e.s;
      if (st) for (const t of local) if (t.side === (e.a.startsWith('e') ? 'e' : 'p') && t.hp > 0 && !t.status.includes(st)) t.status.push(st);
    } else if (e.t === 'cast' && e.k === 'taunt') { const t = u(e.a); if (t && !t.status.includes('Guarded')) t.status.push('Guarded'); }
  }
}

interface Room { label: string; boss: boolean; index: number }

type Phase = 'map' | 'fight' | 'turn' | 'decide' | 'node' | 'results';

/** A step being shown: a rest or a cache as it happened, or a choice waiting, then how it went. */
interface Panel { node: MapNode; item?: string; mats?: Record<string, number>; done?: raid.Resolution; rested?: { pick: raid.RestPick; potions: number } }

export function Arena() {
  const s = useSave();
  const id = arena.use();
  const d = id ? dungeonById(id) : undefined;
  const run = s.gates.raid;
  const [phase, setPhase] = useState<Phase>('map');
  const [room, setRoom] = useState<Room | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [units, setUnits] = useState<UnitView[]>([]);
  const [feed, setFeed] = useState<{ text: string; tone: string; k: number }[]>([]);
  const [pace, setPace] = useState<Pace>(1);
  const [auto, setAuto] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [aim, setAim] = useState<string | null>(null);
  /** The action wheel: open or shut, as the hunter left it, and the action last picked on it. */
  const [wheel, setWheel] = useState(false);
  const [picked, setPicked] = useState('Strike');
  /** The ally the hunter would cover. */
  const [ward, setWard] = useState<string | null>(null);
  /** A word on a card tapped to tell what it is. */
  const [tip, setTip] = useState<TipAt | null>(null);
  /** The round the fight shown stands in: a condition within three rounds is met only while it lasts. */
  const [round, setRound] = useState(0);
  const tell: Tell = (el, title, lines) => {
    const r = el.getBoundingClientRect();
    setTip({ title, lines, x: r.left + r.width / 2, y: r.top, below: r.bottom });
  };
  const [panel, setPanel] = useState<Panel | null>(null);
  const [result, setResult] = useState<raid.RaidResult | null>(null);
  const paceRef = useRef<Pace>(1);
  paceRef.current = pace;
  const autoRef = useRef(false);
  autoRef.current = auto;
  /** From By Hand up, Auto stands aside in a boss's chamber: every order there is the hunter's. */
  const handRef = useRef(false);
  const aimRef = useRef<string | null>(null);
  aimRef.current = aim;
  /** Settles the turn waiting on the hunter. */
  const pick = useRef<((o: Order | null) => void) | null>(null);
  /** One thing at a time: a tap racing Auto must never take a step or open a chamber twice. */
  const busy = useRef(false);
  const seq = useRef(0);
  /** The hidden passages open when the map was last shown: one more is announced. Unset until then. */
  const seen = useRef({ passages: -1 });

  useEffect(() => {
    if (!d) return;
    music.set(moodNow());
    const off = pushBack(() => true);
    if (run) void guarded(dispatch);
    return () => { off(); music.set('gates'); };
  }, []);

  if (!d) return null;
  const m = run ? raid.mapOf(d, run) : null;

  const say = (ls: { text: string; tone: string }[]) => {
    if (ls.length) setFeed((f) => [...ls.map((l) => ({ ...l, k: ++seq.current })).reverse(), ...f].slice(0, 7));
  };

  async function guarded(fn: () => Promise<void> | void) {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } finally { busy.current = false; }
  }

  /** Do whatever the run is waiting on. Only ever called inside `guarded`. */
  async function dispatch() {
    const r = store.get().gates.raid;
    if (!r || !d) return;
    // A run closed after a lost chamber, or after the boss fell, is settled by what was recorded.
    if (r.lost) return end('defeated');
    if (raid.bossDown(d, r)) return end('cleared');
    const x = raid.pending(d, r);
    if (x && isFight(x)) return chamber();
    if (x) return open({ node: x });
    toMap();
  }

  function toMap() {
    setPanel(null);
    setPhase('map');
    music.set(moodNow());
    // A hidden passage a room's clearing opened, said once, as the hunter comes back to the map.
    const r0 = store.get().gates.raid;
    if (r0) {
      const m0 = raid.mapOf(d!, r0);
      const open = passages(m0, raid.explored(m0, r0)).length;
      if (open > seen.current.passages && seen.current.passages >= 0) say([{ text: '▸ A wall gives way. There is a passage behind it.', tone: 'outcome' }]);
      seen.current.passages = open;
    }
    if (autoRef.current) later(() => {
      const r = store.get().gates.raid;
      const move = r ? raid.systemNext(d!, r) : null;
      if (!move) return;
      if ('rest' in move) {
        void guarded(async () => {
          const was = clockNow();
          store.update((x) => raid.moveTo(d!, x.gates.raid!, move.rest));
          await tellClock(was);
          later(() => void restNow(raid.systemRest(store.get(), d!, store.get().gates.raid!), false));
        });
      } else void step(move.enter);
    });
  }

  /** Walk back to a room already cleared: on the Gate clock, each corridor walked is a move. */
  function walkTo(id: string) {
    void guarded(async () => {
      const was = clockNow();
      store.update((x) => raid.moveTo(d!, x.gates.raid!, id));
      await tellClock(was);
    });
  }

  const clockNow = () => { const r = store.get().gates.raid; return r ? raid.clockOf(r) : null; };
  /** The score inside: a Red Gate's own once it has turned, the raid's until then. */
  const moodNow = () => (clockNow()?.red ? 'redgate' : 'raid');

  /**
   * What the last move did to the Gate clock: the first move past the budget and the Gate turning red each
   * have their window; every other move past the budget, a line in the feed.
   */
  async function tellClock(was: ClockState | null) {
    const r = store.get().gates.raid;
    const c = r ? raid.clockOf(r) : null;
    if (!r || !c || !was || c.moves === was.moves || !c.over) return;
    const more = `+${Math.round((raid.mightOf(d!, r) - 1) * 100)}%`;
    if (c.red && !was.red) {
      flash('danger');
      sfx.redGate();
      music.set('redgate');
      // The creatures' share counts up under the window's lines, and the window shakes when it lands.
      const to = Math.round((raid.mightOf(d!, r) - 1) * 100);
      await sys({
        ...system.notify(['[The Gate has turned red.]', system.red('The way out has been sealed.')], 'redgate'),
        body: () => <RedCount to={to} />,
      });
    } else if (!was.over) {
      sfx.gate();
      await sys(system.notify(['[The Gate is stirring.]', `Creatures not yet fought: ${system.red(more)}`], 'gates'));
    } else say([{ text: c.red ? `▸ The red deepens. Creatures not yet fought ${more}.` : `▸ The Gate stirs. Creatures not yet fought ${more}.`, tone: 'outcome' }]);
  }

  /** Rest where the hunter stands, the way picked: once at each rest. From its panel, the panel says so; on the map, the feed does. */
  function restNow(pick: raid.RestPick, inPanel: boolean) {
    return guarded(() => {
      const held = shop.held(store.get(), 'hp');
      if (!store.update((x) => raid.restHere(x, d!, x.gates.raid!, pick))) return;
      sfx.success();
      const potions = shop.held(store.get(), 'hp') - held;
      if (inPanel) {
        setPanel((p) => (p ? { ...p, rested: { pick, potions } } : p));
        if (autoRef.current) later(() => void guarded(dispatch));
        return;
      }
      say([{ text: pick.kind === 'hone' ? `▸ You hone ${pick.skill}.` : pick.kind === 'steady' ? '▸ The party steadies itself.' : '▸ The party rests.', tone: 'outcome' }]);
      if (autoRef.current) toMap();
    });
  }

  /** Open the rest the hunter stands in, from the plan: its three ways to rest. */
  function restPanel() {
    const r = store.get().gates.raid;
    const x = r ? raid.standing(d!, r) : null;
    if (x) open({ node: x });
  }

  /** Drink a Health Potion between steps, from the bag: the feed says what it restored. */
  function drinkNow() {
    void guarded(() => {
      const hp = store.update((x) => raid.drinkPotion(x, d!, x.gates.raid!));
      if (!hp) return;
      sfx.success();
      say([{ text: `▸ You drink a Health Potion. HP +${hp}.`, tone: 'outcome' }]);
    });
  }

  /** Run `fn` shortly, if Auto is still on by then. */
  function later(fn: () => void) {
    setTimeout(() => { if (autoRef.current) fn(); }, 500);
  }

  /** Take a step on the map. */
  function step(nodeId: string) {
    return guarded(async () => {
      const was = clockNow();
      const res = store.update((x) => raid.choose(x, d!, x.gates.raid!, nodeId));
      if (!res) return;
      await tellClock(was);
      if (isFight(res.node)) return chamber();
      // Down the stairs: the next floor's plan, at once.
      if (res.node.kind === 'down') {
        const r = store.get().gates.raid!;
        const m1 = raid.mapOf(d!, r);
        say([{ text: `▸ Floor ${(raid.standing(d!, r)?.floor ?? 0) + 1} of ${m1.floors.length}.`, tone: 'room' }]);
        sfx.gate();
        return toMap();
      }
      open({ node: res.node, item: res.item, mats: res.mats });
    });
  }

  function open(p: Panel) {
    setPanel(p);
    setPhase('node');
    if (!autoRef.current) return;
    const r = store.get().gates.raid!;
    // A rest waiting up a tower takes the System's pick; one found in a Gate is kept for the boss, as the
    // System keeps it. A shrine, a Font, a trap or an event takes its choice.
    if (p.node.kind === 'rest' && !p.rested && raid.pending(d!, r)?.id === p.node.id) later(() => void restNow(raid.systemRest(store.get(), d!, store.get().gates.raid!), true));
    else if (!p.done && raid.pending(d!, r)) later(() => void choice(raid.systemChoice(p.node, r)));
    else later(() => void guarded(dispatch));
  }

  /** Make the choice a shrine, a trap or an event is waiting on. */
  function choice(i: number) {
    return guarded(() => {
      const out = store.update((x) => raid.resolve(x, d!, x.gates.raid!, i));
      if (!out) return;
      if (out.effect.hurt) { sfx.hit(-40); flash('danger'); } else if (out.won) sfx.success();
      open({ node: out.node, item: out.item, mats: out.mats, done: out });
    });
  }

  /** Play the log from `from` to its end, at the chosen pace. Returns where it got to. */
  async function show(log: Ev[], from: number, local: UnitView[]) {
    const name = (uid: string) => local.find((u) => u.uid === uid)?.name ?? '?';
    // A condition met: the way it fell, and what it leaves.
    const drop = (uid: string) => {
      const u = local.find((x) => x.uid === uid);
      return u?.ref && u.cond ? `${CONDITION[u.cond].said}. ${dropPay(u.ref, !!u.boss)}.` : null;
    };
    for (const b of toBeats(log.slice(from))) {
      apply(local, b);
      if (b.ev[0]?.t === 'round') setRound(b.ev[0].n);
      const p = paceRef.current;
      const ls = lines(b, name, drop);
      // Skip still writes the log, so what happened between turns can be read; it only takes no time.
      if (p === 'skip') { say(ls); continue; }
      setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
      // A beat with nothing to say (a foe settling its next move) costs no time.
      if (!ls.length) continue;
      say(ls);
      if (b.ev.some((e) => e.t === 'down')) sfx.hit(-40);
      else if (b.ev.some((e) => e.t === 'hit' && e.crit)) sfx.hit(80);
      await new Promise((r) => setTimeout(r, b.kind === 'round' ? PACE[p] * 0.6 : PACE[p]));
    }
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    return log.length;
  }

  /** Wait for the hunter to give an order, or for Auto to take the turn. */
  async function ask(t: Turn, local: UnitView[]): Promise<Order | null> {
    if (autoRef.current && !handRef.current) return null;
    const live = local.filter((u) => t.foes.includes(u.uid));
    if (!aimRef.current || !t.foes.includes(aimRef.current)) setAim(live.reduce((a, b) => (b.hp < a.hp ? b : a), live[0])?.uid ?? null);
    // The ally to cover, unless one still standing was chosen: the one with the most coming at them.
    setWard((w) => {
      if (w && t.allies.includes(w)) return w;
      const most = (a: string) => t.threats.filter((x) => x.soon && x.at === a).reduce((n, x) => n + (x.hit?.hi ?? 0), 0);
      return t.allies.reduce<string | null>((best, a) => (best === null || most(a) > most(best) ? a : best), null);
    });
    setTurn(t);
    setPhase('turn');
    if (store.update((x) => story.markOnce(x, 'turn-told'))) {
      await sys({
        title: 'Your Turn', kind: 'app', actions: [{ label: 'Close', value: null }],
        lines: [
          'Tap a foe to aim at it, then act.',
          'Each foe shows its next move and its target.',
          `A skill or a Strike goes at the foe you aimed at first. A <em>Guard</em> takes ${GUARD * 100}% of every hit until your next turn. A <em>Health Potion</em> restores ${POTION_HEAL * 100}% of your health.`,
          '<em>Auto</em> lets the System fight your turns and pick your way, as it does when it assesses a Gate.',
        ],
      });
    }
    return new Promise((res) => { pick.current = res; });
  }

  function give(o: Order | null) {
    const f = pick.current;
    if (!f) return;
    pick.current = null;
    setTurn(null);
    setPhase('fight');
    sfx.tap();
    f(o);
  }

  /** Fight the chamber underway. Only ever called inside `guarded`. */
  async function chamber() {
    const st = store.get();
    const r = st.gates.raid;
    if (!r || !d) return;
    const { party, ch, node } = raid.resume(st, d, r);
    const c = chamberOf(d, node);
    // A Red Gate keeps its own score, the boss's chamber too.
    if (raid.clockOf(r)?.red) music.set('redgate');
    else if (c.boss) music.set('boss');
    setRoom({ label: c.label, boss: c.boss, index: node.n });
    handRef.current = c.boss && ascension.bossByHand(ascension.levelOf(r));
    setWon(null);
    setPhase('fight');
    const local: UnitView[] = ch.roster.map((u) => ({ ...u, status: [...u.status] }));
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    setRound(ch.log.reduce((n, e) => (e.t === 'round' ? n + 1 : n), 0));
    setFeed([{ text: c.boss ? `[${c.label}] has appeared.` : `${c.label}.`, tone: 'room', k: ++seq.current }]);
    if (handRef.current) say([{ text: '▸ Auto is not available in this chamber.', tone: 'muted' }]);
    // Coming back mid-chamber: everything the saved orders already played is shown at once.
    let at = 0;
    if ((r.orders ?? []).length) {
      for (const b of toBeats(ch.log)) apply(local, b);
      at = ch.log.length;
      setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
      say([{ text: '▸ Chamber resumed.', tone: 'muted' }]);
    }
    at = await show(ch.log, at, local);
    while (ch.turn) {
      const o = await ask(ch.turn, local);
      // The order is in the save before it plays: leaving now cannot undo it.
      const given = store.update((x) => raid.order(x, x.gates.raid!, o));
      ch.play(given);
      at = await show(ch.log, at, local);
    }
    const res = ch.result();
    store.update((x) => raid.record(x, d, x.gates.raid!, party, res));
    const hero = local.find((x) => x.uid === 'hero');
    const left = local.filter((x) => x.side === 'p' && x.hp > 0).length;
    const band = !hero || hero.hp <= 0 ? 'Down' : hero.hp >= hero.mx ? 'Unhurt' : hero.hp / hero.mx >= 0.75 ? 'Grazed' : hero.hp / hero.mx >= 0.45 ? 'Wounded' : 'Badly hurt';
    say(res.won
      ? [{ text: `▸ [${res.label}] cleared. Rounds: ${res.rounds}. Standing: ${left}. Condition: ${band}.`, tone: 'outcome' }]
      : [{ text: `▸ [${res.label}] not cleared. The party has been carried out.`, tone: 'loss' }]);
    if (res.won) buzz(20);
    // A Gatekeeper down breaks the seal on its vault: the door behind it, or, on an older plan, somewhere else.
    const sealed = res.won && node.kind === 'elite' ? raid.mapOf(d, r).nodes.find((x) => x.kind === 'vault') : undefined;
    if (sealed) say([{ text: node.next.includes(sealed.id) ? '▸ The seal on the door behind it breaks.' : '▸ Somewhere in the Gate, a seal breaks.', tone: 'outcome' }]);
    else { sfx.alarm(); flash('danger'); buzz([40, 60, 120]); }
    setWon(res.won);
    // A lost chamber, or the boss down: that is the run's to end. Anything else, back to the map.
    if (!res.won || res.boss) return setPhase('decide');
    await new Promise((r2) => setTimeout(r2, paceRef.current === 'skip' ? 0 : 900));
    toMap();
  }

  function end(outcome: raid.Outcome) {
    const res = store.update((x) => raid.finish(x, d!, x.gates.raid!, outcome));
    setResult(res);
    setPhase('results');
    music.set('gates');
    if (outcome === 'cleared') { sfx.rankUp(); flash('gold'); buzz([26, 40, 20, 40, 90]); }
  }

  /** Out of the Gate, through what the run paid; and on into the next floors of the Spire, if the hunter climbs on. */
  async function leave(next?: Dungeon) {
    arena.set(null);
    const went = await rewardChain(result?.xp ?? null, next ? undefined : 'gates');
    if (next && !went) await enterGate(next);
  }

  if (phase === 'results' && result) return <Results d={d} r={result} onDone={leave} />;

  const party = units.filter((u) => u.side === 'p');
  const foes = units.filter((u) => u.side === 'e');
  const hero = party.find((u) => u.uid === 'hero');
  const aiming = phase === 'turn' && turn ? turn.foes : [];
  // Foresight: every foe's damage and chance to hit shown, on its card and on Guard and Cover.
  const sight = skilltree.foresees(s);
  // The throwable the run readied as it walked in; a run opened before that throws the first kind it holds.
  const toss: ThrowId | null = run?.throw ?? THROWABLES.find((k) => (turn?.throws[k.id] ?? 0) > 0)?.id ?? null;
  const depth = m?.layers.length ?? 0;
  const rooms = m && !m.tower ? raid.stepsOf(m) : 0;
  const toggleAuto = () => {
    sfx.tap();
    const on = !auto;
    autoRef.current = on;
    setAuto(on);
    if (!on) return;
    // Switching Auto on hands the System whatever is waiting: a turn, the next step, or a choice.
    give(null);
    if (phase === 'map') toMap();
    if (phase === 'node' && panel) open(panel);
  };
  const onMap = phase === 'map' || phase === 'node';
  const clock = run ? raid.clockOf(run) : null;
  // The step underway, or about to be taken; a rest or cache already done still counts as where you stand.
  const here = !run ? 1 : Math.min(depth, raid.pending(d, run) || phase !== 'node' ? run.at + 1 : run.at);
  const head = phase === 'node' && panel ? nodeName(panel.node, run) : onMap ? 'Choose your way' : room?.label ?? '…';
  return (
    <div class={`arena ${room?.boss && !onMap ? 'is-boss' : ''} ${clock?.red ? 'is-redgate' : ''}`} role="dialog" aria-label={`${d.name}${clock?.red ? ', a Red Gate' : ''}, in progress`}>
      <header class="arena__head">
        <div><span class="label">{clock?.red ? <span class="arena__red">Red Gate</span> : d.name}{run && ascension.levelOf(run) ? ` · Ascension ${ascension.levelOf(run)}` : ''}{d.floor ? ` · Floor ${d.floor + here - 1} of ${d.floor + depth - 1}` : rooms ? '' : ` · Step ${here} of ${depth}`}</span><b>{head}</b></div>
        {phase !== 'decide' && <PaceMenu pace={pace} setPace={setPace} auto={auto} toggleAuto={toggleAuto} />}
      </header>
      {onMap && run && m ? (
        <div class="arena__map">
          <RunStrip s={s} d={d} />
          {phase === 'node' && panel
            ? <NodePanel d={d} p={panel} onChoose={(i) => void choice(i)} onGo={() => void guarded(dispatch)} onWithdraw={() => end('withdrawn')} onRest={(pick) => void restNow(pick, true)} />
            : <>
              {feed[0] && <p class={`feed feed--${feed[0].tone}`}>{feed[0].text}</p>}
              <MapView m={m} path={run.path} at={run.at} options={raid.options(d, run).map((x) => x.id)} onPick={(nid) => void step(nid)}
                pos={raid.standing(d, run)?.id} rested={run.rested} onWalk={walkTo} seen={m.tower ? undefined : raid.seen(s, d, run)}
                corner={<ItemsMark items={bagFor(s, d, drinkNow)} />} costs={costsOf(d, run)}
                stir={clock && clock.over ? Math.min(1, clock.over / CLOCK.red) : 0} red={!!clock?.red}
                shrinePath={(x) => pathOf(blessings.shrinePath(run, x))?.name} />
              {m.tower
                ? raid.canWithdraw(d, run)
                  ? <Btn kind="ghost" block onClick={() => end('withdrawn')}>Withdraw From The Rest</Btn>
                  : <small class="muted center">Tap a step that glows.</small>
                : raid.canRest(d, run)
                  ? <div class="stack stack--tight">
                    <Btn kind="primary" block sound="tap" onClick={restPanel}>Rest</Btn>
                    <small class="muted center">Heal, Hone or Steady · Once</small>
                  </div>
                  : raid.canWithdraw(d, run)
                    ? <Btn kind="ghost" block onClick={() => end('withdrawn')}>Withdraw</Btn>
                    : raid.sealed(d, run) && raid.standing(d, run)?.id === m.start
                      ? <small class="warn center">The way out is sealed until the boss falls.</small>
                      : <small class="muted center">{clock ? 'Tap a room that glows, or a cleared room to walk back to it. Each corridor is a move.' : 'Tap a room that glows, or a cleared room to walk back to it.'}</small>}
            </>}
        </div>
      ) : (
        <>
          <div class="arena__field">
            <div class="arena__side">
              {party.map((u) => {
                // With Cover picked, an ally standing is tapped to choose it.
                const can = phase === 'turn' && picked === COVER && !!turn?.allies.includes(u.uid);
                // Who is coming for it: on the hunter's turn, each foe by its place in the order, the number on its card.
                const at = foes.filter((f) => f.hp > 0 && f.intent?.at === u.uid);
                const orders = phase === 'turn' && turn ? at.map((f) => turn.threats.find((x) => x.uid === f.uid)?.order).filter((n): n is number => !!n).sort((x, y) => x - y) : null;
                return <UnitChip key={u.uid} u={u} acting={phase === 'turn' && u.uid === 'hero'} incoming={orders && orders.length === at.length ? orders : at.length}
                  aimed={can && ward === u.uid} onPick={can ? () => { sfx.tap(); setWard(u.uid); } : undefined} pick="cover" tell={tell} />;
              })}
            </div>
            <div class="arena__side arena__side--foes">
              {foes.map((u) => <UnitChip key={u.uid} u={u} aimed={phase === 'turn' && aim === u.uid} onPick={aiming.includes(u.uid) ? () => { sfx.tap(); setAim(u.uid); } : undefined}
                intent={u.hp > 0 ? u.intent : undefined} self={foes} threat={phase === 'turn' ? turn?.threats.find((x) => x.uid === u.uid) : undefined} sight={sight} tell={tell} round={round} />)}
            </div>
          </div>
          <ol class="arena__feed" aria-live="polite">
            {feed.map((l) => <li key={l.k} class={`feed feed--${l.tone}`}>{l.text}</li>)}
          </ol>
        </>
      )}
      {tip && <Tip tip={tip} close={() => setTip(null)} />}
      <footer class="arena__foot">
        {phase === 'turn' && turn && (
          <div class="turnbar" data-tour="turn">
            <small class="turnbar__hint">{picked === COVER
              ? <>Your turn. Covering <b class="is-cover">{party.find((f) => f.uid === ward)?.name ?? 'nobody'}</b>; tap an ally to change.</>
              : <>Your turn. Aiming at <b>{foes.find((f) => f.uid === aim)?.name ?? 'nothing'}</b>; tap a foe to change.</>}</small>
            <ActWheel turn={turn} aim={aim} canDrink={!!turn.potions && !!hero && hero.hp < hero.mx} slots={skilltree.slots(s)} picked={picked} setPicked={setPicked} open={wheel} setOpen={setWheel}
              ward={ward} names={Object.fromEntries(units.map((u) => [u.uid, u.name]))} toss={toss} sight={sight} dry={!sealing.potionsAllowed(sealing.of(run))}
              give={(use) => give(
                use === COVER ? { use, at: ward ?? undefined }
                  : use === 'Throw' && toss ? { use: throwOrder(toss), at: aim ?? undefined }
                    : { use, at: use === 'Guard' || use === 'Potion' ? undefined : aim ?? undefined })} />
          </div>
        )}
        {phase === 'decide' && room && (
          won
            ? <Btn kind="primary" size="lg" block sound="success" onClick={() => end('cleared')}>Claim The Gate</Btn>
            : <Btn kind="danger" size="lg" block onClick={() => end('defeated')}>Carried Out</Btn>
        )}
      </footer>
    </div>
  );
}

/** What the run is carrying: the hunter's health, the allies still up, what it has banked, its blessings. */
function RunStrip({ s, d }: { s: ReturnType<typeof useSave>; d: NonNullable<ReturnType<typeof dungeonById>> }) {
  const run = s.gates.raid;
  if (!run) return null;
  const party = raid.partyFor(s, d, run);
  const hero = party[0];
  const up = party.slice(1).filter((u) => u.alive()).length;
  return (
    <div class="runstrip">
      <div class="runstrip__hp"><span class="label">You</span><HpBar cur={Math.round(Math.max(0, hero.hp))} max={hero.maxHp} tone="hp" /></div>
      {raid.clockOf(run) && <GateClock c={raid.clockOf(run)!} more={Math.round((raid.mightOf(d, run) - 1) * 100)} />}
      <div class="runstrip__cells">
        <span><small>Allies</small><b class="num">{up}/{party.length - 1}</b></span>
        <span><small>Banked</small><b class="num"><Shards n={run.purse ?? 0} /></b></span>
        <span><small>Found</small><b class="num">{(run.haul ?? []).length + Object.values(run.stash ?? {}).reduce((n, x) => n + x, 0)}</b></span>
      </div>
      {(run.blessings ?? []).length > 0 && (
        <div class="boons">
          {run.blessings.map((b) => <BoonChip key={b} id={b} tier={blessings.tierOf(run, b)} />)}
        </div>
      )}
    </div>
  );
}

/** The moves to every room the hunter can enter or walk back to, on the Gate clock: none for where they stand. */
function costsOf(d: Dungeon, run: NonNullable<ReturnType<typeof useSave>['gates']['raid']>): Record<string, number> | undefined {
  if (!run.clock || raid.pending(d, run)) return undefined;
  return Object.fromEntries(Object.entries(raid.movesFrom(d, run)).filter(([, n]) => n > 0));
}

/**
 * A Red Gate's share, counted up under its window's lines: slowly to 100, then all at once to the rest,
 * and the window shakes as it lands. A screen reader hears the share whole.
 */
function RedCount({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);
  const el = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const slow = Math.min(100, to);
    const t0 = performance.now();
    const A = 1700, B = to > slow ? 420 : 0;
    let raf = 0;
    let ticked = 0;
    const step = (t: number) => {
      const e = t - t0;
      // The first stretch climbs steadily, the last races, faster and faster.
      const v = e < A ? slow * (e / A) : slow + (to - slow) * Math.min(1, ((e - A) / Math.max(1, B)) ** 2);
      setN(Math.round(v));
      if (t - ticked > (e < A ? 70 : 28)) { ticked = t; sfx.countTick(Math.min(1, v / Math.max(1, to))); }
      if (e < A + B) { raf = requestAnimationFrame(step); return; }
      setN(to);
      setDone(true);
      sfx.slam();
      buzz([90, 30, 140]);
      flash('danger');
      const win = el.current?.closest('.syswin');
      win?.classList.remove('is-shake');
      void (win as HTMLElement | null)?.offsetWidth;
      win?.classList.add('is-shake');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <p ref={el} class={`syswin__line redcount ${done ? 'is-done' : ''}`} aria-label={`Creatures not yet fought: +${to}%`}>
      <span aria-hidden="true">Creatures not yet fought: <span class="warn num">+{n}%</span></span>
    </p>
  );
}

/**
 * The Gate clock, under the hunter's HP: the moves spent against the budget, then the stirring's 20 moves
 * toward red (the bar alone shows how far), with the Gate's mark at the end of the bar, and once it has
 * turned, the Red Gate, sealed.
 */
function GateClock({ c, more }: { c: ClockState; more: number }) {
  const stir = c.over > 0;
  const n = stir ? CLOCK.red : c.budget;
  const done = c.red ? CLOCK.red : stir ? c.over : c.moves;
  const label = c.red ? 'Red Gate' : stir ? 'Stirring' : 'Moves';
  const value = stir ? `+${more}%` : `${c.moves}/${c.budget}`;
  // Stirring, the bar itself shows how far red is.
  const sub = c.red ? 'Sealed' : stir ? null : `${c.left} left`;
  return (
    <div class={`gclock ${c.red ? 'is-red' : stir ? 'is-stir' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={n} aria-valuenow={done}
      aria-label={c.red ? `Red Gate. Creatures not yet fought +${more}%. The way out is sealed.` : stir ? `Stirring. Creatures not yet fought +${more}%. Red Gate in ${c.toRed} moves.` : `Moves: ${c.moves} of ${c.budget}`}>
      <span class="label">{label}</span>
      <span class="gclock__bar" style={`--n:${n <= 40 ? n : Math.ceil(n / 5)}`}>
        <i class="gclock__fill" style={`width:${(done / n) * 100}%`} />
        <span class="gclock__gate" aria-hidden="true"><Glyph name="gates" /></span>
      </span>
      <b class={`gclock__v num ${sub ? '' : 'is-solo'}`}>{value}</b>
      {sub && <small class="gclock__sub num">{sub}</small>}
    </div>
  );
}

/** A cache's find, face down until tapped, turned over by its grade as the results turn over what a run found. */
function CacheFind({ defId }: { defId: string }) {
  const [loot] = useState(() => [{ defId }]);
  const turn = useReveal(loot);
  const name = gear.gearDef(defId)?.name;
  return (
    <>
      {turn.flash}
      <p>Something lies under the dust. You take it.</p>
      <div class={`loot loot--cache ${turn.quake ? 'is-quake' : ''}`}>
        <div class="haul"><LootCell loot={loot[0]} i={0} state={turn.stateOf(0)} onTap={() => turn.reveal(0)} /></div>
      </div>
      {turn.stateOf(0) === 'open' && <p class="muted" dangerouslySetInnerHTML={{ __html: system.outcome({ text: '' }, { item: name }).join('<br />') }} />}
    </>
  );
}

/** A room's name as the panel heads it: a shrine by its Path (`Shrine of Ruin`). */
function nodeName(x: MapNode, run: ReturnType<typeof useSave>['gates']['raid']): string {
  if (x.kind === 'shrine' && run) return `Shrine of ${pathOf(blessings.offerAt(run, x).path)?.name ?? ''}`;
  return NODE[x.kind].name;
}

/** The narration over a shrine's or a Font's cards: what the hunter finds, plainly. */
const SHRINE_LINE = 'Three marks are cut into the altar stone. Each one is warm to the touch.';
const FONT_LINE = 'Water wells up through a crack in the floor, lit from beneath.';

/** A step that is not a fight: what happened, or the choice it puts to you. */
function NodePanel({ d, p, onChoose, onGo, onWithdraw, onRest }: {
  d: NonNullable<ReturnType<typeof dungeonById>>; p: Panel; onChoose: (i: number) => void; onGo: () => void; onWithdraw: () => void; onRest: (pick: raid.RestPick) => void;
}) {
  const s = useSave();
  const run = s.gates.raid;
  const x = p.node;
  const kind = NODE[x.kind];
  const ev = raid.eventAt(x);
  const hero = run?.party[0];
  const waiting = !p.done && run && raid.pending(d, run)?.id === x.id;
  const item = p.item ? gear.gearDef(p.item) : null;
  // A rest in a Gate's rooms is found, not taken: it keeps until the hunter uses it. Up a tower, it waits on them.
  const rooms = !!run && !raid.mapOf(d, run).tower;
  const asks = x.kind === 'rest' && !p.rested && !!run && raid.canRest(d, run);
  const blessed = x.kind === 'shrine' || x.kind === 'font';
  const offer = blessed && run ? blessings.offerAt(run, x) : null;
  const glyph = x.kind === 'shrine' && offer ? STAT_ICON[offer.path] ?? kind.glyph : kind.glyph;
  return (
    <section class={`nodepanel nodepanel--${x.kind}`}>
      <header class="row"><Glyph name={glyph} /><b>{ev?.title ?? nodeName(x, run)}</b></header>
      {x.kind === 'rest' && !p.rested && <p>The air is still here. Nothing has come this way in a long time.</p>}
      {asks && run && <RestChoice s={s} run={run} onRest={onRest} />}
      {x.kind === 'rest' && p.rested && <RestDone pick={p.rested.pick} potions={p.rested.potions} run={run} />}
      {x.kind === 'vault' && !item && p.mats && <p>The seal is broken. What the Gatekeeper kept is stacked inside.</p>}
      {(x.kind === 'treasure' || x.kind === 'vault') && (item ? <CacheFind key={x.id} defId={p.item!} />
        : p.mats ? <><p>Something lies under the dust. You take what is worth carrying.</p><MatList b={p.mats} gain /></>
        : <p>The cache is empty.</p>)}
      {blessed && waiting && <p>{offer?.font ? FONT_LINE : SHRINE_LINE}</p>}
      {ev && !p.done && <p>{ev.text}</p>}
      {p.done && <p>{x.kind === 'font' && offer?.font ? 'The water rises around you, and sinks back into the floor.' : blessed ? 'One of the marks burns, and fades into your skin.' : p.done.effect.text}</p>}
      {p.done && (() => {
        const said = p.done.blessing ? blessings.describe(p.done.blessing, p.done.tier) : undefined;
        // A Path's blessing is named with its tier, as its card and its chip name it.
        const b = said && p.done.blessing && p.done.tier && boonById(p.done.blessing) ? { ...said, name: `${said.name} ${TIERS[p.done.tier - 1]}` } : said;
        const lines = system.outcome(p.done.effect, {
          shards: p.done.effect.shards && !isPractice(d) ? shop.gateShards(d.rank, p.done.effect.shards) : undefined,
          item: p.done.item ? gear.gearDef(p.done.item)?.name : undefined,
          mats: p.done.mats ? bundleText(p.done.mats) : undefined,
          blessing: b,
        });
        return lines.length ? <p class="muted" dangerouslySetInnerHTML={{ __html: lines.join('<br />') }} /> : null;
      })()}
      {waiting && offer && run && (
        <div class="boonlist">
          {offer.picks.map((pk, i) => <BoonCard key={pk.id} id={pk.id} tier={pk.tier} from={offer.font ? blessings.tierOf(run, pk.id) : undefined} onPick={() => onChoose(i)} />)}
        </div>
      )}
      {waiting && ev && hero && (
        <div class="stack stack--tight">
          {ev.choices.map((c, i) => {
            const odds = raid.oddsOf(c, hero, ascension.levelOf(run));
            return (
              <button type="button" key={c.label} class="choice-row" onClick={() => onChoose(i)}>
                <b>{c.label}</b><small>{odds < 1 ? `Success rate: ${Math.round(odds * 100)}%${c.check ? ` (${c.check.stat})` : ''}` : 'Certain'}</small>
              </button>
            );
          })}
        </div>
      )}
      {!waiting && !asks && (
        x.kind === 'rest' && run && !rooms && raid.canWithdraw(d, run)
          ? <div class="row">
            <Btn kind="ghost" onClick={onWithdraw}>Withdraw</Btn>
            <Btn kind="primary" size="lg" class="grow" sound="gate" onClick={onGo}>Press On</Btn>
          </div>
          : <Btn kind="primary" size="lg" block sound="tap" onClick={onGo}>Continue</Btn>
      )}
      {asks && rooms && <Btn kind="ghost" block onClick={onGo}>Later</Btn>}
    </section>
  );
}

/**
 * A rest's three ways, side by side, after the campfire of the reference games: Heal, Hone and Steady,
 * each its mark over its name and what it gives, greyed with the reason where this rest cannot give it.
 * Hone opens the skills it can raise.
 */
function RestChoice({ s, run, onRest }: { s: ReturnType<typeof useSave>; run: NonNullable<ReturnType<typeof useSave>['gates']['raid']>; onRest: (pick: raid.RestPick) => void }) {
  const [honing, setHoning] = useState(false);
  const o = raid.restOptions(s, run);
  const heal = Math.round(o.heal * 100);
  // A level as the tree names it, and past Lv.MAX, how far past it a skill has been honed.
  const lv = (name: string, k: number) => (k < skillMax(name) ? `Lv.${k}` : k === skillMax(name) ? 'Lv.MAX' : `Lv.MAX+${k - skillMax(name)}`);
  if (honing) {
    return (
      <div class="stack stack--tight">
        <small class="label">Hone a skill for the rest of the Gate</small>
        {o.hone.map((name) => (
          <button type="button" key={name} class="choice-row restskill" onClick={() => onRest({ kind: 'hone', skill: name })}>
            <span class="row"><Glyph name={SKILL_GLYPH[name] ?? 'bolt'} /><b>{name}</b></span>
            <small>{lv(name, raid.honedLevel(run, name))} → {lv(name, raid.honedLevel(run, name) + HONE_LEVELS)}</small>
          </button>
        ))}
        <Btn kind="ghost" block onClick={() => setHoning(false)}>Back</Btn>
      </div>
    );
  }
  const ways: { key: raid.RestPick['kind']; glyph: string; name: string; gives: string; why?: string; go: () => void }[] = [
    { key: 'heal', glyph: 'heart', name: 'Heal', gives: `Party HP +${heal}%`, why: heal > 0 ? undefined : 'Sealed: Lightless', go: () => onRest({ kind: 'heal' }) },
    { key: 'hone', glyph: 'forge', name: 'Hone', gives: `A skill +${HONE_LEVELS} level`, why: o.hone.length ? undefined : 'No skill equipped', go: () => setHoning(true) },
    { key: 'steady', glyph: 'shield', name: 'Steady', gives: o.potions ? `Debuffs cleared · Health Potion +${o.potions}` : 'Debuffs cleared', go: () => onRest({ kind: 'steady' }) },
  ];
  return (
    <div class="restways" role="group" aria-label="Rest">
      {ways.map((w) => (
        <button type="button" key={w.key} class={`restway restway--${w.key}`} disabled={!!w.why} onClick={w.go} aria-label={`${w.name}: ${w.why ?? w.gives}`}>
          <span class="restway__mark" aria-hidden="true"><Glyph name={w.glyph} /></span>
          <b>{w.name}</b>
          <small class={w.why ? 'warn' : ''}>{w.why ?? w.gives}</small>
        </button>
      ))}
    </div>
  );
}

/** What a rest just gave: one line of narration, and the System's line under it. */
function RestDone({ pick, potions, run }: { pick: raid.RestPick; potions: number; run: ReturnType<typeof useSave>['gates']['raid'] }) {
  const heal = run ? Math.round(raid.healShare(ascension.levelOf(run), sealing.of(run)) * 100) : 0;
  if (pick.kind === 'heal') return <><p>The party catches its breath.</p><p class="muted"><span class="grant">Party HP +{heal}%</span></p></>;
  if (pick.kind === 'steady') return <><p>You check your straps and bind what is still bleeding.</p><p class="muted"><span class="grant">Debuffs cleared</span>{potions > 0 && <> · <span class="grant">Health Potion +{potions}</span></>}</p></>;
  return <><p>You run through the motions until they come without thinking.</p><p class="muted"><span class="grant">{pick.skill} +{HONE_LEVELS} level</span> · Until you leave the Gate</p></>;
}

/** A skill's top level, from the tree. */
const skillMax = (name: string) => NODES.find((n) => n.kind === 'skill' && n.name === name)?.max ?? 1;

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A tap on a word on a card tells what it is: a small tip by the word, gone on the next tap anywhere. */
export interface TipAt { title: string; lines: string[]; x: number; y: number; below: number }
type Tell = (el: Element, title: string, lines: string[]) => void;

/** The tip a tapped word opens: its name over its lines, under the word, kept on the screen. */
function Tip({ tip, close }: { tip: TipAt; close: () => void }) {
  const w = Math.min(260, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, tip.x - w / 2));
  // Under the word, unless that runs off the foot of the screen.
  const up = tip.below > window.innerHeight - 140;
  return (
    <div class="tipshade" onPointerDown={(e) => { e.preventDefault(); close(); }}>
      <div class="tip" role="tooltip" style={`left:${left}px;width:${w}px;${up ? `bottom:${window.innerHeight - tip.y + 6}px` : `top:${tip.below + 6}px`}`}>
        <b class="tip__title">{tip.title}</b>
        {tip.lines.map((l) => <p key={l}><Keyed text={l} /></p>)}
      </div>
    </div>
  );
}

/** A word on a card that tells what it is when tapped, and never aims or covers. */
function Told({ tell, title, lines, class: cls, children }: { tell?: Tell; title: string; lines: string[]; class: string; children: preact.ComponentChildren }) {
  if (!tell || !lines.length) return <span class={cls}>{children}</span>;
  return (
    <button type="button" class={`${cls} is-told`} aria-label={`${title}. ${lines.join(' ')}`}
      onClick={(e) => { e.stopPropagation(); sfx.blip(); tell(e.currentTarget as Element, title, lines); }}
      onKeyDown={(e) => e.stopPropagation()}>{children}</button>
  );
}

/**
 * A foe's next move, as its card shows it, in a panel: its place in the foes' order on the hunter's turn,
 * and the move by name, never whom it goes at (the party's side shows that: `◀` and the same number on
 * each one it goes at). With Foresight, one hit of it on its target as things stand. A hit that fells
 * its target marks the panel's corner `Lethal`, Foresight or not. What it inflicts, and how often the
 * foes act, are a tap on the move away.
 */
function Intent({ intent, threat, self, sight, tell }: { intent: IntentView; threat?: Threat; self?: UnitView[]; sight: boolean; tell?: Tell }) {
  const a = ability(intent.ab);
  const ally = intent.at ? self?.find((p) => p.uid === intent.at) : undefined;
  const pips = !!(intent.wind && !intent.broken && intent.max);
  const channel = pips && intent.mult === TRICK.channel.mult;
  // A behaviour reads as what it does; a move by its name, and a wind-up as one.
  const what = intent.broken ? `${intent.ab} · Broken`
    : intent.kind === 'shield' ? `Shields ${ally?.name ?? 'an ally'}`
      : intent.kind === 'rally' ? 'Rallies the pack'
        : intent.kind === 'mark' ? 'Marks a target'
          : intent.kind === 'drink' ? `${intent.ab} · HP +${Math.round(TRICK.secondwind.heal * 100)}%`
            : pips ? `${channel ? 'Channelling' : 'Charging'} ${intent.ab}`
              : `${intent.ab}${a?.profile === 'support' ? ' · rallies its side' : a?.profile === 'all' ? ' · everyone' : ''}`;
  const hit = intent.broken ? null : threat?.hit;
  const when = threat ? (threat.soon ? `Acts ${ordinal(threat.order)}` : `Acts ${ordinal(threat.order)}, after your next turn`) : '';
  const inflicts = !intent.kind ? (a?.inflicts ?? []).filter((st) => STATUS_TEXT[st]) : [];
  // What a tap on the move tells: the break, what it inflicts, and how often the foes act.
  const told = [
    ...(pips ? ['Each hit landed on it takes a section of its bar. The last breaks it, and the move is lost.'] : []),
    ...inflicts.map((st) => `Inflicts ${st}: ${STATUS_TEXT[st]}.`),
    ...(threat && threat.times > 1 ? [`Every foe here acts ${threat.times} times each round.`] : []),
  ];
  return (
    <div class={`unit__intent ${intent.at && intent.at === 'hero' && !intent.kind ? 'is-you' : ''} ${hit?.kill ? `is-lethal is-${hit.kill}` : ''} ${pips ? 'is-wind' : ''} ${intent.broken ? 'is-broken' : ''} ${intent.kind ? `is-${intent.kind}` : ''}`}>
      {hit?.kill && <span class="intent__kill">{hit.kill === 'sure' ? 'Lethal' : 'May be lethal'}</span>}
      <div class="intent__move">
        {threat && <span class={`intent__order num ${threat.soon ? '' : 'is-later'}`} role="img" aria-label={when}>{threat.order}</span>}
        <Told tell={tell} title={intent.ab} lines={told} class="intent__what">{intent.kind ? '✦ ' : ''}{what}</Told>
      </div>
      {sight && hit && (
        <div class="intent__hit" role="img" aria-label={`Damage ${hit.lo} to ${hit.hi}, hit chance ${hit.chance}%${intent.mult ? `, times ${intent.mult}` : ''}`}>
          <span>Damage {hit.lo}-{hit.hi}</span><span>Hit {hit.chance}%</span>{intent.mult ? <span class="intent__mult">×{intent.mult}</span> : null}
        </div>
      )}
    </div>
  );
}

function UnitChip({ u, acting, aimed, onPick, intent, incoming, threat, pick = 'aim', self, sight = false, tell, round = 0 }: {
  u: UnitView; acting?: boolean; aimed?: boolean; onPick?: () => void;
  intent?: IntentView; threat?: Threat;
  /** The foes coming for it next: their places in the order on the hunter's turn, or how many otherwise. */
  incoming?: number[] | number;
  /** What a tap on it chooses: the foe to aim at, or the ally to cover. */
  pick?: 'aim' | 'cover';
  /** The foe's own side, for an intent that names one of them. */
  self?: UnitView[];
  /** Foresight: a foe's damage and chance to hit on its card. */
  sight?: boolean;
  tell?: Tell;
  /** The round the fight stands in, for a condition within three rounds. */
  round?: number;
}) {
  const pct = (u.hp / Math.max(1, u.mx)) * 100;
  // A foe's condition drop: gold while its condition holds (the status on it, or the rounds not yet past).
  const cond = u.side === 'e' ? u.cond : undefined;
  const want = cond ? CONDITION[cond] : null;
  const ready = !!want && (want.status ? u.status.includes(want.status) : want.rounds ? round > 0 && round <= want.rounds : false);
  const cls = `unit unit--${u.tag ?? u.side} ${u.hp <= 0 ? 'is-down' : pct < 45 ? 'is-hurt' : ''} ${acting ? 'is-acting' : ''} ${aimed ? 'is-aimed' : ''} ${onPick ? 'is-pickable' : ''} ${onPick && pick === 'cover' ? 'is-coverpick' : ''}`;
  // A wind-up or a channel turns its HP bar into the break: blue, a section to each hit it can still take.
  const brk = intent && intent.wind && !intent.broken && intent.max ? { left: intent.pips ?? 0, max: intent.max } : null;
  const who = u.tag === 'hero' ? 'you' : u.name;
  const coming = Array.isArray(incoming) ? incoming : [];
  const count = Array.isArray(incoming) ? incoming.length : incoming ?? 0;
  const inner = (
    <>
      <div class="row between">
        <b class="unit__name">{u.name}</b>
        <span class="num unit__hp">
          {count > 0 && u.hp > 0 && (
            <span class="unit__incoming" role="img" aria-label={coming.length ? `Coming for ${who} next: the foes ${coming.join(' and ')} in the order` : `${count} ${count === 1 ? 'foe is' : 'foes are'} coming for ${who} next`}>
              ◀{coming.length ? coming.map((n) => <b key={n} class="num">{n}</b>) : <b class="num">{count}</b>}
            </span>
          )}
          {Math.max(0, u.hp)}
        </span>
      </div>
      {brk
        ? <div class="unit__break" role="img" aria-label={`Break: ${brk.left} ${brk.left === 1 ? 'hit' : 'hits'} left of ${brk.max}`}>
          {Array.from({ length: brk.max }, (_, i) => <i key={i} class={i < brk.left ? 'is-on' : ''} />)}
        </div>
        : <Bar pct={pct} tone={u.side === 'e' ? 'blood' : u.tag === 'shadow' ? 'arcane' : 'hp'} thin />}
      {((u.tricks && u.tricks.length > 0) || cond) && (
        <div class="unit__tricks">
          <span class="unit__habits">{u.tricks?.map((k) => <Told key={k} tell={tell} title={TRICKS[k].name} lines={[TRICKS[k].about(u.grade ?? 'E')]} class={`trick trick--${k}`}>{TRICKS[k].name}</Told>)}</span>
          {cond && u.ref && u.hp > 0 && (
            <Told tell={tell} title="Special drop" lines={[conditionLine(u.ref, !!u.boss, cond)!]} class={`dropmark ${ready ? 'is-ready' : ''}`}>
              <Glyph name={dropGlyph(u.ref, !!u.boss)} />
            </Told>
          )}
        </div>
      )}
      {u.status.length > 0 && (
        <div class="unit__status">
          {u.status.map((st) => (
            <Told key={st} tell={tell} title={st} lines={[STATUS_TEXT[st] ?? (st === 'Covered' ? 'What is aimed at it comes at you, guarded, until your next turn.' : '')].filter(Boolean)}
              class={`tag ${STATUS[st]?.good ? (u.side === 'e' ? 'is-foegood' : 'is-good') : ''} ${st === 'Covered' ? 'is-cover' : ''}`}>{st}</Told>
          ))}
        </div>
      )}
      {intent && <Intent intent={intent} threat={threat} self={self} sight={sight} tell={tell} />}
    </>
  );
  // A card that can be picked is a button of its own: the words on it that tell are buttons inside it.
  return onPick
    ? <div class={cls} role="button" tabIndex={0} aria-pressed={!!aimed} aria-label={`${pick === 'cover' ? 'Cover' : 'Aim at'} ${u.name}, ${Math.max(0, u.hp)} HP`}
      onClick={onPick} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(); } }}>{inner}</div>
    : <div class={cls}>{inner}</div>;
}

// ------------------------------------------------------------------ results

const MANA = shop.POTIONS.find((p) => p.id === 'mp')!;

/**
 * The extraction of one lingering Shadow, on the System's sheet: what it was, the cost and the odds,
 * and the hold. The roll is made the moment the hold completes, so the button finishes on it: ARISE,
 * or Failed. A reach that fails leaves it lingering while reaches are left, each at twice the MP of
 * the last; the last to fail disperses it. Bound, the System offers a name.
 */
function Extraction({ l, close, onResult }: { l: raid.Lingering; close: () => void; onResult: (res: Reach, id?: string) => void }) {
  const s = useSave();
  const v = vitals.read(s);
  const e = enemyById(l.enemyId)!;
  const rolled = useRef<{ res: Reach | 'no-mana'; id?: string } | null>(null);
  const [out, setOut] = useState<{ res: Reach; id?: string } | null>(l.bound ? { res: l.essence ? 'essence' : 'bound' } : raid.reachesLeft(l) <= 0 ? { res: 'lost' } : l.tries ? { res: 'failed' } : null);
  const cost = raid.reachCost(l);
  const left = raid.reachesLeft(l);
  const again = !out || out.res === 'failed';
  return (
    <div class={`stack extract ${out ? `is-${out.res}` : ''}`}>
      <div class="extract__who"><RankPlate rank={e.rank} size={30} /><b>{e.shadow}</b></div>
      {again && <>
        <p>The mana of <strong>[{e.name}]</strong> {l.tries ? 'still lingers' : 'lingers'}.</p>
        {/* One like it already serves: this reach is for its Essence. */}
        {l.essence && <>
          <p>But <strong>[{e.shadow}]</strong> already serves in your army.<br />Would you like to extract its Shadow Essence instead?</p>
          <p class="extract__gain"><EssenceMark size={18} /> Shadow Essence <span class="grant num">+{l.essence}</span></p>
        </>}
        {/* After a failure the reach's terms are the warning, in red: what failed, what is left, what the next one costs. */}
        <p class={`extract__terms ${l.tries ? 'warn' : ''}`} key={`t${l.tries}`}>
          {l.tries ? <>[Skill: Shadow Extraction] has failed.<br /></> : null}
          Attempts left: {left}<br />
          Extraction cost: {cost} MP
        </p>
        {v.mp >= cost || rolled.current?.res === 'bound' || rolled.current?.res === 'essence'
          // A fresh hold for every reach; it stays up while it settles, though the reach has spent the MP it showed.
          ? <HoldButton key={l.tries} hold={{ label: l.tries ? 'Hold To Extract Again' : 'Hold To Extract', ms: 3000, ticks: 8, holding: 'Extracting…', done: 'ARISE', failed: 'Failed', after: 900 }}
            decide={() => {
              const res = store.update((x) => raid.extract(x, l, Math.random()));
              const id = res === 'bound' ? store.get().shadows.army[store.get().shadows.army.length - 1]?.id : undefined;
              rolled.current = { res, id };
              return res === 'bound' || res === 'essence';
            }}
            onFire={() => {
              const got = rolled.current;
              if (!got || got.res === 'no-mana') return;
              rolled.current = null;
              setOut({ res: got.res, id: got.id });
              onResult(got.res, got.id);
              if (got.res === 'bound') { sfx.rankUp(); flash('shadow'); buzz([60, 90, 30, 60, 140]); }
              else if (got.res === 'essence') { sfx.success(); flash('shadow'); buzz([30, 50, 60]); }
              else buzz(40);
            }} />
          : <>
            <p class="warn">Not enough MP. ({v.mp}/{cost})</p>
            {/* Short of mana with the Shadow still lingering: a Mana Potion, held or bought, drunk here, without leaving. */}
            <Btn size="sm" block onClick={() => void drinkFlow('mp')}>
              <Glyph name="potion" /> {shop.held(s, 'mp') ? <>Drink {MANA.name} · Held: {shop.held(s, 'mp')}</> : <>Buy {MANA.name} · <Shard size={12} /> <span class="num">{MANA.price}</span></>}
            </Btn>
          </>}
        {out?.res === 'failed' && <Btn block onClick={close}>Close</Btn>}
      </>}
      {out?.res === 'bound' && out.id && <>
        <p class="grant">Extraction successful.</p>
        <p><strong>[{e.shadow}]</strong> has joined your army.</p>
        <p>You may bestow a name.</p>
        <NameField id={out.id} close={() => close()} />
      </>}
      {out?.res === 'essence' && <>
        <p class="grant">Extraction successful.</p>
        <p><strong>[{e.shadow}]</strong> has become Shadow Essence.</p>
        <p class="extract__essence"><EssenceMark size={18} /> Shadow Essence <span class="grant">+{l.essence}</span> · Held: <span class="num">{s.shadows.essence}</span></p>
        <Btn block onClick={close}>Close</Btn>
      </>}
      {out?.res === 'lost' && <>
        <p class="warn">[Skill: Shadow Extraction] has failed.<br />The mana has dispersed.</p>
        <Btn block onClick={close}>Close</Btn>
      </>}
    </div>
  );
}

/** How a reach for a lingering Shadow ended: it held and joined, it held and became Essence, it failed with reaches left, or the last failed. */
type Reach = 'bound' | 'essence' | 'failed' | 'lost';

function Results({ d, r, onDone }: { d: ReturnType<typeof dungeonById> & object; r: raid.RaidResult; onDone: (next?: Dungeon) => void }) {
  const s = useSave();
  // Everything the run found, to turn over by its grade (ui/loot.tsx): the blueprints first, then any piece found whole.
  const [found] = useState<Loot[]>(() => [...r.blueprints.map((defId) => ({ defId, blueprint: true })), ...r.loot.map((item) => ({ item }))]);
  const turn = useReveal(found);
  const [reach, setReach] = useState<Record<number, Reach>>({});
  // The Shadow each extraction bound, by the lingering it came from.
  const [joined, setJoined] = useState<Record<number, string>>({});
  /** The extraction of a lingering Shadow, opened from its alert: the System's sheet, with the hold. */
  const openExtraction = (i: number) => openSheet({
    title: 'Notification', system: { kind: 'shadow' },
    render: (close) => <Extraction l={r.lingering[i]} close={close} onResult={(res, id) => {
      setReach((x) => ({ ...x, [i]: res }));
      if (id) setJoined((x) => ({ ...x, [i]: id }));
    }} />,
  });
  // Auto Equip's place is kept from the start when an upgrade is waiting, so nothing jumps when it appears.
  const [upgradeWaits] = useState(() => gear.upgradeCount(store.get()) > 0);
  const [equipped, setEquipped] = useState(false);
  const { faceDown, revealAll } = turn;
  // A promotion waiting lands as its alert slides in: a chime, and a touch in the hand.
  useEffect(() => {
    if (!r.ready.length) return;
    const t = setTimeout(() => { sfx.ping(); buzz([12, 40, 18]); }, 520);
    return () => clearTimeout(t);
  }, []);
  // The loot is already in the Inventory; leaving with some face down only gets a reminder to look.
  const leave = async (next?: Dungeon) => {
    if (faceDown > 0) {
      const v = await sys({
        title: 'Unrevealed Loot', kind: 'app', typed: false,
        lines: [`${faceDown === 1 ? '1 find is' : `${faceDown} finds are`} still face down. ${faceDown === 1 ? 'It is' : 'They are'} already yours.`],
        actions: [{ label: 'Leave Anyway', value: 'leave' }, { label: 'Reveal All', value: 'reveal', primary: true }],
      });
      if (v !== 'leave') { revealAll(); return; }
    }
    // A Shadow still lingering, with reaches left, disperses when the hunter walks out: a reminder, once.
    const waiting = r.lingering.findIndex((l) => raid.reachesLeft(l) > 0);
    if (waiting >= 0) {
      const v = await sys({
        title: 'A Shadow Lingers', kind: 'app', typed: false,
        lines: ['Its mana disperses when you leave the Gate.'],
        actions: [{ label: 'Leave Anyway', value: 'leave' }, { label: 'Extract', value: 'extract', primary: true }],
      });
      if (v !== 'leave') { openExtraction(waiting); return; }
    }
    onDone(next);
  };
  // A floor of the Spire taken opens the next ones: the hunter may climb straight on, while fit to enter.
  const block = r.outcome === 'cleared' && r.spire && spire.isSpire(d) ? spire.nextBlock(s) : null;
  const next = block !== null ? spire.nextSpire(s) : null;
  const climb = next && !entryBlock(s, next) ? next : null;
  const v = vitals.read(s);
  const trial = isTrial(d);
  const title = r.outcome === 'cleared' ? r.spire ? `Floor ${r.spire.floor} Taken` : trial ? 'Trial Won' : 'Gate Cleared' : r.outcome === 'withdrawn' ? 'Withdrawn' : 'Carried Out';
  const deal = r.contracts;
  // What the Daily Quests paid is shown once, on their own lines below, so the tiles do not repeat it.
  const xpSub = r.xp?.levels ? `Level ${r.xp.to}` : r.outcome === 'cleared' ? 'paid in full' : 'a share, for what you cleared';
  const shardSub = [r.bounty > 0 ? `First-clear bounty +${r.bounty}` : r.banked > 0 ? `Banked +${r.banked}` : ''].filter(Boolean);
  return (
    <div class={`arena arena--results is-${r.outcome}`} role="dialog" aria-label={title}>
      {turn.flash}
      <div class={`arena__results stack ${turn.quake ? 'is-quake' : ''}`}>
        <header class="report__head">
          <span class="label">{d.name}</span>
          <h2>{title}</h2>
          <p class="muted">{r.outcome === 'cleared' ? isPractice(d) ? 'The Practice Gate is closed.'
            : r.spire ? r.spire.best ? `Floor ${r.spire.floor} cleared: your best this week. The next ${BLOCK} floors are open.` : `Floor ${r.spire.floor} cleared. The week closed while you were inside, so it does not count this week.`
              : trial ? `The last of the Chosen is down: ${r.depth} in a row.`
              : `${d.name} is closed. A new ${d.rank}-Rank Gate has opened on the board.`
            : r.outcome === 'withdrawn' ? d.floor ? `Withdrawn from the rest on Floor ${d.floor + r.steps - 1}. These floors stay as they are until Monday.` : r.rooms ? `Withdrawn with ${r.steps} of ${r.rooms} rooms cleared. The Gate is still open.` : `Withdrawn at step ${r.steps} of ${r.depth}. The Gate is still open.`
              : trial ? 'You were carried out. The Trial opens again tomorrow. Proven Gates stay proven.'
              : `The party was carried out. You are locked out of Gates for ${vitals.WIPE_LOCK / 36e5} hours.`}</p>
        </header>
        <div class="tiles">
          <div class="tile"><span class="label">XP</span><b class="tile__v num">+{r.xp?.gained ?? 0}</b><small class="tile__sub">{xpSub}</small></div>
          <div class="tile"><span class="label">Shards</span><b class="tile__v"><Shards n={r.shards + r.bounty + deal.shards} /></b>{shardSub.length ? <small class="tile__sub">{shardSub.join(' · ')}</small> : r.dungeonId === 'DNG-000' ? <small class="tile__sub">the Practice Gate pays in kit</small> : null}</div>
          <div class="tile"><span class="label">Health</span><b class="tile__v num">{v.hp}/{v.hpMax}</b><small class="tile__sub">{v.locked ? `Locked out: ${Math.ceil(v.lockedFor / 36e5)}h` : `HP +${Math.round(vitals.PCT_PER_HOUR * 100)}% each hour`}</small></div>
          <div class="tile"><span class="label">Fatigue</span><b class="tile__v num">{v.fatigue}</b><small class="tile__sub">of {vitals.FATIGUE_MAX}</small></div>
        </div>
        {Object.keys(r.mats).length > 0 && (
          <section class="sysbox spoils">
            <span class="label">Materials</span>
            <MatList b={r.mats} gain />
          </section>
        )}
        {r.outcome === 'cleared' && r.feats.asked.length > 0 && (
          <section class="sysbox bfeats" aria-label="Feats">
            <div class="row between"><span class="label">Feats</span><small class="num">{r.feats.met.length}/{r.feats.asked.length}</small></div>
            {r.feats.asked.map((id) => (
              <div key={id} class={`bfeat ${r.feats.met.includes(id) ? 'is-done' : ''}`}>
                <Glyph name="star" class="bfeat__star" />
                <span class="bfeat__body"><b>{FEATS[id].name}</b><small>{FEATS[id].text}</small></span>
                <span class="bfeat__side"><small class={r.feats.fresh.includes(id) ? 'grant' : 'muted'}>{r.feats.fresh.includes(id) ? `First time: Blueprint +${FEAT_PAY.blueprints}` : r.feats.met.includes(id) ? 'Met' : 'Not met'}</small></span>
              </div>
            ))}
          </section>
        )}
        {(r.seals.length > 0 || r.drops > 0) && (
          <div class="alerts">
            {r.seals.length > 0 && <SysAlert fyi delay={150} icon={<Glyph name="lock" />}><strong>[Seals]</strong> {r.seals.map((id) => SEALS[id].name).join(', ')}{r.outcome === 'defeated' ? '. Carried out: nothing is paid.' : '. Their pay is in what the run left.'}</SysAlert>}
            {r.drops > 0 && <SysAlert fyi delay={200} icon={<Glyph name="bone" />}><strong>[Special drops]</strong> <span class="grant num">{r.drops}</span> {r.drops === 1 ? 'creature' : 'creatures'} defeated the way their condition asks.</SysAlert>}
          </div>
        )}
        {/* The weapon carried in, growing familiar: the System reports it, and a rank reached says so. */}
        {r.familiarity && (() => {
          const f = r.familiarity;
          const up = f.rankTo > f.rankFrom;
          return (
            <div class="alerts">
              <SysAlert fyi delay={250} class={`famalert ${up ? 'is-up' : ''}`} icon={<Glyph name="Weapon" />}
                aside={<span class="fampips" aria-label={`Familiarity ${f.rankTo} of ${forge.FAMILIARITY_MAX}`}>{Array.from({ length: forge.FAMILIARITY_MAX }, (_, i) => <i key={i} class={i < f.rankTo ? 'is-on' : ''} />)}</span>}
                sub={up ? undefined : <>Familiarity points <span class="grant num">+{f.to - f.from}</span></>}>
                <strong>[{gear.gearDef(f.defId)?.name}]</strong> {up ? <>Familiarity: {f.rankFrom} → <span class="grant">{f.rankTo}</span></> : <>Familiarity {f.rankTo}</>}
              </SysAlert>
            </div>
          );
        })()}
        {found.length > 0 && (
          <section class="loot">
            <span class="label">{faceDown ? 'Tap to reveal' : 'Tap a find for its card'}</span>
            <div class="haul">
              {found.map((l, i) => (
                <LootCell key={'item' in l ? l.item.id : `bp-${l.defId}`} loot={l} i={i} state={turn.stateOf(i)} onTap={() => turn.reveal(i)}
                  onOpen={() => { sfx.tap(); if ('item' in l) openItem(l.item.id); else openBlueprint(l.defId); }} />
              ))}
            </div>
            {upgradeWaits && (
              // Dimmed until everything is turned over: one more reason to turn it.
              <div class={`loot__act ${faceDown ? '' : 'is-ready'}`}>
                {equipped
                  ? <span class="grant">Upgrades equipped</span>
                  : <Btn kind="gold" size="sm" disabled={faceDown > 0} onClick={() => { store.update(gear.autoEquip); setEquipped(true); sfx.success(); }}>Auto Equip Upgrades</Btn>}
              </div>
            )}
          </section>
        )}
        {/* A lingering Shadow is an alert; tapped, it opens the extraction, where the hold is. */}
        {r.lingering.length > 0 && (
          <div class="alerts">
            {r.lingering.map((l, i) => {
              const e = enemyById(l.enemyId)!;
              const out = reach[i];
              const done = out === 'bound' || out === 'essence' || out === 'lost';
              const sh = joined[i] ? s.shadows.army.find((x) => x.id === joined[i]) : undefined;
              return (
                <SysAlert key={`${l.enemyId}-${i}`} kind="shadow" fyi={done} delay={400 + i * 200} class={out ? `is-${out}` : ''}
                  label={done ? undefined : `The mana of ${e.name} ${out ? 'still lingers' : 'lingers'}. Open the extraction.`}
                  icon={sh ? <ShadowEmblem family={e.family} rank={0} size={36} /> : <FamilyGlyph family={e.family} size={30} />}
                  onTap={done ? undefined : () => openExtraction(i)}
                  aside={out === 'bound' ? <span class="grant">ARISE</span> : out === 'lost' ? <span class="warn">Failed</span>
                    : l.essence ? <span class="sp-essence"><EssenceMark /><span class="grant num">+{l.essence}</span></span> : null}>
                  {out === 'bound' ? <><strong>[{sh ? shadows.nameOf(sh) : e.shadow}]</strong> has joined your army.</>
                    : out === 'essence' ? <><strong>[{e.shadow}]</strong> has become Shadow Essence.</>
                    : out === 'lost' ? <>The mana of <strong>[{e.name}]</strong> has dispersed.</>
                    : out === 'failed' ? <>The mana of <strong>[{e.name}]</strong> still lingers. Attempts left: {raid.reachesLeft(l)}</>
                    : <>The mana of <strong>[{e.name}]</strong> lingers.</>}
                </SysAlert>
              );
            })}
          </div>
        )}
        {/* A Chosen felled and a level proved: alerts, as everything the System reports here is. */}
        {(r.chosen || r.ascended !== null) && (
          <div class="alerts">
            {r.chosen && (
              <SysAlert kind="gates" fyi delay={450} class="is-chosen"
                icon={r.chosen.item ? <GearArt item={r.chosen.item} size={38} /> : <Glyph name="crown" />}
                onTap={r.chosen.item ? () => openItem(r.chosen!.item!.id) : undefined}
                label={r.chosen.item ? `You have acquired ${gear.defOf(r.chosen.item)?.name}. Open its card.` : undefined}
                aside={r.chosen.item ? null : <span class="num">Mana Shards <span class="grant">+{r.chosen.shards}</span></span>}
                sub={r.chosen.item
                  ? <>You have acquired <strong>[Item: {gear.defOf(r.chosen.item)?.name}]</strong>. Quality: Perfect +{r.chosen.level}<br />[{r.chosen.name}] will return to the Gates.</>
                  : <>[{r.chosen.name}] will return to the Gates.</>}>
                You have defeated <span class="warn">[{r.chosen.name}]</span>.
              </SysAlert>
            )}
            {r.ascended !== null && (
              <SysAlert kind="gold" fyi delay={600} class="is-ascended" icon={<Glyph name="up" />}
                sub={<>[Ascension {r.ascended}: {ascension.levelInfo(r.ascended).name}] · Upgrade limit: Perfect <span class="grant">+{r.ascended * OVERCHARGE.per}</span> · Marks <span class="grant">+1</span></>}>
                <span class="grant">ACCESS GRANTED: ASCENSION {r.ascended}</span>
              </SysAlert>
            )}
          </div>
        )}
        <ShadowAlerts grew={r.grew} ready={r.ready} />
        {!isPractice(d) && deal.moved.length > 0 && <QuestLines c={s.contracts} report={deal} />}
        {r.assoc && association.current(s) && <AssocStrip q={association.current(s)!} move={r.assoc} />}
        {climb && block !== null && (
          <Btn kind="primary" size="lg" block class="climb" onClick={() => void leave(climb)} sound="tap">
            <Glyph name="up" /> Climb On · Floors {spire.firstFloor(block)}-{spire.lastFloor(block)}
          </Btn>
        )}
        <Btn kind={climb ? undefined : 'primary'} size="lg" block onClick={() => void leave()} sound="tap"><Glyph name="exit" /> Leave The Gate</Btn>
      </div>
    </div>
  );
}
