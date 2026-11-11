// @ts-check
// Balance-Prüfstand: spielt ganze Partien mit verschiedenen Bot-Strategien in Node (ohne Browser, deterministisch)
// und berichtet je Strategie und Schwierigkeitsgrad: erreichte Welle, Leben, Gold über die Zeit, Schadensanteile je Rolle,
// wo Gegner durchkommen.
//
// Aufruf: node tools/balance.mjs [--map <Kennung>[,<Kennung>...]|all] [--diff easy,normal,hard] [--only name,name]
//         [--seed 7[,11,...]] [--detail] [--strength] [--summary [--leaks] [--recipes]] [--hpScale 1,0.9,...] [--pressure 1.1] [--noTiles] [--noStages] [--noBoons] [--noMods] [--force <Zeitgabe>]
//         [--loadout classic|random|<Waffe>[,<Waffe>...]] [--byLoadout]
//         (--loadout: Bewaffnung der Partien; classic (Standard) = die sechs klassischen Waffen, random = je Startwert gezogen,
//         eine Liste von Waffen ersetzt die klassische Waffe ihres Platzes, z. B. --loadout frostturm. Die Strategien nennen Plätze;
//         der Bot baut die Waffe, die die Partie für den Platz hat.)
//         (--detail: Gold je Welle, Schaden je Rolle, Lecks je Welle; --noTiles: Karten ohne besondere Bauplätze; --noStages:
//         Karten ohne Stufen; --noBoons: ohne Zeitgaben; --noMods: ohne Wellen mit Eigenart; --force: diese Zeitgabe steht in
//         jedem Angebot und wird zuerst gewählt; mehrere Startwerte mittelt --strength, die Tabelle nimmt den ersten)
//
// ---------------------------------------------------------------------------------------------------------------------
// Protokoll der Änderungen (Flusstal, Startwert 7; Ergebnis = erreichte Welle/Leben, 30/x = gewonnen)
//
// Messwerkzeuge: Tabelle (Standard), --strength (größter HP-Faktor auf Normal, der noch gewinnt, je Karte; --map all),
// --detail (Gold je Welle, Ausgaben nach Art, Türme je Zeitalter).
//
// 0 Ausgangslage (drei Zeitalter, 30 Wellen; Stand des Vorgängers: Schütze 60 Gold / 1,25 s, Werfer 20 Schaden,
//   Brenner 4 + 12/s, Stufenpreise 0,9 / 1,3, Rüstung 0,45 je Punkt): sensibel 30/30 30/15 29/0, leichtsinnig 30/30 30/20 29/0,
//   mono:schuetze 30/27 30/15 30/15, mono:knacker 30/27 30/17 30/10, mono:werfer 25/0 23/0 22/0; viele enden mit 500+ Gold.
// 1 Mittelalter aktiv (40 Wellen), Prüfstand erkennt das Flieger-Zeitalter aus den Wellen statt „ab Zeitalter 3“.
//   sensibel 40/30 40/9 38/0, leichtsinnig 40/20 40/10 29/0, ohneModern 40/30 40/18 39/0, mono:knacker 40/27 40/17 40/10.
//   Stärke (Flusstal): sensibel 1,31, ohneModern 1,63 (!), mono:knacker 1,95, mono:schuetze 1,46, leichtsinnig 1,04.
// 2 Bot: vor dem Wellenstart wird Übriges verbaut (eager), statt auf einen teuren Ausbau zu sparen. sensibel 1,31 -> 1,6.
// 3 modernizeFactor 0,45 -> 0,3: Modernisieren holt die fehlende Hälfte günstiger als ein Neubau.
// 4 Scharfschütze 22 -> 16 Schaden (gleiche Wucht je Sekunde wie Doppelschuss; zweigB war deutlich vorn).
//   Panzerknacker 45 -> 40 Schaden, Reichweite 5 -> 4,5; Kettenschlag x0,8 -> x0,7. mono:knacker Flusstal 1,77 -> 1,41.
// 5 Rüstung 0,45 -> 0,6 Standardschuss je Punkt: trifft Schützen-Spam und veraltete Türme. mono:schuetze 1,61 -> 1,30,
//   mono+takt 1,37 -> 1,06, sensibel unverändert.
// 6 Kettenschlag zurück auf x0,8 (mit x0,7 war Stufe 3 gegen Einzelne kaum besser als Stufe 2).
// 7 Rückmeldung des Spielers (gewinnt Knifflig ohne Funkenverlust): je Zeitalter ein Zwischenboss in Welle 5 (Leitwolf,
//   Zenturio, Raubritter, Prototyp X-1; geliehene Modelle in 1,6- bis 1,7-facher Größe, 5 Funken, Kopfgeld 8 G), in Welle 10
//   noch einmal als Geleit; Wellen 4, 7, 8, 9 mit Elitedruck, Welle 1 weniger weich. Superwaffen-Gebühr 0,5 -> 2 Baupreise.
//   Neuer Regler PRESSURE in balance.js (Lebenspunkte aller Gegner, alle Grade).
// 8 Ziel nach der Rückmeldung: bester Bot gewinnt Gemütlich knapp verlustarm, erreicht auf Normal das letzte Zeitalter
//   und verliert dort oder gewinnt knapp, verliert auf Knifflig in der zweiten Hälfte. Gemessen mit unbegrenzten Leben
//   (verlorene Funken je Zeitalter): Die guten Bots verloren in Rom und Mittelalter selbst mit doppelten Lebenspunkten
//   nur Bosse, scheiterten auf Knifflig aber schon in der Steinzeit (ein Schütze zu Beginn).
//   Standard-Lebenspunkte 28/85/185/400 -> 25/185/460/1040, Startgold 120 -> 150 (Gemütlich 190, Knifflig 140).
//   Verloren Flusstal/Zwillingsfurt (easy | normal | hard): sensibel 6/16 | 30/60 | 27/139 (Knifflig zuerst in der
//   Zukunft), superRausch 12/0 | 10/17 | 44/106, zweigB 5/18 | 5/32 | 9/86, ohneModern 22/44 | 22/86, mono:knacker 2/15 |
//   24/97 (15 davon in der Steinzeit), mono:schuetze und leichtsinnig verlieren schon in Rom.
// 9 Superwaffen-Gebühr 2 -> 2,5 Baupreise. Bei 2 war superRausch (vier Superwaffen) klar vorn (Normal 12/19 verloren
//   gegen 30/60 bei sensibel), bei 3 schlechter als ohneSuper (41/62 gegen 32/49).
// 10 Neuer Bot „bester“ (= Selbstspieler src/game/autoplay.js): Scharfschützen, vier Superwaffen mit Schützen- und
//   Knacker-Kernen. Er war viel stärker als sensibel (Knifflig auf Flusstal gewonnen). Daher Standard-Lebenspunkte ab
//   Rom noch einmal x1,4: 25/260/645/1455. Ergebnis über 3 Karten x 5 Startwerte (unbegrenzte Leben, verlorene Funken):
//   bester  Gemütlich 15/15 gewonnen, Ø 1 verloren | Normal 8/15 gewonnen, Ø 25 (je Zeitalter 0/4/4/16; Flusstal 3/5,
//   Zwillingsfurt 0/5, Schneckenhaus 5/5) | Knifflig 5/15 (nur Schneckenhaus), Ø 64 (4/11/8/41).
//   sensibel Normal 2/15, Ø 75. mono:knacker Normal 0/15, Ø 144, stirbt in Rom. mono:schuetze, mono:werfer,
//   mono:brenner, mono+takt, leichtsinnig, ohneModern verlieren Normal auf allen drei Karten, meist in Rom.
//   Schneckenhaus ist deutlich leichter als die beiden anderen Karten (Karten gehören nicht zur Balance-Datei).
//   Tabelle Flusstal, Startwert 7 (Welle/Leben): bester 40/29 40/11 19/0, sensibel 40/15 19/0 17/0,
//   mono:schuetze 17/0 15/0 13/0, mono:knacker 39/0 14/0 3/0. Rauchtest (Selbstspieler, Normal): gewonnen, 9 Funken.
//   Offen: Knifflig endet für den besten Bot oft schon am Feldherrn (Welle 20); Bosse sind sprunghaft (10 Funken auf einmal).
// 11 Megawaffe (Superwaffe nimmt zwei weitere Nachbarn auf; höchstens eine; Schaden x5, Reichweite x1,35, Gebühr 4 Baupreise).
//   Neue Bots megaFrüh (ab Welle 13) und megaSpät (ab Welle 24): wie „bester“, die erste Superwaffe (Knacker-Kern) wird zur
//   Megawaffe; ab ihrer Welle spart der Bot alles dafür. Normal, 3 Karten x Startwerte 7/11/13: mega* 11 von 18 gewonnen,
//   Ø 7,3 Funken übrig; bester 6 von 9, Ø 8,6. Gewinnt mal mehr (Flusstal 7/11: 15-17 statt 10-11 Funken, Knifflig Flusstal 11
//   gewonnen statt Welle 19), mal weniger (Schneckenhaus 8-11 statt 15-19). Kein Fallstrick, nicht übermächtig: Werte bleiben.
//   Gegenproben: Gebühr 3 Ø 7,5; Schaden 6 Ø 5,3 (mehr Schaden half nicht: das Sparen kostet mehr als der Turm bringt);
//   Schaden 4 + Gebühr 5 Ø 8,8. Schaden je Gold der stehenden Megawaffe (samt Geschichte des Kerns) 130-220, Superwaffen 20-90.
// 12 Jeder Kern greift anders an (Strahl, Brandfeld, Frostpuls, Kettenblitz, Feuerring, weite Aura), zwölf Gaben nach Zweig.
//   Neue Bots tausch:<rolle> (bester, zweite Superwaffe mit diesem Kern) und kern:<rolle> (bester, alle vier Kerne gleich).
//   Normal, 3 Karten x Startwerte 7/11/13 (Siege/9, Funken): bester 8/100; tausch: schuetze 8/100, knacker 5/97, taktgeber 6/67,
//   werfer 5/64, bremser 5/70, brenner 5/65 (nach Verstärkung: Brandfeld 6 -> 10 und Wurf x0,8 Pause, Frostpuls mit 5 Schaden,
//   Feuerring Reichweite x1,15 -> x1,3 und Brand x1,3; vorher 5/66, 5/59, 5/48). kern: schuetze 9/67, knacker 5/97, bremser
//   3/43, werfer 0 (stirbt stets in Welle 36 an Fliegern), brenner 0 (Welle 33), taktgeber 0 (wie ohne Superwaffen, Welle 19).
//   Schaden der zweiten Superwaffe (Flusstal): Werfer 508 Tsd., Schütze 137 Tsd., Brenner 52 Tsd., Bremser 51 Tsd.
//   Taktgeber-Wucht +25 % statt +15 % änderte nichts (zurückgenommen). Offen: Taktgeber-Kern lohnt nur mit gezielt gestellten
//   Nachbarn, das kann der Bot nicht.
//   Megawaffe danach neu gemessen: megaFrüh 6/55, megaSpät 6/59 gegen bester 8/100. Der Bot spart ab ihrer Welle alles für sie
//   und verliert dabei mehr, als sie bringt; ein Spieler, der nebenbei weiterbaut, sollte besser fahren. Werte bleiben vorerst.
// 13 Sechs Karten (nur Kartendaten geändert, keine Werte). bester auf Normal: Stärke (Startwerte 7/11/13) und Siege über die
//   Startwerte 1,2,3,5,7,11,13,17,19,23. Vorher: Flusstal 1,07 / 10 von 10, Zwillingsfurt 1,01 / 4, Schneckenhaus 1,58 / 10.
//   Nachher: Flusstal 1,07 / 10, Kreuzweg 1,10 / 9, Zwillingsfurt 1,01 / 4, Schneckenhaus (ohne inneren Ring) 1,01 / 7,
//   Felsenmeer 0,98 / 4, Zangengriff 0,93 / 0 (stirbt in Welle 35-37, absichtlich die schwerste Karte, „Für Könner“).
//   Siege bei HP 1 sind ein Messer-Schnitt: Ob der Bot die Gebühr der ersten Superwaffe (275 G) noch vor Rom zusammenbekommt
//   (er legt nur die Hälfte zurück), entscheidet über den Feldherrn in Welle 20. Die Stärke ist das ruhigere Maß.
// 14 Besondere Bauplätze (Anhöhe Reichweite x1,2, Kraftquelle Schaden und Brand x1,2, Taktstein Pause x0,85, Sumpf Preise x1,35),
//   drei bis vier je Karte. „bester“ bewertet sie jetzt (Option `tiles`, halbe Wirkung und Wurzel des Aufschlags), „besterBlind“
//   ist derselbe Bot ohne diese Vorliebe; --noTiles nimmt alle besonderen Felder von den Karten. Stärke auf Normal, Mittel über
//   die Startwerte 7/11/13/17/19 (Flusstal, Kreuzweg, Zwillingsfurt, Schneckenhaus, Felsenmeer, Zangengriff):
//     ohne Felder (bester)        1,19 1,10 1,01 1,03 1,04 0,93   (mit 7/11/13 wie im Entwurf: 1,07 1,10 1,01 1,00 0,98 0,93 -
//                                                                  die Startwerte streuen um bis zu 0,3 je Karte)
//     mit Feldern, bester         1,23 1,47 0,99 1,01 1,01 0,93
//     mit Feldern, besterBlind    1,38 1,47 0,84 1,12 0,94 0,93*  (* Zangengriff noch mit Anhöhe statt Sumpf auf (13, 3))
//   Unterwegs verworfen: volle Vorliebe (Wirkung voll, Aufschlag voll) lockte den Bot auf Anhöhen in den Torschleifen der
//   Zwillingsfurt, die nur eine Bahn sehen (0,70); Sumpf auf dem besten Feld der Zwillingsfurt (12, 7) 0,80 (der erste Turm der
//   Partie zahlt den Aufschlag); Sumpf am Knick (5, 10) des Zangengriffs 1,15 (der Bot weicht aus und baut besser), Anhöhe auf
//   (13, 3) dort 0,98; Sumpf am Viererblock des Felsenmeers auf (10, 6) 0,84. Einzeln gemessen trägt fast nur der Sumpf:
//   Kraftquelle, Taktstein und Anhöhe verschieben die Stärke um höchstens 0,05.
//   Ausreißer Kreuzweg: Jeder Sumpf (auf (5, 7), (7, 4) oder (7, 8)) hebt die Stärke von 1,10 auf 1,45-1,49, auch beim blinden
//   Bot, der den Aufschlag einfach zahlt; ohne Sumpf etwa 1,25. Ein Störversuch (Schaden x1,001 auf einem Feld) änderte nichts,
//   es ist also kein bloßer Zufall des Verlaufs: Mit weniger Gold plant der Bot anders und kommt zu mehr Superwaffen (ohne
//   Sumpf scheitert seine zweite Superwaffe oft). Der Sumpf bleibt an der Kreuzung (Vorgabe); die Reihenfolge der Karten
//   (zwei leichte, drei mittlere, Zangengriff am schwersten) bleibt, nur ist der Kreuzweg jetzt deutlich leichter als das
//   Flusstal (vorher schon knapp: 1,10 gegen 1,07).
// 15 Karten, die sich mit dem Zeitalter wandeln (MapDef.stages). Bot: bewertet Felder nach den jetzt geltenden Wegen, im
//   Zeitalter vor einem Wechsel zusätzlich mit Gewicht 0,3 nach den kommenden; nach dem Wechsel neu, und Türme, die keinen Weg
//   mehr erreichen, verkauft er (außer Superwaffen und Taktgebern). Künftige Wegfelder sind für ihn wie für jeden unbebaubar.
//   Ohne Stufen (--noStages) ändert das nichts: gleiche Zahlen wie vorher. Stärke auf Normal, Mittel über 7/11/13/17/19:
//     vorher (ohne Stufen)  1,23 1,47 0,99 1,01 1,01 0,93   (Flusstal, Kreuzweg, Zwillingsfurt, Schneckenhaus, Felsenmeer, Zangengriff)
//     nachher               1,23 1,27 0,94 1,00 1,01 0,87   (Flusstal ohne Stufe; Kreuzweg Nordtor (8,-1) ab Mittelalter;
//                                                            Zwillingsfurt Brücke, Schneckenhaus umgekehrte Spirale, Felsenmeer
//                                                            Südrinne, alle ab Mittelalter; Zangengriff drittes Tor ab Mittelalter,
//                                                            Abkürzung im Westhaken ab Zukunft)
//   Was zählt, ist fast nur die Luftlinie im letzten Zeitalter: Ein neues Tor mit eigener Luftlinie, die an der Flugabwehr
//   vorbeiführt, kostet viel (Kreuzweg Nordtor (9,-1) 0,92, in der Zukunft geöffnet 0,65; Flusstal Steg (11,-1) in der Zukunft
//   0,73), Umleitungen am Boden kaum (Kreuzweg an der Schleife vorbei 1,43-1,47; Kreuzweg Westtor (-1,2) 1,42). Jede Abkürzung
//   in der Zukunft kostet 0,1 bis 0,2 (Flusstal Brücke (8,3..5) 1,08, im Mittelalter 1,01; Felsenmeer Südrinne in der Zukunft
//   0,94, im Mittelalter 1,00): Wer ein Zeitalter Zeit hat, sich vor den Drohnen einzurichten, verliert wenig. Zangengriff:
//   drittes Tor allein 1,05 (leichter! seine Luftlinie läuft über die Mitte, wo ohnehin alles steht), volle Abkürzung im
//   Westhaken (6,4)->(6,7) im Mittelalter 0,80, mit drittem Tor 0,81, kleine Abkürzung (4,4)->(4,7) im Mittelalter 0,86.
//   Ausreißer Kreuzweg, geklärt: Der Sumpf wirkt nur über den Messer-Schnitt aus Schritt 13. Ohne Sumpf baut der Bot bei
//   HP 1,5 dieselben Türme an dieselben Plätze, bekommt aber die Gebühr der ersten Superwaffe (Knacker-Kern auf (10, 5)) nie
//   zusammen (er legt nur die Hälfte zurück und verbaut den Rest) und stirbt am Feldherrn in Welle 20; mit Sumpf verschiebt sich
//   sein Ausgeben (teurerer Brenner auf (5, 7) in Welle 3), er verschmilzt in Welle 6 und gewinnt. Hat er die Superwaffe,
//   entscheidet die Zukunft, und dort deckt die Stellung im Inneren der Schleife Boden UND Luftlinie (-1,6)->(18,10): darum
//   1,47. Das Nordtor nimmt ihr den Doppelnutzen. Der Messer-Schnitt selbst ist eine Schwäche des Bots (und des Selbstspielers).
// 16 Zeitgaben (24, src/content/boons.js) und Wellen mit Eigenart (9, src/content/modifiers.js). Der Bot wählt Gaben nach
//   `Strategy.boons`, dann BOON_ORDER (bester: Meisterwerk, Adlerauge, Kettenreaktion, Sperrfeuer, Schmelztiegel ...).
//   Stärke von „bester“ auf Normal, Startwerte 7/11/13/17/19 (Flusstal, Kreuzweg, Zwillingsfurt; Mittel):
//     vorher                    1,22 1,27 0,93  Ø 1,14
//     nur Eigenarten (--noBoons) 1,28 1,01 0,93  Ø 1,07   (etwas schwerer; Kreuzweg verliert an Rückenwind-Drohnen)
//     nur Zeitgaben (--noMods)  1,35 1,39 0,99  Ø 1,24
//     beides                    1,39 1,65 1,01  Ø 1,35;  nach dem Nachstellen unten 1,40 1,52 1,03  Ø 1,32
//   Jede Gabe als erste Wahl erzwungen (--force, Ø über die drei Karten): Spanne 1,19 (Lauffeuer; der Bot spielt kein Feuer) bis
//   1,48. Ausreißer und Nachstellung: Zeitreisende Handwerker 1,48 (Modernisieren x0,5 -> x0,7: 1,37), Riesentöter 1,47 (Bosse
//   x1,3 -> x1,15: 1,38), Schmelztiegel 1,45 (Gebühr x0,5 -> x0,6: 1,44, x0,75: 1,43, x0,7 mit Ausbau x1,15: 1,42). Der
//   Schmelztiegel bleibt vorn: Jede billigere Gebühr bringt dem Bot die erste Superwaffe vor dem Feldherrn (Messer-Schnitt aus
//   Schritt 13), und „bester“ ist ein Superwaffen-Bot; das ist die Spielweise, die die Gabe belohnen soll. Übrige 1,21 bis 1,35.
//   Ausgleich: PRESSURE 1 -> 1,15 (Stärke relativ zum Druck 1,32 / 1,15 = 1,15, also wie vorher). Gegenprobe Normal, 3 Karten x
//   5 Startwerte: bester gewinnt Flusstal 5/5, Kreuzweg 5/5, Zwillingsfurt 1/5 (wie vorher: Stärke dort unter 1).
//   Knifflig (bester, gleiche 15 Partien, Siege): vorher 1; mit Gaben und Eigenarten bei Druck 1: 7; bei 1,05 / 1,1 / 1,15: 3 / 3 / 1,
//   aber auf Flusstal und Zwillingsfurt stirbt der Bot dann schon in Welle 3 bis 4: Seine Eröffnung (ein Schütze, 140 Gold) kippt
//   in der Steinzeit zwischen Lebenspunkten x1,25 und x1,31. Die Zeitgaben helfen erst ab dem zweiten Zeitalter; ein Ausgleich nur
//   ab dort (balance.ageHp ab Index 1 statt PRESSURE) träfe das genauer.
// 17 Fünf Zeitalter (Entdecker als viertes, 50 Wellen): zehn Wellen mit Käpt'n Flint (fliegender Zwischenboss, Papagei x1,7,
//   12 x Standard, Tempo 0,8) und der Landgaleone als Träger (bei 85/60/35 % je 3 Papageien). Prüfstand: --summary (alle Partien
//   parallel: Siege, Ø Welle, Funken der Sieger, Gold am Ende, Niederlagen je Zeitalter, Siege je Karte; --leaks: wer die Funken
//   holt, je Welle), --hpScale (Faktor je Position, Versuch ohne Dateiänderung), --pressure. „bester“ baut wie der Selbstspieler
//   eine Flak (drei Schützen), sobald Flieger kommen (ab Welle 5 des Zeitalters davor), platziert nach Luftlinie.
//   Vorher (vier Zeitalter, Druck 1,15; 6 Karten x Startwerte 7/11/13, Siege/18 und Niederlagen je Zeitalter):
//     bester  Gemütlich 17 | Normal 15 [0 2 1 0] | Knifflig 1 [6 10 1 0] (sechsmal schon in der Steinzeit)
//   Fünf Zeitalter, Druck 1,15, ohne Flak im Bot: Gemütlich 16 | Normal 13 | Knifflig 0 [6 10 1 1 0]; Gold am Ende Ø 1560.
//   Druck 1, sonst gleich: Gemütlich 18 | Normal 16 | Knifflig 1 [0 10 0 6 1] (Rom bleibt der Messer-Schnitt am Feldherrn).
//   Druck je Position (balance.js AGE_PRESSURE) statt pauschal; Versuche (Normal-Siege/18, Knifflig-Niederlagen je Zeitalter):
//     1/1,15/1,15/1,15/1,15  10 [0 10 1 7 0]     1/1,1/1,15/1,2/1,25  12 [0 10 1 7 0]     1/1/1,25/1,4/1,5  9 [0 10 1 7 0]
//     1/0,85/1,15/1,4/1,55  12 [0 4 4 8 1]       1/0,8/1,1/1,35/1,5  8 [0 3 5 10 0]
//   Rom mürber holt die Niederlagen auf Knifflig aus Rom (Rom 0,8 oder 0,75 statt 0,85: 13 statt 15 von 60, kaum Hebel). Größte
//   Diebe danach: Papageien und Flint in Welle 35 und 40 (Welle 40 kostete auf Normal 87 Funken über 18 Partien, auch Bots
//   ohne Flak verloren Gemütlich an Papageien: sensibel 1 von 18). Darum: Welle 40 ohne 6 zusätzliche Papageien, Flint Tempo
//   0,9 -> 0,8, die Landgaleone lässt früher los (75/50/25 -> 85/60/35 %: Ihre Papageien steigen nicht erst kurz vor der Flamme
//   auf; Welle 40 46 -> 32 Funken), Papagei 1,4 -> 1,2 Lebenspunkte (sensibel Gemütlich 1 -> 4 von 18), und der Druck wandert von
//   den Entdeckern in die Zukunft: 1 / 0,85 / 1,15 / 1,2 / 1,7.
//   Karten: Zwillingsfurt gewann mit der Brücke im Mittelalter 1 von 10 (sie traf den Bot genau beim Raubritter und Schwarzen
//   Ritter; ohne Brücke 6), mit der Brücke bei den Entdeckern 4: so jetzt. Zangengriff 8 von 10, Stufen-Varianten 7 bis 9
//   (siehe maps.js): Der Bot verteidigt das lange gemeinsame Stück im Süden, die Karte ist für ihn nicht die schwerste.
//   Ergebnis (bester, 6 Karten x 10 Startwerte 1..23; Siege/60, Niederlagen je Zeitalter):
//     Gemütlich 58 [0 0 0 2 0], Ø 24 Funken | Normal 35 [0 0 4 1 20], Ø 12 Funken, Ø Welle 48 | Knifflig 4 [0 15 8 27 6]
//     Normal je Karte: Flusstal 9, Kreuzweg 6, Zwillingsfurt 3, Schneckenhaus 6, Felsenmeer 4, Zangengriff 7.
//     Gold: verdient etwa 48 000 in einer Partie, am Ende Ø 1500 übrig (ein Turm der Zukunft kostet 600 bis 900).
//   Andere (Startwerte 7/11/13, Siege/18 Gemütlich | Normal | Knifflig): sensibel 4 | 0 (stirbt meist in Rom) | 0; ohneModern
//   0 | 0 | 0; mono:knacker 0 | 0 (Rom/Mittelalter) | 0 (Steinzeit); mono:schuetze und leichtsinnig sterben überall in Rom.
//   Rauchtest (Selbstspieler, Flusstal, Normal): gewonnen, Welle 50, 20 Funken (ein Lauf davor, vor den letzten kleinen
//   Wellenänderungen: 9 Funken, 11 davon bei den Entdeckern verloren).
// 18 Rezepte zum Freischalten (docs/briefs/fusion.md, 11): sieben gesperrte Rezepte (Teerfeuer, Belagerungsgeschütz, Dampfkessel,
//   Kommandoposten, Panzergranate, Brennglas, Fesselstrahl), frei durch einen Bauplan (Zeitgabe, Gewicht 0,4) oder einen
//   Zwischenboss ohne Funkenverlust (Pool je Zeitalter). Neue Bots: rezept:<id> (bester ohne Rezept-Vorliebe, zweite Superwaffe ab
//   Welle 12 = Kern und Zutaten des Rezepts, Rezept von Anfang an frei) gegen ohne:<id> (dieselben Türme, Rezept gestrichen, also
//   die gewöhnliche Superwaffe); besterOhneRez (keine Rezept-Vorliebe), besterOhnePlan (keine Baupläne im Angebot). --recipes zeigt
//   in --summary freigeschaltete Rezepte je Partie (Grund, Verteilung) und gewählte Zeitgaben. Normal, 6 Karten x Startwerte.
//   Zwischenbosse: Der beste Bot besiegt im Mittel 4,3 von 5 ohne Funkenverlust; mit „ab Zeitalter N“ waren das 3,8 bis 4,3 Rezepte
//   je Partie, zu viele. Darum Pools nur für Rom, Mittelalter und Entdecker (3 / 4 / 5 Rezepte): 2,6 je Partie (Verteilung über 60
//   Partien: 1 einmal, 2 zwanzigmal, 3 vierzigmal); Baupläne nimmt der Bot selten (2 bis 3 in 60 Partien), ein Mensch wohl öfter.
//   Erzwungen (Siege von 60, rezept gegen ohne), erste Werte: Belagerung 16/19, Panzergranate 12/22, Brennglas 21/29, Teerfeuer 15/17,
//   Fesselstrahl 39/19 (!), Dampfkessel 24/23, Kommando 16/19. Nachgestellt: Teerfeuer Brand 8 -> 14, Pause 2 -> 1,4; Belagerung
//   Wucht x2,6 -> x3; Kommando 4 -> 5 Schaden; Panzergranate Wucht x1,6 -> x2,8, Einschlag x1,3 -> x1,4, Pause x0,9; Brennglas
//   6 -> 9 Schaden, Brand 4 -> 7, Radius 0,8 -> 0,9; Fesselstrahl 8 -> 5 Schaden, Aufheizen 1,5 -> 1; Dampfkessel Brand 6 -> 5,
//   Reichweite x1,5 -> x1,35. Danach: Belagerung 22/22, Teerfeuer 17/16, Fesselstrahl 20/17, Kommando 13/15 (je 60);
//   Panzergranate 34/33, Brennglas 61/55, Dampfkessel 40/33 (je 120, 20 Startwerte). Keins ist Pflicht, keins nutzlos.
//   (Die ohne:-Werte schwanken zwischen Läufen um bis zu 9 von 60, weil die Baupläne das Angebot der Zeitgaben verändern; verglichen
//   wird nur innerhalb eines Laufs.) Austauschen gegen beliebige Rezepte kostete den besten Bot viel (25 statt 35 von 60): Seine
//   eigenen Superwaffen (Strahl, Kettenblitz mit Fliegerabwehr) sind gut gewählt. Seine Vorliebe nimmt darum nur Rezepte mit dem
//   Kern des geplanten Turms (Belagerung für Knacker-Pläne, Brennglas für Schützen-Pläne).
//   Gesamtschwierigkeit (bester, Normal, 6 Karten x 10 Startwerte, drei Sätze 1..23 / 29..67 / 71..109): mit Rezepten 44 / 36 / 26
//   = 106 von 180 (59 %), ohne Baupläne im Angebot 35 / 32 / 34 = 101, ohne Rezept-Vorliebe 43 / 36 / -; vorher 35 von 60 (58 %).
//   Unverändert innerhalb des Rauschens (der Satz 1..23 sprang von 35 auf 44, der Satz 71..109 fiel auf 26: Zeitgaben-Glück).
// 19 Sechs Zeitalter (Industrie als fünftes, 60 Wellen): zehn Wellen mit Hochrädern, Dampfwagen (Träger, 4 Halunken),
//   Heißluftballons (Flieger, 3 x Standard, 2 Funken) und der Schwarzen Berta; Zwischenboss Der Kohlenbaron (Dampfwagen x1,65,
//   12 x Standard, Rüstung 1,5, bei 50 % 3 Hochräder, beim Zerbrechen 4 Halunken; mit 6 Halunken gleich viele Siege). Der
//   Prüfstand zeigt in --summary jetzt T = Ø Minuten Wellenzeit der Sieger (Spielzeit bei einfacher Geschwindigkeit ohne Bauzeit).
//   Bester Bot, 6 Karten x 10 Startwerte 1..23 (Siege/60, Niederlagen je Zeitalter):
//     sechs Zeitalter, Druck wie vorher (1 / 0,85 / 1,15 / 1,2 / 1,7 / 1,8): Gemütlich 59 | Normal 44 [0 0 2 1 5 8] | Knifflig 4
//     [0 13 15 23 3 2]; Normal je Karte 10 / 8 / 3 / 8 / 6 / 9. Mit dem fünften Zeitalter hat der Bot eine Zeitgabe mehr.
//   Versuche mit --hpScale auf die letzten beiden Positionen (Normal): 1,1/1,1 35 [.. 12 10]; 1/1,2 35 [.. 5 17];
//     1,1/1,2 29; 1,2/1,2 26; 1,05/1,2 31 [0 0 2 1 9 17].
//   Zwillingsfurt (Normal, 20 Startwerte, Druck 1,05/1,2): Brücke bei den Entdeckern 3, in der Industrie 3, in der Zukunft 6, ohne
//   Brücke 7. Mit der Brücke vor der Industrie verlor der Bot dort 11 bis 12 von 17 Niederlagen: Die Fahrgäste der Dampfwagen und
//   der Berta stiegen auf dem kurzen Weg nahe der Flamme aus. Darum kommt die Brücke jetzt erst in der Nahen Zukunft (Luftlinie
//   unverändert). Die übrigen Stufen bleiben, wo sie waren (Mittelalter, Zangengriff zusätzlich Entdecker).
//   Knifflig x1,15 statt x1,25 (--pressure 0,92) verschob nur wenig aus der ersten Hälfte (Rom/Mittelalter 29 -> 21 Niederlagen,
//   3 Siege): Der Bot verliert dort an Leitwolf, Zenturio und Schwarzem Ritter, die Härte des Grades ist kaum der Hebel. Bleibt 1,25.
//   Übernommen: AGE_PRESSURE 1 / 0,85 / 1,15 / 1,2 / 1,8 / 2,15 (Industrie 5652, Zukunft 14513 Standard-Lebenspunkte). Ergebnis:
//     Gemütlich 59 [0 0 0 1 0 0], Ø 23 Funken | Normal 32 [0 0 2 1 6 19], Ø 10 Funken, Ø Welle 56 | Knifflig 0 [0 13 16 24 2 5],
//     Ø Welle 33. Normal je Karte: Flusstal 10, Kreuzweg 7, Zwillingsfurt 2, Schneckenhaus 4, Felsenmeer 2, Zangengriff 7.
//   Größte Diebe auf Normal (60 Partien): Welle 40 (Landgaleone mit Flint, 287 Funken, wie im Spiel mit fünf Zeitaltern), Welle 60
//   (Goliath, Drohnen 208), Prototyp in Welle 55 (80), Kohlenbaron in Welle 45 (29), Berta in Welle 50 (52). Ballons stehlen wenig.
//   Flieger-Antworten (Normal, 60 Partien, rezept gegen ohne): Brennglas 18/16, Dampfkessel 13/10, Kommando 10/13; tausch:bremser
//   (Frostpuls als zweite Superwaffe) 7, stirbt meist bei den Entdeckern an Flint. Rezepte je Partie Ø 2,7 (Pools unverändert
//   Rom, Mittelalter, Entdecker; Industrie und Zukunft ohne: tests/recipes.test.mjs schreibt das fest).
//   Gold zu Wellenbeginn (Startwert 7, 6 Karten, Ø je Zeitalter): 52 / 145 / 194 / 437 / 483 / 1034 bei einem Panzerknacker zu
//   110 / 198 / 352 / 616 / 1100 / 1980: nirgends gehortet, nirgends knapp. Verdient je Partie etwa 88 000 bis 91 000.
//   Spielzeit: Ø 45 bis 48 Minuten Wellenzeit je gewonnener Partie (39 bis 49 je Karte); mit Bauzeit zwischen den Wellen etwa
//   eine Stunde bei einfacher Geschwindigkeit.
// 20 Waffenpool (docs/briefs/fusion.md, 12): Die Strategien nennen Plätze, der Bot baut die Waffe der Partie auf dem Platz; neuer
//   Schalter --loadout classic|random|<Waffen>. Der Prüfstand rechnet mit poolContent (alle Waffen) und klassischer Bewaffnung
//   genau wie vorher: bester, Normal, 6 Karten x 10 Startwerte 1..23: 32/60 W56 F10 G2391 [0 0 2 1 6 19], Zeile für Zeile gleich
//   (tests/loadout.test.mjs prüft außerdem, dass klassische Inhalte und Pool-Inhalte mit klassischer Bewaffnung gleich verlaufen).
//   Pilotwaffen, nur ihr Platz getauscht (derselbe Lauf, Normal, 60 Partien):
//     Frostturm statt Bremser: bester 32/60 [0 0 3 2 1 22] (klassisch 32), sensibel 0/60 Ø Welle 28 (klassisch 26). Der beste Bot
//       baut kaum Bremser; sensibel (Bremser als Zutat) kommt mit dem Frostturm zwei Wellen weiter. Werte unverändert gelassen.
//     Giftschütze statt Schütze (der beste Bot stützt sich auf ihn: Nervengift statt Scharfschütze, zwei Schützen-Kerne, Flak):
//       erste Werte (Treffer 3, Gift 5, Umkreis 0,4; Schwade 3 / x1,3) 6/60, Niederlagen meist bei Flint und in der Zukunft: Gift
//       stapelt sich nicht, viele Giftschützen auf einem Boss verpuffen. Treffer 5, Gift 6, Umkreis 0,5, Schleichgift +10 %
//       Reichweite, Schwade 6 / x1,5: 22/60 [0 1 0 3 8 26]; Schwade 9 / x1,7: 38/60; übernommen 7,5 / x1,6: 32/60 [0 1 0 1 7 19]
//       (sensibel mit den Werten davor 0/60 Ø Welle 27).
//   Zufällige Bewaffnung (--loadout random, je Startwert gezogen, mit den übernommenen Werten): bester 32/60 [0 2 1 1 2 22].
// 21 Waffenpool Schritt 1: drei Waffen je Platz (18). Neu: Schnellschütze, Fernwerfer, Stampfer, Netzwerfer, Bohrer, Spalter,
//   Brandpfeil, Glutgrube, Leuchtfeuer, Zahlmeister; neue Mechaniken Rückstoß (push), Zeichen (mark), Sucher (seek), Kopfgeld-Aura
//   (auraBounty); fünf waffengebundene Rezepte. Die acht Rezepte des Platzes setzen die Reichweite (und wo nötig Schaden, Pause,
//   Angriffsart) auf die Grundwerte der klassischen Waffe: für die klassischen Kerne bitgleich (klassisch weiter 32/60, Zeile für Zeile).
//   Neuer Schalter --byLoadout (mit --summary): Siege je Waffe und je Bewaffnung. Alle Werte: bester, Normal, 6 Karten x 10
//   Startwerte 1..23 (klassisch 32/60 W56 F10 [0 0 2 1 6 19]); getauscht wird nur der Platz der Waffe. Ergebnis = Siege, Ø Welle.
//     Schnellschütze  erst 3 Schaden / 2,4 Felder / Wirbel 3 je 0,5 s: 1/60 W34 (stirbt in Rom bis Entdecker: Der Bot baut seine
//                     zwei Boss-Killer als Schützen-Kerne, mit kurzer Reichweite und ohne aufheizenden Strahl). 3,5 / 2,7 / Wirbel 4
//                     je 0,4 s: 7 W47; Hartkern +20 % Reichweite, Wirbel 5 und +30 % Reichweite: 20 W53; übernommen 3,8 / Wirbel 6:
//                     24/60 W53 [0 1 2 8 7 18]. Schwächer als der Scharfschützen-Plan des Bots, nicht hoffnungslos.
//     Fernwerfer      31/60 W54 [0 1 2 5 8 13], unverändert.
//     Stampfer        erst Schaden 16, Rückstoß 0,4, Gabe Erdstoß 0,3: 44/60 (die Gabe auf dem Strahl-Kern hält Bosse zurück);
//                     übernommen 15 / 0,35 / 0,2: 34/60 W55.
//     Netzwerfer      erst 40 % für 2,5 s alle 1,6 s, Wurfgewicht 6 / 0,3: 49/60 W59; 35 % / 2 s: 44; alle 1,8 s, Wurfgewicht 4 /
//                     0,15: 39; übernommen alle 2 s: 37/60 W56. Bremst Flieger und Bosse; der Bot nutzt Bremser sonst kaum.
//     Bohrer          18/60 W46 als Tausch, aber diese Bewaffnung kann die Ziehung nie ergeben (nur der Schütze trifft Flieger).
//                     Gültig gemessen: mit Brandpfeil 30/60 W51 (Brandpfeil allein 33), mit Frostturm 28/60 W48. Verliert vor allem
//                     bei den Entdeckern (14 bis 16): Die beiden Panzerknacker-Kerne des Bots werden Presslufthammer, nur am Boden.
//     Spalter         Zeichen 25 %, Zeichengranate x1,4: 28/60 W52 (13 Niederlagen bei Flint); Zeichen 30 %, Granate x3: 41;
//                     übernommen x2,2: 35/60 W56 [0 0 0 6 7 12].
//     Brandpfeil      33/60 W57 [0 0 0 2 5 20], unverändert.
//     Glutgrube       Brand 10, Gabe Glutbett 0,5 / 1 s: 25/60 W53; Brand 11, Glutbett 1,2 / 2 s: 29/60 W55.
//     Leuchtfeuer     29/60 W56 [0 0 0 5 6 20], unverändert (der Bot stellt Taktgeber nicht gezielt an den Weg).
//     Zahlmeister     36/60 W55 [0 0 1 6 6 11], unverändert (Aufschlag 50 %, Stufe 3 80 %; der Bot stellt ihn irgendwohin).
//   Zufällige Bewaffnung, 6 Karten x 40 Startwerte 1..40 (40 Bewaffnungen, je 6 Partien): 137/240 (57 %, klassisch 53 %) W54
//     [0 2 6 37 14 44]. Siege je Waffe (Partien mit ihr): Brandpfeil 48 %, Werfer 54 %, Frostturm 54 %, Schütze 53 %, Taktgeber
//     54 %, Knacker 54 %, Fernwerfer 57 %, Leuchtfeuer 58 %, Bremser 58 %, Spalter 58 %, Giftschütze 59 %, Stampfer 59 %, Schnellschütze 60 %,
//     Zahlmeister 60 %, Netzwerfer 61 %, Brenner 62 %, Glutgrube 64 %, Bohrer 64 % (nur 36 Partien). Je Bewaffnung 1/6 bis 6/6;
//     die schwächsten (1/6) über 6 Karten x 10 Startwerte nachgespielt: Schnellschütze/Fernwerfer/Netzwerfer/Knacker/Glutgrube/
//     Zahlmeister 35/60 W55, Schütze/Stampfer/Frostturm/Spalter/Brandpfeil/Taktgeber 37/60 W54; die stärkste (6/6) Giftschütze/
//     Fernwerfer/Netzwerfer/Spalter/Brandpfeil/Leuchtfeuer 44/60 W57. Spanne für den Bot also etwa 24 bis 44 von 60, klassisch
//     32: keine Ziehung hoffnungslos, keine geschenkt; die Streuung einer einzelnen Ziehung kommt vor allem vom Startwert (Zeitgaben,
//     Eigenarten). Gegenprobe ohne Garantie (Schnellschütze, Stampfer, Netzwerfer, Bohrer, Glutgrube, Zahlmeister: nur eine
//     Flieger-Waffe, nie gezogen): 29/60, aber 24 Niederlagen bei den Entdeckern. Die Garantie von zwei Flieger-Waffen trägt.
//   Vertrauen: Der Bot stellt Unterstützer nicht gezielt (Leuchtfeuer, Zahlmeister, Stampfer gehören an den Weg bzw. an die
//   Todeszone), spielt keine Feuer- oder Bremser-Pläne und baut immer Schützen- und Panzerknacker-Kerne: Für Schnellschütze, Bohrer
//   und Spalter misst er vor allem deren Superwaffe, für Leuchtfeuer, Zahlmeister und Glutgrube eher die Untergrenze.
// ---------------------------------------------------------------------------------------------------------------------

