/**
 * Ascension, on the hunter's own climb. The level chosen is written to a run
 * when it begins and holds for the whole of it, so a fight replays the same. A
 * level is opened by proving the one below it: clears of different gates at the
 * hunter's grade, played at that level, and then the Trial. Settled in
 * `raid.finish`, with everything else a run pays.
 */
import { ASCENSION_FROM, ASCENSION_NAMES, ASCENSION_PAY, ASCENSION_TOP, PROOF, RULES } from '@/data/ascension';
import { DUNGEONS } from '@/data/dungeons';
import { ASCENSION_TUNE } from '@/data/gatetune';
import { licensedRank } from './licence';
import { isTrial, trialDungeon, trialLevel } from './trial';
import type { Dungeon, OpenRaid, Save } from './types';
import { RANKS } from './types';
import { dayKey } from './util';

const on = (level: number, rule: { at: number }) => level >= rule.at;

/** How much stronger every foe is at a level, from calibration. */
export const ascensionTune = (level: number) => (level > 0 ? ASCENSION_TUNE[level - 1] ?? 1 : 1);
export const restShare = (level: number) => (on(level, RULES.thinRest) ? RULES.thinRest.heal : 1);
export const alliesCut = (level: number) => (on(level, RULES.shortHanded) ? RULES.shortHanded.allies : 0);
export const fatigueShare = (level: number) => (on(level, RULES.heavyLegs) ? RULES.heavyLegs.fatigue : 1);
export const eliteShare = (level: number) => (on(level, RULES.wardens) ? RULES.wardens.elite : 1);
export const oddsCut = (level: number) => (on(level, RULES.crooked) ? RULES.crooked.odds : 0);
export const manaShare = (level: number) => (on(level, RULES.hungryDark) ? RULES.hungryDark.mana : 1);
export const bossGuarded = (level: number) => on(level, RULES.guarded);
export const dragShare = (level: number) => (on(level, RULES.wornThin) ? RULES.wornThin.drag : 1);
export const bossByHand = (level: number) => on(level, RULES.watched);
/** What a gate pays at a level, as a share of what it pays at level 0. */
export const payShare = (level: number) => 1 + ASCENSION_PAY * level;

/** The level a run was entered at. Runs from before Ascension were entered at none. */
export const levelOf = (run: OpenRaid | null | undefined) => run?.ascension ?? 0;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Each level's rule, in words read from its numbers. */
export function ruleText(level: number): string {
  switch (level) {
    case 1: return 'Every foe is stronger, and every level above makes it more so.';
    case RULES.thinRest.at: return `A rest heals ${pct(RULES.thinRest.heal)} of what it would.`;
    case RULES.shortHanded.at: return `The Association sends ${RULES.shortHanded.allies} hunter fewer with you.`;
    case RULES.heavyLegs.at: return `A Gate costs ${pct(RULES.heavyLegs.fatigue - 1)} more fatigue to walk into.`;
    case RULES.wardens.at: return `Gatekeepers are a further ${pct(RULES.wardens.elite - 1)} stronger.`;
    case RULES.crooked.at: return `Every choice that rolls goes well ${pct(RULES.crooked.odds)} less often.`;
    case RULES.hungryDark.at: return `Extraction costs ${RULES.hungryDark.mana} times the MP.`;
    case RULES.guarded.at: return 'A boss never fights alone: one of its Gate’s creatures stands with it.';
    case RULES.wornThin.at: return `Fatigue lowers stats ${RULES.wornThin.drag} times as much.`;
    case RULES.watched.at: return 'Auto will not fight a boss for you. Every order in its chamber is yours.';
    default: return '';
  }
}

export interface Level { level: number; name: string; rule: string }
export const levelInfo = (level: number): Level => ({ level, name: ASCENSION_NAMES[level - 1] ?? '', rule: ruleText(level) });
/** Every rule a level plays: its own and all below it. */
export const rulesAt = (level: number): Level[] => Array.from({ length: level }, (_, i) => levelInfo(i + 1));

/** Whether the hunter's clears count toward a proof yet. */
export const proving = (s: Save) => RANKS.indexOf(licensedRank(s)) >= RANKS.indexOf(ASCENSION_FROM) && s.ascension.unlocked < ASCENSION_TOP;
/** Whether Ascension shows at all: a level is open, or the hunter is proving one. */
export const ascensionOpen = (s: Save) => s.ascension.unlocked > 0 || proving(s);

/** Choose the level the next run is entered at, up to the highest opened. Mutates. */
export function choose(s: Save, level: number) {
  s.ascension.level = Math.max(0, Math.min(s.ascension.unlocked, Math.round(level)));
}

/** The level a run at this gate is entered at: a Trial is always fought at the level it proves, and the practice gate at none. */
export const entryLevel = (s: Save, d: Dungeon, practice: boolean) => (practice ? 0 : isTrial(d) ? trialLevel(d) : s.ascension.level);

/** The Trial the hunter would face next: the one that proves the highest level they have opened. */
export const nextTrial = (s: Save) => trialDungeon(licensedRank(s), s.ascension.unlocked);
/**
 * How many different gates of the hunter's grade prove a level: the rule's number, or every gate of the
 * grade, for a grade with fewer. S-Rank has three.
 */
export const proofNeeds = (s: Save) => Math.min(PROOF.gates, DUNGEONS.filter((d) => d.rank === licensedRank(s)).length);
/** The gates are proved, so the Trial stands open; it can be walked into once a day. */
export const trialProved = (s: Save) => proving(s) && s.ascension.proof.gates.length >= proofNeeds(s);
export const trialReady = (s: Save, day = dayKey()) => trialProved(s) && s.ascension.trialDay !== day;

/** Walking into a Trial spends the day's attempt, whatever comes of it. Mutates. */
export function enterTrial(s: Save, day: string) {
  s.ascension.trialDay = day;
  s.ascension.trials += 1;
}

/**
 * Count a cleared run toward proving the highest level opened. A gate of the
 * hunter's grade counts once; a Trial won with the gates proved opens the next
 * level. Only runs entered at that level count. Returns the level opened, or
 * null. Mutates.
 */
export function prove(s: Save, d: Dungeon, run: OpenRaid): number | null {
  const a = s.ascension;
  if (!proving(s) || levelOf(run) !== a.unlocked) return null;
  if (!isTrial(d)) {
    if (d.rank === licensedRank(s) && !d.floor && !a.proof.gates.includes(d.id)) a.proof.gates.push(d.id);
    return null;
  }
  if (trialLevel(d) !== a.unlocked || a.proof.gates.length < proofNeeds(s)) return null;
  a.unlocked += 1;
  a.best = Math.max(a.best, a.unlocked);
  a.proof = { gates: [] };
  return a.unlocked;
}
