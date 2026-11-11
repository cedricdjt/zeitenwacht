// @ts-check
// Die sechs Turmrollen (= Plätze, klassische Waffen) und ihre 36 Ausprägungen (Spielentwurf Kapitel 2.2 und 4), dazu ganz unten die
// Plätze und die Waffen des Pools (Kapitel 2.14). Reine Daten, kein three.js, kein DOM.
//
// `stats` sind die Werte der Stufe 1 in der Steinzeit. Spätere Zeitalter und Stufen skalieren über die Balance
// (docs/SIM.md, `towerStats`): erst `stats`, darüber `levels[Stufe - 1]`, auf Stufe 3 das `set` des gewählten Zweigs
// (`branches`), bei Superwaffen das `set` von Kern und Gaben (`fusion`), darüber `tiers[Zeitalter].tweak`; dann wachsen
// Schaden und Brand mit `ageDamage * levelDamage` und die Reichweite mit `levelRange`, zuletzt wirken `mul` und `add`
// von Zweig, Kern und Gaben.
//
// Verlangsamung (Bremser) und Takt (Taktgeber) wachsen je Zeitalter über den `tweak` UND je Stufe über `levels`:
// `towerStats` rechnet den Zuwachs der Stufe auf den Wert des Zeitalters (tweak + (levels - stats)). Deshalb stehen
// diese beiden Stufenwerte in `levels` und nicht in den Zweigen.
//
// Zweige: Zweig 0 ist die klassische Besonderheit der Stufe 3, Zweig 1 die Alternative. Beide kosten dasselbe.
// Gaben: Was eine Rolle als Zutat einer Superwaffe beisteuert. Flächenfelder werden nur per `mul` verändert, damit
// ein Einzelschuss keine Fläche bekommt (Fläche schaltet in der Simulation den Kettensprung ab); Aura-Felder nur per
// `mul`, damit kein Angreifer versehentlich zum Taktgeber wird.

/** @import { ShotSound, ShotVisual, StatMod, TowerArchetypeDef, TowerBranchDef, TowerStats, TowerTierDef } from '../types/content' */

/** Kennungen der Zeitalter in ihrer Reihenfolge (Teil der Modell-Kennungen). */
const AGE_IDS = ['steinzeit', 'rom', 'mittelalter', 'entdecker', 'industrie', 'zukunft'];

/** Verlangsamung der Pfütze auf Stufe 1 je Zeitalter: 30 % und je Zeitalter 5 Punkte mehr. */
const PUDDLE_SLOW = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55];
/** Takt des Taktgebers auf Stufe 1 je Zeitalter: 20 % und je Zeitalter 3 Punkte mehr. */
const BEAT_RATE = [0.2, 0.23, 0.26, 0.29, 0.32, 0.35];

/** Werte eines Turms, der nichts kann; jede Rolle überschreibt, was sie braucht. */
/** @type {TowerStats} */
const NO_STATS = {
  attack: 'none',
  damage: 0,
  cooldown: 1,
  range: 1,
  minRange: 0,
  projectileSpeed: 0,
  splash: 0,
  slow: 0,
  slowDuration: 0,
  dot: 0,
  dotDuration: 0,
  pierce: 0,
  chain: 0,
  chainRange: 0,
  zone: 0,
  ramp: 0,
  rampTime: 0,
  hitsAir: false,
  hitsGround: true,
  auraDamage: 0,
  auraRate: 0,
  auraRange: 0,
};

/**
 * Eine Ausprägung; die Modell-Kennung folgt aus Rolle und Zeitalter.
 * @param {string} role Kennung der Rolle
 * @param {number} age Index des Zeitalters
 * @param {string} name
 * @param {string} superName Name der Superwaffe mit diesem Turm als Kern
 * @param {string} megaName Name der Megawaffe mit diesem Turm als Kern, eine Stufe größer
 * @param {string} flavor
 * @param {ShotVisual} shot
 * @param {Partial<TowerStats>} [tweak]
 * @returns {TowerTierDef}
 */
function tier(role, age, name, superName, megaName, flavor, shot, tweak) {
  /** @type {TowerTierDef} */
  const def = { name, superName, megaName, flavor, model: `tower.${AGE_IDS[age]}.${role}`, shot };
  if (tweak) def.tweak = tweak;
  return def;
}

/** Ab dem Zeitalter der Entdecker treffen Schütze und Panzerknacker sofort. */
/** @type {Partial<TowerStats>} */
const HITSCAN = { attack: 'hitscan' };

/** Der goldene Taktring des Taktgebers; nur der Klang wechselt mit dem Zeitalter. */
/**
 * @param {ShotVisual['sound']} sound
 * @returns {ShotVisual}
 */
function beat(sound) {
  return { kind: 'pulse', color: '#F2C230', impact: 'none', sound };
}

/**
 * Der Wurf eines Bremsers: ein Klecks in der Farbe seiner Pfütze.
 * @param {string} color Farbe von Klecks und Pfütze
 * @param {number} arc Bogenhöhe
 * @param {Partial<ShotVisual>} [extra]
 * @returns {ShotVisual}
 */
function blob(color, arc, extra) {
  return { kind: 'model', model: 'shot.klecks', color, arc, impact: 'splash', sound: 'throw', impactSound: 'splash', ...extra };
}

/**
 * Ein Ausbauzweig der Stufe 3 mit der Gabe, die ein Turm dieses Zweigs einer Superwaffe mitgibt.
 * @param {string} name
 * @param {string} icon Kennung des Symbols der Bedienoberfläche
 * @param {string} summary
 * @param {StatMod} mod
 * @param {{ mod: StatMod, name: string, text: string }} gift
 * @returns {TowerBranchDef}
 */
function branch(name, icon, summary, mod, gift) {
  return { name, summary, icon, mod, gift };
}

// Die zwölf Gaben (je Rolle und Zweig eine). `fusion.gift` jeder Rolle ist die Gabe ihres Zweigs 0 (für Spielstände ohne
// Angabe des Zweigs). Was eine Gabe bei welchem Kern bewirkt, steht ehrlich im Text; die Kernarten sind: Strahl (Schütze),
// Wurf mit Brandfeld (Werfer), Puls um den Turm (Bremser, Brenner), Kettenblitz (Panzerknacker), Aura (Taktgeber).
const GIFTS = {
  schnellfeuer: { name: 'Schnellfeuer', mod: { mul: { cooldown: 0.75, rampTime: 0.6, auraRate: 1.1 } },
    text: 'Ein Viertel weniger Pause zwischen Schüssen, Würfen und Pulsen; ein Strahl heizt schneller auf, ein Taktgeber-Kern gibt etwas mehr Takt.' },
  zielfernrohr: { name: 'Zielfernrohr', mod: { mul: { range: 1.2 } },
    text: '20 % mehr Reichweite, für jeden Kern: weiter schießen, weiter pulsen, weiter takten.' },
  sprengkopf: { name: 'Sprengkopf', mod: { mul: { splash: 1.2, range: 1.1 }, add: { chain: 1, chainRange: 1.2 } },
    text: 'Einschläge ein Fünftel größer, 10 % mehr Reichweite; Einzelschüsse, Strahlen und Blitze springen auf einen Gegner mehr und weiter.' },
  schnellladung: { name: 'Schnellladung', mod: { mul: { cooldown: 0.85, rampTime: 0.8, zone: 1.4 } },
    text: 'Schneller nachgeladen, ein Strahl heizt schneller auf; Pfützen und Brandfelder bleiben 40 % länger. Einem Taktgeber nützt sie nichts.' },
  kleber: { name: 'Kleber', mod: { set: { slow: 0.25 }, add: { slowDuration: 1.5 } },
    text: 'Treffer verlangsamen um 25 % für 1,5 s; ein Bremser-Kern behält seine stärkere Verlangsamung, sie hält 1,5 s länger. Taktgebern nichts.' },
  aetzmittel: { name: 'Ätzmittel', mod: { mul: { zone: 1.3 }, add: { dot: 1, dotDuration: 2 } },
    text: 'Treffer ätzen 2 s lang (ein Standardschuss je Sekunde, ohne Rüstung); Pfützen und Brandfelder bleiben länger. Taktgebern nichts.' },
  panzerbrecher: { name: 'Panzerbrecher', mod: { set: { pierce: 1 }, mul: { range: 1.15 } },
    text: 'Treffer ignorieren Rüstung, dazu 15 % mehr Reichweite.' },
  kettenfunke: { name: 'Kettenfunke', mod: { mul: { damage: 1.1, dot: 1.1 }, add: { chain: 2, chainRange: 1.5 } },
    text: '10 % mehr Schaden und Brand; Einzelschüsse, Strahlen und Blitze springen auf zwei Gegner mehr und weiter. Taktgebern nichts.' },
  brandsatz: { name: 'Brandsatz', mod: { add: { dot: 2, dotDuration: 3 } },
    text: 'Treffer, Pulse und Felder setzen 3 s lang in Brand (so heiß wie ein Brenner der Stufe 3). Einem Taktgeber nützt er nichts.' },
  glutkern: { name: 'Glutkern', mod: { mul: { dot: 1.5, dotDuration: 1.5 }, add: { dot: 0.5, dotDuration: 1 } },
    text: 'Was schon brennt oder ätzt, brennt anderthalbmal so heiß und lange; alles andere glimmt ein wenig. Einem Taktgeber nützt er nichts.' },
  weitblick: { name: 'Weitblick', mod: { mul: { range: 1.15, auraRange: 1.3, auraRate: 1.05 } },
    text: '15 % mehr Reichweite; ein Taktgeber-Kern lässt seine Nachbarn noch weiter reichen und gibt etwas mehr Takt.' },
  taktkern: { name: 'Taktkern', mod: { mul: { damage: 1.25, dot: 1.25, zone: 1.25, auraRate: 1.15, auraDamage: 1.15 } },
    text: 'Ein Viertel mehr Schaden und Brand, Felder bleiben länger; ein Taktgeber-Kern gibt mehr Takt und Wucht.' },
};

/**
 * `fusion.gift` mit Name und Text aus einer Gabe.
 * @param {{ mod: StatMod, name: string, text: string }} gift
 */
function fallbackGift(gift) {
  return { gift: gift.mod, giftName: gift.name, giftText: gift.text };
}

// Die Flak, das Rezept aus drei Schützen: `damage` je Salve und `cooldown` vor der Skalierung (wie `stats`), `splash` in Feldern,
// dazu 15 % mehr Reichweite. Am Prüfstand (Zukunft, Welle 9, je eine Superwaffe allein; docs/DESIGN.md 2.11): Von 24 dicht
// fliegenden Drohnen mit doppelten Lebenspunkten holt die Flak mit zwei Doppelschützen 13 herunter, der Kettenblitz 8, der
// Strahl 4; gegen einen stehenden Goliath schafft sie 662 Schaden je Sekunde, der Strahl 1186 bis 1652.
const FLAK = {
  damage: 5,
  cooldown: 0.7,
  splash: 1,
  text: 'Wird zur Flak: schnelle Salven, die im kleinen Umkreis zerplatzen und Schwärme in der Luft und am Boden lichten. Gegen Einzelne schwächer.',
};

