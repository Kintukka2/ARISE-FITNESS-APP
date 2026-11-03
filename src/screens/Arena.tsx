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
import { OVERCHARGE } from '@/data/ascension';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as vitals from '@/core/vitals';
import { rewardChain } from '@/app/flow';
import { arena } from '@/app/router';
import * as store from '@/store';
import * as system from '@/ui/system';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, HpBar, RankPlate, Shards } from '@/ui/components';
import { QuestLines } from '@/ui/contracts';
import { AssocStrip } from '@/ui/assoc';
import * as association from '@/core/association';
import { SysAlert, SysFrame } from '@/ui/frame';
import { FamilyGlyph, ShadowEmblem } from '@/ui/emblems';
import { MapView } from '@/ui/map';
import { buzz, flash } from '@/ui/feedback';
import { Glyph, Shard } from '@/ui/icons';
import { drinkFlow, openItem } from './Inventory';
import { LootCell, useReveal } from '@/ui/loot';
import { lines, toBeats, type Beat } from '@/ui/log';
import { HoldButton, openSheet, pushBack, sys } from '@/ui/overlays';
import { NameField } from './Shadows';

interface UnitView { uid: string; name: string; side: 'p' | 'e'; tag?: string; mx: number; hp: number; status: string[]; intent?: { ab: string; at?: string } }

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
    else if (e.t === 'passive' && e.hp !== undefined) { const t = u(e.u); if (t) t.hp = e.hp; }
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
  /** From By Hand up, Auto stands aside in a boss's chamber: every order there is the hunter's. */
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
        title: 'Your Turn', kind: 'app', actions: [{ label: 'Close', value: null }],
        lines: [
          'Tap a foe to aim at it, then act.',
          'Each foe shows its next move and its target.',
          `A skill or a Strike goes at the foe you aimed at first. A <em>Guard</em> takes ${GUARD * 100}% of every hit until your next turn. A <em>field potion</em> restores ${FIELD_POTION_HEAL * 100}% of your health.`,
          '<em>Auto</em> lets the System fight your turns and pick your way, as it does when it assesses a Gate.',
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
    setFeed([{ text: c.boss ? `[${c.label}] has appeared.` : `${c.label}.`, tone: 'room', k: ++seq.current }]);
    if (handRef.current) say([{ text: '▸ Auto is not available in this chamber.', tone: 'muted' }]);
    // Coming back mid-chamber: everything the saved orders already played is shown at once.
    let at = 0;
    if ((r.orders ?? []).length) {
      for (const b of toBeats(ch.log)) apply(local, b);
      at = ch.log.length;
      setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
      say([{ text: '▸ Chamber resumed.', tone: 'muted' }]);
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
    const band = !hero || hero.hp <= 0 ? 'Down' : hero.hp >= hero.mx ? 'Unhurt' : hero.hp / hero.mx >= 0.75 ? 'Grazed' : hero.hp / hero.mx >= 0.45 ? 'Wounded' : 'Badly hurt';
    say(res.won
      ? [{ text: `▸ [${res.label}] cleared. Rounds: ${res.rounds}. Standing: ${left}. Condition: ${band}.`, tone: 'outcome' }]
      : [{ text: `▸ [${res.label}] not cleared. The party has been carried out.`, tone: 'loss' }]);
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
                : <small class="muted center">Tap a step that glows.</small>}
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
            <small class="turnbar__hint">Your turn. Aiming at <b>{foes.find((f) => f.uid === aim)?.name ?? 'nothing'}</b>; tap a foe to change.</small>
            <div class="turnbar__acts">
              {turn.skills.map((k) => (
                <button type="button" key={k.ability.name} class="act" disabled={k.cd > 0} onClick={() => give({ use: k.ability.name, at: aim ?? undefined })}>
                  <b>{k.ability.name}</b><small>{k.cd > 0 ? `ready in ${k.cd}` : REACH_TEXT[k.ability.profile] ?? 'one target'}</small>
                </button>
              ))}
              <button type="button" class="act" onClick={() => give({ use: 'Strike', at: aim ?? undefined })}><b>Strike</b><small>{REACH_TEXT.single}</small></button>
              <button type="button" class="act act--guard" onClick={() => give({ use: 'Guard' })}><b>Guard</b><small>Damage taken -{(1 - GUARD) * 100}%</small></button>
              <button type="button" class="act act--potion" disabled={!turn.potions || !hero || hero.hp >= hero.mx} onClick={() => give({ use: 'Potion' })}>
                <b>Potion · {turn.potions}</b><small>HP +{FIELD_POTION_HEAL * 100}%</small>
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
        <small>Allies standing: {up}/{party.length - 1}</small>
        <small><Shards n={run.purse ?? 0} /> · {(run.haul ?? []).length} found</small>
      </div>
      {(run.blessings ?? []).length > 0 && (
        <div class="chips">{run.blessings.map((b) => <span key={b} class="chip" data-tone="gold" title={blessingById(b)?.text}>{blessingById(b)?.name}</span>)}</div>
      )}
    </div>
  );
}

