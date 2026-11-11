# Brief: 3D models for one age

Read `docs/briefs/_common.md` first.

You are a modeller and technical artist. You build low-poly models in code, from coloured primitives, for one age of the game.
The models ARE the look of the game: the user asked for an "angenehmer 3D-Look", and every screenshot of the game will mostly show
your work. Charm, readability and consistency matter more than detail.

## Read before modelling

1. `docs/STYLE.md` — the style guide. Binding. Read every line.
2. `docs/DESIGN.md` — the chapters about your age: its mood and palette, and the description of every tower, enemy, prop and the base
   you are asked to build. The descriptions are the brief for each model; where a description cannot be built well from primitives
   or would not read at game distance, keep its idea and silhouette and simplify boldly.
3. `src/render/kit.js` (the modelling kit: read all of it), `src/render/anim.js` (animation helpers), `src/types/model.d.ts`.
4. `src/content/examples.js` — reference models. They set the quality bar and show the conventions in working code.
   Look at them: `http://127.0.0.1:8317/viewer.html?ids=example.*&level=3`
5. The header comment of `src/viewer.js` — the parameters of the model viewer you will use constantly.

## Your file

Exactly one file, named in your task, of the form `src/content/models/<age>/<group>.js`. It already exists as a stub and is already
registered; fill its `models` object: keys are the model ids, values are functions returning `createModel(id)...build(...)`.
Share colours and small helper functions (a soldier body, a wheel, a roof) at the top of your file; do not import from other
model files (other people are writing them right now) and do not create other files.

## How to work

For each model: think about the silhouette first (what makes this thing recognisable from 35 tiles away, from above?), decide the
parts and pivots, build, then LOOK and iterate:

```
node tools/shot.mjs "http://127.0.0.1:8317/viewer.html?ids=<id>,<id>&theme=<age>&level=3&t=0.3&stats=1" <png> --ready --gpu --w 1100 --h 700
```

- Use `theme=<age>` so you see the models in the light of their age, on its ground colour.
- Close-ups from several sides: `cam=iso`, `cam=front`, `cam=back`, `cam=side`, `cam=top`, with `zoom=1.5` or more for single models.
- The honest test: all your models together at game size, `zoom=0.45`, from `cam=iso`. Can you tell them apart at a glance? Is each
  one recognisable? This view decides, not the close-up.
- Towers: check level 1, 2 and 3 (`level=`), several aim directions (`aim=0`, `aim=90`, `aim=200`) and the firing motion
  (`fire=1`, `fire=0.5`, `fire=0`). The part that aims must pivot around a sensible point and must not cut through the base.
- Enemies: check the walk cycle at several times (`t=0.05`, `t=0.2`, `t=0.35`) and standing (`still=1`). Feet stay near the ground,
  nothing detaches, limbs swing around the right joints.
- `mode=object` must look identical (it draws through a different code path).
- Compare with the reference models in the same picture now and then (`ids=example.slinger,<yours>`): same scale, same level of
  detail, same friendliness.

Budget your effort: every model gets at least two look-and-improve rounds; the base building, the boss and the first tower of the
list deserve the most love. If a model does not come out well after several attempts, simplify it rather than adding detail.

## Requirements

- Ids exactly as listed in your task. Conventions from `docs/STYLE.md` and `docs/ARCHITECTURE.md`: origin on the ground at the centre
  of the footprint, +Z is forward, 1 unit = 1 tile.
- Towers: a part that aims (`aim()`), a visible firing motion driven by `ctx.fire` / `ctx.charge`, a point `muzzle` attached to the
  aiming part, additional parts with `minLevel: 2` and `minLevel: 3`, and the role colour (table in `docs/DESIGN.md`) clearly
  visible from above. Support towers without an attack need no muzzle and no aiming but must be alive (something moves).
- Enemies: walk or flight animation in sync with `ctx.walk`, `flinch` on hits, a readable front, traits visible as described in the
  style guide. Flyers are modelled near the ground (the engine lifts them). Bosses use ids starting with `boss.`.
- Props: mostly a single part; something may sway or turn. Keep them cheap: there will be hundreds on screen.
- `animate` allocates nothing and touches only `pose`.
- `node --test tests/models.test.mjs` passes for all your ids; `npx tsc -p jsconfig.json` shows no errors in your file.

## Final report

For every model: id, triangles, parts, what moves, and one sentence of honest self-assessment. List the screenshot files of your
final overview pictures (all models at game size; close-ups of the best and the weakest). Name the two weakest models and what you
would improve with more time.
