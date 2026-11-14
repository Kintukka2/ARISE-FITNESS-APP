/**
 * Blessings: what a shrine gives the hunter for the rest of a Gate. Each belongs to one of the five
 * Paths of the skill tree and changes how something the hunter does works, at one of three tiers. A
 * Duo belongs to two Paths and is offered once the run holds a blessing of each; a Capstone needs two
 * of three named blessings of its Path. A Font raises one blessing a tier. Numbers here are rules, and
 * the screens quote them from here; the fight reads them in `core/combat.ts`.
 */
import type { Stat } from '@/core/types';

export type BoonKind = 'path' | 'duo' | 'capstone';

export interface BoonDef {
  id: string;
  name: string;
  /** Its Path; a Duo's two. */
  paths: Stat[];
  kind: BoonKind;
  /** Its number at tiers I, II and III. */
  v: readonly [number, number, number];
  /** What it does, at a tier's number. */
  text: (v: number) => string;
  /** Only a hand plays it (Guard, Cover, a throw), so the System never takes it. */
  hands?: boolean;
  /** A Capstone's three named blessings, two of which open it. */
  needs?: readonly string[];
}

/** The tiers, I to III, by name. */
export const TIERS = ['I', 'II', 'III'] as const;
/** How often a blessing offered comes at each tier, I to III. */
export const TIER_ODDS = [0.7, 0.25, 0.05] as const;
/** A shrine offers this many blessings, all of its Path but a Duo's. */
export const OFFER = 3;
/** The Path holding the most of the hunter's Skill Points is a shrine's this many times as often as each other. */
export const STEER = 3;
/** This share of shrines in a Gate or a tower are Fonts. */
export const FONT_SHARE = 0.25;
/** A Font offers up to this many of the blessings held, to raise one a tier. */
export const FONT_OFFER = 3;
/** Grudge counts no more than this many hits taken. */
export const GRUDGE_MAX = 3;

const pct = (v: number) => Math.round(v * 100);
const turns = (v: number) => `${v} turn${v === 1 ? '' : 's'}`;
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth'];

type Def = Omit<BoonDef, 'paths' | 'kind'>;
const path = (key: Stat, list: Def[]): BoonDef[] => list.map((b) => ({ ...b, paths: [key], kind: 'path' }));
const of = (kind: BoonKind, list: Omit<BoonDef, 'kind'>[]): BoonDef[] => list.map((b) => ({ ...b, kind }));

const RUIN = path('STR', [
  { id: 'rend', name: 'Rending Strike', v: [3, 4, 5], text: (v) => `Strike inflicts Bleeding for ${turns(v)}.` },
  { id: 'butcher', name: 'Butcher’s Edge', v: [0.2, 0.3, 0.4], text: (v) => `Damage +${pct(v)}% against a Bleeding foe.` },
  { id: 'shatter', name: 'Shatter', v: [0.3, 0.45, 0.6], text: (v) => `Damage +${pct(v)}% against a Broken or Stunned foe.` },
  { id: 'sunder', name: 'Sunder', v: [2, 3, 4], text: (v) => `Your skills inflict Staggered for ${turns(v)}.` },
  { id: 'sweep', name: 'Wide Swing', v: [0.4, 0.6, 0.8], text: (v) => `Strike also hits another foe for ${pct(v)}% of its damage.` },
  { id: 'feast', name: 'Blood Feast', v: [0.08, 0.12, 0.16], text: (v) => `Defeating a foe restores ${pct(v)}% of your maximum HP.` },
  { id: 'rush', name: 'Bloodrush', v: [0.3, 0.45, 0.6], text: (v) => `Your next hit after defeating a foe deals +${pct(v)}%.` },
  { id: 'brutal', name: 'Brutal Guard', hands: true, v: [0.3, 0.45, 0.6], text: (v) => `While you Guard, a foe that hits you takes ${pct(v)}% of a Strike back.` },
]);

const BASTION = path('VIT', [
  { id: 'iron', name: 'Iron Skin', v: [0.25, 0.35, 0.45], text: (v) => `The first hit you take each round deals ${pct(v)}% less.` },
  { id: 'last', name: 'Last Bastion', v: [0.15, 0.22, 0.3], text: (v) => `Below half HP, damage taken -${pct(v)}%.` },
  { id: 'breath', name: 'Second Breath', v: [0.03, 0.04, 0.05], text: (v) => `At the end of each round, restore ${pct(v)}% of your maximum HP.` },
  { id: 'aegis', name: 'Aegis', hands: true, v: [0.2, 0.4, 0.6], text: (v) => `Guard takes a further ${pct(v)}% off each hit.` },
  { id: 'wall', name: 'Shield Wall', hands: true, v: [0.06, 0.1, 0.14], text: (v) => `Guard also restores ${pct(v)}% of each ally’s maximum HP.` },
  { id: 'rebuke', name: 'Rebuke', v: [0.1, 0.15, 0.2], text: (v) => `A foe that hits you takes ${pct(v)}% of the damage back.` },
  { id: 'banner', name: 'Bannerman', v: [2, 3, 4], text: (v) => `The party starts each fight Rallied for ${turns(v)}.` },
  { id: 'warden', name: 'Warden', hands: true, v: [0.1, 0.15, 0.2], text: (v) => `Cover also restores ${pct(v)}% of the ally’s maximum HP.` },
]);

