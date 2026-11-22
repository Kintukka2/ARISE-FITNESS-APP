/**
 * The one tooltip the game shows, wherever a word, a tag or a mark tells what it is. It is the fight's tip,
 * after Slay the Spire's keyword tips and Teamfight Tactics' trait tooltip:
 * - its mark and its name on one line, and at the line's right, small, what kind of thing it is (`Kin`,
 *   `Formation`), as the trait tooltip names a trait's kind;
 * - a short paragraph under it, the trigger then what happens (`Below 50% HP, gains 20% Attack for the rest
 *   of the fight.`), coloured by `Keyed`: its figures in the System's blue, its stats and statuses in gold;
 * - where the thing has breakpoints, each on a line of its own, `(2) Attack +10%`, the one reached lit;
 * - where it asks for something, a Shadow's next rank, each ask on a line of its own, its mark a tick once met or a
 *   lock, its figure what is held of what it asks (`Shadow Essence 3/4`), the one met lit in green.
 *
 * A tap anywhere, or Escape, closes it. It lives on the page, over any sheet the word sits in, under the
 * word unless that runs off the foot of the screen. Its edge takes the colour of where it is opened (`tone`):
 * a Gate's ember in a Gate, the Shadows' violet on a Shadow, the System's cyan in a System sheet. Never write a
 * tooltip of another shape.
 */
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Keyed } from './keyed';
import { Glyph } from './icons';

/** A breakpoint of a tooltip: its count in brackets, what it gives, and whether it is reached. */
export interface TipTier { at: number; text: string; on: boolean }

/** What a tooltip asks for: its name, what is held of what it asks, and whether it is met. */
export interface TipNeed { label: string; have: number; need: number; met: boolean }

/** What a tooltip says. */
export interface TipText {
  title: string;
  lines: string[];
  /** The mark the thing wears where it was tapped, drawn before its name. */
  mark?: ComponentChildren;
  /** What kind of thing it is, small at the head's right: `Kin`, `Formation`. */
  kind?: string;
  tiers?: TipTier[];
  needs?: TipNeed[];
  /** Whose colour its edge takes: a Gate's ember, the Shadows' violet, or the System's cyan. */
  tone?: 'gate' | 'shadow' | 'system';
}

/** Where the word tapped stands on the screen. */
export interface TipAt { x: number; top: number; below: number }

export const tipAt = (el: Element): TipAt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, top: r.top, below: r.bottom };
};

/** Everything a tooltip says, read aloud in one go. */
export const tipSaid = (t: TipText) => [
  t.title, t.kind, ...t.lines,
  ...(t.tiers ?? []).map((x) => `${x.at}: ${x.text}`),
  ...(t.needs ?? []).map((x) => `${x.label} ${x.have} of ${x.need}${x.met ? ', met' : ''}`),
].filter(Boolean).join('. ');

/** A tooltip's words, inside its frame or a panel that stands in for it. */
export function TipBody({ title, lines, mark, kind, tiers, needs }: TipText) {
  return (
    <>
      <b class="tip__title">{mark}<span class="tip__name">{title}</span>{kind && <small class="tip__kind">{kind}</small>}</b>
      {lines.map((l) => <p key={l}><Keyed text={l} /></p>)}
      {tiers && tiers.length > 0 && (
        <ul class="tip__tiers">
          {tiers.map((x) => <li key={x.at} class={x.on ? 'is-on' : ''}><b class="num">({x.at})</b> <Keyed text={x.text} /></li>)}
        </ul>
      )}
      {needs && needs.length > 0 && (
        <ul class="tip__needs">
          {needs.map((x) => (
            <li key={x.label} class={x.met ? 'is-met' : ''}>
              <Glyph name={x.met ? 'check' : 'lock'} /><span>{x.label}</span><b class="num">{x.have}/{x.need}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The tooltip itself, by the word tapped, over a shade that a tap anywhere closes. */
export function Tip({ tip, at, close }: { tip: TipText; at: TipAt; close: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const w = Math.min(260, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, at.x - w / 2));
  // Under the word, unless that runs off the foot of the screen.
  const up = at.below > window.innerHeight - 160;
  // Opened from inside a System window, the tooltip stands over the window, not under its scrim.
  const over = !!document.querySelector('.sysgate');
  return createPortal(
    <div class={`tipshade ${over ? 'is-over' : ''}`} onPointerDown={(e) => { e.preventDefault(); close(); }}>
      <div class={`tip tip--${tip.tone ?? 'gate'}`} role="tooltip" style={`left:${left}px;width:${w}px;${up ? `bottom:${window.innerHeight - at.top + 6}px` : `top:${at.below + 6}px`}`}>
        <TipBody {...tip} />
      </div>
    </div>,
    document.body,
  );
}
