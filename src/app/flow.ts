/**
 * The narration layer: what the System and Valcorde say after something
 * happens. Engines change the save; these functions only show it, in order,
 * one window at a time.
 */
import { sfx } from '@/audio/audio';
import * as boon from '@/core/boon';
import { TIER_NAMES, grantText, sweep } from '@/core/missions';
import { syncClass, type XpResult } from '@/core/progression';
import * as quests from '@/core/quests';
import * as story from '@/core/story';
import { BEATS } from '@/data/narrative';
import * as vitals from '@/core/vitals';
import * as store from '@/store';
import { buzz, flash } from '@/ui/feedback';
import { sys } from '@/ui/overlays';
import { arena, go, player, type Route } from './router';

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

/** After any payout: level-ups, missions, class, story. Honours an "Allocate" choice. */
export async function rewardChain(xp: XpResult | null, then?: Route) {
  const want = await celebrate(xp);
  await checkAwards();
  await playBeats();
  if (want) go(want);
  else if (then) go(then);
}

let catching = false;

/** Bring the calendar to today: missed days, the new quest, the week, the Boon. */
export async function catchUp() {
  const s = store.get();
  if (catching || !s.onboarded || player.get() || arena.get()) return;
  catching = true;
  try {
    const events = store.update((x) => {
      vitals.settle(x);
      return quests.rollDay(x);
    });
    for (const e of events) {
      if (e.type === 'penalty') {
        if (!story.seen(store.get(), 'penalty-told')) {
          store.update((x) => story.markOnce(x, 'penalty-told'));
          const beat = BEATS.find((b) => b.id === 'first_penalty')!;
          store.update((x) => story.markSeen(x, beat.id));
          await sys({ title: beat.title, kind: 'danger', lines: beat.lines });
        } else {
          await sys({
            title: 'Penalty Applied', kind: 'danger',
            lines: [
              e.missed > 1 ? `${e.missed} Daily Quests not cleared. The streak has been reset to zero.` : 'Daily Quest not cleared. The streak has been reset to zero.',
              'A <em>Penalty Quest</em> has been issued. It grants no experience.',
              'The <strong>Hollow</strong> debuff is active: all experience halved until the penalty is paid.',
            ],
          });
        }
      } else if (e.type === 'softReset') {
        await sys({ title: 'Instructor Note', kind: 'coach', lines: [e.line] });
      } else if (e.type === 'newWeek') {
        await sys({
          title: e.deload ? 'Deload Week' : 'New Training Block', kind: 'system',
          lines: e.deload
            ? [`Week ${e.week} is a <em>deload</em>. Volume drops by roughly a third.`, 'This is not a reward and it is not optional. Adaptation happens here.']
            : [`Week ${e.week} programme compiled.`, 'Volume has increased. Technique selection has rotated.'],
        });
      }
    }
    if (boon.due(store.get())) await settleBoon();
    await checkAwards();
    await playBeats();
  } finally {
    catching = false;
  }
}

async function settleBoon() {
  const res = store.update((x) => boon.settle(x));
  if (res.total || res.free) {
    sfx.rankUp();
    flash('gold');
    buzz([20, 40, 20, 40, 60]);
    const parts = Object.entries(res.grant).map(([k, n]) => `<strong>+${n} ${boon.statName(k as never)}</strong>`).join(' · ');
    await sys({
      title: 'Boon Bestowed', kind: 'gold', center: true,
      lines: [
        'The period has been assessed. The System bestows.',
        `<em>${res.sets} sets across ${res.days} ${res.days === 1 ? 'day' : 'days'}</em> — assessed as <strong>${res.tier.name}</strong>.`,
        parts || 'Nothing written into your attributes.',
        ...(res.free ? ['The period exceeded what the System expects. <strong>+1 free attribute point</strong> — spend it where you like.'] : []),
        'This is not experience. It has been written directly into your attributes.',
      ],
    });
  } else {
    await sys({
      title: 'Boon Withheld', kind: 'danger',
      lines: [
        'The period has closed.',
        res.sets ? `The System reviewed the period and found <strong>${res.sets}</strong> sets across <strong>${res.days}</strong> ${res.days === 1 ? 'day' : 'days'}.` : 'The System reviewed the period and found nothing.',
        'That is not effort. Nothing is bestowed.',
        'The next period begins now.',
      ],
    });
  }
}
