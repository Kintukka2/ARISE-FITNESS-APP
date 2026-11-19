/**
 * Inventory: the hunter's page, after the character screens of Genshin Impact and Honkai: Star Rail and
 * Solo Leveling: Arise's hunter page. The hunter at its head, their figure wearing what is worn beside
 * their name and condition; the stats and the skills as two cards; the bag, the Forge and the Exchange as
 * three stations; the licence along the foot. Each opens its window.
 */
import { RankCrest } from '@/ui/rankcrest';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { classById } from '@/data/classes';
import * as gear from '@/core/gear';
import * as forge from '@/core/forge';
import { reclassification } from '@/core/quests';
import { ATTRS, autoAllocate, BOOST_CAP, classBonus, rankOf, spendPoint, STAT_CAP } from '@/core/progression';
import * as skilltree from '@/core/skilltree';
import { CRIT, HIT, Unit } from '@/core/combat';
import { heroSpec } from '@/core/raid';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import { buyLicence, priceOf, storeReady } from '@/platform/native';
import * as shop from '@/core/shop';
import type { Save, Stat } from '@/core/types';
import { RANKS, STATS } from '@/core/types';
import { group, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { weekBest } from '@/core/spire';
import * as system from '@/ui/system';
import { Btn, Empty, Facts, GearArt, HpBar, useNow } from '@/ui/components';
import { Field, SysFrame } from '@/ui/frame';
import { Tip, tipAt, type TipAt } from '@/ui/tip';
import { buzz } from '@/ui/feedback';
import { Glyph, Shard, STAT_ICON, Sigil } from '@/ui/icons';
import { ask } from '@/ui/ask';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { openExchange } from './Exchange';
import { openForge } from './Forge';
import { Avatar, openEquipment, openInventory } from './Gear';
import { Constellation, openSkills } from './Skills';
import { openReclassification } from './Quests';
import { statTip } from '@/ui/stattip';

/** The Skills window: kept under its old name for the screens that open it from a class. */
export const openClass = openSkills;

/** A line of the log as it reads now: older saves wrote `Iron Den: cleared` or the outcome after a dash, and the Spire's and Rift's names with a middle dot. */
const logName = (n: string) => n.replace(/ \u00b7 /g, ': ').replace(/(?::| \u2014) (cleared|withdrawn|defeated)$/, ', $1');

export function Inventory() {
  const s = useSave();
  useNow(5000);
  return (
    <div class="stack hubpage" aria-label="Inventory">
      <HunterHero s={s} />
      <div class="hubpair">
        <StatsCard s={s} />
        <SkillsCard s={s} />
      </div>
      <Stations s={s} />
      <LicenceRow s={s} />
    </div>
  );
}

/** Skill Points with somewhere to go, in advancement's gold. */
function SkillDue({ n }: { n: number }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true">+</span>Skill Points: <b class="num">{n}</b></span>;
}

/** A rank the level has reached and the hunter has not yet claimed, in advancement's gold. */
function RankDue({ to }: { to: string }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true"><Glyph name="up" /></span>{to}: requirements met</span>;
}

/** Unspent Ability Points, in advancement's gold: a lit + mark, then the count. */
function PointsDue({ n }: { n: number }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true">+</span>Ability Points: <b class="num">{n}</b></span>;
}

/**
 * The hunter at the head of their page: their figure, wearing what is worn, opening Equipment (its score
 * under it, a gold ▲ while Auto Equip has something better); beside it who they are and their condition,
 * opening Status. The frame turns gold while Status waits on them: points to spend, a rank to claim.
 */
function HunterHero({ s }: { s: Save }) {
  const r = rankOf(s);
  const shown = r.key === 'N' ? 'N' : licensedRank(s);
  const cls = classById(s.hunter.classId);
  const v = vitals.read(s);
  const rc = reclassification(s);
  const ups = gear.upgradeCount(s);
  const pts = s.hunter.points;
  const call = !!rc?.ready || pts > 0;
  const score = Math.round(gear.power(s));
  return (
    <SysFrame kind={call ? 'gold' : 'system'} class={`hhero ${call ? 'is-call' : ''}`} label="Hunter" tour="hero">
      <div class="hhero__grid">
        <button type="button" class={`hhero__gear ${ups ? 'is-call' : ''}`} data-hub="equipment"
          aria-label={`Equipment: score ${score}${ups ? `, Auto Equip ${ups}` : ''}`} onClick={() => { sfx.tap(); openEquipment(); }}>
          <span class="hhero__aura" aria-hidden="true" />
          <span class="hhero__fig" aria-hidden="true"><Avatar s={s} hot={null} /></span>
          <span class="hhero__score">
            <small class="label">Equipment</small>
            <b class="num">{score}</b>
            {ups > 0 && <span class="hhero__up" aria-hidden="true">▲ {ups}</span>}
          </span>
        </button>
        <button type="button" class="hhero__status" data-hub="status" aria-label={`Status: ${s.hunter.name}${pts ? `, ${pts} Ability Points` : ''}`}
          onClick={() => { sfx.tap(); openStatus(); }}>
          <span class="hhero__who">
            <Sigil rank={shown} size={42} />
            <span class="hhero__name"><b>{s.hunter.name}</b><small><Facts items={[cls?.name ?? 'Unclassified', r.name]} /></small></span>
          </span>
          <span class="hhero__bars">
            <MiniBar label="HP" cur={v.hp} max={v.hpMax} tone="hp" />
            <MiniBar label="MP" cur={v.mp} max={v.mpMax} tone="mp" />
            <MiniBar label="FTG" cur={v.fatigue} max={vitals.FATIGUE_MAX} tone="ftg" />
          </span>
          <span class="hhero__foot">
            {rc?.ready ? <RankDue to={rc.to.name} /> : pts ? <PointsDue n={pts} /> : <span class="label">Status</span>}
            <Glyph name="chevron" class="hhero__go" />
          </span>
        </button>
      </div>
    </SysFrame>
  );
}

/** The five stats as their figure, the one they lean on, and their sum. It opens Stats. */
function StatsCard({ s }: { s: Save }) {
  const total = statsNow(s);
  const lead = STATS.reduce((a, b) => (total[b] > total[a] ? b : a));
  return (
    <button type="button" class="hubcard" data-hub="stats" aria-label={`Stats: ${lead} ${Math.round(total[lead])}`} onClick={() => { sfx.tap(); openStats(); }}>
      <span class="hubcard__head"><span class="label">Stats</span><b class="num"><Glyph name={STAT_ICON[lead]} />{lead} {Math.round(total[lead])}</b></span>
      <span class="hubcard__art"><Radar values={total} /></span>
      <span class="hubcard__foot"><small>{STATS.map((k) => Math.round(total[k])).reduce((a, b) => a + b, 0)} in all</small><Glyph name="chevron" class="hubcard__go" /></span>
    </button>
  );
}

/** The skill tree's sky, and its points while they have somewhere to go, in gold. It opens Skills. */
function SkillsCard({ s }: { s: Save }) {
  const cls = classById(s.hunter.classId);
  const sp = skilltree.canSpend(s) ? skilltree.points(s) : 0;
  return (
    <button type="button" class={`hubcard ${sp ? 'is-call' : ''}`} data-hub="skills" aria-label={`Skills${sp ? `: ${sp} Skill Points` : ''}`} onClick={() => { sfx.tap(); openSkills(); }}>
      <span class="hubcard__head"><span class="label">Skills</span><b class="num">{cls ? `${cls.rank}-Rank` : '-- --'}</b></span>
      <span class="hubcard__art"><span class="ia-sky"><Constellation s={s} mini /></span></span>
      <span class="hubcard__foot">{sp ? <SkillDue n={sp} /> : <small>{cls ? `[Class: ${cls.name}]` : 'Unclassified'}</small>}<Glyph name="chevron" class="hubcard__go" /></span>
    </button>
  );
}

/** What is held, what can be forged and what can be bought: three stations side by side. */
function Stations({ s }: { s: Save }) {
  const fresh = (s.newItems ?? []).length;
  // The three best pieces held, fanned out with the best in the middle.
  const best = s.items.slice().sort((a, b) => gear.score(b) - gear.score(a)).slice(0, 3);
  const top = best.length === 3 ? [best[1], best[0], best[2]] : best;
  const known = (s.blueprints ?? []).length;
  const ready = forge.FORGEABLE.filter((d) => forge.canForge(s, d)).length;
  const better = forge.betterForges(s).length;
  return (
    <div class="hubstations">
      <button type="button" class="hubst" data-hub="inventory" aria-label={`Item Bag: ${s.items.length} items${fresh ? `, ${fresh} new` : ''}`} onClick={() => { sfx.tap(); openInventory(); }}>
        <span class="hubst__art">
          {top.length
            ? <span class="hubst__fan">{top.map((it, i) => <span key={it.id} class="hubst__card" style={`--i: ${i - (top.length - 1) / 2}`}><GearArt item={it} size={36} /></span>)}</span>
            : <Glyph name="bag" />}
        </span>
        <b class="hubst__name">Item Bag</b>
        <small>{s.items.length} items</small>
        {fresh > 0 && <span class="hubst__badge">{fresh} new</span>}
      </button>
      {/* A blueprint that can be forged into something rarer than what is worn waits on the hunter: gold. */}
      <button type="button" class={`hubst is-forge ${better ? 'is-call' : ''}`} data-hub="forge" aria-label={`Forge: ${better ? `${better} ${better === 1 ? 'upgrade' : 'upgrades'}` : `can forge ${ready}`}`} onClick={() => { sfx.tap(); openForge(); }}>
        <span class="hubst__art"><span class="ia-forge"><i class="ia-forge__glow" /><Glyph name="forge" /><i class="ia-forge__spark" /><i class="ia-forge__spark" /><i class="ia-forge__spark" /></span></span>
        <b class="hubst__name">Forge</b>
        <small>{ready ? `Can forge: ${ready}` : `Blueprints: ${known}`}</small>
        {better > 0 && <span class="hubst__badge is-gold">▲ {better}</span>}
      </button>
      <button type="button" class="hubst is-exchange" data-hub="exchange" aria-label="Exchange" onClick={() => { sfx.tap(); openExchange(); }}>
        <span class="hubst__art"><span class="ia-shard"><i class="ia-shard__ring" /><Shard size={34} /></span></span>
        <b class="hubst__name">Exchange</b>
        <small class="hubst__clock" aria-label={`New stock in ${hhmmss(msUntilMidnight())}`}><Glyph name="timer" /><span class="num">{hhmmss(msUntilMidnight())}</span></small>
      </button>
    </div>
  );
}

/** The hunter's licence along the page's foot: its number and the Gates cleared. It opens the dossier. */
function LicenceRow({ s }: { s: Save }) {
  const r = rankOf(s);
  const shown = r.key === 'N' ? 'N' : licensedRank(s);
  return (
    <button type="button" class="hublicence" data-hub="dossier" aria-label={`Hunter: ${s.hunter.name}, licence ${s.hunter.regNo || 'none'}. Open the dossier`}
      onClick={() => { sfx.tap(); openDossier(); }}>
      <Sigil rank={shown} size={30} />
      <span class="hublicence__one"><small class="label">Hunter Licence</small><b class="num">{s.hunter.regNo || '-- --'}</b></span>
      <span class="hublicence__one"><small class="label">Gates cleared</small><b class="num">{s.gates.clears}</b></span>
      <Glyph name="chevron" class="hublicence__go" />
    </button>
  );
}

/** Every stat as it fights: Ability Points, class and gear together. */
const statsNow = (s: Save) => gear.boosted(s.hunter.attrs, gear.worn(s), skilltree.flatBonus(s), BOOST_CAP);

/** One vital as a thin bar with its count, for a tile. */
export function MiniBar({ label, cur, max, tone }: { label: string; cur: number; max: number; tone: string }) {
  return (
    <span class="ia-bar" data-tone={tone}>
      <span class="ia-bar__top"><small>{label}</small><span class="num">{Math.round(cur)}</span></span>
      <span class="ia-bar__track"><i style={`transform: scaleX(${Math.max(0, Math.min(1, cur / Math.max(1, max)))})`} /></span>
    </span>
  );
}

/**
 * How far the figure's axes reach: the largest stat shown, rounded up to the next 50, and never less
 * than `STAT_CAP`, the most Ability Points take a stat. A stat always lands inside the rim.
 */
export const radarScale = (...sets: Record<Stat, number>[]) =>
  Math.max(STAT_CAP, Math.ceil(Math.max(0, ...sets.flatMap((v) => STATS.map((k) => v[k] ?? 0))) / 50) * 50);

/**
 * The five stats as a figure, out to `radarScale`, its rings at each quarter. With `base`, the stats
 * without gear are drawn under them, dashed, so what the gear adds is the space between the two.
 * `live`: pointing at a stat, or tapping it, shows its value at its corner, and the rings carry their values.
 */
function Radar({ values, base, live }: { values: Record<Stat, number>; base?: Record<Stat, number>; live?: boolean }) {
  const [on, setOn] = useState<Stat | null>(null);
  const order: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];
  const max = base ? radarScale(values, base) : radarScale(values);
  const at = (i: number, r: number) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  };
  const reach = (v: number) => 2 + 36 * Math.min(1, Math.max(0, v) / max);
  const ring = (r: number) => order.map((_, i) => at(i, r).join(',')).join(' ');
  const shape = (v: Record<Stat, number>) => order.map((k, i) => at(i, reach(v[k])).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox="0 0 100 100" class="ia-radar" role="img" aria-label={order.map((k) => `${k} ${Math.round(values[k])}`).join(', ')}>
      {rings.map((f) => <polygon key={f} points={ring(2 + 36 * f)} class="ia-radar__ring" />)}
      {order.map((_, i) => { const [x, y] = at(i, 38); return <line key={i} x1="50" y1="50" x2={x} y2={y} class="ia-radar__axis" />; })}
      {/* Each ring's value, beside the STR axis: the scale, read off the figure itself. */}
      {live && rings.map((f) => { const [, y] = at(0, 2 + 36 * f); return <text key={`v${f}`} x="52.5" y={y + 0.6} class="ia-radar__tick">{Math.round(max * f)}</text>; })}
      {base && <polygon points={shape(base)} class="ia-radar__shape ia-radar__shape--base" />}
      <polygon points={shape(values)} class="ia-radar__shape" />
      {order.map((k, i) => { const [x, y] = at(i, 47); return <text key={k} x={x} y={y} class={`ia-radar__label ${on === k ? 'is-on' : ''}`}>{on === k ? `${k} ${Math.round(values[k])}` : k}</text>; })}
      {live && order.map((k, i) => {
        const [px, py] = at(i, reach(values[k]));
        const [lx, ly] = at(i, 44);
        return (
          <g key={`h${k}`} class={`ia-radar__hit ${on === k ? 'is-on' : ''}`}
            onMouseEnter={() => setOn(k)} onMouseLeave={() => setOn((x) => (x === k ? null : x))} onClick={() => setOn(k)}>
            <title>{`${k} ${Math.round(values[k])}${base ? `, ${Math.round(base[k])} without gear` : ''}`}</title>
            <circle cx={px} cy={py} r={on === k ? 2.4 : 1.6} class="ia-radar__dot" />
            {/* A wide, invisible reach: the corner's label and the shape's point both answer a finger. */}
            <circle cx={(px + lx) / 2} cy={(py + ly) / 2} r="11" class="ia-radar__reach" />
          </g>
        );
      })}
    </svg>
  );
}

