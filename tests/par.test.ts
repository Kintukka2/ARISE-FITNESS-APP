import { describe, expect, it } from 'vitest';
import { ALL_DUNGEONS, dungeonById } from '@/core/gates';
import { build, isFight, mapSeed, systemRoad } from '@/core/map';
import * as par from '@/core/par';
import * as raid from '@/core/raid';
import * as rift from '@/core/rift';
import type { Dungeon, Rank, Save } from '@/core/types';
import { dayKey } from '@/core/util';
import { EMBER } from '@/data/forge';
import { MEDAL_PAY, MEDALS, PAR, PAR_EMBER } from '@/data/par';
import { RIFT_OPENS } from '@/data/rift';
import { typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-03-04T12:00:00');
const day = dayKey(now);

/** Win the fight underway without fighting it, in `rounds` rounds. */
function winPending(s: Save, d: Dungeon, rounds: number) {
  const run = s.gates.raid!;
  const x = raid.pending(d, run)!;
  raid.record(s, d, run, raid.partyFor(s, d, run, now), { index: x.n, label: '', boss: x.kind === 'boss', won: true, rounds, log: [], roster: [], felled: [], kills: {}, drops: [] }, now);
}

/** Walk the System's way to the boss's fall, every fight won unfought in `rounds` rounds. */
function systemClear(s: Save, d: Dungeon, rounds: (kind: string) => number) {
  const run = s.gates.raid!;
  for (let guard = 0; guard < 200 && !raid.bossDown(d, run); guard++) {
    const x = raid.pending(d, run);
    if (x && isFight(x)) { winPending(s, d, rounds(x.kind)); continue; }
    if (x) { raid.resolve(s, d, run, raid.systemChoice(x), now); continue; }
    if (!raid.systemMove(s, d, run, now)) break;
  }
}

const gate = (rank: Rank) => ALL_DUNGEONS.find((d) => d.rank === rank && !d.elite) ?? ALL_DUNGEONS.find((d) => d.rank === rank)!;

describe('par', () => {
  it('grades a clear\'s rounds against its par: Gold within half, Silver within 65%, Bronze within par', () => {
    const p = 20;
    expect(par.marks(p).map((x) => [x.id, x.rounds])).toEqual([['gold', 10], ['silver', 13], ['bronze', 20]]);
    expect(par.medalOf(10, p)).toBe('gold');
    expect(par.medalOf(11, p)).toBe('silver');
    expect(par.medalOf(13, p)).toBe('silver');
    expect(par.medalOf(20, p)).toBe('bronze');
    expect(par.medalOf(21, p)).toBeNull();
    expect(par.medalOf(5, 0)).toBeNull();
    // Each medal asks less of the rounds than the one under it.
    for (let i = 1; i < MEDALS.length; i++) expect(MEDALS[i].at).toBeGreaterThan(MEDALS[i - 1].at);
  });

  it('a medal pays once on its Gate, the first time it is reached, and a better one pays the medals under it it had not reached', () => {
    const s = typicalHunter(30, 'C', 'pay');
    const d = gate('C');
    expect(par.settle(s, d, null)).toEqual([]);
    expect(par.settle(s, d, 'bronze')).toEqual(['bronze']);
    expect(par.settle(s, d, 'bronze')).toEqual([]);
    expect(par.settle(s, d, 'gold')).toEqual(['silver', 'gold']);
    expect(par.bestOn(s, d)).toBe('gold');
    // A worse clear later leaves the best as it stands.
    expect(par.settle(s, d, 'silver')).toEqual([]);
    expect(par.bestOn(s, d)).toBe('gold');
    expect(par.emberFor('C', ['silver', 'gold'])).toBe(PAR_EMBER.C * (MEDAL_PAY.silver + MEDAL_PAY.gold));
  });

  it('a clear counts the par of every fight it won, and its medal pays its Ember in the clear\'s materials', () => {
    const s = typicalHunter(30, 'C', 'clear');
    const d = gate('C');
    const ember = s.materials[EMBER.id] ?? 0;
    raid.begin(s, d, now);
    // Every fight won in a single round: far under par.
    systemClear(s, d, () => 1);
    const run = s.gates.raid!;
    const fights = (run.path ?? []).map((id) => raid.mapOf(d, run).byId[id]).filter((x) => x && isFight(x));
    const want = fights.reduce((n, x) => n + PAR.C[x!.kind as 'fight'], 0);
    expect(run.tally?.par).toBeCloseTo(want, 6);
    const res = raid.finish(s, d, run, 'cleared', now);
    expect(res.par).toMatchObject({ rounds: fights.length, par: Math.round(want), medal: 'gold', best: 'gold', fresh: ['bronze', 'silver', 'gold'] });
    expect(res.par!.ember).toBe(par.emberFor('C', ['bronze', 'silver', 'gold']));
    expect(res.mats[EMBER.id]).toBe(res.par!.ember);
    expect(s.materials[EMBER.id]).toBe(ember + res.par!.ember);
    // The same clear again pays no medal.
    raid.begin(s, d, now + 864e5);
    systemClear(s, d, () => 1);
    const again = raid.finish(s, d, s.gates.raid!, 'cleared', now + 864e5);
    expect(again.par).toMatchObject({ medal: 'gold', fresh: [], ember: 0 });
  });

  it('a slow clear earns no medal, and a run carried out is not graded', () => {
    const s = typicalHunter(30, 'C', 'slow');
    const d = gate('C');
    raid.begin(s, d, now);
    systemClear(s, d, (k) => 3 * Math.ceil(PAR.C[k as 'fight']));
    const res = raid.finish(s, d, s.gates.raid!, 'cleared', now);
    expect(res.par?.medal).toBeNull();
    expect(res.par?.fresh).toEqual([]);
    expect(par.bestOn(s, d)).toBeNull();
    raid.begin(s, d, now + 864e5);
    expect(raid.finish(s, d, s.gates.raid!, 'defeated', now + 864e5).par).toBeNull();
  });

  it('a Daily Rift\'s medal is its Gate\'s', () => {
    const s = typicalHunter(30, 'C', 'rift');
    s.gates.clears = Math.max(s.gates.clears, RIFT_OPENS);
    const d = rift.riftFor(s, day);
    raid.begin(s, d, now);
    systemClear(s, d, () => 1);
    const res = raid.finish(s, d, s.gates.raid!, 'cleared', now);
    expect(res.par?.medal).toBe('gold');
    expect(par.bestOn(s, dungeonById(d.shape!)!)).toBe('gold');
    expect(s.gates.par?.[d.id]).toBeUndefined();
  });

  it('the brief states the road\'s par and how often the System reached each medal', () => {
    const s = typicalHunter(30, 'C', 'brief');
    const d = gate('C');
    const p = raid.project(s, d, 6, now);
    const m = build(d, mapSeed(d, day));
    const road = systemRoad(m).map((id) => m.byId[id]).filter((x) => isFight(x));
    expect(p.par.road).toBe(Math.round(road.reduce((n, x) => n + PAR.C[x.kind as 'fight'], 0)));
    expect(p.par.medals.bronze).toBeLessThanOrEqual(p.cleared);
    expect(p.par.medals.silver).toBeLessThanOrEqual(p.par.medals.bronze);
    expect(p.par.medals.gold).toBeLessThanOrEqual(p.par.medals.silver);
    if (p.cleared) expect(p.par.rounds).toBeGreaterThan(0);
  });
});
