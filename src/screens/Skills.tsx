/**
 * SKILLS: the skill tree, in the System's frame.
 *
 * At the top, the five Paths as a constellation around the hunter: one arm to each stat, laid out as
 * the Stats radar lays them, every node a star on it, the rank rings it crosses lit as the hunter
 * claims them. Its centre holds the Skill Points to spend. Below it, the skills taken into a fight,
 * then the chosen Path as a tree, tier by tier, and the card of the node last tapped, which is where a
 * point is spent. Everything it shows is read from the engine (`core/skilltree.ts`) and its data.
 *
 * Gold is only ever what waits on the hunter: points to spend, and the nodes that can take one.
 * What is learned is the System's cyan.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { passiveText, REACH_TEXT, STATUS_TEXT } from '@/core/combat';
import { bonusText } from '@/core/gear';
import * as tree from '@/core/skilltree';
import type { TreeNode } from '@/core/skilltree';
import type { Ability, Save, Stat } from '@/core/types';
import { group, rng } from '@/core/util';
import { classById } from '@/data/classes';
import { NODES, nodeById, PATHS, pathOf, TIER_GATE, TIER_RANKS, type SkillUp } from '@/data/tree';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn } from '@/ui/components';
import { buzz, flash as glow } from '@/ui/feedback';
import { Glyph, SKILL_GLYPH, STAT_ICON } from '@/ui/icons';
import { openSheet, sys } from '@/ui/overlays';
import * as system from '@/ui/system';

export function openSkills() {
  openSheet({ title: 'Skills', system: { icon: null }, render: () => <SkillsSheet /> });
}

// ------------------------------------------------------------------ words, read from the data

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** What a skill does at a level: its type, force, reach, cooldown and what it inflicts. */
export function skillLine(a: Ability): string {
  const cd = a.cd ? ` · Cooldown ${a.cd}` : '';
  if (a.profile === 'support') {
    if (a.heal) return `The whole party: HP +${Math.round(a.heal * 100)}%${cd}`;
    if (a.grant) return `The whole party: ${a.grant}${STATUS_TEXT[a.grant] ? ` (${STATUS_TEXT[a.grant]})` : ''}${cd}`;
    return `Rallies the whole party${cd}`;
  }
  if (a.profile === 'taunt') return `Every foe's next action goes at you. You guard until your next turn${cd}`;
  if (a.mult === 0) return `${cap(REACH_TEXT[a.profile] ?? 'one target')} · Inflicts ${a.inflicts.join(' and ')} · No damage. Never misses${cd}`;
  return [
    `${a.type === 'magic' ? 'Magic' : 'Physical'} ×${a.mult}`,
    cap(REACH_TEXT[a.profile] ?? 'one target'),
    a.cd ? `Cooldown ${a.cd}` : '',
    a.inflicts.length ? `Inflicts ${a.inflicts.join(' and ')}` : '',
  ].filter(Boolean).join(' · ');
}

/** What the next level adds, as the changes it makes. */
function upLine(n: TreeNode, level: number): string {
  const was = tree.skillAt(n, level);
  const now = tree.skillAt(n, level + 1);
  const up: SkillUp = n.up?.[level - 1] ?? {};
  const parts: string[] = [];
  if (now.mult !== was.mult) parts.push(`×${now.mult}`);
  if (up.cd) parts.push(`Cooldown ${now.cd}`);
  if (up.profile) parts.push(cap(REACH_TEXT[now.profile] ?? 'one target'));
  if (up.inflicts) parts.push(`Inflicts ${up.inflicts.join(' and ')}`);
  return parts.join(' · ');
}

/** A stat node's bonus at a number of ranks. */
function statLine(n: TreeNode, k: number): string {
  const attrs = Object.entries(n.attrs ?? {}).map(([a, v]) => `${a} +${v * k}`);
  const bonus = n.bonus ? bonusText(Object.fromEntries(Object.entries(n.bonus).map(([b, v]) => [b, Math.round(v * k * 1000) / 1000]))) : '';
  return [...attrs, bonus].filter(Boolean).join(' · ');
}

const KIND_WORD: Record<TreeNode['kind'], string> = { skill: 'Skill', passive: 'Passive', stat: 'Stat' };

