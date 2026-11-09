# Dungeon theory and procedural generation, for ARISE's Gate maps

Research note. Scope: what makes a dungeon's layout, exploration and pacing good, and how ARISE's generator (`src/core/map.ts`, with `src/core/raid.ts` and `src/data/nodes.ts`) measures against it.

**Method and limits.** The shared WebSearch budget for this session ran out after about a dozen searches. I carried on by fetching primary sources directly: papers as PDF, source code from GitHub, slide decks, and authors' own pages (about 40 fetches). Fandom wikis (402), zeldadungeon.net, amara.org and Patreon (403) refused fetches. Claims I could not check against a fetched source are marked **[unconfirmed]**.

---

## 1. Sources and techniques

### Joris Dormans: missions, spaces, and cycles (Unexplored)

**The 2010 paper** ("Adventures in Level Design", fetched as PDF). "A level generally consists of a mission and a space": the mission is a directed graph of tasks, the space a network of rooms. Dormans generates the mission first with a graph grammar, then builds a space for it with a shape grammar. Classic roguelike generators, he argues, "have a random feel to it and tend to lack overall structure" because they work above the scale of rooms. Two of his rules:
- `Obstacle → key + Obstacle + lock + Obstacle`
- `Dungeon → Threshold Guardian + Obstacle + Mini-Boss + reward + Obstacle + Level-Boss + treasure` (a three-act arc)

He reads the Forest Temple as kihon → kata → kumite (learn a technique, combine techniques, boss test) on a hub-and-spoke space where the boomerang "acts as key to many locks." "Tight coupling" edges mean "the subordinate must be placed behind the superordinate", so keys are not dropped at random. Rule weights shift during generation for "progressive difficulty" and changes of "register" (traps, then monsters). Loops are closed off where they would short-circuit the mission "by accidently connecting the final room to a room near the entrance."

**Cyclic generation in Unexplored** (Boris the Brave; Tommy Thompson; the Short & Adams chapter).
- 20 levels a run. Each starts as a 5×5 node grid, doubled for corridors, then scaled 5× into tiles. About 50 grammar modules and 5,000 rules.
- Each level starts as a start, a goal and a loop between them. One of **24 major cycle types** shapes the loop. Minor cycles and dead ends are added until the level is big enough. Obstacles, locks and keys are resolved last, by theme, role and difficulty. "The grid nodes are never deleted or moved, just annotated."
- A cycle's two arcs are routes with different obstacles: lock-and-key (A ends at a locked door, B holds the key, return by A), hidden shortcut, and short-dangerous against long-safe. Fan catalogues add blocked retreat, altered return, false goal and monster patrol **[secondary]**.
- The book chapter (pp. 83–96) is "the most systematic section on the deployment of locks and keys" (Emily Short). It covers single- and multi-purpose keys, consumable and reusable keys, asymmetric and "valve" doors, and "Locks Might Be Conditional, Dangerous, or Uncertain".
- Dormans: "it is so much more interesting to generate small levels than it is to generate large ones."

**Why it works.** Cycles turn dead ends into routes that each mean something, the mission gives an arc, and resolving obstacles late keeps theme and difficulty consistent.

### Mark Brown, Boss Keys (GMTK)

Brown reduces each Zelda dungeon to a graph of keys, locks and key items, starting from "what Link can get to at the start of the dungeon" (red diamonds are small keys, red squares are locked doors; from the search snippet of his Patreon notes). Boris the Brave says these diagrams expose backtracking and fake complexity: many dungeons "feel complex, but are actually laid out in such a way that the keys and locks can only be done in a fixed order."

Brown's own criteria, from his Breath of the Wild transcript:
- He praises dungeons that are "an interconnected maze with a real sense of progression".
- He faults the Divine Beasts for having no key items and because "very rarely do the shrines require or encourage backtracking."
- In interview he names the hub-and-spoke dungeon (key rooms forking off a central plaza) as a staple from Link's Awakening onward.

Zelda's map and compass split information into layout (the map) and contents (the compass, which shows chests and the boss) **[standard Zelda design; I could not fetch Brown's own commentary]**.

**Why it works.** Locks give a layout purpose. A dungeon is good when the player must understand it as a whole, and backtracking to an old lock with a new key is a reward, not a chore.

### Bob Nystrom, "Rooms and Mazes" (Hauberk)

1. Try to place rooms a fixed number of times, at odd sizes and positions. The demo uses 20 attempts, and the source's room size is `rng.range(1, 3+roomExtraSize)*2+1`.
2. Flood the remaining solid area with mazes.
3. Mark every wall tile that touches two different regions as a connector, and grow a spanning tree over the regions.
4. Open redundant connectors with a small chance: `extraConnectorChance = 20`, one in 20, from the Hauberk source.
5. Prune dead ends. Hauberk sets `windingPercent = 0`.

His reasons: "perfect dungeons only give you one path to choose from", and loops let the player flank enemies and escape.

**Why it works.** A tree guarantees connectivity. Sparse extra edges add choice without turning the map into an open field.

### Boris the Brave's generator studies

