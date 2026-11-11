/**
 * What creatures do besides hit: a behaviour for each role at every grade, one for each family from
 * C-Rank up, and a wind-up for every boss and Gatekeeper. Each is shown before it happens, on the foe's
 * card: an action as its intent, a habit as a tag. Numbers here are rules; the Guide quotes them.
 */
import type { Rank } from '@/core/types';

export type TrickId =
  | 'shield' | 'rally' | 'channel' | 'enrage' | 'mark' | 'pickoff' | 'aloft' | 'virulent'
  | 'undying' | 'frenzy' | 'bloodlust' | 'regrowth' | 'hardened' | 'backlash' | 'secondwind'
  | 'windup';

/** Each role's behaviour, at every grade. */
export const ROLE_TRICK: Record<string, TrickId> = {
  Guardian: 'shield', Leader: 'rally', Caster: 'channel', Brute: 'enrage', Assassin: 'mark',
  'Archer / Shooter': 'pickoff', Flier: 'aloft', 'Status Specialist': 'virulent',
};

/** Each family's behaviour, from `FAMILY_FROM` up: kindred families share one. */
export const FAMILY_TRICK: Record<string, TrickId> = {
  Undead: 'undying', Aberration: 'undying',
  Beast: 'frenzy', Chimera: 'frenzy',
  Orc: 'bloodlust', Giantkin: 'bloodlust', Goblinoid: 'bloodlust',
  Insectoid: 'regrowth', Plant: 'regrowth', Slime: 'regrowth',
  Construct: 'hardened', Dragonkin: 'hardened',
  Demon: 'backlash', Elemental: 'backlash',
  Humanoid: 'secondwind', Aquatic: 'secondwind',
};

/** The grade from which a creature has its family's behaviour as well as its role's. */
export const FAMILY_FROM: Rank = 'C';

/** A grade's index, from E at 0. */
const G: Record<string, number> = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
export const gradeIdx = (rank: string) => G[rank] ?? 0;

/** The numbers each behaviour runs on. Where a number grows with the grade, it is a list from E to S. */
export const TRICK = {
  /** How often a creature with an action to take takes it instead of attacking. */
  shield: { chance: 0.35, taken: 0.5 },
  rally: { chance: 0.35, atk: [0.15, 0.15, 0.2, 0.2, 0.25, 0.3], turns: 2 },
  /**
   * Pips by grade, set so the auto policy breaks about two channels in five (28% to 43% measured on the
   * System's road): fewer from C-Rank, where a creature acts twice a round and the window is shorter.
   */
  channel: { chance: 0.35, mult: 1.4, pips: [3, 2, 1, 1, 2, 2] },
  enrage: { below: 0.5, atk: [0.2, 0.2, 0.25, 0.25, 0.3, 0.35] },
  mark: { chance: 0.4, mult: 1.6 },
  aloft: { turns: 2 },
  virulent: { turns: 1 },
  undying: { heal: 0.3 },
  frenzy: { below: 0.5, dmg: 0.25 },
  bloodlust: { step: 0.1, max: 3 },
  regrowth: { heal: [0.04, 0.04, 0.05, 0.05, 0.06, 0.07] },
  hardened: { taken: 0.5 },
  backlash: { back: 0.2 },
  secondwind: { below: 0.4, heal: 0.35 },
  /** A boss's or Gatekeeper's heaviest move: announced two of its actions ahead, harder, broken by hits. */
  /** Pips by grade, set so the auto policy breaks about half (38% to 60% measured on the System's road). */
  windup: { chance: 0.5, ahead: 2, mult: 1.8, pips: [6, 5, 3, 3, 3, 3], broken: { turns: 2, def: 0.6 } },
} as const;

/** A number that grows with the grade, at a grade. */
export const at = (xs: readonly number[], rank: string) => xs[Math.min(xs.length - 1, gradeIdx(rank))];

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** A share that grows with the grade, as its least and most: `15%-30%` (a range takes a hyphen; VOICE.md). */
const spanTo = (xs: readonly number[]) => (xs[0] === xs[xs.length - 1] ? pct(xs[0]) : `${pct(xs[0])}-${pct(xs[xs.length - 1])}`);
/** A count that changes with the grade, as its least and most. */
const countTo = (xs: readonly number[]) => (Math.min(...xs) === Math.max(...xs) ? `${xs[0]}` : `${Math.min(...xs)}-${Math.max(...xs)}`);
const hits = (n: number) => `${n} ${n === 1 ? 'hit' : 'hits'}`;
/**
 * Each behaviour's name, as the references name a trait (Slay the Spire's Thorns, Flight, Enrage and
 * Incantation, Darkest Dungeon's Defender and Mark for Death): a noun for the thing, an adjective for the
 * state, or the move's own name, never a verb in the third person. And what it does, read from the numbers
 * above, in the references' way of telling
 * a move (Slay the Spire's "After taking 27 damage, changes to a defensive mode."): the trigger, then what
 * happens, active, its numbers in the sentence. `about` gives a creature's own numbers at its grade, for
 * its card and the fight's tip; `text` gives the span across every grade, for the Guide.
 */
