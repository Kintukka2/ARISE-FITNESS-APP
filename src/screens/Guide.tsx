/** How the System works, in one place. Every number here is read from the engine, so it cannot drift. */
import * as boon from '@/core/boon';
import { QUEST_SHARDS, GATE_SHARDS, POTIONS } from '@/core/shop';
import { BASE_REPS, REPS_CAP, PENALTY_MULT } from '@/core/quests';
import { CERT_LEVEL, POINTS_PER_LEVEL, RANK_LADDER, RANK_UP_POINTS, RESONANCE, STAT_CAP, BOOST_CAP } from '@/core/progression';
import { OPEN_PER_DAY } from '@/core/gates';
import { SLOTS as SQUAD, EXTRACT_MP } from '@/core/shadows';
import { RAID_FATIGUE, FATIGUE_MAX, WIPE_LOCK } from '@/core/vitals';
import { CLASSES } from '@/data/classes';
import { Fold } from '@/ui/components';
import { openSheet } from '@/ui/overlays';

const ranks = RANK_LADDER.map((r) => `${r.name} at Level ${r.min}`).join(', ');

const TOPICS: { title: string; lines: string[] }[] = [
  {
    title: 'The Daily Quest',
    lines: [
      `Push-ups, sit-ups and squats, every day. ${BASE_REPS} of each on day one, one more of each for every day of Resonance, up to ${REPS_CAP}.`,
      'Something that hurts is swapped for a movement of the same kind. The quest resets at local midnight.',
      `Clearing it pays experience and Mana Shards (${QUEST_SHARDS.E} at E-Rank, ${QUEST_SHARDS.S} at S), and banks one Boon set per movement.`,
    ],
  },
  {
    title: 'Resonance, Penalties and Hollow',
    lines: [
      `Every consecutive cleared day adds +${RESONANCE.perDay.toFixed(2)} to a multiplier on all experience, up to ×${RESONANCE.max.toFixed(2)} on day ${RESONANCE.maxDays}.`,
      `Miss a day and Resonance returns to zero, a Penalty Quest at ×${PENALTY_MULT} volume is issued, and Hollow halves all experience until it is paid. The penalty pays nothing.`,
    ],
  },
  {
    title: 'The Boon',
    lines: [
      `Every completed set banks a point into the attributes that movement trains. Every ${boon.PERIOD_DAYS} days the System pays the ledger out as raw attributes — not experience.`,
      `Tiers need both sets and separate days: ${boon.TIERS.slice(1).map((t) => `${t.name} ${t.min} sets over ${t.days} day${t.days === 1 ? '' : 's'} (+${t.grant})`).join('; ')}. ${boon.FREE.sets} sets across all ${boon.FREE.days} days adds a free point.`,
    ],
  },
  {
    title: 'Levels, ranks and attributes',
    lines: [
      `Experience comes from the Daily Quest and from training sessions. Gates do not pay experience: training is what makes you stronger.`,
      `Each level pays ${POINTS_PER_LEVEL} attribute points, and each new rank ${RANK_UP_POINTS} more. Ranks: ${ranks}.`,
      `Training takes an attribute to ${STAT_CAP}; class and equipment can carry it to ${BOOST_CAP}.`,
      'STR drives physical damage. VIT sets HP and defence. AGI is speed, evasion and shorter rests. PER is accuracy and critical hits. INT sets MP, magic, and the odds of binding a Shadow.',
    ],
  },
  {
    title: 'Classes',
    lines: [
      `From D-Rank the System names you after your highest trained attribute — ${CLASSES.length} classes across five lines — and renames you at every rank. A class pays flat points into its attribute and gives you that line’s combat skills.`,
    ],
  },
  {
    title: 'Training',
    lines: [
      `Basic Hunter Training is one guided session. Finishing it lands you on Level ${CERT_LEVEL}, issues your kit, and opens the Gates.`,
      'Valcorde builds a week from your interview and adapts it after every session from how it felt and how much you finished. Every fifth week is a deload.',
      'A second session in one day pays 60% of its experience, a third and later 30%.',
    ],
  },
  {
    title: 'Gates',
    lines: [
      `${OPEN_PER_DAY} gates stand open a day, redrawn at midnight: one of every grade, at least two at yours. You can enter up to one grade above your own.`,
      'The brief runs the gate headlessly 24 times with your actual party and tells you how often it cleared. That is the verdict.',
      `A gate pays shards on a clear (${GATE_SHARDS.E} at E to ${GATE_SHARDS.S} at S), double that once as a first-clear bounty, and equipment. Withdrawing between chambers pays a share; being carried out pays little and locks you out for ${WIPE_LOCK / 36e5} hours.`,
      `Each gate adds fatigue (${RAID_FATIGUE.E} at E to ${RAID_FATIGUE.S} at S, of ${FATIGUE_MAX}). Fatigue drags every attribute down until it fades, about five an hour.`,
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
      `The Exchange redraws eight pieces at midnight, mostly at your grade. Potions are always in stock: ${POTIONS.map((p) => `${p.name} ${p.price}`).join(', ')}.`,
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
