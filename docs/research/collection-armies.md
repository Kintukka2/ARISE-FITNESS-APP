# Collecting monsters and commanding an army: research for ARISE's Shadows

**Research limits.** The shared web-search budget ran out after about 45 searches, so the rest of the research used direct fetches of pages already found or already known. Several primary wikis blocked fetching: megatenwiki and Bulbapedia (403), Fandom (402), and UFOpaedia and Serenes Forest (404 or the wrong page). Numbers that could not be checked are marked *(unconfirmed)* and come from general knowledge. Brogue's ally rules were read from the Brogue CE source code.

**ARISE as read for this report** (`src/core/shadows.ts`, `src/data/shadows.ts`, DESIGN.md §6):
- **The creatures.** 110, in 16 families (Undead 21, Beast 14, Insectoid 12, Goblinoid 9, Demon 7, and smaller ones) and 8 roles. Each has base stats, a kit of one or two abilities, an optional passive, immunities and resistances.
- **Linger odds.** A creature lingers 2% + 0.02% per INT, a boss 12% + 0.12% per INT. Odds triple if one already serves, capped at 90%.
- **Extraction.** A reach costs 50–100 MP by grade; there are three, each costing twice the last. It holds at 45% + 0.4% per INT, up to 90%. A duplicate costs half the MP and becomes Essence: 1–4 by grade, doubled for a boss.
- **XP and levels.** A Shadow earns 1 XP per creature it helps fell, 5 per boss. Each level adds 2.5% of the creature's stats.
- **Ranks.** Bound, Sworn, Vanguard and Ascendant cap levels at 10, 20, 30 and 40. Promotion costs 0, 4, 12 and 30 Essence and 0, 0, 1 and 4 bosses felled.
- **Second ability and awakening.** The second ability comes at Sworn and is fixed by `secondOf`. Awakening adds 5 stars for 20, 30, 45, 65 and 90 Essence, +4% each.
- **Slots.** 1–3 by licence, plus 3 from Secret Quests.
- **Auto Deploy** sorts by power (`bestSquad`).
- **Synergy today.** Only the passives `pack` (+5 defence per other pack-kin standing, up to 2) and `leadership` (+5 initiative and accuracy to the side).

---

## 1. The games

### Shin Megami Tensei V / Vengeance
**Loop.** Talk demons into joining, fuse them into stronger ones that inherit chosen skills, and register them to re-summon. The party is rebuilt from fusion, never raised long-term.

**Mechanics**
- **Negotiation.** Temperament is "influenced by moon phases, particularly beneath full and new moons" (Atlus via Gematsu). In Vengeance, an ally demon can interrupt a negotiation and trigger "a unique interaction", and the Demonic Mediator skill steps in when a deal goes sour.
- **Fusion.** Two demons, or two to four for special fusions, plus elemental fusion.
- **Fusion accidents** are likelier at full moon. In V an accident can give a demon up to 7 levels above the Nahobino (Samurai Gamers). Strange Journey's odds are 1/64, or 1/32 at new or full moon *(unconfirmed; sources conflict)*.
- **Essences** are consumable copies of a demon's skills and affinities; fused into another demon they transfer a chosen skill. Only the Nahobino takes affinities.
- **Inheritance.** Inherited skills are chosen by hand in SMT IV and V and Persona 5; earlier entries rolled them.
- **Pair skills.** Vengeance has more than 50 Magatsuhi skills, some activated "when there is a strong mythological relationship between two demons". Every demon has a passive Unique Skill.
- **Compendium.** Any registered demon can be re-summoned for Macca, as it was when registered *(cost formula unconfirmed)*.

**Why it works.** Kaneko on Devil Summoner (2005): "the idea there was to take the demon fusion mechanic and really refine and strengthen it" (shmuplations; quoted from search, the page did not load). Fusion keeps a weak early catch useful as a skill carrier. The compendium removes the regret of fusing a favourite away. Pair skills make *which two* you field a decision.

