# ARISE — notes for the agent

A Solo-Leveling-inspired dungeon RPG: Vite + TypeScript + Preact PWA, wrapped in Capacitor for
Android. README.md has the game and the layout; docs/DESIGN.md has where it is going next. This
file is only what you need to change code safely.

This was a fitness RPG until v7. That version is frozen on the `fitness-baseline` branch. Do not
reintroduce anything that needs the player to exercise; that belongs to a separate fitness app.

## Commands

- `npm run check` — typecheck, unit tests, build. Run before every commit.
- `npm run smoke` — after a build, plays a new hunter through the practice gate and a first real
  gate in Chromium. Run it whenever you change anything a player can see or tap. Playwright and
  Chromium are already installed here.
- `npm run screens` — screenshots every screen from `e2e/fixtures/veteran.json`. Look at them after
  UI work. Regenerate the fixture with `npm run fixture` if the save shape changed.
- `npm run calibrate`, then `npm run balance` — after any change to combat, enemies, abilities,
  classes, the skill tree, gear, the party, the map or the Ability or Skill Points a hunter earns.
  Commit the rewritten `src/data/gatetune.ts`. Calibration ends by printing every tuning it moved, old →
  new (`npm run tunediff` prints the same for the working tree against the last commit, or between any
  two commits). Give the user that report every time you recalibrate, and put its summary in the commit
  message and the PR: which tunings moved, by how much, harder or easier, and which stayed put. Never
  just say "recalibrated".
- `npm run mapstats` — what the map generator draws, every Gate of each grade over a run of days: the
  shape of the plans, what the road and the side rooms hold, and what a side fight costs. Run it after a
  change to how a map is drawn or what waits in its rooms, and say what moved.
- `npm run campaign` — plays two hunters from Level 1 for 120 days through the real engine. Run it
  after a change to what anything pays or costs. It reads the brief before every run, so it takes a few
  minutes.

## Rules that matter

- `src/core/` never touches the DOM. Engine functions take the save and mutate it. Screens call
  them inside `store.update(...)`, and `src/app/flow.ts` narrates what happened. Put game logic in
  `core/` so it can be tested, not in a screen.
- Every reward from a raid (experience, shards, materials, blueprints, pieces found whole, weapon
  Familiarity, records, Daily Quests) is settled in one engine call, `raid.finish`. Nothing pays out on a
  tap that can be undone.
- The day's Daily Quests (`contracts` in code) are written to the save the first time they are shown (`contracts.issue`),
  so nothing redraws them that day. Change what they pay and rerun `npm run balance`; its
  days-to-rank count them.
- A block of the Pale Spire is a gate drawn from its id (`SPR-<week>-<block>`, `spire.spireBlock`), so
  `gates.dungeonById` resolves it and the whole raid engine plays it. `npm run calibrate` tunes it
  after the gates; anything that needs recalibrating the gates needs the Spire recalibrated too, and
  the same run does both.
- A run keeps the Ascension level it walked in with (`run.ascension`, read through `ascension.levelOf`).
  Every rule inside a run reads that, never the level the hunter has chosen since. `npm run calibrate`
  tunes the levels last, against hunters who keep up (`keptUpHunter`).
- A gate's map is drawn from the gate and the day (`map.mapSeed`). Steps and choices are written to
  the open run (`raid.choose`, `raid.resolve`) before they play, and every roll a step makes is
  seeded from the run and the node. What the run finds is banked on it and paid in `raid.finish`.
- A Gate's map is rooms and corridors; the Pale Spire's blocks and the Trials are towers, climbed
  floor by floor (`GateMap.tower`). Walking back to a cleared room (`raid.moveTo`) and resting at a
  rest found (`raid.restHere`, once each) are written to the run like any step, and so is a Health Potion
  drunk between steps from the bag (`raid.drinkPotion`). The Health Potion is the one healing potion: the
  satchel carries them (`stock.hp`, up to `shop.satchelMax`), and the fight's Potion order drinks one. The bag's wheel (`ui/items.tsx`) gives each kind of
  item its own slot, listed in `bagFor` (`app/flow.ts`); a new item goes there, with its engine call in `core/`. The fog of war
  (`map.sight`, `raid.seen`, remembered in `s.gates.seen` by map seed) only hides rooms on the plan:
  it never reaches the fight, the System's road or the projection. A deeper Gate has floors (`FLOORS`),
  joined by stairs; its longer road's fights share out what a one-floor road paid (`raid.paceOf`), so
  change the floors or their roads and rerun the campaign as well as calibration. Each floor is a
  labyrinth sized by grade (`LABYRINTH`, held to `PLAN_MAX`). A run keeps the layout it opened with
  (`labyrinth`, the smaller `floors`, one floor of `rooms`): never change how an older layout draws.
- A Gate has a clock (`core/clock.ts`): a budget of moves set as the run walks in (`run.clock`), the moves
  a walk costs written to the run in `raid.choose` and `raid.moveTo` before the room plays (`run.moves`),
  and past the budget every creature not yet fought made stronger through the chamber's `might`. The
  System's way must fit inside the budget on every Gate, or Auto and the brief would stir:
  `tests/clock.test.ts` holds it, and `npm run mapstats` reports it. Never let the clock reach a fight
  except through `might`, and never change how an open run's budget was counted.
- The brief, Auto and calibration all walk the System's road (`map.systemRoad`, moved along by
  `raid.systemNext`, which keeps a rest it finds for the boss) and make the System's choices
  (`raid.systemChoice`). Change any of them, or how a map is drawn, and you must recalibrate.
