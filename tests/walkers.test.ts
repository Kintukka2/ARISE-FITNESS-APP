import { describe, expect, it } from 'vitest';
import * as asc from '@/core/ascension';
import { dayOrder, dungeonById, PRACTICE_GATE } from '@/core/gates';
import * as gear from '@/core/gear';
import { build, mapSeed } from '@/core/map';
import * as raid from '@/core/raid';
import { defaults, parse } from '@/core/save';
import * as shop from '@/core/shop';
import * as walkers from '@/core/walkers';
import type { Save } from '@/core/types';
import { PROOF, WALKERS } from '@/data/ascension';
import { keptUpHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');
const day = '2026-02-04';

/** A C-Rank hunter with levels open and their Chosen sent into the world. */
function hunter(sent: number[] = [], felled: number[] = []) {
  const s = keptUpHunter(30, 'C', 'walk-test');
  s.gates.cleared.push(PRACTICE_GATE.id);
  s.ascension.unlocked = Math.max(0, ...sent);
  s.ascension.sent = [...sent];
  s.ascension.felled = [...felled];
  return s;
}

const bossNode = (id: string) => {
  const d = dungeonById(id)!;
  const m = build(d, mapSeed(d, day));
  return m.layers[m.layers.length - 1][0];
};

function enterAt(s: Save, id: string, level: number) {
  asc.choose(s, level);
  return raid.begin(s, dungeonById(id)!, now);
}

describe('the Chosen sent into the world', () => {
  it('none walks until a Trial is won, and the Trial sends its last Chosen', () => {
    const s = hunter();
    expect(walkers.walking(s, day)).toBeNull();
    s.ascension.proof.gates = ['DNG-015', 'DNG-016', 'DNG-017', 'DNG-018'].slice(0, PROOF.gates);
    const trial = asc.nextTrial(s);
    const res = raid.finish(s, trial, raid.begin(s, trial, now), 'cleared', now);
    expect(res.ascended).toBe(1);
    expect(s.ascension.sent).toEqual([1]);
    // The one sent is the Trial's last.
    expect(walkers.walkerOf(1, 'C').id).toBe(trial.boss);
    const w = walkers.walking(s, day)!;
    expect(w).toEqual({ level: 1, gateId: dayOrder('C', day)[0], name: walkers.walkerOf(1, 'C').name });
  });

  it('walks among those not yet felled, the same all day', () => {
    const s = hunter([1, 2, 3], [1, 3]);
    expect(walkers.walking(s, day)!.level).toBe(2);
    expect(walkers.walking(s, day)).toEqual(walkers.walking(s, day));
    // Once every one has fallen, any of them may walk again.
    s.ascension.felled = [1, 2, 3];
    expect([1, 2, 3]).toContain(walkers.walking(s, day)!.level);
  });

  it('shows itself only to a run entered at its level or higher, in the boss’s place', () => {
    const s = hunter([1, 2], [1]);
    const w = walkers.walking(s, day)!;
    expect(w.level).toBe(2);
    const low = enterAt(s, w.gateId, 1);
    expect(low.chosen).toBeNull();
    const d = dungeonById(w.gateId)!;
    expect(raid.chamberAt(d, bossNode(w.gateId), 1, low.chosen).foes).toEqual([d.boss]);
    s.gates.raid = null;
    const high = enterAt(s, w.gateId, 2);
    expect(high.chosen).toBe(2);
    const c = raid.chamberAt(d, bossNode(w.gateId), 2, high.chosen);
    expect(c.foes[0]).toBe(walkers.walkerOf(2, 'C').id);
    expect(c.label).toBe(w.name);
    // A gate it does not hold never meets it.
    const other = dayOrder('C', day)[1];
    expect(walkers.meets(s, dungeonById(other)!, day, 2)).toBeNull();
  });

  it('leaves a masterwork the first time it falls, and a bounty after', () => {
    const s = hunter([2]);
    const w = walkers.walking(s, day)!;
    const d = dungeonById(w.gateId)!;
    const first = raid.finish(s, d, enterAt(s, w.gateId, 2), 'cleared', now).chosen!;
    expect(first.level).toBe(2);
    const it = first.item!;
    expect(gear.defOf(it)!.slot).toBe(walkers.slotOf(2));
    expect(gear.defOf(it)!.rank).toBe('C');
    expect(it.master).toBe(2);
    expect(it.over).toBe(2);
    expect(it.q).toBeGreaterThan(gear.Q_HIGH);
    expect(s.items).toContainEqual(it);
    expect(s.ascension.felled).toEqual([2]);
    const purse = s.wallet.shards;
    const again = raid.finish(s, d, enterAt(s, w.gateId, 2), 'cleared', now).chosen!;
    expect(again.item).toBeNull();
    expect(again.shards).toBe(shop.gateShards('C', WALKERS.bounty * asc.payShare(2)));
    expect(s.wallet.shards - purse).toBeGreaterThanOrEqual(again.shards);
  });

  it('does not fall to a run carried out', () => {
    const s = hunter([1]);
    const w = walkers.walking(s, day)!;
    const res = raid.finish(s, dungeonById(w.gateId)!, enterAt(s, w.gateId, 1), 'defeated', now);
    expect(res.chosen).toBeNull();
    expect(s.ascension.felled).toEqual([]);
  });

  it('a save from before sends the Chosen of every level it had opened', () => {
    const old = JSON.parse(JSON.stringify(defaults()));
    old.v = 2;
    old.ascension.unlocked = 3;
    delete old.ascension.sent;
    delete old.ascension.felled;
    const s = parse(JSON.stringify(old))!;
    expect(s.ascension.sent).toEqual([1, 2, 3]);
    expect(s.ascension.felled).toEqual([]);
    expect(defaults().ascension.sent).toEqual([]);
  });
});
