/**
 * A tag that tells what it is: it looks as it always did, shows a small `?` under a pointer resting on it,
 * and a tap opens the game's one tooltip (`ui/tip.tsx`), as a fight's words do (`Told` in `screens/Arena.tsx`):
 * its mark and name, what kind of thing it is, its paragraph and its breakpoints. A tap anywhere, or Escape,
 * closes it. The tooltip lives on the page, over any sheet the tag sits in.
 */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { Tip, tipAt, tipSaid, type TipAt, type TipText } from './tip';

export function InfoTag({ tip, class: cls, children }: { tip: TipText; class: string; children: ComponentChildren }) {
  const [at, setAt] = useState<TipAt | null>(null);
  if (!tip.lines.length && !tip.tiers?.length) return <span class={cls}>{children}</span>;
  return (
    <>
      <button type="button" class={`${cls} infotag`} aria-haspopup="dialog" aria-expanded={!!at} aria-label={tipSaid(tip)}
        onClick={(e) => {
          e.stopPropagation();
          sfx.blip();
          setAt(at ? null : tipAt(e.currentTarget as Element));
        }}>
        {children}
        <span class="infotag__q" aria-hidden="true">?</span>
      </button>
      {at && <Tip tip={tip} at={at} close={() => setAt(null)} />}
    </>
  );
}