- Gear is forged (`core/forge.ts`, `data/forge.ts`): Gates leave materials and now and then a
  blueprint, and a blueprint forges its design as often as the materials allow. There is no fusion.
  Weapon Familiarity reaches the fight only through `raid.heroSpec` (`forge.familiarityBonus`); the
  balance tools' hunters carry it (`typicalHunter` Familiarity 2, `keptUpHunter` the most). Change
  what it adds, or what they carry, and you must recalibrate. The campaign forges, recycles and
  upgrades as `smith` in `scripts/campaign.ts` does; change what anything costs or drops and rerun it.
- The skill tree (`core/skilltree.ts`, `data/tree.ts`) reaches the fight only through
  `raid.heroSpec`, and an open run keeps the hero it walked in with. Skill Points are never stored:
  they are what the level and the ranks claimed have earned, less what the tree holds. The balance
  tools' hunters spend them with `autoLearn`, as Auto Assign does; change how it spends and you must
  recalibrate.
- The fight is deterministic for a seed and a list of orders. The hunter's orders are written to
  the open run (`raid.order`) before they play, and a chamber is resumed by replaying them
  (`raid.resume`). Never let anything in a fight read `Math.random` or the clock.
- The projection and calibration fight on the auto policy (`choose()`, `targets()`, and the foes'
  `foresee()`). A hunter who gives no orders must fight exactly the auto fight;
  `tests/combat.test.ts` checks it. Change the auto policy and you must recalibrate.
- A foe's shown intent is a promise: it does exactly that unless its target fell or it is stunned.
  Anything that changes what a foe does must keep that true; the intent test checks it. A taunt
  (`profile: 'taunt'`) and the hunter's Cover are the only things that change an intent, and each does
  so by showing the new one (an `intent` event) before the foe acts. A creature's behaviours
  (`data/tricks.ts`: a shield, a rally, a mark, a drink, a wind-up gathering) are intents like any move,
  and the intent test holds them to what they showed.
- Creatures get their behaviours in `raid.foeUnits` (`tricksOf`: the role's at every grade, the
  family's from C-Rank, a wind-up for a boss or Gatekeeper). The auto policy goes for a creature
  winding up or channelling, whatever the orders. Change a behaviour, its numbers or that rule and you
  must recalibrate. Auto never covers or throws: throwables, like potions, are the hunter's own, so the
  brief assumes none. A run keeps the throwable readied as it walked in (`run.throw`, from
  `shop.readied`), and its fights throw only that kind: readying another reaches the next Gate.
- Seals (`data/seals.ts`, `core/seals.ts`) are taken on the brief and written to the run as `run.seals`;
  every rule they play reads the run's own list, as every Ascension rule reads `run.ascension`, and the
  brief's projection plays the ones taken. They pay Ascendant Ember only (`sealEmber`), never shards, in `raid.finish`.
  The brief (`screens/Brief.tsx`) and its Seals' window share the Seals set and the projections made for them.
  Calibration plays no Seals; the campaign takes a Gate's while the brief reads 75% or better.
- Feats (`data/feats.ts`, `core/feats.ts`) are judged from the run's tally, counted in `raid.record`,
  and pay once each per Gate (`s.gates.feats`). Condition drops (`data/drops.ts`) are read at the kill
  in `openChamber` and banked on the run (`run.drops`). Neither touches a fight, so neither moves a
  tuning; both pay whoever met them, so change what they pay and rerun the campaign.
- Sight's Foresight (`FORESIGHT` in `data/tree.ts`) only shows a foe's numbers (`skilltree.foresees`).
  It is never a passive of the fight's build and Auto Assign never takes it, so it moves no tuning;
  keep it so, or recalibrate.
- Standing orders steer the hunter's Shadows, and the hunter when nobody gives their turn an order;
  never the Association's hunters (`combat.aim`). They are set on the Shadows screen
  (`raid.setTactic`). A step underway keeps the orders it opened with: orders set during one reach
  the run when its next step is chosen (`raid.choose`). No Shadow takes orders of its own.
- Copy that quotes a number reads it from the engine's constants (see `screens/Guide.tsx`), so the
  text cannot drift from the rules.
- Save shape: adding a field with a default needs nothing beyond `defaults()` in `core/save.ts`.
  Reshaping existing data needs a `SAVE_VERSION` bump and a `MIGRATIONS` step. Never change
  `STORAGE_KEY` (`arise-rpg:save`); it is deliberately not the fitness app's `arise:save`.
- Colour has meaning: cyan is the System, gold is advancement, green is success and currency,
  orange is Gates, violet is Shadows, red is damage or warning, and the Forge's ember marks a
  material the hunter tracks. Screens retint `--accent`; System
  windows set their own colour. A tile turns gold only while it waits on the hunter (`call`); see
  VOICE.md, "Colour and emphasis".
- Ryn Valcorde does not know the System exists. Nothing he says may reference it.
- Every word a player reads follows `docs/VOICE.md`, including README's description of the game. A
  System window is built with `src/ui/system.ts` and never explains, advises or refers to itself;
  the rules it would explain go in the Guide. `tests/voice.test.ts` checks what it can. A wording
  decision that will come up again goes into VOICE.md in the same change. A creature is defeated, never
  felled, in every line a player reads (the voice test holds it); keys the save holds keep their names.
- The look follows the speaker (VOICE.md, "The look"). Anything the System shows is drawn in its
  frame from `src/ui/frame.tsx`, or `sys()` with a System kind, or a sheet opened with `system`, and
  set in Montserrat. Nothing else uses that frame or that type.
- Screenshots gathered as references for a step of the roadmap are kept in
  `docs/research/references/<step>/`, downscaled, with a README giving each one's source and what
  ARISE took from them, and linked from that step's section in DESIGN.md.
- `android/` is generated by `scripts/android.mjs`. Never commit it or hand-edit it.
- Install with `npm install` (the repo's `.npmrc` sets `legacy-peer-deps`).

There is no changelog file. Write a clear commit message instead.
