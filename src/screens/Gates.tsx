/** The Gates: the board, the brief, and the way in. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf } from '@/core/combat';
import { board, bossKnown, mapKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import * as gear from '@/core/gear';
import { RARITY } from '@/core/gear';
import { SETS } from '@/data/sets';
import * as forge from '@/core/forge';
import { ALLOYS } from '@/data/forge';
import { MatArt, TrackMark } from '@/ui/forge';
import { GATE_XP, PRACTICE_LEVEL, practiceAward, rankOf } from '@/core/progression';
import { build, mapSeed, sight } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as spire from '@/core/spire';
import * as ascension from '@/core/ascension';
import { isTrial, trialLevel } from '@/core/trial';
import * as association from '@/core/association';
import { SURVEY } from '@/data/association';
import { goalOf } from '@/ui/assoc';
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
import { Btn, Card, Chip, RankPlate, Section, Shards, useNow, Voice } from '@/ui/components';
import { BentoGrid, type Tile as BTile } from '@/ui/bento';
import { Field, SysFrame } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { FamilyGlyph } from '@/ui/emblems';
import { closeAllSheets, confirm, openSheet, sys, toast, tour } from '@/ui/overlays';
import { openDossier, VitalsBlock } from './Inventory';
import { enterGate, surveyFlow } from '@/app/flow';
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

/** What marks a Gate on the board today: the Practice Gate, one of the Chosen holding it, Ryn's job, or a Daily Quest naming it. */
function markOf(s: Save, d: Dungeon, quest: boolean, day: string): 'Training' | 'Chosen' | 'Association' | 'Quest' | undefined {
  if (isPractice(d)) return 'Training';
  if (walkers.walking(s, day)?.gateId === d.id) return 'Chosen';
  // The Association pins its job's Gate: Ryn's, so it carries his name for it.
  const job = association.current(s);
  if (job && !association.done(job) && job.gate === d.id) return 'Association';
  return quest ? 'Quest' : undefined;
}

type Band = 'all' | 'marked' | Rank;
/** The board's filter, held while the app stays open. */
let boardBand: Band = 'all';

/**
 * GATES: every Gate standing open today. Its counts across the head, a rail to filter by grade or to
 * the marked ones, then each grade as a band: what a clear there pays, and a row to each of its Gates.
 */
function openBoard() {
  openSheet({ title: 'Gates', system: { icon: null, kind: 'gates' }, render: () => <BoardSheet /> });
}

function BoardSheet() {
  const s = useSave();
  useNow();
  const day = dayKey();
  const gates = board(s, day);
  const named = contracts.named(s, day);
  const marks = new Map(gates.map((d) => [d.id, markOf(s, d, named.has(d.id), day)]));
  const marked = gates.filter((d) => marks.get(d.id)).length;
  const [band, setBand] = useState<Band>(boardBand === 'marked' && !marked ? 'all' : boardBand);
  const pick = (b: Band) => { sfx.tap(); boardBand = b; setBand(b); };
  const shown = gates.filter((d) => band === 'all' || (band === 'marked' ? !!marks.get(d.id) : d.rank === band));
  const closed = s.gates.sealed.day === day ? s.gates.sealed.ids.length : 0;
  const fresh = gates.filter((d) => !isPractice(d) && !s.gates.cleared.includes(d.id)).length;
  const grades = RANKS.filter((r) => shown.some((d) => d.rank === r));
  return (
    <div class="stack gboard">
      <div class="bag__head gboard__sum">
        <span><b class="num">{gates.length}</b><small>Open</small></span>
        <span class={fresh ? 'is-new' : ''}><b class="num">{fresh}</b><small>Never Cleared</small></span>
        <span><b class="num">{closed}</b><small>Closed Today</small></span>
        <span><b class="num countdown">{hhmmss(msUntilMidnight())}</b><small>Redraw</small></span>
      </div>
      <div class="gbands" role="tablist" aria-label="Filter Gates">
        <button type="button" role="tab" aria-selected={band === 'all'} class={`gband-tab ${band === 'all' ? 'is-on' : ''}`} onClick={() => pick('all')}>All<small class="num">{gates.length}</small></button>
        {marked > 0 && (
          <button type="button" role="tab" aria-selected={band === 'marked'} aria-label="Marked" title="Marked" class={`gband-tab is-marked ${band === 'marked' ? 'is-on' : ''}`} onClick={() => pick('marked')}>
            <Glyph name="star" /><small class="num">{marked}</small>
          </button>
        )}
        {RANKS.map((r) => {
          const n = gates.filter((d) => d.rank === r).length;
          return (
            <button type="button" role="tab" key={r} aria-selected={band === r} data-rank={r} class={`gband-tab ${band === r ? 'is-on' : ''} ${n ? '' : 'is-empty'}`}
              onClick={() => { if (n) pick(r); else { sfx.tap(); toast(`No ${r}-Rank Gate opened today.`, 'warn'); } }}>
              {r}<small class="num">{n}</small>
            </button>
          );
        })}
      </div>
      {grades.map((r, k) => <GradeBand key={r} s={s} r={r} gates={shown.filter((d) => d.rank === r)} marks={marks} k={k} />)}
    </div>
  );
}

