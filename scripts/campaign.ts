/**
 * A campaign: a hunter played from the licence desk through the real engine,
 * day by day, by a simple, sensible policy. The board, fatigue, lockouts,
 * contracts, the Spire's weeks, extraction, the Exchange, the Forge, upgrades
 * and the point spend all run as they do in the app. Where `npm run balance` models the
 * climb with a formula, this plays it. Asserts nothing.
 *
 *   npm run campaign [days]
 *
 * Two hunters: one who plays one evening a day, and one who plays three
 * sessions. A session raids until the hunter is tired or hurt, then spends.
 * Each reads the brief before a run, and climbs Ascension as far as the
 * assessment says it will hold.
 */
import * as asc from '@/core/ascension';
import { isTrial } from '@/core/trial';
import { contractsOpen, issue } from '@/core/contracts';
import { setAllBySystem } from '@/core/marks';
import * as walkers from '@/core/walkers';
import { board, entryBlock, isPractice, PRACTICE_GATE } from '@/core/gates';
import * as gear from '@/core/gear';
import * as forge from '@/core/forge';
import { sweep } from '@/core/missions';
import { autoAllocate, rankFor, rankOf, syncClass } from '@/core/progression';
import { claimAll } from '@/core/quests';
import { autoLearn } from '@/core/skilltree';
import { licensedRank } from '@/core/licence';
import * as raid from '@/core/raid';
import * as sealing from '@/core/seals';
import { sealEmber } from '@/data/seals';
import { defaults } from '@/core/save';
import * as shadows from '@/core/shadows';
import { powerOf } from '@/core/combat';
import * as association from '@/core/association';
import * as shop from '@/core/shop';
import * as spire from '@/core/spire';
import type { Dungeon, GearDef, Rank, Save, SlotKey } from '@/core/types';
import { RANKS } from '@/core/types';
import { dayKey, rng } from '@/core/util';
import * as vitals from '@/core/vitals';
import { walk } from '../tests/walk';

const DAYS = Number(process.argv[2] ?? 120);
const START = Date.UTC(2026, 0, 5, 0);
const HOUR = 36e5;
/** What a sensible hunter will not walk in carrying, and the health they will not walk in below. */
const TIRED = 45;
const HURT = 0.5;
/** Shards kept back from upgrades, for the shelf. */
const RESERVE = 150;

interface Profile { name: string; sessions: number[]; perSession: number }
const PROFILES: Profile[] = [
  { name: 'One evening a day', sessions: [19], perSession: 3 },
  { name: 'Three sessions a day', sessions: [8, 13, 19], perSession: 3 },
];

interface Tally {
  runs: number; cleared: number; defeated: number; spire: number; chosen: number; masterworks: number;
  contracts: number; bonusDays: number; shardsIn: number; shardsOut: number; upgrades: number; bought: number; assoc: number;
  forged: number; rerolls: number; recycled: number; blueprints: number; found: number;
  /** Runs walked into under Seals, Feats met for the first time, and creatures felled the way their condition asks. */
  sealed: number; feats: number; drops: number;
  /** Of those, bosses felled while Broken, and runs under a Seal that pays a blueprint (Dry, Never Alone). */
  bossDrops: number; sealEmber: number;
}
const TALLY: Tally = {
  runs: 0, cleared: 0, defeated: 0, spire: 0, chosen: 0, masterworks: 0, contracts: 0, bonusDays: 0, shardsIn: 0, shardsOut: 0,
  upgrades: 0, bought: 0, assoc: 0, forged: 0, rerolls: 0, recycled: 0, blueprints: 0, found: 0, sealed: 0, feats: 0, drops: 0, bossDrops: 0, sealEmber: 0,
};

const rk = (d: GearDef | undefined) => RANKS.indexOf((d?.rank ?? 'E') as Rank);

