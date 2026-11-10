/**
 * The brief: the System's card on a Gate, and the way in. Its head is the Gate's portal inside the
 * assessment's ring, a tick to each of the System's runs; under it what a clear pays, one button to the
 * Seals, and what the Gate holds behind four tabs: its threat, its Feats, its map, the party. The kit and
 * the way in are docked at its foot. The Seals and the kit each open a window of their own over it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf, THROWABLES } from '@/core/combat';
import { bossKnown, dungeonById, enemyById, entryBlock, isPractice, mapKnown, rankIdx } from '@/core/gates';
import { licensedRank } from '@/core/licence';
import { RARITY } from '@/core/gear';
import * as forge from '@/core/forge';
import { ALLOYS, EMBER } from '@/data/forge';
import { MatArt, TrackMark } from '@/ui/forge';
import { GATE_XP, PRACTICE_LEVEL, practiceAward } from '@/core/progression';
import { build, mapSeed, sight } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as spire from '@/core/spire';
import * as ascension from '@/core/ascension';
import { isTrial, trialLevel } from '@/core/trial';
import * as association from '@/core/association';
import { goalOf } from '@/ui/assoc';
import { BEYOND, WALKERS } from '@/data/ascension';
import * as walkers from '@/core/walkers';
import { MapView } from '@/ui/map';
import { ItemsMark } from '@/ui/items';
import * as raid from '@/core/raid';
import { budgetOf } from '@/core/clock';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import type { Dungeon, Rank, Save } from '@/core/types';
import { dayKey, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { arena } from '@/app/router';
import * as store from '@/store';
import { createStore, useSave } from '@/store';
import { Btn, Card, RankPlate, Shards, useNow } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, THROW_GLYPH } from '@/ui/icons';
import { FamilyGlyph } from '@/ui/emblems';
import { closeAllSheets, confirm, openSheet } from '@/ui/overlays';
import { bagFor, enterGate, readyThrow } from '@/app/flow';
import * as sealing from '@/core/seals';
import * as feats from '@/core/feats';
import { SEAL_IDS, SEALS, sealEmber, type SealId } from '@/data/seals';
import { FEAT_PAY, FEATS, FEATS_PER_GATE, type FeatId } from '@/data/feats';
import { CONDITION } from '@/data/drops';
import { conditionLine, dropGlyph } from '@/ui/conditions';
import { openExchange } from './Exchange';

/** What marks a Gate on the board today: the Practice Gate, one of the Chosen holding it, Ryn's job, or a Daily Quest naming it. */
export function markOf(s: Save, d: Dungeon, quest: boolean, day: string): 'Training' | 'Chosen' | 'Association' | 'Quest' | undefined {
  if (isPractice(d)) return 'Training';
  if (walkers.walking(s, day)?.gateId === d.id) return 'Chosen';
  // The Association pins its job's Gate: Ryn's, so it carries his name for it.
  const job = association.current(s);
  if (job && !association.done(job) && job.gate === d.id) return 'Association';
  return quest ? 'Quest' : undefined;
}

// ------------------------------------------------------------------ what the brief holds between windows

type Tab = 'threat' | 'feats' | 'map' | 'party';
/** The brief's tab, held while the app stays open, as the board's filter is. */
let briefTab: Tab = 'threat';

/** The Seals set on a Gate's brief before going in, by Gate and day, held while the app stays open. */
const wanted = createStore<Record<string, SealId[]>>({});
const wantKey = (d: Dungeon) => `${d.id}|${dayKey()}`;
const inOrder = (ids: readonly SealId[]) => [...ids].sort((a, b) => SEAL_IDS.indexOf(a) - SEAL_IDS.indexOf(b));

/**
 * The Seals a brief plays. A run open on the Gate keeps the ones it walked in with, fixed; otherwise the
 * Gate's offer today and those set on it.
 */
function sealsOn(s: Save, d: Dungeon): { offer: SealId[]; taken: SealId[]; fixed: boolean } {
  const run = s.gates.raid?.dungeonId === d.id ? s.gates.raid : null;
  if (run) {
    const own = inOrder(sealing.of(run));
    return { offer: own, taken: own, fixed: true };
  }
  const offer = sealing.offered(s, d);
  return { offer, taken: inOrder((wanted.get()[wantKey(d)] ?? []).filter((id) => offer.includes(id))), fixed: false };
}

function setSeal(d: Dungeon, id: SealId, on: boolean) {
  const key = wantKey(d);
  const now = wanted.get()[key] ?? [];
  wanted.set({ ...wanted.get(), [key]: on ? [...now.filter((x) => x !== id), id] : now.filter((x) => x !== id) });
}

/** The Ember the Seals taken pay on a clear: Wardens Wake's counted, though it pays only if the Gatekeeper falls. */
const emberOf = (taken: readonly SealId[], d: Dungeon) => taken.reduce((n, id) => n + sealEmber(id, d.rank), 0);

