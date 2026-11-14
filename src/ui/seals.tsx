/**
 * The Seals' art, shared by the brief and the Daily Rift: a seal pressed in wax, and the rows a Rift's
 * modifiers are read in. Each seal is embossed with its own sign, so it is told apart from the others at a
 * glance, and a modifier is read as one row: its seal, its name, and its rule beside them, after Monster
 * Train's mutators and Hades' Pact of Punishment.
 */
import { SEALS, type SealId } from '@/data/seals';
import { glyphPath } from './icons';

/** Each Seal's sign, from the plan's and the bag's marks: what its rule touches. */
export const SEAL_GLYPH: Record<SealId, string> = {
  swollen: 'heart',
  lightless: 'roomRest',
  shorthanded: 'profile',
  wardens: 'roomKeeper',
  dry: 'potion',
  alone: 'roomBoss',
  heavier: 'crown',
};

const WAX = 'M13.16 1.84Q14.32 2.58 15.69 2.47Q17.07 2.35 17.75 3.54Q18.43 4.74 19.7 5.27Q20.97 5.81 21.02 7.18Q21.07 8.56 21.95 9.62Q22.82 10.69 22.22 11.93Q21.63 13.17 21.91 14.52Q22.19 15.87 21.09 16.69Q19.98 17.51 19.61 18.83Q19.23 20.16 17.87 20.37Q16.51 20.59 15.56 21.59Q14.61 22.58 13.3 22.14Q12 21.7 10.7 22.14Q9.39 22.58 8.44 21.59Q7.49 20.59 6.13 20.37Q4.77 20.16 4.39 18.83Q4.02 17.51 2.91 16.69Q1.81 15.87 2.09 14.52Q2.37 13.17 1.78 11.93Q1.18 10.69 2.05 9.62Q2.93 8.56 2.98 7.18Q3.03 5.81 4.3 5.27Q5.57 4.74 6.25 3.54Q6.93 2.35 8.31 2.47Q9.68 2.58 10.84 1.84Q12 1.1 13.16 1.84z';
const KEY = 'M12 8.1a2.1 2.1 0 0 1 1.15 3.86l.75 4.04h-3.8l.75-4.04A2.1 2.1 0 0 1 12 8.1z';

/**
 * A Seal pressed in wax: a scalloped disc, its rim embossed, and at its heart the Seal's sign (`id`), or a
 * keyhole for a seal not named. Its colour is the wax's.
 */
export function SealArt({ size = 24, class: cls, style, id }: { size?: number; class?: string; style?: string; id?: SealId }) {
  const sign = id ? glyphPath(SEAL_GLYPH[id]) : undefined;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`sealart ${cls ?? ''}`} style={style} aria-hidden="true">
      <path class="sealart__wax" d={WAX} />
      <circle class="sealart__rim" cx="12" cy="12" r="6.7" />
      {sign
        ? <path class="sealart__key sealart__sign" d={sign} transform="translate(7.4 7.4) scale(0.383)" />
        : <path class="sealart__key" d={KEY} />}
    </svg>
  );
}

/**
 * A run's modifiers, a row to each: its seal with its sign, its name, and its rule under the name, so each
 * rule reads as its own seal's. `compact` sets the rule beside the name, for a card.
 */
export function ModRows({ mods, compact = false, size = 34 }: { mods: readonly SealId[]; compact?: boolean; size?: number }) {
  return (
    <ul class={`modrows ${compact ? 'is-compact' : ''}`}>
      {mods.map((id, i) => (
        <li key={id} class="modrow" style={`--i: ${i}`} aria-label={`${SEALS[id].name}: ${SEALS[id].rule}`}>
          <SealArt id={id} size={size} class="is-on" />
          <span class="modrow__text">
            <b>{SEALS[id].name}</b>
            <small>{SEALS[id].rule}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
