// @ts-check
// Die Karten (Spielentwurf Kapitel 7), sortiert von leicht nach schwer. Spielfeld 18 x 12 Felder, x von 0 (links) bis 17,
// z von 0 (oben) bis 11. Wegpunkte sind verbindlich; der Eingang liegt ein Feld außerhalb des Spielfelds. Reine Daten.
// Stufen (`stages`, Index = Position des Zeitalters in der Partie: 0 Steinzeit, 1 Rom, 2 Mittelalter, 3 Entdecker, 4 Industrie,
// 5 Zukunft):
// ab diesem Zeitalter gelten andere Wege.
// Jedes Feld, das in irgendeiner Stufe Weg ist, ist von Anfang an nicht bebaubar; deshalb nehmen die Stufen möglichst wenige
// neue Felder in Anspruch und nutzen, wo es geht, vorhandene Wegstücke weiter.

/** @import { MapDef } from '../types/content' */

/** @type {MapDef[]} */
export const MAPS = [
  {
    id: 'flusstal',
    name: 'Flusstal',
    description: 'Ein gemütliches S durch das Tal. Wer zwischen zwei Bahnen baut, bewacht beide. Für den Einstieg.',
    width: 18,
    height: 12,
    paths: [
      [[-1, 2], [14, 2], [14, 6], [3, 6], [3, 10], [18, 10]],
    ],
    // Fels und Teich: je einer in den beiden Taschen (Zeile 4 und 8), zwei Tümpel an den Außenseiten der Kehren.
    blocked: [[9, 4], [11, 8], [16, 4], [16, 5], [0, 8], [1, 8], [6, 0]],
    // Besondere Felder: Die Kraftquelle (6, 4) liegt mitten in der oberen Tasche, rundum Platz für eine Superwaffe, die zwei
    // Bahnen sieht. Der Sumpf (5, 8) liegt auf dem besten Feld der unteren Tasche (Kehre und zwei Bahnen): teuer, aber stark.
    // Die Anhöhe (15, 4) an der östlichen Kehre sieht drei Wegstücke, neben ihr ist es eng (Teich). Der Taktstein (17, 6)
    // liegt weit draußen am Ostufer; nur Weitreichende (Panzerknacker, Scharfschütze) holen von dort etwas heraus.
    tiles: [
      { tx: 6, tz: 4, kind: 'quelle' },
      { tx: 5, tz: 8, kind: 'sumpf' },
      { tx: 15, tz: 4, kind: 'hoehe' },
      { tx: 17, tz: 6, kind: 'takt' },
    ],
    // Keine Stufen: Das Flusstal ist die Karte für den Einstieg und bleibt die ganze Partie über gleich. (Gemessen: Schon eine
    // sanfte Abkürzung in der Zukunft, etwa ein Steg im Norden oder eine Brücke über die obere Tasche, kostete den Bot 0,15 bis
    // 0,5 Stärke, denn das letzte Zeitalter entscheidet; mit eigener Luftlinie trafen die Drohnen auf keine Flugabwehr.)
    seed: 1701,
  },
  {
    id: 'kreuzweg',
    name: 'Kreuzweg',
    description: 'Der Weg schlägt eine Schleife und kreuzt sich selbst: An der Kreuzung hat ein Turm jeden Gegner zweimal vor sich. Für den Einstieg.',
    width: 18,
    height: 12,
    paths: [
      [[-1, 6], [12, 6], [12, 2], [6, 2], [6, 10], [18, 10]],
    ],
    // Die Kreuzung liegt auf (6, 6). Felsen an drei ihrer vier Ecken (5, 5), (7, 5), (7, 7): Nur (5, 7) steht direkt daneben.
    // Ein Teich quer durch die Schleife (Zeile 4), sonst wäre ihr Inneres eine einzige Todeszone; ein paar Felsen an der
    // Strecke nach Süden und am Schlussstück (5, 9), (9, 8), (10, 9), der Rest verstreut.
    blocked: [[5, 5], [7, 5], [7, 7], [8, 4], [9, 4], [10, 4], [5, 9], [9, 8], [10, 9], [4, 4], [4, 8], [8, 8], [12, 8], [15, 3]],
    // Besondere Felder: Sumpf auf (5, 7), dem einzigen freien Feld direkt an der Kreuzung: der beste Platz der Karte kostet
    // ein gutes Drittel mehr. Die Kraftquelle (13, 4) liegt östlich der Schleife auf offenem Land, rundum Platz für eine
    // Superwaffe, aber weit weg von der Kreuzung. Die Anhöhe (11, 3) steht in der inneren Ecke der Schleife, sieht drei
    // Wegstücke, hat aber nur zwei Nachbarn. Der Taktstein (2, 3) liegt weit im Nordwesten: nur für Weitreichende.
    // (Merkwürdig, aber gemessen: Der Sumpf macht die Karte für den Bot LEICHTER, Stärke 1,10 -> 1,47, gleich ob er auf (5, 7),
    // (7, 4) oder (7, 8) liegt; der Bot plant mit weniger Gold anders und kommt dabei zu mehr Superwaffen.)
    tiles: [
      { tx: 5, tz: 7, kind: 'sumpf' },
      { tx: 13, tz: 4, kind: 'quelle' },
      { tx: 11, tz: 3, kind: 'hoehe' },
      { tx: 2, tz: 3, kind: 'takt' },
    ],
    // Im Mittelalter öffnet sich im Norden ein zweites Tor (8, -1): Jeder zweite Feuerdieb steigt oben in die Schleife ein, läuft
    // nur ihre Westhälfte und einmal über die Kreuzung, und seine Flieger kommen von Norden. Die Kreuzung und das Schlussstück
    // bleiben für alle; die Flugabwehr braucht eine zweite Stellung. Nur zwei neue Wegfelder (8, 0) und (8, 1).
    // Warum der Kreuzweg so leicht war (Stärke 1,47, Protokoll Schritt 15 in tools/balance.mjs): Der Sumpf änderte nur, ob der
    // Bot die Gebühr der ersten Superwaffe vor dem Feldherrn in Welle 20 zusammenbekommt. Hat er sie, entscheidet die Zukunft,
    // und dort deckt eine Stellung im Inneren der Schleife Boden UND Luftlinie. Das Nordtor nimmt ihr diesen Doppelnutzen.
    // (Tor auf (9, -1): Stärke 0,92, die Drohnen der Ostlinie trafen auf nichts; (3, -1) 1,33; Umleitungen am Boden ohne neue
    // Luftlinie, etwa an der Schleife vorbei nach Osten, änderten fast nichts.)
    stages: [null, null, {
      name: 'Das Nordtor',
      text: 'Im Norden öffnet sich ein zweites Tor. Jeder zweite Feuerdieb springt mitten in die Schleife, und seine Flieger kommen von Norden.',
      paths: [
        [[-1, 6], [12, 6], [12, 2], [6, 2], [6, 10], [18, 10]],
        [[8, -1], [8, 2], [6, 2], [6, 10], [18, 10]],
      ],
    }],
    seed: 4111,
  },
  {
    id: 'zwillingsfurt',
    name: 'Zwillingsfurt',
    description: 'Zwei Tore, ein Ziel. Die Feuerdiebe wechseln sich ab, erst auf dem letzten Stück laufen sie zusammen. Für Fortgeschrittene.',
    width: 18,
    height: 12,
    paths: [
      [[-1, 1], [3, 1], [3, 4], [7, 4], [7, 1], [10, 1], [10, 5], [14, 5], [14, 8], [18, 8]],
      [[-1, 10], [3, 10], [3, 7], [7, 7], [7, 10], [10, 10], [10, 5], [14, 5], [14, 8], [18, 8]],
    ],
    // Je ein Fels in den beiden Schleifen, ein Teich am Westufer, einer neben dem gemeinsamen Stück.
    blocked: [[5, 2], [5, 9], [0, 5], [0, 6], [12, 2], [12, 9], [12, 6], [16, 10]],
    // Besondere Felder: In der Tasche am gemeinsamen Schlussstück die Anhöhe (11, 6), die Spalte 10 und Zeile 5 sieht, aber nur
    // zwei freie Nachbarn hat (kein Platz für eine Superwaffe), und der Sumpf (13, 6) auf dem zweitbesten Feld; dazwischen bleibt
    // (12, 7), das beste Feld, gewöhnlich. Die Kraftquelle (5, 5) liegt in der gemeinsamen Tasche zwischen den beiden Toren, wo
    // eine Superwaffe beide Bahnen früh erreicht. Der Taktstein (16, 3) liegt abseits im Nordosten; das Schlussstück erreichen
    // von dort nur Weitreichende. (Anhöhen in den Schleifen der Tore, die nur eine Bahn sehen, waren eine Falle: Der Bot baute
    // dort und verlor. Ein Sumpf auf (12, 7) kostete den ersten Turm der Partie den Aufschlag, Stärke 1,01 -> 0,80.)
    tiles: [
      { tx: 13, tz: 6, kind: 'sumpf' },
      { tx: 11, tz: 6, kind: 'hoehe' },
      { tx: 5, tz: 5, kind: 'quelle' },
      { tx: 16, tz: 3, kind: 'takt' },
    ],
    // In der Nahen Zukunft führt eine Brücke über die nördliche Furt (drei neue Wegfelder (4..6, 1)): Das obere Tor läuft
    // geradeaus zum Treffpunkt und spart sich seine Schleife. Die Kraftquelle (5, 5) sieht dann nur noch die südliche Schleife,
    // Türme an der Brücke und am gemeinsamen Stück gewinnen. Die Luftlinie bleibt dieselbe. (Mit fünf Zeitaltern gemessen, bester
    // Bot, Normal, 10 Startwerte: Brücke im Mittelalter 1 Sieg, bei den Entdeckern 4, ohne Brücke 6. Mit sechs Zeitaltern,
    // 20 Startwerte: bei den Entdeckern 3, in der Industrie 3, in der Zukunft 6, ohne Brücke 7. Die Brücke vor der Industrie traf
    // den Bot bei den Dampfwagen, deren Fahrgäste auf dem kurzen Weg nahe der Flamme ausstiegen; Protokoll Schritt 19.)
    stages: [null, null, null, null, null, {
      name: 'Die Brücke',
      text: 'Über die nördliche Furt führt jetzt eine Brücke: Das obere Tor läuft geradeaus und spart sich seine Schleife.',
      paths: [
        [[-1, 1], [10, 1], [10, 5], [14, 5], [14, 8], [18, 8]],
        [[-1, 10], [3, 10], [3, 7], [7, 7], [7, 10], [10, 10], [10, 5], [14, 5], [14, 8], [18, 8]],
      ],
    }],
    seed: 2902,
  },
  {
    id: 'schneckenhaus',
    name: 'Schneckenhaus',
    description: 'Anderthalb Ringe bis zur Flamme in der Mitte. Am Boden ein weiter Bogen, durch die Luft ein Katzensprung. Für Fortgeschrittene.',
    width: 18,
    height: 12,
    paths: [
      [[-1, 1], [16, 1], [16, 10], [1, 10], [1, 5], [9, 5]],
    ],
    // Früher eine volle Spirale mit zweitem Ring (80 Felder Weg, viel zu gutmütig); jetzt nur der äußere Ring und ein Arm zur Mitte
    // (53 Felder). Felsen zwischen Ring und Arm und in den Ecken; der Kern rund um die Flamme bleibt frei für die Flugabwehr.
    blocked: [[8, 2], [15, 6], [6, 9], [2, 6], [0, 11], [17, 11], [17, 0]],
    // Besondere Felder: Die Anhöhe (8, 3) steht zwischen Ring und Arm, Felsen darüber und darunter; sie sieht den Ring, den
    // Arm und das Ende der Luftlinie. Die Kraftquelle (3, 8) liegt in der geräumigen Südwestecke zwischen Ring und Arm, gut
    // für eine Superwaffe. Der Sumpf (15, 2) besetzt die Nordostecke, wo der Ring abbiegt. Der Taktstein (12, 6) liegt im
    // stillen Osten des Kerns: kein Weg in drei Feldern, nur Weitreichende nutzen ihn.
    tiles: [
      { tx: 8, tz: 3, kind: 'hoehe' },
      { tx: 3, tz: 8, kind: 'quelle' },
      { tx: 15, tz: 2, kind: 'sumpf' },
      { tx: 12, tz: 6, kind: 'takt' },
    ],
    // Im Mittelalter kehrt sich die Spirale um: Das Tor wandert in die Südwestecke (-1, 10), die Feuerdiebe laufen den Ring
    // andersherum und biegen von Norden über (1, 2..4) zur Flamme ab. Vier neue Wegfelder; das Stück (1, 6..9) im Südwesten
    // fällt weg, die Luftlinie kommt jetzt von Südwesten. Was am Ring steht, bleibt wertvoll, schießt aber auf die andere Seite.
    stages: [null, null, {
      name: 'Die Spirale kehrt sich um',
      text: 'Das Tor ist in die Südwestecke gewandert: Die Feuerdiebe laufen den Ring andersherum und biegen von Norden zur Flamme ab.',
      paths: [
        [[-1, 10], [16, 10], [16, 1], [1, 1], [1, 5], [9, 5]],
      ],
    }],
    seed: 3803,
  },
  {
    id: 'felsenmeer',
    name: 'Felsenmeer',
    description: 'Eine kleine Insel voller Felsen. Bauplätze sind knapp, und die Lichtungen zwischen den Bahnen sind heiß begehrt. Für Fortgeschrittene.',
    width: 16,
    height: 10,
    paths: [
      [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 8], [12, 8], [12, 3], [16, 3]],
    ],
    // Kleineres Spielfeld (16 x 10) und Felsen in Gruppen, vor allem in den beiden Taschen der Schlangenlinie, wo ein Turm
    // sonst zwei Bahnen deckt; in der schmalen rechten Tasche bleibt nur ein Viererblock (9..10, 6..7) für eine Superwaffe.
    // Die Ecken weit weg vom Weg bleiben zum Teil frei, damit die Insel nicht nur aus Fels besteht.
    blocked: [
      [0, 0], [1, 0], [6, 0], [7, 0], [11, 0], [12, 0],
      [0, 1], [12, 1],
      [1, 2], [6, 2], [7, 2], [10, 2], [14, 2],
      [1, 3], [5, 3], [6, 3], [10, 3],
      [2, 4], [4, 4], [5, 4], [9, 4], [10, 4], [11, 4],
      [6, 5], [7, 5], [9, 5], [10, 5], [11, 5], [14, 5],
      [0, 6], [4, 6], [5, 6], [11, 6],
      [5, 7], [6, 7], [11, 7], [13, 7],
      [1, 8], [15, 8],
      [3, 9], [7, 9], [8, 9], [14, 9], [15, 9],
    ],
    // Besondere Felder: Sumpf auf (9, 7) im einzigen Viererblock für eine Superwaffe, auf dem schwächsten seiner vier Felder:
    // Wer dort drei Türme verschmelzen will, zahlt für einen davon mehr (auf (10, 6) traf der Aufschlag schon den ersten Turm
    // der Partie, und die Karte wurde schwerer als der Zangengriff).
    // Die Kraftquelle (2, 6) liegt am Eingang in der Lichtung links unten, dem zweiten Platz für drei Türme. Die Anhöhe
    // (13, 4) steht zwischen den letzten beiden Bahnen, hat aber nur zwei Nachbarn. Der Taktstein (14, 0) liegt in der
    // Nordostecke, weit weg vom Weg.
    tiles: [
      { tx: 9, tz: 7, kind: 'sumpf' },
      { tx: 2, tz: 6, kind: 'quelle' },
      { tx: 13, tz: 4, kind: 'hoehe' },
      { tx: 14, tz: 0, kind: 'takt' },
    ],
    // Im Mittelalter öffnet ein Felssturz eine Rinne im Süden (5, 10): Jeder zweite Feuerdieb kommt durch sie, läuft unter der
    // Lichtung entlang und trifft bei (8, 8) auf die letzte Schleife. Vier neue Wegfelder (5, 8..9), (6..7, 8). Der Viererblock
    // mit dem Sumpf (9..10, 6..7) sieht dann alle Feuerdiebe, die Lichtung der Kraftquelle (2, 6) nur noch die Hälfte. (Erst in
    // der Zukunft geöffnet kostete die Rinne den Bot 0,07 Stärke, im Mittelalter nichts: Er hat ein Zeitalter Zeit, sich
    // einzurichten, bevor die Drohnen kommen.)
    stages: [null, null, {
      name: 'Der Felssturz',
      text: 'Ein Felssturz hat im Süden eine Rinne geöffnet. Jeder zweite Feuerdieb kommt durch sie und spart sich die halbe Insel.',
      paths: [
        [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 8], [12, 8], [12, 3], [16, 3]],
        [[5, 10], [5, 8], [12, 8], [12, 3], [16, 3]],
      ],
    }],
    seed: 7459,
  },
  {
    id: 'zangengriff',
    name: 'Zangengriff',
    description: 'Die Feuerdiebe kommen von beiden Seiten und treffen sich erst in der Mitte. Wer nur eine Flanke sichert, verliert die andere. Für Könner.',
    width: 18,
    height: 12,
    paths: [
      [[-1, 1], [6, 1], [6, 4], [2, 4], [2, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
      [[18, 1], [11, 1], [11, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
    ],
    // Tor im Westen und Tor im Osten, die Wege treffen sich auf (8, 7) und laufen gemeinsam zur Flamme am Südufer.
    // Felsen in der Mitte zwischen den beiden Haken (Spalten 8 und 9): Felder, die beide Flanken decken, sind knapp.
    blocked: [[8, 2], [9, 2], [8, 4], [9, 5], [0, 9], [17, 9], [16, 11], [6, 10]],
    // Besondere Felder, nur drei, denn dies ist die schwerste Karte: Die Kraftquelle (8, 6) liegt direkt über dem Treffpunkt
    // beider Flanken, Platz für eine Superwaffe rundum. Sumpf auf (13, 3), dem besten Platz der Ostflanke zwischen ihren beiden
    // Bahnen: Wer die Ostflanke dort sichert, zahlt mehr, als die Westflanke am gleichen Platz (4, 3) kostet. Der Taktstein (9, 0)
    // liegt am Nordufer zwischen den Toren; beide Eingänge erreichen von dort nur Weitreichende. (Ein Sumpf auf dem Knick (5, 10)
    // oder dem Trichter (9, 9) trieb den Bot von Plätzen, die ihm schadeten, und machte die Karte leichter: Stärke 0,93 -> 1,15;
    // eine Anhöhe auf (13, 3) 0,98.)
    tiles: [
      { tx: 13, tz: 3, kind: 'sumpf' },
      { tx: 8, tz: 6, kind: 'quelle' },
      { tx: 9, tz: 0, kind: 'takt' },
    ],
    // Die Karte, die sich am meisten wandelt. Im Mittelalter öffnet sich zwischen den Zangen ein drittes Tor (10, -1): Seine
    // Feuerdiebe laufen die Spalte 10 hinab und stoßen bei (11, 4) auf die zweite Bahn der Ostflanke; die Gegner wechseln
    // reihum zwischen drei Toren. Der Taktstein (9, 0) steht damit direkt am dritten Tor, der Sumpf (13, 3) sieht die Ostflanke
    // doppelt belaufen. Bei den Entdeckern (mit vier Zeitaltern war das die Zukunft) fällt im Westhaken eine Mauer: Die
    // Westflanke kürzt über (4, 5..6) ab und spart vier Felder; Türme in der Westtasche (3, 5..6) sehen dann weniger. Sieben neue
    // Wegfelder (10, 0..4) und (4, 5..6). So wandelt sich die Karte in jedem der drei späten Zeitalter: drittes Tor, Westhaken,
    // Drohnen.
    // (Gemessen, Stärke mit vier Zeitaltern: nur das dritte Tor in der Zukunft 1,05, leichter als ohne Stufen, denn seine Luftlinie
    // läuft über die Mitte, wo ohnehin alles steht; die volle Abkürzung (6, 4) -> (6, 7) im Mittelalter 0,80; so wie hier 0,87.
    // Mit fünf Zeitaltern, bester Bot, Normal, 10 Startwerte: Westhaken bei den Entdeckern 8 Siege, in der Zukunft gleich, drittes
    // Tor schon in Rom 9, volle Abkürzung bei den Entdeckern 8, ohne Stufen 7, ein zusätzliches Südwesttor (-1, 8) in der Zukunft 8.
    // Der Bot verteidigt das lange gemeinsame Stück im Süden, daran ändern Stufen wenig.)
    stages: [null, null, {
      name: 'Das dritte Tor',
      text: 'Zwischen den Zangen öffnet sich ein drittes Tor. Seine Feuerdiebe stoßen mitten auf die Ostflanke, seine Flieger kommen von Norden.',
      paths: [
        [[-1, 1], [6, 1], [6, 4], [2, 4], [2, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
        [[18, 1], [11, 1], [11, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
        [[10, -1], [10, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
      ],
    }, {
      name: 'Der Westhaken bricht',
      text: 'Im Westen ist eine Mauer gefallen. Die Feuerdiebe der Westflanke kürzen ihren Haken ab und sind früher am Treffpunkt.',
      paths: [
        [[-1, 1], [6, 1], [6, 4], [4, 4], [4, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
        [[18, 1], [11, 1], [11, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
        [[10, -1], [10, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]],
      ],
    }],
    seed: 6343,
  },
];