/** A grade's band on the board: its portal and name, what a clear there pays at the level the hunter walks in at, and its Gates. */
function GradeBand({ s, r, gates, marks, k }: { s: Save; r: Rank; gates: Dungeon[]; marks: Map<string, string | undefined>; k: number }) {
  const lead = gates.find((d) => !isPractice(d)) ?? gates[0];
  const pay = ascension.payShare(ascension.entryLevel(s, lead, isPractice(lead)));
  const shut = gates.every((d) => entryBlock(s, d) === 'licence');
  return (
    <section class={`gband ${shut ? 'is-shut' : ''}`} style={`--rc: var(--rank-${r}); --k: ${k}`}>
      <header class="gband__head">
        <span class="ga-portal ga-portal--mini"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><b>{r}</b></span>
        <span class="gband__name">
          <b>{r}-Rank</b>
          <small>Clear: XP <b class="num">{Math.round(GATE_XP[r] * pay)}</b> · <Shards n={shop.gateShards(r, pay)} /></small>
        </span>
        <span class="gband__count">{shut ? <><Glyph name="lock" /> Licence</> : <><b class="num">{gates.length}</b> {gates.length === 1 ? 'Gate' : 'Gates'}</>}</span>
      </header>
      <ul class="glist">
        {gates.map((d, i) => <GateRow key={d.id} s={s} d={d} mark={marks.get(d.id)} i={i} />)}
      </ul>
    </section>
  );
}

/**
 * A Gate's row: its portal, its name and what stands at its end, what marks it, its first-clear bounty
 * while it has never been cleared, the set it is home to, and how many of the creatures known to walk
 * in it already serve as Shadows. It opens the brief.
 */
