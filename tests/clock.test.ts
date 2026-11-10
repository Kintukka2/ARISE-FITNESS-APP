import { describe, expect, it } from 'vitest';
import { ALL_DUNGEONS, dungeonById, isPractice, PRACTICE_GATE } from '@/core/gates';
import { build, isFight, mapSeed, systemRoad, across, type GateMap } from '@/core/map';
import { budgetOf, CLOCK, clockAt, mightOf, placesOf, redGrades, systemMoves, walkMoves } from '@/core/clock';
import * as raid from '@/core/raid';
import { defaults, migrate, SAVE_VERSION } from '@/core/save';
import type { Dungeon, Save } from '@/core/types';
import { dayKey } from '@/core/util';

const now = Date.parse('2026-10-05T12:00:00');
const gates = ALL_DUNGEONS.filter((d) => !isPractice(d) && !d.floor && !d.trial);
const days = Array.from({ length: 6 }, (_, i) => dayKey(now + i * 864e5));

/** Win a fight underway without fighting it: what a step costs on the clock is the walk, not the fight. */
function winPending(s: Save, d: Dungeon) {
  const run = s.gates.raid!;
  const x = raid.pending(d, run)!;
  raid.record(s, d, run, raid.partyFor(s, d, run, now), { index: x.n, label: '', boss: x.kind === 'boss', won: true, rounds: 1, log: [], roster: [], felled: [], kills: {}, drops: [] }, now);
}

/** Walk the System's way through an open run to the boss's fall, every fight won. */
function systemWalk(s: Save, d: Dungeon) {
  const run = s.gates.raid!;
  for (let guard = 0; guard < 400 && !raid.bossDown(d, run); guard++) {
    const x = raid.pending(d, run);
    if (x && isFight(x)) { winPending(s, d); continue; }
    if (x) { raid.resolve(s, d, run, raid.systemChoice(x), now); continue; }
    if (!raid.systemMove(s, d, run, now)) break;
  }
  return run;
}

const at = (day: string) => Date.parse(`${day}T12:00:00`);

