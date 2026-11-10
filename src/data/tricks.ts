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
const span = (xs: readonly number[]) => (xs[0] === xs[xs.length - 1] ? pct(xs[0]) : `${pct(xs[0])}-${pct(xs[xs.length - 1])}`);
/** A count that changes with the grade, as its least and most. */
const range = (xs: readonly number[]) => (Math.min(...xs) === Math.max(...xs) ? `${xs[0]}` : `${Math.min(...xs)}-${Math.max(...xs)}`);

/** Each behaviour's name, and what it does in a line, read from the numbers above. */
export const TRICKS: Record<TrickId, { name: string; text: string }> = {
  shield: { name: 'Shields', text: `Now and then shields an ally instead of attacking: the ally takes ${pct(1 - TRICK.shield.taken)} less damage until this creature's next action.` },
  rally: { name: 'Rallies', text: `Now and then rallies the pack instead of attacking: every creature's attack +${span(TRICK.rally.atk)} by grade, for ${TRICK.rally.turns} rounds.` },
  channel: { name: 'Channels', text: `Now and then channels its spell a turn ahead, ×${TRICK.channel.mult}. Hits on it while it channels break it: ${range(TRICK.channel.pips)} by grade.` },
  enrage: { name: 'Enrages', text: `Below ${pct(TRICK.enrage.below)} HP its attack rises ${span(TRICK.enrage.atk)} by grade, for the rest of the fight.` },
  mark: { name: 'Marks', text: `Now and then marks a target, then strikes it ×${TRICK.mark.mult} with its next action.` },
  pickoff: { name: 'Picks off', text: 'Always goes for the one with the least HP.' },
  aloft: { name: 'Aloft', text: 'After it acts it is Veiled until its next action.' },
  virulent: { name: 'Virulent', text: `What it inflicts always lands, and lasts ${TRICK.virulent.turns} turn longer.` },
  undying: { name: 'Undying', text: `The first time it would fall, it stands at 1 HP and rises again at the round's end with ${pct(TRICK.undying.heal)} HP.` },
  frenzy: { name: 'Frenzy', text: `Damage +${pct(TRICK.frenzy.dmg)} on a target below ${pct(TRICK.frenzy.below)} HP.` },
  bloodlust: { name: 'Bloodlust', text: `Attack +${pct(TRICK.bloodlust.step)} for each hit it lands, up to +${pct(TRICK.bloodlust.step * TRICK.bloodlust.max)}.` },
  regrowth: { name: 'Regrowth', text: `Heals ${span(TRICK.regrowth.heal)} HP by grade at each round's end.` },
  hardened: { name: 'Hardened', text: `The first hit it takes each round deals ${pct(TRICK.hardened.taken)}.` },
  backlash: { name: 'Backlash', text: `Whoever hits it takes ${pct(TRICK.backlash.back)} of the damage back.` },
  secondwind: { name: 'Second Wind', text: `Once, below ${pct(TRICK.secondwind.below)} HP, it drinks instead of attacking: HP +${pct(TRICK.secondwind.heal)}.` },
  windup: { name: 'Winds up', text: `Its heaviest move is announced ${TRICK.windup.ahead} actions ahead, ×${TRICK.windup.mult}, and hits on it break it: ${range(TRICK.windup.pips)} by grade. Broken, it is Stunned and its defences fall ${pct(1 - TRICK.windup.broken.def)}.` },
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