- **Lock and key dungeons.** Locks and keys are abstract: items, upgrades, passwords, event flags. *Hard* requirements must be met. *Soft* ones only encourage, for example "a tough monster guarding a path" that a skilled player can evade. Mission graphs show "how little choice exists."
- **Enter the Gungeon.** Each stage has a few hand-made *flows*: 4 for the Hollow, 8 for the Gungeon Proper. A flow is a graph of room types plus loop edges, each "designed around a specific feature that you can notice with experienced play."
  - Special rooms are injected with stated probabilities.
  - Secret rooms go at dead ends, attach to any room 1 time in 5, and spawn 90% of the time.
  - Chests sit behind one-way loops: "No risk – no reward."
  - The levels "just feel a bit more planned than mere chance would indicate", because "general layouts have been carefully pre-authored."
- **Binding of Isaac.**
  - The grid is 9×8, and a floor holds `random(2) + 5 + level×2.6` rooms.
  - Rooms grow breadth-first. A neighbour is rejected if it already has more than one filled neighbour, and also on a 50% roll.
  - Dead ends are listed. The boss takes the farthest one, and the treasure room and shop take others.
  - The **secret room goes on an empty cell adjacent to at least three rooms and no dead ends**, so the map's shape hints at it.
  - Normal rooms come from easy, medium and hard pools.
- **Diablo 1** (cathedral).
  - The level is a 40×40 grid. Up to three 10×10 "spine" rooms sit on a central axis.
  - Rooms bud recursively in sizes of 2, 4 or 6, switching axis 1 time in 4.
  - One pre-authored set piece is allowed per level, plus 3×3 "minisets".
  - Arch colonnades along the central hall make it look "more deliberately constructed" and help "players orient themselves."

### Brogue (Brian Walker; checked against the Brogue CE source)

