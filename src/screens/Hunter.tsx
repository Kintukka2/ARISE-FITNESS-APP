/**
 * HUNTER: an Association hunter's card, opened by tapping them in a Gate's brief's party, after the Shadow card
 * (`screens/Shadows.tsx`) and the info panel of Solo Leveling: Arise, in the System's cyan: what the System sees of a
 * hunter beside you. Its head is their grade's plate in a ring, their registration, `Rank`, `Class` and `Power`,
 * and their class and how they fight as info tags, with where they stand against the Gate's grade; then their stats,
 * the lead marked; the role bonuses they take from your Shadows; their skills and traits, as their class gives them;
 * and their record beside you, which follows them from Gate to Gate (`hunters.recordOf`). Every number is the
 * engine's: their class from `hunters.classOf`, their kit from `hunters.kitOf`, as the fight builds them.
 */
import { ability, passiveText } from '@/core/combat';
import { rankIdx, regNo, isPractice, type Ally } from '@/core/gates';
import * as hunters from '@/core/hunters';
import * as kin from '@/core/kin';
import { ATTRS } from '@/core/progression';
import * as shadows from '@/core/shadows';
import type { Dungeon, Stat } from '@/core/types';
import { daysBetween, dayKey } from '@/core/util';
import { useSave } from '@/store';
import { skillLine } from './Skills';
import { RankPlate, Section } from '@/ui/components';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { InfoTag } from '@/ui/infotag';
import { ROLE_GLYPH, ROLE_TIER, roleText } from '@/ui/kin';
import { openSheet } from '@/ui/overlays';
import { hunterStyleTip, STYLE_GLYPH, styleOfLead } from '@/ui/stand';
import type { TipText } from '@/ui/tip';

const ORDER: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];

/** Open a hunter's card. Their record is read from the save as it stands; the rest is who they are. */
export function openHunter(a: Ally, d: Dungeon) {
  openSheet({
    title: `Hunter: ${a.name}`,
    system: { icon: <RankPlate rank={a.rank} size={26} /> },
    render: () => <HunterCard a={a} d={d} />,
  });
}

/** A class in the game's one tooltip: its name and `Class`, what it is given for, and the stat it leads with. */
export function classTip(a: Ally): TipText {
  const c = hunters.classOf(a);
  if (!c) return { title: 'Unclassified', kind: 'Class', tone: 'system', lines: ['No class is given below D-Rank.', 'Fights with Strike alone.'] };
  const stat = ATTRS.find((x) => x.key === c.lead)?.name ?? c.lead;
  return {
    title: c.name,
    kind: 'Class',
    mark: <span class="tip__mark"><Glyph name={STAT_ICON[c.lead] ?? 'star'} /></span>,
    tone: 'system',
    lines: [c.desc, `Leads with ${stat}, the ${c.rank}-Rank rung of its line.`],
  };
}

function HunterCard({ a, d }: { a: Ally; d: Dungeon }) {
  return (
    <div class="stack shadowcard huntercard">
      <Head a={a} d={d} />
      <Stats a={a} />
      <Taken d={d} />
      <Kit a={a} />
      <Record a={a} />
    </div>
  );
}

/**
 * The head, as the Shadow card's: their grade's plate inside a ring, their registration small over the rows
 * `Rank │ D-Rank`, `Class │ Brawler` and `Power │ 26`; under them their class and how they fight, each a tag that
 * tells what it is, and where their grade stands against the Gate's.
 */
function Head({ a, d }: { a: Ally; d: Dungeon }) {
  const c = hunters.classOf(a);
  const st = hunters.standOf(a);
  const style = styleOfLead(st);
  const vs = rankIdx(a.rank) - rankIdx(d.rank);
  return (
    <section class="sysbox sp-head huntercard__head">
      <div class="sp-head__badge">
        <svg viewBox="0 0 120 120" class="sp-ring" aria-hidden="true">
          <circle cx="60" cy="60" r="58" class="sp-ring__runes" />
          <circle cx="60" cy="60" r="52" class="sp-ring__track" />
        </svg>
        <RankPlate rank={a.rank} size={60} />
      </div>
      <div class="sp-head__who">
        <span class="sp-head__was">{a.note ? `${a.note} · ` : ''}Registration {regNo(a.id)}</span>
        <dl class="sp-rows">
          <div class="sp-row"><dt>Rank</dt><dd>{a.rank}-Rank</dd></div>
          <div class="sp-row"><dt>Class</dt><dd class={c ? 'huntercard__class' : ''}>{c?.name ?? 'Unclassified'}</dd></div>
          <div class="sp-row"><dt>Power</dt><dd class="sp-row__power num">{hunters.powerOfAlly(a)}</dd></div>
        </dl>
        <span class="sp-head__tags">
          <InfoTag class="sp-tag" tip={classTip(a)}>{c ? <Glyph name={STAT_ICON[c.lead] ?? 'star'} /> : null}{c?.name ?? 'Unclassified'}</InfoTag>
          <InfoTag class="sp-tag sp-tag--style" tip={hunterStyleTip(c?.lead)}><Glyph name={STYLE_GLYPH[style]} />{style}</InfoTag>
          <span class={`sp-tag sp-head__state ${vs > 0 ? 'is-on' : ''}`}>{vs > 0 ? 'Above the Gate' : vs < 0 ? 'Under the Gate' : 'At the Gate’s grade'}</span>
        </span>
      </div>
    </section>
  );
}

