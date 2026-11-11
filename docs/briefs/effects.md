# Brief: the Effect Layer (shots, impacts, particles, floating numbers, shake)

Read `docs/briefs/_common.md` first.

You make the game feel good: every shot, hit, kill and coin gets a small, satisfying, never noisy visual answer.

## Your files

- `src/render/effects.js` exporting `createEffectLayer(env, entities, world)` which returns an object satisfying `EffectLayer` from
  `src/types/render.d.ts` (`entities` is an `EntityLayer`, `world` a `World`; use only what their contracts promise).
  Further modules under `src/render/effects/` as you see fit (particles, beams, projectiles, text ...).
- `src/content/models/shots.js` exporting `models`: the projectile models (`shot.*`) named by the tower data in `src/content/towers.js`
  and described in `docs/DESIGN.md` (stone, arrow, bolt, cannonball, rocket ...), built with the kit like every other model
  (read `docs/STYLE.md`; they are tiny, 10 to 80 triangles, pointing along +Z, origin at their centre).
- `dev/effects.html` your test page.

## What exists

- Simulation contract and events: `src/types/sim.d.ts`, rules `docs/SIM.md`. Shot visuals are data: `ShotVisual` in
  `src/types/content.d.ts` on every `TowerTierDef` (`tower.arch.tiers[tower.tier].shot`).
- `entities.muzzleOf(tower, out)` gives the muzzle of a tower, `entities.enemyCenter(enemy, out)` the body centre of an enemy
  (also for one that just died). While the entity layer does not exist yet, write a tiny stand-in with the same two methods in your dev page.
- `InstancedModel`, the shared materials, `getModel`, `src/render/layout.js`.
- The renderer blooms everything brighter than about 1.1 in any colour channel on the high quality level: unlit colours multiplied
  by 1.5 to 3 glow softly. Use that for energy and fire; keep it restrained.

## What to build

**Projectiles** (from `sim.state.projectiles`, every frame): on first sight of a projectile remember its start (the muzzle of its
tower at that moment). Position = from that start to the current target point (`tx/tz` plus the height of the target: enemy centre
while it lives, the last known height afterwards), at the interpolated progress (`pt` to `t` with `alpha`), lifted by the arc
(`shot.arc * 4p(1-p)`). Models are instanced per shot model, oriented along the flight direction, tumbling if `shot.tumble`.
Trails per `shot.trail`.

**Instant shots** (on `shot` events, by `shot.kind`): `tracer` = a short bright streak from muzzle to target fading within 80 ms;
`beam` = a continuous beam from muzzle to target for as long as the tower keeps firing (its `lastShot` is recent), with a soft core,
slight width pulse and a glow at the impact point; `bolt` = a jagged lightning line, redrawn per shot, 120 ms; `flame` = a cone of
warm particles from the muzzle towards the target; `pulse` = a ring expanding on the ground from the tower to its range;
`model` = nothing extra (the projectile flies). Muzzle effects per `shot.muzzle`. `chain` events draw the same kind of streak or
bolt between the two enemies.

**Impacts** (on `hit` events, by `shot.impact`, scaled with `splash`): `dust`, `spark`, `explosion` (flash, expanding low-poly
fireball that cools to smoke, ground ring), `fire`, `frost`, `energy`, `splash`, `net`. A splash hit shows its true radius for a
moment as a soft ring on the ground, so the player learns what area damage means.

**Enemies leaving**: `kill` = the enemy dissolves into a soft puff in the manner described in `docs/DESIGN.md` (nothing gory; bosses
get a much bigger, slower, celebratory version) and the bounty floats up as "+12" in gold; `leak` = a short dull flash at the base
(`world.hitBase()` is called by the stage, you add particles) and "-1" in red.

**Ground zones** (from `sim.state.zones`, every frame): the Bremser's puddles. A glossy, slightly irregular blob lying flat on the path
(above the sunken path surface, no z-fighting) in the colour of the tower's `shot.color`, with a thin unlit rim in the role colour
(`zone.arch.color`) so it stays visible on dark paths; it spreads out quickly when it appears, wobbles faintly, and shrinks away during
its last half second (`zone.time`). One instanced mesh for all zones.

**Other events**: `phase` = a boss moment (a burst of steam or dust around the enemy and a short exclamation mark above it);
`spawn` = a ripple at the portal; `build` = dust ring at the tile; `upgrade` = sparkles in the role colour;
`modernize` = a brief column of light with rising motes; `sell` = a few coins; `gold` with reason `wave`/`early`/`age` needs no
world effect; `ability` = the Zeitglocke of `docs/DESIGN.md` 2.7 (`def.effect` is `'zeitglocke'`): a wide golden ring that runs from the base
(`world.base`) across the whole island within about 0.8 s, a soft golden shimmer on every enemy as it is thrown back, a few drifting
clock-hand or hourglass motes; calm and beautiful, no explosion; unknown effect names fall back to the same ring; `age` = nothing here (the world does the time wave) except a burst of rising motes at the base.

**Floating numbers**: world-anchored, small, legible, rising and fading within about 0.9 s; pooled; canvas textures cached per
distinct text; never more than about 40 at once (drop the oldest). Switchable through `applySettings` (`floatingText`).

**Particles**: one pooled system (a few instanced meshes: low-poly chips, soft additive glow quads, smoke puffs) with a hard budget
(for example 1500 live particles on high, 600 on low); when the budget is hit, new minor effects are skipped, never the frame rate.
At game speeds above 1 or when many effects coincide, thin them out.

**Shake**: `shake` holds a small camera offset that decays quickly; only bosses dying, big explosions near the base and the ability
trigger it; amplitude at most about 0.12 tiles; zero when `settings.shake` is false.

## Dev page

`dev/effects.html` shows a terrain backdrop with a few stand-in towers and enemies and buttons/keys that fire every shot kind, every
impact kind, every ability effect and the kill/leak/build/upgrade/modernize/sell effects, plus a mode that runs all of them
continuously. For reproducible screenshots: `fx=<name>&t=<seconds after trigger>` freezes that effect at that moment (several
moments per effect are needed to judge it). Expose `window.__info = { calls, triangles, particles, updateMs }`.

## Acceptance

- Every effect inspected in screenshots at three moments: readable, soft, pleasant, in scale with the world (remember that a tile is
  only about 60 pixels wide in the game: effects must read at that size without covering the action).
- Nothing lingers, nothing pops, nothing z-fights with the ground or the sunken path.
- Stress: 300 projectiles, continuous impacts and kills at 4x speed: `update()` under 2 ms on average, particle budget respected.
- `npx tsc -p jsconfig.json` clean for your files; `node --test tests/models.test.mjs` green for your `shot.*` models.
