# ARISE — The System

A fitness RPG for the phone. You are told you have been selected as a **Player**. An instructor,
Ryn Valcorde, interviews you and builds a training programme around your real kit, time and
injuries. Then the System issues a Daily Quest every day: push-ups, sit-ups, squats. Miss one and
there is a penalty.

Training makes you stronger. Gates are where you find out how much.

> Inspired by the tone of *Solo Leveling*-style progression fiction. The world, characters, ranks
> and bestiary are original.

This is version 6: a ground-up rebuild of the original vanilla-JS app in TypeScript and Preact,
keeping its gameplay, copy and data, and dropping most of its machinery. See
[What changed from v5](#what-changed-from-v5).

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
| `npm run smoke` | Plays a new hunter from the splash to the first cleared gate in Chromium (needs a build) |
| `npm run screens` | Screenshots every screen from a seeded veteran save into `e2e/out/screens/` |
| `npm run balance` | Clear rates per gate grade and days-to-rank, from the real engine |
| `npm run calibrate` | Re-tunes every gate's difficulty by simulation and rewrites `src/data/gatetune.ts` |
| `npm run android` | Generates the Android project in `android/` (see [Android](#android)) |

## The loop

| Layer | What it is |
|---|---|
| **Daily Quest** | Push-ups, sit-ups, squats. Ten of each, plus one per day of streak, up to 100. Swapped for safe equivalents if something hurts. Resets at local midnight |
| **Resonance** | The streak. +0.01× on all experience per consecutive day, up to ×2.00 on day 100 |
| **Penalty Quest and Hollow** | Miss a day: the streak resets, a penalty quest at 1.5× the missed volume is issued, and Hollow halves experience until it is paid |
| **Training** | Valcorde's weekly programme, built from the interview and adapted after every session from how it felt and how much you finished. Every fifth week is a deload. Or write your own programmes |
| **The Boon** | Every completed set banks a point into the attributes it trains. Every three days the System pays the ledger out as raw attributes |
| **Levels and ranks** | One ladder, earned by training: E → D (Level 10) → C (20) → B (35) → A (50) → S (70) → Sovereign (100). Three points per level, five per rank |
| **Classes** | From D-Rank you are named after your highest trained attribute (25 classes in five lines). A class adds flat points to that attribute and gives you combat skills |
| **Gates** | Ten a day, one of every grade. A deterministic auto-battle: you, hunters the Association sends, and your Shadows. The brief simulates the gate 24 times and tells you the honest clear rate. Gates pay shards and equipment, never experience |
| **Shadows** | Felled creatures can linger after a clear. Reach for one with mana (the odds rise with INT) and it joins your army, growing with every kill |
| **Equipment** | Ten slots, six rarities, 538 designs. Every piece rolls its own quality and properties, and the properties apply in combat |
| **The Exchange** | Eight pieces a day plus potions, paid for in Mana Shards |
| **Secret Missions** | 43 unpublished citations that pay attributes. Nothing says one exists until you have done it |
| **Story** | 20 beats gated on level, streak and deeds, ending at the Hollow Throne |

## Layout

```
src/
  core/         the game, with no DOM: pure functions over the save, unit tested
    types.ts      every data and save shape
    save.ts       defaults, migrations, and the importer for v5 saves
    progression   levels, ranks, Resonance, attributes, classes
    quests        the Daily Quest, penalties and the midnight rollover
    boon          the three-day attribute ledger
    coach         the interview options, the programme forge, adaptation
    sessions      a training session from start to finish; every reward is settled at finish
    combat        units, abilities, statuses and the fight itself
    raid          chambers, the party, rewards, extraction, and the headless projection
    gates         the daily board and the hunters sent with you
    gear, shop, vitals, shadows, missions, story, lifts, templates, licence
  data/         content: exercises, enemies, abilities, dungeons, equipment, classes, story text
  app/          the shell: routing, the top bar and nav, and flow.ts, which narrates results
  screens/      one file per screen or major sheet
  ui/           overlays (System windows, sheets, tours, toasts), components, icons, the exercise picker
  audio/        every sound and the music, synthesised in WebAudio — no audio files
  platform/     the Android bridge: Play billing and local notifications (inert on the web)
  styles/       theme tokens, components, screens
scripts/        balance and calibration tools, the fixture generator, the Android generator
tests/          Vitest unit tests for the engine
e2e/            Playwright smoke test and screen tour
```

The rule that keeps it maintainable: **the engine changes the save, the UI only shows it.** A screen
calls an engine function inside `store.update`, then `app/flow.ts` decides which windows to show
about what happened. Nothing in `src/core/` touches the DOM, so all of it can be tested and
simulated headlessly.

## Balance

Combat difficulty is measured, not guessed. `npm run calibrate` runs every gate against typical
hunters from the middle of its grade and sets a per-gate multiplier so they clear about 75% of the
time. Run it after any change to combat, enemies, classes or gear. `npm run balance` prints the
result:

```
grade  floor  middle  top   | middle vs one grade up
  E     57%    69%    81%  |   15%
  D     58%    64%    78%  |   11%
  C     71%    83%    94%  |   9%
  B     66%    74%    83%  |   10%
  A     65%    70%    85%  |   9%
  S     40%    75%    93%  |   —

Days to each rank (Daily Quest every day + N sessions a week):
  0 sessions/week  D:12d  C:38d  B:91d  A:156d  S:276d  N:518d
  3 sessions/week  D:6d  C:22d  B:64d  A:116d  S:212d  N:420d
  5 sessions/week  D:4d  C:17d  B:53d  A:101d  S:187d  N:375d
```

A hunter at the bottom of a grade clears its gates a bit over half the time, and one at the top
almost always. Reaching a grade above your own is possible, and costly. Sovereign takes about a
year at five sessions a week.

## Saves

The save is one JSON document under `localStorage['arise:save']`. Fields with sensible defaults
need no migration: loading merges the saved document over `defaults()`. When existing data must
change shape, bump `SAVE_VERSION` in `src/core/save.ts` and add a step to `MIGRATIONS`.

Saves from the original app (`arise.save.v1`) are detected on first launch and offered for import.
They can also be imported from the System Console. Level, attributes, streak, shards, gear, Shadows
and records come across. Importing keeps the previous save as a restorable backup.

## Android

The Android app is a [Capacitor](https://capacitorjs.com) shell around the web build. `android/` is
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
streak, training, classes, Shadows — is unaffected. Shard packs are also sold. On the web there is
no store and the game is fully open, and so is the debug APK, which is built with billing off
because a sideloaded app has no Play listing to buy from. Product ids `licence`, `shards_small` and `shards_large` live
in `src/platform/native.ts`. The same file schedules the local Daily Quest reminders.

## What changed from v5

The original grew to 186 files, 1.5 MB of script and a 400-line rulebook for the agent maintaining
it. The rebuild keeps the game and drops the weight:

- **One rank.** v5 had a level ladder and an Association-points ladder that disagreed on screen.
  Now rank comes from level, and level comes from training.
- **Your training wins gates.** In v5 the assigned party decided most fights. Now enemies scale to
  a fixed party size, so Shadows and allies only ever help, and your own stats carry real weight.
- **Honest verdicts.** The gate brief runs the actual engine 24 times instead of reading a
  hand-tuned ladder that drifted out of date.
- **Equipment properties work.** Rolled properties such as critical chance and defence now apply
  in combat. In v5 they were display-only.
- **Rewards are settled once.** In v5, ticking and unticking a set could farm the Boon. Now a
  session only pays when it finishes.
- **One report.** A finished session or gate shows one summary screen instead of a chain of up to
  nine pop-ups.
- **No changelog machinery.** No archived changelogs, version-wiring tests or fifty-five unrun
  browser drivers. The history lives in git, and CI runs what matters.
- **The Hollow Throne exists.** The story promised a final gate at S-Rank; now there is one.

## Not medical advice

Filtering exercises by limitation is a convenience, not a clinical safeguard. If something hurts,
stop, and talk to a professional rather than to a fictional S-Rank hunter.
