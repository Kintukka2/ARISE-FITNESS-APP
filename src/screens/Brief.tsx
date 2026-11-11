/**
 * The brief: the System's card on a Gate, and the way in. Its head is the Gate's portal inside the
 * assessment's ring, a tick to each of the System's runs; under it what a clear pays, one button to the
 * Seals, and what the Gate holds behind four tabs: its threat, its Feats, its map, the party. The kit and
 * the way in are docked at its foot. The Seals and the kit each open a window of their own over it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf } from '@/core/combat';
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
import { Btn, RankPlate, useNow } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, Shard, Sigil } from '@/ui/icons';
import { FamilyGlyph } from '@/ui/emblems';
import { closeAllSheets, confirm, openSheet } from '@/ui/overlays';
import { bagFor, enterGate } from '@/app/flow';
import * as sealing from '@/core/seals';
import * as feats from '@/core/feats';
import { SEAL_IDS, SEALS, sealEmber, type SealId } from '@/data/seals';
import { TRICKS, tricksOf } from '@/data/tricks';
import { FEAT_PAY, FEATS, FEATS_PER_GATE, type FeatId } from '@/data/feats';
import { conditionLine, dropGlyph } from '@/ui/conditions';
import { drinkFlow } from './Inventory';

/**
 * The Seal button's line while none is taken: what Sealing does, the interface's, at the owner's call
 * (VOICE.md, the brief). The rules themselves are the Guide's.
 */
const SEAL_LINE = 'Sealing a Gate will make it harder to clear, but you will receive additional rewards.';

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
/** Whether the Seals' window stands over the brief: the brief's head holds its reading until it closes. */
const sealWindow = createStore(false);

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

