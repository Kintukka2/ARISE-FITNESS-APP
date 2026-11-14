/** The Exchange: the System's shop. Blueprints, a shelf a day, and the potions, paid for in Mana Shards. */
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import { SURVEY } from '@/data/association';
import * as shop from '@/core/shop';
import { throwable, type ThrowId } from '@/core/combat';
import { group, hhmmss, msUntilMidnight } from '@/core/util';
import { checkAwards } from '@/app/flow';
import { buy as buyShards, PRODUCTS, storeReady } from '@/platform/native';
import * as store from '@/store';
import * as system from '@/ui/system';
import { useSave } from '@/store';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ShopArt, type ShopArtId } from '@/ui/shopart';
import { Btn, GearArt, Section, Shards, useNow } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, Shard } from '@/ui/icons';
import { ask } from '@/ui/ask';
import { openSheet, sys, toast } from '@/ui/overlays';
import { drinkFlow } from './Inventory';
import { openBlueprint } from './Forge';
import { STATS } from '@/core/types';
import type { Save } from '@/core/types';

/** A blueprint rarer than what is worn where its design goes, or for a slot left empty. */
const rarerThanWorn = (s: Save, defId: string) => {
  const d = gear.gearDef(defId);
  const at = (r: string) => ['E', 'D', 'C', 'B', 'A', 'S'].indexOf(r);
  return !!d && gear.SLOTS.filter((x) => x.accepts === d.slot).some((x) => { const it = gear.equippedIn(s, x.key); return !it || at(gear.defOf(it)?.rank ?? 'E') < at(d.rank); });
};

export function openExchange() {
  if (!store.get().seen.includes('shop-visited')) store.update((x) => { x.seen.push('shop-visited'); });
  openSheet({ title: 'Exchange', system: { icon: null }, render: () => <Exchange /> });
}

/** Not enough Mana Shards for it: the System's refusal, with the count. */
const short = (price: number) => sys(system.refuse([`Not enough Mana Shards. (${store.get().wallet.shards}/${price})`], 'gear'));

type Tab = 'bp' | 'potions' | 'gates';

/** The shop's three counters, as the reference shops set their tabs across the top: each its mark, its name and what it holds. */
const TABS: { key: Tab; name: string; glyph: string }[] = [
  { key: 'bp', name: 'Blueprints', glyph: 'blueprint' },
  { key: 'potions', name: 'Potions', glyph: 'potion' },
  { key: 'gates', name: 'For the Gates', glyph: 'gates' },
];

/** One good on a counter: its picture, its name and kind, what it gives, what is held, its price, and why it cannot be bought now. */
interface Good {
  key: string;
  tab: Tab;
  art: ComponentChildren;
  name: string;
  /** A blueprint's rarity, for its ground. */
  rank?: string;
  /** Its kind under its name on the card: `Rare Chest · Champion`, `Carried`, `Thrown in a fight`. */
  kind: string;
  gives: string;
  note?: ComponentChildren;
  /** How many are held, as a badge on the tile. */
  held?: number;
  price: number;
  off?: string | null;
  /** Rarer than what is worn where it goes. */
  up?: boolean;
  buy: () => void;
}

/**
 * A good on its counter, as the reference shops tile theirs: its picture on its ground (a blueprint on
 * its rarity's colour over a drafting grid), how many are held in its corner, ▲ in gold where it beats
 * what is worn, its name under it, and its price along its foot, red while the shards fall short. One
 * that cannot be bought is stamped with why. A tap holds it in the dock at the counter's foot.
 */
function GoodTile({ g, on, short: isShort, onPick }: { g: Good; on: boolean; short: boolean; onPick: () => void }) {
  return (
    <button type="button" role="option" aria-selected={on} class={`extile ${on ? 'is-on' : ''} ${g.off ? 'is-off' : ''} ${isShort ? 'is-short' : ''} ${g.rank ? 'is-bp' : ''}`}
      data-rarity={g.rank} aria-label={`${g.name}, ${g.off ?? `${g.price} Mana Shards`}`} onClick={() => { sfx.tap(); onPick(); }}>
      <span class="extile__art">
        {g.art}
        {!!g.held && <span class="extile__held num">×{g.held}</span>}
        {g.up && <span class="extile__up" title="Rarer than what you are wearing">▲</span>}
        {g.off && <span class="extile__stamp">{g.off}</span>}
      </span>
      <span class="extile__name">{g.name}</span>
      <span class="extile__price">{g.off ? '--' : <Shards n={g.price} />}</span>
    </button>
  );
}

/**
 * The good held in the dock, as the reference shops open a good before it is bought: its picture, its
 * name and kind, what it gives and what is held, and **Buy** with the price on it. Buy asks first, as
 * every purchase does.
 */
