# Traditional and mystery-dungeon roguelikes: research for ARISE

Scope: Shiren the Wanderer (6 and the series), Pokémon Mystery Dungeon, Brogue / Brogue CE, Dungeon Crawl Stone Soup, Shattered Pixel Dungeon, NetHack, Cogmind, Caves of Qud, Tangledeep, Dungeons of Dredmor, Barony, Crypt of the NecroDancer.

**How the facts were checked.** Where a game's source is public, I read it directly: Brogue CE, Shattered Pixel Dungeon, DCSS's Zot clock and its god texts, and pret's decompilation of PMD Red. Numbers taken from code are marked *(source)*. For the rest I used developer interviews, the DCSS manual, the Cogmind manual, and community wikis. **Gaps:**
- The shared web-search quota ran out after about 26 searches, so I worked from direct fetches after that.
- Several hosts were blocked: Fandom wikis (Brogue, PMD), Bulbapedia, Reddit, and wiki.gridsagegames.com, which this session's network settings would have to allow.
- Brian Walker's design talks are audio only (Roguelike Radio 2011, The Spelunky Showlike 2019). I could not listen to them, so his reasoning comes from his release notes and his code.
- Tangledeep, Dredmor and Barony are thin: their store pages only.
- Anything I could not confirm is marked *(unconfirmed)*.

---

## 1. Game by game

### Shiren the Wanderer 6 (The Mystery Dungeon of Serpentcoil Island) and the series

**Loop.** You start every run at Level 1 at the foot of a dungeon of about 30 floors and climb on what you find. Death takes the run's items and money. What carries over is gear left in the village warehouse, unlocked side dungeons, and what you know.

**Signature mechanics**
- **Fullness (hunger).** Maximum 100, and it can rise to 200. It falls 1 point every 10 turns. At 0 you lose 1 HP a turn and stop regenerating. An Onigiri restores 50, a Large Onigiri 100 (+4 maximum if eaten at full), and a Rotten Onigiri 30 plus 5 damage and a random bad effect (Shiren 5/6 wiki). Fire roasts carried Onigiri, and water rots them and wets scrolls, so the clock reaches your inventory as well as your HP.
  - The Shiren 6 developers changed the system because players were beating the game by pushing Fullness to 200%. Shinozaki said that was "one of the strategies for beating the game", and Sakurai said they wanted "an empowered state that could be more clearly and easily obtained" (Nintendo Life). That became Sumo Power.
- **The Winds of Kron.** A turn limit on each floor. In Shiren DS there are warnings at 300, 200 and 100 turns left. Being blown away counts as a defeat and costs everything. In Shiren 6's Forest of Frugality the first gust comes at 900 turns.
- **Identification.** Scrolls, grass, staves, pots and bracelets get random names each adventure.
  - **By use.** A scroll is identified when read and grass when eaten. Thrown grass stays unknown.
  - **By price.** An item sells for 40% of its buy price. Blessed items cost double and cursed ones 13% less. Price tiers narrow the possibilities: a 1,000G scroll is one of 15 kinds, a 3,000G scroll is Expulsion. Price checks cost nothing, so they reward knowing the tables.
  - **By tool.** An Identifier Scroll sometimes identifies everything you carry, and always does when blessed. An Identifier Pot identifies whatever goes in, but you must break it to get the items back.
  - **Naming and the checklist.** You can name an unknown item, and a checklist records what you have confirmed.
  - **Always known.** The Escape Scroll is identified from the start, so the way out is never a gamble (Sharksnack guide).
- **Pots.** Containers with a capacity of 2 to 5, each with a rule: Storage, Synthesis, Identifier, Hiding, and so on. A tap-type pot is identified by tapping it; a put-in type, by what happens to what you put in.
- **Synthesis (melding).** Put a weapon or shield into a Synthesis Pot, or throw it at a Mixer-family monster. The first item in is the base, and it keeps "the added Upgrades and Runes of everything that came after". Staves of one kind merge their charges: two Sluggish Staffs [5] make one [10]. Seal (rune) slots limit what a weapon can hold. I could not confirm a mechanic called "Kaburi" in any English source; 被り means overlap or duplicate, and the term may be community slang *(unconfirmed)*.
- **Monster Houses.**
  - **Entering.** A room full of sleeping monsters, items and hidden traps. Entering wakes them all and shows every monster on the floor on your map.
  - **Reading one.** You read it from outside: items near the doorway, an arrow shot in, a Scout Bracelet.
  - **The standard answer.** Retreat to a corridor so they come one at a time, or read a room-wide scroll. Lightning does about 30 damage to everything (Sharksnack).
- **Rescue.**
  - **Requesting.** A fallen player posts a Rescue ID, and is allowed 3 rescues per run.
  - **Rescuing.** The rescuer starts at Level 1 on floor 1 of a dungeon that closely matches the one where the other player fell. Retries use the same seed, within a 7-day window, and the rescuer keeps nothing from the dungeon.
  - **Rewards.** Rescuers earn Aid Points, which buy boosts on later rescues.
  - **Self-rescue.** New in 6 and works offline. You play your own rescue and earn no Aid Points.
  - **On success.** The rescued player keeps all progress (Final Weapon guide).
- **Turn economy.** Every action is one turn: walking, attacking, reading, throwing. Turn order, corridor position and diagonals decide fights. Shiren 6 adds four projectile shortcut slots for staves, rocks and arrows, which the wiki compares to PMD's moves.

