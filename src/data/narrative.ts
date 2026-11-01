/**
 * Who speaks, and what they say.
 *
 * Ryn Valcorde is the Association's instructor: a retired hunter who walks
 * new licences through their first Gates. He does not know the System
 * exists, so nothing he says may reference it. The System speaks in windows.
 */
import type { Save } from '@/core/types';
import { CONTRACTS_PER_DAY } from './contracts';
import { SPIRE_OPENS } from './spire';
import { SLOTS } from './shadows';
import { arrival, change, counter, event, foe, tag, unlock } from '@/ui/system';

/** The Awakening Assessment at the Association desk. */
export const ASSESSMENT = [
  'Sit down. This takes four minutes, and three of them are paperwork.',
  'The scan picked up your Awakening this morning. It’s faint. Barely over the line, but over it.',
  'Measured rank: E. Lowest grade the Association issues.',
  'Before you ask, it doesn’t go up. An Awakening fixes your rank for life. I’ve watched people spend a fortune trying to change that.',
  'What it does get you is a licence. You can enter a Gate legally, and the Association patches you up afterwards.',
];

/** Valcorde asks for the name on the licence, after the assessment. */
export const NAME_PROMPT = 'Right. What name goes on the licence? Spell it properly. The Association doesn’t do reprints.';

/** Valcorde on the Gates screen: one line, picked by how the hunter is doing. */
export const GATES_LINE = {
  locked: 'You were carried out of the last one. Rest up. The board’ll turn over before you’re fit anyway.',
  tired: 'You’re running on empty. Your call, but I’d rest before the next one.',
  first: 'Pick something at your own grade, and take a party with you.',
  settled: 'Check your fatigue before every Gate. I still check mine.',
};

/** Valcorde's tour of the Gates screen, the first time it opens. */
export const GATES_TOUR = [
  { at: 'licence', say: 'Your grade. You can take on one grade above it. I wouldn’t, not yet.' },
  { at: 'vitals', say: 'Watch the bottom bar. Fatigue. It builds with every Gate, and it’s what kills hunters at your grade.' },
  { at: 'bands', say: 'Every grade has a Gate up there, so you can see what’s ahead. Stay at your own for now.' },
  { at: 'board', say: 'The one at the top is the practice Gate. I’ve signed us both in. Open it when you’re ready.' },
];

export const HANDOVER = [
  'There. You’re a hunter, on paper. The grey kit on the counter is yours. It’s not much. It’s not meant to be.',
  'I’m Valcorde. I run Hunter Training. C-Rank, thirty years in, and not retired, whatever the Association would prefer.',
  'There’s one Gate the Association keeps shut for first-timers. I take every new licence through it once.',
  'Nothing in there gets past me. Read the brief first, then we go in, when you’re ready.',
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
      'Three Gates, and you’re still walking. Good.',
      'Here’s what the Association’s leaflet leaves out. Most of the hunters I’ve lost at your grade went into one more Gate than they had in them. Know when to stop for the day.',
    ],
  },
  {
    id: 'spire_open', when: (s) => s.gates.clears >= SPIRE_OPENS, kind: 'coach', title: 'Valcorde',
    lines: [
      `${SPIRE_OPENS} Gates cleared. Then you’re ready to hear about the one that never closes.`,
      'The Pale Spire. It opened over the old reservoir before I had a licence, and every boss killed inside opens another floor above it. I got as far as the thirties, once.',
      'It rearranges itself every Monday. The Association pays at the end of the week for how high you got. It’s on the Gates screen when you want it.',
    ],
  },
  {
    id: 'ascension_open', when: (s) => s.ascension.unlocked >= 1, kind: 'gold', title: 'Notification', center: true,
    lines: [unlock('Ascension'), counter('Ascension levels unlocked', 1)],
  },
  {
    id: 'first_defeat', when: (s) => s.gates.fails >= 1, kind: 'coach', title: 'Valcorde',
    lines: [
      'The party couldn’t hold. The ones still standing dragged you out.',
      'The medics won’t let you back in until they’re satisfied. Let them.',
      'I’ve been carried out too. More than once.',
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
    id: 'valcorde_grade', when: (s) => s.hunter.level >= 20, kind: 'coach', title: 'Valcorde',
    lines: [
      'C-Rank. That’s my grade. It took me eleven years.',
      'I’m not going to ask how you’re doing it. Whatever it is, keep it to yourself. People talk.',
    ],
  },
  {
    id: 'valcorde_past', when: (s) => s.hunter.level >= 25, kind: 'coach', title: 'Valcorde',
    lines: [
      'You get the real version now.',
      'Twenty years ago I led ten hunters into a Gate posted as D-Rank. It wasn’t. I didn’t wait for the Association to reassess it. The pay was good and I was sure.',
      'At hour six I was the only one still moving. I carried three of them out.',
      'That’s the knee. I’ve never let the healers fix it. And it’s why I don’t lead raids anymore.',
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
