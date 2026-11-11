// @ts-check
// Zeitalter der Entdecker: Requisiten und die Basis (Hafenfestung mit Leuchtfeuer im eisernen Korb).
// Goldener Nachmittag am Meer: Sand, helles Holz, Backstein, Segeltuch; Akzente Petrol und Rot.
import * as A from '../../../render/anim.js';
import { createModel, tone } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der Entdecker ---
const SAND = '#d9c58b';
const SAND_LIGHT = '#efe0b0';
const SAND_DARK = '#bfa56c';
const FORT = '#d8bf88';
const FORT_LIGHT = '#f0e2b6';
const FORT_DARK = '#b89c66';
const RAMPART = '#8cbc5a';
const MOAT = '#3a93b8';
const MOAT_LIGHT = '#62bcd6';
const WOOD = '#8a6240';
const WOOD_LIGHT = '#b38858';
const WOOD_DARK = '#664630';
const BARREL = '#a0703f';
const BARREL_LIGHT = '#c99a62';
const PLANK = '#c09868';
const PLANK_LIGHT = '#dcb886';
const BRICK = '#b25a40';
const BRICK_LIGHT = '#cc7656';
const SLATE = '#56607a';
const SLATE_LIGHT = '#7f8aa6';
const TEAL = '#1e6f78';
const TEAL_LIGHT = '#36a0a6';
const RED = '#b5382e';
const RED_LIGHT = '#d9584a';
const WHITE = '#f4ecdc';
const WHITE_SHADE = '#ddd2bc';
const IRON = '#3e3a38';
const IRON_LIGHT = '#67615b';
const BRONZE = '#b07a3a';
const GOLD = '#e0b03a';
const GOLD_LIGHT = '#f8dc6c';
const ROPE = '#d8c08a';
const STONE = '#a69a86';
const STONE_LIGHT = '#c8bda8';
const OPENING = '#2e2824';
const PALM = '#3e9446';
const PALM_TOP = '#8fd065';
const TRUNK = '#8c6a46';
const TRUNK_LIGHT = '#b08c62';
const DUNE = '#7fa848';
const DUNE_TOP = '#e2e08c';
const PINK = '#ec8fb4';
const CORAL = '#e8673e';
const CORAL_LIGHT = '#ff9a6a';
const SHELL = '#f6d8c8';
const FLAME = '#ff7418';
const FLAME_TOP = '#ffc23c';
const FLAME_CORE = '#ffc24a';
const FLAME_CORE_TOP = '#fff0b0';
const EMBER = '#ff6a2a';
const LAMP = '#ffd86a';

const TAU = Math.PI * 2;

/**
 * Flamme aus vier ineinander steckenden Kegeln; der Fuß liegt bei (x, y, z).
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
 * Bauchiges Fass mit zwei Eisenreifen. Der Fuß liegt bei `at`; `axis` legt fest, wohin die Fassachse zeigt.
 * @param {PartBuilder} p
 * @param {Vec3} at Mitte der Unterseite (bei liegenden Fässern: Mitte des einen Bodens)
 * @param {number} r
 * @param {number} h
 * @param {'y' | 'x' | 'z'} [axis]
 * @param {string} [band] Farbe eines gemalten Streifens in der Mitte (optional)
 */
function barrel(p, at, r, h, axis = 'y', band) {
  /** @type {Vec3} */
  const rot = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, -Math.PI / 2] : [Math.PI / 2, 0, 0];
  /** @type {Vec3} */
  const dir = axis === 'y' ? [0, 1, 0] : axis === 'x' ? [1, 0, 0] : [0, 0, 1];
  /** @param {number} s @returns {Vec3} */
  const along = (s) => [at[0] + dir[0] * s, at[1] + dir[1] * s, at[2] + dir[2] * s];
  p.lathe({ points: [[0, 0], [r * 0.84, 0], [r, h * 0.5], [r * 0.84, h], [0, h]], seg: 8, at, rot, color: BARREL, colorTop: BARREL_LIGHT });
  for (const s of [0.18, 0.82]) p.torus({ r: r * 0.93, tube: 0.016, seg: 8, tubeSeg: 3, at: along(h * s), rot, color: IRON, shade: 0 });
  if (band) p.torus({ r: r * 0.99, tube: 0.024, seg: 8, tubeSeg: 3, at: along(h * 0.5), rot, color: band, shade: 0 });
}

/**
 * Kleine Kanone auf hölzerner Lafette, das Rohr zeigt in Richtung `yaw` (0 = +Z).
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z
 * @param {number} yaw
 * @param {number} [s] Maßstab
 */
function cannon(p, x, y, z, yaw, s = 1) {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  /** @param {number} lx @param {number} ly @param {number} lz @returns {Vec3} */
  const at = (lx, ly, lz) => [x + (lx * cos + lz * sin) * s, y + ly * s, z + (-lx * sin + lz * cos) * s];
  p.box({ size: [0.14 * s, 0.07 * s, 0.22 * s], at: at(0, 0.06, -0.02), rot: [0, yaw, 0], color: RED, colorTop: RED_LIGHT });
  for (const side of [-1, 1]) {
    p.cyl({ r: 0.05 * s, h: 0.03 * s, seg: 6, at: at(side * 0.085, 0.05, 0.03), rot: [0, yaw, Math.PI / 2], color: WOOD_DARK });
  }
  // Rohr: leicht konisch, nach vorn und etwas aufwärts
  p.cyl({ r: 0.045 * s, rTop: 0.034 * s, h: 0.3 * s, seg: 6, at: at(0, 0.12, 0.06), rot: [0, yaw - Math.PI / 2, -(Math.PI / 2 - 0.12)], color: IRON, colorTop: IRON_LIGHT });
  p.sphere({ r: 0.045 * s, detail: 0, at: at(0, 0.11, -0.09), color: IRON });
}

/**
 * Palmwedel: ein steigendes, dann hängendes Blatt aus zwei flachgedrückten Kegeln, ausgehend von `at`.
 * @param {PartBuilder} p
 * @param {Vec3} at Ansatz am Kronenmittelpunkt
 * @param {number} yaw Richtung (0 = +Z)
 * @param {number} len Länge des inneren Stücks
 * @param {number} w Breite
 * @param {number} [up] Steigung des inneren Stücks
 * @param {number} [down] Neigung des hängenden Stücks
 */
