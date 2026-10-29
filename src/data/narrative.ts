/**
 * Who speaks, and what they say.
 *
 * Ryn Valcorde is the instructor. He does not know the System exists, so
 * nothing he says may reference it. The System speaks in windows.
 */
import type { Save } from '@/core/types';

export const COACH = {
  name: 'Ryn Valcorde',
  role: 'Instructor · Hunter Training',
  bio: 'Cleared 214 Gates. Walked out of the last one alone. Now he runs Hunter Training for the newly Awakened, so nobody else has to walk out alone.',
  creed: 'Knowing how to train does not make you strong. It means the training will.',
};

/** The Awakening Assessment at the Association desk. */
export const ASSESSMENT = [
  'Sit. This takes four minutes and most of it is paperwork.',
  'You registered an Awakening — the scan picked it up this morning. It is faint. Traces of mana, barely over the threshold, but over it.',
  'Measured rank: E. Lowest classification the Association issues.',
  'Before you ask: it does not go up. An Awakening fixes your rank for life. Anyone selling you otherwise is selling you something.',
  'What it does get you is a licence. Official status, legal entry to a Gate, and access to Association facilities.',
];

export const HANDOVER = [
  'There. You are a hunter, on paper.',
  'Your power is fixed. Your competence is not — those are different things, and only one of them is decided for you.',
  'I run Hunter Training. E-Rank who trains beats E-Rank who does not, every single time.',
  'Enrolment is a handful of questions. Answer them honestly and I will build you a programme you can actually keep.',
];

export const TRAINING_BLURB =
  'One short session on how to train at all — how to hold a rep, how hard is hard enough, and what every control on the screen does. Nobody is born knowing this, and the last instructor still bothering to teach it will talk you through it while you do it.';

export const CERTIFIED_LINES = [
  'You are certified. Training still pays — it will keep paying, because a reward that switches off the moment you are good at something teaches the wrong lesson entirely.',
  'Certified. Everything here still works: the programme, the adaptation, the log, the weights. Basic Training paid hard enough to drag you to Level 5. From here you earn it.',
  'Trained hunter. Use it because the training is worth doing, or do not use it. Both are honest.',
];

export const DEBRIEF = {
  crushed: [
    'You beat the prescription on most of that. I am raising the numbers. You did this to yourself.',
    'That was too easy for you and we both know it. Next session gets heavier.',
    'Clean overshoot. The programme adapts up. Do not celebrate — earn the new number.',
  ],
  onTarget: [
    'Exactly the prescription. That is the boring, undefeated way to do this.',
    'On target. Progress is not dramatic, it is just repeated. Again tomorrow.',
    'Textbook. Small overload next time, nothing you will notice until week six.',
  ],
  struggled: [
    'You came in under. Fine — I would rather have honest numbers than flattering ones. Backing the volume off slightly.',
    'That one cost you. Volume drops next session so the quality comes back.',
    'Under target is information, not failure. Adjusting.',
  ],
  brutal: [
    'You rated that brutal. Deloading you before something tears.',
    'Noted. I am cutting the volume — you are no use to me injured.',
    'That was too much. My error, not yours. Fixing it now.',
  ],
  returning: [
    'You disappeared for a while. I am not going to lecture you. I am going to start you lighter than you want.',
    'Back after a gap. The programme has been reset to something you can actually finish. Rebuild the streak first, ego second.',
  ],
};

export const GREETINGS = [
  'Show me something.',
  'The window is open. Get to work.',
  'No warm-up speech today. Move.',
  'You are here. That is most of it.',
  'Same as yesterday. That is the whole secret.',
  'Nothing clever today. Just the work.',
];

export const PRAISE = [
  'Good job.', 'Well done.', 'That one counted.', 'Logged.', 'Nicely done.', 'Recorded, and well earned.',
  'Strong work.', 'That is one more than yesterday.', 'Keep going.', 'Clean.', 'That is the work done.',
  'Progress registered.', 'That is exactly it.', 'One down.', 'Solid.', 'The System sees it.',
  'That was work, and it counted.', 'You are moving.', 'Every rep lands somewhere.',
  'Better than the version who skipped it.', 'That is how it is done.', 'Nothing wasted there.',
  'You showed up for that one.', 'Held it to the end.', 'That is discipline, quietly.', 'Good pace.',
  'Finished properly.', 'The number moved because you moved.', 'That will show up later.', 'Steady.',
  'You are stronger than that set.', 'One more line closed.', 'That counts double on a hard day.',
  'You kept your word to yourself.', 'That is the standard.', 'No shortcuts detected.', 'That was earned.',
  'Onwards.', 'Registered, hunter.', 'The hard part is already behind you.', 'Take the win.',
  'That is going on the record.', 'Good, and again tomorrow.', 'Consistency looks exactly like that.',
  'Done, and done well.', 'Keep that up.',
];

