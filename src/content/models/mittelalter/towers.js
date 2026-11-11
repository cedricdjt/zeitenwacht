// @ts-check
// Türme des Mittelalters: Armbrustschütze, Tribock, Pechsieder, Balliste, Feuersiphon, Glockenturm.
// Alle stehen auf demselben achteckigen Feldsteinsockel mit einem Band in der Rollenfarbe
// (gleiche Lage von Band und Stufenpunkten wie in Steinzeit und Rom, damit modernisierte Türme wiedererkennbar bleiben).

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, PoseNode, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;

// --- Materialfarben des Zeitalters (Stein wie bei Burg und Zinnenmauer, Holz bewusst hell) ---
const STONE = '#b4ada2';
const STONE_LIGHT = '#d2ccc0';
const STONE_DARK = '#8f887e';
const WOOD = '#b08250';
const WOOD_LIGHT = '#d2a670';
const WOOD_DARK = '#8a6240';
const IRON = '#55524f';
const IRON_LIGHT = '#7d7872';
const KETTLE = '#3f3b3d';
const KETTLE_LIGHT = '#5d585a';
const PITCH = '#2e2a30';
const PITCH_SHINE = '#4a4452';
const BRONZE = '#b07a3e';
const BRONZE_LIGHT = '#d9a95e';
const BRONZE_DARK = '#8a5a2c';
const SKIN = '#e3b48d';
const HAIR = '#5a3b26';
const DARK = '#2a2420';
const GAMBESON = '#e6d8b8';
const GAMBESON_SHADE = '#cbbb98';
const HOSE = '#7a5a3c';
const LEATHER = '#8f5e36';
const ROPE = '#dcc698';
const SLIT = '#3a332e';
const SHINGLE = '#a8714a';
const SHINGLE_LIGHT = '#cf9866';
const SMOKE = '#d9d4cc';
const EMBER = '#ff8a2a';
const EMBER_LIGHT = '#ffd35e';
const CLOTH = '#f4ecd8';

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
const RED = '#d8432f';
const RED_LIGHT = '#ea6a55';
const GOLD = '#f2c230';
const GOLD_LIGHT = '#ffe07a';

/** Oberkante des Sockels. */
const TOP = 0.235;
/** Schläge pro Sekunde der Musik des Mittelalters (104 BPM). */
const BEAT = 104 / 60;

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
 * Feldsteinsockel mit Band in der Rollenfarbe und dem ersten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function plinth(m, role) {
  const base = m.part('base');
  base.cyl({ r: 0.44, rTop: 0.425, h: 0.17, seg: 8, base: [0, -0.05, 0], color: STONE_DARK });
  base.cyl({ r: 0.432, h: 0.075, seg: 8, base: [0, 0.1, 0], color: role, shade: 0.1 });
  base.cyl({ r: 0.415, rTop: 0.39, h: 0.065, seg: 8, base: [0, 0.17, 0], color: STONE, colorTop: STONE_LIGHT });
  base.sphere({ r: 0.045, detail: 0, at: [0, 0.235, 0.36], color: role });
  return base;
}

/**
 * Teil der Stufe 2: zweites Farbband, vier Prellsteine mit Eisenkappe, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.455, h: 0.045, seg: 8, base: [0, 0.015, 0], color: role, shade: 0.1 });
  for (const [x, z] of [[0.31, 0.31], [-0.31, 0.31], [-0.31, -0.31], [0.31, -0.31]]) {
    p.box({ size: [0.14, 0.14, 0.14], base: [x, -0.03, z], rot: [0, Math.PI / 4, 0], color: STONE, colorTop: STONE_LIGHT });
    p.pyramid({ size: [0.1, 0.05, 0.1], base: [x, 0.11, z], rot: [0, Math.PI / 4, 0], color: IRON_LIGHT });
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

/**
 * Mittelalterliche Figur ohne Arme: Beinlinge, Wams mit Gürtel, großer Kopf. Füße bei (x, y, z), Blick nach +Z.
 * Schultern liegen bei y + 0.25, der Scheitel bei etwa y + 0.47.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ tunic?: string, tunicTop?: string, band?: string, hat?: 'kettle' | 'hood' | 'hair', hood?: string }} [o]
 */
function person(p, x, y, z, o = {}) {
  p.box({ size: [0.065, 0.1, 0.075], base: [x - 0.05, y, z], color: HOSE });
  p.box({ size: [0.065, 0.1, 0.075], base: [x + 0.05, y, z], color: HOSE });
  p.box({ size: [0.21, 0.19, 0.14], base: [x, y + 0.08, z], color: o.tunic ?? GAMBESON_SHADE, colorTop: o.tunicTop ?? GAMBESON });
  p.box({ size: [0.222, 0.03, 0.152], at: [x, y + 0.13, z], color: LEATHER });
  if (o.band) p.box({ size: [0.226, 0.045, 0.156], at: [x, y + 0.255, z], color: o.band });
  p.sphere({ r: 0.095, at: [x, y + 0.36, z + 0.01], color: SKIN });
  p.box({ size: [0.022, 0.026, 0.012], at: [x + 0.035, y + 0.355, z + 0.108], color: DARK });
  p.box({ size: [0.022, 0.026, 0.012], at: [x - 0.035, y + 0.355, z + 0.108], color: DARK });
  const hat = o.hat ?? 'hair';
  if (hat === 'kettle') {
    // Eisenhut mit breiter Krempe: die Krempe macht die Figur von oben erkennbar.
    p.dome({ r: 0.104, seg: 7, rings: 2, at: [x, y + 0.385, z], scale: [1, 1.15, 1], color: IRON, colorTop: IRON_LIGHT });
    p.cyl({ r: 0.155, rTop: 0.135, h: 0.025, seg: 8, at: [x, y + 0.39, z], color: IRON_LIGHT });
  } else if (hat === 'hood') {
    const c = o.hood ?? HOSE;
    p.dome({ r: 0.11, seg: 7, rings: 2, at: [x, y + 0.36, z - 0.012], scale: [1, 1.15, 1], color: c });
    p.cone({ r: 0.05, h: 0.12, seg: 5, at: [x, y + 0.43, z - 0.1], rot: [-1.1, 0, 0], color: c });
    p.box({ size: [0.24, 0.05, 0.17], at: [x, y + 0.27, z - 0.005], color: c });
  } else {
    p.dome({ r: 0.104, seg: 6, rings: 2, at: [x, y + 0.37, z - 0.012], color: HAIR });
  }
}

/**
 * Armbrustschütze mit eigenem Teil für die Armbrust (`name + 'Bow'`) und den Bolzen (`name + 'Bolt'`).
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {string} parent
 * @param {number} Y Standhöhe
 * @param {number} minLevel
 */
