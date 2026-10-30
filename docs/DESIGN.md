# ARISE — design

Where the game is going after v7. README.md describes the game as it stands; this describes what
gets built next, in order, and why. Each numbered feature is its own pull request, ending with
`npm run calibrate` and `npm run balance`.

## What it is

A Solo-Leveling-inspired dungeon diver. You are an E-Rank who should never have mattered, and the
System has picked you anyway. The game is the climb: deeper Gates, sharper choices, a growing
Shadow army, and a fixed world that slowly takes you seriously.

The world, characters, ranks and bestiary are original and stay that way. Borrow the tone, never
the specifics: no named characters, places, monarchs or story beats from the source material.

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
fourteen against a boss, so turns matter. But class skills unlock at D, B and S, and the first one
has no cooldown: from E to C-Rank a turn is Strike, one skill, Guard or a potion. That is thin for
the first thirty-five levels, and it is the first thing step 5 should fix. **Foe intents** (showing
what each foe will do next, so Guard and target choices are read rather than guessed) would deepen
every turn at every rank; they change how foes choose, so they need a recalibration.

### 2. Dungeon maps

A gate stops being a straight line of chambers. It becomes a short branching map, generated from
its seed: three to five columns of nodes, paths between them, the boss at the end.

- **Node types:** fight, elite, rest (heal, and the only place you can withdraw), shrine (a
  choice: a stat blessing for this run, or shards), treasure, trap (a PER check), and event
  (a short System window with two choices and stated odds).
- **Engine.** `raid.plan()` becomes `raid.map()`. `OpenRaid` gains the path taken. The node kinds
  and their odds live in `data/`; their effects resolve in `core/raid.ts`, never in a screen.
- **The projection** walks the map with a simple policy (the safest path to the boss) and reports
  that path's clear rate.
- **The arena screen** gains a map view between chambers; Press On / Withdraw becomes picking the
  next node.

### 3. System contracts

The System issues three contracts a day, replacing what the Daily Quest used to be: *Clear two
C-Rank gates*, *Fell thirty Undead*, *Bind a Shadow*, *Clear a gate at over 60 fatigue*.

- Drawn at midnight from a table in `data/`, weighted to the hunter's grade. They pay shards and a
  small amount of experience, all three together pay a bonus, and none of them ever expires into a
  penalty.
- Progress is counted, and contracts are paid, inside `raid.finish`.

### 4. The endless climb

A permanent tower beside the board, named and designed for this world. Each floor is one chamber;
every fifth floor is a boss; difficulty keeps scaling past S-Rank.

- Floors cost fatigue in blocks of five, so the climb respects the same pacing as the board.
- Your best floor is kept, and each new best pays once. A weekly season resets the best floor
  and pays by tier, all on the device: there is no server and no leaderboard.
- It reuses the map nodes from step 2 between boss floors.

### 5. Depth for the hunter

- **Skills sooner:** a second class skill by C-Rank and a third by A, so the early turns have real
  choices. Today the first skill arrives at D, the second at B and the third at S.
- **Skill choices at rank-up:** each class rung offers two skills and you keep one, instead of
  receiving the whole line. The choice is permanent until the next rank.
- **Foe intents:** each foe shows what it will do on its next turn.
- **Gear sets:** sixteen sets already exist in `data/equipment.ts` (`set` on a design), and none of
  them does anything yet. Two and four pieces of a set grant bonuses, defined as data.
- **Upgrading:** spend shards to raise an item's quality within its design's range, with the
  price shown up front. Recycling stays the way to turn spares into shards.

### 6. Depth for the Shadows

- **Shadow ranks:** a Shadow that lands enough kills is promoted, which raises its cap and unlocks
  a second ability from its creature's kit.
- **More slots** through Secret Missions, not only through grade.
- **Standing orders** from step 1 set per Shadow, not only for the whole party.

## What stays out

- Anything that needs the player to exercise. That is the fitness app's job.
- Energy, stamina timers, or anything else that sells time.
- Gacha: equipment and Shadows come from Gates, the Exchange and extraction, at stated odds.
- A server. The game stays on the device and works offline.