/** The Status sheet: the hunter's fields, vitals and stats, and where Ability Points are spent. */
export function openStatus() {
  openSheet({ title: 'Status', system: { icon: null }, render: () => <StatusSheet /> });
}

function StatusSheet() {
  const s = useSave();
  useNow(5000);
  const r = rankOf(s);
  const cls = classById(s.hunter.classId);
  const rc = reclassification(s);
  return (
    <div class="stack status">
      {/* The source's window: its fields as plain lines under the header, the level large in its own hexagon. */}
      <header class="sthead">
        <span class="sthead__lv"><small>Level</small><b class="num status__level">{s.hunter.level}</b></span>
        <dl class="sthead__fields">
          <div><dt>Name</dt><dd>{s.hunter.name}</dd></div>
          <div><dt>Class</dt><dd><button type="button" class="linkish" onClick={openSkills}>{cls?.name ?? 'Unclassified'}</button></dd></div>
          <div><dt>Rank</dt><dd class="row status__rank"><Sigil rank={r.key === 'N' ? 'N' : licensedRank(s)} size={18} />{r.name}</dd></div>
        </dl>
      </header>
      <div class={`stclimb ${rc?.ready ? 'is-ready' : ''}`}>
        {/* A rank waiting is a gold button that opens its window, where the hold is. */}
        {rc?.ready
          ? (
            <button type="button" class="stclimb__go" onClick={() => { sfx.tap(); openReclassification(); }}>
              <span class="stclimb__mark" aria-hidden="true"><Glyph name="up" /></span>
              <span class="stclimb__text"><small>Requirements met</small><strong>[Reclassification: {rc.to.name}]</strong></span>
              <Glyph name="chevron" class="stclimb__chev" />
            </button>
          )
          : <small>{rc ? `Level ${rc.to.min} for ${rc.to.name}.` : 'Further ranks: none.'}</small>}
        {rc && !rc.ready && <i class="stclimb__bar" aria-hidden="true"><i style={`width: ${Math.round(rc.share * 100)}%`} /></i>}
        {licenceHolding(s) && <small class="muted">Gate grade: {licensedRank(s)}-Rank without the Association Licence.</small>}
      </div>
      <VitalsBlock />
      <Attributes />
    </div>
  );
}

