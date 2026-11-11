# Zeitenwacht – Spielentwurf

Verbindlicher Entwurf des Spiels. Er ist aus drei konkurrierenden Entwürfen und drei Jury-Urteilen entstanden; Grundlage ist der
Entwurf „Spielgefühl“, ergänzt um Motiv und Ton des Entwurfs „Atmosphäre“ und die Modernisierungsregel des Entwurfs „Tiefe“.
Beschreibungen von Figuren und Bauten sind teils englisch, alle Namen und Texte im Spiel sind deutsch.
Die Regeln im Einzelnen stehen in `docs/SIM.md`, der Modellstil in `docs/STYLE.md`.

> **Aktiver Umfang (Stand 10.11.2026, Nacht): alle sechs Zeitalter.** Eine Partie durchläuft
> **Steinzeit → Römisches Reich → Mittelalter → Zeitalter der Entdecker → Industriezeitalter → Nahe Zukunft** mit je **zehn
> Wellen** (60 Wellen, 36 Türme, 30 Gegner plus 6 Zwischenbosse); die Auswahl steht in `src/content/scope.js`. Wo dieses Dokument
> noch von 36 Wellen spricht, gilt für das laufende Spiel 60. Seit dem 10.11.2026 gibt es außerdem **Ausbauzweige** (2.2) und **Superwaffen** (2.11).
> Die Skalierung (Schaden, Preise, Lebenspunkte) richtet sich nach der Position des Zeitalters in der Partie, nicht nach seinem Namen.

## 1 Leitidee

**Zeitenwacht – Hüter der Flamme.** Auf einer schwebenden Insel brennt die Flamme. Der Spieler bewacht sie einen einzigen Tag lang,
und dieser Tag umspannt die Geschichte: Er beginnt als Lagerfeuer im Morgengrauen der Steinzeit und endet als Energiekern in der
Nacht des Jahres 2050. Nach jeder Bosswelle rückt die Sonne ein Stück weiter, eine Lichtwelle rollt über die Insel und verwandelt
Weg, Bäume, Häuser und die Flamme selbst in das nächste Zeitalter. Die Türme bleiben stehen, Steinschleuderer neben Lasertürmen,
bis der Spieler sie modernisiert.

**Säulen**
1. **Sehen statt lesen.** Jede Regel hat ein Bild: klebrige Pfütze, brennender Gegner, Funken an der Rüstung, Schildblase,
   Flamme = Leben. Eine Rolle hat in allen Zeitaltern dieselbe Farbe und Silhouette.
2. **Eine neue Idee pro Schritt.** In der Steinzeit kommt mit jeder Welle eine Turmrolle dazu, danach bringt jedes Zeitalter genau
   eine neue Gegnereigenschaft. Jedes Zeitalter hat denselben Sechs-Wellen-Rhythmus.
3. **Ankommen statt Freischalten.** Der Wechsel des Zeitalters ist der Höhepunkt: neues Licht, neue Welt, neue Musik, neue Gegner.
   Dem Spieler wird nie etwas weggenommen.

**Rahmen und Ton.** Die Gegner sind **Feuerdiebe** ihrer Epoche: Halunken, Abtrünnige und Tiere, nie die Leute des Spielers.
Alle Figuren sind Spielzeug. Wer besiegt wird, zerstäubt zu einer ruhigen goldenen Wolke **Zeitsand** und hinterlässt eine hüpfende
Münze; nur Bosse bekommen Konfetti. Wer durchkommt, stiehlt **Funken** aus der Flamme (die Leben des Spielers); die Flamme wird
sichtbar kleiner. Nichts ist blutig, düster oder militärisch-ernst.

## 2 Regeln im Überblick

### 2.1 Umfang
Aktiv: alle 6 Zeitalter mit je 10 Wellen (60 Wellen; die fünfte jeweils mit Zwischenboss, die zehnte mit Boss). Angelegt: 6 Zeitalter, 6 Turmrollen mit je einer
Ausprägung pro Zeitalter (36 Türme, je 3 Stufen, auf Stufe 3 zwei Zweige, dazu Superwaffen), 4 Gegnerarten plus Boss pro Zeitalter
(30 Gegner), 6 Karten, 3 Schwierigkeitsgrade. Die Zahl der Wellen eines Zeitalters ist nirgends festgeschrieben; sie folgt aus den
Daten. Eine Partie dauert bei einfacher Geschwindigkeit etwa eine Stunde: Die Wellen allein laufen 45 bis 48 Minuten (Prüfstand,
gewonnene Partien), dazu kommt die Bauzeit zwischen den Wellen; doppelte und vierfache Geschwindigkeit kürzen das.

### 2.2 Die sechs Rollen
Werte gelten für die Steinzeit, Stufe 1. Reichweite in Feldern.

| Kennung | Rolle | Farbe | Was sie tut | Luft | Kontert | Silhouette in allen Zeitaltern |
|---|---|---|---|---|---|---|
| `schuetze` | **Schütze** | Blau `#3D7DD8` | Einzelziel, schnell: 10 Schaden, alle 1,25 s, Reichweite 3,0. Geschoss; ab dem Zeitalter der Entdecker trifft er sofort. | ja | Schnelle, Flieger, Allround | schlank, aufrecht: eine Figur oder ein dünnes Rohr |
| `werfer` | **Werfer** | Orange `#E8842A` | Bogenwurf mit Flächenschaden im Radius 1,0: 20 Schaden, alle 2,5 s, Reichweite 3,5 | nein | Schwärme, dichte Gruppen | breit: ein Wurfarm oder ein dickes Rohr nach oben |
| `bremser` | **Bremser** | Türkis `#26B5A8` | wirft eine klebrige **Pfütze** auf den Weg (Radius 0,9, bleibt 3 s): Gegner darin sind 30 % langsamer, bis 1 s nach dem Verlassen. Kein Schaden. Alle 3,5 s, Reichweite 2,5 | nein | Schnelle, Bosse (halbe Wirkung) | rundes Gefäß: Topf, Fass, Tank |
| `knacker` | **Panzerknacker** | Violett `#8A55D6` | schwerer Einzeltreffer, der Rüstung ignoriert: 40 Schaden, alle 3,3 s, Reichweite 4,5. Zielt von Haus aus auf den Stärksten. Ab dem Zeitalter der Entdecker trifft er sofort. | ja | Gepanzerte, Bosse, Heiler, zähe Flieger | das längste waagerechte Rohr oder der längste Bolzen |
| `brenner` | **Brenner** | Rot `#D8432F` | kurzer Flammenstoß (Reichweite 1,8, jede Sekunde): trifft das Ziel und alle Bodengegner im Umkreis 0,9 mit 4 Schaden und setzt sie in **Brand**: 12 Schaden/s für 3 s | nein | Schwärme, Gepanzerte, Schilde, Heiler | niedrig, Düse nach vorn, immer eine kleine Zündflamme |
| `taktgeber` | **Taktgeber** | Gold `#F2C230` | kein Angriff; Türme auf den 8 Nachbarfeldern feuern 20 % schneller (mehrere Taktgeber addieren sich nicht) | – | macht aus einer Gruppe eine Todeszone | der höchste Mast mit einem Zeichen an der Spitze |

- **Brand** ignoriert Rüstung, erneuert sich statt sich zu stapeln, und ein brennender Gegner wird weder geheilt noch lädt sein Schild.
  Auf verlangsamte Gegner wirkt Brand anderthalbfach (**Zunder-Kombo**: klebrig plus Feuer).
- **Pfütze** und Flächenschaden wirken nur am Boden. Flieger trifft, was geradeaus schießt: Schütze und Panzerknacker.
- **Skalierung.** Schaden und Brand je Zeitalter S = 1 / 2 / 4 / 8 / 16 / 32. Preise je Zeitalter K = 1 / 1,8 / 3,2 / 5,6 / 10 / 18.
  Grundpreise: Schütze 60, Werfer 90, Bremser 70, Panzerknacker 110, Brenner 100, Taktgeber 120 Gold.
- **Verlangsamung und Takt wachsen mit dem Zeitalter** (bessere Technik wirkt stärker): Pfütze 30 % in der Steinzeit, je Zeitalter
  5 Punkte mehr (55 % in der Zukunft); Taktgeber 20 %, je Zeitalter 3 Punkte mehr (35 %).
- **Stufen.** Stufe 2 kostet das 0,9-Fache, Stufe 3 das 1,3-Fache des Baupreises im Zeitalter des Turms. Stufe 2: Schaden x1,6,
  Reichweite +8 %. Stufe 3: Schaden x2,5 und ein **Ausbauzweig** nach Wahl. Die Pfütze verlangsamt auf Stufe 2 und 3 um 8 bzw.
  15 Punkte mehr, der Taktgeber gibt 8 bzw. 15 Punkte mehr (in beiden Zweigen, zusätzlich zum Zuwachs des Zeitalters).
- **Ausbauzweige.** Beim Ausbau auf Stufe 3 wählt der Spieler einen von zwei Zweigen. Beide kosten dasselbe, die Wahl bleibt
  (auch beim Modernisieren). Zweig A ist die klassische Besonderheit, Zweig B spielt sich anders:

  | Rolle | Zweig A | Zweig B |
  |---|---|---|
  | Schütze | **Doppelschuss**: doppelte Feuerrate (im Faktor 2,5 enthalten); gut gegen viele Kleine | **Scharfschütze**: ein Schuss alle 2 s mit 3,2-facher Wucht (gleich viel je Sekunde), +40 % Reichweite; gut gegen Gepanzerte |
  | Werfer | **Großkaliber**: Radius 1,4 | **Schnelllader**: Radius 1,0, ein Drittel weniger Ladezeit |
  | Bremser | **Großer Teich**: Radius 1,2, bleibt 4 s | **Ätzpfütze**: Radius 0,9 und 3 s, dafür Schaden über Zeit (halber Standardschuss je Sekunde auf Stufe 3; zählt wie Brand) |
  | Panzerknacker | **Durchschuss**: geht mit 70 % auf einen zweiten Gegner über | **Kettenschlag**: springt auf bis zu drei weitere (je Sprung 70 %, kürzere Sprünge), trifft dafür 20 % schwächer |
  | Brenner | **Flächenbrand**: Radius 1,2 | **Weißglut**: Radius 0,9, Brand 40 % stärker und 6 statt 3 s |
  | Taktgeber | **Fernsicht**: Nachbarn reichen 20 % weiter | **Kriegstrommel**: Nachbarn treffen 15 % härter |
- **Freischaltung.** In der ersten Partie kommt je Welle eine Rolle dazu: Schütze (Welle 1), Werfer (2), Bremser (3),
  Panzerknacker (4), Brenner (5), Taktgeber (6). Wer die Hinweise abgeschlossen hat, hat von Anfang an alle sechs.
- Türme nehmen nie Schaden.

### 2.3 Eigenschaften der Gegner
Werte eines Gegners sind Vielfache des **Standardgegners** seines Zeitalters. Standard-Lebenspunkte je Zeitalter:
25 / 260 / 645 / 1455 / 3140 / 6750 (je gespieltem Zeitalter), innerhalb eines Zeitalters +8 % je Welle (Welle 10: das 1,72-Fache).
Darauf kommt der Druck je Position (`AGE_PRESSURE` in `src/content/balance.js`) 1 / 0,85 / 1,15 / 1,2 / 1,8 / 2,15, der die sich
ansammelnden Zeitgaben ausgleicht; tatsächlich also 25 / 221 / 742 / 1746 / 5652 / 14513 Lebenspunkte.
Tempo 1 = 1 Feld pro Sekunde.
Die Sprünge sind größer als die des Schadens (x2), weil zehn Wellen je Zeitalter deutlich mehr Gold einbringen als früher sechs.

| Eigenschaft | Regel | Bild |
|---|---|---|
| **schnell** | hohes Tempo | schlank, nach vorn geneigt |
| **Schwarm** | viele, schwache Gegner in Rudeln | klein |
| **zäh** | viele Lebenspunkte, langsam | groß, massig |
| **gepanzert** | Rüstung N zieht von jedem Treffer N x 60 % des Standardschusses seines Zeitalters ab (mindestens 10 % kommen an). Panzerknacker und Brand ignorieren sie. | Metallplatten; Treffer sprühen Funken und machen „kling“ |
| **Heiler** | heilt andere im Umkreis 1,5 um 3 % ihrer Lebenspunkte je Sekunde | grüner Ring am Boden, grüne Noten |
| **fliegend** | fliegt in gerader **Luftlinie** vom Eingang zur Flamme, über Pfützen, Werfer und Brenner hinweg | Schatten am Boden; die Luftlinie wird als gepunktete Spur gezeigt, sobald die nächste Welle Flieger enthält |
| **Träger** | setzt beim Zerstören seine Insassen an Ort und Stelle aus | sichtbar beladen |
| **Schild** | Blase mit 50 % der Lebenspunkte, lädt nach 3 s ohne Schaden wieder auf (Brand verhindert das) | türkise Sechseck-Blase, flackert bei Treffern |
| **Boss** | Pfütze wirkt halb, kostet 10 Funken, hat einen Namen und einen großen Lebensbalken; manche Bosse haben einen angekündigten Moment bei bestimmtem Lebensstand | sehr groß |

### 2.4 Zeitenwende (Wechsel des Zeitalters)
Ausgelöst, wenn die Bosswelle überstanden ist. Ablauf, etwa 5 Sekunden, währenddessen kann keine Welle gestartet werden:
1. Der Boss zerstäubt zu einem Wirbel Zeitsand, ein Glockenschlag.
2. Die Sonne wandert weiter; Himmel, Nebel und Lichtfarbe gehen in die neue Stimmung über.
3. **Lichtwelle:** Ein Ring aus Licht breitet sich von der Flamme über die Insel aus. Wo er vorbeikommt, wechseln Boden und Weg die
   Farbe, alte Dekoration schrumpft weg und neue ploppt mit Überschwingen auf, jedes an seinem festen Platz
   (aus der Kiefer wird die Säule wird das Fachwerkhaus).
4. Die Basis verwandelt sich zuletzt, mit großem Hüpfer; die Flamme lodert auf. Titelkarte mit Jahreszahl, die Musik blendet über.
5. **Türme bleiben, wie sie sind**, und arbeiten mit ihren alten Werten weiter. Veraltete Türme tragen eine kleine Sanduhr.
6. **Zeitgeschenk:** Gold im Wert von 16 Standard-Kopfgeldern des neuen Zeitalters. Eine Karte zeigt die neuen Gegner mit ihrer
   Eigenschaft und der Rolle, die sie kontert. Danach **Baupause ohne Zeitdruck**; die erste Welle jedes Zeitalters ist die leichteste.

### 2.5 Modernisieren
- Ein Klick hebt einen veralteten Turm auf den Stand des **aktuellen** Zeitalters. Stufe und Zielwahl bleiben erhalten. Sofort wirksam.
- **Preis: 30 % dessen, was der Turm mit seiner Stufe im aktuellen Zeitalter neu kosten würde**, egal wie viele Zeitalter er überspringt.
  Wer ein Zeitalter auslässt, spart also eine ganze Modernisierung, kämpft aber ein ganzes Zeitalter lang mit halber Kraft: Das ist die
  wiederkehrende Entscheidung des Spiels. Verkaufen und neu bauen ist immer teurer.
