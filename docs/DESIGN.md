# ARISE — design

Where the game is going after v7. README.md describes the game as it stands; this describes what
gets built next, in order, and why. Each numbered feature is its own pull request, ending with
`npm run calibrate` and `npm run balance`.

## What it is

A Solo-Leveling-inspired dungeon diver. You are an E-Rank who should never have mattered, and the
System has picked you anyway. The game is the climb: deeper Gates, sharper choices, a growing
Shadow army, and a fixed world that slowly takes you seriously.

The world, characters, ranks and bestiary are original and stay that way. Borrow the tone, never
the specifics: no named characters, places, monarchs, items, skills, quests or story beats from the
source material.

The System is the exception. It speaks the way the source's System speaks, and its windows may
reuse the source's message templates and stock lines word for word: the window types (Alarm,
Message, Quest Info, Quest Reward, Status, Skills, Inventory), one-line bracketed notices such as
"[You have leveled up!]" and "[The Dungeon Boss has been slain.]", the item, skill and status card
layouts, and the accept-or-refuse prompts. What fills a template is ours: our gates, foes, gear,
skills and numbers.

## Pillars

1. **Your choices win fights.** Stats get you in the door; decisions get you out. v7's combat is
   still a replay, and that is the first thing to change.
2. **Honest odds.** The brief simulates the gate with the real engine and tells you how often it
   clears. Every new mechanic has to be one the projection can play.
3. **The climb is long and legible.** Every reward says what it is worth before you commit, read
   from engine constants. No hidden multipliers.
4. **Fatigue paces you, not a timer or a wallet.** There is no energy for sale and no daily cap.
   Money buys the Licence and shard packs, never time.
5. **One engine call settles a run.** Anything a run pays is paid in `raid.finish`, so closing the
   app mid-run can neither dodge a loss nor double a win.

## Decisions already made

- The fitness version is frozen on the `fitness-baseline` branch. A future fitness-only app starts
  from there, in its own repository, with none of this combat.
- Gates pay experience by grade (`GATE_XP`); the first clear pays it twice. Levels pay points the
  player spends (`POINTS_PER_LEVEL`, `RANK_UP_POINTS`).
- A cleared gate is replaced by another of its grade. The board redraws at midnight.
- The Association Licence stays as the one-time purchase that opens grades above D on Android.
- The save key (`arise-rpg:save`) and the Android app id (`com.ariserpg.app`) are this game's own.
- **Parked:** the public name. "ARISE" plus Solo Leveling plus a dungeon RPG sits right beside
  Netmarble's *Solo Leveling: Arise* in the Play Store. Pick a new name before any store listing;
  the save key and the app id do not need to change when it does.

## The roadmap

### 1. Turn-based combat — built

The hunter acts by hand. Allies and Shadows act on standing orders. An **Auto** toggle hands the
hunter's turns to the System and presses on between chambers, for grinding.

- **Engine.** `battle()` in `core/combat.ts` is the fight as a generator: it pauses on the
  hunter's turn, yields what they can use and who is left to aim at, and takes back an order.
  `fight()` drives it with nobody waiting. `choose()` and `targets()` are the **auto policy**: what
  Auto does, and what everyone does without orders.
- **Hunter actions:** a skill from the class kit, Strike, *Guard* (half damage until your next
  turn), or a field potion (30% of maximum HP). Field potions are bought at the Exchange into a
  satchel of three; the other potions are still drunk on purchase.
- **Standing orders**, set in the brief: *As They See Fit*, *Finish The Weakest*, *Protect The
  Hunter*, *Spread The Pain*. Each is a target rule. The run keeps the orders it went in with.
- **The save** records the hunter's orders for the chamber being fought, not the fight state. The
  engine is deterministic for a seed and a list of orders, so a reload replays to the same turn.
  Each order is written before it plays out, so a turn cannot be rerolled.
- **The projection** fights the hunter's turns on the auto policy, with the party's real standing
  orders. The brief says so. Playing well beats the verdict; that is the point.
- **Calibration** still uses the auto policy and default orders, and the auto policy fights
  exactly as the old replayed battle did, so the tuning did not move.
