/**
 * HUNTER: an Association hunter's card, opened by tapping them in a Gate's brief's party, after the Shadow card
 * (`screens/Shadows.tsx`) and the info panel of Solo Leveling: Arise, in the System's cyan: what the System sees of a
 * hunter beside you. Top to bottom it reads who they are, what they fight with, and what you have done together:
 * their grade's plate in a ring, their registration, `Rank`, `Class` (the class itself tells what it is when tapped)
 * and `Power`, how they fight and where their grade stands against the Gate's; their stats in one row; their skills,
 * Strike first, and their traits, as their class gives them; and `Together`, your record with them alone, which
 * follows them from Gate to Gate (`hunters.recordOf`). Every number is the engine's: their class from
 * `hunters.classOf`, their kit from `hunters.kitOf`, as the fight builds them.
 */
import { ability, passiveText, STRIKE } from '@/core/combat';
import { rankIdx, regNo, type Ally } from '@/core/gates';
import * as hunters from '@/core/hunters';
import { ATTRS } from '@/core/progression';
import type { Dungeon, Stat } from '@/core/types';
import { daysBetween, dayKey } from '@/core/util';
import { useSave } from '@/store';
import { skillLine } from './Skills';
import { RankPlate, Section } from '@/ui/components';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { InfoTag } from '@/ui/infotag';
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
  if (!c) return { title: 'Unclassified', kind: 'Class', tone: 'system', lines: ['No class is given below D-Rank. At D-Rank one comes from their leading stat.'] };
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
      <Kit a={a} />
      <Together a={a} />
    </div>
  );
}

/**
 * The head, as the Shadow card's: their grade's plate inside a ring, their registration small over the rows
 * `Rank │ D-Rank`, `Class │ Brawler` (the class itself the tag that tells what it is, so it is said once) and
 * `Power │ 26`; under them how they fight, and where their grade stands against the Gate's.
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
          <div class="sp-row">
            <dt>Class</dt>
            <dd><InfoTag class={`huntercard__class ${c ? 'is-classed' : ''}`} tip={classTip(a)}>{c?.name ?? 'Unclassified'}</InfoTag></dd>
          </div>
          <div class="sp-row"><dt>Power</dt><dd class="sp-row__power num">{hunters.powerOfAlly(a)}</dd></div>
        </dl>
        <span class="sp-head__tags">
          <InfoTag class="sp-tag sp-tag--style" tip={hunterStyleTip(c?.lead)}><Glyph name={STYLE_GLYPH[style]} />{style}</InfoTag>
          <span class={`sp-tag sp-head__state ${vs > 0 ? 'is-on' : ''}`}>{vs > 0 ? 'Above the Gate' : vs < 0 ? 'Under the Gate' : 'At the Gate’s grade'}</span>
        </span>
      </div>
    </section>
  );
}

/** Their stats in one row of five, as a party member's sheet sets them side by side, the stat their class leads with lit. */
function Stats({ a }: { a: Ally }) {
  const c = hunters.classOf(a);
  return (
    <Section title="Stats">
      <ul class="hc-stats">
        {ORDER.map((k) => (
          <li key={k} class={`sysbox ${c?.lead === k ? 'is-lead' : ''}`} aria-label={`${k} ${a.base[k]}${c?.lead === k ? ', their lead' : ''}`}>
            <Glyph name={STAT_ICON[k] ?? 'star'} />
            <b class="num">{a.base[k]}</b>
            <small>{k}</small>
            {c?.lead === k && <i class="hc-stats__lead">Lead</i>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** What they fight with: Strike, as everyone does, then their class's skills; and its passives, every rung's first, as the fight builds them. */
function Kit({ a }: { a: Ally }) {
  const k = hunters.kitOf(a);
  const skills = [STRIKE.name, ...k.kit];
  return (
    <>
      <Section title="Skills">
        <div class="sp-skills">
          {skills.map((n) => {
            const ab = n === STRIKE.name ? STRIKE : ability(n);
            return (
              <div key={n} class="sp-skill">
                <span class="sp-skill__ico"><Glyph name={ab?.type === 'magic' ? 'bolt' : 'fist'} /></span>
                <span class="sp-skill__body"><b>[Skill: {n}]</b><small>{ab ? skillLine(ab) : ''}</small></span>
              </div>
            );
          })}
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

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const ago = (day: string) => {
  const n = Math.max(0, daysBetween(day, dayKey()));
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
};

/**
 * Your record together, the hunter's own and nobody else's: the parties you have made, large, then the Gates cleared
 * and those you were carried out of together, the creatures they defeated beside you and the bosses, when you first
 * and last partied, and where they stand among every hunter you have partied with.
 */
function Together({ a }: { a: Ally }) {
  const s = useSave();
  const r = hunters.recordOf(s, a.id);
  return (
    <Section title="Together">
      {r.runs === 0
        ? <p class="hc-together__none">You have not partied together yet.</p>
        : (
          <div class="hc-together">
            <div class="hc-together__lead">
              <b class="num">{r.runs}</b>
              <span>{r.runs === 1 ? 'Party together' : 'Parties together'}</span>
            </div>
            <div class="sp-record">
              <span><b class="num">{r.cleared}</b><small>Cleared</small></span>
              <span><b class="num">{r.carried}</b><small>Carried out</small></span>
              <span><b class="num">{r.kills}</b><small>Defeated</small></span>
              <span><b class="num">{r.bosses}</b><small>Bosses</small></span>
            </div>
            <dl class="hc-together__rows">
              {r.first && <div><dt>First partied</dt><dd>{ago(r.first)}</dd></div>}
              {r.last && <div><dt>Last partied</dt><dd>{ago(r.last)}</dd></div>}
              {r.place && <div><dt>Among your partners</dt><dd>{r.partners === 1 ? 'The only one' : <>{r.place === 1 ? 'Most often' : `${ordinal(r.place)} most often`}<small class="num"> of {r.partners}</small></>}</dd></div>}
            </dl>
          </div>
        )}
    </Section>
  );
}
