// @ts-check
// Gegner der Steinzeit: Frischling (Schwarm), Keulenschwinger (Standard), Wolf (schnell), Wollnashorn (zäh)
// und der Boss "Das Alte Mammut".

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der Steinzeit ---
const WOOD = '#8a5a35';
const WOOD_LIGHT = '#b07a4c';
const SKIN = '#e3b48d';
const FUR = '#7c4b2a';
const FUR_LIGHT = '#a36a3e';
const HAIR = '#3a281c';
const BONE = '#efe6d2';
const BONE_SHADE = '#d9c9a8';
const DARK = '#2a1e16';
const OCHRE = '#e2603a';
const WOLF = '#8d9199';
const WOLF_DARK = '#6c7079';
const WOLF_LIGHT = '#c9ccd0';
const BOAR = '#8a5c38';
const BOAR_DARK = '#6b442a';
const CREAM = '#ecd9ae';
const SNOUT = '#dba08c';
const RHINO = '#8b7355';
const RHINO_DARK = '#66513d';
const RHINO_LIGHT = '#b39a76';
const MAMMOTH = '#6a442c';
const MAMMOTH_DARK = '#4c2f20';
const MAMMOTH_LIGHT = '#8c6140';
const MAMMOTH_OLD = '#b88d5e';

/**
 * Setzt einen (verjüngten) Zylinder zwischen zwei Punkte im Modellraum.
 * @param {PartBuilder} part
 * @param {Vec3} a Anfang (Radius r0)
 * @param {Vec3} b Ende (Radius r1)
 * @param {number} r0
 * @param {number} r1
 * @param {string} color
 * @param {{ seg?: number, colorTop?: string, faceJitter?: number, mirror?: boolean }} [o]
 */
function limb(part, a, b, r0, r1, color, o = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  part.cyl({
    r: r0, rTop: r1, h: len, seg: o.seg ?? 6,
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [Math.atan2(dz, dy), 0, -Math.asin(dx / len)],
    color, colorTop: o.colorTop, faceJitter: o.faceJitter, mirror: o.mirror,
  });
}

/**
 * Kette aus verjüngten Zylindern entlang einer Punktfolge (Stoßzahn, Horn), mit Kugeln an den Knicken.
 * @param {PartBuilder} part
 * @param {Vec3[]} pts
 * @param {number} r0 Radius am Anfang
 * @param {number} r1 Radius am Ende
 * @param {string} color
 * @param {string} colorTip
 * @param {boolean} mirror
 */
function chain(part, pts, r0, r1, color, colorTip, mirror) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    limb(part, pts[i], pts[i + 1], ra, rb, i === n - 1 ? colorTip : color, { seg: 6, mirror });
    if (i > 0) part.sphere({ r: ra * 1.02, detail: 0, at: pts[i], color, mirror });
  }
}