/** A figure that counts its way to a new value, eased as the ring's arc is; it stands still at first. */
function useTween(to: number, ms = 720): number {
  const [v, setV] = useState(to);
  const at = useRef(to);
  useEffect(() => {
    const from = at.current;
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const x = from + (to - from) * (1 - (1 - k) ** 3);
      at.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

// ------------------------------------------------------------------ the brief

/** The brief: the System's card on a Gate, in the Gates' orange. A Trial is advancement, so its card is gold. */
export function openBrief(d: Dungeon) {
  const trial = isTrial(d);
  openSheet({
    title: trial ? `Trial: Ascension ${trialLevel(d) + 1}` : `Gate: ${d.name}`,
    system: trial ? { icon: <Glyph name="cert" />, kind: 'gold' } : { icon: <RankPlate rank={d.rank} size={40} />, kind: 'gates' },
    banner: () => <Banner d={d} />,
    render: (close) => <Brief d={d} close={close} />,
  });
}

/**
 * The brief's banner, at its top: the hunter, their level and grade, the bag, and their condition, HP, MP
 * and Fatigue, each with its potion one tap away, so what they walk in with is seen and settled first.
 */
function Banner({ d }: { d: Dungeon }) {
  const s = useSave();
  return (
    <div class="bbanner">
      <span class="bbanner__who">
        <span class="sysbox bbanner__sigil"><Sigil rank={licensedRank(s)} size={30} /></span>
        <span class="bbanner__name">
          <b>{s.hunter.name}</b>
          <small>Level <span class="num">{s.hunter.level}</span> · {licensedRank(s)}-Rank Hunter</small>
        </span>
        {/* The bag: the potions, a Gate Survey, and the throwable to ready for the Gate; a run's own while one is open on it. */}
        <span class="bbanner__bag"><ItemsMark items={bagFor(s, d)} /></span>
      </span>
      <Vitals />
    </div>
  );
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
  // While the Seals' window stands over the brief, the head holds what it read. As the window closes it
  // sweeps to what the System reads now: the ring's arc and its figure count there together, and the
  // verdict and its colour change as the figure passes each grade.
  const sealing = sealWindow.use();
  const [held, setHeld] = useState<{ proj: Proj; plain: Proj; sealed: boolean } | null>(null);
  const wasSealing = useRef(sealing);
  useEffect(() => {
    if (sealing && !wasSealing.current) setHeld({ proj, plain, sealed: taken.length > 0 });
    wasSealing.current = sealing;
    if (sealing) return;
    const t = setTimeout(() => setHeld(null), 380);
    return () => clearTimeout(t);
  }, [sealing]);
  const shown = held ?? { proj, plain, sealed: taken.length > 0 };
  const figure = useTween(shown.proj.rate * 100);
  const v = raid.verdict(figure / 100);
  const rate = Math.round(figure);
  const plainRate = Math.round(shown.plain.rate * 100);
  const block = entryBlock(s, d);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const hpNow = vitals.read(s);
  const steps = raid.stepsOf(map);
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
      {/*
        The head: the Gate's portal inside the assessment's ring, the verdict under it; beside them its grade and
        its name, the Association's file and its chips.
      */}
      <header class={`bhero ${pending && !held ? 'is-pending' : ''} ${shown.sealed ? 'is-sealed' : ''}`} data-tone={v.tone} data-tour="assess">
        <span class="bhero__side">
          <span class="bhero__ring" role="img" aria-label={`Assessment: ${v.text}. Clear rate ${rate}%${shown.sealed && plainRate !== rate ? `, ${plainRate}% without the Seals` : ''}.`}>
            <Ring p={shown.proj} plain={shown.plain} r={44} />
            <span class="bhero__portal ga-portal" aria-hidden="true">
              <i class="ga-portal__swirl" /><i class="ga-portal__core" />
              <RankPlate rank={d.rank} size={32} />
            </span>
            <b class="bhero__pct num" aria-hidden="true">{rate}<small>%</small></b>
          </span>
          <b class="bhero__assess">{v.text}</b>
        </span>
        <span class="bhero__body">
          <h3 class="bhero__title"><span class="label bhero__grade">{trial ? 'Trial of Ascension' : tower ? `${d.rank}-Rank floors` : `${d.rank}-Rank Gate`}:</span> {trial ? `Ascension ${trialLevel(d) + 1}` : d.name}</h3>
          <File d={d} />
          <span class="bhero__tags">
            {!trial && !tower && !practice && <span class={`gtag ${cleared ? 'is-done' : 'is-fresh'}`}>{cleared ? 'Cleared' : 'Never cleared'}</span>}
            {mark && <span class={`gtag is-${mark.toLowerCase()}`}>{mark}</span>}
            {level > 0 && <span class="gtag is-ascension">Ascension {level}</span>}
            {trial && <><span class="gtag">Rest: None</span><span class="gtag">Withdrawal: Not possible</span><span class="gtag">Allies: None</span></>}
          </span>
        </span>
        {level > 0 && (
          <p class="basc"><Glyph name="crown" /><span>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''}</span></p>
        )}
      </header>

      <Objectives d={d} level={level} taken={taken} />
      <Rewards d={d} level={level} taken={taken} />

      {/* The Seals: one button, its wax lit for each taken, opening their window. */}
      {offer.length > 0 && <SealButton d={d} offer={offer} taken={taken} fixed={fixed} />}

      {/* What the Gate holds, in one box: a tab to each, its count under its name, and the one shown under them. */}
      <section class="bbox btabbox">
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
      </section>

      {/* The way in stays at the foot of the window, whatever is scrolled past. */}
      <div class="bdock">
        {block === 'open' ? open?.id === d.id
          ? <div class="row"><Btn onClick={abandon}>Abandon</Btn><Btn kind="primary" size="lg" class="grow" sound="gate" onClick={() => { closeAllSheets(); arena.set(d.id); }}>Go Back In</Btn></div>
          : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
          : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
          : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
            : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
              : (
                <Btn kind={trial ? 'gold' : 'primary'} size="lg" block onClick={() => void enterGate(d, taken)} sound="none" tour="enter">
                  {trial ? 'Enter The Trial' : 'Enter The Gate'}
                </Btn>
              )}
      </div>
    </div>
  );
}

/**
 * The hunter's condition in the banner: HP, MP and Fatigue, a thin bar and the figure each, and a +
 * that drinks the potion for it at once, held or bought (a purchase asked first, as the Exchange asks).
 */
function Vitals() {
  const s = useSave();
  const v = vitals.read(s);
  const one = (id: shop.PotionId, name: string, cur: number, max: number, tone: string, text: ComponentChildren) => {
    const p = shop.POTIONS.find((x) => x.id === id)!;
    const idle = shop.potionIdle(s, id);
    const have = shop.held(s, id);
    return (
      <span class={`bvital is-${tone}`} style={`--fill: ${Math.max(0, Math.min(1, cur / Math.max(1, max)))}`}>
        <span class="bvital__top">
          <small class="label">{name}</small>
          <button type="button" class={`bvital__drink ${have ? 'is-held' : ''}`} disabled={!!idle}
            aria-label={idle ? `${p.name}: ${idle}` : have ? `Drink a ${p.name}, ${have} held` : `Buy and drink a ${p.name}, ${p.price} shards`}
            title={idle ? `${p.name} · ${idle}` : have ? `${p.name} · Held: ${have}` : `${p.name} · ${p.price}`}
            onClick={() => void drinkFlow(id, true)}>
            <Glyph name="plus" />
            {have > 0 ? <span class="num">{have}</span> : !idle && <span class="num"><Shard size={8} />{p.price}</span>}
          </button>
        </span>
        <b class="num bvital__val">{text}</b>
        <span class="bvital__bar" aria-hidden="true"><i /></span>
      </span>
    );
  };
  const ftone = v.fatigue >= 70 ? 'blood' : v.fatigue >= 35 ? 'ember' : 'gold';
  return (
    <div class="bvitals" aria-label="Condition">
      {one('hp', 'HP', v.hp, v.hpMax, v.hp < v.hpMax * 0.5 ? 'low' : 'hp', <>{v.hp}<small>/{v.hpMax}</small></>)}
      {one('mp', 'MP', v.mp, v.mpMax, 'mp', <>{v.mp}<small>/{v.mpMax}</small></>)}
      {one('fatigue', 'Fatigue', v.fatigue, vitals.FATIGUE_MAX, ftone, <>{v.fatigue}</>)}
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

/** The Association's file, in the head, three lines until tapped. The Trial is the System's own: it states its terms. */
function File({ d }: { d: Dungeon }) {
  const [full, setFull] = useState(false);
  if (isTrial(d)) return <p class="bfile is-full">{d.trial} of the Chosen, in a row.</p>;
  return (
    <button type="button" class={`bfile ${full ? 'is-full' : ''}`} aria-expanded={full} aria-label={`Association file: ${d.theme}`}
      onClick={() => { sfx.tap(); setFull(!full); }}>
      {d.theme}
    </button>
  );
}

/**
 * A currency's glyph and its signed figure, set on the text's own baseline so nothing on the line sits out
 * of it: the shard and `+26` in green, Ember's flame and `+12` in its orange.
 */
function Cur({ kind, n }: { kind: 'shard' | 'ember'; n: number }) {
  return (
    <span class={`bcur is-${kind}`} aria-label={`${kind === 'shard' ? 'Mana Shards' : EMBER.name} +${n}`}>
      {kind === 'shard' ? <Shard size={12} /> : <Glyph name="ember" />}<span class="num">+{n}</span>
    </span>
  );
}

/** One line of a brief's list: its mark, what it says, and at its side its count or its figure. */
function Line({ cls, mark, children, side, open, label }: { cls?: string; mark?: ComponentChildren; children: ComponentChildren; side?: ComponentChildren; open?: () => void; label?: string }) {
  const inner = (
    <>
      <span class="bline__mark" aria-hidden="true">{mark ?? <i />}</span>
      <span class="bline__text">{children}</span>
      {side != null && <span class="bline__side">{side}</span>}
    </>
  );
  // A line that opens a card is a button the width of the list, its chevron at its side.
  if (open) {
    return (
      <li class="bline__li">
        <button type="button" class={`bline is-tap ${cls ?? ''}`} aria-label={label} aria-haspopup="dialog" onClick={() => { sfx.tap(); open(); }}>{inner}</button>
      </li>
    );
  }
  return <li class={`bline ${cls ?? ''}`}>{inner}</li>;
}

/**
 * What the run is for, a line each: the boss first, always (one of the Chosen in its place, the Trial's Chosen
 * in a row); then whatever else a clear here moves, Ryn's job, the Daily Quests it can count toward, the
 * Ascension proof, and Wardens Wake's Gatekeeper.
 */
function Objectives({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const day = dayKey();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  const walker = walkers.walking(s, day);
  const met = walker?.gateId === d.id && level >= walker.level ? walkers.walkerOf(walker.level, d.rank as Rank) : null;
  const practice = isPractice(d);
  const map = build(d, mapSeed(d, day));
  // Ryn's job, where this Gate does it.
  const job = association.current(s);
  const assoc = job && !association.done(job) && ((job.kind !== 'hunt' && job.gate === d.id) || (job.kind === 'hunt' && d.mobs.includes(job.target ?? ''))) ? job : null;
  // The Daily Quests a run here can count toward.
  const q = contracts.today(s, day);
  const fatigue = vitals.read(s).fatigue;
  const daily = !contracts.contractsOpen(s) || practice || isTrial(d) ? [] : q.list.filter((k) => !k.done && (
    k.kind === 'clear' ? rankIdx(d.rank) >= rankIdx(q.grade)
      : k.kind === 'fell' || k.kind === 'gatekeeper' ? (k.where ?? []).includes(d.id)
        : k.kind === 'offroad' ? !map.tower
          : k.kind === 'tired' ? fatigue >= (k.at ?? 0)
            : k.kind === 'shadows' ? shadows.squad(s).length > 0 : false));
  // The Ascension proof, where a clear here counts toward it.
  const a = s.ascension;
  const proof = ascension.proving(s) && !isTrial(d) && !d.floor && level === a.unlocked && d.rank === licensedRank(s)
    && !a.proof.gates.includes(d.id) && a.proof.gates.length < ascension.proofNeeds(s);
  return (
    <section class="bbox" aria-label="Objectives">
      <span class="label bbox__head">Objectives</span>
      <ul class="blist">
        <Line cls="is-main" mark={<Glyph name={isTrial(d) ? 'crown' : 'skull'} />}
          side={isTrial(d) ? <span class="num">{d.trial}</span> : met ? <span class="warn">{met.name}</span> : known ? <span class="warn">{boss.name}</span> : '?'}>
          {isTrial(d) ? 'Defeat the Chosen, one after another' : met ? 'Defeat the Chosen in the boss’s place' : 'Defeat the boss'}
        </Line>
        {assoc && <Line cls="is-assoc" side={<span class="num">{assoc.got}/{assoc.need}</span>}>Association Quest: {goalOf(assoc)}</Line>}
        {daily.map((k, i) => <Line key={i} cls="is-quest" side={<span class="num">{k.got}/{k.need}</span>}>Daily Quest: {contracts.contractText(k, q.grade)}</Line>)}
        {proof && <Line cls="is-proof" side={<span class="num">{a.proof.gates.length}/{ascension.proofNeeds(s)}</span>}>To open Ascension {a.unlocked + 1}: clear it at Ascension {a.unlocked}</Line>}
        {taken.includes('wardens') && <Line cls="is-seal" mark={<SealArt size={14} class="is-on" />} side={<span class="emb">Ember +{sealEmber('wardens', d.rank)}</span>}>Wardens Wake: defeat the Gatekeeper</Line>}
      </ul>
    </section>
  );
}

/**
 * What a clear pays, a line each: the clear, the bounty while it has never been cleared (the Spire's week, the
 * Trial's level), the Seals' Ember once one is taken, and every material the Gate can leave.
 */
function Rewards({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const trial = isTrial(d);
  const practice = isPractice(d);
  const tower = spire.isSpire(d);
  const pay = ascension.payShare(level);
  const sh = Math.round(shop.GATE_SHARDS[d.rank as Rank] * pay);
  const xp = practice ? practiceAward(s) : Math.round(GATE_XP[d.rank as Rank] * pay);
  const first = !tower && !trial && !practice && !s.gates.cleared.includes(d.id);
  const sets = raid.homeSets(d);
  const tracked = new Set(practice ? [] : s.tracked ?? []);
  const mats = practice ? [ALLOYS.E.id] : forge.sourcesOf(d, level);
  const ember = emberOf(taken, d);
  const extra = practice ? 'Ring ×1' : sets.length ? `Blueprint ×1 (${sets.map((x) => x.id).join(' or ')})` : first ? 'Blueprint ×1' : 'Blueprint ×1 (sometimes)';
  return (
    <section class="bbox" aria-label="Rewards">
      <span class="label bbox__head">Rewards{level > 0 && <small class="grant"> · Ascension {level}: pay +{Math.round((pay - 1) * 100)}%</small>}</span>
      <ul class="blist">
        <Line cls="is-clear"><b>Gate clear:</b> XP <span class="num">+{xp}</span>{practice ? `, enough for Level ${PRACTICE_LEVEL}` : <>, <Cur kind="shard" n={sh} /></>}</Line>
        {first && <Line cls="is-bounty"><b>Bounty:</b> XP <span class="num">+{xp}</span>, <Cur kind="shard" n={sh * 2} /> <span class="muted">(one-time reward)</span></Line>}
        {trial && <Line cls="is-victory"><b>Victory:</b> Ascension {s.ascension.unlocked + 1} opens</Line>}
        {tower && <Line cls="is-victory"><b>This week:</b> Floor {spire.lastFloor(spire.blockOf(d.floor ?? 1))}, a new best</Line>}
        {taken.length > 0 && <Line cls="is-ember" key="ember"><b>Seal bonus:</b> <Cur kind="ember" n={ember} /></Line>}
        <Line cls="is-mats">
          <b>Materials:</b>{' '}
          {mats.map((id, i) => (
            <span key={id} class={`bline__mat ${tracked.has(id) ? 'is-tracked' : ''}`}>
              {forge.materialById(id)?.name}{i < mats.length - 1 ? ', ' : ''}
            </span>
          ))}, {extra}
          {[...tracked].some((id) => mats.includes(id)) && <TrackMark class="bline__track" />}
        </Line>
      </ul>
    </section>
  );
}

/** The Seals' button: their wax, lit for each taken, what Sealing does, or what they are and the Ember they add to a clear. */
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
        <small>{taken.length ? <>{fixed ? 'Fixed for this run' : 'Clear'}: <span class="emb">Ember +{ember}</span></> : SEAL_LINE}</small>
      </span>
      <Glyph name="chevron" class="bsealbtn__go" />
    </button>
  );
}

// ------------------------------------------------------------------ the tabs

/**
 * What walks in the Gate, and nothing else: the boss in a spotlight at the top, one of the Chosen under it if
 * it holds the Gate today, then a line to each of the rest. The boss and each creature identified open its
 * card, where what it does and what it leaves stand.
 */
function ThreatPanel({ d, level }: { d: Dungeon; level: number }) {
  const s = useSave();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  const walker = walkers.walking(s, dayKey());
  const holds = walker?.gateId === d.id ? walker : null;
  const met = holds && level >= holds.level ? walkers.walkerOf(holds.level, d.rank as Rank) : null;
  // Its creatures and its Gatekeeper, named once the hunter has been inside, as the map is.
  const inside = [...new Set([...d.mobs, ...(d.elite ? [d.elite] : [])])].map((id) => enemyById(id)).filter((e): e is NonNullable<ReturnType<typeof enemyById>> => !!e);
  const seen = mapKnown(s, d);
  const who = met ?? (known ? boss : null);
  const head = (
    <>
      <span class="bspot__art">{who ? <FamilyGlyph family={who.family} size={52} /> : <Glyph name="unknown" />}</span>
      <span class="label">{met ? 'In the boss’s place' : isTrial(d) ? 'The last of the Chosen' : `Gate boss${known ? '' : ': unidentified'}`}</span>
      <b class="bspot__name">{who ? who.name : '?'}</b>
      <small class="bspot__line">{who ? `${who.rank}-Rank ${who.family} · ${who.role} · Power ${powerOf(who.base)}` : '?'}</small>
    </>
  );
  return (
    <>
      {known && !met
        ? <button type="button" class="bspot is-tap" data-tour="boss" aria-haspopup="dialog" onClick={() => { sfx.tap(); openCreature(boss.id, d); }}>{head}<Glyph name="chevron" class="bspot__go" /></button>
        : <div class={`bspot ${who ? '' : 'is-unknown'}`} data-tour="boss">{head}</div>}
      {holds && <ChosenLine d={d} w={holds} level={level} />}
      {!isTrial(d) && inside.length > 0 && (
        <ul class="blist bthreat">
          {inside.map((e) => {
            const body = <><b>{seen ? e.name : '?'}</b><small class="bthreat__kind">{e.id === d.elite ? 'Gatekeeper' : seen ? `${e.rank}-Rank ${e.family}` : 'Unidentified'}</small></>;
            return seen
              ? <Line key={e.id} cls={`bthreat__one ${e.id === d.elite ? 'is-elite' : ''}`} side={<Glyph name="chevron" class="bline__go" />} open={() => openCreature(e.id, d)} label={`${e.name}, ${e.id === d.elite ? 'Gatekeeper' : `${e.rank}-Rank ${e.family}`}`}>{body}</Line>
              : <Line key={e.id} cls={`bthreat__one ${e.id === d.elite ? 'is-elite' : ''}`}>{body}</Line>;
          })}
        </ul>
      )}
    </>
  );
}

/** A creature's card, over the brief: the boss, the Gatekeeper or one of the Gate's creatures. */
function openCreature(id: string, d: Dungeon) {
  const e = enemyById(id)!;
  openSheet({
    title: id === d.boss ? `Boss: ${e.name}` : id === d.elite ? `Gatekeeper: ${e.name}` : `Creature: ${e.name}`,
    system: { icon: <FamilyGlyph family={e.family} size={30} />, kind: 'gates' },
    render: () => <CreatureCard id={id} d={d} />,
  });
}

/**
 * What a creature is: its family's glyph in a spotlight, its grade, family, role and power, and whether it
 * serves as a Shadow; what it does besides hit, as the fight's tips word it; the statuses it shrugs off or
 * resists; and its special drop, how to defeat it for more.
 */
function CreatureCard({ id, d }: { id: string; d: Dungeon }) {
  const s = useSave();
  const e = enemyById(id)!;
  const boss = id === d.boss;
  const habits = tricksOf(e, boss || id === d.elite);
  const cond = conditionLine(id, boss);
  return (
    <div class="stack bcreature">
      <section class="bspot is-card">
        <span class="bspot__art"><FamilyGlyph family={e.family} size={52} /></span>
        <span class="label">{boss ? 'Gate boss' : id === d.elite ? 'Gatekeeper' : 'Creature'}</span>
        <b class="bspot__name">{e.name}</b>
        <small class="bspot__line">{e.rank}-Rank {e.family} · {e.role} · Power {powerOf(e.base)}</small>
        {shadows.isBound(s, id) && <span class="gtag is-shadow"><Glyph name="shadows" />Serves as a Shadow</span>}
      </section>
      {habits.length > 0 && (
        <section class="bbox" aria-label="Habits">
          <span class="label bbox__head">Habits</span>
          {habits.map((h) => <p key={h} class="bhabit"><b>{TRICKS[h].name}</b>{TRICKS[h].about(String(e.rank))}</p>)}
        </section>
      )}
      {(e.imm.length > 0 || e.res.length > 0) && (
        <section class="bbox" aria-label="Statuses">
          <span class="label bbox__head">Statuses</span>
          <ul class="blist">
            {e.imm.length > 0 && <Line cls="is-imm"><b>Immune:</b> {e.imm.join(', ')}</Line>}
            {e.res.length > 0 && <Line cls="is-res"><b>Resists:</b> {e.res.join(', ')}</Line>}
          </ul>
        </section>
      )}
      {cond && (
        <section class="bbox is-drop" aria-label="Special drop">
          <span class="label bbox__head">Special drop</span>
          <p class="bcreature__drop"><Glyph name={dropGlyph(id, boss)} />{cond}</p>
        </section>
      )}
    </div>
  );
}

/** One of the Chosen holding the Gate, under the boss's spotlight: when it shows itself, and what defeating it pays. */
function ChosenLine({ d, w, level }: { d: Dungeon; w: walkers.Walker; level: number }) {
  const s = useSave();
  const pay = ascension.payShare(level);
  const beaten = s.ascension.felled.includes(w.level);
  return (
    <div class="bchosen">
      <Glyph name="crown" />
      <span class="grow">
        <span class="label">Chosen</span>
        <b class="warn">[{w.name}]</b>
        <small>{level >= w.level ? `In the boss’s place at Ascension ${level}.` : `Appears at Ascension ${w.level} or higher.`}</small>
        <small>{beaten ? <>Bounty: Mana Shards <span class="grant">+{shop.gateShards(d.rank, WALKERS.bounty * pay)}</span></>
          : <>Masterwork: {RARITY[d.rank as Rank].name} {walkers.slotOf(w.level)} · Perfect +{w.level}</>}</small>
      </span>
    </div>
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
          <div key={id} class={`bfeat ${done ? 'is-done' : ''}`} style={`--i: ${i}; --odds: ${runs ? n / runs : 0}`}>
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

/** Today's map through its fog, a floor at a time, the System's road along it. Unidentified until the hunter has been inside. */
function MapPanel({ d, road }: { d: Dungeon; road: string[] }) {
  const s = useSave();
  const day = dayKey();
  const map = build(d, mapSeed(d, day));
  const [floor, setFloor] = useState(0);
  const onIt = s.gates.raid?.dungeonId === d.id && s.gates.raid.map === mapSeed(d, day) ? s.gates.raid : null;
  const fog = map.tower ? undefined : onIt ? raid.seen(s, d, onIt) : sight(map, new Set(), raid.remembered(s, mapSeed(d, day)));
  // The road's length: its rooms, its floors, the System's way to the boss and the Gate's budget of moves.
  const steps = raid.stepsOf(map);
  const depth = isTrial(d) ? `${steps} Chosen · no rest between them`
    : spire.isSpire(d) ? `${steps} floors · a rest, then the boss`
    : `${steps} rooms · ${map.floors.length > 1 ? `${map.floors.length} floors · ` : ''}${road.length} to the boss${map.tower || isPractice(d) ? '' : ` · ${budgetOf(map)} moves`}`;
  return (
    <>
      <div class="section__head"><span class="label">Today’s map</span><span class="section__right">{mapKnown(s, d) ? <>Redraw: <span class="num">{hhmmss(msUntilMidnight())}</span></> : 'Unidentified'}</span></div>
      <small class="bmap__depth"><Glyph name={isTrial(d) ? 'crown' : spire.isSpire(d) ? 'spire' : 'steps'} />{depth}</small>
      {mapKnown(s, d)
        ? <MapView m={map} road={road} seen={fog} floor={floor} onFloor={map.floors.length > 1 ? setFloor : undefined} compact />
        : (
          <div class="gmap-fogwrap">
            <div class="gmap-fog" role="img" aria-label="Map unidentified"><Glyph name="unknown" /><b>?</b></div>
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
  sealWindow.set(true);
  openSheet({
    title: `Seals: ${d.name}`,
    onClose: () => sealWindow.set(false),
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
