import { describe, expect, it } from 'vitest';
import { Unit } from '@/core/combat';
import { dungeonById, PRACTICE_GATE } from '@/core/gates';
import * as gear from '@/core/gear';
import * as marks from '@/core/marks';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import { RAID_FATIGUE } from '@/core/vitals';
import { ASCENSION_RULED, MARK_MAX, MARKS, OVERCHARGE } from '@/data/ascension';
import { UPGRADE } from '@/data/sets';
import { typicalHunter } from '../scripts/hunters';

const now = Date.parse('2026-02-04T12:00:00');
const mark = (id: string) => marks.markById(id)!;

describe('marks', () => {
  it('one is earned for every level opened, and each is set for good, up to the most any one mark takes', () => {
    const s = defaults();
    expect(marks.unset(s)).toBe(0);
    expect(marks.setMark(s, 'edge')).toBe(false);
    s.ascension.unlocked = MARK_MAX + 2;
    expect(marks.unset(s)).toBe(MARK_MAX + 2);
    for (let k = 0; k < MARK_MAX; k++) expect(marks.setMark(s, 'edge')).toBe(true);
    expect(marks.setMark(s, 'edge')).toBe(false);
    expect(marks.setOn(s, 'edge')).toBe(MARK_MAX);
    expect(marks.setMark(s, 'no-such-mark')).toBe(false);
    expect(marks.setMark(s, 'ward')).toBe(true);
    expect(marks.unset(s)).toBe(1);
  });

  it('the System spreads them: the mark with the fewest set, the first of them on a tie', () => {
    const s = defaults();
    s.ascension.unlocked = ASCENSION_RULED;
    marks.setAllBySystem(s);
    expect(marks.unset(s)).toBe(0);
    const each = MARKS.map((m) => marks.setOn(s, m.id));
    expect(Math.max(...each) - Math.min(...each)).toBeLessThanOrEqual(1);
    expect(each.reduce((n, v) => n + v, 0)).toBe(ASCENSION_RULED);
    const one = defaults();
    one.ascension.unlocked = 1;
    marks.setAllBySystem(one);
    expect(one.ascension.marks).toEqual({ [MARKS[0].id]: 1 });
  });

  it('what is set reaches the hunter and every Shadow in a fight', () => {
    const s = typicalHunter(30, 'C', 'marks-fight');
    s.gates.cleared.push(PRACTICE_GATE.id);
    const d = dungeonById('DNG-016')!;
    shadows.bind(s, d.mobs[0]);
    const before = raid.partySpecs(s, d, '2026-02-04', undefined, now);
    s.ascension.unlocked = 3;
    marks.setMark(s, 'edge');
    marks.setMark(s, 'edge');
    marks.setMark(s, 'legion');
    const after = raid.partySpecs(s, d, '2026-02-04', undefined, now);
    const hero = (xs: typeof before) => xs.find((u) => u.tag === 'hero')!;
    const shadow = (xs: typeof before) => xs.find((u) => u.tag === 'shadow')!;
    const edge = mark('edge').hero!.patk;
    expect((hero(after).bonus!.patk ?? 0) - (hero(before).bonus!.patk ?? 0)).toBeCloseTo(edge * 2, 6);
    expect(new Unit(hero(after)).d.patk).toBeGreaterThan(new Unit(hero(before)).d.patk);
    expect(new Unit(shadow(after)).maxHp).toBeGreaterThan(new Unit(shadow(before)).maxHp);
    expect(new Unit(shadow(after)).d.patk).toBeCloseTo(new Unit(shadow(before)).d.patk * (1 + mark('legion').shadows!.patk), 6);
  });

  it('the Long Stride makes every gate cost less fatigue to walk into', () => {
    const walkIn = (n: number) => {
      const s = typicalHunter(30, 'C', 'marks-stride');
      s.gates.cleared.push(PRACTICE_GATE.id);
      s.ascension.unlocked = n;
      for (let k = 0; k < n; k++) marks.setMark(s, 'stride');
      const f = s.vitals.fatigue;
      raid.begin(s, dungeonById('DNG-016')!, now);
      return s.vitals.fatigue - f;
    };
    expect(walkIn(0)).toBe(RAID_FATIGUE.C);
    expect(walkIn(MARK_MAX)).toBe(Math.round(RAID_FATIGUE.C * (1 - mark('stride').fatigue! * MARK_MAX)));
    expect(walkIn(MARK_MAX)).toBeLessThan(walkIn(0));
  });

  it('stop once every mark is full', () => {
    const s = defaults();
    s.ascension.unlocked = marks.MARKS_MOST + 7;
    expect(marks.unset(s)).toBe(marks.MARKS_MOST);
    marks.setAllBySystem(s);
    expect(marks.unset(s)).toBe(0);
    for (const m of MARKS) expect(marks.setOn(s, m.id)).toBe(MARK_MAX);
  });

  it('read their numbers in words', () => {
    expect(marks.markText(mark('edge'), 2)).toBe(`+${Math.round(mark('edge').hero!.patk * 200)}% attack and magic`);
    expect(marks.markText(mark('stride'))).toContain(`${Math.round(mark('stride').fatigue! * 100)}% less fatigue`);
  });
});

