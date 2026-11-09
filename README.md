# Arise: Dungeon RPG

A dungeon RPG for the phone. You Awaken at E-Rank, the lowest grade the Hunter Association issues,
and are told it will never go up. Then the System offers you the qualifications to be a
**Player**, and the Gates start paying you for what you kill.

Clear Gates to level. Spend the points. Bind what you fell into a Shadow army.

> Inspired by the tone of *Solo Leveling*-style progression fiction. The world, characters, ranks
> and bestiary are original.

This is version 7: the v6 fitness RPG with every real-world workout stripped out, so the game can
go all in on the RPG side. The fitness version is frozen on the
[`fitness-baseline`](../../tree/fitness-baseline) branch. Where the game goes next is in
[docs/DESIGN.md](docs/DESIGN.md).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Everything runs on the device. There is no server, no account and no network: the save lives in
`localStorage`, and the build is a PWA that works offline once loaded.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Typecheck, unit tests, production build — run this before every commit |
| `npm run smoke` | Plays a new hunter from the splash through the Practice Gate and a first real Gate in Chromium (needs a build) |
| `npm run screens` | Screenshots every screen from a seeded veteran save into `e2e/out/screens/` |
| `npm run balance` | Clear rates per Gate grade and days-to-rank, from the real engine |
| `npm run calibrate` | Re-tunes every Gate's difficulty by simulation and rewrites `src/data/gatetune.ts` |
| `npm run mapstats` | What the map generator draws: the plans' shape, what the road and the side rooms hold, and what a side fight costs a typical hunter, for every Gate of each grade over a run of days |
| `npm run tunediff` | Every tuning in `src/data/gatetune.ts` that moved, old → new: the working tree against the last commit, or `-- <from> <to>` between two commits |
| `npm run campaign` | Plays two hunters from Level 1 for 120 days through the real engine, reading the brief and climbing Ascension, and reports the climb, the economy, contracts and the Spire |
| `npm run android` | Generates the Android project in `android/` (see [Android](#android)) |

## The loop

| Layer | What it is |
|---|---|
| **The Practice Gate** | Valcorde walks every new licence through it once. Clearing it lands you on Level 5 with Ability Points to spend |
| **Gates** | Ten stand open at a time, one of every grade and at least two at yours. Clear one and another of its grade opens in its place; the board redraws at midnight. The board lists them by grade, with what a clear pays, and marks each Gate's boss, its first-clear bounty, the Daily Quests, Ryn's job and the Chosen on it, how many of the set blueprints its clears leave you already know, and how many of its creatures already serve you as Shadows. You go in with hunters the Association sends and your Shadows. The brief simulates the System's road through today's map 24 times: the honest clear rate. It shows the map itself only once you have been inside that Gate; until then the map is unidentified, like its boss |
| **The map** | A Gate is a dungeon: rooms joined by corridors, drawn on a plan that can run up, down, left or right, the entrance anywhere on it and the boss at its far end. Deeper Gates have floors (C and B 2, A 3, S 4), each its own labyrinth, bigger with the grade (at least 12 rooms a floor at E, 20 at A, 24 at S, on a plan up to six cells across and eight deep): stairs down in place of the boss on every floor but the last, stairs up in place of the entrance on every floor below the first. You enter any room next to one you have cleared, and walk back through cleared rooms whenever you like. Every room, the stairs among them, is in the fog until you clear a room beside it, and a fight seen shows a pip for each creature waiting in it, red for a strong one; corridors, the entrance and the boss's room always show, a room seen stays seen on that map, and a room cleared reads Cleared. Rooms hold fights, shrines and Events, marked with an orchid signpost: one of fourteen events with stated odds (some read off a stat, some giving or draining mana or fatigue), or a trap, a cache or a rest passing for one until you step in. Rests are rare and can be anywhere; one you find keeps until you come back to use it, once. A Gatekeeper waits off the road with the Gate's vault behind it, a richer cache reached only through the Gatekeeper's room, and some Gates hide a passage that opens once you clear a room beside it. The bag at the map's corner opens a wheel of what you carry, a slot to each item: tap one to see what it does, then Use. A Health or Mana Potion from it is drunk between rooms; a Gate Survey charts the whole map, from the brief or inside the Gate; Ryn pays them, a full day of Daily Quests pays one, and the Exchange sells them. What you find is banked and paid when you walk out; carried out, you lose it. You withdraw from the entrance |
| **Fighting** | Turn by turn, in order of initiative. Every foe shows its next move and who it goes at, and on your turn where its move comes in the foes' order and the damage one hit of it would do. On your turn: aim at a foe, then one of the skills you took in, Strike, Guard or a Health Potion. Your Shadows follow the standing orders you set on the Shadows screen, and so do your own turns on Auto; the Association's hunters pick their own targets. Auto lets the System fight your turns. Every order is saved before it plays, so leaving mid-fight brings you back to the same turn |
| **The Pale Spire** | The one Gate that never closed, a Weekly Quest on the Quests screen. It is climbed five floors at a time (three of choices, a rest, a boss), each block costing and paying like a Gate of its grade; a block taken offers Climb On, straight into the next five floors. Floor N is built for Level N up to Floor 100, and it keeps getting harder above that. Your best floor this week is kept; on Monday the week pays by the grade of your highest floor, the floors rearrange, and everyone climbs again |
| **Ascension** | What comes after the climb: it opens at S-Rank, for a hunter the board no longer troubles, and is a ladder with no top. The first ten levels each make every foe stronger and add a rule of their own on top of the ones below, from thinner rests to bosses you must fight by hand; past them every level is stronger again. Each pays more. A level opens when you prove the one below it and win its Trial, the System's own: a run of named Chosen bosses with no rest between them, which no Association hunter walks into with you. Every level opened earns a mark, a lasting bonus you choose, lets your gear be upgraded a step past perfect, and sends its Trial's last Chosen out into the Gates, where it holds a Gate a day and leaves a masterwork the first time it falls. You choose the level before every Gate, on the Ascension tile, which walks you through itself the first time and shows what the next level asks |
| **Daily Quests** | The System issues three a day for your grade: clear so many Gates, fell so many of one family, beat a gatekeeper, walk off the marked road, clear one on tired legs. Each pays a clear's shards and a tenth of its XP, all three pay a bonus, and one left undone lapses at midnight for nothing |
| **XP** | Every Gate pays by its grade, double on the first clear. Withdrawing pays a share of how far you got; being carried out pays a little and locks you out for twelve hours |
| **Fatigue** | Each Gate adds fatigue, and fatigue drags every stat down until it fades, about five each hour. It is the only limit on how much you raid |
| **Levels and ranks** | One ladder: E → D (Level 10) → C (20) → B (35) → A (50) → S (70) → Sovereign (100). A level only qualifies you for a rank: you claim it from its Reclassification quest, and the rank-up plays. Three Ability Points per level, five per rank, spent by you |
| **Classes** | From D-Rank the System assigns a class from your highest stat (25 classes in five lines). A class adds flat points to that stat |
| **The skill tree** | Every level pays a Skill Point and every rank claimed pays two more. You spend them on a tree of five Paths, one for each stat, drawn as a constellation around the hunter: Ruin, Bastion, Tempest, Arcana and Sight. Each Path holds six skills that level up to Lv.MAX and one that does no damage (a curse that never misses, a taunt that turns every foe on you, a heal or a veil for the party), stats that take several points, notable passives and two forks where learning one passive seals the other. A tier opens at its rank once its Path holds enough points, so you choose between going deep and spreading wide; not even a Sovereign can learn it all. You take as many skills into a fight as your rank has slots, 2 at D-Rank and 5 at Sovereign. The first reset is free |
| **Shadows** | Felled creatures can linger after a clear. Reach for one with mana (the odds rise with INT) and it joins your army. A reach that fails can be made again, three in all, each costing twice the mana of the last. A Shadow levels on every creature it helps fell, as far as its rank allows: Bound to Lv.10, Sworn to Lv.20, Vanguard to Lv.30 and Ascendant to Lv.40, and takes no more XP at the cap. You promote it from its card with Shadow Essence, which lifts the cap, and from Vanguard it must have helped fell bosses; a Sworn Shadow remembers a second ability. A creature you already have gives Shadow Essence when you extract it again, and a Shadow you release gives some back. An Ascendant at Lv.40 can be awakened with Essence, five stars in all, each making it stronger. Its card shows its level and its growth, its stats against its creature's, its skills and traits, and its record. Each wears a badge of its own: its family's glyph, its shadow, and its rank's insignia, and you may give it a name when it joins you or later from its card. The Army tile shows the squad's slots over the reserve and opens the roster: every Shadow in a row, with its grade, rank, level and power, sorted and filtered as you like or laid out as a grid, and a tap to put it in or take it out. Drag a Shadow onto a slot to place it there, swap two slots by dragging one onto the other, or take one out with the x on its slot; Auto Deploy fills the squad with your strongest. Every Shadow follows the standing orders set on the Orders tile. Secret Quests make room for more Shadows |
| **Equipment** | Ten slots, six rarities, 538 designs. Every piece rolls its own quality and properties, and the properties apply in combat. Sixteen three-piece sets pay a bonus for two pieces worn and another for all three. Anything you hold can be upgraded, a step at a time, to perfect, for alloys and shards; past perfect it also takes Ascendant Ember. The Equipment sheet shows what you wear on a figure, what it all adds, and three loadouts to save and wear again in one tap. The Inventory sorts and filters what you hold, marks what is new, picks items to recycle together for their materials, and has a Sets view of every set and design you have found. Each item's card compares it with what it would replace and shows where each property rolled |
| **The Forge** | Gear is forged, not found. Gates leave materials: an alloy for each rarity, from Iron Scrap to Sovereign Steel; the hide, bone and mana cores their creatures leave by family; a trophy from the boss of each Gate a set calls home; and Ember from runs at Ascension. Blueprints are rare: every Gate's first clear leaves one, other clears and gatekeepers now and then, a set's home Gate its own, and each rank you claim pays three, always for the kind of piece you are weakest at. Ryn, the Pale Spire's week and the Exchange pay some too. A blueprint is yours for good: forge its design as often as you have the materials, and every piece rolls anew, so a poor roll goes back to the Forge for materials and you try again. A piece found whole is rare, and the Chosen's masterworks rarer. The weapon you carry grows familiar with every creature your party fells: five ranks, each adding attack and magic while you wear it and lifting every roll when you forge that design |
| **The Exchange** | Four blueprints a day plus potions, paid for in Mana Shards. Health and Mana Potions are bought to carry, Health Potions in a satchel of three: a Health Potion is drunk on your turn in a fight, between rooms or out of a Gate. The other potions are drunk when bought |
| **Secret Quests** | 52 unpublished quests that pay stats, Ability Points or Shadow slots, in four tiers from Citation to Testament. Nothing says one exists until you have done it |
| **Quests** | Ryn Valcorde's Association Quests at the top: one job at a time for the Association, to fell a number of one creature, clear a Gate or fell its boss, on a Gate he pins to your board. Report to him when it is done; he pays a little XP and, most of the time, a potion, shards, alloy, now and then a blueprint, a Gate Survey that charts a Gate's whole map, or room in your satchel, and hands over the next, a little harder. Below him, a log, one row to every quest: the day's Daily Quests, your next rank and what it brings, the Pale Spire's week, the proof of your next Ascension level and its Trial, the Chosen walking today, and every Secret Quest you have done. Each row shows where its quest stands and opens its full window; once the day's three are done, theirs folds to one line that reads Complete. The Trial is entered from here. The tab counts the day's Daily Quests until you open it, the Trial while today's attempt is unused, and a rank waiting to be claimed. The board marks each Gate a Daily Quest names |
| **Story** | 19 beats gated on level and deeds, ending at the Hollow Throne |

## Layout

```
src/
  core/         the game, with no DOM: pure functions over the save, unit tested
    types.ts      every data and save shape
    save.ts       defaults and migrations
    progression   levels, ranks, Gate experience, stats, classes
    combat        units, abilities, statuses, and the fight: it pauses on the hunter's turn
    raid          the run through the map, rooms entered and walked back to, rests, chambers fought turn by turn, orders, rewards, extraction, the projection
    map           a Gate's map: drawing its rooms or a tower's floors, where you can step, the System's road
    gates         the board and the hunters sent with you
    contracts     the Daily Quests, three a day: drawing them, counting a run against them, paying them
    quests        what the next rank brings, for the Quests screen
    spire         the Pale Spire: its floors and blocks, the climb, and the week that pays for it
    ascension     the ladder of harder rules: each level's rule, choosing a level, and proving the next
    forge         materials, blueprints, forging, recycling, upgrades, and weapon Familiarity
    gear, shop, vitals, shadows, missions, story, licence
  data/         content: enemies, abilities, dungeons, map steps and events, contracts, the Spire, equipment and its sets, the Forge's numbers, classes, story text
  app/          the shell: routing, the top bar and nav, and flow.ts, which narrates results
  screens/      one file per screen or major sheet
  ui/           overlays (System windows, sheets, tours, toasts), the System's frame, the bento grid every screen is laid out on, components, icons, and the Arrival: the cut between the office and the System's first window
  audio/        every sound and the music, synthesised in WebAudio — no audio files
  platform/     the Android bridge: Play billing and the rested notification (inert on the web)
  styles/       theme tokens, components, screens
scripts/        balance, calibration and campaign tools, the fixture generator, the Android generator
tests/          Vitest unit tests for the engine
e2e/            Playwright smoke test and screen tour
docs/           the design doc: where the game goes next
```

The rule that keeps it maintainable: **the engine changes the save, the UI only shows it.** A screen
calls an engine function inside `store.update`, then `app/flow.ts` decides which windows to show
about what happened. Nothing in `src/core/` touches the DOM, so all of it can be tested and
simulated headlessly.

## Balance

Combat difficulty is measured, not guessed. `npm run calibrate` runs every Gate against typical
hunters from the middle of its grade, down the System's road on twelve different days' maps, and
sets a per-Gate multiplier so they clear about 75% of the time. Then it tunes the Pale Spire the same
way: each Gate's creatures as a block of five floors, then every block up to Floor 100 for a hunter
of the level of its middle floor. Run it after any change to combat, enemies, classes, the skill
tree, gear, the party or the map. Its typical hunters spend their Skill Points as Auto Assign does. Its hunters are seeded, so two runs give the same answer. It ends by listing every tuning
it moved, old → new, harder or easier, and which stayed put. `npm run balance`
prints the result:

```
grade  floor  middle  top   | middle vs one grade up
  E     64%    80%    88%  |   8%
  D     54%    69%    85%  |   4%
  C     63%    82%    94%  |   3%
  B     65%    80%    85%  |   7%
  A     73%    78%    88%  |   1%
  S     57%    79%    94%  |   —

The Spire: a hunter on the block holding the floor of their own level (floor / middle / top of each grade).
  E   L3 48%      L6 81%      L9 90%
  D   L10 100%    L15 100%    L19 100%
  C   L20 91%     L27 56%     L34 69%
  B   L35 79%     L42 86%     L49 80%
  A   L50 100%    L60 96%     L69 71%
  S   L70 97%     L85 86%     L100 93%
  Level 100, above Floor 100:  F101 76%  F111 75%  F121 53%  F131 44%  F151 28%

Days to each rank (N Gates a day at your own grade, 75% cleared, first clears counted):
   3 Gates/day    D:2d  C:8d  B:19d  A:38d  S:73d  N:135d
  + Daily Quests  D:2d  C:7d  B:16d  A:32d  S:61d  N:112d
   6 Gates/day    D:1d  C:4d  B:10d  A:19d  S:37d  N:68d
  + Daily Quests  D:1d  C:4d  B:9d  A:18d  S:34d  N:62d
  10 Gates/day    D:1d  C:3d  B:6d  A:12d  S:22d  N:41d
  + Daily Quests  D:1d  C:3d  B:6d  A:11d  S:21d  N:39d
```

A single day's odds move a lot with its map and the allies the Association sends, on a Gate and on
the Spire alike; that is what the brief's assessment is for. The figures above average over days.

A hunter at the bottom of a grade clears its Gates about half to three quarters of the time, and one at the top
four times in five or better, because every level pays a Skill Point as well as Ability Points. Reaching a grade above your own is possible, and costly. Sovereign takes about two
months at six Gates a day. Each `+ contracts` line also finishes every Daily Quest every day, which
is worth most to the hunter who raids least. The economy model assumes you raid at your own grade;
fatigue makes ten a day at S-Rank a hard thing to keep up.

## Saves

The save is one JSON document under `localStorage['arise-rpg:save']`, a different key from the
fitness app's `arise:save`, so the two never read each other's saves. Fields with sensible defaults
need no migration: loading merges the saved document over `defaults()`. When existing data must
change shape, bump `SAVE_VERSION` in `src/core/save.ts` and add a step to `MIGRATIONS`.

## Android

The Android app is a [Capacitor](https://capacitorjs.com) shell around the web build, with the app
id `com.ariserpg.app` so it installs beside the fitness app rather than over it. `android/` is
generated, never committed:

```bash
npm run android                  # android/ ready for Android Studio
node scripts/android.mjs --apk   # ...and a debug APK for sideloading (needs the Android SDK)
```

The **Android** workflow (run it by hand from the Actions tab) builds a debug APK and a release AAB,
signed when the `ARISE_KEYSTORE_BASE64`, `ARISE_KEYSTORE_PASSWORD`, `ARISE_KEY_ALIAS` and
`ARISE_KEY_PASSWORD` secrets are set.

On Android, Play billing sells one thing that matters: the **Association Licence**, a one-time
purchase. Without it, the Gate board and the Exchange stop at D-Rank. Everything else (levels,
classes, Shadows) is unaffected. Shard packs are also sold. On the web there is no store and the
game is fully open, and so is the debug APK, which is built with billing off because a sideloaded
app has no Play listing to buy from. Product ids `licence`, `shards_small` and `shards_large` live
in `src/platform/native.ts`. The same file schedules the one local notification: when your fatigue
has faded, or the lockout after a wipe has lifted.

## What changed from v6

v6 was a fitness RPG: levels came only from real training and the exercise Daily Quest, and the Gates paid
gear and shards but never experience. v7 removes the real-world half entirely:

- **Gone:** the exercise Daily Quest, penalties and Hollow, Resonance, the Boon, Valcorde's interview and
  programmes, training sessions, custom programmes, lift records, and the exercise library:
  about 3,400 lines, nearly 30% of `src/`.
- **Gates pay experience.** By grade, double on a first clear, a share on a withdrawal or a wipe.
  It is settled in `raid.finish` with everything else the run pays.
- **No daily cap.** A cleared Gate is replaced by another of its grade. Fatigue paces you.
- **The Practice Gate is the tutorial.** It replaces Basic Hunter Training and lands you on Level 5.
- **The kit comes with the licence**, at the Association desk.
- **Secret Quests and story beats** that read streaks, reps or sessions now read Gates, kills,
  bosses and runs without a wipe. The Hollow Monarch is made of hunters who stopped climbing.
- **One notification:** you are rested, or fit to raid again. The exercise Daily Quest reminders are gone.
- **A fresh save key and app id**, so this and the fitness app can live on one phone.
