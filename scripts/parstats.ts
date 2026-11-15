/**
 * Par as the System meets it (`npm run parstats`): for every Gate of each grade, hunters of the grade's low, middle
 * and top levels (`typicalHunter`, or `keptUpHunter` with `--kept`) walk the System's way, and the report gives, by
 * grade, the rounds each kind of fight took on average beside its par (`PAR` in `data/par.ts`), the road's par and
 * the rounds of the middle clear, and how often the System reached each medal. The pars are the System's averages at
 * the grade's middle level: rerun this after a change to combat, and move a par that has drifted.
 */
import { ALL_DUNGEONS } from '@/core/gates';
import { project } from '@/core/raid';
import type { Rank } from '@/core/types';
import { PAR } from '@/data/par';
import { keptUpHunter, LEVELS, typicalHunter } from './hunters';

const HUNTERS = 3, RUNS = 8;
const kept = process.argv.includes('--kept');
type Agg = { clears: number; gold: number; silver: number; bronze: number; rounds: number[]; road: number[]; kinds: Record<string, { n: number; rounds: number }> };
const agg: Record<string, Agg> = {};
for (const d of ALL_DUNGEONS) {
  const g = d.rank as Rank;
  for (const [i, tag] of [[0, 'low'], [1, 'middle'], [2, 'top']] as const) {
    for (let h = 0; h < HUNTERS; h++) {
      const s = (kept ? keptUpHunter : typicalHunter)(LEVELS[g][i], g, `par|${d.id}|${h}`);
      const p = project(s, d, RUNS, Date.UTC(2026, 0, 1 + h * 11));
      const a = (agg[`${g}|${tag}`] ??= { clears: 0, gold: 0, silver: 0, bronze: 0, rounds: [], road: [], kinds: {} });
      a.clears += p.cleared; a.gold += p.par.medals.gold; a.silver += p.par.medals.silver; a.bronze += p.par.medals.bronze;
      if (p.par.rounds !== null) a.rounds.push(p.par.rounds);
      a.road.push(p.par.road);
      for (const [k, v] of Object.entries(p.par.perFight)) { const x = (a.kinds[k] ??= { n: 0, rounds: 0 }); x.n += v.n; x.rounds += v.rounds; }
    }
  }
}
const pc = (x: number, n: number) => `${Math.round((100 * x) / Math.max(1, n))}%`.padStart(4);
const mid = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? '-';
console.log(`Par as the System meets it, ${kept ? 'hunters who keep up' : 'typical hunters'}: ${HUNTERS} hunters × ${RUNS} runs a Gate and level.\n`);
for (const [k, a] of Object.entries(agg)) {
  const g = k.split('|')[0] as Rank;
  const kinds = Object.entries(a.kinds).map(([kind, v]) => `${kind} ${(v.rounds / v.n).toFixed(1)}/${PAR[g][kind as keyof (typeof PAR)['E']]}`).join('  ');
  console.log(`${k.padEnd(9)} Lv.${String(LEVELS[g][['low', 'middle', 'top'].indexOf(k.split('|')[1])]).padEnd(4)} clears ${String(a.clears).padStart(3)}  Bronze ${pc(a.bronze, a.clears)}  Silver ${pc(a.silver, a.clears)}  Gold ${pc(a.gold, a.clears)}  |  road par ${mid(a.road)}, middle clear ${mid(a.rounds)} rounds  |  rounds/par ${kinds}`);
}