type Proj = ReturnType<typeof raid.project>;
/** The projections made for briefs, by everything they read: the brief and the Seal window share them. */
const projections = new Map<string, Proj>();
const projKey = (s: Save, d: Dungeon, taken: readonly SealId[]) => JSON.stringify([
  d.id, dayKey(), ascension.entryLevel(s, d, isPractice(d)), taken, raid.heroSpec(s), shadows.squad(s).map((x) => x.id),
  s.gates.tactic, s.vitals.hp, s.vitals.fatigue, licensedRank(s),
]);
function remember(key: string, p: Proj) {
  projections.set(key, p);
  if (projections.size > 32) projections.delete(projections.keys().next().value!);
}

/**
 * The System's projection under the Seals given. The first is made at once. After a Seal is tapped the
 * stamp plays first, the last projection standing meanwhile, and the new one is made after it.
 */
function useProjection(s: Save, d: Dungeon, taken: readonly SealId[]): { proj: Proj; pending: boolean } {
  const key = projKey(s, d, taken);
  const last = useRef<Proj | null>(null);
  const [, bump] = useState(0);
  let hit = projections.get(key);
  if (!hit && !last.current) {
    hit = raid.project(s, d, 24, undefined, taken);
    remember(key, hit);
  }
  if (hit) last.current = hit;
  useEffect(() => {
    if (projections.has(key)) return;
    const t = setTimeout(() => {
      if (!projections.has(key)) remember(key, raid.project(store.get(), d, 24, undefined, taken));
      bump((n) => n + 1);
    }, 260);
    return () => clearTimeout(t);
  }, [key]);
  return { proj: hit ?? last.current!, pending: !hit };
}

// ------------------------------------------------------------------ marks

/** A Seal pressed in wax: a scalloped disc, its rim embossed, a keyhole at its heart. Its colour is the wax's. */
export function SealArt({ size = 24, class: cls, style }: { size?: number; class?: string; style?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`sealart ${cls ?? ''}`} style={style} aria-hidden="true">
      <path class="sealart__wax" d="M13.16 1.84Q14.32 2.58 15.69 2.47Q17.07 2.35 17.75 3.54Q18.43 4.74 19.7 5.27Q20.97 5.81 21.02 7.18Q21.07 8.56 21.95 9.62Q22.82 10.69 22.22 11.93Q21.63 13.17 21.91 14.52Q22.19 15.87 21.09 16.69Q19.98 17.51 19.61 18.83Q19.23 20.16 17.87 20.37Q16.51 20.59 15.56 21.59Q14.61 22.58 13.3 22.14Q12 21.7 10.7 22.14Q9.39 22.58 8.44 21.59Q7.49 20.59 6.13 20.37Q4.77 20.16 4.39 18.83Q4.02 17.51 2.91 16.69Q1.81 15.87 2.09 14.52Q2.37 13.17 1.78 11.93Q1.18 10.69 2.05 9.62Q2.93 8.56 2.98 7.18Q3.03 5.81 4.3 5.27Q5.57 4.74 6.25 3.54Q6.93 2.35 8.31 2.47Q9.68 2.58 10.84 1.84Q12 1.1 13.16 1.84z" />
      <circle class="sealart__rim" cx="12" cy="12" r="6.7" />
      <path class="sealart__key" d="M12 8.1a2.1 2.1 0 0 1 1.15 3.86l.75 4.04h-3.8l.75-4.04A2.1 2.1 0 0 1 12 8.1z" />
    </svg>
  );
}

/**
 * The assessment's ring: a tick to each of the System's runs, lit for each it cleared, round the clear rate
 * as an arc in the verdict's colour. With Seals taken, the rate without them stands behind it, faint.
 */