- **The practice gate** is where the first turn is taught. Valcorde holds back in there
  (`INSTRUCTOR_RESTRAINT`) so the kills are the hunter's.

**What playing it showed.** A typical hunter gets two or three turns in a mob chamber and eight to
fourteen against a boss, so turns matter. But with skills at D, B and S, a turn from E to C-Rank was
Strike, one skill, Guard or a potion, and Guard was a guess. Both are fixed in step 5's first half,
below.

### 2. Dungeon maps — built

A gate is a short branching map: a few layers of choices, a rest, then the boss. It is drawn from
the gate and the day (`core/map.ts`), so the brief shows it before you go in and everyone who
enters that day walks the same one. Every node is reachable and leads on to the boss; the first
layer is all fights and every layer holds at least one.

- **Steps** (`data/nodes.ts`): fight (banks shards, sometimes gear), gatekeeper (a sure piece of
  gear), rest (heals, and is the only place to withdraw from), cache (gear a grade below the gate),
  shrine (one of two blessings for the run), trap (a Perception check) and five events, each a
  choice with its odds stated, some read off an attribute.
- **What the run finds is banked on it** (`haul`, `purse`, `blessings`) and paid in `finish`: kept
  walking out, at the end or from a rest; lost when carried out.
- **The brief's verdict walks the System's road**, marked on the map: fight first, rest when it
  can, decline the gambles, avoid traps and gatekeepers. Auto walks it too, and calibration tunes
  to it, so the verdict is exact for the road it shows and nothing else.
- **The arena** shows the map between steps, with a strip for the hunter's health, the party
  still standing, what is banked and the blessings held. Every step and choice is written to the
  save before it plays.
- **Save version 2.** A run left open from before maps starts its map over as it stood, or stays
  lost if it had lost a chamber.

**What is left open.** Mid-map rests are rare (a weight of 6 against fights' 44), so most runs can
only withdraw right before the boss. That makes every gate a commitment; whether it is too much of
one is a question for playing it. Calibration now samples twelve days per gate, because a gate's
difficulty moves a little with its map.

### 3. System contracts — built

The System issues three contracts a day, replacing what the Daily Quest used to be. They sit in a
System window on the Gates screen, and again on the results of every run.

- **Drawn** (`core/contracts.ts`, table in `data/contracts.ts`) from the day and the hunter's grade,
  and written to the save the first time the day's are shown, so a level-up at noon cannot redraw
  them. They read the two gates that open the day at the hunter's grade, so each one names where it
  can be done.
- **Six kinds:** clear two or three gates at your grade or above; fell so many of one family (kills
  in any gate count, cleared or not); beat a gatekeeper; clear a gate off the System's marked road;
  clear one walked into carrying three gates' worth of fatigue (the hint says how weak that makes
  you); and, from D-Rank with a Shadow out, let the Shadows land so many kills.
- **Pay:** each contract pays a clear's shards and a tenth of a clear's experience at the grade it
  was issued for; all three pay twice the shards and a fifth of the experience on top. Nothing
  expires into a penalty.
- **Counted, and paid, inside `raid.finish`**, from what the run did. Their experience is granted
  with the gate's in one call. The practice gate counts toward nothing, and contracts start once it
  is behind the hunter.
- **The balance report** shows days to each rank with every contract done every day. It saves a
  three-a-day hunter about a sixth of the climb to Sovereign, and a ten-a-day hunter about a
  twentieth.

**What changed from the plan.** *Bind a Shadow* is not a contract: binding hangs on a creature
lingering, which a contract cannot promise, so it became Shadow kills instead. Nothing asks for a
gate above the hunter's grade either. A mid-grade hunter clears about one in ten of those, and
being carried out locks them out for twelve hours, so it would cost the day's other two.

### 4. The endless climb — built

**The Pale Spire** is the one Gate that never closed. It stands beside the board on the Gates
screen, and opens once a hunter has cleared five gates. Valcorde introduces it; he can, since
everyone knows the Spire is there.

