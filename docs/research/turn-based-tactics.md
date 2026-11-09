# Turn-based tactical combat and roguelike map structure: research for ARISE

**Limits of this research.** The web-search budget is shared with other agents, and it ran out after 22 searches, short of the 30+ asked for. Rock Paper Shotgun, Eurogamer and the Fandom wikis refused fetches. I filled the gaps from wiki.gg, Wikipedia, Game Developer, write-ups of the GDC talks, and fan reverse-engineering of the games' code. Anything marked *(unconfirmed)* comes from my own knowledge of the games and was not verified in this session. I could not research Gladiator Manager at all; what this report says about it comes from ARISE's own DESIGN.md.

---

## 1. The games

### Slay the Spire (Mega Crit, 2019) and Slay the Spire 2 (Early Access since 5 March 2026)

**Loop.** You climb three acts of a branching 15-floor map with a deck you build one draft pick at a time. A fight pays a 1-of-3 card pick, an elite pays a relic, and a boss pays a rare pick plus a choice of 1 of 3 boss relics. Death ends the run, and Ascension unlocks harder runs.

**Intents.** An icon above each enemy shows its next move. An attack shows a sword that looks more menacing as the damage rises, with the damage number already adjusted for Strength, Weak and Vulnerable *(the number is visible in every screenshot; no source this session describes it)*. Block, buff, debuff and "unknown" moves have their own icons.
- **How it came about.** The prototype had a text "next move" system: enemies picked moves at random, and you clicked each enemy to read its move. It was hard to stream, cluttered, and tedious in fights with several enemies, and adding bobbing damage numbers didn't fix it. The icons replaced it.
- **The developers' verdict.** In their words, "it was revealing the enemy's intent that finally made Slay the Spire come together." Visible intent lets the player go all in on attack when an enemy is buffing, and armour up when a big hit is coming. That control offsets the randomness of a card game.
- **How enemies choose.** Bosses run fixed patterns. Other enemies pick moves at random, with code that stops repeats, and a few change their move in response to the player.
- **What an intent is worth.** The boss relic Runic Dome grants +1 Energy a turn and hides every intent. Most players treat it as a trap, and experts take it.

**The map.** These rules come from community reverse-engineering of the game code (KosGames):
- **Layout.** The grid is 7 wide and 15 high. A path is walked from floor 1 to floor 15 six times; the first two paths must start in different rooms, and paths may not cross. Rooms no path touches are removed.
- **Fixed floors.** Floor 1 is all fights, floor 9 all treasure, and floor 15 all rest sites. The boss stands above floor 15 and is shown from the start of the act.
- **Weights.** Every other room is rolled by weight: monster 53%, elite 8%, and from Ascension 1 "~60% more" elites (the wiki; one guide says 16%). Event, shop and rest take the rest *(the commonly cited 22% / 5% / 12% are unconfirmed)*.
- **Rerolls.** A room is rerolled if it breaks any of these rules: no elite or rest below floor 6; an elite, shop or rest never connects directly to another of those three; a room with two or more exits never leads to two rooms of the same type; no rest on floor 14.
- **What the rules guarantee.** Every fork offers unlike things, and a rest always comes before the boss. Giovannetti: the paths "were inspired by FTL"; "it is valuable to have layered decision-making in a strategy game"; "navigating the map adds an extra element of risk/reward and planning."
- **StS2.** Per community notes on v0.101, Neow takes floor 1, floor 2 is a forced fight, and no elite or rest appears before floor 7. A cleanup pass prunes duplicate routes and repairs the room counts to the act's target mix.

**`?` rooms.** A `?` room becomes a monster 10% of the time, a shop 3% and a treasure 2%; otherwise it is an event. Each time a `?` room doesn't roll a type, that type's chance rises by its base (10, 3 or 2), so the second `?` room is 20/6/4/70. Rolling a type resets its chance. A shop can't follow a shop. This is pity for the outcomes players want, not for the ones they fear.

The first game didn't save the room you were in, so a `?` room reached after a shop could be rerolled by save-and-quit (luckytyphlosion's gist).

**Elites and burning elites.**
- **Rewards.** An elite pays a relic, 25–35 gold, and a card reward at 50/40/10 common/uncommon/rare. A normal fight pays 60/37/3. The rare chance starts 5 points below its base, rises 1 point for each common rolled, and resets when a rare is rolled.
- **Burning elites.** Once Act 4 is unlocked, one elite in each act burns, marked on the map in advance. It gains one of four buffs: Strength (act + 1), +25% max HP, Metallicize (act × 2 + 2) or Regenerate (act × 2 + 1). It drops the Emerald Key, one of the three keys to Act 4. It is opt-in danger with a stated buff and a stated prize.

**Campfires.**
- **The two options.** Rest heals 30% of max HP; Smith upgrades a card.
- **Added options.** Relics add Lift (Girya: +1 Strength, three uses), Toke (Peace Pipe: remove a card) and Dig (Shovel: a relic). Recall takes the Ruby Key in place of resting.
- **Boss relics that remove one.** Coffee Dripper greys out Rest and Fusion Hammer greys out Smith, each for +1 Energy.
- **The decision.** Health now against power for the rest of the run. It is hard because both options are good.