export type WindowKind = 'system' | 'coach' | 'danger' | 'gold' | 'gates' | 'shadow';

export interface Beat {
  id: string;
  when: (s: Save) => boolean;
  kind: WindowKind;
  title: string;
  lines: string[];
  center?: boolean;
}

/** Story beats, in order. Each fires once, the first time its condition holds. */
export const BEATS: Beat[] = [
  {
    id: 'first_quest', when: (s) => !!s.daily.quest, kind: 'system', title: 'Daily Quest Issued', center: true,
    lines: [
      'A <em>Daily Quest</em> has been issued:<br><em>10 push-ups</em>,<br><em>10 sit-ups</em>,<br><em>10 bodyweight squats</em>.',
      'It resets at midnight, local time.',
      '<span class="warn">Warning: failure will apply a penalty on the following day.</span>',
    ],
  },
  {
    id: 'resonance_intro', when: (s) => s.stats.questsCleared >= 1, kind: 'system', title: 'Notification', center: true,
    lines: [
      'Clearing the <em>Daily Quest</em> raises your <em>Resonance</em>.',
      'Resonance multiplies all experience you earn, +0.01 for every consecutive day. A missed day extinguishes it.',
    ],
  },
  {
    id: 'first_clear', when: (s) => !!s.program && s.stats.programRuns >= 1, kind: 'coach', title: 'Debrief',
    lines: [
      'Your first session off the programme I built you. Congratulations — statistically that puts you ahead of about eighty percent of people who install something like this.',
      'It also means nothing yet. Anyone can do one session. Come back for the second and I will start taking you seriously.',
    ],
  },
  {
    id: 'lv3', when: (s) => s.hunter.level >= 3, kind: 'coach', title: 'Valcorde',
    lines: [
      'Level three. Your programme is already adapting to what you actually complete, not what you claimed you could do in the interview.',
      'Everyone inflates that interview. I built the generator assuming you did.',
    ],
  },
  {
    id: 'certified', when: (s) => s.training.certified, kind: 'coach', title: 'Basic Hunter Training — Certified',
    lines: [
      'That is the syllabus. One session, every control on it, and you did the work while I talked. You are on file as trained.',
      'Sessions keep paying experience — <em>every</em> session, for as long as you keep turning up — at the ordinary rate from here.',
      'The programme still adapts, the log still fills, the weights still carry forward. I am still here if you need me; I am simply no longer standing over you.',
    ],
  },
  {
    id: 'gates_unlocked', when: (s) => s.training.certified, kind: 'gates', title: 'Gate Detected', center: true,
    lines: [
      'A <strong>Gate</strong> has formed within your area.',
      'The Gate is the door. Behind it is a <strong>Dungeon</strong> — a sealed dimension holding hostile creatures. <strong>Mana Shards</strong> and equipment can be recovered by clearing them.',
      'The Gate closes once its Boss has been defeated.',
      '<span class="grant">ACCESS GRANTED: DUNGEONS</span>',
    ],
  },
  {
    id: 'first_penalty', when: (s) => s.stats.questsFailed >= 1, kind: 'danger', title: 'Penalty Applied',
    lines: [
      'You did not clear yesterday’s Daily Quest.',
      'A <em>Penalty Quest</em> has been issued. It grants no experience. It exists only to be paid.',
      'Until it is cleared you carry the <strong>Hollow</strong> debuff: all experience gained is halved.',
      'Something on the other side of the Gates just got a little heavier.',
    ],
  },
  {
    id: 'streak7', when: (s) => s.streak.current >= 7, kind: 'system', title: 'Seven Consecutive Days',
    lines: [
      'Seven days without a break in the record. <em>Resonance</em> is climbing: every consecutive day adds +0.01 to all experience gained.',
      'Do not treat this as permission.',
    ],
  },
  {
    id: 'first_shadow', when: (s) => s.shadows.army.length >= 1, kind: 'shadow', title: 'Shadow Extraction',
    lines: [
      'Something that died in front of you did not stay down.',
      'It stood back up in your shadow, and it is waiting to be told what to do.',
      '<span class="grant">ACCESS GRANTED: SHADOWS</span>',
    ],
  },
  {
    id: 'perfect_resonance', when: (s) => s.stats.perfectDays >= 1, kind: 'gold', title: 'Perfect Resonance',
    lines: [
      'One hundred consecutive days. The System has stopped treating you as a variable.',
      'Resonance is at its ceiling: <strong>×2.00</strong> on all experience. It will not climb further.',
      'It can still be lost. One missed day returns you to zero, and the climb back is the same hundred days.',
      '<em>The Hollow Monarch is made of people who got this far and then stopped.</em>',
    ],
  },
  {
    id: 'rank_d', when: (s) => s.hunter.level >= 10, kind: 'system', title: 'Rank Advancement · D',
    lines: [
      'Sustained output detected across multiple cycles. Reclassification approved.',
      'You are now <em>D-Rank</em>. The System classifies hunters from this grade: a <strong>Class</strong> will be read off how your attributes have actually settled, not off what you say you are.',
      'Bonus attribute points awarded.',
    ],
  },
  {
    id: 'monarch_whisper', when: (s) => s.hunter.level >= 15, kind: 'danger', title: '???',
    lines: [
      'The window flickers. The text is not in the System’s font.',
      '<em>“You are noisy for a small thing.”</em>',
      '<em>“I have eaten ten thousand of you. They all started exactly like this — loud, early, certain.”</em>',
      'The window closes itself.',
    ],
  },
  {
    id: 'rank_c', when: (s) => s.hunter.level >= 20, kind: 'system', title: 'Rank Advancement · C',
    lines: [
      'You are now <em>C-Rank</em>.',
      'Your <strong>Class</strong> is read off your attributes at every grade, and it pays points into the one it is named for.',
      'Classes are not permanent. Train differently and you will be reclassified.',
      'Bonus attribute points awarded.',
    ],
  },
  {
    id: 'valcorde_past', when: (s) => s.hunter.level >= 25, kind: 'coach', title: 'Off The Record',
    lines: [
      'You are past the point where most people stop, so you get the real version.',
      'I did not retire. My last Gate collapsed with nine of us inside and I was the only one conditioned well enough to still be moving at hour six.',
      'That is the entire difference. Not talent. Not gear. Still moving at hour six.',
      'That is what we are building. Everything else is decoration.',
    ],
  },
  {
    id: 'rank_b', when: (s) => s.hunter.level >= 35, kind: 'system', title: 'Rank Advancement · B',
    lines: [
      'You are now <em>B-Rank</em>. Fewer than two percent of Awakened reach this classification.',
      'Archive access granted. One record has been unsealed for you:',
      '<em>“Player designation was offered to a prior candidate. The candidate declined. The System does not re-offer. It re-selects.”</em>',
      'You were not first. You were next.',
    ],
  },
  {
    id: 'monarch_named', when: (s) => s.hunter.level >= 42, kind: 'danger', title: 'The Hollow Monarch',
    lines: [
      '<em>“Do you know what I am made of?”</em>',
      '<em>“Rest days that became weeks. Programmes bought and never opened. The exact moment a person decides that tomorrow is a better day to start.”</em>',
      '<em>“You have fed me before. I remember the taste.”</em>',
      '<em>“Keep climbing. I would rather eat something that fought.”</em>',
    ],
  },
  {
    id: 'rank_a', when: (s) => s.hunter.level >= 50, kind: 'system', title: 'Rank Advancement · A',
    lines: [
      'You are now <em>A-Rank</em>.',
      'A third Shadow may now walk into a Gate beside you.',
      'A Gate of unprecedented density is forming. It will not open until you are S-Rank.',
      'Continue.',
    ],
  },
  {
    id: 'rank_s', when: (s) => s.hunter.level >= 70, kind: 'system', title: 'Rank Advancement · S — Final Gate Unsealed',
    lines: [
      'You are now <em>S-Rank</em>. There is no higher classification the Association is authorised to grant.',
      'The dense Gate has stabilised. Its occupant has been waiting for a very long time.',
      '<strong>THE HOLLOW THRONE</strong> now stands open on the Gate board. It does not close at midnight.',
      'Instructor Valcorde has left one message: <em>“Do not go in tired. Go in consistent.”</em>',
    ],
  },
  {
    id: 'monarch_slain', when: (s) => s.gates.cleared.includes('DNG-HOLLOW'), kind: 'gold', title: 'The Hollow Monarch Has Fallen',
    lines: [
      'The throne is empty. The thing that sat on it was made of every day somebody chose not to train.',
      'It is not gone. It never can be. It is simply smaller than you now, and it will stay that way for exactly as long as you keep showing up.',
      'The System has nothing left to warn you about.',
    ],
  },
  {
    id: 'sovereign', when: (s) => s.hunter.level >= 100, kind: 'system', title: 'Beyond Classification',
    lines: [
      'Level 100.',
      'The System has no further ranks to award, no further grades to license, and no further warnings to give.',
      'You are <em>Sovereign</em>. The Gates now open for you, not at you.',
      'The record continues. It always did. That was the entire mechanism.',
    ],
  },
];
