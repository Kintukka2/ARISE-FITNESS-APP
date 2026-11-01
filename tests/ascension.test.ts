import { describe, expect, it } from 'vitest';
import * as asc from '@/core/ascension';
import { ALL_DUNGEONS, dungeonById, PRACTICE_GATE } from '@/core/gates';
import { build, mapSeed } from '@/core/map';
import { GATE_XP } from '@/core/progression';
import * as raid from '@/core/raid';
import * as spire from '@/core/spire';
import { RAID_FATIGUE } from '@/core/vitals';
import type { Save } from '@/core/types';
import { ASCENSION_PAY, ASCENSION_RULED, BEYOND, PROOF, RULES } from '@/data/ascension';
import { TRAP } from '@/data/nodes';
import { walk } from './walk';
import { keptUpHunter, typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');
const day = '2026-02-04';

/** A C-Rank hunter strong enough to clear C gates, with Ascension open to a level. */
function hunter(unlocked = ASCENSION_RULED, level = 0) {
  const s = keptUpHunter(30, 'C', 'asc-test');
  s.gates.cleared.push(PRACTICE_GATE.id);
  s.ascension.unlocked = unlocked;
  asc.choose(s, level);
  return s;
}

describe('the levels', () => {
  it('each plays its own rule and every rule below it', () => {
    expect(asc.rulesAt(0)).toEqual([]);
    expect(asc.rulesAt(ASCENSION_RULED)).toHaveLength(ASCENSION_RULED);
    for (const r of asc.rulesAt(ASCENSION_RULED)) expect(r.rule.length).toBeGreaterThan(0);
    for (const rule of Object.values(RULES)) {
      const below = rule.at - 1;
      expect(asc.rulesAt(below).length).toBe(below);
    }
    expect(asc.restShare(RULES.thinRest.at - 1)).toBe(1);
    expect(asc.restShare(RULES.thinRest.at)).toBe(RULES.thinRest.heal);
    expect(asc.restShare(ASCENSION_RULED)).toBe(RULES.thinRest.heal);
    expect(asc.bossByHand(ASCENSION_RULED - 1)).toBe(false);
    expect(asc.bossByHand(ASCENSION_RULED)).toBe(true);
  });

  it('a chosen level can be no higher than the highest opened', () => {
    const s = hunter(3);
    asc.choose(s, 9);
    expect(s.ascension.level).toBe(3);
    asc.choose(s, -2);
    expect(s.ascension.level).toBe(0);
  });

  it('every level is harder than the one below it', () => {
    // A typical hunter in the middle of C-Rank, over four gates and two days: room to fall at every step.
    const rate = (L: number) => {
      let c = 0, n = 0;
      for (const id of ['DNG-015', 'DNG-016', 'DNG-019', 'DNG-022']) for (const dd of ['04', '11']) {
        const s = typicalHunter(27, 'C', 'asc-rate');
        s.ascension.unlocked = ASCENSION_RULED;
        asc.choose(s, L);
        const p = raid.project(s, dungeonById(id)!, 12, Date.parse(`2026-02-${dd}T12:00:00`));
        c += p.cleared; n += p.runs;
      }
      return c / n;
    };
    expect(rate(5)).toBeLessThan(rate(0));
    expect(rate(ASCENSION_RULED)).toBeLessThan(rate(5));
  });
});

describe('a run keeps the level it walked in with', () => {
  it('and plays every rule it brings', () => {
    const d = dungeonById('DNG-016')!;
    const at0 = hunter(ASCENSION_RULED, 0);
    const run0 = raid.begin(at0, d, now);
    const s = hunter(ASCENSION_RULED, ASCENSION_RULED);
    const fatigue = s.vitals.fatigue;
    const run = raid.begin(s, d, now);
    expect(run.ascension).toBe(ASCENSION_RULED);
    // Heavy Legs, and Short-Handed.
    expect(s.vitals.fatigue - fatigue).toBe(Math.round(RAID_FATIGUE.C * RULES.heavyLegs.fatigue));
    expect(run.party.filter((u) => u.tag === 'ally').length).toBe(run0.party.filter((u) => u.tag === 'ally').length - RULES.shortHanded.allies);
    // Changing the chosen level now does not reach the run.
    asc.choose(s, 0);
    expect(asc.levelOf(s.gates.raid)).toBe(ASCENSION_RULED);
    // Never Alone: the boss has company.
    const m = build(d, mapSeed(d, day));
    const boss = m.layers[m.layers.length - 1][0];
    expect(raid.chamberAt(d, boss, ASCENSION_RULED).foes).toHaveLength(2);
    expect(raid.chamberAt(d, boss, 0).foes).toHaveLength(1);
  });

  it('Crooked Luck costs every rolled choice, and leaves a certain one certain', () => {
    const hero = raid.heroSpec(hunter(), now);
    const roll = TRAP.choices[0];
    expect(raid.oddsOf(roll, hero, RULES.crooked.at)).toBeCloseTo(Math.max(0.05, raid.oddsOf(roll, hero) - RULES.crooked.odds), 6);
    expect(raid.oddsOf({ label: 'Leave it', win: { text: '' } }, hero, ASCENSION_RULED)).toBe(1);
  });

  it('pays more for the gate, by the level it was entered at', () => {
    const d = dungeonById('DNG-016')!;
    const play = (L: number) => {
      const s = hunter(ASCENSION_RULED, L);
      s.gates.cleared.push(d.id);
      raid.begin(s, d, now);
      // The fight itself does not matter here: settle it as a clear.
      const before = s.stats.xpTotal;
      const res = raid.finish(s, d, s.gates.raid!, 'cleared', now);
      return s.stats.xpTotal - before - res.contracts.xp;
    };
    expect(play(4)).toBe(Math.round(GATE_XP.C * (1 + ASCENSION_PAY * 4)));
    expect(play(0)).toBe(GATE_XP.C);
  });
});

describe('proving a level', () => {
  function clearAt(s: Save, id: string) {
    const d = dungeonById(id)!;
    const run = raid.begin(s, d, now);
    return raid.finish(s, d, run, 'cleared', now).ascended;
  }

  it('takes different gates of the hunter’s grade at the highest level opened, then the Trial', () => {
    const s = hunter(2, 2);
    const cs = ['DNG-015', 'DNG-016', 'DNG-017', 'DNG-018', 'DNG-019'];
    expect(clearAt(s, cs[0])).toBeNull();
    expect(clearAt(s, cs[0])).toBeNull();
    expect(s.ascension.proof.gates).toEqual([cs[0]]);
    // A clear at a lower level does not count, and neither does the Spire.
    asc.choose(s, 1);
    expect(clearAt(s, cs[1])).toBeNull();
    asc.choose(s, 2);
    const block = spire.spireBlock(spire.seasonOf(day), spire.blockOf(30));
    raid.finish(s, block, raid.begin(s, block, now), 'cleared', now);
    expect(s.ascension.proof.gates).toEqual([cs[0]]);
    expect(asc.trialProved(s)).toBe(false);
    for (const id of cs.slice(1, PROOF.gates)) expect(clearAt(s, id)).toBeNull();
    expect(asc.trialReady(s, day)).toBe(true);
    // The Trial is fought at the level it proves, whatever is chosen, and opens the next.
    asc.choose(s, 0);
    const trial = asc.nextTrial(s);
    const run = raid.begin(s, trial, now);
    expect(run.ascension).toBe(2);
    expect(asc.trialReady(s, day)).toBe(false);
    expect(raid.finish(s, trial, run, 'cleared', now).ascended).toBe(3);
    expect(s.ascension.unlocked).toBe(3);
    expect(s.ascension.best).toBe(3);
    expect(s.ascension.proof).toEqual({ gates: [] });
    // Opening a level does not choose it.
    expect(s.ascension.level).toBe(0);
  });

  it('takes every gate of a grade that has fewer than the proof asks for', () => {
    const s = keptUpHunter(85, 'S', 'asc-s');
    s.gates.cleared.push(PRACTICE_GATE.id);
    s.ascension.unlocked = 2;
    asc.choose(s, 2);
    const top = ALL_DUNGEONS.filter((d) => d.rank === 'S');
    expect(top.length).toBeLessThan(PROOF.gates);
    expect(asc.proofNeeds(s)).toBe(top.length);
    for (const d of top) clearAt(s, d.id);
    expect(asc.trialReady(s, day)).toBe(true);
    const trial = asc.nextTrial(s);
    expect(raid.finish(s, trial, raid.begin(s, trial, now), 'cleared', now).ascended).toBe(3);
  });

  it('counts nothing below C-Rank', () => {
    const s = typicalHunter(15, 'D', 'asc-low');
    s.gates.cleared.push(PRACTICE_GATE.id);
    expect(asc.proving(s)).toBe(false);
    expect(asc.ascensionOpen(s)).toBe(false);
    const d = dungeonById('DNG-007')!;
    const run = raid.begin(s, d, now);
    walk(s, d, now);
    raid.finish(s, d, run, 'cleared', now);
    expect(s.ascension.proof.gates).toEqual([]);
  });
});

describe('past the ruled levels', () => {
  it('every level is stronger than the one below by the stated growth, and pays more', () => {
    for (let L = ASCENSION_RULED + 1; L < ASCENSION_RULED + 15; L++) {
      expect(asc.ascensionTune(L) / asc.ascensionTune(L - 1)).toBeCloseTo(BEYOND.growth, 6);
      expect(asc.payShare(L)).toBeGreaterThan(asc.payShare(L - 1));
    }
  });

  it('adds no rule, and names the level for being beyond them', () => {
    expect(asc.rulesAt(ASCENSION_RULED + 7)).toHaveLength(ASCENSION_RULED);
    const info = asc.levelInfo(ASCENSION_RULED + 1);
    expect(info.name).toBe(BEYOND.name);
    expect(info.rule).toContain(`${Math.round((BEYOND.growth - 1) * 100)}%`);
    // Every rule below stays in force.
    expect(asc.bossByHand(ASCENSION_RULED + 7)).toBe(true);
  });

  it('opens a level past them as any other, by its gates and its Trial', () => {
    const s = hunter(ASCENSION_RULED, ASCENSION_RULED);
    expect(asc.proving(s)).toBe(true);
    s.ascension.proof.gates = ['DNG-015', 'DNG-016', 'DNG-017', 'DNG-018'].slice(0, PROOF.gates);
    const trial = asc.nextTrial(s);
    expect(raid.finish(s, trial, raid.begin(s, trial, now), 'cleared', now).ascended).toBe(ASCENSION_RULED + 1);
    asc.choose(s, ASCENSION_RULED + 5);
    expect(s.ascension.level).toBe(ASCENSION_RULED + 1);
  });
});
