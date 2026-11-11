// @ts-check
// Nahe Zukunft: Requisiten und die Basis (Zeitenwacht-Zentrale).
// Eine grüne, freundliche Zukunft bei Nacht: weiße Bauten, dunkles Glas, viel Grün, wenige ruhige Lichter.
// Leuchtfarben: Türkis, etwas Magenta; das warme Orange gehört allein der Flamme.
import * as A from '../../../render/anim.js';
import { createModel, tone } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der Nahen Zukunft ---
const WHITE = '#eef1f4';
const WHITE_SHADE = '#c9d2de';
const GREY = '#8f9cb0';
const SLATE = '#5d6a84';
const DARK = '#2c3446';
const GLASS = '#3c6f9c';
const GLASS_LIGHT = '#8cc4e0';
const GLASS_DARK = '#27456e';
const SOLAR = '#263f86';
const SOLAR_LIGHT = '#4a70c4';
const LEAF = '#3c9a5c';
const LEAF_TOP = '#9be07c';
const LEAF_DARK = '#2c7a4e';
const BARK = '#7a6a5c';
const TEAL = '#2ee6c8';
const TEAL_SOFT = '#8ff2e0';
const MAGENTA = '#ff4fa3';
const PINK = '#ff8cc8';
const WINDOW = '#cdeff0';
const FLAME = '#ff7a1c';
const FLAME_TOP = '#ffc640';
const FLAME_CORE = '#ffd060';
const FLAME_CORE_TOP = '#fff2b8';

const TAU = Math.PI * 2;

/**
 * Laubkugel mit hellem Scheitel.
 * @param {PartBuilder} p
 * @param {Vec3} at
 * @param {number} r
 * @param {number} [turn]
 * @param {number} [flat]
 */
function leafBall(p, at, r, turn = 0, flat = 0.85) {
  p.sphere({ r, detail: 1, at, scale: [1, flat, 1], rot: [0, turn, 0], color: LEAF, colorTop: LEAF_TOP, faceJitter: 0.08 });
}

/**
 * Sechseckiger weißer Pflanzkübel mit türkisem Leuchtring; die Unterkante liegt bei (x, y, z).
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {number} h
 */
function planter(p, x, y, z, r, h) {
  p.cyl({ r: r * 0.86, rTop: r, h, seg: 6, base: [x, y, z], color: WHITE_SHADE, colorTop: WHITE });
  p.cyl({ r: r * 0.93, h: 0.035, seg: 6, base: [x, y + h * 0.42, z], color: TEAL, glow: 1.0 });
  p.cyl({ r: r * 0.84, h: 0.02, seg: 6, base: [x, y + h, z], color: LEAF_DARK, shade: 0 });
}

/**
 * Geneigtes Solarmodul: dunkelblaue Platte mit hellem Rahmen. `yaw` dreht es um Y, die Oberkante liegt bei -Z.
 * @param {PartBuilder} p
 * @param {Vec3} at Mittelpunkt
 * @param {number} w Breite (x)
 * @param {number} d Tiefe (z)
 * @param {number} tilt Neigung in Radiant
 * @param {number} [yaw]
 */
function solarPanel(p, at, w, d, tilt, yaw = 0) {
  // Euler XYZ: zuerst wirkt Z, dann Y, dann X. Für "neigen, dann drehen" liegt die Neigung daher auf Z
  // und das Modul wird quer gebaut.
  const rot = /** @type {Vec3} */ ([0, yaw + Math.PI / 2, -tilt]);
  p.box({ size: [d, 0.035, w], at, rot, color: WHITE_SHADE, shade: 0 });
  const up = 0.02;
  p.box({ size: [d - 0.05, 0.02, w - 0.05], at: [at[0], at[1] + up, at[2]], rot, color: SOLAR, colorTop: SOLAR_LIGHT, shade: 0 });
}

