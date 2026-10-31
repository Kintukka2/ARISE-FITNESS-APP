/**
 * The arena: the gate's map, and the fights on it. The hunter picks each step;
 * a fight is fought up to the hunter's turn by the engine, played back beat by
 * beat, then waits for an order. Every step, choice and order goes to the save
 * before it plays, so leaving at any point and coming back lands in the same place.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import type { Ev, Turn } from '@/core/combat';
import { ability, FIELD_POTION_HEAL, GUARD, REACH_TEXT, reachOf, STATUS, STATUS_TEXT } from '@/core/combat';
import * as story from '@/core/story';
import type { Order } from '@/core/types';
import { dungeonById, enemyById, isPractice } from '@/core/gates';
import { chamberOf, isFight, systemPick, type MapNode } from '@/core/map';
import { blessingById, NODE, REST_HEAL } from '@/data/nodes';
import { BLOCK } from '@/data/spire';
import * as ascension from '@/core/ascension';
import { isTrial } from '@/core/trial';
import * as contracts from '@/core/contracts';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as vitals from '@/core/vitals';
import { rewardChain } from '@/app/flow';
import { arena } from '@/app/router';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, HpBar, RankPlate, Shards } from '@/ui/components';
import { ContractsWindow } from '@/ui/contracts';
import { MapView } from '@/ui/map';
import { buzz, flash } from '@/ui/feedback';
import { Glyph } from '@/ui/icons';
import { HoldButton, pushBack, sys } from '@/ui/overlays';

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
    } else if (e.t === 'support' || e.t === 'stun' || e.t === 'guard' || e.t === 'heal') push({ kind: 'act', ev: [e] });
    else if (e.t === 'tick' || e.t === 'expire') {
      if (cur && (cur as Beat).kind === 'drain') (cur as Beat).ev.push(e);
      else push({ kind: 'drain', ev: [e] });
    } else if (e.t === 'passive' && e.k === 'aura') push({ kind: 'aura', ev: [e] });
    else if (cur) (cur as Beat).ev.push(e);
    else push({ kind: 'act', ev: [e] });
  }
  return out;
}

interface UnitView { uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[]; intent?: { ab: string; at?: string } }

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
    else if (e.t === 'guard') out.push({ text: `◈ ${name(e.a)} raises a guard.`, tone: side(e.a) });
    else if (e.t === 'heal') out.push({ text: `✚ ${name(e.a)} drinks a field potion. +${e.amt} HP.`, tone: side(e.a) });
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

/** Move the arena's picture of everyone forward by one beat's events. */
function apply(local: UnitView[], b: Beat) {
  const u = (x: string) => local.find((v) => v.uid === x);
  for (const e of b.ev) {
    if (e.t === 'hit' || e.t === 'tick') { const t = u(e.v); if (t) t.hp = e.hp; }
    else if (e.t === 'heal') { const t = u(e.a); if (t) t.hp = e.hp; }
    else if (e.t === 'down') { const t = u(e.v); if (t) t.hp = 0; }
    else if (e.t === 'status') { const t = u(e.v); if (t && !t.status.includes(e.s)) t.status.push(e.s); }
    else if (e.t === 'guard') { const t = u(e.a); if (t && !t.status.includes('Guarded')) t.status.push('Guarded'); }
    else if (e.t === 'intent') { const t = u(e.u); if (t) t.intent = { ab: e.ab, at: e.at }; }
    else if (e.t === 'expire') { const t = u(e.v); if (t) t.status = t.status.filter((x) => x !== e.s); }
    else if (e.t === 'passive' && e.k === 'stand') { const t = u(e.u); if (t) t.hp = 1; }
    else if (e.t === 'support') for (const t of local) if (t.side === (e.a.startsWith('e') ? 'e' : 'p') && t.hp > 0 && !t.status.includes('Rallied')) t.status.push('Rallied');
  }
}

interface Room { label: string; boss: boolean; index: number }

type Phase = 'map' | 'fight' | 'turn' | 'decide' | 'node' | 'results';