const broken = `it becomes Broken, is Stunned, and loses ${pct(1 - TRICK.windup.broken.def)} defence for ${TRICK.windup.broken.turns} turns`;
export const TRICKS: Record<TrickId, { name: string; about: (rank: string) => string; text: string }> = {
  shield: {
    name: 'Bodyguard',
    about: () => `Sometimes shields an ally instead of attacking. That ally takes ${pct(1 - TRICK.shield.taken)} less damage until this creature acts again.`,
    text: `Sometimes shields an ally instead of attacking. That ally takes ${pct(1 - TRICK.shield.taken)} less damage until this creature acts again.`,
  },
  rally: {
    name: 'War Cry',
    about: (r) => `Sometimes rallies the pack instead of attacking. Every creature gains ${pct(at(TRICK.rally.atk, r))} Attack for ${TRICK.rally.turns} rounds.`,
    text: `Sometimes rallies the pack instead of attacking. Every creature gains ${spanTo(TRICK.rally.atk)} Attack by grade for ${TRICK.rally.turns} rounds.`,
  },
  channel: {
    name: 'Incantation',
    about: (r) => `Sometimes channels a spell for a turn, then casts it for ${pct(TRICK.channel.mult)} damage. After taking ${hits(at(TRICK.channel.pips, r))} while channelling, ${broken}.`,
    text: `Sometimes channels a spell for a turn, then casts it for ${pct(TRICK.channel.mult)} damage. After taking ${countTo(TRICK.channel.pips)} hits by grade while channelling, ${broken}.`,
  },
  enrage: {
    name: 'Enrage',
    about: (r) => `Below ${pct(TRICK.enrage.below)} HP, gains ${pct(at(TRICK.enrage.atk, r))} Attack for the rest of the fight.`,
    text: `Below ${pct(TRICK.enrage.below)} HP, gains ${spanTo(TRICK.enrage.atk)} Attack by grade for the rest of the fight.`,
  },
  mark: {
    name: 'Death Mark',
    about: () => `Sometimes marks a target, then hits it for ${pct(TRICK.mark.mult)} damage with its next action.`,
    text: `Sometimes marks a target, then hits it for ${pct(TRICK.mark.mult)} damage with its next action.`,
  },
  pickoff: { name: 'Opportunist', about: () => 'Always attacks whoever has the least HP.', text: 'Always attacks whoever has the least HP.' },
  aloft: { name: 'Flight', about: () => 'After acting, is Veiled until its next action.', text: 'After acting, is Veiled until its next action.' },
  virulent: {
    name: 'Virulent',
    about: () => `Its statuses always land and last ${TRICK.virulent.turns} turn longer.`,
    text: `Its statuses always land and last ${TRICK.virulent.turns} turn longer.`,
  },
  undying: {
    name: 'Undying',
    about: () => `The first time it would be defeated, survives at 1 HP and recovers ${pct(TRICK.undying.heal)} HP at the end of the round.`,
    text: `The first time it would be defeated, survives at 1 HP and recovers ${pct(TRICK.undying.heal)} HP at the end of the round.`,
  },
  frenzy: {
    name: 'Predator',
    about: () => `Deals ${pct(TRICK.frenzy.dmg)} more damage to targets below ${pct(TRICK.frenzy.below)} HP.`,
    text: `Deals ${pct(TRICK.frenzy.dmg)} more damage to targets below ${pct(TRICK.frenzy.below)} HP.`,
  },
  bloodlust: {
    name: 'Bloodlust',
    about: () => `Gains ${pct(TRICK.bloodlust.step)} Attack each time it lands a hit, up to ${pct(TRICK.bloodlust.step * TRICK.bloodlust.max)}.`,
    text: `Gains ${pct(TRICK.bloodlust.step)} Attack each time it lands a hit, up to ${pct(TRICK.bloodlust.step * TRICK.bloodlust.max)}.`,
  },
  regrowth: {
    name: 'Regrowth',
    about: (r) => `Recovers ${pct(at(TRICK.regrowth.heal, r))} HP at the end of each round.`,
    text: `Recovers ${spanTo(TRICK.regrowth.heal)} HP by grade at the end of each round.`,
  },
  hardened: {
    name: 'Hardened',
    about: () => `Takes ${pct(1 - TRICK.hardened.taken)} less damage from the first hit each round.`,
    text: `Takes ${pct(1 - TRICK.hardened.taken)} less damage from the first hit each round.`,
  },
  backlash: {
    name: 'Backlash',
    about: () => `Reflects ${pct(TRICK.backlash.back)} of the damage it takes back at the attacker.`,
    text: `Reflects ${pct(TRICK.backlash.back)} of the damage it takes back at the attacker.`,
  },
  secondwind: {
    name: 'Second Wind',
    about: () => `Once, below ${pct(TRICK.secondwind.below)} HP, drinks instead of attacking and recovers ${pct(TRICK.secondwind.heal)} HP.`,
    text: `Once, below ${pct(TRICK.secondwind.below)} HP, drinks instead of attacking and recovers ${pct(TRICK.secondwind.heal)} HP.`,
  },
  windup: {
    name: 'Charged Strike',
    about: (r) => `Charges its strongest attack for ${TRICK.windup.ahead} actions, then strikes for ${pct(TRICK.windup.mult)} damage. After taking ${hits(at(TRICK.windup.pips, r))} while charging, ${broken}.`,
    text: `Charges its strongest attack for ${TRICK.windup.ahead} actions, then strikes for ${pct(TRICK.windup.mult)} damage. After taking ${countTo(TRICK.windup.pips)} hits by grade while charging, ${broken}.`,
  },
};

/** A creature's behaviours: its role's at every grade, its family's from `FAMILY_FROM`, and a wind-up if it is a boss or a Gatekeeper. */
export function tricksOf(e: { role?: string; family?: string; rank?: string }, head: boolean): TrickId[] {
  const out: TrickId[] = [];
  const role = ROLE_TRICK[e.role ?? ''];
  if (role) out.push(role);
  const fam = FAMILY_TRICK[e.family ?? ''];
  if (fam && gradeIdx(e.rank ?? 'E') >= gradeIdx(FAMILY_FROM)) out.push(fam);
  if (head) out.push('windup');
  return out;
}
