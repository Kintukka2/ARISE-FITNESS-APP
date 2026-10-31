# ARISE — The System

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
| `npm run smoke` | Plays a new hunter from the splash through the practice gate and a first real gate in Chromium (needs a build) |
| `npm run screens` | Screenshots every screen from a seeded veteran save into `e2e/out/screens/` |
| `npm run balance` | Clear rates per gate grade and days-to-rank, from the real engine |
| `npm run calibrate` | Re-tunes every gate's difficulty by simulation and rewrites `src/data/gatetune.ts` |
| `npm run campaign` | Plays two hunters from Level 1 for 120 days through the real engine and reports the climb, the economy, contracts and the Spire |
| `npm run android` | Generates the Android project in `android/` (see [Android](#android)) |

## The loop

| Layer | What it is |
|---|---|
| **The practice gate** | Valcorde walks every new licence through it once. Clearing it lands you on Level 5 with points to spend |
| **Gates** | Ten stand open at a time, one of every grade and at least two at yours. Clear one and another of its grade opens in its place; the board redraws at midnight. You go in with hunters the Association sends and your Shadows. The brief shows today's map and simulates the System's road through it 24 times: the honest clear rate |
| **The map** | A few layers of steps, a rest, then the boss. You pick each step: fights, gatekeepers, rests, caches, shrines, traps and events with stated odds. What you find is banked and paid when you walk out; carried out, you lose it. Only a rest lets you withdraw |
| **Fighting** | Turn by turn, in order of initiative. Every foe shows its next move and who it goes at. On your turn: aim at a foe, then a class skill, Strike, Guard or a field potion. Allies and Shadows follow the standing orders you set in the brief. Auto lets the System fight your turns. Every order is saved before it plays, so leaving mid-fight brings you back to the same turn |
| **The Pale Spire** | The one Gate that never closed, beside the board. It is climbed five floors at a time (three of choices, a rest, a boss), each block costing and paying like a gate of its grade. Floor N is built for Level N up to Floor 100, and it keeps getting harder above that. Your best floor this week is kept; on Monday the week pays by the grade of your highest floor, the floors rearrange, and everyone climbs again |
| **Contracts** | The System issues three a day for your grade: clear so many gates, fell so many of one family, beat a gatekeeper, walk off the marked road, clear one on tired legs. Each pays a clear's shards and a tenth of its experience, all three pay a bonus, and one left undone lapses at midnight for nothing |
| **Experience** | Every gate pays by its grade, double on the first clear. Withdrawing pays a share of how far you got; being carried out pays a little and locks you out for twelve hours |
| **Fatigue** | Each gate adds fatigue, and fatigue drags every attribute down until it fades, about five an hour. It is the only limit on how much you raid |
| **Levels and ranks** | One ladder: E → D (Level 10) → C (20) → B (35) → A (50) → S (70) → Sovereign (100). Three points per level, five per rank, spent by you |
| **Classes** | From D-Rank you are named after your highest attribute (25 classes in five lines). A class adds flat points to that attribute and gives you combat skills: at D, C and A, with passives at B and S. Each of those ranks offers two and you keep one, until your next rank lets you choose again |
| **Shadows** | Felled creatures can linger after a clear. Reach for one with mana (the odds rise with INT) and it joins your army, growing with every kill. Kills promote it, from Bound through Sworn and Vanguard to Ascendant, lifting how far it can grow; a Sworn Shadow remembers a second ability. Each can follow the party's standing orders or its own, and Secret Missions make room for more of them |
| **Equipment** | Ten slots, six rarities, 538 designs. Every piece rolls its own quality and properties, and the properties apply in combat. Sixteen three-piece sets pay a bonus for two pieces worn and another for all three, and each has a home gate whose clears leave a piece you do not have yet. Anything you hold can be upgraded with shards, a step at a time, to perfect |
| **The Exchange** | Eight pieces a day plus potions, paid for in Mana Shards. Field potions go in a satchel of three for your turn in a fight |
| **Secret Missions** | 49 unpublished citations that pay attributes. Nothing says one exists until you have done it |
| **Story** | 18 beats gated on level and deeds, ending at the Hollow Throne |

## Layout

```
src/
  core/         the game, with no DOM: pure functions over the save, unit tested
    types.ts      every data and save shape
    save.ts       defaults and migrations
    progression   levels, ranks, gate experience, attributes, classes
    combat        units, abilities, statuses, and the fight: it pauses on the hunter's turn
    raid          the run down the map, chambers fought turn by turn, orders, rewards, extraction, the projection
    map           a gate's map: drawing it, where you can step, the System's road
    gates         the board and the hunters sent with you
    contracts     the System's three a day: drawing them, counting a run against them, paying them
    spire         the Pale Spire: its floors and blocks, the climb, and the week that pays for it
    gear, shop, vitals, shadows, missions, story, licence
  data/         content: enemies, abilities, dungeons, map steps and events, contracts, the Spire, equipment and its sets, classes, story text
  app/          the shell: routing, the top bar and nav, and flow.ts, which narrates results
  screens/      one file per screen or major sheet
  ui/           overlays (System windows, sheets, tours, toasts), components, icons
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

Combat difficulty is measured, not guessed. `npm run calibrate` runs every gate against typical
hunters from the middle of its grade, down the System's road on twelve different days' maps, and
sets a per-gate multiplier so they clear about 75% of the time. Then it tunes the Pale Spire the same
way: each gate's creatures as a block of five floors, then every block up to Floor 100 for a hunter
of the level of its middle floor. Run it after any change to combat, enemies, classes, gear, the
party or the map. Its hunters are seeded, so two runs give the same answer. `npm run balance`
prints the result:

```
grade  floor  middle  top   | middle vs one grade up
  E     59%    67%    78%  |   9%
  D     62%    65%    72%  |   10%
  C     74%    84%    88%  |   11%
  B     78%    82%    90%  |   8%
  A     64%    73%    81%  |   13%
  S     41%    62%    85%  |   —

The Spire: a hunter on the block holding the floor of their own level (floor / middle / top of each grade).
  E   L3 47%      L6 78%      L9 89%
  D   L10 100%    L15 92%     L19 100%
  C   L20 97%     L27 61%     L34 59%
  B   L35 74%     L42 91%     L49 93%
  A   L50 99%     L60 88%     L69 64%
  S   L70 92%     L85 44%     L100 79%
  Level 100, above Floor 100:  F101 52%  F111 47%  F121 51%  F131 51%  F151 9%

Days to each rank (N gates a day at your own grade, 75% cleared, first clears counted):
   3 gates/day  D:2d  C:8d  B:19d  A:38d  S:73d  N:135d
   + contracts  D:2d  C:7d  B:16d  A:32d  S:61d  N:112d
   6 gates/day  D:1d  C:4d  B:10d  A:19d  S:37d  N:68d
   + contracts  D:1d  C:4d  B:9d  A:18d  S:34d  N:62d
  10 gates/day  D:1d  C:3d  B:6d  A:12d  S:22d  N:41d
   + contracts  D:1d  C:3d  B:6d  A:11d  S:21d  N:39d
```

A single day's odds move a lot with its map and the allies the Association sends, on a gate and on
the Spire alike; that is what the brief's assessment is for. The figures above average over days.

A hunter at the bottom of a grade clears its gates about half to two thirds of the time, and one at the top
about four times in five. Reaching a grade above your own is possible, and costly. Sovereign takes about two
months at six gates a day. Each `+ contracts` line also finishes every System contract every day, which
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
purchase. Without it, the Gate board and the Exchange stop at D-Rank. Everything else — levels,
classes, Shadows — is unaffected. Shard packs are also sold. On the web there is no store and the
game is fully open, and so is the debug APK, which is built with billing off because a sideloaded
app has no Play listing to buy from. Product ids `licence`, `shards_small` and `shards_large` live
in `src/platform/native.ts`. The same file schedules the one local notification: when your fatigue
has faded, or the lockout after a wipe has lifted.

## What changed from v6

v6 was a fitness RPG: levels came only from real training and the Daily Quest, and the Gates paid
gear and shards but never experience. v7 removes the real-world half entirely:

- **Gone:** the Daily Quest, penalties and Hollow, Resonance, the Boon, Valcorde's interview and
  programmes, training sessions, custom programmes, lift records, and the exercise library:
  about 3,400 lines, nearly 30% of `src/`.
- **Gates pay experience.** By grade, double on a first clear, a share on a withdrawal or a wipe.
  It is settled in `raid.finish` with everything else the run pays.
- **No daily cap.** A cleared gate is replaced by another of its grade. Fatigue paces you.
- **The practice gate is the tutorial.** It replaces Basic Hunter Training and lands you on Level 5.
- **The kit comes with the licence**, at the Association desk.
- **Secret Missions and story beats** that read streaks, reps or sessions now read Gates, kills,
  bosses and runs without a wipe. The Hollow Monarch is made of hunters who stopped climbing.
- **One notification:** you are rested, or fit to raid again. The Daily Quest reminders are gone.
- **A fresh save key and app id**, so this and the fitness app can live on one phone.
