/**
 * Seals, as the engine plays them: which a Gate offers today, and what the ones a run walked in with do to
 * it. Each reads only the run's own list (`run.seals`), as every Ascension rule reads `run.ascension`, so a
 * Seal taken never reaches a run already open. Pay is settled with the rest of the run in `raid.finish`.
 */
import { SEAL, SEAL_IDS, SEALS_FROM, SEALS_PER_GATE, type SealId } from '@/data/seals';
import { ASCENSION_RULED } from '@/data/ascension';
import * as asc from './ascension';
import { isPractice, rankIdx } from './gates';
import { licensedRank } from './licence';
import { build, mapSeed } from './map';
import * as spire from './spire';
import { isTrial } from './trial';
import type { Dungeon, OpenRaid, Save } from './types';
import { dayKey, rng } from './util';

/** Whether the board offers this hunter Seals on this Gate: a board Gate, from `SEALS_FROM`. */
export function sealable(s: Save, d: Dungeon): boolean {
  return !isPractice(d) && !isTrial(d) && !spire.isSpire(d) && rankIdx(licensedRank(s)) >= rankIdx(SEALS_FROM);
}

/**
 * The Seals a Gate offers today, up to `SEALS_PER_GATE`, drawn from its day's map: only those that would
 * change something (a Gatekeeper to wake, a rest to darken, Ascension open for Heavier Air) and that the
 * level the run would be entered at does not already play.
 */
export function offered(s: Save, d: Dungeon, day = dayKey()): SealId[] {
  if (!sealable(s, d)) return [];
  const level = asc.entryLevel(s, d, false);
  const m = build(d, mapSeed(d, day));
  const fits: Record<SealId, boolean> = {
    swollen: true,
    lightless: m.nodes.some((x) => x.kind === 'rest'),
    shorthanded: true,
    wardens: !!d.elite,
    dry: true,
    alone: !asc.bossGuarded(level) && d.mobs.length > 0,
    heavier: asc.proving(s) && s.ascension.unlocked > 0 && level < ASCENSION_RULED,
  };
  const r = rng(`arise|seals|${mapSeed(d, day)}`);
  const pool = SEAL_IDS.filter((id) => fits[id]);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SEALS_PER_GATE).sort((a, b) => SEAL_IDS.indexOf(a) - SEAL_IDS.indexOf(b));
}

/** The Seals a run walked in with. */
export const of = (run: OpenRaid | null | undefined): SealId[] => run?.seals ?? [];
const on = (seals: readonly SealId[], id: SealId) => seals.includes(id);

/** Every creature's HP, as a share: more under Swollen. */
export const hpShare = (seals: readonly SealId[]) => (on(seals, 'swollen') ? SEAL.swollen.hp : 1);
/** What a rest heals, as a share: nothing in a Lightless Gate. */
export const restShare = (seals: readonly SealId[]) => (on(seals, 'lightless') ? SEAL.lightless.rest : 1);
/** Hunters the Association sends fewer: one under Short-Handed. */
export const alliesCut = (seals: readonly SealId[]) => (on(seals, 'shorthanded') ? SEAL.shorthanded.allies : 0);
/** The Gatekeeper's strength, as a share: more under Wardens Wake. */
export const eliteShare = (seals: readonly SealId[]) => (on(seals, 'wardens') ? SEAL.wardens.elite : 1);
/** Whether the boss stands with one of its creatures: Never Alone. */
export const bossGuarded = (seals: readonly SealId[]) => on(seals, 'alone');
/** Whether a Health Potion can be drunk: never in a Dry Gate. */
export const potionsAllowed = (seals: readonly SealId[]) => !on(seals, 'dry');
/** Ascension levels the creatures fight above the run's own: one under Heavier Air. */
export const levelsUp = (seals: readonly SealId[]) => (on(seals, 'heavier') ? SEAL.heavier.levels : 0);
