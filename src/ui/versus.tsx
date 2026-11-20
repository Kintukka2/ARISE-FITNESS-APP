/**
 * The brief's two cards, one over the other with `VS` between them (the owner's call: the enemies and the party set
 * out alike, each a card that opens a window of its own): the enemies' in red, the party's in the Gates' orange.
 * Each is one button:
 * - its name and its power at its head, inside the card, and a chevron;
 * - its faces in groups, each group named over them (`Boss`, `Gatekeeper`, `Creatures`; `Front`, `Rear`), every face
 *   its own art with no tile round it, the strongest lit in its colour;
 * - under a hairline, its marks with their names: the party's bonuses, the enemies' habits.
 * Crowded, the faces shrink; packed, they overlap a little; the card keeps its one row of faces.
 */
import { powerText } from './power';
import type { ComponentChildren } from 'preact';
import { sfx } from '@/audio/audio';
import { Glyph } from './icons';

export interface VFace { key: string; kind: string; face: ComponentChildren }
export interface VGroup { key: string; label: string; faces: VFace[]; extra?: ComponentChildren }
export interface VMark { key: string; mark: ComponentChildren; name: string }

export function VersusCard({ side, title, power, groups, marks, said, open, tour, children }: {
  side: 'foes' | 'party'; title: string; power: number | null; groups: VGroup[]; marks: VMark[]; said: string; open: () => void; tour?: string;
  children?: ComponentChildren;
}) {
  const tiles = groups.reduce((n, g) => n + g.faces.length + (g.extra ? 1 : 0), 0);
  const crowd = tiles > 7 ? (tiles > 9 ? 'is-crowded is-packed' : 'is-crowded') : '';
  return (
    <section class={`vcard vcard--${side}`} aria-label={title} data-tour={tour}>
      <button type="button" class={`vcard__hit ${crowd}`} aria-haspopup="dialog" aria-label={said} onClick={() => { sfx.tap(); open(); }}>
        <span class="vcard__head">
          <span class="vcard__title">{title}</span>
          <span class="vcard__power"><Glyph name="power" /><b class="num">{power === null ? '?' : powerText(power)}</b></span>
          <Glyph name="chevron" class="vcard__go" />
        </span>
        <span class="vcard__groups">
          {groups.filter((g) => g.faces.length || g.extra).map((g) => (
            <span key={g.key} class={`vcard__group is-${g.key}`}>
              <small class="vcard__glabel">{g.label}</small>
              <span class="vcard__faces">
                {g.faces.map((f, i) => <i key={f.key} class={`vcard__face is-${f.kind}`} style={`--i: ${i}`}>{f.face}</i>)}
                {g.extra}
              </span>
            </span>
          ))}
        </span>
        {marks.length > 0 && (
          <span class="vcard__marks" aria-hidden="true">
            {marks.map((m) => <span key={m.key} class="vcard__mark">{m.mark}<small>{m.name}</small></span>)}
          </span>
        )}
      </button>
      {children}
    </section>
  );
}

/** The seam between the two cards: `VS`, the enemies' red above meeting the party's cyan below. */
export function Versus() {
  return <div class="bvs" aria-hidden="true"><i /><b>VS</b><i /></div>;
}
