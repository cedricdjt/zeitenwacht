# Brief: the World (island, light, surroundings, dressing, time wave)

Read `docs/briefs/_common.md` first.

You build the place the whole game happens in. It is the single biggest contributor to the "angenehmer 3D-Look" the user asked
for, and its transformation from age to age is the emotional highlight of the game. Take your time and make it beautiful.

## Your files

- `src/render/world.js` exporting `createWorld(env)` which returns an object satisfying `World` from `src/types/render.d.ts`
  (`env` is a `RenderEnv`). Split the work into further modules under `src/render/world/` as you see fit (for example
  `sky.js`, `abyss.js`, `scatter.js`, `ambient.js`, `grid.js`, `themes.js`).
- `src/render/terrain.js` (exists; you may extend it, keep its current exports working)
- `src/render/look.js` (exists; you may extend `LightRig`/`SkyDome`; keep `createMaterials`, `configureRenderer`, `NEUTRAL_LIGHT`,
  `sunDirection` and the existing behaviour for `src/viewer.js` and `src/render/thumbnails.js`, which you do not own)
- `src/content/models/fx.js` exporting `models`: the model `fx.portal` (the time portal the enemies step out of: a standing ring or arch
  about 1.1 tiles wide and 1.4 high with a softly glowing, slowly swirling inside; built with the kit, read `docs/STYLE.md`;
  it must fit every age, so keep it timeless: weathered stone ring, glowing runes, shimmering film) and any other `fx.*` model you need
- `dev/world.html` your test page
- You may delete `devworld.html` in the project root once `dev/world.html` supersedes it.

## What exists

- `Terrain` builds the island mesh for a map (tiles, sunken path, organic shoreline, rock flanks) with vertex colours that can be
  re-set at any time, including as a circular wave (`setPalette(to, from, wave)`), and offers `shoreDistance(x, z)`.
- `LightRig`, `SkyDome` in `look.js`; `InstancedModel` in `instances.js`; models via `getModel(id)` from `src/content/models.js`
  (unknown ids yield a small lilac placeholder and a console warning, so nothing crashes while models are still being made).
- `src/sim/path.js`: `pathTiles`, `buildPath`, `tileX`, `tileZ`.
- Content: `src/content/index.js` will export the complete `Content` (it is being written in parallel; if it does not exist yet when
  you start, build a small stand-in inside your dev page from the types in `src/types/content.d.ts` and switch to the real one as soon
  as it appears). The models of the ages are also being built in parallel under `src/content/models/`; until they exist you will see
  placeholders. For judging composition while they are missing, your dev page should offer `?demo=1`, which substitutes
  `example.tree` / `example.rock` for missing large props.

## What to build

1. **Island**: `build(map, ageIndex)` creates the `Terrain` from the map (`isPath` from `pathTiles` of every path, including the
   entrance and base tiles that lie one tile outside the playfield; `isSolid` for a generous plaza around the base tile and a small
   one around each entrance) and colours it with `age.terrain`.
2. **Light and sky**: apply `age.light` through `LightRig` and `SkyDome`; exponential fog. Shadows must cover the whole island crisply
   enough for towers; fit the shadow camera to the island. Keep `exposure` and `bloom` readable as the contract says.
3. **Surroundings** (`age.abyss`): what lies below and around the floating island. `clouds`: a soft sea of low-poly cloud puffs drifting
   slowly; `sea`: a calm stylised water surface some way below with gentle low-poly waves and a lighter band where it meets the rock;
   `mist`: layered translucent haze; `city`: a dark plain with thousands of tiny warm lights (instanced, glowing) for the night of the
   near future. All of them must look good from the default camera (azimuth `CAMERA_AZIMUTH`, elevation `CAMERA_ELEVATION` in
   `src/render/layout.js`, distance about 36) and from elevations between 25 and 75 degrees. A few slowly drifting clouds at island
   height are welcome in day ages. Distant silhouettes come from scatter rules with zone `far`.
