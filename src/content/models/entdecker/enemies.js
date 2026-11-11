// @ts-check
// Gegner im Zeitalter der Entdecker: freundliche Spielzeugpiraten um 1700.
// Pirat (Standard, Holzbein), Äffchen (schnell, Schwarm, gestohlener Dreispitz), Kürassier (gepanzert, schnell, zu Pferd),
// Beutepapagei (fliegend, mit Beutesack) und der Boss "Die Landgaleone", ein Schiff auf sechs Rädern.

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Zeitalters ---
const SKIN = '#e3b48d';
const SKIN_DARK = '#c99673';
const DARK = '#2a2420';
const CREAM = '#f0e5c8';
const WHITE = '#f4efe4';
const WOOD = '#9a6b3f';
const WOOD_LIGHT = '#c48e55';
const WOOD_DARK = '#6a4529';
const DECK = '#d9b67e';
const LEATHER = '#7a5236';
const LEATHER_DARK = '#4e3424';
const GOLD = '#d9a520';
const GOLD_LIGHT = '#f2cc5c';
const STEEL = '#a9b3bd';
const STEEL_LIGHT = '#dfe5ea';
const STEEL_DARK = '#7b8590';
const IRON = '#4f4c55';
const TEAL = '#1e6f78';
const TEAL_LIGHT = '#2f939b';
const RED = '#b5382e';
const RED_LIGHT = '#d65a48';
const NAVY = '#2f4f86';
const NAVY_LIGHT = '#4a6fa8';
const HAT = '#33384f';
const HAT_LIGHT = '#4a5170';
const SACK = '#dcc48e';
const SACK_LIGHT = '#efdcae';
// Pirat
const SHIRT = '#efe6d2';
const BANDANA = '#d1402f';
const BANDANA_LIGHT = '#e8634e';
const BEARD = '#3e2a1e';
// Äffchen
const FUR = '#8a5a35';
const FUR_LIGHT = '#a8754a';
const FACE = '#e6c39a';
const FACE_LIGHT = '#f0d6b4';
// Kürassier: Fuchs mit weißen Fesseln, Reiter in Blau und Lederfarbe
const HORSE = '#a35f37';
const HORSE_LIGHT = '#c27b4c';
const HORSE_MUZZLE = '#7e4a2e';
const MANE = '#4a2e1e';
const BUFF = '#dcc28c';
// Papagei
const SCARLET = '#d93a2b';
const SCARLET_LIGHT = '#f05b42';
const MACAW_BLUE = '#2f6fd0';
const MACAW_BLUE_LIGHT = '#4d8fec';
const YELLOW = '#f0c030';
// Landgaleone
const SAIL = '#f1e8d2';
const SAIL_SHADE = '#e2d6ba';
const FLAG = '#36313d';
const SMOKE = '#ece8e0';
const LANTERN = '#ffd27a';
const RED_BEARD = '#9a5230';

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
 * Dreispitz: dreieckige, nach oben ausgestellte Krempe (Spitze nach vorn), Goldborte und Kopf.
 * @param {PartBuilder} part
 * @param {Vec3} base Mitte der Unterseite
 * @param {number} s Größe (Umkreis der Krempe oben)
 */
function tricorne(part, base, s) {
  const [x, y, z] = base;
  part.cyl({ r: s * 0.74, rTop: s, h: s * 0.32, seg: 3, base: [x, y, z], color: HAT, colorTop: HAT_LIGHT, shade: 0.1 });
  part.torus({ r: s * 0.96, tube: s * 0.085, seg: 3, tubeSeg: 3, at: [x, y + s * 0.31, z], rot: [0, -HALF_PI, 0], color: GOLD_LIGHT });
  part.dome({ r: s * 0.5, seg: 7, rings: 2, at: [x, y + s * 0.1, z], scale: [1, 1.25, 1], color: HAT, colorTop: HAT_LIGHT });
}

/**
 * Säbelklinge in der YZ-Ebene: wächst vom Griff aus nach oben, die Spitze krümmt sich nach hinten.
 * @param {PartBuilder} part
 * @param {Vec3} at Ansatz am Griff
 * @param {number} tilt Neigung nach vorn (Radiant)
 * @param {number} s Länge
 */
function sabre(part, at, tilt, s) {
  /** @type {[number, number][]} */
  const pts = [[0.07, 0], [0.11, 0.38], [0.04, 0.75], [-0.12, 1], [-0.07, 0.72], [-0.035, 0.36], [-0.055, 0]];
  part.extrude({
    points: pts.map(([a, b]) => /** @type {[number, number]} */ ([a * s * 0.42, b * s])),
    depth: 0.02, at, rot: [tilt, -HALF_PI, 0], color: STEEL_LIGHT, colorTop: WHITE,
  });
}

// --- Landgaleone: Umriss des Rumpfs von oben, von achtern (Heck) nach vorn (Bug), rechte Hälfte ---
/** @type {[number, number][]} */
const HULL_HALF = [[0.25, -0.62], [0.29, -0.45], [0.31, -0.2], [0.305, 0.05], [0.28, 0.25], [0.22, 0.42], [0.13, 0.56], [0, 0.66]];

/**
 * Halbe Rumpfbreite an der Stelle z.
 * @param {number} z
 * @returns {number}
 */
function hullX(z) {
  for (let i = 1; i < HULL_HALF.length; i++) {
    const [x1, z1] = HULL_HALF[i];
    if (z <= z1) {
      const [x0, z0] = HULL_HALF[i - 1];
      return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0);
    }
  }
  return 0;
}

/**
 * Geschlossener Rumpfumriss (x, z) gegen den Uhrzeigersinn, gestreckt um sx/sz.
 * @param {number} sx
 * @param {number} sz
 * @returns {[number, number][]}
 */
function hullOutline(sx, sz) {
  /** @type {[number, number][]} */
  const right = HULL_HALF.map(([x, z]) => [x * sx, z * sz]);
  /** @type {[number, number][]} */
  const left = HULL_HALF.slice(0, -1).reverse().map(([x, z]) => [-x * sx, z * sz]);
  return [...right, ...left];
}

/**
 * Waagerechte Platte aus einem Umriss (x, z) zwischen y0 und y1.
 * @param {PartBuilder} part
 * @param {[number, number][]} pts
 * @param {number} y0
 * @param {number} y1
 * @param {string} color
 */
