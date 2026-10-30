/** The chrome around every screen: ambient layers, the top bar and the nav. */
import { useEffect, useRef } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { classById } from '@/data/classes';
import { upgradeCount } from '@/core/gear';
import { gatesOpen, rankFor, resonance, shadowsOpen, xpToNext } from '@/core/progression';
import { licensedRank } from '@/core/licence';
import { compact } from '@/core/util';
import { useSave } from '@/store';
import { reducedMotion } from '@/ui/feedback';
import { Flame, Glyph, Shard, Sigil } from '@/ui/icons';
import { go, route, type Route } from './router';
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
  const res = resonance(s);
  const cls = classById(s.hunter.classId);
  const rank = rankFor(s.hunter.level).key;
  const shown = rank === 'N' ? 'N' : licensedRank(s);
  return (
    <header class="topbar">
      <button type="button" class="topbar__rank" aria-label="Open profile" onClick={() => { sfx.tap(); go('profile'); }}>
        <Sigil rank={shown} size={44} />
      </button>
      <div class="topbar__mid">
        <div class="topbar__name">{[s.hunter.name, cls?.name].filter(Boolean).join(' · ')}</div>
        <div class="topbar__row">
          <div class="xpbar" role="progressbar" aria-label="Experience" aria-valuenow={s.hunter.xp} aria-valuemax={need}>
            <div class="xpbar__fill" style={{ transform: `scaleX(${Math.min(1, s.hunter.xp / need)})` }} />
            <span class="xpbar__label num">LV {s.hunter.level} · {s.hunter.xp} / {need}</span>
          </div>
          <div class="topbar__streak" data-streak={res.tier.key} title={`Resonance: ${res.days} days · ×${res.mult.toFixed(2)} experience`}>
            <Flame tier={res.tier.key} />
            <span class="num">{res.days}</span>
          </div>
          <button type="button" class="topbar__purse" aria-label={`${s.wallet.shards} Mana Shards — open the Exchange`} onClick={() => { sfx.blip(); openExchange(); }}>
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
  { key: 'quests', label: 'Quests', icon: 'quests' },
  { key: 'training', label: 'Training', icon: 'training' },
  { key: 'profile', label: 'Profile', icon: 'profile' },
  { key: 'gates', label: 'Gates', icon: 'gates' },
  { key: 'shadows', label: 'Shadows', icon: 'shadows' },
];

export function NavBar() {
  const s = useSave();
  const r = route.use();
  const badge = (k: Route): string | null => {
    if (k === 'quests' && (s.flags.hollow || (s.daily.quest && !s.daily.cleared))) return '!';
    if (k === 'profile') {
      const n = s.hunter.points + (upgradeCount(s) > 0 ? 1 : 0);
      return n > 0 ? String(n) : null;
    }
    if (k === 'shadows' && s.shadows.fresh.length) return String(s.shadows.fresh.length);
    return null;
  };
  const lock = (k: Route) => (k === 'gates' && !gatesOpen(s)) || (k === 'shadows' && !shadowsOpen(s));
  const beckon = (k: Route) => (k === 'gates' && gatesOpen(s) && !s.seen.includes('gates-visited')) || (k === 'shadows' && shadowsOpen(s) && !s.seen.includes('shadows-visited'));
  return (
    <nav class="navbar" aria-label="Main">
      {TABS.map((t) => (
        <button type="button" key={t.key} data-nav={t.key}
          class={`nav__btn ${r === t.key ? 'is-active' : ''} ${lock(t.key) ? 'is-locked' : ''} ${beckon(t.key) ? 'is-beckon' : ''}`}
          aria-current={r === t.key ? 'page' : undefined}
          aria-label={lock(t.key) ? `${t.label} — locked` : t.label}
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
