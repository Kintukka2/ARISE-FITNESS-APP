/**
 * Balance report: how often a typical hunter clears gates of each grade, at
 * the floor, middle and top of that grade, with the party the board sends.
 * Also the economy: days to each rank at three training rates. Asserts nothing.
 *
 *   npm run balance
 */
import { ALL_DUNGEONS } from '@/core/gates';
import { project } from '@/core/raid';
import { RANK_LADDER, totalXpFor, xpToNext } from '@/core/progression';
import { sessionXp } from '@/core/sessions';
import type { Rank } from '@/core/types';
import { RANKS } from '@/core/types';
import { LEVELS, typicalHunter } from './hunters';

const RUNS = Number(process.argv[2] ?? 12);

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

console.log('\nDays to each rank (Daily Quest every day + N sessions a week, 20 sets each, Resonance building):');
for (const perWeek of [0, 3, 5]) {
  let level = 1, xp = 0, day = 0, streak = 0;
  const hit: string[] = [];
  let next = 1;
  while (next < RANK_LADDER.length && day < 2000) {
    day++;
    streak = Math.min(100, streak + 1);
    const mult = 1 + streak * 0.01;
    xp += Math.round((60 + level * 9) * mult);
    if (perWeek && day % 7 < perWeek) xp += Math.round(sessionXp(200, 20) * mult);
    while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++; }
    while (next < RANK_LADDER.length && level >= RANK_LADDER[next].min) hit.push(`${RANK_LADDER[next++].key}:${day}d`);
  }
  console.log(`  ${perWeek} sessions/week  ${hit.join('  ')}`);
}
void totalXpFor;
void ({} as Rank);
