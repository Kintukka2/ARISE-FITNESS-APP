import { describe, expect, it } from 'vitest';
import { defaults, parse, STORAGE_KEY } from '@/core/save';
import { POTIONS, SATCHEL } from '@/core/shop';

describe('save', () => {
  it('round-trips and fills in missing fields', () => {
    const s = defaults();
    s.hunter.name = 'TEST';
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.stats.comebacks;
    delete raw.settings;
    const back = parse(JSON.stringify(raw))!;
    expect(back.hunter.name).toBe('TEST');
    expect(back.stats.comebacks).toBe(0);
    expect(back.settings.sound).toBe(true);
  });

  it('keeps records keyed by id across a reload', () => {
    const s = defaults();
    s.equipped.head = 'it1';
    s.stats.killsByFamily.Undead = 20;
    s.gates.runs['DNG-001'] = { fought: 2, cleared: 1 };
    const back = parse(JSON.stringify(s))!;
    expect(back.equipped.head).toBe('it1');
    expect(back.stats.killsByFamily.Undead).toBe(20);
    expect(back.gates.runs['DNG-001'].cleared).toBe(1);
  });

  it('a field of the wrong type falls back to its default', () => {
    const raw = JSON.parse(JSON.stringify(defaults()));
    raw.items = 'garbage';
    raw.hunter.level = 'nine';
    const back = parse(JSON.stringify(raw))!;
    expect(back.items).toEqual([]);
    expect(back.hunter.level).toBe(1);
  });

  it('starts a hunter at E-Rank, and lets an older save keep the rank its level had given it', () => {
    expect(defaults().hunter.rank).toBe('E');
    const old = defaults() as unknown as Record<string, Record<string, unknown>>;
    old.v = 3 as never;
    old.hunter.level = 32;
    delete old.hunter.rank;
    expect(parse(JSON.stringify(old))?.hunter.rank).toBe('C');
    // A save already on v4 keeps the rank it holds, whatever its level would qualify for.
    const held = defaults();
    held.hunter.level = 32;
    held.hunter.rank = 'D';
    expect(parse(JSON.stringify(held))?.hunter.rank).toBe('D');
  });

  it('folds the field potions an older save carried into its Health Potions, as many as the satchel holds', () => {
    const old = defaults() as unknown as Record<string, unknown> & { wallet: { shards: number; earned: number } };
    old.v = 8;
    old.satchel = 3;
    old.satchelPlus = 1;
    old.stock = { hp: 2, mp: 1 };
    old.wallet.shards = 100;
    old.assoc = { n: 4, reported: 4, quest: { n: 4, kind: 'clear', grade: 'C', gate: 'DNG-020', need: 1, got: 0, xp: 100, reward: { kind: 'field', n: 2 } } };
    (old.settings as { skipAsk: string[] }).skipAsk = ['buy:field', 'drink:hp'];
    const s = parse(JSON.stringify(old))!;
    // The satchel holds four: two held and two of the three carried; the third is paid back.
    expect(s.stock.hp).toBe(SATCHEL + 1);
    expect(s.stock.mp).toBe(1);
    expect(s.wallet.shards).toBe(100 + POTIONS.find((p) => p.id === 'hp')!.price);
    expect('satchel' in s).toBe(false);
    expect(s.assoc.quest?.reward).toEqual({ kind: 'potion', id: 'hp', n: 2 });
    expect(s.settings.skipAsk).toEqual(['drink:hp']);
  });

  it('rejects things that are not saves', () => {
    expect(parse('nope')).toBeNull();
    expect(parse('{"a":1}')).toBeNull();
  });

  it('never shares a key with the fitness app it was carved from', () => {
    expect(STORAGE_KEY).not.toBe('arise:save');
  });
});