4. **Dressing** (`age.scatter`, `age.scatterCount`, `age.fieldCount`): deterministic from `map.seed` (`makeRng`).
   - Compute the SPOTS once per map, independent of the age: large and medium spots in the shore strip and on the rim (never on the
     path, never on the plazas, never overlapping), one spot per blocked tile (`map.blocked`), small spots on free playfield tiles,
     and far spots on a wide ring. Every age then fills the same spots with its own models chosen by the rule weights (seeded by spot
     and age). That way a pine in the Stone Age becomes a column in Rome and a house later, and the island keeps its composition.
   - Respect `scale`, `cluster` and the size of the models (`spec.bounds`): big things only on big spots.
   - Small playfield decoration disappears while a tile is occupied (`setTileOccupied`) and never stands on blocked or path tiles.
   - Everything instanced through `InstancedModel` (refilling every frame is fine and keeps animated props alive).
5. **Base and portals**: the model `age.baseModel` stands on the base tile (last waypoint), facing the arriving enemies; the model
   `fx.portal` stands on every entrance tile, facing along the path. `hitBase()` makes the base flinch and flash briefly.
6. **Time wave** `transitionTo(ageIndex, { duration = 4.5, x, z })`: the heart of the game. A ring expands from (x, z) across the
   island. Behind the front the ground and path already wear the new colours (`Terrain.setPalette` with a wave), each dressing spot
   swaps as the front passes it (old model squashes to nothing, the new one pops up with a little overshoot; stagger slightly so it
   ripples), the base swaps last with a bigger bounce. Light, sky, fog, sun position, surroundings, exposure and bloom blend smoothly
   over the whole duration. A visible soft band of light should travel with the front (a glowing ring on the ground is enough).
   A second `transitionTo` while one is running must finish the first one instantly and start cleanly. `wave` exposes the front.
7. **Ambient life** (`age.particles`): a small number of floating particles of the given kind above the island (pollen, fireflies,
   leaves, embers, snow ...), subtle, cheap, instanced or a single `Points` object.
8. **Flight lines** `setFlightLines(visible)`: for every path a dotted trail of small soft cloud puffs at flight height
   (`FLY_HEIGHT` in `layout.js`) on the straight line from the entrance to the base, fading in and out; this is how the player learns
   where flyers will pass. **Flame** `setFlame(fraction)`: pass the value as `ctx.hp` to the base model (its part `flame` shrinks with it).
   On the map whose base lies inside the playfield, the base stands on that tile and its eight neighbours form its plaza.
9. **Build grid** `setGridVisible`: a faint outline on every buildable tile (inside the playfield, not path, not blocked), fading in
   and out. It must help placing towers without looking like a spreadsheet.
10. **Quality**: `low` = no shadows, about half of the dressing, no ambient particles; `medium` = shadow map 1024; `high` = 2048.

## Dev page

`dev/world.html?map=<id>&age=<index>` shows the world with orbit controls and the game's camera framing. Required parameters for
reproducible screenshots: `to=<index>&p=<0..1>` freezes a transition from `age` to `to` at progress p; `az`, `el`, `dist` set the
camera; `q=low|medium|high`; `grid=1`; `demo=1`; `t=<seconds>` freezes the animation clock. Keys 1-9 start a transition to that age
when viewed interactively. Expose `window.__info = { calls, triangles, frameMs }`.

## Acceptance

- Every age on every map looks composed and pleasant from the default camera: check all of them in screenshots, plus a low and a
  steep camera angle for two ages, plus transitions at p = 0.25 / 0.5 / 0.75. Compare neighbouring ages side by side: each must be
  clearly its own world while obviously the same island.
- Night ages stay readable (ground and path clearly distinguishable, nothing sinks into black).
- No z-fighting, no visible seams between island and surroundings, no popping, no props on the path or floating in the air.
- World alone: at most about 120 draw calls and 400 000 triangles on `high`; `update()` under 1.5 ms on average.
- `npx tsc -p jsconfig.json` clean for your files.
