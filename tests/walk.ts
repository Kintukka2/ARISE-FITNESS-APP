/** Test helpers: walk an open run to its end the way the arena does. */
import type { Turn } from '@/core/combat';
import { isFight, systemPick, systemRoad } from '@/core/map';
import * as raid from '@/core/raid';
import type { Dungeon, OpenRaid, Order, Save } from '@/core/types';

/**
 * Play the open run out: step down the System's road, fight every chamber
 * (each turn chosen by `pick`, the System's choice if it returns null) and make
 * the System's choice at every shrine, trap and event. Records everything.
 */
export function walk(s: Save, d: Dungeon, now: number, pick: (t: Turn) => Order | null = () => null) {
  const run = s.gates.raid!;
  let turns = 0;
  for (let guard = 0; guard < 60; guard++) {
    if (run.lost) return { won: false, turns };
    const x = raid.pending(d, run);
    if (x && isFight(x)) {
      const { party, ch } = raid.resume(s, d, run, now);
      while (ch.turn) { turns++; ch.play(raid.order(s, run, pick(ch.turn))); }
      const res = ch.result();
      raid.record(s, d, run, party, res, now);
      if (!res.won) return { won: false, turns };
      if (x.kind === 'boss') return { won: true, turns };
      continue;
    }
    if (x) { raid.resolve(s, d, run, raid.systemChoice(x), now); continue; }
    const opts = raid.options(d, run);
    if (!opts.length) break;
    raid.choose(s, d, run, systemPick(opts).id, now);
  }
  return { won: false, turns };
}

/** Put an open run straight at its boss, every step before it taken as written, with the boss fight underway. */
export function toBoss(d: Dungeon, run: OpenRaid) {
  run.path = systemRoad(raid.mapOf(d, run));
  run.at = run.path.length - 1;
  return run;
}

export { isFight };
