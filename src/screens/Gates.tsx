/** The Gates: the board, and the way to each Gate's brief (`./Brief`). */
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { board, bossKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { powerOf } from '@/core/combat';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import * as gear from '@/core/gear';
import { SETS } from '@/data/sets';
import * as forge from '@/core/forge';
import { GATE_XP, rankOf } from '@/core/progression';
import * as contracts from '@/core/contracts';
import * as ascension from '@/core/ascension';
import { ASCENSION_FROM, ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, OVERCHARGE, PROOF, type Mark } from '@/data/ascension';
import * as marks from '@/core/marks';
import { GATES_LINE, GATES_TOUR } from '@/data/narrative';
import * as system from '@/ui/system';
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
import { Btn, Chip, Section, Shards, useNow, Voice } from '@/ui/components';
import { SysFrame } from '@/ui/frame';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { openSheet, sys, toast, tour } from '@/ui/overlays';
import { openDossier, VitalsBlock } from './Inventory';
import * as feats from '@/core/feats';
import { FEATS_PER_GATE } from '@/data/feats';
import { markOf, openBrief } from './Brief';

export { openBrief };

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

  const gates = board(s, day);
  const practice = gates.find(isPractice);
  const run = s.gates.raid;
  const open = run ? dungeonById(run.dungeonId) : null;
  return (
    <div class="stack gatehome">
      <Voice>{coachLine(s)}</Voice>
      <Condition />
      {/* A run left open is one tap from where it stopped; its brief, from the board, holds Abandon. */}
      {open && run && <RunCard d={open} steps={raid.stepsOf(raid.mapOf(open, run))} at={run.at} />}
      {/* The practice Gate stands first, until it is cleared: Valcorde's tour points at it. */}
      {practice && <ul class="glist gatehome__practice" data-tour="board"><GateRow s={s} d={practice} mark={markOf(s, practice, false, day)} i={0} /></ul>}
      <GateRadar s={s} gates={gates} />
      <HunterRow s={s} />
    </div>
  );
}

/** The run left open, gold while it waits: its Gate's portal, its name, how far in, and the way back. */
function RunCard({ d, steps, at }: { d: Dungeon; steps: number; at: number }) {
  return (
    <button type="button" class="runcard" style={`--rc: var(--rank-${d.rank})`} aria-label={`${d.name}, ${at} of ${steps}: Go Back In`}
      onClick={() => { sfx.gate(); arena.set(d.id); }}>
      <span class="gaterow__portal ga-portal"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><Glyph name="roomEntrance" /></span>
      <span class="runcard__body">
        <b class="runcard__name">[{d.name}]</b>
        <span class="runcard__steps" aria-hidden="true">{Array.from({ length: steps }, (_, i) => <i key={i} class={i < at ? 'is-on' : i === at ? 'is-here' : ''} />)}</span>
        <small class="num">{at}/{steps}</small>
      </span>
      <span class="runcard__go">Go Back In<Glyph name="chevron" /></span>
    </button>
  );
}

/**
 * The day's Gates as a radar, after the portals scattered over Solo Leveling: Arise's city: a sweep turning over
 * its rings, the count open at its hub with the redraw under it, and a portal to each grade round it, its count
 * beside it, starred where a marked Gate stands and locked beyond the licence. A portal opens the board on its
 * grade; View All Gates opens it whole.
 */