function GateRow({ s, d, mark, i }: { s: Save; d: Dungeon; mark: string | undefined; i: number }) {
  const locked = entryBlock(s, d) === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  const practice = isPractice(d);
  const cleared = s.gates.cleared.includes(d.id);
  // The creatures it holds; the boss counts once it is known, as the brief shows it.
  const inside = [...new Set([...d.mobs, d.elite, known ? d.boss : undefined].filter((x): x is string => !!x))];
  const bound = inside.filter((id) => shadows.isBound(s, id)).length;
  // The set blueprints its clears leave, as one count: the designs of its home sets known, of all of them.
  const sets = SETS.filter((x) => x.home === d.id);
  const pieces = sets.flatMap((x) => gear.setPieces(x.id).map((p) => p.id));
  const held = pieces.filter((id) => forge.knows(s, id)).length;
  // What a first clear adds: the bounty, at the level the hunter walks in at.
  const bounty = !cleared && !practice ? shop.gateShards(d.rank, 2 * ascension.payShare(ascension.entryLevel(s, d, false))) : 0;
  // The materials the hunter has tagged to find that this Gate leaves: the Forge's anvil, and their names.
  const tracked = practice ? [] : forge.trackedAt(s, d, ascension.entryLevel(s, d, false));
  return (
    <li style={`--i: ${Math.min(i, 8)}`}>
      <button type="button"
        class={`sysbox gaterow ${locked ? 'is-shut' : ''} ${practice ? 'is-practice' : ''} ${cleared ? 'is-cleared' : ''} ${mark ? `is-${mark.toLowerCase()}` : ''} ${d.id === 'DNG-HOLLOW' ? 'is-monarch' : ''}`}
        onClick={() => { sfx.tap(); if (locked) toast(`Your licence does not cover ${d.rank}-Rank yet.`, 'warn'); else openBrief(d); }}>
        <span class="gaterow__portal ga-portal">
          <i class="ga-portal__swirl" /><i class="ga-portal__core" />
          {locked ? <Glyph name="lock" /> : <Glyph name={known ? 'skull' : 'unknown'} />}
          {/* Cleared once: a tick on the portal's corner, the name left as it is. */}
          {cleared && !practice && <span class="gaterow__done" aria-label="Cleared"><Glyph name="check" /></span>}
        </span>
        <span class="gaterow__body">
          <span class="gaterow__name"><b>[{d.name}]</b></span>
          <small>{locked ? `Licence: ${d.rank}-Rank` : known ? <>Boss: <span class="warn">{boss?.name}</span></> : 'Boss: ?'}</small>
          {/* The counts first, the Shadows bound and the set blueprints known, so they line up row to row; then what marks it. */}
          <span class="gaterow__tags">
            {inside.length > 0 && !practice && (
              <span class={`gtag is-shadows ${bound === inside.length ? 'is-full' : ''}`} aria-label={`Shadows bound: ${bound} of ${inside.length}`}>
                <Glyph name="shadows" /><span class="num">{bound}/{inside.length}</span>
              </span>
            )}
            {pieces.length > 0 && (
              <span class={`gtag is-pieces ${held >= pieces.length ? 'is-full' : ''}`} title={`Set blueprints known: ${sets.map((x) => x.id).join(', ')}`} aria-label={`Set blueprints known: ${held} of ${pieces.length}`}>
                <Glyph name="blueprint" /><span class="num">{held}/{pieces.length}</span>
              </span>
            )}
            {mark && <span class={`gtag is-${mark.toLowerCase()}`}>{mark}</span>}
            {bounty > 0 && <span class="gtag is-bounty" title="First-clear bounty">Bounty <Shards n={bounty} /></span>}
            {tracked.length > 0 && (
              <span class="gtag is-tracked" title={`Tracked: ${tracked.map((id) => forge.materialById(id)?.name).join(', ')}`}
                aria-label={`Tracked materials here: ${tracked.map((id) => forge.materialById(id)?.name).join(', ')}`}>
                <Glyph name="forge" />{tracked.length > 1 && <span class="num">{tracked.length}</span>}
              </span>
            )}
          </span>
        </span>
        <Glyph name="chevron" class="gaterow__go" />
      </button>
    </li>
  );
}