function GoodDock({ g, short: isShort, onClose }: { g: Good; short: boolean; onClose: () => void }) {
  return (
    <div class="exdock" data-rarity={g.rank} role="region" aria-label={g.name}>
      <span class="exdock__art">{g.art}</span>
      <span class="exdock__text">
        <b>{g.name}</b>
        <small class="exdock__kind">{g.kind}</small>
        <small class="exdock__gives">{g.gives}</small>
        {g.note && <small class="exdock__note">{g.note}</small>}
      </span>
      <button type="button" class="iconbtn exdock__x" aria-label="Close" onClick={() => { sfx.tap(); onClose(); }}><Glyph name="close" /></button>
      <Btn kind={g.off || isShort ? undefined : 'primary'} block class={`exdock__buy ${isShort && !g.off ? 'is-short' : ''}`} disabled={!!g.off} onClick={g.buy}>
        {g.off ?? <>Buy <Shards n={g.price} /></>}
      </Btn>
    </div>
  );
}

function Exchange() {
  const s = useSave();
  useNow();
  const offers = shop.shelf(s);
  const left = offers.filter((o) => !o.sold && !o.known).length;
  const buy = async (o: shop.Offer) => {
    if (store.get().wallet.shards < o.price) return void short(o.price);
    const d = gear.gearDef(o.defId);
    const want = await ask('buy:shelf', system.offer([
      'Would you like to purchase?',
      system.tag(`Blueprint: ${d?.name ?? 'Item'}`, 'Item'),
      `${gear.RARITY[(d?.rank ?? 'E') as keyof typeof gear.RARITY].name} ${d?.slot ?? ''}`,
      `Price: ${group(o.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    if (!store.update((x) => shop.buy(x, o.index))) return void short(o.price);
    sfx.success();
    buzz([14, 30, 22, 30, 70]);
    const v = await sys({
      ...system.notify([...system.event('acquired', system.tag(`Blueprint: ${d?.name ?? 'Item'}`, 'Item'))], 'gear',
        [{ label: 'Close', value: false }, { label: 'Open Blueprint', value: true, primary: true }]),
      typed: false,
    });
    if (v) openBlueprint(o.defId);
    void checkAwards();
  };
  /** A Health or Mana Potion, bought to carry: a Health Potion into the satchel. */
  const buyCarried = async (id: shop.PotionId) => {
    const p = shop.POTIONS.find((x) => x.id === id)!;
    if (store.get().wallet.shards < p.price) return void short(p.price);
    const want = await ask(`buy:${id}`, system.offer([
      'Would you like to purchase?',
      system.tag(p.name, 'Item'),
      system.gain(p.effect),
      `Price: ${group(p.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    if (!store.update((x) => shop.buyCarried(x, id))) return void short(p.price);
    sfx.success();
    buzz([14, 30, 22]);
    const x = store.get();
    toast(id === 'hp' ? `${p.name} · Satchel ${shop.held(x, 'hp')}/${shop.satchelMax(x)}` : `${p.name} · Held: ${shop.held(x, id)}`, 'xp');
  };
  /** Something to throw in a fight, bought to carry in the bag. */
  const buyThrow = async (id: ThrowId) => {
    const k = throwable(id)!;
    const t = shop.THROW_KIT.find((x) => x.id === id)!;
    if (store.get().wallet.shards < t.price) return void short(t.price);
    const want = await ask(`buy:${id}`, system.offer([
      'Would you like to purchase?',
      system.tag(k.name, 'Item'),
      `${k.status} on ${k.reach > 1 ? `up to ${k.reach} foes` : 'one foe'}`,
      `Price: ${group(t.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    if (!store.update((x) => shop.buyThrow(x, id))) return void short(t.price);
    sfx.success();
    buzz([14, 30, 22]);
    toast(`${k.name} · Bag ${shop.held(store.get(), id)}/${shop.THROW_MAX}`, 'xp');
  };
  const buySurvey = async () => {
    if (store.get().wallet.shards < SURVEY.price) return void short(SURVEY.price);
    const want = await ask('buy:survey', system.offer([
      'Would you like to purchase?',
      system.tag(SURVEY.name, 'Item'),
      'Every room of a Gate’s map, through the fog.',
      `Price: ${group(SURVEY.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    if (!store.update(shop.buySurvey)) return void short(SURVEY.price);
    sfx.success();
    buzz([14, 30, 22]);
    toast(`${SURVEY.name} · Held: ${shop.held(store.get(), 'survey')}`, 'xp');
  };
  const [tab, setTab] = useState<Tab>('bp');
  const [pick, setPick] = useState<string | null>(null);
  const goods: Good[] = [
    ...offers.map((o): Good => {
      const d = gear.gearDef(o.defId)!;
      const props = [...STATS.filter((k) => d.core[k]), ...(d.rolls ?? []).map((r) => gear.rollName(r.stat))];
      return {
        key: `bp-${o.index}`, tab: 'bp', rank: d.rank, name: d.name,
        art: <span class="shopbp"><GearArt defId={o.defId} size={50} plain /><Glyph name="blueprint" class="shopbp__mark" /></span>,
        kind: `${gear.RARITY[d.rank].name} ${d.slot}${d.set ? ` · ${d.set}` : ''}`,
        gives: 'Blueprint',
        note: <>
          <span class="shopcard__stats">{props.map((x) => <i key={x}>{x}</i>)}</span>
          {o.reach > 0 && <span class="hint">Grade +{o.reach + 1} · Price +{o.reach * shop.REACH_PREMIUM * 100}%</span>}
        </>,
        price: o.price, off: o.sold ? 'Bought' : o.known ? 'Known' : null,
        up: !o.sold && !o.known && rarerThanWorn(s, o.defId), buy: () => void buy(o),
      };
    }),
    ...shop.POTIONS.map((p): Good => {
      const carried = shop.CARRIED.includes(p.id);
      return {
        key: p.id, tab: 'potions', name: p.name, art: <ShopArt id={p.id as ShopArtId} size={58} />,
        kind: carried ? (p.id === 'hp' ? 'Carried in your satchel' : 'Carried') : 'Drunk at once', gives: p.effect,
        note: carried ? (p.id === 'hp' ? `Satchel: ${shop.held(s, 'hp')}/${shop.satchelMax(s)}` : `Held: ${shop.held(s, p.id)}`) : p.desc,
        held: carried ? shop.held(s, p.id) : 0, price: p.price,
        off: carried ? (p.id === 'hp' && shop.satchelRoom(s) <= 0 ? 'Satchel full' : null) : shop.potionIdle(s, p.id),
        buy: carried ? () => void buyCarried(p.id) : () => { if (store.get().wallet.shards < p.price) void short(p.price); else void drinkFlow(p.id); },
      };
    }),
    {
      key: 'survey', tab: 'gates', name: SURVEY.name, art: <ShopArt id="survey" size={58} />, kind: 'Used from a Gate’s brief, or inside it',
      gives: 'Charts every room of a Gate’s map', note: `Held: ${shop.held(s, 'survey')}`, held: shop.held(s, 'survey'),
      price: SURVEY.price, buy: () => void buySurvey(),
    },
    ...shop.THROW_KIT.map((t): Good => {
      const k = throwable(t.id)!;
      return {
        key: t.id, tab: 'gates', name: k.name, art: <ShopArt id={t.id as ShopArtId} size={58} />, kind: 'Thrown in a fight',
        gives: `${k.status} on ${k.reach > 1 ? `up to ${k.reach} foes` : 'one foe'}`, note: `Bag: ${shop.held(s, t.id)}/${shop.THROW_MAX}`,
        held: shop.held(s, t.id), price: t.price, off: shop.throwRoom(s, t.id) <= 0 ? 'Bag full' : null, buy: () => void buyThrow(t.id),
      };
    }),
  ];
  const shown = goods.filter((g) => g.tab === tab);
  const sel = shown.find((g) => g.key === pick) ?? null;
  const ups = goods.filter((g) => g.up).length;
  return (
    <div class="stack exchange">
      {/* The purse across the top, as the reference shops keep the currency in sight: the shards held, large. */}
      <header class="exbar">
        <span class="exbar__purse" aria-label={`${group(s.wallet.shards)} Mana Shards`}><Shard size={20} /><b class="num">{group(s.wallet.shards)}</b></span>
        <small class="exbar__what">Mana Shards</small>
      </header>

      {storeReady() && (
        <Section title="Buy shards" right="Google Play">
          <div class="row">
            {PRODUCTS.shards.map((p) => (
              <Btn key={p.id} kind="ghost" class="grow" onClick={async () => {
                const ok = await buyShards(p.id);
                toast(ok ? `Mana Shards +${p.amount}` : 'The purchase did not complete. You have not been charged.', ok ? 'xp' : 'bad');
              }}><Shards n={p.amount} /></Btn>
            ))}
          </div>
        </Section>
      )}

      <div class="extabs" role="tablist" aria-label="Counters">
        {TABS.map((t) => {
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} class={`extab ${tab === t.key ? 'is-on' : ''}`}
              onClick={() => { sfx.tap(); setTab(t.key); setPick(null); }}>
              <Glyph name={t.glyph} />
              <span>{t.name}</span>
              {t.key === 'bp' && ups > 0 && <b class="extab__up num" aria-label={`${ups} upgrades`}>▲ {ups}</b>}
            </button>
          );
        })}
      </div>
      <p class="exmeta">
        {tab === 'bp'
          ? <><span class="exmeta__clock"><Glyph name="timer" />New stock in <b class="num">{hhmmss(msUntilMidnight())}</b></span><span>Left: <b class="num">{left}/{offers.length}</b></span></>
          : <span>Always in stock.</span>}
      </p>
      <div class="exgrid" role="listbox" aria-label={TABS.find((t) => t.key === tab)!.name}>
        {shown.map((g) => <GoodTile key={g.key} g={g} on={sel?.key === g.key} short={s.wallet.shards < g.price} onPick={() => setPick(pick === g.key ? null : g.key)} />)}
      </div>
      {tab === 'bp' && !left && <p class="muted center">Sold out until midnight.</p>}
      {sel && <GoodDock g={sel} short={s.wallet.shards < sel.price} onClose={() => setPick(null)} />}
    </div>
  );
}
