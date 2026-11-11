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
const breaks = (n: number) => (n === 1 ? 'breaks' : 'break');
/** What a break does, to a wind-up or a channel alike. */
const BROKEN = `Broken: it is Stunned, and its defences fall ${pct(1 - TRICK.windup.broken.def)} for ${TRICK.windup.broken.turns} turns.`;

/**
 * Each behaviour's name, and what it does at a grade, a fact to a line, read from the numbers above: the
 * creature's card and the fight's tip read the same lines, each with the creature's own numbers.
 */
export const TRICKS: Record<TrickId, { name: string; lines: (rank: string) => string[]; text: string }> = {
  shield: { name: 'Shields', lines: () => ['Now and then it shields an ally instead of attacking.', `The ally: Damage taken -${pct(1 - TRICK.shield.taken)} until this creature acts again.`], text: `Now and then it shields an ally instead of attacking. The ally: Damage taken -${pct(1 - TRICK.shield.taken)} until this creature acts again.` },
  rally: { name: 'Rallies', lines: (r) => ['Now and then it rallies the pack instead of attacking.', `Every creature: Attack +${pct(at(TRICK.rally.atk, r))} for ${TRICK.rally.turns} rounds.`], text: `Now and then it rallies the pack instead of attacking. Every creature: Attack +${spanTo(TRICK.rally.atk)} by grade, for ${TRICK.rally.turns} rounds.` },
  channel: { name: 'Channels', lines: (r) => ['Now and then it channels its spell a turn ahead.', `The spell: Damage ×${TRICK.channel.mult}.`, `${hits(at(TRICK.channel.pips, r))} on it while it channels ${breaks(at(TRICK.channel.pips, r))} it.`, BROKEN], text: `Now and then it channels its spell a turn ahead: Damage ×${TRICK.channel.mult}. ${countTo(TRICK.channel.pips)} hits on it while it channels break it, by grade.` },
  enrage: { name: 'Enrages', lines: (r) => [`Below ${pct(TRICK.enrage.below)} HP: Attack +${pct(at(TRICK.enrage.atk, r))} for the rest of the fight.`], text: `Below ${pct(TRICK.enrage.below)} HP: Attack +${spanTo(TRICK.enrage.atk)} by grade, for the rest of the fight.` },
  mark: { name: 'Marks', lines: () => ['Now and then it marks a target.', `Its next action strikes that target: Damage ×${TRICK.mark.mult}.`], text: `Now and then it marks a target. Its next action strikes that target: Damage ×${TRICK.mark.mult}.` },
  pickoff: { name: 'Picks off', lines: () => ['It always goes for the one with the least HP.'], text: 'It always goes for the one with the least HP.' },
  aloft: { name: 'Aloft', lines: () => ['After it acts, it is Veiled until its next action.'], text: 'After it acts, it is Veiled until its next action.' },
  virulent: { name: 'Virulent', lines: () => ['What it inflicts always lands.', `It lasts ${TRICK.virulent.turns} turn longer.`], text: `What it inflicts always lands. It lasts ${TRICK.virulent.turns} turn longer.` },
  undying: { name: 'Undying', lines: () => ['The first time it would fall, it stands at 1 HP.', `At the round's end it rises again: HP +${pct(TRICK.undying.heal)}.`], text: `The first time it would fall, it stands at 1 HP. At the round's end it rises again: HP +${pct(TRICK.undying.heal)}.` },
  frenzy: { name: 'Frenzy', lines: () => [`Against a target below ${pct(TRICK.frenzy.below)} HP: Damage +${pct(TRICK.frenzy.dmg)}.`], text: `Against a target below ${pct(TRICK.frenzy.below)} HP: Damage +${pct(TRICK.frenzy.dmg)}.` },
  bloodlust: { name: 'Bloodlust', lines: () => [`Each hit it lands: Attack +${pct(TRICK.bloodlust.step)}.`, `At most: Attack +${pct(TRICK.bloodlust.step * TRICK.bloodlust.max)}.`], text: `Each hit it lands: Attack +${pct(TRICK.bloodlust.step)}. At most: Attack +${pct(TRICK.bloodlust.step * TRICK.bloodlust.max)}.` },
  regrowth: { name: 'Regrowth', lines: (r) => [`At each round's end: HP +${pct(at(TRICK.regrowth.heal, r))}.`], text: `At each round's end: HP +${spanTo(TRICK.regrowth.heal)} by grade.` },
  hardened: { name: 'Hardened', lines: () => [`The first hit it takes each round: Damage taken -${pct(1 - TRICK.hardened.taken)}.`], text: `The first hit it takes each round: Damage taken -${pct(1 - TRICK.hardened.taken)}.` },
  backlash: { name: 'Backlash', lines: () => [`Whoever hits it takes ${pct(TRICK.backlash.back)} of the damage back.`], text: `Whoever hits it takes ${pct(TRICK.backlash.back)} of the damage back.` },
  secondwind: { name: 'Second Wind', lines: () => [`Once, below ${pct(TRICK.secondwind.below)} HP, it drinks instead of attacking.`, `HP +${pct(TRICK.secondwind.heal)}.`], text: `Once, below ${pct(TRICK.secondwind.below)} HP, it drinks instead of attacking. HP +${pct(TRICK.secondwind.heal)}.` },
  windup: { name: 'Winds up', lines: (r) => [`It announces its heaviest move ${TRICK.windup.ahead} actions ahead.`, `That move: Damage ×${TRICK.windup.mult}.`, `${hits(at(TRICK.windup.pips, r))} on it before then ${breaks(at(TRICK.windup.pips, r))} it.`, BROKEN], text: `It announces its heaviest move ${TRICK.windup.ahead} actions ahead: Damage ×${TRICK.windup.mult}. ${countTo(TRICK.windup.pips)} hits on it before then break it, by grade: it is Stunned, and its defences fall ${pct(1 - TRICK.windup.broken.def)} for ${TRICK.windup.broken.turns} turns.` },
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
