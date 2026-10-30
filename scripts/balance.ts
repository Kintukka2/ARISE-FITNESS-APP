/**
 * Balance report: how often a typical hunter clears gates of each grade, at
 * the floor, middle and top of that grade, with the party the board sends.
 * Also the economy: days to each rank at three raiding rates. Asserts nothing.
 *
 *   npm run balance
 */
import { ALL_DUNGEONS } from '@/core/gates';
import { bonusOf, payOf } from '@/core/contracts';
import { FAIL_SHARE, project } from '@/core/raid';
import { CONTRACTS_PER_DAY } from '@/data/contracts';
import { GATE_XP, PRACTICE_LEVEL, RANK_LADDER, rankFor, xpToNext } from '@/core/progression';
import type { Rank } from '@/core/types';
import { RANKS } from '@/core/types';
import { LEVELS, typicalHunter } from './hunters';

const RUNS = Number(process.argv[2] ?? 12);
/** What `npm run calibrate` tunes a gate to, for a hunter in the middle of its grade. */
const CLEAR_RATE = 0.75;

console.log(`Clear rate, typical hunter (floor / middle / top of the grade). ${RUNS} sims × 4 hunters per gate.\n`);
console.log('grade  floor  middle  top   | middle vs one grade up');
for (const rank of RANKS) {
  const gates = ALL_DUNGEONS.filter((d) => d.rank === rank);
  const up = ALL_DUNGEONS.filter((d) => d.rank === RANKS[RANKS.indexOf(rank) + 1]);
  const cells = LEVELS[rank].map((level, i) => {
    let c = 0, n = 0;
    for (const d of gates) for (let h = 0; h < 4; h++) {
      const p = project(typicalHunter(level, rank, `bal|${d.id}|${i}|${h}`), d, RUNS, Date.UTC(2026, 5, 1 + h * 5));
      c += p.cleared; n += p.runs;
    }
    return `${Math.round((c / n) * 100)}%`.padStart(5);
  });
  let cu = 0, nu = 0;
  for (const d of up) for (let h = 0; h < 4; h++) {
    const p = project(typicalHunter(LEVELS[rank][1], rank, `up|${d.id}|${h}`), d, RUNS, Date.UTC(2026, 5, 2 + h * 5));
    cu += p.cleared; nu += p.runs;
  }
  console.log(`  ${rank}   ${cells.join('  ')}  |   ${up.length ? Math.round((cu / nu) * 100) + '%' : '—'}`);
}

// A hunter who raids at their own grade, clears three in four, and takes every first-clear bounty the grade offers.
// The second line of each pair also finishes all of the day's System contracts, every day.
console.log(`\nDays to each rank (N gates a day at your own grade, ${CLEAR_RATE * 100}% cleared, first clears counted):`);
for (const perDay of [3, 6, 10]) for (const withContracts of [false, true]) {
  let level = PRACTICE_LEVEL, xp = 0, day = 0, runs = 0;
  const firsts: Record<string, number> = {};
  const hit: string[] = [];
  let next = 1;
  const gradeOf = (): Rank => { const key = rankFor(level).key; return key === 'N' ? 'S' : key; };
  const settle = () => { while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++; } };
  while (next < RANK_LADDER.length && day < 2000) {
    day++;
    const issued = gradeOf();
    for (let k = 0; k < perDay; k++, runs++) {
      const grade = gradeOf();
      const pay = GATE_XP[grade];
      // Every fourth run fails, so a day's gates pay their expected value without randomness.
      if (runs % 4 === 3) { xp += Math.round(pay * FAIL_SHARE); continue; }
      xp += pay;
      if ((firsts[grade] ?? 0) < ALL_DUNGEONS.filter((d) => d.rank === grade).length) { firsts[grade] = (firsts[grade] ?? 0) + 1; xp += pay; }
      settle();
    }
    if (withContracts) { xp += CONTRACTS_PER_DAY * payOf(issued).xp + bonusOf(issued).xp; settle(); }
    while (next < RANK_LADDER.length && level >= RANK_LADDER[next].min) hit.push(`${RANK_LADDER[next++].key}:${day}d`);
  }
  console.log(`  ${withContracts ? ' + contracts' : `${String(perDay).padStart(2)} gates/day`}  ${hit.join('  ')}`);
}