/**
 * STATS: the five stats as the hunter fights with them, where each one comes from (its base, the
 * class, the gear), and what they make of the hunter in a fight. Status is where the points are spent.
 */
export function openStats() {
  openSheet({ title: 'Stats', system: { icon: null }, render: () => <StatsSheet /> });
}

const STAT_ORDER: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];

/**
 * What each number in a fight does, and where it comes from, in the game's one tooltip: as a fight's tip says
 * a habit, what it does first and then what it grows with, its numbers read from the engine.
 */
const FIGHT_HELP: Record<string, string> = {
  Attack: 'Powers a Strike and every physical skill, against the target’s Defence. Grows with STR, and a little with AGI.',
  Magic: 'Powers every magic skill, against the target’s Resistance. Grows with INT, and a little with PER.',
  Defence: 'Takes the force out of every physical hit you take. Grows with VIT, and a little with STR.',
  Resistance: 'Takes the force out of every magic hit you take, and wards off debuffs. Grows with VIT and INT.',
  Accuracy: `Sets how often your hits land against the target’s Evasion, between ${HIT.min}% and ${HIT.max}%. Grows with PER, and a little with AGI.`,
  Evasion: 'Sets how often a foe’s hits miss you, against its Accuracy. Grows with AGI, and a little with PER.',
  'Crit chance': `Each hit has this chance to deal ×${CRIT.mult} damage: up to ${CRIT.base}% from AGI and PER, and ${CRIT.max}% with gear and passives.`,
  Initiative: 'Sets who acts first each round, the highest first. Grows with AGI, and a little with PER.',
};

