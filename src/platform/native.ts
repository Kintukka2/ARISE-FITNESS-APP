/**
 * The only module that knows the app might be running inside the Android
 * shell. On the web every function here is inert: no store, no reminders.
 *
 *   - Billing: cordova-plugin-purchase, exposed as `window.CdvPurchase`.
 *   - Reminders: @capacitor/local-notifications, at `Capacitor.Plugins.LocalNotifications`.
 *     One kind only: when fatigue has faded, or the lockout after a wipe lifts.
 */
import { setStoreAvailable, grantLicence } from '@/core/licence';
import { deposit } from '@/core/shop';
import type { Save } from '@/core/types';
import { FATIGUE_PER_HOUR, read } from '@/core/vitals';
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

const READY_ID = 1000;

/** What should be scheduled, given the save. Pure. */
export function plan(s: Save, now = Date.now()) {
  if (!s.settings.reminders.on || !s.onboarded) return [];
  const v = read(s, now);
  if (v.locked) return [{ id: READY_ID, title: 'Fit To Raid', body: 'The Association medics have signed you off. The Gates are open to you again.', at: new Date(now + v.lockedFor) }];
  if (v.fatigue <= 0) return [];
  return [{ id: READY_ID, title: 'Rested', body: 'Your fatigue has faded. You will fight at full strength.', at: new Date(now + (v.fatigue / FATIGUE_PER_HOUR) * 36e5) }];
}

let lastPlan = '';

export async function syncReminders(s: Save) {
  const n = notes();
  if (!n) return;
  const want = plan(s);
  // Only the minute matters: fatigue changes on every render, the reminder should not.
  const key = JSON.stringify(want.map((x) => [x.id, Math.round(x.at.getTime() / 6e4)]));
  if (key === lastPlan) return;
  lastPlan = key;
  try {
    await n.cancel({ notifications: [{ id: READY_ID }] });
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

export function onReminderTap(go: () => void) {
  notes()?.addListener?.('localNotificationActionPerformed', () => go());
}