**Criticism.** Players need outside fusion calculators. Negotiations eat items and Macca for nothing (CBR on V's fixes). An accident can wreck a planned fusion.

### Persona 3 / 4 / 5
**Loop.** SMT's fusion skeleton, with Personas. The life sim's Social Links (Confidants in 5) feed fusion.

**Mechanics**
- **Arcana bonus.** Fusing a Persona of a link's arcana gives it bonus experience by the link's rank, about three levels at rank 5 in P3 (MegaTen wiki, via search).
- **Ultimate Personas.** Maxing a link (rank 10) unlocks that arcana's Ultimate Persona, which cannot be fused before. There are 22; Orpheus Telos needs every link maxed.
- **Fusion Forecast** (P3 Reload) multiplies the bonus by 1.1× to 1.5× on given days.
- **Inheritance.** In P4 the number of skills inherited depends on the ingredients' *unique* skills. Each Persona has an inheritance type that bars some families; an Ice type cannot take Fire. P5 lets you pick the skills.
- **Compendium.** Re-summon for yen scaled by level and stats.

**Why it works.** Time spent with people becomes a stronger Persona. Inheritance types make the body that carries a skill a real choice.

**Criticism.** Grinding money for re-summons. Random inheritance before P5 meant rerolling. Ultimates sit behind calendar-limited social content.

### Dragon Quest Monsters: The Dark Prince
**Loop.** Scout monsters in seasonal regions, synthesize two parents of level 10 or more into a child, and climb tournament ranks.

**Mechanics**
- **Scouting** is a "show of force": your attacks build a displayed percentage, using attack or wisdom, whichever is higher. A failure can anger the target. Scouting in Nadiria is "greatly hampered" until Psaro beats a Circle's boss (dragon-quest.org).
- **Synthesis inheritance.** The child inherits up to three talents plus its own. Each parent passes on 25% of its species' growth.
- **Stats.** Grandparents from four different families raise the stat modifiers. About 5% of syntheses produce a Sparkling monster, with +100 to one stat cap.
- **Sizes.** Only small and large remain. Large monsters act more, have +25% HP and MP, and gain three traits.
- **Four-monster synthesis** works "based not on the parents, but on the child monster's grandparents"; "the parent monster can be any type you like!"
- **Reverse Search** shows the recipes for monsters "you've yet to encounter in the wild" (Gematsu).

**Why it works.** Kento Yokota calls synthesis the series' "most iconic feature" and stresses that "your monster roster and attributes can turn out to be completely different from other players". Grandparent recipes reward planning across generations. Reverse Search turns an empty library slot into a goal.

**Criticism.** Long, opaque breeding chains. Talent-point grinding.

### Pokémon and Pokémon Mystery Dungeon
**Loop.** Catch, train, evolve and breed a team of six from a dex of more than 1,000.

**Mechanics**
- **Genetics.** IVs run 0–31 per stat ("what you could call genes", Masuda). EVs cap at 252 per stat and 510 in total, 4 EVs per point at level 100. Natures give +10% and −10% *(standard; unconfirmed here)*. Hyper Training treats an IV as 31.
- **Evolution and egg moves** reshape a creature's stats and moves.
- **Pokémon Champions** (2026) set every IV to 31 and replaced EVs with 66 free stat points, at most 32 in one stat (pre-release coverage). Producer Masaaki Hoshino: "our hope is to expand that accessibility, to make it something that anyone can jump in and enjoy."
- **Mystery Dungeon (Rescue Team).** Only the leader's knockout recruits. A recruit leaves "forever" if it or the leader faints before the dungeon's end.
- **PMD recruit rates.** Base rates can be negative (Kecleon −33.9%). The leader's level adds 0% (levels 1–29) up to 24% (90–100); the Friend Bow adds 10%.
- **PMD DX.** The bonus caps at +55%: level +3% to +5%, Friend Bow +12.8%, False Swipe +17.5%, Inviting Orb +25%.

**Why it works.** Evolution is a promise on the card. In PMD a recruit has to *reach the exit*, so recruiting is a risk you manage during the run.

**Criticism.** Hidden IVs, EVs and natures are an accessibility wall; Champions removing them is the developer's own admission. Tiny PMD base rates make some recruits a grind.

### Siralim Ultimate
**Loop.** Six creatures against six, drawn from more than 1,200, each with a unique trait. Teams whose traits multiply each other climb procedural realms with no level cap.

**Mechanics**
- **Scale.** "over 1200 different creatures", each with "a unique stat spread … and a unique trait"; 40 specializations; more than 600 spells; 30 realms (Steam).
- **Fusion.** The child keeps both parents' traits and averages their stats. It is once per creature and cannot be undone (developer on Steam).
- **Tuning.** Patch 2.0 tunes trait by trait (for example, "Autonomous" from 10% to 30%). Nether Synthesis was added as "an alternative use for Stardust once you've collected all the Exotic creatures you care about."

**Why it works.** One trait means every creature *does something* from the moment it is caught. Fusion's second trait opens "geometrically more complex interactions" (review). The macro builder scripts conditional orders, "a machine that automatically resolves the puzzle of combat instances for you."

**Criticism.** One enemy trait can "completely nullify your build". Endgame fights drag. The log is "exhaustively long, challenging to parse, and not searchable". Grind and heavy menus.

### Monster Sanctuary
**Loop.** A Metroidvania where monsters hatched from battle eggs are both the party (three fight) and the keys to the map.

**Mechanics**
- **Map abilities.** Fliers double-jump and glide. A slime opens Earth switches and a lava slug Fire switches. Later monsters swim and smash rock (RPGFan).
- **Combo.** Each hit adds a stack worth about 5% damage to the next monster, so order matters (2019 guide).
- **Eggs** drop more readily from efficient, well-matched fights.
- **Shift.** A Shift Stone sets a monster to Light or Dark. Each species has fixed passives for each, compared before committing. Reward-box eggs come shifted 50% of the time.

**Why it works.** A monster that is weak in battle still earns its place on the map. Combo order is one tactic a turn, not per-unit commands. Shift turns one species into two builds.

**Criticism.** "Can become grindy, party and quest management gets unwieldy" (RPGFan).

### Cassette Beasts
**Loop.** Record monsters on tapes, transform into them, and fuse with a partner character in battle.

**Mechanics**
- **Fusion.** Any two of 120 forms fuse, over 14,000 combinations. It is temporary and charges as you take damage, and order changes the result.
- **Relationship level** with the partner strengthens fusion. Guides give +5% per level up to +25% *(numbers conflict, unconfirmed)*.
- **Bootlegs** have a different type, moves and palette. Base odds are 1/1,000. Rogue fusions are 2% (5% in a flood), swarms 10%, orb fusions 20%. A Ritual Candle expends a monster to guarantee one. Bootlegs roll rare stickers more often.

**Why it works.** Tom Coxon: fusion is "more closely inspired by Steven Universe … fusions are temporary and part of the relationship system". Jay Baylis: "every monster has an action figure and a Lego version". Fusion pays off a bond; bootlegs reward catching what you already own.

**Criticism.** Opaque fusion maths. A knocked-out fusion breaks both tapes.

### Digimon Story: Cyber Sleuth (and Time Stranger)
**Loop.** Digivolve along branching trees, then de-digivolve to bank ABI and keep skills.

**Mechanics**
- **ABI gain** (fan table). Up from Rookie: 1 + (L+5)/10. Down from Rookie: 2 + L/5. Down from Ultimate: 4 + L/5. Going down pays more.
- **ABI caps.** 100 on PS4 and Vita, otherwise 200. Farm training is capped at ABI/2 + 50. Megas need at least 20 ABI, usually 40–80.
- **DNA digivolution.** The first Digimon keeps its personality, stats and nickname; the second gives only "its inherited skills".
- **Party memory** caps how many high stages you field.
- **Time Stranger.** Over 450 Digimon and 16 personalities that shape growth. Evolution "is not linear", and de-digivolving allows "flexible training strategies".

**Why it works.** Growth can be reversed at a profit, so no branch is a dead end, and each loop leaves a mark that makes the Digimon *yours*.

**Criticism.** The ABI loop gets optimised into tedium.

### Monster Rancher
**Loop.** Generate a monster from a disc, train it week by week through its lifespan, then combine it or let it pass.

**Mechanics**
- **Lifespan** is set per species (DX: a Plant about 550 weeks, a Monol 350). Fatigue and lost matches shorten it.
- **Combining.** Techniques carry over at about two-thirds (10 become 6). Battle specials pass about 45–50% of the time. Lifespan does not inherit.
- **Death and the shrine.** A death brings a funeral and a shrine, and some monsters unlock only through one.

**Why it works.** Mortality gives each monster a story with an end. Combining turns loss into lineage.

**Criticism.** Losing a monster raised for 400 weeks is too harsh for many. Disc variance is opaque.

### Disgaea
*(General knowledge, unconfirmed.)*
- **Reincarnation** returns a unit to level 1 for Mana, keeps part of its stats, allows a class change and speeds later growth.
- **Item World.** Each item is a random dungeon. Clearing floors levels it, and subdued Innocents add stats and can be moved between items.

**Why it works.** A capped unit becomes a goal again, at a visible cost.

**Criticism.** Number inflation that feels hollow to anyone but min-maxers.

### Palworld
- **Work.** 12 kinds of work suitability, naturally at levels 1–8 and up to 10.
- **Pal Essence Condenser.** Duplicates of one Pal go in at 4, 8, 12 and 24 copies for stars 1–4 (48 in all). They raise stats, add one suitability per star (all of them at star 4) and lift the Partner Skill by up to +5. The sacrificed Pals' passives don't transfer (palworld.wiki.gg).

**Why it works.** Every catch is both a fighter and a worker, and duplicates feed *one named* Pal.

**Criticism.** 48 copies is a slog, and the base is busywork driven by the clock.

### Brogue (CE)
**Loop.** Allies are freed captives or dominated monsters that you keep alive and make stronger.

**Mechanics** (from the source)
- **Exploration bond.** Allies earn "exploration XP" equal to the new cells the player explores. At 1,400 they form a "telepathic bond". The Companion feat needs 10,400, "about 13 depths" (`Time.c`, `GlobalsBrogue.c`).
- **Empowerment.** A Wand of Empowerment gives +12 max HP, +10 defence, +10 accuracy, +10% damage and one new talent (`empowerMonster`).
- **Absorbing.** The talent is learned by absorbing the corpse of a slain monster with a learnable ability, bolt or behaviour: path distance of 10 or less, 20 turns. The ally gains, for example, flight or a spell bolt (`Combat.c: canAbsorb`).

**Why it works.** What you kill together writes the ally's growth, and the bond is earned by distance travelled.

**Criticism.** Legendary allies die to one bad trap. Which corpse gets eaten is luck.

### Darkest Dungeon
**Loop.** A replaceable roster of flawed heroes goes on expeditions and dies for good.

**Mechanics**
- **Stress** runs from 0 to 200. At 100 comes an affliction (the hero disobeys orders) or, rarely, virtue. At 200, a heart attack.
- **Quirks.** 5 positive and 5 negative at most. After a successful mission the chances are 50 − 0.1 × stress for a positive quirk and 30 + 0.2 × stress for a negative one. Negative quirks lock 25% of the time per mission.
- **Death's Door** resists a deathblow 67% of the time.
- **The Graveyard** logs each dead hero's name, level, class and "the circumstances of their death". The From Beyond event offers three of them back, quirks kept, skills and gear reset.

**Why it works.** Heroes are triage, and the quirks and graveyard give disposable people histories.

**Criticism.** RNG death spirals, and the grind to replace levelled heroes.

### XCOM (Enemy Unknown, XCOM 2: War of the Chosen)
*(Rules unconfirmed; the fetches failed.)*
- **Soldiers** have nicknames, Ironman mode and a Memorial with missions and kills.
- **War of the Chosen bonds.** Cohesion grows from shared missions, weighted by compatibility, over three levels. Abilities include Teamwork (give a bondmate an action once per mission). A bondmate's death can leave a negative trait.

**Why it works.** Customised soldiers with deeds hurt to lose, and bonds reward keeping pairs together.

**Criticism.** Save-scumming, and late-game rosters that blur together.

### Fire Emblem
- **Supports (Thracia 776).** +10 or +20 hit, avoid, crit and crit evade within 3 squares, some one-way (Serenes Forest).
- **Later games** use C, B, A and S ranks earned by fighting near each other *(unconfirmed)*. Casual Mode removed permadeath.

**Why it works.** Positioning becomes a relationship, and the relationship becomes a stat.

**Criticism.** Permadeath leads to resets; Casual Mode exists because loss drove players off.

### Diablo II / IV Necromancer and Path of Exile minions
- **Diablo II Raise Skeleton** needs a corpse and raises 1, 2, then 3 skeletons at skill levels 1–5, one more every 3 levels, up to 8. Golems are one of each type. Revive raises one monster per point for 180 seconds, +200% HP. Skeleton Mastery adds +8 life and +2 damage per level (Arreat Summit).
- **Diablo IV Book of the Dead.** Warriors, mages and a golem, three variants each, each upgradable *or sacrificed* for a passive bonus. "Minions gain 100% of your stats" (Maxroll).
- **Path of Exile.** Minions are autonomous and scaled by minion-only modifiers *(unconfirmed)*.

**Why it works.** The army is a build chosen once and expressed by automatic behaviour, and sacrifice makes fielding fewer minions a real choice.

**Criticism.** Poor minion pathing, and screen clutter that hides what is happening.

### Overlord
*(General knowledge, unconfirmed.)* Four colours of minion are summoned from life force collected from kills. Browns fight, Reds throw fire, Greens backstab and absorb poison, Blues heal, swim and revive. Minions wear loot.

**Why it works.** Each type carries one verb that works in combat and in the map, and you command colours, not individuals.

**Criticism.** Herding on a controller.

### Solo Leveling: Arise (fan expectation)
Fans expect extraction from the felled, several tries before the shadow is gone, an army that rises in rank, shadows the hunter names, and a few lieutenants with personalities. ARISE has all but the last.

---

## 2. Cross-cutting principles

1. **A creature matters when it brings a verb, not a number.** Every Siralim creature has one trait, every SMT V demon a Unique Skill, every Overlord colour one puzzle and every Monster Sanctuary monster one door. Stat growth alone makes stat sticks. ARISE's power-sorted Auto Deploy shows its Shadows mostly are stat sticks today.
2. **Identity is a fixed core plus a slot the player chooses.** SMT and Persona fix innate skills and choose inherited ones; DQM inherits three talents; Siralim adds a second trait; Digimon carries skills across forms. ARISE's `secondOf` is fixed, so two Sworn Shadows of one creature are identical.
3. **Synergy belongs to composition, not commands.** Siralim's macros, the Book of the Dead, Overlord's colours and Monster Sanctuary's combo order all put the choice into *who* is fielded and *in what order*. ARISE learned this when it removed per-Shadow orders. `pack` and `leadership` already compute synergy from the side alone.
4. **Duplicates need a named target.** Palworld feeds *that* Pal, Brogue's allies absorb *that* foe's ability, Digimon's DNA passes *that* Digimon's skills, and Cassette Beasts' bootlegs make *that* species worth catching again. ARISE pours duplicates into anonymous Essence.
5. **Branching or reversible growth multiplies builds and removes regret.** Examples: de-digivolving, the Shift compared before committing, compendium re-summons, reincarnation. ARISE only promotes upward, and a release is final.
6. **Attachment comes from history the game writes.** Examples: Brogue's bond at 1,400 cells, XCOM's memorial, Darkest Dungeon's causes of death, Fire Emblem's supports, the Monster Rancher shrine. ARISE has names and records but nothing *between* Shadows.
7. **Permadeath helps only when units are replaceable resources to triage** (Darkest Dungeon, XCOM). No major collector uses it, and Fire Emblem added Casual Mode. Softer risks work better: PMD's recruit-must-reach-the-exit, Death's Door, broken tapes.
8. **Completion drives play when the list is visible, the gaps point somewhere, and finishing pays.** Examples: DQM's Reverse Search, the Pokédex's areas, Persona's Ultimates, Siralim's Exotics. Hidden values work against it, which is why Champions removed IVs.
9. **Recruit odds should be legible and moved by player choices.** PMD uses level and items, DQM damage, SMT personality and moon. ARISE already states its odds and moves them with INT.

**Where ARISE already matches or beats these games**
- **Extraction.** Three reaches with doubling cost, a failure never loses the creature, and the odds are in the Guide. This is kinder and clearer than SMT's negotiations, DQM's angered targets or PMD's hidden rates.
- **Duplicates.** A creature already owned lingers three times as often for half the MP, far better than Palworld's 48 copies.
- **Shared XP.** The whole squad levels on what it helps fell, the problem Pokémon's Exp. Share solved.
- **Promotion asks for deeds**, bosses felled, as XCOM's ranks do.
- **The brief** simulates the real squad 24 times. No surveyed game tells you honestly what a team change is worth.
- **Army-wide standing orders** are Overlord's colours without the herding: the right altitude for one hand.

---

## 3. Ideas for ARISE (ranked)

**Constraints for every idea**
- Anything that reaches a fight goes through the Shadow unit built in `raid.heroSpec` (`raid.ts:73`: `bonus`, `kit`, `passives`), fixed before the chamber opens.
- Each new choice needs a stated rule for Auto Deploy, the System and calibration's `keptUpHunter`.
- Intents are promises, so a synergy changes *numbers*, never *targets*. The one exception is a taunt that shows its `intent` event.

### 1. Kin and Formation: composition bonuses (medium)
**From:** Siralim's team traits, SMT V's pair skills, Overlord's colours, Diablo IV's Book of the Dead.

**What to build.** Generalise `pack` into rules computed in `openSide`:
- **Kin.** Two deployed Shadows of one family give both its family boon, and three a stronger one. Examples: Undead resist curses, Beasts gain initiative, Constructs defence. That makes 16 boons as data, quoted by the Guide.
- **Formation.** Each distinct role deployed adds a small aura, as `leadership` does. Examples: a Guardian adds defence to the hunter; a Caster adds magic to the side.
- **Auto Deploy.** `bestSquad` must score candidate squads with these bonuses, not sort by raw power. With squads of 1–6, enumerating the top candidates is cheap.

**Decision it adds.** "Two Undead, or my strongest Beast?" A weaker creature earns its slot through its neighbours.

**Constraints.** Numeric and fixed at chamber open. Rerun calibration: `keptUpHunter`'s squad, chosen by the new Auto Deploy, gains the bonuses.

### 2. Imprint: choose the remembered ability (medium)
**From:** SMT V's Essence fusion, Persona 5's chosen inheritance and inheritance types, Brogue's absorbing, Digimon's DNA digivolution.

**What to build**
- At Sworn, the default stays `secondOf`. Instead, the hunter may release another Shadow *into* it, and it remembers that Shadow's first ability.
- **The inheritance type:** the ability must share a damage type with the receiver's first ability or come from its own family, and support abilities need a Leader or Caster receiver.
- No Essence is returned, and a later imprint overwrites. Store `second?: string` on `Shadow` (a default, no `SAVE_VERSION` bump), read by `kitOf`.

**Decision it adds.** Every bound creature becomes a donor, so an E-rank bat's screech can live on in an A-rank brute. Spare Shadows get a named destination, and two Sworn Shadows of one creature can differ.

**Constraints.** Chosen outside a fight, so replays are unaffected; the auto policy already picks skills. `keptUpHunter` keeps `secondOf`, so tuning stands, an earned edge like Overcharge. The campaign should imprint by a fixed rule, and the brief shows the result honestly.

### 3. The brief compares squads (small)
**From:** ARISE's own advantage; nothing surveyed has it.

**What to build.** In the brief, "Try squad" re-runs the 24 simulations with one slot changed, or with Auto Deploy's pick, and shows the two clear rates side by side. The Army roster can show a Shadow's delta against the marked Gate.

**Decision it adds.** Ideas 1, 2 and 7 become legible in the one number ARISE promises is honest.

**Constraints.** The same engine; limit it to one alternative at a time for the phone's CPU.

### 4. Shadows in the labyrinth: field verbs by family (medium)
**From:** Monster Sanctuary's map abilities, Overlord's colours, Palworld's work.

**What to build**
- **Fliers** (role) or Beasts see one more room through the fog (`map.sight`).
- **Insectoids** add their PER to a trap's Perception check.
- **Constructs** open a sealed cache, a new room kind.
- **Undead** add a stated option to some events.

**Decision it adds.** Families matter off the fight screen.

**Constraints**
- The fog never reaches the fight, the System's road or the projection, so sight needs no recalibration.
- The System's road avoids traps, so trap bonuses leave tuning alone.
- New event options must be ones `raid.systemChoice` never takes, or calibration reruns.
- Everything is written to the run like any step.

### 5. The Shadow Ledger: compendium, lookup, family completion (small to medium)
**From:** DQM's library and Reverse Search, the Pokédex, Persona's compendium and Ultimates.

**What to build**
- **The page.** A Ledger tab on the Army sheet with all 110 creatures by family, silhouettes until seen, and marks for felled, bound and highest rank.
- **The lookup.** Where each creature walks (Gate and grade) and its linger odds at the hunter's INT. The data exists; the board already counts bound creatures per Gate.
- **Completion** as Secret Quests: a family bound, or tiers of 25, 50 and 110 bound, beside the existing "Bind 5" and "Bind 10".

**Decision it adds.** Which Gate to run for *a specific creature*, which turns the daily board into a hunting list.

**Constraints.** Rewards that touch power go through `npm run campaign` and balance. The System's windows state, never advise.

### 6. Drill: the reserve takes a share of XP (small)
**From:** Persona 5's Lockdown, DQM's XP for monsters out of the party, Pokémon's Exp. Share.

**What to build.** In `raid.finish`, each reserve Shadow takes a stated share (for example 25%) of the deployed squad's average XP, up to its cap. It is per run, never per hour.

**Decision it adds.** Swapping for synergy (ideas 1 and 4) no longer stalls a Shadow's growth, and a campaign army of 30-plus Shadows stops being dead weight.

**Constraints.** Settled in `raid.finish`. Rerun the campaign. Calibration's hunters are fixed at Vanguard Lv.30, so it stands.

### 7. Bearing: a fork at Vanguard (medium)
**From:** Monster Sanctuary's Light and Dark shift, Digimon's branches, DQM's sizes.

**What to build.** At Vanguard, choose one of two bearings per role (8 × 2), built from existing passive styles. Examples: a Guardian picks *Bulwark* (`brace`/`bulwark`) or *Warden* (a taunt with its intent event); a Caster picks *Hex* (`hazard`) or *Surge* (`arcane`). The card compares them before you commit, and a later change costs Essence, a second sink beside awakening.

**Decision it adds.** One creature becomes two builds, a second axis for composition.

**Constraints.** Vanguard is calibration's squad, so state a default bearing per role for the System and rerun calibration and balance.

### 8. Shared runs make bonds (medium)
**From:** Fire Emblem's supports, XCOM's bonds, Cassette Beasts' relationships, SMT V's pair skills.

**What to build**
- **Count runs together** for every pair deployed together (`s.shadows.bonds`, settled in `raid.finish`), with ranks at C 5, B 15 and A 40.
- **Bonus.** When both are deployed, C gives +3% attack and magic and B +6%. A unlocks a pair ability by family or role pair, which the auto policy uses once per fight.
- **On the card.** The Record names the closest bond.

**Decision it adds.** Keeping a pair together competes with reshuffling for synergy. Shadows gain relationships, attachment without per-Shadow orders.

**Constraints.** Fully automatic, with no settings. The pair ability changes the auto policy, so recalibrate with `keptUpHunter` holding B bonds.

### 9. Umbral echoes: rare variants of owned creatures (medium)
**From:** Cassette Beasts' bootlegs, Monster Sanctuary's shifted eggs, Pokémon's shinies.

**What to build.** A creature that lingers while one like it already serves has a stated chance, seeded from the run, to be an Umbral variant (suggested 1 in 20, a boss 1 in 8). The twist is family-level: a swapped inflict, an extra immunity, or the second ability as its first. It can be bound beside the original, and the Ledger counts variants.

**Decision it adds.** Re-running a Gate for an owned creature becomes a hunt, not only Essence farming.

**Constraints.** Banked and paid like any linger. The odds go in the Guide. Rerun the campaign; calibration does not extract.

### 10. The Hall of the Released (small)
**From:** Darkest Dungeon's Graveyard and From Beyond, SMT's compendium, the Monster Rancher shrine.

**What to build.** A Shadow released or imprinted away leaves an entry: its name, creature, best rank and record. It can be re-raised later for its extraction MP, at Bound Lv.1 with its name and record but never its rank or stars, so no Essence loop.

**Decision it adds.** Release stops being final, and names outlive the Essence trade.

**Constraints.** None for fights; a save list with a default.

### 11. Sovereign bindings: four Ascendants of a family (large)
**From:** DQM's four-monster synthesis, Persona's Ultimates, SMT's special fusions.

**What to build.** Four 5-star Ascendants of one family unlock a binding of that family's unique Shadow. They are not consumed, but must stay in the army.

**Decision it adds.** The long goal the Essence surplus lacked (DESIGN.md: Essence "piled up" before awakening).

**Constraints.** New creatures, abilities and art. The Ascension calibration must decide whether `keptUpHunter` holds one.

### What not to take
- **Permadeath.** Shadows are unique and slow to raise (Lv.40 plus 250 Essence of stars). Collectors avoid permadeath, and a wipe already costs the banked loot.
  - *If any risk is wanted,* PMD's rule on new bindings only: a creature that lingers mid-run binds only if the run walks out.
- **Hidden genetics** (IVs, natures). They break "every reward stated up front", and Game Freak itself cut IVs.
- **Fusion accidents.** A random penalty on a deliberate choice contradicts honest odds.
- **Per-Shadow orders or focus.** Already tried and removed.
- **Clock-based base work.** It sells time; idea 6 is the per-run version.

---

## 4. Sources

ARISE: /home/user/ARISE-FITNESS-APP/src/core/shadows.ts, /home/user/ARISE-FITNESS-APP/src/data/shadows.ts, /home/user/ARISE-FITNESS-APP/docs/DESIGN.md, /home/user/ARISE-FITNESS-APP/src/core/combat.ts, /home/user/ARISE-FITNESS-APP/src/core/raid.ts, /home/user/ARISE-FITNESS-APP/src/data/enemies.ts, /home/user/ARISE-FITNESS-APP/src/core/missions.ts

SMT and Persona
- https://gematsu.com/2021/09/shin-megami-tensei-v-details-shoei-yakumo-nuwa-abdiel-negotiation-fusion-and-skill-stat-building
- https://www.gematsu.com/2024/03/shin-megami-tensei-v-vengeance-release-date-moved-up-to-june-14-characters-demons-and-systems-detailed
- https://samurai-gamers.com/shin-megami-tensei-v/how-to-get-fusion-accidents/
- https://megatenwiki.com/wiki/Fusion_Accident (from search results only)
- https://megatenwiki.com/wiki/Inheritance (from search results only)
- https://megatenwiki.com/wiki/Confidant (from search results only)
- https://shmuplations.com/?p=18348 (quoted from search results)
- https://www.cbr.com/shin-megami-tensei-v-demon-negotiation-improvements-tips/
- https://lparchive.org/Persona-4/Lesson2
- https://samurai-gamers.com/persona-5/persona-fusion-guide/

Dragon Quest Monsters
- https://dragon-quest.org/wiki/Monster_scouting
- https://dragon-quest.org/wiki/Dragon_Quest_Monsters:_The_Dark_Prince
- https://dragon-quest.org/wiki/Monster_synthesis
- https://gematsu.com/2023/11/dragon-quest-monsters-the-dark-prince-details-four-monster-synthesis-story-and-reverse-search-feature
- https://www.rpgsite.net/interview/15192-dragon-quest-monsters-the-dark-prince-interview-talking-monsters-more-with-kento-yokota

Pokémon and Mystery Dungeon
- https://www.pocketgamer.com/articles/062915/game-freak-on-pokemon-well-make-the-games-we-want-to-make-then-choose-the-hardware/
- https://nintendoeverything.com/pokemon-champions-wont-have-ivs-developer-explains-why/
- https://opencritic.com/news/27649/pok-mon-champions-will-make-one-major-change-to-the-pok-mon-competitive-scene
- https://thegamehaus.com/pokemon/pokemon-champions-will-remove-ivs-full-details/2026/03/25/
- https://kotaku.com/pokemon-scarlet-violet-what-are-ev-iv-training-1849905869
- https://mysterydungeonwiki.com/wiki/Rescue_Team:Recruit
- https://mobile.mysterydungeonwiki.com/wiki/Rescue_Team_DX:Recruiting

Siralim Ultimate
- https://store.steampowered.com/app/1289810/Siralim_Ultimate/
- https://steamcommunity.com/app/1289810/discussions/0/6303323544997741610
- https://www.thylacinestudios.com/blog/siralim-ultimate-2-0-patch-notes
- https://youdonthaveto.substack.com/p/siralim-ultimate

Monster Sanctuary
- https://www.rpgfan.com/review/monster-sanctuary/
- https://leetguides.blogspot.com/2019/09/monster-sanctuary-core-combat-mechanics.html (from search results only)
- https://monster-sanctuary.fandom.com/wiki/Monster_Shifting (from search results only)

Cassette Beasts
- https://www.nintendolife.com/features/cassette-beasts-dev-on-doing-what-pokemon-doesnt-in-a-zelda-inspired-overworld
- https://wireframe.raspberrypi.com/articles/creature-collecting-gets-an-analogue-upgrade-in-cassette-beasts (from search results only)
- https://www.gematsu.com/2022/06/cassette-beasts-fusion-trailer
- https://wiki.cassettebeasts.com/wiki/Bootleg
- https://Techraptor.net/gaming/guides/ultimate-cassette-beasts-partner-guide

Digimon
- https://docs.google.com/document/d/1MuXfIknTn0ukGDXIPQ8ombRNIK1ioPgRkR4abKAwqtY/export?format=pdf (from search results only)
- https://www.rpgsite.net/preview/18365-how-digivolution-system-works-in-digimon-story-time-stranger
- https://www.gematsu.com/2025/06/digimon-story-time-stranger-introduces-new-digimon-enhancement-systems

Monster Rancher
- https://memoxwashere.altervista.org/monster-rancher-2-dx-complete-guide/

Palworld
- https://palworld.wiki.gg/wiki/Pal_Essence_Condenser
- https://palworld.wiki.gg/wiki/Work_Suitability

Brogue CE (source code)
- https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Time.c
- https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Monsters.c
- https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Combat.c
- https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Items.c
- https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/variants/GlobalsBrogue.c

Darkest Dungeon
- https://darkestdungeon.wiki.gg/wiki/Stress
- https://darkestdungeon.wiki.gg/wiki/Quirks
- https://darkestdungeon.wiki.gg/wiki/Death%27s_Door
- https://darkestdungeon.wiki.gg/wiki/Graveyard

Fire Emblem
- https://serenesforest.net/three-houses/miscellaneous/support-bonuses/ (served the Thracia 776 data)

Diablo
- http://classic.battle.net/diablo2exp/skills/necromancer-summoning.shtml
- https://maxroll.gg/d4/resources/necromancer-book-of-the-dead

**Not reached:** XCOM bonds (UFOpaedia 404), Overlord, Disgaea and Path of Exile (no source fetched or the wiki blocked), Bulbapedia (403), Fandom (402). Claims about these games are marked *(unconfirmed)*.
