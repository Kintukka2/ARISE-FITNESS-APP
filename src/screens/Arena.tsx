/**
 * The arena. The engine fights the chamber up to the hunter's turn; this
 * plays the log up to there, beat by beat, then asks for an order. Every
 * order goes to the save before it is played, so leaving mid-fight and
 * coming back lands on the same turn.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { music, sfx } from '@/audio/audio';
import type { Ev, Turn } from '@/core/combat';
import { ability, FIELD_POTION_HEAL, GUARD, REACH_TEXT, reachOf, STATUS, STATUS_TEXT } from '@/core/combat';
import * as story from '@/core/story';
import type { Order } from '@/core/types';
import { dungeonById, enemyById, isPractice } from '@/core/gates';
import * as gear from '@/core/gear';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as vitals from '@/core/vitals';
import { rewardChain } from '@/app/flow';
import { arena } from '@/app/router';
import * as store from '@/store';
import { useSave } from '@/store';
import { Bar, Btn, GearArt, RankPlate, Shards } from '@/ui/components';
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

export function Arena() {
  const s = useSave();
  const id = arena.use();
  const d = id ? dungeonById(id) : undefined;
  const run = s.gates.raid;
  const [phase, setPhase] = useState<'fight' | 'turn' | 'decide' | 'results'>('fight');
  const [room, setRoom] = useState<Room | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [units, setUnits] = useState<UnitView[]>([]);
  const [feed, setFeed] = useState<{ text: string; tone: string; k: number }[]>([]);
  const [pace, setPace] = useState<Pace>(1);
  const [auto, setAuto] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [aim, setAim] = useState<string | null>(null);
  const [result, setResult] = useState<raid.RaidResult | null>(null);
  const paceRef = useRef<Pace>(1);
  paceRef.current = pace;
  const autoRef = useRef(false);
  autoRef.current = auto;
  const aimRef = useRef<string | null>(null);
  aimRef.current = aim;
  /** Settles the turn waiting on the hunter. */
  const pick = useRef<((o: Order | null) => void) | null>(null);
  /** A chamber is being fought: a second Press On (a tap racing Auto) must not open it twice. */
  const busy = useRef(false);
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

  const say = (ls: { text: string; tone: string }[]) => {
    if (ls.length) setFeed((f) => [...ls.map((l) => ({ ...l, k: ++seq.current })).reverse(), ...f].slice(0, 7));
  };

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
    if (autoRef.current) return null;
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
          '<em>Auto</em> lets the System fight your turns for you, as it does when it assesses a gate.',
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

  async function fightNext() {
    if (busy.current) return;
    busy.current = true;
    try { await chamber(); } finally { busy.current = false; }
  }

  async function chamber() {
    const st = store.get();
    const r = st.gates.raid;
    if (!r || !d) return;
    const plan = raid.plan(d, r.seed);
    // A run closed between chambers is settled by what was already recorded: a lost chamber, or all of them won.
    if (r.won < r.at) return end('defeated');
    if (r.at >= plan.length) return end('cleared');
    const { party, ch } = raid.resume(st, d, r);
    const c = plan[r.at];
    if (c.boss) music.set('boss');
    setRoom({ label: c.label, boss: c.boss, index: r.at });
    setWon(null);
    setPhase('fight');
    const local: UnitView[] = ch.roster.map((u) => ({ ...u, status: [...u.status] }));
    setUnits(local.map((x) => ({ ...x, status: [...x.status] })));
    setFeed([{ text: c.boss ? `${c.label} rises.` : `${c.label}.`, tone: 'room', k: ++seq.current }]);
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
    setPhase('decide');
    const last = res.index === plan.length - 1;
    // After `busy` is released, so this press is the only one.
    if (res.won && !last && autoRef.current) setTimeout(() => { if (autoRef.current) void fightNext(); }, 450);
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

  const last = room ? room.index === chambers.length - 1 : false;
  const party = units.filter((u) => u.side === 'p');
  const foes = units.filter((u) => u.side === 'e');
  const hero = party.find((u) => u.uid === 'hero');
  const aiming = phase === 'turn' && turn ? turn.foes : [];
  const toggleAuto = () => {
    sfx.tap();
    const on = !auto;
    autoRef.current = on;
    setAuto(on);
    if (!on) return;
    // Switching Auto on hands the System the turn that is waiting, or the choice to press on.
    give(null);
    if (phase === 'decide' && won && !last) void fightNext();
  };
  return (
    <div class={`arena ${room?.boss ? 'is-boss' : ''}`} role="dialog" aria-label={`${d.name}, in progress`}>
      <header class="arena__head">
        <div><span class="label">{d.name}</span><b>{room?.label ?? '…'}</b></div>
        <span class="label num">Chamber {(room?.index ?? 0) + 1} of {chambers.length}</span>
      </header>
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
        {(phase === 'fight' || phase === 'turn') && (
          <div class="seg" role="radiogroup" aria-label="Playback speed">
            {(['1', '2', 'skip'] as const).map((p) => {
              const key = (p === 'skip' ? 'skip' : Number(p)) as Pace;
              return <button type="button" role="radio" aria-checked={pace === key} key={p} class={`seg__btn ${pace === key ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setPace(key); }}>{p === 'skip' ? 'Skip' : `${p}×`}</button>;
            })}
            <button type="button" role="switch" aria-checked={auto} class={`seg__btn ${auto ? 'is-on' : ''}`} onClick={toggleAuto} title="The System fights your turns and presses on">Auto</button>
          </div>
        )}
        {phase === 'decide' && room && (
          won
            ? last
              ? <Btn kind="primary" size="lg" block sound="success" onClick={() => end('cleared')}>Claim The Gate</Btn>
              : auto
                ? <Btn kind="ghost" block onClick={toggleAuto}>Pressing on… tap to stop</Btn>
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
  const title = r.outcome === 'cleared' ? 'Dungeon Cleared' : r.outcome === 'withdrawn' ? 'Withdrawn' : 'Carried Out';
  return (
    <div class={`arena arena--results is-${r.outcome}`} role="dialog" aria-label={title}>
      <div class="arena__results stack">
        <header class="report__head">
          <span class="label">{d.name}</span>
          <h2>{title}</h2>
          <p class="muted">{r.outcome === 'cleared' ? isPractice(d) ? 'Valcorde signs the practice gate off. It stays shut for whoever comes next; the real ones are waiting on the board.' : `${d.name} cleared. The gate begins to close, and another of its grade opens on the board.`
            : r.outcome === 'withdrawn' ? `You walked back out after ${r.chambersWon} of ${r.chambers} chambers. It is still open.`
              : 'The party was carried out. The Association medics will not let you back in for a while.'}</p>
        </header>
        <div class="tiles">
          <div class="tile"><span class="label">Experience</span><b class="tile__v num">+{r.xp?.gained ?? 0}</b><small class="tile__sub">{r.xp?.levels ? `Level ${r.xp.to}` : r.outcome === 'cleared' ? 'paid in full' : 'a share, for what you cleared'}</small></div>
          <div class="tile"><span class="label">Shards</span><b class="tile__v"><Shards n={r.shards + r.bounty} /></b>{r.bounty > 0 ? <small class="tile__sub">includes a first-clear bounty of {r.bounty}</small> : r.dungeonId === 'DNG-000' ? <small class="tile__sub">the practice gate pays in kit</small> : null}</div>
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
        <Btn kind="primary" size="lg" block onClick={onDone} sound="tap"><Glyph name="exit" /> Leave The Gate</Btn>
      </div>
    </div>
  );
}