function frond(p, at, yaw, len, w, up = 0.45, down = 1.1) {
  // Euler XYZ: zuerst Z (kippt die Achse von +Y nach +X), dann Y (dreht um die Senkrechte).
  const ry = yaw - Math.PI / 2;
  p.cyl({ r: w, rTop: w * 0.75, h: len, seg: 4, base: at, rot: [0, ry, -(Math.PI / 2 - up)], scale: [0.22, 1, 1], color: PALM, colorTop: PALM_TOP });
  const ex = at[0] + Math.sin(yaw) * Math.cos(up) * len;
  const ey = at[1] + Math.sin(up) * len;
  const ez = at[2] + Math.cos(yaw) * Math.cos(up) * len;
  p.cone({ r: w * 0.8, h: len * 1.3, seg: 4, base: [ex, ey, ez], rot: [0, ry, -(Math.PI / 2 + down)], scale: [0.22, 1, 1], color: PALM, colorTop: PALM_TOP });
}

/**
 * Geschwungener Palmstamm aus vier Stücken mit hellen Ringen; liefert den Kronenpunkt.
 * @param {PartBuilder} p
 * @param {number} x0 @param {number} y0 @param {number} z0 Fuß
 * @param {number} s Maßstab (1 = etwa 1,07 hoch)
 * @returns {Vec3}
 */
function palmTrunk(p, x0, y0, z0, s) {
  let x = x0;
  let y = y0;
  const segH = 0.27 * s;
  for (let i = 0; i < 4; i++) {
    const lean = 0.06 + i * 0.06;
    const r0 = (0.07 - i * 0.008) * s;
    p.cyl({ r: r0, rTop: r0 - 0.006 * s, h: segH + 0.02 * s, seg: 6, base: [x, y, z0], rot: [0, 0, -lean], color: TRUNK, colorTop: TRUNK_LIGHT });
    p.torus({ r: r0 - 0.002, tube: 0.014 * s, seg: 6, tubeSeg: 3, at: [x + Math.sin(lean) * segH * 0.98, y + Math.cos(lean) * segH * 0.98, z0], rot: [0, 0, -lean], color: TRUNK_LIGHT, shade: 0 });
    x += Math.sin(lean) * segH;
    y += Math.cos(lean) * segH;
  }
  return [x, y, z0];
}

/**
 * Palmkrone: sieben Wedel und drei Kokosnüsse um den Kronenpunkt.
 * @param {PartBuilder} p
 * @param {Vec3} crown
 * @param {number} s Maßstab
 */
function palmCrown(p, crown, s) {
  const [x, y, z] = crown;
  p.sphere({ r: 0.07 * s, detail: 0, at: [x, y + 0.01 * s, z], color: PALM, colorTop: PALM_TOP });
  for (let i = 0; i < 7; i++) frond(p, crown, (i / 7) * TAU + 0.3, 0.22 * s, 0.13 * s);
  for (let i = 0; i < 3; i++) frond(p, crown, (i / 3) * TAU + 0.8, 0.12 * s, 0.1 * s, 1.0, 0.5);
  for (const [dx, dz] of /** @type {[number, number][]} */ ([[0.05, 0.03], [-0.03, 0.05], [0.0, -0.06]])) {
    p.sphere({ r: 0.04 * s, detail: 0, at: [x + dx * s, y - 0.04 * s, z + dz * s], color: WOOD_DARK, colorTop: WOOD });
  }
}

/**
 * Ruderboot: Umriss von oben mit spitzem Bug (+X vor der Drehung), roter Rumpf, weißes Dollbord, zwei Duchten.
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z Mitte der Unterseite
 * @param {number} yaw Drehung um Y (0 = Bug nach +X)
 * @param {number} s Maßstab (1 = 0,64 lang)
 * @param {number} [heel] leichte Schräglage
 */
