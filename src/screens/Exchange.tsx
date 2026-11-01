/** The Exchange: the System's shop. Eight pieces a day and the potions, paid for in Mana Shards. */
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import * as shop from '@/core/shop';
import { group, hhmmss, msUntilMidnight } from '@/core/util';
import { checkAwards } from '@/app/flow';
import { buy as buyShards, PRODUCTS, storeReady } from '@/platform/native';
import * as store from '@/store';
import * as system from '@/ui/system';
import { useSave } from '@/store';
import type { ComponentChildren } from 'preact';
import { Btn, GearArt, Section, Shards, useNow } from '@/ui/components';
import { Field } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph } from '@/ui/icons';
import { openSheet, sys, toast } from '@/ui/overlays';
import { drinkFlow } from './Profile';

export function openExchange() {
  if (!store.get().seen.includes('shop-visited')) store.update((x) => { x.seen.push('shop-visited'); });
  openSheet({ title: 'Exchange', system: { icon: null }, render: () => <Exchange /> });
}

/** Not enough Mana Shards for it: the System's refusal, with the count. */
const short = (price: number) => sys(system.refuse([`Not enough Mana Shards. (${store.get().wallet.shards}/${price})`], 'gear'));

/**
 * One row of the shop, as the source lays it out: the icon in its own box, the name, what it gives,
 * and the price at the foot of the row. The whole row is the button; it asks before it buys.
 */
function ShopRow({ icon, name, gives, note, price, off, onBuy }: {
  icon: ComponentChildren; name: ComponentChildren; gives?: string; note?: ComponentChildren; price: number;
  /** Why it cannot be bought now ("Bought", "Full"), shown where the price would be. */
  off?: string | null;
  onBuy: () => void;
}) {
  const s = useSave();
  return (
    <button type="button" class={`shoprow ${off ? 'is-off' : ''} ${!off && s.wallet.shards < price ? 'is-short' : ''}`} disabled={!!off}
      onClick={() => { sfx.tap(); onBuy(); }}>
      <span class="shoprow__icon">{icon}</span>
      <span class="shoprow__text">
        <b>{name}</b>
        {gives && <small class="grant">{gives}</small>}
        {note && <small class="muted">{note}</small>}
      </span>
      <span class="shoprow__price">{off ?? <Shards n={price} />}</span>
    </button>
  );
}

function Exchange() {
  const s = useSave();
  useNow();
  const offers = shop.shelf(s);
  const left = offers.filter((o) => !o.sold).length;
  const buy = async (o: shop.Offer) => {
    if (store.get().wallet.shards < o.price) return void short(o.price);
    const d = gear.defOf(o.item);
    const want = await sys(system.offer([
      'Would you like to purchase?',
      system.tag(d?.name ?? 'Item', 'Item'),
      system.gain(gear.coreText(o.item)),
      `Price: ${group(o.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    const it = store.update((x) => shop.buy(x, o.index));
    if (!it) return void short(o.price);
    sfx.success();
    buzz([14, 30, 22, 30, 70]);
    const v = await sys({
      ...system.notify([...system.event('acquired', system.tag(gear.defOf(it)?.name ?? 'Item', 'Item')), system.gain(gear.coreText(it))], 'gear',
        [{ label: 'Put In Inventory', value: false }, { label: 'Equip', value: true, primary: true }]),
      typed: false,
    });
    if (v) store.update((x) => gear.equip(x, it.id));
    void checkAwards();
  };
  const buyField = async () => {
    const f = shop.FIELD_POTION;
    if (store.get().wallet.shards < f.price) return void short(f.price);
    const want = await sys(system.offer([
      'Would you like to purchase?',
      system.tag('Field Potion', 'Item'),
      system.gain(`HP +${f.heal * 100}%`),
      'Used on your turn in a Gate.',
      `Price: ${group(f.price)} Mana Shards · Held: ${group(store.get().wallet.shards)}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    if (!store.update(shop.buyField)) return void short(f.price);
    sfx.success();
    buzz([14, 30, 22]);
    toast(`Field Potion · Satchel ${store.get().satchel}/${f.max}`, 'xp');
  };
  return (
    <div class="stack exchange">
      <div class="sysfields">
        <Field k="Mana Shards" v={<Shards n={s.wallet.shards} />} />
        <Field k="New stock in" v={<span class="num">{hhmmss(msUntilMidnight())}</span>} />
      </div>
      <p class="muted">Most stock is at your grade.</p>

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

      <Section title="Potions" right="Always in stock">
        <div class="shoplist">
          <ShopRow icon={<span class="potion potion--field"><Glyph name="potion" /></span>} name="Field Potion"
            gives={`HP +${shop.FIELD_POTION.heal * 100}%`}
            note={`Carried into a Gate, used on your turn. Satchel: ${s.satchel}/${shop.FIELD_POTION.max}`}
            price={shop.FIELD_POTION.price} off={s.satchel >= shop.FIELD_POTION.max ? 'Satchel full' : null} onBuy={buyField} />
          {shop.POTIONS.map((p) => (
            <ShopRow key={p.id} icon={<span class={`potion potion--${p.id}`}><Glyph name="potion" /></span>} name={p.name}
              gives={p.effect} note={p.desc} price={p.price} off={shop.potionIdle(s, p.id)}
              onBuy={() => { if (store.get().wallet.shards < p.price) void short(p.price); else void drinkFlow(p.id); }} />
          ))}
        </div>
      </Section>

      <Section title="The Manifest" right={`Left: ${left}/${offers.length}`}>
        <div class="shoplist">
          {offers.map((o) => {
            const d = gear.defOf(o.item)!;
            return (
              <ShopRow key={o.index} icon={<GearArt item={o.item} size={52} />}
                name={<>{d.name}{!o.sold && gear.beatsWorn(s, o.item) && <span class="up" title="Better than what you are wearing"> ▲</span>}</>}
                gives={[gear.coreText(o.item), ...gear.rollText(o.item)].join(' · ')}
                note={<>{gear.RARITY[d.rank].name} · {d.slot} · Score {Math.round(gear.score(o.item))}{o.reach > 0 && <><br /><span class="hint">Grade +{o.reach + 1} · Price +{o.reach * shop.REACH_PREMIUM * 100}%</span></>}</>}
                price={o.price} off={o.sold ? 'Bought' : null} onBuy={() => void buy(o)} />
            );
          })}
          {!left && <p class="muted center">Sold out until midnight.</p>}
        </div>
      </Section>
    </div>
  );
}
