/** Synthetic hunters for the balance tools: a typical player at a given level. */
import { defaults } from '@/core/save';
import { grant, autoEquip, ofRank, upgradeStep, worn } from '@/core/gear';
import { ALL_DUNGEONS } from '@/core/gates';
import * as shadows from '@/core/shadows';
import { autoAllocate, POINTS_PER_LEVEL, RANK_LADDER, RANK_UP_POINTS, syncClass } from '@/core/progression';
import type { Rank } from '@/core/types';
import { RANKS, STATS } from '@/core/types';
import { rng } from '@/core/util';

/** Levels across each grade: its floor, its middle, its top. */
export const LEVELS: Record<Rank, [number, number, number]> = {
  E: [3, 6, 9], D: [10, 15, 19], C: [20, 27, 34], B: [35, 42, 49], A: [50, 60, 69], S: [70, 85, 100],
};

export function typicalHunter(level: number, gearRank: Rank, seed: string) {
  const s = defaults();
  s.hunter.level = level;
  const ranks = RANK_LADDER.filter((r) => r.min <= level && r.min > 1).length;
  // Points from levels and rank-ups. Secret Missions add a little on top; a typical hunter is not counted on to have them.
  s.hunter.points = (level - 1) * POINTS_PER_LEVEL + ranks * RANK_UP_POINTS;
  const r = rng(seed);
  s.hunter.attrs[STATS[Math.floor(r() * 5)]] += 5;
  autoAllocate(s);
  syncClass(s);
  for (const t of ['Head', 'Chest', 'Hands', 'Legs', 'Feet', 'Weapon', 'Off-Hand', 'Amulet', 'Ring', 'Ring']) {
    const gi = RANKS.indexOf(gearRank) - (r() < 0.4 ? 1 : 0);
    if (gi < 0) continue;
    const pool = ofRank(RANKS[gi]).filter((d) => d.slot === t);
    // Seeded ids: an item's rolls come from its id, and a random one made every calibration different.
    if (pool.length) grant(s, pool[Math.floor(r() * pool.length)].id, `${seed}|${t}|${s.items.length}`);
  }
  autoEquip(s);
  return s;
}

/**
 * A hunter who keeps up, as `npm run campaign` finds one: a typical hunter whose worn gear has been
 * upgraded to perfect, with a full squad of Vanguard Shadows taken from their grade's gates.
 */
export function keptUpHunter(level: number, gearRank: Rank, seed: string) {
  const s = typicalHunter(level, gearRank, seed);
  for (const it of worn(s)) {
    const i = s.items.indexOf(it);
    for (let k = 0; k < 20; k++) s.items[i] = upgradeStep(s.items[i]) ?? s.items[i];
  }
  const r = rng(seed + '|shadows');
  const mobs = ALL_DUNGEONS.filter((d) => d.rank === gearRank).flatMap((d) => d.mobs);
  for (let k = 0; k < shadows.slots(s); k++) shadows.bind(s, mobs[Math.floor(r() * mobs.length)]).kills = shadows.SHADOW_RANKS[2].kills;
  return s;
}