**Why it works.**
- **Consistency.** Patrick Casey (Game Developer) credits Shiren with the rule that items work the same on the player, monsters and NPCs, which makes item knowledge pay off in fights. His example is the Rice Changer, a monster that turns an inventory item into a riceball and is weak to a thrown riceball.
- **Loss and retry.** Sakurai: "The tension of starting over if you fall, combined with the addictive desire to try again, was a key focus" (RPG Site).
- **Gear over level.** Casey: level mostly buys HP, while "your gear is what determines if you live or die". Loot is a means, not the reward.

**Criticisms.**
- Shinozaki admits "challenging and less intuitive aspects".
- It is hard to learn without price charts.
- A Monster House, a trap or a Kengo can end a long run in one turn.
- Casey argues that the easy mode's removal of item loss throws away "half the experience".
- Automaton's interview headline: the series' fastest-selling entry "struggling to take off in the West".

### Pokémon Mystery Dungeon (Red/Blue, Explorers, later)

**Loop.** Take a job from the board (rescue, deliver, escort), walk a randomised dungeon with a team, and bank Rescue Points and items in town. Defeat in Explorers costs all your money and half or more of your items (Wikipedia).

**Signature mechanics**
- **Recruitment** (PMD Red decompilation, *source*).
  - **Who.** Only a KO by the team leader can recruit. The leader must be within one tile of the target and able to see it.
  - **The roll.** A roll of 0–999 must come in under: the species' rate, plus 100 for a Friend Bow, plus a level bonus.
  - **The level bonus.** 0 below Level 30; then +50, +75, +100, +125, +150 and +175 per decade from 30 to 89; +240 at 90 and up.
  - **Exceptions.** A rate of −999 means the species cannot be recruited. Legendaries can be recruited once.
  - **Limits.** A team takes 4 members, with a total "body size" of 6, so large Pokémon crowd out others.
- **Team tactics and IQ.** Partners follow chosen orders, and IQ skills give them behaviours. *(Unconfirmed in detail: Bulbapedia blocked.)*
- **Rescue missions.** Wonder Mail codes and friend rescues. In Explorers, while a team waits for rescue it can "standby" in earlier dungeons for money and items, but cannot level.

**Why it works.**
- **Allies are earned.** You get them by a risky act: the leader has to land the KO.
- **Allies are shown on the field.** Body size makes team composition a spatial budget, not a count.
- **The genre's harshness turns social.** Rescue makes a defeat someone else's quest. Ishihara (Iwata Asks): "Players compete with each other to be defeated in ever more impressive ways!"

**Criticisms.**
- Repetition: IGN 6.5, Metacritic 59–60 for Explorers.
- Partner AI wastes items. Casey says there is no good middle ground between AI allies and full manual control.
- Low recruit rates mean grinding the same floor for one species.

### Brogue / Brogue CE

**Loop.** 26 floors to the Amulet, 40 for lumenstones. There are no classes, and since v1.7 no experience. Power comes only from items found by exploring.

**Signature mechanics** (*source*, Brogue CE)
- **No XP.**
  - **Release note.** v1.7: "Removed experience from the game to reward exploration instead of combat."
  - **What replaced it.** Max HP comes from Potions of Life, strength from Potions of Strength, and everything else from Scrolls of Enchanting. Enchanting is the hub decision of every run.
- **Metered generation.** The game remembers what it has given you.
  - **Scrolls of Enchanting.** Generation weight starts at 60 and gains 30 a floor; each one generated drops it by 50. For scale, Identify's fixed weight is 30 and Teleportation's is 10.
  - **Potions of Strength.** Start at 40, +17 a floor, −50 each.
  - **Potions of Life.** Forced whenever (number generated × 4 + 3) falls below the depth, with a random ±2 offset. That is roughly one every four floors after the first few.
  - **Food.** Guaranteed at about "one ration every four levels".
  - **Items per floor.** 3, plus a 60% chain of extras, plus 2 on floors 1–2 and 1 on floors 3–4.
- **Allies.**
  - **Captives.** Captives are monsters held in shackles by their own kind, or in caged vaults. Freeing one costs one turn: "you free the grateful %s and gain a faithful ally."
  - **Learning from the fallen.** An ally with an open power slot walks to the corpse of a creature with an ability it lacks and spends 20 turns absorbing it, then keeps the ability.
  - **Wand of Empowerment.** +12 max HP, +10 defence, +10 accuracy, +10% damage, and one more learning slot.
  - **Exploration bond.** Allies gain "xpxp" for every new walkable tile you discover. They gain nothing for kills. At 1,400 tiles they form a telepathic bond, and you see what they see. The Companion feat comes at 10,400 tiles, "about 13 depths".
  - **Design note.** v1.7.3 "redesigned ally progression to make allies feel less compulsory and capricious."
- **Terrain.**
  - **Deep water.** Each turn in it has a 50% chance to float away one random unequipped item.
  - **Hazards.** Fire spreads through grass, gas spreads and burns, chasms drop you a floor (into water, unharmed), and lava kills.
  - **The promise.** "Levels can generally be explored fully without venturing into or over lava, chasms, traps or deep water." Hazards are options, never toll gates.
- **Seeds.** Every floor's seed is rolled at game start, so a seed gives the same dungeon whatever you do. Cosmetic randomness runs on a separate stream. Recordings replay from inputs, which is ARISE's model exactly.
- **Identification.** By use, by Scroll of Identify, and by detect magic, which marks items as benevolent or malevolent. Malevolent kinds (aggravate monsters, summon monsters) have their own low weights.

