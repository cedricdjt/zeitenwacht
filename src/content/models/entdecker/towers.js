// @ts-check
// Türme im Zeitalter der Entdecker: Musketier, Mörser, Sirupfass, Feldschlange, Feuerwerker, Signalmast.
// Alle stehen auf demselben achteckigen Sandsteinsockel mit Plankendeck und einem Band in der Rollenfarbe
// (gleiche Lage von Band und Stufenpunkten wie in den anderen Zeitaltern, damit modernisierte Türme wiedererkennbar bleiben).

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, PoseNode, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;

// --- Materialfarben des Zeitalters (Sandstein wie bei der Hafenfestung, Holz bewusst hell) ---
const SAND = '#d8c08c';
const SAND_LIGHT = '#ecdcb2';
const SAND_DARK = '#b39a6a';
const DECK = '#c99a62';
const DECK_LIGHT = '#e0b880';
const WOOD = '#bb8c57';
const WOOD_LIGHT = '#dcb077';
const WOOD_DARK = '#8f6842';
const BRONZE = '#c48d45';
const BRONZE_LIGHT = '#e8bd6c';
const BRONZE_DARK = '#94652f';
const COPPER = '#c87533';
const COPPER_LIGHT = '#eba166';
const IRON = '#4d4949';
const IRON_LIGHT = '#77716b';
const SKIN = '#e8b892';
const HAIR = '#6a4a30';
const DARK = '#2a2420';
const HAT = '#3b3230';
const HAT_LIGHT = '#5a4b40';
const STOCKING = '#efe7d6';
const SHOE = '#3a302a';
const CREAM = '#f2e8d2';
const WICKER = '#c09a5c';
const WICKER_LIGHT = '#dcbd80';
const SOIL = '#a8875a';
const TURF = '#94bf62';
const SYRUP = '#6e301c';
const SYRUP_SHINE = '#b0602e';
const SMOKE = '#eee9e0';
const FLASH = '#ffc65c';
const FLASH_LIGHT = '#fff3c4';
const EMBER = '#ff8a2a';
const EMBER_LIGHT = '#ffd35e';
const ROPE = '#dcc698';
const DOOR = '#3a332e';
const AGE_TEAL = '#1e6f78';
const AGE_RED = '#b5382e';

// --- Rollenfarben ---
const BLUE = '#3d7dd8';
const BLUE_LIGHT = '#6da0ea';
const BLUE_DARK = '#2f62b0';
const ORANGE = '#e8842a';
const ORANGE_LIGHT = '#f5a652';
const TEAL = '#26b5a8';
const TEAL_LIGHT = '#5fd6c9';
const VIOLET = '#8a55d6';
const VIOLET_LIGHT = '#a97ee6';
const VIOLET_DARK = '#6c3fb0';
const RED = '#d8432f';
const RED_LIGHT = '#ea6a55';
const RED_DARK = '#a8321f';
const GOLD = '#f2c230';
const GOLD_LIGHT = '#ffe07a';

/** Oberkante des Sockels. */
const TOP = 0.235;
/** Schläge pro Sekunde der Musik des Zeitalters (112 BPM im 6/8-Takt). */
const BEAT = 112 / 60;

/**
 * Weiches Ein- und Ausblenden zwischen 0 und 1.
 * @param {number} x
 * @returns {number}
 */
