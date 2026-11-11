# Architektur

Ein Tower-Defense-Spiel für den Browser in 3D (three.js). Es läuft **ohne Build-Schritt**: Der Browser lädt die ES-Module
aus `src/` direkt, three.js liegt in `vendor/three`. Node.js wird nur für Entwicklungswerkzeuge gebraucht (Typprüfung, Tests,
Screenshots, Einzeldatei-Build), nie zum Spielen.

## Schichten

```
            ┌────────────────────────── src/game ──────────────────────────┐
            │  Spielsteuerung: Spielschleife, Eingaben, Menüfluss, Speichern │
            └──────┬───────────────┬────────────────┬───────────────┬───────┘
                   │ Befehle       │ liest Zustand   │ liest Zustand │ Ereignisse
            ┌──────▼─────┐   ┌─────▼──────┐   ┌──────▼─────┐   ┌─────▼──────┐
            │  src/sim   │   │ src/render │   │   src/ui   │   │ src/audio  │
            │ Simulation │   │   Bühne    │   │ Oberfläche │   │    Ton     │
            └──────┬─────┘   └─────┬──────┘   └──────┬─────┘   └─────┬──────┘
                   │               │                 │               │
            ┌──────▼───────────────▼─────────────────▼───────────────▼──────┐
            │  src/content: Zeitalter, Türme, Gegner, Wellen, Karten, Modelle │
            └────────────────────────────────────────────────────────────────┘
```

- **Simulation** (`src/sim`): die Spielregeln. Deterministisch, fester Zeitschritt, kein DOM, kein three.js; läuft auch in Node.
  Regeln: `docs/SIM.md`. Vertrag: `src/types/sim.d.ts`.
- **Bühne** (`src/render`): alles, was in 3D zu sehen ist. Liest den Zustand der Simulation und ihre Ereignisse, verändert ihn nie.
- **Oberfläche** (`src/ui`, `css/`): HUD und Menüs als DOM über der 3D-Ansicht. Liest den Zustand, schickt Wünsche an die Spielsteuerung.
- **Ton** (`src/audio`): Klänge und Musik, im Browser erzeugt (WebAudio), keine Audiodateien.
- **Inhalte** (`src/content`): reine Daten plus die prozeduralen 3D-Modelle. Vertrag: `src/types/content.d.ts`, `src/types/model.d.ts`.
- **Spielsteuerung** (`src/game`): verbindet alles. Vertrag der Teile untereinander: `src/types/app.d.ts`.

Abhängigkeiten zeigen nur nach unten. Simulation, Bühne, Oberfläche und Ton kennen einander nicht.

## Verzeichnisse

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Einstieg: Leinwand, Wurzel der Oberfläche, Import-Map |
| `viewer.html`, `src/viewer.js` | Modell-Betrachter für die Entwicklung |
| `css/` | Aussehen der Oberfläche |
| `src/main.js` | Startet die Anwendung |
| `src/game/` | Spielsteuerung, Speichern (`storage.js`) |
| `src/sim/` | Simulation: `sim.js`, `rules.js`, `path.js` |
| `src/render/` | Bühne. Fundament: `kit.js` (Modell-Baukasten), `anim.js`, `instances.js` (instanziertes Zeichnen), `look.js` (Materialien, Licht, Himmel), `terrain.js` (Insel), `post.js` (Bloom) |
| `src/ui/` | Oberfläche |
| `src/audio/` | Ton |
| `src/content/` | Daten: `ages.js`, `towers.js`, `enemies.js`, `waves.js`, `maps.js`, `balance.js`, `abilities.js`, `index.js` (alles zusammen, ohne three.js). Modelle: `models.js` (Verzeichnis), `models/<zeitalter>/*.js` |
| `src/types/` | Verträge als TypeScript-Deklarationen |
| `src/util/` | `rng.js` (deterministischer Zufall), `noise.js`, `math.js` |
| `tests/` | Tests für Node (`node --test tests/`) |
| `tools/` | `serve.py` (Webserver), `shot.mjs` (Screenshots), `build-standalone.mjs` (Einzeldatei), `vendor-three.mjs` |
| `vendor/three/` | three.js r187 und die benutzten Addons, unverändert |
| `docs/` | `DESIGN.md` (Spielentwurf), `SIM.md` (Regeln), `STYLE.md` (Modellstil), dieses Dokument |

## Die Spielschleife

