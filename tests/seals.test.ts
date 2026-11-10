import { describe, expect, it } from 'vitest';
import { ALL_DUNGEONS, dungeonById, enemyById, isPractice, PRACTICE_GATE } from '@/core/gates';
import { build, chamberOf, isFight, mapSeed } from '@/core/map';
import * as feats from '@/core/feats';
import * as raid from '@/core/raid';
import * as sealing from '@/core/seals';
import * as shop from '@/core/shop';
import { defaults } from '@/core/save';
import type { Dungeon, Save } from '@/core/types';
import { dayKey } from '@/core/util';
import { CONDITION, FAMILY_CONDITION } from '@/data/drops';
import { FEAT, FEATS_PER_GATE } from '@/data/feats';
import { SEAL, SEALS_PER_GATE, type SealId } from '@/data/seals';
import { ALLOYS } from '@/data/forge';
import { typicalHunter } from '../scripts/hunters';
import { walk } from './walk';

const now = Date.parse('2026-02-02T12:00:00');
const day = dayKey(now);
const board = ALL_DUNGEONS.filter((d) => !isPractice(d) && !d.floor && !d.trial);

/** Win the fight underway without fighting it, so two runs meet exactly the same steps. */
function winPending(s: Save, d: Dungeon) {
  const run = s.gates.raid!;
  const x = raid.pending(d, run)!;
  raid.record(s, d, run, raid.partyFor(s, d, run, now), { index: x.n, label: '', boss: x.kind === 'boss', won: true, rounds: 1, log: [], roster: [], felled: [], kills: {}, drops: [] }, now);
}

/** Walk the System's way to the boss's fall, every fight won unfought. */
function systemClear(s: Save, d: Dungeon) {
  const run = s.gates.raid!;
  for (let guard = 0; guard < 200 && !raid.bossDown(d, run); guard++) {
    const x = raid.pending(d, run);
    if (x && isFight(x)) { winPending(s, d); continue; }
    if (x) { raid.resolve(s, d, run, raid.systemChoice(x), now); continue; }
    if (!raid.systemMove(s, d, run, now)) break;
  }
}

