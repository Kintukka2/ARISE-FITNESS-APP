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
import { ASCENSION_TOP } from './ascension';
import { SLOTS } from './shadows';
import { arrival, change, counter, event, foe, tag, unlock } from '@/ui/system';

/** The Awakening Assessment at the Association desk. */
export const ASSESSMENT = [
  'Sit. This takes four minutes and most of it is paperwork.',
  'You registered an Awakening. The scan picked it up this morning. It is faint. Traces of mana, barely over the threshold, but over it.',
  'Measured rank: E. Lowest classification the Association issues.',
  'Before you ask: it does not go up. An Awakening fixes your rank for life. Anyone selling you otherwise is selling you something.',
  'What it does get you is a licence. Official status, legal entry to a Gate, and access to Association facilities.',
];

export const HANDOVER = [
  'There. You are a hunter, on paper. The grey kit on the counter is yours. It is not much, and it is not meant to be.',
  'Your power is fixed. Your competence is not. Only one of the two is decided for you.',
  'I run Hunter Training. The Association keeps one Gate shut for first-timers, and I walk every new licence through it once.',
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
    id: 'gates_unlocked', when: (s) => s.onboarded, kind: 'gates', title: 'Notification', center: true,
    lines: ['[A Gate has formed in your area.]', unlock('Gates')],
  },
  {
    id: 'contracts_issued', when: (s) => s.gates.cleared.includes('DNG-000'), kind: 'system', title: 'Notification', center: true,
    lines: [arrival('Daily Quests', true), counter('Daily Quests completed', 0, CONTRACTS_PER_DAY)],
  },
  {
    id: 'lv3', when: (s) => s.gates.clears >= 3, kind: 'coach', title: 'Valcorde',
    lines: [
      'Three Gates and you are still walking. Good. Here is the part the brochure leaves out.',
      'The board will always have something on it. Your body will not. Fatigue is what kills hunters at your grade. Not the boss: the fourth Gate of the afternoon.',
    ],
  },
  {
    id: 'spire_open', when: (s) => s.gates.clears >= SPIRE_OPENS, kind: 'coach', title: 'Valcorde',
    lines: [
      `${SPIRE_OPENS} Gates cleared. That is enough that I can tell you about the one that does not close.`,
      `The Pale Spire. It opened over the old reservoir before either of us held a licence, and every boss killed inside it opens another floor above. You climb it ${BLOCK} floors at a time, with a rest before each boss.`,
      'It rearranges itself every Monday, and everyone starts again from their own grade’s floors. The Association pays at the end of each week for how high you got. You will find it on the Gates screen.',
    ],
  },
  {
    id: 'ascension_open', when: (s) => s.ascension.unlocked >= 1, kind: 'gold', title: 'Notification', center: true,
    lines: [unlock('Ascension'), counter('Ascension levels unlocked', 1, ASCENSION_TOP)],
  },
  {
    id: 'first_defeat', when: (s) => s.gates.fails >= 1, kind: 'coach', title: 'Valcorde',
    lines: [
      'The party could not hold. The ones who could still walk dragged you out.',
      'The medics will not let you back into a Gate until they are satisfied. That is not a punishment. It is the reason they still have hunters.',
      'Read the assessment next time. It was not lying.',
    ],
  },
  {
    id: 'seven_unbroken', when: (s) => s.gates.unbroken >= 7, kind: 'system', title: 'Notification', center: true,
    lines: ['[7 consecutive Gates cleared.]'],
  },
  {
    id: 'first_shadow', when: (s) => s.shadows.army.length >= 1, kind: 'shadow', title: 'Notification', center: true,
    lines: ['[A Shadow has joined your army.]', unlock('Shadows')],
  },
  {
    id: 'rank_d', when: (s) => s.hunter.level >= 10, kind: 'gold', title: 'Notification', center: true,
    lines: ['Reclassification approved.', `Rank: ${change('E', 'D')}`, unlock('Class')],
  },
  {
    id: 'monarch_whisper', when: (s) => s.hunter.level >= 15, kind: 'danger', title: '???',
    lines: [
      'The window flickers. The text is not in the System’s font.',
      '<em>“You are noisy for a small thing.”</em>',
      '<em>“I have eaten ten thousand of you. They all started exactly like this: loud, early, certain.”</em>',
      'The window closes itself.',
    ],
  },
  {
    id: 'rank_c', when: (s) => s.hunter.level >= 20, kind: 'gold', title: 'Notification', center: true,
    lines: ['Reclassification approved.', `Rank: ${change('D', 'C')}`],
  },
  {
    id: 'valcorde_past', when: (s) => s.hunter.level >= 25, kind: 'coach', title: 'Valcorde',
    lines: [
      'You are past the point where most people stop, so you get the real version.',
      'I did not retire. My last Gate collapsed with nine of us inside and I was the only one still moving at hour six.',
      'Not the strongest. Not the best kitted. The one who had paced himself, and had something left when the walls came in.',
      'That is the whole trade. Everything else is decoration.',
    ],
  },
  {
    id: 'rank_b', when: (s) => s.hunter.level >= 35, kind: 'gold', title: 'Notification', center: true,
    lines: [
      'Reclassification approved.',
      `Rank: ${change('C', 'B')}`,
      '[A record has been unsealed.]',
      'Candidate 1: Player designation declined.',
      'Candidate 2: Player designation accepted.',
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
    id: 'rank_a', when: (s) => s.hunter.level >= 50, kind: 'gold', title: 'Notification', center: true,
    lines: [
      'Reclassification approved.',
      `Rank: ${change('B', 'A')}`,
      `Shadow slots: ${change(SLOTS.B, SLOTS.A)}`,
      '[A Gate of unprecedented density is forming.]',
      'Required rank: S',
    ],
  },
  {
    id: 'rank_s', when: (s) => s.hunter.level >= 70, kind: 'gold', title: 'Notification', center: true,
    lines: [
      'Reclassification approved.',
      `Rank: ${change('A', 'S')}`,
      `${tag('The Hollow Throne')} has opened. It does not close at midnight.`,
      `You have received a message from ${tag('Ryn Valcorde')}.`,
      '“Do not go in tired. Go in with something left.”',
    ],
  },
  {
    id: 'monarch_slain', when: (s) => s.gates.cleared.includes('DNG-HOLLOW'), kind: 'gold', title: 'Notification', center: true,
    lines: event('defeated', foe('The Hollow Monarch')),
  },
  {
    id: 'sovereign', when: (s) => s.hunter.level >= 100, kind: 'gold', title: 'Notification', center: true,
    lines: ['[You have reached Level 100.]', `Rank: ${change('S', 'Sovereign')}`, 'Further ranks: none.'],
  },
];
