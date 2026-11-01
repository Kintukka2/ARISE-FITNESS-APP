/**
 * Who speaks, and what they say.
 *
 * Ryn Valcorde is the Association's instructor: a retired hunter who walks
 * new licences through their first Gates. He does not know the System
 * exists, so nothing he says may reference it. The System speaks in windows.
 */
import type { Save } from '@/core/types';
import { CONTRACTS_PER_DAY } from './contracts';
import { BLOCK, SPIRE_OPENS } from './spire';
import { ASCENSION_RULED } from './ascension';

/** The Awakening Assessment at the Association desk. */
export const ASSESSMENT = [
  'Sit. This takes four minutes and most of it is paperwork.',
  'You registered an Awakening — the scan picked it up this morning. It is faint. Traces of mana, barely over the threshold, but over it.',
  'Measured rank: E. Lowest classification the Association issues.',
  'Before you ask: it does not go up. An Awakening fixes your rank for life. Anyone selling you otherwise is selling you something.',
  'What it does get you is a licence. Official status, legal entry to a Gate, and access to Association facilities.',
];

export const HANDOVER = [
  'There. You are a hunter, on paper. The grey kit on the counter is yours — it is not much, and it is not meant to be.',
  'Your power is fixed. Your competence is not — those are different things, and only one of them is decided for you.',
  'I run Hunter Training. The Association keeps one gate shut for first-timers, and I walk every new licence through it once.',
  'Nothing in there is dangerous. Go in with me, watch what the party does, and read the brief before you read anything else.',
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
    id: 'gates_unlocked', when: (s) => s.onboarded, kind: 'gates', title: 'Gate Detected', center: true,
    lines: [
      'A <strong>Gate</strong> has formed within your area.',
      'The Gate is the door. Behind it is a <strong>Dungeon</strong> — a sealed dimension holding hostile creatures. <strong>Experience</strong>, <strong>Mana Shards</strong> and equipment can be recovered by clearing them.',
      'The Gate closes once its Boss has been defeated.',
      '<span class="grant">ACCESS GRANTED: DUNGEONS</span>',
    ],
  },
  {
    id: 'first_kill', when: (s) => s.gates.cleared.includes('DNG-000'), kind: 'system', title: 'Notification', center: true,
    lines: [
      'First kill registered.',
      'The System has counted what you did in there, and it pays in <em>experience</em>. Every Gate you clear will be counted the same way — the deeper the grade, the more it is worth.',
      'Levels pay attribute points. <span class="warn">Unspent points do nothing.</span>',
    ],
  },
  {
    id: 'contracts_issued', when: (s) => s.gates.cleared.includes('DNG-000'), kind: 'system', title: 'Contracts Issued', center: true,
    lines: [
      `The System has issued you <strong>${CONTRACTS_PER_DAY} contracts</strong>. They are posted on the Gates screen.`,
      'Each pays <em>Mana Shards</em> and experience the moment it is done. All of them together pay a bonus.',
      'New ones are issued at midnight. One left undone lapses. <span class="warn">The System does not punish what it did not get.</span>',
    ],
  },
  {
    id: 'lv3', when: (s) => s.gates.clears >= 3, kind: 'coach', title: 'Valcorde',
    lines: [
      'Three gates and you are still walking. Good. Here is the part the brochure leaves out.',
      'The board will always have something on it. Your body will not. Fatigue is what kills hunters at your grade — not the boss, the fourth gate of the afternoon.',
    ],
  },
  {
    id: 'spire_open', when: (s) => s.gates.clears >= SPIRE_OPENS, kind: 'coach', title: 'Valcorde',
    lines: [
      `${SPIRE_OPENS} gates cleared. That is enough that I can tell you about the one that does not close.`,
      `The Pale Spire. It opened over the old reservoir before either of us held a licence, and every boss killed inside it opens another floor above. You climb it ${BLOCK} floors at a time, with a rest before each boss.`,
      'It rearranges itself every Monday, and everyone starts again from their own grade’s floors. The Association pays at the end of each week for how high you got. You will find it on the Gates screen.',
    ],
  },
  {
    id: 'ascension_open', when: (s) => s.ascension.unlocked >= 1, kind: 'gold', title: 'Ascension', center: true,
    lines: [
      'The System has noted that the gates no longer trouble you.',
      `It offers <strong>Ascension</strong>: a ladder with no top, each level harder than the last and paying more. The first ${ASCENSION_RULED} each add a rule, and every level keeps the rules of the levels below it.`,
      'Choose a level on the Gates screen before you go in; the brief assesses the gate at it. Prove a level and face its Trial, and the next opens. <span class="warn">Nothing makes you climb.</span>',
    ],
  },
  {
    id: 'first_defeat', when: (s) => s.gates.fails >= 1, kind: 'danger', title: 'Carried Out',
    lines: [
      'The party could not hold, and you were dragged out by the people who could still walk.',
      'The Association medics will not let you back into a Gate until they are satisfied. That is not a punishment. It is the reason they still have hunters.',
      'Read the assessment next time. It was not lying.',
    ],
  },
  {
    id: 'seven_unbroken', when: (s) => s.gates.unbroken >= 7, kind: 'system', title: 'Seven Consecutive Clears',
    lines: [
      'Seven Gates closed without the party breaking.',
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
    id: 'rank_d', when: (s) => s.hunter.level >= 10, kind: 'system', title: 'Rank Advancement · D',
    lines: [
      'Sustained output detected across multiple Gates. Reclassification approved.',
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
      'Classes are not permanent. Spend differently and you will be reclassified.',
      'Bonus attribute points awarded.',
    ],
  },
  {
    id: 'valcorde_past', when: (s) => s.hunter.level >= 25, kind: 'coach', title: 'Off The Record',
    lines: [
      'You are past the point where most people stop, so you get the real version.',
      'I did not retire. My last Gate collapsed with nine of us inside and I was the only one still moving at hour six.',
      'Not the strongest. Not the best kitted. The one who had paced himself, and had something left when the walls came in.',
      'That is the whole trade. Everything else is decoration.',
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
      '<em>“Hunters who stopped at the grade that frightened them. Gates walked past because the brief looked bad. The exact moment a person decides they have climbed far enough.”</em>',
      '<em>“Every one of them is still in here with me.”</em>',
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
      'Instructor Valcorde has left one message: <em>“Do not go in tired. Go in with something left.”</em>',
    ],
  },
  {
    id: 'monarch_slain', when: (s) => s.gates.cleared.includes('DNG-HOLLOW'), kind: 'gold', title: 'The Hollow Monarch Has Fallen',
    lines: [
      'The throne is empty. The thing that sat on it was made of every hunter who stopped climbing.',
      'It is not gone. It never can be. It is simply smaller than you now, and it will stay that way for exactly as long as you keep going in.',
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
