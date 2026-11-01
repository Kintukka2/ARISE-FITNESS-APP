/**
 * The narration layer: what the System and Valcorde say after something
 * happens. Engines change the save; these functions only show it, in order,
 * one window at a time.
 */
import { sfx } from '@/audio/audio';
import { issue } from '@/core/contracts';
import { gearDef } from '@/core/gear';
import * as spire from '@/core/spire';
import { grantText, sweep, type Mission } from '@/core/missions';
import { optionsAt, syncClass, waiting, type XpResult } from '@/core/progression';
import * as story from '@/core/story';
import * as vitals from '@/core/vitals';
import * as store from '@/store';
import { flash } from '@/ui/feedback';
import { sys } from '@/ui/overlays';
import * as system from '@/ui/system';
import { arena, go, type Route } from './router';

/** Level-ups. Rank changes are announced by their story beat, once. */
export async function celebrate(xp: XpResult | null): Promise<Route | null> {
  if (!xp || xp.levels <= 0) return null;
  sfx.levelUp();
  flash('gold');
  const v = await sys(system.levelUp(xp.levels, xp.to, xp.points));
  return (v as Route | null) ?? null;
}

/** A Secret Quest just completed: the quest, its goal, what it paid. */
const questDone = (m: Mission) => system.notify([
  ...system.event('completed', system.tag(m.name, 'Secret Quest')),
  `Goal: ${m.did}`,
  `Reward: ${system.gain(grantText(m))}`,
], m.tier === 'minor' ? 'system' : 'gold');

/** Secret Quests and reclassification. */
export async function checkAwards() {
  const fresh = store.update(sweep);
  for (const m of fresh) {
    sfx.rankUp();
    if (m.tier !== 'minor') flash('gold');
    await sys(questDone(m));
  }
  const change = store.update(syncClass);
  if (change) {
    const fresh = waiting(store.get()).includes(change.cls.tier) ? optionsAt(change.cls.lead, change.cls.tier) : null;
    const kind = fresh?.kind === 'skill' ? 'Skill' : 'Passive';
    await sys(system.notify([
      change.was ? 'Class changed.' : 'Class assigned.',
      change.was ? system.change(change.was.name, system.tag(change.cls.name, 'Class')) : system.tag(change.cls.name, 'Class'),
      change.cls.desc,
      `${change.cls.lead} ${system.gain(system.signed(change.cls.bonus))}`,
      ...(fresh ? [
        `${kind} available: ${system.tag(fresh.names[0], kind)} or ${system.tag(fresh.names[1], kind)}`,
        `Selected: ${fresh.names[0]}`,
      ] : []),
    ], 'gold'));
    // A class can complete a mission of its own.
    const more = store.update(sweep);
    for (const m of more) await sys(questDone(m));
  }
}

export async function playBeats() {
  for (const b of story.pending(store.get())) {
    store.update((s) => story.markSeen(s, b.id));
    if (b.kind === 'gold') flash('gold');
    await sys({ title: b.title, kind: b.kind, lines: b.lines, center: b.center, actions: [{ label: 'Close', value: null }] });
  }
}

/** The Spire's week closing, told once, whichever engine call closed it. */
export async function weekClosed() {
  const last = store.get().spire.last;
  if (!last || !store.update((x) => story.markOnce(x, `spire-week-${last.season}`))) return;
  sfx.rankUp();
  flash('gold');
  const item = last.item ? gearDef(last.item)?.name : null;
  await sys(system.notify([
    '[The Pale Spire has reset.]',
    system.counter('Highest floor last week', last.best),
    `Reward tier: ${last.tier}`,
    `Mana Shards ${system.gain(system.signed(last.shards))}`,
    ...(item ? system.event('acquired', system.tag(item, 'Item')) : []),
  ], 'gates'));
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