describe('past perfect', () => {
  function perfect() {
    const def = gear.ofRank('C').find((d) => (d.rolls ?? []).length > 0)!;
    const s = defaults();
    gear.grant(s, def.id, 'past|0');
    s.wallet.shards = 100000;
    s.items[0].q = gear.Q_HIGH;
    s.items[0].rolls = (def.rolls ?? []).map((r) => r.max);
    return { s, def };
  }

  it('goes nowhere until a level is opened', () => {
    const { s } = perfect();
    expect(gear.upgradeStep(s.items[0])).toBeNull();
    expect(shop.upgradeCost(s.items[0], gear.overCap(s))).toBeNull();
    expect(shop.upgrade(s, s.items[0].id)).toBe(false);
  });

  it('takes a step past perfect for every level opened, each dearer than the last', () => {
    const { s, def } = perfect();
    s.ascension.unlocked = 3;
    const cap = gear.overCap(s);
    expect(cap).toBe(3 * OVERCHARGE.per);
    let last = 0;
    for (let k = 1; k <= cap; k++) {
      const before = s.items[0];
      const cost = shop.upgradeCost(before, cap)!;
      expect(cost).toBe(shop.overCost('C', k));
      expect(cost).toBeGreaterThan(last);
      last = cost;
      expect(shop.upgrade(s, before.id)).toBe(true);
      expect(s.items[0].over).toBe(k);
      expect(s.items[0].q).toBeCloseTo(before.q + (gear.Q_HIGH - gear.Q_LOW) * OVERCHARGE.share, 6);
      (def.rolls ?? []).forEach((r, i) => expect(s.items[0].rolls[i]).toBeCloseTo(before.rolls[i] + (r.max - r.min) * OVERCHARGE.share, 1));
    }
    expect(shop.upgrade(s, s.items[0].id)).toBe(false);
    expect(gear.qualityText(s.items[0])).toBe(`100% +${cap}`);
    expect(gear.score(s.items[0])).toBeGreaterThan(gear.RARITY.C.score * gear.Q_HIGH);
    // The first step past perfect costs no more than a step toward it; it raises half as much.
    expect(shop.overCost('C', 1)).toBe(shop.stepCost('C'));
    expect(OVERCHARGE.share).toBeLessThan(UPGRADE.share);
  });

  it('a piece below perfect is raised toward it first, at the usual price', () => {
    const { s } = perfect();
    s.ascension.unlocked = 2;
    s.items[0].q = gear.Q_LOW;
    expect(shop.upgradeCost(s.items[0], gear.overCap(s))).toBe(shop.stepCost('C'));
    expect(gear.upgradeStep(s.items[0], gear.overCap(s))!.over).toBeUndefined();
  });
});
