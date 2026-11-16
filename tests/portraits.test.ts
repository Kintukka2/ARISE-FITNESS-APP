import { describe, expect, it } from 'vitest';
import { ENEMIES } from '@/data/enemies';
import { kindOf, PORTRAIT, portraitPath, type Kind } from '@/ui/portraits';

describe('creature portraits', () => {
  it('every creature has a portrait of its kind, and every kind drawn is some creature\'s', () => {
    const used = new Set<Kind>();
    for (const e of ENEMIES) {
      const k = kindOf(e.id);
      expect(k, e.name).toBeDefined();
      used.add(k!);
    }
    expect([...used].sort()).toEqual((Object.keys(PORTRAIT) as Kind[]).sort());
  });

  it('every portrait has a body and lit eyes, drawn on the 24 grid', () => {
    for (const [k, p] of Object.entries(PORTRAIT)) {
      expect(p.body.length, k).toBeGreaterThan(0);
      expect(p.eyes.length, k).toBeGreaterThan(0);
      // Every coordinate a portrait names stays on its grid, with a little room for a curve's handles.
      for (const n of portraitPath(k as Kind).match(/-?\d+(\.\d+)?/g)!.map(Number)) expect(n, k).toBeLessThanOrEqual(26);
    }
  });
});
