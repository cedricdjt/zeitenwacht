// @ts-check
// Gegner der Nahen Zukunft: freundliche, rundliche Spielzeugmaschinen in Weiß, Schiefer und Neon.
// Wachroboter (Standard), Roboterhund (schnell), Drohne (fliegend, Schwarm), Schildwagen (Schild, zäh)
// und der Boss "Goliath-Konvoi" (Schild, Träger).

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder, ModelBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der Maschinen ---
const WHITE = '#eef1f5';
const WHITE_SHADE = '#c3ccda';
const SLATE = '#59647a';
const SLATE_LIGHT = '#7a869e';
const SLATE_DARK = '#3d4455';
const DARK = '#2c303c';
const STEEL = '#9fabbf';
const STEEL_LIGHT = '#cdd6e4';
const YELLOW = '#f2c230';
const YELLOW_LIGHT = '#ffd95a';
const TEAL = '#2ee6c8';
const TEAL_SOFT = '#7ff2df';
const MAGENTA = '#ff4fa3';

const HALF_PI = Math.PI / 2;

/**
 * Setzt einen (verjüngten) Zylinder zwischen zwei Punkte im Modellraum.
 * @param {PartBuilder} part
 * @param {Vec3} a Anfang (Radius r0)
 * @param {Vec3} b Ende (Radius r1)
 * @param {number} r0
 * @param {number} r1
 * @param {string} color
 * @param {number} [seg]
 */
function limb(part, a, b, r0, r1, color, seg = 5) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  part.cyl({
    r: r0, rTop: r1, h: len, seg,
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [Math.atan2(dz, dy), 0, -Math.asin(dx / len)],
    color,
  });
}

/**
 * Ein Radpaar auf einer Achse als eigenes Teil; dreht sich um die Achse (X).
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {number} x seitliche Lage der Radmitte
 * @param {number} r Radius
 * @param {number} z Lage der Achse
 * @param {number} w Radbreite
 * @param {string} cap Farbe der Radkappe
 */
function wheelPair(m, name, x, r, z, w, cap) {
  const p = m.part(name, { pivot: [0, r, z] });
  p.cyl({ r, h: w, seg: 10, at: [x, r, z], rot: [0, 0, HALF_PI], color: DARK, shade: 0, mirror: true });
  p.cyl({ r: r * 0.55, h: w + 0.016, seg: 6, at: [x, r, z], rot: [0, 0, HALF_PI], color: cap, shade: 0, mirror: true });
  // Ein Quersteg auf der Kappe macht die Drehung sichtbar.
  p.box({ size: [w + 0.03, r * 0.3, r * 1.25], at: [x, r, z], color: SLATE_DARK, shade: 0, mirror: true });
}

/**
 * Schildgenerator: Sockel, pulsierende Energiekugel (Teil `emitter`) und kreisender Ring (Teil `ring`).
 * Dasselbe Motiv bei allen Schildträgern, damit die Eigenschaft wiedererkannt wird.
 * @param {ModelBuilder} m
 * @param {PartBuilder} body Teil, auf dem der Sockel sitzt
 * @param {Vec3} base Mitte der Standfläche des Sockels
 * @param {number} s Maßstab
 */