/** @type {TowerArchetypeDef[]} */
export const ARCHETYPES = [
  // ------------------------------------------------------------------------------------------- Schütze
  {
    id: 'schuetze',
    role: 'Schütze',
    summary: 'Schießt schnell auf ein einzelnes Ziel und erreicht auch Flieger. Gut gegen Schnelle.',
    color: '#3D7DD8',
    icon: 'schuetze',
    unlockWave: 0,
    cost: 60,
    stats: { ...NO_STATS, attack: 'projectile', damage: 10, cooldown: 1.25, range: 3, projectileSpeed: 9, hitsAir: true },
    levels: [{}, {}, {}],
    branches: [
      // Doppelte Feuerrate bei halbem Grundschaden; zusammen mit dem Stufenfaktor 2,5 das 2,5-Fache je Sekunde.
      branch('Doppelschuss', 'rate', 'Zwei Schüsse in der Zeit von einem. Stark gegen viele Kleine und Schnelle.',
        { set: { cooldown: 0.625, damage: 5 } }, GIFTS.schnellfeuer),
      // Ein Schuss alle 2 s mit 1,6-fachem Grundschaden und 40 % mehr Reichweite: gleich viel je Sekunde wie der
      // Doppelschuss, aber jeder Treffer viermal so hart (Rüstung zieht kaum noch etwas ab).
      branch('Scharfschütze', 'range', 'Ein gezielter, harter Schuss alle zwei Sekunden, dafür 40 % mehr Reichweite. Stark gegen Gepanzerte.',
        { set: { cooldown: 2, damage: 16, projectileSpeed: 14 }, mul: { range: 1.4 } }, GIFTS.zielfernrohr),
    ],
    fusion: {
      // Strahl: `damage` ist Schaden je Sekunde (8 wie beide Zweige), der in 4 s auf das 2,5-Fache anschwillt, solange er
      // dasselbe Ziel hält. Der Scharfschützen-Kern reicht dank seines Zweigs 40 % weiter.
      core: { set: { attack: 'beam', damage: 8, cooldown: 0.2, ramp: 1.5, rampTime: 4, chain: 0 } },
      coreText: 'Wird zum Dauerstrahl, der auch Flieger trifft: Je länger er auf einem Ziel bleibt, desto heißer (bis zum 2,5-Fachen).',
      ...fallbackGift(GIFTS.schnellfeuer),
      recipes: [{
        // Rezept Flak (docs/briefs/fusion.md, 8): Kern und beide Zutaten Schützen. Sofort treffende Salven mit kleinem
        // Radius, die Flieger und Boden erwischen. Am Ziel 7,1 Schaden je Sekunde vor der Skalierung (Strahl: 8, aufgeheizt 20).
        id: 'flak',
        name: 'Flak',
        gifts: ['schuetze', 'schuetze'],
        core: { set: { attack: 'hitscan', damage: FLAK.damage, cooldown: FLAK.cooldown, splash: FLAK.splash, chain: 0, range: 3, minRange: 0 }, mul: { range: 1.15 } },
        coreText: FLAK.text,
      }],
    },
    tiers: [
      tier('schuetze', 0, 'Steinschleuderer', 'Sturmschleuder', 'Himmelsschleuder', 'Ein Kiesel, eine Schlinge und ein gutes Auge: Mehr brauchte es am Anfang nicht.',
        { kind: 'model', model: 'shot.kiesel', color: '#9A968F', arc: 0.3, tumble: true, impact: 'dust', sound: 'sling', impactSound: 'stone' }),
      tier('schuetze', 1, 'Bogenschütze', 'Pfeilsturm', 'Pfeilgewitter', 'Steht auf seinem Holzturm, zählt Pfeile und verfehlt selten.',
        { kind: 'model', model: 'shot.pfeil', color: '#F4F1E6', arc: 0.1, impact: 'dust', sound: 'bow', impactSound: 'arrow' }),
      tier('schuetze', 2, 'Armbrustschütze', 'Meisterarmbrust', 'Kaiserarmbrust', 'Kurbeln, zielen, klack. Hinter der blauen Pavese lässt es sich in Ruhe arbeiten.',
        { kind: 'model', model: 'shot.bolzen', color: '#E9E4DA', arc: 0, impact: 'dust', sound: 'crossbow', impactSound: 'arrow' }),
      tier('schuetze', 3, 'Musketier', 'Donnerbüchse', 'Donnerbatterie', 'Dreispitz, blauer Rock und ein Knall, der vor der Kugel ankommt.',
        { kind: 'tracer', color: '#CFE2FF', muzzle: 'smoke', impact: 'spark', sound: 'musket', impactSound: 'thud' }, HITSCAN),
      tier('schuetze', 4, 'Kurbelgeschütz', 'Messingorgel', 'Messingkathedrale', 'Sechs Läufe aus Messing und ein Schütze, der sehr gern kurbelt.',
        { kind: 'tracer', color: '#FFE27A', muzzle: 'flash', impact: 'spark', sound: 'gatling', impactSound: 'thud' }, HITSCAN),
      tier('schuetze', 5, 'Laserturm', 'Lichtlanze', 'Sternenlanze', 'Kein Knall, kein Rauch, nur ein dünner blauer Strich, und der sitzt.',
        { kind: 'beam', color: '#5AA8FF', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' }, HITSCAN),
    ],
  },

  // ------------------------------------------------------------------------------------------- Werfer
  {
    id: 'werfer',
    role: 'Werfer',
    summary: 'Wirft im hohen Bogen und trifft alles im Umkreis. Gut gegen Schwärme, aber nur am Boden.',
    color: '#E8842A',
    icon: 'werfer',
    unlockWave: 1,
    cost: 90,
    stats: { ...NO_STATS, attack: 'projectile', damage: 20, cooldown: 2.5, range: 3.5, projectileSpeed: 5, splash: 1 },
    levels: [{}, {}, {}],
    branches: [
      branch('Großkaliber', 'splash', 'Der Einschlag wächst auf Radius 1,4 und erwischt fast doppelt so viel Fläche.',
        { set: { splash: 1.4 } }, GIFTS.sprengkopf),
      branch('Schnelllader', 'rate', 'Gleicher Einschlag, aber ein Drittel weniger Ladezeit. Stark gegen Zähe und lange Kolonnen.',
        { mul: { cooldown: 0.65 } }, GIFTS.schnellladung),
    ],
    fusion: {
      // Brandfeld: Der Einschlag hinterlässt 3 s lang brennenden Boden in seiner Größe (6 Schaden je Sekunde, wie alles
      // Feuer verdreifacht und mit Zeitalter und Stufe wachsend; brennt 1 s nach).
      core: { set: { zone: 3, dot: 10, dotDuration: 1 }, mul: { splash: 1.2, cooldown: 0.8 } },
      coreText: 'Dreifacher Schaden, ein größerer Einschlag, und wo er einschlägt, brennt 3 s lang der Boden.',
      ...fallbackGift(GIFTS.sprengkopf),
    },
    tiers: [
      tier('werfer', 0, 'Felswerfer', 'Bergwerfer', 'Gipfelstürzer', 'Eine Wippe aus Baumstämmen. Was oben war, kommt unten sehr überzeugend an.',
        { kind: 'model', model: 'shot.felsbrocken', color: '#8F8B84', arc: 1.6, tumble: true, impact: 'dust', sound: 'throw', impactSound: 'stone' }),
      tier('werfer', 1, 'Onager', 'Jupiters Faust', 'Titanenfaust', 'Der „Wildesel“ der Legion tritt nach hinten aus und wirft Tontöpfe nach vorn.',
        { kind: 'model', model: 'shot.tontopf', color: '#C9773F', arc: 1.4, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'stone' }),
      tier('werfer', 2, 'Tribock', 'Mauerbrecher', 'Burgenbrecher', 'Ein Gegengewicht, ein langer Arm und viel Geduld. Die Steinkugel hat es nicht eilig, aber sie kommt.',
        { kind: 'model', model: 'shot.steinkugel', color: '#9A958C', arc: 2.2, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'thud' }),
      tier('werfer', 3, 'Mörser', 'Königsmörser', 'Kaisermörser', 'Kurz, dick, Bronze. Die Bombe zischt noch ein bisschen, bevor sie höflich anklopft.',
        { kind: 'model', model: 'shot.bombe', color: '#FF9A3C', arc: 2, tumble: true, trail: 'spark', muzzle: 'smoke', impact: 'explosion', sound: 'mortar', impactSound: 'explosion' }),
      tier('werfer', 4, 'Dampfmörser', 'Dampfhammer', 'Dampftitan', 'Derselbe Gedanke, nur mit Kessel, Ventil und Manometer. Der Fortschritt pfeift dazu.',
        { kind: 'model', model: 'shot.bombe', color: '#FF8A2E', arc: 2, tumble: true, trail: 'spark', muzzle: 'smoke', impact: 'explosion', sound: 'steam', impactSound: 'bigExplosion' }),
      tier('werfer', 5, 'Raketenwerfer', 'Sternenhagel', 'Meteorschauer', 'Vier Rohre, ein Radar und Raketen, die den Weg von allein finden.',
        { kind: 'model', model: 'shot.rakete', color: '#FF8A3C', arc: 0.8, trail: 'smoke', muzzle: 'flash', impact: 'explosion', sound: 'rocket', impactSound: 'explosion' }),
    ],
  },

  // ------------------------------------------------------------------------------------------- Bremser
  {
    id: 'bremser',
    role: 'Bremser',
    summary: 'Wirft eine klebrige Pfütze auf den Weg: Wer hineintritt, wird langsam. Nur am Boden.',
    color: '#26B5A8',
    icon: 'bremser',
    unlockWave: 2,
    cost: 70,
    // Pfütze: Bodenfeld mit Radius 0,9 für 3 s; verlangsamt um 30 %, bis 1 s nach dem Verlassen.
    stats: { ...NO_STATS, attack: 'projectile', damage: 0, cooldown: 3.5, range: 2.5, projectileSpeed: 6, splash: 0.9, slow: PUDDLE_SLOW[0], slowDuration: 1, zone: 3 },
    // Stufe 2: 8 Punkte mehr. Stufe 3: 15 Punkte mehr.
    levels: [{}, { slow: 0.38 }, { slow: 0.45 }],
    branches: [
      branch('Großer Teich', 'slow', 'Die Pfütze wächst auf Radius 1,2 und bleibt 4 s liegen.',
        { set: { splash: 1.2, zone: 4 } }, GIFTS.kleber),
      // Ätzen zählt wie Brand: ignoriert Rüstung, hält Schilde und Heilung unten und wirkt auf Verlangsamte anderthalbfach.
      branch('Ätzpfütze', 'acid', 'Die Pfütze bleibt klein, ätzt aber: Wer darin steht, nimmt laufend Schaden, der Rüstung ignoriert.',
        { set: { dot: 2, dotDuration: 1 } }, GIFTS.aetzmittel),
    ],
    fusion: {
      // Frostpuls: alle 1,5 s ein Ring um den Turm, der alles in Reichweite verlangsamt, auch Flieger (Verlangsamung des
      // Zeitalters, 2 s lang). Eine Ätzpfütze ätzt mit jedem Puls alle im Ring.
      core: { set: { attack: 'pulse', damage: 5, cooldown: 1.5, slowDuration: 2, hitsAir: true, zone: 0 } },
      coreText: 'Wirft keine Pfützen mehr, sondern sendet alle 1,5 s einen Frostpuls: Alles im Umkreis wird langsam, auch Flieger.',
      ...fallbackGift(GIFTS.kleber),
    },
    tiers: [
      tier('bremser', 0, 'Harzschleuder', 'Bernsteinquelle', 'Bernsteinmeer', 'Ein hohler Stumpf voll Harz und ein biegsamer Ast. Klebt an Fell, Füßen und allem anderen.',
        blob('#E0A030', 1.2), { slow: PUDDLE_SLOW[0] }),
      tier('bremser', 1, 'Ölamphoren-Werfer', 'Ölteppich', 'Neptuns Ölmeer', 'Bestes Olivenöl, eigentlich viel zu schade für den Weg. Aber es wirkt.',
        blob('#B8C43A', 1.3, { model: 'shot.amphore', tumble: true, impactSound: 'glass' }), { slow: PUDDLE_SLOW[1] }),
      tier('bremser', 2, 'Pechsieder', 'Pechsee', 'Pechstrom', 'Im Kessel blubbert es schwarz. Die Kelle schwingt, und unten wird es zäh.',
        blob('#2A2622', 1.3, { trail: 'smoke' }), { slow: PUDDLE_SLOW[2] }),
      tier('bremser', 3, 'Sirupfass', 'Melasseflut', 'Melassemeer', 'Ein Fass Melasse mit Messinghahn. Süß, dunkel und erstaunlich anhänglich.',
        blob('#8A3A22', 1, { sound: 'splash' }), { slow: PUDDLE_SLOW[3] }),
      tier('bremser', 4, 'Ölpumpe', 'Teergrube', 'Teermoor', 'Nickt den ganzen Tag vor sich hin und spuckt bei Bedarf einen schwarzen Strahl.',
        blob('#2B2540', 0.8, { sound: 'splash' }), { slow: PUDDLE_SLOW[4] }),
      tier('bremser', 5, 'Klebeschaum-Werfer', 'Schaumgletscher', 'Schaumlawine', 'Weißer Schaum, der wächst, kleben bleibt und sich danach brav wieder auflöst.',
        blob('#C9FFF2', 0.7, { sound: 'pulse' }), { slow: PUDDLE_SLOW[5] }),
    ],
  },

  // ------------------------------------------------------------------------------------------- Panzerknacker
  {
    id: 'knacker',
    role: 'Panzerknacker',
    summary: 'Ein schwerer Treffer mit großer Reichweite, der jede Rüstung ignoriert. Zielt auf den Stärksten, erreicht auch Flieger.',
    color: '#8A55D6',
    icon: 'knacker',
    unlockWave: 3,
    defaultMode: 'strong',
    cost: 110,
    stats: { ...NO_STATS, attack: 'projectile', damage: 40, cooldown: 3.3, range: 4.5, projectileSpeed: 14, pierce: 1, hitsAir: true },
    levels: [{}, {}, {}],
    branches: [
      branch('Durchschuss', 'pierce', 'Der Treffer geht mit 70 % Wucht auf einen zweiten Gegner dahinter über.',
        { set: { chain: 1, chainRange: 1.5 } }, GIFTS.panzerbrecher),
      // Je Sprung 70 % des vorigen Treffers: bei vier dicht stehenden Gegnern das Doppelte, gegen einen Einzelnen ein Fünftel weniger.
      branch('Kettenschlag', 'chain', 'Springt auf bis zu drei weitere Gegner in der Nähe über, trifft dafür ein Fünftel schwächer.',
        { set: { chain: 3, chainRange: 1.2 }, mul: { damage: 0.8 } }, GIFTS.kettenfunke),
    ],
    fusion: {
      // Kettenblitz: trifft sofort und springt auf 4 Gegner mehr als sein Zweig (Durchschuss 5, Kettenschlag 7), bis 2 Felder
      // weit; jeder Sprung mit 70 % des vorigen, alle ohne Rüstung.
      core: { set: { attack: 'hitscan', chainRange: 2 }, add: { chain: 4 } },
      coreText: 'Wird zum Kettenblitz: Der Treffer springt auf vier Gegner mehr über, jeder Sprung ignoriert Rüstung.',
      ...fallbackGift(GIFTS.panzerbrecher),
    },
    tiers: [
      tier('knacker', 0, 'Speerschleuder', 'Mammutspeer', 'Weltenspeer', 'Mit dem Wurfholz fliegt der Speer doppelt so weit. Das Wollnashorn ist nicht begeistert.',
        { kind: 'model', model: 'shot.speer', color: '#B08A5A', arc: 0.15, impact: 'dust', sound: 'throw', impactSound: 'wood' }),
      tier('knacker', 1, 'Skorpion', 'Königsskorpion', 'Kaiserskorpion', 'Klein, gespannt und giftig genau: Sein Eisenbolzen fragt nicht nach dem Schild.',
        { kind: 'model', model: 'shot.eisenbolzen', color: '#D9DDE2', arc: 0.05, impact: 'spark', sound: 'ballista', impactSound: 'metal' }),
      tier('knacker', 2, 'Balliste', 'Drachentöter', 'Titanentöter', 'Eine Armbrust für Leute, denen Armbrüste zu klein sind. Die Winde knarrt, dann kracht es.',
        { kind: 'model', model: 'shot.eisenbolzen', color: '#C9CED6', arc: 0.05, impact: 'spark', sound: 'ballista', impactSound: 'thud' }),
      tier('knacker', 3, 'Feldschlange', 'Seeschlange', 'Leviathan', 'Sehr lang, sehr schlank, sehr laut. Rollt nach jedem Schuss beleidigt ein Stück zurück.',
        { kind: 'tracer', color: '#E9DCFF', muzzle: 'flash', impact: 'spark', sound: 'cannon', impactSound: 'metal' }, HITSCAN),
      tier('knacker', 4, 'Stahlkanone', 'Stahlkoloss', 'Stahltitan', 'Gussstahl mit Zielfernrohr. Der Rücklauf dauert länger als der Flug der Granate.',
        { kind: 'tracer', color: '#C9A8FF', muzzle: 'flash', impact: 'spark', sound: 'howitzer', impactSound: 'metal' }, HITSCAN),
      tier('knacker', 5, 'Schienenkanone', 'Kometenkanone', 'Sternenbrecher', 'Lädt hörbar auf, zieht einen violetten Strich durch die Nacht und ist schon fertig.',
        { kind: 'beam', color: '#A66BFF', muzzle: 'energy', impact: 'energy', sound: 'railgun', impactSound: 'energy' }, HITSCAN),
    ],
  },

  // ------------------------------------------------------------------------------------------- Brenner
  {
    id: 'brenner',
    role: 'Brenner',
    summary: 'Kurzer Flammenstoß, der Bodengegner in Brand setzt. Brand ignoriert Rüstung und hält Schilde und Heilung unten.',
    color: '#D8432F',
    icon: 'brenner',
    unlockWave: 4,
    cost: 100,
    // Trifft das Ziel und alle Bodengegner im Umkreis 0,9 mit 4 Schaden und setzt sie in Brand: 12 Schaden/s für 3 s.
    stats: { ...NO_STATS, attack: 'hitscan', damage: 4, cooldown: 1, range: 1.8, splash: 0.9, dot: 12, dotDuration: 3 },
    levels: [{}, {}, {}],
    branches: [
      branch('Flächenbrand', 'splash', 'Der Flammenstoß wächst auf Radius 1,2 und steckt ganze Gruppen an.',
        { set: { splash: 1.2 } }, GIFTS.brandsatz),
      branch('Weißglut', 'flame', 'Kleine Flamme, große Hitze: Der Brand ist 40 % stärker und hält doppelt so lange.',
        { set: { dotDuration: 6 }, mul: { dot: 1.4 } }, GIFTS.glutkern),
    ],
    fusion: {
      // Feuerring: jede Sekunde ein Puls um den Turm, der alle Bodengegner in Reichweite trifft und in Brand setzt.
      core: { set: { attack: 'pulse' }, mul: { range: 1.3, dot: 1.3 } },
      coreText: 'Wird zum Feuerring: Jede Sekunde lodert ein Ring um den Turm und setzt alles am Boden in Reichweite in Brand.',
      ...fallbackGift(GIFTS.brandsatz),
    },
    tiers: [
      tier('brenner', 0, 'Glutbläser', 'Urfeuer', 'Feuerberg', 'Tief Luft holen, ins Schilfrohr pusten, Funken fliegen lassen. Die älteste Feuerwehr der Welt, nur andersherum.',
        { kind: 'flame', color: '#FF9A3C', trail: 'spark', impact: 'fire', sound: 'flame', impactSound: 'fire' }),
      tier('brenner', 1, 'Glutpfanne', 'Vulkans Esse', 'Vulkans Schmiede', 'Bronzebecken, Blasebalg, Geduld. Wer zu nah vorbeimarschiert, wird ordentlich angeheizt.',
        { kind: 'flame', color: '#FF8A2A', trail: 'fire', impact: 'fire', sound: 'flame', impactSound: 'fire' }),
      tier('brenner', 2, 'Feuersiphon', 'Drachenatem', 'Drachenkönig', 'Ein Drachenkopf aus Bronze, der flüssiges Feuer spuckt. Der Pumpenknecht schwitzt freiwillig.',
        { kind: 'flame', color: '#FF7A1A', trail: 'fire', impact: 'fire', sound: 'flame', impactSound: 'fire' }),
      tier('brenner', 3, 'Feuerwerker', 'Sonnenrad', 'Himmelsfeuerwerk', 'Rot, Gold und Weiß in einem knisternden Fächer. Schön anzusehen, außer man steht davor.',
        { kind: 'flame', color: '#FFCF5A', trail: 'spark', muzzle: 'spark', impact: 'fire', sound: 'flame', impactSound: 'fire' }),
      tier('brenner', 4, 'Gasbrenner', 'Hochofen', 'Hüttenwerk', 'Zwei Messingflaschen, ein Kupferrohr und eine blaue Zündflamme, die nie schläft.',
        { kind: 'flame', color: '#FF8C2E', trail: 'smoke', impact: 'fire', sound: 'flame', impactSound: 'fire' }),
      tier('brenner', 5, 'Plasmabrenner', 'Sonnenkern', 'Sternenherz', 'Drei Zinken, ein glühender Kern und ein Fächer aus Licht, der sehr warm ums Herz macht.',
        { kind: 'flame', color: '#FF4FA3', trail: 'energy', muzzle: 'energy', impact: 'fire', sound: 'plasma', impactSound: 'fire' }),
    ],
  },

  // ------------------------------------------------------------------------------------------- Taktgeber
  {
    id: 'taktgeber',
    role: 'Taktgeber',
    summary: 'Greift nicht an, gibt aber den Takt vor: Türme auf den acht Nachbarfeldern feuern schneller.',
    color: '#F2C230',
    icon: 'taktgeber',
    unlockWave: 5,
    cost: 120,
    // Aura mit Reichweite 1,5: genau die acht Nachbarfelder. Mehrere Taktgeber addieren sich nicht.
    stats: { ...NO_STATS, attack: 'none', range: 1.5, hitsGround: false, auraRate: BEAT_RATE[0] },
    // Stufe 2: 8 Punkte mehr. Stufe 3: 15 Punkte mehr.
    levels: [{}, { auraRate: 0.28 }, { auraRate: 0.35 }],
    branches: [
      branch('Fernsicht', 'range', 'Die Nachbarn reichen zusätzlich 20 % weiter.',
        { set: { auraRange: 0.2 } }, GIFTS.weitblick),
      branch('Kriegstrommel', 'damage', 'Die Nachbarn treffen zusätzlich 15 % härter.',
        { set: { auraDamage: 0.15 } }, GIFTS.taktkern),
    ],
    fusion: {
      // Reichweite 1,5 x 1,08 x 1,2 x 1,3 = 2,53: alle Felder im Abstand von zwei Feldern außer den vier Ecken (20 statt 8).
      // Dazu Wucht: +15 % Schaden für alle darin (eine Kriegstrommel kommt auf +30 %). Gemessen: +25 % änderte am Prüfstand nichts.
      core: { mul: { range: 1.3 }, add: { auraRate: 0.05, auraDamage: 0.15 } },
      coreText: 'Der Takt reicht zwei Felder weit, schlägt 5 Punkte schneller und gibt allen darin 15 % mehr Wucht. Schuss-Gaben bringen ihm nichts.',
      ...fallbackGift(GIFTS.weitblick),
    },
    tiers: [
      tier('taktgeber', 0, 'Trommler', 'Donnertrommel', 'Herzschlag der Erde', 'Bumm, bumm, bumm. Wer im Takt arbeitet, arbeitet schneller, das wusste man schon am Lagerfeuer.',
        beat('drum'), { auraRate: BEAT_RATE[0] }),
      tier('taktgeber', 1, 'Feldzeichen', 'Goldener Adler', 'Kaiseradler', 'Unter dem goldenen Adler bläst das Horn, und ringsum steht plötzlich jeder strammer.',
        beat('horn'), { auraRate: BEAT_RATE[1] }),
      tier('taktgeber', 2, 'Glockenturm', 'Domglocke', 'Kathedralgeläut', 'Die Glocke schlägt, und die Nachbarn laden im Takt nach. Sonntags auch.',
        beat('bell'), { auraRate: BEAT_RATE[2] }),
      tier('taktgeber', 3, 'Signalmast', 'Admiralsmast', 'Flaggschiff', 'Bunte Flaggen am Rah und ein Ausguck mit Fernrohr: Befehle, die man schon von weitem sieht.',
        beat('bell'), { auraRate: BEAT_RATE[3] }),
      tier('taktgeber', 4, 'Telegrafenmast', 'Funkturm', 'Großsender', 'Kurz, kurz, lang. Die Nachricht ist da, bevor der Bote seine Stiefel gefunden hat.',
        beat('chime'), { auraRate: BEAT_RATE[4] }),
      tier('taktgeber', 5, 'Leitrechner', 'Orakel', 'Weltorakel', 'Rechnet für alle Nachbarn mit und lässt sich das mit einem leisen Summen anmerken.',
        beat('pulse'), { auraRate: BEAT_RATE[5] }),
    ],
  },
];

// ------------------------------------------------------------------------------------------- Angriff der Superwaffen
// Wie der Angriff einer Super- oder Megawaffe aussieht (`superShot`): Die Darstellung folgt der Angriffsart des Kerns.

/** Strahl des Schützen-Kerns je Zeitalter: warmes Sonnenglas bis blaues Licht. */
const BEAM_COLORS = ['#FFC861', '#FFC24A', '#FFC861', '#CFE2FF', '#FFE27A', '#5AA8FF'];
/** @type {ShotSound[]} */
const BEAM_SOUNDS = ['chime', 'chime', 'bell', 'chime', 'tesla', 'laser'];
/** Frostpuls des Bremser-Kerns je Zeitalter. */
const FROST_COLORS = ['#BFEFFF', '#C9F2FF', '#B5E8F5', '#D2F4FF', '#A9E4F2', '#C9FFF2'];
/** Kettenblitz des Panzerknacker-Kerns je Zeitalter. */
const BOLT_COLORS = ['#C9A8FF', '#D2B5FF', '#BFA0FF', '#E9DCFF', '#C9A8FF', '#A66BFF'];
/** Feuerring des Brenner-Kerns je Zeitalter. */
const RING_COLORS = ['#FF9A3C', '#FF8A2A', '#FF7A1A', '#FFCF5A', '#FF8C2E', '#FF4FA3'];

/** @type {Record<string, (shot: ShotVisual, age: number) => ShotVisual>} */
const SUPER_SHOT = {
  schuetze: (_shot, age) => ({ kind: 'beam', color: BEAM_COLORS[age], muzzle: 'energy', impact: 'spark', sound: BEAM_SOUNDS[age], impactSound: 'energy' }),
  // Derselbe Wurf, aber brennend: Feuerspur und ein Einschlag, der den Boden entzündet.
  werfer: (shot) => ({ ...shot, color: '#FF8A3C', trail: 'fire', impact: 'fire', impactSound: 'fire' }),
  bremser: (_shot, age) => ({ kind: 'pulse', color: FROST_COLORS[age], impact: 'frost', sound: 'frost', impactSound: 'frost' }),
  knacker: (_shot, age) => ({ kind: 'bolt', color: BOLT_COLORS[age], muzzle: 'energy', impact: 'energy', sound: 'tesla', impactSound: 'zap' }),
  brenner: (shot, age) => ({ kind: 'pulse', color: RING_COLORS[age], trail: 'fire', impact: 'fire', sound: shot.sound, impactSound: 'fire' }),
  // Der Taktring bleibt, nur heller und weiter (die Darstellung skaliert ihn mit der Reichweite).
  taktgeber: (shot) => ({ ...shot, color: '#FFE27A' }),
};

for (const arch of ARCHETYPES) {
  const make = SUPER_SHOT[arch.id];
  arch.tiers.forEach((def, age) => {
    if (def) def.superShot = make(def.shot, age);
  });
}

// ------------------------------------------------------------------------------------------- Flak (Rezept)
// Namen und Salven der Flak je Zeitalter: kleine Wölkchen und Funken in der Luft, keine grellen Blitze.

/** @type {[string, string, ShotVisual][]} */
const FLAK_LOOKS = [
  ['Kieselhagel', 'Hagelsturm', { kind: 'tracer', color: '#D9D2C2', impact: 'dust', sound: 'sling', impactSound: 'stone' }],
  ['Salventurm', 'Legionssalve', { kind: 'tracer', color: '#F4F1E6', impact: 'dust', sound: 'bow', impactSound: 'arrow' }],
  ['Bolzenhagel', 'Bolzengewitter', { kind: 'tracer', color: '#E9E4DA', impact: 'spark', sound: 'crossbow', impactSound: 'arrow' }],
  ['Kartätsche', 'Kartätschenwall', { kind: 'tracer', color: '#CFE2FF', muzzle: 'smoke', impact: 'dust', sound: 'musket', impactSound: 'thud' }],
  ['Flakgeschütz', 'Flakturm', { kind: 'tracer', color: '#FFE27A', muzzle: 'smoke', impact: 'spark', sound: 'gatling', impactSound: 'thud' }],
  ['Flakbatterie', 'Flakschirm', { kind: 'tracer', color: '#8FD0FF', muzzle: 'energy', impact: 'energy', sound: 'pulse', impactSound: 'energy' }],
];

ARCHETYPES[0].tiers.forEach((def, age) => {
  if (!def) return;
  const [superName, megaName, superShot] = FLAK_LOOKS[age];
  def.recipes = { flak: { superName, megaName, superShot } };
});
// ------------------------------------------------------------------------------------------- Rezepte zum Freischalten
// Sieben weitere Rezepte (docs/briefs/fusion.md, 11), alle gesperrt: Sie wirken erst, wenn sie in der laufenden Partie
// freigeschaltet sind (Zeitgabe „Bauplan …“ in src/content/boons.js oder ein Zwischenboss ohne Funkenverlust). `ages` nennt die
// Positionen der Zeitalter, deren Zwischenboss das Rezept ziehen kann: Rom und Mittelalter je drei bis vier, die Entdecker fünf
// (dort kommen Flieger), Steinzeit und Zukunft keins (in der Steinzeit gibt es kaum Superwaffen, in der Zukunft wäre es zu spät). Werte wie bei der Flak: `set` vor der Skalierung
// (Einheiten von `stats`), `mul`/`add` danach. Jedes greift anders an als die gewöhnliche Superwaffe seines Kerns; die Zahlen sind
// mit tools/balance.mjs gemessen (Protokoll Schritt 18).

/**
 * @typedef {object} RecipeData
 * @property {string} core Kernrolle
 * @property {import('../types/content').FusionRecipe} recipe
 * @property {[string, string, ShotVisual][]} looks Name der Super- und der Megawaffe und Angriffsbild je Zeitalter (alle sechs)
 */

/** Wurf eines Rezepts mit Geschossmodell. @param {string} model @param {string} color @param {number} arc @param {Partial<ShotVisual>} [extra] @returns {ShotVisual} */
function lob(model, color, arc, extra) {
  return { kind: 'model', model, color, arc, tumble: true, impact: 'explosion', sound: 'catapult', impactSound: 'explosion', ...extra };
}

/** @type {RecipeData[]} */
const RECIPES = [
  {
    // Teerfeuer: Der Brenner wirft brennenden Teer weit auf den Weg, statt um sich zu lodern. Liegende Brandpfützen, die bremsen
    // (Bremsen und Brand zusammen: Brand wirkt anderthalbfach), weit hinaus statt rund um den Turm; nur am Boden.
    core: 'brenner',
    recipe: {
      id: 'teerfeuer',
      name: 'Teerfeuer',
      gifts: ['bremser', 'bremser'],
      locked: true,
      ages: [1, 2],
      core: { set: { attack: 'projectile', damage: 2, cooldown: 1.4, projectileSpeed: 6, splash: 1, zone: 4, dot: 14, dotDuration: 2, range: 1.8, hitsAir: false }, mul: { range: 1.8 }, add: { slow: 0.2 } },
      coreText: 'Wird zum Teerfeuer: wirft brennenden Teer weit auf den Weg. Die Pfützen brennen 4 s und bremsen, was hineintritt. Nur am Boden.',
    },
    looks: [
      ['Harzfeuer', 'Harzfeuermeer', blob('#C8641E', 1.2, { trail: 'fire', impact: 'fire', impactSound: 'fire' })],
      ['Brandöl', 'Brandölmeer', blob('#D2702A', 1.3, { model: 'shot.amphore', tumble: true, trail: 'fire', impact: 'fire', impactSound: 'fire' })],
      ['Pechfeuer', 'Höllenpech', blob('#3A2A22', 1.3, { trail: 'fire', impact: 'fire', impactSound: 'fire' })],
      ['Teerfeuer', 'Teerfeuersturm', blob('#4A2A1E', 1.1, { trail: 'fire', impact: 'fire', sound: 'splash', impactSound: 'fire' })],
      ['Naphthaspeier', 'Naphthasee', blob('#3B2B3E', 0.9, { trail: 'fire', impact: 'fire', sound: 'splash', impactSound: 'fire' })],
      ['Glutgel', 'Glutgelflut', blob('#FF6A3C', 0.8, { trail: 'energy', impact: 'fire', sound: 'plasma', impactSound: 'fire' })],
    ],
  },
  {
    // Belagerungsgeschütz: seltene, sehr schwere Treffer auf den Stärksten, fast über die ganze Karte, ohne Rüstung; dafür blind
    // in den nächsten zwei Feldern und nur gegen Bodenziele. Der Kettenblitz lichtet Gruppen, das Geschütz bricht Riesen.
    core: 'knacker',
    recipe: {
      id: 'belagerung',
      name: 'Belagerungsgeschütz',
      gifts: ['taktgeber', 'taktgeber'],
      locked: true,
      ages: [2, 3],
      core: { set: { attack: 'projectile', projectileSpeed: 7, minRange: 2, chain: 0, splash: 0.6, hitsAir: false, cooldown: 6, damage: 40, range: 4.5, ramp: 0 }, mul: { damage: 3, range: 1.6 } },
      coreText: 'Wird zum Belagerungsgeschütz: alle 6 s ein gewaltiger Treffer ohne Rüstung, fast über die ganze Karte; blind auf zwei Felder und gegen Flieger.',
    },
    looks: [
      ['Fernspeer', 'Horizontspeer', { kind: 'model', model: 'shot.speer', color: '#B08A5A', arc: 1, impact: 'dust', sound: 'throw', impactSound: 'wood' }],
      ['Stadtbrecher', 'Reichsbrecher', lob('shot.steinkugel', '#C9C2B4', 2.4, { impact: 'dust', sound: 'ballista', impactSound: 'thud' })],
      ['Bombarde', 'Riesenbombarde', lob('shot.steinkugel', '#9A958C', 1.8, { muzzle: 'smoke', trail: 'smoke', sound: 'cannon', impactSound: 'bigExplosion' })],
      ['Festungskanone', 'Festungsbatterie', lob('shot.bombe', '#E9DCFF', 1.6, { muzzle: 'smoke', trail: 'smoke', sound: 'cannon', impactSound: 'bigExplosion' })],
      ['Ferngeschütz', 'Fernkoloss', lob('shot.bombe', '#C9A8FF', 1.4, { muzzle: 'flash', trail: 'smoke', sound: 'howitzer', impactSound: 'bigExplosion' })],
      ['Orbitalkanone', 'Orbitalbatterie', { kind: 'model', model: 'shot.rakete', color: '#A66BFF', arc: 1.8, trail: 'energy', muzzle: 'energy', impact: 'energy', sound: 'railgun', impactSound: 'bigExplosion' }],
    ],
  },
  {
    // Dampfkessel: ein sehr weiter, seltener Puls aus siedendem Dampf, der alles im Umkreis verbrüht, auch Flieger, aber nicht
    // mehr bremst. Der Frostpuls (auch mit Brandsatz) hält auf, der Kessel verbrüht nur, dafür doppelt so weit in die Fläche; der
    // Feuerring trifft nur den Boden und reicht nicht so weit.
    core: 'bremser',
    recipe: {
      id: 'dampfkessel',
      name: 'Dampfkessel',
      gifts: ['brenner', 'brenner'],
      locked: true,
      ages: [2, 3],
      core: { set: { attack: 'pulse', damage: 3, cooldown: 3, dot: 5, dotDuration: 5, slowDuration: 0, hitsAir: true, zone: 0, splash: 0, range: 2.5 }, mul: { range: 1.35, slow: 0 } },
      coreText: 'Wird zum Dampfkessel: Alle 3 s faucht siedender Dampf sehr weit um den Turm und verbrüht alles darin 5 s lang, auch Flieger. Bremst nicht mehr.',
    },
    looks: [
      ['Heiße Quelle', 'Geysirfeld', { kind: 'pulse', color: '#E8F2F0', impact: 'splash', sound: 'steam', impactSound: 'splash' }],
      ['Thermenkessel', 'Caracallas Therme', { kind: 'pulse', color: '#F2EDE2', impact: 'splash', sound: 'steam', impactSound: 'splash' }],
      ['Siedekessel', 'Hexenkessel', { kind: 'pulse', color: '#E4EEE6', impact: 'splash', sound: 'steam', impactSound: 'splash' }],
      ['Dampfkessel', 'Kesselhaus', { kind: 'pulse', color: '#F4F1EA', impact: 'splash', sound: 'steam', impactSound: 'splash' }],
      ['Dampfturbine', 'Dampfkraftwerk', { kind: 'pulse', color: '#EDEFF2', impact: 'splash', sound: 'steam', impactSound: 'splash' }],
      ['Plasmanebel', 'Nebelreaktor', { kind: 'pulse', color: '#F0D9FF', impact: 'energy', sound: 'pulse', impactSound: 'energy' }],
    ],
  },
  {
    // Kommandoposten: Der Taktgeber gibt weiter den weiten Takt (ohne die Wucht der gewöhnlichen Superwaffe) und holt selbst
    // Flieger vom Himmel. Die einzige Taktgeber-Superwaffe, die kämpft; gegen Bodengegner tut sie selbst nichts.
    core: 'taktgeber',
    recipe: {
      id: 'kommando',
      name: 'Kommandoposten',
      gifts: ['schuetze', 'schuetze'],
      locked: true,
      ages: [3],
      core: { set: { attack: 'hitscan', damage: 5, cooldown: 0.5, hitsAir: true, hitsGround: false, range: 1.5 }, mul: { range: 1.3 }, add: { auraRate: 0.05 } },
      coreText: 'Wird zum Kommandoposten: schießt selbst Flieger ab, Bodengegner nicht; seine Wirkung reicht zwei Felder weit, ein Takt 5 Punkte schneller, ohne Wucht.',
    },
    looks: [
      ['Späherfels', 'Adlerhorst', { kind: 'model', model: 'shot.kiesel', color: '#9A968F', arc: 0.2, impact: 'dust', sound: 'sling', impactSound: 'stone' }],
      ['Prätorium', 'Feldherrnhügel', { kind: 'model', model: 'shot.pfeil', color: '#F2C230', arc: 0.05, impact: 'dust', sound: 'bow', impactSound: 'arrow' }],
      ['Burgwarte', 'Königswarte', { kind: 'model', model: 'shot.bolzen', color: '#F2C230', arc: 0, impact: 'spark', sound: 'crossbow', impactSound: 'arrow' }],
      ['Krähennest', 'Admiralsbrücke', { kind: 'tracer', color: '#FFE27A', muzzle: 'smoke', impact: 'spark', sound: 'musket', impactSound: 'thud' }],
      ['Horchposten', 'Horchfestung', { kind: 'tracer', color: '#FFE27A', muzzle: 'flash', impact: 'spark', sound: 'rifle', impactSound: 'thud' }],
      ['Leitstand', 'Kommandozentrale', { kind: 'tracer', color: '#FFE27A', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' }],
    ],
  },
  {
    // Panzergranate: Der Werfer verzichtet auf das Brandfeld und wirft schwere Granaten, deren größerer Einschlag Rüstung ganz
    // ignoriert. Gegen gepanzerte Kolonnen (Ritter, Schildwagen); nur am Boden, wie jeder Werfer.
    core: 'werfer',
    recipe: {
      id: 'panzergranate',
      name: 'Panzergranate',
      gifts: ['knacker', 'knacker'],
      locked: true,
      ages: [1, 2],
      core: { set: { attack: 'projectile', zone: 0, dot: 0, pierce: 1, projectileSpeed: 8, damage: 20, cooldown: 2.5, range: 3.5, minRange: 0, hitsAir: false }, mul: { damage: 2.8, splash: 1.4, cooldown: 0.9 } },
      coreText: 'Wird zur Panzergranate: kein Brandfeld, fast dreifache Wucht, ein größerer Einschlag (falls es einen gab), keine Rüstung hält. Nur am Boden.',
    },
    looks: [
      ['Felsbrecher', 'Erdspalter', lob('shot.felsbrocken', '#7E7A73', 1.4, { impact: 'dust', sound: 'throw', impactSound: 'stone' })],
      ['Testudoknacker', 'Schildwallbrecher', lob('shot.tontopf', '#A65A2E', 1.2, { impact: 'dust', impactSound: 'thud' })],
      ['Rüstungsbrecher', 'Harnischsprenger', lob('shot.steinkugel', '#8A857D', 1.8, { impact: 'dust', impactSound: 'metal' })],
      ['Panzergranate', 'Granatbatterie', lob('shot.bombe', '#C9C2B4', 1.6, { trail: 'smoke', muzzle: 'smoke', sound: 'mortar', impactSound: 'bigExplosion' })],
      ['Stahlbrecher', 'Panzerhaubitze', lob('shot.bombe', '#B8BCC4', 1.6, { trail: 'smoke', muzzle: 'smoke', sound: 'howitzer', impactSound: 'bigExplosion' })],
      ['Hohlladung', 'Hohlladungsturm', { kind: 'model', model: 'shot.rakete', color: '#E9DCFF', arc: 0.9, trail: 'smoke', muzzle: 'flash', impact: 'explosion', sound: 'rocket', impactSound: 'bigExplosion' }],
    ],
  },
  {
    // Brennglas: ein Strahl ohne Aufheizen, der um sein Ziel herum alles versengt und in Brand setzt, Boden wie Luft. Der
    // gewöhnliche Strahl schmilzt einen Einzelnen, das Brennglas eine Traube.
    core: 'schuetze',
    recipe: {
      id: 'brennglas',
      name: 'Brennglas',
      gifts: ['werfer', 'brenner'],
      locked: true,
      ages: [1, 3],
      core: { set: { attack: 'beam', damage: 9, cooldown: 0.2, ramp: 0, rampTime: 0, splash: 0.9, chain: 0, dot: 7, dotDuration: 2, range: 3, minRange: 0 } },
      coreText: 'Wird zum Brennglas: ein Strahl, der nicht aufheizt, aber alles im Umkreis seines Ziels versengt und 2 s lang brennen lässt, auch Flieger.',
    },
    looks: [
      ['Glutauge', 'Feuerauge', { kind: 'beam', color: '#FFB347', muzzle: 'energy', impact: 'fire', sound: 'chime', impactSound: 'fire' }],
      ['Brennspiegel', 'Archimedesspiegel', { kind: 'beam', color: '#FFC24A', muzzle: 'energy', impact: 'fire', sound: 'chime', impactSound: 'fire' }],
      ['Brennglas', 'Rosettenglut', { kind: 'beam', color: '#FFB03A', muzzle: 'energy', impact: 'fire', sound: 'bell', impactSound: 'fire' }],
      ['Brennlinse', 'Leuchtturmlinse', { kind: 'beam', color: '#FFD27A', muzzle: 'energy', impact: 'fire', sound: 'chime', impactSound: 'fire' }],
      ['Bogenlicht', 'Bogenlichtturm', { kind: 'beam', color: '#FFE9A8', muzzle: 'spark', impact: 'fire', sound: 'tesla', impactSound: 'fire' }],
      ['Sonnenfokus', 'Solarbrenner', { kind: 'beam', color: '#FF9A5A', muzzle: 'energy', impact: 'fire', sound: 'laser', impactSound: 'fire' }],
    ],
  },
  {
    // Fesselstrahl: Der Bremser hält einen einzigen Gegner im Strahl fest und bremst ihn so stark wie seine Pfütze, auch Flieger
    // und Bosse (die nur halb), und heizt dabei auf. Der Frostpuls bremst alle ein wenig, der Fesselstrahl einen sehr.
    core: 'bremser',
    recipe: {
      id: 'fesselstrahl',
      name: 'Fesselstrahl',
      gifts: ['schuetze', 'knacker'],
      locked: true,
      ages: [3],
      core: { set: { attack: 'beam', damage: 5, cooldown: 0.2, ramp: 1, rampTime: 4, splash: 0, zone: 0, slowDuration: 1, hitsAir: true, range: 2.5 }, mul: { range: 1.3 } },
      coreText: 'Wird zum Fesselstrahl: hält ein Ziel im Strahl und bremst es so stark wie der Turm sonst bremst (Bosse halb), auch Flieger; in 4 s doppelt so heiß.',
    },
    looks: [
      ['Harzfaden', 'Harzgespinst', { kind: 'beam', color: '#E0A030', muzzle: 'energy', impact: 'splash', sound: 'chime', impactSound: 'splash' }],
      ['Medusenblick', 'Gorgonenblick', { kind: 'beam', color: '#B8C43A', muzzle: 'energy', impact: 'frost', sound: 'chime', impactSound: 'frost' }],
      ['Bannstrahl', 'Großer Bann', { kind: 'beam', color: '#9FD8E8', muzzle: 'energy', impact: 'frost', sound: 'bell', impactSound: 'frost' }],
      ['Polarstrahl', 'Nordlicht', { kind: 'beam', color: '#BFEFFF', muzzle: 'energy', impact: 'frost', sound: 'frost', impactSound: 'frost' }],
      ['Kältestrahl', 'Kältemaschine', { kind: 'beam', color: '#A9E4F2', muzzle: 'spark', impact: 'frost', sound: 'tesla', impactSound: 'frost' }],
      ['Fesselstrahl', 'Stasisfeld', { kind: 'beam', color: '#C9FFF2', muzzle: 'energy', impact: 'frost', sound: 'laser', impactSound: 'frost' }],
    ],
  },
];
for (const { core, recipe, looks } of RECIPES) {
  const arch = /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === core));
  const fusion = /** @type {NonNullable<TowerArchetypeDef['fusion']>} */ (arch.fusion);
  fusion.recipes = [...(fusion.recipes ?? []), recipe];
  arch.tiers.forEach((def, age) => {
    if (!def) return;
    const [superName, megaName, superShot] = looks[age];
    def.recipes = { ...(def.recipes ?? {}), [recipe.id]: { superName, megaName, superShot } };
  });
}

// ------------------------------------------------------------------------------------------- Plätze und Waffenpool
// docs/briefs/fusion.md, 12; Regeln in docs/SIM.md, „Waffenpool“. Die sechs Rollen sind die Plätze der Bauleiste, ihre Kennung ist
// die der klassischen Waffe. Jede Partie zieht je Platz eine Waffe (SimConfig.loadout). Eine Waffe des Pools ist ein vollständiger
// `TowerArchetypeDef` mit `slot`, `name` und `look`; `role`, `color`, `icon` und `unlockWave` übernimmt sie von ihrem Platz, die
// Modelle je Zeitalter ebenfalls (`slotModel`). Sie bringt eigene Werte, zwei Zweige mit je einer Gabe, einen eigenen Kern als
// Superwaffe und Namen und Angriffsbilder in allen sechs Zeitaltern mit.

/** Was jede Waffe eines Platzes leisten muss (`SlotDef.job`) und ein Satz, der für jede Waffe des Platzes stimmt. */
const SLOT_TEXT = {
  schuetze: { summary: 'Einzelne Ziele, schnell und genau. Meist auch gegen Flieger.' },
  werfer: { summary: 'Trifft alles in einem Umkreis auf einmal.', job: /** @type {const} */ ('area') },
  bremser: { summary: 'Macht Gegner langsam, damit die anderen länger treffen.', job: /** @type {const} */ ('slow') },
  knacker: { summary: 'Harte Treffer, denen keine Rüstung standhält.', job: /** @type {const} */ ('armor') },
  brenner: { summary: 'Schaden über Zeit, der Rüstung ignoriert und Schilde und Heilung unten hält.', job: /** @type {const} */ ('burn') },
  taktgeber: { summary: 'Greift nicht selbst an, sondern stärkt die Türme ringsum.', job: /** @type {const} */ ('aura') },
};

/**
 * Die sechs Plätze in der Reihenfolge der Bauleiste, abgeleitet aus den klassischen Waffen.
 * @type {import('../types/content').SlotDef[]}
 */
export const SLOTS = ARCHETYPES.map((arch) => {
  const text = SLOT_TEXT[/** @type {keyof typeof SLOT_TEXT} */ (arch.id)];
  return { id: arch.id, name: arch.role, summary: text.summary, color: arch.color, icon: arch.icon, ...('job' in text ? { job: text.job } : {}) };
});

/**
 * Die klassische Waffe eines Platzes.
 * @param {string} slot
 * @returns {TowerArchetypeDef}
 */
function classicOf(slot) {
  return /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === slot));
}