import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { poolContent as gameContent } from '../src/content/index.js';
import { contentSlots, fusionRecipe, recipeById, recipeFits, resolveLoadout, slotOf, weaponById } from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { samplePath, tileX, tileZ } from '../src/sim/path.js';

/** @import { Content, Difficulty } from '../src/types/content' */
/** @import { Sim, Tower } from '../src/types/sim' */

/**
 * @typedef {object} Strategy
 * @property {string} name
 * @property {string[]} roles Bau-Reihenfolge (zyklisch), als Plätze; gebaut wird die Waffe der Partie auf dem Platz
 * @property {string[]} [late] Bau-Reihenfolge ab dem ersten Zeitalter mit Fliegern
 * @property {boolean} modernize
 * @property {Record<string, number>} branch Zweig je Rolle
 * @property {{ core: string, gifts: [string, string], from: number }[]} fusions geplante Superwaffen
 * @property {{ of: number, gifts: [string, string], from: number }} [mega] geplante Megawaffe: die Superwaffe Nummer `of` aus
 *   `fusions` nimmt ab Welle `from` zwei weitere Türme auf (vorhandene Nachbarn der Stufe 3 oder neu gebaute dieser Rollen)
 * @property {boolean} bell
 * @property {number} level Zielstufe im Mittel je Welle: Stufe ≈ 1 + level * Welle
 * @property {number} [maxTowers]
 * @property {boolean} [eager] vor dem Wellenstart alles Übrige verbauen (Standard: ja)
 * @property {boolean} [tiles] besondere Bauplätze bewerten (Anhöhe, Kraftquelle, Taktstein, Sumpf); sonst blind dafür
 * @property {boolean} [flak] wie der Selbstspieler: Kommt ein Zeitalter mit Fliegern (oder geht es im Zeitalter davor auf die zweite
 *   Hälfte zu), ist die nächste Superwaffe eine Flak (drei Schützen, Zutaten als Doppelschützen), platziert nach Luftlinie und Weg
 * @property {string[]} [boons] Vorliebe bei Zeitgaben, die liebste zuerst; was nicht genannt ist, kommt danach in der Reihenfolge
 *   von BOON_ORDER
 * @property {string[]} [recipes] Vorliebe bei freigeschalteten Rezepten: Beginnt der Bot eine geplante Superwaffe (nicht die Flak),
 *   baut er stattdessen das erste freigeschaltete Rezept dieser Liste mit demselben Kern, das er noch nicht gebaut hat
 * @property {(content: Content) => Content} [content] Inhalte für diese Strategie verändern (z. B. ein Rezept von Anfang an frei)
 */

