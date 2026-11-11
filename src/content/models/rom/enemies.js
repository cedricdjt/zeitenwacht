// @ts-check
// Gegner des Römischen Reichs: die abtrünnige Legion in Dunkelgrün und Bronze.
// Plänkler (Standard), Reiter (schnell), Legionär (gepanzert), Schildkröten-Trupp (gepanzert, zäh)
// und der Boss "Feldherr im Triumphwagen".

import * as THREE from 'three';
import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Pose, AnimCtx, Vec3 } from '../../../types/model' */
/** @import { PartBuilder, ModelBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der abtrünnigen Legion ---
const GREEN = '#2f6b4f';
const GREEN_DARK = '#234f3b';
const GREEN_LIGHT = '#3f8c66';
const GREEN_BRIGHT = '#58b07c';
const BRONZE = '#b07a38';
const BRONZE_LIGHT = '#d9a85a';
const GOLD = '#e0b03a';
const GOLD_LIGHT = '#f4d476';
const GOLD_DARK = '#b98a26';
const STEEL = '#a9b3bd';
const STEEL_LIGHT = '#dbe1e6';
const STEEL_DARK = '#7b8590';
const SKIN = '#e3b48d';
const TUNIC = '#d9c7a0';
const TUNIC_LIGHT = '#f0e5c8';
const CREAM = '#f0e2b4';
const LEATHER = '#8a5a35';
const LEATHER_DARK = '#5e3d26';
const WOOD = '#9a6b3f';
const HAIR = '#4a3324';
const DARK = '#2a2420';
const HORSE = '#8b5e3c';
const HORSE_DARK = '#5a3a25';
const HORSE_LIGHT = '#a97a50';
const WHITE = '#f2ecde';
const WHITE_SHADE = '#cfc5b0';
const MANE_GREY = '#b9ae9a';

/**
 * Setzt einen (verjüngten) Zylinder zwischen zwei Punkte im Modellraum.
 * @param {PartBuilder} part
 * @param {Vec3} a Anfang (Radius r0)
 * @param {Vec3} b Ende (Radius r1)
 * @param {number} r0
 * @param {number} r1
 * @param {string} color
 * @param {{ seg?: number, colorTop?: string, mirror?: boolean }} [o]
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
    color, colorTop: o.colorTop, mirror: o.mirror,
  });
}

/**
 * Zwei Soldatenbeine (Teile `legL`, `legR`) mit Sandale und Fußspitze nach vorn.
 * @param {ModelBuilder} m
 * @param {number} x seitlicher Abstand
 * @param {number} hip Hüfthöhe
 * @param {string} boot Farbe des Schuhwerks
 */
function soldierLegs(m, x, hip, boot) {
  for (const [name, sx] of /** @type {[string, number][]} */ ([['legL', -x], ['legR', x]])) {
    const leg = m.part(name, { pivot: [sx, hip, 0] });
    leg.cyl({ r: 0.036, rTop: 0.05, h: hip + 0.03, seg: 6, base: [sx, 0, 0], color: SKIN });
    leg.cyl({ r: 0.045, rTop: 0.042, h: 0.055, seg: 6, base: [sx, 0, 0], color: boot });
    leg.box({ size: [0.07, 0.035, 0.07], base: [sx, 0, 0.04], color: boot });
  }
}

// Hilfsgrößen für gedrehte Schilde (nur beim Bauen benutzt, nie in animate).
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpE = new THREE.Euler();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/**
 * Rechteckiger Schild mit Bronzerand und Buckel. Steht in Ruhe aufrecht und blickt nach +Z,
 * wird erst um seine Querachse gekippt (`tilt`, negativ = Oberkante nach hinten) und dann um Y gedreht (`yaw`).
 * @param {PartBuilder} part
 * @param {Vec3} origin Mitte des Schilds im Modellraum
 * @param {number} yaw
 * @param {number} tilt
 * @param {number} w Breite
 * @param {number} h Höhe
 * @param {string} face Farbe der Schildfläche
 */
function shield(part, origin, yaw, tilt, w, h, face) {
  tmpQ.setFromAxisAngle(AXIS_Y, yaw);
  tmpQ2.setFromAxisAngle(AXIS_X, tilt);
  tmpQ.multiply(tmpQ2);
  tmpE.setFromQuaternion(tmpQ, 'XYZ');
  /** @type {Vec3} */
  const rot = [tmpE.x, tmpE.y, tmpE.z];
  /** @param {number} x @param {number} y @param {number} z @returns {Vec3} */
  const at = (x, y, z) => {
    tmpV.set(x, y, z).applyQuaternion(tmpQ);
    return [origin[0] + tmpV.x, origin[1] + tmpV.y, origin[2] + tmpV.z];
  };
  part.box({ size: [w, h, 0.022], at: at(0, 0, 0), rot, color: BRONZE, shade: 0 });
  part.box({ size: [w - 0.045, h - 0.045, 0.03], at: at(0, 0, 0.005), rot, color: face, shade: 0 });
  part.box({ size: [w - 0.045, 0.035, 0.034], at: at(0, 0, 0.005), rot, color: CREAM, shade: 0 });
  part.sphere({ r: 0.05, detail: 0, scale: [1, 1, 0.55], at: at(0, 0, 0.022), rot, color: BRONZE_LIGHT });
}

