/** The building blocks every screen is made of. */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { defOf, RARITY, rollTag, score } from '@/core/gear';
import type { Item, Rank } from '@/core/types';
import { compact } from '@/core/util';
import { CoachPortrait, Glyph, Shard, Sigil, SystemMark } from './icons';

type Sound = 'tap' | 'blip' | 'success' | 'gate' | 'none';

export function Btn({ children, onClick, kind, size, block, disabled, sound = 'tap', class: cls, title, tour, type }: {
  children: ComponentChildren; onClick?: (e: MouseEvent) => void; kind?: 'primary' | 'ghost' | 'danger' | 'gold' | 'light';
  size?: 'sm' | 'lg'; block?: boolean; disabled?: boolean; sound?: Sound; class?: string; title?: string; tour?: string; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type ?? 'button'}
      class={`btn ${kind ? `btn--${kind}` : ''} ${size ? `btn--${size}` : ''} ${block ? 'btn--block' : ''} ${cls ?? ''}`}
      disabled={disabled}
      title={title}
      data-tour={tour}
      onClick={(e) => {
        if (sound !== 'none') sfx[sound]();
        onClick?.(e as MouseEvent);
      }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, disabled, tour, badge }: { icon: string; label: string; onClick: () => void; disabled?: boolean; tour?: string; badge?: string | number }) {
  return (
    <button type="button" class="iconbtn" aria-label={label} title={label} disabled={disabled} data-tour={tour}
      onClick={() => { sfx.blip(); onClick(); }}>
      <Glyph name={icon} />
      {badge ? <span class="badge">{badge}</span> : null}
    </button>
  );
}

/** A framed System panel with a title plate and optional corner tools. */
export function Panel({ title, tools, children, tone, tour, class: cls }: { title?: string; tools?: ComponentChildren; children: ComponentChildren; tone?: string; tour?: string; class?: string }) {
  return (
    <section class={`panel ${cls ?? ''}`} data-tone={tone} data-tour={tour}>
      {title && (
        <header class="panel__head">
          <h1 class="panel__title">{title}</h1>
          {tools && <div class="panel__tools">{tools}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Card({ children, class: cls, tour, hot, tone, onClick }: { children: ComponentChildren; class?: string; tour?: string; hot?: boolean; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} class={`card ${hot ? 'is-hot' : ''} ${onClick ? 'card--btn' : ''} ${cls ?? ''}`} data-tour={tour} data-tone={tone}
      onClick={onClick ? () => { sfx.tap(); onClick(); } : undefined}>
      {children}
    </Tag>
  );
}

export function Section({ title, right, children }: { title: string; right?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <div class="section">
      <div class="section__head"><span class="label">{title}</span>{right != null && <span class="section__right">{right}</span>}</div>
      {children}
    </div>
  );
}

export function Bar({ pct, tone, thin, label }: { pct: number; tone?: string; thin?: boolean; label?: string }) {
  return (
    <div class={`bar ${thin ? 'bar--thin' : ''}`} data-tone={tone} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div class="bar__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(100, pct)) / 100})` }} />
    </div>
  );
}

export function Chip({ children, tone, onClick, on }: { children: ComponentChildren; tone?: string; onClick?: () => void; on?: boolean }) {
  if (!onClick) return <span class="chip" data-tone={tone}>{children}</span>;
  return <button type="button" class={`chip chip--btn ${on ? 'is-on' : ''}`} data-tone={tone} aria-pressed={on} onClick={() => { sfx.tap(); onClick(); }}>{children}</button>;
}

export function Tile({ label, value, sub, tone }: { label: string; value: ComponentChildren; sub?: ComponentChildren; tone?: string }) {
  return (
    <div class="tile" data-tone={tone}>
      <span class="label">{label}</span>
      <b class="tile__v num">{value}</b>
      {sub != null && <small class="tile__sub">{sub}</small>}
    </div>
  );
}

export function KV({ k, v, tone }: { k: ComponentChildren; v: ComponentChildren; tone?: string }) {
  return <div class="kv" data-tone={tone}><span>{k}</span><b>{v}</b></div>;
}

export function Empty({ title, children }: { title?: string; children?: ComponentChildren }) {
  return <div class="empty">{title && <b>{title}</b>}{children && <p>{children}</p>}</div>;
}

export function Shards({ n, big }: { n: number; big?: boolean }) {
  return <span class={`shards ${big ? 'shards--big' : ''}`}><Shard size={big ? 22 : 14} /><span class="num">{compact(n)}</span></span>;
}

export function RankPlate({ rank, size = 28 }: { rank: string; size?: number }) {
  return <span class="rankplate" data-rank={rank}><Sigil rank={rank} size={size} /></span>;
}

export function Fold({ title, right, children, open: initial = false, onOpen }: { title: string; right?: ComponentChildren; children: ComponentChildren; open?: boolean; onOpen?: () => void }) {
  const [open, setOpen] = useState(initial);
  return (
    <div class={`fold ${open ? 'is-open' : ''}`}>
      <button type="button" class="fold__head" aria-expanded={open} onClick={() => { sfx.tap(); if (!open) onOpen?.(); setOpen(!open); }}>
        <span>{title}</span>
        {right != null && <span class="fold__right">{right}</span>}
        <Glyph name="chevron" class="fold__chev" />
      </button>
      {open && <div class="fold__body">{children}</div>}
    </div>
  );
}

/** Ryn Valcorde, or the System, speaking inline at the top of a screen. */
export function Voice({ who, children, tour }: { who: 'coach' | 'system'; children: ComponentChildren; tour?: string }) {
  return (
    <div class={`voice voice--${who}`} data-tour={tour}>
      <div class="voice__face">{who === 'coach' ? <CoachPortrait size={36} /> : <SystemMark size={26} />}</div>
      <div class="voice__body">
        <b class="voice__name">{who === 'coach' ? 'Ryn Valcorde' : 'Notification'}</b>
        <p class="voice__line">{children}</p>
      </div>
    </div>
  );
}

/** Re-render every second, for countdowns. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** An artifact, framed by its rarity. The frame carries the whole difference between grades. */
export function GearArt({ item, defId, size = 52, equipped }: { item?: Item; defId?: string; size?: number; equipped?: boolean }) {
  const d = item ? defOf(item) : defId ? defOf({ id: '', defId, q: 1, rolls: [] }) : undefined;
  const rank = (d?.rank ?? 'E') as Rank;
  const tag = item ? rollTag(item) : null;
  return (
    <span class="art" data-rarity={rank} style={{ width: `${size}px`, height: `${size}px` }} title={d ? `${RARITY[rank].name} ${d.slot}` : undefined}>
      <span class="art__rays" aria-hidden="true" />
      <Glyph name={d?.slot ?? 'Chest'} class="art__glyph" />
      {item && size >= 44 && <span class="art__score num">{Math.round(score(item))}</span>}
      {tag && <span class={`art__tag art__tag--${tag}`} aria-label={tag === 'perfect' ? 'Perfect roll' : 'Dead roll'}>{tag === 'perfect' ? '✦' : '✕'}</span>}
      {equipped && <span class="art__worn">Worn</span>}
    </span>
  );
}

export function HpBar({ cur, max, tone = 'hp' }: { cur: number; max: number; tone?: string }) {
  return (
    <div class="vbar" data-tone={tone}>
      <Bar pct={(cur / Math.max(1, max)) * 100} tone={tone} thin />
      <span class="num">{Math.round(cur)}<small>/{Math.round(max)}</small></span>
    </div>
  );
}

