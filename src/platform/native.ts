/**
 * The only module that knows the app might be running inside the Android
 * shell. On the web every function here is inert: no store, no reminders.
 *
 *   - Billing: cordova-plugin-purchase, exposed as `window.CdvPurchase`.
 *   - Reminders: @capacitor/local-notifications, at `Capacitor.Plugins.LocalNotifications`.
 */
import { setStoreAvailable, grantLicence } from '@/core/licence';
import { deposit } from '@/core/shop';
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
const waiting = new Map<string, (ok: boolean) => void>();

export const storeReady = () => ready;

/**
 * Register products with Play. Every approved transaction is credited here,
 * once (deduplicated by transaction id), then finished — including ones that
 * completed while the app was closed, or that were approved later.
 */
export async function initBilling() {
  // A sideloaded debug APK has no Play listing to buy from; it is built with billing off.
  if (import.meta.env.VITE_BILLING === 'off') return;
  cdv = w.CdvPurchase;
  if (!cdv?.store) return;
  // The bridge exists, so the licence applies from this moment — not once Play answers.
  setStoreAvailable(true);
  const { store: st, ProductType, Platform } = cdv;
  st.register([
    { id: PRODUCTS.licence, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY },
    ...PRODUCTS.shards.map((p) => ({ id: p.id, type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY })),
  ]);
  st.when()
    .approved((tx: any) => tx.verify())
    .verified((receipt: any) => {
      for (const tx of receipt.transactions ?? [receipt]) {
        const ids: string[] = (tx.products ?? []).map((p: any) => p.id);
        const txId = String(tx.transactionId ?? tx.id ?? '');
        for (const id of ids) {
          if (id === PRODUCTS.licence) store.update((s) => grantLicence(s, txId || 'play'));
          const pack = PRODUCTS.shards.find((p) => p.id === id);
          if (pack && txId) store.update((s) => deposit(s, pack.amount, txId));
          waiting.get(id)?.(true);
          waiting.delete(id);
        }
      }
      receipt.finish();
    });
  try {
    await st.initialize([Platform.GOOGLE_PLAY]);
    ready = true;
    if (st.owned(PRODUCTS.licence) && !store.get().licence.granted) store.update((s) => grantLicence(s, 'restored'));
  } catch (e) {
    console.warn('ARISE: the store did not start', e);
  }
}

export function priceOf(id: string): string | null {
  return cdv?.store?.get(id)?.pricing?.price ?? null;
}

/** Resolves true once Play has approved and the purchase has been credited. */
export function buy(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const offer = cdv?.store?.get(id)?.getOffer?.();
    if (!offer) return resolve(false);
    waiting.set(id, resolve);
    offer.order().then((err: any) => {
      if (!err) return;
      waiting.delete(id);
      resolve(false);
    });
  });
}

export const buyLicence = () => buy(PRODUCTS.licence);

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
