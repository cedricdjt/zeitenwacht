# Brief: the User Interface (HUD and menus)

Read `docs/briefs/_common.md` first.

You build everything the player reads and clicks: a DOM/CSS layer above the 3D canvas. It carries half of the "angenehm" the user
asked for. It must look designed, not generated: calm, generous, consistent, with one accent colour per age.

## Your files

- `src/ui/ui.js` exporting `createUi(deps)` (`deps` is `UiDeps`) which returns an object satisfying `Ui`; both in `src/types/app.d.ts`.
  Further modules under `src/ui/` as you see fit (`hud.js`, `menu.js`, `towerpanel.js`, `icons.js`, `texts.js`, `traits.js` ...).
- `css/ui.css` (and further files under `css/` if you like; `index.html` links `css/ui.css` only, so `@import` or keep one file)
- `dev/ui.html` your test page

## How it is wired

- The game controller (someone else) calls `showMenu`, `showGame(view)`, `showPause`, `showResult`, `update(dt)` every frame,
  `handleEvents(events)` after each simulation step, and `toast`. You never call the simulation's commands yourself: every wish goes
  through `deps.actions` (`UiActions`). You READ the live state through the `GameView` given to `showGame`: `view.sim.state`,
  the simulation's query methods (`buildCost`, `upgradeCost`, `modernizeCost`, `sellValue`, `wavePreview`, `earlyBonus`, `ability`,
  `canBuild`), the pure rules in `src/sim/rules.js` (`towerStats` ...), `view.content`, and the interaction state
  (`buildArch`, `selected`, `abilityArmed`, `hover`, `speed`, `paused`).
- `update(dt)` runs every frame: write to the DOM only when a value actually changed (keep the last rendered values and compare).
- Your root element covers the whole window with `pointer-events: none`; your panels re-enable pointer events. A click that does not
  hit a panel reaches the canvas below. Never put an invisible full-screen element with pointer events over the game outside of modal screens.
- **Keyboard** is yours (the camera keys W A S D Q E and the arrow keys belong to the 3D stage, do not use them):
  `1`..`6` choose a tower role (again = cancel), `Esc` = cancel build mode, else disarm ability, else deselect tower, else pause menu;
  `Space` start next wave; `U` upgrade, `M` modernise, `X` or `Delete` sell (the selected tower), `T` cycle its target mode;
  `F` arm the ability; `P` pause; `+`/`-` or `Tab` cycle speed; `R` reset camera. Show the keys discreetly on the buttons.
- Thumbnails of towers and enemies: `deps.thumbnail(modelId, { size, level })` returns a data URL of the 3D model on transparent
  background (cache is inside). Use them for the build bar, the tower panel, wave previews, the age banner.
- The simulation (`src/sim/sim.js`, `src/sim/rules.js`) and the content (`src/content/index.js`) are being written in parallel. Use the
  real ones in your dev page as soon as they exist and work; until then drive the UI with a hand-written stand-in of the same shape
  (the test fixture `tests/fixtures/content.mjs` may exist earlier than the real content).

## Screens and elements

Where `docs/DESIGN.md` (chapter on Spielgefühl and UX) is more specific about layout, wording, onboarding or the transition card,
follow it; the list below is the baseline.

**In game (HUD)**
- **Age and wave** (top left): emblem of the age, its name in the display face, the period as a subtitle; below it "Welle 7 / 36"
  and a row of pips for the waves of the current age (done, current, upcoming; the boss wave marked).
- **Resources** (top right): gold (coin), lives (heart; shakes and flashes softly when one is lost), score. Numbers tick up and down
  smoothly instead of jumping. Then speed (pause, 1x, 2x, 4x) and the menu button.
