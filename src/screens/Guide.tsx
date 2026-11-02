/** How the System works, in one place. Every number here is read from the engine, so it cannot drift. */
import { FIELD_POTION, GATE_SHARDS, POTIONS, stepCost } from '@/core/shop';
import { FIELD_POTION_HEAL, GUARD, TACTICS } from '@/core/combat';
import { ATTRS, GATE_XP, POINTS_PER_LEVEL, PRACTICE_LEVEL, RANK_LADDER, RANK_UP_POINTS, STAT_CAP, BOOST_CAP } from '@/core/progression';
import { MISSIONS } from '@/core/missions';
import { OPEN_PER_DAY } from '@/core/gates';
import { SLOTS as SQUAD, EXTRACT_MP, GROWTH_PER_KILL, SECOND_AT, SHADOW_RANKS } from '@/core/shadows';
import { RAID_FATIGUE, FATIGUE_MAX, FATIGUE_PER_HOUR, PCT_PER_HOUR, WIPE_LOCK } from '@/core/vitals';
import { CLASS_RANKS, CLASSES } from '@/data/classes';
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { BLESSINGS, FIGHT_PURSE, NODE, REST_HEAL } from '@/data/nodes';
import { SETS, UPGRADE } from '@/data/sets';
import { ASCENSION_FROM, ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, MASTERWORK_SLOTS, OVERCHARGE, PROOF, TRIAL, WALKERS } from '@/data/ascension';
import { markText, MARKS_MOST } from '@/core/marks';
import { rulesAt } from '@/core/ascension';
import { RANKS } from '@/core/types';
import { DUNGEONS } from '@/data/dungeons';
import { GRADES } from '@/core/raid';
import { CONTRACT_BONUS, CONTRACT_PAY, CONTRACTS_PER_DAY } from '@/data/contracts';
import { BLOCK, SEASON_PAY, SPIRE_FLOORS, SPIRE_GROWTH, SPIRE_NAME, SPIRE_OPENS, SPIRE_TOP } from '@/data/spire';
import { Fold } from '@/ui/components';
import { openSheet } from '@/ui/overlays';

const ranks = RANK_LADDER.map((r) => `${r.name} at Level ${r.min}`).join(', ');
/** The grades Ascension counts from that have fewer gates than a proof asks for. */
const gatesOf = (g: string) => DUNGEONS.filter((d) => d.rank === g).length;
const SHORT = RANKS.slice(RANKS.indexOf(ASCENSION_FROM)).filter((g) => gatesOf(g) < PROOF.gates);
/** The ranks a class line's rungs open at, read from the data. */
const unlocks = (xs: { rung: number }[]) => {
  const at = [...new Set(xs.map((x) => x.rung))].sort((a, b) => a - b).map((n) => CLASS_RANKS[n]);
  return at.length > 1 ? `${at.slice(0, -1).join(', ')} and ${at[at.length - 1]}` : at.join('');
};

