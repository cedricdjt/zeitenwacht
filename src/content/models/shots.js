// @ts-check
// Geschossmodelle (`shot.*`). Alle sind winzig (10 bis etwa 110 Dreiecke), zeigen nach +Z und haben ihren Ursprung in der Mitte.
// Welcher Turm welches Geschoss verschießt, steht in den Turmdaten (`shot.model`); die Liste ist in docs/DESIGN.md, Anhang A, festgelegt.

import { createModel } from '../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../types/model' */

/** Legt eine entlang Y gebaute Form nach +Z um. @type {Vec3} */
const ALONG_Z = [Math.PI / 2, 0, 0];
/** Wie ALONG_Z, aber mit der Spitze nach hinten (-Z). @type {Vec3} */
const ALONG_BACK = [-Math.PI / 2, 0, 0];

const STONE = '#9a968e';
const STONE_DARK = '#7f7b74';
const WOOD = '#8a5a34';
const WOOD_LIGHT = '#b98a55';
const IRON = '#aab0ba';
const IRON_DARK = '#5d6470';
const CLAY = '#c4714a';
const CLAY_LIGHT = '#dc9a6c';
const FEATHER = '#f4efe4';

/**
 * Modelle, die über die Schussfarbe eingefärbt werden (weiße Grundfarbe, die Effektschicht multipliziert `shot.color` auf).
 * @type {readonly string[]}
 */