- **Build bar** (bottom centre): one card per tower role in `content.archetypes` order: thumbnail of the incarnation in the CURRENT
  age, its name, cost, key number, a stripe in the role colour. Not yet unlocked roles show a lock and "ab <Zeitalter>". Unaffordable
  cards are dimmed and show the missing gold. The chosen card is raised. Hover or long-press shows a tooltip card: role, incarnation
  name, flavour sentence, the numbers that matter (Schaden, Feuerrate as shots per second, Reichweite, and one line per special:
  Flächenschaden, Verlangsamung, Brand, Rüstungsdurchschlag, Kette, Aura ...), and icons for "trifft Boden" / "trifft Flieger".
- **Next wave** (bottom right): the upcoming wave as enemy thumbnails with counts and small trait icons (hover: name, description,
  traits in words), a large button "Welle starten" (Space) that shows the current early-start bonus when there is one, and a toggle
  "Automatisch". While a wave runs it shows the enemies still to come and those alive. After the last wave it disappears.
- **Ability** (bottom left): a round button with the ability's icon and name (the Zeitglocke), a cooldown sweep, key `F`. It works
  without aiming: when `sim.ability().radius` is 0, a click calls `actions.armAbility(true)` and the controller fires it at once
  (only abilities with a radius would show an armed state).
- **Tower panel** (appears when `view.selected` is set; place it where it never covers the tower's surroundings, for example bottom left
  above the ability or as a side card): thumbnail, incarnation name, role, level as pips, age badge ("veraltet: Steinzeit" when
  `tier < age`), the current numbers with the next level's numbers as green deltas while hovering "Ausbauen", target mode as a
  segmented control (Erster, Letzter, Stärkster, Schwächster, Nächster), kills and damage dealt, and the actions as big buttons with
  price and key: "Ausbauen", "Modernisieren" (prominent when available; shows thumbnail and name of what it becomes), "Verkaufen"
  (shows the refund; says "volle Erstattung" while that applies). Disabled states explain themselves ("zu wenig Gold", "höchste Stufe").
- **"Alle modernisieren"**: visible near the build bar while outdated towers exist, with the total price (`actions.modernizeAll`).
- **Announcements**: wave start ("Welle 8"), boss warning, wave cleared with bonus ("Makellos!" when perfect) as brief, non-blocking
  banners at the top centre.
- **Age change** (`age` event): the big moment. A card over the scene (the 3D world is transforming behind it, so keep it translucent
  and not too large): "Ein neues Zeitalter bricht an", the age's name, period and tagline, the gift of gold, thumbnails of the new
  enemies, and the hint that standing towers can now be modernised. It leaves on click, key, or by itself when the simulation's
  `state.lock` has run out. The accent colour of the whole UI glides to the new age's `accent`.
- **Toasts** for rejected actions ("Zu wenig Gold", "Hier kann nicht gebaut werden" ...) just above the build bar; rate-limited.
- **First-game guidance** (while `settings.tutorialDone` is false): at most four gentle, non-blocking hints, each tied to the moment it
  matters and dismissed by doing the thing: choose a tower; place it next to the path; start the wave; (after the first age change)
  modernise an old tower. Then call `actions.changeSettings({ tutorialDone: true })`.

**Menus** (modal, over the slowly turning island)
- **Main menu**: title and subtitle of the game; "Neues Spiel" (leads to map choice: one card per map with a small drawn preview of its
  path made from `map.paths`, name, description, best score from the records; difficulty as three cards with name and description;
  "Los geht's"); "Fortsetzen" with a summary when a save exists; "Anleitung" (one screen: the goal, how to build/upgrade/modernise,
  the tower roles with their colours and what they are good against, the enemy traits with their icons, the keys); "Einstellungen".
- **Settings**: graphics (Automatisch, Niedrig, Mittel, Hoch), volume sliders (Gesamt, Effekte, Musik), mute, screen shake, floating
  numbers, "Hinweise erneut zeigen". Apply immediately through `actions.changeSettings`.
- **Pause**: Weiter, Neu starten (confirm), Einstellungen, Anleitung, Zum Hauptmenü (confirm).
- **Result**: victory or defeat with a headline, the age and wave reached, score, record note, a grid of statistics, and buttons
  "Noch einmal" and "Hauptmenü". Defeat is consoling, not punishing.