/**
 * @typedef {{ body: string, head: string, tail: string, legFL: string, legFR: string, legBL: string, legBR: string }} HorseNames
 * @typedef {{ coat: string, coatTop: string, dark: string, mane: string }} HorseColors
 */

/**
 * Baut ein Pferd: Rumpf, Hals mit Kopf, Schweif und vier geknickte Beine.
 * @param {ModelBuilder} m
 * @param {HorseNames} n Teilnamen
 * @param {number} ox seitliche Lage
 * @param {number} oz Lage nach vorn
 * @param {number} s Maßstab
 * @param {HorseColors} c
 * @returns {PartBuilder} das Rumpfteil
 */
function horse(m, n, ox, oz, s, c) {
  /** @param {number} x @param {number} y @param {number} z @returns {Vec3} */
  const P = (x, y, z) => [ox + x * s, y * s, oz + z * s];
  const body = m.part(n.body, { pivot: P(0, 0.36, -0.02) });
  body.sphere({ r: 0.14 * s, at: P(0, 0.37, -0.04), scale: [0.88, 0.84, 1.7], color: c.coat, colorTop: c.coatTop });
  body.sphere({ r: 0.118 * s, at: P(0, 0.39, 0.13), scale: [0.95, 1, 1], color: c.coat, colorTop: c.coatTop });
  body.sphere({ r: 0.118 * s, detail: 0, at: P(0, 0.385, -0.2), scale: [0.98, 0.95, 0.9], color: c.coat, colorTop: c.coatTop });

  const head = m.part(n.head, { pivot: P(0, 0.42, 0.16), parent: n.body });
  limb(head, P(0, 0.38, 0.15), P(0, 0.63, 0.3), 0.085 * s, 0.055 * s, c.coat, { colorTop: c.coatTop });
  head.sphere({ r: 0.07 * s, detail: 0, at: P(0, 0.645, 0.31), color: c.coatTop });
  limb(head, P(0, 0.645, 0.31), P(0, 0.535, 0.47), 0.062 * s, 0.038 * s, c.coatTop, { colorTop: c.coat });
  head.sphere({ r: 0.039 * s, detail: 0, at: P(0, 0.533, 0.473), color: c.dark });
  // Mähne als dunkler Kamm auf dem Hals
  head.box({ size: [0.035 * s, 0.07 * s, 0.25 * s], at: P(0, 0.565, 0.2), rot: [-0.92, 0, 0], color: c.mane });
  for (const sx of [-1, 1]) {
    head.pyramid({ size: [0.04 * s, 0.075 * s, 0.03 * s], base: P(0.04 * sx, 0.69, 0.285), rot: [0.1, 0, -0.2 * sx], color: c.coat });
    head.box({ size: [0.016 * s, 0.028 * s, 0.028 * s], at: P(0.056 * sx, 0.635, 0.36), color: DARK });
  }

  const tail = m.part(n.tail, { pivot: P(0, 0.44, -0.29), parent: n.body });
  tail.cone({ r: 0.05 * s, h: 0.26 * s, seg: 5, base: P(0, 0.45, -0.27), rot: [-2.25, 0, 0], color: c.mane });

  /** @type {[string, number, number, number][]} */
  const legs = [[n.legFL, -0.07, 0.13, 1], [n.legFR, 0.07, 0.13, 1], [n.legBL, -0.07, -0.19, -1], [n.legBR, 0.07, -0.19, -1]];
  for (const [name, x, z, front] of legs) {
    const leg = m.part(name, { pivot: P(x, 0.31, z) });
    const knee = front > 0 ? P(x, 0.16, z + 0.03) : P(x, 0.17, z - 0.04);
    limb(leg, P(x, 0.33, z), knee, 0.05 * s, 0.03 * s, c.coat);
    leg.sphere({ r: 0.032 * s, detail: 0, at: knee, color: c.coat });
    limb(leg, knee, P(x, 0.03, z + (front > 0 ? 0 : 0.01)), 0.029 * s, 0.025 * s, c.coat);
    leg.cyl({ r: 0.036 * s, rTop: 0.03 * s, h: 0.045 * s, seg: 6, base: P(x, 0, z + (front > 0 ? 0 : 0.01)), color: c.dark });
  }
  return body;
}

/**
 * Gangart eines Pferds. `gallop` 1 = gestreckter Galopp (Beinpaare vorn/hinten), 0 = Trab (diagonale Paare).
 * @param {Pose} pose
 * @param {HorseNames} n
 * @param {AnimCtx} ctx
 * @param {number} phase Phasenversatz in Radiant
 * @param {boolean} gallop
 */
