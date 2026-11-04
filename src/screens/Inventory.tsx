/**
 * Inventory: the hunter's page, as a bento grid. Status, the stats, the skills, the equipment, what
 * is held, the Exchange and the hunter's record each take a tile, and each tile opens its window.
 */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { classById } from '@/data/classes';
import * as gear from '@/core/gear';
import { ascensionOpen, overCap } from '@/core/ascension';
import { walkerOf } from '@/core/walkers';
import { OVERCHARGE } from '@/data/ascension';
import { reclassification } from '@/core/quests';
import { ATTRS, autoAllocate, BOOST_CAP, classBonus, POINTS_PER_LEVEL, rankOf, RANK_UP_POINTS, spendPoint, STAT_CAP } from '@/core/progression';
import * as skilltree from '@/core/skilltree';
import { CRIT, HIT, Unit } from '@/core/combat';
import { heroSpec } from '@/core/raid';
import { licenceHolding, licensedRank } from '@/core/licence';
import * as shop from '@/core/shop';
import type { Item, Save, SlotKey, Stat } from '@/core/types';
import { STATS } from '@/core/types';
import { compact, group, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { weekBest } from '@/core/spire';
import { dungeonById } from '@/core/gates';
import { setById, type GearSet } from '@/data/sets';
import * as system from '@/ui/system';
import { Btn, Chip, Empty, GearArt, HpBar, IconBtn, KV, Section, Shards, useNow, SetMark } from '@/ui/components';
import { BentoGrid, type Tile } from '@/ui/bento';
import { Field } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Shard, STAT_ICON, Sigil } from '@/ui/icons';
import { ask } from '@/ui/ask';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { openExchange } from './Exchange';
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
      count: s.items.length,
      status: `Designs: ${s.found.length}/${gear.ALL_GEAR.length + gear.ISSUED.length}`,
      art: top.length
        ? <span class="ia-fan">{top.map((it, i) => <span key={it.id} class="ia-fan__card" style={`--i: ${i - (top.length - 1) / 2}`}><GearArt item={it} size={50} /></span>)}</span>
        : <span class="ia-shard"><Glyph name="bag" /></span>,
      open: openInventory,
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
 * The five stats as a figure, every axis out to `STAT_CAP` (100), the most Ability Points take a stat: where
 * the hunter stands against the world, not against their own best. A stat past it holds the rim and lights.
 */
