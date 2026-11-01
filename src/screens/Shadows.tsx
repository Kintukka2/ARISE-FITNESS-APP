/** The Shadow army: everything that followed you home, and who walks into the next gate with you. */
import { sfx } from '@/audio/audio';
import { powerOf, passiveText, ability, REACH_TEXT, TACTICS } from '@/core/combat';
import { ALL_ENEMIES, enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, KV, Panel, RankPlate, Section, Tile } from '@/ui/components';
import { Field, SysFrame } from '@/ui/frame';
import { Glyph } from '@/ui/icons';
import { openSheet, toast } from '@/ui/overlays';
import { useEffect, useState } from 'preact/hooks';

export function Shadows() {
  const s = useSave();
  const slots = shadows.slots(s);
  const squad = shadows.squad(s);
  useEffect(() => { if (!story.seen(s, 'shadows-visited')) store.update((x) => story.markOnce(x, 'shadows-visited')); }, []);
  const army = s.shadows.army.slice().sort((a, b) => Number(squad.includes(b)) - Number(squad.includes(a)) || powerOf(shadows.statsOf(b)) - powerOf(shadows.statsOf(a)));
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
      <Panel title="Shadows" tone="arcane">
        <div class="tiles tiles--3">
          <Tile label="Extractions" value={s.stats.extractions} />
          <Tile label="Bound" value={s.shadows.army.length} />
          <Tile label="Deployed" value={`${squad.length}/${slots}`} />
        </div>
        <small class="muted">Squad size grows with your grade: {shadows.SLOTS.E} at E and D, {shadows.SLOTS.C} at C and B, {shadows.SLOTS.A} at A and S{shadows.missionSlots(s) ? `, and ${shadows.missionSlots(s)} more from Secret Quests` : ''}.</small>
        {squad.length > 0 && <Btn kind="ghost" block onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall Shadows ({squad.length})</Btn>}
      </Panel>
      <Section title="Bound Shadows">
        {!army.length && <Empty>No Shadows yet.</Empty>}
        <ul class="army">
          {army.map((sh) => {
            const e = enemyById(sh.enemyId)!;
            const on = squad.includes(sh);
            const full = !on && squad.length >= slots;
            return (
              <li key={sh.id} class={`shadowrow ${on ? 'is-on' : ''}`}>
                <button type="button" class="shadowrow__main" onClick={() => { sfx.tap(); openShadow(sh.id); }}>
                  <RankPlate rank={e.rank} size={30} />
                  <span class="grow">
                    <b>{e.shadow} {fresh.includes(sh.id) && <span class="chip" data-tone="arcane">New</span>}</b>
                    <small class="muted">{shadows.rankOf(sh).name} · {e.family} · Power {powerOf(shadows.statsOf(sh))}{sh.kills ? ` · Kills ${sh.kills}` : ''}{sh.tactic ? ` · ${TACTICS.find((x) => x.key === sh.tactic)?.name}` : ''}</small>
                  </span>
                </button>
                <Btn size="sm" kind={on ? 'primary' : 'ghost'} disabled={full} onClick={() => store.update((x) => shadows.toggleDeploy(x, sh.id))}>{on ? 'Deployed' : full ? 'Squad Full' : 'Deploy'}</Btn>
              </li>
            );
          })}
        </ul>
      </Section>
      <p class="muted center">Shadows not yet bound: {ALL_ENEMIES.length - s.shadows.army.length}</p>
    </div>
  );
}

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
      return (
        <div class="stack">
          <div class="sysfields">
            <Field k="Rank" v={shadows.rankOf(sh).name} />
            <Field k="Grade" v={`${e.rank}-Rank`} />
            <Field k="Category" v={`${e.family} · ${e.role}`} />
            <Field k="Was" v={e.name} />
          </div>
          <div class="tiles tiles--5">{(['STR', 'VIT', 'AGI', 'INT', 'PER'] as const).map((k) => <Tile key={k} label={k} value={st[k]} />)}</div>
          <KV k="Growth" v={`+${Math.round(shadows.growth(sh) * 100)}% from kills, of +${Math.round(shadows.rankOf(sh).cap * 100)}% at this rank`} />
          {shadows.nextRank(sh) && <p class="hint">{shadows.nextRank(sh)!.kills - sh.kills} more kills to {shadows.nextRank(sh)!.name}, which lifts its growth to +{Math.round(shadows.nextRank(sh)!.cap * 100)}%{shadows.rankIndex(sh) + 1 === shadows.SECOND_AT && shadows.secondOf(e) ? `, and it remembers ${shadows.secondOf(e)}` : ''}.</p>}
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
            <p class="muted">{sh.tactic ? TACTICS.find((t) => t.key === sh.tactic)?.one : 'It follows the standing orders you set in each brief.'} Orders change from the next Gate.</p>
          </Section>
          {e.passive && <Section title="Passive"><KV k={e.passive} v={passiveText(e.passive)} /></Section>}
          {(e.imm.length > 0 || e.res.length > 0) && <div class="chips">{e.imm.map((x) => <Chip key={x} tone="verdant">Immune: {x}</Chip>)}{e.res.map((x) => <Chip key={x}>Resists: {x}</Chip>)}</div>}
          <div class="tiles tiles--3"><Tile label="Deployed" value={sh.out} /><Tile label="Kills" value={sh.kills} /><Tile label="Bosses" value={sh.bosses} /></div>
        </div>
      );
    },
  });
}
