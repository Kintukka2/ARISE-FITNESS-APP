/**
 * What stands between the gate and its boss: the kinds of step on a dungeon
 * map, the blessings a shrine offers, and the events. Numbers here are rules,
 * and the screens quote them from here.
 */
import type { Stat } from '@/core/types';

export type NodeKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'shrine' | 'trap' | 'event' | 'boss';

export const NODE: Record<NodeKind, { name: string; glyph: string; desc: string }> = {
  fight: { name: 'Fight', glyph: 'fist', desc: 'Creatures of the Gate. Pays shards, sometimes gear.' },
  elite: { name: 'Gatekeeper', glyph: 'crown', desc: 'A stronger foe. Guards gear.' },
  rest: { name: 'Rest', glyph: 'heart', desc: 'Heals the party. The only place to withdraw.' },
  treasure: { name: 'Cache', glyph: 'bag', desc: 'Gear, one grade below the Gate.' },
  shrine: { name: 'Shrine', glyph: 'star', desc: 'Pick one of two blessings for the rest of the Gate.' },
  trap: { name: 'Trap', glyph: 'warn', desc: 'A Perception check. Failing it costs HP.' },
  event: { name: 'Unknown', glyph: 'unknown', desc: 'A choice. Some outcomes are rolled.' },
  boss: { name: 'Boss', glyph: 'skull', desc: 'The Gate’s Boss. Defeating it closes the Gate.' },
};

/** A rest restores this share of everyone's maximum HP, and lifts what ails them. */
export const REST_HEAL = 0.3;
/** Each fight cleared banks this share of a clear's shards; a gatekeeper, more. */
export const FIGHT_PURSE = { fight: 0.2, elite: 0.5 } as const;

/** Run-long boons, in the units the combat engine's gear bonuses use. */
export interface Blessing { id: string; name: string; text: string; bonus: Record<string, number> }

export const BLESSINGS: Blessing[] = [
  { id: 'iron', name: 'Blessing of Iron', text: 'Maximum HP +20%', bonus: { maxHp: 0.2 } },
  { id: 'edge', name: 'Blessing of the Edge', text: 'Attack and magic +15%', bonus: { patk: 0.15, mpow: 0.15 } },
  { id: 'haste', name: 'Blessing of Haste', text: 'Initiative +12', bonus: { initiative: 12 } },
  { id: 'ward', name: 'Blessing of the Ward', text: 'Defence and resistance +20%', bonus: { defense: 0.2, resist: 0.2 } },
  { id: 'sight', name: 'Blessing of Sight', text: 'Accuracy +10 · Critical chance +6%', bonus: { accuracy: 10, crit: 6 } },
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
    text: 'Light leaks through a crack in the wall. Something glints on the far side, within reach.',
    choices: [
      { label: 'Reach in', odds: 0.6, win: { item: true, text: 'Your hand closes on something solid, and you pull it out.' }, lose: { hurt: 0.25, text: 'The seam closes on your arm. You pull it free.' } },
      { label: 'Leave it', system: true, win: nothing },
    ],
  },
  {
    id: 'pack', title: 'A Fallen Hunter’s Pack',
    text: 'An Association pack, torn open. Most of what was in it is still there.',
    choices: [
      { label: 'Take what is left', odds: 0.7, win: { shards: 0.6, text: 'Mana Shards, wrapped in its owner’s licence.' }, lose: { hurt: 0.15, text: 'Something is still guarding it. It catches you before you get clear.' } },
      { label: 'Leave it for the Association', system: true, win: nothing },
    ],
  },
  {
    id: 'spring', title: 'A Mana Spring',
    text: 'Clear water, humming faintly.',
    choices: [
      { label: 'Drink', system: true, win: { heal: 0.35, text: 'The water is clean. The party drinks.' } },
      { label: 'Move on', win: nothing },
    ],
  },
  {
    id: 'echo', title: 'The Echo',
    text: 'A voice ahead of you, using your words a moment before you do.',
    choices: [
      { label: 'Answer it', odds: 0.5, win: { bless: true, text: 'It answers back, and something settles on you.' }, lose: { status: 'Weakened', text: 'It answers back, and something drains out of you.' } },
      { label: 'Walk on', system: true, win: nothing },
    ],
  },
  {
    id: 'cache', title: 'A Sealed Strongbox',
    text: 'Iron bands, no visible lock. It was built to be opened by force.',
    choices: [
      { label: 'Force it open', check: { stat: 'STR', base: 0.3, per: 0.006, max: 0.9 }, win: { item: true, text: 'The bands give. There is something inside.' }, lose: { hurt: 0.1, text: 'The bands hold. You wrench your shoulder.' } },
      { label: 'Leave it', system: true, win: nothing },
    ],
  },
];
export const eventById = (id: string) => EVENTS.find((e) => e.id === id);

/** The one choice a trap offers, and what Perception buys. */
export const TRAP: GateEvent = {
  id: 'trap', title: 'A Pressure Plate',
  text: 'The floor ahead is too clean. Something was set here.',
  choices: [
    { label: 'Step carefully', system: true, check: { stat: 'PER', base: 0.4, per: 0.005, max: 0.9 }, win: { text: 'You see it in time and step around it.' }, lose: { hurt: 0.2, text: 'The plate drops under your foot.' } },
  ],
};
