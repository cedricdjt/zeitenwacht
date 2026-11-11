// @ts-check
// Die Wellen (Spielentwurf Kapitel 6). Alle sechs Zeitalter (Steinzeit, Rom, Mittelalter, Entdecker, Industrie, Nahe Zukunft)
// haben je zehn Wellen im Rhythmus Durchatmen, Neuheit, Tempo, Brocken, Mischung mit Zwischenboss, Elite, Tempo/Luft,
// Brocken II, Ansturm, Boss (mit dem Zwischenboss als Geleit). Nur Welle 1 ist zum Durchatmen; 4, 7, 8 und 9 bringen
// Elitedruck. Reine Daten.
// Die Zahl der Wellen eines Zeitalters ist nirgends festgeschrieben: Es gilt die Länge der Liste.
//
// Eine Welle erscheint über etwa 25 bis 45 Sekunden. Rudel und Blöcke kommen dicht (0,35 bis 0,5 s Abstand),
// Brocken einzeln mit Luft dazwischen. Auf Karten mit zwei Toren wechseln die Gegner einer Gruppe reihum.
// Benachbarte Wellen unterscheiden sich in Zusammensetzung und Takt: Strom, Schübe, Kolonne, Geleitzug.

/** @import { SpawnGroup, WaveDef } from '../types/content' */

/**
 * Eine Gruppe gleicher Gegner.
 * @param {string} enemy Kennung des Gegners
 * @param {number} count Anzahl
 * @param {number} delay Sekunden nach Wellenbeginn, zu denen der erste erscheint
 * @param {number} [interval] Sekunden zwischen zwei Gegnern der Gruppe
 * @returns {SpawnGroup}
 */
function group(enemy, count, delay, interval = 0) {
  return { enemy, count, interval, delay };
}

/**
 * Mehrere gleich große Schübe desselben Gegners.
 * @param {string} enemy Kennung des Gegners
 * @param {number} count Anzahl je Schub
 * @param {number[]} delays Beginn jedes Schubs in Sekunden
 * @param {number} interval Sekunden zwischen zwei Gegnern eines Schubs
 * @returns {SpawnGroup[]}
 */
function bursts(enemy, count, delays, interval) {
  return delays.map((delay) => group(enemy, count, delay, interval));
}

/**
 * @param {string} hint Hinweis für die Vorschau
 * @param {(SpawnGroup | SpawnGroup[])[]} groups
 * @returns {WaveDef}
 */
function wave(hint, ...groups) {
  return { hint, groups: groups.flat() };
}