describe('Seals', () => {
  it('a board Gate offers up to three, the same all day, each one that would change something', () => {
    const s = typicalHunter(40, 'B', 'seals');
    let any = 0;
    for (const d of board) {
      const a = sealing.offered(s, d, day);
      expect(a.length).toBeLessThanOrEqual(SEALS_PER_GATE);
      expect(sealing.offered(s, d, day)).toEqual(a);
      if (a.includes('wardens')) expect(d.elite).toBeTruthy();
      if (a.includes('lightless')) expect(build(d, mapSeed(d, day)).nodes.some((x) => x.kind === 'rest')).toBe(true);
      // Heavier Air only once Ascension is open, which a B-Rank hunter has not.
      expect(a).not.toContain('heavier');
      any += a.length;
    }
    expect(any).toBeGreaterThan(board.length * 2);
  });

  it('none below D-Rank, and none on the Practice Gate', () => {
    expect(sealing.offered(defaults(), dungeonById('DNG-001')!, day)).toEqual([]);
    expect(sealing.offered(typicalHunter(40, 'B', 'p'), PRACTICE_GATE, day)).toEqual([]);
  });

  it('a run takes only the Seals offered, and keeps them', () => {
    const s = typicalHunter(40, 'B', 'take');
    const d = board.find((x) => sealing.offered(s, x, day).length >= 2 && x.rank === 'C')!;
    const offer = sealing.offered(s, d, day);
    const run = raid.begin(s, d, now, [...offer, 'heavier']);
    expect(run.seals).toEqual(offer);
  });

  it('each rule plays: Swollen creatures, a guarded boss, one hunter fewer, dark rests, no potions', () => {
    const d = dungeonById('DNG-016')!;
    const c = chamberOf(d, build(d, mapSeed(d, day)).nodes.find((x) => x.kind === 'fight')!);
    const party = () => raid.partyFor(typicalHunter(30, 'C', 'r'), d, raid.begin(typicalHunter(30, 'C', 'r'), d, now), now);
    const hp = (seals: SealId[]) => raid.openChamber(d, 'x', 0, party(), c, { seals }).roster.filter((u) => u.side === 'e').map((u) => u.mx);
    const plain = hp([]);
    hp(['swollen']).forEach((v, i) => expect(v / plain[i]).toBeCloseTo(SEAL.swollen.hp, 1));
    const boss = build(d, mapSeed(d, day)).nodes.find((x) => x.kind === 'boss')!;
    expect(raid.chamberAt(d, boss, 0, null, ['alone']).foes.length).toBe(raid.chamberAt(d, boss).foes.length + 1);
    const allies = raid.alliesAt(d, day, 'C').length;
    expect(raid.alliesAt(d, day, 'C', 0, ['shorthanded']).length).toBe(Math.max(0, allies - SEAL.shorthanded.allies));
    const u = party();
    u[0].hp = 1;
    raid.rest(u, 0, ['lightless']);
    expect(u[0].hp).toBe(1);
    // Dry: no potion in a fight, and none between steps.
    const s = typicalHunter(30, 'C', 'dry');
    shop.stockUp(s, 'hp', 2);
    const run = raid.begin(s, d, now, sealing.offered(s, d, day).includes('dry') ? ['dry'] : []);
    run.seals = ['dry'];
    expect(raid.drinkIdle(s, d, run, now)).toBe('Sealed: Dry');
    expect(raid.order(s, run, { use: 'Potion' })).toBeNull();
    expect(shop.held(s, 'hp')).toBe(2);
  });

  it('pays in materials only: more alloy for Swollen, every part for Short-Handed, a blueprint for Dry', () => {
    const d = board.find((x) => x.rank === 'C' && x.elite)!;
    const paid = (seals: SealId[]) => {
      const s = typicalHunter(30, 'C', 'pay');
      s.gates.cleared.push(d.id);
      const run = raid.begin(s, d, now);
      run.seals = [...seals];
      systemClear(s, d);
      const shards = s.wallet.shards;
      const res = raid.finish(s, d, run, 'cleared', now);
      return { res, shards: s.wallet.shards - shards };
    };
    const plain = paid([]);
    const sealed = paid(['swollen', 'shorthanded', 'dry']);
    expect(sealed.res.mats[ALLOYS.C.id]).toBeGreaterThan(plain.res.mats[ALLOYS.C.id]);
    expect(sealed.res.blueprints.length).toBeGreaterThan(plain.res.blueprints.length);
    for (const k of ['part-hide', 'part-bone', 'part-core']) expect(sealed.res.mats[k] ?? 0).toBeGreaterThanOrEqual((plain.res.mats[k] ?? 0) + SEAL.shorthanded.parts);
    // Never Mana Shards.
    expect(sealed.shards).toBe(plain.shards);
  });

  it('the brief plays the Seals taken: those that reach the System’s road make the C-Rank Gates harder', () => {
    const s = typicalHunter(30, 'C', 'brief');
    let plain = 0, sealed = 0;
    for (const d of board.filter((x) => x.rank === 'C')) {
      const hard = sealing.offered(s, d, day).filter((x) => x === 'swollen' || x === 'alone' || x === 'shorthanded');
      if (!hard.length) continue;
      plain += raid.project(s, d, 24, now).rate;
      sealed += raid.project(s, d, 24, now, hard).rate;
    }
    expect(sealed).toBeLessThan(plain * 0.8);
  });
});

