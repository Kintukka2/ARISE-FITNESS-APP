/**
 * The brief: the System's card on a Gate, and the way in, read top to bottom as the reference games lay a
 * stage before it is entered (Honkai: Star Rail's and Genshin Impact's stage cards, Darkest Dungeon's embark,
 * Hades' Pact). Its head is the Gate's portal inside the assessment's ring, a tick to each of the System's runs;
 * under it the facts (the party's power against the boss's, its floors), the objectives, the rewards as tiles, the
 * Seals pressed in place, the enemies as portraits, the party lined up, the Feats and Today's map in a row. The
 * way in is docked at its foot. A creature's card, the map and the bag open over it.
 */
import { leftBy } from '@/core/engravings';
import { ENGRAVED } from '@/data/engravings';
import { Runestone } from '@/ui/runes';
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
import { FamilyGlyph, ShadowEmblem } from '@/ui/emblems';
import { makeLine } from '@/ui/kin';
import { closeAllSheets, confirm, openSheet } from '@/ui/overlays';
import { bagFor, enterGate } from '@/app/flow';
import * as sealing from '@/core/seals';
import * as feats from '@/core/feats';
import { SEAL_IDS, SEALS, sealEmber, type SealId } from '@/data/seals';
import { TRICKS, tricksOf } from '@/data/tricks';
import { FEAT_PAY, FEATS, FEATS_PER_GATE, type FeatId } from '@/data/feats';
import { dropPay } from '@/ui/conditions';
import { CONDITION } from '@/data/drops';
import { Keyed } from '@/ui/keyed';
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
/** The projections made for briefs, by everything they read: with each Seal pressed, a projection of its own. */
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
  const figure = useTween(proj.rate * 100);
  const v = raid.verdict(figure / 100);
  const rate = Math.round(figure);
  const plainRate = Math.round(plain.rate * 100);
  const sealed = taken.length > 0;
  const block = entryBlock(s, d);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const hpNow = vitals.read(s);
  const cleared = s.gates.cleared.includes(d.id);
  const mark = markOf(s, d, contracts.named(s, day).has(d.id), day);
  const hasFeats = !practice && !tower && !trial;

  const abandon = async () => {
    const run = store.get().gates.raid;
    if (!run || !(await confirm('Abandon the run?', 'You will be carried out. Nothing banked on this run is kept.', 'Abandon', true))) return;
    store.update((x) => raid.finish(x, d, x.gates.raid!, 'defeated'));
    close();
  };

  return (
    <div class={`stack brief ${trial ? 'is-trial' : ''}`} style={`--rc: ${trial ? 'var(--gold)' : `var(--rank-${d.rank})`}`}>
      {/*
        The head, as a boss is revealed: the Gate's portal inside the assessment's ring at its centre, the rate and
        the verdict under it, its grade and its name over it; the file, the chips and the Ascension's rules after.
      */}
      <header class={`bhero ${pending ? 'is-pending' : ''} ${sealed ? 'is-sealed' : ''}`} data-tone={v.tone} data-tour="assess">
        <span class="bhero__glow" aria-hidden="true" />
        <h3 class="bhero__title"><span class="label bhero__grade">{trial ? 'Trial of Ascension' : tower ? `${d.rank}-Rank floors` : `${d.rank}-Rank Gate`}:</span> <span class="bhero__name">{trial ? `Ascension ${trialLevel(d) + 1}` : d.name}</span></h3>
        <span class="bhero__ring" role="img" aria-label={`Assessment: ${v.text}. Clear rate ${rate}%${sealed && plainRate !== rate ? `, ${plainRate}% without the Seals` : ''}.`}>
          <Ring p={proj} plain={plain} r={62} />
          <span class="bhero__portal ga-portal" aria-hidden="true">
            <i class="ga-portal__swirl" /><i class="ga-portal__core" />
            <RankPlate rank={d.rank} size={40} />
          </span>
        </span>
        <span class="bhero__read" aria-hidden="true">
          <b class="bhero__pct num">{rate}<small>%</small></b>
          <b class="bhero__assess">{v.text}</b>
        </span>
        <span class="bhero__tags">
          {!trial && !tower && !practice && <span class={`gtag ${cleared ? 'is-done' : 'is-fresh'}`}>{cleared ? 'Cleared' : 'Never cleared'}</span>}
          {mark && <span class={`gtag is-${mark.toLowerCase()}`}>{mark}</span>}
          {level > 0 && <span class="gtag is-ascension">Ascension {level}</span>}
          {trial && <><span class="gtag">Rest: None</span><span class="gtag">Withdrawal: Not possible</span><span class="gtag">Allies: None</span></>}
        </span>
        <File d={d} />
        {level > 0 && (
          <p class="basc"><Glyph name="crown" /><span>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''}</span></p>
        )}
      </header>

      <Facts d={d} level={level} taken={taken} />
      <Objectives d={d} level={level} taken={taken} />
      <RewardTiles d={d} level={level} taken={taken} />
      {offer.length > 0 && <SealStrip d={d} offer={offer} taken={taken} fixed={fixed} />}
      <EnemyRow d={d} level={level} />
      <Lineup d={d} level={level} taken={taken} />
      {hasFeats && <FeatList d={d} met={feats.metOn(s, d)} odds={proj.feats} runs={proj.runs} />}
      <MapRow d={d} road={proj.road} />

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

