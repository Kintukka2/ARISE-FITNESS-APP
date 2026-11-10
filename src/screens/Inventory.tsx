/**
 * Inventory: the hunter's page, as a bento grid. Status, the stats, the skills, the equipment, what
 * is held, the Forge, the Exchange and the hunter's record each take a tile, and each tile opens its window.
 */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { classById } from '@/data/classes';
import * as gear from '@/core/gear';
import * as forge from '@/core/forge';
import { reclassification } from '@/core/quests';
import { ATTRS, autoAllocate, BOOST_CAP, classBonus, POINTS_PER_LEVEL, rankOf, RANK_UP_POINTS, spendPoint, STAT_CAP } from '@/core/progression';
import * as skilltree from '@/core/skilltree';
import { CRIT, HIT, Unit } from '@/core/combat';
import { heroSpec } from '@/core/raid';
import { licenceHolding, licensedRank } from '@/core/licence';
import * as shop from '@/core/shop';
import type { Save, Stat } from '@/core/types';
import { STATS } from '@/core/types';
import { compact, group, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { weekBest } from '@/core/spire';
import * as system from '@/ui/system';
import { Btn, Empty, GearArt, HpBar, Section, useNow } from '@/ui/components';
import { BentoGrid, type Tile } from '@/ui/bento';
import { Field } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Shard, STAT_ICON, Sigil } from '@/ui/icons';
import { ask } from '@/ui/ask';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { openExchange } from './Exchange';
import { openForge } from './Forge';
import { openEquipment, openInventory } from './Gear';
import { Constellation, openSkills } from './Skills';

/** The Skills window: kept under its old name for the screens that open it from a class. */
export const openClass = openSkills;

export function Inventory() {
  const s = useSave();
  useNow(5000);
  return <BentoGrid class="invscreen" tiles={tiles(s)} label="Inventory" />;
}

/** Skill Points with somewhere to go, in advancement's gold. */
function SkillDue({ n }: { n: number }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true">+</span>Skill Points: <b class="num">{n}</b></span>;
}

/** A rank the level has reached and the hunter has not yet claimed, in advancement's gold. */
function RankDue({ to }: { to: string }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true"><Glyph name="up" /></span>{to}: requirements met</span>;
}

/** Unspent Ability Points on a tile, in advancement's gold: a lit + mark, then the count. */
function PointsDue({ n }: { n: number }) {
  return <span class="apdue"><span class="apdue__mark" aria-hidden="true">+</span>Ability Points: <b class="num">{n}</b></span>;
}

