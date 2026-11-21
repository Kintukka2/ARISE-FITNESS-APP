/**
 * A socket on a piece's card: the one shape its Engraving and its Temper share (the owner's call, where each was drawn
 * its own way and the card lost its flow), after Diablo IV's aspect and temper rows and Lost Ark's engraving slots.
 * The socket's mark at the left in its own light (an engraving's colour, a temper's gold), and beside it a small
 * capital line saying how the socket stands (`Attuned`, `Tempered 2 times`, `Empty`), what it holds large, and under
 * it what that does; its action across its foot. An empty socket is drawn dashed; a locked one, dim.
 */
import type { ComponentChildren } from 'preact';

export type ModState = 'on' | 'dim' | 'empty' | 'locked' | 'call';

export function ModCard({ class: cls, tone, state, mark, onMark, markLabel, kicker, side, title, value, children, action }: {
  class?: string;
  /** The socket's light: a colour. */
  tone?: string;
  state: ModState;
  mark: ComponentChildren;
  /** The mark as a button: an engraving's stone opens the Codex on it. */
  onMark?: () => void;
  markLabel?: string;
  kicker: ComponentChildren;
  /** At the kicker's right: a count, a pill. */
  side?: ComponentChildren;
  title: ComponentChildren;
  /** At the title's right, large: a temper's size. */
  value?: ComponentChildren;
  children?: ComponentChildren;
  action?: ComponentChildren;
}) {
  const well = <span class="mod__well" aria-hidden={onMark ? undefined : 'true'}>{mark}</span>;
  return (
    <div class={`sysbox mod is-${state} ${cls ?? ''}`} style={tone ? `--mt: ${tone}` : undefined}>
      <div class="mod__main">
        {onMark ? <button type="button" class="mod__mark" aria-label={markLabel} onClick={onMark}>{well}</button> : <span class="mod__mark">{well}</span>}
        <div class="mod__text">
          <span class="mod__kick"><span class="mod__kicker">{kicker}</span>{side}</span>
          <span class="mod__title"><b>{title}</b>{value != null && <span class="mod__v num">{value}</span>}</span>
          {children}
        </div>
      </div>
      {action && <div class="mod__act">{action}</div>}
    </div>
  );
}