**Why it works.**
- **Exploring is the only power source.** So you explore. Monsters become obstacles, and avoiding them is a real strategy (Waltorious: "Exploration, not fighting, is how you get more powerful").
- **One target for enchanting.** The scrolls are fungible, and committing them to one item is the run's build.
- **Metering bounds variance.** Every run gets roughly the same power budget. What varies is what you can spend it on.

**Criticisms.**
- Runs live or die by the early enchant target.
- Out-of-depth packs such as goblin conclaves and early ogres feel unfair.
- You cannot command allies.
- No classes is too thin for some players (Steam thread on the removal of classes and XP).

### Dungeon Crawl Stone Soup

**Loop.** Choose a species, background and god. Descend 15 Dungeon floors and the branches, take at least 3 of the 15 runes, enter Zot, and carry the Orb out.

**Signature mechanics**
- **The manual's stated goals.**
  - Major: "challenging and random gameplay, with skill making a real difference"; "meaningful decisions (no no-brainers)"; "avoidance of grinding (no scumming)"; "painless interface and newbie support".
  - Minor: "clarity (playability without need for spoilers)" and "qualitative feedback is often better than precise numbers".
- **Anti-grind.**
  - Grinding is defined as "activities that have low risk, take a lot of time, and bring some reward… it may be optimal to do so. We try to avoid this!"
  - Consequences: "shops don't buy" (otherwise you would "hoover the dungeon for items to sell"), floors are permanent, and there are "strong forces driving characters deeper".
- **The Zot clock** (0.26 replaced food with it, *source* zot.cc).
  - **The clock.** Each branch has one. A new branch starts with 6,000 turns. Each new floor adds 6,000, capped at 27,000.
  - **Warnings.** At under 1,000, 500 and 100 turns left: "You have lingered too long. Zot senses you. Dive deeper or flee this branch".
  - **At zero.** You permanently lose 3 + max HP / 6 of maximum HP, and the clock resets to 1,000 turns.
  - **Rationale.** The release note's only reason: it "prevents players from lingering too long in one branch."
- **Gods as conducts.**
  - Okawaru forbids "gaining allies by any means" and "pays little heed to easy victories".
  - Trog forbids "the use of spell magic".
  - Ru offers three random permanent sacrifices at a time. Losing a hand is worth 65 piety, 10% of max HP 35, fire and cold vulnerability 50. You may refuse a batch. Piety never decreases and caps at 160 (crawl.chaosforge wiki).
- **Runes.** Of the 15 runes, 3 open the endgame and the rest are bragging rights. The manual mocks them: "a meaningless achievement in any regard".

**Why it works.**
- **No no-brainers.** "wherever there's a no-brainer… the development team put a lot of effort into providing a 'choice' that's really not an interesting choice at all."
- **Conduct gods.** They turn a restriction into identity and power, so a player picks a harder game for a reason.
- **The Zot clock.** It removes food tedium while still pushing you down.

**Criticisms.**
- The Zot clock is called "a hard cap on how long you can even exist" (itch.io comment).
- Feature removals (food, identification friction) divide veterans.
- The manual accepts that "unavoidable deaths can occur" by design.

### Shattered Pixel Dungeon (the phone roguelike)

**Loop.** 25 floors in five regions of five, with a boss every fifth floor. Short floors and a few hours a run. Built for Android first, with releases on iOS and desktop.

**Signature mechanics** (*source*)
- **Hunger.** +1 a turn. Hungry at 300, Starving at 450, and starving costs max HP / 1000 a turn. A ration gives 300; small food is a third or half of that.
- **Metered progression.** Per five-floor region:
  - exactly 3 Scrolls of Upgrade, 2 Potions of Strength and 1 Arcane Stylus;
  - one alchemy lab room, on floor 3 or 4.
  - Spawn chances are "floors left / scrolls left", so the count is fixed and only the floor varies.
- **Anti-grind in code.**
  - A monster pays no XP once the hero's level is above its `maxLvl`, and drops nothing once the hero is 2 levels past that.
  - Health potion farming was cut "more harshly": drops "lower in probability more quickly after potions have already been dropped from a given enemy type" (v0.6 changelog).
- **Identification that cannot be farmed.**
  - **Uses to identify.** Weapons identify after 20 uses, armour and wands after 10.
  - **Banking.** A weapon can only bank half its uses until you gain XP. "The Identification system has been adjusted to require EXP gain in addition to item uses. This change prevents exploits where an item could be used in unintended ways to rapidly ID it" (v0.7).
  - **Starting knowledge.** Every hero starts with 3 identified kinds, so alchemy can begin early.
  - **Alchemy cross-links.** A potion brewed from 3 of the same seed is identified. Unidentified scrolls can be turned into runestones and are identified in the process.
- **Talents.** Tiers open at Levels 2, 7, 13 and 21. Level 30 is the cap. Tier 4 adds armour abilities: "up to 10 points available in tier 4, for levels 21-30".
- **Challenges.** 9 toggles, each a bit in a mask: No Food, No Armor, No Healing, No Herbalism, Swarm Intelligence, Darkness, No Scrolls, Champion Enemies, Stronger Bosses.
- **Trinkets.** Upgradable items, made at the alchemy pot, that bend dungeon generation:
  - the Mimic Tooth makes mimics more frequent and dangerous;
  - the Rat Skull makes rare foes "appear far more often";
  - the Salt Cube makes food last longer but heals you less;
  - the Shard of Oblivion draws "power from your ignorance".