/** The hunter's page: who they are, what they can do, what they wear, what they hold, and their record. */
function tiles(s: Save): Tile[] {
  const r = rankOf(s);
  const shown = r.key === 'N' ? 'N' : licensedRank(s);
  const cls = classById(s.hunter.classId);
  const v = vitals.read(s);
  const total = statsNow(s);
  const lead = STATS.reduce((a, b) => (total[b] > total[a] ? b : a));
  const sp = skilltree.canSpend(s) ? skilltree.points(s) : 0;
  const ups = gear.upgradeCount(s);
  // The three best pieces held, fanned out with the best in the middle.
  const best = s.items.slice().sort((a, b) => gear.score(b) - gear.score(a)).slice(0, 3);
  const top = best.length === 3 ? [best[1], best[0], best[2]] : best;
  const rc = reclassification(s);
  const known = (s.blueprints ?? []).length;
  const ready = forge.FORGEABLE.filter((d) => forge.canForge(s, d)).length;
  const better = forge.betterForges(s);
  return [
    {
      // Waiting on the hunter (a rank to claim, points to spend): gold, a word in the count, and the light crossing it.
      key: 'status', kind: 'system', name: 'Status', head: true, wide: true, call: !!rc?.ready || s.hunter.points > 0,
      count: rc?.ready ? 'Ready' : s.hunter.points ? `${s.hunter.points} ${s.hunter.points === 1 ? 'point' : 'points'}` : `LV ${s.hunter.level}`,
      status: rc?.ready ? <RankDue to={rc.to.name} /> : s.hunter.points ? <PointsDue n={s.hunter.points} /> : rc ? `Level ${rc.to.min} for ${rc.to.name}.` : r.name,
      art: (
        <span class="ia-status">
          <span class="ia-status__who">
            <Sigil rank={shown} size={44} />
            <span class="ia-status__name"><b>{s.hunter.name}</b><small>{cls?.name ?? 'Unclassified'} · {r.name}</small></span>
          </span>
          <span class="ia-bars">
            <MiniBar label="HP" cur={v.hp} max={v.hpMax} tone="hp" />
            <MiniBar label="MP" cur={v.mp} max={v.mpMax} tone="mp" />
            <MiniBar label="FTG" cur={v.fatigue} max={vitals.FATIGUE_MAX} tone="ftg" />
          </span>
        </span>
      ),
      open: openStatus,
    },
    {
      // Stats reads; Status is where the points are spent, so only Status calls for them.
      key: 'stats', kind: 'system', name: 'Stats', head: true, icon: <Glyph name={STAT_ICON[lead]} />,
      count: `${lead} ${Math.round(total[lead])}`,
      status: `${STATS.map((k) => Math.round(total[k])).reduce((a, b) => a + b, 0)} in all`,
      art: <Radar values={total} />,
      open: openStats,
    },
    {
      // Skill Points with a node to take them: gold, as every tile that waits on the hunter.
      key: 'skills', kind: 'system', name: 'Skills', head: true, icon: <Glyph name="bolt" />, call: sp > 0,
      count: sp ? `${sp} ${sp === 1 ? 'point' : 'points'}` : cls ? `${cls.rank}-Rank` : '-- --',
      status: sp ? <SkillDue n={sp} /> : cls ? `[Class: ${cls.name}]` : 'Unclassified',
      art: <span class="ia-sky"><Constellation s={s} mini /></span>,
      open: openSkills,
    },
    {
      key: 'equipment', kind: 'gear', name: 'Equipment', head: true, wide: true, icon: <Glyph name="Chest" />, call: ups > 0,
      count: ups ? `${ups} better` : Math.round(gear.power(s)),
      status: ups ? <>Auto Equip: <b class="num">{ups}</b></> : setLine(s) ?? `Slots filled: ${gear.worn(s).length}/${gear.SLOTS.length}`,
      art: (
        <span class="ia-doll">
          {gear.SLOTS.map((x) => {
            const it = gear.equippedIn(s, x.key);
            return <span key={x.key} class={`ia-doll__slot ${it ? '' : 'is-empty'}`}>{it ? <GearArt item={it} size={36} /> : <Glyph name={x.accepts} />}</span>;
          })}
        </span>
      ),
      open: openEquipment,
    },
    {
      key: 'inventory', kind: 'gear', name: 'Inventory', head: true, icon: <Glyph name="bag" />,
      count: (s.newItems ?? []).length ? `${(s.newItems ?? []).length} new` : s.items.length,
      status: (s.newItems ?? []).length ? <>Items: <b class="num">{s.items.length}</b> · New: <b class="num grant">{(s.newItems ?? []).length}</b></> : `Designs: ${s.found.length}/${gear.ALL_GEAR.length + gear.ISSUED.length}`,
      art: top.length
        ? <span class="ia-fan">{top.map((it, i) => <span key={it.id} class="ia-fan__card" style={`--i: ${i - (top.length - 1) / 2}`}><GearArt item={it} size={50} /></span>)}</span>
        : <span class="ia-shard"><Glyph name="bag" /></span>,
      open: openInventory,
    },
    {
      // A blueprint that can be forged into something rarer than what is worn waits on the hunter: gold.
      key: 'forge', kind: 'gear', name: 'Forge', head: true, icon: <Glyph name="forge" />, call: better.length > 0,
      count: better.length ? `${better.length} better` : ready ? `${ready} ready` : known,
      status: better.length ? <>Can forge: <b class="num">{ready}</b></> : <>Blueprints: <b class="num">{known}</b>{ready ? <> · Can forge: <b class="num">{ready}</b></> : null}</>,
      art: <span class="ia-forge"><i class="ia-forge__glow" /><Glyph name="forge" /><i class="ia-forge__spark" /><i class="ia-forge__spark" /><i class="ia-forge__spark" /></span>,
      open: () => openForge(),
    },
    {
      key: 'exchange', kind: 'gear', name: 'Exchange', head: true, icon: <Shard size={18} />,
      count: compact(s.wallet.shards),
      status: <>New stock in: <b class="num">{hhmmss(msUntilMidnight())}</b></>,
      art: <span class="ia-shard"><i class="ia-shard__ring" /><Shard size={54} /></span>,
      open: openExchange,
    },
    {
      key: 'dossier', kind: 'system', name: `Hunter: ${s.hunter.name}`, icon: <Glyph name="book" />,
      count: s.hunter.regNo || '-- --',
      status: `Gates cleared: ${s.gates.clears}`,
      art: (
        <span class="ia-licence">
          <span class="ia-licence__head"><small>Hunter Association</small><b>Hunter Licence</b></span>
          <Sigil rank={shown} size={34} />
        </span>
      ),
      open: openDossier,
    },
  ];
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
            <title>{`${k} ${Math.round(values[k])}${base ? ` · Without gear ${Math.round(base[k])}` : ''}`}</title>
            <circle cx={px} cy={py} r={on === k ? 2.4 : 1.6} class="ia-radar__dot" />
            {/* A wide, invisible reach: the corner's label and the shape's point both answer a finger. */}
            <circle cx={(px + lx) / 2} cy={(py + ly) / 2} r="11" class="ia-radar__reach" />
          </g>
        );
      })}
    </svg>
  );
}

