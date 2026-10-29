/**
 * The arena. Each chamber is resolved by the engine first and written to the
 * save; this only replays the log, beat by beat, and asks what to do next.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import type { Ev } from '@/core/combat';
import { STATUS_TEXT } from '@/core/combat';
import { dungeonById, enemyById } from '@/core/gates';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import { hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { rewardChain } from '@/app/flow';
import { arena, go } from '@/app/router';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, RankPlate, Shards } from '@/ui/components';
import { buzz, flash } from '@/ui/feedback';
import { Glyph } from '@/ui/icons';
import { HoldButton, pushBack } from '@/ui/overlays';

type Beat = { kind: 'round' | 'act' | 'drain' | 'aura'; ev: Ev[] };

function toBeats(log: Ev[]): Beat[] {
  const out: Beat[] = [];
  let cur: Beat | null = null;
  const push = (b: Beat) => { out.push(b); cur = b; };
  for (const e of log) {
    if (e.t === 'round') push({ kind: 'round', ev: [e] });
    else if (e.t === 'hit' || e.t === 'miss') {
      const c = cur as Beat | null;
      const head = c?.ev[0];
      if (c && c.kind === 'act' && head && (head.t === 'hit' || head.t === 'miss') && head.a === e.a && head.ab === e.ab) c.ev.push(e);
      else push({ kind: 'act', ev: [e] });
    } else if (e.t === 'support' || e.t === 'stun') push({ kind: 'act', ev: [e] });
    else if (e.t === 'tick' || e.t === 'expire') {
      if (cur && (cur as Beat).kind === 'drain') (cur as Beat).ev.push(e);
      else push({ kind: 'drain', ev: [e] });
    } else if (e.t === 'passive' && e.k === 'aura') push({ kind: 'aura', ev: [e] });
    else if (cur) (cur as Beat).ev.push(e);
    else push({ kind: 'act', ev: [e] });
  }
  return out;
}

interface UnitView { uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[] }

function lines(b: Beat, name: (uid: string) => string): { text: string; tone: string }[] {
  const out: { text: string; tone: string }[] = [];
  const side = (uid: string) => (uid.startsWith('e') ? 'foe' : 'ally');
  const hits = b.ev.filter((e): e is Extract<Ev, { t: 'hit' }> => e.t === 'hit');
  const first = b.ev[0];
  if (first.t === 'round') return [{ text: `Round ${first.n}`, tone: 'round' }];
  if (hits.length) {
    const h = hits[0];
    const crit = hits.some((x) => x.crit);
    const targets = hits.map((x) => `${name(x.v)} ${x.dmg}${x.crit ? '!' : ''}`).join(', ');
    out.push({ text: `${crit ? '✦' : '◆'} ${name(h.a)} — ${h.ab} → ${targets}`, tone: side(h.a) });
  }
  for (const e of b.ev) {
    if (e.t === 'miss') out.push({ text: `○ ${name(e.a)} swings ${e.ab} at ${name(e.v)} and finds nothing.`, tone: 'muted' });
    else if (e.t === 'support') out.push({ text: `✦ ${name(e.a)} calls ${e.ab}. The line is rallied.`, tone: side(e.a) });
    else if (e.t === 'stun') out.push({ text: `✴ ${name(e.a)} is stunned and cannot act.`, tone: 'muted' });
    else if (e.t === 'status') out.push({ text: `✴ ${name(e.v)} is ${e.s}.`, tone: 'status' });
    else if (e.t === 'down') out.push({ text: `✖ ${name(e.v)} falls.`, tone: e.v.startsWith('e') ? 'kill' : 'loss' });
    else if (e.t === 'tick') out.push({ text: `● ${name(e.v)} loses ${e.dmg} to ${e.s}.`, tone: 'status' });
    else if (e.t === 'passive') {
      const t = e.k === 'ward' ? `◉ ${name(e.u)}’s ${e.p} takes half of it.` : e.k === 'stand' ? `◉ ${name(e.u)} will not fall — ${e.p}.` : e.k === 'brace' ? `◉ ${name(e.u)} shrugs off the stagger.` : e.k === 'aura' ? `◉ ${name(e.u)} takes command. ${e.p}.` : `◉ ${e.p} lashes out.`;
      out.push({ text: t, tone: 'passive' });
    }
  }
  return out;
}

const PACE = { 1: 650, 2: 300, skip: 0 } as const;
type Pace = keyof typeof PACE;

export function Arena() {
  const s = useSave();
  const id = arena.use();
  const d = id ? dungeonById(id) : undefined;
  const run = s.gates.raid;
  const [phase, setPhase] = useState<'fight' | 'decide' | 'results'>('fight');
  const [ch, setCh] = useState<raid.ChamberResult | null>(null);
  const [units, setUnits] = useState<UnitView[]>([]);
  const [feed, setFeed] = useState<{ text: string; tone: string; k: number }[]>([]);
  const [pace, setPace] = useState<Pace>(1);
  const [auto, setAuto] = useState(false);
  const [result, setResult] = useState<raid.RaidResult | null>(null);
  const paceRef = useRef<Pace>(1);
  paceRef.current = pace;
  const autoRef = useRef(false);
  autoRef.current = auto;
  const seq = useRef(0);

  const chambers = d && run ? raid.plan(d, run.seed) : [];

  useEffect(() => {
    if (!d) return;
    music.set('raid');
    const off = pushBack(() => true);
    if (run) void fightNext();
    return () => { off(); music.set('gates'); };
  }, []);

  if (!d) return null;

  async function fightNext() {
    const st = store.get();
    const r = st.gates.raid;
    if (!r || !d) return;
    const plan = raid.plan(d, r.seed);
    const party = raid.partyFor(st, d, r);
    const res = raid.runChamber(d, r.seed, r.at, party, plan);
    store.update((x) => raid.record(x, d, x.gates.raid!, party, res));
    if (res.boss) music.set('boss');
    setCh(res);
    setPhase('fight');
    const view: UnitView[] = res.roster.map((u) => ({ ...u }));
    setUnits(view);
    const name = (uid: string) => view.find((u) => u.uid === uid)?.name ?? '?';
    const beats = toBeats(res.log);
    setFeed([{ text: res.boss ? `${res.label} rises.` : `${res.label}.`, tone: 'room', k: ++seq.current }]);
    const local = view.map((u) => ({ ...u, status: [...u.status] }));
    const apply = (b: Beat) => {
      for (const e of b.ev) {
        const u = (x: string) => local.find((v) => v.uid === x);
        if (e.t === 'hit' || e.t === 'tick') { const t = u(e.v); if (t) t.hp = e.hp; }
        else if (e.t === 'down') { const t = u(e.v); if (t) t.hp = 0; }
        else if (e.t === 'status') { const t = u(e.v); if (t && !t.status.includes(e.s)) t.status.push(e.s); }
        else if (e.t === 'expire') { const t = u(e.v); if (t) t.status = t.status.filter((x) => x !== e.s); }
        else if (e.t === 'passive' && e.k === 'stand') { const t = u(e.u); if (t) t.hp = 1; }
        else if (e.t === 'support') for (const t of local) if (t.side === (e.a.startsWith('e') ? 'e' : 'p') && t.hp > 0 && !t.status.includes('Rallied')) t.status.push('Rallied');
      }
    };
    for (const b of beats) {
      apply(b);
      const p = paceRef.current;
      if (p !== 'skip') {
        setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
        const ls = lines(b, name);
        if (ls.length) setFeed((f) => [...ls.map((l) => ({ ...l, k: ++seq.current })).reverse(), ...f].slice(0, 7));
        if (b.ev.some((e) => e.t === 'down')) sfx.hit(-40);
        else if (b.ev.some((e) => e.t === 'hit' && e.crit)) sfx.hit(80);
        await new Promise((r) => setTimeout(r, b.kind === 'round' ? PACE[p] * 0.6 : PACE[p]));
      }
    }
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    const hero = local.find((x) => x.uid === 'hero');
    const left = local.filter((x) => x.side === 'p' && x.hp > 0).length;
    const band = !hero || hero.hp <= 0 ? 'down' : hero.hp >= hero.mx ? 'unhurt' : hero.hp / hero.mx >= 0.75 ? 'grazed' : hero.hp / hero.mx >= 0.45 ? 'wounded' : 'badly hurt';
    setFeed((f) => [
      ...(res.won
        ? [{ text: `▸ ${res.label} is clear after ${res.rounds} round${res.rounds === 1 ? '' : 's'}. ${left} standing. You are ${band}.`, tone: 'outcome', k: ++seq.current }]
        : [{ text: `▸ ${res.label} holds. The party is dragged out.`, tone: 'loss', k: ++seq.current }]),
      ...f,
    ].slice(0, 7));
    if (res.won) buzz(20);
    else { sfx.alarm(); flash('danger'); buzz([40, 60, 120]); }
    setPhase('decide');
    const last = res.index === raid.plan(d, r.seed).length - 1;
    if (res.won && !last && autoRef.current) setTimeout(() => void fightNext(), 450);
  }

  function end(outcome: raid.Outcome) {
    const res = store.update((x) => raid.finish(x, d!, x.gates.raid!, outcome));
    setResult(res);
    setPhase('results');
    music.set('gates');
    if (outcome === 'cleared') { sfx.rankUp(); flash('gold'); buzz([26, 40, 20, 40, 90]); }
  }

  async function leave() {
    arena.set(null);
    await rewardChain(null);
    go('gates');
  }

  if (phase === 'results' && result) return <Results d={d} r={result} onDone={leave} />;

  const last = ch ? ch.index === chambers.length - 1 : false;
  const party = units.filter((u) => u.side === 'p');
  const foes = units.filter((u) => u.side === 'e');
  return (
    <div class={`arena ${ch?.boss ? 'is-boss' : ''}`} role="dialog" aria-label={`${d.name}, in progress`}>
      <header class="arena__head">
        <div><span class="label">{d.name}</span><b>{ch?.label ?? '…'}</b></div>
        <span class="label num">Chamber {(ch?.index ?? 0) + 1} of {chambers.length}</span>
      </header>
      <div class="arena__field">
        <div class="arena__side">{party.map((u) => <UnitChip key={u.uid} u={u} />)}</div>
        <div class="arena__side arena__side--foes">{foes.map((u) => <UnitChip key={u.uid} u={u} />)}</div>
      </div>
      <ol class="arena__feed" aria-live="polite">
        {feed.map((l) => <li key={l.k} class={`feed feed--${l.tone}`}>{l.text}</li>)}
      </ol>
      <footer class="arena__foot">
        {phase === 'fight' && (
          <div class="seg" role="radiogroup" aria-label="Playback speed">
            {(['1', '2', 'skip'] as const).map((p) => {
              const key = (p === 'skip' ? 'skip' : Number(p)) as Pace;
              return <button type="button" role="radio" aria-checked={pace === key} key={p} class={`seg__btn ${pace === key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setPace(key); }}>{p === 'skip' ? 'Skip' : `${p}×`}</button>;
            })}
            <button type="button" role="switch" aria-checked={auto} class={`seg__btn ${auto ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setAuto(!auto); }} title="Press on automatically">Auto</button>
          </div>
        )}
        {phase === 'decide' && ch && (
          ch.won
            ? last
              ? <Btn kind="primary" size="lg" block sound="success" onClick={() => end('cleared')}>Claim The Gate</Btn>
              : <div class="row">
                <Btn kind="ghost" onClick={() => end('withdrawn')}>Withdraw</Btn>
                <Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => void fightNext()}>Press On</Btn>
              </div>
            : <Btn kind="danger" size="lg" block onClick={() => end('defeated')}>Carried Out</Btn>
        )}
      </footer>
    </div>
  );
}

function UnitChip({ u }: { u: UnitView }) {
  const pct = (u.hp / Math.max(1, u.mx)) * 100;
  return (
    <div class={`unit unit--${u.tag ?? u.side} ${u.hp <= 0 ? 'is-down' : pct < 45 ? 'is-hurt' : ''}`}>
      <div class="row between"><b class="unit__name">{u.name}</b><span class="num unit__hp">{Math.max(0, u.hp)}</span></div>
      <Bar pct={pct} tone={u.side === 'e' ? 'blood' : u.tag === 'shadow' ? 'arcane' : 'hp'} thin />
      {u.status.length > 0 && <div class="unit__status">{u.status.map((st) => <span key={st} class={`tag ${st === 'Rallied' ? 'is-good' : ''}`} title={STATUS_TEXT[st]}>{st}</span>)}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ results

function Results({ d, r, onDone }: { d: ReturnType<typeof dungeonById> & object; r: raid.RaidResult; onDone: () => void }) {
  const s = useSave();
  const [flipped, setFlipped] = useState<number[]>([]);
  const [reach, setReach] = useState<Record<number, 'bound' | 'lost' | 'no-mana'>>({});
  const v = vitals.read(s);
  const title = r.outcome === 'cleared' ? 'Dungeon Cleared' : r.outcome === 'withdrawn' ? 'Withdrawn' : 'Carried Out';
  return (
    <div class={`arena arena--results is-${r.outcome}`} role="dialog" aria-label={title}>
      <div class="arena__results stack">
        <header class="report__head">
          <span class="label">{d.name}</span>
          <h2>{title}</h2>
          <p class="muted">{r.outcome === 'cleared' ? `${d.name} cleared. The gate begins to close — new gates open in ${hhmmss(msUntilMidnight())}.`
            : r.outcome === 'withdrawn' ? `You walked back out after ${r.chambersWon} of ${r.chambers} chambers. It is still open.`
              : 'The party was carried out. The Association medics will not let you back in for a while.'}</p>
        </header>
        <div class="tiles">
          <div class="tile"><span class="label">Shards</span><b class="tile__v"><Shards n={r.shards + r.bounty} /></b>{r.bounty > 0 ? <small class="tile__sub">includes a first-clear bounty of {r.bounty}</small> : r.dungeonId === 'DNG-000' ? <small class="tile__sub">the practice gate pays in kit</small> : null}</div>
          <div class="tile"><span class="label">Health</span><b class="tile__v num">{v.hp}/{v.hpMax}</b><small class="tile__sub">{v.locked ? `locked out ${Math.ceil(v.lockedFor / 36e5)}h` : 'recovers ~5% an hour'}</small></div>
          <div class="tile"><span class="label">Fatigue</span><b class="tile__v num">{v.fatigue}</b><small class="tile__sub">of 100</small></div>
          <div class="tile"><span class="label">Recovered</span><b class="tile__v num">{r.loot.length}</b><small class="tile__sub">artifact{r.loot.length === 1 ? '' : 's'}</small></div>
        </div>
        {r.loot.length > 0 && (
          <section>
            <span class="label">Tap to reveal</span>
            <div class="haul">
              {r.loot.map((it, i) => {
                const open = flipped.includes(i);
                const def = gear.defOf(it);
                return (
                  <button type="button" key={it.id} class={`haul__item flip ${open ? 'is-open' : ''}`} data-rarity={def?.rank} onClick={() => {
                    if (open) return;
                    setFlipped([...flipped, i]);
                    sfx.window('gear');
                    buzz([14, 30, 22]);
                  }}>
                    {open ? <><GearArt item={it} size={52} /><small>{def?.name}</small></> : <span class="flip__back" aria-label="Face-down artifact">?</span>}
                  </button>
                );
              })}
            </div>
            {flipped.length === r.loot.length && gear.upgradeCount(s) > 0 && (
              <Btn kind="gold" size="sm" onClick={() => { store.update(gear.autoEquip); sfx.success(); }}>Auto Equip the upgrades</Btn>
            )}
          </section>
        )}
        {r.lingering.map((l, i) => {
          const e = enemyById(l.enemyId)!;
          const out = reach[i];
          const odds = Math.round(shadows.holdChance(s) * 100);
          return (
            <section key={l.enemyId} class={`extract ${out ? `is-${out}` : ''}`}>
              <div class="row"><RankPlate rank={e.rank} size={30} /><b>{e.shadow}</b></div>
              {!out && <>
                <p>The power from the <strong>{e.name}</strong> you just defeated is lingering… It wants to continue to fight — under your command.</p>
                <p class="muted">Reaching for it costs <b>{l.cost} MP</b> (you have {v.mp}). It holds {odds} times in 100, read off your Intelligence.</p>
                {v.mp >= l.cost
                  ? <HoldButton hold={{ label: 'Hold To Extract', ms: 3000, ticks: 8, holding: 'Extracting…', done: 'ARISE' }} onFire={() => {
                    const res = store.update((x) => raid.extract(x, l, Math.random()));
                    setReach({ ...reach, [i]: res });
                    if (res === 'bound') { sfx.rankUp(); flash('shadow'); buzz([60, 90, 30, 60, 140]); } else sfx.shadowLost();
                  }} />
                  : <p class="hint">You have nothing left to reach with. Mana comes back on its own — walk out of the next one with some.</p>}
              </>}
              {out === 'bound' && <p class="grant">SUCCESSFUL EXTRACTION — {e.shadow} answers to you now.</p>}
              {out === 'lost' && <p class="warn">The shape thinned, came apart, and went wherever the rest of them go. A higher INT makes them hold.</p>}
            </section>
          );
        })}
        <Btn kind="primary" size="lg" block onClick={onDone} sound="tap"><Glyph name="exit" /> Leave The Gate</Btn>
      </div>
    </div>
  );
}
