/**
 * HUNTER: an Association hunter's card, opened by tapping them in a Gate's brief's party, after the Shadow card
 * (`screens/Shadows.tsx`) and the info panel of Solo Leveling: Arise, in the System's cyan: what the System sees of a
 * hunter beside you. Top to bottom it reads who they are, what they fight with, and what you have done together:
 * their grade's plate in a ring, their registration, `Rank`, `Class` (the class itself tells what it is when tapped)
 * and `Power`, and how they fight; their stats, a row to each as the Status sheet sets the hunter's own; `Skills & Traits`,
 * Strike first, then their traits, as their class gives them; and `History`, your record with them alone, which
 * follows them from Gate to Gate (`hunters.recordOf`). A Shadow's card has the same three sections in the same order
 * (the owner's call). Each section opens on its label and a hairline. Every number is the engine's: their class from
 * `hunters.classOf`, their kit from `hunters.kitOf`, as the fight builds them.
 */
import { powerText } from '@/ui/power';
import { ability, passiveText, STRIKE } from '@/core/combat';
import { regNo, type Ally } from '@/core/gates';
import * as hunters from '@/core/hunters';
import { nextRung } from '@/data/classes';
import { ATTRS } from '@/core/progression';
import type { Stat } from '@/core/types';
import { ago, ordinal } from '@/ui/when';
import * as store from '@/store';
import { useSave } from '@/store';
import { sfx } from '@/audio/audio';
import { skillLine } from './Skills';
import { Facts, RankPlate, Section } from '@/ui/components';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { StatRow } from '@/ui/statrow';
import { Tip, tipAt, type TipAt, type TipText } from '@/ui/tip';
import { InfoTag } from '@/ui/infotag';
import { openSheet } from '@/ui/overlays';
import { hunterStyleTip, STYLE_GLYPH, styleOfLead } from '@/ui/stand';
import { useState } from 'preact/hooks';
import { statTip } from '@/ui/stattip';
import { KeyedTips } from '@/ui/wards';

const ORDER: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];

/** Open a hunter's card. Their record is read from the save as it stands; the rest is who they are. */
export function openHunter(a: Ally) {
  openSheet({
    title: `Hunter: ${a.name}`,
    system: { icon: <RankPlate rank={a.rank} size={26} /> },
    extra: () => <FavStar a={a} />,
    render: () => <HunterCard a={a} />,
  });
}

/**
 * The star at the far right of the name, in a fixed spot: tapped, the hunter is a favourite, and their face in a Gate's
 * party wears the star too (the owner's call). Drawn in the frame's own colour, filled while starred.
 */
