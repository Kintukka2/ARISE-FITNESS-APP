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
| The brief itself: a Gate card, `GATE: {name}`, in the Gates' orange | The System, with the Association's file as its first field | `openBrief` in `screens/Gates.tsx` |
| A Trial's brief: `TRIAL: Ascension {n}`, in advancement's gold | The System alone. The Trial is the System's, so it has no Association file and no Association hunter walks in: its terms are fields (`CHOSEN: 5, in a row`, `REST: None`, `WITHDRAWAL: Not possible`, `ALLIES: None`) | `openBrief` in `screens/Gates.tsx` |
| Setting a mark: `Would you like to set this mark?`, the mark, what it adds, `Set: 1/4 → 2/4`, and in red that it cannot be moved | The System, as an Offer, in gold | `MarkList` in `screens/Gates.tsx` |
| The Ascension walkthrough: the sheet explained a part at a time, the first time it opens and from its help button | The interface, as a tour headed `Tutorial` (`tour()` with `who: 'app'`) | `ascensionTour` in `screens/Gates.tsx` |
| Every main screen's bento tiles (Inventory, Gates, Quests, Shadows) | The System | `ui/bento.tsx`, `screens/` |
| The Equipment, Squad, Licence and Ascension windows, and the hunter's card (`HUNTER: {name}`) | The System | `screens/Inventory.tsx`, `screens/Shadows.tsx`, `screens/Gates.tsx` |
| The fight log | The System | `lines()` in `screens/Arena.tsx` |
| What an outcome inside a Gate cost or paid | The System | `system.outcome()` |
| The extraction panel, promotions, the Chosen, Daily Quests | The System | `screens/Arena.tsx`, `ui/contracts.tsx` |
| The Quests screen: its tiles, and the QUEST INFO window each opens (Daily Quests, Reclassification, the Weekly Quest, the Trial, the Chosen, the Secret Quests) | The System | `screens/Quests.tsx`, `ui/contracts.tsx` |
| The Quest chip on the board | The interface | `screens/Gates.tsx` |
| Onboarding dialogue, coach windows, the Gates screen line, the Gates tour | Valcorde | `data/narrative.ts` |
| The `???` windows | Another voice | `data/narrative.ts` |
| A Gate's description in the brief | The world: the Association's file | `data/dungeons.ts`, `data/special.ts`, `data/spire.ts` |
| Map events, traps, caches, shrines, rests | The world: narration | `data/nodes.ts`, `NodePanel` in `screens/Arena.tsx` |
| Buttons, labels, tabs, tiles, hints, toasts, empty states, results, tutorials, settings, the map legend, standing orders, Ascension rules, the Guide | The interface | `screens/`, `ui/`, `data/nodes.ts` (`NODE`), `core/combat.ts` (`TACTICS`), `core/ascension.ts` |
| A locked feature's notice (the Quests tab before the Practice Gate, the Shadows tab before the first Shadow) | The System | `app/router.ts` |
| Status tooltips and foes' intent on unit cards | The System | `STATUS_TEXT` in `core/combat.ts`, `screens/Arena.tsx` |
| Spire reward tiers, rank blurbs | The System | `core/spire.ts`, `core/progression.ts` |
| The splash and the Hunter Licence card | The world: the Association's file | `screens/Onboarding.tsx` |
| The brief's map before the hunter has been inside: `Today's map` / `Unidentified`, a fogged `?` | The System, as the unidentified boss | `screens/Gates.tsx`, `core/gates.ts` (`mapKnown`) |
| The Arrival: the cut between the office and the first Notification | No one. It carries no words, so the System's first words are its Notification | `ui/arrival.ts`, `screens/Onboarding.tsx` |
| The rank-up: the cut between a held Reclassification and "Reclassification approved." | No one, as the Arrival | `ui/arrival.ts` (`rankUp`), `app/flow.ts` (`claimRank`) |
| The promotion: the cut between a held Hold To Promote and "[Shadow …] has been promoted." | No one, as the Arrival | `ui/arrival.ts` (`promotion`), `app/flow.ts` (`claimPromotion`) |
| A Shadow's promotion earned, on the results: `[Shadow …] has met the requirements for promotion.`, on that Shadow's alert, in its violet, with nothing under it and nothing to tap: the Shadows tab's mark shows where to go | The System, as an alert: a strip of its frame, not a window (`SysAlert`) | `ShadowAlerts` in `screens/Shadows.tsx`, `ui/frame.tsx` |
| The Daily Quests a run moved, on the results: one alert each, `QUEST INFO` under way and `QUEST REWARDS` once done, with what it paid | The System, as alerts | `QuestLines` in `ui/contracts.tsx` |
| A Shadow lingering, on the results: `The mana of [Clay Sentinel] lingers.`, an alert that opens the extraction | The System, as an alert that is a button | `screens/Arena.tsx` |
| The extraction: what lingers, the cost and the odds, Hold To Extract; bound, `You may bestow a name.` and the name field | The System, on its sheet headed `NOTIFICATION`; the field and Not Now are the interface's | `Extraction` in `screens/Arena.tsx`, `NameField` in `screens/Shadows.tsx` |
| A creature already in the army, extracted again: before the reach, under what lingers, `But [Shadow Ghoul] already serves in your army.` / `Would you like to extract its Shadow Essence instead?`, then `Shadow Essence +2` on a line of its own with the Essence mark, then `Attempts left:` and `Extraction cost:`; held, `[Shadow Ghoul] has become Shadow Essence.`. Its alert carries the Essence it would give. The reach costs half, and nothing says so: the cost shown is the cost | The System, on the same sheet and alert; the question is its Offer | `Extraction` in `screens/Arena.tsx` |
| What a run did to the deployed Shadows, on the results: an alert only to each that levelled up (`[Shadow Ghoul] has levelled up.` over `Lv.9 → Lv.11`) or that the run made ready for promotion, `XP +14` at its right and a meter along its foot. A Shadow that only took XP, or was already waiting, gets none | The System, as alerts | `ShadowAlerts` in `screens/Shadows.tsx` |
| A Chosen felled, on the results: `You have defeated [The Pale Duelist].` over what it left and `[The Pale Duelist] will return to the Gates.`; a masterwork's alert opens its card. A level proved: `ACCESS GRANTED: ASCENSION 4` over its name, the upgrade limit and `Marks +1` | The System, as alerts: every report on the results is one, never a window | `screens/Arena.tsx` |
| The run strip on the map: `You` and the health bar, then three cells, `Allies 2/2`, `Banked` and the shards, `Items found 0`; each blessing taken as a chip, its star mark, its name (`Blessing of Haste`) and what it gives | The interface, labels as the Status sheet's are; the chip in advancement's gold | `RunStrip` in `screens/Arena.tsx` |
| Leaving with a Shadow still lingering: `A Shadow Lingers` | The interface, as the unrevealed loot's reminder is | `screens/Arena.tsx` |
| A purchase or a use offered: `Would you like to purchase?` / `Would you like to drink?` / `Would you like to use?`, and under it **Do not ask again** | The System's Offer; the toggle is the interface's control, and Settings lists what it skips | `ui/ask.tsx`, `screens/Settings.tsx` |
| Ryn's Association Quests: his card at the top of the Quests screen, his windows when he hands a job over and pays for one, the alert on a run's results (shaped as the System's alerts, in his blue, his corner brackets and his face) | Valcorde, on his channel. The job's goal and its pay on the card and the strip are the interface's labels inside it | `ui/assoc.tsx`, `data/narrative.ts` (`ASSOC_FIRST`, `ASSOC_BRIEF`, `ASSOC_PAID`) |
| The board's `Association` chip, and the brief's `Association Quest:` hint | The interface | `screens/Gates.tsx` |
| The `?` on a Stats sheet field, and the line it opens on what the number does and where it comes from | The interface, inside the System's frame, as a hint is; one line each, its numbers read from the engine (`CRIT`, `HIT`). The `?` sits in the top right corner of every such box; the whole box is the button, and the line shows only once it is tapped, never on hover | `FIGHT_HELP` in `screens/Inventory.tsx`, `Field` in `ui/frame.tsx` |
| An action's details in a fight: its `?` opens, over the foot of the feed, the name, `Lv.2` for a skill of the tree, `Ready` or `Ready in 2`, its line (`Physical ×1.1 · Two targets · Cooldown 2 · Inflicts Staggered`) and a line for each status it inflicts (`Staggered: Physical defence -25%`). A pointer resting on the action opens it too | The interface, as the turn bar is | `Acts` in `screens/Arena.tsx`, `skillLine` in `screens/Skills.tsx` |
| A Shadow's card: its badge in the ring of its next level, its rank, `Was` and what it was, its tags, Power and XP; then Growth, Stats, Skills, Traits, Orders and Record | The System, in the Shadows' violet. The section labels, the graph's rank names and the radar's legend (`Now`, `Lv.MAX`) are labels, as the Status sheet's are | `ShadowCard` in `screens/Shadows.tsx` |
| The Orders tile and `ARMY: ORDERS`: the standing orders as four cards, each its name over its line from `TACTICS`, `Step underway` with the orders a step underway keeps, a row to each Shadow (`Targets` and `Skill`, with what it follows: `Army Orders`, an order's name, `As It Sees Fit` or a skill's name), and **Clear Own Orders** | The System, in the Shadows' violet; the order names and lines are the interface's, as the standing orders always were | `OrdersSheet` in `screens/Shadows.tsx`, `TACTICS` in `core/combat.ts` |
| A Shadow's orders on its card: `Orders`, `Targets` with **Army Orders** and the four orders, the order's line under them (or `Standing orders:` and the army's); `Skill` with **As It Sees Fit** and its two skills, `[Skill: …] whenever it is ready.` under a focus, and `Sworn Rank` with a lock while it knows one; `Focus` tagged on the skill in Skills | The System, in the card's violet; the chips are the interface's controls | `Orders` in `screens/Shadows.tsx` |
| A Shadow's next rank on its card: `Next rank`, what it asks (`Level 14/20`, `Shadow Essence 9/12`, `Bosses felled 1/1`), each ticked once met, and what it brings (`Level cap: 20 → 30`); once all is met, `Promotion`, its badge now and at the rank above, Hold To Promote | The System, in the card's violet, the promotion itself in advancement's gold | `NextRank` in `screens/Shadows.tsx` |
| Awakening on a Shadow's card, once it is Ascendant: `Awakening` and its stars (★★☆☆☆), what the next asks (`Level 40/40`, `Shadow Essence 52/45`) and brings (`Awakening: ★★ → ★★★`, `Stats: +108% → +112%`), Hold To Awaken; done, `[Igris] has awakened.`, `Awakening ★★★` and the stats | The System, in the card's violet, the panel in advancement's gold once all is met | `Awakening` in `screens/Shadows.tsx` |
| Releasing a Shadow: `Would you like to release this Shadow?`, its name, `Shadow Essence +5`, and the warning `A Shadow released is gone.` | The System's Offer, its warning in red | `Release` in `screens/Shadows.tsx` |
| The family glyphs, the rank insignia and the Shadow badge | No one: art, as the rank plates are | `ui/emblems.tsx` |
| A rank's requirements met: `You have met the requirements for [Reclassification: D-Rank].` | The System | `app/flow.ts` (`reclassReady`) |
| Speaker labels on Valcorde's voice box and on tours ("Ryn Valcorde", "Notification", "Tutorial") | The interface | `ui/components.tsx`, `ui/overlays.tsx` |
| A System notice set into a screen (a Shadow has joined your army) | The System | `screens/Shadows.tsx` |
| Potion chips ("Full", "Rested") and the activity log | The interface | `core/shop.ts`, `core/raid.ts` |
| The Status sheet, Skills, Inventory, the Exchange, item and Shadow cards | The System | `screens/Inventory.tsx`, `screens/Gear.tsx`, `screens/Shadows.tsx`, `screens/Exchange.tsx` |
| The Inventory: its counts (`Items`, `New`, `Designs`, `Mana Shards`), Items and Sets, a tab to every kind, `Sort: Score`, the filters (`Better`, `Fusable`, `Set pieces`, `Starred`), `Select` and its bar (`3 selected · Mana Shards +120`, Recycle); a square to every item, `New` until it has been seen, `×2` while a duplicate can be fused into it | The System; the tabs, the filters and the bar's count are the interface's labels inside its frame | `screens/Gear.tsx` |
| The Sets view: `Designs discovered` by rarity, and a card to every set, its pieces held, seen or `-- --`, what 2 and 3 worn pay, and its home Gate | The System | `SetCard` in `screens/Gear.tsx` |
| An item's card: its rarity and kind, its tags (`Worn · Weapon`, its set, `✦ Perfect`, `Masterwork`), Score and what it gains over the piece it would replace (`▲ 27`), `Compared with`, Quality and its bar, each stat with its difference, each property with a bar from its design's worst to its best and the range (`9 to 13%`), its set, Fusion, Upgrade, Equip, the star and Recycle | The System; differences are drawn as ▲ and ▼ with their signed values, gains in green and losses in red | `ItemCard` in `screens/Gear.tsx` |
| Fusion offered: `Would you like to fuse these items?`, the item and its quality before and after, `The duplicate is consumed.`; done: `[Item: …] has been fused.` and its quality | The System's Offer, then a Notification | `Fusion` in `screens/Gear.tsx` |
| The Equipment sheet: `Equipment score`, what is worn adds stat by stat and its properties and sets in a line, the figure with a slot to either side, Auto Equip, Loadouts (`Loadout I`, `Worn`, Wear, Save, `Save Worn`, `Missing: 1`) and the sets worn | The System | `Equipment` in `screens/Gear.tsx` |

Ascension rule text belongs to the interface (the Gates screen, the Guide). When the System announces
a new level it names the level and what it opened, never the rule.

## The look

The look follows the speaker, as the words do. A surface is drawn in the frame of the one speaker
the table above gives it, so a player can tell who is talking before reading a word.

| Speaker | Frame |
|---|---|
| **The System** | The anime's window, below. Every System window, and every System surface on a screen: every main screen's bento tiles, the Status sheet, Skills, Equipment, Inventory, the Exchange, the Gates board, the Army, the brief, item, Shadow and hunter cards, Quest Info, Quest Rewards, the notices after a run. Settings and the Guide take it too, at the owner's call |
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
- **A System line set into a screen is a notice:** the frame, smaller, headed `NOTIFICATION`
  (`SysFrame` with `class="sysnotice"`). It shows only when there is news, and holds for the visit.
  The voice box at the top of a screen is Valcorde's alone (`Voice`); the System never speaks in it.
- **A list of rewards** is one box with each reward in a hairline box of its own inside it:
  `system.rewardList()` in a window, `<Rewards>` on a screen. Quest Info's REWARDS and every Quest
  Rewards window are set this way.

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
   rewards?" Keep that stiffness. Do not smooth a System line into natural English.
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
| EQUIPMENT | What the hunter wears: a slot to each of the ten around them, the score, the sets worn |
| INVENTORY | What the hunter holds |
| GATES | Every Gate standing open today, a tile each, under the grade tabs |
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
- **A set's pieces carry the set's mark:** a small diamond low in the corner of each piece's icon, in
  the set's own hue (`gear.setHue`), and the same diamond beside the set's name wherever it is
  written. Pieces of one set read as one without a word.
- **A warning** reddens only its key word: in "You will be transferred to the penalty zone.",
  only "penalty zone" is red.
- **A failure or refusal** reddens the whole message and keeps the frame of its subject.

In markup: `.warn` is red, `.grant` is green, and `<strong>` is a name, which the System's frame sets
bold and italic. A gain is green in every System frame, whatever the frame's colour: a promotion in
a violet frame still reads `Bound Rank → Sworn Rank` in green.

### Brackets

- A window that is one announcement brackets the whole line: `[Daily Quests have arrived.]`
- A name inside a longer sentence brackets the name only: `[Skill: Extraction] has failed.`
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

**The Quests screen.** One page: a grid of tiles, one to a quest, each in the frame of its subject:
cyan for the System's own (the Daily Quests, the Secret Quests), gold for advancement
(Reclassification, the Trial, the Chosen), orange for the Pale Spire. Tapping a tile opens the
quest's QUEST INFO window in a sheet. Every quest's name wears its type, and these are the names:

| Quest | Name | Goals |
|---|---|---|
| The day's | `[Daily Quests]` | As above |
| The next rank | `[Reclassification: D-Rank]`, `[Reclassification: Sovereign]` | `Reach Level 10.` / `XP needed: {n}` |
| The Spire's week | `[Weekly Quest: The Pale Spire]` | `Clear Floor 36.` / `Floors 26 to 30 next.` |
| The next Ascension level | `[Trial: Ascension 4]` | `Clear all 3 S-Rank Gates at Ascension 3.` / `Win The Trial of Ascension 4: 5 of the Chosen in a row.` |
| The Chosen walking today | `[Chosen: The Iron Penitent]` | `Fell [The Iron Penitent] in Revenant Gatehouse.`, the foe in red |
| Every Secret Quest | `[Secret Quests]` | Each one done, ticked: its name, `Goal: {goal}` and its reward under it, its tier at the side. The rest are one row, `?` / `Sealed: {n}` |

- **Every main screen is a grid of these tiles** (`ui/bento.tsx`): Inventory (Status, Stats, Skills,
  Equipment, Inventory, the Exchange, the hunter's card), Gates (the Practice Gate until it is
  cleared, the open run, Open Gates, Grade, Record, Ascension; Open Gates is the screen's centre, larger
  than the rest and lit in orange), Quests (where the Pale Spire is a Weekly Quest),
  and Shadows (the Squad and the Army; the Squad's window, `SQUAD: 2/3`, puts a Shadow in with `+`
  and takes one out with `-`, an empty slot showing `-- --`). A list is one tile that opens its window: Open Gates opens
  GATES, a tile to every Gate, its portal in its grade's colour; the Army opens ARMY, a tile to
  every Shadow, ringed by its kills toward the next rank. On Gates, the hunter's condition is not a
  tile but a strip under Valcorde's line, in the System's frame: the Status sheet's HP, MP and FTG
  rows, each with its potion, so a potion is one tap from the board. A tile names a window's subject as a header word (`STATUS`, `GRADE`) or a
  name with its type (`[Gate name]`, `[Hunter: {name}]`), and opens that window. Two half tiles share
  a row; one left alone spans it. Valcorde's line keeps his own frame above the Gates grid.
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
  report the proof, open the Trial and count the Chosen felled (`Chosen felled: {n}/{m}`). The Gates
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
| Hunter Recruit Shirt | Association grey, reinforced at the shoulders, and issued in one size that fits nobody. Every hunter alive owned one of these first. | A shirt issued by the Hunter Association. Reinforced at the shoulders. Cannot be recycled. |
| Hunter Recruit Trousers | Hard-wearing, unflattering, and cut for crouching in. Valcorde will tell you the last part is not an accident. | Trousers issued by the Hunter Association. Cut for crouching. Cannot be recycled. |
| Hunter Recruit Boots | Flat, stiff, and honest. You will feel the ground through them, which is the only thing a boot has to do. | Boots issued by the Hunter Association. Thin-soled. Cannot be recycled. |
| Training Shield | Battered plywood over a steel rim, and heavier than it looks. Handed out because a recruit who has never held a shield puts it in the wrong place. | A training shield of plywood over a steel rim, issued by the Hunter Association. Cannot be recycled. |
| Training Sword | Blunt, nose-heavy, and deliberately worse than a real blade. Valcorde issues it with the licence and tells every recruit the same thing: the sword is not the point, the swinging is. | A blunt training sword issued by the Hunter Association. Cannot be recycled. |

### Worked example: extraction

The panel after a clear, in a violet frame.

| | Now | System |
|---|---|---|
| Offer | "The power from the **{foe}** you just defeated is lingering… It wants to continue to fight — under your command." / "Reaching for it costs **60 MP** (you have 140). It holds 34 times in 100, read off your Intelligence." | The rank and the name, then `The mana of [{foe}] lingers.` / `Attempts left: 3` / `Extraction cost: 60 MP`. The odds are not shown here; the Guide states them |
| No mana | "You have nothing left to reach with. Mana comes back on its own — walk out of the next one with some." | `Not enough MP. (40/60)` |
| Failed, reaches left | | The rank and the name, then `The mana of [{foe}] still lingers.` / `[Skill: Extraction] has failed.` / `Attempts left: 2` / `Extraction cost: 120 MP`, those three in red / `Hold To Extract Again`. No multiplier and no MP held: the cost is the number that matters, and MP held shows only when it falls short (`Not enough MP. (100/120)`). Its alert on the results: `The mana of [{foe}] still lingers. Attempts left: 2` |
| Failed, the last reach | "The shape thinned, came apart, and went wherever the rest of them go. A higher INT makes them hold." | `[Skill: Extraction] has failed.` / `The mana has dispersed.` (all red) |
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
▸ [Goblin Den] cleared. Rounds: 4. Standing: 3. Condition: Grazed.
```