describe('Feats', () => {
  it('every Gate holds three, the same every day; Wardenbane only where there is a Gatekeeper', () => {
    for (const d of board) {
      const f = feats.featsOf(d);
      expect(f).toHaveLength(FEATS_PER_GATE);
      expect(new Set(f).size).toBe(FEATS_PER_GATE);
      expect(feats.featsOf(d)).toEqual(f);
      if (f.includes('keeper')) expect(d.elite).toBeTruthy();
    }
  });

  it('are judged from what the fights recorded', () => {
    const t = { downs: 0, lowest: 0.8, bossRounds: FEAT.swift.rounds, bossBroken: true, keeper: true };
    expect(feats.judge(['unbroken', 'swift', 'breaker', 'keeper', 'steady', 'thorough'], t, true)).toEqual(['unbroken', 'swift', 'breaker', 'keeper', 'steady', 'thorough']);
    expect(feats.judge(['unbroken', 'swift', 'steady'], { downs: 1, lowest: 0.4, bossRounds: FEAT.swift.rounds + 1 }, false)).toEqual([]);
  });

  it('a Feat pays once, the first time it is met on its Gate', () => {
    const s = typicalHunter(40, 'B', 'once');
    const d = board.find((x) => x.rank === 'D')!;
    const clear = () => { const run = raid.begin(s, d, now); walk(s, d, now); return raid.finish(s, d, run, 'cleared', now); };
    const first = clear();
    expect(first.feats.met.length).toBeGreaterThan(0);
    expect(first.feats.fresh).toEqual(first.feats.met);
    expect(feats.metOn(s, d)).toEqual(first.feats.met);
    const again = clear();
    expect(again.feats.fresh.filter((id) => first.feats.met.includes(id))).toEqual([]);
  });

  it('the brief counts how often the System met each, and never Thorough or Wardenbane: its road leaves the road for neither', () => {
    const s = typicalHunter(30, 'C', 'odds');
    for (const d of board.filter((x) => x.rank === 'C').slice(0, 3)) {
      const p = raid.project(s, d, 12, now);
      expect(Object.keys(p.feats).sort()).toEqual([...feats.featsOf(d)].sort());
      for (const [id, n] of Object.entries(p.feats)) {
        expect(n).toBeLessThanOrEqual(p.cleared);
        if (id === 'thorough' || id === 'keeper') expect(n).toBe(0);
      }
    }
  });
});

describe('condition drops', () => {
  it('every family in the bestiary has one, and every boss falls while Broken, to the hunter’s own blow', () => {
    for (const d of board) for (const id of [...d.mobs, d.boss]) expect(FAMILY_CONDITION[enemyById(id)!.family], id).toBeTruthy();
    expect(raid.conditionOf(board[0].boss, true)).toBe('broken');
  });

  it('a creature felled within three rounds, or by the hunter’s or a Shadow’s blow, drops when its condition asks it', () => {
    let checked = 0;
    for (const d of board.filter((x) => ['C', 'B'].includes(x.rank))) {
      const s = typicalHunter(36, d.rank as 'C' | 'B', `drop|${d.id}`);
      const run = raid.begin(s, d, now);
      const m = build(d, mapSeed(d, day));
      for (const x of m.nodes.filter((n) => n.kind === 'fight').slice(0, 3)) {
        const ch = raid.runChamber(d, `drop|${d.id}`, x.n, raid.partyFor(s, d, run, now), chamberOf(d, x));
        const tags = Object.fromEntries(ch.roster.map((u) => [u.uid, u.tag]));
        const refs: Record<string, string> = {};
        // A foe's ref, from the chamber's order of foes.
        chamberOf(d, x).foes.forEach((id, j) => { refs[`e${x.n}-${j}`] = id; });
        let round = 0;
        const last: Record<string, string | null> = {};
        const dropped = new Set(ch.log.filter((e) => e.t === 'drop').map((e) => (e as { v: string }).v));
        for (const e of ch.log) {
          if (e.t === 'round') round++;
          if (e.t === 'hit') last[e.v] = e.a;
          if (e.t === 'tick') last[e.v] = null;
          if (e.t !== 'down' || !refs[e.v]) continue;
          const want = FAMILY_CONDITION[enemyById(refs[e.v])!.family];
          const by = last[e.v] ? tags[last[e.v]!] : null;
          const expected = want === 'quick' ? round <= CONDITION.quick.rounds! : want === 'own' ? by === 'hero' : want === 'shadow' ? by === 'shadow' : null;
          if (expected === null) continue;
          expect(dropped.has(e.v), `${d.id} ${refs[e.v]} ${want}`).toBe(expected);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('what drops is kept on a clear and lost when the party is carried out', () => {
    const d = board.find((x) => x.rank === 'C')!;
    const s = typicalHunter(30, 'C', 'keep');
    const run = raid.begin(s, d, now);
    run.drops = [{ ref: d.mobs[0], boss: false }];
    systemClear(s, d);
    expect(raid.finish(s, d, run, 'cleared', now).drops).toBe(1);
    const t = typicalHunter(30, 'C', 'keep2');
    const lost = raid.begin(t, d, now);
    lost.drops = [{ ref: d.mobs[0], boss: false }];
    expect(raid.finish(t, d, lost, 'defeated', now).drops).toBe(0);
  });
});