/** A cache's find, face down until tapped, turned over by its grade as the results turn over what a run found. */
function CacheFind({ defId }: { defId: string }) {
  const [loot] = useState(() => [{ defId }]);
  const turn = useReveal(loot);
  const name = gear.gearDef(defId)?.name;
  return (
    <>
      {turn.flash}
      <p>Something lies under the dust. You take it.</p>
      <div class={`loot loot--cache ${turn.quake ? 'is-quake' : ''}`}>
        <div class="haul"><LootCell loot={loot[0]} i={0} state={turn.stateOf(0)} onTap={() => turn.reveal(0)} /></div>
      </div>
      {turn.stateOf(0) === 'open' && <p class="muted" dangerouslySetInnerHTML={{ __html: system.outcome({ text: '' }, { item: name }).join('<br />') }} />}
    </>
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
      {x.kind === 'rest' && <><p>The party catches its breath.</p><p class="muted"><span class="grant">Party HP +{REST_HEAL * 100}%</span> · Debuffs cleared</p></>}
      {x.kind === 'treasure' && (item ? <CacheFind key={x.id} defId={p.item!} /> : <p>The cache is empty.</p>)}
      {x.kind === 'shrine' && waiting && <p>Two offerings, and room on the altar for one.</p>}
      {ev && !p.done && <p>{ev.text}</p>}
      {p.done && <p>{x.kind === 'shrine' ? 'You take the offering.' : p.done.effect.text}</p>}
      {p.done && (() => {
        const b = p.done.blessing ? blessingById(p.done.blessing) : undefined;
        const lines = system.outcome(p.done.effect, {
          shards: p.done.effect.shards && !isPractice(d) ? shop.gateShards(d.rank, p.done.effect.shards) : undefined,
          item: p.done.item ? gear.gearDef(p.done.item)?.name : undefined,
          blessing: b ? { name: b.name, text: b.text } : undefined,
        });
        return lines.length ? <p class="muted" dangerouslySetInnerHTML={{ __html: lines.join('<br />') }} /> : null;
      })()}
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
                <b>{c.label}</b><small>{odds < 1 ? `Success rate: ${Math.round(odds * 100)}%${c.check ? ` (${c.check.stat})` : ''}` : 'Certain'}</small>
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

const MANA = shop.POTIONS.find((p) => p.id === 'mp')!;

/**
 * The extraction of one lingering Shadow, on the System's sheet: what it was, the cost and the odds,
 * and the hold. The roll is made the moment the hold completes, so the button finishes on it: ARISE,
 * or Failed. Bound, the System offers a name.
 */
function Extraction({ l, close, onResult }: { l: raid.Lingering; close: () => void; onResult: (res: 'bound' | 'lost', id?: string) => void }) {
  const s = useSave();
  const v = vitals.read(s);
  const e = enemyById(l.enemyId)!;
  const rolled = useRef<{ res: 'bound' | 'lost' | 'no-mana'; id?: string } | null>(null);
  const [out, setOut] = useState<{ res: 'bound' | 'lost'; id?: string } | null>(null);
  const odds = Math.round(shadows.holdChance(s) * 100);
  return (
    <div class={`stack extract ${out ? `is-${out.res}` : ''}`}>
      <div class="extract__who"><FamilyGlyph family={e.family} size={30} /><RankPlate rank={e.rank} size={30} /><b>{e.shadow}</b></div>
      {!out && <>
        <p>The mana of <strong>[{e.name}]</strong> lingers.</p>
        <p class="muted">Extraction cost: <b>{l.cost} MP</b> ({v.mp} MP held)<br />Success rate: <b>{odds}%</b></p>
        {v.mp >= l.cost || rolled.current
          // It stays up while it settles, though the extraction has spent the MP it showed.
          ? <HoldButton hold={{ label: 'Hold To Extract', ms: 3000, ticks: 8, holding: 'Extracting…', done: 'ARISE', failed: 'Failed', after: 900 }}
            decide={() => {
              const res = store.update((x) => raid.extract(x, l, Math.random()));
              const id = res === 'bound' ? store.get().shadows.army[store.get().shadows.army.length - 1]?.id : undefined;
              rolled.current = { res, id };
              return res === 'bound';
            }}
            onFire={() => {
              const got = rolled.current;
              if (!got || got.res === 'no-mana') return;
              setOut({ res: got.res, id: got.id });
              onResult(got.res, got.id);
              if (got.res === 'bound') { sfx.rankUp(); flash('shadow'); buzz([60, 90, 30, 60, 140]); }
            }} />
          : <>
            <p class="warn">Not enough MP. ({v.mp}/{l.cost})</p>
            {/* Short of mana with the Shadow still lingering: a Mana Potion, held or bought, drunk here, without leaving. */}
            <Btn size="sm" block onClick={() => void drinkFlow('mp')}>
              <Glyph name="potion" /> {shop.held(s, 'mp') ? <>Drink {MANA.name} · Held: {shop.held(s, 'mp')}</> : <>Buy {MANA.name} · <Shard size={12} /> <span class="num">{MANA.price}</span></>}
            </Btn>
          </>}
      </>}
      {out?.res === 'bound' && out.id && <>
        <p class="grant">Extraction successful.</p>
        <p><strong>[{e.shadow}]</strong> has joined your army.</p>
        <p>You may bestow a name.</p>
        <NameField id={out.id} close={() => close()} />
      </>}
      {out?.res === 'lost' && <>
        <p class="warn">[Skill: Extraction] has failed.<br />The mana has dispersed.</p>
        <Btn block onClick={close}>Close</Btn>
      </>}
    </div>
  );
}

function Results({ d, r, onDone }: { d: ReturnType<typeof dungeonById> & object; r: raid.RaidResult; onDone: () => void }) {
  const s = useSave();
  // Everything the run found, to turn over by its grade (ui/loot.tsx).
  const [found] = useState(() => r.loot.map((item) => ({ item })));
  const turn = useReveal(found);
  const [reach, setReach] = useState<Record<number, 'bound' | 'lost' | 'no-mana'>>({});
  // The Shadow each extraction bound, by the lingering it came from.
  const [joined, setJoined] = useState<Record<number, string>>({});
  /** The extraction of a lingering Shadow, opened from its alert: the System's sheet, with the hold. */
  const openExtraction = (i: number) => openSheet({
    title: 'Notification', system: { kind: 'shadow' },
    render: (close) => <Extraction l={r.lingering[i]} close={close} onResult={(res, id) => {
      setReach((x) => ({ ...x, [i]: res }));
      if (id) setJoined((x) => ({ ...x, [i]: id }));
    }} />,
  });
  // Auto Equip's place is kept from the start when an upgrade is waiting, so nothing jumps when it appears.
  const [upgradeWaits] = useState(() => gear.upgradeCount(store.get()) > 0);
  const [equipped, setEquipped] = useState(false);
  const { faceDown, revealAll } = turn;
  // A promotion waiting lands as its alert slides in: a chime, and a touch in the hand.
  useEffect(() => {
    if (!r.ready.length) return;
    const t = setTimeout(() => { sfx.ping(); buzz([12, 40, 18]); }, 520);
    return () => clearTimeout(t);
  }, []);
  // The loot is already in the Inventory; leaving with some face down only gets a reminder to look.
  const leave = async () => {
    if (faceDown > 0) {
      const v = await sys({
        title: 'Unrevealed Loot', kind: 'app', typed: false,
        lines: [`${faceDown === 1 ? '1 item is' : `${faceDown} items are`} still face down. ${faceDown === 1 ? 'It is' : 'They are'} already in your Inventory.`],
        actions: [{ label: 'Leave Anyway', value: 'leave' }, { label: 'Reveal All', value: 'reveal', primary: true }],
      });
      if (v !== 'leave') { revealAll(); return; }
    }
    // A Shadow still lingering disperses when the hunter walks out: a reminder, once.
    const waiting = r.lingering.findIndex((_, i) => !reach[i]);
    if (waiting >= 0) {
      const v = await sys({
        title: 'A Shadow Lingers', kind: 'app', typed: false,
        lines: ['Its mana disperses when you leave the Gate.'],
        actions: [{ label: 'Leave Anyway', value: 'leave' }, { label: 'Extract', value: 'extract', primary: true }],
      });
      if (v !== 'leave') { openExtraction(waiting); return; }
    }
    onDone();
  };
  const v = vitals.read(s);
  const trial = isTrial(d);
  const title = r.outcome === 'cleared' ? r.spire ? `Floor ${r.spire.floor} Taken` : trial ? 'Trial Won' : 'Gate Cleared' : r.outcome === 'withdrawn' ? 'Withdrawn' : 'Carried Out';
  const deal = r.contracts;
  // What the Daily Quests paid is shown once, on their own lines below, so the tiles do not repeat it.
  const xpSub = r.xp?.levels ? `Level ${r.xp.to}` : r.outcome === 'cleared' ? 'paid in full' : 'a share, for what you cleared';
  const shardSub = [r.bounty > 0 ? `First-clear bounty +${r.bounty}` : r.banked > 0 ? `Banked +${r.banked}` : ''].filter(Boolean);
  return (
    <div class={`arena arena--results is-${r.outcome}`} role="dialog" aria-label={title}>
      {turn.flash}
      <div class={`arena__results stack ${turn.quake ? 'is-quake' : ''}`}>
        <header class="report__head">
          <span class="label">{d.name}</span>
          <h2>{title}</h2>
          <p class="muted">{r.outcome === 'cleared' ? isPractice(d) ? 'The Practice Gate is closed.'
            : r.spire ? r.spire.best ? `Floor ${r.spire.floor} cleared: your best this week. The next ${BLOCK} floors are open.` : `Floor ${r.spire.floor} cleared. The week closed while you were inside, so it does not count this week.`
              : trial ? `The last of the Chosen is down: ${r.depth} in a row.`
              : `${d.name} is closed. A new ${d.rank}-Rank Gate has opened on the board.`
            : r.outcome === 'withdrawn' ? d.floor ? `Withdrawn from the rest on Floor ${d.floor + r.steps - 1}. These floors stay as they are until Monday.` : `Withdrawn at step ${r.steps} of ${r.depth}. The Gate is still open.`
              : trial ? 'You were carried out. The Trial opens again tomorrow. Proven Gates stay proven.'
              : `The party was carried out. You are locked out of Gates for ${vitals.WIPE_LOCK / 36e5} hours.`}</p>
        </header>
        <div class="tiles">
          <div class="tile"><span class="label">Experience</span><b class="tile__v num">+{r.xp?.gained ?? 0}</b><small class="tile__sub">{xpSub}</small></div>
          <div class="tile"><span class="label">Shards</span><b class="tile__v"><Shards n={r.shards + r.bounty + deal.shards} /></b>{shardSub.length ? <small class="tile__sub">{shardSub.join(' · ')}</small> : r.dungeonId === 'DNG-000' ? <small class="tile__sub">the Practice Gate pays in kit</small> : null}</div>
          <div class="tile"><span class="label">Health</span><b class="tile__v num">{v.hp}/{v.hpMax}</b><small class="tile__sub">{v.locked ? `Locked out: ${Math.ceil(v.lockedFor / 36e5)}h` : `HP +${Math.round(vitals.PCT_PER_HOUR * 100)}% each hour`}</small></div>
          <div class="tile"><span class="label">Fatigue</span><b class="tile__v num">{v.fatigue}</b><small class="tile__sub">of {vitals.FATIGUE_MAX}</small></div>
        </div>
        {r.loot.length > 0 && (
          <section class="loot">
            <span class="label">{faceDown ? 'Tap to reveal' : 'Tap an item for its card'}</span>
            <div class="haul">
              {found.map((l, i) => (
                <LootCell key={l.item.id} loot={l} i={i} state={turn.stateOf(i)} onTap={() => turn.reveal(i)} onOpen={() => { sfx.tap(); openItem(l.item.id); }} />
              ))}
            </div>
            {upgradeWaits && (
              // Dimmed until everything is turned over: one more reason to turn it.
              <div class={`loot__act ${faceDown ? '' : 'is-ready'}`}>
                {equipped
                  ? <span class="grant">Upgrades equipped</span>
                  : <Btn kind="gold" size="sm" disabled={faceDown > 0} onClick={() => { store.update(gear.autoEquip); setEquipped(true); sfx.success(); }}>Auto Equip Upgrades</Btn>}
              </div>
            )}
          </section>
        )}
        {/* A lingering Shadow is an alert; tapped, it opens the extraction, where the hold is. */}
        {r.lingering.length > 0 && (
          <div class="alerts">
            {r.lingering.map((l, i) => {
              const e = enemyById(l.enemyId)!;
              const out = reach[i];
              const sh = joined[i] ? s.shadows.army.find((x) => x.id === joined[i]) : undefined;
              return (
                <SysAlert key={`${l.enemyId}-${i}`} kind="shadow" delay={400 + i * 200} class={out ? `is-${out}` : ''}
                  label={out ? undefined : `The mana of ${e.name} lingers. Open the extraction.`}
                  icon={sh ? <ShadowEmblem family={e.family} rank={0} size={36} /> : <FamilyGlyph family={e.family} size={30} />}
                  onTap={out ? undefined : () => openExtraction(i)}
                  aside={out === 'bound' ? <span class="grant">ARISE</span> : out === 'lost' ? <span class="warn">Failed</span> : null}>
                  {out === 'bound' ? <><strong>[{sh ? shadows.nameOf(sh) : e.shadow}]</strong> has joined your army.</>
                    : out === 'lost' ? <>The mana of <strong>[{e.name}]</strong> has dispersed.</>
                    : <>The mana of <strong>[{e.name}]</strong> lingers.</>}
                </SysAlert>
              );
            })}
          </div>
        )}
        {r.chosen && (
          <SysFrame title="Notification" kind="gates" class="extract is-bound">
            <p>You have defeated<br /><span class="warn">[{r.chosen.name}]</span>.</p>
            {r.chosen.item ? <div class="row"><GearArt item={r.chosen.item} size={52} /><p class="grow">You have acquired <strong>[Item: {gear.defOf(r.chosen.item)?.name}]</strong>.<br /><span class="muted">Quality: Perfect +{r.chosen.level}</span></p></div>
              : <p>Mana Shards <span class="grant">+{r.chosen.shards}</span></p>}
            <p class="muted">[{r.chosen.name}] will return to the Gates.</p>
          </SysFrame>
        )}
        {r.ascended !== null && (
          <SysFrame title="Notification" kind="gold" class="extract is-bound">
            <p class="grant">ACCESS GRANTED: ASCENSION {r.ascended}</p>
            <p><strong>[Ascension {r.ascended}: {ascension.levelInfo(r.ascended).name}]</strong></p>
            <p class="muted">Upgrade limit: Perfect <span class="grant">+{r.ascended * OVERCHARGE.per}</span><br />Marks <span class="grant">+1</span></p>
          </SysFrame>
        )}
        {r.ready.length > 0 && (
          <div class="alerts">
            {r.ready.map((p, i) => {
              const sh = s.shadows.army.find((x) => x.id === p.id);
              const e = sh && enemyById(sh.enemyId);
              if (!sh || !e) return null;
              return (
                <SysAlert key={p.id} kind="shadow" delay={500 + i * 220} label={`${shadows.nameOf(sh)}: promotion ready`}
                  icon={<ShadowEmblem family={e.family} rank={shadows.rankIndex(sh)} size={36} />}>
                  <strong>[{shadows.nameOf(sh)}]</strong> has met the requirements for <strong>[Promotion: {p.rank} Rank]</strong>.
                </SysAlert>
              );
            })}
            <p class="hint">{r.ready.length === 1 ? 'Promote it' : 'Promote them'} on the Shadows screen.</p>
          </div>
        )}
        {!isPractice(d) && deal.moved.length > 0 && <QuestLines c={s.contracts} report={deal} />}
        {r.assoc && association.current(s) && <AssocStrip q={association.current(s)!} move={r.assoc} />}
        <Btn kind="primary" size="lg" block onClick={() => void leave()} sound="tap"><Glyph name="exit" /> Leave The Gate</Btn>
      </div>
    </div>
  );
}