/**
 * Allgemeine Vorliebe bei Zeitgaben (nach den Vorlieben der Strategie): erst, was jeder Aufstellung hilft, zuletzt, was eine
 * bestimmte Spielweise braucht, die der Bot nicht gezielt spielt.
 */
const BOON_ORDER = [
  'riesentoeter', 'sperrfeuer', 'zeitreise', 'meisterwerk', 'schmelztiegel', 'bauplan_belagerung', 'bauplan_brennglas',
  'kettenreaktion', 'adlerauge', 'ortskunde', 'kopfgeldjaeger',
  'baumeister', 'veredler', 'goldener_handel', 'ewige_flamme', 'glockengiesser', 'pulverfass', 'zaehe_masse', 'zunder', 'lauffeuer',
  'glutherz', 'gleichschritt', 'hoehenluft', 'moorgeister', 'wanderbaumeister', 'zweite_krone',
  'bauplan_panzergranate', 'bauplan_teerfeuer', 'bauplan_fesselstrahl', 'bauplan_dampfkessel', 'bauplan_kommando',
];

const ROLES = ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber'];
const MIX = ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber', 'schuetze', 'knacker', 'werfer', 'brenner', 'schuetze', 'taktgeber', 'bremser', 'knacker'];
const LATE = ['schuetze', 'knacker', 'schuetze', 'brenner', 'schuetze', 'werfer', 'knacker', 'taktgeber'];
const BRANCH = { schuetze: 0, werfer: 0, bremser: 1, knacker: 1, brenner: 0, taktgeber: 1 };
/** Vorliebe der Bots bei freigeschalteten Rezepten (der Kommandoposten fehlt: Taktgeber stellt der Bot nicht gezielt). */
const RECIPE_ORDER = ['belagerung', 'panzergranate', 'brennglas', 'teerfeuer', 'fesselstrahl', 'dampfkessel'];
/** Die vier Superwaffen des besten Bots. */
const BEST_FUSIONS = [
  { core: 'knacker', gifts: /** @type {[string, string]} */ (['schuetze', 'brenner']), from: 6 },
  { core: 'schuetze', gifts: /** @type {[string, string]} */ (['werfer', 'knacker']), from: 12 },
  { core: 'knacker', gifts: /** @type {[string, string]} */ (['schuetze', 'taktgeber']), from: 20 },
  { core: 'schuetze', gifts: /** @type {[string, string]} */ (['brenner', 'knacker']), from: 28 },
];