/**
 * Was eine Waffe des Pools von ihrem Platz übernimmt: Platz, Name der Aufgabe, Farbe, Symbol, Freischaltwelle.
 * @param {string} slot
 */
function slotFields(slot) {
  const classic = classicOf(slot);
  return { slot, role: classic.role, color: classic.color, icon: classic.icon, unlockWave: classic.unlockWave };
}

/**
 * Eine Ausprägung einer Waffe des Pools: das Modell des Platzes in diesem Zeitalter, eigene Namen und eigene Angriffsbilder.
 * @param {string} slot Platz
 * @param {number} age Index des Zeitalters
 * @param {[string, string, string, string]} names Turm, Superwaffe, Megawaffe, Stimmungssatz
 * @param {ShotVisual} shot
 * @param {ShotVisual} superShot
 * @param {Partial<TowerStats>} [tweak]
 * @returns {TowerTierDef}
 */
function poolTier(slot, age, names, shot, superShot, tweak) {
  const [name, superName, megaName, flavor] = names;
  const model = /** @type {TowerTierDef} */ (classicOf(slot).tiers[age]).model;
  /** @type {TowerTierDef} */
  const def = { name, superName, megaName, flavor, model, shot, superShot };
  if (tweak) def.tweak = tweak;
  return def;
}

