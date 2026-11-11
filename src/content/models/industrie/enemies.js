// @ts-check
// Gegner im Industriezeitalter (um 1880): freundliche Spielzeug-Halunken aus Messing, Kupfer und Dampf.
// Halunke (Standard, Melone, Augenmaske, Beutesack), Hochradfahrer (schnell), Heißluftballon (fliegend, zäh),
// Dampfwagen (Träger, gepanzert, vier Halunken unter dem Kupferdach) und der Boss, die Dampflok "Schwarze Berta".

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Zeitalters ---
const SKIN = '#e3b48d';
const SKIN_DARK = '#c99673';
const DARK = '#2a2420';
const MASK = '#2d2a35';
const CREAM = '#f0e5c8';
const WHITE = '#f4efe4';
const BOWLER = '#3a3540';
const BOWLER_LIGHT = '#5a5262';
const HATBAND = '#7a4b38';
const BRASS = '#d9a832';
const BRASS_LIGHT = '#f2cc5c';
const COPPER = '#c87533';
const COPPER_LIGHT = '#e3945a';
const IRON = '#4a4c55';
const IRON_LIGHT = '#6c707b';
const STEEL = '#8e949e';
const STEEL_LIGHT = '#bcc2ca';
const RED = '#c2412f';
const RED_LIGHT = '#e0604a';
const SMOKE = '#ece8e0';
const FIRE = '#ffb347';
const FIRE_LIGHT = '#ffe08a';
const LEATHER = '#7a5236';
const SACK = '#dcc48e';
const SACK_LIGHT = '#efdcae';
// Halunke
const VEST = '#e0a93a';
const VEST_DARK = '#8a4a3c';
const TROUSERS = '#4d5163';
const SHIRT = '#efe6d2';
const NECKERCHIEF = '#c8463a';
// Hochradfahrer
const COAT = '#2f6b5e';
const COAT_LIGHT = '#3f8a79';
const BUFF = '#dcc28c';
const TOPHAT = '#34303c';
const MOUSTACHE = '#6a4a32';
// Heißluftballon
const BALLOON = '#d9503a';
const BALLOON_LIGHT = '#ec6e52';
const STRIPE = '#f3e6c6';
const WICKER = '#b5864f';
const WICKER_LIGHT = '#d2a36a';
const WICKER_DARK = '#7d5634';
const ROPE = '#8a6a4a';
// Dampfwagen
const HULL = '#5a5f66';
const HULL_LIGHT = '#7b818a';
const SPOKE = '#e3c48a';
// Schwarze Berta
const BERTA = '#27392f';
const BERTA_LIGHT = '#3c5a4a';
const BERTA_DARK = '#1f2b25';
const COAL = '#36323a';
const COAL_LIGHT = '#4c4752';
const LAMP = '#ffd27a';

const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

/**
 * Setzt einen (verjüngten) Zylinder zwischen zwei Punkte im Modellraum.
 * @param {PartBuilder} part
 * @param {Vec3} a Anfang (Radius r0)
 * @param {Vec3} b Ende (Radius r1)
 * @param {number} r0
 * @param {number} r1
 * @param {string} color
 * @param {{ seg?: number, colorTop?: string, mirror?: boolean, open?: boolean }} [o]
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
    color, colorTop: o.colorTop, mirror: o.mirror, open: o.open,
  });
}

/**
 * Melone: breite Krempe, runder Kopf, Hutband.
 * @param {PartBuilder} part
 * @param {Vec3} base Mitte der Krempe
 * @param {number} s Radius des Hutkopfs
 * @param {{ mirror?: boolean, seg?: number, band?: boolean }} [o]
 */
function bowler(part, base, s, o = {}) {
  const [x, y, z] = base;
  const seg = o.seg ?? 8;
  part.cyl({ r: s * 1.45, h: s * 0.16, seg, at: [x, y, z], color: BOWLER, shade: 0, mirror: o.mirror });
  part.dome({ r: s, seg, rings: 2, at: [x, y + s * 0.06, z], scale: [1, 1.12, 1], color: BOWLER, colorTop: BOWLER_LIGHT, mirror: o.mirror });
  if (o.band ?? true) part.cyl({ r: s * 1.03, h: s * 0.24, seg, open: true, at: [x, y + s * 0.2, z], color: HATBAND, shade: 0, mirror: o.mirror });
}

/**
 * Kleiner Halunkenkopf als Fahrgast: Kopf, Augenmaske mit hellen Augen, Melone. Mit `mirror` gleich als Paar.
 * @param {PartBuilder} part
 * @param {Vec3} at Kopfmitte
 * @param {number} s Kopfradius
 * @param {boolean} [mirror]
 * @param {boolean} [face] helle Augen in der Maske (für verdeckte Köpfe weglassen)
 */
function passenger(part, at, s, mirror = false, face = true) {
  const [x, y, z] = at;
  part.sphere({ r: s, detail: 0, at: [x, y, z], color: SKIN, mirror });
  part.cyl({ r: s * 1.04, h: s * 0.44, seg: 6, open: true, at: [x, y + s * 0.1, z], color: MASK, shade: 0, mirror });
  if (face) part.box({ size: [s * 1.05, s * 0.2, 0.012], at: [x, y + s * 0.12, z + s * 0.99], color: WHITE, mirror });
  bowler(part, [x, y + s * 0.5, z], s * 0.86, { mirror, seg: 6, band: false });
}

