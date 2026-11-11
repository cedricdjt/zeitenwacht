// @ts-check
// Die sechs Zeitalter (Spielentwurf Kapitel 3): „ein Tag durch die Geschichte“ vom Morgengrauen der Steinzeit bis zur Nacht
// des Jahres 2050. Reine Daten, kein three.js, kein DOM.
//
// Licht: Die Sonne wandert von Osten (Azimut 90) über Süden (0) nach Westen (negativ). Das Hauptlicht bleibt nahe an Weiß,
// die Stimmung kommt aus Himmel, Nebel und Umgebungslicht. Als Richtwert gilt
// sunIntensity * sin(sunElevation) + hemiIntensity = etwa 3,0 bis 3,4 am Tag, weniger in der Dämmerung, 2 bis 2,4 bei Nacht.
// Palette je Zeitalter im Entwurf: Himmel oben / Horizont / Sonnenlicht / Boden A / Boden B / Weg / Akzent.
// Der Weg hat immer eine helle Kante (Look-Regel 1).

/** @import { AgeDef, ScatterRule } from '../types/content' */

/**
 * Die Regeln, die jedes Zeitalter gleich braucht: ein Füller für gesperrte Felder und zwei Sorten flache Bodendeko.
 * @param {string} age Kennung des Zeitalters
 * @returns {ScatterRule[]}
 */
function groundRules(age) {
  return [
    { model: `prop.${age}.block`, weight: 1, zone: 'block', scale: [0.95, 1.1] },
    { model: `prop.${age}.deko1`, weight: 3, zone: 'field', scale: [0.8, 1.2], cluster: 2 },
    { model: `prop.${age}.deko2`, weight: 2, zone: 'field', scale: [0.8, 1.15] },
  ];
}

