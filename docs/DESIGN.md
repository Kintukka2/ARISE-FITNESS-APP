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

The System is the exception. It speaks the way the source's System speaks, with the anime as the
main reference, and its windows may reuse the source's message templates and stock lines word for
word: the window types (Notification, Quest Info, Quest Rewards, Status, Skills, Inventory),
one-line bracketed notices such as "[You have levelled up!]" and "[The Dungeon Boss has been
slain.]", the item, skill and status card layouts, and the yes-or-no prompts. What fills a template
is ours: our gates, foes, gear, skills and numbers. docs/VOICE.md has the templates.

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
- **The public name is Arise: Dungeon RPG.** It is the store title, and "Arise" is the label under
  the icon. The splash wordmark sets it as ARISE.
  - **Why Arise stays:** "Solo Leveling" is Netmarble's brand, not "Arise". The Play Store already
    lists many Solo-Leveling-inspired apps named "Arise: …", and the title collects the searches for
    both "arise" and "dungeon rpg".
  - **The one borrowed specific:** "Arise" is the exception to "borrow the tone, never the
    specifics". Nothing else from the source comes with it.
  - **Kept out of the listing:** "Solo", "Leveling" and "Monarch" stay out of the title, the
    descriptions and the keywords.
  - **What did not change:** the save key and the app id stay as they were.

## The roadmap

### 1. Turn-based combat — built

The hunter acts by hand. Shadows act on standing orders; the Association's hunters pick their own targets. An **Auto** toggle hands the
hunter's turns to the System and presses on between chambers, for grinding.

- **Engine.** `battle()` in `core/combat.ts` is the fight as a generator: it pauses on the
  hunter's turn, yields what they can use and who is left to aim at, and takes back an order.
  `fight()` drives it with nobody waiting. `choose()` and `targets()` are the **auto policy**: what
  Auto does, and what everyone does without orders.
