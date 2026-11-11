// @ts-check
// Gegner des Mittelalters: Feuerdiebe in Wappenfarben, freundlich wie Zinnfiguren aus der Spielzeugkiste.
// Fußknecht (Standard), Strauchdieb (schnell), Ritter (gepanzert), Spielmann (Heiler)
// und der Boss "Der Schwarze Ritter" auf seinem Ross mit violetter Schabracke.

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder, ModelBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Mittelalters ---
const SKIN = '#e3b48d';
const SKIN_DARK = '#c99673';
const DARK = '#2a2420';
const HAIR = '#5a3a24';
const STEEL = '#a9b3bd';
const STEEL_LIGHT = '#dbe1e6';
const STEEL_DARK = '#7b8590';
const LEATHER = '#8a5a35';
const LEATHER_DARK = '#5e3d26';
const WOOD = '#9a6b3f';
const WOOD_LIGHT = '#c48e55';
const CREAM = '#f0e5c8';
const GOLD = '#d9a520';
const GOLD_LIGHT = '#f2cc5c';
const BLUE = '#2f5da8';
const BLUE_LIGHT = '#4b7fcc';
// Fußknecht: graublauer Gambeson
const GAMBESON = '#6f88b0';
const GAMBESON_LIGHT = '#98b0d2';
const GAMBESON_DARK = '#506891';
// Strauchdieb: dunkles Waldgrün und heller Sack
const CLOAK = '#2e6a50';
const CLOAK_LIGHT = '#43896a';
const CLOAK_DARK = '#224e3c';
const SACK = '#dcc48e';
const SACK_LIGHT = '#efdcae';
// Spielmann: rot-gelb geteilt, grüne Noten
const RED = '#d6492f';
const RED_LIGHT = '#ec6c4c';
const YELLOW = '#e8b828';
const YELLOW_LIGHT = '#f6d660';
const HEAL = '#5ee07a';
const HEAL_SOFT = '#b4f5a8';
// Schwarzer Ritter: Schiefer statt Schwarz, Violett und Gold
const COAT = '#403b4e';
const COAT_LIGHT = '#625b76';
const IRON = '#4a4658';
const IRON_LIGHT = '#77718a';
const PURPLE = '#6b3f96';
const PURPLE_LIGHT = '#8e5cc0';
const PURPLE_DARK = '#4e2c70';
const LAVENDER = '#c9a6ec';
const MUZZLE = '#7a7290';
const MOUSTACHE = '#e6dfd2';
// Neigung der erhobenen Lanze (etwa 24 Grad)
const LANCE_DY = Math.sin(0.42);
const LANCE_DZ = Math.cos(0.42);

const HALF_PI = Math.PI / 2;

/**
 * Setzt einen (verjüngten) Zylinder zwischen zwei Punkte im Modellraum.
 * @param {PartBuilder} part
 * @param {Vec3} a Anfang (Radius r0)
 * @param {Vec3} b Ende (Radius r1)
 * @param {number} r0
 * @param {number} r1
 * @param {string} color
 * @param {{ seg?: number, colorTop?: string, mirror?: boolean, glow?: boolean }} [o]
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
    color, colorTop: o.colorTop, mirror: o.mirror, glow: o.glow,
  });
}

/**
 * Zwei Beine (Teile `legL`, `legR`) mit Stiefel, Fußspitze nach vorn.
 * @param {ModelBuilder} m
 * @param {number} x seitlicher Abstand
 * @param {number} hip Hüfthöhe
 * @param {string} hoseL Farbe des linken Beins
 * @param {string} hoseR Farbe des rechten Beins
 * @param {string} boot Farbe der Stiefel
 * @param {number} [r] Beinstärke
 */
function legs(m, x, hip, hoseL, hoseR, boot, r = 0.04) {
  for (const [name, sx, hose] of /** @type {[string, number, string][]} */ ([['legL', -x, hoseL], ['legR', x, hoseR]])) {
    const leg = m.part(name, { pivot: [sx, hip, 0] });
    leg.cyl({ r: r * 0.9, rTop: r * 1.2, h: hip + 0.03, seg: 6, base: [sx, 0, 0], color: hose });
    leg.cyl({ r: r * 1.15, rTop: r * 1.1, h: 0.065, seg: 6, base: [sx, 0, 0], color: boot });
    leg.sphere({ r: r * 1.05, detail: 0, at: [sx, 0.028, 0.035], scale: [1, 0.75, 1.35], color: boot });
  }
}

/**
 * Drachenschild (Kite) als flacher Umriss mit Rand, Fläche blickt nach +Z vor der Drehung.
 * @param {PartBuilder} part
 * @param {Vec3} at Mitte im Modellraum
 * @param {Vec3} rot Drehung
 * @param {number} s Maßstab
 * @param {string} rim Randfarbe
 * @param {string} face Flächenfarbe
 * @param {string} faceTop Flächenfarbe oben
 */