/** The design a slot should be forged from: the rarest blueprint known for it, a set's piece first among equals. */
function bestBlueprint(s: Save, slot: SlotKey): GearDef | null {
  const accepts = gear.SLOTS.find((x) => x.key === slot)!.accepts;
  const known = forge.FORGEABLE.filter((d) => d.slot === accepts && forge.knows(s, d.id));
  // A set's piece first among equals, while its trophy is held; then the design best known.
  const trophied = (d: GearDef) => !!d.set && forge.held(s, forge.trophyOfSet(d.set) ?? '') > 0;
  const blocked = (d: GearDef) => !!d.set && !trophied(d);
  return known.sort((a, b) => rk(b) - rk(a) || Number(blocked(a)) - Number(blocked(b)) || Number(trophied(b)) - Number(trophied(a))
    || forge.familiarityRank(s, b.id) - forge.familiarityRank(s, a.id))[0] ?? null;
}

/**
 * The Forge, as a sensible hunter works it: every slot worn below the rarest blueprint known for it is
 * forged anew; a worn piece of that rarity that rolled in its bottom third is forged again once, the
 * better kept; everything not worn is recycled. Then the worn pieces are upgraded, cheapest first.
 */
function smith(s: Save, t: Tally) {
  // The rarities a slot is still waiting to be forged at: their alloy is saved for it, not spent on upgrades.
  const waiting = new Set<string>();
  // Slots whose piece is to be replaced by a rarer one: not worth upgrading.
  const outgrown = new Set<string>();
  for (const sl of gear.SLOTS) {
    const best = bestBlueprint(s, sl.key);
    if (!best) continue;
    const on = gear.equippedIn(s, sl.key);
    const od = gear.defOf(on ?? undefined);
    const fresh = !on || !!od?.issued || rk(od) < rk(best);
    const poor = !fresh && on && od?.id === best.id && gear.quality(on) < 34 && !on.up;
    if (fresh && on) outgrown.add(on.id);
    if (!fresh && !poor) continue;
    const cost = forge.recipe(best);
    if (!forge.affords(s, cost) || s.wallet.shards - cost.shards < RESERVE) {
      // Its own alloy saved for it only when that alloy is all it waits on.
      const own = forge.alloyId(best.rank as Rank);
      if (fresh && forge.lines(s, cost).every((x) => x.id === own || x.have >= x.need)) waiting.add(best.rank);
      continue;
    }
    const it = forge.forge(s, best.id);
    if (!it) continue;
    t.shardsOut += cost.shards;
    if (poor) t.rerolls++; else t.forged++;
    if (!on || fresh || gear.score(it) > gear.score(on)) gear.equip(s, it.id, sl.key);
  }
  gear.autoEquip(s);
  // What is not worn goes back to the Forge.
  const loose = s.items.filter((it) => !gear.slotOf(s, it)).map((it) => it.id);
  t.recycled += forge.recycleSome(s, loose).count;
  // Then upgrade what is worn, cheapest step first, above a reserve, and past perfect as far as Ascension allows;
  // never with the alloy a slot waiting to be forged needs.
  const keep = (r: string) => (waiting.has(r) ? forge.RECIPE.alloy[RANKS.indexOf(r as Rank)] : 0);
  for (;;) {
    const worn = gear.worn(s).map((it) => ({ it, cost: forge.upgradeCost(it, asc.overCap(s)) }))
      .filter((x): x is { it: typeof x.it; cost: forge.Cost } => !!x.cost && forge.affords(s, x.cost) && !outgrown.has(x.it.id))
      .filter((x) => {
        const r = gear.defOf(x.it)!.rank;
        return forge.held(s, forge.alloyId(r as Rank)) - (x.cost.mats[forge.alloyId(r as Rank)] ?? 0) >= keep(r);
      });
    const next = worn.sort((a, b) => a.cost.shards - b.cost.shards)[0];
    if (!next || s.wallet.shards - next.cost.shards < RESERVE) break;
    forge.upgrade(s, next.it.id, asc.overCap(s));
    t.upgrades++;
    t.shardsOut += next.cost.shards;
  }
}

function newHunter() {
  const s = defaults();
  s.onboarded = true;
  s.hunter.name = 'CAMPAIGN';
  s.hunter.regNo = 'E-000001';
  gear.issueKit(s);
  return s;
}

