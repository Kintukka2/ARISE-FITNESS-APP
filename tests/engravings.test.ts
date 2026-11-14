import { describe, expect, it } from 'vitest';
import { battle, Unit, type Ev, type Turn } from '@/core/combat';
import * as engravings from '@/core/engravings';
import * as forge from '@/core/forge';
import { dungeonById, ALL_DUNGEONS, enemyById } from '@/core/gates';
import { defOf, equip, grant, ofRank, SLOTS } from '@/core/gear';
import * as raid from '@/core/raid';
import { defaults } from '@/core/save';
import type { Order, Save } from '@/core/types';
import { rng } from '@/core/util';
import { ENGRAVE, ENGRAVE_EMBER, ENGRAVED, ENGRAVINGS, GROUPS, engravingById } from '@/data/engravings';
import { FAMILY_PART } from '@/data/forge';

const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };

/** A piece of a slot and rarity, granted and worn. */
function wear(s: Save, slot: string, rank = 'C', engr?: string) {
  const def = ofRank(rank as 'C').find((d) => d.slot === slot)!;
  const it = grant(s, def.id, `${slot}|${s.items.length}`)!;
  if (engr) it.engr = engr;
  equip(s, it.id);
  return it;
}

function play(party: Unit[], foes: Unit[], seed: string, pick: (t: Turn) => Order | null) {
  const log: Ev[] = [];
  const g = battle(party, foes, rng(seed), 2, () => {}, log, { hero: 'hero', potions: 3 });
  let step = g.next();
  while (!step.done) step = g.next(pick(step.value));
  return log;
}

const hero = (passives: string[], extra = {}) => new Unit({ uid: 'hero', name: 'H', side: 'p', base: { ...base, VIT: 20 }, tag: 'hero', hpMult: 40, passives, ...extra });
const foe = (j: number, extra = {}) => new Unit({ uid: `e${j}`, name: `F${j}`, side: 'e', base: { ...base, AGI: 5 + j * 4 }, hpMult: 6, ...extra });
const nameOf = (id: string) => engravingById(id)!.name;

describe('the engravings', () => {
  it('give every family one engraving, and each kind its part: bone weapons, hide armour, cores jewellery', () => {
    const families = Object.keys(FAMILY_PART);
    expect(ENGRAVINGS.map((e) => e.family).sort()).toEqual(families.sort());
    const part = { weapon: 'bone', armour: 'hide', jewellery: 'core' } as const;
    for (const e of ENGRAVINGS) expect(FAMILY_PART[e.family]).toBe(part[e.group]);
    expect(new Set(ENGRAVINGS.map((e) => e.name)).size).toBe(ENGRAVINGS.length);
  });

  it('keep one live to each kind: a second engraved piece of a kind worn is dormant', () => {
    const s = defaults();
    wear(s, 'Weapon', 'C', 'undead');
    const head = wear(s, 'Head', 'C', 'insectoid');
    const chest = wear(s, 'Chest', 'C', 'dragonkin');
    wear(s, 'Amulet', 'C', 'plant');
    expect(engravings.live(s).sort()).toEqual(['insectoid', 'plant', 'undead']);
    expect(engravings.dormant(s, head)).toBe(false);
    expect(engravings.dormant(s, chest)).toBe(true);
    // They ride into the fight by name, and only those live.
    const spec = raid.heroSpec(s);
    expect(spec.passives).toEqual(expect.arrayContaining(['Withering Strike', 'Carapace', 'Overgrowth']));
    expect(spec.passives).not.toContain('Dragonscale');
  });

  it('keep a recycled piece’s engraving in the Codex for good', () => {
    const s = defaults();
    const def = ofRank('D').find((d) => d.slot === 'Hands')!;
    const it = grant(s, def.id, 'gloves')!;
    it.engr = 'beast';
    expect(engravings.known(s, 'beast')).toBe(false);
    forge.recycle(s, it.id);
    expect(engravings.known(s, 'beast')).toBe(true);
  });

  it('cut a power from the Codex into a piece of its kind for Ember, keeping what it replaces', () => {
    const s = defaults();
    const ring = wear(s, 'Ring', 'B', 'slime');
    expect(engravings.blocked(s, ring.id, 'plant')).toBe('unknown');
    engravings.learn(s, 'plant');
    engravings.learn(s, 'undead');
    expect(engravings.blocked(s, ring.id, 'undead')).toBe('kind');
    expect(engravings.blocked(s, ring.id, 'plant')).toBe('ember');
    s.materials = { ...s.materials, [forge.EMBER.id]: ENGRAVE_EMBER.B + 5 };
    expect(engravings.engrave(s, ring.id, 'plant')).toEqual({ from: 'slime', to: 'plant' });
    expect(ring.engr).toBe('plant');
    expect(s.materials[forge.EMBER.id]).toBe(5);
    // What the piece held is kept, so nothing found is lost.
    expect(engravings.known(s, 'slime')).toBe(true);
  });

  it('are left by a clear’s boss and Gatekeeper at their stated odds, of the Gate’s grade and the engraving’s kind', () => {
    const gates = ALL_DUNGEONS.filter((d) => !d.trial && d.id !== 'DNG-000' && !d.floor);
    let boss = 0, keeper = 0, tries = 0, keeps = 0;
    for (const d of gates) {
      for (let n = 0; n < 60; n++) {
        tries++;
        // The boss alone: a run whose Gatekeeper did not fall.
        const alone = engravings.engravedDrops(d, `seed|${d.id}|${n}`, false);
        boss += alone.length;
        const got = engravings.engravedDrops(d, `seed|${d.id}|${n}`, true);
        if (d.elite) { keeps++; keeper += got.length - alone.length; }
        for (const x of got) {
          const e = engravingById(x.engr)!;
          const def = defOf({ id: '', defId: x.defId, q: 1, rolls: [] })!;
          expect(def.rank).toBe(d.rank);
          expect(GROUPS.find((g) => g.key === e.group)!.slots).toContain(def.slot);
          expect([enemyById(d.boss)?.family, d.elite ? enemyById(d.elite)?.family : undefined]).toContain(e.family);
        }
        // The same run leaves the same pieces.
        expect(engravings.engravedDrops(d, `seed|${d.id}|${n}`, true)).toEqual(got);
      }
    }
    expect(boss / tries).toBeGreaterThan(ENGRAVED.boss * 0.6);
    expect(boss / tries).toBeLessThan(ENGRAVED.boss * 1.5);
    expect(keeper / keeps).toBeGreaterThan(ENGRAVED.keeper * 0.6);
    expect(keeper / keeps).toBeLessThan(ENGRAVED.keeper * 1.5);
    // The Practice Gate and a Trial leave none.
    expect(engravings.engravedDrops(dungeonById('DNG-000')!, 'x', true)).toEqual([]);
  });

  it('every slot belongs to a kind', () => {
    for (const sl of SLOTS) expect(engravings.groupOfSlot(sl.accepts)).toBeTruthy();
  });
});

