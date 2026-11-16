/**
 * A cache or a vault, shut until the hunter opens it: the room's emblem, a button. A tap rattles it, and
 * it opens: a chest's lid lifts and light comes up out of it; a vault's dial spins and its door swings
 * wide on the light behind it. What it held is already banked (`raid.choose`); opening only shows it.
 */
import { sfx } from '@/audio/audio';
import { buzz } from './feedback';

export type CacheStage = 'shut' | 'opening' | 'open';

/** How long the rattle runs before the lid or door gives, in milliseconds. */
export const OPEN_MS = { treasure: 420, vault: 620 } as const;

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Open it: the rattle, then the opening, then `done` once what it held can show. */
export function openCache(kind: 'treasure' | 'vault', set: (s: CacheStage) => void) {
  if (reduced()) { set('open'); sfx.success(); return; }
  set('opening');
  sfx.lockCatch(1, 2);
  buzz(14);
  setTimeout(() => {
    set('open');
    if (kind === 'vault') sfx.sealed(); else { sfx.lockCatch(2, 2); sfx.success(); }
    buzz([18, 30, 40]);
  }, OPEN_MS[kind]);
}

/** A chest drawn in two parts, so its lid can lift off its body; light waits inside. */
function Chest() {
  return (
    <svg viewBox="0 0 24 24" class="cachesvg" aria-hidden="true">
      <path class="cachesvg__beam" d="M4.2 11.4L19.8 11.4L23 -6L1 -6Z" />
      <ellipse class="cachesvg__glow" cx="12" cy="11.2" rx="7.6" ry="1.5" />
      <g class="cachesvg__body">
        <path fill-rule="evenodd" d="M3.4 11.4L20.6 11.4L20.6 19.4Q20.6 20.6 19.4 20.6L4.6 20.6Q3.4 20.6 3.4 19.4ZM9.9 11.4L14.1 11.4L14.1 13.4Q14.1 14.6 12 14.6Q9.9 14.6 9.9 13.4ZM12 11.9Q11.2 11.9 11.2 12.6Q11.2 13 11.6 13.2L11.45 14L12.55 14L12.4 13.2Q12.8 13 12.8 12.6Q12.8 11.9 12 11.9Z" />
      </g>
      <g class="cachesvg__lid">
        <path fill-rule="evenodd" d="M3.4 10L3.4 8.2Q3.4 4.6 7 4.6L17 4.6Q20.6 4.6 20.6 8.2L20.6 10ZM9.9 8.6L14.1 8.6L14.1 10L9.9 10Z" />
      </g>
    </svg>
  );
}

/** A vault drawn as its frame, the light behind its door, and the door with its dial, so the door can swing. */
function Vault() {
  return (
    <svg viewBox="0 0 24 24" class="cachesvg cachesvg--vault" aria-hidden="true">
      <rect class="cachesvg__inside" x="5.2" y="5.6" width="13.6" height="11.8" rx="0.6" />
      <g class="cachesvg__frame">
        <path fill-rule="evenodd" d="M5 3.4L19 3.4Q21 3.4 21 5.4L21 17.6Q21 19.6 19 19.6L5 19.6Q3 19.6 3 17.6L3 5.4Q3 3.4 5 3.4ZM5.2 5.6L5.2 17.4L18.8 17.4L18.8 5.6Z" />
        <path d="M5 19L8.4 19L8.4 21.6L5 21.6ZM15.6 19L19 19L19 21.6L15.6 21.6Z" />
      </g>
      <g class="cachesvg__door">
        <path fill-rule="evenodd" d="M5.6 6L18.4 6L18.4 17L5.6 17ZM17.2 14.4L17.2 8.6L16.2 8.6L16.2 14.4Z" />
        {/* The dial, cut dark into the door: its ring and its hub, with the mark on the ring left light, so it can be seen to spin. */}
        <g class="cachesvg__dial">
          <path fill-rule="evenodd" d="M6.4 11.5A4.4 4.4 0 1 0 15.2 11.5A4.4 4.4 0 1 0 6.4 11.5ZM8.2 11.5A2.6 2.6 0 1 1 13.4 11.5A2.6 2.6 0 1 1 8.2 11.5ZM9.8 11.5A1 1 0 1 0 11.8 11.5A1 1 0 1 0 9.8 11.5ZM10.4 7.3L11.2 7.3L11.2 8.9L10.4 8.9Z" />
        </g>
      </g>
    </svg>
  );
}

/** The emblem of a cache or a vault: shut, a button that opens it; open, what it was. */
export function CacheEmblem({ kind, stage, onOpen }: { kind: 'treasure' | 'vault'; stage: CacheStage; onOpen: () => void }) {
  const name = kind === 'vault' ? 'vault' : 'cache';
  const art = kind === 'vault' ? <Vault /> : <Chest />;
  if (stage === 'shut') {
    return (
      <button type="button" class="nodepanel__emblem cacheemblem is-shut" aria-label={`Open the ${name}`} onClick={onOpen}>{art}</button>
    );
  }
  return <span class={`nodepanel__emblem cacheemblem is-${stage}`} aria-hidden="true">{art}</span>;
}
