import { describe, expect, it } from 'vitest';
import { battle, reachable, reckon, Unit, type UnitSpec } from '@/core/combat';
import * as ranks from '@/core/ranks';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import type { Ability } from '@/core/types';
import { rng } from '@/core/util';
import { MOVE, PACK, REAR_MELEE, ROLE_ROW } from '@/data/ranks';
import { ALL_DUNGEONS, ALL_ENEMIES, enemyById, isPractice } from '@/core/gates';
import * as shadows from '@/core/shadows';
import { build, mapSeed } from '@/core/map';

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

  it('every role that stands in the rear is ranged, and every role in front melee', () => {
    for (const [role, row] of Object.entries(ROLE_ROW)) {
      const st = ranks.byRole(role);
      expect(st.row, role).toBe(row);
      expect(!!st.ranged, role).toBe(row === 'rear');
    }
  });

  it('a Shadow stands where the hunter placed it, its reach still its role\'s, and back at its role\'s place keeps no choice', () => {
    const s = defaults();
    const caster = ALL_ENEMIES.find((e) => e.role === 'Caster')!;
    s.shadows.army.push({ id: 'sh1', enemyId: caster.id, boundAt: '2026-01-01', out: 0, kills: 0, bosses: 0, rank: 0, xp: 0 });
    const sh = s.shadows.army[0];
    expect(shadows.standOf(sh)).toBe('rear');
    expect(raid.shadowSpec(sh, 0)).toMatchObject({ row: 'rear', ranged: true });
    shadows.setStand(s, 'sh1', 'front');
    expect(sh.stand).toBe('front');
    expect(shadows.standOf(sh)).toBe('front');
    expect(raid.shadowSpec(sh, 0)).toMatchObject({ row: 'front', ranged: true });
    shadows.setStand(s, 'sh1', 'rear');
    expect(sh.stand).toBeUndefined();
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

  it('the later plans field packs: every fight two to four, in both ranks where its Gate can; a Gatekeeper and a boss with one behind', () => {
    const place = (id: string) => ROLE_ROW[enemyById(id)?.role ?? ''] ?? 'front';
    let fights = 0;
    for (const d of ALL_DUNGEONS.filter((x) => !isPractice(x))) {
      for (const day of ['2026-03-01', '2026-03-02']) {
        const seed = mapSeed(d, day);
        const old = build(d, seed, 'labyrinth2');
        const m = build(d, seed);
        // The plan is the same plan: only who waits in its fights has grown.
        expect(m.nodes.map((x) => [x.id, x.kind])).toEqual(old.nodes.map((x) => [x.id, x.kind]));
        const both = d.mobs.some((id) => place(id) === 'front') && d.mobs.some((id) => place(id) === 'rear');
        for (const x of m.nodes) {
          const was = old.byId[x.id].foes ?? [];
          if (x.kind === 'fight') {
            fights++;
            expect(x.foes!.length).toBe(Math.max(PACK.min, Math.min(PACK.max, was.length + PACK.add)));
            if (both) expect(new Set(x.foes!.map(place))).toEqual(new Set(['front', 'rear']));
          }
          if (x.kind === 'elite' || x.kind === 'boss') {
            expect(x.foes![0]).toBe(was[0]);
            expect(x.foes).toHaveLength(1 + PACK.retinue);
            expect(x.retinue).toBe(PACK.retinue);
          }
        }
      }
    }
    expect(fights).toBeGreaterThan(100);
  });

  it('a run opened on the plans before keeps its fights as they were', () => {
    const d = ALL_DUNGEONS.find((x) => x.rank === 'C')!;
    const s = defaults();
    const run = raid.begin(s, d, Date.parse('2026-03-01T12:00:00'));
    expect(run.layout).toBe('labyrinth5');
    run.layout = 'labyrinth2';
    const m = raid.mapOf(d, run);
    const old = build(d, run.map!, 'labyrinth2');
    for (const x of m.nodes) expect(x.foes ?? []).toEqual(old.byId[x.id].foes ?? []);
  });
});