function StatsSheet() {
  const s = useSave();
  // A stat's line opens in the game's one tooltip when its row is tapped, so the table reads as one figure a stat.
  const [why, setWhy] = useState<{ k: Stat; at: TipAt } | null>(null);
  const tell = (k: Stat, el: Element) => setWhy(why?.k === k ? null : { k, at: tipAt(el) });
  useNow(5000);
  const bonus = classBonus(s);
  const fromTree = skilltree.treeAttrs(s);
  const total = gear.boosted(s.hunter.attrs, gear.worn(s), skilltree.flatBonus(s), BOOST_CAP);
  // The same hunter with nothing worn: what the gear adds is the space between the two shapes.
  const bare = gear.boosted(s.hunter.attrs, [], skilltree.flatBonus(s), BOOST_CAP);
  const geared = STATS.some((k) => total[k] > bare[k]);
  const v = vitals.read(s);
  // The hunter exactly as the fight builds them: class, gear, sets, marks, passives, and fatigue.
  const d = new Unit(heroSpec(s)).d;
  const fight: [string, string, string][] = [
    ['Attack', `${Math.round(d.patk)}`, FIGHT_HELP.Attack], ['Magic', `${Math.round(d.mpow)}`, FIGHT_HELP.Magic],
    ['Defence', `${Math.round(d.defense)}`, FIGHT_HELP.Defence], ['Resistance', `${Math.round(d.resist)}`, FIGHT_HELP.Resistance],
    ['Accuracy', `${Math.round(d.accuracy)}`, FIGHT_HELP.Accuracy], ['Evasion', `${Math.round(d.evasion)}`, FIGHT_HELP.Evasion],
    ['Crit chance', `${Math.round(d.crit)}%`, FIGHT_HELP['Crit chance']], ['Initiative', `${Math.round(d.initiative)}`, FIGHT_HELP.Initiative],
  ];
  return (
    <div class="stack statsheet">
      <div class="statsheet__radar">
        <Radar values={total} base={geared ? bare : undefined} live />
        {geared && (
          <span class="radarkey" aria-hidden="true">
            <span class="radarkey__one is-gear"><i />With gear</span>
            <span class="radarkey__one is-base"><i />Without gear</span>
          </span>
        )}
        <small class="muted">Tap a stat for its value</small>
      </div>
      {/* Where each stat comes from, as a table: the columns line up from stat to stat. */}
      <div class="stattable" role="table" aria-label="Where each stat comes from">
        <div class="stattable__head" role="row">
          <span role="columnheader">Stat</span><span role="columnheader">Base</span><span role="columnheader">Class</span>
          <span role="columnheader">Skills</span><span role="columnheader">Gear</span><span role="columnheader">Total</span>
        </div>
        {STAT_ORDER.map((k) => {
          const a = ATTRS.find((x) => x.key === k)!;
          const cls = bonus[k] ?? 0;
          const learned = fromTree[k] ?? 0;
          const kit = Math.round(total[k] - s.hunter.attrs[k] - cls - learned);
          const add = (n: number) => <span role="cell" class={`num ${n > 0 ? 'is-up' : 'is-none'}`}>{n > 0 ? `+${n}` : '--'}</span>;
          return (
            <div key={k} class={`stattable__row ${why?.k === k ? 'is-open' : ''}`} role="row" tabIndex={0} aria-expanded={why?.k === k}
              onClick={(e) => tell(k, e.currentTarget as Element)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tell(k, e.currentTarget as Element); } }}>
              <span class="stattable__name" role="cell"><Glyph name={STAT_ICON[k]} /><b>{a.name}</b></span>
              <span role="cell" class="num">{s.hunter.attrs[k]}</span>
              {add(cls)}{add(learned)}{add(kit)}
              <b role="cell" class="num stattable__total">{Math.round(total[k])}</b>
            </div>
          );
        })}
      </div>
      {why && <Tip tip={statTip(why.k, { base: s.hunter.attrs[why.k], total: total[why.k], limits: true })} at={why.at} close={() => setWhy(null)} />}
      <header class="exsec__head"><span class="label">In a fight</span><i aria-hidden="true" /><small>Tap one for what it does</small></header>
      <div class="sysfields">{fight.map(([k, val, why]) => <Field key={k} k={k} v={<span class="num">{val}</span>} help={why} kind="In a fight" />)}</div>
      {v.fatigue > 0 && <small class="muted">Fatigue {v.fatigue}: every stat ×{v.drag.toFixed(2)}.</small>}
    </div>
  );
}

