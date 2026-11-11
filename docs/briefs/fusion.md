# Feature brief: more waves, upgrade branches, superweapons

Read `docs/briefs/_common.md` first. This brief describes three additions the user asked for on 2026-11-10, verbatim:
"gib mir noch mehr level je zeitalter und etwas varianz in den waffen. ich möchte eine funktion haben, mehrere waffen
zusammenfassen für eine superwaffe". The contracts in `src/types/content.d.ts` and `src/types/sim.d.ts` are already extended
(search for `StatMod`, `TowerBranchDef`, `TowerFusionDef`, `Balance.fusion`, `Tower.branch`, `Tower.super`, `Tower.gifts`,
`Sim.fuse`). The contracts are binding; if one cannot work, say so precisely in your report instead of changing it.

## 1 Ten waves per age

Every age has 10 waves instead of 6 (30 waves with the three active ages). The boss wave stays the last wave of the age.
Rhythm: 1 Durchatmen, 2 Neuheit, 3 Tempo, 4 Brocken, 5 Mischung, 6 Zwischenboss-artige Elitewelle (no boss model, a few
strong enemies with escort), 7 Luft/Tempo-Variante, 8 Brocken II, 9 Ansturm (densest), 10 Boss. Nothing in code may assume
6 waves per age; the number comes from `content.waves[age].length`.

## 2 Upgrade branches ("Varianz in den Waffen")

On the upgrade from level 2 to level 3 the player chooses one of two branches per role (`TowerArchetypeDef.branches`).
`Sim.upgrade(towerId, branch)`; `Tower.branch` is -1 below level 3. Branch 0 is the classic speciality from the design
(double shot, bigger radius ...), branch 1 is a real alternative that plays differently, built from existing `TowerStats`
fields (chain, splash, dot, zone, slow, pierce, range, cooldown, aura...). Both branches cost the same. Suggested set:

| Role | Branch 0 | Branch 1 |
|---|---|---|
| schuetze | Doppelschuss: double fire rate | Scharfschütze: much more range and damage per shot, slower |
| werfer | Großkaliber: splash radius 1.4 | Schnelllader: small radius, clearly faster |
| bremser | Großer Teich: radius 1.2, lasts 4 s | Ätzpfütze: normal size, the puddle also does damage over time |
| knacker | Durchschuss: pierces to a second enemy | Kettenschlag: jumps to 3 further enemies with reduced reach |
| brenner | Flächenbrand: radius 1.2 | Weißglut: small radius, burn lasts much longer and is stronger |
| taktgeber | Fernsicht: +15 % range for neighbours | Kriegstrommel: +damage for neighbours instead |

## 3 Superweapons (fusion)

- A **core** tower of level 3 (branch chosen, not yet a superweapon) absorbs exactly `balance.fusion.parts` (2) **ingredient**
  towers. Ingredients must be level 3, not superweapons, stand on one of the 8 neighbouring tiles of the core, and have the same
  tech tier as the core. Any roles may be combined, also three of the same role. Roles without `arch.fusion` can be neither.
- Result: the ingredients disappear (their tiles become free), the core becomes a superweapon: `tower.super = true`,
  `tower.gifts = [archId, archId]`, level stays 3, branch stays. `invested` of the core grows by the `invested` of the
  ingredients plus the fee; kills and damage dealt are added up. Allowed in build phase and during a wave.
- Fee: `round5(balance.fusion.fee * buildCost(core arch, core tier))`, 0 if `fee` is 0.
- Stats of a superweapon (`towerStats(content, arch, tier, level, { branch, super, gifts })`), in this order:
  1. `arch.stats`, 2. `levels[level-1]`, 3. branch `mod.set` (level 3 with a branch), 4. `fusion.core.set` of the core role and
  `gift.set` of each ingredient role in order (superweapons only), 5. tier `tweak`, 6. scaling by `ageDamage`, `levelDamage`,
  `levelRange` as today, 7. branch `mul`, then `add`, 8. superweapons: damage and dot times `balance.fusion.damage`, range times
  `balance.fusion.range`, then `fusion.core` `mul`/`add`, then each gift's `mul`/`add` in order.
  `add.damage` and `add.dot` count in standard shots of the tower's tier (`value * baseDamage * ageDamage[tier]`).
  A `dot` added to a tower without `dotDuration` needs the gift to `set` or `add` a duration as well.
