/** The Exchange: eight pieces a day and the potions, paid for in Mana Shards. */
import { sfx } from '@/audio/audio';
import * as gear from '@/core/gear';
import * as shop from '@/core/shop';
import { hhmmss, msUntilMidnight } from '@/core/util';
import { checkAwards } from '@/app/flow';
import { buy as buyShards, PRODUCTS, storeReady } from '@/platform/native';
import * as store from '@/store';
import * as system from '@/ui/system';
import { useSave } from '@/store';
import { Btn, Chip, GearArt, Section, Shards, useNow } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph } from '@/ui/icons';
import { openSheet, sys, toast } from '@/ui/overlays';
import { drinkFlow } from './Profile';

export function openExchange() {
  if (!store.get().seen.includes('shop-visited')) store.update((x) => { x.seen.push('shop-visited'); });
  openSheet({ title: 'The Exchange', tone: 'verdant', render: () => <Exchange /> });
}

function Exchange() {
  const s = useSave();
  useNow();
  const offers = shop.shelf(s);
  const left = offers.filter((o) => !o.sold).length;
  const buy = async (o: shop.Offer) => {
    const d = gear.defOf(o.item);
    const want = await sys(system.offer([
      'Would you like to purchase?',
      system.tag(d?.name ?? 'Item', 'Item'),
      system.gain(gear.coreText(o.item)),
      `Price: ${o.price} Mana Shards · Held: ${store.get().wallet.shards}`,
    ], 'gear', 'Buy', 'Cancel'));
    if (want !== true) return;
    const it = store.update((x) => shop.buy(x, o.index));
    if (!it) return void sys(system.refuse([`Not enough Mana Shards. (${store.get().wallet.shards}/${o.price})`], 'gear'));
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
  return (
    <div class="stack">
      <div class="purse">
        <div><span class="label">Mana Shards</span><Shards n={s.wallet.shards} big /></div>
        <div class="purse__right"><span class="label">New stock in</span><b class="num">{hhmmss(msUntilMidnight())}</b></div>
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
        <div class="stack stack--tight">
          <div class={`shoprow ${s.satchel >= shop.FIELD_POTION.max ? 'is-idle' : ''}`}>
            <span class="potion potion--field"><Glyph name="potion" /></span>
            <span class="shoprow__text">
              <b>Field Potion</b>
              <small>Carried into a Gate. HP +{shop.FIELD_POTION.heal * 100}% on your turn.</small>
              <small class="muted">The satchel holds {shop.FIELD_POTION.max}. You are carrying {s.satchel}.</small>
            </span>
            {s.satchel >= shop.FIELD_POTION.max
              ? <Chip>Satchel full</Chip>
              : <Btn size="sm" kind="ghost" disabled={s.wallet.shards < shop.FIELD_POTION.price} onClick={async () => {
                const want = await sys(system.offer([
                  'Would you like to purchase?',
                  system.tag('Field Potion', 'Item'),
                  system.gain(`HP +${shop.FIELD_POTION.heal * 100}%`),
                  'Used on your turn in a Gate.',
                  `Price: ${shop.FIELD_POTION.price} Mana Shards · Held: ${store.get().wallet.shards}`,
                ], 'gear', 'Buy', 'Cancel'));
                if (want !== true) return;
                if (!store.update(shop.buyField)) return void sys(system.refuse([`Not enough Mana Shards. (${store.get().wallet.shards}/${shop.FIELD_POTION.price})`], 'gear'));
                sfx.success();
                buzz([14, 30, 22]);
                toast(`Field Potion · Satchel ${store.get().satchel}/${shop.FIELD_POTION.max}`, 'xp');
              }}><Shards n={shop.FIELD_POTION.price} /></Btn>}
          </div>
          {shop.POTIONS.map((p) => {
            const idle = shop.potionIdle(s, p.id);
            return (
              <div key={p.id} class={`shoprow ${idle ? 'is-idle' : ''}`}>
                <span class={`potion potion--${p.id}`}><Glyph name="potion" /></span>
                <span class="shoprow__text"><b>{p.name}</b><small>{p.effect}</small><small class="muted">{p.desc}</small></span>
                {idle ? <Chip>{idle}</Chip> : <Btn size="sm" kind="ghost" disabled={s.wallet.shards < p.price} onClick={() => drinkFlow(p.id)}><Shards n={p.price} /></Btn>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="The Manifest" right={`${left} of ${offers.length} left`}>
        <div class="stack stack--tight">
          {offers.map((o) => {
            const d = gear.defOf(o.item)!;
            return (
              <div key={o.index} class={`shoprow ${o.sold ? 'is-sold' : ''}`}>
                <GearArt item={o.item} size={48} />
                <span class="shoprow__text">
                  <b>{d.name} {!o.sold && gear.beatsWorn(s, o.item) && <span class="up">▲</span>}</b>
                  <small>{gear.coreText(o.item)}{gear.rollText(o.item).length ? ` · ${gear.rollText(o.item).join(' · ')}` : ''}</small>
                  <small class="muted">{gear.RARITY[d.rank].name} · {d.slot} · Score {Math.round(gear.score(o.item))}{o.reach ? '' : ''}</small>
                  {o.reach > 0 && <span class="chip" data-tone="gold">Grade +{o.reach + 1} · Price +{o.reach * shop.REACH_PREMIUM * 100}%</span>}
                </span>
                {o.sold ? <Chip>Bought</Chip> : <Btn size="sm" kind="ghost" disabled={s.wallet.shards < o.price} onClick={() => buy(o)}><Shards n={o.price} /></Btn>}
              </div>
            );
          })}
          {!left && <p class="muted center">Sold out until midnight.</p>}
        </div>
      </Section>
    </div>
  );
}
