// @ts-check
// Zeitgaben (docs/briefs/fusion.md, Abschnitt 9; Spielentwurf Kapitel 2.12): Nach dem Boss eines Zeitalters wählt der Spieler eine
// von drei zufälligen Gaben, die bis zum Ende der Partie gelten. Jede macht eine Spielweise deutlich besser (Feuer, Bremsen,
// Scharfschützen, Superwaffen, besondere Bauplätze, Wirtschaft, Glocke), damit das Angebot eine Frage stellt.
// Reine Daten; die Wirkung rechnen src/sim/rules.js (towerStats Schritt 10, boonEffects) und src/sim/sim.js.
// Die Texte nennen ehrlich, was sich ändert, mit Zahlen; „Funken“ sind die Leben.

/** @import { BoonDef } from '../types/content' */

/** @type {BoonDef[]} */
export const BOONS = [
  // ------------------------------------------------------------------------------------------- Feuer
  {
    id: 'lauffeuer',
    name: 'Lauffeuer',
    icon: 'burn',
    text: 'Stirbt ein brennender Feuerdieb, springt sein Brand auf den nächsten Gegner im Umkreis von 1,5 Feldern über, mit voller Hitze und mindestens 1 s lang.',
    effect: { rules: { burnSpread: 1.5 } },
  },
  {
    id: 'zunder',
    name: 'Zunder',
    icon: 'flame',
    text: 'Brand und Ätzen wirken auf verlangsamte Gegner 2,25-fach statt 1,5-fach, und was Bremser verlangsamen, bleibt 1 s länger langsam.',
    effect: { rules: { burnOnSlowed: 0.75 }, towers: [{ roles: ['bremser'], mod: { add: { slowDuration: 1 } } }] },
  },
  {
    id: 'glutherz',
    name: 'Glutherz',
    icon: 'brenner',
    text: 'Brenner reichen 25 % weiter (auf Stufe 1 knapp 2,3 statt 1,8 Felder), auch der Feuerring einer Brenner-Superwaffe.',
    effect: { towers: [{ roles: ['brenner'], mod: { mul: { range: 1.25 } } }] },
  },
  // ------------------------------------------------------------------------------------------- Bremsen
  {
    id: 'zaehe_masse',
    name: 'Zähe Masse',
    icon: 'slow',
    text: 'Alle Bremser bremsen 10 Prozentpunkte stärker, auch als Superwaffe; die Pfützen des Bremsers liegen dazu 50 % länger und sind 0,2 Felder breiter.',
    // Fläche und Liegezeit nur für die Pfütze: Ein Netz oder eine Kältewelle bekäme sonst einen Umkreis, den der Text nicht verspricht.
    effect: { towers: [{ weapons: ['bremser'], mod: { mul: { zone: 1.5 }, add: { splash: 0.2 } } }, { roles: ['bremser'], mod: { add: { slow: 0.1 } } }] },
  },
  // ------------------------------------------------------------------------------------------- Schützen, Flieger, Panzerknacker, Werfer, Taktgeber
  {
    id: 'sperrfeuer',
    name: 'Sperrfeuer',
    icon: 'air',
    requires: { flying: true },
    text: 'Alle Türme treffen Flieger 30 % härter (auch ihr Brand), und die Salven einer Flak zerplatzen in einem 30 % größeren Umkreis.',
    effect: { rules: { airDamage: 1.3 }, towers: [{ recipe: 'flak', mod: { mul: { splash: 1.3 } } }] },
  },
  {
    id: 'adlerauge',
    name: 'Adlerauge',
    icon: 'range',
    // Nur mit dem klassischen Schützen: Zweig 1 der anderen Waffen des Platzes (Nervengift, Hartkern) ist kein Scharfschütze.
    requires: { weapons: ['schuetze'] },
    text: 'Scharfschützen reichen 20 % weiter und treffen 20 % härter, auch als Kern einer Superwaffe. Doppelschützen bringt das nichts.',
    effect: { towers: [{ weapons: ['schuetze'], branch: 1, mod: { mul: { range: 1.2, damage: 1.2 } } }] },
  },
  {
    id: 'kettenreaktion',
    name: 'Kettenreaktion',
    icon: 'chain',
    text: 'Treffer der Panzerknacker springen auf einen Gegner mehr über und 0,3 Felder weiter: Durchschuss trifft drei, Kettenschlag fünf, der Kettenblitz einen mehr.',
    effect: { towers: [{ roles: ['knacker'], mod: { add: { chain: 1, chainRange: 0.3 } } }] },
  },
  {
    id: 'riesentoeter',
    name: 'Riesentöter',
    icon: 'boss',
    text: 'Alle Türme richten gegen Bosse und Zwischenbosse 15 % mehr Schaden an, auch mit Brand.',
    effect: { rules: { bossDamage: 1.15 } },
  },
  {
    id: 'pulverfass',
    name: 'Pulverfass',
    icon: 'splash',
    text: 'Einschläge der Werfer sind 25 % größer (Großkaliber: Radius 1,75 statt 1,4), auch das Brandfeld einer Werfer-Superwaffe.',
    effect: { towers: [{ roles: ['werfer'], mod: { mul: { splash: 1.25 } } }] },
  },
  {
    id: 'gleichschritt',
    name: 'Gleichschritt',
    icon: 'taktgeber',
    text: 'Taktgeber lassen ihre Nachbarn um 10 Prozentpunkte schneller feuern als sonst, auch als Superwaffe.',
    effect: { towers: [{ roles: ['taktgeber'], mod: { add: { auraRate: 0.1 } } }] },
  },
  // ------------------------------------------------------------------------------------------- Superwaffen
  {
    id: 'schmelztiegel',
    name: 'Schmelztiegel',
    icon: 'fuse',
    requires: { fusion: true },
    text: 'Verschmelzen kostet 30 % weniger (Superwaffe 1,75 statt 2,5 Baupreise, Megawaffe 2,8 statt 4), Ausbauen dafür 15 % mehr.',
    effect: { economy: { fuse: 0.7, upgrade: 1.15 } },
  },
  {
    id: 'meisterwerk',
    name: 'Meisterwerk',
    icon: 'star',
    requires: { fusion: true },
    text: 'Super- und Megawaffen treffen 20 % härter (auch Brand) und reichen 10 % weiter. Einem Taktgeber-Kern bringt nur die Reichweite etwas.',
    effect: { towers: [{ super: true, mod: { mul: { damage: 1.2, dot: 1.2, range: 1.1 } } }] },
  },
  {
    id: 'zweite_krone',
    name: 'Zweite Krone',
    icon: 'crown',
    requires: { fusion: true },
    text: 'Es dürfen zwei Megawaffen zugleich stehen statt einer.',
    effect: { rules: { megaLimit: 1 } },
  },
  // ------------------------------------------------------------------------------------------- Baupläne (Rezepte freischalten)
  // Je gesperrtem Rezept (src/content/towers.js) ein Bauplan: Die Wahl schaltet das Rezept für den Rest der Partie frei. Die
  // Simulation bietet höchstens einen Bauplan je Angebot an und keinen für ein schon freies Rezept. Das kleine Gewicht hält
  // Baupläne in etwa jedem vierten Angebot; die Frage lautet dann: starke Gabe oder neue Waffe? Schon stehende Superwaffen
  // bleiben, was sie sind; das sagt jeder Text.
  {
    id: 'bauplan_teerfeuer',
    name: 'Bauplan: Teerfeuer',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Brenner, der zwei Bremser aufnimmt, wird zum Teerfeuer und wirft brennende Teerpfützen weit auf den Weg. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'teerfeuer' },
  },
  {
    id: 'bauplan_belagerung',
    name: 'Bauplan: Belagerungsgeschütz',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Panzerknacker, der zwei Taktgeber aufnimmt, feuert selten, aber gewaltig und fast über die ganze Karte (nur auf Bodenziele). Gilt für neue Verschmelzungen.',
    effect: { recipe: 'belagerung' },
  },
  {
    id: 'bauplan_dampfkessel',
    name: 'Bauplan: Dampfkessel',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Bremser, der zwei Brenner aufnimmt, verbrüht statt zu bremsen: ein sehr weiter Dampfpuls, der auch Flieger trifft. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'dampfkessel' },
  },
  {
    id: 'bauplan_kommando',
    name: 'Bauplan: Kommandoposten',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, flying: true },
    text: 'Neues Rezept: Ein Taktgeber, der zwei Schützen aufnimmt, gibt weiter den weiten Takt und schießt selbst Flieger ab. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'kommando' },
  },
  {
    id: 'bauplan_panzergranate',
    name: 'Bauplan: Panzergranate',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Werfer, der zwei Panzerknacker aufnimmt, wirft statt eines Brandfelds schwere Granaten, die jede Rüstung ignorieren. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'panzergranate' },
  },
  {
    id: 'bauplan_brennglas',
    name: 'Bauplan: Brennglas',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Schütze, der einen Werfer und einen Brenner aufnimmt, wird zum Strahl, der alles um sein Ziel herum in Brand setzt. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'brennglas' },
  },
  {
    id: 'bauplan_fesselstrahl',
    name: 'Bauplan: Fesselstrahl',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true },
    text: 'Neues Rezept: Ein Bremser, der einen Schützen und einen Panzerknacker aufnimmt, hält ein einzelnes Ziel im Strahl fest und bremst es stark. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'fesselstrahl' },
  },
  // Baupläne der waffengebundenen Rezepte (Waffen des Pools): Die Simulation bietet sie nur an, wenn die Bewaffnung der Partie
  // das Rezept bauen kann (`recipeFits`).
  {
    id: 'bauplan_kopfgeld',
    name: 'Bauplan: Kopfgeldjäger',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, weapons: ['zahlmeister'] },
    text: 'Neues Rezept: Ein Zahlmeister, der zwei Schützen aufnimmt, schießt selbst auf die Schwächsten und zahlt noch mehr Kopfgeld. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'kopfgeld' },
  },
  {
    id: 'bauplan_sonnenlanze',
    name: 'Bauplan: Sonnenlanze',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, weapons: ['leuchtfeuer'] },
    text: 'Neues Rezept: Ein Leuchtfeuer, das zwei Panzerknacker aufnimmt, schießt alle 3 s einen schweren Lichtstrahl, der tief zeichnet. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'sonnenlanze' },
  },
  {
    id: 'bauplan_harpune',
    name: 'Bauplan: Harpune',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, weapons: ['netzwerfer'] },
    text: 'Neues Rezept: Ein Netzwerfer, der zwei Panzerknacker aufnimmt, harpuniert den Vordersten und reißt ihn zurück. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'harpune' },
  },
  {
    id: 'bauplan_feuerwalze',
    name: 'Bauplan: Feuerwalze',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, weapons: ['stampfer'] },
    text: 'Neues Rezept: Ein Stampfer, der zwei Brenner aufnimmt, setzt mit jedem Schlag alles ringsum in Brand und wirft es zurück. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'feuerwalze' },
  },
  {
    id: 'bauplan_nebelwerfer',
    name: 'Bauplan: Nebelwerfer',
    icon: 'book',
    weight: 0.4,
    requires: { fusion: true, weapons: ['fernwerfer'] },
    text: 'Neues Rezept: Ein Fernwerfer, der einen Giftschützen und einen Bremser aufnimmt, legt weit entfernt ätzenden, bremsenden Nebel. Gilt für neue Verschmelzungen.',
    effect: { recipe: 'nebelwerfer' },
  },
  // ------------------------------------------------------------------------------------------- Besondere Bauplätze
  {
    id: 'ortskunde',
    name: 'Ortskunde',
    icon: 'map',
    requires: { tiles: ['hoehe', 'quelle', 'takt'] },
    text: 'Anhöhe, Kraftquelle und Taktstein wirken doppelt: 44 % mehr Reichweite, 44 % mehr Schaden und Brand, 28 % kürzere Pause.',
    effect: {
      towers: [
        { tiles: ['hoehe'], mod: { mul: { range: 1.2 } } },
        { tiles: ['quelle'], mod: { mul: { damage: 1.2, dot: 1.2 } } },
        { tiles: ['takt'], mod: { mul: { cooldown: 0.85 } } },
      ],
    },
  },
  {
    id: 'hoehenluft',
    name: 'Höhenluft',
    icon: 'flying',
    requires: { tiles: ['hoehe'] },
    text: 'Türme auf einer Anhöhe treffen auch Flieger, sogar Werfer, Bremser und Brenner, und reichen weitere 10 % weiter.',
    effect: { towers: [{ tiles: ['hoehe'], hitsAir: true, mod: { mul: { range: 1.1 } } }] },
  },
  {
    id: 'moorgeister',
    name: 'Moorgeister',
    icon: 'marsh',
    requires: { tiles: ['sumpf'] },
    text: 'Türme auf dem Sumpf treffen 35 % härter (auch Brand) und reichen 10 % weiter. Der Aufschlag von 35 % auf die Preise bleibt.',
    effect: { towers: [{ tiles: ['sumpf'], mod: { mul: { damage: 1.35, dot: 1.35, range: 1.1 } } }] },
  },
  // ------------------------------------------------------------------------------------------- Wirtschaft
  {
    id: 'kopfgeldjaeger',
    name: 'Kopfgeldjäger',
    icon: 'coin',
    text: 'Jeder Feuerdieb bringt 30 % mehr Kopfgeld, dafür gibt es für eine überstandene Welle nur die halbe Prämie.',
    effect: { economy: { bounty: 1.3, waveBonus: 0.5 } },
  },
  {
    id: 'baumeister',
    name: 'Baumeister',
    icon: 'gold',
    text: 'Neue Türme kosten 20 % weniger, Ausbauen kostet 15 % mehr. Für alle, die lieber breit als hoch bauen.',
    effect: { economy: { build: 0.8, upgrade: 1.15 } },
  },
  {
    id: 'veredler',
    name: 'Veredler',
    icon: 'upgrade',
    text: 'Ausbauen kostet 25 % weniger, neue Türme kosten 15 % mehr. Für alle, die wenige Türme hoch ziehen.',
    effect: { economy: { upgrade: 0.75, build: 1.15 } },
  },
  {
    id: 'zeitreise',
    name: 'Zeitreisende Handwerker',
    icon: 'modernize',
    text: 'Modernisieren kostet 30 % weniger: 21 % statt 30 % des Neuwerts im neuen Zeitalter, auch für Super- und Megawaffen.',
    effect: { economy: { modernize: 0.7 } },
  },
  {
    id: 'wanderbaumeister',
    name: 'Wanderbaumeister',
    icon: 'sell',
    text: 'Verkaufen gibt immer alles zurück, was im Turm steckt (100 % statt 75 %). Wer umbaut, wenn sich die Wege wandeln, verliert nichts.',
    effect: { economy: { sell: 1.34 } },
  },
  // ------------------------------------------------------------------------------------------- Glocke und Funken
  {
    id: 'glockengiesser',
    name: 'Glockengießer',
    icon: 'zeitglocke',
    text: 'Die Zeitglocke ist schon nach 45 statt 75 Sekunden wieder bereit (gilt ab dem nächsten Läuten).',
    effect: { ability: { cooldown: 0.6 } },
  },
  {
    id: 'ewige_flamme',
    name: 'Ewige Flamme',
    icon: 'heart',
    text: 'Sofort 6 Funken mehr, auch über den Anfangswert hinaus. Dafür bringt jede überstandene Welle 20 % weniger Prämie.',
    effect: { grant: { lives: 6 }, economy: { waveBonus: 0.8 } },
  },
  {
    id: 'goldener_handel',
    name: 'Goldener Handel',
    icon: 'gift',
    text: 'Sofort Gold im Wert von 40 Kopfgeldern eines Standardgegners (beim ersten Zeitalterwechsel 360 Gold), aber die Flamme verliert 5 Funken (nie den letzten).',
    effect: { grant: { gold: 40, lives: -5 } },
  },
];