function horseGait(pose, n, ctx, phase, gallop) {
  const k = Math.min(1, ctx.move);
  const w = ctx.walk + phase;
  const s = Math.sin(w);
  const c = Math.cos(w);
  const body = pose[n.body];
  const head = pose[n.head];
  const tail = pose[n.tail];
  if (gallop) {
    const s2 = Math.sin(w - 0.4);
    pose[n.legFL].rotation.x = (s * 0.68 - 0.1) * k;
    pose[n.legFR].rotation.x = (s2 * 0.68 - 0.1) * k;
    pose[n.legBL].rotation.x = (-s * 0.62 + 0.1) * k;
    pose[n.legBR].rotation.x = (-s2 * 0.62 + 0.1) * k;
    body.rotation.x = c * 0.11 * k;
    body.position.y += (0.5 - 0.5 * Math.cos(w + 0.8)) * 0.045 * k;
    head.rotation.x = (0.18 - c * 0.12) * k;
    tail.rotation.x = (-0.55 + c * 0.2) * k;
  } else {
    pose[n.legFL].rotation.x = s * 0.6 * k;
    pose[n.legBR].rotation.x = s * 0.55 * k;
    pose[n.legFR].rotation.x = -s * 0.6 * k;
    pose[n.legBL].rotation.x = -s * 0.55 * k;
    body.position.y += Math.abs(c) * 0.03 * k;
    head.rotation.x = Math.sin(w * 2) * 0.09 * k - 0.06;
    tail.rotation.x = -0.15 * k + Math.sin(w * 2) * 0.08 * k;
  }
  tail.rotation.y = Math.sin(ctx.t * 2.1 + ctx.seed * 6 + phase) * 0.22;
}

/** @type {HorseNames} */
const REITER_HORSE = { body: 'body', head: 'head', tail: 'tail', legFL: 'legFL', legFR: 'legFR', legBL: 'legBL', legBR: 'legBR' };
/** @type {HorseNames} */
const BOSS_HORSE_L = { body: 'horseL', head: 'headL', tail: 'tailL', legFL: 'legFL1', legFR: 'legFR1', legBL: 'legBL1', legBR: 'legBR1' };
/** @type {HorseNames} */
const BOSS_HORSE_R = { body: 'horseR', head: 'headR', tail: 'tailR', legFL: 'legFL2', legFR: 'legFR2', legBL: 'legBL2', legBR: 'legBR2' };
/** @type {HorseColors} */
const BROWN_COAT = { coat: HORSE, coatTop: HORSE_LIGHT, dark: HORSE_DARK, mane: DARK };
/** @type {HorseColors} */
const WHITE_COAT = { coat: WHITE_SHADE, coatTop: WHITE, dark: '#6d655a', mane: MANE_GREY };

