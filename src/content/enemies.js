// @ts-check
// Die Feuerdiebe (Spielentwurf Kapitel 2.3 und 5): vier Gegner und ein Boss je Zeitalter, dazu in jedem der sechs Zeitalter
// ein Zwischenboss. Reine Daten.
//
// Werte sind Vielfache des Standardgegners des Zeitalters (hp, bounty) bzw. Anteile des Standardschusses (armor).
// - Rüstung N zieht N x 60 % des Standardschusses ab: armor = 0.6 * N. Ein Turm der Stufe 3 im aktuellen Zeitalter
//   kommt gut durch, veraltete Türme und kleine Geschosse prallen ab.
// - Kopfgeld: Lebenspunkte-Vielfaches x 0,8, Standardgegner 1, Boss 20, Zwischenboss 8; mindestens 2 Gold.
// - Zwischenbosse (Welle 5 jedes aktiven Zeitalters, in Welle 10 noch einmal als Geleit): `boss: true` ohne eigenes
//   Modell; sie leihen sich das Modell eines Gegners ihres Zeitalters und sind deutlich größer (`scale`).
// - Schild: Anteil der eigenen Lebenspunkte. Heiler: 3 % je Sekunde im Umkreis 1,5.
// - Bosse: Pfütze und Zeitglocke bremsen nur halb (slowResist 0.5), sie kosten 10 Funken.

/** @import { EnemyDef } from '../types/content' */

/** Abzug je Rüstungspunkt als Anteil des Standardschusses. */
const ARMOR_STEP = 0.6;
/** Kopfgeld eines Zwischenbosses in Standard-Kopfgeldern. */
const MID_BOSS_BOUNTY = 8;
/** Größe eines Zwischenbosses gegenüber dem Gegner, dessen Modell er trägt. */
const MID_BOSS_SCALE = 1.7;
/** Kopfgeld eines Nicht-Standardgegners je Lebenspunkte-Vielfachem. */
const BOUNTY_PER_HP = 0.8;
/** Kopfgeld eines Bosses in Standard-Kopfgeldern. */
const BOSS_BOUNTY = 20;
/** Heilung eines Heilers. */
const HEAL = { radius: 1.5, perSecond: 0.03 };

/**
 * Füllt die Felder, die bei fast allen Gegnern gleich sind.
 * @param {Pick<EnemyDef, 'id' | 'age' | 'name' | 'description' | 'hp' | 'speed' | 'color'> & Partial<EnemyDef> & { armorPoints?: number }} def
 * @returns {EnemyDef}
 */
function enemy(def) {
  const { armorPoints = 0, ...rest } = def;
  const boss = rest.boss ?? false;
  return {
    model: `${boss ? 'boss' : 'enemy'}.${rest.age}.${rest.id}`,
    boss,
    flying: false,
    armor: armorPoints * ARMOR_STEP,
    shield: 0,
    regen: 0,
    slowResist: boss ? 0.5 : 0,
    bounty: boss ? BOSS_BOUNTY : Math.round(rest.hp * BOUNTY_PER_HP * 100) / 100,
    lives: boss ? 10 : 1,
    ...rest,
  };
}

