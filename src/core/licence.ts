/**
 * The Association Licence: the one thing for sale, and only where a store
 * exists (the Android build). Without it a hunter keeps every level, point
 * and Shadow, but the Gate board and the Exchange stop at D-Rank.
 * On the web there is no store, so the game is simply open.
 */
import { gateRank } from './progression';
import type { Rank, Save } from './types';
import { RANKS } from './types';

let storeAvailable = false;

/** Called by the platform layer once it knows whether a store bridge exists. */
export function setStoreAvailable(on: boolean) {
  storeAvailable = on;
}

export const licenceRequired = (s: Save) => storeAvailable && !s.licence.granted;

/** Unlicensed hunters are graded no higher than this for Gates and the Exchange. */
export const UNLICENSED_CAP: Rank = 'D';

/** The grade the board and the shelf answer to. */
export function licensedRank(s: Save): Rank {
  const r = gateRank(s);
  if (!licenceRequired(s)) return r;
  return RANKS.indexOf(r) > RANKS.indexOf(UNLICENSED_CAP) ? UNLICENSED_CAP : r;
}

/** True when the clamp is actually holding this hunter back. */
export const licenceHolding = (s: Save) => licensedRank(s) !== gateRank(s);

export function grantLicence(s: Save, tx: string | null) {
  s.licence = { granted: true, at: new Date().toISOString(), tx };
}