/** The five stats out of the cap. `live`: pointing at a stat, or tapping it, shows its value at its corner. */
function Radar({ values, live }: { values: Record<Stat, number>; live?: boolean }) {
  const [on, setOn] = useState<Stat | null>(null);
  const order: Stat[] = ['STR', 'VIT', 'AGI', 'INT', 'PER'];
  const at = (i: number, r: number) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  };
  const ring = (r: number) => order.map((_, i) => at(i, r).join(',')).join(' ');
  const shape = order.map((k, i) => at(i, 2 + 36 * Math.min(1, Math.max(0, values[k]) / STAT_CAP)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 100 100" class="ia-radar" role="img" aria-label={order.map((k) => `${k} ${Math.round(values[k])}`).join(', ')}>
      {[11, 20, 29, 38].map((r) => <polygon key={r} points={ring(r)} class="ia-radar__ring" />)}
      {order.map((_, i) => { const [x, y] = at(i, 38); return <line key={i} x1="50" y1="50" x2={x} y2={y} class="ia-radar__axis" />; })}
      <polygon points={shape} class="ia-radar__shape" />
      {order.map((k, i) => values[k] >= STAT_CAP && (() => { const [x, y] = at(i, 38); return <circle key={`o${k}`} cx={x} cy={y} r="2.2" class="ia-radar__over" />; })())}
      {order.map((k, i) => { const [x, y] = at(i, 47); return <text key={k} x={x} y={y} class={`ia-radar__label ${values[k] >= STAT_CAP ? 'is-over' : ''} ${on === k ? 'is-on' : ''}`}>{on === k ? `${k} ${Math.round(values[k])}` : k}</text>; })}
      {live && order.map((k, i) => {
        const [px, py] = at(i, 2 + 36 * Math.min(1, Math.max(0, values[k]) / STAT_CAP));
        const [lx, ly] = at(i, 44);
        return (
          <g key={`h${k}`} class={`ia-radar__hit ${on === k ? 'is-on' : ''}`}
            onMouseEnter={() => setOn(k)} onMouseLeave={() => setOn((x) => (x === k ? null : x))} onClick={() => setOn(k)}>
            <title>{`${k} ${Math.round(values[k])}`}</title>
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
  Accuracy: `How often your hits land: your Accuracy against the target’s Evasion, from ${HIT.min}% to ${HIT.max}%. From PER, and a little AGI.`,
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
      <div class="statsheet__radar"><Radar values={total} live /><small class="muted">Scale: 0 to {STAT_CAP} · Tap a stat for its value</small></div>
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

export async function drinkFlow(id: shop.PotionId) {
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
    ? await ask(`drink:${id}`, system.offer([
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
export function openEquipment() {
  openSheet({ title: 'Equipment', system: { icon: null, kind: 'gear' }, render: () => <EquipmentSheet /> });
}

function EquipmentSheet() {
  const s = useSave();
  const ups = gear.upgradeCount(s);
  const offers = gear.offers(s);
  const r = rankOf(s);
  const slot = (k: SlotKey) => {
    const it = gear.equippedIn(s, k);
    const def = gear.SLOTS.find((x) => x.key === k)!;
    const d = it ? gear.defOf(it) : undefined;
    return (
      <button type="button" key={k} class={`sysbox eqslot ${it ? 'is-filled' : ''}`} onClick={() => { sfx.tap(); if (it) openItem(it.id); else openSlot(k); }}
        aria-label={it ? `${def.name}: ${d?.name}` : `${def.name}: empty`}>
        {it ? <GearArt item={it} size={38} /> : <span class="eqslot__ghost"><Glyph name={def.accepts} /></span>}
        <span class="eqslot__text">
          <small>{def.name}</small>
          <b>{d?.name ?? '-- --'}</b>
        </span>
        {!it && offers.includes(k) && <span class="badge badge--gold">+</span>}
      </button>
    );
  };
  return (
    <div class="stack equip">
      <div class="sysfields">
        <Field k="Equipment score" v={<span class="status__level">{Math.round(gear.power(s))}</span>} />
        <Field k="Slots filled" v={`${gear.worn(s).length}/${gear.SLOTS.length}`} />
      </div>
      <div class="eqdoll">
        <div class="eqdoll__col">{gear.SLOTS.filter((x) => x.side === 'l').map((x) => slot(x.key))}</div>
        <div class="sysbox eqdoll__figure" aria-hidden="true">
          <span class="eqdoll__ring" /><span class="eqdoll__ring eqdoll__ring--in" />
          <Glyph name="profile" />
          <Sigil rank={r.key === 'N' ? 'N' : licensedRank(s)} size={26} />
        </div>
        <div class="eqdoll__col">{gear.SLOTS.filter((x) => x.side === 'r').map((x) => slot(x.key))}</div>
      </div>
      <Btn kind={ups ? 'primary' : undefined} block disabled={!ups} onClick={() => { const n = store.update(gear.autoEquip); sfx.success(); buzz([16, 26, 22]); toast(`${n} slot${n === 1 ? '' : 's'} improved.`, 'good'); void checkAwards(); }}>
        Auto Equip{ups ? ` · ${ups}` : ''}
      </Btn>
      <ActiveSets s={s} />
    </div>
  );
}

/** The sets the hunter is wearing two or more pieces of, and what they pay, each in a hairline box. */
function ActiveSets({ s }: { s: Save }) {
  const on = [...gear.setsIn(gear.worn(s))].filter(([, n]) => n >= 2);
  if (!on.length) return null;
  return (
    <Section title="Sets worn">
      <ul class="eqsets" aria-label="Set bonuses">
        {on.map(([id, n]) => {
          const set = setById(id)!;
          return (
            <li key={id} class="sysbox eqsets__one">
              <span><SetMark id={id} /><strong>[Set: {id}]</strong> <span class="num">{n}/{gear.setPieces(id).length}</span></span>
              <span class="grant">{gear.bonusText(gear.sumBonuses(set.two, n >= 3 ? set.three : {}))}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** A set as the item sheet shows it: its pieces, what two and three of them pay, and where they come from. */
function SetBlock({ set, s }: { set: GearSet; s: Save }) {
  const pieces = gear.setPieces(set.id);
  const held = gear.heldOf(s, set.id);
  const worn = gear.setsIn(gear.worn(s)).get(set.id) ?? 0;
  const home = dungeonById(set.home);
  return (
    <Section title={`${set.id} set`} right={`${held.size} of ${pieces.length} held · ${worn} worn`}>
      <ul class="setpieces">
        {pieces.map((p) => <li key={p.id} class={held.has(p.id) ? 'is-held' : ''}><Glyph name={held.has(p.id) ? 'check' : 'unknown'} />{p.name}<small>{p.slot}</small></li>)}
      </ul>
      <div class={`setbonus ${worn >= 2 ? 'is-on' : ''}`}><b>2 worn</b><span>{gear.bonusText(set.two)}</span></div>
      <div class={`setbonus ${worn >= 3 ? 'is-on' : ''}`}><b>3 worn</b><span>{gear.bonusText(set.three)}</span></div>
      {home && <p class="hint">Home Gate: {home.name} ({home.rank}-Rank). Each clear there leaves a piece you do not hold yet.</p>}
    </Section>
  );
}

/** The next upgrade step on a piece: what it raises, and what it costs. */
function UpgradeBlock({ it, s }: { it: Item; s: Save }) {
  const cap = overCap(s);
  const next = gear.upgradeStep(it, cap);
  const cost = shop.upgradeCost(it, cap);
  if (!next || cost === null) {
    const over = it.over ?? 0;
    return <p class="hint">{!ascensionOpen(s) ? 'Perfect. Nothing left to raise.'
      : `Perfect${over ? ` +${over}` : ''}. Each Ascension level opened allows ${OVERCHARGE.per === 1 ? '1 more step' : `${OVERCHARGE.per} more steps`}.`}</p>;
  }
  const short = s.wallet.shards < cost;
  const left = gear.stepsToPerfect(it);
  return (
    <Section title={next.over ? 'Past perfect' : 'Upgrade'} right={left ? `Steps to perfect: ${left}` : it.up ? `${it.up} step${it.up === 1 ? '' : 's'} bought` : 'at the Exchange'}>
      <div class="upgrade">
        <KV k="Quality" v={`${gear.qualityText(it)} → ${gear.qualityText(next)}`} />
        <KV k="Core" v={gear.coreText(next)} />
        {gear.rollText(next).map((t) => <KV key={t} k="Property" v={t} />)}
      </div>
      <Btn kind="gold" disabled={short} onClick={() => {
        if (!store.update((x) => shop.upgrade(x, it.id))) return;
        sfx.success();
        buzz([14, 24]);
        toast(`${gear.defOf(it)?.name} upgraded.`, 'good');
        void checkAwards();
      }}>{short ? `Mana Shards ${s.wallet.shards}/${cost}` : <>Upgrade · <Shards n={cost} /></>}</Btn>
    </Section>
  );
}

export function ItemLine({ it, s, onClick }: { it: Item; s: Save; onClick?: () => void }) {
  const d = gear.defOf(it)!;
  const worn = gear.slotOf(s, it);
  return (
    <button type="button" class="itemrow" onClick={() => { sfx.tap(); onClick?.(); }}>
      <GearArt item={it} size={44} equipped={!!worn} />
      <span class="itemrow__text">
        <b>{d.name} {s.favourites.includes(it.id) && <Glyph name="star" class="fav" />}{gear.beatsWorn(s, it) && <span class="up" title="Better than what you are wearing">▲</span>}</b>
        <small>{gear.coreText(it)}</small>
        <small class="muted">{gear.RARITY[d.rank].name} · {d.slot} · Score {Math.round(gear.score(it))}{d.set ? ` · ${d.set} set` : ''}{it.master ? ' · masterwork' : ''}{it.up ? ` · upgraded ${it.up}` : ''}</small>
      </span>
    </button>
  );
}

/** One square of the Inventory: the item's icon, framed by its grade, and nothing else. */
function ItemTile({ it, s }: { it: Item; s: Save }) {
  const d = gear.defOf(it)!;
  const worn = gear.slotOf(s, it);
  const up = gear.beatsWorn(s, it);
  return (
    <button type="button" class="invtile" onClick={() => { sfx.tap(); openItem(it.id); }}
      aria-label={`${d.name}, ${gear.RARITY[d.rank].name} ${d.slot}, score ${Math.round(gear.score(it))}${worn ? ', worn' : ''}${up ? ', better than what you are wearing' : ''}`}>
      <GearArt item={it} size={60} equipped={!!worn} />
      {s.favourites.includes(it.id) && <Glyph name="star" class="invtile__fav" />}
      {up && <span class="invtile__up" aria-hidden="true">▲</span>}
    </button>
  );
}

/** INVENTORY: everything the hunter holds, best first, under a tab for each slot. */
export function openInventory() {
  openSheet({ title: 'Inventory', system: { icon: null, kind: 'gear' }, render: () => <ItemGrid /> });
}

/** Everything the hunter holds, best first, under a tab for each slot. */
function ItemGrid() {
  const s = useSave();
  const [f, setF] = useState('All');
  const types = ['All', 'Weapon', 'Off-Hand', 'Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Amulet', 'Ring'];
  const list = s.items.filter((it) => f === 'All' || gear.defOf(it)?.slot === f).sort((a, b) => gear.score(b) - gear.score(a));
  return (
    <div class="stack">
      <div class="chips invtabs" role="tablist">{types.map((t) => <Chip key={t} on={f === t} onClick={() => setF(t)}>{t === 'All' ? `All · ${s.items.length}` : t}</Chip>)}</div>
      {!list.length && <Empty>{s.items.length ? 'Nothing matches that filter.' : 'No items yet.'}</Empty>}
      {list.length > 0 && <div class="invgrid">{list.map((it) => <ItemTile key={it.id} it={it} s={s} />)}</div>}
      <small class="muted">Designs discovered: {s.found.length}/{gear.ALL_GEAR.length + gear.ISSUED.length}</small>
      {s.items.length >= 6 && <Btn kind="ghost" size="sm" onClick={openRecycle}>Recycle Items</Btn>}
    </div>
  );
}

export function openItem(id: string) {
  const at = store.get().items.find((x) => x.id === id);
  const named = at ? gear.defOf(at) : undefined;
  const close = openSheet({
    title: `Item: ${named?.name ?? 'Unknown'}`,
    system: { icon: at ? <GearArt item={at} size={58} /> : null },
    render: () => {
      const s = store.get();
      const it = s.items.find((x) => x.id === id);
      if (!it) return <Empty>That item is gone.</Empty>;
      const d = gear.defOf(it)!;
      const worn = gear.slotOf(s, it);
      const tag = gear.rollTag(it);
      return (
        <div class="stack itemsheet">
          <div class="sysfields">
            <Field k="Acquisition difficulty" v={`${d.rank}-Rank`} />
            <Field k="Category" v={d.slot} />
            <Field k="Rarity" v={gear.RARITY[d.rank].name} />
            <Field k="Quality" v={d.issued ? 'Issued' : gear.qualityText(it)} />
            <Field k="Score" v={Math.round(gear.score(it))} />
            <Field k="Set" v={d.set ? <><SetMark id={d.set} />{d.set}</> : '-- --'} />
          </div>
          {d.desc && <p class="itemsheet__text">{d.desc}</p>}
          <ul class="sysstats">
            {gear.coreLines(it).map(([k, t]) => <li key={k} class="sysstat"><Glyph name={STAT_ICON[k]} />{t}</li>)}
            {gear.rollText(it).map((t) => <li key={t} class="sysstat"><Glyph name="plus" />{t}</li>)}
          </ul>
          {(worn || it.master || tag) && (
            <p class="itemsheet__tags">
              {worn && <span>Worn</span>}
              {it.master && <span class="hint">Masterwork of {walkerOf(it.master, d.rank).name}</span>}
              {tag && <span class={tag === 'dead' ? 'warn' : 'hint'}>{tag === 'perfect' ? `✦ Perfect${it.over ? ` +${it.over}` : ''}` : tag === 'peak' ? '✧ Perfect quality' : '✕ Dead roll'}</span>}
            </p>
          )}
          {!d.issued && <UpgradeBlock it={it} s={s} />}
          {d.set && setById(d.set) && <SetBlock set={setById(d.set)!} s={s} />}
          <div class="row">
            <Btn kind="primary" class="grow" sound="success" onClick={() => { store.update((x) => (worn ? gear.unequip(x, worn) : gear.equip(x, it.id))); toast(`${d.name} ${worn ? 'stowed' : 'equipped'}.`, 'xp'); void checkAwards(); }}>{worn ? 'Unequip' : 'Equip'}</Btn>
            <IconBtn icon="star" on={s.favourites.includes(it.id)} label={s.favourites.includes(it.id) ? 'Unstar' : 'Star (protects from bulk recycle)'} onClick={() => store.update((x) => gear.toggleFav(x, it.id))} />
          </div>
          {!d.issued && !worn && (
            <Btn kind="ghost" onClick={async () => {
              const v = shop.scrapValue(it);
              if (!(await confirm('Recycle Item', `Break <em>${d.name}</em> down for <strong>${v} Mana Shards</strong>?`, 'Recycle', true))) return;
              store.update((x) => shop.recycle(x, it.id));
              toast(`${d.name} recycled · Mana Shards +${v}`, 'xp');
              close();
            }}>Recycle · <Shards n={shop.scrapValue(it)} /></Btn>
          )}
        </div>
      );
    },
  });
}

function openSlot(k: SlotKey) {
  const slot = gear.SLOTS.find((x) => x.key === k)!;
  const close = openSheet({
    title: `Equipment: ${slot.name}`, system: { icon: <Glyph name={slot.accepts} />, kind: 'gear' }, render: () => {
      const s = store.get();
      const list = s.items.filter((it) => gear.defOf(it)?.slot === slot.accepts && !gear.slotOf(s, it)).sort((a, b) => gear.score(b) - gear.score(a));
      if (!list.length) return <Empty>Items held: 0</Empty>;
      return <div class="stack stack--tight">{list.map((it) => <ItemLine key={it.id} it={it} s={s} onClick={() => { store.update((x) => gear.equip(x, it.id, k)); sfx.success(); toast(`${gear.defOf(it)?.name} equipped.`, 'xp'); close(); void checkAwards(); }} />)}</div>;
    },
  });
}

function openRecycle() {
  let ranks = ['E'];
  const close = openSheet({
    title: 'Inventory', system: { icon: null, kind: 'gear' }, render: () => <Recycle initial={ranks} onChange={(r) => { ranks = r; }} onDone={close} />,
  });
}

function Recycle({ initial, onChange, onDone }: { initial: string[]; onChange: (r: string[]) => void; onDone: () => void }) {
  const s = useSave();
  const [ranks, setRanks] = useState(initial);
  const matches = shop.scrapMatches(s, ranks);
  const worth = matches.reduce((n, it) => n + shop.scrapValue(it), 0);
  return (
    <div class="stack">
      <p class="questinfo__name"><strong>[Recycle]</strong></p>
      <small class="muted">Worn, issued and starred items are kept.</small>
      <div class="chips">{(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((r) => <Chip key={r} on={ranks.includes(r)} tone={`rank-${r}`} onClick={() => { const n = ranks.includes(r) ? ranks.filter((x) => x !== r) : [...ranks, r]; setRanks(n); onChange(n); }}>{gear.RARITY[r].name}</Chip>)}</div>
      <div class="sysfields">
        <Field k="Items" v={matches.length} />
        <Field k="Mana Shards" v={<span class="grant">+{group(worth)}</span>} />
      </div>
      <Btn kind="danger" block disabled={!matches.length} onClick={async () => {
        if (!(await confirm('Recycle Items', `Break down <strong>${matches.length}</strong> items for <strong>${worth}</strong> shards? There is no way to get them back.`, `Recycle ${matches.length}`, true))) return;
        const r = store.update((x) => shop.recycleAll(x, ranks));
        toast(`${r.count} items recycled · Mana Shards +${r.paid}`, 'xp');
        onDone();
      }}>Recycle {matches.length}</Btn>
    </div>
  );
}

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
              <Field k="Creatures felled" v={group(felled)} />
              <Field k="Shadows bound" v={`${s.shadows.army.length} · ${s.stats.extractionsWon}/${s.stats.extractions}`} />
              <Field k="Experience" v={group(s.stats.xpTotal)} />
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
