/**
 * Front and rear (docs/DESIGN.md, "Ranks — built"): each side of a fight stands in two, a front and a rear. A melee
 * hit reaches only the front while anyone stands in it; magic, a volley, a spread, a burst, a wild swing, a strike at
 * all, a throw, a ranged unit's shot and a reaching unit's lunge reach either. A melee hit struck from the rear lands
 * at half. Where a creature stands is its role's, and so is a Shadow's until the hunter moves it on a brief; an
 * Association hunter's and the hunter's, by default, their class's lead; the hunter may choose, and may move in a
 * fight for their turn. A role that stands in the rear is ranged, one that stands in front melee (`Melee` and
 * `Ranged` on a Shadow's card). Numbers here are rules; the screens quote them.
 */
import type { Stat } from '@/core/types';

/** Where a unit stands: in its side's front, or its rear. */
export type Row = 'front' | 'rear';
export const ROWS: Row[] = ['front', 'rear'];
export const ROW_NAME: Record<Row, string> = { front: 'Front', rear: 'Rear' };

/** Where a creature stands, by its role, and so where a Shadow of it stands. A boss stands in front, whatever its role. */
export const ROLE_ROW: Record<string, Row> = {
  Brute: 'front', Guardian: 'front', Assassin: 'front', Flier: 'front',
  'Archer / Shooter': 'rear', Caster: 'rear', Leader: 'rear', 'Status Specialist': 'rear',
};

/**
 * Roles whose physical hits are shots: they reach either row, and lose nothing from the rear. Every role that stands
 * in the rear fights from range, so where a creature stands and how it fights never disagree.
 */
export const RANGED_ROLES = Object.keys(ROLE_ROW).filter((r) => ROLE_ROW[r] === 'rear');
/** Roles whose melee reaches past the front: an Assassin's lunge, a Flier's dive. */
export const REACHING_ROLES = ['Assassin', 'Flier'];

/** Where a hunter stands by their class's lead attribute, the hunter's own until they choose; unclassed, in front. */
export const LEAD_ROW: Record<Stat, Row> = { STR: 'front', VIT: 'front', AGI: 'front', PER: 'rear', INT: 'rear' };
/** Leads whose physical hits are shots. */
export const RANGED_LEADS: Stat[] = ['PER'];
/** Leads whose melee reaches past the front. */
export const REACHING_LEADS: Stat[] = ['AGI'];

/** A melee hit struck from the rear lands at this share. */
export const REAR_MELEE = 0.5;

/** The hunter's action that changes where they stand, for their turn. */
export const MOVE = 'Move';

/**
 * A fight's pack on the later plans (`labyrinth3`): each fight one creature more than its room would hold alone, at
 * least `min` and at most `max`, standing in both ranks when its Gate can field both; a Gatekeeper and a boss each
 * with `retinue` of its Gate's creatures behind it.
 */
export const PACK = { add: 1, min: 2, max: 4, retinue: 1 } as const;
