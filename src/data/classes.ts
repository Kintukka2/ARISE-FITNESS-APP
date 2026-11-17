import type { Rank, Stat } from '@/core/types';

/**
 * A class is the System naming what your attributes have made you. Its line is written as Fire Emblem and Final
 * Fantasy Tactics write a class: what kind of fighter it is and how it fights, in a sentence or two, each rung of a
 * line a step past the last (the owner's call: never `A class given to hunters who...`). A rung's line says nothing a
 * hunter of that class could not do: where it stands (`ranks.byLead`) and what its leading stat gives.
 */
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
      ['brawler', 'Brawler', 'A Front-row fighter who wins by force. Every blow they land is a heavy one.'],
      ['berserker', 'Berserker', 'A fighter who hits harder the longer a fight runs, and keeps swinging when wounded.'],
      ['warbreaker', 'Warbreaker', 'A fighter who breaks a foe’s guard first and the foe after.'],
      ['juggernaut', 'Juggernaut', 'A fighter whose charge does not stop once it starts. It carries through a whole pack.'],
      ['cataclysm', 'Infinite Cataclysm', 'Strength past any measured limit. One blow from them can end a fight.'],
    ],
  },
  {
    lead: 'AGI',
    rungs: [
      ['skirmisher', 'Skirmisher', 'A Front-row fighter who strikes first. Their blades reach past the Front row to the foes behind it.'],
      ['ranger', 'Ranger', 'A fighter too quick to pin down. Blows aimed at them often find only air.'],
      ['bladedancer', 'Bladedancer', 'A fighter who moves in rhythm, each cut opening the way for the next.'],
      ['tempest', 'Tempest', 'A fighter too fast to hold, who acts before most foes can and cuts through several.'],
      ['afterimage', 'White Lightning', 'Agility past any measured limit. They cross a battlefield faster than it can react.'],
    ],
  },
  {
    lead: 'PER',
    rungs: [
      ['scout', 'Scout', 'A Rear-row marksman whose shots reach any foe. What they aim at, they rarely miss.'],
      ['tracker', 'Observant', 'A marksman who finds the weak point in every foe and strikes there.'],
      ['farsight', 'Tracker', 'A marksman who marks a target and does not lose it.'],
      ['truesight', 'Bloodhound', 'A marksman who finishes what others have wounded.'],
      ['allseer', 'All-Knowing Allseer', 'Perception past any measured limit. Nothing on a battlefield is hidden from them.'],
    ],
  },
  {
    lead: 'VIT',
    rungs: [
      ['warden', 'Warden', 'A Front-row guardian who stands between the party and harm.'],
      ['sentinel', 'Sentinel', 'A guardian who meets the first assault so the party does not have to.'],
      ['bulwark', 'Bulwark', 'A guardian built to outlast any fight. The party fights from behind them.'],
      ['immovable', 'Immovable', 'A guardian who holds the line however hard it is struck.'],
      ['undying', 'Behemoth of Undeath', 'Vitality past any measured limit. They stay standing after blows that should have ended them.'],
    ],
  },
  {
    lead: 'INT',
    rungs: [
      ['adept', 'Attuned', 'A Rear-row caster who senses mana and shapes it into spells that reach any foe.'],
      ['tactician', 'Mage', 'A caster whose spells weaken and curse as well as wound.'],
      ['strategist', 'Wizard', 'A caster who commands the deeper laws of magic and lays spells on a whole pack at once.'],
      ['grandmaster', 'Grandmaster', 'A caster who reads a fight before it starts. The party moves on their call.'],
      ['mastermind', 'Lord of Spells', 'Intelligence past any measured limit. Every spell answers them.'],
    ],
  },
];

export const CLASSES: ClassDef[] = LINES.flatMap((line) =>
  line.rungs.map(([id, name, desc], tier) => ({
    id, name, desc, lead: line.lead, rank: CLASS_RANKS[tier], tier, bonus: RUNG_BONUS[tier],
  })),
);

const byId = new Map(CLASSES.map((c) => [c.id, c]));

/** The class a class rises to at the next rank, as Fire Emblem's class screen names a promotion; none past S-Rank. */
export const nextRung = (c: ClassDef): ClassDef | null => CLASSES.find((x) => x.lead === c.lead && x.tier === c.tier + 1) ?? null;
export const classById = (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);

/** The class for a hunter's leading attribute at a given rank (null below D). */
export function classFor(attrs: Record<Stat, number>, rank: Rank | 'N'): ClassDef | null {
  const rung = rank === 'N' ? CLASS_RANKS.length - 1 : CLASS_RANKS.indexOf(rank as Rank);
  if (rung < 0) return null;
  let best = LINES[0];
  for (const line of LINES) if ((attrs[line.lead] ?? 0) > (attrs[best.lead] ?? 0)) best = line;
  return classById(best.rungs[rung][0]);
}