const TEMPEST = path('AGI', [
  { id: 'quick', name: 'Quickdraw', v: [0.25, 0.4, 0.55], text: (v) => `You act first in each fight, and your first hit deals +${pct(v)}%.` },
  { id: 'twin', name: 'Twin Fangs', v: [0.55, 0.65, 0.75], text: (v) => `Strike hits twice, each for ${pct(v)}% of its damage.` },
  { id: 'vein', name: 'Open Vein', v: [3, 4, 5], text: (v) => `Critical hits inflict Bleeding for ${turns(v)}.` },
  { id: 'after', name: 'Afterimage', v: [1, 2, 3], text: (v) => `Defeating a foe leaves you Veiled for ${turns(v)}.` },
  { id: 'riposte', name: 'Riposte', v: [0.5, 0.75, 1], text: (v) => `When a foe misses you, you strike back for ${pct(v)}% of a Strike.` },
  { id: 'gale', name: 'Gale Step', v: [1, 2, 3], text: (v) => `Defeating a foe takes ${turns(v)} off every skill’s cooldown.` },
  { id: 'deep', name: 'Deep Cuts', v: [1, 2, 3], text: (v) => `Bleeding and Poisoned you inflict last ${turns(v)} longer.` },
  { id: 'sidestep', name: 'Sidestep', hands: true, v: [0.3, 0.45, 0.6], text: (v) => `While you Guard, evasion +${pct(v)}%.` },
]);

const ARCANA = path('INT', [
  { id: 'hexfire', name: 'Hexfire', v: [0.5, 0.75, 1], text: (v) => `Your curses also hit each foe they reach for ${pct(v)}% of a Strike, as magic.` },
  { id: 'linger', name: 'Lingering Dark', v: [1, 2, 3], text: (v) => `Debuffs you inflict last ${turns(v)} longer. Stunned excepted.` },
  { id: 'wither', name: 'Wither', v: [0.06, 0.09, 0.12], text: (v) => `Damage +${pct(v)}% for each debuff the foe carries.` },
  { id: 'kindle', name: 'Kindling', v: [3, 4, 5], text: (v) => `Your magic hits inflict Burning for ${turns(v)}.` },
  { id: 'contagion', name: 'Contagion', v: [2, 3, 4], text: (v) => `Defeating a foe passes its debuffs to the foe with the most HP, for ${turns(v)}.` },
  { id: 'siphon', name: 'Siphon', v: [0.06, 0.09, 0.12], text: (v) => `Your magic hits restore ${pct(v)}% of their damage as HP.` },
  { id: 'doom', name: 'Doom', v: [0.04, 0.06, 0.08], text: (v) => `A Cursed foe loses ${pct(v)}% of its maximum HP at the end of each round.` },
  { id: 'ritual', name: 'Ritual Flask', hands: true, v: [1, 2, 3], text: (v) => `What you throw lasts ${turns(v)} longer.` },
]);

const SIGHT = path('PER', [
  { id: 'spotter', name: 'Spotter', v: [3, 4, 5], text: (v) => `Your first hit on each foe inflicts Marked for ${turns(v)}.` },
  { id: 'deadshot', name: 'Dead Shot', v: [20, 30, 40], text: (v) => `Crit chance +${v}% against a Marked foe.` },
  { id: 'read', name: 'Read the Blow', v: [0.15, 0.25, 0.35], text: (v) => `Damage +${pct(v)}% against a foe whose next action is aimed at you.` },
  { id: 'killshot', name: 'Killing Shot', v: [0.25, 0.3, 0.35], text: (v) => `Hits on a foe below ${pct(v)}% HP are critical.` },
  { id: 'weak', name: 'Weak Point', v: [0.25, 0.4, 0.55], text: (v) => `Damage +${pct(v)}% against a foe Charging or Channelling.` },
  { id: 'expose', name: 'Expose', v: [3, 4, 5], text: (v) => `Critical hits inflict Marked for ${turns(v)}.` },
  { id: 'overwatch', name: 'Overwatch', v: [0.4, 0.6, 0.8], text: (v) => `Once each round, a foe that hits an ally takes ${pct(v)}% of a Strike from you.` },
  { id: 'forewarn', name: 'Forewarned', hands: true, v: [2, 3, 4], text: (v) => `Guard also inflicts Marked for ${turns(v)} on each foe whose next action is aimed at you.` },
]);

