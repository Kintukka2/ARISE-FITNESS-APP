/** The Gates: the board, the brief, and the way in. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf, TACTICS } from '@/core/combat';
import { board, bossKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import { overCap, RARITY } from '@/core/gear';
import { GATE_XP, PRACTICE_LEVEL, practiceAward, rankFor } from '@/core/progression';
import { build, mapSeed } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as spire from '@/core/spire';
import * as ascension from '@/core/ascension';
import { isTrial } from '@/core/trial';
import { ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, WALKERS, type Mark } from '@/data/ascension';
import * as walkers from '@/core/walkers';
import * as marks from '@/core/marks';
import { SPIRE_NAME } from '@/data/spire';
import { GATES_LINE, GATES_TOUR } from '@/data/narrative';
import * as system from '@/ui/system';
import { MapView } from '@/ui/map';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as story from '@/core/story';
import type { Dungeon, Rank, Save } from '@/core/types';
import { RANKS } from '@/core/types';
import { dayKey, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { arena } from '@/app/router';
import { buyLicence, priceOf, storeReady } from '@/platform/native';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Card, Chip, RankPlate, Section, Shards, Tile, useNow, Voice } from '@/ui/components';
import { BentoGrid, type Tile as BTile } from '@/ui/bento';
import { Field } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { closeAllSheets, confirm, openSheet, sys, toast, tour } from '@/ui/overlays';
import { drinkFlow, MiniBar, openDossier, openStatus } from './Inventory';
import { openExchange } from './Exchange';

function coachLine(s = store.get()) {
  const v = vitals.read(s);
  if (v.locked) return GATES_LINE.locked;
  if (v.fatigue > 50) return GATES_LINE.tired;
  if (!s.gates.clears) return GATES_LINE.first;
  return GATES_LINE.settled;
}

export function Gates() {
  const s = useSave();
  useNow();
  const day = dayKey();

  useEffect(() => {
    if (!story.seen(s, 'gates-visited')) {
      store.update((x) => story.markOnce(x, 'gates-visited'));
      setTimeout(() => void intro(), 500);
    }
  }, []);
  // The board marks the Gates today's Daily Quests name, so showing it issues them, if nothing has yet.
  useEffect(() => {
    if (contracts.contractsOpen(store.get()) && store.get().contracts.day !== day) store.update((x) => { contracts.issue(x, day); });
  }, [day, contracts.contractsOpen(s)]);

  return (
    <div class="stack">
      <Voice>{coachLine(s)}</Voice>
      <BentoGrid class="gatesgrid" tiles={topTiles(s)} label="Gates" />
    </div>
  );
}

/** GATES: every Gate standing open today, filtered by grade, a tile to each. */
function openBoard() {
  openSheet({ title: 'Gates', system: { icon: null, kind: 'gates' }, render: () => <BoardSheet /> });
}