- **Touch UI.**
  - Four quickslots with auto-targeting (v0.3.1), and a quick-use window on long-press.
  - Daily runs and custom seeds with a performance score (v1.x).
  - Evan rebuilt the changelog because "Long text-based changelogs just don't work on mobile screens."

**Why it works.**
- **Fixed counts per region.** A short phone run never starves you of upgrades.
- **Knowledge comes from playing.** You cannot farm it with a rat and a dagger.
- **Opt-in difficulty.** Challenges and trinkets let experts make their own harder or stranger game, and every run still uses the same dungeon.

**Criticisms** *(no player sources fetched)*.
- Early deaths to bad floors.
- Pouring every upgrade into one item makes builds alike.
- Alchemy's recipe load.

### NetHack

**Loop.** Fifty-odd levels with the Amulet at the bottom, and the most interactions in the genre.

- **Price identification** (NetHackWiki).
  - **Buying.** Base price × Charisma multiplier, from 2 at Charisma ≤5 to ½ at ≥19. A "sucker" markup of ⅓ applies to Tourists below Level 15 and to anyone in a dunce cap.
  - **The disguise.** About 1 in 4 unidentified items carry a random ⅓ surcharge, so a price can pass for another.
  - **Selling.** Usually ½ the base price; 1 in 4 shopkeepers pay ¼ less for unidentified items.
  - **Scroll tiers.** 20 identify, 60 enchant weapon or blank, 80 enchant armour or remove curse, 300 genocide or charging.
- **"The DevTeam Thinks of Everything".** Odd actions get specific, consistent answers:
  - dipping a potion into itself;
  - a bag put into itself;
  - a blindfold taken off while blind;
  - praying to an angry god, which brings a lightning bolt, then disintegration, then something larger.
- **Why it works.** Every object has several verbs, and the world answers each one consistently. Players learn rules, and the rules compound.
- **Criticisms.** Spoilers are close to required, and price identification is bookkeeping.

### Cogmind

**Loop.** A robot climbs from the depths and is built entirely from parts salvaged off what it destroys. Parts break all the time.

- **No XP.** "There is no XP to gain from taking on everything you see". At each new depth the core evolves: +150 integrity from a base of 250, and new part slots that you choose. The manual tells you to leave a map early.
- **Salvage.**
  - A destroyed robot's parts survive with a chance based on their remaining integrity, adjusted by the weapon that destroyed it: cannons and explosives lower the chance, guns generally have no effect.
  - Attaching a part costs 20 energy, 10 matter and 100 time units.
  - A faulty prototype cannot be told from a working one without testing.
- **Alert.** Hacks, disabled machines and violence raise it, which brings investigations, assaults and extermination squads. It decays with turns and drops further when you change maps. Exact thresholds are *(unconfirmed)*: the wiki host is blocked.
- **Why it works.** Attrition and alert replace a food clock with pressure that comes from your own choices: you are loud, so they come.
- **Criticisms.** Constant part loss. The developer ships "RPGLIKE", an XP mode, for players who want "more attachment to their build".

### Caves of Qud

- **Liquids.** Liquids mix and stack effects: "a pool of inky sugary bloody water".
- **Depth by volume.** Under 200 drams is a puddle, up to 1,999 a pool, 2,000 or more a deep pool.
- **Behaviour.** Liquids conduct (impure water well), burn (oil easily, water not at all) and freeze slippery.
- **Containers.** Lava burns the container that carries it, and acid eats organic ones.
- **Currency.** Fresh water is the money.
- **Lesson.** A small set of physical properties produces a large set of interactions nobody wrote by hand.

### Tangledeep, Dungeons of Dredmor, Barony (thin)

- **Tangledeep.**
  - 12 jobs and "over 100 skills".
  - Capture nearly any monster as a pet, raised and bred in the Monster Corral.
  - Item Dreams: randomised mini-dungeons inside a piece of gear that upgrade it.
  - Adventure Mode "removes the pain of permadeath".
  - 10+ Game Modifiers, and daily and weekly challenge runs.
- **Dredmor.** "Choose from a selection of mind-boggling skills" (the count chosen is *unconfirmed*), and "incredibly complicated crafting".
- **Barony.** First-person, 1–4 players, 13 classes, permadeath, "cryptic dungeons, and no handholding". Hunger and unidentified items are from memory *(unconfirmed)*.

### Crypt of the NecroDancer

- **Rhythm.** You move only on the beat, and every enemy has a fixed pattern on the beat. Skeletons, for example, act every other beat. A chain of clean kills raises the coin multiplier.
- **Ryan Clark's aims.**
  - Deaths should feel like the player's fault: "a game that is really hard but you can still improve. If you die, you still know it was your fault."
  - He kept the turn feel by tying turns to the beat.
  - He widened the timing window and added auto-calibration when stressed players missed it.
- **Lesson for ARISE.** Readable, learnable foe patterns: knowing a monster *is* skill.

---

## 2. Cross-cutting principles