/** @type {EnemyDef[]} */
const LIST = [
  // ------------------------------------------------------------------------------------------- Steinzeit
  enemy({
    id: 'keule', age: 'steinzeit', name: 'Keulenschwinger',
    description: 'Der gewöhnliche Feuerdieb: watschelt, schwingt die Keule, denkt nicht viel nach.',
    hp: 1, speed: 1, bounty: 1, color: '#8A5A35',
  }),
  enemy({
    id: 'wolf', age: 'steinzeit', name: 'Wolf',
    description: 'Schnell. Huscht an den Türmen vorbei, bis etwas Klebriges ihn aufhält.',
    hp: 0.6, speed: 1.8, color: '#8D9199', radius: 0.22,
  }),
  enemy({
    id: 'frischling', age: 'steinzeit', name: 'Frischling',
    description: 'Schwarm. Einzeln ein Witz, im Rudel eine Plage: Flächenschaden hilft.',
    // 0,3 x 0,8 wären nur 1 Gold; der Entwurf verlangt mindestens 2.
    hp: 0.3, speed: 1.3, bounty: 0.4, color: '#9A6B43', radius: 0.15,
  }),
  enemy({
    id: 'nashorn', age: 'steinzeit', name: 'Wollnashorn',
    description: 'Zäh. Stapft langsam, hält aber eine Menge aus und stiehlt zwei Funken.',
    hp: 5, speed: 0.65, lives: 2, color: '#7D6A58', radius: 0.4,
  }),
  enemy({
    id: 'leitwolf', age: 'steinzeit', name: 'Der Leitwolf', boss: true, model: 'enemy.steinzeit.wolf',
    description: 'Zwischenboss, schnell. Doppelt so groß wie seine Wölfe und führt das Rudel an; erst kleben lassen, dann treffen.',
    hp: 12, speed: 1.35, lives: 5, bounty: MID_BOSS_BOUNTY, scale: MID_BOSS_SCALE, color: '#6F747C', radius: 0.36,
  }),
  enemy({
    id: 'mammut', age: 'steinzeit', name: 'Das Alte Mammut', boss: true,
    description: 'Boss. Ein Berg aus Fell und Geduld; jeder Schritt lässt die Insel zittern.',
    // 40 statt 28: Mit zehn Wellen hat der Spieler vor dem ersten Boss doppelt so viel Gold wie früher.
    hp: 40, speed: 0.5, color: '#5B3D2A', radius: 0.55,
  }),

  // ------------------------------------------------------------------------------------------- Römisches Reich
  enemy({
    id: 'plaenkler', age: 'rom', name: 'Plänkler',
    description: 'Der Fußgänger der abtrünnigen Legion: leicht gerüstet, leicht zu haben.',
    hp: 1, speed: 1.1, bounty: 1, color: '#D9C7A0',
  }),
  enemy({
    id: 'reiter', age: 'rom', name: 'Reiter',
    description: 'Schnell. Im Galopp durch die Gasse, der grüne Umhang flattert hinterher.',
    hp: 0.8, speed: 1.9, color: '#8B5E3C', radius: 0.3,
  }),
  enemy({
    id: 'legionaer', age: 'rom', name: 'Legionär',
    description: 'Gepanzert. Marschiert im Block; kleine Geschosse prallen an Schild und Schiene ab.',
    hp: 1.4, speed: 0.9, armorPoints: 1, color: '#2F6B4F',
  }),
  enemy({
    id: 'testudo', age: 'rom', name: 'Schildkröten-Trupp',
    description: 'Gepanzert und zäh. Acht Füße unter einem Dach aus Schilden; hier hilft nur Wucht oder Feuer.',
    hp: 5, speed: 0.6, armorPoints: 2, lives: 3, color: '#2F6B4F', radius: 0.4,
  }),
  enemy({
    id: 'zenturio', age: 'rom', name: 'Der Zenturio', boss: true, model: 'enemy.rom.legionaer',
    description: 'Zwischenboss, gepanzert. Ein Hüne mit Federbusch, der seine Legionäre vor sich hertreibt.',
    hp: 12, speed: 0.85, armorPoints: 1.5, lives: 5, bounty: MID_BOSS_BOUNTY, scale: MID_BOSS_SCALE, color: '#2F6B4F', radius: 0.4,
  }),
  enemy({
    id: 'feldherr', age: 'rom', name: 'Feldherr im Triumphwagen', boss: true,
    description: 'Boss, gepanzert. Lässt sich im goldenen Wagen zur Flamme fahren und winkt dabei.',
    hp: 30, speed: 0.6, armorPoints: 1, color: '#E0B03A', radius: 0.5,
  }),

  // ------------------------------------------------------------------------------------------- Mittelalter
  enemy({
    id: 'knecht', age: 'mittelalter', name: 'Fußknecht',
    description: 'Eisenhut, Spieß und ein Bündel für die Beute: der Tagelöhner unter den Feuerdieben.',
    hp: 1, speed: 1, bounty: 1, color: '#7F93AD',
  }),
  enemy({
    id: 'strauchdieb', age: 'mittelalter', name: 'Strauchdieb',
    description: 'Schnell. Rennt tief gebückt mit dem Beutesack davon, bevor jemand „Halt!“ rufen kann.',
    hp: 0.6, speed: 2, color: '#4F8A4A',
  }),
  enemy({
    id: 'ritter', age: 'mittelalter', name: 'Ritter',
    description: 'Gepanzert. Stampft in voller Rüstung heran; Panzerknacker und Feuer finden trotzdem einen Weg.',
    hp: 2.2, speed: 0.75, armorPoints: 2, lives: 2, color: '#9AA3AD', radius: 0.28,
  }),
  enemy({
    id: 'spielmann', age: 'mittelalter', name: 'Spielmann',
    description: 'Heiler. Seine Laute flickt die Kameraden um ihn herum; zuerst muss er verstummen.',
    hp: 1.2, speed: 1, heal: HEAL, color: '#D6492F',
  }),
  enemy({
    id: 'raubritter', age: 'mittelalter', name: 'Der Raubritter', boss: true, model: 'enemy.mittelalter.ritter',
    description: 'Zwischenboss, gepanzert. Ein riesiger Ritter auf Beutezug; seine Spielleute flicken ihn, wenn niemand sie stört.',
    hp: 13, speed: 0.8, armorPoints: 2, lives: 5, bounty: MID_BOSS_BOUNTY, scale: MID_BOSS_SCALE, color: '#8A929C', radius: 0.4,
  }),
  enemy({
    id: 'schwarzritter', age: 'mittelalter', name: 'Der Schwarze Ritter', boss: true,
    description: 'Boss, gepanzert. Bei halber Kraft bäumt sich sein Ross auf und galoppiert drei Sekunden lang los.',
    hp: 32, speed: 0.55, armorPoints: 2, color: '#3A2D4A', radius: 0.5,
    // Der Galopp bei 50 %: drei Sekunden doppeltes Tempo.
    phases: [{ at: 0.5, speed: 2, duration: 3 }],
  }),

  // ------------------------------------------------------------------------------------------- Zeitalter der Entdecker
  enemy({
    id: 'pirat', age: 'entdecker', name: 'Pirat',
    description: 'Ringelhemd, Kopftuch, Holzbein: humpelt zielstrebig auf die Flamme zu.',
    hp: 1, speed: 1, bounty: 1, color: '#D8D2C2',
  }),
  enemy({
    id: 'aeffchen', age: 'entdecker', name: 'Äffchen',
    description: 'Schnell und im Schwarm. Winzig, flink und mit gestohlenem Dreispitz unterwegs.',
    hp: 0.4, speed: 1.9, color: '#8A5A35', radius: 0.15,
  }),
  enemy({
    id: 'kuerassier', age: 'entdecker', name: 'Kürassier',
    description: 'Gepanzert und schnell. Blanker Brustpanzer im Galopp: erst kleben lassen, dann knacken.',
    hp: 1.8, speed: 1.4, armorPoints: 1.5, lives: 2, color: '#C3C9CF', radius: 0.3,
  }),
  enemy({
    id: 'papagei', age: 'entdecker', name: 'Beutepapagei',
    description: 'Fliegend. Nimmt die Luftlinie zur Flamme, hoch über Pfützen, Werfern und Brennern.',
    hp: 1.2, speed: 1.3, flying: true, color: '#D93A2B',
  }),
  enemy({
    id: 'flint', age: 'entdecker', name: 'Käpt’n Flint', boss: true, model: 'enemy.entdecker.papagei', flying: true,
    description: 'Zwischenboss, fliegend. Ein riesiger Papagei mit Kapitänsmanieren nimmt die Luftlinie; nur was in die Luft reicht, holt ihn herunter.',
    hp: 12, speed: 0.8, lives: 5, bounty: MID_BOSS_BOUNTY, scale: MID_BOSS_SCALE, color: '#D93A2B', radius: 0.3,
  }),
  enemy({
    id: 'landgaleone', age: 'entdecker', name: 'Die Landgaleone', boss: true,
    description: 'Boss, gepanzert, Träger. Ein Schiff auf Rädern; bei 75, 50 und 25 % flattern je drei Beutepapageien aus der Takelage.',
    hp: 34, speed: 0.5, armorPoints: 1, color: '#7A4F30', radius: 0.5,
    phases: [
      { at: 0.85, spawns: { enemy: 'papagei', count: 3 } },
      { at: 0.6, spawns: { enemy: 'papagei', count: 3 } },
      { at: 0.35, spawns: { enemy: 'papagei', count: 3 } },
    ],
  }),

  // ------------------------------------------------------------------------------------------- Industriezeitalter
  enemy({
    id: 'halunke', age: 'industrie', name: 'Halunke',
    description: 'Melone, Augenmaske, Beutesack: schleicht auf Zehenspitzen und hält das für unauffällig.',
    hp: 1, speed: 1, bounty: 1, color: '#5C5F6E',
  }),
  enemy({
    id: 'hochrad', age: 'industrie', name: 'Hochradfahrer',
    description: 'Schnell. Ein Herr mit Zylinder auf sehr großem Rad, wacklig, aber flott.',
    hp: 0.6, speed: 2.1, color: '#444A5A', radius: 0.28,
  }),
  enemy({
    id: 'ballon', age: 'industrie', name: 'Heißluftballon',
    description: 'Fliegend und zäh. Schwebt gemächlich die Luftlinie entlang und stiehlt zwei Funken.',
    hp: 3, speed: 0.7, flying: true, lives: 2, color: '#D9503A', radius: 0.4,
  }),
  enemy({
    id: 'dampfwagen', age: 'industrie', name: 'Dampfwagen',
    description: 'Träger, gepanzert. Wo er zerbricht, hüpfen vier Halunken heraus: am besten dort, wo Feuer wartet.',
    hp: 4, speed: 0.8, armorPoints: 1, lives: 2, color: '#5A5F66', radius: 0.4,
    spawns: { enemy: 'halunke', count: 4 },
  }),
  enemy({
    id: 'kohlenbaron', age: 'industrie', name: 'Der Kohlenbaron', boss: true, model: 'enemy.industrie.dampfwagen',
    description: 'Zwischenboss, gepanzert, Träger. Ein riesiger Dampfwagen voller Messing; bei halber Kraft springen drei Hochradfahrer ab, zerbricht er, steigen vier Halunken aus.',
    hp: 12, speed: 0.75, armorPoints: 1.5, lives: 5, bounty: MID_BOSS_BOUNTY, scale: 1.65, color: '#5A5F66', radius: 0.45,
    phases: [{ at: 0.5, spawns: { enemy: 'hochrad', count: 3 } }],
    spawns: { enemy: 'halunke', count: 4 },
  }),
  enemy({
    id: 'berta', age: 'industrie', name: 'Dampflok „Schwarze Berta“', boss: true,
    description: 'Boss, gepanzert, Träger. Lässt bei halber Kraft Dampf ab und vier Halunken frei; am Ende steigen sechs weitere aus.',
    hp: 36, speed: 0.45, armorPoints: 2, color: '#24332D', radius: 0.5,
    phases: [{ at: 0.5, spawns: { enemy: 'halunke', count: 4 } }],
    spawns: { enemy: 'halunke', count: 6 },
  }),

  // ------------------------------------------------------------------------------------------- Nahe Zukunft
  enemy({
    id: 'wachroboter', age: 'zukunft', name: 'Wachroboter',
    description: 'Weiß, höflich, unbeirrbar: marschiert im Gleichschritt auf den Energiekern zu.',
    hp: 1, speed: 1, bounty: 1, color: '#EEF1F5',
  }),
  enemy({
    id: 'roboterhund', age: 'zukunft', name: 'Roboterhund',
    description: 'Schnell. Trabt auf vier geknickten Beinen und apportiert am liebsten Funken.',
    hp: 0.7, speed: 2.1, color: '#F2C230', radius: 0.22,
  }),
  enemy({
    id: 'drohne', age: 'zukunft', name: 'Drohnenschwarm',
    description: 'Fliegend und im Schwarm. Viele kleine Surrer auf der Luftlinie; nur was geradeaus schießt, erwischt sie.',
    hp: 0.3, speed: 1.5, flying: true, color: '#5A6272', radius: 0.15,
  }),
  enemy({
    id: 'schildwagen', age: 'zukunft', name: 'Schildwagen',
    description: 'Schild und zäh. Die Blase lädt nach, sobald man aufhört zu treffen; Brand hält sie unten.',
    hp: 4, speed: 0.7, armorPoints: 1, shield: 0.5, lives: 2, color: '#4A4F5A', radius: 0.42,
  }),
  enemy({
    id: 'prototyp', age: 'zukunft', name: 'Prototyp X-1', boss: true, model: 'enemy.zukunft.schildwagen',
    description: 'Zwischenboss, Schild. Ein übergroßer Schildwagen aus der Versuchshalle; seine Blase hält doppelt so viel aus.',
    hp: 12, speed: 0.75, armorPoints: 1, shield: 0.5, lives: 5, bounty: MID_BOSS_BOUNTY, scale: 1.6, color: '#4A4F5A', radius: 0.45,
  }),
  enemy({
    id: 'goliath', age: 'zukunft', name: 'Goliath-Konvoi', boss: true,
    description: 'Boss, Schild, Träger. Bei 75, 50 und 25 % klappen die Luken auf und je sechs Drohnen steigen auf.',
    // 40 Lebenspunkte plus 10 Schild: der Schild beträgt ein Viertel der Lebenspunkte.
    hp: 40, speed: 0.45, armorPoints: 1, shield: 0.25, color: '#46505F', radius: 0.5,
    phases: [
      { at: 0.75, spawns: { enemy: 'drohne', count: 6 } },
      { at: 0.5, spawns: { enemy: 'drohne', count: 6 } },
      { at: 0.25, spawns: { enemy: 'drohne', count: 6 } },
    ],
  }),
];

/** Alle Gegner nach Kennung. @type {Record<string, EnemyDef>} */
export const ENEMIES = Object.fromEntries(LIST.map((def) => [def.id, def]));
