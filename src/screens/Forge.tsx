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
import { Btn, Empty, GearArt, RankPlate, Section, SetMark, Shards } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { CostGrid, MatArt, TrackMark, bundleText, track } from '@/ui/forge';
import { Glyph, STAT_ICON } from '@/ui/icons';
import { LootCell, useReveal } from '@/ui/loot';
import { openSheet, sys, toast } from '@/ui/overlays';
import * as system from '@/ui/system';
import { openItem, SetCard } from './Gear';

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
  const kinds = forge.allMaterials().filter((m) => forge.held(s, m.id) > 0).length;
  return (
    <div class="stack bag forgeview">
      <div class="bag__head">
        <span><b class="num">{known.length}</b><small>Blueprints</small></span>
        <span class={ready ? 'is-new' : ''}><b class="num">{ready}</b><small>Can forge</small></span>
        <span><b class="num">{kinds}</b><small>Materials</small></span>
        <span><b class="num"><Shards n={s.wallet.shards} /></b><small>Mana Shards</small></span>
      </div>
      <div class="seg bag__views" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={view === 'blueprints'} class={`seg__btn ${view === 'blueprints' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('blueprints'); }}>Blueprints · {known.length}</button>
        <button type="button" role="tab" aria-selected={view === 'materials'} class={`seg__btn ${view === 'materials' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setView('materials'); }}>Materials</button>
      </div>
      {view === 'blueprints' ? <Blueprints /> : <Materials />}
    </div>
  );
}

// ------------------------------------------------------------------ blueprints