export const TINTED_SHOTS = ['shot.klecks'];

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze, Steinzeit: grauer Kiesel.
  'shot.kiesel': () => {
    const m = createModel('shot.kiesel');
    m.part('body').sphere({ r: 0.085, detail: 0, scale: [1.1, 0.8, 0.95], rot: [0.3, 0.5, 0.1], color: STONE, faceJitter: 0.12 });
    return m.build();
  },

  // Schütze, Rom: dünner Pfeil mit weißer Befiederung.
  'shot.pfeil': () => {
    const m = createModel('shot.pfeil');
    const p = m.part('body');
    p.cyl({ r: 0.017, h: 0.42, seg: 4, rot: ALONG_Z, at: [0, 0, -0.02], color: WOOD_LIGHT, shade: 0 });
    p.cone({ r: 0.04, h: 0.1, seg: 4, rot: ALONG_Z, at: [0, 0, 0.24], color: IRON, shade: 0 });
    p.box({ size: [0.1, 0.014, 0.12], at: [0, 0, -0.2], color: FEATHER, shade: 0 });
    p.box({ size: [0.014, 0.1, 0.12], at: [0, 0, -0.2], color: FEATHER, shade: 0 });
    return m.build();
  },

  // Schütze, Mittelalter: kurzer, dicker Armbrustbolzen.
  'shot.bolzen': () => {
    const m = createModel('shot.bolzen');
    const p = m.part('body');
    p.cyl({ r: 0.028, h: 0.24, seg: 5, rot: ALONG_Z, at: [0, 0, -0.02], color: WOOD, shade: 0 });
    p.cone({ r: 0.05, h: 0.11, seg: 4, rot: ALONG_Z, at: [0, 0, 0.15], color: IRON, shade: 0 });
    p.box({ size: [0.11, 0.016, 0.09], at: [0, 0, -0.12], color: '#d8c9a8', shade: 0 });
    p.box({ size: [0.016, 0.11, 0.09], at: [0, 0, -0.12], color: '#d8c9a8', shade: 0 });
    return m.build();
  },

  // Werfer, Steinzeit: kantiger Felsbrocken.
  'shot.felsbrocken': () => {
    const m = createModel('shot.felsbrocken');
    const p = m.part('body');
    p.sphere({ r: 0.17, detail: 0, scale: [1.1, 0.85, 1], rot: [0.4, 0.2, 0.3], color: STONE, faceJitter: 0.14 });
    p.sphere({ r: 0.1, detail: 0, at: [0.09, 0.06, -0.07], rot: [1, 0.4, 0.2], color: STONE_DARK, faceJitter: 0.14 });
    return m.build();
  },

  // Werfer, Rom: bauchiger Tontopf mit hellem Rand.
  'shot.tontopf': () => {
    const m = createModel('shot.tontopf');
    const p = m.part('body');
    p.lathe({ points: [[0, -0.12], [0.07, -0.12], [0.13, -0.02], [0.11, 0.06], [0.07, 0.09], [0, 0.09]], seg: 6, color: CLAY, shade: 0.2 });
    p.cyl({ r: 0.085, h: 0.035, seg: 6, at: [0, 0.105, 0], color: CLAY_LIGHT, shade: 0 });
    return m.build();
  },

  // Werfer, Mittelalter: große runde Steinkugel.
  'shot.steinkugel': () => {
    const m = createModel('shot.steinkugel');
    m.part('body').sphere({ r: 0.17, detail: 1, color: '#a9a59a', faceJitter: 0.07, shade: 0.25 });
    return m.build();
  },

  // Werfer, Entdecker und Industrie: schwarze Bombe mit glimmender Lunte.
  'shot.bombe': () => {
    const m = createModel('shot.bombe');
    const p = m.part('body');
    p.sphere({ r: 0.13, detail: 1, color: '#3a3a44', shade: 0.3 });
    p.cyl({ r: 0.035, h: 0.06, seg: 5, at: [0, 0.14, 0], color: '#6a6a74', shade: 0 });
    p.sphere({ r: 0.045, detail: 0, at: [0, 0.2, 0], color: '#ffb347', glow: 1.8 });
    return m.build();
  },

  // Werfer, Zukunft: schlanke Rakete mit leuchtendem Antrieb.
  'shot.rakete': () => {
    const m = createModel('shot.rakete');
    const p = m.part('body');
    p.cyl({ r: 0.05, h: 0.26, seg: 6, rot: ALONG_Z, at: [0, 0, -0.02], color: '#e8e6e0', shade: 0 });
    p.cone({ r: 0.05, h: 0.12, seg: 6, rot: ALONG_Z, at: [0, 0, 0.17], color: '#f08a3c', shade: 0 });
    p.box({ size: [0.2, 0.016, 0.1], at: [0, 0, -0.12], color: '#4a5560', shade: 0 });
    p.box({ size: [0.016, 0.2, 0.1], at: [0, 0, -0.12], color: '#4a5560', shade: 0 });
    p.cone({ r: 0.04, h: 0.1, seg: 5, rot: ALONG_BACK, at: [0, 0, -0.2], color: '#ffc46b', glow: 1.8 });
    return m.build();
  },

  // Bremser, alle Zeitalter: weißer Tropfen, über die Schussfarbe eingefärbt (Harz, Pech, Sirup, Öl, Schaum).
  'shot.klecks': () => {
    const m = createModel('shot.klecks');
    const p = m.part('body');
    p.sphere({ r: 0.1, detail: 1, at: [0, 0, 0.03], scale: [1, 0.95, 1.1], color: '#f6f2ea', shade: 0.18 });
    p.cone({ r: 0.075, h: 0.17, seg: 6, rot: ALONG_BACK, at: [0, 0, -0.1], color: '#f6f2ea', shade: 0 });
    return m.build();
  },

  // Bremser, Rom: Ölamphore mit zwei Henkeln (taumelt im Flug).
  'shot.amphore': () => {
    const m = createModel('shot.amphore');
    const p = m.part('body');
    p.lathe({ points: [[0, -0.17], [0.03, -0.17], [0.1, -0.03], [0.09, 0.05], [0.04, 0.09], [0.04, 0.13], [0.065, 0.16], [0, 0.16]], seg: 5, color: CLAY, shade: 0.2 });
    p.box({ size: [0.03, 0.09, 0.03], at: [0.085, 0.09, 0], color: CLAY_LIGHT, shade: 0, mirror: true });
    return m.build();
  },

  // Panzerknacker, Steinzeit: langer Speer mit Feuersteinspitze und violetter Feder.
  'shot.speer': () => {
    const m = createModel('shot.speer');
    const p = m.part('body');
    p.cyl({ r: 0.02, h: 0.66, seg: 4, rot: ALONG_Z, at: [0, 0, -0.05], color: WOOD, shade: 0 });
    p.cone({ r: 0.05, h: 0.16, seg: 4, rot: ALONG_Z, at: [0, 0, 0.36], scale: [1, 1, 0.55], color: '#c9c4b8', shade: 0 });
    p.box({ size: [0.09, 0.02, 0.1], at: [0, 0, 0.2], color: '#9a6fd6', shade: 0 });
    return m.build();
  },

  // Panzerknacker, Rom und Mittelalter: schwerer Bolzen mit Eisenkopf.
  'shot.eisenbolzen': () => {
    const m = createModel('shot.eisenbolzen');
    const p = m.part('body');
    p.cyl({ r: 0.032, h: 0.4, seg: 5, rot: ALONG_Z, at: [0, 0, -0.04], color: '#6e4a2c', shade: 0 });
    p.cone({ r: 0.065, h: 0.16, seg: 4, rot: ALONG_Z, at: [0, 0, 0.24], color: IRON, shade: 0 });
    p.box({ size: [0.13, 0.018, 0.1], at: [0, 0, -0.2], color: IRON_DARK, shade: 0 });
    p.box({ size: [0.018, 0.13, 0.1], at: [0, 0, -0.2], color: IRON_DARK, shade: 0 });
    return m.build();
  },
};
