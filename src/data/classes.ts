import type { Rank, Stat } from '@/core/types';

/** A class is the System naming what your attributes have made you. */
export interface ClassDef {
  id: string;
  name: string;
  desc: string;
  lead: Stat;
  rank: Rank;
  /** 0 at D-Rank, 4 at S-Rank. */
  tier: number;
  /** Flat points paid into the lead attribute. */
  bonus: number;
}

/** Rungs start at D. E-Rank hunters are unclassified. */
export const CLASS_RANKS: Rank[] = ['D', 'C', 'B', 'A', 'S'];
const RUNG_BONUS = [2, 5, 10, 20, 50];

const LINES: { lead: Stat; rungs: [string, string, string][] }[] = [
  {
    lead: 'STR',
    rungs: [
      ['brawler', 'Brawler', 'A class given to hunters who fight with their hands.'],
      ['berserker', 'Berserker', 'A class given to hunters who strike harder when wounded.'],
      ['warbreaker', 'Warbreaker', 'A class given to hunters who break armour.'],
      ['juggernaut', 'Juggernaut', 'A class given to hunters who cannot be stopped once moving.'],
      ['cataclysm', 'Infinite Cataclysm', 'A class given to hunters whose strength has no measured limit.'],
    ],
  },
  {
    lead: 'AGI',
    rungs: [
      ['skirmisher', 'Skirmisher', 'A class given to hunters who strike first, from the edge of a fight.'],
      ['ranger', 'Ranger', 'A class given to hunters who cannot be caught.'],
      ['bladedancer', 'Bladedancer', 'A class given to hunters who fight in rhythm.'],
      ['tempest', 'Tempest', 'A class given to hunters who cannot be held.'],
      ['afterimage', 'White Lightning', 'A class given to hunters who cross a battlefield faster than it can react.'],
    ],
  },
  {
    lead: 'PER',
    rungs: [
      ['scout', 'Scout', 'A class given to hunters who read terrain.'],
      ['tracker', 'Observant', 'A class given to hunters who miss nothing.'],
      ['farsight', 'Tracker', 'A class given to hunters who follow signs others cannot see.'],
      ['truesight', 'Bloodhound', 'A class given to hunters who do not lose a trail.'],
      ['allseer', 'All-Knowing Allseer', 'A class given to hunters from whom nothing is hidden.'],
    ],
  },
  {
    lead: 'VIT',
    rungs: [
      ['warden', 'Warden', 'A class given to hunters who stand between the party and harm.'],
      ['sentinel', 'Sentinel', 'A class given to hunters who take the first assault.'],
      ['bulwark', 'Bulwark', 'A class given to hunters the party shelters behind.'],
      ['immovable', 'Immovable', 'A class given to hunters who cannot be moved.'],
      ['undying', 'Behemoth of Undeath', 'A class given to hunters who did not die when they should have.'],
    ],
  },
  {
    lead: 'INT',
    rungs: [
      ['adept', 'Attuned', 'A class given to hunters who sense mana.'],
      ['tactician', 'Mage', 'A class given to hunters who shape mana into spells.'],
      ['strategist', 'Wizard', 'A class given to hunters who command the deeper laws of magic.'],
      ['grandmaster', 'Grandmaster', 'A class given to hunters who read a Gate before entering it.'],
      ['mastermind', 'Lord of Spells', 'A class given to hunters who command every spell.'],
    ],
  },
];

export const CLASSES: ClassDef[] = LINES.flatMap((line) =>
  line.rungs.map(([id, name, desc], tier) => ({
    id, name, desc, lead: line.lead, rank: CLASS_RANKS[tier], tier, bonus: RUNG_BONUS[tier],
  })),
);

const byId = new Map(CLASSES.map((c) => [c.id, c]));
export const classById = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);

/** The class for a hunter's leading attribute at a given rank (null below D). */
export function classFor(attrs: Record<Stat, number>, rank: Rank | 'N'): ClassDef | null {
  const rung = rank === 'N' ? CLASS_RANKS.length - 1 : CLASS_RANKS.indexOf(rank as Rank);
  if (rung < 0) return null;
  let best = LINES[0];
  for (const line of LINES) if ((attrs[line.lead] ?? 0) > (attrs[best.lead] ?? 0)) best = line;
  return classById(best.rungs[rung][0]);
}