function smooth(x) {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/**
 * Stange zwischen zwei Punkten.
 * @param {PartBuilder} p
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {number} r
 * @param {string} color
 * @param {{ rTop?: number, seg?: number, colorTop?: string, glow?: boolean }} [o]
 */
function rod(p, a, b, r, color, o = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  p.cyl({
    r,
    rTop: o.rTop,
    h: len,
    seg: o.seg ?? 5,
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [Math.atan2(dz, dy), 0, -Math.asin(dx / len)],
    color,
    colorTop: o.colorTop,
    glow: o.glow,
  });
}

/**
 * Balken (Quader) zwischen zwei Punkten gleicher x-Lage, Querschnitt w x h.
 * @param {PartBuilder} p
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {number} w
 * @param {number} h
 * @param {string} color
 * @param {string} [colorTop]
 */
function beam(p, a, b, w, h, color, colorTop) {
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  p.box({
    size: [w, h, Math.hypot(dy, dz)],
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [Math.atan2(-dy, dz), 0, 0],
    color,
    colorTop,
  });
}

/**
 * Sandsteinsockel mit Plankendeck, Band in der Rollenfarbe und dem ersten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function plinth(m, role) {
  const base = m.part('base');
  base.cyl({ r: 0.44, rTop: 0.425, h: 0.17, seg: 8, base: [0, -0.05, 0], color: SAND_DARK });
  base.cyl({ r: 0.432, h: 0.075, seg: 8, base: [0, 0.1, 0], color: role, shade: 0.1 });
  base.cyl({ r: 0.415, rTop: 0.39, h: 0.065, seg: 8, base: [0, 0.17, 0], color: SAND, colorTop: SAND_LIGHT });
  base.cyl({ r: 0.35, h: 0.014, seg: 8, base: [0, TOP - 0.006, 0], color: DECK, colorTop: DECK_LIGHT });
  base.sphere({ r: 0.045, detail: 0, at: [0, 0.235, 0.36], color: role });
  return base;
}

/**
 * Teil der Stufe 2: zweites Farbband, vier Poller mit Tauwerk, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.455, h: 0.045, seg: 8, base: [0, 0.015, 0], color: role, shade: 0.1 });
  for (const [x, z] of [[0.31, 0.31], [-0.31, 0.31], [-0.31, -0.31], [0.31, -0.31]]) {
    p.cyl({ r: 0.066, rTop: 0.058, h: 0.17, seg: 6, base: [x, -0.03, z], color: WOOD_DARK, colorTop: WOOD });
    p.cyl({ r: 0.078, h: 0.035, seg: 6, base: [x, 0.14, z], color: IRON_LIGHT });
    p.torus({ r: 0.07, tube: 0.02, seg: 6, tubeSeg: 3, at: [x, 0.07, z], color: ROPE });
  }
  p.sphere({ r: 0.045, detail: 0, at: [-0.11, 0.235, 0.345], color: role });
  return p;
}

/**
 * Teil der Stufe 3 mit dem dritten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier3(m, role) {
  const p = m.part('tier3', { minLevel: 3 });
  p.sphere({ r: 0.045, detail: 0, at: [0.11, 0.235, 0.345], color: role });
  return p;
}

/** Mündungsfeuer und Rauch werden verkleinert gebaut (damit die Ruhemaße im Feld bleiben) und im animate um diesen Faktor vergrößert. */
const SHRINK = 8;

/**
 * Mündungsfeuer: leuchtender Kegel entlang +Z ab dem Drehpunkt, um SHRINK verkleinert.
 * @param {PartBuilder} p
 * @param {Vec3} at Mündung
 * @param {number} r
 * @param {number} len
 */
function muzzleFlash(p, at, r, len) {
  const k = 1 / SHRINK;
  p.cone({ r: r * k, h: len * k, seg: 6, at: [at[0], at[1], at[2] + (len * k) / 2], rot: [HALF, 0, 0], color: FLASH, colorTop: FLASH_LIGHT, glow: true });
}

/**
 * Rauchwolke aus zwei Kugeln vor der Mündung, um SHRINK verkleinert.
 * @param {PartBuilder} p
 * @param {Vec3} at Mündung
 * @param {number} r
 */
function smokePuff(p, at, r) {
  const k = 1 / SHRINK;
  p.sphere({ r: r * k, detail: 1, at: [at[0], at[1] + 0.02 * k, at[2] + r * 1.1 * k], color: SMOKE });
  p.sphere({ r: r * 0.75 * k, detail: 0, at: [at[0] + r * 0.7 * k, at[1] + r * 0.6 * k, at[2] + r * 0.4 * k], color: SMOKE });
}

/**
 * Figur um 1700 ohne Arme: Strümpfe, Schnallenschuhe, Rock mit Schößen, Weste, großer Kopf. Füße bei (x, y, z), Blick nach +Z.
 * Schultern liegen bei y + 0.28 (kniend 0.06 tiefer), der Scheitel bei etwa y + 0.47.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ coat: string, coatTop: string, hat?: 'tricorne' | 'cap', hatColor?: string, trim?: string, belt?: boolean, kneel?: boolean }} o
 * @returns {number} Höhe der Hüfte (Bezug für Schultern und Kopf)
 */
function person(p, x, y, z, o) {
  const yb = o.kneel ? y - 0.1 : y;
  if (o.kneel) {
    // linkes Knie aufgestellt, rechtes Knie am Boden
    p.box({ size: [0.07, 0.06, 0.14], at: [x - 0.055, y + 0.07, z + 0.07], color: o.coat });
    p.box({ size: [0.065, 0.09, 0.07], base: [x - 0.055, y, z + 0.13], color: STOCKING });
    p.box({ size: [0.07, 0.03, 0.09], base: [x - 0.055, y, z + 0.15], color: SHOE });
    p.box({ size: [0.065, 0.05, 0.15], at: [x + 0.055, y + 0.025, z - 0.02], color: STOCKING });
  } else {
    for (const s of [-1, 1]) {
      p.box({ size: [0.065, 0.1, 0.07], base: [x + s * 0.05, y, z], color: STOCKING });
      p.box({ size: [0.07, 0.03, 0.095], base: [x + s * 0.05, y, z + 0.012], color: SHOE });
    }
  }
  // Rockschöße und Rumpf
  p.box({ size: [0.23, 0.12, 0.16], base: [x, yb + 0.07, z], color: o.coat });
  p.box({ size: [0.2, 0.13, 0.14], base: [x, yb + 0.17, z], color: o.coat, colorTop: o.coatTop });
  p.box({ size: [0.075, 0.2, 0.01], base: [x, yb + 0.09, z + 0.084], color: CREAM });
  if (o.belt) p.box({ size: [0.035, 0.27, 0.012], at: [x, yb + 0.2, z + 0.093], rot: [0, 0, 0.62], color: CREAM });
  p.box({ size: [0.07, 0.04, 0.04], at: [x, yb + 0.3, z + 0.055], color: CREAM });
  // Kopf mit Zopf
  p.sphere({ r: 0.095, at: [x, yb + 0.37, z + 0.01], color: SKIN });
  p.box({ size: [0.022, 0.026, 0.012], at: [x + 0.035, yb + 0.365, z + 0.105], color: DARK });
  p.box({ size: [0.022, 0.026, 0.012], at: [x - 0.035, yb + 0.365, z + 0.105], color: DARK });
  p.box({ size: [0.05, 0.08, 0.04], at: [x, yb + 0.31, z - 0.085], color: HAIR });
  const hc = o.hatColor ?? HAT;
  if ((o.hat ?? 'tricorne') === 'tricorne') {
    // Dreispitz: eine Ecke zeigt nach vorn, heller Rand. Von oben ein klares Dreieck.
    p.dome({ r: 0.09, seg: 7, rings: 2, at: [x, yb + 0.395, z], color: hc });
    p.cyl({ r: 0.175, h: 0.014, seg: 3, base: [x, yb + 0.4, z], color: o.trim ?? CREAM });
    p.cyl({ r: 0.165, rTop: 0.14, h: 0.045, seg: 3, base: [x, yb + 0.408, z], color: hc, colorTop: HAT_LIGHT });
  } else {
    // Wollmütze mit umgeschlagenem Rand
    p.dome({ r: 0.1, seg: 7, rings: 2, at: [x, yb + 0.39, z], scale: [1, 1.2, 1], color: hc });
    p.cyl({ r: 0.104, h: 0.035, seg: 7, base: [x, yb + 0.375, z], color: CREAM });
  }
  return yb;
}

/**
 * Musketier mit eigenem Teil für Muskete und Arme (`name + 'Gun'`), Mündungsfeuer (`name + 'Flash'`) und Rauch (`name + 'Smoke'`).
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {string} parent
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {boolean} kneel
 * @param {number} minLevel
 * @returns {Vec3} Mündung
 */
function musketeer(m, name, parent, x, y, z, kneel, minLevel) {
  const fig = m.part(name, { parent, pivot: [x, y, z], minLevel });
  const yb = person(fig, x, y, z, { coat: BLUE_DARK, coatTop: BLUE, belt: true, kneel });
  const mx = x + 0.07;
  const my = yb + 0.285;
  const gun = m.part(name + 'Gun', { parent: name, pivot: [mx, my, z], minLevel });
  // Arme: rechts am Kolben, links stützt den Schaft
  rod(gun, [x + 0.12, yb + 0.28, z], [x + 0.16, yb + 0.2, z + 0.02], 0.032, BLUE_DARK, { seg: 5 });
  rod(gun, [x + 0.16, yb + 0.2, z + 0.02], [mx + 0.01, my - 0.035, z + 0.07], 0.03, BLUE_DARK, { seg: 5 });
  rod(gun, [x - 0.12, yb + 0.28, z], [x - 0.09, yb + 0.2, z + 0.13], 0.032, BLUE_DARK, { seg: 5 });
  rod(gun, [x - 0.09, yb + 0.2, z + 0.13], [mx - 0.01, my - 0.035, z + 0.24], 0.03, BLUE_DARK, { seg: 5 });
  gun.sphere({ r: 0.032, detail: 0, at: [mx + 0.01, my - 0.035, z + 0.08], color: SKIN });
  gun.sphere({ r: 0.032, detail: 0, at: [mx - 0.01, my - 0.035, z + 0.25], color: SKIN });
  // Muskete: Kolben, Schaft, langer Lauf
  gun.box({ size: [0.05, 0.075, 0.17], at: [mx, my - 0.02, z - 0.03], rot: [-0.12, 0, 0], color: WOOD, colorTop: WOOD_LIGHT });
  gun.box({ size: [0.045, 0.04, 0.3], at: [mx, my - 0.005, z + 0.19], color: WOOD, colorTop: WOOD_LIGHT });
  rod(gun, [mx, my + 0.012, z + 0.1], [mx, my + 0.012, z + 0.5], 0.019, IRON_LIGHT, { seg: 5 });
  const muzzle = /** @type {Vec3} */ ([mx, my + 0.012, z + 0.51]);
  const flash = m.part(name + 'Flash', { parent: name + 'Gun', pivot: muzzle, minLevel });
  muzzleFlash(flash, muzzle, 0.06, 0.16);
  const smoke = m.part(name + 'Smoke', { parent: name + 'Gun', pivot: muzzle, minLevel });
  smokePuff(smoke, muzzle, 0.075);
  return muzzle;
}

/**
 * Bewegung eines Musketiers: Muskete schlägt zurück und hoch, die Figur lehnt sich zurück, Mündungsfeuer und Rauchwolke.
 * @param {PoseNode} fig
 * @param {PoseNode} gun
 * @param {PoseNode} flash
 * @param {PoseNode} smoke
 * @param {number} f Schusswert 1..0
 */
function animMusket(fig, gun, flash, smoke, f) {
  const k = f * f;
  gun.position.z -= k * 0.06;
  gun.rotation.x -= f * 0.3;
  fig.rotation.x -= k * 0.14;
  flash.scale.setScalar(Math.max(1e-3, smooth((f - 0.55) * 2.6) * SHRINK));
  const s = f > 0 ? 4 * f * (1 - f) : 0;
  smoke.scale.setScalar(Math.max(1e-3, s * 1.2 * SHRINK));
  smoke.position.z += (1 - f) * 0.12;
  smoke.position.y += (1 - f) * 0.08;
}

/**
 * Schanzkorb aus Weidengeflecht mit Erdfüllung.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} h
 */
function gabion(p, x, y, z, h) {
  p.cyl({ r: 0.064, rTop: 0.07, h, seg: 6, base: [x, y, z], color: WICKER, colorTop: WICKER_LIGHT, faceJitter: 0.1 });
  p.cyl({ r: 0.06, h: 0.03, seg: 6, base: [x, y + h - 0.022, z], color: SOIL, colorTop: '#b8966a' });
}

/**
 * Kleines Fass, stehend.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {number} h
 * @param {string} hoop
 */
function keg(p, x, y, z, r, h, hoop) {
  p.lathe({ points: [[0, 0], [r * 0.85, 0], [r, h * 0.5], [r * 0.85, h], [0, h]], seg: 7, base: [x, y, z], color: WOOD, colorTop: WOOD_LIGHT });
  p.cyl({ r: r * 0.93, h: 0.022, seg: 7, open: true, base: [x, y + h * 0.18, z], color: hoop });
  p.cyl({ r: r * 0.93, h: 0.022, seg: 7, open: true, base: [x, y + h * 0.78, z], color: hoop });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Musketier im blauen Rock mit Dreispitz auf einem Erdwall hinter Schanzkörben, dahinter ein gestreiftes Schilderhaus.
  // Stufe 2 setzt eine blaue Fahne hinter den Musketier und stellt Pulverfässer dazu, Stufe 3 bringt einen knienden zweiten Musketier.
  'tower.entdecker.schuetze': () => {
    const m = createModel('tower.entdecker.schuetze');
    const FY = 0.44;
    const base = plinth(m, BLUE);
    // Erdwall mit Plankenboden, auf dem der Musketier steht
    base.cyl({ r: 0.25, rTop: 0.21, h: FY - TOP - 0.012, seg: 8, base: [0, TOP - 0.01, 0], color: SOIL, colorTop: '#c4a574' });
    base.cyl({ r: 0.215, h: 0.016, seg: 8, base: [0, FY - 0.016, 0], color: DECK, colorTop: DECK_LIGHT });
    // Schanzkörbe im Halbkreis vorn
    for (let i = 0; i < 7; i++) {
      const a = -1.75 + (i * 3.5) / 6;
      gabion(base, Math.sin(a) * 0.33, TOP - 0.005, Math.cos(a) * 0.33, 0.17);
    }
    // Schilderhaus hinten rechts, weiß mit blauen Streifen und blauem Dach (niedrig genug, dass die Musketen darüber schwenken)
    const SX = 0.255;
    const SZ = -0.245;
    const SH = 0.255;
    base.box({ size: [0.17, SH, 0.17], base: [SX, TOP, SZ], color: CREAM });
    for (const d of [-0.045, 0.045]) {
      base.box({ size: [0.036, SH, 0.18], base: [SX + d, TOP, SZ], color: BLUE });
      base.box({ size: [0.18, SH, 0.036], base: [SX, TOP, SZ + d], color: BLUE });
    }
    base.box({ size: [0.09, 0.19, 0.01], base: [SX, TOP, SZ + 0.091], color: DOOR });
    base.pyramid({ size: [0.24, 0.09, 0.24], base: [SX, TOP + SH, SZ], color: BLUE_DARK, colorTop: BLUE_LIGHT });

    // Zielendes Teil: die Musketiere
    m.part('crew', { pivot: [0, FY, 0] });
    const muzzle = musketeer(m, 'shooterA', 'crew', 0, FY, -0.03, false, 1);
    musketeer(m, 'shooterB', 'crew', 0.1, FY, 0.0, true, 3);

    // Stufe 2: Fahne hinter dem Musketier (dreht mit, damit die Musketen nie durch die Stange schwenken), Pulverfässer hinten links
    tier2(m, BLUE);
    const kegs = m.part('kegs2', { minLevel: 2 });
    keg(kegs, -0.22, TOP, -0.23, 0.075, 0.15, IRON);
    keg(kegs, -0.06, TOP, -0.33, 0.06, 0.12, IRON);
    const PX = -0.17;
    const PZ = -0.15;
    const pole = m.part('pole2', { parent: 'crew', pivot: [PX, FY, PZ], minLevel: 2 });
    rod(pole, [PX, FY, PZ], [PX, FY + 0.78, PZ], 0.02, WOOD_DARK, { seg: 5 });
    pole.sphere({ r: 0.032, detail: 0, at: [PX, FY + 0.8, PZ], color: GOLD });
    const flag = m.part('flag2', { parent: 'pole2', pivot: [PX, FY + 0.76, PZ], minLevel: 2 });
    flag.extrude({ points: [[0, 0], [-0.26, 0], [-0.26, -0.17], [0, -0.17]], depth: 0.02, at: [PX, FY + 0.77, PZ], color: BLUE, colorTop: BLUE_LIGHT });
    flag.box({ size: [0.26, 0.04, 0.026], at: [PX - 0.13, FY + 0.685, PZ], color: CREAM });

    tier3(m, BLUE);

    m.point('muzzle', muzzle, 'shooterAGun');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'crew');
        animMusket(pose.shooterA, pose.shooterAGun, pose.shooterAFlash, pose.shooterASmoke, ctx.fire);
        if (ctx.level >= 3) {
          // Abwechselnde Salve: der Kniende schießt in der Mitte des Nachladens.
          pose.shooterA.position.x -= 0.1;
          const c = ctx.charge;
          const fb = c > 0.45 && c < 0.8 ? 1 - (c - 0.45) / 0.35 : 0;
          animMusket(pose.shooterB, pose.shooterBGun, pose.shooterBFlash, pose.shooterBSmoke, fb);
        }
        if (ctx.level >= 2) pose.flag2.rotation.y = Math.sin((ctx.t * 0.6 + ctx.seed) * TAU) * 0.3 - 0.5;
      },
    });
  },

  // Werfer: Mörser. Gedrungenes Bronzerohr, 60 Grad steil auf einem Holzbett in einem Erdwall, Bombenpyramide dahinter.
  'tower.entdecker.werfer': () => {
    const m = createModel('tower.entdecker.werfer');
    const base = plinth(m, ORANGE);
    // Erdwall als Hufeisen, hinten offen für die Bomben
    base.torus({ r: 0.345, tube: 0.07, seg: 12, tubeSeg: 4, arc: Math.PI * 1.5, at: [0, TOP + 0.01, 0], rot: [0, Math.PI / 4, 0], scale: [1, 0.75, 1], color: SOIL, colorTop: TURF });
    for (const [x, y, z] of [[-0.12, 0, -0.32], [0, 0, -0.345], [0.12, 0, -0.32], [-0.06, 0.09, -0.33], [0.06, 0.09, -0.33]]) {
      base.sphere({ r: 0.058, detail: 0, at: [x, TOP + 0.058 + y, z], color: IRON, colorTop: IRON_LIGHT });
    }

    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    yaw.box({ size: [0.3, 0.1, 0.36], base: [0, TOP, 0], color: WOOD_DARK, colorTop: WOOD });
    for (const s of [-1, 1]) {
      yaw.box({ size: [0.065, 0.21, 0.3], base: [s * 0.13, TOP + 0.06, -0.01], color: ORANGE, colorTop: ORANGE_LIGHT });
      yaw.box({ size: [0.075, 0.03, 0.31], base: [s * 0.13, TOP + 0.27, -0.01], color: WOOD_DARK });
    }
    // Rohr: um die Schildzapfen gekippt, 30 Grad aus der Senkrechten nach vorn
    const TH = 0.52;
    const P = /** @type {Vec3} */ ([0, TOP + 0.26, 0]);
    const dy = Math.cos(TH);
    const dz = Math.sin(TH);
    /** @param {number} s @returns {Vec3} */
    const along = (s) => [0, P[1] - 0.13 * dy + s * dy, P[2] - 0.13 * dz + s * dz];
    const barrel = m.part('barrel', { parent: 'yaw', pivot: P });
    barrel.lathe({
      points: [[0, 0], [0.08, 0], [0.118, 0.045], [0.122, 0.13], [0.112, 0.26], [0.122, 0.36], [0.15, 0.38], [0.15, 0.43], [0.098, 0.43], [0.094, 0.37], [0, 0.37]],
      seg: 10, base: along(0), rot: [TH, 0, 0], color: BRONZE, colorTop: BRONZE_LIGHT,
    });
    barrel.cyl({ r: 0.048, h: 0.36, seg: 6, at: P, rot: [0, 0, HALF], color: BRONZE_DARK });
    // Bombe mit glimmender Lunte im Rohr
    const bomb = m.part('bomb', { parent: 'barrel', pivot: along(0.4) });
    bomb.sphere({ r: 0.088, detail: 0, at: along(0.42), color: IRON, colorTop: IRON_LIGHT });
    bomb.cone({ r: 0.022, h: 0.065, seg: 4, at: along(0.53), rot: [TH, 0, 0], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    const flash = m.part('flash', { parent: 'barrel', pivot: along(0.46) });
    flash.sphere({ r: 0.13, detail: 0, at: along(0.5), color: FLASH, colorTop: FLASH_LIGHT, glow: true });
    const ring = m.part('ring', { parent: 'barrel', pivot: along(0.46) });
    ring.torus({ r: 0.11, tube: 0.035, seg: 9, tubeSeg: 4, at: along(0.46), rot: [TH, 0, 0], color: SMOKE });

    // Stufe 2: Verstärkungsringe und oranger Streifen am Rohr
    tier2(m, ORANGE);
    const bands = m.part('bands2', { parent: 'barrel', pivot: P, minLevel: 2 });
    bands.torus({ r: 0.124, tube: 0.022, seg: 10, tubeSeg: 4, at: along(0.08), rot: [TH, 0, 0], color: BRONZE_DARK });
    bands.torus({ r: 0.124, tube: 0.022, seg: 10, tubeSeg: 4, at: along(0.2), rot: [TH, 0, 0], color: BRONZE_DARK });
    bands.cyl({ r: 0.126, h: 0.06, seg: 10, at: along(0.31), rot: [TH, 0, 0], color: ORANGE, shade: 0 });

    // Stufe 3: Schanzkörbe auf dem Wall
    tier3(m, ORANGE);
    const gab = m.part('gabions3', { minLevel: 3 });
    for (const a of [-1.9, -1.1, -0.35, 0.35, 1.1, 1.9]) gabion(gab, Math.sin(a) * 0.35, TOP + 0.04, Math.cos(a) * 0.35, 0.17);

    m.point('muzzle', along(0.46), 'barrel');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        const k = f * f;
        if (ctx.level >= 3) pose.barrel.scale.set(1.18, 1.05, 1.18);
        // Rückstoß ins Bett, die ganze Lafette hüpft
        pose.barrel.position.y -= k * 0.07 * dy;
        pose.barrel.position.z -= k * 0.07 * dz;
        pose.yaw.position.y += Math.sin(f * Math.PI) * 0.035;
        pose.bomb.scale.setScalar(Math.max(1e-3, smooth((ctx.charge - 0.55) * 4)));
        pose.flash.scale.setScalar(Math.max(1e-3, smooth((f - 0.5) * 2.2) * 1.2));
        const u = 1 - f;
        const rs = f > 0.05 ? (0.6 + u * 0.8) * smooth(f * 4) : 0;
        pose.ring.scale.set(Math.max(1e-3, rs), Math.max(1e-3, rs * 0.7), Math.max(1e-3, rs));
        pose.ring.position.y += f > 0 ? u * 0.2 : 0;
        pose.ring.position.z += f > 0 ? u * 0.1 : 0;
      },
    });
  },

  // Bremser: Sirupfass. Liegendes Melassefass mit türkisen Reifen auf einer Wiege, Messinghahn mit Tropfen,
  // Handpumpe mit Wippschwengel und eine drehbare Messingdüse oben auf dem Fass.
  'tower.entdecker.bremser': () => {
    const m = createModel('tower.entdecker.bremser');
    const base = plinth(m, TEAL);
    const CZ = 0.06;
    const CY = TOP + 0.24;
    const R = 0.2;
    for (const x of [-0.16, 0.16]) base.box({ size: [0.08, 0.08, 0.36], base: [x, TOP - 0.005, CZ], color: WOOD_DARK, colorTop: WOOD });
    // Fass liegt entlang X
    const cask = m.part('cask', { pivot: [0, TOP, CZ] });
    cask.lathe({ points: [[0, -0.25], [0.17, -0.25], [0.195, -0.13], [R, 0], [0.195, 0.13], [0.17, 0.25], [0, 0.25]], seg: 10, at: [0, CY, CZ], rot: [0, 0, HALF], color: WOOD_LIGHT, shade: 0 });
    for (const x of [-0.19, -0.07, 0.07, 0.19]) {
      const r = Math.abs(x) > 0.1 ? 0.19 : 0.205;
      cask.cyl({ r, h: 0.036, seg: 10, at: [x, CY, CZ], rot: [0, 0, HALF], color: TEAL, shade: 0 });
    }
    for (const s of [-1, 1]) cask.cyl({ r: 0.15, h: 0.012, seg: 10, at: [s * 0.252, CY, CZ], rot: [0, 0, HALF], color: WOOD_DARK, shade: 0 });
    // Hahn am rechten Fassboden, darunter die glänzende Pfütze
    cask.box({ size: [0.07, 0.045, 0.045], at: [0.28, CY - 0.07, CZ], color: BRONZE, colorTop: BRONZE_LIGHT });
    cask.cyl({ r: 0.02, h: 0.06, seg: 5, at: [0.31, CY - 0.1, CZ], color: BRONZE });
    cask.box({ size: [0.02, 0.06, 0.02], at: [0.28, CY - 0.03, CZ], color: BRONZE_DARK });
    base.sphere({ r: 0.1, detail: 1, at: [0.29, TOP + 0.006, CZ + 0.02], scale: [1, 0.12, 1.2], color: SYRUP, colorTop: SYRUP_SHINE });
    const drip = m.part('drip', { pivot: [0.31, CY - 0.13, CZ] });
    drip.sphere({ r: 0.028, detail: 0, at: [0.31, CY - 0.15, CZ], scale: [1, 1.4, 1], color: SYRUP, colorTop: SYRUP_SHINE });

    // Handpumpe hinten mit Schwengel
    const PZ = -0.27;
    const PH = TOP + 0.42;
    base.cyl({ r: 0.05, rTop: 0.045, h: PH - TOP, seg: 7, base: [0, TOP, PZ], color: BRONZE_DARK, colorTop: BRONZE });
    base.cyl({ r: 0.06, h: 0.03, seg: 7, base: [0, TOP + 0.1, PZ], color: TEAL });
    rod(base, [0, TOP + 0.2, PZ], [0, CY + 0.05, CZ - 0.17], 0.025, BRONZE_DARK, { seg: 5 });
    const lever = m.part('lever', { pivot: [0, PH + 0.02, PZ] });
    lever.box({ size: [0.42, 0.035, 0.04], at: [0, PH + 0.03, PZ], color: WOOD, colorTop: WOOD_LIGHT });
    lever.box({ size: [0.07, 0.05, 0.05], at: [0.2, PH + 0.03, PZ], color: TEAL, mirror: true });
    lever.box({ size: [0.04, 0.06, 0.05], at: [0, PH + 0.0, PZ], color: BRONZE_DARK });

    // Drehbare Messingdüse oben auf dem Fass
    const NY = CY + R;
    const nozzle = m.part('nozzle', { pivot: [0, NY, CZ] });
    nozzle.cyl({ r: 0.09, rTop: 0.08, h: 0.06, seg: 8, base: [0, NY - 0.025, CZ], color: BRONZE_DARK, colorTop: BRONZE });
    nozzle.dome({ r: 0.075, seg: 8, rings: 2, at: [0, NY + 0.035, CZ], color: BRONZE, colorTop: BRONZE_LIGHT });
    nozzle.cyl({ r: 0.06, h: 0.025, seg: 8, base: [0, NY + 0.035, CZ], color: TEAL });
    /**
     * Ein Düsenrohr mit Trichter.
     * @param {PartBuilder} p
     * @param {number} x
     * @returns {Vec3} Mündung
     */
    const pipe = (p, x) => {
      const tip = /** @type {Vec3} */ ([x, NY + 0.2, CZ + 0.3]);
      rod(p, [x, NY + 0.06, CZ], tip, 0.038, BRONZE, { seg: 6, colorTop: BRONZE_LIGHT });
      rod(p, [x, NY + 0.19, CZ + 0.28], [x, NY + 0.22, CZ + 0.37], 0.04, BRONZE_LIGHT, { rTop: 0.07, seg: 8 });
      return [x, NY + 0.225, CZ + 0.38];
    };
    const one = m.part('pipe1', { parent: 'nozzle', pivot: [0, NY, CZ], maxLevel: 2 });
    const muzzle = pipe(one, 0);
    const glob = m.part('glob', { parent: 'nozzle', pivot: muzzle });
    glob.sphere({ r: 0.05, detail: 0, at: [0, muzzle[1] + 0.01, muzzle[2] + 0.02], color: SYRUP, colorTop: SYRUP_SHINE });

    // Stufe 2: zweites Fass hinten rechts
    tier2(m, TEAL);
    const keg2 = m.part('keg2', { minLevel: 2 });
    keg(keg2, 0.22, TOP, -0.23, 0.09, 0.22, TEAL);
    keg2.cyl({ r: 0.075, h: 0.012, seg: 8, base: [0.22, TOP + 0.22, -0.23], color: SYRUP, colorTop: SYRUP_SHINE });

    // Stufe 3: Kupferkessel hinten links und Doppeldüse
    tier3(m, TEAL);
    // Kupferkessel auf einem gemauerten Herd, mit Rohr zum Fass
    const KX = -0.22;
    const KZ = -0.24;
    const k3 = m.part('kettle3', { minLevel: 3 });
    k3.box({ size: [0.2, 0.17, 0.2], base: [KX, TOP - 0.005, KZ], color: SAND_DARK, colorTop: SAND });
    k3.box({ size: [0.08, 0.06, 0.012], at: [KX + 0.02, TOP + 0.06, KZ + 0.1], color: EMBER, glow: true });
    k3.lathe({ points: [[0, 0], [0.08, 0], [0.11, 0.06], [0.1, 0.13], [0.06, 0.16], [0.03, 0.21], [0, 0.21]], seg: 9, base: [KX, TOP + 0.16, KZ], color: COPPER, colorTop: COPPER_LIGHT });
    rod(k3, [KX + 0.03, TOP + 0.36, KZ + 0.02], [-0.1, CY + R - 0.02, CZ - 0.12], 0.024, COPPER, { seg: 5 });
    const twin = m.part('pipe3', { parent: 'nozzle', pivot: [0, NY, CZ], minLevel: 3 });
    pipe(twin, -0.068);
    pipe(twin, 0.068);

    m.point('muzzle', muzzle, 'nozzle');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'nozzle');
        const f = ctx.fire;
        // Düse ruckt beim Schuss hoch, der Klecks am Trichter wächst beim Pumpen
        pose.nozzle.rotation.x -= f * f * 0.18;
        pose.nozzle.position.y += f * f * 0.015;
        pose.glob.scale.setScalar(Math.max(1e-3, smooth((ctx.charge - 0.4) * 2.5) * (ctx.level >= 3 ? 1.3 : 1)));
        const rate = 0.6 + 1.2 * ctx.active;
        pose.lever.rotation.z = Math.sin((ctx.t * rate + ctx.seed) * TAU) * 0.28 + f * 0.2;
        // Tropfen am Hahn wächst, fällt und beginnt von vorn
        const d = (ctx.t * 0.55 + ctx.seed) % 1;
        const grow = smooth(d * 1.6);
        const fall = d > 0.65 ? (d - 0.65) / 0.35 : 0;
        pose.drip.scale.setScalar(Math.max(1e-3, grow * (1 - smooth((fall - 0.7) * 3.3))));
        pose.drip.position.y -= fall * fall * 0.2;
        pose.cask.scale.y = 1 + Math.sin(ctx.t * 2.2 + ctx.seed * 5) * 0.006;
      },
    });
  },

  // Panzerknacker: Feldschlange. Sehr langes, schlankes Bronzerohr auf einer hohen zweirädrigen Lafette,
  // Kanonier im violetten Rock mit Luntenstock. Beim Schuss rollt die Lafette zurück.
  'tower.entdecker.knacker': () => {
    const m = createModel('tower.entdecker.knacker');
    plinth(m, VIOLET);
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    yaw.cyl({ r: 0.3, h: 0.012, seg: 10, base: [0, TOP + 0.004, -0.04], color: DECK, colorTop: DECK_LIGHT });

    const AY = TOP + 0.165;
    const AZ = 0.06;
    const GY = AY + 0.14;
    const GZ = 0.06;
    const car = m.part('carriage', { parent: 'yaw', pivot: [0, TOP, 0] });
    for (const s of [-1, 1]) {
      beam(car, [s * 0.085, GY - 0.05, GZ + 0.08], [s * 0.06, TOP + 0.035, -0.34], 0.05, 0.08, WOOD, WOOD_LIGHT);
      beam(car, [s * 0.085, GY - 0.005, GZ + 0.08], [s * 0.06, TOP + 0.08, -0.34], 0.054, 0.02, VIOLET);
    }
    car.box({ size: [0.16, 0.06, 0.06], at: [0, TOP + 0.07, -0.28], color: WOOD_DARK });
    car.box({ size: [0.2, 0.07, 0.08], at: [0, AY + 0.02, AZ], color: WOOD_DARK });
    car.cyl({ r: 0.024, h: 0.46, seg: 6, at: [0, AY, AZ], rot: [0, 0, HALF], color: IRON });
    /**
     * Speichenrad.
     * @param {string} name
     * @param {number} x
     */
    const wheel = (name, x) => {
      const w = m.part(name, { parent: 'carriage', pivot: [x, AY, AZ] });
      w.torus({ r: 0.15, tube: 0.03, seg: 12, tubeSeg: 4, at: [x, AY, AZ], rot: [0, 0, HALF], color: WOOD_DARK, colorTop: WOOD });
      for (let i = 0; i < 3; i++) w.box({ size: [0.03, 0.29, 0.032], at: [x, AY, AZ], rot: [(i * Math.PI) / 3, 0, 0], color: WOOD });
      w.cyl({ r: 0.045, h: 0.075, seg: 7, at: [x, AY, AZ], rot: [0, 0, HALF], color: VIOLET_DARK, shade: 0 });
    };
    wheel('wheelL', -0.21);
    wheel('wheelR', 0.21);

    // Langes Rohr mit Ringen
    const gun = m.part('gun', { parent: 'carriage', pivot: [0, GY, GZ] });
    rod(gun, [0, GY, -0.25], [0, GY, 0.49], 0.06, BRONZE, { rTop: 0.038, seg: 8, colorTop: BRONZE_LIGHT });
    gun.cyl({ r: 0.05, h: 0.2, seg: 6, at: [0, GY, GZ], rot: [0, 0, HALF], color: BRONZE_DARK });
    for (const [z, r] of [[-0.2, 0.066], [-0.05, 0.06], [0.3, 0.048], [0.47, 0.05]]) {
      gun.torus({ r, tube: 0.018, seg: 9, tubeSeg: 4, at: [0, GY, z], rot: [HALF, 0, 0], color: BRONZE_DARK });
    }
    gun.cyl({ r: 0.052, rTop: 0.046, h: 0.04, seg: 8, at: [0, GY, 0.5], rot: [HALF, 0, 0], color: BRONZE_LIGHT });
    gun.cyl({ r: 0.028, h: 0.01, seg: 6, at: [0, GY, 0.522], rot: [HALF, 0, 0], color: DARK });
    gun.sphere({ r: 0.042, detail: 0, at: [0, GY, -0.285], color: BRONZE_DARK });
    const flash = m.part('flash', { parent: 'gun', pivot: [0, GY, 0.53] });
    muzzleFlash(flash, [0, GY, 0.53], 0.08, 0.2);
    const smoke = m.part('smoke', { parent: 'gun', pivot: [0, GY, 0.53] });
    smokePuff(smoke, [0, GY, 0.53], 0.09);

    // Kanonier mit Luntenstock links hinten, blickt zum Verschluss
    const KX = -0.29;
    const KZ = -0.2;
    const gunner = m.part('gunner', { parent: 'yaw', pivot: [KX, TOP, KZ] });
    person(gunner, KX, TOP, KZ, { coat: VIOLET_DARK, coatTop: VIOLET, hatColor: HAT, trim: GOLD });
    rod(gunner, [KX - 0.12, TOP + 0.28, KZ], [KX - 0.14, TOP + 0.15, KZ + 0.02], 0.03, VIOLET_DARK, { seg: 5 });
    const stick = m.part('linstock', { parent: 'gunner', pivot: [KX + 0.15, TOP + 0.2, KZ + 0.06] });
    rod(stick, [KX + 0.12, TOP + 0.28, KZ], [KX + 0.15, TOP + 0.2, KZ + 0.06], 0.03, VIOLET_DARK, { seg: 5 });
    stick.sphere({ r: 0.03, detail: 0, at: [KX + 0.15, TOP + 0.2, KZ + 0.06], color: SKIN });
    rod(stick, [KX + 0.15, TOP + 0.05, KZ + 0.06], [KX + 0.15, TOP + 0.56, KZ + 0.06], 0.017, WOOD_DARK, { seg: 4 });
    stick.box({ size: [0.07, 0.025, 0.025], at: [KX + 0.15, TOP + 0.56, KZ + 0.06], color: IRON });
    const match = m.part('match', { parent: 'linstock', pivot: [KX + 0.15, TOP + 0.59, KZ + 0.06] });
    match.cone({ r: 0.028, h: 0.07, seg: 5, base: [KX + 0.15, TOP + 0.575, KZ + 0.06], color: EMBER, colorTop: EMBER_LIGHT, glow: true });

    // Stufe 2: Delfinhenkel am Rohr, violette Fahne hinten rechts
    tier2(m, VIOLET);
    const handles = m.part('handles2', { parent: 'gun', pivot: [0, GY, GZ], minLevel: 2 });
    for (const z of [0.02, 0.12]) handles.torus({ r: 0.04, tube: 0.016, seg: 6, tubeSeg: 3, arc: Math.PI, at: [0, GY + 0.05, z], rot: [HALF, 0, 0], color: BRONZE_LIGHT });
    const pole = m.part('pole2', { parent: 'yaw', pivot: [0.29, TOP, -0.2], minLevel: 2 });
    rod(pole, [0.29, TOP, -0.2], [0.29, TOP + 0.86, -0.2], 0.02, WOOD_DARK, { seg: 5 });
    pole.sphere({ r: 0.03, detail: 0, at: [0.29, TOP + 0.875, -0.2], color: GOLD });
    const flag = m.part('flag2', { parent: 'pole2', pivot: [0.29, TOP + 0.84, -0.2], minLevel: 2 });
    flag.extrude({ points: [[0, 0], [0.21, 0], [0.155, -0.065], [0.21, -0.13], [0, -0.13]], depth: 0.02, at: [0.29, TOP + 0.85, -0.2], rot: [0, -HALF, 0], color: VIOLET, colorTop: VIOLET_LIGHT });

    // Stufe 3: längeres Rohr (Skalierung im animate) und Munitionskiste mit Kugeln
    tier3(m, VIOLET);
    const box3 = m.part('limber3', { parent: 'yaw', pivot: [0.22, TOP, -0.29], minLevel: 3 });
    box3.box({ size: [0.17, 0.11, 0.12], base: [0.2, TOP, -0.3], color: WOOD, colorTop: WOOD_LIGHT });
    box3.box({ size: [0.18, 0.025, 0.13], base: [0.2, TOP + 0.11, -0.3], color: VIOLET });
    for (const x of [0.16, 0.24]) box3.sphere({ r: 0.04, detail: 0, at: [x, TOP + 0.17, -0.3], color: IRON, colorTop: IRON_LIGHT });

    m.point('muzzle', [0, GY, 0.53], 'gun');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw', 'gun', 0.25);
        const f = ctx.fire;
        if (ctx.level >= 3) pose.gun.scale.z = 1.13;
        // Die Lafette rollt beim Schuss zurück und kommt langsam wieder; die Räder drehen mit.
        const u = 1 - f;
        const back = f > 0 ? 0.1 * smooth(u / 0.12) * (1 - smooth((u - 0.12) / 0.88)) : 0;
        pose.carriage.position.z -= back;
        pose.wheelL.rotation.x -= back / 0.18;
        pose.wheelR.rotation.x -= back / 0.18;
        pose.gun.rotation.x -= f * f * 0.12;
        pose.flash.scale.setScalar(Math.max(1e-3, smooth((f - 0.55) * 2.6) * 1.1 * SHRINK));
        const s = f > 0 ? 4 * f * u : 0;
        pose.smoke.scale.setScalar(Math.max(1e-3, s * 1.3 * SHRINK));
        pose.smoke.position.z += u * 0.15;
        pose.smoke.position.y += u * 0.08;
        // Ausholen: der Kanonier senkt den Luntenstock zum Zündloch, kurz bevor der Schuss bricht.
        pose.gunner.rotation.y = 1.15;
        const wind = smooth((ctx.charge - 0.6) / 0.35) * (1 - smooth(f * 3));
        pose.linstock.rotation.x = wind * 0.95;
        pose.linstock.rotation.z = -wind * 0.15;
        pose.gunner.rotation.x = wind * 0.1;
        const flick = Math.sin(ctx.t * 13 + ctx.seed * 9) * 0.15 + Math.sin(ctx.t * 19.7) * 0.1;
        pose.match.scale.setScalar(0.9 + flick + wind * 0.3);
        if (ctx.level >= 2) pose.flag2.rotation.y = Math.sin((ctx.t * 0.7 + ctx.seed) * TAU) * 0.3;
      },
    });
  },

  // Brenner: Feuerwerker. Messingbeschlagene Kiste mit kurzen Raketenrohren im Fächer, Feuerwerker im roten Rock mit Lunte.
  'tower.entdecker.brenner': () => {
    const m = createModel('tower.entdecker.brenner');
    plinth(m, RED);
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    const BZ = 0.1;
    const BH = 0.17;
    yaw.box({ size: [0.42, BH, 0.26], base: [0, TOP, BZ], color: WOOD, colorTop: WOOD_LIGHT });
    for (const s of [-1, 1]) yaw.box({ size: [0.035, BH + 0.01, 0.27], base: [s * 0.2, TOP, BZ], color: BRONZE, colorTop: BRONZE_LIGHT });
    yaw.box({ size: [0.43, 0.03, 0.035], at: [0, TOP + BH - 0.02, BZ + 0.125], color: BRONZE, colorTop: BRONZE_LIGHT });
    yaw.box({ size: [0.43, 0.03, 0.035], at: [0, TOP + BH - 0.02, BZ - 0.125], color: BRONZE, colorTop: BRONZE_LIGHT });
    const TY = TOP + BH;
    const TILT = 0.85;
    /**
     * Raketenrohre im Fächer.
     * @param {PartBuilder} p
     * @param {number[]} angles
     * @param {boolean} sparks
     */
    const tubes = (p, angles, sparks) => {
      angles.forEach((phi, i) => {
        const d = /** @type {Vec3} */ ([Math.sin(TILT) * Math.sin(phi), Math.cos(TILT), Math.sin(TILT) * Math.cos(phi)]);
        const b = /** @type {Vec3} */ ([phi * 0.26, TY - 0.03, BZ + 0.03]);
        /** @param {number} s @returns {Vec3} */
        const at = (s) => [b[0] + d[0] * s, b[1] + d[1] * s, b[2] + d[2] * s];
        if (sparks) {
          const c = i % 3 === 0 ? EMBER : i % 3 === 1 ? RED_LIGHT : GOLD;
          rod(p, at(0.24), at(0.5), 0.04, c, { rTop: 0.008, seg: 5, colorTop: i % 2 === 0 ? FLASH_LIGHT : EMBER_LIGHT, glow: true });
        } else {
          rod(p, b, at(0.24), 0.042, RED_DARK, { seg: 7, colorTop: RED_LIGHT });
          rod(p, at(0.2), at(0.225), 0.047, CREAM, { seg: 7 });
          rod(p, at(0.236), at(0.242), 0.03, DARK, { seg: 6 });
        }
      });
    };
    tubes(yaw, [-0.5, -0.25, 0, 0.25, 0.5], false);
    const sparks = m.part('sparks', { parent: 'yaw', pivot: [0, TY + 0.2, BZ + 0.2] });
    tubes(sparks, [-0.5, -0.25, 0, 0.25, 0.5], true);

    // Feuerwerker hinter der Kiste mit glimmender Lunte
    const FX = -0.05;
    const FZ = -0.2;
    const fig = m.part('figure', { parent: 'yaw', pivot: [FX, TOP, FZ] });
    person(fig, FX, TOP, FZ, { coat: RED_DARK, coatTop: RED, hat: 'tricorne', trim: GOLD });
    rod(fig, [FX - 0.12, TOP + 0.28, FZ], [FX - 0.15, TOP + 0.16, FZ + 0.03], 0.03, RED_DARK, { seg: 5 });
    const arm = m.part('arm', { parent: 'figure', pivot: [FX + 0.12, TOP + 0.28, FZ] });
    rod(arm, [FX + 0.12, TOP + 0.28, FZ], [FX + 0.16, TOP + 0.25, FZ + 0.16], 0.03, RED_DARK, { seg: 5 });
    arm.sphere({ r: 0.03, detail: 0, at: [FX + 0.16, TOP + 0.25, FZ + 0.17], color: SKIN });
    rod(arm, [FX + 0.16, TOP + 0.22, FZ + 0.1], [FX + 0.17, TOP + 0.33, FZ + 0.33], 0.016, WOOD_DARK, { seg: 4 });
    const pilot = m.part('pilot', { parent: 'arm', pivot: [FX + 0.17, TOP + 0.335, FZ + 0.34] });
    pilot.sphere({ r: 0.03, detail: 0, at: [FX + 0.17, TOP + 0.335, FZ + 0.34], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    pilot.cone({ r: 0.022, h: 0.06, seg: 5, base: [FX + 0.17, TOP + 0.35, FZ + 0.34], color: EMBER, colorTop: EMBER_LIGHT, glow: true });

    // Stufe 2: sieben Rohre, Raketenbündel im Eimer hinten rechts
    tier2(m, RED);
    const t2 = m.part('tubes2', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 2 });
    tubes(t2, [-0.72, 0.72], false);
    const s2 = m.part('sparks2', { parent: 'sparks', pivot: [0, TY + 0.2, BZ + 0.2], minLevel: 2 });
    tubes(s2, [-0.72, 0.72], true);
    t2.cyl({ r: 0.07, rTop: 0.08, h: 0.12, seg: 7, base: [0.2, TOP, -0.2], color: WOOD_DARK, colorTop: WOOD });
    for (const [x, z, h] of [[0.18, -0.21, 0.42], [0.23, -0.18, 0.36], [0.21, -0.24, 0.32]]) {
      rod(t2, [x, TOP + 0.05, z], [x, TOP + h, z], 0.015, WOOD_LIGHT, { seg: 4 });
      t2.cyl({ r: 0.032, h: 0.1, seg: 6, base: [x, TOP + h, z], color: RED, colorTop: RED_LIGHT });
      t2.cone({ r: 0.034, h: 0.06, seg: 6, base: [x, TOP + h + 0.1, z], color: GOLD, colorTop: GOLD_LIGHT });
    }

    // Stufe 3: Feuerrad auf einer Stange über der Kiste
    tier3(m, RED);
    const WY = TOP + 0.8;
    const WZ = BZ - 0.08;
    const WX = -0.2;
    const st = m.part('stand3', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 3 });
    rod(st, [WX, TY, WZ - 0.03], [WX, WY, WZ - 0.03], 0.024, WOOD_DARK, { seg: 5 });
    const wheel = m.part('wheel3', { parent: 'yaw', pivot: [WX, WY, WZ], minLevel: 3 });
    wheel.torus({ r: 0.13, tube: 0.026, seg: 10, tubeSeg: 4, at: [WX, WY, WZ], rot: [HALF, 0, 0], color: RED, colorTop: RED_LIGHT });
    for (let i = 0; i < 2; i++) wheel.box({ size: [0.03, 0.26, 0.026], at: [WX, WY, WZ], rot: [0, 0, (i * Math.PI) / 2], color: WOOD_LIGHT });
    wheel.cyl({ r: 0.035, h: 0.05, seg: 7, at: [WX, WY, WZ], rot: [HALF, 0, 0], color: GOLD });
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4 + 0.4;
      const x = WX + Math.sin(a) * 0.13;
      const y = WY + Math.cos(a) * 0.13;
      wheel.box({ size: [0.045, 0.1, 0.045], at: [x, y, WZ], rot: [0, 0, -a + HALF], color: GOLD, colorTop: GOLD_LIGHT });
      wheel.cone({ r: 0.03, h: 0.08, seg: 5, at: [x + Math.cos(a) * 0.07, y - Math.sin(a) * 0.07, WZ], rot: [0, 0, -a - HALF], color: EMBER, colorTop: FLASH_LIGHT, glow: true });
    }

    m.point('muzzle', [0, TY + 0.2, BZ + 0.26], 'yaw');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        const flick = Math.sin(ctx.t * 13 + ctx.seed * 9) * 0.15 + Math.sin(ctx.t * 19.7) * 0.1;
        // Funkenfächer beim Stoß, flackernd
        const sp = f > 0.02 ? 0.55 + 0.6 * f + flick * 0.3 : 1e-3;
        pose.sparks.scale.setScalar(sp);
        // Die Lunte zündet: der Arm senkt sich zum Rohr, die Figur beugt sich vor
        const touch = smooth((ctx.charge - 0.75) * 5) * (1 - f) + f * 0.6;
        pose.arm.rotation.x = touch * 0.35;
        pose.figure.rotation.x = touch * 0.08 - f * 0.05;
        pose.pilot.scale.setScalar(0.9 + flick + f * 0.4);
        pose.yaw.position.y += Math.sin(f * Math.PI) * 0.01;
        if (ctx.level >= 3) pose.wheel3.rotation.z = -ctx.t * (2 + 6 * ctx.active) - f * 2;
      },
    });
  },

  // Taktgeber: Signalmast. Schiffsmast mit Ausguck, Rah mit Signalflaggen, Ausguck mit goldenem Fernrohr.
  'tower.entdecker.taktgeber': () => {
    const m = createModel('tower.entdecker.taktgeber');
    const base = plinth(m, GOLD);
    const NY = 1.12;
    const YY = 0.86;
    // Mast mit Fuß, Taurolle und Fässchen
    base.cyl({ r: 0.1, rTop: 0.08, h: 0.08, seg: 8, base: [0, TOP - 0.005, 0], color: WOOD_DARK, colorTop: WOOD });
    base.cyl({ r: 0.055, rTop: 0.042, h: NY - TOP + 0.02, seg: 7, base: [0, TOP, 0], color: WOOD, colorTop: WOOD_LIGHT });
    base.cyl({ r: 0.036, rTop: 0.028, h: 0.58, seg: 6, base: [0, NY, 0], color: WOOD, colorTop: WOOD_LIGHT });
    base.sphere({ r: 0.045, detail: 0, at: [0, NY + 0.6, 0], color: GOLD, colorTop: GOLD_LIGHT });
    base.torus({ r: 0.09, tube: 0.035, seg: 9, tubeSeg: 4, at: [0.2, TOP + 0.03, 0.17], color: ROPE });
    // Goldener Wimpel an der Mastspitze
    const pennant = m.part('pennant', { pivot: [0, NY + 0.54, 0], maxLevel: 2 });
    pennant.extrude({ points: [[0, 0.04], [0.36, 0.0], [0, -0.04]], depth: 0.018, at: [0, NY + 0.54, 0], rot: [0, -HALF, 0], color: GOLD, colorTop: GOLD_LIGHT });
    keg(base, -0.22, TOP, 0.16, 0.08, 0.17, IRON);
    // Wanten: zwei Taue je Seite vom Ausguck zum Sockelrand
    for (const s of [-1, 1]) {
      for (const z of [-0.12, 0.12]) rod(base, [s * 0.1, NY - 0.12, z * 0.4], [s * 0.34, TOP + 0.02, z], 0.014, ROPE, { seg: 3 });
    }
    // Rah mit Signalflaggen
    base.cyl({ r: 0.028, h: 0.74, seg: 6, at: [0, YY, 0.055], rot: [0, 0, HALF], color: WOOD_DARK });
    base.box({ size: [0.07, 0.06, 0.06], at: [0, YY, 0.04], color: WOOD_DARK });
    /**
     * Flaggenreihe an einer Rah: abwechselnd zwei Teile, damit sie gegenläufig flattern.
     * @param {string} nameA
     * @param {string} nameB
     * @param {number} y
     * @param {number[]} xs
     * @param {number} minLevel
     */
    const flags = (nameA, nameB, y, xs, minLevel) => {
      const pa = m.part(nameA, { pivot: [0, y, 0.055], minLevel });
      const pb = m.part(nameB, { pivot: [0, y, 0.055], minLevel });
      xs.forEach((x, i) => {
        const p = i % 2 === 0 ? pa : pb;
        const c = [GOLD, AGE_RED, CREAM, AGE_TEAL, GOLD][i % 5];
        p.box({ size: [0.13, 0.15, 0.016], base: [x, y - 0.17, 0.06], color: c, colorTop: c === GOLD ? GOLD_LIGHT : c });
        if (c === CREAM) p.box({ size: [0.065, 0.15, 0.018], base: [x + 0.0325, y - 0.17, 0.06], color: AGE_RED });
        if (c === AGE_TEAL) p.box({ size: [0.13, 0.05, 0.018], base: [x, y - 0.12, 0.06], color: GOLD });
      });
    };
    flags('flagsA', 'flagsB', YY - 0.02, [-0.27, -0.09, 0.09, 0.27], 1);

    // Ausguck: Fass mit goldenem Rand, darin der Ausguck mit Fernrohr
    base.lathe({ points: [[0, 0], [0.13, 0], [0.17, 0.08], [0.172, 0.21], [0.152, 0.21], [0.15, 0.04], [0, 0.04]], seg: 10, base: [0, NY - 0.14, 0], color: WOOD, colorTop: WOOD_LIGHT });
    base.torus({ r: 0.172, tube: 0.018, seg: 10, tubeSeg: 3, at: [0, NY - 0.04, 0], color: WOOD_DARK });
    base.torus({ r: 0.162, tube: 0.024, seg: 10, tubeSeg: 4, at: [0, NY + 0.07, 0], color: GOLD, colorTop: GOLD_LIGHT });
    const look = m.part('lookout', { pivot: [0, NY, 0] });
    person(look, 0, NY - 0.12, 0.075, { coat: AGE_TEAL, coatTop: '#2f8f99', hat: 'cap', hatColor: AGE_RED });
    rod(look, [-0.12, NY + 0.16, 0.075], [-0.04, NY + 0.2, 0.2], 0.03, AGE_TEAL, { seg: 5 });
    rod(look, [0.12, NY + 0.16, 0.075], [0.05, NY + 0.24, 0.17], 0.03, AGE_TEAL, { seg: 5 });
    rod(look, [0.04, NY + 0.255, 0.13], [0.04, NY + 0.26, 0.34], 0.026, GOLD, { rTop: 0.034, seg: 7, colorTop: GOLD_LIGHT });

    // Stufe 2: zweite Rah mit Laterne
    tier2(m, GOLD);
    const Y2 = NY + 0.42;
    const yard2 = m.part('yard2', { minLevel: 2 });
    yard2.cyl({ r: 0.024, h: 0.5, seg: 6, at: [0, Y2, 0.04], rot: [0, 0, HALF], color: WOOD_DARK });
    flags('flags2A', 'flags2B', Y2 - 0.02, [-0.17, 0.0, 0.17], 2);
    const lantern = m.part('lantern2', { pivot: [-0.25, Y2, 0.04], minLevel: 2 });
    rod(lantern, [-0.25, Y2, 0.04], [-0.25, Y2 - 0.07, 0.04], 0.012, IRON, { seg: 3 });
    lantern.box({ size: [0.08, 0.1, 0.08], at: [-0.25, Y2 - 0.12, 0.04], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    lantern.pyramid({ size: [0.1, 0.05, 0.1], base: [-0.25, Y2 - 0.07, 0.04], color: IRON });

    // Stufe 3: Winkerarme und goldene Krone an der Mastspitze
    tier3(m, GOLD);
    const SY = NY + 0.5;
    const c3 = m.part('crown3', { minLevel: 3 });
    c3.cyl({ r: 0.07, rTop: 0.085, h: 0.06, seg: 8, base: [0, NY + 0.6, 0], color: GOLD, colorTop: GOLD_LIGHT });
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      c3.cone({ r: 0.025, h: 0.07, seg: 4, base: [Math.sin(a) * 0.07, NY + 0.66, Math.cos(a) * 0.07], color: GOLD, colorTop: GOLD_LIGHT });
    }
    for (const [name, s] of /** @type {[string, number][]} */ ([['semL3', -1], ['semR3', 1]])) {
      const arm = m.part(name, { pivot: [s * 0.03, SY, 0.03], minLevel: 3 });
      arm.box({ size: [0.24, 0.035, 0.03], at: [s * 0.14, SY, 0.04], color: WOOD_DARK });
      arm.box({ size: [0.08, 0.08, 0.025], at: [s * 0.25, SY, 0.045], color: GOLD, colorTop: GOLD_LIGHT });
    }

    return m.build({
      animate(pose, ctx) {
        // Die Flaggen schlagen im Takt (112 BPM) gegenläufig aus.
        const beat = ctx.t * BEAT + ctx.seed;
        const pb = beat - Math.floor(beat);
        const hit = (1 - pb) * (1 - pb);
        const odd = Math.floor(beat) % 2 === 0 ? 1 : -1;
        const wind = Math.sin(ctx.t * 2.3 + ctx.seed * 4) * 0.08;
        pose.flagsA.rotation.x = -0.15 - hit * 0.35 * (odd > 0 ? 1 : 0.4) + wind;
        pose.flagsB.rotation.x = -0.15 - hit * 0.35 * (odd < 0 ? 1 : 0.4) - wind;
        // Der Ausguck schwenkt das Fernrohr langsam über das Feld.
        pose.lookout.rotation.y = Math.sin(ctx.t * 0.4 + ctx.seed * 6) * 1.2;
        pose.pennant.rotation.y = 0.6 + Math.sin(ctx.t * 1.1 + ctx.seed * 5) * 0.25;
        pose.pennant.rotation.x = Math.sin(ctx.t * 2.3 + ctx.seed * 2) * 0.08;
        if (ctx.level >= 2) {
          pose.flags2A.rotation.x = -0.15 - hit * 0.3 * (odd < 0 ? 1 : 0.4) - wind;
          pose.flags2B.rotation.x = -0.15 - hit * 0.3 * (odd > 0 ? 1 : 0.4) + wind;
          pose.lantern2.rotation.z = Math.sin(ctx.t * 1.6 + ctx.seed * 3) * 0.12;
          pose.lantern2.scale.setScalar(1 + hit * 0.12);
        }
        if (ctx.level >= 3) {
          // Winkerarme springen jeden zweiten Schlag in eine neue Stellung.
          const step = Math.floor(beat * 0.5) % 4;
          const ease = smooth((beat * 0.5 - Math.floor(beat * 0.5)) * 4);
          const l = step === 0 ? 0.8 : step === 1 ? -0.6 : step === 2 ? 0.2 : -0.2;
          const r = step === 0 ? -0.2 : step === 1 ? 0.8 : step === 2 ? -0.7 : 0.4;
          pose.semL3.rotation.z = -l * ease;
          pose.semR3.rotation.z = r * ease;
        }
      },
    });
  },
};

