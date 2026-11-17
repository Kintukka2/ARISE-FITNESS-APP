/**
 * How a Shadow fights, as its card shows it beside its role: `Melee` or `Ranged`, and so where it takes its place,
 * the front for melee and the rear for ranged (every role in the rear fights from range, `RANGED_ROLES`). A tap opens
 * the game's one tooltip (`ui/tip.tsx`): where it takes its place and how its hits reach from there, read from the
 * rules in `data/ranks.ts` through the engine's own placing (`ranks.byRole`). The hunter may still drag it to the
 * other rank on a Gate's brief (`shadows.setStand`); the tag says where it fights best.
 */
import * as ranks from '@/core/ranks';
import type { Stand } from '@/core/ranks';
import { REAR_MELEE } from '@/data/ranks';
import type { Stat } from '@/core/types';
import { Glyph } from './icons';
import type { TipText } from './tip';

export type Style = 'Melee' | 'Ranged';

/** How a creature of a role fights. */
export const styleOf = (role: string): Style => (ranks.byRole(role).ranged ? 'Ranged' : 'Melee');

/** Its mark: a blade for melee, an arrow for ranged. */
export const STYLE_GLYPH: Record<Style, string> = { Melee: 'Weapon', Ranged: 'arrow' };

/** How a Shadow of a role fights, and what that decides, in the game's one tooltip. */
export function styleTip(role: string): TipText {
  const st = ranks.byRole(role);
  const style = styleOf(role);
  const rear = Math.round(REAR_MELEE * 100);
  const line = st.ranged
    ? 'Takes its place in the Rear. Its shots reach either rank, and lose nothing from there.'
    : st.reaching
      ? `Takes its place in the Front. Its melee hits reach the foes’ Rear as well, and land at ${rear}% from the Rear.`
      : `Takes its place in the Front. Its melee hits reach only the foes’ Front while anyone stands in it, and land at ${rear}% from the Rear.`;
  return {
    title: style,
    kind: 'How it fights',
    mark: <span class="tip__mark"><Glyph name={STYLE_GLYPH[style]} /></span>,
    tone: 'shadow',
    lines: [line],
  };
}

/**
 * How an Association hunter fights, by their class's leading stat, as their card shows it (`screens/Hunter.tsx`): a
 * hunter who stands in the rear fights at range, a PER hunter with shots and an INT hunter with spells; one in front
 * fights in melee, an AGI hunter's reaching past the foes' front. Unclassed, a hunter stands in front.
 */
export const styleOfLead = (st: Stand): Style => (st.row === 'rear' ? 'Ranged' : 'Melee');

/** How a hunter of a lead fights, and what that decides, in the game's one tooltip. */
export function hunterStyleTip(lead: Stat | null | undefined): TipText {
  const st = ranks.byLead(lead);
  const style = styleOfLead(st);
  const rear = Math.round(REAR_MELEE * 100);
  const line = st.row === 'rear'
    ? st.ranged
      ? 'Takes their place in the Rear. Their shots reach either rank, and lose nothing from there.'
      : `Takes their place in the Rear. Their spells reach either rank, and a melee hit of theirs lands at ${rear}% from there.`
    : st.reaching
      ? `Takes their place in the Front. Their melee hits reach the foes’ Rear as well, and land at ${rear}% from the Rear.`
      : `Takes their place in the Front. Their melee hits reach only the foes’ Front while anyone stands in it, and land at ${rear}% from the Rear.`;
  return {
    title: style,
    kind: 'How they fight',
    mark: <span class="tip__mark"><Glyph name={STYLE_GLYPH[style]} /></span>,
    tone: 'system',
    lines: [line],
  };
}
