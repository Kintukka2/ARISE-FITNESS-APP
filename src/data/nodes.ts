/**
 * What stands between the gate and its boss: the kinds of step on a dungeon
 * map, the blessings a shrine offers, and the events. Numbers here are rules,
 * and the screens quote them from here.
 */
import type { Stat } from '@/core/types';

export type NodeKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'shrine' | 'trap' | 'event' | 'boss';

export const NODE: Record<NodeKind, { name: string; glyph: string; desc: string }> = {
  fight: { name: 'Fight', glyph: 'fist', desc: 'Creatures of the Gate. Shards for every one cleared, and sometimes gear.' },
  elite: { name: 'Gatekeeper', glyph: 'crown', desc: 'Something stronger than the rest, guarding a piece of real gear.' },
  rest: { name: 'Rest', glyph: 'heart', desc: 'Catch your breath. The only place you can withdraw from.' },
  treasure: { name: 'Cache', glyph: 'bag', desc: 'What the last party left behind. Gear, a grade below the Gate.' },
  shrine: { name: 'Shrine', glyph: 'star', desc: 'Pick one of two blessings for the rest of the Gate.' },
  trap: { name: 'Trap', glyph: 'warn', desc: 'A Perception check. Fail it and it costs you health.' },
  event: { name: 'Unknown', glyph: 'unknown', desc: 'Something you will have to decide about.' },
  boss: { name: 'Boss', glyph: 'skull', desc: 'The thing holding the Gate open.' },
};

/** A rest restores this share of everyone's maximum HP, and lifts what ails them. */
export const REST_HEAL = 0.3;
/** Each fight cleared banks this share of a clear's shards; a gatekeeper, more. */
export const FIGHT_PURSE = { fight: 0.2, elite: 0.5 } as const;

/** Run-long boons, in the units the combat engine's gear bonuses use. */
export interface Blessing { id: string; name: string; text: string; bonus: Record<string, number> }

export const BLESSINGS: Blessing[] = [
  { id: 'iron', name: 'Blessing of Iron', text: '+20% maximum HP', bonus: { maxHp: 0.2 } },
  { id: 'edge', name: 'Blessing of the Edge', text: '+15% attack and magic', bonus: { patk: 0.15, mpow: 0.15 } },
  { id: 'haste', name: 'Blessing of Haste', text: '+12 initiative: you act sooner', bonus: { initiative: 12 } },
  { id: 'ward', name: 'Blessing of the Ward', text: '+20% defence and resistance', bonus: { defense: 0.2, resist: 0.2 } },
  { id: 'sight', name: 'Blessing of Sight', text: '+10 accuracy and +6% critical chance', bonus: { accuracy: 10, crit: 6 } },
];
export const blessingById = (id: string) => BLESSINGS.find((b) => b.id === id);

/** What a choice does. Hurt and heal are shares of maximum HP; shards are shares of a clear's. */
export interface Effect { item?: boolean; shards?: number; hurt?: number; heal?: number; bless?: boolean; status?: string; text: string }

export interface Choice {
  label: string;
  /** Odds it goes well, or the attribute that sets them. Unset, it always does. */
  odds?: number;
  check?: { stat: Stat; base: number; per: number; max: number };
  win: Effect;
  lose?: Effect;
  /** The choice the System makes, walking its own road. */
  system?: boolean;
}

export interface GateEvent { id: string; title: string; text: string; choices: Choice[] }

const nothing: Effect = { text: 'Nothing comes of it.' };

export const EVENTS: GateEvent[] = [
  {
    id: 'seam', title: 'A Rift Seam',
    text: 'Light leaks through a crack in the dungeon wall. Something glints on the far side, close enough to reach.',
    choices: [
      { label: 'Reach in', odds: 0.6, win: { item: true, text: 'Your hand closes on something solid. It comes out with you.' }, lose: { hurt: 0.25, text: 'The seam bites down. You get your arm back, most of it.' } },
      { label: 'Leave it', system: true, win: nothing },
    ],
  },
  {
    id: 'pack', title: 'A Fallen Hunter’s Pack',
    text: 'Association issue, torn open. Most of what was in it is still there.',
    choices: [
      { label: 'Take what is left', odds: 0.7, win: { shards: 0.6, text: 'Mana Shards, wrapped in a licence nobody will be renewing.' }, lose: { hurt: 0.15, text: 'Whatever got its owner was still guarding it.' } },
      { label: 'Leave it for the Association', system: true, win: nothing },
    ],
  },
  {
    id: 'spring', title: 'A Mana Spring',
    text: 'Clear water, humming faintly. The dungeon does not usually offer anything for free.',
    choices: [
      { label: 'Drink', system: true, win: { heal: 0.35, text: 'It is exactly what it looks like. The whole party breathes easier.' } },
      { label: 'Move on', win: nothing },
    ],
  },
  {
    id: 'echo', title: 'The Echo',
    text: 'A voice ahead of you, using your words a moment before you do.',
    choices: [
      { label: 'Answer it', odds: 0.5, win: { bless: true, text: 'It answers back, and something settles on you.' }, lose: { status: 'Weakened', text: 'It answers back. You feel smaller for the rest of the next fight.' } },
      { label: 'Walk on', system: true, win: nothing },
    ],
  },
  {
    id: 'cache', title: 'A Sealed Strongbox',
    text: 'Iron bands, no lock you can see. It was built to be opened by force.',
    choices: [
      { label: 'Force it open', check: { stat: 'STR', base: 0.3, per: 0.006, max: 0.9 }, win: { item: true, text: 'The bands give. The box was worth the trouble.' }, lose: { hurt: 0.1, text: 'It does not give. Your shoulder does.' } },
      { label: 'Leave it', system: true, win: nothing },
    ],
  },
];
export const eventById = (id: string) => EVENTS.find((e) => e.id === id);

/** The one choice a trap offers, and what Perception buys. */
export const TRAP: GateEvent = {
  id: 'trap', title: 'A Pressure Plate',
  text: 'The floor ahead is too clean. Someone, or something, set this.',
  choices: [
    { label: 'Step carefully', system: true, check: { stat: 'PER', base: 0.4, per: 0.005, max: 0.9 }, win: { text: 'You see it in time and step around it.' }, lose: { hurt: 0.2, text: 'You find it the hard way.' } },
  ],
};
