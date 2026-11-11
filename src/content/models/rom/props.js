// @ts-check
// Römisches Reich: Requisiten und die Basis (Tempel der Flamme).
import * as A from '../../../render/anim.js';
import { createModel, tone } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Römischen Reichs ---
const MARBLE = '#efe9db';
const MARBLE_SHADE = '#d6cdb9';
const MARBLE_DARK = '#bdb39c';
const TRAVERTINE = '#dccfb0';
const TRAVERTINE_DARK = '#c2b391';
const ROOF = '#c0392b';
const ROOF_LIGHT = '#dc5a44';
const ROOF_DARK = '#9c2c22';
const GOLD = '#e0b03a';
const GOLD_LIGHT = '#f4d573';
const BRONZE = '#a9743a';
const BRONZE_LIGHT = '#cf9a55';
const TERRA = '#c56a3c';
const TERRA_LIGHT = '#e3915f';
const WOOD = '#8a6240';
const WOOD_DARK = '#6d4a2e';
const WOOD_LIGHT = '#ad8257';
const OLIVE_BARK = '#74604a';
const OLIVE_BARK_TOP = '#98836a';
const CYPRESS = '#2c6444';
const CYPRESS_TOP = '#5a9a58';
const OLIVE = '#74906a';
const OLIVE_TOP = '#b9cc9c';
const VINE = '#5c9a48';
const VINE_TOP = '#9ccb62';
const GRAPE = '#7b4a9e';
const GRAPE_LIGHT = '#a878c8';
const WATER = '#49bcd2';
const WATER_LIGHT = '#a5e6ee';
const BLUE = '#3f7fb5';
const DARK = '#3a2f2a';
const FLAME = '#ff7418';
const FLAME_TOP = '#ffc23c';
const FLAME_CORE = '#ffc24a';
const FLAME_CORE_TOP = '#fff0b0';
const EMBER = '#ff6a2a';

const TAU = Math.PI * 2;

/**
 * Säule mit Fußplatte, verjüngtem Schaft und Kapitell.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y Unterkante
 * @param {number} z
 * @param {number} h Gesamthöhe
 * @param {number} r Radius des Schafts unten
 * @param {string} [color]
 */
function column(p, x, y, z, h, r, color = MARBLE) {
  const foot = r * 0.5;
  const cap = r * 0.75;
  p.box({ size: [r * 2.7, foot, r * 2.7], base: [x, y, z], color: MARBLE_SHADE });
  p.cyl({ r, rTop: r * 0.82, h: h - foot - cap, seg: 7, base: [x, y + foot, z], color, shade: 0.12 });
  p.box({ size: [r * 2.8, cap, r * 2.8], base: [x, y + h - cap, z], color: MARBLE_SHADE, shade: 0 });
}

/**
 * Amphore aus einem Drehprofil; der Fuß liegt bei `base`.
 * @param {PartBuilder} p
 * @param {Vec3} base
 * @param {number} s Maßstab (1 = 0,46 hoch)
 * @param {Vec3} [rot]
 * @param {string} [color]
 */
function amphora(p, base, s, rot = [0, 0, 0], color = TERRA) {
  p.lathe({
    points: [[0, 0], [0.035, 0], [0.11, 0.12], [0.145, 0.24], [0.12, 0.33], [0.05, 0.38], [0.05, 0.43], [0.075, 0.46], [0, 0.46]],
    seg: 7, base, rot, scale: s, color, colorTop: tone(color, 0.3),
  });
}

/**
 * Flamme aus drei ineinander steckenden Kegeln; der Fuß liegt bei (x, y, z).
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {number} h
 */
function flameShape(p, x, y, z, r, h) {
  p.cone({ r, h, seg: 6, base: [x, y, z], color: FLAME, colorTop: FLAME_TOP, glow: 1.02 });
  p.cone({ r: r * 0.58, h: h * 0.62, seg: 5, base: [x + r * 0.12, y, z + r * 0.3], color: FLAME_CORE, colorTop: FLAME_CORE_TOP, glow: 1.3 });
  p.cone({ r: r * 0.45, h: h * 0.55, seg: 5, base: [x - r * 0.55, y, z - r * 0.1], rot: [0, 0, 0.25], color: FLAME, colorTop: FLAME_TOP, glow: 1.02 });
}