- **Blocks of five floors** (`core/spire.ts`, rules in `data/spire.ts`). Each block is played as a
  gate of its own: three floors of choices from step 2's map, a rest, then a boss. A block costs the
  fatigue of one gate of its grade and pays like one, with no first-clear bounty. The rest is the only
  place to walk out, as in any gate.
- **Floor N is built for a hunter of Level N** as far as Floor 100. Each grade's floors start where the
  level ladder does (E 1, D 11, C 21, B 36, A 51, S 71). A hunter climbs from their own grade's first
  floor, or from above their best this week. As with the board, they can go one grade above their own.
  Above Floor 100 each block is 3% harder than the last, and nothing stops it: a maxed Sovereign gets
  about halfway on Floor 131 and has a one-in-ten chance on Floor 151.
- **The week.** Each block takes the shape of one gate of its grade for the week: its creatures, its
  gatekeeper, its boss. The best floor of the week is kept. On Monday the week closes (`spire.settle`,
  run when the app opens and inside `finish`). It pays four clears' worth of shards at the grade of the
  highest floor and a piece of that grade's gear, plus a quarter more for every ten floors past 100.
  Then the climb starts again. It is all on the device; there is no server and no leaderboard.
- **Calibrated like the gates.** `npm run calibrate` tunes each gate's creatures as a block at the
  middle of their grade (`BLOCK_TUNE`), then each block up to Floor 100 for the level of its middle
  floor (`SPIRE_TUNE`). Both land near 75%.
- **Records and Missions:** the best floor ever and this week, two new Secret Missions (*Up* and *The
  Top Floor*), and a Profile record. A Spire block counts as a gate for the gate records and the
  contracts. It does not count for the board's distinct gates cleared or bosses on file.

**What playing it showed.** A single block's odds swing as much from day to day as a gate's do, with
the day's map and the allies sent in. On a five-floor block the swing is a little wider. The brief
shows that day's real odds, so the spread stays honest rather than hidden. A fixed number of foes per
fight was tried and did not narrow it.

### 5. Depth for the hunter

- **Skills sooner — built.** Class skills arrive at D, C and A, passives at B and S. A C-Rank hunter
  has two skills, one with a cooldown. Every rank still adds exactly one thing.
- **Foe intents — built.** Each foe settles its next action (ability and first target) the moment
  its last one ends, shows it on its card, and does exactly that unless its target falls first or
  it is stunned. Intents are chosen against the cooldowns as they will be when the foe acts, so a
  one-round cooldown stays one round. The hunter's card counts the foes coming for them, and
  *Protect The Hunter* goes for whatever is about to hit you. Gates recalibrated.
- **Skill choices at rank-up — built.** Each rung of every line now offers two options, two skills
  or two passives, and the hunter keeps one. There are 15 new skills and 10 new passives, all data
  built from abilities and passive styles the combat engine already plays. A line's four passives
  never share a style, so any pair of picks stacks.
  - **Defaults:** until a hunter chooses, a rung gives its first option, which is exactly the old
    kit. The Association's hunters and calibration's typical hunters fight as before, and
    `npm run calibrate` wrote an identical `gatetune.ts`.
  - **Holding a choice:** a choice holds until the hunter's next rank. Then every earlier choice can
    be made again, and at S-Rank it is for good. Choices are kept per line, so a hunter reclassified
    away and back finds theirs waiting. An open run keeps the party it walked in with.
  - **Where:** the class sheet on the Profile holds the choices. The class window at a rank-up names
    the two options, and the Profile tab counts the rungs still to choose.
  - **Balance:** a hunter on every second option, against the same hunter on every first, lands
    within seven points of the clear rate at C, A and S for every line. They are trades, not upgrades.
- **Gear sets — built.** All sixteen sets in `data/equipment.ts` have three pieces, so the bonuses
  are for two and three pieces worn, not two and four. They are defined as data in `data/sets.ts`,
  in the units the combat engine's gear bonuses already use, and reach the fight through
  `raid.heroSpec`.
  - **Home gates:** each set has a home gate of its grade, named for it. A clear there turns the
    first piece of the clear's gear into a piece of the set, one the hunter does not hold yet while
    there is one, so a set takes three clears of its gate. A Spire block in that gate's shape counts.
  - **Auto Equip** leans toward a set the hunter holds two or more pieces of, by more than quality
    can span, so only a much rarer piece breaks a set.
  - **Effect:** a full set lifts a mid-grade hunter's clear rate by two to eight points. Typical
    hunters almost never wear one, so calibration did not move.
