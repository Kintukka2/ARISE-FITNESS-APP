/**
 * What stands between the gate and its boss: the kinds of step on a dungeon
 * map, the blessings a shrine offers, and the events. Numbers here are rules,
 * and the screens quote them from here.
 */
import type { Stat } from '@/core/types';

export type NodeKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'shrine' | 'trap' | 'event' | 'boss' | 'entrance' | 'vault' | 'up' | 'down';

/** What the map shows as an Event until the hunter steps on it. A shrine shows for what it is. */
export const HIDDEN: ReadonlySet<NodeKind> = new Set<NodeKind>(['trap', 'treasure']);
/** In a Gate's rooms, a rest is found too: it shows as an Event until the hunter steps into it. */
export const HIDDEN_IN_ROOMS: ReadonlySet<NodeKind> = new Set<NodeKind>([...HIDDEN, 'rest']);

export const NODE: Record<NodeKind, { name: string; glyph: string; desc: string }> = {
  fight: { name: 'Fight', glyph: 'fist', desc: 'Creatures of the Gate. Pays shards, sometimes gear.' },
  elite: { name: 'Gatekeeper', glyph: 'crown', desc: 'A stronger foe. In a Gate, the vault is behind it.' },
  rest: { name: 'Rest', glyph: 'heart', desc: 'Heals the party once. In a Gate, it passes for an Event until you step in, and keeps until you come back to use it.' },
  treasure: { name: 'Cache', glyph: 'bag', desc: 'Materials one grade below the Gate, now and then a piece found whole. It passes for an Event until you step on it.' },
  shrine: { name: 'Shrine', glyph: 'star', desc: 'Pick one of two blessings for the rest of the Gate.' },
  trap: { name: 'Trap', glyph: 'warn', desc: 'A Perception check that costs HP when failed. It passes for an Event until you step on it.' },
  event: { name: 'Event', glyph: 'event', desc: 'A choice, with its odds stated. A trap, a cache or a rest passes for one until you step in.' },
  boss: { name: 'Boss', glyph: 'skull', desc: 'The Gate’s Boss. Defeating it closes the Gate.' },
  entrance: { name: 'Entrance', glyph: 'gates', desc: 'The way in, and the way out. Withdraw from here.' },
  vault: { name: 'Vault', glyph: 'lock', desc: 'Behind the Gatekeeper, reached only through its room, and sealed until it falls. A richer cache than any other.' },
  down: { name: 'Stairs Down', glyph: 'stairsDown', desc: 'To the next floor. The boss waits on the last.' },
  up: { name: 'Stairs Up', glyph: 'stairsUp', desc: 'Back to the floor above.' },
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

/**
 * What a choice does. Hurt and heal are shares of maximum HP; shards are shares of a clear's; mana is a
 * share of maximum MP, given or, below zero, drained; fatigue is points of it, added or, below zero, eased.
 */
export interface Effect { item?: boolean; shards?: number; hurt?: number; heal?: number; bless?: boolean; status?: string; mana?: number; fatigue?: number; text: string }

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
  {
    id: 'crystal', title: 'A Mana Crystal',
    text: 'A spar of raw mana as long as your arm, grown out of the wall. It hums when you come near.',
    choices: [
      { label: 'Draw from it', odds: 0.65, win: { mana: 0.5, text: 'Mana floods into you until your fingertips ache.' }, lose: { mana: -0.3, text: 'It drinks from you instead, and lets go.' } },
      { label: 'Break off a piece', check: { stat: 'STR', base: 0.35, per: 0.006, max: 0.9 }, win: { shards: 0.5, text: 'It snaps clean. The shards are worth something.' }, lose: { hurt: 0.12, text: 'It splinters in your hand.' } },
      { label: 'Leave it', system: true, win: nothing },
    ],
  },
  {
    id: 'tunnel', title: 'A Collapsed Tunnel',
    text: 'Rubble fills the way ahead. There is a gap near the roof, just wide enough to crawl through.',
    choices: [
      { label: 'Squeeze through', check: { stat: 'AGI', base: 0.35, per: 0.006, max: 0.9 }, win: { shards: 0.4, text: 'Someone hid a stash on the far side and never came back for it.' }, lose: { hurt: 0.15, text: 'The rubble shifts on top of you. You crawl back out.' } },
      { label: 'Go the long way round', system: true, win: { fatigue: 4, text: 'It takes a while. Your legs feel it.' } },
    ],
  },
  {
    id: 'runes', title: 'An Unfinished Circle',
    text: 'Runes burned into the floor, still warm. Whoever drew them did not finish.',
    choices: [
      { label: 'Complete the circle', check: { stat: 'INT', base: 0.3, per: 0.006, max: 0.9 }, win: { bless: true, text: 'The last rune takes, and the circle closes around you.' }, lose: { status: 'Cursed', text: 'The circle closes on you instead.' } },
      { label: 'Step around it', system: true, win: nothing },
    ],
  },
  {
    id: 'beast', title: 'A Sleeping Beast',
    text: 'Something huge lies asleep across the path, curled around what it has taken from hunters before you.',
    choices: [
      { label: 'Take from the hoard', check: { stat: 'AGI', base: 0.3, per: 0.006, max: 0.85 }, win: { item: true, text: 'It does not stir. You come away with something.' }, lose: { hurt: 0.3, text: 'One eye opens. You get away, but not untouched.' } },
      { label: 'Let it sleep', system: true, win: nothing },
    ],
  },
  {
    id: 'altar', title: 'An Altar of Bones',
    text: 'Skulls stacked into an altar, a bowl at its foot. The bowl is stained, and empty.',
    choices: [
      { label: 'Bleed into the bowl', win: { hurt: 0.2, bless: true, text: 'The bowl takes what it is given. Something is given back.' } },
      { label: 'Walk past', system: true, win: nothing },
    ],
  },
  {
    id: 'camp', title: 'An Abandoned Camp',
    text: 'A cold fire, two bedrolls and a pot still half full. Nobody has been back for it.',
    choices: [
      { label: 'Eat and rest', system: true, win: { heal: 0.2, fatigue: -6, text: 'A meal and a short sleep. It helps more than you expected.' } },
      { label: 'Search the packs', odds: 0.6, win: { shards: 0.4, text: 'Mana Shards, rolled up in a spare shirt.' }, lose: { status: 'Poisoned', text: 'Something was nesting in there, and it bites.' } },
    ],
  },
  {
    id: 'wounded', title: 'A Wounded Hunter',
    text: 'A hunter from another party, alone against the wall, holding a wound closed.',
    choices: [
      { label: 'Patch them up', win: { fatigue: 5, shards: 0.3, text: 'They press their share of the haul on you and limp for the exit.' } },
      { label: 'Point them to the way out', system: true, win: { text: 'They nod, and go.' } },
    ],
  },
  {
    id: 'voice', title: 'A Voice in the Dark',
    text: 'Someone calls your name from a side passage, in a voice you almost know.',
    choices: [
      { label: 'Follow it', odds: 0.45, win: { bless: true, mana: 0.25, text: 'At the end of the passage, something old looks at you, and approves.' }, lose: { hurt: 0.1, status: 'Weakened', text: 'Nothing is there. Something was, and it took a little of you.' } },
      { label: 'Keep to the road', system: true, win: nothing },
    ],
  },
  {
    id: 'pool', title: 'A Still Pool',
    text: 'Black water, perfectly still. Your reflection moves a moment after you do.',
    choices: [
      { label: 'Wash in it', odds: 0.55, win: { fatigue: -12, text: 'The cold goes right through you, and takes the tiredness with it.' }, lose: { status: 'Chilled', fatigue: 4, text: 'The cold goes right through you, and stays.' } },
      { label: 'Leave it be', system: true, win: nothing },
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