- Ein veralteter Turm ist nie abgeschaltet. Schaden: ein Zeitalter zurück = halbe Kraft, zwei zurück = ein Viertel
  (die Gegner haben sich verdoppelt). Ausbauen ist jederzeit möglich, zum Preis des Zeitalters, auf dessen Stand der Turm ist.
- Knopf **„Alle modernisieren“** mit Summe; reicht das Gold nicht, kommen die günstigsten zuerst.

### 2.6 Zielwahl
Je Turm umschaltbar: **Vorderster** (Standard), **Letzter**, **Stärkster** (Standard beim Panzerknacker), **Schwächster**.
Der Bremser bevorzugt Gegner, die noch in keiner Pfütze stehen.

### 2.7 Die Zeitglocke (einzige aktive Fähigkeit)
Ein Knopf, kein Zielen: Die Glocke schlägt, ein goldener Ring läuft von der Flamme über die Insel, und **jeder Gegner wird um
4 Sekunden seines Weges zurückgeworfen** (Bosse 2 Sekunden) und ist danach 3 Sekunden lang 50 % langsamer. Abklingzeit 75 Sekunden,
zu Beginn bereit. Sie ist der Notknopf, der ein Durchkommen fast immer verhindern kann, und passt zum Thema Zeit.

### 2.8 Wirtschaft
- Standard-Kopfgeld G je Zeitalter = 5 / 9 / 16 / 28 / 50 / 90 Gold. Andere Gegner: G x Lebenspunkte-Vielfaches x 0,8 (mindestens 2),
  Schwarmgegner und Insassen entsprechend wenig, Boss 20 x G.
- Startgold 150, 20 Funken.
- Welle überstanden: 6 x G; ohne verlorenen Funken („Makellos“) zusätzlich 2 x G.
- **Frühstart:** Nach einer Welle schmilzt eine Prämie von 2 x G über 12 Sekunden auf null; wer die nächste Welle sofort ruft, bekommt sie.
  Es gibt keinen Zwangs-Countdown: Wellen starten nur auf Knopfdruck (oder automatisch, wenn der Spieler das einschaltet).
- **Verkaufen:** 75 % des investierten Goldes; alles zurück, solange die Welle, für die gebaut wurde, noch nicht begonnen hat.
- Keine Zinsen, keine zweite Währung, keine Reparaturen.

### 2.9 Schwierigkeitsgrade

| | Gemütlich | Normal | Knifflig |
|---|---|---|---|
| Lebenspunkte der Gegner | x0,8 | x1,0 | x1,25 |
| Tempo der Gegner | x1,0 | x1,0 | x1,1 |
| Funken | 30 | 20 | 15 |
| Startgold | 190 | 150 | 140 |

Der gemeinsame Regler für die Härte ist `PRESSURE` in `src/content/balance.js`: Er multipliziert die Lebenspunkte aller
Gegner in allen Zeitaltern und allen drei Graden (zurzeit 1; 0,9 = 10 % mürber, 1,1 = 10 % zäher). Was Zeitgaben und Wellen mit
Eigenart dem Spieler bringen, gleicht der Druck je Position aus (2.3): Die Steinzeit bleibt unberührt, damit die Eröffnung auf
jedem Grad fair ist, danach wird es Zeitalter für Zeitalter zäher (Protokoll Schritte 17 und 19 in `tools/balance.mjs`).

### 2.10 Sieg und Niederlage
- **Sieg:** die letzte Welle überstanden (im aktiven Umfang Welle 60). Über der Insel der Zukunft geht die Sonne wieder auf. Sterne: 1 = gewonnen, 2 = mindestens 10 Funken
  übrig, 3 = mindestens 18 Funken übrig.
- **Niederlage:** kein Funke mehr; die Flamme verlischt mit einem leisen Puff. Angebot **„Zeitalter wiederholen“** (Stand vom Beginn
  des laufenden Zeitalters) oder „Neu starten“. Eine lange Partie ist nie einfach weg.
- Automatisches Speichern zu Beginn jeder Welle; „Fortsetzen“ im Hauptmenü.

### 2.11 Superwaffen (Verschmelzen)
Der späte Goldabfluss und die große Geste: Drei ausgebaute Türme werden zu einem.
- Ein **Kern** der Stufe 3 nimmt **zwei Zutaten** auf: Türme der Stufe 3 auf seinen acht Nachbarfeldern, im selben Technikstand,
  keine Superwaffen. Jede Rolle darf Kern oder Zutat sein, auch dreimal dieselbe. Gebühr: das 2,5-Fache des Baupreises der Kernrolle
  (gut drei Viertel eines Turms der Stufe 3).
  Erlaubt in der Baupause und mitten in der Welle.
- Die Zutaten verschwinden (ihre Felder werden frei), der Kern wird zur **Superwaffe**: dreifacher Schaden und Brand (so viel wie
  die drei Türme zusammen, aber auf einem Feld und unter einem Taktgeber), 20 % mehr Reichweite, eine **eigene Angriffsart des
  Kerns** und je eine **Gabe** der beiden Zutaten. Stufe und Zweig des Kerns bleiben. Sie kann nicht weiter ausgebaut werden;
  Modernisieren kostet 30 % des Neuwerts von Kern und Zutaten, Verkaufen bringt 75 % von allem, was hineingeflossen ist.
- **Jeder Kern greift anders an** (Rückmeldung „die Superwaffen sind eher einseitig“, 10.11.2026):

  | Kern | Als Superwaffe |
  |---|---|
  | Schütze | **Dauerstrahl** (trifft auch Flieger): 8 Grundschaden je Sekunde, heizt in 4 s auf das 2,5-Fache auf, solange er sein Ziel hält; als Scharfschütze 40 % weiter |
  | Werfer | Einschlag ein Fünftel größer, ein Fünftel schneller, hinterlässt 3 s **brennenden Boden** (10 Grundschaden je Sekunde) |
  | Bremser | **Frostpuls** alle 1,5 s um den Turm: alles in Reichweite, auch Flieger, wird mit der Verlangsamung seines Zeitalters 2 s lang gebremst und leicht getroffen (5); eine Ätzpfütze ätzt dabei alle |
  | Panzerknacker | **Kettenblitz**: trifft sofort, springt auf vier Gegner mehr als sein Zweig (5 bzw. 7), bis 2 Felder weit, ohne Rüstung |
  | Brenner | **Feuerring**: jede Sekunde ein Ring um den Turm, 30 % weiter und 30 % heißer, setzt alles am Boden in Brand |
  | Taktgeber | Takt zwei Felder weit (20 statt 8 Felder), 5 Punkte schneller, dazu 15 % mehr Wucht für alle darin |

- **Der Zweig der Zutat wählt die Gabe** (zwölf Gaben, gleiche Arten stapeln sich):

  | Zutat | Zweig 0 | Zweig 1 |
  |---|---|---|
  | Schütze | **Schnellfeuer**: ein Viertel weniger Pause, Strahl heizt schneller, Taktgeber +10 % Takt | **Zielfernrohr**: +20 % Reichweite |
  | Werfer | **Sprengkopf**: Einschläge +20 %, +10 % Reichweite, Einzelziele springen auf einen mehr | **Schnellladung**: etwas schneller, Felder 40 % länger |
  | Bremser | **Kleber**: Treffer bremsen 25 % für 1,5 s (Bremser-Kern: 1,5 s länger) | **Ätzmittel**: Treffer ätzen 2 s, Felder länger |
  | Panzerknacker | **Panzerbrecher**: ohne Rüstung, +15 % Reichweite | **Kettenfunke**: +10 % Schaden und Brand, Einzelziele springen auf zwei mehr |
  | Brenner | **Brandsatz**: 3 s Brand wie ein Brenner der Stufe 3 | **Glutkern**: Brand anderthalbmal heißer und länger, sonst ein Glimmen |
  | Taktgeber | **Weitblick**: +15 % Reichweite, Taktgeber-Kern: Nachbarn reichen weiter | **Taktkern**: +25 % Schaden und Brand, Taktgeber-Kern: mehr Takt und Wucht |

- Lohnende Paare: Strahl mit Kettenfunke (springender Strahl), Werfer mit Brandsatz oder Glutkern (Feuerteppich), Frostpuls mit
  Ätzmittel, Feuerring mit Kleber (Zunder: Brand auf Verlangsamten wirkt anderthalbfach). Einem Taktgeber-Kern bringen nur
  Gaben etwas, die Reichweite oder Aura verändern; die Texte sagen das.
- Gemessen (tools/balance.mjs, Eintrag 12): Kerne, die Flieger treffen (Strahl, Kettenblitz), tragen den besten Bot; der
  Brenner- und der Werfer-Kern sind am Boden stark, lassen aber Flieger durch (der Werfer soll ausdrücklich keine Flieger treffen).
- **Rezept Flak** (Rückmeldung nach `zangengriff`: „die Drohnen sind kaum aufzuhalten … eine Kombi aus 3 der ersten Waffe könnte
  doch eine gute FLAK sein“, 10.11.2026): Ein Schützen-Kern mit **zwei Schützen** als Zutaten wird statt zum Strahl zur **Flak**:
  sofort treffende Salven (5 Grundschaden alle 0,7 s), die im Radius 1 zerplatzen, Flieger und Boden treffen, 15 % weiter reichen.
  Die Gaben wirken wie sonst: Schnellfeuer (Doppelschuss) macht die Salven dichter, Zielfernrohr (Scharfschütze) reicht weiter.
  Gemessen allein in der Zukunft, Welle 9: von 24 dicht fliegenden Drohnen mit doppelten Lebenspunkten holt die Flak 13 herunter
  (Kettenblitz 8, Strahl 4); gegen einen Goliath 662 Schaden je Sekunde (Strahl 1186 bis 1652); von 14 Wachrobotern am Boden 6
  (Kettenblitz und Brandwerfer alle 14). Also die Antwort auf Schwärme in der Luft, gegen Einzelne und am Boden zweite Wahl.
  Namen: Kieselhagel, Salventurm, Bolzenhagel, Kartätsche, Flakgeschütz, Flakbatterie; als Megawaffe Hagelsturm, Legionssalve,
  Bolzengewitter, Kartätschenwall, Flakturm, Flakschirm. Das Verschmelzen-Blatt eines Schützen kündigt das Rezept an, die Vorschau
  zeigt die Flak, sobald beide Zutaten Schützen sind. Weitere Rezepte folgen demselben Muster (docs/SIM.md, „Rezepte“).
- **Rezepte zum Freischalten** (docs/briefs/fusion.md, 11; 10.11.2026): sieben weitere, alle **gesperrt**, bis die laufende Partie
  sie freischaltet; bis dahin ergibt die Mischung die gewöhnliche Superwaffe, und eine stehende Superwaffe verwandelt sich nie.

  | Rezept | Kern + Zutaten | Was es anders macht |
  |---|---|---|
  | Teerfeuer | Brenner + 2 Bremser | wirft brennenden Teer weit auf den Weg: Pfützen, die 4 s brennen und bremsen (statt Feuerring), nur Boden |
  | Belagerungsgeschütz | Panzerknacker + 2 Taktgeber | alle 6 s ein dreifach wuchtiger Treffer ohne Rüstung fast über die ganze Karte; blind auf zwei Felder und gegen Flieger |
  | Dampfkessel | Bremser + 2 Brenner | sehr weiter Dampfpuls alle 3 s, verbrüht alles 5 s lang, auch Flieger, bremst aber nicht mehr |
  | Kommandoposten | Taktgeber + 2 Schützen | weiter Takt ohne Wucht, schießt selbst Flieger ab (Bodengegner nie) |
  | Panzergranate | Werfer + 2 Panzerknacker | kein Brandfeld, fast dreifache Wucht im größeren Einschlag ohne Rüstung, nur Boden |
  | Brennglas | Schütze + Werfer + Brenner | Strahl ohne Aufheizen, versengt alles um sein Ziel und setzt es 2 s in Brand, auch Flieger |
  | Fesselstrahl | Bremser + Schütze + Panzerknacker | hält ein Ziel im Strahl, bremst es wie die Pfütze (Bosse halb), heizt auf das Doppelte auf |

  Freischalten in der Partie: (a) als Zeitgabe „Bauplan: …“ (je Rezept eine, selten, höchstens eine im Angebot, keine für schon
  freie Rezepte; Wahl zwischen starker Gabe und neuer Waffe); (b) wer den Zwischenboss eines Zeitalters ohne Funkenverlust besiegt,
  bekommt ein Rezept aus dem Pool dieses Zeitalters (Rom und Mittelalter je drei bis vier, Entdecker fünf, Steinzeit, Industrie
  und Zukunft keins: Was die Entdecker bringen, wirkt in allen drei Flieger-Zeitaltern). Eine typische Partie schaltet zwei bis drei
  frei (der beste Bot im Mittel 2,7, wer jeden Zwischenboss makellos schlägt, drei), welche, ist Zufall. Die Flak ist nie
  gesperrt. Gemessen (tools/balance.mjs, Eintrag 18): als zweite Superwaffe des besten Bots erzwungen ist jedes Rezept ungefähr so
  stark wie die gewöhnliche Superwaffe derselben Türme; keins ist Pflicht, keins nutzlos. Das Rezeptbuch im Menü (Wissen, nicht
  Freischaltung für spätere Partien) gehört der Oberfläche.
- Jede Ausprägung hat als Superwaffe einen eigenen Namen (Steinzeit: Sturmschleuder, Bergwerfer, Bernsteinquelle, Mammutspeer,
  Urfeuer, Donnertrommel · Rom: Pfeilsturm, Jupiters Faust, Ölteppich, Königsskorpion, Vulkans Esse, Goldener Adler · Mittelalter:
  Meisterarmbrust, Mauerbrecher, Pechsee, Drachentöter, Drachenatem, Domglocke · Zukunft:
  Lichtlanze, Sternenhagel, Schaumgletscher, Kometenkanone, Sonnenkern, Orakel).
- Darstellung: das Modell der Stufe 3, sichtbar größer, mit ruhigem Lichtkranz in der Rollenfarbe und je einem kleinen kreisenden
  Licht in der Farbe jeder Gabe. Das Verschmelzen ist ein kleines Fest: Die Zutaten lösen sich in Lichter auf, die in den Kern
  fliegen, ein Ring, ein glockenartiger Ton.

#### Megawaffe (zweiter Schritt)
- Eine Superwaffe nimmt noch einmal **zwei Nachbarn** der Stufe 3 (gleicher Technikstand, keine Superwaffen) auf und wird zur
  **Megawaffe**: fünffacher Schaden und Brand (statt dreifach), 35 % mehr Reichweite (statt 20 %), alle **vier Gaben** in der
  Reihenfolge der Aufnahme, die Zugabe des Kerns einmal. Gebühr: das 4-Fache des Baupreises der Kernrolle.
