/** The Shadow army: everything that followed you home, and who walks into the next gate with you. */
import { sfx } from '@/audio/audio';
import { powerOf, passiveText, ability, REACH_TEXT } from '@/core/combat';
import { ALL_ENEMIES, enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as story from '@/core/story';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Chip, Empty, KV, Panel, RankPlate, Section, Tile, Voice } from '@/ui/components';
import { Glyph } from '@/ui/icons';
import { openSheet, toast } from '@/ui/overlays';
import { useEffect } from 'preact/hooks';

export function Shadows() {
  const s = useSave();
  const slots = shadows.slots(s);
  const squad = shadows.squad(s);
  useEffect(() => { if (!story.seen(s, 'shadows-visited')) store.update((x) => story.markOnce(x, 'shadows-visited')); }, []);
  const army = s.shadows.army.slice().sort((a, b) => Number(squad.includes(b)) - Number(squad.includes(a)) || powerOf(shadows.statsOf(b)) - powerOf(shadows.statsOf(a)));
  const fresh = s.shadows.fresh;
  return (
    <div class="stack">
      <Voice who="system">{fresh.length ? (fresh.length === 1 ? `A new Shadow has entered your command. ${enemyById(s.shadows.army.find((x) => x.id === fresh[0])?.enemyId ?? '')?.shadow ?? ''} is marked below.` : `${fresh.length} new Shadows have entered your command. They are marked below.`) : 'Every Shadow you deploy walks into the next Gate beside you. They never make a fight harder — only easier.'}</Voice>
      <Panel title="Shadows" tone="arcane">
        <div class="tiles tiles--3">
          <Tile label="Extractions" value={s.stats.extractions} sub={`${s.stats.extractionsWon} held`} />
          <Tile label="Bound" value={s.shadows.army.length} />
          <Tile label="Deployed" value={`${squad.length}/${slots}`} />
        </div>
        <small class="muted">Squad size grows with your grade: one at E and D, two at C and B, three at A and S. A Shadow grows a little with every kill it lands.</small>
        {squad.length > 0 && <Btn kind="ghost" block onClick={() => { store.update((x) => { x.shadows.squad = []; }); toast('Squad stood down.', 'warn'); }}><Glyph name="recall" /> Recall Shadows ({squad.length})</Btn>}
      </Panel>
      <Section title="Bound Shadows" right={`${s.shadows.army.length} commanded`}>
        {!army.length && <Empty>No Shadows have followed you home yet. Keep clearing gates — an extraction is rare, and rarer still if you are out of mana when it offers.</Empty>}
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
                    <small class="muted">{e.family} · {e.role} · {powerOf(shadows.statsOf(sh))} power{sh.kills ? ` · ${sh.kills} kills` : ''}</small>
                  </span>
                </button>
                <Btn size="sm" kind={on ? 'primary' : 'ghost'} disabled={full} onClick={() => store.update((x) => shadows.toggleDeploy(x, sh.id))}>{on ? 'Deployed' : full ? 'Squad Full' : 'Deploy'}</Btn>
              </li>
            );
          })}
        </ul>
      </Section>
      <p class="muted center">{ALL_ENEMIES.length - s.shadows.army.length} Shadows are yet to be taken from their host.</p>
    </div>
  );
}

function openShadow(id: string) {
  openSheet({
    title: 'Shadow', tone: 'arcane', render: () => {
      const s = store.get();
      const sh = s.shadows.army.find((x) => x.id === id);
      if (!sh) return <Empty>Gone.</Empty>;
      const e = enemyById(sh.enemyId)!;
      const st = shadows.statsOf(sh);
      return (
        <div class="stack">
          <div class="row"><RankPlate rank={e.rank} size={44} /><div><b class="big">{e.shadow}</b><small class="muted">{e.rank}-Rank {e.family} · {e.role}. Was a {e.name}.</small></div></div>
          <div class="tiles tiles--5">{(['STR', 'VIT', 'AGI', 'INT', 'PER'] as const).map((k) => <Tile key={k} label={k} value={st[k]} />)}</div>
          <KV k="Growth" v={`+${Math.round(shadows.growth(sh) * 100)}% from kills`} />
          <Section title="Skills">
            <div class="stack stack--tight">
              {e.kit.map((n) => { const a = ability(n); return <KV key={n} k={n} v={a ? `${a.type}, ${REACH_TEXT[a.profile] ?? 'one target'} · ×${a.mult}${a.inflicts.length ? ` · ${a.inflicts.join(', ')}` : ''}` : '—'} />; })}
            </div>
          </Section>
          {e.passive && <Section title="Passive"><KV k={e.passive} v={passiveText(e.passive)} /></Section>}
          {(e.imm.length > 0 || e.res.length > 0) && <div class="chips">{e.imm.map((x) => <Chip key={x} tone="verdant">Immune: {x}</Chip>)}{e.res.map((x) => <Chip key={x}>Resists: {x}</Chip>)}</div>}
          <div class="tiles"><Tile label="Deployed" value={sh.out} /><Tile label="Kills" value={sh.kills} /><Tile label="Bosses" value={sh.bosses} /></div>
        </div>
      );
    },
  });
}
