/**
 * The narration layer: what the System and Valcorde say after something
 * happens. Engines change the save; these functions only show it, in order,
 * one window at a time.
 */
import { sfx } from '@/audio/audio';
import { issue } from '@/core/contracts';
import { gearDef } from '@/core/gear';
import * as spire from '@/core/spire';
import { TIER_NAMES, grantText, sweep } from '@/core/missions';
import { syncClass, type XpResult } from '@/core/progression';
import * as story from '@/core/story';
import * as vitals from '@/core/vitals';
import * as store from '@/store';
import { flash } from '@/ui/feedback';
import { sys } from '@/ui/overlays';
import { arena, go, type Route } from './router';

/** Level-ups. Rank changes are announced by their story beat, once. */
export async function celebrate(xp: XpResult | null): Promise<Route | null> {
  if (!xp || xp.levels <= 0) return null;
  sfx.levelUp();
  flash('gold');
  const v = await sys({
    title: 'Level Up', kind: 'gold', center: true,
    lines: [
      `You have reached <em>Level ${xp.to}</em>.`,
      `<strong>+${xp.points}</strong> attribute points are available for allocation.`,
      'Unspent points do nothing. Spend them.',
    ],
    actions: [{ label: 'Later', value: null }, { label: 'Allocate', value: 'profile', primary: true }],
  });
  return (v as Route | null) ?? null;
}

/** Secret Missions and reclassification. */
export async function checkAwards() {
  const fresh = store.update(sweep);
  for (const m of fresh) {
    sfx.rankUp();
    if (m.tier !== 'minor') flash('gold');
    await sys({
      title: 'Secret Mission Complete', kind: 'system', center: true,
      lines: [`<strong>${m.name}</strong> — ${TIER_NAMES[m.tier]}`, m.did, `Granted: <em>${grantText(m)}</em>`],
    });
  }
  const change = store.update(syncClass);
  if (change) {
    await sys({
      title: change.was ? 'Class Upgrade' : 'Class Assigned', kind: 'gold', center: true,
      lines: [
        change.was ? `Your class has changed: <em>${change.was.name}</em> → <strong>${change.cls.name}</strong>.` : `The System has classified you: <strong>${change.cls.name}</strong>.`,
        change.cls.desc,
        `Effect: <em>+${change.cls.bonus} ${change.cls.lead}</em>, and the ${change.cls.lead} line’s combat skills.`,
      ],
    });
    // A class can complete a mission of its own.
    const more = store.update(sweep);
    for (const m of more) await sys({ title: 'Secret Mission Complete', center: true, lines: [`<strong>${m.name}</strong> — ${TIER_NAMES[m.tier]}`, m.did, `Granted: <em>${grantText(m)}</em>`] });
  }
}

export async function playBeats() {
  for (const b of story.pending(store.get())) {
    store.update((s) => story.markSeen(s, b.id));
    if (b.kind === 'gold') flash('gold');
    await sys({ title: b.title, kind: b.kind, lines: b.lines, center: b.center });
  }
}

/** The Spire's week closing, told once, whichever engine call closed it. */
export async function weekClosed() {
  const last = store.get().spire.last;
  if (!last || !store.update((x) => story.markOnce(x, `spire-week-${last.season}`))) return;
  sfx.rankUp();
  flash('gold');
  const item = last.item ? gearDef(last.item)?.name : null;
  await sys({
    title: 'The Week Has Turned', kind: 'gates', center: true,
    lines: [
      `Your highest floor of the Pale Spire last week: <strong>Floor ${last.best}</strong>, which pays at <em>${last.tier}</em>.`,
      `Paid: <span class="grant">${last.shards} Mana Shards</span>${item ? ` and <span class="grant">${item}</span>` : ''}.`,
      'Its floors have rearranged themselves. The climb starts again.',
    ],
  });
}

/** After any payout: level-ups, missions, class, story. Honours an "Allocate" choice. */
export async function rewardChain(xp: XpResult | null, then?: Route) {
  await weekClosed();
  const want = await celebrate(xp);
  await checkAwards();
  await playBeats();
  if (want) go(want);
  else if (then) go(then);
}

let catching = false;

/** Coming back to the app: bring the vitals up to now, then anything the System has been holding. */
export async function catchUp() {
  const s = store.get();
  if (catching || !s.onboarded || arena.get()) return;
  catching = true;
  try {
    store.update((x) => { vitals.settle(x); issue(x); spire.settle(x); });
    await weekClosed();
    await checkAwards();
    await playBeats();
  } finally {
    catching = false;
  }
}
