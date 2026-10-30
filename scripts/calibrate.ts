/**
 * Calibrate every gate so a typical hunter in the middle of its grade clears
 * it about 75% of the time, then every block of the Spire up to its top floor
 * so a hunter of the level of the block's middle floor does too, and write
 * src/data/gatetune.ts.
 *
 *   npm run calibrate
 */
import { writeFileSync } from 'node:fs';
import { ALL_DUNGEONS, HOLLOW_THRONE } from '@/core/gates';
import { rankFor } from '@/core/progression';
import { project } from '@/core/raid';
import { blockFrom, blockOf, builtFor, seasonOf, spireBlock } from '@/core/spire';
import { dayKey } from '@/core/util';
import { BLOCK_TUNE, GATE_TUNE, SPIRE_TUNE } from '@/data/gatetune';
import { BLOCK, SPIRE_TOP } from '@/data/spire';
import type { Dungeon, Rank } from '@/core/types';
import { LEVELS, typicalHunter } from './hunters';

const TARGET = 0.75;
const HUNTERS = 12;
const RUNS = 10;

function rate(d: Dungeon, level: number) {
  let c = 0, n = 0;
  for (let h = 0; h < HUNTERS; h++) {
    const s = typicalHunter(level, d.rank as Rank, `cal|${d.id}|${h}`);
    // A gate's map changes by the day, so each hunter tries it on a different one.
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
/** A block of the Spire, tried by hunters of the level it is built for, each in a different week. */
function spireRate(b: number, level: number, shape?: Dungeon) {
  const key = rankFor(level).key;
  const grade: Rank = key === 'N' ? 'S' : key;
  let c = 0, n = 0;
  for (let h = 0; h < HUNTERS; h++) {
    const s = typicalHunter(level, grade, `spire|${b}|${shape?.id ?? ''}|${h}`);
    const now = Date.UTC(2026, 0, 5 + h * 7, 12);
    const season = seasonOf(dayKey(now));
    const p = project(s, shape ? blockFrom(season, b, shape) : spireBlock(season, b), RUNS, now);
    c += p.cleared; n += p.runs;
  }
  return c / n;
}

function bisect(set: (v: number) => void, rate: () => number) {
  let lo = 0.2, hi = 5;
  for (let i = 0; i < 10; i++) {
    const mid = Math.sqrt(lo * hi);
    set(mid);
    if (rate() > TARGET) lo = mid; else hi = mid;
  }
  const v = Math.round(Math.sqrt(lo * hi) * 100) / 100;
  set(v);
  return v;
}

// The gates are done; the Spire comes second, in two passes. First each gate's creatures, as a block
// at the middle of their grade, with no level scaling at all.
SPIRE_TUNE.length = 0;
for (const k of Object.keys(BLOCK_TUNE)) delete BLOCK_TUNE[k];
for (const g of ALL_DUNGEONS) {
  const b = blockOf(LEVELS[g.rank as Rank][1]);
  bisect((v) => { BLOCK_TUNE[g.id] = v; }, () => spireRate(b, builtFor(b), g));
  console.log('BLOCK', g.id, g.rank, BLOCK_TUNE[g.id], (spireRate(b, builtFor(b), g) * 100).toFixed(0) + '%', g.name);
}
// Then every block up to the top floor, across the weeks, for the level its floors are built for.
for (let b = 0; b < SPIRE_TOP / BLOCK; b++) {
  const level = builtFor(b);
  bisect((v) => { SPIRE_TUNE[b] = v; }, () => spireRate(b, level));
  console.log('SPIRE', `floors ${b * BLOCK + 1}-${(b + 1) * BLOCK}`, `level ${level}`, SPIRE_TUNE[b], (spireRate(b, level) * 100).toFixed(0) + '%');
}

const body = Object.entries(out).map(([k, v]) => `  '${k}': ${v},`).join('\n');
writeFileSync('src/data/gatetune.ts',
  `// Per-gate difficulty multipliers on enemy health and attack, written by \`npm run calibrate\`.\n// Each is set so a hunter in the middle of the gate's grade clears it about three times in four.\nexport const GATE_TUNE: Record<string, number> = {\n${body}\n};\n`
  + `// The Spire, written by the same run. A block takes the shape of one gate a week: BLOCK_TUNE sets each gate's\n// creatures so a block of them at the middle of their grade is cleared about as often, and SPIRE_TUNE then\n// sets block b so a hunter of the level of its middle floor does.\n`
  + `export const BLOCK_TUNE: Record<string, number> = {\n${Object.entries(BLOCK_TUNE).map(([k, v]) => `  '${k}': ${v},`).join('\n')}\n};\n`
  + `export const SPIRE_TUNE: number[] = [${SPIRE_TUNE.join(', ')}];\n`);
