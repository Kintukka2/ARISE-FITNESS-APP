/** The chrome around every screen: ambient layers, the top bar and the nav. */
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { classById } from '@/data/classes';
import { upgradeCount } from '@/core/gear';
import { rankFor, waiting, xpToNext } from '@/core/progression';
import { waiting as questsWaiting } from '@/core/quests';
import { licensedRank } from '@/core/licence';
import { compact } from '@/core/util';
import { useSave } from '@/store';
import { reducedMotion } from '@/ui/feedback';
import { Glyph, Shard, Sigil } from '@/ui/icons';
import { go, isOpen, route, type Route } from './router';
import { openExchange } from '@/screens/Exchange';
import { openSettings } from '@/screens/Settings';

/** Drifting motes on a canvas, throttled, and off entirely under reduced motion. */
function Motes() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || reducedMotion()) return;
    const g = c.getContext('2d')!;
    let w = 0, h = 0, raf = 0, last = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr; };
    resize();
    addEventListener('resize', resize);
    const motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, v: 0.00006 + Math.random() * 0.00018, a: 0.2 + Math.random() * 0.5 }));
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 50 || document.hidden) return;
      last = t;
      g.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v * 50;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        g.beginPath();
        g.fillStyle = `rgba(120, 210, 255, ${m.a * (0.6 + 0.4 * Math.sin(t / 900 + m.x * 9))})`;
        g.arc(m.x * w, m.y * h, m.r * dpr, 0, Math.PI * 2);
        g.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} class="fx-motes" aria-hidden="true" />;
}

export function Fx() {
  return (
    <>
      <div class="fx-grid" aria-hidden="true" />
      <Motes />
      <div class="fx-vignette" aria-hidden="true" />
      <div id="fx-flash" class="fx-flash" aria-hidden="true" />
    </>
  );
}

export function TopBar() {
  const s = useSave();
  const need = xpToNext(s.hunter.level);
  const cls = classById(s.hunter.classId);
  const rank = rankFor(s.hunter.level).key;
  const shown = rank === 'N' ? 'N' : licensedRank(s);
  return (
    <header class="topbar">
      <button type="button" class="topbar__rank" aria-label="Open Status" onClick={() => { sfx.tap(); go('inventory'); }}>
        <Sigil rank={shown} size={44} />
      </button>
      <div class="topbar__mid">
        <div class="topbar__name">{[s.hunter.name, cls?.name].filter(Boolean).join(' · ')}</div>
        <div class="topbar__row">
          <div class="xpbar" role="progressbar" aria-label="Experience" aria-valuenow={s.hunter.xp} aria-valuemax={need}>
            <div class="xpbar__fill" style={{ transform: `scaleX(${Math.min(1, s.hunter.xp / need)})` }} />
            <span class="xpbar__label num">LV {s.hunter.level} · {s.hunter.xp} / {need}</span>
          </div>
          <button type="button" class="topbar__purse" aria-label={`${s.wallet.shards} Mana Shards. Open the Exchange`} onClick={() => { sfx.blip(); openExchange(); }}>
            <Shard size={15} /><span class="num">{compact(s.wallet.shards)}</span>
          </button>
          <button type="button" class="topbar__cog" aria-label="Settings" onClick={() => { sfx.blip(); openSettings(); }}>
            <Glyph name="cog" />
          </button>
        </div>
      </div>
    </header>
  );
}

const TABS: { key: Route; label: string; icon: string }[] = [
  { key: 'inventory', label: 'Inventory', icon: 'bag' },
  { key: 'gates', label: 'Gates', icon: 'gates' },
  { key: 'quests', label: 'Quests', icon: 'quest' },
  { key: 'shadows', label: 'Shadows', icon: 'shadows' },
];

export function NavBar() {
  const s = useSave();
  const r = route.use();
  const badge = (k: Route): string | null => {
    if (k === 'inventory') {
      const n = s.hunter.points + (upgradeCount(s) > 0 ? 1 : 0) + waiting(s).length;
      return n > 0 ? String(n) : null;
    }
    // The day's Daily Quests until the Quests screen has shown them, and a Trial with today's attempt unused.
    if (k === 'quests' && questsWaiting(s)) return String(questsWaiting(s));
    if (k === 'shadows' && s.shadows.fresh.length) return String(s.shadows.fresh.length);
    return null;
  };
  const lock = (k: Route) => !isOpen(s, k);
  const beckon = (k: Route) => (k === 'gates' && !s.seen.includes('gates-visited')) || (k === 'shadows' && isOpen(s, k) && !s.seen.includes('shadows-visited'));
  return (
    <nav class="navbar" aria-label="Main">
      {TABS.map((t) => (
        <button type="button" key={t.key} data-nav={t.key}
          class={`nav__btn ${r === t.key ? 'is-active' : ''} ${lock(t.key) ? 'is-locked' : ''} ${beckon(t.key) ? 'is-beckon' : ''}`}
          aria-current={r === t.key ? 'page' : undefined}
          aria-label={lock(t.key) ? `${t.label}, locked` : t.label}
          onClick={() => { sfx.tap(); go(t.key); }}>
          <Glyph name={t.icon} />
          {lock(t.key) && <Glyph name="lock" class="nav__lock" />}
          {badge(t.key) && <span class="badge">{badge(t.key)}</span>}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