- **Höchstens eine** Megawaffe zugleich; wer sie verkauft, darf eine neue bauen. Neun Türme in einem (drei Superwaffen verschmelzen)
  gibt es bewusst nicht.
- Jede Ausprägung hat einen eigenen, noch größeren Namen (Steinzeit: Himmelsschleuder, Gipfelstürzer, Bernsteinmeer, Weltenspeer,
  Feuerberg, Herzschlag der Erde · Zukunft: Sternenlanze, Meteorschauer, Schaumlawine, Sternenbrecher, Sternenherz, Weltorakel).
- Darstellung: anderthalbmal so groß, ein zweiter Lichtkranz oder eine Krone, vier kreisende Gabenlichter, ein größerer,
  aber ruhiger Moment des Verschmelzens. Gemessen (tools/balance.mjs, Eintrag 11): lohnend, aber kein Muss.

### 2.12 Zeitgaben (Wahl beim Zeitalterwechsel)
Nach dem Boss eines Zeitalters liegen drei **Zeitgaben** zur Wahl (Karten mit Symbol, Name, ein bis zwei ehrlichen Sätzen; ein Klick,
kein Zeitdruck). Die gewählte gilt bis zum Ende der Partie, für stehende und künftige Türme. In vier Zeitaltern sind das drei
Entscheidungen, in sechs fünf. Ziel: keine Partie wie die andere, eine Aufstellung, die über die Zeitalter wächst.
- Jede Gabe macht **eine Spielweise** deutlich besser, statt alles ein bisschen: Feuer (Lauffeuer: Brand springt beim Tod über;
  Zunder: Zunder-Kombo 2,25-fach; Glutherz: Brenner +25 % Reichweite), Bremsen (Zähe Masse), Schützen und Flieger (Adlerauge für
  Scharfschützen, Sperrfeuer gegen Flieger und für die Flak), Panzerknacker (Kettenreaktion), Werfer (Pulverfass), Taktgeber
  (Gleichschritt), Bosse (Riesentöter), Superwaffen (Schmelztiegel, Meisterwerk, Zweite Krone), besondere Bauplätze (Ortskunde,
  Höhenluft, Moorgeister), Wirtschaft mit Haken (Kopfgeldjäger, Baumeister, Veredler, Zeitreisende Handwerker, Wanderbaumeister),
  Glocke (Glockengießer), Funken gegen Gold (Ewige Flamme, Goldener Handel). Liste und Texte: `src/content/boons.js`.
- Angeboten wird nur, was auf der Karte und in der Partie Sinn ergibt (Höhenluft nur mit Anhöhe, Sperrfeuer nur, wenn noch Flieger
  kommen). Wer keine Wahl treffen will, bekommt ohne Oberfläche dafür die erste Karte.
- Regeln: docs/SIM.md, „Zeitgaben“. Gemessen mit tools/balance.mjs (Eintrag 16).

### 2.13 Wellen mit Eigenart
Je Partie tragen **zwei Wellen jedes Zeitalters** eine angekündigte Eigenart, nie die erste und nie eine mit Boss oder
Zwischenboss; die Wellenvorschau nennt sie vorher. So wandelt sich der feste Rhythmus der zehn Wellen von Partie zu Partie.
- Schwerer, aber lohnend: **Nebel** (Türme −12 % Reichweite, anderthalbfache Prämie), **Eilmarsch** (+20 % Tempo, +30 % Kopfgeld),
  **Gepanzerter Tross** (Rüstung x1,6, +25 % Kopfgeld), **Schildwall** (Schilde x1,5, +25 % Kopfgeld), **Zähes Volk** (+30 %
  Lebenspunkte, +50 % Kopfgeld), **Rückenwind** (Flieger +30 % Tempo, +40 % Kopfgeld).
- Anders, nicht schwerer: **Klare Sicht** (Türme +15 % Reichweite, Gegner +15 % Lebenspunkte), **Goldrausch** (anderthalbmal so
  viele Gegner mit 40 % weniger Lebenspunkten), **Windstille** (Flieger 30 % langsamer, aber 25 % zäher).
- Eine Eigenart trifft nur Wellen, für die sie Sinn ergibt (Rückenwind nur mit Fliegern, Tross nur mit Gepanzerten, Goldrausch nur
  mit einem Rudel). Gezogen aus dem Startwert der Partie; Liste: `src/content/modifiers.js`, Regeln: docs/SIM.md.

### 2.14 Waffenpool (sechs Plätze, mehrere Waffen je Platz)
Die sechs Rollen sind **Plätze** der Bauleiste: Schütze (einzelne Ziele), Werfer (Fläche), Bremser (verlangsamen), Panzerknacker
(Rüstung), Brenner (Feuer), Taktgeber (Unterstützung). Jeder Platz hält mehrere **Waffen**, die dieselbe Aufgabe verschieden lösen;
die sechs bisherigen Rollen sind die klassische Waffe ihres Platzes. Jede Partie hat je Platz genau eine Waffe (die **Bewaffnung**):
Der Spieler hat also immer sechs, jede Aufgabe ist gedeckt, aber jedes Mal anders. Eine gezogene Bewaffnung hat mindestens zwei Waffen
gegen Flieger; „Klassisch“ (die sechs ursprünglichen) ist immer wählbar.
- Was nach dem Platz geht: Farbe, Platz und Taste in der Bauleiste, Freischalt-Reihenfolge beim ersten Spielen, Filter der Zeitgaben,
  die acht bisherigen Rezepte (Teerfeuer ist „Brenner-Platz + zwei vom Bremser-Platz“, gleich welche Waffen das sind).
- Was die Waffe mitbringt: eigene Werte und Preis, zwei Ausbauzweige, je Zweig eine eigene Gabe als Zutat, einen eigenen Angriff als
  Superwaffe, Namen und Angriffsbild in jedem Zeitalter, eine Akzentfarbe und ein kleines Erkennungszeichen am Modell des Platzes
  (vorerst teilen sich die Waffen eines Platzes dessen Modell). Neue **waffengebundene Rezepte** nennen bestimmte Waffen und gibt es
  nur in Partien, die sie gezogen haben (nur dann als Bauplan oder Belohnung eines Zwischenbosses).
- Die 18 Waffen (Schritt 1: drei je Platz; Werte Steinzeit, Stufe 1; „Luft“ = trifft Flieger mit Schaden oder Brand):

  | Platz | Waffe | Wie sie spielt | Luft | Superwaffe |
  |---|---|---|---|---|
  | Schütze | Schütze (klassisch) | Einzelschuss 10 alle 1,25 s, 3 Felder | ja | Strahl, der aufheizt |
  | Schütze | **Giftschütze** | leichter Treffer in kleiner Giftwolke, Gift 6/s für 4 s | ja | Giftschwade (sofort, Fläche, Gift) |
  | Schütze | **Schnellschütze** | 3,8 alle 0,4 s, nur 2,7 Felder; Rüstung schluckt viel (Zweig Hartkern hilft) | ja | Kugelwirbel: Puls rundum, 2,5-mal je Sekunde |
  | Werfer | Werfer (klassisch) | Bogenwurf, Fläche 1, 3,5 Felder | nein | Wurf mit Brandfeld |
  | Werfer | **Fernwerfer** | 30 Schaden, Fläche 1,1, 5,2 Felder weit, blind bis 2 Felder, alle 3,6 s | nein | Trommelfeuer: fast jede Sekunde ein Einschlag, kein toter Winkel |
  | Werfer | **Stampfer** | stampft alle 2,6 s rundum (1,5 Felder), wirft 0,35 Felder zurück | nein | Beben: weiter Puls, wirft zurück, lässt taumeln |
  | Bremser | Bremser (klassisch) | Pfütze auf dem Weg | nein | Frostpuls |
  | Bremser | **Frostturm** | Kältewelle rundum, auch Flieger | (bremst) | Frostkette |
  | Bremser | **Netzwerfer** | alle 2 s ein Netz auf ein Ziel, 35 % für 2 s, auch Flieger, sucht Ungebremste | (bremst) | Netzsalve: großes Netz über eine Gruppe, Boden und Luft |
  | Panzerknacker | Panzerknacker (klassisch) | schwerer Einzeltreffer ohne Rüstung, 4,5 Felder | ja | Kettenblitz |
  | Panzerknacker | **Bohrer** | Bohrstrahl ohne Rüstung, in 3 s dreifach heiß, 2,4 Felder, nur Boden | nein | Presslufthammer: Strahl, der sein Ziel zurückdrückt |
  | Panzerknacker | **Spalter** | leichte Treffer ohne Rüstung, die zeichnen (30 % mehr Schaden von allem, 3 s), sucht Ungezeichnete | ja | Zeichengranate: zeichnet eine Gruppe |
  | Brenner | Brenner (klassisch) | kurzer Flammenstoß, Brand 12/s | nein | Feuerring |
  | Brenner | **Brandpfeil** | Brandpfeil 3,5 Felder weit, Brand 12/s für 4 s, sucht Nicht-Brennende | ja | Feuerkette: Brand springt auf vier weitere |
  | Brenner | **Glutgrube** | wirft Glutfelder (5 s) auf den Weg, wer darin steht, brennt 11/s | nein | Glutmal: Glutfeld, das auch zeichnet |
  | Taktgeber | Taktgeber (klassisch) | Nachbarn feuern schneller | – | weiter Takt mit Wucht |
  | Taktgeber | **Leuchtfeuer** | Lichtpuls rundum (2,2 Felder): Gegner im Licht nehmen 15 % mehr Schaden (bis 35 %), auch Flieger | (zeichnet) | Suchscheinwerfer: Strahl, der den Stärksten tief zeichnet |
  | Taktgeber | **Zahlmeister** | wer bis 2 Felder um ihn stirbt, bringt 50 % (bis 80 %) mehr Kopfgeld | – | Schatzkammer: mehr Aufschlag, weiter, dazu Wucht |

  Neue Mechaniken dafür (docs/SIM.md): **Rückstoß** (`push`, Bosse halb, je Gegner höchstens einmal je Sekunde), **Zeichen**
  (`mark`: mehr Schaden von allem, auch Brand), **Sucher** (`seek`: bevorzugt Ziele ohne die eigene Wirkung) und **Kopfgeld-Aura**
  (`auraBounty`). Waffengebundene Rezepte: Kopfgeldjäger (Zahlmeister + 2 Schützen), Sonnenlanze (Leuchtfeuer + 2 Panzerknacker),
  Harpune (Netzwerfer + 2 Panzerknacker), Feuerwalze (Stampfer + 2 Brenner), Nebelwerfer (Fernwerfer + Giftschütze + Bremser).
- Ausbau: Schritt 1 drei Waffen je Platz (18), später fünf (30). Regeln: docs/SIM.md, „Waffenpool“; Daten: `src/content/towers.js`
  (`SLOTS`, `POOL`); gemessen mit tools/balance.mjs (Einträge 20 und 21, Schalter `--loadout`).

## 3 Zeitalter

„Ein Tag durch die Geschichte“: Die Sonne wandert von Osten über Süden nach Westen. Palettenreihenfolge:
Himmel oben / Horizont / Sonnenlicht / Boden A / Boden B / Weg / Akzent. Nebelfarbe = Horizontfarbe.

| Nr. | Kennung | Name | Untertitel | Wellen | Tageszeit | Licht: Richtung (0 = Süden, 90 = Osten) / Höhe |
|---|---|---|---|---|---|---|
| 1 | `steinzeit` | Steinzeit | um 10 000 v. Chr. | 1–10 | Morgengrauen | 95° / 30° |
| 2 | `rom` | Römisches Reich | um 100 n. Chr. | 11–20 | Vormittag | 65° / 42° |
| 3 | `mittelalter` | Mittelalter | um 1250 | 21–30 | Mittag | 15° / 70° |
| 4 | `entdecker` | Zeitalter der Entdecker | um 1700 | 31–40 | Nachmittag | −45° / 45° |
| 5 | `industrie` | Industriezeitalter | um 1880 | 41–50 | Abenddämmerung | −85° / 30° |
| 6 | `zukunft` | Nahe Zukunft | um 2050 | 51–60 | Nacht (Mond) | −55° / 52° |

Das schattenwerfende Licht steht nie tiefer als 30°, sonst streifen die Schatten das ganze Feld; die tief stehende Sonne von
Morgen und Abend zeigt sich in Himmels-, Nebel- und Lichtfarbe. Das Hauptlicht bleibt nahe an Weiß, die Stimmung kommt aus Himmel,
Nebel und Umgebungslicht. Auch nachts fällt das Umgebungslicht nie so weit ab, dass Boden und Weg verschwimmen.

Konstantes Motiv: **die Flamme** in der Basis jedes Zeitalters. Jedes Basismodell hat ein Teil `flame` (leuchtend), dessen Größe
die Engine an die verbliebenen Funken koppelt.

