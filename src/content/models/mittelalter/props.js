// @ts-check
// Mittelalter: Requisiten und die Basis (Burg mit Leuchtfeuer auf dem Bergfried).
import * as A from '../../../render/anim.js';
import { createModel, tone } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Mittelalters ---
const STONE = '#b4ada2';
const STONE_LIGHT = '#d2ccc0';
const STONE_DARK = '#8f887e';
const STONE_DEEP = '#6f695f';
const PLASTER = '#f2ead8';
const PLASTER_SHADE = '#e2d7bf';
const BEAM = '#5b3e2a';
const WOOD = '#8a6240';
const WOOD_LIGHT = '#ad8257';
const WOOD_DARK = '#6a4a30';
const ROOF = '#c4553a';
const ROOF_LIGHT = '#e27d58';
const ROOF_DARK = '#9a3e2a';
const BLUE = '#2f5da8';
const BLUE_LIGHT = '#5585d2';
const BLUE_DARK = '#244a88';
const GOLD = '#d9a520';
const GOLD_LIGHT = '#f2cd5c';
const IRON = '#4a4642';
const IRON_LIGHT = '#6c6660';
const OPENING = '#2e2824';
const FIR = '#2c6a46';
const FIR_TOP = '#5fa25c';
const GRASS = '#4f9a46';
const GRASS_TOP = '#8fca62';
const HAY = '#d9ae45';
const HAY_TOP = '#f6dc84';
const WHEAT = '#d6a83c';
const WHEAT_TOP = '#f7e08a';
const SOIL = '#7a5a3c';
const CLOTH = '#f4ecd8';
const RED = '#c8463a';
const WATER = '#3d8fb0';
const APPLE = '#d6503a';
const CABBAGE = '#7fbf5a';
const FLAME = '#ff7418';
const FLAME_TOP = '#ffc23c';
const FLAME_CORE = '#ffc24a';
const FLAME_CORE_TOP = '#fff0b0';
const EMBER = '#ff6a2a';

const TAU = Math.PI * 2;

/**
 * Zinnenreihe entlang einer Strecke: Merlons gleichmäßig verteilt.
 * @param {PartBuilder} p
 * @param {number} x0 @param {number} z0 Anfang
 * @param {number} x1 @param {number} z1 Ende
 * @param {number} y Unterkante
 * @param {number} n Anzahl der Zinnen
 * @param {number} size Kantenlänge einer Zinne
 * @param {number} depth Tiefe quer zur Strecke
 * @param {string} [color]
 */
function merlons(p, x0, z0, x1, z1, y, n, size, depth, color = STONE_LIGHT) {
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    p.box({ size: [depth, size, size], base: [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t], rot: [0, yaw, 0], color, colorTop: tone(color, 0.15) });
  }
}

/**
 * Flamme aus drei ineinander steckenden Kegeln; der Fuß liegt bei (x, y, z).
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z
 * @param {number} r @param {number} h
 */
function flameShape(p, x, y, z, r, h) {
  p.cone({ r, h, seg: 6, base: [x, y, z], color: FLAME, colorTop: FLAME_TOP, glow: 1.02 });
  p.cone({ r: r * 0.58, h: h * 0.62, seg: 5, base: [x + r * 0.12, y, z + r * 0.3], color: FLAME_CORE, colorTop: FLAME_CORE_TOP, glow: 1.3 });
  p.cone({ r: r * 0.5, h: h * 0.58, seg: 5, base: [x - r * 0.5, y, z - r * 0.2], rot: [0, 0, 0.25], color: FLAME, colorTop: FLAME_TOP, glow: 1.02 });
  p.cone({ r: r * 0.45, h: h * 0.5, seg: 5, base: [x + r * 0.35, y, z - r * 0.45], rot: [-0.2, 0, -0.2], color: FLAME_CORE, colorTop: FLAME_TOP, glow: 1.15 });
}

/**
 * Runder Eckturm mit Wehrgang-Kranz und spitzem blauem Kegeldach.
 * @param {PartBuilder} p
 * @param {number} x @param {number} z
 * @param {number} y Unterkante
 * @param {number} h Höhe des Schafts
 * @param {number} r Radius
 */
function roundTower(p, x, z, y, h, r) {
  p.cyl({ r: r * 1.06, rTop: r, h, seg: 8, base: [x, y, z], color: STONE_DARK, colorTop: STONE });
  p.cyl({ r: r * 1.14, h: 0.1, seg: 8, base: [x, y + h, z], color: STONE_LIGHT, shade: 0.05 });
  p.cone({ r: r * 1.26, h: r * 2.3, seg: 8, base: [x, y + h + 0.1, z], color: BLUE_DARK, colorTop: BLUE_LIGHT });
  p.sphere({ r: 0.045, detail: 0, at: [x, y + h + 0.1 + r * 2.3 + 0.02, z], color: GOLD_LIGHT });
}

/**
 * Tanne aus drei gestapelten Kegeln (Krone ohne Stamm).
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z
 * @param {number} s Maßstab (1 = 1,2 hoch, Radius 0,34)
 */