describe('the engravings in the fight', () => {
  it('Carapace: the first hit the hunter takes in a fight deals nothing', () => {
    let seen = 0;
    for (let n = 0; n < 10; n++) {
      const log = play([hero([nameOf('insectoid')])], [foe(0), foe(1)], `carapace|${n}`, () => null);
      const first = log.find((e) => e.t === 'hit' && e.v === 'hero');
      if (!first || first.t !== 'hit') continue;
      expect(first.dmg).toBe(0);
      expect(log.filter((e) => e.t === 'passive' && e.p === 'Carapace').length).toBe(1);
      seen++;
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('Withering Strike: Strike inflicts Weakened', () => {
    const log = play([hero([nameOf('undead')])], [foe(0, { hpMult: 30 })], 'wither', () => ({ use: 'Strike', at: 'e0' }));
    expect(log.some((e) => e.t === 'status' && e.v === 'e0' && e.s === 'Weakened')).toBe(true);
  });

  it('Dragonscale: the hunter cannot be Burning or Poisoned', () => {
    const u = hero([nameOf('dragonkin')]);
    expect(u.imm).toEqual(expect.arrayContaining(['Burning', 'Poisoned']));
  });

  it('Unseen: the hunter starts each fight Veiled', () => {
    const log = play([hero([nameOf('aberration')])], [foe(0)], 'unseen', () => null);
    const first = log.findIndex((e) => e.t === 'round');
    expect(log.slice(0, first).some((e) => e.t === 'status' && e.v === 'hero' && e.s === 'Veiled')).toBe(true);
  });

  it('Pack Hide: Guard weakens each foe whose next action is aimed at the hunter', () => {
    let weakened = 0;
    for (let n = 0; n < 10; n++) {
      const log = play([hero([nameOf('beast')])], [foe(0), foe(1)], `pack|${n}`, () => ({ use: 'Guard' }));
      weakened += log.filter((e) => e.t === 'status' && e.s === 'Weakened' && e.v.startsWith('e')).length;
    }
    expect(weakened).toBeGreaterThan(0);
  });

  it('Tidewater: a Health Potion clears the hunter’s debuffs and veils them', () => {
    const h = hero([nameOf('aquatic')]);
    h.status.Bleeding = 3;
    h.status.Weakened = 3;
    let drank = false;
    const log = play([h], [foe(0)], 'tide', () => (drank ? null : ((drank = true), { use: 'Potion' })));
    const heal = log.findIndex((e) => e.t === 'heal' && e.a === 'hero');
    expect(heal).toBeGreaterThan(-1);
    const after = log.slice(heal);
    expect(after.some((e) => e.t === 'status' && e.v === 'hero' && e.s === 'Veiled')).toBe(true);
    expect(after.some((e) => e.t === 'expire' && e.v === 'hero' && e.s === 'Weakened')).toBe(true);
  });

  it('Overgrowth: the hunter’s Shadows mend at the end of each round', () => {
    const shadow = new Unit({ uid: 's0', name: 'S', side: 'p', base, tag: 'shadow', hpMult: 10 });
    shadow.hp = Math.round(shadow.maxHp / 2);
    const log = play([hero([nameOf('plant')]), shadow], [foe(0, { hpMult: 20 })], 'grow', () => null);
    expect(log.some((e) => e.t === 'heal' && e.a === 's0' && 'ab' in e && e.ab === 'Overgrowth')).toBe(true);
    expect(ENGRAVE.overgrowth).toBeGreaterThan(0);
  });
});