### 3.1 `steinzeit` — Steinzeit · "um 10 000 v. Chr." · Wellen 1-10
- **Licht:** Morgengrauen. Low pink-orange sun, long soft shadows, ground mist, cool blue shadow tint. Calm, hopeful.
- **Palette:** #6B7FB8 / #F7B28A / #FFD2A6 / #8FB36B / #7BA05C / #C9A77A / #E2603A (ochre red)
- **Pfad:** trampled earth, irregular edge, a few inset flat pebbles and footprints (dark vertex spots).
- **Wasser/Abgrund:** island floats in a pink morning-mist sea (soft fog plane), two thin waterfalls drop off the rim into the mist.
- **Props:** *Urzeitbaum* (cylinder trunk, 3 stacked squashed icospheres); *Farnbusch* (5 flattened cones fanned out); *Findling* (squashed low-poly sphere, grey with moss-green top vertices); *Fellzelt* (cone with brown stripes, 3 thin pole cylinders poking out the top); *Mammutrippen* (4 half-torus arcs in a row, ivory); *Höhlenmalerei-Fels* (upright slab box with ochre stick figures as vertex colours); *Lagerfeuer* (ring of small spheres, 3 crossed cylinders, glow cone); *Trockengestell* (2 forked cylinders, cross pole, 3 flat fish boxes).
- **Basis:** *Stammeshöhle* - rock dome (half sphere) with dark arch entrance, hide curtain, a painted totem pole, the flame as a big campfire in front.
- **Partikel:** drifting mist wisps, fireflies fading out, occasional pollen.
- **Musik:** 84 BPM, A-minor pentatonic, hand drums (filtered noise + sine thump), breathy bone flute (sine + noise), sparse.
### 3.2 `rom` — Römisches Reich · "um 100 n. Chr." · Wellen 11-20
- **Licht:** Vormittag. Clear, bright, warm-white Mediterranean light, crisp shadows, saturated blue sky.
- **Palette:** #4FA3E3 / #CFEBFA / #FFF4D6 / #B9C46A / #A6B35A / #D8CDB8 / #C0392B (Roman red, plus gold #E0B03A)
- **Pfad:** pale stone slabs with dark joints, raised curb stones, a milestone at every bend.
- **Wasser/Abgrund:** turquoise sea (#2FB5C4) with slow low-poly swell, white foam ring at the cliff.
- **Props:** *Zypresse* (tall thin cone on a short cylinder); *Säule* (cylinder, box base and capital; some broken, lying); *Aquädukt* (box piers with half-torus arches along one island edge); *Olivenbaum* (bent cylinder, 3 flattened grey-green spheres); *Pergola* (4 posts, box lattice, small purple spheres as grapes); *Marmorstatue* (plinth box, cylinder body, sphere head, raised arm); *Amphoren* (lathe profile, terracotta, in groups of 3); *Mosaikplatz* (flat disc with coloured vertex rings).
- **Basis:** *Tempel der Flamme* - marble podium with steps, 6 columns, triangular pediment (prism), red roof, gold eagle standard; the flame burns in a bronze bowl between the columns.
- **Partikel:** slow dust motes in sunlight, a few white doves crossing (2-box birds).
- **Musik:** 96 BPM, D Dorian, brass cornu (low-passed saw), plucked lyre, timpani on 1 and 3, marching feel.
### 3.3 `mittelalter` — Mittelalter · "um 1250" · Wellen 21-30
- **Licht:** Mittag. Sun almost overhead, short shadows, strongest colour saturation, light fluffy clouds casting slow moving shadow blobs.
- **Palette:** #3F8FD9 / #BFE3F5 / #FFFBEA / #5FAF55 / #4E9C48 / #9A8F84 / #2F5DA8 (heraldic blue, plus #D9A520)
- **Pfad:** round cobblestones (grey vertex mottling), grass tufts at the edge, cart ruts.
- **Wasser/Abgrund:** deep green-blue lake like a giant moat, lily pads (flat discs), reeds at the cliff base.
- **Props:** *Fachwerkhaus* (white box, thin dark beam boxes, red prism roof); *Windmühle* (tapered cylinder, cone roof, 4 box blades spinning); *Tanne* (3 stacked cones); *Heuhaufen* (squashed yellow cone with a pitchfork stick); *Zinnenmauer* (box wall segments with crenel boxes); *Ziehbrunnen* (cylinder ring, 2 posts, small prism roof, bucket); *Marktstand* (4 posts, striped prism canopy, crates); *Weizenfeld* (grid of thin yellow boxes swaying); *Bannermast* (pole with waving blue cloth box).
- **Basis:** *Burg* - square keep with 4 round corner towers (cylinders with cone roofs), crenellations, gate with portcullis, blue banners; the flame is a beacon fire on the keep.
- **Partikel:** floating dandelion seeds, butterflies, chimney smoke.
- **Musik:** 104 BPM, G Mixolydian, plucked lute (Karplus-Strong), recorder melody, hurdy-gurdy drone, tambourine.
### 3.4 `entdecker` — Zeitalter der Entdecker · "um 1700" · Wellen 31-40
- **Licht:** Nachmittag. Warm golden light from the west, longer shadows, slight haze, sea sparkle.
- **Palette:** #5C9BD1 / #FBE3A8 / #FFE0A0 / #8DBB5E / #D9C58B (sand) / #B98D5A / #1E6F78 (teal, plus #B5382E)
- **Pfad:** wooden planks laid crosswise like a pier, rope railings on posts at bends, sand at the edges.
- **Wasser/Abgrund:** open ocean (#2A7FA8) with whitecaps; a small sailing ship circles the island; gulls.
- **Props:** *Palme* (4 curved cylinder segments, 6 drooping flattened cones); *Leuchtturm* (tapered red-white striped cylinder, glow box lantern, cone cap); *Steg* (plank boxes on cylinder posts over the edge); *Fässerstapel* (cylinders with torus hoops); *Schatztruhe* (box, half-cylinder lid, gold spheres); *Kanonenkugeln* (pyramid of 10 dark spheres); *Handelskontor* (brick box with stepped gable boxes); *Anker* (torus ring, box shank, bent arms); *Segelschiff* (extruded hull shape, 2 mast cylinders, curved box sails).
- **Basis:** *Hafenfestung* - low star fort (5-point extruded shape), sloped sand-coloured walls, corner cannons, flagpole; the flame is the fort's beacon in an iron basket on a tower.
- **Partikel:** sea spray at the cliffs, gulls, drifting sail-cloth scraps on gusts.
- **Musik:** 112 BPM in 6/8, D major, harpsichord-like bright plucks (pulse wave), fife, snare rolls, shanty swing.
### 3.5 `industrie` — Industriezeitalter · "um 1880" · Wellen 41-50
- **Licht:** Abenddämmerung. Deep orange sun low in the haze, violet sky, lit windows and gas lamps become the main accents. Dampf, Messing, Backstein.
- **Palette:** #4A3F6B / #F28C52 / #FFB98A / #6E7F58 / #5F6E4E / #8E8791 (helles Pflaster, Kante #B9B2BA) / #D97B29 (furnace orange, plus copper #C87533 and enamel green #2F6B5E)
- **Pfad:** light grey cobblestones with a pale kerb line; no rails (surfaces without direction only).
- **Wasser/Abgrund:** amber smog sea below the island; factory chimneys rise through it far away, puffing round smoke.
- **Props:** *Fabrikhalle* (brick box, sawtooth prism roof, glow windows); *Schornstein* (tall tapered cylinder with red-white rings; rim or far only); *Gaslaterne* (thin pole, small box cage, glow sphere); *Gasometer* (wide cylinder with 3 torus rings); *Wasserturm* (cylinder tank on 4 box legs); *Kohlehaufen* (dark squashed cones); *Güterwaggon* (box on 4 wheel cylinders); *Reihenhaus* (narrow brick boxes with prism roofs and lit windows); *Kastanie* (trunk with orange-tinted crown spheres).
- **Basis:** *Uhrturm-Kraftwerk* - brick hall with arched glow windows and a clock tower with a white dial; the flame is the furnace glow behind a big round window (part `flame`), chimney smoking.
- **Partikel:** rising sparks, soot flakes, steam wisps, first stars.
- **Musik:** 108 BPM, C minor (harmonic) with a waltz lilt, barrel-organ lead (detuned saws), tuba-like bass, rhythm from soft hiss and clank noises, glockenspiel fills.
### 3.6 `zukunft` — Nahe Zukunft · "um 2050" · Wellen 51-60
- **Licht:** Nacht. Cool moonlight plus strong unlit neon accents; every tower and enemy carries a glow strip so silhouettes stay readable; soft city glow on the horizon.
- **Palette:** #0E1433 / #2B3F7A / #A9C4FF (moon) / #2F4A4A / #3A5A54 / #59637C (heller Asphalt, Kante #9FB4D9) / #2EE6C8 (neon teal, plus magenta #FF4FA3)
- **Pfad:** smooth light-slate asphalt with a pale kerb line; glowing teal lane marks are welcome as decoration but the path must already read without them.
- **Wasser/Abgrund:** black mirror water reflecting a distant skyline (row of unlit glow boxes on the horizon), slow teal ripple rings.
- **Props:** *Windrad* (thin white cylinder, 3 box blades slowly spinning, red blink glow); *Solarfeld* (tilted dark-blue boxes on posts, teal edge glow); *Vertikale Farm* (stacked glass boxes with green layers, warm glow); *Ladesäule* (rounded box with pulsing glow strip); *Holotafel* (2 posts, flickering unlit glow plane); *Drohnenlandeplatz* (flat cylinder, glow ring, "H" from boxes); *Stadtbaum* (sphere crown in a hex planter with LED ring); *Magnetbahn* (elevated box beam on pylons at the rim, glow capsule passing every 20 s); *Wohnturm* (rounded box stack with random lit windows).
- **Basis:** *Zeitenwacht-Zentrale* - white rounded tower with glass dome and solar roof; the flame is a contained warm-orange energy core in the dome (the only warm light in the scene, so the eye always finds it).
- **Partikel:** fireflies return (callback to age 1), slow data-light motes rising from the path lines, distant delivery drones as blinking dots.
- **Musik:** 126 BPM, F# minor pentatonic with Lydian colour, soft saw pads, arpeggiated pulse, sub bass, gentle side-chain pump; the age-1 flute motif returns as a synth lead.

**Bosswellen in jedem Zeitalter:** dasselbe Thema, etwas schneller, zusätzliche Schlagwerk-Schicht.

## 4 Türme

**Gemeinsame Bauregeln.** Jeder Turm steht auf einem Sockel von etwa 0,8 Feldern im Material seines Zeitalters. Die Rollenfarbe
erscheint als Band am Sockel und an einem von oben gut sichtbaren Akzent (Fahne, Dachkante, Leuchtstreifen), dazu 1 bis 3 Stufenpunkte.
Kostüme und Bauten selbst bleiben in den Farben ihres Zeitalters. Stufe 2 fügt eine Sockellage und ein zweites Farbband hinzu,
Stufe 3 ein eigenes Teil, das zur Besonderheit der Stufe passt. Türme sind höchstens etwa 1,8 Felder hoch.
In einem Zeitalter gibt es nie zwei Türme derselben Bauart (keine zwei Katapulte, keine zwei Kanonen) für verschiedene Rollen:
Die Silhouettenklasse der Rolle (Tabelle in 2.2) entscheidet.

### 4.2 Schütze (aim part yaws to target)

- **Steinzeit - Steinschleuderer.** Fieldstone plinth, low rock; fur-clad figure (brown box torso, sphere head, 2 leg cylinders, blue feather in hair), `armR` holds a sling (thin cylinder + pebble sphere). Whole figure yaws; sling arm spins a full circle before each shot. *Angriff:* grey pebble on a flat fast arc, dust puff on hit. *L2:* higher rock, bone necklace, ammo pouch. *L3:* slings in both arms (double shot), blue war paint, small hide awning.
- **Rom - Bogenschütze.** Wooden watch platform on 4 posts with railing; archer in white tunic with blue sash, leather cap, bow (torus arc), quiver box. Upper body yaws, bow arm draws back and snaps. *Angriff:* thin arrow with white fletching, straight and fast, sticks in the target 0.3 s. *L2:* row of blue shields on the railing. *L3:* tiled roof and a second archer (double shot).
- **Mittelalter - Armbrustschütze.** Round stone turret (cylinder) with crenel boxes; figure behind a blue pavise shield holding a crossbow (T of two boxes); crossbow kicks back. *Angriff:* short thick bolt with a faint white streak. *L2:* taller turret, blue banner. *L3:* wooden hoarding with cone roof, second crossbow.
- **Entdecker - Musketier.** Ring of wicker gabions (cylinders), small striped sentry box; figure in blue coat with tricorne (flattened prism), long musket (thin cylinder). Figure yaws, musket recoils, figure leans back. *Angriff:* hitscan; glow muzzle cone, white smoke puff, 50 ms tracer line. *L2:* flag on the sentry box, powder kegs. *L3:* second kneeling musketeer, alternating volley.
- **Industrie - Kurbelgeschütz.** Riveted iron drum as plinth; brass six-barrel bundle with a hand crank behind a green enamel gun shield, gunner with flat cap. `turret` (bundle + shield) yaws, the bundle spins while firing and the crank turns. *Angriff:* hitscan volley of short yellow tracer dashes, small smoke puffs. *L2:* ammunition hopper on top. *L3:* twin bundles, copper trim.
- **Zukunft - Laserturm.** White hex plinth with blue glow ring; ball turret (sphere) on a short neck, lens barrel (cylinder + glow disc), 2 cooling fins. Turret yaws and pitches smoothly, lens brightens before firing. *Angriff:* thin blue beam pulse 80 ms (hitscan), glow dot on the target. *L2:* taller neck, second lens ring. *L3:* rotating triple-lens cluster with a small orbiting ring.

### 4.3 Werfer (arm/barrel recoils, whole machine hops slightly on fire)

- **Steinzeit - Felswerfer.** Log frame with a seesaw lever (long cylinder on a forked post), leaf basket, orange-painted counter stone, boulder pile beside it. Lever swings up. *Angriff:* boulder in a high arc with ground shadow, lands with dust ring and 1 s crack decal. *L2:* rope bindings (torus), bigger basket. *L3:* double lever, mammoth-skull ornament.
- **Rom - Onager.** Timber frame on 4 small wheels, torsion bundle (cylinder) across, throwing arm with cup, padded stop beam, orange shield on the front. Arm snaps forward against the beam. *Angriff:* clay pot in an arc, bursts into shards and dust. *L2:* bronze fittings, orange pennant. *L3:* longer arm, smoking fire pots as ammo.
- **Mittelalter - Tribock.** Tall A-frame of 4 angled beams on a turntable, long arm, hanging counterweight box (separate swinging part), sling. Arm rotates about 120 deg, counterweight swings through. *Angriff:* big stone ball, very high arc, heavy thud and dust ring. *L2:* iron bands, orange flags. *L3:* taller frame and a treadwheel that spins while reloading.
- **Entdecker - Mörser.** Squat bronze barrel (short wide cylinder) angled 60 deg on a timber bed inside an earth ring, pyramid of bombs. Barrel recoils into the bed. *Angriff:* black bomb with sparkling glow fuse, orange-white flash sphere and smoke ring. *L2:* reinforcing rings, orange stripe. *L3:* wider bore, gabion wall.
- **Industrie - Dampfmörser.** Fat cast-iron barrel at 50 deg on a brick-and-timber bed with brass rings, a small steam boiler with pressure gauge beside it, pyramid of bombs. Barrel recoils into the bed, a valve puffs steam. *Angriff:* black bomb with glowing fuse in a high arc; orange blast and smoke ring. *L2:* longer barrel, brass elevation wheel. *L3:* twin barrels, copper bands.
- **Zukunft - Raketenwerfer.** Hex plinth, yoke with a tilting launcher pod of 2x2 dark tubes with orange glow caps, small spinning radar dish. Pod yaws and tilts. *Angriff:* guided rocket with glow exhaust and curved smoke trail, orange-teal blast ring. *L2:* 2x3 tubes. *L3:* twin pods, two staggered rockets per salvo.

### 4.4 Bremser (always a glossy puddle in the age's colour; slowed enemies show drips on their feet and a slowed walk cycle)

- **Steinzeit - Harzschleuder.** Hollow tree stump filled with glossy amber resin (flattened sphere), bent sapling arm with leaf cup that whips forward. *Angriff:* amber blob in an arc, amber puddle disc. *L2:* second stump. *L3:* larger cup, beehive decoration.
- **Rom - Ölamphoren-Werfer.** Stone base with a rack of amphorae (lathe), figure in turquoise tunic hurling amphorae overhead (both arms swing). *Angriff:* tumbling amphora that shatters into terracotta chips, yellow-green olive-oil puddle. *L2:* awning, more amphorae. *L3:* small wooden throwing arm replaces the hand throw.
- **Mittelalter - Pechsieder.** Black iron cauldron (half sphere) on a stone hearth with fire glow, wooden crane arm with ladle that swings and flings, bubble particles. *Angriff:* black pitch glob with smoke wisp, black puddle with slow bubbles. *L2:* bigger cauldron, bellows. *L3:* twin ladles, chimney hood.
- **Entdecker - Sirupfass.** Giant molasses barrel lying on a cradle, brass tap, hand pump with rocking lever, swivelling brass nozzle (aims). *Angriff:* arc of 5 dark-amber droplets, red-brown puddle with sugar sparkle. *L2:* second stacked barrel. *L3:* copper kettle, dual nozzle.
- **Industrie - Ölpumpe.** Small pumpjack (walking beam on A-frame, nodding continuously), tank cylinder with turquoise band, swivelling nozzle pipe. *Angriff:* black oil jet, iridescent black puddle (purple-teal vertex tint). *L2:* second tank. *L3:* pressure dome, double nozzle.
- **Zukunft - Klebeschaum-Werfer.** White hex plinth, pressure-tank sphere with teal glow gauge, short wide nozzle turret, hose arcs (torus segments). *Angriff:* white-teal foam glob that expands into a patch of 6 growing spheres, then shrinks. *L2:* twin tanks. *L3:* rotating triple nozzle.

### 4.5 Panzerknacker (longest barrel on the field; visible wind-up before each shot so the big hit is anticipated)

- **Steinzeit - Speerschleuder.** Hunter figure on a log-and-bone stand holding an atlatl stick with a long spear, rack of spare spears tied with violet feathers. Throwing arm whips forward, body leans in. *Angriff:* long spear, flat and fast with slight wobble, sticks in the target 0.4 s with a "thock". *L2:* tusk frame, longer spears. *L3:* antler headdress, giant spear that passes through.
- **Rom - Skorpion.** Bolt thrower on a post: horizontal stock box, 2 upright torsion cylinders, 2 bow arms that snap, crank, crouching operator with violet crest. Upper part yaws and pitches. *Angriff:* iron bolt with thin white streak, spark and "kling" on armour. *L2:* bronze front plate. *L3:* bigger arms, eagle emblem.
- **Mittelalter - Balliste.** Wheeled timber carriage, large horizontal bow (bent box arms and string), winch drum that spins while reloading, violet pennon. *Angriff:* log-sized bolt with iron head, heavy streak. *L2:* iron-clad bow. *L3:* double winch and a mantlet shield.
- **Entdecker - Feldschlange.** Very long slim bronze barrel with muzzle rings (torus) on a high 2-wheel carriage, gunner in violet coat with linstock. Whole carriage rolls back 0.2 tiles on recoil and returns. *Angriff:* near-instant iron ball: flash, smoke, white streak, impact spark. *L2:* ornate handles, violet flag. *L3:* longer barrel, ammunition limber.
- **Industrie - Stahlkanone.** Pedestal mount with gun shield, very long steel barrel with a recoil cylinder underneath, brass sighting telescope, gunner seat. Long recoil slide. *Angriff:* hitscan violet-white tracer, shock ring at the muzzle. *L2:* longer barrel with muzzle rings. *L3:* armoured cupola housing.
- **Zukunft - Schienenkanone.** Hex plinth, slim turret with 2 long parallel rails (boxes) and violet glow between them, rear capacitor cylinders that light up one by one while charging. Rails recoil slightly. *Angriff:* instant violet line that lingers and fades over 300 ms with ring puffs along it. *L2:* third capacitor pair. *L3:* longer rails, stabiliser legs.

### 4.6 Brenner (nozzle yaws; cone is drawn as glow cones plus particles; burning enemies carry a small flame on top and an orange tint)

- **Steinzeit - Glutbläser.** Stone fire bowl with glowing embers, figure with a long hollow reed who leans forward and blows. *Angriff:* cone of orange sparks. *L2:* bigger bowl, hide bellows. *L3:* second blower, red handprint paint, wider cone.
- **Rom - Glutpfanne.** Bronze brazier on a tripod, large leather bellows (wedge box that visibly squeezes) with a nozzle. *Angriff:* cone of flame tongues (scaling glow cones) and embers. *L2:* second bellows. *L3:* lion-head nozzle.
- **Mittelalter - Feuersiphon.** Bronze tank on masonry, rocking pump lever, long tube with dragon-head nozzle. *Angriff:* stream of liquid fire (stretched glow particles, slight arc), small burning flecks on the ground. *L2:* larger tank, red banner. *L3:* twin dragon heads.
- **Entdecker - Feuerwerker.** Brass-bound box with 5 short tubes in a fan, figure in red coat with a slow match. *Angriff:* crackling fan of red/gold/white sparks with tiny star pops (the prettiest attack in the game). *L2:* 7 tubes. *L3:* spinning pinwheel (torus) on top throwing sparks.
- **Industrie - Gasbrenner.** Two brass gas cylinders with a pressure gauge, a copper pipe arc, swivelling burner nozzle with a blue pilot flame and a small shield. *Angriff:* roaring orange flame cone ending in a wisp of smoke. *L2:* third cylinder. *L3:* twin nozzle.
- **Zukunft - Plasmabrenner.** Hex plinth, emitter head with 3 prongs around a red-magenta glow core, stack of cooling rings (torus) that glow hotter while firing. *Angriff:* continuous fan-shaped plasma beam (translucent glow wedge with shimmering edge). *L2:* second cooling stack. *L3:* double emitter.

### 4.7 Taktgeber (acts on the music's beat: a gold pulse ring reaches the 8 neighbours; buffed towers show a gold chevron and a faint dotted gold link line)

- **Steinzeit - Trommler.** Tall hide drum (cylinder) on a stand under a totem pole topped with a gold sun disc; drummer figure hits with alternating arms on the beat. *L2:* second drum. *L3:* winged totem with feathers.
- **Rom - Feldzeichen.** Stone podium, tall pole with gold eagle (sphere body, wing boxes) and red cloth; horn blower with a big circular horn (torus) raises it every 4 beats. *L2:* laurel wreath, second standard. *L3:* larger eagle with spread wings, 2 torches.
- **Mittelalter - Glockenturm.** Slender timber bell tower with open belfry, gold bell (lathe) swinging on the beat, shingled spire. *L2:* stone lower storey. *L3:* second bell, spinning gold weathercock.
- **Entdecker - Signalmast.** Ship's mast with crow's nest, yard arm with a row of fluttering signal flags, lookout with gold telescope panning. *L2:* second yard, lantern. *L3:* moving semaphore arms, gold crown.
- **Industrie - Telegrafenmast.** Tall wooden mast with cross arms and white porcelain insulators, a gold bell-shaped sounder on top, small lit operator hut at the foot; gold dots travel along thin wires towards the neighbours on the beat. *L2:* taller mast, second cross arm. *L3:* brass semaphore arms that swing.
- **Zukunft - Leitrechner.** Hex plinth, slim server pillar with gold glow seams, floating rotating holo ring (torus), small relay drone orbiting; thin gold link beams with data dots. *L2:* counter-rotating second ring. *L3:* 3 rings as a gyroscope, 2 drones.


## 5 Gegner

**Gemeinsame Regeln.** Regeln der Eigenschaften siehe 2.3. Jeder Gegner bekommt in den Daten eine Hauptfarbe für seinen Zeitsand.
Endbosse sind immer Bodengegner und als EIN starrer Körper gebaut (höchstens etwa 0,9 Felder breit und 1,4 lang). Der
Zwischenboss der Entdecker (Käpt'n Flint, ein Riesenpapagei) fliegt. Entdecker, Industrie und Zukunft sind drei Flieger-Zeitalter in Folge.

| Zeitalter | Neue Eigenschaft | Antwort |
|---|---|---|
| Steinzeit | schnell, Schwarm, zäh | Schütze / Werfer / Bremser, Panzerknacker |
| Rom | gepanzert | Panzerknacker, Brenner |
| Mittelalter | Heiler | Panzerknacker auf „Stärkster“, Brenner, Flächenschaden |
| Entdecker | fliegend (das erste Zeitalter mit Fliegern) | Schütze, Panzerknacker, Flak (drei Schützen), Frostpuls einer Bremser-Superwaffe; der Werfer trifft keine Flieger |
| Industrie | Träger; zähe Flieger (Ballons, 2 Funken) | Werfer und Brenner am Wrack; Panzerknacker, Flak, Schütze, Frostpuls und die Rezepte Dampfkessel, Kommandoposten, Brennglas gegen Ballons |
| Zukunft | Schild | Brenner hält den Schild unten, dann Panzerknacker |

### 5.1 Steinzeit
- `keule` **Keulenschwinger** - Standard. HP 1, Tempo 1, Rüstung 0, 1 Funke. Stocky fur-brown box torso, sphere head with dark hair cap, 2 legs, 2 arms, club (tapered cylinder) on the shoulder; waddling walk, club bobs. *Konter:* Schütze.
- `wolf` **Wolf** - schnell. HP 0.6, Tempo 1.8, 1 Funke. Low grey box body, wedge head, 2 triangle ears, 4 short legs galloping in pairs, tail cone; body pitches with each bound. *Konter:* Bremser + Schütze.
- `frischling` **Frischling** - Schwarm (packs of 8-12). HP 0.3, Tempo 1.3, 1 Funke. Small squashed sphere with brown-cream stripes (vertex colours), snout cylinder, 4 stub legs scuttling, flapping ears; hops. *Konter:* Werfer, Brenner.
- `nashorn` **Wollnashorn** - zäh. HP 5, Tempo 0.65, 2 Funken. Big rounded shaggy box body, hump sphere, lowered head with 2 horn cones, 4 thick legs; slow stomp with dust puffs. *Konter:* Panzerknacker, Bremser to keep it in range.
- `mammut` **Boss: Das Alte Mammut** - Boss. HP 40, Tempo 0.5, 10 Funken. Huge dark-brown dome body, head sphere, trunk of 3 swaying cylinder segments, 2 big curved ivory tusks, flapping ear slabs, 4 column legs; every step shakes the camera by 1 px and thumps. Pure HP check on purpose (first boss). *Konter:* Panzerknacker, everything else.
### 5.2 Römisches Reich
The player's Roman towers are red and gold. The Feuerdiebe of this age are a renegade legion in **dark green (#2F6B4F) and bronze**: read every "red" below as dark green.
- `plaenkler` **Plänkler** - Standard. HP 1, Tempo 1.1, 1 Funke. Beige tunic, leather cap, small round shield (disc), javelin; light jog. *Konter:* Schütze, Werfer.
- `reiter` **Reiter** - schnell. HP 0.8, Tempo 1.9, 1 Funke. Horse (box body, angled neck, wedge head, 4 galloping legs, tail) with a rider torso and fluttering red cape. *Konter:* Bremser + Schütze.
- `legionaer` **Legionär** - gepanzert. HP 1.4, Tempo 0.9, Rüstung 1, 1 Funke. Red tunic, silver segmented torso box, tall red curved shield in front, half-sphere helmet with red crest, pilum; marches in step in 2x3 blocks. *Konter:* Panzerknacker, Brenner, Werfer on the block.
- `testudo` **Schildkröten-Trupp** - gepanzert, zäh. HP 5, Tempo 0.6, Rüstung 2, 3 Funken. One 2x2 formation as a single unit: shell of 9 overlapping red shield boxes (roof + sides), 8 shuffling feet below (2 animated leg groups), shields rattle when hit. *Konter:* Panzerknacker, Brenner.
- `feldherr` **Boss: Feldherr im Triumphwagen** - Boss, gepanzert. HP 30, Tempo 0.6, Rüstung 1, 10 Funken. Gold chariot (half-cylinder shell, 2 spoked wheels spinning), 2 white galloping horses, general with gold cuirass, laurel wreath (torus) and a red cloak that flutters. *Konter:* Panzerknacker, Brenner, Bremser.
### 5.3 Mittelalter
- `knecht` **Fußknecht** - Standard. HP 1, Tempo 1, 1 Funke. Grey-blue padded torso, kettle hat (disc + half sphere), spear, small pack. *Konter:* Schütze, Werfer.
- `strauchdieb` **Strauchdieb** - schnell. HP 0.6, Tempo 2.0, 1 Funke. Green cloak with cone hood, loot sack (sphere) on the back, leans far forward, sways left-right while running. *Konter:* Bremser + Schütze.
- `ritter` **Ritter** - gepanzert. HP 2.2, Tempo 0.75, Rüstung 2, 2 Funken. Steel-grey box torso, great helm (cylinder with slit) and plume cone, kite shield (extruded shape), sword; heavy stomping walk. *Konter:* Panzerknacker, Brenner.
- `spielmann` **Spielmann** - Heiler. HP 1.2, Tempo 1, 1 Funke. Red-yellow halved costume, feathered cap, lute (half sphere + neck cylinder); strumming arm, skipping walk, green notes rise, heal ring pulses on the beat. *Konter:* Panzerknacker, Werfer.
- `schwarzritter` **Boss: Der Schwarze Ritter** - Boss, gepanzert. HP 32, Tempo 0.55, Rüstung 2, 10 Funken. Huge black armoured horse with purple caparison (box skirt), rider with long lance (cone) and tall plume. At 50 % HP the horse rears (1 s telegraph) and gallops at Tempo 1.2 for 3 s. *Konter:* Panzerknacker, Brenner, a Pfütze saved for the gallop.
### 5.4 Zeitalter der Entdecker
- `pirat` **Pirat** - Standard. HP 1, Tempo 1, 1 Funke. Striped shirt (vertex stripes), red bandana (half sphere), cutlass (thin curved box), one peg leg (thinner cylinder) giving a limp. *Konter:* Schütze, Werfer.
- `aeffchen` **Äffchen** - schnell, Schwarm (packs of 6-10). HP 0.4, Tempo 1.9, 1 Funke. Tiny brown monkey on all fours, curled tail (torus arc), wearing a stolen tricorne; bounding run. *Konter:* Werfer, Brenner, Bremser.
- `kuerassier` **Kürassier** - gepanzert, schnell. HP 1.8, Tempo 1.4, Rüstung 1.5, 2 Funken. Horse and rider with shiny breastplate (bright grey box), crested helmet, raised sabre. *Konter:* Bremser + Panzerknacker, Brenner.
- `papagei` **Beutepapagei** - fliegend. HP 1.2 (Entwurf 1.4; gesenkt, weil die Papageien das erste Flieger-Zeitalter allein trugen), Tempo 1.3, 1 Funke. Big scarlet-and-blue parrot: ellipsoid body, sphere head with yellow hooked beak cone, two flapping wing slabs, long tail prism; a small loot sack hangs from its claws; bobs with every wing beat. *Konter:* Schütze, Panzerknacker.
- `landgaleone` **Boss: Die Landgaleone** - Boss, gepanzert, Träger. HP 34, Tempo 0.5, Rüstung 1, 10 Funken. Bei 85, 60 und 35 % flattern je 3 Beutepapageien aus der Takelage. Ship hull (extruded shape) on 6 wheels, 2 masts with billowing curved sails, pirate flag, captain with big hat and telescope at the bow; rocks side to side as if on waves, gun ports puff harmless smoke. *Konter:* Panzerknacker, Brenner; Schütze and Flak for the parrots.
### 5.5 Industriezeitalter
- `halunke` **Halunke** - Standard. HP 1, Tempo 1, 1 Funke. Stocky rogue with bowler hat (cylinder + brim disc), striped waistcoat (vertex stripes), black eye mask and a loot sack over the shoulder; sneaky tiptoe walk. *Konter:* Schütze, Werfer.
- `hochrad` **Hochradfahrer** - schnell. HP 0.6, Tempo 2.1, 1 Funke. Penny-farthing: huge front wheel (torus with 4 spoke boxes, spinning), tiny rear wheel, gentleman in top hat with trailing scarf leaning forward; wobbles. *Konter:* Bremser + Schütze.
- `ballon` **Heißluftballon** - fliegend, zäh. HP 3, Tempo 0.7, 2 Funken. Large lathe-profile envelope in red-cream stripes, basket box on 4 thick ropes with two bowler hats peeking out, flickering burner glow; sways and bobs. *Konter:* Panzerknacker, Schütze.
- `dampfwagen` **Dampfwagen** - Träger (4 Halunken), gepanzert. HP 4, Tempo 0.8, Rüstung 1, 2 Funken. Riveted iron box on 4 big spoked wheels (spinning), boiler cylinder in front, puffing chimney, brass trim; when destroyed the roof pops off and 4 Halunken hop out. *Konter:* Panzerknacker early, Werfer/Brenner where it will break.
- `berta` **Boss: Dampflok „Schwarze Berta“** - Boss, gepanzert, Träger. HP 36, Tempo 0.45, Rüstung 2, 10 Funken. Black-green locomotive with a short tender as ONE rigid body (at most 0.9 wide, 1.4 long): boiler cylinder, cab box, red cow-catcher wedge, 6 wheels with a moving coupling rod, brass dome, smokestack with steam, brass whistle. Whistles on entry; at 50 % HP it lets off steam and drops 4 Halunken; 6 more hop out when it is destroyed. *Konter:* Panzerknacker, Brenner, Werfer for the crew.
### 5.6 Nahe Zukunft
- `wachroboter` **Wachroboter** - Standard. HP 1, Tempo 1, 1 Funke. White rounded-box torso, cyan glow visor strip, thin limbs with sphere joints; stiff, precise walk. *Konter:* Schütze, Werfer.
- `roboterhund` **Roboterhund** - schnell. HP 0.7, Tempo 2.1, 1 Funke. Flat yellow-black box body, 4 backward-bent legs in a trot, sensor head with one glow eye. *Konter:* Bremser + Schütze.
- `drohne` **Drohnenschwarm** - fliegend, Schwarm (packs of 10-16). HP 0.3, Tempo 1.5, 1 Funke. Flat X of 2 boxes, 4 spinning rotor discs, red glow LED underneath; loose V formation, high buzz. *Konter:* Schütze (Laserturm), supported by Taktgeber.
- `schildwagen` **Schildwagen** - Schild, zäh. HP 4 (+2 Schild), Tempo 0.7, Rüstung 1, 2 Funken. Six-wheeled driverless wedge vehicle in dark grey, sensor mast, translucent cyan hex dome (glow sphere). *Konter:* Brenner to hold the shield down, then Panzerknacker.
- `goliath` **Boss: Goliath-Konvoi** - Boss, Schild, Träger. HP 40 (+10 Schild), Tempo 0.45, Rüstung 1, 10 Funken. Autonomous heavy hauler as ONE rigid body (at most 0.9 wide, 1.4 long): cab with sensor dome and teal glow strips, a container section whose roof hatches flip open at 75 / 50 / 25 % HP to release 6 Drohnen each, all under a large shield dome. The exam for everything learned: shield, armour, carrier, air. *Konter:* Brenner + Bremser at one kill zone, Panzerknacker, Schütze against the drones.

**Zwischenbosse** (Welle 5 jedes aktiven Zeitalters, in Welle 10 noch einmal als Geleit des Bosses): Boss ohne eigenes
Modell. Er trägt das Modell eines Gegners seines Zeitalters in 1,6- bis 1,7-facher Größe, hat den großen Lebensbalken, wird
von Pfütze und Glocke nur halb gebremst, kostet 5 Funken und bringt 8 x G.

| Zeitalter | Kennung | Name | Modell von | Werte |
|---|---|---|---|---|
| Steinzeit | `leitwolf` | Der Leitwolf | Wolf | HP 12, Tempo 1,35, schnell; kommt mit seinem Rudel |
| Rom | `zenturio` | Der Zenturio | Legionär | HP 12, Tempo 0,85, Rüstung 1,5; treibt Legionäre vor sich her |
| Mittelalter | `raubritter` | Der Raubritter | Ritter | HP 13, Tempo 0,8, Rüstung 2; Spielleute heilen ihn |
| Entdecker | `flint` | Käpt'n Flint | Beutepapagei | HP 12, Tempo 0,8, fliegend: nur was in die Luft reicht, holt ihn herunter |
| Industrie | `kohlenbaron` | Der Kohlenbaron | Dampfwagen (x1,65) | HP 12, Tempo 0,75, Rüstung 1,5, Träger: bei 50 % springen 3 Hochradfahrer ab, beim Zerbrechen steigen 4 Halunken aus |
| Zukunft | `prototyp` | Prototyp X-1 | Schildwagen | HP 12 (+6 Schild), Tempo 0,75, Rüstung 1 |

**Angekündigte Boss-Momente** (alles andere sind reine Werte): Der Schwarze Ritter bäumt sich bei 50 % auf und galoppiert 3 s mit
doppeltem Tempo. Schwarze Berta lässt bei 50 % Dampf ab und setzt 4 Halunken aus (der Kohlenbaron als Zwischenboss bei 50 % 3 Hochradfahrer). Der Goliath-Konvoi entlässt bei 75, 50 und 25 %
je 6 Drohnen. Die Landgaleone lässt bei 85, 60 und 35 % je 3 Beutepapageien frei (früher als der Goliath, damit sie nicht erst
kurz vor der Flamme aufsteigen). Mammut und Feldherr haben keinen Sondermoment.

## 6 Wellen

Jedes aktive Zeitalter hat zehn Wellen im selben Rhythmus. Seit dem 10.11.2026 abends (Rückmeldung des Spielers: „Knifflig
ohne Funkenverlust“) gilt: Nur Welle 1 ist zum Durchatmen; Welle 5 bringt einen **Zwischenboss**, die Wellen 4, 7, 8 und 9
haben Elitedruck (starke Einzelne mit Geleit, dichtere Schübe, Mischungen wie Rüstung plus Tempo, Heiler hinter Panzern,
Luft und Boden zugleich), und in Welle 10 kommt der Zwischenboss als Geleit des Bosses wieder.

| Platz | Name | Idee | Druck gemessen am Gold des Spielers |
|---|---|---|---|
| 1 | Durchatmen | Standardgegner und ein paar Schnelle im neuen Gewand; Zeit zum Modernisieren | 40 % |
| 2 | Neuheit | die neue Eigenschaft des Zeitalters, fast allein, gemächlich | 55 % |
| 3 | Tempo | Schnelle und Schwärme in zwei Schüben | 45 % |
| 4 | Brocken | wenige, zähe, gepanzerte Gegner | 60 % |
| 5 | Mischung | von allem etwas, dazu der Zwischenboss mit Geleit | 75 % |
| 6 | Elite | wie ein Zwischenboss, aber ohne Bossmodell: wenige starke Gegner mit Geleit | 75 % |
| 7 | Tempo II / Luft | ein Strom oder viele Schübe von Schnellen; in der Zukunft vier Drohnenschwärme | 60 % |
| 8 | Brocken II | eine dichte Kolonne der Zähen | 80 % |
| 9 | Ansturm | alles gemischt, die dichteste Welle mit den meisten Gegnern | 95 % |
| 10 | Boss | der Boss mit passender Eskorte | 100 % |

Der Druck ist ein Richtwert (Lebenspunkte mit Zuschlägen für Rüstung und Tempo, geteilt durch das bis dahin verdiente Gold;
100 % = Bosswelle). In der Steinzeit liegen die Wellen 1 bis 5 höher (85 bis 95 %), weil das Startgold knapp ist und jede Welle
eine neue Rolle freischaltet. Eine Welle erscheint über 25 bis 45 Sekunden. Eine neue Eigenschaft taucht nie erst nach Platz 4 auf.
Benachbarte Wellen unterscheiden sich in Zusammensetzung und Takt (Strom, Schübe, Kolonne, Geleitzug). Nichts im Code setzt eine
Wellenzahl voraus.

| Welle | Zusammensetzung | Lernziel |
|---|---|---|
| 1 | 10 Keulenschwinger, einer alle 1,6 s | bauen, zusehen, verdienen (nur der Schütze ist da) |
| 2 | 8 Keulenschwinger, dann 2 Rudel zu 10 Frischlingen | „viele Kleine: Werfer“ |
| 3 | 12 Keulenschwinger, dazwischen 8 Wölfe paarweise | Wölfe sind zu schnell, bis sie kleben: Bremser |
| 4 | 4 Wollnashörner mit je 2 Wölfen, 10 Keulenschwinger | großes Ziel, großer Treffer: Panzerknacker |
| 5 | 12 Frischlinge, 10 Keulenschwinger, **Der Leitwolf** mit 8 Wölfen | Feuer auf die Menge: Brenner; erster Zwischenboss |
| 6 | 3 Nashorn-Paare mit je 4 Wölfen als Geleit, 8 Keulenschwinger | Elite; Taktgeber |
| 7 | 30 Wölfe in 3 Rudeln, 3 Rudel zu 8 Frischlingen, 2 Wollnashörner | Tempo: Pfütze plus Fläche |
| 8 | 10 Wollnashörner als Herde, 10 Keulenschwinger | Brocken: Zeit für Stufe 3 und die Wahl des Zweigs |
| 9 | 20 Keulenschwinger, 32 Frischlinge, 18 Wölfe, 6 Wollnashörner | Ansturm |
| 10 | 3 Wollnashörner, **Das Alte Mammut**, 2 Leitwölfe, 8 Wölfe, 12 Frischlinge | erster Boss |
| 11 | 14 Plänkler, 6 Reiter | Durchatmen im neuen Licht; modernisieren |
| 12 | 3 Blöcke zu 6 Legionären, 6 Plänkler | Rüstung: alte Steinschleuderer prallen ab |
| 13 | 12 Reiter in 2 Schüben, 10 Plänkler | Tempoprobe für den Bremser |
| 14 | 3 Schildkröten-Trupps, 8 Legionäre, 6 Reiter | schwere Rüstung plus Tempo |
| 15 | 12 Plänkler, 6 Legionäre, **Der Zenturio**, 4 Reiter, 1 Schildkröten-Trupp | Zwischenboss |
| 16 | 4 Schildkröten-Trupps mit je 4 Legionären als Leibwache | Elite: Brand und Panzerknacker |
| 17 | 24 Reiter als Strom, 2 Trupps zu 8 Plänklern, 6 Legionäre | Tempo ohne Atempause, mit Rüstung |
| 18 | 6 Schildkröten-Trupps als Kolonne, 12 Legionäre | Brocken; erste Superwaffen |
| 19 | 18 Plänkler, 18 Legionäre in 3 Blöcken, 14 Reiter, 3 Schildkröten-Trupps | Ansturm |
| 20 | 2 Blöcke Legionäre, **Feldherr im Triumphwagen**, 2 Zenturionen, 10 Reiter | Boss |
| 21 | 16 Fußknechte, 6 Strauchdiebe | Durchatmen zur Mittagszeit |
| 22 | 3 Gruppen zu 6 Fußknechten mit je 1 Spielmann | Heiler: zuerst den Spielmann |
| 23 | 16 Strauchdiebe in 2 Schüben, 8 Fußknechte | Tempo |
| 24 | 5 Ritter, 3 Spielleute dahinter, 8 Fußknechte | Heiler hinter Panzern |
| 25 | 12 Fußknechte, 8 Strauchdiebe, 2 Ritter, **Der Raubritter** mit 2 Spielleuten | Zwischenboss, geheilt |
| 26 | 4 Lanzen aus je 2 Rittern, 1 Spielmann und 2 Fußknechten | Elite: Panzerknacker auf „Stärkster“ |
| 27 | 3 Banden zu 8 Strauchdieben, 14 Fußknechte, 3 Ritter | Tempo mit Rüstung |
| 28 | 9 Ritter als Kolonne, 3 Spielleute, 4 Fußknechte | Brocken mit Heilung |
| 29 | 20 Fußknechte, 8 Ritter, 5 Spielleute, 16 Strauchdiebe | Ansturm |
| 30 | 4 Ritter, **Der Schwarze Ritter**, 2 Spielleute, der Raubritter, 10 Strauchdiebe | Boss mit Galopp |
| 31 | 16 Piraten, 2 Rudel zu 6 Äffchen | Durchatmen am Nachmittag; modernisieren |
| 32 | 8 Beutepapageien einzeln, 12 Piraten | Flieger auf der Luftlinie: Schütze, Panzerknacker (der Werfer trifft sie nicht) |
| 33 | 3 Rudel zu 10 Äffchen, 8 Piraten, 4 Beutepapageien | Tempo im Schwarm |
| 34 | 8 Kürassiere als Schwadron, 6 Beutepapageien, 8 Piraten | Rüstung im Galopp: erst kleben lassen, dann knacken |
| 35 | 12 Piraten, 12 Äffchen, **Käpt'n Flint** mit 6 Beutepapageien, 3 Kürassiere | fliegender Zwischenboss |
| 36 | 3 Schwadronen zu 3 Kürassieren, über jeder 4 Beutepapageien, 6 Piraten | Elite: Boden und Luft zugleich |
| 37 | 4 Schwärme zu 5 Beutepapageien, 2 Rudel zu 10 Äffchen, 6 Piraten | Luft: Zeit für die Flak |
| 38 | 12 Kürassiere als Kolonne, 10 Piraten, 6 Beutepapageien | Brocken: bremsen, dann Wucht |
| 39 | 22 Piraten, 3 Rudel zu 8 Äffchen, 8 Kürassiere, 10 Beutepapageien | Ansturm |
| 40 | 4 Kürassiere, **Die Landgaleone** (lässt 9 Papageien frei), Käpt'n Flint, 8 Piraten, 12 Äffchen | Boss, Träger |
| 41 | 16 Halunken, 2 Pulks zu 3 Hochradfahrern | Durchatmen in der Abenddämmerung; modernisieren |
| 42 | 3 Dampfwagen weit auseinander, 6 Halunken | Träger: Wo der Wagen zerbricht, steigen 4 Halunken aus; dort muss Fläche warten |
| 43 | 2 Pulks zu 7 Hochradfahrern, 8 Halunken, 3 Heißluftballons | Tempo; die ersten Ballons (zäh, 2 Funken) |
| 44 | 3 Dampfwagen, 3 Heißluftballons, 6 Hochradfahrer | Brocken: knacken, dann die Fahrgäste im Feuer empfangen |
| 45 | 10 Halunken, 6 Hochradfahrer, **Der Kohlenbaron**, 1 Dampfwagen, 3 Heißluftballons | Zwischenboss, Träger |
| 46 | 2 Geleitzüge aus je 2 Dampfwagen, 2 Ballons und 3 Hochradfahrern | Elite: Boden und Luft zugleich |
| 47 | 5 Paare Heißluftballons, 2 Pulks zu 8 Hochradfahrern, 6 Halunken | Luft: Panzerknacker und Flak |
| 48 | 5 Dampfwagen als Kolonne, 3 Heißluftballons, 6 Halunken | Brocken II: das Feuer wartet am Wrack |
| 49 | 20 Halunken, 14 Hochradfahrer, 3 Dampfwagen, 5 Heißluftballons | Ansturm |
| 50 | 2 Dampfwagen, **Schwarze Berta** (4 Halunken bei 50 %, 6 am Ende), der Kohlenbaron, 3 Ballons, 10 Hochradfahrer | Boss, Träger |
| 51 | 20 Wachroboter, 10 Roboterhunde | Durchatmen in der Nacht |
| 52 | 5 Schildwagen, 12 Wachroboter | Schild: lädt nach, wenn man aufhört zu treffen |
| 53 | 2 Drohnenschwärme zu 16, 14 Roboterhunde | Luftschwarm und Tempo am Boden zugleich |
| 54 | 6 Schildwagen unter 14 Drohnen, 8 Wachroboter | Dauerschaden und Luftabwehr zugleich |
| 55 | 14 Wachroboter, 3 Schildwagen, **Prototyp X-1**, 8 Roboterhunde, 12 Drohnen | Zwischenboss |
| 56 | 2 Geleitzüge aus je 4 Schildwagen, 4 Roboterhunden und 12 Drohnen | Elite: Boden und Luft zugleich |
| 57 | 5 Drohnenschwärme zu 12, 12 Roboterhunde | Luft: nur Schütze und Panzerknacker reichen hinauf |
| 58 | 9 Schildwagen als Konvoi, 8 Wachroboter, 12 Drohnen | Brocken: Brand hält die Blasen unten |
| 59 | 22 Wachroboter, 5 Schildwagen, 14 Roboterhunde, 4 Drohnenschwärme zu 12 | die dichteste Welle des Spiels |
| 60 | 3 Schildwagen, **Goliath-Konvoi**, Prototyp X-1, 14 Drohnen, 12 Roboterhunde | Finale |

## 7 Karten

Spielfeld in der Regel 18 x 12 Felder, x von 0 (links) bis 17, z von 0 (oben) bis 11; eine Karte darf kleiner sein (Felsenmeer:
16 x 10). Der Eingang liegt immer ein Feld außerhalb des Spielfelds im Uferstreifen (dort steht das Zeitportal). Die Flamme liegt ein
Feld außerhalb oder mitten im Spielfeld; dann sind ihre acht Nachbarfelder Platz der Basis und nicht bebaubar. Ein Weg darf sich
selbst rechtwinklig kreuzen (beide Durchgänge geradeaus über das Kreuzungsfeld). Wegpunkte sind verbindlich. Die Liste geht von
leicht nach schwer, und jede Beschreibung endet mit „Für den Einstieg.“, „Für Fortgeschrittene.“ oder „Für Könner.“

Maß für die Schwierigkeit ist der Prüfstand (`node tools/balance.mjs`): „Stärke“ = größter Faktor auf die Lebenspunkte der Gegner
auf Normal, mit dem der beste Bot noch gewinnt (Mittel über die Startwerte 7, 11, 13), dazu Siege auf Normal über zehn Startwerte.

1. **Flusstal** (`flusstal`, Einstieg; Stärke 1,07, 10 von 10). Ein S: (−1,2) → (14,2) → (14,6) → (3,6) → (3,10) → (18,10).
   Die Zeilen 4 und 8 liegen zwischen zwei Bahnen, ein Turm deckt dort zwei Durchgänge. Die Luftlinie quert die Mitte. Sehr gutmütig.
2. **Kreuzweg** (`kreuzweg`, Einstieg; Stärke 1,10, 9 von 10). Kurzer Weg mit Schleife, der sich auf (6,6) selbst kreuzt:
   (−1,6) → (12,6) → (12,2) → (6,2) → (6,10) → (18,10). Wer an der Kreuzung steht, hat jeden Gegner zweimal vor sich; Felsen
   an drei der vier Ecken der Kreuzung und ein Teich quer durch die Schleife halten diese Todeszone im Zaum. Offenes Land
   rundherum, die Luftlinie läuft schräg durch den Süden, Flugabwehr findet überall Platz. Entscheidung: alles an die Kreuzung
   oder das Innere der Schleife, das drei Seiten des Weges sieht. Ab dem Mittelalter kommt jeder zweite Feuerdieb durch das
   Nordtor (8,−1) → (8,2) → (6,2) → danach wie oben.
3. **Zwillingsfurt** (`zwillingsfurt`, Fortgeschrittene; Stärke 1,01, 4 von 10). Zwei Tore. Tor A: (−1,1) → (3,1) → (3,4) →
   (7,4) → (7,1) → (10,1) → (10,5) → (14,5) → (14,8) → (18,8). Tor B: (−1,10) → (3,10) → (3,7) → (7,7) → (7,10) → (10,10) →
   (10,5) → (14,5) → (14,8) → (18,8). Die Gegner wechseln zwischen den Toren. Entscheidung: früh die gemeinsame Tasche zwischen
   beiden Bahnen (Zeilen 5 und 6) oder eine starke Todeszone auf dem kurzen gemeinsamen Stück. In der Nahen Zukunft läuft Tor A
   über eine Brücke geradeaus: (−1,1) → (10,1) → (10,5) → danach wie oben.
4. **Schneckenhaus** (`schneckenhaus`, Fortgeschrittene; Stärke 1,01, 7 von 10). Anderthalb Ringe: (−1,1) → (16,1) → (16,10) →
   (1,10) → (1,5) → (9,5); die Flamme steht bei (9,5) in der Mitte. Bis 2026-11 hatte die Spirale einen zweiten, inneren Ring
   (80 statt 53 Felder Weg, Stärke 1,58, 10 von 10) und war damit die leichteste Karte statt der schwersten. Der Haken bleibt:
   Die Luftlinie vom Eingang zur Mitte ist nur etwa 11 Felder lang, die Flugabwehr muss an den Kern. Ab dem Mittelalter kehrt sich
   die Spirale um: (−1,10) → (16,10) → (16,1) → (1,1) → (1,5) → (9,5).
5. **Felsenmeer** (`felsenmeer`, Fortgeschrittene; Stärke 0,98, 4 von 10). Kleine Insel, 16 x 10 Felder, Schlangenlinie:
   (−1,5) → (3,5) → (3,1) → (8,1) → (8,8) → (12,8) → (12,3) → (16,3). 44 Felsen, vor allem in den beiden Taschen, wo ein Turm
   sonst zwei Bahnen deckt; nur 84 freie Felder (Flusstal 161). In der schmalen rechten Tasche bleibt genau ein Viererblock für
   eine Superwaffe. Jedes Feld zählt; wer die wenigen Lichtungen zwischen den Bahnen verschenkt, hat keine zweite Chance.
   Ab dem Mittelalter kommt jeder zweite Feuerdieb durch eine Rinne im Süden: (5,10) → (5,8) → (12,8) → danach wie oben.
6. **Zangengriff** (`zangengriff`, Könner; Stärke 0,93, 0 von 10). Zwei Tore an gegenüberliegenden Ufern. West:
   (−1,1) → (6,1) → (6,4) → (2,4) → (2,7) → (8,7) → (8,9) → (4,9) → (4,11) → (12,11) → (12,12). Ost: (18,1) → (11,1) →
   (11,4) → (15,4) → (15,7) → (8,7) → danach wie West. Die Wege treffen sich erst auf (8,7) und laufen gemeinsam zur Flamme am
   Südufer. Zwischen den beiden Haken liegt eine felsige Mitte, Felder, die beide Flanken decken, sind knapp. Flieger kommen von
   beiden Seiten (Luftlinien 17 und 12,5 Felder) und treffen sich über der Flamme. Die schwerste Karte: Das Gold reicht anfangs
   kaum für zwei Flanken, und die Zwischenbosse kommen auf einer Flanke allein. Ab dem Mittelalter ein drittes Tor:
   (10,−1) → (10,4) → (15,4) → danach wie Ost; ab dem Zeitalter der Entdecker kürzt West ab: … (6,4) → (4,4) → (4,7) → (8,7) → …

Jede Karte hat gesperrte Felder (Fels, Teich), die die Bauplätze formen, in allen Zeitaltern an derselben Stelle. Jedes gesperrte
Feld bekommt dasselbe Sperrmodell des Zeitalters; viele davon wirken deshalb schnell eintönig (Felsenmeer im alten Rom: 44
Brunnen), darum bleibt auch das Felsenmeer bei gut 40.

**Besondere Bauplätze** (seit 2026-11, `MapDef.tiles`, Arten in `balance.tiles`). Einzelne bebaubare Felder mit einer Eigenschaft,
in allen Zeitaltern an derselben Stelle, damit „welcher Turm wohin“ eine Frage wird, auch für Superwaffen (drei Nachbarn).
Die Wirkung kommt ganz zuletzt auf die Kampfwerte, auch einer Super- oder Megawaffe; eine Superwaffe behält das Feld ihres Kerns,
die Felder der Zutaten werden frei und behalten ihre Art. Gezeigt als ruhige Bodenmarke in der Farbe der Art mit kleinem Zeichen.

| Kennung | Name | Wirkung | Farbe | Symbol | bringt nichts für |
|---|---|---|---|---|---|
| `hoehe` | Anhöhe | Reichweite x1,2 | Himmelblau `#9FD0F5` | `range` | gewöhnliche Taktgeber (erreichen trotzdem nur ihre 8 Nachbarn) |
| `quelle` | Kraftquelle | Schaden und Brand x1,2 | Rosa `#EE6FB8` | `damage` | Taktgeber; Bremser ohne Ätzpfütze kaum |
| `takt` | Taktstein | Feuerpause x0,85 | Perlweiß `#F4EEDB` | `rate` | Taktgeber, Dauerstrahl der Schützen-Superwaffe |
| `sumpf` | Sumpf | Bau, Ausbau, Modernisieren, Verschmelzen x1,35 | Lehm `#B8786A` | `marsh` (neu) | – (keine Wirkung, nur teurer) |

Verkaufen erstattet wie immer einen Anteil dessen, was im Turm steckt (samt Aufschlag), nie mehr als bezahlt.
Je Karte drei bis vier Felder (Begründung je Feld in `src/content/maps.js`):

- Flusstal: Kraftquelle (6,4) mitten in der oberen Tasche, Sumpf (5,8) auf dem besten Feld der unteren Tasche, Anhöhe (15,4) an
  der östlichen Kehre (eng), Taktstein (17,6) weit draußen am Ostufer.
- Kreuzweg: Sumpf (5,7) am einzigen freien Feld der Kreuzung, Kraftquelle (13,4) östlich der Schleife, Anhöhe (11,3) in der
  inneren Ecke der Schleife (zwei Nachbarn), Taktstein (2,3) weit im Nordwesten.
- Zwillingsfurt: Anhöhe (11,6) und Sumpf (13,6) in der Tasche am Schlussstück, dazwischen das beste Feld (12,7) gewöhnlich;
  Kraftquelle (5,5) in der gemeinsamen Tasche zwischen den Toren; Taktstein (16,3) abseits.
- Schneckenhaus: Anhöhe (8,3) neben der Flamme zwischen Ring und Arm, Kraftquelle (3,8) in der Südwestecke, Sumpf (15,2) in der
  Nordostecke des Rings, Taktstein (12,6) im stillen Osten des Kerns.
- Felsenmeer: Sumpf (9,7) im einzigen Viererblock, Kraftquelle (2,6) in der Lichtung am Eingang, Anhöhe (13,4) zwischen den
  letzten beiden Bahnen (zwei Nachbarn), Taktstein (14,0) in der Nordostecke.
- Zangengriff (nur drei): Kraftquelle (8,6) über dem Treffpunkt, Sumpf (13,3) auf dem besten Platz der Ostflanke, Taktstein (9,0)
  am Nordufer zwischen den Toren.

Stärke mit Feldern (Prüfstand, Mittel über die Startwerte 7/11/13/17/19; ohne Felder in Klammern): Flusstal 1,23 (1,19),
Kreuzweg 1,47 (1,10), Zwillingsfurt 0,99 (1,01), Schneckenhaus 1,01 (1,03), Felsenmeer 1,01 (1,04), Zangengriff 0,93 (0,93).
Der Sprung beim Kreuzweg ist eine Eigenheit des Bots (Protokoll Schritt 14 in `tools/balance.mjs`). Stand vor den Stufen.

**Wege, die sich wandeln** (seit 2026-11, `MapDef.stages`, Regeln in `docs/SIM.md`). Die Insel bleibt, aber beim Wechsel des
Zeitalters kann sich der Weg ändern: ein neues Tor, eine Brücke, eine Abkürzung. Kein Turm wird verdrängt: Jedes Feld, das in
irgendeinem Zeitalter Weg wird, ist von Anfang an unbebaubar und als zarte Spur zu sehen (zugewachsener Pfad, trockenes Bachbett,
abgesteckte Straße); Felder, die aufhören, Weg zu sein, bleiben unbebaubar. Beim Wechsel zeigt die Karte des Zeitalters Name und
Text der Stufe. Jede Änderung soll zum Umdenken zwingen, ohne alles zu entwerten: Die meisten Türme behalten Wert, das neue Stück
braucht neue Deckung. Wenige neue Wegfelder, damit Bauland bleibt.

| Karte | Zeitalter | Stufe | Was sich ändert | neue Felder |
|---|---|---|---|---|
| Flusstal | – | – | nichts: Die Karte für den Einstieg bleibt gleich | 0 |
| Kreuzweg | Mittelalter | Das Nordtor | zweites Tor (8,−1): jeder zweite Feuerdieb steigt oben in die Schleife ein, läuft nur ihre Westhälfte und einmal über die Kreuzung; seine Flieger kommen von Norden | 2 |
| Zwillingsfurt | Zukunft | Die Brücke | Tor A läuft über eine Brücke (4..6,1) geradeaus zum Treffpunkt und spart sich seine Schleife | 3 |
| Schneckenhaus | Mittelalter | Die Spirale kehrt sich um | Tor in der Südwestecke (−1,10), Ring andersherum, Arm zur Flamme von Norden über (1,2..4); Luftlinie von Südwesten | 4 |
| Felsenmeer | Mittelalter | Der Felssturz | zweites Tor im Süden (5,10): jeder zweite Feuerdieb kommt durch eine Rinne unter der Lichtung zur letzten Schleife | 4 |
| Zangengriff | Mittelalter | Das dritte Tor | drittes Tor (10,−1) zwischen den Zangen, stößt bei (11,4) auf die Ostflanke; drei Tore reihum | 5 |
| Zangengriff | Entdecker | Der Westhaken bricht | die Westflanke kürzt ihren Haken über (4,5..6) ab | 2 |

Gemessen (Protokoll Schritt 15 in `tools/balance.mjs`): Am Boden umgeleitete Wege ändern wenig; viel kostet ein neues Tor mit
eigener Luftlinie, an der im letzten Zeitalter keine Flugabwehr steht, und jede Abkürzung, die erst in der Zukunft kommt. Darum
wandeln sich die Karten im Mittelalter: Der Spieler hat ein Zeitalter Zeit, sich einzurichten, bevor die Drohnen kommen.
Stärke mit Stufen (gleiche Messung): Flusstal 1,23, Kreuzweg 1,27, Zwillingsfurt 0,94, Schneckenhaus 1,00, Felsenmeer 1,01,
Zangengriff 0,87. Der Kreuzweg ist damit kein Ausreißer mehr: Seine Stärke 1,47 kam daher, dass eine Superwaffe im Inneren der
Schleife in der Zukunft Boden und Luftlinie zugleich deckte; das Nordtor nimmt ihr diesen Doppelnutzen.

Mit sechs Zeitaltern (Stufen-Index = Position in der Partie: 2 Mittelalter, 3 Entdecker, 4 Industrie, 5 Zukunft) kommen die ersten
Flieger bei den Entdeckern; die Stufen im Mittelalter bleiben dort, der Westhaken des Zangengriffs bei den Entdeckern. Die Brücke
der Zwillingsfurt kommt erst in der Nahen Zukunft: im Mittelalter traf sie den Bot bei Raubritter und Schwarzem Ritter, bei den
Entdeckern oder in der Industrie bei den Dampfwagen, deren Fahrgäste auf dem kurzen Weg nahe der Flamme ausstiegen (20 Startwerte:
3 Siege, in der Zukunft 6, ohne Brücke 7). Siege des besten Bots auf Normal (10 Startwerte, Protokoll Schritt 19): Flusstal 10,
Kreuzweg 7, Zwillingsfurt 2, Schneckenhaus 4, Felsenmeer 2, Zangengriff 7.
Der Zangengriff ist für den Bot nicht mehr die schwerste Karte (er verteidigt das lange gemeinsame Stück im Süden; keine
Stufen-Variante änderte das); für einen Menschen, der beide Flanken halten muss, vermutlich doch.

## 8 Spielgefühl und Oberfläche

### 8.1 Feedback und Juice

| Ereignis | Sehen | Hören (WebAudio) |
|---|---|---|
| Schuss | weapon part recoils, 80 ms squash of the tower, muzzle glow or dust, trail in role colour | short role-specific sound in the age's timbre (sling whoosh ... laser pew), pitch randomised +-6 % |
| Treffer | enemy flashes white 60 ms and wobbles, 3-5 chips in its colour; armour = sparks; shield = hex flicker | soft "tock"; armour "kling"; shield glassy "ting" |
| Brennen / klebrig / betäubt | small flame on the head and orange tint / drips and slowed walk cycle / circling stars | quiet crackle / squelch on entering a Pfütze |
| Kill | 1.2x pop, dust puff, chips, bouncing hat, coin arcs to the gold counter, counter ticks up | "plopp"; kills within 1 s climb a pentatonic scale (swarm kills play a run of notes) |
| Boss-Kill | 0.6 s slow motion, 40 ms hit-stop, coin fountain, camera nudge | timpani hit and a short fanfare |
| Leck | enemy hops into the base, the flame shrinks one step and flickers, a heart cracks in the HUD, 300 ms red vignette at the screen edge | low drum and a falling two-note motif; never harsh |
| Bauen | ghost turns solid, tower drops from 2 tiles up, squash on landing, dust ring, range ring flashes once | wooden/stone/metal "thunk" by age, then a rising blip |
| Aufwerten | quick spin, sparkle burst in role colour, new parts pop in with overshoot, extra pip | rising 3-note arpeggio (4 notes for level 3) |
| Modernisieren | tower spins into a light column, old model shrinks, new one pops out, hourglass badge bursts | "time whoosh" (reversed cymbal) and the new age's signature instrument note |
| Verkaufen | tower folds into a coin burst | coin jingle |
| Welle startet / geschafft | banner "Welle 8" slides in for 1.2 s / gold shower on the counter, "Makellos" star | horn or bell call by age / short resolved chord |
| Zeitenwende | see 5.1 | scale of plucks, fanfare, music cross-fade |

Global rules: screen shake only for boss defeats; no full-screen flashes; damage numbers off by default (enemy HP bars appear only after the first hit); at 2x/4x speed particle counts halve and sounds are rate-limited to 12 per second so it never turns to noise.

### 8.2 Anzeige (deutsch, Symbol zuerst, höchstens etwa zehn Elemente)
- **Oben links:** Funken (Flammensymbol und Zahl) und Gold (Münze und Zahl), beide mit hochzählender Animation; Punkte klein daneben.
- **Oben Mitte:** der **Sonnenbogen**: ein Bogen mit den 6 Zeitalter-Symbolen und 36 kleinen Punkten; eine Sonne (nachts ein Mond)
  markiert die aktuelle Welle, Bosspunkte tragen eine Krone. Darunter „Welle 8 / 36 · Römisches Reich“. Der Lebensbalken eines Bosses
  erscheint hier, mit seinem Namen.
- **Oben rechts:** Tempo 1x / 2x / 4x, Pause, Menü.
- **Unten Mitte:** Bauleiste mit 6 Karten: Vorschaubild der Ausprägung im aktuellen Zeitalter, ihr Name, Preis, Streifen in der
  Rollenfarbe, ein Flügel-Symbol, wenn sie Flieger trifft. Nicht bezahlbare Karten sind gedimmt und zeigen das fehlende Gold. Tasten 1 bis 6.
- **Unten rechts:** großer Knopf **„Nächste Welle“** mit Bildern und Anzahl der kommenden Gegner, ihren Eigenschafts-Symbolen und der
  Frühstart-Prämie. Leertaste. Schalter „Automatisch“.
- **Unten links:** Knopf der Zeitglocke mit Abkling-Ring; „Alle modernisieren“ (nur solange es veraltete Türme gibt).
- **Am Turm:** Ein Klick auf einen Turm öffnet seine Karte am Bildschirmrand (nicht über dem Turm, damit seine Umgebung frei bleibt):
  Ausbauen (Preis), Modernisieren (Preis, zeigt, was daraus wird), Zielwahl, Verkaufen (Erstattung). Reichweitenring und die
  abgedeckten Wegfelder leuchten.
- **Zeitenwende-Karte:** eine Karte, Symbole zuerst: Name und Jahr des neuen Zeitalters (die Jahreszahl rollt wie ein Zählwerk von der
  alten zur neuen), Zeitgeschenk, die neue Gegnereigenschaft mit Bild und der Rolle, die sie kontert, der Umriss des kommenden Bosses.

### 8.3 Einstieg ohne Lesen
1. Startbildschirm: Karte, Schwierigkeitsgrad, „Spielen“. Kein Lehrbildschirm.
2. Welle 1: Nur die Karte des Schützen ist da. Ein Hinweis mit höchstens fünf Wörtern zeigt auf eines von drei pulsierenden Feldern an
   der ersten Biegung („Bau hier einen Turm“). Die Welle lässt sich erst starten, wenn der erste Turm steht.
3. Nach jeder der ersten Wellen gleitet die nächste Rollenkarte in die Leiste, mit dem Bild des Gegners, gegen den sie hilft.
4. Sobald das Gold reicht, pulsiert ein Pfeil am ersten Schützen: „Ausbauen“.
5. Nach der ersten Zeitenwende: Hinweis an einem veralteten Turm: „Modernisieren“.
6. Hinweise verschwinden, sobald der Spieler die Sache einmal getan hat. Die Anleitung im Menü zeigt alle Rollen und Eigenschaften.

### 8.4 Komfort
- Placement preview: range ring, lit path tiles in range, gold dotted lines to towers a Taktgeber would buff; invalid tiles shake the ghost instead of showing an error text.
- Autosave at every wave start and age start (localStorage); "Weiterspielen" on the start screen. Auto-pause when the tab loses focus.
- Colour is never the only signal: each role has its own icon shape and silhouette; trait icons have distinct shapes; optional high-contrast outlines.
- Hover on any enemy portrait shows name, trait icons and the roles that answer it.
- Performance guard: if the frame rate drops, particles reduce before anything gameplay-relevant.

## 9 Look-Regeln

1. **Werte-Hierarchie:** Boden entsättigt und ruhig, Figuren gesättigt. Der Weg unterscheidet sich in jedem Zeitalter deutlich in der
   Helligkeit von beiden Bodentönen (mindestens etwa 1,5 : 1, geprüft im Licht des Zeitalters) und hat immer eine helle Kante.
2. **Rolle = Silhouette** in jedem Zeitalter (Tabelle 2.2). **Rollenfarbe** nur an Sockelband, Akzent, Karte, Reichweitenring und Leuchtspur.
3. **Reservierte Bilder für Zustände, in allen Zeitaltern gleich:** verlangsamt = etwas Glänzendes auf dem Weg, das an den Füßen klebt
   (Harz, Öl, Pech, Sirup, Schaum); Brand = orange Flamme und warmer Schimmer; Heilung = Grün, nur bei Gegnern; Schild = türkise
   Sechseck-Blase, nur bei Gegnern; Verstärkung, Belohnung und Zeiteffekte = Gold.
4. **Ruhe:** Münzen hüpfen und verblassen am Ort des Sieges; keine Schadenszahlen als Standard. Ringe und Verbindungslinien von Auren nur
   beim Bauen und Auswählen. Kein Bildschirmblitzen; Wackeln nur bei Bossen. Bewegte Kulisse gehört an den Rand und in die Tiefe
   (Schiffe, Vögel, Rauch), nicht zwischen die Bahnen.
5. **Die Insel schwebt** in allen Zeitaltern. Was unter ihr liegt (Nebelmeer, See, Ozean, Smog, Lichter der Stadt), wechselt mit dem
   Zeitalter in gleichbleibendem Abstand.
6. **Veraltete Türme:** leichte Entsättigung und eine kleine Sanduhr; nie hässlich.
7. **Handwerk:** kleinste Strukturen 0,04 Felder dick (keine Gittermasten, Drähte, Schnüre, dünnen Speichen); Stoff als ein oder zwei
   starre Flächen; geschlossene Körper; keine Embleme, Gesichter oder Ornamente als winzige Farbflecken. Dekoration auf dem Spielfeld
   höchstens 1,5 Felder hoch; hohe Wahrzeichen (Schornstein, Leuchtturm, Windrad, Aquädukt, Schiffe) nur am Inselrand oder in der Ferne.
8. **Nacht:** Jede Einheit und jeder Turm der Zukunft trägt einen Leuchtstreifen; Leuchtfarben sind Türkis, Magenta und das warme
   Orange der Flamme, die das einzige warme Licht der Szene bleibt.

## 10 Verzicht

Kein siebtes Zeitalter; keine Regeneration, kein Mindestabstand, keine Betäubung; keine zweite Fähigkeit; kein Denkmal, keine
Errungenschaften-Auswahl, kein Markieren einzelner Gegner; keine fliegenden Bosse und keine Gegner, die Türme angreifen; kein
Endlosmodus, keine Tagesaufgabe, kein Fotomodus; keine Zinsen, keine Reparaturen, kein Technologiebaum.

## Anhang A: Kennungen der Modelle

Modell-Kennungen sind verbindlich. `tower.<zeitalter>.<rolle>` für alle 36 Türme, zum Beispiel `tower.rom.knacker`.
`base.<zeitalter>` für die sechs Basen. `fx.portal` für das Zeitportal.

| Zeitalter | Gegner `enemy.<zeitalter>.<name>` | Boss `boss.<zeitalter>.<name>` |
|---|---|---|
| `steinzeit` | `keule`, `wolf`, `frischling`, `nashorn` | `mammut` |
| `rom` | `plaenkler`, `reiter`, `legionaer`, `testudo` | `feldherr` |
| `mittelalter` | `knecht`, `strauchdieb`, `ritter`, `spielmann` | `schwarzritter` |
| `entdecker` | `pirat`, `aeffchen`, `kuerassier`, `papagei` | `landgaleone` |
| `industrie` | `halunke`, `hochrad`, `ballon`, `dampfwagen` | `berta` |
| `zukunft` | `wachroboter`, `roboterhund`, `drohne`, `schildwagen` | `goliath` |

Requisiten `prop.<zeitalter>.<name>` (Namen aus Kapitel 3, klein geschrieben, Umlaute umschrieben), dazu in jedem Zeitalter
`prop.<zeitalter>.block` (füllt sichtbar ein gesperrtes Feld: Felsblock, Teich, Ruine im Stil des Zeitalters) sowie
`prop.<zeitalter>.deko1` und `prop.<zeitalter>.deko2` (kleine, flache Bodendeko für freie Felder: Grasbüschel, Blumen, Kiesel,
Pflasterreste im Stil des Zeitalters):

| Zeitalter | Requisiten |
|---|---|
| `steinzeit` | `urzeitbaum`, `farnbusch`, `findling`, `fellzelt`, `mammutrippen`, `malfels`, `lagerfeuer`, `trockengestell` |
| `rom` | `zypresse`, `saeule`, `aquaedukt`, `olivenbaum`, `pergola`, `statue`, `amphoren`, `mosaik` |
| `mittelalter` | `fachwerkhaus`, `windmuehle`, `tanne`, `heuhaufen`, `zinnenmauer`, `brunnen`, `marktstand`, `weizenfeld` |
| `entdecker` | `palme`, `leuchtturm`, `steg`, `faesser`, `schatztruhe`, `kanonenkugeln`, `kontor`, `segelschiff` |
| `industrie` | `fabrikhalle`, `schornstein`, `gaslaterne`, `gasometer`, `wasserturm`, `kohlehaufen`, `gueterwaggon`, `reihenhaus` |
| `zukunft` | `windrad`, `solarfeld`, `farm`, `ladesaeule`, `holotafel`, `landeplatz`, `stadtbaum`, `wohnturm` |

Geschossmodelle `shot.<name>`: `kiesel`, `pfeil`, `bolzen` (Schütze bis Mittelalter); `felsbrocken`, `tontopf`, `steinkugel`, `bombe`,
`rakete` (Werfer; der Dampfmörser nutzt `bombe`); `klecks` (weißer Tropfen für alle Pfützen-Würfe, eingefärbt über die Schussfarbe) und
`amphore` (Bremser in Rom); `speer`, `eisenbolzen` (Panzerknacker bis Mittelalter; die Balliste nutzt `eisenbolzen`).
Alle übrigen Angriffe sind Leuchtspuren, Strahlen und Flammen ohne Modell.
