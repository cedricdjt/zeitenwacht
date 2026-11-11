# Brief: the Entity Layer (towers and enemies on screen)

Read `docs/briefs/_common.md` first.

You draw every tower and every enemy of the running game, alive and readable, at any speed and in any number.

## Your files

- `src/render/entities.js` exporting `createEntityLayer(env)` which returns an object satisfying `EntityLayer` from
  `src/types/render.d.ts`. Further modules under `src/render/entities/` as you see fit (health bars, rings, ghost ...).
- `dev/entities.html` your test page.

## What exists

- `InstancedModel`, `createModelObject`, `makeAnimCtx` in `src/render/instances.js` (read the file; `add()` returns after computing
  the part matrices, `pointWorld('muzzle', v)` then gives the muzzle of the instance just added).
- Model contract and animation inputs: `src/types/model.d.ts` (`AnimCtx` is what you feed), helpers in `src/render/anim.js`,
  reference models in `src/content/examples.js`, model registry `src/content/models.js` (`getModel`; missing models yield placeholders).
- Simulation contract: `src/types/sim.d.ts` (state, entities, events), rules in `docs/SIM.md`. The simulation is being implemented in
  parallel in `src/sim/sim.js`; use the real one in your dev page if it exists and works when you get there, otherwise drive your
  layer with a hand-written object of the same shape (enemies walking along a `buildPath` curve, towers with moving targets).
- Shared measures: `src/render/layout.js` (`FLY_HEIGHT`, `PATH_DEPTH`, `enemyBaseY`), terrain for a backdrop: `src/render/terrain.js`.

## What to build

**Enemies** (from `sim.state.enemies`, every frame):
- Position interpolated between `px/pz` and `x/z` with `alpha`; height from `enemyBaseY`; flyers bob gently and bank a little in turns.
- Facing follows `dx/dz`, smoothed so they turn through corners instead of snapping.
- `AnimCtx`: `walk` advances with distance travelled (`2π` per `spec.stride * scale` of path), `move` = current speed relative to
  `def.speed`, `hp`, `hurt` (1 when a `damage` event arrives, decaying in about 0.25 s), `t`, `seed` (stable per enemy id).
- Size `def.scale`. Appear with a quick scale-in when they step out of the portal (use `enemy.age`).
- Status must be readable at a glance: slowed = cool bluish tint and visibly slower walk cycle; burning/poisoned (`dot > 0`) = warm
  flickering tint; shield = a translucent glowing bubble around the enemy whose brightness follows `shield / maxShield` and which
  flickers when hit (one instanced mesh for all bubbles); a hit = short brightening (tint above 1) plus the model's own flinch.
- When an enemy dies or leaks it simply disappears from the state; the effect layer (someone else) draws the puff. You may keep a
  very short squash-out (about 0.12 s) for killed enemies so they do not vanish in one frame.
- **Health bars**: small billboards above damaged enemies only (hidden at full health), one instanced draw call for all, with a
  dark backing, a fill that goes from green over yellow to red, a second thin bar for shields, bigger for bosses. They must stay
  the same on-screen size regardless of zoom within reason and never be hidden inside models.

**Towers** (from `sim.state.towers`):
- Model `tower.arch.tiers[tower.tier].model`, level `tower.level` (parts with `minLevel` appear automatically through `ctx.level`).
- Aiming: `aimYaw` towards (`aimX`, `aimZ`) relative to the model's forward (+Z), smoothed (turn rate about 10 rad/s, faster for
  rapid-fire towers so the shot visibly leaves in the right direction); `aimPitch` up towards flyers (`aimFlying`).
- `fire` = 1 at `tower.lastShot` decaying over about 0.3 s of SIMULATION time (compare with `sim.state.time`), `charge` from
  `tower.cooldown` against its effective cooldown, `active` eased towards 1 while `targetId >= 0`.
- Events: `build` = the tower drops in from a little above with a squash and settles; `upgrade` = quick spin or bounce and the new
  parts pop in; `modernize` = the old model shrinks into a brief column of light while the new one grows out of it; `sell` = it
  folds down quickly. All short (0.3 to 0.6 s), all springy, none blocking gameplay.
- A subtle level marker is welcome if the models' own level parts are not enough: up to three small pips at the foot of the tower.
- Towers that are behind the current age (`tower.tier < sim.state.age`) carry a small, tasteful "outdated" marker (for example a
  tiny floating hourglass or a soft desaturated tint); it must be noticeable without making the tower ugly.
- Towers buffed by an aura (`buffDamage`, `buffRate` or `buffRange > 0`) show a faint glowing ring at their foot.
- `muzzleOf(tower, out)` must return the muzzle position of the pose drawn in the current frame.

**Interaction visuals**:
- `setBuildPreview`: a translucent copy of the tower model that would be built (`arch.tiers[sim.state.age]`, level 1) on the tile,
  greenish when valid and reddish when not, plus a range ring on the ground (range from `towerStats` in `src/sim/rules.js` if that
  file exists, else from `arch.stats.range`). The ring is a soft filled disc with a brighter rim, never a harsh line.
- `setSelectedTower`: range ring in the role colour (`arch.color`) and a gentle pulsing highlight at the tower's foot.
- `setAbilityCursor`: a target circle of the given radius with a slowly rotating dashed rim (the game's only ability, the Zeitglocke,
  is global and does not use it at the moment; keep the implementation small).
- All ground overlays sit slightly above the ground and above the sunken path, without z-fighting, and must not be shadowed.

**Housekeeping**: one `InstancedModel` per model id in use, created on demand, kept for the rest of the game. `bind(null)` clears
everything. `setQuality('low')` disables shadows of entities. No per-frame allocation; with 200 enemies and 80 towers `update()` must
stay under 2 ms on average.

## Dev page

`dev/entities.html` shows a terrain backdrop with a path, enemies of several kinds walking (including a flyer, a boss, slowed,
burning, shielded, damaged ones) and towers of several kinds and levels shooting at them, driven by the real simulation if available.
Parameters for reproducible screenshots: `t=<seconds>` (run the simulation that long, then freeze), `count=<n>` for a stress test,
`preview=1`, `select=1`, `ability=1` to show the interaction visuals, `az`, `el`, `dist` for the camera. Expose
`window.__info = { calls, triangles, updateMs }`. While the real models are missing, use the example models (`example.slinger`,
`example.clubman`) and placeholders.

## Acceptance

- Screenshots prove: enemies face their direction of travel and turn smoothly through corners; walk cycles match ground speed (no
  skating); flyers hover at the right height with a shadow below; health bars and shields read clearly; towers aim at their targets
  and visibly fire; preview, selection and ability overlays look soft and clean; outdated and buffed markers read at game distance.
- Stress test with 200 enemies and 80 towers: numbers reported, no visual glitches.
- `npx tsc -p jsconfig.json` clean for your files.
