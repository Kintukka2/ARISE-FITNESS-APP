/**
 * The only module that knows the app might be running inside the Android
 * shell. On the web every function here is inert: no store, no reminders.
 *
 *   - Billing: cordova-plugin-purchase, exposed as `window.CdvPurchase`.
 *   - Reminders: @capacitor/local-notifications, at `Capacitor.Plugins.LocalNotifications`.
 */
import { setStoreAvailable, grantLicence } from '@/core/licence';
import type { Save } from '@/core/types';
import { addDays, dayKey } from '@/core/util';
import * as store from '@/store';

/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;

export const PRODUCTS = {
  licence: 'licence',
  shards: [{ id: 'shards_small', amount: 300 }, { id: 'shards_large', amount: 1200 }],
};

let cdv: any = null;
let ready = false;

export const storeReady = () => ready;

/** Register products with Play and restore a licence bought on another install. */
export async function initBilling() {
  cdv = w.CdvPurchase;
  if (!cdv?.store) return;
  const { store: st, ProductType, Platform } = cdv;
  st.register([
    { id: PRODUCTS.licence, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY },
    ...PRODUCTS.shards.map((p) => ({ id: p.id, type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY })),
  ]);
  st.when().approved((tx: any) => tx.verify()).verified((r: any) => r.finish());
  await st.initialize([Platform.GOOGLE_PLAY]);
  ready = true;
  setStoreAvailable(true);
  if (st.owned(PRODUCTS.licence) && !store.get().licence.granted) store.update((s) => grantLicence(s, 'restored'));
}

export function priceOf(id: string): string | null {
  return cdv?.store?.get(id)?.pricing?.price ?? null;
}

/** Resolves true once Play has approved the purchase. */
export function buy(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = cdv?.store?.get(id);
    const offer = p?.getOffer?.();
    if (!offer) return resolve(false);
    let settled = false;
    cdv.store.when().finished((tx: any) => {
      if (settled || !tx.products?.some((x: any) => x.id === id)) return;
      settled = true;
      resolve(true);
    });
    offer.order().then((err: any) => { if (err && !settled) { settled = true; resolve(false); } });
  });
}

export async function buyLicence(): Promise<boolean> {
  const ok = await buy(PRODUCTS.licence);
  if (ok) store.update((s) => grantLicence(s, 'play'));
  return ok;
}

// ------------------------------------------------------------------ reminders

const notes = () => w.Capacitor?.Plugins?.LocalNotifications;
export const remindersAvailable = () => !!notes();

const QUEST_ID = 1000;
const CALL_ID = 2000;
const REFRESH_ID = 3000;
const HORIZON = 7;

/** What should be scheduled, a week ahead, given the save. Pure. */
export function plan(s: Save, now = new Date()) {
  const r = s.settings.reminders;
  if (!r.on || !s.onboarded) return [];
  const [qh, qm] = r.at.split(':').map(Number);
  const today = dayKey(now);
  const out: { id: number; title: string; body: string; at: Date }[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const day = addDays(today, i);
    const [y, m, d] = day.split('-').map(Number);
    const at = (h: number, min = 0) => new Date(y, m - 1, d, h, min);
    const clearedToday = i === 0 && s.daily.cleared;
    if (!clearedToday && at(qh, qm) > now) out.push({ id: QUEST_ID + i, title: 'Daily Quest', body: 'The Daily Quest is waiting. Clear it before midnight.', at: at(qh, qm) });
    if (r.lastCall && !clearedToday && at(20) > now) out.push({ id: CALL_ID + i, title: 'Penalty Warning', body: 'The Daily Quest is still open. Miss it and the streak resets.', at: at(20) });
    if (r.refresh && s.training.certified && at(17) > now) out.push({ id: REFRESH_ID + i, title: 'Gates & Exchange', body: 'New Gates stand open and the Exchange has restocked.', at: at(17) });
  }
  return out;
}

let lastPlan = '';

export async function syncReminders(s: Save) {
  const n = notes();
  if (!n) return;
  const want = plan(s);
  const key = JSON.stringify(want.map((x) => [x.id, x.at.getTime()]));
  if (key === lastPlan) return;
  lastPlan = key;
  const ids = [];
  for (let i = 0; i < HORIZON; i++) ids.push({ id: QUEST_ID + i }, { id: CALL_ID + i }, { id: REFRESH_ID + i });
  try {
    await n.cancel({ notifications: ids });
    if (want.length) await n.schedule({ notifications: want.map((x) => ({ id: x.id, title: x.title, body: x.body, schedule: { at: x.at, allowWhileIdle: true }, smallIcon: 'ic_stat_arise' })) });
  } catch { /* the phone refused; the switch says so */ }
}

/** Ask the phone for permission. Only ever called from a tap. */
export async function askNotifications(): Promise<boolean> {
  const n = notes();
  if (!n) return false;
  try {
    const p = await n.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}

export function onReminderTap(go: (where: 'quests' | 'gates') => void) {
  notes()?.addListener?.('localNotificationActionPerformed', (e: any) => {
    const id = e?.notification?.id ?? 0;
    go(id >= REFRESH_ID ? 'gates' : 'quests');
  });
}