- Gifts are what make combinations interesting. Suggested: schuetze "Schnellfeuer" (cooldown x0.75), werfer "Sprengkopf"
  (+0.5 splash radius), bremser "Kleber" (hits slow by 25 % for 1.5 s), knacker "Panzerbrecher" (pierce 1, +15 % range),
  brenner "Brandsatz" (hits set on fire: dot in standard shots for 3 s), taktgeber "Taktkern" (+25 % damage; for a taktgeber core:
  stronger aura). Gifts must do something sensible for every core role, including the two that do not shoot at enemies directly
  (bremser lays zones, taktgeber has attack 'none'); where a gift field has no effect on such a core, that is acceptable but
  the texts must not promise it.
- Modernising a superweapon costs `modernizeFactor` times (new value of the core at level 3 plus new value at level 3 of each
  gift role in the target tier). Selling returns `sellRefund * invested` as for every tower. A superweapon cannot be upgraded
  further and cannot be fused again.
- Aura rules stay: a superweapon is one tower on one tile, buffed like any other.
- Save games carry `branch`, `super`, `gifts` per tower (optional fields; missing = -1 / 0 at level 3 with branches, false, []).
- Event `fuse` for effects and sound; `GameStats.fusions` counts.

Presentation (render and UI own the details): a superweapon is drawn with its level-3 model, visibly bigger, with a calm
permanent halo in its role colour and one small orbiting light per gift in the gift role's colour, so the player can read what
was merged. Fusing is a small celebration: the ingredients dissolve into lights that fly into the core, a ring, a bell-like tone.
Its name is `tiers[tier].superName`.

## 4 Megaweapon (second fusion step, decided 2026-11-10)

The user asked whether three superweapons should merge into a megaweapon. Decision: no (nine towers in one tile is out of reach
and bad play); instead a **superweapon absorbs two more neighbouring level-3 towers** and becomes a megaweapon.

- `Sim.fuse(coreId, partIds)` with a core that is already a superweapon (and not yet a megaweapon): same rules for the
  ingredients as in the first step (level 3, not super, 8 neighbours, same tech tier, exactly `balance.fusion.parts`).
  Result: `tower.mega = true` (`super` stays true), `tower.gifts` now has four entries, in order of absorption.
- At most `balance.fusion.megaLimit` (1) megaweapons may exist at the same time per game; a further attempt is rejected with the
  new reason `limit`. Selling the megaweapon frees the slot.
- Stats: as a superweapon with all four gifts applied in order, but with `balance.fusion.megaDamage` and
  `balance.fusion.megaRange` in place of `fusion.damage` and `fusion.range` (suggested start: 5 and 1.35). Core `mul`/`add` apply once.
- Fee: `round5(balance.fusion.megaFee * buildCost(core arch, core tier))` (suggested 4; the superweapon fee was raised to about 2 on user request, the megaweapon must cost clearly more). Modernising: as for a superweapon, with
  four gift roles. `fuseCandidates`, `canFuse`, `fuseCost` work for a superweapon core accordingly.
- Contract additions (to be made by the sim agent in `src/types`): `Tower.mega: boolean`, `SaveData` tower field `mega?`,
  `RejectReason` `'limit'`, `Balance.fusion.megaLimit/megaDamage/megaRange/megaFee`, `TowerTierDef.megaName?`,
  `GameStats.megas`, the `fuse` event gets `mega: boolean`.
- Content: `megaName` for every tier of every role in all ages (a step grander than `superName`).
- UI: a superweapon's panel offers "Zur Megawaffe verschmelzen" with the same flow; the megaweapon panel shows a "Megawaffe"
  badge, four gifts; when the limit is reached the action is disabled with one line saying so. Result screen counts megas.
- Render: 1.5 times size (check it still sits on its tile), a second halo ring or a crown, four orbiting gift lights, a bigger
  fusion moment. Must remain calm and "angenehm".

## 5 More variety in superweapons (decided 2026-11-10)

User feedback: "die superwaffen sind tatsächlich eher einseitig". Two changes, both without new attack mechanics in the sim.

### 5.1 Every core role attacks differently as a superweapon
The sim already knows the attack kinds `beam` (with `ramp`/`rampTime`), `pulse`, `chain`, `zone`; superweapons use them through
`arch.fusion.core.set`:

| Core | As a superweapon |
|---|---|
| schuetze | continuous beam on one target whose damage ramps up the longer it stays on it (hits air) |
| werfer | the impact leaves a burning ground field (zone with dot) |
| bremser | a frost pulse around the tower at intervals (pulse with slow, hits everything in range) instead of single puddles |
| knacker | chain lightning across many enemies (high chain, armour-piercing) |
| brenner | ring of fire in all directions (pulse with dot) |
| taktgeber | aura that also gives damage and reaches further |

- The tier `tweak` of some ages sets `attack` (hitscan from the Entdecker age on). For a superweapon the core's `set` must win
  over the tier tweak for the field `attack` (rule change in `towerStats`, document in SIM.md).
- Presentation data: `TowerTierDef.superShot?: ShotVisual` describes how the superweapon's attack looks and sounds in that age
  (beam, bolt, pulse ring, flame ...); without it the normal `shot` is used.
- Gifts must still do something sensible on the new attack kinds; texts must be honest. Megaweapons inherit all of this.

### 5.2 The ingredient's branch decides its gift
- `TowerBranchDef.gift?: { mod: StatMod; name: string; text: string }`: the gift a tower of this role and branch contributes.
  With it there are 12 gifts instead of 6 (for example Scharfschütze gives range, Doppelschuss gives fire rate; Ätzpfütze gives
  poison, Großer Teich gives slow). `arch.fusion.gift` remains the fallback for a branch without `gift`.
- `Tower.giftBranches: number[]` runs parallel to `Tower.gifts` (branch index of each absorbed tower); saved as `giftBranches?`
  (missing = all 0). `towerStats` opts gain `giftBranches`.
- The `fuse` event's `parts` entries gain `branch`.

## 6 Special tiles (map variety step 2, decided 2026-11-10)

User request: more variety in the maps. Step 1 (three new maps) is done. Step 2: single build tiles with a property, so that
every map has contested spots and "which tower goes where" becomes a question, also for superweapons (three neighbouring tiles).

- `MapDef.tiles?: { tx: number; tz: number; kind: string }[]` marks special build tiles (never on the path, never blocked).
- `Balance.tiles: Record<string, SpecialTileDef>` defines the kinds: `{ name, text, color, icon, mod: StatMod, cost: number }`
  (`mod` applied to the stats of a tower standing there, after everything else incl. fusion; `cost` is a factor on build,
  upgrade, modernise and fusion fees for a tower on that tile, 1 = unchanged).
- Suggested kinds (the content agent may refine): `hoehe` Anhöhe (range +20 %), `quelle` Kraftquelle (damage and dot +20 %),
  `takt` Taktstein (cooldown x0.85), `sumpf` Sumpf (build and upgrade cost +35 %, no stat change; makes an otherwise
  perfect spot expensive). Few per map (about 3 to 6), placed where they create a decision, not where one would build anyway.
- `Tower.tile: string` (kind or ''), set at build time; `towerStats` opts gain `tile`. A superweapon keeps its own tile's bonus;
  the tiles of absorbed ingredients become free again with their property.
- `Sim.tileAt(tx, tz): string` for UI and render. Saves need nothing new (the tile follows from the position).
- Presentation: special tiles are visible on the field in every age (calm ground mark in the kind's colour with a small sign that
  fits the age), named in the build preview and the tower panel with their effect.

## 7 Maps that change with the age (map variety step 3, decided 2026-11-10)

The island persists through the ages, but from now on the way across it may change at an age change: a second gate opens, a
bridge creates a shortcut, the air line comes from a new side. A defence that was perfect in the Stone Age has to be rebuilt.

- `MapDef.stages?: (MapStage | null)[]`, index = position of the age in the running game (0 = first age; entry 0 is normally
  absent/null because the base definition is stage 0). `MapStage { paths?: [number, number][][]; flyersFollowPath?: boolean;
  name: string; text: string }`: from that age on the map uses these paths (a stage without `paths` only carries a text, later
  stages inherit the last defined paths). `name`/`text` are German, for the age card ("Die Furt ist gefallen: ...").
- No tower is ever displaced: every tile that is path in ANY stage is unbuildable from the start ("künftiger Weg"); the
  presentation shows such tiles as a faint trace (overgrown trail, dry riverbed, marked-out road), so the player can read what
  will come. Tiles that stop being path stay unbuildable. All stages share the same base tile; entrances may differ and new ones
  may appear, following the entrance rules of `MapDef.paths`.