**Deck shaping.** Every card reward can be skipped. Removing a card at the shop costs 75 gold, rises 25 with each use, and can be done once per shop visit; Smiling Mask fixes the price at 50. A deck that only grows gets worse, so skipping and paying to remove are real decisions.

**Boss relics.** You pick one of three or skip. Each energy relic carries a drawback:
- **Confirmed this session:** Cursed Key (a curse with every chest) and Runic Dome (no intents shown).
- **Unconfirmed:** Ectoplasm (no gold), Sozu (no potions), Philosopher's Stone (enemies gain Strength), Velvet Choker (six cards a turn), Busted Crown (fewer card choices), plus Coffee Dripper and Fusion Hammer above.

The same +1 Energy is priced in a different currency each time, so you have to read your own run.

**Ascension 1–20.** Levels stack, are tracked per character, and each is unlocked by beating the Act 3 boss at the level below.

| Level | Rule |
|---|---|
| 1 | Elites appear about 60% more often |
| 2–4 | Normal enemies, then elites, then bosses deal more damage |
| 5 | After a boss you heal 75% of missing HP, not all of it |
| 6 | Start the run 10% damaged |
| 7–9 | Normal enemies, then elites, then bosses have more HP |
| 10 | Start with the Ascender's Bane curse |
| 11 | One fewer potion slot |
| 12 | Upgraded cards appear half as often in Acts 2–3 |
| 13 | Bosses drop 25% less gold |
| 14 | Lower max HP |
| 15 | Events turn out worse |
| 16 | Shops cost 10% more |
| 17–19 | Normal enemies, then elites, then bosses get harder movesets |
| 20 | Two bosses at the end of Act 3 |

StS2 reworked level 6 into "Inflation": fewer rests and dearer card removal.

**Metrics.**
- **Collection.** A metric server logged every decision, from the prototype played by Netrunner players onward. "The first time we made our metrics, we had three graphs; now we have at least 90."
- **What they watched.** Pick rate decides whether a card is effectively in the game; how often a card appears in winning decks flags it as overpowered.
- **Dual Wield.** Its low pick rate earned a buff that was "totally broken," so the team cut it back to copying Skills only.
- **The Awakened One.** It gained Strength whenever a Power was played, which crushed Power decks. The team slowed the gain and raised its base damage.
- **When the data lies.** Madness looked overpowered because players picked it up late in runs they were already winning. "Super playtesters" skew the averages. "Numbers don't capture how things feel."
- **Ascension's purpose.** Ascension exists so that players of different skill each have a difficulty of their own.
- **Doormaker (StS2).** Its win rate was "in a good place," but it "was over the complexity threshold of what we want," so Mega Crit removed it.

**Criticisms.**
- **Draft luck.** The card offers can starve a build of what it needs.
- **The difficulty curve.** The jump from Act 1 to Act 2 is steep, and Giovannetti concedes the top Ascension "does require some luck."
- **StS2's patches.** Players review-bombed the game over balance changes, including Doormaker and the price of card removal.
- **Leaky random streams.** StS1 seeded its seven random streams with the same value, so rolls correlated: if the first card reward is uncommon, the first fight drops a potion. StS2 derived each stream's seed from a hash of its name, but .NET's `System.Random` is linear in its seed, so the correlations came back.

### Darkest Dungeon (Red Hook, 2016) and Darkest Dungeon II (2023)

**Loop (DD1).** Pick four heroes from the hamlet's roster, buy provisions, and clear a short, medium or long dungeon of rooms and corridors. You come home with loot and damaged minds, and spend on upgrades and recovery. Heroes die for good.