/**
 * Speichenrad, aufrecht, Achse entlang X. Mit `mirror` als Paar.
 * @param {PartBuilder} part
 * @param {Vec3} at Radmitte
 * @param {number} r Außenradius
 * @param {{ tube?: number, spokes?: number, seg?: number, rim?: string, spoke?: string, hub?: string, hubR?: number, mirror?: boolean }} [o]
 */
function wheel(part, at, r, o = {}) {
  const tube = o.tube ?? 0.022;
  const mirror = o.mirror ?? false;
  part.torus({ r: r - tube, tube, seg: o.seg ?? 10, tubeSeg: 3, at, rot: [0, 0, HALF_PI], color: o.rim ?? DARK, mirror });
  const n = o.spokes ?? 2;
  for (let i = 0; i < n; i++) {
    part.box({ size: [0.016, 2 * (r - tube), 0.022], at, rot: [(i * Math.PI) / n, 0, 0], color: o.spoke ?? SPOKE, mirror });
  }
  if (o.hub !== '') part.cyl({ r: o.hubR ?? r * 0.22, h: 0.05, seg: 5, at, rot: [0, 0, HALF_PI], color: o.hub ?? BRASS, mirror });
}

/**
 * Rauch- oder Dampfwölkchen, das in einem Zyklus aufsteigt, wächst und verblasst (über die Größe).
 * @param {import('../../../types/model').PoseNode} p
 * @param {number} ph Phase 0..1
 * @param {number} rise Steighöhe
 * @param {number} drift Drift nach hinten (-Z)
 * @param {number} size größte Skalierung
 */