// Feste Optionen für die Laufzyklen (damit animate nichts alloziert).
const WALK_JOG = { swing: 0.85, armSwing: 0.3, bob: 0.035, sway: 0.05 };
const WALK_MARCH = { swing: 0.55, armSwing: 0, bob: 0.018, sway: 0.02 };

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Standard: Plänkler in heller Tunika mit Lederkappe, kleinem Rundschild und Wurfspeer; lockerer Trab.
  'enemy.rom.plaenkler': () => {
    const m = createModel('enemy.rom.plaenkler');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    body.cyl({ r: 0.138, rTop: 0.098, h: 0.22, seg: 7, base: [0, 0.12, 0], scale: [1, 1, 0.8], color: TUNIC, colorTop: TUNIC_LIGHT });
    body.cyl({ r: 0.123, rTop: 0.117, h: 0.035, seg: 7, at: [0, 0.225, 0], scale: [1, 1, 0.8], color: LEATHER });
    // Schulterriemen
    body.box({ size: [0.04, 0.03, 0.165], at: [0.045, 0.335, 0], rot: [0, 0, -0.25], color: LEATHER });

    const head = m.part('head', { pivot: [0, 0.34, 0], parent: 'body' });
    head.sphere({ r: 0.115, at: [0, 0.45, 0.01], color: SKIN });
    head.dome({ r: 0.124, seg: 7, rings: 2, at: [0, 0.468, -0.005], color: LEATHER, colorTop: '#a8733f' });
    head.sphere({ r: 0.028, detail: 0, at: [0, 0.596, -0.005], color: LEATHER_DARK });
    head.box({ size: [0.026, 0.03, 0.014], at: [0.042, 0.447, 0.118], color: DARK, mirror: true });

    soldierLegs(m, 0.062, 0.13, LEATHER);

    // Linker Arm trägt den Rundschild, leicht nach oben gekippt, damit man ihn von oben sieht.
    const armL = m.part('armL', { pivot: [-0.13, 0.32, 0], parent: 'body' });
    limb(armL, [-0.13, 0.32, 0], [-0.17, 0.24, 0.06], 0.034, 0.03, SKIN, { seg: 5 });
    armL.cyl({ r: 0.125, h: 0.024, seg: 8, at: [-0.2, 0.25, 0.06], rot: [0, 0, 1.15], color: GREEN });
    armL.cyl({ r: 0.092, h: 0.024, seg: 8, at: [-0.209, 0.254, 0.06], rot: [0, 0, 1.15], color: CREAM });
    armL.sphere({ r: 0.042, detail: 0, at: [-0.222, 0.26, 0.06], color: BRONZE_LIGHT });

    // Rechter Arm hält den Wurfspeer waagerecht nach vorn.
    const armR = m.part('armR', { pivot: [0.13, 0.32, 0], parent: 'body' });
    limb(armR, [0.13, 0.32, 0], [0.175, 0.3, -0.07], 0.034, 0.03, SKIN, { seg: 5 });
    armR.sphere({ r: 0.036, detail: 0, at: [0.178, 0.305, -0.07], color: SKIN });
    limb(armR, [0.178, 0.29, -0.3], [0.178, 0.34, 0.24], 0.017, 0.017, WOOD, { seg: 5 });
    limb(armR, [0.178, 0.34, 0.24], [0.178, 0.353, 0.38], 0.03, 0.004, STEEL_LIGHT, { seg: 5 });

    return m.build({
      stride: 0.5,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_JOG);
        pose.body.rotation.x = 0.13 * k;
        pose.head.rotation.x = -0.08 * k;
        // Der Speerarm federt nur leicht, statt zu schwingen.
        pose.armR.rotation.x = Math.sin(ctx.walk * 2) * 0.07 * k - 0.05 * k;
        pose.armL.rotation.x = -Math.sin(ctx.walk) * 0.18 * k;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Schnell: Reiter auf braunem Pferd im gestreckten Galopp, grüner Umhang flattert hinterher.
  'enemy.rom.reiter': () => {
    const m = createModel('enemy.rom.reiter');
    const body = horse(m, REITER_HORSE, 0, 0, 1, BROWN_COAT);
    // Satteldecke
    body.sphere({ r: 0.14, detail: 0, at: [0, 0.4, -0.05], scale: [0.93, 0.8, 0.85], color: GREEN_DARK });

    const rider = m.part('rider', { pivot: [0, 0.47, -0.04], parent: 'body' });
    rider.cyl({ r: 0.1, rTop: 0.085, h: 0.18, seg: 7, base: [0, 0.46, -0.04], rot: [0.22, 0, 0], scale: [1, 1, 0.82], color: TUNIC, colorTop: TUNIC_LIGHT });
    limb(rider, [0.085, 0.47, -0.02], [0.12, 0.33, 0.04], 0.04, 0.034, SKIN, { seg: 5, mirror: true });
    rider.sphere({ r: 0.1, at: [0, 0.725, 0.03], color: SKIN });
    rider.dome({ r: 0.108, seg: 7, rings: 2, at: [0, 0.74, 0.02], color: BRONZE, colorTop: BRONZE_LIGHT });
    rider.cone({ r: 0.035, h: 0.1, seg: 5, base: [0, 0.83, 0.0], rot: [-0.5, 0, 0], color: GREEN_BRIGHT });
    rider.box({ size: [0.024, 0.026, 0.014], at: [0.037, 0.722, 0.122], color: DARK, mirror: true });
    // Arme: links am Zügel, rechts die Lanze nach vorn
    limb(rider, [-0.1, 0.62, 0.0], [-0.07, 0.52, 0.13], 0.03, 0.028, SKIN, { seg: 5 });
    limb(rider, [0.1, 0.62, 0.0], [0.14, 0.52, 0.06], 0.03, 0.028, SKIN, { seg: 5 });
    limb(rider, [0.145, 0.49, -0.2], [0.145, 0.55, 0.4], 0.017, 0.017, WOOD, { seg: 5 });
    limb(rider, [0.145, 0.55, 0.4], [0.145, 0.564, 0.54], 0.03, 0.004, STEEL_LIGHT, { seg: 5 });

    // Umhang in zwei Gliedern, weht waagerecht nach hinten.
    const cape1 = m.part('cape1', { pivot: [0, 0.63, -0.07], parent: 'rider' });
    cape1.box({ size: [0.2, 0.025, 0.17], at: [0, 0.625, -0.15], color: GREEN, colorTop: GREEN_LIGHT, shade: 0 });
    const cape2 = m.part('cape2', { pivot: [0, 0.625, -0.23], parent: 'cape1' });
    cape2.extrude({ points: [[-0.1, 0], [0.1, 0], [0.14, 0.2], [0, 0.16], [-0.14, 0.2]], depth: 0.022, at: [0, 0.625, -0.23], rot: [-Math.PI / 2, 0, 0], color: GREEN_LIGHT, shade: 0 });

    return m.build({
      stride: 0.9,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        horseGait(pose, REITER_HORSE, ctx, 0, true);
        pose.rider.rotation.x = (0.1 - Math.cos(ctx.walk) * 0.08) * k;
        const f = ctx.t * 9 + ctx.seed * 6;
        pose.cape1.rotation.x = -0.75 + 0.75 * k + Math.sin(f) * (0.05 + 0.1 * k);
        pose.cape2.rotation.x = -0.3 + 0.28 * k + Math.sin(f - 1.1) * (0.06 + 0.2 * k);
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Gepanzert: Legionär mit silbernem Schienenpanzer, hohem gewölbtem Schild, Helmbusch und Pilum; marschiert im Gleichschritt.
  'enemy.rom.legionaer': () => {
    const m = createModel('enemy.rom.legionaer');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    body.cyl({ r: 0.14, rTop: 0.115, h: 0.1, seg: 7, base: [0, 0.115, 0], scale: [1, 1, 0.82], color: GREEN_DARK, colorTop: GREEN });
    // Schienenpanzer: drei Reifen, nach oben breiter
    body.cyl({ r: 0.122, rTop: 0.128, h: 0.06, seg: 7, base: [0, 0.2, 0], scale: [1, 1, 0.84], color: STEEL_DARK, colorTop: STEEL });
    body.cyl({ r: 0.132, rTop: 0.138, h: 0.055, seg: 7, base: [0, 0.255, 0], scale: [1, 1, 0.84], color: STEEL, colorTop: STEEL_LIGHT });
    body.cyl({ r: 0.142, rTop: 0.13, h: 0.05, seg: 7, base: [0, 0.305, 0], scale: [1, 1, 0.84], color: STEEL, colorTop: STEEL_LIGHT });
    // Schulterplatten
    body.sphere({ r: 0.07, detail: 0, at: [0.15, 0.335, 0], scale: [1, 0.6, 1.05], color: STEEL_LIGHT, mirror: true });

    const head = m.part('head', { pivot: [0, 0.35, 0], parent: 'body' });
    head.sphere({ r: 0.105, at: [0, 0.445, 0.01], color: SKIN });
    head.dome({ r: 0.118, seg: 7, rings: 2, at: [0, 0.455, 0], color: STEEL, colorTop: STEEL_LIGHT });
    head.box({ size: [0.03, 0.09, 0.07], at: [0.1, 0.42, 0.04], color: STEEL, mirror: true });
    head.box({ size: [0.024, 0.026, 0.014], at: [0.038, 0.437, 0.11], color: DARK, mirror: true });
    // Helmbusch von vorn nach hinten
    head.extrude({ points: [[-0.12, 0], [0.12, 0], [0.105, 0.06], [0.05, 0.095], [-0.05, 0.095], [-0.105, 0.06]], depth: 0.045, base: [0, 0.545, -0.005], rot: [0, Math.PI / 2, 0], color: GREEN_LIGHT, colorTop: GREEN_BRIGHT });

    soldierLegs(m, 0.062, 0.13, LEATHER_DARK);

    // Hoher gewölbter Schild vor dem Körper (drei Leisten), hängt am Rumpf.
    const sh = m.part('shield', { pivot: [-0.04, 0.26, 0.15], parent: 'body' });
    /** @type {[number, number, number][]} */
    const slats = [[-0.04, 0.2, 0], [0.058, 0.176, 0.5], [-0.138, 0.176, -0.5]];
    for (const [x, z, ry] of slats) {
      sh.box({ size: [0.108, 0.3, 0.026], at: [x, 0.235, z], rot: [0, ry, 0], color: GREEN, colorTop: GREEN_LIGHT });
      sh.box({ size: [0.112, 0.03, 0.032], at: [x, 0.378, z], rot: [0, ry, 0], color: BRONZE_LIGHT });
      sh.box({ size: [0.112, 0.03, 0.032], at: [x, 0.095, z], rot: [0, ry, 0], color: BRONZE });
    }
    sh.box({ size: [0.2, 0.035, 0.012], at: [-0.04, 0.235, 0.216], color: CREAM });
    sh.sphere({ r: 0.05, detail: 0, at: [-0.04, 0.235, 0.218], scale: [1, 1, 0.6], color: BRONZE_LIGHT });

    // Rechter Arm mit senkrechtem Pilum
    const armR = m.part('armR', { pivot: [0.15, 0.33, 0], parent: 'body' });
    limb(armR, [0.155, 0.32, 0], [0.18, 0.21, 0.05], 0.036, 0.032, SKIN, { seg: 5 });
    limb(armR, [0.185, 0.05, 0.06], [0.185, 0.5, 0.06], 0.019, 0.019, WOOD, { seg: 5 });
    limb(armR, [0.185, 0.5, 0.06], [0.185, 0.62, 0.06], 0.012, 0.012, STEEL_DARK, { seg: 4 });
    armR.cone({ r: 0.028, h: 0.08, seg: 4, base: [0.185, 0.61, 0.06], color: STEEL_LIGHT });

    return m.build({
      stride: 0.45,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_MARCH);
        // Das Pilum tippt im Takt, der Schild wippt kaum.
        pose.armR.position.y = Math.abs(Math.sin(ctx.walk)) * 0.02 * k;
        pose.shield.rotation.x = Math.sin(ctx.walk * 2) * 0.03 * k - ctx.hurt * 0.2;
        pose.head.rotation.y = Math.sin(ctx.t * 0.9 + ctx.seed * 6) * 0.12;
        A.flinch(pose, ctx, 'body', 0.08);
      },
    });
  },

  // Gepanzert und zäh: vier Mann unter einem Dach aus Schilden, acht schlurfende Füße, vorn lugen Augen heraus.
  'enemy.rom.testudo': () => {
    const m = createModel('enemy.rom.testudo');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    body.box({ size: [0.5, 0.3, 0.6], base: [0, 0.12, 0], color: GREEN_DARK });
    const hp = Math.PI / 2;
    for (const z of [-0.17, 0.17]) {
      shield(body, [0.3, 0.265, z], hp, -0.16, 0.335, 0.32, GREEN);
      shield(body, [-0.3, 0.265, z], -hp, -0.16, 0.335, 0.32, GREEN);
    }
    for (const x of [-0.15, 0.15]) {
      shield(body, [x, 0.235, 0.35], 0, -0.16, 0.3, 0.27, GREEN);
      shield(body, [x, 0.265, -0.35], Math.PI, -0.16, 0.3, 0.32, GREEN);
      // Gesichter im Sehschlitz
      body.sphere({ r: 0.085, detail: 0, at: [x, 0.415, 0.27], color: SKIN });
      body.dome({ r: 0.094, seg: 6, rings: 2, at: [x, 0.43, 0.262], color: STEEL, colorTop: STEEL_LIGHT });
      body.box({ size: [0.022, 0.026, 0.014], at: [x - 0.033, 0.412, 0.35], color: DARK });
      body.box({ size: [0.022, 0.026, 0.014], at: [x + 0.033, 0.412, 0.35], color: DARK });
    }

    // Dach: zwei Hälften, die beim Treffer klappern.
    const roofL = m.part('roofL', { pivot: [0, 0.5, 0], parent: 'body' });
    const roofR = m.part('roofR', { pivot: [0, 0.5, 0], parent: 'body' });
    for (const [z, y] of /** @type {[number, number][]} */ ([[-0.175, 0.475], [0.175, 0.5]])) {
      shield(roofL, [-0.155, y, z], -hp, -hp + 0.2, 0.39, 0.34, GREEN_LIGHT);
      shield(roofR, [0.155, y, z], hp, -hp + 0.2, 0.39, 0.34, GREEN_LIGHT);
    }

    // Acht Füße in zwei Gruppen (jeweils ein Fuß je Mann).
    const legsA = m.part('legsA', { pivot: [0, 0.14, 0] });
    const legsB = m.part('legsB', { pivot: [0, 0.14, 0] });
    for (const mx of [-0.15, 0.15]) {
      for (const mz of [-0.17, 0.17]) {
        for (const [part, x] of /** @type {[PartBuilder, number][]} */ ([[legsA, mx - 0.06], [legsB, mx + 0.06]])) {
          part.cyl({ r: 0.036, rTop: 0.046, h: 0.16, seg: 6, base: [x, 0, mz], color: SKIN });
          part.cyl({ r: 0.045, rTop: 0.042, h: 0.055, seg: 6, base: [x, 0, mz], color: LEATHER_DARK });
          part.box({ size: [0.07, 0.035, 0.07], base: [x, 0, mz + 0.04], color: LEATHER_DARK });
        }
      }
    }

    return m.build({
      stride: 0.32,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const s = Math.sin(ctx.walk);
        const c = Math.cos(ctx.walk);
        // Schlurfen: die Fußgruppen schieben abwechselnd vor und heben kurz ab.
        pose.legsA.position.z = s * 0.05 * k;
        pose.legsA.position.y = Math.max(0, c) * 0.03 * k;
        pose.legsB.position.z = -s * 0.05 * k;
        pose.legsB.position.y = Math.max(0, -c) * 0.03 * k;
        pose.body.position.y += Math.abs(s) * 0.012 * k;
        pose.body.rotation.z = s * 0.025 * k;
        // Die Dachschilde heben und senken sich leicht und klappern bei Treffern.
        const rattle = Math.sin(ctx.t * 46) * ctx.hurt * 0.12;
        pose.roofL.rotation.z = -Math.max(0, s) * 0.05 * k + rattle;
        pose.roofR.rotation.z = Math.max(0, -s) * 0.05 * k + rattle * 0.8;
        pose.roofL.position.y = ctx.hurt * 0.015;
        pose.roofR.position.y = ctx.hurt * 0.01;
        A.flinch(pose, ctx, 'body', 0.06);
      },
    });
  },

  // Boss: Feldherr im goldenen Triumphwagen, zwei Schimmel davor; er winkt, der grüne Mantel weht.
  'boss.rom.feldherr': () => {
    const m = createModel('boss.rom.feldherr');
    const CZ = -0.36; // Mitte des Wagens
    const AXLE = 0.3;

    const car = m.part('car', { pivot: [0, AXLE, CZ] });
    car.box({ size: [0.62, 0.06, 0.56], at: [0, 0.35, CZ - 0.03], color: GOLD_DARK });
    // Wagenkorb: Leisten im Halbrund, vorn hoch, seitlich abfallend
    const R = 0.3;
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI;
      const h = 0.3 + 0.16 * Math.sin(a);
      car.box({ size: [0.166, h, 0.035], at: [R * Math.cos(a), 0.36 + h / 2, CZ + 0.02 + R * Math.sin(a)], rot: [0, Math.PI / 2 - a, 0], color: GOLD, colorTop: GOLD_LIGHT });
      car.box({ size: [0.176, 0.035, 0.05], at: [R * Math.cos(a), 0.36 + h, CZ + 0.02 + R * Math.sin(a)], rot: [0, Math.PI / 2 - a, 0], color: BRONZE });
    }
    car.box({ size: [0.035, 0.3, 0.26], at: [0.3, 0.51, CZ - 0.11], color: GOLD, colorTop: GOLD_LIGHT, mirror: true });
    car.box({ size: [0.05, 0.035, 0.27], at: [0.3, 0.665, CZ - 0.11], color: BRONZE, mirror: true });
    car.torus({ r: 0.315, tube: 0.032, seg: 8, tubeSeg: 5, arc: Math.PI, at: [0, 0.385, CZ + 0.02], color: BRONZE });
    // Grünes Medaillon mit goldenem Buckel an der Front
    car.cyl({ r: 0.1, h: 0.03, seg: 8, at: [0, 0.6, CZ + 0.335], rot: [Math.PI / 2, 0, 0], color: GREEN });
    car.sphere({ r: 0.05, detail: 0, at: [0, 0.6, CZ + 0.35], color: GOLD_LIGHT });
    // Deichsel und Joch
    limb(car, [0, 0.34, CZ + 0.25], [0, 0.47, 0.62], 0.03, 0.025, WOOD, { seg: 5 });
    car.box({ size: [0.5, 0.045, 0.045], at: [0, 0.5, 0.62], color: BRONZE });
    car.cyl({ r: 0.035, h: 0.84, seg: 6, at: [0, AXLE, CZ], rot: [0, 0, Math.PI / 2], color: LEATHER_DARK });
    // Feldzeichen am Heck: Stange mit goldenem Adler
    const SX = -0.27;
    const SZ = CZ - 0.24;
    car.cyl({ r: 0.022, h: 1.02, seg: 5, base: [SX, 0.36, SZ], color: WOOD });
    car.box({ size: [0.3, 0.035, 0.035], at: [SX, 1.25, SZ], color: BRONZE });
    car.sphere({ r: 0.06, detail: 0, at: [SX, 1.42, SZ], scale: [0.9, 1, 1.1], color: GOLD, colorTop: GOLD_LIGHT });
    car.sphere({ r: 0.035, detail: 0, at: [SX, 1.47, SZ + 0.05], color: GOLD_LIGHT });
    car.box({ size: [0.13, 0.03, 0.07], at: [SX + 0.1, 1.45, SZ], rot: [0, 0, 0.5], color: GOLD_LIGHT });
    car.box({ size: [0.13, 0.03, 0.07], at: [SX - 0.1, 1.45, SZ], rot: [0, 0, -0.5], color: GOLD_LIGHT });
    const banner = m.part('banner', { pivot: [SX, 1.24, SZ], parent: 'car' });
    banner.box({ size: [0.26, 0.26, 0.022], at: [SX, 1.1, SZ], color: GREEN, colorTop: GREEN_LIGHT, shade: 0 });
    banner.box({ size: [0.26, 0.04, 0.026], at: [SX, 0.965, SZ], color: GOLD });
    banner.sphere({ r: 0.05, detail: 0, at: [SX, 1.11, SZ + 0.012], scale: [1, 1, 0.4], color: GOLD_LIGHT });

    // Speichenräder (ein Teil, dreht um die Achse)
    const wheels = m.part('wheels', { pivot: [0, AXLE, CZ] });
    for (const sx of [-1, 1]) {
      const x = 0.41 * sx;
      wheels.torus({ r: 0.265, tube: 0.038, seg: 10, tubeSeg: 4, at: [x, AXLE, CZ], rot: [0, 0, Math.PI / 2], color: GOLD, shade: 0 });
      for (let i = 0; i < 4; i++) {
        wheels.box({ size: [0.03, 0.5, 0.04], at: [x, AXLE, CZ], rot: [(i * Math.PI) / 4, 0, 0], color: BRONZE, shade: 0 });
      }
      wheels.cyl({ r: 0.06, h: 0.07, seg: 6, at: [x + 0.01 * sx, AXLE, CZ], rot: [0, 0, Math.PI / 2], color: GOLD_LIGHT });
    }

    // Die zwei Schimmel mit grünem Geschirr
    for (const [n, x] of /** @type {[HorseNames, number][]} */ ([[BOSS_HORSE_L, -0.21], [BOSS_HORSE_R, 0.21]])) {
      const hb = horse(m, n, x, 0.6, 1, WHITE_COAT);
      hb.cyl({ r: 0.132, h: 0.11, seg: 8, at: [x, 0.372, 0.555], rot: [Math.PI / 2, 0, 0], scale: [0.97, 0.92, 1], color: GREEN, colorTop: GREEN_LIGHT });
      const hh = m.part(n.head);
      hh.torus({ r: 0.088, tube: 0.03, seg: 7, tubeSeg: 4, at: [x, 0.47, 0.805], rot: [0.54, 0, 0], color: GOLD });
      hh.sphere({ r: 0.034, detail: 0, at: [x, 0.69, 0.925], color: GREEN_BRIGHT });
    }

    // Der Feldherr
    const gz = CZ - 0.02;
    const gen = m.part('general', { pivot: [0, 0.4, gz], parent: 'car' });
    gen.cyl({ r: 0.17, rTop: 0.14, h: 0.2, seg: 7, base: [0, 0.38, gz], scale: [1, 1, 0.82], color: GREEN_DARK, colorTop: GREEN });
    gen.cyl({ r: 0.145, rTop: 0.175, h: 0.24, seg: 7, base: [0, 0.56, gz], scale: [1, 1, 0.82], color: GOLD, colorTop: GOLD_LIGHT });
    gen.sphere({ r: 0.08, detail: 0, at: [0.18, 0.78, gz], scale: [1, 0.6, 1], color: GOLD_LIGHT, mirror: true });
    // Mantelkragen und Schärpe
    gen.torus({ r: 0.115, tube: 0.045, seg: 7, tubeSeg: 4, at: [0, 0.8, gz], scale: [1.15, 1, 0.9], color: GREEN_LIGHT });
    gen.box({ size: [0.07, 0.3, 0.02], at: [0, 0.68, gz + 0.137], rot: [0.1, 0, 0.75], color: GREEN });
    // linker Arm an der Wagenbrüstung
    limb(gen, [-0.19, 0.76, gz], [-0.2, 0.66, gz + 0.2], 0.042, 0.036, SKIN, { seg: 5 });

    const head = m.part('ghead', { pivot: [0, 0.8, gz], parent: 'general' });
    head.sphere({ r: 0.14, at: [0, 0.92, gz + 0.01], color: SKIN });
    head.dome({ r: 0.147, seg: 7, rings: 2, at: [0, 0.94, gz - 0.02], color: HAIR });
    head.box({ size: [0.032, 0.036, 0.016], at: [0.05, 0.92, gz + 0.145], color: DARK, mirror: true });
    // Lorbeerkranz
    head.torus({ r: 0.142, tube: 0.028, seg: 9, tubeSeg: 5, at: [0, 0.985, gz - 0.015], rot: [-0.25, 0, 0], color: GOLD, colorTop: GOLD_LIGHT });

    // Winkender rechter Arm
    const arm = m.part('wave', { pivot: [0.19, 0.77, gz], parent: 'general' });
    limb(arm, [0.19, 0.77, gz], [0.33, 0.9, gz + 0.03], 0.042, 0.038, SKIN, { seg: 5 });
    limb(arm, [0.33, 0.9, gz + 0.03], [0.36, 1.07, gz + 0.05], 0.038, 0.034, SKIN, { seg: 5 });
    arm.sphere({ r: 0.05, detail: 0, at: [0.365, 1.1, gz + 0.05], color: SKIN });

    // Mantel in zwei Gliedern
    const cloak1 = m.part('cloak1', { pivot: [0, 0.8, gz - 0.13], parent: 'general' });
    cloak1.box({ size: [0.36, 0.26, 0.035], at: [0, 0.68, gz - 0.15], rot: [0.12, 0, 0], color: GREEN, colorTop: GREEN_LIGHT, shade: 0 });
    cloak1.box({ size: [0.38, 0.05, 0.1], at: [0, 0.8, gz - 0.1], color: GREEN_LIGHT });
    const cloak2 = m.part('cloak2', { pivot: [0, 0.56, gz - 0.17], parent: 'cloak1' });
    cloak2.extrude({ points: [[-0.18, 0], [-0.22, -0.3], [0, -0.25], [0.22, -0.3], [0.18, 0]], depth: 0.03, at: [0, 0.56, gz - 0.17], rot: [0.3, 0, 0], color: GREEN_DARK, colorTop: GREEN, shade: 0 });

    return m.build({
      stride: 0.9,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        horseGait(pose, BOSS_HORSE_L, ctx, 0, false);
        horseGait(pose, BOSS_HORSE_R, ctx, 1.3, false);
        pose.wheels.rotation.x = ctx.walk * 0.477;
        // Der Wagen rumpelt leicht.
        pose.car.position.y = Math.abs(Math.sin(ctx.walk * 1.5)) * 0.012 * k;
        pose.car.rotation.z = Math.sin(ctx.walk * 0.75) * 0.015 * k;
        const p = ctx.t * 2 + ctx.seed * 6;
        pose.general.rotation.z = Math.sin(p * 0.5) * 0.04;
        pose.ghead.rotation.y = Math.sin(p * 0.5) * 0.3;
        pose.wave.rotation.z = Math.sin(p * 2.2) * 0.28 - 0.05;
        const f = ctx.t * 5 + ctx.seed * 6;
        pose.cloak1.rotation.x = 0.12 + 0.2 * k + Math.sin(f) * 0.08;
        pose.cloak2.rotation.x = 0.1 + 0.3 * k + Math.sin(f - 1.2) * 0.16;
        pose.banner.rotation.x = Math.sin(f * 0.6 - 0.5) * 0.14 - 0.12 * k;
        A.flinch(pose, ctx, 'general', 0.1);
      },
    });
  },
};
