/**
 * Feats, as the engine judges them: a Gate's three, its fights counted as they are recorded, and what a
 * clear met. A Feat pays once, the first time it is met on its Gate (`settle`), whoever fought: the hunter
 * or the System. The brief counts how often the System met each in its runs (`raid.project`).
 */
import { FEAT, FEAT_IDS, FEATS_PER_GATE, type FeatId } from '@/data/feats';
import type { ChamberResult } from './raid';
import type { Dungeon, RunTally, Save } from './types';
import { rng } from './util';

/** A Gate's three Feats, the same every day: drawn from the Gate itself, among those that fit it. */
export function featsOf(d: Dungeon): FeatId[] {
  const fits = FEAT_IDS.filter((id) => (id === 'keeper' ? !!d.elite : true));
  const r = rng(`arise|feats|${d.shape ?? d.id}`);
  const pool = [...fits];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, FEATS_PER_GATE).sort((a, b) => FEAT_IDS.indexOf(a) - FEAT_IDS.indexOf(b));
}

/** A fight folded into the run's tally: who fell on the party's side, the boss's fight, the hunter's lowest. */
export function count(t: RunTally, ch: ChamberResult, elite: boolean): RunTally {
  const party = new Set(ch.roster.filter((u) => u.side === 'p').map((u) => u.uid));
  const hero = ch.roster.find((u) => u.tag === 'hero');
  const boss = ch.boss ? ch.roster.find((u) => u.side === 'e')?.uid : undefined;
  let downs = 0;
  let lowest = t.lowest;
  let broken = false;
  for (const e of ch.log) {
    if (e.t === 'down' && party.has(e.v)) downs++;
    if ((e.t === 'hit' || e.t === 'tick') && hero && e.v === hero.uid) lowest = Math.min(lowest, Math.max(0, e.hp) / Math.max(1, hero.mx));
    if (e.t === 'break' && boss && e.v === boss) broken = true;
  }
  return {
    downs: t.downs + downs,
    lowest,
    ...(t.bossRounds !== undefined || (ch.boss && ch.won) ? { bossRounds: ch.boss && ch.won ? ch.rounds : t.bossRounds } : {}),
    ...(t.bossBroken || broken ? { bossBroken: true } : {}),
    ...(t.keeper || (elite && ch.won) ? { keeper: true } : {}),
    rounds: (t.rounds ?? 0) + ch.rounds,
  };
}

/** The Feats a cleared run met, of those asked: `every` is whether every room on the plan was cleared. */
export function judge(asked: readonly FeatId[], t: RunTally, every: boolean): FeatId[] {
  const met: Record<FeatId, boolean> = {
    unbroken: t.downs === 0,
    swift: t.bossRounds !== undefined && t.bossRounds <= FEAT.swift.rounds,
    breaker: !!t.bossBroken,
    keeper: !!t.keeper,
    thorough: every,
    steady: t.lowest > FEAT.steady.above,
  };
  return asked.filter((id) => met[id]);
}

/** The Feats already met on a Gate. */
export const metOn = (s: Save, d: Dungeon): FeatId[] => s.gates.feats?.[d.id] ?? [];

/** Record the Feats a clear met; returns the ones met for the first time, which pay. Mutates. */
export function settle(s: Save, d: Dungeon, met: readonly FeatId[]): FeatId[] {
  const had = metOn(s, d);
  const fresh = met.filter((id) => !had.includes(id));
  if (fresh.length) s.gates.feats = { ...(s.gates.feats ?? {}), [d.id]: [...had, ...fresh] };
  return fresh;
}