- **Upgrading — built.** From a piece's sheet, each step moves its quality and every property a tenth
  of the way across its design's range, until it is perfect, for a price shown up front (by rarity:
  60 shards a step at Rare, 270 at Legendary). The issued kit is not upgraded. Recycling stays the
  way to turn spares into shards.

### 6. Depth for the Shadows — built

- **Shadow ranks** (`data/shadows.ts`). Kills promote a Shadow: Bound, Sworn at 25 kills, Vanguard
  at 75 and Ascendant at 150. Each rank lifts how far kills can grow it (+25%, +50%, +75%, +100%),
  so a promotion is a visible jump.
  - A newly bound Shadow fights with its creature's first ability. Sworn, it remembers a second:
    the second in its own kit or, for the 58 creatures that have only one, the first ability of
    its kin it lacks (its family's, or its role's for a family that shares one).
  - Promotions are counted in `raid.finish` and shown on the results.
- **More slots through Secret Missions.** Three new ones each make room for one more Shadow: a
  first Sworn Shadow, ten bound, and a first Ascendant. Slots are the grade's plus the missions'
  (`shadows.slots`).
- **Standing orders per Shadow.** A Shadow can keep orders of its own, set on its sheet, over the
  party's. They ride on its unit spec (`tactic`), so a run frozen at entry keeps them. A Shadow
  without orders of its own fights exactly as before.
- **Balance.** Calibration's typical hunters have no Shadows, so `npm run calibrate` wrote an
  identical `gatetune.ts`. A mid-grade hunter with a full squad of Bound Shadows of their grade's
  creatures clears about four to nine points more, and promoting them all the way adds up to four
  more. A Shadow bound before this change, with fewer than 25 kills, now fights with one ability
  until it is Sworn.

## What a campaign showed

The roadmap is built. `npm run campaign` then played it end to end: two hunters from the licence
desk, through the real engine, for 120 days. One played an evening a day; the other played three
sessions. Each raided until tired or hurt, walked the System's road on Auto, climbed one Spire block
a day, reached for every Shadow it had the mana for, and spent its shards on the shelf and on
upgrades.

| | One evening a day | Three sessions a day |
|---|---|---|
| Runs a day | 2.3 | 4.1 |
| Cleared | 97% | 97% |
| S-Rank | day 63 | day 40 |
| Sovereign | not by day 120 | day 75 |
| Contracts a day, of 3 | 0.9 | 1.6 |
| Spire, best floor | 105 | 105 |
| Shards left on day 120 | 16,800 | 79,900 |

What it says, and what to decide next:

1. **An invested hunter outgrows the calibration.** *Decided: Ascension, below.* Gates are tuned to 75% for a typical hunter:
   random gear at whatever quality it rolled, no Shadows, no sets. The campaign's hunters had
   perfect, upgraded gear by A-Rank, four to six Shadows and a set or two, and cleared 97%. The
   brief tells them so honestly, but from the middle of the climb nothing is hard. *Decision:*
   either calibrate against a hunter who keeps up (upgraded gear and a squad for their grade), so
   75% is what a playing hunter meets, or keep it and accept that investment makes the game easy.
   The first is harder on someone who never binds a Shadow.
2. **Shards have nowhere to go at the top.** *Decided: past perfect, under Ascension.* Gear is perfect by S-Rank, the shelf has nothing
   better, and the purse grows without limit: 80,000 unspent for the three-session hunter.
   *Decision:* add a sink that keeps paying. The candidates are rerolling a piece's properties at the
   Exchange, or training a Shadow with shards toward its next rank.
3. **Contracts are a choice, as designed.** Auto completes one or two a day: the clears and the
   kills. The rest ask for what Auto will not do: leave the road, take on a gatekeeper, walk in
   tired. All three fall on 3–13% of an Auto hunter's days, and more for a player who chases them.