## Visual language

- Panels: dark translucent glass (`rgba(18, 22, 30, 0.72)` with `backdrop-filter: blur(10px)` and a hairline light border), radius
  14 to 18 px, soft shadow; text off-white; numbers tabular. The scene behind changes from pale dawn to deep night, so check contrast
  against both a very bright and a very dark background.
- One accent colour, the age's `accent`, as a CSS variable (`--accent`), used for the primary button, focus rings, active states,
  the age emblem. Derive readable text-on-accent automatically (light or dark).
- Type: system UI font for everything functional; a serif display face from the system stack (for example
  `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`) for age names and big headlines. No web fonts.
- Icons: your own inline SVGs (`src/ui/icons.js`), one consistent stroke style, no emoji anywhere. Needed at least: coin, heart, star,
  wave, lock, pause, play, fast, gear, close, sound on/off, upgrade arrow, modernise (hourglass or gear-arrow), sell, target modes,
  ground, air, each enemy trait (gepanzert, fliegend, schnell, Schwarm, regeneriert, Schild, Träger, Heiler, Boss, zäh gegen
  Verlangsamung), one emblem per age (`age.id`), one symbol per tower role (`arch.icon`) and per ability (`ability.icon`).
  Unknown icon names fall back to a neutral dot, never an error.
- Enemy traits are derived from the data in `src/ui/traits.js`: boss, fliegend (`flying`), gepanzert (`armor > 0`), Schild (`shield > 0`),
  regeneriert (`regen > 0`), Heiler (`heal`), Träger (`spawns`), schnell (speed clearly above the age's basic enemy), Schwarm
  (hp at most half of the basic enemy and cheap), zäh (`slowResist >= 0.5`).
- Motion: 120 to 220 ms ease-out for state changes, panels slide/fade a few pixels, numbers tick. Respect
  `prefers-reduced-motion`. Nothing blinks.
- All text German, friendly, short, with real umlauts and correct typography („Anführungszeichen“, Gedankenstrich –, geschütztes
  Leerzeichen vor Einheiten wo sinnvoll). Format numbers with `formatNumber` from `src/util/math.js`.

## Layout and input

- Works from 1024 x 600 up to 4K, in landscape; usable on a phone in landscape (about 800 x 380: smaller cards, the tower panel as
  a bottom sheet) and tolerable in portrait (build bar scrolls horizontally). Use CSS clamp/grid, not fixed pixel positions.
  Honour safe-area insets.
- Touch: targets at least 44 px, no hover-only information (tooltips also open on tap/long-press), no double-tap zoom on buttons.
- Buttons are real `<button>`s with `aria-label`s; focus is visible; `Esc` always goes one step back.
- The HUD must leave the playfield free: nothing permanent in the middle of the screen; keep the bottom bars compact
  (at most about 16 % of the height on desktop).

## Dev page

`dev/ui.html?screen=menu|maps|settings|help|game|pause|result|age` with parameters to reach every state without playing:
`age=<index>`, `gold=<n>`, `build=<archId>`, `select=1` (a tower of a given `tier`/`level`), `wave=running|idle`, `armed=1`,
`won=1|0`, `bg=light|dark|<path to an image>` for the background behind the glass. It must work with the real simulation when
available. Set `window.__ready`.

## Acceptance

- Screenshots of every screen and state at 1280 x 800 and 1920 x 1080, the HUD also at 844 x 390 and 390 x 844, each over a light and
  a dark background. Check alignment, spacing rhythm, truncation, contrast (body text at least 4.5:1), and that no state looks broken:
  long names, six-digit gold, zero lives, all roles locked but one, the final wave, a tower at max level in the newest age.
- `update()` with an unchanged state performs no DOM writes (verify with a `MutationObserver` in the dev page and report the count).
- No console errors. `npx tsc -p jsconfig.json` clean for your files.