function crossbowman(m, name, parent, Y, minLevel) {
  const fig = m.part(name, { parent, pivot: [0, Y, 0], minLevel });
  person(fig, 0, Y, -0.04, { band: BLUE, hat: 'kettle' });
  // Köcher an der Hüfte
  fig.box({ size: [0.06, 0.15, 0.07], at: [-0.13, Y + 0.17, -0.07], rot: [0, 0, 0.2], color: LEATHER });
  const CY = Y + 0.3;
  const bow = m.part(name + 'Bow', { parent: name, pivot: [0, CY, -0.02], minLevel });
  rod(bow, [0.105, Y + 0.24, -0.04], [0.035, CY - 0.03, 0.05], 0.03, GAMBESON_SHADE, { seg: 4 });
  rod(bow, [-0.105, Y + 0.24, -0.04], [-0.035, CY - 0.03, 0.17], 0.03, GAMBESON_SHADE, { seg: 4 });
  bow.box({ size: [0.06, 0.06, 0.44], at: [0, CY, 0.13], color: WOOD, colorTop: WOOD_LIGHT });
  bow.box({ size: [0.05, 0.05, 0.08], at: [0, CY - 0.035, 0.0], rot: [0.5, 0, 0], color: WOOD_DARK });
  // Bogen der Armbrust: zwei leicht zurückgebogene Stücke mit blauen Enden
  bow.box({ size: [0.2, 0.045, 0.05], at: [0.1, CY, 0.33], rot: [0, 0.22, 0], color: WOOD_DARK });
  bow.box({ size: [0.2, 0.045, 0.05], at: [-0.1, CY, 0.33], rot: [0, -0.22, 0], color: WOOD_DARK });
  bow.box({ size: [0.05, 0.055, 0.06], at: [0.2, CY, 0.305], rot: [0, 0.22, 0], color: BLUE, mirror: true });
  rod(bow, [0.205, CY + 0.005, 0.29], [0, CY + 0.035, 0.12], 0.011, CLOTH, { seg: 3 });
  rod(bow, [-0.205, CY + 0.005, 0.29], [0, CY + 0.035, 0.12], 0.011, CLOTH, { seg: 3 });
  const bolt = m.part(name + 'Bolt', { parent: name + 'Bow', pivot: [0, CY + 0.045, 0.12], minLevel });
  rod(bolt, [0, CY + 0.045, 0.12], [0, CY + 0.045, 0.34], 0.02, WOOD_LIGHT, { seg: 4 });
  bolt.cone({ r: 0.032, h: 0.06, seg: 4, at: [0, CY + 0.045, 0.37], rot: [HALF, 0, 0], color: IRON_LIGHT });
  bolt.box({ size: [0.012, 0.05, 0.05], at: [0, CY + 0.06, 0.14], color: CLOTH });
}

/**
 * Bewegung eines Armbrustschützen: Bolzen auflegen, beim Schuss schlägt die Armbrust zurück und hoch.
 * @param {PoseNode} fig
 * @param {PoseNode} bow
 * @param {PoseNode} bolt
 * @param {number} charge
 * @param {number} fire
 */
function animCrossbow(fig, bow, bolt, charge, fire) {
  const k = fire * fire;
  bow.position.z -= k * 0.08;
  bow.rotation.x -= fire * 0.32;
  fig.rotation.x -= k * 0.1;
  bolt.scale.setScalar(Math.max(1e-3, smooth((charge - 0.15) * 5)));
}

/**
 * Gussring um einen Kessel; liegt flach bei Höhe y.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 */
function rim(p, x, y, z, r) {
  p.torus({ r, tube: 0.026, seg: 10, tubeSeg: 4, at: [x, y, z], color: TEAL, colorTop: TEAL_LIGHT });
}

/**
 * Drachenkopf mit offenem Maul nach +Z; der Hals sitzt bei (x, y, z).
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} s Größe
 */
function dragonHead(p, x, y, z, s) {
  p.box({ size: [0.15 * s, 0.13 * s, 0.15 * s], at: [x, y + 0.02 * s, z + 0.06 * s], color: RED, colorTop: RED_LIGHT });
  // Oberkiefer und Unterkiefer, dazwischen das Maul
  p.box({ size: [0.12 * s, 0.05 * s, 0.13 * s], at: [x, y + 0.045 * s, z + 0.18 * s], rot: [-0.18, 0, 0], color: RED, colorTop: RED_LIGHT });
  p.box({ size: [0.1 * s, 0.035 * s, 0.11 * s], at: [x, y - 0.04 * s, z + 0.16 * s], rot: [0.25, 0, 0], color: '#b8382a' });
  p.box({ size: [0.08 * s, 0.03 * s, 0.06 * s], at: [x, y + 0.0, z + 0.15 * s], color: DARK });
  // Augen und goldene Hörner
  p.box({ size: [0.03 * s, 0.03 * s, 0.03 * s], at: [x + 0.06 * s, y + 0.07 * s, z + 0.11 * s], color: GOLD_LIGHT, mirror: true });
  p.cone({ r: 0.028 * s, h: 0.13 * s, seg: 4, at: [x + 0.05 * s, y + 0.13 * s, z - 0.0], rot: [-0.7, 0, -0.25], color: GOLD, colorTop: GOLD_LIGHT, mirror: true });
  // Kamm
  p.box({ size: [0.02 * s, 0.05 * s, 0.12 * s], at: [x, y + 0.1 * s, z + 0.04 * s], color: GOLD });
}

