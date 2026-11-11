# Arbeitsstand

Kurzer Überblick für die Fortsetzung der Arbeit. Wird beim Bauen fortgeschrieben und am Ende entfernt.

## Umfang
Alle sechs Zeitalter aktiv: `steinzeit`, `rom`, `mittelalter`, `entdecker`, `industrie`, `zukunft` mit je 10 Wellen (60 Wellen).
Auswahl in `src/content/scope.js`; `src/content/index.js` exportiert `content = selectAges(<alle Daten>, ACTIVE_AGES)`.
Industrie (seit 10.11.2026, Nacht): Hochräder, Dampfwagen (Träger), Heißluftballons (Flieger, 2 Funken), Zwischenboss Der
Kohlenbaron (Dampfwagen x1,65, bei 50 % 3 Hochräder, beim Zerbrechen 4 Halunken), Boss Schwarze Berta.
Entdecker: erstes Zeitalter mit Fliegern (Beutepapageien), Zwischenboss Käpt'n Flint (fliegender Riesenpapagei), Boss Landgaleone
lässt bei 85/60/35 % je 3 Papageien frei.
Je Rolle zwei Ausbauzweige auf Stufe 3, Superwaffen (Kern der Stufe 3 plus zwei Nachbarn, Gebühr 2,5 Baupreise), je Zeitalter
ein Zwischenboss in Welle 5 (geliehenes Modell, größer) und der Boss in Welle 10 (mit dem Zwischenboss als Geleit).

## Fertig
- Fundament: Modell-Baukasten (`src/render/kit.js`), Animation, instanziertes Zeichnen, Look (Licht, Himmel, Bloom), Insel (`terrain.js`),
  Vorschaubilder, Weggeometrie mit Tests, Modell-Betrachter (`viewer.html`), Werkzeuge in `tools/`.
- Verträge in `src/types/`, Regeln in `docs/SIM.md`, Spielentwurf in `docs/DESIGN.md`, Stil in `docs/STYLE.md`, Aufträge in `docs/briefs/`.

- 3D-Modelle für `steinzeit`, `rom`, `zukunft` (10.11.2026): alle 69 Modelle gebaut, keine Platzhalter mehr.
  Bekannte Schwächen je Modell stehen unten unter Punkt 1.

## In Arbeit / offen (in dieser Reihenfolge)
Stand 10.11.2026, spät: Das Spiel läuft mit echten Modellen von Anfang bis Ende (`node tools/smoke.mjs --gpu --waves 50 --out <ordner>`,
keine Seitenfehler). Typprüfung sauber, 311 Tests. Rauchtest mit fünf Zeitaltern: gewonnen, Welle 50, 20 Funken, keine Seitenfehler. Der Leistungstest der Simulation (`tests/sim.run.test.mjs:356`) misst Echtzeit
und fällt gelegentlich durch, wenn alle Testdateien parallel laufen (0,62 statt 0,5 ms); einzeln ist er grün.

1. Feinschliff Modelle (nur bei Bedarf): Steinzeit Wolf und Nashorn kantig/einfarbig, Trockengestell, Block; Rom Statue, Aquädukt
   (nur Einzelbögen, weil `rimRoom` 0,42 in `src/render/world/mapinfo.js` breitere Randmodelle verwirft), Skorpion-Bediener,
   Feldherr 2971 Dreiecke; Zukunft Brenner (2248 Dreiecke, Emitter klein), Werfer von hinten, Wachroboter dünn, Windrad kurz.
   Knacker der Zukunft reicht auf Stufe 3 per Skalierung in `animate` über die Standfläche (0,63 statt 0,56).
   Wunsch: Parameter `hurt=` und `hp=` im Modell-Betrachter.
2. Leistung: Im Rauchtest fällt die Bildrate in der Zukunft auf etwa 25 Bilder/s (Headless-Chrome, 137 000 bis 206 000 Dreiecke,
   bis 312 Zeichenaufrufe; die Qualität schaltet selbst auf „medium“). Auf dem echten Bildschirm nachmessen.
