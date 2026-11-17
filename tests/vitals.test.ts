import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import * as shop from '@/core/shop';
import * as vitals from '@/core/vitals';

const HOUR = 36e5;

describe('carried out', () => {
  it('leaves the hunter on 1 HP with Fatigue at its most, and locks nothing', () => {
    const s = defaults();
    const now = Date.UTC(2026, 10, 17, 12);
    vitals.settle(s, now);
    vitals.wipe(s, now);
    const v = vitals.read(s, now);
    expect(v.hp).toBe(vitals.WIPE_HP);
    expect(v.fatigue).toBe(vitals.FATIGUE_MAX);
    // At the most fatigue, the hunter fights at half strength until it eases.
    expect(v.drag).toBe(0.5);
    expect(vitals.canRaid(s, now)).toEqual({ ok: true });
    // An hour on, both have eased as they always do.
    const later = vitals.read(s, now + HOUR);
    expect(later.hp).toBeGreaterThan(vitals.WIPE_HP);
    expect(later.fatigue).toBe(vitals.FATIGUE_MAX - vitals.FATIGUE_PER_HOUR);
  });

  it('lifts an older save\'s lockout as it is read', () => {
    const s = defaults();
    const now = Date.UTC(2026, 10, 17, 12);
    vitals.settle(s, now);
    s.vitals.lockedUntil = now + 12 * HOUR;
    expect(vitals.canRaid(s, now)).toEqual({ ok: true });
    vitals.settle(s, now);
    expect(s.vitals.lockedUntil).toBeNull();
  });

  it('a hunter who leaves a Gate downed leaves alive', () => {
    const s = defaults();
    const now = Date.UTC(2026, 10, 17, 12);
    vitals.setHpFraction(s, 0, now);
    expect(vitals.read(s, now).hp).toBe(0);
    vitals.standUp(s, now);
    expect(vitals.read(s, now).hp).toBe(vitals.WIPE_HP);
  });

  it('sells no potion that lifts a lockout, for there is none', () => {
    expect(shop.POTIONS.map((p) => p.id)).toEqual(['hp', 'mp', 'fatigue']);
  });
});