```
Bild:  dt = echte Zeit seit dem letzten Bild (höchstens 0,1 s)
       wenn die Partie läuft:  vorrat += dt * tempo
       solange vorrat >= SIM_DT (höchstens 12 Schritte je Bild):
           sim.step();  ereignisse = sim.drainEvents()
           stage.handleEvents(ereignisse);  audio.handleEvents(ereignisse);  ui.handleEvents(ereignisse)
           vorrat -= SIM_DT
       stage.render(dt, simulierteZeit, vorrat / SIM_DT)     // interpoliert zwischen zwei Zeitschritten
       ui.update(dt)
```

Befehle des Spielers (bauen, ausbauen, Welle starten ...) gehen als Methodenaufrufe an die Simulation, immer zwischen zwei Zeitschritten.

## Koordinaten und Einheiten

- 1 Einheit = 1 Spielfeld. Zeit in Sekunden, Winkel in Radiant.
- X zeigt nach rechts (Osten), Z zum Betrachter (Süden), Y nach oben. Der Boden liegt bei y = 0, der Weg um `PATH_DEPTH` (0,06) tiefer.
- Das Spielfeld hat `width x height` Felder und ist um den Ursprung zentriert: Feld (tx, tz) hat die Mitte
  `(tx - width/2 + 0.5, 0, tz - height/2 + 0.5)`. Helfer: `tileX`, `tileZ`, `worldToTileX`, `worldToTileZ` in `src/sim/path.js`.
- Modelle blicken nach +Z. Ein Gegner mit Laufrichtung (dx, dz) hat die Drehung `Math.atan2(dx, dz)` um Y.

## Modelle und Zeichnen

- Jedes Modell ist ein `ModelSpec`: wenige starre Teile mit Vertexfarben und eine Funktion `animate(pose, ctx)`.
  Gebaut wird mit `createModel()` aus `src/render/kit.js`; registriert in `src/content/models.js` (`getModel(id)`).
- Kennungen: `tower.<zeitalter>.<rolle>`, `enemy.<zeitalter>.<name>`, `boss.<zeitalter>.<name>`, `prop.<zeitalter>.<name>`,
  `base.<zeitalter>`, `shot.<name>` (Geschosse), `fx.<name>` (Sonstiges wie das Zeitportal).
- Gezeichnet wird **instanziert**: `InstancedModel` aus `src/render/instances.js` braucht je Modellteil einen Zeichenaufruf,
  egal wie viele Exemplare es gibt. Je Bild `begin()`, je Exemplar `add(matrix, ctx, tint)`, dann `end()`.
- Es gibt genau zwei Materialien für alle Modelle (`createMaterials()` in `look.js`): `matte` (beleuchtet) und `glow` (leuchtend).
- Farben stehen als `'#rrggbb'` in den Daten. Die Tonwertkurve ist „Neutral“: Eine sonnenbeschienene Fläche erscheint nahezu in ihrer Datenfarbe.

## Regeln für den Code

- Bezeichner auf Englisch. Kommentare, Dokumentation, Fehlermeldungen und alle Texte im Spiel auf **Deutsch mit echten Umlauten**.
- Jede JS-Datei beginnt mit `// @ts-check`. Alle Funktionen haben JSDoc-Typen (`noImplicitAny` ist an). Typen aus den Verträgen
  importieren: `/** @import { Sim } from '../types/sim' */`. `npx tsc -p jsconfig.json` muss fehlerfrei durchlaufen.
- Die Verträge in `src/types` sind die Schnittstellen zwischen den Teilen. Wer sie ändern muss, stimmt das ab.
- In Schleifen, die in jedem Bild laufen, nichts allozieren: Vektoren, Matrizen und Farben auf Modulebene anlegen und wiederverwenden.
- Kein `Math.random()` in Simulation und Weltaufbau; dafür `makeRng(seed)` aus `src/util/rng.js`. Rein optische Effekte dürfen `Math.random()` benutzen.
- Keine weiteren Abhängigkeiten, keine Netzwerkzugriffe, keine externen Schriften oder Bilder: Das Spiel läuft offline.
- three.js r187: `PCFSoftShadowMap` gibt es nicht mehr (`PCFShadowMap` ist weich). Importe über die Import-Map: `import * as THREE from 'three'`
  und `three/addons/...` (nur Addons, die in `vendor/three/addons` liegen; weitere über `tools/vendor-three.mjs` ergänzen).

## Entwicklungswerkzeuge

```
python3 tools/serve.py                 Webserver auf http://127.0.0.1:8317/
npx tsc -p jsconfig.json               Typprüfung
node --test tests/                     Tests
node tools/shot.mjs <url> <png> --ready --gpu     Screenshot im Headless-Chrome (wartet auf window.__ready === true)
node tools/build-standalone.mjs        baut dist/zeitenwacht.html (eine Datei, per Doppelklick spielbar)
```
