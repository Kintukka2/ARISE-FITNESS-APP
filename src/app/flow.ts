/**
 * The narration layer: what the System and Valcorde say after something
 * happens. Engines change the save; these functions only show it, in order,
 * one window at a time.
 */
import { sfx } from '@/audio/audio';
import { issue } from '@/core/contracts';
import { gearDef } from '@/core/gear';
import * as association from '@/core/association';
import { enemyById } from '@/core/gates';
import * as shadows from '@/core/shadows';
import * as spire from '@/core/spire';
import { grantText, sweep, type Mission } from '@/core/missions';
import { reclassify, syncClass, type XpResult } from '@/core/progression';
import { points as skillPoints } from '@/core/skilltree';
import { SKILL_POINTS } from '@/data/tree';
import { reclassification } from '@/core/quests';
import * as story from '@/core/story';
import * as vitals from '@/core/vitals';
import * as store from '@/store';
import { fromEl, promotion, rankUp } from '@/ui/arrival';
import { closeAllSheets, sys } from '@/ui/overlays';
import * as system from '@/ui/system';
import { openStatus } from '@/screens/Inventory';
import { arena, go, type Route } from './router';
import * as ascension from '@/core/ascension';
import { isPractice } from '@/core/gates';
import * as raid from '@/core/raid';
import type { Dungeon } from '@/core/types';
import { buzz, flash } from '@/ui/feedback';
import { drinkFlow } from '@/screens/Inventory';

