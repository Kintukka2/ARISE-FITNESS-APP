/**
 * Special drops: a stated way to defeat each family of creature, and every boss, that leaves more. Met
 * however it happens, by the hunter's hand or the System's, it is banked on the run and paid in
 * `raid.finish`, kept unless the party is carried out. Numbers here are rules; the screens quote them.
 */
export type ConditionId = 'burning' | 'rooted' | 'stunned' | 'quick' | 'own' | 'shadow' | 'broken';

/**
 * Each condition: what it asks, framed by the final hit (`text`, on a card and in a fight's tip; "Land the
 * final hit" where it must be the hunter's own, "The final hit lands" where anyone's counts), and as it
 * follows "defeated" in the fight's feed (`said`); the status on the creature as it falls, the rounds it
 * falls within, whose blow defeats it.
 */
export const CONDITION: Record<ConditionId, { text: string; said: string; status?: string; rounds?: number; by?: 'hero' | 'shadow' }> = {
  burning: { text: 'The final hit lands while it is Burning', said: 'while Burning', status: 'Burning' },
  rooted: { text: 'The final hit lands while it is Rooted', said: 'while Rooted', status: 'Rooted' },
  stunned: { text: 'The final hit lands while it is Stunned', said: 'while Stunned', status: 'Stunned' },
  quick: { text: 'The final hit lands within 3 rounds', said: 'within 3 rounds', rounds: 3 },
  own: { text: 'Land the final hit', said: 'by your blow', by: 'hero' },
  shadow: { text: 'A Shadow lands the final hit', said: 'by a Shadow', by: 'shadow' },
  /** A boss's: its wind-up broken, and the hunter's own blow while its defences are down. Auto meets it about one boss fight in five. */
  broken: { text: 'Land the final hit while it is Broken', said: 'by your blow while Broken', status: 'Broken', by: 'hero' },
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

/** Every boss's: defeated by the hunter's own blow while Broken. */
export const BOSS_CONDITION: ConditionId = 'broken';

/** What a condition met leaves: the family's part, and from a boss a blueprint of the Gate's grade. */
export const DROP = { part: 2, bossBlueprints: 1 } as const;
