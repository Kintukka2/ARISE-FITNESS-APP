# ARISE — voice

How ARISE speaks to the player, and how each speaker is drawn. Every word a player reads follows
this file: System windows, Valcorde, buttons, labels, the Guide, item and enemy text. So does every
frame they sit in ([The look](#the-look)). Read it before writing or changing any of them.

Every speaker is written: the System, Valcorde, the interface and the world.

## Speakers

| Speaker | Who it is | Where it appears |
|---|---|---|
| **The System** | The program that chose the hunter. Reports, never explains. | System windows, every card (gear, potions, skills, classes), the Status sheet |
| **Valcorde** | Ryn Valcorde, the Association's instructor. Does not know the System exists. | Coach windows, the first Gates, the Gates screen |
| **The interface** | The app: buttons, labels, tabs, empty states, settings, tutorials, the Guide. | Everywhere outside a System or coach window |
| **The world** | The Association's file on each Gate, and the narration inside one. | The brief's Gate description, map events, traps, caches, shrines, rests |
| **Other voices** | Things that are not the System and should not be in its windows. | The `???` window, nothing else yet |

Each speaker sounds like itself. A line that would fit another speaker needs rewriting.

- **Any speaker may name the System. Only the System may not refer to itself.** The Guide says "the
  System issues 3 Daily Quests a day"; a System window never says "the System".
- **Teaching belongs to the interface.** A tutorial window is the app speaking (kind `app`, a plain
  title such as "Your Turn"), and the Guide holds every rule. Neither is a System window.
- **Valcorde teaches only what he can know:** Gates, ranks, the Association, fatigue, his own past.
  He gives judgement, never rules; see [Valcorde](#valcorde).

## Surfaces

Every surface a player reads has one speaker. A new surface gets a row here before it ships.

| Surface | Speaker | Where it lives |
|---|---|---|
| System windows: Notification, Quest Info, Quest Rewards | The System | `src/ui/system.ts`, `src/app/flow.ts`, `data/narrative.ts` |
| Cards: items, skills, classes, potions, stats | The System | `data/equipment.ts`, `data/classes.ts`, `data/abilities.ts`, `core/shop.ts`, `core/progression.ts` |
| The brief's assessment | The System | `raid.verdict`, `GRADES` |
| The brief itself, read top to bottom as the reference games lay a stage before it is entered (the owner's call: overhaul it freely, after the references): a Gate card in the Gates' orange, `GATE: {name}` to a screen reader, with no header box. At its top the hunter's banner, the window's head over a hairline: the grade's sigil, the name in capitals over `Level 32 · C-Rank Hunter`, the bag at its right (the count of everything in it in a badge, read aloud `Items, 3 held`, opening the items' wheel, where a throwable is readied) and the close beside it; under them `HP` over `380/480`, `MP` over `120/204`, `Fatigue` over `22`, each over a thin bar, with a pill on its label's row, a + and the count held or the shards it costs, that drinks its potion at once. Then the head, as a boss is revealed, centred, the grade's light turning slowly behind it: `E-Rank Gate:` small over the Gate's name large (`C-Rank floors:`, `Trial of Ascension:` over `Ascension 4`); the Gate's portal inside the assessment's ring, a tick to each of the System's 24 runs lit for each it cleared, the arc in the verdict's colour; under it the rate large and the verdict beside it (`100% Safe`), breathing while the System replays the Gate under a Seal just pressed; its chips (`Cleared` in green or `Never cleared` in the Gates' orange, its mark, `Ascension 3`; the Trial's `Rest: None`, `Withdrawal: Not possible`, `Allies: None`); the Association's file centred, held to two lines until tapped (the Trial's `5 of the Chosen, in a row.`); at Ascension its rules by a crown in gold. Under the head the facts, three across between hairlines, as the reference games set a stage's recommended power by its enemies: `Party` over its power and `Boss` over the boss's in red, each by the power mark (`?` until the boss is known; `Last Chosen` on the Trial, the power of the last of its Chosen), and `Floors`, said before anyone has been inside (`Chosen` on the Trial). Never the Gate's moves, before it is entered or after (the owner's call: the clock is felt inside, not counted out on the brief), and never its rooms, which wait in Today's map. `Objectives`, a small label over a line each: `Defeat the boss` first, always, the boss's name at its side in red (`?` until it is known; `Defeat the Chosen in the boss's place`, `Defeat the Chosen, one after another` on the Trial), then `Association Quest: …` in Ryn's blue, each Daily Quest it can move, `To open Ascension 4: clear it at Ascension 3`, and, under Wardens Wake, `Wardens Wake: defeat the Gatekeeper` with its `Ember +4`. `Rewards` (`· Ascension 3: pay +30%` beside it in green), as Honkai: Star Rail and Genshin Impact lay a stage's drops: a tile to each, its mark framed in its kind's colour, its figure in the corner, its name under it: `XP` in gold over `Gate clear` with `+650`; the shard in green, `Gate clear`, `+26`; while it has never been cleared the shard again, `Bounty · once`, `+52`; the Trial's crown, `Ascension 4 opens`; the Spire's spire, `Floor 30`; once a Seal is taken Ember's art, `Seal bonus`, `+12`; every material the Gate can leave by its art and name, a tracked one framed in the Forge's ember with the anvil at its corner; and the blueprint, `Blueprint` (`Blueprint · DRS or ABC`, the Practice Gate's `Ring`) with `×1`, never qualified by how often it drops (the owner's call: not `sometimes`). A thing a clear leaves is counted `×1`, never `a blueprint`. From D-Rank the Seals, set in place (below). Then `Enemies`, as Honkai: Star Rail lays a stage's enemies: a portrait to each, its family's glyph in a ring, its name under it over its kind, the boss first and larger in red (`Gate boss`; one of the Chosen in its place ringed in gold, `In the boss's place`; the Trial's `5 Chosen` over `One after another`), the Gatekeeper ringed in gold (`Gatekeeper`), the rest after (`E-Rank Undead`), `?` and `Unidentified` until the hunter has been inside; one identified opens its card; one of the Chosen holding the Gate under them by a gold rule. Only what walks in the Gate, never a drop or a Shadow. `Your party` (`Entering` on the Trial) with its power at its right by the power mark, read aloud `Power 336`, as Darkest Dungeon lines its party up before it embarks: a portrait to each, the hunter's sigil ringed in the hunter's blue, the Association's hunters by their grade's plate (`▲` or `▼` by their power when above or below the Gate's grade), the Shadows by their badges in violet, a free slot dashed, `Free`; each name over its power; under them the squad's make-up in one line, `Kin: Orc II · Formation: Brute, Caster`. `Feats` with its three stars at its right, gold for each met; a row to each, a star, its name over its objective and a thin bar filled to the System's odds, at its side `System 18/24` over `Blueprint +1` in green, or `Met`. `Today's map`, one row over its rooms and nothing more (`16 rooms`; the Spire's `30 floors`, the Trial's `5 Chosen`; never its moves or the road to the boss), with `Redraw 14:39:50` and a chevron; a tap opens the map in a window of its own, `MAP: {name}` (`MAP: Ascension 4`), through its fog, a floor at a time behind `Floor 1`, `Floor 2` tabs, the System's road dotted along it, and `Key` with a caret at its top right, which drops every kind of room the plan shows under it, a mark and a name to a line, however many there are, and folds again at a tap anywhere else. Until the hunter has been inside it reads `Unidentified` by a lock and opens nothing (the owner's call: the map is not on the brief itself). Docked at the foot, Enter The Gate alone. No tabs: what the Gate holds reads in one scroll | The System, with the hunter's banner and the Association's file in its head; the objectives' quest lines and the Seals' line while none is pressed are the interface's | `openBrief` in `screens/Brief.tsx` |
| The Seals on the brief, as Hades lays its Pact of Punishment, pressed in place (their window is gone, at the owner's call): `Seals` with Ember's art and `+12` `Ember on a clear` at its right; a wax seal to each offered, grey and dashed while open, red and lit once pressed with a stamp, its name under it and its Ember (`+4`) in orange; under them what the seal last touched does, `Swollen: Creatures: HP +25%` and its note, or, while none is touched, `Sealing a Gate will make it harder to clear, but you will receive additional rewards.`, or `Fixed for this run.` while a run is open on the Gate, the seals its own and fixed. A seal pressed reddens the band behind them and the head's rim, and the head's ring answers with the System's new reading. `Ember`, said alone, is Ascendant Ember, where its art stands beside it or the line is about its pay | The System; the seals are its controls | `SealStrip` in `screens/Brief.tsx` |
| A creature's card, over the brief: `BOSS: {name}`, `GATEKEEPER: {name}` or `CREATURE: {name}`, its family's glyph in its icon box; its spotlight, the glyph large in red, `Gate boss`, `Gatekeeper` or `Creature` over its name and `E-Rank Goblinoid · Guardian · Power 44`, and `Serves as a Shadow` in violet for one bound; `Habits`, each by its name in gold over one paragraph, with no mark beside it, told as "a habit, told" in Words says, its figures in the System's blue and its statuses and stats in gold, in the creature's own numbers for its grade (`Charged Strike` over `Charges its strongest attack for 2 actions, then strikes for 180% damage. After taking 6 hits while charging, it becomes Broken, is Stunned, and loses 40% defence for 2 turns.`), a hairline between them, the same paragraph a fight's tip on the habit gives; `Statuses`, `Immune: Bleeding, Poisoned` and `Resists: Cursed`, where it has any; and `Special drop`, in the same box as the habits: the drop by its name in gold (`Blueprint +1`, `Monster Bone +2`) over its condition, framed by the final hit: `Land the final hit while it is Broken.` (`Land the final hit.`, where it must be the hunter's own; `The final hit lands while it is Stunned.` and `The final hit lands within 3 rounds.`, where anyone's counts; `A Shadow lands the final hit.`), coloured as a tip is The special drops are read here and on a fight's foe card, never on the brief's lists | The System | `CreatureCard` in `screens/Brief.tsx` |
| A Trial's brief: `TRIAL: Ascension {n}`, in advancement's gold | The System alone. The Trial is the System's, so it has no Association file and no Association hunter walks in, and it has no Feats tab: its terms are chips (`Rest: None`, `Withdrawal: Not possible`, `Allies: None`) | `openBrief` in `screens/Brief.tsx` |
| Setting a mark: `Would you like to set this mark?`, the mark, what it adds, `Set: 1/4 → 2/4`, and in red that it cannot be moved | The System, as an Offer, in gold | `MarkList` in `screens/Gates.tsx` |
| The Ascension walkthrough: the sheet explained a part at a time, the first time it opens and from its help button | The interface, as a tour headed `Tutorial` (`tour()` with `who: 'app'`) | `ascensionTour` in `screens/Gates.tsx` |
| Every main screen's bento tiles (Inventory, Gates, Shadows), and the Quests screen's rail and rows | The System | `ui/bento.tsx`, `screens/` |
| The Equipment, Army, Licence and Ascension windows, and the hunter's card (`HUNTER: {name}`) | The System | `screens/Inventory.tsx`, `screens/Shadows.tsx`, `screens/Gates.tsx` |
| `GATES`, the board, rebuilt after the stage lists of Honkai: Star Rail and Solo Leveling: Arise (the owner's call: overhaul it freely): `Open`, `Entered` (the open Gates the hunter has walked into), `Closed` (closed today by a clear) and `Redraw` (the countdown in gold by the timer) across its head as facts between hairlines, with no box (the owner's call: `Entered` in place of `Never Cleared`, `Closed` for `Closed Today`); the rail, pinned at the top as the board scrolls, `All` and a star for the marked in rings, and each grade as a small portal in its colour with its letter, each over its count, the one picked lit and underlined in its colour; a divider to each grade, `C-Rank` in its colour with its letter large, `Clear: XP 650 · ` and the shards beside it, and `3 Gates` or `Licence` with a lock at its right, over a rule in its colour; a card to each Gate, its grade's colour down its left edge and its light fading to the right, its portal larger, `[Warcaller’s Muster]` over `Boss: Orc Warcaller` (`Boss: ?` until it is known, `Licence: A-Rank` beyond the licence), its name over two lines rather than cut, and at its right the boss's power by the power mark in red (`?` in grey until the boss is known, nothing beyond the licence; read aloud `Boss power 21`), as a stage card states its recommended level; under the boss its marks, the counts first so they line up row to row, as quiet marks with no box: the Shadows bound from it (`1/4`, read aloud as `Shadows bound: 1 of 4`), its Feats as three stars, gold once met (read aloud as `Feats met: 1 of 3`), and, where it is home to a set, the set blueprints known of all its sets' (`1/6`, read aloud as `Set blueprints known: 1 of 6`; it names no set); then what marks it, `Training`, `Chosen`, `Association` or `Quest`; `Bounty` and the shards; and the Forge's anvil where it leaves a material the hunter tracks (a count beside it for more than one, read aloud as `Tracked materials here: Runesteel`). A Gate cleared once has a tick on its portal, read aloud as `Cleared`; its name stays white. On the Gates screen, a star on a grade's portal where a marked Gate stands | The System, in the Gates' orange; the rail and the chips are the interface's controls and labels inside it. The marks keep the colours the tiles' counts had: Quest the System's cyan, Chosen gold, Association Ryn's blue | `BoardSheet`, `GradeBand`, `GateRow` and `boardTile` in `screens/Gates.tsx` |
| The Shadows screen's stage and `ARMY`: on the stage, after Solo Leveling: Arise's Army of Shadows (the owner's call: overhaul it, freely), `Army of Shadows` over `Squad 3/5` and `Squad Power` over its figure, laid over the fog; the squad standing in a V on a lit floor under a falling light, the first deployed large in front, its name under it over its rank, `Lv.40` and its stars, the others smaller behind it with their names (gold, and a gold dot at the badge, while one waits on the hunter), a free slot a dashed ring where a Shadow would stand, the reserve its families' shapes in the fog behind; under it the Kin and roles the squad lights, a hexagon and `2 Leader`, `Orc II`; then, while one waits, one gold row, `Promotion ready: 3` (`Awakening ready: 1`), that promotes and awakens them all, or `Shadow slots free: 2`, that opens the Army; and `Shadow Essence`, `Bound` and `Reserve` with their counts. A tap on the stage opens the Army; the frame is gold while anything waits. In the window, `Shadow Essence`, `Squad Power`, `Bound`, `Ready`; `Squad` and its slots; under them, as Teamfight Tactics tracks its traits, a chip to each family and each role deployed, two to a row, the active first: its mark in a hexagon (violet while active, grey while short), its count, its name over its breakpoints (`2 › 3`, the one reached lit; `1 / 2` while short), a role's `Formation`, the Aberration's `Kin to every family`; a tap opens, under them, what it gives as a trait's tooltip lists it, `Orc Kin` and `2 deployed` over `(2) Attack +10%` and `(3) Attack +20%`, the one reached in a gain's green, then `Each Orc Shadow deployed` (a role's `(1) Defence +5%` over `You and every Shadow`), and another tap closes it (the owner's call: the references' structure and wording); **Auto Deploy** and **Recall** beside the squad's count, as plain text with their marks; the tabs `All`, `Squad`, `Reserve`, `Ready`, each with its count, underlined while shown; `Sort: Power` (`Level`, `Rank`, `Grade`, `Newest`); the heads `Shadow`, `Lv`, `Power`; a row's `Ready` or `New` on its badge and `★2` for its stars; the empty lists `No Shadow is ready.`, `No Shadow is deployed.`, `No Shadow is held in reserve.`; the toast `Squad deployed.`; the x on a deployed slot, read aloud as `Take out: {name}`. A drag says nothing: the slot under it lights and its ghost is the badge and the name | The System, in the Shadows' violet; the tabs, sort and views are the interface's controls inside it. A row names the Shadow without `Shadow`, as a slot does: the column is headed `Shadow` | `tiles` and `ArmySheet` in `screens/Shadows.tsx` |
| The fight log | The System | `lines()` in `screens/Arena.tsx` |
| What an outcome inside a Gate cost or paid | The System | `system.outcome()` |
| The extraction panel, promotions, the Chosen, Daily Quests | The System | `screens/Arena.tsx`, `ui/contracts.tsx` |
| The Quests screen: its rail, its rows, and the QUEST INFO window each opens (Daily Quests, Reclassification, the Weekly Quest, the Trial, the Chosen, the Secret Quests) | The System | `screens/Quests.tsx`, `ui/contracts.tsx` |
| The Quest chip on the board | The interface | `screens/Gates.tsx` |
| Onboarding dialogue, coach windows, the Gates screen line, the Gates tour | Valcorde | `data/narrative.ts` |
| The `???` windows | Another voice | `data/narrative.ts` |
| A Gate's description in the brief | The world: the Association's file | `data/dungeons.ts`, `data/special.ts`, `data/spire.ts` |
| Map events, traps, caches, shrines, rests, each stepped into as a scene filling the screen, as the reference games stage an event: its mark vast and faint behind light turning slowly round its emblem, the mark large in a ring lit in its kind's colour (an Event's orchid, a rest's and a cache's green, a shrine's and a Font's gold, a trap's red, a landmark's orange), its title under it in capitals (`A Fallen Hunter's Pack`); at the foot, in the thumb's reach, its line centred over what can be done; no box round it; each choice a row, what is done over `Success rate: 70%` (or `Certain`), a thin bar filled to the odds in the kind's colour, a chevron at its right | The world: narration; the choices' odds are the interface's | `data/nodes.ts`, `NodePanel` in `screens/Arena.tsx` |
| Buttons, labels, tabs, tiles, hints, toasts, empty states, results, tutorials, settings, the map legend, standing orders, Ascension rules, the Guide | The interface | `screens/`, `ui/`, `data/nodes.ts` (`NODE`), `core/combat.ts` (`TACTICS`), `core/ascension.ts` |
| A locked feature's notice (the Quests tab before the Practice Gate, the Shadows tab before the first Shadow) | The System | `app/router.ts` |
| Unit cards in a fight. A foe's card, in fixed rows: its name and HP; the bar, red, or while it winds up or channels its break in its place, blue, a section to each hit it can still take, the taken ones hollow (read aloud `Break: 2 hits left of 3`); its habits by name on one line, in small capitals joined by dots, `Enrage · Bloodlust · Charged Strike` (`Charged Strike` and `Incantation` in blue), and at the line's end the glyph of the part its special drop leaves (a blueprint's for a boss), gold and swelling while the condition holds (the status on it, or the first three rounds), its tip `Special drop` over `Defeat it while Stunned: Monster Bone +2.`; its own statuses as tags (a boon such as `Enraged` in the Gates' ember, never the party's green: on a foe it is a threat); then its next move in a panel of its own, by name and never whom it goes at: `Grave Strike`, `Charging Warcaller Cleave`, `Channelling Frost Lance`, `Grave Nova · everyone`, `✦ Shields Bone Scrapper`, `✦ Rallies the pack`, `✦ Marks a target`, `✦ Second Wind · HP +35%`; over two lines at most, never cut short, red when it goes at the hunter; broken, `Ravager Claws · Broken`, struck through. On the hunter's turn the panel also shows, never on hover: a square with its place in the foes' order (`1`, dashed when it comes after the hunter's next turn), and `Lethal` or `May be lethal` on its top corner when one hit of it defeats its target, its rim red (dashed for may). With Foresight, and only then, `Damage 38-52` and `Hit 87%` side by side under the move, and `×1.8` where it lands harder (read aloud as `Damage 38 to 52, hit chance 87%`). Whoever a foe goes at wears a tab on its card's top corner, `◀` and the place of each foe coming for it, plain numbers with no square of their own (`◀ 1 3`) (read aloud `Coming for you next: the foes 1 and 3 in the order`), or the count of them while the fight plays. A habit, a status or a move with something to tell is underlined in dots, and a tap on it opens a tip by it, its name over its lines, closed by the next tap anywhere, and aims at nothing: a habit's line (`TRICKS`), a status's (`STATUS_TEXT`), and a move's: `Each hit landed on it takes a section of its bar. The last breaks it, and the move is lost.`, `Inflicts Bleeding: HP -6% each round.`, `Every foe here acts 2 times each round.` | The System | `STATUS_TEXT` and `reckon` in `core/combat.ts`, `TRICKS` in `data/tricks.ts`, `Intent` in `screens/Arena.tsx` |
| Spire reward tiers, rank blurbs | The System | `core/spire.ts`, `core/progression.ts` |
| The splash and the Hunter Licence card | The world: the Association's file | `screens/Onboarding.tsx` |
| The brief's map before the hunter has been inside: `Today's map` / `Unidentified`, a fogged `?` | The System, as the unidentified boss | `screens/Brief.tsx`, `core/gates.ts` (`mapKnown`) |
| The Arrival: the cut between the office and the first Notification | No one. It carries no words, so the System's first words are its Notification | `ui/arrival.ts`, `screens/Onboarding.tsx` |
| The rank-up: the cut between a held Reclassification and "Reclassification approved." | No one, as the Arrival | `ui/arrival.ts` (`rankUp`), `app/flow.ts` (`claimRank`) |
| The promotion: the cut between a held Hold To Promote and "[Shadow …] has been promoted." | No one, as the Arrival | `ui/arrival.ts` (`promotion`), `app/flow.ts` (`claimPromotion`) |
| A Shadow's promotion earned, on the results: `[Shadow …] has met the requirements for promotion.`, on that Shadow's alert, in its violet, with nothing under it and nothing to tap: the Shadows tab's mark shows where to go | The System, as an alert: a strip of its frame, not a window (`SysAlert`) | `ShadowAlerts` in `screens/Shadows.tsx`, `ui/frame.tsx` |
| The Daily Quests a run moved, on the results: one alert each, `QUEST INFO` under way and `QUEST REWARDS` once done, with what it paid | The System, as alerts | `QuestLines` in `ui/contracts.tsx` |
| A Shadow lingering, on the results: `The mana of [Clay Sentinel] lingers.`, an alert that opens the extraction | The System, as an alert that is a button | `screens/Arena.tsx` |
| The extraction: what lingers, the cost and the odds, Hold To Extract; bound, `You may bestow a name.` and the name field | The System, on its sheet headed `NOTIFICATION`; the field and Not Now are the interface's | `Extraction` in `screens/Arena.tsx`, `NameField` in `screens/Shadows.tsx` |
| A creature already in the army, extracted again: before the reach, under what lingers, `But [Shadow Ghoul] already serves in your army.` / `Would you like to extract its Shadow Essence instead?`, then `Shadow Essence +2` on a line of its own with the Essence mark, then `Attempts left:` and `Extraction cost:`; held, `[Shadow Ghoul] has become Shadow Essence.`. Its alert carries the Essence it would give. The reach costs half, and nothing says so: the cost shown is the cost | The System, on the same sheet and alert; the question is its Offer | `Extraction` in `screens/Arena.tsx` |
| What a run did to the deployed Shadows, on the results: an alert only to each that levelled up (`[Shadow Ghoul] has levelled up.` over `Lv.9 → Lv.11`) or that the run made ready for promotion, `XP +14` at its right and a meter along its foot. A Shadow that only took XP, or was already waiting, gets none | The System, as alerts | `ShadowAlerts` in `screens/Shadows.tsx` |
| A Chosen defeated, on the results: `You have defeated [The Pale Duelist].` over what it left and `[The Pale Duelist] will return to the Gates.`; a masterwork's alert opens its card. A level proved: `ACCESS GRANTED: ASCENSION 4` over its name, the upgrade limit and `Marks +1` | The System, as alerts: every report on the results is one, never a window | `screens/Arena.tsx` |
| The run's head and HUD on the map, rebuilt after the reference games (the owner's call: overhaul it freely): the head is the Gate's title card, as Persona 3 Reload names a floor as the party steps onto it, the grade's plate at its left, small over large: `E-Rank Gate · Floor 1 of 2` over `The Bone-Litter Cellars` (`Ascension 3` among the small words; the Spire's `The Pale Spire · Floor 26 of 30` over `Floors 26-30`; the Trial's `Step 1 of 5` over its name; a Red Gate's `Red Gate` in red in place of the grade), the pace at its right; in a room or a fight the Gate's name small over the room's (`Rest`, `Chamber 2`). Under it the HUD, one row with no box and a hairline under it, as Slay the Spire keeps its run in view: the heart in red and the health bar with `1298/1298`, then `Allies`, `Banked` and `Found`, each its mark and figure over its word (`5/5`, the shard in green and `2`, the bag and `0`; read aloud `Allies standing: 5 of 5`, `Banked: 2 Mana Shards`, `Found: 0`); under them each blessing taken as its Path's mark in a gold diamond (a Duo's two marks) with its tier's numeral at its foot, and nothing else, so the row stays one row however many are held; a tap opens the tip the fight's words open, its name and tier over what it does (`Quickdraw II` over `You act first in each fight, and your first hit deals +40%.`), read aloud whole. Under the HUD the last thing the run did, one line with its tone's rule down its left (`▸ [Chamber 3] cleared. Rounds: 2. Standing: 6. Condition: Unhurt.`). On the Gate clock, nothing while the budget holds (the owner's call: the hunter never sees the budget or the moves spent); past it, a band over the plan, as Darkest Dungeon's torch sits over its corridor: `Stirring`, a bar filling toward red with the Gate's mark at its end, and `+6%` alone (read aloud `Stirring. Creatures not yet fought +6%.`); turned, `Red Gate`, the bar full and pulsing, the creatures' share over `Sealed` | The interface, labels as the Status sheet's are; the chip in advancement's gold | `RunHud`, `GateClock` and the head in `screens/Arena.tsx`, `BoonChip` in `ui/boons.tsx` |
| The Gate's plan in the arena, a floor at a time: `Floor 2/3` over it in a deeper Gate; each room a tile with its mark and its name, every mark a silhouette drawn for the plan after Slay the Spire's and Darkest Dungeon's rooms (`ui/icons.tsx`, the `room` marks): a Fight three claw marks, the Gatekeeper a horned great helm, the boss a demon's skull, a rest a campfire, a cache a chest, a shrine an altar with a rune over it, a trap spikes, the entrance the Gate's arch with its portal in it, the vault a strongbox; the boss's skull is the boss's wherever a Gate names it (the brief's `Defeat the boss`, the board's tile); and the HUD's `Found` is a chest (a fight seen and not yet fought carries a pip to each creature in it at its top right, in orange, larger and red for a strong one, and nothing else; `Fight`, `Event`, `Stairs Down`, `Stairs Up`, `Sealed` for the vault, `Used` for a rest used), or, in the fog, a faint `?` and no word (read aloud `Unseen room`); a cleared room a check mark and no word, in place of its own mark and name (read aloud `Walk back to the cleared Fight`; a rest, the stairs and the entrance keep theirs, for coming back to); the plan cropped to the floor's rooms, every one, found or not, so it fills its frame and sits in the middle of the room it has; the stairs in the fog until seen, as any room; `You` over the room the hunter stands in; a shrine seen and not yet entered shows its Path's name under its altar (`Sight`, read aloud `Enter Shrine of Sight`), and a Font its own mark, water welling under a rising mark; a landmark its standing stone in the Gates' orange and its own name (`Ossuary`, `Gnawed Den`), seen from the moment the hunter walks in and keeping its mark once cleared; a cache behind a hidden passage nothing at all, not even fog, until the passage opens, then `Secret` with a gold dot at its corner; a toll door a corridor in dashed red with a lock on a red disc at its middle until it is paid, then a corridor like any; at the plan's top left on the later plans, `Secrets` over `1/2`, the eye in gold (read aloud `Secrets found on this floor: 1 of 2`); a seal the hunter can break pulsing, and the room it seals dashed in red, either tapped to break it: a Notification in the Gates' orange, `Would you like to break the seal and open the room?` over `HP -289` in red, **No** and **Yes · HP -289**, its Yes in red, or, too hurt to pay and still stand, `Not enough HP.` over `HP -289`; broken from across the plan, the hunter walks to it first, the walk's moves counted (the owner's call: a tap and a question, never a button under the plan); a rest found and not yet used lit in healing's green, tapped to rest there (walking back to it first, its moves counted), a Notification in the System's cyan asking `Would you like to rest now?` with **Not Yet** and **Rest**, the same window as a rest is first stepped into, **Rest** opening its three (the owner's call: a tap and a question, never a button under the plan); in the dock at the screen's foot, **Withdraw** at the entrance (in a Red Gate, `The way out is sealed until the boss falls.` in red), or the hint `Tap a room that glows, or a cleared room to walk back to it.`, with `Each corridor is a move.` after it on the Gate clock; on the clock, a room's moves are never drawn on its tile or read aloud with it (`Enter Fight, 3 creatures`), so the hunter never counts them (the owner's call); the hint says a corridor is a move; past the budget the plan's rim reddens toward red, and a Red Gate's plan is red and striped, its entrance `Sealed` under a lock, the arena's edges reddened; at the dock's right, in the thumb's reach, the bag with the count held, up a tower too. The head no longer counts rooms cleared. Down the stairs, the feed: `Floor 2 of 3.` A survey used: the toast `Gate Survey · Thornburrow Warren charted.` A withdrawal's results: `Withdrawn with 4 of 11 rooms cleared. The Gate is still open.` | The interface | `ui/map.tsx`, `screens/Arena.tsx` |
| The Gate clock's windows: the first move past the budget, `[The Gate is stirring.]` / `Creatures not yet fought: +1%`, the share in red; the move that turns it, `[The Gate has turned red.]` / `The way out has been sealed.` in red / `Creatures not yet fought: +305%`, the share in red counting up from 0, slowly to 100 and then all at once, the window shaking as it lands (a screen reader hears the share whole); this window alone of the System's is framed in red (`redgate`), not the Gates' orange. From then on the arena's head reads `Red Gate` in red, glowing, where the Gate's name was, and a Red Gate has its own score, low, slow and dissonant, with a heartbeat under it. Every other move past the budget, the feed: `The Gate stirs. Creatures not yet fought +7%.`, and once red, `The red deepens. Creatures not yet fought +309%.` | The System: the stirring in the Gates' orange, the Red Gate in red; the feed is the narration's | `tellClock` in `screens/Arena.tsx`, `core/clock.ts` |
| The items' wheel, from the bag: six slots round a hub, a slot to each item, always the same one; the Health Potion first, the Mana Potion beside it, then the Gate Survey, then the Flash Vial, the Binding Cord and the Ember Flask (`Stunned · One foe`, `Burning · Up to 3 foes`, `Held: 1/2`, and **Ready** where Use would be, or `Readied` for the one readied; inside a Gate, `In a fight` for the run's and `Not readied` for the rest: they are thrown from the action wheel, and only the one the run walked in with), each potion's glyph tinted as the Exchange tints it; a slot shows its item's glyph over the count held (`2/3` for the Health Potion's satchel, `1`); the hub, `Items` over `Tap an item.`, or the item tapped: its name, what it does (`HP +25%`, `MP +25%`, `Charts every room`), `Held: 2/3`, then **Use**, or why it cannot be used now (`None held`, `HP full`, `MP full`, `Not now`, `Sealed: Dry`, `Nothing left to chart`); **Close** under the wheel. Tapping an item only shows it: Use is the asking. A Health Potion drunk from it in a Gate: the feed `▸ You drink a Health Potion. HP +324.`; on the brief, or a Mana Potion anywhere, the toast `Health Potion · HP +120`, `Mana Potion · MP +40` | The interface | `ui/items.tsx`, `bagFor` in `app/flow.ts` |
| A rest found, after the window's `Would you like to rest now?` (**Not Yet** keeps it, lit on the plan): `The air is still here. Nothing has come this way in a long time.`, then its three ways side by side, after the campfire of the references, each its mark in a ring over its name and what it gives worked out: **Heal** (a heart, healing's green) over `Party HP +30%`, **Hone** (the anvil, advancement's gold) over `A skill +1 level`, **Steady** (a shield, the defence's blue) over `Debuffs cleared · Health Potion +1` (`Debuffs cleared` with the satchel full); one this rest cannot give greyed in place, its reason in red (`Sealed: Lightless`, `No skill equipped`); **Later** under them in a Gate (up a tower the rest waits on the choice). Hone opens `Hone a skill for the rest of the Gate` and a row to each skill equipped, its glyph, its name and its level before and after (`Lv.2 → Lv.MAX`, `Lv.MAX → Lv.MAX+1`), and **Back**. Taken: `The party catches its breath.` over `Party HP +30%`; `You check your straps and bind what is still bleeding.` over `Debuffs cleared · Health Potion +1`; `You run through the motions until they come without thinking.` over `Sundering Arc +1 level · Until you leave the Gate`. A shrine stepped into, headed by its Path (`Shrine of Sight`, its stat's mark): `Three marks are cut into the altar stone. Each one is warm to the touch.`, and a card to each of its three blessings, after the boon rows of the references: the Path's mark in a gold diamond at its left on a gold wedge that deepens with the tier, the name in capitals, its tier at the top right in pips and its numeral (`◆◆◇ II`), under the name its Path (`Sight`, `Duo · Ruin + Tempest`, `Capstone · Ruin`), what it does in one line coloured as the fight's tips are, and, for one Auto never plays, `Auto never plays it`. Taken: `One of the marks burns, and fades into your skin.` over `[Blessing: Read the Blow III]` and what it does. A Font: `Water wells up through a crack in the floor, lit from beneath.`, the same cards, each one a blessing held, `Tempest · Tier II → III` under its name and the number that moves before and after (`+40% → +55%`); taken, `The water rises around you, and sinks back into the floor.` A vault opened: `The seal is broken. What the Gatekeeper kept is stacked inside.` In the feed, a passage opened: `A wall gives way. There is a passage behind it.`; a Gatekeeper down: `The seal on the door behind it breaks.` (`Somewhere in the Gate, a seal breaks.` on a plan from before the vault moved behind it); a rest used from the plan, as Auto uses one: `The party rests.`, `You hone Sundering Arc.`, `The party steadies itself.`; a toll paid: `You pay the toll. The seal breaks.` A landmark, as an event: its title (`The Ossuary`), its line (`Bones stacked to the ceiling in careful rows. One alcove has been swept clean, and something lies in it.`), its gamble with its odds and the way past it (`Leave the dead their rest`) | The world: narration. The line of what a rest gives and the buttons are the interface's | `NodePanel` and the feed in `screens/Arena.tsx` |
| A block of the Pale Spire taken, on its results: **Climb On · Floors 86-90** over **Leave The Gate**; the range is the next block's, as the Spire's head writes it | The interface | `Results` in `screens/Arena.tsx` |
| Leaving with a Shadow still lingering: `A Shadow Lingers` | The interface, as the unrevealed loot's reminder is | `screens/Arena.tsx` |
| A purchase or a use offered: `Would you like to purchase?` / `Would you like to drink?` / `Would you like to use?`, and under it **Do not ask again** | The System's Offer; the toggle is the interface's control, and Settings lists what it skips | `ui/ask.tsx`, `screens/Settings.tsx` |
| Ryn's Association Quests: his card at the top of the Quests screen (the log's first section, shaped as its rows: `Association Quest · No. 6` and `Ryn Valcorde` over his face, the job and its count, his line held to two lines until tapped, a bar, and the pay as chips; once done, the row is the report, gold, with a strip along its foot: **Report To Ryn**, then the pay, `XP +675 · Fatigue Potion`, and the job ticked), his windows when he hands a job over and pays for one, the alert on a run's results (shaped as the System's alerts, in his blue, his corner brackets and his face) | Valcorde, on his channel. The job's goal and its pay on the card and the strip are the interface's labels inside it | `ui/assoc.tsx`, `data/narrative.ts` (`ASSOC_FIRST`, `ASSOC_BRIEF`, `ASSOC_PAID`) |
| The board's `Association` chip, and the brief's `Association Quest:` hint | The interface | `screens/Gates.tsx`, `screens/Brief.tsx` |
| The `?` on a Stats sheet field, and the line it opens on what the number does and where it comes from | The interface, inside the System's frame, as a hint is; one line each, its numbers read from the engine (`CRIT`, `HIT`). The `?` sits in the top right corner of every such box; the whole box is the button, and the line shows only once it is tapped, never on hover | `FIGHT_HELP` in `screens/Inventory.tsx`, `Field` in `ui/frame.tsx` |
| The action wheel. Shut, it is one round button, `Actions`, with the picked action's glyph and a tick round it for each slot. Open, a slot to each skill slot the rank holds (an empty slot dashed), then the throwable readied (`Ember Flask`, or `Throw` with none), `Potion`, `Guard`, `Cover` and `Strike`, each with its glyph and name (every skill its own, `SKILL_GLYPH`; Guard's in blue, Potion's in green, the rest in the Gates' ember), an item's count held in a badge at its glyph's top right, and under them, always in the same place, a green dot when the skill defeats the foe aimed at more surely than a Strike would (a ring for may). The hub says everything there is to say about the slot shown, and nothing sits under the wheel: the name, `Lv.2 · Ready` or `Ready in 2`, `Damage 386-522` over `Hit 95%` on the foe aimed at (`No damage` for a curse or a support) and `Inflicts Staggered` for what a skill inflicts, Guard's `Damage taken -50%` over `Aimed at you: 2` (with Foresight `Incoming 7-9` over `Guarded 3-4`; `Damage taken -50%` alone with nothing coming), Potion's `HP +25%`, Cover's ally over `Nothing aimed at them` or `Aimed at them: 2` (with Foresight `On Jaemin Nam 8-11` over `On you 3-4`), a throw's verb and reach over its status's line (`Burn up to 3 foes` over `Burning: HP -7% each rd`; `Stun one foe`, `Root one foe`), then `Defeats it` or `May defeat it` in green where it does, and last, in small capitals, how to use it: `Tap again to use`, or `Let go to use` while a finger drags over it, or why it cannot be used (`Ready in 2`, `None held`, `HP full`, `None left`, `Sealed: Dry`) in red. Two ways to use a slot, and nothing is used on a first tap: press the shut button (or anywhere on the open wheel), drag onto a slot and the hub shows it, and let go on it; or tap a slot, and tap it again. Let go anywhere but a slot, and nothing is used. With Cover picked, every ally standing outlined in the defence's blue, to be tapped, and the hint `Your turn. Covering Jaemin Nam; tap an ally to change.`; the ally covered wears `Covered` in blue until the hunter's next turn. A Strike is never marked. Ranges, never the roll, each read aloud with `to`; a hub line read aloud in full (`each round`) | The interface, as the turn bar is | `ActWheel` in `screens/Arena.tsx`, `finishers` and `Turn.aims` in `core/combat.ts` |
| The arena's pace, at the right of its head in place of a count: a button with the fast-forward glyph and `1×`, `2×` or `Skip`, and `Auto` beside them while Auto is on. Its menu: `1×` (`Every blow at its own pace`), `2×` (`Twice as fast`), `Skip` (`Straight to your next turn. The log keeps every line`), then `Auto` (`The System fights your turns and picks your way`). A Pale Spire block or a tower keeps its count in the head's small line: `· Floor 86 of 90`, `· Step 3 of 5` | The interface | `PaceMenu` in `screens/Arena.tsx` |
| A Shadow's card, after the info panel of Solo Leveling: Arise's Army of Shadows: its badge in the ring of its next level, and beside it what it was, small, then the panel's rows, `Rank │ Bound` (a gold arrow at its end while a promotion or a star waits, a tap on it going to it), `Lv. │ 3/10` with `XP 1/6` at its end over its bar, `Power │ 80`, and its grade, family, role and `Deployed` or `Not deployed`; Deploy or Recall and Name; Next rank (or Promotion) and Awakening; `Stats` with `Growth +8% / +120%`, a row to each stat, its mark, its name, its value and what its level has added in green; under them, as the panel sets `Shadow's Authority` over its line, `Formation · Leader` over `Initiative +4 for you and every Shadow`, green while it is deployed, and `Orc Kin` over `(2) Attack +10%` and `(3) Attack +20%`, the one its squad reaches green (`Kin to every family` for the Aberration); then Skills, Traits and Record. The growth graph and the stats radar are gone: the owner asked for the card to be cleaned up after the references | The System, in the Shadows' violet. The section labels, the graph's rank names and the radar's legend (`Now`, `Lv.MAX`) are labels, as the Status sheet's are | `ShadowCard` in `screens/Shadows.tsx` |
| The standing orders on the Shadows screen: `Standing Orders` and `Shadows and Auto`, the four orders as a mark over a name each, a tap setting one at once, the one set lit and underlined, its line from `TACTICS` under them, and `Step underway: As They See Fit` in gold while a step keeps the orders it opened with. There is no window for them now. No Shadow takes orders of its own | The System, in the Shadows' violet; the order names and lines are the interface's, as the standing orders always were | `OrdersSheet` in `screens/Shadows.tsx`, `TACTICS` in `core/combat.ts` |
| A Shadow's next rank on its card: `Next rank`, what it asks (`Level 14/20`, `Shadow Essence 9/12`, `Bosses defeated 1/1`), each ticked once met, and what it brings (`Level cap: 20 → 30`); once all is met, `Promotion`, its badge now and at the rank above, Hold To Promote | The System, in the card's violet, the promotion itself in advancement's gold | `NextRank` in `screens/Shadows.tsx` |
| Awakening on a Shadow's card, once it is Ascendant: `Awakening` and its stars (★★☆☆☆), what the next asks (`Level 40/40`, `Shadow Essence 52/45`) and brings (`Awakening: ★★ → ★★★`, `Stats: +108% → +112%`), Hold To Awaken; done, `[Igris] has awakened.`, `Awakening ★★★` and the stats | The System, in the card's violet, the panel in advancement's gold once all is met | `Awakening` in `screens/Shadows.tsx` |
| Promote All, from the Army's Ready count: `Would you like to promote every ready Shadow?` (`awaken`, or `promote and awaken`), a line to each (`[Shadow Drake Lord] Vanguard Rank → Ascendant Rank`, `[Igris] Awakening ★★★★`), `Shadow Essence -107`, and `Not enough Shadow Essence for 1 more.` in red where it falls short; **Promote All** or **Awaken All**, and **Cancel**. Done, one window: each Shadow's `[…] has been promoted.` over its ranks and `Level cap: 30 → 40`, and `[…] has awakened.` with its stars | The System's Offer, then the System, in the Shadows' violet | `claimAll` in `app/flow.ts` |
| The Stats radar: its rings' values beside the STR axis, and on the Stats sheet the key `With gear` and `Without gear`, then `Tap a stat for its value` | The interface, inside the System's frame, as the radar's legend is | `Radar` in `screens/Inventory.tsx` |
| Releasing a Shadow: `Would you like to release this Shadow?`, its name, `Shadow Essence +5`, and the warning `A Shadow released is gone.` | The System's Offer, its warning in red | `Release` in `screens/Shadows.tsx` |
| The family glyphs, the rank insignia and the Shadow badge | No one: art, as the rank plates are | `ui/emblems.tsx` |
| A rank's requirements met: `You have met the requirements for [Reclassification: D-Rank].` | The System | `app/flow.ts` (`reclassReady`) |
| Speaker labels on Valcorde's voice box and on tours ("Ryn Valcorde", "Notification", "Tutorial") | The interface | `ui/components.tsx`, `ui/overlays.tsx` |
| A System notice set into a screen (a Shadow has joined your army) | The System | `screens/Shadows.tsx` |
| Potion chips ("Full", "Rested") and the activity log | The interface | `core/shop.ts`, `core/raid.ts` |
| The Status sheet, Skills, Inventory, the Forge, the Exchange, item, blueprint and Shadow cards | The System | `screens/Inventory.tsx`, `screens/Gear.tsx`, `screens/Forge.tsx`, `screens/Shadows.tsx`, `screens/Exchange.tsx` |
| The Inventory: its counts (`Items`, `New`, `Designs`, `Mana Shards`), Items and Sets, a tab to every kind, `Sort: Score`, the filters (`Better`, `Set pieces`, `Starred`), `Select` and its bar (`3 selected` and what they would give back as material chips, `Iron Scrap +6`, Recycle); a square to every item, `New` until it has been seen | The System; the tabs, the filters and the bar's count are the interface's labels inside its frame | `screens/Gear.tsx` |
| The Sets view: `Designs discovered` by rarity, and a card to every set, its pieces held, known as blueprints (the blueprint mark, opening the recipe), seen or `-- --`, what 2 and 3 worn pay, and its home Gate | The System | `SetCard` in `screens/Gear.tsx` |
| An item's card, headed by the piece itself after Diablo IV's and Genshin Impact's item pages: its art large in its rarity's light with rays turning behind it, its rarity and kind, its tags (`Worn · Weapon`, its set, `✦ Perfect`, `Masterwork`), `Score` large and what it gains over the piece it would replace in a chip (`▲ 27`), its Quality and bar along the card's foot (`Steps to perfect: 9`); then `Compared with` over the worn piece's name and score; Equip, the star and the bin (Recycle, its offer saying what it gives back) in one row; `Stats` and `Properties` in one box, each stat with its difference, each property with a bar from its design's worst to its best and the range (`9-13%`), the card text under them; Upgrade (Quality and Score, each before and after in a box of its own, and its materials as tiles held over needed); a weapon's `Familiarity` (its pips, `Familiarity points: 150/260`, `Attack and magic +4% · Forged quality from 16%`); its set; `Blueprint` over `Forge another` | The System; differences are drawn as ▲ and ▼ with their signed values, gains in green and losses in red; a material tile is green with enough and red without | `ItemCard` in `screens/Gear.tsx` |
| Recycling offered: `Would you like to recycle this item?` (or `these items?` and `Items: 3`), the item and its quality, what it gives back (`Mana Silver +5 · Mana Core +2`), `A recycled item cannot be recovered.` in red | The System's Offer | `screens/Gear.tsx`, `screens/Forge.tsx` |
| `FORGE`: its counts (`Blueprints`, `Can forge`, `Materials`, `Mana Shards`), `Blueprints · 26` and `Materials`, a tab to every kind, the filters `Can forge` and `Set pieces`; a band to each rarity, and a row to each blueprint: its art, its name, `Epic Amulet · Held: 1`, and `All materials held` in green or `Materials missing` in red; a weapon's familiarity as pips | The System | `screens/Forge.tsx` |
| A blueprint's card, `BLUEPRINT: {name}`, headed as an item's card is (its art large, no icon box beside the header): its rarity and kind, the `Blueprint` tag, `Score 30-50` (read aloud as `30 to 50`), `Worn` and the piece it would replace, `Stats` (`Quality 16-100%`, each stat as a range, `PER +1.5-2.5`), `Properties` as ranges, a weapon's Familiarity, its set, `Required materials` with the shards, `Track Missing · 2` under them while any is short (`Stop Tracking` once all those are tracked), the Forge button (`Forge · 63`, or why it cannot: `Materials missing`, `Mana Shards 40/63`), the piece just forged turned over with `Quality 87%`, and `Held`: every piece of the design with its quality and Recycle | The System | `Recipe` in `screens/Forge.tsx` |
| The Materials view: `Alloys`, `Parts`, `Trophies` (`2/14`) and `Ascension`, a row to each material: its art, its name, its line, how many are held; a row tapped is tracked, and carries the anvil. Tracking toasts `Tracking: Runesteel`, and `No longer tracking: Runesteel` | The System; a material's line is the Association's plain description | `screens/Forge.tsx`, `data/forge.ts` |
| What a run left, on its results: `Materials` as chips (`Iron Scrap +10 · Monster Bone +4`); the blueprints turned over first among the finds, each marked `Blueprint`; on a clear, `Feats` with `2/3`, the Gate's three as on the brief, each `First time: Blueprint +1` in green, `Met` or `Not met`; Notifications for the Seals the run walked in with, `[Seals] Swollen, Dry. Their pay is in what the run left.` (`Carried out: nothing is paid.`), and for the conditions met, `[Special drops] 2 creatures defeated the way their condition asks.`; and a Notification for the weapon carried in, `[Ancient Dragon Talon] Familiarity 2` and `Familiarity points +8`, or `Familiarity: 2 → 3` when a rank is reached, its pips at the side | The System, as alerts and loot | `Results` in `screens/Arena.tsx` |
| The Equipment sheet, after Destiny 2's and Diablo IV's character screens: the score in a hexagon beside `Equipment score`, a diamond to each slot filled and `Slots: 10/10`; the hunter's figure wearing what is worn, each slot's part of it (the head, the chest, the hands, the legs, the feet, the pendant, a ring on each hand, the sword in one hand and the shield at the other) filled in its piece's rarity and dashed while the slot is empty, the part of the slot pointed at outlined white; a square to each slot either side (`HEAD`, `RING I`), each the piece's art with its score, its quality as a gold line under its name, framed in its set's hue while the set pays, and a gold ▲ where Auto Equip would change it (`+` where an empty slot has something held that fits); Auto Equip (gold, its count in a box of its own, `Auto Equip 1`) beside `Inventory 28`; `Stats` (what is worn adds to each stat, in white, then its `Properties` two to a row in ice, `STATUS CHANCE +26.7`); `Sets worn` (`Paying: 1`), a row to each set with a piece worn: its mark, its name, a diamond to each piece and `2/3`, and what two and three pay, lit once worn; and `Loadouts`, a row to each (`Loadout I` in its hexagon, `Worn`, a pip to each slot, `Score 387`, `Missing: 1`, Wear, Save, `Save Worn`) | The System | `Equipment` in `screens/Gear.tsx` |
| A slot's window, `EQUIPMENT: {Slot}`: `Worn` and Unequip over the piece worn there (its art, its name, `Epic Ring · Quality 82%`, its stats in white, spaced), then `Held` and its count, a row to every piece held that fits, best first: its art (`WORN` on a ring worn in the other ring slot), its name, `Rare · Quality 66%`, its stats, its score and what it gains or loses on the piece worn (`▼ 20` in red), and Equip; Auto Equip's own pick for the slot framed in gold, its Equip gold. A row opens the piece's card | The System | `SlotWindow` in `screens/Gear.tsx` |
| A set's window, `SET: {name}`, opened from a set worn: its pieces held, worn, known as blueprints or still to find, what two and three pay, and its home Gate | The System | `openSet` in `screens/Gear.tsx` |

Ascension rule text belongs to the interface (the Gates screen, the Guide). When the System announces
a new level it names the level and what it opened, never the rule.

## The look

The look follows the speaker, as the words do. A surface is drawn in the frame of the one speaker
the table above gives it, so a player can tell who is talking before reading a word.

| Speaker | Frame |
|---|---|
| **The System** | The anime's window, below. Every System window, and every System surface on a screen: every main screen's bento tiles and the Shadows screen's stage and orders, the Status sheet, Skills, Equipment, Inventory, the Exchange, the Gates board, the Army, the brief, item, Shadow and hunter cards, Quest Info, Quest Rewards, the notices after a run. Settings and the Guide take it too, at the owner's call |
| **Valcorde** | His channel, below: his voice box on a screen, his windows, his tours and his card in the intro |
| **The interface** | Its own windows (confirmations, tutorials) and the controls between the tiles (the nav): the System's geometry, square corners, scratched glass and a hairline inside the edge, but no lit rails, no header plate and Rajdhani in capitals |
| **Other voices** | The red `danger` frame. Nothing else uses it |

**The cinematics have no speaker and no frame.** Each is light on a canvas: a rank plate lifting off
where it was shown, a lock of rings catching, the breach. The Arrival is the System's cyan; the
rank-up is advancement's gold, and the new rank's plate rises out of its breach in the rank's own
colour. The promotion is the Shadows' violet: a Shadow's badge lifts off its card and rises out of
the breach wearing its new rank's insignia. None of them sets a word, so none takes Montserrat or the
frame, and nothing in the Arrival may be read as the System talking before its first Notification. A
later cinematic follows the same rule: if it needs words, they go in a window after it.

**A creature is drawn by its family.** Each of the sixteen families has a glyph of its own
(`ui/emblems.tsx`). A creature shows it alone: the brief's boss card, once the boss is known. A
Shadow shows it doubled, the creature in white and its shadow in violet behind it, on a shield with
its rank's insignia under them: chevrons after an army's, one for Bound, two for Sworn, three for
Vanguard, three over a rocker for Ascendant. The badge is the Shadow's mark everywhere it is drawn
large (the Army, its card, the promotion); below about 40 pixels the insignia or the glyph goes
alone.

**An alert is the System's frame as a strip.** For news that asks for nothing where it shows (a
Shadow's promotion earned, on the results), the System does not open a window: a strip of its frame,
lit down its left edge, its icon box, `NOTIFICATION` small, and one line, sliding in once. One that opens something ends in a lit box with a chevron at its right edge, and stays until it is used. One that only reports goes when it is tapped, or of itself eight seconds after it lands (`ALERT_STAYS`), and the alerts under it close up. A window is for what the player answers or must stop for.

### The System's frame

Built only with `src/ui/frame.tsx` (`SysFrame`, `SysHead`, `Field`), a sheet opened with `system`, or
`sys()` with a System kind. Never drawn by hand.

- **The colour lives on the frame.** The frame is lit along the top and the bottom, with a raised
  plate at the centre and thin rails down the sides. Cyan for the System, gold for advancement,
  orange for Gates, violet for Shadows, by CLAUDE.md's rules. Gear and potions are the System's
  own, so they take cyan.
- **The glass is dark and scratched**, ruled with one pale hairline. Nothing inside it takes
  colour except by [Colour and emphasis](#colour-and-emphasis).
- **Every element sits in its own hairline box:** the icon, the header, each field, each stat, each
  button, each tab. Corners are square; nothing inside the frame is rounded.
- **The icon box** holds the circled `!` on a window, and the item's or the Shadow's own icon on a
  card. Status, Skills, Inventory and the Exchange carry their header alone, as the source does.
- **The header box** holds a header word in capitals (`NOTIFICATION`, `STATUS`), or a card's name
  with its type set small in front of it (`ITEM:` Warden Plate). `SysHead` reads which from the
  title: `Item: Warden Plate` is a card.
- **The type is Montserrat** (`--font-sys`), the geometric sans the anime sets its windows in:
  white, with a soft glow of the frame's colour. A bracketed name is set bold and italic and glows
  brighter. No other speaker uses Montserrat.
- **A field** sets its label small, in capitals, above its value: `ACQUISITION DIFFICULTY:` /
  `S-Rank`.
- **A button** is a hairline box with its label as written, not in capitals. The act the window
  offers is lit; the way out is not.
- **A System line set into a screen is an alert:** the strip a run's results use (`SysAlert`), lit down
  its left in its kind's colour, its icon box, `Notification` small over the line. It shows only when there
  is news and goes when tapped, or of itself. It was a window set into the screen, frame, header box and all,
  until the owner asked for fewer boxes on the Shadows screen.
  The voice box at the top of a screen is Valcorde's alone (`Voice`); the System never speaks in it.
- **A list of rewards** is one box with each reward in a hairline box of its own inside it:
  `system.rewardList()` in a window, `<Rewards>` on a screen. Quest Info's REWARDS and every Quest
  Rewards window are set this way.
- **A box is for what the hunter acts on, not for what they read.** Inside a long System sheet a box to
  every list, row and field put them all in competition, so on the Army and a Shadow's card (the owner's
  call) only the slots, the hero head, the rank's asks and the buttons keep one, and on the brief only the
  Gate's head, the bag and the potions, the map and Enter The Gate. Everything read sits on
  the glass: rows with a faint hairline between them, a small label over each group, the roster's tabs
  underlined, its sort and views plain text and marks, a squad's lesser acts as text beside its count,
  and Release, a loss, a quiet red line set apart at the foot. A tooltip opened in place is a rule of the
  frame's colour down its left, never a box.

### Valcorde's channel

Everything Valcorde says arrives the same way, like a call on an Association feed. Built only with
`CoachHead` and the `coachframe` class (`ui/components.tsx`, styled in `ui.css`); his voice box is
`Voice`, his windows are `sys()` with the `coach` kind, his tours are `tour()` with `who: 'coach'`.

- **His blue** (`--coach`), never the System's cyan, and never the System's lit rails, plate,
  circled `!`, header word or Montserrat. He does not know that frame exists.
- **Square corners, a hairline inside the edge and four corner brackets**, over faint scanlines.
- **His head** where a header word would be: his portrait in a lit box with a scan passing over
  it, `RYN VALCORDE` and his post, `INSTRUCTOR · HUNTER TRAINING`, under it.
- **A signal** of four bars, moving while his line types out and still once he has said it. His
  line types out wherever he speaks, the voice box included; a screen reader hears it whole.


The System speaks the way the System speaks in *Solo Leveling*. The anime is the main reference;
the manhwa fills in where the anime shows less (the Status sheet, item and skill cards). DESIGN.md
allows reusing the source's templates and stock lines word for word. What fills them is ours.

The templates below are code: `src/ui/system.ts` builds every System window from them (`notify`,
`refuse`, `offer`, `levelUp`, `questRewards`) and marks names, foes and gains (`tag`, `foe`, `gain`,
`red`). A screen that shows the System speaking calls these rather than writing the window.
`tests/voice.test.ts` holds the rules a test can check: the closed list of headers, no
self-reference, Valcorde's silence about the System, the decided words (no "contract", "Secret
Mission", "attribute", lowercase "gate" or old tier names), counts as digits, name before value,
and no dashes.

### How it speaks

1. **It reports what happened.** "has arrived", "has been slain", "has activated", "has failed",
   "is not available". It never says why.
2. **One fact per line, a few lines per window.** Two lines is normal; four is long. Several
   events are several windows, or several lines of the same shape, never a paragraph.
3. **Every name wears its type.** `[Daily Quest: …]`, `[Item: …]`, `[Skill: …]`, `[Effect: …]`,
   `[Class: …]`. The label does the explaining.
4. **Numbers are exact and bare.** `+25`, `-20%`, `0/3`, `60 MP`. Never "about", never
   "34 times in 100". Every number is read from the engine's constants, as everywhere else.
   Every count is a digit: "Clear 7 Gates", "Earn 1,000 Mana Shards", never "seven" or "a
   thousand". "One" as a word only ever means "a": "Raise one stat to 50." A number is never
   dropped because the text cannot reach its constant; move the constant to `src/data/` where
   the text can import it, as the Shadow slots were.
5. **It is flat.** Threats get no adjectives. Rewards get no praise.
6. **It is a little stiff.** The source reads like a translation: "You got rewards." "Accept this
   rewards?" Keep that stiffness. Do not smooth a System line into natural English. The stiffness is for
   its announcements and windows; what a creature or a move does is told plainly, as the reference games
   tell it (Words, "a habit, told").
7. **It calls the hunter "Player"**, and only the System does. "[Welcome, Player.]"
8. **Warmth is rationed.** The source allows itself "Good luck." at a turning point. ARISE gets the
   same: rare, short, never a joke.

### It never

- refers to itself. "The System has counted…", "The System does not punish…" are out.
- explains the world, a rule or its reasons. What a Gate is and why fatigue matters belong in the
  Guide, a card or a label, never in a System window.
- gives advice or orders about how to play. "Spend them." "Do not treat this as permission." are out.
- comments, jokes, or ends on a remark.
- uses dashes, rhetorical questions, or "not X but Y".

### Announcements

- **One event, one announcement.** When two windows would report the same moment, keep the one
  that carries more and cut the other. Clearing the Practice Gate completes the Secret Quest
  `First Light`, so there is no second "You have cleared [The Practice Gate]."
- **A payout is reported once, in the window that pays it.** A level qualifies the hunter for a rank
  and the hunter claims it, so the rank's own window ("Reclassification approved.") reports the
  rank's Ability Points and the level-up window never includes them. Daily Quest pay is shown in the
  run's results, where `raid.finish` settled it.
- **A run's Daily Quests are one notice on its results**, in the Gates' orange: a line to each quest
  the run moved, its ring, its goal, its count, or what it paid once done, and a line for the
  completion bonus. There it stands in for QUEST INFO and QUEST REWARDS, and the XP and
  Shards tiles do not repeat what it paid. The full window stays on the Quests screen.
- **A rank is told twice, as two events:** once when the level meets its requirements
  (`You have met the requirements for [Reclassification: D-Rank].`), once when the hunter claims it
  ("Reclassification approved."). The first pays nothing.
- **A character may react to what the System announced**, without repeating its numbers: the
  System reports C-Rank, then Valcorde says it took him eleven years.
- **Order follows the engine:** the Spire's week, level-ups, Secret Quests and class changes, then
  story beats (`rewardChain` in `src/app/flow.ts`). A beat never announces what an earlier window
  already did.

### Windows

The header is one of a closed set. Anything not on this list is a NOTIFICATION.

| Header | For |
|---|---|
| NOTIFICATION | Every announcement, event, warning and offer |
| QUEST INFO | One quest: name, brief, goal, rewards |
| QUEST REWARDS | What a finished quest paid |
| STATUS | The hunter's sheet |
| STATS | The five stats: where each comes from (base, class, gear) and the hunter's numbers in a fight. Its tile is the Inventory's Stats |
| SKILLS | Skills, passive and active |
| EQUIPMENT | What the hunter wears: a square to each of the ten slots around their figure, the score in its hexagon, what it adds, the sets worn, the loadouts. A slot's own window is the card `Equipment: Ring I` |
| INVENTORY | What the hunter holds |
| FORGE | Every blueprint known, a row each saying whether its materials are all held, and every material held. ARISE's own window: the source has no forge. A blueprint's card is `BLUEPRINT: …` |
| GATES | Every Gate standing open today, a tile each, under the grade tabs |
| LICENCE | The hunter's licence with the Association: the card, their number on it, the grade the board answers to. Its number is on the card, so the head names the window only (the owner's call) |
| ASCENSION | The level the Gates are entered at, as a dial, the road to the next level, the climb of every level and its rule, and the way to the marks. The level is the dial, so the head names the window only |
| MARKS | The marks, a seal to each, set from here; opened from Ascension (the owner's call: the marks have their own window). The seals are its pictures, so the head names the window only, as the Forge's does |
| ARMY | Every Shadow bound, a tile each |
| SETTINGS, GUIDE | The interface's two windows, set in the System's frame at the owner's call. Their words stay the interface's: plain, free to explain and to name the System |
| EXCHANGE | The shop: the balance, the potions and the day's stock. ARISE's own name for it, not the source's "Shop", so the place has one name everywhere |

Cards have no header word. Their header box is the name: `ITEM: …`, `SKILL: …`, `CLASS: …`.

Windows written by other speakers are not System windows: Valcorde's carry his name, the app's
own (settings, data, confirmations, tutorials) carry a plain label, and another voice carries
`???` until the game has named it, then its name (`The Hollow Monarch`). Only another voice uses
the red `danger` frame.

### Colour and emphasis

The frame follows CLAUDE.md's colour rules: cyan for the System, violet for anything Shadow, gold
for advancement, orange for Gates. The text inside follows these:

- **A name** sits in brackets and stands out. An enemy or boss name is red.
- **A gain or an effect's value** is green: `+25`, `ALL ABILITIES +40%`.
- **In the gear's windows green is kept for what changes** (the owner's call: a window where every
  figure was green read as one colour and meant nothing). A piece's own stats, and what the gear worn
  adds to each stat, are white, each beside its stat's glyph in the System's cyan; its properties are
  ice, the System's cyan washed toward white (`PER +4.6` white, `Crit Chance +9.8%` ice); green is a
  gain over the piece worn (`▲ 16`, `▲ +0.9`), a set's bonus while it pays, and Mana Shards, the
  currency; an upgrade's result is gold, as advancement is (`78% › 88%`). A property's bar runs cyan,
  gold once it is at its best. Bonuses side by side are spaced, not dotted: `PER +4.6   AGI +2.3`.
- **Unspent Ability Points** are gold wherever a tile shows them, with a lit `+` mark: gold is
  advancement, the "there is something for you here" colour. They stop being gold once spent.
- **A tile waiting on the hunter is gold, and only then.** On every screen, a tile with something to
  do or something new (points to spend, a skill to choose, a rank or a promotion to claim, a Trial
  open, a mark to set, a Shadow just bound, a squad slot empty, better gear to put on, a run left
  open) turns its frame gold whatever its kind, lights its count gold with a word (`3 new`,
  `4 points`, `Ready`, `Open`, `1 ready`, `3 better`), and a light crosses it (`call` in
  `ui/bento.tsx`). Otherwise a tile keeps its screen's colour: Skills, Reclassification, the Trial,
  the Chosen and Ascension are not gold at rest, though the windows they open are advancement's.
  Ryn's card turns gold the same way when a job is done. The breathing frame (`hot`) is kept for
  what to look at but not act on: a lockout, a licence to buy.
- **The Forge's anvil, in its ember, marks a tracked material:** the hunter tags a material by
  tapping it in a recipe or in the Forge's Materials, and the anvil stays on it, on every Gate on the
  board that leaves it, and in that Gate's brief, until it is tapped again. It is the hunter's own
  mark, so it is neither the System's cyan nor gold.
- **On the action wheel, Guard is blue and the Health Potion green** (`--guard`, `--verdant`): its slot,
  its glyph, the hub's rim and the shut button while it is picked. The blue is the defence's own, a
  deeper blue than the System's cyan or Ryn's, and means nothing off the wheel; the green is healing's,
  a gain like any other. Every other action keeps the Gates' ember.
- **A Gate turning red is the one System window framed in red** (`redgate`): a Red Gate is a warning
  the whole window carries, as the plan and the arena turn red with it. Every other System window keeps
  its subject's frame and reddens only its words.
- **Every window a Gate's plan opens is one window:** the System's Notification, its icon box and header
  box, its lines centred, the way out on the left and the act on the right, both the same size. Only the
  colour moves with the subject: a rest's question in the System's cyan, a seal's in the Gates' orange,
  the stirring in orange, a Red Gate in red. A Yes that costs the hunter (a seal's HP) is red, not lit,
  and says its cost (`Yes · HP -289`); the cost is red in the lines too. The owner's call, after a seal's
  question came up in the red `danger` frame, which is another voice's. `system.offer` and the other
  System windows take only the System's kinds (`SysKind`), so the type holds it.
- **Orchid marks an Event room on a Gate's plan** (`--event`): a choice with its odds stated, and the
  rooms that pass for one. Only there; it means nothing anywhere else.
- **A Gate cleared once wears a small green tick on its portal's corner.** Its name keeps its white:
  a board of green names was more green than anything on it meant.
- **A set's pieces carry the set's mark:** a small diamond low in the corner of each piece's icon, in
  the set's own hue (`gear.setHue`), and the same diamond beside the set's name wherever it is
  written. Pieces of one set read as one without a word.
- **Power is marked by two crossed swords** (`power` in `ui/icons.tsx`) wherever a party's or a creature's
  power is set as a figure without its word: the brief's facts and its party's head. Read aloud, it is
  `Power 336`. The mark takes its figure's colour, red beside a boss's.
- **A warning** reddens only its key word: in "You will be transferred to the penalty zone.",
  only "penalty zone" is red.
- **A failure or refusal** reddens the whole message and keeps the frame of its subject.

In markup: `.warn` is red, `.grant` is green, and `<strong>` is a name, which the System's frame sets
bold and italic. A gain is green in every System frame, whatever the frame's colour: a promotion in
a violet frame still reads `Bound Rank → Sworn Rank` in green.

### Brackets

- A window that is one announcement brackets the whole line: `[Daily Quests have arrived.]`
- A name inside a longer sentence brackets the name only: `[Skill: Shadow Extraction] has failed.`
- When a sentence ends on a name, the name takes its own line:

  ```
  You have defeated
  [The Hollow Monarch].
  ```

### Buttons

Buttons answer the window, so they change with what it says.

- A yes-or-no question gets **Yes / No**. "Would you like to enter the Gate?"
- A window that offers one act names the act: **Sell / Cancel**, **Allocate / Close**.
- A window that only reports gets one button, **Close**, or the open and dismiss icons on a
  one-line notice.
- A hold-to-confirm button names the act, then its progress, then the result: **Hold To
  Extract**, **Extracting…**; **Hold To Reclassify**, **Reclassifying…**, **Reclassified**; **Hold To
  Promote**, **Promoting…**, **Promoted**. A hold claims what cannot be taken back. The extraction button finishes on **ARISE** (see the exceptions), or on
  **Failed**, red and shaken, when the roll misses: a hold that can fail settles as it completes,
  so the button never lights green for an act that did not take.
- An app confirmation is the interface's (`confirm()`, kind `app`). A destructive act turns only
  its button red; the red frame belongs to another voice.
- Never ask the player to accept something the engine has already paid. Rewards are settled in
  `raid.finish` and on completion, so a rewards window reports; it does not ask.

### Templates

Each template gives its shape, the source line it comes from, and ARISE's version. `{…}` is filled
from the engine.

**Arrival.** Something has appeared for the player.

```
[{Type}: {Name} has arrived.]
```
Source: `[Daily Quest: Strength Training has arrived.]`
ARISE: `[Daily Quests have arrived.]` replaces "The System has issued you 3 contracts. They are
posted on the Gates screen. … The System does not punish what it did not get."

**Event with a name.** The player did something to a named thing.

```
You have {defeated | discovered | acquired | completed}
[{Type}: {Name}].
```
Source: `You have defeated [Knight Commander Igris the Bloodred].` `You have discovered [Rune Stone: Stealth].`
ARISE: `You have completed` / `[Secret Quest: {name}].` replaces the "Secret Mission Complete" window.

**State change.** A named thing changed.

```
[{Type}: {Name}] has {activated | failed | faded}.
[{Type}: {Name}] is not available.
```
Source: `[Skill: Shadow Extraction] has failed.` `[Effect: Paralysis has activated.]`

**One-line event.** Something happened with no name to carry.

```
[{Event}.]
```
Source: `[The Dungeon Boss has been slain.]` `[You leveled up!]`
ARISE level up, one line per level gained, then the points:

```
NOTIFICATION
[You have levelled up!]
Ability Points +{points}
                         Allocate   Close
```
replaces "You have reached Level 12. +3 attribute points are available for allocation. Unspent
points do nothing. Spend them."

**Not possible.** A reason, then the result. All red.

```
{Reason}.
[{Type}: {Name}] is not available.
```
Source: `The mana is contaminated.` / `[Job-Exclusive Skill: Shadow Extraction] is not available.`
`Your level is not high enough to buy from the store.`
ARISE: `Not enough MP. ({have}/{cost})` replaces "You have nothing left to reach with. Mana comes
back on its own — walk out of the next one with some."

**Counter.** A label, then the count.

```
{Label}: {n}/{m}
```
Source: `Number of extractions possible: 0/3` `Enemies killed: 7`

**Warning.** The consequence, flat, with only its key word red.

```
You will be {consequence}.
```
Source: `You will be transferred to the penalty zone.` `If this quest is not completed your heart will stop.`

**Offer.** A question the player answers.

```
Would you like to {act}?
                    Yes   No
```
Source: `Would you like to accept the job-change quest?` `Would you like to sell [Item: Raikan's Fang]?`

**Unlock.** A feature opening, in green capitals. ARISE's own; the source has none.

```
ACCESS GRANTED: {FEATURE}
```
ARISE: `[A Shadow has joined your army.]` / `ACCESS GRANTED: SHADOWS`.

**Rank line.** A rank shown on its own line.

```
{Rank} Rank
```
Source: `LV.7 Knight Rank` / `You may bestow a name.`
ARISE: `[{shadow}] has been promoted.` / `Bound Rank → Sworn Rank` replaces "PROMOTED — SWORN".

**Quest Info.**

```
QUEST INFO
[Daily Quests]
GOAL
{Goal.}                                 {n}/{m}
{Hint, smaller.}
REWARDS
┌──────────────────────────────────────────────┐
│ 1. Each quest: {shards} · XP +{n}            │
│ 2. All 3: {shards} · XP +{n}                 │
└──────────────────────────────────────────────┘
New Daily Quests in: {countdown}
```
Source: `[Daily: Collect Demon Souls! 3]`, a two-sentence brief, `GOAL`, numbered `REWARDS`.
ARISE's Daily Quests have no penalty, so the window has no warning line, and no line mentions
that there is none.

- **A goal is an order in the imperative:** "Clear 2 Gates of D-Rank or higher." "Defeat a
  Gatekeeper." Secret Quest goals read the same way.
- **A hint says where or how, flat:** `Found in: {places}.`, `Kills in any Gate count, cleared or
  not.`, `It is off the marked road.` A hint never explains why.

**The Quests screen.** One page, a log: Ryn's card, then a rail of rings, one to each quest that
stands, labelled `Ryn` (his face in it, in his blue: his job, `Report` once it is done), `Daily`, `Rank`, `Trial`, `Chosen`, `Weekly` and `Secret` under its count, a ring
filled as far as its quest stands, gold while it waits on the hunter and green once done; a ring
jumps to its quest. Then the quests in System frames: the Daily Quests, a line to each with its bar,
its count and its pay, and `Completion bonus` with the day's bonus (once all are done, the block
folds to its head, `Complete` in green where its count stood); `Advancement` (Reclassification,
the Trial, the Chosen); `Weekly` (the Pale Spire, its frame orange); `Record` (the Secret Quests, the
latest done and each tier's count). A quest's row carries its bracketed name and count, one line of
where it stands (`Reach Level 35 · XP needed: 7,073`), a bar, and its pay as chips (`Ability Points
+5`, `Reward tier: B-Rank`, `Masterwork: Legendary Off-Hand`). A row waiting on the hunter (a rank to
claim, the Trial open) is gold. Tapping a row opens the quest's QUEST INFO window in a sheet, gold
for advancement. Every quest's name wears its type, and these are the names:

| Quest | Name | Goals |
|---|---|---|
| The day's | `[Daily Quests]` | As above |
| The next rank | `[Reclassification: D-Rank]`, `[Reclassification: Sovereign]` | `Reach Level 10.` / `XP needed: {n}` |
| The Spire's week | `[Weekly Quest: The Pale Spire]` | `Clear Floor 36.` / `Floors 26-30 next.` |
| The next Ascension level | `[Trial: Ascension 4]` | `Clear all 3 S-Rank Gates at Ascension 3.` / `Win The Trial of Ascension 4: 5 of the Chosen in a row.` |
| The Chosen walking today | `[Chosen: The Iron Penitent]` | `Defeat [The Iron Penitent] in Revenant Gatehouse.`, the foe in red |
| Every Secret Quest | `[Secret Quests]` | Each one done, ticked: its name, `Goal: {goal}` and its reward under it, its tier at the side. The rest are one row, `?` / `Sealed: {n}` |

- **Inventory is a grid of these tiles** (`ui/bento.tsx`; Quests is a log, above; Shadows is a stage and Gates a radar,
  each rebuilt at the owner's call): Inventory (Status, Stats, Skills, Equipment, Inventory, the Exchange, the hunter's
  card). Gates, after the portals scattered over Solo Leveling: Arise's city: under the hunter's condition, the run
  left open as a stage card in gold (`[Revenant Gatehouse]` over its steps as diamonds and `3/11`, **Go Back In** at
  its right), the Practice Gate as the board's own stage card until it is cleared, then the day's Gates as a radar in
  the Gates' orange frame: rings with a sweep turning over them, the count large at the hub over `Open Gates` and
  `Redraw` with its countdown in gold, and a portal to each grade round it in its colour with its count under it,
  starred where a marked Gate stands, its letter dimmed with a lock badge beyond the licence and faded where none
  stands (read aloud `C-Rank: 3 open, one marked`); a tap on a portal opens GATES on that grade alone, and
  **View All Gates** under the radar opens it whole. Under it the hunter: `Grade` over `C-Rank` and `Gates up to
  B-Rank.`, its sigil in its grade's colour, and, from Ascension's grade, `Ascension` over the marks to set, `New` or
  `2/3` beside the level large in gold, gold while something waits; then the record as facts in one row,
  `Entered`, `Cleared`, `Taken` and `Unbroken`, a chevron at its right, opening the dossier. Shadows (the Army and
  the Orders; the Army is the screen's centre: the squad's slots over the reserve). The Army opens ARMY, a roster
  with a row to every Shadow, where the squad is made. On Gates, the hunter's condition is not a
  tile but a strip under Valcorde's line, in the System's frame: the Status sheet's HP, MP and FTG
  rows, each with its potion, so a potion is one tap from the board. A tile names a window's subject as a header word (`STATUS`, `GRADE`) or a
  name with its type (`[Gate name]`, `[Hunter: {name}]`), and opens that window. Two half tiles share
  a row; one left alone spans it. Valcorde's line keeps his own frame above the Gates screen.
- **The licence's window**, `LICENCE` (its number and its seal are on the licence, so the head names the window only
  and holds no icon: the owner's calls, after both stood twice), opens on the licence itself, as the Association issues it: the grade's seal in a ring,
  `Hunter` over the hunter's name and `Licence` over their number, the grade's letter vast and faint behind, the card
  washed in the grade's colour; under it `Association grade` and `Gates open` as facts, with no box. `Rank` stands
  beside them only where the hunter's own rank differs from the grade the board answers to (held at D-Rank without the
  Association Licence where it is sold, or Sovereign, graded S), and `Association Licence` only where there is one to
  hold: the owner asked what set the two apart, and on most hunters nothing does.
- **Ascension's window**, `ASCENSION` (the level is its dial, so the head names the window only), rebuilt at the
  owner's call after Slay the Spire's Ascension select and Hades' heat gauge: the dial, a crown over the level large in
  gold between two round arrows (`One level down`, `One level up`), the level's name in capitals under it (`The board
  as it stands` at 0), `Foe strength +53%` in red and `Gate pay +20%` in green, and `Highest opened 3` (past the ruled
  levels, `0` and `Highest` beside it to jump); then the card to the marks (below); then the next level as a challenge card,
  after the boss challenges of the reference games: its level locked in a dashed diamond with a lock, `To open
  Ascension 4` over `[Heavy Legs]` and its rule, then its road as a track of two round seals on a line, the Gates proved
  (a tick in green once done, `3/3`) and the Trial (its crown in gold while it stands open, `0/1`), each over its words,
  and **Face The Trial**; then `The climb` as a tower after Hades' heat gauge, battlements at its top and stone walls down
  its sides, a floor to each level opened down to the ground (`0`, `The board as it stands`), each its level in an arched
  window over its rule (`[Thin Rest]` over `A rest heals 50% of what it would.`), the floors in force lit gold from
  within, the floor entered at bannered `You`, a tap entering at a floor; past the ruled levels `[Beyond]` as one floor
  at the top. The marks in a window of their own, `MARKS` (the owner's call: at the foot of
  Ascension they sat oddly), opened from a card under the dial, `Marks` over `Set 2/20 · Upgrade limit: Perfect +3`, the
  five seals small under it and `1 to set` in its gold badge while one waits; in it, after Hades' Mirror of Night and
  Darkest Dungeon II's Altar of Hope, `Each set for good`: `1 to set` in a gold badge and `Set 2/20` at its head, then a
  seal to each mark, two to a row (the last alone across the row): its sigil in a diamond of gold, brighter for every
  set (the Edge's crossed blades, the Bulwark's heart, the Ward's shield, the Legion's Shadows, the Long Stride's
  steps), its sets as four diamonds under it, its name, what it gives now (`Each: Maximum HP +6%` while none is set),
  `Next: Attack and magic +8%` under it, and `Set` at its foot while a set waits, the whole seal tapped to set it (read
  aloud `Mark of the Edge, set 1 of 4: set it`). The offer to set one, `Would you like to set this mark?`, carries
  the seal before and after under its lines, the new diamond lit; its answer, `[Mark of the Edge] has been set.`, the
  seal as it now stands, stamped down, the new diamond landing.
- **A tile is the System's frame without a header.** It holds a picture of where the quest stands,
  the bracketed name, one line under it, and the count in a hairline box: `5/10`, `0/3`, `Closed`.
  A tile says nothing its window does not; the window holds the goals, the hints and the rewards.
  The picture is drawn from the engine, as the words are: the Daily Quests' own rows, the rank's
  sigils, the Spire's storeys lit to the week's best, the Trial's Gates and Chosen, the Secret
  Quests done drifting past with the sealed ones as `?`.
- **The Secret Quests' REWARDS are what they have paid.** The window opens the list with the
  source's `You got rewards.` and adds every Secret Quest held: `VIT +1 · AGI +1`, `Ability Points
  +1`, `Shadow slots +1`. With none held, the list is `-- --`. The tiers are fields under it:
  `CITATION:` / `3/18`.

- **A reward that opens something is the Unlock template:** `ACCESS GRANTED: CLASS`, `ACCESS
  GRANTED: ASCENSION 4`. A change is `{from} → {to}`: `Rank: C → B`, `Shadow slots: 2 → 3`.
- **A quest is never a new payout.** Each pays where it always did (a rank through its level-up
  window, the week through the Spire's reset), so the screen reports where it stands and never
  says "claim".
- **The Weekly Quest's goal is the next floor that raises the week's tier.** It is never done, only
  raised; under its rewards it reports the tier already reached: `This week: Floor 25 · Reward tier:
  C-Rank`.
- **Secret Quests stay sealed.** The window lists those done, with their tier, goal and reward, and
  counts the rest as `Sealed: {n}`; the tile shows them as `?`. Nothing names one that is not done.
- **The Trial and the Chosen are quests, and the Ascension card shows the road.** Their windows here
  report the proof, open the Trial and count the Chosen defeated (`Chosen defeated: {n}/{m}`). The Gates
  screen's Ascension card shows from S-Rank, before Ascension 1 is open: the level entered at, what it
  does to foes and pay, its rules, the road to the next level (the Gates to prove, then the Trial,
  and the rule it adds) and the marks. It reports the proof as the quest does and opens the Trial
  once it stands open, so a hunter on the card can see what Ascension asks without leaving it. It
  never counts the Chosen.

**Quest Rewards.**

```
QUEST REWARDS
You got rewards.
┌──────────────────────────┐
│ 1. Mana Shards +{n}      │
│ 2. XP +{n}               │
└──────────────────────────┘
                     Close
```
Source: `You got rewards.` / `1. Ability Points+5` in a box of its own / `Accept this rewards?`
ARISE drops the question: the engine has already paid, so the window reports. A run's results show
it under Quest Info when the run completed Daily Quests, with `Completion bonus included.` under the
list when the day's last one paid the bonus. `system.questRewards()` builds the window form. A
Secret Quest still reports its reward in its own completion window.

**Secret Quest.** The completion window.

```
NOTIFICATION
You have completed
[Secret Quest: {name}].
Goal: {goal}
Reward: {reward}
```
ARISE: `You have completed` / `[Secret Quest: Seven Straight].` / `Goal: Clear 7 Gates in a row
without being carried out.` / `Reward: AGI +1`. A reward is a stat or a count and its sign:
`STR +1 · VIT +1`, `All stats +1`, `Ability Points +3`, `Shadow slots +1`.

**Cards.** Items, skills, classes.

```
{TYPE}: {Name}
{FIELD}: {value}      {FIELD}: {value}
{What it is, in one sentence.}
{How it works or what it needs, smaller, if it needs saying.}
- Effect '{name}': {what it does}
{Condition}: {EFFECT +N%}
```
Source: `ITEM: Purified Blood of Demon Monarch`, `ACQUISITION DIFFICULTY: -- --`, `CATEGORY: Material`,
a one-sentence lead, a smaller detail paragraph. `[Title: Wolf Assassin]` / `A title given to those
skilled at hunting wolves.` / `Animal-Type Monsters: ALL ABILITIES +40%`.
A value the player has not found yet shows as `?`; an empty one shows as `-- --`. Never an
explanation.
ARISE class: `CLASS: Brawler` / `A class given to hunters who fight with their hands.` / `STR +2` replaces
"Your fists speak the oldest battle-language, and every blow writes it in bone."

**Card text.** Every card is the System's, so its description is flat too: no jokes, no opinions,
no Valcorde. What it is, where it comes from, one physical fact if it matters, and what can be done
with it.

```
{A thing} {issued by | made from | found in} {source}. {One fact.} {What can be done with it.}
```
Source: `A dagger made from Rasaka's fang. Able to paralyze due to leftover venom. Can be equipped,
stored or sold.` `This key unlocks the door to the Demon's Castle. You can acquire this only when
you kill the gatekeeper.` `A large and sharp fang of a Raikan. You can keep it in your inventory or
sell it in the store.`

| Item | Was | Is |
|---|---|---|
| Hunter Recruit Shirt | Association grey, reinforced at the shoulders, and issued in one size that fits nobody. Every hunter alive owned one of these first. | A shirt issued by the Hunter Association. Reinforced at the shoulders. |
| Hunter Recruit Trousers | Hard-wearing, unflattering, and cut for crouching in. Valcorde will tell you the last part is not an accident. | Trousers issued by the Hunter Association. Cut for crouching. |
| Hunter Recruit Boots | Flat, stiff, and honest. You will feel the ground through them, which is the only thing a boot has to do. | Boots issued by the Hunter Association. Thin-soled. |
| Training Shield | Battered plywood over a steel rim, and heavier than it looks. Handed out because a recruit who has never held a shield puts it in the wrong place. | A training shield of plywood over a steel rim, issued by the Hunter Association. |
| Training Sword | Blunt, nose-heavy, and deliberately worse than a real blade. Valcorde issues it with the licence and tells every recruit the same thing: the sword is not the point, the swinging is. | A blunt training sword issued by the Hunter Association. |

### Worked example: extraction

The panel after a clear, in a violet frame.

| | Now | System |
|---|---|---|
| Offer | "The power from the **{foe}** you just defeated is lingering… It wants to continue to fight — under your command." / "Reaching for it costs **60 MP** (you have 140). It holds 34 times in 100, read off your Intelligence." | The rank and the name, then `The mana of [{foe}] lingers.` / `Attempts left: 3` / `Extraction cost: 60 MP`. The odds are not shown here; the Guide states them |
| No mana | "You have nothing left to reach with. Mana comes back on its own — walk out of the next one with some." | `Not enough MP. (40/60)` |
| Failed, reaches left | | The rank and the name, then `The mana of [{foe}] still lingers.` / `[Skill: Shadow Extraction] has failed.` / `Attempts left: 2` / `Extraction cost: 120 MP`, those three in red / `Hold To Extract Again`. No multiplier and no MP held: the cost is the number that matters, and MP held shows only when it falls short (`Not enough MP. (100/120)`). Its alert on the results: `The mana of [{foe}] still lingers. Attempts left: 2` |
| Failed, the last reach | "The shape thinned, came apart, and went wherever the rest of them go. A higher INT makes them hold." | `[Skill: Shadow Extraction] has failed.` / `The mana has dispersed.` (all red) |
| Bound | "SUCCESSFUL EXTRACTION — {shadow} answers to you now." | `Extraction successful.` / `[{shadow}] has joined your army.` |

The odds, and that INT raises them, are rules, so they go in the Guide, and so does why the cost
doubles: the sheet shows the attempts left and the cost, never the odds or the reason.

### The fight log

The fight log is the System keeping score, in the register of the source's combat messages
(`[Effect: Paralysis has activated.]`). It is read mid-fight, so it is short and exact.

```
◆ Ghoul: Grave Strike → You -12
✦ Ghoul: Grave Strike → You -24 (Critical)
○ Ghoul: Grave Strike → You. Missed.
✴ You: [Effect: Bleeding] has activated.
● Ghoul HP -6 (Bleeding)
✖ Ghoul has fallen.
◈ You: Cover → Jaemin Nam. Foes turned: 2.
◆ You: Flash Vial → Ghoul.
✦ Goblin Chief: Rally. Its side: [Effect: Emboldened].
✦ Grave Warden: Shield → Ghoul.
◇ Ghoul Ravager: Ravager Claws. 1 to go.
✴ Ghoul Ravager: [Broken]. Its move is lost.
▸ Goblin Raider: defeated while Stunned. Monster Bone +2.
▸ [Goblin Den] cleared. Rounds: 4. Standing: 3. Condition: Grazed.
```

- **Actor, colon, act.** `{Who}: {Ability} → {Target} -{damage}`. No verbs of flourish ("swings",
  "finds nothing", "the line is rallied").
- **Damage and healing are signed numbers.** A status is a bracketed effect.
- **The glyph at the front is the event's kind**, so a line can be read at a glance.

### The assessment

The brief's verdict is the System's assessment of the Gate, graded from the clear rate of its 24
runs (`GRADES` in `core/raid.ts`): **Safe, Likely, Even, Unlikely, Lethal** (`Likely` and `Unlikely` were `Favourable` and `Unfavourable` until the owner shortened them).

```
Assessment: Safe
Clear rate: 96%
```

The rate is a percentage of those runs, never a count of them. It is the one number the
assessment gives; how often the hunter is carried out is left to the grade. It reports the grade and the
numbers. It never says what the party "will" do, and it never
explains how it ran the Gate; the Guide does.

### Screens

The System's recurring screens, laid out the way the source lays them out, in the frame from
[The look](#the-look). Every field reads the engine.

**Item card.** The gear sheet (`openItem`).

```
[icon]  ITEM: {name}
ACQUISITION DIFFICULTY: {rank}-Rank      CATEGORY: {slot}
RARITY: {rarity}                         QUALITY: {quality}
SCORE: {score}                           SET: {set, or -- --}
{Card text.}
[STR icon]  STR +3
[+]         Status Chance +4%
{Upgrade, the set and its bonuses, Equip, Recycle}
```
Source: `ITEM: Castle Door Key` / `ACQUISITION DIFFICULTY A-rank` / `CATEGORY Key`, a plain
description, then green stat lines with icons (`AGI +20`, `PER +20`, `Physical Damage -20%`).
The rank is the acquisition difficulty and the slot is the category. Each stat takes a line of its
own, in green, with its stat's icon; a property takes a plus. ARISE adds rarity, quality, score and
set as fields, because a hunter compares pieces by them. The item's art heads the card, large and
framed by its grade, so the header has no icon box beside it (the gear overhaul: the art twice read as
clutter). The same card holds a Shadow (`Shadow: {name}`, its rank plate in the icon box).

**Purchase.** The Exchange and potions.

```
Would you like to purchase?
[Item: {name}]
{What it gives, green for stats.}
Price: {price} Mana Shards · Held: {balance}
                     Cancel   Buy
```
Source: `Would you like to purchase?` / `[Knight Killer]`, the icon, a quantity, the price, `CANCEL`
/ `BUY`, and the balance in its own box. When the balance is short, the window is the Not possible
template: `Not enough Mana Shards. ({have}/{price})`. Prices and balances of 1,000 or more take
their comma.

Every purchase with Mana Shards asks first: blueprints, potions and the Gate Survey
(`Every room of a Gate's map, through the fog.` under its tag). A blueprint
names itself `[Item: Blueprint: {name}]` and its rarity and kind; bought, `You have acquired`
`[Item: Blueprint: {name}].`, with `Open Blueprint`. A Health or Mana Potion bought at the Exchange
is carried, and its button is **Buy**: `Health Potion · Satchel 3/3`, `Mana Potion · Held: 2`. Any other
potion, or a Health or Mana Potion bought from the HP or MP bar with none held, is drunk as it is
bought, so its button names both acts: **Buy and Drink**. A Google Play purchase (shard packs,
the Licence) uses Google Play's own confirmation, not this window. After a purchase the System
reports it: `You have acquired` / `[Item: {name}].` / its stats in green.

**Exchange.** The shop the purchase window opens from.

```
                 EXCHANGE                    [close]
MANA SHARDS: {balance}       NEW STOCK IN: {countdown}
POTIONS                              Always in stock
[icon]  {Name}
        {What it gives, green}
        {Card text}                         ◆ {price}
FOR THE GATES                        Always in stock
[icon]  Gate Survey
        Charts every room of a Gate's map
        Used from a Gate's brief, or inside it. Held: {n}   ◆ {price}
BLUEPRINTS                             Left: {n}/{m}
[icon]  {Name} ▲
        Blueprint · {Rarity} {Slot} · {Set}
        {Stats} · {Properties}               ◆ {price}
```
The shelf sells blueprints, not gear: gear is forged. ▲ marks a blueprint rarer than what is worn
where it goes. A blueprint already known shows `Known` where its price would be.
Source: a list of rows, each in its own box: the item's icon in a box, its name, its price at the
foot of the row (`Knight Killer` / `2,800,000G`). The whole row is the button: tapping it opens the
purchase window, or the Not possible window when the balance is short. A row that cannot be bought
(`Bought`, `Satchel full`, `Full`) shows why where its price would be. The balance and the
restock sit in boxes of their own at the top.

**Change.** A skill, a class or a Shadow moving up.

```
SKILLS
Skill level increased.
{name}  Lv.1  →  Lv.2
```
Source: `SKILLS` / `Skill level increased.` / `Dash Lv.1 → Lv.2`.
ARISE class, the first time: `Class assigned.` / `[Class: Brawler]` / `STR +2`. After that:
`Class changed.` / `Brawler → [Class: Berserker]` / `STR +5`. "Changed", because spending
differently can move a hunter sideways to another line, not only up.
ARISE Shadow: `[{shadow}] has been promoted.` / `Bound Rank → Sworn Rank`.

**Status.** The hunter's sheet, opened from the Inventory screen's Status and Stats tiles, the rank
plate in the top bar, and a level-up's Allocate.

```
                 STATUS                  [dossier]
NAME: {name}                LEVEL: {level}
CLASS: {class}              RANK: {rank}
HP       {hp}/{max}         [potion]
MP       {mp}/{max}         [potion]
FTG      {fatigue}/100      [potion]
STR {n}   VIT {n}
AGI {n}   INT {n}
PER {n}   ABILITY POINTS: {n}
```
Source: `NAME`, `LEVEL`, `JOB`, `FATIGUE`, `TITLE`, `HP`, `MP`, the five stats, `REMAINING POINTS`.
`JOB` is `CLASS`. ARISE has no titles, so `RANK` takes that place. Fatigue sits with HP and MP as a
bar, because it falls over time and a potion lowers it. Tapping the class opens Skills.

**Skills.** The skill tree, in the System's cyan frame. A box for the class (`[Class: {name}]`, its
stat bonus) beside one for `SKILL POINTS`, which turns gold with its lit `+` mark while a point has
somewhere to go. Then the five Paths as a constellation around the hunter, their points at its
centre (`17` / `POINTS`), each arm named for its Path with its stat and the points spent in it
(`RUIN` / `STR · 13`), and a ring for each rank, lettered and lit once it is held. Then `SKILL SLOTS`
(`3/3`), a hairline box to each slot with the skill's mark, name and `Lv.2`, or `-- --`. Then the
chosen Path's box (`[Path: Ruin]`, its line, `SPENT 13`) and its tree, tier by tier under
`D-RANK` to `S-RANK`, each tier shut with what it waits for: `Opens at B-Rank`, or
`Points in Ruin: 5/8`. A node is a hexagon for a skill, a diamond for a passive and a circle for a
stat, with its counter (`2/3`) and its slot number when it is taken into fights.

Colour follows CLAUDE.md: learned is the System's cyan, Lv.MAX is cyan nearly white, and a node that
can take a point is gold, because it waits on the hunter. A node shut is slate; a fork's sealed half
is struck through.

The card of the node tapped sits at the foot of the sheet. Nothing is chosen when the sheet opens or
the Path changes, so the card shows only once a node is tapped, and a second tap puts it away. It reads `SKILL · Ruin · D-Rank`, the name,
`Lv.2/3`, what it does now (`Physical ×1.25 · One target`), what the next level adds in green
(`Lv.3 (MAX): ×1.35 · Inflicts Staggered`), and why it takes no point, as a report:
`Requires: [Might]`, `Sealed: [Blood Up] is held.`, `Skill Points: 0`. A point spent is reported on
the card, as the source reports a skill:

```
[Skill: Hammerblow] acquired.
Skill level increased.
Hammerblow  Lv.1  →  Lv.2
```

A skill that does no damage reads as what it does: `Every foe · Inflicts Weakened · No damage. Never
misses`, `Every foe's next action goes at you. You guard until your next turn`, `The whole party: HP
+15%`. In the fight log a curse is its name alone (`✦ Hunter: Dread Roar.`) with the statuses after it,
a taunt counts what it turned (`Foes turned: 3.`), and a heal gives each HP back on its own line.

Its buttons: `Learn` for a node's first point, `Level Up` for every point after, and for a skill
learned `Equip`, `Unequip`, or `Swap In` when every slot is full, which lights the slots in gold for
the hunter to pick one. Under it, the passives learned as boxes, then `Auto Assign` (gold, while a
point has somewhere to go) and `Reset`, with its price once the free one is spent. Both ask first,
as a purchase does: `Assign every Skill Point?`, `Reset the skill tree?` / `Skill Points returned: 13`
/ `Price: …`.

**Equipment.** The ten slots as squares, five down each side of the hunter's figure, each the piece's
art with its slot set small under it (`HEAD`), or a dashed square with the slot's sign when it is
empty; a line runs in from each toward the figure, which wears what is worn: each slot's part of it
lit in its piece's rarity (a sword in one hand, a shield at the other, a ring on each hand, the pendant).
Above them the score in its hexagon and the slots filled as diamonds; under them Auto Equip, lit gold
when it has something to improve (its slots carry a gold ▲), what is worn adds, each set worn as a row
(`Warden`, `2/3`, its bonuses lit once worn), and the loadouts as rows. Every slot opens
`EQUIPMENT: {Slot}`: what is worn there and everything held that could take its place, the names left
to that window and the item's card, as the reference games leave them to the tooltip.

**Inventory.** A grid of icons under tabs, with the count of what is held, opened from the Inventory
screen's Inventory tile. The tab is named for it.
Source: tabs `All`, `Equip`, `Actives`, `Ingred.`, `Quest`. ARISE holds only gear, so the tabs are
`All · {count}` and the slots. Each square is the item's icon in its grade's frame, its score, and
`WORN` when it is worn; the item card holds the rest.

## Valcorde

### Who he is

Ryn Valcorde, sixty-one. **C-Rank**: a working hunter's grade, not an elite one. S-Ranks don't run
training courses. Thirty years in the Gates, all of them independent. He never joined a guild, and
the hunters who know him say one would have taken him if he'd been twenty years younger.

He boxed before he Awakened, and the Awakening made him a Warden: built to stand between people and
harm, not to throw the punch. He decided that meant something.

Twenty years ago he led ten hunters into a Gate posted as D-Rank. It wasn't. He didn't wait for the
Association to reassess it, because the pay was good and he was sure. At hour six he was the only
one still moving, and he carried three of them out. He kept the ruined knee from that day. The
healers have offered to fix it and he says no. He doesn't lead raids anymore. He won't retire
either, so the Association gave him Hunter Training, and he spends what he has left keeping new
hunters alive.

He is modelled on Song Chi-Yul from the source: the veteran mid-rank hunter, the leader's guilt kept
as a wound, the warmth under the sarcasm, the choice he never forces, the friend who notices and
doesn't pry. None of Song Chi-Yul's own story is used: no kumdo, no lost arm, no temple, no named
people.

### How he is

- **Lively and sarcastic, warm underneath.** He jokes about himself, the Association and the
  situation, never about the hunter.
- **He cares, and it shows in what he does:** he signs you in, he stands in front, he tells you to
  let the medics do their job.
- **He prefers a plan** (read the brief) and knows hunters go in anyway.
- **He never forces.** He gives his judgement and leaves the call: "Your call, but I'd rest before
  the next one."
- **He carries his failure without self-pity.** He tells it once, plainly, when you've earned it.
- **He notices the hunter changing faster than anyone should, and chooses not to ask.** He protects
  them: "Keep it to yourself. People talk." He never learns about the System.
- **As the hunter passes his grade, he stops teaching and starts watching**, proud and a little
  worried.

### How he speaks

1. **Contractions by default.** He talks like a person: "It doesn't go up." The System never
   contracts, and the contrast is part of how a player tells them apart. He drops a contraction
   only for weight, at most once in a scene: a warning, or the line he means most. His last message
   reads "Do not go in tired."
2. **Short spoken sentences, plain words.** Two or three lines a window. No speeches.
3. **Judgement, not rules.** He says what matters and what gets people killed. Numbers and mechanics
   belong to the Guide and the interface. "Watch the bottom bar. Fatigue. It builds with every
   Gate, and it's what kills hunters at your grade."
4. **Concrete over clever.** A detail from his own past beats a maxim: "I've been carried out too.
   More than once."
5. **Humour is a passing aside inside a line** ("three of them are paperwork"), never the last word
   of a scene.
6. **He says "you".** No pet names.
7. **No catchphrases.** Once he has said a thing, he finds a new way to say the next one.
   "Read the brief" is said once, in the handover. No four-word phrase appears in two of his
   lines, and no sentence opener ("That's…", "Sit down.") more than twice. Repeated phrases wear
   thin long before contractions do.

### He never

- mentions the System, its windows, Ability Points, Daily or Secret Quests, or the Player.
- recites rules, numbers or percentages the Guide holds.
- ends on an aphorism, a "not X but Y", or a triad ("Not the strongest. Not the best kitted.").
- orders the hunter, except to get them out of danger.
- explains the hunter's growth. He sees it and leaves it alone.

### His lines

| Was | Is |
|---|---|
| Before you ask: it does not go up. An Awakening fixes your rank for life. Anyone selling you otherwise is selling you something. | Before you ask, it doesn't go up. An Awakening fixes your rank for life. I've watched people spend a fortune trying to change that. |
| Your power is fixed. Your competence is not. Only one of the two is decided for you. | I'm Valcorde. I run Hunter Training. C-Rank, thirty years in, and not retired, whatever the Association would prefer. |
| Health and mana carry between runs and come back on their own, about five per cent an hour. Fatigue builds with every Gate and drags everything you are worth down until it fades. | Watch the bottom bar. Fatigue. It builds with every Gate, and it's what kills hunters at your grade. |
| Read the assessment next time. It was not lying. | I've been carried out too. More than once. |
| Not the strongest. Not the best kitted. The one who had paced himself, and had something left when the walls came in. That is the whole trade. Everything else is decoration. | At hour six I was the only one still moving. I carried three of them out. That's the knee. I've never let the healers fix it. And it's why I don't lead raids anymore. |

### His arc

| When | What he says |
|---|---|
| The Awakening Assessment and the handover | He assesses you, licenses you, introduces himself, and takes you through the Practice Gate |
| 3 Gates cleared | When to stop for the day |
| The Pale Spire opens | What it is, and how far he once got |
| First time carried out | He's been there |
| C-Rank, his grade | It took him eleven years. He won't ask how you did it |
| Level 25 | The real version of his last raid |
| S-Rank | One message, delivered by the System: "Do not go in tired. Go in with something left." |

Every line he says lives in `src/data/narrative.ts` (`ASSESSMENT`, `NAME_PROMPT`, `HANDOVER`,
`GATES_LINE`, `GATES_TOUR` and the `coach` beats), so the tests read all of it.

In the Practice Gate he fights in your party at C-Rank, holding back (`INSTRUCTOR_RESTRAINT` in
`core/gates.ts`) so the kills are yours.

## The interface

The app itself: buttons, labels, tabs, hints, toasts, empty states, results, the brief, tutorials,
settings and the Guide. It has no character. It says what is true and what to do, plainly, and gets
out of the way. The art, the System and Valcorde carry the mood.

### Rules

1. **Plain facts.** A result says what changed: "Goblin Embercamp is closed. A new D-Rank Gate has
   opened on the board." No atmosphere, no commentary.
2. **An empty state states the fact and stops:** "No Shadows yet." "Nothing logged yet." How to
   fill it is the Guide's job.
3. **Gains are written name first, like the System:** "Mana Shards +40", "Health Potion · Satchel
   2/3", "Health Potion · HP +120".
4. **A hint says what to do in one line:** "Tap a step that glows." A rule longer than a line goes
   in the Guide.
5. **A refusal or limit is a fact:** "Your licence does not cover C-Rank yet." "Locked out until you
   recover." No character speaks in a toast.
6. **Buttons name the act:** "Enter The Gate", "Recycle", "Buy". Title Case in the code; the style
   sets the capitals on screen.
7. **The interface may name the System as a thing:** "The System ran this Gate 24 times."
8. **A tutorial is the interface teaching**, short and direct: "Tap a foe to aim at it, then act."
9. **No contractions.** The interface is as plain as the System, without its stiffness; Valcorde is
   the only one who contracts.
10. **A label opens with a capital**, a section's right-hand label included: "Redraw: 03:55:45",
    "For allies and Shadows", "The party's". Only the game's own terms keep a capital inside it
    (see [Words](#words)).
11. **A screen shows a number once.** If a tile already shows it, nothing beside it repeats it: not
    a tile's sub-label, not a section header, not a notice. On Shadows, Bound is every successful
    extraction, so the Extractions tile does not add "3 successful", and the list header does not
    add "3 commanded".
12. **A range is written with a hyphen, everywhere, the System's text included:** `30-50`, `Floors
    26-30`, `PER +1.5-2.5`, `9-13%`, `by grade, E-S: 10-110`. Never `30 to 50`, and never a dash; a
    sign and a unit are written once. Only a screen reader's label says "to" (`aria-label`).
    `tests/voice.test.ts` refuses a range written with "to".

| Was | Is |
|---|---|
| Goblin Embercamp cleared. The Gate begins to close, and another of its grade opens on the board. | Goblin Embercamp is closed. A new D-Rank Gate has opened on the board. |
| The party was carried out. The Association medics will not let you back in for a while. | The party was carried out. You are locked out of Gates for 12 hours. |
| No Shadows have followed you home yet. Keep clearing Gates. An extraction is rare, and rarer still if you are out of mana when it offers. | No Shadows yet. |
| `+40 Mana Shards.` | `Mana Shards +40` |
| Licence issued. The Association reads your real grade now. | Licence issued. Gates above D-Rank are open. |
| Nobody who has come back out has said. | `?` |

### The Guide

One fact per line, numbers up front, scannable like a manual. Each topic is a list (`TOPICS` in
`screens/Guide.tsx`). Every number reads the engine's constants. A line that explains two things is
two lines.

```
LEVELS, RANKS AND STATS
- A clear pays XP by grade: 6 at E to 50 at S.
- The first clear of each Gate pays double.
- Withdrawing pays a share of what you cleared. Being carried out pays a little.
```

## The world

The world speaks in two registers, one on each side of the Gate.

### Outside: the Association's file

The brief shows what the Association has on file for a Gate (`theme` in `data/dungeons.ts`,
`data/special.ts` and `data/spire.ts`). It reads like a field record: dry, factual, terse. The
Trial has none: it is the System's, and the Association does not know it exists.

1. **The site, then what holds it.** A fragment naming the place, then its occupants or its
   threat: "Collapsed burial storage. Undead scavenge among broken ossuaries."
2. **Two or three short sentences.** Fragments are fine. Field labels are fine: "Threat:
   contained."
3. **No "you".** The file was written before the hunter arrived and doesn't know who's reading it.
4. **Tactical facts are welcome; feelings aren't.** "Hostiles tempt, curse and weaken." tells a
   hunter what to expect. "Terrifying" tells them nothing.
5. **Menace by omission.** The special Gates get the same flat file, and the menace is in what the
   file can't say: "Density: beyond measurement. Entry: S-Rank. Parties sent: 4. Parties
   returned: 0."

### Inside: the narration

Map events, traps, caches, shrines and rests (`data/nodes.ts`) are narrated as they happen.

1. **Second person, present tense, close.** "Light leaks through a crack in the wall. Something
   glints on the far side, within reach."
2. **What you see and what happens. No commentary.** "The dungeon does not usually offer anything
   for free" is out.
3. **No punchlines.** An outcome is one or two plain sentences: "The seam closes on your arm. You
   pull it free." It never ends on a joke ("You get your arm back, most of it.").
4. **The cost or the gain is a System line under it**, built by `system.outcome()`: `HP -25%` in
   red, `Mana Shards +18 banked` in green, `[Item: …] banked`, `[Blessing: …]`, `[Debuff: …]`.
   The narration says what happened; the System says what it was worth.

| Was | Is |
|---|---|
| A collapsed training cellar the Association keeps shut. Nothing in it is dangerous, which is the only reason a hunter is allowed in on their first day. | Collapsed training cellar, kept shut by the Association for first-day licences. Threat: contained. |
| A Gate of impossible density. Every hunter who ever stopped climbing is in here, and it has been waiting for you specifically. | Density: beyond measurement. Entry: S-Rank. Parties sent: 4. Parties returned: 0. |
| The seam bites down. You get your arm back, most of it. | The seam closes on your arm. You pull it free. / `HP -25%` |
| It does not give. Your shoulder does. | The bands hold. You wrench your shoulder. / `HP -10%` |
| Mana Shards, wrapped in a licence nobody will be renewing. | Mana Shards, wrapped in its owner's licence. / `Mana Shards +18 banked` |

## Words

| Say | Not | Note |
|---|---|---|
| Notification | Alarm, Notice | The default System window header |
| Daily Quest | contract | Code keeps `contracts`; only the words change |
| Secret Quest | Secret Mission | Code keeps `missions` |
| Weekly Quest | season, weekly contract | The Pale Spire's week, on the Quests screen. Code keeps `season` |
| Association Quest | job, contract, task | One of Ryn's jobs for the Association. He calls each a job; the screens call the line Association Quests |
| Health Potion | Field Potion, field potion | The one healing potion: carried in the satchel, drunk on the hunter's turn in a fight, between rooms from the bag, or out of a Gate. There is no Field Potion any more; Ryn may still call one a flask |
| Items | bag, inventory, quick menu, wheel, radial (on screen) | What the hunter carries into a Gate, in the bag at the dock's right on the map and its wheel. Its label is `Items`; its glyph a satchel, not the Inventory's bag |
| Gate Survey | scout, survey report, map item | The Association's report that charts every room of a Gate's map, from its brief or inside it. An item: `[Item: Gate Survey]`. Charted, not mapped or revealed |
| Event | Unknown, `?` (for a room) | A room holding a choice, or a trap, a cache or a rest passing for one. Its mark is a signpost, in orchid. `?` is only the fog's |
| Floor | level, depth, storey (in a Gate) | A Gate's floors, `Floor 2/3`, joined by `Stairs Down` and `Stairs Up`. The Pale Spire's numbered floors are the same word: each is a floor of the tower |
| Unseen | Unknown, fogged, hidden (on the plan) | A room in the fog, and the map key's word for it |
| Reclassification | rank-up quest, job change | The quest for the next rank, as the rank windows say: "Reclassification approved." |
| Inventory | Profile | The tab with Status, the equipment and everything held. Code keeps the route `inventory` |
| Ability Points | attribute points, stat points | Code keeps `points` |
| stats | attributes | STR, VIT, AGI, PER and INT, as the source says it: "All stats -50%" |
| Player | | The System's name for the hunter. No one else uses it |
| Gate | gate | Capitalised everywhere, as a game term |
| Room | step, node, cell (on a Gate's map) | A Gate's map is rooms joined by corridors. The plan's only numbers are a room's moves, on the Gate clock; a fight's head keeps `Chamber 4`, counted from the entrance out. The Pale Spire and a Trial are climbed by floors, and their hint keeps "step" |
| move | step, turn, action point (on a Gate's map) | What the Gate clock counts: entering a room, or a corridor walked back through cleared rooms. Never shown as a count, on the brief or inside (the owner's call): the Guide says what a move is, and the stirring what going past the budget does. A fight has turns, never moves |
| budget | timer, limit, allowance | A Gate's moves before it stirs, 120% of its rooms. The Guide's word; nothing shows it, and the Guide gives no figure for it |
| stir, Stirring | heat, alarm, danger, corruption | What a Gate does past its budget: every creature not yet fought grows stronger. `[The Gate is stirring.]`, the meter's `Stirring` |
| Red Gate | red gate, Crimson Gate, turned Gate | A Gate that ran too far past its budget: it turns red, and its way out seals until the boss falls. Capitalised as Gate is. The anime's own term; see "Names from the source" |
| Vault | treasury, locked room | The Gatekeeper's sealed room. Sealed until the Gatekeeper falls; the System never says what opens it, the Guide does |
| Shadow | shadow | Capitalised everywhere, as a game term, like Gate |
| Awakening, awaken | limit break, star up, ascend | What Shadow Essence buys an Ascendant at its cap: a star, `★`, five in all. `[Igris] has awakened.` |
| Forge, forge | craft, make, smith | Making a piece from its blueprint: the Forge button reads `Forge`, a piece made is "forged". Fusion is gone: there is no word for feeding one item into another |
| Blueprint | recipe, schematic, diagram, plan | What a design is forged from, known for good once learned: `Blueprint: Mythic Shortsword`. Its card's materials are "Required materials" |
| materials | components, ingredients, resources, mats | Everything a recipe takes: the alloys, the parts, the trophies and the Ember. Each has its own name, `Mana Silver`, `Monster Bone`, `Demon Lord Trophy`, `Ascendant Ember` |
| alloy | ingot, ore, metal | The material of each rarity, Iron Scrap to Sovereign Steel. "Alloys" heads its row |
| Familiarity | affinity, mastery, proficiency, weapon XP | What a weapon's design grows by the creatures defeated while it is carried: `Familiarity 3`, `Familiarity points: 150/260`. It belongs to the design, never the piece |
| found whole | dropped, looted | A piece a run left as a piece, not as a blueprint: rare. "A piece found whole" |
| Loadout | build, preset, outfit | What was worn, saved: `Loadout I`, `Loadout II`, `Loadout III` |
| Crit chance | critical chance, critical hit chance | The chance a hit is critical, the owner's word: `Crit chance +6`, `Crit Chance +9.8%` on a piece, `Crit chance` on Stats. A hit that is critical keeps its name: `Critical hits inflict Bleeding`, `(Critical)` |
| New | unseen, fresh | An item in the bag the hunter has not looked at yet |
| Shadow Essence | essence, shards, souls | Spent on a Shadow's promotion. In System text always in full, as Mana Shards is; a label may say "Essence" where the line already names it |
| defeat | fell (in any form: fells, felled, felling), kill, slay | What the party does to a creature, a Gatekeeper, a boss or one of the Chosen, in every line a player reads: `Defeat the boss`, `Defeat 3 Orc creatures.`, `Defeat it while Stunned: Monster Bone +2.`, `Creatures defeated`, `Defeats it` in the action wheel's hub. The owner's call; `tests/voice.test.ts` fails on any fell in a string, a template or markup. A key the save holds (`felled`, the Daily Quest kind `fell`) keeps its name |
| special drop | condition drop, bonus drop | What a creature leaves when it is defeated the way its condition asks: its family's part, or a boss's blueprint. `Special drop` on a creature's card and a fight's tip, `[Special drops]` on a run's results. The condition is still its condition (`the way their condition asks`). The owner's call; `tests/voice.test.ts` fails on a condition drop in a player's text |
| a tip's colours | | Every tip a creature's line or a fight shows is coloured as the reference games colour theirs (Slay the Spire's "Take 50% more damage from Attacks for 1 turn."): its figures in the System's blue, its statuses (`Stunned`, `Broken`, `Veiled`) and stats (`Attack`, `HP`, `defence`) in gold, the rest as it stands; a habit's name over its paragraph in gold; a reward in green. `Keyed` in `ui/keyed.tsx` does it, reading the statuses from the engine. The owner's call |
| a special drop's condition | Defeat it while…, with your own blow, with a Shadow's blow, yourself | Framed by the final hit, as the owner asked: `Land the final hit` where the hunter's own hit must defeat it (`Land the final hit.`, a boss's `Land the final hit while it is Broken.`), `The final hit lands` where anyone's counts (`The final hit lands while it is Stunned.`, `The final hit lands within 3 rounds.`), `A Shadow lands the final hit.` for a Shadow's. Then the pay after a colon in a fight's tip (`Land the final hit while it is Broken: Blueprint +1.`). In the feed, after `defeated`: `by your blow`, `by a Shadow`, `by your blow while Broken` (`▸ Goblin Trapper: defeated by your blow while Broken. Blueprint +1.`) |
| landmark | set piece, point of interest, POI | A named room of the family that leads a Gate, one to a floor, seen from the start: its own name on the plan (`Ossuary`) and a choice inside. `Landmark` is the Guide's word for the kind |
| secret | hidden room, bonus room | A hidden passage and what it hides. Noticed, never revealed or detected; `Secrets 1/2` on the plan, `Secret` on a cache found behind one. A Survey charts them |
| toll door | toll gate, blood door, paywall | A corridor sealed in red that opens for good for a share of the hunter's HP: `Would you like to break the seal and open the room?`, **Yes · HP -289**, `The seal breaks.` |
| deep | far, remote, off-path | A room two corridors or more off the road, or behind a Gatekeeper, a secret or a toll door. The Guide's word |
| Kin | synergy, set bonus, alliance, trait, bond | Two deployed Shadows of one family and more: `Orc Kin` on a card and in its tooltip, `Kin: Orc II` under the brief's party. Its breakpoints are written as Teamfight Tactics writes them, `2 › 3` once reached and `1 / 2` while short, and each in its tooltip in brackets, `(2) Attack +10%`; its tiers `I` and `II`. What it gives each Shadow of the family is its boon, the Guide's word (`the family’s boon`), never said by the System |
| Formation | aura bonus, role bonus, composition | What the roles deployed give together: `Formation` over the Army's chips, `Formation: Initiative +4 for you and every Shadow` on a card, `Formation: Brute, Caster` under the brief's party. Each role's share is its aura, the Guide's word |
| Kin to every family | wildcard, joker, any family | The Aberration's line, on the Army and its card. The rule it stands for (counts in every family beside it, takes every boon it completes) is the Guide's |
| blessing | boon, buff, perk, relic | What a shrine gives for the rest of a Gate: one of the five Paths' (`data/blessings.ts`), each at a tier. `[Blessing: Rending Strike II]` |
| tier | rarity, level, rank (of a blessing) | A blessing's strength, `I`, `II` or `III`, in pips and its numeral; `Tier I → II` at a Font. Gold, as advancement is, never a rarity colour of its own |
| Duo, Capstone | Legendary, synergy, combo | A Duo belongs to two Paths (`Duo · Ruin + Tempest`); a Capstone needs two of three named blessings of its Path (`Capstone · Ruin`) |
| Font | Deepen, Pom, upgrade room, well | The room that raises one blessing held a tier. Its name on the plan and its panel's head |
| Heal, Hone, Steady | Rest, Smith, Lift, Upgrade, Recover | A rest's three ways, as its tiles name them. Hone raises a skill a level for the Gate; past Lv.MAX it reads `Lv.MAX+1` |
| a habit's name | Shields, Rallies, Channels, Enrages, Marks, Picks off, Winds up | Named as the references name a trait: a noun for the thing (Slay the Spire's Thorns, Flight, Artifact), an adjective for the state (Malleable, Hardened), or the move's own name (Darkest Dungeon's Defender and Mark for Death, Slay the Spire's Incantation and Enrage); never a verb in the third person. The habits: Bodyguard (Guardian), War Cry (Leader), Incantation (Caster), Enrage (Brute), Death Mark (Assassin), Opportunist (Archer / Shooter), Flight (Flier), Virulent (Status Specialist); Undying, Predator, Bloodlust, Regrowth, Hardened, Backlash and Second Wind (the families); Charged Strike (every boss and Gatekeeper). A foe's intent still says what it does in the moment (`✦ Shields Bone Scrapper`, `Charging Warcaller Cleave`) |
| a habit, told | announces, before then, Now and then, `The ally:` | A creature's habit is told as the reference games tell a move (Slay the Spire's tips: "After taking 27 damage, changes to a defensive mode.", "Take 50% more damage from Attacks for 1 turn."): its name over one short paragraph, the trigger then what happens, active, the subject left out where the name gives it, the numbers in the sentence in the creature's own grade: `Charged Strike` over `Charges its strongest attack for 2 actions, then strikes for 180% damage. After taking 6 hits while charging, it becomes Broken, is Stunned, and loses 40% defence for 2 turns.`; `Bodyguard` over `Sometimes shields an ally instead of attacking. That ally takes 50% less damage until this creature acts again.` It never takes the System's stiffness ("How it speaks", 6), which is for its announcements, and never a label inside the sentence. A share reads as damage or HP does in the references, `180% damage`, `30% HP`, `25% Attack`; the name-first rule is for lists of stats and bonuses. The same paragraph is a fight's tip on the habit; only the Guide, which speaks for every grade, gives the span (`gains 15%-30% Attack by grade`). The owner's call |
| help defeat | assist, participate, land a kill | A Shadow helps defeat every creature it landed a hit on, whoever landed the last: "Have one Shadow help defeat 100 creatures." Its record calls the count `Defeated` |
| Level, Lv. | rank level, tier | A Shadow's level, `Lv.14`, as a skill's is. Its rank is the name: Bound, Sworn, Vanguard, Ascendant |
| XP | EXP, Experience, exp | The hunter's and a Shadow's, on every surface and in the Guide: `XP +65`, `XP needed: 1,240`, a Shadow's `XP 4/9`. `tests/voice.test.ts` refuses the others |
| ally | Ally | A hunter in the party. Not a game term, so lowercase inside a sentence: "For allies and Shadows" |
| Arise | ARISE | The app's name in prose: "How Arise Works". The splash wordmark and the extraction button set it in capitals. The store title is `Arise: Dungeon RPG` |
| Mana Shards | | In System text, always in full. The interface may say "shards" |
| Citation, Directive, Edict, Testament | Mission | Secret Quest tiers, lowest to highest |
| item | artifact | Anything the hunter holds or buys, as the System's `[Item: …]` says. "Gear" and "equipment" name the category |
| MP, HP | | As now |
| STR, VIT, AGI, PER, INT | | As now |

British spelling throughout: Licence, defence, levelled. The source's lines are reused in British
spelling.

## Names from the source

Only character names stay out of the game (DESIGN.md, "What it is"). The anime's terms may be used.
These are decided:

- **ARISE.** The app's name and the word the extraction button finishes on.
- **Red Gate.** A Gate that runs too far past its budget turns red, and its way out seals until the
  boss falls (DESIGN.md, "Decided after the research").
- **Shadow Extraction.** The skill is named in full, as the source names it: `[Skill: Shadow
  Extraction] has failed.` The act and its price keep the plain noun: `Extraction cost: 60 MP`,
  `Extraction successful.`, and the Guide's "Extraction costs MP by grade".

## Rules that hold for every speaker

- Copy that quotes a number reads it from the engine's constants (see `screens/Guide.tsx`).
- Valcorde never references the System or anything only it shows: its windows, Ability Points,
  Daily and Secret Quests, the Player.
- Colour has the meaning CLAUDE.md gives it.
- No dashes inside a sentence in player-facing text. Use a full stop or a colon. A hyphen that
  starts an effect line on a card is a list mark, not a dash. A range takes a hyphen, `30-50`,
  `Floors 26-30`, never `30 to 50` or an en dash; only a screen reader hears "to"
  (`tests/voice.test.ts` holds it).
- An empty value shows as `-- --` anywhere: a missing licence number, a tile with nothing to show.
  Something not yet discovered shows as `?`.
- A stat, effect or reward is written name first, signed value after: `STR +1`, `Defence +10%`,
  `Attack and magic +8%`, `Ability Points +3`, `Fatigue -20`. Several on one line join with ` · `.
  This holds on cards, in System windows, in toasts and everywhere gear and bonuses are listed
  (`gear.coreText`, `gear.rollText`, `gear.bonusText`).
- A rate over time reads "each": `HP -6% each round`, `HP +5% each hour`, `Fatigue -5 each hour`.
  Never "a round", "an hour" or "per". The one exception is the action wheel's hub, a circle with no
  room to spare, where the owner asked for `each rd`: `Burning: HP -7% each rd`. Read aloud, it is
  `each round`.
- A share of attempts is a percentage: `Clear rate: 96%`, `Success rate: 34%`. A fraction is only
  ever a counter towards a ceiling: `0/3`, `HP: 140/200`.
- A decision made while writing that will come up again is written here before the change ships.
- The skill tree's words: `Skill Points` (never "SP"), a `Path` (`[Path: Ruin]`), a tier by its
  rank (`B-Rank`), `Lv.1` to `Lv.MAX` for every node that takes more than one point, `acquired` for a
  node's first point, `Skill slots`, `Auto Assign`, `Swap In`. A Path is named by the System for
  what it does, never for a class: Ruin (STR), Bastion (VIT), Tempest (AGI), Arcana (INT), Sight (PER).
- A foe's numbers are earned: what one hit of its next move would do, and its chance to hit, show only
  with Sight's Foresight. Without it a fight says how many are aimed and whether a blow would defeat its
  target (`Aimed at you: 2`, `Lethal`), never how hard. The hunter's own numbers always show.
