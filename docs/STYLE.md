# Stilrichtlinie für 3D-Modelle

Alle Modelle im Spiel entstehen prozedural mit dem Baukasten `src/render/kit.js`. Diese Richtlinie sorgt dafür,
dass Modelle verschiedener Autoren wie aus einem Guss wirken. Die Messlatte sind die Referenzmodelle in
`src/content/examples.js` (ansehen: `viewer.html?ids=example.*`).

## Leitbild

Ein freundliches Low-Poly-Diorama: kantige, klare Formen, satte aber nicht grelle Farben, weiches Licht.
Wie handbemaltes Holzspielzeug. Nichts ist gruselig, blutig oder martialisch-düster.

## Das Wichtigste zuerst: Lesbarkeit aus der Ferne

Die Kamera schaut aus etwa 30 bis 40 Feldern Entfernung schräg von oben auf die Insel. **Ein Feld ist auf dem
Bildschirm nur etwa 60 Pixel breit**, ein Gegner etwa 25 bis 35 Pixel hoch.

- Die **Silhouette** entscheidet. Jedes Modell muss an seinem Umriss erkennbar sein.
- **Wenige große Formen** statt vieler kleiner. Details unter 0,03 Feldern sind unsichtbar und kosten nur Dreiecke.
- **Übertreiben**: Köpfe groß (etwa ein Viertel der Körperhöhe), Waffen und Werkzeuge 1,5-fach, Hüte, Hörner, Schilde, Räder deutlich.
- **Klare Farbflächen** mit Kontrast zwischen benachbarten Teilen (heller Kopf auf dunklem Rumpf, helles Dach auf dunkler Wand).
- Jedes Modell hat **eine Akzentfarbe**, die es von den anderen seiner Art unterscheidet.
- Von schräg oben sieht man vor allem **Oberseiten**: Dächer, Hüte, Schultern, Deckplatten verdienen die meiste Sorgfalt.

## Maßstab und Koordinaten

- 1 Einheit = 1 Spielfeld. Y zeigt nach oben, der Boden liegt bei y = 0, der Ursprung ist die Mitte der Standfläche.
- **Vorn ist +Z.** Gegner laufen in +Z, Türme zielen in Ruhe nach +Z.
- Alle Koordinaten (auch die von Kind-Teilen) stehen im Modellraum.

| Art | Standfläche | Höhe | Dreiecke (Richtwert / Obergrenze) |
| --- | --- | --- | --- |
| Turm | innerhalb ±0,45 (Obergrenze ±0,56) | 1,0 bis 1,9; mit Fahnen der Stufe 3 bis 2,4 | 600 bis 1500 / 2600 |
| Gegner zu Fuß | Breite etwa 0,3 | 0,45 bis 0,6 | 200 bis 600 / 1500 |
| Reiter, Tiere, Fahrzeuge | Länge bis 0,9 | 0,4 bis 0,85 | 300 bis 800 / 1500 |
| Flieger | Spannweite bis 0,9 | um y = 0,15 bis 0,5 modellieren; die Engine hebt sie auf Flughöhe | 200 bis 700 / 1500 |
| Boss (`boss.*`) | Radius 0,5 bis 0,9 | 0,9 bis 1,6 | 800 bis 2000 / 3200 |
| Requisite (`prop.*`) | je nach Objekt, meist unter 1 Feld | bis 3 | 60 bis 500 / 1400 |
| Basis (`base.*`) | bis etwa 2,4 x 2,4 Felder | bis 3,2 | 1500 bis 3000 / 4500 |

Die Grenzen prüft `tests/models.test.mjs`.

## Aufbau eines Modells

- Ein Modell besteht aus **wenigen starren Teilen** (meist 2 bis 7). Nur was sich bewegt, braucht ein eigenes Teil.
- Jedes Teil dreht sich um seinen `pivot` (Schulter, Hüfte, Drehkranz, Radachse).
- Die Bewegung kommt aus `animate(pose, ctx)`. Dafür gibt es fertige Bausteine in `src/render/anim.js`
  (`walkBiped`, `walkQuadruped`, `hover`, `spin`, `aim`, `recoil`, `flash`, `pulse`, `sway`, `flinch`).
- `animate` darf nichts allozieren (kein `new`, keine Arrays, keine Objekte) und nur `pose` verändern.

### Türme

- Ein unbewegter Sockel (`base`) und ein Teil, das sich mit `aim()` zum Ziel dreht (Figur, Geschützkopf, Wurfarm).
  Unterstützungstürme ohne Angriff drehen sich nicht, sollten aber leben (Fahne weht, Radar dreht, Feuer flackert).
- **Der Schuss muss sichtbar sein**: Rückstoß, Wurfbewegung, Mündungsblitz (`ctx.fire` ist 1 im Moment des Schusses und klingt ab;
  `ctx.charge` läuft während des Nachladens von 0 auf 1).
- Ein Punkt **`muzzle`** markiert, wo das Geschoss startet (`m.point('muzzle', [x, y, z], 'teil')`), angehängt an das zielende Teil.
- **Ausbaustufen**: Stufe 2 und 3 fügen sichtbare Teile hinzu (`minLevel: 2` bzw. `3`): Fahne, zweites Rohr, Dach, Verzierung.
  Der Turm soll mit jeder Stufe wertiger und etwas höher wirken, die Standfläche bleibt gleich.
