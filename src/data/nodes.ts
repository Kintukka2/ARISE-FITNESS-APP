/**
 * What stands between the gate and its boss: the kinds of step on a dungeon
 * map, the blessings a shrine offers, and the events. Numbers here are rules,
 * and the screens quote them from here.
 */
import type { Stat } from '@/core/types';

export type NodeKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'shrine' | 'font' | 'trap' | 'event' | 'landmark' | 'boss' | 'entrance' | 'vault' | 'up' | 'down';

/** What the map shows as an Event until the hunter steps on it. A shrine shows for what it is. */
export const HIDDEN: ReadonlySet<NodeKind> = new Set<NodeKind>(['trap', 'treasure']);
/** In a Gate's rooms, a rest is found too: it shows as an Event until the hunter steps into it. */
export const HIDDEN_IN_ROOMS: ReadonlySet<NodeKind> = new Set<NodeKind>([...HIDDEN, 'rest']);

export const NODE: Record<NodeKind, { name: string; glyph: string; desc: string }> = {
  fight: { name: 'Fight', glyph: 'roomFight', desc: 'Creatures of the Gate. Pays shards, sometimes gear.' },
  elite: { name: 'Gatekeeper', glyph: 'roomKeeper', desc: 'A stronger foe. In a Gate, the vault is behind it.' },
  rest: { name: 'Rest', glyph: 'roomRest', desc: 'Heal, Hone or Steady, once. In a Gate, it passes for an Event until you step in, and keeps until you come back to use it.' },
  treasure: { name: 'Cache', glyph: 'roomCache', desc: 'Materials one grade below the Gate, now and then a piece found whole. It passes for an Event until you step on it.' },
  shrine: { name: 'Shrine', glyph: 'roomShrine', desc: 'Three blessings of one Path, shown on the plan. Take one for the rest of the Gate.' },
  font: { name: 'Font', glyph: 'font', desc: 'Raises one blessing you hold a tier. With none to raise, it blesses as a shrine does.' },
  trap: { name: 'Trap', glyph: 'roomTrap', desc: 'A pressure plate, a tripwire, a falling ceiling, a glyph: two ways past it, each read from a stat, and HP lost when it goes wrong. It passes for an Event until you step on it.' },
  landmark: { name: 'Landmark', glyph: 'landmark', desc: 'A named room of the creatures that hold the Gate, one to a floor, hidden in the fog until you find it. A choice of its own, with its odds stated.' },
  event: { name: 'Event', glyph: 'event', desc: 'A choice, with its odds stated. A trap, a cache or a rest passes for one until you step in.' },
  boss: { name: 'Boss', glyph: 'roomBoss', desc: 'The Gate’s Boss. Defeating it closes the Gate.' },
  entrance: { name: 'Entrance', glyph: 'roomEntrance', desc: 'The way in, and the way out. Withdraw from here.' },
  vault: { name: 'Vault', glyph: 'roomVault', desc: 'Behind the Gatekeeper, reached only through its room, and sealed until it falls. A richer cache than any other.' },
  down: { name: 'Stairs Down', glyph: 'stairsDown', desc: 'To the next floor. The boss waits on the last.' },
  up: { name: 'Stairs Up', glyph: 'stairsUp', desc: 'Back to the floor above.' },
};

/** A rest's Heal restores this share of everyone's maximum HP. */
export const REST_HEAL = 0.3;
/** A rest's Steady lifts every debuff from the party and adds this many Health Potions to the satchel, up to its limit. */
export const STEADY_POTIONS = 1;
/** A rest's Hone raises one equipped skill this many levels for the Gate. */
export const HONE_LEVELS = 1;
/** A level honed past Lv.MAX adds this to the skill's multiplier, as each level past Lv.1 does. */
export const HONE_PAST = 0.1;
/**
 * The System heals at a rest while the hunter's HP is below this share, and hones while it is not. At 1 it
 * hones only at full HP: a line at 70% left a hunter who raids three times a day 5 days behind at A-Rank,
 * walking out of each Gate with less HP for the next.
 */
export const REST_LINE = 1;
/** Each fight cleared banks this share of a clear's shards; one two corridors or more off the road, more; a gatekeeper, more again. */
export const FIGHT_PURSE = { fight: 0.2, deep: 0.3, elite: 0.5 } as const;

/**
 * A hidden passage, on a Gate's later plans, opens only when the hunter notices it: once, as a room at
 * either end is cleared, at these odds by Perception (as a trap's). A Gate Survey charts every one, and a
 * charted passage needs no noticing.
 */
export const NOTICE = { base: 0.35, per: 0.006, max: 0.9 } as const;

/** A toll door: a sealed corridor that opens for good when the hunter pays this share of their maximum HP, standing at it. */
export const TOLL = { hp: 0.2 } as const;

