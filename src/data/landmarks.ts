/**
 * Landmarks: one named room on every floor of a Gate, drawn from the family that leads it (the Gate's
 * `identity`), shown through the fog from the moment the hunter walks in. Each holds a choice of its own,
 * like an event: one gamble with its odds stated, and one way past that the System takes, which never
 * hurts. Narrated as the world speaks (docs/VOICE.md): second person, present, what you see.
 */
import type { GateEvent } from './nodes';

export interface Landmark { family: string; name: string; event: GateEvent }

const leave = (label: string) => ({ label, system: true, win: { text: 'You leave it as you found it.' } });

export const LANDMARKS: Landmark[] = [
  {
    family: 'Undead', name: 'Ossuary',
    event: {
      id: 'lm-ossuary', title: 'The Ossuary',
      text: 'Bones stacked to the ceiling in careful rows. One alcove has been swept clean, and something lies in it.',
      choices: [
        { label: 'Take it', check: { stat: 'PER', base: 0.35, per: 0.006, max: 0.9 }, win: { item: true, text: 'It comes away in your hand, under a skin of dust.' }, lose: { hurt: 0.15, text: 'The rows shift as you reach in, and come down on you.' } },
        leave('Leave the dead their rest'),
      ],
    },
  },
  {
    family: 'Beast', name: 'Gnawed Den',
    event: {
      id: 'lm-den', title: 'The Gnawed Den',
      text: 'A den dug into the rock, its floor deep in bone and fur. Whatever made it is out hunting.',
      choices: [
        { label: 'Dig through the floor', check: { stat: 'AGI', base: 0.35, per: 0.006, max: 0.9 }, win: { shards: 0.8, text: 'Under the litter, a hunter’s pack, its shards still in it.' }, lose: { hurt: 0.2, text: 'It comes back while you are on your knees.' } },
        leave('Back out quietly'),
      ],
    },
  },
  {
    family: 'Insectoid', name: 'Brood Chamber',
    event: {
      id: 'lm-brood', title: 'The Brood Chamber',
      text: 'Pale eggs line the walls in their thousands, each one twitching.',
      choices: [
        { label: 'Cut out the royal jelly', odds: 0.55, win: { heal: 0.4, text: 'It is sweet and thick, and your cuts close as you swallow.' }, lose: { status: 'Poisoned', text: 'The eggs burst as you cut, and the air turns sour.' } },
        leave('Touch nothing'),
      ],
    },
  },
  {
    family: 'Goblinoid', name: 'Watch Platform',
    event: {
      id: 'lm-watch', title: 'The Watch Platform',
      text: 'A platform of lashed timber high on the wall, a ladder up to it. Someone keeps a lookout here.',
      choices: [
        { label: 'Climb up', check: { stat: 'AGI', base: 0.4, per: 0.006, max: 0.9 }, win: { shards: 0.7, text: 'The lookout’s stash is tucked under the boards.' }, lose: { hurt: 0.12, text: 'A rung snaps, and you land hard.' } },
        leave('Keep moving'),
      ],
    },
  },
  {
    family: 'Demon', name: 'Ritual Pit',
    event: {
      id: 'lm-pit', title: 'The Ritual Pit',
      text: 'A pit ringed with candles that never burn down. Something below it is listening.',
      choices: [
        { label: 'Speak into the pit', check: { stat: 'INT', base: 0.3, per: 0.006, max: 0.9 }, win: { bless: true, text: 'A voice answers, and something settles on you.' }, lose: { status: 'Cursed', text: 'A voice answers, and it knows your name.' } },
        leave('Walk around it'),
      ],
    },
  },
  {
    family: 'Plant', name: 'Overgrown Grove',
    event: {
      id: 'lm-grove', title: 'The Overgrown Grove',
      text: 'Roots have split the floor and grown into a grove, lit by its own flowers.',
      choices: [
        { label: 'Eat the fruit', odds: 0.6, win: { heal: 0.3, fatigue: -6, text: 'It tastes of nothing, and the ache in your legs goes.' }, lose: { status: 'Poisoned', text: 'Your mouth goes numb, then your throat.' } },
        leave('Pass through'),
      ],
    },
  },
  {
    family: 'Orc', name: 'War Camp',
    event: {
      id: 'lm-camp', title: 'The War Camp',
      text: 'Cold fires and empty tents. The war chest still sits by the chieftain’s tent.',
      choices: [
        { label: 'Break open the chest', check: { stat: 'STR', base: 0.35, per: 0.006, max: 0.9 }, win: { item: true, text: 'The lock gives on the second blow.' }, lose: { hurt: 0.15, text: 'The lid snaps shut on your hand.' } },
        leave('Leave the camp'),
      ],
    },
  },
  {
    family: 'Giantkin', name: 'Fallen Statue',
    event: {
      id: 'lm-statue', title: 'The Fallen Statue',
      text: 'A statue of something enormous lies broken across the room, its head the size of a cart.',
      choices: [
        { label: 'Climb into the head', check: { stat: 'AGI', base: 0.35, per: 0.006, max: 0.9 }, win: { item: true, text: 'Something was hidden in the hollow of its eye.' }, lose: { hurt: 0.2, text: 'The stone shifts and pins your leg.' } },
        leave('Go around it'),
      ],
    },
  },
  {
    family: 'Slime', name: 'Dissolving Pool',
    event: {
      id: 'lm-pool', title: 'The Dissolving Pool',
      text: 'A pool of something clear and thick. Things sit at the bottom of it, half eaten away.',
      choices: [
        { label: 'Reach in for what is left', odds: 0.55, win: { shards: 0.8, text: 'Your sleeve smokes, but the shards come out whole.' }, lose: { hurt: 0.2, text: 'It takes the skin off your hand.' } },
        leave('Leave it'),
      ],
    },
  },
  {
    family: 'Humanoid', name: 'Bandit Hideout',
    event: {
      id: 'lm-hideout', title: 'The Bandit Hideout',
      text: 'A false wall, half open, and behind it bedrolls for six.',
      choices: [
        { label: 'Search the bedrolls', check: { stat: 'PER', base: 0.35, per: 0.006, max: 0.9 }, win: { shards: 0.8, text: 'Mana Shards, sewn into the lining of a coat.' }, lose: { hurt: 0.12, text: 'Someone left a blade under the blankets.' } },
        leave('Close the wall behind you'),
      ],
    },
  },
  {
    family: 'Construct', name: 'Silent Forge',
    event: {
      id: 'lm-forge', title: 'The Silent Forge',
      text: 'A forge that runs on its own, the anvil still ringing though nothing strikes it.',
      choices: [
        { label: 'Take what is on the anvil', check: { stat: 'STR', base: 0.35, per: 0.006, max: 0.9 }, win: { item: true, text: 'It is still warm when you lift it.' }, lose: { hurt: 0.15, text: 'The hammer comes down while your hand is there.' } },
        leave('Let it ring'),
      ],
    },
  },
  {
    family: 'Dragonkin', name: 'Hoard Hollow',
    event: {
      id: 'lm-hoard', title: 'The Hoard Hollow',
      text: 'A hollow in the rock, its floor paved with coins melted into one sheet.',
      choices: [
        { label: 'Pry up a piece of the hoard', check: { stat: 'STR', base: 0.3, per: 0.006, max: 0.9 }, win: { shards: 1, text: 'A slab of it comes up, shards fused into the metal.' }, lose: { hurt: 0.25, text: 'The stone is still hot enough to burn.' } },
        leave('Leave the hoard'),
      ],
    },
  },
  {
    family: 'Elemental', name: 'Storm Well',
    event: {
      id: 'lm-well', title: 'The Storm Well',
      text: 'A shaft open to a sky that cannot be there, lightning crawling down its sides.',
      choices: [
        { label: 'Draw from the storm', odds: 0.6, win: { mana: 0.5, text: 'It runs up your arm and settles behind your eyes.' }, lose: { hurt: 0.15, text: 'It finds you first.' } },
        leave('Stand back'),
      ],
    },
  },
  {
    family: 'Chimera', name: 'Grafting Hall',
    event: {
      id: 'lm-hall', title: 'The Grafting Hall',
      text: 'Tables of strapped and stitched creatures, none of them the same twice. Flasks line the shelf above them.',
      choices: [
        { label: 'Drink from a flask', check: { stat: 'INT', base: 0.3, per: 0.006, max: 0.9 }, win: { bless: true, text: 'You know what it is before you drink it.' }, lose: { status: 'Weakened', text: 'You were wrong about what it was.' } },
        leave('Leave the tables'),
      ],
    },
  },
  {
    family: 'Aquatic', name: 'Drowned Shrine',
    event: {
      id: 'lm-drowned', title: 'The Drowned Shrine',
      text: 'A shrine half under black water, its offerings still in the bowls below the surface.',
      choices: [
        { label: 'Dive for the offerings', check: { stat: 'VIT', base: 0.35, per: 0.006, max: 0.9 }, win: { item: true, text: 'Your lungs burn, but you come up holding something.' }, lose: { hurt: 0.2, text: 'The cold drives the air out of you.' } },
        leave('Leave them to the water'),
      ],
    },
  },
  {
    family: 'Aberration', name: 'Wrong Room',
    event: {
      id: 'lm-wrong', title: 'The Wrong Room',
      text: 'The room is a little larger inside than the corridor allows. The walls are not quite still.',
      choices: [
        { label: 'Touch the wall', odds: 0.45, win: { bless: true, mana: 0.25, text: 'It is warm, and for a moment it lets you in.' }, lose: { hurt: 0.1, status: 'Cursed', text: 'It was waiting for that.' } },
        leave('Back out'),
      ],
    },
  },
];

/** The landmark a family's Gates hold, by the family's name. */
export const landmarkOf = (family: string) => LANDMARKS.find((l) => l.family === family);
/** The family that leads a Gate, read from its identity (`Undead-led`). */
export const leadFamily = (identity: string) => identity.replace(/-led$/, '');
export const landmarkEvent = (id: string) => LANDMARKS.find((l) => l.event.id === id)?.event;