function slab(part, pts, y0, y1, color) {
  part.extrude({ points: pts, depth: y1 - y0, at: [0, (y0 + y1) / 2, 0], rot: [HALF_PI, 0, 0], color, shade: 0 });
}

/**
 * Gebauschtes Segel: sichelförmiger Querschnitt, senkrecht ausgezogen; Bauch nach +Z.
 * @param {PartBuilder} part
 * @param {number} w halbe Breite
 * @param {number} bulge Tiefe des Bauchs
 * @param {number} t Stoffdicke
 * @param {number} y0 Unterkante
 * @param {number} y1 Oberkante
 * @param {number} z Lage der Rah
 * @param {string} color
 */
function sail(part, w, bulge, t, y0, y1, z, color) {
  /** @type {[number, number][]} */
  const pts = [];
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const u = 1 - (2 * i) / n;
    pts.push([u * w, bulge * (1 - u * u) + t / 2]);
  }
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    pts.push([u * w, bulge * (1 - u * u) - t / 2]);
  }
  part.extrude({ points: pts, depth: y1 - y0, at: [0, (y0 + y1) / 2, z], rot: [HALF_PI, 0, 0], color, shade: 0 });
}

/**
 * Radpaar (Teil mit gespiegeltem Gegenstück): eisenbeschlagener Reifen, Speichenkreuz, goldene Nabe.
 * @param {PartBuilder} part
 * @param {number} x
 * @param {number} r
 * @param {number} z
 */