function Ring({ p, plain, r }: { p: Proj; plain: Proj; r: number }) {
  const box = 2 * r + 20;
  const c = box / 2;
  const C = 2 * Math.PI * r;
  const ticks = Array.from({ length: p.runs }, (_, i) => {
    const a = (i / p.runs) * 2 * Math.PI - Math.PI / 2 + Math.PI / p.runs;
    return { x1: c + (r + 6) * Math.cos(a), y1: c + (r + 6) * Math.sin(a), x2: c + (r + 9) * Math.cos(a), y2: c + (r + 9) * Math.sin(a) };
  });
  return (
    <svg viewBox={`0 0 ${box} ${box}`} class="aring" aria-hidden="true">
      {ticks.map((t, i) => <line key={i} {...t} class={`aring__tick ${i < p.cleared ? 'is-on' : ''}`} style={`--i: ${i}`} />)}
      <circle class="aring__track" cx={c} cy={c} r={r} />
      {plain.rate > p.rate && <circle class="aring__ghost" cx={c} cy={c} r={r} transform={`rotate(-90 ${c} ${c})`} style={`stroke-dasharray: ${C * plain.rate} ${C}`} />}
      <circle class="aring__arc" cx={c} cy={c} r={r} transform={`rotate(-90 ${c} ${c})`} style={`stroke-dasharray: ${C * p.rate} ${C}`} />
    </svg>
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
  wanted.use();
  const day = dayKey();
  const trial = isTrial(d);
  const practice = isPractice(d);
  const tower = spire.isSpire(d);
  // A Trial is fought at the level it proves, whatever is chosen: the party, the pay and the rules shown are that level's.
  const level = ascension.entryLevel(s, d, practice);
  const { offer, taken, fixed } = sealsOn(s, d);
  // The verdict is the engine answering for itself: the Gate, run headlessly, under the Seals taken; and without them, behind.
  const { proj, pending } = useProjection(s, d, taken);
  const { proj: plain } = useProjection(s, d, []);
  const map = build(d, mapSeed(d, day));
  const v = raid.verdict(proj.rate);
  const rate = Math.round(proj.rate * 100);
  const plainRate = Math.round(plain.rate * 100);
  const block = entryBlock(s, d);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const hpNow = vitals.read(s);
  const pay = ascension.payShare(level);
  const steps = raid.stepsOf(map);
  const depth = trial ? `${steps} Chosen · no rest between them`
    : tower ? `${steps} floors · a rest, then the boss`
    : `${steps} rooms · ${map.floors.length > 1 ? `${map.floors.length} floors · ` : ''}${proj.road.length} to the boss${map.tower || practice ? '' : ` · ${budgetOf(map)} moves`}`;
  const cleared = s.gates.cleared.includes(d.id);
  const mark = markOf(s, d, contracts.named(s, day).has(d.id), day);

  // Feats on a Gate of the board alone; the tabs a Gate has, each with its count.
  const hasFeats = !practice && !tower && !trial;
  const met = hasFeats ? feats.featsOf(d).filter((id) => feats.metOn(s, d).includes(id)).length : 0;
  const tabs: { id: Tab; name: string; read: ComponentChildren }[] = [
    { id: 'threat', name: 'Threat', read: <><Glyph name="skull" /><span class="num">{threatCount(s, d)}</span></> },
    ...(hasFeats ? [{ id: 'feats' as Tab, name: 'Feats', read: <span class="btabs__stars" aria-label={`${met} of ${FEATS_PER_GATE} met`}>{Array.from({ length: FEATS_PER_GATE }, (_, i) => <i key={i} class={i < met ? 'is-on' : ''}>★</i>)}</span> }] : []),
    { id: 'map', name: 'Map', read: mapKnown(s, d) ? <><Glyph name="steps" /><span class="num">{steps}</span></> : <span class="num">?</span> },
    { id: 'party', name: 'Party', read: <span class="num">{partyPower(s, d, level, taken)}</span> },
  ];
  const [tab, setTabState] = useState<Tab>(tabs.some((t) => t.id === briefTab) ? briefTab : 'threat');
  const [dir, setDir] = useState(0);
  const at = Math.max(0, tabs.findIndex((t) => t.id === tab));
  const pick = (id: Tab) => {
    if (id === tab) return;
    sfx.tap();
    setDir(tabs.findIndex((t) => t.id === id) > at ? 1 : -1);
    briefTab = id;
    setTabState(id);
  };

  const abandon = async () => {
    const run = store.get().gates.raid;
    if (!run || !(await confirm('Abandon the run?', 'You will be carried out. Nothing banked on this run is kept.', 'Abandon', true))) return;
    store.update((x) => raid.finish(x, d, x.gates.raid!, 'defeated'));
    close();
  };

  return (
    <div class={`stack brief ${trial ? 'is-trial' : ''}`} style={`--rc: ${trial ? 'var(--gold)' : `var(--rank-${d.rank})`}`}>
      {/* The head: the Gate's portal inside the assessment's ring, its grade, the verdict and the road's length. */}
      <header class={`bhero ${pending ? 'is-pending' : ''} ${taken.length ? 'is-sealed' : ''}`} data-tone={v.tone} data-tour="assess"
        aria-label={`Assessment: ${v.text}. Clear rate ${rate}%${taken.length && plainRate !== rate ? `, ${plainRate}% without the Seals` : ''}.`}>
        <span class="bhero__ring">
          <Ring p={proj} plain={plain} r={44} />
          <span class="bhero__portal ga-portal" aria-hidden="true">
            <i class="ga-portal__swirl" /><i class="ga-portal__core" />
            <RankPlate rank={d.rank} size={32} />
          </span>
          <b class="bhero__pct num" aria-hidden="true">{rate}<small>%</small></b>
        </span>
        <span class="bhero__body">
          <span class="label bhero__grade">{trial ? 'Trial of Ascension' : tower ? `${d.rank}-Rank floors` : `${d.rank}-Rank Gate`}</span>
          <b class="bhero__assess">{v.text}</b>
          {/* The ring's ticks, counted; under Seals that move it, the rate without them and with them. */}
          <small class="bhero__rate">{taken.length && plainRate !== rate
            ? <>Clear rate: <span class="bhero__was num">{plainRate}%</span> → <b class="num">{rate}%</b></>
            : <>Runs cleared: <b class="num">{proj.cleared}/{proj.runs}</b></>}</small>
          <small class="bhero__depth"><Glyph name={trial ? 'crown' : tower ? 'spire' : 'steps'} />{depth}</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small class="bhero__hp">HP: <span class="num">{hpNow.hp}/{hpNow.hpMax}</span></small>}
        </span>
      </header>

      {/* The file and the chips under the head: the Association's on a Gate, the System's own terms on a Trial. */}
      <File d={d} />
      <span class="bhero__tags">
        {!trial && !tower && !practice && <span class={`gtag ${cleared ? 'is-done' : 'is-bounty'}`}>{cleared ? 'Cleared' : 'Never cleared'}</span>}
        {mark && <span class={`gtag is-${mark.toLowerCase()}`}>{mark}</span>}
        {level > 0 && <span class="gtag is-ascension">Ascension {level}</span>}
        {trial && <><span class="gtag">Rest: None</span><span class="gtag">Withdrawal: Not possible</span><span class="gtag">Allies: None</span></>}
      </span>
      {level > 0 && (
        <p class="basc"><Glyph name="crown" /><span>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''} · <span class="grant">Pay +{Math.round((pay - 1) * 100)}%</span></span></p>
      )}

      <PayStrip d={d} level={level} taken={taken} />

      {/* The Seals: one button, its wax lit for each taken, opening their window. */}
      {offer.length > 0 && <SealButton d={d} offer={offer} taken={taken} fixed={fixed} />}

      {/* What the Gate holds, a tab to each, its count under its name. */}
      <div class="btabs" role="tablist" aria-label="Brief" style={`--n: ${tabs.length}; --at: ${at}`}>
        {tabs.map((t) => (
          <button type="button" key={t.id} role="tab" id={`btab-${t.id}`} aria-selected={t.id === tab} aria-controls="btab-panel"
            class={`btabs__one ${t.id === tab ? 'is-on' : ''}`} onClick={() => pick(t.id)}>
            <b>{t.name}</b><small>{t.read}</small>
          </button>
        ))}
      </div>
      <div class="btab-panel" id="btab-panel" role="tabpanel" aria-labelledby={`btab-${tab}`} key={tab} style={`--dir: ${dir}`}>
        {tab === 'threat' && <ThreatPanel d={d} level={level} />}
        {tab === 'feats' && <FeatList d={d} met={feats.metOn(s, d)} odds={proj.feats} runs={proj.runs} />}
        {tab === 'map' && <MapPanel d={d} road={proj.road} />}
        {tab === 'party' && <PartyPanel d={d} level={level} taken={taken} />}
      </div>

      {/* The way in stays at the foot of the window, the kit beside it, whatever is scrolled past. */}
      <div class="bdock">
        {block === 'open' ? open?.id === d.id
          ? <div class="row"><Btn onClick={abandon}>Abandon</Btn><Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => { closeAllSheets(); arena.set(d.id); }}>Go Back In</Btn></div>
          : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
          : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
          : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
            : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
              : (
                <div class="bdock__row">
                  <KitButton d={d} />
                  <Btn kind={trial ? 'gold' : 'primary'} size="lg" class="grow bdock__go" onClick={() => void enterGate(d, taken)} sound="none" tour="enter">
                    {trial ? 'Enter The Trial' : 'Enter The Gate'}
                  </Btn>
                </div>
              )}
      </div>
    </div>
  );
}

