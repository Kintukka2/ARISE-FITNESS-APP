import { describe, expect, it } from 'vitest';
import { battle, reachable, reckon, Unit, type UnitSpec } from '@/core/combat';
import * as ranks from '@/core/ranks';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import type { Ability } from '@/core/types';
import { rng } from '@/core/util';
import { MOVE, REAR_MELEE } from '@/data/ranks';

const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };
const unit = (uid: string, side: 'p' | 'e', more: Partial<UnitSpec> = {}) => new Unit({ uid, name: uid, side, base, hpMult: 20, ...more });
const MELEE: Ability = { name: 'Cut', type: 'physical', profile: 'single', mult: 1, cd: 0, inflicts: [] };
const BOLT: Ability = { name: 'Bolt', type: 'magic', profile: 'single', mult: 1, cd: 0, inflicts: [] };
const VOLLEY: Ability = { name: 'Rain', type: 'physical', profile: 'volley', mult: 1, cd: 0, inflicts: [] };

describe('front and rear', () => {
  it('stands a creature by its role, a boss in front, and a hunter by their class', () => {
    expect(ranks.byRole('Brute').row).toBe('front');
    expect(ranks.byRole('Caster').row).toBe('rear');
    expect(ranks.byRole('Caster', true).row).toBe('front');
    expect(ranks.byRole('Archer / Shooter')).toMatchObject({ row: 'rear', ranged: true });
    expect(ranks.byRole('Assassin')).toMatchObject({ row: 'front', reaching: true });
    expect(ranks.byLead('INT').row).toBe('rear');
    expect(ranks.byLead('PER')).toMatchObject({ row: 'rear', ranged: true });
    expect(ranks.byLead(null).row).toBe('front');
    const s = defaults();
    expect(ranks.heroRow(s)).toBe('front');
    ranks.setStand(s, 'rear');
    expect(ranks.heroRow(s)).toBe('rear');
    expect(raid.heroSpec(s).row).toBe('rear');
  });

  it('a melee hit reaches only the front while anyone stands in it; magic, a volley, a shot and a lunge reach either', () => {
    const front = unit('e0', 'e');
    const rear = unit('e1', 'e', { row: 'rear' });
    const foes = [front, rear];
    const me = unit('h', 'p');
    expect(reachable(me, MELEE, foes)).toEqual([front]);
    expect(reachable(me, BOLT, foes)).toEqual(foes);
    expect(reachable(me, VOLLEY, foes)).toEqual(foes);
    expect(reachable(unit('a', 'p', { ranged: true }), MELEE, foes)).toEqual(foes);
    expect(reachable(unit('x', 'p', { reaching: true }), MELEE, foes)).toEqual(foes);
    // The front down, the rear stands open.
    front.hp = 0;
    expect(reachable(me, MELEE, foes)).toEqual([rear]);
  });

  it('a melee hit struck from the rear lands at half; a shot and a spell lose nothing', () => {
    const t = unit('e0', 'e');
    const at = (more: Partial<UnitSpec>, a: Ability) => reckon(unit('h', 'p', more), t, a)!.hi;
    expect(at({ row: 'rear' }, MELEE)).toBeCloseTo(at({}, MELEE) * REAR_MELEE, -1);
    expect(at({ row: 'rear', ranged: true }, MELEE)).toBe(at({ ranged: true }, MELEE));
    expect(at({ row: 'rear' }, BOLT)).toBe(at({}, BOLT));
  });

  it('Move steps the hunter to the other rank for their turn, and spends it', () => {
    const hero = unit('hero', 'p');
    const foe = unit('e0', 'e', { base: { ...base, AGI: 1 } });
    const log: { t: string; a?: string; row?: string }[] = [];
    const g = battle([hero], [foe], rng('move'), 1, () => {}, log as never[], { hero: 'hero' });
    const first = g.next();
    expect(first.done).toBe(false);
    g.next({ use: MOVE });
    expect(hero.row).toBe('rear');
    expect(log.some((e) => e.t === 'move' && e.a === 'hero' && e.row === 'rear')).toBe(true);
    expect(log.filter((e) => e.t === 'hit' && e.a === 'hero')).toHaveLength(0);
  });

  it('a creature never shows a melee hit on the rear while the front stands, and lands what it showed', () => {
    for (let n = 0; n < 30; n++) {
      const hero = unit('hero', 'p', { hpMult: 60 });
      const back = unit('s0', 'p', { row: 'rear', hpMult: 60 });
      const foe = unit('e0', 'e', { hpMult: 60 });
      const log: { t: string; u?: string; at?: string; a?: string; v?: string }[] = [];
      const g = battle([hero, back], [foe], rng(`rear|${n}`), 1, () => {}, log as never[]);
      for (let k = 0; k < 200 && !g.next().done; k++);
      for (const e of log) if (e.t === 'intent' && e.u === 'e0' && e.at) expect(e.at).toBe('hero');
      for (const e of log) if (e.t === 'hit' && e.a === 'e0') expect(e.v).toBe('hero');
    }
  });
});
