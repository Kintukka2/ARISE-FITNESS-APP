/** The Gates: the board, the brief, and the way in. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf } from '@/core/combat';
import { board, bossKnown, mapKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import { RARITY } from '@/core/gear';
import { GATE_XP, PRACTICE_LEVEL, practiceAward, rankOf } from '@/core/progression';
import { build, mapSeed } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as spire from '@/core/spire';
import * as ascension from '@/core/ascension';
import { isTrial, trialLevel } from '@/core/trial';
import * as association from '@/core/association';
import { SURVEY } from '@/data/association';
import { goalOf } from '@/ui/assoc';
import { ask } from '@/ui/ask';
import { ASCENSION_FROM, ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, OVERCHARGE, PROOF, WALKERS, type Mark } from '@/data/ascension';
import * as walkers from '@/core/walkers';
import * as marks from '@/core/marks';
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
import { Field, SysFrame } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { FamilyGlyph } from '@/ui/emblems';
import { closeAllSheets, confirm, openSheet, sys, toast, tour } from '@/ui/overlays';
import { drinkFlow, openDossier, VitalsBlock } from './Inventory';
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
      <Condition />
      <BentoGrid class="gatesgrid" tiles={topTiles(s)} label="Gates" />
    </div>
  );
}

/**
 * The hunter's condition at a glance, under Valcorde's line: HP, MP and Fatigue, each with its potion
 * one tap away, held or bought, and the lockout with its elixir while it holds. The System's, so its frame.
 */
function Condition() {
  return <SysFrame class="vitalstrip" label="Condition"><VitalsBlock /></SysFrame>;
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
    // The screen's centre: the way into everything else on it. It stands out by its size, its light and its call.
    key: 'board', kind: 'gates', name: 'Open Gates', head: true, wide: true, tour: 'bands', icon: <Glyph name="gates" />, class: 'btile--focus',
    count: gates.length,
    status: <>Redraw: <b class="num">{hhmmss(msUntilMidnight())}</b></>,
    art: (
      <span class="ga-focus">
        <i class="ga-focus__rays" />
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
        <span class="ga-focus__cta">View All Gates <Glyph name="chevron" /></span>
      </span>
    ),
    open: openBoard,
  };
}