/** Profil einer Glocke, Mund unten bei y = 0, Krone oben bei y = 0.17. @type {[number, number][]} */
const BELL = [[0, 0.012], [0.11, 0.0], [0.105, 0.03], [0.075, 0.07], [0.065, 0.13], [0.05, 0.16], [0.02, 0.17], [0, 0.17]];

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Armbrustschütze hinter einer blauen Pavese auf einem runden Steinturm mit Zinnen.
  // Stufe 2 erhöht den Turm und setzt ein Banner, Stufe 3 bringt einen hölzernen Wehrgang mit Ringdach und einen zweiten Schützen.
  'tower.mittelalter.schuetze': () => {
    const m = createModel('tower.mittelalter.schuetze');
    const FY = 0.6;
    const RISE = 0.17;
    const base = plinth(m, BLUE);
    base.cyl({ r: 0.33, rTop: 0.31, h: FY - TOP + 0.01, seg: 9, base: [0, TOP - 0.01, 0], color: STONE_DARK, colorTop: STONE });
    base.cyl({ r: 0.336, h: 0.035, seg: 9, base: [0, 0.4, 0], color: STONE_LIGHT });
    base.box({ size: [0.035, 0.11, 0.02], at: [0, 0.5, 0.315], color: SLIT });
    base.box({ size: [0.12, 0.16, 0.03], base: [0, TOP, -0.315], color: WOOD_DARK });

    const drum2 = m.part('drum2', { minLevel: 2 });
    drum2.cyl({ r: 0.312, rTop: 0.305, h: RISE + 0.01, seg: 9, base: [0, FY - 0.01, 0], color: STONE, colorTop: STONE_LIGHT });
    drum2.box({ size: [0.035, 0.1, 0.02], at: [0.2, FY + 0.08, 0.235], rot: [0, 0.7, 0], color: SLIT });

    // Zinnenkranz mit blauer Bodenscheibe; wird ab Stufe 2 angehoben
    const par = m.part('parapet', { pivot: [0, FY, 0] });
    par.cyl({ r: 0.24, h: 0.012, seg: 9, base: [0, FY, 0], color: BLUE, shade: 0 });
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + TAU / 16;
      const s = Math.sin(a);
      const c = Math.cos(a);
      par.box({ size: [0.235, 0.075, 0.075], base: [s * 0.285, FY - 0.005, c * 0.285], rot: [0, a, 0], color: STONE, colorTop: STONE_LIGHT });
      const b = a + TAU / 16;
      par.box({ size: [0.11, 0.1, 0.085], base: [Math.sin(b) * 0.285, FY + 0.07, Math.cos(b) * 0.285], rot: [0, b, 0], color: STONE, colorTop: STONE_LIGHT });
    }

    // Zielendes Teil: Pavese und die Schützen
    const fig = m.part('figure', { parent: 'parapet', pivot: [0, FY, 0] });
    const pav = m.part('pavise', { parent: 'figure', pivot: [0, FY, 0.16] });
    pav.extrude({ points: [[-0.14, 0], [0.14, 0], [0.14, 0.22], [0.09, 0.27], [-0.09, 0.27], [-0.14, 0.22]], depth: 0.035, base: [0, FY, 0.17], rot: [0.12, 0, 0], color: BLUE_DARK, colorTop: BLUE_LIGHT });
    pav.box({ size: [0.05, 0.23, 0.04], base: [0, FY + 0.01, 0.175], rot: [0.12, 0, 0], color: CLOTH });
    fig.cyl({ r: 0.2, h: 0.05, seg: 8, base: [0, FY, -0.02], color: WOOD_DARK, colorTop: WOOD });
    crossbowman(m, 'shooterA', 'figure', FY + 0.05, 1);
    crossbowman(m, 'shooterB', 'figure', FY + 0.05, 3);

    // Stufe 2: Banner am Zinnenkranz
    tier2(m, BLUE);
    const pole = m.part('pole2', { parent: 'parapet', pivot: [-0.2, FY, -0.2], minLevel: 2 });
    rod(pole, [-0.2, FY + 0.06, -0.2], [-0.2, FY + 0.78, -0.2], 0.022, WOOD_DARK, { seg: 5 });
    pole.sphere({ r: 0.035, detail: 0, at: [-0.2, FY + 0.8, -0.2], color: GOLD });
    const flag = m.part('flag2', { parent: 'pole2', pivot: [-0.2, FY + 0.7, -0.2], minLevel: 2 });
    flag.extrude({ points: [[0, 0], [0.28, 0], [0.22, -0.09], [0.28, -0.18], [0, -0.18]], depth: 0.02, at: [-0.2, FY + 0.72, -0.2], color: BLUE, colorTop: BLUE_LIGHT });
    flag.box({ size: [0.05, 0.19, 0.025], at: [-0.1, FY + 0.63, -0.2], color: CLOTH });

    // Stufe 3: hölzerner Wehrgang mit Ringdach; die Mitte bleibt offen, damit man die Schützen sieht
    tier3(m, BLUE);
    const h3 = m.part('hoard3', { parent: 'parapet', pivot: [0, FY, 0], minLevel: 3 });
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + TAU / 16;
      const s = Math.sin(a);
      const c = Math.cos(a);
      h3.box({ size: [0.29, 0.15, 0.04], base: [s * 0.345, FY - 0.03, c * 0.345], rot: [0, a, 0], color: WOOD, colorTop: WOOD_LIGHT });
      h3.box({ size: [0.05, 0.05, 0.08], at: [s * 0.32, FY - 0.06, c * 0.32], rot: [0, a, 0], color: WOOD_DARK });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4 + TAU / 8;
      rod(h3, [Math.sin(a) * 0.345, FY + 0.1, Math.cos(a) * 0.345], [Math.sin(a) * 0.34, FY + 0.72, Math.cos(a) * 0.34], 0.024, WOOD_DARK, { seg: 4 });
    }
    h3.cyl({ r: 0.39, rTop: 0.3, h: 0.08, seg: 8, open: true, base: [0, FY + 0.69, 0], color: BLUE_DARK, colorTop: BLUE });
    h3.torus({ r: 0.3, tube: 0.025, seg: 8, tubeSeg: 4, at: [0, FY + 0.77, 0], color: WOOD_LIGHT });
    h3.torus({ r: 0.385, tube: 0.022, seg: 8, tubeSeg: 4, at: [0, FY + 0.69, 0], color: WOOD_DARK });

    m.point('muzzle', [0, FY + 0.395, 0.42], 'shooterABow');
    return m.build({
      animate(pose, ctx) {
        if (ctx.level >= 2) pose.parapet.position.y += RISE;
        A.aim(pose, ctx, 'figure');
        animCrossbow(pose.shooterA, pose.shooterABow, pose.shooterABolt, ctx.charge, ctx.fire);
        if (ctx.level >= 3) {
          pose.shooterA.position.x -= 0.11;
          pose.shooterB.position.x += 0.11;
          pose.pavise.scale.x = 1.45;
          animCrossbow(pose.shooterB, pose.shooterBBow, pose.shooterBBolt, ctx.charge, ctx.fire);
        }
        if (ctx.level >= 2) {
          pose.flag2.rotation.y = Math.sin((ctx.t * 0.6 + ctx.seed) * TAU) * 0.3 + 0.1;
        }
      },
    });
  },

  // Werfer: Tribock. Zwei A-Böcke auf einer Drehscheibe, langer Wurfarm, schwingendes Gegengewicht, Schlinge mit Steinkugel.
  'tower.mittelalter.werfer': () => {
    const m = createModel('tower.mittelalter.werfer');
    plinth(m, ORANGE);
    const AY = 0.95;
    const AZ = 0.05;
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    yaw.cyl({ r: 0.39, h: 0.045, seg: 10, base: [0, TOP - 0.005, 0], color: WOOD_DARK, colorTop: WOOD });
    for (const sx of [-1, 1]) {
      yaw.box({ size: [0.075, 0.075, 0.74], at: [sx * 0.21, TOP + 0.075, 0], color: WOOD, colorTop: WOOD_LIGHT });
    }
    for (const z of [-0.3, 0.3]) yaw.box({ size: [0.5, 0.06, 0.07], at: [0, TOP + 0.08, z], color: WOOD_DARK });
    /**
     * A-Bock auf einer Seite.
     * @param {PartBuilder} p
     * @param {number} sx
     * @param {number} top
     */
    const aFrame = (p, sx, top) => {
      rod(p, [sx * 0.23, TOP + 0.1, 0.33], [sx * 0.19, top, AZ], 0.036, WOOD, { seg: 4, colorTop: WOOD_LIGHT });
      rod(p, [sx * 0.23, TOP + 0.1, -0.33], [sx * 0.19, top, AZ], 0.036, WOOD, { seg: 4, colorTop: WOOD_LIGHT });
      p.box({ size: [0.05, 0.05, 0.42], at: [sx * 0.215, TOP + 0.3, AZ * 0.4], color: WOOD_DARK });
      p.box({ size: [0.09, 0.09, 0.1], at: [sx * 0.19, top + 0.02, AZ], color: ORANGE, colorTop: ORANGE_LIGHT });
    };
    const frame1 = m.part('frame1', { parent: 'yaw', pivot: [0, TOP, 0], maxLevel: 2 });
    aFrame(frame1, -1, AY);
    aFrame(frame1, 1, AY);
    // Steinkugeln als Vorrat
    yaw.sphere({ r: 0.07, detail: 0, at: [0.3, TOP + 0.11, -0.2], color: STONE, colorTop: STONE_LIGHT });
    yaw.sphere({ r: 0.065, detail: 0, at: [0.3, TOP + 0.1, -0.06], color: STONE_DARK, colorTop: STONE });

    const arm = m.part('arm', { parent: 'yaw', pivot: [0, AY, AZ] });
    arm.cyl({ r: 0.035, h: 0.5, seg: 6, at: [0, AY, AZ], rot: [0, 0, HALF], color: IRON_LIGHT });
    rod(arm, [0, AY - 0.2, AZ], [0, AY + 0.52, AZ], 0.045, WOOD_LIGHT, { rTop: 0.03, seg: 6 });
    arm.box({ size: [0.11, 0.08, 0.11], at: [0, AY, AZ], color: WOOD_DARK });
    arm.box({ size: [0.075, 0.05, 0.075], at: [0, AY + 0.3, AZ], color: ORANGE });

    const weight = m.part('weight', { parent: 'arm', pivot: [0, AY - 0.19, AZ] });
    rod(weight, [-0.06, AY - 0.19, AZ], [-0.06, AY - 0.27, AZ], 0.015, IRON, { seg: 4 });
    rod(weight, [0.06, AY - 0.19, AZ], [0.06, AY - 0.27, AZ], 0.015, IRON, { seg: 4 });
    weight.box({ size: [0.22, 0.17, 0.17], at: [0, AY - 0.355, AZ], color: WOOD, colorTop: WOOD_LIGHT });
    weight.box({ size: [0.235, 0.03, 0.185], at: [0, AY - 0.29, AZ], color: ORANGE });

    const sling = m.part('sling', { parent: 'arm', pivot: [0, AY + 0.52, AZ] });
    rod(sling, [0, AY + 0.52, AZ], [0, AY + 0.36, AZ], 0.012, ROPE, { seg: 3 });
    sling.sphere({ r: 0.05, detail: 0, at: [0, AY + 0.33, AZ], scale: [1, 0.7, 1], color: LEATHER });
    const ball = m.part('ball', { parent: 'sling', pivot: [0, AY + 0.33, AZ] });
    ball.sphere({ r: 0.06, detail: 0, at: [0, AY + 0.33, AZ], color: STONE_LIGHT });

    // Stufe 2: Eisenbänder am Arm, orange Fähnchen auf den Böcken
    tier2(m, ORANGE);
    const bands = m.part('bands2', { parent: 'arm', pivot: [0, AY, AZ], minLevel: 2 });
    for (const y of [AY + 0.12, AY + 0.42, AY - 0.12]) bands.cyl({ r: 0.05, h: 0.025, seg: 6, at: [0, y, AZ], color: IRON });
    const flags = m.part('flags2', { parent: 'yaw', pivot: [0, AY, AZ], minLevel: 2 });
    for (const sx of [-1, 1]) {
      rod(flags, [sx * 0.19, AY + 0.06, AZ], [sx * 0.19, AY + 0.32, AZ], 0.016, WOOD_DARK, { seg: 4 });
      flags.extrude({ points: [[0, 0], [0.15, -0.045], [0, -0.09]], depth: 0.015, at: [sx * 0.19, AY + 0.31, AZ], rot: [0, HALF, 0], color: ORANGE, colorTop: ORANGE_LIGHT });
    }

    // Stufe 3: höhere Böcke und ein Tretrad, das sich beim Nachladen dreht
    tier3(m, ORANGE);
    const RISE3 = 0.12;
    const frame3 = m.part('frame3', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 3 });
    aFrame(frame3, -1, AY + RISE3);
    aFrame(frame3, 1, AY + RISE3);
    const WX = 0.33;
    const WY = TOP + 0.24;
    const wheel = m.part('wheel3', { parent: 'yaw', pivot: [WX, WY, -0.08], minLevel: 3 });
    wheel.torus({ r: 0.19, tube: 0.03, seg: 10, tubeSeg: 4, at: [WX, WY, -0.08], rot: [0, 0, HALF], color: WOOD, colorTop: WOOD_LIGHT });
    for (let i = 0; i < 3; i++) {
      wheel.box({ size: [0.035, 0.38, 0.035], at: [WX, WY, -0.08], rot: [(i * Math.PI) / 3, 0, 0], color: WOOD_DARK });
    }
    wheel.cyl({ r: 0.04, h: 0.08, seg: 6, at: [WX, WY, -0.08], rot: [0, 0, HALF], color: ORANGE });

    m.point('muzzle', [0, AY + 0.55, AZ + 0.3], 'yaw');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        if (ctx.level >= 3) pose.arm.position.y += RISE3;
        // Wurf: der Arm schlägt in rund 0,1 s um 140 Grad nach vorn; danach zieht ihn das Nachladen langsam zurück.
        const thrown = f > 0 ? smooth((1 - f) * 3) : 1;
        const reload = smooth((ctx.charge - 0.12) / 0.7);
        const swing = thrown * (1 - reload);
        const ang = -2.0 + 2.5 * swing + Math.sin(f * 10) * f * 0.06;
        pose.arm.rotation.x = ang;
        // Gegengewicht hängt lotrecht und pendelt beim Wurf durch
        pose.weight.rotation.x = -ang + Math.sin(f * 9) * f * 0.55;
        pose.sling.rotation.x = -ang * 0.7 - swing * 0.8 + Math.sin(ctx.t * 1.3 + ctx.seed * 5) * 0.04;
        pose.ball.scale.setScalar(Math.max(1e-3, smooth((ctx.charge - 0.6) * 5)));
        pose.yaw.position.y = f * f * 0.03;
        if (ctx.level >= 2) {
          pose.flags2.rotation.y = 0;
        }
        if (ctx.level >= 3) pose.wheel3.rotation.x = -Math.min(ctx.charge, 0.82) * TAU * 1.3;
      },
    });
  },

  // Bremser: Pechsieder. Eiserner Kessel auf einem Feuerherd, ein Kranarm mit Schöpfkelle schleudert das Pech.
  'tower.mittelalter.bremser': () => {
    const m = createModel('tower.mittelalter.bremser');
    plinth(m, TEAL);
    const CZ = 0.06;
    const PY = TOP + 0.13;
    const top = m.part('top', { pivot: [0, TOP, 0] });
    // Herd aus Feldsteinen mit Glut
    for (let i = 0; i < 7; i++) {
      const a = (i * TAU) / 7 + 0.3;
      top.box({ size: [0.13, 0.11, 0.11], base: [Math.sin(a) * 0.26, TOP - 0.01, CZ + Math.cos(a) * 0.26], rot: [0, a, 0], color: STONE, colorTop: STONE_LIGHT });
    }
    top.sphere({ r: 0.15, detail: 0, at: [0, TOP + 0.01, CZ], scale: [1, 0.35, 1], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    const fire = m.part('fire', { parent: 'top', pivot: [0, TOP + 0.03, CZ] });
    fire.cone({ r: 0.07, h: 0.13, seg: 5, base: [0.09, TOP + 0.02, CZ + 0.1], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    fire.cone({ r: 0.06, h: 0.11, seg: 5, base: [-0.1, TOP + 0.02, CZ + 0.08], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    // Kranpfosten hinten
    const PZ = -0.32;
    const PH = 1.02;
    top.box({ size: [0.095, PH - TOP, 0.095], base: [0, TOP, PZ], color: WOOD, colorTop: WOOD_LIGHT });
    rod(top, [0, TOP + 0.02, PZ - 0.1], [0, TOP + 0.35, PZ - 0.02], 0.025, WOOD_DARK, { seg: 4 });
    top.box({ size: [0.1, 0.05, 0.1], base: [0, PH, PZ], color: TEAL });

    // Pechfass mit türkisen Reifen und Brennholz
    top.lathe({ points: [[0, 0], [0.085, 0], [0.1, 0.09], [0.085, 0.19], [0, 0.19]], seg: 8, base: [0.27, TOP - 0.01, -0.2], color: WOOD, colorTop: WOOD_LIGHT });
    for (const y of [0.035, 0.15]) top.cyl({ r: 0.097, h: 0.025, seg: 8, base: [0.27, TOP + y, -0.2], color: TEAL });
    top.cyl({ r: 0.08, h: 0.012, seg: 8, base: [0.27, TOP + 0.175, -0.2], color: PITCH });
    for (const [y, z] of [[0.04, -0.3], [0.04, -0.2], [0.1, -0.25]]) top.cyl({ r: 0.04, h: 0.24, seg: 5, at: [-0.24, TOP + y, z], rot: [0, 0, HALF], color: WOOD_DARK, colorTop: WOOD });
    // Kessel mit Pech; ab Stufe 2 größer
    const pot = m.part('pot', { parent: 'top', pivot: [0, PY, CZ] });
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      rod(pot, [Math.sin(a) * 0.13, TOP, CZ + Math.cos(a) * 0.13], [Math.sin(a) * 0.1, PY + 0.04, CZ + Math.cos(a) * 0.1], 0.022, KETTLE, { seg: 4 });
    }
    pot.lathe({ points: [[0, 0], [0.14, 0.015], [0.22, 0.09], [0.245, 0.18], [0.235, 0.22], [0, 0.22]], seg: 10, base: [0, PY, CZ], color: KETTLE, colorTop: KETTLE_LIGHT });
    pot.cyl({ r: 0.225, h: 0.012, seg: 10, base: [0, PY + 0.216, CZ], color: PITCH, colorTop: PITCH_SHINE });
    rim(pot, 0, PY + 0.22, CZ, 0.235);
    for (const sx of [-1, 1]) pot.torus({ r: 0.045, tube: 0.014, seg: 6, tubeSeg: 3, at: [sx * 0.255, PY + 0.19, CZ], rot: [HALF, 0, 0], color: KETTLE_LIGHT });
    const bub = m.part('bubbles', { parent: 'pot', pivot: [0.06, PY + 0.225, CZ + 0.05] });
    bub.sphere({ r: 0.04, detail: 0, at: [0.06, PY + 0.225, CZ + 0.05], color: PITCH_SHINE });
    const bub2 = m.part('bubbles2', { parent: 'pot', pivot: [-0.08, PY + 0.225, CZ - 0.04] });
    bub2.sphere({ r: 0.032, detail: 0, at: [-0.08, PY + 0.225, CZ - 0.04], color: PITCH_SHINE });
    const smoke = m.part('smoke', { parent: 'top', pivot: [0.02, PY + 0.25, CZ] });
    smoke.sphere({ r: 0.07, detail: 0, at: [0.02, PY + 0.25, CZ], color: SMOKE });

    /**
     * Schöpfkelle am Kranarm; Drehpunkt oben am Pfosten.
     * @param {string} name
     * @param {number} minLevel
     */
    const ladle = (name, minLevel) => {
      const l = m.part(name, { parent: 'top', pivot: [0, PH, PZ], minLevel });
      const tip = /** @type {Vec3} */ ([0, PY + 0.17, CZ + 0.02]);
      rod(l, [0, PH + 0.03, PZ - 0.14], tip, 0.03, WOOD_LIGHT, { seg: 5 });
      l.box({ size: [0.075, 0.075, 0.08], at: [0, PH + 0.03, PZ - 0.16], color: TEAL });
      l.cyl({ r: 0.04, h: 0.05, seg: 6, at: [0, (PH + PY) / 2 + 0.06, (PZ + CZ) / 2 - 0.03], rot: [-0.85, 0, 0], color: TEAL });
      l.lathe({ points: [[0, 0], [0.06, 0.01], [0.085, 0.05], [0.08, 0.07], [0, 0.07]], seg: 7, base: [0, PY + 0.13, CZ + 0.05], color: KETTLE, colorTop: KETTLE_LIGHT });
      const glob = m.part(name + 'Glob', { parent: name, pivot: [0, PY + 0.2, CZ + 0.05], minLevel });
      glob.sphere({ r: 0.07, detail: 0, at: [0, PY + 0.2, CZ + 0.05], scale: [1, 0.75, 1], color: PITCH, colorTop: PITCH_SHINE });
    };
    ladle('ladle', 1);

    // Stufe 2: größerer Kessel (Skalierung im animate), Blasebalg am Herd
    tier2(m, TEAL);
    const bel = m.part('bellows2', { parent: 'top', pivot: [0.32, TOP + 0.08, CZ - 0.05], minLevel: 2 });
    bel.wedge({ size: [0.16, 0.11, 0.24], at: [0.32, TOP + 0.08, CZ - 0.05], rot: [0, -HALF - 0.4, 0], color: LEATHER, colorTop: '#b07a4a' });
    bel.box({ size: [0.04, 0.04, 0.12], at: [0.23, TOP + 0.05, CZ + 0.0], rot: [0, -0.4, 0], color: KETTLE });

    // Stufe 3: zweite Kelle, gemauerter Rauchfang hinten links
    tier3(m, TEAL);
    ladle('ladle3', 3);
    const ch = m.part('chimney3', { parent: 'top', pivot: [0, TOP, 0], minLevel: 3 });
    ch.box({ size: [0.17, 0.78, 0.17], base: [-0.27, TOP - 0.01, -0.22], color: STONE, colorTop: STONE_LIGHT });
    ch.box({ size: [0.21, 0.05, 0.21], base: [-0.27, TOP + 0.77, -0.22], color: STONE_LIGHT });
    ch.wedge({ size: [0.2, 0.16, 0.22], at: [-0.2, TOP + 0.5, -0.12], rot: [0, -0.8, 0], color: STONE_DARK, colorTop: STONE });
    const smoke3 = m.part('smoke3', { parent: 'top', pivot: [-0.27, TOP + 0.9, -0.22], minLevel: 3 });
    smoke3.sphere({ r: 0.075, detail: 0, at: [-0.27, TOP + 0.9, -0.22], color: SMOKE });

    m.point('muzzle', [0, 1.15, 0.2], 'top');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'top');
        const f = ctx.fire;
        if (ctx.level >= 2) pose.pot.scale.setScalar(1.14);
        // Kelle rührt ruhig im Kessel, hebt sich vor dem Wurf und schleudert dann nach vorn oben.
        const lift = smooth((ctx.charge - 0.55) * 2.5) * ctx.active * (1 - f);
        const stir = Math.sin(ctx.t * 2.1 + ctx.seed * 7) * 0.05 * (1 - lift);
        const ang = -0.35 * lift - 1.2 * f * (2 - f) + stir;
        pose.ladle.rotation.x = ang;
        const fill = Math.max(1e-3, smooth((ctx.charge - 0.3) * 4) * (1 - smooth(f * 4)));
        pose.ladleGlob.scale.setScalar(fill);
        if (ctx.level >= 3) {
          pose.ladle.position.x -= 0.075;
          pose.ladle3.position.x += 0.075;
          pose.ladle3.rotation.x = ang * 0.95 - stir * 2;
          pose.ladle3Glob.scale.setScalar(fill);
        }
        // Blasen steigen auf und platzen
        const b1 = (ctx.t * 0.9 + ctx.seed) % 1;
        const b2 = (ctx.t * 0.7 + ctx.seed + 0.5) % 1;
        pose.bubbles.scale.setScalar(Math.max(1e-3, Math.sin(b1 * Math.PI) * 1.1));
        pose.bubbles2.scale.setScalar(Math.max(1e-3, Math.sin(b2 * Math.PI)));
        // Rauchfahne
        const sp = (ctx.t * 0.45 + ctx.seed) % 1;
        pose.smoke.position.y += sp * 0.45;
        pose.smoke.position.x += sp * 0.06;
        pose.smoke.scale.setScalar(Math.max(1e-3, (0.6 + sp * 0.9) * Math.sin(sp * Math.PI)));
        if (ctx.level >= 3) {
          const s3 = (ctx.t * 0.4 + ctx.seed + 0.3) % 1;
          pose.smoke3.position.y += s3 * 0.4;
          pose.smoke3.scale.setScalar(Math.max(1e-3, (0.6 + s3 * 0.9) * Math.sin(s3 * Math.PI)));
        }
        const flick = Math.sin(ctx.t * 11 + ctx.seed * 9) * 0.12 + Math.sin(ctx.t * 17.3) * 0.08;
        pose.fire.scale.set(1, 1 + flick, 1);
        if (ctx.level >= 2) pose.bellows2.scale.y = 1 - (0.5 + 0.5 * Math.sin(ctx.t * 2.4 + ctx.seed * 3)) * 0.4;
      },
    });
  },

  // Panzerknacker: Balliste. Fahrbare Lafette, großer waagerechter Bogen, Winde am Ende, violetter Wimpel.
  'tower.mittelalter.knacker': () => {
    const m = createModel('tower.mittelalter.knacker');
    plinth(m, VIOLET);
    const GY = 0.64;
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    // Lafette mit vier Rädern
    for (const sx of [-1, 1]) {
      yaw.box({ size: [0.07, 0.09, 0.72], at: [sx * 0.15, TOP + 0.16, 0], color: WOOD, colorTop: WOOD_LIGHT });
      for (const z of [-0.24, 0.24]) {
        yaw.cyl({ r: 0.11, h: 0.05, seg: 8, at: [sx * 0.235, TOP + 0.11, z], rot: [0, 0, HALF], color: WOOD_DARK });
        yaw.cyl({ r: 0.04, h: 0.06, seg: 6, at: [sx * 0.24, TOP + 0.11, z], rot: [0, 0, HALF], color: IRON_LIGHT });
      }
      // Stützen der Wiege
      rod(yaw, [sx * 0.15, TOP + 0.2, 0.12], [sx * 0.08, GY - 0.05, 0], 0.032, WOOD_DARK, { seg: 4 });
      rod(yaw, [sx * 0.15, TOP + 0.2, -0.12], [sx * 0.08, GY - 0.05, 0], 0.032, WOOD_DARK, { seg: 4 });
    }
    for (const z of [-0.24, 0.24]) yaw.cyl({ r: 0.025, h: 0.48, seg: 5, at: [0, TOP + 0.11, z], rot: [0, 0, HALF], color: IRON });
    yaw.box({ size: [0.36, 0.05, 0.1], at: [0, TOP + 0.2, -0.3], color: WOOD });
    yaw.box({ size: [0.16, 0.06, 0.1], at: [0, GY - 0.06, 0], color: WOOD });
    // Wimpelstange hinten links
    rod(yaw, [-0.17, TOP + 0.2, -0.24], [-0.17, 1.2, -0.24], 0.022, WOOD_DARK, { seg: 4 });
    const pennon = m.part('pennon', { parent: 'yaw', pivot: [-0.17, 1.15, -0.24] });
    pennon.extrude({ points: [[0, 0], [0.22, -0.06], [0, -0.12]], depth: 0.02, at: [-0.17, 1.18, -0.24], rot: [0, HALF, 0], color: VIOLET, colorTop: VIOLET_LIGHT });

    const gun = m.part('gun', { parent: 'yaw', pivot: [0, GY, 0] });
    gun.box({ size: [0.11, 0.08, 0.86], at: [0, GY, 0.02], color: WOOD, colorTop: WOOD_LIGHT });
    gun.box({ size: [0.045, 0.02, 0.84], at: [0, GY + 0.045, 0.02], color: WOOD_DARK });
    gun.box({ size: [0.125, 0.09, 0.06], at: [0, GY, 0.42], color: VIOLET });
    // Bogenkopf
    const BZ = 0.24;
    gun.box({ size: [0.2, 0.13, 0.11], at: [0, GY + 0.01, BZ], color: WOOD_DARK });
    gun.box({ size: [0.21, 0.03, 0.12], at: [0, GY + 0.08, BZ], color: VIOLET });
    for (const [name, s] of /** @type {[string, number][]} */ ([['armL', -1], ['armR', 1]])) {
      const arm = m.part(name, { parent: 'gun', pivot: [s * 0.09, GY + 0.01, BZ] });
      arm.box({ size: [0.2, 0.06, 0.06], at: [s * 0.19, GY + 0.01, BZ - 0.02], rot: [0, s * 0.2, 0], color: WOOD_LIGHT });
      arm.box({ size: [0.16, 0.05, 0.05], at: [s * 0.35, GY + 0.01, BZ - 0.1], rot: [0, s * 0.55, 0], color: WOOD_LIGHT });
      arm.box({ size: [0.05, 0.06, 0.06], at: [s * 0.42, GY + 0.01, BZ - 0.15], rot: [0, s * 0.55, 0], color: VIOLET });
      const clad = m.part(name + 'Iron', { parent: name, pivot: [s * 0.09, GY + 0.01, BZ], minLevel: 2 });
      clad.box({ size: [0.1, 0.075, 0.075], at: [s * 0.16, GY + 0.01, BZ - 0.01], rot: [0, s * 0.2, 0], color: IRON, colorTop: IRON_LIGHT });
      clad.box({ size: [0.06, 0.065, 0.065], at: [s * 0.3, GY + 0.01, BZ - 0.07], rot: [0, s * 0.45, 0], color: IRON, colorTop: IRON_LIGHT });
    }
    const str = m.part('string', { parent: 'gun', pivot: [0, GY + 0.04, BZ - 0.17] });
    rod(str, [0.43, GY + 0.04, BZ - 0.17], [0, GY + 0.04, -0.27], 0.012, CLOTH, { seg: 3 });
    rod(str, [-0.43, GY + 0.04, BZ - 0.17], [0, GY + 0.04, -0.27], 0.012, CLOTH, { seg: 3 });
    const bolt = m.part('bolt', { parent: 'gun', pivot: [0, GY + 0.075, 0] });
    rod(bolt, [0, GY + 0.08, -0.26], [0, GY + 0.08, 0.4], 0.036, WOOD_DARK, { seg: 5 });
    bolt.cone({ r: 0.055, h: 0.12, seg: 4, at: [0, GY + 0.075, 0.45], rot: [HALF, 0, 0], color: IRON_LIGHT });
    bolt.box({ size: [0.014, 0.08, 0.11], at: [0, GY + 0.1, -0.2], color: VIOLET });
    bolt.box({ size: [0.08, 0.014, 0.11], at: [0, GY + 0.075, -0.2], color: VIOLET });
    // Winde am Ende des Schafts
    const WZ = -0.36;
    gun.box({ size: [0.03, 0.12, 0.08], at: [0.12, GY - 0.02, WZ], color: WOOD_DARK, mirror: true });
    const winch = m.part('winch', { parent: 'gun', pivot: [0, GY - 0.02, WZ] });
    winch.cyl({ r: 0.055, h: 0.22, seg: 7, at: [0, GY - 0.02, WZ], rot: [0, 0, HALF], color: ROPE });
    winch.box({ size: [0.03, 0.24, 0.03], at: [0.125, GY - 0.02, WZ], color: WOOD_DARK, mirror: true });
    winch.box({ size: [0.03, 0.03, 0.24], at: [0.125, GY - 0.02, WZ], color: WOOD_DARK, mirror: true });

    // Stufe 2: eisenbeschlagener Bogen (siehe Arme)
    tier2(m, VIOLET);

    // Stufe 3: zweite Winde und eine Sturmwand vorn
    tier3(m, VIOLET);
    const winch3 = m.part('winch3', { parent: 'yaw', pivot: [0, TOP + 0.24, -0.3], minLevel: 3 });
    winch3.cyl({ r: 0.06, h: 0.26, seg: 7, at: [0, TOP + 0.26, -0.3], rot: [0, 0, HALF], color: ROPE });
    winch3.box({ size: [0.03, 0.26, 0.03], at: [0.145, TOP + 0.26, -0.3], color: WOOD_DARK, mirror: true });
    winch3.box({ size: [0.03, 0.03, 0.26], at: [0.145, TOP + 0.26, -0.3], color: WOOD_DARK, mirror: true });
    const mant = m.part('mantlet3', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 3 });
    mant.box({ size: [0.5, 0.26, 0.05], base: [0, TOP + 0.13, 0.36], rot: [-0.15, 0, 0], color: WOOD, colorTop: WOOD_LIGHT });
    mant.box({ size: [0.52, 0.04, 0.055], at: [0, TOP + 0.36, 0.33], rot: [-0.15, 0, 0], color: VIOLET });
    for (const x of [-0.16, 0, 0.16]) mant.box({ size: [0.03, 0.26, 0.056], base: [x, TOP + 0.13, 0.362], rot: [-0.15, 0, 0], color: WOOD_DARK });

    m.point('muzzle', [0, GY + 0.075, 0.52], 'gun');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw', 'gun', 0.3);
        const f = ctx.fire;
        // Sichtbares Spannen: die Winde dreht, die Bogenarme biegen sich zurück, dann liegt der Bolzen auf.
        const d = smooth(ctx.charge * 1.3) * (1 - smooth(f * 4));
        const rel = 1 - d;
        pose.armL.rotation.y = 0.6 * rel;
        pose.armR.rotation.y = -0.6 * rel;
        pose.string.scale.z = Math.max(0.03, d);
        pose.string.position.z = rel * 0.16;
        const turn = -Math.min(ctx.charge, 0.77) * TAU * 2;
        pose.winch.rotation.x = turn;
        pose.bolt.scale.setScalar(Math.max(1e-3, smooth((ctx.charge - 0.5) * 6) * (1 - smooth(f * 3))));
        pose.gun.position.z = -f * f * 0.06;
        pose.gun.rotation.x -= f * f * 0.05;
        pose.yaw.position.z = -f * f * 0.03;
        pose.pennon.rotation.y = Math.sin((ctx.t * 0.7 + ctx.seed) * TAU) * 0.3;
        if (ctx.level >= 3) pose.winch3.rotation.x = -turn;
      },
    });
  },

  // Brenner: Feuersiphon. Bronzekessel auf gemauertem Sockel, Pumpenschwengel, langes Rohr mit rotem Drachenkopf.
  'tower.mittelalter.brenner': () => {
    const m = createModel('tower.mittelalter.brenner');
    const base = plinth(m, RED);
    const MY = TOP + 0.13;
    base.box({ size: [0.5, MY - TOP + 0.01, 0.5], base: [0, TOP - 0.01, -0.02], color: STONE, colorTop: STONE_LIGHT });
    base.box({ size: [0.52, 0.03, 0.52], base: [0, MY - 0.01, -0.02], color: STONE_LIGHT });
    const head = m.part('head', { pivot: [0, MY, 0] });
    head.cyl({ r: 0.24, h: 0.03, seg: 8, base: [0, MY + 0.015, -0.05], color: WOOD_DARK, colorTop: WOOD });
    // Liegender Bronzetank auf zwei Sätteln
    const TZ = -0.12;
    const TY = MY + 0.2;
    for (const z of [TZ - 0.12, TZ + 0.12]) head.box({ size: [0.3, 0.09, 0.07], base: [0, MY + 0.02, z], color: WOOD, colorTop: WOOD_LIGHT });
    const tank = m.part('tank', { parent: 'head', pivot: [0, MY + 0.05, TZ] });
    tank.cyl({ r: 0.15, h: 0.34, seg: 9, at: [0, TY, TZ], rot: [HALF, 0, 0], color: BRONZE, shade: 0 });
    tank.sphere({ r: 0.15, detail: 1, at: [0, TY, TZ - 0.17], scale: [1, 1, 0.45], color: BRONZE, colorTop: BRONZE_LIGHT });
    tank.sphere({ r: 0.15, detail: 1, at: [0, TY, TZ + 0.17], scale: [1, 1, 0.45], color: BRONZE, colorTop: BRONZE_LIGHT });
    for (const z of [TZ - 0.09, TZ + 0.09]) tank.cyl({ r: 0.158, h: 0.035, seg: 9, at: [0, TY, z], rot: [HALF, 0, 0], color: BRONZE_DARK, shade: 0 });
    tank.box({ size: [0.16, 0.012, 0.3], at: [0, TY + 0.148, TZ], color: BRONZE_LIGHT });
    // Pumpe: Zylinder, Gabel und Schwengel
    tank.cyl({ r: 0.055, h: 0.13, seg: 7, base: [0, TY + 0.12, TZ + 0.08], color: BRONZE_DARK, colorTop: BRONZE });
    tank.cyl({ r: 0.065, h: 0.025, seg: 7, base: [0, TY + 0.25, TZ + 0.08], color: RED });
    tank.box({ size: [0.03, 0.17, 0.04], base: [0.05, TY + 0.13, TZ - 0.1], color: WOOD_DARK, mirror: true });
    const lever = m.part('lever', { parent: 'head', pivot: [0, TY + 0.29, TZ - 0.1] });
    lever.box({ size: [0.05, 0.045, 0.48], at: [0, TY + 0.3, TZ - 0.04], color: WOOD_LIGHT });
    lever.box({ size: [0.1, 0.055, 0.07], at: [0, TY + 0.3, TZ - 0.27], color: RED, colorTop: RED_LIGHT });
    rod(lever, [0, TY + 0.3, TZ + 0.08], [0, TY + 0.22, TZ + 0.08], 0.022, IRON_LIGHT, { seg: 4 });
    // Rohr nach vorn
    const NZ = 0.22;
    const NY = MY + 0.17;
    /**
     * Rohr vom Tank zum Kopf.
     * @param {PartBuilder} p
     * @param {number} x
     */
    const pipe = (p, x) => {
      rod(p, [x * 0.4, NY - 0.02, TZ + 0.2], [x, NY, NZ], 0.04, BRONZE, { seg: 6 });
      p.cyl({ r: 0.052, h: 0.03, seg: 6, at: [x * 0.8, NY, NZ - 0.05], rot: [HALF, 0, 0], color: BRONZE_DARK });
    };
    const one = m.part('nozzle', { parent: 'head', pivot: [0, NY, NZ], maxLevel: 2 });
    pipe(one, 0);
    dragonHead(one, 0, NY, NZ, 1);
    const pilot = m.part('pilot', { parent: 'head', pivot: [0, NY, NZ + 0.19] });
    pilot.cone({ r: 0.04, h: 0.1, seg: 5, base: [0, NY, NZ + 0.19], rot: [1.2, 0, 0], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    const jet = m.part('jet', { parent: 'head', pivot: [0, NY, NZ + 0.2] });
    jet.cone({ r: 0.08, h: 0.08, seg: 6, base: [0, NY, NZ + 0.2], rot: [HALF, 0, 0], color: EMBER, colorTop: EMBER_LIGHT, glow: true });

    // Stufe 2: größerer Tank (Skalierung im animate), rotes Banner
    tier2(m, RED);
    const bp = m.part('banner2', { parent: 'head', pivot: [-0.2, MY, -0.25], minLevel: 2 });
    rod(bp, [-0.22, MY + 0.02, -0.28], [-0.22, MY + 0.85, -0.28], 0.02, WOOD_DARK, { seg: 4 });
    bp.box({ size: [0.2, 0.025, 0.025], at: [-0.22, MY + 0.82, -0.28], rot: [0, HALF, 0], color: WOOD_DARK });
    const cloth = m.part('cloth2', { parent: 'banner2', pivot: [-0.22, MY + 0.82, -0.28], minLevel: 2 });
    cloth.extrude({ points: [[-0.09, 0], [0.09, 0], [0.09, -0.24], [0, -0.3], [-0.09, -0.24]], depth: 0.02, at: [-0.22, MY + 0.81, -0.28], rot: [0, HALF, 0], color: RED, colorTop: RED_LIGHT });
    cloth.box({ size: [0.025, 0.06, 0.06], at: [-0.22, MY + 0.66, -0.28], color: GOLD });

    // Stufe 3: zwei Drachenköpfe
    tier3(m, RED);
    const twin = m.part('twin3', { parent: 'head', pivot: [0, NY, NZ], minLevel: 3 });
    for (const x of [-0.1, 0.1]) {
      pipe(twin, x);
      dragonHead(twin, x, NY, NZ, 0.85);
    }

    m.point('muzzle', [0, NY, NZ + 0.22], 'head');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'head');
        const f = ctx.fire;
        if (ctx.level >= 2) pose.tank.scale.set(1.12, 1.14, 1.08);
        // Der Schwengel pumpt ruhig, schneller mit Ziel, und schlägt beim Stoß durch.
        const rate = 0.5 + 1.4 * ctx.active;
        pose.lever.rotation.x = Math.sin((ctx.t * rate + ctx.seed) * TAU) * 0.22 + f * 0.25;
        const flick = Math.sin(ctx.t * 13 + ctx.seed * 9) * 0.15 + Math.sin(ctx.t * 19.7) * 0.1;
        pose.pilot.scale.setScalar(0.9 + flick + f * 0.3);
        const j = Math.max(1e-3, f * (1 + flick * 0.5));
        pose.jet.scale.set(j * (ctx.level >= 3 ? 2.2 : 1), j, j * 6);
        if (ctx.level >= 3) pose.pilot.scale.x *= 2.2;
        if (ctx.level >= 2) pose.cloth2.rotation.y = Math.sin((ctx.t * 0.6 + ctx.seed) * TAU) * 0.25;
      },
    });
  },

  // Taktgeber: Glockenturm. Schlanker Fachwerk-Glockenstuhl, goldene Glocke schwingt im Takt, geschindelter Helm.
  'tower.mittelalter.taktgeber': () => {
    const m = createModel('tower.mittelalter.taktgeber');
    const base = plinth(m, GOLD);
    const BY = 0.95;
    const RY = 1.42;
    // vier Pfosten, nach oben leicht verjüngt, mit Kreuzstreben im Unterbau
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        rod(base, [sx * 0.23, TOP - 0.01, sz * 0.23], [sx * 0.175, RY, sz * 0.175], 0.036, WOOD, { seg: 4, colorTop: WOOD_LIGHT });
      }
      rod(base, [sx * 0.22, TOP + 0.05, -0.22], [sx * 0.185, BY - 0.05, 0.185], 0.022, WOOD_DARK, { seg: 4 });
      rod(base, [-0.22, TOP + 0.05, sx * 0.22], [0.185, BY - 0.05, sx * 0.185], 0.022, WOOD_DARK, { seg: 4 });
    }
    // Boden der Glockenstube mit Brüstung, Glockenbalken
    base.box({ size: [0.46, 0.05, 0.46], at: [0, BY - 0.02, 0], color: WOOD_DARK, colorTop: WOOD });
    for (const s of [-1, 1]) {
      base.box({ size: [0.4, 0.035, 0.035], at: [0, BY + 0.11, s * 0.19], color: WOOD_LIGHT });
      base.box({ size: [0.035, 0.035, 0.4], at: [s * 0.19, BY + 0.11, 0], color: WOOD_LIGHT });
    }
    base.box({ size: [0.42, 0.055, 0.06], at: [0, RY - 0.05, 0], color: WOOD_DARK });
    // Helm aus Schindeln mit goldener Kugel
    base.box({ size: [0.42, 0.04, 0.42], at: [0, RY, 0], color: WOOD_DARK });
    base.pyramid({ size: [0.48, 0.2, 0.48], base: [0, RY + 0.02, 0], color: SHINGLE, colorTop: SHINGLE_LIGHT });
    base.pyramid({ size: [0.29, 0.3, 0.29], base: [0, RY + 0.15, 0], color: SHINGLE, colorTop: SHINGLE_LIGHT });
    base.sphere({ r: 0.05, detail: 0, at: [0, RY + 0.46, 0], color: GOLD, colorTop: GOLD_LIGHT });
    // Leiter vorn
    for (const sx of [-1, 1]) rod(base, [sx * 0.07, TOP, 0.33], [sx * 0.07, BY - 0.02, 0.22], 0.018, WOOD_DARK, { seg: 4 });
    for (let i = 0; i < 4; i++) base.box({ size: [0.15, 0.025, 0.03], at: [0, 0.37 + i * 0.15, 0.31 - i * 0.024], color: WOOD_LIGHT });

    // Große Glocke: hängt tief genug, dass man sie unter dem Helm sieht
    const HY = RY - 0.08;
    const bell = m.part('bell', { pivot: [0, HY, 0] });
    bell.box({ size: [0.06, 0.05, 0.06], at: [0, HY - 0.015, 0], color: IRON });
    bell.lathe({ points: BELL, seg: 9, base: [0, HY - 0.255, 0], scale: 1.32, color: GOLD, colorTop: GOLD_LIGHT });
    bell.torus({ r: 0.135, tube: 0.016, seg: 9, tubeSeg: 3, at: [0, HY - 0.235, 0], color: GOLD_LIGHT });
    const clap = m.part('clapper', { parent: 'bell', pivot: [0, HY - 0.08, 0] });
    rod(clap, [0, HY - 0.08, 0], [0, HY - 0.25, 0], 0.013, IRON, { seg: 3 });
    clap.sphere({ r: 0.035, detail: 0, at: [0, HY - 0.26, 0], color: IRON });

    // Stufe 2: steinernes Untergeschoss
    tier2(m, GOLD);
    const st = m.part('storey2', { minLevel: 2 });
    st.box({ size: [0.5, 0.36, 0.5], base: [0, TOP - 0.01, 0], color: STONE, colorTop: STONE_LIGHT });
    st.box({ size: [0.53, 0.04, 0.53], base: [0, TOP + 0.35, 0], color: STONE_LIGHT });
    st.box({ size: [0.13, 0.2, 0.02], base: [0, TOP, 0.252], color: WOOD_DARK });
    st.box({ size: [0.04, 0.09, 0.02], at: [0.17, TOP + 0.24, 0.252], color: SLIT, mirror: true });

    // Stufe 3: Schlagglocke unter einem kleinen Dach vorn an der Glockenstube und ein goldener Wetterhahn
    tier3(m, GOLD);
    const SZ = 0.27;
    const SY = RY - 0.06;
    const t3 = m.part('hood3', { minLevel: 3 });
    t3.box({ size: [0.05, 0.05, 0.16], at: [0, SY + 0.02, SZ - 0.07], color: WOOD_DARK });
    t3.roof({ size: [0.16, 0.08, 0.2], base: [0, SY + 0.045, SZ - 0.02], rot: [0, HALF, 0], color: SHINGLE, colorTop: SHINGLE_LIGHT });
    const bell3 = m.part('bell3', { pivot: [0, SY, SZ], minLevel: 3 });
    bell3.box({ size: [0.04, 0.04, 0.04], at: [0, SY - 0.01, SZ], color: IRON });
    bell3.lathe({ points: BELL, seg: 8, base: [0, SY - 0.15, SZ], scale: 0.8, color: GOLD, colorTop: GOLD_LIGHT });
    const vane = m.part('vane3', { minLevel: 3 });
    rod(vane, [0, RY + 0.48, 0], [0, RY + 0.66, 0], 0.017, IRON, { seg: 4 });
    vane.box({ size: [0.18, 0.02, 0.02], at: [0, RY + 0.56, 0], color: IRON });
    vane.box({ size: [0.02, 0.02, 0.18], at: [0, RY + 0.56, 0], color: IRON });
    const cock = m.part('cock3', { pivot: [0, RY + 0.66, 0], minLevel: 3 });
    cock.extrude({
      points: [[-0.13, 0.02], [0.05, 0], [0.09, 0.05], [0.12, 0.06], [0.09, 0.09], [0.07, 0.16], [0.02, 0.14], [0.01, 0.07], [-0.06, 0.06], [-0.14, 0.16], [-0.11, 0.06]],
      depth: 0.04, base: [0, RY + 0.65, 0], rot: [0, -HALF, 0], color: GOLD, colorTop: GOLD_LIGHT,
    });
    cock.box({ size: [0.03, 0.03, 0.03], at: [0, RY + 0.795, -0.085], color: RED });

    return m.build({
      animate(pose, ctx) {
        // Die Glocke schwingt mit der Musik (104 BPM) und schlägt an den Umkehrpunkten an.
        const beat = ctx.t * BEAT + ctx.seed;
        const pb = beat - Math.floor(beat);
        const hit = (1 - pb) * (1 - pb) * (1 - pb);
        const sw = Math.cos(beat * Math.PI) * (0.45 + 0.1 * ctx.fire);
        pose.bell.rotation.z = sw;
        pose.clapper.rotation.z = -sw * 0.35;
        pose.bell.scale.setScalar(1 + hit * 0.04);
        if (ctx.level >= 3) {
          // Die Schlagglocke antwortet auf jeden zweiten Schlag.
          const half = beat * 0.5 - Math.floor(beat * 0.5);
          pose.bell3.rotation.x = Math.sin(half * TAU) * 0.35 * (1 - half);
          pose.cock3.rotation.y = ctx.t * 0.8 + Math.sin(ctx.t * 1.7) * 0.4;
        }
      },
    });
  },
};