function shieldGenerator(m, body, base, s) {
  const [x, y, z] = base;
  body.cyl({ r: 0.1 * s, rTop: 0.075 * s, h: 0.05 * s, seg: 8, base: [x, y, z], color: STEEL, colorTop: STEEL_LIGHT });
  body.cyl({ r: 0.035 * s, h: 0.06 * s, seg: 6, base: [x, y + 0.04 * s, z], color: SLATE_DARK });
  const cy = y + 0.17 * s;
  m.part('emitter', { pivot: [x, cy, z], parent: body.name })
    .sphere({ r: 0.085 * s, detail: 1, at: [x, cy, z], color: TEAL, colorTop: TEAL_SOFT, glow: 1.25 });
  m.part('ring', { pivot: [x, cy, z], parent: body.name })
    .torus({ r: 0.135 * s, tube: 0.022 * s, seg: 10, tubeSeg: 4, at: [x, cy, z], rot: [0.35, 0, 0], color: STEEL_LIGHT, shade: 0 });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Standard: weißer Wachroboter mit türkisem Visier, dünnen Gliedern und Kugelgelenken; steifer Gleichschritt.
  'enemy.zukunft.wachroboter': () => {
    const m = createModel('enemy.zukunft.wachroboter');
    const body = m.part('body', { pivot: [0, 0.2, 0] });
    body.cyl({ r: 0.07, rTop: 0.085, h: 0.05, seg: 8, base: [0, 0.18, 0], color: SLATE_DARK });
    body.sphere({ r: 0.14, at: [0, 0.31, 0], scale: [1, 0.9, 0.82], color: '#d9e0ea', colorTop: WHITE });
    body.box({ size: [0.09, 0.05, 0.02], at: [0, 0.32, 0.11], color: TEAL, glow: true });
    body.sphere({ r: 0.045, detail: 0, at: [0.145, 0.365, 0], color: SLATE, mirror: true });
    body.cyl({ r: 0.035, h: 0.05, seg: 6, base: [0, 0.4, 0], color: SLATE_DARK });

    const head = m.part('head', { pivot: [0, 0.42, 0], parent: 'body' });
    head.sphere({ r: 0.105, at: [0, 0.505, 0], scale: [1.12, 0.85, 1], color: '#d9e0ea', colorTop: WHITE });
    head.box({ size: [0.2, 0.075, 0.09], at: [0, 0.505, 0.062], color: DARK });
    head.box({ size: [0.16, 0.038, 0.014], at: [0, 0.507, 0.112], color: TEAL, colorTop: TEAL_SOFT, glow: true });
    // Leuchtstreifen auf dem Scheitel: von oben das Erkennungszeichen.
    head.box({ size: [0.05, 0.014, 0.11], at: [0, 0.594, -0.005], color: TEAL, glow: true });
    head.cyl({ r: 0.015, h: 0.06, seg: 5, base: [0.075, 0.57, -0.02], color: SLATE });
    head.sphere({ r: 0.024, detail: 0, at: [0.075, 0.64, -0.02], color: TEAL, glow: true });

    for (const [name, sx] of /** @type {[string, number][]} */ ([['legL', -0.06], ['legR', 0.06]])) {
      const leg = m.part(name, { pivot: [sx, 0.2, 0] });
      leg.cyl({ r: 0.024, h: 0.18, seg: 5, base: [sx, 0.03, 0], color: SLATE });
      leg.sphere({ r: 0.036, detail: 0, at: [sx, 0.115, 0], color: STEEL });
      leg.box({ size: [0.08, 0.045, 0.12], base: [sx, 0, 0.018], color: WHITE_SHADE, colorTop: WHITE });
    }
    for (const [name, sx] of /** @type {[string, number][]} */ ([['armL', -0.16], ['armR', 0.16]])) {
      const arm = m.part(name, { pivot: [sx, 0.365, 0], parent: 'body' });
      arm.cyl({ r: 0.022, h: 0.15, seg: 5, base: [sx, 0.21, 0], color: SLATE });
      arm.sphere({ r: 0.04, detail: 0, at: [sx, 0.2, 0], color: WHITE });
    }

    return m.build({
      stride: 0.45,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        // Steifer, genauer Gang: wenig Wippen, kaum Schwanken, Arme im Takt.
        A.walkBiped(pose, ctx, WALK_ROBOT);
        pose.head.rotation.y = Math.sin(ctx.t * 1.3 + ctx.seed * 6) * 0.35 * (1 - 0.5 * k);
        A.flinch(pose, ctx, 'body', 0.16);
      },
    });
  },

  // Schnell: flacher gelb-schwarzer Roboterhund mit vier nach hinten geknickten Beinen und einem Leuchtauge.
  'enemy.zukunft.roboterhund': () => {
    const m = createModel('enemy.zukunft.roboterhund');
    const body = m.part('body', { pivot: [0, 0.25, 0] });
    body.box({ size: [0.18, 0.1, 0.38], at: [0, 0.26, -0.01], rot: [0.07, 0, 0], color: YELLOW, colorTop: YELLOW_LIGHT });
    body.box({ size: [0.188, 0.108, 0.06], at: [0, 0.262, -0.1], rot: [0.07, 0, 0], color: DARK, shade: 0 });
    body.box({ size: [0.188, 0.108, 0.06], at: [0, 0.255, 0.04], rot: [0.07, 0, 0], color: DARK, shade: 0 });
    body.box({ size: [0.05, 0.014, 0.07], at: [0, 0.315, -0.03], rot: [0.07, 0, 0], color: TEAL, glow: true });

    const head = m.part('head', { pivot: [0, 0.27, 0.17], parent: 'body' });
    head.box({ size: [0.15, 0.12, 0.12], at: [0, 0.28, 0.235], color: SLATE_DARK, colorTop: SLATE });
    head.cyl({ r: 0.04, h: 0.02, seg: 8, at: [0, 0.285, 0.3], rot: [HALF_PI, 0, 0], color: TEAL, colorTop: TEAL_SOFT, glow: true });
    head.pyramid({ size: [0.05, 0.075, 0.04], base: [0.05, 0.335, 0.2], color: YELLOW, mirror: true });

    const tail = m.part('tail', { pivot: [0, 0.3, -0.19], parent: 'body' });
    limb(tail, [0, 0.3, -0.19], [0, 0.4, -0.25], 0.016, 0.014, SLATE_DARK);
    tail.sphere({ r: 0.028, detail: 0, at: [0, 0.41, -0.255], color: TEAL, glow: true });

    /** @type {[string, number, number][]} */
    const legs = [['legFL', -0.105, 0.12], ['legFR', 0.105, 0.12], ['legBL', -0.105, -0.15], ['legBR', 0.105, -0.15]];
    for (const [name, x, z] of legs) {
      const leg = m.part(name, { pivot: [x, 0.24, z] });
      leg.sphere({ r: 0.04, detail: 0, at: [x, 0.24, z], color: DARK });
      limb(leg, [x, 0.24, z], [x, 0.13, z - 0.07], 0.026, 0.022, SLATE_DARK);
      leg.sphere({ r: 0.032, detail: 0, at: [x, 0.13, z - 0.07], color: YELLOW });
      limb(leg, [x, 0.13, z - 0.07], [x, 0.025, z + 0.01], 0.02, 0.018, SLATE_DARK);
      leg.sphere({ r: 0.03, detail: 0, at: [x, 0.03, z + 0.012], color: DARK });
    }

    return m.build({
      stride: 0.6,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.walkQuadruped(pose, ctx, WALK_DOG);
        pose.body.rotation.x = (0.08 + Math.sin(ctx.walk * 2) * 0.03) * k;
        pose.head.rotation.y = Math.sin(ctx.t * 1.7 + ctx.seed * 6) * 0.25 * (1 - k);
        pose.tail.rotation.z = Math.sin(ctx.t * 9 + ctx.seed * 6) * 0.45;
        A.flinch(pose, ctx, 'body', 0.18);
      },
    });
  },

  // Fliegend, Schwarm: kleine Quadrokopter-Drohne, flaches X mit vier Rotoren und magentafarbenem Licht.
  'enemy.zukunft.drohne': () => {
    const m = createModel('enemy.zukunft.drohne');
    const Y = 0.3;
    const D = 0.15;
    const body = m.part('body', { pivot: [0, Y, 0] });
    body.box({ size: [0.46, 0.03, 0.055], at: [0, Y, 0], rot: [0, Math.PI / 4, 0], color: SLATE_LIGHT, shade: 0 });
    body.box({ size: [0.46, 0.03, 0.055], at: [0, Y, 0], rot: [0, -Math.PI / 4, 0], color: SLATE_LIGHT, shade: 0 });
    body.sphere({ r: 0.08, detail: 1, at: [0, Y + 0.005, 0], scale: [1, 0.62, 1.25], color: SLATE, colorTop: STEEL_LIGHT });
    // Licht: unten die LED, oben ein Streifen (von oben sichtbar), vorn das Auge.
    body.sphere({ r: 0.035, detail: 0, at: [0, Y - 0.05, 0], color: MAGENTA, glow: true });
    body.box({ size: [0.045, 0.014, 0.09], at: [0, Y + 0.056, -0.01], color: MAGENTA, glow: true });
    body.box({ size: [0.08, 0.03, 0.02], at: [0, Y + 0.005, 0.098], color: MAGENTA, glow: true });
    for (const [i, sx, sz] of /** @type {[number, number, number][]} */ ([[1, -1, 1], [2, 1, 1], [3, -1, -1], [4, 1, -1]])) {
      const x = sx * D;
      const z = sz * D;
      body.cyl({ r: 0.03, h: 0.06, seg: 6, at: [x, Y + 0.01, z], color: SLATE_DARK });
      const rotor = m.part('rotor' + i, { pivot: [x, Y + 0.045, z], parent: 'body' });
      rotor.cyl({ r: 0.088, h: 0.008, seg: 8, at: [x, Y + 0.045, z], color: STEEL_LIGHT, shade: 0 });
      rotor.box({ size: [0.17, 0.012, 0.03], at: [x, Y + 0.05, z], color: SLATE, shade: 0 });
    }

    return m.build({
      stride: 0.6,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        A.hover(pose, ctx, 'body', 0.03, 1.1);
        // Neigt sich im Flug nach vorn und pendelt leicht.
        pose.body.rotation.x = 0.16 * k + Math.sin(ctx.t * 2.3 + ctx.seed * 20) * 0.04;
        pose.body.rotation.z = Math.sin(ctx.t * 1.7 + ctx.seed * 30) * 0.07;
        const a = ctx.t * 26 + ctx.seed * 6;
        pose.rotor1.rotation.y = a;
        pose.rotor2.rotation.y = -a;
        pose.rotor3.rotation.y = -a + 1;
        pose.rotor4.rotation.y = a + 1;
        A.flinch(pose, ctx, 'body', 0.25);
      },
    });
  },

  // Schild, zäh: sechsrädriger, fahrerloser Keilwagen in Dunkelgrau mit Sensormast und Schildgenerator.
  'enemy.zukunft.schildwagen': () => {
    const m = createModel('enemy.zukunft.schildwagen');
    const R = 0.09;
    const body = m.part('body', { pivot: [0, 0.1, 0] });
    body.box({ size: [0.34, 0.1, 0.78], at: [0, 0.15, 0], color: DARK });
    // Keil: vorn flach, hinten hoch.
    body.wedge({ size: [0.42, 0.2, 0.5], at: [0, 0.3, 0.13], rot: [0, Math.PI, 0], color: SLATE_DARK, colorTop: SLATE });
    body.box({ size: [0.42, 0.2, 0.28], at: [0, 0.3, -0.26], color: SLATE_DARK, colorTop: SLATE });
    // Panzerplatten in Metallfarbe: Bugplatte und Seitenschürzen.
    body.box({ size: [0.3, 0.022, 0.36], at: [0, 0.31, 0.13], rot: [0.381, 0, 0], color: STEEL, colorTop: STEEL_LIGHT });
    body.box({ size: [0.03, 0.1, 0.7], at: [0.215, 0.215, -0.02], color: STEEL, mirror: true });
    // Leuchtstreifen: Front und Dachkanten.
    body.box({ size: [0.32, 0.035, 0.02], at: [0, 0.2, 0.386], color: TEAL, colorTop: TEAL_SOFT, glow: true });
    body.box({ size: [0.03, 0.016, 0.26], at: [0.18, 0.404, -0.26], color: TEAL, glow: true, mirror: true });
    body.box({ size: [0.2, 0.03, 0.02], at: [0, 0.33, -0.402], color: MAGENTA, glow: true });
    shieldGenerator(m, body, [0.02, 0.4, -0.24], 1);
    // Sensormast mit kreisendem Kopf.
    body.cyl({ r: 0.018, h: 0.2, seg: 5, base: [-0.15, 0.4, -0.34], color: STEEL });
    const sensor = m.part('sensor', { pivot: [-0.15, 0.62, -0.34], parent: 'body' });
    sensor.box({ size: [0.09, 0.045, 0.05], at: [-0.15, 0.62, -0.34], color: WHITE });
    sensor.box({ size: [0.05, 0.025, 0.014], at: [-0.15, 0.62, -0.31], color: MAGENTA, glow: true });

    wheelPair(m, 'wheelsF', 0.21, R, 0.27, 0.075, STEEL);
    wheelPair(m, 'wheelsM', 0.21, R, 0, 0.075, STEEL);
    wheelPair(m, 'wheelsB', 0.21, R, -0.27, 0.075, STEEL);

    return m.build({
      stride: 0.6,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const roll = ctx.walk * 1.061;
        pose.wheelsF.rotation.x = roll;
        pose.wheelsM.rotation.x = roll;
        pose.wheelsB.rotation.x = roll;
        pose.body.position.y = Math.abs(Math.sin(ctx.walk * 1.5)) * 0.008 * k;
        pose.body.rotation.x = Math.sin(ctx.walk * 0.75) * 0.012 * k;
        A.pulse(pose, ctx, 'emitter', 0.1, 0.7);
        pose.ring.rotation.y = ctx.t * 1.6 + ctx.seed * 6;
        pose.sensor.rotation.y = Math.sin(ctx.t * 1.1 + ctx.seed * 6) * 1.2;
        A.flinch(pose, ctx, 'body', 0.1);
      },
    });
  },

  // Boss, Schild, Träger: autonomer Schwerlaster als ein starrer Körper. Weiße Kabine mit Sensorkuppel,
  // Containerteil mit drei Dachluken (klappen bei 75 / 50 / 25 % auf), Schildgenerator als Krone.
  'boss.zukunft.goliath': () => {
    const m = createModel('boss.zukunft.goliath');
    const R = 0.13;
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    // Fahrgestell und Stoßfänger
    body.box({ size: [0.6, 0.14, 1.36], at: [0, 0.25, 0], color: DARK });
    body.box({ size: [0.82, 0.1, 0.07], at: [0, 0.2, 0.675], color: STEEL, colorTop: STEEL_LIGHT });
    body.box({ size: [0.82, 0.08, 0.05], at: [0, 0.2, -0.685], color: STEEL });

    // Kabine
    body.box({ size: [0.72, 0.4, 0.38], at: [0, 0.5, 0.49], color: WHITE_SHADE, colorTop: WHITE });
    body.box({ size: [0.62, 0.07, 0.3], at: [0, 0.73, 0.48], color: WHITE });
    body.box({ size: [0.62, 0.16, 0.03], at: [0, 0.56, 0.672], color: DARK });
    body.box({ size: [0.52, 0.07, 0.014], at: [0, 0.565, 0.69], color: TEAL, colorTop: TEAL_SOFT, glow: true });
    body.box({ size: [0.13, 0.06, 0.02], at: [0.25, 0.37, 0.682], color: TEAL_SOFT, glow: true, mirror: true });
    body.box({ size: [0.035, 0.02, 0.36], at: [0.33, 0.708, 0.49], color: TEAL, glow: true, mirror: true });
    // Sensorkuppel mit kreisendem Leuchtband
    body.dome({ r: 0.12, seg: 8, rings: 3, at: [0, 0.765, 0.5], color: STEEL, colorTop: WHITE });
    body.cyl({ r: 0.14, h: 0.022, seg: 8, at: [0, 0.776, 0.5], color: TEAL, glow: true });
    body.cyl({ r: 0.018, h: 0.2, seg: 5, base: [0.3, 0.7, 0.34], color: STEEL, mirror: true });
    body.sphere({ r: 0.035, detail: 0, at: [0.3, 0.92, 0.34], color: TEAL, glow: true, mirror: true });
    const radar = m.part('radar', { pivot: [0, 0.88, 0.5], parent: 'body' });
    radar.box({ size: [0.2, 0.03, 0.05], at: [0, 0.895, 0.5], color: SLATE });
    radar.box({ size: [0.05, 0.036, 0.056], at: [0.085, 0.896, 0.5], color: MAGENTA, glow: true, mirror: true });

    // Kragen zwischen Kabine und Container trägt den Schildgenerator.
    body.box({ size: [0.5, 0.56, 0.16], at: [0, 0.6, 0.23], color: SLATE_DARK, colorTop: SLATE });
    shieldGenerator(m, body, [0, 0.88, 0.23], 1.25);

    // Container
    body.box({ size: [0.8, 0.5, 0.84], at: [0, 0.57, -0.26], color: SLATE_DARK, colorTop: SLATE });
    for (const z of [-0.52, -0.26, 0]) {
      body.box({ size: [0.03, 0.3, 0.2], at: [0.405, 0.6, z], color: STEEL, colorTop: STEEL_LIGHT, mirror: true });
    }
    body.box({ size: [0.02, 0.035, 0.8], at: [0.405, 0.38, -0.26], color: MAGENTA, glow: true, mirror: true });
    body.box({ size: [0.16, 0.05, 0.02], at: [0.26, 0.42, -0.685], color: MAGENTA, glow: true, mirror: true });
    // Gelber Dachrahmen (das Abzeichen des Bosses) um den Drohnenschacht
    body.box({ size: [0.06, 0.07, 0.84], at: [0.37, 0.845, -0.26], color: YELLOW, colorTop: YELLOW_LIGHT, mirror: true });
    body.box({ size: [0.68, 0.07, 0.06], at: [0, 0.845, 0.13], color: YELLOW, colorTop: YELLOW_LIGHT });
    body.box({ size: [0.68, 0.07, 0.06], at: [0, 0.845, -0.65], color: YELLOW, colorTop: YELLOW_LIGHT });
    body.box({ size: [0.68, 0.01, 0.72], at: [0, 0.826, -0.26], color: DARK, shade: 0 });

    // Drei Luken mit je zwei Flügeln, außen angeschlagen; darunter warten die Drohnen.
    for (let i = 0; i < 3; i++) {
      const z = HATCH_Z[i];
      for (const x of [-0.16, 0.16]) {
        body.box({ size: [0.2, 0.02, 0.035], at: [x, 0.841, z], rot: [0, Math.PI / 4, 0], color: STEEL_LIGHT, shade: 0 });
        body.box({ size: [0.2, 0.02, 0.035], at: [x, 0.841, z], rot: [0, -Math.PI / 4, 0], color: STEEL_LIGHT, shade: 0 });
        body.sphere({ r: 0.035, detail: 0, at: [x, 0.848, z], scale: [1, 0.35, 1], color: MAGENTA, glow: true });
      }
      for (const sx of [-1, 1]) {
        const leaf = m.part('hatch' + (i + 1) + (sx < 0 ? 'L' : 'R'), { pivot: [0.325 * sx, 0.885, z], parent: 'body' });
        leaf.box({ size: [0.32, 0.03, 0.21], at: [0.163 * sx, 0.885, z], color: STEEL, colorTop: STEEL_LIGHT });
        leaf.box({ size: [0.04, 0.012, 0.15], at: [0.04 * sx, 0.904, z], color: MAGENTA, glow: true });
        // Die Unterseite leuchtet: offene Luken sind aus jeder Richtung zu sehen.
        leaf.box({ size: [0.2, 0.006, 0.09], at: [0.165 * sx, 0.867, z], color: MAGENTA, glow: 0.9 });
      }
    }

    wheelPair(m, 'wheels1', 0.385, R, 0.5, 0.12, YELLOW);
    wheelPair(m, 'wheels2', 0.385, R, 0.14, 0.12, YELLOW);
    wheelPair(m, 'wheels3', 0.385, R, -0.2, 0.12, YELLOW);
    wheelPair(m, 'wheels4', 0.385, R, -0.52, 0.12, YELLOW);

    return m.build({
      stride: 0.9,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const roll = ctx.walk * 1.102;
        pose.wheels1.rotation.x = roll;
        pose.wheels2.rotation.x = roll;
        pose.wheels3.rotation.x = roll;
        pose.wheels4.rotation.x = roll;
        pose.body.position.y = Math.abs(Math.sin(ctx.walk * 1.5)) * 0.01 * k;
        pose.body.rotation.z = Math.sin(ctx.walk * 0.75) * 0.01 * k;
        // Luken klappen nacheinander auf, wenn die Lebenspunkte unter 75 / 50 / 25 % fallen.
        const wobble = 1.75 + Math.sin(ctx.t * 3 + ctx.seed * 6) * 0.06;
        const o1 = hatchOpen(ctx.hp, 0.75) * wobble;
        const o2 = hatchOpen(ctx.hp, 0.5) * wobble;
        const o3 = hatchOpen(ctx.hp, 0.25) * wobble;
        pose.hatch1L.rotation.z = o1;
        pose.hatch1R.rotation.z = -o1;
        pose.hatch2L.rotation.z = o2;
        pose.hatch2R.rotation.z = -o2;
        pose.hatch3L.rotation.z = o3;
        pose.hatch3R.rotation.z = -o3;
        A.pulse(pose, ctx, 'emitter', 0.1, 0.6);
        pose.ring.rotation.y = ctx.t * 1.3 + ctx.seed * 6;
        pose.radar.rotation.y = ctx.t * 1.8;
        A.flinch(pose, ctx, 'body', 0.06);
      },
    });
  },
};

/** Lage der drei Dachluken des Goliath entlang Z (vorn nach hinten). */
const HATCH_Z = [-0.02, -0.26, -0.5];
/** Gangart des Wachroboters. */
const WALK_ROBOT = { swing: 0.5, armSwing: 0.45, bob: 0.012, sway: 0.015 };
/** Trab des Roboterhunds. */
const WALK_DOG = { swing: 0.6, bob: 0.02, nod: 0.05 };

/**
 * Öffnungsgrad einer Dachluke: 0 über der Schwelle, weich auf 1, sobald die Lebenspunkte darunter fallen.
 * @param {number} hp Lebenspunkte 0..1
 * @param {number} at Schwelle
 * @returns {number}
 */
function hatchOpen(hp, at) {
  const x = Math.max(0, Math.min(1, (at - hp) / 0.04));
  return x * x * (3 - 2 * x);
}
