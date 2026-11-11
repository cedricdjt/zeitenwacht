# Common rules for everyone working on "Zeitenwacht"

## The project

A tower-defense game for the browser in a pleasant low-poly 3D look (three.js r187). The German-speaking user asked, verbatim:
"erstelle mir ein tower defense spiel, in einem angenehmen 3d look, es soll über die Runden hinweg verschiedene Zeitalter
durchlaufen, angefangen in der Steinzeit, über das römische Reich bishin zur nahen zukunft. es soll im browser laufen".

The battlefield is a floating diorama island with a fixed enemy path. The same island persists through all ages; when an age
ends, a wave of time rolls over it and changes its dressing, light and inhabitants. Towers keep standing and can be modernised.

Project root: `/home/cedric/vibing/zeitenwacht`. Read these before you write anything:

- `docs/ARCHITECTURE.md`  how the code is organised, coordinate system, coding rules. Mandatory.
- `docs/DESIGN.md`        the game design bible (what the game is, every age, tower, enemy, the intended feel).
- `src/types/*.d.ts`      the contracts between the parts. They are the interfaces you implement or consume.
- your own brief.

## Environment

- Plain JavaScript ES modules, no build step, three.js vendored in `vendor/three` and resolved through the import map in the HTML files.
- Node.js is NOT installed system-wide. Prefix every shell command that needs `node` or `npx` with
  `export PATH=/tmp/claude-1000/-home-cedric-vibing/67caa2ca-c403-45ce-9eb7-4c6bd4ec1d06/scratchpad/node/bin:$PATH`
- Type check: `cd /home/cedric/vibing/zeitenwacht && npx tsc -p jsconfig.json` (takes about a second). Your files must be free of errors.
  Other people are editing other files at the same time, so you may see errors in files that are not yours: ignore them, never "fix" them.
- Tests: `node --test tests/` (or a single file).
- A dev web server is already running: `http://127.0.0.1:8317/` serves the project root (no caching).
  If it is down, restart it with `(cd /home/cedric/vibing/zeitenwacht && python3 tools/serve.py --port 8317 --strict-port >/dev/null 2>&1 &)`.
- Screenshots (headless Chrome with the real GPU, about 2 s each):
  `node tools/shot.mjs "<url>" <out.png> --ready --gpu --w 1280 --h 800 [--wait 500] [--eval "js that may return a value"]`
  `--ready` waits for `window.__ready === true`, so every dev page you write must set that once it has rendered real frames.
  Console errors of the page are printed and make the exit code 2. Then LOOK at the PNG with the Read tool. You are expected to
  judge your own work visually and iterate; a feature you have not looked at is not done.
  Save screenshots under `/tmp/claude-1000/-home-cedric-vibing/67caa2ca-c403-45ce-9eb7-4c6bd4ec1d06/scratchpad/shots/<your-area>/`.
- To measure, expose numbers on `window` in your dev page and return them through `--eval`
  (for example `renderer.info.render.calls`, triangle counts, mean frame time over 120 frames).

## Rules

- You own ONLY the files listed under "Your files" in your brief. Do not edit anything else, not even to fix an obvious bug.
  If you need a change in a file you do not own (a contract in `src/types`, the kit, the docs), describe it precisely in your final report.
- Identifiers in English. Comments, documentation, error messages and every player-facing text in German with real umlauts (ä ö ü ß).
- `// @ts-check` at the top of every JS file; JSDoc types on every function (`noImplicitAny` is on). Import contract types with
  `/** @import { Sim } from '../types/sim' */`.
- Nothing is allocated in code that runs every frame: create vectors, matrices, colours once at module or object level and reuse them.
- No new dependencies, no network access, no external fonts, images or audio files. The game must run offline.
- three.js r187 specifics: `PCFSoftShadowMap` no longer exists (use `PCFShadowMap`); colours given as hex strings are sRGB and are
  converted to linear by `THREE.Color`; the renderer uses `NeutralToneMapping`, so a sunlit surface appears almost exactly in its data colour.
- All models are drawn with the two shared materials from `createMaterials()` in `src/render/look.js` and, wherever many copies
  exist, through `InstancedModel` from `src/render/instances.js`. Do not create per-object materials or per-object meshes for things
  that appear in numbers.
- Do not run git. Do not start additional long-running processes. Do not install anything.
- Dev and test pages go into `dev/` (they need `../` in their import map, see `dev/thumbs.html` for the pattern).

## The look

"Angenehm" is the user's word and the bar: friendly, calm, readable. A hand-painted wooden-toy diorama in soft light.
Saturated but never garish colours, soft shadows, gentle motion everywhere (things sway, bob, drift), no harsh flashes,
no visual noise, nothing gory or grim. When in doubt, choose the calmer, cleaner option. Reference for the current state of the look:
`http://127.0.0.1:8317/devworld.html` and `http://127.0.0.1:8317/viewer.html`.

## Final report

End with a plain-text report: what you built (files, line counts), how you verified it (commands, screenshot paths, measured
numbers), every deviation from your brief or the contracts and why, every change you need from someone else, and known weaknesses.
Be honest about what is unfinished or unverified; someone will build on your word.