- **Rollenfarbe**: Jede Turmrolle hat über alle Zeitalter hinweg dieselbe Erkennungsfarbe (siehe `docs/DESIGN.md`).
  Sie muss an jedem Turm dieser Rolle gut sichtbar vorkommen (Fahne, Dach, Band, Leuchtstreifen), vor allem von oben.

### Gegner

- Gedrungen und kopflastig. Beine, Arme, Kopf als eigene Teile, damit der Laufzyklus lebt.
- `stride` (Schrittlänge in Feldern je Zyklus) passend zur Größe wählen: kleine Figur etwa 0,45, Reiter 0,9, Fahrzeuge beliebig.
- Fahrzeuge: Räder drehen (`spin` mit `ctx.walk`), Ketten deutet man durch wippende Aufbauten an.
- Flieger: `hover` plus Flügelschlag oder Rotor.
- **Eigenschaften müssen ablesbar sein**: gepanzert = sichtbare Platten in Metallfarbe; schnell = schlank, nach vorn geneigt;
  Schild = leuchtende Hülle oder Schildgenerator (`glow`); Heiler = grünes Kreuz/Leuchten; Träger = dick, trägt sichtbar Fracht;
  Boss = sehr groß, mit Krone, Hörnern oder Goldrand.
- Gegner blicken nach +Z. Ein Gesicht oder eine Front (Augen, Visier, Scheinwerfer) zeigt die Laufrichtung.

### Basis

- Die Basis jedes Zeitalters beherbergt **die Flamme**. Sie ist ein eigenes, leuchtendes Teil mit dem Namen `flame`
  (`glow`), gut sichtbar von oben und von Süden. Die Engine übergibt den Anteil der verbliebenen Leben als `ctx.hp` (1 = alle):
  `animate` skaliert das Teil damit (etwa `0.45 + 0.55 * ctx.hp`) und lässt es leicht flackern (`ctx.t`).
- Die Basis blickt nach +Z, dem ankommenden Weg entgegen; dort liegt ihr Eingang. Standfläche höchstens 2,4 x 2,4 Felder.

### Requisiten und Gebäude

- Meist ein einziges Teil. Ein zweites nur, wenn sich etwas bewegt (Baumkrone wiegt sich, Mühlrad dreht, Fahne weht).
- Organisches (Fels, Laub, Fell) bekommt `faceJitter: 0.06` bis `0.1`, Gebautes (Mauern, Metall) nicht.

## Farbe

- Farben als `'#rrggbb'`. Die Palette des Zeitalters steht in `docs/DESIGN.md`; Modelle eines Zeitalters teilen sich
  Materialfarben (dasselbe Holz, derselbe Stein, dasselbe Metall).
- `colorTop` erzeugt einen Verlauf nach oben (heller werdendes Laub, Dachfirst, Flamme). Ohne `colorTop` dunkelt der Baukasten
  jede Form nach unten leicht ab (`shade`), das gibt Tiefe.
- `glow: true` nur für echte Lichtquellen: Feuer, Glut, Laternen, Neon, Energie, Bildschirme. Sparsam einsetzen, sonst leuchtet nichts mehr.
- Kein reines Schwarz und kein reines Weiß. Dunkelstes Dunkel etwa `#2a2420`, hellstes Hell etwa `#f4efe4`.

## Sauberes Handwerk

- **Keine deckungsgleichen Flächen** (flimmern). Aufgesetzte Details mindestens 0,006 vor die Fläche setzen oder leicht einlassen.
- Nichts ragt unter y = 0 (Ausnahme: Sockel dürfen bis 0,1 einsinken, damit sie auf dem abgesenkten Weg nicht schweben).
- Stangen, Speere, Beine mindestens 0,03 dick, sonst verschwinden sie.
- Runde Formen mit 5 bis 8 Segmenten. Mehr sieht man nicht.
- Kugeln mit `detail: 0` (20 Flächen) für Kleines, `detail: 1` (80 Flächen) für Köpfe und Kronen.

## Arbeitsweise

1. Beschreibung in `docs/DESIGN.md` lesen, Silhouette überlegen, Teile und Drehpunkte festlegen.
2. Modell bauen, dann **ansehen**. Der Betrachter zeigt Modelle im Licht des Zeitalters:
   `viewer.html?ids=tower.stone.*&theme=stone&level=3&t=0.3` (weitere Parameter stehen oben in `src/viewer.js`).
3. Screenshots aus mehreren Blickwinkeln (`cam=iso`, `cam=front`, `cam=back`, `cam=top`), in Stufe 1 und 3, mit laufender
   Animation zu zwei Zeitpunkten (`t=0.1`, `t=0.6`) und im Moment des Schusses (`fire=1`, `fire=0.5`).
4. Kritisch prüfen: Erkenne ich aus Spielentfernung (`zoom=0.5`), was es ist? Stimmen die Proportionen? Schwebt oder versinkt etwas?
   Dreht sich das Richtige um den richtigen Punkt? Passt es zu den Nachbarn seines Zeitalters?
5. Verbessern und wieder ansehen. Mindestens zwei Runden je Modell.
