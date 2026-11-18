/**
 * The statuses a creature or a Shadow wards off, as the brief's creature card lists them: `Immune:` and `Resists:` on
 * a line each, each status named with its mark. The word itself is what is tapped, never a pill around it (the
 * owner's call: the card keeps its look), and it opens the game's one tooltip (`ui/tip.tsx`): the status by name, its
 * kind at the right, what the ward does, then what the status would have done. The Shadow card lists its wards the
 * same way (`screens/Shadows.tsx`).
 */
import { RESIST_STATUS, STATUS_TEXT } from '@/core/combat';
import { STATUS_MARK, StatusMark } from './effects';
import { InfoTag } from './infotag';
import type { TipText } from './tip';

export type WardKind = 'Immune' | 'Resists';

/** A ward in the one tooltip, its edge the colour of where it is opened: a Gate's ember on a creature, the Shadows' violet on a Shadow. */
export function wardTip(st: string, kind: WardKind, tone: TipText['tone'] = 'gate'): TipText {
  const does = STATUS_TEXT[st];
  return {
    title: st,
    kind,
    tone,
    mark: STATUS_MARK[st] ? <span class="tip__mark tip__status"><StatusMark name={st} /></span> : undefined,
    lines: [
      kind === 'Immune' ? `${st} never lands on it, whatever inflicts it.` : `Against ${st}, it has Status Save +${RESIST_STATUS}.`,
      ...(does ? [`${st}: ${does}.`] : []),
    ],
  };
}

/** Statuses named in a line, each its mark and its word, the word opening what the ward does. */
export function WardWords({ names, kind, tone }: { names: readonly string[]; kind: WardKind; tone?: TipText['tone'] }) {
  return (
    <>
      {names.map((st, i) => (
        <span key={st} class="bstatus is-ward">
          <InfoTag class="wardword" tip={wardTip(st, kind, tone)}>
            {STATUS_MARK[st] && <span class="tag__mark"><StatusMark name={st} /></span>}{st}
          </InfoTag>
          {i < names.length - 1 ? ',' : ''}
        </span>
      ))}
    </>
  );
}

/** A creature's or a Shadow's wards as the creature card lists them: a line to `Immune:` and to `Resists:`. */
export function WardLines({ imm, res, tone }: { imm: readonly string[]; res: readonly string[]; tone?: TipText['tone'] }) {
  if (!imm.length && !res.length) return null;
  return (
    <ul class="blist bwards">
      {imm.length > 0 && <li class="bline is-imm"><span class="bline__mark" aria-hidden="true"><i /></span><span class="bline__text"><b>Immune:</b> <WardWords names={imm} kind="Immune" tone={tone} /></span></li>}
      {res.length > 0 && <li class="bline is-res"><span class="bline__mark" aria-hidden="true"><i /></span><span class="bline__text"><b>Resists:</b> <WardWords names={res} kind="Resists" tone={tone} /></span></li>}
    </ul>
  );
}
