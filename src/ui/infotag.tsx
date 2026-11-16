/**
 * A tag that tells what it is: it looks as it always did, shows a small `?` under a pointer resting on it,
 * and a tap opens what it means in a tooltip, as a fight's tags do (`Told` in `screens/Arena.tsx`). A tap
 * anywhere, or Escape, closes it. The tooltip lives on the page, over any sheet the tag sits in.
 */
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';

type At = { x: number; y: number; below: number };

export function InfoTag({ title, lines, class: cls, children }: { title: string; lines: string[]; class: string; children: ComponentChildren }) {
  const [at, setAt] = useState<At | null>(null);
  useEffect(() => {
    if (!at) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setAt(null); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [at]);
  if (!lines.length) return <span class={cls}>{children}</span>;
  return (
    <>
      <button type="button" class={`${cls} infotag`} aria-haspopup="dialog" aria-expanded={!!at} aria-label={`${title}. ${lines.join(' ')}`}
        onClick={(e) => {
          e.stopPropagation();
          sfx.blip();
          const r = (e.currentTarget as Element).getBoundingClientRect();
          setAt(at ? null : { x: r.left + r.width / 2, y: r.top, below: r.bottom });
        }}>
        {children}
        <span class="infotag__q" aria-hidden="true">?</span>
      </button>
      {at && createPortal(<InfoTip title={title} lines={lines} at={at} close={() => setAt(null)} />, document.body)}
    </>
  );
}

function InfoTip({ title, lines, at, close }: { title: string; lines: string[]; at: At; close: () => void }) {
  const w = Math.min(260, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, at.x - w / 2));
  // Under the tag, unless that runs off the foot of the screen.
  const up = at.below > window.innerHeight - 140;
  return (
    <div class="tipshade infotip-shade" onPointerDown={(e) => { e.preventDefault(); close(); }}>
      <div class="tip infotip" role="tooltip" style={`left:${left}px;width:${w}px;${up ? `bottom:${window.innerHeight - at.y + 6}px` : `top:${at.below + 6}px`}`}>
        <b class="tip__title">{title}</b>
        {lines.map((l) => <p key={l}>{l}</p>)}
      </div>
    </div>
  );
}