function rowboat(p, x, y, z, yaw, s, heel = 0) {
  /** @type {[number, number][]} */
  const outline = [[-0.3 * s, -0.13 * s], [0.12 * s, -0.14 * s], [0.34 * s, 0], [0.12 * s, 0.14 * s], [-0.3 * s, 0.13 * s]];
  /** @type {[number, number][]} */
  const inner = [[-0.26 * s, -0.095 * s], [0.1 * s, -0.1 * s], [0.27 * s, 0], [0.1 * s, 0.1 * s], [-0.26 * s, 0.095 * s]];
  // Liegt flach: zuerst um Z gedreht (wird nach dem Hinlegen zur Drehung um Y), dann um X hingelegt.
  const rot = /** @type {Vec3} */ ([-Math.PI / 2, heel, yaw]);
  p.extrude({ points: outline, depth: 0.08 * s, at: [x, y + 0.04 * s, z], rot, color: RED, colorTop: RED_LIGHT });
  p.extrude({ points: outline.map(([u, v]) => [u * 1.03, v * 1.06]), depth: 0.04 * s, at: [x, y + 0.1 * s, z], rot, color: WHITE, shade: 0 });
  p.extrude({ points: inner, depth: 0.02 * s, at: [x, y + 0.115 * s, z], rot, color: PLANK, shade: 0 });
  for (const u of [-0.12, 0.06]) {
    p.box({ size: [0.05 * s, 0.03 * s, 0.22 * s], at: [x + u * s * Math.cos(yaw), y + 0.13 * s, z - u * s * Math.sin(yaw)], rot: [0, yaw, 0], color: WOOD });
  }
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Hafenfestung: niedriges Sternfort aus fünf Bastionen mit geböschten Sandsteinmauern und grünen Wällen,
  // umgeben von einem Wassergraben. Kanonen auf den Bastionsspitzen, Tor mit Holzbrücke nach vorn (+Z),
  // Wachturm mit dem Leuchtfeuer im eisernen Korb, Fahnenmast mit petrolfarbener Flagge hinten rechts (Spielkamera).
  'base.entdecker': () => {
    const m = createModel('base.entdecker');
    const c = m.part('fort');
    // Sandiger Rand und Wassergraben
    c.cyl({ r: 1.18, h: 0.03, seg: 14, base: [0, 0, 0], color: SAND_DARK, colorTop: SAND });
    c.cyl({ r: 1.12, h: 0.012, seg: 14, base: [0, 0.03, 0], color: MOAT, colorTop: MOAT_LIGHT, shade: 0 });
    const g0 = 0.03;
    const R = 0.8;
    const wh = 0.42;
    const top = g0 + wh;
    const turn = /** @type {Vec3} */ ([0, Math.PI / 5, 0]);
    // Fünfeckiger Kern mit geböschten Wänden; eine Ecke zeigt nach hinten (-Z), vorn liegt eine Kante.
    c.cyl({ r: R, rTop: R * 0.9, h: wh, seg: 5, base: [0, g0, 0], rot: turn, color: FORT_DARK, colorTop: FORT });
    c.cyl({ r: R * 0.9 - 0.02, h: 0.012, seg: 5, base: [0, top, 0], rot: turn, color: RAMPART, shade: 0 });
    // Bastionen an den fünf Ecken: rautenförmig, Spitze nach außen, grüner Wall, Brustwehr an den Außenkanten
    const bd = 0.76;
    for (let k = 0; k < 5; k++) {
      const a = Math.PI + (k / 5) * TAU;
      const bx = Math.sin(a) * bd;
      const bz = Math.cos(a) * bd;
      c.cyl({ r: 0.38, rTop: 0.32, h: wh, seg: 4, base: [bx, g0, bz], rot: [0, a, 0], color: FORT_DARK, colorTop: FORT });
      c.cyl({ r: 0.3, h: 0.012, seg: 4, base: [bx, top, bz], rot: [0, a, 0], color: RAMPART, shade: 0 });
      for (const side of [-1, 1]) {
        const ea = a + side * Math.PI / 4;
        c.box({ size: [0.07, 0.09, 0.4], base: [bx + Math.sin(ea) * 0.2, top, bz + Math.cos(ea) * 0.2], rot: [0, ea + Math.PI / 2, 0], color: FORT, colorTop: FORT_LIGHT });
      }
      // Wachhäuschen auf der Spitze der hinteren Bastion, sonst eine Kanone
      if (k === 0) {
        c.box({ size: [0.14, 0.2, 0.14], base: [bx, top, bz], rot: [0, a + Math.PI / 4, 0], color: WHITE_SHADE, colorTop: WHITE });
        c.cone({ r: 0.13, h: 0.14, seg: 4, base: [bx, top + 0.2, bz], rot: [0, a, 0], color: RED, colorTop: RED_LIGHT });
      } else {
        cannon(c, bx - Math.sin(a) * 0.02, top, bz - Math.cos(a) * 0.02, a, 1.15);
      }
    }
    // Brustwehr entlang der freien Stücke der Kernkanten (vorn sitzt das Torhaus)
    for (let k = 0; k < 5; k++) {
      if (k === 2) continue;
      const a = Math.PI + ((k + 0.5) / 5) * TAU;
      const d = R * 0.9 * Math.cos(Math.PI / 5) - 0.04;
      c.box({ size: [0.34, 0.09, 0.07], base: [Math.sin(a) * d, top, Math.cos(a) * d], rot: [0, a, 0], color: FORT, colorTop: FORT_LIGHT });
    }

    // Torhaus vorn: dunkler Bogen, offene petrolfarbene Torflügel, rotes Dach, Wappen; Holzbrücke über den Graben
    const gz = R * Math.cos(Math.PI / 5) - 0.02;
    c.box({ size: [0.48, 0.58, 0.24], base: [0, g0, gz], color: FORT, colorTop: FORT_LIGHT });
    c.box({ size: [0.52, 0.04, 0.28], base: [0, g0 + 0.58, gz], color: FORT_LIGHT, shade: 0 });
    c.roof({ size: [0.52, 0.2, 0.3], base: [0, g0 + 0.62, gz], color: RED, colorTop: RED_LIGHT });
    /** @type {[number, number][]} */
    const arch = [[-0.12, 0], [0.12, 0], [0.12, 0.22]];
    for (let i = 1; i < 6; i++) {
      const t = (i / 6) * Math.PI;
      arch.push([Math.cos(t) * 0.12, 0.22 + Math.sin(t) * 0.12]);
    }
    arch.push([-0.12, 0.22]);
    c.extrude({ points: arch, depth: 0.02, base: [0, g0, gz + 0.115], color: OPENING, shade: 0 });
    c.box({ size: [0.1, 0.26, 0.025], base: [-0.16, g0, gz + 0.16], rot: [0, 1.2, 0], color: TEAL, colorTop: TEAL_LIGHT });
    c.box({ size: [0.1, 0.26, 0.025], base: [0.16, g0, gz + 0.16], rot: [0, -1.2, 0], color: TEAL, colorTop: TEAL_LIGHT });
    c.cyl({ r: 0.075, h: 0.02, seg: 8, at: [0, g0 + 0.47, gz + 0.125], rot: [Math.PI / 2, 0, 0], color: TEAL, colorTop: TEAL_LIGHT });
    c.box({ size: [0.03, 0.09, 0.012], at: [0, g0 + 0.47, gz + 0.138], color: GOLD_LIGHT, shade: 0 });
    c.box({ size: [0.09, 0.03, 0.012], at: [0, g0 + 0.48, gz + 0.138], color: GOLD_LIGHT, shade: 0 });
    c.box({ size: [0.3, 0.04, 1.16 - gz - 0.08], base: [0, 0.03, (1.16 + gz + 0.08) / 2], color: PLANK, colorTop: PLANK_LIGHT });
    for (const x of [-0.14, 0.14]) c.box({ size: [0.03, 0.03, 1.16 - gz - 0.12], base: [x, 0.07, (1.16 + gz + 0.12) / 2], color: WOOD_DARK });

    // Kaserne an der linken vorderen Wallkante, rotes Dach
    const ka = Math.PI + 1.5 / 5 * TAU;
    const kd = 0.36;
    c.box({ size: [0.5, 0.24, 0.24], base: [Math.sin(ka) * kd, top, Math.cos(ka) * kd], rot: [0, ka, 0], color: WHITE_SHADE, colorTop: WHITE });
    c.roof({ size: [0.56, 0.17, 0.32], base: [Math.sin(ka) * kd, top + 0.24, Math.cos(ka) * kd], rot: [0, ka, 0], color: RED, colorTop: RED_LIGHT });
    for (const s of [-0.13, 0.13]) {
      c.box({ size: [0.06, 0.09, 0.02], base: [Math.sin(ka) * (kd + 0.125) + Math.cos(ka) * s, top + 0.08, Math.cos(ka) * (kd + 0.125) - Math.sin(ka) * s], rot: [0, ka, 0], color: OPENING, shade: 0 });
    }
    // Pulverkammer rechts vorn mit petrolfarbenem Dach
    const pa = Math.PI + 3.5 / 5 * TAU;
    const pd = 0.36;
    c.box({ size: [0.26, 0.2, 0.22], base: [Math.sin(pa) * pd, top, Math.cos(pa) * pd], rot: [0, pa, 0], color: STONE, colorTop: STONE_LIGHT });
    c.pyramid({ size: [0.32, 0.16, 0.28], base: [Math.sin(pa) * pd, top + 0.2, Math.cos(pa) * pd], rot: [0, pa, 0], color: TEAL, colorTop: TEAL_LIGHT });
    // Vorräte im Hof
    barrel(c, [0.13, top, 0.4], 0.065, 0.15);
    barrel(c, [0.0, top, 0.44], 0.065, 0.15, 'y', RED);
    for (const [x, z, y] of /** @type {Vec3[]} */ ([[0.4, -0.18, 0], [0.48, -0.1, 0], [0.42, -0.06, 0], [0.43, -0.12, 0.07]])) {
      c.sphere({ r: 0.05, detail: 0, at: [x, top + 0.05 + y, z], color: IRON, colorTop: IRON_LIGHT });
    }

    // Wachturm mit dem Leuchtfeuer: rund, nach oben verjüngt, petrolfarbenes Band, Gesims, Zinnenkranz
    const tx = 0;
    const tz = -0.22;
    const th = 1.32;
    c.cyl({ r: 0.31, rTop: 0.25, h: th, seg: 8, base: [tx, top, tz], color: FORT_DARK, colorTop: FORT_LIGHT });
    c.cyl({ r: 0.29, rTop: 0.285, h: 0.07, seg: 8, base: [tx, top + 0.5, tz], color: TEAL, colorTop: TEAL_LIGHT });
    c.cyl({ r: 0.33, rTop: 0.35, h: 0.09, seg: 8, base: [tx, top + th, tz], color: FORT, colorTop: FORT_LIGHT });
    const py = top + th + 0.09;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      c.box({ size: [0.11, 0.11, 0.07], base: [tx + Math.sin(a) * 0.31, py, tz + Math.cos(a) * 0.31], rot: [0, a, 0], color: FORT, colorTop: FORT_LIGHT });
    }
    // Tür und Fenster des Turms
    c.box({ size: [0.13, 0.22, 0.02], base: [tx, top, tz + 0.306], color: TEAL, colorTop: TEAL_LIGHT });
    for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, 0, (3 * Math.PI) / 4]) {
      c.box({ size: [0.07, 0.13, 0.02], base: [tx + Math.sin(a) * 0.272, top + 0.82, tz + Math.cos(a) * 0.272], rot: [0, a, 0], color: OPENING, shade: 0 });
    }
    // Eiserner Feuerkorb auf kurzem Ständer, mit Reifen und Stäben
    c.cyl({ r: 0.06, rTop: 0.04, h: 0.16, seg: 6, base: [tx, py, tz], color: IRON });
    c.lathe({ points: [[0, 0], [0.08, 0], [0.25, 0.12], [0.29, 0.24], [0.25, 0.24], [0, 0.16]], seg: 8, base: [tx, py + 0.14, tz], color: IRON, colorTop: IRON_LIGHT });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.box({ size: [0.026, 0.13, 0.026], base: [tx + Math.sin(a) * 0.275, py + 0.32, tz + Math.cos(a) * 0.275], rot: [Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2], color: IRON });
    }
    c.torus({ r: 0.3, tube: 0.018, seg: 10, tubeSeg: 3, at: [tx, py + 0.44, tz], color: IRON_LIGHT, shade: 0 });
    c.sphere({ r: 0.24, detail: 0, at: [tx, py + 0.34, tz], scale: [1, 0.32, 1], color: EMBER, glow: 1.3 });

    // Palme im Hof hinten links
    const palmTop = palmTrunk(c, -0.34, top, -0.36, 0.75);
    palmCrown(c, palmTop, 0.75);

    // Ruderboot im Graben hinten rechts, schaukelt leicht
    const ba = Math.PI * 0.8;
    const boatAt = /** @type {Vec3} */ ([Math.sin(ba) * 0.92, 0.03, Math.cos(ba) * 0.92]);
    rowboat(m.part('boat', { pivot: boatAt }), boatAt[0], boatAt[1], boatAt[2], ba, 0.42);

    // Fahnenmast auf der hinteren rechten Bastion (zur Spielkamera hin)
    const fa = Math.PI + (4 / 5) * TAU;
    const fx = Math.sin(fa) * (bd - 0.17);
    const fz = Math.cos(fa) * (bd - 0.17) - 0.08;
    const poleH = 1.45;
    c.cyl({ r: 0.028, rTop: 0.02, h: poleH, seg: 5, base: [fx, top, fz], color: WOOD_DARK, colorTop: WOOD });
    c.sphere({ r: 0.04, detail: 0, at: [fx, top + poleH + 0.02, fz], color: GOLD_LIGHT });
    const flag = m.part('flag', { pivot: [fx, top + poleH - 0.04, fz] });
    // Das Tuch weht schräg nach hinten rechts, damit es der Spielkamera die Fläche zeigt.
    const fyaw = -0.6;
    /** @param {number} u Abstand vom Mast @param {number} v Höhe @returns {Vec3} */
    const onFlag = (u, v) => [fx + Math.cos(fyaw) * u, top + poleH + v, fz - Math.sin(fyaw) * u];
    flag.extrude({ points: [[0, 0], [0.46, -0.02], [0.44, -0.3], [0, -0.31]], depth: 0.02, at: onFlag(0.02, -0.04), rot: [0, fyaw, 0], color: TEAL, colorTop: TEAL_LIGHT });
    flag.box({ size: [0.45, 0.065, 0.026], at: onFlag(0.245, -0.195), rot: [0, fyaw, 0], color: WHITE, shade: 0 });
    flag.box({ size: [0.065, 0.29, 0.03], at: onFlag(0.17, -0.19), rot: [0, fyaw, 0], color: WHITE, shade: 0 });

    // Die Flamme
    const fy = py + 0.34;
    const flame = m.part('flame', { pivot: [tx, fy, tz] });
    flameShape(flame, tx, fy, tz, 0.3, 0.9);

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 9.1) * 0.05 + Math.sin(ctx.t * 14.7 + 1.3) * 0.03;
        f.scale.set(s * (1 - flick * 0.6), s * (1 + flick), s * (1 - flick * 0.6));
        f.rotation.y = ctx.t * 0.9;
        f.rotation.z = Math.sin(ctx.t * 3.3) * 0.05;
        A.sway(pose, ctx, 'flag', 0.28, 0.5, 'y');
        pose.boat.position.y = Math.sin(ctx.t * 1.3) * 0.006;
        pose.boat.rotation.z = Math.sin(ctx.t * 0.9) * 0.05;
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Palme: geschwungener Stamm aus vier Stücken, sechs hängende Wedel, Kokosnüsse. Schmal genug für die Randplätze.
  'prop.entdecker.palme': () => {
    const m = createModel('prop.entdecker.palme');
    const crown = palmTrunk(m.part('trunk'), -0.1, 0, 0, 1.15);
    palmCrown(m.part('crown', { pivot: crown }), crown, 1.08);
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.06, 0.35);
        A.sway(pose, ctx, 'crown', 0.04, 0.27, 'x');
      },
    });
  },

  // Fässerstapel: drei stehende Fässer, eins liegt obenauf, eins davor; eine Kiste.
  'prop.entdecker.faesser': () => {
    const m = createModel('prop.entdecker.faesser');
    const p = m.part('barrels');
    barrel(p, [-0.145, 0, -0.09], 0.135, 0.34);
    barrel(p, [0.145, 0, -0.09], 0.135, 0.34, 'y', TEAL);
    barrel(p, [-0.02, 0, 0.17], 0.135, 0.34);
    barrel(p, [-0.17, 0.34 + 0.11, -0.09], 0.11, 0.34, 'x', RED);
    p.box({ size: [0.2, 0.17, 0.2], base: [0.25, 0, 0.2], rot: [0, 0.4, 0], color: PLANK, colorTop: PLANK_LIGHT });
    p.box({ size: [0.21, 0.025, 0.21], base: [0.25, 0.085, 0.2], rot: [0, 0.4, 0], color: WOOD_DARK, shade: 0 });
    return m.build();
  },

  // Handelskontor: schmales Backsteinhaus mit Treppengiebel nach vorn, Schieferdach, weißen Fenstern,
  // petrolfarbener Tür und einem Ladebalken mit hängender Kiste.
  'prop.entdecker.kontor': () => {
    const m = createModel('prop.entdecker.kontor');
    const p = m.part('house');
    const W = 0.52;
    const D = 0.6;
    const H = 0.84;
    p.box({ size: [W + 0.04, 0.06, D + 0.04], base: [0, 0, 0], color: STONE, colorTop: STONE_LIGHT });
    p.box({ size: [W, H, D], base: [0, 0.06, 0], color: BRICK, colorTop: BRICK_LIGHT });
    const gy = 0.06 + H;
    // Treppengiebel vorn und hinten
    const steps = [[0.26, 0.1], [0.19, 0.2], [0.12, 0.3], [0.06, 0.42]];
    for (const s of [1, -1]) {
      for (let i = 0; i < steps.length; i++) {
        const [hw, hy] = steps[i];
        const y0 = i === 0 ? 0 : steps[i - 1][1];
        p.box({ size: [hw * 2, hy - y0, 0.08], base: [0, gy + y0, s * (D / 2 - 0.04)], color: BRICK, colorTop: BRICK_LIGHT });
        p.box({ size: [hw * 2 + 0.03, 0.03, 0.1], base: [0, gy + hy, s * (D / 2 - 0.04)], color: WHITE, shade: 0 });
      }
    }
    // Schieferdach zwischen den Giebeln (First entlang Z)
    p.roof({ size: [D - 0.12, 0.36, W + 0.06], base: [0, gy, 0], rot: [0, Math.PI / 2, 0], color: SLATE, colorTop: SLATE_LIGHT });
    // Fenster: weiß gerahmt, zwei Geschosse vorn, je eins seitlich
    /** @param {number} x @param {number} y @param {number} z @param {number} ry */
    const win = (x, y, z, ry) => {
      const dx = Math.sin(ry);
      const dz = Math.cos(ry);
      p.box({ size: [0.13, 0.17, 0.02], base: [x, y, z], rot: [0, ry, 0], color: WHITE, shade: 0 });
      p.box({ size: [0.08, 0.12, 0.02], base: [x + dx * 0.008, y + 0.025, z + dz * 0.008], rot: [0, ry, 0], color: OPENING, shade: 0 });
    };
    const fz = D / 2 + 0.006;
    for (const x of [-0.13, 0.13]) win(x, 0.5, fz, 0);
    // Ladeluke im Giebel
    p.box({ size: [0.16, 0.22, 0.02], base: [0, 0.96, fz], color: WHITE, shade: 0 });
    p.box({ size: [0.11, 0.18, 0.02], base: [0, 0.98, fz + 0.008], color: TEAL, colorTop: TEAL_LIGHT });
    for (const s of [1, -1]) {
      for (const z of [-0.14, 0.14]) win(s * (W / 2 + 0.006), 0.5, z, s * Math.PI / 2);
    }
    for (const x of [-0.13, 0.13]) win(x, 0.5, -fz, Math.PI);
    // Tür mit Treppe
    p.box({ size: [0.17, 0.3, 0.02], base: [0, 0.06, fz], color: WHITE, shade: 0 });
    p.box({ size: [0.12, 0.26, 0.02], base: [0, 0.06, fz + 0.008], color: TEAL, colorTop: TEAL_LIGHT });
    p.box({ size: [0.22, 0.04, 0.08], base: [0, 0, fz + 0.04], color: STONE_LIGHT });
    // Ladebalken oben im Giebel
    p.box({ size: [0.04, 0.04, 0.16], at: [0, gy + 0.22, D / 2 + 0.06], color: WOOD_DARK });
    const crate = m.part('crate', { pivot: [0, gy + 0.2, D / 2 + 0.12] });
    crate.cyl({ r: 0.01, h: 0.2, seg: 4, base: [0, gy, D / 2 + 0.12], color: ROPE });
    crate.box({ size: [0.14, 0.12, 0.12], base: [0, gy - 0.12, D / 2 + 0.12], color: PLANK, colorTop: PLANK_LIGHT });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crate', 0.06, 0.4, 'x');
      },
    });
  },

  // Schatztruhe: halb im Sand, Deckel offen, Goldmünzen quellen heraus, daneben eine Schaufel.
  'prop.entdecker.schatztruhe': () => {
    const m = createModel('prop.entdecker.schatztruhe');
    const p = m.part('chest');
    p.sphere({ r: 0.36, detail: 1, at: [0, 0, 0], scale: [1, 0.16, 0.85], color: SAND_DARK, colorTop: SAND_LIGHT, faceJitter: 0.05 });
    const W = 0.4;
    const D = 0.26;
    const H = 0.2;
    const y0 = 0.02;
    p.box({ size: [W, H, D], base: [0, y0, 0], color: WOOD_DARK, colorTop: WOOD });
    for (const x of [-0.13, 0.13]) p.box({ size: [0.04, H + 0.01, D + 0.012], base: [x, y0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    p.box({ size: [0.07, 0.08, 0.02], base: [0, y0 + H - 0.1, D / 2 + 0.004], color: GOLD_LIGHT, shade: 0 });
    // Deckel als Halbzylinder, aufgeklappt um das hintere Scharnier
    /** @type {[number, number][]} */
    const arcPts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI;
      arcPts.push([-D / 2 - Math.cos(a) * D / 2, Math.sin(a) * D / 2 * 0.9]);
    }
    p.extrude({ points: arcPts, depth: W, at: [0, y0 + H, -D / 2], rot: [-1.95, Math.PI / 2, 0], color: WOOD, colorTop: WOOD_LIGHT });
    // Goldberg in der Truhe
    p.sphere({ r: 0.17, detail: 1, at: [0, y0 + H - 0.02, 0], scale: [1.05, 0.45, 0.68], color: GOLD, colorTop: GOLD_LIGHT });
    for (const [x, z, r] of /** @type {Vec3[]} */ ([[-0.08, 0.03, 0.05], [0.07, -0.02, 0.045], [0.02, 0.06, 0.04]])) {
      p.sphere({ r, detail: 0, at: [x, y0 + H + 0.05, z], color: GOLD_LIGHT });
    }
    p.sphere({ r: 0.03, detail: 0, at: [-0.02, y0 + H + 0.07, -0.03], color: RED_LIGHT });
    p.sphere({ r: 0.028, detail: 0, at: [0.11, y0 + H + 0.04, 0.04], color: TEAL_LIGHT });
    // Münzen davor im Sand
    for (const [x, z] of /** @type {[number, number][]} */ ([[0.12, 0.22], [-0.05, 0.25], [0.24, 0.12], [0.02, 0.2]])) {
      p.cyl({ r: 0.035, h: 0.015, seg: 6, base: [x, 0.04, z], rot: [0.2, 0, 0.15], color: GOLD_LIGHT, shade: 0 });
    }
    // Schaufel steckt im Sand
    p.cyl({ r: 0.018, h: 0.42, seg: 5, base: [-0.28, 0.02, -0.06], rot: [0, 0, 0.35], color: WOOD, colorTop: WOOD_LIGHT });
    p.box({ size: [0.1, 0.12, 0.02], base: [-0.27, 0.0, -0.06], rot: [0, 0.3, 0.35], color: IRON_LIGHT });
    return m.build();
  },

  // Kanonenkugeln: Pyramide aus zehn Kugeln auf einem Holzrahmen, daneben eine kleine Kanone.
  'prop.entdecker.kanonenkugeln': () => {
    const m = createModel('prop.entdecker.kanonenkugeln');
    const p = m.part('balls');
    const r = 0.085;
    const cx = -0.06;
    const cz = 0;
    // Dreieckiger Rahmen; eine Kante zeigt zur Kanone (+X)
    const inR = (2 / 3) * r * Math.sqrt(3) + r + 0.012;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + Math.PI / 2;
      p.box({ size: [inR * 2 * Math.sqrt(3) + 0.02, 0.05, 0.05], base: [cx + Math.sin(a) * inR, 0, cz + Math.cos(a) * inR], rot: [0, a, 0], color: WOOD, colorTop: WOOD_LIGHT });
    }
    // Lagen 6, 3, 1 im Dreiecksgitter
    const h = r * 2 * Math.sqrt(2 / 3);
    for (let layer = 0; layer < 3; layer++) {
      const n = 3 - layer;
      const y = 0.03 + r + layer * h;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          const lx = (j - i / 2) * 2 * r;
          const lz = (i - (n - 1) * 2 / 3) * r * Math.sqrt(3);
          p.sphere({ r, detail: 1, at: [cx + lz, y, cz - lx], color: IRON, colorTop: IRON_LIGHT });
        }
      }
    }
    cannon(p, 0.28, 0, 0.02, 0.25, 1.2);
    return m.build();
  },

  // Steg: Bohlen auf runden Pfählen, zur Inselkante (+Z) hin; Seilgeländer, Poller, Taurolle, Laterne.
  'prop.entdecker.steg': () => {
    const m = createModel('prop.entdecker.steg');
    const p = m.part('pier');
    const z0 = -0.34;
    const z1 = 0.44;
    const hw = 0.15;
    const y = 0.13;
    for (const z of [z0 + 0.05, 0.05, z1 - 0.04]) {
      for (const x of [-hw + 0.02, hw - 0.02]) p.cyl({ r: 0.035, h: y + 0.02, seg: 6, base: [x, 0, z], color: WOOD_DARK, colorTop: WOOD });
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const z = z0 + ((i + 0.5) / n) * (z1 - z0);
      p.box({ size: [hw * 2 + (i % 2 ? 0.02 : -0.01), 0.04, (z1 - z0) / n - 0.012], base: [0, y, z], rot: [0, (i % 3 - 1) * 0.03, 0], color: PLANK, colorTop: PLANK_LIGHT });
    }
    // Seilgeländer an der linken Seite
    for (const z of [z0 + 0.05, 0.05, z1 - 0.04]) p.cyl({ r: 0.022, h: 0.26, seg: 5, base: [-hw + 0.01, y + 0.04, z], color: WOOD_DARK, colorTop: WOOD });
    p.cyl({ r: 0.012, h: z1 - z0 - 0.09, seg: 4, at: [-hw + 0.01, y + 0.26, (z0 + z1) / 2 + 0.005], rot: [Math.PI / 2, 0, 0], color: ROPE });
    // Poller und Taurolle am Ende
    p.cyl({ r: 0.04, rTop: 0.05, h: 0.1, seg: 6, base: [0.08, y + 0.04, z1 - 0.08], color: IRON, colorTop: IRON_LIGHT });
    p.torus({ r: 0.055, tube: 0.022, seg: 8, tubeSeg: 4, at: [0.06, y + 0.065, -0.1], color: ROPE });
    // Laterne
    p.cyl({ r: 0.018, h: 0.36, seg: 5, base: [-hw + 0.01, y + 0.04, z1 - 0.04], color: WOOD_DARK });
    p.box({ size: [0.07, 0.08, 0.07], base: [-hw + 0.01, y + 0.4, z1 - 0.04], color: LAMP, glow: 1.2 });
    p.pyramid({ size: [0.09, 0.05, 0.09], base: [-hw + 0.01, y + 0.48, z1 - 0.04], color: IRON });
    return m.build();
  },

  // Leuchtturm: rot-weiß geringelt, Galerie, leuchtende Laterne mit drehender Linse, rote Kappe; am Fuß ein Wärterhaus.
  'prop.entdecker.leuchtturm': () => {
    const m = createModel('prop.entdecker.leuchtturm');
    const p = m.part('tower');
    // Felsiger Fuß
    p.sphere({ r: 0.32, detail: 0, at: [0, 0.04, 0], scale: [1.1, 0.4, 1.05], color: STONE, colorTop: STONE_LIGHT, faceJitter: 0.08 });
    // Geringelter Schaft
    const rings = 5;
    const H = 1.3;
    const r0 = 0.25;
    const r1 = 0.15;
    for (let i = 0; i < rings; i++) {
      const a = i / rings;
      const b = (i + 1) / rings;
      const col = i % 2 ? WHITE : RED;
      p.cyl({ r: r0 + (r1 - r0) * a, rTop: r0 + (r1 - r0) * b, h: H / rings, seg: 8, base: [0, 0.1 + a * H, 0], color: i % 2 ? WHITE_SHADE : col, colorTop: i % 2 ? WHITE : RED_LIGHT });
    }
    const gy = 0.1 + H;
    // Galerie mit Geländer
    p.cyl({ r: 0.23, h: 0.05, seg: 8, base: [0, gy, 0], color: IRON, colorTop: IRON_LIGHT });
    p.torus({ r: 0.215, tube: 0.012, seg: 8, tubeSeg: 3, at: [0, gy + 0.14, 0], color: IRON });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.box({ size: [0.018, 0.13, 0.018], base: [Math.sin(a) * 0.215, gy + 0.05, Math.cos(a) * 0.215], color: IRON });
    }
    // Laterne: leuchtendes Glas, dunkle Streben, rote Kappe
    p.cyl({ r: 0.13, h: 0.22, seg: 8, base: [0, gy + 0.05, 0], color: LAMP, glow: 1.25 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 8;
      p.box({ size: [0.02, 0.22, 0.02], base: [Math.sin(a) * 0.132, gy + 0.05, Math.cos(a) * 0.132], color: IRON });
    }
    p.cone({ r: 0.17, h: 0.2, seg: 8, base: [0, gy + 0.27, 0], color: RED, colorTop: RED_LIGHT });
    p.sphere({ r: 0.035, detail: 0, at: [0, gy + 0.5, 0], color: GOLD_LIGHT });
    // Tür vorn
    p.box({ size: [0.1, 0.18, 0.02], base: [0, 0.12, 0.245], rot: [-0.08, 0, 0], color: TEAL, colorTop: TEAL_LIGHT });
    // Wärterhaus an der Seite
    p.box({ size: [0.2, 0.2, 0.24], base: [0.28, 0.02, -0.04], color: WHITE_SHADE, colorTop: WHITE });
    p.roof({ size: [0.24, 0.12, 0.3], base: [0.28, 0.22, -0.04], rot: [0, Math.PI / 2, 0], color: RED, colorTop: RED_LIGHT });
    // Drehende Linse
    const lamp = m.part('lens', { pivot: [0, gy + 0.16, 0] });
    lamp.box({ size: [0.3, 0.07, 0.07], at: [0, gy + 0.16, 0], color: '#fff4c8', glow: 1.5 });
    return m.build({
      animate(pose, ctx) {
        pose.lens.rotation.y = ctx.t * 1.2 + ctx.seed * TAU;
      },
    });
  },

  // Segelschiff: ferne Kulisse (stark vergrößert). Dunkler Rumpf mit hohem Achterkastell, petrolfarbenem Band,
  // zwei Masten mit bauchigen Rahsegeln, roten Wimpeln. Das ganze Schiff schaukelt.
  'prop.entdecker.segelschiff': () => {
    const m = createModel('prop.entdecker.segelschiff');
    const s = m.part('ship', { pivot: [0, 0, 0] });
    // Rumpf: Seitenriss in der XY-Ebene, mit der Drehung zeigt x nach +Z (Bug).
    /** @type {[number, number][]} */
    const hull = [[-0.46, -0.08], [0.3, -0.08], [0.5, 0.08], [0.6, 0.26], [0.36, 0.22], [-0.28, 0.22], [-0.34, 0.36], [-0.58, 0.38], [-0.56, 0.18]];
    s.extrude({ points: hull, depth: 0.3, at: [0, 0, 0], rot: [0, -Math.PI / 2, 0], color: WOOD_DARK, colorTop: WOOD });
    // Bänder an den Bordwänden
    s.box({ size: [0.312, 0.05, 0.86], at: [0, 0.15, 0.02], color: TEAL, colorTop: TEAL_LIGHT });
    s.box({ size: [0.312, 0.03, 0.8], at: [0, 0.06, 0.0], color: GOLD, shade: 0 });
    // Deck
    s.box({ size: [0.26, 0.02, 0.62], base: [0, 0.2, 0.04], color: PLANK, colorTop: PLANK_LIGHT });
    // Bugspriet
    s.cyl({ r: 0.02, h: 0.36, seg: 5, base: [0, 0.24, 0.5], rot: [1.15, 0, 0], color: WOOD });
    // Masten und Segel
    for (const [z, h] of /** @type {[number, number][]} */ ([[0.24, 0.9], [-0.1, 1.05]])) {
      s.cyl({ r: 0.026, rTop: 0.018, h, seg: 5, base: [0, 0.2, z], color: WOOD });
      for (const [y, w, sh] of /** @type {Vec3[]} */ ([[0.36, 0.6, 0.34], [0.72, 0.48, 0.27]])) {
        const sy = 0.2 + y * h;
        s.box({ size: [w + 0.08, 0.03, 0.03], at: [0, sy + sh / 2 + 0.01, z], color: WOOD_DARK });
        for (const side of [-1, 1]) {
          const at = /** @type {Vec3} */ ([side * w / 4, sy, z + 0.04]);
          s.box({ size: [w / 2, sh, 0.022], at, rot: [-0.08, side * 0.24, 0], color: WHITE_SHADE, colorTop: WHITE });
          if (y < 0.5) s.box({ size: [w / 2, 0.07, 0.026], at: [at[0], sy - 0.03, at[2] + 0.004], rot: [-0.08, side * 0.24, 0], color: RED, shade: 0 });
        }
      }
      const fl = m.part(`flag${z > 0 ? 'Fore' : 'Main'}`, { pivot: [0, 0.2 + h, z], parent: 'ship' });
      fl.extrude({ points: [[0, 0], [0, -0.1], [-0.28, -0.05]], depth: 0.02, at: [0, 0.2 + h, z], rot: [0, -Math.PI / 2, 0], color: RED, colorTop: RED_LIGHT });
    }
    // Klüver: dreieckiges Vorsegel zwischen Bugspriet und Fockmast
    s.extrude({ points: [[0.26, 0.26], [0.78, 0.3], [0.27, 0.92]], depth: 0.02, at: [0, 0, 0], rot: [0, -Math.PI / 2, 0], color: WHITE_SHADE, colorTop: WHITE });
    // Besan: Lateinersegel am Heck
    s.cyl({ r: 0.018, h: 0.5, seg: 5, base: [0, 0.36, -0.42], color: WOOD });
    s.extrude({ points: [[0, 0], [0.24, 0], [-0.04, 0.38]], depth: 0.02, at: [0, 0.44, -0.44], rot: [0, -Math.PI / 2, 0], color: WHITE_SHADE, colorTop: WHITE });
    // Heckfenster
    s.box({ size: [0.2, 0.06, 0.02], at: [0, 0.3, -0.585], color: LAMP, glow: 1.0 });
    return m.build({
      animate(pose, ctx) {
        const t = ctx.t + ctx.seed * 20;
        pose.ship.rotation.z = Math.sin(t * 0.7) * 0.05;
        pose.ship.rotation.x = Math.sin(t * 0.53 + 1) * 0.025;
        pose.ship.position.y = Math.sin(t * 0.9) * 0.02;
        A.sway(pose, ctx, 'flagFore', 0.3, 0.6, 'y');
        A.sway(pose, ctx, 'flagMain', 0.3, 0.55, 'y');
      },
    });
  },

  // Sperrfeld: Sandbank mit einem gestrandeten Ruderboot (rot-weiß, petrolfarbenes Band), Ruder und Felsbrocken.
  'prop.entdecker.block': () => {
    const m = createModel('prop.entdecker.block');
    const p = m.part('wreck');
    p.sphere({ r: 0.52, detail: 1, at: [0, 0, 0], scale: [1, 0.22, 0.9], color: SAND_DARK, colorTop: SAND_LIGHT, faceJitter: 0.05 });
    // Gestrandetes Ruderboot, leicht schräg
    rowboat(p, 0, 0.08, 0, 0.5, 1, 0.08);
    // Ruder im Sand
    p.box({ size: [0.5, 0.025, 0.035], at: [0.08, 0.1, 0.28], rot: [0, -0.3, 0.12], color: WOOD_LIGHT });
    p.box({ size: [0.14, 0.02, 0.08], at: [0.32, 0.07, 0.36], rot: [0, -0.3, 0.12], color: WOOD_LIGHT });
    // Felsen und Strandhafer
    p.sphere({ r: 0.16, detail: 0, at: [-0.3, 0.08, -0.22], scale: [1.1, 0.8, 1], color: STONE, colorTop: STONE_LIGHT, faceJitter: 0.08 });
    p.sphere({ r: 0.1, detail: 0, at: [-0.16, 0.05, -0.32], color: STONE, colorTop: STONE_LIGHT, faceJitter: 0.08 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      p.cone({ r: 0.03, h: 0.18, seg: 3, base: [0.32 + Math.sin(a) * 0.03, 0.04, -0.2 + Math.cos(a) * 0.03], rot: [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3], color: DUNE, colorTop: DUNE_TOP });
    }
    return m.build();
  },

  // Bodendeko 1: Büschel Strandhafer mit einer Muschel.
  'prop.entdecker.deko1': () => {
    const m = createModel('prop.entdecker.deko1');
    const p = m.part('grass');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      p.cone({ r: 0.032, h: 0.17 + (i % 3) * 0.035, seg: 3, base: [Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04], rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], color: DUNE, colorTop: DUNE_TOP });
    }
    // Strandnelken
    for (const [x, z, hh] of /** @type {Vec3[]} */ ([[0.09, -0.05, 0.16], [-0.08, 0.07, 0.13], [0.03, 0.1, 0.19]])) {
      p.cyl({ r: 0.01, h: hh, seg: 3, base: [x, 0, z], color: DUNE });
      p.sphere({ r: 0.04, detail: 0, at: [x, hh + 0.01, z], scale: [1, 0.7, 1], color: PINK, colorTop: tone(PINK, 0.3) });
    }
    p.cone({ r: 0.06, h: 0.04, seg: 6, base: [0.13, 0, 0.1], rot: [0.2, 0, 0], scale: [1, 1, 0.8], color: SHELL, colorTop: '#fff2e6' });
    return m.build();
  },

  // Bodendeko 2: Sandfleck mit rotem Seestern und Muscheln.
  'prop.entdecker.deko2': () => {
    const m = createModel('prop.entdecker.deko2');
    const p = m.part('sand');
    p.sphere({ r: 0.2, detail: 0, at: [0, 0, 0], scale: [1, 0.1, 0.85], color: SAND, colorTop: SAND_LIGHT });
    /** @type {[number, number][]} */
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const r = i % 2 ? 0.035 : 0.1;
      star.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
    star.reverse();
    p.extrude({ points: star, depth: 0.025, at: [0.02, 0.03, 0.01], rot: [-Math.PI / 2, 0.4, 0], color: CORAL, colorTop: CORAL_LIGHT });
    p.cone({ r: 0.04, h: 0.03, seg: 6, base: [-0.11, 0.01, -0.06], scale: [1, 1, 0.8], color: SHELL, colorTop: '#fff2e6' });
    p.cone({ r: 0.03, h: 0.025, seg: 6, base: [-0.06, 0.01, 0.1], rot: [0, 1, 0], scale: [1, 1, 0.8], color: WHITE, colorTop: '#fff8ee' });
    return m.build();
  },
};