/** What stands above the board: the run left open, the hunter's grade, their record and Ascension. The Pale Spire is a Weekly Quest, on the Quests screen. */
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
      key: 'run', kind: 'gates', name: open.name, wide: true, call: true, icon: <Glyph name="gates" />,
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
    // Grade and Record stand under Open Gates, small, so it stays the screen's centre.
    key: 'grade', kind: 'gates', name: 'Grade', head: true, tour: 'licence', icon: <Glyph name="cert" />, hot: holding && licenceRequired(s) && storeReady(), class: 'btile--compact',
    count: `${mine}-Rank`,
    status: holding ? `Held at ${mine}-Rank.` : `Gates up to ${RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank.`,
    art: <span class="ga-emblem"><i class="ga-emblem__ring" /><i class="ga-emblem__ring" /><Sigil rank={mine} size={34} /></span>,
    open: openGrade,
  });
  const entered = s.gates.clears + s.gates.fails + s.gates.withdrawn;
  out.push({
    key: 'record', kind: 'gates', name: 'Record', head: true, icon: <Glyph name="chart" />, class: 'btile--compact',
    status: `Best run unbroken: ${s.gates.bestUnbroken}`,
    art: (
      <span class="ga-record">
        <span class="sysbox"><small>Entered</small><b class="num">{entered}</b></span>
        <span class="sysbox"><small>Cleared</small><b class="num">{s.gates.clears}</b></span>
        <span class="sysbox"><small>Taken</small><b class="num">{s.gates.cleared.filter((id) => id !== 'DNG-000').length}</b></span>
      </span>
    ),
    open: openDossier,
  });
  const a = s.ascension;
  // From Ascension's grade, before its first level opens too: the tile holds the road to it.
  if (ascension.ascensionOpen(s)) {
    out.push({
      // Gold only while something waits: a mark to set, or the tile not yet opened.
      key: 'ascension', kind: 'system', name: `Ascension ${a.level}`, icon: <Glyph name="crown" />, call: marks.unset(s) > 0 || !story.seen(s, 'ascension-told'),
      count: marks.unset(s) > 0 ? `${marks.unset(s)} ${marks.unset(s) === 1 ? 'mark' : 'marks'}` : !story.seen(s, 'ascension-told') ? 'New' : `${a.level}/${a.unlocked}`,
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
  // Tiles go two to a row: an odd one out takes the row's whole width.
  const halves = out.filter((t) => !t.wide);
  if (halves.length % 2) halves[halves.length - 1].wide = true;
  return out;
}

/** A Gate on the board: its grade's portal, its name, and what stands at its end. */
function gateTile(s: Save, d: Dungeon, quest: boolean, day: string): BTile {
  const held = walkers.walking(s, day)?.gateId === d.id;
  const locked = entryBlock(s, d) === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  const practice = isPractice(d);
  // The Association pins its job's Gate: Ryn's, so it carries his name for it.
  const job = association.current(s);
  const pinned = job && !association.done(job) && job.gate === d.id;
  const tag = practice ? 'Training' : held ? 'Chosen' : pinned ? 'Association' : quest ? 'Quest' : undefined;
  return {
    key: `gate-${d.id}`, kind: 'gates', name: d.name, wide: practice, call: practice, shut: locked,
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
            <Field k="Rank" v={rankOf(s).name} />
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

/** Ascension: the level the next run is entered at, what it does, the road to the next, and the marks. Advancement, so gold. */
function openAscension() {
  openSheet({
    title: `Ascension: ${store.get().ascension.level}`, system: { icon: <Glyph name="crown" />, kind: 'gold' },
    action: { label: 'How Ascension Works', icon: 'help', onClick: () => void ascensionTour() },
    render: () => <AscensionSheet />,
  });
}

/** The Gates a proof asks for, as the Trial's quest words it: every one of a grade with fewer than the rule's number. */
const proofGates = (s: Save) => {
  const need = ascension.proofNeeds(s);
  return `${need < PROOF.gates ? `all ${need}` : `${need} different`} ${licensedRank(s)}-Rank Gates`;
};

/** The interface teaching Ascension on the sheet itself, a part at a time. Shown the first time the sheet opens, and from its help button. */
function ascensionTour() {
  const s = store.get();
  const gates = ascension.proving(s) ? proofGates(s) : `the ${ASCENSION_FROM}-Rank Gates`;
  return tour({
    who: 'app', title: 'Ascension',
    steps: [
      { at: 'asc-level', say: `Ascension is the climb after ${ASCENSION_FROM}-Rank: the same Gates, played harder, for more. Choose a level here, and every Gate you enter is played at it. Level 0 is the board as it stands.` },
      { at: 'asc-now', say: `Every level makes every foe stronger and adds a rule, on top of every rule below it. Every level pays ${Math.round(ASCENSION_PAY * 100)}% more than the one below.` },
      { at: 'asc-next', say: `To open the next level, clear ${gates} at your highest level. Then win the Trial: the Chosen, one after another, with no rest. The Trial is on the Quests screen too.` },
      { at: 'asc-marks', say: `Every level you open earns a mark, a bonus you set here for good. It also lets gear go ${OVERCHARGE.per === 1 ? 'one upgrade step' : `${OVERCHARGE.per} upgrade steps`} past perfect, and sends one of the Chosen into the Gates.` },
      { say: 'You can step back down at any time. Every rule is in the Guide, under Ascension.' },
    ],
  });
}

function AscensionSheet() {
  const s = useSave();
  const a = s.ascension;
  const rules = ascension.rulesAt(a.level);
  const choose = (L: number) => store.update((x) => ascension.choose(x, L));
  const foes = Math.round((ascension.ascensionTune(a.level) - 1) * 100);
  useEffect(() => {
    if (store.update((x) => story.markOnce(x, 'ascension-told'))) setTimeout(() => void ascensionTour(), 450);
  }, []);
  return (
    <div class="stack ascension">
      <div class="sysfields" data-tour="asc-now">
        <Field k="Entering at" v={<><span class="status__level">{a.level}</span>{a.level ? ` · ${ascension.levelInfo(a.level).name}` : ''}</>} />
        <Field k="Highest opened" v={a.unlocked} />
        <Field k="Foe strength" v={foes ? <span class="warn">+{foes}%</span> : 'As the board'} />
        <Field k="Gate pay" v={a.level ? <span class="grant">+{Math.round(ASCENSION_PAY * a.level * 100)}%</span> : 'As the board'} />
      </div>
      <div data-tour="asc-level">
        {a.unlocked <= ASCENSION_RULED && (
          <div class="chips" role="radiogroup" aria-label="Ascension level">
            {Array.from({ length: a.unlocked + 1 }, (_, L) => <Chip key={L} on={a.level === L} onClick={() => choose(L)}>{L}</Chip>)}
            <span class="chip chip--locked" aria-label={`Ascension ${a.unlocked + 1}, locked`}><Glyph name="lock" />{a.unlocked + 1}</span>
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
      </div>
      {rules.length > 0 && (
        <Section title="Rules in force">
          <ol class="ascension__rules">{rules.map((r) => <li key={r.level} class="sysbox"><strong>[{r.name}]</strong> {r.rule}</li>)}</ol>
        </Section>
      )}
      {ascension.beyond(a.level) > 0 && (
        <small class="ascension__proof">Past Level {ASCENSION_RULED}: Foe strength +{Math.round((BEYOND.growth - 1) * 100)}% each level · +{Math.round((BEYOND.growth ** ascension.beyond(a.level) - 1) * 100)}% here</small>
      )}
      <NextLevel />
      <MarkList />
    </div>
  );
}

/** The road to the next level: the Gates to prove at the highest one, then the Trial, and the rule the next level adds. */
function NextLevel() {
  const s = useSave();
  const a = s.ascension;
  const next = a.unlocked + 1;
  const need = ascension.proofNeeds(s);
  const got = Math.min(need, a.proof.gates.length);
  const proved = ascension.trialProved(s);
  const ready = ascension.trialReady(s);
  const trial = ascension.nextTrial(s);
  const info = ascension.levelInfo(next);
  return (
    <Section title={`To open Ascension ${next}`}>
      <ol class="ascnext" data-tour="asc-next">
        <li class={`sysbox ${proved ? 'is-done' : 'is-now'}`}>
          <span class="ascnext__n num">1</span>
          <div class="grow">
            <b>Clear {proofGates(s)} at Ascension {a.unlocked}.</b>
            <span class="ascnext__pips" aria-hidden="true">{Array.from({ length: need }, (_, i) => <i key={i} class={i < got ? 'is-on' : ''} />)}</span>
          </div>
          <span class="num">{got}/{need}</span>
        </li>
        <li class={`sysbox ${ready ? 'is-now' : proved ? 'is-wait' : 'is-later'}`}>
          <span class="ascnext__n num">2</span>
          <div class="grow">
            <b>Win the Trial: {trial.trial} of the Chosen in a row.</b>
            <small>{!proved ? 'Opens when the Gates are cleared.' : ready ? 'Open. Once a day.' : 'Faced today. It opens again tomorrow.'}</small>
          </div>
          <span class="num">0/1</span>
        </li>
      </ol>
      <p class="ascnext__adds"><span class="label">Ascension {next} adds</span>{next <= ASCENSION_RULED ? <><strong>[{info.name}]</strong> {info.rule}</> : `Foe strength +${Math.round((BEYOND.growth - 1) * 100)}%`}</p>
      {ready && <Btn kind="gold" block onClick={() => openBrief(trial)}>Face The Trial</Btn>}
    </Section>
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
  // The System's offer, as a purchase is: the mark, what it adds, where it stands, and that it is for good.
  const set = async (m: Mark) => {
    const n = marks.setOn(store.get(), m.id);
    const ok = await sys(system.offer([
      'Would you like to set this mark?',
      system.tag(m.name),
      system.gain(marks.markText(m)),
      `Set: ${system.change(`${n}/${MARK_MAX}`, `${n + 1}/${MARK_MAX}`)} · Marks to set: ${marks.unset(store.get())}`,
      system.red('A mark cannot be moved once set.'),
    ], 'gold', 'Set', 'Cancel'));
    if (ok !== true || !store.update((x) => marks.setMark(x, m.id))) return;
    sfx.success();
    buzz([14, 30, 22]);
    await sys({ ...system.notify([`${system.tag(m.name)} has been set.`, system.gain(marks.markText(m, n + 1))], 'gold'), typed: false });
  };
  return (
    <div class="marks" data-tour="asc-marks">
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
      <small class="ascension__proof">Upgrade limit: Perfect +{ascension.overCap(s)}</small>
    </div>
  );
}

// ------------------------------------------------------------------ the brief

/** The brief: the System's card on a Gate, in the Gates' orange. A Trial is advancement, so its card is gold. */
export function openBrief(d: Dungeon) {
  const trial = isTrial(d);
  openSheet({
    title: trial ? `Trial: Ascension ${trialLevel(d) + 1}` : `Gate: ${d.name}`,
    system: trial ? { icon: <Glyph name="cert" />, kind: 'gold' } : { icon: <RankPlate rank={d.rank} size={40} />, kind: 'gates' },
    render: (close) => <Brief d={d} close={close} />,
  });
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
      {/* A Gate comes with the Association's file. The Trial is the System's own: it states its terms, and no hunter of the Association walks in. */}
      {isTrial(d)
        ? (
          <div class="sysfields brief__file">
            <Field k="Chosen" v={`${d.trial}, in a row`} />
            <Field k="Rest" v="None" />
            <Field k="Withdrawal" v="Not possible" />
            <Field k="Allies" v="None" />
          </div>
        )
        : <div class="sysfields brief__file"><Field k="Association file" v={d.theme} wide /></div>}
      <Card class="bosscard" tour="boss">
        {/* What it is, once it is known: its family's glyph. */}
        {known || met ? <FamilyGlyph family={(met ?? boss).family} size={40} /> : <Glyph name="unknown" />}
        <div class="grow">
          <span class="label">{met ? 'In the boss’s place' : isTrial(d) ? 'The last of the Chosen' : `Gate boss${known ? '' : ': unidentified'}`}</span>
          <b>{met ? met.name : known ? boss.name : '?'}</b>
          <small class="muted">{met ? `${met.rank}-Rank ${met.family} · ${met.role} · Power ${powerOf(met.base)}` : known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · Power ${powerOf(boss.base)}` : '?'}</small>
        </div>
      </Card>
      {holds && <ChosenCard d={d} w={holds} level={level} />}

      <Section title="The assessment">
        <div class={`verdict verdict--${v.tone}`} data-tour="assess">
          <b>Assessment: {v.text}</b>
          <small>Clear rate: {Math.round(proj.rate * 100)}%</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small>HP: {hpNow.hp}/{hpNow.hpMax}</small>}
          {level > 0 && <small>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''} · Pay +{Math.round((pay - 1) * 100)}%</small>}
        </div>
        <div class="tiles">
          <Tile label="Clear" value={<span class="num">XP +{xp}</span>} sub={isPractice(d) ? `enough for Level ${PRACTICE_LEVEL}` : <>and <Shards n={sh} /></>} />
          {isTrial(d)
            ? <Tile label="Opens" value={`Ascension ${s.ascension.unlocked + 1}`} sub="if you win it" />
            : tower
            ? <Tile label="This week" value={`Floor ${spire.lastFloor(spire.blockOf(d.floor ?? 1))}`} sub="a new best, if you clear it" />
            : <Tile label="First clear" value={first && !isPractice(d) ? <span class="num">XP +{xp}</span> : '-- --'} sub={first && !isPractice(d) ? <>and <Shards n={sh * 2} />, once</> : isPractice(d) ? 'pays in kit' : 'already claimed'} />}
          <Tile label="Loot" value={`${RARITY[d.rank as Rank].name}`} sub={raid.homeSets(d).length ? `and a ${raid.homeSets(d).map((x) => x.id).join(' or ')} piece on a clear` : d.rank === 'S' ? 'and below' : 'sometimes one grade up'} />
          <Tile label="Depth" value={`${map.layers.length} ${isTrial(d) ? 'Chosen' : tower ? 'floors' : 'steps'}`} sub={isTrial(d) ? 'no rest between them' : 'a rest, then the boss'} />
        </div>
      </Section>

      {/* The job Ryn gave for this Gate, if one is in hand: the interface saying what it is. */}
      {(() => {
        const job = association.current(s);
        if (!job || association.done(job) || (job.kind !== 'hunt' && job.gate !== d.id) || (job.kind === 'hunt' && !d.mobs.includes(job.target ?? ''))) return null;
        return <p class="hint assochint">Association Quest: {goalOf(job)} <span class="num">{job.got}/{job.need}</span></p>;
      })()}

      {/* Unidentified until the hunter has been inside, as the boss is until it is met. */}
      {mapKnown(s, d)
        ? (
          <Section title="Today’s map" right={<>Redraw: <span class="num">{hhmmss(msUntilMidnight())}</span></>}>
            <MapView m={map} road={proj.road} compact />
          </Section>
        )
        : (
          <Section title="Today’s map" right="Unidentified">
            <div class="gmap-fog" role="img" aria-label="Map unidentified">
              <Glyph name="unknown" />
              <b>?</b>
            </div>
            {/* A Gate Survey from the Association shows the map before the hunter has been in. */}
            {shop.held(s, 'survey') > 0 && (
              <Btn size="sm" block onClick={async () => {
                const ok = await ask('use:survey', system.offer([
                  'Would you like to use?',
                  system.tag(SURVEY.name, 'Item'),
                  `Map of ${system.tag(d.name)}`,
                  `Held: ${shop.held(store.get(), 'survey')}`,
                ], 'gear', 'Use', 'Cancel'));
                if (ok && store.update((x) => association.survey(x, d.id))) { sfx.success(); toast(`${SURVEY.name} · ${d.name} mapped.`, 'good'); }
              }}>Use {SURVEY.name} · Held: {shop.held(s, 'survey')}</Btn>
            )}
          </Section>
        )}

      <Section title="Satchel" right={`${s.satchel}/${shop.satchelMax(s)}`}>
        <p><strong>[Item: Field Potion]</strong> <span class="grant">HP +{shop.FIELD_POTION.heal * 100}%</span></p>
        {s.satchel < shop.satchelMax(s) && <Btn size="sm" onClick={() => { close(); openExchange(); }}>To The Exchange</Btn>}
      </Section>

      {block === 'open' ? open?.id === d.id
        ? <div class="row"><Btn onClick={abandon}>Abandon</Btn><Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => { closeAllSheets(); arena.set(d.id); }}>Go Back In</Btn></div>
        : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
        : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
        : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
          : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
            : <Btn kind={isTrial(d) ? 'gold' : 'primary'} size="lg" block onClick={enter} sound="none" tour="enter">{isTrial(d) ? 'Enter The Trial' : 'Enter The Gate'}</Btn>}

      <Section title={isTrial(d) ? 'Entering' : 'Your party'} right={isTrial(d) ? `You${squad.length ? ` · Shadows: ${squad.length}` : ''}` : `Hunters: ${1 + party.length}${squad.length ? ` · Shadows: ${squad.length}` : ''}`}>
        <ul class="partylist" data-tour="party">
          <li class="is-you"><RankPlate rank={licensedRank(s)} size={22} /><b>{s.hunter.name}</b><small>you</small><span class="num">{powerOf(hero.base)}</span></li>
          {party.map((a) => (
            <li key={a.id}><RankPlate rank={a.rank} size={22} /><b>{a.name}</b><small>{a.note ?? a.role}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small><span class="num">{powerOf(a.base)}</span></li>
          ))}
          {squad.map((x) => (
            <li key={x.id} class="is-shadow"><RankPlate rank={enemyById(x.enemyId)!.rank} size={22} /><b>{shadows.nameOf(x)}</b><small>Shadow</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>
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
