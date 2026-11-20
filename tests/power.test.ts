import { describe, expect, it } from 'vitest';
import { POWER_SHOWN, powerGap, powerText } from '@/ui/power';

describe('power as the hunter reads it', () => {
  it('is shown at POWER_SHOWN times the engine’s figure, compact past a thousand', () => {
    expect(POWER_SHOWN).toBe(150);
    // The owner's two: 666 against 2382.
    expect(powerText(666)).toBe('99.9k');
    expect(powerText(2382)).toBe('357.3k');
    expect(powerText(0)).toBe('0');
    expect(powerText(5)).toBe('750');
    expect(powerText(800)).toBe('120k');
    expect(powerText(7000)).toBe('1.1M');
    // Just under a million rolls up to the millions, never `1000k`.
    expect(powerText(6666.6)).toBe('1M');
  });

  it('shows a difference without its sign, beside its ▲ or ▼', () => {
    expect(powerGap(-12)).toBe('1.8k');
    expect(powerGap(3)).toBe('450');
  });
});
