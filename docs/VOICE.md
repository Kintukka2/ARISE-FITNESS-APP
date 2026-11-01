# ARISE — voice

How ARISE speaks to the player. Every word a player reads follows this file: System windows,
Valcorde, buttons, labels, the Guide, item and enemy text. Read it before writing or changing any
of them.

The System is written. Valcorde, the interface and the world's own text are still to come; until
they are, keep to the existing rules at the end of this file.

## Speakers

| Speaker | Who it is | Where it appears |
|---|---|---|
| **The System** | The program that chose the hunter. Reports, never explains. | System windows, every card (gear, potions, skills, classes), the Status sheet |
| **Valcorde** | Ryn Valcorde, the Association's instructor. Does not know the System exists. | Coach windows, the first Gates, the Gates screen |
| **The interface** | The app: buttons, labels, tabs, empty states, settings, tutorials, the Guide. | Everywhere outside a System or coach window |
| **The world** | The Association's records, the bestiary, the Gates. | Enemy and Gate descriptions |
| **Other voices** | Things that are not the System and should not be in its windows. | The `???` window, nothing else yet |

Each speaker sounds like itself. A line that would fit another speaker needs rewriting.

- **Any speaker may name the System. Only the System may not refer to itself.** The Guide says "the
  System issues 3 Daily Quests a day"; a System window never says "the System".
- **Teaching belongs to the interface.** A tutorial window is the app speaking (kind `app`, a plain
  title such as "Your Turn"), and the Guide holds every rule. Neither is a System window.
- **Valcorde teaches only what he can know:** Gates, ranks, the Association, fatigue, his own past.

## The System

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
- **A payout is reported once, in the window that pays it.** The level-up window's Ability Points
  already include the rank-up bonus, so a rank window never repeats them. Daily Quest pay is shown
  in the run's results, where `raid.finish` settled it.
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
| SKILLS | Skills, passive and active |
| INVENTORY | What the hunter holds |

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
- **A warning** reddens only its key word: in "You will be transferred to the penalty zone.",
  only "penalty zone" is red.
- **A failure or refusal** reddens the whole message and keeps the frame of its subject.

In markup today: `.warn` is red, `.grant` is green, `<strong>` lifts a name. The visual pass may add
a class for bracketed names.

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
1. Each quest: {shards} · Experience +{n}
2. All 3: {shards} · Experience +{n}
New Daily Quests in: {countdown}
```
Source: `[Daily: Collect Demon Souls! 3]`, a two-sentence brief, `GOAL`, numbered `REWARDS`.
ARISE's Daily Quests have no penalty, so the window has no warning line, and no line mentions
that there is none.

- **A goal is an order in the imperative:** "Clear 2 Gates of D-Rank or higher." "Defeat a
  Gatekeeper." Secret Quest goals read the same way.
- **A hint says where or how, flat:** `Found in: {places}.`, `Kills in any Gate count, cleared or
  not.`, `It is off the marked road.` A hint never explains why.

**Quest Rewards.**

```
QUEST REWARDS
You got rewards.
1. {Reward} +{n}
                                   Close
