/**
 * The Forge, in the System's frame: every blueprint known, a row to each, saying whether everything
 * its recipe asks for is held; the recipe of one (`BLUEPRINT: {name}`), its rolls, the familiarity a
 * weapon has earned, its materials held over needed and the Forge button; and every material held.
 * Forging turns the new piece over where the hunter can see it, beside the others of its design, so a
 * poor roll can go straight back to the Forge. Every number comes from `core/forge.ts`.
 */
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { checkAwards } from '@/app/flow';
import * as forge from '@/core/forge';
import * as gear from '@/core/gear';
import type { GearDef, Item, Rank, Save } from '@/core/types';
import { RANKS, STATS } from '@/core/types';
import { group } from '@/core/util';
import { setById } from '@/data/sets';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Empty, GearArt, Section, SetMark, Shards } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { CostGrid, MatArt, TrackMark, bundleText, track } from '@/ui/forge';
import { Glyph, Shard, STAT_ICON } from '@/ui/icons';
import { LootCell, useReveal } from '@/ui/loot';
import { openSheet, sys, toast } from '@/ui/overlays';
import * as system from '@/ui/system';
import { openItem, PieceHero, PieceLink, SetCard } from './Gear';

const rarity = (r: string) => gear.RARITY[r as Rank]?.name ?? r;
const KINDS = ['Weapon', 'Off-Hand', 'Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Amulet', 'Ring'] as const;
const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');

type View = 'blueprints' | 'materials';

/** FORGE: the blueprints known and the materials held. */
export function openForge(view: View = 'blueprints') {
  openSheet({ title: 'Forge', system: { icon: null, kind: 'gear' }, render: () => <Forge initial={view} /> });
}

function Forge({ initial }: { initial: View }) {
  const s = useSave();
  const [view, setView] = useState<View>(initial);
  const known = forge.FORGEABLE.filter((d) => forge.knows(s, d.id));
  const ready = known.filter((d) => forge.canForge(s, d)).length;
  const better = forge.betterForges(s).length;
  const kinds = forge.allMaterials().filter((m) => forge.held(s, m.id) > 0).length;
  return (
    <div class="stack forgeview">
      {/* The hearth, after the smithies of Monster Hunter and the Foundry of Warframe: the fire, what it can make now, and what of that beats what is worn. */}
      <section class={`forgehearth ${better ? 'is-call' : ''}`} aria-label={`Forge: ${ready} can be forged${better ? `, ${better} better than what is worn` : ''}`}>
        <span class="forgehearth__fire" aria-hidden="true">
          <i class="forgehearth__coals" /><i class="forgehearth__glow" /><Glyph name="forge" />
          {[0, 1, 2, 3, 4].map((i) => <i key={i} class="forgehearth__spark" style={`--k: ${i}`} />)}
        </span>
        <span class="forgehearth__main"><b class="num">{ready}</b><small class="label">Can forge</small></span>
        <span class="forgehearth__facts">
          <span class={better ? 'is-gold' : ''}><b class="num">{better}</b><small>Better</small></span>
          <span><b class="num">{known.length}</b><small>Blueprints</small></span>
          <span><b class="num">{kinds}</b><small>Materials</small></span>
        </span>
        <span class="forgehearth__shards"><Shards n={s.wallet.shards} /></span>
      </section>
      <div class="seg bag__views" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'blueprints'} class={`seg__btn ${view === 'blueprints' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('blueprints'); }}>Blueprints · {known.length}</button>
        <button type="button" role="tab" aria-selected={view === 'materials'} class={`seg__btn ${view === 'materials' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('materials'); }}>Materials · {kinds}</button>
      </div>
      {view === 'blueprints' ? <Blueprints /> : <Materials />}
    </div>
  );
}

// ------------------------------------------------------------------ blueprints

type Only = 'ready' | 'better' | 'sets';
const SHOW: { key: Only | null; name: string }[] = [
  { key: null, name: 'All' }, { key: 'ready', name: 'Can forge' }, { key: 'better', name: 'Better' }, { key: 'sets', name: 'Set pieces' },
];

