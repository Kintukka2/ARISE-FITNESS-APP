/** Hand-written gates that sit outside the daily board's random draw. */
import type { Dungeon, Enemy } from '@/core/types';

/** The thing the story has been warning about since Level 15. */
export const HOLLOW_MONARCH: Enemy = {
  id: 'ENM-HOLLOW',
  name: 'The Hollow Monarch',
  shadow: 'Shadow of the Hollow Monarch',
  rank: 'S',
  family: 'Aberration',
  role: 'Leader',
  base: { STR: 128, VIT: 140, AGI: 104, INT: 136, PER: 120 },
  kit: ['Sovereign Reap', 'Void Collapse'],
  passive: 'Deathless Sovereignty',
  imm: ['Stunned'],
  res: ['Cursed', 'Weakened'],
};

/** Opens on the board for S-Rank hunters and stays there; it does not rotate out at midnight. */
export const HOLLOW_THRONE: Dungeon = {
  id: 'DNG-HOLLOW',
  rank: 'S',
  name: 'The Hollow Throne',
  theme: 'Density: beyond measurement. Entry: S-Rank. Parties sent: 4. Parties returned: 0.',
  identity: 'Monarch-led',
  mobs: ['ENM-109', 'ENM-110', 'ENM-108'],
  elite: 'ENM-109',
  boss: 'ENM-HOLLOW',
  mobRounds: 4,
};

/** The Association keeps one gate shut for teaching. Valcorde walks you through it once. */
export const PRACTICE_GATE: Dungeon = {
  id: 'DNG-000',
  rank: 'E',
  name: 'The Practice Gate',
  theme: 'Collapsed training cellar, kept shut by the Association for first-day licences. Threat: contained.',
  identity: 'Undead-led',
  mobs: ['ENM-001'],
  boss: 'ENM-001',
  mobRounds: 2,
};