/** @type {AgeDef[]} */
export const AGES = [
  // ------------------------------------------------------------------------------------------- 1 Steinzeit
  {
    id: 'steinzeit',
    name: 'Steinzeit',
    subtitle: 'um 10 000 v. Chr.',
    tagline: 'Der Morgen graut, das erste Feuer brennt. Pass gut darauf auf.',
    accent: '#E2603A',
    // Morgengrauen: tiefe rosa-orange Sonne, kühle Schatten, Bodennebel. Ruhig und hoffnungsvoll.
    light: {
      skyTop: '#6B7FB8',
      skyHorizon: '#F7B28A',
      skyBottom: '#F3C7B8',
      sunColor: '#FFE6CF',
      sunIntensity: 2.6,
      sunElevation: 30,
      sunAzimuth: 95,
      sunGlow: 1.3,
      hemiSky: '#CBD6F7',
      hemiGround: '#C4AC96',
      hemiIntensity: 1.7,
      fillIntensity: 0.5,
      fogColor: '#F7B28A',
      fogDensity: 0.007,
      exposure: 1.02,
    },
    terrain: {
      groundA: '#8FB36B',
      groundB: '#7BA05C',
      path: '#C9A77A',
      pathEdge: '#E3CBA4',
      soil: '#8A6444',
      rock: '#8E8A86',
    },
    scatter: [
      { model: 'prop.steinzeit.urzeitbaum', weight: 5, zone: 'shore', scale: [0.9, 1.3], cluster: 3 },
      { model: 'prop.steinzeit.farnbusch', weight: 4, zone: 'shore', scale: [0.8, 1.2], cluster: 3 },
      { model: 'prop.steinzeit.findling', weight: 2.5, zone: 'shore', scale: [0.7, 1.3] },
      { model: 'prop.steinzeit.fellzelt', weight: 1.2, zone: 'shore', scale: [0.95, 1.1], cluster: 2 },
      { model: 'prop.steinzeit.mammutrippen', weight: 0.6, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.steinzeit.malfels', weight: 0.6, zone: 'shore', scale: [0.9, 1.15] },
      { model: 'prop.steinzeit.lagerfeuer', weight: 0.5, zone: 'shore', scale: [0.9, 1.05] },
      { model: 'prop.steinzeit.trockengestell', weight: 0.6, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.steinzeit.findling', weight: 2, zone: 'rim', scale: [0.8, 1.5], cluster: 2 },
      { model: 'prop.steinzeit.farnbusch', weight: 2, zone: 'rim', scale: [0.7, 1.1], cluster: 2 },
      ...groundRules('steinzeit'),
      { model: 'prop.steinzeit.findling', weight: 0.6, zone: 'field', scale: [0.25, 0.4] },
    ],
    scatterCount: 64,
    fieldCount: 46,
    baseModel: 'base.steinzeit',
    // Die Insel schwebt in einem rosa Morgennebel.
    abyss: { kind: 'mist', color: '#F4C2B2', color2: '#FFE4D4' },
    particles: { kind: 'fireflies', color: '#FFE9A0', density: 0.3 },
    // 84 BPM, a-Moll-Pentatonik, Handtrommeln, hauchige Knochenflöte, spärlich.
    music: { tempo: 84, root: 57, scale: [0, 3, 5, 7, 10], lead: 'flute', backing: 'drone', percussion: 'handdrum', energy: 0.25 },
    bloom: 0.35,
  },

  // ------------------------------------------------------------------------------------------- 2 Römisches Reich
  {
    id: 'rom',
    name: 'Römisches Reich',
    subtitle: 'um 100 n. Chr.',
    tagline: 'Marmor, Zypressen, Vormittagssonne. Die Flamme zieht in den Tempel.',
    accent: '#C0392B',
    // Vormittag: klares, warmweißes Mittelmeerlicht, satter blauer Himmel.
    light: {
      skyTop: '#4FA3E3',
      skyHorizon: '#CFEBFA',
      skyBottom: '#8FD3DE',
      sunColor: '#FFF4D6',
      sunIntensity: 2.5,
      sunElevation: 42,
      sunAzimuth: 65,
      sunGlow: 1,
      hemiSky: '#DCEEFF',
      hemiGround: '#CDBE95',
      hemiIntensity: 1.65,
      fillIntensity: 0.55,
      fogColor: '#CFEBFA',
      fogDensity: 0.004,
      exposure: 1.05,
    },
    terrain: {
      groundA: '#B9C46A',
      groundB: '#A6B35A',
      path: '#D8CDB8',
      pathEdge: '#EFE8DA',
      soil: '#B08A5C',
      rock: '#C9BFA8',
    },
    scatter: [
      { model: 'prop.rom.zypresse', weight: 5, zone: 'shore', scale: [0.9, 1.35], cluster: 3 },
      { model: 'prop.rom.olivenbaum', weight: 3.5, zone: 'shore', scale: [0.85, 1.2], cluster: 2 },
      { model: 'prop.rom.saeule', weight: 2.5, zone: 'shore', scale: [0.85, 1.15], cluster: 2 },
      { model: 'prop.rom.pergola', weight: 0.8, zone: 'shore', scale: [0.95, 1.1] },
      { model: 'prop.rom.statue', weight: 0.8, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.rom.amphoren', weight: 1.4, zone: 'shore', scale: [0.85, 1.1] },
      { model: 'prop.rom.mosaik', weight: 0.6, zone: 'shore', scale: [0.9, 1.2] },
      // Das Aquädukt begleitet eine Inselkante.
      { model: 'prop.rom.aquaedukt', weight: 2, zone: 'rim', scale: [1, 1.15], cluster: 4 },
      { model: 'prop.rom.zypresse', weight: 2, zone: 'rim', scale: [1, 1.5], cluster: 2 },
      ...groundRules('rom'),
      { model: 'prop.rom.mosaik', weight: 0.4, zone: 'field', scale: [0.4, 0.55] },
    ],
    scatterCount: 60,
    fieldCount: 42,
    baseModel: 'base.rom',
    // Türkises Meer mit träger Dünung und weißem Schaumring.
    abyss: { kind: 'sea', color: '#2FB5C4', color2: '#E9FBFA' },
    particles: { kind: 'dust', color: '#FFF6DC', density: 0.3 },
    // 96 BPM, d-Dorisch, Cornu, gezupfte Lyra, Pauke auf 1 und 3, Marschgefühl.
    music: { tempo: 96, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'brass', backing: 'pluck', percussion: 'march', energy: 0.45 },
    bloom: 0.25,
  },

  // ------------------------------------------------------------------------------------------- 3 Mittelalter
  {
    id: 'mittelalter',
    name: 'Mittelalter',
    subtitle: 'um 1250',
    tagline: 'Mittagsglocken über Fachwerk und Zinnen. Die Flamme lodert auf dem Burgfried.',
    accent: '#2F5DA8',
    // Mittag: Sonne fast im Zenit, kurze Schatten, die kräftigsten Farben.
    light: {
      skyTop: '#3F8FD9',
      skyHorizon: '#BFE3F5',
      skyBottom: '#7FBFC9',
      sunColor: '#FFFBEA',
      sunIntensity: 2.0,
      sunElevation: 70,
      sunAzimuth: 15,
      sunGlow: 0.9,
      hemiSky: '#DDEEFF',
      hemiGround: '#A9C48C',
      hemiIntensity: 1.45,
      fillIntensity: 0.6,
      fogColor: '#BFE3F5',
      fogDensity: 0.0035,
      exposure: 1.05,
    },
    terrain: {
      groundA: '#5FAF55',
      groundB: '#4E9C48',
      path: '#9A8F84',
      pathEdge: '#C4BBB0',
      soil: '#7A5A3C',
      rock: '#8B8F93',
    },
    scatter: [
      { model: 'prop.mittelalter.tanne', weight: 5, zone: 'shore', scale: [0.9, 1.35], cluster: 4 },
      { model: 'prop.mittelalter.fachwerkhaus', weight: 2.2, zone: 'shore', scale: [0.9, 1.1], cluster: 2 },
      { model: 'prop.mittelalter.heuhaufen', weight: 1.6, zone: 'shore', scale: [0.8, 1.15], cluster: 2 },
      { model: 'prop.mittelalter.weizenfeld', weight: 1.4, zone: 'shore', scale: [0.95, 1.2], cluster: 2 },
      { model: 'prop.mittelalter.marktstand', weight: 0.9, zone: 'shore', scale: [0.9, 1.05] },
      { model: 'prop.mittelalter.brunnen', weight: 0.7, zone: 'shore', scale: [0.9, 1.05] },
      { model: 'prop.mittelalter.zinnenmauer', weight: 1.2, zone: 'shore', scale: [0.95, 1.1], cluster: 3 },
      // Hohe Wahrzeichen stehen nur am Inselrand.
      { model: 'prop.mittelalter.windmuehle', weight: 1, zone: 'rim', scale: [1, 1.2] },
      { model: 'prop.mittelalter.tanne', weight: 3, zone: 'rim', scale: [1, 1.5], cluster: 3 },
      { model: 'prop.mittelalter.zinnenmauer', weight: 1, zone: 'rim', scale: [1, 1.1], cluster: 3 },
      ...groundRules('mittelalter'),
    ],
    scatterCount: 66,
    fieldCount: 48,
    baseModel: 'base.mittelalter',
    // Tiefer grünblauer See wie ein riesiger Burggraben.
    abyss: { kind: 'sea', color: '#2B7F86', color2: '#7CC2A2' },
    // Pusteblumensamen.
    particles: { kind: 'pollen', color: '#FFFFFF', density: 0.4 },
    // 104 BPM, G-Mixolydisch, gezupfte Laute, Drehleier-Bordun, Schellentrommel.
    music: { tempo: 104, root: 55, scale: [0, 2, 4, 5, 7, 9, 10], lead: 'pluck', backing: 'drone', percussion: 'frame', energy: 0.5 },
    bloom: 0.25,
  },

  // ------------------------------------------------------------------------------------------- 4 Zeitalter der Entdecker
  {
    id: 'entdecker',
    name: 'Zeitalter der Entdecker',
    subtitle: 'um 1700',
    tagline: 'Goldener Nachmittag, Salz in der Luft. Die Flamme wird zum Leuchtfeuer der Hafenfestung.',
    accent: '#1E6F78',
    // Nachmittag: warmes goldenes Licht aus Westen, längere Schatten, leichter Dunst.
    light: {
      skyTop: '#5C9BD1',
      skyHorizon: '#FBE3A8',
      skyBottom: '#7FB6C9',
      sunColor: '#FFE0A0',
      sunIntensity: 2.35,
      sunElevation: 45,
      sunAzimuth: -45,
      sunGlow: 1.2,
      hemiSky: '#DCE9F7',
      hemiGround: '#D9C08F',
      hemiIntensity: 1.55,
      fillIntensity: 0.5,
      fogColor: '#FBE3A8',
      fogDensity: 0.007,
      exposure: 1.03,
    },
    terrain: {
      groundA: '#8DBB5E',
      groundB: '#D9C58B',
      path: '#B98D5A',
      pathEdge: '#E6D3A6',
      soil: '#C9A76E',
      rock: '#9C8F7C',
    },
    scatter: [
      { model: 'prop.entdecker.palme', weight: 5, zone: 'shore', scale: [0.9, 1.3], cluster: 3 },
      { model: 'prop.entdecker.faesser', weight: 2, zone: 'shore', scale: [0.85, 1.1], cluster: 2 },
      { model: 'prop.entdecker.kontor', weight: 1.6, zone: 'shore', scale: [0.9, 1.1], cluster: 2 },
      { model: 'prop.entdecker.schatztruhe', weight: 0.6, zone: 'shore', scale: [0.9, 1.05] },
      { model: 'prop.entdecker.kanonenkugeln', weight: 1, zone: 'shore', scale: [0.85, 1.1] },
      // Stege ragen über die Kante, der Leuchtturm steht am Rand.
      { model: 'prop.entdecker.steg', weight: 2, zone: 'rim', scale: [0.95, 1.15] },
      { model: 'prop.entdecker.leuchtturm', weight: 0.7, zone: 'rim', scale: [1, 1.15] },
      { model: 'prop.entdecker.palme', weight: 3, zone: 'rim', scale: [1, 1.4], cluster: 2 },
      // Segelschiffe kreuzen in der Ferne.
      { model: 'prop.entdecker.segelschiff', weight: 1, zone: 'far', scale: [2.5, 4] },
      ...groundRules('entdecker'),
    ],
    scatterCount: 58,
    fieldCount: 42,
    baseModel: 'base.entdecker',
    // Offener Ozean mit Schaumkronen.
    abyss: { kind: 'sea', color: '#2A7FA8', color2: '#F2FAFF' },
    // Segeltuchfetzen, die auf Böen treiben.
    particles: { kind: 'leaves', color: '#F3E9CF', density: 0.2 },
    // 112 BPM, D-Dur, cembaloartige helle Zupfer, Trommelwirbel, Shanty-Schwung.
    music: { tempo: 112, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'piano', backing: 'pluck', percussion: 'march', energy: 0.6 },
    bloom: 0.3,
  },

  // ------------------------------------------------------------------------------------------- 5 Industriezeitalter
  {
    id: 'industrie',
    name: 'Industriezeitalter',
    subtitle: 'um 1880',
    tagline: 'Dampf, Messing, Backstein. Im Abendrot glüht die Flamme hinter dem Fenster des Kraftwerks.',
    accent: '#D97B29',
    // Abenddämmerung: tieforange Sonne im Dunst, violetter Himmel; Fenster und Gaslaternen setzen die Akzente.
    light: {
      skyTop: '#4A3F6B',
      skyHorizon: '#F28C52',
      skyBottom: '#B97B5E',
      sunColor: '#FFE2CC',
      sunIntensity: 2.5,
      sunElevation: 30,
      sunAzimuth: -85,
      sunGlow: 1.4,
      hemiSky: '#DAD3EE',
      hemiGround: '#D9AC8C',
      hemiIntensity: 1.7,
      fillIntensity: 0.5,
      fogColor: '#F28C52',
      fogDensity: 0.006,
      exposure: 1.05,
    },
    terrain: {
      groundA: '#6E7F58',
      groundB: '#5F6E4E',
      path: '#8E8791',
      pathEdge: '#B9B2BA',
      soil: '#6B5547',
      rock: '#7A6F74',
    },
    scatter: [
      { model: 'prop.industrie.reihenhaus', weight: 4, zone: 'shore', scale: [0.9, 1.1], cluster: 3 },
      { model: 'prop.industrie.gaslaterne', weight: 3, zone: 'shore', scale: [0.95, 1.1] },
      { model: 'prop.industrie.fabrikhalle', weight: 1.6, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.industrie.kohlehaufen', weight: 1.6, zone: 'shore', scale: [0.8, 1.2], cluster: 2 },
      { model: 'prop.industrie.gueterwaggon', weight: 1, zone: 'shore', scale: [0.9, 1.05], cluster: 2 },
      { model: 'prop.industrie.wasserturm', weight: 0.8, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.industrie.gasometer', weight: 0.8, zone: 'shore', scale: [0.9, 1.1] },
      // Schornsteine nur am Rand und in der Ferne, wo sie aus dem Smog ragen.
      { model: 'prop.industrie.schornstein', weight: 2, zone: 'rim', scale: [1, 1.3] },
      { model: 'prop.industrie.fabrikhalle', weight: 1, zone: 'rim', scale: [1, 1.2] },
      { model: 'prop.industrie.schornstein', weight: 2, zone: 'far', scale: [3, 5], cluster: 2 },
      { model: 'prop.industrie.fabrikhalle', weight: 1, zone: 'far', scale: [3, 4.5] },
      ...groundRules('industrie'),
    ],
    scatterCount: 62,
    fieldCount: 38,
    baseModel: 'base.industrie',
    // Bernsteinfarbenes Smogmeer unter der Insel.
    abyss: { kind: 'mist', color: '#CF945F', color2: '#EFC08F' },
    // Aufsteigende Funken.
    particles: { kind: 'embers', color: '#FFB060', density: 0.35 },
    // 108 BPM, c-Moll (harmonisch), Drehorgel, tiefe Begleitung, Rhythmus aus Zischen und Klappern.
    music: { tempo: 108, root: 48, scale: [0, 2, 3, 5, 7, 8, 11], lead: 'organ', backing: 'strings', percussion: 'kit', energy: 0.65 },
    bloom: 0.55,
  },

  // ------------------------------------------------------------------------------------------- 6 Nahe Zukunft
  {
    id: 'zukunft',
    name: 'Nahe Zukunft',
    subtitle: 'um 2050',
    tagline: 'Mondlicht und Neon. Die Flamme ist jetzt ein Energiekern, und sie ist immer noch warm.',
    accent: '#2EE6C8',
    // Nacht: kühles Mondlicht, kräftige Leuchtakzente; das Umgebungslicht bleibt hoch genug, dass Boden und Weg lesbar sind.
    light: {
      skyTop: '#0E1433',
      skyHorizon: '#2B3F7A',
      skyBottom: '#0A1026',
      sunColor: '#A9C4FF',
      sunIntensity: 1.45,
      sunElevation: 52,
      sunAzimuth: -55,
      sunGlow: 0.7,
      hemiSky: '#AFC0FF',
      hemiGround: '#5A769C',
      hemiIntensity: 1.2,
      fillIntensity: 0.45,
      fogColor: '#2B3F7A',
      fogDensity: 0.004,
      exposure: 1.25,
    },
    terrain: {
      groundA: '#2F4A4A',
      groundB: '#3A5A54',
      path: '#59637C',
      pathEdge: '#9FB4D9',
      soil: '#2A3440',
      rock: '#3A4356',
    },
    scatter: [
      { model: 'prop.zukunft.stadtbaum', weight: 5, zone: 'shore', scale: [0.9, 1.25], cluster: 2 },
      { model: 'prop.zukunft.solarfeld', weight: 2.5, zone: 'shore', scale: [0.9, 1.1], cluster: 3 },
      { model: 'prop.zukunft.ladesaeule', weight: 2, zone: 'shore', scale: [0.95, 1.05] },
      { model: 'prop.zukunft.holotafel', weight: 1.2, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.zukunft.farm', weight: 1.4, zone: 'shore', scale: [0.9, 1.1] },
      { model: 'prop.zukunft.landeplatz', weight: 0.8, zone: 'shore', scale: [0.95, 1.1] },
      // Windräder und Wohntürme nur am Rand; die Skyline steht fern am Horizont.
      { model: 'prop.zukunft.windrad', weight: 2, zone: 'rim', scale: [1, 1.3] },
      { model: 'prop.zukunft.wohnturm', weight: 1.5, zone: 'rim', scale: [0.95, 1.2] },
      { model: 'prop.zukunft.wohnturm', weight: 3, zone: 'far', scale: [3, 6], cluster: 4 },
      ...groundRules('zukunft'),
    ],
    scatterCount: 56,
    fieldCount: 36,
    baseModel: 'base.zukunft',
    // Schwarzes Spiegelwasser mit den Lichtern der fernen Stadt.
    abyss: { kind: 'city', color: '#0A1026', color2: '#2EE6C8' },
    // Die Glühwürmchen der Steinzeit kehren zurück.
    particles: { kind: 'fireflies', color: '#7FF5E0', density: 0.45 },
    // 126 BPM, fis-Moll-Pentatonik mit lydischer Farbe, weiche Sägezahnflächen, Arpeggio, Subbass.
    music: { tempo: 126, root: 54, scale: [0, 3, 5, 6, 7, 10], lead: 'synth', backing: 'pad', percussion: 'electronic', energy: 0.7 },
    bloom: 0.8,
  },
];