4. **The climb is quicker than the formula says.** Clears run near 97% rather than the 75% the
   days-to-rank model assumes. One evening a day reaches S-Rank in nine weeks, and three sessions
   reach Sovereign in eleven.
5. **Levels do not stop at 100.** They keep paying points until every attribute is capped. That
   predates v7 and suits the endless Spire, but Sovereign's line, "the System has nothing left to
   award", is not quite true.
6. **Fatigue holds an S-Rank hunter to about one gate a session**, as intended. The Spire competes
   with the board for that fatigue, which is why the campaign climbs one block a day.

## Ascension — the ladder built

Gladiator Manager's answer to a late game that flattens is Ascension: a ladder of stacking, named
rules, each level opened by proving the one below. ARISE takes the ladder but not the restart. GM
plays each level as a new game, which suits turns a player can rattle through. ARISE is paced by the
clock (fatigue, the daily board, the Spire's weeks), so the ladder runs on the hunter's own climb.

- **Ten levels** (`data/ascension.ts`, `core/ascension.ts`). Every level makes every foe stronger
  (`ASCENSION_TUNE`). From level 2 each adds one rule on top of all the rules below it: Thin Rest,
  Short-Handed, Heavy Legs, Wardens Wake, Crooked Luck, Hungry Dark, Never Alone, Worn Thin and The
  System Watches. At the top, Auto will not fight a boss. Each level pays 10% more on a gate than the
  one below.
- **Choosing.** The hunter chooses a level on the Gates screen, anywhere from 0 to the highest opened.
  A run keeps the level it walked in with, and the brief's assessment plays every rule it brings.
  The practice gate is always played at 0.
- **Proving.** A level opens when the one below it is proved: four different gates of the hunter's
  grade cleared at it (GM's league trophies), and then the Trial. S-Rank has only three gates, so
  there it is all three (`proofNeeds`). Only clears at the highest level opened count, and only from
  C-Rank.
- **The Trial** (`core/trial.ts`) is GM's Ascension tournament.
  - **The gauntlet:** proving level L means beating L+2 of the Chosen in a row, in a gate with one to a
    layer, no rest and nothing to withdraw to.
  - **The Chosen:** twelve named bosses (The Gatewatcher to The Ninth Door). Each is one of the
    hunter's grade's gate bosses, weakest first, 6% stronger for every round before it. Every round
    is fought with a boss's health, and only the last ends the run.
  - **Play:** it is fought at the level it proves, whatever is chosen, and can be walked into once a day.
    Losing it costs that day's attempt and a lockout, like any defeat.
  - **Calibration:** each level's Trial is tuned so a hunter who keeps up wins it about half the time
    (`TRIAL_TUNE`).
- **Calibration.** Level 0 is the board as it was. Each level above is tuned so a hunter who keeps up
  (upgraded gear, a squad of Vanguard Shadows) clears from 85% at level 1 down to 53% at level 10. A
  typical hunter who has not kept up falls far faster: from 68% at level 0 to 19% at level 5. The
  ladder is for the hunter who has outgrown the board.
- **What a campaign shows.** `npm run campaign` now reads the brief before each run. It climbs to the
  highest level the assessment gives 75% or better, takes an even chance on a run that counts toward a
  proof, and takes the Trial when the assessment gives it an even chance. Over 120 days the invested
  hunters clear 72–87% instead of 97%. The one-evening hunter opens Ascension 5 in 7 Trials; the
  three-session hunter opens 8 in 11. They are carried out three to four times as often, which slows
  the climb: S-Rank on day 81 instead of 63, and Sovereign on day 86 instead of 75.
  A hunter who climbs without reading the brief is crushed (about 40% clears), which is the death
  spiral GM's analysis warns about; the brief is what stops it.
- **Marks** (`core/marks.ts`) are GM's reincarnation bonuses, without the reincarnation.
  - **Earning:** every level opened earns one, set for good on one of five, with up to four on any one:
    - the Edge: +4% attack and magic;
    - the Bulwark: +6% maximum HP;
    - the Ward: +5% defence and resistance;
    - the Legion: +5% attack, magic and maximum HP for every Shadow;
    - the Long Stride: 6% less fatigue a gate.
  - **Calibration:** the levels and the Trial are tuned for a hunter holding a mark for each level
    below, set as the System would (the mark with the fewest first). A mark therefore keeps pace with
    the climb and makes the levels below easier. It cost the top level 8% stronger foes.
- **Past perfect.** Every level opened lets each piece of gear go one upgrade step past its design's
  best (`OVERCHARGE`). Each such step raises the piece half as far as a step toward perfect.
  - **Price:** the first costs what a step toward perfect did, and each one after it costs half a
    step more.
  - **Calibration:** none. It is the edge a hunter with shards to spare buys.
  - **Campaign:** the three-session hunter, who ended 120 days on 37,485 shards with nothing to spend
    them on, now ends on 592. That hunter opens Ascension 8 instead of 7 and reaches Sovereign on day
    86 instead of 98. The one-evening hunter already spent everything, and plays as before.
- **S-Rank's proof.** S-Rank has three gates and the proof asked for four, so no S-Rank hunter
  could open another level. The campaign's hunters sat at 7 and 8 for their last forty days, with the
  Trial projecting 100%. The proof now takes every gate of a grade with fewer (`proofNeeds`), and the
  campaign picks a gate that counts toward it.
  - **Three sessions a day:** this hunter opens all ten levels by day 112. It clears 73% (90% in the
    last four weeks) and reaches Sovereign on day 109. That is later than before, because it is
    fighting the top of the ladder.
  - **One evening a day:** this hunter opens 5. It pushes every proof run at an even chance from the
    bottom of S-Rank, so it is carried out often and clears 37% in its last four weeks.
- **The Chosen in the world** (`core/walkers.ts`) are GM's: at set points in a run, each Ascension
  level sends a named Chosen carrying a masterwork into the world.
  - **Sent:** in ARISE, winning the Trial that opens level L sends that Trial's last Chosen out into
    the gates.
  - **Walking:** each day one of them holds the first gate of the hunter's grade in the day's order,
    marked on the board. Those not yet felled walk first. It shows itself only to a hunter who walks
    in at Ascension L or higher, and then it stands in the boss's place. The brief says which, and its
    assessment fights it. A clear of the gate, met or not, closes it on the Chosen for the day.
  - **Rewards:** the first time it falls it leaves a masterwork. That is a piece of the gate's grade,
    perfect and L steps past it, for the slot that level's Chosen guards (`MASTERWORK_SLOTS`), so the
    ten Chosen fill the ten slots. After that it pays a bounty of two clears' worth of shards.
  - **Calibration:** none. Calibration's hunters have won no Trial, so no Chosen walks for them, and
    `gatetune.ts` came out identical. A save from before (v3 migration) has sent the Chosen of every
    level it had opened.
  - **Campaign:** both hunters hunt a Chosen when the brief gives an even chance at its level. The
    masterworks arrive mid-climb, a perfect piece of the hunter's grade, so both climb faster:

    | | One evening a day | Three sessions a day |
    |---|---|---|
    | Cleared | 85% (was 69%) | 86% (was 73%) |
    | S-Rank | day 61 (was 79) | day 48 (was 59) |
    | Ascension opened | 9 (was 5) | 10, by day 84 (was 112) |
    | Last four weeks cleared | 88% (was 37%) | 100% (was 90%) |
    | Chosen felled / masterworks | 11 / 6 | 57 / 10 |

    By day 120 neither hunter wears more than one masterwork. Sets and pieces upgraded past perfect
    replace them by the top.
- **Next.** The three-session hunter outgrows Ascension 10 about a month before day 120. It clears
  everything there, at Level 119, wearing gear ten steps past perfect. GM's ladder has sixteen
  levels. The question now is the top: more levels, or a ladder with no top, as the Spire has.

## What stays out

- Anything that needs the player to exercise. That is the fitness app's job.
- Energy, stamina timers, or anything else that sells time.
- Gacha: equipment and Shadows come from Gates, the Exchange and extraction, at stated odds.
- A server. The game stays on the device and works offline.