/** Between runs: points, the skill tree as Auto Assign spends it, marks as the System sets them, gear, missions, the shelf and upgrades. */
function tidy(s: Save, now: number, t: Tally) {
  autoAllocate(s);
  syncClass(s);
  autoLearn(s);
  setAllBySystem(s);
  sweep(s);
  gear.autoEquip(s);
  // A slot left free is filled with the strongest Shadow not deployed, as the Squad tile calls for.
  const bench = s.shadows.army.filter((x) => !shadows.squad(s).includes(x)).sort((a, b) => powerOf(shadows.statsOf(b)) - powerOf(shadows.statsOf(a)));
  for (const x of bench) if (shadows.freeSlots(s) > 0) shadows.toggleDeploy(s, x.id);
  const day = dayKey(now);
  // A blueprint off the shelf, if it is rarer than what its slot can be forged from now, for no more than half the purse.
  const shelf = shop.shelf(s, day).filter((o) => {
    const d = gear.gearDef(o.defId)!;
    const slot = gear.SLOTS.find((x) => x.accepts === d.slot)!.key;
    return !o.sold && !o.known && o.price <= s.wallet.shards / 2 && rk(d) > rk(bestBlueprint(s, slot) ?? undefined);
  });
  const best = shelf.sort((a, b) => rk(gear.gearDef(b.defId)) - rk(gear.gearDef(a.defId)))[0];
  if (best && shop.buy(s, best.index, day)) { t.bought++; t.shardsOut += best.price; }
  smith(s, t);
}

/**
 * The gate a sensible hunter picks: one at their own grade they have not cleared, then one that counts
 * toward proving the next Ascension level, then any at their grade.
 */
function pickGate(s: Save, day: string, now: number): Dungeon | null {
  const mine = licensedRank(s);
  const open = board(s, day).filter((d) => !isPractice(d) && d.rank === mine && !entryBlock(s, d, now));
  // Ryn's job's Gate, pinned to the board, when the job asks for it or its creatures.
  const job = association.current(s);
  const pinned = job && !association.done(job) ? open.find((d) => d.id === job.gate) : undefined;
  return open.find((d) => !s.gates.cleared.includes(d.id))
    ?? pinned
    ?? open.find((d) => asc.proving(s) && !s.ascension.proof.gates.includes(d.id))
    ?? open[0] ?? null;
}

/**
 * The level a hunter who reads the brief enters at: the highest opened that the assessment gives three in
 * four or better. A run that would count toward proving the next level is worth an even chance at the top.
 */
const SAFE = 0.75;
const PUSH = 0.5;
function pickLevel(s: Save, d: Dungeon, now: number, floor = 0) {
  const a = s.ascension;
  const grade = licensedRank(s);
  const counts = asc.proving(s) && d.rank === grade && !spire.isSpire(d) && !a.proof.gates.includes(d.id);
  for (let L = a.unlocked; L > floor; L--) {
    asc.choose(s, L);
    if (raid.project(s, d, 8, now).rate >= (counts && L === a.unlocked ? PUSH : SAFE)) return;
  }
  asc.choose(s, floor);
}

/**
 * The gate one of the Chosen holds today, if a hunter who reads the brief would hunt it: open to them,
 * at a level they have opened, and an even chance or better at the Chosen's own level.
 */
function huntGate(s: Save, day: string, now: number): { d: Dungeon; level: number } | null {
  const w = walkers.walking(s, day);
  if (!w || w.level > s.ascension.unlocked) return null;
  const d = board(s, day).find((x) => x.id === w.gateId);
  if (!d || entryBlock(s, d, now)) return null;
  const was = s.ascension.level;
  asc.choose(s, w.level);
  const even = raid.project(s, d, 8, now).rate >= PUSH;
  asc.choose(s, was);
  return even ? { d, level: w.level } : null;
}

