// @ts-check
// Türme des Römischen Reichs: Bogenschütze, Onager, Ölamphoren-Werfer, Skorpion, Glutpfanne, Feldzeichen.
// Alle stehen auf demselben achteckigen Quadersockel mit einem Band in der Rollenfarbe (gleiche Lage wie in der Steinzeit).

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, PoseNode, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;

// --- Materialfarben des Zeitalters ---
const STONE = '#d8cdb8';
const STONE_DARK = '#b5a98f';
const STONE_LIGHT = '#efe7d6';
const WOOD = '#a9753f';
const WOOD_LIGHT = '#cc9c60';
const WOOD_DARK = '#845a33';
const SKIN = '#e3b48d';
const HAIR = '#3a281c';
const DARK = '#2a1e16';
const TUNIC = '#f1ebdd';
const TUNIC_SHADE = '#d9cfba';
const LEATHER = '#96643a';
const LEATHER_LIGHT = '#b98652';
const BRONZE = '#b9853a';
const BRONZE_LIGHT = '#dfb25c';
const IRON = '#8a9099';
const TERRA = '#c8683c';
const TERRA_LIGHT = '#e39263';
const ROPE = '#dcc698';
const ROMAN_RED = '#c0392b';
const OIL = '#b9c832';
const EMBER = '#ff8a2a';
const EMBER_LIGHT = '#ffd35e';

// --- Rollenfarben ---
const BLUE = '#3d7dd8';
const ORANGE = '#e8842a';
const TEAL = '#26b5a8';
const VIOLET = '#8a55d6';
const RED = '#d8432f';
const GOLD = '#f2c230';
const GOLD_LIGHT = '#ffe07a';

/** Oberkante des Sockels. */
const TOP = 0.235;

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
 * Sockel aus behauenem Stein mit Band in der Rollenfarbe und dem ersten Stufenpunkt.
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
 * Teil der Stufe 2: zweites Farbband, vier Ecksteine mit Bronzeknauf, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.455, h: 0.045, seg: 8, base: [0, 0.015, 0], color: role, shade: 0.1 });
  for (const [x, z] of [[0.31, 0.31], [-0.31, 0.31], [-0.31, -0.31], [0.31, -0.31]]) {
    p.box({ size: [0.15, 0.13, 0.15], base: [x, -0.03, z], rot: [0, Math.PI / 4, 0], color: STONE, colorTop: STONE_LIGHT });
    p.pyramid({ size: [0.09, 0.04, 0.09], base: [x, 0.1, z], rot: [0, Math.PI / 4, 0], color: BRONZE_LIGHT });
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
 * Römer ohne Arme: Beine, Tunika, großer Kopf. Füße bei (x, y, z), Blick nach +Z.
 * Schultern liegen bei y + 0.25; der Scheitel bei etwa y + 0.47. Mit `side` steht der Körper quer (Bogenschütze).
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ tunic?: string, tunicTop?: string, band?: string, cap?: 'leather' | 'helmet' | 'hair', crest?: string, side?: boolean }} [o]
 */
function person(p, x, y, z, o = {}) {
  const side = o.side ?? false;
  const lx = side ? 0 : 0.05;
  const lz = side ? 0.05 : 0;
  p.box({ size: [0.06, 0.1, 0.07], base: [x - lx, y, z - lz], color: SKIN });
  p.box({ size: [0.06, 0.1, 0.07], base: [x + lx, y, z + lz], color: SKIN });
  const w = side ? 0.135 : 0.2;
  const d = side ? 0.2 : 0.135;
  p.box({ size: [w, 0.19, d], base: [x, y + 0.08, z], color: o.tunic ?? TUNIC_SHADE, colorTop: o.tunicTop ?? TUNIC });
  p.box({ size: [w + 0.012, 0.03, d + 0.012], at: [x, y + 0.15, z], color: LEATHER });
  if (o.band) p.box({ size: [w + 0.016, 0.045, d + 0.016], at: [x, y + 0.255, z], color: o.band });
  p.sphere({ r: 0.095, at: [x, y + 0.36, z + 0.01], color: SKIN });
  p.box({ size: [0.022, 0.026, 0.012], at: [x + 0.035, y + 0.36, z + 0.108], color: DARK });
  p.box({ size: [0.022, 0.026, 0.012], at: [x - 0.035, y + 0.36, z + 0.108], color: DARK });
  const cap = o.cap ?? 'hair';
  if (cap === 'helmet') {
    p.dome({ r: 0.107, seg: 7, rings: 2, at: [x, y + 0.365, z - 0.005], color: BRONZE, colorTop: BRONZE_LIGHT });
    p.box({ size: [0.2, 0.02, 0.04], at: [x, y + 0.375, z + 0.085], color: BRONZE_LIGHT });
    p.box({ size: [0.045, 0.085, 0.2], at: [x, y + 0.49, z - 0.01], color: o.crest ?? ROMAN_RED });
  } else {
    p.dome({ r: 0.105, seg: 6, rings: 2, at: [x, y + 0.365, z - 0.012], color: cap === 'leather' ? LEATHER : HAIR, colorTop: cap === 'leather' ? LEATHER_LIGHT : HAIR });
    if (cap === 'leather' && o.band) p.cyl({ r: 0.108, h: 0.026, seg: 6, at: [x, y + 0.385, z - 0.01], color: o.band });
  }
}

/** Profil einer Amphore, Fuß bei y = 0, Höhe 0.31. @type {[number, number][]} */
const AMPHORA = [[0, 0], [0.025, 0.01], [0.065, 0.1], [0.09, 0.18], [0.07, 0.235], [0.035, 0.26], [0.035, 0.295], [0.052, 0.31], [0, 0.31]];

/**
 * Amphore aus Terrakotta mit Band in der Rollenfarbe.
 * @param {PartBuilder} p
 * @param {Vec3} base
 * @param {Vec3} rot
 * @param {number} scale
 * @param {string} [band]
 */
function amphora(p, base, rot, scale, band) {
  p.lathe({ points: AMPHORA, seg: 6, base, rot, scale, color: TERRA, colorTop: TERRA_LIGHT });
  if (band) p.lathe({ points: [[0, 0], [0.05, 0.262], [0.05, 0.293], [0, 0.293]], seg: 6, base, rot, scale, color: band });
}

/**
 * Bogenschütze in Seitstellung mit eigenen Teilen für Bogenarm, Zugarm, Sehne und Pfeil.
 * Teile heißen `name`, `name + 'Bow'`, `name + 'Draw'`, `name + 'String'`, `name + 'Arrow'`.
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {number} Y Standhöhe
 * @param {number} minLevel
 */