// Feste Optionen für die Laufzyklen (damit animate nichts alloziert).
const WALK_KEULE = { swing: 0.75, armSwing: 0.45, bob: 0.03, sway: 0.07 };
const WALK_PIG = { swing: 0.9, bob: 0, nod: 0.05 };
const WALK_RHINO = { swing: 0.42, bob: 0.018, nod: 0.03 };
const WALK_MAMMOTH = { swing: 0.34, bob: 0.03, nod: 0.025 };

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schwarm: kleiner gestreifter Frischling, der hüpfend wuselt.
  'enemy.steinzeit.frischling': () => {
    const m = createModel('enemy.steinzeit.frischling');
    const body = m.part('body', { pivot: [0, 0.07, 0] });
    body.sphere({ r: 0.13, at: [0, 0.16, -0.02], scale: [0.92, 0.8, 1.25], color: BOAR_DARK, colorTop: BOAR, faceJitter: 0.05 });
    // Cremefarbene Längsstreifen: schmale Scheiben, die knapp aus dem Rücken ragen.
    body.sphere({ r: 0.13, at: [0, 0.16, -0.02], scale: [0.17, 0.84, 1.22], color: CREAM });
    body.sphere({ r: 0.13, at: [0.066, 0.16, -0.02], scale: [0.15, 0.73, 1.12], color: CREAM, mirror: true });
    body.cone({ r: 0.022, h: 0.07, seg: 4, at: [0, 0.2, -0.19], rot: [-1.0, 0, 0], color: BOAR_DARK });

    const head = m.part('head', { pivot: [0, 0.16, 0.08], parent: 'body' });
    head.sphere({ r: 0.092, at: [0, 0.165, 0.13], color: BOAR, faceJitter: 0.05 });
    head.cyl({ r: 0.045, rTop: 0.04, h: 0.07, seg: 6, at: [0, 0.145, 0.235], rot: [Math.PI / 2, 0, 0], color: BOAR });
    head.cyl({ r: 0.036, h: 0.012, seg: 6, at: [0, 0.145, 0.273], rot: [Math.PI / 2, 0, 0], color: SNOUT });
    head.box({ size: [0.022, 0.026, 0.014], at: [0.05, 0.19, 0.2], color: DARK, mirror: true });

    m.part('earL', { pivot: [-0.055, 0.23, 0.11], parent: 'head' })
      .pyramid({ size: [0.06, 0.075, 0.03], base: [-0.062, 0.222, 0.11], rot: [0.2, 0, 0.55], color: BOAR_DARK });
    m.part('earR', { pivot: [0.055, 0.23, 0.11], parent: 'head' })
      .pyramid({ size: [0.06, 0.075, 0.03], base: [0.062, 0.222, 0.11], rot: [0.2, 0, -0.55], color: BOAR_DARK });

    /** @type {[string, number, number][]} */
    const legs = [['legFL', -0.06, 0.07], ['legFR', 0.06, 0.07], ['legBL', -0.06, -0.1], ['legBR', 0.06, -0.1]];
    for (const [name, x, z] of legs) {
      m.part(name, { pivot: [x, 0.08, z] }).box({ size: [0.045, 0.09, 0.045], base: [x, 0, z], color: BOAR_DARK });
    }

    return m.build({
      stride: 0.3,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkQuadruped(pose, ctx, WALK_PIG);
        // Hüpfen: zwei kleine Sprünge je Schrittzyklus.
        const hop = Math.abs(Math.sin(ctx.walk)) * 0.045 * k;
        pose.body.position.y += hop;
        pose.body.rotation.x = Math.cos(ctx.walk * 2) * 0.1 * k;
        const flap = Math.sin(ctx.walk * 2 + 0.6) * 0.45 * k + Math.sin(ctx.t * 3 + ctx.seed * 6) * 0.08;
        pose.earL.rotation.z = -flap;
        pose.earR.rotation.z = flap;
        A.flinch(pose, ctx, 'body', 0.18);
      },
    });
  },

  // Standard: gedrungener Keulenschwinger im Fell, Keule über der Schulter, Knochen im Haar.
  'enemy.steinzeit.keule': () => {
    const m = createModel('enemy.steinzeit.keule');
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    body.box({ size: [0.26, 0.21, 0.18], base: [0, 0.14, 0], color: FUR, colorTop: FUR_LIGHT });
    body.box({ size: [0.27, 0.045, 0.19], at: [0, 0.175, 0], color: HAIR });
    // Fellträger über die linke Schulter
    body.box({ size: [0.075, 0.03, 0.195], at: [-0.075, 0.352, 0], color: HAIR });

    const head = m.part('head', { pivot: [0, 0.35, 0], parent: 'body' });
    head.sphere({ r: 0.12, at: [0, 0.465, 0.01], color: SKIN });
    head.dome({ r: 0.131, seg: 6, rings: 2, at: [0, 0.49, -0.02], color: HAIR });
    head.box({ size: [0.028, 0.032, 0.014], at: [0.044, 0.465, 0.123], color: DARK, mirror: true });
    // Knochen im Haarknoten
    head.sphere({ r: 0.045, detail: 0, at: [0, 0.6, -0.03], color: HAIR });
    head.cyl({ r: 0.02, h: 0.17, seg: 5, at: [0, 0.6, -0.03], rot: [0, 0, Math.PI / 2], color: BONE });
    head.sphere({ r: 0.028, detail: 0, at: [0.09, 0.6, -0.03], color: BONE, mirror: true });

    m.part('legL', { pivot: [-0.07, 0.15, 0] }).box({ size: [0.085, 0.15, 0.095], base: [-0.07, 0, 0], color: SKIN });
    m.part('legR', { pivot: [0.07, 0.15, 0] }).box({ size: [0.085, 0.15, 0.095], base: [0.07, 0, 0], color: SKIN });
    m.part('armL', { pivot: [-0.165, 0.33, 0], parent: 'body' }).box({ size: [0.068, 0.18, 0.068], at: [-0.165, 0.25, 0], color: SKIN });

    // Rechter Arm angewinkelt nach vorn oben, die Keule ruht auf der Schulter.
    const armR = m.part('armR', { pivot: [0.165, 0.33, 0], parent: 'body' });
    limb(armR, [0.165, 0.33, 0], [0.175, 0.3, 0.13], 0.036, 0.034, SKIN, { seg: 5 });
    armR.sphere({ r: 0.042, detail: 0, at: [0.175, 0.3, 0.13], color: SKIN });
    limb(armR, [0.175, 0.24, 0.17], [0.175, 0.47, 0.02], 0.026, 0.04, WOOD, { seg: 6 });
    limb(armR, [0.175, 0.47, 0.02], [0.175, 0.62, -0.08], 0.045, 0.085, WOOD, { seg: 6, colorTop: WOOD_LIGHT });
    armR.sphere({ r: 0.085, detail: 0, at: [0.175, 0.625, -0.083], scale: [1, 0.7, 1], rot: [-0.56, 0, 0], color: WOOD_LIGHT });

    return m.build({
      stride: 0.5,
      animate(pose, ctx) {
        A.walkBiped(pose, ctx, WALK_KEULE);
        const k = Math.min(1, ctx.move);
        // Die Keule wippt nur leicht auf der Schulter, statt wie ein Arm zu schwingen.
        pose.armR.rotation.x = Math.sin(ctx.walk * 2) * 0.09 * k - 0.04;
        pose.head.rotation.z = Math.sin(ctx.walk) * 0.07 * k;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Schnell: schlanker grauer Wolf, nach vorn gestreckt, galoppiert in Sätzen.
  'enemy.steinzeit.wolf': () => {
    const m = createModel('enemy.steinzeit.wolf');
    const body = m.part('body', { pivot: [0, 0.22, -0.02] });
    body.box({ size: [0.15, 0.14, 0.3], at: [0, 0.25, -0.1], rot: [0.08, 0, 0], color: WOLF_DARK, colorTop: WOLF });
    body.box({ size: [0.185, 0.18, 0.2], at: [0, 0.265, 0.1], rot: [-0.1, 0, 0], color: WOLF, colorTop: WOLF_LIGHT });
    body.box({ size: [0.08, 0.03, 0.3], at: [0, 0.322, -0.09], rot: [0.08, 0, 0], color: '#585c66' });

    const head = m.part('head', { pivot: [0, 0.31, 0.18], parent: 'body' });
    head.box({ size: [0.15, 0.13, 0.13], at: [0, 0.33, 0.25], color: WOLF });
    head.box({ size: [0.08, 0.065, 0.13], at: [0, 0.3, 0.37], color: WOLF_LIGHT });
    head.box({ size: [0.045, 0.035, 0.03], at: [0, 0.325, 0.43], color: DARK });
    head.pyramid({ size: [0.055, 0.1, 0.035], base: [0.05, 0.39, 0.215], rot: [-0.15, 0, -0.15], color: WOLF_DARK, mirror: true });
    head.box({ size: [0.026, 0.026, 0.014], at: [0.045, 0.35, 0.318], color: DARK, mirror: true });

    m.part('tail', { pivot: [0, 0.29, -0.24], parent: 'body' })
      .cone({ r: 0.06, h: 0.27, seg: 5, base: [0, 0.28, -0.22], rot: [-1.75, 0, 0], color: WOLF_DARK, colorTop: WOLF_LIGHT });

    /** @type {[string, number, number][]} */
    const legs = [['legFL', -0.065, 0.13], ['legFR', 0.065, 0.13], ['legBL', -0.06, -0.19], ['legBR', 0.06, -0.19]];
    for (const [name, x, z] of legs) {
      m.part(name, { pivot: [x, 0.2, z] }).box({ size: [0.048, 0.2, 0.055], base: [x, 0, z], color: WOLF_DARK, colorTop: WOLF });
    }

    return m.build({
      stride: 0.85,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const s = Math.sin(ctx.walk);
        const c = Math.cos(ctx.walk);
        // Galopp: Vorder- und Hinterbeine jeweils als Paar, der Rumpf nickt bei jedem Satz.
        pose.legFL.rotation.x = (s * 0.85 - 0.1) * k;
        pose.legFR.rotation.x = (Math.sin(ctx.walk - 0.35) * 0.85 - 0.1) * k;
        pose.legBL.rotation.x = (-s * 0.8 + 0.1) * k;
        pose.legBR.rotation.x = (-Math.sin(ctx.walk - 0.35) * 0.8 + 0.1) * k;
        pose.body.rotation.x = 0.06 * k + c * 0.13 * k;
        pose.body.position.y += (0.5 - 0.5 * Math.cos(ctx.walk * 1 + 0.8)) * 0.04 * k;
        pose.head.rotation.x = -c * 0.1 * k;
        pose.tail.rotation.x = c * 0.25 * k - 0.15 * k;
        pose.tail.rotation.y = Math.sin(ctx.t * 2.2 + ctx.seed * 6) * 0.2;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Zäh: massiges Wollnashorn mit Buckel, gesenktem Kopf und zwei Hörnern.
  'enemy.steinzeit.nashorn': () => {
    const m = createModel('enemy.steinzeit.nashorn');
    const body = m.part('body', { pivot: [0, 0.24, -0.08] });
    body.sphere({ r: 0.27, at: [0, 0.4, -0.12], scale: [0.98, 0.84, 1.3], color: RHINO, colorTop: RHINO_LIGHT, faceJitter: 0.08 });
    // Zottelfell: dunklerer, breiterer Saum unten
    body.sphere({ r: 0.27, at: [0, 0.3, -0.12], scale: [1.04, 0.52, 1.26], color: RHINO_DARK, faceJitter: 0.1 });
    body.sphere({ r: 0.2, at: [0, 0.54, 0.0], scale: [1.08, 0.9, 1.15], color: RHINO, colorTop: RHINO_LIGHT, faceJitter: 0.08 });
    body.cone({ r: 0.03, h: 0.14, seg: 4, at: [0, 0.36, -0.49], rot: [Math.PI - 0.25, 0, 0], color: RHINO_DARK });

    const head = m.part('head', { pivot: [0, 0.42, 0.14], parent: 'body' });
    head.sphere({ r: 0.15, at: [0, 0.34, 0.3], scale: [0.95, 0.9, 1.45], rot: [0.5, 0, 0], color: RHINO, faceJitter: 0.06 });
    head.cone({ r: 0.065, h: 0.34, seg: 6, base: [0, 0.29, 0.43], rot: [0.32, 0, 0], color: BONE_SHADE, colorTop: BONE });
    head.cone({ r: 0.048, h: 0.16, seg: 6, base: [0, 0.38, 0.31], rot: [0.2, 0, 0], color: BONE_SHADE, colorTop: BONE });
    head.cone({ r: 0.035, h: 0.09, seg: 5, base: [0.085, 0.47, 0.2], rot: [-0.1, 0, -0.4], color: RHINO_DARK, mirror: true });
    head.box({ size: [0.028, 0.03, 0.028], at: [0.115, 0.38, 0.33], color: DARK, mirror: true });

    /** @type {[string, number, number][]} */
    const legs = [['legFL', -0.15, 0.08], ['legFR', 0.15, 0.08], ['legBL', -0.15, -0.3], ['legBR', 0.15, -0.3]];
    for (const [name, x, z] of legs) {
      const leg = m.part(name, { pivot: [x, 0.25, z] });
      leg.cyl({ r: 0.075, rTop: 0.085, h: 0.27, seg: 6, base: [x, 0, z], color: RHINO_DARK });
      leg.cyl({ r: 0.082, h: 0.05, seg: 6, base: [x, 0, z], color: HAIR });
    }

    return m.build({
      stride: 0.6,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkQuadruped(pose, ctx, WALK_RHINO);
        // Schwerer Tritt: der Rumpf rollt von Seite zu Seite.
        pose.body.rotation.z = Math.sin(ctx.walk) * 0.045 * k;
        pose.head.rotation.y = Math.sin(ctx.walk) * 0.08 * k;
        A.flinch(pose, ctx, 'body', 0.08);
      },
    });
  },

  // Boss: Das Alte Mammut. Hoher Schulterbuckel, Kuppelkopf, schwingender Rüssel, große Stoßzähne.
  'boss.steinzeit.mammut': () => {
    const m = createModel('boss.steinzeit.mammut');
    const body = m.part('body', { pivot: [0, 0.5, -0.05] });
    body.sphere({ r: 0.42, at: [0, 0.74, -0.1], scale: [0.95, 0.9, 1.2], color: MAMMOTH, colorTop: MAMMOTH_LIGHT, faceJitter: 0.09 });
    body.sphere({ r: 0.42, at: [0, 0.56, -0.1], scale: [1.02, 0.62, 1.16], color: MAMMOTH_DARK, faceJitter: 0.1 });
    body.sphere({ r: 0.31, at: [0, 1.0, 0.1], scale: [1, 0.95, 1.05], color: MAMMOTH, colorTop: MAMMOTH_LIGHT, faceJitter: 0.09 });
    limb(body, [0, 0.78, -0.58], [0, 0.5, -0.66], 0.035, 0.025, MAMMOTH_DARK, { seg: 5 });
    body.sphere({ r: 0.05, detail: 0, at: [0, 0.47, -0.665], color: MAMMOTH_DARK });

    const head = m.part('head', { pivot: [0, 0.95, 0.3], parent: 'body' });
    head.sphere({ r: 0.27, at: [0, 0.95, 0.5], scale: [0.95, 1.1, 0.95], color: MAMMOTH, colorTop: MAMMOTH_LIGHT, faceJitter: 0.08 });
    head.sphere({ r: 0.18, at: [0, 1.17, 0.46], scale: [1.05, 0.8, 1.05], color: MAMMOTH_LIGHT, colorTop: MAMMOTH_OLD, faceJitter: 0.08 });
    head.box({ size: [0.045, 0.05, 0.03], at: [0.17, 1.0, 0.7], color: DARK, mirror: true });
    chain(head, [[0.14, 0.82, 0.66], [0.23, 0.52, 0.76], [0.31, 0.37, 0.92], [0.31, 0.42, 1.07], [0.22, 0.58, 1.13]], 0.078, 0.028, BONE_SHADE, BONE, true);

    m.part('earL', { pivot: [-0.22, 1.08, 0.42], parent: 'head' })
      .sphere({ r: 0.19, detail: 0, at: [-0.33, 0.95, 0.38], scale: [0.3, 1, 0.8], rot: [0, 0.5, 0.2], color: MAMMOTH_DARK, faceJitter: 0.06 });
    m.part('earR', { pivot: [0.22, 1.08, 0.42], parent: 'head' })
      .sphere({ r: 0.19, detail: 0, at: [0.33, 0.95, 0.38], scale: [0.3, 1, 0.8], rot: [0, -0.5, -0.2], color: MAMMOTH_DARK, faceJitter: 0.06 });

    // Rüssel in drei Gliedern
    const t1 = m.part('trunk1', { pivot: [0, 0.88, 0.72], parent: 'head' });
    limb(t1, [0, 0.9, 0.7], [0, 0.62, 0.84], 0.105, 0.085, MAMMOTH, { seg: 6 });
    const t2 = m.part('trunk2', { pivot: [0, 0.62, 0.84], parent: 'trunk1' });
    t2.sphere({ r: 0.086, detail: 0, at: [0, 0.62, 0.84], color: MAMMOTH });
    limb(t2, [0, 0.62, 0.84], [0, 0.38, 0.88], 0.085, 0.068, MAMMOTH, { seg: 6 });
    const t3 = m.part('trunk3', { pivot: [0, 0.38, 0.88], parent: 'trunk2' });
    t3.sphere({ r: 0.069, detail: 0, at: [0, 0.38, 0.88], color: MAMMOTH });
    limb(t3, [0, 0.38, 0.88], [0, 0.2, 0.98], 0.068, 0.052, MAMMOTH_LIGHT, { seg: 6 });

    /** @type {[string, number, number][]} */
    const legs = [['legFL', -0.23, 0.2], ['legFR', 0.23, 0.2], ['legBL', -0.23, -0.4], ['legBR', 0.23, -0.4]];
    for (const [name, x, z] of legs) {
      const leg = m.part(name, { pivot: [x, 0.5, z] });
      leg.cyl({ r: 0.12, rTop: 0.135, h: 0.56, seg: 7, base: [x, 0, z], color: MAMMOTH_DARK, faceJitter: 0.06 });
      leg.cyl({ r: 0.13, h: 0.07, seg: 7, base: [x, 0, z], color: BONE_SHADE });
    }

    return m.build({
      stride: 0.8,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkQuadruped(pose, ctx, WALK_MAMMOTH);
        pose.body.rotation.z = Math.sin(ctx.walk) * 0.035 * k;
        pose.head.rotation.z = -Math.sin(ctx.walk) * 0.03 * k;
        // Rüssel pendelt träge, jedes Glied etwas später.
        const p = ctx.t * 1.5 + ctx.seed * 6;
        pose.trunk1.rotation.x = Math.sin(p) * 0.1;
        pose.trunk1.rotation.z = Math.sin(p * 0.7) * 0.12;
        pose.trunk2.rotation.x = Math.sin(p - 0.9) * 0.16 - 0.05;
        pose.trunk2.rotation.z = Math.sin(p * 0.7 - 0.8) * 0.14;
        pose.trunk3.rotation.x = Math.sin(p - 1.8) * 0.22 - 0.1;
        pose.trunk3.rotation.z = Math.sin(p * 0.7 - 1.6) * 0.16;
        const flap = Math.sin(ctx.t * 2.4 + ctx.seed * 6) * 0.5 + 0.5;
        pose.earL.rotation.y = -flap * 0.45;
        pose.earR.rotation.y = flap * 0.45;
        A.flinch(pose, ctx, 'body', 0.05);
      },
    });
  },
};