1. **Knowledge as progression has to be earned by playing, not by grinding.**
   - **The pattern.** Shiren identifies by use, price and tool. SPD's identification needs XP, so it cannot be farmed. Brogue's bonds come from exploring, not killing. Shiren's checklist and notebook record what is known.
   - **What it gives you.** Every run starts a little stronger even though the character starts at nothing.
   - **What it needs.** The thing being learned must matter in a fight (Shiren's item consistency) and must be cheap to record. The flip side is DCSS's warning that spoiler-only knowledge is fun "once".
2. **Meter the good stuff and let the location vary.**
   - Brogue's generation weights rise and fall, and SPD gives a fixed count per region.
   - Both bound a run's power budget, so luck decides *what* you can build, not *whether* you can.
   - This is how they hold "every item useful" and "no grind" together.
3. **Anti-grind is enforced in the payout, not the prose.**
   - SPD: no XP above `maxLvl`, no drops at +2, potion drop odds that fall with each one dropped.
   - DCSS: shops that don't buy, and Okawaru ignoring easy kills.
   - Brogue: no XP at all.
   - Each sets the payout of low-risk repetition to zero rather than asking players not to do it.
4. **A clock inside the run pushes forward.** Two kinds:
   - **Consumable clocks.** Shiren's Fullness and SPD's 300/450. These double as inventory pressure.
   - **Place clocks.** Shiren's wind, DCSS's 6,000 turns a floor with warnings at 1,000/500/100, Cogmind's alert.
   - **The trend is away from food.** DCSS dropped it, and Cogmind's developer said "players are tired of actually food-based hunger clocks" (r/roguelikedev, as quoted in search results). The clocks that remain are tied to the place and announced in stages.
5. **Allies in a solo game should be found, not owed, and should never be compulsory.**
   - **Earned by risk or choice.** PMD recruits only from a leader's KO. Brogue's allies are captives you choose to free, mid-fight if need be. DCSS's Okawaru pays you to go alone.
   - **Steered, not puppeted.** PMD tactics, ARISE standing orders.
   - **Brogue's lesson** (v1.7.3): allies that feel "compulsory and capricious" had to be redesigned.
   - **ARISE's position.** Its Shadow army is much larger than any of these teams: PMD's is 4 members and Brogue's a handful. That makes the compulsory risk bigger, and makes a reason to sometimes go without worth having.
6. **The environment is a second toolbox.**
   - Brogue's fire, gas and water, Qud's liquids, Shiren's water rotting onigiri, NetHack's consistent physics.
   - The rule that keeps it fair is Brogue's: hazards are optional, and both sides obey them.
7. **Restrictions sold as identity.** DCSS conduct gods and Ru's sacrifices, Brogue's feats ("Pure Mage", "Paladin"), SPD's challenges and trinkets. Each is opt-in and named, and most pay something.
8. **Determinism defeats save-scumming.**
   - Brogue rolls every floor's seed at start and records inputs.
   - SPD offers seeded daily runs.
   - Shiren 6 rescue retries on the same seed.
   - Once rerolling changes nothing, the honest move is the only move.
9. **On a phone, depth must fit a tap.** SPD: four auto-targeting quickslots, long-press quick-use, short floors, a fixed upgrade count per region, and a changelog redrawn for small screens.

---

## 3. Ideas for ARISE, ranked

**Context that shapes the ranking.**
- **ARISE's own findings.** Early turns are shallow (2 skills at D-Rank), Auto carries most play, invested hunters reach 97% clears mid-climb, and shards pile up at the top.
- **The bag.** Three of its six wheel slots are empty.
- **Fights have no positions.** They are lists with reach (single, cleave, volley, all), so "terrain" has to be a room-wide rule, not tiles.
- **A precedent to keep.** Auto, the brief and calibration never drink potions, so purely player-side consumables leave the honest clear rate as a floor without needing recalibration.

### 1. A field kit: thrown items in the empty wheel slots
**Source.** Shiren 6's projectile shortcuts, SPD's quickslots, Casey's "no useless items" with push and pull.

**Build.**
- **The items.** Three to four throwables, each an order of the form `{item, target}` written by `raid.order` like any skill, so `raid.resume` replays it:
  - **Flash Vial:** Stunned on one foe. A stun is already the stated exception to an intent's promise.
  - **Binding Cord:** Rooted, 2 turns.
  - **Smoke Pot:** Veiled on the party.
  - **Ember Flask:** Burning on up to 3 foes.
- **Rolls.** Each is seeded from the run and node, like a skill.
- **Where they live.** Each takes a slot in `bagFor`.
- **Limits.** A small carry cap per kind, as the satchel has.
- **Where they come from.** Caches, Ryn and the Exchange.

**What it adds.**
- **Early fights.** A D-Rank turn becomes a real choice: spend the Flash on the foe whose intent is a heavy hit at the hunter, or hold it for the boss.
- **Top-end economy.** A consumable sink for shards.

**Constraints.** Deterministic, and one-handed (target, then tap). Auto and calibration never throw, following the potion precedent, so no tuning moves. The brief should say it assumes no items. Rewriting the auto policy to throw would come later, with a recalibration.

**Cost.** Small to medium.

### 2. Vows: opt-in rules for a Gate, from C-Rank
**Source.** DCSS conduct gods (Okawaru: no allies; Trog: no spells), SPD challenges, Brogue feats.

**Build.**
- **The vows.** Before entering, the hunter may take vows:
  - Walk Without the Association: no NPC hunters.
  - Alone: no Shadows. This is Okawaru.
  - Dry Satchel: no potions.
  - Two Skills Only.
  - The Boss by Hand.
- **Pay.** Each pays a stated percentage more XP, shards and materials, settled in `raid.finish`.
- **On the run.** The vows are kept on the run, like `run.ascension`.
- **The brief.** It simulates every simulable vow, because each is just a party or rule change, so the clear rate stays honest.
- **Daily Quests** can name a vow.
- **Plumbing.** Reuse Ascension's rule machinery. Vows are a pick-your-own subset of its rules, available before S-Rank.

**What it adds.**
- **The difficulty gap.** It answers "an invested hunter outgrows the difficulty mid-climb" without changing calibration. The hunter turns the difficulty up and is paid for it, the way DCSS makes restriction an identity.
- **Auto.** The Boss by Hand gives a reason to stop leaning on Auto.

**Constraints.** Off by default, so calibration is unaffected; `npm run balance` should report the clear rate under each vow. No time is sold.

**Cost.** Small to medium.

**Already done.** Ascension is ARISE's SPD Challenges, done better: stacked, each level opened by a Trial and paid with marks.

### 3. Room conditions, with one lever
**Source.** Brogue's terrain (optional, and it binds both sides), Qud's liquids, Shiren's water.

**Build.**
- **The conditions.** Each fight room draws one from `map.mapSeed`, shown on the plan once the room is seen:
  - **Flooded:** Burning cannot take hold; Chilled lasts 1 turn longer.
  - **Dark:** accuracy ×0.9 for everyone.
  - **Narrow:** reach above 2 is capped at 2, for foes and party alike.
  - **Oil-slicked:** any Burning spreads to every unit.
  - **Cracked Ceiling:** carries the lever.
- **The lever.** A Cracked Ceiling adds one order any side can use once: *Bring it down*. Every unit takes 15% of maximum HP and is Staggered.
- **Both sides obey.** A foe's intent is computed with the condition in force, so it stays a promise. A foe that pulls the lever shows that as its intent.

**What it adds.**
- **Path choice.** Do you take the flooded room with a Burning-based Ruin build, or go round?
- **Timing.** When to pull the lever.
- **Early depth.** A lever in a D-Rank fight is a third button.

**Constraints.** Every condition is a rule the engine plays, so the brief simulates it. The System needs a fixed lever rule: pull when it fells at least one foe and no ally. That changes the auto policy and the map, so recalibrate everything, and run the campaign because fights' length shifts.

**Cost.** Medium to large.

### 4. Captives
**Source.** Brogue's shackled captives and caged vaults; PMD's recruit-by-leader.

**Build.**
- **The room.** A new fight kind: a creature, or an Association hunter, shackled among its captors.
- **Captors.** Some show intents at the captive.
- **Free.** A Free order costs the hunter's turn, as in Brogue: "one turn". The captive fights for the party from then on.
- **If it lives.**
  - A creature lingers already bound, so extraction is certain and costs no mana: no `HOLD` roll, no `EXTRACT_TRIES`.
  - A hunter joins the party for the rest of the Gate.
- **Settlement.** All of it in `raid.finish`.

**What it adds.**
- **A fight with a second goal.** Read the intents, protect the captive, and choose when to spend a turn freeing it.
- **A way to recruit by skill.** A specific Shadow, rather than mana and INT odds.

**Constraints.** Deterministic. The System's road takes captives by a fixed rule (Free on the first turn no intent targets the hunter), so recalibrate if the road visits them.

**Cost.** Medium.

### 5. Nests (Monster Houses)
**Source.** Shiren.

**Build.**
- **The room.** One room per floor at B and above, from the seed: three waves fought back to back with no rest. Each wave is a chamber resumed by replay.
- **The reward.** Paid at vault grade.
- **Signs.** It shows as an Event signpost. A Gate Survey or a scouting item (#11) identifies it, which is Shiren's arrow into the room.
- **Leaving.** You can walk out between waves, losing the cache, so there is an exit, like Shiren's corridor retreat.

**What it adds.** Greed against safety, decided with the HP you have left, and a reason to save items (#1) and rests.

**Constraints.** The System's road skips nests unless one lies on the road. The brief plays one exactly when the road meets it. Recalibrate.

**Cost.** Medium.

### 6. Instability: a clock on each floor
**Source.** DCSS's Zot clock (a new floor refills it, staged warnings), Shiren's Winds of Kron, Cogmind's alert.

**Build.**
- **The budget.** Each floor has a step budget: the length of the System's road plus a stated slack by grade.
- **What counts.** Every room entered or walked back to adds 1.
- **The stages.** Three, at the budget, +3 and +6. Each adds a stated percentage to the strength of fights not yet fought on the floor; the last also closes rests not yet found.
- **Reset.** The stairs reset it, as a new floor refills DCSS's clock.
- **Display.** A meter on the map.

**What it adds.**
- Exploring the whole floor gets a price. Now it has none but HP.
- The Gate Survey and scouting become worth carrying.
- The Daily Quest "walk off the marked road" gets teeth.

**Constraints.**
- Purely a count, so the brief plays it.
- Make it soft: stronger foes, never ejection. DCSS's critics hated the hard cap, and ejection would also fight "one engine call settles a run".
- Keep the System's road inside the budget so the honest rate barely moves.
- Recalibrate anyway (a map rule) and rerun the campaign.

**Cost.** Medium.

### 7. Unidentified Draughts, shuffled by the Spire's week
**Source.** Shiren's and SPD's identification by use, NetHack's price tiers, SPD's Shard of Oblivion.

**Build.**
- **The kinds.** About eight. Most are good: heal 40%, attack up for 3 fights, chart this floor, ease 10 fatigue. Two are bad: Weakened for 3 fights, mana drained.
- **Appearances.** They shuffle each Monday, seeded from the Pale Spire's week, so the whole week shares one table.
- **Learning them.** Drinking a kind identifies it until the week ends. An Appraisal at the Exchange identifies one for shards; the Exchange does not buy them, following DCSS's "shops don't buy".
- **Honest odds.** The Guide lists every kind and its weight, so the draught's value is stated as odds, as Events already are.

**What it adds.**
- Knowledge as progression inside the week: Monday's gamble is Friday's tool.
- A shard sink.

**Constraints.**
- Effects are seeded from the run and node.
- Auto never drinks, so nothing measured moves.
- It needs a short VOICE.md decision on how a System window names an unknown draught. The window must not explain itself.

**Cost.** Medium.

### 8. Shadows learn from what they fell
**Source.** Brogue: allies absorb an ability from a corpse in 20 turns, with an open slot from empowerment.

**Build.**
- **The slot.** Promotion to Sworn gives an open "talent" slot. It already "remembers a second ability".
- **The choice.** In a cleared Gate's results, a Shadow with an open slot may take one passive or ability from a creature it helped fell that run. The choice is made on the results and settled in `raid.finish`.
- **The cost.** Brogue's vulnerability window becomes either sitting out the next Gate or paying Shadow Essence.

**What it adds.**
- Shadows get a build of their own, and a reason to bring a particular Shadow into a particular Gate.
- An Essence sink.

**Constraints.** Choices are made outside fights. `keptUpHunter`'s squad needs a fixed learning policy, so recalibrate the levels it touches.

**Cost.** Medium.

### 9. A recovery run after a wipe
**Source.** Shiren 6's offline self-rescue on the same seed; PMD's rescue.

**Build.**
- **When.** Once per wipe, the same day, on the same `map.mapSeed`.
- **The party.** The hunter and Shadows only, with no Association hunters, at the normal fatigue cost.
- **The goal.** Clear the room where the party fell. Rooms cleared before stay cleared.
- **On success.** Half the banked loot is recovered, and the 12-hour lockout lifts.
- **On failure.** Nothing more is lost.
- **Settlement.** In the recovery's own `raid.finish`.

**What it adds.** A wipe becomes a second, readable decision instead of a timeout. It also turns Shiren's "someone else's quest" into your own.

**Constraints.** Offline and deterministic. Nothing pays on a tap that can be undone.

**Cost.** Medium.

### 10. Foes that act on items
**Source.** Shiren's consistency (the Rice Changer), Casey's tightly coupled monsters and items.

**Build.**
- **A Pilferer foe.** Its intent shows "Snatch: banked shards (5%)". The next intent shows "Flee". Fell it before it flees and the loss is undone.
- **A Hoarder foe.** Its intent shows "Drink", healing itself.

**What it adds.** Kill-order puzzles that read entirely from intents.

**Constraints.** Intents remain promises. Fleeing is a shown action. It touches banked shards, not the clear rate, so calibration barely moves; check with `tunediff`.

**Cost.** Small to medium.

### 11. Scouting charms
**Source.** Brogue's detect magic (benevolent or malevolent), Shiren's arrow into a monster house.

**Build.**
- **Echo Stone:** shows what one fogged Event room really is.
- **Dowsing Rod:** marks every unfound rest on the floor.

**What it adds.** Partial knowledge as a cheaper sibling of the Survey. It feeds #5 and #6.

**Constraints.** Fog never reaches the fight or the projection, so nothing changes in calibration.

**Cost.** Small.

### 12. Metered blueprints
**Source.** Brogue's generation accumulator, SPD's fixed counts per region.

**Build.**
- **The weight.** Replace a flat chance of a blueprint on later clears with a weight that rises each clear without one and falls by a fixed step when one drops.
- **Display.** The board shows the current chance ("next clear: 18%").

**What it adds.** No droughts, and a stronger "every reward stated up front".

**Constraints.** No fight changes. Rerun `npm run campaign`.

**Cost.** Small.

### Where ARISE already matches or beats these games
- **Determinism.** Orders are written before they play, chambers resume by replay, and maps are seeded by Gate and day. That is Brogue's recordings plus Shiren 6's same-seed retries, and it closes save-scumming at least as tightly as any game here.
- **Foe intents as promises.** These are more readable than any traditional roguelike's monsters, which is the NecroDancer lesson, with taunts shown as a new intent.
- **The honest brief.** No game here tells you your clear rate. DCSS only promises "qualitative feedback".
- **Anti-grind.** Pay by Gate grade, fatigue as the one limit, and cleared rooms that stay cleared are SPD's `maxLvl` and DCSS's "no scumming", built into the economy.
- **Unidentified maps and bosses** until you have entered a Gate. This is Shiren's identification applied to places.
- **Shrine blessings and Events with stated odds.** They are more explicit than Brogue's altar choices or Shiren's gambles.
- **Loot banked and lost on a wipe, withdrawal only from the entrance.** This is Shiren's loss on death with a clear exit rule.
- **Ascension, marks and Trials** cover what SPD's challenges and trinkets do.

---

## 4. Sources

**Shiren**
- https://mobile.mysterydungeonwiki.com/wiki/Shiren_6:New_Mechanics
- https://mysterydungeonwiki.com/wiki/Shiren_6:Returning_Mechanics
- https://mysterydungeonwiki.com/wiki/Shiren_6:Synthesis
- https://mysterydungeonwiki.com/wiki/Shiren_6:Floor
- https://mysterydungeonwiki.com/wiki/Shiren:Rescue_Mechanics
- https://mysterydungeonwiki.com/wiki/Shiren_5_Vita:Shiren_(Player_Character) (fullness, from search snippet)
- https://mobile.mysterydungeonwiki.com/wiki/Shiren_1_DS:Fullness (search snippet)
- https://mobile.mysterydungeonwiki.com/wiki/Shiren_6:Onigiri
- https://mysterydungeonwiki.com/wiki/Shiren_6:Large_Onigiri
- https://mobile.mysterydungeonwiki.com/wiki/Shiren_6:Rotten_Onigiri
- https://mysterydungeonwiki.com/wiki/Shiren:Winds_of_Kron (search snippet)
- https://sharksnack.github.io/shiren-6/dungeons/forest-of-frugality (search snippet)
- https://sharksnack.github.io/shiren-6/guides/identification-guide
- https://sharksnack.github.io/shiren-2/system/monster-house
- https://finalweapon.net/2024/02/27/shiren-the-wanderer-6-rescue-guide/
- https://finalweapon.net/2024/02/27/shiren-the-wanderer-6-equipment-basics/
- https://www.nintendolife.com/features/shiren-the-wanderer-devs-on-preserving-series-difficulty-and-uniqueness
- https://www.rpgsite.net/interview/16434-shiren-wanderer-interview-returning-to-basics-future-more
- https://automaton-media.com/en/interviews/shiren-the-wanderer-6-is-the-series-fastest-selling-entry-to-date-but-its-struggling-to-take-off-in-the-west-its-creators-hope-to-win-over-overseas-roguelike-lovers/ (headline only)
- https://www.rpgfan.com/review/shiren-the-wanderer-the-mystery-dungeon-of-serpentcoil-island (search snippet)
- https://www.gamedeveloper.com/design/roguelike-item-and-monster-design-revisited
- https://www.gamedeveloper.com/business/wanderlust-realized-shiren-the-wanderer-analysis-

**Pokémon Mystery Dungeon**
- https://github.com/pret/pmd-red: src/dungeon_mon_recruit.c, src/dungeon_config.c, src/dungeon_damage.c, include/constants/global.h
- https://en.wikipedia.org/wiki/Pok%C3%A9mon_Mystery_Dungeon:_Explorers_of_Time_and_Explorers_of_Darkness
- https://en.wikipedia.org/wiki/Pok%C3%A9mon_Mystery_Dungeon:_Red_Rescue_Team_and_Blue_Rescue_Team
- https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-Pokemon-Mystery-Dungeon-Gates-to-Infinity/Pokemon-Mystery-Dungeon-Gates-to-Infinity/1-An-Impossible-Combination-/1-An-Impossible-Combination-755141.html

**Brogue**
- https://github.com/tmewett/BrogueCE: src/brogue/Items.c, Time.c, Monsters.c, Combat.c, Movement.c, RogueMain.c, Rogue.h; src/variants/GlobalsBrogue.c
- https://sites.google.com/site/broguegame/
- https://en.wikipedia.org/wiki/Brogue_(video_game)
- https://waltoriouswritesaboutgames.com/2012/11/07/roguelike-updates-who-needs-leveling-anyway/
- https://steamcommunity.com/app/506870/discussions/0/350543738457605069
- https://thespelunkyshowlike.libsyn.com/18-exploring-brogue-with-brian-walker (listed, not heard)

**DCSS**
- https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/docs/crawl_manual.rst
- https://github.com/crawl/crawl/blob/master/crawl-ref/source/zot.cc
- https://github.com/crawl/crawl/blob/master/crawl-ref/source/zot.h
- https://github.com/crawl/crawl/blob/master/crawl-ref/source/dat/descript/gods.txt
- http://crawl.chaosforge.org/Ru
- https://crawl.develz.org/wordpress/0-26-roll-around-the-clock
- https://itch.io/post/7909616 (search snippet)
- https://crawl.develz.org/tavern/viewtopic.php?p=146660 (search snippet)

**Shattered Pixel Dungeon**
- https://github.com/00-Evan/shattered-pixel-dungeon:
  - actors/buffs/Hunger.java, Dungeon.java, actors/mobs/Mob.java, actors/hero/Talent.java, Challenges.java
  - items/weapon/Weapon.java, items/armor/Armor.java, items/wands/Wand.java, items/food/*.java
  - ui/changelist/v0_3–v1_X_Changes.java, messages/items/items.properties

**NetHack**
- https://nethackwiki.com/wiki/Price_identification
- https://nethackwiki.com/wiki/The_DevTeam_Thinks_of_Everything

**Cogmind**
- https://www.gridsagegames.com/cogmind/manual.txt
- https://www.reddit.com/r/roguelikedev/comments/4gx30s/faq_friday_37_hunger_clocks/ (not fetchable; quoted via search snippet)

**Caves of Qud, Tangledeep, Barony, Dredmor, NecroDancer**
- https://wiki.cavesofqud.com/wiki/Liquids
- https://store.steampowered.com/app/628770/Tangledeep/
- https://store.steampowered.com/app/371970/Barony/
- https://store.steampowered.com/app/98800/Dungeons_of_Dredmor/
- https://en.wikipedia.org/wiki/Crypt_of_the_NecroDancer

**General**
- https://www.gamedeveloper.com/design/devs-discuss-the-past-and-future-of-the-roguelike-
- https://www.markrjohnsongames.com/2021/09/25/what-clock-should-urr-have/
- ARISE: /home/user/ARISE-FITNESS-APP/README.md, docs/DESIGN.md, src/data/nodes.ts, src/core/combat.ts, src/core/shadows.ts, src/app/flow.ts (read only)
