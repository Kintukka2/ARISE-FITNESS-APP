/** How the System works, in one place. Every number here is read from the engine, so it cannot drift. */
import { FIELD_POTION, GATE_SHARDS, POTIONS } from '@/core/shop';
import { FIELD_POTION_HEAL, GUARD, TACTICS } from '@/core/combat';
import { GATE_XP, POINTS_PER_LEVEL, PRACTICE_LEVEL, RANK_LADDER, RANK_UP_POINTS, STAT_CAP, BOOST_CAP } from '@/core/progression';
import { OPEN_PER_DAY } from '@/core/gates';
import { SLOTS as SQUAD, EXTRACT_MP } from '@/core/shadows';
import { RAID_FATIGUE, FATIGUE_MAX, FATIGUE_PER_HOUR, PCT_PER_HOUR, WIPE_LOCK } from '@/core/vitals';
import { CLASS_RANKS, CLASSES } from '@/data/classes';
import { CLASS_PASSIVES, CLASS_SKILLS } from '@/data/abilities';
import { BLESSINGS, FIGHT_PURSE, NODE, REST_HEAL } from '@/data/nodes';
import { CONTRACT_BONUS, CONTRACT_PAY, CONTRACTS_PER_DAY } from '@/data/contracts';
import { BLOCK, SEASON_PAY, SPIRE_FLOORS, SPIRE_GROWTH, SPIRE_NAME, SPIRE_OPENS, SPIRE_TOP } from '@/data/spire';
import { Fold } from '@/ui/components';
import { openSheet } from '@/ui/overlays';

const ranks = RANK_LADDER.map((r) => `${r.name} at Level ${r.min}`).join(', ');
/** The ranks a class line's rungs open at, read from the data. */
const unlocks = (xs: { rung: number }[]) => {
  const at = [...new Set(xs.map((x) => x.rung))].sort((a, b) => a - b).map((n) => CLASS_RANKS[n]);
  return at.length > 1 ? `${at.slice(0, -1).join(', ')} and ${at[at.length - 1]}` : at.join('');
};