function GateRadar({ s, gates }: { s: Save; gates: Dungeon[] }) {
  const day = dayKey();
  const named = contracts.named(s, day);
  return (
    <SysFrame kind="gates" class="gradar" tour="bands" label="Open Gates">
      <div class="gradar__scope">
        <i class="gradar__ring" /><i class="gradar__ring" /><i class="gradar__ring" />
        <i class="gradar__sweep" aria-hidden="true" />
        <span class="gradar__hub">
          <b class="num">{gates.length}</b>
          <small>Open Gates</small>
          <small class="gradar__redraw">Redraw <b class="num">{hhmmss(msUntilMidnight())}</b></small>
        </span>
        {RANKS.map((r, i) => {
          const here = gates.filter((d) => d.rank === r);
          const shut = here.length > 0 && here.every((d) => entryBlock(s, d) === 'licence');
          const marked = here.some((d) => markOf(s, d, named.has(d.id), day) && !isPractice(d));
          const a = ((-90 + i * 60) * Math.PI) / 180;
          const pos = `left: ${50 + Math.cos(a) * 39}%; top: ${50 + Math.sin(a) * 39}%; --rc: var(--rank-${r})`;
          return (
            <button type="button" key={r} class={`gradar__gate ${here.length ? '' : 'is-none'} ${shut ? 'is-shut' : ''}`} style={pos}
              aria-label={`${r}-Rank: ${here.length} open${shut ? ', beyond your licence' : ''}${marked ? ', one marked' : ''}`}
              onClick={() => { sfx.tap(); if (!here.length) toast(`No ${r}-Rank Gate opened today.`, 'warn'); else openBoard(r); }}>
              <span class="ga-portal ga-portal--mini"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><b>{r}</b></span>
              {marked && <Glyph name="star" class="gradar__mark" />}
              {shut && <Glyph name="lock" class="gradar__lock" />}
              <small class="num">{here.length}</small>
            </button>
          );
        })}
      </div>
      <button type="button" class="gradar__all" onClick={() => { sfx.tap(); openBoard('all'); }}>View All Gates<Glyph name="chevron" /></button>
    </SysFrame>
  );
}

/**
 * The hunter under the radar: their grade with the Association and, from Ascension's grade, their Ascension, as
 * two cards; their record as facts in one row that opens the dossier.
 */
function HunterRow({ s }: { s: Save }) {
  const mine = licensedRank(s);
  const holding = licenceHolding(s);
  const a = s.ascension;
  const unset = marks.unset(s);
  const told = story.seen(s, 'ascension-told');
  const entered = s.gates.clears + s.gates.fails + s.gates.withdrawn;
  return (
    <section class="ghunter" aria-label="Hunter">
      <div class="ghunter__cards">
        <button type="button" class={`ghcard is-licence ${holding && licenceRequired(s) && storeReady() ? 'is-hot' : ''}`} data-tour="licence" style={`--rc: var(--rank-${mine})`}
          onClick={() => { sfx.tap(); openGrade(); }}>
          <span class="ghcard__art"><Sigil rank={mine} size={36} /></span>
          <span class="ghcard__text">
            <small class="label">Grade</small>
            <b>{mine}-Rank</b>
            <small>{holding ? `Held at ${mine}-Rank.` : `Gates up to ${RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank.`}</small>
          </span>
        </button>
        {ascension.ascensionOpen(s) && (
          // Gold only while something waits: a mark to set, or the card not yet opened.
          <button type="button" class={`ghcard is-ascension ${unset > 0 || !told ? 'is-call' : ''}`} onClick={() => { sfx.tap(); openAscension(); }}>
            <span class="ghcard__art"><Glyph name="crown" /><b class="num">{a.level}</b></span>
            <span class="ghcard__text">
              <small class="label">Ascension</small>
              <b>{unset > 0 ? `${unset} ${unset === 1 ? 'mark' : 'marks'}` : !told ? 'New' : `${a.level}/${a.unlocked}`}</b>
              <small>{a.level ? ascension.levelInfo(a.level).name : 'The board as it stands.'}</small>
            </span>
          </button>
        )}
      </div>
      <button type="button" class="ghrecord" aria-label={`Record: entered ${entered}, cleared ${s.gates.clears}, taken ${s.gates.cleared.filter((id) => id !== 'DNG-000').length}. Open the dossier`}
        onClick={() => { sfx.tap(); openDossier(); }}>
        <span><small>Entered</small><b class="num">{entered}</b></span>
        <span><small>Cleared</small><b class="num">{s.gates.clears}</b></span>
        <span><small>Taken</small><b class="num">{s.gates.cleared.filter((id) => id !== 'DNG-000').length}</b></span>
        <span><small>Unbroken</small><b class="num">{s.gates.bestUnbroken}</b></span>
        <Glyph name="chevron" class="ghrecord__go" />
      </button>
    </section>
  );
}

/**
 * The hunter's condition at a glance, under Valcorde's line: HP, MP and Fatigue, each with its potion
 * one tap away, held or bought, and the lockout with its elixir while it holds. The System's, so its frame.
 */
function Condition() {
  return <SysFrame class="vitalstrip" label="Condition"><VitalsBlock /></SysFrame>;
}

type Band = 'all' | 'marked' | Rank;
/** The board's filter, held while the app stays open. */
let boardBand: Band = 'all';