**Stress (DD1).**
- **The scale.** A 0–200 gauge beside HP.
- **The test at 100.** A resolve test: an affliction (base 75%) or a virtue (25%, minus 5 points for each level the hero is below the dungeon's level).
- **What each does.** Afflicted heroes disobey, refuse orders and stress the rest of the party. A virtuous hero gains a buff, drops to about 40 stress, and relieves the others a little.
- **At 200.** A heart attack puts the hero on Death's Door, or kills them if they are already there.
- **Sources of stress.** Crits taken, stress attacks, low light, curios, traps, hunger, walking backwards, seeing a comrade fall, passing a turn (5 stress), and fleeing.
- **Recovery.** Reductions to stress taken are capped at 80%. Going home caps stress at 100, and only gold plus a week of the hero's time clears it.

**Why stress exists.**
- **The designers' case.** "The ability to fight is only half the equation… What about the willingness to fight?" And: "We want to put you in uncomfortable situations where you do not have complete control of your party."
- **The meter.** They nearly kept stress hidden, then showed it so players had something concrete to manage.
- **Inspiration.** Sigman says it came from "not games, really, but more human experience" (Band of Brothers, Aliens).
- **What stress does that HP can't:**
  1. It is attrition that potions and rests don't reset, so it measures the whole expedition, not one fight.
  2. It is spent by what happens, not only by damage, so a fight won cleanly can still cost.
  3. It threatens the party as a whole: loss of control, and stress that spreads from one hero to the others.
  4. The test at 100 is a staged dramatic beat with a possible heroic reversal.

**Death's Door.**
- **The state.** At 0 HP a hero is on Death's Door, and every further hit forces a deathblow test.
- **Deathblow resist.** Base 67% (the Flagellant starts at 73%), capped at 87%.
- **While on the Door.** −10 accuracy, −25% damage, −5 speed, +33% stress taken.
- **After being healed out.** A recovery debuff lasts to the end of the quest: −2 accuracy, −5% damage, −1 speed, +10% stress taken.
- **What it does.** 0 HP becomes a state you can act on rather than an ending, and every hit after it is a visible coin flip.

**Ranks.** Each side has four ranks. Every skill lists the ranks it can be used from and the ranks it can hit. Moving costs the turn, and knockback and pulls scramble the lines. Bourassa: "You couldn't hit somebody all the way behind three other guys with a sword." Sigman credits the two ranks of The Bard's Tale and says four-on-four allowed "a fair amount more." Corpses hold their rank on the enemy side; they were the most contested change of Early Access *(unconfirmed)*.

**Light.**
- **The meter.** It starts at 100 and falls through five bands: Radiant (76+), Dim (51–75), Shadowy (26–50), Dark (1–25) and Pitch (0).
- **How it drops.** It loses 1 for each step through explored ground and 6 for each step into new ground. A torch (75 gold, a stack of 8) adds 25, and camping resets it to 100.
- **At Radiant.** Scouting +15%, monsters surprised +25%, hero dodge +7.5.
- **At Dark and Pitch.** Stress +30% and +40%, monster damage +10% and +12.5%, monster crit +3% and +5%, heroes surprised +25% and +40%. But loot +75%, and hero crit +2% and +3%.
- **The point.** It is a pure push-your-luck dial, and you can turn it down yourself for loot.

**Provisions, curios, camping.**
- **Provisions** are bought for each expedition: food 75, torch 75, shovel 250, bandage, antivenom and holy water 150, key and herbs 200, laudanum 100. Anything unspent is sold back on return.
- **Curios** can be handled by hand or with an item.
  - Heirloom Chest: a key gives loot ×3 100% of the time; a shovel gives loot ×2 66.7% of the time; by hand it is 50% loot ×2, 25% Bleed, 25% Blight.
  - Confession Booth: holy water gives −30 stress 100% of the time; by hand there is a 50% chance of +15 stress.
  - An item's result is often certain but not always good: a torch on a Stack of Books is a guaranteed +100 stress.
  - The game doesn't list what an item does to a curio, so players rely on community cheat sheets.
- **Camping** spends one firewood (none on short expeditions, one on medium, two on long).
  - Food tiers: starving (0 food) costs 20% HP and +15 stress; a feast (8 food) heals 25% HP and removes 10 stress.
  - There are 12 respite points to spend on camping skills (Encourage: −15 stress for 2).
  - After camping there is a 33% chance of a night ambush unless a skill prevents it.

**Leaving.** Abandoning a quest keeps the loot found and forfeits the quest's reward. Fleeing heroes take stress, though it cannot cause an affliction. Retreating from a battle can fail, which costs the hero's turn, and it stresses the party. Taking a hero into a dungeon below their level costs 20 stress per level of difference.

**DD2.**
- **Structure.** The hamlet is gone. A stagecoach road runs through regions to a mountain, with inns along the way.
- **The Flame (0–100).** It drains as you travel and when you stall a fight.
  - Bright gives +6% deathblow resist. Pitch gives −9% and +100% chance of enemy advantage.
  - At 0, cultists ambush the party, and beating them restores 40 Flame. Below 30, the Shambler can ambush.
- **Stress (0–10).** At 10 the hero either melts down or turns Resolute.
  - Meltdown (80%): HP drops to 10%, deathblow resist −15% until the next inn, affinity is lost with everyone, and there is a 40% chance of a negative quirk.
  - Resolute (20%): heals 67% HP, deathblow resist +15%, affinity is gained, and there is a 40% chance of a positive quirk.
- **Relationships.** Each pair's affinity runs 0–20 and starts at 9; decisions and combat nudge it.
  - Leaving an inn rolls a relationship: 90% positive at 20, 90% negative at 0, 5% either way at 9–13.
  - Amorous partners may intercept hits or heal each other; Hateful ones may hit each other. A relationship lasts one region.
- **No retreat** from road battles.
- **Kingdoms** (January 2025) restored "some of the permanence and roster management" of DD1.

**Criticisms.** Red Hook accepted the cost: "That's the DNA of the game; it's punishing. Sometimes unfairly," and "We're testing player's abilities to think at the point of disaster." Players complain about:
- stress spikes driven by crits;
- deathblow coin flips;
- the grind of hamlet recovery;
- DD2's affinity, which is random and opaque (its combat shifts rest on "hidden factors"), and whose 4–5% act-outs read as noise.

### Into the Breach (Subset Games, 2018)

**Loop.** Three mechs defend a city's buildings on 8×8 maps for a fixed number of turns. Every Vek attack and every spawn is shown before it happens, and your turn is spent defusing them.

**Telegraphs and answers.** Each Vek moves, shows exactly which tiles it will hit and for how much, then waits for your turn. Spawns are marked a turn ahead, and the order the attacks resolve in is shown *(numbered attack order: unconfirmed)*. You can answer in several ways:
- kill the attacker before it fires;
- push it so its attack lands on another Vek or on nothing;
- stand on a spawn tile to block it, taking 1 damage *(unconfirmed)*;
- shield or smoke the target.

Buildings feed a Power Grid shared across the campaign; lose all of it and the timeline is lost. The little randomness left is deliberate: Grid Defense gives a building a small chance to shrug off a hit *(about 15%, unconfirmed)*. A Reset Turn undoes one turn, once per battle *(unconfirmed)*.

**Why it works.**
- **Ma (Road to the IGF).** Telegraphs are the core, so "every death felt like your own fault." With every attack shown, "the game starts to feel like a puzzle." The team wanted "less randomness than FTL" because that "helps make the player feel in control."
- **Davis (GDC 2019 postmortem).** Enemies are chess pieces whose danger zones you plan around. Keep numbers small, so going from 1 to 2 matters. Use randomness only where it is clearly better.
- **Ma on clarity.** "We would sacrifice cool ideas for the sake of clarity every time." Testers still misread weapons after three sentences of explanation, so a short animation replaced the text.
- **Cuts and pace.** The team cut about 60% of what they had planned. A turn limit keeps battles shorter than XCOM's.
- **What the puzzle asks.** Never "can I win this fight?", always "what will I give up": a building, a mech's HP, or a bonus objective.

**Criticisms.** The campaign is short, replays lean on new squads rather than new situations, and some players find later runs solved by habit *(general reception, unconfirmed)*.

### Monster Train (Shiny Shoe, 2020; Monster Train 2, 21 May 2025)

You defend a pyre on the train's top floor and summon units onto the three floors below. Waves enter at the bottom, fight on each floor and climb. *(Unconfirmed beyond the floors and the pyre:)* each floor holds units up to a size capacity; a deck pairs a primary clan with an allied one; each ring offers two routes whose rewards you can see; Covenant ranks stack difficulty up to 25.

The lesson: positioning by floor rather than on a grid is cheap to read, and still gives every unit a "where."

### Inscryption (Daniel Mullins, 2021)

Act 1 is played on a 3×4 board. The opponent's next cards wait in a back row for a turn before they enter, so you see each threat and its lane a turn ahead. You win by tipping a scale five teeth your way, and cards cost sacrifices (blood) or bones. The map works like Slay the Spire's. Lose twice on a map, or once to a boss, and you become a death card. *(Unconfirmed:)* the campfire offers to boost a card again and again, with a rising, unstated chance that the survivors eat it.

Critics found the later acts' new rules weaker than the first: "nothing gripped me as firmly as the first chapter" (Destructoid).

### Loop Hero (Four Quarters, 2021)

The hero walks a loop on their own. You place terrain cards that strengthen the hero but also spawn enemies, and every tile placed fills the boss meter. Retreating from the camp tile keeps everything; retreating anywhere else keeps 60%; dying keeps 30%.

The push-your-luck is a retreat in three priced tiers, in a world you made harder yourself. PC Gamer's criticism: few new cards arrive late, so the late game flattens.

### Wildfrost (Deadpan Games, 2023)

Every unit has a counter that drops by 1 each turn, enemies first; at 0 the unit acts and the counter resets. Snow stops a counter from counting down. The intent here is *when*, not *what*: the 8-attack brute acts in 2 turns; the 3-attack goblin acts now. The Redraw Bell draws a new hand when its own counter is charged.

Difficulty comes from the Storm Bells: 13 penalties worth 1–3 points each, with up to 5 points active (10 once you have won at the cap). For example:
- Horde Bell (2): waves arrive one round earlier.
- Titan Bell (2): bosses carry charms.
- Dread Bell (3): two enemies in each fight gain a random charm.

Sun Bells are boons chosen after each boss. Criticism: luck can decide too much (Rock Paper Shotgun), and some cards are out of balance (Siliconera).

### Gladiator Manager

Not researched. ARISE already borrows three things from it, per DESIGN.md:
- its Ascension: stacking named rules over 16 levels, opened by league trophies and a tournament;
- its reincarnation bonuses, which became ARISE's Marks;
- its named champions who walk into the world carrying masterworks, which became the Chosen.

---

## 2. Cross-cutting principles

1. **Show the threat, then give a move that answers it.** Slay the Spire's intents, Into the Breach's telegraphs, Inscryption's back row and Wildfrost's counters all do this. Information alone makes a turn readable; the answers (block, push, kill it first, freeze its counter, play into its lane) make it a decision. ARISE shows intents but offers two general answers, killing the foe and Guard, and before C-Rank little in between.
2. **Show the numbers that decide the choice, and nothing else.** Slay the Spire puts one number on an attack intent and keeps everything else as icons. Into the Breach keeps numbers small. Ma would give up a cool idea for clarity. What the player needs to see is how hard this hits me, and whether I can stop it before it lands.
3. **Every fork offers unlike things.** Slay the Spire's generator rejects a fork whose branches lead to the same kind of room. Its campfire weighs health against power. Its boss relics price the same Energy in different currencies.
4. **Push-your-luck needs a rising cost of staying and a cheaper way out, both visible before they bite.** Examples: Darkest Dungeon's torch (−6 a new step, more loot in the dark), DD2's Flame, Loop Hero's 100/60/30 retreat, and DD's quest you can abandon while keeping its loot.
5. **Danger the player opts into, with a stated price and a stated prize.** Burning elites, elites themselves, Storm Bells, boss relics, and DD's torch turned down by hand. The player raises the difficulty where they feel strong.
6. **A second track beside HP.** It lets a fight be won and still cost something. Darkest Dungeon's stress, DD2's Flame and Into the Breach's grid all do this. HP measures this fight; the second track measures the run, and it registers what HP can't: an ally falling, a crit taken, time spent.
7. **Taking control away is expensive.** Afflictions are Darkest Dungeon's signature and its loudest complaint. DD2 cut them down to 4–5% act-outs that read as noise. Mega Crit removed a StS2 boss with a healthy win rate for being over "the complexity threshold." Constrain the player's options; don't take the controls.
8. **Measure, but distrust the measure.** Mega Crit tracked 90 graphs and still learned the Madness lesson. ARISE's calibration plays only the System's way, so it can't see a decision Auto never makes.
9. **A seeded world must not leak.** StS1's identical stream seeds and StS2's linear seed derivation let one roll predict another. StS1's unsaved current room let a `?` room be rerolled.

---

## 3. Ideas for ARISE (ranked)

### What ARISE already does as well as, or better than, these games

- **Intents with targets.** An ARISE intent names its target and is a promise: only the target's death, a stun, or a taunt that shows the new intent changes it. That is closer to Into the Breach than to Slay the Spire, whose single player never needs a target named.
- **The brief.** No game here tells the player their odds. Darkest Dungeon shows a dungeon level and Slay the Spire shows nothing. Twenty-four runs through the real engine has no equal among them.
- **Stated odds on events.** ARISE events state their odds before you choose; Darkest Dungeon's curio results need a wiki.
- **Nothing can be rerolled.** Every step, choice and order is written to the save before it plays. StS1's `?` rooms could be rerolled by save-and-quit.
- **Named random streams.** `rng('arise|raid|<seed>|<index>')` runs the stream's name through the FNV-1a hash into Mulberry32. That is the fix tck.mn recommends after StS2's linear seeds. One test that two streams in the same run don't correlate would make it certain.
- **Stacking Ascension rules.** They stack like Slay the Spire's 1–20, and By Hand (no Auto against the boss) has no equivalent in these games.
- **Loot at stake.** Loot is banked and lost on a wipe, and you withdraw only from the entrance: Darkest Dungeon's commitment without its grind.

### 1. Put the numbers on the intent, and show the round's order *(Slay the Spire, Into the Breach, Wildfrost; small)*

- **What to build.**
  - On each foe's intent, show the damage it will do to its target as a range, after the target's defence and after Guard, with a mark when it is lethal.
  - Above the field, a strip shows the round in initiative order, with foes numbered as in Into the Breach's attack order.
  - Before the hunter taps an action, show its hit chance, damage range and chance to kill.
- **Plugs into.** The `Intent` component in `screens/Arena.tsx`, which today shows "⟶ ability · target" with ×mult in a tooltip, and a pure function in `core/` that reads derived stats and `HIT`, `CRIT` and `SWING`.
- **Decision added.** DESIGN.md says "Guard was a guess"; it becomes arithmetic. Guard when the incoming hit is lethal or large. Kill the foe that acts before you when you can. Chilled and Rooted become visible delays on the strip.
- **Constraints.** UI only, reading the engine's own constants; no recalibration.
  - Show odds and ranges, never the seeded outcome. The engine could show exactly what happens, since a fight is deterministic, but then the dice become a lookup.
- **Cost.** Small.

### 2. A fourth basic action: Cover *(Into the Breach's body-blocking, DD2's Amorous interception; small)*

- **What to build.** From E-Rank the hunter can Cover an ally: the hunter becomes Guarded, and every foe intent aimed at that ally turns on the hunter, shown first as `intent` events, as Challenge does. It is a taunt for one ally that every hunter has.
- **Plugs into.** `act()` in `core/combat.ts`, beside Guard, and the `Acts` row in Arena.
- **Decision added.** Early turns gain a third real choice: hit, Guard, or spend your own HP to save the Association hunter or Shadow about to fall. With #1 it becomes a puzzle: who is about to die, and can I afford their hit?
- **Constraints.**
  - The auto policy never Covers, so Auto, the projection and calibration fight exactly as now, and the test that a hunter who gives no orders fights the auto fight still holds.
  - CLAUDE.md names a taunt as the one thing that changes an intent. Cover becomes the second, by the same mechanism, and the intent test must cover it.
- **Cost.** Small.

### 3. Wind-ups you can break *(Into the Breach's "kill it or move it before it fires", Slay the Spire's Guardian Mode Shift threshold, Wildfrost's Snow; medium)*

- **What to build.**
  - A gatekeeper's or boss's heaviest ability is announced two turns ahead with a break number: "Earthsplitter in 2 · Break 180".
  - Damage dealt to that foe before it fires counts the number down. At 0 the foe is Stunned, which cancels the intent under the existing "unless stunned" rule.
  - A fifth standing order, *Break The Charge*, sends the Shadows at whichever foe is winding up.
- **Plugs into.** `foresee()` (flagged abilities are settled two turns early), `STATUS.Stunned`, `TACTICS`, and the enemy data.
- **Decision added.** Pour everything into the boss to stop the big hit, or Guard and heal through it. Boss fights, where a hunter gets eight to fourteen turns, gain a two-turn plan.
- **Constraints.** Deterministic. The auto policy needs a fixed rule for whether to try the break (for example, try it if the break number is no more than the party's expected damage before the hit), and the brief plays the same rule. Recalibrate.
- **Cost.** Medium.

### 4. Rests: heal or hone *(Slay the Spire's campfire; small to medium)*

- **What to build.** At a rest the hunter takes one of three:
  - Heal, as now.
  - Hone: one equipped skill +1 level, or one Shadow +X%, for the rest of this run.
  - Steady: lift statuses and add one Health Potion to the satchel.
- **Plugs into.** `raid.restHere`; Ascension's `RULES.thinRest` scales Heal.
- **Decision added.** Rests are rare, so the one you find is a commitment point. This makes it a weighing of HP now against a stronger boss fight, which is Slay the Spire's best fork.
- **Constraints.** The System's road takes Heal below a fixed HP line and Hone above it, and the brief plays the same. Recalibrate.
- **Cost.** Small to medium.

### 5. Pacts at shrines *(Slay the Spire's boss relics with drawbacks, Wildfrost's cursed charms; small)*

- **What to build.** A shrine offers its two blessings and, sometimes, a pact: a strong gain for this run with a stated cost. For example:
  - "Attack +30%. No Health Potion can be drunk." (after Sozu)
  - "One more skill slot. In the first round, no intent shows." (after Runic Dome)
  - "Fights bank 50% more shards. No Shadow lingers." (after Ectoplasm)
  - "Every rest heals fully. Fatigue +50% for this Gate."
- **Plugs into.** The shrine blessings in `data/nodes.ts`, the run's `blessings`, and `raid.heroSpec`.
- **Decision added.** The player has to read their own run, and an invested hunter can make a Gate harder in return for a sharper edge.
- **Constraints.**
  - The System's road never takes a pact, as it never takes a choice that hurts, so calibration is untouched. Once a pact is taken, the projection plays it.
  - Every pact must be a rule the engine and the brief can play. The only hidden information allowed is the one the pact states, like Runic Dome's hidden intents.
- **Cost.** Small.

### 6. A burning Gatekeeper on the daily board *(Slay the Spire's burning elites; small to medium)*

- **What to build.** Each day one Gate at the hunter's grade has a burning Gatekeeper, shown on the board with its buff and its prize.
  - The buff is one of four, as in Slay the Spire: more HP, more attack, regeneration or armour.
  - The prize is a blueprint for the hunter's weakest slot, or Shadow Essence.
  - The brief adds a second figure: the clear rate with the Gatekeeper fought.
- **Plugs into.** The board in `core/gates.ts` (seeded from the day), the Gatekeeper room, and `raid.finish`.
- **Decision added.** Danger the player opts into in the middle of the climb. That is where DESIGN.md finds the invested hunter outgrowing the board, and Ascension doesn't open until S-Rank.
- **Constraints.** Seeded from the day; the brief walks a second road for the second figure. The System's road and calibration skip gatekeepers, so no tuning moves. Rerun the campaign, because the prize is new pay.
- **Cost.** Small to medium.

### 7. Items that turn a gamble into a sure thing *(Darkest Dungeon's curios and provisions; small)*

- **What to build.** Some events offer a "use X" choice beside their stated-odds choices, with a stated, certain outcome. The item can be a Health Potion, a Gate Survey, a Mana Potion, or a new key-like item sold at the Exchange. (In Darkest Dungeon, a key opens the Heirloom Chest 100% of the time against 50% by hand.)
- **Plugs into.** The events in `data/nodes.ts`, the bag (`bagFor`), and the Exchange.
- **Decision added.** "What do I carry in?" becomes a question before every Gate, which is Darkest Dungeon's best pre-run decision. It also gives shards somewhere to go at every grade.
- **Constraints.** Each outcome is stated in the event's window; Darkest Dungeon's equivalent needs a wiki. The System's road never spends an item on an event, so the brief and calibration are untouched. Rerun the campaign.
- **Cost.** Small.

### 8. Cash out anywhere, at a stated cut *(Loop Hero's 100 / 60 / 30, Darkest Dungeon's abandon-and-keep-loot; small)*

- **What to build.** A hunter can withdraw from any cleared room and keep 60% of the haul. The entrance still keeps 100%, and a wipe still keeps nothing.
- **Plugs into.** Withdrawal in `core/raid.ts`, and `raid.finish`.
- **Decision added.** Today a deep push is all or nothing until you walk back. A priced exit puts a number on "how much will I risk for the boss," and since walking back to the entrance still pays in full, the cut buys you out of the rooms in between.
- **Constraints.** One engine call still settles the run. Auto never cashes out early, so calibration doesn't move; the campaign does. Test that no one can cash out in the middle of a chamber.
- **Cost.** Small.

### 9. Front and rear *(Darkest Dungeon's ranks, Monster Train's floors; large)*

- **What to build.**
  - Two ranks a side.
  - Single-target melee can reach only the front rank while anyone stands in it. `volley`, `spread` and magic reach either rank, and a few skills can only be used from the front, or only from the rear.
  - Swapping ranks costs a turn, and a few foes push or pull.
  - The hunter picks a rank before each fight or keeps the last one; Shadows take ranks by role.
- **Plugs into.** `core/combat.ts` (`targets()`, `aim()`, and a rank rule on each `REACH` profile), `UnitSpec`, and the fight's layout: two rows a side in portrait.
- **Decision added.** The biggest gain in depth on this list: who stands in front of the hunter, which foe you can reach, and a reason for cleave and volley to exist.
- **Constraints.** Deterministic, but the auto policy and every standing order need rank rules, followed by a full recalibration and a campaign. Keep it to two ranks: Darkest Dungeon's four, with a use-from and a reach list on every skill, is too much to read on a phone.
- **Cost.** Large.

### 10. Composure: a second track for the run *(Darkest Dungeon's stress, DD2's 0–10 scale; medium to large)*

- **What to build.**
  - The hunter has Composure, 10 pips.
  - It is lost to crits taken, an ally falling, each floor crossed without a rest, and abilities made to cause dread. Potions never restore it; a rest restores some.
  - At 0 comes a test with stated, seeded odds: Shaken (a stated stat drag until the next rest) or Steeled (a stated buff and a heal).
  - It never takes the controls away; ARISE's first pillar is that your choices win fights.
- **Plugs into.** The open run (`core/raid.ts`), the strip on the map, the Guide, and hooks like the one Ascension's Worn Thin rule uses.
- **Decision added.** A run can go wrong while HP looks fine, which gives the hunter a reason to withdraw before a wipe. Steeled is the heroic reversal Darkest Dungeon's designers call what "memorable adventures are built on."
- **Constraints.** Deterministic, seeded from the run and the room, and played by the projection and the brief. Recalibrate. Make sure it doesn't read as a second fatigue meter.
- **Cost.** Medium to large.

### 11. Writs past Ascension 10 *(Wildfrost's Storm Bells, Slay the Spire's Ascension; medium to large)*

- **What to build.** Past the ten levels with a rule of their own, the hunter chooses writs worth points instead of taking a flat +8% a level, and the level is their sum. Example writs: a burning Gatekeeper every time, intents hidden in the first round, foes act first in the opening round, no Gate Survey, one more Chosen in the gauntlet.
- **Plugs into.** `data/ascension.ts` and `core/ascension.ts`, after `ASCENSION_RULED` (today `BEYOND.growth`).
- **Decision added.** A top-end hunter shapes their own challenge around their build, instead of only climbing a number.
- **Constraints.** Calibrate each writ's weight once. The brief plays the exact combination chosen, so its odds stay honest even where weights don't add up. That honesty is what makes point-buy safe in ARISE where it isn't in Wildfrost.
- **Cost.** Medium to large.

### 12. Reinforcements you can see and deny *(Inscryption's back row, Into the Breach's spawn tiles; medium)*

- **What to build.** Some chambers queue a reinforcement a round ahead: "Two Ghouls arrive next round." Covering the breach (#2), or a hit on the queued unit above a stated threshold, delays it by a round.
- **Plugs into.** `battle()` in `core/combat.ts`, and the chamber data.
- **Decision added.** Answer the threat that hasn't arrived yet, or the one already hitting you.
- **Constraints.** The auto policy gets a fixed rule for it. Recalibrate.
- **Cost.** Medium.

### 13. Every fork different *(Slay the Spire's map rules; medium)*

- **What to build.** Three rules for the labyrinth draw:
  - A room with two or more unexplored exits leads to rooms of different kinds.
  - No two gatekeepers or rests are adjacent.
  - At least one rest is guaranteed within N rooms of the stairs or the boss.
- **Plugs into.** The map draw in `core/map.ts`.
- **Decision added.** Every fork in the fog becomes a choice between unlike things.
- **Constraints.** CLAUDE.md forbids changing how an older layout draws, so this needs a new `labyrinth` version. Recalibrate and rerun the campaign.
- **Cost.** Medium.

### Considered and not recommended

- **Into the Breach's Reset Turn.** An ARISE fight is deterministic for a seed and a list of orders, so a rewind would reveal the seeded rolls: it is a reroll, which CLAUDE.md forbids.
- **Darkest Dungeon's afflictions acting on their own.** They break "your choices win fights."
- **DD2's random affinity.** Its 4–5% act-outs read as noise, and if they moved an ally's target they would break the promise of a shown intent.
- **Darkest Dungeon's corpses.** Contested among its own players, and every corpse is one more unit the auto policy and the UI must handle.

---

## 4. Sources

**Slay the Spire and Slay the Spire 2**
- https://kosgames.com/?p=26769
- https://saschb2b.github.io/game-mechanics/games/slay-the-spire/map-and-nodes
- https://saschb2b.github.io/game-mechanics/games/slay-the-spire/design-tensions
- https://lr.eu.psf.lt/r/slaythespire/comments/7w51qz/almost_everything_about_question_mark_nodes
- https://gist.github.com/luckytyphlosion/e1c1fd8b445e7df406ad4bc480f9dcdd
- https://slaythespire.wiki.gg/wiki/Event
- https://slaythespire.wiki.gg/wiki/Ascension
- https://slaythespire.wiki.gg/wiki/Elites
- https://slaythespire.wiki.gg/wiki/Rest_Site
- https://slaythespire.wiki.gg/wiki/Shop
- https://slaythespire.wiki.gg/wiki/Relics_List
- https://slay-the-spire.fandom.com/wiki/Card_Rewards
- https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder
- https://www.gamedeveloper.com/disciplines/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-
- https://gamedeveloper.com/game-platforms/watch-casey-yano-break-down-the-design-decisions-behind-i-slay-the-spire-i-
- https://news.denfaminicogamer.jp/interview/200117b
- https://readray.ai/notes/1046045
- https://briefread.pages.dev/en-GB/summary/slay-the-spire-metrics-driven-design
- https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019
- https://forgottenarbiter.github.io/Correlated-Randomness
- https://tck.mn/blog/correlated-randomness-sts2/
- https://slaythespire2.gg/news/mega-crit-ama-reddit-feb-2026
- https://sts2-calculator.pages.dev/v101-map-system-changes
- https://sameteem.com/threads/slay-the-spire-2-patch-rips-act-3-boss-doormaker-out-the-game-developer-explains-decision.34270/
- https://www.gosugamers.net/entertainment/news/78295-slay-the-spire-ii-update-targets-ascension-economy-and-top-builds-in-latest-patch
- https://playpile.gg/blog/slay-the-spire-2-early-access-everything-you-need-to-know-before-march-5

**Darkest Dungeon and Darkest Dungeon II**
- https://darkestdungeon.wiki.gg/wiki/Stress
- https://darkestdungeon.wiki.gg/wiki/Virtue
- https://darkestdungeon.wiki.gg/wiki/Death%27s_Door
- https://darkestdungeon.wiki.gg/wiki/Light_Meter
- https://darkestdungeon.wiki.gg/wiki/Camping
- https://darkestdungeon.wiki.gg/wiki/Provisions
- https://darkestdungeon.wiki.gg/wiki/Curio
- https://darkestdungeon.wiki.gg/wiki/Expedition
- https://darkestdungeon.wiki.gg/wiki/Relationships
- https://darkestdungeon.wiki.gg/wiki/Meltdown
- https://darkestdungeon.wiki.gg/wiki/Flame
- https://darkestdungeon2.wiki.fextralife.com/Stress
- https://gamedeveloper.com/design/game-design-deep-dive-i-darkest-dungeon-s-i-affliction-system
- https://gamedeveloper.com/business/-i-darkest-dungeon-i-designing-for-despair-and-kicking-you-when-you-re-down
- https://www.gamedeveloper.com/design/how-i-darkest-dungeon-i-mirrors-the-real-highs-and-lows-of-game-development
- https://www.superjumpmagazine.com/exploring-the-darkness-tyler-sigman-talks-about-co-creating-the-darkest-dungeon-games
- http://www.gamebanshee.com/kucrr
- https://gdcvault.com/play/1023089/Darkest-Dungeon-A-Design
- https://www.killscreen.com/darkest-dungeon-explores-psychological-horror-dungeon-crawl/
- https://www.pcgamer.com/how-darkest-dungeon-got-inspiration-from-band-of-brothers-and-aliens
- https://steamcommunity.com/app/262060/discussions/0/154643982160456087
- https://en.wikipedia.org/wiki/Darkest_Dungeon_II
- https://www.gamepressure.com/darkest-dungeon-ii/loathing/z1f07d
- https://gamespot.com/articles/darkest-dungeon-2-affinity-how-does-affinity-work/1100-6510587/

**Into the Breach**
- https://www.gdcvault.com/play/1026333/contactUs
- https://stevelilleyschool.blogspot.com/2019/04/gdc-2019-talks-into-breach-and-dead.html
- https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach
- https://gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-
- https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-
- https://kotaku.com/the-creators-of-into-the-breach-came-very-close-to-givi-1833498295
- https://en.wikipedia.org/wiki/Into_the_Breach

**Monster Train, Inscryption, Loop Hero, Wildfrost**
- https://en.wikipedia.org/wiki/Monster_Train
- https://en.wikipedia.org/wiki/Monster_Train_2
- https://en.wikipedia.org/wiki/Inscryption
- https://en.wikipedia.org/wiki/Loop_Hero
- https://en.wikipedia.org/wiki/Wildfrost
- https://wildfrostwiki.com/Counter
- https://wildfrostwiki.com/Storm_Bells

**ARISE (read, not edited)**
- /home/user/ARISE-FITNESS-APP/README.md
- /home/user/ARISE-FITNESS-APP/docs/DESIGN.md
- /home/user/ARISE-FITNESS-APP/src/core/combat.ts
- /home/user/ARISE-FITNESS-APP/src/core/util.ts
- /home/user/ARISE-FITNESS-APP/src/data/ascension.ts
- /home/user/ARISE-FITNESS-APP/src/screens/Arena.tsx