const TOPICS: { title: string; lines: string[] }[] = [
  {
    title: 'Levels, ranks and attributes',
    lines: [
      `Experience comes from Gates. A clear pays by the gate’s grade — ${GATE_XP.E} at E up to ${GATE_XP.S} at S — and the first clear of each gate pays it twice. Withdrawing pays a share of what you cleared; being carried out pays a little.`,
      `The practice gate lands you on Level ${PRACTICE_LEVEL}. Each level pays ${POINTS_PER_LEVEL} attribute points, and each new rank ${RANK_UP_POINTS} more. Ranks: ${ranks}.`,
      `Points take an attribute to ${STAT_CAP}; class and equipment can carry it to ${BOOST_CAP}.`,
      'STR drives physical damage. VIT sets HP and defence. AGI is speed, evasion and critical hits. PER is accuracy and critical hits. INT sets MP, magic, and the odds of binding a Shadow.',
    ],
  },
  {
    title: 'Classes',
    lines: [
      `From D-Rank the System names you after your highest attribute — ${CLASSES.length} classes across five lines — and renames you at every rank. A class pays flat points into its attribute and gives you that line’s combat skills.`,
      `Each line’s skills arrive at ${unlocks(CLASS_SKILLS)}-Rank, and its passives at ${unlocks(CLASS_PASSIVES)}-Rank.`,
    ],
  },
  {
    title: 'The map',
    lines: [
      'A gate is a map: a few layers of steps, a rest, then the boss. It is drawn from the gate and the day, so the brief shows it before you go in. Inside, you choose each step from the ones your last step leads to.',
      ...(['fight', 'elite', 'rest', 'treasure', 'shrine', 'trap', 'event'] as const).map((k) => `${NODE[k].name}: ${NODE[k].desc}`),
      `A rest gives everyone standing ${REST_HEAL * 100}% of their health back. Each fight cleared banks ${FIGHT_PURSE.fight * 100}% of a clear’s shards, a gatekeeper ${FIGHT_PURSE.elite * 100}%. What the run banks, shards and gear, is paid when you walk out: at the end, or from a rest. Carried out, you lose it.`,
      `Blessings last until you leave the gate: ${BLESSINGS.map((b) => `${b.name} (${b.text})`).join(', ')}.`,
      'The brief’s verdict walks the marked road, the one the System would take, and makes its choices. Auto takes that road too. Take a riskier one and the verdict no longer speaks for you.',
    ],
  },
  {
    title: 'Fighting',
    lines: [
      'The fight is turn by turn, in order of initiative. On your turn, tap a foe to aim at it, then act. A skill or a Strike always goes at the foe you aimed at first, though it can still miss; a skill that reaches several finds the rest itself.',
      'Every foe shows its next move on its card: the ability, and who it goes at first. What it shows is what it does, unless its target falls first or it is stunned. Your own card counts the foes coming for you.',
      `Guard and you take ${GUARD * 100}% of every hit until your next turn. A field potion restores ${FIELD_POTION_HEAL * 100}% of your health; the satchel carries ${FIELD_POTION.max}, bought at the Exchange.`,
      `Allies and Shadows follow standing orders, set in the brief: ${TACTICS.map((x) => x.name).join(', ')}.`,
      'Auto hands your turns to the System, and your steps: it walks the marked road and makes the System’s choices. It is how the System plays when it assesses a gate, so the verdict is what Auto would do; you can do better.',
      'Every order is written down before it plays, and the fight is fixed by its seed: leave mid-fight and you come back to the same turn, with the same outcome waiting.',
      'You fight a whole run as you walked in. Gear changed or points spent halfway count from the next gate.',
    ],
  },
  {
    title: 'Gates',
    lines: [
      `${OPEN_PER_DAY} gates stand open at a time: one of every grade, at least two at yours. You can enter up to one grade above your own. Clear one and another of its grade opens in its place; the whole board redraws at midnight.`,
      'The brief runs the gate headlessly 24 times with your actual party and tells you how often it cleared. That is the verdict.',
      `A gate pays shards on a clear (${GATE_SHARDS.E} at E to ${GATE_SHARDS.S} at S), double that once as a first-clear bounty, and equipment. Being carried out locks you out for ${WIPE_LOCK / 36e5} hours.`,
    ],
  },
  {
    title: 'Contracts',
    lines: [
      `The System issues ${CONTRACTS_PER_DAY} contracts a day, for your grade as it stood when it issued them: clear so many gates, fell so many of one family, beat a gatekeeper, walk off the marked road, and the like. They are on the Gates screen, and each says where it can be done.`,
      `Each pays ${CONTRACT_PAY.shards === 1 ? 'a clear’s' : `${CONTRACT_PAY.shards} clears’`} worth of shards at that grade and ${CONTRACT_PAY.xp * 100}% of a clear’s experience. All ${CONTRACTS_PER_DAY} pay ${CONTRACT_BONUS.shards} clears’ shards and ${CONTRACT_BONUS.xp * 100}% of a clear’s experience on top.`,
      'A run counts the moment it is settled, however it ends: kills count even when you are carried out, a clear only when you clear. New contracts come at midnight, and one left undone costs nothing.',
    ],
  },
  {
    title: SPIRE_NAME,
    lines: [
      `It opens once you have cleared ${SPIRE_OPENS} gates, and stands beside the board. It is climbed ${BLOCK} floors at a time: ${BLOCK - 2} floors of choices, a rest, then a boss. A block costs the fatigue of one gate of its grade, and pays like one, with no first-clear bounty.`,
      `Floor N is built for a hunter of Level N, up to Floor ${SPIRE_TOP}. Past it, every block is ${Math.round((SPIRE_GROWTH - 1) * 100)}% harder than the last, and it does not stop. Each grade’s floors begin at ${(Object.entries(SPIRE_FLOORS) as [string, number][]).map(([r, f]) => `${f} (${r})`).join(', ')}. You climb from your own grade’s, or from above your best this week, and as with any gate you can go one grade above your own.`,
      `Your best floor this week is kept. On Monday the week closes and pays ${SEASON_PAY.shards} clears’ worth of shards at the grade of your highest floor, and a piece of that grade’s gear: ${SEASON_PAY.step * 100}% more for every ${SEASON_PAY.beyond} floors past ${SPIRE_TOP}. Then the floors rearrange and everyone climbs again.`,
    ],
  },
  {
    title: 'Health, mana and fatigue',
    lines: [
      `Health and mana carry from one gate to the next and come back on their own, about ${Math.round(PCT_PER_HOUR * 100)}% an hour.`,
      `Each gate adds fatigue (${RAID_FATIGUE.E} at E to ${RAID_FATIGUE.S} at S, of ${FATIGUE_MAX}). Fatigue drags every attribute down — at ${FATIGUE_MAX} you fight at half strength — and fades about ${FATIGUE_PER_HOUR} an hour. It is the only thing that limits how much you can raid.`,
    ],
  },
  {
    title: 'Shadows',
    lines: [
      'A creature you felled can linger after a clear. Reach for it with mana and it may follow you home — the odds are shown before you commit, and rise with INT.',
      `Reaching costs MP by grade (${EXTRACT_MP.E} at E to ${EXTRACT_MP.S} at S), whether or not it holds. You can deploy ${SQUAD.E} at E, ${SQUAD.C} at C and ${SQUAD.A} at A. Shadows grow with every kill and never make a gate harder.`,
    ],
  },
  {
    title: 'Equipment and the Exchange',
    lines: [
      'Ten slots, six rarities. Every piece rolls its core bonus between 75% and 125% of its design, plus its own properties. Auto Equip picks the best of what you hold.',
      `The Exchange redraws eight pieces at midnight, mostly at your grade. Potions are always in stock: ${POTIONS.map((p) => `${p.name} ${p.price}`).join(', ')}, and the Field Potion ${FIELD_POTION.price} for the satchel.`,
    ],
  },
  {
    title: 'Your data',
    lines: ['Everything is stored on this device and nothing is sent anywhere. Export your save from the System Console now and then; importing keeps the previous save as a backup.'],
  },
];

export function openGuide() {
  openSheet({
    title: 'How ARISE Works',
    render: () => (
      <div class="stack">
        {TOPICS.map((t) => (
          <Fold key={t.title} title={t.title}>
            {t.lines.map((l) => <p key={l} class="muted">{l}</p>)}
          </Fold>
        ))}
      </div>
    ),
  });
}