/**
 * Die sechs Ausprägungen einer Waffe des Pools (je Zeitalter `poolTier`).
 * @param {string} slot Platz
 * @param {[string, string, string, string][]} names je Zeitalter Turm, Superwaffe, Megawaffe, Stimmungssatz
 * @param {(age: number) => ShotVisual} shot Angriffsbild je Zeitalter
 * @param {(age: number) => ShotVisual} superShot Angriffsbild der Super- und Megawaffe je Zeitalter
 * @param {(age: number) => Partial<TowerStats> | undefined} [tweak] Abweichung je Zeitalter
 * @returns {TowerTierDef[]}
 */
function poolTiers(slot, names, shot, superShot, tweak) {
  return names.map((row, age) => poolTier(slot, age, row, shot(age), superShot(age), tweak ? tweak(age) : undefined));
}

/** Verlangsamung des Netzwerfers auf Stufe 1 je Zeitalter: 5 Punkte über der Pfütze, dafür nur ein Ziel. */
const NET_SLOW = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
/** Zeichen des Leuchtfeuers auf Stufe 1 je Zeitalter: 15 % und je Zeitalter 2 Punkte mehr. */
const LIGHT_MARK = [0.15, 0.17, 0.19, 0.21, 0.23, 0.25];

/** Verlangsamung der Kältewelle auf Stufe 1 je Zeitalter: 5 Punkte unter der Pfütze, dafür auch Flieger. */
const FROST_SLOW = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
/** Farbe der Kältewelle je Zeitalter. */
const CHILL_COLORS = ['#CDEFFF', '#D6F3FF', '#BDE7F7', '#DDF6FF', '#B8E6F4', '#B9F4FF'];
/** Farbe der Frostkette (Superwaffe) je Zeitalter. */
const ICE_BOLT = ['#A9E4FF', '#B5EAFF', '#9FDCF5', '#C4EEFF', '#9ED8F0', '#8FF0FF'];
/** @type {ShotSound[]} */
const CHILL_SOUNDS = ['frost', 'frost', 'bell', 'frost', 'steam', 'pulse'];

/** Grün des Gifts je Zeitalter. */
const VENOM = ['#7FBF4A', '#8CC850', '#76B947', '#9BE36A', '#B5E85A', '#7CFF8A'];
/** Klang der Giftschwade (Superwaffe) je Zeitalter. @type {ShotSound[]} */
const VENOM_SOUNDS = ['sling', 'bow', 'crossbow', 'musket', 'gatling', 'pulse'];