- **Hunter actions:** a skill from the class kit, Strike, *Guard* (half damage until your next
  turn), or a Health Potion (25% of maximum HP). Health and Mana Potions are bought at the Exchange
  to carry, Health Potions into a satchel of three; the other potions are still drunk on purchase.
  (Until the merge below, the fight's potion was a separate Field Potion.)
- **Standing orders**, set on the Shadows screen's Orders tile (*Army: Orders*): *As They See Fit*,
  *Finish The Weakest*, *Protect The Hunter*, *Spread The Pain*. Each is a target rule for the
  hunter's Shadows, and for the hunter's own turns when Auto plays them. They used to be set in the
  brief and to steer the Association's hunters too; ordering strangers about made no sense, so those
  pick their own targets now. They then sat on the map between fights; the map was crowded with them,
  so they moved to the Shadows screen, beside the army they steer. Set between steps of an open run
  they hold for the fights still to come in it (`raid.setTactic`); set while a step is underway they
  reach the run when its next step is chosen (`raid.choose`), never the step underway, whose replay
  reads the orders it opened with.
- **No Shadow takes orders of its own.** For a while a Shadow could be given standing orders of its
  own and a focus, a skill it used whenever it was ready, first on its card and then on the orders
  sheet. They were more to manage than they were worth, so they are gone: every Shadow follows the
  army's standing orders, and the auto policy chooses its skill. A save that set them keeps the
  fields, and nothing reads them.
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

*Rebuilt as rooms and corridors: see [Gate maps, rebuilt](#gate-maps-rebuilt--built). What follows is
the first map, which the Pale Spire's blocks still climb.*

A gate is a short branching map: a few layers of choices, a rest, then the boss. It is drawn from
the gate and the day (`core/map.ts`), so the brief shows it before you go in and everyone who
enters that day walks the same one. Every node is reachable and leads on to the boss; the first
layer is all fights and every layer holds at least one.

- **Steps** (`data/nodes.ts`): fight (banks shards, sometimes gear), gatekeeper (a sure piece of
  gear), rest (heals, and is the only place to withdraw from), cache (gear a grade below the gate),
  shrine (one of two blessings for the run), trap (a Perception check) and fourteen events, each a
  choice with its odds stated, some read off a stat (STR, AGI or INT). Besides HP, shards, gear,
  blessings and debuffs, an event can give or drain MP and ease or add fatigue, both on the hunter at
  once. Each has one choice the System makes on its road, and that one never hurts or curses
  (`tests/map.test.ts`).
- **The squad is made on the Army's roster** (see Depth for the Shadows): a row's box puts a Shadow
  in and takes one out, and the squad's count follows. It no longer lists the slots by rank; the
  Guide does.
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

### 3. Daily Quests — built

The player sees these as Daily Quests; the code and this section call them contracts. The System
issues three a day, replacing what the exercise Daily Quest used to be. They sit in a
System window on the Quests screen. A run's results show only the ones it moved, each count and
bar running from where it stood (`ContractReport.moved`, `ContractsMoved`). The board marks each
gate a contract names with a Quest chip, and the Quests tab counts the day's until they are seen.

- **Drawn** (`core/contracts.ts`, table in `data/contracts.ts`) from the day and the hunter's grade,
  and written to the save the first time the day's are shown, so a level-up at noon cannot redraw
  them. They read the two gates that open the day at the hunter's grade, so each one names where it
  can be done.
- **Six kinds:** clear two or three gates at your grade or above; fell so many of one family (kills
  in any gate count, cleared or not); beat a gatekeeper; clear a gate off the System's marked road;
  clear one walked into carrying three gates' worth of fatigue (the hint says how weak that makes
  you); and, from D-Rank with a Shadow out, let the Shadows help fell so many creatures.
- **Pay:** each contract pays a clear's shards and a tenth of a clear's experience at the grade it
  was issued for; all three pay twice the shards and a fifth of the experience on top. Nothing
  expires into a penalty.
- **Counted, and paid, inside `raid.finish`**, from what the run did. Their experience is granted
  with the gate's in one call. The practice gate counts toward nothing, and contracts start once it
  is behind the hunter.
- **The balance report** shows days to each rank with every contract done every day. It saves a
  three-a-day hunter about a sixth of the climb to Sovereign, and a ten-a-day hunter about a
  twentieth.

**The Quests screen.** A fourth tab, beside the Gates, holds every quest on one page, as a grid of
tiles (after Magic UI's bento grid): each in its subject's frame with a picture of where it stands,
and each opening its QUEST INFO window in a sheet. The quests are the day's contracts;
*Reclassification*, the next rank, the level it needs and what it brings (the Ability Points, the
class and its choice, Shadow slots, the Hollow Throne). A level only qualifies the hunter for a rank
(`rankFor`); the System says so once (`reclassReady`), the tab and the tile light up, and the hunter
claims it by holding *Hold To Reclassify* in its window (`progression.reclassify`, `flow.claimRank`).
The rank-up then plays: the gold cut from `ui/arrival.ts`, where the held plate breaks open and the
new one rises. The rank is the one held (`hunter.rank`, read by `rankOf`), and everything a rank
opens reads that: the board, the Exchange, the class and its tier, Shadow slots. The balance tools
model a hunter who claims each rank as soon as the level reaches it (`reclassifyAll`), so the tuning
does not move: `npm run balance` and `npm run calibrate` come out as before. One run per rank does
change: the one that reaches the level is settled at the rank held, so its Gate can count toward an
Ascension proof where it used to fall under the new grade. In the campaign that opens Ascension a
little sooner for the three-session hunter, and its 120 days take a different path from there. A
hunter may also hold a rank on purpose; the board, the pay, the class and the Shadow slots stay
the held rank's. The Pale Spire's week as a *Weekly Quest*,
set at the next floor that raises what the week pays (`spire.tierGoal`); the proof of the next
Ascension level and its Trial; the Chosen walking today, with how many of those sent have fallen;
and the Secret Quests, whose window ticks off each one done and adds up what they have paid
(`missions.earned`). The day's contracts and the Secret Quests span the grid; the climbs pair up
beside each other, and the last of an odd number spans it too. None of it pays:
each quest is settled where it always was, and the screen reads where it stands (`core/quests.ts`,
`contracts.unseen`). The tab opens with the practice gate cleared, when the contracts do, and the
System announces them (`[Daily Quests have arrived.]`) on the hunter's first visit to it. Its badge
counts the day's contracts until the screen has shown them, and the Trial while it stands open with
today's attempt unused (`quests.waiting`), as the Inventory tab counts unspent points.

**Every main screen is one page of tiles** (the Quests screen has since become a log; see below). After the Quests screen, Inventory, Gates and Shadows
were laid out the same way (`ui/bento.tsx`): a grid of System tiles, each with a picture drawn from
the engine and opening its window. Inventory holds Status, a radar of the five stats, Skills,
Equipment, what is held, the Exchange and the hunter's card; Equipment became a System window of its
own (`EQUIPMENT`, added to the closed list of headers). Gates keeps Valcorde's line above tiles for
the Practice Gate until it is cleared, the open run, the open Gates, the grade and its licence, the
record and Ascension. Open Gates is the screen's centre: the largest tile, its portals as big as the
row allows, a slow orange light behind them and a View All Gates call. The hunter's condition sits between Valcorde's line and the tiles,
as the Status sheet's HP, MP and Fatigue rows with their potions, so nothing has to be opened to
check it or to drink. A list is one tile: Open Gates opens the
board (`GATES`, see The Gates board, below); on Shadows, the Army opens `ARMY`, a roster with a row
to every Shadow. The brief, the dossier, the slot picker, recycling, Settings and the Guide all take the
System's frame; Settings and the Guide keep the interface's words.

The Trial and the Chosen live only here. The Gates screen keeps what bears on the next run: its
Ascension card (the level, its rules and the marks) shows once Ascension 1 is open, the board tags
the gate a Chosen holds, and that gate's brief says when it stands in the boss's place.

**What changed from the plan.** *Bind a Shadow* is not a contract: binding hangs on a creature
lingering, which a contract cannot promise, so it became Shadow kills instead. Nothing asks for a
gate above the hunter's grade either. A mid-grade hunter clears about one in ten of those, and
being carried out locks them out for twelve hours, so it would cost the day's other two.

### 4. The endless climb — built

**The Pale Spire** is the one Gate that never closed. It is a Weekly Quest on the Quests screen,
whose window holds its brief (it stood beside the board on the Gates screen too, until the Weekly
Quest made the second tile a repeat), and it opens once a hunter has cleared five gates. Valcorde introduces it; he can, since
everyone knows the Spire is there.

- **Blocks of five floors** (`core/spire.ts`, rules in `data/spire.ts`). Each block is played as a
  gate of its own: three floors of choices from step 2's map, a rest, then a boss. A block costs the
  fatigue of one gate of its grade and pays like one, with no first-clear bounty. The rest is the only
  place to walk out, as in any gate.
- **Climb On.** A block taken offers the next one on its results: **Climb On · Floors 86-90**, over
  Leave The Gate. It leaves as Leave The Gate does (the face-down loot and a lingering Shadow ask
  first, and the run's payout is narrated), then walks into the next block as the brief's Enter The
  Gate does (`flow.enterGate`, with its fatigue warning). It shows only while the hunter is fit to
  enter (`entryBlock`), and an Allocate chosen on a level-up goes to the Status sheet instead. The
  arena is keyed by its Gate, so the next block opens fresh.
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
- **Records and Secret Quests:** the best floor ever and this week, two new Secret Quests (*Up* and *The
  Top Floor*), and a record in the dossier. A Spire block counts as a gate for the gate records and the
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
- **The skill tree — built.** It replaces the choices at rank-up, below. Skill Points (one each level,
  two more each rank claimed) are spent on five Paths, one for each stat: Ruin (STR), Bastion (VIT),
  Tempest (AGI), Arcana (INT) and Sight (PER). `data/tree.ts` holds them, `core/skilltree.ts` plays them.
  - **A Path** has fifteen nodes over five tiers, D to S. Down its edges, the line's six skills (the
    old rungs' first options on the left, the other halves on the right), each levelling Lv.1 to
    Lv.MAX: ×0.1 a level, and at the top its own edge (a status, a wider reach, a shorter cooldown).
    Down its spine, an attribute at D and two fight bonuses at C and A, three ranks each, then a
    notable passive at B and at S. Either side of the spine at B and S, the old rung passives as a
    fork: learning one seals the other.
  - **Gates:** a tier opens at its rank and once its Path holds 3, 8, 14 or 20 points. A node needs
    the one it grows from. Any Path is open to any class; its skills grow with its stat, so a hunter
    who reaches across pays in points and in force. The tree holds more than a Sovereign at Level 100
    can buy, so a build is always a choice between depth and breadth.
  - **Ten new passives**, one per tier notable, each a style only the hunter has: Bloodthirst (heal
    from damage dealt), Rampage (attack for each foe put down), Ambush (the first hit crits), Flurry
    (a critical hit cools the other skills), Cull (more damage to the nearly dead), Deadeye (crits on
    a Marked foe hit twice as hard), Spiked Guard (hits taken come back), Unbroken (less damage while
    healthy), Lingering Curse (debuffs last a turn longer) and Unravel (more damage to a debuffed foe).
    Their numbers are `EDGE` in `data/tree.ts`, which the engine and the cards both read. None of them
    changes what a foe does, so a shown intent stays a promise.
  - **Skill slots:** the skills learned go into a fight in slot order, as many as the rank allows: two
    at D-Rank, three at C and B, four at A and S, five at Sovereign. A skill learned takes a free
    slot; Equip, Unequip and Swap In change the rest. A unit carries its own versions of its skills
    (`UnitSpec.own`), so a hunter's Lv.3 Hammerblow is not an ally's Lv.1.
  - **Not stored:** Skill Points are what the level and the ranks claimed have earned, less what the
    tree holds, so nothing can drift. Nothing is unlearned a point at a time; a reset hands every
    point back, free the first time and then for a clear's Mana Shards at the hunter's grade.
  - **The System's way:** `autoLearn` spends into the class's Path until nothing there can take a
    point, then the next highest stat's: passives first, then new skills down the left, then stats,
    then levels, the left fork before the right. Auto Assign is that, for a hunter who would rather
    not choose, and so are calibration's and the campaign's hunters.
  - **Save version 6:** what each open rung of the class's line gave, picked or by default, is learned
    at Lv.1 and its skills taken in; every other point waits to be spent.
  - **The Association's hunters** still fight with each line's first options (`progression.kitFor`).
  - **The screen:** the five Paths drawn as a constellation around the hunter, in the Stats radar's
    order, so a build has a shape; the rank rings lit as they are held; the points to spend at its
    centre. Below it the slots, then the chosen Path as a tree, and the card of the node tapped,
    which stays at the foot of the sheet. A point spent ignites its node, draws its link and is
    reported on the card in the System's words.
  - **Balance:** recalibrated. `npm run balance` keeps the middle of every grade at 70% to 86%. Levels
    matter more inside a grade than before, because each pays a Skill Point: the floor of a grade
    clears 50% to 75% of the time and the top 80% to 94%. Campaign, against `main`:

    | | One evening a day | Three sessions a day |
    |---|---|---|
    | Cleared | 93% (was 97%) | 93% (was 95%) |
    | Carried out | 19 (was 9) | 28 (was 22) |
    | S-Rank | day 58 (was 60) | day 34 (was 31) |
    | Sovereign | day 115 (was 111) | day 64 (was 63) |
    | Ascension opened | 8 (was 9) | 16 (was 19) |
    | Last four weeks cleared | 88% (was 93%) | 79% (was 87%) |

    Calibration now counts the typical hunter's tree, so the Gates rose with it, and a hunter who keeps
    up has a little less of an edge over them than before.
  - **Open:** whether a deep build (one Path to S, then the next) beats the System's spread by enough
    to matter. Calibration plays only the System's way.
  - **Skills that do no damage.** Every Path has one, at B, in its right lane between the C and A
    skills (`TREE_SKILLS`): Dread Roar (Ruin) and Hunter's Mark (Sight) are curses that weaken or mark
    every foe, never miss and do no damage; Challenge (Bastion) is a taunt, turning every foe's next
    action on the hunter, who guards; Smoke Veil (Tempest) veils the party (Evasion +50% for two
    turns); Renewal (Arcana) heals the party 15% of its HP. Each takes two levels, the second a turn off
    its cooldown. The taunt keeps the intent promise by showing every changed intent before the foe
    acts. The System's slots take skills that do damage first, so calibration's hunters rarely carry
    them, and they are the player's own edge. Recalibrated; the middle of every grade stays at 70% to 85%.
    In the campaign S-Rank comes on day 58 and day 33 as before, and Sovereign on day 114 and day 69
    (was 110 and 65): the B tier's extra point slows the spine a little.
- **Skill choices at rank-up — built, then replaced by the skill tree.** Each rung of every line offered two options, two skills
  or two passives, and the hunter keeps one. There are 15 new skills and 10 new passives, all data
  built from abilities and passive styles the combat engine already plays. A line's four passives
  never share a style, so any pair of picks stacks.
  - **Defaults:** until a hunter chooses, a rung gives its first option, which is exactly the old
    kit. The Association's hunters and calibration's typical hunters fight as before, and
    `npm run calibrate` wrote an identical `gatetune.ts`.
  - **Holding a choice:** a choice holds until the hunter's next rank. Then every earlier choice can
    be made again, and at S-Rank it is for good. Choices are kept per line, so a hunter reclassified
    away and back finds theirs waiting. An open run keeps the party it walked in with.
  - **Where:** the class sheet on the Inventory screen holds the choices. The class window at a
    rank-up names the two options, and the Inventory tab counts the rungs still to choose.
  - **Balance:** a hunter on every second option, against the same hunter on every first, lands
    within seven points of the clear rate at C, A and S for every line. They are trades, not upgrades.
- **Gear sets — built.** All sixteen sets in `data/equipment.ts` have three pieces, so the bonuses
  are for two and three pieces worn, not two and four. They are defined as data in `data/sets.ts`,
  in the units the combat engine's gear bonuses already use, and reach the fight through
  `raid.heroSpec`.
  - **Home gates:** each set has a home gate of its grade, named for it. A clear there turned the
    first piece of the clear's gear into a piece of the set. Since the Forge it leaves the set's
    blueprints and its boss's trophy instead. A Spire block in that gate's shape counts.
  - **Auto Equip** leans toward a set the hunter holds two or more pieces of, by more than quality
    can span, so only a much rarer piece breaks a set.
  - **Effect:** a full set lifts a mid-grade hunter's clear rate by two to eight points. Typical
    hunters almost never wear one, so calibration did not move.
- **Upgrading — built.** From a piece's sheet, each step moves its quality and every property a tenth
  of the way across its design's range, until it is perfect, for a price shown up front (by rarity:
  60 shards a step at Rare, 270 at Legendary). The issued kit is not upgraded. Recycling turned spares
  into shards; since the Forge, a step takes alloys too and recycling gives materials (below).

### 6. Depth for the Shadows — built

- **Levels, capped by rank** (`data/shadows.ts`, `core/shadows.ts`). A Shadow levels on every
  creature it helps fell: it landed a hit on it, whoever landed the last (`Unit.hurtBy`, credited in
  `raid.openChamber`). Each pays XP 1, a boss 5 (`SHADOW_XP`), and each level asks a little
  more than the last (`LEVEL_XP`). Every level grows each attribute by 2.5% of its creature's own.
  Its rank caps the level: Bound Lv.10, Sworn Lv.20, Vanguard Lv.30, Ascendant Lv.40, so the old kill
  limits' +25%, +50%, +75% and +100% stand. At the cap a Shadow takes no more XP (`shadows.earn`):
  what the run pays past it is not kept. *Changed after playtest:* XP past the cap was banked and
  spent the moment it was promoted, so a promotion raised the level too; the hunter read Level
  10 → 12 as a promotion doing what it should not, so the promotion now lifts only the cap.
- **Promotion** asks for the level at the cap, Shadow Essence (Sworn 4, Vanguard 12, Ascendant 30)
  and, from Vanguard, bosses it helped fell (1, then 4). The hunter claims it, one rank at a time,
  from its card (`shadows.promote`, which spends the Essence). `raid.finish` pays each deployed
  Shadow its XP (`grew`) and reports the Shadows the run made ready (`ready`); the results show an
  alert only to each deployed Shadow that levelled up or that the run made ready; a Shadow that only
  took XP, or was already waiting, gets none. One made ready says only that it has met the requirements
  for promotion. It stays violet and opens nothing: the Shadows tab's mark shows where to go. The hold plays the
  promotion's cinematic, and the System's window says what the rank brought: the rank, the new cap
  and any skill learned. The Essence it cost is shown on the card before, not repeated after.
- **Shadow Essence** (`s.shadows.essence`). A creature already in the army lingers three times as
  often (`ECHO`); its alert carries the Essence it would give, and a reach that holds turns it to
  Essence instead of a second copy (`raid.extract` returns `essence`): 1 at E to 4 at S, twice that
  from a boss. Releasing a Shadow from its card (`shadows.release`, refused while it walks an open
  run) gives its creature's Essence and half of what its ranks cost.
- **Awakening** (`shadows.awaken`, `AWAKENING`), the sink for Essence once a Shadow is Ascendant at
  Lv.40: five stars at 20, 30, 45, 65 and 90 Essence, 250 in all, each growing every attribute by 4%
  more of its creature's own, so growth tops out at +120%. Its card shows the stars and the next one's
  asks where Next rank stood, and the hold takes it; the tile and the Shadows tab light while one can be
  taken. Releasing an awakened Shadow returns half its stars' cost as well. Calibration's hunters are
  Vanguards, so it moves nothing there; the campaign's hunters awaken with whatever Essence their
  promotions leave. By day 112 the evening hunter holds 38 Essence (291 before) and the three-session
  hunter 67 (931), with nearly every Ascendant at four or five stars; S-Rank and Sovereign come on the
  same days as before.
- **Skills.** A newly bound Shadow fights with its creature's first ability. Sworn, it remembers a
  second: the second in its own kit or, for the 58 creatures that have only one, the first ability of
  its kin it lacks (its family's, or its role's for a family that shares one).
- **Its card** is a profile, in the System's violet. The head is its badge inside the ring of its
  next level, with its rank, what it was, its grade, family, role and whether it is deployed, its
  Power, and its XP. Under it: Deploy or Recall and Name; Growth, a graph of a bar for every level,
  rising with what each adds, lit to the level held, open to its cap and dark past a seal there; Next rank, each ask ticked with its own bar and what the rank brings,
  which becomes the gold promotion with Hold To Promote once all is met; Stats, a radar of its
  creature's own, its stats now and at Lv.MAX, beside each number and what its level adds; Skills,
  the second sealed until Sworn; Traits, its passive, immunities and resistances; Record: runs
  deployed, creatures and bosses felled, days served; and Release.
- **The results are alerts.** Every report on a run's results is a System alert, never a window
  set into the screen: each deployed Shadow's level and XP, a lingering Shadow, the Daily Quests, a
  Chosen felled and a level proved. `SysAlert` took a second, smaller line and a meter along its
  foot for them; the meter moves from where it stood once the alert lands, and a level gained fills
  it, lights it and starts it again.
  An alert that only reports goes when it is tapped, or of itself eight seconds after it lands
  (`ALERT_STAYS`); one that opens something (a lingering Shadow, a masterwork) stays until it is used.
- **Skip keeps the log.** At Skip the fight plays out at once between the hunter's turns, as before,
  but its lines are still written, so what happened since the last turn can be read.
- **XP, one word.** The hunter's and a Shadow's are XP everywhere a player reads them, the Guide
  included; EXP and Experience are gone, and the voice test refuses them.
- **Badges.** Every family has a glyph, and a Shadow's badge is its family's glyph with its
  shadow behind it and its rank's insignia under them (`ui/emblems.tsx`).
- **More slots through Secret Quests.** Three make room for one more Shadow each: a first Sworn
  Shadow, ten bound, and a first Ascendant. Slots are the grade's plus the missions' (`shadows.slots`).
- **Orders.** Every Shadow follows the army's standing orders, set on the Shadows screen's Orders
  tile (see Turn-based combat).
- **The Army, one tile and one roster.** The Squad and the Army were two tiles and two sheets; the
  Army's tiles were large, so a big army was hard to take in, and the Squad sheet did the managing.
  They are one now. The Army tile is the screen's centre: the squad's slots, each a badge with its
  grade, name and level, the free ones dashed, and the reserve under them, a glyph each; it calls
  while a slot is free or a Shadow is ready. *Changed after playtest:* it called for a Shadow just
  bound too, so a full squad turned the tile gold with nothing to do; news is the notification's and
  the New mark's now, and gold is only what waits on the hunter. It opens ARMY, a roster after a team sheet's:
  Shadow Essence, the squad's power, Bound and Ready across its head; the squad's slots, a tap from
  each card, a free one showing the reserve; **Auto Deploy** (`shadows.autoDeploy`, the strongest by
  power, as many as the slots hold, spent once they are deployed) and **Recall**; tabs for All,
  Squad, Reserve and Ready; a sort by Power, Level, Rank, Grade or Newest; and a list or a grid. A
  row is the box that deploys it, its badge (marked Ready or New), its name over its grade, family
  and rank (and stars), its level over a bar through its rank's levels, and its power; it opens the
  card. The grid is a card to each, its power over its badge in the ring of its levels. The tab,
  sort and view hold while the app stays open.
- **The squad by hand.** A Shadow is dragged to its place (`ui/drag.ts`): a mouse drags once it
  moves, a finger once it has held still a quarter second, so a swipe still scrolls the sheet. A slot
  dropped on another changes places with it; a reserve Shadow dropped on a slot takes it, and the
  one there goes to the reserve; dropped on a free slot it joins the squad; a deployed Shadow dropped
  on the list leaves it (`shadows.placeAt`). The lifted Shadow fades where it was, the slot under it
  lights, a ghost of its badge follows the pointer, and the sheet scrolls near its edge. Each
  deployed slot has an x in its top right that takes it out.
- **A save from before** (v7 migration) gives every Shadow the rank its kills had earned and the
  level its growth stood at (a Vanguard with 75% growth is Lv.30), with no Essence. Its kills carry
  on, now counting every creature it helps fell.
- **Balance.** Calibration's hunter who keeps up has a full squad of Vanguard Shadows at Lv.30
  (`shadows.raise`), the same +75% the 75 kills gave, so `npm run balance` came out identical and
  `gatetune.ts` stands. The campaign's hunters now fill a slot left free with their strongest Shadow,
  as the Squad tile calls for; without it the squad was whatever lingered first. With that in both,
  the evening hunter reaches S-Rank on day 60 (59 before) and Sovereign on day 114 (117), and the
  three-session hunter day 31 (33) and day 62 (72); they clear 93% and 94% (95% and 93%). The
  evening hunter's squad is mostly Sworn and Vanguard by day 56 and Ascendant by day 112; the
  three-session hunter's is Vanguard by day 28 and mostly Ascendant by day 56. Because the whole
  squad levels together, a squad rises as one, where kills once went to its strongest. Sovereign
  comes sooner mostly through the Daily Quests (0.94 a day, was 0.85; 1.46, was 1.16): the Shadows'
  quest, set at about two runs' worth, took four or five when only the last blow counted. It now
  asks what a Shadow helps fell in two runs at each grade (`SHADOW_KILLS_PER`, measured: about 2.5 a
  Shadow a run, 3 to 4.5 at S). Essence ran short until about day 28 and piled up once every Shadow
  was Ascendant (841 held by day 112 for the three-session hunter), until Awakening gave it a sink.

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

1. **An invested hunter outgrows the calibration.** *Decided: Ascension, below, since moved to S-Rank (see "Opened at S-Rank").* Gates are tuned to 75% for a typical hunter:
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
4. **The climb is quicker than the formula says.** *Settled: the formula is the typical hunter's
   baseline, and the campaign measures real play.* Clears run near 97% rather than the 75% the
   days-to-rank model assumes. One evening a day reaches S-Rank in nine weeks, and three sessions
   reach Sovereign in eleven.
   - **Now:** with Ascension the campaign's hunters clear 82-86%, and `npm run balance` shows the
     days to each rank at 85% beside 75%.
   - **What the clear rate explains:** at three Gates a day with every Daily Quest, the higher rate
     brings S-Rank from day 61 to day 56.
   - **What it does not:** the campaign's three-session hunter, at under two board Gates a day plus
     the Spire, reaches S-Rank on day 48. The rest of the gap is Ascension's pay, 10% more a level,
     and the Spire's runs. The formula counts neither, on purpose: it is what calibration's typical
     hunter gets.
5. **Levels do not stop at 100.** *Settled: they keep paying.* They pay Ability Points until every
   stat is capped, at about Level 150 (sooner with Secret Quests).
   - **The line:** the voice sweep replaced Sovereign's "the System has nothing left to award" with
     "Further ranks: none.", which is true.
   - **Why keep paying:** the 8% growth past Ascension 10 was tuned against the campaign's hunters.
     The three-session hunter is Level 120 on day 120 and still spending points. Ending them at
     Sovereign would change what that tuning measured.
6. **Fatigue holds an S-Rank hunter to about one gate a session**, as intended. The Spire competes
   with the board for that fatigue, which is why the campaign climbs one block a day.

## Ascension — the ladder built

Gladiator Manager's answer to a late game that flattens is Ascension: a ladder of stacking, named
rules, each level opened by proving the one below. ARISE takes the ladder but not the restart. GM
plays each level as a new game, which suits turns a player can rattle through. ARISE is paced by the
clock (fatigue, the daily board, the Spire's weeks), so the ladder runs on the hunter's own climb.

- **Ten levels** (`data/ascension.ts`, `core/ascension.ts`). Every level makes every foe stronger
  (`ASCENSION_TUNE`). From level 2 each adds one rule on top of all the rules below it: Thin Rest,
  Short-Handed, Heavy Legs, Wardens Wake, Crooked Luck, Hungry Dark, Never Alone, Worn Thin and By
  Hand. At the top, Auto will not fight a boss. Each level pays 10% more on a gate than the
  one below.
- **Choosing.** The hunter chooses a level on the Gates screen, anywhere from 0 to the highest opened.
  The card that chooses it shows once Ascension 1 is open; until then, the way in is the Trial
  quest on the Quests screen.
  A run keeps the level it walked in with, and the brief's assessment plays every rule it brings.
  The practice gate is always played at 0.
- **Proving.** A level opens when the one below it is proved: four different gates of the hunter's
  grade cleared at it (GM's league trophies), and then the Trial. S-Rank has only three gates, so
  there it is all three (`proofNeeds`). Only clears at the highest level opened count, and only from
  S-Rank (it was C-Rank; see "Opened at S-Rank"). The proof, the Trial and the way into it are on the
  Quests screen, and on the Ascension sheet.
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
- **No top.** The three-session hunter outgrew Ascension 10 about a month before day 120. GM's
  ladder stops at sixteen levels. ARISE's now goes on, as the Spire does past floor 100.
  - **Past the ten:** the ten levels with a rule of their own (`ASCENSION_RULED`) stay calibrated
    as they were. Every level past them makes every foe 8% stronger than the level below
    (`BEYOND.growth`). It adds no rule and pays 10% more, and every rule below stays in force.
  - **The Trial:** it holds the last twelve Chosen of its gauntlet (`TRIAL.most`), ending with the one
    it sends into the world. Past the twelfth, the Chosen come round again with a numeral ("The
    Gatewatcher II"). Their round makes them no stronger past the twelfth; the level's growth does.
  - **Marks** stop once every mark is full, at Ascension 20. Upgrades past perfect and the Chosen's
    masterworks go on: level 11's Chosen guards the Weapon slot again, eleven steps past perfect.
  - **The screen:** past ten levels open, the level chips become a stepper.
  - **Tuning, with the campaign:** I tried 5% first. At 5% a level's growth is matched by what opening
    it gives the hunter: another step past perfect, a mark, and 10% more pay. The three-session
    hunter climbed from 11 on day 84 to 22 by day 120, three levels in its last eight days. At 8%
    it reaches 11 by day 84, 17 by day 112 and 18 by day 120, still climbing slowly. It clears 82%,
    90% in its last four weeks, and fells 23 Chosen for 15 masterworks. The one-evening hunter
    never passes 10 and plays exactly as before.
- **Opened at S-Rank.** Ascension used to open at C-Rank, halfway up the climb. A player said it made
  everything "feel all over the place": a second ladder, with rules, marks and a Trial, arriving
  while the ranks were still the goal. It now opens at S-Rank (`ASCENSION_FROM`), as what comes after
  the climb.
  - **The cost:** finding #1 comes back between C-Rank and S-Rank. A hunter who keeps up meets
    nothing hard on the board there. The Pale Spire is the challenge that grows with them until
    S-Rank: its floors are built for a hunter of their number.
  - **Saves from before:** a hunter below S-Rank who had opened levels keeps them, their marks and
    their upgrade limit. Every Gate is played at level 0 until S-Rank (`entryLevel`, `choose`), and
    their Chosen do not walk until then (`walking`).
  - **The proof:** S-Rank has three Gates, so a level is proved by all three, then the Trial.
  - **Calibration:** it now tunes the levels and the Trial against S-Rank alone, with more hunters
    a gate, so it plays about as many runs as it did across four grades. The gates and the Spire came
    out identical.
- **The Trial is the System's.** The Association sent its hunters into the Trial, and its brief opened
  with an Association file. Neither fits: the Association does not know the System exists. The Trial
  now has no Association hunter (`alliesAt`) and no file. Its brief is gold and states its terms in
  fields: Chosen, Rest, Withdrawal, Allies. The hunter's Shadows still go in: they are the hunter's
  own. Calibration retuned it (`TRIAL_TUNE` at level 0, 1.21 to 0.99), so a hunter who keeps up
  still wins about half the time.
- **The brief now matches the fight.** Taking the allies out showed an old gap. `raid.begin`
  charged the Gate's fatigue before it built the party, so the hunter fought at the fatigue they
  would leave with. The brief, its projection and calibration all fight at the fatigue the hunter
  walks in with. The gap grew with Ascension: Heavy Legs adds half again to the fatigue a Gate costs,
  and Worn Thin doubles what fatigue takes. The three-session hunter reached the Trial for
  Ascension 16 on day 101 and lost it twenty days running, though the brief gave it an even chance
  each day. `begin` now builds the party first and charges the fatigue after, for the runs to come.
  Calibration never called `begin`, so `gatetune.ts` stands. Real runs now play as calibrated. Before
  this, they played harder than calibrated.
  - **Campaign, against `main`:**

    | | One evening a day | Three sessions a day |
    |---|---|---|
    | Cleared | 96% (was 85%) | 95% (was 82%) |
    | Carried out | 12 (was 34) | 22 (was 58) |
    | S-Rank | day 64 (was 61) | day 34 (was 45) |
    | Sovereign | day 117 (was not reached) | day 64 (was 76) |
    | Ascension opened | 8 (was 9) | 18 (was 18) |
    | Trials won / walked into | 8/8 (was 9/12) | 18/18 (was 18/26) |
    | Last four weeks cleared | 98% (was 88%) | 90% (was 67%) |

    The higher clear rates are the brief and the fight agreeing, and, for the evening hunter, no
    proof runs at even odds before S-Rank. The three-session hunter now climbs faster because it is
    carried out less often and locked out less. `npm run balance` is unchanged: its model never
    entered a Gate.
- **Explained where it is played.** The Ascension tile shows from S-Rank, before Ascension 1 is open.
  Its sheet gives the level entered at, what it does to foe strength and pay, the rules in force,
  the road to the next level (the Gates to prove, then the Trial, and the rule that level adds) and
  the marks. The first time it opens, the interface walks the player through it, a part at a time.
  The help button on the sheet shows the walkthrough again.
- **Next.** Ascension is done unless the campaign says otherwise. The design doc's other open
  findings remain: the days-to-rank formula assumes 75% clears, and levels past 100 keep paying
  points (Sovereign's "nothing left to award" is not quite true).

## Association Quests — built

A player asked for a line of quests to follow from the start: given by Ryn, one at a time, growing
harder, about clearing Gates and felling creatures and bosses, each paid for when reported.

- **The line** (`data/association.ts`, `core/association.ts`). It loops through three kinds of job,
  hunt, clear, hunt, boss, at the hunter's grade when the job is handed over. A hunt asks for 5 of
  one creature, and 2 more every time round, to 24. Early jobs pick from the grade's two Gates with
  the weakest bosses, and every time round one Gate further.
- **Always doable.** A job's Gate is pinned to the board until the job is done, unless it is closed
  for the day (`gates.board`). Creatures count in any Gate, however the run ends; a clear counts only
  its own Gate, cleared. Progress is counted in `raid.finish` and shown on the results as a strip on
  Ryn's channel.
  A Chosen standing in the boss's place is that boss for a boss job: a clear of the job's Gate past it
  does the job, as it fells the Chosen (`walkers.fell`). Without it, a boss job on the Gate the Chosen
  held was shut out for the day, short of walking in below the Chosen's level.
- **Reported, not paid on the tap.** A job done waits on Ryn's card at the top of the Quests screen
  until the hunter reports it (`association.report`). He pays, then hands over the next. A job is
  written to the save when it is handed over, so nothing redraws it.
- **The pay.** Every job pays a quarter of a clear's experience at its grade. About 30% pay nothing
  more. The rest pay a Health, Mana or Fatigue Potion (held, and drunk before one is bought; Health
  Potions the satchel has no room for are paid in shards at their price), a clear's worth of shards
  or two, or a Gate Survey, which shows a Gate's map in its brief before the hunter has been in. Jobs
  6, 16 and 31 widen the satchel by one Health Potion each.
- **Balance.** Calibration's hunters take no jobs, so `gatetune.ts` stands. The campaign's hunters
  take every job and report it at once.

## Gear, overhauled — built

The gear screens were rebuilt in `screens/Gear.tsx`, and gear took two new mechanics.

- **The Inventory** counts what is held, what is New and the designs found, and has two views.
  *Items* is a square to every piece: its rarity's frame, its quality along its foot, and its marks
  (worn, starred, a set's, better than what is worn, `New`). A tab to every kind, a sort (score,
  rarity, newest, quality) and three filters (Better, Set pieces, Starred) narrow it. *Select* picks pieces to recycle together, by tapping or
  by rarity or every duplicate but the best of each design, and a bar counts what they would pay;
  worn, issued and starred pieces cannot be picked. It replaced the separate Recycle sheet.
  *Sets* shows the designs found by rarity and a card to every set: its pieces held, seen or not yet
  found, what two and three pay, and its home Gate.
- **New.** A piece granted is marked New (`s.newItems`) until its card is opened or the bag is left.
  The Inventory tile counts them.
- **The item's card** leads with its art in its rarity's light, its rarity and kind, its tags and its
  score, with what it gains or loses over the worn piece it would replace (`gear.counterpart`, the
  weaker for a ring). Under it: that piece, to tap through to; quality on a bar with the steps to
  perfect and any past it; each stat with its difference; each property with a bar from its design's
  worst to its best; its set as a card; Upgrade; and Equip, the star and Recycle.
- **Fusion** fed a duplicate into a piece: the better roll of the two and three steps toward
  perfect. The Forge replaced it (below): a duplicate is now a roll to keep or recycle.
- **The Equipment sheet** sums what is worn (score, each stat, and the properties and sets as one
  line), shows it on a figure with a slot either side and a line running in to it, the set's hue down
  the edge of a slot whose set is paying, and keeps **three loadouts** (`gear.saveLoadout`,
  `gear.wearLoadout`): what was worn, saved, and worn again in one tap. A piece of a loadout recycled
  is counted missing, and its slot keeps what is worn there.
- **Properties apply as they read.** `rollBonuses` divided every property written as a percentage by
  100, but critical chance and status chance are counted in points, so Critical Chance +9.9% added 0.1
  points. It now divides only for a stat the fight multiplies. `npm run calibrate` was rerun against it:
  37 tunings moved, none by much, and the middle of every grade clears as before (67% at E to 85%
  at B). In the campaign the evening hunter reaches S-Rank on day 59 and Sovereign on day 111, the
  three-session hunter day 31 and day 61, fusing 19 and 27 duplicates on the way.

## The Forge — built

A player asked for gear driven by blueprints and materials, after Warframe's blueprints and
affinity, Diablo's salvage and the Witcher 3's crafting list: recycling gives materials instead of
shards, upgrades take materials, Gates leave materials, blueprints are rare and kept for good, a
blueprint forges its design as often as the materials allow and every piece rolls anew, and a piece
found whole is rare. And a weapon familiarity. Fusion is gone. `core/forge.ts` and `data/forge.ts`.

- **Materials,** four kinds, so a hunter can read a recipe at a glance:
  - **Alloys,** one to each rarity: Iron Scrap, Gatesteel, Mana Silver, Runesteel, Abyssal Iron,
    Sovereign Steel. A Gate leaves its own grade's and some of the grade below, so last grade's alloy
    stays useful as the second line of this grade's recipes.
  - **Parts,** by the family of the creature felled (`FAMILY_PART`): Monster Hide (Beasts, Dragonkin,
    Insectoids and their like) for armour, Monster Bone (the Undead, Orcs, Giantkin) for weapons, Mana
    Cores (Demons, Elementals, Slimes, Constructs) for off-hands and jewellery. Each creature leaves its
    part 15% of the time and every clear one of each, so which Gates a hunter runs decides what comes
    fastest, but no recipe stalls for want of one.
  - **Trophies,** one to the boss of each Gate a set calls home, named for the boss (`Demon Lord
    Trophy`; a boss ruling two home Gates is told apart by grade). Every clear there leaves one, and a
    set's piece is forged with one: the home Gate stays where a set is made.
  - **Ascendant Ember,** half a point a level, rounded up, on every clear entered at Ascension, and
    twice its level from a Chosen felled. A step past perfect takes it, one more for every step
    already past, so Ascension pays for its own upgrades.
- **Recipes** (`forge.recipe`): alloys of the rarity (8 at Common to 24 at Legendary), a few of the
  rarity below (2 to 5), the part (2 to 8) and a clear and a half's shards; a set's piece also takes
  its trophy. A row of the Forge says only whether everything is held; the recipe shows each material
  held over needed, green with enough and red without, after the Witcher's `6/1`.
- **Blueprints** are kept for good (`s.blueprints`). They come from every Gate's first clear (a sure
  one; at a set's home, one of the set's), from 10% of other clears and 3% of gatekeepers, from a set's
  home Gate 30% of the time, from every rank claimed (3 of its grade), from the Pale Spire's week
  (which paid a piece before), from some of Ryn's jobs, and from the Exchange, whose shelf is four
  blueprints a day now. A blueprint left is drawn for the kind of piece the hunter is weakest at, its
  best blueprint the lowest rarity (none at all first), so an empty slot is filled before a full one
  is bettered. Every design of a rarity known, a blueprint comes as 10 of its alloy instead.
- **Forging** (`forge.forge`) pays the recipe and grants a new piece, rolled from its own id, New. The
  recipe sheet turns it over where the Forge button is, by its grade, and lists every piece of the
  design held with its quality and Recycle: forge, compare, send the poor roll back, forge again.
- **Recycling** (`forge.recycle`) gives back 40% of the recipe's alloy and half its part, and half the
  alloy its upgrades took; a masterwork twice that, issued kit 2 Iron Scrap. A reroll costs about half
  a recipe, a few upgrade steps' worth, so a bottom-third roll is worth sending back and a fair one is
  worth raising.
- **Upgrades** (`forge.upgradeCost`) take alloys of the piece's rarity (1 at Common to 4 at Legendary)
  and shards at 45% of the old price; past perfect, 5 alloys, the Ember and its shards.
- **Found whole:** 4% of clears and 10% of caches leave a piece; a cache otherwise leaves alloy of the
  grade below and a part, and an event that found gear finds materials. The Practice Gate still pays
  its ring, with the iron and hide for a first piece. The Chosen's masterworks are as they were.
- **Weapon Familiarity** (`s.familiarity`, by design): every creature the party fells while a weapon is
  carried in is a point toward it, however the run ends. Five ranks, at 40, 120, 260, 480 and 800. Each
  adds attack and magic +2% while the weapon is worn (`forge.familiarityBonus`, through `heroSpec`), and
  lifts every roll of that design forged 8% of the way up its range, so a mastered weapon forges from
  40%. It belongs to the design, so a reforged weapon is known as well as the old, and a new design
  starts at nothing: changing weapons costs something. The results report it as a System alert.
- **Saves.** `SAVE_VERSION` 8: every design a save holds becomes a blueprint known, so nothing worn or
  kept is a design the hunter cannot make again.
- **Tracking a material** (`s.tracked`, `forge.toggleTrack`). A material tapped in a recipe's tiles or
  the Forge's Materials is tagged with the Forge's anvil, and so is every Gate on the board that
  leaves it (`forge.sourcesOf`: its grade's alloy and the grade below's, the parts its creatures'
  families leave, its trophy, and Ember where it is walked into at Ascension); the brief lists the
  tracked materials it leaves. The part every clear leaves is not counted: a part is where its
  families are. Tapped again, the tag goes. A blueprint's Track Missing tracks everything its recipe is
  short of in one tap (`forge.trackMissing`), and the same button then stops tracking them.
- **Secret Quests:** Made, Not Found (forge an item), Second Nature (a weapon at Familiarity 5) and
  Master Smith (forge 50).
- **Balance.** `typicalHunter` carries its weapon at Familiarity 2 and `keptUpHunter` at 5;
  `npm run calibrate` was rerun, and every tuning moved by a few hundredths. The campaign's hunters
  forge every slot from the rarest blueprint known for it, reforge a bottom-third roll once, recycle
  what is not worn, keep the alloy a waiting forge needs, and upgrade only what will stay. Their kit
  keeps up: the three-session hunter wears a full A kit on day 28 and a full S kit on day 56. They
  climb a little slower than when every Gate rained gear (the evening hunter reaches S-Rank on day
  65, the three-session hunter on day 40, against 59 and 31), and clear 93 and 94% of their runs. The
  heavy player runs short of shards at the top of Ascension, the light player of alloy at A-Rank.

## Gate maps, rebuilt — built

A player asked for the maps to be overhauled, after a cave map with chests, locked doors and a start
and a boss, the Gothic and Witcher maps' numbered rooms and secret routes, and a grid dungeon of
pressure plates and hidden doors: move in any direction, back into rooms already cleared, and no
rest always waiting before the boss, but rests found anywhere, rarely, kept until the hunter comes
back to use one, once. `core/map.ts`, `core/raid.ts`, `ui/map.tsx`.

- **A Gate is a dungeon** (`dungeon` in `core/map.ts`): rooms on a plan five cells across, joined by
  corridors, drawn from the Gate and the day as before. The entrance sits at the foot, the boss alone
  at the head, in a row of its own. A road of rooms climbs between them, up or along, never down and
  never across itself, as many rooms as the old map had layers of choices. Side rooms branch off it one
  or two deep (about four in five of the road's count), and a second corridor joins rooms side by side
  30% of the time, where it does not shorten the road. Rooms are numbered from the entrance out, as a
  plan would be, and a fight's head says `Chamber 4`, the room's number. Every room can be reached.
- **What waits in them:** the road is fights, with 30% of its rooms past the first something else,
  never more than two; a side room is a fight, a cache, an event, a shrine, a trap or a rest
  (`ROAD`, `SIDE`). A trap, a cache, a shrine and now a rest show as Unknown until the hunter steps in.
- **Movement:** the hunter enters any room next to one cleared (`raid.options` is that frontier,
  `map.reach`), and walks back to any cleared room for nothing (`raid.moveTo`, `run.pos`). A room
  entered is the step underway, as before, written to the run before it plays.
- **Rests** are rare: about a third of E-Rank Gates hold one and half of S-Rank's, never more than two
  (`RESTS_MAX`), anywhere but the entrance and the boss, and one in seven or fewer beside the boss. A
  rest found is not taken: its panel offers Later and Rest, and the plan offers Rest while the hunter
  stands in it, once (`raid.restHere`, `run.rested`).
- **Withdrawing** is from the entrance, once a room is cleared: the way in is the way out. The share
  is the rooms cleared over the road's length, capped as before.
- **The Gatekeeper and its vault.** A Gate with a gatekeeper holds exactly one, at the end of a
  branch, and its vault, a dead end sealed somewhere far from it by corridor. The seal breaks when the
  Gatekeeper falls (`map.unsealed`; the feed says `Somewhere in the Gate, a seal breaks.`). *Since the
  floors, the vault is behind its Gatekeeper instead; see below.* The vault
  is the richest find on the map: 5-7 alloy of the Gate's own grade and two parts, or a piece found
  whole 20% of the time (`CACHE.vault`, `FORGED.vault`), and a blueprint of the Gate's grade 12% of the
  time unless the run is carried out (`BLUEPRINTS.vault`).
- **A hidden passage** in about half the Gates: a wall between two rooms at least three corridors
  apart, which opens once a room at either end is cleared (`map.passages`), so a cleared branch can
  reach round to rooms the road would have made the hunter fight through.
- **The System's road** is now the fewest rooms from the entrance to the boss, and where two ways are
  as short, the rooms it prefers (`systemRoad`, breadth first from the boss). It never passes the
  Gatekeeper or the vault. Auto walks it (`raid.systemNext`, `raid.systemMove`), keeps a rest it finds
  for the boss and uses it before going in; the projection does the same, so the brief and Auto still
  agree, and calibration tunes to it.
- **The Practice Gate** has a rest on its road, to teach a rest found and kept, and a cache and a shrine
  off it. It is never lost, as before.
- **The arena** draws the plan: corridors with walls and floors under the rooms, cleared rooms ticked,
  the rooms on offer glowing, the boss's room larger and red, a sealed vault locked, a used rest
  greyed, and a `You` marker that slides from room to room. Under it, Rest, Withdraw, or the hint. The
  head counts `Cleared 3/11`. The brief draws the same plan, the System's road dotted along it, with a
  key under it.
- **Towers stay towers.** A block of the Pale Spire and a Trial are climbed floor by floor, as before
  (`layered`, `trialMap`): the Spire keeps its rest before its boss. A run left open from before keeps
  the floors it began on (`run.layout` unset).
- **Secret Quests:** Every Room (clear a Gate with every room in it cleared) and Cartographer (ten of
  them), counted in `stats.charted`. Knew When To Leave now asks only for a withdrawal.
- **The fog of war** (`map.sight`, `raid.seen`), asked for next: every room but the entrance and the
  boss's is in the fog until the hunter clears a room beside it, by corridor or an opened passage. The
  corridors always show, so the plan's shape is known and what waits in it is not. A room seen stays
  seen: what a run saw is remembered on its map (`s.gates.seen`, by map seed) for as long as the map
  stands, so a hunter who withdraws and comes back the same day finds it as they left it. Older maps'
  memories are dropped. The brief draws today's map in its fog, `Unseen` in its key. Auto, the
  projection and calibration walk the System's road, which knows the plan, so the fog changes no odds.
- **The Gate Survey charts the map** (`raid.survey`): every room of a Gate's map, from its brief before
  going in or inside it, once there is a room in the fog. Ryn pays them a little more often (weight 3,
  one or two), a full day of Daily Quests pays one (`CONTRACT_BONUS.survey`), and the Exchange sells them
  for 60 shards under For the Gates.
- **Events have their own mark.** With the fog the `?` belongs to a room not yet seen, so an event room
  is `Event`, a diamond with an exclamation mark. A shrine shows for what it is; a trap, a cache and a
  rest still pass for an Event until stepped in.
- **The Practice Gate** puts its rest in the room before its boss, and its fights hold one or two
  creatures: a first dungeon is made easy, and three hundred seeds of it are all cleared.
- **Floors**, asked for next (`FLOORS`, `floorsOf`): E- and D-Rank Gates stay one floor, drawn exactly
  as before; C and B go down two, A three, S four. Each floor is a plan of its own, drawn from the
  Gate, the day and the floor. Every floor but the last ends in stairs down where the boss would be,
  and every floor below the first starts at stairs up where the entrance would be. Taking stairs down
  the first time reaches the stairs up below at once; stairs taken once are taken again in one tap,
  from either side, so a hunter walks the whole Gate freely and still withdraws from the entrance. The
  plan shows the hunter's floor, `Floor 2/3` over it; the brief has a tab to each floor. The stairs and
  the boss always showed through the fog (the stairs no longer do; see Labyrinths). A deeper Gate's road is longer, at least three rooms to a
  floor (`floorRoad`: a C-Rank Gate's road is 8 rooms, an S-Rank's 12, against 5 and 7 on one floor),
  and its fights share out what the one-floor road paid, in shards and in alloy (`paceOf`). The
  Gatekeeper keeps to a floor of its own drawing. No floor holds more than two rests. A run opened
  before the floors keeps its one floor.
- **A plan starts anywhere**, asked for next (`FloorOpts.vary`): the entrance (or a floor's stairs up)
  stands in any column, with up to two rows of rooms beyond it, so it is as often inside the plan as on
  its edge, and the whole plan is turned to run up (35%), down (25%), left or right (20% each; only a
  plan no more than five rows deep turns sideways, so it stays five cells across at most). The shape is
  drawn from its own seed, so what waits in the rooms is drawn as before.
- **The vault is behind its Gatekeeper**, asked for with it: a dead end off the Gatekeeper's room,
  reached through it and nowhere else, on the same floor. The Gatekeeper's room is the vault's door,
  and the lock on the plan says so until it falls (`The seal on the door behind it breaks.`). It is
  hidden in the fog with the rest until the Gatekeeper's room is cleared.
- **Balance, again.** Recalibrated: the middle of every grade clears 73-82%. The campaign's start date
  moves its result by several days on its own, so it was played from three starts, a week apart, before
  and after: the evening hunter reaches S-Rank on days 67, 57 and 60 against 67, 58 and 60 before; the
  three-session hunter on days 43, 35 and 44 against 33, 35 and 38, carried out a little more often
  (34, 20 and 33 times against 29, 26 and 21). Worth watching; within the spread of one start's own.
- **The plan's room numbers are gone,** and an Event room is an orchid signpost, a choice drawn as one.
- **Balance.** `npm run calibrate` was rerun: the tunings moved by 1% on average, a Gate at most by a
  quarter, as its maps changed shape. With the floors it was rerun again, and the campaign with it: the
  evening hunter reaches S-Rank on day 67 and the three-session hunter on day 33, clearing 95 and 93%. A Gate's odds now swing a little more from day to day, with how
  many of its road's rooms are fights and whether a rest lies on it. In the campaign the evening hunter
  reaches S-Rank on day 67 and the three-session hunter on day 34 (65 and 40 before), clearing 95 and
  94% of their runs.

## Labyrinths — built

A player found the S-Rank floors far too small (some seven rooms) and asked for labyrinths, two or
three times the size at A and S, to the most that fits cleanly, with a minimum for every grade; and for
the Gate Survey to be a mark with its count instead of a wide button. `core/map.ts` (`LABYRINTH`,
`PLAN_MAX`, `floorSizeOf`).

- **What fits.** A plan reads cleanly on a phone at six cells across and eight deep: a room's tile is
  then about 45 pixels, its mark and name still legible (`PLAN_MAX`; a name's size follows its cell,
  by a container query). A floor of 24 rooms fills half of that, room enough for dead ends and loops.
- **Each grade's floor** (`LABYRINTH`): its fewest rooms, the foot and head among them, its road, its
  plan's columns and how deep its branches go.

  | Grade | Floors | Rooms a floor | Road a floor | Columns | Branches |
  |---|---|---|---|---|---|
  | E | 1 | 12 | 4 | 5 | 2 |
  | D | 1 | 14 | 4 | 5 | 3 |
  | C | 2 | 15 | 4 | 5 | 3 |
  | B | 2 | 17 | 5 | 5 | 3 |
  | A | 3 | 20 | 5 | 6 | 4 |
  | S | 4 | 24 | 6 | 6 | 4 |

  An S-Rank Gate is 96 rooms, an A-Rank 60, against 32 and 24 before. The road winds: it runs along
  more often and further, and never climbs past the rows a plan holds. The floor grows rows beyond its
  foot, then deeper branches, until it holds its rooms; every floor drawn holds exactly its minimum.
  Loops are rarer, a labyrinth's side rooms hold rests half as often, and A and S floors can hide two
  passages. The practice Gate keeps its small first dungeon.
- **A run opened before** keeps its map exactly (`layout: 'floors'`, `'rooms'`); new runs are
  `labyrinth`. Every map of the older layouts was checked against a snapshot taken before the change.
- **Pay** still shares a deeper road's fights out of what a one-floor road paid, now counted from the
  map's own road (`paceOf`).
- **The Gate Survey** is a mark, a folded map with the count held in an ember badge, at the plan's top
  right while a room is in the fog, in the arena and the brief; a tap offers it first.
- **The stairs are in the fog** like any other room, asked for next: a floor's way down is found, not
  seen from its foot. Only the corridors, the entrance and the boss's room always show (`map.sight`).
- **A cleared room reads `Cleared`** under a check mark, in place of its own mark and name and the
  tick it wore; a rest, the stairs and the entrance keep their marks, for coming back to.
- **Balance.** Recalibrated: the middle of every grade clears 69-82%. The campaign, from three starts a
  week apart: the evening hunter reaches S-Rank on days 59, 57 and 59 (67, 57 and 60 before), the
  three-session hunter on days 33, 35 and 27 (43, 35 and 44).

## The bag — built

The owner asked for the Gate Survey's mark to become a bag, opening a radial menu of the items a
hunter can use in a Gate, with room to add more later.

- **The bag** (`ItemsMark`, `ui/items.tsx`) sits at the map's top right, in the arena (dungeons and
  towers alike) and on a dungeon's brief, with the count held of everything in it in an ember badge.
  Its glyph is a satchel (`satchel`), not the Inventory tab's `bag`, since it does not open the Inventory.
- **The wheel** opens over everything but the System's windows: six slots round a hub, a slot to each
  kind of item, always the same slot (`bagFor` in `app/flow.ts`), the rest empty and dashed, for what
  comes later. A slot shows its item's glyph and the count held. Tapped, it is picked, and the hub shows
  the item's name, what it does and the count held, then **Use**, or why it cannot be used now (`None
  held`, `HP full`, `Not now`, `Drunk inside a Gate`, `Nothing left to chart`). Picking, then Use, is
  the asking, so the Gate Survey no longer opens the System's `Would you like to use?` first. Close, a
  tap outside the wheel or Escape closes it.
- **The Field Potion is drunk between steps** (`raid.drinkField`, `raid.fieldIdle`; now the Health Potion's, below), from the satchel,
  for the same share of the maximum as on the hunter's turn, never past it, and only while nothing is
  underway and the run is still to be won. It is written to the run's party at once, like a rest.
  Auto, the brief's assessment and calibration never drink one, so nothing they measure changed and no
  recalibration was run.
- **The Gate Survey** moves into the wheel. Used from it, it charts the map as before (`surveyNow`).

## One Health Potion — built

The owner found the Field Potion and the Health Potion redundant, and asked for one potion, in the
bag's wheel, with the Mana Potion beside it.

- **The Field Potion is gone; the Health Potion is the one healing potion.** It keeps the Health
  Potion's numbers: HP +25% (`POTION_HEAL` in `core/combat.ts`, which `shop.POTION_RESTORE` reads) for
  30 shards. In a fight that is 5 points less than the Field Potion's 30%, for 10 shards less than its
  40. It is drunk on the hunter's turn in a fight, between rooms from the bag (`raid.drinkPotion`,
  `raid.drinkIdle`), or out of a Gate from the HP bar, held first, bought if none is.
- **The satchel carries Health Potions** (`stock.hp`): three (`shop.SATCHEL`), and one more for each
  of Ryn's satchel jobs. A purchase or a reward past its room is refused at the Exchange, and paid in
  shards at the potion's price by Ryn (`shop.givePotions`). `s.satchel` is gone.
- **Health and Mana Potions are carried** (`shop.CARRIED`): the Exchange sells them to carry (`shop.buyCarried`),
  with **Buy**; the Fatigue Potion and the Elixir are still drunk on purchase. Mana Potions have no
  satchel and no limit, since a fight never drinks one.
- **The wheel** holds the Health Potion first, the Mana Potion beside it, then the Gate Survey. On a
  Gate's brief, a Health Potion from it restores the hunter's own health, as the HP bar's does.
- **Ryn's field potion reward** is a Health Potion reward in its place in his pay table, so every
  other reward still rolls exactly as it did.
- **Old saves** (`SAVE_VERSION` 9): what the satchel held joins the Health Potions held, as many as
  the satchel carries, and the rest are paid back at 30 shards each. A job that was to pay field potions
  pays Health Potions, and a "Do not ask again" for buying field potions is forgotten.
- **Balance.** Auto, the brief's assessment and calibration never drink a potion, so nothing they
  measure changed: no recalibration ran, and no tuning moved. The campaign was rerun for the new
  prices and Ryn's reward (below).

## Smaller changes from the same playtest

- **Perfect means perfect.** A piece was marked Perfect when its quality alone was at its best, and
  could still take up to ten upgrade steps on its properties. Perfect now means quality and every
  property at their best; a piece with quality alone at its best is marked Perfect quality, and its
  card counts the steps left. Steps past perfect are Ascension's, so they open at S-Rank with it: a
  save that opened levels at C-Rank no longer takes them below S-Rank.
- **Do not ask again.** Every purchase or use the System offers can be told not to ask again, kind
  by kind; Settings lists what it skips and brings them back.
- **A potion held.** Potions can be held now (`stock`), from Ryn's jobs; one held is drunk before one
  is bought, and the potion buttons show how many.
- **Results as alerts.** The Daily Quests a run moved, and a lingering Shadow, are System alerts on
  the results, not windows. The lingering Shadow's alert opens the extraction, on the System's
  sheet; a Shadow bound is offered a name there, and can be named or renamed from its card.
- **Three reaches.** A reach that fails no longer loses the Shadow. It lingers for up to three reaches
  in all (`EXTRACT_TRIES`), each costing twice the MP of the one before: a C-Rank creature is 70 MP,
  then 140, then 280. The last to fail disperses it. `raid.extract` counts the reaches on the
  lingering itself (`tries`, `bound`), so the results' alert and the sheet read the same state, and the
  campaign's hunters reach as long as the mana holds. In the campaign, the evening hunter holds 33
  Shadows by day 112 (was 25) and the three-session hunter 35 (was 34); S-Rank comes on the same day,
  Sovereign on day 110 (was 115) and day 65 (was 64). Calibration does not extract, so it stands.
  The sheet reads rank and name, what lingers, then what failed, the attempts left and the cost; the
  odds moved to the Guide (`shadows.HOLD`), so the sheet holds only what changes from reach to reach.
- **What an action does, in a fight.** Every action on the turn bar has a `?` in its corner that opens
  its details above the bar without using it: its level from the tree, whether it is ready, its full
  line and what each status it inflicts does. On a desktop, resting the pointer on it opens them too.
- **A run is in the Gates' orange** wherever it was entered from. The Spire and the Trial are entered
  from Quests, and the arena took that screen's cyan for its buttons; while a run is played the root
  carries `data-arena`, which sets the accent to the Gates' ember.
- **The Gates board, overhauled.** `GATES` was a grid of large tiles, two to a row, each a portal
  and a name, so ten Gates ran to several screens and said little. It is a roster now, after a
  dungeon list's rows:
  - **Its head:** Open, Never Cleared, Closed Today and the redraw's countdown.
  - **Its rail:** All, a star for the marked Gates (shown while one is), and each grade, each with its
    count. The filter holds while the app stays open.
  - **A band to each grade:** its portal and its name in its colour, what a clear there pays at the
    level the hunter walks in at (XP and Mana Shards, as the brief reads them), and its count, or
    Licence and a lock where the licence stops.
  - **A row to each Gate:** its portal with the boss's mark (or a lock), and a tick on the portal's
    corner once ever cleared (the name was green with a tick, and a board of green names was too
    much green), its name, its boss or `?`, and a line of chips, the counts first so they line up from row to
    row: how many of the creatures known to walk in it already serve as Shadows (the boss counts
    once known), and the set blueprints known of all its home sets' (`1/6`); then what marks it
    (Training, Chosen, Association, Quest, in their own colours, as the tiles' counts had them), its
    first-clear bounty in shards while it has never been cleared, and the anvil of a tracked material. The set pieces once named each set in a chip; a Gate home to two sets carried two
    long chips, so it is one count now, green once every blueprint is known. A row opens the brief.
  - **On the Gates screen**, the Open Gates tile stars each grade's portal that holds a marked Gate.
- **The Quests screen, a log.** Its tiles were uneven, half of them a picture and a name, and what a
  quest paid waited in its window. It is a quest log now, after a journal's list:
  - **Ryn's card** leads the log, on his channel: shaped as its rows now (his face where a row's
    picture stands, the job and its count, his line held to two lines until tapped, a bar, the pay
    as chips), in his blue and corner brackets, never the System's frame. His ring leads the rail, his
    face in it; it reads Report and turns gold once the job is done.
  - **The report.** A job done once put a light-blue bar the width of the card under it, louder
    than anything on the page. Now the row itself is the report: its border and his face gold, the
    job ticked green, his line held to one, and a strip along its foot, `REPORT TO RYN` in gold and
    the pay at its right, breathing, a chevron nudging. A tap anywhere on the row reports.
  - **The rail:** a ring to every quest that stands (Daily, Rank, Trial, Chosen, Weekly, Secret), its
    count under it, filled as far as the quest stands; gold while it waits on the hunter, green once
    done. A ring scrolls to its quest and lights it.
  - **The Daily Quests:** their head and the time to the next, a line to each with its bar, its
    count and what it pays (`payOf`), and the completion bonus (`bonusOf`). The block opens the window.
    Once all are done, the three lines and the bonus told the hunter nothing new and pushed the
    rest of the log down a screen, so the block folds to its head: a green tick, the time to the
    next, and `Complete` where the count stood. A tap still opens the window with every quest.
  - **Advancement:** Reclassification (both plates, the level and the XP to it, Ability and Skill
    Points, a class, Shadow slots or Ascension where the rank brings them), the Trial (the Gates
    proved and the Chosen after them; Ascension, a mark, the upgrade limit) and the Chosen (where it
    walks, and its masterwork or bounty).
  - **Weekly:** the Pale Spire, the floor that raises the week's pay, the next floors, the time to the
    new week, and the tier, the shards and the gear.
  - **Record:** the Secret Quests, the latest done, the sealed, and each tier's count.
  - Each row opens its QUEST INFO window, as the tiles did; nothing here pays. The screen is no longer
    a bento grid: Inventory, Gates and Shadows still are.
- **The Stats radar, to scale.** It said 0 to 100 and drew every axis out to the Ability Point cap, so a
  stat of 182 sat on the rim with 100. It reaches the largest stat now, rounded up to the next 50 and
  never under 100 (`radarScale`), its rings at each quarter with their values beside the STR axis,
  and the line that named the scale is gone. On the Stats sheet the stats without gear are drawn
  under the shape, dashed, and a key names the two, so what the gear adds is the space between them.
- **Hold To Promote is gold,** as advancement is: its border and fill, a slow breath and a light
  crossing it until it is held. Hold To Awaken shares the panel, so it is gold too.
- **Promote All, from the Ready count.** The Army's Ready count is a button while any Shadow is ready:
  gold, breathing, with an arrow. It offers, as the System's Offer, to promote and awaken every one,
  naming each and what it takes and the Essence it all costs; what the Essence cannot pay for is said
  in red and waits. Held, it plays the promotion's cinematic once, on the first promoted, then one
  window for them all (`shadows.claimAll`, `flow.claimAll`): every promotion first, one rank apiece,
  the deployed and the highest level before the rest, then one star apiece for each awakening the
  Essence left pays for.
- **The brief, overhauled,** after a mission planner's sheet. It was a column of large boxes, so the
  boss, the map and the party sat far below what the Gate pays. Now:
  - **A banner:** the Gate's portal in its grade's colour (the Trial's gold), its grade, the
    Association's file, and chips: Cleared or Never cleared, its mark from the board, its Ascension
    level; the Trial's terms (no rest, no withdrawal, no allies) as chips.
  - **The assessment:** the clear rate as a ring in the verdict's colour, beside its lines.
  - **What it pays:** four small cells (Clear, First clear, Materials, Depth), the bounty in green
    while unclaimed. Materials names the Gate's alloy and what else its clear leaves: a blueprint on
    the first, a trophy and its sets' blueprints at a set's home.
  - **Threat:** the boss's card, the Chosen's if one holds the Gate, and a chip to each creature and
    the gatekeeper, after an investigation's other monsters: named once the hunter has been inside,
    as the map is, and violet where one already serves; the head counts the Shadows bound from it,
    as the board's row does.
  - **The map**, then **the party** as cards, two to a row, with their power summed.
  - **Enter The Gate** docked to the foot of the window, lit in the Gates' orange, so it is in reach
    wherever the brief is scrolled.
- **The bag's Select chips** show what they picked: a rarity's chip fills in its colour, with a tick,
  once all its pieces are picked, and a tap while it is unpicks them; Duplicates the same.
- **The issued kit can be recycled** once it is taken off. It was kept for good, but a hunter at
  A-Rank has no use for a recruit's shirt. Starred and worn pieces still cannot go.
- **The Stats sheet's `?`** sits in the same corner of every box, and the box itself is what is
  tapped; its line no longer opens on hover.
- **A duplicate's extraction** reads as an offer: the Shadow lingers, the sheet says one like it
  already serves and asks whether to extract its Shadow Essence instead, and shows the Essence it
  would give. A reach for one already in the army costs half the MP (`ECHO_COST`); the sheet shows
  only the number. In the campaign, S-Rank comes on the same days, 59 and 31, and Sovereign on day 112
  and day 63 (was 62); by day 112 the hunters hold 67 and 45 Essence (38 and 67).
- **The promotion's cinematic** held its new plate for barely a beat before the window covered it.
  The window now opens at 7.6 seconds (`RANK_T.open`), so the plate lands, is held and seen, and then
  rises out of the way.
- **The run strip** on the map is three cells (Allies, Banked, Items found) and a blessing is a
  System chip with its mark, its name and what it gives.

## What stays out

- Anything that needs the player to exercise. That is the fitness app's job.
- Energy, stamina timers, or anything else that sells time.
- Gacha: equipment and Shadows come from Gates, the Exchange and extraction, at stated odds.
- A server. The game stays on the device and works offline.
