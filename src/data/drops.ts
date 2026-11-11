/**
 * Special drops: a stated way to defeat each family of creature, and every boss, that leaves more. Met
 * however it happens, by the hunter's hand or the System's, it is banked on the run and paid in
 * `raid.finish`, kept unless the party is carried out. Numbers here are rules; the screens quote them.
 */
export type ConditionId = 'burning' | 'rooted' | 'stunned' | 'quick' | 'own' | 'shadow' | 'broken';

/**
 * Each condition: what it asks, as it follows "Defeat it" on a card (`text`) and as it follows "defeated" in
 * the fight's feed (`said`), and in full for the Guide where the card says less (`rule`); the status on the
 * creature as it falls, the rounds it falls within, whose blow defeats it.
 */
export const CONDITION: Record<ConditionId, { text: string; said: string; rule?: string; status?: string; rounds?: number; by?: 'hero' | 'shadow' }> = {
  burning: { text: 'while Burning', said: 'while Burning', status: 'Burning' },
  rooted: { text: 'while Rooted', said: 'while Rooted', status: 'Rooted' },
  stunned: { text: 'while Stunned', said: 'while Stunned', status: 'Stunned' },
  quick: { text: 'within 3 rounds', said: 'within 3 rounds', rounds: 3 },
  own: { text: 'yourself', said: 'by your blow', by: 'hero' },
  shadow: { text: 'with a Shadow', said: 'by a Shadow', by: 'shadow' },
  /** A boss's: its wind-up broken, and the hunter's own blow while its defences are down. Auto meets it about one boss fight in five. */
  /** The card says only `while it is Broken`, at the owner's call; the Guide (`rule`) and the feed (`said`) say whose hit it takes. */
  broken: { text: 'while it is Broken', said: 'by your blow while Broken', rule: 'while it is Broken, with your own hit', status: 'Broken', by: 'hero' },
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