function archer(m, name, Y, minLevel) {
  const fig = m.part(name, { pivot: [0, Y, 0], minLevel });
  person(fig, -0.045, Y, 0, { side: true, band: BLUE, cap: 'leather' });
  // Köcher auf dem Rücken
  fig.box({ size: [0.07, 0.2, 0.08], at: [-0.145, Y + 0.24, -0.03], rot: [0.35, 0, 0], color: LEATHER, colorTop: LEATHER_LIGHT });
  fig.box({ size: [0.05, 0.05, 0.06], at: [-0.145, Y + 0.355, -0.075], rot: [0.35, 0, 0], color: TUNIC });
  const BX = 0.075;
  const SH = Y + 0.28;
  const ZS = 0.215;
  const bow = m.part(name + 'Bow', { parent: name, pivot: [BX, SH, 0.1], minLevel });
  rod(bow, [BX - 0.03, SH - 0.03, 0.09], [BX, SH, 0.3], 0.028, SKIN, { seg: 4 });
  bow.torus({ r: 0.21, tube: 0.024, seg: 8, tubeSeg: 4, arc: 2, at: [BX, SH, 0.1], rot: [HALF - 1, 0, HALF], color: WOOD_DARK });
  bow.box({ size: [0.05, 0.07, 0.05], at: [BX, SH, 0.31], color: BLUE });
  const str = m.part(name + 'String', { parent: name + 'Bow', pivot: [BX, SH, ZS], minLevel });
  rod(str, [BX, SH + 0.175, ZS], [BX, SH, ZS - 0.17], 0.011, TUNIC, { seg: 3 });
  rod(str, [BX, SH - 0.175, ZS], [BX, SH, ZS - 0.17], 0.011, TUNIC, { seg: 3 });
  const draw = m.part(name + 'Draw', { parent: name, pivot: [BX, SH, -0.09], minLevel });
  rod(draw, [BX - 0.02, SH - 0.03, -0.09], [BX + 0.035, SH - 0.02, 0.07], 0.028, SKIN, { seg: 4 });
  rod(draw, [BX + 0.035, SH - 0.02, 0.06], [BX, SH, ZS], 0.026, SKIN, { seg: 4 });
  const arrow = m.part(name + 'Arrow', { parent: name + 'Bow', pivot: [BX, SH, ZS], minLevel });
  rod(arrow, [BX, SH, ZS], [BX, SH, ZS + 0.27], 0.014, WOOD_LIGHT, { seg: 4 });
  arrow.cone({ r: 0.028, h: 0.07, seg: 4, at: [BX, SH, ZS + 0.3], rot: [HALF, 0, 0], color: IRON });
  arrow.box({ size: [0.012, 0.06, 0.07], at: [BX, SH, ZS + 0.035], color: STONE_LIGHT });
}

/**
 * Bewegung eines Bogenschützen: spannen, lösen, Pfeil nachlegen.
 * @param {PoseNode} fig
 * @param {PoseNode} bow
 * @param {PoseNode} str
 * @param {PoseNode} draw
 * @param {PoseNode} arrow
 * @param {number} charge
 * @param {number} fire
 * @param {number} active
 */
function animArcher(fig, bow, str, draw, arrow, charge, fire, active) {
  const d = smooth((charge - 0.2) / 0.6) * (0.25 + 0.75 * active);
  str.scale.z = Math.max(0.04, d);
  draw.position.z = -d * 0.17;
  arrow.position.z = -d * 0.17;
  arrow.scale.setScalar(Math.max(1e-3, smooth((charge - 0.08) * 8)));
  bow.rotation.x = -0.1 * d - fire * 0.12;
  fig.position.y = fire * 0.025;
  fig.rotation.x = -fire * 0.06;
}

/** Umriss eines Adlerflügels, Ansatz bei (0, 0), Spitze nach +X oben. @type {[number, number][]} */
const WING = [[0, -0.02], [0.1, -0.05], [0.2, 0], [0.3, 0.02], [0.36, 0.14], [0.24, 0.12], [0.12, 0.11], [0, 0.08]];

/**
 * Goldener Adler, Füße bei (x, y, z), Blick nach +Z.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} s Größe
 * @param {number} spread Flügelneigung (0 = waagerecht ausgebreitet, größer = erhoben)
 */