function play(s: Save, d: Dungeon, now: number, r: () => number, t: Tally, floor = 0) {
  // A Trial is fought at the level it proves; everything else at the level the brief can stand, and a
  // Chosen's gate at no lower than its level.
  if (!isTrial(d)) pickLevel(s, d, now, floor);
  const before = s.wallet.earned;
  // A hunter who reads the brief takes every Seal the Gate offers while the brief still reads three in four or better.
  const offer = sealing.offered(s, d, dayKey(now));
  // It reads the brief as the brief is: 24 runs.
  const seals = offer.length && raid.project(s, d, 24, now, offer).rate >= SAFE ? offer : [];
  if (seals.length) t.sealed++;
  const run = raid.begin(s, d, now, seals);
  const { won } = walk(s, d, now);
  // Auto walks the System's road to the boss; it never withdraws.
  const outcome = won ? 'cleared' : 'defeated';
  const res = raid.finish(s, d, run, outcome, now);
  // A hunter who keeps up claims each rank the moment its level is reached, and promotes each Shadow the moment the Essence pays for it.
  claimAll(s);
  // And takes Ryn's Association work, reporting each job the moment it is done.
  association.issue(s);
  if (association.ready(s)) { association.report(s); t.assoc++; }
  t.runs++;
  if (spire.isSpire(d)) t.spire++;
  t[outcome]++;
  t.contracts += res.contracts.done.length;
  if (res.contracts.bonus) t.bonusDays++;
  if (res.chosen) { t.chosen++; if (res.chosen.item) t.masterworks++; }
  t.blueprints += res.blueprints.length;
  t.feats += res.feats.fresh.length;
  t.drops += res.drops;
  if (outcome === 'cleared') {
    t.bossDrops += (run.drops ?? []).filter((x) => x.boss).length;
    t.sealEmber += seals.filter((id) => id !== 'wardens' || !!run.tally?.keeper).reduce((n, id) => n + sealEmber(id, d.rank), 0);
  }
  t.found += res.loot.length;
  // Every reach it has the mana for, up to the last, while the Shadow lingers.
  for (const l of res.lingering) while (raid.reachesLeft(l) > 0 && vitals.read(s, now).mp >= raid.reachCost(l)) raid.extract(s, l, r(), now);
  shadows.promoteAll(s);
  // And what Essence is left awakens its Ascendants.
  shadows.awakenAll(s);
  t.shardsIn += s.wallet.earned - before;
}