function kiteShield(part, at, rot, s, rim, face, faceTop) {
  /** @type {[number, number][]} */
  const outer = [[0, -0.21], [0.12, -0.03], [0.125, 0.1], [0.08, 0.145], [0, 0.155], [-0.08, 0.145], [-0.125, 0.1], [-0.12, -0.03]];
  part.extrude({ points: outer.map(([x, y]) => /** @type {[number, number]} */ ([x * s, y * s])), depth: 0.02 * s, at, rot, color: rim, shade: 0.05 });
  /** @type {[number, number][]} */
  const inner = outer.map(([x, y]) => [x * s * 0.82, (y * 0.84 + 0.008) * s]);
  // Fläche ein Stück vor dem Rand; die Verschiebung entlang der gedrehten Normalen ist klein genug, um sie vorzurechnen.
  const nx = Math.sin(rot[1]) * Math.cos(rot[0]);
  const ny = -Math.sin(rot[0]);
  const nz = Math.cos(rot[1]) * Math.cos(rot[0]);
  const d = 0.013 * s;
  part.extrude({ points: inner, depth: 0.02 * s, at: [at[0] + nx * d, at[1] + ny * d, at[2] + nz * d], rot, color: face, colorTop: faceTop });
}

// Feste Optionen für die Laufzyklen (damit animate nichts alloziert).
const WALK_KNECHT = { swing: 0.7, armSwing: 0.45, bob: 0.025, sway: 0.04 };
const WALK_THIEF = { swing: 1.0, armSwing: 0.6, bob: 0.03, sway: 0 };
const WALK_KNIGHT = { swing: 0.5, armSwing: 0.25, bob: 0.03, sway: 0.08 };
const WALK_SKIP = { swing: 0.75, armSwing: 0.3, bob: 0.02, sway: 0.05 };

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Standard: Fußknecht im graublauen Gambeson, breiter Eisenhut, langer Spieß und ein Bündel auf dem Rücken.
  'enemy.mittelalter.knecht': () => {
    const m = createModel('enemy.mittelalter.knecht');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    body.lathe({ points: [[0, 0.11], [0.125, 0.12], [0.142, 0.19], [0.13, 0.3], [0.085, 0.345], [0, 0.35]], seg: 8, scale: [1, 1, 0.84], color: GAMBESON, colorTop: GAMBESON_LIGHT });
    // Steppnähte als zwei dunklere Ringe, Gürtel
    body.torus({ r: 0.139, tube: 0.011, seg: 10, tubeSeg: 4, at: [0, 0.24, 0], scale: [1, 1, 0.84], color: GAMBESON_DARK });
    body.torus({ r: 0.138, tube: 0.018, seg: 10, tubeSeg: 4, at: [0, 0.155, 0], scale: [1, 1, 0.84], color: LEATHER });
    // Bündel auf dem Rücken mit Riemen
    body.sphere({ r: 0.1, detail: 0, at: [0, 0.28, -0.14], scale: [1.1, 0.95, 0.75], color: SACK, colorTop: SACK_LIGHT });
    body.box({ size: [0.03, 0.03, 0.24], at: [0.06, 0.33, -0.03], rot: [0, 0, -0.3], color: LEATHER_DARK });
    body.cyl({ r: 0.022, h: 0.24, seg: 5, at: [0, 0.37, -0.15], rot: [0, 0, HALF_PI], color: WOOD });

    const head = m.part('head', { pivot: [0, 0.34, 0], parent: 'body' });
    head.sphere({ r: 0.11, at: [0, 0.44, 0.01], color: SKIN });
    head.box({ size: [0.024, 0.03, 0.014], at: [0.038, 0.44, 0.113], color: DARK, mirror: true });
    head.sphere({ r: 0.022, detail: 0, at: [0, 0.415, 0.118], color: SKIN_DARK });
    // Eisenhut: Kalotte und breite, leicht hängende Krempe
    head.dome({ r: 0.118, seg: 8, rings: 2, at: [0, 0.49, -0.005], scale: [1, 0.85, 1], color: STEEL, colorTop: STEEL_LIGHT });
    head.cyl({ r: 0.19, rTop: 0.13, h: 0.035, seg: 10, at: [0, 0.495, -0.005], color: STEEL_DARK, colorTop: STEEL });
    head.sphere({ r: 0.022, detail: 0, at: [0, 0.595, -0.005], color: STEEL_LIGHT });

    legs(m, 0.06, 0.13, LEATHER, LEATHER, LEATHER_DARK);

    const armL = m.part('armL', { pivot: [-0.13, 0.31, 0], parent: 'body' });
    limb(armL, [-0.13, 0.31, 0], [-0.165, 0.19, 0.02], 0.036, 0.032, GAMBESON, { seg: 5 });
    armL.sphere({ r: 0.034, detail: 0, at: [-0.168, 0.18, 0.025], color: SKIN });

    // Rechter Arm hält den Spieß schräg nach vorn
    const armR = m.part('armR', { pivot: [0.13, 0.31, 0], parent: 'body' });
    limb(armR, [0.13, 0.31, 0], [0.175, 0.26, 0.08], 0.036, 0.032, GAMBESON, { seg: 5 });
    armR.sphere({ r: 0.034, detail: 0, at: [0.18, 0.26, 0.085], color: SKIN });
    limb(armR, [0.18, 0.08, -0.1], [0.18, 0.62, 0.3], 0.018, 0.018, WOOD, { seg: 5 });
    armR.cone({ r: 0.036, h: 0.12, seg: 4, base: [0.18, 0.615, 0.295], rot: [0.73, 0, 0], scale: [1, 1, 0.45], color: STEEL_LIGHT });

    return m.build({
      stride: 0.48,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_KNECHT);
        pose.body.rotation.x = 0.06 * k;
        pose.armR.rotation.x = Math.sin(ctx.walk * 2) * 0.06 * k;
        pose.head.rotation.y = Math.sin(ctx.t * 0.8 + ctx.seed * 6) * 0.15;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Schnell: Strauchdieb im grünen Kapuzenumhang, tief gebückt, ein praller Beutesack über der Schulter.
  'enemy.mittelalter.strauchdieb': () => {
    const m = createModel('enemy.mittelalter.strauchdieb');
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    body.cyl({ r: 0.13, rTop: 0.075, h: 0.22, seg: 7, base: [0, 0.12, -0.01], scale: [1, 1, 0.85], color: CLOAK_DARK, colorTop: CLOAK });
    body.torus({ r: 0.1, tube: 0.014, seg: 8, tubeSeg: 4, at: [0, 0.2, -0.005], scale: [1, 1, 0.85], color: LEATHER_DARK });
    // Umhang flattert als eigenes Teil
    const cape = m.part('cape', { pivot: [0, 0.33, -0.05], parent: 'body' });
    cape.extrude({ points: [[-0.1, 0], [0.1, 0], [0.15, -0.2], [0.05, -0.17], [0, -0.22], [-0.05, -0.17], [-0.15, -0.2]], depth: 0.02, at: [0, 0.335, -0.075], rot: [0.25, 0, 0], color: CLOAK, colorTop: CLOAK_LIGHT, shade: 0 });

    const head = m.part('head', { pivot: [0, 0.33, 0], parent: 'body' });
    head.sphere({ r: 0.1, at: [0, 0.43, 0.02], color: SKIN });
    // Kapuze: Halbschale mit Zipfel nach hinten, das Gesicht schaut vorn heraus
    head.sphere({ r: 0.113, at: [0, 0.445, -0.005], scale: [1, 1.02, 0.95], color: CLOAK, colorTop: CLOAK_LIGHT });
    head.cone({ r: 0.07, h: 0.17, seg: 6, base: [0, 0.49, -0.07], rot: [-1.9, 0, 0], color: CLOAK, colorTop: CLOAK_LIGHT });
    head.sphere({ r: 0.088, at: [0, 0.425, 0.045], color: SKIN });
    head.box({ size: [0.024, 0.024, 0.014], at: [0.033, 0.435, 0.13], color: DARK, mirror: true });
    head.box({ size: [0.11, 0.035, 0.012], at: [0, 0.395, 0.126], color: CLOAK_DARK });

    legs(m, 0.055, 0.14, LEATHER_DARK, LEATHER_DARK, DARK, 0.034);

    const armL = m.part('armL', { pivot: [-0.1, 0.31, 0], parent: 'body' });
    limb(armL, [-0.1, 0.31, 0], [-0.13, 0.2, 0.08], 0.03, 0.026, CLOAK, { seg: 5 });
    armL.sphere({ r: 0.03, detail: 0, at: [-0.132, 0.195, 0.085], color: SKIN });

    // Rechter Arm über der Schulter, hält den Beutesack
    const sack = m.part('sack', { pivot: [0.1, 0.33, 0], parent: 'body' });
    limb(sack, [0.1, 0.31, 0], [0.12, 0.42, -0.04], 0.03, 0.026, CLOAK, { seg: 5 });
    sack.sphere({ r: 0.03, detail: 0, at: [0.12, 0.43, -0.05], color: SKIN });
    sack.sphere({ r: 0.135, detail: 1, at: [0.07, 0.4, -0.2], scale: [1, 0.9, 0.95], color: SACK, colorTop: SACK_LIGHT });
    sack.cyl({ r: 0.035, rTop: 0.05, h: 0.06, seg: 6, at: [0.11, 0.44, -0.07], rot: [-1.0, 0, 0], color: SACK });
    sack.torus({ r: 0.04, tube: 0.012, seg: 6, tubeSeg: 3, at: [0.1, 0.44, -0.09], rot: [-1.0, 0, 0], color: LEATHER_DARK });
    // Goldmünzen lugen heraus
    sack.cyl({ r: 0.035, h: 0.012, seg: 7, at: [0.08, 0.525, -0.17], rot: [0.3, 0, 0.4], color: GOLD_LIGHT });
    sack.cyl({ r: 0.03, h: 0.012, seg: 7, at: [0.02, 0.51, -0.2], rot: [-0.2, 0, -0.3], color: GOLD });

    return m.build({
      stride: 0.62,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_THIEF);
        const s = Math.sin(ctx.walk);
        // Weit nach vorn gebeugt, schaukelt im Lauf von links nach rechts.
        pose.body.rotation.x = 0.12 + 0.45 * k;
        pose.body.rotation.z = s * 0.12 * k;
        pose.body.position.x = s * 0.025 * k;
        pose.head.rotation.x = -0.38 * k;
        pose.sack.rotation.x = Math.sin(ctx.walk * 2) * 0.1 * k;
        pose.cape.rotation.x = -0.4 * k + Math.sin(ctx.t * 9 + ctx.seed * 6) * (0.05 + 0.1 * k);
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Gepanzert: Ritter in Stahl mit blauem Wappenrock, Topfhelm mit Helmbusch, Drachenschild und Schwert; stampft schwer.
  'enemy.mittelalter.ritter': () => {
    const m = createModel('enemy.mittelalter.ritter');
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    // Kettenhemd unten, darüber der blaue Wappenrock, oben der Stahlkragen
    body.cyl({ r: 0.15, rTop: 0.135, h: 0.08, seg: 8, base: [0, 0.115, 0], scale: [1, 1, 0.84], color: STEEL_DARK, colorTop: STEEL });
    body.lathe({ points: [[0, 0.16], [0.152, 0.165], [0.156, 0.24], [0.14, 0.33], [0, 0.335]], seg: 8, scale: [1, 1, 0.84], color: BLUE, colorTop: BLUE_LIGHT });
    body.box({ size: [0.05, 0.16, 0.012], at: [0, 0.25, 0.129], rot: [-0.08, 0, 0], color: GOLD_LIGHT });
    body.torus({ r: 0.15, tube: 0.016, seg: 10, tubeSeg: 4, at: [0, 0.175, 0], scale: [1, 1, 0.84], color: LEATHER_DARK });
    body.cyl({ r: 0.1, rTop: 0.075, h: 0.05, seg: 8, base: [0, 0.32, 0], color: STEEL, colorTop: STEEL_LIGHT });
    // Große runde Schulterplatten
    body.sphere({ r: 0.078, detail: 0, at: [0.15, 0.335, 0], scale: [1, 0.7, 1.1], color: STEEL, colorTop: STEEL_LIGHT, mirror: true });

    const head = m.part('head', { pivot: [0, 0.36, 0], parent: 'body' });
    // Topfhelm mit Sehschlitz und goldenem Kreuz
    head.cyl({ r: 0.112, rTop: 0.105, h: 0.17, seg: 8, base: [0, 0.355, 0], color: STEEL, colorTop: STEEL_LIGHT });
    head.cyl({ r: 0.1, rTop: 0.06, h: 0.035, seg: 8, base: [0, 0.525, 0], color: STEEL_LIGHT });
    head.box({ size: [0.17, 0.024, 0.02], at: [0, 0.465, 0.103], color: DARK });
    head.box({ size: [0.026, 0.12, 0.016], at: [0, 0.41, 0.11], color: GOLD });
    head.box({ size: [0.08, 0.022, 0.016], at: [0, 0.43, 0.111], color: GOLD });
    // Helmbusch: weiße Feder, nach hinten geschwungen
    head.extrude({ points: [[0.035, 0], [-0.035, 0], [-0.08, 0.1], [-0.16, 0.15], [-0.24, 0.13], [-0.17, 0.21], [-0.05, 0.2], [0.04, 0.1]], depth: 0.05, base: [0, 0.545, 0.03], rot: [0, HALF_PI, 0], color: CREAM, colorTop: '#f4efe4' });

    legs(m, 0.065, 0.135, STEEL_DARK, STEEL_DARK, STEEL, 0.045);

    // Linker Arm mit dem Drachenschild, leicht schräg nach außen und hinten gekippt
    const sh = m.part('shield', { pivot: [-0.16, 0.32, 0], parent: 'body' });
    limb(sh, [-0.16, 0.32, 0], [-0.19, 0.22, 0.06], 0.038, 0.034, STEEL, { seg: 5 });
    kiteShield(sh, [-0.2, 0.25, 0.1], [-0.3, -0.55, 0], 1.25, GOLD, BLUE, BLUE_LIGHT);

    // Rechter Arm mit Schwert, Klinge schräg nach oben
    const armR = m.part('armR', { pivot: [0.16, 0.32, 0], parent: 'body' });
    limb(armR, [0.16, 0.32, 0], [0.19, 0.22, 0.06], 0.038, 0.034, STEEL, { seg: 5 });
    armR.sphere({ r: 0.036, detail: 0, at: [0.195, 0.215, 0.07], color: STEEL_DARK });
    armR.box({ size: [0.11, 0.024, 0.03], at: [0.195, 0.23, 0.09], rot: [0.6, 0, 0], color: GOLD });
    armR.box({ size: [0.05, 0.36, 0.018], at: [0.195, 0.355, 0.215], rot: [0.6, 0, 0], color: STEEL_LIGHT, colorTop: '#f4efe4' });
    armR.sphere({ r: 0.022, detail: 0, at: [0.195, 0.19, 0.04], color: GOLD_LIGHT });

    return m.build({
      stride: 0.42,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_KNIGHT);
        // Schwerer Stampfschritt: der Körper sackt beim Auftreten ab und rollt.
        const c = Math.cos(ctx.walk);
        pose.body.position.y -= (1 - Math.abs(c)) * 0.01 * k;
        pose.shield.rotation.x = Math.sin(ctx.walk * 2) * 0.04 * k - ctx.hurt * 0.25;
        pose.armR.rotation.x = Math.sin(ctx.walk) * 0.15 * k;
        pose.head.rotation.y = Math.sin(ctx.t * 0.7 + ctx.seed * 6) * 0.12;
        A.flinch(pose, ctx, 'body', 0.08);
      },
    });
  },

  // Heiler: Spielmann im rot-gelb geteilten Gewand mit Federhut und Laute; hüpft, zupft, grüne Noten steigen auf.
  'enemy.mittelalter.spielmann': () => {
    const m = createModel('enemy.mittelalter.spielmann');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    // Geteiltes Wams: zwei Halbschalen, links rot, rechts gelb
    body.dome({ r: 0.13, seg: 8, rings: 3, at: [0, 0.235, 0], rot: [0, 0, HALF_PI], scale: [0.95, 1, 0.82], color: RED, colorTop: RED_LIGHT });
    body.dome({ r: 0.13, seg: 8, rings: 3, at: [0, 0.235, 0], rot: [0, 0, -HALF_PI], scale: [0.95, 1, 0.82], color: YELLOW, colorTop: YELLOW_LIGHT });
    body.torus({ r: 0.115, tube: 0.016, seg: 10, tubeSeg: 4, at: [0, 0.175, 0], scale: [1, 1, 0.84], color: LEATHER });
    // Zackenkragen in Grün
    body.cyl({ r: 0.1, rTop: 0.06, h: 0.04, seg: 6, base: [0, 0.335, 0], color: CLOAK_LIGHT });

    const head = m.part('head', { pivot: [0, 0.35, 0], parent: 'body' });
    head.sphere({ r: 0.11, at: [0, 0.45, 0.01], color: SKIN });
    head.box({ size: [0.024, 0.03, 0.014], at: [0.038, 0.455, 0.113], color: DARK, mirror: true });
    head.box({ size: [0.05, 0.012, 0.012], at: [0, 0.41, 0.112], color: '#b0574a' });
    head.dome({ r: 0.112, seg: 7, rings: 2, at: [0, 0.455, -0.012], color: HAIR });
    // Federhut: flache Mütze mit hochgeklappter Krempe und langer grüner Feder
    head.cyl({ r: 0.12, rTop: 0.135, h: 0.04, seg: 8, base: [0, 0.505, -0.01], rot: [-0.15, 0, 0.12], color: YELLOW, colorTop: YELLOW_LIGHT });
    head.dome({ r: 0.1, seg: 8, rings: 2, at: [0.005, 0.535, -0.015], rot: [-0.15, 0, 0.12], scale: [1, 0.7, 1], color: RED, colorTop: RED_LIGHT });
    head.extrude({ points: [[0, 0], [0.025, 0.03], [0.05, 0.12], [0.03, 0.2], [0.0, 0.12]], depth: 0.02, base: [-0.07, 0.535, -0.04], rot: [-0.9, 0, 0.5], color: CLOAK, colorTop: HEAL });

    legs(m, 0.06, 0.13, YELLOW, RED, LEATHER_DARK);

    // Laute schräg vor der Brust, deutlich größer als echt: bauchiger Korpus rechts unten, Hals nach links oben,
    // abgeknickter Wirbelkasten und ein grünes Band als Erkennungszeichen des Heilers.
    const lute = m.part('lute', { pivot: [0, 0.24, 0.12], parent: 'body' });
    lute.dome({ r: 0.125, seg: 8, rings: 3, at: [0.04, 0.215, 0.12], rot: [-HALF_PI, 0, 0.35], scale: [1.15, 0.9, 1], color: WOOD_LIGHT, colorTop: '#e0aa6a' });
    lute.cyl({ r: 0.125, h: 0.014, seg: 8, at: [0.04, 0.215, 0.124], rot: [HALF_PI, 0.35, 0], scale: [1.15, 1, 1], color: '#efcf96' });
    lute.cyl({ r: 0.032, h: 0.01, seg: 6, at: [0.03, 0.24, 0.133], rot: [HALF_PI, 0, 0], color: LEATHER_DARK });
    lute.box({ size: [0.07, 0.016, 0.01], at: [0.07, 0.17, 0.134], rot: [0, 0, 0.55], color: LEATHER_DARK });
    limb(lute, [-0.03, 0.27, 0.13], [-0.23, 0.42, 0.13], 0.026, 0.022, WOOD, { seg: 5 });
    lute.box({ size: [0.085, 0.045, 0.03], at: [-0.255, 0.425, 0.115], rot: [0, 0.4, -0.25], color: LEATHER });
    lute.box({ size: [0.04, 0.09, 0.012], at: [-0.13, 0.32, 0.15], rot: [0, 0, 0.65], color: HEAL });

    // Linke Hand greift am Hals
    const armL = m.part('armL', { pivot: [-0.12, 0.3, 0], parent: 'body' });
    limb(armL, [-0.12, 0.3, 0], [-0.17, 0.36, 0.13], 0.032, 0.028, YELLOW, { seg: 5 });
    armL.sphere({ r: 0.032, detail: 0, at: [-0.175, 0.37, 0.15], color: SKIN });

    // Zupfender rechter Arm über dem Korpus
    const armR = m.part('armR', { pivot: [0.12, 0.3, 0], parent: 'body' });
    limb(armR, [0.12, 0.3, 0], [0.09, 0.23, 0.17], 0.032, 0.028, RED, { seg: 5 });
    armR.sphere({ r: 0.032, detail: 0, at: [0.085, 0.225, 0.185], color: SKIN });

    // Grüne Noten steigen auf (zwei Teile, gegeneinander versetzt), groß genug für die Spielentfernung
    for (const [name, x] of /** @type {[string, number][]} */ ([['note1', 0.17], ['note2', -0.15]])) {
      const n = m.part(name, { pivot: [x, 0.62, 0] });
      n.sphere({ r: 0.052, detail: 0, at: [x, 0.6, 0], scale: [1.2, 0.9, 0.9], rot: [0, 0, 0.4], color: HEAL, glow: true });
      n.box({ size: [0.024, 0.15, 0.024], at: [x + 0.047, 0.675, 0], color: HEAL, glow: true });
      n.box({ size: [0.07, 0.024, 0.024], at: [x + 0.075, 0.74, 0], rot: [0, 0, -0.5], color: HEAL_SOFT, glow: true });
    }
    // Heilring am Boden
    const ring = m.part('ring', { pivot: [0, 0.015, 0] });
    ring.torus({ r: 0.3, tube: 0.018, seg: 16, tubeSeg: 3, at: [0, 0.015, 0], color: HEAL, glow: 1.2 });

    return m.build({
      stride: 0.5,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkBiped(pose, ctx, WALK_SKIP);
        // Hüpfender Schritt
        pose.body.position.y += Math.abs(Math.sin(ctx.walk)) * 0.035 * k;
        pose.head.rotation.z = Math.sin(ctx.t * 3 + ctx.seed * 6) * 0.12;
        pose.armR.rotation.x = 0;
        pose.armR.rotation.z = Math.sin(ctx.t * 14) * 0.18;
        pose.lute.rotation.z = Math.sin(ctx.t * 3) * 0.06;
        // Noten: steigen auf, wiegen sich, wachsen ein und vergehen
        for (let i = 0; i < 2; i++) {
          const p = pose[i === 0 ? 'note1' : 'note2'];
          const ph = (ctx.t * 0.55 + ctx.seed + i * 0.5) % 1;
          p.position.y = ph * 0.32;
          p.position.x = Math.sin(ph * 6.3 + i) * 0.04;
          p.scale.setScalar(Math.max(1e-4, Math.sin(ph * Math.PI)));
        }
        // Heilring pulsiert im Takt
        const beat = (ctx.t * 1.1 + ctx.seed) % 1;
        pose.ring.scale.setScalar(0.85 + beat * 0.35);
        pose.ring.scale.y = 1;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Boss: der Schwarze Ritter auf einem schweren Rappen mit violetter Schabracke, goldener Krone und langer Lanze.
  'boss.mittelalter.schwarzritter': () => {
    const m = createModel('boss.mittelalter.schwarzritter');

    // --- Ross ---
    const horse = m.part('horse', { pivot: [0, 0.55, 0] });
    horse.sphere({ r: 0.24, at: [0, 0.64, -0.02], scale: [0.88, 0.85, 1.75], color: COAT, colorTop: COAT_LIGHT });
    // Schabracke: weiter Rock rund um den Leib, Goldsaum
    horse.cyl({ r: 0.255, rTop: 0.24, h: 0.34, seg: 10, base: [0, 0.3, -0.02], scale: [1, 1, 1.72], color: PURPLE_DARK, colorTop: PURPLE_LIGHT });
    horse.torus({ r: 0.258, tube: 0.022, seg: 14, tubeSeg: 3, at: [0, 0.31, -0.02], scale: [1, 1, 1.72], color: GOLD });
    horse.torus({ r: 0.243, tube: 0.018, seg: 14, tubeSeg: 3, at: [0, 0.64, -0.02], scale: [1, 1, 1.72], color: GOLD_LIGHT });
    // Wappenscheiben an den Flanken
    horse.cyl({ r: 0.085, h: 0.02, seg: 6, at: [0.25, 0.47, -0.12], rot: [0, 0, HALF_PI], color: GOLD, mirror: true });
    horse.cyl({ r: 0.05, h: 0.02, seg: 6, at: [0.26, 0.47, -0.12], rot: [0, 0, HALF_PI], color: PURPLE, mirror: true });
    // Sattel
    horse.cyl({ r: 0.17, h: 0.06, seg: 8, at: [0, 0.84, -0.05], scale: [1, 1, 1.2], color: LEATHER_DARK, colorTop: LEATHER });

    // Kopf und Hals: kräftig, hoch getragen, mit großen freundlichen Augen und hellem Maul.
    const head = m.part('head', { pivot: [0, 0.78, 0.32], parent: 'horse' });
    limb(head, [0, 0.66, 0.26], [0, 1.04, 0.45], 0.15, 0.1, COAT, { colorTop: COAT_LIGHT, seg: 7 });
    // Kriniere (Halspanzer) in Violett, darauf eine lavendelfarbene Mähne
    limb(head, [0, 0.74, 0.22], [0, 1.06, 0.4], 0.13, 0.085, PURPLE, { colorTop: PURPLE_LIGHT, seg: 7 });
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      head.box({ size: [0.05, 0.1, 0.1], at: [0, 0.88 + t * 0.26, 0.17 + t * 0.17], rot: [-0.5, 0, 0], color: LAVENDER, colorTop: '#e2cdf5' });
    }
    head.sphere({ r: 0.13, at: [0, 1.08, 0.5], scale: [0.9, 0.95, 1], color: COAT, colorTop: COAT_LIGHT });
    limb(head, [0, 1.07, 0.52], [0, 0.93, 0.76], 0.11, 0.08, COAT, { colorTop: COAT_LIGHT, seg: 7 });
    head.sphere({ r: 0.085, detail: 0, at: [0, 0.92, 0.77], scale: [1, 0.85, 1], color: MUZZLE });
    head.box({ size: [0.016, 0.02, 0.01], at: [0.03, 0.93, 0.85], rot: [0.9, 0, 0], color: DARK, mirror: true });
    // Rossstirn: violette Platte mit Goldrand und Goldknauf
    head.box({ size: [0.1, 0.26, 0.03], at: [0, 1.05, 0.64], rot: [0.95, 0, 0], color: GOLD });
    head.box({ size: [0.074, 0.23, 0.03], at: [0, 1.055, 0.648], rot: [0.95, 0, 0], color: PURPLE, colorTop: PURPLE_LIGHT });
    head.sphere({ r: 0.03, detail: 0, at: [0, 1.13, 0.6], color: GOLD_LIGHT });
    // große freundliche Augen mit Glanzpunkt
    head.sphere({ r: 0.042, detail: 0, at: [0.095, 1.1, 0.56], color: CREAM, mirror: true });
    head.sphere({ r: 0.024, detail: 0, at: [0.124, 1.1, 0.578], color: DARK, mirror: true });
    head.sphere({ r: 0.009, detail: 0, at: [0.143, 1.112, 0.588], color: '#f4efe4', mirror: true });
    head.pyramid({ size: [0.06, 0.13, 0.05], base: [0.07, 1.17, 0.46], rot: [-0.15, 0, -0.25], color: COAT, colorTop: COAT_LIGHT, mirror: true });
    // Federbusch auf dem Rosskopf
    head.cone({ r: 0.045, h: 0.17, seg: 6, base: [0, 1.18, 0.5], rot: [-0.4, 0, 0], color: PURPLE, colorTop: LAVENDER });

    const tail = m.part('tail', { pivot: [0, 0.72, -0.4], parent: 'horse' });
    tail.cone({ r: 0.07, h: 0.38, seg: 6, base: [0, 0.73, -0.38], rot: [-2.5, 0, 0], color: COAT });

    /** @type {[string, number, number, number][]} */
    const legSpec = [['legFL', -0.115, 0.25, 1], ['legFR', 0.115, 0.25, 1], ['legBL', -0.115, -0.3, -1], ['legBR', 0.115, -0.3, -1]];
    for (const [name, x, z, front] of legSpec) {
      const leg = m.part(name, { pivot: [x, 0.45, z] });
      const knee = /** @type {Vec3} */ ([x, 0.22, z + (front > 0 ? 0.03 : -0.04)]);
      limb(leg, [x, 0.48, z], knee, 0.068, 0.05, COAT);
      leg.sphere({ r: 0.052, detail: 0, at: knee, color: COAT });
      limb(leg, knee, [x, 0.05, z], 0.047, 0.042, COAT);
      leg.cyl({ r: 0.062, rTop: 0.05, h: 0.07, seg: 6, base: [x, 0, z + 0.005], color: LAVENDER });
    }

    // --- Reiter ---
    const RZ = -0.06;
    const rider = m.part('rider', { pivot: [0, 0.86, RZ], parent: 'horse' });
    rider.lathe({ points: [[0, 0.85], [0.15, 0.87], [0.175, 0.98], [0.165, 1.1], [0.11, 1.16], [0, 1.17]], seg: 8, scale: [1, 1, 0.85], color: IRON, colorTop: IRON_LIGHT, at: [0, 0, RZ] });
    rider.torus({ r: 0.162, tube: 0.02, seg: 10, tubeSeg: 3, at: [0, 0.92, RZ], scale: [1, 1, 0.85], color: GOLD });
    rider.box({ size: [0.06, 0.22, 0.014], at: [0, 1.02, RZ + 0.148], rot: [-0.05, 0, 0], color: PURPLE });
    // Beine seitlich am Ross
    limb(rider, [0.12, 0.89, RZ], [0.25, 0.78, RZ + 0.1], 0.06, 0.05, IRON, { mirror: true });
    limb(rider, [0.25, 0.78, RZ + 0.1], [0.27, 0.58, RZ + 0.06], 0.05, 0.045, IRON, { mirror: true });
    rider.sphere({ r: 0.05, detail: 0, at: [0.275, 0.57, RZ + 0.1], scale: [1, 0.8, 1.4], color: IRON_LIGHT, mirror: true });
    // Mächtige Schulterplatten mit Goldkante
    rider.sphere({ r: 0.1, detail: 0, at: [0.19, 1.13, RZ], scale: [1, 0.65, 1.1], color: IRON, colorTop: IRON_LIGHT, mirror: true });
    rider.torus({ r: 0.085, tube: 0.016, seg: 8, tubeSeg: 3, at: [0.2, 1.11, RZ], scale: [1, 1, 1.1], color: GOLD, mirror: true });

    // Kopf: offener Helm mit Krone, darin ein altes, gutmütiges Gesicht mit weißem Schnauzbart.
    const rhead = m.part('rhead', { pivot: [0, 1.17, RZ], parent: 'rider' });
    rhead.cyl({ r: 0.135, rTop: 0.125, h: 0.2, seg: 8, base: [0, 1.16, RZ - 0.035], color: IRON, colorTop: IRON_LIGHT });
    rhead.dome({ r: 0.125, seg: 8, rings: 2, at: [0, 1.36, RZ - 0.035], scale: [1, 0.45, 1], color: IRON_LIGHT });
    rhead.sphere({ r: 0.105, at: [0, 1.255, RZ + 0.05], scale: [1, 1.05, 0.85], color: SKIN });
    rhead.box({ size: [0.024, 0.034, 0.014], at: [0.036, 1.28, RZ + 0.137], color: DARK, mirror: true });
    rhead.box({ size: [0.05, 0.014, 0.012], at: [0.038, 1.312, RZ + 0.132], rot: [0, 0, -0.15], color: MOUSTACHE, mirror: true });
    rhead.sphere({ r: 0.022, detail: 0, at: [0, 1.252, RZ + 0.142], color: SKIN_DARK });
    rhead.extrude({ points: [[0, 0.008], [0.05, 0.016], [0.1, -0.006], [0.135, 0.03], [0.13, -0.03], [0.07, -0.045], [0, -0.02], [-0.07, -0.045], [-0.13, -0.03], [-0.135, 0.03], [-0.1, -0.006], [-0.05, 0.016]], depth: 0.03, at: [0, 1.215, RZ + 0.13], color: MOUSTACHE, colorTop: '#f4efe4' });
    // Stirnband des Helms über dem Gesicht
    rhead.box({ size: [0.2, 0.04, 0.05], at: [0, 1.335, RZ + 0.085], color: IRON_LIGHT });
    // Goldene Krone um den Helm
    rhead.cyl({ r: 0.14, h: 0.045, seg: 8, base: [0, 1.34, RZ - 0.035], color: GOLD, colorTop: GOLD_LIGHT });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      rhead.cone({ r: 0.036, h: 0.075, seg: 4, base: [Math.sin(a) * 0.125, 1.38, RZ - 0.035 + Math.cos(a) * 0.125], color: GOLD_LIGHT });
    }
    const plume = m.part('plume', { pivot: [0, 1.4, RZ - 0.035], parent: 'rhead' });
    plume.extrude({ points: [[0.04, 0], [-0.04, 0], [-0.1, 0.1], [-0.22, 0.16], [-0.32, 0.14], [-0.2, 0.22], [-0.06, 0.23], [0.05, 0.15]], depth: 0.07, base: [0, 1.38, RZ - 0.02], rot: [0, HALF_PI, 0], color: PURPLE, colorTop: LAVENDER });

    // Lanzenarm rechts: die Lanze steht schräg erhoben (im Galopp wird sie gesenkt), mit Wimpel
    const lance = m.part('lance', { pivot: [0.2, 1.1, RZ], parent: 'rider' });
    limb(lance, [0.2, 1.1, RZ], [0.24, 0.98, RZ + 0.12], 0.05, 0.045, IRON, { seg: 6 });
    lance.sphere({ r: 0.045, detail: 0, at: [0.245, 0.97, RZ + 0.14], color: IRON_LIGHT });
    /** Punkt auf der Lanzenachse, s Felder vor der Hand. @param {number} s @returns {Vec3} */
    const L = (s) => [0.255, 0.97 + s * LANCE_DY, RZ + 0.14 + s * LANCE_DZ];
    limb(lance, L(-0.36), L(0.03), 0.03, 0.04, WOOD, { seg: 6 });
    limb(lance, L(0.03), L(0.14), 0.095, 0.03, GOLD, { seg: 8, colorTop: GOLD_LIGHT });
    limb(lance, L(0.14), L(0.46), 0.042, 0.032, PURPLE, { seg: 6 });
    limb(lance, L(0.46), L(0.74), 0.032, 0.022, CREAM, { seg: 6 });
    limb(lance, L(0.74), L(0.88), 0.026, 0.004, STEEL_LIGHT, { seg: 6 });
    const pp = L(0.62);
    const pennon = m.part('pennon', { pivot: pp, parent: 'lance' });
    pennon.extrude({ points: [[0, 0], [0, 0.13], [-0.26, 0.1], [-0.16, 0.065], [-0.26, 0.02]], depth: 0.014, at: pp, rot: [-0.45, -HALF_PI, 0], color: GOLD, colorTop: GOLD_LIGHT, shade: 0 });

    // Schildarm links mit violettem Drachenschild
    const sh = m.part('shield', { pivot: [-0.2, 1.1, RZ], parent: 'rider' });
    limb(sh, [-0.2, 1.1, RZ], [-0.25, 0.98, RZ + 0.08], 0.05, 0.045, IRON, { seg: 6 });
    kiteShield(sh, [-0.3, 0.97, RZ + 0.06], [-0.35, -0.85, 0], 1.35, GOLD, PURPLE, PURPLE_LIGHT);

    return m.build({
      stride: 1.0,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        // Galopp, sobald er schneller als gewohnt ist (Moment bei halber Kraft).
        const g = Math.max(0, Math.min(1, (ctx.move - 1.25) / 0.5));
        const w = ctx.walk;
        const s = Math.sin(w);
        const c = Math.cos(w);
        const s2 = Math.sin(w - 0.5);
        const trot = 0.42 * k * (1 - g);
        pose.legFL.rotation.x = s * trot + (s * 0.7 - 0.1) * g;
        pose.legBR.rotation.x = s * trot + (-s2 * 0.62 + 0.1) * g;
        pose.legFR.rotation.x = -s * trot + (s2 * 0.7 - 0.1) * g;
        pose.legBL.rotation.x = -s * trot + (-s * 0.62 + 0.1) * g;
        pose.horse.position.y += Math.abs(c) * 0.025 * k * (1 - g) + (0.5 - 0.5 * Math.cos(w + 0.8)) * 0.06 * g;
        pose.horse.rotation.x = c * 0.1 * g;
        pose.head.rotation.x = Math.sin(w * 2) * 0.06 * k * (1 - g) + (0.15 - c * 0.12) * g;
        pose.tail.rotation.x = -0.1 * k - 0.4 * g + Math.sin(w * 2) * 0.06 * k;
        pose.tail.rotation.y = Math.sin(ctx.t * 1.8 + ctx.seed * 6) * 0.2;
        // Reiter thront aufrecht, im Galopp beugt er sich mit gesenkter Lanze vor.
        pose.rider.rotation.x = 0.25 * g - c * 0.04 * k;
        pose.rhead.rotation.y = Math.sin(ctx.t * 0.6 + ctx.seed * 6) * 0.2 * (1 - g);
        pose.lance.rotation.x = Math.sin(w * 2) * 0.03 * k + 0.2 * g;
        pose.shield.rotation.x = Math.sin(w * 2 + 1) * 0.04 * k;
        const f = ctx.t * 4 + ctx.seed * 6;
        pose.plume.rotation.x = Math.sin(f) * 0.06 - 0.06 * k - 0.15 * g;
        pose.pennon.rotation.y = Math.sin(f * 1.6) * 0.25;
        A.flinch(pose, ctx, 'rider', 0.08);
        A.flinch(pose, ctx, 'horse', 0.05);
      },
    });
  },
};
