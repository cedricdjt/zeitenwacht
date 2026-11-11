// @ts-check
// Türme der Nahen Zukunft: Laserturm, Raketenwerfer, Klebeschaum-Werfer, Schienenkanone, Plasmabrenner, Leitrechner.
// Alle stehen auf demselben weißen Sechsecksockel mit einem Leuchtband in der Rollenfarbe
// (gleiche Lage von Band und Stufenpunkten wie in Steinzeit und Rom).

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
/** Dreht ein Sechseck so, dass eine flache Seite nach vorn (+Z) zeigt. */
const HEX = Math.PI / 6;

// --- Materialfarben des Zeitalters ---
const WHITE = '#eef1f5';
const WHITE_SHADE = '#c6cedc';
const PLATE = '#97a3b8';
const DARK = '#2b3247';
const DARK_LIGHT = '#48526d';
const FOAM = '#dff5f0';

// --- Rollenfarben (matt) und ihre ruhigen Leuchttöne ---
const BLUE = '#3d7dd8';
const BLUE_LIGHT = '#8ec2ff';
const ORANGE = '#e8842a';
const ORANGE_LIGHT = '#ffb866';
const TEAL = '#26b5a8';
const TEAL_LIGHT = '#6fe6d6';
const VIOLET = '#8a55d6';
const VIOLET_LIGHT = '#c09bff';
const RED = '#d8432f';
const PLASMA = '#ff4f7a';
const PLASMA_LIGHT = '#ff9ab0';
const HEAT_RING = '#d3a2ad';
const GOLD = '#f2c230';
const GOLD_LIGHT = '#ffe07a';

/** Leuchtstärke der ruhigen Leuchtflächen (Bänder, Ringe); echte Lichtquellen nutzen `glow: true`. */
const CALM = 1.05;
/** Leuchtstärke der Akzentflächen in der Rollenfarbe, die man von oben sieht (sonst versinken sie in der Nacht). */
const LIT = 0.9;

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
 * @param {{ rTop?: number, seg?: number, colorTop?: string, glow?: boolean | number }} [o]
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
 * Weißer Sechsecksockel mit Leuchtband in der Rollenfarbe und dem ersten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function plinth(m, role) {
  const base = m.part('base');
  base.cyl({ r: 0.47, rTop: 0.46, h: 0.16, seg: 6, base: [0, -0.05, 0], rot: [0, HEX, 0], color: PLATE, colorTop: WHITE_SHADE });
  base.cyl({ r: 0.452, h: 0.07, seg: 6, base: [0, 0.105, 0], rot: [0, HEX, 0], color: role, glow: CALM });
  base.cyl({ r: 0.46, rTop: 0.43, h: 0.065, seg: 6, base: [0, 0.17, 0], rot: [0, HEX, 0], color: WHITE_SHADE, colorTop: WHITE });
  base.sphere({ r: 0.042, detail: 0, at: [0, 0.238, 0.335], color: role, glow: CALM });
  return base;
}

/**
 * Teil der Stufe 2: zweites Leuchtband, sechs Eckpoller, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.487, h: 0.04, seg: 6, base: [0, 0.015, 0], rot: [0, HEX, 0], color: role, glow: CALM });
  for (let i = 0; i < 6; i++) {
    const a = HEX + (i * Math.PI) / 3;
    const x = Math.sin(a) * 0.43;
    const z = Math.cos(a) * 0.43;
    p.cyl({ r: 0.075, rTop: 0.06, h: 0.2, seg: 6, base: [x, -0.03, z], rot: [0, a, 0], color: WHITE_SHADE, colorTop: WHITE });
    p.cyl({ r: 0.045, h: 0.02, seg: 6, base: [x, 0.17, z], rot: [0, a, 0], color: role });
  }
  p.sphere({ r: 0.042, detail: 0, at: [-0.11, 0.238, 0.335], color: role, glow: CALM });
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
  p.sphere({ r: 0.042, detail: 0, at: [0.11, 0.238, 0.335], color: role, glow: CALM });
  return p;
}

/**
 * Raketenrohr mit dunkler Mündung; liegt entlang +Z, Mündung bei z.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function tube(p, x, y, z) {
  p.cyl({ r: 0.082, h: 0.05, seg: 8, base: [x, y, z - 0.03], rot: [HALF, 0, 0], color: DARK_LIGHT });
  p.cyl({ r: 0.062, h: 0.02, seg: 8, base: [x, y, z + 0.004], rot: [HALF, 0, 0], color: DARK });
}

/**
 * Leuchtende Raketenspitze, die aus einem Rohr schaut.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function tip(p, x, y, z) {
  p.cone({ r: 0.052, h: 0.1, seg: 6, base: [x, y, z], rot: [HALF, 0, 0], color: ORANGE, colorTop: ORANGE_LIGHT, glow: true });
}

/**
 * Kühlsäule des Plasmabrenners: dunkle Ringe auf einem Kern. Die Glutringe dazu stecken in einem eigenen Teil.
 * @param {PartBuilder} p
 * @param {PartBuilder} heat
 * @param {number} x
 * @param {number} z
 * @param {number} y0
 * @param {number} rings
 */