/**
 * The five blessings shrines offered before the Paths' (`data/blessings.ts`): flat stats, in the units
 * the combat engine's gear bonuses use. A run opened before them keeps any it took.
 */
export interface Blessing { id: string; name: string; text: string; bonus: Record<string, number> }

export const OLD_BLESSINGS: Blessing[] = [
  { id: 'iron', name: 'Blessing of Iron', text: 'Maximum HP +20%', bonus: { maxHp: 0.2 } },
  { id: 'edge', name: 'Blessing of the Edge', text: 'Attack and magic +15%', bonus: { patk: 0.15, mpow: 0.15 } },
  { id: 'haste', name: 'Blessing of Haste', text: 'Initiative +12', bonus: { initiative: 12 } },
  { id: 'ward', name: 'Blessing of the Ward', text: 'Defence and resistance +20%', bonus: { defense: 0.2, resist: 0.2 } },
  { id: 'sight', name: 'Blessing of Sight', text: 'Accuracy +10, Crit chance +6%', bonus: { accuracy: 10, crit: 6 } },
];
export const blessingById = (id: string) => OLD_BLESSINGS.find((b) => b.id === id);

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

/**
 * A trap's kinds, after the mechanical and the magical traps of the tabletop games (the owner's call: a trap that was
 * always one Perception check felt the same every time). A trap on the later plans (`labyrinth4`) is one of these, and
 * offers two ways past it, two of the five stats drawn for its room (`trapped` in `core/map.ts`), its own leaning stats
 * drawn more often and at better odds: a magical trap leans on Intelligence, a boulder on Strength and Vitality, a
 * tripwire on Agility. Each way is that stat's own act against that trap, its odds read from that stat. Failing costs HP
 * (and the flood, fatigue), never a status: one carried into the next fight compounded under Ascension's Crooked Luck,
 * and the campaign's three-session hunter cleared 13 points fewer of its last month's Ascension Gates with them.
 */
export type TrapKind = 'mechanical' | 'magical';
export interface TrapWay { label: string; win: string }
export interface TrapDef {
  id: string;
  title: string;
  text: string;
  kind: TrapKind;
  /** The stats it leans on: drawn this many times as often (`TRAP_LEAN`), and at the better odds (`TRAP_ODDS.lean`). */
  lean: readonly Stat[];
  /** What each stat does against it. */
  ways: Record<Stat, TrapWay>;
  /** What it does to the hunter who fails, whichever way they tried. */
  lose: Effect;
}

/** A trap's leaning stats are drawn this many times as often as each other. */
export const TRAP_LEAN = 3;
/** The odds a way past a trap goes well, by its stat: a leaning stat's better than another's. */
export const TRAP_ODDS = {
  lean: { base: 0.45, per: 0.006, max: 0.92 },
  plain: { base: 0.3, per: 0.005, max: 0.85 },
} as const;