function FavStar({ a }: { a: Ally }) {
  const s = useSave();
  const on = hunters.isFavourite(s, a.id);
  return (
    <button type="button" class={`favstar ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={on ? `${a.name} is a favourite. Remove the star` : `Star ${a.name} as a favourite`}
      onClick={() => { sfx.blip(); store.update((x) => hunters.toggleFavourite(x, a.id)); }}>
      <Glyph name="star" />
    </button>
  );
}

/**
 * A class in the game's one tooltip: its name and `Class`, what kind of fighter it is, then the stat it leads with and
 * the rung it rises to, as Fire Emblem's class screen shows a class's promotion (`Leads with Strength. Rises to
 * Berserker at C-Rank.`).
 */
export function classTip(a: Ally): TipText {
  const c = hunters.classOf(a);
  if (!c) return { title: 'Unclassified', kind: 'Class', tone: 'system', lines: ['No class is given below D-Rank. At D-Rank one comes from their leading stat.'] };
  const stat = ATTRS.find((x) => x.key === c.lead)?.name ?? c.lead;
  const next = nextRung(c);
  return {
    title: c.name,
    kind: 'Class',
    mark: <span class="tip__mark"><Glyph name={STAT_ICON[c.lead] ?? 'star'} /></span>,
    tone: 'system',
    lines: [c.desc, next ? `Leads with ${stat}. Rises to ${next.name} at ${next.rank}-Rank.` : `Leads with ${stat}. The highest class of its line.`],
  };
}

function HunterCard({ a }: { a: Ally }) {
  return (
    <div class="stack shadowcard huntercard">
      <Head a={a} />
      <Stats a={a} />
      <Kit a={a} />
      <History a={a} />
    </div>
  );
}

/**
 * The head, as the Shadow card's: their grade's plate inside a ring, their registration small over the rows
 * `Rank │ D-Rank`, `Class │ Brawler` (the class itself the tag that tells what it is, so it is said once) and
 * `Power │ 26`; under them how they fight. Where their grade stands against the Gate's is the brief's party's to say,
 * by the arrow beside their power.
 */
function Head({ a }: { a: Ally }) {
  const c = hunters.classOf(a);
  const st = hunters.standOf(a);
  const style = styleOfLead(st);
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
        <span class="sp-head__was"><Facts items={[a.note, `Registration ${regNo(a.id)}`]} /></span>
        <dl class="sp-rows">
          <div class="sp-row"><dt>Rank</dt><dd>{a.rank}-Rank</dd></div>
          <div class="sp-row">
            <dt>Class</dt>
            <dd><InfoTag class={`huntercard__class ${c ? 'is-classed' : ''}`} tip={classTip(a)}>{c?.name ?? 'Unclassified'}</InfoTag></dd>
          </div>
          <div class="sp-row"><dt>Power</dt><dd class="sp-row__power num">{powerText(hunters.powerOfAlly(a))}</dd></div>
        </dl>
        <span class="sp-head__tags">
          <InfoTag class="sp-tag sp-tag--style" tip={hunterStyleTip(c?.lead)}><Glyph name={STYLE_GLYPH[style]} />{style}</InfoTag>
        </span>
      </div>
    </section>
  );
}

/**
 * Their stats, a row to each, as the Status sheet sets the hunter's own (`ui/statrow.tsx`): the mark in the System's
 * cyan, the key, a bar toward the Ability Points' limit and the figure, the stat their class leads with lit in gold
 * under `Best`. Each opens the one stat tooltip, anchored to its row as the Status sheet's are (`ui/stattip.tsx`).
 */
function Stats({ a }: { a: Ally }) {
  const c = hunters.classOf(a);
  const [why, setWhy] = useState<{ k: Stat; at: TipAt } | null>(null);
  return (
    <Section title="Stats">
      <div class="statrows">
        {ORDER.map((k) => (
          <StatRow key={k} k={k} value={a.base[k]} bar={a.base[k]} best={c?.lead === k} open={why?.k === k}
            aside={c?.lead === k ? 'Best' : undefined} label={`${k} ${a.base[k]}${c?.lead === k ? ', their best' : ''}`}
            onTap={(el) => { sfx.blip(); setWhy(why?.k === k ? null : { k, at: tipAt(el) }); }} />
        ))}
      </div>
      {why && <Tip tip={statTip(why.k, { base: a.base[why.k], best: c?.lead === why.k })} at={why.at} close={() => setWhy(null)} />}
    </Section>
  );
}

/**
 * `Skills & Traits`, one section as a Shadow's card has (the owner's call): Strike, as everyone has, then their class's
 * skills, and under them its passives, every rung's first, as the fight builds them.
 */
function Kit({ a }: { a: Ally }) {
  const k = hunters.kitOf(a);
  const skills = [STRIKE.name, ...k.kit];
  return (
    <Section title="Skills & Traits">
      <div class="sp-skills">
        {skills.map((n) => {
          const ab = n === STRIKE.name ? STRIKE : ability(n);
          return (
            <div key={n} class="sp-skill">
              <span class="sp-skill__ico"><Glyph name={ab?.type === 'magic' ? 'bolt' : 'fist'} /></span>
              <span class="sp-skill__body"><b>[Skill: {n}]</b><small><KeyedTips text={ab ? skillLine(ab) : ''} tone="system" /></small></span>
            </div>
          );
        })}
        {k.passives.map((n) => (
          <div key={n} class="sp-skill is-passive">
            <span class="sp-skill__ico"><Glyph name="star" /></span>
            <span class="sp-skill__body"><b>[Passive: {n}]</b><small><KeyedTips text={passiveText(n)} tone="system" /></small></span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Where they stand among the hunters you have walked Gates with, said plainly (the owner's call, where it read `Among your partners`). */
function partnerLine(place: number, partners: number): string {
  if (partners <= 1) return 'Your only partner so far.';
  if (place === 1) return `Your most frequent partner, of ${partners}.`;
  return `Your ${ordinal(place)} most frequent partner, of ${partners}.`;
}

/**
 * `History`, your record with this hunter and nobody else's (the owner's call, where it read `Partnership` and before
 * that `Together`), in four groups:
 * - the Gates walked together, large, with where they stand among your partners under it;
 * - how those Gates ended, as one bar split cleared, carried out and withdrawn from, its counts under it;
 * - what they defeated beside you, the creatures and the bosses;
 * - when you first and last walked a Gate together.
 */
function History({ a }: { a: Ally }) {
  const s = useSave();
  const r = hunters.recordOf(s, a.id);
  const ends = [
    { k: 'cleared', n: r.cleared, label: 'Cleared' },
    { k: 'carried', n: r.carried, label: 'Carried out' },
    { k: 'withdrawn', n: r.withdrawn, label: 'Withdrawn' },
  ].filter((x) => x.n > 0 || x.k === 'cleared');
  return (
    <Section title="History">
      {r.runs === 0
        ? <p class="hc-history__none">No Gates together yet.</p>
        : (
          <div class="hc-history">
            <div class="hc-history__lead">
              <b class="num">{r.runs}</b>
              <span class="hc-history__what">
                <span>{r.runs === 1 ? 'Gate together' : 'Gates together'}</span>
                {r.place && <small class={r.place === 1 && r.partners > 1 ? 'is-first' : ''}>{partnerLine(r.place, r.partners)}</small>}
              </span>
            </div>
            <div class="hc-history__ends">
              <i class="hc-history__bar" aria-hidden="true">
                {ends.map((x) => <i key={x.k} class={`is-${x.k}`} style={`flex-grow: ${x.n}`} />)}
              </i>
              <ul class="hc-history__legend">
                {ends.map((x) => <li key={x.k} class={`is-${x.k}`}><i aria-hidden="true" /><b class="num">{x.n}</b> {x.label}</li>)}
              </ul>
            </div>
            <div class="hc-history__figs">
              <span><b class="num">{r.kills}</b><small>Creatures defeated</small></span>
              <span><b class="num">{r.bosses}</b><small>Bosses defeated</small></span>
            </div>
            <dl class="hc-history__rows">
              {r.first && <div><dt>First Gate together</dt><dd>{ago(r.first)}</dd></div>}
              {r.last && <div><dt>Last Gate together</dt><dd>{ago(r.last)}</dd></div>}
            </dl>
          </div>
        )}
    </Section>
  );
}