function campaign(p: Profile) {
  const s = newHunter();
  const r = rng('campaign|' + p.name);
  const t: Tally = { ...TALLY };
  const ranks: string[] = [];
  const weekly: string[] = [];
  let rank = rankFor(1).key;
  let now = START;
  let climbed = -1;
  const late = { runs: 0, cleared: 0 };
  // The practice gate first, as every hunter does.
  raid.begin(s, PRACTICE_GATE, now);
  walk(s, PRACTICE_GATE, now);
  raid.finish(s, PRACTICE_GATE, s.gates.raid!, 'cleared', now);
  for (let day = 0; day < DAYS; day++) {
    for (const hour of p.sessions) {
      now = START + day * 24 * HOUR + hour * HOUR;
      vitals.settle(s, now);
      issue(s, dayKey(now));
      spire.settle(s, now);
      tidy(s, now, t);
      for (let k = 0; k < p.perSession; k++) {
        const v = vitals.read(s, now);
        if (v.locked || v.fatigue > TIRED || v.hp < v.hpMax * HURT) break;
        // A block of the Spire first thing each day, once it is open; gates otherwise.
        // The Trial, when it stands open and the brief gives it an even chance; then the Spire; then the board.
        const trial = asc.trialReady(s, dayKey(now)) && raid.project(s, asc.nextTrial(s), 8, now).rate >= PUSH ? asc.nextTrial(s) : null;
        const tower = !trial && spire.spireOpen(s) && climbed !== day && !entryBlock(s, spire.nextSpire(s, dayKey(now)), now);
        if (tower) climbed = day;
        // Then one of the Chosen, when it holds an open gate and the brief gives it an even chance.
        const hunt = !trial && !tower ? huntGate(s, dayKey(now), now) : null;
        const d = trial ?? (tower ? spire.nextSpire(s, dayKey(now)) : hunt?.d ?? pickGate(s, dayKey(now), now));
        if (!d) break;
        const cleared = t.cleared;
        play(s, d, now, r, t, hunt?.level ?? 0);
        if (day >= DAYS - 28) { late.runs++; late.cleared += t.cleared - cleared; }
        tidy(s, now, t);
        now += HOUR / 3;
      }
      const key = rankOf(s).key;
      if (key !== rank) { rank = key; ranks.push(`${key}:${day + 1}d`); }
    }
    if ((day + 1) % 14 === 0) {
      const worn = gear.worn(s);
      const q = worn.filter((it) => !gear.defOf(it)?.issued);
      const kit = gear.SLOTS.map((sl) => gear.defOf(gear.equippedIn(s, sl.key) ?? undefined)?.rank ?? '-').join('');
      const w = forge.weaponOf(s);
      weekly.push(`  day ${String(day + 1).padStart(3)}  L${String(s.hunter.level).padStart(3)} ${licensedRank(s)}  kit ${kit}  q ${q.length ? Math.round(q.reduce((n, it) => n + gear.quality(it), 0) / q.length) : 0}%  weapon F${w ? forge.familiarityRank(s, w) : 0}  ` +
        `Ascension ${String(s.ascension.level).padStart(2)}  shards ${String(s.wallet.shards).padStart(5)}  score ${String(Math.round(gear.power(s))).padStart(4)}  ` +
        `Shadows ${s.shadows.army.length} (squad ${shadows.squad(s).map((x) => `${shadows.rankOf(x).name[0]}${shadows.levelOf(x)}${shadows.starsOf(x) ? `*${shadows.starsOf(x)}` : ''}`).join('/') || '-'}, essence ${s.shadows.essence}, slots ${shadows.slots(s)})  ` +
        `sets ${[...gear.setsIn(gear.worn(s))].filter(([, n]) => n >= 2).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}  Spire best ${s.spire.top}`);
    }
  }
  const days = DAYS;
  console.log(`\n${p.name}: ${days} days`);
  console.log(`  ranks      ${ranks.join('  ')}`);
  console.log(`  runs       ${t.runs} (${(t.runs / days).toFixed(1)} a day, ${t.spire} on the Spire): ${Math.round((t.cleared / t.runs) * 100)}% cleared, ${t.defeated} carried out`);
  console.log(`  contracts  ${(t.contracts / days).toFixed(2)} of 3 a day, all three on ${Math.round((t.bonusDays / days) * 100)}% of days${contractsOpen(s) ? '' : ' (never opened)'}`);
  console.log(`  shards     ${t.shardsIn} earned, ${t.shardsOut} spent (${t.bought} blueprints bought, ${t.upgrades} upgrade steps), ${s.wallet.shards} left`);
  console.log(`  forge      ${s.blueprints.length} blueprints known (${t.blueprints} from Gates), ${t.forged} forged, ${t.rerolls} forged again, ${t.recycled} recycled, ${t.found} found whole`);
  console.log(`  extras     ${t.sealed} runs under Seals, ${t.feats} Feats met for the first time, ${t.drops} condition drops (${t.bossDrops} bosses felled while Broken), ${t.sealEmber} Ember from Seals`);
  console.log(`  materials  ${Object.entries(s.materials).filter(([, n]) => n).map(([k, n]) => `${forge.materialById(k)?.name ?? k} ${n}`).join(', ')}`);
  console.log(`  Spire      best floor ${s.spire.top}, ${s.spire.seasons} weeks paid`);
  console.log(`  Ascension  ${s.ascension.unlocked} opened by day ${days}, ${s.ascension.trials} Trials walked into; the last 28 days cleared ${Math.round((late.cleared / Math.max(1, late.runs)) * 100)}%`);
  console.log(`  Chosen     ${s.ascension.sent.length} sent into the world, ${t.chosen} felled, ${t.masterworks} masterworks (${gear.worn(s).filter((it) => it.master).length} worn)`);
  console.log(`  Association ${t.assoc} jobs reported; satchel ${shop.satchelMax(s)}; held: ${Object.entries(s.stock).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'nothing'}`);
  console.log(weekly.join('\n'));
}

for (const p of PROFILES) campaign(p);
