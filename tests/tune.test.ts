import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as live from '@/data/gatetune';
import { describeTune, parseTune, TUNE_FILE } from '../scripts/tune';

describe('the calibration report', () => {
  const read = parseTune(readFileSync(TUNE_FILE, 'utf8'));

  it('reads every tuning gatetune.ts holds, exactly as the game does', () => {
    expect(read).toEqual({
      GATE_TUNE: live.GATE_TUNE, BLOCK_TUNE: live.BLOCK_TUNE, SPIRE_TUNE: live.SPIRE_TUNE,
      ASCENSION_TUNE: live.ASCENSION_TUNE, TRIAL_TUNE: live.TRIAL_TUNE,
    });
  });

  it('names every value that moved, old and new, and nothing that did not', () => {
    const after = structuredClone(read);
    after.GATE_TUNE['DNG-001'] = Math.round(read.GATE_TUNE['DNG-001'] * 110) / 100;
    after.ASCENSION_TUNE[2] = read.ASCENSION_TUNE[2] - 0.05;
    const text = describeTune(read, after, 'a', 'b');
    expect(text).toContain(`| DNG-001 `);
    expect(text).toContain(`${read.GATE_TUNE['DNG-001'].toFixed(2)} | ${after.GATE_TUNE['DNG-001'].toFixed(2)}`);
    expect(text).toContain('(GATE_TUNE): 1 of');
    expect(text).toContain(`| Level 3 | ${read.ASCENSION_TUNE[2].toFixed(2)} | ${after.ASCENSION_TUNE[2].toFixed(2)} |`);
    expect(text).toContain('(BLOCK_TUNE): unchanged');
    expect(text).toContain('(SPIRE_TUNE): unchanged');
    expect(text).toContain('(TRIAL_TUNE): unchanged');
    expect(text).not.toContain('DNG-002');
  });
});