describe('the Gate clock', () => {
  it('counts a floor\'s stairs down and up as one place, and budgets 120% of the places', () => {
    const d = gates.find((x) => x.rank === 'C')!;
    const m = build(d, mapSeed(d, days[0]));
    expect(m.floors.length).toBeGreaterThan(1);
    const stairs = m.nodes.filter((x) => x.kind === 'down').length;
    expect(placesOf(m)).toBe(m.nodes.length - stairs);
    expect(budgetOf(m)).toBe(Math.round(CLOCK.budget * placesOf(m)));
  });

  it('walks only through cleared rooms, and the stairs cost nothing to cross back', () => {
    const d = gates.find((x) => x.rank === 'C')!;
    const m = build(d, mapSeed(d, days[0]));
    const start = m.start!;
    const first = m.byId[start].next[0];
    expect(walkMoves(m, new Set([start]), start, first)).toBe(1);
    // A room two corridors away cannot be walked to while the room between is not cleared.
    const far = m.byId[first].next.find((n) => n !== start && !m.byId[start].next.includes(n));
    if (far) {
      expect(walkMoves(m, new Set([start]), start, far)).toBe(Infinity);
      expect(walkMoves(m, new Set([start, first]), start, far)).toBe(2);
    }
    // Down the stairs and back up is no move at all: they are one place.
    const down = m.nodes.find((x) => x.kind === 'down')!;
    const up = across(m, down)!;
    expect(walkMoves(m, new Set(m.nodes.map((x) => x.id)), down.id, up.id)).toBe(0);
  });

  it('the System\'s way fits inside the budget on every Gate, so Auto, the brief and calibration never stir', () => {
    for (const d of gates) for (const day of days) {
      const m = build(d, mapSeed(d, day));
      expect(systemMoves(m), `${d.id} ${day}`).toBeLessThanOrEqual(budgetOf(m));
    }
  });

  it('a run walked as the System walks spends exactly the System\'s moves', () => {
    for (const d of gates.filter((_, i) => i % 3 === 0)) for (const day of days.slice(0, 3)) {
      const s = defaults();
      const run = raid.begin(s, d, at(day));
      const m = raid.mapOf(d, run);
      expect(run.clock).toBe(budgetOf(m));
      systemWalk(s, d);
      expect(raid.bossDown(d, run), d.id).toBe(true);
      expect(run.moves, `${d.id} ${day}`).toBe(systemMoves(m));
      expect(raid.clockOf(run)!.over).toBe(0);
    }
    // It walks a third of the board over three days' maps: about 3 seconds here, and more on a busy CI runner.
  }, 20_000);

  it('charges the walk to a room and the step into it, and every corridor walked back', () => {
    const d = gates.find((x) => x.rank === 'D')!;
    const s = defaults();
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const road = systemRoad(m);
    // Two rooms along the road, then back to the entrance and into the room next to the second.
    for (const id of road.slice(0, 2)) {
      expect(raid.movesTo(d, run, id)).toBe(1);
      raid.choose(s, d, run, id, now);
      if (raid.pending(d, run)) {
        const x = raid.pending(d, run)!;
        if (isFight(x)) winPending(s, d); else raid.resolve(s, d, run, raid.systemChoice(x), now);
      }
    }
    expect(run.moves).toBe(2);
    expect(raid.moveTo(d, run, m.start!)).toBe(true);
    expect(run.moves).toBe(4);
    const next = road[2];
    expect(raid.movesTo(d, run, next)).toBe(3);
    // What the plan shows on every room is what a step there would cost.
    const shown = raid.movesFrom(d, run);
    expect(Object.keys(shown).length).toBeGreaterThan(2);
    for (const [id, n] of Object.entries(shown)) expect(n, id).toBe(raid.movesTo(d, run, id));
    raid.choose(s, d, run, next, now);
    expect(run.moves).toBe(7);
  });

  it('stirs a stated share for each move past the budget, and turns red 20 moves past it', () => {
    expect(clockAt(10, 10).stir).toBe(0);
    expect(clockAt(10, 15).stir).toBeCloseTo(5 * CLOCK.stir);
    expect(clockAt(10, 10 + CLOCK.red - 1).red).toBe(false);
    expect(clockAt(10, 10 + CLOCK.red).red).toBe(true);
    expect(mightOf(clockAt(10, 15), 'C', 'C')).toBeCloseTo(1 + 5 * CLOCK.stir);
    // Red: three grades above the hunter's rank, on top of what the stirring has added.
    const red = clockAt(10, 10 + CLOCK.red);
    expect(mightOf(red, 'C', 'C')).toBeCloseTo((1 + CLOCK.red * CLOCK.stir) * CLOCK.step ** 3);
    // A hunter reaching a grade above their own meets creatures three grades above themselves, two above the Gate.
    expect(redGrades('C', 'D')).toBe(2);
    // At A-Rank and past S, the grades go on past S at the same step; Sovereign stands a grade past S.
    expect(redGrades('A', 'A')).toBe(3);
    expect(redGrades('S', 'N')).toBe(4);
  });

  it('a Red Gate\'s creatures fight stronger, and its way out is sealed until the boss falls', () => {
    const d = gates.find((x) => x.rank === 'E')!;
    const s = defaults();
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    const first = systemRoad(m)[0];
    raid.choose(s, d, run, first, now);
    if (raid.pending(d, run) && isFight(raid.pending(d, run)!)) winPending(s, d);
    raid.moveTo(d, run, m.start!);
    expect(raid.canWithdraw(d, run)).toBe(true);
    run.moves = run.clock! + CLOCK.red;
    expect(raid.clockOf(run)!.red).toBe(true);
    expect(raid.sealed(d, run)).toBe(true);
    expect(raid.canWithdraw(d, run)).toBe(false);
    // The creatures of a room entered now are as much stronger as the clock says, HP and hit alike.
    const fight = m.nodes.find((x) => x.kind === 'fight' && !raid.explored(m, run).has(x.id))!;
    const c = raid.chamberAt(d, fight);
    const plain = raid.openChamber(d, run.seed, fight.n, raid.partyFor(s, d, run, now), c).roster.filter((u) => u.side === 'e');
    const red = raid.openChamber(d, run.seed, fight.n, raid.partyFor(s, d, run, now), c, { might: raid.mightOf(d, run) }).roster.filter((u) => u.side === 'e');
    const k = raid.mightOf(d, run);
    expect(k).toBeCloseTo((1 + CLOCK.red * CLOCK.stir) * CLOCK.step ** CLOCK.grades);
    red.forEach((u, i) => expect(u.mx / plain[i].mx).toBeCloseTo(k, 1));
    // Once the boss falls the run waits to be claimed; nothing is sealed.
    systemWalk(s, d);
    expect(raid.bossDown(d, run)).toBe(true);
    expect(raid.sealed(d, run)).toBe(false);
  });

  it('a tower, the Practice Gate and a run opened before the clock have none', () => {
    const s = defaults();
    expect(raid.begin(s, PRACTICE_GATE, now).clock).toBeUndefined();
    const block = ALL_DUNGEONS.find((x) => x.floor) ?? dungeonById('SPR-1-1');
    if (block) expect(raid.begin(defaults(), block, now).clock).toBeUndefined();
    const d = gates[0];
    const t = defaults();
    const run = raid.begin(t, d, now);
    delete run.clock;
    const first = systemRoad(raid.mapOf(d, run))[0];
    raid.choose(t, d, run, first, now);
    expect(run.moves).toBe(0);
    expect(raid.clockOf(run)).toBeNull();
    expect(raid.mightOf(d, run)).toBe(1);
  });

  it('counts every floor of a cleared Gate with every room on it cleared', () => {
    const d = gates.find((x) => x.rank === 'C')!;
    const m: GateMap = build(d, mapSeed(d, days[0]));
    const all = new Set(m.nodes.map((x) => x.id));
    expect(raid.chartedFloors(m, all)).toBe(m.floors.length);
    const first = new Set(m.nodes.filter((x) => (x.floor ?? 0) === 0).map((x) => x.id));
    expect(raid.chartedFloors(m, first)).toBe(1);
    expect(raid.chartedFloors(m, new Set([m.start!]))).toBe(0);
  });

  it('a Gate cleared without every room is not counted as one the hunter was carried out of', () => {
    const d = gates.find((x) => x.rank === 'E')!;
    const s = defaults();
    raid.begin(s, d, now);
    systemWalk(s, d);
    raid.finish(s, d, s.gates.raid!, 'cleared', now);
    expect(s.gates.clears).toBe(1);
    expect(s.gates.fails).toBe(0);
  });

  it('takes the count of Gates carried out of again from the log, where it still holds every run', () => {
    const s = defaults() as unknown as Record<string, any>;
    s.v = 9;
    s.gates.fails = 7;
    s.log = [
      { day: '2026-11-08', kind: 'gate', name: 'Warcaller\'s Muster: cleared', xp: 10 },
      { day: '2026-11-08', kind: 'gate', name: 'Warcaller\'s Muster: defeated', xp: 0 },
      { day: '2026-11-08', kind: 'gate', name: `${PRACTICE_GATE.name}: defeated`, xp: 0 },
    ];
    const out = migrate(s) as unknown as Save;
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.gates.fails).toBe(1);
  });
});