- The switch happens in the same step as the age change (no enemy is alive then). `Sim.paths` and `Sim.airPaths` then hold the
  new curves (the contract's `readonly` refers to the property, the arrays' content changes at an age change); an event
  `{ type: 'paths'; stage: number }` is emitted after the `age` event. Loading a save restores the stage from the wave.
- With fewer active ages than stages the later stages are simply never reached; with more ages the last stage stays.
- Not every map needs stages; the beginner maps should change little or not at all, the expert maps more.

## 8 Recipes: the Flak (decided 2026-11-10)

User feedback after playing `zangengriff`: drone swarms are hardly stoppable, the ramping beam is no answer to them, and the
werfer is already very strong and must NOT hit fliers. His idea: "eine kombi aus 3 der ersten waffe könnte doch eine gute FLAK
sein". So: a schuetze core that absorbs two schuetze towers becomes a Flak instead of the beam weapon.

- `TowerFusionDef.recipes?: FusionRecipe[]`, `FusionRecipe { gifts: string[]; core: StatMod; coreText: string; name?: string;
  superNames?: (string | null)[]; megaNames?: (string | null)[]; superShot?: ... }` (shape to be finalised by the implementing
  agent): if the roles of the first `balance.fusion.parts` gifts of a superweapon equal `recipe.gifts` (as a multiset, branches
  do not matter), the recipe's `core` replaces `fusion.core`, and its texts, names and shot visual replace the normal ones.
  The gifts themselves still apply as usual. A megaweapon keeps the recipe of its first fusion.
- First and for now only recipe: schuetze core + schuetze + schuetze = **Flak**: fast bursts with a small blast radius that hit
  fliers and ground, the best answer in the game to swarms in the air, clearly weaker than the beam against a single strong
  enemy. Visually flak bursts (small puffs in the air), named per age.
- The fusion preview must show before confirming that this combination gives the Flak and not the beam.

## 9 Zeitgaben: a choice at every age change (decided 2026-11-10)

After the final boss of an age the player chooses one of three random boons ("Zeitgaben") that last until the end of the game.
Goal: no two games alike, a build that grows over the ages, fitting the time theme. Four choices in a five-age game.

- `Content.boons: BoonDef[]`: `{ id, name, text, icon, color?, weight?, effect }`. Effects are data, built from few kinds:
  tower stat changes (`StatMod`) for all towers or filtered by role, by special-tile kind, by "is a superweapon"; economy
  factors (bounty, wave bonus, build/upgrade cost, fusion fee, modernise cost, sell refund); ability changes (bell cooldown,
  rewind); one-time grants (lives, gold); and a small number of rule switches where the sim can do it cheaply (for example burn
  spreads to one neighbour on death, puddles last longer, towers on an Anhöhe hit fliers). About 18 to 24 boons, each a real
  choice: no pure "+5 % damage" filler, several that reward a play style (fire, slow, superweapons, special tiles, economy).
- Sim: at the age change the sim draws `balance.boons.offer` (3) distinct boons not yet owned, deterministic from the game's
  RNG, into `state.boonOffer: string[]`; `Sim.chooseBoon(id)` adds it to `state.boons` and clears the offer; while an offer is
  open `startWave` is rejected with the new reason `boon`. Effects apply at once to existing and future towers. Saves carry
  `boons` and an open `boonOffer`. Event `{ type: 'boon', id }`. `GameStats` unchanged. Content without boons: no offer.
- UI: the choice is part of the age-change moment: three cards (icon, name, one or two honest sentences), one click, no timer;
  owned boons stay visible somewhere small (HUD chips with tooltip) and on the result screen. Bots and the self-player choose
  by a simple preference.

## 10 Waves with a character (decided 2026-11-10)

Some waves carry an announced modifier that changes how they play, so the fixed ten-wave rhythm of an age varies per game.

- `Content.modifiers: Record<string, WaveModifierDef>`: `{ name, text, icon, color, enemy?: { hp?, speed?, armor?, shield?,
  bounty? (factors) }, towers?: StatMod (applies to all towers while the wave runs), bonus?: number (factor on the wave bonus) }`.
  Suggested: Nebel (tower range x0.85), Eilmarsch (enemies faster, more bounty), Gepanzerter Tross (extra armour), Rückenwind
  (fliers faster; only offered for waves with fliers), Zähes Volk (more hp, clearly more bounty), Goldrausch (weaker, many,
  more bounty), Windstille (fliers slower): a mix of harder-with-reward and different-not-harder; nothing unfair.