function wheelPair(part, x, r, z) {
  part.torus({ r: r - 0.022, tube: 0.026, seg: 7, tubeSeg: 3, at: [x, r, z], rot: [0, 0, HALF_PI], color: IRON, mirror: true });
  part.box({ size: [0.024, 2 * r - 0.04, 0.032], at: [x, r, z], color: WOOD_LIGHT, mirror: true });
  part.box({ size: [0.024, 0.032, 2 * r - 0.04], at: [x, r, z], color: WOOD_LIGHT, mirror: true });
  part.sphere({ r: 0.036, detail: 0, at: [x + 0.014, r, z], color: GOLD, mirror: true });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Standard: Pirat im blau-weißen Ringelhemd, rotes Kopftuch, Augenklappe, Schnauzbart, Entermesser und Holzbein.
  'enemy.entdecker.pirat': () => {
    const m = createModel('enemy.entdecker.pirat');
    const body = m.part('body', { pivot: [0, 0.14, 0] });
    // Ringelhemd aus fünf Bändern, unten weiß, dann blau, ...
    const ys = [0.11, 0.157, 0.204, 0.251, 0.298, 0.345];
    const rs = [0.125, 0.142, 0.148, 0.143, 0.128, 0.085];
    for (let i = 0; i < 5; i++) {
      body.cyl({ r: rs[i], rTop: rs[i + 1], h: ys[i + 1] - ys[i], seg: 8, base: [0, ys[i], 0], scale: [1, 1, 0.84], color: i % 2 ? NAVY : SHIRT, shade: 0.04 });
    }
    body.torus({ r: 0.128, tube: 0.02, seg: 8, tubeSeg: 3, at: [0, 0.135, 0], scale: [1, 1, 0.84], color: LEATHER_DARK });
    body.box({ size: [0.05, 0.042, 0.014], at: [0, 0.135, 0.126], color: GOLD_LIGHT });

    const head = m.part('head', { pivot: [0, 0.34, 0], parent: 'body' });
    head.sphere({ r: 0.11, at: [0, 0.45, 0.01], color: SKIN });
    head.box({ size: [0.024, 0.03, 0.014], at: [0.04, 0.458, 0.113], color: DARK });
    // Augenklappe links
    head.cyl({ r: 0.034, h: 0.014, seg: 6, at: [-0.042, 0.46, 0.108], rot: [HALF_PI, 0, 0.35], color: DARK });
    head.sphere({ r: 0.026, detail: 0, at: [0, 0.432, 0.12], color: SKIN_DARK });
    // Gezwirbelter Schnauzbart
    head.extrude({ points: [[0, 0.008], [0.035, 0.015], [0.068, -0.002], [0.09, 0.02], [0.086, -0.022], [0.045, -0.032], [0, -0.014], [-0.045, -0.032], [-0.086, -0.022], [-0.09, 0.02], [-0.068, -0.002], [-0.035, 0.015]], depth: 0.024, at: [0, 0.41, 0.116], color: BEARD });
    // Kopftuch: Haube nach hinten gekippt, Knoten mit zwei Zipfeln
    head.dome({ r: 0.118, seg: 8, rings: 3, at: [0, 0.468, -0.006], rot: [-0.3, 0, 0], scale: [1, 0.92, 1], color: BANDANA, colorTop: BANDANA_LIGHT });
    head.sphere({ r: 0.032, detail: 0, at: [0, 0.462, -0.122], color: BANDANA });
    head.box({ size: [0.036, 0.1, 0.016], at: [0.03, 0.41, -0.13], rot: [0.35, 0, 0.35], color: BANDANA, mirror: true });

    // Linkes Bein mit Stiefel, rechtes Bein aus Holz
    const legL = m.part('legL', { pivot: [-0.06, 0.13, 0] });
    legL.cyl({ r: 0.05, rTop: 0.058, h: 0.09, seg: 6, base: [-0.06, 0.055, 0], color: LEATHER });
    legL.cyl({ r: 0.046, rTop: 0.043, h: 0.075, seg: 6, base: [-0.06, 0, 0], color: DARK });
    legL.sphere({ r: 0.046, detail: 0, at: [-0.06, 0.028, 0.035], scale: [1, 0.75, 1.35], color: DARK });
    const legR = m.part('legR', { pivot: [0.06, 0.13, 0] });
    legR.cyl({ r: 0.05, rTop: 0.058, h: 0.09, seg: 6, base: [0.06, 0.055, 0], color: LEATHER });
    legR.cyl({ r: 0.03, rTop: 0.04, h: 0.075, seg: 6, base: [0.06, 0, 0], color: WOOD_LIGHT });
    legR.cyl({ r: 0.033, h: 0.016, seg: 6, base: [0.06, 0, 0], color: IRON });

    const armL = m.part('armL', { pivot: [-0.13, 0.31, 0], parent: 'body' });
    limb(armL, [-0.13, 0.31, 0], [-0.165, 0.2, 0.03], 0.036, 0.032, SHIRT, { seg: 5 });
    armL.sphere({ r: 0.036, detail: 0, at: [-0.168, 0.19, 0.035], color: SKIN });

    // Rechter Arm mit dem Entermesser, Klinge schräg nach oben
    const armR = m.part('armR', { pivot: [0.13, 0.31, 0], parent: 'body' });
    limb(armR, [0.13, 0.31, 0], [0.18, 0.245, 0.09], 0.036, 0.032, SHIRT, { seg: 5 });
    armR.sphere({ r: 0.036, detail: 0, at: [0.183, 0.24, 0.096], color: SKIN });
    armR.cyl({ r: 0.042, h: 0.016, seg: 7, at: [0.183, 0.272, 0.1], rot: [0.35, 0, 0], color: GOLD });
    sabre(armR, [0.183, 0.278, 0.1], 0.35, 0.3);

    return m.build({
      stride: 0.46,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const w = ctx.walk;
        const s = Math.sin(w);
        // Humpeln: das gesunde Bein schwingt weit, das Holzbein steif; auf dem Holzbein ruckt der Körper hoch und kippt.
        pose.legL.rotation.x = s * 0.75 * k;
        pose.legR.rotation.x = -s * 0.4 * k;
        pose.armL.rotation.x = -s * 0.55 * k;
        pose.armR.rotation.x = -0.1 * k + Math.sin(w * 2) * 0.06 * k;
        pose.body.position.y += Math.max(0, s) * 0.035 * k + Math.abs(Math.cos(w)) * 0.01 * k;
        pose.body.rotation.z = (s * 0.1 - 0.03) * k;
        pose.body.rotation.x = 0.05 * k;
        pose.head.rotation.z = -s * 0.06 * k;
        pose.head.rotation.y = Math.sin(ctx.t * 0.8 + ctx.seed * 6) * 0.15;
        A.flinch(pose, ctx, 'body');
      },
    });
  },

  // Schnell, Schwarm: winziges braunes Äffchen auf allen vieren, Ringelschwanz, viel zu großer gestohlener Dreispitz.
  'enemy.entdecker.aeffchen': () => {
    const m = createModel('enemy.entdecker.aeffchen');
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    body.sphere({ r: 0.085, at: [0, 0.165, -0.02], scale: [0.95, 0.88, 1.25], color: FUR, colorTop: FUR_LIGHT });
    body.sphere({ r: 0.06, detail: 0, at: [0, 0.14, 0.03], scale: [0.9, 0.85, 1.2], color: FACE });

    const head = m.part('head', { pivot: [0, 0.21, 0.08], parent: 'body' });
    head.sphere({ r: 0.08, at: [0, 0.245, 0.11], color: FUR, colorTop: FUR_LIGHT });
    head.sphere({ r: 0.064, at: [0, 0.236, 0.142], scale: [1.2, 1, 0.78], color: FACE });
    head.sphere({ r: 0.017, detail: 0, at: [0.028, 0.256, 0.187], color: DARK, mirror: true });
    head.sphere({ r: 0.036, detail: 0, at: [0, 0.214, 0.186], scale: [1.35, 0.85, 0.85], color: FACE_LIGHT });
    head.cyl({ r: 0.042, h: 0.018, seg: 6, at: [0.088, 0.25, 0.1], rot: [0, 0, HALF_PI], color: FUR_LIGHT, mirror: true });
    head.cyl({ r: 0.028, h: 0.012, seg: 6, at: [0.094, 0.25, 0.1], rot: [0, 0, HALF_PI], color: FACE, mirror: true });

    const hat = m.part('hat', { pivot: [0, 0.31, 0.1], parent: 'head' });
    tricorne(hat, [0, 0.305, 0.1], 0.13);
    hat.sphere({ r: 0.024, detail: 0, at: [-0.075, 0.35, 0.12], color: RED });

    const tail = m.part('tail', { pivot: [0, 0.18, -0.12], parent: 'body' });
    limb(tail, [0, 0.18, -0.12], [0, 0.3, -0.22], 0.026, 0.024, FUR);
    tail.torus({ r: 0.06, tube: 0.024, seg: 7, tubeSeg: 3, arc: Math.PI * 1.25, at: [0, 0.3, -0.16], rot: [-HALF_PI, 0, HALF_PI], color: FUR, colorTop: FUR_LIGHT });

    /** @type {[string, number, number, boolean][]} */
    const legSpec = [['legFL', -0.05, 0.07, true], ['legFR', 0.05, 0.07, true], ['legBL', -0.058, -0.08, false], ['legBR', 0.058, -0.08, false]];
    for (const [name, x, z, front] of legSpec) {
      const leg = m.part(name, { pivot: [x, 0.16, z] });
      if (front) {
        limb(leg, [x, 0.17, z], [x * 1.1, 0.025, z + 0.03], 0.03, 0.026, FUR);
        leg.sphere({ r: 0.028, detail: 0, at: [x * 1.1, 0.022, z + 0.035], color: FACE });
      } else {
        leg.sphere({ r: 0.045, detail: 0, at: [x, 0.14, z], color: FUR });
        limb(leg, [x, 0.14, z], [x * 1.1, 0.025, z + 0.02], 0.03, 0.026, FUR);
        leg.sphere({ r: 0.03, detail: 0, at: [x * 1.1, 0.02, z + 0.04], scale: [1, 0.7, 1.5], color: FACE });
      }
    }

    return m.build({
      stride: 0.42,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const w = ctx.walk;
        const s = Math.sin(w);
        const c = Math.cos(w);
        // Sprunglauf: Vorder- und Hinterbeine jeweils paarweise, der Körper hüpft in Bögen.
        const sw = 0.85 * k;
        pose.legFL.rotation.x = s * sw;
        pose.legFR.rotation.x = s * sw;
        pose.legBL.rotation.x = -s * sw;
        pose.legBR.rotation.x = -s * sw;
        pose.body.position.y += Math.max(0, c) * 0.06 * k;
        pose.body.rotation.x = -s * 0.2 * k;
        pose.head.rotation.x = s * 0.15 * k;
        pose.head.rotation.y = Math.sin(ctx.t * 1.6 + ctx.seed * 6) * 0.35 * (1 - k);
        pose.tail.rotation.x = s * 0.25 * k;
        pose.tail.rotation.z = Math.sin(ctx.t * 3 + ctx.seed * 6) * 0.2;
        // Der zu große Hut wackelt bei jedem Sprung.
        pose.hat.rotation.z = 0.18 + Math.sin(w * 2) * 0.12 * k + Math.sin(ctx.t * 2 + ctx.seed * 6) * 0.04;
        pose.hat.rotation.x = -0.12 + c * 0.1 * k;
        A.flinch(pose, ctx, 'body', 0.2);
      },
    });
  },

  // Gepanzert, schnell: Kürassier auf einem Fuchs mit roter Schabracke, blanker Kürass, Helm mit rotem Kamm, erhobener Säbel.
  'enemy.entdecker.kuerassier': () => {
    const m = createModel('enemy.entdecker.kuerassier');

    // --- Pferd ---
    const horse = m.part('horse', { pivot: [0, 0.36, 0] });
    horse.sphere({ r: 0.14, at: [0, 0.37, -0.02], scale: [0.82, 0.82, 1.85], color: HORSE, colorTop: HORSE_LIGHT });
    // Schabracke: roter Rock mit Goldsaum, darauf der Sattel
    horse.cyl({ r: 0.128, rTop: 0.122, h: 0.13, seg: 8, base: [0, 0.3, -0.05], scale: [1, 1, 1.3], color: RED, colorTop: RED_LIGHT });
    horse.torus({ r: 0.129, tube: 0.014, seg: 8, tubeSeg: 3, at: [0, 0.305, -0.05], scale: [1, 1, 1.3], color: GOLD });

    const head = m.part('head', { pivot: [0, 0.44, 0.2], parent: 'horse' });
    limb(head, [0, 0.4, 0.17], [0, 0.6, 0.3], 0.085, 0.06, HORSE, { colorTop: HORSE_LIGHT, seg: 7 });
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      head.box({ size: [0.035, 0.07, 0.07], at: [0, 0.5 + t * 0.12, 0.17 + t * 0.09], rot: [-0.6, 0, 0], color: MANE });
    }
    head.sphere({ r: 0.075, at: [0, 0.62, 0.33], scale: [0.9, 0.95, 1], color: HORSE, colorTop: HORSE_LIGHT });
    limb(head, [0, 0.62, 0.35], [0, 0.53, 0.47], 0.064, 0.048, HORSE, { seg: 7 });
    head.sphere({ r: 0.05, detail: 0, at: [0, 0.525, 0.475], scale: [1, 0.85, 1], color: HORSE_MUZZLE });
    // Rossstirn aus Stahl
    head.box({ size: [0.07, 0.15, 0.022], at: [0, 0.6, 0.42], rot: [-0.8, 0, 0], color: STEEL, colorTop: STEEL_LIGHT });
    head.sphere({ r: 0.02, detail: 0, at: [0.064, 0.64, 0.365], color: DARK, mirror: true });
    head.pyramid({ size: [0.034, 0.065, 0.03], base: [0.04, 0.675, 0.3], rot: [-0.15, 0, -0.2], color: HORSE, mirror: true });

    const tail = m.part('tail', { pivot: [0, 0.42, -0.27], parent: 'horse' });
    tail.cone({ r: 0.05, h: 0.28, seg: 6, base: [0, 0.43, -0.27], rot: [-2.4, 0, 0], color: MANE });

    /** @type {[string, number, number, number][]} */
    const legSpec = [['legFL', -0.072, 0.15, 1], ['legFR', 0.072, 0.15, 1], ['legBL', -0.072, -0.19, -1], ['legBR', 0.072, -0.19, -1]];
    for (const [name, x, z, front] of legSpec) {
      const leg = m.part(name, { pivot: [x, 0.33, z] });
      const knee = /** @type {Vec3} */ ([x, 0.17, z + (front > 0 ? 0.02 : -0.03)]);
      limb(leg, [x, 0.35, z], knee, 0.048, 0.036, HORSE, { seg: 5 });
      limb(leg, knee, [x, 0.05, z], 0.036, 0.03, HORSE, { seg: 5 });
      leg.cyl({ r: 0.04, rTop: 0.034, h: 0.07, seg: 6, base: [x, 0, z + 0.004], color: CREAM });
    }

    // --- Reiter ---
    const RZ = -0.05;
    const rider = m.part('rider', { pivot: [0, 0.49, RZ], parent: 'horse' });
    // Beine in Lederhosen und hohen Stiefeln seitlich am Pferd
    limb(rider, [0.07, 0.5, RZ], [0.13, 0.44, RZ + 0.07], 0.04, 0.038, BUFF, { mirror: true });
    limb(rider, [0.13, 0.45, RZ + 0.07], [0.135, 0.3, RZ + 0.04], 0.042, 0.038, DARK, { mirror: true });
    rider.cyl({ r: 0.11, rTop: 0.105, h: 0.06, seg: 8, base: [0, 0.48, RZ], scale: [1, 1, 0.85], color: NAVY, colorTop: NAVY_LIGHT });
    // Blanker Kürass mit Goldsaum
    rider.lathe({ points: [[0, 0.52], [0.112, 0.53], [0.124, 0.6], [0.114, 0.67], [0.08, 0.7], [0, 0.705]], seg: 8, scale: [1, 1, 0.85], at: [0, 0, RZ], color: STEEL, colorTop: STEEL_LIGHT });
    rider.torus({ r: 0.113, tube: 0.013, seg: 8, tubeSeg: 3, at: [0, 0.535, RZ], scale: [1, 1, 0.85], color: GOLD });
    rider.sphere({ r: 0.06, detail: 0, at: [0.12, 0.665, RZ], scale: [1, 0.7, 1.1], color: STEEL, colorTop: STEEL_LIGHT, mirror: true });
    rider.sphere({ r: 0.032, detail: 0, at: [0, 0.69, RZ + 0.075], color: CREAM });

    const rhead = m.part('rhead', { pivot: [0, 0.7, RZ], parent: 'rider' });
    rhead.sphere({ r: 0.085, at: [0, 0.77, RZ + 0.01], color: SKIN });
    rhead.box({ size: [0.02, 0.026, 0.012], at: [0.03, 0.775, RZ + 0.093], color: DARK, mirror: true });
    rhead.box({ size: [0.04, 0.014, 0.012], at: [0.026, 0.745, RZ + 0.092], rot: [0, 0, -0.25], color: BEARD, mirror: true });
    // Helm mit Schirm, Nackenschutz und rotem Rosshaarkamm
    rhead.dome({ r: 0.092, seg: 8, rings: 3, at: [0, 0.79, RZ - 0.005], rot: [-0.2, 0, 0], color: STEEL, colorTop: STEEL_LIGHT });
    rhead.box({ size: [0.12, 0.012, 0.045], at: [0, 0.8, RZ + 0.085], rot: [-0.25, 0, 0], color: STEEL });
    rhead.box({ size: [0.12, 0.014, 0.06], at: [0, 0.765, RZ - 0.088], rot: [0.95, 0, 0], color: STEEL });
    rhead.extrude({ points: [[0.07, 0], [0.065, 0.05], [0.02, 0.085], [-0.05, 0.085], [-0.11, 0.05], [-0.13, -0.01], [-0.06, 0.02], [0, 0.02]], depth: 0.04, at: [0, 0.855, RZ], rot: [0, -HALF_PI, 0], color: RED, colorTop: RED_LIGHT });

    // Linker Arm hält die Zügel
    const armL = m.part('armL', { pivot: [-0.12, 0.66, RZ], parent: 'rider' });
    limb(armL, [-0.12, 0.66, RZ], [-0.08, 0.56, RZ + 0.13], 0.034, 0.03, NAVY, { seg: 5 });
    armL.sphere({ r: 0.033, detail: 0, at: [-0.075, 0.555, RZ + 0.14], color: BUFF });

    // Rechter Arm mit erhobenem Säbel
    const armR = m.part('armR', { pivot: [0.12, 0.66, RZ], parent: 'rider' });
    limb(armR, [0.12, 0.66, RZ], [0.2, 0.78, RZ + 0.06], 0.034, 0.03, NAVY, { seg: 5 });
    armR.sphere({ r: 0.034, detail: 0, at: [0.203, 0.785, RZ + 0.062], color: BUFF });
    armR.cyl({ r: 0.04, h: 0.016, seg: 7, at: [0.205, 0.815, RZ + 0.066], rot: [0.3, 0, 0], color: GOLD });
    sabre(armR, [0.205, 0.82, RZ + 0.067], 0.3, 0.32);

    return m.build({
      stride: 0.95,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const w = ctx.walk;
        const s = Math.sin(w);
        const c = Math.cos(w);
        const s2 = Math.sin(w - 0.6);
        // Galopp: Beinpaare leicht versetzt, der Leib schaukelt vor und zurück.
        pose.legFL.rotation.x = (s * 0.75 - 0.1) * k;
        pose.legFR.rotation.x = (s2 * 0.75 - 0.1) * k;
        pose.legBL.rotation.x = (-s * 0.65 + 0.1) * k;
        pose.legBR.rotation.x = (-s2 * 0.65 + 0.1) * k;
        pose.horse.position.y += (0.5 - 0.5 * Math.cos(w + 0.8)) * 0.05 * k;
        pose.horse.rotation.x = c * 0.08 * k;
        pose.head.rotation.x = (0.1 - c * 0.12) * k + Math.sin(ctx.t * 0.9 + ctx.seed * 6) * 0.05 * (1 - k);
        pose.tail.rotation.x = -0.35 * k + Math.sin(w * 2) * 0.08 * k;
        pose.tail.rotation.y = Math.sin(ctx.t * 1.8 + ctx.seed * 6) * 0.2;
        pose.rider.rotation.x = 0.14 * k - c * 0.05 * k;
        pose.armR.rotation.x = Math.sin(w) * 0.12 * k;
        pose.rhead.rotation.y = Math.sin(ctx.t * 0.7 + ctx.seed * 6) * 0.2 * (1 - k);
        A.flinch(pose, ctx, 'rider', 0.1);
        A.flinch(pose, ctx, 'horse', 0.06);
      },
    });
  },

  // Fliegend: großer scharlachroter Ara mit blau-gelben Flügeln, gelbem Hakenschnabel und Beutesack in den Krallen.
  'enemy.entdecker.papagei': () => {
    const m = createModel('enemy.entdecker.papagei');
    const Y = 0.3;
    const body = m.part('body', { pivot: [0, Y, 0] });
    body.sphere({ r: 0.1, at: [0, Y, -0.01], scale: [0.85, 0.85, 1.45], color: SCARLET, colorTop: SCARLET_LIGHT });

    const head = m.part('head', { pivot: [0, Y + 0.04, 0.1], parent: 'body' });
    head.sphere({ r: 0.085, at: [0, Y + 0.07, 0.14], color: SCARLET, colorTop: SCARLET_LIGHT });
    head.sphere({ r: 0.042, detail: 0, at: [0.045, Y + 0.065, 0.18], scale: [0.8, 1, 0.9], color: CREAM, mirror: true });
    head.sphere({ r: 0.016, detail: 0, at: [0.058, Y + 0.08, 0.196], color: DARK, mirror: true });
    head.cone({ r: 0.038, h: 0.09, seg: 6, base: [0, Y + 0.075, 0.205], rot: [HALF_PI + 0.55, 0, 0], color: YELLOW });
    head.sphere({ r: 0.026, detail: 0, at: [0, Y + 0.045, 0.21], color: DARK });

    const tail = m.part('tail', { pivot: [0, Y, -0.12], parent: 'body' });
    tail.cone({ r: 0.055, h: 0.36, seg: 4, base: [0, Y - 0.012, -0.12], rot: [-HALF_PI - 0.2, 0, 0], scale: [1, 1, 0.3], color: MACAW_BLUE, colorTop: MACAW_BLUE_LIGHT });
    tail.cone({ r: 0.05, h: 0.25, seg: 4, base: [0, Y + 0.002, -0.12], rot: [-HALF_PI - 0.2, 0, 0], scale: [1, 1, 0.3], color: SCARLET, colorTop: SCARLET_LIGHT });

    // Flügel: blaue Schwungfedern, gelbes Band, rote Deckfedern, flach ausgebreitet
    /** @type {[number, number][]} */
    const blue = [[0.04, 0.09], [0.16, 0.1], [0.29, 0.07], [0.41, 0], [0.37, -0.035], [0.31, -0.03], [0.29, -0.075], [0.23, -0.06], [0.2, -0.11], [0.14, -0.09], [0.1, -0.12], [0.04, -0.09]];
    /** @type {[number, number][]} */
    const yellow = [[0.04, 0.092], [0.2, 0.096], [0.245, 0.035], [0.2, -0.04], [0.04, -0.045]];
    /** @type {[number, number][]} */
    const red = [[0.04, 0.095], [0.13, 0.1], [0.15, 0.045], [0.12, 0.0], [0.04, -0.005]];
    for (const [name, side] of /** @type {[string, number][]} */ ([['wingL', -1], ['wingR', 1]])) {
      const wing = m.part(name, { pivot: [side * 0.05, Y + 0.04, 0.02], parent: 'body' });
      /** @param {[number, number][]} pts @returns {[number, number][]} */
      const flip = (pts) => (side > 0 ? pts : pts.map(([x, z]) => /** @type {[number, number]} */ ([-x, z])).reverse());
      wing.extrude({ points: flip(blue), depth: 0.016, at: [0, Y + 0.04, 0.02], rot: [HALF_PI, 0, 0], color: MACAW_BLUE, shade: 0 });
      wing.extrude({ points: flip(yellow), depth: 0.016, at: [0, Y + 0.049, 0.02], rot: [HALF_PI, 0, 0], color: YELLOW, shade: 0 });
      wing.extrude({ points: flip(red), depth: 0.016, at: [0, Y + 0.058, 0.02], rot: [HALF_PI, 0, 0], color: SCARLET, shade: 0 });
    }

    // Krallen halten den Beutesack
    const sack = m.part('sack', { pivot: [0, Y - 0.07, 0.03], parent: 'body' });
    limb(sack, [0.025, Y - 0.06, 0.03], [0.015, Y - 0.13, 0.035], 0.016, 0.014, IRON, { mirror: true });
    sack.sphere({ r: 0.065, at: [0, Y - 0.19, 0.035], scale: [1, 0.9, 1], color: SACK, colorTop: SACK_LIGHT });
    sack.cyl({ r: 0.022, rTop: 0.032, h: 0.04, seg: 6, base: [0, Y - 0.145, 0.035], color: SACK });
    sack.torus({ r: 0.025, tube: 0.009, seg: 6, tubeSeg: 3, at: [0, Y - 0.14, 0.035], color: LEATHER_DARK });
    sack.cyl({ r: 0.028, h: 0.01, seg: 7, at: [0.035, Y - 0.15, 0.06], rot: [0.4, 0, -0.5], color: GOLD_LIGHT });

    return m.build({
      stride: 0.7,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const ph = ctx.walk + ctx.t * 5 + ctx.seed * 6;
        const f = Math.sin(ph);
        // Kräftiger Flügelschlag; der Körper hebt sich im Abschlag.
        pose.wingR.rotation.z = f * 0.75 + 0.15;
        pose.wingL.rotation.z = -(f * 0.75 + 0.15);
        A.hover(pose, ctx, 'body', 0.02, 0.6);
        pose.body.position.y -= f * 0.028;
        pose.body.rotation.x = 0.08 * k + Math.cos(ph) * 0.04;
        pose.tail.rotation.x = f * 0.1;
        pose.head.rotation.x = -0.06 * k - f * 0.05;
        pose.head.rotation.y = Math.sin(ctx.t * 1.3 + ctx.seed * 6) * 0.3;
        pose.sack.rotation.x = 0.2 * k + Math.sin(ph - 1.2) * 0.12;
        pose.sack.rotation.z = Math.sin(ctx.t * 1.7 + ctx.seed * 6) * 0.1;
        A.flinch(pose, ctx, 'body', 0.2);
      },
    });
  },

  // Boss, gepanzert: die Landgaleone. Ein Piratenschiff auf sechs Rädern mit zwei Masten, gebauschten Segeln,
  // Totenkopfflagge und einem Kapitän mit Fernrohr am Bug; schaukelt, als wäre der Weg die hohe See.
  'boss.entdecker.landgaleone': () => {
    const m = createModel('boss.entdecker.landgaleone');
    const R = 0.145;
    const WX = 0.33;

    // Fahrgestell: drei Achsen, bleibt am Boden, während der Rumpf darüber schaukelt
    const chassis = m.part('chassis', { pivot: [0, R, 0] });
    for (const z of [-0.4, -0.02, 0.36]) chassis.cyl({ r: 0.026, h: 2 * WX - 0.04, seg: 5, at: [0, R, z], rot: [0, 0, HALF_PI], color: IRON });

    const hull = m.part('hull', { pivot: [0, 0.2, 0] });
    // Rumpf in Lagen: Kiel, Eisenband (Panzerung), Bordwand, türkiser Streifen, Goldkante, Deck, Reling
    slab(hull, hullOutline(0.84, 0.95), 0.16, 0.315, STEEL_DARK);
    slab(hull, hullOutline(1, 1), 0.3, 0.5, WOOD);
    slab(hull, hullOutline(1.025, 1.015), 0.38, 0.45, TEAL);
    slab(hull, hullOutline(1.018, 1.01), 0.485, 0.505, GOLD);
    slab(hull, hullOutline(0.9, 0.93), 0.5, 0.516, DECK);
    for (const side of [1, -1]) {
      /** @type {[number, number][]} */
      const outer = HULL_HALF.map(([x, z]) => [x * side, z]);
      /** @type {[number, number][]} */
      const inner = HULL_HALF.map(([x, z]) => [x * 0.9 * side, z * 0.93]);
      const strip = [...outer, ...inner.reverse()];
      slab(hull, side > 0 ? strip : strip.reverse(), 0.505, 0.565, TEAL_LIGHT);
    }
    // Stählerne Bugplatte
    /** @type {[number, number][]} */
    const bow = HULL_HALF.filter(([, z]) => z >= 0.25).map(([x, z]) => [x * 1.035, z * 1.02]);
    slab(hull, [...bow, ...bow.slice(0, -1).reverse().map(([x, z]) => /** @type {[number, number]} */ ([-x, z]))], 0.3, 0.375, STEEL);
    // Back (Vorderkastell): erhöhtes Deck am Bug, darauf steht der Kapitän
    /** @type {[number, number][]} */
    const fore = HULL_HALF.filter(([, z]) => z >= 0.25);
    /** @type {[number, number][]} */
    const foreOutline = [...fore, ...fore.slice(0, -1).reverse().map(([x, z]) => /** @type {[number, number]} */ ([-x, z]))];
    slab(hull, foreOutline, 0.5, 0.6, WOOD);
    slab(hull, foreOutline.map(([x, z]) => [x * 1.02, z * 1.008 - (z < 0.3 ? 0.006 : 0)]), 0.57, 0.6, TEAL_LIGHT);
    slab(hull, foreOutline.map(([x, z]) => [x * 0.88, z * 0.97 + 0.012]), 0.6, 0.612, DECK);
    // Achterkastell mit Goldband und Deck
    /** @type {[number, number][]} */
    const castle = [[0.25, -0.62], [0.29, -0.45], [0.302, -0.28], [-0.302, -0.28], [-0.29, -0.45], [-0.25, -0.62]];
    slab(hull, castle, 0.5, 0.72, WOOD);
    slab(hull, castle.map(([x, z]) => [x * 1.025, z * 1.01 + (z > -0.3 ? 0.006 : 0)]), 0.66, 0.69, GOLD);
    slab(hull, castle.map(([x, z]) => [x * 0.9, z * 0.97 - 0.01]), 0.72, 0.732, DECK);
    /** @type {[number, number][]} */
    const castleRail = [[0.302, -0.28], [0.29, -0.45], [0.25, -0.62], [-0.25, -0.62], [-0.29, -0.45], [-0.302, -0.28],
      [-0.262, -0.28], [-0.252, -0.44], [-0.218, -0.585], [0.218, -0.585], [0.252, -0.44], [0.262, -0.28]];
    slab(hull, castleRail, 0.72, 0.775, TEAL_LIGHT);
    // Heckfenster und Laterne
    for (const x of [-0.13, 0, 0.13]) hull.box({ size: [0.042, 0.052, 0.01], at: [x, 0.585, -0.633], color: LANTERN, glow: true });
    hull.cyl({ r: 0.016, h: 0.14, seg: 5, base: [0, 0.73, -0.56], color: IRON });
    hull.box({ size: [0.065, 0.08, 0.065], at: [0, 0.905, -0.56], color: LANTERN, glow: true });
    hull.cone({ r: 0.055, h: 0.05, seg: 4, base: [0, 0.945, -0.56], rot: [0, Math.PI / 4, 0], color: IRON });
    // Offene Schatztruhe auf dem Deck zwischen den Masten
    hull.box({ size: [0.17, 0.08, 0.11], base: [0, 0.512, 0.12], color: WOOD_DARK, colorTop: WOOD });
    hull.box({ size: [0.178, 0.018, 0.118], at: [0, 0.545, 0.12], color: GOLD });
    hull.dome({ r: 0.075, seg: 6, rings: 2, at: [0, 0.59, 0.12], scale: [1.05, 0.5, 0.68], color: GOLD, colorTop: GOLD_LIGHT });
    hull.box({ size: [0.17, 0.09, 0.022], at: [0, 0.63, 0.055], rot: [-0.45, 0, 0], color: RED, colorTop: RED_LIGHT });
    // Kanonenpforten mit Rohren
    for (const z of [-0.12, 0.17]) {
      const x = hullX(z) * 1.025;
      hull.box({ size: [0.012, 0.055, 0.07], at: [x + 0.004, 0.415, z], color: DARK, mirror: true });
      hull.cyl({ r: 0.022, rTop: 0.026, h: 0.07, seg: 5, at: [x + 0.03, 0.415, z], rot: [0, 0, -HALF_PI], color: IRON, mirror: true });
    }
    // Bugspriet und goldene Galionsfigur
    limb(hull, [0, 0.5, 0.58], [0, 0.68, 0.8], 0.03, 0.02, WOOD_DARK);
    hull.sphere({ r: 0.04, detail: 0, at: [0, 0.45, 0.672], scale: [0.8, 1, 1], color: GOLD_LIGHT });

    // Masten, Rahen, Krähennest
    const MZ = -0.06;
    const FZ = 0.3;
    hull.cyl({ r: 0.032, rTop: 0.022, h: 1.0, seg: 5, base: [0, 0.5, MZ], color: WOOD_DARK });
    hull.cyl({ r: 0.03, rTop: 0.022, h: 0.8, seg: 5, base: [0, 0.5, FZ], color: WOOD_DARK });
    for (const [y, z, w] of /** @type {[number, number, number][]} */ ([[1.06, MZ, 0.6], [1.41, MZ, 0.46], [0.98, FZ, 0.54], [1.24, FZ, 0.4]])) {
      hull.cyl({ r: 0.016, h: w, seg: 4, at: [0, y, z + 0.02], rot: [0, 0, HALF_PI], color: WOOD_DARK });
    }
    hull.cyl({ r: 0.065, rTop: 0.078, h: 0.06, seg: 8, base: [0, 1.1, MZ], color: WOOD, colorTop: WOOD_LIGHT });

    // Segel als eigene Teile, damit sie sich im Wind bauschen
    const sailMain = m.part('sailMain', { pivot: [0, 0.9, MZ + 0.02], parent: 'hull' });
    sail(sailMain, 0.28, 0.08, 0.02, 0.68, 1.055, MZ + 0.03, SAIL);
    sail(sailMain, 0.29, 0.088, 0.032, 0.83, 0.9, MZ + 0.03, RED);
    sail(sailMain, 0.21, 0.06, 0.02, 1.17, 1.405, MZ + 0.03, SAIL);
    const sailFore = m.part('sailFore', { pivot: [0, 0.85, FZ + 0.02], parent: 'hull' });
    sail(sailFore, 0.25, 0.075, 0.02, 0.66, 0.975, FZ + 0.03, SAIL);
    sail(sailFore, 0.26, 0.083, 0.032, 0.78, 0.85, FZ + 0.03, RED);
    sail(sailFore, 0.18, 0.055, 0.02, 1.02, 1.235, FZ + 0.03, SAIL_SHADE);

    // Totenkopfflagge (freundlich) an der Spitze des Großmasts
    const flag = m.part('flag', { pivot: [0, 1.45, MZ], parent: 'hull' });
    flag.extrude({ points: [[0, -0.075], [0, 0.075], [-0.25, 0.08], [-0.21, 0], [-0.25, -0.08]], depth: 0.012, at: [0, 1.43, MZ - 0.02], rot: [0, -HALF_PI, 0], color: FLAG, shade: 0 });
    flag.sphere({ r: 0.036, detail: 0, at: [0, 1.445, MZ - 0.14], scale: [0.5, 1, 1], color: CREAM });
    flag.box({ size: [0.02, 0.016, 0.11], at: [0, 1.405, MZ - 0.14], rot: [0.55, 0, 0], color: CREAM });
    flag.box({ size: [0.02, 0.016, 0.11], at: [0, 1.405, MZ - 0.14], rot: [-0.55, 0, 0], color: CREAM });

    // Kapitän mit rotem Rock, rotem Bart, großem Dreispitz mit Feder und Fernrohr
    const CZ = 0.4;
    const captain = m.part('captain', { pivot: [0, 0.62, CZ], parent: 'hull' });
    captain.lathe({ points: [[0, 0.61], [0.1, 0.615], [0.108, 0.69], [0.092, 0.78], [0.06, 0.81], [0, 0.815]], seg: 8, scale: [1, 1, 0.85], at: [0, 0, CZ], color: RED, colorTop: RED_LIGHT });
    captain.box({ size: [0.03, 0.15, 0.012], at: [0, 0.7, CZ + 0.09], rot: [-0.07, 0, 0], color: GOLD_LIGHT });
    captain.sphere({ r: 0.034, detail: 0, at: [0, 0.79, CZ + 0.065], color: CREAM });
    captain.sphere({ r: 0.085, at: [0, 0.885, CZ + 0.005], color: SKIN });
    captain.sphere({ r: 0.07, detail: 0, at: [0, 0.845, CZ + 0.04], scale: [1.05, 0.9, 0.75], color: RED_BEARD });
    captain.box({ size: [0.02, 0.026, 0.012], at: [0.03, 0.9, CZ + 0.083], color: DARK, mirror: true });
    captain.sphere({ r: 0.022, detail: 0, at: [0, 0.878, CZ + 0.09], color: SKIN_DARK });
    tricorne(captain, [0, 0.94, CZ], 0.16);
    captain.extrude({ points: [[0.02, 0], [-0.02, 0], [-0.07, 0.07], [-0.15, 0.1], [-0.2, 0.08], [-0.13, 0.13], [-0.04, 0.12], [0.03, 0.06]], depth: 0.03, base: [0.075, 0.985, CZ - 0.02], rot: [0, HALF_PI, 0.25], color: WHITE });
    limb(captain, [-0.095, 0.77, CZ], [-0.12, 0.68, CZ + 0.02], 0.032, 0.03, RED, { seg: 5 });
    captain.sphere({ r: 0.03, detail: 0, at: [-0.12, 0.67, CZ + 0.025], color: SKIN });
    // Fernrohrarm: das Rohr am rechten Auge
    const scope = m.part('scope', { pivot: [0.095, 0.77, CZ], parent: 'captain' });
    limb(scope, [0.095, 0.77, CZ], [0.07, 0.86, CZ + 0.1], 0.032, 0.03, RED, { seg: 5 });
    scope.sphere({ r: 0.03, detail: 0, at: [0.065, 0.87, CZ + 0.11], color: SKIN });
    limb(scope, [0.035, 0.9, CZ + 0.07], [0.04, 0.915, CZ + 0.17], 0.02, 0.022, GOLD, { seg: 6 });
    limb(scope, [0.04, 0.915, CZ + 0.17], [0.045, 0.93, CZ + 0.28], 0.028, 0.032, GOLD, { seg: 6, colorTop: GOLD_LIGHT });

    // Räder
    wheelPair(m.part('wheelsB', { pivot: [0, R, -0.4] }), WX, R, -0.4);
    wheelPair(m.part('wheelsM', { pivot: [0, R, -0.02] }), WX, R, -0.02);
    wheelPair(m.part('wheelsF', { pivot: [0, R, 0.36] }), WX, R, 0.36);

    // Pulverdampf aus den Kanonenpforten (harmlose Wölkchen)
    const PX = hullX(0.17) * 1.025 + 0.075;
    for (const [name, side] of /** @type {[string, number][]} */ ([['puffL', -1], ['puffR', 1]])) {
      const puff = m.part(name, { pivot: [side * PX, 0.415, 0.17], parent: 'hull' });
      puff.sphere({ r: 0.05, detail: 0, at: [side * PX, 0.415, 0.17], color: SMOKE });
      puff.sphere({ r: 0.036, detail: 0, at: [side * (PX + 0.04), 0.45, 0.14], color: SMOKE });
    }

    return m.build({
      stride: 0.6,
      animate(pose, ctx) {
        const k = Math.min(1, ctx.move);
        const t = ctx.t + ctx.seed * 10;
        const roll = ctx.walk * (0.6 / (TAU * R));
        pose.wheelsB.rotation.x = roll;
        pose.wheelsM.rotation.x = roll;
        pose.wheelsF.rotation.x = roll;
        // Seegang: Rollen, Stampfen und ein leichtes Heben.
        pose.hull.rotation.z = Math.sin(t * 1.1) * 0.07;
        pose.hull.rotation.x = Math.sin(t * 0.8 + 1) * 0.03;
        pose.hull.position.y += Math.sin(t * 1.6) * 0.012 + Math.abs(Math.sin(ctx.walk * 1.5)) * 0.008 * k;
        pose.sailMain.scale.z = 1 + Math.sin(t * 1.3) * 0.12;
        pose.sailFore.scale.z = 1 + Math.sin(t * 1.3 + 0.7) * 0.12;
        pose.flag.rotation.y = Math.sin(t * 3.2) * 0.3;
        pose.captain.rotation.y = Math.sin(t * 0.5) * 0.45;
        pose.scope.rotation.x = Math.sin(t * 0.9) * 0.05;
        // Abwechselnd puffen die Kanonen ein Dampfwölkchen.
        for (let i = 0; i < 2; i++) {
          const p = pose[i === 0 ? 'puffL' : 'puffR'];
          const side = i === 0 ? -1 : 1;
          const ph = (t * 0.4 + i * 0.5) % 1;
          if (ph < 0.4) {
            const u = ph / 0.4;
            p.scale.setScalar(Math.max(1e-4, Math.sin(u * Math.PI) * 1.2));
            p.position.x += side * u * 0.12;
            p.position.y += u * 0.1;
          } else {
            p.scale.setScalar(1e-4);
          }
        }
        A.flinch(pose, ctx, 'hull', 0.05);
      },
    });
  },
};
