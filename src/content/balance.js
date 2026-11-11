// @ts-check
// Balance: alle Stellschrauben des Spiels an einem Ort (Spielentwurf Kapitel 2.2, 2.3, 2.5, 2.8, 2.9).
// Reine Daten, kein three.js, kein DOM. Die Rechenregeln dazu stehen in docs/SIM.md.

/** @import { Balance } from '../types/content' */

/**
 * Lebenspunkte des Standardgegners je gespieltem Zeitalter (Kapitel 2.3). Der große Sprung nach der Steinzeit ist Absicht:
 * Ab dem zweiten Zeitalter steht schon eine ganze Verteidigung, und zehn Wellen bringen viel Gold; die Steinzeit bleibt
 * die Lernphase. Gemessen mit tools/balance.mjs (Protokoll Schritt 8).
 */
const STANDARD_HP = [25, 260, 645, 1455, 3140, 6750];
/** Standard-Kopfgeld G je Zeitalter (Kapitel 2.8). */
const STANDARD_BOUNTY = [5, 9, 16, 28, 50, 90];
/**
 * DRUCK: der eine Regler für die Schwierigkeit. Er multipliziert die Lebenspunkte aller Gegner in allen Zeitaltern und allen
 * drei Schwierigkeitsgraden (die Abstufung Gemütlich / Normal / Knifflig bleibt erhalten). Zu schwer: kleiner machen
 * (0,9 = Gegner 10 % mürber), zu leicht: größer (1,1 = 10 % zäher). Einzelne Grade stellt `difficulty.<grad>.hp` nach,
 * einzelne Zeitalter `AGE_PRESSURE`.
 */
const PRESSURE = 1;
/**
 * Druck je gespielter Position (Faktor auf die Standard-Lebenspunkte): Ausgleich für die Zeitgaben, die sich ab dem zweiten
 * Zeitalter ansammeln (in sechs Zeitaltern fünf), und für die Wellen mit Eigenart. Die Steinzeit bleibt unberührt, damit die
 * Eröffnung auf jedem Grad fair ist; Rom ist etwas mürber, weil dort die erste Superwaffe noch fehlt (der Feldherr in Welle 20
 * war die häufigste Niederlage auf Knifflig); danach wird es Zeitalter für Zeitalter zäher, die Nahe Zukunft ist das Finale.
 * Gemessen mit tools/balance.mjs (Protokoll Schritte 17 und 19: mit dem Industriezeitalter als fünftem stiegen die beiden
 * letzten Werte von 1,7 / 1,8 auf 1,8 / 2,15, sonst gewann der beste Bot Normal in 44 statt etwa 30 von 60 Partien).
 */
const AGE_PRESSURE = [1, 0.85, 1.15, 1.2, 1.8, 2.15];
/** Prämie für eine überstandene Welle in Standard-Kopfgeldern (Kapitel 2.8: 6 x G). */
const WAVE_BONUS = 6;