/** The fullest set worn, as the Equipment tile names it. */
function setLine(s: Save): string | null {
  const on = [...gear.setsIn(gear.worn(s))].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  return on.length ? `[Set: ${on[0][0]}] ${on[0][1]}/${gear.setPieces(on[0][0]).length}` : null;
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
      <div class="sysfields">
        <Field k="Name" v={s.hunter.name} />
        <Field k="Level" v={<span class="status__level">{s.hunter.level}</span>} />
        <Field k="Class" v={<button type="button" class="linkish" onClick={openSkills}>{cls?.name ?? 'Unclassified'}</button>} />
        <Field k="Rank" v={<span class="row status__rank"><Sigil rank={r.key === 'N' ? 'N' : licensedRank(s)} size={20} />{r.name}</span>} />
      </div>
      <small class="muted">{rc?.ready ? <span class="apdue">Requirements met: <strong>[Reclassification: {rc.to.name}]</strong></span> : rc ? `Level ${rc.to.min} for ${rc.to.name}.` : 'Further ranks: none.'}{licenceHolding(s) ? ` Gate grade: ${licensedRank(s)}-Rank without the Association Licence.` : ''}</small>
      {skilltree.canSpend(s) && <Btn kind="gold" block onClick={openSkills}>Skills · Skill Points: {skilltree.points(s)}</Btn>}
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

/** What each number in a fight does, and where it comes from: the interface, one line each, numbers read from the engine. */
const FIGHT_HELP: Record<string, string> = {
  Attack: 'The power of a Strike and of a physical skill, set against the target’s Defence. From STR, and a little AGI.',
  Magic: 'The power of a magic skill, set against the target’s Resistance. From INT, and a little PER.',
  Defence: 'Takes the force out of a physical hit: the more of it, the less each one does. From VIT, and a little STR.',
  Resistance: 'Takes the force out of a magic hit, and wards off debuffs. From VIT and INT.',
  Accuracy: `How often your hits land: your Accuracy against the target’s Evasion, ${HIT.min}-${HIT.max}%. From PER, and a little AGI.`,
  Evasion: 'How often a foe misses you: its Accuracy against your Evasion. From AGI, and a little PER.',
  'Critical hit': `The chance a hit does ×${CRIT.mult} damage. From AGI and PER, up to ${CRIT.base}%, and ${CRIT.max}% with gear and passives.`,
  Initiative: 'Who acts first in each round: the highest goes first. From AGI, and a little PER.',
};

function StatsSheet() {
  const s = useSave();
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
    ['Critical hit', `${Math.round(d.crit)}%`, FIGHT_HELP['Critical hit']], ['Initiative', `${Math.round(d.initiative)}`, FIGHT_HELP.Initiative],
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
      <ul class="statrows">
        {STAT_ORDER.map((k) => {
          const a = ATTRS.find((x) => x.key === k)!;
          const cls = bonus[k] ?? 0;
          const learned = fromTree[k] ?? 0;
          const kit = Math.round(total[k] - s.hunter.attrs[k] - cls - learned);
          return (
            <li key={k} class="sysbox statrow">
              <span class="statrow__icon" aria-hidden="true"><Glyph name={STAT_ICON[k]} /></span>
              <span class="statrow__body">
                <span class="statrow__head"><b>{a.name}</b><b class="num">{Math.round(total[k])}</b></span>
                <small>{[`Base ${s.hunter.attrs[k]}`, cls ? `Class +${cls}` : '', learned ? `Skills +${learned}` : '', kit > 0 ? `Gear +${kit}` : ''].filter(Boolean).join(' · ')}</small>
                <small class="muted">{a.desc}</small>
              </span>
            </li>
          );
        })}
      </ul>
      <span class="label">In a fight</span>
      <div class="sysfields">{fight.map(([k, val, why]) => <Field key={k} k={k} v={<span class="num">{val}</span>} help={why} />)}</div>
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
      <button type="button" class={`pip ${idle ? 'is-idle' : dear ? 'is-dear' : 'is-live'} ${have ? 'is-held' : ''}`} aria-label={have ? `${p.name}, ${have} held` : `${p.name}, ${p.price} shards`} title={have ? `${p.name} · Held: ${have}` : `${p.name} · ${p.price}`}
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
      <div class="vrow" title={`Stats ×${v.drag.toFixed(2)} · Fatigue -${vitals.FATIGUE_PER_HOUR} each hour`}>
        <Glyph name="bolt" /><span class="label">FTG</span><HpBar cur={v.fatigue} max={vitals.FATIGUE_MAX} tone={ftone} />{pip('fatigue')}
      </div>
      {v.locked && <div class="vrow vrow--locked"><Glyph name="warn" /><small class="grow">Carried out. Fit to raid in {Math.ceil(v.lockedFor / 36e5)}h.</small>{pip('elixir')}</div>}
    </div>
  );
}