export function VitalsBlock() {
  const s = useSave();
  const v = vitals.read(s);
  const pip = (id: shop.PotionId) => {
    const p = shop.POTIONS.find((x) => x.id === id)!;
    const idle = shop.potionIdle(s, id);
    const have = shop.held(s, id);
    const dear = !have && s.wallet.shards < p.price;
    // One held shows how many, and is drunk before one is bought.
    return (
      <button type="button" class={`pip ${idle ? 'is-idle' : dear ? 'is-dear' : 'is-live'} ${have ? 'is-held' : ''}`} aria-label={have ? `${p.name}, ${have} held` : `${p.name}, ${p.price} shards`} title={have ? `${p.name}: ${have} held` : `${p.name}: ${p.price} Mana Shards`}
        onClick={() => drinkFlow(id)}>
        <Glyph name="potion" /><span class="num">{have ? `×${have}` : p.price}</span>
      </button>
    );
  };
  const ftone = v.fatigue >= 70 ? 'blood' : v.fatigue >= 35 ? 'ember' : 'gold';
  return (
    <div class="vitals" data-tour="vitals">
      <div class="vrow"><Glyph name="hp" /><span class="label">HP</span><HpBar cur={v.hp} max={v.hpMax} tone="hp" />{pip('hp')}</div>
      <div class="vrow"><Glyph name="mp" /><span class="label">MP</span><HpBar cur={v.mp} max={v.mpMax} tone="mp" />{pip('mp')}</div>
      <div class="vrow" title={`Stats ×${v.drag.toFixed(2)}. Fatigue -${vitals.FATIGUE_PER_HOUR} each hour.`}>
        <Glyph name="bolt" /><span class="label">FTG</span><HpBar cur={v.fatigue} max={vitals.FATIGUE_MAX} tone={ftone} />{pip('fatigue')}
      </div>
    </div>
  );
}