/** @type {WaveDef[][]} */
export const WAVES = [
  // ------------------------------------------------------------------------------------------- Steinzeit (Wellen 1-10)
  [
    // 1 Durchatmen: 10 Keulenschwinger, einer alle 1,6 s. Bauen, zusehen, verdienen.
    wave('Ein paar Keulenschwinger zum Aufwärmen.',
      group('keule', 10, 0, 1.6)),
    // 2 Neuheit: 8 Keulenschwinger, dann 2 Rudel zu 10 Frischlingen.
    wave('Viele Kleine im Rudel: Da hilft der Werfer.',
      group('keule', 8, 0, 2.2),
      bursts('frischling', 10, [15, 25], 0.4)),
    // 3 Tempo: 12 Keulenschwinger, dazwischen 8 Wölfe paarweise.
    wave('Wölfe! Zu schnell, bis sie kleben bleiben.',
      group('keule', 12, 0, 2.2),
      bursts('wolf', 2, [5, 12, 19, 26], 0.6)),
    // 4 Brocken: 4 Wollnashörner, jedes mit 2 Wölfen im Windschatten, 10 Keulenschwinger.
    wave('Wollnashörner mit Wolfsgeleit: großes Ziel, großer Treffer.',
      group('nashorn', 4, 0, 6),
      bursts('wolf', 2, [2, 8, 14, 20], 0.6),
      group('keule', 10, 9, 1.8)),
    // 5 Mischung mit Zwischenboss: 12 Frischlinge, 10 Keulenschwinger, Der Leitwolf mit 8 Wölfen.
    wave('Der Leitwolf führt sein Rudel an. Feuer auf die Menge!',
      bursts('frischling', 6, [0, 22], 0.4),
      group('keule', 10, 3, 2.2),
      group('leitwolf', 1, 12),
      bursts('wolf', 4, [10, 15], 0.6)),
    // 6 Elite: 3 Nashorn-Paare, jedes mit 4 Wölfen als Geleit, dazwischen 8 Keulenschwinger.
    wave('Drei Nashorn-Paare mit Wolfsgeleit. Ein Trommler bringt die Nachbarn in Takt.',
      bursts('nashorn', 2, [0, 13, 26], 2.5),
      bursts('wolf', 4, [3, 16, 29], 0.6),
      group('keule', 8, 7, 2)),
    // 7 Tempo II: 30 Wölfe in 3 Rudeln, dazwischen 3 Rudel zu 8 Frischlingen, 2 Wollnashörner als Bremsklotz.
    wave('Das ganze Wolfsrudel, dreimal hintereinander, und Nashörner mittendrin.',
      bursts('wolf', 10, [0, 11, 22], 0.45),
      bursts('frischling', 8, [5, 16, 27], 0.4),
      group('nashorn', 2, 8, 12)),
    // 8 Brocken II: 10 Wollnashörner als Herde dicht an dicht, 10 Keulenschwinger hinterher.
    wave('Eine ganze Nashornherde, dicht an dicht.',
      group('nashorn', 10, 0, 2.2),
      group('keule', 10, 14, 1.6)),
    // 9 Ansturm: 20 Keulenschwinger, 32 Frischlinge, 18 Wölfe, 6 Wollnashörner.
    wave('Der große Ansturm: alles, was Fell hat.',
      group('keule', 20, 0, 1.4),
      bursts('frischling', 8, [2, 11, 20, 29], 0.35),
      group('wolf', 18, 5, 1.5),
      group('nashorn', 6, 4, 5.5)),
    // 10 Boss: 3 Wollnashörner voraus, Das Alte Mammut, 2 Leitwölfe mit 8 Wölfen, zuletzt 12 Frischlinge.
    wave('Der Boden bebt: Das Alte Mammut kommt, und zwei Leitwölfe kommen mit.',
      group('nashorn', 3, 0, 5),
      group('mammut', 1, 12),
      group('leitwolf', 2, 20, 12),
      bursts('wolf', 4, [18, 30], 0.6),
      group('frischling', 12, 26, 0.45)),
  ],

  // ------------------------------------------------------------------------------------------- Römisches Reich (Wellen 11-20)
  [
    // 1 Durchatmen: 14 Plänkler, 6 Reiter.
    wave('Plänkler und ein paar Reiter. Zeit zum Modernisieren.',
      group('plaenkler', 14, 0, 1.9),
      bursts('reiter', 3, [10, 22], 0.8)),
    // 2 Neuheit: 3 Blöcke zu 6 Legionären, 6 Plänkler.
    wave('Legionäre im Block: Kleine Geschosse prallen ab.',
      bursts('legionaer', 6, [0, 12, 24], 0.5),
      group('plaenkler', 6, 6, 2.5)),
    // 3 Tempo: 12 Reiter in 2 Schüben, 10 Plänkler.
    wave('Reiter in zwei Schüben. Der Bremser hat zu tun.',
      bursts('reiter', 6, [0, 22], 0.8),
      group('plaenkler', 10, 4, 2.2)),
    // 4 Brocken: 3 Schildkröten-Trupps, 8 Legionäre, 6 Reiter, die an den Schilden vorbeiziehen.
    wave('Schildkröten-Trupps, und die Reiter nutzen die Deckung.',
      group('testudo', 3, 0, 9),
      group('legionaer', 8, 4, 2.5),
      bursts('reiter', 3, [12, 24], 0.7)),
    // 5 Mischung mit Zwischenboss: 12 Plänkler, Der Zenturio mit 6 Legionären, 4 Reiter, 1 Schildkröten-Trupp.
    wave('Der Zenturio treibt seine Legionäre an. Panzerknacker auf den Stärksten!',
      group('plaenkler', 12, 0, 2.2),
      group('legionaer', 6, 10, 0.6),
      group('zenturio', 1, 14),
      group('reiter', 4, 18, 2),
      group('testudo', 1, 24)),
    // 6 Elite: 4 Schildkröten-Trupps, jeder mit 4 Legionären als Leibwache.
    wave('Vier Schildkröten mit Leibwache. Feuer kriecht unter jeden Schild.',
      group('testudo', 4, 0, 10),
      bursts('legionaer', 4, [1.5, 11.5, 21.5, 31.5], 0.6)),
    // 7 Tempo II: 24 Reiter als Strom ohne Pause, 2 Trupps zu 8 Plänklern, 6 Legionäre im Laufschritt.
    wave('Kavallerie ohne Pause, und Legionäre laufen mit.',
      group('reiter', 24, 0, 1.2),
      bursts('plaenkler', 8, [8, 21], 0.5),
      group('legionaer', 6, 14, 1.5)),
    // 8 Brocken II: 6 Schildkröten-Trupps als Kolonne, 12 Legionäre in Marschordnung.
    wave('Eine Kolonne aus Schilden. Panzerknacker nach vorn!',
      group('testudo', 6, 0, 4.5),
      group('legionaer', 12, 8, 1.6)),
    // 9 Ansturm: 18 Plänkler, 18 Legionäre in 3 Blöcken, 14 Reiter, 3 Schildkröten-Trupps.
    wave('Die ganze Legion rückt an.',
      group('plaenkler', 18, 0, 1.6),
      bursts('legionaer', 6, [4, 16, 28], 0.5),
      group('reiter', 14, 9, 1.6),
      group('testudo', 3, 10, 10)),
    // 10 Boss: 2 Blöcke Legionäre, Feldherr im Triumphwagen, 2 Zenturionen hinter ihm, 10 Reiter als später Stich.
    wave('Der Feldherr fährt vor, und seine Zenturionen marschieren hinterher.',
      bursts('legionaer', 6, [0, 8], 0.5),
      group('feldherr', 1, 16),
      group('zenturio', 2, 22, 8),
      group('reiter', 10, 34, 0.8)),
  ],

  // ------------------------------------------------------------------------------------------- Mittelalter (Wellen 21-30)
  [
    // 1 Durchatmen: 16 Fußknechte, 6 Strauchdiebe.
    wave('Fußknechte und ein paar Strauchdiebe. Zeit zum Modernisieren.',
      group('knecht', 16, 0, 1.6),
      bursts('strauchdieb', 2, [8, 16, 24], 0.7)),
    // 2 Neuheit: 3 Gruppen zu 6 Fußknechten, in jeder ein Spielmann.
    wave('Spielleute heilen ihre Kameraden: zuerst den Spielmann!',
      bursts('knecht', 6, [0, 12, 24], 0.9),
      group('spielmann', 3, 2, 12)),
    // 3 Tempo: 16 Strauchdiebe in 2 Schüben, 8 Fußknechte.
    wave('Strauchdiebe in zwei Schüben. Sie rennen!',
      bursts('strauchdieb', 8, [0, 22], 0.6),
      group('knecht', 8, 5, 2.2)),
    // 4 Brocken: 5 Ritter, hinter jedem zweiten ein Spielmann, 8 Fußknechte.
    wave('Ritter in voller Rüstung, und hinter ihnen spielt die Musik.',
      group('ritter', 5, 0, 5),
      group('spielmann', 3, 2, 10),
      group('knecht', 8, 18, 1.4)),
    // 5 Mischung mit Zwischenboss: 12 Fußknechte, 8 Strauchdiebe, 2 Ritter, Der Raubritter mit 2 Spielleuten.
    wave('Der Raubritter ist auf Beutezug, seine Spielleute dicht dahinter.',
      group('knecht', 12, 0, 2.2),
      bursts('strauchdieb', 4, [6, 20], 0.6),
      group('ritter', 2, 9, 4),
      group('raubritter', 1, 15),
      group('spielmann', 2, 17, 1.5)),
    // 6 Elite: 4 Lanzen aus je 2 Rittern, einem Spielmann und 2 Fußknechten als Geleit.
    wave('Vier Ritter-Lanzen mit Spielmann. Panzerknacker auf den Stärksten!',
      bursts('ritter', 2, [0, 10, 20, 30], 1.5),
      group('spielmann', 4, 3, 10),
      bursts('knecht', 2, [5, 15, 25, 35], 0.8)),
    // 7 Tempo II: 3 Banden zu 8 Strauchdieben, 14 Fußknechte im Laufschritt, 3 Ritter als Deckung.
    wave('Drei Diebesbanden, und Ritter decken ihnen den Rücken.',
      bursts('strauchdieb', 8, [0, 11, 22], 0.5),
      group('knecht', 14, 3, 1.6),
      group('ritter', 3, 6, 9)),
    // 8 Brocken II: 9 Ritter als Kolonne, 3 Spielleute mittendrin, 4 Fußknechte hinterher.
    wave('Eine Kolonne aus Rittern mit Musik. Feuer und Wucht nach vorn!',
      group('ritter', 9, 0, 2.8),
      group('spielmann', 3, 4, 8),
      group('knecht', 4, 26, 1.5)),
    // 9 Ansturm: 20 Fußknechte, 8 Ritter, 5 Spielleute, 16 Strauchdiebe in 2 Rudeln.
    wave('Das ganze Aufgebot stürmt die Burg.',
      group('knecht', 20, 0, 1.4),
      group('ritter', 8, 4, 3.8),
      group('spielmann', 5, 6, 6),
      bursts('strauchdieb', 8, [10, 24], 0.5)),
    // 10 Boss: 4 Ritter voraus, Der Schwarze Ritter, 2 Spielleute, Der Raubritter, 10 Strauchdiebe als später Stich.
    wave('Der Schwarze Ritter. Vorsicht, wenn sein Ross sich aufbäumt!',
      group('ritter', 4, 0, 3),
      group('schwarzritter', 1, 14),
      group('spielmann', 2, 18, 3),
      group('raubritter', 1, 26),
      group('strauchdieb', 10, 32, 0.6)),
  ],

  // ------------------------------------------------------------------------------------------- Zeitalter der Entdecker (Wellen 31-40)
  // Das erste Zeitalter mit Fliegern: Beutepapageien nehmen die Luftlinie, über Pfützen, Werfer und Brenner hinweg. Was sie
  // trifft: Schütze, Panzerknacker, die Flak (drei Schützen) und der Frostpuls einer Bremser-Superwaffe.
  [
    // 1 Durchatmen: 16 Piraten, 2 Rudel zu 6 Äffchen.
    wave('Piraten an Land, und sie haben Äffchen dabei. Zeit zum Modernisieren.',
      group('pirat', 16, 0, 1.6),
      bursts('aeffchen', 6, [12, 24], 0.4)),
    // 2 Neuheit: 8 Beutepapageien einzeln, 12 Piraten.
    wave('Beutepapageien nehmen die Luftlinie. Nur Schütze und Panzerknacker reichen hinauf.',
      group('papagei', 8, 0, 3.5),
      group('pirat', 12, 6, 2)),
    // 3 Tempo: 3 Rudel zu 10 Äffchen, 8 Piraten, 4 Beutepapageien.
    wave('Drei Rudel Äffchen. Sie sind schneller, als sie aussehen.',
      bursts('aeffchen', 10, [0, 11, 22], 0.35),
      group('pirat', 8, 4, 2.5),
      group('papagei', 4, 14, 3)),
    // 4 Brocken: 8 Kürassiere als Schwadron, 6 Beutepapageien darüber, 8 Piraten.
    wave('Kürassiere im Galopp: erst kleben lassen, dann knacken. Und oben kreisen Papageien.',
      group('kuerassier', 8, 0, 2.4),
      group('papagei', 6, 5, 2.5),
      group('pirat', 8, 14, 1.6)),
    // 5 Mischung mit Zwischenboss: 12 Piraten, 12 Äffchen, Käpt'n Flint mit 6 Beutepapageien, 3 Kürassiere.
    wave('Käpt’n Flint fliegt voraus, seine Papageien hinterher. Alles, was hinaufreicht, nach vorn!',
      group('pirat', 12, 0, 2),
      bursts('aeffchen', 6, [6, 20], 0.4),
      group('flint', 1, 12),
      group('papagei', 6, 14, 1.2),
      group('kuerassier', 3, 18, 3)),
    // 6 Elite: 3 Schwadronen zu 3 Kürassieren, über jeder 4 Beutepapageien, 6 Piraten.
    wave('Drei Schwadronen Kürassiere, über jeder ein Papageienschwarm.',
      bursts('kuerassier', 3, [0, 12, 24], 1.2),
      bursts('papagei', 4, [2, 14, 26], 0.8),
      group('pirat', 6, 6, 3)),
    // 7 Luft: 4 Schwärme zu 5 Beutepapageien, 2 Rudel zu 10 Äffchen, 6 Piraten.
    wave('Ein Himmel voller Papageien: Jetzt zählt, was in die Luft reicht.',
      bursts('papagei', 5, [0, 8, 16, 24], 0.7),
      bursts('aeffchen', 10, [4, 20], 0.35),
      group('pirat', 6, 10, 2.5)),
    // 8 Brocken II: 12 Kürassiere als Kolonne, 10 Piraten, 6 Beutepapageien.
    wave('Eine ganze Kolonne Kürassiere. Bremsen, dann Wucht!',
      group('kuerassier', 12, 0, 2.2),
      group('pirat', 10, 6, 1.8),
      group('papagei', 6, 16, 1.5)),
    // 9 Ansturm: 22 Piraten, 3 Rudel zu 8 Äffchen, 8 Kürassiere, 10 Beutepapageien.
    wave('Die ganze Mannschaft entert die Insel, zu Fuß, zu Pferd und durch die Luft.',
      group('pirat', 22, 0, 1.4),
      bursts('aeffchen', 8, [5, 17, 29], 0.35),
      group('kuerassier', 8, 8, 3.2),
      group('papagei', 10, 12, 2)),
    // 10 Boss: 4 Kürassiere voraus, Die Landgaleone (lässt dreimal je 3 Beutepapageien frei), Käpt'n Flint, 8 Piraten,
    // zuletzt 12 Äffchen.
    wave('Die Landgaleone rollt an. Aus ihrer Takelage flattern Papageien, Käpt’n Flint kreist oben.',
      group('kuerassier', 4, 0, 2.5),
      group('landgaleone', 1, 12),
      group('flint', 1, 22),
      group('pirat', 8, 24, 1.5),
      group('aeffchen', 12, 32, 0.4)),
  ],

  // ------------------------------------------------------------------------------------------- Industriezeitalter (Wellen 41-50)
  // Das zweite Zeitalter mit Fliegern: Heißluftballons sind langsam und zäh und stehlen je zwei Funken (Panzerknacker, Flak,
  // Schütze). Dampfwagen tragen vier Halunken, die dort aussteigen, wo der Wagen zerbricht; Hochräder sind die Schnellsten am Boden.
  [
    // 1 Durchatmen: 16 Halunken, 2 Pulks zu 3 Hochradfahrern.
    wave('Halunken auf Zehenspitzen, Herren auf Hochrädern. Zeit zum Modernisieren.',
      group('halunke', 16, 0, 1.6),
      bursts('hochrad', 3, [10, 24], 0.8)),
    // 2 Neuheit: 3 Dampfwagen weit auseinander, 6 Halunken.
    wave('Dampfwagen haben Fahrgäste: Wo einer zerbricht, steigen vier Halunken aus.',
      group('dampfwagen', 3, 0, 12),
      group('halunke', 6, 5, 2.5)),
    // 3 Tempo: 2 Pulks zu 7 Hochradfahrern, 8 Halunken, 3 Heißluftballons.
    wave('Hochräder in zwei Pulks, und oben schweben die ersten Ballons: zäh, zwei Funken.',
      bursts('hochrad', 7, [0, 20], 0.5),
      group('halunke', 8, 4, 2.5),
      group('ballon', 3, 8, 8)),
    // 4 Brocken: 3 Dampfwagen, 3 Heißluftballons darüber, 6 Hochradfahrer.
    wave('Dampfwagen in Kolonne, Ballons darüber: knacken, dann die Fahrgäste im Feuer empfangen.',
      group('dampfwagen', 3, 0, 5),
      group('ballon', 3, 3, 6),
      bursts('hochrad', 3, [12, 26], 0.6)),
    // 5 Mischung mit Zwischenboss: 10 Halunken, 6 Hochradfahrer, Der Kohlenbaron, 1 Dampfwagen, 3 Heißluftballons.
    wave('Der Kohlenbaron rollt an. Zerbricht sein Wagen, springt die ganze Bande heraus.',
      group('halunke', 10, 0, 2),
      bursts('hochrad', 3, [6, 22], 0.6),
      group('kohlenbaron', 1, 12),
      group('dampfwagen', 1, 18),
      group('ballon', 3, 16, 5)),
    // 6 Elite: 2 Geleitzüge aus je 2 Dampfwagen und 2 Heißluftballons, 6 Hochradfahrer.
    wave('Zwei Geleitzüge: Dampfwagen unten, Ballons oben, Hochräder dazwischen.',
      bursts('dampfwagen', 2, [0, 20], 3),
      bursts('ballon', 2, [2, 22], 2.5),
      bursts('hochrad', 3, [8, 28], 0.6)),
    // 7 Luft: 5 Paare Heißluftballons, 2 Pulks zu 8 Hochradfahrern, 6 Halunken.
    wave('Ein Himmel voller Ballons. Was hinaufreicht, nach vorn: Panzerknacker und Flak!',
      bursts('ballon', 2, [0, 7, 14, 21, 28], 2),
      bursts('hochrad', 8, [4, 20], 0.45),
      group('halunke', 6, 10, 2.5)),
    // 8 Brocken II: 5 Dampfwagen als Kolonne, 3 Heißluftballons, 6 Halunken.
    wave('Eine Kolonne aus Dampfwagen. Wo sie zerbrechen, muss das Feuer schon warten.',
      group('dampfwagen', 5, 0, 3),
      group('ballon', 3, 6, 6),
      group('halunke', 6, 18, 1.5)),
    // 9 Ansturm: 20 Halunken, 14 Hochradfahrer, 3 Dampfwagen, 5 Heißluftballons.
    wave('Schichtwechsel: Alle Halunken der Stadt sind unterwegs, auf Rädern und am Himmel.',
      group('halunke', 20, 0, 1.4),
      bursts('hochrad', 7, [5, 22], 0.45),
      group('dampfwagen', 3, 3, 9),
      group('ballon', 5, 10, 5)),
    // 10 Boss: 2 Dampfwagen voraus, Die Schwarze Berta (lässt bei halber Kraft 4 Halunken frei, am Ende 6), Der Kohlenbaron,
    // 3 Heißluftballons, zuletzt 10 Hochradfahrer.
    wave('Ein Pfiff in der Ferne: Die Schwarze Berta dampft heran, der Kohlenbaron fährt mit.',
      group('dampfwagen', 2, 0, 5),
      group('berta', 1, 12),
      group('kohlenbaron', 1, 22),
      group('ballon', 3, 18, 4),
      group('hochrad', 10, 32, 0.5)),
  ],

  // ------------------------------------------------------------------------------------------- Nahe Zukunft (Wellen 51-60)
  [
    // 1 Durchatmen: 20 Wachroboter, 10 Roboterhunde.
    wave('Wachroboter im Gleichschritt, Roboterhunde im Trab.',
      group('wachroboter', 20, 0, 1.3),
      bursts('roboterhund', 5, [10, 24], 0.7)),
    // 2 Neuheit: 5 Schildwagen weit auseinander, 12 Wachroboter.
    wave('Schildwagen: Die Blase lädt nach, wenn man aufhört zu treffen.',
      group('schildwagen', 5, 0, 7),
      group('wachroboter', 12, 6, 2)),
    // 3 Tempo: 2 Drohnenschwärme zu 16, 14 Roboterhunde.
    wave('Drohnen in der Luft und Hunde am Boden, zugleich.',
      bursts('drohne', 16, [0, 18], 0.35),
      bursts('roboterhund', 7, [8, 25], 0.7)),
    // 4 Brocken: 6 Schildwagen, darüber 14 Drohnen, 8 Wachroboter.
    wave('Sechs Schildwagen unter einem Drohnenschirm: Jetzt zählt Dauerschaden.',
      group('schildwagen', 6, 0, 5),
      group('drohne', 14, 10, 0.4),
      group('wachroboter', 8, 4, 2.5)),
    // 5 Mischung mit Zwischenboss: 14 Wachroboter, 8 Roboterhunde, Prototyp X-1 mit 3 Schildwagen, 12 Drohnen.
    wave('Prototyp X-1 verlässt die Versuchshalle, mit Geleit am Boden und in der Luft.',
      group('wachroboter', 14, 0, 2),
      group('schildwagen', 3, 6, 4),
      group('prototyp', 1, 12),
      group('roboterhund', 8, 16, 1.5),
      group('drohne', 12, 20, 0.35)),
    // 6 Elite: 2 Geleitzüge aus je 4 Schildwagen, 4 Roboterhunden und 12 Drohnen als Schirm.
    wave('Zwei Geleitzüge: Schildwagen unten, Drohnenschirm oben.',
      bursts('schildwagen', 4, [0, 20], 2.2),
      bursts('drohne', 12, [1, 21], 0.4),
      bursts('roboterhund', 4, [5, 25], 0.7)),
    // 7 Luft: 5 Drohnenschwärme zu 12 kurz nacheinander, 12 Roboterhunde.
    wave('Fünf Schwärme am Himmel: Jetzt zählt, was geradeaus schießt.',
      bursts('drohne', 12, [0, 7, 14, 21, 28], 0.35),
      group('roboterhund', 12, 3, 2.2)),
    // 8 Brocken II: 9 Schildwagen als Konvoi, 8 Wachroboter dazwischen, 12 Drohnen darüber.
    wave('Ein Konvoi aus neun Schildwagen. Brand hält die Blasen unten.',
      group('schildwagen', 9, 0, 3.2),
      group('wachroboter', 8, 2, 3.5),
      group('drohne', 12, 14, 0.4)),
    // 9 Ansturm: 22 Wachroboter, 14 Roboterhunde, 4 Drohnenschwärme zu 12, 5 Schildwagen.
    wave('Alles, was Räder, Beine oder Rotoren hat.',
      group('wachroboter', 22, 0, 1.4),
      group('schildwagen', 5, 3, 7),
      group('roboterhund', 14, 6, 1.8),
      bursts('drohne', 12, [8, 16, 24, 32], 0.35)),
    // 10 Boss: 3 Schildwagen, Goliath-Konvoi, Prototyp X-1, 14 Drohnen, 12 Roboterhunde als letzter Stich.
    wave('Das Finale: der Goliath-Konvoi, und ein Prototyp fährt hinterher.',
      group('schildwagen', 3, 0, 5),
      group('goliath', 1, 14),
      group('prototyp', 1, 22),
      group('drohne', 14, 26, 0.35),
      group('roboterhund', 12, 34, 0.7)),
  ],
];