/** The creatures a brief counts: the kinds that walk in the Gate, and its boss once it is known. */
function threatCount(s: Save, d: Dungeon) {
  return new Set([...d.mobs, ...(d.elite ? [d.elite] : []), ...(bossKnown(s, d) ? [d.boss] : [])]).size;
}

/** Who walks in, and their power together: the hunter, the Association's hunters, the Shadows. */
function partyOf(s: Save, d: Dungeon, level: number, taken: readonly SealId[]) {
  return {
    hero: raid.heroSpec(s),
    party: raid.alliesAt(d, dayKey(), licensedRank(s), level, taken),
    squad: isPractice(d) ? [] : shadows.squad(s),
  };
}
function partyPower(s: Save, d: Dungeon, level: number, taken: readonly SealId[]) {
  const { hero, party, squad } = partyOf(s, d, level, taken);
  return powerOf(hero.base) + party.reduce((n, a) => n + powerOf(a.base), 0) + squad.reduce((n, x) => n + shadows.power(x), 0);
}

/** The Association's file, two lines until tapped. The Trial is the System's own: it states its terms. */
function File({ d }: { d: Dungeon }) {
  const [full, setFull] = useState(false);
  if (isTrial(d)) return <p class="bfile is-full">{d.trial} of the Chosen, in a row.</p>;
  return (
    <button type="button" class={`bfile ${full ? 'is-full' : ''}`} aria-expanded={full} onClick={() => { sfx.tap(); setFull(!full); }}>
      <span class="label">Association file:</span> {d.theme}
    </button>
  );
}