/** Why a node takes no point, as the System reports it. */
function blockLine(s: Save, n: TreeNode, why: tree.Block): string {
  const p = pathOf(n.path)!;
  if (why === 'max') return n.max > 1 ? `Lv.MAX` : 'Learned.';
  if (why === 'rank') return `Opens at ${TIER_RANKS[n.tier]}-Rank.`;
  if (why === 'path') return `Points in ${p.name}: ${tree.inPath(s, n.path)}/${TIER_GATE[n.tier]}`;
  if (why === 'req') return `Requires: [${nodeById(n.req!)!.name}]`;
  if (why === 'fork') return `Sealed: [${nodeById(n.fork!)!.name}] is held.`;
  return 'Skill Points: 0';
}

// ------------------------------------------------------------------ icons

const PATH_D: Record<string, string> = {
  blade: 'M5 19 17 7M13.5 4.5h6v6M7.5 13.5l3 3M4 20l2-2',
  orb: 'M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zM12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5',
  cleave: 'M4 15.5C7 7 15 4.5 20.5 9M6.5 20c3-6.5 9.5-8.5 14-5',
  volley: 'M3.5 6.5h13M14 3.5l3 3-3 3M3.5 12h16M17 9l3 3-3 3M3.5 17.5h13M14 14.5l3 3-3 3',
  wild: 'M4.5 4.5l5 5M14.5 14.5l5 5M19.5 4.5l-5 5M9.5 14.5l-5 5M12 2.5v4M12 17.5v4',
  burst: 'M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M18.7 5.3l-3.5 3.5M8.8 15.2l-3.5 3.5',
  all: 'M12 2.8 14.2 9.8 21.2 12 14.2 14.2 12 21.2 9.8 14.2 2.8 12 9.8 9.8z',
  support: 'M12 3 19 6v5.2c0 4.4-2.9 8-7 9.8-4.1-1.8-7-5.4-7-9.8V6z',
  fork: 'M12 3.5 20.5 12 12 20.5 3.5 12zM12 8.5 15.5 12 12 15.5 8.5 12z',
};

const BONUS_GLYPH: Record<string, string> = {
  patk: 'fist', mpow: 'brain', defense: 'Off-Hand', resist: 'Off-Hand', maxHp: 'heart', recovery: 'potion',
  evasion: 'dash', initiative: 'timer', accuracy: 'eye', crit: 'star', statusChance: 'skull',
};

function skillIcon(a: Ability): string {
  if (a.profile === 'single') return a.type === 'magic' ? 'orb' : 'blade';
  if (a.profile === 'spread') return 'volley';
  return PATH_D[a.profile] ? a.profile : 'blade';
}

/** A skill's own glyph, as the action wheel draws it: on its card and in the skill slots. In the tree, a node keeps its reach's mark. */
function SkillMark({ n, level = 1 }: { n: TreeNode; level?: number }) {
  const g = n.kind === 'skill' && n.skill ? SKILL_GLYPH[n.skill] : undefined;
  return g ? <Glyph name={g} /> : <NodeIcon n={n} level={level} />;
}