function eagle(p, x, y, z, s, spread) {
  p.sphere({ r: 0.085 * s, detail: 0, at: [x, y + 0.1 * s, z], scale: [0.9, 1.25, 0.9], color: GOLD, colorTop: GOLD_LIGHT });
  p.sphere({ r: 0.055 * s, detail: 0, at: [x, y + 0.22 * s, z + 0.03 * s], color: GOLD_LIGHT });
  p.cone({ r: 0.028 * s, h: 0.07 * s, seg: 4, at: [x, y + 0.21 * s, z + 0.095 * s], rot: [HALF + 0.3, 0, 0], color: BRONZE });
  p.extrude({ points: WING, depth: 0.035, at: [x + 0.05 * s, y + 0.12 * s, z - 0.02 * s], rot: [0, 0, spread], scale: s * 0.8, color: GOLD, colorTop: GOLD_LIGHT, mirror: true });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Bogenschütze auf einer hölzernen Wachplattform. Stufe 3 bringt ein Ziegeldach und einen zweiten Schützen im Unterbau.
  'tower.rom.schuetze': () => {
    const m = createModel('tower.rom.schuetze');
    const Y = 0.74;
    const base = plinth(m, BLUE);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        rod(base, [sx * 0.31, TOP - 0.02, sz * 0.31], [sx * 0.28, Y - 0.05, sz * 0.28], 0.042, WOOD, { seg: 4, colorTop: WOOD_LIGHT });
        base.box({ size: [0.055, 0.22, 0.055], base: [sx * 0.315, Y, sz * 0.315], color: WOOD });
        base.pyramid({ size: [0.085, 0.06, 0.085], base: [sx * 0.315, Y + 0.22, sz * 0.315], color: BLUE });
      }
    }
    // Kreuzstreben hinten, Kopfbänder an den Seiten
    // Leiter hinten
    for (const sx of [-1, 1]) rod(base, [sx * 0.085, TOP - 0.01, -0.43], [sx * 0.085, Y - 0.02, -0.35], 0.022, WOOD_DARK, { seg: 4 });
    for (let i = 0; i < 4; i++) base.box({ size: [0.17, 0.028, 0.035], at: [0, 0.31 + i * 0.105, -0.42 + i * 0.0175], color: WOOD_LIGHT });
    for (const sx of [-1, 1]) {
      rod(base, [sx * 0.295, 0.5, 0.29], [sx * 0.285, Y - 0.06, 0.1], 0.026, WOOD_DARK, { seg: 4 });
      rod(base, [sx * 0.295, 0.5, -0.29], [sx * 0.285, Y - 0.06, -0.1], 0.026, WOOD_DARK, { seg: 4 });
    }
    // Plattform mit blauer Kante und Geländer
    base.box({ size: [0.7, 0.035, 0.7], at: [0, Y - 0.04, 0], color: BLUE });
    base.box({ size: [0.67, 0.06, 0.67], at: [0, Y - 0.03, 0], color: WOOD, colorTop: WOOD_LIGHT });
    for (const x of [-0.17, 0, 0.17]) base.box({ size: [0.014, 0.01, 0.6], at: [x, Y + 0.001, 0], color: WOOD });
    base.cyl({ r: 0.215, h: 0.012, seg: 8, at: [0, Y + 0.004, 0], color: BLUE, shade: 0 });
    for (const s of [-1, 1]) {
      base.box({ size: [0.6, 0.04, 0.04], at: [0, Y + 0.185, s * 0.315], color: WOOD_LIGHT });
      base.box({ size: [0.04, 0.04, 0.6], at: [s * 0.315, Y + 0.185, 0], color: WOOD_LIGHT });
    }
    base.box({ size: [0.6, 0.03, 0.03], at: [0, Y + 0.09, -0.315], color: WOOD });

    archer(m, 'figure', Y, 1);

    // Stufe 2: blaue Schilde am Geländer
    const t2 = tier2(m, BLUE);
    for (const u of [-0.15, 0.15]) {
      for (const s of [-1, 1]) {
        t2.box({ size: [0.2, 0.22, 0.03], at: [u, Y + 0.09, s * 0.35], color: BLUE, colorTop: '#6da0ea' });
        t2.sphere({ r: 0.04, detail: 0, at: [u, Y + 0.09, s * 0.368], color: GOLD });
        t2.box({ size: [0.03, 0.22, 0.2], at: [s * 0.35, Y + 0.09, u], color: BLUE, colorTop: '#6da0ea' });
        t2.sphere({ r: 0.04, detail: 0, at: [s * 0.368, Y + 0.09, u], color: GOLD });
      }
    }

    // Stufe 3: Ziegeldach und zweiter Schütze im Unterbau
    const t3 = tier3(m, BLUE);
    const RY = Y + 0.66;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) t3.box({ size: [0.04, RY - Y - 0.2, 0.04], base: [sx * 0.315, Y + 0.2, sz * 0.315], color: WOOD });
    }
    t3.box({ size: [0.78, 0.035, 0.78], at: [0, RY, 0], color: BLUE });
    t3.pyramid({ size: [0.86, 0.25, 0.86], base: [0, RY + 0.015, 0], color: TERRA, colorTop: TERRA_LIGHT });
    t3.sphere({ r: 0.05, detail: 0, at: [0, RY + 0.275, 0], color: BLUE });
    archer(m, 'second', TOP, 3);

    m.point('muzzle', [0.075, Y + 0.28, 0.5], 'figure');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'figure');
        animArcher(pose.figure, pose.figureBow, pose.figureString, pose.figureDraw, pose.figureArrow, ctx.charge, ctx.fire, ctx.active);
        if (ctx.level >= 3) {
          pose.second.rotation.y += ctx.aimYaw;
          animArcher(pose.second, pose.secondBow, pose.secondString, pose.secondDraw, pose.secondArrow, ctx.charge, ctx.fire, ctx.active);
        }
      },
    });
  },

  // Werfer: Onager. Der Wurfarm schnellt aus der Spannlage nach vorn gegen den gepolsterten Prellbalken.
  'tower.rom.werfer': () => {
    const m = createModel('tower.rom.werfer');
    plinth(m, ORANGE);
    const AY = 0.47;
    const AZ = 0.1;
    const frame = m.part('frame', { pivot: [0, TOP, 0] });
    for (const sx of [-1, 1]) {
      frame.box({ size: [0.085, 0.09, 0.76], at: [sx * 0.19, 0.41, 0], color: WOOD, colorTop: WOOD_LIGHT });
      for (const z of [-0.25, 0.25]) {
        frame.cyl({ r: 0.105, h: 0.06, seg: 8, at: [sx * 0.285, 0.335, z], rot: [0, 0, HALF], color: WOOD_DARK });
        frame.cyl({ r: 0.04, h: 0.075, seg: 6, at: [sx * 0.285, 0.335, z], rot: [0, 0, HALF], color: WOOD_LIGHT });
      }
      // Ständer und Streben des Prellbalkens
      rod(frame, [sx * 0.19, 0.44, 0.27], [sx * 0.19, 0.95, 0.27], 0.04, WOOD, { seg: 4 });
      rod(frame, [sx * 0.19, 0.44, -0.2], [sx * 0.19, 0.86, 0.25], 0.03, WOOD_DARK, { seg: 4 });
      frame.cyl({ r: 0.095, h: 0.04, seg: 7, at: [sx * 0.25, AY, AZ], rot: [0, 0, HALF], color: WOOD_DARK });
    }
    frame.box({ size: [0.46, 0.08, 0.08], at: [0, 0.41, 0.34], color: WOOD_LIGHT });
    frame.box({ size: [0.46, 0.08, 0.08], at: [0, 0.41, -0.34], color: WOOD_LIGHT });
    // Spannbündel quer
    frame.cyl({ r: 0.07, h: 0.46, seg: 7, at: [0, AY, AZ], rot: [0, 0, HALF], color: ROPE });
    // Prellbalken mit Polster
    frame.box({ size: [0.48, 0.1, 0.09], at: [0, 0.94, 0.27], color: WOOD, colorTop: WOOD_LIGHT });
    frame.box({ size: [0.34, 0.02, 0.095], at: [0, 0.995, 0.27], color: ORANGE });
    frame.box({ size: [0.24, 0.15, 0.07], at: [0, 0.93, 0.2], color: TUNIC });
    frame.box({ size: [0.05, 0.16, 0.08], at: [0.075, 0.93, 0.2], color: ORANGE, mirror: true });
    // Oranger Schild an der Front
    frame.cyl({ r: 0.18, h: 0.035, seg: 8, at: [0, 0.54, 0.39], rot: [HALF - 0.3, 0, 0], color: ORANGE, colorTop: '#f5a652' });
    frame.sphere({ r: 0.055, detail: 0, at: [0, 0.55, 0.41], color: BRONZE_LIGHT });
    // Tontöpfe als Vorrat
    frame.sphere({ r: 0.07, detail: 0, at: [-0.08, 0.5, -0.3], color: TERRA, colorTop: TERRA_LIGHT });
    frame.sphere({ r: 0.07, detail: 0, at: [0.07, 0.5, -0.32], rot: [0, 1, 0], color: TERRA, colorTop: TERRA_LIGHT });

    const arm = m.part('arm', { pivot: [0, AY, AZ], parent: 'frame' });
    rod(arm, [0, AY - 0.03, AZ], [0, AY + 0.56, AZ], 0.042, WOOD_LIGHT, { rTop: 0.034, seg: 6 });
    arm.cyl({ r: 0.05, h: 0.06, seg: 6, at: [0, AY + 0.4, AZ], color: ORANGE });
    const cup = m.part('cup', { pivot: [0, AY, AZ], parent: 'arm', maxLevel: 2 });
    cup.cyl({ r: 0.06, rTop: 0.11, h: 0.07, seg: 7, at: [0, AY + 0.57, AZ + 0.045], rot: [HALF, 0, 0], color: BRONZE, colorTop: BRONZE_LIGHT });
    m.part('load', { pivot: [0, AY + 0.57, AZ + 0.11], parent: 'cup', maxLevel: 2 }).sphere({ r: 0.085, detail: 0, at: [0, AY + 0.57, AZ + 0.11], color: TERRA, colorTop: TERRA_LIGHT });

    // Stufe 2: Bronzebeschläge, oranger Wimpel
    tier2(m, ORANGE);
    const fit2 = m.part('fit2', { parent: 'frame', pivot: [0, TOP, 0], minLevel: 2 });
    for (const sx of [-1, 1]) {
      fit2.box({ size: [0.1, 0.105, 0.06], at: [sx * 0.19, 0.41, 0.37], color: BRONZE_LIGHT });
      fit2.box({ size: [0.1, 0.105, 0.06], at: [sx * 0.19, 0.41, -0.37], color: BRONZE_LIGHT });
      fit2.cyl({ r: 0.1, h: 0.03, seg: 7, at: [sx * 0.275, AY, AZ], rot: [0, 0, HALF], color: BRONZE_LIGHT });
      fit2.box({ size: [0.1, 0.05, 0.1], at: [sx * 0.19, 0.99, 0.27], color: BRONZE_LIGHT });
    }
    rod(fit2, [-0.19, 0.44, -0.3], [-0.19, 1.2, -0.3], 0.022, WOOD_DARK, { seg: 4 });
    const pennant = m.part('pennant', { parent: 'fit2', pivot: [-0.19, 1.12, -0.3], minLevel: 2 });
    pennant.extrude({ points: [[0, -0.08], [0.2, 0], [0, 0.08]], depth: 0.02, at: [-0.19, 1.12, -0.3], rot: [0, HALF, 0], color: ORANGE, colorTop: '#f5a652' });

    // Stufe 3: längerer Arm, rauchende Feuertöpfe
    tier3(m, ORANGE);
    const cup3 = m.part('cup3', { pivot: [0, AY, AZ], parent: 'arm', minLevel: 3 });
    rod(cup3, [0, AY + 0.52, AZ], [0, AY + 0.68, AZ], 0.036, WOOD_LIGHT, { seg: 6 });
    cup3.cyl({ r: 0.065, rTop: 0.12, h: 0.075, seg: 7, at: [0, AY + 0.69, AZ + 0.045], rot: [HALF, 0, 0], color: BRONZE, colorTop: BRONZE_LIGHT });
    const load3 = m.part('load3', { pivot: [0, AY + 0.69, AZ + 0.115], parent: 'cup3', minLevel: 3 });
    load3.sphere({ r: 0.09, detail: 0, at: [0, AY + 0.69, AZ + 0.115], color: TERRA, colorTop: TERRA_LIGHT });
    load3.sphere({ r: 0.055, detail: 0, at: [0, AY + 0.69, AZ + 0.185], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    const pots3 = m.part('pots3', { parent: 'frame', pivot: [0, TOP, 0], minLevel: 3 });
    pots3.sphere({ r: 0.05, detail: 0, at: [-0.08, 0.565, -0.3], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    pots3.sphere({ r: 0.05, detail: 0, at: [0.07, 0.565, -0.32], color: EMBER, colorTop: EMBER_LIGHT, glow: true });

    m.point('muzzle', [0, 1.25, 0.2], 'frame');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'frame');
        const f = ctx.fire;
        // Gespannt liegt der Arm hinten; beim Schuss schlägt er gegen das Polster und federt kurz nach.
        const back = ctx.level >= 3 ? 0.92 : 1.05;
        const cocked = smooth(ctx.charge * 2.2) * (1 - f);
        pose.arm.rotation.x = 0.07 - back * cocked + Math.sin(f * 9) * f * 0.06;
        pose.frame.position.y = f * f * 0.05;
        pose.frame.rotation.x = f * f * 0.05;
        const s = Math.max(1e-3, smooth((ctx.charge - 0.45) * 5) * (1 - smooth(f * 3)));
        pose.load.scale.setScalar(s);
        if (ctx.level >= 3) pose.load3.scale.setScalar(s);
        if (ctx.level >= 2) pose.pennant.rotation.y = Math.sin((ctx.t * 0.7 + ctx.seed) * TAU) * 0.25;
      },
    });
  },

  // Bremser: Ölamphoren-Werfer. Die Figur in türkiser Tunika schleudert Amphoren über den Kopf.
  'tower.rom.bremser': () => {
    const m = createModel('tower.rom.bremser');
    const base = plinth(m, TEAL);
    const FY = TOP + 0.09;
    const FZ = 0.1;
    base.cyl({ r: 0.2, rTop: 0.18, h: 0.1, seg: 8, base: [0, TOP - 0.01, FZ], color: STONE, colorTop: STONE_LIGHT });
    base.cyl({ r: 0.2, h: 0.03, seg: 8, base: [0, TOP + 0.025, FZ], color: TEAL });
    // Amphorengestell hinten
    for (const sx of [-1, 1]) {
      base.box({ size: [0.05, 0.3, 0.05], base: [sx * 0.37, TOP - 0.01, -0.14], color: WOOD });
      base.box({ size: [0.05, 0.3, 0.05], base: [sx * 0.33, TOP - 0.01, -0.33], color: WOOD });
    }
    base.box({ size: [0.8, 0.045, 0.045], at: [0, 0.5, -0.14], color: WOOD_LIGHT });
    base.box({ size: [0.72, 0.045, 0.045], at: [0, 0.5, -0.33], color: WOOD_LIGHT });
    for (const x of [-0.24, 0, 0.24]) {
      amphora(base, [x, TOP + 0.01, -0.235], [0.12, x * 4, 0], 1.25, TEAL);
    }
    // Ölschale vorn
    base.cyl({ r: 0.085, rTop: 0.115, h: 0.07, seg: 7, base: [0.28, TOP, 0.2], color: STONE_DARK, colorTop: STONE });
    base.cyl({ r: 0.095, h: 0.02, seg: 7, base: [0.28, TOP + 0.06, 0.2], color: OIL });

    const figure = m.part('figure', { pivot: [0, FY, FZ] });
    person(figure, 0, FY, FZ, { tunic: '#1e9a90', tunicTop: TEAL, band: '#7fe0d4', cap: 'hair' });
    const SH = FY + 0.26;
    const arms = m.part('arms', { pivot: [0, SH, FZ], parent: 'figure', maxLevel: 2 });
    rod(arms, [0.13, SH, FZ], [0.085, SH + 0.27, FZ], 0.03, SKIN, { seg: 4 });
    rod(arms, [-0.13, SH, FZ], [-0.085, SH + 0.27, FZ], 0.03, SKIN, { seg: 4 });
    const load = m.part('load', { pivot: [0, SH + 0.35, FZ], parent: 'arms', maxLevel: 2 });
    amphora(load, [0, SH + 0.35, FZ - 0.17], [HALF, 0, 0], 1.15, TEAL);

    // Stufe 2: Sonnensegel, mehr Amphoren
    const t2 = tier2(m, TEAL);
    rod(t2, [-0.37, 0.5, -0.33], [-0.37, 1.2, -0.36], 0.024, WOOD, { seg: 4 });
    rod(t2, [0.37, 0.5, -0.33], [0.37, 1.2, -0.36], 0.024, WOOD, { seg: 4 });
    t2.box({ size: [0.84, 0.03, 0.34], at: [0, 1.23, -0.24], rot: [0.3, 0, 0], color: TUNIC });
    for (const x of [-0.28, 0, 0.28]) t2.box({ size: [0.14, 0.034, 0.345], at: [x, 1.23, -0.24], rot: [0.3, 0, 0], color: TEAL });
    amphora(t2, [-0.3, TOP, 0.17], [0, 0, 0], 1.05, TEAL);
    amphora(t2, [-0.06, TOP + 0.08, 0.3], [0, 0.5, HALF], 0.85, TEAL);

    // Stufe 3: hölzerner Wurfarm (Stabschleuder) ersetzt den Wurf von Hand
    tier3(m, TEAL);
    const arms3 = m.part('arms3', { pivot: [0, SH, FZ], parent: 'figure', minLevel: 3 });
    rod(arms3, [0.13, SH, FZ], [0.04, SH + 0.1, FZ + 0.13], 0.03, SKIN, { seg: 4 });
    rod(arms3, [-0.13, SH, FZ], [-0.04, SH + 0.16, FZ + 0.12], 0.03, SKIN, { seg: 4 });
    rod(arms3, [0, SH + 0.02, FZ + 0.15], [0, SH + 0.62, FZ + 0.03], 0.032, WOOD_LIGHT, { seg: 5 });
    arms3.cyl({ r: 0.04, h: 0.05, seg: 5, at: [0, SH + 0.45, FZ + 0.065], rot: [-0.2, 0, 0], color: TEAL });
    arms3.cyl({ r: 0.06, rTop: 0.115, h: 0.07, seg: 7, at: [0, SH + 0.63, FZ + 0.06], rot: [HALF - 0.2, 0, 0], color: LEATHER, colorTop: LEATHER_LIGHT });
    const load3 = m.part('load3', { pivot: [0, SH + 0.65, FZ + 0.1], parent: 'arms3', minLevel: 3 });
    amphora(load3, [0, SH + 0.65, FZ - 0.06], [HALF, 0, 0], 1.15, TEAL);

    m.point('muzzle', [0, SH + 0.5, FZ + 0.25], 'figure');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'figure');
        const f = ctx.fire;
        const wind = smooth((ctx.charge - 0.35) * 2.2) * ctx.active * (1 - f);
        const swing = -0.55 * wind + smooth(f * 1.6) * 1.15 + Math.sin(ctx.t * 1.3 + ctx.seed * 6) * 0.04;
        const s = Math.max(1e-3, smooth((ctx.charge - 0.2) * 5) * (1 - smooth(f * 3)));
        if (ctx.level >= 3) {
          pose.arms3.rotation.x = swing * 0.9;
          pose.load3.scale.setScalar(s);
        } else {
          pose.arms.rotation.x = swing;
          pose.load.scale.setScalar(s);
        }
        pose.figure.rotation.x = -0.12 * wind + f * 0.18;
        pose.figure.position.y = f * 0.02;
      },
    });
  },

  // Panzerknacker: Skorpion. Langer Bolzenwerfer auf einer Säule, die Bogenarme schnellen beim Schuss nach vorn.
  'tower.rom.knacker': () => {
    const m = createModel('tower.rom.knacker');
    const base = plinth(m, VIOLET);
    base.cyl({ r: 0.17, rTop: 0.14, h: 0.12, seg: 8, base: [0, TOP - 0.01, 0], color: STONE, colorTop: STONE_LIGHT });
    base.cyl({ r: 0.075, rTop: 0.065, h: 0.4, seg: 6, base: [0, TOP + 0.1, 0], color: WOOD, colorTop: WOOD_LIGHT });
    base.cyl({ r: 0.085, h: 0.04, seg: 6, base: [0, 0.6, 0], color: BRONZE_LIGHT });
    const GY = 0.78;
    const FZ = 0.2;

    const yaw = m.part('yaw', { pivot: [0, 0.72, 0] });
    yaw.box({ size: [0.13, 0.1, 0.16], at: [0, 0.69, 0], color: WOOD_DARK });
    // Bedienung mit violettem Helmbusch, dreht sich mit
    const OX = -0.25;
    const OZ = -0.17;
    person(yaw, OX, TOP, OZ, { band: VIOLET, cap: 'helmet', crest: VIOLET });
    rod(yaw, [OX + 0.13, TOP + 0.26, OZ], [OX + 0.12, GY - 0.07, OZ - 0.13], 0.028, SKIN, { seg: 4 });
    rod(yaw, [OX - 0.13, TOP + 0.26, OZ], [OX - 0.13, TOP + 0.12, OZ + 0.03], 0.028, SKIN, { seg: 4 });

    const gun = m.part('gun', { pivot: [0, GY, 0], parent: 'yaw' });
    gun.box({ size: [0.1, 0.085, 0.82], at: [0, GY, 0.03], color: WOOD, colorTop: WOOD_LIGHT });
    gun.box({ size: [0.05, 0.02, 0.8], at: [0, GY + 0.045, 0.03], color: WOOD_DARK });
    gun.box({ size: [0.115, 0.1, 0.07], at: [0, GY, -0.2], color: VIOLET });
    gun.box({ size: [0.115, 0.1, 0.05], at: [0, GY, 0.4], color: VIOLET });
    // Spannrahmen mit zwei stehenden Torsionsbündeln
    gun.box({ size: [0.52, 0.05, 0.11], at: [0, GY + 0.16, FZ], color: WOOD, colorTop: WOOD_LIGHT });
    gun.box({ size: [0.52, 0.05, 0.11], at: [0, GY - 0.13, FZ], color: WOOD });
    gun.box({ size: [0.2, 0.02, 0.115], at: [0, GY + 0.19, FZ], color: VIOLET });
    for (const sx of [-1, 1]) {
      gun.box({ size: [0.04, 0.26, 0.09], at: [sx * 0.25, GY + 0.015, FZ], color: WOOD_DARK });
      gun.box({ size: [0.035, 0.26, 0.09], at: [sx * 0.085, GY + 0.015, FZ], color: WOOD_DARK });
      gun.cyl({ r: 0.05, h: 0.3, seg: 6, at: [sx * 0.17, GY + 0.015, FZ], color: ROPE });
      gun.cyl({ r: 0.065, h: 0.035, seg: 7, at: [sx * 0.17, GY + 0.2, FZ], color: BRONZE_LIGHT });
    }
    for (const [name, s] of /** @type {[string, number][]} */ ([['armL', -1], ['armR', 1]])) {
      const arm = m.part(name, { pivot: [s * 0.17, GY + 0.02, FZ], parent: 'gun' });
      rod(arm, [s * 0.17, GY + 0.02, FZ], [s * 0.42, GY + 0.02, FZ - 0.13], 0.032, WOOD_LIGHT, { rTop: 0.024, seg: 5 });
      arm.sphere({ r: 0.035, detail: 0, at: [s * 0.42, GY + 0.02, FZ - 0.13], color: VIOLET });
      const big = m.part(name + '3', { pivot: [s * 0.17, GY + 0.02, FZ], parent: name, minLevel: 3 });
      rod(big, [s * 0.4, GY + 0.02, FZ - 0.12], [s * 0.5, GY + 0.02, FZ - 0.17], 0.03, BRONZE_LIGHT, { seg: 5 });
      big.sphere({ r: 0.04, detail: 0, at: [s * 0.5, GY + 0.02, FZ - 0.17], color: VIOLET });
    }
    const str = m.part('string', { pivot: [0, GY + 0.05, FZ - 0.13], parent: 'gun' });
    rod(str, [0.42, GY + 0.05, FZ - 0.13], [0, GY + 0.05, -0.27], 0.012, TUNIC, { seg: 3 });
    rod(str, [-0.42, GY + 0.05, FZ - 0.13], [0, GY + 0.05, -0.27], 0.012, TUNIC, { seg: 3 });
    const bolt = m.part('bolt', { pivot: [0, GY + 0.075, 0], parent: 'gun' });
    rod(bolt, [0, GY + 0.075, -0.25], [0, GY + 0.075, 0.44], 0.024, IRON, { seg: 5 });
    bolt.cone({ r: 0.045, h: 0.11, seg: 4, at: [0, GY + 0.075, 0.49], rot: [HALF, 0, 0], color: '#b9c0c9' });
    bolt.box({ size: [0.012, 0.07, 0.1], at: [0, GY + 0.085, -0.2], color: VIOLET });
    const crank = m.part('crank', { pivot: [0, GY, -0.33], parent: 'gun' });
    rod(crank, [-0.14, GY, -0.33], [0.14, GY, -0.33], 0.026, IRON, { seg: 5 });
    crank.box({ size: [0.03, 0.17, 0.035], at: [-0.13, GY, -0.33], color: WOOD_DARK });
    crank.box({ size: [0.03, 0.17, 0.035], at: [0.13, GY, -0.33], rot: [HALF, 0, 0], color: WOOD_DARK });

    // Stufe 2: bronzene Frontplatten
    tier2(m, VIOLET);
    const plate2 = m.part('plate2', { parent: 'gun', pivot: [0, GY, 0], minLevel: 2 });
    for (const sx of [-1, 1]) {
      plate2.box({ size: [0.21, 0.33, 0.03], at: [sx * 0.175, GY + 0.015, FZ + 0.072], color: BRONZE, colorTop: BRONZE_LIGHT });
      plate2.cyl({ r: 0.06, h: 0.02, seg: 7, at: [sx * 0.175, GY + 0.02, FZ + 0.09], rot: [HALF, 0, 0], color: VIOLET });
    }

    // Stufe 3: größere Arme (siehe oben), Adler auf dem Rahmen
    tier3(m, VIOLET);
    const eagle3 = m.part('eagle3', { parent: 'gun', pivot: [0, GY, 0], minLevel: 3 });
    eagle(eagle3, 0, GY + 0.185, FZ, 0.9, 0.3);

    m.point('muzzle', [0, GY + 0.075, 0.54], 'gun');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw', 'gun', 0.35);
        const f = ctx.fire;
        // Sichtbares Spannen: die Kurbel dreht, die Arme wandern zurück, dann liegt der Bolzen auf.
        const d = smooth(ctx.charge * 1.35) * (1 - smooth(f * 4));
        const rel = 1 - d;
        pose.armL.rotation.y = 0.75 * rel;
        pose.armR.rotation.y = -0.75 * rel;
        pose.string.scale.z = Math.max(0.03, d);
        pose.string.position.z = rel * 0.17;
        pose.string.scale.x = 1 + rel * 0.08;
        pose.crank.rotation.x = -ctx.charge * TAU * 2 * (ctx.charge < 0.74 ? 1 : 0.74 / ctx.charge);
        pose.bolt.scale.setScalar(Math.max(1e-3, smooth((ctx.charge - 0.5) * 6) * (1 - smooth(f * 3))));
        pose.gun.position.z = -f * f * 0.07;
        pose.gun.rotation.x -= f * f * 0.06;
      },
    });
  },

  // Brenner: Glutpfanne. Bronzeschale auf Dreibein, ein Blasebalg mit rotem Deckel drückt die Flammen nach vorn.
  'tower.rom.brenner': () => {
    const m = createModel('tower.rom.brenner');
    plinth(m, RED);
    const BZ = 0.13;
    const HY = 0.62;
    const HZ = -0.1;
    const head = m.part('head', { pivot: [0, TOP, 0] });
    head.cyl({ r: 0.35, h: 0.04, seg: 8, base: [0, TOP - 0.005, 0], color: WOOD, colorTop: WOOD_LIGHT });
    // Dreibein und Schale
    for (const a of [0, TAU / 3, (2 * TAU) / 3]) {
      rod(head, [Math.sin(a) * 0.2, TOP + 0.03, BZ + Math.cos(a) * 0.2], [Math.sin(a) * 0.07, 0.6, BZ + Math.cos(a) * 0.07], 0.028, BRONZE, { seg: 4 });
    }
    head.torus({ r: 0.12, tube: 0.018, seg: 6, tubeSeg: 4, at: [0, 0.44, BZ], color: BRONZE });
    head.lathe({ points: [[0, 0.56], [0.1, 0.565], [0.2, 0.65], [0.235, 0.76], [0.2, 0.775], [0, 0.74]], seg: 8, base: [0, 0.56, BZ], color: BRONZE, colorTop: BRONZE_LIGHT });
    head.sphere({ r: 0.19, detail: 1, at: [0, 0.765, BZ], scale: [1, 0.3, 1], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    head.sphere({ r: 0.06, detail: 0, at: [0.09, 0.79, BZ - 0.06], color: '#4a3a32' });
    head.sphere({ r: 0.05, detail: 0, at: [-0.1, 0.79, BZ + 0.03], rot: [1, 0, 0], color: '#4a3a32' });
    // Ausguss vorn
    head.box({ size: [0.12, 0.05, 0.09], at: [0, 0.75, BZ + 0.25], color: BRONZE_LIGHT });
    // Bock für die Blasebälge
    head.box({ size: [0.5, 0.05, 0.08], at: [0, HY - 0.045, -0.3], color: WOOD });
    head.box({ size: [0.06, HY - TOP - 0.07, 0.08], base: [0.2, TOP + 0.03, -0.3], color: WOOD_DARK, mirror: true });

    /**
     * Blasebalg: fester Boden, Lederkeil und roter Deckel als eigene Teile.
     * @param {string} name
     * @param {number} x
     * @param {number} minLevel
     */
    const bellows = (name, x, minLevel) => {
      const fix = m.part(name, { parent: 'head', pivot: [x, HY, HZ], minLevel });
      fix.box({ size: [0.22, 0.03, 0.34], at: [x, HY - 0.005, HZ - 0.17], color: WOOD_DARK });
      fix.cyl({ r: 0.05, rTop: 0.024, h: 0.14, seg: 6, at: [x, HY + 0.01, HZ + 0.05], rot: [HALF, 0, 0], color: BRONZE, colorTop: BRONZE_LIGHT });
      const skin = m.part(name + 'Skin', { parent: name, pivot: [x, HY + 0.01, HZ], minLevel });
      skin.wedge({ size: [0.2, 0.2, 0.32], at: [x, HY + 0.11, HZ - 0.16], rot: [0, Math.PI, 0], color: LEATHER, colorTop: LEATHER_LIGHT });
      const lid = m.part(name + 'Lid', { parent: name, pivot: [x, HY + 0.015, HZ], minLevel });
      lid.box({ size: [0.23, 0.03, 0.37], at: [x, HY + 0.03, HZ - 0.185], color: RED, colorTop: '#ea6a55' });
      lid.box({ size: [0.05, 0.035, 0.1], at: [x, HY + 0.035, HZ - 0.38], color: WOOD_LIGHT });
      lid.sphere({ r: 0.03, detail: 0, at: [x, HY + 0.05, HZ - 0.1], color: BRONZE_LIGHT });
    };
    bellows('bellowsA', -0.125, 1);
    // Stufe 1: Kohlensack neben dem Balg
    const sack = m.part('sack', { parent: 'head', pivot: [0, TOP, 0], maxLevel: 1 });
    sack.sphere({ r: 0.11, detail: 0, at: [0.17, TOP + 0.12, -0.27], scale: [1, 1.15, 1], color: '#cdb98a', colorTop: '#e3d3a8' });
    sack.sphere({ r: 0.05, detail: 0, at: [0.17, TOP + 0.25, -0.27], color: '#4a3a32' });

    const flame = m.part('flame', { parent: 'head', pivot: [0, 0.78, BZ] });
    flame.cone({ r: 0.1, h: 0.26, seg: 5, base: [0, 0.78, BZ], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    flame.cone({ r: 0.06, h: 0.17, seg: 4, base: [0.09, 0.78, BZ + 0.05], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    flame.cone({ r: 0.055, h: 0.15, seg: 4, base: [-0.08, 0.78, BZ - 0.04], color: EMBER, colorTop: EMBER_LIGHT, glow: true });
    const jet = m.part('jet', { parent: 'head', pivot: [0, 0.78, BZ + 0.27] });
    jet.cone({ r: 0.09, h: 0.14, seg: 5, at: [0, 0.78, BZ + 0.34], rot: [HALF, 0, 0], color: EMBER, colorTop: EMBER_LIGHT, glow: true });

    // Stufe 2: zweiter Blasebalg
    tier2(m, RED);
    bellows('bellowsB', 0.125, 2);

    // Stufe 3: Löwenkopf als Düse
    tier3(m, RED);
    const lion = m.part('lion3', { parent: 'head', pivot: [0, TOP, 0], minLevel: 3 });
    const LZ = BZ + 0.24;
    lion.cyl({ r: 0.135, h: 0.05, seg: 8, at: [0, 0.71, LZ], rot: [HALF, 0, 0], color: BRONZE });
    lion.sphere({ r: 0.095, detail: 0, at: [0, 0.71, LZ + 0.03], color: GOLD, colorTop: GOLD_LIGHT });
    lion.box({ size: [0.09, 0.07, 0.08], at: [0, 0.685, LZ + 0.1], color: GOLD_LIGHT });
    lion.box({ size: [0.055, 0.03, 0.02], at: [0, 0.672, LZ + 0.142], color: DARK });
    lion.box({ size: [0.022, 0.022, 0.02], at: [0.04, 0.74, LZ + 0.105], color: DARK, mirror: true });
    lion.cone({ r: 0.035, h: 0.06, seg: 4, at: [0.075, 0.81, LZ + 0.02], color: GOLD, mirror: true });

    m.point('muzzle', [0, 0.76, BZ + 0.36], 'head');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'head');
        const f = ctx.fire;
        // Die Bälge atmen ruhig und pumpen kräftig, sobald ein Ziel da ist.
        const rate = 0.45 + 1.6 * ctx.active;
        const pa = 0.5 + 0.5 * Math.sin((ctx.t * rate + ctx.seed) * TAU);
        const sa = 1 - Math.max(f * 0.7, pa * (0.3 + 0.35 * ctx.active));
        pose.bellowsASkin.scale.y = sa;
        pose.bellowsALid.rotation.x = Math.atan(0.2 * sa / 0.32);
        if (ctx.level >= 2) {
          const pb = 0.5 - 0.5 * Math.sin((ctx.t * rate + ctx.seed) * TAU);
          const sb = 1 - Math.max(f * 0.7, pb * (0.3 + 0.35 * ctx.active));
          pose.bellowsBSkin.scale.y = sb;
          pose.bellowsBLid.rotation.x = Math.atan(0.2 * sb / 0.32);
        }
        const flick = Math.sin(ctx.t * 11 + ctx.seed * 9) * 0.08 + Math.sin(ctx.t * 17.3) * 0.05;
        pose.flame.scale.setScalar(0.7 + 0.3 * ctx.active + f * 0.35 + flick);
        pose.flame.rotation.x = 0.25 * ctx.active + f * 0.4;
        pose.flame.rotation.y = ctx.t * 1.7;
        const j = Math.max(1e-3, f * (1 + flick) * (ctx.level >= 3 ? 1.25 : 1));
        pose.jet.scale.set(j, j, j * 2.2);
      },
    });
  },

  // Taktgeber: Feldzeichen. Goldener Adler über rotem Tuch, davor ein Hornbläser mit großem Cornu.
  'tower.rom.taktgeber': () => {
    const m = createModel('tower.rom.taktgeber');
    const base = plinth(m, GOLD);
    const TZ = -0.2;
    const EY = 1.5;
    base.box({ size: [0.42, 0.17, 0.3], base: [0, TOP - 0.01, TZ], color: STONE, colorTop: STONE_LIGHT });
    base.box({ size: [0.28, 0.11, 0.2], base: [0, TOP + 0.16, TZ], color: STONE_LIGHT });
    base.box({ size: [0.3, 0.03, 0.22], at: [0, TOP + 0.185, TZ], color: GOLD });
    rod(base, [0, TOP + 0.26, TZ], [0, EY, TZ], 0.032, WOOD, { seg: 6, colorTop: WOOD_LIGHT });
    // Querholz mit Tuch, goldene Scheiben
    base.box({ size: [0.36, 0.04, 0.045], at: [0, 1.32, TZ], color: GOLD });
    for (const y of [0.78, 0.94]) base.cyl({ r: 0.085, h: 0.045, seg: 8, at: [0, y, TZ + 0.01], rot: [HALF, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    base.box({ size: [0.2, 0.035, 0.07], at: [0, EY, TZ], color: GOLD });
    const cloth = m.part('cloth', { pivot: [0, 1.3, TZ + 0.03] });
    cloth.box({ size: [0.3, 0.24, 0.022], at: [0, 1.18, TZ + 0.035], color: ROMAN_RED, colorTop: '#d9503f' });
    cloth.box({ size: [0.3, 0.045, 0.026], at: [0, 1.045, TZ + 0.035], color: GOLD });
    cloth.cyl({ r: 0.05, h: 0.03, seg: 6, at: [0, 1.19, TZ + 0.05], rot: [HALF, 0, 0], color: GOLD_LIGHT });

    const eag = m.part('eagle', { pivot: [0, EY, TZ], maxLevel: 2 });
    eagle(eag, 0, EY + 0.015, TZ, 1, 0.75);

    // Hornbläser
    const FZ = 0.14;
    const blower = m.part('blower', { pivot: [0, TOP, FZ] });
    person(blower, 0, TOP, FZ, { band: GOLD, cap: 'helmet', crest: GOLD });
    const MY = TOP + 0.33;
    const horn = m.part('horn', { pivot: [0, MY, FZ + 0.1], parent: 'blower' });
    const HX = 0.15;
    horn.torus({ r: 0.21, tube: 0.03, seg: 10, tubeSeg: 4, arc: 4.75, at: [HX, MY - 0.02, FZ - 0.08], rot: [HALF, 0, HALF], color: GOLD, colorTop: GOLD_LIGHT });
    horn.cyl({ r: 0.03, rTop: 0.105, h: 0.16, seg: 7, at: [HX, MY + 0.19, FZ + 0.0], rot: [HALF, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    rod(horn, [HX, MY - 0.02, FZ + 0.13], [0.03, MY - 0.01, FZ + 0.11], 0.024, GOLD, { seg: 4 });
    rod(horn, [HX, MY + 0.19, FZ - 0.08], [HX, MY - 0.23, FZ - 0.08], 0.018, WOOD_DARK, { seg: 4 });
    rod(horn, [0.13, TOP + 0.25, FZ], [HX, MY - 0.06, FZ + 0.12], 0.028, SKIN, { seg: 4 });
    rod(horn, [-0.13, TOP + 0.25, FZ], [0.0, MY - 0.07, FZ + 0.13], 0.028, SKIN, { seg: 4 });

    // Stufe 2: Lorbeerkranz, zweites Feldzeichen
    const t2 = tier2(m, GOLD);
    t2.torus({ r: 0.2, tube: 0.03, seg: 10, tubeSeg: 4, at: [0, EY + 0.15, TZ - 0.03], rot: [HALF, 0, 0], color: '#6f9a3a', colorTop: '#9cc257' });
    rod(t2, [-0.31, TOP - 0.01, -0.1], [-0.31, 1.0, -0.1], 0.026, WOOD, { seg: 5 });
    t2.box({ size: [0.16, 0.035, 0.04], at: [-0.31, 0.92, -0.1], color: GOLD });
    t2.box({ size: [0.14, 0.13, 0.02], at: [-0.31, 0.84, -0.09], color: ROMAN_RED });
    t2.cyl({ r: 0.065, h: 0.04, seg: 7, at: [-0.31, 0.68, -0.09], rot: [HALF, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    t2.box({ size: [0.09, 0.13, 0.035], at: [-0.31, 1.06, -0.1], color: GOLD, colorTop: GOLD_LIGHT });

    // Stufe 3: größerer Adler mit gespreizten Flügeln, zwei Fackeln
    const t3 = tier3(m, GOLD);
    const eag3 = m.part('eagle3', { pivot: [0, EY, TZ], minLevel: 3 });
    eagle(eag3, 0, EY + 0.015, TZ, 1.2, 0.4);
    for (const sx of [-1, 1]) {
      rod(t3, [sx * 0.33, TOP - 0.01, 0.1], [sx * 0.33, 0.72, 0.1], 0.024, BRONZE, { seg: 5 });
      t3.cyl({ r: 0.035, rTop: 0.07, h: 0.07, seg: 6, base: [sx * 0.33, 0.7, 0.1], color: BRONZE, colorTop: BRONZE_LIGHT });
    }
    const torches = m.part('torches3', { pivot: [0, 0.77, 0.1], minLevel: 3 });
    torches.cone({ r: 0.055, h: 0.17, seg: 5, base: [0.33, 0.76, 0.1], color: EMBER, colorTop: EMBER_LIGHT, glow: true, mirror: true });

    return m.build({
      animate(pose, ctx) {
        // 96 Schläge pro Minute wie die Musik des Zeitalters; alle vier Schläge hebt der Bläser das Horn.
        const beat = ctx.t * 1.6 + ctx.seed;
        const pb = beat - Math.floor(beat);
        const hit = (1 - pb) * (1 - pb) * (1 - pb);
        const bar = beat / 4 - Math.floor(beat / 4);
        const raise = smooth(bar * 6) * (1 - smooth((bar - 0.45) * 5));
        pose.blower.rotation.x = -raise * 0.2;
        pose.blower.position.y = -hit * 0.012;
        pose.horn.rotation.x = -raise * 0.3;
        pose.horn.scale.setScalar(1 + raise * hit * 0.08);
        pose.cloth.rotation.x = Math.sin((ctx.t * 0.6 + ctx.seed) * TAU) * 0.12 + hit * 0.1;
        const s = 1 + hit * 0.12 + ctx.fire * 0.1;
        if (ctx.level >= 3) {
          pose.eagle3.scale.setScalar(s);
          pose.eagle3.rotation.y = Math.sin(beat * Math.PI * 0.5) * 0.12;
          pose.torches3.scale.y = 1 + Math.sin(ctx.t * 12 + ctx.seed * 5) * 0.15 + hit * 0.25;
        } else {
          pose.eagle.scale.setScalar(s);
          pose.eagle.rotation.y = Math.sin(beat * Math.PI * 0.5) * 0.12;
        }
      },
    });
  },
};
