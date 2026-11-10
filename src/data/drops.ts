/**
 * Condition drops: a stated way to fell each family of creature, and every boss, that leaves more. Met
 * however it happens, by the hunter's hand or the System's, it is banked on the run and paid in
 * `raid.finish`, kept unless the party is carried out. Numbers here are rules; the screens quote them.
 */
export type ConditionId = 'burning' | 'rooted' | 'stunned' | 'quick' | 'own' | 'shadow' | 'broken';

/** Each condition: what it asks, the status on the creature as it falls, the rounds it falls within, whose blow fells it. */
export const CONDITION: Record<ConditionId, { text: string; status?: string; rounds?: number; by?: 'hero' | 'shadow' }> = {
  burning: { text: 'while Burning', status: 'Burning' },
  rooted: { text: 'while Rooted', status: 'Rooted' },
  stunned: { text: 'while Stunned', status: 'Stunned' },
  quick: { text: 'within 3 rounds', rounds: 3 },
  own: { text: 'with your own blow', by: 'hero' },
  shadow: { text: 'with a Shadow’s blow', by: 'shadow' },
  /** A boss's: its wind-up broken, and the hunter's own blow while its defences are down. Auto meets it about one boss fight in five. */
  broken: { text: 'while Broken, with your own blow', status: 'Broken', by: 'hero' },
};

/** Each family's condition: kindred families share one, as they share a behaviour. */
export const FAMILY_CONDITION: Record<string, ConditionId> = {
  Undead: 'burning', Aberration: 'burning',
  Beast: 'rooted', Chimera: 'rooted',
  Orc: 'stunned', Giantkin: 'stunned', Goblinoid: 'stunned',
  Insectoid: 'quick', Plant: 'quick', Slime: 'quick',
  Construct: 'own', Dragonkin: 'own', Humanoid: 'own', Aquatic: 'own',
  Demon: 'shadow', Elemental: 'shadow',
};

/** Every boss's: felled while Broken, with the hunter's own blow. */
export const BOSS_CONDITION: ConditionId = 'broken';

/** What a condition met leaves: the family's part, and from a boss a blueprint of the Gate's grade. */
export const DROP = { part: 2, bossBlueprints: 1 } as const;