/** @type {Balance} */
export const BALANCE = {
  startGold: 150,
  baseHp: STANDARD_HP[0],
  baseBounty: STANDARD_BOUNTY[0],
  // Der Standardschuss ist der des Schützen: 10 Schaden in der Steinzeit.
  baseDamage: 10,
  // Schaden und Brand je Zeitalter: S = 1 / 2 / 4 / 8 / 16 / 32.
  ageDamage: [1, 2, 4, 8, 16, 32],
  // Preise je Zeitalter: K = 1 / 1,8 / 3,2 / 5,6 / 10 / 18.
  ageCost: [1, 1.8, 3.2, 5.6, 10, 18],
  // 25 / 260 / 645 / 1455 / 3140 / 6750 Lebenspunkte, als Faktor auf baseHp, mit dem Druck je Position:
  // 25 / 221 / 742 / 1746 / 5652 / 14513.
  ageHp: STANDARD_HP.map((hp, i) => (hp / STANDARD_HP[0]) * AGE_PRESSURE[i]),
  // 5 / 9 / 16 / 28 / 50 / 90 Gold, als Faktor auf baseBounty.
  ageBounty: STANDARD_BOUNTY.map((gold) => gold / STANDARD_BOUNTY[0]),
  // Innerhalb eines Zeitalters +8 % Lebenspunkte je Welle: Welle 10 trägt das 1,72-Fache.
  waveHpGrowth: 0.08,
  // Stufe 2: Schaden x1,6 und Reichweite +8 %. Stufe 3: Schaden x2,5 (die Reichweite der Stufe 2 bleibt).
  levelDamage: [1, 1.6, 2.5],
  levelRange: [1, 1.08, 1.08],
  // Stufe 2 kostet das 0,9-Fache, Stufe 3 das 1,3-Fache des Baupreises.
  levelCost: [0.9, 1.3],
  // Modernisieren: 30 % des Neuwerts im aktuellen Zeitalter. Ein Zeitalter zurück arbeitet ein Turm mit halber Kraft;
  // Modernisieren holt die fehlende Hälfte also für 30 % statt 50 % des Neubaus: deutlich günstiger als daneben neu bauen.
  modernizeFactor: 0.3,
  // Verkaufen: 75 % des investierten Goldes.
  sellRefund: 0.75,
  waveBonus: WAVE_BONUS,
  // „Makellos“: zusätzlich 2 x G, also ein Drittel der Wellenprämie.
  perfectBonus: 2 / WAVE_BONUS,
  // Frühstart: 2 x G, schmilzt über 12 Sekunden auf null.
  earlyBonus: 2 / WAVE_BONUS,
  earlyBonusTime: 12,
  // Zeitgeschenk: 16 Standard-Kopfgelder des neuen Zeitalters.
  ageGift: 16,
  // Zunder-Kombo: Brand wirkt auf verlangsamte Gegner anderthalbfach.
  burnOnSlowed: 1.5,
  // Trotz Rüstung kommen immer mindestens 10 % an.
  minDamage: 0.1,
  // Schild: lädt nach 3 s ohne Treffer, dann in 2 s von leer auf voll.
  shieldDelay: 3,
  shieldRecharge: 2,
  // Superwaffen: Ein Kern der Stufe 3 nimmt 2 Nachbarn der Stufe 3 auf, trifft dreifach (so viel wie die drei Türme
  // zusammen), reicht 20 % weiter und bekommt die Gaben der Zutaten. Gebühr: das 2,5-Fache des Baupreises der Kernrolle
  // (gut drei Viertel dessen, was ein Turm der Stufe 3 kostet); dafür werden zwei Felder frei. Gemessen: Gebühr 2 machte
  // vier Superwaffen zur klar besten Strategie, Gebühr 3 zur schlechteren als gar keine.
  fusion: { parts: 2, damage: 3, range: 1.2, fee: 2.5, megaLimit: 1, megaDamage: 5, megaRange: 1.35, megaFee: 4 },
  // Besondere Bauplätze (Spielentwurf Kapitel 7, docs/briefs/fusion.md Abschnitt 6). Je Karte drei bis sechs Felder, gesetzt in
  // src/content/maps.js. Die Wirkung kommt ganz zuletzt auf die Kampfwerte (nach Zweig und Verschmelzung), `cost` ist ein Faktor
  // auf Bau, Ausbau, Modernisieren und die Gebühr des Verschmelzens. Farben: weit weg von den sechs Rollenfarben (Blau, Orange,
  // Türkis, Violett, Rot, Gold) und hell genug für den dunklen Boden der Zukunft, kräftig genug für das Grün der Steinzeit.
  // Die Texte sagen ehrlich, wem ein Feld nichts bringt: Taktgeber schießen nicht, und ein gewöhnlicher Taktgeber erreicht
  // auch mit 20 % mehr Reichweite (1,62 -> 1,94 Felder) keinen Nachbarn mehr; der Dauerstrahl rechnet Schaden je Sekunde,
  // eine kürzere Pause macht ihn nicht stärker.
  tiles: {
    hoehe: {
      name: 'Anhöhe',
      text: 'Weiter Blick: Ein Turm hier reicht 20 % weiter. Einem gewöhnlichen Taktgeber bringt das keine weiteren Nachbarn.',
      color: '#9FD0F5',
      icon: 'range',
      mod: { mul: { range: 1.2 } },
      cost: 1,
    },
    quelle: {
      name: 'Kraftquelle',
      text: 'Ein Turm hier trifft 20 % härter, auch sein Brand. Taktgebern bringt das nichts, Bremsern ohne Ätzpfütze kaum etwas.',
      color: '#EE6FB8',
      icon: 'damage',
      mod: { mul: { damage: 1.2, dot: 1.2 } },
      cost: 1,
    },
    takt: {
      name: 'Taktstein',
      text: 'Ein Turm hier braucht 15 % weniger Zeit zum Nachladen. Taktgebern und dem Dauerstrahl einer Schützen-Superwaffe bringt das nichts.',
      color: '#F4EEDB',
      icon: 'rate',
      mod: { mul: { cooldown: 0.85 } },
      cost: 1,
    },
    sumpf: {
      name: 'Sumpf',
      text: 'Weicher Grund: Bauen, Ausbauen, Modernisieren und Verschmelzen kosten hier 35 % mehr. Die Kampfwerte bleiben gleich.',
      color: '#B8786A',
      icon: 'marsh',
      mod: {},
      cost: 1.35,
    },
  },
  // Zeitgaben (Spielentwurf Kapitel 2.12): beim Zeitalterwechsel drei zur Wahl, Liste in src/content/boons.js.
  boons: { offer: 3 },
  // Wellen mit Eigenart (Spielentwurf Kapitel 2.13): zwei Wellen je Zeitalter, Liste in src/content/modifiers.js.
  modifiers: { perAge: 2 },
  difficulty: {
    easy: {
      name: 'Gemütlich',
      description: 'Zähere Flamme, mürbere Feuerdiebe. Zum Zurücklehnen und Zuschauen.',
      hp: 0.8 * PRESSURE,
      speed: 1,
      gold: 190 / 150,
      lives: 30,
      income: 1,
      score: 0.75,
    },
    normal: {
      name: 'Normal',
      description: 'So ist die Zeitenwacht gedacht: fordernd, aber fair.',
      hp: 1 * PRESSURE,
      speed: 1,
      gold: 1,
      lives: 20,
      income: 1,
      score: 1,
    },
    hard: {
      name: 'Knifflig',
      description: 'Zähere und flinkere Feuerdiebe, weniger Funken. Für alte Hasen.',
      hp: 1.25 * PRESSURE,
      speed: 1.1,
      gold: 140 / 150,
      lives: 15,
      income: 1,
      score: 1.5,
    },
  },
};