/**
 * Umriss einer Bogenwand: Rechteck mit halbrunden Öffnungen an der Unterkante.
 * @param {number} half halbe Länge
 * @param {number} top Höhe der Wand
 * @param {number[]} centers x-Mitten der Bögen, aufsteigend
 * @param {number} r Bogenradius
 * @param {number} spring Höhe des Bogenansatzes
 * @returns {[number, number][]}
 */
function arcadeOutline(half, top, centers, r, spring) {
  /** @type {[number, number][]} */
  const pts = [[-half, 0]];
  for (const c of centers) {
    pts.push([c - r, 0]);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI - (i / 6) * Math.PI;
      pts.push([c + Math.cos(a) * r, spring + Math.sin(a) * r]);
    }
    pts.push([c + r, 0]);
  }
  pts.push([half, 0], [half, top], [-half, top]);
  return pts;
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Tempel der Flamme: Marmorpodium mit Stufen, Tempel mit sechs Säulen, Giebel und rotem Dach.
  // Die Flamme brennt in einer großen Bronzeschale auf dem Altar im Seitenhof (+X), damit sie auch
  // von hinten rechts (Standardkamera) frei zu sehen ist.
  'base.rom': () => {
    const m = createModel('base.rom');
    const t = m.part('temple');
    // Stufenpodium
    t.box({ size: [2.4, 0.1, 2.4], base: [0, 0, 0], color: MARBLE_DARK });
    t.box({ size: [2.24, 0.1, 2.24], base: [0, 0.1, 0], color: MARBLE_SHADE });
    t.box({ size: [2.08, 0.1, 2.08], base: [0, 0.2, 0], color: MARBLE, shade: 0.05 });
    const py = 0.3;
    const cx = -0.34; // Mittelachse des Tempels
    const CH = 1.1; // Säulenhöhe
    // Cella mit rotem Sockelband und Pilastern
    t.box({ size: [1.0, CH, 1.1], base: [cx, py, -0.42], color: MARBLE, shade: 0.08 });
    t.box({ size: [1.02, 0.24, 1.12], base: [cx, py, -0.42], color: ROOF_DARK, colorTop: ROOF });
    // Halbsäulen an den Längswänden und der Rückwand: der Tempel bleibt auch von der Seite ein Säulenbau
    for (const z of [-0.92, -0.59, -0.26, 0.07]) {
      column(t, cx - 0.52, py, z, CH, 0.09);
      column(t, cx + 0.52, py, z, CH, 0.09);
    }
    column(t, cx - 0.18, py, -0.97, CH, 0.09);
    column(t, cx + 0.18, py, -0.97, CH, 0.09);
    // Tür
    t.box({ size: [0.36, 0.72, 0.03], base: [cx, py, 0.14], color: WOOD_DARK, colorTop: WOOD });
    t.box({ size: [0.42, 0.06, 0.04], base: [cx, py + 0.72, 0.14], color: GOLD });
    // Sechs Säulen der Vorhalle
    for (const dx of [-0.57, -0.19, 0.19, 0.57]) column(t, cx + dx, py, 0.74, CH, 0.09);
    column(t, cx - 0.57, py, 0.42, CH, 0.09);
    column(t, cx + 0.57, py, 0.42, CH, 0.09);
    // Gebälk mit Goldfries
    const ey = py + CH;
    t.box({ size: [1.36, 0.14, 1.94], base: [cx, ey, -0.07], color: MARBLE, shade: 0 });
    t.box({ size: [1.38, 0.05, 1.96], base: [cx, ey + 0.05, -0.07], color: GOLD });
    // Rotes Satteldach, First entlang Z
    const ry = ey + 0.14;
    t.roof({ size: [2.04, 0.52, 1.5], base: [cx, ry, -0.07], rot: [0, Math.PI / 2, 0], color: ROOF, colorTop: ROOF_LIGHT });
    // Firstziegel und Ziegelrippen
    t.box({ size: [0.08, 0.06, 2.06], at: [cx, ry + 0.52, -0.07], color: ROOF_DARK });
    const slope = Math.atan2(0.52, 0.75);
    for (const dz of [-0.76, -0.38, 0, 0.38, 0.76]) {
      for (const sd of [1, -1]) {
        t.box({ size: [0.9, 0.035, 0.07], at: [cx + sd * 0.385, ry + 0.275, -0.07 + dz], rot: [0, 0, -sd * slope], color: ROOF_DARK, colorTop: ROOF });
      }
    }
    // Giebelfelder aus Marmor mit Goldscheibe (vorn und hinten)
    for (const s of [1, -1]) {
      t.extrude({ points: [[-0.6, 0], [0.6, 0], [0, 0.415]], depth: 0.03, base: [cx, ry + 0.02, -0.07 + s * 1.02], color: MARBLE });
      t.cyl({ r: 0.1, h: 0.03, seg: 8, at: [cx, ry + 0.17, -0.07 + s * 1.045], rot: [Math.PI / 2, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
      // Akroterien
      t.sphere({ r: 0.07, detail: 0, at: [cx, ry + 0.59, -0.07 + s * 1.0], color: GOLD_LIGHT });
      t.sphere({ r: 0.055, detail: 0, at: [cx - 0.72, ry + 0.06, -0.07 + s * 1.0], color: GOLD, mirror: false });
      t.sphere({ r: 0.055, detail: 0, at: [cx + 0.72, ry + 0.06, -0.07 + s * 1.0], color: GOLD });
    }
    // Altar mit Bronzeschale im Seitenhof
    const ax = 0.68;
    const az = 0.05;
    t.box({ size: [0.5, 0.08, 0.5], base: [ax, py, az], color: MARBLE_SHADE });
    t.cyl({ r: 0.17, rTop: 0.14, h: 0.34, seg: 8, base: [ax, py + 0.08, az], color: MARBLE });
    t.cyl({ r: 0.175, h: 0.07, seg: 8, base: [ax, py + 0.2, az], color: ROOF });
    t.lathe({ points: [[0, 0], [0.1, 0], [0.26, 0.1], [0.34, 0.2], [0.3, 0.2], [0, 0.14]], seg: 9, base: [ax, py + 0.42, az], color: BRONZE, colorTop: BRONZE_LIGHT });
    t.sphere({ r: 0.24, detail: 0, at: [ax, py + 0.6, az], scale: [1, 0.3, 1], color: EMBER, glow: 1.3 });
    // Lorbeerbäumchen in Tontöpfen an den Ecken des Hofs
    for (const z of [-0.84, 0.3]) {
      const lx = z < 0 ? 0.86 : 0.98;
      t.cyl({ r: 0.07, rTop: 0.1, h: 0.14, seg: 6, base: [lx, py, z], color: TERRA, colorTop: TERRA_LIGHT });
      t.sphere({ r: 0.16, detail: 0, at: [lx, py + 0.3, z], scale: [1, 1.15, 1], rot: [0, z, 0], color: CYPRESS, colorTop: CYPRESS_TOP, faceJitter: 0.08 });
    }
    // Adlerstandarte vorn rechts
    const sx = 0.9;
    const sz = 0.86;
    t.cyl({ r: 0.09, h: 0.1, seg: 6, base: [sx, py, sz], color: MARBLE_SHADE });
    t.cyl({ r: 0.035, h: 2.0, seg: 5, base: [sx, py, sz], color: WOOD, colorTop: WOOD_LIGHT });
    t.box({ size: [0.4, 0.04, 0.04], at: [sx, py + 1.72, sz], color: GOLD });
    t.cyl({ r: 0.085, h: 0.04, seg: 8, at: [sx, py + 1.86, sz], rot: [Math.PI / 2, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    // Adler
    const eyy = py + 2.1;
    t.sphere({ r: 0.1, detail: 0, at: [sx, eyy, sz], scale: [0.9, 1.1, 1], color: GOLD, colorTop: GOLD_LIGHT });
    t.sphere({ r: 0.06, detail: 0, at: [sx, eyy + 0.13, sz + 0.05], color: GOLD_LIGHT });
    t.box({ size: [0.3, 0.16, 0.035], at: [sx - 0.2, eyy + 0.08, sz], rot: [0, 0, -0.5], color: GOLD, colorTop: GOLD_LIGHT });
    t.box({ size: [0.3, 0.16, 0.035], at: [sx + 0.2, eyy + 0.08, sz], rot: [0, 0, 0.5], color: GOLD, colorTop: GOLD_LIGHT });
    // Rotes Tuch der Standarte
    const cloth = m.part('cloth', { pivot: [sx, py + 1.7, sz] });
    cloth.box({ size: [0.34, 0.4, 0.03], at: [sx, py + 1.5, sz], color: ROOF, colorTop: ROOF_LIGHT });
    cloth.box({ size: [0.34, 0.05, 0.036], at: [sx, py + 1.32, sz], color: GOLD });

    // Die Flamme
    const fy = py + 0.6;
    const flame = m.part('flame', { pivot: [ax, fy, az] });
    flameShape(flame, ax, fy, az, 0.27, 0.9);

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 9.1) * 0.05 + Math.sin(ctx.t * 14.7 + 1.3) * 0.03;
        f.scale.set(s * (1 - flick * 0.6), s * (1 + flick), s * (1 - flick * 0.6));
        f.rotation.y = ctx.t * 0.9;
        f.rotation.z = Math.sin(ctx.t * 3.3) * 0.05;
        A.sway(pose, ctx, 'cloth', 0.08, 0.3, 'x');
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Zypresse: hohe, schlanke, dunkelgrüne Spindel auf kurzem Stamm.
  'prop.rom.zypresse': () => {
    const m = createModel('prop.rom.zypresse');
    m.part('trunk').cyl({ r: 0.06, rTop: 0.045, h: 0.3, seg: 5, base: [0, 0, 0], color: WOOD_DARK, colorTop: WOOD });
    const crown = m.part('crown', { pivot: [0, 0.2, 0] });
    crown.lathe({ points: [[0, 0.16], [0.16, 0.26], [0.21, 0.62], [0.17, 1.1], [0.09, 1.55], [0, 1.9]], seg: 6, color: CYPRESS, colorTop: CYPRESS_TOP, faceJitter: 0.08 });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.025, 0.2);
        A.sway(pose, ctx, 'crown', 0.015, 0.14, 'x');
      },
    });
  },

  // Säule: eine stehende Säule, daneben ein Stumpf und eine umgestürzte Trommel.
  'prop.rom.saeule': () => {
    const m = createModel('prop.rom.saeule');
    const p = m.part('column');
    column(p, -0.14, 0, -0.1, 1.25, 0.12);
    // Stumpf mit schräger Bruchkante
    p.box({ size: [0.32, 0.06, 0.32], base: [0.26, 0, 0.06], color: MARBLE_SHADE });
    p.cyl({ r: 0.12, rTop: 0.11, h: 0.3, seg: 7, base: [0.26, 0.06, 0.06], color: MARBLE });
    p.cyl({ r: 0.11, h: 0.1, seg: 7, at: [0.26, 0.37, 0.06], rot: [0.3, 0, 0.25], color: MARBLE_SHADE });
    // Umgestürzte Trommel
    p.cyl({ r: 0.11, h: 0.42, seg: 7, at: [-0.05, 0.1, 0.36], rot: [Math.PI / 2, 0, 1.1], color: MARBLE, faceJitter: 0.04 });
    return m.build();
  },

  // Aquädukt: ein zweistöckiges Joch aus Travertin (großer Bogen, darüber zwei kleine), oben die Wasserrinne.
  // Bewusst schmal (Radius unter 0,47), damit es auf die Randplätze der Insel passt; die Länge liegt entlang X.
  'prop.rom.aquaedukt': () => {
    const m = createModel('prop.rom.aquaedukt');
    const p = m.part('arches');
    p.extrude({ points: arcadeOutline(0.44, 1.02, [0], 0.27, 0.6), depth: 0.25, color: TRAVERTINE_DARK, colorTop: TRAVERTINE });
    // Kämpfer am Bogenansatz
    for (const x of [-0.355, 0.355]) p.box({ size: [0.17, 0.06, 0.3], base: [x, 0.56, 0], color: MARBLE_SHADE });
    p.box({ size: [0.88, 0.07, 0.3], base: [0, 1.02, 0], color: MARBLE_SHADE });
    p.extrude({ points: arcadeOutline(0.42, 0.5, [-0.2, 0.2], 0.125, 0.22), depth: 0.22, base: [0, 1.09, 0], color: TRAVERTINE, colorTop: tone(TRAVERTINE, 0.25) });
    // Gesims und Wasserrinne
    p.box({ size: [0.88, 0.07, 0.3], base: [0, 1.59, 0], color: MARBLE_SHADE });
    p.box({ size: [0.88, 0.08, 0.06], base: [0, 1.66, 0.12], color: TRAVERTINE });
    p.box({ size: [0.88, 0.08, 0.06], base: [0, 1.66, -0.12], color: TRAVERTINE });
    p.box({ size: [0.88, 0.05, 0.19], base: [0, 1.66, 0], color: WATER, shade: 0 });
    return m.build();
  },

  // Olivenbaum: krummer Stamm, drei flache graugrüne Laubpolster.
  'prop.rom.olivenbaum': () => {
    const m = createModel('prop.rom.olivenbaum');
    const trunk = m.part('trunk');
    trunk.cyl({ r: 0.1, rTop: 0.07, h: 0.4, seg: 6, base: [0, 0, 0], rot: [0, 0, -0.38], color: OLIVE_BARK, colorTop: OLIVE_BARK_TOP, faceJitter: 0.05 });
    trunk.cyl({ r: 0.07, rTop: 0.05, h: 0.36, seg: 5, base: [0.14, 0.35, 0], rot: [0.1, 0, 0.5], color: OLIVE_BARK_TOP, faceJitter: 0.05 });
    trunk.cyl({ r: 0.045, h: 0.3, seg: 5, base: [0.14, 0.36, 0], rot: [-0.2, 0, -0.75], color: OLIVE_BARK_TOP });
    const crown = m.part('crown', { pivot: [0.05, 0.55, 0] });
    crown.sphere({ r: 0.32, detail: 1, at: [-0.08, 0.78, 0.02], scale: [1, 0.55, 1], color: OLIVE, colorTop: OLIVE_TOP, faceJitter: 0.08 });
    crown.sphere({ r: 0.26, detail: 1, at: [0.3, 0.66, -0.08], scale: [1, 0.55, 1], rot: [0, 0.8, 0], color: OLIVE, colorTop: OLIVE_TOP, faceJitter: 0.08 });
    crown.sphere({ r: 0.2, detail: 1, at: [0.1, 0.95, 0.1], scale: [1, 0.6, 1], rot: [0, 1.7, 0], color: tone(OLIVE, 0.1), colorTop: '#c8d8ac', faceJitter: 0.08 });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.03, 0.22);
        A.sway(pose, ctx, 'crown', 0.02, 0.16, 'x');
      },
    });
  },

  // Pergola: vier Pfosten, Lattenrost, Weinlaub und dicke Trauben.
  'prop.rom.pergola': () => {
    const m = createModel('prop.rom.pergola');
    const p = m.part('frame');
    for (const [x, z] of /** @type {[number, number][]} */ ([[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]])) {
      p.box({ size: [0.11, 0.05, 0.11], base: [x, 0, z], color: MARBLE_SHADE });
      p.cyl({ r: 0.04, h: 0.62, seg: 6, base: [x, 0.05, z], color: MARBLE });
    }
    for (const z of [-0.28, 0.28]) p.box({ size: [1.0, 0.06, 0.07], base: [0, 0.67, z], color: WOOD, colorTop: WOOD_LIGHT });
    for (let i = 0; i < 5; i++) p.box({ size: [0.05, 0.045, 0.78], base: [-0.4 + i * 0.2, 0.73, 0], color: WOOD_LIGHT });
    // Weinlaub liegt auf dem Rost
    const vine = m.part('vine', { pivot: [0, 0.75, 0] });
    vine.sphere({ r: 0.26, detail: 0, at: [-0.22, 0.8, -0.08], scale: [1.1, 0.3, 1], rot: [0, 0.4, 0], color: VINE, colorTop: VINE_TOP, faceJitter: 0.08 });
    vine.sphere({ r: 0.22, detail: 0, at: [0.24, 0.8, 0.12], scale: [1.1, 0.32, 1], rot: [0, 1.3, 0], color: VINE, colorTop: VINE_TOP, faceJitter: 0.08 });
    vine.sphere({ r: 0.16, detail: 0, at: [0.1, 0.81, -0.26], scale: [1, 0.35, 1], rot: [0, 2.2, 0], color: VINE, colorTop: VINE_TOP, faceJitter: 0.08 });
    // Trauben
    for (const [x, y, z] of /** @type {Vec3[]} */ ([[-0.4, 0.66, 0.36], [0.02, 0.84, 0.2], [0.42, 0.66, -0.34], [-0.1, 0.62, -0.36], [0.3, 0.86, -0.06]])) {
      vine.sphere({ r: 0.075, detail: 0, at: [x, y, z], color: GRAPE, colorTop: GRAPE_LIGHT });
      vine.sphere({ r: 0.055, detail: 0, at: [x + 0.03, y - 0.08, z + 0.02], color: GRAPE });
    }
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'vine', 0.02, 0.25);
      },
    });
  },

  // Marmorstatue: Sockel, Togafigur mit erhobenem Arm, goldener Kranz und goldene Kugel in der Hand.
  'prop.rom.statue': () => {
    const m = createModel('prop.rom.statue');
    const p = m.part('statue');
    p.box({ size: [0.46, 0.08, 0.46], base: [0, 0, 0], color: MARBLE_DARK });
    p.box({ size: [0.36, 0.34, 0.36], base: [0, 0.08, 0], color: MARBLE_SHADE });
    p.box({ size: [0.42, 0.06, 0.42], base: [0, 0.42, 0], color: MARBLE });
    p.box({ size: [0.2, 0.12, 0.02], at: [0, 0.26, 0.186], color: ROOF });
    // Toga
    p.cyl({ r: 0.15, rTop: 0.11, h: 0.48, seg: 7, base: [0, 0.48, 0], color: MARBLE_SHADE, colorTop: MARBLE });
    p.sphere({ r: 0.14, detail: 0, at: [0, 0.98, 0], scale: [1.15, 0.6, 0.85], color: MARBLE });
    p.box({ size: [0.07, 0.36, 0.29], at: [0, 0.79, 0], rot: [0, 0, 0.6], color: ROOF, colorTop: ROOF_LIGHT });
    // Kopf mit Goldkranz
    p.sphere({ r: 0.1, detail: 1, at: [0, 1.14, 0.01], color: MARBLE });
    p.torus({ r: 0.085, tube: 0.025, seg: 7, tubeSeg: 4, at: [0, 1.17, 0], rot: [-0.25, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });
    // Erhobener Arm mit goldener Kugel, der andere Arm angelegt
    p.cyl({ r: 0.04, h: 0.36, seg: 5, base: [0.13, 0.98, 0.02], rot: [0.25, 0, -0.5], color: MARBLE });
    p.sphere({ r: 0.075, detail: 0, at: [0.32, 1.36, 0.11], color: GOLD, colorTop: GOLD_LIGHT });
    p.cyl({ r: 0.04, h: 0.3, seg: 5, base: [-0.15, 0.7, 0.04], rot: [0, 0, 0.12], color: MARBLE });
    return m.build();
  },

  // Amphoren: drei Tonkrüge, einer liegt.
  'prop.rom.amphoren': () => {
    const m = createModel('prop.rom.amphoren');
    const p = m.part('jars');
    amphora(p, [-0.14, 0, -0.06], 1.05);
    amphora(p, [0.16, 0, -0.1], 0.9, [0, 1, 0], TERRA_LIGHT);
    amphora(p, [0.22, 0.12, 0.2], 0.85, [0, 0.5, 1.45], tone(TERRA, -0.1));
    // Deckel und Ölglanz
    p.cyl({ r: 0.06, h: 0.03, seg: 6, base: [-0.14, 0.483, -0.06], color: MARBLE_SHADE });
    p.box({ size: [0.5, 0.03, 0.4], base: [0.02, 0, 0], color: WOOD, rot: [0, 0.2, 0] });
    return m.build();
  },

  // Mosaikplatz: flache Scheibe mit farbigen Ringen und goldenem Stern.
  'prop.rom.mosaik': () => {
    const m = createModel('prop.rom.mosaik');
    const p = m.part('disc');
    /** @type {[number, number, string][]} */
    const rings = [[0.6, 0.03, MARBLE_SHADE], [0.53, 0.036, ROOF], [0.45, 0.042, MARBLE], [0.36, 0.048, BLUE], [0.25, 0.054, MARBLE]];
    for (const [r, h, c] of rings) p.cyl({ r, h, seg: 12, base: [0, 0, 0], color: c, shade: 0 });
    p.box({ size: [0.28, 0.06, 0.28], base: [0, 0, 0], color: GOLD, shade: 0 });
    p.box({ size: [0.28, 0.06, 0.28], base: [0, 0.0005, 0], rot: [0, Math.PI / 4, 0], color: GOLD, shade: 0 });
    p.cyl({ r: 0.07, h: 0.066, seg: 8, base: [0, 0, 0], color: ROOF, shade: 0 });
    return m.build();
  },

  // Sperrfeld: achteckiger Marmorbrunnen mit türkisem Wasser.
  'prop.rom.block': () => {
    const m = createModel('prop.rom.block');
    const p = m.part('basin');
    const turn = Math.PI / 8;
    p.cyl({ r: 0.47, h: 0.07, seg: 8, base: [0, 0, 0], rot: [0, turn, 0], color: MARBLE_DARK });
    p.cyl({ r: 0.43, rTop: 0.41, h: 0.2, seg: 8, base: [0, 0.07, 0], rot: [0, turn, 0], color: MARBLE });
    p.cyl({ r: 0.44, h: 0.05, seg: 8, base: [0, 0.25, 0], rot: [0, turn, 0], color: MARBLE_SHADE, shade: 0 });
    p.cyl({ r: 0.35, h: 0.02, seg: 8, base: [0, 0.29, 0], rot: [0, turn, 0], color: WATER, colorTop: WATER, shade: 0 });
    // Mittelsäule mit Schale
    p.cyl({ r: 0.07, rTop: 0.05, h: 0.34, seg: 6, base: [0, 0.3, 0], color: MARBLE });
    p.lathe({ points: [[0, 0], [0.06, 0], [0.2, 0.08], [0.18, 0.08], [0, 0.04]], seg: 8, base: [0, 0.62, 0], color: MARBLE_SHADE, colorTop: MARBLE });
    const water = m.part('water', { pivot: [0, 0.68, 0] });
    water.cyl({ r: 0.16, h: 0.02, seg: 8, base: [0, 0.685, 0], color: WATER_LIGHT, shade: 0 });
    water.sphere({ r: 0.07, detail: 0, at: [0, 0.75, 0], scale: [1, 1.3, 1], color: WATER_LIGHT, colorTop: '#e6fbff' });
    return m.build({
      animate(pose, ctx) {
        const s = 1 + Math.sin((ctx.t + ctx.seed * 4) * 3.1) * 0.12;
        pose.water.scale.set(1, s, 1);
      },
    });
  },

  // Bodendeko 1: Grasbüschel mit rotem Mohn.
  'prop.rom.deko1': () => {
    const m = createModel('prop.rom.deko1');
    const p = m.part('poppies');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      p.cone({ r: 0.035, h: 0.12 + (i % 2) * 0.04, seg: 3, base: [Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04], rot: [0, a - Math.PI / 2, -0.35], color: '#7d9a4a', colorTop: '#c3d27a' });
    }
    for (const [x, y, z] of /** @type {Vec3[]} */ ([[0.07, 0.14, 0.03], [-0.06, 0.11, -0.05], [-0.02, 0.17, 0.08]])) {
      p.sphere({ r: 0.04, detail: 0, at: [x, y, z], scale: [1, 0.6, 1], color: ROOF, colorTop: ROOF_LIGHT });
    }
    return m.build();
  },

  // Bodendeko 2: Reste von Marmorpflaster mit einer Tonscherbe.
  'prop.rom.deko2': () => {
    const m = createModel('prop.rom.deko2');
    const p = m.part('slabs');
    p.box({ size: [0.16, 0.025, 0.13], base: [-0.05, 0, 0.02], rot: [0, 0.3, 0], color: MARBLE });
    p.box({ size: [0.11, 0.022, 0.1], base: [0.1, 0, -0.05], rot: [0, -0.5, 0], color: MARBLE_SHADE });
    p.box({ size: [0.08, 0.02, 0.07], base: [0.06, 0, 0.1], rot: [0, 1.0, 0], color: MARBLE });
    p.cone({ r: 0.04, h: 0.05, seg: 4, base: [-0.08, 0, -0.1], rot: [0.3, 0.6, 0], color: TERRA, colorTop: TERRA_LIGHT });
    return m.build();
  },
};