/**
 * GATES: every Gate standing open today. Its counts across the head, a rail to filter by grade or to
 * the marked ones, then each grade as a band: what a clear there pays, and a row to each of its Gates.
 */
function openBoard(band?: Band) {
  if (band) boardBand = band;
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
  // The open Gates the hunter has walked into, ever: a Gate cleared before the list was kept counts too.
  const entered = gates.filter((d) => !isPractice(d) && (s.gates.entered.includes(d.id) || s.gates.cleared.includes(d.id))).length;
  const grades = RANKS.filter((r) => shown.some((d) => d.rank === r));
  return (
    <div class="stack gboard">
      {/* The day at a glance, read not tapped, so no box: the facts between hairlines, as the brief sets its own. */}
      <dl class="bfacts gboard__facts">
        <div><dt>Open</dt><dd class="num">{gates.length}</dd></div>
        <div><dt>Entered</dt><dd class="num">{entered}</dd></div>
        <div><dt>Closed</dt><dd class="num">{closed}</dd></div>
        <div class="is-redraw"><dt>Redraw</dt><dd class="num countdown"><Glyph name="timer" />{hhmmss(msUntilMidnight())}</dd></div>
      </dl>
      {/* The rail, as the reference games filter their stages: a portal to each grade in its colour, lit and underlined when picked. */}
      <div class="gbands" role="tablist" aria-label="Filter Gates">
        <button type="button" role="tab" aria-selected={band === 'all'} aria-label={`All, ${gates.length}`} class={`gband-tab is-all ${band === 'all' ? 'is-on' : ''}`} onClick={() => pick('all')}>
          <span class="gband-tab__ring"><b>All</b></span><small class="num">{gates.length}</small>
        </button>
        {marked > 0 && (
          <button type="button" role="tab" aria-selected={band === 'marked'} aria-label={`Marked, ${marked}`} title="Marked" class={`gband-tab is-marked ${band === 'marked' ? 'is-on' : ''}`} onClick={() => pick('marked')}>
            <span class="gband-tab__ring"><Glyph name="star" /></span><small class="num">{marked}</small>
          </button>
        )}
        {RANKS.map((r) => {
          const n = gates.filter((d) => d.rank === r).length;
          return (
            <button type="button" role="tab" key={r} aria-selected={band === r} aria-label={`${r}-Rank, ${n}`} data-rank={r} class={`gband-tab ${band === r ? 'is-on' : ''} ${n ? '' : 'is-empty'}`}
              onClick={() => { if (n) pick(r); else { sfx.tap(); toast(`No ${r}-Rank Gate opened today.`, 'warn'); } }}>
              <span class="gband-tab__ring ga-portal ga-portal--mini"><i class="ga-portal__swirl" /><i class="ga-portal__core" /><b>{r}</b></span><small class="num">{n}</small>
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
      {/* A grade is a divider, not a box: its letter in its colour, what a clear pays, how many stand open, a rule in its colour. */}
      <header class="gband__head">
        <b class="gband__rank"><span class="gband__letter">{r}</span>-Rank</b>
        <small class="gband__pay">Clear: XP <b class="num">{Math.round(GATE_XP[r] * pay)}</b> · <Shards n={shop.gateShards(r, pay)} /></small>
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
  // The boss's power once it is known, at the card's right as the reference games set a stage's recommended level.
  const might = known && boss ? powerOf(boss.base) : null;
  return (
    <li style={`--i: ${Math.min(i, 8)}`}>
      <button type="button"
        class={`sysbox gaterow ${locked ? 'is-shut' : ''} ${practice ? 'is-practice' : ''} ${cleared ? 'is-cleared' : ''} ${mark ? `is-${mark.toLowerCase()}` : ''} ${d.id === 'DNG-HOLLOW' ? 'is-monarch' : ''}`}
        onClick={() => { sfx.tap(); if (locked) toast(`Your licence does not cover ${d.rank}-Rank yet.`, 'warn'); else openBrief(d); }}>
        <span class="gaterow__portal ga-portal">
          <i class="ga-portal__swirl" /><i class="ga-portal__core" />
          {locked ? <Glyph name="lock" /> : <Glyph name={known ? 'roomBoss' : 'unknown'} />}
          {/* Cleared once: a tick on the portal's corner, the name left as it is. */}
          {cleared && !practice && <span class="gaterow__done" aria-label="Cleared"><Glyph name="check" /></span>}
        </span>
        <span class="gaterow__body">
          <span class="gaterow__name"><b>[{d.name}]</b></span>
          <small class="gaterow__boss">{locked ? `Licence: ${d.rank}-Rank` : known ? <>Boss: <span class="warn">{boss?.name}</span></> : 'Boss: ?'}</small>
          {/* The counts first, the Shadows bound and the set blueprints known, so they line up row to row; then what marks it. */}
          <span class="gaterow__tags">
            {inside.length > 0 && !practice && (
              <span class={`gtag is-shadows ${bound === inside.length ? 'is-full' : ''}`} aria-label={`Shadows bound: ${bound} of ${inside.length}`}>
                <Glyph name="shadows" /><span class="num">{bound}/{inside.length}</span>
              </span>
            )}
            {/* Its Feats: a star to each, gold once met here. */}
            {!practice && (() => {
              const met = feats.featsOf(d).filter((id) => feats.metOn(s, d).includes(id)).length;
              return (
                <span class={`gtag is-feats ${met === FEATS_PER_GATE ? 'is-full' : ''}`} aria-label={`Feats met: ${met} of ${FEATS_PER_GATE}`}>
                  {Array.from({ length: FEATS_PER_GATE }, (_, i) => <i key={i} class={i < met ? 'is-on' : ''} aria-hidden="true">★</i>)}
                </span>
              );
            })()}
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
        {locked
          ? <span aria-hidden="true" />
          : (
            <span class={`gaterow__might ${might === null ? 'is-unknown' : ''}`} aria-label={might === null ? 'Boss power unknown' : `Boss power ${might}`}>
              <Glyph name="power" /><b class="num">{might ?? '?'}</b>
            </span>
          )}
        <Glyph name="chevron" class="gaterow__go" />
      </button>
    </li>
  );
}

/** The hunter's grade with the Association: what it opens, and the licence that lifts the hold, where there is one to buy. */
function openGrade() {
  const s = store.get();
  openSheet({
    title: `Licence: ${s.hunter.regNo || '-- --'}`, system: { icon: <Sigil rank={licensedRank(s)} size={40} />, kind: 'gates' },
    render: () => {
      const s = store.get();
      const mine = licensedRank(s);
      const issued = licenceRequired(s) ? (s.licence.granted ? 'Issued' : '-- --') : 'Issued';
      return (
        <div class="stack glicence">
          {/* The licence itself, as the Association issues it: the grade's seal, the hunter, their number, the grade's letter behind. */}
          <div class="glicence__card" style={`--rc: var(--rank-${mine})`}>
            <span class="glicence__letter" aria-hidden="true">{mine}</span>
            <span class="glicence__seal"><Sigil rank={mine} size={58} /></span>
            <span class="glicence__who">
              <small class="label">Hunter</small>
              <b>{s.hunter.name}</b>
              <small class="label">Licence</small>
              <b class="num">{s.hunter.regNo || '-- --'}</b>
            </span>
          </div>
          <dl class="bfacts glicence__facts">
            <div><dt>Association grade</dt><dd>{mine}-Rank</dd></div>
            <div><dt>Gates open</dt><dd>Up to {RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank</dd></div>
            <div><dt>Rank</dt><dd>{rankOf(s).name}</dd></div>
            <div><dt>Association Licence</dt><dd>{issued}</dd></div>
          </dl>
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
      {/* Where the hunter stands, as facts between hairlines: read, not tapped, so no box. */}
      <dl class="bfacts is-grid ascension__now" data-tour="asc-now">
        <div><dt>Entering at</dt><dd><span class="status__level">{a.level}</span>{a.level ? <small>{ascension.levelInfo(a.level).name}</small> : null}</dd></div>
        <div><dt>Highest opened</dt><dd class="num">{a.unlocked}</dd></div>
        <div><dt>Foe strength</dt><dd>{foes ? <span class="warn">+{foes}%</span> : 'As the board'}</dd></div>
        <div><dt>Gate pay</dt><dd>{a.level ? <span class="grant">+{Math.round(ASCENSION_PAY * a.level * 100)}%</span> : 'As the board'}</dd></div>
      </dl>
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

async function intro() {
  await tour({
    who: 'coach', title: 'The Gates', steps: GATES_TOUR,
  });
}