/** A node's mark: a skill's by its reach, a passive's by its place, a stat's by what it raises. */
export function NodeIcon({ n, level = 1 }: { n: TreeNode; level?: number }) {
  if (n.kind === 'stat') {
    const key = n.attrs ? null : Object.keys(n.bonus ?? {})[0];
    return <Glyph name={key ? BONUS_GLYPH[key] ?? 'plus' : STAT_ICON[n.path]} />;
  }
  if (n.kind === 'passive' && !n.fork) return <Glyph name={n.tier >= 4 ? 'crown' : 'star'} />;
  const d = n.kind === 'passive' ? PATH_D.fork : PATH_D[skillIcon(tree.skillAt(n, Math.max(1, level)))];
  return (
    <svg viewBox="0 0 24 24" class="st-icon" aria-hidden="true">
      <path d={d} fill={n.kind === 'skill' && (d === PATH_D.all || d === PATH_D.support) ? 'currentColor' : 'none'} fill-opacity=".18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

// ------------------------------------------------------------------ a node's state

type State = 'max' | 'learned' | 'open' | 'shut' | 'sealed';

function stateOf(s: Save, n: TreeNode): { state: State; can: boolean; k: number } {
  const k = tree.levelOf(s, n.id);
  const why = tree.blocked(s, n);
  const can = why === null;
  if (k >= n.max) return { state: 'max', can, k };
  if (k > 0) return { state: 'learned', can, k };
  if (why === 'fork') return { state: 'sealed', can, k };
  return { state: can ? 'open' : 'shut', can, k };
}

// ------------------------------------------------------------------ the constellation

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RING = (t: number) => 46 + t * 24.5;
const ANGLE = (i: number) => ((-90 + i * 72) * Math.PI) / 180;

/** Where a node sits on the constellation: out along its Path's arm, its column spread across it. */
function spot(n: TreeNode): [number, number] {
  const i = PATHS.findIndex((p) => p.key === n.path);
  const a = ANGLE(i);
  const r = RING(n.tier);
  const off = (n.col - 2) * (8 + n.tier * 1.4);
  return [CX + Math.cos(a) * r - Math.sin(a) * off, CY + Math.sin(a) * r + Math.cos(a) * off];
}

const STARS = (() => {
  const r = rng('arise|constellation');
  return Array.from({ length: 46 }, () => ({ x: r() * SIZE, y: r() * SIZE, r: 0.4 + r() * 1.1, d: r() * 5 }));
})();

/**
 * The five Paths around the hunter. `mini` draws it for a tile: no labels, nothing to tap.
 * `fresh` is the node a point just went into, which flares.
 */
export function Constellation({ s, path, onPath, fresh, mini }: { s: Save; path?: Stat; onPath?: (p: Stat) => void; fresh?: string | null; mini?: boolean }) {
  const open = tree.rankTier(s);
  const pts = tree.points(s);
  const due = tree.canSpend(s);
  const cls = classById(s.hunter.classId);
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} class={`st-sky ${mini ? 'is-mini' : ''}`} role={mini ? undefined : 'group'} aria-label={mini ? undefined : 'Paths'} aria-hidden={mini ? 'true' : undefined}>
      <defs>
        <radialGradient id={mini ? 'stCoreMini' : 'stCore'} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--st-core-a)" />
          <stop offset="100%" stop-color="var(--st-core-b)" />
        </radialGradient>
      </defs>
      {!mini && STARS.map((x, i) => <circle key={i} cx={x.x} cy={x.y} r={x.r} class="st-sky__star" style={`animation-delay: -${x.d}s`} />)}
      {TIER_RANKS.map((rk, t) => (
        <g key={rk}>
          <circle cx={CX} cy={CY} r={RING(t)} class={`st-sky__ring ${t <= open ? 'is-open' : ''}`} />
        </g>
      ))}
      {PATHS.map((p, i) => {
        const a = ANGLE(i);
        const sel = path === p.key;
        const end = RING(4) + 10;
        return (
          <g key={p.key} class={`st-sky__arm ${sel ? 'is-sel' : ''} ${path && !sel ? 'is-dim' : ''}`}>
            <line x1={CX + Math.cos(a) * 30} y1={CY + Math.sin(a) * 30} x2={CX + Math.cos(a) * end} y2={CY + Math.sin(a) * end} class="st-sky__axis" />
            {NODES.filter((n) => n.path === p.key).map((n) => {
              const from = n.req ? spot(nodeById(n.req)!) : n.tier === 0 ? [CX + Math.cos(a) * 30, CY + Math.sin(a) * 30] : null;
              if (!from) return null;
              const [x, y] = spot(n);
              const lit = tree.levelOf(s, n.id) > 0 && (!n.req || tree.levelOf(s, n.req) > 0);
              return <line key={`l${n.id}`} x1={from[0]} y1={from[1]} x2={x} y2={y} class={`st-sky__link ${lit ? 'is-lit' : ''}`} />;
            })}
            {NODES.filter((n) => n.path === p.key).map((n) => {
              const [x, y] = spot(n);
              const { state, can } = stateOf(s, n);
              const r = n.kind === 'stat' ? 3 : 3.8;
              const c = `st-sky__node is-${state} ${can ? 'is-can' : ''} ${fresh === n.id ? 'is-fresh' : ''}`;
              return n.kind === 'passive'
                ? <rect key={n.id} x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} class={c} />
                : <circle key={n.id} cx={x} cy={y} r={r} class={c} />;
            })}
            {!mini && (() => {
              // Clear of the outermost stars: above them on the top and side arms, below them on the bottom ones.
              const lx = CX + Math.cos(a) * 156;
              const ly = CY + Math.sin(a) * 156 + (Math.sin(a) > 0.5 ? 8 : Math.sin(a) < -0.9 ? -12 : Math.abs(Math.cos(a)) > 0.7 ? -26 : 0);
              const n = tree.inPath(s, p.key);
              const calls = NODES.some((x) => x.path === p.key && tree.canLearn(s, x));
              return (
                <g class="st-sky__label">
                  <text x={lx} y={ly - 3} class="st-sky__name">{p.name}</text>
                  <text x={lx} y={ly + 10} class={`st-sky__count num ${calls ? 'is-call' : ''}`}>{p.key} · {n}</text>
                </g>
              );
            })()}
            {!mini && onPath && (
              <path class="st-sky__hit" d={wedge(a)} onClick={() => { sfx.tap(); onPath(p.key); }}>
                <title>{p.name}</title>
              </path>
            )}
          </g>
        );
      })}
      <g class={`st-sky__core ${due ? 'is-due' : ''}`}>
        <circle cx={CX} cy={CY} r="30" class="st-sky__halo" />
        <circle cx={CX} cy={CY} r="24" class="st-sky__spin" />
        <circle cx={CX} cy={CY} r="19" fill={`url(#${mini ? 'stCoreMini' : 'stCore'})`} class="st-sky__heart" />
        {mini ? null : pts > 0
          ? <><text x={CX} y={CY + 6} class="st-sky__pts num">{pts}</text><text x={CX} y={CY + 16} class="st-sky__cap">POINTS</text></>
          : <foreignObject x={CX - 10} y={CY - 10} width="20" height="20"><span class="st-sky__glyph"><Glyph name={cls ? STAT_ICON[cls.lead] : 'unknown'} /></span></foreignObject>}
      </g>
    </svg>
  );
}

