/**
 * The System's frame, as the anime draws it: a coloured frame lit along the top and the bottom, a
 * dark glass panel inside it ruled with a pale hairline, and every element in a hairline box of
 * its own (the icon, the header, each field, each button). Only the System is drawn this way;
 * Valcorde, the app and the other voices keep their own frames (docs/VOICE.md, "The look").
 *
 * The frame takes its colour from its kind, by CLAUDE.md's rules: cyan for the System, gold for
 * advancement, orange for Gates, violet for Shadows. The text inside is white and glows that colour.
 */
import type { ComponentChildren } from 'preact';
import type { Kind } from './overlays';

/** One of the lit rails along the top or the bottom of the frame. */
export function Rail({ at }: { at: 'top' | 'bottom' }) {
  return <i class={`sysrail sysrail--${at}`} aria-hidden="true"><i /></i>;
}

/** The circled exclamation mark that heads a Notification. */
export function Bang() {
  return <span class="sysbang" aria-hidden="true">!</span>;
}

/**
 * A header box. A header word (`Notification`, `Status`) is set in capitals. A card's header is its
 * name with its type in front (`Item: Warden Plate`): the type is set small, the name as written.
 */
const CARD = /^([A-Z][A-Za-z ]*): (.+)$/;
const isCard = (title: string) => CARD.test(title);

export function HeadBox({ title }: { title: string }) {
  const card = CARD.exec(title);
  return card
    ? <h2 class="sysbox syshead__title is-card"><small>{card[1]}:</small> {card[2]}</h2>
    : <h2 class="sysbox syshead__title">{title}</h2>;
}

/** The icon box and the header box, side by side. `icon={null}` leaves the icon box out, as Status does. */
export function SysHead({ title, icon, tools }: { title: string; icon?: ComponentChildren; tools?: ComponentChildren }) {
  return (
    <header class={`syshead ${tools ? 'has-tools' : ''} ${isCard(title) ? 'is-card' : ''}`}>
      {icon !== null && <span class="sysbox syshead__icon">{icon ?? <Bang />}</span>}
      <HeadBox title={title} />
      {tools && <span class="syshead__tools">{tools}</span>}
    </header>
  );
}

/** The frame kinds a System surface may take. Gear is the System's own, so it takes cyan. */
export type FrameKind = Extract<Kind, 'system' | 'gold' | 'gates' | 'shadow' | 'gear'>;

/** A System surface set into a screen or a sheet: the Status sheet, Quest Info, an item card. */
export function SysFrame({ title, icon, tools, kind = 'system', class: cls, tour, label, children }: {
  title?: string; icon?: ComponentChildren; tools?: ComponentChildren; kind?: FrameKind; class?: string; tour?: string; label?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`sysframe sysframe--${kind} ${cls ?? ''}`} data-tour={tour} aria-label={label ?? title}>
      <Rail at="top" />
      <div class="sysframe__glass">
        {title && <SysHead title={title} icon={icon} tools={tools} />}
        {children}
      </div>
      <Rail at="bottom" />
    </section>
  );
}

/** A labelled value, as the source sets its fields: the label small above, the value under it. */
export function Field({ k, v, wide }: { k: string; v: ComponentChildren; wide?: boolean }) {
  return (
    <div class={`sysfield ${wide ? 'is-wide' : ''}`}>
      <span>{k}:</span>
      <b>{v}</b>
    </div>
  );
}

/** A numbered list of rewards, each in a hairline box of its own inside one box (`system.rewardList` in a window). */
export function Rewards({ items }: { items: ComponentChildren[] }) {
  return (
    <ol class="sysrewards">
      {items.map((r, i) => <li key={i} class="sysbox sysreward">{i + 1}. {r}</li>)}
    </ol>
  );
}
