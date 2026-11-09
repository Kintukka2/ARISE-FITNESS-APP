/**
 * Reading and comparing the tunings `npm run calibrate` writes to src/data/gatetune.ts, so every
 * calibration can say exactly what it changed. A tuning multiplies the health and attack of the foes
 * it covers: higher is harder.
 */
import { ALL_DUNGEONS, HOLLOW_THRONE } from '@/core/gates';
import { BLOCK } from '@/data/spire';

export const TUNE_FILE = 'src/data/gatetune.ts';

export type Tune = {
  GATE_TUNE: Record<string, number>;
  BLOCK_TUNE: Record<string, number>;
  SPIRE_TUNE: number[];
  ASCENSION_TUNE: number[];
  TRIAL_TUNE: number[];
};

/** The tunings in the text of a gatetune.ts, read as data (the file is only literals). */
export function parseTune(src: string): Tune {
  const out: Record<string, unknown> = {};
  for (const m of src.matchAll(/export const (\w+)[^=]*=\s*([\s\S]*?);\n/g)) {
    out[m[1]] = JSON.parse(m[2].replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1'));
  }
  return out as Tune;
}

const GATES = [...ALL_DUNGEONS, HOLLOW_THRONE];
const gateName = (id: string) => GATES.find((d) => d.id === id)?.name ?? '';
const gateRank = (id: string) => GATES.find((d) => d.id === id)?.rank ?? '?';

const num = (v: number | undefined) => (v === undefined ? '—' : v.toFixed(2));
function change(a: number | undefined, b: number | undefined) {
  if (a === undefined) return 'new';
  if (b === undefined) return 'removed';
  const p = (b / a - 1) * 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}% ${p > 0 ? 'harder' : 'easier'}`;
}

type Row = { label: string; grade?: string; before?: number; after?: number };

function table(title: string, key: string, rows: Row[], graded: boolean): string[] {
  const moved = rows.filter((r) => r.before !== r.after);
  if (!moved.length) return [`### ${title} (${key}): unchanged, all ${rows.length}`, ''];
  const lines = [`### ${title} (${key}): ${moved.length} of ${rows.length} moved`, ''];
  lines.push(graded ? '| Gate | Grade | Before | After | Change |' : '| | Before | After | Change |');
  lines.push(graded ? '|---|---|---:|---:|---|' : '|---|---:|---:|---|');
  for (const r of moved) {
    const cells = [r.label, ...(graded ? [r.grade ?? ''] : []), num(r.before), num(r.after), change(r.before, r.after)];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  if (graded) {
    // The mean change across every gate of a grade, the unchanged ones included.
    const avg: string[] = [];
    for (const g of [...new Set(rows.map((r) => r.grade ?? '?'))]) {
      const both = rows.filter((r) => r.grade === g && r.before !== undefined && r.after !== undefined);
      if (!both.length) continue;
      const p = (both.reduce((t, r) => t + r.after! / r.before! - 1, 0) / both.length) * 100;
      avg.push(`${g} ${p > 0 ? '+' : ''}${p.toFixed(1)}%`);
    }
    lines.push('', `Average change by grade: ${avg.join(', ')}`);
  }
  lines.push('');
  return lines;
}

function keyed(a: Record<string, number>, b: Record<string, number>): Row[] {
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return ids.map((id) => ({ label: `${id} ${gateName(id)}`.trim(), grade: gateRank(id), before: a[id], after: b[id] }));
}

function listed(a: number[], b: number[], label: (i: number) => string): Row[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({ label: label(i), before: a[i], after: b[i] }));
}

/** Every tuning that moved between two versions, old → new, as Markdown. */
export function describeTune(a: Tune, b: Tune, from: string, to: string): string {
  return [
    `## Calibration changes: ${from} → ${to}`,
    '',
    'A tuning multiplies the health and attack of the foes it covers: higher is harder.',
    '',
    ...table('Gates', 'GATE_TUNE', keyed(a.GATE_TUNE, b.GATE_TUNE), true),
    ...table('Pale Spire blocks, by the Gate whose shape they take', 'BLOCK_TUNE', keyed(a.BLOCK_TUNE, b.BLOCK_TUNE), true),
    ...table('Pale Spire floors', 'SPIRE_TUNE', listed(a.SPIRE_TUNE, b.SPIRE_TUNE, (i) => `Floors ${i * BLOCK + 1}-${(i + 1) * BLOCK}`), false),
    ...table('Ascension', 'ASCENSION_TUNE', listed(a.ASCENSION_TUNE, b.ASCENSION_TUNE, (i) => `Level ${i + 1}`), false),
    ...table('Trials', 'TRIAL_TUNE', listed(a.TRIAL_TUNE, b.TRIAL_TUNE, (i) => `Ascension ${i}`), false),
  ].join('\n');
}