/**
 * Inhalte mit einem Rezept, das von Anfang an frei ist (`open`), oder ganz ohne dieses Rezept und seine Zeitgabe (`gone`).
 * @param {Content} content
 * @param {string} id
 * @param {'open' | 'gone'} mode
 * @returns {Content}
 */
export function withRecipe(content, id, mode) {
  return {
    ...content,
    archetypes: content.archetypes.map((arch) => {
      const list = arch.fusion?.recipes;
      if (!arch.fusion || !list || !list.some((r) => r.id === id)) return arch;
      const recipes = mode === 'open' ? list.map((r) => (r.id === id ? { ...r, locked: false } : r)) : list.filter((r) => r.id !== id);
      return {
        ...arch,
        fusion: { ...arch.fusion, recipes },
        tiers: mode === 'open' ? arch.tiers : arch.tiers.map((def) => {
          if (!def || !def.recipes) return def;
          const { [id]: _, ...rest } = def.recipes;
          return { ...def, recipes: rest };
        }),
      };
    }),
    // Die Zeitgabe zum Rezept entfällt in beiden Fällen (ein freies Rezept lässt sich nicht freischalten).
    ...(content.boons ? { boons: content.boons.filter((b) => b.effect.recipe !== id) } : {}),
  };
}

/**
 * @param {Partial<Strategy> & { name: string }} s
 * @returns {Strategy}
 */
function strat(s) {
  return {
    roles: MIX,
    late: LATE,
    modernize: true,
    branch: { ...BRANCH },
    fusions: [
      { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 12 },
      { core: 'brenner', gifts: ['bremser', 'taktgeber'], from: 16 },
    ],
    bell: true,
    level: 0.09,
    ...s,
  };
}

