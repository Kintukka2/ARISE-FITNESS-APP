import { describe, expect, it } from 'vitest';
import { defaults } from '@/core/save';
import { dungeonById, PRACTICE_GATE } from '@/core/gates';
import * as raid from '@/core/raid';
import * as blessings from '@/core/blessings';
import * as shop from '@/core/shop';
import { battle, fight, STRIKE, Unit, type Ev, type UnitSpec } from '@/core/combat';
import { autoAllocate, grantXP, reclassifyAll, syncClass, totalXpFor } from '@/core/progression';
import { autoLearn, skillAt } from '@/core/skilltree';
import { BOON_LIST, BOONS, boonValue, FONT_SHARE, OFFER, STEER } from '@/data/blessings';
import { HONE_LEVELS, HONE_PAST, REST_HEAL, REST_LINE, STEADY_POTIONS } from '@/data/nodes';
import { NODES, PATHS } from '@/data/tree';
import { build, chamberOf, mapSeed, type MapNode } from '@/core/map';
import type { OpenRaid, Save } from '@/core/types';
import { rng } from '@/core/util';
import { isFight, toBoss } from './walk';
import * as spire from '@/core/spire';
import { BLOCK } from '@/data/spire';

const now = Date.parse('2026-02-02T12:00:00');
const base = { STR: 10, AGI: 10, PER: 10, VIT: 10, INT: 10 };

function hunter(level: number) {
  const s = defaults();
  grantXP(s, totalXpFor(level));
  reclassifyAll(s);
  s.hunter.attrs.STR += 6;
  autoAllocate(s);
  syncClass(s);
  autoLearn(s);
  return s;
}

/** Every blessing the System could take, at tier III: each that plays without a hand, and changes no hit's reckoning. */
const AUTO = BOON_LIST.filter((b) => !b.hands).map((b) => b.id);
const all = (ids: string[], tier = 3) => ({ blessings: ids, tiers: Object.fromEntries(ids.map((id) => [id, tier])) });

const hero = (boons: Record<string, number> = {}, over: Partial<UnitSpec> = {}) => new Unit({ uid: 'hero', name: 'H', side: 'p', base, tag: 'hero', hpMult: 40, boons, ...over });
const foe = (uid = 'e0', over: Partial<UnitSpec> = {}) => new Unit({ uid, name: uid, side: 'e', base: { ...base, AGI: 1 }, hpMult: 30, ...over });

describe('the blessings', () => {
  it('are eight to each Path, a Duo to each pair of Paths, and a Capstone to each Path from three of its own', () => {
    for (const p of PATHS) expect(BOON_LIST.filter((b) => b.kind === 'path' && b.paths[0] === p.key)).toHaveLength(8);
    const duos = BOON_LIST.filter((b) => b.kind === 'duo');
    expect(duos).toHaveLength(10);
    expect(new Set(duos.map((b) => [...b.paths].sort().join('+'))).size).toBe(10);
    for (const p of PATHS) {
      const caps = BOON_LIST.filter((b) => b.kind === 'capstone' && b.paths[0] === p.key);
      expect(caps).toHaveLength(1);
      expect(caps[0].needs).toHaveLength(3);
      for (const id of caps[0].needs!) expect(BOONS[id]?.paths).toEqual([p.key]);
    }
    expect(new Set(BOON_LIST.map((b) => b.id)).size).toBe(BOON_LIST.length);
  });

  it('every tier says something different, and reads its number from its own table', () => {
    for (const b of BOON_LIST) {
      const lines = b.v.map((v) => b.text(v));
      expect(new Set(lines).size, b.id).toBe(3);
      expect(boonValue(b.id, 2)).toBe(b.v[1]);
    }
  });
});

