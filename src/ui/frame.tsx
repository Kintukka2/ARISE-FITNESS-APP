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
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Kind } from './overlays';
import { Glyph } from './icons';
import type { Header } from './system';

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
/**
 * A field: its label small, in capitals, above its value. With `help`, a `?` beside the label opens a
 * line on what the field means, the interface explaining inside the System's frame; a pointer that
 * can hover shows it on hover too.
 */
export function Field({ k, v, wide, help }: { k: string; v: ComponentChildren; wide?: boolean; help?: string }) {
  const [open, setOpen] = useState(false);
  if (!help) {
    return (
      <div class={`sysfield ${wide ? 'is-wide' : ''}`}>
        <span>{k}:</span>
        <b>{v}</b>
      </div>
    );
  }
  // With a line to give, the whole box is the button: a tap opens it, another closes it. The `?` in
  // its corner only says there is something to open.
  return (
    <button type="button" class={`sysfield has-help ${wide ? 'is-wide' : ''} ${open ? 'is-open' : ''}`}
      aria-expanded={open} aria-label={`${k}: what it means`} onClick={() => setOpen(!open)}>
      <span>{k}:</span>
      <b>{v}</b>
      <i class="sysfield__help" aria-hidden="true">?</i>
      {open && <small class="sysfield__why">{help}</small>}
    </button>
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

/** An alert's meter: how far something stands, `from` where it stood to `to`, both 0 to 1. `up` fills it to the end and starts it again first, for a level gained. */
export interface AlertMeter { from: number; to: number; up?: boolean }

/** How long an alert that only reports stays once it has landed, before it goes of itself. */
export const ALERT_STAYS = 8000;

/**
 * A System alert set into a screen: news that asks for nothing where it shows, as a strip rather than
 * a window. The frame's glass, lit down its left edge in its kind's colour, the icon box, a header word
 * small (`Notification`, `Quest Info`, `Quest Rewards`), one line and a smaller one under it, what it
 * comes to at the right, and a meter along its foot that moves once it has landed. It slides in once,
 * a light crossing it as it lands. One that opens a window is a button, and says so with a chevron.
 * One that only reports (`fyi`) goes when it is tapped, or of itself `ALERT_STAYS` after it lands:
 * it slides out and the alerts under it close up.
 */
export function SysAlert({ kind = 'system', icon, label, children, sub, aside, meter, head = 'Notification', delay = 0, onTap, fyi, class: cls, attrs }: {
  kind?: FrameKind; icon: ComponentChildren; label?: string; children: ComponentChildren; sub?: ComponentChildren; aside?: ComponentChildren;
  meter?: AlertMeter; head?: Header; delay?: number; onTap?: () => void; fyi?: boolean; class?: string; attrs?: Record<string, string>;
}) {
  const unit = (x: number) => Math.max(0, Math.min(1, x));
  const el = useRef<HTMLElement>(null);
  const born = useRef(performance.now());
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const goes = !!fyi && !onTap;
  const leave = () => {
    if (leaving) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { setGone(true); return; }
    el.current?.style.setProperty('--h', `${el.current.offsetHeight}px`);
    setLeaving(true);
  };
  // Counted from when it lands, however late it became one that only reports.
  useEffect(() => {
    if (!goes) return;
    const t = setTimeout(leave, Math.max(0, delay - (performance.now() - born.current)) + ALERT_STAYS);
    return () => clearTimeout(t);
  }, [goes]);
  if (gone) return null;
  const inner = (
    <>
      <span class="sysbox sysalert__icon">{icon}</span>
      <div class="sysalert__body">
        <span class="sysalert__head">{head}</span>
        <p>{children}</p>
        {sub != null && <small class="sysalert__sub">{sub}</small>}
      </div>
      {aside != null && <span class="sysalert__aside">{aside}</span>}
      {onTap && <span class="sysbox sysalert__go" aria-hidden="true"><Glyph name="chevron" /></span>}
      {meter && <span class={`sysalert__meter ${meter.up ? 'is-up' : ''}`} aria-hidden="true"><i style={`--from: ${unit(meter.from)}; --to: ${unit(meter.to)}`} /></span>}
      <i class="sysalert__scan" aria-hidden="true" />
    </>
  );
  const klass = `sysframe sysframe--${kind} sysalert ${onTap ? 'is-tap' : ''} ${goes ? 'is-fyi' : ''} ${leaving ? 'is-leaving' : ''} ${meter ? 'has-meter' : ''} ${cls ?? ''}`;
  const end = (e: AnimationEvent) => { if (e.animationName === 'alertOut') setGone(true); };
  if (onTap) return <button type="button" ref={el as never} class={klass} aria-label={label} style={`--delay: ${delay}ms`} onClick={onTap} {...attrs}>{inner}</button>;
  if (goes) return <button type="button" ref={el as never} class={klass} aria-label={label ? `${label} Dismiss.` : undefined} title="Dismiss" style={`--delay: ${delay}ms`} onClick={leave} onAnimationEnd={end} {...attrs}>{inner}</button>;
  return <aside ref={el as never} class={klass} role="status" aria-label={label} style={`--delay: ${delay}ms`} {...attrs}>{inner}</aside>;
}
