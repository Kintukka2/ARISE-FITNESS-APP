/** The Shadow army, as a bento grid: the squad that walks into the next Gate, then a tile to every Shadow bound. */
import { sfx } from '@/audio/audio';
import { powerOf, passiveText, ability } from '@/core/combat';
import { ALL_ENEMIES, enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, RankPlate, Section } from '@/ui/components';
import { BentoGrid, type Tile as BTile } from '@/ui/bento';
import type { Enemy, Save, Shadow } from '@/core/types';
import type { RaidResult } from '@/core/raid';
import { dayKey, daysBetween } from '@/core/util';
import * as system from '@/ui/system';
import { skillLine } from './Skills';
import { Field, SysFrame } from '@/ui/frame';
import { Glyph } from '@/ui/icons';
import { FamilyGlyph, Insignia, ShadowEmblem } from '@/ui/emblems';
import { HoldButton, openSheet, sys, toast } from '@/ui/overlays';
import { claimPromotion } from '@/app/flow';
import { useEffect, useRef, useState } from 'preact/hooks';

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
  return s.shadows.army.slice().sort((a, b) => Number(squad.includes(b)) - Number(squad.includes(a)) || powerOf(shadows.statsOf(b)) - powerOf(shadows.statsOf(a)));
};

/** The Shadows screen: the squad that walks in next, and the army behind it, a tile each. */
function tiles(s: Save, news: string[]): BTile[] {
  const slots = shadows.slots(s);
  const squad = shadows.squad(s);
  const army = ranked(s);
  const squadTile: BTile = {
    key: 'squad', kind: 'shadow', name: 'Squad', head: true, wide: true, icon: <Glyph name="shadows" />,
    count: `${squad.length}/${slots}`, call: shadows.freeSlots(s) > 0,
    status: `Bound: ${s.shadows.army.length} · Extractions: ${s.stats.extractions}`,
    art: (
      <span class="sa-squad">
        {Array.from({ length: slots }, (_, i) => {
          const sh = squad[i];
          const e = sh && enemyById(sh.enemyId);
          return (
            <span key={i} class={`sysbox sa-squad__slot ${e ? 'is-on' : ''}`}>
              {e ? <><RankPlate rank={e.rank} size={30} /><small>{sh.name || e.shadow.replace(/^Shadow /, '')}</small></> : <Glyph name="plus" />}
            </span>
          );
        })}
      </span>
    ),
    open: openSquad,
  };
  const waiting = shadows.promotable(s);
  const armyTile: BTile = {
    key: 'army', kind: 'shadow', name: 'Army', head: true, wide: true, icon: <Glyph name="skull" />,
    // A Shadow waiting to be promoted is waiting on the hunter, as a rank to claim is; one just bound is new.
    call: waiting.length > 0 || news.length > 0,
    count: waiting.length ? `${waiting.length} ready` : news.length ? `${news.length} new` : army.length,
    status: waiting.length ? `Promotion ready: ${waiting.length}` : <>Shadow Essence: <b class="num">{s.shadows.essence ?? 0}</b></>,
    art: (
      <span class="sa-army">
        {army.slice(0, 5).map((sh, i) => {
          const e = enemyById(sh.enemyId)!;
          return (
            <span key={sh.id} class={`sa-army__one ${squad.includes(sh) ? 'is-on' : ''} ${shadows.canPromote(s, sh) ? 'is-ready' : ''}`} style={`--i: ${i}`}>
              <span class="sa-army__smoke" /><ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={40} />
            </span>
          );
        })}
      </span>
    ),
    open: () => openArmy(news),
  };
  return [squadTile, armyTile];
}

/** ARMY: every Shadow bound, a tile each: its badge, ringed by its levels through the rank it holds; and the Essence held. */
function openArmy(news: string[]) {
  openSheet({ title: 'Army', system: { icon: null, kind: 'shadow' }, render: () => <ArmySheet news={news} /> });
}