/** Drink a potion, held or bought, asked first. `quick`, the brief's +, drinks one held at once; a purchase is still asked. */
export async function drinkFlow(id: shop.PotionId, quick = false) {
  const s = store.get();
  const p = shop.POTIONS.find((x) => x.id === id)!;
  const idle = shop.potionIdle(s, id);
  if (idle) {
    const why = { hp: 'HP is full.', mp: 'MP is full.', fatigue: 'Fatigue is 0.' }[id];
    await sys(system.refuse([why, `${system.tag(p.name, 'Item')} is not available.`], 'gear'));
    return;
  }
  // One held in stock is drunk first; otherwise it is bought.
  const have = shop.held(s, id);
  if (!have && s.wallet.shards < p.price) {
    await sys(system.refuse([`Not enough Mana Shards. (${s.wallet.shards}/${p.price})`], 'gear'));
    return;
  }
  const buy = have
    ? quick || await ask(`drink:${id}`, system.offer([
      'Would you like to drink?',
      system.tag(p.name, 'Item'),
      system.gain(p.effect),
      `Held: ${have}`,
    ], 'gear', 'Drink', 'Cancel'))
    : await ask(`buy:${id}`, system.offer([
      'Would you like to purchase?',
      system.tag(p.name, 'Item'),
      system.gain(p.effect),
      `Price: ${group(p.price)} Mana Shards`,
      `Held: ${group(s.wallet.shards)}`,
    ], 'gear', 'Buy and Drink', 'Cancel'));
  if (buy !== true) return;
  const moved = store.update((x) => shop.drink(x, id));
  if (moved == null) return toast('The potion was not used.', 'bad');
  sfx.success();
  buzz([16, 26, 22]);
  toast(id === 'fatigue' ? `${p.name}: Fatigue -${moved}` : `${p.name}: ${id.toUpperCase()} +${moved}`, 'xp');
}

