import { describe, expect, it } from 'vitest';
import * as asc from '@/core/ascension';
import { dungeonById, enemyById, entryBlock, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed } from '@/core/map';
import * as raid from '@/core/raid';
import { chosen, isTrial, trialDungeon, trialRounds } from '@/core/trial';
import { RANKS } from '@/core/types';
import { PROOF, TRIAL } from '@/data/ascension';
import { keptUpHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');
const day = '2026-02-04';

describe('the Trial', () => {
  it('is a column of the Chosen: one to a layer, the last its boss, no rest and nothing to choose', () => {
    for (const level of [0, 4, 9]) {
      const d = trialDungeon('C', level);
      expect(isTrial(d)).toBe(true);
      expect(dungeonById(d.id)).toEqual(d);
      const m = build(d, mapSeed(d, day));
      expect(m.layers).toHaveLength(trialRounds(level));
      for (const row of m.layers) expect(row).toHaveLength(1);
      expect(m.layers.flat().map((x) => x.kind)).toEqual([...Array(trialRounds(level) - 1).fill('elite'), 'boss']);
      expect(m.layers.flat().some((x) => x.kind === 'rest')).toBe(false);
    }
  });

  it('its Chosen are its grade’s bosses, weakest first, each stronger than the one before', () => {
    for (const g of RANKS) {
      const a = chosen(1, g);
      const b = chosen(2, g);
      expect(enemyById(a.id)).toEqual(a);
      expect(a.name).not.toBe(b.name);
      const sum = (e: typeof a) => Object.values(e.base).reduce((x, y) => x + y, 0);
      expect(sum(b)).toBeGreaterThan(sum(a) * (1 + TRIAL.step) * 0.95);
    }
  });

  it('each round before the last is fought with a boss’s health, but only the last ends the run', () => {
    const d = trialDungeon('C', 2);
    const m = build(d, mapSeed(d, day));
    const first = raid.chamberAt(d, m.layers[0][0], 2);
    expect(first.champion).toBe(true);
    expect(first.boss).toBe(false);
    expect(first.label).toBe(chosen(1, 'C').name);
    expect(raid.chamberAt(d, m.layers[m.layers.length - 1][0], 2).boss).toBe(true);
  });

  it('opens once the gates are proved, and can be walked into once a day', () => {
    const s = keptUpHunter(30, 'C', 'trial-test');
    s.gates.cleared.push(PRACTICE_GATE.id);
    const trial = asc.nextTrial(s);
    expect(entryBlock(s, trial, now)).toBe('spent');
    s.ascension.proof.gates = ['DNG-015', 'DNG-016', 'DNG-017', 'DNG-018'].slice(0, PROOF.gates);
    expect(entryBlock(s, trial, now)).toBeNull();
    const run = raid.begin(s, trial, now);
    expect(raid.canWithdraw(trial, run)).toBe(false);
    run.lost = true;
    expect(raid.finish(s, trial, run, 'defeated', now).ascended).toBeNull();
    s.vitals.lockedUntil = null;
    s.vitals.hp = 9999;
    expect(entryBlock(s, trial, now)).toBe('spent');
    expect(entryBlock(s, trial, now + 864e5)).toBeNull();
    expect(s.ascension.trials).toBe(1);
  });
});