function ArmySheet({ news }: { news: string[] }) {
  const s = useSave();
  return (
    <div class="stack">
      <div class="sysfields">
        <Field k="Shadow Essence" v={<span class="sp-essence"><EssenceMark /><span class="num">{s.shadows.essence ?? 0}</span></span>} />
        <Field k="Promotion ready" v={shadows.promotable(s).length} />
      </div>
      <BentoGrid class="armygrid" tiles={shadowTiles(s, news)} label="Army" />
    </div>
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

function shadowTiles(s: Save, news: string[]): BTile[] {
  const squad = shadows.squad(s);
  return ranked(s).map((sh): BTile => {
    const e = enemyById(sh.enemyId)!;
    const on = squad.includes(sh);
    const at = shadows.rankIndex(sh);
    const rank = shadows.rankOf(sh);
    const next = shadows.nextRank(sh);
    const lv = shadows.levelOf(sh);
    const floor = at ? shadows.SHADOW_RANKS[at - 1].cap : 0;
    const share = (lv - floor) / Math.max(1, rank.cap - floor);
    const ready = shadows.canPromote(s, sh);
    return {
      key: `shadow-${sh.id}`, kind: 'shadow', name: shadows.nameOf(sh), icon: <RankPlate rank={e.rank} size={22} />,
      class: `is-shadow ${on ? 'is-deployed' : ''} ${ready ? 'is-ready' : ''}`, call: ready || news.includes(sh.id),
      count: <span class="sa-rank"><Insignia rank={at} size={14} />{ready ? 'Ready' : news.includes(sh.id) ? 'New' : rank.name}</span>,
      status: ready && next ? <>Promotion: <span class="grant">{next.name} Rank</span></> : `${on ? 'Deployed · ' : ''}Power ${powerOf(shadows.statsOf(sh))}`,
      art: <ShadowArt family={e.family} rank={at} level={lv} share={share} on={on} ready={ready} />,
      open: () => openShadow(sh.id),
    };
  });
}

/** A Shadow on its tile: its badge in smoke, its level, and a ring that fills with its levels through its rank, lit gold once it can be promoted. */
function ShadowArt({ family, rank, level, share, on, ready }: { family: string; rank: number; level: number; share: number; on: boolean; ready: boolean }) {
  const c = 2 * Math.PI * 40;
  return (
    <span class={`sa-shade ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''}`}>
      <svg viewBox="0 0 100 100" class="sa-shade__ring">
        <circle cx="50" cy="50" r="40" class="sa-shade__track" />
        <circle cx="50" cy="50" r="40" class="sa-shade__fill" style={`stroke-dasharray: ${c * Math.max(0, Math.min(1, share))} ${c}`} />
      </svg>
      <span class="sa-shade__smoke" />
      <ShadowEmblem family={family} rank={rank} size={50} />
      <b class="num">Lv.{level}</b>
    </span>
  );
}

/** SQUAD: who walks into the next Gate, and the army behind them, each put in or taken out from here. */
function openSquad() {
  openSheet({ title: () => { const s = store.get(); return `Squad: ${shadows.squad(s).length}/${shadows.slots(s)}`; }, system: { icon: <Glyph name="shadows" />, kind: 'shadow' }, render: () => <SquadSheet /> });
}

/** One Shadow in the squad sheet: its rank, name, rank of its own and power, a tap from its card, and the button that moves it. */
function SquadRow({ sh, act, label, glyph, off }: { sh: Shadow; act: () => void; label: string; glyph: 'plus' | 'minus'; off?: boolean }) {
  const e = enemyById(sh.enemyId)!;
  return (
    <li class="is-shadow squadrow">
      <button type="button" class="squadrow__who" onClick={() => { sfx.tap(); openShadow(sh.id); }}>
        <RankPlate rank={e.rank} size={22} /><b>{shadows.nameOf(sh)}</b><small class="num">Lv.{shadows.levelOf(sh)}</small><span class="num">{powerOf(shadows.statsOf(sh))}</span>
      </button>
      <button type="button" class={`sysbox squadrow__act is-${glyph}`} aria-label={`${label}: ${shadows.nameOf(sh)}`} title={label} disabled={off} onClick={act}><Glyph name={glyph} /></button>
    </li>
  );
}

function SquadSheet() {
  const s = useSave();
  const squad = shadows.squad(s);
  const n = shadows.slots(s);
  const full = squad.length >= n;
  const bench = ranked(s).filter((x) => !squad.includes(x));
  const move = (id: string) => { store.update((x) => shadows.toggleDeploy(x, id)); sfx.blip(); };
  return (
    <div class="stack">
      <div class="sysfields">
        <Field k="Bound" v={s.shadows.army.length} />
        <Field k="Not yet bound" v={ALL_ENEMIES.length - s.shadows.army.length} />
        <Field k="Extractions" v={`${s.stats.extractionsWon}/${s.stats.extractions}`} />
        <Field k="Slots from Secret Quests" v={shadows.missionSlots(s)} />
      </div>
      <Section title="Deployed" right={<span class="num">{squad.length}/{n}</span>}>
        <ul class="partylist squadlist">
          {Array.from({ length: n }, (_, i) => squad[i]
            ? <SquadRow key={squad[i].id} sh={squad[i]} label="Take out" glyph="minus" act={() => move(squad[i].id)} />
            : <li key={`slot-${i}`} class="squadrow is-empty"><span>-- --</span></li>)}
        </ul>
      </Section>
      {bench.length > 0 && (
        <Section title="Army" right={full ? 'Slots full' : `Slots free: ${n - squad.length}`}>
          <ul class="partylist squadlist">
            {bench.map((x) => <SquadRow key={x.id} sh={x} label="Put in" glyph="plus" off={full} act={() => move(x.id)} />)}
          </ul>
        </Section>
      )}
      {squad.length > 0 && <Btn block onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall Shadows · {squad.length}</Btn>}
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
      <Growth sh={sh} />
      <NextRank sh={sh} e={e} />
      <Stats sh={sh} e={e} />
      <Kit sh={sh} e={e} />
      <Record sh={sh} />
      <Release sh={sh} close={close} />
    </div>
  );
}

/** The head of the card: its badge inside the ring of its next level, its rank, what it was, its power, and the experience to come. */
function Profile({ sh, e, close }: { sh: Shadow; e: Enemy; close: () => void }) {
  const s = useSave();
  const squad = shadows.squad(s);
  const on = squad.includes(sh);
  const full = !on && squad.length >= shadows.slots(s);
  const at = shadows.rankIndex(sh);
  const lv = shadows.levelOf(sh);
  const p = shadows.progress(sh);
  const top = lv >= shadows.MAX_LEVEL;
  const ready = shadows.canPromote(s, sh);
  const share = p.need ? p.into / p.need : 1;
  const c = 2 * Math.PI * 52;
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
          <b class="sp-head__lv"><small>Lv.</small>{top ? 'MAX' : lv}</b>
        </div>
        <div class="sp-head__who">
          <span class="sa-rank sp-head__rank"><Insignia rank={at} size={15} />{shadows.rankOf(sh).name} Rank</span>
          <span class="sp-head__was"><span class="label">Was</span> {sh.name ? `${e.name} · ${e.shadow}` : e.name}</span>
          <span class="sp-head__tags">
            <RankPlate rank={e.rank} size={20} />
            <span class="sp-tag"><FamilyGlyph family={e.family} size={13} />{e.family}</span>
            <span class="sp-tag">{e.role}</span>
            <span class={`sp-tag sp-head__state ${on ? 'is-on' : ''}`}>{on ? 'Deployed' : 'Not deployed'}</span>
          </span>
          <span class="sp-head__power"><span class="label">Power</span><b class="num">{powerOf(shadows.statsOf(sh))}</b></span>
        </div>
        <div class="sp-head__exp">
          <span class="label">EXP</span>
          <span class="sp-exp"><i style={`width: ${pct(unit(share))}%`} /></span>
          <span class="num">{top ? 'Lv.MAX' : p.need ? `${p.into}/${p.need}` : `Level cap${p.banked ? ` · Banked ${p.banked}` : ''}`}</span>
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
 * Its growth, as a graph: a bar for every level, rising with what each adds, in a run for each rank.
 * Lit to the level held; ghosted past it as far as its banked experience reaches; dark past its cap,
 * where a seal stands across the road until it is promoted.
 */
function Growth({ sh }: { sh: Shadow }) {
  const R = shadows.SHADOW_RANKS;
  const MAX = shadows.MAX_LEVEL;
  const at = shadows.rankIndex(sh);
  const lv = shadows.levelOf(sh);
  const reach = shadows.levelFor(sh.xp ?? 0);
  const cap = R[at].cap;
  const W = 300, H = 60, GAP = 9;
  const run = (W - GAP * (R.length - 1)) / R.length;
  const bars = R.flatMap((r, ri) => {
    const lo = ri ? R[ri - 1].cap + 1 : 1;
    const w = run / (r.cap - lo + 1);
    return Array.from({ length: r.cap - lo + 1 }, (_, j) => {
      const l = lo + j;
      const h = 6 + (H - 8) * (l / MAX);
      const state = l <= lv ? 'is-lit' : l <= reach ? 'is-banked' : l <= cap ? 'is-open' : 'is-shut';
      return <rect key={l} x={ri * (run + GAP) + j * w + 0.7} y={H - h} width={Math.max(1, w - 1.4)} height={h} class={`sp-bar ${state} ${l === lv ? 'is-here' : ''}`} style={`--i: ${l}`} />;
    });
  });
  const seal = cap < MAX ? (at + 1) * run + at * GAP + GAP / 2 : null;
  return (
    <Section title="Growth" right={<span class="num"><span class="grant">+{pct(shadows.growth(sh))}%</span> / +{pct(MAX * shadows.GROWTH_PER_LEVEL)}%</span>}>
      <div class="sp-growth">
        <svg viewBox={`0 0 ${W} ${H + 4}`} class="sp-graph" role="img" aria-label={`Level ${lv} of ${MAX}. Level cap ${cap}.`}>
          {bars}
          {seal !== null && <g class="sp-seal"><line x1={seal} y1="0" x2={seal} y2={H + 4} /><rect x={seal - 3} y={H / 2 - 3} width="6" height="6" transform={`rotate(45 ${seal} ${H / 2})`} /></g>}
        </svg>
        <ol class="sp-ranks">
          {R.map((r, i) => (
            <li key={r.name} class={`${i < at ? 'is-held' : ''} ${i === at ? 'is-here' : ''}`}>
              <Insignia rank={i} size={14} /><b>{r.name}</b><small class="num">Lv.{i ? R[i - 1].cap + 1 : 1}-{r.cap}</small>
            </li>
          ))}
        </ol>
      </div>
    </Section>
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

/**
 * Its stats: a radar of its creature's own (dim), where its level has them now (lit) and where Lv.MAX
 * would (outlined), every shape on one scale; and each stat with what its level adds.
 */
function Stats({ sh, e }: { sh: Shadow; e: Enemy }) {
  const now = shadows.statsOf(sh);
  const peak = 1 + shadows.MAX_LEVEL * shadows.GROWTH_PER_LEVEL;
  const top = Math.max(1, ...ORDER.map((k) => e.base[k] * peak));
  const at = (i: number, r: number) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  };
  const shape = (v: (k: (typeof ORDER)[number]) => number) => ORDER.map((k, i) => at(i, 3 + 35 * unit(v(k) / top)).join(',')).join(' ');
  const ring = (r: number) => ORDER.map((_, i) => at(i, r).join(',')).join(' ');
  return (
    <Section title="Stats" right={<span class="sp-legend"><i class="is-now" />Now<i class="is-max" />Lv.MAX</span>}>
      <div class="sp-stats">
        <svg viewBox="0 0 100 100" class="sp-radar" role="img" aria-label={ORDER.map((k) => `${k} ${now[k]}`).join(', ')}>
          {[13, 25.5, 38].map((r) => <polygon key={r} points={ring(r)} class="sp-radar__ring" />)}
          {ORDER.map((_, i) => { const [x, y] = at(i, 38); return <line key={i} x1="50" y1="50" x2={x} y2={y} class="sp-radar__axis" />; })}
          <polygon points={shape((k) => e.base[k] * peak)} class="sp-radar__max" />
          <polygon points={shape((k) => e.base[k])} class="sp-radar__base" />
          <polygon points={shape((k) => now[k])} class="sp-radar__now" />
          {ORDER.map((k, i) => { const [x, y] = at(i, 47); return <text key={k} x={x} y={y} class="sp-radar__label">{k}</text>; })}
        </svg>
        <ul class="sp-statlist">
          {ORDER.map((k) => (
            <li key={k}>
              <span class="label">{k}</span>
              <b class="num">{now[k]}</b>
              <small class="num grant">{now[k] > e.base[k] ? `+${now[k] - e.base[k]}` : ''}</small>
            </li>
          ))}
        </ul>
      </div>
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
        <span><b class="num">{sh.kills}</b><small>Felled</small></span>
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

/** What a run gave each deployed Shadow, on the results: its level, the experience it took, and how far it stands to the next. */
export function SquadGains({ grew }: { grew: RaidResult['grew'] }) {
  const s = useSave();
  const rows = grew.map((g) => ({ g, sh: s.shadows.army.find((x) => x.id === g.id) })).filter((x): x is { g: RaidResult['grew'][number]; sh: Shadow } => !!x.sh);
  if (!rows.length) return null;
  return (
    <SysFrame title="Army" kind="shadow" class="sp-gains">
      <ul class="sp-gains__list">
        {rows.map(({ g, sh }, i) => {
          const e = enemyById(sh.enemyId)!;
          const p = shadows.progress(sh);
          const up = g.to > g.from;
          return (
            <li key={g.id} class={up ? 'is-up' : ''} style={`--i: ${i}`}>
              <ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={32} />
              <span class="sp-gains__who">
                <b>[{shadows.nameOf(sh)}]</b>
                <small class="num">{up ? <>Lv.{g.from} → <span class="grant">Lv.{g.to}</span></> : `Lv.${g.to}`}{p.need ? '' : ' · Level cap'}</small>
              </span>
              <span class="sp-gains__xp num">EXP <span class="grant">+{g.xp}</span></span>
              <span class="sp-exp"><i style={`width: ${pct(p.need ? unit(p.into / p.need) : 1)}%`} /></span>
            </li>
          );
        })}
      </ul>
    </SysFrame>
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