/** The board as one tile: a portal to each grade, the count of its Gates open, dimmed where the licence stops, starred where one is marked. */
function boardTile(s: Save, gates: Dungeon[]): BTile {
  const day = dayKey();
  const named = contracts.named(s, day);
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
            const marked = here.some((d) => markOf(s, d, named.has(d.id), day) && !isPractice(d));
            return (
              <span key={r} class={`ga-board__one ${here.length ? '' : 'is-none'} ${open ? '' : 'is-shut'}`} style={`--rc: var(--rank-${r})`}>
                <span class="ga-portal ga-portal--mini"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><b>{r}</b>{marked && <Glyph name="star" class="ga-board__mark" />}</span>
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
    const steps = raid.stepsOf(raid.mapOf(open, run));
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
  const locked = entryBlock(s, d) === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  const practice = isPractice(d);
  const tag = markOf(s, d, quest, day);
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
  // Today's map through its fog: what a run on it is seeing, or what is remembered of it.
  const onIt = s.gates.raid?.dungeonId === d.id && s.gates.raid.map === mapSeed(d, dayKey()) ? s.gates.raid : null;
  const fog = map.tower ? undefined : onIt ? raid.seen(s, d, onIt) : sight(map, new Set(), raid.remembered(s, mapSeed(d, dayKey())));
  // A Gate Survey charts every room of it, before the hunter goes in or after.
  const surveyBtn = shop.held(s, 'survey') > 0 && raid.surveyable(s, d)
    ? <Btn size="sm" block onClick={() => void surveyFlow(d)}>Use {SURVEY.name} · Held: {shop.held(s, 'survey')}</Btn>
    : null;
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

  const enter = () => enterGate(d);

  const abandon = async () => {
    const run = store.get().gates.raid;
    if (!run || !(await confirm('Abandon the run?', 'You will be carried out. Nothing banked on this run is kept.', 'Abandon', true))) return;
    store.update((x) => raid.finish(x, d, x.gates.raid!, 'defeated'));
    close();
  };

  // What walks in it: its creatures and its gatekeeper, named once the hunter has been inside, as the map is;
  // the boss counts once it is known. The violet ones already serve as Shadows.
  const inside = [...new Set([...d.mobs, ...(d.elite ? [d.elite] : [])])].map((id) => enemyById(id)).filter((e): e is NonNullable<ReturnType<typeof enemyById>> => !!e);
  const seen = mapKnown(s, d);
  const counted = [...inside, ...(known ? [boss] : [])];
  const bound = counted.filter((e) => shadows.isBound(s, e.id)).length;
  const mark = markOf(s, d, contracts.named(s, dayKey()).has(d.id), dayKey());
  const partyPower = powerOf(hero.base) + party.reduce((n, a) => n + powerOf(a.base), 0) + squad.reduce((n, x) => n + shadows.power(x), 0);
  const C = 2 * Math.PI * 21;
  const rate = Math.round(proj.rate * 100);
  const sets = raid.homeSets(d);

  return (
    <div class={`stack brief ${isTrial(d) ? 'is-trial' : ''}`} style={`--rc: ${isTrial(d) ? 'var(--gold)' : `var(--rank-${d.rank})`}`}>
      {/* The banner: the Gate's portal in its grade's colour, and the Association's file. The Trial is the System's own: it states its terms. */}
      <header class="sysbox bhead">
        <span class="bhead__portal ga-portal" aria-hidden="true">
          <i class="ga-portal__swirl" /><i class="ga-portal__core" />
          <RankPlate rank={d.rank} size={34} />
        </span>
        <span class="bhead__body">
          <span class="label">{isTrial(d) ? 'Trial of Ascension' : tower ? `${d.rank}-Rank floors` : `${d.rank}-Rank Gate`}</span>
          {isTrial(d)
            ? <p class="bhead__file">{d.trial} of the Chosen, in a row.</p>
            : <p class="bhead__file"><span class="label">Association file:</span> {d.theme}</p>}
          <span class="bhead__tags">
            {!isTrial(d) && !tower && !isPractice(d) && <span class={`gtag ${s.gates.cleared.includes(d.id) ? 'is-done' : 'is-bounty'}`}>{s.gates.cleared.includes(d.id) ? 'Cleared' : 'Never cleared'}</span>}
            {mark && <span class={`gtag is-${mark.toLowerCase()}`}>{mark}</span>}
            {level > 0 && <span class="gtag is-ascension">Ascension {level}</span>}
            {isTrial(d) && <><span class="gtag">Rest: None</span><span class="gtag">Withdrawal: Not possible</span><span class="gtag">Allies: None</span></>}
          </span>
        </span>
      </header>

      {/* The assessment: the clear rate as a ring, in the verdict's colour, and what bears on it. */}
      <section class={`verdict verdict--${v.tone} bassess`} data-tour="assess">
        <span class="bassess__ring" aria-hidden="true">
          <svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="21" class="bassess__track" /><circle cx="25" cy="25" r="21" class="bassess__arc" style={`stroke-dasharray: ${C * proj.rate} ${C}`} /></svg>
          <b class="num">{rate}<small>%</small></b>
        </span>
        <span class="bassess__body">
          <b>Assessment: {v.text}</b>
          <small>Clear rate: {rate}%</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small>HP: {hpNow.hp}/{hpNow.hpMax}</small>}
          {level > 0 && <small>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''} · Pay +{Math.round((pay - 1) * 100)}%</small>}
        </span>
      </section>

      {/* What it pays: a cell each, small, so the threat and the map stand above the fold. */}
      <div class="brewards">
        <span class="sysbox brewards__one"><small class="label">Clear</small><b class="num">XP +{xp}</b><small>{isPractice(d) ? `enough for Level ${PRACTICE_LEVEL}` : <><Shards n={sh} /></>}</small></span>
        {isTrial(d)
          ? <span class="sysbox brewards__one"><small class="label">Opens</small><b>Ascension {s.ascension.unlocked + 1}</b><small>if you win it</small></span>
          : tower
          ? <span class="sysbox brewards__one"><small class="label">This week</small><b>Floor {spire.lastFloor(spire.blockOf(d.floor ?? 1))}</b><small>a new best, if you clear it</small></span>
          : <span class={`sysbox brewards__one ${first && !isPractice(d) ? 'is-bounty' : ''}`}><small class="label">First clear</small><b class="num">{first && !isPractice(d) ? `XP +${xp}` : '-- --'}</b><small>{first && !isPractice(d) ? <><Shards n={sh * 2} />, once</> : isPractice(d) ? 'pays in kit' : 'already claimed'}</small></span>}
        <span class="sysbox brewards__one"><small class="label">Materials</small><b>{isPractice(d) ? ALLOYS.E.name : ALLOYS[d.rank as Rank].name}</b><small>{isPractice(d) ? 'and a ring' : sets.length ? `${forge.trophyTable().get(d.shape ?? d.id)?.name ?? 'a trophy'} · ${sets.map((x) => x.id).join(' or ')} blueprints` : first ? 'and a blueprint' : 'a blueprint, sometimes'}</small></span>
        <span class="sysbox brewards__one"><small class="label">Depth</small><b>{raid.stepsOf(map)} {isTrial(d) ? 'Chosen' : tower ? 'floors' : 'rooms'}</b><small>{isTrial(d) ? 'no rest between them' : tower ? 'a rest, then the boss' : `${proj.road.length} to the boss`}</small></span>
      </div>
      {/* The materials tagged at the Forge that this Gate leaves. */}
      {!isPractice(d) && !isTrial(d) && forge.trackedAt(s, d, level).length > 0 && (
        <div class="sysbox btracked" aria-label="Tracked materials here">
          <TrackMark class="btracked__mark" />
          <span class="label">Tracked</span>
          <span class="btracked__list">{forge.trackedAt(s, d, level).map((id) => (
            <span key={id} class="matchip"><MatArt id={id} size={20} /><span class="matchip__name">{forge.materialById(id)?.name}</span></span>
          ))}</span>
        </div>
      )}

      {/* What stands in it: the boss, one of the Chosen if it holds the Gate today, and the rest of what walks there. */}
      <Section title="Threat" right={!isPractice(d) && !isTrial(d) && counted.length ? `Shadows bound: ${bound}/${counted.length}` : undefined}>
        <Card class="bosscard" tour="boss">
          {known || met ? <FamilyGlyph family={(met ?? boss).family} size={40} /> : <Glyph name="unknown" />}
          <div class="grow">
            <span class="label">{met ? 'In the boss’s place' : isTrial(d) ? 'The last of the Chosen' : `Gate boss${known ? '' : ': unidentified'}`}</span>
            <b>{met ? met.name : known ? boss.name : '?'}</b>
            <small class="muted">{met ? `${met.rank}-Rank ${met.family} · ${met.role} · Power ${powerOf(met.base)}` : known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · Power ${powerOf(boss.base)}` : '?'}</small>
          </div>
          {known && !met && shadows.isBound(s, boss.id) && <span class="bthreat__bound" title="Serves as a Shadow"><Glyph name="shadows" /></span>}
        </Card>
        {holds && <ChosenCard d={d} w={holds} level={level} />}
        {!isTrial(d) && inside.length > 0 && (
          <div class="bthreat">
            {inside.map((e) => (
              <span key={e.id} class={`sysbox bthreat__one ${seen && shadows.isBound(s, e.id) ? 'is-bound' : ''} ${e.id === d.elite ? 'is-elite' : ''}`}>
                {seen ? <FamilyGlyph family={e.family} size={16} /> : <Glyph name="unknown" />}
                <span class="bthreat__name">
                  <b>{seen ? e.name : '?'}</b>
                  <small>{e.id === d.elite ? 'Gatekeeper' : seen ? `${e.rank}-Rank ${e.family}` : 'Unidentified'}</small>
                </span>
                {seen && shadows.isBound(s, e.id) && <Glyph name="shadows" class="bthreat__mark" />}
              </span>
            ))}
          </div>
        )}
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
            <MapView m={map} road={proj.road} seen={fog} compact />
            {surveyBtn}
          </Section>
        )
        : (
          <Section title="Today’s map" right="Unidentified">
            <div class="gmap-fog" role="img" aria-label="Map unidentified">
              <Glyph name="unknown" />
              <b>?</b>
            </div>
            {surveyBtn}
          </Section>
        )}

      {/* The party, a card each, after a squad's roster: who walks in, and their power together. */}
      <Section title={isTrial(d) ? 'Entering' : 'Your party'} right={<>Power <b class="num">{partyPower}</b></>}>
        <ul class="partylist bparty" data-tour="party">
          <li class="is-you"><RankPlate rank={licensedRank(s)} size={20} /><span class="bparty__who"><b>{s.hunter.name}</b><small>You</small></span><span class="num">{powerOf(hero.base)}</span></li>
          {party.map((a) => (
            <li key={a.id}><RankPlate rank={a.rank} size={20} /><span class="bparty__who"><b>{a.name}</b><small>{a.note ?? a.role}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small></span><span class="num">{powerOf(a.base)}</span></li>
          ))}
          {squad.map((x) => (
            <li key={x.id} class="is-shadow"><RankPlate rank={enemyById(x.enemyId)!.rank} size={20} /><span class="bparty__who"><b>{shadows.nameOf(x).replace(/^Shadow /, '')}</b><small>Shadow</small></span><span class="num">{shadows.power(x)}</span></li>
          ))}
        </ul>
        {!isPractice(d) && shadows.freeSlots(s) > 0 && <p class="hint">Shadow slots empty: {shadows.freeSlots(s)}</p>}
        {isPractice(d) && <p class="hint"><strong>[Ryn Valcorde]</strong> has joined your party.</p>}
      </Section>

      <div class="bsatchel">
        <span><strong>[Item: Field Potion]</strong> <span class="grant">HP +{shop.FIELD_POTION.heal * 100}%</span></span>
        <span class="num">Satchel {s.satchel}/{shop.satchelMax(s)}</span>
        {s.satchel < shop.satchelMax(s) && <Btn size="sm" onClick={() => { close(); openExchange(); }}>To The Exchange</Btn>}
      </div>

      {/* The way in stays at the foot of the window, whatever is scrolled past. */}
      <div class="bdock">
        {block === 'open' ? open?.id === d.id
          ? <div class="row"><Btn onClick={abandon}>Abandon</Btn><Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => { closeAllSheets(); arena.set(d.id); }}>Go Back In</Btn></div>
          : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
          : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
          : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
            : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
              : <Btn kind={isTrial(d) ? 'gold' : 'primary'} size="lg" block onClick={enter} sound="none" tour="enter">{isTrial(d) ? 'Enter The Trial' : 'Enter The Gate'}</Btn>}
      </div>
    </div>
  );
}

async function intro() {
  await tour({
    who: 'coach', title: 'The Gates', steps: GATES_TOUR,
  });
}