/** Their stats, a row each as the Shadow card's, the stat their class leads with marked. */
function Stats({ a }: { a: Ally }) {
  const c = hunters.classOf(a);
  return (
    <Section title="Stats" right={c ? <span>Lead <b class="gold">{c.lead}</b></span> : undefined}>
      <ul class="sp-statrows">
        {ORDER.map((k) => (
          <li key={k} class={c?.lead === k ? 'is-lead' : ''}>
            <Glyph name={STAT_ICON[k] ?? 'star'} />
            <span class="sp-statrows__name">{k}</span>
            <b class="num">{a.base[k]}</b>
            <small class="gold">{c?.lead === k ? 'Lead' : ''}</small>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The role bonuses they take from your Shadows as the squad stands, each at its tier; they take no Kin. */
function Taken({ d }: { d: Dungeon }) {
  const s = useSave();
  const squad = isPractice(d) ? [] : shadows.squad(s);
  const lines = kin.makeOf(squad).roleLines;
  return (
    <Section title="From your Shadows">
      {lines.length
        ? (
          <div class="sp-auth">
            {lines.map((l) => (
              <div key={l.role} class="sp-auth__row">
                <span class="sp-auth__name"><Glyph name={ROLE_GLYPH[l.role] ?? 'shadows'} />Role bonus · {l.role} {ROLE_TIER[l.tier - 1]}</span>
                <p class="is-on">{roleText(l.role, l.tier)}</p>
              </div>
            ))}
            <small class="muted">They take no Kin.</small>
          </div>
        )
        : <small class="muted">{isPractice(d) ? 'The Practice Gate takes no Shadows.' : 'No Shadow is deployed.'}</small>}
    </Section>
  );
}

/** What they fight with: their class's skills and its passives, every rung's first, as the fight builds them. */
function Kit({ a }: { a: Ally }) {
  const k = hunters.kitOf(a);
  return (
    <>
      <Section title="Skills">
        <div class="sp-skills">
          {k.kit.length
            ? k.kit.map((n) => {
              const ab = ability(n);
              return (
                <div key={n} class="sp-skill">
                  <span class="sp-skill__ico"><Glyph name={ab?.type === 'magic' ? 'bolt' : 'fist'} /></span>
                  <span class="sp-skill__body"><b>[Skill: {n}]</b><small>{ab ? skillLine(ab) : ''}</small></span>
                </div>
              );
            })
            : <small class="muted">Fights with Strike alone.</small>}
        </div>
      </Section>
      {k.passives.length > 0 && (
        <Section title="Traits">
          <div class="sp-traits">
            {k.passives.map((n) => (
              <div key={n} class="sp-skill is-passive">
                <span class="sp-skill__ico"><Glyph name="star" /></span>
                <span class="sp-skill__body"><b>[Passive: {n}]</b><small>{passiveText(n)}</small></span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/**
 * Their record beside you, as the Shadow card's: Gates walked into together, Gates cleared together, the creatures
 * they helped defeat and the bosses, and how many days since you first walked in together.
 */
function Record({ a }: { a: Ally }) {
  const s = useSave();
  const r = hunters.recordOf(s, a.id);
  const days = r.first ? Math.max(0, daysBetween(r.first, dayKey())) : null;
  return (
    <Section title="Record">
      <div class="sp-record">
        <span><b class="num">{r.runs}</b><small>Gates</small></span>
        <span><b class="num">{r.cleared}</b><small>Cleared</small></span>
        <span><b class="num">{r.kills}</b><small>Defeated</small></span>
        <span><b class="num">{r.bosses}</b><small>Bosses</small></span>
      </div>
      <small class="muted huntercard__met">{days === null ? 'You have not walked into a Gate together.' : days === 0 ? 'First walked in with you today.' : `First walked in with you ${days} ${days === 1 ? 'day' : 'days'} ago.`}</small>
    </Section>
  );
}