const CAPSTONES = of('capstone', [
  { id: 'harvest', name: 'Red Harvest', paths: ['STR'], needs: ['rend', 'butcher', 'feast'], v: [0.15, 0.2, 0.25], text: (v) => `A hit that leaves a Bleeding foe below ${pct(v)}% HP defeats it.` },
  { id: 'unbroken', name: 'Unbreakable', paths: ['VIT'], needs: ['iron', 'last', 'breath'], v: [0.2, 0.3, 0.4], text: (v) => `Once each fight, a hit that would defeat you leaves you at 1 HP and restores ${pct(v)}% of your maximum HP.` },
  { id: 'cuts', name: 'Thousand Cuts', paths: ['AGI'], needs: ['twin', 'vein', 'riposte'], v: [4, 3, 2], text: (v) => `Every ${ORDINAL[v]} hit you land is critical.` },
  { id: 'sun', name: 'Black Sun', paths: ['INT'], needs: ['hexfire', 'kindle', 'doom'], v: [0.02, 0.03, 0.04], text: (v) => `At the end of each round, each foe loses ${pct(v)}% of its maximum HP for every debuff it carries.` },
  { id: 'gaze', name: 'Killing Gaze', paths: ['PER'], needs: ['spotter', 'deadshot', 'killshot'], v: [3, 4, 5], text: (v) => `Defeating a Marked foe inflicts Marked on the foe with the most HP for ${turns(v)}, and your next hit on it is critical.` },
]);

const DUOS = of('duo', [
  { id: 'jugg', name: 'Juggernaut', paths: ['STR', 'VIT'], v: [0.05, 0.07, 0.09], text: (v) => `Strike deals extra damage equal to ${pct(v)}% of your maximum HP.` },
  { id: 'storm', name: 'Bloodstorm', paths: ['STR', 'AGI'], v: [0.3, 0.45, 0.6], text: (v) => `Critical hits on a Bleeding foe deal +${pct(v)}%.` },
  { id: 'hemo', name: 'Hemorrhage', paths: ['STR', 'INT'], v: [0.5, 0.75, 1], text: (v) => `Bleeding and Burning on your foes deal +${pct(v)}% each round.` },
  { id: 'head', name: 'Headhunter', paths: ['STR', 'PER'], v: [3, 4, 5], text: (v) => `Your hits on a Marked foe inflict Bleeding for ${turns(v)}.` },
  { id: 'grudge', name: 'Grudge', paths: ['VIT', 'AGI'], v: [0.1, 0.15, 0.2], text: (v) => `Each hit you take makes your next hit deal +${pct(v)}%, up to ${GRUDGE_MAX} times.` },
  { id: 'thornward', name: 'Ward of Thorns', paths: ['VIT', 'INT'], v: [2, 3, 4], text: (v) => `A foe that hits you is Cursed for ${turns(v)}.` },
  { id: 'vigil', name: 'Vigil', paths: ['VIT', 'PER'], v: [2, 3, 4], text: (v) => `A foe that hits you is Marked for ${turns(v)}.` },
  { id: 'spell', name: 'Spellblade', paths: ['AGI', 'INT'], v: [0.3, 0.45, 0.6], text: (v) => `Strike also hits for ${pct(v)}% of a Strike, as magic.` },
  { id: 'snap', name: 'Snapshot', paths: ['AGI', 'PER'], v: [0.3, 0.45, 0.6], text: (v) => `Your first hit on each foe deals +${pct(v)}%.` },
  { id: 'eye', name: 'Evil Eye', paths: ['INT', 'PER'], v: [3, 4, 5], text: (v) => `Your curses also inflict Marked for ${turns(v)}.` },
]);

/** Every blessing, by id: the five Paths' in tree order, then the Capstones, then the Duos. */
export const BOONS: Record<string, BoonDef> = Object.fromEntries(
  [...RUIN, ...BASTION, ...TEMPEST, ...ARCANA, ...SIGHT, ...CAPSTONES, ...DUOS].map((b) => [b.id, b]),
);
export const BOON_LIST: BoonDef[] = Object.values(BOONS);
export const boonById = (id: string): BoonDef | undefined => BOONS[id];

/** A blessing's number at a tier, 1 to 3; 0 for a tier of none. */
export const boonValue = (id: string, tier: number) => (tier > 0 ? BOONS[id]?.v[Math.min(3, tier) - 1] ?? 0 : 0);
/** What a blessing does at a tier. */
export const boonText = (id: string, tier: number) => BOONS[id]?.text(boonValue(id, Math.max(1, tier))) ?? '';
