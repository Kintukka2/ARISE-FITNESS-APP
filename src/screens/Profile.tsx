/** Profile: who you are — level, class, attributes, vitals — and what you are wearing. */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { CLASS_RANKS, classById } from '@/data/classes';
import * as gear from '@/core/gear';
import { ascensionOpen } from '@/core/ascension';
import { walkerOf } from '@/core/walkers';
import { ASCENSION_TOP, OVERCHARGE } from '@/data/ascension';
import { MISSIONS, TIER_NAMES, grantText } from '@/core/missions';
import { ATTRS, autoAllocate, BOOST_CAP, canPick, classBonus, keptAt, nextRank, optionsAt, pick, POINTS_PER_LEVEL, rankFor, RANK_UP_POINTS, rungsOf, spendPoint, STAT_CAP, waiting } from '@/core/progression';
import { ability, passiveText, REACH_TEXT } from '@/core/combat';
import { licenceHolding, licensedRank } from '@/core/licence';
import * as shop from '@/core/shop';
import type { Item, Save, SlotKey, Stat } from '@/core/types';
import { STATS } from '@/core/types';
import * as vitals from '@/core/vitals';
import { checkAwards } from '@/app/flow';
import * as store from '@/store';
import { useSave } from '@/store';
import { weekBest } from '@/core/spire';
import { dungeonById } from '@/core/gates';
import { setById, type GearSet } from '@/data/sets';
import * as system from '@/ui/system';
import { Btn, Card, Chip, Empty, Fold, GearArt, HpBar, IconBtn, KV, Panel, Section, Shards, useNow } from '@/ui/components';
import { Field, SysFrame } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, STAT_ICON, Sigil } from '@/ui/icons';
import { confirm, openSheet, sys, toast } from '@/ui/overlays';
import { openExchange } from './Exchange';

export function Profile() {
  const s = useSave();
  useNow(5000);
  const r = rankFor(s.hunter.level);
  const cls = classById(s.hunter.classId);
  const nr = nextRank(s.hunter.level);
  return (
    <div class="stack">
      <SysFrame title="Status" icon={null} class="status" tools={<IconBtn icon="book" label="Hunter dossier" onClick={openDossier} />}>
        <div class="sysfields">
          <Field k="Name" v={s.hunter.name} />
          <Field k="Level" v={<span class="status__level">{s.hunter.level}</span>} />
          <Field k="Class" v={<button type="button" class="linkish" onClick={openClass}>{cls?.name ?? 'Unclassified'}</button>} />
          <Field k="Rank" v={<span class="row status__rank"><Sigil rank={r.key === 'N' ? 'N' : licensedRank(s)} size={20} />{r.name}</span>} />
        </div>
        <small class="muted">{nr ? `Level ${nr.min} for ${nr.name}.` : 'There is nothing above this.'}{licenceHolding(s) ? ' The Association holds your Gate grade at D without a licence.' : ''}</small>
        {waiting(s).length > 0 && <Btn kind="gold" block onClick={openClass}>Choose New Skills · {waiting(s).length}</Btn>}
        <VitalsBlock />
        <Attributes />
      </SysFrame>
      <Equipment />
    </div>
  );
}

/** The class, and the choice at each of its rungs. */
export function openClass() {
  openSheet({ title: 'Skills', system: { icon: null, kind: 'gold' }, render: () => <ClassSheet /> });
}

function ClassSheet() {
  const s = useSave();
  const cls = classById(s.hunter.classId);
  if (!cls) {
    return <Empty title="Unclassified">No class yet.</Empty>;
  }
  return (
    <div class="stack">
      <div class="classcard">
        <p><strong>[Class: {cls.name}]</strong></p>
        <p>{cls.desc}</p>
        <p class="grant">{cls.lead} +{cls.bonus}</p>
        <small class="muted">Reassigned when another stat is highest. Choices made in other lines are kept.</small>
      </div>
      {rungsOf(cls.lead).map((r) => <Rung key={r} rung={r} lead={cls.lead} tier={cls.tier} />)}
    </div>
  );
}

/** What a skill or passive does, read from the data. */
function describe(kind: 'skill' | 'passive', name: string) {
  if (kind === 'passive') return passiveText(name);
  const a = ability(name);
  if (!a) return '';
  const what = a.profile === 'support' ? 'Rallies the whole party' : `${a.type === 'magic' ? 'Magic' : 'Physical'}, ×${a.mult}, ${REACH_TEXT[a.profile] ?? 'one target'}`;
  return `${what}${a.cd ? `, cooldown ${a.cd}` : ''}${a.inflicts.length ? `. Inflicts ${a.inflicts.join(' and ')}` : ''}.`;
}

