/**
 * Calibrate every gate so a typical hunter in the middle of its grade clears
 * it about 75% of the time, then write src/data/gatetune.ts.
 *
 *   npm run calibrate
 */
import { writeFileSync } from 'node:fs';
import { ALL_DUNGEONS, HOLLOW_THRONE } from '@/core/gates';
import { project } from '@/core/raid';
import { GATE_TUNE } from '@/data/gatetune';
import type { Dungeon, Rank } from '@/core/types';
import { LEVELS, typicalHunter } from './hunters';

const TARGET = 0.75;
const HUNTERS = 6;
const RUNS = 16;

function rate(d: Dungeon, level: number) {
  let c = 0, n = 0;
  for (let h = 0; h < HUNTERS; h++) {
    const s = typicalHunter(level, d.rank as Rank, `cal|${d.id}|${h}`);
    const p = project(s, d, RUNS, Date.UTC(2026, 0, 1 + h * 11));
    c += p.cleared; n += p.runs;
  }
  return c / n;
}

const out: Record<string, number> = {};
for (const d of [...ALL_DUNGEONS, HOLLOW_THRONE]) {
  const level = d === HOLLOW_THRONE ? 92 : LEVELS[d.rank as Rank][1];
  let lo = 0.3, hi = 3;
  for (let i = 0; i < 10; i++) {
    const mid = Math.sqrt(lo * hi);
    GATE_TUNE[d.id] = mid;
    if (rate(d, level) > (d === HOLLOW_THRONE ? 0.5 : TARGET)) lo = mid; else hi = mid;
  }
  out[d.id] = Math.round(Math.sqrt(lo * hi) * 100) / 100;
  GATE_TUNE[d.id] = out[d.id];
  console.log(d.id, d.rank, out[d.id], (rate(d, level) * 100).toFixed(0) + '%', d.name);
}
const body = Object.entries(out).map(([k, v]) => `  '${k}': ${v},`).join('\n');
writeFileSync('src/data/gatetune.ts',
  `// Per-gate difficulty multipliers on enemy health and attack, written by \`npm run calibrate\`.\n// Each is set so a hunter in the middle of the gate's grade clears it about three times in four.\nexport const GATE_TUNE: Record<string, number> = {\n${body}\n};\n`);