- **Accretion.** Rooms come from four shape templates. Each is slid around a "hyperspace" layer until a doorway fits onto the existing map, so the level is a tree from the first room. A room has a 15% chance of a hallway (anderoonies' reimplementation).
- **Loops.** `addLoops(grid, 20)` opens a wall only where the two floor tiles on either side are more than 20 steps apart by path. A loop is added only where it saves a real journey.
- **Chokepoint analysis.** `analyzeMap` finds chokepoints. `chokeMap` gives, for each tile, how much area would be cut off behind it.
- **Reward rooms ("machines").** A reward room is placed only at a *gate site* whose interior size lies within its blueprint's `roomSize` range. How many: `while ((generated+count)*4 + 2 < depth) count++`, "at least one every four levels on average", plus a chance of more (40% early, 15% later).
- **Key puzzles.** Many blueprints hold the vault's key somewhere else in a puzzle room. Examples: "Collapsing floor area -- key on an altar; take key to cause the floor of the area to collapse", "Flood room", "Guardian gauntlet", "Secret room -- key on an altar in a secret room".
- **Libraries.** Some vaults let you "check one item out at a time", which forces a choice.
- **Secret doors.** Ordinary doors become secret with `secretDoorChance = clamp((depth−1)*67/(amuletLevel−1), 0, 67)`: none at depth 1, up to 67% at depth 26. Magic mapping reveals "all traps, secret doors and hidden levers."

**Why it works.** Every special space is sited by an analysis of the layout. Rewards sit behind gates that match their size, and keys lie elsewhere, so every vault becomes a small mission.

### Spelunky (Derek Yu; Darius Kazemi's reconstruction)

The level is a 4×4 grid of 10×8-tile rooms. A solution path walks from a top-row room, rolling 1–5 at each step (1–2 left, 3–4 right, 5 down; at an edge it drops and reverses). Rooms on the path get guaranteed exits by type; rooms off it (type 0) get none. Each type has 8–16 hand-made templates with probabilistic tiles (`4` a 25% pushblock, `7` a 33% spike, `2` a 50% block), 5×3 obstacle chunks and random mirroring. Kazemi's three reroll keys show the layering: new templates; new chunks and tiles; tiles only. The path is always passable "without using ropes or bombs" (GMTK). **Why it works:** structure is guaranteed and hand-designed at room scale, and randomness works only where it cannot break the level.

### Dead Cells (Sébastien Bénard, Motion Twin)

A fixed, hand-made world; hand-made room "tiles" tagged by biome and purpose; and a **concept graph per biome**, laid down entrance and exit first, then special rooms, then combat rooms between. The graph sets "the level's length, the number of special tiles, how labyrinthine the biome is, and how many tiles separate the entrance from the nearest exit" (the Ramparts linear, the Sewers labyrinthine). Rooms are picked to fit the graph, and monsters by budget (one per five combat tiles, a dangerous one counting as 10). Bénard rejected fully procedural levels as "illogical, chaotic", lacking "consistency", and took pacing from Left 4 Dead: "dramatic peaks and relaxing 'breaks'."

### Hades (Supergiant) [unconfirmed: fandom wiki refused the fetch; from play knowledge]

Each exit door shows the symbol of the reward in the next chamber, so choosing a route is choosing a reward. Some doors carry a price: Chaos gates cost health to enter, and Erebus gates raise the difficulty for a better reward. Every region has fixed beats (a mini-boss, a shop, a healing fountain) set between procedurally chosen combat rooms.

**Why it works.** The information on offer at each branch makes it a real decision. A fixed skeleton keeps pacing honest under random contents.

### Caves of Qud (Freehold Games)

Grinblat (GDC 2018) generates historical events and "rationalize[s] them afterward" with replacement grammars. Bucklew (GDC 2019) builds ruins in stages (broad architecture, then Wave Function Collapse detail, then connecting and populating), so "each ruin reflects a procedurally generated culture" (GDC Vault descriptions; detail **[unconfirmed]**). The lesson: layout should mean something drawn from the place's identity.

### Left 4 Dead's AI Director (Michael Booth, 2009 slides)

- **Flow distance** is the travel distance from the start safe room to every nav area. The "Escape Route" is the shortest path to the exit. Flow distance is "used as a metric for populating enemies and loot."
- **Structured Unpredictability** is "not purely random, nor deterministically uniform". For example, mobs of 20–30 spawn every 90–180 s "behind" the team. Wanderer counts are set "based on Escape Route length and desired density."
- **Adaptive dramatic pacing.** Survivor intensity rises with damage taken and with nearby kills, and decays when nobody is engaged. The Director moves through four states:
  - Build Up: full threat until intensity peaks.
  - Sustain Peak: 3–5 s more.
  - Peak Fade: minimal threat until intensity drops.
  - Relax: 30–45 s, or until the team has advanced far enough.
- "Constant, unchanging combat is fatiguing. Long periods of inactivity are boring." Boss encounters are exempt from the adaptation.

### Intensity curves and pacing (The Level Design Book)

- Pacing is beats arranged for variation: pulse, accents, **rests that reset the player's sensitivity**, motifs, syncopation.
- "Start slow." "Alternate highs and lows." "Intensity is not difficulty."
- Avoid finales that are simply the maximum; a finale should feel like "the logical result of the build-up".
- Teach, then test, then twist.
- Arenas: "give the player an opportunity to survey the arena before the fight actually begins."
- Hub-and-spoke "needs lots of work to update the hub with each visit, or else it'll feel like backtracking". "Overly convenient loopbacks can feel like contrived shortcuts."

### Backtracking and shortcuts: metroidvanias and Dark Souls

Lordran is "a single interconnected world" whose regions are "linked by unlockable shortcuts", and bonfires heal and respawn enemies (Wikipedia). The kicked-down ladder back to a bonfire is the signature move **[not fetched]**. The Wellesley metroidvania paper finds "topological information alone is sufficient for most navigation tasks", and that what the player has seen but not entered is central to exploration. The principle: a return is good when the space has changed (a new key, an open shortcut, a rest to come back to). Walking ground already covered is the tedious part.

### Secrets

The sources agree on four points:
- **Signpost by structure.** Isaac's ≥3-neighbour rule; Gungeon's dead ends.
- **Never require them; reward curiosity.** Justin Alexander: secret paths "reward curiosity and exploration". Because other viable paths exist, they "may be missed by the unwary".
- **Make them rarer or harder with depth.** Brogue's 0–67%.
- **Give a tool that reveals them.** Brogue's magic mapping; Zelda's map and compass.

The Angry GM adds salience: "Make your directions look different, dammit!"

### Risk, reward and push-your-luck

Incan Gold (Wikipedia): bold players "venture on, push their luck, and risk losing the treasure they have accumulated", while cautious ones leave and keep it. Press Your Luck: a Whammy "resets the total to zero", and later rounds raise the stakes. The pattern needs:
- visible banked gains,
- a stop that is always available,
- rising stakes,
- a known failure condition.

Gungeon's chests behind one-way loops and Hades' paid doors apply it to space.

### The Berlin Interpretation (RogueBasin)

Among the high-value factors are resource management and **exploration and discovery**, "done again in every new game". In ARISE, the map has to carry both.

### Procedural Content Generation in Games (Shaker, Togelius, Nelson)

Chapter 3 defines dungeons as "labyrinthic environments, consisting mostly of interrelated challenges, rewards and puzzles, tightly paced in time and space." It shows theming by partition: one partition locked with its key in a sibling partition, monsters in one and rewards in another. Chapter 12 gives **expressive range analysis**: score many outputs on metrics (linearity, leniency) and plot histograms to expose bias and sameness.

### The Angry GM and The Alexandrian (tabletop, which applies directly to room graphs)

The Angry GM: players keep "lists of possible next actions", want to know whether a path goes forward, sideways or backward, and finish what they started. "Don't let the 'what next' list get too big": players "need to feel like they're shrinking the space." Justin Alexander: branches alone are "functionally linear", loops are "the basic building blocks for non-linear dungeons", and a single route between levels collapses complexity "into a chokepoint."

### Slay the Spire's map [unconfirmed: community readings of the decompiled generator]

The map is 7×15 and drawn by six path walks. Rests are about 12%, events 22%, elites 8% and shops 5%. There are no elites or rests on the first five floors, no rest just before the boss's rest, and no two elites, shops or rests in a row. Node types are visible from the start, so the decision is about routing, not discovery.

---

## 2. Cross-cutting principles

**Layout**
1. *Mission before space* (Dormans, Gungeon, Dead Cells, Isaac). Decide what the floor asks of the player (where the key, the guardian, the reward and the rest are) and then embed it in the grid.
2. *Cycles over trees* (Dormans, Nystrom, Alexander). A branch is linear. A loop is a choice between two arcs, and it means something only when the arcs differ (danger against length, reward against safety).
3. *Site special spaces by analysis, not by chance* (Brogue's gate sites, Isaac's dead ends and farthest boss, L4D flow distance). Rewards go behind chokepoints sized to them, bosses at the far end, keys away from their locks.
4. *Theme drives structure* (Dead Cells' biome graphs, Unexplored's themes and roles, Qud's cultures). A crypt and a war camp should differ in topology as well as in their foes.
5. *Landmarks orient* (Diablo's colonnades, the Level Design Book's "name and theme map areas"). Salient, different-looking places make choices non-arbitrary.

**Pacing**
6. *Gradients by flow distance* (L4D, Dormans' progressive difficulty, Isaac's pools). Danger and reward should rise with distance from the start and from the critical path.
7. *Peaks need valleys* (L4D Build/Sustain/Fade/Relax; the Level Design Book's "rests reset sensitivity"). A threshold guardian opens the act, a breather follows the hardest beat, and the finale follows from the build.
8. *Fixed beats, random contents* (Hades' region skeleton, Slay the Spire's floor rules).

**Secrets**
9. Signposted by geometry or a cue, optional, rewarding, rarer or harder with depth, and revealable by a tool.

**Backtracking**
10. A return must find something changed: a key used, a seal broken, a shortcut opened, a kept rest, an altered return. Where travel costs nothing, the cost of going back is a *resource* decision, not tedium.

**Information**
11. Show topology and goal so the player knows forward from sideways. Make options look different. Let the player survey before committing. Keep the list of open options small. Push-your-luck needs visible stakes and an always-available stop.

**Variety**
12. Layer randomness (Spelunky's three keys) over a library of authored skeletons (Gungeon's 4–8 flows, Unexplored's 24 cycles). Measure expressive range so sameness shows up as data, not as a player complaint.

---

## 3. Audit of ARISE's generator

### Strengths

- **Determinism and versioning are exemplary.**
  - `build(d, seed, layout)` dispatches on `Layout` (`labyrinth | floors | rooms | layers`), and a run keeps its layout.
  - Shape and contents draw from separate streams (`arise|shape|`, `arise|plan|`, `arise|node|`), the same layering as Spelunky's reroll keys.
  - This makes every proposal below safe to add as a new layout.
- **A guaranteed critical path, as in Spelunky.** `floorPlan` walks a road up and along, never down and never across itself, capped by `along` and `PLAN_MAX.rows`. The head sits alone in its row. `systemRoad` is the BFS-shortest path, which is Booth's "Escape Route" exactly.
- **Topology visible, contents fogged.** `sight` always shows corridors, the entrance and the boss. The player always knows forward from sideways (Angry GM), and the boss is a visible goal. The fog then hides only *what*, which is the right half to hide.
- **The vault is Brogue's reward room in miniature.** With `vary`, the Gatekeeper is placed at a leaf side room with a free cell behind it (`behind`). The vault is reachable only through it, and `reach` gates it on `unsealed`. This is a "tight coupling" in Dormans' sense, sited at the end of a branch like Isaac's special rooms.
- **Loops respect the road.** The `pairs` loop pass rejects any edge that shortens `distances(...)[boss]`, as Dormans did to avoid "short circuiting the mission". `HIDDEN_PASSAGE.apart = 3` echoes Brogue's rule that loops connect only far-apart tiles.
- **Rests are bonfires.** A rest is found, kept and used once (`restHere`, `run.rested`), and `systemNext` walks back to a kept rest before the boss. A return with purpose.
- **Push-your-luck already exists.** The haul, stash and purse are banked on the run and lost when carried out (`finish`). Withdrawal is always available from the entrance (`canWithdraw`) and pays `withdrawShare = 0.15 + 0.85×0.6×min(1, done/total)`. This is Incan Gold's structure.
- **Legibility is a hard constraint.** `PLAN_MAX` (6×8 at about 45 px) and Dormans' "small levels are more interesting" point the same way.

### Gaps

1. **Contents are independent of position.**
   - `furnish` draws every fight as `1 + floor(rr()*3)` foes from `d.mobs`, wherever it is. A three-pack beside the entrance and a lone creature before the stairs are equally likely.
   - Side-room kinds come from flat `SIDE_LABYRINTH` weights, whatever their depth or dead-end status.
   - Off-road fights pay the same purse as road fights (`FIGHT_PURSE.fight × paceOf`).
   - There is no flow-distance gradient (L4D, Isaac, Dormans) and no reward placement by analysis (Brogue).
2. **Choices are uninformed.** A seen fight renders as a plain fist (`looksOf` in `ui/map.tsx`), with no count and no threat. Traps, caches and rests are deliberately disguised as Events. Two unentered neighbours usually look identical, which breaks "make your directions look different". Loops offer a choice with no information behind it.
3. **One lock, and it is a guardian.** The Gatekeeper-and-vault pair is lock and key in the same place. No key lies elsewhere, there are no valves, no soft or dangerous locks, and no lock on the critical path.
   - Loops come from random adjacency (`L.loop` 0.15–0.25) and are forbidden to matter to the road.
   - Walking back is free and instant (`moveTo` jumps to any explored room), so loops bring none of their usual benefit of saving travel. Their only value is offering a different set of unentered rooms, which they rarely do on purpose.
   - The result is close to Alexander's "functionally linear" branches.
4. **Hidden passages are surprises, not secrets.**
   - A passage opens automatically when a room at either end is cleared (`passages`). `sight` and `reach` then add the room beyond at once.
   - Nothing signposts it, no action finds it, Perception plays no part, and the player can do nothing to look for one.
5. **Pacing is coin flips.**
   - Road rooms past the first become non-fights independently at `ROAD_ODD.chance = 0.3`, capped at 2.
   - Rests are a 12% weight among odd road rooms and 4% in labyrinth side rooms, capped at `RESTS_MAX = 2`.
   - No beat plan exists: no threshold guardian, no breather after a peak, no guaranteed calm before the stairs.
6. **Theme is ignored.** `Dungeon.theme` and `identity` never reach `map.ts`.
   - "Gatewarden Labyrinth — Monumental maze", "Goblin Embercamp — traps and lookout platforms" and "Rustwater Drain — flooded network" draw the same spine-plus-tree.
   - Variety comes only from `TURNS` rotation, the foot column, `beyond`, and the per-grade `LABYRINTH` row.
   - Every road is a monotone staircase (never down), rotated.
7. **No landmarks.** Room numbers are gone, and orientation rests on the entrance and the boss.
8. **Floors are each a single chokepoint.** One staircase links each pair of floors, and a whole S-Rank Gate (96 rooms) has one Gatekeeper and one vault. Alexander's warning applies: a single connection "collapses" a level into a chokepoint.
9. **Attrition may leak.** On every won chamber, `openChamber().result()` heals living units by `ROOM_RECOVERY + recovery`, at least 25% of max HP. Any side fight that costs less than that is a net heal. That would make easy side fights the de facto rest and blunt both the rarity of rests and the push-your-luck. **This needs measuring, not assuming** (see proposal 2).

---

## 4. Proposals, ranked

Shared rules for every proposal:
- Any change to drawing goes in a new layout, `'labyrinth2'`, added to `Layout` and `build()`. Older runs keep theirs. Every roll is seeded from `run.seed` or the map seed plus a node id. Nothing reads `Math.random` or the clock.
- "Off-road" means the System's road, the brief and calibration never see it, so the gates need no recalibration (pay changes still need `npm run campaign`).
- Copy that quotes a number reads it from constants (Guide). System windows never explain.

### 1. Threat marks on seen fights (small)
- **What to build:** a seen, unentered fight room shows its foe count as 1–3 pips under its fist. Add a red edge when a foe is the Gate's heaviest mob, and a crown when it is the Gatekeeper's room (already a distinct kind).
- **Sources:** Hades' door previews; Angry GM's "make your directions look different"; the Level Design Book's "survey before the fight"; Slay the Spire's typed nodes.
- **Touches:** `ui/map.tsx` (`looksOf`, `RoomsView`), plus the brief's plan. It reads `x.foes`, which `furnish` already draws deterministically.
- **Decision added:** loops and branches become real routing choices (two singles against one three-pack). It fits the pillar that a foe's shown intent is a promise.
- **System and simulation:** no engine change; they never read the UI. No recalibration.

### 2. Expressive-range report, `npm run mapstats` (small)
- **What to build:** a script that draws 500 maps per grade and layout and prints histograms of:
  - rooms, road length, dead ends, maximum branch depth;
  - cyclomatic number (corridors − rooms + 1 per floor), passages;
  - rests on and off the road, odd rooms on the road, foes on the road;
  - cache distance from the road, Gatekeeper depth.
- **Second pass:** with `runChamber` and `typicalHunter`, the share of side fights that end in a net heal (gap 9).
- **Source:** PCG book chapter 12 (Smith and Whitehead's linearity and leniency).
- **Touches:** `scripts/` only.
- **Decision added:** none for the player. It makes sameness, and every proposal below, measurable. Deterministic by construction.

### 3. Perception finds hidden passages, and secret caches (small to medium)
- **What to build:**
  - In `'labyrinth2'`, a passage no longer opens by itself. When a room at either end is cleared, a check seeded `arise|draught|${run.seed}|${a}|${b}` against a PER curve shaped like `TRAP.check` (base, per point, max; stated in the Guide) decides whether the hunter notices it. A noticed passage shows a crack on that wall and opens.
  - Add a **secret cache**: a cell with no corridor on a spot adjacent to at least 2 rooms (Isaac uses ≥3 on a sparser grid; tune with mapstats), joined to one neighbour by a hidden passage.
  - The Gate Survey charts passages and secret rooms, as magic mapping does.
- **Sources:** Isaac's secret-room rule; Brogue's depth-scaled secret doors and magic mapping; Alexander ("reward curiosity", never required); Gungeon's dead-end secrets.
- **Touches:** `map.ts` (`floorPlan` passage pass, a new `secret` placement), `passages` and `reach` (a `noticed` argument), `raid.ts` (`run.noticed`, written when the clearing step resolves), `nodes.ts` (copy), `ui/map.tsx` (crack mark).
- **Decision added:** Perception gets a job on the map. Exploring next to an odd gap in the plan pays.
- **System and simulation:** the System never uses passages, so no recalibration. Rerun the campaign for the extra caches.

### 4. Flow-distance gradients (medium)
- **What to build,** in `'labyrinth2'`. Compute `t` (the room's distance from the floor's foot over the foot-to-head distance) and `off` (corridors from the road):
  - Fights draw 1–2 foes for `t < 1/3`, 1–3 in the middle, 2–3 in the last third, plus one per floor below the first, capped at 3.
  - Side rooms at `off ≥ 2` reweight toward cache and shrine.
  - A cache at `off ≥ 2` finds at the Gate's own grade (`haulFind` shift 0, not −1).
  - An off-road fight at `off ≥ 2` pays `FIGHT_PURSE.deep` (for example 0.3, against 0.2).
- **Sources:** L4D flow distance; Dormans' progressive difficulty; Isaac's room pools; Brogue's reward siting.
- **Touches:** `map.ts` (`furnish` takes `t` and `off`; `floorPlan` passes them), `raid.ts` (`haulFind` shift from `x`, the purse in `record`), `nodes.ts` (`FIGHT_PURSE`).
- **Decision added:** the further you go, the harder and richer it gets. A clean push-your-luck gradient, legible with proposal 1.
- **System and simulation:** road fights change, so run calibrate, then balance and the campaign. Deterministic from the node seed.

### 5. Road beats and paced rests (small to medium)
- **What to build:** in `'labyrinth2'`, replace `ROAD_ODD`'s independent rolls with a per-floor beat plan:
  - Road room 0 is a one-foe fight (the threshold guardian).
  - Exactly one odd room in the middle third (shrine, event or trap), never adjacent to another.
  - The room before the stairs or boss is never a trap.
  - A floor's rest (at most one; chance by grade) sits **off the road at branch depth 1–2 from a road room past the midpoint**: a mid-floor bonfire to return to.
  - Extend `systemNext` so the System detours to a rest one corridor off its road (seen as soon as the adjoining road room is cleared).
- **Sources:** L4D Build/Relax; Dormans' threshold guardian; the Level Design Book's rests and "start slow"; Slay the Spire's rest rules.
- **Touches:** `map.ts` (`floorPlan` kind assignment), `raid.ts` (`systemNext`).
- **Decision added:** floors have a shape you can feel. A rest is a place you plan around.
- **System and simulation:** recalibrate (road contents and System behaviour change).

### 6. The Gatekeeper's wing (medium)
- **What to build:** in `'labyrinth2'`, compute for each candidate side room the subtree it would seal off (a tree, so a DFS count gives Brogue's `chokeMap`). Put the Gatekeeper at a gate site whose interior holds 2–4 rooms. Everything behind it is sealed until it falls. The wing ends in the vault and holds 1–3 rooms from a richer table (cache at grade, shrine, and on A and S a rest). At A and S, one wing per two floors, not one per Gate.
- **Sources:** Brogue's gate sites and `roomSize`; Gungeon's "no risk – no reward"; Alexander's sub-levels.
- **Touches:** `map.ts` (keeper placement, a `sealedBy` field), `reach` and `unsealed` (seal a region, not just the `vault` kind), `nodes.ts` copy, `finish` (several vaults).
- **Decision added:** "take on the Gatekeeper" becomes a commitment to a whole side dungeon, a bigger and clearer gamble.
- **System and simulation:** off-road, so no gate recalibration. Rerun the campaign.

### 7. The Toll Door, a soft lock (small to medium)
- **What to build:** in `'labyrinth2'`, at most one per floor. It is an extra corridor between two rooms at least 4 apart by path (Brogue's rule). It opens either a shortcut toward the stairs or boss, or the only door to a closed cache room. Paying the toll, a stated share of the hunter's max HP (for example 20%), opens it: `raid.payToll(s, d, run, a, b)` writes `run.tolls` and the party, like `restHere`. Draw it as a red seal on the corridor (red for damage, per the colour rules).
- **Sources:** Dormans' "Locks Might Be Conditional, Dangerous, or Uncertain"; Boris's soft requirements; Hades' Chaos gates; Unexplored's dangerous route.
- **Touches:** `MapNode.toll`, `reach`, `raid.ts`, `ui/map.tsx`.
- **Decision added:** health now against fewer fights or a sure find later.
- **System and simulation:** the System never pays, so no recalibration; the brief stays exact for its road.

### 8. Landmarks and themed set pieces (medium)
- **What to build:** one landmark per floor in `'labyrinth2'`, drawn from the Gate's `identity` (`LANDMARKS` in `nodes.ts`, for example an Ossuary for Undead-led, a Watch Platform for Goblinoid-led, a Brood Chamber for Insectoid-led).
  - It sits off the road (`off ≥ 1`, `t` in the middle third).
  - It shows its own glyph through the fog from the start, like the boss: `sight` adds it.
  - It holds a themed event with one `system` choice that never hurts (extend the existing voice and map test).
- **Sources:** Diablo's set pieces and colonnades; the Level Design Book's "name and theme map areas"; Caves of Qud; the Angry GM's salience.
- **Touches:** `map.ts`, `nodes.ts` (data and copy), `ui/map.tsx` (glyphs at 45 px).
- **Decision added:** a mid-floor goal and a navigation anchor; Gates become recognisable.
- **System and simulation:** off-road, so no recalibration. Rerun the campaign if they pay.

### 9. The way out is held (small to medium)
- **What to build:** once the vault (or a wing from proposal 6) is opened, a returning pack (2 foes from `d.mobs`, seeded `arise|held|${run.seed}`) takes the entrance. `canWithdraw` requires it beaten, and it appears as an option. Copy: the feed only, no System explanation.
- **Sources:** Dormans' "altered return" and "blocked retreat"; Incan Gold's rising stakes.
- **Touches:** `raid.ts` (`run.held`, `options`, `canWithdraw`, `chamberAt`), `map.ts` (no drawing change).
- **Decision added:** greed costs something on the way out. Opening the vault while hurt becomes a real gamble against pushing on to the boss.
- **System and simulation:** the System never opens a vault, so no recalibration.

### 10. Theme profiles for topology (medium)
- **What to build:** `PROFILE[identity]` holds `FloorSize` deltas and side-room weights, with per-Gate overrides for named architectures. Examples:
  - Goblinoid: traps ×2, loop +0.1.
  - Beast: depth +1, loop −0.1 (dens).
  - Undead: shrines and events ×1.5.
  - Construct: caches ×1.5.
  - DNG-037 "Gatewarden Labyrinth": loop 0.35, along 4.

  Apply it in `floorPlan` for `'labyrinth2'`, held to `PLAN_MAX`.
- **Sources:** Dead Cells' per-biome concept graphs; Unexplored's themes and roles; PCG book chapter 3's partition theming; Caves of Qud.
- **Touches:** `map.ts`, `data/dungeons.ts` (or a new `data/layouts.ts`).
- **Decision added:** Gates of different identities *play* differently, not just fight differently.
- **System and simulation:** recalibrate (calibration is per Gate, so it absorbs this), then rerun the campaign.

### 11. The Sealed Stair: a lock-and-key cycle (large)
- **What to build:** in `'labyrinth2'`, at C and above, about 40% of floors. The stairs down (or the boss's door) are sealed. A **seal-stone** room (a themed fight or a bound-circle event) sits on the far arc of a *designed* loop, which the generator draws deliberately, unlike the random `pairs` pass. The mission is entrance → stone → stairs, and the return goes by the other arc. The plan shows the lock from the start; the stone is found.
- **Sources:** Dormans' lock-and-key cycle; Boss Keys; Brogue's key-elsewhere vaults; Unexplored's ThreeLeverHub.
- **Touches:**
  - `map.ts`: the cycle, `seal` and `opens` fields, `reach`.
  - `systemRoad`: concatenate BFS legs (entrance → stone, stone → stairs).
  - `raid.systemNext` and `systemMove`: a `walk` move back through cleared rooms.
  - `paceOf`: road room count.
  - UI lock glyph (it exists for the vault).
- **Decision added:** each floor has a mission. The visible topology turns into a planning puzzle, and backtracking has a reason.
- **System and simulation:** the System's road changes, so recalibrate, then rerun balance and the campaign.

### 12. Floor flows: an authored skeleton library (large)
- **What to build:** `data/flows.ts`, about 8 abstract floor graphs with roles (foot, head, key, lock, keeper, wing, landmark, arc A and arc B, pocket). Candidates:
  - Spine and Branches (today's floor)
  - Hub and Spoke (Forest Temple)
  - Two Roads (short with the heavy pack, long with small fights and a shrine)
  - Sealed Stair (proposal 11)
  - Gauntlet (few side rooms, rich end)
  - Ring (stairs opposite the foot)
  - Warren (many short dead ends with caches)
  - Keep (Gatekeeper wing central)

  Embed them by annotating grid cells and never moving nodes (Unexplored), then grow the remaining rooms with the existing `branch` machinery. Choose by seed, weighted by theme profile (proposal 10). A validator checks reachability, `PLAN_MAX` and System-road validity; mapstats reports range per flow.
- **Sources:** Gungeon's flows (4–8 per stage); Unexplored's 24 cycle types; Dead Cells' concept graphs; Spelunky's templates by role.
- **Decision added:** floors become recognisable kinds of problem, which is the strongest cure for sameness.
- **System and simulation:** recalibrate, then rerun the campaign.

**Order of work.** 1 and 2 first: cheap, and they make everything after legible and measurable. Then 3, 4 and 5 as one `'labyrinth2'` change with one recalibration. Then the off-road additions 6–9, which need no gate recalibration. 10–12 last, as the structural rebuild.

---

## 5. Sources

- Dormans 2010, "Adventures in Level Design" (PDF): https://pcgworkshop.com/archive/dormans2010adventures.pdf
- Boris the Brave, Dungeon Generation in Unexplored: https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/
- Boris the Brave, Lock and Key Dungeons: https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons
- Tommy Thompson, Unexplored's cyclic generation: https://www.gamedeveloper.com/design/unexplored-s-secret-cyclic-dungeon-generation-
- Emily Short on Procedural Generation in Game Design (Dormans chapter): https://emshort.blog/2017/06/28/some-articles-from-procedural-generation/
- Short & Adams (book page): https://www.routledge.com/Procedural-Generation-in-Game-Design/Short-Adams/p/book/9781498799195
- Sersa Victory, Cyclic Dungeon Generation: https://sersavictory.itch.io/cyclic-dungeon-generation
- Cyclic generation applied (false goal advice): https://filbot3.github.io/posts/cyclic-dungeon-generation
- Cyclic generation devlog (valves): https://oopolo.itch.io/dungeon-of-doom/devlog/818069/from-graphs-to-gameplay-a-deep-dive-into-cyclic-dungeon-generation
- Mark Brown, Boss Keys BotW transcript: https://pastebin.com/Naf8fy39
- Boss Keys notes (Patreon, search snippet only): https://www.patreon.com/posts/how-my-boss-key-13801754
- Mark Brown interview (search snippet only): https://www.zeldadungeon.net/we-interviewed-mark-brown-of-game-makers-toolkit/
- Boss Keys overviews: https://roomescapeartist.com/2017/09/10/boss-keys-analysis-zelda-dungeons/ ; https://hyruleuniversity.wordpress.com/2017/09/29/review-of-boss-keys/ ; https://www.gamedeveloper.com/design/take-a-close-look-at-the-level-design-of-some-exceptional-i-zelda-i-games
- Bob Nystrom, Rooms and Mazes: https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/
- Hauberk source (parameters): https://raw.githubusercontent.com/munificent/hauberk/db360d9efa714efb6d937c31953ef849c7394a39/lib/src/content/dungeon.dart
- Brogue CE source: https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Architect.c ; https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/variants/GlobalsBrogue.c
- Brogue generation reimplementation: https://anderoonies.github.io/2020/03/17/brogue-generation.html ; https://anderoonies.github.io/2020/04/07/brogue-generation-2.html
- Brogue wiki (search snippet): https://brogue.fandom.com/wiki/Level_Generation
- Kazemi, Spelunky generator: https://tinysubversions.com/spelunkyGen/ ; https://tinysubversions.com/spelunkyGen2/
- GMTK, How and Why Spelunky Makes its Own Levels (transcript, search snippet): https://amara.org/subtitles/p6MHlmreohsY/en-gb/1/download/How%20and%20Why%20Spelunky%20Makes%20its%20Own%20Levels%20%20Game%20Makers%20Toolkit.en-gb.txt
- Bénard, The Level Design of Dead Cells: https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/ ; https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-
- Boris the Brave, Diablo 1: https://www.boristhebrave.com/2019/07/14/dungeon-generation-in-diablo-1/
- Boris the Brave, Enter the Gungeon: https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/
- Boris the Brave, Binding of Isaac: https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/
- Grinblat, GDC 2018: https://www.gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves
- Bucklew, GDC 2019: https://www.gdcvault.com/play/1026263/Tile-Based-Map-Generation-using
- Booth, The AI Systems of Left 4 Dead (2009): https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf
- The Level Design Book: https://book.leveldesignbook.com/process/layout ; https://book.leveldesignbook.com/process/layout/typology ; https://book.leveldesignbook.com/process/preproduction/pacing ; https://book.leveldesignbook.com/process/layout/criticalpath ; https://book.leveldesignbook.com/process/combat/encounter
- Berlin Interpretation: https://www.roguebasin.com/index.php/Berlin_Interpretation
- PCG book: http://pcgbook.com/chapter03.pdf ; http://pcgbook.com/chapter05.pdf ; http://pcgbook.com/chapter12.pdf
- The Alexandrian, Xandering the Dungeon pt. 2: https://thealexandrian.net/wordpress/13103/roleplaying-games/xandering-the-dungeon-part-2-xandering-techniques
- The Angry GM, How Players Explore: https://theangrygm.com/pretty-good-dungeon-how-players-explore/
- Dark Souls (Wikipedia): https://en.wikipedia.org/wiki/Dark_Souls_(video_game)
- Representing Exploration in Metroidvania Games: https://cs.wellesley.edu/~pmwh/mvmap/papers/reimg/reimg.html
- Incan Gold: https://en.wikipedia.org/wiki/Incan_Gold ; Press Your Luck: https://en.wikipedia.org/wiki/Press_your_luck
- Red Blob Games, BFS dungeons: https://www.redblobgames.com/x/2043-bfs-dungeons/

Not fetched, marked [unconfirmed] in the text: Hades' door, gate and fountain details; Slay the Spire's map rules; Derek Yu's own book; Brown's map and compass commentary; Dark Souls' ladder specifics; the detail of the Qud talks.