/** One rung: its two options, the one kept, and whether it can be changed yet. */
function Rung({ rung, lead, tier }: { rung: number; lead: string; tier: number }) {
  const s = useSave();
  const open = rung <= tier;
  const { kind, names } = optionsAt(lead, rung);
  const kept = keptAt(s.hunter.picks, lead, rung);
  const chosen = s.hunter.picks?.[`${lead}:${rung}`];
  const can = open && canPick(s, rung);
  const until = chosen ? CLASS_RANKS[chosen.at + 1] : null;
  const state = !open ? `opens at ${CLASS_RANKS[rung]}-Rank` : !chosen ? 'choose one' : can ? 'you may change it' : until ? `kept until ${until}-Rank` : 'kept for good';
  return (
    <section class={`rung ${open ? '' : 'is-shut'}`}>
      <header class="rung__head"><span class="label">{CLASS_RANKS[rung]}-Rank {kind}</span><small>{state}</small></header>
      <div class="rung__options">
        {names.map((n) => {
          const isKept = open && n === kept;
          return (
            <button type="button" key={n} class={`pickcard ${isKept ? 'is-kept' : ''}`} disabled={!can || (isKept && !!chosen)} aria-pressed={isKept}
              onClick={async () => {
                const next = CLASS_RANKS[tier + 1];
                if (!(await confirm(`Keep ${n}?`, next ? `You can change it again at <strong>${next}-Rank</strong>.` : 'At S-Rank the choice is for good.', 'Keep'))) return;
                if (store.update((x) => pick(x, rung, n))) { sfx.rankUp(); toast(`${n} kept.`, 'good'); }
              }}>
              <b>{n}</b>
              <small>{describe(kind, n)}</small>
              {isKept && <span class="pickcard__tag">{chosen ? 'Kept' : 'Until you choose'}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function VitalsBlock() {
  const s = useSave();
  const v = vitals.read(s);
  const pip = (id: shop.PotionId) => {
    const p = shop.POTIONS.find((x) => x.id === id)!;
    const idle = shop.potionIdle(s, id);
    const dear = s.wallet.shards < p.price;
    return (
      <button type="button" class={`pip ${idle ? 'is-idle' : dear ? 'is-dear' : 'is-live'}`} aria-label={`${p.name}, ${p.price} shards`} title={`${p.name} · ${p.price}`}
        onClick={() => drinkFlow(id)}>
        <Glyph name="potion" /><span class="num">{p.price}</span>
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
  if (s.wallet.shards < p.price) {
    await sys(system.refuse([`Not enough Mana Shards. (${s.wallet.shards}/${p.price})`], 'gear'));
    return;
  }
  const buy = await sys(system.offer([
    'Would you like to purchase?',
    system.tag(p.name, 'Item'),
    system.gain(p.effect),
    `Price: ${p.price} Mana Shards · Held: ${s.wallet.shards}`,
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
  const bonus = classBonus(s);
  const total = gear.boosted(s.hunter.attrs, gear.worn(s), bonus, BOOST_CAP);
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

function Equipment() {
  const s = useSave();
  const ups = gear.upgradeCount(s);
  const offers = gear.offers(s);
  const slot = (k: SlotKey) => {
    const it = gear.equippedIn(s, k);
    const def = gear.SLOTS.find((x) => x.key === k)!;
    return (
      <button type="button" key={k} class={`dollslot ${it ? 'is-filled' : ''}`} onClick={() => { sfx.tap(); if (it) openItem(it.id); else openSlot(k); }} aria-label={it ? `${def.name}: ${gear.defOf(it)?.name}` : `${def.name}: empty`}>
        {it ? <GearArt item={it} size={44} /> : <span class="dollslot__ghost"><Glyph name={def.accepts} /></span>}
        <small>{it ? gear.defOf(it)?.name : def.name}</small>
        {!it && offers.includes(k) && <span class="badge badge--gold">+</span>}
      </button>
    );
  };
  return (
    <Panel title="Equipment" tools={<IconBtn icon="bag" label="Inventory" badge={s.items.length || undefined} onClick={openInventory} />}>
      <div class="row between">
        <div><span class="label">Equipment score</span><b class="num big">{Math.round(gear.power(s))}</b></div>
        <Btn kind={ups ? 'gold' : 'ghost'} size="sm" disabled={!ups} onClick={() => { const n = store.update(gear.autoEquip); sfx.success(); buzz([16, 26, 22]); toast(`${n} slot${n === 1 ? '' : 's'} improved.`, 'good'); void checkAwards(); }}>
          Auto Equip{ups ? ` · ${ups}` : ''}
        </Btn>
      </div>
      <div class="doll">
        <div class="doll__col">{gear.SLOTS.filter((x) => x.side === 'l').map((x) => slot(x.key))}</div>
        <div class="doll__figure" aria-hidden="true"><Glyph name="profile" /><span class="doll__ring" /></div>
        <div class="doll__col">{gear.SLOTS.filter((x) => x.side === 'r').map((x) => slot(x.key))}</div>
      </div>
      <ActiveSets s={s} />
      <div class="row">
        <Btn kind="ghost" class="grow" onClick={openInventory}><Glyph name="bag" /> Inventory · {s.items.length}</Btn>
        <Btn kind="ghost" class="grow" onClick={openExchange}><Shards n={s.wallet.shards} /> Exchange</Btn>
      </div>
    </Panel>
  );
}

/** The sets the hunter is wearing two or more pieces of, and what they pay. */
function ActiveSets({ s }: { s: Save }) {
  const on = [...gear.setsIn(gear.worn(s))].filter(([, n]) => n >= 2);
  if (!on.length) return null;
  return (
    <ul class="setlist" aria-label="Set bonuses">
      {on.map(([id, n]) => {
        const set = setById(id)!;
        return <li key={id}><b>{id}</b><span class="num">{n} of {gear.setPieces(id).length}</span><small>{gear.bonusText(gear.sumBonuses(set.two, n >= 3 ? set.three : {}))}</small></li>;
      })}
    </ul>
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
  const cap = gear.overCap(s);
  const next = gear.upgradeStep(it, cap);
  const cost = shop.upgradeCost(it, cap);
  if (!next || cost === null) {
    const over = it.over ?? 0;
    return <p class="hint">{over >= OVERCHARGE.per * ASCENSION_TOP ? `Perfect +${over}. At the limit.`
      : !ascensionOpen(s) ? 'Perfect. Nothing left to raise.'
      : `Perfect${over ? ` +${over}` : ''}. Each Ascension level opened allows ${OVERCHARGE.per === 1 ? '1 more step' : `${OVERCHARGE.per} more steps`}.`}</p>;
  }
  const short = s.wallet.shards < cost;
  return (
    <Section title={next.over ? 'Past perfect' : 'Upgrade'} right={it.up ? `${it.up} step${it.up === 1 ? '' : 's'} bought` : 'at the Exchange'}>
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

function openInventory() {
  let filter = 'All';
  openSheet({
    title: 'Inventory', system: { icon: null }, render: () => <Inventory initial={filter} onFilter={(f) => { filter = f; }} />,
  });
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

function Inventory({ initial, onFilter }: { initial: string; onFilter: (f: string) => void }) {
  const s = useSave();
  const [f, setF] = useState(initial);
  const types = ['All', 'Weapon', 'Off-Hand', 'Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Amulet', 'Ring'];
  const list = s.items.filter((it) => f === 'All' || gear.defOf(it)?.slot === f).sort((a, b) => gear.score(b) - gear.score(a));
  return (
    <div class="stack">
      <div class="chips invtabs" role="tablist">{types.map((t) => <Chip key={t} on={f === t} onClick={() => { setF(t); onFilter(t); }}>{t === 'All' ? `All · ${s.items.length}` : t}</Chip>)}</div>
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
            <Field k="Set" v={d.set ?? '-- --'} />
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
              {tag && <span class={tag === 'perfect' ? 'hint' : 'warn'}>{tag === 'perfect' ? `✦ Perfect${it.over ? ` +${it.over}` : ' roll'}` : '✕ Dead roll'}</span>}
            </p>
          )}
          {!d.issued && <UpgradeBlock it={it} s={s} />}
          {d.set && setById(d.set) && <SetBlock set={setById(d.set)!} s={s} />}
          <div class="row">
            <Btn kind="primary" class="grow" sound="success" onClick={() => { store.update((x) => (worn ? gear.unequip(x, worn) : gear.equip(x, it.id))); toast(`${d.name} ${worn ? 'stowed' : 'equipped'}.`, 'xp'); void checkAwards(); }}>{worn ? 'Unequip' : 'Equip'}</Btn>
            <IconBtn icon="star" label={s.favourites.includes(it.id) ? 'Unstar' : 'Star (protects from bulk recycle)'} onClick={() => store.update((x) => gear.toggleFav(x, it.id))} />
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
    title: slot.name, render: () => {
      const s = store.get();
      const list = s.items.filter((it) => gear.defOf(it)?.slot === slot.accepts && !gear.slotOf(s, it)).sort((a, b) => gear.score(b) - gear.score(a));
      if (!list.length) return <Empty>Nothing for this slot yet.</Empty>;
      return <div class="stack stack--tight"><small class="muted">Tap to equip.</small>{list.map((it) => <ItemLine key={it.id} it={it} s={s} onClick={() => { store.update((x) => gear.equip(x, it.id, k)); sfx.success(); toast(`${gear.defOf(it)?.name} equipped.`, 'xp'); close(); void checkAwards(); }} />)}</div>;
    },
  });
}

function openRecycle() {
  let ranks = ['E'];
  const close = openSheet({
    title: 'Recycle Items', tone: 'ember', render: () => <Recycle initial={ranks} onChange={(r) => { ranks = r; }} onDone={close} />,
  });
}

function Recycle({ initial, onChange, onDone }: { initial: string[]; onChange: (r: string[]) => void; onDone: () => void }) {
  const s = useSave();
  const [ranks, setRanks] = useState(initial);
  const matches = shop.scrapMatches(s, ranks);
  const worth = matches.reduce((n, it) => n + shop.scrapValue(it), 0);
  return (
    <div class="stack">
      <p class="muted">Everything of the chosen grades is broken down for shards. Anything you are wearing, the issued kit, and anything you have starred are never included.</p>
      <div class="chips">{(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((r) => <Chip key={r} on={ranks.includes(r)} tone={`rank-${r}`} onClick={() => { const n = ranks.includes(r) ? ranks.filter((x) => x !== r) : [...ranks, r]; setRanks(n); onChange(n); }}>{gear.RARITY[r].name}</Chip>)}</div>
      <p><b>{matches.length}</b> item{matches.length === 1 ? '' : 's'} match, worth <Shards n={worth} /></p>
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

function openDossier() {
  openSheet({
    title: 'Hunter Dossier', render: () => {
      const s = store.get();
      const held = MISSIONS.filter((m) => s.hunter.missions.includes(m.id));
      return (
        <div class="stack">
          <Card>
            <div class="row"><Sigil rank={rankFor(s.hunter.level).key === 'N' ? 'N' : licensedRank(s)} size={48} /><div>
              <b class="big">{s.hunter.name}</b>
              <small class="muted num">Licence {s.hunter.regNo || '-- --'} · Awakened {new Date(s.createdAt).toLocaleDateString()}</small>
            </div></div>
          </Card>
          <Fold title="Secret Quests" right={`${held.length} / ${MISSIONS.length}`} open>
            {held.length ? (
              <ul class="missions">
                {held.map((m) => (
                  <li key={m.id} class={`mission mission--${m.tier}`}>
                    <span class="mission__tier">{TIER_NAMES[m.tier]}</span>
                    <b>{m.name}</b>
                    <small>Goal: {m.did}</small>
                    <small class="mission__grant">{grantText(m)}</small>
                  </li>
                ))}
              </ul>
            ) : <Empty>Secret Quests completed: 0</Empty>}
            <small class="muted">Sealed: {MISSIONS.length - held.length}</small>
          </Fold>
          <Fold title="Active effects">
            <KV k="Ability Points per level" v={`${POINTS_PER_LEVEL}, plus ${RANK_UP_POINTS} per rank`} />
            {Object.entries(classBonus(s)).map(([k, v]) => <KV key={k} k="Class" v={`${k} +${v}`} />)}
          </Fold>
          <Fold title="Lifetime record">
            <KV k="Gates cleared" v={`${s.gates.clears} (${s.gates.cleared.length} distinct)`} />
            <KV k="Withdrawn" v={s.gates.withdrawn} />
            <KV k="Carried out" v={s.gates.fails} />
            <KV k="Best run unbroken" v={`${s.gates.bestUnbroken} clears`} />
            <KV k="Cleared above your grade" v={s.stats.reachClears} />
            <KV k="Daily Quests completed" v={`${s.stats.contracts} (all of a day’s: ${s.stats.contractDays} times)`} />
            <KV k="Ascension" v={s.ascension.best ? `Level ${s.ascension.best} opened` : 'None opened'} />
            <KV k="The Pale Spire" v={s.spire.top ? `Floor ${s.spire.top} at best${weekBest(s) ? `, Floor ${weekBest(s)} this week` : ''}` : 'Not climbed'} />
            <KV k="Bosses faced" v={s.gates.bosses.length} />
            <KV k="Creatures felled" v={Object.values(s.stats.killsByFamily).reduce((a, b) => a + b, 0).toLocaleString()} />
            <KV k="Shadows bound" v={`${s.shadows.army.length} (${s.stats.extractionsWon}/${s.stats.extractions} extractions successful)`} />
            <KV k="Lifetime experience" v={s.stats.xpTotal.toLocaleString()} />
            <KV k="Shards earned" v={s.wallet.earned.toLocaleString()} />
          </Fold>
          <Fold title="Activity log" right={`${s.log.length}`}>
            {s.log.length ? <ul class="history">{s.log.slice(0, 40).map((e, i) => <li key={i}><span>{e.day}</span><span>{e.name}</span><span class="num">{e.xp ? `+${e.xp}` : '·'}</span></li>)}</ul> : <Empty>Nothing logged yet.</Empty>}
          </Fold>
        </div>
      );
    },
  });
}
