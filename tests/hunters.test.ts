/**
 * The Association's hunters as their card reads them (`core/hunters.ts`): their class worked out as the hunter's is,
 * the kit the fight gives them, where they stand, and their record beside the hunter, settled in `raid.finish` and
 * following them from Gate to Gate.
 */
import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { allies, board, hunter as draw, type Ally } from '@/core/gates';
import * as hunters from '@/core/hunters';
import * as raid from '@/core/raid';
import * as ranks from '@/core/ranks';
import { classFor } from '@/data/classes';
import { totalXpFor, grantXP, autoAllocate, reclassifyAll, kitFor } from '@/core/progression';
import type { Dungeon, Save } from '@/core/types';
import { hunterStyleTip } from '@/ui/stand';
import { classTip } from '@/screens/Hunter';
import { walk } from './walk';

const day = '2026-02-02';
const now = Date.parse(day + 'T12:00:00');

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  autoAllocate(s);
  return s;
}

function play(s: Save, d: Dungeon) {
  const run = raid.begin(s, d, now);
  const { won } = walk(s, d, now);
  return { won, res: raid.finish(s, d, run, won ? 'cleared' : 'defeated', now) };
}

describe('an Association hunter', () => {
  it('has the class, the kit and the place the fight gives them', () => {
    for (const grade of ['E', 'D', 'C', 'B', 'A', 'S'] as const) {
      const a: Ally = draw(`HTR-${grade}-123`, grade);
      const c = hunters.classOf(a);
      expect(c?.id ?? null).toBe(classFor(a.base, a.rank)?.id ?? null);
      expect(hunters.kitOf(a)).toEqual(c ? kitFor(c.lead, c.tier) : { kit: [], passives: [] });
      expect(hunters.standOf(a)).toEqual(ranks.byLead(c?.lead));
      expect(raid.allySpec(a, 0).row).toBe(hunters.standOf(a).row);
      if (grade === 'E') expect(c).toBeNull();
      else expect(c).not.toBeNull();
    }
  });

  it('keeps a record beside the hunter, settled when the Gate is finished, and the same hunter met again adds to it', () => {
    const s = hunter(6);
    const d = board(s, day).slice(1).find((x) => x.rank === 'E')!;
    const party = allies(d, day, 'E');
    expect(party.length).toBeGreaterThan(0);
    for (const a of party) expect(hunters.recordOf(s, a.id)).toMatchObject({ runs: 0, cleared: 0, kills: 0, first: null });
    const { won } = play(s, d);
    for (const a of party) {
      const r = hunters.recordOf(s, a.id);
      expect(r.runs).toBe(1);
      expect(r.cleared).toBe(won ? 1 : 0);
      expect(r.carried).toBe(won ? 0 : 1);
      expect(r.first).toBe(day);
      expect(r.kills).toBeGreaterThanOrEqual(0);
      expect(r.place).toBe(1);
      expect(r.partners).toBe(party.length);
    }
    // Someone in the party helped defeat something.
    expect(party.reduce((n, a) => n + hunters.recordOf(s, a.id).kills, 0)).toBeGreaterThan(0);
    hunters.log(s, [party[0].id], { [party[0].id]: { kills: 2, bosses: 1 } }, '2026-02-03', 'defeated');
    const again = hunters.recordOf(s, party[0].id);
    expect(again.runs).toBe(2);
    expect(again.carried).toBe(won ? 1 : 2);
    expect(again.first).toBe(day);
    expect(again.last).toBe('2026-02-03');
    // Partied with twice, they now stand first among your partners, and the rest after them.
    expect(again.place).toBe(1);
    if (party[1]) expect(hunters.recordOf(s, party[1].id).place).toBe(2);
    // A save from before the parties were counted keeps its clears, and a hunter is never partied with fewer times than cleared with.
    s.gates.together['HTR-OLD-1'] = 4;
    expect(hunters.recordOf(s, 'HTR-OLD-1')).toMatchObject({ runs: 4, cleared: 4, first: null });
  });

  it('tells their class and how they fight in the game’s one tooltip, in whole sentences', () => {
    for (const lead of ['STR', 'VIT', 'AGI', 'PER', 'INT', null] as const) {
      const t = hunterStyleTip(lead);
      expect(t.kind).toBe('How they fight');
      expect(t.title).toBe(lead === 'PER' || lead === 'INT' ? 'Ranged' : 'Melee');
      for (const l of t.lines) expect(l).toMatch(/^[A-Z].*\.$/);
    }
    for (const grade of ['E', 'D', 'S'] as const) {
      const t = classTip(draw(`HTR-${grade}-321`, grade));
      expect(t.kind).toBe('Class');
      for (const l of t.lines) expect(l).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe('a favourite hunter', () => {
  it('is starred on their card and unstarred on a second tap, kept in the save', () => {
    const s = defaults();
    expect(hunters.isFavourite(s, 'H-1')).toBe(false);
    expect(hunters.toggleFavourite(s, 'H-1')).toBe(true);
    expect(hunters.isFavourite(s, 'H-1')).toBe(true);
    expect(s.gates.favourites).toEqual(['H-1']);
    expect(hunters.toggleFavourite(s, 'H-1')).toBe(false);
    expect(s.gates.favourites).toEqual([]);
  });
});
