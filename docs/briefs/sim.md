# Brief: the Simulation (finish, align with the rules, test)

Read `docs/briefs/_common.md` first.

The deterministic simulation is the heart of the game: rendering, HUD, sound, bots and balance all build on exactly this module.
Correctness and determinism matter more than anything else here.

## Situation

A first draft exists, written against an EARLIER version of the rules and never tested: `src/sim/rules.js` (pure rule functions),
`src/sim/sim.js` (`createSim`, `SIM_DT`, `AGE_LOCK`), `src/sim/validate.js` (content validation). No tests and no fixture exist yet.
Since then the rules gained: ground zones (`TowerStats.zone`, `SimState.zones`), straight flight lines (`Sim.airPaths`), burn that
blocks healing and shield recharge and burns harder on slowed enemies, enemy phases (`EnemyDef.phases`), a global rewinding ability
(`AbilityDef.rewind`, radius 0), unlocking by wave (`unlockWave`, `SimConfig.unlockAll`), `defaultMode`, a new modernisation price,
wave bonus and age gift in standard bounties with a perfect-wave bonus, `DifficultyDef.speed`, and bases inside the playfield.

## Read, completely, in this order

`docs/SIM.md` (the binding rules; it is the arbiter), `src/types/sim.d.ts`, `src/types/content.d.ts`, `src/sim/path.js`,
`src/util/rng.js`, then the draft files. `docs/DESIGN.md` chapter 2 explains what the rules are for.

## Your files

- `src/sim/rules.js`, `src/sim/sim.js`, `src/sim/validate.js` and any further helper module under `src/sim/` (not `path.js`)
- `tests/fixtures/content.mjs`: a small but complete `Content` fixture, exported as a factory `makeContent()` returning a fresh deep
  copy per call. 3 ages x 3 waves (the last wave of each age contains a boss); tower archetypes that together cover every attack kind
  and special rule (single projectile, splash projectile, a zone thrower with slow, hitscan with splash and dot, hitscan with chain,
  beam with ramp, pulse, aura-only support with all three aura kinds, pierce, minRange, an air-only and a ground-only tower, different
  `unlockWave`s, `defaultMode`, `levels` overrides, a tier `tweak`); enemies covering every trait (plain, armored, flying, fast,
  regenerating, shielded, carrier, healer, slow-resistant, a boss with `phases` of both kinds); a single-path map, a two-path map with a
  shared end, and a map whose base lies inside the playfield, each with blocked tiles; a complete `Balance`; one ability per age
  (one global rewind, one aimed damage strike).
- `tests/rules.test.mjs`, `tests/sim.test.mjs` (split into more `tests/sim.*.test.mjs` files if it gets long)

## What to do

1. Bring the draft in line with `docs/SIM.md` and the contracts, rule by rule (order of operations in `step()`, tie-breaking, rounding,
   events and their payloads). Keep what is right, rewrite what is not. Where the spec leaves something open, choose the simplest
   deterministic behaviour and list the choice in your report.
2. Write the fixture and the tests. Tests must pin the rules down, not smoke-test them: every rule in "Rechenregeln", "Wege und
   Luftlinien", "Ablauf eines Zeitschritts", "Türme und Angriffe", "Befehle", "Punkte", "Speichern und Laden" gets at least one test
   that would fail if the rule were implemented wrongly. Include full determinism (two instances, same seed and scripted commands,
   compare a digest of the whole state every 30 ticks over a long mixed run), a different seed giving different lanes, save/load
   equivalence at several wave boundaries, a scripted playthrough that reaches `'won'` and one that reaches `'lost'`, and a small greedy
   bot that wins the fixture campaign on normal while a player who never builds loses.
3. Hunt for the classic mistakes: `cooldown +=` versus `=`; damage over time must not reset `sinceHit`; strongest-aura-only; a slow
   is only replaced by an equal or stronger one; splash falloff; chain never hits an enemy twice; beam ramp resets on target change;
   shield absorbs before armor; the minimum-damage floor; enemy stats scale with the wave's age; full refund only before the wave the
   tower was built for; no early bonus before the very first wave; the lock after an age change; many deaths in one tick; a carrier
   dying on the last tile; a projectile whose target dies or leaks mid-flight; selling a tower with projectiles in flight; a wave whose
   last enemy is a carrier; ids never reused; gold always a non-negative integer; no NaN after a long run.
4. Performance test inside the suite: 200 enemies, 80 mixed towers, 2000 steps; print the mean step time, fail above 0.5 ms.
5. Finish with `npx tsc -p jsconfig.json` clean for your files and `node --test tests/` fully green.

Do not use `Math.random`, `Date`, `performance.now` (except to measure inside tests). No allocation in the inner loops of `step()`
apart from event objects. German error messages for invalid content.

## Final report

Files with line counts, the exported API, every decision where the spec was open, anything in the spec or contracts you consider
wrong or missing (do not edit them), and the final test and type-check summary.
