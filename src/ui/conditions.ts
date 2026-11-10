/** A creature's condition drop in words, for its card, the brief and the fight log: read from the rules. */
import { enemyById } from '@/core/gates';
import { conditionOf } from '@/core/raid';
import { CONDITION, DROP, type ConditionId } from '@/data/drops';
import { FAMILY_PART, PARTS } from '@/data/forge';

/** The part a creature's family leaves. */
export const partOf = (ref: string) => PARTS[FAMILY_PART[enemyById(ref)?.family ?? ''] ?? 'hide'];

/** What a condition met leaves: `Monster Bone +2`, or from a boss `a blueprint`. */
export const dropPay = (ref: string, boss: boolean) => (boss ? `Blueprint +${DROP.bossBlueprints}` : `${partOf(ref).name} +${DROP.part}`);

/** The condition and its pay: `Defeat it while Stunned: Monster Bone +2.` */
export function conditionLine(ref: string, boss: boolean, cond: ConditionId | null = conditionOf(ref, boss)): string | null {
  return cond ? `Defeat it ${CONDITION[cond].text}: ${dropPay(ref, boss)}.` : null;
}

/** The glyph a condition drop wears: its part's, or a blueprint for a boss. */
export const dropGlyph = (ref: string, boss: boolean) => (boss ? 'blueprint' : FAMILY_PART[enemyById(ref)?.family ?? ''] ?? 'hide');