function puffCycle(p, ph, rise, drift, size) {
  const u = ph - Math.floor(ph);
  p.scale.setScalar(Math.max(1e-4, Math.sin(Math.min(1, u * 1.25) * Math.PI) * size + u * 0.3 * size));
  p.position.y += u * rise;
  p.position.z -= u * drift;
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Standard: stämmiger Halunke mit Melone, Augenmaske, gestreifter Weste und Beutesack über der Schulter; schleicht auf Zehenspitzen.
  'enemy.industrie.halunke': () => {
    const m = createModel('enemy.industrie.halunke');
    const body = m.part('body', { pivot: [0, 0.13, 0] });
    body.cyl({ r: 0.1, rTop: 0.112, h: 0.06, seg: 8, open: true, base: [0, 0.115, 0], scale: [1, 1, 0.85], color: TROUSERS });
    // Gestreifte Weste: Bänder senf und rotbraun (nur das oberste braucht einen Deckel)
    const ys = [0.17, 0.212, 0.254, 0.296, 0.338];
    const rs = [0.113, 0.134, 0.138, 0.126, 0.088];
    for (let i = 0; i < 4; i++) {
      body.cyl({ r: rs[i], rTop: rs[i + 1], h: ys[i + 1] - ys[i], seg: 8, open: i < 3, base: [0, ys[i], 0], scale: [1, 1, 0.86], color: i % 2 ? VEST_DARK : VEST, shade: 0.04 });
    }
    body.torus({ r: 0.06, tube: 0.026, seg: 6, tubeSeg: 3, at: [0, 0.34, 0.005], color: NECKERCHIEF });
    body.cone({ r: 0.032, h: 0.05, seg: 4, at: [0, 0.31, 0.07], rot: [Math.PI - 0.3, 0, 0], color: NECKERCHIEF });

    const head = m.part('head', { pivot: [0, 0.35, 0], parent: 'body' });
    head.sphere({ r: 0.105, at: [0, 0.44, 0.01], color: SKIN });
    // Augenmaske als Band rund um den Kopf, darin helle Augen
    head.cyl({ r: 0.109, h: 0.048, seg: 8, open: true, at: [0, 0.452, 0.01], color: MASK, shade: 0 });
    head.sphere({ r: 0.022, detail: 0, at: [0.04, 0.455, 0.106], scale: [1, 1, 0.6], color: WHITE, mirror: true });
    head.sphere({ r: 0.028, detail: 0, at: [0, 0.418, 0.118], color: SKIN_DARK });
    head.box({ size: [0.05, 0.012, 0.012], at: [0.012, 0.388, 0.105], rot: [0, 0, -0.25], color: DARK });
    bowler(head, [0, 0.5, 0.0], 0.085);

    const legL = m.part('legL', { pivot: [-0.055, 0.13, 0] });
    legL.cyl({ r: 0.038, rTop: 0.046, h: 0.14, seg: 6, base: [-0.055, 0.03, 0], color: TROUSERS });
    legL.sphere({ r: 0.038, detail: 0, at: [-0.055, 0.03, 0.03], scale: [0.9, 0.7, 1.45], rot: [0.35, 0, 0], color: DARK });
    const legR = m.part('legR', { pivot: [0.055, 0.13, 0] });
    legR.cyl({ r: 0.038, rTop: 0.046, h: 0.14, seg: 6, base: [0.055, 0.03, 0], color: TROUSERS });
    legR.sphere({ r: 0.038, detail: 0, at: [0.055, 0.03, 0.03], scale: [0.9, 0.7, 1.45], rot: [0.35, 0, 0], color: DARK });

    // Linker Arm vorgestreckt, schleichend
    const armL = m.part('armL', { pivot: [-0.125, 0.31, 0], parent: 'body' });
    limb(armL, [-0.125, 0.31, 0], [-0.15, 0.24, 0.1], 0.034, 0.03, SHIRT, { seg: 5, open: true });
    armL.sphere({ r: 0.034, detail: 0, at: [-0.152, 0.235, 0.11], color: SKIN });

    // Rechter Arm hält den Beutesack über der Schulter
    const armR = m.part('armR', { pivot: [0.12, 0.31, 0], parent: 'body' });
    limb(armR, [0.12, 0.31, 0], [0.14, 0.4, 0.02], 0.034, 0.03, SHIRT, { seg: 5, open: true });
    armR.sphere({ r: 0.034, detail: 0, at: [0.138, 0.41, 0.02], color: SKIN });
    limb(armR, [0.135, 0.41, 0.0], [0.11, 0.38, -0.1], 0.02, 0.026, SACK, { seg: 5, open: true });
    armR.sphere({ r: 0.115, at: [0.09, 0.33, -0.16], scale: [1, 1.05, 0.9], color: SACK, colorTop: SACK_LIGHT });
    armR.cyl({ r: 0.03, h: 0.01, seg: 6, at: [0.11, 0.405, -0.09], rot: [0.6, 0, -0.3], color: BRASS_LIGHT });

    return m.build({
      stride: 0.4,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const w = ctx.walk;
        const s = Math.sin(w);
        // Auf Zehenspitzen: hohe, vorsichtige Schritte, bei jedem Schritt federt der Körper hoch.
        pose.legL.rotation.x = s * 0.6 * k;
        pose.legR.rotation.x = -s * 0.6 * k;
        pose.body.position.y += Math.abs(s) * 0.035 * k;
        pose.body.rotation.x = 0.16 * k;
        pose.body.rotation.z = s * 0.06 * k;
        pose.armL.rotation.x = -0.2 * k - s * 0.3 * k;
        pose.armR.rotation.x = Math.sin(w * 2) * 0.06 * k;
        pose.armR.rotation.z = Math.cos(w) * 0.05 * k;
        // Verstohlene Blicke nach links und rechts
        pose.head.rotation.y = Math.sin(ctx.t * 1.1 + ctx.seed * 6) * 0.45;
        pose.head.rotation.x = -0.1 * k;
        A.flinch(pose, ctx, 'body', 0.18);
      },
    });
  },

  // Schnell: Herr mit Zylinder und wehendem Schal auf dem Hochrad, nach vorn geneigt, das große Rad dreht sich.
  'enemy.industrie.hochrad': () => {
    const m = createModel('enemy.industrie.hochrad');
    const R = 0.23;
    const WZ = 0.08;
    const RR = 0.065;
    const RZ = -0.3;
    const bike = m.part('bike', { pivot: [0, 0, 0] });
    // Rückgrat: Bogen um das große Rad, dann gerade zum kleinen Hinterrad
    const rb = R + 0.045;
    /** @type {Vec3[]} */
    const arc = [0.05, 0.75, 1.5].map((a) => /** @type {Vec3} */ ([0, R + rb * Math.cos(a), WZ - rb * Math.sin(a)]));
    for (let i = 0; i < arc.length - 1; i++) limb(bike, arc[i], arc[i + 1], 0.021, 0.021, IRON, { seg: 5, open: true });
    limb(bike, arc[arc.length - 1], [0, RR + 0.02, RZ + 0.01], 0.021, 0.017, IRON, { seg: 5, open: true });
    // Gabel, Lenker, Sattel
    limb(bike, [0.035, R + rb - 0.01, WZ + 0.01], [0.035, R, WZ], 0.016, 0.014, IRON, { seg: 4, mirror: true, open: true });
    bike.cyl({ r: 0.015, h: 0.26, seg: 4, open: true, at: [0, R + rb + 0.01, WZ + 0.03], rot: [0, 0, HALF_PI], color: BRASS });
    bike.cyl({ r: 0.02, h: 0.05, seg: 5, open: true, at: [0.12, R + rb + 0.01, WZ + 0.03], rot: [0, 0, HALF_PI], color: DARK, mirror: true });
    bike.box({ size: [0.07, 0.03, 0.1], at: [0, R + rb + 0.0, WZ - 0.075], rot: [-0.25, 0, 0], color: LEATHER });

    const wheelF = m.part('wheelF', { pivot: [0, R, WZ], parent: 'bike' });
    wheel(wheelF, [0, R, WZ], R, { tube: 0.02, seg: 10, spokes: 3, spoke: STEEL_LIGHT, hubR: 0.03 });
    // Pedale an der Nabe
    wheelF.box({ size: [0.05, 0.02, 0.035], at: [0.07, R + 0.07, WZ], color: DARK });
    wheelF.box({ size: [0.05, 0.02, 0.035], at: [-0.07, R - 0.07, WZ], color: DARK });

    const wheelR = m.part('wheelR', { pivot: [0, RR, RZ], parent: 'bike' });
    wheel(wheelR, [0, RR, RZ], RR, { tube: 0.014, seg: 6, spokes: 1, spoke: STEEL_LIGHT, hub: '' });

    // Fahrer: grüner Frack, cremefarbene Hose, roter Schal, Zylinder
    const SY = R + rb + 0.015;
    const rider = m.part('rider', { pivot: [0, SY, WZ - 0.07], parent: 'bike' });
    rider.cyl({ r: 0.07, rTop: 0.085, h: 0.17, seg: 6, base: [0, SY, WZ - 0.08], rot: [0.4, 0, 0], scale: [1, 1, 0.8], color: COAT, colorTop: COAT_LIGHT });
    rider.box({ size: [0.11, 0.13, 0.02], at: [0, SY - 0.02, WZ - 0.15], rot: [0.25, 0, 0], color: COAT });
    rider.sphere({ r: 0.04, detail: 0, at: [0, SY + 0.11, WZ - 0.0], scale: [1, 1.2, 0.6], color: CREAM });
    rider.torus({ r: 0.05, tube: 0.024, seg: 6, tubeSeg: 3, at: [0, SY + 0.165, WZ - 0.005], rot: [0.4, 0, 0], color: RED });
    // Arme zum Lenker
    limb(rider, [0.075, SY + 0.14, WZ - 0.02], [0.115, SY + 0.02, WZ + 0.03], 0.03, 0.026, COAT, { seg: 5, mirror: true, open: true });

    const head = m.part('head', { pivot: [0, SY + 0.17, WZ + 0.0], parent: 'rider' });
    head.sphere({ r: 0.08, at: [0, SY + 0.24, WZ + 0.02], color: SKIN });
    head.sphere({ r: 0.022, detail: 0, at: [0, SY + 0.235, WZ + 0.1], color: SKIN_DARK });
    head.box({ size: [0.07, 0.024, 0.02], at: [0.033, SY + 0.214, WZ + 0.09], rot: [0, -0.35, 0.3], color: MOUSTACHE, mirror: true });
    head.cyl({ r: 0.11, h: 0.014, seg: 8, at: [0, SY + 0.3, WZ + 0.015], color: TOPHAT, shade: 0 });
    head.cyl({ r: 0.066, rTop: 0.074, h: 0.16, seg: 8, base: [0, SY + 0.3, WZ + 0.015], color: TOPHAT, colorTop: BOWLER_LIGHT });
    head.cyl({ r: 0.069, h: 0.028, seg: 8, open: true, base: [0, SY + 0.315, WZ + 0.015], color: RED, shade: 0 });

    // Schalende weht nach hinten
    const scarf = m.part('scarf', { pivot: [0, SY + 0.17, WZ - 0.04], parent: 'rider' });
    scarf.box({ size: [0.05, 0.014, 0.2], at: [0.02, SY + 0.16, WZ - 0.13], rot: [-0.2, 0.15, 0], color: RED });
    scarf.box({ size: [0.052, 0.016, 0.05], at: [0.035, SY + 0.135, WZ - 0.23], rot: [-0.2, 0.15, 0], color: CREAM });

    // Beine treten die Kurbeln
    for (const [name, side] of /** @type {[string, number][]} */ ([['legL', -1], ['legR', 1]])) {
      const leg = m.part(name, { pivot: [side * 0.05, SY + 0.02, WZ - 0.07], parent: 'bike' });
      /** @type {Vec3} */
      const knee = [side * 0.07, SY - 0.06, WZ + 0.06];
      /** @type {Vec3} */
      const foot = [side * 0.07, R + 0.01, WZ + 0.02];
      limb(leg, [side * 0.05, SY + 0.02, WZ - 0.07], knee, 0.036, 0.03, BUFF, { seg: 5, open: true });
      limb(leg, knee, foot, 0.03, 0.026, BUFF, { seg: 5, open: true });
      leg.sphere({ r: 0.03, detail: 0, at: [foot[0], foot[1] - 0.01, foot[2] + 0.02], scale: [0.9, 0.7, 1.4], color: DARK });
    }

    const stride = TAU * R;
    return m.build({
      stride,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const roll = ctx.walk;
        pose.wheelF.rotation.x = roll;
        pose.wheelR.rotation.x = roll * (R / RR);
        pose.legR.rotation.x = Math.sin(roll + 0.3) * 0.35 * k;
        pose.legL.rotation.x = -Math.sin(roll + 0.3) * 0.35 * k;
        // Wackelig: das Rad schwankt seitlich, der Fahrer gleicht aus.
        const wob = Math.sin(ctx.t * 2.3 + ctx.seed * 6) * 0.06 + Math.sin(roll) * 0.03 * k;
        pose.bike.rotation.z = wob;
        pose.rider.rotation.z = -wob * 0.6;
        pose.rider.rotation.x = 0.22 * k;
        pose.rider.position.y += Math.abs(Math.cos(roll)) * 0.01 * k;
        pose.head.rotation.x = -0.12 * k;
        pose.scarf.rotation.x = 0.15 * k + Math.sin(ctx.t * 9 + ctx.seed * 6) * 0.12;
        pose.scarf.rotation.y = Math.sin(ctx.t * 5 + ctx.seed * 6) * 0.2;
        A.flinch(pose, ctx, 'rider', 0.15);
      },
    });
  },

  // Fliegend, zäh: rot-cremefarben gestreifter Ballon, Weidenkorb an vier Seilen, zwei Melonen schauen heraus, der Brenner flackert.
  'enemy.industrie.ballon': () => {
    const m = createModel('enemy.industrie.ballon');
    const MY = 0.36;
    const env = m.part('envelope', { pivot: [0, MY, 0] });
    /** @type {[number, number][]} */
    const profile = [[0, 0.33], [0.075, 0.36], [0.16, 0.44], [0.255, 0.56], [0.305, 0.68], [0.305, 0.78], [0.265, 0.88], [0.18, 0.955], [0.08, 0.99], [0, 1.0]];
    env.lathe({ points: profile, seg: 8, color: BALLOON, colorTop: BALLOON_LIGHT });
    // Cremefarbene Bahnen auf jeder zweiten Naht
    const rib = profile.slice(2, 7);
    /** @type {[number, number][]} */
    const ribShape = [...rib.map(([r, y]) => /** @type {[number, number]} */ ([r + 0.008, y])), ...rib.slice().reverse().map(([r, y]) => /** @type {[number, number]} */ ([r - 0.03, y]))];
    for (let i = 0; i < 4; i++) {
      env.extrude({ points: ribShape, depth: 0.1, at: [0, 0, 0], rot: [0, (i * HALF_PI), 0], color: STRIPE, shade: 0 });
    }
    env.dome({ r: 0.25, seg: 8, rings: 2, at: [0, 0.885, 0], scale: [1, 0.46, 1], color: STRIPE, shade: 0 });
    env.cyl({ r: 0.09, rTop: 0.1, h: 0.04, seg: 8, open: true, at: [0, 0.37, 0], color: COPPER, shade: 0 });

    const basket = m.part('basket', { pivot: [0, MY, 0], parent: 'envelope' });
    basket.cyl({ r: 0.12, rTop: 0.135, h: 0.12, seg: 4, base: [0, 0.04, 0], rot: [0, Math.PI / 4, 0], color: WICKER_DARK, colorTop: WICKER_LIGHT });
    basket.torus({ r: 0.138, tube: 0.018, seg: 4, tubeSeg: 3, at: [0, 0.16, 0], rot: [0, Math.PI / 4, 0], color: WICKER_DARK });
    for (const [x, z] of [[0.08, 0.08], [0.08, -0.08]]) limb(basket, [x, 0.16, z], [x * 0.85, MY + 0.01, z * 0.85], 0.016, 0.016, ROPE, { seg: 4, mirror: true, open: true });
    basket.sphere({ r: 0.04, detail: 0, at: [0.13, 0.1, 0.0], scale: [0.8, 1.1, 0.8], color: SACK, mirror: true });
    passenger(basket, [0.05, 0.19, 0.01], 0.048, true);
    basket.cyl({ r: 0.035, rTop: 0.045, h: 0.04, seg: 6, base: [0, 0.27, 0], color: BRASS });

    const flame = m.part('flame', { pivot: [0, 0.31, 0], parent: 'basket' });
    flame.cone({ r: 0.04, h: 0.1, seg: 6, base: [0, 0.305, 0], color: FIRE, colorTop: FIRE_LIGHT, glow: true });

    return m.build({
      stride: 0.8,
      animate(pose, ctx) {
        const t = ctx.t + ctx.seed * 7;
        // Gemächliches Auf und Ab, leichtes Schwanken; der Korb pendelt hinterher.
        pose.envelope.position.y += Math.sin(t * 1.4) * 0.035;
        pose.envelope.rotation.z = Math.sin(t * 0.9) * 0.06;
        pose.envelope.rotation.x = Math.sin(t * 0.7 + 1) * 0.04;
        pose.envelope.rotation.y = t * 0.15;
        pose.basket.rotation.z = -Math.sin(t * 0.9 - 0.6) * 0.08;
        pose.basket.rotation.x = -Math.sin(t * 0.7 + 0.4) * 0.06;
        // Brenner flackert
        const f = 0.85 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
        pose.flame.scale.set(f, f * (0.9 + Math.sin(t * 11) * 0.25), f);
        A.flinch(pose, ctx, 'envelope', 0.12);
      },
    });
  },

  // Träger, gepanzert: genieteter Eisenwagen mit Kupferkessel, Schornstein und Kupferdach, darunter vier Halunken.
  'enemy.industrie.dampfwagen': () => {
    const m = createModel('enemy.industrie.dampfwagen');
    const RB = 0.16;
    const ZB = -0.2;
    const RF = 0.12;
    const ZF = 0.25;

    const body = m.part('body', { pivot: [0, 0.22, 0] });
    // Wanne aus Eisenplatten, oval, mit Messingkante
    body.cyl({ r: 0.2, rTop: 0.22, h: 0.2, seg: 8, base: [0, 0.16, -0.07], rot: [0, Math.PI / 8, 0], scale: [1, 1, 1.45], color: HULL, colorTop: HULL_LIGHT });
    body.cyl({ r: 0.226, h: 0.03, seg: 8, open: true, base: [0, 0.335, -0.07], rot: [0, Math.PI / 8, 0], scale: [1, 1, 1.45], color: BRASS, shade: 0 });
    body.cyl({ r: 0.208, h: 0.035, seg: 8, open: true, base: [0, 0.2, -0.07], rot: [0, Math.PI / 8, 0], scale: [1, 1, 1.45], color: STEEL, shade: 0 });
    // Panzerplatte an jeder Seite, Achsen
    body.box({ size: [0.014, 0.1, 0.2], at: [0.198, 0.275, -0.07], color: STEEL, colorTop: STEEL_LIGHT, mirror: true });
    body.cyl({ r: 0.02, h: 0.5, seg: 4, open: true, at: [0, RB, ZB], rot: [0, 0, HALF_PI], color: DARK });
    body.cyl({ r: 0.02, h: 0.44, seg: 4, open: true, at: [0, RF, ZF], rot: [0, 0, HALF_PI], color: DARK });
    body.box({ size: [0.05, 0.05, 0.2], at: [0, RF + 0.04, ZF - 0.04], color: IRON });
    // Kupferkessel vorn mit Messingringen
    body.cyl({ r: 0.11, h: 0.26, seg: 8, at: [0, 0.31, 0.3], rot: [HALF_PI, 0, 0], color: COPPER, shade: 0 });
    for (const z of [0.23, 0.37]) body.cyl({ r: 0.116, h: 0.025, seg: 8, open: true, at: [0, 0.31, z], rot: [HALF_PI, 0, 0], color: BRASS, shade: 0 });
    body.cyl({ r: 0.085, h: 0.02, seg: 6, at: [0, 0.31, 0.435], rot: [HALF_PI, 0, 0], color: IRON, shade: 0 });
    body.sphere({ r: 0.03, detail: 0, at: [0, 0.31, 0.45], color: LAMP, glow: true });
    // Schornstein
    body.cyl({ r: 0.035, rTop: 0.05, h: 0.2, seg: 6, open: true, base: [0, 0.39, 0.36], color: IRON, colorTop: IRON_LIGHT });
    body.cyl({ r: 0.056, h: 0.035, seg: 6, open: true, base: [0, 0.575, 0.36], color: BRASS, shade: 0 });
    // Dach auf vier Messingstangen
    for (const [x, z] of [[0.15, 0.06], [0.15, -0.31]]) body.cyl({ r: 0.015, h: 0.25, seg: 4, open: true, base: [x, 0.33, z], color: BRASS, mirror: true });
    body.cyl({ r: 0.21, h: 0.46, seg: 8, at: [0, 0.63, -0.12], rot: [HALF_PI, 0, 0], scale: [1, 1, 0.36], color: COPPER, shade: 0 });

    // Vier Halunken als Fracht
    const crew = m.part('crew', { pivot: [0, 0.36, -0.12], parent: 'body' });
    passenger(crew, [0.085, 0.45, -0.02], 0.056, true);
    // Die hinteren zwei ducken sich, nur die Melonen schauen über den Rand.
    bowler(crew, [0.085, 0.4, -0.22], 0.05, { mirror: true, seg: 6, band: false });

    // Räder
    wheel(m.part('wheelsB', { pivot: [0, RB, ZB] }), [0.25, RB, ZB], RB, { tube: 0.024, seg: 8, spokes: 2, hub: '', mirror: true });
    wheel(m.part('wheelsF', { pivot: [0, RF, ZF] }), [0.22, RF, ZF], RF, { tube: 0.022, seg: 6, spokes: 2, hub: '', mirror: true });

    // Dampfwölkchen aus dem Schornstein
    const puff = m.part('puff', { pivot: [0, 0.62, 0.36], parent: 'body' });
    puff.sphere({ r: 0.06, detail: 0, at: [0, 0.64, 0.36], color: SMOKE });
    puff.sphere({ r: 0.045, detail: 0, at: [0.03, 0.68, 0.33], color: SMOKE });

    const stride = 0.9;
    return m.build({
      stride,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const dist = (ctx.walk / TAU) * stride;
        pose.wheelsB.rotation.x = dist / RB;
        pose.wheelsF.rotation.x = dist / RF;
        // Tuckern: der Wagen hüpft zweimal je Zyklus, die Fahrgäste wippen nach.
        pose.body.position.y += Math.abs(Math.sin(ctx.walk * 2)) * 0.012 * k;
        pose.body.rotation.x = Math.sin(ctx.walk * 2) * 0.015 * k;
        pose.body.rotation.z = Math.sin(ctx.t * 1.3 + ctx.seed * 6) * 0.02;
        pose.crew.position.y += Math.abs(Math.sin(ctx.walk * 2 - 0.8)) * 0.018 * k;
        pose.crew.rotation.z = Math.sin(ctx.t * 1.7 + ctx.seed * 6) * 0.05;
        puffCycle(pose.puff, ctx.walk / Math.PI + ctx.t * 0.3, 0.22, 0.12 * k, 1.1);
        A.flinch(pose, ctx, 'body', 0.08);
      },
    });
  },

  // Boss, gepanzert, Träger: die Dampflok "Schwarze Berta" mit Tender. Schwarzgrüner Kessel mit Messingbändern,
  // roter Schienenräumer, sechs rote Treibräder mit Kuppelstange, Dampf aus dem Schlot, Halunken auf der Kohle.
  'boss.industrie.berta': () => {
    const m = createModel('boss.industrie.berta');
    const R = 0.15;
    const WX = 0.27;
    const ZS = [0.27, -0.03, -0.33];
    const C = 0.055;

    const body = m.part('body', { pivot: [0, 0.25, 0] });
    // Rahmen und Umlaufblech
    body.box({ size: [0.34, 0.12, 1.1], at: [0, 0.22, -0.03], color: RED, shade: 0.2 });
    body.box({ size: [0.66, 0.03, 1.04], at: [0, 0.325, -0.05], color: BERTA_DARK, shade: 0 });
    // Pufferbohle und Schienenräumer
    body.box({ size: [0.6, 0.09, 0.05], at: [0, 0.27, 0.53], color: RED, colorTop: RED_LIGHT });
    body.cyl({ r: 0.035, h: 0.06, seg: 6, at: [0.2, 0.27, 0.585], rot: [HALF_PI, 0, 0], color: BRASS, mirror: true });
    body.wedge({ size: [0.5, 0.19, 0.16], base: [0, 0.03, 0.6], rot: [0, Math.PI, 0], color: RED, colorTop: RED_LIGHT });
    for (const x of [0.065, 0.19]) body.box({ size: [0.035, 0.24, 0.02], at: [x, 0.133, 0.609], rot: [-0.7, 0, 0], color: BERTA_DARK, mirror: true });
    // Kessel
    body.cyl({ r: 0.17, h: 0.6, seg: 10, at: [0, 0.5, 0.17], rot: [HALF_PI, 0, 0], color: BERTA, shade: 0 });
    for (const z of [-0.06, 0.12, 0.3]) body.cyl({ r: 0.176, h: 0.03, seg: 10, open: true, at: [0, 0.5, z], rot: [HALF_PI, 0, 0], color: BRASS, shade: 0 });
    // Rauchkammer mit Tür und Laterne
    body.cyl({ r: 0.178, h: 0.07, seg: 10, at: [0, 0.5, 0.49], rot: [HALF_PI, 0, 0], color: BERTA_DARK, shade: 0 });
    body.cyl({ r: 0.13, h: 0.02, seg: 8, at: [0, 0.5, 0.53], rot: [HALF_PI, 0, 0], color: BRASS_LIGHT, shade: 0 });
    body.cyl({ r: 0.105, h: 0.02, seg: 8, at: [0, 0.5, 0.537], rot: [HALF_PI, 0, 0], color: BERTA_LIGHT, shade: 0 });
    body.box({ size: [0.09, 0.09, 0.07], at: [0, 0.715, 0.48], color: BRASS });
    body.cyl({ r: 0.035, h: 0.012, seg: 8, at: [0, 0.715, 0.518], rot: [HALF_PI, 0, 0], color: LAMP, glow: true });
    // Schlot mit Kupferkrone
    body.cyl({ r: 0.06, rTop: 0.07, h: 0.24, seg: 8, open: true, base: [0, 0.64, 0.36], color: BERTA, colorTop: BERTA_LIGHT });
    body.cyl({ r: 0.07, rTop: 0.11, h: 0.08, seg: 8, base: [0, 0.88, 0.36], color: BERTA_LIGHT });
    body.cyl({ r: 0.116, h: 0.03, seg: 8, open: true, base: [0, 0.945, 0.36], color: COPPER_LIGHT, shade: 0 });
    // Messingdom und Pfeife
    body.cyl({ r: 0.07, rTop: 0.065, h: 0.06, seg: 8, base: [0, 0.65, 0.12], color: BRASS });
    body.dome({ r: 0.068, seg: 8, rings: 3, at: [0, 0.71, 0.12], color: BRASS, colorTop: BRASS_LIGHT });
    body.cyl({ r: 0.018, h: 0.09, seg: 6, base: [0, 0.66, -0.09], color: BRASS });
    body.cone({ r: 0.03, h: 0.05, seg: 6, base: [0, 0.75, -0.09], color: BRASS_LIGHT });
    // Zylinder seitlich vorn
    body.cyl({ r: 0.065, h: 0.17, seg: 6, at: [0.27, 0.3, 0.42], rot: [HALF_PI, 0, 0], color: BERTA, shade: 0, mirror: true });
    body.cyl({ r: 0.069, h: 0.025, seg: 6, open: true, at: [0.27, 0.3, 0.49], rot: [HALF_PI, 0, 0], color: BRASS, shade: 0, mirror: true });
    // Führerhaus
    body.box({ size: [0.6, 0.42, 0.3], base: [0, 0.34, -0.3], color: BERTA, colorTop: BERTA_LIGHT });
    body.box({ size: [0.612, 0.03, 0.31], at: [0, 0.48, -0.3], color: BRASS });
    body.box({ size: [0.612, 0.14, 0.14], at: [0, 0.64, -0.27], color: DARK });
    body.cyl({ r: 0.045, h: 0.02, seg: 8, at: [0.15, 0.64, -0.145], rot: [HALF_PI, 0, 0], color: LAMP, glow: true, mirror: true });
    body.cyl({ r: 0.37, h: 0.38, seg: 10, at: [0, 0.765, -0.3], rot: [HALF_PI, 0, 0], scale: [1, 1, 0.24], color: BERTA_LIGHT, shade: 0 });
    body.box({ size: [0.03, 0.03, 0.39], at: [0.33, 0.77, -0.3], rot: [0, 0, -0.35], color: BRASS, mirror: true });
    body.cyl({ r: 0.375, h: 0.03, seg: 10, at: [0, 0.765, -0.12], rot: [HALF_PI, 0, 0], scale: [1, 1, 0.26], color: BRASS, shade: 0 });
    // Tender mit Kohle
    body.box({ size: [0.56, 0.24, 0.22], base: [0, 0.3, -0.585], color: BERTA, colorTop: BERTA_LIGHT });
    body.box({ size: [0.575, 0.03, 0.235], at: [0, 0.53, -0.585], color: BRASS });
    body.cone({ r: 0.2, h: 0.12, seg: 6, base: [0, 0.5, -0.585], scale: [1.25, 1, 0.55], color: COAL, colorTop: COAL_LIGHT, faceJitter: 0.1 });
    body.sphere({ r: 0.03, detail: 0, at: [0.2, 0.39, -0.7], color: RED_LIGHT, glow: true, mirror: true });

    // Halunken: einer im Führerhaus, zwei auf der Kohle
    const crew = m.part('crew', { pivot: [0, 0.55, -0.4], parent: 'body' });
    passenger(crew, [0.12, 0.6, -0.56], 0.06, true);
    passenger(crew, [0.27, 0.62, -0.27], 0.065);

    // Treibräder und Kuppelstange
    ZS.forEach((z, i) => {
      const w = m.part(`wheels${i}`, { pivot: [0, R, z] });
      wheel(w, [WX, R, z], R, { tube: 0.026, seg: 10, spokes: 3, rim: DARK, spoke: RED, hub: BRASS, hubR: 0.04, mirror: true });
      w.box({ size: [0.024, 0.024, 0.024], at: [WX + 0.04, R, z + C], color: STEEL_LIGHT, mirror: true });
    });
    const rods = m.part('rods', { pivot: [0, R, 0] });
    rods.box({ size: [0.024, 0.032, ZS[0] - ZS[2] + 0.07], at: [WX + 0.055, R, (ZS[0] + ZS[2]) / 2 + C], color: STEEL_LIGHT, mirror: true });

    // Dampf aus dem Schlot (zwei versetzte Wolken) und aus den Zylindern (ab halber Kraft)
    const puffA = m.part('puffA', { pivot: [0, 1.0, 0.36], parent: 'body' });
    puffA.sphere({ r: 0.09, detail: 0, at: [0, 1.02, 0.36], color: SMOKE });
    puffA.sphere({ r: 0.065, detail: 0, at: [0.05, 1.07, 0.32], color: SMOKE });
    const puffB = m.part('puffB', { pivot: [0, 1.0, 0.36], parent: 'body' });
    puffB.sphere({ r: 0.08, detail: 0, at: [0, 1.02, 0.36], color: WHITE });
    puffB.sphere({ r: 0.06, detail: 0, at: [-0.05, 1.06, 0.38], color: SMOKE });
    const vent = m.part('vent', { pivot: [0, 0.3, 0.44], parent: 'body' });
    vent.sphere({ r: 0.075, detail: 0, at: [0.37, 0.32, 0.46], color: WHITE, mirror: true });
    vent.sphere({ r: 0.06, detail: 0, at: [0.45, 0.41, 0.38], color: SMOKE, mirror: true });

    const stride = 0.8;
    return m.build({
      stride,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const roll = (ctx.walk / TAU) * stride / R;
        pose.wheels0.rotation.x = roll;
        pose.wheels1.rotation.x = roll;
        pose.wheels2.rotation.x = roll;
        pose.rods.position.y -= C * Math.sin(roll);
        pose.rods.position.z += C * (Math.cos(roll) - 1);
        // Schweres Stampfen
        pose.body.position.y += Math.abs(Math.sin(roll)) * 0.008 * k;
        pose.body.rotation.z = Math.sin(ctx.t * 1.1 + ctx.seed * 6) * 0.012;
        pose.crew.position.y += Math.abs(Math.sin(roll + 0.6)) * 0.02 * k;
        pose.crew.rotation.y = Math.sin(ctx.t * 0.8 + ctx.seed * 6) * 0.15;
        // Tschu-tschu: zwei Wolken je Radumdrehung
        const ph = roll / Math.PI + ctx.t * 0.25;
        puffCycle(pose.puffA, ph, 0.35, 0.25 * k, 1.2);
        puffCycle(pose.puffB, ph + 0.5, 0.35, 0.25 * k, 1.1);
        // Ab halber Kraft zischt Dampf seitlich aus den Zylindern.
        if (ctx.hp < 0.5) {
          const v = 1 + Math.sin(ctx.t * 13) * 0.12;
          pose.vent.scale.setScalar(v);
        } else {
          pose.vent.scale.setScalar(1e-4);
        }
        A.flinch(pose, ctx, 'body', 0.08);
      },
    });
  },
};
