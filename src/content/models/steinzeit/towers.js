// @ts-check
// Türme der Steinzeit: Steinschleuderer, Felswerfer, Harzschleuder, Speerschleuder, Glutbläser, Trommler.
// Alle stehen auf demselben Feldsteinsockel mit einem Band in der Rollenfarbe.

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;

// --- Materialfarben des Zeitalters ---
const ROCK = '#8f8b84';
const ROCK_DARK = '#76726c';
const ROCK_LIGHT = '#aaa59b';
const WOOD = '#8a5a35';
const WOOD_LIGHT = '#b07a4c';
const WOOD_DARK = '#6b4429';
const SKIN = '#e3b48d';
const FUR = '#7c4b2a';
const FUR_LIGHT = '#a36a3e';
const HAIR = '#3a281c';
const BONE = '#efe6d2';
const DARK = '#2a1e16';
const HIDE = '#c9a77a';
const HIDE_DARK = '#a8855a';
const LEAF = '#6f9a52';
const LEAF_LIGHT = '#a5c66e';
const AMBER = '#d98a1e';
const AMBER_LIGHT = '#ffcf5e';
const ROPE = '#d8c394';

// --- Rollenfarben ---
const BLUE = '#3d7dd8';
const ORANGE = '#e8842a';
const TEAL = '#26b5a8';
const VIOLET = '#8a55d6';
const RED = '#d8432f';
const GOLD = '#f2c230';

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
 * Feldsteinsockel mit Band in der Rollenfarbe und dem ersten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function plinth(m, role) {
  const base = m.part('base');
  base.cyl({ r: 0.44, rTop: 0.415, h: 0.17, seg: 8, base: [0, -0.05, 0], color: ROCK_DARK, faceJitter: 0.08 });
  base.cyl({ r: 0.425, h: 0.06, seg: 8, base: [0, 0.115, 0], color: role, shade: 0.1 });
  base.cyl({ r: 0.405, rTop: 0.375, h: 0.065, seg: 8, base: [0, 0.17, 0], color: ROCK, colorTop: ROCK_LIGHT, faceJitter: 0.06 });
  base.sphere({ r: 0.045, detail: 0, at: [0, 0.235, 0.36], color: role });
  return base;
}

/**
 * Teil der Stufe 2: zweites Farbband, Feldsteine am Fuß, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.455, h: 0.045, seg: 8, base: [0, 0.015, 0], color: role, shade: 0.1 });
  const stones = [[0.42, 0.2, 0.09], [-0.4, 0.24, 0.08], [-0.3, -0.36, 0.085], [0.33, -0.33, 0.075]];
  for (const [x, z, r] of stones) {
    p.sphere({ r, detail: 0, at: [x, 0.03, z], scale: [1, 0.75, 1], rot: [x, z * 3, 0], color: ROCK, faceJitter: 0.1 });
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
 * Steinzeitmensch ohne Arme: Beine, Fellrumpf, großer Kopf. Füße bei (x, y, z), Blick nach +Z.
 * Schultern liegen bei y + 0.24, x ± 0.125; der Scheitel bei y + 0.45.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ band?: string, hair?: string, fur?: string }} [o]
 */
function human(p, x, y, z, o = {}) {
  p.box({ size: [0.06, 0.1, 0.07], base: [x - 0.05, y, z], color: SKIN });
  p.box({ size: [0.06, 0.1, 0.07], base: [x + 0.05, y, z], color: SKIN });
  p.box({ size: [0.2, 0.17, 0.13], base: [x, y + 0.09, z], color: o.fur ?? FUR, colorTop: FUR_LIGHT });
  p.sphere({ r: 0.095, at: [x, y + 0.35, z + 0.01], color: SKIN });
  p.dome({ r: 0.104, seg: 6, rings: 2, at: [x, y + 0.355, z - 0.012], color: o.hair ?? HAIR });
  p.box({ size: [0.022, 0.026, 0.012], at: [x + 0.035, y + 0.35, z + 0.108], color: DARK });
  p.box({ size: [0.022, 0.026, 0.012], at: [x - 0.035, y + 0.35, z + 0.108], color: DARK });
  if (o.band) {
    // Schulterband und Stirnband in der Rollenfarbe: von oben gut zu sehen.
    p.box({ size: [0.215, 0.04, 0.145], at: [x, y + 0.25, z], color: o.band });
    p.cyl({ r: 0.106, h: 0.026, seg: 6, at: [x, y + 0.396, z - 0.01], color: o.band });
  }
}