/** The Guide: one fact per line, numbers up front. The interface's reference, set in the System's frame (GUIDE) at the owner's call. */
export const TOPICS: { title: string; lines: string[] }[] = [
  {
    title: 'Levels, ranks and stats',
    lines: [
      `A clear pays experience by grade: ${GATE_XP.E} at E to ${GATE_XP.S} at S.`,
      'The first clear of each Gate pays double.',
      'Withdrawing pays a share of what you cleared. Being carried out pays a little.',
      `The Practice Gate lands you on Level ${PRACTICE_LEVEL}.`,
      `Each level pays ${POINTS_PER_LEVEL} Ability Points. Each new rank pays ${RANK_UP_POINTS} more.`,
      `Ranks: ${ranks}.`,
      `Ability Points take a stat to ${STAT_CAP}. Class and gear can carry it to ${BOOST_CAP}.`,
      ...ATTRS.map((a) => `${a.key}: ${a.desc}`),
    ],
  },
  {
    title: 'Classes',
    lines: [
      `From D-Rank the System assigns a class from your highest stat: ${CLASSES.length} classes in five lines.`,
      'Your class is reassigned at every rank, and follows your highest stat.',
      'A class adds flat points to its stat and gives you its line’s combat skills.',
      `Skills arrive at ${unlocks(CLASS_SKILLS)}-Rank. Passives arrive at ${unlocks(CLASS_PASSIVES)}-Rank.`,
      'Each of those ranks offers two, and you keep one.',
      'Until you choose, you fight with the first.',
      'A choice holds until your next rank, when every choice can be made again.',
    ],
  },
  {
    title: 'The map',
    lines: [
      'A Gate is a map: a few layers of steps, a rest, then the boss.',
      'The map is drawn from the Gate and the day, so the brief shows it before you go in.',
      'Inside, you choose each step from the ones your last step leads to.',
      ...(['fight', 'elite', 'rest', 'treasure', 'shrine', 'trap', 'event'] as const).map((k) => `${NODE[k].name}: ${NODE[k].desc}`),
      `A rest restores ${REST_HEAL * 100}% of health to everyone standing.`,
      `Each fight cleared banks ${FIGHT_PURSE.fight * 100}% of a clear’s shards. A gatekeeper banks ${FIGHT_PURSE.elite * 100}%.`,
      'What the run banks is paid when you walk out, at the end or from a rest. Carried out, you lose it.',
      `Blessings last until you leave the Gate: ${BLESSINGS.map((b) => `${b.name} (${b.text})`).join(', ')}.`,
      'The brief’s verdict follows the marked road and makes the System’s choices. Auto does the same.',
      'Take another road and the verdict no longer applies.',
    ],
  },
  {
    title: 'Fighting',
    lines: [
      'Turns go in order of initiative.',
      'On your turn, tap a foe to aim at it, then act.',
      'A skill or a Strike goes at the foe you aimed at first. It can still miss.',
      'A skill that reaches several foes finds the rest itself.',
      'Every foe shows its next move and its target. It does exactly that, unless its target falls first or it is stunned.',
      'Your own card counts the foes coming for you.',
      `Guard: you take ${GUARD * 100}% of every hit until your next turn.`,
      `Field potion: restores ${FIELD_POTION_HEAL * 100}% of your health. The satchel holds ${FIELD_POTION.max}.`,
      `Allies and Shadows follow the standing orders set in the brief: ${TACTICS.map((x) => x.name).join(', ')}.`,
      'Auto hands your turns and steps to the System. The verdict is what Auto would do.',
      'Every order is saved before it plays. Leave mid-fight and you return to the same turn.',
      'Gear changed or points spent mid-run count from the next Gate.',
    ],
  },
  {
    title: 'Gates',
    lines: [
      'A Gate is the door to a Dungeon: a sealed space full of hostile creatures.',
      'A Gate closes once its Boss is slain.',
      `${OPEN_PER_DAY} Gates stand open at a time: one of every grade, at least two at yours.`,
      'You can enter up to one grade above your own.',
      'A cleared Gate is replaced by another of its grade. The board redraws at midnight.',
      'The brief runs the Gate 24 times with your party and grades how often it cleared.',
      `Grades: ${GRADES.map((g) => (g.min ? `${g.text} at ${Math.round(g.min * 100)}% or more` : `${g.text} below that`)).join(', ')}.`,
      `A clear pays shards by grade: ${GATE_SHARDS.E} at E to ${GATE_SHARDS.S} at S. The first clear pays double, once.`,
      'A clear can also leave gear.',
      `Being carried out locks you out of Gates for ${WIPE_LOCK / 36e5} hours.`,
    ],
  },
  {
    title: 'Quests',
    lines: [
      'The Quests screen opens once the Practice Gate is cleared.',
      'It holds the day’s Daily Quests, your next rank, the Pale Spire’s week, the Trial, the Chosen and the Secret Quests.',
      'Each quest is a tile that shows where it stands. Tap one to open its window.',
      'Reclassification: your next rank, the level it needs, and what it brings.',
      'Weekly Quest: the next floor of the Pale Spire that raises what the week pays.',
      `The Trial appears from ${ASCENSION_FROM}-Rank. The Chosen appear once a Trial is won.`,
      'The tab counts the day’s Daily Quests until you open it, and the Trial while today’s attempt is unused.',
      `There are ${MISSIONS.length} Secret Quests. None is shown until it is done.`,
      'The Secret Quests window adds up everything they have paid.',
    ],
  },
  {
    title: 'Daily Quests',
    lines: [
      `The System issues ${CONTRACTS_PER_DAY} Daily Quests a day, for your grade when they are issued.`,
      'They are on the Quests screen. Each one says where it can be done.',
      'A Gate on the board that a Daily Quest names is marked Quest.',
      `Each pays ${CONTRACT_PAY.shards === 1 ? 'a clear’s' : `${CONTRACT_PAY.shards} clears’`} shards at that grade and ${CONTRACT_PAY.xp * 100}% of a clear’s experience.`,
      `All ${CONTRACTS_PER_DAY} together pay ${CONTRACT_BONUS.shards} clears’ shards and ${CONTRACT_BONUS.xp * 100}% of a clear’s experience on top.`,
      'A run counts once it is settled, however it ends.',
      'Kills count even when you are carried out. A clear counts only when you clear.',
      'New Daily Quests arrive at midnight. One left undone costs nothing.',
    ],
  },
  {
    title: SPIRE_NAME,
    lines: [
      `It opens after ${SPIRE_OPENS} Gates cleared, beside the board.`,
      `It is climbed ${BLOCK} floors at a time: ${BLOCK - 2} floors of choices, a rest, then a boss.`,
      'A block costs the fatigue of one Gate of its grade and pays like one, with no first-clear bounty.',
      `Floor N is built for a hunter of Level N, up to Floor ${SPIRE_TOP}.`,
      `Past Floor ${SPIRE_TOP}, every block is ${Math.round((SPIRE_GROWTH - 1) * 100)}% harder than the last, with no end.`,
      `Each grade’s floors begin at: ${(Object.entries(SPIRE_FLOORS) as [string, number][]).map(([r, f]) => `${f} (${r})`).join(', ')}.`,
      'You climb from your own grade’s floors, or from above your best this week.',
      'As with any Gate, you can go one grade above your own.',
      'Your best floor this week is kept.',
      `On Monday the week pays ${SEASON_PAY.shards} clears’ shards at the grade of your highest floor, and a piece of that grade’s gear.`,
      `It pays ${SEASON_PAY.step * 100}% more for every ${SEASON_PAY.beyond} floors past ${SPIRE_TOP}.`,
      'Then the floors rearrange, and everyone climbs again.',
    ],
  },
  {
    title: 'Ascension',
    lines: [
      `The first ${ASCENSION_RULED} levels each make every foe stronger and add a rule, on top of every rule below it.`,
      `Past them the ladder has no top. Each level makes every foe ${Math.round((BEYOND.growth - 1) * 100)}% stronger than the one below, and adds no rule.`,
      `Each level pays ${ASCENSION_PAY * 100}% more on a Gate than the level below.`,
      'You can step back down at any time.',
      `A level opens when you prove the one below it: ${PROOF.gates} different Gates of your grade cleared at it, then the Trial.`,
      ...SHORT.map((g) => `${g}-Rank has only ${gatesOf(g)} Gates, so there the proof is all of them.`),
      `Clears count from ${ASCENSION_FROM}-Rank.`,
      'The proof and the Trial are on the Quests screen.',
      'Once Ascension 1 is open, the Ascension tile on the Gates screen holds the level you enter at, its rules and your marks.',
      `The Trial is a Gate of the Chosen, fought back to back with no rest and no way out: ${TRIAL.extra} more than the level it proves, up to ${TRIAL.most}.`,
      'Each of the Chosen is one of your grade’s bosses, stronger for every round before it.',
      'The Trial is fought at the level it proves. You can enter it once a day.',
      'Winning a Trial sends its last Chosen into the Gates.',
      'Each day one holds the first Gate of your grade, and shows itself only at its level or higher. Then it stands in the boss’s place.',
      'The first time it falls it leaves a masterwork: a piece of the Gate’s grade, perfect, as many steps past it as its level.',
      `Each level’s Chosen guards its own slot: ${MASTERWORK_SLOTS.map((x, i) => `${i + 1}, ${x}`).join('; ')}.`,
      `After that, felling it again pays ${WALKERS.bounty} clears’ shards.`,
      ...rulesAt(ASCENSION_RULED).map((r) => `Level ${r.level}, ${r.name}: ${r.rule}`),
      'The level you choose is fixed for a run when you walk in. The brief plays every rule it brings.',
      `Every level you open earns a mark. Set it from the Ascension tile, for good, on one of ${MARKS.length}: ${MARKS.map((m) => `${m.name} (${markText(m)})`).join(', ')}.`,
      `Up to ${MARK_MAX} marks can go on any one. The levels are built for a hunter who has set theirs.`,
      `Every mark is full by Ascension ${MARKS_MOST}. Levels above it earn none.`,
      `Every level opened lets each piece of gear go ${OVERCHARGE.per === 1 ? 'one upgrade step' : `${OVERCHARGE.per} upgrade steps`} past perfect.`,
      `A step past perfect raises it ${OVERCHARGE.share / UPGRADE.share === 0.5 ? 'half as far' : `${Math.round((OVERCHARGE.share / UPGRADE.share) * 100)}% as far`} as a step toward it. Each costs more than the last.`,
    ],
  },
  {
    title: 'Health, mana and fatigue',
    lines: [
      `Health and mana carry between Gates and recover about ${Math.round(PCT_PER_HOUR * 100)}% each hour.`,
      `Each Gate adds fatigue: ${RAID_FATIGUE.E} at E to ${RAID_FATIGUE.S} at S, out of ${FATIGUE_MAX}.`,
      `Fatigue lowers every stat, to half strength at ${FATIGUE_MAX}.`,
      `It fades about ${FATIGUE_PER_HOUR} each hour.`,
      'It is the only limit on how much you can raid.',
    ],
  },
  {
    title: 'Shadows',
    lines: [
      'A felled creature can linger after a clear.',
      'Extract it with mana and it may join your army. The odds are shown first, and rise with INT.',
      `Extraction costs MP by grade: ${EXTRACT_MP.E} at E to ${EXTRACT_MP.S} at S, whether or not it holds.`,
      `You can deploy ${SQUAD.E} at E, ${SQUAD.C} at C and ${SQUAD.A} at A. Some Secret Quests add more.`,
      'Shadows never make a Gate harder.',
      `A Shadow grows ${GROWTH_PER_KILL * 100}% with every kill it lands, up to its rank’s limit.`,
      `Kills promote it: ${SHADOW_RANKS.map((r) => `${r.name}${r.kills ? ` at ${r.kills} kills` : ''} (up to +${Math.round(r.cap * 100)}%)`).join(', ')}.`,
      'A newly bound Shadow fights with its creature’s first ability.',
      `At ${SHADOW_RANKS[SECOND_AT].name} it remembers a second, from its own kit or, if it had only one, from its kin.`,
      'Each Shadow follows the standing orders set in the brief, unless you give it its own on its sheet.',
    ],
  },
  {
    title: 'Equipment and the Exchange',
    lines: [
      'Ten slots, six rarities.',
      'Every piece rolls its core bonus between 75% and 125% of its design, plus its own properties.',
      'Auto Equip picks the best of what you hold, and favours a set you hold two or more pieces of.',
      `${SETS.length} sets of three pieces, Rare and up.`,
      'Two pieces of a set worn together pay a bonus, and all three pay another.',
      'The item’s sheet says what each set pays.',
      'Each set has a home Gate. Every clear there leaves a piece you do not hold yet, while there is one.',
      `An upgrade moves an item’s quality and every property ${UPGRADE.share * 100}% across its design’s range, until it is perfect.`,
      'Past perfect, it goes as far as your Ascension allows.',
      `A step costs ${UPGRADE.rate} shards for every point of score it adds: ${stepCost('C')} at Rare, ${stepCost('S')} at Legendary.`,
      'The Exchange redraws eight pieces at midnight, mostly at your grade.',
      `Potions are always in stock: ${POTIONS.map((p) => `${p.name} ${p.price}`).join(', ')}. The Field Potion costs ${FIELD_POTION.price}.`,
    ],
  },
  {
    title: 'Your data',
    lines: [
      'Everything is stored on this device. Nothing is sent anywhere.',
      'Export your save from Settings now and then.',
      'Importing keeps the previous save as a backup.',
    ],
  },
];

export function openGuide() {
  openSheet({
    title: 'Guide', system: { icon: null },
    render: () => (
      <div class="stack">
        {TOPICS.map((t) => (
          <Fold key={t.title} title={t.title}>
            <ul class="guide__list">{t.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </Fold>
        ))}
      </div>
    ),
  });
}