function coolStack(p, heat, x, z, y0, rings) {
  p.cyl({ r: 0.055, h: rings * 0.095 + 0.05, seg: 6, base: [x, y0, z], color: DARK_LIGHT });
  for (let i = 0; i < rings; i++) {
    const y = y0 + 0.07 + i * 0.095;
    p.torus({ r: 0.095, tube: 0.036, seg: 8, tubeSeg: 3, at: [x, y, z], color: HEAT_RING });
    heat.torus({ r: 0.095, tube: 0.025, seg: 8, tubeSeg: 3, at: [x, y, z], color: PLASMA, glow: 1.15 });
  }
  p.cyl({ r: 0.075, rTop: 0.05, h: 0.04, seg: 6, base: [x, y0 + rings * 0.095 + 0.05, z], color: RED, glow: LIT });
}

/**
 * Emitter des Plasmabrenners: drei Zinken um einen Leuchtkern. Legt die Teile `name`, `name + 'Core'` und `name + 'Jet'` an.
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {number} x
 * @param {number} y
 * @param {number} z Beginn der Zinken
 * @param {number} s Größe
 * @param {number} minLevel
 * @param {number} maxLevel
 */
function emitter(m, name, x, y, z, s, minLevel, maxLevel) {
  const e = m.part(name, { parent: 'head', pivot: [x, y, z], minLevel, maxLevel });
  e.cyl({ r: 0.12 * s, rTop: 0.1 * s, h: 0.06, seg: 6, base: [x, y, z - 0.03], rot: [HALF, 0, 0], color: DARK_LIGHT });
  for (let i = 0; i < 3; i++) {
    const a = HALF + (i * TAU) / 3;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    rod(e, [x + c * 0.1 * s, y + sn * 0.1 * s, z], [x + c * 0.075 * s, y + sn * 0.075 * s, z + 0.2 * s], 0.034 * s, WHITE, { seg: 4, rTop: 0.024 * s });
    e.sphere({ r: 0.03 * s, detail: 0, at: [x + c * 0.072 * s, y + sn * 0.072 * s, z + 0.2 * s], color: RED });
  }
  const core = m.part(name + 'Core', { parent: name, pivot: [x, y, z + 0.09 * s], minLevel, maxLevel });
  core.sphere({ r: 0.06 * s, detail: 0, at: [x, y, z + 0.09 * s], color: PLASMA, colorTop: PLASMA_LIGHT, glow: true });
  const jet = m.part(name + 'Jet', { parent: name, pivot: [x, y, z + 0.14 * s], minLevel, maxLevel });
  jet.cone({ r: 0.055 * s, h: 0.16, seg: 6, base: [x, y, z + 0.14 * s], rot: [HALF, 0, 0], color: PLASMA, colorTop: PLASMA_LIGHT, glow: true });
}

