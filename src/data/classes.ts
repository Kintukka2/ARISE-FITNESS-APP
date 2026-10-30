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
      ['brawler', 'Brawler', 'Your fists speak the oldest battle-language, and every blow writes it in bone.'],
      ['berserker', 'Berserker', 'Rage burns through your veins; the deeper the wound, the harder you strike.'],
      ['warbreaker', 'Warbreaker', 'Armour, stone, and monstrous hide split beneath the judgement of your weapon.'],
      ['juggernaut', 'Juggernaut', 'Once you begin the charge, neither spell nor steel can turn you aside.'],
      ['cataclysm', 'Infinite Cataclysm', 'Your strength knows no horizon; each blow births another catastrophe until nothing remains but silence.'],
    ],
  },
  {
    lead: 'AGI',
    rungs: [
      ['skirmisher', 'Skirmisher', 'A flash of steel at the battle’s edge, you strike before danger can find its footing.'],
      ['ranger', 'Ranger', 'The wild wind guides your step, carrying you beyond claw, curse, and arrow.'],
      ['bladedancer', 'Bladedancer', 'Your blade follows a deadly rhythm, and every enemy is drawn into the dance.'],
      ['tempest', 'Tempest', 'You move as the storm moves — swift, merciless, and impossible to hold.'],
      ['afterimage', 'White Lightning', 'You cross the battlefield as a streak of white fire, leaving thunder and fallen foes in your wake.'],
    ],
  },
  {
    lead: 'PER',
    rungs: [
      ['scout', 'Scout', 'You read broken branches, shifting air, and silence itself as clearly as a map.'],
      ['tracker', 'Observant', 'Nothing escapes your notice; a bent blade of grass can betray an unseen threat.'],
      ['farsight', 'Tracker', 'You follow signs others cannot see, hunting your quarry across any terrain or realm.'],
      ['truesight', 'Bloodhound', 'Once you catch a quarry’s trail, neither darkness, distance, nor sorcery can hide it from you.'],
      ['allseer', 'All-Knowing Allseer', 'All paths and hidden truths blaze before your sight; no fate can turn beyond the reach of your gaze.'],
    ],
  },
  {
    lead: 'VIT',
    rungs: [
      ['warden', 'Warden', 'You plant your feet between the darkness and those who cannot face it alone.'],
      ['sentinel', 'Sentinel', 'Ever watchful, you endure the first assault and answer with unbroken resolve.'],
      ['bulwark', 'Bulwark', 'Behind you, allies find courage; before you, even giants break like waves on stone.'],
      ['immovable', 'Immovable', 'No force can bend your stance, for your will has taken root deeper than mountains.'],
      ['undying', 'Behemoth of Undeath', 'Death could not claim you; now you advance as an undying colossus, crushing all beneath your inexorable tread.'],
    ],
  },
  {
    lead: 'INT',
    rungs: [
      ['adept', 'Attuned', 'Mana stirs at your touch, answering instincts you have only begun to understand.'],
      ['tactician', 'Mage', 'Arcane power obeys your will, shaped into spells with a word and a gesture.'],
      ['strategist', 'Wizard', 'You command the deeper laws of magic, weaving forces lesser minds dare not name.'],
      ['grandmaster', 'Grandmaster', 'To you, a Gate is no mystery — only a grand game whose final move is already known.'],
      ['mastermind', 'Lord of Spells', 'All secrets lie open before your divine sight; every spell, scheme, and possible fate is yours to command.'],
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