- **Actor, colon, act.** `{Who}: {Ability} → {Target} -{damage}`. No verbs of flourish ("swings",
  "finds nothing", "the line is rallied").
- **Damage and healing are signed numbers.** A status is a bracketed effect.
- **The glyph at the front is the event's kind**, so a line can be read at a glance.

### The assessment

The brief's verdict is the System's assessment of the Gate, graded from the clear rate of its 24
runs (`GRADES` in `core/raid.ts`): **Safe, Favourable, Even, Unfavourable, Lethal**.

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
set as fields, because a hunter compares pieces by them. The item's icon fills the icon box, framed
by its grade. The same card holds a Shadow (`Shadow: {name}`, its rank plate in the icon box).

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

Every purchase with Mana Shards asks first: gear, the Field Potion and potions. A potion is drunk as
it is bought, so its button names both acts: **Buy and Drink**. A Google Play purchase (shard packs,
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
THE MANIFEST                           Left: {n}/{m}
[icon]  {Name} ▲
        {Stats, green}
        {Rarity} · {Slot} · Score {n}        ◆ {price}
```
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

**Equipment.** The ten slots in hairline boxes, five down each side of the hunter's figure, each with
its slot set small above the item's name (`HEAD` / Warden Helm), or `-- --` when it is empty. Fields
above them give `EQUIPMENT SCORE:` and `SLOTS FILLED:`; `Auto Equip` is lit when it has something to
improve; each set worn is a box of its own: `[Set: Warden] 2/3`, its bonus in green. A slot opens the
item's card, or `EQUIPMENT: {Slot}` with what could fill it.

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
3. **Gains are written name first, like the System:** "Mana Shards +40", "Field Potion · Satchel
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
| Gate Survey | scout, survey report | The Association's report that shows a Gate's map before the hunter goes in. An item: `[Item: Gate Survey]` |
| Reclassification | rank-up quest, job change | The quest for the next rank, as the rank windows say: "Reclassification approved." |
| Inventory | Profile | The tab with Status, the equipment and everything held. Code keeps the route `inventory` |
| Ability Points | attribute points, stat points | Code keeps `points` |
| stats | attributes | STR, VIT, AGI, PER and INT, as the source says it: "All stats -50%" |
| Player | | The System's name for the hunter. No one else uses it |
| Gate | gate | Capitalised everywhere, as a game term |
| Shadow | shadow | Capitalised everywhere, as a game term, like Gate |
| Awakening, awaken | limit break, star up, ascend | What Shadow Essence buys an Ascendant at its cap: a star, `★`, five in all. `[Igris] has awakened.` |
| Fusion, fuse | merge, combine, sacrifice, feed | A duplicate of an item's design fed into it: "Would you like to fuse these items?" The one fed in is "the duplicate" |
| Loadout | build, preset, outfit | What was worn, saved: `Loadout I`, `Loadout II`, `Loadout III` |
| New | unseen, fresh | An item in the bag the hunter has not looked at yet |
| Shadow Essence | essence, shards, souls | Spent on a Shadow's promotion. In System text always in full, as Mana Shards is; a label may say "Essence" where the line already names it |
| help fell | assist, participate, land a kill | A Shadow helps fell every creature it landed a hit on, whoever landed the last: "Have one Shadow help fell 100 creatures." Its record calls the count `Felled` |
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

## Exceptions decided

DESIGN.md keeps the source's named skills out of the game. Two were already in it, and the public
name decided both:

- **ARISE stays.** It is the app's name and the word the extraction button finishes on. It is the one
  specific borrowed from the source; see DESIGN.md.
- **Shadow Extraction does not come with it.** The skill is written `Extraction`.

## Rules that hold for every speaker

- Copy that quotes a number reads it from the engine's constants (see `screens/Guide.tsx`).
- Valcorde never references the System or anything only it shows: its windows, Ability Points,
  Daily and Secret Quests, the Player.
- Colour has the meaning CLAUDE.md gives it.
- No dashes inside a sentence in player-facing text. Use a full stop or a colon. A hyphen that
  starts an effect line on a card is a list mark, not a dash. A range is "Floors 1 to 5", never
  "1–5".
- An empty value shows as `-- --` anywhere: a missing licence number, a tile with nothing to show.
  Something not yet discovered shows as `?`.
- A stat, effect or reward is written name first, signed value after: `STR +1`, `Defence +10%`,
  `Attack and magic +8%`, `Ability Points +3`, `Fatigue -20`. Several on one line join with ` · `.
  This holds on cards, in System windows, in toasts and everywhere gear and bonuses are listed
  (`gear.coreText`, `gear.rollText`, `gear.bonusText`).
- A rate over time reads "each": `HP -6% each round`, `HP +5% each hour`, `Fatigue -5 each hour`.
  Never "a round", "an hour" or "per".
- A share of attempts is a percentage: `Clear rate: 96%`, `Success rate: 34%`. A fraction is only
  ever a counter towards a ceiling: `0/3`, `HP: 140/200`.
- A decision made while writing that will come up again is written here before the change ships.
- The skill tree's words: `Skill Points` (never "SP"), a `Path` (`[Path: Ruin]`), a tier by its
  rank (`B-Rank`), `Lv.1` to `Lv.MAX` for every node that takes more than one point, `acquired` for a
  node's first point, `Skill slots`, `Auto Assign`, `Swap In`. A Path is named by the System for
  what it does, never for a class: Ruin (STR), Bastion (VIT), Tempest (AGI), Arcana (INT), Sight (PER).
