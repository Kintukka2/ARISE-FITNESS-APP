import { describe, expect, it } from 'vitest';
import { battle, reckon, STRIKE, Unit, type Ev } from '@/core/combat';
import { dungeonById, enemyById } from '@/core/gates';
import { chamberOf, isFight } from '@/core/map';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import { FAMILY_TRICK, ROLE_TRICK, TRICK, tricksOf } from '@/data/tricks';
import type { TrickId } from '@/data/tricks';
import { rng } from '@/core/util';

const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };
const foe = (uid: string, tricks: TrickId[], over: Partial<typeof base> = {}, hpMult = 20, grade = 'C') =>
  new Unit({ uid, name: uid, side: 'e', base: { ...base, ...over }, kit: ['Grave Strike', 'Crushing Maul'], hpMult, tricks, grade, tag: 'foe' });
const hunter = (uid = 'hero', hpMult = 40, tag: 'hero' | 'shadow' | 'ally' = 'hero') =>
  new Unit({ uid, name: uid, side: 'p', base: { ...base, STR: 30, PER: 40 }, hpMult, tag });

/** Fight on Auto to the end and return the log. */
function auto(party: Unit[], foes: Unit[], seed: string): Ev[] {
  const log: Ev[] = [];
  const g = battle(party, foes, rng(seed), 1, () => {}, log, {});
  let step = g.next();
  while (!step.done) step = g.next(null);
  return log;
}

describe('creature behaviours', () => {
  it('a creature has its role’s behaviour at every grade, its family’s from C-Rank, and a boss or Gatekeeper winds up', () => {
    expect(tricksOf({ role: 'Guardian', family: 'Undead', rank: 'E' }, false)).toEqual(['shield']);
    expect(tricksOf({ role: 'Guardian', family: 'Undead', rank: 'D' }, false)).toEqual(['shield']);
    expect(tricksOf({ role: 'Guardian', family: 'Undead', rank: 'C' }, false)).toEqual(['shield', 'undying']);
    expect(tricksOf({ role: 'Guardian', family: 'Undead', rank: 'S' }, true)).toEqual(['shield', 'undying', 'windup']);
    expect(tricksOf({ role: 'Brute', family: 'Beast', rank: 'E' }, true)).toEqual(['enrage', 'windup']);
  });

  it('every role and family in the bestiary has a behaviour', () => {
    const roles = new Set<string>(), families = new Set<string>();
    for (const d of ['DNG-001', 'DNG-016', 'DNG-029', 'DNG-044']) for (const id of dungeonById(d)!.mobs) { roles.add(enemyById(id)!.role); families.add(enemyById(id)!.family); }
    for (const r of roles) expect(ROLE_TRICK[r], r).toBeTruthy();
    for (const f of families) expect(FAMILY_TRICK[f], f).toBeTruthy();
  });

  it('a wind-up is shown actions ahead with its pips; each hit on it takes one, and the last breaks it: stunned, and the blow never lands', () => {
    let breaks = 0, lands = 0;
    for (let n = 0; n < 40; n++) {
      // Against a boss that winds up, a party of two, or of four quick hitters.
      const party = n % 2 ? [hunter('hero', 60), hunter('s0', 30, 'shadow'), hunter('s1', 30, 'shadow'), hunter('s2', 30, 'shadow')] : [hunter('hero', 60)];
      const boss = foe('e0', ['windup'], { STR: 25, AGI: 1 }, 80);
      const log = auto(party, [boss], `wind|${n}`);
      let wound: { ab: string; pips: number } | null = null;
      for (const e of log) {
        if (e.t === 'intent' && e.u === 'e0') {
          if (e.wind && e.wind === TRICK.windup.ahead) wound = { ab: e.ab, pips: e.pips! };
          else if (!e.wind) wound = null;
        }
        if (e.t === 'pip' && wound) expect(e.left).toBeLessThan(wound.pips);
        if (e.t === 'break') {
          expect(wound).not.toBeNull();
          breaks++;
          wound = null;
        }
        if (e.t === 'hit' && e.a === 'e0' && wound && e.ab === wound.ab) { lands++; wound = null; }
      }
    }
    expect(breaks).toBeGreaterThan(5);
    expect(lands).toBeGreaterThan(0);
  });

  it('the party goes for a creature winding up, whatever the orders', () => {
    let checked = 0;
    for (let n = 0; n < 30; n++) {
      const party = [hunter('hero', 60), hunter('s0', 30, 'shadow')];
      const foes = [foe('e0', ['windup'], { AGI: 1 }, 60), foe('e1', [], { AGI: 1 }, 60)];
      const log = auto(party, foes, `aim|${n}`);
      let winding = false;
      for (const e of log) {
        if (e.t === 'intent' && e.u === 'e0') winding = !!e.wind;
        if (e.t === 'break' || (e.t === 'down' && e.v === 'e0')) winding = false;
        if (winding && (e.t === 'hit' || e.t === 'miss') && e.a === 's0') { expect(e.v).toBe('e0'); checked++; }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('a shielded creature takes half, and a hardened one half of its first hit each round', () => {
    const hero = hunter();
    const guard = foe('g', ['shield']);
    const ward = foe('w', []);
    const plain = reckon(hero, ward, STRIKE)!;
    ward.shieldOf = guard;
    const shielded = reckon(hero, ward, STRIKE)!;
    expect(shielded.hi).toBeLessThanOrEqual(Math.round(plain.hi * TRICK.shield.taken) + 1);
    const hard = foe('h', ['hardened']);
    expect(reckon(hero, hard, STRIKE)!.hi).toBeLessThanOrEqual(Math.round(reckon(hero, ward, STRIKE)!.hi * 2 * TRICK.hardened.taken) + 1);
  });

  it('an undying creature stands at 1 HP the first time it would fall, and rises at the round’s end', () => {
    let rose = 0;
    for (let n = 0; n < 20; n++) {
      const log = auto([hunter('hero', 60), hunter('s0', 30, 'shadow')], [foe('e0', ['undying'], { AGI: 1 }, 3)], `undying|${n}`);
      const stand = log.findIndex((e) => e.t === 'passive' && e.u === 'e0' && e.k === 'stand');
      if (stand < 0) continue;
      const after = log.slice(stand);
      const heal = after.find((e) => e.t === 'heal' && e.a === 'e0');
      const round = after.findIndex((e) => e.t === 'round');
      const healAt = after.findIndex((e) => e.t === 'heal' && e.a === 'e0');
      if (heal) { rose++; expect(round < 0 || healAt < round).toBe(true); }
    }
    expect(rose).toBeGreaterThan(3);
  });

  it('a chamber with behaviours replays exactly from its orders', () => {
    const s = defaults();
    const d = dungeonById('DNG-004')!;
    const now = Date.parse('2026-02-02T12:00:00');
    const run = raid.begin(s, d, now);
    const m = raid.mapOf(d, run);
    for (const x of m.nodes.filter(isFight).slice(0, 4)) {
      const a = raid.runChamber(d, run.seed, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
      const b = raid.runChamber(d, run.seed, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
      expect(JSON.stringify(b.log)).toBe(JSON.stringify(a.log));
    }
  });
});