export const TRAPS: TrapDef[] = [
  {
    id: 'plate', title: 'A Pressure Plate', kind: 'mechanical', lean: ['AGI', 'PER'],
    text: 'The floor ahead is too clean. Something was set here.',
    ways: {
      STR: { label: 'Wedge it down', win: 'You jam the plate with a broken flagstone before it can drop.' },
      VIT: { label: 'Brace and cross', win: 'It fires. You take it on your guard and keep walking.' },
      AGI: { label: 'Leap over it', win: 'You clear the plate in one stride.' },
      INT: { label: 'Find the mechanism', win: 'A loose stone in the wall hides the release. The plate locks in place.' },
      PER: { label: 'Step carefully', win: 'You see it in time and step around it.' },
    },
    lose: { hurt: 0.2, text: 'The plate drops under your foot.' },
  },
  {
    id: 'tripwire', title: 'A Tripwire', kind: 'mechanical', lean: ['AGI', 'PER'],
    text: 'A thread pulled taut across the passage at ankle height, so fine it catches the light only once.',
    ways: {
      STR: { label: 'Hold the wire', win: 'You take the strain on the wire and ease it back down.' },
      VIT: { label: 'Shoulder through', win: 'The bolts snap off your armour.' },
      AGI: { label: 'Step over it', win: 'You lift your feet over the thread, one after the other.' },
      INT: { label: 'Trace where it leads', win: 'You follow the thread to its bolts and pull their pin.' },
      PER: { label: 'Look for the thread', win: 'You catch the glint and step over it.' },
    },
    lose: { hurt: 0.15, text: 'Bolts snap out of the walls.' },
  },
  {
    id: 'pit', title: 'A False Floor', kind: 'mechanical', lean: ['AGI', 'STR'],
    text: 'The flagstones ahead ring hollow under the dust.',
    ways: {
      STR: { label: 'Bridge it with a slab', win: 'You heave a slab across the hollow and cross on it.' },
      VIT: { label: 'Cross and take the fall', win: 'One stone gives. You catch the edge and haul yourself up, unhurt.' },
      AGI: { label: 'Jump the hollow', win: 'You land past the hollow stones.' },
      INT: { label: 'Work out the safe stones', win: 'The dust lies thinner on the stones that hold. You keep to them.' },
      PER: { label: 'Sound out the floor', win: 'You hear where the floor rings hollow and keep off it.' },
    },
    lose: { hurt: 0.25, text: 'The floor tips away beneath you. You climb out of the pit.' },
  },
  {
    id: 'arrows', title: 'Arrow Slits', kind: 'mechanical', lean: ['PER', 'AGI'],
    text: 'Narrow slits line both walls at chest height. Something behind them is wound tight.',
    ways: {
      STR: { label: 'Raise a slab as a shield', win: 'You drag a slab up in front of you. The bolts break on it.' },
      VIT: { label: 'Run the gauntlet', win: 'The bolts glance off. You make it through.' },
      AGI: { label: 'Dive between volleys', win: 'You roll through the gap between volleys.' },
      INT: { label: 'Count the volleys', win: 'They fire to a rhythm. You walk through between beats.' },
      PER: { label: 'Find the trigger stone', win: 'You spot the trigger stone and step around it.' },
    },
    lose: { hurt: 0.18, text: 'Bolts hiss out of the slits.' },
  },
  {
    id: 'ceiling', title: 'A Falling Ceiling', kind: 'mechanical', lean: ['STR', 'VIT'],
    text: 'Cracks run across the ceiling, and dust sifts down when you breathe.',
    ways: {
      STR: { label: 'Hold it up', win: 'The first stone drops onto your shoulders and stops. You hold it until the party is through.' },
      VIT: { label: 'Brace and run', win: 'Stone rains around you. You keep your feet and come out the far side.' },
      AGI: { label: 'Sprint for the far side', win: 'You make the far side before the dust settles.' },
      INT: { label: 'Find the keystone', win: 'One stone carries the rest. You wedge it, and the ceiling holds.' },
      PER: { label: 'Read the cracks', win: 'The cracks run one way. You keep to the side that will hold.' },
    },
    lose: { hurt: 0.25, text: 'Stone comes down across your shoulders.' },
  },
  {
    id: 'flood', title: 'A Flooding Chamber', kind: 'mechanical', lean: ['VIT', 'STR'],
    text: 'The door grinds shut behind you, and water starts pouring in through the walls.',
    ways: {
      STR: { label: 'Force the door', win: 'The door shrieks open, and the water pours out after you.' },
      VIT: { label: 'Hold your breath and swim', win: 'The water closes over you. You swim out through the drain.' },
      AGI: { label: 'Climb above the water', win: 'You climb the wall to a ledge and out through a gap in the roof.' },
      INT: { label: 'Find the sluice', win: 'A lever behind a loose panel. The water drains away.' },
      PER: { label: 'Look for the drain', win: 'You spot the grate and kick it open. The water drains.' },
    },
    lose: { hurt: 0.15, fatigue: 6, text: 'You force your way out, half drowned.' },
  },
  {
    id: 'blades', title: 'Whirling Blades', kind: 'mechanical', lean: ['AGI', 'PER'],
    text: 'Blades spin out of slots in the floor, cutting the room in two.',
    ways: {
      STR: { label: 'Jam the blades', win: 'You drive your weapon into the slot. The blades grind to a halt.' },
      VIT: { label: 'Push through', win: 'They catch your armour and nothing else.' },
      AGI: { label: 'Time the gap', win: 'You slip between the blades.' },
      INT: { label: 'Work out their pattern', win: 'They spin in a pattern. You walk the gaps it leaves.' },
      PER: { label: 'Watch them turn', win: 'You watch them turn until you see the gap, then take it.' },
    },
    lose: { hurt: 0.22, text: 'A blade catches you on the way through.' },
  },
  {
    id: 'net', title: 'A Falling Net', kind: 'mechanical', lean: ['STR', 'AGI'],
    text: 'A weighted net hangs folded in the dark above the doorway.',
    ways: {
      STR: { label: 'Tear free', win: 'The net drops. You rip it apart before it settles.' },
      VIT: { label: 'Take its weight', win: 'The net drops onto you. You carry it off your shoulders and walk on.' },
      AGI: { label: 'Slip under it', win: 'You are through the doorway before it lands.' },
      INT: { label: 'Cut the line first', win: 'You trace the line to its peg and cut it.' },
      PER: { label: 'Spot the line', win: 'You see the line and step clear of it.' },
    },
    lose: { hurt: 0.08, text: 'The net drops over you. It takes a while to cut free.' },
  },
  {
    id: 'boulder', title: 'A Rolling Boulder', kind: 'mechanical', lean: ['STR', 'VIT'],
    text: 'The passage slopes down, and something heavy rumbles at the top of it.',
    ways: {
      STR: { label: 'Stop it', win: 'You set your feet and stop it dead.' },
      VIT: { label: 'Take the hit', win: 'It hits you full on, and you stay standing.' },
      AGI: { label: 'Dive aside', win: 'You throw yourself into an alcove as it thunders past.' },
      INT: { label: 'Find where it will stop', win: 'The slope levels out past the bend. You wait there while it rolls by.' },
      PER: { label: 'Spot the alcove', win: 'There is a hollow in the wall. You are in it before the boulder passes.' },
    },
    lose: { hurt: 0.28, text: 'It catches you, and carries you down the slope.' },
  },
  {
    id: 'glyph', title: 'A Glyph of Warding', kind: 'magical', lean: ['INT', 'PER'],
    text: 'A sigil is drawn faintly across the threshold, almost invisible until you look at it sideways.',
    ways: {
      STR: { label: 'Smash its stone', win: 'You crack the stone it is drawn on, and its light goes out.' },
      VIT: { label: 'Walk through the fire', win: 'It flares. You walk through the heat and out the other side.' },
      AGI: { label: 'Step over its edge', win: 'You step over the edge of the sigil without touching it.' },
      INT: { label: 'Unwrite the glyph', win: 'You trace the sigil backwards, and it fades.' },
      PER: { label: 'Find where it ends', win: 'You find where the sigil ends and go round it.' },
    },
    lose: { hurt: 0.2, text: 'The glyph flares, and fire rolls over you.' },
  },
  {
    id: 'runes', title: 'A Rune-Cut Door', kind: 'magical', lean: ['INT', 'STR'],
    text: 'The only way on is a door cut with runes that pulse as you come near.',
    ways: {
      STR: { label: 'Force it open', win: 'The runes spit sparks as the door gives. None of them catch.' },
      VIT: { label: 'Endure the runes', win: 'The runes burn as you push through. It passes.' },
      AGI: { label: 'Slip through the gap', win: 'The door stands open a hand’s width. You slip through.' },
      INT: { label: 'Read the runes', win: 'The runes are a lock. You read the word that opens it.' },
      PER: { label: 'Find the worn rune', win: 'One rune is worn smooth from use. You press it, and the door opens.' },
    },
    lose: { hurt: 0.12, text: 'The runes flare, and the door throws you back.' },
  },
  {
    id: 'haze', title: 'A Caustic Haze', kind: 'magical', lean: ['INT', 'VIT'],
    text: 'A green haze hangs at knee height, waiting for something to walk into it.',
    ways: {
      STR: { label: 'Break the vent', win: 'You smash the vent it rises from. The haze thins and is gone.' },
      VIT: { label: 'Hold your breath', win: 'You hold your breath and walk through the haze.' },
      AGI: { label: 'Run through it', win: 'You are through before it can settle on you.' },
      INT: { label: 'Unbind the haze', win: 'You find the binding in the haze and pull it apart.' },
      PER: { label: 'Find the clear path', win: 'The haze drifts one way. You walk the side it leaves clear.' },
    },
    lose: { hurt: 0.15, text: 'The haze settles on you, and starts to eat.' },
  },
];
export const trapById = (id: string) => TRAPS.find((t) => t.id === id);

/**
 * A trap as the choice it offers: its two ways, each its stat's act and that stat's odds, at a leaning stat's better
 * ones. The System takes whichever its hunter is likelier to pass (`raid.systemChoice`).
 */
export function trapEvent(id: string, ways: readonly Stat[]): GateEvent | null {
  const t = trapById(id);
  if (!t) return null;
  return {
    id: `trap:${t.id}`, title: t.title, text: t.text,
    choices: ways.map((stat) => ({
      label: t.ways[stat].label,
      check: { stat, ...(t.lean.includes(stat) ? TRAP_ODDS.lean : TRAP_ODDS.plain) },
      win: { text: t.ways[stat].win },
      lose: t.lose,
    })),
  };
}

/** The one choice a trap offered on the plans before its kinds (`labyrinth3` and earlier), and what Perception buys. */
export const TRAP: GateEvent = {
  id: 'trap', title: 'A Pressure Plate',
  text: 'The floor ahead is too clean. Something was set here.',
  choices: [
    { label: 'Step carefully', system: true, check: { stat: 'PER', base: 0.4, per: 0.005, max: 0.9 }, win: { text: 'You see it in time and step around it.' }, lose: { hurt: 0.2, text: 'The plate drops under your foot.' } },
  ],
};