function BoardSheet() {
  const s = useSave();
  useNow();
  const [band, setBand] = useState<'all' | Rank>('all');
  const day = dayKey();
  const gates = board(s, day);
  const named = contracts.named(s, day);
  const shown = gates.filter((d) => band === 'all' || d.rank === band);
  return (
    <div class="stack">
      <div class="bands" role="tablist" aria-label="Filter Gates by grade">
        <button type="button" role="tab" aria-selected={band === 'all'} class={`band ${band === 'all' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setBand('all'); }}>All</button>
        {RANKS.map((r) => {
          const any = gates.some((d) => d.rank === r);
          return <button type="button" role="tab" key={r} aria-selected={band === r} data-rank={r} class={`band ${band === r ? 'is-on' : ''} ${any ? '' : 'is-empty'}`} onClick={() => { sfx.tap(); if (any) setBand(r); else toast(`No ${r}-Rank Gate opened today.`, 'warn'); }}>{r}</button>;
        })}
      </div>
      <div class="boardhead">
        <span class="label">{band === 'all' ? 'Open Gates' : `${band}-Rank Gates`}</span>
        <span class="label">Redraw <b class="num countdown">{hhmmss(msUntilMidnight())}</b></span>
        <span class="label">Closed today: {s.gates.sealed.day === day ? s.gates.sealed.ids.length : 0}</span>
      </div>
      <BentoGrid class="board" tiles={shown.map((d) => gateTile(s, d, named.has(d.id), day))} label="Open Gates" />
    </div>
  );
}

/** The board as one tile: a portal to each grade, the count of its Gates open, dimmed where the licence stops. */
function boardTile(s: Save, gates: Dungeon[]): BTile {
  return {
    key: 'board', kind: 'gates', name: 'Open Gates', head: true, wide: true, tour: 'bands', icon: <Glyph name="gates" />,
    count: gates.length,
    status: <>Redraw: <b class="num">{hhmmss(msUntilMidnight())}</b></>,
    art: (
      <span class="ga-board">
        {RANKS.map((r) => {
          const here = gates.filter((d) => d.rank === r);
          const open = here.some((d) => entryBlock(s, d) !== 'licence');
          return (
            <span key={r} class={`ga-board__one ${here.length ? '' : 'is-none'} ${open ? '' : 'is-shut'}`} style={`--rc: var(--rank-${r})`}>
              <span class="ga-portal ga-portal--mini"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><b>{r}</b></span>
              <small class="num">{here.length}</small>
            </span>
          );
        })}
      </span>
    ),
    open: openBoard,
  };
}

/** What stands above the board: the run left open, the hunter's grade and condition, their record, the Spire and Ascension. */
function topTiles(s: Save): BTile[] {
  const out: BTile[] = [];
  const day = dayKey();
  const gates = board(s, day);
  // The practice Gate stands on the screen, first, until it is cleared: Valcorde's tour points at it.
  const practice = gates.find(isPractice);
  if (practice) out.push({ ...gateTile(s, practice, false, day), tour: 'board' });
  const run = s.gates.raid;
  const open = run && dungeonById(run.dungeonId);
  if (open && run) {
    const steps = raid.mapOf(open, run).layers.length;
    out.push({
      key: 'run', kind: 'gates', name: open.name, wide: true, hot: true, icon: <Glyph name="gates" />,
      count: `${run.at}/${steps}`, status: 'Go Back In',
      art: <span class="ga-steps">{Array.from({ length: steps }, (_, i) => <i key={i} class={i < run.at ? 'is-on' : i === run.at ? 'is-here' : ''} />)}</span>,
      // A run left open is one tap from where it stopped; its brief, from the board, holds Abandon.
      open: () => { sfx.gate(); arena.set(open.id); },
    });
  }
  out.push(boardTile(s, gates));
  const mine = licensedRank(s);
  const holding = licenceHolding(s);
  out.push({
    key: 'grade', kind: 'gates', name: 'Grade', head: true, tour: 'licence', icon: <Glyph name="cert" />, hot: holding && licenceRequired(s) && storeReady(),
    count: `${mine}-Rank`,
    status: holding ? `Held at ${mine}-Rank.` : `Gates up to ${RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank.`,
    art: <span class="ga-emblem"><i class="ga-emblem__ring" /><i class="ga-emblem__ring" /><Sigil rank={mine} size={50} /></span>,
    open: openGrade,
  });
  const v = vitals.read(s);
  out.push({
    key: 'condition', kind: 'system', name: 'Condition', head: true, tour: 'vitals', icon: <Glyph name="bolt" />, hot: v.locked,
    count: `FTG ${Math.round(v.fatigue)}`,
    status: v.locked ? `Carried out. Fit in ${Math.ceil(v.lockedFor / 36e5)}h.` : `Strength: ${Math.round(v.drag * 100)}%`,
    art: (
      <span class="ia-bars ia-bars--stack">
        <MiniBar label="HP" cur={v.hp} max={v.hpMax} tone="hp" />
        <MiniBar label="MP" cur={v.mp} max={v.mpMax} tone="mp" />
        <MiniBar label="FTG" cur={v.fatigue} max={vitals.FATIGUE_MAX} tone="ftg" />
      </span>
    ),
    open: openStatus,
  });
  const entered = s.gates.clears + s.gates.fails + s.gates.withdrawn;
  out.push({
    key: 'record', kind: 'gates', name: 'Record', head: true, icon: <Glyph name="chart" />,
    status: `Best run unbroken: ${s.gates.bestUnbroken}`,
    art: (
      <span class="ga-record">
        <span class="sysbox"><small>Entered</small><b class="num">{entered}</b></span>
        <span class="sysbox"><small>Cleared</small><b class="num">{s.gates.clears}</b></span>
        <span class="sysbox"><small>Gates taken</small><b class="num">{s.gates.cleared.filter((id) => id !== 'DNG-000').length}</b></span>
      </span>
    ),
    open: openDossier,
  });
  if (spire.spireOpen(s)) {
    const d = spire.nextSpire(s);
    const b = spire.blockOf(d.floor ?? 1);
    const best = spire.weekBest(s);
    const goal = spire.tierGoal(s);
    const lit = Math.min(6, Math.floor((7 * best) / goal));
    const locked = entryBlock(s, d) === 'licence';
    out.push({
      key: 'spire', kind: 'gates', name: SPIRE_NAME, icon: <Glyph name="spire" />, shut: locked,
      count: `${best}/${goal}`,
      status: `Floors ${spire.firstFloor(b)} to ${spire.lastFloor(b)} next.`,
      art: <span class="qa-tower">{Array.from({ length: 7 }, (_, i) => <i key={i} class={i < lit ? 'is-lit' : i === lit ? 'is-next' : ''} style={{ width: `${72 - i * 7}px` }} />)}</span>,
      open: () => {
        if (locked) toast(`Floors ${spire.firstFloor(b)} to ${spire.lastFloor(b)} are ${d.rank}-Rank. Your licence does not cover ${d.rank}-Rank yet.`, 'warn');
        else openBrief(d);
      },
    });
  }
  const a = s.ascension;
  if (a.unlocked) {
    out.push({
      key: 'ascension', kind: 'gold', name: `Ascension ${a.level}`, icon: <Glyph name="crown" />, hot: marks.unset(s) > 0,
      count: `${a.level}/${a.unlocked}`,
      status: a.level ? ascension.levelInfo(a.level).name : 'The board as it stands.',
      art: (
        <span class="ga-ascend">
          <b class="num">{a.level}</b>
          <span class="ga-ascend__rules">{Array.from({ length: ASCENSION_RULED }, (_, i) => <i key={i} class={i < Math.min(a.level, ASCENSION_RULED) ? 'is-on' : i < a.unlocked ? 'is-open' : ''} />)}</span>
        </span>
      ),
      open: openAscension,
    });
  }
  return out;
}

/** A Gate on the board: its grade's portal, its name, and what stands at its end. */
function gateTile(s: Save, d: Dungeon, quest: boolean, day: string): BTile {
  const held = walkers.walking(s, day)?.gateId === d.id;
  const locked = entryBlock(s, d) === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  const practice = isPractice(d);
  const tag = practice ? 'Training' : held ? 'Chosen' : quest ? 'Quest' : undefined;
  return {
    key: `gate-${d.id}`, kind: 'gates', name: d.name, wide: practice, hot: practice, shut: locked,
    class: `is-gate ${practice ? 'is-practice' : ''} ${s.gates.cleared.includes(d.id) ? 'is-cleared' : ''} ${d.id === 'DNG-HOLLOW' ? 'is-monarch' : ''} ${tag ? `is-${tag.toLowerCase()}` : ''}`,
    icon: <Glyph name={locked ? 'lock' : known ? 'skull' : 'unknown'} />,
    count: tag,
    status: locked ? `Licence: ${d.rank}-Rank` : known ? <>Boss: <span class="warn">{boss?.name}</span></> : 'Boss: ?',
    art: (
      <span class="ga-portal" style={`--rc: var(--rank-${d.rank})`}>
        <i class="ga-portal__swirl" /><i class="ga-portal__core" />
        <RankPlate rank={d.rank} size={40} />
      </span>
    ),
    open: () => { if (locked) toast(`Your licence does not cover ${d.rank}-Rank yet.`, 'warn'); else openBrief(d); },
  };
}

/** The hunter's grade with the Association: what it opens, and the licence that lifts the hold, where there is one to buy. */
function openGrade() {
  const s = store.get();
  openSheet({
    title: `Licence: ${s.hunter.regNo || '-- --'}`, system: { icon: <Sigil rank={licensedRank(s)} size={40} />, kind: 'gates' },
    render: () => {
      const s = store.get();
      const mine = licensedRank(s);
      return (
        <div class="stack">
          <div class="sysfields">
            <Field k="Association grade" v={`${mine}-Rank`} />
            <Field k="Gates open" v={`Up to ${RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank`} />
            <Field k="Rank" v={rankFor(s.hunter.level).name} />
            <Field k="Association Licence" v={licenceRequired(s) ? (s.licence.granted ? 'Issued' : '-- --') : 'Issued'} />
          </div>
          {licenceHolding(s) && <p class="hint">Gate grade held at {mine}-Rank.</p>}
          {licenceRequired(s) && licenceHolding(s) && storeReady() && (
            <Btn kind="primary" block onClick={async () => { if (await buyLicence()) { sfx.rankUp(); toast('Licence issued. Gates above D-Rank are open.', 'good'); } }}>
              Association Licence · {priceOf('licence') ?? 'Buy'}
            </Btn>
          )}
        </div>
      );
    },
  });
}

/** Ascension: the level the next run is entered at, its rules, and the marks. Advancement, so gold. */
function openAscension() {
  openSheet({ title: `Ascension: ${store.get().ascension.level}`, system: { icon: <Glyph name="crown" />, kind: 'gold' }, render: () => <AscensionSheet /> });
}

function AscensionSheet() {
  const s = useSave();
  const a = s.ascension;
  const rules = ascension.rulesAt(a.level);
  const choose = (L: number) => store.update((x) => ascension.choose(x, L));
  return (
    <div class="stack ascension">
      <div class="sysfields">
        <Field k="Level" v={<span class="status__level">{a.level}</span>} />
        <Field k="Pay" v={<span class="grant">+{Math.round(ASCENSION_PAY * a.level * 100)}%</span>} />
        <Field k="Name" v={a.level ? ascension.levelInfo(a.level).name : '-- --'} />
        <Field k="Highest opened" v={a.unlocked} />
      </div>
      {a.unlocked <= ASCENSION_RULED && (
        <div class="chips" role="radiogroup" aria-label="Ascension level">
          {Array.from({ length: a.unlocked + 1 }, (_, L) => <Chip key={L} on={a.level === L} onClick={() => choose(L)}>{L}</Chip>)}
        </div>
      )}
      {a.unlocked > ASCENSION_RULED && (
        <div class="stepper" role="group" aria-label="Ascension level">
          <Btn size="sm" disabled={a.level === 0} onClick={() => choose(a.level - 1)}>−</Btn>
          <b class="num">{a.level}</b>
          <Btn size="sm" disabled={a.level >= a.unlocked} onClick={() => choose(a.level + 1)}>+</Btn>
          <Btn size="sm" onClick={() => choose(0)}>0</Btn>
          <Btn size="sm" onClick={() => choose(a.unlocked)}>Highest · {a.unlocked}</Btn>
        </div>
      )}
      {rules.length > 0 && (
        <Section title="Rules in force">
          <ol class="ascension__rules">{rules.map((r) => <li key={r.level} class="sysbox"><strong>[{r.name}]</strong> {r.rule}</li>)}</ol>
        </Section>
      )}
      {ascension.beyond(a.level) > 0 && (
        <small class="ascension__proof">Past Level {ASCENSION_RULED}: Foe strength +{Math.round((BEYOND.growth - 1) * 100)}% each level · +{Math.round((BEYOND.growth ** ascension.beyond(a.level) - 1) * 100)}% here</small>
      )}
      <MarkList />
    </div>
  );
}

/** One of the Chosen holding the gate in the brief: when it shows itself, and what felling it pays. */
function ChosenCard({ d, w, level }: { d: Dungeon; w: walkers.Walker; level: number }) {
  const s = useSave();
  const pay = ascension.payShare(level);
  const felled = s.ascension.felled.includes(w.level);
  return (
    <Card class="bosscard chosencard" tone="gold">
      <Glyph name="crown" />
      <div class="grow">
        <span class="label">Chosen</span>
        <b class="warn">[{w.name}]</b>
        <small class="muted">{level >= w.level ? `In the boss’s place at Ascension ${level}.` : `Appears at Ascension ${w.level} or higher.`}</small>
        <small>{felled ? <>Bounty: Mana Shards <span class="grant">+{shop.gateShards(d.rank, WALKERS.bounty * pay)}</span></>
          : <>Masterwork: {RARITY[d.rank as Rank].name} {walkers.slotOf(w.level)} · Perfect +{w.level}</>}</small>
      </div>
    </Card>
  );
}

/** The marks: one for every level opened, each set for good. */
function MarkList() {
  const s = useSave();
  const waiting = marks.unset(s);
  const set = async (m: Mark) => {
    const ok = await confirm(m.name, `<strong>${marks.markText(m)}</strong>, on top of every mark already set. A mark stays where you set it.`, 'Set The Mark');
    if (!ok || !store.update((x) => marks.setMark(x, m.id))) return;
    sfx.success();
    toast(`${m.name} set.`, 'good');
  };
  return (
    <div class="marks">
      <span class="label">Marks{waiting ? ` · ${waiting} to set` : ''}</span>
      <ul class="marks__list">
        {MARKS.map((m) => {
          const n = marks.setOn(s, m.id);
          return (
            <li key={m.id} class={n ? 'is-set' : ''}>
              <div class="grow">
                <span class="marks__name"><b>{m.name}</b><span class="num muted">{n}/{MARK_MAX}</span></span>
                <small class="muted">{n ? marks.markText(m, n) : `Each: ${marks.markText(m)}`}</small>
              </div>
              {waiting > 0 && marks.canSet(s, m.id) && <Btn kind="gold" size="sm" onClick={() => void set(m)}>Set</Btn>}
            </li>
          );
        })}
      </ul>
      <small class="ascension__proof">Upgrade limit: Perfect +{overCap(s)}</small>
    </div>
  );
}

// ------------------------------------------------------------------ the brief

/** The brief: the System's card on a Gate, in the Gates' orange. */
export function openBrief(d: Dungeon) {
  openSheet({ title: `Gate: ${d.name}`, system: { icon: <RankPlate rank={d.rank} size={40} />, kind: 'gates' }, render: (close) => <Brief d={d} close={close} /> });
}

function Brief({ d, close }: { d: Dungeon; close: () => void }) {
  const s = useSave();
  useNow();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  // A Trial is fought at the level it proves, whatever is chosen: the party, the pay and the rules shown are that level's.
  const level = ascension.entryLevel(s, d, isPractice(d));
  const party = raid.alliesAt(d, dayKey(), licensedRank(s), level);
  const squad = isPractice(d) ? [] : shadows.squad(s);
  const hero = raid.heroSpec(s);
  // The verdict is the engine answering for itself: the gate, run headlessly.
  const proj = useMemo(() => raid.project(s, d, 24), [d.id, s.hunter.level, s.vitals.hp, s.vitals.fatigue, Object.values(s.equipped).join(), squad.map((x) => x.id).join(), s.gates.tactic, level]);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const map = useMemo(() => build(d, mapSeed(d, dayKey())), [d.id, dayKey()]);
  const v = raid.verdict(proj.rate);
  const block = entryBlock(s, d);
  const pay = ascension.payShare(level);
  const sh = Math.round(shop.GATE_SHARDS[d.rank as Rank] * pay);
  const xp = isPractice(d) ? practiceAward(s) : Math.round(GATE_XP[d.rank as Rank] * pay);
  const tower = spire.isSpire(d);
  const first = !tower && !s.gates.cleared.includes(d.id);
  // One of the Chosen may hold this gate today, and stand in the boss's place for a run entered high enough.
  const walker = walkers.walking(s, dayKey());
  const holds = walker?.gateId === d.id ? walker : null;
  const met = holds && level >= holds.level ? walkers.walkerOf(holds.level, d.rank as Rank) : null;
  const hpNow = vitals.read(s);

  const enter = async () => {
    const f = vitals.read(store.get()).fatigue;
    if (f > 20 && !isPractice(d)) {
      const cost = Math.round((vitals.RAID_FATIGUE[d.rank] ?? 10) * raid.fatigueShare(store.get(), level));
      const want = await sys({
        ...system.notify([
          system.counter('Fatigue', f),
          `You will fight at ${system.red(`${Math.round(vitals.drag(f) * 100)}%`)} strength.`,
          `Fatigue on entry: +${cost}`,
        ], 'gates', [{ label: 'Rest First', value: false }, { label: 'Drink Fatigue Potion', value: 'drink' }, { label: 'Enter Anyway', value: true, primary: true }]),
        glyph: 'warn', typed: false,
      });
      if (want === 'drink') { await drinkFlow('fatigue'); return; }
      if (!want) return;
    }
    closeAllSheets();
    store.update((x) => raid.begin(x, d));
    sfx.gate();
    buzz([26, 40, 20, 40, 90]);
    arena.set(d.id);
  };

  const abandon = async () => {
    const run = store.get().gates.raid;
    if (!run || !(await confirm('Abandon the run?', 'You will be carried out. Nothing banked on this run is kept.', 'Abandon', true))) return;
    store.update((x) => raid.finish(x, d, x.gates.raid!, 'defeated'));
    close();
  };

  return (
    <div class="stack brief">
      <div class="sysfields brief__file"><Field k="Association file" v={d.theme} wide /></div>
      <Card class="bosscard" tour="boss">
        <Glyph name={known || met ? 'skull' : 'unknown'} />
        <div class="grow">
          <span class="label">{met ? 'In the boss’s place' : `Gate boss${known ? '' : ': unidentified'}`}</span>
          <b>{met ? met.name : known ? boss.name : '?'}</b>
          <small class="muted">{met ? `${met.rank}-Rank ${met.family} · ${met.role} · Power ${powerOf(met.base)}` : known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · Power ${powerOf(boss.base)}` : '?'}</small>
        </div>
      </Card>
      {holds && <ChosenCard d={d} w={holds} level={level} />}

      <Section title="The assessment">
        <div class={`verdict verdict--${v.tone}`} data-tour="assess">
          <b>Assessment: {v.text}</b>
          <small>Clear rate: {Math.round(proj.rate * 100)}%{proj.heroDown ? ` · Carried out: ${Math.round((proj.heroDown / proj.runs) * 100)}%` : ''}</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small>HP: {hpNow.hp}/{hpNow.hpMax}</small>}
          {level > 0 && <small>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''} · Pay +{Math.round((pay - 1) * 100)}%</small>}
        </div>
        <div class="tiles">
          <Tile label="Clear" value={<span class="num">{xp} XP</span>} sub={isPractice(d) ? `enough for Level ${PRACTICE_LEVEL}` : <>and <Shards n={sh} /></>} />
          {isTrial(d)
            ? <Tile label="Opens" value={`Ascension ${s.ascension.unlocked + 1}`} sub="if you win it" />
            : tower
            ? <Tile label="This week" value={`Floor ${spire.lastFloor(spire.blockOf(d.floor ?? 1))}`} sub="a new best, if you clear it" />
            : <Tile label="First clear" value={first && !isPractice(d) ? <span class="num">+{xp} XP</span> : '-- --'} sub={first && !isPractice(d) ? <>and <Shards n={sh * 2} />, once</> : isPractice(d) ? 'pays in kit' : 'already claimed'} />}
          <Tile label="Loot" value={`${RARITY[d.rank as Rank].name}`} sub={raid.homeSets(d).length ? `and a ${raid.homeSets(d).map((x) => x.id).join(' or ')} piece on a clear` : d.rank === 'S' ? 'and below' : 'sometimes one grade up'} />
          <Tile label="Depth" value={`${map.layers.length} ${isTrial(d) ? 'Chosen' : tower ? 'floors' : 'steps'}`} sub={isTrial(d) ? 'no rest between them' : 'a rest, then the boss'} />
        </div>
      </Section>

      <Section title="Today’s map" right={<>Redraw: <span class="num">{hhmmss(msUntilMidnight())}</span></>}>
        <MapView m={map} road={proj.road} compact />
      </Section>

      <Section title="Standing orders" right={party.length + squad.length ? 'allies and Shadows' : undefined}>
        <div class="chips" aria-label="Standing orders" data-tour="orders">
          {TACTICS.map((x) => <Chip key={x.key} on={s.gates.tactic === x.key} onClick={() => store.update((y) => { y.gates.tactic = x.key; })}>{x.name}</Chip>)}
        </div>
        <p class="muted">{TACTICS.find((x) => x.key === s.gates.tactic)?.desc}</p>
        {squad.some((x) => x.tactic) && <small class="muted">Shadows on their own orders: {squad.filter((x) => x.tactic).length}</small>}
      </Section>

      <Section title="Satchel" right={`${s.satchel}/${shop.FIELD_POTION.max}`}>
        <p><strong>[Item: Field Potion]</strong> <span class="grant">HP +{shop.FIELD_POTION.heal * 100}%</span></p>
        {s.satchel < shop.FIELD_POTION.max && <Btn size="sm" onClick={() => { close(); openExchange(); }}>To The Exchange</Btn>}
      </Section>

      {block === 'open' ? open?.id === d.id
        ? <div class="row"><Btn onClick={abandon}>Abandon</Btn><Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => { closeAllSheets(); arena.set(d.id); }}>Go Back In</Btn></div>
        : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
        : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
        : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
          : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
            : <Btn kind="primary" size="lg" block onClick={enter} sound="none" tour="enter">Enter The Gate</Btn>}

      <Section title="Your party" right={`Hunters: ${1 + party.length}${squad.length ? ` · Shadows: ${squad.length}` : ''}`}>
        <ul class="partylist" data-tour="party">
          <li class="is-you"><RankPlate rank={licensedRank(s)} size={22} /><b>{s.hunter.name}</b><small>you</small><span class="num">{powerOf(hero.base)}</span></li>
          {party.map((a) => (
            <li key={a.id}><RankPlate rank={a.rank} size={22} /><b>{a.name}</b><small>{a.note ?? a.role}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small><span class="num">{powerOf(a.base)}</span></li>
          ))}
          {squad.map((x) => (
            <li key={x.id} class="is-shadow"><RankPlate rank={enemyById(x.enemyId)!.rank} size={22} /><b>{enemyById(x.enemyId)!.shadow}</b><small>Shadow</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>
          ))}
        </ul>
        {!isPractice(d) && shadows.freeSlots(s) > 0 && <p class="hint">Shadow slots empty: {shadows.freeSlots(s)}</p>}
        {isPractice(d) && <p class="hint"><strong>[Ryn Valcorde]</strong> has joined your party.</p>}
      </Section>

    </div>
  );
}

async function intro() {
  await tour({
    who: 'coach', title: 'The Gates', steps: GATES_TOUR,
  });
}
