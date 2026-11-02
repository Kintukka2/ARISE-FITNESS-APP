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
import { openSheet, toast } from '@/ui/overlays';
import { useEffect, useState } from 'preact/hooks';

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
              {e ? <><RankPlate rank={e.rank} size={30} /><small>{e.shadow.replace(/^Shadow /, '')}</small></> : <Glyph name="plus" />}
            </span>
          );
        })}
      </span>
    ),
    open: openSquad,
  };
  const armyTile: BTile = {
    key: 'army', kind: 'shadow', name: 'Army', head: true, wide: true, icon: <Glyph name="skull" />, hot: news.length > 0,
    count: army.length,
    status: `Not yet bound: ${ALL_ENEMIES.length - army.length}`,
    art: (
      <span class="sa-army">
        {army.slice(0, 5).map((sh, i) => {
          const e = enemyById(sh.enemyId)!;
          return (
            <span key={sh.id} class={`sa-army__one ${squad.includes(sh) ? 'is-on' : ''}`} style={`--i: ${i}`}>
              <span class="sa-army__smoke" /><RankPlate rank={e.rank} size={32} />
            </span>
          );
        })}
      </span>
    ),
    open: () => openArmy(news),
  };
  return [squadTile, armyTile];
}

/** ARMY: every Shadow bound, a tile each, ringed by its kills toward the next rank. */
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
    const rank = shadows.rankOf(sh);
    const next = shadows.nextRank(sh);
    const share = next ? (sh.kills - rank.kills) / (next.kills - rank.kills) : 1;
    return {
      key: `shadow-${sh.id}`, kind: 'shadow', name: e.shadow, icon: <RankPlate rank={e.rank} size={22} />,
      class: `is-shadow ${on ? 'is-deployed' : ''}`, hot: news.includes(sh.id),
      count: rank.name,
      status: `${on ? 'Deployed · ' : ''}Power ${powerOf(shadows.statsOf(sh))}`,
      art: <ShadowArt kills={sh.kills} share={share} on={on} />,
      open: () => openShadow(sh.id),
    };
  });
}

/** A Shadow on its tile: its shape in smoke, and a ring that fills with the kills to its next rank. */
function ShadowArt({ kills, share, on }: { kills: number; share: number; on: boolean }) {
  const c = 2 * Math.PI * 40;
  return (
    <span class={`sa-shade ${on ? 'is-on' : ''}`}>
      <svg viewBox="0 0 100 100" class="sa-shade__ring">
        <circle cx="50" cy="50" r="40" class="sa-shade__track" />
        <circle cx="50" cy="50" r="40" class="sa-shade__fill" style={`stroke-dasharray: ${c * Math.max(0, Math.min(1, share))} ${c}`} />
      </svg>
      <span class="sa-shade__smoke" />
      <Glyph name="shadows" />
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
          ? <ul class="partylist">{squad.map((x) => { const e = enemyById(x.enemyId)!; return <li key={x.id} class="is-shadow"><RankPlate rank={e.rank} size={22} /><b>{e.shadow}</b><small>{shadows.rankOf(x).name}</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>; })}</ul>
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
    title: `Shadow: ${was?.shadow ?? 'Unknown'}`,
    system: { icon: was ? <RankPlate rank={was.rank} size={44} /> : null, kind: 'shadow' },
    render: () => {
      const s = store.get();
      const sh = s.shadows.army.find((x) => x.id === id);
      if (!sh) return <Empty>That Shadow is gone.</Empty>;
      const e = enemyById(sh.enemyId)!;
      const st = shadows.statsOf(sh);
      const squad = shadows.squad(s);
      const on = squad.includes(sh);
      const full = !on && squad.length >= shadows.slots(s);
      return (
        <div class="stack">
          <Btn kind={on ? undefined : 'primary'} block disabled={full} onClick={() => { store.update((x) => shadows.toggleDeploy(x, sh.id)); sfx.blip(); }}>
            {on ? 'Recall' : full ? 'Squad Full' : 'Deploy'}
          </Btn>
          <div class="sysfields">
            <Field k="Rank" v={shadows.rankOf(sh).name} />
            <Field k="Grade" v={`${e.rank}-Rank`} />
            <Field k="Category" v={`${e.family} · ${e.role}`} />
            <Field k="Was" v={e.name} />
          </div>
          <div class="tiles tiles--5">{(['STR', 'VIT', 'AGI', 'INT', 'PER'] as const).map((k) => <Tile key={k} label={k} value={st[k]} />)}</div>
          <div class="sysfields">
            <Field k="Growth" v={<><span class="grant">+{Math.round(shadows.growth(sh) * 100)}%</span> / +{Math.round(shadows.rankOf(sh).cap * 100)}%</>} />
            <Field k="Next rank" v={shadows.nextRank(sh) ? `${shadows.nextRank(sh)!.name} · Kills ${shadows.nextRank(sh)!.kills - sh.kills}` : '-- --'} />
          </div>
          {shadows.nextRank(sh) && <p class="hint">{shadows.nextRank(sh)!.name} Rank: growth limit +{Math.round(shadows.nextRank(sh)!.cap * 100)}%{shadows.rankIndex(sh) + 1 === shadows.SECOND_AT && shadows.secondOf(e) ? ` · ${tagged(shadows.secondOf(e)!)}` : ''}</p>}
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
          <Section title="Standing orders" right={sh.tactic ? 'its own' : 'the party’s'}>
            <div class="chips">
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
    },
  });
}