/**
 * Einfacher, fester Zufall für Fenstermuster.
 * @param {number} n
 * @returns {number} 0..1
 */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Zeitenwacht-Zentrale: runder weißer Turm auf einem Sockel, oben eine Schale mit Solarkranz. In der offenen
  // Rippenkuppel darüber schwebt die Flamme als warmer Energiekern, von allen Seiten frei zu sehen.
  'base.zukunft': () => {
    const m = createModel('base.zukunft');
    const t = m.part('tower');
    // Sockel
    t.cyl({ r: 1.18, h: 0.1, seg: 12, base: [0, 0, 0], color: SLATE });
    t.cyl({ r: 1.08, h: 0.09, seg: 12, base: [0, 0.1, 0], color: WHITE_SHADE, shade: 0.05 });
    t.torus({ r: 1.1, tube: 0.025, seg: 12, tubeSeg: 4, at: [0, 0.115, 0], color: TEAL, glow: 0.9 });
    // Turmschaft mit Taille und Schale
    t.lathe({ points: [[0, 0.19], [0.7, 0.19], [0.66, 0.5], [0.52, 1.0], [0.5, 1.3], [0.58, 1.56], [0.9, 1.74], [0.9, 1.83], [0, 1.83]], seg: 10, color: WHITE_SHADE, colorTop: WHITE });
    // Fensterband
    t.cyl({ r: 0.535, rTop: 0.52, h: 0.2, seg: 10, base: [0, 1.02, 0], color: GLASS_DARK, colorTop: GLASS });
    t.cyl({ r: 0.545, h: 0.03, seg: 10, base: [0, 1.25, 0], color: TEAL, glow: 0.9 });
    // Eingang vorn (+Z) mit Rampe
    t.box({ size: [0.5, 0.56, 0.2], base: [0, 0.19, 0.62], color: WHITE });
    t.box({ size: [0.34, 0.42, 0.03], base: [0, 0.19, 0.725], color: GLASS_DARK, colorTop: GLASS });
    t.box({ size: [0.4, 0.04, 0.03], base: [0, 0.63, 0.73], color: TEAL, glow: 0.9 });
    t.wedge({ size: [0.5, 0.19, 0.4], base: [0, 0, 0.98], rot: [0, Math.PI, 0], color: WHITE_SHADE });
    // Solarkranz auf dem Schalenrand
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      solarPanel(t, [Math.sin(a) * 0.7, 1.9, Math.cos(a) * 0.7], 0.42, 0.3, -0.32, a + Math.PI);
    }
    // Sockel des Kerns und Rippenkuppel
    const cy = 1.83;
    t.cyl({ r: 0.4, rTop: 0.3, h: 0.14, seg: 8, base: [0, cy, 0], color: DARK, colorTop: SLATE });
    for (let i = 0; i < 2; i++) {
      t.torus({ r: 0.7, tube: 0.035, seg: 14, tubeSeg: 4, at: [0, cy + 0.14, 0], rot: [0, (i / 2) * Math.PI + Math.PI / 4, Math.PI / 2], color: WHITE });
    }
    // Gartenpavillon hinten rechts mit Dachgarten
    const gx = 0.74;
    const gz = -0.52;
    t.lathe({ points: [[0, 0.19], [0.4, 0.19], [0.42, 0.5], [0.36, 0.62], [0, 0.62]], seg: 8, at: [gx, 0, gz], color: WHITE_SHADE, colorTop: WHITE });
    t.cyl({ r: 0.425, h: 0.1, seg: 8, base: [gx, 0.32, gz], color: GLASS_DARK, colorTop: GLASS });
    leafBall(t, [gx - 0.08, 0.68, gz + 0.04], 0.24, 0.3, 0.6);
    leafBall(t, [gx + 0.16, 0.7, gz - 0.12], 0.17, 1.2, 0.7);
    // Solarsegel links
    t.cyl({ r: 0.05, h: 0.5, seg: 6, base: [-0.84, 0.19, -0.2], color: WHITE_SHADE });
    solarPanel(t, [-0.84, 0.74, -0.2], 0.62, 0.46, 0.5, -Math.PI / 2);
    // Baum im Kübel vorn rechts
    planter(t, 0.82, 0.19, 0.5, 0.2, 0.16);
    t.cyl({ r: 0.04, h: 0.3, seg: 5, base: [0.82, 0.35, 0.5], color: BARK });
    const crown = m.part('crown', { pivot: [0.82, 0.6, 0.5] });
    leafBall(crown, [0.82, 0.82, 0.5], 0.26, 0.5);

    // Schwebender Ring um die Kuppel
    const halo = m.part('halo', { pivot: [0, cy + 0.62, 0] });
    halo.torus({ r: 0.62, tube: 0.03, seg: 12, tubeSeg: 4, at: [0, cy + 0.62, 0], color: WHITE });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      halo.box({ size: [0.14, 0.07, 0.07], at: [Math.sin(a) * 0.62, cy + 0.62, Math.cos(a) * 0.62], rot: [0, a + Math.PI / 2, 0], color: TEAL, glow: 1.0 });
    }

    // Die Flamme: warmer Energiekern
    const fy = cy + 0.14;
    const flame = m.part('flame', { pivot: [0, fy, 0] });
    flame.lathe({ points: [[0, 0], [0.22, 0.04], [0.35, 0.22], [0.31, 0.42], [0.15, 0.66], [0, 0.88]], seg: 7, base: [0, fy, 0], color: FLAME, colorTop: FLAME_TOP, glow: 1.05 });
    flame.sphere({ r: 0.2, detail: 0, at: [0.03, fy + 0.24, 0.23], scale: [1, 1.25, 1], color: FLAME_CORE, colorTop: FLAME_CORE_TOP, glow: 1.3 });
    flame.sphere({ r: 0.18, detail: 0, at: [-0.05, fy + 0.24, -0.23], scale: [1, 1.2, 1], color: FLAME_CORE, colorTop: FLAME_CORE_TOP, glow: 1.3 });

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 5.3) * 0.04 + Math.sin(ctx.t * 8.9 + 1.3) * 0.02;
        f.scale.set(s * (1 - flick * 0.6), s * (1 + flick), s * (1 - flick * 0.6));
        f.rotation.y = ctx.t * 0.7;
        pose.halo.rotation.y = ctx.t * 0.25;
        pose.halo.position.y = Math.sin(ctx.t * 0.9) * 0.04;
        A.sway(pose, ctx, 'crown', 0.03, 0.2);
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Windrad: schlanker weißer Mast, drei langsam drehende Flügel. Ruhepose mit einem Flügel senkrecht,
  // damit der Umkreis unter 0,47 bleibt (Randplätze der Insel).
  'prop.zukunft.windrad': () => {
    const m = createModel('prop.zukunft.windrad');
    const p = m.part('mast');
    p.cyl({ r: 0.2, rTop: 0.16, h: 0.08, seg: 8, base: [0, 0, 0], color: GREY });
    p.cyl({ r: 0.085, rTop: 0.05, h: 1.8, seg: 7, base: [0, 0.08, 0], color: WHITE_SHADE, colorTop: WHITE });
    p.cyl({ r: 0.09, h: 0.07, seg: 7, base: [0, 0.5, 0], color: TEAL, glow: 0.9 });
    p.capsule({ r: 0.085, h: 0.16, seg: 6, at: [0, 1.9, -0.02], rot: [Math.PI / 2, 0, 0], color: WHITE });
    p.sphere({ r: 0.045, detail: 0, at: [0, 2.0, -0.08], color: MAGENTA, glow: 1.1 });
    const rotor = m.part('rotor', { pivot: [0, 1.9, 0.12] });
    rotor.cone({ r: 0.075, h: 0.14, seg: 6, base: [0, 1.9, 0.09], rot: [Math.PI / 2, 0, 0], color: WHITE_SHADE });
    for (let i = 0; i < 3; i++) {
      rotor.extrude({ points: [[-0.03, 0], [0.03, 0], [0.085, 0.13], [0.03, 0.46], [-0.025, 0.46], [-0.04, 0.13]], depth: 0.035, base: [0, 1.9, 0.12], rot: [0, 0, (i / 3) * TAU], color: WHITE, shade: 0.08 });
    }
    return m.build({
      animate(pose, ctx) {
        A.spin(pose, 'rotor', (ctx.t * 0.9 + ctx.seed * 6) * 1.0, 'z');
      },
    });
  },

  // Solarfeld: zwei Reihen geneigter dunkelblauer Module auf Pfosten, türkise Leuchtkante.
  'prop.zukunft.solarfeld': () => {
    const m = createModel('prop.zukunft.solarfeld');
    const p = m.part('panels');
    for (const z of [-0.2, 0.22]) {
      for (const x of [-0.24, 0.24]) p.cyl({ r: 0.035, h: 0.3, seg: 5, base: [x, 0, z - 0.03], color: GREY });
      solarPanel(p, [0, 0.33, z], 0.84, 0.36, 0.5);
      p.box({ size: [0.84, 0.03, 0.03], at: [0, 0.245, z + 0.165], color: TEAL, glow: 0.9 });
      // Zellteilung
      for (const x of [-0.21, 0, 0.21]) p.box({ size: [0.02, 0.012, 0.3], at: [x, 0.352, z], rot: [-0.5, 0, 0], color: SOLAR_LIGHT, shade: 0 });
    }
    return m.build();
  },

  // Vertikale Farm: gestapelte Glasetagen mit grünen Pflanzwannen und rosa Pflanzlicht.
  'prop.zukunft.farm': () => {
    const m = createModel('prop.zukunft.farm');
    const p = m.part('farm');
    p.box({ size: [0.62, 0.1, 0.62], base: [0, 0, 0], color: WHITE_SHADE });
    for (let i = 0; i < 4; i++) {
      const y = 0.1 + i * 0.31;
      p.box({ size: [0.5, 0.2, 0.5], base: [0, y, 0], color: GLASS, colorTop: GLASS_LIGHT });
      p.box({ size: [0.52, 0.03, 0.52], base: [0, y + 0.15, 0], color: PINK, glow: 0.85 });
      p.box({ size: [0.64, 0.05, 0.64], base: [0, y + 0.2, 0], color: WHITE, shade: 0 });
      p.box({ size: [0.6, 0.07, 0.6], base: [0, y + 0.25, 0], color: LEAF, colorTop: LEAF_TOP, faceJitter: 0.1 });
    }
    for (const [x, z] of /** @type {[number, number][]} */ ([[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]])) {
      p.box({ size: [0.05, 1.3, 0.05], base: [x, 0.1, z], color: WHITE });
    }
    // Dachgarten
    leafBall(p, [-0.08, 1.42, 0.05], 0.2, 0.4, 0.6);
    leafBall(p, [0.15, 1.4, -0.12], 0.14, 1.4, 0.7);
    return m.build();
  },

  // Ladesäule: weiße Säule mit pulsierendem Leuchtstreifen, daneben lädt ein kleiner Kabinenroller.
  'prop.zukunft.ladesaeule': () => {
    const m = createModel('prop.zukunft.ladesaeule');
    const p = m.part('station');
    p.cyl({ r: 0.38, h: 0.03, seg: 8, base: [0, 0, 0], color: GREY, shade: 0 });
    p.cyl({ r: 0.33, h: 0.036, seg: 8, base: [0, 0, 0], color: SLATE, shade: 0 });
    const px = -0.2;
    p.capsule({ r: 0.11, h: 0.6, seg: 7, at: [px, 0.42, -0.08], scale: [1, 1, 0.75], color: WHITE_SHADE, colorTop: WHITE });
    p.box({ size: [0.14, 0.14, 0.02], at: [px, 0.66, 0.005], color: DARK });
    // Kabel zum Fahrzeug
    p.torus({ r: 0.17, tube: 0.022, seg: 7, tubeSeg: 4, arc: Math.PI, at: [px + 0.17, 0.3, -0.06], rot: [-Math.PI / 2, 0, 0], color: DARK });
    // Kabinenroller
    const cx = 0.14;
    p.capsule({ r: 0.14, h: 0.24, seg: 7, at: [cx, 0.19, 0.02], rot: [Math.PI / 2, 0, 0], color: '#7fd9c0', colorTop: '#c6f4e4' });
    p.sphere({ r: 0.125, detail: 1, at: [cx, 0.29, 0.06], scale: [0.95, 0.8, 1.2], color: GLASS_DARK, colorTop: GLASS });
    for (const z of [-0.13, 0.17]) {
      p.cyl({ r: 0.065, h: 0.3, seg: 7, at: [cx, 0.065, z], rot: [0, 0, Math.PI / 2], color: DARK });
    }
    const strip = m.part('strip', { pivot: [px, 0.42, -0.08] });
    strip.box({ size: [0.07, 0.4, 0.02], at: [px, 0.34, 0.006], color: TEAL, colorTop: TEAL_SOFT, glow: 1.0 });
    strip.cyl({ r: 0.118, h: 0.045, seg: 7, at: [px, 0.8, -0.08], scale: [1, 1, 0.75], color: TEAL, glow: 1.0 });
    return m.build({
      animate(pose, ctx) {
        const s = 0.75 + 0.25 * Math.sin((ctx.t * 0.5 + ctx.seed) * TAU);
        pose.strip.scale.set(1, s, 1);
      },
    });
  },

  // Holotafel: zwei Pfosten, dazwischen eine sanft schwebende Leuchtfläche mit Balken.
  'prop.zukunft.holotafel': () => {
    const m = createModel('prop.zukunft.holotafel');
    const p = m.part('posts');
    for (const x of [-0.36, 0.36]) {
      p.cyl({ r: 0.07, rTop: 0.05, h: 0.08, seg: 6, base: [x, 0, 0], color: GREY });
      p.cyl({ r: 0.035, h: 0.95, seg: 5, base: [x, 0.08, 0], color: WHITE_SHADE, colorTop: WHITE });
    }
    p.box({ size: [0.78, 0.04, 0.05], at: [0, 0.3, 0], color: WHITE_SHADE });
    const holo = m.part('holo', { pivot: [0, 0.66, 0] });
    holo.box({ size: [0.64, 0.56, 0.02], at: [0, 0.66, 0], color: '#1f9a96', colorTop: '#3fd0c0', glow: 0.75 });
    // Inhalt: Sonne und Balken, beidseitig
    for (const s of [1, -1]) {
      holo.cyl({ r: 0.1, h: 0.012, seg: 8, at: [-0.16 * s, 0.76, 0.014 * s], rot: [Math.PI / 2, 0, 0], color: TEAL_SOFT, glow: 1.2 });
      holo.box({ size: [0.2, 0.05, 0.012], at: [0.14 * s, 0.82, 0.014 * s], color: TEAL_SOFT, glow: 1.2 });
      holo.box({ size: [0.14, 0.05, 0.012], at: [0.11 * s, 0.72, 0.014 * s], color: PINK, glow: 1.0 });
      holo.box({ size: [0.5, 0.05, 0.012], at: [0, 0.5, 0.014 * s], color: TEAL_SOFT, glow: 1.2 });
    }
    return m.build({
      animate(pose, ctx) {
        A.hover(pose, ctx, 'holo', 0.025, 0.35);
        const s = 1 + Math.sin((ctx.t * 0.7 + ctx.seed) * TAU) * 0.03;
        pose.holo.scale.set(s, 1, 1);
      },
    });
  },

  // Drohnenlandeplatz: flache Scheibe mit Leuchtring und großem H, darüber schwebt eine Lieferdrohne.
  'prop.zukunft.landeplatz': () => {
    const m = createModel('prop.zukunft.landeplatz');
    const p = m.part('pad');
    p.cyl({ r: 0.52, h: 0.05, seg: 12, base: [0, 0, 0], color: WHITE_SHADE });
    p.cyl({ r: 0.46, h: 0.06, seg: 12, base: [0, 0, 0], color: SLATE, shade: 0 });
    p.torus({ r: 0.45, tube: 0.024, seg: 12, tubeSeg: 4, at: [0, 0.06, 0], color: TEAL, glow: 1.0 });
    for (const x of [-0.14, 0.14]) p.box({ size: [0.08, 0.07, 0.44], base: [x, 0, 0], color: WHITE, shade: 0 });
    p.box({ size: [0.28, 0.07, 0.08], base: [0, 0, 0], color: WHITE, shade: 0 });
    const drone = m.part('drone', { pivot: [0, 0.5, 0] });
    drone.sphere({ r: 0.1, detail: 0, at: [0, 0.5, 0], scale: [1, 0.7, 1.2], color: WHITE });
    drone.box({ size: [0.14, 0.1, 0.14], at: [0, 0.4, 0], color: '#e9a23c', colorTop: '#f6c66a' });
    drone.box({ size: [0.5, 0.03, 0.04], at: [0, 0.52, 0], rot: [0, Math.PI / 4, 0], color: GREY });
    drone.box({ size: [0.5, 0.03, 0.04], at: [0, 0.52, 0], rot: [0, -Math.PI / 4, 0], color: GREY });
    for (const [x, z] of /** @type {[number, number][]} */ ([[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]])) {
      drone.cyl({ r: 0.09, h: 0.015, seg: 7, at: [x, 0.55, z], color: GLASS_LIGHT, shade: 0 });
    }
    drone.box({ size: [0.06, 0.03, 0.03], at: [0, 0.5, 0.125], color: TEAL, glow: 1.1 });
    return m.build({
      animate(pose, ctx) {
        A.hover(pose, ctx, 'drone', 0.06, 0.3);
        pose.drone.rotation.y = Math.sin((ctx.t * 0.1 + ctx.seed) * TAU) * 0.6;
      },
    });
  },

  // Stadtbaum: runde Krone im sechseckigen Kübel mit Leuchtring.
  'prop.zukunft.stadtbaum': () => {
    const m = createModel('prop.zukunft.stadtbaum');
    const p = m.part('planter');
    planter(p, 0, 0, 0, 0.24, 0.18);
    p.cyl({ r: 0.05, rTop: 0.04, h: 0.42, seg: 5, base: [0, 0.18, 0], color: BARK, colorTop: tone(BARK, 0.2) });
    const crown = m.part('crown', { pivot: [0, 0.5, 0] });
    leafBall(crown, [0, 0.82, 0], 0.33, 0);
    leafBall(crown, [0.14, 1.04, -0.06], 0.2, 1.1);
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.03, 0.22);
        A.sway(pose, ctx, 'crown', 0.02, 0.16, 'x');
      },
    });
  },

  // Wohnturm: drei versetzte weiße Blöcke mit dunklen Fensterbändern, einzelnen hellen Fenstern und Dachgärten.
  // Steht am Inselrand und, stark vergrößert, als ferne Skyline.
  'prop.zukunft.wohnturm': () => {
    const m = createModel('prop.zukunft.wohnturm');
    const p = m.part('tower');
    /** @type {[number, number, number, number, number, number][]} Breite, Tiefe, Höhe, x, z, Etagen */
    const blocks = [[0.58, 0.54, 0.95, 0, 0, 4], [0.48, 0.46, 0.75, -0.04, 0.03, 3], [0.36, 0.36, 0.55, 0.01, -0.03, 2]];
    let y = 0;
    let n = 0;
    for (const [w, d, h, x, z, floors] of blocks) {
      p.box({ size: [w, h, d], base: [x, y, z], color: WHITE_SHADE, colorTop: WHITE });
      for (let f = 0; f < floors; f++) {
        const fy = y + 0.12 + f * 0.21;
        p.box({ size: [w + 0.012, 0.1, d + 0.012], base: [x, fy, z], color: GLASS_DARK, shade: 0 });
        for (let side = 0; side < 4; side++) {
          const len = side % 2 ? d : w;
          const cols = len > 0.4 ? 3 : 2;
          for (let c = 0; c < cols; c++) {
            if (hash(++n) > 0.42) continue;
            const o = ((c + 0.5) / cols - 0.5) * (len - 0.08);
            const ww = (len - 0.1) / cols - 0.03;
            const out = (side % 2 ? w : d) / 2 + 0.008;
            const sgn = side < 2 ? 1 : -1;
            if (side % 2) p.box({ size: [0.02, 0.075, ww], at: [x + sgn * out, fy + 0.05, z + o], color: WINDOW, glow: 0.95 });
            else p.box({ size: [ww, 0.075, 0.02], at: [x + o, fy + 0.05, z + sgn * out], color: WINDOW, glow: 0.95 });
          }
        }
      }
      y += h;
    }
    // Dachgärten auf den Absätzen und dem Dach
    leafBall(p, [0.21, 0.98, -0.2], 0.1, 0.3, 0.6);
    leafBall(p, [0.2, 0.98, 0.18], 0.08, 1.3, 0.6);
    leafBall(p, [-0.2, 1.73, -0.14], 0.08, 0.8, 0.6);
    leafBall(p, [0.02, 2.28, -0.02], 0.15, 0.2, 0.5);
    p.cyl({ r: 0.02, h: 0.3, seg: 4, base: [0.12, 2.25, 0.1], color: GREY });
    p.sphere({ r: 0.035, detail: 0, at: [0.12, 2.57, 0.1], color: MAGENTA, glow: 1.1 });
    return m.build();
  },

  // Sperrfeld: kleines Gewächshaus als facettierte Glaskuppel auf weißem Ring, innen grün.
  'prop.zukunft.block': () => {
    const m = createModel('prop.zukunft.block');
    const p = m.part('dome');
    p.cyl({ r: 0.46, rTop: 0.44, h: 0.1, seg: 10, base: [0, 0, 0], color: WHITE_SHADE, colorTop: WHITE });
    p.dome({ r: 0.4, seg: 10, rings: 3, base: [0, 0.1, 0], scale: [1, 0.9, 1], color: GLASS, colorTop: GLASS_LIGHT, faceJitter: 0.12 });
    p.cyl({ r: 0.45, h: 0.03, seg: 10, base: [0, 0.1, 0], color: TEAL, glow: 0.9 });
    p.cyl({ r: 0.1, h: 0.06, seg: 6, base: [0, 0.43, 0], color: WHITE });
    p.torus({ r: 0.315, tube: 0.022, seg: 10, tubeSeg: 4, at: [0, 0.325, 0], color: WHITE });
    // Eingang vorn
    p.box({ size: [0.22, 0.24, 0.12], base: [0, 0.1, 0.38], color: WHITE });
    p.box({ size: [0.13, 0.17, 0.02], base: [0, 0.1, 0.445], color: GLASS_DARK });
    // Grün schaut seitlich heraus
    leafBall(p, [-0.36, 0.16, -0.2], 0.1, 0.4, 0.8);
    leafBall(p, [0.33, 0.15, -0.26], 0.08, 1.4, 0.8);
    return m.build();
  },

  // Bodendeko 1: Grasbüschel mit kleiner Solar-Gartenleuchte.
  'prop.zukunft.deko1': () => {
    const m = createModel('prop.zukunft.deko1');
    const p = m.part('tuft');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      p.cone({ r: 0.035, h: 0.12 + (i % 2) * 0.04, seg: 3, base: [Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05], rot: [0, a - Math.PI / 2, -0.35], color: LEAF, colorTop: LEAF_TOP });
    }
    p.cyl({ r: 0.02, h: 0.14, seg: 4, base: [0.02, 0, 0], color: WHITE_SHADE });
    p.sphere({ r: 0.04, detail: 0, at: [0.02, 0.16, 0], color: TEAL_SOFT, glow: 1.0 });
    return m.build();
  },

  // Bodendeko 2: helle Sechseck-Trittplatten mit Moospolster.
  'prop.zukunft.deko2': () => {
    const m = createModel('prop.zukunft.deko2');
    const p = m.part('pavers');
    p.cyl({ r: 0.09, h: 0.025, seg: 6, base: [-0.06, 0, 0.03], color: WHITE_SHADE, shade: 0 });
    p.cyl({ r: 0.07, h: 0.022, seg: 6, base: [0.1, 0, -0.05], rot: [0, 0.4, 0], color: GREY, shade: 0 });
    p.cyl({ r: 0.055, h: 0.02, seg: 6, base: [0.05, 0, 0.12], rot: [0, 0.2, 0], color: WHITE_SHADE, shade: 0 });
    p.sphere({ r: 0.055, detail: 0, at: [-0.08, 0.02, -0.1], scale: [1, 0.5, 1], color: LEAF, colorTop: LEAF_TOP, faceJitter: 0.08 });
    return m.build();
  },
};