/** @type {Strategy[]} */
export const STRATEGIES = [
  strat({ name: 'sensibel' }),
  // Der beste Bot und zugleich der Selbstspieler des Spiels (src/game/autoplay.js): Scharfschützen, vier Superwaffen mit
  // Schützen- und Panzerknacker-Kernen.
  strat({ name: 'bester', tiles: true, flak: true, recipes: RECIPE_ORDER, boons: ['meisterwerk', 'adlerauge', 'kettenreaktion', 'sperrfeuer', 'schmelztiegel'], branch: { ...BRANCH, schuetze: 1 }, fusions: BEST_FUSIONS }),
  // Derselbe Bot ohne Baupläne im Angebot der Zeitgaben (Vergleich: verdünnen die Baupläne das Angebot?).
  strat({ name: 'besterOhnePlan', tiles: true, flak: true, recipes: RECIPE_ORDER, boons: ['meisterwerk', 'adlerauge', 'kettenreaktion', 'sperrfeuer', 'schmelztiegel'], branch: { ...BRANCH, schuetze: 1 }, fusions: BEST_FUSIONS, content: (c) => ({ ...c, ...(c.boons ? { boons: c.boons.filter((b) => b.effect.recipe === undefined) } : {}) }) }),
  // Derselbe Bot ohne Rezept-Vorliebe (baut nur seine vier Superwaffen und die Flak).
  strat({ name: 'besterOhneRez', tiles: true, flak: true, boons: ['meisterwerk', 'adlerauge', 'kettenreaktion', 'sperrfeuer', 'schmelztiegel'], branch: { ...BRANCH, schuetze: 1 }, fusions: BEST_FUSIONS }),
  // Derselbe Bot, blind für besondere Bauplätze (zahlt den Sumpf, ohne es zu merken).
  strat({ name: 'besterBlind', branch: { ...BRANCH, schuetze: 1 }, fusions: [
    { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
    { core: 'schuetze', gifts: ['werfer', 'knacker'], from: 12 },
    { core: 'knacker', gifts: ['schuetze', 'taktgeber'], from: 20 },
    { core: 'schuetze', gifts: ['brenner', 'knacker'], from: 28 },
  ] }),
  // Megawaffe: der beste Bot, dessen erste Superwaffe (Knacker-Kern) später zwei weitere Türme aufnimmt.
  strat({ name: 'megaSpät', branch: { ...BRANCH, schuetze: 1 }, fusions: [
    { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
    { core: 'schuetze', gifts: ['werfer', 'knacker'], from: 12 },
    { core: 'knacker', gifts: ['schuetze', 'taktgeber'], from: 20 },
    { core: 'schuetze', gifts: ['brenner', 'knacker'], from: 28 },
  ], mega: { of: 0, gifts: ['schuetze', 'taktgeber'], from: 24 } }),
  strat({ name: 'megaFrüh', branch: { ...BRANCH, schuetze: 1 }, fusions: [
    { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
    { core: 'schuetze', gifts: ['werfer', 'knacker'], from: 12 },
    { core: 'knacker', gifts: ['schuetze', 'taktgeber'], from: 20 },
    { core: 'schuetze', gifts: ['brenner', 'knacker'], from: 28 },
  ], mega: { of: 0, gifts: ['schuetze', 'brenner'], from: 13 } }),
  strat({ name: 'ohneSuper', fusions: [] }),
  strat({ name: 'ohneModern', modernize: false }),
  strat({ name: 'leichtsinnig', roles: ['schuetze', 'werfer'], modernize: false, fusions: [] }),
  strat({ name: 'schützenSpam', roles: ['schuetze'], fusions: [{ core: 'schuetze', gifts: ['schuetze', 'schuetze'], from: 12 }] }),
  strat({ name: 'superRausch', fusions: [
    { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
    { core: 'werfer', gifts: ['bremser', 'taktgeber'], from: 11 },
    { core: 'schuetze', gifts: ['werfer', 'knacker'], from: 16 },
    { core: 'brenner', gifts: ['bremser', 'schuetze'], from: 21 },
  ] }),
  strat({ name: 'ohneGlocke', bell: false }),
  strat({ name: 'zweigA', branch: Object.fromEntries(ROLES.map((r) => [r, 0])) }),
  strat({ name: 'zweigB', branch: Object.fromEntries(ROLES.map((r) => [r, 1])) }),
  ...['schuetze', 'werfer', 'knacker', 'brenner'].map((role) => strat({ name: `mono:${role}`, roles: role === 'schuetze' ? [role] : [role, role, 'schuetze'], fusions: [] })),
  strat({ name: 'mono+brems', roles: ['schuetze', 'schuetze', 'bremser'], fusions: [] }),
  strat({ name: 'mono+takt', roles: ['schuetze', 'schuetze', 'schuetze', 'taktgeber'], fusions: [] }),
  ...ROLES.map((role) => strat({ name: `flip:${role}`, branch: { ...BRANCH, [role]: 1 - BRANCH[/** @type {keyof typeof BRANCH} */ (role)] } })),
  ...ROLES.map((gift) => strat({ name: `gabe:${gift}`, fusions: [
    { core: 'knacker', gifts: [gift, gift], from: 12 },
    { core: 'brenner', gifts: [gift, gift], from: 16 },
  ] })),
  // Kerntausch: der beste Bot, dessen zweite Superwaffe (ab Welle 12, Gaben Werfer + Knacker) einen Kern dieser Rolle hat.
  ...ROLES.map((core) => strat({ name: `tausch:${core}`, branch: { ...BRANCH, schuetze: 1 }, fusions: [
    { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
    { core, gifts: ['werfer', 'knacker'], from: 12 },
    { core: 'knacker', gifts: ['schuetze', 'taktgeber'], from: 20 },
    { core: 'schuetze', gifts: ['brenner', 'knacker'], from: 28 },
  ] })),
  // Rezeptvergleich: der beste Bot (ohne Rezept-Vorliebe), dessen zweite Superwaffe (ab Welle 12) Kern und Zutaten dieses Rezepts
  // hat; „rezept:“ mit dem Rezept von Anfang an frei, „ohne:“ mit denselben Türmen, aber ohne das Rezept (gewöhnliche Superwaffe).
  ...RECIPE_ORDER.concat(['kommando']).flatMap((id) => {
    const found = recipeById(gameContent, id);
    if (!found) return [];
    const plan = { core: slotOf(found.arch), gifts: /** @type {[string, string]} */ (/** @type {unknown} */ (found.recipe.gifts)), from: 12 };
    const fusions = [BEST_FUSIONS[0], plan, BEST_FUSIONS[2], BEST_FUSIONS[3]];
    const base = { tiles: true, flak: true, boons: ['meisterwerk', 'adlerauge', 'kettenreaktion', 'sperrfeuer', 'schmelztiegel'], branch: { ...BRANCH, schuetze: 1 }, fusions };
    return [
      strat({ name: `rezept:${id}`, ...base, content: (c) => withRecipe(c, id, 'open') }),
      strat({ name: `ohne:${id}`, ...base, content: (c) => withRecipe(c, id, 'gone') }),
    ];
  }),
  // Kernvergleich: der beste Bot mit vier Superwaffen, deren Kerne alle diese Rolle haben (Gaben wie beim besten Bot).
  ...ROLES.map((core) => strat({ name: `kern:${core}`, branch: { ...BRANCH, schuetze: 1 }, fusions: [
    { core, gifts: ['schuetze', 'brenner'], from: 6 },
    { core, gifts: ['werfer', 'knacker'], from: 12 },
    { core, gifts: ['schuetze', 'taktgeber'], from: 20 },
    { core, gifts: ['brenner', 'knacker'], from: 28 },
  ] })),
];

/**
 * Wie gut ein Feld für eine Rolle liegt: Wegpunkte (alle 0,25 Felder) in Reichweite; Luftlinie zählt im Zeitalter mit Fliegern für Flugabwehr anderthalbfach.
 * @param {Sim} sim
 * @param {readonly import('../src/sim/path.js').PathCurve[]} groundCurves Wege (ohne Angabe die jetzt geltenden)
 * @param {readonly import('../src/sim/path.js').PathCurve[]} airCurves Flugbahnen dazu
 * @returns {(tx: number, tz: number, range: number, air: boolean) => number}
 */
function coverage(sim, groundCurves = sim.paths, airCurves = sim.airPaths) {
  /** @type {[number, number][]} */
  const ground = [];
  /** @type {[number, number][]} */
  const air = [];
  const out = { x: 0, z: 0, dx: 0, dz: 0 };
  for (const [list, curves] of /** @type {const} */ ([[ground, groundCurves], [air, airCurves]])) {
    for (const c of curves) {
      for (let d = 0; d < c.length; d += 0.25) {
        samplePath(c, d, out);
        list.push([out.x, out.z]);
      }
    }
  }
  const { width, height } = sim.map;
  return (tx, tz, range, hitsAir) => {
    const x = tileX(tx, width);
    const z = tileZ(tz, height);
    let n = 0;
    for (const [px, pz] of ground) if (Math.hypot(px - x, pz - z) <= range) n += 1;
    if (hitsAir) for (const [px, pz] of air) if (Math.hypot(px - x, pz - z) <= range) n += 1.5;
    return n;
  };
}

/**
 * Bot für eine Strategie. Aufruf einmal je Zeitschritt vor `sim.step()`.
 * @param {Sim} sim
 * @param {Strategy} st
 * @returns {(sim: Sim) => void}
 */
function makeBot(sim, st) {
  // Wege, die sich wandeln (map.stages): bewertet wird die Abdeckung der jetzt geltenden Wege, im Zeitalter vor einem Wechsel
  // zusätzlich mit Gewicht AHEAD die der kommenden. Nach dem Wechsel wird neu bewertet, und Türme, die keinen Weg mehr
  // erreichen, werden verkauft.
  const AHEAD = 0.3;
  let stage = -1;
  /** @type {ReturnType<typeof coverage>} */
  let cover = () => 0;
  /** @type {ReturnType<typeof coverage> | null} */
  let coverAhead = null;
  let aheadFrom = -1;
  const refresh = () => {
    stage = sim.pathStage();
    cover = coverage(sim);
    aheadFrom = sim.pathStages.find((from) => from > sim.state.age) ?? -1;
    coverAhead = aheadFrom >= 0 ? coverage(sim, sim.stagePaths(aheadFrom), sim.stageAirPaths(aheadFrom)) : null;
    scoreCache.clear();
  };
  const archs = Object.fromEntries(sim.content.archetypes.map((a) => [a.id, a]));
  const slotIds = contentSlots(sim.content).map((slot) => slot.id);
  /**
   * Waffe der Partie zu einem Platz der Strategie; eine Kennung, die kein Platz ist (Waffe eines waffengebundenen Rezepts), bleibt.
   * @param {string} id
   */
  const W = (id) => {
    const at = slotIds.indexOf(id);
    return at >= 0 ? sim.loadout[at] : id;
  };
  /** Platz eines Turms. @param {Tower} t */
  const slotOfTower = (t) => slotOf(t.arch);
  /** @type {{ tx: number, tz: number }[]} */
  const tiles = [];
  for (let tz = 0; tz < sim.map.height; tz++) for (let tx = 0; tx < sim.map.width; tx++) if (sim.canBuild(tx, tz).ok) tiles.push({ tx, tz });
  /** @type {Map<string, number>} */
  const scoreCache = new Map();
  refresh();
  /** Ab dem ersten Zeitalter mit Fliegern zählt die Luftlinie mit (und es wird nach `late` gebaut). */
  const airFrom = sim.content.waves.findIndex((list) => list.some((w) => w.groups.some((g) => sim.content.enemies[g.enemy]?.flying)));
  const isLate = () => airFrom >= 0 && sim.state.age >= airFrom;
  /**
   * Besonderer Bauplatz als einfache Vorliebe (nur mit `st.tiles`): Faktor auf Reichweite, Wucht (Schaden / Pause) und Preis.
   * @param {number} tx @param {number} tz
   */
  const place = (tx, tz) => {
    const def = st.tiles ? sim.content.balance.tiles?.[sim.tileAt(tx, tz)] : undefined;
    const mul = def?.mod.mul ?? {};
    // Vorsichtig: Wirkung und Aufschlag zählen nur zur Hälfte. Mit voller Wirkung lockte die Anhöhe den Bot auf Plätze, die
    // nur eine Bahn sehen (Zwillingsfurt), und der Sumpf trieb ihn von Plätzen, die den Aufschlag wert sind (Kreuzung).
    return { range: 1 + ((mul.range ?? 1) - 1) / 2, punch: Math.sqrt((mul.damage ?? 1) / (mul.cooldown ?? 1)), cost: Math.sqrt(def?.cost ?? 1) };
  };
  /** @param {string} role @param {number} tx @param {number} tz @param {boolean} [air] Luftlinie auch vor dem Flieger-Zeitalter zählen */
  const score = (role, tx, tz, air = false) => {
    const late = isLate() || air;
    // Vorausschau nur im Zeitalter direkt vor dem Wechsel.
    const ahead = coverAhead !== null && aheadFrom === sim.state.age + 1 ? coverAhead : null;
    const key = `${role}:${tx}:${tz}:${late}:${ahead !== null}`;
    let v = scoreCache.get(key);
    if (v === undefined) {
      const s = archs[W(role)].stats;
      const p = place(tx, tz);
      const range = s.range * 1.08 * p.range;
      const reach = cover(tx, tz, range, late && s.hitsAir) + (ahead ? AHEAD * ahead(tx, tz, range, late && s.hitsAir) : 0);
      v = role === 'taktgeber' ? 0 : (reach * p.punch) / p.cost;
      scoreCache.set(key, v);
    }
    return v;
  };
  let next = 0;
  /** Gewählte Zeitgaben (für den Bericht). @type {string[]} */
  const chosen = [];
  /**
   * Laufende Pläne für Superwaffen: Kennungen der drei Türme. `src` ist der Plan der Strategie (oder die Flak), `plan` das, was
   * gebaut wird (bei einem bevorzugten Rezept dessen Kern und Zutaten).
   * @type {{ src: Strategy['fusions'][number], plan: Strategy['fusions'][number], ids: number[], spots: [number, number][], done: boolean }[]}
   */
  const plans = [];
  /** Schon geplante Rezepte. @type {Set<string>} */
  const usedRecipes = new Set();
  let tick = 0;

  /** @param {number} tx @param {number} tz */
  const free = (tx, tz) => sim.canBuild(tx, tz).ok;

  /**
   * Bestes freies Feld für eine Rolle.
   * @param {string} role
   * @returns {{ tx: number, tz: number } | null}
   */
  function bestSpot(role) {
    let best = null;
    let bestV = 0;
    for (const t of tiles) {
      if (!free(t.tx, t.tz)) continue;
      let v;
      if (role === 'taktgeber') {
        v = 0;
        for (const o of sim.state.towers) {
          if (slotOfTower(o) !== 'taktgeber' && Math.abs(o.tx - t.tx) <= 1 && Math.abs(o.tz - t.tz) <= 1) v += o.level * (o.super ? 3 : 1);
        }
        v += score('schuetze', t.tx, t.tz) * 0.01;
        v /= place(t.tx, t.tz).cost;
      } else {
        v = score(role, t.tx, t.tz);
      }
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    if (role === 'taktgeber' && bestV < 3) return null;
    return best;
  }

  /**
   * Dreigespann-Platz: ein Kernfeld mit zwei freien Nachbarn, Summe der Abdeckung maximal.
   * @param {Strategy['fusions'][number]} plan
   * @returns {[number, number][] | null}
   */
  function trioSpot(plan) {
    let best = null;
    let bestV = 0;
    for (const c of tiles) {
      if (!free(c.tx, c.tz)) continue;
      const nb = [];
      for (const t of tiles) {
        if ((t.tx === c.tx && t.tz === c.tz) || Math.abs(t.tx - c.tx) > 1 || Math.abs(t.tz - c.tz) > 1 || !free(t.tx, t.tz)) continue;
        nb.push(t);
      }
      if (nb.length < 2) continue;
      const g0 = plan.gifts[0];
      const g1 = plan.gifts[1];
      nb.sort((a, b) => score(g0, b.tx, b.tz) - score(g0, a.tx, a.tz));
      const a = nb[0];
      const rest = nb.slice(1).sort((p, q) => score(g1, q.tx, q.tz) - score(g1, p.tx, p.tz));
      const b = rest[0];
      const air = plan === flakPlan;
      // Ein Taktgeber-Kern (Kommandoposten) zählt wie ein Schütze, damit er an der Luftlinie steht.
      const coreRole = plan.core === 'taktgeber' ? 'schuetze' : plan.core;
      const v = score(coreRole, c.tx, c.tz, air || plan.core === 'taktgeber') * 2 + score(g0, a.tx, a.tz, air) * 0.3 + score(g1, b.tx, b.tz, air) * 0.3;
      if (v > bestV) {
        bestV = v;
        best = /** @type {[number, number][]} */ ([[c.tx, c.tz], [a.tx, a.tz], [b.tx, b.tz]]);
      }
    }
    return best;
  }

  /** @param {Tower} t @param {number} [branch] Zweig statt des üblichen der Rolle */
  const up = (t, branch) => sim.upgrade(t.id, t.level === 2 ? branch ?? st.branch[slotOfTower(t)] ?? 0 : undefined).ok;
  /** Die Flak als eigener Plan (nur mit `st.flak`, wenn das Rezept existiert und Flieger kommen). */
  const flakPlan = st.flak && archs[W('schuetze')] && fusionRecipe(archs[W('schuetze')], [W('schuetze'), W('schuetze')], [], sim.content) && airFrom >= 0
    ? { core: 'schuetze', gifts: /** @type {[string, string]} */ (['schuetze', 'schuetze']), from: 0 } : null;

  /**
   * Treibt ein Dreigespann voran: bauen, ausbauen, verschmelzen. Liefert die Kosten des nächsten unbezahlbaren Schritts (0 = fertig).
   * @param {{ src: Strategy['fusions'][number], plan: Strategy['fusions'][number], ids: number[], spots: [number, number][], done: boolean }} p
   * @returns {number}
   */
  function trioStep(p) {
    const s = sim.state;
    const roles = [p.plan.core, ...p.plan.gifts].map(W);
    for (let i = 0; i < 3; i++) {
      if (p.ids[i] >= 0 && sim.towerById(p.ids[i])) continue;
      if (p.ids[i] >= 0) {
        p.done = true;
        return 0;
      }
      const [tx, tz] = p.spots[i];
      const cost = sim.buildCost(roles[i], tx, tz);
      if (cost > s.gold) return cost;
      if (!sim.build(roles[i], tx, tz).ok) {
        p.done = true;
        return 0;
      }
      p.ids[i] = /** @type {Tower} */ (sim.towerAt(tx, tz)).id;
    }
    const trio = /** @type {Tower[]} */ (p.ids.map((id) => sim.towerById(id)));
    for (const t of trio) {
      while (t.level < 3) {
        const cost = sim.upgradeCost(t);
        if (cost > s.gold) return cost;
        if (!up(t, p.plan === flakPlan && t !== trio[0] ? 0 : undefined)) return cost;
      }
    }
    if (trio.some((t) => t.tier !== trio[0].tier)) return 0;
    const fee = sim.fuseCost(trio[0]);
    if (fee > s.gold) return fee;
    sim.fuse(trio[0].id, [trio[1].id, trio[2].id]);
    p.done = true;
    return 0;
  }

  /** Stand der geplanten Megawaffe. */
  let megaDone = !st.mega;

  /**
   * Treibt die Megawaffe voran: Nachbarn der Superwaffe bauen oder ausbauen, dann verschmelzen. Liefert die Kosten des nächsten
   * unbezahlbaren Schritts (0 = nichts zu tun oder fertig).
   * @returns {number}
   */
  function megaStep() {
    const s = sim.state;
    const m = st.mega;
    if (megaDone || !m || s.wave < m.from) return 0;
    const plan = plans.find((q) => q.src === st.fusions[m.of]);
    if (!plan || !plan.done) return 0;
    const core = sim.towerById(plan.ids[0]);
    if (!core || !core.super) {
      megaDone = true;
      return 0;
    }
    if (core.mega) {
      megaDone = true;
      return 0;
    }
    if (core.tier < s.age) {
      const c = sim.modernizeCost(core);
      if (c > s.gold) return c;
      sim.modernize(core.id);
    }
    const ready = sim.fuseCandidates(core.id);
    if (ready.length >= 2) {
      const fee = sim.fuseCost(core);
      if (fee > s.gold) return fee;
      sim.fuse(core.id, [ready[0].id, ready[1].id]);
      megaDone = true;
      return 0;
    }
    // Nachbarn heranziehen: veraltete modernisieren, niedrige ausbauen, freie Felder mit den gewünschten Rollen bebauen.
    let want = 2 - ready.length;
    let gift = 0;
    for (let dz = -1; dz <= 1 && want > 0; dz++) {
      for (let dx = -1; dx <= 1 && want > 0; dx++) {
        if (dx === 0 && dz === 0) continue;
        const t = sim.towerAt(core.tx + dx, core.tz + dz);
        if (t && (t.super || ready.includes(t) || !t.arch.fusion)) continue;
        if (t) {
          want -= 1;
          if (t.tier < s.age) {
            const c = sim.modernizeCost(t);
            if (c > s.gold) return c;
            sim.modernize(t.id);
          }
          while (t.level < 3) {
            const c = sim.upgradeCost(t);
            if (c > s.gold) return c;
            if (!up(t)) return c;
          }
        } else if (free(core.tx + dx, core.tz + dz)) {
          const role = W(m.gifts[gift++ % 2]);
          const c = sim.buildCost(role, core.tx + dx, core.tz + dz);
          if (c > s.gold) return c;
          sim.build(role, core.tx + dx, core.tz + dz);
          return megaStep();
        }
      }
    }
    if (want > 0) megaDone = true;
    return 0;
  }

  /**
   * @param {boolean} eager Vor dem Wellenstart: Was übrig bleibt, wird verbaut, statt auf einen teuren Ausbau zu sparen.
   */
  function spend(eager) {
    const s = sim.state;
    // 0. Megawaffe ab ihrer Welle: Vorrang vor allem anderen; solange ein Schritt nicht bezahlbar ist, wird alles gespart.
    if (megaStep() > 0) return;
    // 1. Modernisieren: wichtigste zuerst (Superwaffen, hohe Stufe). Solange etwas veraltet ist, wird dafür gespart.
    if (st.modernize) {
      const old = s.towers.filter((t) => t.tier < s.age).sort((a, b) => sim.modernizeCost(b) - sim.modernizeCost(a));
      let blocked = false;
      for (const t of old) {
        const c = sim.modernizeCost(t);
        if (c <= s.gold) sim.modernize(t.id);
        else if (s.gold >= 0.5 * c) blocked = true;
      }
      if (blocked) return;
    }
    // 2. Superwaffen nach Plan: Schritte, die bezahlbar sind; für den nächsten wird zur Hälfte zurückgelegt.
    let floor = 0;
    // Die Flak kommt als nächste Superwaffe dran, sobald Flieger im laufenden Zeitalter kommen oder es im Zeitalter davor auf
    // die zweite Hälfte zugeht (wie im Selbstspieler, FLAK_LEAD = 5).
    let flak = flakPlan ? plans.find((q) => q.src === flakPlan) : undefined;
    if (flakPlan && !flak && !plans.some((q) => !q.done) && (s.age >= airFrom || (s.age + 1 === airFrom && s.waveInAge >= 5))) {
      const spots = trioSpot(flakPlan);
      if (spots) {
        flak = { src: flakPlan, plan: flakPlan, ids: [-1, -1, -1], spots, done: false };
        plans.push(flak);
      }
    }
    if (flak && !flak.done) {
      const need = trioStep(flak);
      if (need > 0) floor = need * 0.5;
    }
    for (const f of st.fusions) {
      if (flak && !flak.done) break;
      if (s.wave < f.from) continue;
      let p = plans.find((q) => q.src === f);
      if (!p) {
        if (plans.some((q) => !q.done)) break;
        // Ein freigeschaltetes Lieblingsrezept mit demselben Kern, das noch nicht gebaut ist, ersetzt den Plan.
        const want = (st.recipes ?? []).find((id) => {
          const found = recipeById(sim.content, id);
          return s.recipes.includes(id) && !usedRecipes.has(id) && found !== null && slotOf(found.arch) === f.core && recipeFits(sim.content, id, sim.loadout);
        });
        const found = want ? recipeById(sim.content, want) : null;
        const plan = found ? { core: slotOf(found.arch), gifts: /** @type {[string, string]} */ (/** @type {unknown} */ (found.recipe.gifts.slice())), from: f.from } : f;
        const spot = trioSpot(plan);
        if (!spot) continue;
        if (want && found) usedRecipes.add(want);
        p = { src: f, plan, ids: [-1, -1, -1], spots: spot, done: false };
        plans.push(p);
      }
      if (p.done) continue;
      const need = trioStep(p);
      if (need > 0) floor = need * 0.5;
      break;
    }

    // 3. Bauen oder ausbauen: Zielstufe steigt mit der Welle. Ist ein Wunsch nicht bezahlbar, wird das andere versucht.
    for (let guard = 0; guard < 30; guard++) {
      const budget = s.gold - floor;
      const fighters = s.towers.filter((t) => !t.super);
      const avg = fighters.reduce((sum, t) => sum + t.level, 0) / Math.max(1, fighters.length);
      const target = Math.min(3, 1 + st.level * s.wave);
      const reserved = new Set(plans.filter((q) => !q.done).flatMap((q) => q.ids));
      /** @type {Tower | null} */
      let cand = null;
      for (const t of fighters) {
        if (t.level >= 3 || reserved.has(t.id)) continue;
        if (!cand || sim.upgradeCost(t) < sim.upgradeCost(cand)) cand = t;
      }
      const roles = isLate() && st.late && st.roles === MIX ? st.late : st.roles;
      let spot = null;
      let role = '';
      for (let k = 0; k < roles.length && !spot; k++) {
        role = roles[(next + k) % roles.length];
        spot = bestSpot(role);
        if (!spot) continue;
        next += k;
      }
      const full = st.maxTowers !== undefined && s.towers.length >= st.maxTowers;
      const canUp = cand !== null && sim.upgradeCost(cand) <= budget;
      const price = spot ? sim.buildCost(W(role), spot.tx, spot.tz) : Infinity;
      const canBuild = spot !== null && !full && price <= budget;
      const wantUp = cand !== null && (avg < target || spot === null || full);
      if (wantUp && canUp && cand) {
        up(cand);
      } else if (!wantUp && canBuild && spot) {
        sim.build(W(role), spot.tx, spot.tz);
        next++;
      } else if (wantUp && !canUp && canBuild && spot && budget > 2 * price) {
        sim.build(W(role), spot.tx, spot.tz);
        next++;
      } else if (!wantUp && !canBuild && canUp && cand && budget > 2 * sim.upgradeCost(cand)) {
        up(cand);
      } else if (eager && canBuild && spot) {
        sim.build(W(role), spot.tx, spot.tz);
        next++;
      } else if (eager && canUp && cand) {
        up(cand);
      } else {
        return;
      }
    }
  }

  return (game) => {
    const s = game.state;
    tick++;
    if (s.phase === 'wave') {
      if (st.bell && s.abilityCooldown <= 0 && s.enemies.some((e) => e.alive && e.progress > (e.def.boss ? 0.6 : 0.8))) game.useAbility(0, 0);
      if (tick % 30 === 0) spend(false);
      return;
    }
    if (s.phase !== 'build') return;
    // Zeitgaben: die liebste aus dem Angebot.
    if (s.boonOffer.length > 0) {
      const order = [...(st.boons ?? []), ...BOON_ORDER];
      const pick = order.find((id) => s.boonOffer.includes(id)) ?? s.boonOffer[0];
      game.chooseBoon(pick);
      chosen.push(pick);
    }
    if (game.pathStage() !== stage) {
      refresh();
      // Türme, die keinen der neuen Wege mehr erreichen, bringen nichts mehr: verkaufen (Superwaffen und Taktgeber bleiben).
      const reserved = new Set(plans.filter((q) => !q.done).flatMap((q) => q.ids));
      for (const t of s.towers.slice()) {
        if (t.super || slotOfTower(t) === 'taktgeber' || reserved.has(t.id)) continue;
        if (cover(t.tx, t.tz, t.stats.range * (1 + t.buffRange), t.stats.hitsAir) === 0) game.sell(t.id);
      }
    }
    if (s.lock > 0) return;
    spend(st.eager ?? true);
    game.startWave();
  };
}

/**
 * Bewaffnung nach dem Schalter --loadout: 'classic', 'random' oder eine Liste von Waffen, die die klassische Waffe ihres Platzes
 * ersetzen (die übrigen Plätze bleiben klassisch).
 * @param {Content} content
 * @param {string} spec
 * @param {number} seed
 * @returns {'classic' | 'random' | string[]}
 */
export function loadoutFor(content, spec, seed) {
  if (!spec || spec === 'classic' || spec === 'random') return spec === 'random' ? 'random' : 'classic';
  const ids = resolveLoadout(content, 'classic', seed);
  for (const id of spec.split(',')) {
    const arch = weaponById(content, id);
    if (!arch) throw new Error(`Unbekannte Waffe ${id} in --loadout`);
    ids[contentSlots(content).findIndex((slot) => slot.id === slotOf(arch))] = id;
  }
  return ids;
}

/**
 * Spielt eine Partie.
 * @param {Strategy} st
 * @param {string} mapId
 * @param {Difficulty} difficulty
 * @param {number} seed
 * @param {Content} [content]
 * @param {string} [loadout] Wert von --loadout
 */
export function run(st, mapId, difficulty, seed, content = gameContent, loadout = 'classic') {
  const used = st.content ? st.content(content) : content;
  const sim = createSim({ content: used, mapId, difficulty, seed, unlockAll: true, boonChoice: true, loadout: loadoutFor(used, loadout, seed) });
  /** Freigeschaltete Rezepte mit Grund. @type {string[]} */
  const unlocked = [];
  /** Ausgaben je Befehl. @type {Record<string, number>} */
  const spentOn = { build: 0, upgrade: 0, modernize: 0, fuse: 0 };
  for (const key of /** @type {const} */ (['build', 'upgrade', 'modernize', 'fuse'])) {
    const orig = /** @type {(...a: any[]) => any} */ (sim[key]);
    /** @type {any} */ (sim)[key] = (/** @type {any[]} */ ...a) => {
      const before = sim.state.gold;
      const r = orig(...a);
      spentOn[key] += before - sim.state.gold;
      return r;
    };
  }
  /** Türme am Ende jedes Zeitalters. @type {number[]} */
  const towersPerAge = [];
  const bot = makeBot(sim, st);
  /** @type {Record<string, number>} */
  const dmg = {};
  /** @type {Map<number, number>} */
  const last = new Map();
  /** @type {number[]} */
  const goldAtStart = [];
  /** @type {Record<number, number>} */
  const leaks = {};
  /** @type {Record<string, number>} */
  const leakBy = {};
  /** Funken je Welle und Gegner („Welle:Gegner“; ein Boss, der die Welle beendet, zählt schon zur nächsten). @type {Record<string, number>} */
  const leakAt = {};
  const limit = 60 * 60 * 120;
  const account = () => {
    for (const t of sim.state.towers) {
      const prev = last.get(t.id) ?? 0;
      dmg[t.arch.id] = (dmg[t.arch.id] ?? 0) + (t.damageDealt - prev);
      last.set(t.id, t.damageDealt);
    }
  };
  for (let i = 0; i < limit && sim.state.phase !== 'won' && sim.state.phase !== 'lost'; i++) {
    if (i % 10 === 0) account();
    bot(sim);
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === 'leak') {
        leaks[sim.state.wave + 1] = (leaks[sim.state.wave + 1] ?? 0) + e.lives;
        const at = `${sim.state.wave + 1}:${e.enemy.def.id}`;
        leakAt[at] = (leakAt[at] ?? 0) + e.lives;
        leakBy[e.enemy.def.id] = (leakBy[e.enemy.def.id] ?? 0) + e.lives;
      } else if (e.type === 'waveStart') {
        goldAtStart.push(sim.state.gold);
        if (sim.state.waveInAge === 0) towersPerAge.push(sim.state.towers.length);
      } else if (e.type === 'fuse') {
        // Der Schaden der Zutaten wandert in den Kern und ist schon gezählt.
        last.set(e.tower.id, e.tower.damageDealt);
      } else if (e.type === 'recipe') {
        unlocked.push(`${e.id}@${e.reason}:${sim.state.wave}`);
      }
    }
  }
  account();
  const s = sim.state;
  if (process.env.TOWERS) for (const t of s.towers) console.log(t.arch.id, t.tx, t.tz, t.level, t.tier, Math.round(t.damageDealt), t.builtWave, t.super ? `${t.mega ? 'MEGA' : 'SUPER'}:${t.gifts.join('+')} invested ${t.invested}` : '');
  return {
    won: s.phase === 'won',
    wave: s.wave,
    /** Spielzeit der Wellen in Sekunden bei einfacher Geschwindigkeit (der Bot ruft jede Welle sofort; Bauzeit kommt beim Menschen dazu). */
    time: s.time,
    lives: s.lives,
    gold: s.gold,
    towers: s.towers.length,
    supers: s.stats.fusions,
    megas: s.stats.megas,
    boons: s.boons.slice(),
    /** Bewaffnung der Partie (Waffen in Reihenfolge der Plätze). */
    loadout: sim.loadout.slice(),
    /** Freigeschaltete Rezepte „Kennung@Grund:Welle“ und gebaute Rezept-Superwaffen (stehend am Ende). */
    unlocked,
    built: s.towers.filter((t) => t.super && t.recipe).map((t) => t.recipe),
    /** Schaden je investiertem Gold: Megawaffe, Superwaffen, übrige Türme (nur die am Ende stehenden). */
    perGold: ['mega', 'super', 'plain'].map((kind) => {
      const list = s.towers.filter((t) => (kind === 'mega' ? t.mega : kind === 'super' ? t.super && !t.mega : !t.super));
      const invested = list.reduce((sum, t) => sum + t.invested, 0);
      return invested > 0 ? list.reduce((sum, t) => sum + t.damageDealt, 0) / invested : 0;
    }),
    goldAtStart,
    spentOn,
    towersPerAge,
    dmg,
    leaks,
    leakBy,
    leakAt,
    spent: s.stats.goldSpent,
    earned: s.stats.goldEarned,
    mix: Object.entries(s.towers.reduce((m, t) => {
      const k = `${t.arch.id}${t.level}${t.branch >= 0 ? 'AB'[t.branch] : ''}${t.super ? '*' + t.gifts.join('+') : ''}${t.tier < s.age ? '(alt)' : ''}`;
      m[k] = (m[k] ?? 0) + 1;
      return m;
    }, /** @type {Record<string, number>} */ ({}))).map(([k, v]) => `${v}x${k}`).join(' '),
  };
}

/**
 * Inhalte für Vergleiche: ohne Zeitgaben, ohne Eigenarten der Wellen, oder mit einer Zeitgabe, die in jedem Angebot steht
 * (Gewicht 1e9; der Bot muss sie noch selbst bevorzugen, siehe `--force`).
 * @param {Content} base
 * @param {{ noBoons?: boolean, noMods?: boolean, force?: string }} opts
 * @returns {Content}
 */
export function variant(base, opts) {
  let out = base;
  if (opts.noBoons) {
    const { boons, ...rest } = out;
    out = rest;
  }
  if (opts.noMods) {
    const { modifiers, ...rest } = out;
    out = rest;
  }
  if (opts.force) {
    if (!(out.boons ?? []).some((b) => b.id === opts.force)) throw new Error(`Unbekannte Zeitgabe ${opts.force}`);
    out = { ...out, boons: (out.boons ?? []).map((b) => (b.id === opts.force ? { ...b, weight: 1e9, requires: undefined } : b)) };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- Aufruf
/**
 * Inhalte nach den Schaltern der Kommandozeile (gleich für Hauptprozess und Helfer der Übersicht).
 * --hpScale a,b,c,...: Faktor auf die Lebenspunkte je gespielter Position (Versuche ohne die Datei zu ändern);
 * --pressure x: Faktor auf die Lebenspunkte aller Grade (wie PRESSURE in balance.js).
 * @param {string[]} args
 * @returns {Content}
 */
function buildBase(args) {
  /** @param {string} name @param {string} dflt */
  const opt = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  // --noTiles: alle Karten ohne besondere Bauplätze (Vergleich mit dem Stand vor Schritt 14).
  let base = args.includes('--noTiles') ? { ...gameContent, maps: gameContent.maps.map(({ tiles, ...m }) => m) } : gameContent;
  // --noStages: alle Karten ohne Stufen (Wege bleiben die ganze Partie über dieselben; Vergleich mit dem Stand vor Schritt 15).
  if (args.includes('--noStages')) base = { ...base, maps: base.maps.map(({ stages, ...m }) => m) };
  base = variant(base, { noBoons: args.includes('--noBoons'), noMods: args.includes('--noMods'), force: opt('force', '') });
  if (opt('force', '')) STRATEGIES.forEach((st) => (st.boons = [opt('force', ''), ...(st.boons ?? [])]));
  const scale = opt('hpScale', '');
  if (scale) {
    const f = scale.split(',').map(Number);
    base = { ...base, balance: { ...base.balance, ageHp: base.balance.ageHp.map((v, i) => v * (f[i] ?? 1)) } };
  }
  const pressure = Number(opt('pressure', '1'));
  if (pressure !== 1) {
    const d = base.balance.difficulty;
    base = { ...base, balance: { ...base.balance, difficulty: {
      easy: { ...d.easy, hp: d.easy.hp * pressure }, normal: { ...d.normal, hp: d.normal.hp * pressure }, hard: { ...d.hard, hp: d.hard.hp * pressure },
    } } };
  }
  return base;
}

/**
 * Wert eines Schalters der Kommandozeile.
 * @param {string[]} args @param {string} name @param {string} dflt
 */
function argOf(args, name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}

/** Helfer der Übersicht: spielt seine Partien und meldet die Ergebnisse. */
if (!isMainThread && workerData?.balanceJobs) {
  const base = buildBase(workerData.args);
  for (const job of /** @type {{ st: string, map: string, diff: Difficulty, seed: number }[]} */ (workerData.balanceJobs)) {
    const st = /** @type {Strategy} */ (STRATEGIES.find((s) => s.name === job.st));
    const r = run(st, job.map, job.diff, job.seed, base, argOf(workerData.args, 'loadout', 'classic'));
    parentPort?.postMessage({ ...job, won: r.won, wave: r.wave, time: r.time, lives: r.lives, gold: r.gold, supers: r.supers, earned: r.earned, leakBy: r.leakBy, leaks: r.leaks, leakAt: r.leakAt, unlocked: r.unlocked, built: r.built, boons: r.boons, loadout: r.loadout });
  }
}

const isMain = isMainThread && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  const args = process.argv.slice(2);
  /** @param {string} name @param {string} dflt */
  const opt = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const maps = opt('map', 'flusstal') === 'all' ? gameContent.maps.map((m) => m.id) : opt('map', 'flusstal').split(',');
  const diffs = /** @type {Difficulty[]} */ (opt('diff', 'easy,normal,hard').split(','));
  const only = opt('only', '');
  const seeds = opt('seed', '7').split(',').map(Number);
  const seed = seeds[0];
  const detail = args.includes('--detail');
  const base = buildBase(args);
  const loadout = opt('loadout', 'classic');
  const list = only ? STRATEGIES.filter((s) => only.split(',').some((o) => s.name === o || (o.endsWith('*') && s.name.startsWith(o.slice(0, -1))))) : STRATEGIES;
  const total = gameContent.waves.flat().length;
  if (args.includes('--summary')) {
    // Übersicht: alle Partien (Strategie x Grad x Karte x Startwert) parallel; je Strategie und Grad Siege, mittlere erreichte
    // Welle, Funken der Sieger, Gold am Ende und in welchem Zeitalter die Niederlagen kamen; dazu Siege je Karte.
    /** @type {{ st: string, map: string, diff: Difficulty, seed: number }[]} */
    const jobs = [];
    for (const st of list) for (const diff of diffs) for (const map of maps) for (const sd of seeds) jobs.push({ st: st.name, map, diff, seed: sd });
    const n = Math.max(1, Math.min(jobs.length, cpus().length - 2));
    /** @type {any[]} */
    const results = [];
    await Promise.all(Array.from({ length: n }, (_, k) => new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { balanceJobs: jobs.filter((_, i) => i % n === k), args } });
      w.on('message', (m) => results.push(m));
      w.on('error', reject);
      w.on('exit', resolve);
    })));
    const ageOf = (/** @type {number} */ wave) => Math.min(gameContent.ages.length - 1, Math.floor(wave / (total / gameContent.ages.length)));
    console.log(`Bewaffnung: ${loadout === 'random' ? 'je Startwert gezogen' : JSON.stringify(loadoutFor(base, loadout, 0))}`);
    console.log(`Übersicht: ${maps.length} Karten x ${seeds.length} Startwerte; Siege/Partien, Ø Welle (von ${total}), Ø Funken der Sieger, Ø Gold am Ende, T = Ø Minuten Wellenzeit der Sieger, Niederlagen je Zeitalter`);
    console.log(`${'Strategie'.padEnd(14)}${diffs.map((d) => d.padEnd(50)).join('')}`);
    for (const st of list) {
      const cells = diffs.map((d) => {
        const rs = results.filter((r) => r.st === st.name && r.diff === d);
        const wins = rs.filter((r) => r.won);
        const lostAt = gameContent.ages.map((_, a) => rs.filter((r) => !r.won && ageOf(r.wave) === a).length);
        const mean = (/** @type {number[]} */ v) => (v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0);
        return `${wins.length}/${rs.length} W${mean(rs.map((r) => r.wave)).toFixed(0)} F${mean(wins.map((r) => r.lives)).toFixed(0)} G${mean(rs.map((r) => r.gold)).toFixed(0)} T${(mean(wins.map((r) => r.time)) / 60).toFixed(0)} [${lostAt.join(' ')}]`.padEnd(50);
      });
      console.log(`${st.name.padEnd(14)}${cells.join('')}`);
      // Rezepte: freigeschaltete je Partie (Zwischenboss / Zeitgabe) und am Ende stehende Rezept-Waffen.
      if (args.includes('--recipes')) {
        for (const d of diffs) {
          const rs = results.filter((r) => r.st === st.name && r.diff === d);
          const boss = rs.reduce((x, r) => x + r.unlocked.filter((/** @type {string} */ u) => u.includes('@boss')).length, 0);
          const boon = rs.reduce((x, r) => x + r.unlocked.filter((/** @type {string} */ u) => u.includes('@boon')).length, 0);
          /** @type {Record<string, number>} */
          const ids = {};
          for (const r of rs) for (const u of r.unlocked) ids[u.split('@')[0]] = (ids[u.split('@')[0]] ?? 0) + 1;
          /** @type {Record<string, number>} */
          const built = {};
          for (const r of rs) for (const b of r.built) built[b] = (built[b] ?? 0) + 1;
          const hist = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => rs.filter((r) => r.unlocked.length === k).length);
          /** @type {Record<string, number>} */
          const taken = {};
          for (const r of rs) for (const b of r.boons) taken[b] = (taken[b] ?? 0) + 1;
          console.log(`   Zeitgaben ${d}: ${Object.entries(taken).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
          console.log(`   Rezepte ${d}: Ø ${((boss + boon) / Math.max(1, rs.length)).toFixed(2)} je Partie (Zwischenboss ${boss}, Zeitgabe ${boon}); Anzahl 0..7: ${hist.join(' ')}; ${JSON.stringify(ids)}; gebaut ${JSON.stringify(built)}`);
        }
      }
      // Wer die Funken holt (Summe über alle Partien des Grades, die fünf größten).
      const thieves = diffs.map((d) => {
        /** @type {Record<string, number>} */
        const sum = {};
        for (const r of results) if (r.st === st.name && r.diff === d) for (const [k, v] of Object.entries(r.leakBy)) sum[k] = (sum[k] ?? 0) + /** @type {number} */ (v);
        return `${d}: ${Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`;
      });
      if (args.includes('--leaks')) {
        console.log(`   Funken an: ${thieves.join(' | ')}`);
        // Funken je Welle (Summe über alle Partien des Grades), nur Wellen mit Verlusten.
        for (const d of diffs) {
          /** @type {Record<string, number>} */
          const sum = {};
          for (const r of results) if (r.st === st.name && r.diff === d) for (const [k, v] of Object.entries(r.leaks)) sum[k] = (sum[k] ?? 0) + /** @type {number} */ (v);
          console.log(`   Funken je Welle ${d}: ${Object.entries(sum).map(([k, v]) => `${k}:${v}`).join(' ')}`);
          /** @type {Record<string, number>} */
          const at = {};
          for (const r of results) if (r.st === st.name && r.diff === d) for (const [k, v] of Object.entries(r.leakAt)) at[k] = (at[k] ?? 0) + /** @type {number} */ (v);
          console.log(`   größte Diebe ${d}: ${Object.entries(at).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ')}`);
        }
      }
      // Je Waffe (Partien, deren Bewaffnung sie hat) und je Bewaffnung: Siege, Ø Welle; nur mit --byLoadout (sinnvoll mit random).
      if (args.includes('--byLoadout')) {
        for (const d of diffs) {
          const rs = results.filter((r) => r.st === st.name && r.diff === d);
          /** @param {any[]} list */
          const cell = (list) => `${list.filter((r) => r.won).length}/${list.length} W${(list.reduce((x, r) => x + r.wave, 0) / Math.max(1, list.length)).toFixed(1)}`;
          const weapons = [...new Set(rs.flatMap((r) => r.loadout))];
          console.log(`   je Waffe ${d}: ${weapons.map((w) => `${w} ${cell(rs.filter((r) => r.loadout.includes(w)))}`).join(', ')}`);
          /** @type {Map<string, any[]>} */
          const by = new Map();
          for (const r of rs) {
            const key = r.loadout.join(',');
            by.set(key, [...(by.get(key) ?? []), r]);
          }
          const rows = [...by.entries()].map(([key, list]) => ({ key, list, rate: list.filter((r) => r.won).length / list.length, wave: list.reduce((x, r) => x + r.wave, 0) / list.length }));
          rows.sort((a, b) => a.rate - b.rate || a.wave - b.wave);
          console.log(`   Bewaffnungen ${d}: ${rows.length}; schwächste: ${rows.slice(0, 5).map((r) => `[${r.key}] ${cell(r.list)}`).join('; ')}`);
          console.log(`   stärkste: ${rows.slice(-5).reverse().map((r) => `[${r.key}] ${cell(r.list)}`).join('; ')}`);
        }
      }
      if (maps.length > 1) {
        const per = diffs.map((d) => maps.map((m) => {
          const rs = results.filter((r) => r.st === st.name && r.diff === d && r.map === m);
          return `${m.slice(0, 5)} ${rs.filter((r) => r.won).length}/${rs.length} W${(rs.reduce((x, r) => x + r.wave, 0) / rs.length).toFixed(0)}`;
        }).join(', '));
        diffs.forEach((d, i) => console.log(`   ${d}: ${per[i]}`));
      }
    }
    process.exit(0);
  }
  if (args.includes('--strength')) {
    // Stärke einer Strategie: der größte Faktor auf die Lebenspunkte der Gegner (Normal), mit dem sie noch gewinnt,
    // je Karte und im Mittel; dahinter Welle und Lecks beim ersten Faktor, der auf der ersten Karte verliert.
    for (const st of list) {
      const found = [];
      let note = '';
      for (const mapId of maps) {
        // Mehrere Startwerte (--seed 7,11,13): je Startwert eine eigene Suche, gemittelt.
        let sum = 0;
        for (const sd of seeds) {
          let lo = 0.4;
          let hi = 3.2;
          for (let k = 0; k < 6; k++) {
            const f = (lo + hi) / 2;
            const c = { ...base, balance: { ...base.balance, difficulty: { ...base.balance.difficulty, normal: { ...base.balance.difficulty.normal, hp: f } } } };
            const r = run(st, mapId, 'normal', sd, c, loadout);
            if (r.won) lo = f;
            else {
              hi = f;
              if (mapId === maps[0] && sd === seed) note = `verliert bei ${f.toFixed(2)} in Welle ${r.wave + 1}: ${JSON.stringify(r.leakBy)}`;
            }
          }
          sum += lo;
        }
        found.push(sum / seeds.length);
      }
      const mean = found.reduce((a, b) => a + b, 0) / found.length;
      console.log(`${st.name.padEnd(18)}${mean.toFixed(2)}  [${found.map((v) => v.toFixed(2)).join(' ')}]  (${note})`);
    }
    process.exit(0);
  }
  for (const mapId of maps) {
    console.log(`\n== ${mapId} (Startwert ${seed}) ==   Ergebnis: Welle/Leben (${total}/x = gewonnen), S = Superwaffen, Rest = Gold am Ende`);
    console.log(`${'Strategie'.padEnd(18)}${diffs.map((d) => d.padEnd(22)).join('')}`);
    for (const st of list) {
      const cells = [];
      /** @type {ReturnType<typeof run>[]} */
      const results = [];
      for (const d of diffs) {
        const r = run(st, mapId, d, seed, base, loadout);
        results.push(r);
        cells.push(`${r.wave}/${r.lives} S${r.supers}${r.megas ? `M${r.megas}` : ''} R${r.gold}`.padEnd(22));
        if (detail) cells.push(`[${r.boons.join(',')}] `);
      }
      console.log(`${st.name.padEnd(18)}${cells.join('')}`);
      if (detail) {
        for (let k = 0; k < diffs.length; k++) {
          const r = results[k];
          const total = Object.values(r.dmg).reduce((a, b) => a + b, 0) || 1;
          const share = Object.entries(r.dmg).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${id} ${Math.round((100 * v) / total)}%`).join(', ');
          console.log(`   ${diffs[k]}: Gold zu Wellenbeginn ${r.goldAtStart.join(' ')}`);
          console.log(`   ${diffs[k]}: Schaden ${share}`);
          console.log(`   ${diffs[k]}: Türme ${r.mix}; Zahl zu Beginn jedes Zeitalters ${r.towersPerAge.join(' ')}`);
          console.log(`   ${diffs[k]}: Ausgaben ${Object.entries(r.spentOn).map(([key, v]) => `${key} ${Math.round(v)}`).join(', ')}; verdient ${Math.round(r.earned)}`);
          console.log(`   ${diffs[k]}: Lecks je Welle ${JSON.stringify(r.leaks)} nach Gegner ${JSON.stringify(r.leakBy)}`);
          console.log(`   ${diffs[k]}: Schaden je Gold (Mega, Super, übrige) ${r.perGold.map((v) => v.toFixed(1)).join(' / ')}`);
        }
      }
    }
  }
}