/** Level-ups. Rank changes are announced by their story beat, once. */
export async function celebrate(xp: XpResult | null): Promise<Route | null> {
  if (!xp || xp.levels <= 0) return null;
  sfx.levelUp();
  flash('gold');
  const v = await sys(system.levelUp(xp.levels, xp.to, xp.points, xp.levels * SKILL_POINTS.level));
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
    const sp = skillPoints(store.get());
    await sys(system.notify([
      change.was ? 'Class changed.' : 'Class assigned.',
      change.was ? system.change(change.was.name, system.tag(change.cls.name, 'Class')) : system.tag(change.cls.name, 'Class'),
      change.cls.desc,
      `${change.cls.lead} ${system.gain(system.signed(change.cls.bonus))}`,
      ...(sp ? [`Skill Points: ${sp}`] : []),
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
  // A new grade redraws a job of Ryn's left below it (`association.issue`).
  const claim = () => { if (!claimed) { claimed = !!store.update(reclassify); store.update((x) => association.issue(x)); } };
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
  if (!sh || !e || !shadows.canPromote(store.get(), sh)) return;
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
          `${system.tag(shadows.nameOf(sh))} has been promoted.`,
          system.gain(`${R[p.from].name} Rank → ${R[p.to].name} Rank`),
          `Level cap: ${system.change(R[p.from].cap, system.gain(R[p.to].cap))}`,
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

/**
 * Promote and awaken every ready Shadow at once, from the Army's Ready count: the System's offer first,
 * naming each and what it takes, and the Essence it all costs; then the promotion's cinematic once, on
 * the first promoted, from `badge`; then one window with every one of them. Awakenings alone play no
 * cinematic, as one awakened from its card plays none.
 */
export async function claimAll(badge: Element | null) {
  const s = store.get();
  const preview = shadows.claimAll(structuredClone(s));
  const all = [...preview.promoted, ...preview.awakened];
  if (!all.length) return;
  const R = shadows.SHADOW_RANKS;
  const nameOf = (id: string) => {
    const sh = s.shadows.army.find((x) => x.id === id);
    return sh ? shadows.nameOf(sh) : 'Shadow';
  };
  const verb = preview.promoted.length && preview.awakened.length ? 'promote and awaken' : preview.promoted.length ? 'promote' : 'awaken';
  const left = shadows.waitingAll(s).length - all.length;
  const ok = await sys(system.offer([
    `Would you like to ${verb} every ready Shadow?`,
    ...preview.promoted.map((p) => `${system.tag(nameOf(p.id))} ${system.change(`${R[p.from].name} Rank`, system.gain(`${R[p.to].name} Rank`))}`),
    ...preview.awakened.map((w) => `${system.tag(nameOf(w.id))} ${system.gain(`Awakening ${'★'.repeat(w.to)}`)}`),
    `Shadow Essence ${system.red(system.signed(-preview.essence))}`,
    ...(left > 0 ? [system.red(`Not enough Shadow Essence for ${left} more.`)] : []),
  ], 'shadow', verb === 'awaken' ? 'Awaken All' : 'Promote All', 'Cancel'));
  if (ok !== true) return;
  const first = preview.promoted[0];
  const firstSh = first && s.shadows.army.find((x) => x.id === first.id);
  const e = firstSh && enemyById(firstSh.enemyId);
  let made: shadows.Claimed | null = null;
  const claim = () => { if (!made) made = store.update((x) => shadows.claimAll(x)); };
  const lines = (got: shadows.Claimed) => [
    ...got.promoted.flatMap((p) => [
      `${system.tag(nameOf(p.id))} has been promoted.`,
      `${system.gain(`${R[p.from].name} Rank → ${R[p.to].name} Rank`)} · Level cap: ${system.change(R[p.from].cap, system.gain(R[p.to].cap))}`,
      ...(p.second ? [`Skill learned: ${system.tag(p.second)}`] : []),
    ]),
    ...got.awakened.map((w) => `${system.tag(nameOf(w.id))} has awakened. ${system.gain(`Awakening ${'★'.repeat(w.to)}`)}`),
  ];
  if (!first || !e || !firstSh) {
    claim();
    sfx.rankUp();
    flash('shadow');
    await sys({ ...system.notify(lines(made!), 'shadow'), typed: false });
    await checkAwards();
    return;
  }
  const cut = promotion({ from: fromEl(badge), family: e.family, was: first.from, now: first.to, onDark: claim });
  try {
    await cut.ready;
    claim();
    await sys({ ...system.notify(lines(made!), 'shadow'), typed: false });
    await checkAwards();
    await cut.leave();
  } finally {
    cut.stop();
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

/** After any payout: level-ups, missions, class, story. Honours an "Allocate" choice, and returns where it went. */
export async function rewardChain(xp: XpResult | null, then?: Route): Promise<Route | null> {
  await weekClosed();
  const want = await celebrate(xp);
  await checkAwards();
  await playBeats();
  await reclassReady();
  if (want) go(want);
  else if (then) go(then);
  // Allocate means spend them: the Status sheet is where Ability Points go.
  if (want === 'inventory') openStatus();
  return want;
}

/**
 * Walk into a Gate: past the fatigue warning first, as the brief gives it, then the run begins and the
 * arena opens on it. False if the hunter turned back, or drank a potion instead.
 */
export async function enterGate(d: Dungeon): Promise<boolean> {
  const s = store.get();
  const f = vitals.read(s).fatigue;
  if (f > 20 && !isPractice(d)) {
    const level = ascension.entryLevel(s, d, isPractice(d));
    const cost = Math.round((vitals.RAID_FATIGUE[d.rank] ?? 10) * raid.fatigueShare(s, level));
    const want = await sys({
      ...system.notify([
        system.counter('Fatigue', f),
        `You will fight at ${system.red(`${Math.round(vitals.drag(f) * 100)}%`)} strength.`,
        `Fatigue on entry: +${cost}`,
      ], 'gates', [{ label: 'Rest First', value: false }, { label: 'Drink Fatigue Potion', value: 'drink' }, { label: 'Enter Anyway', value: true, primary: true }]),
      glyph: 'warn', typed: false,
    });
    if (want === 'drink') { await drinkFlow('fatigue'); return false; }
    if (!want) return false;
  }
  closeAllSheets();
  store.update((x) => raid.begin(x, d));
  sfx.gate();
  buzz([26, 40, 20, 40, 90]);
  arena.set(d.id);
  return true;
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