function Attributes() {
  const s = useSave();
  const total = gear.boosted(s.hunter.attrs, gear.worn(s), skilltree.flatBonus(s), BOOST_CAP);
  const order: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];
  // With no point to spend, a stat tapped tells what it is in the one tooltip, as the Stats sheet and a hunter's card do
  // (the owner's call: a tooltip, never a window); a second tap closes it.
  const [why, setWhy] = useState<{ k: Stat; at: TipAt } | null>(null);
  const spend = (k: Stat, el: Element) => {
    if (!s.hunter.points) {
      sfx.blip();
      setWhy(why?.k === k ? null : { k, at: tipAt(el) });
      return;
    }
    const ok = store.update((x) => spendPoint(x, k));
    if (!ok) return toast(`${k} is at its Ability Point limit.`, 'warn');
    sfx.blip();
    buzz(12);
    void checkAwards();
  };
  const auto = async () => {
    const preview = structuredClone(s);
    autoAllocate(preview);
    const plan = STATS.filter((k) => preview.hunter.attrs[k] > s.hunter.attrs[k]).map((k) => `<strong>${k} +${preview.hunter.attrs[k] - s.hunter.attrs[k]}</strong>`).join(', ');
    if (!(await confirm('Auto-Allocate', `${plan}. A third of the points go to your leading stat; the rest lift your weakest.`, 'Allocate'))) return;
    store.update(autoAllocate);
    sfx.levelUp();
    void checkAwards();
  };
  return (
    <div class="attrs" data-tour="attrs">
      {/* The points at the head, gold while there are any, with Auto-Allocate beside them; then a row to each stat. */}
      <div class={`attrs__head ${s.hunter.points ? 'is-hot' : ''}`}>
        <span class="label">Ability Points</span>
        <b class="num">{s.hunter.points}</b>
        {s.hunter.points > 0 && <Btn kind="gold" size="sm" onClick={auto}>Auto-Allocate</Btn>}
      </div>
      {order.map((k) => (
        <button type="button" key={k} class={`attr ${why?.k === k ? 'is-open' : ''}`} onClick={(e) => spend(k, e.currentTarget as Element)} aria-expanded={s.hunter.points ? undefined : why?.k === k}
          aria-label={`${k} ${Math.round(total[k])}${s.hunter.points ? ', spend a point' : ''}`}>
          <Glyph name={STAT_ICON[k]} />
          <span class="attr__k">{k}</span>
          {/* How far its points have taken it toward their limit. */}
          <i class="attr__bar" aria-hidden="true"><i style={`width: ${Math.round(Math.min(1, s.hunter.attrs[k] / STAT_CAP) * 100)}%`} /></i>
          <small class="attr__base num">{total[k] !== s.hunter.attrs[k] ? `(${s.hunter.attrs[k]})` : ''}</small>
          <b class="attr__v num">{Math.round(total[k])}</b>
          {s.hunter.points > 0 && s.hunter.attrs[k] < STAT_CAP ? <span class="attr__plus"><Glyph name="plus" /></span> : <span class="attr__plus is-none" />}
        </button>
      ))}
      {why && <Tip tip={statTip(why.k, { base: s.hunter.attrs[why.k], total: total[why.k], limits: true })} at={why.at} close={() => setWhy(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ equipment

/** EQUIPMENT: what the hunter wears, slot by slot around them, the score, and the sets it makes. Gear is the System's own, so cyan. */
// ------------------------------------------------------------------ dossier

/** The System's card on the hunter: the licence, what is in force, the lifetime record, and the log. */
export function openDossier() {
  const s = store.get();
  openSheet({
    // The grade is on the licence itself, so the head names the hunter and holds no seal (the owner's call: C-Rank once, not three times).
    title: `Hunter: ${s.hunter.name}`, system: { icon: null },
    render: () => {
      const s = store.get();
      const felled = Object.values(s.stats.killsByFamily).reduce((a, b) => a + b, 0);
      const mine = rankOf(s).key === 'N' ? 'N' : licensedRank(s);
      // The lifetime record, a figure to each, the most telling first, and every figure a record of its own (the owner's
      // call: nothing sits under another): the Gates, then the quests and climbs, then what the hunter has gathered.
      const record: [string, ComponentChildren][] = [
        ['Gates cleared', group(s.gates.clears)],
        ['Different Gates cleared', s.gates.cleared.length],
        ['Best run unbroken', s.gates.bestUnbroken],
        ['Bosses faced', s.gates.bosses.length],
        ['Withdrawn', s.gates.withdrawn],
        ['Carried out', s.gates.fails],
        ['Cleared above grade', s.stats.reachClears],
        ['Daily Quests', group(s.stats.contracts)],
        ['Full days of Daily Quests', s.stats.contractDays],
        ['Ascension', s.ascension.best ? `Level ${s.ascension.best}` : '-- --'],
        ['The Pale Spire', s.spire.top ? `Floor ${s.spire.top}` : '-- --'],
        ['The Spire this week', weekBest(s) ? `Floor ${weekBest(s)}` : '-- --'],
        ['Creatures defeated', group(felled)],
        ['Shadows bound', s.shadows.army.length],
        ['Extractions', `${s.stats.extractionsWon}/${s.stats.extractions}`],
        ['XP earned', group(s.stats.xpTotal)],
        ['Mana Shards earned', group(s.wallet.earned)],
      ];
      const grade = licensedRank(s);
      const issued = licenceRequired(s) ? (s.licence.granted ? 'Issued' : '-- --') : 'Issued';
      return (
        <div class="stack dossier">
          {/* The licence as the Association issues it, as the Licence window draws it: the grade's seal, the number, when the hunter woke. */}
          <div class="glicence__card dossier__card" style={`--rc: var(--rank-${mine === 'N' ? 'S' : mine})`}>
            <RankCrest rank={mine} class="glicence__crest" />
            <span class="glicence__seal"><Sigil rank={mine} size={58} /></span>
            <span class="glicence__who">
              <small class="label">Licence</small>
              <b class="num">{s.hunter.regNo || '-- --'}</b>
              <small class="label">Awakened</small>
              <b>{new Date(s.createdAt).toLocaleDateString()}</b>
            </span>
          </div>
          {/* What the grade opens, as the Licence window gave it before the Gates screen's licence opened this page; the grade
              itself is the seal's, once (the owner's call). The hunter's own rank only where it differs (held by the licence, or
              Sovereign), the Association Licence only where there is one to hold, and its purchase while it waits. */}
          <dl class="bfacts glicence__facts">
            <div><dt>Gates open</dt><dd>Up to {RANKS[Math.min(5, RANKS.indexOf(grade) + 1)]}-Rank</dd></div>
            {rankOf(s).name !== `${grade}-Rank` && <div><dt>Rank</dt><dd>{rankOf(s).name}</dd></div>}
            {(licenceRequired(s) || s.licence.granted) && <div><dt>Association Licence</dt><dd>{issued}</dd></div>}
          </dl>
          {licenceHolding(s) && <p class="hint">Gate grade held at {grade}-Rank.</p>}
          {licenceRequired(s) && licenceHolding(s) && storeReady() && (
            <Btn kind="primary" block onClick={async () => { if (await buyLicence()) { sfx.rankUp(); toast('Licence issued. Gates above D-Rank are open.', 'good'); } }}>
              Association Licence<span class="btn__aside">{priceOf('licence') ?? 'Buy'}</span>
            </Btn>
          )}
          <section class="dsec">
            <header class="exsec__head"><span class="label">Record</span><i aria-hidden="true" /></header>
            <div class="drecord">
              {record.map(([k, v]) => (
                <div key={k} class="drecord__one">
                  <b class="num">{v}</b>
                  <small>{k}</small>
                </div>
              ))}
            </div>
          </section>
          <section class="dsec">
            <header class="exsec__head"><span class="label">Log</span><i aria-hidden="true" /><small class="num">{s.log.length}</small></header>
            {s.log.length
              ? <ul class="syslog dossier__log">{s.log.slice(0, 40).map((e, i) => <li key={i}><span class="num">{e.day}</span><span>{logName(e.name)}</span><span class="num grant">{e.xp ? `+${e.xp}` : ''}</span></li>)}</ul>
              : <Empty>Nothing logged yet.</Empty>}
          </section>
        </div>
      );
    },
  });
}
