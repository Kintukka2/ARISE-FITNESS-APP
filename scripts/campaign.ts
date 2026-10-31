/**
 * A campaign: a hunter played from the licence desk through the real engine,
 * day by day, by a simple, sensible policy. The board, fatigue, lockouts,
 * contracts, the Spire's weeks, extraction, the Exchange, upgrades and the
 * point spend all run as they do in the app. Where `npm run balance` models the
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
import { board, entryBlock, isPractice, PRACTICE_GATE } from '@/core/gates';
import * as gear from '@/core/gear';
import { sweep } from '@/core/missions';
import { autoAllocate, rankFor, syncClass } from '@/core/progression';
import { licensedRank } from '@/core/licence';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as spire from '@/core/spire';
import type { Dungeon, Save } from '@/core/types';
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
  runs: number; cleared: number; defeated: number; spire: number;
  contracts: number; bonusDays: number; shardsIn: number; shardsOut: number; upgrades: number; bought: number;
}

function newHunter() {
  const s = defaults();
  s.onboarded = true;
  s.hunter.name = 'CAMPAIGN';
  s.hunter.regNo = 'E-000001';
  gear.issueKit(s);
  return s;
}

/** Between runs: points, class choices on their defaults, gear, missions, the shelf and upgrades. */
function tidy(s: Save, now: number, t: Tally) {
  autoAllocate(s);
  syncClass(s);
  sweep(s);
  gear.autoEquip(s);
  const day = dayKey(now);
  // The best thing on the shelf that beats what is worn, if it costs no more than half the purse.
  const shelf = shop.shelf(s, day).filter((o) => !o.sold && o.price <= s.wallet.shards / 2 && gear.beatsWorn(s, o.item));
  const best = shelf.sort((a, b) => gear.score(b.item) - gear.score(a.item))[0];
  if (best && shop.buy(s, best.index, day)) { t.bought++; t.shardsOut += best.price; gear.autoEquip(s); }
  // Then upgrade what is worn, cheapest step first, above a reserve.
  for (;;) {
    const worn = gear.worn(s).map((it) => ({ it, cost: shop.upgradeCost(it) })).filter((x): x is { it: typeof x.it; cost: number } => x.cost !== null);
    const next = worn.sort((a, b) => a.cost - b.cost)[0];
    if (!next || s.wallet.shards - next.cost < RESERVE) break;
    shop.upgrade(s, next.it.id);
    t.upgrades++;
    t.shardsOut += next.cost;
  }
}

/** The gate a sensible hunter picks: one at their own grade they have not cleared, or any at their grade. */
function pickGate(s: Save, day: string, now: number): Dungeon | null {
  const mine = licensedRank(s);
  const open = board(s, day).filter((d) => !isPractice(d) && d.rank === mine && !entryBlock(s, d, now));
  return open.find((d) => !s.gates.cleared.includes(d.id)) ?? open[0] ?? null;
}

/**
 * The level a hunter who reads the brief enters at: the highest opened that the assessment gives three in
 * four or better. A run that would count toward proving the next level is worth an even chance at the top.
 */
const SAFE = 0.75;
const PUSH = 0.5;
function pickLevel(s: Save, d: Dungeon, now: number) {
  const a = s.ascension;
  const grade = licensedRank(s);
  const counts = asc.proving(s) && d.rank === grade && !spire.isSpire(d) && !a.proof.gates.includes(d.id);
  for (let L = a.unlocked; L > 0; L--) {
    asc.choose(s, L);
    if (raid.project(s, d, 8, now).rate >= (counts && L === a.unlocked ? PUSH : SAFE)) return;
  }
  asc.choose(s, 0);
}

function play(s: Save, d: Dungeon, now: number, r: () => number, t: Tally) {
  // A Trial is fought at the level it proves; everything else at the level the brief can stand.
  if (!isTrial(d)) pickLevel(s, d, now);
  const before = s.wallet.earned;
  const run = raid.begin(s, d, now);
  const { won } = walk(s, d, now);
  // Auto walks the System's road to the boss; it never withdraws.
  const outcome = won ? 'cleared' : 'defeated';
  const res = raid.finish(s, d, run, outcome, now);
  t.runs++;
  if (spire.isSpire(d)) t.spire++;
  t[outcome]++;
  t.contracts += res.contracts.done.length;
  if (res.contracts.bonus) t.bonusDays++;
  for (const l of res.lingering) if (vitals.read(s, now).mp >= l.cost) raid.extract(s, l, r(), now);
  t.shardsIn += s.wallet.earned - before;
}

function campaign(p: Profile) {
  const s = newHunter();
  const r = rng('campaign|' + p.name);
  const t: Tally = { runs: 0, cleared: 0, defeated: 0, spire: 0, contracts: 0, bonusDays: 0, shardsIn: 0, shardsOut: 0, upgrades: 0, bought: 0 };
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
        const d = trial ?? (tower ? spire.nextSpire(s, dayKey(now)) : pickGate(s, dayKey(now), now));
        if (!d) break;
        const cleared = t.cleared;
        play(s, d, now, r, t);
        if (day >= DAYS - 28) { late.runs++; late.cleared += t.cleared - cleared; }
        tidy(s, now, t);
        now += HOUR / 3;
      }
      const key = rankFor(s.hunter.level).key;
      if (key !== rank) { rank = key; ranks.push(`${key}:${day + 1}d`); }
    }
    if ((day + 1) % 28 === 0) {
      weekly.push(`  day ${String(day + 1).padStart(3)}  L${String(s.hunter.level).padStart(3)} ${licensedRank(s)}  Ascension ${String(s.ascension.level).padStart(2)}  shards ${String(s.wallet.shards).padStart(5)}  score ${String(Math.round(gear.power(s))).padStart(4)}  ` +
        `Shadows ${s.shadows.army.length} (best ${s.shadows.army.reduce((n, x) => Math.max(n, x.kills), 0)} kills, slots ${shadows.slots(s)})  ` +
        `sets ${[...gear.setsIn(gear.worn(s))].filter(([, n]) => n >= 2).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}  Spire best ${s.spire.top}`);
    }
  }
  const days = DAYS;
  console.log(`\n${p.name}: ${days} days`);
  console.log(`  ranks      ${ranks.join('  ')}`);
  console.log(`  runs       ${t.runs} (${(t.runs / days).toFixed(1)} a day, ${t.spire} on the Spire): ${Math.round((t.cleared / t.runs) * 100)}% cleared, ${t.defeated} carried out`);
  console.log(`  contracts  ${(t.contracts / days).toFixed(2)} of 3 a day, all three on ${Math.round((t.bonusDays / days) * 100)}% of days${contractsOpen(s) ? '' : ' (never opened)'}`);
  console.log(`  shards     ${t.shardsIn} earned, ${t.shardsOut} spent (${t.bought} pieces bought, ${t.upgrades} upgrade steps), ${s.wallet.shards} left`);
  console.log(`  Spire      best floor ${s.spire.top}, ${s.spire.seasons} weeks paid`);
  console.log(`  Ascension  ${s.ascension.unlocked} opened by day ${days}, ${s.ascension.trials} Trials walked into; the last 28 days cleared ${Math.round((late.cleared / Math.max(1, late.runs)) * 100)}%`);
  console.log(weekly.join('\n'));
}

for (const p of PROFILES) campaign(p);