/** The slice of the sky a Path's arm owns, for a finger. */
function wedge(a: number): string {
  const r = SIZE / 2;
  const w = (36 * Math.PI) / 180;
  const p = (t: number) => `${CX + Math.cos(t) * r} ${CY + Math.sin(t) * r}`;
  return `M ${CX} ${CY} L ${p(a - w)} A ${r} ${r} 0 0 1 ${p(a + w)} Z`;
}

// ------------------------------------------------------------------ one Path's tree

const ROW = 112;
const HEAD = 20;
const SHAPE = 27;
/** How far from a node's centre its links start and end: at the edge of the shape, not inside it. */
const EDGE_OFF = 22;
/** How far below a node's centre a link to another column bends: past its name, on one or two lines. */
const TRUNK = 64;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(el.clientWidth || 320);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function PathTree({ s, path, sel, onSel, fresh }: { s: Save; path: Stat; sel: string | null; onSel: (id: string) => void; fresh: string | null }) {
  const [ref, w] = useWidth();
  const nodes = NODES.filter((n) => n.path === path);
  const p = pathOf(path)!;
  const X = (col: number) => ((col + 0.5) * w) / 5;
  const Y = (tier: number) => tier * ROW + HEAD + SHAPE;
  const slots = tree.equipped(s).map((n) => n.id);
  return (
    <div class="st-path" ref={ref}>
      <svg class="st-path__links" width={w} height={ROW * 5} viewBox={`0 0 ${w} ${ROW * 5}`} aria-hidden="true">
        {nodes.filter((n) => n.req).map((n) => {
          const r = nodeById(n.req!)!;
          const lit = tree.levelOf(s, n.id) > 0 && tree.levelOf(s, r.id) > 0;
          const call = !lit && tree.levelOf(s, r.id) > 0 && tree.canLearn(s, n);
          // From under the node it grows from to the top of this one: straight down a column, or, to
          // another column, one trunk down past the name before it bends, so branches split below it.
          const [x1, y1, x2, y2] = [X(r.col), Y(r.tier) + EDGE_OFF, X(n.col), Y(n.tier) - EDGE_OFF];
          const fork = Y(r.tier) + TRUNK;
          const mid = (fork + y2) / 2;
          const d = x1 === x2 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} L ${x1} ${fork} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
          return (
            <g key={n.id}>
              <path d={d} class={`st-link ${lit ? 'is-lit' : ''} ${call ? 'is-call' : ''}`} />
              {lit && <path d={d} class="st-link__flow" />}
              {fresh === n.id && <path d={d} pathLength={1} class="st-link__draw" />}
            </g>
          );
        })}
      </svg>
      {TIER_RANKS.map((rk, t) => {
        const byRank = tree.rankTier(s) >= t;
        const open = tree.tierOpen(s, path, t);
        const have = tree.inPath(s, path);
        return (
          <div class={`st-tier ${open ? 'is-open' : 'is-shut'}`} key={rk}>
            <div class="st-tier__head">
              <span class="st-tier__rank">{rk}-RANK</span>
              {!open && <small class="st-tier__gate">{!byRank ? <><Glyph name="lock" />Opens at {rk}-Rank</> : <>Points in {p.name}: <b class="num">{have}/{TIER_GATE[t]}</b></>}</small>}
            </div>
            <div class="st-tier__row">
              {nodes.filter((n) => n.tier === t).map((n) => {
                const { state, can, k } = stateOf(s, n);
                const slot = slots.indexOf(n.id);
                return (
                  <button type="button" key={n.id} style={`grid-column: ${n.col + 1}`}
                    class={`st-node st-node--${n.kind} ${n.fork ? 'st-node--fork' : ''} is-${state} ${can ? 'is-can' : ''} ${sel === n.id ? 'is-sel' : ''} ${fresh === n.id ? 'is-fresh' : ''}`}
                    aria-pressed={sel === n.id} aria-label={`${n.name}, ${KIND_WORD[n.kind]}, ${k}/${n.max}`}
                    onClick={() => { sfx.tap(); onSel(n.id); }}>
                    <span class="st-node__shape"><NodeIcon n={n} level={k} /></span>
                    {n.max > 1 && <span class="st-node__lv num">{k}/{n.max}</span>}
                    {slot >= 0 && <span class="st-node__slot num" title={`Slot ${slot + 1}`}>{slot + 1}</span>}
                    <span class="st-node__name">{n.name}</span>
                    {fresh === n.id && <span class="st-node__burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={`--a: ${i * 36}deg`} />)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ the card

interface Flash { id: string; at: number; lines: string[] }

function NodeCard({ s, id, flash, onLearn, onEquip }: { s: Save; id: string | null; flash: Flash | null; onLearn: (id: string) => void; onEquip: (id: string) => void }) {
  const n = id ? nodeById(id) : null;
  if (!n) return null;
  const { k } = stateOf(s, n);
  const why = tree.blocked(s, n);
  const p = pathOf(n.path)!;
  const eq = tree.isEquipped(s, n.id);
  const now = n.kind === 'skill' ? skillLine(tree.skillAt(n, Math.max(1, k)))
    : n.kind === 'passive' ? passiveText(n.passive!)
      : statLine(n, Math.max(1, k));
  const next = k > 0 && k < n.max ? (n.kind === 'skill' ? upLine(n, k) : n.kind === 'stat' ? statLine(n, k + 1) : '') : '';
  const word = KIND_WORD[n.kind];
  const show = flash && flash.id === n.id;
  return (
    <section class={`st-card sysbox ${why === null ? 'is-can' : ''}`} aria-live="polite">
      <header class="st-card__head">
        <span class="st-card__icon"><SkillMark n={n} level={k} /></span>
        <span class="st-card__title"><small>{word.toUpperCase()} · {p.name} · {TIER_RANKS[n.tier]}-Rank</small><b>{n.name}</b></span>
        <span class="st-card__lv num">{n.max > 1 ? `Lv.${k}/${n.max}` : k ? 'Learned' : 'Lv.0/1'}</span>
      </header>
      <p class="st-card__now">{k === 0 && n.max > 1 ? <span class="st-card__at">Lv.1: </span> : null}{now}</p>
      {next && <p class="st-card__next"><span class="st-card__at">Lv.{k + 1}{k + 1 === n.max ? ' (MAX)' : ''}: </span><span class="grant">{next}</span></p>}
      {n.kind === 'skill' && k === 0 && (n.up?.length ?? 0) > 0 && (
        <p class="st-card__next muted"><span class="st-card__at">Lv.MAX: </span>{skillLine(tree.skillAt(n, n.max))}</p>
      )}
      {n.fork && <p class="st-card__fork"><Glyph name="swap" />Fork: [{nodeById(n.fork)!.name}]</p>}
      {why && why !== 'max' && <p class={`st-card__why ${why === 'points' ? '' : 'is-shut'}`}>{blockLine(s, n, why)}</p>}
      {show && <p class="st-card__flash" key={flash!.at} dangerouslySetInnerHTML={{ __html: flash!.lines.join('<br>') }} />}
      <div class="st-card__acts">
        {why === null && <Btn kind="gold" sound="none" onClick={() => onLearn(n.id)}>{k ? 'Level Up' : 'Learn'}</Btn>}
        {n.kind === 'skill' && k > 0 && <Btn onClick={() => onEquip(n.id)}>{eq ? 'Unequip' : tree.equipped(s).length < tree.slots(s) ? 'Equip' : 'Swap In'}</Btn>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ the loadout

function Loadout({ s, swap, onSlot, onCancel }: { s: Save; swap: string | null; onSlot: (i: number) => void; onCancel: () => void }) {
  const on = tree.equipped(s);
  const n = tree.slots(s);
  const coming = swap ? nodeById(swap) : null;
  return (
    <div class={`st-loadout ${swap ? 'is-swap' : ''}`}>
      <div class="st-loadout__head">
        <span class="label">{coming ? <>Slot for [{coming.name}]</> : 'Skill slots'}</span>
        {coming ? <button type="button" class="linkish" onClick={onCancel}>Cancel</button> : <b class="num">{on.length}/{n}</b>}
      </div>
      <div class="st-slots" style={`--n: ${n}`}>
        {Array.from({ length: n }, (_, i) => {
          const x = on[i];
          return (
            <button type="button" key={i} class={`sysbox st-slot ${x ? 'is-on' : 'is-empty'}`} onClick={() => onSlot(i)} aria-label={x ? `Slot ${i + 1}: ${x.name}` : `Slot ${i + 1}: empty`}>
              <span class="st-slot__n num">{i + 1}</span>
              {x ? <><span class="st-slot__icon"><SkillMark n={x} level={tree.levelOf(s, x.id)} /></span><b>{x.name}</b><small class="num">Lv.{tree.levelOf(s, x.id)}</small></> : <small>-- --</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the sheet

function SkillsSheet() {
  const s = useSave();
  const cls = classById(s.hunter.classId);
  const [path, setPath] = useState<Stat>(() => tree.pathOrder(s)[0]);
  // Nothing is chosen until the hunter taps a node, so the card never covers the tree uninvited.
  const [sel, setSel] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [swap, setSwap] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const pts = tree.points(s);
  const due = tree.canSpend(s);
  const spent = tree.spent(s);
  const p = pathOf(path)!;
  const shut = !tree.isOpen(s);
  const passives = useMemo(() => NODES.filter((n) => n.kind === 'passive' && tree.levelOf(s, n.id) > 0), [s]);

  const choosePath = (k: Stat) => {
    setPath(k);
    setSel(null);
    setSwap(null);
  };

  const learn = (id: string) => {
    const got = store.update((x) => tree.learn(x, id));
    if (!got) return;
    const n = got.node;
    sfx.learn(n.tier, got.from === 0);
    buzz(got.from === 0 ? [14, 30, 24] : 14);
    // Something new from the B tier up lights the whole screen, as the System does for what matters.
    if (got.from === 0 && n.tier >= 2) glow('mana');
    setFresh(id);
    const lines = got.from === 0
      ? [`${system.tag(n.name, KIND_WORD[n.kind])} acquired.`, ...(got.equipped ? [`Skill slot ${tree.equipped(store.get()).findIndex((x) => x.id === id) + 1}: ${n.name}`] : [])]
      : n.kind === 'skill' ? ['Skill level increased.', `${n.name} Lv.${got.from} → Lv.${got.to}`]
        : [`${n.name} Lv.${got.from} → Lv.${got.to}`, system.gain(statLine(n, got.to))];
    setFlash({ id, at: Date.now(), lines });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFresh(null), 1400);
  };

  const equipOrSwap = (id: string) => {
    const x = store.get();
    if (tree.isEquipped(x, id)) { store.update((y) => tree.unequip(y, id)); sfx.tap(); return; }
    if (tree.equipped(x).length < tree.slots(x)) { store.update((y) => tree.equip(y, id)); sfx.success(); return; }
    setSwap(id);
    sfx.blip();
  };

  const slot = (i: number) => {
    const x = store.get();
    const on = tree.equipped(x);
    if (swap) {
      store.update((y) => (on[i] ? tree.equip(y, swap, on[i].id) : tree.equip(y, swap)));
      sfx.success();
      setSel(swap);
      setPath(nodeById(swap)!.path);
      setSwap(null);
      return;
    }
    if (on[i]) { setPath(on[i].path); setSel(on[i].id); sfx.tap(); }
  };

  const auto = async () => {
    const yes = await sys(system.offer(['Assign every Skill Point?', `Skill Points: ${pts}`], 'system', 'Auto Assign', 'Cancel'));
    if (yes !== true) return;
    const n = store.update((x) => tree.autoLearn(x));
    if (n) { sfx.levelUp(); buzz([16, 26, 22]); setFlash(null); setSel(null); }
  };

  const reset = async () => {
    const cost = tree.resetCost(s);
    const yes = await sys(system.offer([
      'Reset the skill tree?',
      `Skill Points returned: ${spent}`,
      cost ? `Price: ${group(cost)} Mana Shards · Held: ${group(s.wallet.shards)}` : 'Price: none. The first reset is free.',
    ], 'system', 'Reset', 'Cancel'));
    if (yes !== true) return;
    if (cost > store.get().wallet.shards) {
      await sys(system.refuse([`Not enough Mana Shards. (${group(store.get().wallet.shards)}/${group(cost)})`]));
      return;
    }
    if (store.update((x) => tree.reset(x))) { sfx.sealed(); buzz(30); setSel(null); setFlash(null); setSwap(null); }
  };

  return (
    <div class={`skilltree stack ${shut ? 'is-shut' : ''}`}>
      <div class="st-head">
        <span class="st-head__class">{cls ? <><strong>[Class: {cls.name}]</strong><small>{cls.lead} +{cls.bonus}</small></> : <><strong>Unclassified</strong><small>Skills open at D-Rank.</small></>}</span>
        <span class={`st-head__pts ${due ? 'is-due' : ''}`}>
          {due && <span class="apdue__mark" aria-hidden="true">+</span>}
          <small>Skill Points</small><b class="num">{pts}</b>
        </span>
      </div>

      <div class="st-skywrap">
        <Constellation s={s} path={path} onPath={choosePath} fresh={fresh} />
      </div>

      <Loadout s={s} swap={swap} onSlot={slot} onCancel={() => setSwap(null)} />

      <div class="st-pathhead">
        <span class="st-pathhead__icon"><Glyph name={STAT_ICON[path]} /></span>
        <span class="st-pathhead__body"><b>[Path: {p.name}]</b><small>{p.desc}</small></span>
        <span class="st-pathhead__n"><small>Spent</small><b class="num">{tree.inPath(s, path)}</b></span>
      </div>

      {/* A Path of its own each time: it is measured afresh, so its links land on its nodes. A second tap on a node puts its card away. */}
      <PathTree key={path} s={s} path={path} sel={sel} onSel={(id) => { setSel((x) => (x === id ? null : id)); setSwap(null); }} fresh={fresh} />

      <div class="st-dock">
        <NodeCard s={s} id={sel} flash={flash} onLearn={learn} onEquip={equipOrSwap} />
      </div>

      {passives.length > 0 && (
        <div class="st-passives">
          <span class="label">Passives</span>
          <div class="st-passives__list">{passives.map((n) => <button type="button" key={n.id} class="sysbox st-chip" onClick={() => { setPath(n.path); setSel(n.id); }}>{n.name}</button>)}</div>
        </div>
      )}

      <div class="st-foot">
        {due && <Btn kind="gold" onClick={() => void auto()}>Auto Assign</Btn>}
        {spent > 0 && <Btn onClick={() => void reset()}>Reset{tree.resetCost(s) ? ` · ${group(tree.resetCost(s))}` : ''}</Btn>}
      </div>
    </div>
  );
}