- Which waves: per game, deterministic from the seed, `balance.modifiers.perAge` (2) waves of each age get one, never the first
  wave of an age and never a boss or mid-boss wave; a modifier is only drawn for a wave it makes sense for.
- `WavePreview.modifier?: string` (id) so the wave panel can announce it before the wave starts; `waveStart` event carries it.
  Saves need nothing new if the draw follows from seed and wave index.

## 11 Recipes to unlock, and the recipe book (decided 2026-11-10; to be built after sections 9 and 10)

- More recipes: six to eight besides the Flak, about one per core role plus a few mixed ones (for example brenner + 2 bremser
  "Teerfeuer", knacker + 2 taktgeber a siege gun with very long range). Each plays differently from the role's normal
  superweapon, has names per age and a shot visual per age, like the Flak.
- Unlocking inside a game: `FusionRecipe.locked?: boolean`. A locked recipe only takes effect once it is unlocked in the running
  game (`state.recipes: string[]`); until then the combination gives the normal superweapon. Two ways to unlock:
  (a) as a Zeitgabe: a boon whose effect is "unlocks recipe X" may appear among the three offers (choice: strong boon or new
  weapon); (b) defeating the mid boss of an age without losing a life in that wave unlocks one recipe of that age's pool
  (deterministic draw). The Flak is never locked (it is the answer to drone swarms and must not depend on luck).
- A superweapon built before its recipe was unlocked stays what it is; unlocking does not transform existing towers.
- Recipe book (meta level, across games): the main menu shows all recipes; discovered ones with name, ingredients and text,
  undiscovered ones as a silhouette with a hint. Discovery is stored in the profile (`src/game/storage.js`), never in the sim.
  Decided by the user: discovery does NOT make a recipe available in later games; every game unlocks anew. The book is
  knowledge and collection. Fusion previews show a locked recipe as "noch nicht freigeschaltet" only if it is already in the book.

## 12 Weapon pool: six slots, several weapons per slot, a random draw per game (decided 2026-11-11)

User idea: "ein waffenpool von 30 waffen und jedes spiel zufällig 6". Agreed form:

- The six roles remain as **slots** (`schuetze` single target, `werfer` area, `bremser` slowing, `knacker` armour breaker,
  `brenner` fire, `taktgeber` support). Each slot holds several **weapons** that play clearly differently; the six existing
  roles are the first weapon of their slot. Step 1: three weapons per slot (18 in the pool). Step 2 later: five per slot (30).
- Every game draws one weapon per slot (the **loadout**), so the player always has six and every job is covered, but differently
  each time. Guarantees across the draw: at least two of the six drawn weapons can hit fliers; the slot's job stays intact
  (every `knacker`-slot weapon deals with armour, every `bremser`-slot weapon slows, and so on).
- Data: every weapon is a `TowerArchetypeDef` with `slot: string`; its own stats, two branches, fusion core (superweapon attack),
  gift per branch, names per age (tower, superweapon, megaweapon), shot look per age. Weapons of a slot share the slot's 3D
  model per age for now (`tiers[age].model` is the slot's model) and differ by name, an accent colour, a small visual marker,
  projectile and effects (`look` data for the render side). Own models may follow later for the most distinctive ones.
- Sim: `SimConfig.loadout?: string[]` (explicit, one weapon id per slot) or, if absent, a deterministic draw from the seed with
  its own RNG; `Sim.loadout: readonly string[]`; building a weapon outside the loadout is rejected (`locked`); saves carry the
  loadout. A "Klassisch" loadout (the six original weapons) must always be possible.
- Slot versus weapon: role colour, build-bar position and hotkey, first-play unlock order, boon role filters, special-tile
  texts and the eight existing recipes go by SLOT (a recipe "brenner + 2 bremser" works with whatever weapons were drawn for
  those slots). New **weapon-bound recipes** name specific weapons and are only possible in games that drew them.
- Gifts: each weapon brings its own gift (per branch) as an ingredient.
- Menu: the new-game screen shows the loadout of the coming game, lets the player draw again, and offers "Klassisch".
