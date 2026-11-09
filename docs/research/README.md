# Dungeon crawler research

Eight reports on what the best dungeon crawlers do, exactly how they do it, and what ARISE can take
from them, written in November 2026 to feed the next round of docs/DESIGN.md. Each covers one part of
the genre, ends with ranked ideas for ARISE that respect its constraints (turn-based and one-handed,
offline, deterministic for a seed and a list of orders, no energy or gacha, an original world), and
lists every source it used.

| Report | Covers |
|---|---|
| [action-roguelites.md](action-roguelites.md) | Hades and Hades II, Dead Cells, Risk of Rain 2, Enter the Gungeon, Rogue Legacy 2, Children of Morta, Moonlighter, Cult of the Lamb |
| [turn-based-tactics.md](turn-based-tactics.md) | Slay the Spire 1 and 2, Darkest Dungeon 1 and 2, Into the Breach, Monster Train, Inscryption, Loop Hero, Wildfrost |
| [labyrinth-crawlers.md](labyrinth-crawlers.md) | Etrian Odyssey, Legend of Grimrock, Wizardry, Dungeon Master, Persona's Tartarus and Mementos, Labyrinth of Touhou, Undernauts, Mary Skelter, Operencia |
| [traditional-roguelikes.md](traditional-roguelikes.md) | Shiren the Wanderer 6, Pokémon Mystery Dungeon, Brogue, DCSS, Shattered Pixel Dungeon, NetHack, Cogmind, Caves of Qud, Crypt of the NecroDancer, Barony |
| [arpg-loot-endgame.md](arpg-loot-endgame.md) | Diablo II, III and IV, Path of Exile 1 and 2, Last Epoch, Grim Dawn, Torchlight, Minecraft Dungeons |
| [collection-armies.md](collection-armies.md) | SMT and Persona, Dragon Quest Monsters, Pokémon, Siralim, Monster Sanctuary, Cassette Beasts, Digimon, Palworld, Brogue's allies, XCOM, Fire Emblem, minion builds |
| [mobile.md](mobile.md) | Solo Leveling: Arise, Shattered Pixel Dungeon, Archero, Arknights' Integrated Strategies, Honkai: Star Rail's Simulated Universe, Genshin's Abyss, and the phone ports of Slay the Spire, Darkest Dungeon, Wildfrost, Balatro and Loop Hero |
| [dungeon-theory.md](dungeon-theory.md) | Dormans and Unexplored's cyclic generation, Boss Keys, Rooms and Mazes, Brogue, Spelunky, Dead Cells, Isaac and Gungeon generators, Left 4 Dead's Director, pacing and secrets; with an audit of `src/core/map.ts` |

## How far to trust them

- The session's shared web-search allowance ran out after 12 to 45 searches per report. The rest came
  from direct fetches of papers, patch notes, wikis and published source code (Brogue CE, Shattered
  Pixel Dungeon, DCSS, the Pokémon Mystery Dungeon Red decompilation, Hauberk).
- Fandom wikis, Bulbapedia, Reddit and some press sites refused fetches. Anything a report could not
  check against a source is marked *unconfirmed* or *[unconfirmed]* where it appears.
- Statements about ARISE's code were true of `main` at commit `9807285`. Line references will drift.
- These are research notes, not decisions. Nothing here is built until it lands in docs/DESIGN.md.

## Where they agree

The reports were written independently. Proposals that several of them reached from different games:

- **Opt-in risk on a Gate with stated pay** (five reports): Hades' Pact, Path of Exile's map mods,
  DCSS's conduct gods, Slay the Spire's burning elites. Proposed as Seals, Oaths, Vows, Pacts and
  omens; one surface on the brief would do.
- **Shrines rebuilt** (four): blessings by Path that change verbs, with Duos and Pacts.
- **Threat and reward shown on seen rooms** (four).
- **Rewards for hand play that Auto never chases** (three): Feats with projected odds, condition
  drops, par-graded challenges.
- **A cost to moving** (three): a room-counted clock, or creatures that move when the hunter does.
- **Consumables that do something** (three): throwables in the bag's empty slots.

A synthesis of all eight, with a phased roadmap and the open questions, was published as a private
page alongside this commit: https://claude.ai/artifact/JHPVQuvC8AY6g9Mhnk5oQH
