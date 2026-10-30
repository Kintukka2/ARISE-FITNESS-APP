import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { ability, fight, passiveStyle, Unit } from '@/core/combat';
import { dungeonById } from '@/core/gates';
import * as raid from '@/core/raid';
import { autoAllocate, canPick, grantXP, kitFor, optionsAt, pick, rungsOf, syncClass, totalXpFor, waiting } from '@/core/progression';
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { classById } from '@/data/classes';
import { STATS } from '@/core/types';
import { rng } from '@/core/util';

const now = Date.parse('2026-02-04T12:00:00');

/** A hunter of a level, every point in STR, so their line is STR's. */
function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  s.hunter.attrs.STR += s.hunter.points;
  s.hunter.points = 0;
  syncClass(s);
  return s;
}

describe('the rungs', () => {
  it('every rung of every line offers two, and a line’s four passives never share a style', () => {
    for (const lead of STATS) {
      const rungs = rungsOf(lead);
      expect(rungs).toEqual([0, 1, 2, 3, 4]);
      const styles: string[] = [];
      for (const r of rungs) {
        const { kind, names } = optionsAt(lead, r);
        expect(names).toHaveLength(2);
        if (kind === 'skill') for (const n of names) expect(ability(n)).toBeTruthy();
        else styles.push(...names.map((n) => passiveStyle(n)!));
      }
      expect(new Set(styles).size).toBe(4);
    }
  });

  it('without a choice a hunter fights with each rung’s first option, the kit every line had before', () => {
    for (const lead of STATS) for (let tier = 0; tier <= 4; tier++) {
      expect(kitFor(lead, tier)).toEqual({
        kit: CLASS_SKILLS.filter((x) => x.line === lead && x.rung <= tier).filter((x, i, xs) => xs.findIndex((y) => y.rung === x.rung) === i).map((x) => x.name),
        passives: CLASS_PASSIVES.filter((x) => x.line === lead && x.rung <= tier).filter((x, i, xs) => xs.findIndex((y) => y.rung === x.rung) === i).map((x) => x.name),
      });
    }
  });
});

describe('choosing', () => {
  it('the kept option is what the hunter fights with', () => {
    const s = hunter(25);
    const cls = classById(s.hunter.classId)!;
    expect(cls.lead).toBe('STR');
    expect(cls.tier).toBe(1);
    const [first, other] = optionsAt('STR', 1).names;
    expect(waiting(s)).toEqual([0, 1]);
    expect(pick(s, 1, other)).toBe(true);
    expect(waiting(s)).toEqual([0]);
    const kit = raid.heroSpec(s, now).kit!;
    expect(kit).toContain(other);
    expect(kit).not.toContain(first);
    // A fight on the auto policy uses it.
    const hero = raid.heroSpec(s, now);
    const d = dungeonById('DNG-016')!;
    const foes = d.mobs.slice(0, 3).map((id, j) => ({ uid: `e${j}`, name: id, side: 'e' as const, base: { STR: 30, AGI: 30, PER: 30, VIT: 60, INT: 30 } }));
    const res = fight([new Unit(hero)], foes.map((f) => new Unit(f)), rng('picks'), 1);
    expect(res.log.some((e) => 'ab' in e && e.ab === other)).toBe(true);
  });

  it('holds until the next rank, then can be made again', () => {
    const s = hunter(25);
    const [first, other] = optionsAt('STR', 0).names;
    expect(pick(s, 0, other)).toBe(true);
    expect(canPick(s, 0)).toBe(false);
    expect(pick(s, 0, first)).toBe(false);
    grantXP(s, totalXpFor(40) - totalXpFor(25));
    syncClass(s);
    expect(classById(s.hunter.classId)!.tier).toBe(2);
    expect(canPick(s, 0)).toBe(true);
    expect(pick(s, 0, first)).toBe(true);
    expect(canPick(s, 0)).toBe(false);
  });

  it('refuses a rung not yet open, and a name the rung does not offer', () => {
    const s = hunter(25);
    expect(pick(s, 3, optionsAt('STR', 3).names[1])).toBe(false);
    expect(pick(s, 1, optionsAt('AGI', 1).names[1])).toBe(false);
    expect(pick(defaults(), 0, optionsAt('STR', 0).names[1])).toBe(false);
  });

  it('a line’s choices wait for the hunter if they are reclassified away and back', () => {
    const s = hunter(25);
    const other = optionsAt('STR', 0).names[1];
    pick(s, 0, other);
    s.hunter.attrs.AGI = s.hunter.attrs.STR + 10;
    syncClass(s);
    expect(classById(s.hunter.classId)!.lead).toBe('AGI');
    expect(raid.heroSpec(s, now).kit).not.toContain(other);
    s.hunter.attrs.STR = s.hunter.attrs.AGI + 10;
    syncClass(s);
    expect(raid.heroSpec(s, now).kit).toContain(other);
    autoAllocate(s);
  });
});