/** Umriss einer Feder, Kiel bei (0, 0). @type {[number, number][]} */
const FEATHER = [[0, 0], [0.045, 0.08], [0.035, 0.2], [0, 0.26], [-0.035, 0.2], [-0.045, 0.08]];

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Steinschleuderer auf einem Felsblock. Die Schleuder kreist vor jedem Wurf.
  'tower.steinzeit.schuetze': () => {
    const m = createModel('tower.steinzeit.schuetze');
    const Y = 0.62;
    const base = plinth(m, BLUE);
    base.sphere({ r: 0.34, detail: 0, at: [0, 0.3, 0], scale: [1, 0.56, 1], rot: [0, 0.5, 0], color: ROCK, faceJitter: 0.09 });
    base.cyl({ r: 0.21, rTop: 0.16, h: 0.2, seg: 6, base: [0, 0.42, 0], rot: [0, 0.3, 0], color: ROCK_LIGHT, faceJitter: 0.07 });
    base.cyl({ r: 0.2, h: 0.04, seg: 6, at: [0, 0.51, 0], rot: [0, 0.3, 0], color: BLUE });
    base.sphere({ r: 0.13, detail: 0, at: [-0.27, 0.27, 0.2], scale: [1, 0.8, 1], rot: [0.4, 1, 0], color: ROCK_DARK, faceJitter: 0.09 });

    const figure = m.part('figure', { pivot: [0, Y, 0] });
    human(figure, 0, Y, 0, { band: BLUE });
    figure.extrude({ points: FEATHER, depth: 0.05, base: [0.02, Y + 0.42, -0.05], rot: [-0.45, 0.5, 0], scale: 1.1, color: BLUE, colorTop: '#7fb0f0' });

    const armL = m.part('armL', { pivot: [-0.14, Y + 0.24, 0], parent: 'figure' });
    armL.box({ size: [0.05, 0.16, 0.05], at: [-0.14, Y + 0.16, 0], color: SKIN });
    const arm = m.part('arm', { pivot: [0.14, Y + 0.24, 0], parent: 'figure' });
    arm.box({ size: [0.05, 0.16, 0.05], at: [0.14, Y + 0.16, 0], color: SKIN });
    rod(arm, [0.14, Y + 0.1, 0], [0.14, Y - 0.05, 0], 0.02, HIDE_DARK, { seg: 4 });
    arm.sphere({ r: 0.06, detail: 0, at: [0.14, Y - 0.08, 0], color: '#c2bdb2' });

    // Stufe 2: Knochenkette, Munitionsbeutel
    tier2(m, BLUE);
    const gear2 = m.part('gear2', { parent: 'figure', pivot: [0, Y, 0], minLevel: 2 });
    gear2.torus({ r: 0.085, tube: 0.022, seg: 7, tubeSeg: 4, at: [0, Y + 0.275, 0.015], rot: [0.25, 0, 0], color: BONE });
    gear2.box({ size: [0.09, 0.09, 0.06], at: [-0.07, Y + 0.12, 0.085], color: HIDE, colorTop: HIDE_DARK });

    // Stufe 3: zweite Schleuder, Kriegsbemalung, Fellsegel
    const t3 = tier3(m, BLUE);
    rod(t3, [-0.33, 0.2, -0.3], [-0.33, 1.3, -0.34], 0.026, WOOD);
    rod(t3, [0.33, 0.2, -0.3], [0.33, 1.3, -0.34], 0.026, WOOD);
    t3.box({ size: [0.78, 0.03, 0.36], at: [0, 1.36, -0.2], rot: [0.32, 0, 0], color: HIDE });
    t3.box({ size: [0.12, 0.034, 0.365], at: [-0.2, 1.36, -0.2], rot: [0.32, 0, 0], color: BLUE });
    t3.box({ size: [0.12, 0.034, 0.365], at: [0.2, 1.36, -0.2], rot: [0.32, 0, 0], color: BLUE });
    const slingL = m.part('slingL', { parent: 'armL', pivot: [-0.14, Y + 0.24, 0], minLevel: 3 });
    rod(slingL, [-0.14, Y + 0.1, 0], [-0.14, Y - 0.05, 0], 0.02, HIDE_DARK, { seg: 4 });
    slingL.sphere({ r: 0.06, detail: 0, at: [-0.14, Y - 0.08, 0], color: '#c2bdb2' });
    const paint3 = m.part('paint3', { parent: 'figure', pivot: [0, Y, 0], minLevel: 3 });
    paint3.box({ size: [0.04, 0.02, 0.014], at: [0.064, Y + 0.315, 0.086], rot: [0, 0.6, 0], color: BLUE, mirror: true });
    paint3.box({ size: [0.05, 0.02, 0.014], at: [0, Y + 0.2, 0.066], color: BLUE });
    paint3.box({ size: [0.02, 0.07, 0.014], at: [0, Y + 0.17, 0.066], color: BLUE });

    m.point('muzzle', [0.14, Y + 0.5, 0.18], 'figure');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'figure');
        // Die Schleuder kreist immer schneller und schnellt beim Wurf nach vorn.
        const c = ctx.charge;
        const whirl = c * c * c * TAU * 2 * ctx.active;
        pose.arm.rotation.x = -whirl - ctx.fire * 1.3;
        pose.arm.rotation.z = 0.28 * ctx.active;
        if (ctx.level >= 3) {
          pose.armL.rotation.x = -whirl - Math.PI * ctx.active * smooth(c * 3) - ctx.fire * 1.3;
          pose.armL.rotation.z = -0.28 * ctx.active;
        }
        pose.figure.position.y = ctx.fire * 0.03;
      },
    });
  },

  // Werfer: Wippe auf einem Blockgestell. Der lange Arm mit dem Blattkorb schnellt nach oben.
  'tower.steinzeit.werfer': () => {
    const m = createModel('tower.steinzeit.werfer');
    plinth(m, ORANGE);
    const AX = 0.92;
    const LX = -0.07;

    const frame = m.part('frame', { pivot: [0, TOP, 0] });
    for (const x of [-0.21, 0.21]) {
      rod(frame, [x, 0.285, -0.37], [x, 0.285, 0.37], 0.052, WOOD, { seg: 6 });
      rod(frame, [x, 0.3, -0.2], [x * 0.9, AX + 0.06, 0], 0.042, WOOD_DARK);
      rod(frame, [x, 0.3, 0.2], [x * 0.9, AX + 0.06, 0], 0.042, WOOD_DARK);
    }
    rod(frame, [-0.32, 0.345, 0.25], [0.32, 0.345, 0.25], 0.045, WOOD_LIGHT, { seg: 6 });
    rod(frame, [-0.32, 0.345, -0.25], [0.32, 0.345, -0.25], 0.045, WOOD_LIGHT, { seg: 6 });
    rod(frame, [-0.25, AX, 0], [0.25, AX, 0], 0.034, WOOD_LIGHT);
    // Felsvorrat
    frame.sphere({ r: 0.08, detail: 0, at: [0.08, 0.43, 0.27], color: ROCK, faceJitter: 0.1 });
    frame.sphere({ r: 0.07, detail: 0, at: [0.12, 0.33, 0.36], rot: [1, 0, 0], color: ROCK_DARK, faceJitter: 0.1 });
    frame.sphere({ r: 0.065, detail: 0, at: [-0.02, 0.32, 0.37], rot: [0, 1, 0], color: ROCK_LIGHT, faceJitter: 0.1 });

    /**
     * Wipparm mit Korb und bemaltem Gegengewicht.
     * @param {PartBuilder} p
     * @param {number} x
     */
    const lever = (p, x) => {
      rod(p, [x, AX + 0.03, 0.26], [x, AX + 0.03, -0.44], 0.042, WOOD_LIGHT, { rTop: 0.03, seg: 6 });
      p.sphere({ r: 0.15, detail: 0, at: [x, AX - 0.07, 0.25], scale: [1, 0.9, 1], rot: [0.3, 0.4, 0], color: ORANGE, faceJitter: 0.06 });
      p.torus({ r: 0.1, tube: 0.02, seg: 6, tubeSeg: 4, at: [x, AX - 0.03, 0.25], rot: [0, 0, Math.PI / 2], color: ROPE });
      p.cyl({ r: 0.07, rTop: 0.125, h: 0.07, seg: 7, base: [x, AX + 0.05, -0.41], color: LEAF, colorTop: LEAF_LIGHT });
    };
    const lev = m.part('lever', { pivot: [0, AX, 0], parent: 'frame' });
    lever(lev, LX);
    m.part('load', { pivot: [LX, AX + 0.15, -0.41], parent: 'lever' }).sphere({ r: 0.1, detail: 0, at: [LX, AX + 0.15, -0.41], color: ROCK_LIGHT, faceJitter: 0.1 });

    // Stufe 2: Seilbindungen, größerer Korb
    tier2(m, ORANGE);
    const ropes2 = m.part('ropes2', { parent: 'frame', pivot: [0, TOP, 0], minLevel: 2 });
    for (const x of [-0.19, 0.19]) {
      ropes2.torus({ r: 0.055, tube: 0.024, seg: 6, tubeSeg: 4, at: [x, AX + 0.02, 0], rot: [0, 0, Math.PI / 2], color: ROPE });
      ropes2.torus({ r: 0.06, tube: 0.022, seg: 6, tubeSeg: 4, at: [x * 1.1, 0.33, 0.25], rot: [0, 0, Math.PI / 2], color: ROPE });
      ropes2.torus({ r: 0.06, tube: 0.022, seg: 6, tubeSeg: 4, at: [x * 1.1, 0.33, -0.25], rot: [0, 0, Math.PI / 2], color: ROPE });
    }
    const basket2 = m.part('basket2', { parent: 'lever', pivot: [0, AX, 0], minLevel: 2 });
    basket2.cyl({ r: 0.125, rTop: 0.15, h: 0.035, seg: 7, base: [LX, AX + 0.115, -0.41], color: LEAF_LIGHT, colorTop: '#c3dd86' });
    basket2.box({ size: [0.08, 0.05, 0.08], at: [LX, AX + 0.03, 0.02], color: ORANGE });

    // Stufe 3: zweiter Wipparm, Mammutschädel
    tier3(m, ORANGE);
    const lever3 = m.part('lever3', { parent: 'lever', pivot: [0, AX, 0], minLevel: 3 });
    lever(lever3, 0.14);
    lever3.cyl({ r: 0.125, rTop: 0.15, h: 0.035, seg: 7, base: [0.14, AX + 0.115, -0.41], color: LEAF_LIGHT, colorTop: '#c3dd86' });
    m.part('load3', { pivot: [0.14, AX + 0.15, -0.41], parent: 'lever3', minLevel: 3 }).sphere({ r: 0.1, detail: 0, at: [0.14, AX + 0.15, -0.41], rot: [1, 1, 0], color: ROCK, faceJitter: 0.1 });
    const skull3 = m.part('skull3', { parent: 'frame', pivot: [0, TOP, 0], minLevel: 3 });
    skull3.sphere({ r: 0.1, detail: 0, at: [0, 0.4, -0.33], scale: [1.1, 1, 0.9], color: BONE });
    skull3.box({ size: [0.03, 0.04, 0.02], at: [0.045, 0.42, -0.42], color: DARK, mirror: true });
    skull3.torus({ r: 0.13, tube: 0.026, seg: 6, tubeSeg: 4, arc: 2.2, at: [0.1, 0.33, -0.36], rot: [0, 2.2, -0.9], color: BONE, mirror: true });

    m.point('muzzle', [0, 1.38, -0.05], 'frame');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'frame');
        const f = ctx.fire;
        const pull = smooth(ctx.charge) * ctx.active;
        pose.lever.rotation.x = -0.5 - 0.14 * pull + f * 1.9;
        pose.frame.position.y = f * f * 0.05;
        // Der Felsbrocken liegt erst wieder im Korb, wenn der Arm unten ist.
        const s = Math.max(1e-3, smooth((ctx.charge - 0.15) * 4) * (1 - smooth(f * 3)));
        pose.load.scale.setScalar(s);
        if (ctx.level >= 3) pose.load3.scale.setScalar(s);
      },
    });
  },

  // Bremser: Harzschleuder. Hohler Baumstumpf voller Harz, eine gebogene Gerte schleudert Klumpen.
  'tower.steinzeit.bremser': () => {
    const m = createModel('tower.steinzeit.bremser');
    const base = plinth(m, TEAL);
    const BARK = '#73502f';
    base.cyl({ r: 0.29, rTop: 0.25, h: 0.4, seg: 8, base: [0, 0.2, 0], color: BARK, colorTop: '#8d6640', faceJitter: 0.08 });
    for (const a of [0.4, 1.9, 3.3, 4.9]) {
      base.sphere({ r: 0.11, detail: 0, at: [Math.sin(a) * 0.29, 0.25, Math.cos(a) * 0.29], scale: [1, 0.7, 1], rot: [0, a, 0], color: BARK, faceJitter: 0.08 });
    }
    base.torus({ r: 0.235, tube: 0.045, seg: 8, tubeSeg: 5, at: [0, 0.6, 0], color: TEAL });
    base.sphere({ r: 0.22, detail: 1, at: [0, 0.6, 0], scale: [1, 0.28, 1], color: AMBER, colorTop: AMBER_LIGHT });
    // Harztropfen an der Rinde
    base.sphere({ r: 0.05, detail: 0, at: [0.14, 0.47, 0.24], scale: [1, 1.5, 0.7], color: AMBER_LIGHT });
    base.sphere({ r: 0.04, detail: 0, at: [-0.25, 0.5, 0.1], scale: [0.7, 1.5, 1], color: AMBER_LIGHT });

    const yaw = m.part('yaw', { pivot: [0, 0.62, 0] });
    yaw.sphere({ r: 0.075, detail: 0, at: [0, 0.65, 0], scale: [1, 0.7, 1], color: WOOD_DARK });
    const arm = m.part('arm', { pivot: [0, 0.64, 0], parent: 'yaw' });
    rod(arm, [0, 0.62, 0], [0, 0.92, -0.03], 0.04, WOOD, { rTop: 0.034 });
    rod(arm, [0, 0.9, -0.025], [0, 1.14, -0.13], 0.034, WOOD, { rTop: 0.028 });
    rod(arm, [0, 1.12, -0.12], [0, 1.27, -0.29], 0.028, WOOD_LIGHT, { rTop: 0.024 });
    arm.cyl({ r: 0.05, rTop: 0.105, h: 0.07, seg: 6, base: [0, 1.26, -0.31], color: LEAF, colorTop: LEAF_LIGHT });
    arm.extrude({ points: FEATHER, depth: 0.02, base: [0.03, 0.95, -0.05], rot: [0, 0, -1.2], scale: 0.8, color: LEAF_LIGHT });
    arm.extrude({ points: FEATHER, depth: 0.02, base: [-0.03, 1.1, -0.11], rot: [0, 0, 1.1], scale: 0.8, color: LEAF_LIGHT });
    arm.cyl({ r: 0.04, h: 0.05, seg: 5, at: [0, 1.2, -0.21], rot: [-0.8, 0, 0], color: TEAL });
    m.part('blob', { pivot: [0, 1.34, -0.31], parent: 'arm' }).sphere({ r: 0.08, detail: 0, at: [0, 1.34, -0.31], color: AMBER, colorTop: AMBER_LIGHT });

    // Stufe 2: zweiter Stumpf
    const t2 = tier2(m, TEAL);
    t2.cyl({ r: 0.14, rTop: 0.12, h: 0.24, seg: 7, base: [0.29, 0.2, 0.16], color: BARK, colorTop: '#8d6640', faceJitter: 0.08 });
    t2.torus({ r: 0.105, tube: 0.03, seg: 7, tubeSeg: 4, at: [0.29, 0.44, 0.16], color: TEAL });
    t2.sphere({ r: 0.1, detail: 0, at: [0.29, 0.44, 0.16], scale: [1, 0.3, 1], color: AMBER, colorTop: AMBER_LIGHT });

    // Stufe 3: größerer Blattkelch, Bienenkorb
    const t3 = tier3(m, TEAL);
    t3.lathe({ points: [[0, 0], [0.12, 0], [0.13, 0.09], [0.1, 0.18], [0.05, 0.24], [0, 0.25]], seg: 7, base: [-0.3, 0.2, -0.14], color: '#d9ae45', colorTop: '#f0d27a' });
    t3.torus({ r: 0.125, tube: 0.018, seg: 7, tubeSeg: 4, at: [-0.3, 0.3, -0.14], color: '#b98a2e' });
    t3.box({ size: [0.05, 0.05, 0.02], at: [-0.36, 0.26, -0.03], rot: [0, -0.5, 0], color: DARK });
    const cup3 = m.part('cup3', { parent: 'arm', pivot: [0, 0.64, 0], minLevel: 3 });
    cup3.cyl({ r: 0.09, rTop: 0.15, h: 0.06, seg: 6, base: [0, 1.3, -0.31], rot: [0, 0.5, 0], color: LEAF_LIGHT, colorTop: '#c3dd86' });
    cup3.cyl({ r: 0.045, h: 0.05, seg: 5, at: [0, 1.03, -0.075], rot: [-0.4, 0, 0], color: TEAL });

    m.point('muzzle', [0, 1.22, 0.38], 'yaw');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        pose.arm.rotation.x = -0.3 * smooth(ctx.charge) * ctx.active + f * 1.15 + Math.sin(ctx.t * 1.3 + ctx.seed * TAU) * 0.03;
        const s = smooth((ctx.charge - 0.2) * 3) * (1 - smooth(f * 3));
        pose.blob.scale.setScalar(Math.max(1e-3, s * (ctx.level >= 3 ? 1.3 : 1)));
      },
    });
  },

  // Panzerknacker: Jäger mit Speerschleuder auf einem Blockstapel. Der längste Speer weit und breit.
  'tower.steinzeit.knacker': () => {
    const m = createModel('tower.steinzeit.knacker');
    const base = plinth(m, VIOLET);
    const Y = 0.57;
    for (const x of [-0.23, 0.23]) {
      rod(base, [x, 0.275, -0.31], [x, 0.275, 0.31], 0.05, WOOD, { seg: 6 });
      rod(base, [x, 0.455, -0.3], [x, 0.455, 0.3], 0.05, WOOD, { seg: 6 });
      rod(base, [-0.31, 0.365, x], [0.31, 0.365, x], 0.05, WOOD_LIGHT, { seg: 6 });
    }
    base.box({ size: [0.6, 0.06, 0.6], at: [0, Y - 0.03, 0], color: WOOD_LIGHT, colorTop: '#c08a58' });
    base.box({ size: [0.4, 0.014, 0.36], at: [0, Y + 0.005, 0], rot: [0, 0.2, 0], color: HIDE });
    base.box({ size: [0.3, 0.016, 0.05], at: [0, Y + 0.006, 0.13], rot: [0, 0.2, 0], color: VIOLET });
    base.box({ size: [0.3, 0.016, 0.05], at: [0, Y + 0.006, -0.13], rot: [0, 0.2, 0], color: VIOLET });
    // gekreuzte Knochen vorn
    rod(base, [-0.15, 0.27, 0.3], [0.15, 0.47, 0.3], 0.028, BONE);
    rod(base, [0.15, 0.27, 0.31], [-0.15, 0.47, 0.31], 0.028, BONE);
    // Ersatzspeere lehnen an der Seite
    for (const z of [-0.14, 0, 0.14]) {
      rod(base, [-0.42, 0.2, z], [-0.33, 0.82, z], 0.02, WOOD_LIGHT, { seg: 4 });
      base.cone({ r: 0.04, h: 0.1, seg: 4, base: [-0.33, 0.81, z], rot: [0, 0, -0.14], color: ROCK_LIGHT });
      base.box({ size: [0.03, 0.09, 0.07], at: [-0.345, 0.72, z], rot: [0, 0, -0.14], color: VIOLET });
    }

    const figure = m.part('figure', { pivot: [0, Y, 0] });
    human(figure, 0, Y, 0, { band: VIOLET, fur: '#6e4a30' });
    figure.box({ size: [0.05, 0.16, 0.05], at: [-0.14, Y + 0.17, 0.03], rot: [-0.5, 0, 0], color: SKIN });

    const SY = Y + 0.42;
    const arm = m.part('arm', { pivot: [0.14, Y + 0.24, 0], parent: 'figure' });
    arm.box({ size: [0.05, 0.19, 0.05], at: [0.145, Y + 0.32, -0.02], rot: [-0.2, 0, 0], color: SKIN });
    arm.box({ size: [0.035, 0.03, 0.2], at: [0.145, SY - 0.01, -0.1], color: WOOD_DARK });
    const spear = m.part('spear', { pivot: [0.145, SY + 0.02, -0.05], parent: 'arm' });
    rod(spear, [0.145, SY + 0.02, -0.52], [0.145, SY + 0.02, 0.42], 0.025, WOOD_LIGHT, { seg: 5 });
    spear.cone({ r: 0.052, h: 0.14, seg: 4, at: [0.145, SY + 0.02, 0.48], rot: [Math.PI / 2, 0, 0], color: ROCK_LIGHT });
    spear.box({ size: [0.012, 0.11, 0.13], at: [0.145, SY + 0.02, -0.42], color: VIOLET });
    spear.box({ size: [0.11, 0.012, 0.13], at: [0.145, SY + 0.02, -0.42], color: VIOLET });

    // Stufe 2: Stoßzahnbogen, vierter Speer
    const t2 = tier2(m, VIOLET);
    t2.torus({ r: 0.34, tube: 0.04, seg: 7, tubeSeg: 5, arc: 1.75, at: [0.07, 0.2, 0.37], rot: [-Math.PI / 2, 0, 0], color: BONE, mirror: true });
    rod(t2, [-0.42, 0.2, 0.26], [-0.33, 0.82, 0.24], 0.02, WOOD_LIGHT, { seg: 4 });
    t2.cone({ r: 0.04, h: 0.1, seg: 4, base: [-0.33, 0.81, 0.24], rot: [0, 0, -0.14], color: ROCK_LIGHT });
    t2.box({ size: [0.03, 0.09, 0.07], at: [-0.345, 0.72, 0.24], rot: [0, 0, -0.14], color: VIOLET });

    // Stufe 3: Geweihschmuck, Riesenspeer
    tier3(m, VIOLET);
    const antler3 = m.part('antler3', { parent: 'figure', pivot: [0, Y, 0], minLevel: 3 });
    for (const s of [-1, 1]) {
      rod(antler3, [s * 0.05, Y + 0.42, -0.02], [s * 0.15, Y + 0.6, -0.05], 0.022, BONE, { seg: 4 });
      rod(antler3, [s * 0.1, Y + 0.51, -0.035], [s * 0.2, Y + 0.54, -0.02], 0.018, BONE, { seg: 4 });
      rod(antler3, [s * 0.13, Y + 0.57, -0.045], [s * 0.09, Y + 0.69, -0.04], 0.018, BONE, { seg: 4 });
    }
    const spear3 = m.part('spear3', { parent: 'spear', pivot: [0.145, SY + 0.02, -0.05], minLevel: 3 });
    spear3.cone({ r: 0.07, h: 0.22, seg: 4, at: [0.145, SY + 0.02, 0.445], rot: [Math.PI / 2, 0, 0], color: BONE });
    spear3.cyl({ r: 0.034, h: 0.07, seg: 5, at: [0.145, SY + 0.02, 0.3], rot: [Math.PI / 2, 0, 0], color: VIOLET });
    spear3.cyl({ r: 0.034, h: 0.07, seg: 5, at: [0.145, SY + 0.02, -0.25], rot: [Math.PI / 2, 0, 0], color: VIOLET });

    m.point('muzzle', [0.145, SY + 0.02, 0.4], 'figure');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'figure');
        const f = ctx.fire;
        // Sichtbares Ausholen: Speer wandert nach hinten, der Körper lehnt sich zurück, dann schnellt alles vor.
        const w = smooth(ctx.charge * 1.3 - 0.3) * ctx.active;
        pose.figure.rotation.x = -0.14 * w + f * 0.3;
        pose.arm.rotation.x = -0.3 * w + f * 1.3;
        pose.spear.rotation.x = 0.44 * w;
        pose.spear.position.z = -0.1 * w;
        pose.spear.scale.setScalar(Math.max(1e-3, smooth(ctx.charge * 5) * (1 - smooth(f * 4))));
      },
    });
  },

  // Brenner: Glutbläser. Eine Feuerschale mit Glut, dahinter bläst eine Figur durch ein langes Schilfrohr.
  'tower.steinzeit.brenner': () => {
    const m = createModel('tower.steinzeit.brenner');
    const base = plinth(m, RED);
    base.lathe({ points: [[0, 0], [0.15, 0], [0.24, 0.1], [0.25, 0.2], [0.2, 0.2], [0.17, 0.13], [0, 0.11]], seg: 8, base: [0, TOP - 0.01, 0], color: ROCK_DARK, colorTop: ROCK_LIGHT, faceJitter: 0.06 });
    base.cyl({ r: 0.252, h: 0.04, seg: 8, at: [0, 0.37, 0], color: RED });
    base.sphere({ r: 0.05, detail: 0, at: [0.1, 0.39, -0.06], color: '#3a2a22' });
    base.sphere({ r: 0.045, detail: 0, at: [-0.09, 0.39, 0.08], color: '#3a2a22' });

    const embers = m.part('embers', { pivot: [0, 0.36, 0] });
    embers.sphere({ r: 0.18, detail: 1, at: [0, 0.375, 0], scale: [1, 0.3, 1], color: '#f0661f', colorTop: '#ffc35a', glow: true });
    const flame = m.part('flame', { pivot: [0, 0.4, 0] });
    flame.cone({ r: 0.065, h: 0.17, seg: 5, base: [0, 0.4, 0.02], color: '#ff8a2a', colorTop: '#ffe08a', glow: true });
    flame.cone({ r: 0.04, h: 0.1, seg: 5, base: [-0.08, 0.4, -0.04], color: '#ff8a2a', colorTop: '#ffe08a', glow: true });

    /**
     * Bläser mit Schilfrohr; Füße bei z = -0.34.
     * @param {PartBuilder} p
     * @param {string} hair
     */
    const blower = (p, hair) => {
      const z = -0.34;
      human(p, 0, 0.25, z, { band: RED, hair });
      rod(p, [0.125, 0.48, z], [0.045, 0.57, z + 0.17], 0.028, SKIN, { seg: 4 });
      rod(p, [-0.125, 0.48, z], [-0.045, 0.57, z + 0.17], 0.028, SKIN, { seg: 4 });
      rod(p, [0, 0.585, z + 0.09], [0, 0.6, z + 0.4], 0.03, '#e3d27c', { seg: 5 });
      p.sphere({ r: 0.032, detail: 0, at: [0, 0.6, z + 0.41], color: '#ffb347', glow: true });
    };
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    const orbit = m.part('orbit', { pivot: [0, TOP, 0], parent: 'yaw' });
    orbit.box({ size: [0.26, 0.025, 0.15], at: [0, 0.245, -0.345], color: HIDE_DARK });
    blower(m.part('blower', { pivot: [0, 0.25, -0.34], parent: 'orbit' }), HAIR);

    // Stufe 2: größere Schale, Blasebalg
    const t2 = tier2(m, RED);
    t2.torus({ r: 0.235, tube: 0.05, seg: 8, tubeSeg: 5, at: [0, 0.425, 0], color: ROCK_LIGHT });
    const bellows2 = m.part('bellows2', { parent: 'yaw', pivot: [0.36, 0.25, 0], minLevel: 2 });
    bellows2.wedge({ size: [0.17, 0.13, 0.2], base: [0.37, 0.25, 0], rot: [0, -Math.PI / 2, 0], color: HIDE, colorTop: HIDE_DARK });
    bellows2.box({ size: [0.2, 0.025, 0.19], at: [0.37, 0.385, 0], rot: [0, 0, -0.55], color: WOOD });
    bellows2.box({ size: [0.03, 0.03, 0.2], at: [0.45, 0.45, 0], color: RED });

    // Stufe 3: zweiter Bläser, rote Handabdrücke
    const t3 = tier3(m, RED);
    for (const a of [0.6, 2.2, 3.9, 5.4]) {
      t3.box({ size: [0.09, 0.08, 0.02], at: [Math.sin(a) * 0.235, 0.3, Math.cos(a) * 0.235], rot: [-0.6, a, 0], color: RED });
    }
    const orbit3 = m.part('orbit3', { pivot: [0, TOP, 0], parent: 'yaw', minLevel: 3 });
    orbit3.box({ size: [0.26, 0.025, 0.15], at: [0, 0.245, -0.345], color: HIDE_DARK });
    blower(m.part('blower3', { pivot: [0, 0.25, -0.34], parent: 'orbit3', minLevel: 3 }), '#6b4a2c');

    m.point('muzzle', [0, 0.5, 0.18], 'yaw');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        const lean = 0.3 - 0.08 * smooth(ctx.charge) * ctx.active + f * 0.14;
        pose.blower.rotation.x = lean;
        if (ctx.level >= 3) {
          pose.orbit.rotation.y = 0.55;
          pose.orbit3.rotation.y = -0.55;
          pose.blower3.rotation.x = lean;
        }
        const k = ctx.t * TAU + ctx.seed * 20;
        pose.embers.scale.setScalar(1 + Math.sin(k * 0.7) * 0.04 + f * 0.18);
        pose.flame.scale.y = 1 + Math.sin(k * 2.3) * 0.18 + Math.sin(k * 3.7) * 0.1 + f * 1.4;
        pose.flame.rotation.z = Math.sin(k * 1.1) * 0.12;
        if (ctx.level >= 2) pose.bellows2.scale.y = 1 - 0.35 * f - 0.08 * Math.sin(k * 0.5);
      },
    });
  },

  // Taktgeber: Trommler unter einem Totempfahl mit goldener Sonnenscheibe.
  'tower.steinzeit.taktgeber': () => {
    const m = createModel('tower.steinzeit.taktgeber');
    const base = plinth(m, GOLD);
    const TZ = -0.3;
    const SUN = 1.6;
    // Totempfahl
    base.cyl({ r: 0.085, h: 1.25, seg: 6, base: [0, 0.2, TZ], color: WOOD_DARK });
    base.box({ size: [0.21, 0.2, 0.19], at: [0, 0.8, TZ], color: WOOD, colorTop: WOOD_LIGHT });
    base.box({ size: [0.24, 0.045, 0.21], at: [0, 0.925, TZ], color: GOLD });
    base.box({ size: [0.21, 0.2, 0.19], at: [0, 1.05, TZ], color: WOOD_LIGHT, colorTop: '#c9925e' });
    base.box({ size: [0.24, 0.045, 0.21], at: [0, 1.175, TZ], color: GOLD });
    base.box({ size: [0.19, 0.16, 0.17], at: [0, 1.28, TZ], color: WOOD, colorTop: WOOD_LIGHT });
    for (const y of [0.82, 1.07]) {
      base.box({ size: [0.045, 0.05, 0.02], at: [0.05, y, TZ + 0.1], color: BONE, mirror: true });
      base.box({ size: [0.11, 0.03, 0.02], at: [0, y - 0.065, TZ + 0.1], color: DARK });
    }
    base.wedge({ size: [0.05, 0.07, 0.07], at: [0, 1.28, TZ + 0.11], rot: [Math.PI, 0, 0], color: GOLD });
    // Trommel auf Steinfüßen, Tritt für den Trommler
    const DZ = 0.19;
    base.cyl({ r: 0.17, rTop: 0.2, h: 0.31, seg: 8, base: [0, TOP + 0.03, DZ], color: WOOD, colorTop: WOOD_LIGHT });
    base.cyl({ r: 0.205, h: 0.03, seg: 8, base: [0, TOP + 0.335, DZ], color: '#ecdcb8' });
    base.torus({ r: 0.2, tube: 0.022, seg: 8, tubeSeg: 4, at: [0, TOP + 0.33, DZ], color: GOLD });
    base.torus({ r: 0.175, tube: 0.02, seg: 8, tubeSeg: 4, at: [0, TOP + 0.08, DZ], color: GOLD });
    base.box({ size: [0.3, 0.14, 0.2], base: [0, TOP - 0.01, -0.12], color: ROCK, colorTop: ROCK_LIGHT });

    const Y = TOP + 0.13;
    const drummer = m.part('drummer', { pivot: [0, Y, -0.125] });
    human(drummer, 0, Y, -0.125, { band: GOLD });
    for (const [name, s] of /** @type {[string, number][]} */ ([['armL', -1], ['armR', 1]])) {
      const arm = m.part(name, { pivot: [s * 0.135, Y + 0.24, -0.125], parent: 'drummer' });
      rod(arm, [s * 0.135, Y + 0.24, -0.125], [s * 0.11, Y + 0.25, 0.02], 0.028, SKIN, { seg: 4 });
      rod(arm, [s * 0.11, Y + 0.25, 0.01], [s * 0.09, Y + 0.25, 0.14], 0.02, BONE, { seg: 4 });
      arm.sphere({ r: 0.035, detail: 0, at: [s * 0.09, Y + 0.25, 0.15], color: BONE });
    }

    const sun = m.part('sun', { pivot: [0, SUN, TZ] });
    sun.cyl({ r: 0.17, h: 0.05, seg: 10, at: [0, SUN, TZ], rot: [Math.PI / 2, 0, 0], color: GOLD, colorTop: '#ffe07a' });
    sun.cyl({ r: 0.1, h: 0.065, seg: 8, at: [0, SUN, TZ], rot: [Math.PI / 2, 0, 0], color: '#ffe89a' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      sun.cone({ r: 0.04, h: 0.1, seg: 4, at: [Math.sin(a) * 0.23, SUN + Math.cos(a) * 0.23, TZ], rot: [0, 0, -a], color: GOLD, colorTop: '#ffd95a' });
    }

    // Stufe 2: zweite Trommel
    const t2 = tier2(m, GOLD);
    t2.cyl({ r: 0.105, rTop: 0.125, h: 0.22, seg: 7, base: [0.29, TOP, 0.02], color: WOOD_DARK, colorTop: WOOD });
    t2.cyl({ r: 0.13, h: 0.025, seg: 7, base: [0.29, TOP + 0.22, 0.02], color: '#ecdcb8' });
    t2.torus({ r: 0.125, tube: 0.018, seg: 7, tubeSeg: 4, at: [0.29, TOP + 0.215, 0.02], color: GOLD });

    // Stufe 3: Flügel und Federn am Totem
    const t3 = tier3(m, GOLD);
    /** @type {[number, number][]} */
    const wing = [[0, 0], [0.12, -0.06], [0.2, -0.02], [0.28, -0.07], [0.34, 0], [0.42, -0.03], [0.44, 0.1], [0.3, 0.16], [0, 0.12]];
    t3.extrude({ points: wing, depth: 0.04, at: [0.09, 1.06, TZ - 0.02], rot: [0, 0, 0.12], scale: 0.9, color: '#c9703a', colorTop: GOLD, mirror: true });
    t3.extrude({ points: FEATHER, depth: 0.025, base: [0.06, 1.34, TZ - 0.06], rot: [-0.3, 0, -0.5], color: GOLD, colorTop: '#ffe89a', mirror: true });
    const wings3 = m.part('feather3', { pivot: [0, 1.34, TZ - 0.08], minLevel: 3 });
    wings3.extrude({ points: FEATHER, depth: 0.025, base: [0, 1.34, TZ - 0.07], rot: [-0.3, 0, 0], scale: 1.15, color: '#c9703a', colorTop: GOLD });

    return m.build({
      animate(pose, ctx) {
        // 84 Schläge pro Minute, wie die Musik der Steinzeit.
        const beat = ctx.t * 1.4 + ctx.seed;
        const pL = beat - Math.floor(beat);
        const b2 = beat + 0.5;
        const pR = b2 - Math.floor(b2);
        pose.armL.rotation.x = -Math.sin(pL * Math.PI) * 0.85;
        pose.armR.rotation.x = -Math.sin(pR * Math.PI) * 0.85;
        const hit = (1 - pL) * (1 - pL) * (1 - pL);
        pose.drummer.position.y = -hit * 0.015;
        pose.drummer.rotation.z = Math.sin(beat * Math.PI) * 0.05;
        pose.sun.rotation.x = -0.35;
        pose.sun.rotation.z = ctx.t * 0.35;
        pose.sun.scale.setScalar(1 + hit * 0.14 + ctx.fire * 0.1);
        if (ctx.level >= 3) pose.feather3.rotation.x = Math.sin(beat * Math.PI) * 0.12;
      },
    });
  },
};