/**
 * What a clear pays, a tile to each, in one row: the clear, the bounty while it has never been cleared (the
 * Spire's week, the Trial's level), the Gate's materials, and the Ember the Seals taken add.
 */
function PayStrip({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const trial = isTrial(d);
  const practice = isPractice(d);
  const tower = spire.isSpire(d);
  const pay = ascension.payShare(level);
  const sh = Math.round(shop.GATE_SHARDS[d.rank as Rank] * pay);
  const xp = practice ? practiceAward(s) : Math.round(GATE_XP[d.rank as Rank] * pay);
  const first = !tower && !trial && !practice && !s.gates.cleared.includes(d.id);
  const alloy = practice ? ALLOYS.E : ALLOYS[d.rank as Rank];
  const sets = raid.homeSets(d);
  const tracked = practice || trial ? [] : forge.trackedAt(s, d, level);
  const ember = emberOf(taken, d);
  return (
    <div class={`bpay ${1 + Number(first) + Number(trial || tower) + 1 + Number(taken.length > 0) >= 4 ? 'is-crowded' : ''}`} aria-label="Pay">
      <span class="sysbox bpay__one">
        <small class="label">Clear</small>
        <b class="num">XP +{xp}</b>
        <small>{practice ? `enough for Level ${PRACTICE_LEVEL}` : <Shards n={sh} />}</small>
      </span>
      {first && (
        <span class="sysbox bpay__one is-bounty">
          <small class="label">Bounty</small>
          <b class="num">XP +{xp}</b>
          <small><Shards n={sh * 2} /> once</small>
        </span>
      )}
      {trial && <span class="sysbox bpay__one"><small class="label">Opens</small><b>Ascension {s.ascension.unlocked + 1}</b><small>if you win it</small></span>}
      {tower && <span class="sysbox bpay__one"><small class="label">This week</small><b>Floor {spire.lastFloor(spire.blockOf(d.floor ?? 1))}</b><small>a new best, if you clear it</small></span>}
      <span class={`sysbox bpay__one is-mat ${tracked.length ? 'is-tracked' : ''}`}
        aria-label={tracked.length ? `Tracked materials here: ${tracked.map((id) => forge.materialById(id)?.name).join(', ')}` : undefined}>
        <small class="label">Materials</small>
        <b class="bpay__mat"><MatArt id={alloy.id} size={20} />{alloy.name}</b>
        <small>{practice ? 'and a ring' : sets.length ? `${forge.trophyTable().get(d.shape ?? d.id)?.name ?? 'a trophy'} · ${sets.map((x) => x.id).join(' or ')} blueprints` : first ? 'and a blueprint' : 'a blueprint, sometimes'}</small>
        {tracked.length > 0 && (
          <span class="bpay__tracked">
            <TrackMark class="bpay__trackmark" />
            {tracked.map((id) => <MatArt key={id} id={id} size={16} />)}
          </span>
        )}
      </span>
      {taken.length > 0 && (
        <span class="sysbox bpay__one is-ember" key="ember">
          <small class="label">Seals</small>
          <b class="bpay__mat num"><MatArt id={EMBER.id} size={20} />+{ember}</b>
          <small>{EMBER.name}</small>
        </span>
      )}
    </div>
  );
}

/** The Seals' button: their wax, lit for each taken, what they are, and the Ember they add to a clear. */
function SealButton({ d, offer, taken, fixed }: { d: Dungeon; offer: SealId[]; taken: SealId[]; fixed: boolean }) {
  const ember = emberOf(taken, d);
  return (
    <button type="button" class={`bsealbtn ${taken.length ? 'is-on' : ''}`} aria-haspopup="dialog" data-tour="seals"
      onClick={() => { sfx.tap(); openSeals(d); }}>
      <span class="bsealbtn__wax" aria-hidden="true">
        {offer.map((id, i) => <SealArt key={id} size={30} class={taken.includes(id) ? 'is-on' : ''} style={`--i: ${i}`} />)}
      </span>
      <span class="bsealbtn__body">
        <b>{taken.length ? `Sealed: ${taken.map((id) => SEALS[id].name).join(', ')}` : 'Seal The Gate'}</b>
        <small>{taken.length ? <>{fixed ? 'Fixed for this run' : 'Clear'}: <span class="grant">Ember +{ember}</span></> : <>Offered: <span class="num">{offer.length}</span> · Pay: Ember</>}</small>
      </span>
      <Glyph name="chevron" class="bsealbtn__go" />
    </button>
  );
}

// ------------------------------------------------------------------ the tabs

/** What stands in the Gate: the boss, one of the Chosen if it holds the Gate today, and the rest of what walks there. */
function ThreatPanel({ d, level }: { d: Dungeon; level: number }) {
  const s = useSave();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  const walker = walkers.walking(s, dayKey());
  const holds = walker?.gateId === d.id ? walker : null;
  const met = holds && level >= holds.level ? walkers.walkerOf(holds.level, d.rank as Rank) : null;
  // Its creatures and its Gatekeeper, named once the hunter has been inside, as the map is; the violet ones serve as Shadows.
  const inside = [...new Set([...d.mobs, ...(d.elite ? [d.elite] : [])])].map((id) => enemyById(id)).filter((e): e is NonNullable<ReturnType<typeof enemyById>> => !!e);
  const seen = mapKnown(s, d);
  const counted = [...inside, ...(known ? [boss] : [])];
  const bound = counted.filter((e) => shadows.isBound(s, e.id)).length;
  // The job Ryn gave for this Gate, if one is in hand: the interface saying what it is.
  const job = association.current(s);
  const assoc = job && !association.done(job) && ((job.kind !== 'hunt' && job.gate === d.id) || (job.kind === 'hunt' && d.mobs.includes(job.target ?? ''))) ? job : null;
  return (
    <>
      {assoc && <p class="hint assochint">Association Quest: {goalOf(assoc)} <span class="num">{assoc.got}/{assoc.need}</span></p>}
      <Card class="bosscard" tour="boss">
        {known || met ? <FamilyGlyph family={(met ?? boss).family} size={40} /> : <Glyph name="unknown" />}
        <div class="grow">
          <span class="label">{met ? 'In the boss’s place' : isTrial(d) ? 'The last of the Chosen' : `Gate boss${known ? '' : ': unidentified'}`}</span>
          <b>{met ? met.name : known ? boss.name : '?'}</b>
          <small class="muted">{met ? `${met.rank}-Rank ${met.family} · ${met.role} · Power ${powerOf(met.base)}` : known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · Power ${powerOf(boss.base)}` : '?'}</small>
          {known && !met && <small class="bthreat__drop"><Glyph name={dropGlyph(boss.id, true)} />{conditionLine(boss.id, true)}</small>}
        </div>
        {known && !met && shadows.isBound(s, boss.id) && <span class="bthreat__bound" title="Serves as a Shadow"><Glyph name="shadows" /></span>}
      </Card>
      {holds && <ChosenCard d={d} w={holds} level={level} />}
      {!isTrial(d) && inside.length > 0 && (
        <div class="bthreat">
          {inside.map((e, i) => (
            <span key={e.id} class={`sysbox bthreat__one ${seen && shadows.isBound(s, e.id) ? 'is-bound' : ''} ${e.id === d.elite ? 'is-elite' : ''}`} style={`--i: ${i}`}>
              {seen ? <FamilyGlyph family={e.family} size={16} /> : <Glyph name="unknown" />}
              <span class="bthreat__name">
                <b>{seen ? e.name : '?'}</b>
                <small>{e.id === d.elite ? 'Gatekeeper' : seen ? `${e.rank}-Rank ${e.family}` : 'Unidentified'}</small>
                {seen && raid.conditionOf(e.id, false) && <small class="bthreat__drop"><Glyph name={dropGlyph(e.id, false)} />{CONDITION[raid.conditionOf(e.id, false)!].text}</small>}
              </span>
              {seen && shadows.isBound(s, e.id) && <Glyph name="shadows" class="bthreat__mark" />}
            </span>
          ))}
        </div>
      )}
      {!isPractice(d) && !isTrial(d) && counted.length > 0 && (
        <p class="bthreat__sum"><Glyph name="shadows" />Shadows bound: <span class="num">{bound}/{counted.length}</span></p>
      )}
    </>
  );
}

/** One of the Chosen holding the Gate in the brief: when it shows itself, and what felling it pays. */
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

/**
 * A Gate's three Feats, a star to each: gold once met here. Each says what it asks, how often the System
 * met it in its runs on today's map, and, until it is met, what it pays the first time.
 */
function FeatList({ d, met, odds, runs }: { d: Dungeon; met: FeatId[]; odds: Partial<Record<FeatId, number>>; runs: number }) {
  return (
    <div class="bfeats" aria-label="Feats">
      {feats.featsOf(d).map((id, i) => {
        const done = met.includes(id);
        const n = odds[id] ?? 0;
        return (
          <div key={id} class={`sysbox bfeat ${done ? 'is-done' : ''}`} style={`--i: ${i}; --odds: ${runs ? n / runs : 0}`}>
            <Glyph name="star" class="bfeat__star" />
            <span class="bfeat__body">
              <b>{FEATS[id].name}</b>
              <small>{FEATS[id].text}</small>
              <span class="bfeat__odds" aria-hidden="true"><i /></span>
            </span>
            <span class="bfeat__side">
              <small class="num" aria-label={`The System met it in ${n} of ${runs} runs`}>System {n}/{runs}</small>
              <small class={done ? 'muted' : 'grant'}>{done ? 'Met' : `Blueprint +${FEAT_PAY.blueprints}`}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Today's map through its fog, a floor at a time, the System's road along it and the bag at its corner. Unidentified until the hunter has been inside. */
function MapPanel({ d, road }: { d: Dungeon; road: string[] }) {
  const s = useSave();
  const day = dayKey();
  const map = build(d, mapSeed(d, day));
  const [floor, setFloor] = useState(0);
  const onIt = s.gates.raid?.dungeonId === d.id && s.gates.raid.map === mapSeed(d, day) ? s.gates.raid : null;
  const fog = map.tower ? undefined : onIt ? raid.seen(s, d, onIt) : sight(map, new Set(), raid.remembered(s, mapSeed(d, day)));
  // The bag: a Gate Survey from it charts every room, before the hunter goes in or after. A tower has no plan to chart.
  const bag = map.tower ? null : <ItemsMark items={bagFor(s, d)} />;
  return (
    <>
      <div class="section__head"><span class="label">Today’s map</span><span class="section__right">{mapKnown(s, d) ? <>Redraw: <span class="num">{hhmmss(msUntilMidnight())}</span></> : 'Unidentified'}</span></div>
      {mapKnown(s, d)
        ? <MapView m={map} road={road} seen={fog} floor={floor} onFloor={map.floors.length > 1 ? setFloor : undefined} corner={bag} compact />
        : (
          <div class="gmap-fogwrap">
            <div class="gmap-fog" role="img" aria-label="Map unidentified"><Glyph name="unknown" /><b>?</b></div>
            {bag && <span class="gmap-fog__corner">{bag}</span>}
          </div>
        )}
    </>
  );
}

/** The party, a card each, after a squad's roster: who walks in, and their power together. */
function PartyPanel({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const { hero, party, squad } = partyOf(s, d, level, taken);
  return (
    <>
      <div class="section__head"><span class="label">{isTrial(d) ? 'Entering' : 'Your party'}</span><span class="section__right">Power <b class="num">{partyPower(s, d, level, taken)}</b></span></div>
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
    </>
  );
}

// ------------------------------------------------------------------ the Seals' window

/** The Seals' window, over the brief: the assessment as it stands, the Ember they add, and a card to each Seal offered. */
function openSeals(d: Dungeon) {
  openSheet({
    title: `Seals: ${d.name}`,
    system: { icon: <SealArt size={34} class="is-on" />, kind: 'gates' },
    render: (close) => <SealSheet d={d} close={close} />,
  });
}

function SealSheet({ d, close }: { d: Dungeon; close: () => void }) {
  const s = useSave();
  wanted.use();
  const { offer, taken, fixed } = sealsOn(s, d);
  const { proj, pending } = useProjection(s, d, taken);
  const { proj: plain } = useProjection(s, d, []);
  // The Seal just pressed plays its stamp; one given back lifts.
  const [pressed, setPressed] = useState<{ id: SealId; on: boolean } | null>(null);
  const v = raid.verdict(proj.rate);
  const rate = Math.round(proj.rate * 100);
  const plainRate = Math.round(plain.rate * 100);
  const ember = emberOf(taken, d);
  const most = emberOf(offer, d);
  const toggle = (id: SealId) => {
    if (fixed) return;
    const on = !taken.includes(id);
    setSeal(d, id, on);
    setPressed({ id, on });
    if (on) { sfx.stamp(); buzz([10, 24, 34]); } else { sfx.blip(); buzz(8); }
  };
  return (
    <div class="stack sealsheet">
      {/* The gauge: the ring and the verdict as they stand under the Seals taken, and the Ember they add, a share of the bar to each. */}
      <section class={`sysbox sgauge ${pending ? 'is-pending' : ''}`} data-tone={v.tone} aria-live="polite"
        aria-label={`Assessment: ${v.text}. Clear rate ${rate}%. Ember on a clear: ${ember}.`}>
        <span class="sgauge__ring">
          <Ring p={proj} plain={plain} r={30} />
          <b class="num">{rate}<small>%</small></b>
        </span>
        <span class="sgauge__body">
          <span class="label">Assessment</span>
          <b class="sgauge__verdict">{v.text}</b>
          <small>Clear rate: {plainRate !== rate ? <><span class="bhero__was num">{plainRate}%</span> → <b class="num">{rate}%</b></> : <b class="num">{rate}%</b>}</small>
        </span>
        <span class="sgauge__ember">
          <MatArt id={EMBER.id} size={30} />
          <b class="num" key={ember}>+{ember}</b>
          <small>Ember</small>
        </span>
        <span class="sgauge__bar" aria-hidden="true">
          {offer.map((id) => <i key={id} class={taken.includes(id) ? 'is-on' : ''} style={`flex-grow: ${sealEmber(id, d.rank)}`} />)}
          <small class="num">{ember}/{most}</small>
        </span>
      </section>

      <ul class="sealcards">
        {offer.map((id, i) => {
          const on = taken.includes(id);
          const x = SEALS[id];
          const just = pressed?.id === id;
          return (
            <li key={id} style={`--i: ${i}`}>
              <button type="button" role="switch" aria-checked={on} disabled={fixed}
                class={`sysbox sealcard ${on ? 'is-on' : ''} ${just ? (pressed!.on ? 'is-stamped' : 'is-lifted') : ''}`}
                onClick={() => toggle(id)}>
                <span class="sealcard__slot" aria-hidden="true">
                  <SealArt size={44} class={on ? 'is-on' : ''} />
                  {just && pressed!.on && <i class="sealcard__ripple" />}
                </span>
                <span class="sealcard__body">
                  <b>{x.name}</b>
                  <small class="sealcard__rule">{x.rule}</small>
                  <small class="sealcard__pay"><MatArt id={EMBER.id} size={14} />Ember +{sealEmber(id, d.rank)}{x.note ? <span class="muted"> · {x.note}</span> : null}</small>
                </span>
                <span class="sealcard__state">{on ? <><Glyph name="lock" />Sealed</> : 'Open'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Btn kind="primary" block onClick={close}>{fixed ? 'Close' : 'Done'}</Btn>
    </div>
  );
}

// ------------------------------------------------------------------ the kit

/** The kit, docked by the way in: the satchel's Health Potions and the throwable readied, each with its count. It opens the kit's window. */
function KitButton({ d }: { d: Dungeon }) {
  const s = useSave();
  const now = shop.readied(s);
  const kind = THROWABLES.find((k) => k.id === now);
  const hp = shop.held(s, 'hp');
  return (
    <button type="button" class="bkit" aria-haspopup="dialog"
      aria-label={`Kit: Health Potion ${hp} of ${shop.satchelMax(s)}${kind ? `, ${kind.name} readied, ${shop.held(s, kind.id)} held` : ', nothing readied to throw'}`}
      onClick={() => { sfx.tap(); openKit(d); }}>
      <span class={`bkit__one is-hp ${hp ? '' : 'is-none'}`}><Glyph name="potion" /><b class="num">{hp}</b></span>
      <span class={`bkit__one is-throw ${kind ? '' : 'is-none'}`}><Glyph name={kind ? THROW_GLYPH[kind.id] : 'flash'} /><b class="num">{kind ? shop.held(s, kind.id) : 0}</b></span>
    </button>
  );
}

function openKit(d: Dungeon) {
  openSheet({ title: `Kit: ${d.name}`, system: { icon: <Glyph name="satchel" />, kind: 'gates' }, render: (close) => <KitSheet d={d} close={close} /> });
}

/**
 * The kit taken in: the satchel's Health Potions, with the Exchange while it has room, and a chip to each
 * throwable, the one readied lit. The action wheel throws only that one inside.
 */
function KitSheet({ d, close }: { d: Dungeon; close: () => void }) {
  const s = useSave();
  const run = s.gates.raid?.dungeonId === d.id ? s.gates.raid : null;
  const now = run ? run.throw ?? null : shop.readied(s);
  return (
    <div class="stack kitsheet">
      <section class="sysbox kitsheet__satchel">
        <span class="kitsheet__art"><Glyph name="potion" /></span>
        <span class="grow">
          <strong>[Item: Health Potion]</strong>
          <small><span class="grant">HP +{shop.POTION_RESTORE * 100}%</span></small>
        </span>
        <span class="kitsheet__held">
          <b class="num">{shop.held(s, 'hp')}/{shop.satchelMax(s)}</b>
          <span class="kitsheet__pips" aria-hidden="true">{Array.from({ length: shop.satchelMax(s) }, (_, i) => <i key={i} class={i < shop.held(s, 'hp') ? 'is-on' : ''} />)}</span>
          <small>Satchel</small>
        </span>
        {shop.satchelRoom(s) > 0 && <Btn size="sm" block class="kitsheet__go" onClick={() => { closeAllSheets(); openExchange(); }}>To The Exchange</Btn>}
      </section>
      <section class="bthrow">
        <span class="label">Throw</span>
        <span class="bthrow__kit" role="radiogroup" aria-label="Throwable readied">
          {THROWABLES.map((k) => {
            const n = shop.held(s, k.id);
            return (
              <button type="button" key={k.id} role="radio" aria-checked={k.id === now} aria-label={`${k.name}, ${n} held`}
                class={`sysbox bthrow__one ${k.id === now ? 'is-on' : ''}`} disabled={!!run || n <= 0} onClick={() => readyThrow(k.id)}>
                <Glyph name={THROW_GLYPH[k.id]} />
                <span class="bthrow__name"><b>{k.name}</b><small>{k.id === now ? 'Readied' : n > 0 ? 'Ready' : 'None held'}</small></span>
                <b class="num bthrow__n">{n}</b>
              </button>
            );
          })}
        </span>
      </section>
      <Btn kind="primary" block onClick={close}>Done</Btn>
    </div>
  );
}