3. Ton nach `docs/briefs/audio.md` (bisher stummer Platzhalter in `src/audio/audio.js`).
4. Balance (Stand 10.11.2026 spät, fünf Zeitalter, Protokoll Schritt 17 oben in `tools/balance.mjs`): `PRESSURE` = 1 (der eine
   Regler für den Spieler), dazu Druck je Position `AGE_PRESSURE` 1 / 0,85 / 1,15 / 1,2 / 1,7 statt pauschal 1,15. Bester Bot
   (6 Karten x 10 Startwerte): Gemütlich 58/60, Normal 35/60 (Niederlagen fast nur in der Zukunft), Knifflig 4/60 (meist ab dem
   Mittelalter, ein Viertel noch am Feldherrn in Rom). Ein-Rollen-Strategien und Nicht-Modernisierer verlieren Normal in Rom oder
   im Mittelalter. Offen: Mensch auf Normal/Knifflig nachspielen lassen (die Bots verlieren vor allem an Bossen, ein guter Spieler
   kaum); für den Bot ist der Zangengriff nicht mehr die schwerste Karte (Normal: Flusstal 9, Kreuzweg 6, Zwillingsfurt 3,
   Schneckenhaus 6, Felsenmeer 4, Zangengriff 7 von 10); Brenner- und Taktgeber-Kerne sind als Superwaffe schwach.
   Entdecker im Spiel angesehen: Insel, Palmen, Kontore, Fässer, Truhen, Kanonenkugeln, Stege am Rand, Hafenfestung, Türme und
   Papageien da; den Leuchtturm (Rand) und das Segelschiff (Ferne) zeigt keiner der Screenshots.
5. Kleinigkeiten: „Zeitalter wiederholen“ nach Niederlage fehlt noch; Wünsche des Inhalts-Agenten (Stufen-Zuschlag bei Pfütze
   und Takt in `towerStats`, Glockenklang).
6. Einzeldatei-Build (`node tools/build-standalone.mjs`), README, diese Datei entfernen.

## Nachtrag 10.11.2026, spät
- Fertig und geprüft (Typprüfung sauber, 319 Tests, Rauchtest einer ganzen Partie ohne Seitenfehler): acht Rezepte (Flak frei, sieben
  zum Freischalten über Bauplan-Zeitgabe oder makellos besiegten Zwischenboss), Rezeptbuch im Haupt- und Pausenmenü
  (`src/game/recipebook.js`, `src/ui/recipes.js`), Randrequisiten und ferne Kulisse werden auf allen Karten platziert.
- Offen: Kommandoposten nie im Bild beim Feuern gesehen; Rezept-Aussehen in Steinzeit und Rom ungeprüft; Vorschläge für
  `towers.js` (Plasmanebel `sound: 'steam'`, Brennglas `splash` 0,9 → 0,7); Selbstspieler nutzt Rezepte praktisch nie;
  Türme sind der größte Posten bei den Zeichenaufrufen (16 Türme, 154 Aufrufe); `tools/smoke.mjs` misst die Bildrate im
  Zeitraffer falsch und drückt damit die Qualitätsstufe; Ton fehlt.
- Spielbare Kopie für den Auftraggeber: `/home/cedric/zeitenwacht-spielbar`, Port 8318, zuletzt auf diesem Stand aktualisiert.

## Nachtrag 10.11.2026, Nacht: sechstes Zeitalter
- Industrie aktiv (60 Wellen, Protokoll Schritt 19 in `tools/balance.mjs`). Druck je Position `AGE_PRESSURE` jetzt
  1 / 0,85 / 1,15 / 1,2 / 1,8 / 2,15 (`PRESSURE` bleibt 1). Bester Bot, 6 Karten x 10 Startwerte: Gemütlich 59/60, Normal 32/60
  (Niederlagen fast nur in Industrie und Zukunft), Knifflig 0/60 (Ø Welle 33; ein Drittel der Niederlagen schon in Rom und
  Mittelalter an Zwischenbossen und Bossen, wie vorher). Brücke der Zwillingsfurt jetzt erst in der Zukunft (Stufe 5).
  Rezept-Pools unverändert (Rom, Mittelalter, Entdecker; Ø 2,7 je Partie).
- Spieldauer: Wellen allein 45 bis 48 Minuten je gewonnener Partie, mit Bauzeit etwa eine Stunde bei einfacher Geschwindigkeit.
- Rauchtest mit sechs Zeitaltern (`node tools/smoke.mjs --gpu --waves 999`): gewonnen, Welle 60, 26 Funken, keine Seitenfehler.
  Industrie im Spiel angesehen: Reihenhäuser, Gaslaternen, Gasometer, Wasserturm, Kohlehaufen, Schornsteine am Rand und in der
  Ferne, ferne Fabrikhallen, Uhrturm-Kraftwerk, Ballons, Dampfwagen, Kohlenbaron, Berta, Türme da.
- Offen: Die Reihenhäuser stehen als lose Grüppchen, nicht als Zeilen; ferne Fabrikhallen schweben eher im Dunst, als dass sie aus
  ihm aufragen (beides `src/content/ages.js` / Platzierung, nicht Balance). Spielbare Kopie noch nicht aktualisiert.