describe('in the fight', () => {
  it('Rending Strike leaves Bleeding with a Strike, for its tier’s turns', () => {
    const h = hero({ rend: 2 });
    const f = foe();
    const log: Ev[] = [];
    const g = battle([h], [f], rng('rend'), 1, () => {}, log, { hero: 'hero' });
    g.next();
    const from = log.length;
    g.next({ use: STRIKE.name, at: 'e0' });
    const hit = log.slice(from).find((e) => e.t === 'hit' && e.a === 'hero');
    if (hit) expect(log.slice(from).some((e) => e.t === 'status' && e.v === 'e0' && e.s === 'Bleeding')).toBe(true);
  });

  it('Twin Fangs strikes twice, and the reckoning counts both', () => {
    const h = hero({ twin: 3 });
    const f = foe('e0', { hpMult: 200 });
    const log: Ev[] = [];
    const g = battle([h], [f], rng('twin'), 1, () => {}, log, { hero: 'hero' });
    const t = g.next().value as { aims: Record<string, Record<string, { lo: number; critHi: number }>> };
    const r = t.aims[STRIKE.name].e0;
    const from = log.length;
    g.next({ use: STRIKE.name, at: 'e0' });
    const swings = log.slice(from).filter((e) => (e.t === 'hit' || e.t === 'miss') && e.a === 'hero' && e.ab === STRIKE.name);
    expect(swings).toHaveLength(2);
    const dealt = swings.reduce((n, e) => n + (e.t === 'hit' ? e.dmg : 0), 0);
    if (swings.every((e) => e.t === 'hit')) {
      expect(dealt).toBeGreaterThanOrEqual(r.lo);
      expect(dealt).toBeLessThanOrEqual(r.critHi);
    }
  });

  it('Quickdraw acts first in the first round, however slow the hunter', () => {
    const h = hero({ quick: 1 }, { base: { ...base, AGI: 1, PER: 1 } });
    const f = foe('e0', { base: { ...base, AGI: 60 } });
    const { log } = fight([h], [f], rng('quick'), 1);
    const first = log.find((e) => (e.t === 'hit' || e.t === 'miss') && 'a' in e);
    expect(first && 'a' in first ? first.a : '').toBe('hero');
  });

  it('Iron Skin, Last Bastion and Aegis lighten the hits the hunter takes, and the reckoning knows it', () => {
    const plain = hero();
    const iron = hero({ iron: 3, aegis: 3 });
    // One turn each: the foe's threat on the hunter, reckoned, plain and blessed.
    const threatOn = (h: Unit) => {
      const g = battle([h], [foe('e0', { base: { ...base, STR: 40 } })], rng('iron'), 1, () => {}, [], { hero: 'hero' });
      const t = g.next().value as { threats: { hit: { hi: number } | null; guarded: { hi: number } | null }[] };
      return t.threats[0];
    };
    const a = threatOn(plain);
    const b = threatOn(iron);
    expect(b.hit!.hi).toBeLessThan(a.hit!.hi);
    expect(b.guarded!.hi).toBeLessThan(a.guarded!.hi);
    expect(b.guarded!.hi).toBeLessThanOrEqual(Math.ceil(a.guarded!.hi * (1 - BOONS.aegis.v[2]) * (1 - BOONS.iron.v[2])) + 1);
  });

  it('Unbreakable stands the hunter up once, at 1 HP and the share it restores', () => {
    const h = hero({ unbroken: 1 }, { hpMult: 1 });
    const f = foe('e0', { base: { ...base, STR: 80 }, hpMult: 200 });
    const { log } = fight([h], [f], rng('stand'), 2);
    const stood = log.filter((e) => e.t === 'passive' && e.u === 'hero' && e.k === 'stand');
    expect(stood).toHaveLength(1);
    const e = stood[0] as { hp: number };
    expect(e.hp).toBe(1 + Math.round(h.maxHp * BOONS.unbroken.v[0]));
  });

  it('Doom and Black Sun bite a foe at the end of each round, under their own names', () => {
    const h = hero({ doom: 3, sun: 3 });
    const f = foe('e0', { hpMult: 200 });
    f.status.Cursed = 3;
    const log: Ev[] = [];
    const g = battle([h], [f], rng('doom'), 1, () => {}, log, { hero: 'hero' });
    g.next();
    f.status.Cursed = 3;
    g.next({ use: 'Guard' });
    const ticks = log.filter((e) => e.t === 'tick' && e.v === 'e0');
    expect(ticks.some((e) => e.t === 'tick' && (e.s === BOONS.doom.name || e.s === BOONS.sun.name))).toBe(true);
  });

  it('Bannerman starts the party Rallied', () => {
    const h = hero({ banner: 2 });
    const ally = new Unit({ uid: 'a0', name: 'A', side: 'p', base, tag: 'ally' });
    const log: Ev[] = [];
    const g = battle([h, ally], [foe()], rng('banner'), 1, () => {}, log, { hero: 'hero' });
    g.next();
    expect(ally.status.Rallied).toBe(BOONS.banner.v[1]);
    expect(h.status.Rallied).toBe(BOONS.banner.v[1]);
  });

  it('a hunter blessed who gives no orders still fights exactly the auto fight', () => {
    for (const [level, id] of [[24, 'DNG-016'], [40, 'DNG-029']] as const) {
      const s = hunter(level);
      const d = dungeonById(id)!;
      const run = toBoss(d, raid.begin(s, d, now));
      Object.assign(run, all(AUTO));
      const { ch } = raid.resume(s, d, run, now);
      while (ch.turn) ch.play(raid.order(s, run, null));
      const waited = ch.result();
      const auto = raid.runChamber(d, run.seed, raid.pending(d, run)!.n, raid.partyFor(s, d, run, now), raid.chamberAt(d, raid.pending(d, run)!, 0, run.chosen ?? null));
      expect(waited.won).toBe(auto.won);
      expect(waited.log.length).toBe(auto.log.length);
    }
  });

  it('every foe still does what it showed, against a hunter holding every blessing', () => {
    let checked = 0;
    for (const [level, id] of [[24, 'DNG-016'], [40, 'DNG-029'], [55, 'DNG-044']] as const) {
      const s = hunter(level);
      const d = dungeonById(id)!;
      const run = raid.begin(s, d, now);
      Object.assign(run, all(AUTO));
      const m = raid.mapOf(d, run);
      for (const x of m.nodes.filter(isFight)) {
        const ch = raid.runChamber(d, run.seed, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
        const intent: Record<string, { ab: string; at?: string }> = {};
        const fresh = new Set<string>();
        const down = new Set<string>();
        for (const e of ch.log) {
          if (e.t === 'intent') { intent[e.u] = { ab: e.ab, at: e.at }; fresh.add(e.u); continue; }
          if (e.t === 'down') { down.add(e.v); continue; }
          if (e.t !== 'hit' && e.t !== 'miss' && e.t !== 'support' && e.t !== 'stun' && e.t !== 'trick' && e.t !== 'charge') continue;
          if (!e.a.startsWith('e') || !fresh.has(e.a)) continue;
          fresh.delete(e.a);
          if (e.t === 'stun' || e.t === 'trick') continue;
          if (e.t === 'charge') { expect(e.ab).toBe(intent[e.a].ab); continue; }
          expect(e.ab).toBe(intent[e.a].ab);
          const at = intent[e.a].at;
          if (at && !down.has(at) && e.t !== 'support') expect(e.v).toBe(at);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('every hit the hunter lands with a blessing falls inside the range their turn reckoned for it', () => {
    // Twin Fangs is reckoned as both its hits, and Red Harvest takes what is left: each has its own test.
    const ids = AUTO.filter((id) => id !== 'twin' && id !== 'harvest');
    let checked = 0;
    for (const [level, id] of [[8, 'DNG-004'], [12, 'DNG-007'], [24, 'DNG-016'], [40, 'DNG-029'], [55, 'DNG-044']] as const) {
      const s = hunter(level);
      const d = dungeonById(id)!;
      const run = toBoss(d, raid.begin(s, d, now));
      Object.assign(run, all(ids));
      const { ch } = raid.resume(s, d, run, now);
      let k = 0;
      while (ch.turn) {
        const t = ch.turn;
        const uses = Object.keys(t.aims);
        const use = uses[k % uses.length];
        const at = t.foes[k % t.foes.length];
        const r = t.aims[use][at];
        const from = ch.log.length;
        ch.play(raid.order(s, run, { use, at }));
        const hit = ch.log.slice(from).find((e) => e.t === 'hit' && e.a === t.uid && e.v === at && e.ab === use);
        if (hit && hit.t === 'hit') {
          expect(hit.dmg).toBeGreaterThanOrEqual(r.lo);
          expect(hit.dmg).toBeLessThanOrEqual(hit.crit ? r.critHi : r.hi);
          checked++;
        }
        k++;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});

/** A run at a gate, its blessings as given. */
function runAt(s: Save, id: string, held: string[] = []) {
  const d = dungeonById(id)!;
  const run = raid.begin(s, d, now);
  Object.assign(run, all(held, 1));
  return { d, run };
}

/** A node of a kind, as a map would hold it, to draw offers on. */
const node = (kind: MapNode['kind'], id = 'n1'): MapNode => ({ id, kind, layer: 1, n: 1, next: [] } as unknown as MapNode);

describe('shrines and Fonts', () => {
  it('a shrine offers three of its Path, drawn the same for the same run and room', () => {
    const s = hunter(24);
    const { run } = runAt(s, 'DNG-016');
    const x = node('shrine');
    const o = blessings.offerFor(run, x);
    expect(o.picks).toHaveLength(OFFER);
    for (const p of o.picks) expect(BOONS[p.id].paths).toContain(o.path);
    expect(blessings.offerFor(run, x)).toEqual(o);
  });

  it('leans toward the Path the hunter has spent most in, as they walked in', () => {
    const s = hunter(30);
    const { run } = runAt(s, 'DNG-016');
    expect(run.lean).toBe(blessings.leanOf(s));
    let lean = 0;
    const n = 700;
    for (let i = 0; i < n; i++) if (blessings.shrinePath({ ...run, seed: `lean|${i}` }, node('shrine', `x${i}`)) === run.lean) lean++;
    expect(Math.abs(lean / n - STEER / (STEER + PATHS.length - 1))).toBeLessThan(0.06);
  });

  it('offers a Duo only once a blessing of each of its Paths is held, and a Capstone only from two of its three', () => {
    const run = { seed: 'x', blessings: [] as string[] };
    expect(blessings.eligible(run, BOONS.jugg)).toBe(false);
    run.blessings = ['rend'];
    expect(blessings.eligible(run, BOONS.jugg)).toBe(false);
    run.blessings = ['rend', 'iron'];
    expect(blessings.eligible(run, BOONS.jugg)).toBe(true);
    expect(blessings.eligible(run, BOONS.harvest)).toBe(false);
    run.blessings = ['rend', 'feast'];
    expect(blessings.eligible(run, BOONS.harvest)).toBe(true);
    run.blessings = ['rend', 'feast', 'harvest'];
    expect(blessings.eligible(run, BOONS.harvest)).toBe(false);
  });

  it('the offer is written as the hunter steps in, and the blessing taken is the one picked, at its tier', () => {
    const s = hunter(24);
    const d = dungeonById('DNG-016')!;
    const day = '2026-02-02';
    const m = build(d, mapSeed(d, day));
    const x = m.nodes.find((y) => y.kind === 'shrine' || y.kind === 'font');
    if (!x) return;
    const run = raid.begin(s, d, now);
    run.path = [];
    run.at = 0;
    // Stand next to it and step in.
    run.path = [x.id];
    run.offers = { [x.id]: blessings.offerFor(run, x) };
    const o = run.offers[x.id];
    const out = raid.resolve(s, d, run, 1, now)!;
    expect(out.blessing).toBe(o.picks[1].id);
    expect(blessings.tierOf(run, o.picks[1].id)).toBe(o.picks[1].tier);
  });

  it('a Font raises a blessing held a tier, and with none to raise blesses as a shrine does', () => {
    const run = { seed: 'f', lean: 'STR' as const, blessings: ['rend', 'iron'], tiers: { rend: 1, iron: 3 } };
    const f = node('font');
    const o = blessings.offerFor(run, f);
    expect(o.font).toBe(true);
    expect(o.picks.map((p) => p.id)).toEqual(['rend']);
    expect(o.picks[0].tier).toBe(2);
    blessings.take(run, o.picks[0]);
    expect(blessings.tierOf(run, 'rend')).toBe(2);
    const none = { seed: 'f', lean: 'STR' as const, blessings: [] as string[] };
    const o2 = blessings.offerFor(none, f);
    expect(o2.font).toBeUndefined();
    expect(o2.picks).toHaveLength(OFFER);
  });

  it('about a quarter of shrines are Fonts, and the System walks the road it walked before them', () => {
    let shrines = 0;
    let fonts = 0;
    for (const id of ['DNG-016', 'DNG-029', 'DNG-044']) {
      const d = dungeonById(id)!;
      for (let k = 0; k < 40; k++) {
        const m = build(d, mapSeed(d, `2026-03-${String(1 + (k % 28)).padStart(2, '0')}|${k}`));
        shrines += m.nodes.filter((x) => x.kind === 'shrine').length;
        fonts += m.nodes.filter((x) => x.kind === 'font').length;
      }
    }
    expect(fonts / (shrines + fonts)).toBeGreaterThan(FONT_SHARE - 0.1);
    expect(fonts / (shrines + fonts)).toBeLessThan(FONT_SHARE + 0.1);
    expect(build(PRACTICE_GATE, mapSeed(PRACTICE_GATE, '2026-02-02')).nodes.some((x) => x.kind === 'font')).toBe(false);
  });

  it('the System never takes what only a hand plays, and takes the highest tier it can', () => {
    const o = { path: 'VIT' as const, picks: [{ id: 'aegis', tier: 3 }, { id: 'iron', tier: 1 }, { id: 'last', tier: 2 }] };
    expect(blessings.systemPick(o)).toBe(2);
    const caps = { path: 'STR' as const, picks: [{ id: 'rend', tier: 2 }, { id: 'harvest', tier: 2 }, { id: 'jugg', tier: 2 }] };
    expect(blessings.systemPick(caps)).toBe(1);
    const run = { seed: 'x', blessings: ['rend', 'iron'], tiers: { rend: 2, iron: 1 } };
    const font = { path: 'STR' as const, font: true, picks: [{ id: 'rend', tier: 3 }, { id: 'iron', tier: 2 }] };
    expect(blessings.systemPick(font, run)).toBe(1);
  });

  it('the brief projects the blessings the System takes, and the same each time', () => {
    const s = hunter(30);
    const d = dungeonById('DNG-029')!;
    expect(raid.project(s, d, 6, now)).toEqual(raid.project(s, d, 6, now));
  });
});

describe('rests', () => {
  /** A run standing on a rest it has found. */
  function atRest(level = 30) {
    const s = hunter(level);
    const d = dungeonById('DNG-016')!;
    const day = '2026-02-02';
    for (let k = 0; k < 60; k++) {
      const at = now + k * 86400000;
      const m = build(d, mapSeed(d, new Date(at).toISOString().slice(0, 10)));
      const x = m.nodes.find((y) => y.kind === 'rest');
      if (!x) continue;
      const run = raid.begin(s, d, at);
      run.path = [x.id];
      run.at = 1;
      run.pos = x.id;
      return { s, d, run, x, at };
    }
    throw new Error(`No rest in ${d.id} near ${day}`);
  }

  it('Heal restores its share and leaves the debuffs, Steady lifts them and fills a potion', () => {
    const { s, d, run, at } = atRest();
    run.carried[0].hp = 10;
    run.carried[0].status = { Bleeding: 2 };
    const max = raid.partyFor(s, d, run, at)[0].maxHp;
    const r1 = structuredClone(run);
    const s1 = structuredClone(s);
    expect(raid.restHere(s1, d, r1, { kind: 'heal' }, at)).toBe(true);
    expect(r1.carried[0].hp).toBeCloseTo(Math.min(max, 10 + max * REST_HEAL), 5);
    expect(r1.carried[0].status.Bleeding).toBe(2);
    s.stock.hp = 0;
    expect(raid.restHere(s, d, run, { kind: 'steady' }, at)).toBe(true);
    expect(run.carried[0].status.Bleeding).toBeUndefined();
    expect(run.carried[0].hp).toBe(10);
    expect(shop.held(s, 'hp')).toBe(STEADY_POTIONS);
    expect(raid.restHere(s, d, run, { kind: 'heal' }, at)).toBe(false);
  });

  it('Steady fills no potion past the satchel’s limit', () => {
    const { s, d, run, at } = atRest();
    s.stock.hp = shop.satchelMax(s);
    raid.restHere(s, d, run, { kind: 'steady' }, at);
    expect(shop.held(s, 'hp')).toBe(shop.satchelMax(s));
  });

  it('Hone raises one skill a level for the rest of the Gate, and past Lv.MAX by a level’s force', () => {
    const { s, d, run, at } = atRest();
    const name = raid.honeable(run)[0];
    expect(name).toBeTruthy();
    const before = raid.partyFor(s, d, run, at)[0].ab(name)!;
    expect(raid.restHere(s, d, run, { kind: 'hone', skill: name }, at)).toBe(true);
    const after = raid.partyFor(s, d, run, at)[0].ab(name)!;
    expect(after.mult).toBeGreaterThan(before.mult);
    const n = NODES.find((x) => x.kind === 'skill' && x.name === name)!;
    expect(raid.honedLevel(run, name)).toBe((run.levels![name] ?? 1) + HONE_LEVELS);
    // Past Lv.MAX, a level's force each time.
    if (raid.honedLevel(run, name) > n.max) expect(after.mult).toBeCloseTo(skillAt(n, n.max).mult + (raid.honedLevel(run, name) - n.max) * HONE_PAST, 5);
    // A skill not equipped cannot be honed.
    expect(raid.restHere(s, d, { ...(structuredClone(run) as OpenRaid), rested: [] }, { kind: 'hone', skill: 'Nothing' }, at)).toBe(false);
  });

  it('the System heals below its line and hones above it; where a rest heals nothing, it hones', () => {
    const { run } = atRest();
    expect(raid.systemRestPick(REST_LINE - 0.01, run).kind).toBe('heal');
    expect(raid.systemRestPick(Math.min(1, REST_LINE + 0.01), run).kind).toBe('hone');
    expect(raid.systemRestPick(0.1, run, 0, ['lightless']).kind).toBe('hone');
    expect(raid.systemRestPick(0.1, { ...run, party: [{ ...run.party[0], kit: [] }] }, 0, ['lightless']).kind).toBe('steady');
  });

  it('up a tower, a rest waits on the hunter, and the climb goes on from it', () => {
    const s = hunter(40);
    const d = spire.spireBlock(spire.seasonOf('2026-02-04'), 0);
    const at = Date.parse('2026-02-04T12:00:00');
    const run = raid.begin(s, d, at);
    const m = raid.mapOf(d, run);
    // Every floor before the rest as written, the rest stepped onto.
    run.path = m.layers.slice(0, BLOCK - 1).map((l) => l[0].id);
    run.at = BLOCK - 2;
    expect(raid.pending(d, run)?.kind).toBe('rest');
    expect(raid.canRest(d, run)).toBe(true);
    expect(raid.canWithdraw(d, run)).toBe(false);
    expect(raid.restHere(s, d, run, { kind: 'heal' }, at)).toBe(true);
    expect(run.at).toBe(BLOCK - 1);
    expect(raid.canRest(d, run)).toBe(false);
    expect(raid.canWithdraw(d, run)).toBe(true);
  });
});