function Blueprints() {
  const s = useSave();
  const [kind, setKind] = useState<string>('All');
  const [only, setOnly] = useState<Only | null>(null);
  const known = forge.FORGEABLE.filter((d) => forge.knows(s, d.id));
  const better = new Set(forge.betterForges(s).map((d) => d.id));
  const list = known.filter((d) => (kind === 'All' || d.slot === kind)
    && (only !== 'ready' || forge.canForge(s, d)) && (only !== 'better' || better.has(d.id)) && (only !== 'sets' || !!d.set));
  const count = (k: string) => known.filter((d) => d.slot === k).length;
  return (
    <div class="stack">
      <div class="bagkinds" role="tablist" aria-label="Kind">
        {['All', ...KINDS].map((k) => (
          <button type="button" key={k} role="tab" aria-selected={kind === k} aria-label={k} title={k} class={`sysbox bagkind ${kind === k ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setKind(k); }}>
            {k === 'All' ? <Glyph name="blueprint" /> : <Glyph name={k} />}
            <small class="num">{k === 'All' ? known.length : count(k)}</small>
          </button>
        ))}
      </div>
      <div class="forgefilter" role="radiogroup" aria-label="Show">
        {SHOW.map((o) => (
          <button type="button" key={o.name} role="radio" aria-checked={only === o.key} class={`forgefilter__opt ${only === o.key ? 'is-on' : ''} ${o.key === 'better' && better.size ? 'is-gold' : ''}`}
            onClick={() => { sfx.tap(); setOnly(o.key); }}>
            {o.name}{o.key === 'better' && better.size > 0 && <b class="num">{better.size}</b>}
          </button>
        ))}
      </div>
      {!list.length && <Empty>{known.length ? 'Nothing matches.' : 'Blueprints known: 0'}</Empty>}
      {[...RANKS].reverse().map((r) => {
        const of = list.filter((d) => d.rank === r).sort((a, b) => Number(better.has(b.id)) - Number(better.has(a.id)) || Number(forge.canForge(s, b)) - Number(forge.canForge(s, a)) || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
        if (!of.length) return null;
        return (
          <Section key={r} title={rarity(r)} right={<span class="num">{of.filter((d) => forge.canForge(s, d)).length}/{of.length}</span>}>
            <div class="stack stack--tight">{of.map((d) => <BlueprintRow key={d.id} d={d} better={better.has(d.id)} />)}</div>
          </Section>
        );
      })}
    </div>
  );
}

/**
 * A blueprint, as the Forge lists it: its art, its name and kind, a chip to each thing its recipe asks for
 * (a tick when enough is held, held over needed in red when not, the shards last), a weapon's familiarity,
 * and `Better` in gold where it is rarer than what is worn where it goes.
 */
function BlueprintRow({ d, better }: { d: GearDef; better: boolean }) {
  const s = useSave();
  const cost = forge.recipe(d);
  const ok = forge.affords(s, cost);
  const f = d.slot === 'Weapon' ? forge.familiarityRank(s, d.id) : 0;
  const made = s.items.filter((x) => x.defId === d.id).length;
  const lines = forge.lines(s, cost);
  const rich = s.wallet.shards >= cost.shards;
  return (
    <button type="button" class={`sysbox bprow ${ok ? 'is-ready' : ''} ${better ? 'is-better' : ''}`} data-rarity={d.rank} onClick={() => { sfx.tap(); openBlueprint(d.id); }}
      aria-label={`${d.name}, ${rarity(d.rank)} ${d.slot}${ok ? ', can forge' : ', materials missing'}${better ? ', better than what is worn' : ''}`}>
      <span class="bprow__art"><GearArt defId={d.id} size={48} /></span>
      <span class="bprow__text">
        <b>{d.name}</b>
        <small>{rarity(d.rank)} {d.slot}{made ? ` · Held: ${made}` : ''}</small>
        <span class="bprow__mats" aria-hidden="true">
          {lines.map((x) => (
            <span key={x.id} class={`bprow__mat ${x.have >= x.need ? 'is-ok' : 'is-short'}`}>
              <MatArt id={x.id} size={20} />
              {x.have >= x.need ? <Glyph name="check" /> : <small class="num">{x.have}/{x.need}</small>}
            </span>
          ))}
          <span class={`bprow__mat is-shards ${rich ? 'is-ok' : 'is-short'}`}><Shard size={12} /><small class="num">{group(cost.shards)}</small></span>
        </span>
      </span>
      <span class="bprow__side">
        {better && <span class="bprow__better">▲ Better</span>}
        {d.slot === 'Weapon' && <Pips n={f} />}
        <Glyph name="chevron" class="bprow__go" />
      </span>
    </button>
  );
}

/** Familiarity as pips, filled to its rank. */
function Pips({ n }: { n: number }) {
  return (
    <span class="fampips" aria-label={`Familiarity ${n} of ${forge.FAMILIARITY_MAX}`}>
      {Array.from({ length: forge.FAMILIARITY_MAX }, (_, i) => <i key={i} class={i < n ? 'is-on' : ''} />)}
    </span>
  );
}

// ------------------------------------------------------------------ one blueprint

/** BLUEPRINT: one design's recipe, on its own sheet. */
export function openBlueprint(defId: string) {
  const d = gear.gearDef(defId);
  openSheet({
    title: `Blueprint: ${d?.name ?? 'Unknown'}`,
    system: { icon: null, kind: 'gear' },
    render: () => <Recipe defId={defId} />,
  });
}

/** The worn piece a design would take the place of: what is worn where it goes, the weaker for a ring. */
function wornFor(s: Save, d: GearDef): Item | null {
  const on = gear.SLOTS.filter((x) => x.accepts === d.slot).map((x) => gear.equippedIn(s, x.key)).filter((x): x is Item => !!x);
  return on.sort((a, b) => gear.score(a) - gear.score(b))[0] ?? null;
}

function Recipe({ defId }: { defId: string }) {
  const s = useSave();
  const d = gear.gearDef(defId)!;
  const [fresh, setFresh] = useState<string[]>([]);
  const [strikes, setStrikes] = useState(0);
  const known = forge.knows(s, d.id);
  const cost = forge.recipe(d);
  const ok = forge.affords(s, cost);
  const floor = forge.floorOf(s, d.id);
  const qLo = gear.Q_LOW + (gear.Q_HIGH - gear.Q_LOW) * floor;
  const base = gear.RARITY[d.rank as Rank].score;
  const worn = wornFor(s, d);
  const set = d.set ? setById(d.set) : undefined;
  const mine = s.items.filter((x) => x.defId === d.id).slice().reverse();
  const go = () => {
    const it = store.update((x) => forge.forge(x, d.id));
    if (!it) return;
    buzz([18, 40, 26]);
    setStrikes((n) => n + 1);
    setFresh((f) => [it.id, ...f]);
    void checkAwards();
  };
  return (
    <div class="stack itemcard recipe" data-rarity={d.rank}>
      <PieceHero d={d} art={<GearArt defId={d.id} size={104} />}
        tags={<>
          <span class="itag is-blueprint"><Glyph name="blueprint" />{known ? 'Blueprint' : 'Blueprint not known'}</span>
          {d.set && <span class="itag is-set" style={`--set-h: ${gear.setHue(d.set)}`}><SetMark id={d.set} />{d.set}</span>}
        </>}
        score={<b class="num" aria-label={`${Math.round(base * qLo)} to ${Math.round(base * gear.Q_HIGH)}`}>{Math.round(base * qLo)}-{Math.round(base * gear.Q_HIGH)}</b>} />
      {worn && <PieceLink it={worn} label="Worn" />}
      <section class="sysbox piecepanel">
        <span class="piecepanel__head"><span class="label">Stats</span><small class="num">Quality {Math.round(floor * 100)}-100%</small></span>
        <ul class="itemstats">
          {STATS.filter((k) => d.core[k]).map((k) => (
            <li key={k}><Glyph name={STAT_ICON[k]} /><span>{k} +{fmt((d.core[k] ?? 0) * qLo)}-{fmt((d.core[k] ?? 0) * gear.Q_HIGH)}</span></li>
          ))}
        </ul>
        {(d.rolls ?? []).length > 0 && (
          <>
            <span class="label">Properties</span>
            <ul class="itemrolls is-range">
              {(d.rolls ?? []).map((r) => (
                <li key={r.stat}>
                  <span class="itemrolls__name">{gear.rollName(r.stat)}</span>
                  <b class="num">+{fmt(r.min + (r.max - r.min) * floor)}-{r.max}{r.pct ? '%' : ''}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {d.slot === 'Weapon' && <Familiarity defId={d.id} />}
      {set && (
        <Section title={`Set: ${set.id}`}>
          <SetCard set={set} compact />
        </Section>
      )}
      <section class={`sysbox forgealtar ${ok && known ? 'is-ready' : ''}`} data-rarity={d.rank}>
        <span class="forgealtar__head"><span class="label">Required materials</span><Shards n={cost.shards} /></span>
        <CostGrid s={s} c={cost} />
        <TrackMissing c={cost} />
        <QualityRange from={Math.round(floor * 100)} last={fresh[0] ? s.items.find((x) => x.id === fresh[0]) : undefined} />
        {fresh.length > 0 && (
          <div class="haul recipe__fresh">{fresh.slice(0, 1).map((id) => <Forged key={id} id={id} />)}</div>
        )}
        <span class="forgealtar__burst" key={strikes} aria-hidden="true">{strikes > 0 && <>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} style={`--k: ${i}`} />)}</>}</span>
        <Btn kind="gold" block class="forgebtn" disabled={!known || !ok} sound="success" onClick={go}>
          {!known ? 'Blueprint not known' : ok ? <><Glyph name="forge" /> Forge · <Shards n={cost.shards} /></> : s.wallet.shards < cost.shards ? `Mana Shards ${group(s.wallet.shards)}/${group(cost.shards)}` : 'Materials missing'}
        </Btn>
      </section>
      {mine.length > 0 && (
        <Section title="Held" right={<span class="num">{mine.length}</span>}>
          <div class="stack stack--tight">{mine.map((it) => <HeldRow key={it.id} it={it} />)}</div>
        </Section>
      )}
    </div>
  );
}

/**
 * Track every material the recipe is short of in one tap, so the board marks every Gate that leaves
 * one; once they all are, the same button stops tracking them. Nothing short, no button.
 */
function TrackMissing({ c }: { c: forge.Cost }) {
  const s = useSave();
  const short = forge.missing(s, c);
  if (!short.length) return null;
  const all = short.every((id) => forge.isTracked(s, id));
  const go = () => {
    const on = store.update((x) => forge.trackMissing(x, c));
    sfx.tap();
    buzz(on ? [10, 20, 14] : 8);
    toast(`${on ? 'Tracking' : 'No longer tracking'}: ${short.map((id) => forge.materialById(id)?.name ?? id).join(', ')}`, on ? 'good' : 'xp');
  };
  return (
    <Btn kind="ghost" size="sm" block class={`trackall ${all ? 'is-on' : ''}`} onClick={go}>
      <Glyph name="forge" /> {all ? 'Stop Tracking' : `Track Missing · ${short.length}`}
    </Btn>
  );
}

/**
 * The quality a forged piece of the design can roll, as a bar from 0 to 100: the floor familiarity has
 * raised it to shaded off, and where the piece just forged landed marked on it.
 */
function QualityRange({ from, last }: { from: number; last?: Item }) {
  const q = last ? gear.quality(last) : null;
  return (
    <div class="qrange" aria-label={`Quality ${from} to 100%${q !== null ? `. The piece just forged: ${q}%` : ''}`}>
      <span class="qrange__head"><span class="label">Quality</span><b class="num">{from}-100%</b></span>
      <span class="qrange__bar" aria-hidden="true">
        {from > 0 && <i class="qrange__floor" style={`width: ${from}%`} />}
        <i class="qrange__span" style={`left: ${from}%`} />
        {[25, 50, 75].map((m) => <span key={m} class="qrange__tick" style={`left: ${m}%`} />)}
        {q !== null && <span class="qrange__mark" style={`left: ${q}%`}><b class="num">{q}%</b></span>}
      </span>
      {from > 0 && <small>Familiarity holds every roll at {from}% or better.</small>}
    </div>
  );
}

/** A piece just forged, turned over by its grade where the Forge button is. */
function Forged({ id }: { id: string }) {
  const s = useSave();
  const it = s.items.find((x) => x.id === id);
  const [loot] = useState(() => (it ? [{ item: it }] : []));
  const turn = useReveal(loot);
  useEffect(() => { if (loot.length) turn.reveal(0); }, []);
  if (!it) return null;
  return (
    <div class={`recipe__reveal ${turn.quake ? 'is-quake' : ''}`}>
      {turn.flash}
      <LootCell loot={loot[0]} i={0} state={turn.stateOf(0)} onTap={() => turn.reveal(0)} onOpen={() => { sfx.tap(); openItem(it.id); }} />
      {turn.stateOf(0) === 'open' && <b class="num recipe__q">Quality {gear.qualityText(it)}</b>}
    </div>
  );
}

/** A piece of this design held: its quality, and a way back to the Forge for a poor one. */
function HeldRow({ it }: { it: Item }) {
  const s = useSave();
  const worn = !!gear.slotOf(s, it);
  const starred = s.favourites.includes(it.id);
  const back = forge.salvage(it);
  const recycle = async () => {
    const okay = await sys(system.offer([
      'Would you like to recycle this item?',
      `${system.tag(gear.defOf(it)!.name, 'Item')} Quality ${gear.qualityText(it)}`,
      system.gain(bundleText(back)),
      system.red('A recycled item cannot be recovered.'),
    ], 'gear', 'Recycle', 'Cancel'));
    if (okay !== true) return;
    const got = store.update((x) => forge.recycle(x, it.id));
    if (!got) return;
    sfx.success();
    toast(`Recycled · ${bundleText(got)}`, 'good');
  };
  return (
    <div class="sysbox heldrow" data-rarity={gear.defOf(it)?.rank}>
      <button type="button" class="heldrow__open" onClick={() => { sfx.tap(); openItem(it.id); }}>
        <GearArt item={it} size={40} equipped={worn} />
        <span class="heldrow__text">
          <b class="num">Quality {gear.qualityText(it)}</b>
          <i class="heldrow__q" aria-hidden="true"><i style={`width: ${gear.quality(it)}%`} /></i>
        </span>
      </button>
      {!worn && !starred
        ? <Btn size="sm" kind="ghost" onClick={() => void recycle()}><Glyph name="trash" /> Recycle</Btn>
        : <small class="muted">{worn ? 'Worn' : 'Starred'}</small>}
    </div>
  );
}

/** A weapon design's familiarity: its rank, the points to the next, what it adds, and how far it lifts a forged roll. */
export function Familiarity({ defId }: { defId: string }) {
  const s = useSave();
  const f = forge.familiarity(s, defId);
  const share = f.next ? (f.points - f.from) / Math.max(1, f.next - f.from) : 1;
  const bonus = Math.round(forge.FAMILIARITY.bonus * f.rank * 100);
  return (
    <Section title="Familiarity" right={<span class="num">{f.rank}/{forge.FAMILIARITY_MAX}</span>}>
      <div class="sysbox famcard">
        <Pips n={f.rank} />
        <i class="famcard__bar" aria-hidden="true"><i style={`width: ${Math.round(share * 100)}%`} /></i>
        <small class="num">{f.next ? `Familiarity points: ${group(f.points)}/${group(f.next)}` : `Familiarity points: ${group(f.points)}`}</small>
        <small>Attack and magic <b class="num grant">+{bonus}%</b> · Forged quality from <b class="num grant">{Math.round(forge.floorOf(s, defId) * 100)}%</b></small>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ materials

function Materials() {
  const s = useSave();
  const [sel, setSel] = useState<string | null>(null);
  const all = forge.allMaterials();
  const group1 = (k: string) => all.filter((m) => m.kind === k);
  const trophies = group1('trophy');
  const heldTrophies = trophies.filter((m) => forge.held(s, m.id) > 0 || forge.isTracked(s, m.id));
  const tiles = (list: typeof all) => (
    <div class="matgrid">
      {list.map((m) => {
        const n = forge.held(s, m.id);
        const on = forge.isTracked(s, m.id);
        return (
          <button type="button" key={m.id} class={`sysbox mattile ${n ? '' : 'is-none'} ${on ? 'is-tracked' : ''} ${sel === m.id ? 'is-on' : ''}`} data-rarity={m.rank}
            aria-pressed={sel === m.id} aria-label={`${m.name}: ${n}${on ? ', tracked' : ''}`} onClick={() => { sfx.tap(); setSel(sel === m.id ? null : m.id); }}>
            {on && <TrackMark class="mattile__track" />}
            <MatArt id={m.id} size={42} />
            <b class="num">{group(n)}</b>
            <small>{m.name}</small>
          </button>
        );
      })}
    </div>
  );
  return (
    <div class="stack matview">
      <Section title="Alloys" right={<span class="num">{group1('alloy').filter((m) => forge.held(s, m.id)).length}/{group1('alloy').length}</span>}>{tiles(group1('alloy'))}</Section>
      <Section title="Parts" right={<span class="num">{group1('part').filter((m) => forge.held(s, m.id)).length}/{group1('part').length}</span>}>{tiles(group1('part'))}</Section>
      <Section title="Trophies" right={<span class="num">{heldTrophies.length}/{trophies.length}</span>}>
        {heldTrophies.length ? tiles(heldTrophies) : <Empty>Trophies held: 0</Empty>}
      </Section>
      {(forge.held(s, forge.EMBER.id) > 0 || s.ascension.unlocked > 0) && <Section title="Ascension">{tiles([forge.EMBER])}</Section>}
      {sel && <MatPeek id={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

/**
 * The dock at the foot of the Materials view: the material tapped, its line, how many are held, how many
 * of the blueprints known ask for it, and Track, which marks every Gate on the board that leaves it.
 */
function MatPeek({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useSave();
  const m = forge.materialById(id);
  if (!m) return null;
  const on = forge.isTracked(s, id);
  const wanted = forge.FORGEABLE.filter((d) => forge.knows(s, d.id) && (forge.recipe(d).mats[id] ?? 0) > 0);
  const short = wanted.filter((d) => forge.held(s, id) < (forge.recipe(d).mats[id] ?? 0)).length;
  return (
    <div class="sysbox matpeek" data-rarity={m.rank} role="region" aria-label={m.name}>
      <MatArt id={id} size={52} />
      <span class="matpeek__text">
        <b>{m.name}{on && <TrackMark class="matpeek__track" />}</b>
        <small>{m.desc}</small>
        <span class="matpeek__facts">
          <span><small>Held</small><b class="num">{group(forge.held(s, id))}</b></span>
          <span><small>Blueprints</small><b class="num">{wanted.length}</b></span>
          {short > 0 && <span class="is-short"><small>Short for</small><b class="num">{short}</b></span>}
        </span>
      </span>
      <span class="matpeek__acts">
        <Btn size="sm" kind={on ? 'ghost' : 'primary'} class="grow" onClick={() => track(id)}><Glyph name="forge" /> {on ? 'Stop Tracking' : 'Track'}</Btn>
        <button type="button" class="bagpeek__close" aria-label="Close" onClick={() => { sfx.tap(); onClose(); }}><Glyph name="close" /></button>
      </span>
    </div>
  );
}