/** Drink a potion, held or bought, asked first. `quick`, the brief's +, drinks one held at once; a purchase is still asked. */
export async function drinkFlow(id: shop.PotionId, quick = false) {
  const s = store.get();
  const p = shop.POTIONS.find((x) => x.id === id)!;
  const idle = shop.potionIdle(s, id);
  if (idle) {
    const why = { hp: 'HP is full.', mp: 'MP is full.', fatigue: 'Fatigue is 0.', elixir: 'There is no lockout.' }[id];
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
      `Price: ${group(p.price)} Mana Shards · Held: ${group(s.wallet.shards)}`,
    ], 'gear', 'Buy and Drink', 'Cancel'));
  if (buy !== true) return;
  const moved = store.update((x) => shop.drink(x, id));
  if (moved == null) return toast('The potion was not used.', 'bad');
  sfx.success();
  buzz([16, 26, 22]);
  toast(id === 'elixir' ? `${p.name} · lockout lifted` : id === 'fatigue' ? `${p.name} · Fatigue -${moved}` : `${p.name} · ${id.toUpperCase()} +${moved}`, 'xp');
}

function Attributes() {
  const s = useSave();
  const total = gear.boosted(s.hunter.attrs, gear.worn(s), skilltree.flatBonus(s), BOOST_CAP);
  const order: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];
  const spend = (k: Stat) => {
    if (!s.hunter.points) {
      const a = ATTRS.find((x) => x.key === k)!;
      void sys({
        title: `Stat: ${a.name}`, kind: 'system', typed: false, actions: [{ label: 'Close', value: null }],
        lines: [
          a.desc,
          `Base: <strong>${s.hunter.attrs[k]}</strong>${total[k] !== s.hunter.attrs[k] ? ` · With class and gear: <strong>${Math.round(total[k])}</strong>` : ''}`,
          `Limit: ${STAT_CAP} from Ability Points, ${BOOST_CAP} with class and gear.`,
        ],
      });
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
    const plan = STATS.filter((k) => preview.hunter.attrs[k] > s.hunter.attrs[k]).map((k) => `<strong>${k} +${preview.hunter.attrs[k] - s.hunter.attrs[k]}</strong>`).join(' · ');
    if (!(await confirm('Auto-Allocate', `${plan}. A third of the points go to your leading stat; the rest lift your weakest.`, 'Allocate'))) return;
    store.update(autoAllocate);
    sfx.levelUp();
    void checkAwards();
  };
  return (
    <div class="attrs" data-tour="attrs">
      {order.map((k) => (
        <button type="button" key={k} class="attr" onClick={() => spend(k)} aria-label={`${k} ${Math.round(total[k])}${s.hunter.points ? ', spend a point' : ''}`}>
          <Glyph name={STAT_ICON[k]} />
          <span class="attr__k">{k}</span>
          {total[k] !== s.hunter.attrs[k] && <small class="attr__base num">({s.hunter.attrs[k]})</small>}
          <b class="attr__v num">{Math.round(total[k])}</b>
          {s.hunter.points > 0 && s.hunter.attrs[k] < STAT_CAP && <span class="attr__plus"><Glyph name="plus" /></span>}
        </button>
      ))}
      <div class={`attr attr--points ${s.hunter.points ? 'is-hot' : ''}`}>
        <span class="label">Ability Points</span><b class="num">{s.hunter.points}</b>
      </div>
      {s.hunter.points > 0 && (
        <div class="attrs__alloc">
          <small class="muted">Tap a stat to spend an Ability Point.</small>
          <Btn kind="gold" size="sm" onClick={auto}>Auto-Allocate · {s.hunter.points}</Btn>
        </div>
      )}
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
    title: `Hunter: ${s.hunter.name}`, system: { icon: <Sigil rank={rankOf(s).key === 'N' ? 'N' : licensedRank(s)} size={40} /> },
    render: () => {
      const s = store.get();
      const felled = Object.values(s.stats.killsByFamily).reduce((a, b) => a + b, 0);
      return (
        <div class="stack dossier">
          <div class="sysfields">
            <Field k="Licence" v={<span class="num">{s.hunter.regNo || '-- --'}</span>} />
            <Field k="Awakened" v={new Date(s.createdAt).toLocaleDateString()} />
            <Field k="Rank" v={rankOf(s).name} />
            <Field k="Guild" v="-- --" />
          </div>
          <Section title="In force">
            <div class="sysfields">
              <Field k="Ability Points" v={`${POINTS_PER_LEVEL} each level · ${RANK_UP_POINTS} each rank`} wide />
              {Object.entries(classBonus(s)).map(([k, v]) => <Field key={k} k="Class" v={<span class="grant">{k} +{v}</span>} />)}
            </div>
          </Section>
          <Section title="Record">
            <div class="sysfields">
              <Field k="Gates cleared" v={`${s.gates.clears} · ${s.gates.cleared.length} distinct`} />
              <Field k="Best run unbroken" v={s.gates.bestUnbroken} />
              <Field k="Withdrawn" v={s.gates.withdrawn} />
              <Field k="Carried out" v={s.gates.fails} />
              <Field k="Cleared above grade" v={s.stats.reachClears} />
              <Field k="Bosses faced" v={s.gates.bosses.length} />
              <Field k="Daily Quests" v={`${s.stats.contracts} · ${s.stats.contractDays} full days`} />
              <Field k="Ascension" v={s.ascension.best ? `Level ${s.ascension.best}` : '-- --'} />
              <Field k="The Pale Spire" v={s.spire.top ? `Floor ${s.spire.top}${weekBest(s) ? ` · this week ${weekBest(s)}` : ''}` : '-- --'} wide />
              <Field k="Creatures defeated" v={group(felled)} />
              <Field k="Shadows bound" v={`${s.shadows.army.length} · ${s.stats.extractionsWon}/${s.stats.extractions}`} />
              <Field k="XP earned" v={group(s.stats.xpTotal)} />
              <Field k="Mana Shards earned" v={group(s.wallet.earned)} />
            </div>
          </Section>
          <Section title="Log" right={`${s.log.length}`}>
            {s.log.length
              ? <ul class="syslog">{s.log.slice(0, 40).map((e, i) => <li key={i} class="sysbox"><span class="num">{e.day}</span><span>{e.name}</span><span class="num grant">{e.xp ? `+${e.xp}` : '·'}</span></li>)}</ul>
              : <Empty>Nothing logged yet.</Empty>}
          </Section>
        </div>
      );
    },
  });
}
