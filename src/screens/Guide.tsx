/** How the System works, in one place. Every number here is read from the engine, so it cannot drift. */
import { BLUEPRINT_SHELF, GATE_SHARDS, gateShards, POTIONS, SATCHEL } from '@/core/shop';
import * as forge from '@/core/forge';
import { ALLOYS, BLUEPRINTS, CACHE, DROPS, FAMILIARITY, FAMILIARITY_MAX, FAMILY_PART, FORGED, PARTS, RECIPE, SALVAGE, UPGRADE_COST } from '@/data/forge';
import { FLOORS, LABYRINTH, RESTS_MAX } from '@/core/map';
import { POTION_HEAL, GUARD, TACTICS } from '@/core/combat';
import { ATTRS, GATE_XP, POINTS_PER_LEVEL, PRACTICE_LEVEL, RANK_LADDER, RANK_UP_POINTS, STAT_CAP, BOOST_CAP } from '@/core/progression';
import { MISSIONS } from '@/core/missions';
import { OPEN_PER_DAY } from '@/core/gates';
import { SLOTS as SQUAD, AWAKENING, ESSENCE, EXTRACT_MP, EXTRACT_TRIES, GROWTH_PER_LEVEL, HOLD, SECOND_AT, SHADOW_RANKS, SHADOW_XP } from '@/core/shadows';
import { RAID_FATIGUE, FATIGUE_MAX, FATIGUE_PER_HOUR, PCT_PER_HOUR, WIPE_LOCK } from '@/core/vitals';
import { CLASSES } from '@/data/classes';
import { PATHS, RESET, SKILL_POINTS, SKILL_SLOTS, TIER_GATE, TIER_RANKS } from '@/data/tree';
import { BLESSINGS, FIGHT_PURSE, NODE, REST_HEAL } from '@/data/nodes';
import { LOADOUTS, SETS, UPGRADE } from '@/data/sets';
import { ASCENSION_FROM, ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, MASTERWORK_SLOTS, OVERCHARGE, PROOF, TRIAL, WALKERS } from '@/data/ascension';
import { markText, MARKS_MOST } from '@/core/marks';
import { rulesAt } from '@/core/ascension';
import { RANKS } from '@/core/types';
import { DUNGEONS } from '@/data/dungeons';
import { GRADES } from '@/core/raid';
import { CONTRACT_BONUS, CONTRACT_PAY, CONTRACTS_PER_DAY } from '@/data/contracts';
import { ASSOC, SURVEY } from '@/data/association';
import { BLOCK, SEASON_PAY, SPIRE_FLOORS, SPIRE_GROWTH, SPIRE_NAME, SPIRE_OPENS, SPIRE_TOP } from '@/data/spire';
import { Fold } from '@/ui/components';
import { openSheet } from '@/ui/overlays';

const ranks = RANK_LADDER.map((r) => `${r.name} at Level ${r.min}`).join(', ');
/** What proves a level at a grade: the rule's number of its Gates, or all of them for a grade with fewer. */
const gatesOf = (g: string) => DUNGEONS.filter((d) => d.rank === g).length;
const proofOf = (g: string) => (gatesOf(g) < PROOF.gates ? `all ${gatesOf(g)} ${g}-Rank Gates` : `${PROOF.gates} different ${g}-Rank Gates`);
/** The grades above the one Ascension opens at whose proof differs from it. */
const SHORT = RANKS.slice(RANKS.indexOf(ASCENSION_FROM) + 1).filter((g) => gatesOf(g) !== gatesOf(ASCENSION_FROM));

