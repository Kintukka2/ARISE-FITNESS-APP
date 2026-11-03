/**
 * The narration layer: what the System and Valcorde say after something
 * happens. Engines change the save; these functions only show it, in order,
 * one window at a time.
 */
import { sfx } from '@/audio/audio';
import { issue } from '@/core/contracts';
import { gearDef } from '@/core/gear';
import { enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as spire from '@/core/spire';
import { grantText, sweep, type Mission } from '@/core/missions';
import { optionsAt, reclassify, syncClass, waiting, type XpResult } from '@/core/progression';
import { reclassification } from '@/core/quests';
import * as story from '@/core/story';
import * as vitals from '@/core/vitals';
import * as store from '@/store';
import { fromEl, promotion, rankUp } from '@/ui/arrival';
import { flash } from '@/ui/feedback';
import { closeAllSheets, sys } from '@/ui/overlays';
import * as system from '@/ui/system';
import { openStatus } from '@/screens/Inventory';
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

/** A rank the level has reached: told once, in gold, and left on the Quests screen for the hunter to claim. */
export async function reclassReady() {
  const q = reclassification(store.get());
  if (!q?.ready || !store.update((x) => story.markOnce(x, `reclass-ready-${q.to.key}`))) return;
  sfx.rankUp();
  flash('gold');
  await sys(system.notify(['You have met the requirements for', `${system.tag(`Reclassification: ${q.to.name}`)}.`], 'gold'));
}

/**
 * The hunter claims the rank their level has reached, from its Reclassification window. The plate
 * lifts off the window and the rank-up plays; the claim lands once the screen is covered, so nothing
 * is seen changing behind it. Then the System says what it brought, over what the breach left: the
 * rank's own window, the class it assigns, any Secret Quest, and the next rank if the level has
 * reached that too.
 */
export async function claimRank(plate: Element | null) {
  const q = reclassification(store.get());
  if (!q?.ready) return;
  const lifted = plate instanceof HTMLElement || plate instanceof SVGElement ? plate : null;
  const from = fromEl(plate);
  if (lifted) lifted.style.visibility = 'hidden';
  let claimed = false;
  const claim = () => { if (!claimed) claimed = !!store.update(reclassify); };
  const cut = rankUp({ from, was: q.from.key, now: q.to.key, onDark: claim });
  try {
    await cut.ready;
    claim();
    await playBeats();
    await checkAwards();
    await reclassReady();
    await cut.leave();
  } finally {
    cut.stop();
    if (lifted) lifted.style.visibility = '';
    // Past the last rank there is no Reclassification left to show.
    if (!reclassification(store.get())) closeAllSheets();
  }
}

/**
 * A Shadow promoted from its card, as a rank is claimed: the hold has fired, the badge lifts off the
 * card into the promotion, the promotion is made while the screen is dark, and the System says what
 * the rank brought once the breach has settled.
 */
export async function claimPromotion(id: string, badge: Element | null) {
  const sh = store.get().shadows.army.find((x) => x.id === id);
  const e = sh && enemyById(sh.enemyId);
  if (!sh || !e || !shadows.canPromote(sh)) return;
  const was = shadows.rankIndex(sh);
  const lifted = badge instanceof HTMLElement || badge instanceof SVGElement ? badge : null;
  const from = fromEl(badge);
  if (lifted) lifted.style.visibility = 'hidden';
  let made: shadows.Promotion | null = null;
  const claim = () => { if (!made) made = store.update((x) => shadows.promote(x, id)) ?? null; };
  const cut = promotion({ from, family: e.family, was, now: was + 1, onDark: claim });
  try {
    await cut.ready;
    claim();
    const p = made as shadows.Promotion | null;
    if (p) {
      const R = shadows.SHADOW_RANKS;
      await sys({
        ...system.notify([
          `${system.tag(e.shadow)} has been promoted.`,
          system.gain(`${R[p.from].name} Rank → ${R[p.to].name} Rank`),
          `Growth limit: ${system.change(`+${Math.round(R[p.from].cap * 100)}%`, `+${Math.round(R[p.to].cap * 100)}%`)}`,
          ...(p.second ? [`Skill learned: ${system.tag(p.second)}`] : []),
        ], 'shadow'),
        typed: false,
      });
    }
    await checkAwards();
    await cut.leave();
  } finally {
    cut.stop();
    if (lifted) lifted.style.visibility = '';
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
  await reclassReady();
  if (want) go(want);
  else if (then) go(then);
  // Allocate means spend them: the Status sheet is where Ability Points go.
  if (want === 'inventory') openStatus();
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
    await reclassReady();
  } finally {
    catching = false;
  }
}