/** @type {TowerArchetypeDef[]} */
export const POOL = [
  // ------------------------------------------------------------------------------------------- Frostturm (Platz Bremser)
  {
    id: 'frostturm',
    name: 'Frostturm',
    ...slotFields('bremser'),
    summary: 'Sendet alle 2 s eine Kältewelle rund um sich: Alles in Reichweite wird langsam, auch Flieger. Kaum Schaden.',
    look: { accent: '#9FE3FF', marker: 'crystal' },
    cost: 75,
    // Puls um den Turm statt Pfützen auf dem Weg: Radius 1,6, bremst wie die Pfütze minus 5 Punkte, 1,5 s lang. Der kleine
    // Schaden (2) kommt gegen Rüstung kaum an; er ist nur ein Biss.
    stats: { ...NO_STATS, attack: 'pulse', damage: 2, cooldown: 2, range: 1.6, slow: FROST_SLOW[0], slowDuration: 1.5, hitsAir: true },
    // Wie beim Bremser: Stufe 2 bremst 8 Punkte stärker, Stufe 3 15 Punkte.
    levels: [{}, { slow: FROST_SLOW[0] + 0.08 }, { slow: FROST_SLOW[0] + 0.15 }],
    branches: [
      branch('Eiskreis', 'splash', 'Die Kältewelle reicht ein Drittel weiter und erfasst einen viel längeren Wegabschnitt.',
        { mul: { range: 1.35 } },
        { name: 'Eiskranz', mod: { mul: { range: 1.15, slowDuration: 1.5 } },
          text: '15 % mehr Reichweite; was der Kern verlangsamt, bleibt anderthalbmal so lange langsam. Einem Kern ohne Verlangsamung bringt nur die Reichweite etwas.' }),
      branch('Klirrfrost', 'slow', 'Die Welle bremst 10 Punkte stärker und beißt dreimal so fest.',
        { mul: { damage: 3 }, add: { slow: 0.1 } },
        { name: 'Eissplitter', mod: { set: { slow: 0.15 }, add: { slowDuration: 1.5, damage: 0.4 } },
          text: 'Treffer verlangsamen 1,5 s lang um 15 % und beißen mit 0,4 Standardschüssen mehr; ein Kern, der schon stärker bremst, behält seine Verlangsamung. Taktgebern nichts.' }),
    ],
    fusion: {
      // Frostkette: trifft sofort und springt auf bis zu fünf weitere Gegner (je Sprung 70 %), Boden wie Luft, und bremst jeden
      // so stark wie die Kältewelle, 2,5 s lang. Der Frostpuls des Bremsers bremst alle im Kreis, die Kette Gruppen entlang des Weges.
      core: { set: { attack: 'hitscan', damage: 6, cooldown: 1, chain: 5, chainRange: 1.8, slowDuration: 2.5, hitsAir: true }, mul: { range: 1.5 } },
      coreText: 'Wird zur Frostkette: Ein Kältestrahl springt über bis zu fünf weitere Gegner, auch Flieger, und bremst jeden so stark wie die Welle.',
      gift: { mul: { range: 1.15, slowDuration: 1.5 } },
      giftName: 'Eiskranz',
      giftText: '15 % mehr Reichweite; was der Kern verlangsamt, bleibt anderthalbmal so lange langsam. Einem Kern ohne Verlangsamung bringt nur die Reichweite etwas.',
    },
    tiers: [
      ['Eisschamane', 'Gletscherkette', 'Eiszeitkette', 'Ein Schlag auf die Eistrommel, und ein kalter Hauch zieht über den Weg. Sogar die Vögel frösteln.'],
      ['Kältekammer', 'Boreas-Kette', 'Boreas’ Zorn', 'Schnee aus den Alpen, in Stroh verpackt und mit einem Fächer verteilt. Teuer, aber erfrischend.'],
      ['Eiskeller', 'Frostkette', 'Winterkönig', 'Unten im Gewölbe lagert das Eis des letzten Winters. Wer vorbeikommt, bekommt kalte Füße.'],
      ['Eiskiste', 'Polarkette', 'Packeiskette', 'Eis aus dem Norden, sorgsam verladen. Was an dieser Kiste vorbeigeht, geht danach langsamer.'],
      ['Kühlturm', 'Ammoniakkette', 'Eisfabrik', 'Kompressor, Kupferschlangen und ein Ventil, das alle zwei Sekunden eine eisige Wolke ausatmet.'],
      ['Kryoturm', 'Kryokette', 'Kryosphäre', 'Ein Ring aus blauem Licht und ein leises Knistern: Hier friert sogar die Luft ein wenig.'],
    ].map((names, age) => poolTier('bremser', age, /** @type {[string, string, string, string]} */ (names),
      { kind: 'pulse', color: CHILL_COLORS[age], impact: 'frost', sound: CHILL_SOUNDS[age], impactSound: 'frost' },
      { kind: 'bolt', color: ICE_BOLT[age], muzzle: 'energy', impact: 'frost', sound: 'frost', impactSound: 'frost' },
      { slow: FROST_SLOW[age] })),
  },

  // ------------------------------------------------------------------------------------------- Giftschütze (Platz Schütze)
  {
    id: 'giftschuetze',
    name: 'Giftschütze',
    ...slotFields('schuetze'),
    summary: 'Ein leichter Treffer, der in einer kleinen Giftwolke zerplatzt: Gift wirkt 4 s, ignoriert Rüstung und erreicht auch Flieger.',
    look: { accent: '#8FCB4A', marker: 'vial' },
    dotKind: 'poison',
    cost: 60,
    // 5 Schaden je Treffer im Umkreis 0,5, dazu Gift 6 je Sekunde für 4 s. Ein Turm allein trifft einen Einzelnen stärker als der
    // Schütze (4 + 6 statt 8 je Sekunde, das Gift ohne Rüstung), aber Gift stapelt sich nicht: Drei Giftschützen auf demselben Ziel
    // schaffen 18 statt 24. Gegen Trauben, Schilde und Heiler besser. Gemessen mit tools/balance.mjs (Protokoll Schritt 20).
    stats: { ...NO_STATS, attack: 'projectile', damage: 5, cooldown: 1.25, range: 3, projectileSpeed: 9, splash: 0.5, dot: 6, dotDuration: 4, hitsAir: true },
    levels: [{}, {}, {}],
    branches: [
      branch('Giftwolke', 'splash', 'Der Pfeil zerplatzt in einer großen Wolke (Radius 0,9) und vergiftet ganze Gruppen.',
        { set: { splash: 0.9 } },
        { name: 'Giftnebel', mod: { mul: { splash: 1.25 }, add: { dot: 0.75, dotDuration: 3 } },
          text: 'Treffer vergiften 3 s lang (drei Viertel Standardschuss je Sekunde, ohne Rüstung); Einschläge mit Fläche wachsen um ein Viertel. Taktgebern nichts.' }),
      branch('Nervengift', 'acid', 'Das Gift ist 60 % stärker und wirkt 6 s lang. Stark gegen Zähe, Schilde und Heiler.',
        { set: { dotDuration: 6 }, mul: { dot: 1.6 } },
        { name: 'Schleichgift', mod: { mul: { dot: 1.15, dotDuration: 2, range: 1.1 }, add: { dot: 0.4, dotDuration: 1 } },
          text: '10 % mehr Reichweite; was schon brennt oder vergiftet, tut es doppelt so lange und etwas stärker, alles andere wird leicht vergiftet.' }),
    ],
    fusion: {
      // Giftschwade: trifft sofort alle 0,7 s mit 7,5 im Umkreis 1,2, Gift 60 % stärker; Boden wie Luft. Der Strahl des Schützen
      // schmilzt einen Einzelnen, die Schwade vergiftet ganze Schwärme (mit 6 Schaden und Gift x1,5 gewann der beste Bot 22 statt 32
      // von 60, mit 9 und x1,7 38).
      core: { set: { attack: 'hitscan', damage: 7.5, cooldown: 0.7, splash: 1.2, chain: 0 }, mul: { dot: 1.6 } },
      coreText: 'Wird zur Giftschwade: trifft sofort und hüllt das Ziel samt Umkreis in Gift, das 4 s lang wirkt, Boden wie Luft.',
      gift: { mul: { splash: 1.25 }, add: { dot: 0.75, dotDuration: 3 } },
      giftName: 'Giftnebel',
      giftText: 'Treffer vergiften 3 s lang (drei Viertel Standardschuss je Sekunde, ohne Rüstung); Einschläge mit Fläche wachsen um ein Viertel. Taktgebern nichts.',
    },
    tiers: /** @type {[string, string, string, string, ShotVisual][]} */ ([
      ['Blasrohrjäger', 'Sumpfschwade', 'Moornebel', 'Ein hohles Schilfrohr, ein Pfeil mit grüner Spitze und sehr viel Geduld.',
        { kind: 'model', model: 'shot.pfeil', color: VENOM[0], arc: 0.15, impact: 'splash', sound: 'bow', impactSound: 'splash' }],
      ['Schierlingsbogner', 'Schierlingswolke', 'Lethes Nebel', 'Der Heilkundige der Legion kennt jedes Kraut. Manche davon nimmt er nicht für den Tee.',
        { kind: 'model', model: 'shot.pfeil', color: VENOM[1], arc: 0.1, impact: 'splash', sound: 'bow', impactSound: 'splash' }],
      ['Giftarmbrust', 'Nesselschwade', 'Nachtschattenwolke', 'Bolzen mit Kräutersud. Riecht nach Wiese und wirkt wie ein sehr schlechter Tag.',
        { kind: 'model', model: 'shot.bolzen', color: VENOM[2], arc: 0, impact: 'splash', sound: 'crossbow', impactSound: 'splash' }],
      ['Giftbüchse', 'Fieberwolke', 'Fieberküste', 'Ein Apotheker mit Muskete. Die Kugel ist klein, die Phiole daran umso größer.',
        { kind: 'tracer', color: VENOM[3], muzzle: 'smoke', impact: 'splash', sound: 'musket', impactSound: 'splash' }],
      ['Säurespritze', 'Säureschwade', 'Säuregewitter', 'Messingtank, Gummischlauch, Druckknopf. Was getroffen wird, fängt leise an zu zischen.',
        { kind: 'tracer', color: VENOM[4], muzzle: 'flash', impact: 'splash', sound: 'rifle', impactSound: 'splash' }],
      ['Toxinlaser', 'Toxinschwade', 'Toxinsturm', 'Ein grüner Strich, ein grünes Wölkchen, und die Anzeige der Gegner wird langsam kürzer.',
        { kind: 'beam', color: VENOM[5], muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' }],
    ]).map(([name, superName, megaName, flavor, shot], age) => poolTier('schuetze', age, [name, superName, megaName, flavor], shot,
      { kind: age === 5 ? 'bolt' : 'tracer', color: VENOM[age], muzzle: age === 5 ? 'energy' : 'smoke', impact: 'splash', sound: VENOM_SOUNDS[age], impactSound: 'splash' },
      age >= 3 ? HITSCAN : undefined)),
  },

  // ------------------------------------------------------------------------------------------- Schnellschütze (Platz Schütze)
  {
    id: 'schnellschuetze',
    name: 'Schnellschütze',
    ...slotFields('schuetze'),
    summary: 'Kurze Reichweite (2,7 Felder), dafür zweieinhalb Schüsse je Sekunde; trifft auch Flieger. Jeder Treffer ist leicht, Rüstung schluckt viel davon.',
    look: { accent: '#7FD4FF', marker: 'ring' },
    cost: 65,
    // 3,8 Schaden alle 0,4 s: 9,5 je Sekunde (Schütze 8), aber auf 2,7 statt 3 Felder und in kleinen Häppchen, an denen Rüstung
    // viel abzieht. Gegen Schwärme, Schnelle und Flieger gut, gegen Gepanzerte schlecht (Zweig Hartkern hilft). Gemessen mit
    // tools/balance.mjs (Protokoll Schritt 21): mit 3 Schaden auf 2,4 Feldern gewann der beste Bot 1 von 60.
    stats: { ...NO_STATS, attack: 'projectile', damage: 3.8, cooldown: 0.4, range: 2.7, projectileSpeed: 12, hitsAir: true },
    levels: [{}, {}, {}],
    branches: [
      branch('Kugelhagel', 'rate', 'Vier statt zweieinhalb Schüsse je Sekunde, jeder ein Drittel leichter: etwas mehr Wucht je Sekunde, aber noch schwächer gegen Rüstung.',
        { set: { cooldown: 0.25, damage: 2.5 } },
        { name: 'Prellschuss', mod: { add: { chain: 1, chainRange: 1 }, mul: { cooldown: 0.9 } },
          text: 'Einzelschüsse, Strahlen und Blitze springen auf einen Gegner mehr (bis 1 Feld weit); Schüsse, Würfe und Pulse kommen 10 % schneller. Taktgebern nichts.' }),
      branch('Hartkern', 'pierce', 'Gehärtete Kugeln aus längerem Lauf: anderthalbfache Wucht je Treffer, ein Drittel seltener, 20 % mehr Reichweite, und 80 % der Rüstung zählen nicht.',
        { set: { cooldown: 0.6, damage: 5.5, pierce: 0.8 }, mul: { range: 1.2 } },
        { name: 'Stahlkern', mod: { add: { pierce: 0.4 }, mul: { damage: 1.1 } },
          text: 'Treffer ignorieren 40 Prozentpunkte mehr Rüstung (höchstens alle) und treffen 10 % härter; Brand bleibt, wie er ist. Taktgebern nichts.' }),
    ],
    fusion: {
      // Kugelwirbel: zweieinhalbmal je Sekunde ein Puls, der jeden Gegner in Reichweite trifft, Boden wie Luft (je Gegner 15 je
      // Sekunde vor der Skalierung; der Strahl 8, aufgeheizt 20, aber nur auf einen). Der Strahl schmilzt einen, die Flak lichtet
      // Schwärme in der Ferne, der Wirbel räumt rund um sich auf, 30 % weiter als der Turm reicht.
      core: { set: { attack: 'pulse', damage: 6, cooldown: 0.4, chain: 0, splash: 0 }, mul: { range: 1.3 } },
      coreText: 'Wird zum Kugelwirbel: Zweieinhalbmal je Sekunde fegt eine Garbe rundum, 30 % weiter als der Turm, und trifft jeden Gegner darin, auch Flieger.',
      gift: { add: { chain: 1, chainRange: 1 }, mul: { cooldown: 0.9 } },
      giftName: 'Prellschuss',
      giftText: 'Einzelschüsse, Strahlen und Blitze springen auf einen Gegner mehr (bis 1 Feld weit); Schüsse, Würfe und Pulse kommen 10 % schneller. Taktgebern nichts.',
    },
    tiers: poolTiers('schuetze', [
      ['Steinhagler', 'Kieselwirbel', 'Steinsturm', 'Eine Tasche voll Kiesel und zwei flinke Hände: Wer lange zielt, verliert, wer schnell wirft, gewinnt.'],
      ['Funditor', 'Bleiwirbel', 'Bleisturm', 'Der Schleuderer der Legion wirft Bleikugeln mit eingeritztem Gruß. Lesen kann ihn keiner, der getroffen wird.'],
      ['Repetierarmbrust', 'Bolzenwirbel', 'Bolzensturm', 'Ein Kasten voll Bolzen über der Sehne: Hebel vor, Hebel zurück, und schon fliegt der nächste.'],
      ['Drehbasse', 'Schrotwirbel', 'Schrotsturm', 'Ein kleines Drehgeschütz von der Reling, mit Schrot geladen. Es dreht sich schneller, als der Bootsmann fluchen kann.'],
      ['Revolverkanone', 'Kugelspritze', 'Bleigewitter', 'Fünf Läufe, eine Kurbel, ein Gurt: Die Messinghülsen klimpern im Takt auf den Boden.'],
      ['Nadelwerfer', 'Nadelwirbel', 'Nadelsturm', 'Wirft winzige Pfeile aus Licht, hunderte in der Minute. Einzeln kitzeln sie nur.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.kiesel', color: '#A8A296', arc: 0.15, tumble: true, impact: 'dust', sound: 'sling', impactSound: 'stone' },
      { kind: 'model', model: 'shot.kiesel', color: '#8E9AA6', arc: 0.1, impact: 'dust', sound: 'sling', impactSound: 'stone' },
      { kind: 'model', model: 'shot.bolzen', color: '#D9D2C2', arc: 0, impact: 'dust', sound: 'crossbow', impactSound: 'arrow' },
      { kind: 'tracer', color: '#D2E6FF', muzzle: 'smoke', impact: 'spark', sound: 'musket', impactSound: 'thud' },
      { kind: 'tracer', color: '#FFE9A0', muzzle: 'flash', impact: 'spark', sound: 'mg', impactSound: 'thud' },
      { kind: 'tracer', color: '#7FD4FF', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' },
    ])[age], (age) => ({ kind: 'pulse', color: ['#D8D0C0', '#B9C3CC', '#E9E4DA', '#D2E6FF', '#FFE9A0', '#7FD4FF'][age], impact: age === 5 ? 'energy' : 'spark',
      sound: /** @type {ShotSound[]} */ (['sling', 'sling', 'crossbow', 'musket', 'gatling', 'laser'])[age], impactSound: 'thud' }),
    (age) => (age >= 3 ? HITSCAN : undefined)),
  },

  // ------------------------------------------------------------------------------------------- Fernwerfer (Platz Werfer)
  {
    id: 'fernwerfer',
    name: 'Fernwerfer',
    ...slotFields('werfer'),
    summary: 'Wirft sehr weit (5,2 Felder) und hart, lädt aber lange nach und trifft nichts, was näher als 2 Felder steht. Nur am Boden.',
    look: { accent: '#C9A06A', marker: 'pennant' },
    cost: 100,
    // 30 Schaden im Umkreis 1,1 alle 3,6 s (8,3 je Sekunde, Werfer 8), Reichweite 5,2 statt 3,5, aber blind bis 2 Felder und
    // langsame Geschosse. Gehört an den Rand, weit weg vom Weg; daneben gestellt trifft er fast nichts.
    stats: { ...NO_STATS, attack: 'projectile', damage: 30, cooldown: 3.6, range: 5.2, minRange: 2, projectileSpeed: 4, splash: 1.1 },
    levels: [{}, {}, {}],
    branches: [
      branch('Belagerungsrohr', 'range', 'Reicht ein Viertel weiter (auf Stufe 3 gut 7 Felder): Von einem Platz am Rand deckt er fast die halbe Karte.',
        { mul: { range: 1.25 } },
        { name: 'Weitwurf', mod: { mul: { range: 1.12, splash: 1.1 } },
          text: '12 % mehr Reichweite für jeden Kern, auch einen Taktgeber; Einschläge mit Fläche werden 10 % größer.' }),
      branch('Splitterladung', 'splash', 'Der tote Winkel schrumpft auf 1 Feld, die Einschläge wachsen um 30 %, treffen aber 15 % schwächer.',
        { set: { minRange: 1 }, mul: { splash: 1.3, damage: 0.85 } },
        { name: 'Splitter', mod: { mul: { splash: 1.25 }, add: { damage: 0.3 } },
          text: 'Einschläge mit Fläche wachsen um ein Viertel; jeder Treffer und Puls trifft mit 0,3 Standardschüssen mehr (ein Strahl je Sekunde). Taktgebern nichts.' }),
    ],
    fusion: {
      // Trommelfeuer: kein toter Winkel, fast jede Sekunde ein Einschlag mit 0,3-facher Wucht (je Sekunde etwa so viel wie der
      // Brandfeld-Wurf des Werfers ohne sein Feuer), dafür über die ganze Reichweite.
      core: { set: { minRange: 0, cooldown: 0.9, splash: 0.9, projectileSpeed: 6 }, mul: { damage: 0.3 } },
      coreText: 'Wird zum Trommelfeuer: kein toter Winkel mehr, und fast jede Sekunde schlägt eine Granate ein, weit über die Karte. Nur am Boden.',
      gift: { mul: { range: 1.12, splash: 1.1 } },
      giftName: 'Weitwurf',
      giftText: '12 % mehr Reichweite für jeden Kern, auch einen Taktgeber; Einschläge mit Fläche werden 10 % größer.',
    },
    tiers: poolTiers('werfer', [
      ['Fernschleuder', 'Steinregen', 'Felsenregen', 'Ein Lederriemen an einer langen Stange: Drei Mann holen Schwung, und der Stein ist schon über dem nächsten Hügel.'],
      ['Lithobolos', 'Legionsbatterie', 'Marsgewitter', 'Der griechische Steinwerfer im Dienst der Legion. Er zielt nicht auf die Mauer, sondern auf das, was dahinter steht.'],
      ['Mange', 'Sturmbatterie', 'Belagerungspark', 'Der lange Arm wirft über Zinnen und Gräben. Wer direkt davorsteht, ist dafür ganz sicher.'],
      ['Haubitze', 'Trommelbatterie', 'Granathagel', 'Ein kurzes Rohr, steil gestellt, ein Kanonier mit Quadrant: Die Granate fällt fast senkrecht vom Himmel.'],
      ['Feldhaubitze', 'Trommelfeuer', 'Stahlgewitter', 'Gezogenes Rohr, Messingskalen, eine Leitung zum Ausguck: Sie trifft, was sie nie gesehen hat.'],
      ['Lenkartillerie', 'Lenkfeuer', 'Himmelsbatterie', 'Die Granate rechnet unterwegs nach und landet auf den Zentimeter. Der Abschuss klingt erstaunlich höflich.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.felsbrocken', color: '#8A857C', arc: 2.6, tumble: true, impact: 'dust', sound: 'throw', impactSound: 'stone' },
      { kind: 'model', model: 'shot.steinkugel', color: '#B5AE9F', arc: 2.6, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'stone' },
      { kind: 'model', model: 'shot.steinkugel', color: '#9A958C', arc: 2.8, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'thud' },
      { kind: 'model', model: 'shot.bombe', color: '#C9A06A', arc: 3, tumble: true, trail: 'spark', muzzle: 'smoke', impact: 'explosion', sound: 'mortar', impactSound: 'explosion' },
      { kind: 'model', model: 'shot.bombe', color: '#B89058', arc: 3, trail: 'smoke', muzzle: 'smoke', impact: 'explosion', sound: 'howitzer', impactSound: 'bigExplosion' },
      { kind: 'model', model: 'shot.rakete', color: '#E8C48A', arc: 2.4, trail: 'smoke', muzzle: 'flash', impact: 'explosion', sound: 'rocket', impactSound: 'explosion' },
    ])[age], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.kiesel', color: '#8A857C', arc: 2, tumble: true, impact: 'dust', sound: 'throw', impactSound: 'stone' },
      { kind: 'model', model: 'shot.tontopf', color: '#B5AE9F', arc: 2, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'stone' },
      { kind: 'model', model: 'shot.steinkugel', color: '#9A958C', arc: 2.2, tumble: true, impact: 'dust', sound: 'catapult', impactSound: 'thud' },
      { kind: 'model', model: 'shot.bombe', color: '#FFB35A', arc: 2.2, trail: 'spark', muzzle: 'smoke', impact: 'explosion', sound: 'mortar', impactSound: 'explosion' },
      { kind: 'model', model: 'shot.bombe', color: '#FFA040', arc: 2.2, trail: 'smoke', muzzle: 'flash', impact: 'explosion', sound: 'howitzer', impactSound: 'explosion' },
      { kind: 'model', model: 'shot.rakete', color: '#FFC870', arc: 1.6, trail: 'energy', muzzle: 'flash', impact: 'explosion', sound: 'rocket', impactSound: 'explosion' },
    ])[age]),
  },

  // ------------------------------------------------------------------------------------------- Stampfer (Platz Werfer)
  {
    id: 'stampfer',
    name: 'Stampfer',
    ...slotFields('werfer'),
    summary: 'Stampft alle 2,6 s auf: Jeder Bodengegner auf den Nachbarfeldern nimmt Schaden und wird 0,35 Felder zurückgeworfen (Bosse halb). Nur am Boden.',
    look: { accent: '#A8865C', marker: 'spikes' },
    cost: 95,
    // Puls um den Turm statt Wurf: 15 Schaden alle 2,6 s an alle Bodengegner bis 1,5 Felder (5,8 je Sekunde und Gegner), dazu
    // Rückstoß 0,35 Felder (je Gegner höchstens einmal je Sekunde). Muss direkt am Weg stehen, am besten in einer Kurve.
    // Gemessen (Protokoll Schritt 21): mit 16 Schaden, Rückstoß 0,4 und der Gabe Erdstoß 0,3 gewann der beste Bot 44 statt 32 von 60.
    stats: { ...NO_STATS, attack: 'pulse', damage: 15, cooldown: 2.6, range: 1.5, push: 0.35 },
    levels: [{}, {}, {}],
    branches: [
      branch('Schwerer Hammer', 'damage', 'Jeder Schlag trifft anderthalbmal so hart und wirft 0,55 statt 0,35 Felder zurück, kommt aber ein Viertel seltener.',
        { mul: { damage: 1.5, cooldown: 1.25 }, add: { push: 0.2 } },
        { name: 'Erdstoß', mod: { add: { push: 0.2 }, mul: { damage: 1.05 } },
          text: 'Jeder Treffer wirft 0,2 Felder zurück (Bosse halb, ein Gegner höchstens einmal je Sekunde), dazu 5 % mehr Schaden. Taktgebern nichts.' }),
      branch('Bebenstoß', 'slow', 'Die Erde bebt nach: Getroffene taumeln 1 s lang 30 % langsamer (Bosse halb); der Rückstoß sinkt auf 0,2 Felder.',
        { set: { push: 0.2 }, add: { slow: 0.3, slowDuration: 1 } },
        { name: 'Erschütterung', mod: { add: { slow: 0.15, slowDuration: 1 } },
          text: 'Treffer bremsen 15 Punkte stärker (ohne eigene Verlangsamung um 15 %) und 1 s länger. Taktgebern nichts.' }),
    ],
    fusion: {
      // Beben: alle 2 s in weitem Umkreis, wirft zurück (wie der Zweig) und lässt 1,5 s lang taumeln (40 % langsamer).
      core: { set: { cooldown: 2, slow: 0.4, slowDuration: 1.5 }, mul: { range: 1.4 } },
      coreText: 'Wird zum Beben: Alle 2 s bebt der Boden in weitem Umkreis, wirft jeden Bodengegner zurück und lässt ihn 1,5 s lang taumeln (40 % langsamer).',
      gift: { add: { push: 0.2 }, mul: { damage: 1.05 } },
      giftName: 'Erdstoß',
      giftText: 'Jeder Treffer wirft 0,2 Felder zurück (Bosse halb, ein Gegner höchstens einmal je Sekunde), dazu 5 % mehr Schaden. Taktgebern nichts.',
    },
    tiers: poolTiers('werfer', [
      ['Stampfbaum', 'Mammuttritt', 'Erdbeben', 'Ein Baumstamm an zwei Seilen, hochgezogen und fallen gelassen. Der Boden wackelt, die Feuerdiebe auch.'],
      ['Pfahlramme', 'Vulcans Amboss', 'Vulcans Beben', 'Mit ihr schlugen Caesars Pioniere die Pfähle für die Rheinbrücke. Hier schlägt sie auf den Weg.'],
      ['Hammerwerk', 'Mühlenbeben', 'Bergbeben', 'Ein Wasserrad hebt den schweren Hammer, die Nocke lässt ihn fallen. Pochen, pochen, pochen.'],
      ['Pulverstampfe', 'Pulverbeben', 'Inselbeben', 'In der Pulvermühle stampfen die Hölzer den Salpeter. Draußen am Weg stampfen sie, was vorbeikommt.'],
      ['Dampframme', 'Dampfbeben', 'Eisenbeben', 'Zischen, heben, krachen: Die Ramme schlägt Pfähle und Feuerdiebe mit derselben Gelassenheit.'],
      ['Schockstampfer', 'Schockbeben', 'Gravitonbeben', 'Ein Kolben voller Feldenergie: ein dumpfer Schlag, eine blaue Welle, und alle rutschen ein Stück zurück.'],
    ], (age) => ({ kind: 'pulse', color: ['#B59A72', '#C2A57A', '#A89478', '#C9A06A', '#A8A29A', '#8FC8FF'][age], impact: age === 5 ? 'energy' : 'dust',
      sound: /** @type {ShotSound[]} */ (['drum', 'drum', 'catapult', 'cannon', 'steam', 'pulse'])[age], impactSound: age === 5 ? 'energy' : 'stone' }),
    (age) => ({ kind: 'pulse', color: ['#C9A97A', '#D6B47F', '#BFA27C', '#E0B470', '#C4BCB0', '#A6D8FF'][age], trail: age === 5 ? 'energy' : 'smoke', impact: age === 5 ? 'energy' : 'dust',
      sound: /** @type {ShotSound[]} */ (['drum', 'drum', 'cannon', 'cannon', 'steam', 'pulse'])[age], impactSound: 'bigExplosion' })),
  },

  // ------------------------------------------------------------------------------------------- Netzwerfer (Platz Bremser)
  {
    id: 'netzwerfer',
    name: 'Netzwerfer',
    ...slotFields('bremser'),
    summary: 'Wirft alle 2 s ein Netz auf einen einzelnen Gegner: 35 % langsamer für 2 s, auch Flieger (Bosse halb). Sucht sich Ungebremste aus. Kein Schaden.',
    look: { accent: '#E0C890', marker: 'orb' },
    cost: 70,
    // Einzelziel statt Fläche: bremst stärker als die Pfütze (35 % statt 30 %, je Zeitalter 5 Punkte mehr), weiter (3,2 Felder),
    // auch Flieger, aber nur einen alle 2 s. Mit `seek` verteilt er die Netze, statt dasselbe Ziel doppelt zu fangen. Gemessen
    // (Protokoll Schritt 21): mit 40 % für 2,5 s alle 1,6 s und Wurfgewicht 6 / 0,3 gewann der beste Bot 49 statt 32 von 60,
    // mit 35 % für 2 s noch 44, alle 1,8 s 39; zufällige Bewaffnungen mit ihm gewannen am häufigsten (69 %).
    stats: { ...NO_STATS, attack: 'projectile', damage: 0, cooldown: 2, range: 3.2, projectileSpeed: 8, slow: NET_SLOW[0], slowDuration: 2, hitsAir: true, seek: true },
    levels: [{}, { slow: NET_SLOW[0] + 0.08 }, { slow: NET_SLOW[0] + 0.15 }],
    branches: [
      branch('Doppelnetz', 'chain', 'Das Netz fängt einen zweiten Gegner bis 1,3 Felder daneben mit, genauso fest.',
        { set: { chain: 1, chainRange: 1.3 } },
        { name: 'Fangleine', mod: { set: { seek: true }, add: { slowDuration: 1 } },
          text: 'Der Kern sucht sich zuerst Gegner, die seine Wirkung noch nicht tragen (Brand, Bremsen, Zeichen), und was er bremst, bleibt 1 s länger langsam. Pulsen und Taktgebern bringt das Suchen nichts.' }),
      branch('Wurfgewicht', 'damage', 'Schwere Kugeln am Netz: Treffer beißen (10 Schaden in der Steinzeit, mit dem Zeitalter wachsend) und werfen 0,15 Felder zurück.',
        { set: { damage: 4, push: 0.15 } },
        { name: 'Bleigewicht', mod: { add: { push: 0.15, damage: 0.4 } },
          text: 'Treffer werfen 0,15 Felder zurück (Bosse halb, höchstens einmal je Sekunde) und beißen mit 0,4 Standardschüssen mehr (ein Strahl je Sekunde). Taktgebern nichts.' }),
    ],
    fusion: {
      // Netzsalve: trifft sofort eine ganze Gruppe im Umkreis 1, Boden wie Luft, und bremst alle 3 s lang. Der Frostpuls bremst
      // alles rund um den Turm schwächer, die Frostkette Gegner entlang des Weges, die Salve eine Traube in der Ferne.
      core: { set: { attack: 'hitscan', damage: 3, cooldown: 2, splash: 1, slowDuration: 3, chain: 0, hitsAir: true }, mul: { range: 1.3 } },
      coreText: 'Wird zur Netzsalve: Alle 2 s spannt sich ein großes Netz über eine ganze Gruppe am Boden oder in der Luft und bremst alle darin 3 s lang.',
      gift: { set: { seek: true }, add: { slowDuration: 1 } },
      giftName: 'Fangleine',
      giftText: 'Der Kern sucht sich zuerst Gegner, die seine Wirkung noch nicht tragen (Brand, Bremsen, Zeichen), und was er bremst, bleibt 1 s länger langsam. Pulsen und Taktgebern bringt das Suchen nichts.',
    },
    tiers: poolTiers('bremser', [
      ['Bolawerfer', 'Bolahagel', 'Bolasturm', 'Drei Steine an drei Riemen: einmal herumgewirbelt, und die Beine des Wolfs haben einen neuen Lieblingsknoten.'],
      ['Retiarius', 'Netzarena', 'Kolosseumsnetz', 'Der Netzkämpfer aus der Arena: Er wirft, er zieht, er verbeugt sich. Die Feuerdiebe klatschen nicht.'],
      ['Netzschleuder', 'Vogelfang', 'Garnhimmel', 'Ein Netz aus Hanf, beschwert mit Bleikugeln, geworfen von einem, der sonst Rebhühner fängt.'],
      ['Kettenkugel', 'Takelschreck', 'Kettenflotte', 'Zwei Halbkugeln an einer Kette: eigentlich für die Takelage gedacht, aber Beine tun es auch.'],
      ['Netzkanone', 'Netzbatterie', 'Stahlgarn', 'Pressluft, Messing und ein gefaltetes Stahlnetz. Klack, fump, festgehalten.'],
      ['Haftnetzwerfer', 'Haftfeld', 'Fesselwolke', 'Ein Netz aus klebrigen Fasern, das sich im Flug entfaltet. Hält Drohnen, Roboter und sehr verwirrte Feuerdiebe.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.kiesel', color: '#B58B5A', arc: 0.4, tumble: true, impact: 'net', sound: 'sling', impactSound: 'wood' },
      { kind: 'model', model: 'shot.kiesel', color: '#C9B48A', arc: 0.5, tumble: true, impact: 'net', sound: 'net', impactSound: 'wood' },
      { kind: 'model', model: 'shot.kiesel', color: '#A89070', arc: 0.5, tumble: true, impact: 'net', sound: 'net', impactSound: 'wood' },
      { kind: 'model', model: 'shot.kiesel', color: '#5A5A5A', arc: 0.2, tumble: true, muzzle: 'smoke', impact: 'net', sound: 'cannon', impactSound: 'metal' },
      { kind: 'model', model: 'shot.kiesel', color: '#B8BCC4', arc: 0.3, tumble: true, muzzle: 'smoke', impact: 'net', sound: 'steam', impactSound: 'metal' },
      { kind: 'model', model: 'shot.klecks', color: '#C9FFF2', arc: 0.3, trail: 'energy', impact: 'net', sound: 'pulse', impactSound: 'splash' },
    ])[age], (age) => ({ kind: 'tracer', color: ['#C9A06A', '#D8C49A', '#B8A07C', '#8A8A8A', '#C4C8CE', '#C9FFF2'][age], muzzle: age >= 3 ? 'smoke' : 'none', impact: 'net',
      sound: /** @type {ShotSound[]} */ (['sling', 'net', 'net', 'cannon', 'steam', 'pulse'])[age], impactSound: age >= 3 ? 'metal' : 'wood' }),
    (age) => ({ slow: NET_SLOW[age] })),
  },

  // ------------------------------------------------------------------------------------------- Bohrer (Platz Panzerknacker)
  {
    id: 'bohrer',
    name: 'Bohrer',
    ...slotFields('knacker'),
    summary: 'Ein Bohrstrahl auf den Stärksten am Boden: ignoriert Rüstung und wird heißer, je länger er bohrt (in 3 s das Dreifache). Kurze Reichweite, keine Flieger.',
    look: { accent: '#B9E2E8', marker: 'crystal' },
    dotKind: 'ember',
    defaultMode: 'strong',
    cost: 110,
    // Dauerstrahl: 10 Schaden je Sekunde, der auf demselben Ziel in 3 s auf 30 anschwillt (Panzerknacker: 12 je Sekunde in harten
    // Stößen), aber nur 2,4 Felder weit und nie in die Luft. Ein Zielwechsel kühlt ihn ab: stark gegen Bosse und Zähe, schwach
    // gegen Schwärme.
    stats: { ...NO_STATS, attack: 'beam', damage: 10, cooldown: 0.2, range: 2.4, pierce: 1, ramp: 2, rampTime: 3 },
    levels: [{}, {}, {}],
    branches: [
      branch('Diamantkrone', 'damage', 'Heizt länger auf und wird viel heißer: nach 4,5 s das 4,5-Fache statt nach 3 s das Dreifache. Für Bosse.',
        { set: { ramp: 3.5, rampTime: 4.5 } },
        { name: 'Bohrkrone', mod: { add: { pierce: 0.3, ramp: 0.5 }, mul: { damage: 1.1 } },
          text: 'Treffer ignorieren 30 Prozentpunkte mehr Rüstung und treffen 10 % härter; ein aufheizender Strahl wird um das 0,5-Fache heißer. Taktgebern nichts.' }),
      branch('Splitterbohrer', 'chain', 'Splitter springen mit jedem Takt auf zwei Gegner daneben über (70 % und 49 %); dafür 15 % schwächer.',
        { set: { chain: 2, chainRange: 1 }, mul: { damage: 0.85 } },
        { name: 'Hitzestau', mod: { mul: { rampTime: 0.6 }, add: { dot: 0.4, dotDuration: 2 } },
          text: 'Treffer glimmen 2 s nach (0,4 Standardschüsse je Sekunde, ohne Rüstung); ein aufheizender Strahl braucht 40 % weniger Zeit. Taktgebern nichts.' }),
    ],
    fusion: {
      // Presslufthammer: derselbe Bohrstrahl, anderthalbmal so weit, noch heißer (0,5 mehr), und er drückt sein Ziel jede
      // Sekunde 0,35 Felder zurück (Bosse halb). Der einzige Strahl, der Gegner zurückhält.
      core: { set: { push: 0.35 }, mul: { range: 1.5 }, add: { ramp: 0.5 } },
      coreText: 'Wird zum Presslufthammer: bohrt anderthalbmal so weit, heizt noch höher auf und drückt sein Ziel jede Sekunde 0,35 Felder zurück (Bosse halb).',
      gift: { add: { pierce: 0.3, ramp: 0.5 }, mul: { damage: 1.1 } },
      giftName: 'Bohrkrone',
      giftText: 'Treffer ignorieren 30 Prozentpunkte mehr Rüstung und treffen 10 % härter; ein aufheizender Strahl wird um das 0,5-Fache heißer. Taktgebern nichts.',
    },
    tiers: poolTiers('knacker', [
      ['Steinbohrer', 'Felsbohrer', 'Erdkernbohrer', 'Ein Bogen, eine Spindel, ein Stück Feuerstein und unendlich viel Geduld. Auch Mammutleder gibt irgendwann nach.'],
      ['Terebra', 'Legionsbohrer', 'Jupiters Bohrer', 'Der Bohrwidder der Legion: ein eisenbeschlagener Balken, der sich langsam durch jede Mauer dreht.'],
      ['Bohrwidder', 'Turmbohrer', 'Burgbohrer', 'Unter einem Schutzdach kurbeln zwei Mann den Bohrer. Er hat Zeit, und er kommt durch.'],
      ['Kanonenbohrer', 'Seebohrer', 'Mahlstrom', 'Die Maschine, die sonst Kanonenrohre ausbohrt, dreht sich jetzt nach außen. Späne fliegen, Rüstungen auch.'],
      ['Dampfbohrer', 'Presslufthammer', 'Tunnelbohrer', 'Ein Dampfkessel treibt den Bohrkopf, und der Bohrkopf treibt alles andere vor sich her.'],
      ['Schneidlaser', 'Plasmabohrer', 'Kernbohrer', 'Ein heller Punkt, ein feiner Rauchfaden und ein sehr ordentliches Loch.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'tracer', color: '#C9B08A', impact: 'dust', sound: 'none', impactSound: 'wood' },
      { kind: 'tracer', color: '#D9D2C2', impact: 'spark', sound: 'none', impactSound: 'metal' },
      { kind: 'tracer', color: '#E0D8C8', impact: 'spark', sound: 'none', impactSound: 'metal' },
      { kind: 'tracer', color: '#E9DCFF', impact: 'spark', sound: 'none', impactSound: 'metal' },
      { kind: 'beam', color: '#FFD9A0', muzzle: 'spark', impact: 'spark', sound: 'steam', impactSound: 'metal' },
      { kind: 'beam', color: '#B9E2E8', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' },
    ])[age], (age) => ({ kind: 'beam', color: ['#E8C890', '#F0D6A0', '#E9DCC8', '#E9DCFF', '#FFD9A0', '#C9F2FF'][age], muzzle: age === 5 ? 'energy' : 'spark', impact: 'spark',
      sound: /** @type {ShotSound[]} */ (['none', 'none', 'none', 'none', 'steam', 'plasma'])[age], impactSound: age >= 4 ? 'metal' : 'stone' })),
  },

  // ------------------------------------------------------------------------------------------- Spalter (Platz Panzerknacker)
  {
    id: 'spalter',
    name: 'Spalter',
    ...slotFields('knacker'),
    summary: 'Schnelle, leichte Treffer ohne Rüstung, die zeichnen: Getroffene nehmen 3 s lang 30 % mehr Schaden von allen Türmen. Sucht Ungezeichnete, trifft auch Flieger.',
    look: { accent: '#E05A7A', marker: 'spikes' },
    defaultMode: 'strong',
    cost: 90,
    // Eine Mannschaftswaffe: selbst nur 6 Schaden je Sekunde (ohne Rüstung), aber jeder Getroffene nimmt 3 s lang 30 % mehr von
    // allem, auch von Brand. Zielt wie der Panzerknacker auf den Stärksten, wechselt aber zum nächsten, solange der noch gezeichnet ist.
    stats: { ...NO_STATS, attack: 'projectile', damage: 6, cooldown: 1, range: 3.6, projectileSpeed: 12, pierce: 1, mark: 0.3, markDuration: 3, hitsAir: true, seek: true },
    levels: [{}, {}, {}],
    branches: [
      branch('Tiefe Kerbe', 'damage', 'Das Zeichen sitzt tiefer: Gezeichnete nehmen 45 statt 30 % mehr Schaden.',
        { set: { mark: 0.45 } },
        { name: 'Kerbe', mod: { add: { mark: 0.15, markDuration: 2 } },
          text: 'Treffer zeichnen: 2 s lang 15 % mehr Schaden von allem (ein Kern, der schon zeichnet, zeichnet 15 Punkte stärker und 2 s länger). Taktgebern nichts.' }),
      branch('Streukerben', 'chain', 'Jeder Treffer springt auf zwei Gegner daneben über und zeichnet auch sie; dafür 20 % weniger Wucht.',
        { set: { chain: 2, chainRange: 1.2 }, mul: { damage: 0.8 } },
        { name: 'Spürnase', mod: { set: { seek: true }, add: { mark: 0.08, markDuration: 2 }, mul: { range: 1.1 } },
          text: '10 % mehr Reichweite; Treffer zeichnen leicht (8 % mehr Schaden, 2 s), und der Kern nimmt zuerst Gegner, die seine Wirkung noch nicht tragen. Taktgebern nur die Reichweite.' }),
    ],
    fusion: {
      // Zeichengranate: trifft sofort eine ganze Gruppe im Umkreis 1,1 mit 2,2-facher Wucht, Boden wie Luft, und zeichnet alle
      // 4 s lang mit 35 %. Bester Bot (zwei Panzerknacker-Kerne): Wucht x1,4 26 von 60 (13 Niederlagen bei Flint), x3 41.
      core: { set: { attack: 'hitscan', splash: 1.1, chain: 0, cooldown: 1.6, mark: 0.35, markDuration: 4 }, mul: { damage: 2.2 } },
      coreText: 'Wird zur Zeichengranate: Alle 1,6 s zeichnet sie eine ganze Gruppe am Boden oder in der Luft: 4 s lang 35 % mehr Schaden von allem.',
      gift: { add: { mark: 0.15, markDuration: 2 } },
      giftName: 'Kerbe',
      giftText: 'Treffer zeichnen: 2 s lang 15 % mehr Schaden von allem (ein Kern, der schon zeichnet, zeichnet 15 Punkte stärker und 2 s länger). Taktgebern nichts.',
    },
    tiers: poolTiers('knacker', [
      ['Fährtenleser', 'Jagdzeichen', 'Ahnenzeichen', 'Er kennt jede Stelle, an der das Fell dünn ist, und ritzt sie mit einem Wurfpfeil an. Die anderen zielen dann dorthin.'],
      ['Pilumwerfer', 'Pilumhagel', 'Legionszeichen', 'Das Pilum verbiegt sich im Schild und hängt dann nutzlos daran. Der Schild auch.'],
      ['Panzerstecher', 'Kerbenhagel', 'Wappenbrecher', 'Ein schmaler, harter Stecher für die Fugen zwischen den Platten. Wer weiß, wo die Fuge ist, braucht keine Kraft.'],
      ['Spähbüchse', 'Zielflagge', 'Flaggensignal', 'Ein Späher mit langer Büchse und Kreide: Wen er trifft, der trägt ein Kreuz, und alle wissen, wohin.'],
      ['Leuchtspurgewehr', 'Spurbatterie', 'Spurgewitter', 'Die Kugel zieht eine rote Spur und hinterlässt einen roten Fleck. Die schweren Geschütze freuen sich.'],
      ['Laserzielgerät', 'Zielsatellit', 'Zielnetz', 'Ein roter Punkt, der nicht mehr weggeht. Jede Waffe in der Nähe weiß jetzt genau, wohin.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.pfeil', color: '#E05A7A', arc: 0.2, impact: 'spark', sound: 'throw', impactSound: 'arrow' },
      { kind: 'model', model: 'shot.speer', color: '#C9CED6', arc: 0.25, impact: 'spark', sound: 'throw', impactSound: 'metal' },
      { kind: 'model', model: 'shot.bolzen', color: '#E05A7A', arc: 0, impact: 'spark', sound: 'crossbow', impactSound: 'metal' },
      { kind: 'tracer', color: '#FF8AA0', muzzle: 'smoke', impact: 'spark', sound: 'rifle', impactSound: 'metal' },
      { kind: 'tracer', color: '#FF5A6A', muzzle: 'flash', impact: 'spark', sound: 'rifle', impactSound: 'metal' },
      { kind: 'beam', color: '#FF4A6A', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' },
    ])[age], (age) => ({ kind: 'bolt', color: ['#E87A8A', '#E0A0A8', '#E05A7A', '#FF8AA0', '#FF5A6A', '#FF4A6A'][age], muzzle: 'spark', impact: 'spark',
      sound: /** @type {ShotSound[]} */ (['throw', 'throw', 'crossbow', 'rifle', 'rifle', 'laser'])[age], impactSound: 'zap' }),
    (age) => (age >= 3 ? HITSCAN : undefined)),
  },

  // ------------------------------------------------------------------------------------------- Brandpfeil (Platz Brenner)
  {
    id: 'brandpfeil',
    name: 'Brandpfeil',
    ...slotFields('brenner'),
    summary: 'Schießt brennende Pfeile weit (3,5 Felder), auch auf Flieger: Brand 12 je Sekunde für 4 s, ohne Rüstung. Sucht sich Gegner, die noch nicht brennen.',
    look: { accent: '#FFB04A', marker: 'pennant' },
    dotKind: 'fire',
    cost: 90,
    // Einzelziel statt Flammenstoß: Der Brenner steckt Gruppen am Boden an, der Brandpfeil zündet einen nach dem anderen, weit weg
    // und in der Luft. Brand stapelt sich nicht; `seek` verteilt ihn deshalb auf Gegner, die noch nicht brennen.
    stats: { ...NO_STATS, attack: 'projectile', damage: 4, cooldown: 1.6, range: 3.5, projectileSpeed: 9, dot: 12, dotDuration: 4, hitsAir: true, seek: true },
    levels: [{}, {}, {}],
    branches: [
      branch('Pechpfeile', 'flame', 'Pech hält das Feuer: Der Brand ist 15 % heißer und hält 7 statt 4 s.',
        { set: { dotDuration: 7 }, mul: { dot: 1.15 } },
        { name: 'Zunderschwamm', mod: { mul: { dotDuration: 1.6 }, add: { dot: 0.3, dotDuration: 1.5 } },
          text: 'Brand wird 0,3 Standardschüsse je Sekunde heißer und hält 60 % länger (ohne eigenen Brand glimmen Treffer 1,5 s). Taktgebern nichts.' }),
      branch('Feuerregen', 'splash', 'Der Pfeil zerplatzt in Funken und setzt alle im Umkreis 0,6 in Brand, kommt aber ein Fünftel seltener.',
        { set: { splash: 0.6 }, mul: { cooldown: 1.2 } },
        { name: 'Funkenflug', mod: { add: { dot: 0.6, dotDuration: 2 }, mul: { splash: 1.1 } },
          text: 'Treffer brennen 0,6 Standardschüsse je Sekunde heißer und 2 s länger (ohne eigenen Brand: 2 s lang); Einschläge mit Fläche 10 % größer. Taktgebern nichts.' }),
    ],
    fusion: {
      // Feuerkette: Das Feuer springt sofort auf bis zu vier weitere Gegner (bis 1,6 Felder je Sprung), Boden wie Luft; jeder
      // Getroffene brennt voll (der Sprung schwächt nur den Treffer, nicht den Brand).
      core: { set: { attack: 'hitscan', chain: 4, chainRange: 1.6, cooldown: 1.2, splash: 0 }, mul: { dot: 1.2 } },
      coreText: 'Wird zur Feuerkette: Das Feuer springt sofort von Gegner zu Gegner, bis zu vier weitere, Boden wie Luft, und jeder brennt voll.',
      gift: { mul: { dotDuration: 1.6 }, add: { dot: 0.3, dotDuration: 1.5 } },
      giftName: 'Zunderschwamm',
      giftText: 'Brand wird 0,3 Standardschüsse je Sekunde heißer und hält 60 % länger (ohne eigenen Brand glimmen Treffer 1,5 s). Taktgebern nichts.',
    },
    tiers: poolTiers('brenner', [
      ['Glutspeerwerfer', 'Funkenkette', 'Steppenbrand', 'Eine Speerspitze, in Harz getaucht und im Lagerfeuer entzündet. Sie fliegt etwas kürzer, aber sie fliegt brennend.'],
      ['Falarica', 'Brandkette', 'Roms Fackelzug', 'Ein Wurfspeer mit Werg und Pech am Eisen: Selbst Schilde mögen ihn nicht festhalten.'],
      ['Brandpfeilschütze', 'Funkenflug', 'Feuerkrone', 'Pfeile mit Pechbausch, über der Kohlenpfanne entzündet. Der Bogenschütze riecht nach Rauch und ist stolz darauf.'],
      ['Brandbüchse', 'Feuerkette', 'Flammenbrücke', 'Die Kugel steckt in brennenden Lumpen. Was sie trifft, raucht noch lange.'],
      ['Phosphorbüchse', 'Phosphorkette', 'Phosphorgewitter', 'Weißer Phosphor in einer Messinghülse: Er brennt hell, lange und ohne zu fragen.'],
      ['Plasmapfeil', 'Plasmakette', 'Sonnenkette', 'Ein Pfeil aus heißem Licht. Er zielt selbst nach und brennt noch, wenn er längst verloschen ist.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.speer', color: '#C8642A', arc: 0.3, trail: 'fire', impact: 'fire', sound: 'throw', impactSound: 'fire' },
      { kind: 'model', model: 'shot.speer', color: '#D2702A', arc: 0.25, trail: 'fire', impact: 'fire', sound: 'throw', impactSound: 'fire' },
      { kind: 'model', model: 'shot.pfeil', color: '#FF9A3C', arc: 0.2, trail: 'fire', impact: 'fire', sound: 'bow', impactSound: 'fire' },
      { kind: 'tracer', color: '#FFB04A', muzzle: 'smoke', trail: 'fire', impact: 'fire', sound: 'musket', impactSound: 'fire' },
      { kind: 'tracer', color: '#FFF0C0', muzzle: 'flash', trail: 'smoke', impact: 'fire', sound: 'rifle', impactSound: 'fire' },
      { kind: 'tracer', color: '#FF7AB0', muzzle: 'energy', trail: 'energy', impact: 'fire', sound: 'plasma', impactSound: 'fire' },
    ])[age], (age) => ({ kind: 'bolt', color: ['#FF9A3C', '#FF8A2A', '#FFB04A', '#FFCF5A', '#FFF0C0', '#FF7AB0'][age], muzzle: age === 5 ? 'energy' : 'spark', trail: 'fire', impact: 'fire',
      sound: /** @type {ShotSound[]} */ (['flame', 'flame', 'flame', 'musket', 'rifle', 'plasma'])[age], impactSound: 'fire' }),
    (age) => (age >= 3 ? HITSCAN : undefined)),
  },

  // ------------------------------------------------------------------------------------------- Glutgrube (Platz Brenner)
  {
    id: 'glutgrube',
    name: 'Glutgrube',
    ...slotFields('brenner'),
    summary: 'Wirft Glut auf den Weg: Das Feld brennt 5 s lang, und wer hindurchläuft, brennt (11 je Sekunde, ohne Rüstung). Wirft dorthin, wo noch nichts glüht. Nur am Boden.',
    look: { accent: '#FF6A2A', marker: 'orb' },
    dotKind: 'ember',
    cost: 95,
    // Eine Falle statt einer Flamme: Brandfelder (Radius 0,9, 5 s) auf dem Weg, 2,8 Felder weit. Wer darin steht, brennt
    // 11 je Sekunde und noch 1 s danach. Stark gegen lange Kolonnen am Boden, wirkungslos gegen Flieger.
    stats: { ...NO_STATS, attack: 'projectile', damage: 3, cooldown: 3.2, range: 2.8, projectileSpeed: 5, splash: 0.9, zone: 5, dot: 11, dotDuration: 1 },
    levels: [{}, {}, {}],
    branches: [
      branch('Breite Grube', 'splash', 'Die Glutfelder werden größer (Radius 1,2 statt 0,9) und glühen 6 statt 5 s.',
        { set: { splash: 1.2, zone: 6 } },
        { name: 'Glutbett', mod: { mul: { zone: 1.5 }, add: { dot: 1.2, dotDuration: 2 } },
          text: 'Pfützen und Brandfelder bleiben 50 % länger; Treffer brennen 1,2 Standardschüsse je Sekunde heißer und 2 s länger. Taktgebern nichts.' }),
      branch('Schwelbrand', 'flame', 'Wer durchs Feld läuft, brennt danach noch 4 s weiter, und 20 % heißer.',
        { set: { dotDuration: 4 }, mul: { dot: 1.2 } },
        { name: 'Nachglut', mod: { mul: { dot: 1.1 }, add: { dot: 0.2, dotDuration: 3 } },
          text: 'Brand hält 3 s länger und ist 10 % heißer, dazu 0,2 Standardschüsse je Sekunde (so glimmt auch ein Kern ohne Brand). Taktgebern nichts.' }),
    ],
    fusion: {
      // Glutmal: wirft sofort, weiter, größere Felder (4 s), und wer vom Wurf getroffen wird, ist 3 s gezeichnet (20 % mehr Schaden).
      core: { set: { attack: 'hitscan', splash: 1.2, zone: 4, cooldown: 2, mark: 0.2, markDuration: 3 }, mul: { dot: 1.2, range: 1.2 } },
      coreText: 'Wird zum Glutmal: schleudert sofort Glut weit auf den Weg; das Feld brennt 4 s, und wer getroffen wird, ist 3 s gezeichnet (20 % mehr Schaden von allem).',
      gift: { mul: { zone: 1.5 }, add: { dot: 1.2, dotDuration: 2 } },
      giftName: 'Glutbett',
      giftText: 'Pfützen und Brandfelder bleiben 50 % länger; Treffer brennen 1,2 Standardschüsse je Sekunde heißer und 2 s länger. Taktgebern nichts.',
    },
    tiers: poolTiers('brenner', [
      ['Glutgrube', 'Glutmal', 'Feuerschlund', 'Ein Korb voll glühender Kohlen, geschwungen und ausgekippt. Wer drüberläuft, hüpft.'],
      ['Brandtopfwerfer', 'Vestas Mal', 'Vestas Glut', 'Tontöpfe voll glühender Kohlen und Pech: Sie zerspringen auf dem Pflaster, und das Pflaster wird warm.'],
      ['Glutkessel', 'Schmiedemal', 'Zunftesse', 'Der Schmied leert seinen Kessel auf die Straße. Barfuß geht danach keiner mehr.'],
      ['Brandfass', 'Pulvermal', 'Brandküste', 'Ein Fass Teer, eine Handvoll Pulver, eine Lunte. Was danach auf dem Weg liegt, brennt eine Weile.'],
      ['Kohlenschleuder', 'Schlackenmal', 'Hochofenschlund', 'Eine dampfgetriebene Schaufel wirft glühende Kohle aus dem Kessel. Der Heizer winkt dazu.'],
      ['Thermitwerfer', 'Thermitmal', 'Thermitsee', 'Eine Kartusche Thermit, die auf dem Weg weiß aufglüht. Sieht aus wie ein Stern, fühlt sich nicht so an.'],
    ], (age) => /** @type {ShotVisual[]} */ ([
      { kind: 'model', model: 'shot.felsbrocken', color: '#FF7A2A', arc: 1.3, tumble: true, trail: 'fire', impact: 'fire', sound: 'throw', impactSound: 'fire' },
      { kind: 'model', model: 'shot.tontopf', color: '#C9773F', arc: 1.3, tumble: true, trail: 'fire', impact: 'fire', sound: 'catapult', impactSound: 'glass' },
      { kind: 'model', model: 'shot.klecks', color: '#FF6A2A', arc: 1.2, trail: 'fire', impact: 'fire', sound: 'throw', impactSound: 'fire' },
      { kind: 'model', model: 'shot.tontopf', color: '#5A3A2A', arc: 1.4, tumble: true, trail: 'spark', impact: 'fire', sound: 'mortar', impactSound: 'fire' },
      { kind: 'model', model: 'shot.felsbrocken', color: '#3A3030', arc: 1.1, tumble: true, trail: 'fire', impact: 'fire', sound: 'steam', impactSound: 'fire' },
      { kind: 'model', model: 'shot.klecks', color: '#FFF4D0', arc: 0.9, trail: 'energy', impact: 'fire', sound: 'plasma', impactSound: 'fire' },
    ])[age], (age) => ({ kind: 'flame', color: ['#FF7A2A', '#FF8A3A', '#FF6A2A', '#FF9A3C', '#FF8C2E', '#FFF4D0'][age], trail: 'fire', impact: 'fire',
      sound: /** @type {ShotSound[]} */ (['flame', 'flame', 'flame', 'flame', 'steam', 'plasma'])[age], impactSound: 'fire' })),
  },

  // ------------------------------------------------------------------------------------------- Leuchtfeuer (Platz Taktgeber)
  {
    id: 'leuchtfeuer',
    name: 'Leuchtfeuer',
    ...slotFields('taktgeber'),
    summary: 'Greift nicht an, macht aber verwundbar: Alle 1,5 s leuchtet es auf, und jeder Gegner im Licht (auch Flieger) nimmt 2 s lang 15 % mehr Schaden von allen Türmen.',
    look: { accent: '#FFE9A8', marker: 'orb' },
    defaultMode: 'strong',
    cost: 110,
    // Unterstützt über die Gegner statt über die Nachbarn: ein Lichtpuls (2,2 Felder) ohne Schaden, der zeichnet. Das Zeichen
    // wächst mit dem Zeitalter (15 % bis 25 %) und der Stufe (+5 / +10 Punkte). Wer im Licht steht, gilt als getroffen: Sein
    // Schild lädt nicht, er heilt sich nicht selbst. Der Taktgeber gehört zwischen die Türme, das Leuchtfeuer an den Weg.
    stats: { ...NO_STATS, attack: 'pulse', damage: 0, cooldown: 1.5, range: 2.2, mark: LIGHT_MARK[0], markDuration: 2, hitsAir: true },
    levels: [{}, { mark: LIGHT_MARK[0] + 0.05 }, { mark: LIGHT_MARK[0] + 0.1 }],
    branches: [
      branch('Signalfeuer', 'range', 'Das Licht reicht 40 % weiter und zeichnet einen viel längeren Wegabschnitt.',
        { mul: { range: 1.4 } },
        { name: 'Lichtkranz', mod: { mul: { range: 1.12, auraRange: 1.25 }, add: { markDuration: 1 } },
          text: '12 % mehr Reichweite für jeden Kern; ein Kern, der zeichnet, zeichnet 1 s länger, ein Taktgeber-Kern lässt seine Nachbarn ein Viertel weiter reichen.' }),
      branch('Blendfeuer', 'slow', 'Grelles Licht: Wer im Lichtkreis steht, ist zusätzlich 20 % langsamer (Bosse halb).',
        { set: { slow: 0.2, slowDuration: 1 } },
        { name: 'Blendung', mod: { add: { slow: 0.1, slowDuration: 1, mark: 0.08, markDuration: 1.5 } },
          text: 'Treffer blenden: 1 s lang 10 Punkte langsamer und 1,5 s lang 8 % mehr Schaden von allem (wo der Kern schon bremst oder zeichnet, stärker und länger). Taktgebern nichts.' }),
    ],
    fusion: {
      // Suchscheinwerfer: Ein Strahl hält den Stärksten (Boden oder Luft), zeichnet ihn 15 Punkte stärker als der Lichtkreis und
      // brennt ein wenig (4 je Sekunde vor der Skalierung). Der Lichtkreis entfällt: eine Waffe gegen Bosse.
      core: { set: { attack: 'beam', damage: 4, cooldown: 0.2, ramp: 0, rampTime: 0, markDuration: 1.5, hitsAir: true }, mul: { range: 1.6 }, add: { mark: 0.15 } },
      coreText: 'Wird zum Suchscheinwerfer: Ein Lichtstrahl hält den stärksten Gegner fest, auch Flieger, zeichnet ihn 15 Punkte stärker und brennt ein wenig. Kein Lichtkreis mehr.',
      gift: { mul: { range: 1.12, auraRange: 1.25 }, add: { markDuration: 1 } },
      giftName: 'Lichtkranz',
      giftText: '12 % mehr Reichweite für jeden Kern; ein Kern, der zeichnet, zeichnet 1 s länger, ein Taktgeber-Kern lässt seine Nachbarn ein Viertel weiter reichen.',
    },
    tiers: poolTiers('taktgeber', [
      ['Feuerkorb', 'Sonnenblick', 'Sonnenauge', 'Ein Korb voll brennendem Kienholz auf einem Pfahl. Im Licht sieht jeder Jäger, wohin er werfen muss.'],
      ['Pharos', 'Sonnenspiegel', 'Sol Invictus', 'Ein kleiner Bruder des Leuchtturms von Alexandria. Was er anstrahlt, steht wie auf einer Bühne.'],
      ['Wachfeuer', 'Turmlicht', 'Himmelsfackel', 'Auf dem Turm brennt das Wachfeuer die ganze Nacht. Von hier oben sieht man jede Lücke in jeder Rüstung.'],
      ['Leuchtturm', 'Linsenlicht', 'Feuerschiff', 'Öl, Docht und eine geschliffene Linse: Das Licht reicht weit übers Wasser und über den Weg.'],
      ['Bogenlampe', 'Suchscheinwerfer', 'Lichtbatterie', 'Zwei Kohlestäbe, ein knisternder Lichtbogen, ein Spiegel. Taghell, mitten in der Nacht.'],
      ['Lichtmast', 'Lichtfinger', 'Lichtdom', 'Ein Mast mit hundert kleinen Lichtern, die alle dasselbe Ziel anleuchten. Es fühlt sich sehr beobachtet.'],
    ], (age) => ({ kind: 'pulse', color: ['#FFD27A', '#FFE2A0', '#FFC870', '#FFF0C0', '#F4F8FF', '#E8F4FF'][age], impact: 'none',
      sound: /** @type {ShotSound[]} */ (['chime', 'chime', 'bell', 'chime', 'tesla', 'pulse'])[age] }),
    (age) => ({ kind: 'beam', color: ['#FFD27A', '#FFE2A0', '#FFC870', '#FFF0C0', '#F4F8FF', '#E8F4FF'][age], muzzle: 'energy', impact: 'spark',
      sound: /** @type {ShotSound[]} */ (['chime', 'chime', 'bell', 'chime', 'tesla', 'laser'])[age], impactSound: 'energy' }),
    (age) => ({ mark: LIGHT_MARK[age] })),
  },

  // ------------------------------------------------------------------------------------------- Zahlmeister (Platz Taktgeber)
  {
    id: 'zahlmeister',
    name: 'Zahlmeister',
    ...slotFields('taktgeber'),
    summary: 'Greift nicht an, zahlt aber: Gegner, die bis 2 Felder um ihn sterben, bringen 50 % mehr Kopfgeld. Lohnt sich nur, wo viel stirbt, und erst mit der Zeit.',
    look: { accent: '#E8C547', marker: 'ring' },
    defaultMode: 'weak',
    cost: 100,
    // Die Wirtschaft als Unterstützung: kein Takt, keine Wucht, aber Kopfgeld-Aura 50 % (Stufe 2: 65 %, Stufe 3: 80 %) im Umkreis
    // 2 Felder um ihn. Gehört an die Stelle, an der die meisten Gegner sterben. Es zählt der stärkste Zahlmeister.
    stats: { ...NO_STATS, attack: 'none', range: 2, hitsGround: false, auraBounty: 0.5 },
    levels: [{}, { auraBounty: 0.65 }, { auraBounty: 0.8 }],
    branches: [
      branch('Kriegskasse', 'range', 'Die Kasse reicht 40 % weiter: Ein viel längeres Stück Weg zahlt den Aufschlag.',
        { mul: { range: 1.4 } },
        { name: 'Beutegeld', mod: { add: { auraBounty: 0.25 } },
          text: 'Wer in Reichweite des Kerns stirbt, bringt 25 % mehr Kopfgeld (gilt für jeden Kern; ein Zahlmeister-Kern zahlt 25 Punkte mehr). Mehrere Kassen addieren sich nicht.' }),
      branch('Sold', 'rate', 'Bezahlte Truppen: Türme in Reichweite feuern 15 % schneller, dafür halbiert sich der Aufschlag.',
        { set: { auraRate: 0.15 }, mul: { auraBounty: 0.5 } },
        { name: 'Handgeld', mod: { mul: { cooldown: 0.9, auraRate: 1.1 }, add: { auraBounty: 0.1 } },
          text: '10 % kürzere Pausen bei Schüssen, Würfen und Pulsen, ein Taktgeber-Kern gibt 10 % mehr Takt; wer in Reichweite stirbt, bringt 10 % mehr Kopfgeld.' }),
    ],
    fusion: {
      // Schatzkammer: Aufschlag 30 Punkte höher, 40 % weiter (mit der Superwaffen-Reichweite fast 3 Felder), dazu 10 % Wucht für
      // alle Türme darin.
      core: { mul: { range: 1.4 }, add: { auraBounty: 0.3, auraDamage: 0.1 } },
      coreText: 'Wird zur Schatzkammer: Der Aufschlag steigt um 30 Punkte und reicht 40 % weiter, und Türme in Reichweite treffen 10 % härter. Schuss-Gaben bringen ihr nichts.',
      gift: { add: { auraBounty: 0.25 } },
      giftName: 'Beutegeld',
      giftText: 'Wer in Reichweite des Kerns stirbt, bringt 25 % mehr Kopfgeld (gilt für jeden Kern; ein Zahlmeister-Kern zahlt 25 Punkte mehr). Mehrere Kassen addieren sich nicht.',
    },
    tiers: poolTiers('taktgeber', [
      ['Sammler', 'Beutehöhle', 'Schatzhöhle', 'Er sammelt, was die Feuerdiebe fallen lassen: Muscheln, Bernstein, schöne Steine. Das meiste davon ist tatsächlich wertvoll.'],
      ['Quästor', 'Aerarium', 'Saturntempel', 'Der Quästor zählt jede Münze zweimal. Den Sold der Legion zahlt er pünktlich, das Kopfgeld auch.'],
      ['Zöllner', 'Zollburg', 'Kaufmannsgilde', 'Wer hier vorbeikommt, zahlt Zoll, auch wenn er es nicht mehr selbst tun kann.'],
      ['Kontor', 'Handelskompanie', 'Schatzflotte', 'Ein Schreibpult, ein Kassenbuch, eine Waage: Für jede Beute gibt es hier den besten Kurs.'],
      ['Bankhaus', 'Börse', 'Zentralbank', 'Messinggitter, Rechenmaschine und ein Herr mit Ärmelschonern, der bei jedem Treffer leise mitzählt.'],
      ['Zahlstation', 'Goldserver', 'Weltbörse', 'Bucht jede Beute in Echtzeit und schreibt die Zinsen gleich dazu. Bitte nicht nach dem Passwort fragen.'],
    ], (age) => ({ kind: 'pulse', color: ['#E8C547', '#F2D060', '#E8C547', '#F4D46A', '#E0C060', '#F0E080'][age], impact: 'none',
      sound: /** @type {ShotSound[]} */ (['chime', 'chime', 'bell', 'chime', 'chime', 'pulse'])[age] }),
    (age) => ({ kind: 'pulse', color: ['#FFE27A', '#FFE890', '#FFE27A', '#FFEC9A', '#FFE27A', '#FFF4B0'][age], impact: 'none',
      sound: /** @type {ShotSound[]} */ (['bell', 'bell', 'bell', 'bell', 'chime', 'pulse'])[age] })),
  },
];