/**
 * Kleine Relaisdrohne mit Leuchtpunkt.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function drone(p, x, y, z) {
  p.sphere({ r: 0.07, detail: 0, at: [x, y, z], scale: [1, 0.65, 1], color: WHITE_SHADE, colorTop: WHITE });
  p.torus({ r: 0.095, tube: 0.02, seg: 8, tubeSeg: 4, at: [x, y, z], color: DARK_LIGHT });
  p.sphere({ r: 0.036, detail: 0, at: [x, y + 0.04, z], color: GOLD_LIGHT, glow: true });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Laserturm. Kugelkopf auf schlankem Hals, Linsenrohr nach vorn, zwei blaue Kühlfinnen.
  'tower.zukunft.schuetze': () => {
    const m = createModel('tower.zukunft.schuetze');
    const base = plinth(m, BLUE);
    base.cyl({ r: 0.22, rTop: 0.14, h: 0.1, seg: 6, base: [0, TOP, 0], rot: [0, HEX, 0], color: WHITE_SHADE, colorTop: WHITE });
    m.part('neck1', { maxLevel: 1 }).cyl({ r: 0.085, rTop: 0.075, h: 0.4, seg: 6, base: [0, TOP + 0.09, 0], color: DARK_LIGHT });
    const NY = TOP + 0.48;
    const HY = NY + 0.2;

    const turret = m.part('turret', { pivot: [0, NY, 0] });
    turret.cyl({ r: 0.13, rTop: 0.16, h: 0.07, seg: 8, base: [0, NY - 0.01, 0], color: WHITE_SHADE });
    const head = m.part('head', { pivot: [0, HY, 0], parent: 'turret' });
    head.sphere({ r: 0.2, detail: 1, at: [0, HY, 0], color: WHITE_SHADE, colorTop: WHITE });
    head.dome({ r: 0.125, seg: 8, rings: 2, at: [0, HY + 0.158, -0.01], scale: [1, 0.35, 1], color: BLUE, glow: LIT });
    // Linsenrohr
    head.cyl({ r: 0.095, rTop: 0.085, h: 0.22, seg: 8, base: [0, HY, 0.13], rot: [HALF, 0, 0], color: DARK_LIGHT });
    head.torus({ r: 0.088, tube: 0.024, seg: 8, tubeSeg: 4, at: [0, HY, 0.35], rot: [HALF, 0, 0], color: WHITE });
    // Kühlfinnen
    head.box({ size: [0.035, 0.22, 0.24], at: [0.2, HY + 0.04, -0.07], rot: [-0.35, 0, -0.3], color: BLUE, mirror: true });
    const lens = m.part('lens', { parent: 'head', pivot: [0, HY, 0.352], maxLevel: 2 });
    lens.cyl({ r: 0.07, h: 0.02, seg: 8, at: [0, HY, 0.352], rot: [HALF, 0, 0], color: BLUE_LIGHT, glow: true });

    // Stufe 2: höherer Hals mit Leuchtring, zweiter Linsenring
    tier2(m, BLUE);
    const neck2 = m.part('neck2', { minLevel: 2 });
    neck2.cyl({ r: 0.085, rTop: 0.075, h: 0.56, seg: 6, base: [0, TOP + 0.09, 0], color: DARK_LIGHT });
    neck2.torus({ r: 0.1, tube: 0.028, seg: 8, tubeSeg: 4, at: [0, TOP + 0.4, 0], color: BLUE, glow: CALM });
    const ring2 = m.part('ring2', { parent: 'head', pivot: [0, HY, 0.24], minLevel: 2 });
    ring2.torus({ r: 0.105, tube: 0.024, seg: 8, tubeSeg: 4, at: [0, HY, 0.24], rot: [HALF, 0, 0], color: BLUE, glow: CALM });

    // Stufe 3: drehendes Dreifachobjektiv und ein kleiner Ring, der den Kopf umkreist
    tier3(m, BLUE);
    const cluster = m.part('cluster', { parent: 'head', pivot: [0, HY, 0.35], minLevel: 3 });
    cluster.cyl({ r: 0.1, h: 0.03, seg: 8, base: [0, HY, 0.35], rot: [HALF, 0, 0], color: DARK });
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const x = Math.sin(a) * 0.055;
      const y = HY + Math.cos(a) * 0.055;
      cluster.cyl({ r: 0.042, h: 0.09, seg: 6, base: [x, y, 0.37], rot: [HALF, 0, 0], color: WHITE });
      cluster.cyl({ r: 0.03, h: 0.02, seg: 6, base: [x, y, 0.452], rot: [HALF, 0, 0], color: BLUE_LIGHT, glow: true });
    }
    const orbit = m.part('orbit', { parent: 'turret', pivot: [0, HY, 0], minLevel: 3 });
    orbit.torus({ r: 0.3, tube: 0.015, seg: 12, tubeSeg: 4, at: [0, HY, 0], color: BLUE, glow: CALM });
    orbit.sphere({ r: 0.045, detail: 0, at: [0.3, HY, 0], color: BLUE_LIGHT, glow: true });

    m.point('muzzle', [0, HY, 0.46], 'head');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'turret', 'head', 0.6);
        pose.turret.position.y = ctx.level >= 2 ? 0.16 : 0;
        // Ohne Ziel sucht der Kopf ruhig den Himmel ab.
        pose.head.rotation.x += Math.sin((ctx.t * 0.35 + ctx.seed) * TAU) * 0.07 * (1 - ctx.active);
        A.recoil(pose, ctx, 'head', 0.035);
        // Die Linse wird vor dem Schuss heller (größer) und blitzt beim Schuss auf.
        const c = smooth(ctx.charge);
        const s = 0.6 + 0.4 * c + ctx.fire * 0.45;
        pose.lens.scale.set(s, s, 1);
        pose.cluster.rotation.z = ctx.t * 1.4 + ctx.fire * 0.8;
        pose.cluster.scale.set(1 + ctx.fire * 0.12, 1 + ctx.fire * 0.12, 1);
        pose.orbit.rotation.z = 0.42;
        pose.orbit.rotation.y = ctx.t * 1.1 + ctx.seed * TAU;
      },
    });
  },

  // Werfer: Raketenwerfer. Gabel mit kippbarem Rohrbündel, kleine drehende Radarschüssel.
  'tower.zukunft.werfer': () => {
    const m = createModel('tower.zukunft.werfer');
    plinth(m, ORANGE);
    const PY = 0.64;

    const yoke = m.part('yoke', { pivot: [0, TOP, 0] });
    yoke.cyl({ r: 0.33, rTop: 0.3, h: 0.06, seg: 8, base: [0, TOP, 0], color: DARK_LIGHT });
    yoke.box({ size: [0.07, 0.44, 0.2], base: [0.265, TOP + 0.05, -0.02], color: WHITE_SHADE, colorTop: WHITE, mirror: true });
    yoke.cyl({ r: 0.065, h: 0.03, seg: 8, at: [0.31, PY, -0.02], rot: [0, 0, HALF], color: ORANGE, mirror: true });

    const pod = m.part('pod', { pivot: [0, PY, -0.02], parent: 'yoke' });
    pod.box({ size: [0.44, 0.3, 0.5], at: [0, PY, 0.02], color: WHITE_SHADE, colorTop: WHITE });
    pod.box({ size: [0.4, 0.26, 0.03], at: [0, PY, -0.24], color: DARK });
    pod.box({ size: [0.16, 0.014, 0.46], at: [0, PY + 0.155, 0.02], color: ORANGE, glow: LIT });
    for (const y of [PY - 0.07, PY + 0.07]) {
      tube(pod, 0.105, y, 0.29);
      tube(pod, -0.105, y, 0.29);
    }
    const tips = m.part('tips', { pivot: [0, PY, 0.26], parent: 'pod' });
    for (const y of [PY - 0.07, PY + 0.07]) {
      tip(tips, 0.105, y, 0.27);
      tip(tips, -0.105, y, 0.27);
    }

    const radar = m.part('radar', { pivot: [-0.265, TOP + 0.49, -0.07], parent: 'yoke' });
    radar.cyl({ r: 0.025, h: 0.1, seg: 5, base: [-0.265, TOP + 0.49, -0.07], color: DARK_LIGHT });
    radar.cyl({ r: 0.03, rTop: 0.1, h: 0.05, seg: 8, base: [-0.265, TOP + 0.6, -0.07], rot: [0.9, 0, 0], color: WHITE });
    radar.sphere({ r: 0.028, detail: 0, at: [-0.265, TOP + 0.66, -0.01], color: ORANGE_LIGHT, glow: true });

    // Stufe 2: dritte Rohrreihe
    tier2(m, ORANGE);
    const row2 = m.part('row2', { pivot: [0, PY, -0.02], parent: 'pod', minLevel: 2 });
    row2.box({ size: [0.44, 0.15, 0.5], at: [0, PY + 0.225, 0.02], color: WHITE_SHADE, colorTop: WHITE });
    row2.box({ size: [0.4, 0.11, 0.03], at: [0, PY + 0.22, -0.24], color: DARK });
    row2.box({ size: [0.16, 0.014, 0.46], at: [0, PY + 0.305, 0.02], color: ORANGE, glow: LIT });
    tube(row2, 0.105, PY + 0.215, 0.29);
    tube(row2, -0.105, PY + 0.215, 0.29);
    const tips2 = m.part('tips2', { pivot: [0, PY, 0.26], parent: 'pod', minLevel: 2 });
    tip(tips2, 0.105, PY + 0.215, 0.27);
    tip(tips2, -0.105, PY + 0.215, 0.27);

    // Stufe 3: Zwillingsbehälter außen an der Gabel
    tier3(m, ORANGE);
    const pods3 = m.part('pods3', { pivot: [0, PY, -0.02], parent: 'pod', minLevel: 3 });
    pods3.box({ size: [0.17, 0.3, 0.4], at: [0.415, PY, 0.02], color: WHITE_SHADE, colorTop: WHITE, mirror: true });
    pods3.box({ size: [0.08, 0.014, 0.36], at: [0.415, PY + 0.155, 0.02], color: ORANGE, glow: LIT, mirror: true });
    const tips3 = m.part('tips3', { pivot: [0, PY, 0.2], parent: 'pod', minLevel: 3 });
    for (const y of [PY - 0.07, PY + 0.07]) {
      for (const x of [0.415, -0.415]) {
        pods3.cyl({ r: 0.07, h: 0.05, seg: 8, base: [x, y, 0.19], rot: [HALF, 0, 0], color: DARK_LIGHT });
        pods3.cyl({ r: 0.052, h: 0.02, seg: 8, base: [x, y, 0.224], rot: [HALF, 0, 0], color: DARK });
        tips3.cone({ r: 0.044, h: 0.09, seg: 6, base: [x, y, 0.2], rot: [HALF, 0, 0], color: ORANGE, colorTop: ORANGE_LIGHT, glow: true });
      }
    }

    m.point('muzzle', [0, PY, 0.36], 'pod');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yoke');
        const f = ctx.fire;
        pose.yoke.position.y = f * f * 0.035;
        const pitch = Math.max(-0.25, Math.min(0.5, ctx.aimPitch));
        pose.pod.rotation.x = -(0.42 + pitch) + f * 0.12;
        pose.pod.position.z = -f * f * 0.05;
        // Die Raketen schieben sich beim Nachladen wieder aus den Rohren.
        const out = smooth(ctx.charge * 1.6 - 0.2);
        const z = -(1 - out) * 0.1;
        pose.tips.position.z = z;
        pose.tips2.position.z = z;
        pose.tips3.position.z = -(1 - smooth(ctx.charge * 1.6 - 0.5)) * 0.1;
        A.spin(pose, 'radar', ctx.t * 1.6 + ctx.seed * TAU);
      },
    });
  },

  // Bremser: Klebeschaum-Werfer. Runder Drucktank mit türkisem Band, oben eine kurze, weite Düse.
  'tower.zukunft.bremser': () => {
    const m = createModel('tower.zukunft.bremser');
    const base = plinth(m, TEAL);
    const CY = TOP + 0.3;
    const TT = CY + 0.245;
    base.cyl({ r: 0.26, rTop: 0.2, h: 0.09, seg: 8, base: [0, TOP, 0], color: DARK_LIGHT });
    base.sphere({ r: 0.275, detail: 1, at: [0, CY, 0], scale: [1, 0.93, 1], color: WHITE_SHADE, colorTop: WHITE });
    base.cyl({ r: 0.272, h: 0.055, seg: 10, at: [0, CY, 0], color: TEAL });
    // Schlauchbögen
    base.torus({ r: 0.115, tube: 0.034, seg: 6, tubeSeg: 4, arc: Math.PI, at: [0.27, TOP + 0.02, 0.14], rot: [-HALF, 0.5, 0], color: DARK_LIGHT, mirror: true });
    // Anzeige vorn
    base.cyl({ r: 0.085, h: 0.03, seg: 8, at: [0, CY + 0.13, 0.235], rot: [HALF - 0.5, 0, 0], color: DARK });
    const gauge = m.part('gauge', { pivot: [0, CY + 0.135, 0.245] });
    gauge.cyl({ r: 0.06, h: 0.02, seg: 8, at: [0, CY + 0.135, 0.245], rot: [HALF - 0.5, 0, 0], color: TEAL_LIGHT, glow: true });

    const turret = m.part('turret', { pivot: [0, TT, 0] });
    turret.cyl({ r: 0.15, rTop: 0.13, h: 0.06, seg: 8, base: [0, TT - 0.01, 0], color: TEAL, glow: LIT });
    const tilt = m.part('tilt', { pivot: [0, TT + 0.07, 0], parent: 'turret' });
    tilt.sphere({ r: 0.1, detail: 1, at: [0, TT + 0.07, 0], color: WHITE });
    const nozzle = m.part('nozzle', { pivot: [0, TT + 0.07, 0], parent: 'tilt', maxLevel: 2 });
    nozzle.cyl({ r: 0.07, rTop: 0.115, h: 0.25, seg: 8, base: [0, TT + 0.1, 0], color: DARK_LIGHT });
    nozzle.torus({ r: 0.115, tube: 0.026, seg: 8, tubeSeg: 4, at: [0, TT + 0.35, 0], color: TEAL, glow: CALM });
    const glob = m.part('glob', { pivot: [0, TT + 0.36, 0], parent: 'tilt' });
    glob.sphere({ r: 0.095, detail: 1, at: [0, TT + 0.36, 0], color: TEAL_LIGHT, colorTop: FOAM, glow: 0.8 });

    // Stufe 2: Zwillingstanks an den Seiten
    tier2(m, TEAL);
    const tanks2 = m.part('tanks2', { minLevel: 2 });
    tanks2.sphere({ r: 0.165, detail: 1, at: [0.28, TOP + 0.16, -0.14], color: WHITE_SHADE, colorTop: WHITE, mirror: true });
    tanks2.cyl({ r: 0.09, rTop: 0.065, h: 0.045, seg: 6, base: [0.28, TOP + 0.305, -0.14], color: TEAL, glow: LIT, mirror: true });
    tanks2.cyl({ r: 0.167, h: 0.035, seg: 8, at: [0.28, TOP + 0.16, -0.14], color: TEAL, mirror: true });

    // Stufe 3: drehende Dreifachdüse
    tier3(m, TEAL);
    const tri = m.part('tri3', { pivot: [0, TT + 0.07, 0], parent: 'tilt', minLevel: 3 });
    tri.cyl({ r: 0.12, h: 0.05, seg: 8, base: [0, TT + 0.13, 0], color: TEAL });
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const x = Math.sin(a) * 0.08;
      const z = Math.cos(a) * 0.08;
      tri.cyl({ r: 0.05, rTop: 0.07, h: 0.25, seg: 6, base: [x, TT + 0.1, z], color: DARK_LIGHT });
      tri.torus({ r: 0.07, tube: 0.022, seg: 6, tubeSeg: 4, at: [x, TT + 0.35, z], color: TEAL, glow: CALM });
    }

    m.point('muzzle', [0, TT + 0.4, 0], 'tilt');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'turret');
        const f = ctx.fire;
        // Die Düse zeigt schräg nach vorn oben und ruckt beim Schuss zurück.
        pose.tilt.rotation.x = 0.85 - f * 0.3 + Math.sin((ctx.t * 0.3 + ctx.seed) * TAU) * 0.04;
        pose.tilt.position.y = -f * f * 0.03;
        // Der Schaumklumpen quillt beim Laden aus der Düse.
        const c = smooth(ctx.charge * 1.3 - 0.15);
        const wob = 1 + Math.sin(ctx.t * 5 + ctx.seed * 9) * 0.05 * c;
        pose.glob.scale.set(Math.max(1e-3, c * wob), Math.max(1e-3, c / wob), Math.max(1e-3, c * wob));
        pose.gauge.scale.setScalar(0.55 + 0.45 * c + f * 0.3);
        pose.tri3.rotation.y = ctx.t * 0.8 + c * 2.1;
      },
    });
  },

  // Panzerknacker: Schienenkanone. Zwei lange Schienen mit violettem Leuchten dazwischen, hinten Kondensatoren.
  'tower.zukunft.knacker': () => {
    const m = createModel('tower.zukunft.knacker');
    plinth(m, VIOLET);
    const GY = 0.84;

    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    yaw.cyl({ r: 0.22, rTop: 0.2, h: 0.06, seg: 8, base: [0, TOP, 0], color: DARK_LIGHT });
    yaw.cyl({ r: 0.1, rTop: 0.075, h: 0.46, seg: 6, base: [0, TOP + 0.05, 0], color: WHITE_SHADE, colorTop: WHITE });
    yaw.box({ size: [0.05, 0.16, 0.14], at: [0.155, GY - 0.03, 0], color: WHITE_SHADE, mirror: true });
    yaw.box({ size: [0.36, 0.05, 0.14], at: [0, GY - 0.105, 0], color: WHITE_SHADE });

    const gun = m.part('gun', { pivot: [0, GY, 0], parent: 'yaw' });
    gun.box({ size: [0.26, 0.13, 0.46], at: [0, GY, -0.16], color: WHITE_SHADE, colorTop: WHITE });
    gun.box({ size: [0.27, 0.04, 0.44], at: [0, GY - 0.03, -0.16], color: VIOLET });
    gun.box({ size: [0.22, 0.11, 0.05], at: [0, GY, 0.085], color: DARK_LIGHT });
    // Kondensatoren: zwei Paare, ihre Leuchtkappen gehen beim Laden nacheinander an.
    /** @type {[string, number, number][]} */
    const pairs = [['cap1', -0.31, 1], ['cap2', -0.19, 1], ['cap3', -0.07, 2]];
    for (const [name, z, minLevel] of pairs) {
      const body = minLevel > 1 ? m.part('caps2', { pivot: [0, GY, 0], parent: 'gun', minLevel }) : gun;
      body.cyl({ r: 0.058, h: 0.1, seg: 8, base: [0.07, GY + 0.06, z], color: DARK, mirror: true });
      const cap = m.part(name, { pivot: [0, GY + 0.165, z], parent: 'gun', minLevel });
      cap.cyl({ r: 0.046, h: 0.03, seg: 8, base: [0.07, GY + 0.155, z], color: VIOLET_LIGHT, glow: true, mirror: true });
    }

    const rails = m.part('rails', { pivot: [0, GY, 0.06], parent: 'gun' });
    rails.box({ size: [0.06, 0.1, 0.44], at: [0.08, GY, 0.29], color: DARK, mirror: true });
    rails.box({ size: [0.07, 0.11, 0.04], at: [0.08, GY, 0.525], color: WHITE, mirror: true });
    rails.box({ size: [0.23, 0.03, 0.05], at: [0, GY - 0.055, 0.22], color: WHITE_SHADE });
    rails.box({ size: [0.23, 0.03, 0.05], at: [0, GY - 0.055, 0.42], color: WHITE_SHADE });
    const beam = m.part('beam', { pivot: [0, GY, 0.08], parent: 'rails' });
    beam.box({ size: [0.09, 0.04, 0.43], at: [0, GY + 0.005, 0.295], color: VIOLET, colorTop: VIOLET_LIGHT, glow: true });

    // Stufe 2: drittes Kondensatorpaar (oben angelegt)
    tier2(m, VIOLET);

    // Stufe 3: längere Schienen (in animate gestreckt), Mündungsklammer und Stützbeine
    tier3(m, VIOLET);
    const rails3 = m.part('rails3', { pivot: [0, GY, 0.06], parent: 'rails', minLevel: 3 });
    rails3.box({ size: [0.085, 0.13, 0.05], at: [0.08, GY, 0.47], color: VIOLET, glow: LIT, mirror: true });
    rails3.box({ size: [0.25, 0.035, 0.05], at: [0, GY - 0.075, 0.47], color: WHITE });
    const legs = m.part('legs3', { minLevel: 3 });
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i * TAU) / 3;
      const sx = Math.sin(a);
      const cz = Math.cos(a);
      rod(legs, [sx * 0.2, TOP + 0.12, cz * 0.2], [sx * 0.49, 0.06, cz * 0.49], 0.04, WHITE_SHADE, { seg: 5 });
      legs.cyl({ r: 0.065, h: 0.05, seg: 6, base: [sx * 0.49, 0, cz * 0.49], color: DARK_LIGHT });
      legs.sphere({ r: 0.05, detail: 0, at: [sx * 0.2, TOP + 0.12, cz * 0.2], color: VIOLET });
    }

    m.point('muzzle', [0, GY, 0.55], 'rails');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw', 'gun', 0.5);
        const f = ctx.fire;
        A.recoil(pose, ctx, 'rails', 0.08);
        if (ctx.level >= 3) pose.rails.scale.z = 1.16;
        pose.gun.position.z = -f * f * 0.03;
        // Aufladen: die Kondensatoren leuchten nacheinander auf, das Leuchten wächst zwischen den Schienen nach vorn.
        const c = ctx.charge;
        const n = ctx.level >= 2 ? 3 : 2;
        pose.cap1.scale.setScalar(0.3 + 0.7 * Math.max(f, smooth(c * n * 1.25)));
        pose.cap2.scale.setScalar(0.3 + 0.7 * Math.max(f, smooth(c * n * 1.25 - 1)));
        pose.cap3.scale.setScalar(0.3 + 0.7 * Math.max(f, smooth(c * n * 1.25 - 2)));
        const b = Math.max(smooth(c * 1.2 - 0.1), Math.min(1, f * 1.5));
        const w = 0.55 + 0.45 * b + f * 0.5 + Math.sin(ctx.t * 6 + ctx.seed * 7) * 0.05 * b;
        pose.beam.scale.set(w, w, Math.max(0.06, b));
      },
    });
  },

  // Brenner: Plasmabrenner. Niedriger Kopf mit drei Zinken um einen Leuchtkern, dahinter Kühlringe.
  'tower.zukunft.brenner': () => {
    const m = createModel('tower.zukunft.brenner');
    plinth(m, RED);
    const EY = 0.5;
    const DY = TOP + 0.05;

    const head = m.part('head', { pivot: [0, TOP, 0] });
    head.cyl({ r: 0.3, rTop: 0.27, h: 0.06, seg: 8, base: [0, TOP, 0], color: DARK_LIGHT });
    head.box({ size: [0.2, 0.2, 0.2], base: [0, DY, 0.02], color: WHITE_SHADE });
    head.cyl({ r: 0.15, rTop: 0.13, h: 0.3, seg: 8, base: [0, EY, -0.1], rot: [HALF, 0, 0], color: WHITE_SHADE, colorTop: WHITE });
    head.box({ size: [0.11, 0.03, 0.26], at: [0, EY + 0.14, 0.04], color: RED, glow: LIT });

    emitter(m, 'emit', 0, EY, 0.2, 1.25, 1, 2);
    const stack1 = m.part('stack1', { parent: 'head', pivot: [0, TOP, 0], maxLevel: 1 });
    const heat1 = m.part('heat1', { parent: 'head', pivot: [0, DY, -0.22], maxLevel: 1 });
    coolStack(stack1, heat1, 0, -0.22, DY, 3);

    // Stufe 2: zwei höhere Kühlsäulen
    tier2(m, RED);
    const stack2 = m.part('stack2', { parent: 'head', pivot: [0, TOP, 0], minLevel: 2 });
    const heat2L = m.part('heat2L', { parent: 'head', pivot: [-0.13, DY, -0.2], minLevel: 2 });
    const heat2R = m.part('heat2R', { parent: 'head', pivot: [0.13, DY, -0.2], minLevel: 2 });
    coolStack(stack2, heat2L, -0.13, -0.2, DY, 4);
    coolStack(stack2, heat2R, 0.13, -0.2, DY, 4);

    // Stufe 3: Doppelemitter
    tier3(m, RED);
    const wide = m.part('wide3', { parent: 'head', pivot: [0, TOP, 0], minLevel: 3 });
    wide.box({ size: [0.46, 0.2, 0.1], at: [0, EY, 0.14], color: WHITE_SHADE, colorTop: WHITE });
    wide.box({ size: [0.4, 0.02, 0.06], at: [0, EY + 0.105, 0.14], color: RED, glow: LIT });
    emitter(m, 'emitL', -0.135, EY, 0.2, 0.85, 3, 3);
    emitter(m, 'emitR', 0.135, EY, 0.2, 0.85, 3, 3);

    m.point('muzzle', [0, EY, 0.42], 'head');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'head');
        const f = ctx.fire;
        pose.head.position.z = -f * f * 0.025;
        // Die Kühlringe glühen, solange gefeuert wird: die Glutringe wachsen aus den dunklen Ringen heraus.
        const heat = 0.97 + 0.24 * Math.min(1, 0.3 * ctx.active + f);
        pose.heat1.scale.set(heat, 1, heat);
        pose.heat2L.scale.set(heat, 1, heat);
        pose.heat2R.scale.set(heat, 1, heat);
        // Zündflamme: der Kern pulsiert immer leicht.
        const core = 0.85 + Math.sin((ctx.t * 1.3 + ctx.seed) * TAU) * 0.1 + f * 0.5;
        const jz = Math.max(1e-3, f * (0.85 + Math.sin(ctx.t * 23) * 0.15));
        const jw = Math.max(1e-3, f > 0.02 ? 0.6 + 0.6 * f : 0);
        pose.emitCore.scale.setScalar(core);
        pose.emitJet.scale.set(jw, jw, jz);
        pose.emitLCore.scale.setScalar(core);
        pose.emitLJet.scale.set(jw, jw, jz);
        pose.emitRCore.scale.setScalar(core);
        pose.emitRJet.scale.set(jw, jw, jz);
      },
    });
  },

  // Taktgeber: Leitrechner. Schlanke Rechnersäule mit goldenen Leuchtfugen, darüber schwebende Holoringe und eine Relaisdrohne.
  'tower.zukunft.taktgeber': () => {
    const m = createModel('tower.zukunft.taktgeber');
    const base = plinth(m, GOLD);
    const PT = TOP + 1.0;
    const RY = PT + 0.36;
    base.cyl({ r: 0.22, rTop: 0.16, h: 0.08, seg: 6, base: [0, TOP, 0], rot: [0, HEX, 0], color: DARK_LIGHT });
    base.cyl({ r: 0.135, rTop: 0.12, h: 0.92, seg: 6, base: [0, TOP + 0.08, 0], rot: [0, HEX, 0], color: WHITE_SHADE, colorTop: WHITE });
    for (const y of [0.52, 0.76, 1.0]) base.cyl({ r: 0.137, h: 0.045, seg: 6, at: [0, y, 0], rot: [0, HEX, 0], color: DARK });
    // Goldene Leuchtfugen auf drei Seiten
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      base.box({ size: [0.04, 0.84, 0.02], at: [Math.sin(a) * 0.116, TOP + 0.54, Math.cos(a) * 0.118], rot: [0, a, 0], color: GOLD, colorTop: GOLD_LIGHT, glow: CALM });
    }
    const cap = m.part('cap', { pivot: [0, PT, 0] });
    cap.cyl({ r: 0.16, rTop: 0.13, h: 0.05, seg: 6, base: [0, PT, 0], rot: [0, HEX, 0], color: GOLD, glow: LIT });
    cap.cone({ r: 0.07, h: 0.09, seg: 6, base: [0, PT + 0.05, 0], color: DARK_LIGHT });

    const core = m.part('core', { pivot: [0, RY, 0] });
    core.sphere({ r: 0.1, detail: 0, at: [0, RY, 0], scale: [0.8, 1.25, 0.8], color: GOLD, colorTop: GOLD_LIGHT, glow: true });
    const ringA = m.part('ringA', { pivot: [0, RY, 0] });
    ringA.torus({ r: 0.25, tube: 0.024, seg: 12, tubeSeg: 4, at: [0, RY, 0], color: GOLD, glow: CALM });
    ringA.sphere({ r: 0.045, detail: 0, at: [0.25, RY, 0], color: GOLD_LIGHT, glow: true });
    ringA.sphere({ r: 0.045, detail: 0, at: [-0.25, RY, 0], color: GOLD_LIGHT, glow: true });

    const orbit = m.part('orbit', { pivot: [0, 1.0, 0] });
    drone(orbit, 0.38, 1.0, 0);

    // Stufe 2: höhere Säule, gegenläufiger zweiter Ring
    tier2(m, GOLD);
    const ext2 = m.part('ext2', { minLevel: 2 });
    ext2.cyl({ r: 0.12, rTop: 0.115, h: 0.17, seg: 6, base: [0, PT - 0.005, 0], rot: [0, HEX, 0], color: WHITE });
    ext2.cyl({ r: 0.125, h: 0.04, seg: 6, at: [0, PT + 0.08, 0], rot: [0, HEX, 0], color: GOLD, glow: CALM });
    const ringB = m.part('ringB', { pivot: [0, RY, 0], minLevel: 2 });
    ringB.torus({ r: 0.175, tube: 0.022, seg: 10, tubeSeg: 4, at: [0, RY, 0], color: GOLD_LIGHT, glow: CALM });

    // Stufe 3: dritter Ring (Kreisel) und zweite Drohne
    tier3(m, GOLD);
    const ringC = m.part('ringC', { pivot: [0, RY, 0], minLevel: 3 });
    ringC.torus({ r: 0.32, tube: 0.022, seg: 14, tubeSeg: 4, at: [0, RY, 0], color: GOLD, glow: CALM });
    const orbit3 = m.part('orbit3', { pivot: [0, 1.25, 0], minLevel: 3 });
    drone(orbit3, -0.38, 1.25, 0);

    return m.build({
      animate(pose, ctx) {
        // 126 Schläge pro Minute wie die Musik des Zeitalters.
        const beat = ctx.t * 2.1 + ctx.seed;
        const pb = beat - Math.floor(beat);
        const hit = (1 - pb) * (1 - pb) * (1 - pb);
        const lift = ctx.level >= 2 ? 0.16 : 0;
        const t = ctx.t + ctx.seed * 10;
        const y = lift + Math.sin(t * 1.3) * 0.02;
        pose.cap.position.y = lift;
        pose.core.position.y = y;
        pose.core.rotation.y = t * 0.9;
        pose.core.scale.setScalar(1 + hit * 0.22 + ctx.fire * 0.1);
        pose.ringA.position.y = y;
        pose.ringB.position.y = y;
        pose.ringC.position.y = y;
        const s = 1 + hit * 0.06;
        pose.ringA.scale.setScalar(s);
        if (ctx.level >= 3) {
          // Kreisel: drei Ringe um drei Achsen.
          pose.ringC.rotation.z = 0.25;
          pose.ringC.rotation.y = t * 0.7;
          pose.ringA.rotation.x = t * 1.1;
          pose.ringB.rotation.z = HALF + t * 1.5;
          pose.ringB.rotation.y = t * 0.4;
        } else {
          pose.ringA.rotation.z = 0.32;
          pose.ringA.rotation.y = t * 1.0;
          pose.ringB.rotation.z = -0.6;
          pose.ringB.rotation.y = -t * 1.5;
        }
        pose.orbit.rotation.y = t * 0.8;
        pose.orbit.position.y = Math.sin(t * 2.1) * 0.03;
        pose.orbit3.rotation.y = t * 0.8;
        pose.orbit3.position.y = lift * 0.5 + Math.sin(t * 2.1 + 2) * 0.03;
      },
    });
  },
};
