# Brief: the game content as data

Read `docs/briefs/_common.md` first.

You transcribe the game design bible into the data files the whole game runs on. Everything downstream (simulation, world, HUD,
sound, the modellers' naming) depends on these files being complete, consistent and faithful to `docs/DESIGN.md`.

## Your files

- `src/content/ages.js`        `export const AGES` : `AgeDef[]` in order
- `src/content/towers.js`      `export const ARCHETYPES` : `TowerArchetypeDef[]` in build-bar order
- `src/content/enemies.js`     `export const ENEMIES` : `Record<string, EnemyDef>`
- `src/content/waves.js`       `export const WAVES` : `WaveDef[][]` (one array per age)
- `src/content/maps.js`        `export const MAPS` : `MapDef[]`
- `src/content/abilities.js`   `export const ABILITIES` : `AbilityDef[]` (one per age)
- `src/content/balance.js`     `export const BALANCE` : `Balance`
- `src/content/index.js`       `export const content` : `Content` assembling all of the above (plus re-exports)
- `src/content/themes.js`      exists; keep `getLightTheme(ageId)` and `getGroundColor(ageId)` working by reading from `AGES`
- `tests/content.test.mjs`     consistency tests (see below)

These files must not import three.js or touch the DOM (the simulation imports them in Node). Types: `src/types/content.d.ts`
(annotate every export with `/** @type {...} */` so the type checker verifies every field). Rules that give the numbers meaning:
`docs/SIM.md`.

## How to transcribe

- Ids: ages, tower roles and enemies get exactly the ids of `docs/DESIGN.md`. Model ids follow `docs/ARCHITECTURE.md`:
  `tower.<age>.<role>`, `enemy.<age>.<name>`, `boss.<age>.<name>`, `prop.<age>.<name>`, `base.<age>`, `shot.<name>`.
  The list of model ids at the end of `docs/DESIGN.md` is binding for names; use exactly those.
- Every German name, flavour sentence and description comes from the bible; where the bible has none, write one in the same voice
  (short, warm, a little wry; real umlauts).
- `AgeDef.light`: translate the bible's sky, sun and fog colours and sun angles into a `LightTheme`. Hemisphere colours and
  intensities are yours to choose so that the age matches its described mood; the balance between sun and sky light should keep a
  flat sunlit surface close to its data colour (as a guide `sunIntensity * sin(elevation) + hemiIntensity` is about 3.0 to 3.4 by day,
  lower at dusk, about 1.6 to 2.2 at night with a cool tint). Look at the result:
  `node tools/shot.mjs "http://127.0.0.1:8317/viewer.html?ids=example.*&theme=<age>&level=3" <png> --ready --gpu` and
  `http://127.0.0.1:8317/devworld.html` for the neutral reference. Night must stay readable.
- `AgeDef.terrain`, `abyss`, `particles`, `music`, `scatter`: from the bible's description of the age. Scatter rules use the prop
  model ids of that age with sensible zones, weights, scales and cluster sizes; include at least one `block` rule (an object that
  visibly fills a blocked tile), two or three `field` rules (small ground decoration) and, where the bible describes distant scenery,
  `far` rules.
- Towers: `stats` are the values of level 1 in the first age; later ages and levels scale through `BALANCE` exactly as
  `docs/SIM.md` defines (`towerStats`). Use `levels` for what a level changes besides damage and range, and `tweak` on a tier when
  the bible says an incarnation differs (for example becomes hitscan, gains a larger radius). `shot` describes look and sound of
  every incarnation from the bible's attack visual, using only the options of `ShotVisual`, `ShotSound`, `ImpactSound`.
- Enemies: relative values exactly as the contract defines them (multiples of the age's standard enemy; armour as a share of the
  age's standard shot).
- Waves: the complete wave tables of the bible, as spawn groups with delays and intervals that produce the described rhythm.
  A wave should take roughly 25 to 45 seconds to spawn.
- Maps: the bible's three maps. Follow the `MapDef` rule that the first and the last waypoint lie exactly one tile OUTSIDE the
  playfield (extend the bible's paths by one tile at both ends if they stop at the edge). Add blocked tiles as the bible describes
  (or, if it gives none, a handful per map that shape the build spots without sealing off the path).
- `BALANCE`: the bible's starting model (chapters 2.2, 2.3, 2.8, 2.9), expressed in the fields of `Balance`. It will be tuned by
  simulation later; aim for a coherent, plausible start, not perfection.
- Role specifics from chapter 2.2: the Bremser's puddle is a `zone` (see `TowerStats.zone`), the Brenner is a `hitscan` with `splash`
  and `dot`, the Taktgeber an aura with `range` 1.5 (the 8 neighbouring tiles), the Schütze's level-3 double shot is half the cooldown
  at half the base damage, the Panzerknacker's level-3 pass-through is `chain: 1`. Growth of slow and aura per age goes into the tier `tweak`s.
- Enemies need `color` (main colour of the figure) and, for the three bosses named in chapter 5, `phases`.
- `ABILITIES`: the Zeitglocke of chapter 2.7 for every age (`radius: 0`, `rewind: 4`, `slow: 0.5`, `damage: 0`); the six entries may
  differ only in flavour text.
- `MAPS`: exactly the waypoints of chapter 7.

## Tests (`tests/content.test.mjs`)

Assert at least: ids unique; every archetype has a tier entry for every age (6 roles x 6 ages = 36 incarnations) and an `unlockWave` from 0 to 5 as in chapter 2.2; every model id is well
formed and unique where it must be; every wave references existing enemies; the last wave of every age contains exactly one boss and
no other wave contains one; every `BALANCE` array has one entry per age; all numbers are finite and in sensible ranges (cooldowns
positive, ranges between 1 and 8, speeds between 0.3 and 4, colours valid hex); every map satisfies the `MapDef` rules (waypoints
axis-aligned, first and last exactly one tile outside, all paths end on the same tile, `buildPath` succeeds, blocked tiles inside the
playfield and not on a path, at least 40 buildable tiles within 2.5 tiles of a path); `createSim({ content, ... })` from
`src/sim/sim.js` accepts the content for every map and difficulty once that file exists (skip the test with a clear message while it
does not); scatter rules reference only model ids of their own age (or shared `prop.common.*` ids if you introduce any, which you
must then list in your report).

## Final report

Counts (ages, roles, tower incarnations, enemies, waves, maps), the complete list of model ids your data references grouped by file
(`src/content/models/<age>/towers.js` etc.), every place where you had to interpret or fill a gap in the bible, and every place
where the bible asks for something the contracts cannot express (do not bend the data; report it).
