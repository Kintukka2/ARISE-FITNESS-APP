/**
 * Where a Shadow stands in a fight, as its card shows it beside its role: `Front` or `Rear`, after Teamfight
 * Tactics' panel, which shows where a unit stands as a tile of its own rather than in its role's tip. A tap opens
 * the game's one tooltip (`ui/tip.tsx`), saying only what standing there decides in a fight, read from the rules in
 * `data/ranks.ts` through the engine's own placing (`ranks.byRole`, as `raid.shadowSpec` places a Shadow).
 */
import * as ranks from '@/core/ranks';
import { REAR_MELEE, ROW_NAME, type Row } from '@/data/ranks';
import type { TipText } from './tip';

/** Two lines, the one it stands in lit: the front nearer the foes, on top, as the brief's party faces them. */
export function StandMark({ row, size = 13 }: { row: Row; size?: number }) {
  return (
    <svg class={`standmark is-${row}`} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <rect x="2" y="3" width="12" height="3.5" rx="1.2" class={row === 'front' ? 'is-on' : ''} />
      <rect x="2" y="9.5" width="12" height="3.5" rx="1.2" class={row === 'rear' ? 'is-on' : ''} />
    </svg>
  );
}

/** Where a Shadow of a role stands. */
export const standOf = (role: string): Row => ranks.byRole(role).row;

/** What standing where a Shadow of a role stands decides in a fight, in the game's one tooltip. */
export function standTip(role: string): TipText {
  const st = ranks.byRole(role);
  const rear = Math.round(REAR_MELEE * 100);
  const lines = st.row === 'front'
    ? ['Melee hits reach it. While anyone stands in the Front, they cannot reach the Rear.',
      ...(st.reaching ? ['Its melee reaches the foes’ Rear as well.'] : [])]
    : [`Melee hits cannot reach it while anyone stands in the Front. ${st.ranged ? 'Its shots reach either rank, and lose nothing from here.' : `Its own melee hits land at ${rear}%.`}`];
  return {
    title: ROW_NAME[st.row],
    kind: 'Where it stands',
    mark: <span class="tip__mark"><StandMark row={st.row} size={16} /></span>,
    tone: 'shadow',
    lines,
  };
}