/** The boss, or one of the Chosen in its place, that the brief may name: once the boss is known, or the Chosen walks it. */
function bossOf(s: Save, d: Dungeon, level: number) {
  const walker = walkers.walking(s, dayKey());
  const holds = walker?.gateId === d.id ? walker : null;
  const met = holds && level >= holds.level ? walkers.walkerOf(holds.level, d.rank as Rank) : null;
  return { holds, met, who: met ?? (bossKnown(s, d) ? enemyById(d.boss)! : null) };
}

/**
 * The facts under the head, as the reference games set a stage's recommended power over its enemies: the
 * party's power against the boss's (the last of the Chosen's, on the Trial), each by the power mark, and how
 * deep it goes, its floors, said before anyone has been inside (the Trial's Chosen). Never its moves: the Gate
 * clock is felt inside, not counted out here (the owner's call). Its rooms wait in Today's map.
 */
function Facts({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const map = build(d, mapSeed(d, dayKey()));
  const { who } = bossOf(s, d, level);
  const trial = isTrial(d);
  const party = partyPower(s, d, level, taken);
  const foe = who ? powerOf(who.base) : null;
  return (
    <dl class="bfacts">
      <div><dt>Party</dt><dd class="num" aria-label={`Power ${party}`}><Glyph name="power" />{party}</dd></div>
      <div><dt>{trial ? 'Last Chosen' : 'Boss'}</dt><dd class="num is-foe" aria-label={foe === null ? 'Power unknown' : `Power ${foe}`}><Glyph name="power" />{foe ?? '?'}</dd></div>
      <div>
        <dt>{trial ? 'Chosen' : 'Floors'}</dt>
        <dd class="num">{trial || map.tower ? raid.stepsOf(map) : Math.max(1, map.floors.length)}</dd>
      </div>
    </dl>
  );
}

/**
 * What a clear pays, as Honkai: Star Rail and Genshin Impact lay a stage's drops: a tile to each, its mark
 * framed over its name, its figure in the tile's corner. The clear's XP and shards; the bounty while it has
 * never been cleared (the Spire's week, the Trial's level); the Seals' Ember once one is taken; every material
 * the Gate can leave, a tracked one with the Forge's anvil; and the blueprint.
 */
function RewardTiles({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
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
  const engraving = leftBy(d);
  const tile = (key: string, cls: string, art: ComponentChildren, name: ComponentChildren, n?: ComponentChildren, label?: string) => (
    <li key={key} class={`breward ${cls}`} aria-label={label}>
      <span class="breward__art">{art}{n != null && <b class="breward__n num">{n}</b>}</span>
      <small class="breward__name">{name}</small>
    </li>
  );
  return (
    <section class="bbox" aria-label="Rewards">
      <span class="label bbox__head">Rewards{level > 0 && <small class="grant"> · Ascension {level}: pay +{Math.round((pay - 1) * 100)}%</small>}</span>
      <ul class="brewards">
        {tile('xp', 'is-xp', <span class="breward__xp">XP</span>, practice ? `Gate clear · Level ${PRACTICE_LEVEL}` : 'Gate clear', `+${xp}`, `Gate clear: XP +${xp}`)}
        {!practice && tile('shards', 'is-shard', <Shard size={26} />, 'Gate clear', `+${sh}`, `Gate clear: Mana Shards +${sh}`)}
        {first && tile('bounty', 'is-bounty', <Shard size={26} />, 'Bounty · once', `+${sh * 2}`, `Bounty: XP +${xp}, Mana Shards +${sh * 2}, one-time reward`)}
        {trial && tile('victory', 'is-victory', <Glyph name="crown" />, `Ascension ${s.ascension.unlocked + 1} opens`)}
        {tower && tile('week', 'is-victory', <Glyph name="spire" />, `Floor ${spire.lastFloor(spire.blockOf(d.floor ?? 1))}`, undefined, 'This week: a new best')}
        {taken.length > 0 && tile('ember', 'is-ember', <MatArt id={EMBER.id} size={30} />, 'Seal bonus', `+${ember}`, `Seal bonus: Ember +${ember}`)}
        {mats.map((id) => tile(id, `is-mat ${tracked.has(id) ? 'is-tracked' : ''}`, <><MatArt id={id} size={30} />{tracked.has(id) && <TrackMark class="breward__track" />}</>, forge.materialById(id)?.name ?? id))}
        {tile('print', 'is-print', practice ? <Glyph name="Ring" /> : <Glyph name="blueprint" />,
          practice ? 'Ring' : sets.length ? `Blueprint · ${sets.map((x) => x.id).join(' or ')}` : 'Blueprint', '×1')}
        {/* The engraving the boss, and the Gatekeeper, can leave on a piece found whole, at their odds. */}
        {!practice && !trial && engraving.boss && tile('engr-boss', 'is-engrave', <Runestone e={engraving.boss} size={32} />, `${engraving.boss.name} · Boss`, `${Math.round(ENGRAVED.boss * 100)}%`, `Engraving: ${engraving.boss.name}, left by the boss at ${Math.round(ENGRAVED.boss * 100)}%`)}
        {!practice && !trial && engraving.keeper && engraving.keeper.id !== engraving.boss?.id && tile('engr-keeper', 'is-engrave', <Runestone e={engraving.keeper} size={32} />, `${engraving.keeper.name} · Gatekeeper`, `${Math.round(ENGRAVED.keeper * 100)}%`, `Engraving: ${engraving.keeper.name}, left by the Gatekeeper at ${Math.round(ENGRAVED.keeper * 100)}%`)}
      </ul>
    </section>
  );
}

/**
 * The Seals, set where they are read, as Hades lays its Pact of Punishment: a wax seal to each, pressed with a
 * tap and lit red, its name under it; what the one last touched does and pays, under them; and the Ember they
 * add on the right. The head's ring answers as each is pressed. A run open on the Gate keeps its own, fixed.
 */
function SealStrip({ d, offer, taken, fixed }: { d: Dungeon; offer: SealId[]; taken: SealId[]; fixed: boolean }) {
  const [shown, setShown] = useState<SealId | null>(null);
  const [pressed, setPressed] = useState<{ id: SealId; on: boolean } | null>(null);
  const ember = emberOf(taken, d);
  const toggle = (id: SealId) => {
    setShown(id);
    if (fixed) return;
    const on = !taken.includes(id);
    setSeal(d, id, on);
    setPressed({ id, on });
    if (on) { sfx.stamp(); buzz([10, 24, 34]); } else { sfx.blip(); buzz(8); }
  };
  const x = shown ? SEALS[shown] : null;
  return (
    <section class={`bseals ${taken.length ? 'is-on' : ''}`} aria-label="Seals" data-tour="seals">
      <span class="bseals__head">
        <span class="label">Seals</span>
        <span class="bseals__ember"><MatArt id={EMBER.id} size={16} /><b class="num emb" key={ember}>+{ember}</b><small>Ember on a clear</small></span>
      </span>
      <ul class="bseals__set">
        {offer.map((id, i) => {
          const on = taken.includes(id);
          const just = pressed?.id === id;
          return (
            <li key={id} style={`--i: ${i}`}>
              <button type="button" role="switch" aria-checked={on} aria-disabled={fixed}
                class={`bseal ${on ? 'is-on' : ''} ${shown === id ? 'is-shown' : ''} ${just ? (pressed!.on ? 'is-stamped' : 'is-lifted') : ''}`}
                onClick={() => toggle(id)}>
                <span class="bseal__wax"><SealArt size={42} class={on ? 'is-on' : ''} />{just && pressed!.on && <i class="sealcard__ripple" />}</span>
                <b>{SEALS[id].name}</b>
                <small class="emb">+{sealEmber(id, d.rank)}</small>
              </button>
            </li>
          );
        })}
      </ul>
      <p class="bseals__rule">
        {x ? <><b>{x.name}:</b> {x.rule}{x.note ? <span class="muted"> {x.note}</span> : null}</>
          : fixed ? 'Fixed for this run.' : SEAL_LINE}
      </p>
    </section>
  );
}

/**
 * Who stands in the Gate, as Honkai: Star Rail lays a stage's enemies: a portrait to each, the boss first and
 * larger in red, one of the Chosen holding the Gate in gold, the Gatekeeper ringed in gold, the rest after;
 * each named under its portrait, `?` until it is known. One identified opens its card.
 */
function EnemyRow({ d, level }: { d: Dungeon; level: number }) {
  const s = useSave();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  const { holds, met } = bossOf(s, d, level);
  const seen = mapKnown(s, d);
  const inside = isTrial(d) ? [] : [...new Set([...d.mobs, ...(d.elite ? [d.elite] : [])])].map((id) => enemyById(id)).filter((e): e is NonNullable<ReturnType<typeof enemyById>> => !!e);
  const one = (key: string, cls: string, family: string | null, name: string, tag: string, openIt?: () => void, label?: string) => {
    const body = (
      <>
        <span class="benemy__face">{family ? <FamilyGlyph family={family} size={cls.includes('is-boss') ? 34 : 24} /> : <Glyph name="unknown" />}</span>
        <b class="benemy__name">{name}</b>
        <small class="benemy__tag">{tag}</small>
      </>
    );
    return (
      <li key={key}>
        {openIt
          ? <button type="button" class={`benemy is-tap ${cls}`} aria-haspopup="dialog" aria-label={label ?? `${name}, ${tag}`} onClick={() => { sfx.tap(); openIt(); }}>{body}</button>
          : <span class={`benemy ${cls}`} aria-label={label ?? `${name}, ${tag}`}>{body}</span>}
      </li>
    );
  };
  return (
    <section class="bbox" aria-label="Enemies" data-tour="boss">
      <span class="label bbox__head">Enemies</span>
      <ul class="benemies">
        {met
          ? one('chosen', 'is-boss is-chosen', null, met.name, 'In the boss’s place')
          : isTrial(d)
            ? one('trial', 'is-boss is-chosen', null, `${d.trial} Chosen`, 'One after another')
            : known
              ? one(boss.id, 'is-boss', boss.family, boss.name, 'Gate boss', () => openCreature(boss.id, d), `Gate boss: ${boss.name}`)
              : one('boss', 'is-boss', null, '?', 'Gate boss')}
        {inside.map((e) => seen
          ? one(e.id, e.id === d.elite ? 'is-elite' : '', e.family, e.name, e.id === d.elite ? 'Gatekeeper' : `${e.rank}-Rank ${e.family}`, () => openCreature(e.id, d))
          : one(e.id, e.id === d.elite ? 'is-elite' : '', null, '?', e.id === d.elite ? 'Gatekeeper' : 'Unidentified'))}
      </ul>
      {holds && <ChosenLine d={d} w={holds} level={level} />}
    </section>
  );
}

/**
 * Who walks in, as Darkest Dungeon lines its party up before it embarks: a portrait to each, the hunter first,
 * the Association's hunters, then the Shadows; their power under them and together; the squad's Kin and
 * Formation under the line.
 */
function Lineup({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const { hero, party, squad } = partyOf(s, d, level, taken);
  return (
    <section class="bbox" aria-label="Party" data-tour="party">
      <span class="label bbox__head">{isTrial(d) ? 'Entering' : 'Your party'}<small class="bbox__right bpower" aria-label={`Power ${partyPower(s, d, level, taken)}`}><Glyph name="power" /><b class="num">{partyPower(s, d, level, taken)}</b></small></span>
      <ul class="blineup">
        <li class="blineup__one is-you"><span class="blineup__face"><Sigil rank={licensedRank(s)} size={30} /></span><b>{s.hunter.name}</b><small class="num">{powerOf(hero.base)}</small></li>
        {party.map((a) => (
          <li key={a.id} class="blineup__one is-ally"><span class="blineup__face"><RankPlate rank={a.rank} size={26} /></span><b>{a.name.split(' ')[0]}</b><small class="num">{powerOf(a.base)}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small></li>
        ))}
        {squad.map((x) => {
          const e = enemyById(x.enemyId)!;
          return <li key={x.id} class="blineup__one is-shadow"><span class="blineup__face"><ShadowEmblem family={e.family} rank={shadows.rankIndex(x)} size={34} /></span><b>{shadows.nameOf(x).replace(/^Shadow /, '')}</b><small class="num">{shadows.power(x)}</small></li>;
        })}
        {!isPractice(d) && Array.from({ length: shadows.freeSlots(s) }, (_, i) => (
          <li key={`free-${i}`} class="blineup__one is-free" aria-label="Shadow slot empty"><span class="blineup__face"><Glyph name="plus" /></span><b>Free</b><small> </small></li>
        ))}
      </ul>
      {squad.length > 0 && makeLine(squad) && <p class="bparty__kin">{makeLine(squad)}</p>}
      {isPractice(d) && <p class="hint"><strong>[Ryn Valcorde]</strong> has joined your party.</p>}
    </section>
  );
}

/**
 * A Gate's three Feats, as Honkai: Star Rail sets a stage's three challenges: a star to each, gold once met
 * here, what it asks, how often the System met it on today's map, and what it pays the first time.
 */
function FeatList({ d, met, odds, runs }: { d: Dungeon; met: FeatId[]; odds: Partial<Record<FeatId, number>>; runs: number }) {
  const got = feats.featsOf(d).filter((id) => met.includes(id)).length;
  return (
    <section class="bbox" aria-label="Feats">
      <span class="label bbox__head">Feats<small class="bbox__right"><span class="btabs__stars">{Array.from({ length: FEATS_PER_GATE }, (_, i) => <i key={i} class={i < got ? 'is-on' : ''}>★</i>)}</span></small></span>
      <div class="bfeats">
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
    </section>
  );
}

/**
 * Today's map, as one row: its rooms (the Spire's floors, the Trial's Chosen), once the hunter has been
 * inside, and when it is redrawn. Once the hunter has been inside, a tap opens the map in a window of its own; until then it is
 * Unidentified and opens nothing.
 */
function MapRow({ d, road }: { d: Dungeon; road: string[] }) {
  const s = useSave();
  const map = build(d, mapSeed(d, dayKey()));
  const known = mapKnown(s, d);
  const steps = raid.stepsOf(map);
  const size = !known ? 'Unidentified'
    : isTrial(d) ? `${steps} Chosen`
      : map.tower ? `${steps} floors`
        : `${steps} rooms`;
  const body = (
    <>
      <Glyph name={isTrial(d) ? 'crown' : spire.isSpire(d) ? 'spire' : 'steps'} />
      <span class="bmaprow__text"><span class="label">Today’s map</span><small>{size}</small></span>
      <small class="bmaprow__redraw">{known ? <>Redraw <span class="num">{hhmmss(msUntilMidnight())}</span></> : null}</small>
      {known ? <Glyph name="chevron" class="bmaprow__go" /> : <Glyph name="lock" class="bmaprow__go" />}
    </>
  );
  return known
    ? <button type="button" class="bmaprow is-tap" aria-haspopup="dialog" aria-label={`Today’s map: ${size}`} onClick={() => { sfx.tap(); openMap(d, road); }}>{body}</button>
    : <div class="bmaprow" aria-label="Today’s map: Unidentified">{body}</div>;
}

/** Today's map in its own window over the brief: the plan through its fog, a floor at a time, the System's road along it. */
function openMap(d: Dungeon, road: string[]) {
  const trial = isTrial(d);
  openSheet({
    title: `Map: ${trial ? `Ascension ${trialLevel(d) + 1}` : d.name}`,
    system: { icon: <Glyph name={trial ? 'crown' : spire.isSpire(d) ? 'spire' : 'steps'} />, kind: trial ? 'gold' : 'gates' },
    render: () => <MapSheet d={d} road={road} />,
  });
}

function MapSheet({ d, road }: { d: Dungeon; road: string[] }) {
  const s = useSave();
  const day = dayKey();
  const map = build(d, mapSeed(d, day));
  const [floor, setFloor] = useState(0);
  const onIt = s.gates.raid?.dungeonId === d.id && s.gates.raid.map === mapSeed(d, day) ? s.gates.raid : null;
  const fog = map.tower ? undefined : onIt ? raid.seen(s, d, onIt) : sight(map, new Set(), raid.remembered(s, mapSeed(d, day)));
  return (
    <div class="bmapsheet">
      <MapView m={map} road={road} seen={fog} floor={floor} onFloor={map.floors.length > 1 ? setFloor : undefined} compact />
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
        <Line cls="is-main" mark={<Glyph name={isTrial(d) ? 'crown' : 'roomBoss'} />}
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
  const cond = raid.conditionOf(id, boss);
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
          {habits.map((h) => <p key={h} class="bhabit"><b class="bhabit__name">{TRICKS[h].name}</b><Keyed text={TRICKS[h].about(String(e.rank))} /></p>)}
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
        <section class="bbox" aria-label="Special drop">
          <span class="label bbox__head">Special drop</span>
          <p class="bhabit"><b class="bhabit__name">{dropPay(id, boss)}</b><Keyed text={`${CONDITION[cond].text}.`} /></p>
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