// ------------------------------------------------------------------------------------------- Waffengebundene Rezepte
// Rezepte bei einer Waffe des Pools (docs/SIM.md, „Waffenpool“): Es gibt sie nur in Partien, deren Bewaffnung diese Waffe (und jede
// Zutat, die eine Waffe statt eines Platzes nennt) gezogen hat; nur dann kommen sie als Bauplan oder als Belohnung eines
// Zwischenbosses. Alle gesperrt, wie die übrigen sieben. Ein waffengebundenes Rezept geht einem gewöhnlichen mit denselben Zutaten
// vor (der Kopfgeldjäger dem Kommandoposten). Werte wie dort: `set` vor der Skalierung, `mul`/`add` danach.

/** @type {RecipeData[]} */
const POOL_RECIPES = [
  {
    // Kopfgeldjäger: Der Zahlmeister schießt selbst, am liebsten auf die Schwächsten (Zielwahl der Waffe: schwach), Boden wie
    // Luft, und zahlt für alles, was in seiner Reichweite stirbt, noch mehr.
    core: 'zahlmeister',
    recipe: {
      id: 'kopfgeld',
      name: 'Kopfgeldjäger',
      gifts: ['schuetze', 'schuetze'],
      locked: true,
      ages: [1, 2],
      core: { set: { attack: 'hitscan', damage: 6, cooldown: 0.6, hitsAir: true, hitsGround: true }, mul: { range: 1.3 }, add: { auraBounty: 0.3 } },
      coreText: 'Wird zum Kopfgeldjäger: schießt selbst auf die Schwächsten in Reichweite, Boden und Luft, und wer dort stirbt, bringt 30 Punkte mehr Kopfgeld.',
    },
    looks: [
      ['Beutejäger', 'Jagdgemeinschaft', { kind: 'model', model: 'shot.kiesel', color: '#E8C547', arc: 0.2, impact: 'dust', sound: 'sling', impactSound: 'stone' }],
      ['Prämienschütze', 'Kaisersold', { kind: 'model', model: 'shot.pfeil', color: '#E8C547', arc: 0.05, impact: 'dust', sound: 'bow', impactSound: 'arrow' }],
      ['Söldnerhauptmann', 'Söldnerkompanie', { kind: 'model', model: 'shot.bolzen', color: '#E8C547', arc: 0, impact: 'spark', sound: 'crossbow', impactSound: 'arrow' }],
      ['Kaperbrief', 'Freibeuterflotte', { kind: 'tracer', color: '#F4D46A', muzzle: 'smoke', impact: 'spark', sound: 'musket', impactSound: 'thud' }],
      ['Kopfgeldbüro', 'Prämienkontor', { kind: 'tracer', color: '#F4D46A', muzzle: 'flash', impact: 'spark', sound: 'rifle', impactSound: 'thud' }],
      ['Prämiendrohne', 'Prämienschwarm', { kind: 'tracer', color: '#F0E080', muzzle: 'energy', impact: 'energy', sound: 'laser', impactSound: 'energy' }],
    ],
  },
  {
    // Sonnenlanze: Das Leuchtfeuer bündelt sein Licht zu einem seltenen, schweren Schuss auf den Stärksten (Boden oder Luft), der
    // Rüstung ignoriert und das Ziel tief zeichnet. Der Suchscheinwerfer hält ein Ziel dauernd, die Lanze schlägt zu.
    core: 'leuchtfeuer',
    recipe: {
      id: 'sonnenlanze',
      name: 'Sonnenlanze',
      gifts: ['knacker', 'knacker'],
      locked: true,
      ages: [2, 3],
      core: { set: { attack: 'hitscan', damage: 30, cooldown: 3, pierce: 1, mark: 0.4, markDuration: 3, hitsAir: true, hitsGround: true, slow: 0 }, mul: { range: 1.8 } },
      coreText: 'Wird zur Sonnenlanze: alle 3 s ein gebündelter Lichtschuss auf den Stärksten, Boden oder Luft, ohne Rüstung; das Ziel nimmt 3 s lang 40 % mehr Schaden.',
    },
    looks: [
      ['Sonnenspeer', 'Mittagssonne', { kind: 'beam', color: '#FFD27A', muzzle: 'energy', impact: 'spark', sound: 'chime', impactSound: 'energy' }],
      ['Apollons Pfeil', 'Apollons Köcher', { kind: 'beam', color: '#FFE2A0', muzzle: 'energy', impact: 'spark', sound: 'chime', impactSound: 'energy' }],
      ['Rosenstrahl', 'Rosettenlicht', { kind: 'beam', color: '#FFC870', muzzle: 'energy', impact: 'spark', sound: 'bell', impactSound: 'energy' }],
      ['Leuchtkanone', 'Leuchtbatterie', { kind: 'beam', color: '#FFF0C0', muzzle: 'flash', impact: 'spark', sound: 'cannon', impactSound: 'energy' }],
      ['Magnesiumlanze', 'Magnesiumfeuer', { kind: 'beam', color: '#F4F8FF', muzzle: 'spark', impact: 'energy', sound: 'tesla', impactSound: 'zap' }],
      ['Sonnenlanze', 'Sonnenkollektor', { kind: 'beam', color: '#E8F4FF', muzzle: 'energy', impact: 'energy', sound: 'railgun', impactSound: 'energy' }],
    ],
  },
  {
    // Harpune: Der Netzwerfer schießt schwere Harpunen auf den Vordersten (Boden oder Luft), die Rüstung ignorieren, ihn 0,8
    // Felder zurückreißen (Bosse halb) und 3 s lang bremsen. Die Netzsalve bremst eine Gruppe, die Harpune holt einen zurück.
    core: 'netzwerfer',
    recipe: {
      id: 'harpune',
      name: 'Harpune',
      gifts: ['knacker', 'knacker'],
      locked: true,
      ages: [1, 3],
      core: { set: { attack: 'projectile', damage: 30, cooldown: 2.5, projectileSpeed: 12, pierce: 1, push: 0.8, slowDuration: 3, chain: 0, splash: 0, hitsAir: true, seek: false }, mul: { range: 1.3 } },
      coreText: 'Wird zur Harpune: alle 2,5 s ein schwerer Treffer ohne Rüstung, auch in die Luft; das Ziel wird 0,8 Felder zurückgerissen (Bosse halb) und 3 s gebremst.',
    },
    looks: [
      ['Knochenharpune', 'Walfänger', { kind: 'model', model: 'shot.speer', color: '#E9E0CC', arc: 0.2, impact: 'net', sound: 'throw', impactSound: 'wood' }],
      ['Dreizack', 'Neptuns Dreizack', { kind: 'model', model: 'shot.speer', color: '#C9CED6', arc: 0.15, impact: 'net', sound: 'throw', impactSound: 'metal' }],
      ['Enterhaken', 'Enterbrücke', { kind: 'model', model: 'shot.eisenbolzen', color: '#9A9AA0', arc: 0.1, impact: 'net', sound: 'ballista', impactSound: 'metal' }],
      ['Walharpune', 'Walfangflotte', { kind: 'model', model: 'shot.eisenbolzen', color: '#B8BCC4', arc: 0.05, muzzle: 'smoke', impact: 'net', sound: 'cannon', impactSound: 'metal' }],
      ['Harpunenkanone', 'Harpunenbatterie', { kind: 'model', model: 'shot.eisenbolzen', color: '#C4C8CE', arc: 0.05, muzzle: 'smoke', impact: 'net', sound: 'howitzer', impactSound: 'metal' }],
      ['Magnetharpune', 'Gravitonhaken', { kind: 'model', model: 'shot.eisenbolzen', color: '#C9FFF2', arc: 0, trail: 'energy', muzzle: 'energy', impact: 'energy', sound: 'railgun', impactSound: 'energy' }],
    ],
  },
  {
    // Feuerwalze: Der Stampfer setzt mit jedem Schlag alles ringsum am Boden 3 s in Brand und wirft es zurück, zurück in die Glut.
    // Der Feuerring des Brenners lodert ohne Rückstoß, das Beben bremst ohne Feuer.
    core: 'stampfer',
    recipe: {
      id: 'feuerwalze',
      name: 'Feuerwalze',
      gifts: ['brenner', 'brenner'],
      locked: true,
      ages: [1, 2],
      core: { set: { attack: 'pulse', dot: 14, dotDuration: 3, cooldown: 1.6, hitsAir: false }, mul: { range: 1.3, damage: 0.7 } },
      coreText: 'Wird zur Feuerwalze: stampft alle 1,6 s, setzt jeden Bodengegner ringsum 3 s lang in Brand und wirft ihn zurück, in die Glut. Nur am Boden.',
    },
    looks: [
      ['Glutstampfer', 'Lavastampfer', { kind: 'pulse', color: '#FF8A3C', trail: 'fire', impact: 'fire', sound: 'drum', impactSound: 'fire' }],
      ['Vulcans Tritt', 'Ätnas Zorn', { kind: 'pulse', color: '#FF7A2A', trail: 'fire', impact: 'fire', sound: 'drum', impactSound: 'fire' }],
      ['Feuerramme', 'Glutbeben', { kind: 'pulse', color: '#FF6A1A', trail: 'fire', impact: 'fire', sound: 'catapult', impactSound: 'fire' }],
      ['Pulverramme', 'Pulverwalze', { kind: 'pulse', color: '#FFB04A', trail: 'spark', impact: 'fire', sound: 'cannon', impactSound: 'fire' }],
      ['Feuerwalze', 'Glutwalzwerk', { kind: 'pulse', color: '#FF8C2E', trail: 'smoke', impact: 'fire', sound: 'steam', impactSound: 'fire' }],
      ['Plasmastampfer', 'Plasmawalze', { kind: 'pulse', color: '#FF4FA3', trail: 'energy', impact: 'fire', sound: 'plasma', impactSound: 'fire' }],
    ],
  },
  {
    // Nebelwerfer: Der Fernwerfer wirft Giftnebel weit auf den Weg (Felder 4 s, ätzen und bremsen), fast ohne toten Winkel. Braucht
    // den Giftschützen als Zutat: Es gibt ihn nur in Partien mit Fernwerfer UND Giftschütze. Nur am Boden, wie jeder Werfer.
    core: 'fernwerfer',
    recipe: {
      id: 'nebelwerfer',
      name: 'Nebelwerfer',
      gifts: ['giftschuetze', 'bremser'],
      locked: true,
      ages: [2, 3],
      core: { set: { splash: 1.4, zone: 4, dot: 8, dotDuration: 1, slow: 0.25, slowDuration: 1, minRange: 1, cooldown: 2.8, hitsAir: false }, mul: { damage: 0.6 } },
      coreText: 'Wird zum Nebelwerfer: Weite Würfe hüllen den Weg 4 s lang in Giftnebel, der ätzt und bremst; kaum noch ein toter Winkel. Nur am Boden.',
    },
    looks: [
      ['Rauchwerfer', 'Sumpfnebel', { kind: 'model', model: 'shot.tontopf', color: '#8FCB4A', arc: 2.2, tumble: true, trail: 'smoke', impact: 'splash', sound: 'throw', impactSound: 'glass' }],
      ['Schwefeltöpfe', 'Schwefelwolke', { kind: 'model', model: 'shot.tontopf', color: '#D8D060', arc: 2.4, tumble: true, trail: 'smoke', impact: 'splash', sound: 'catapult', impactSound: 'glass' }],
      ['Nebeltopfwerfer', 'Nebelbank', { kind: 'model', model: 'shot.tontopf', color: '#9BC07A', arc: 2.6, tumble: true, trail: 'smoke', impact: 'splash', sound: 'catapult', impactSound: 'glass' }],
      ['Rauchmörser', 'Rauchvorhang', { kind: 'model', model: 'shot.bombe', color: '#9BE36A', arc: 2.6, trail: 'smoke', muzzle: 'smoke', impact: 'splash', sound: 'mortar', impactSound: 'splash' }],
      ['Gaswerfer', 'Nebelbatterie', { kind: 'model', model: 'shot.bombe', color: '#B5E85A', arc: 2.6, trail: 'smoke', muzzle: 'smoke', impact: 'splash', sound: 'howitzer', impactSound: 'splash' }],
      ['Nanonebel', 'Nanowolke', { kind: 'model', model: 'shot.rakete', color: '#7CFF8A', arc: 2, trail: 'energy', muzzle: 'flash', impact: 'splash', sound: 'rocket', impactSound: 'splash' }],
    ],
  },
];
for (const { core, recipe, looks } of POOL_RECIPES) {
  const arch = /** @type {TowerArchetypeDef} */ (POOL.find((a) => a.id === core));
  const fusion = /** @type {NonNullable<TowerArchetypeDef['fusion']>} */ (arch.fusion);
  fusion.recipes = [...(fusion.recipes ?? []), recipe];
  arch.tiers.forEach((def, age) => {
    if (!def) return;
    const [superName, megaName, superShot] = looks[age];
    def.recipes = { ...(def.recipes ?? {}), [recipe.id]: { superName, megaName, superShot } };
  });
}

/** Alle Waffen: die sechs klassischen, dann der Pool. */
export const WEAPONS = [...ARCHETYPES, ...POOL];