/** The Guide: one fact per line, numbers up front. The interface's reference, set in the System's frame (GUIDE) at the owner's call. */
export const TOPICS: { title: string; lines: string[] }[] = [
  {
    title: 'Levels, ranks and stats',
    lines: [
      `A clear pays XP by grade, E-S: ${GATE_XP.E}-${GATE_XP.S}.`,
      'The first clear of each Gate pays double.',
      'Withdrawing pays a share of what you cleared. Being carried out pays a little.',
      `The Practice Gate lands you on Level ${PRACTICE_LEVEL}.`,
      `Each level pays ${POINTS_PER_LEVEL} Ability Points. Each new rank pays ${RANK_UP_POINTS} more.`,
      `Ranks: ${ranks}.`,
      'A level only qualifies you for a rank. Claim it from its Reclassification quest on the Quests screen, by holding Hold To Reclassify.',
      'Until you claim it you keep your rank, with its Gates, its Exchange and its class.',
      `Ability Points take a stat to ${STAT_CAP}. Class and gear can carry it to ${BOOST_CAP}.`,
      ...ATTRS.map((a) => `${a.key}: ${a.desc}`),
    ],
  },
  {
    title: 'Classes and skills',
    lines: [
      `From D-Rank the System assigns a class from your highest stat: ${CLASSES.length} classes in five lines.`,
      'Your class is reassigned at every rank, and follows your highest stat. It adds flat points to that stat.',
      `Skill Points: ${SKILL_POINTS.level} each level, and ${SKILL_POINTS.rank} more for each rank you claim. Spend them on the Skills screen.`,
      `The skill tree has ${PATHS.length} Paths, one for each stat: ${PATHS.map((p) => `${p.name} (${p.key})`).join(', ')}.`,
      'You can spend in any Path, whatever your class. The skills of a Path grow stronger with its stat.',
      `A Path has a tier for each rank, ${TIER_RANKS[0]}-${TIER_RANKS[TIER_RANKS.length - 1]}. A tier opens at its rank, once the Path holds enough of your points: ${TIER_RANKS.slice(1).map((r, i) => `${r} ${TIER_GATE[i + 1]}`).join(', ')}.`,
      'A node needs the one it grows from. Each point you spend counts toward the next tier of its Path.',
      'A skill levels up to Lv.MAX: more force at every level, and its own edge at the top.',
      'Each Path has one skill that does no damage, at B: a curse that never misses, a taunt, or a support for the whole party.',
      'Two passives in each B and S tier are a fork. Learning one seals the other.',
      `Skill slots: the skills you take into a fight. ${(['D', 'C', 'B', 'A', 'S', 'N'] as const).map((r) => `${r === 'N' ? 'Sovereign' : `${r}-Rank`} ${SKILL_SLOTS[r]}`).join(', ')}.`,
      'A skill you learn takes a free slot. Equip, Unequip and Swap In change the rest.',
      'Auto Assign spends every point as the System would, in your class’s Path first.',
      `A reset hands every point back. The first is free, then each costs the Mana Shards of ${RESET.share === 1 ? 'a clear' : `${RESET.share} clears`} at your grade.`,
      'The Association’s hunters fight with each class line’s first skills and passives.',
    ],
  },
  {
    title: 'The map',
    lines: [
      'A Gate is a dungeon: rooms joined by corridors, the entrance anywhere on its plan and the boss at the far end of it. A plan can run up, down, left or right.',
      `A deeper Gate has floors: ${Object.entries(FLOORS).map(([r, n]) => `${r}-Rank ${n}`).join(', ')}.`,
      `Each floor is a labyrinth of at least so many rooms: ${Object.entries(LABYRINTH).map(([r, x]) => `${r}-Rank ${x.rooms}`).join(', ')}.`,
      'Each floor but the last ends in stairs down instead of the boss, and each below the first starts at stairs up. Take stairs you have used again in one tap.',
      'A deeper Gate’s road is longer, and its fights share out what a one-floor road pays.',
      'The map is drawn from the Gate and the day.',
      'The brief shows a Gate’s map only once you have been inside it. Until then it is unidentified, like its boss.',
      'Every room is in the fog until you see it, the stairs among them. Corridors, the entrance and the boss’s room always show.',
      'A room you have cleared reads Cleared. A rest, the stairs and the entrance keep their marks, for coming back to.',
      'You see every room next to one you have cleared. A room seen stays seen on that map, for as long as it stands.',
      'You can enter any room next to one you have cleared.',
      'You can walk back to any cleared room at any time, and walking costs nothing.',
      ...(['fight', 'elite', 'vault', 'rest', 'treasure', 'shrine', 'trap', 'event', 'entrance'] as const).map((k) => `${NODE[k].name}: ${NODE[k].desc}`),
      `A vault holds ${CACHE.vault}-${CACHE.vault + 2} alloy of the Gate’s own grade and two parts, or a piece found whole ${FORGED.vault * 100}% of the time.`,
      `An opened vault leaves a blueprint of the Gate’s grade ${BLUEPRINTS.vault * 100}% of the time, unless you are carried out.`,
      `Rests are rare: no floor holds more than ${RESTS_MAX}, and one passes for an Event until you find it.`,
      `A rest restores ${REST_HEAL * 100}% of health to everyone standing, once. Use it when you find it, or walk back to it later.`,
      'Some Gates hide a passage between two rooms. It opens once you clear a room at either end.',
      'The bag at the map’s corner holds your items, one slot to each. Tap an item to see what it does, then Use.',
      `A ${SURVEY.name} charts every room of a Gate’s map, from its brief or inside it. The Exchange sells them for ${SURVEY.price}.`,
      `A Health Potion can be drunk from the bag between rooms, for ${POTION_HEAL * 100}% of your health, as well as on your turn in a fight. A Mana Potion can be drunk from it too.`,
      `Each fight cleared banks ${FIGHT_PURSE.fight * 100}% of a clear’s shards. A gatekeeper banks ${FIGHT_PURSE.elite * 100}%.`,
      'What the run banks is paid when the boss falls or you withdraw. Carried out, you lose it.',
      'You can withdraw only from the entrance, once you have cleared a room.',
      `Blessings last until you leave the Gate: ${BLESSINGS.map((b) => `${b.name} (${b.text})`).join(', ')}.`,
      'The brief’s verdict follows the marked road, the fewest rooms to the boss, and makes the System’s choices. Auto does the same.',
      'The System keeps a rest it finds for the boss.',
      'Take another road and the verdict no longer applies.',
      'The Pale Spire and the Trials are climbed floor by floor instead, and only up.',
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
      'A taunt turns every foe’s next move on you, and the move shows the change before it is made.',
      'Your own card counts the foes coming for you.',
      `Guard: you take ${GUARD * 100}% of every hit until your next turn.`,
      `Health Potion: restores ${POTION_HEAL * 100}% of your health. The satchel holds ${SATCHEL}, and the Association can add room.`,
      `Standing orders, set on the Shadows screen, steer your Shadows and your own turns on Auto: ${TACTICS.map((x) => x.name).join(', ')}.`,
      'Orders set while a step is underway hold from the next step.',
      'The Association’s hunters are not yours to order. They pick their own targets.',
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
      `A clear pays shards by grade, E-S: ${GATE_SHARDS.E}-${GATE_SHARDS.S}. The first clear pays double, once.`,
      'A clear leaves materials for the Forge, and now and then a blueprint.',
      `Being carried out locks you out of Gates for ${WIPE_LOCK / 36e5} hours.`,
    ],
  },
  {
    title: 'Quests',
    lines: [
      'The Quests screen opens once the Practice Gate is cleared.',
      'It holds Ryn Valcorde’s Association Quest, the day’s Daily Quests, your next rank, the Pale Spire’s week, the Trial, the Chosen and the Secret Quests.',
      'Each quest is a tile that shows where it stands. Tap one to open its window.',
      'Reclassification: your next rank, the level it needs, and what it brings.',
      'Weekly Quest: the next floor of the Pale Spire that raises what the week pays.',
      `The Trial appears from ${ASCENSION_FROM}-Rank. The Chosen appear once a Trial is won.`,
      'The tab counts the day’s Daily Quests until you open it, the Trial while today’s attempt is unused, a rank waiting to be claimed, and an Association Quest waiting to be reported.',
      `There are ${MISSIONS.length} Secret Quests. None is shown until it is done.`,
      'The Secret Quests window adds up everything they have paid.',
    ],
  },
  {
    title: 'Association Quests',
    lines: [
      'Ryn Valcorde hands out work for the Association, one job at a time, once the Practice Gate is cleared.',
      `Each job is at your grade: fell a number of one creature, clear one Gate, or fell one Gate’s boss.`,
      'The job’s Gate is pinned to your board, marked Association, until the job is done.',
      'Creatures count in any Gate, however the run ends. A clear counts only when you clear.',
      'A Chosen standing in the boss’s place is that boss, for his job. Clear the Gate past it and the job is done.',
      'When it is done, report to him from his card on the Quests screen. He pays, then hands over the next.',
      `Every job pays ${Math.round(ASSOC.xp * 100)}% of a clear’s XP at its grade.`,
      `About ${Math.round(ASSOC.bare * 100)}% pay nothing more. The rest pay a potion, shards or a ${SURVEY.name}.`,
      `Jobs ${ASSOC.satchelAt.map((n) => n + 1).join(', ')} widen your satchel by one Health Potion each.`,
      'The line loops through the three kinds, and asks for more creatures and stronger Gates each time round.',
      `A ${SURVEY.name} charts every room of a Gate’s map, before you go in or once you are inside.`,
      'A potion you hold is drunk before one is bought. The potion buttons show how many you hold.',
    ],
  },
  {
    title: 'Daily Quests',
    lines: [
      `The System issues ${CONTRACTS_PER_DAY} Daily Quests a day, for your grade when they are issued.`,
      'They are on the Quests screen. Each one says where it can be done.',
      'A Gate on the board that a Daily Quest names is marked Quest.',
      `Each pays ${CONTRACT_PAY.shards === 1 ? 'a clear’s' : `${CONTRACT_PAY.shards} clears’`} shards at that grade and ${CONTRACT_PAY.xp * 100}% of a clear’s XP.`,
      `All ${CONTRACTS_PER_DAY} together pay ${CONTRACT_BONUS.shards} clears’ shards, ${CONTRACT_BONUS.xp * 100}% of a clear’s XP and ${CONTRACT_BONUS.survey === 1 ? 'a' : CONTRACT_BONUS.survey} ${SURVEY.name} on top.`,
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
      'A block taken offers the next one on its results: Climb On walks straight into it, if you are fit to enter.',
      `On Monday the week pays ${SEASON_PAY.shards} clears’ shards at the grade of your highest floor, and a piece of that grade’s gear.`,
      `It pays ${SEASON_PAY.step * 100}% more for every ${SEASON_PAY.beyond} floors past ${SPIRE_TOP}.`,
      'Then the floors rearrange, and everyone climbs again.',
    ],
  },
  {
    title: 'Ascension',
    lines: [
      `Ascension opens at ${ASCENSION_FROM}-Rank. It is the climb after the ranks: the same Gates, played harder, for more.`,
      'Choose a level on the Ascension tile of the Gates screen. Every Gate you enter is played at it, and Level 0 is the board as it stands.',
      `The first ${ASCENSION_RULED} levels each make every foe stronger and add a rule, on top of every rule below it.`,
      `Past them the ladder has no top. Each level makes every foe ${Math.round((BEYOND.growth - 1) * 100)}% stronger than the one below, and adds no rule.`,
      `Each level pays ${ASCENSION_PAY * 100}% more on a Gate than the level below.`,
      'You can step back down at any time.',
      `A level opens when you prove the one below it: ${proofOf(ASCENSION_FROM)} cleared at it, then the Trial.`,
      ...SHORT.map((g) => `At ${g}-Rank the proof is ${proofOf(g)}.`),
      'The Ascension tile holds the level you enter at, its rules, the road to the next level and your marks.',
      'The proof and the Trial are on the Quests screen too.',
      `The Trial is a Gate of the Chosen, fought back to back with no rest and no way out: ${TRIAL.extra} more than the level it proves, up to ${TRIAL.most}.`,
      'The Trial is the System’s. No hunter of the Association goes in with you, but your Shadows do.',
      'Each of the Chosen is one of your grade’s bosses, stronger for every round before it.',
      'The Trial is fought at the level it proves. You can enter it once a day.',
      'Winning a Trial sends its last Chosen into the Gates.',
      'Each day one holds the first Gate of your grade, and shows itself only at its level or higher. Then it stands in the boss’s place.',
      'Felling it there counts as felling that Gate’s boss for an Association Quest.',
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
      `Each Gate adds fatigue by grade, E-S: ${RAID_FATIGUE.E}-${RAID_FATIGUE.S}, out of ${FATIGUE_MAX}.`,
      `Fatigue lowers every stat, to half strength at ${FATIGUE_MAX}.`,
      `It fades about ${FATIGUE_PER_HOUR} each hour.`,
      'It is the only limit on how much you can raid.',
    ],
  },
  {
    title: 'Shadows',
    lines: [
      'A felled creature can linger after a clear.',
      `Extract it with mana and it may join your army. Its success rate is ${Math.round(HOLD.base * 100)}%, plus ${Math.round(HOLD.perInt * 1000) / 10}% for each point of INT, up to ${Math.round(HOLD.max * 100)}%.`,
      `Extraction costs MP by grade, E-S: ${EXTRACT_MP.E}-${EXTRACT_MP.S}, whether or not it holds.`,
      `A Shadow that does not hold still lingers: you can reach for it ${EXTRACT_TRIES.max} times in all. Each reach costs ${EXTRACT_TRIES.step === 2 ? 'twice' : `${EXTRACT_TRIES.step} times`} the one before.`,
      `You can deploy ${SQUAD.E} at E, ${SQUAD.C} at C and ${SQUAD.A} at A. Some Secret Quests add more.`,
      'Shadows never make a Gate harder.',
      `A Shadow levels on every creature it helps fell: XP ${SHADOW_XP.kill} for each one it landed a hit on, and ${SHADOW_XP.boss} for a boss.`,
      `Each level grows every attribute by ${GROWTH_PER_LEVEL * 100}% of its creature’s own.`,
      `Each rank caps its level: ${SHADOW_RANKS.map((r) => `${r.name} Lv.${r.cap}`).join(', ')}. At the cap it takes no more XP until it is promoted, and the promotion lifts the cap without changing its level.`,
      `Promotion asks for its level at the cap and Shadow Essence, and from ${SHADOW_RANKS.find((r) => r.bosses)?.name} Rank bosses it helped fell: ${SHADOW_RANKS.slice(1).map((r) => `${r.name} ${r.essence} Essence${r.bosses ? ` and ${r.bosses} bosses` : ''}`).join(', ')}.`,
      'Promote it from its card on the Shadows screen, by holding Hold To Promote. A Shadow ready to be promoted is marked Ready on the Army, and lights its tile.',
      'Tap Ready on the Army to promote and awaken every ready Shadow at once, as far as your Shadow Essence goes.',
      `An Ascendant Shadow at Lv.${SHADOW_RANKS[SHADOW_RANKS.length - 1].cap} can be awakened from its card with Shadow Essence, ${AWAKENING.cost.length} stars in all: ${AWAKENING.cost.join(', ')}.`,
      `Each star grows every attribute by ${AWAKENING.growth * 100}% more of its creature’s own.`,
      `A creature like one already in your army gives Shadow Essence when its extraction holds, by grade, E-S: ${ESSENCE.E}-${ESSENCE.S}, and twice that from a boss.`,
      'Release a Shadow from its card for Shadow Essence: its creature’s, and half of what its ranks cost. A Shadow released is gone.',
      `Each rank has its insignia: ${SHADOW_RANKS.map((r, i) => `${r.name} ${['one chevron', 'two', 'three', 'three over a rocker'][i] ?? ''}`.trim()).join(', ')}.`,
      'A Shadow’s badge shows what it was, its family’s glyph, with its shadow behind it.',
      'A newly bound Shadow fights with its creature’s first ability.',
      `At ${SHADOW_RANKS[SECOND_AT].name} it remembers a second, from its own kit or, if it had only one, from its kin.`,
      'Every Shadow follows the army’s standing orders.',
      'Auto Deploy, on the Army, fills the squad with your strongest Shadows by power.',
      'Drag a Shadow onto a slot to place it there, or onto another deployed Shadow to swap the two.',
      'Drop a deployed Shadow on the list to take it out. On a phone, hold it a moment first.',
      'You may bestow a name on a Shadow when it joins your army, or later from its card. It goes by that name everywhere.',
    ],
  },
  {
    title: 'Equipment and the Exchange',
    lines: [
      'Ten slots, six rarities.',
      'Every piece rolls its core bonus at 75-125% of its design, plus its own properties.',
      'Auto Equip picks the best of what you hold, and favours a set you hold two or more pieces of.',
      `${SETS.length} sets of three pieces, Rare and up.`,
      'Two pieces of a set worn together pay a bonus, and all three pay another.',
      'The item’s sheet says what each set pays.',
      `An upgrade moves an item’s quality and every property ${UPGRADE.share * 100}% across its design’s range, until it is perfect.`,
      'Perfect means its quality and every property are at their best. A piece whose quality alone is at its best is marked Perfect quality, and its card counts the steps left.',
      `A step takes alloys of the item’s rarity and Mana Shards: ${UPGRADE_COST.alloy[2]} ${ALLOYS.C.name} at Rare, ${UPGRADE_COST.alloy[5]} ${ALLOYS.S.name} at Legendary.`,
      `Past perfect, it goes as far as your Ascension allows, from ${ASCENSION_FROM}-Rank. Each step past also takes ${forge.EMBER.name}, ${UPGRADE_COST.ember} more for every step already past.`,
      'Properties apply in the fight as they read: Critical Chance +9% is 9 points of critical chance.',
      `Save what you wear as a loadout from the Equipment sheet, ${LOADOUTS} in all, and wear it again in one tap.`,
      'An item stays marked New until you look at it, or leave the Inventory.',
      'Select in the Inventory picks items to recycle together. Worn and starred items cannot be picked.',
      'A rarity tapped in Select picks all of it, and tapped again unpicks it.',
      `The Exchange redraws ${BLUEPRINT_SHELF} blueprints at midnight, mostly at your grade.`,
      `Potions are always in stock: ${POTIONS.map((p) => `${p.name} ${p.price}`).join(', ')}.`,
      'Health and Mana Potions are bought to carry. Health Potions go in your satchel, for a fight or between rooms.',
      'The other potions are drunk when bought.',
    ],
  },
  {
    title: 'The Forge',
    lines: [
      'Gear is forged from blueprints. A blueprint is yours for good, and forges its design as often as you have the materials.',
      'Every piece forged rolls anew. Forge it again for a better roll, and recycle the one you do not keep.',
      `Alloys, one to each rarity: ${RANKS.map((r) => ALLOYS[r].name).join(', ')}.`,
      `Parts: ${PARTS.hide.name} for armour, ${PARTS.bone.name} for weapons, ${PARTS.core.name} for off-hands and jewellery.`,
      ...(['hide', 'bone', 'core'] as const).map((k) => `${PARTS[k].name} comes from ${Object.keys(FAMILY_PART).filter((f) => FAMILY_PART[f] === k).join(', ')}.`),
      `A recipe takes alloys of its rarity, a few of the rarity below, its part and Mana Shards: ${RECIPE.alloy[5]} ${ALLOYS.S.name}, ${RECIPE.lower[5]} ${ALLOYS.A.name}, ${RECIPE.part[5]} parts and ${gateShards('S', RECIPE.shards)} shards at Legendary.`,
      `A set’s piece also takes ${RECIPE.trophy} trophy of its home Gate’s boss. Every clear there leaves one.`,
      `Fights, gatekeepers and the clear leave alloys of the Gate’s grade, and some of the grade below. Each creature felled leaves its part ${Math.round(DROPS.part * 100)}% of the time.`,
      `The clear also leaves ${DROPS.clearParts} of every part.`,
      `${forge.EMBER.name} comes from clears entered at an Ascension level, more the higher it is, and from the Chosen.`,
      'Every Gate’s first clear leaves a blueprint, for the kind of piece your best blueprint is weakest at. A set’s home Gate leaves one of its own.',
      `Each rank you claim pays ${BLUEPRINTS.rank} blueprints of its grade, chosen the same way.`,
      `Any other clear leaves one ${Math.round(BLUEPRINTS.clear * 100)}% of the time, and a gatekeeper ${Math.round(BLUEPRINTS.elite * 100)}%. A set’s home Gate leaves one of its own ${Math.round(BLUEPRINTS.home * 100)}% of the time.`,
      `When you know every design of a rarity, a blueprint of it comes as ${BLUEPRINTS.known} of its alloy instead.`,
      'Blueprints also come from the Exchange, from the Pale Spire’s week, and sometimes from Ryn Valcorde.',
      `A piece found whole is rare: ${Math.round(FORGED.clear * 100)}% of clears, ${Math.round(FORGED.cache * 100)}% of caches.`,
      `Recycling gives back ${Math.round(SALVAGE.alloy * 100)}% of the recipe’s alloy and ${Math.round(SALVAGE.part * 100)}% of its part, and half the alloy its upgrades took.`,
      `Issued kit recycles into ${SALVAGE.issued} ${ALLOYS.E.name}.`,
      `Weapon Familiarity: every creature felled while you carry a weapon is a point toward knowing its design. ${FAMILIARITY_MAX} ranks, at ${FAMILIARITY.at.join(', ')} points.`,
      `Each rank adds Attack and magic +${FAMILIARITY.bonus * 100}% while it is worn.`,
      `Each rank also lifts every roll when you forge that design: its quality starts ${FAMILIARITY.floor * 100}% further up its range, and so do its properties.`,
      'Familiarity belongs to the design. Forge it again and the new piece is known as well as the old.',
      'Tap a material in a recipe, or in the Forge’s Materials, to track it. The anvil marks it, and every Gate on the board that leaves it.',
      'Track Missing on a blueprint tracks every material it is short of at once. Tapped again, it stops tracking them.',
      'A part is tracked where its families walk. Every clear leaves one of each besides.',
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