function Blueprints() {
  const s = useSave();
  const [kind, setKind] = useState<string>('All');
  const [only, setOnly] = useState<'ready' | 'sets' | null>(null);
  const known = forge.FORGEABLE.filter((d) => forge.knows(s, d.id));
  const list = known.filter((d) => (kind === 'All' || d.slot === kind) && (only !== 'ready' || forge.canForge(s, d)) && (only !== 'sets' || !!d.set));
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
      <div class="bagtools">
        <div class="bagtools__row">
          {([['ready', 'Can forge'], ['sets', 'Set pieces']] as const).map(([k, name]) => (
            <button type="button" key={k} aria-pressed={only === k} class={`sysbox bagtools__only ${only === k ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setOnly(only === k ? null : k); }}>{name}</button>
          ))}
        </div>
      </div>
      {!list.length && <Empty>{known.length ? 'Nothing matches.' : 'Blueprints known: 0'}</Empty>}
      {[...RANKS].reverse().map((r) => {
        const of = list.filter((d) => d.rank === r).sort((a, b) => Number(forge.canForge(s, b)) - Number(forge.canForge(s, a)) || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
        if (!of.length) return null;
        return (
          <Section key={r} title={rarity(r)} right={<span class="num">{of.length}</span>}>
            <div class="stack stack--tight">{of.map((d) => <BlueprintRow key={d.id} d={d} />)}</div>
          </Section>
        );
      })}
    </div>
  );
}

/** A blueprint, as the Forge lists it: its art, name and kind, and whether its materials are all held. */
function BlueprintRow({ d }: { d: GearDef }) {
  const s = useSave();
  const ok = forge.affords(s, forge.recipe(d));
  const f = d.slot === 'Weapon' ? forge.familiarityRank(s, d.id) : 0;
  const made = s.items.filter((x) => x.defId === d.id).length;
  return (
    <button type="button" class={`sysbox bprow ${ok ? 'is-ready' : ''}`} data-rarity={d.rank} onClick={() => { sfx.tap(); openBlueprint(d.id); }}>
      <GearArt defId={d.id} size={44} />
      <span class="bprow__text">
        <b>{d.name}</b>
        <small class="muted">{rarity(d.rank)} {d.slot}{d.set ? ` · ${d.set}` : ''}{made ? ` · Held: ${made}` : ''}</small>
        <small class={ok ? 'bprow__ok' : 'bprow__short'}>{ok ? 'All materials held' : 'Materials missing'}</small>
      </span>
      {d.slot === 'Weapon' && <Pips n={f} />}
      <Glyph name="chevron" class="bprow__go" />
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
    system: { icon: d ? <GearArt defId={defId} size={58} /> : null, kind: 'gear' },
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
    setFresh((f) => [it.id, ...f]);
    void checkAwards();
  };
  return (
    <div class="stack itemcard recipe" data-rarity={d.rank}>
      <section class="sysbox itemhero">
        <span class="itemhero__art"><GearArt defId={d.id} size={92} /></span>
        <div class="itemhero__who">
          <span class="itemhero__kind"><RankPlate rank={d.rank} size={18} />{rarity(d.rank)} {d.slot}</span>
          <span class="itemhero__tags">
            <span class="itag is-blueprint"><Glyph name="blueprint" />{known ? 'Blueprint' : 'Blueprint not known'}</span>
            {d.set && <span class="itag is-set" style={`--set-h: ${gear.setHue(d.set)}`}><SetMark id={d.set} />{d.set}</span>}
          </span>
          <span class="itemhero__score">
            <span class="label">Score</span><b class="num" aria-label={`${Math.round(base * qLo)} to ${Math.round(base * gear.Q_HIGH)}`}>{Math.round(base * qLo)}-{Math.round(base * gear.Q_HIGH)}</b>
          </span>
        </div>
      </section>
      {worn && (
        <button type="button" class="sysbox itemvs" onClick={() => { sfx.tap(); openItem(worn.id); }}>
          <span class="label">Worn</span>
          <GearArt item={worn} size={30} />
          <span class="itemvs__name">{gear.defOf(worn)?.name}</span>
          <span class="num">{Math.round(gear.score(worn))}</span>
        </button>
      )}
      <Section title="Stats" right={<span class="num">Quality {Math.round(floor * 100)}% to 100%</span>}>
        <ul class="itemstats">
          {STATS.filter((k) => d.core[k]).map((k) => (
            <li key={k}><Glyph name={STAT_ICON[k]} /><span>{k} +{fmt((d.core[k] ?? 0) * qLo)} to +{fmt((d.core[k] ?? 0) * gear.Q_HIGH)}</span></li>
          ))}
        </ul>
      </Section>
      {(d.rolls ?? []).length > 0 && (
        <Section title="Properties">
          <ul class="itemrolls">
            {(d.rolls ?? []).map((r) => (
              <li key={r.stat}>
                <span class="itemrolls__name">{r.stat === 'Defense' ? 'Defence' : r.stat}</span>
                <small class="num">+{fmt(r.min + (r.max - r.min) * floor)} to +{r.max}{r.pct ? '%' : ''}</small>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {d.slot === 'Weapon' && <Familiarity defId={d.id} />}
      {set && (
        <Section title={`Set: ${set.id}`}>
          <SetCard set={set} compact />
        </Section>
      )}
      <Section title="Required materials" right={<Shards n={cost.shards} />}>
        <CostGrid s={s} c={cost} />
        <TrackMissing c={cost} />
      </Section>
      {fresh.length > 0 && (
        <div class="haul recipe__fresh">{fresh.slice(0, 1).map((id) => <Forged key={id} id={id} />)}</div>
      )}
      <Btn kind="gold" block disabled={!known || !ok} sound="success" onClick={go}>
        {!known ? 'Blueprint not known' : ok ? <><Glyph name="forge" /> Forge · <Shards n={cost.shards} /></> : s.wallet.shards < cost.shards ? `Mana Shards ${group(s.wallet.shards)}/${group(cost.shards)}` : 'Materials missing'}
      </Btn>
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
          <i class="dollslot__q" aria-hidden="true"><i style={`width: ${gear.quality(it)}%`} /></i>
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
  const all = forge.allMaterials();
  const group1 = (k: string) => all.filter((m) => m.kind === k);
  const trophies = group1('trophy');
  // A row tapped tracks its material: the anvil on it, and on every Gate that leaves it.
  const rows = (list: typeof all, hideNone = false) => list.filter((m) => !hideNone || forge.held(s, m.id) > 0 || forge.isTracked(s, m.id)).map((m) => {
    const on = forge.isTracked(s, m.id);
    return (
      <button type="button" key={m.id} class={`sysbox matrow ${forge.held(s, m.id) ? '' : 'is-none'} ${on ? 'is-tracked' : ''}`} data-rarity={m.rank} aria-pressed={on}
        aria-label={`${m.name}: ${forge.held(s, m.id)}${on ? ', tracked' : ''}. Tap to ${on ? 'stop tracking' : 'track'}.`} onClick={() => track(m.id)}>
        <MatArt id={m.id} size={38} />
        <span class="matrow__text"><b>{m.name}{on && <TrackMark class="matrow__track" />}</b><small class="muted">{m.desc}</small></span>
        <b class="num matrow__n">{group(forge.held(s, m.id))}</b>
      </button>
    );
  });
  const heldTrophies = trophies.filter((m) => forge.held(s, m.id) > 0 || forge.isTracked(s, m.id));
  return (
    <div class="stack">
      <Section title="Alloys"><div class="stack stack--tight">{rows(group1('alloy'))}</div></Section>
      <Section title="Parts"><div class="stack stack--tight">{rows(group1('part'))}</div></Section>
      <Section title="Trophies" right={<span class="num">{heldTrophies.length}/{trophies.length}</span>}>
        {heldTrophies.length ? <div class="stack stack--tight">{rows(trophies, true)}</div> : <Empty>Trophies held: 0</Empty>}
      </Section>
      {(forge.held(s, forge.EMBER.id) > 0 || s.ascension.unlocked > 0) && <Section title="Ascension"><div class="stack stack--tight">{rows([forge.EMBER])}</div></Section>}
    </div>
  );
}