/** A step being shown: a rest or a cache as it happened, or a choice waiting, then how it went. */
interface Panel { node: MapNode; item?: string; done?: raid.Resolution }

export function Arena() {
  const s = useSave();
  const id = arena.use();
  const d = id ? dungeonById(id) : undefined;
  const run = s.gates.raid;
  const [phase, setPhase] = useState<Phase>('map');
  const [room, setRoom] = useState<Room | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [units, setUnits] = useState<UnitView[]>([]);
  const [feed, setFeed] = useState<{ text: string; tone: string; k: number }[]>([]);
  const [pace, setPace] = useState<Pace>(1);
  const [auto, setAuto] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [aim, setAim] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [result, setResult] = useState<raid.RaidResult | null>(null);
  const paceRef = useRef<Pace>(1);
  paceRef.current = pace;
  const autoRef = useRef(false);
  autoRef.current = auto;
  /** From The System Watches up, Auto stands aside in a boss's chamber: every order there is the hunter's. */
  const handRef = useRef(false);
  const aimRef = useRef<string | null>(null);
  aimRef.current = aim;
  /** Settles the turn waiting on the hunter. */
  const pick = useRef<((o: Order | null) => void) | null>(null);
  /** One thing at a time: a tap racing Auto must never take a step or open a chamber twice. */
  const busy = useRef(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!d) return;
    music.set('raid');
    const off = pushBack(() => true);
    if (run) void guarded(dispatch);
    return () => { off(); music.set('gates'); };
  }, []);

  if (!d) return null;
  const m = run ? raid.mapOf(d, run) : null;

  const say = (ls: { text: string; tone: string }[]) => {
    if (ls.length) setFeed((f) => [...ls.map((l) => ({ ...l, k: ++seq.current })).reverse(), ...f].slice(0, 7));
  };

  async function guarded(fn: () => Promise<void> | void) {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } finally { busy.current = false; }
  }

  /** Do whatever the run is waiting on. Only ever called inside `guarded`. */
  async function dispatch() {
    const r = store.get().gates.raid;
    if (!r || !d) return;
    // A run closed after a lost chamber, or after the boss fell, is settled by what was recorded.
    if (r.lost) return end('defeated');
    if (r.at >= raid.mapOf(d, r).layers.length) return end('cleared');
    const x = raid.pending(d, r);
    if (x && isFight(x)) return chamber();
    if (x) return open({ node: x });
    toMap();
  }

  function toMap() {
    setPanel(null);
    setPhase('map');
    music.set('raid');
    if (autoRef.current) later(() => {
      const r = store.get().gates.raid;
      const opts = r ? raid.options(d!, r) : [];
      if (opts.length) void step(systemPick(opts).id);
    });
  }

  /** Run `fn` shortly, if Auto is still on by then. */
  function later(fn: () => void) {
    setTimeout(() => { if (autoRef.current) fn(); }, 500);
  }

  /** Take a step on the map. */
  function step(nodeId: string) {
    return guarded(async () => {
      const res = store.update((x) => raid.choose(x, d!, x.gates.raid!, nodeId));
      if (!res) return;
      if (isFight(res.node)) return chamber();
      open({ node: res.node, item: res.item });
    });
  }

  function open(p: Panel) {
    setPanel(p);
    setPhase('node');
    if (!autoRef.current) return;
    if (!p.done && raid.pending(d!, store.get().gates.raid!)) later(() => void choice(raid.systemChoice(p.node)));
    else later(() => void guarded(dispatch));
  }

  /** Make the choice a shrine, a trap or an event is waiting on. */
  function choice(i: number) {
    return guarded(() => {
      const out = store.update((x) => raid.resolve(x, d!, x.gates.raid!, i));
      if (!out) return;
      if (out.effect.hurt) { sfx.hit(-40); flash('danger'); } else if (out.won) sfx.success();
      open({ node: out.node, item: out.item, done: out });
    });
  }

  /** Play the log from `from` to its end, at the chosen pace. Returns where it got to. */
  async function show(log: Ev[], from: number, local: UnitView[]) {
    const name = (uid: string) => local.find((u) => u.uid === uid)?.name ?? '?';
    for (const b of toBeats(log.slice(from))) {
      apply(local, b);
      const p = paceRef.current;
      if (p === 'skip') continue;
      setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
      const ls = lines(b, name);
      // A beat with nothing to say (a foe settling its next move) costs no time.
      if (!ls.length) continue;
      say(ls);
      if (b.ev.some((e) => e.t === 'down')) sfx.hit(-40);
      else if (b.ev.some((e) => e.t === 'hit' && e.crit)) sfx.hit(80);
      await new Promise((r) => setTimeout(r, b.kind === 'round' ? PACE[p] * 0.6 : PACE[p]));
    }
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    return log.length;
  }

  /** Wait for the hunter to give an order, or for Auto to take the turn. */
  async function ask(t: Turn, local: UnitView[]): Promise<Order | null> {
    if (autoRef.current && !handRef.current) return null;
    const live = local.filter((u) => t.foes.includes(u.uid));
    if (!aimRef.current || !t.foes.includes(aimRef.current)) setAim(live.reduce((a, b) => (b.hp < a.hp ? b : a), live[0])?.uid ?? null);
    setTurn(t);
    setPhase('turn');
    if (store.update((x) => story.markOnce(x, 'turn-told'))) {
      await sys({
        title: 'Your Turn', kind: 'system',
        lines: [
          'The System waits on you. Tap a foe to aim at it, then act.',
          'Every foe shows what it will do next, and at whom. What it shows is what it does, unless its target falls first.',
          `A skill or a Strike goes at the foe you aimed at first. A <em>Guard</em> takes ${GUARD * 100}% of every hit until your next turn. A <em>field potion</em> restores ${FIELD_POTION_HEAL * 100}% of your health.`,
          '<em>Auto</em> lets the System fight your turns and pick your way, as it does when it assesses a gate.',
        ],
      });
    }
    return new Promise((res) => { pick.current = res; });
  }

  function give(o: Order | null) {
    const f = pick.current;
    if (!f) return;
    pick.current = null;
    setTurn(null);
    setPhase('fight');
    sfx.tap();
    f(o);
  }

  /** Fight the chamber underway. Only ever called inside `guarded`. */
  async function chamber() {
    const st = store.get();
    const r = st.gates.raid;
    if (!r || !d) return;
    const { party, ch, node } = raid.resume(st, d, r);
    const c = chamberOf(d, node);
    if (c.boss) music.set('boss');
    setRoom({ label: c.label, boss: c.boss, index: node.layer });
    handRef.current = c.boss && ascension.bossByHand(ascension.levelOf(r));
    setWon(null);
    setPhase('fight');
    const local: UnitView[] = ch.roster.map((u) => ({ ...u, status: [...u.status] }));
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    setFeed([{ text: c.boss ? `${c.label} rises.` : `${c.label}.`, tone: 'room', k: ++seq.current }]);
    if (handRef.current) say([{ text: '▸ The System will not fight this one for you. Every order is yours.', tone: 'muted' }]);
    // Coming back mid-chamber: everything the saved orders already played is shown at once.
    let at = 0;
    if ((r.orders ?? []).length) {
      for (const b of toBeats(ch.log)) apply(local, b);
      at = ch.log.length;
      setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
      say([{ text: '▸ Back where you were.', tone: 'muted' }]);
    }
    at = await show(ch.log, at, local);
    while (ch.turn) {
      const o = await ask(ch.turn, local);
      // The order is in the save before it plays: leaving now cannot undo it.
      const given = store.update((x) => raid.order(x, x.gates.raid!, o));
      ch.play(given);
      at = await show(ch.log, at, local);
    }
    const res = ch.result();
    store.update((x) => raid.record(x, d, x.gates.raid!, party, res));
    const hero = local.find((x) => x.uid === 'hero');
    const left = local.filter((x) => x.side === 'p' && x.hp > 0).length;
    const band = !hero || hero.hp <= 0 ? 'down' : hero.hp >= hero.mx ? 'unhurt' : hero.hp / hero.mx >= 0.75 ? 'grazed' : hero.hp / hero.mx >= 0.45 ? 'wounded' : 'badly hurt';
    say(res.won
      ? [{ text: `▸ ${res.label} is clear after ${res.rounds} round${res.rounds === 1 ? '' : 's'}. ${left} standing. You are ${band}.`, tone: 'outcome' }]
      : [{ text: `▸ ${res.label} holds. The party is dragged out.`, tone: 'loss' }]);
    if (res.won) buzz(20);
    else { sfx.alarm(); flash('danger'); buzz([40, 60, 120]); }
    setWon(res.won);
    // A lost chamber, or the boss down: that is the run's to end. Anything else, back to the map.
    if (!res.won || res.boss) return setPhase('decide');
    await new Promise((r2) => setTimeout(r2, paceRef.current === 'skip' ? 0 : 900));
    toMap();
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
    await rewardChain(result?.xp ?? null, 'gates');
  }

  if (phase === 'results' && result) return <Results d={d} r={result} onDone={leave} />;

  const party = units.filter((u) => u.side === 'p');
  const foes = units.filter((u) => u.side === 'e');
  const hero = party.find((u) => u.uid === 'hero');
  const aiming = phase === 'turn' && turn ? turn.foes : [];
  const depth = m?.layers.length ?? 0;
  const toggleAuto = () => {
    sfx.tap();
    const on = !auto;
    autoRef.current = on;
    setAuto(on);
    if (!on) return;
    // Switching Auto on hands the System whatever is waiting: a turn, the next step, or a choice.
    give(null);
    if (phase === 'map') toMap();
    if (phase === 'node' && panel) open(panel);
  };
  const onMap = phase === 'map' || phase === 'node';
  // The step underway, or about to be taken; a rest or cache already done still counts as where you stand.
  const here = !run ? 1 : Math.min(depth, raid.pending(d, run) || phase !== 'node' ? run.at + 1 : run.at);
  const head = phase === 'node' && panel ? NODE[panel.node.kind].name : onMap ? 'Choose your way' : room?.label ?? '…';
  return (
    <div class={`arena ${room?.boss && !onMap ? 'is-boss' : ''}`} role="dialog" aria-label={`${d.name}, in progress`}>
      <header class="arena__head">
        <div><span class="label">{d.name}{run && ascension.levelOf(run) ? ` · Ascension ${ascension.levelOf(run)}` : ''}</span><b>{head}</b></div>
        <span class="label num">{d.floor ? `Floor ${d.floor + here - 1} of ${d.floor + depth - 1}` : `Step ${here} of ${depth}`}</span>
      </header>
      {onMap && run && m ? (
        <div class="arena__map">
          <RunStrip s={s} d={d} />
          {phase === 'node' && panel
            ? <NodePanel d={d} p={panel} onChoose={(i) => void choice(i)} onGo={() => void guarded(dispatch)} onWithdraw={() => end('withdrawn')} />
            : <>
              {feed[0] && <p class={`feed feed--${feed[0].tone}`}>{feed[0].text}</p>}
              <MapView m={m} path={run.path} at={run.at} options={raid.options(d, run).map((x) => x.id)} onPick={(nid) => void step(nid)} />
              {raid.canWithdraw(d, run)
                ? <Btn kind="ghost" block onClick={() => end('withdrawn')}>Withdraw From The Rest</Btn>
                : <small class="muted center">Tap a step that glows. Only a rest lets you leave the gate.</small>}
            </>}
        </div>
      ) : (
        <>
          <div class="arena__field">
            <div class="arena__side">
              {party.map((u) => <UnitChip key={u.uid} u={u} acting={phase === 'turn' && u.uid === 'hero'} incoming={foes.filter((f) => f.hp > 0 && f.intent?.at === u.uid).length} />)}
            </div>
            <div class="arena__side arena__side--foes">
              {foes.map((u) => <UnitChip key={u.uid} u={u} aimed={phase === 'turn' && aim === u.uid} onPick={aiming.includes(u.uid) ? () => { sfx.tap(); setAim(u.uid); } : undefined}
                intent={u.hp > 0 ? u.intent : undefined} party={party} />)}
            </div>
          </div>
          <ol class="arena__feed" aria-live="polite">
            {feed.map((l) => <li key={l.k} class={`feed feed--${l.tone}`}>{l.text}</li>)}
          </ol>
        </>
      )}
      <footer class="arena__foot">
        {phase === 'turn' && turn && (
          <div class="turnbar" data-tour="turn">
            <small class="turnbar__hint">Your turn. Aiming at <b>{foes.find((f) => f.uid === aim)?.name ?? '—'}</b>; tap a foe to change.</small>
            <div class="turnbar__acts">
              {turn.skills.map((k) => (
                <button type="button" key={k.ability.name} class="act" disabled={k.cd > 0} onClick={() => give({ use: k.ability.name, at: aim ?? undefined })}>
                  <b>{k.ability.name}</b><small>{k.cd > 0 ? `ready in ${k.cd}` : REACH_TEXT[k.ability.profile] ?? 'one target'}</small>
                </button>
              ))}
              <button type="button" class="act" onClick={() => give({ use: 'Strike', at: aim ?? undefined })}><b>Strike</b><small>{REACH_TEXT.single}</small></button>
              <button type="button" class="act act--guard" onClick={() => give({ use: 'Guard' })}><b>Guard</b><small>take {GUARD * 100}% till your turn</small></button>
              <button type="button" class="act act--potion" disabled={!turn.potions || !hero || hero.hp >= hero.mx} onClick={() => give({ use: 'Potion' })}>
                <b>Potion · {turn.potions}</b><small>+{FIELD_POTION_HEAL * 100}% HP</small>
              </button>
            </div>
          </div>
        )}
        {phase !== 'decide' && (
          <div class="seg" role="radiogroup" aria-label="Playback speed">
            {(['1', '2', 'skip'] as const).map((p) => {
              const key = (p === 'skip' ? 'skip' : Number(p)) as Pace;
              return <button type="button" role="radio" aria-checked={pace === key} key={p} class={`seg__btn ${pace === key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setPace(key); }}>{p === 'skip' ? 'Skip' : `${p}×`}</button>;
            })}
            <button type="button" role="switch" aria-checked={auto} class={`seg__btn ${auto ? 'is-on' : ''}`} onClick={toggleAuto} title="The System fights your turns and picks your way">Auto</button>
          </div>
        )}
        {phase === 'decide' && room && (
          won
            ? <Btn kind="primary" size="lg" block sound="success" onClick={() => end('cleared')}>Claim The Gate</Btn>
            : <Btn kind="danger" size="lg" block onClick={() => end('defeated')}>Carried Out</Btn>
        )}
      </footer>
    </div>
  );
}

/** What the run is carrying: the hunter's health, the allies still up, what it has banked, its blessings. */
function RunStrip({ s, d }: { s: ReturnType<typeof useSave>; d: NonNullable<ReturnType<typeof dungeonById>> }) {
  const run = s.gates.raid;
  if (!run) return null;
  const party = raid.partyFor(s, d, run);
  const hero = party[0];
  const up = party.slice(1).filter((u) => u.alive()).length;
  return (
    <div class="runstrip">
      <div class="runstrip__hp"><span class="label">You</span><HpBar cur={Math.round(Math.max(0, hero.hp))} max={hero.maxHp} tone="hp" /></div>
      <div class="runstrip__row">
        <small>{up} of {party.length - 1} beside you standing</small>
        <small><Shards n={run.purse ?? 0} /> · {(run.haul ?? []).length} found</small>
      </div>
      {(run.blessings ?? []).length > 0 && (
        <div class="chips">{run.blessings.map((b) => <span key={b} class="chip" data-tone="gold" title={blessingById(b)?.text}>{blessingById(b)?.name}</span>)}</div>
      )}
    </div>
  );
}

/** A step that is not a fight: what happened, or the choice it puts to you. */
function NodePanel({ d, p, onChoose, onGo, onWithdraw }: {
  d: NonNullable<ReturnType<typeof dungeonById>>; p: Panel; onChoose: (i: number) => void; onGo: () => void; onWithdraw: () => void;
}) {
  const s = useSave();
  const run = s.gates.raid;
  const x = p.node;
  const kind = NODE[x.kind];
  const ev = raid.eventAt(x);
  const hero = run?.party[0];
  const waiting = !p.done && run && raid.pending(d, run)?.id === x.id;
  const item = p.item ? gear.gearDef(p.item) : null;
  return (
    <section class={`nodepanel nodepanel--${x.kind}`}>
      <header class="row"><Glyph name={kind.glyph} /><b>{ev?.title ?? kind.name}</b></header>
      {x.kind === 'rest' && <p>The party catches its breath: everyone standing gets {REST_HEAL * 100}% of their health back, and what ails them lifts.</p>}
      {x.kind === 'treasure' && <p>{item ? <>Under the dust: <strong>{item.name}</strong>. It is banked, and comes out with you, unless you are carried out.</> : 'Someone got here first. Nothing left.'}</p>}
      {x.kind === 'shrine' && waiting && <p>Two offerings, and room on the altar for one. The blessing lasts until you leave the gate.</p>}
      {ev && !p.done && <p>{ev.text}</p>}
      {p.done && <p class={p.done.won ? 'grant' : 'warn'}>{p.done.effect.text}{p.done.item ? ` ${gear.gearDef(p.done.item)?.name} is banked.` : ''}{p.done.blessing && x.kind !== 'shrine' ? ` ${blessingById(p.done.blessing)?.name}: ${blessingById(p.done.blessing)?.text}.` : ''}</p>}
      {waiting && x.kind === 'shrine' && (
        <div class="stack stack--tight">
          {(x.offer ?? []).map((b, i) => (
            <button type="button" key={b} class="choice-row" onClick={() => onChoose(i)}>
              <b>{blessingById(b)?.name}</b><small>{blessingById(b)?.text}</small>
            </button>
          ))}
        </div>
      )}
      {waiting && ev && hero && (
        <div class="stack stack--tight">
          {ev.choices.map((c, i) => {
            const odds = raid.oddsOf(c, hero, ascension.levelOf(run));
            return (
              <button type="button" key={c.label} class="choice-row" onClick={() => onChoose(i)}>
                <b>{c.label}</b><small>{odds < 1 ? `${Math.round(odds * 100)}% it goes well${c.check ? `, read off your ${c.check.stat}` : ''}` : 'Certain'}</small>
              </button>
            );
          })}
        </div>
      )}
      {!waiting && (
        x.kind === 'rest' && run && raid.canWithdraw(d, run)
          ? <div class="row">
            <Btn kind="ghost" onClick={onWithdraw}>Withdraw</Btn>
            <Btn kind="primary" size="lg" class="grow" sound="gate" onClick={onGo}>Press On</Btn>
          </div>
          : <Btn kind="primary" size="lg" block sound="tap" onClick={onGo}>Continue</Btn>
      )}
    </section>
  );
}

/** A foe's next move, as its chip shows it: the ability, who it goes at, and how many more it reaches. */
function Intent({ intent, party }: { intent: { ab: string; at?: string }; party: UnitView[] }) {
  const a = ability(intent.ab);
  const live = party.filter((p) => p.hp > 0).length;
  const at = intent.at ? party.find((p) => p.uid === intent.at) : undefined;
  const more = a ? Math.min(reachOf(a.profile), live) - 1 : 0;
  const who = a?.profile === 'support' ? 'rallies its side' : a?.profile === 'all' ? 'everyone' : `${at ? (at.tag === 'hero' ? 'you' : at.name) : '?'}${more > 0 ? ` +${more}` : ''}`;
  const tip = a ? `${a.type === 'magic' ? 'Magic' : 'Physical'} · ×${a.mult} · ${REACH_TEXT[a.profile] ?? 'one target'}${a.inflicts.length ? ` · ${a.inflicts.join(', ')}` : ''}` : intent.ab;
  return <div class={`unit__intent ${at?.tag === 'hero' ? 'is-you' : ''}`} title={tip}>⟶ {intent.ab} · {who}</div>;
}

function UnitChip({ u, acting, aimed, onPick, intent, party, incoming }: {
  u: UnitView; acting?: boolean; aimed?: boolean; onPick?: () => void;
  intent?: { ab: string; at?: string }; party?: UnitView[]; incoming?: number;
}) {
  const pct = (u.hp / Math.max(1, u.mx)) * 100;
  const cls = `unit unit--${u.tag ?? u.side} ${u.hp <= 0 ? 'is-down' : pct < 45 ? 'is-hurt' : ''} ${acting ? 'is-acting' : ''} ${aimed ? 'is-aimed' : ''} ${onPick ? 'is-pickable' : ''}`;
  const inner = (
    <>
      <div class="row between"><b class="unit__name">{u.name}</b><span class="num unit__hp">{incoming && u.hp > 0 ? <span class="unit__incoming" title={`${incoming} foe${incoming === 1 ? ' is' : 's are'} coming for ${u.tag === 'hero' ? 'you' : u.name} next`}>◀{incoming}</span> : null}{Math.max(0, u.hp)}</span></div>
      <Bar pct={pct} tone={u.side === 'e' ? 'blood' : u.tag === 'shadow' ? 'arcane' : 'hp'} thin />
      {u.status.length > 0 && <div class="unit__status">{u.status.map((st) => <span key={st} class={`tag ${STATUS[st]?.good ? 'is-good' : ''}`} title={STATUS_TEXT[st]}>{st}</span>)}</div>}
      {intent && party && <Intent intent={intent} party={party} />}
    </>
  );
  return onPick
    ? <button type="button" class={cls} aria-pressed={!!aimed} aria-label={`Aim at ${u.name}, ${Math.max(0, u.hp)} HP`} onClick={onPick}>{inner}</button>
    : <div class={cls}>{inner}</div>;
}

// ------------------------------------------------------------------ results

function Results({ d, r, onDone }: { d: ReturnType<typeof dungeonById> & object; r: raid.RaidResult; onDone: () => void }) {
  const s = useSave();
  const [flipped, setFlipped] = useState<number[]>([]);
  const [reach, setReach] = useState<Record<number, 'bound' | 'lost' | 'no-mana'>>({});
  const v = vitals.read(s);
  const trial = isTrial(d);
  const title = r.outcome === 'cleared' ? r.spire ? `Floor ${r.spire.floor} Taken` : trial ? 'Trial Won' : 'Dungeon Cleared' : r.outcome === 'withdrawn' ? 'Withdrawn' : 'Carried Out';
  const deal = r.contracts;
  const xpSub = [r.xp?.levels ? `Level ${r.xp.to}` : r.outcome === 'cleared' ? 'paid in full' : 'a share, for what you cleared', deal.xp ? `${deal.xp} for contracts` : ''].filter(Boolean).join(' · ');
  const shardSub = [r.bounty > 0 ? `a first-clear bounty of ${r.bounty}` : r.banked > 0 ? `${r.banked} banked on the way` : '', deal.shards ? `${deal.shards} for contracts` : ''].filter(Boolean);
  return (
    <div class={`arena arena--results is-${r.outcome}`} role="dialog" aria-label={title}>
      <div class="arena__results stack">
        <header class="report__head">
          <span class="label">{d.name}</span>
          <h2>{title}</h2>
          <p class="muted">{r.outcome === 'cleared' ? isPractice(d) ? 'Valcorde signs the practice gate off. It stays shut for whoever comes next; the real ones are waiting on the board.'
            : r.spire ? r.spire.best ? `The boss on Floor ${r.spire.floor} is down, and that is your best this week. The next ${BLOCK} floors open above you.` : `The boss on Floor ${r.spire.floor} is down. The week turned while you were inside, so it does not count toward this one.`
              : trial ? `The last of the Chosen is down. ${r.depth} of them, one after another, and you are still standing.`
              : `${d.name} cleared. The gate begins to close, and another of its grade opens on the board.`
            : r.outcome === 'withdrawn' ? d.floor ? `You walked back down from the rest on Floor ${d.floor + r.steps - 1}. These floors stand as they are until Monday.` : `You walked back out from the rest, ${r.steps} of ${r.depth} steps in. It is still open.`
              : trial ? 'The party was carried out before the last of the Chosen fell. The Trial opens again tomorrow, and the gates you proved stay proved.'
              : 'The party was carried out. The Association medics will not let you back in for a while.'}</p>
        </header>
        <div class="tiles">
          <div class="tile"><span class="label">Experience</span><b class="tile__v num">+{r.xp?.gained ?? 0}</b><small class="tile__sub">{xpSub}</small></div>
          <div class="tile"><span class="label">Shards</span><b class="tile__v"><Shards n={r.shards + r.bounty + deal.shards} /></b>{shardSub.length ? <small class="tile__sub">includes {shardSub.join(' and ')}</small> : r.dungeonId === 'DNG-000' ? <small class="tile__sub">the practice gate pays in kit</small> : null}</div>
          <div class="tile"><span class="label">Health</span><b class="tile__v num">{v.hp}/{v.hpMax}</b><small class="tile__sub">{v.locked ? `locked out ${Math.ceil(v.lockedFor / 36e5)}h` : 'recovers ~5% an hour'}</small></div>
          <div class="tile"><span class="label">Fatigue</span><b class="tile__v num">{v.fatigue}</b><small class="tile__sub">of 100</small></div>
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
        {r.ascended !== null && (
          <section class="extract is-bound ascended">
            <p class="grant">ASCENSION {r.ascended} OPENED — {ascension.levelInfo(r.ascended).name.toUpperCase()}</p>
            <p class="muted">{ascension.levelInfo(r.ascended).rule} Choose it on the Gates screen when you want it; until then, nothing changes.</p>
          </section>
        )}
        {r.promoted.map((p) => {
          const sh = s.shadows.army.find((x) => x.id === p.id);
          const e = sh && enemyById(sh.enemyId);
          if (!sh || !e) return null;
          const second = shadows.rankIndex(sh) === shadows.SECOND_AT ? shadows.secondOf(e) : null;
          return (
            <section key={p.id} class="extract is-bound promoted">
              <div class="row"><RankPlate rank={e.rank} size={30} /><b>{e.shadow}</b></div>
              <p class="grant">PROMOTED — {p.rank.toUpperCase()}</p>
              <p class="muted">{sh.kills} kills under your command. Its growth can reach +{Math.round(shadows.rankOf(sh).cap * 100)}% now{second ? `, and it remembers ${second}` : ''}.</p>
            </section>
          );
        })}
        {!isPractice(d) && contracts.contractsOpen(s) && s.contracts.list.length > 0 && (
          <ContractsWindow c={s.contracts} fresh={deal.done.map((k) => k.kind)}>
            {deal.done.length > 0 && <p class="grant">{deal.done.length === 1 ? 'Contract complete' : `${deal.done.length} contracts complete`}{deal.bonus ? ', and the day’s bonus with it' : ''}: <Shards n={deal.shards} /> and {deal.xp} XP.</p>}
          </ContractsWindow>
        )}
        <Btn kind="primary" size="lg" block onClick={onDone} sound="tap"><Glyph name="exit" /> Leave The Gate</Btn>
      </div>
    </div>
  );
}