```
Source: `You got rewards.` / `1. Ability Points+5` / `Accept this rewards?`
For a quest whose rewards arrive apart from the moment it completes. No ARISE window needs it yet:
a Secret Quest reports its reward in its own completion window, and Daily Quests report theirs in
the run's results.

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
| Offer | "The power from the **{foe}** you just defeated is lingering… It wants to continue to fight — under your command." / "Reaching for it costs **60 MP** (you have 140). It holds 34 times in 100, read off your Intelligence." | `The mana of [{foe}] lingers.` / `Extraction cost: 60 MP` / `Success rate: 34%` |
| No mana | "You have nothing left to reach with. Mana comes back on its own — walk out of the next one with some." | `Not enough MP. (40/60)` |
| Failed | "The shape thinned, came apart, and went wherever the rest of them go. A higher INT makes them hold." | `[Skill: Extraction] has failed.` / `The mana has dispersed.` (all red) |
| Bound | "SUCCESSFUL EXTRACTION — {shadow} answers to you now." | `Extraction successful.` / `[{shadow}] has joined your army.` |

That INT raises the rate is a rule, so it goes in the Guide.

### Screens

The System's recurring screens, laid out the way the source lays them out. Every field reads the
engine. Each element of a screen sits in its own box: the icon, the header, each row, each button.
The item card, Status and Inventory layouts land with the visual pass; until then the words on
those screens follow these layouts, and the Quest Info, Purchase and Change windows already do.

**Item card.** The gear sheet.

```
[icon]  ITEM: {name}
        ACQUISITION DIFFICULTY: {rank}-rank      CATEGORY: {slot}
        RARITY: {rarity}                         SET: {set}
{Card text.}
{Core}         INT +3   PER +1
{Property}     Status Chance +4%
Set '{set}' (2/3): {bonus}
Quality: {quality}
```
Source: `ITEM: Castle Door Key` / `ACQUISITION DIFFICULTY A-rank` / `CATEGORY Key`, a plain
description, then green stat lines with icons (`AGI +20`, `PER +20`, `Physical Damage -20%`).
The rank is the acquisition difficulty and the slot is the category; both already exist on every
design. Stat lines are green. A set bonus is a condition and an effect.

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
template: `Not enough Mana Shards. ({have}/{price})`.

Every purchase with Mana Shards asks first: gear, the Field Potion and potions. A potion is drunk as
it is bought, so its button names both acts: **Buy and Drink**. A Google Play purchase (shard packs,
the Licence) uses Google Play's own confirmation, not this window. After a purchase the System
reports it: `You have acquired` / `[Item: {name}].` / its stats in green.

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

**Status.** The hunter's sheet.

```
STATUS
NAME: {name}          LEVEL: {level}
CLASS: {class}        FATIGUE: {fatigue}
HP: {hp}
MP: {mp}
STR: {n}   VIT: {n}
AGI: {n}   INT: {n}
PER: {n}
                      ABILITY POINTS: {n}
```
Source: `NAME`, `LEVEL`, `JOB`, `FATIGUE`, `TITLE`, `HP`, `MP`, the five stats, `REMAINING POINTS`.
ARISE has no titles, so the row is left out rather than shown empty. `JOB` is `CLASS`.

**Inventory.** A grid of icons under tabs, with the count of what is held.
Source: tabs `All`, `Equip`, `Actives`, `Ingred.`, `Quest`.

## Words

| Say | Not | Note |
|---|---|---|
| Notification | Alarm, Notice | The default System window header |
| Daily Quest | contract | Code keeps `contracts`; only the words change |
| Secret Quest | Secret Mission | Code keeps `missions` |
| Ability Points | attribute points, stat points | Code keeps `points` |
| stats | attributes | STR, VIT, AGI, PER and INT, as the source says it: "All stats -50%" |
| Player | | The System's name for the hunter. No one else uses it |
| Gate | gate | Capitalised everywhere, as a game term |
| Mana Shards | | In System text, always in full. The interface may say "shards" |
| Citation, Directive, Edict, Testament | Mission | Secret Quest tiers, lowest to highest |
| item | artifact | Anything the hunter holds or buys, as the System's `[Item: …]` says. "Gear" and "equipment" name the category |
| MP, HP | | As now |
| STR, VIT, AGI, PER, INT | | As now |

British spelling throughout: Licence, defence, levelled. The source's lines are reused in British
spelling.

## Exceptions still to decide

DESIGN.md keeps the source's named skills out of ARISE, but two are already in it, in three
places: **Shadow Extraction** (a window title), and **ARISE** (the word the extraction button
finishes on, and the app's name). Decide them with the public name, which DESIGN.md parks. Until then, write the
skill as `Extraction`, and leave the button and the name alone.

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
  This holds on cards, in System windows and everywhere gear and bonuses are listed
  (`gear.coreText`, `gear.rollText`, `gear.bonusText`). The one place still open is a toast's
  currency gain (`+40 Mana Shards.`), which is settled with the interface's voice.
- A decision made while writing that will come up again is written here before the change ships.