function firCrown(p, x, y, z, s) {
  p.cone({ r: 0.34 * s, h: 0.52 * s, seg: 7, base: [x, y, z], color: FIR, colorTop: FIR_TOP, faceJitter: 0.07 });
  p.cone({ r: 0.27 * s, h: 0.46 * s, seg: 7, base: [x, y + 0.3 * s, z], rot: [0, 0.4, 0], color: FIR, colorTop: FIR_TOP, faceJitter: 0.07 });
  p.cone({ r: 0.19 * s, h: 0.4 * s, seg: 6, base: [x, y + 0.58 * s, z], rot: [0, 0.9, 0], color: tone(FIR, 0.08), colorTop: tone(FIR_TOP, 0.15), faceJitter: 0.07 });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Burg: quadratischer Bergfried, vier runde Ecktürme mit blauen Kegeldächern, Ringmauer mit Zinnen,
  // Torhaus mit Fallgitter nach vorn (+Z), blaue Banner. Die Flamme lodert als Leuchtfeuer auf dem Bergfried.
  'base.mittelalter': () => {
    const m = createModel('base.mittelalter');
    const c = m.part('castle');
    // Sockel
    c.box({ size: [2.34, 0.08, 2.34], base: [0, 0, 0], color: STONE_DEEP, colorTop: STONE_DARK });
    c.box({ size: [1.72, 0.012, 1.72], base: [0, 0.08, 0], color: GRASS, shade: 0 });
    const gy = 0.08;
    const tp = 0.86; // Lage der Ecktürme
    // Ringmauer
    const wh = 0.62;
    const wt = 0.18;
    for (const s of [1, -1]) {
      c.box({ size: [tp * 2, wh, wt], base: [0, gy, s * tp], color: STONE_DARK, colorTop: STONE });
      c.box({ size: [wt, wh, tp * 2], base: [s * tp, gy, 0], color: STONE_DARK, colorTop: STONE });
      // Zinnen außen
      merlons(c, -tp + 0.3, s * (tp + 0.05), tp - 0.3, s * (tp + 0.05), gy + wh, 5, 0.12, 0.08);
      merlons(c, s * (tp + 0.05), -tp + 0.3, s * (tp + 0.05), tp - 0.3, gy + wh, 5, 0.12, 0.08);
    }
    // Ecktürme
    for (const [x, z] of /** @type {[number, number][]} */ ([[-tp, -tp], [tp, -tp], [-tp, tp], [tp, tp]])) roundTower(c, x, z, gy, 0.98, 0.27);

    // Torhaus vorn mit Rundbogen und Fallgitter
    const gz = tp + 0.06;
    c.box({ size: [0.62, 0.92, 0.34], base: [0, gy, gz], color: STONE, colorTop: STONE_LIGHT });
    merlons(c, -0.24, gz + 0.13, 0.24, gz + 0.13, gy + 0.92, 3, 0.12, 0.08);
    merlons(c, -0.24, gz - 0.13, 0.24, gz - 0.13, gy + 0.92, 3, 0.12, 0.08);
    const arch = /** @type {[number, number][]} */ ([[-0.16, 0]]);
    arch.push([0.16, 0], [0.16, 0.34]);
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      arch.push([Math.cos(a) * 0.16, 0.34 + Math.sin(a) * 0.16]);
    }
    arch.push([-0.16, 0.34]);
    c.extrude({ points: arch, depth: 0.02, base: [0, gy, gz + 0.171], color: OPENING, shade: 0 });
    // Fallgitter (halb hochgezogen)
    for (const x of [-0.105, -0.035, 0.035, 0.105]) c.box({ size: [0.03, 0.34, 0.025], base: [x, gy + 0.16, gz + 0.19], color: IRON, colorTop: IRON_LIGHT });
    for (const y of [0.24, 0.36]) c.box({ size: [0.3, 0.03, 0.025], base: [0, gy + y, gz + 0.192], color: IRON, colorTop: IRON_LIGHT });
    // Wappenschild über dem Tor
    c.extrude({ points: [[-0.1, 0.06], [0.1, 0.06], [0.1, -0.04], [0, -0.13], [-0.1, -0.04]], depth: 0.03, at: [0, gy + 0.78, gz + 0.178], color: BLUE, colorTop: BLUE_LIGHT });
    c.box({ size: [0.04, 0.16, 0.012], at: [0, gy + 0.77, gz + 0.196], color: GOLD_LIGHT, shade: 0 });
    // Holzsteg vor dem Tor
    c.box({ size: [0.34, 0.04, 0.16], base: [0, 0.04, gz + 0.25], color: WOOD, colorTop: WOOD_LIGHT });

    // Bergfried
    const kz = -0.1;
    const kw = 0.86;
    const kh = 1.42;
    c.box({ size: [kw, kh, kw], base: [0, gy, kz], color: STONE, colorTop: STONE_LIGHT });
    c.box({ size: [kw + 0.1, 0.09, kw + 0.1], base: [0, gy + kh, kz], color: STONE_LIGHT, shade: 0.05 });
    const ky = gy + kh + 0.09;
    const e = kw / 2 + 0.01;
    for (const s of [1, -1]) {
      merlons(c, -e, kz + s * e, e, kz + s * e, ky, 5, 0.13, 0.09);
      merlons(c, s * e, kz - e + 0.215, s * e, kz + e - 0.215, ky, 3, 0.13, 0.09);
    }
    // Tür und Fenster des Bergfrieds
    c.box({ size: [0.2, 0.3, 0.02], base: [0, gy, kz + kw / 2 + 0.006], color: WOOD_DARK, colorTop: WOOD });
    for (const [x, z, ry] of /** @type {Vec3[]} */ ([[0, kz + kw / 2 + 0.006, 0], [kw / 2 + 0.006, kz, Math.PI / 2], [0, kz - kw / 2 - 0.006, 0], [-kw / 2 - 0.006, kz, Math.PI / 2]])) {
      c.box({ size: [0.09, 0.18, 0.02], base: [x, gy + 1.08, z], rot: [0, ry, 0], color: OPENING, shade: 0 });
    }
    // Große blaue Banner an den Wänden des Bergfrieds (vorn, rechts, hinten)
    for (const [x, z, ry] of /** @type {Vec3[]} */ ([[0, kz + kw / 2 + 0.012, 0], [kw / 2 + 0.012, kz, Math.PI / 2], [0, kz - kw / 2 - 0.012, Math.PI]])) {
      const dx = Math.sin(ry);
      const dz = Math.cos(ry);
      // Stange, Tuch mit Spitze unten, goldener Streifen
      c.box({ size: [0.36, 0.03, 0.03], at: [x + dx * 0.01, gy + 1.36, z + dz * 0.01], rot: [0, ry, 0], color: WOOD_DARK });
      c.extrude({ points: [[-0.15, 0], [0.15, 0], [0.15, -0.5], [0, -0.62], [-0.15, -0.5]], depth: 0.02, at: [x, gy + 1.35, z], rot: [0, ry, 0], color: BLUE_DARK, colorTop: BLUE_LIGHT });
      c.box({ size: [0.05, 0.5, 0.012], at: [x + dx * 0.012, gy + 1.08, z + dz * 0.012], rot: [0, ry, 0], color: GOLD, colorTop: GOLD_LIGHT, shade: 0 });
    }

    // Blaue Banner außen an den seitlichen Ringmauern, damit die Wappenfarbe aus jeder Kamerarichtung zu sehen ist
    for (const s of [1, -1]) {
      const x = s * (tp + wt / 2 + 0.012);
      const ry = s * Math.PI / 2;
      c.extrude({ points: [[-0.12, 0], [0.12, 0], [0.12, -0.36], [0, -0.45], [-0.12, -0.36]], depth: 0.02, at: [x, gy + wh - 0.04, 0], rot: [0, ry, 0], color: BLUE_DARK, colorTop: BLUE_LIGHT });
      c.box({ size: [0.04, 0.36, 0.012], at: [x + s * 0.012, gy + wh - 0.25, 0], rot: [0, ry, 0], color: GOLD, colorTop: GOLD_LIGHT, shade: 0 });
    }

    // Fachwerk-Halle im Hof rechts: rotes Dach über der Mauer, gut zu sehen von hinten rechts
    const hx = 0.6;
    c.box({ size: [0.32, 0.62, 0.92], base: [hx, gy, -0.08], color: PLASTER_SHADE, colorTop: PLASTER });
    for (const z of [-0.5, -0.2, 0.1, 0.34]) c.box({ size: [0.33, 0.04, 0.04], base: [hx, gy + 0.62, z], color: BEAM });
    c.roof({ size: [1.02, 0.3, 0.46], base: [hx, gy + 0.64, -0.08], rot: [0, Math.PI / 2, 0], color: ROOF_DARK, colorTop: ROOF_LIGHT });
    c.box({ size: [0.05, 0.04, 1.04], at: [hx, gy + 0.94, -0.08], color: ROOF_DARK });
    c.box({ size: [0.09, 0.22, 0.09], base: [hx + 0.06, gy + 0.78, -0.42], color: STONE, colorTop: STONE_LIGHT });
    // Kohlebecken des Leuchtfeuers
    c.cyl({ r: 0.07, rTop: 0.05, h: 0.12, seg: 6, base: [0, ky, kz], color: IRON });
    c.lathe({ points: [[0, 0], [0.08, 0], [0.26, 0.1], [0.32, 0.2], [0.28, 0.2], [0, 0.14]], seg: 8, base: [0, ky + 0.1, kz], color: IRON, colorTop: IRON_LIGHT });
    c.sphere({ r: 0.24, detail: 0, at: [0, ky + 0.29, kz], scale: [1, 0.3, 1], color: EMBER, glow: 1.3 });

    // Fahne auf dem Eckturm hinten rechts (Standardkamera) und vorn links
    const flagH = gy + 0.98 + 0.1 + 0.27 * 2.3;
    /** @type {[string, number, number][]} */
    const flags = [['flagA', tp, -tp], ['flagB', -tp, tp]];
    for (const [name, x, z] of flags) {
      c.cyl({ r: 0.022, h: 0.42, seg: 5, base: [x, flagH, z], color: WOOD_DARK });
      const f = m.part(name, { pivot: [x, flagH + 0.4, z] });
      f.extrude({ points: [[0, 0], [0.34, -0.03], [0.26, -0.1], [0.34, -0.17], [0, -0.2]], depth: 0.02, at: [x + 0.01, flagH + 0.4, z], color: BLUE, colorTop: BLUE_LIGHT });
      f.box({ size: [0.28, 0.04, 0.026], at: [x + 0.15, flagH + 0.3, z], color: GOLD, shade: 0 });
    }

    // Die Flamme
    const fy = ky + 0.28;
    const flame = m.part('flame', { pivot: [0, fy, kz] });
    flameShape(flame, 0, fy, kz, 0.3, 0.95);

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 9.1) * 0.05 + Math.sin(ctx.t * 14.7 + 1.3) * 0.03;
        f.scale.set(s * (1 - flick * 0.6), s * (1 + flick), s * (1 - flick * 0.6));
        f.rotation.y = ctx.t * 0.9;
        f.rotation.z = Math.sin(ctx.t * 3.3) * 0.05;
        A.sway(pose, ctx, 'flagA', 0.25, 0.45, 'y');
        A.sway(pose, ctx, 'flagB', 0.25, 0.4, 'y');
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Tanne: kurzer Stamm, drei gestapelte Kegel.
  'prop.mittelalter.tanne': () => {
    const m = createModel('prop.mittelalter.tanne');
    m.part('trunk').cyl({ r: 0.07, rTop: 0.05, h: 0.24, seg: 5, base: [0, 0, 0], color: WOOD_DARK, colorTop: WOOD });
    const crown = m.part('crown', { pivot: [0, 0.15, 0] });
    firCrown(crown, 0, 0.15, 0, 1.15);
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.025, 0.22);
        A.sway(pose, ctx, 'crown', 0.015, 0.15, 'x');
      },
    });
  },

  // Fachwerkhaus: weißes Erdgeschoss, vorkragendes Obergeschoss, dunkle Balken, steiles rotes Satteldach.
  'prop.mittelalter.fachwerkhaus': () => {
    const m = createModel('prop.mittelalter.fachwerkhaus');
    const p = m.part('house');
    const L = 0.72;
    const D = 0.5;
    // Steinsockel und Erdgeschoss
    p.box({ size: [L + 0.04, 0.08, D + 0.04], base: [0, 0, 0], color: STONE_DARK, colorTop: STONE });
    p.box({ size: [L, 0.34, D], base: [0, 0.08, 0], color: PLASTER_SHADE, colorTop: PLASTER });
    // Obergeschoss kragt vor
    const uy = 0.42;
    p.box({ size: [L + 0.08, 0.04, D + 0.08], base: [0, uy, 0], color: BEAM });
    p.box({ size: [L + 0.06, 0.3, D + 0.06], base: [0, uy + 0.04, 0], color: PLASTER_SHADE, colorTop: PLASTER });
    // Fachwerk: Ständer und Streben auf allen vier Seiten
    const fz = (D + 0.06) / 2 + 0.006;
    const fx = (L + 0.06) / 2 + 0.006;
    for (const s of [1, -1]) {
      for (const x of [-0.39, -0.13, 0.13, 0.39]) p.box({ size: [0.04, 0.3, 0.02], base: [x, uy + 0.04, s * fz], color: BEAM });
      p.box({ size: [0.04, 0.34, 0.02], at: [-0.26, uy + 0.19, s * fz], rot: [0, 0, 0.75], color: BEAM });
      p.box({ size: [0.04, 0.34, 0.02], at: [0.26, uy + 0.19, s * fz], rot: [0, 0, -0.75], color: BEAM });
      for (const z of [-0.29, 0, 0.29]) p.box({ size: [0.02, 0.3, 0.04], base: [s * fx, uy + 0.04, z], color: BEAM });
      // Erdgeschoss-Ständer
      for (const x of [-0.34, 0.34]) p.box({ size: [0.04, 0.34, 0.02], base: [x, 0.08, s * (D / 2 + 0.006)], color: BEAM });
    }
    // Tür und Fenster vorn (+Z), Fenster mit blauen Läden
    p.box({ size: [0.14, 0.24, 0.02], base: [-0.16, 0.08, D / 2 + 0.008], color: WOOD_DARK, colorTop: WOOD });
    for (const x of [0, 0.26]) {
      p.box({ size: [0.09, 0.1, 0.02], base: [x, uy + 0.12, fz + 0.004], color: OPENING, shade: 0 });
      p.box({ size: [0.04, 0.11, 0.02], base: [x - 0.07, uy + 0.115, fz + 0.008], color: BLUE, mirror: false });
      p.box({ size: [0.04, 0.11, 0.02], base: [x + 0.07, uy + 0.115, fz + 0.008], color: BLUE });
    }
    p.box({ size: [0.1, 0.1, 0.02], base: [0.18, 0.18, D / 2 + 0.008], color: OPENING, shade: 0 });
    p.box({ size: [0.1, 0.1, 0.02], base: [0, uy + 0.12, -fz - 0.004], color: OPENING, shade: 0 });
    // Dach mit Überstand und Kamin
    const ry = uy + 0.34;
    p.roof({ size: [L + 0.2, 0.46, D + 0.24], base: [0, ry, 0], color: ROOF_DARK, colorTop: ROOF_LIGHT });
    p.box({ size: [L + 0.22, 0.04, 0.06], at: [0, ry + 0.46, 0], color: ROOF_DARK });
    // Weiße Giebelfelder mit Balkenkreuz vor den Dachenden
    const gx = (L + 0.2) / 2 + 0.006;
    for (const sx of [1, -1]) {
      p.extrude({ points: [[-0.27, 0], [0.27, 0], [0, 0.4]], depth: 0.012, base: [sx * gx, ry + 0.01, 0], rot: [0, Math.PI / 2, 0], color: PLASTER_SHADE, colorTop: PLASTER });
      p.box({ size: [0.016, 0.36, 0.035], base: [sx * (gx + 0.008), ry + 0.01, 0], color: BEAM });
      p.box({ size: [0.016, 0.035, 0.4], base: [sx * (gx + 0.008), ry + 0.13, 0], color: BEAM });
    }
    p.box({ size: [0.11, 0.3, 0.11], base: [0.22, ry + 0.16, -0.1], color: STONE, colorTop: STONE_LIGHT });
    return m.build();
  },

  // Heuhaufen: gedrungener gelber Haufen mit einer Heugabel.
  'prop.mittelalter.heuhaufen': () => {
    const m = createModel('prop.mittelalter.heuhaufen');
    const p = m.part('hay');
    p.lathe({ points: [[0, 0], [0.3, 0], [0.3, 0.1], [0.25, 0.3], [0.15, 0.44], [0.05, 0.5], [0, 0.5]], seg: 8, color: HAY, colorTop: HAY_TOP, faceJitter: 0.08 });
    p.sphere({ r: 0.13, detail: 0, at: [0.27, 0.07, 0.15], scale: [1, 0.55, 1], color: HAY, colorTop: HAY_TOP, faceJitter: 0.08 });
    // Heugabel steckt schräg im Haufen
    p.cyl({ r: 0.02, h: 0.62, seg: 5, base: [-0.08, 0.2, 0.04], rot: [0.15, 0, 0.45], color: WOOD, colorTop: WOOD_LIGHT });
    const tx = -0.08 - Math.sin(0.45) * 0.62;
    const ty = 0.2 + Math.cos(0.45) * 0.62;
    p.box({ size: [0.14, 0.025, 0.025], at: [tx, ty, 0.04 + 0.09], rot: [0, 0, 0.45], color: IRON });
    for (const dx of [-0.055, 0, 0.055]) {
      p.box({ size: [0.018, 0.12, 0.018], at: [tx + dx * Math.cos(0.45) - 0.05 * Math.sin(0.45), ty + dx * Math.sin(0.45) + 0.05 * Math.cos(0.45), 0.13], rot: [0, 0, 0.45], color: IRON_LIGHT });
    }
    return m.build();
  },

  // Weizenfeld: Acker mit Reihen goldener Ähren, die sich im Wind wiegen, Mohn dazwischen und eine Vogelscheuche.
  'prop.mittelalter.weizenfeld': () => {
    const m = createModel('prop.mittelalter.weizenfeld');
    const g = m.part('soil');
    g.box({ size: [0.86, 0.04, 0.8], base: [0, 0, 0], color: SOIL, colorTop: tone(SOIL, 0.12) });
    // Vogelscheuche: Pfahl, Querholz, blaues Hemd, Strohhut
    g.box({ size: [0.04, 0.62, 0.04], base: [0.3, 0.04, 0.26], color: WOOD_DARK, colorTop: WOOD });
    g.box({ size: [0.36, 0.035, 0.035], at: [0.3, 0.5, 0.26], color: WOOD });
    g.box({ size: [0.16, 0.18, 0.09], base: [0.3, 0.36, 0.26], color: BLUE, colorTop: BLUE_LIGHT });
    g.sphere({ r: 0.065, detail: 0, at: [0.3, 0.62, 0.26], color: CLOTH });
    g.cone({ r: 0.12, h: 0.1, seg: 7, base: [0.3, 0.66, 0.26], color: HAY, colorTop: HAY_TOP });
    const w = m.part('wheat', { pivot: [0, 0.04, 0] });
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const z = -0.32 + (i / (rows - 1)) * 0.64;
      const short = z > 0.15 ? 0.2 : 0;
      for (const [x0, x1] of /** @type {[number, number][]} */ ([[-0.38, -0.02 - short * 0.2], [0.02, 0.38 - short * 1.6]])) {
        if (x1 - x0 < 0.08) continue;
        const h = 0.24 + ((i * 5 + (x0 > 0 ? 3 : 0)) % 4) * 0.02;
        // Reihe als Umriss mit gezackter Oberkante: die Ähren
        const teeth = Math.max(2, Math.round((x1 - x0) / 0.07));
        /** @type {[number, number][]} */
        const pts = [[x0, 0], [x1, 0]];
        for (let k = teeth; k >= 0; k--) {
          const x = x0 + ((x1 - x0) * k) / teeth;
          pts.push([x, h - 0.05]);
          if (k > 0) pts.push([x - (x1 - x0) / teeth / 2, h + 0.02]);
        }
        w.extrude({ points: pts, depth: 0.09, base: [0, 0.02, z], color: WHEAT, colorTop: WHEAT_TOP });
      }
    }
    for (const [x, z] of [[-0.2, -0.19], [0.15, -0.32], [-0.3, 0.2]]) w.sphere({ r: 0.04, detail: 0, at: [x, 0.31, z], color: RED, colorTop: tone(RED, 0.25) });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'wheat', 0.035, 0.35, 'x');
        A.sway(pose, ctx, 'wheat', 0.02, 0.27, 'z');
      },
    });
  },

  // Marktstand: Tresen, vier Pfosten, rot-weiß gestreiftes Satteldach, Kisten mit Äpfeln und Kohl.
  'prop.mittelalter.marktstand': () => {
    const m = createModel('prop.mittelalter.marktstand');
    const p = m.part('stall');
    const W = 0.76;
    const D = 0.48;
    for (const [x, z] of /** @type {[number, number][]} */ ([[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]])) {
      p.box({ size: [0.045, 0.66, 0.045], base: [x, 0, z], color: WOOD_DARK, colorTop: WOOD });
    }
    // Tresen
    p.box({ size: [W, 0.3, 0.26], base: [0, 0, 0.1], color: WOOD, colorTop: WOOD_LIGHT });
    p.box({ size: [W + 0.06, 0.035, 0.32], base: [0, 0.3, 0.1], color: WOOD_LIGHT });
    // Waren auf dem Tresen
    for (let i = 0; i < 4; i++) p.sphere({ r: 0.05, detail: 0, at: [-0.28 + i * 0.07, 0.38, 0.06 + (i % 2) * 0.06], color: APPLE, colorTop: tone(APPLE, 0.25) });
    for (let i = 0; i < 3; i++) p.sphere({ r: 0.065, detail: 0, at: [0.12 + i * 0.11, 0.39, 0.1 - (i % 2) * 0.05], color: CABBAGE, colorTop: tone(CABBAGE, 0.3), faceJitter: 0.08 });
    // Kisten vor dem Stand
    p.box({ size: [0.2, 0.14, 0.16], base: [-0.3, 0, 0.36], rot: [0, 0.2, 0], color: WOOD_LIGHT, colorTop: tone(WOOD_LIGHT, 0.15) });
    for (let i = 0; i < 3; i++) p.sphere({ r: 0.045, detail: 0, at: [-0.34 + i * 0.05, 0.16, 0.37 - i * 0.01], color: GOLD, colorTop: GOLD_LIGHT });
    // Gestreiftes Dach: Streifen entlang X wechseln die Farbe
    const ry = 0.66;
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const x = -W / 2 - 0.06 + ((i + 0.5) / stripes) * (W + 0.12);
      p.roof({ size: [(W + 0.12) / stripes + 0.002, 0.24, D + 0.2], base: [x, ry, 0], color: i % 2 ? CLOTH : RED, colorTop: i % 2 ? CLOTH : tone(RED, 0.2) });
    }
    // Volants an den Traufen
    for (const s of [1, -1]) {
      for (let i = 0; i < stripes; i++) {
        const x = -W / 2 - 0.06 + ((i + 0.5) / stripes) * (W + 0.12);
        p.extrude({ points: [[-0.07, 0], [0.07, 0], [0, -0.07]], depth: 0.01, at: [x, ry, s * (D / 2 + 0.1)], color: i % 2 ? CLOTH : RED });
      }
    }
    return m.build();
  },

  // Ziehbrunnen: runder Steinkranz mit Wasser, zwei Pfosten, kleines rotes Dach, Kurbel und Eimer.
  'prop.mittelalter.brunnen': () => {
    const m = createModel('prop.mittelalter.brunnen');
    const p = m.part('well');
    p.cyl({ r: 0.3, rTop: 0.28, h: 0.3, seg: 9, base: [0, 0, 0], color: STONE_DARK, colorTop: STONE_LIGHT, faceJitter: 0.04 });
    p.cyl({ r: 0.31, h: 0.05, seg: 9, base: [0, 0.3, 0], color: STONE_LIGHT, shade: 0 });
    p.cyl({ r: 0.22, h: 0.02, seg: 9, base: [0, 0.336, 0], color: WATER, shade: 0 });
    for (const x of [-0.27, 0.27]) p.box({ size: [0.06, 0.62, 0.06], base: [x, 0.3, 0], color: WOOD_DARK, colorTop: WOOD });
    // Welle mit Kurbel
    p.cyl({ r: 0.035, h: 0.62, seg: 6, at: [0, 0.78, 0], rot: [0, 0, Math.PI / 2], color: WOOD_LIGHT });
    p.box({ size: [0.03, 0.12, 0.03], at: [0.33, 0.73, 0], color: IRON });
    // Dach
    p.roof({ size: [0.72, 0.24, 0.46], base: [0, 0.92, 0], color: ROOF_DARK, colorTop: ROOF_LIGHT });
    // Eimer hängt am Seil
    const b = m.part('bucket', { pivot: [0, 0.78, 0] });
    b.cyl({ r: 0.012, h: 0.24, seg: 4, base: [0, 0.54, 0], color: CLOTH });
    b.cyl({ r: 0.07, rTop: 0.085, h: 0.12, seg: 7, base: [0, 0.43, 0], color: WOOD, colorTop: WOOD_LIGHT });
    b.torus({ r: 0.08, tube: 0.012, seg: 7, tubeSeg: 3, at: [0, 0.52, 0], color: IRON });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'bucket', 0.08, 0.3, 'x');
      },
    });
  },

  // Zinnenmauer: Mauerstück mit Zinnen, Schießscharte und einem Efeufleck. Schmal genug für die Randplätze.
  'prop.mittelalter.zinnenmauer': () => {
    const m = createModel('prop.mittelalter.zinnenmauer');
    const p = m.part('wall');
    const L = 0.84;
    p.box({ size: [L, 0.62, 0.24], base: [0, 0, 0], color: STONE_DARK, colorTop: STONE });
    p.box({ size: [L + 0.02, 0.05, 0.26], base: [0, 0.62, 0], color: STONE_LIGHT, shade: 0 });
    merlons(p, -0.35, 0, 0.35, 0, 0.67, 4, 0.16, 0.24);
    // Quader-Andeutung: einzelne hellere Steine
    for (const [x, y] of [[-0.24, 0.16], [0.18, 0.32], [-0.05, 0.46], [0.3, 0.1]]) {
      p.box({ size: [0.16, 0.08, 0.252], at: [x, y, 0], color: STONE, shade: 0 });
    }
    // Schießscharte
    p.box({ size: [0.05, 0.2, 0.256], base: [0.02, 0.24, 0], color: OPENING, shade: 0 });
    // Efeu
    p.sphere({ r: 0.16, detail: 0, at: [-0.3, 0.24, 0.12], scale: [1, 1.4, 0.4], color: GRASS, colorTop: GRASS_TOP, faceJitter: 0.1 });
    return m.build();
  },

  // Windmühle: weißer Turm, rotes Kegeldach, vier Flügel mit Segeltuch, die sich drehen.
  // Die Flügel stehen in Ruhe als X, damit das Modell auf die Randplätze passt (Radius unter 0,47).
  'prop.mittelalter.windmuehle': () => {
    const m = createModel('prop.mittelalter.windmuehle');
    const t = m.part('tower');
    // Hoher, schlanker Turm: ein Wahrzeichen am Inselrand, das über Tannen und Häuser hinausragt.
    t.cyl({ r: 0.26, h: 0.08, seg: 8, base: [0, 0, 0], color: STONE_DARK, colorTop: STONE });
    t.cyl({ r: 0.235, rTop: 0.155, h: 1.18, seg: 8, base: [0, 0.08, 0], color: PLASTER_SHADE, colorTop: PLASTER });
    t.cyl({ r: 0.235, h: 0.06, seg: 8, base: [0, 0.48, 0], color: WOOD_DARK });
    t.cyl({ r: 0.175, h: 0.05, seg: 8, base: [0, 1.26, 0], color: WOOD_DARK });
    t.cone({ r: 0.23, h: 0.46, seg: 8, base: [0, 1.31, 0], color: ROOF_DARK, colorTop: ROOF_LIGHT });
    t.sphere({ r: 0.035, detail: 0, at: [0, 1.79, 0], color: GOLD_LIGHT });
    t.box({ size: [0.13, 0.24, 0.03], base: [0, 0.08, 0.228], rot: [-0.06, 0, 0], color: WOOD_DARK, colorTop: WOOD });
    t.box({ size: [0.07, 0.1, 0.03], base: [0, 0.74, 0.19], rot: [-0.065, 0, 0], color: OPENING, shade: 0 });
    t.box({ size: [0.03, 0.1, 0.07], base: [0.205, 0.62, 0], rot: [0, 0, 0.065], color: OPENING, shade: 0 });
    t.box({ size: [0.03, 0.1, 0.07], base: [-0.205, 0.62, 0], rot: [0, 0, -0.065], color: OPENING, shade: 0 });
    // Nabe und Flügel
    const hub = /** @type {Vec3} */ ([0, 1.26, 0.19]);
    t.cyl({ r: 0.03, h: 0.1, seg: 6, at: [0, hub[1], 0.15], rot: [Math.PI / 2, 0, 0], color: WOOD_DARK });
    const s = m.part('sails', { pivot: hub });
    s.cyl({ r: 0.055, h: 0.06, seg: 7, at: [0, hub[1], hub[2] + 0.02], rot: [Math.PI / 2, 0, 0], color: WOOD_DARK, colorTop: WOOD });
    const len = 0.48;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * TAU;
      const dx = Math.sin(a);
      const dy = Math.cos(a);
      const px = Math.cos(a);
      const py = -Math.sin(a);
      // Rute
      s.box({ size: [0.035, len, 0.03], at: [dx * len / 2, hub[1] + dy * len / 2, hub[2] + 0.04], rot: [0, 0, -a], color: WOOD_DARK });
      // Segeltuch seitlich an der Rute, mit Querlatten
      const c = 0.29;
      s.box({ size: [0.11, 0.34, 0.016], at: [dx * c + px * 0.065, hub[1] + dy * c + py * 0.065, hub[2] + 0.03], rot: [0, 0, -a], color: CLOTH, colorTop: CLOTH });
      for (const k of [0.17, 0.29, 0.41]) {
        s.box({ size: [0.13, 0.02, 0.02], at: [dx * k + px * 0.065, hub[1] + dy * k + py * 0.065, hub[2] + 0.045], rot: [0, 0, -a], color: WOOD });
      }
    }
    return m.build({
      animate(pose, ctx) {
        pose.sails.rotation.z -= ctx.t * 0.9 + ctx.seed * TAU;
      },
    });
  },

  // Sperrfeld: Stumpf eines verfallenen Rundturms mit zackiger Bruchkante, Moos und herabgefallenen Quadern.
  'prop.mittelalter.block': () => {
    const m = createModel('prop.mittelalter.block');
    const p = m.part('ruin');
    p.cyl({ r: 0.4, rTop: 0.37, h: 0.3, seg: 9, base: [0, 0, 0], color: STONE_DARK, colorTop: STONE });
    p.cyl({ r: 0.27, h: 0.012, seg: 9, base: [0, 0.3, 0], color: STONE_DEEP, shade: 0 });
    // Zackige Mauerkrone: Blöcke unterschiedlicher Höhe im Kreis
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const h = [0.34, 0.2, 0.08, 0.05, 0.14, 0.28, 0.42, 0.5, 0.4][i];
      p.box({ size: [0.24, h, 0.11], base: [Math.sin(a) * 0.32, 0.3, Math.cos(a) * 0.32], rot: [0, a, 0], color: STONE, colorTop: STONE_LIGHT });
    }
    // Schießscharte im hohen Teil
    const aw = (7 / n) * TAU;
    p.box({ size: [0.05, 0.18, 0.02], base: [Math.sin(aw) * 0.385, 0.42, Math.cos(aw) * 0.385], rot: [0, aw, 0], color: OPENING, shade: 0 });
    // Moos auf der Krone und Efeu am Fuß
    p.sphere({ r: 0.13, detail: 0, at: [Math.sin(0.5) * 0.33, 0.66, Math.cos(0.5) * 0.33], scale: [1.2, 0.4, 0.9], color: GRASS, colorTop: GRASS_TOP, faceJitter: 0.1 });
    p.sphere({ r: 0.15, detail: 0, at: [0.3, 0.16, -0.28], scale: [1, 1.1, 0.7], rot: [0, 0.8, 0], color: GRASS, colorTop: GRASS_TOP, faceJitter: 0.1 });
    // Herabgefallene Quader
    p.box({ size: [0.16, 0.1, 0.12], base: [0.36, 0, 0.3], rot: [0, 0.6, 0], color: STONE, colorTop: STONE_LIGHT });
    p.box({ size: [0.12, 0.08, 0.1], base: [-0.42, 0, 0.18], rot: [0.1, -0.4, 0.15], color: STONE_LIGHT });
    return m.build();
  },

  // Bodendeko 1: Grasbüschel mit blauen Kornblumen.
  'prop.mittelalter.deko1': () => {
    const m = createModel('prop.mittelalter.deko1');
    const p = m.part('flowers');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      p.cone({ r: 0.035, h: 0.13 + (i % 2) * 0.04, seg: 3, base: [Math.sin(a) * 0.045, 0, Math.cos(a) * 0.045], rot: [0, a - Math.PI / 2, -0.35], color: GRASS, colorTop: GRASS_TOP });
    }
    for (const [x, y, z] of /** @type {Vec3[]} */ ([[0.07, 0.15, 0.03], [-0.06, 0.12, -0.05], [-0.02, 0.18, 0.08]])) {
      p.sphere({ r: 0.04, detail: 0, at: [x, y, z], scale: [1, 0.6, 1], color: BLUE, colorTop: BLUE_LIGHT });
    }
    return m.build();
  },

  // Bodendeko 2: Reste von Kopfsteinpflaster mit einem Löwenzahn.
  'prop.mittelalter.deko2': () => {
    const m = createModel('prop.mittelalter.deko2');
    const p = m.part('cobbles');
    for (const [x, z, r] of /** @type {Vec3[]} */ ([[-0.06, 0.02, 0.07], [0.08, -0.04, 0.06], [0.04, 0.1, 0.055], [-0.1, -0.1, 0.05]])) {
      p.sphere({ r, detail: 0, at: [x, 0.012, z], scale: [1, 0.4, 1], color: STONE, colorTop: STONE_LIGHT, faceJitter: 0.08 });
    }
    p.cyl({ r: 0.012, h: 0.12, seg: 4, base: [0.12, 0, 0.08], color: GRASS });
    p.sphere({ r: 0.035, detail: 0, at: [0.12, 0.13, 0.08], color: GOLD_LIGHT });
    return m.build();
  },
};
