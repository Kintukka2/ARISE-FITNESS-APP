/** The Shadow army, as a bento grid: the squad that walks into the next Gate, then a tile to every Shadow bound. */
import { sfx } from '@/audio/audio';
import { powerOf, passiveText, ability, REACH_TEXT, TACTICS } from '@/core/combat';
import { ALL_ENEMIES, enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, KV, RankPlate, Section, Tile } from '@/ui/components';
import { BentoGrid, type Tile as BTile } from '@/ui/bento';
import type { Save } from '@/core/types';
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
    count: `${squad.length}/${slots}`, hot: shadows.freeSlots(s) > 0,
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
    key: 'army', kind: 'shadow', name: 'Army', head: true, wide: true, icon: <Glyph name="skull" />, hot: news.length > 0,
    // A Shadow waiting to be promoted is waiting on the hunter, as a rank to claim is.
    call: waiting.length > 0,
    count: army.length,
    status: waiting.length ? `Promotion ready: ${waiting.length}` : `Not yet bound: ${ALL_ENEMIES.length - army.length}`,
    art: (
      <span class="sa-army">
        {army.slice(0, 5).map((sh, i) => {
          const e = enemyById(sh.enemyId)!;
          return (
            <span key={sh.id} class={`sa-army__one ${squad.includes(sh) ? 'is-on' : ''} ${shadows.canPromote(sh) ? 'is-ready' : ''}`} style={`--i: ${i}`}>
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

/** ARMY: every Shadow bound, a tile each: its badge, ringed by its kills toward the next rank. */
function openArmy(news: string[]) {
  openSheet({ title: 'Army', system: { icon: null, kind: 'shadow' }, render: () => <ArmySheet news={news} /> });
}

function ArmySheet({ news }: { news: string[] }) {
  const s = useSave();
  return <BentoGrid class="armygrid" tiles={shadowTiles(s, news)} label="Army" />;
}

function shadowTiles(s: Save, news: string[]): BTile[] {
  const squad = shadows.squad(s);
  return ranked(s).map((sh): BTile => {
    const e = enemyById(sh.enemyId)!;
    const on = squad.includes(sh);
    const at = shadows.rankIndex(sh);
    const rank = shadows.rankOf(sh);
    const next = shadows.nextRank(sh);
    const share = next ? (sh.kills - rank.kills) / (next.kills - rank.kills) : 1;
    const ready = shadows.canPromote(sh);
    return {
      key: `shadow-${sh.id}`, kind: 'shadow', name: shadows.nameOf(sh), icon: <RankPlate rank={e.rank} size={22} />,
      class: `is-shadow ${on ? 'is-deployed' : ''} ${ready ? 'is-ready' : ''}`, hot: news.includes(sh.id), call: ready,
      count: <span class="sa-rank"><Insignia rank={at} size={14} />{rank.name}</span>,
      status: ready && next ? <>Promotion: <span class="grant">{next.name} Rank</span></> : `${on ? 'Deployed · ' : ''}Power ${powerOf(shadows.statsOf(sh))}`,
      art: <ShadowArt family={e.family} rank={at} kills={sh.kills} share={share} on={on} ready={ready} />,
      open: () => openShadow(sh.id),
    };
  });
}

/** A Shadow on its tile: its badge in smoke, and a ring that fills with the kills to its next rank, lit once they have earned it. */
function ShadowArt({ family, rank, kills, share, on, ready }: { family: string; rank: number; kills: number; share: number; on: boolean; ready: boolean }) {
  const c = 2 * Math.PI * 40;
  return (
    <span class={`sa-shade ${on ? 'is-on' : ''} ${ready ? 'is-ready' : ''}`}>
      <svg viewBox="0 0 100 100" class="sa-shade__ring">
        <circle cx="50" cy="50" r="40" class="sa-shade__track" />
        <circle cx="50" cy="50" r="40" class="sa-shade__fill" style={`stroke-dasharray: ${c * Math.max(0, Math.min(1, share))} ${c}`} />
      </svg>
      <span class="sa-shade__smoke" />
      <ShadowEmblem family={family} rank={rank} size={50} />
      <b class="num">{kills}</b>
    </span>
  );
}

/** SQUAD: who walks into the next Gate, and the army behind them. */
function openSquad() {
  const s = store.get();
  openSheet({ title: `Squad: ${shadows.squad(s).length}/${shadows.slots(s)}`, system: { icon: <Glyph name="shadows" />, kind: 'shadow' }, render: () => <SquadSheet /> });
}

function SquadSheet() {
  const s = useSave();
  const squad = shadows.squad(s);
  return (
    <div class="stack">
      <div class="sysfields">
        <Field k="Bound" v={s.shadows.army.length} />
        <Field k="Not yet bound" v={ALL_ENEMIES.length - s.shadows.army.length} />
        <Field k="Extractions" v={`${s.stats.extractionsWon}/${s.stats.extractions}`} />
        <Field k="Slots from Secret Quests" v={shadows.missionSlots(s)} />
      </div>
      <small class="muted">Squad slots: {shadows.SLOTS.E} at E and D · {shadows.SLOTS.C} at C and B · {shadows.SLOTS.A} at A and S</small>
      <Section title="Deployed">
        {squad.length
          ? <ul class="partylist">{squad.map((x) => { const e = enemyById(x.enemyId)!; return <li key={x.id} class="is-shadow"><RankPlate rank={e.rank} size={22} /><b>{shadows.nameOf(x)}</b><small>{shadows.rankOf(x).name}</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>; })}</ul>
          : <Empty>Deployed: 0</Empty>}
      </Section>
      {squad.length > 0 && <Btn block onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall Shadows · {squad.length}</Btn>}
    </div>
  );
}

/** A skill name as the System sets it: `[Skill: Pack Bite]`. */
const tagged = (name: string) => `[Skill: ${name}]`;

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

/**
 * The promotion a Shadow's kills have earned, on its card: its badge now and at the rank above, what
 * the rank brings, and the hold that claims it. The badge lifts off into the promotion (`claimPromotion`).
 */
function Promotion({ id }: { id: string }) {
  const s = useSave();
  const badge = useRef<HTMLSpanElement>(null);
  const sh = s.shadows.army.find((x) => x.id === id);
  const e = sh && enemyById(sh.enemyId);
  if (!sh || !e || !shadows.canPromote(sh)) return null;
  const R = shadows.SHADOW_RANKS;
  const at = shadows.rankIndex(sh);
  const second = at + 1 === shadows.SECOND_AT ? shadows.secondOf(e) : null;
  return (
    <div class="sysbox promote" key={at}>
      <span class="label">Promotion</span>
      <div class="rankplates promote__plates" aria-label={`${R[at].name} Rank to ${R[at + 1].name} Rank`}>
        <span class="rankplates__from" ref={badge}><ShadowEmblem family={e.family} rank={at} size={64} /></span>
        <span class="rankplates__path" style="--p: 1" aria-hidden="true"><i /></span>
        <span class="rankplates__to"><ShadowEmblem family={e.family} rank={at + 1} size={64} /></span>
      </div>
      <ul class="promote__gains">
        <li>Rank: {R[at].name} → <span class="grant">{R[at + 1].name}</span></li>
        <li>Growth limit: +{Math.round(R[at].cap * 100)}% → <span class="grant">+{Math.round(R[at + 1].cap * 100)}%</span></li>
        {second && <li>Skill: <strong>[{second}]</strong></li>}
      </ul>
      <HoldButton hold={{ label: 'Hold To Promote', ms: 2000, ticks: 5, holding: 'Promoting…', done: 'Promoted', after: 260 }}
        onFire={() => void claimPromotion(id, badge.current?.querySelector('svg') ?? badge.current)} />
    </div>
  );
}

function ShadowCard({ id, close }: { id: string; close: () => void }) {
  const s = useSave();
  const sh = s.shadows.army.find((x) => x.id === id);
  if (!sh) return <Empty>That Shadow is gone.</Empty>;
  const e = enemyById(sh.enemyId)!;
  const st = shadows.statsOf(sh);
  const squad = shadows.squad(s);
  const on = squad.includes(sh);
  const full = !on && squad.length >= shadows.slots(s);
  return (
    <div class="stack">
      <Promotion id={id} />
      <div class="row">
        <Btn kind={on ? undefined : 'primary'} class="grow" disabled={full} onClick={() => { store.update((x) => shadows.toggleDeploy(x, sh.id)); sfx.blip(); }}>
          {on ? 'Recall' : full ? 'Squad Full' : 'Deploy'}
        </Btn>
        {/* A name changes the card's header, so the card opens again under it. */}
        <Btn onClick={async () => { const v = await nameShadow(id); if (typeof v === 'string') { close(); openShadow(id); } }}>{sh.name ? 'Rename' : 'Name'}</Btn>
      </div>
      <div class="sysfields">
        <Field k="Rank" v={<span class="sa-rank"><Insignia rank={shadows.rankIndex(sh)} size={16} />{shadows.rankOf(sh).name}</span>} />
        <Field k="Grade" v={`${e.rank}-Rank`} />
        <Field k="Category" v={<span class="sa-rank"><FamilyGlyph family={e.family} size={16} />{e.family} · {e.role}</span>} />
        <Field k="Was" v={sh.name ? `${e.name} · ${e.shadow}` : e.name} />
      </div>
      <div class="tiles tiles--5">{(['STR', 'VIT', 'AGI', 'INT', 'PER'] as const).map((k) => <Tile key={k} label={k} value={st[k]} />)}</div>
      <div class="sysfields">
        <Field k="Growth" v={<><span class="grant">+{Math.round(shadows.growth(sh) * 100)}%</span> / +{Math.round(shadows.rankOf(sh).cap * 100)}%</>} />
        <Field k="Next rank" v={shadows.nextRank(sh) ? shadows.canPromote(sh) ? <span class="grant">{shadows.nextRank(sh)!.name} · Ready</span> : `${shadows.nextRank(sh)!.name} · Kills ${shadows.nextRank(sh)!.kills - sh.kills}` : '-- --'} />
      </div>
      {shadows.nextRank(sh) && !shadows.canPromote(sh) && <p class="hint">{shadows.nextRank(sh)!.name} Rank: growth limit +{Math.round(shadows.nextRank(sh)!.cap * 100)}%{shadows.rankIndex(sh) + 1 === shadows.SECOND_AT && shadows.secondOf(e) ? ` · ${tagged(shadows.secondOf(e)!)}` : ''}</p>}
      <Section title="Skills">
        <div class="stack stack--tight">
          {[e.kit[0], shadows.secondOf(e)].filter((n): n is string => !!n).map((n) => {
            const a = ability(n);
            const known = shadows.kitOf(sh).includes(n);
            const learned = !e.kit.includes(n);
            return <KV key={n} k={n} v={!known ? `remembered at ${shadows.SHADOW_RANKS[shadows.SECOND_AT].name}` : a ? `${a.type}, ${REACH_TEXT[a.profile] ?? 'one target'} · ×${a.mult}${a.inflicts.length ? ` · ${a.inflicts.join(', ')}` : ''}${learned ? ' · from its kin' : ''}` : '-- --'} />;
          })}
        </div>
      </Section>
      <Section title="Standing orders" right={sh.tactic ? 'Its own' : 'The party’s'}>
        <div class="chips chips--orders">
          <Chip on={!sh.tactic} onClick={() => store.update((x) => shadows.setTactic(x, sh.id, null))}>Party’s orders</Chip>
          {TACTICS.map((t) => <Chip key={t.key} on={sh.tactic === t.key} onClick={() => store.update((x) => shadows.setTactic(x, sh.id, t.key))}>{t.name}</Chip>)}
        </div>
        <p class="muted">{sh.tactic ? TACTICS.find((t) => t.key === sh.tactic)?.one : 'Orders: the party’s, as set in the brief.'}</p>
        <small class="muted">From the next Gate.</small>
      </Section>
      {e.passive && <Section title="Passive"><KV k={e.passive} v={passiveText(e.passive)} /></Section>}
      {(e.imm.length > 0 || e.res.length > 0) && <div class="chips">{e.imm.map((x) => <Chip key={x} tone="verdant">Immune: {x}</Chip>)}{e.res.map((x) => <Chip key={x}>Resists: {x}</Chip>)}</div>}
      <div class="tiles tiles--3"><Tile label="Deployed" value={sh.out} /><Tile label="Kills" value={sh.kills} /><Tile label="Bosses" value={sh.bosses} /></div>
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
