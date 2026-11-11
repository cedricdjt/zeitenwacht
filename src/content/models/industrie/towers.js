// @ts-check
// Türme des Industriezeitalters: Kurbelgeschütz, Dampfmörser, Ölpumpe, Stahlkanone, Gasbrenner, Telegrafenmast.
// Alle stehen auf demselben achteckigen Backsteinsockel mit Steinabdeckung und einem Band in der Rollenfarbe
// (gleiche Standfläche, gleiche Lage von Band und Stufenpunkten wie in den anderen Zeitaltern, damit modernisierte
// Türme wiedererkennbar bleiben).
//
// Sparsam gebaut: Alles, was sich nicht selbst bewegt, steckt im Sockelteil; Stufe 2 und 3 haben je ein festes Teil
// und nur dort eigene Teile, wo sich der Zusatz mitdreht. Mündungsfeuer und Rauch zeichnet die Effektschicht am Punkt
// `muzzle`, deshalb tragen die Modelle keine eigenen Blitzteile.

import * as A from '../../../render/anim.js';
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { ModelBuilder, PartBuilder } from '../../../render/kit.js' */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;

// --- Materialfarben des Zeitalters: Backstein, Pflasterstein, Gusseisen, Stahl, Messing, Kupfer, Emaillegrün ---
const BRICK = '#a85a42';
const BRICK_LIGHT = '#c4775a';
const BRICK_DARK = '#84432f';
const MORTAR = '#d2c2b2';
const STONE = '#a8a1a8';
const STONE_LIGHT = '#cfc9ce';
const DECK = '#8d8790';
const DECK_LIGHT = '#aaa4ad';
const IRON = '#4b4a52';
const IRON_LIGHT = '#6f6e78';
const IRON_DARK = '#36353c';
const STEEL = '#7d8590';
const STEEL_LIGHT = '#aab2bc';
const STEEL_DARK = '#5b616b';
const GUN = '#56606e';
const GUN_LIGHT = '#8592a2';
const GUN_DARK = '#3e4550';
const BRASS = '#c99a3a';
const BRASS_LIGHT = '#ecc66a';
const BRASS_DARK = '#9a7228';
const COPPER = '#c87533';
const COPPER_LIGHT = '#e8995a';
const ENAMEL = '#2f6b5e';
const ENAMEL_LIGHT = '#4b8c7c';
const WOOD = '#9c7049';
const WOOD_LIGHT = '#bf9466';
const WOOD_DARK = '#6e4d33';
const PORCELAIN = '#f1ece2';
const SKIN = '#e8b892';
const CAP = '#5e5249';
const TROUSERS = '#4a4440';
const DARK = '#2a2420';
const LEATHER = '#7a4630';
const STEAM = '#efebe6';
const OIL = '#2d2a38';
const OIL_SHINE = '#46707a';
const PILOT = '#4f9cff';
const PILOT_LIGHT = '#d4e8ff';
const WINDOW = '#ffc46a';
const WINDOW_LIGHT = '#ffe6a8';
const SLATE = '#5a5560';

// --- Rollenfarben ---
const BLUE = '#3d7dd8';
const BLUE_LIGHT = '#6da0ea';
const BLUE_DARK = '#2f62b0';
const ORANGE = '#e8842a';
const ORANGE_LIGHT = '#f5a652';
const TEAL = '#26b5a8';
const TEAL_LIGHT = '#5fd6c9';
const VIOLET = '#8a55d6';
const VIOLET_LIGHT = '#a97ee6';
const VIOLET_DARK = '#6c3fb0';
const RED = '#d8432f';
const RED_LIGHT = '#ea6a55';
const RED_DARK = '#a8321f';
const GOLD = '#f2c230';
const GOLD_LIGHT = '#ffe07a';

/** Oberkante des Sockels. */
const TOP = 0.235;
/** Schläge pro Sekunde der Musik des Zeitalters (108 BPM). */
const BEAT = 108 / 60;

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
 * @param {{ rTop?: number, seg?: number, colorTop?: string, open?: boolean }} [o]
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
    open: o.open,
    at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [Math.atan2(dz, dy), 0, -Math.asin(dx / len)],
    color,
    colorTop: o.colorTop,
  });
}

/**
 * Backsteinsockel mit Steinabdeckung, Pflasterdeck, Band in der Rollenfarbe und dem ersten Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function plinth(m, role) {
  const base = m.part('base');
  base.cyl({ r: 0.44, rTop: 0.43, h: 0.17, seg: 8, base: [0, -0.05, 0], color: BRICK_DARK, colorTop: BRICK });
  base.cyl({ r: 0.443, h: 0.012, seg: 8, open: true, base: [0, 0.04, 0], color: MORTAR });
  base.cyl({ r: 0.432, h: 0.075, seg: 8, base: [0, 0.1, 0], color: role, shade: 0.1 });
  base.cyl({ r: 0.415, rTop: 0.39, h: 0.065, seg: 8, base: [0, 0.17, 0], color: STONE, colorTop: STONE_LIGHT });
  base.cyl({ r: 0.35, h: 0.014, seg: 8, base: [0, TOP - 0.006, 0], color: DECK, colorTop: DECK_LIGHT });
  base.sphere({ r: 0.045, detail: 0, at: [0, 0.235, 0.36], color: role });
  return base;
}

/**
 * Teil der Stufe 2: zweites Farbband, vier gusseiserne Poller mit Kappen in der Rollenfarbe, zweiter Stufenpunkt.
 * @param {ModelBuilder} m
 * @param {string} role
 * @returns {PartBuilder}
 */
function tier2(m, role) {
  const p = m.part('tier2', { minLevel: 2 });
  p.cyl({ r: 0.455, h: 0.045, seg: 8, base: [0, 0.015, 0], color: role, shade: 0.1 });
  for (const [x, z] of [[0.31, 0.31], [-0.31, 0.31], [-0.31, -0.31], [0.31, -0.31]]) {
    p.cyl({ r: 0.058, rTop: 0.05, h: 0.17, seg: 6, base: [x, -0.03, z], color: IRON, colorTop: IRON_LIGHT });
    p.sphere({ r: 0.062, detail: 0, at: [x, 0.15, z], scale: [1, 0.75, 1], color: role });
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
 * Sitzender Kanonier im blauen Arbeitskittel mit Schiebermütze, ohne Arme. Hüfte bei (x, y, z), Blick nach +Z.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function seatedGunner(p, x, y, z) {
  for (const s of [-1, 1]) {
    p.box({ size: [0.06, 0.055, 0.13], at: [x + s * 0.045, y + 0.02, z + 0.06], color: TROUSERS });
    p.box({ size: [0.055, 0.13, 0.06], base: [x + s * 0.045, y - 0.13, z + 0.12], color: TROUSERS });
  }
  p.box({ size: [0.17, 0.18, 0.12], base: [x, y, z - 0.01], rot: [0.12, 0, 0], color: BLUE_DARK, colorTop: BLUE });
  p.sphere({ r: 0.08, at: [x, y + 0.255, z + 0.03], color: SKIN });
  p.cyl({ r: 0.09, rTop: 0.082, h: 0.035, seg: 7, base: [x, y + 0.295, z + 0.02], color: CAP });
  p.box({ size: [0.13, 0.014, 0.07], at: [x, y + 0.302, z + 0.1], rot: [0.12, 0, 0], color: CAP });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Schütze: Kurbelgeschütz. Genieteter Eisentrommel-Sockel, darauf ein drehbares Gestell mit grünem Emailleschild,
  // ein Messing-Rohrbündel mit Handkurbel und ein sitzender Kanonier. Stufe 2: blauer Patronentrichter, Stufe 3: Zwillingsbündel.
  'tower.industrie.schuetze': () => {
    const m = createModel('tower.industrie.schuetze');
    const base = plinth(m, BLUE);
    const DY = TOP + 0.165;
    base.cyl({ r: 0.2, rTop: 0.19, h: DY - TOP + 0.005, seg: 10, base: [0, TOP - 0.005, 0], color: IRON, colorTop: IRON_LIGHT });
    base.cyl({ r: 0.206, h: 0.05, seg: 10, open: true, base: [0, TOP + 0.055, 0], color: BLUE });
    base.cyl({ r: 0.196, h: 0.018, seg: 10, open: true, base: [0, DY - 0.03, 0], color: IRON_DARK });

    // Drehgestell mit Schild, Wangen und Kanonier
    const YB = DY + 0.17;
    const turret = m.part('turret', { pivot: [0, DY, 0] });
    turret.cyl({ r: 0.21, h: 0.035, seg: 10, base: [0, DY, 0], color: BLUE_DARK, colorTop: BLUE });
    for (const s of [-1, 1]) {
      turret.box({ size: [0.04, 0.2, 0.18], base: [s * 0.215, DY + 0.03, 0.0], color: ENAMEL, colorTop: ENAMEL_LIGHT });
    }
    turret.cyl({ r: 0.026, h: 0.47, seg: 6, at: [0, YB, 0.0], rot: [0, 0, HALF], color: IRON });
    // Schild: Mittelplatte, schräge Flügel, blaue Oberkante
    turret.box({ size: [0.34, 0.25, 0.03], at: [0, YB + 0.02, 0.11], rot: [-0.12, 0, 0], color: ENAMEL, colorTop: ENAMEL_LIGHT });
    for (const s of [-1, 1]) {
      turret.box({ size: [0.11, 0.23, 0.03], at: [s * 0.215, YB + 0.01, 0.085], rot: [-0.12, s * 0.5, 0], color: ENAMEL, colorTop: ENAMEL_LIGHT });
    }
    turret.box({ size: [0.36, 0.04, 0.05], at: [0, YB + 0.15, 0.095], color: BLUE, colorTop: BLUE_LIGHT });
    // Sitz und Kanonier
    rod(turret, [0, DY + 0.03, -0.14], [0, DY + 0.13, -0.25], 0.025, IRON);
    turret.box({ size: [0.15, 0.03, 0.12], base: [0, DY + 0.12, -0.26], color: LEATHER });
    const GZ = -0.27;
    const HY = DY + 0.15;
    seatedGunner(turret, 0, HY, GZ);
    for (const s of [-1, 1]) {
      rod(turret, [s * 0.095, HY + 0.15, GZ + 0.0], [s * 0.12, YB - 0.01, -0.12], 0.03, BLUE_DARK);
      turret.sphere({ r: 0.03, detail: 0, at: [s * 0.12, YB - 0.01, -0.115], color: SKIN });
    }

    /**
     * Drehendes Rohrbündel mit Gehäuse und Kurbel hinten auf der Achse.
     * @param {PartBuilder} p
     * @param {number} x
     * @param {string} trim
     */
    const bundle = (p, x, trim) => {
      p.cyl({ r: 0.088, h: 0.15, seg: 8, at: [x, YB, -0.03], rot: [HALF, 0, 0], color: BRASS, colorTop: BRASS_LIGHT });
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        p.cyl({ r: 0.021, h: 0.25, seg: 5, at: [x + Math.cos(a) * 0.052, YB + Math.sin(a) * 0.052, 0.175], rot: [HALF, 0, 0], color: STEEL, colorTop: STEEL_LIGHT });
      }
      p.cyl({ r: 0.08, h: 0.025, seg: 8, at: [x, YB, 0.12], rot: [HALF, 0, 0], color: trim });
      p.cyl({ r: 0.08, h: 0.03, seg: 8, at: [x, YB, 0.275], rot: [HALF, 0, 0], color: trim });
      // Kurbel: Nabe, Arm, Griff
      p.cyl({ r: 0.03, h: 0.05, seg: 6, at: [x, YB, -0.125], rot: [HALF, 0, 0], color: IRON });
      p.box({ size: [0.03, 0.1, 0.03], at: [x, YB - 0.045, -0.145], color: IRON });
      p.cyl({ r: 0.02, h: 0.07, seg: 5, at: [x, YB - 0.09, -0.18], rot: [HALF, 0, 0], color: WOOD_LIGHT });
    };
    const b1 = m.part('bundle', { parent: 'turret', pivot: [0, YB, 0] });
    bundle(b1, 0, BRASS_DARK);

    // Stufe 2: blauer Patronentrichter auf dem Bündel
    tier2(m, BLUE);
    const hopper = m.part('hopper2', { parent: 'turret', pivot: [0, YB, 0], minLevel: 2 });
    hopper.box({ size: [0.05, 0.06, 0.05], base: [0, YB + 0.07, -0.03], color: BRASS_DARK });
    hopper.cyl({ r: 0.09, rTop: 0.12, h: 0.13, seg: 4, base: [0, YB + 0.115, -0.03], rot: [0, Math.PI / 4, 0], color: BLUE_DARK, colorTop: BLUE_LIGHT });
    hopper.cyl({ r: 0.126, h: 0.022, seg: 4, open: true, base: [0, YB + 0.23, -0.03], rot: [0, Math.PI / 4, 0], color: BRASS });

    // Stufe 3: Zwillingsbündel mit Kupferbeschlag, Kupferband an der Trommel
    const t3 = tier3(m, BLUE);
    t3.cyl({ r: 0.207, h: 0.03, seg: 10, open: true, base: [0, TOP + 0.115, 0], color: COPPER });
    const b3 = m.part('bundle3', { parent: 'turret', pivot: [0.1, YB, 0], minLevel: 3 });
    bundle(b3, 0.1, COPPER);

    m.point('muzzle', [0, YB, 0.31], 'bundle');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'turret');
        const f = ctx.fire;
        // Das Bündel dreht beim Schuss zwei volle Umdrehungen und beim Nachladen eine weitere: an den Nahtstellen
        // (Schuss, Ladeende) steht es jeweils in derselben Lage, deshalb springt nichts.
        const turn = smooth(1 - f) * TAU * 2 + ctx.charge * TAU;
        pose.bundle.rotation.z = -turn;
        pose.turret.position.z -= f * f * 0.02 + Math.sin(ctx.t * 70) * f * 0.006;
        if (ctx.level >= 3) {
          pose.bundle.position.x -= 0.1;
          pose.bundle3.rotation.z = turn + 0.5;
        }
      },
    });
  },

  // Werfer: Dampfmörser. Dickes Gusseisenrohr, 50 Grad steil auf einem Holzbett mit orangen Wangen über einem
  // gemauerten Fundament; daneben ein kleiner Kupferkessel mit Manometer, der beim Schuss Dampf abbläst, dahinter Bomben.
  'tower.industrie.werfer': () => {
    const m = createModel('tower.industrie.werfer');
    const base = plinth(m, ORANGE);
    const Y0 = TOP + 0.075;
    base.cyl({ r: 0.25, rTop: 0.24, h: Y0 - TOP + 0.005, seg: 10, base: [0, TOP - 0.005, 0], color: BRICK, colorTop: BRICK_LIGHT });
    // Kessel hinten links
    const BX = -0.25;
    const BZ = -0.21;
    base.cyl({ r: 0.08, h: 0.22, seg: 8, base: [BX, TOP, BZ], color: COPPER, colorTop: COPPER_LIGHT });
    base.dome({ r: 0.08, seg: 8, rings: 2, at: [BX, TOP + 0.22, BZ], color: COPPER, colorTop: COPPER_LIGHT });
    base.cyl({ r: 0.084, h: 0.025, seg: 8, open: true, base: [BX, TOP + 0.05, BZ], color: BRASS_DARK });
    base.cyl({ r: 0.022, h: 0.06, seg: 5, base: [BX, TOP + 0.29, BZ], color: BRASS, colorTop: BRASS_LIGHT });
    base.cyl({ r: 0.04, h: 0.018, seg: 7, at: [BX + 0.05, TOP + 0.16, BZ + 0.062], rot: [HALF, 0, 0.6], color: PORCELAIN });
    // Bombenpyramide hinten rechts
    for (const [x, y, z] of [[0.17, 0, -0.29], [0.28, 0, -0.2], [0.27, 0, -0.32], [0.24, 0.08, -0.27]]) {
      base.sphere({ r: 0.055, detail: 0, at: [x, TOP + 0.055 + y, z], color: IRON, colorTop: IRON_LIGHT });
    }

    // Drehbares Holzbett mit orangen Wangen
    const yaw = m.part('yaw', { pivot: [0, Y0, 0] });
    yaw.box({ size: [0.36, 0.05, 0.32], base: [0, Y0, 0], color: WOOD, colorTop: WOOD_LIGHT });
    for (const s of [-1, 1]) {
      yaw.box({ size: [0.05, 0.18, 0.24], base: [s * 0.2, Y0 + 0.045, -0.01], color: ORANGE, colorTop: ORANGE_LIGHT });
      yaw.box({ size: [0.06, 0.025, 0.25], base: [s * 0.2, Y0 + 0.225, -0.01], color: IRON });
    }
    const TH = 0.7;
    const P = /** @type {Vec3} */ ([0, Y0 + 0.24, 0]);
    yaw.cyl({ r: 0.04, h: 0.42, seg: 6, at: P, rot: [0, 0, HALF], color: IRON });
    const dy = Math.cos(TH);
    const dz = Math.sin(TH);
    /**
     * Punkt entlang der Rohrachse.
     * @param {number} s
     * @param {number} [x]
     * @returns {Vec3}
     */
    const along = (s, x = 0) => [x, P[1] + (s - 0.14) * dy, P[2] + (s - 0.14) * dz];
    /**
     * Mörserrohr mit Ringen.
     * @param {PartBuilder} p
     * @param {number} x
     * @param {string} ring
     */
    const barrel = (p, x, ring) => {
      p.lathe({
        points: [[0, 0], [0.09, 0], [0.122, 0.04], [0.126, 0.13], [0.11, 0.3], [0.114, 0.35], [0.136, 0.37], [0.136, 0.42], [0.094, 0.42], [0.09, 0.37], [0, 0.37]],
        seg: 10, base: along(0, x), rot: [TH, 0, 0], color: IRON, colorTop: IRON_LIGHT,
      });
      p.cyl({ r: 0.13, h: 0.028, seg: 10, open: true, at: along(0.07, x), rot: [TH, 0, 0], color: ring });
      p.cyl({ r: 0.122, h: 0.06, seg: 10, open: true, at: along(0.22, x), rot: [TH, 0, 0], color: ORANGE });
      p.cyl({ r: 0.118, h: 0.024, seg: 10, open: true, at: along(0.31, x), rot: [TH, 0, 0], color: ring });
    };
    const b1 = m.part('barrel', { parent: 'yaw', pivot: P });
    barrel(b1, 0, BRASS);
    // Dampfwolke über dem Ventil
    const steam = m.part('steam', { pivot: [BX, TOP + 0.35, BZ] });
    steam.sphere({ r: 0.07, detail: 0, at: [BX, TOP + 0.4, BZ], color: STEAM });
    steam.sphere({ r: 0.05, detail: 0, at: [BX + 0.05, TOP + 0.45, BZ + 0.02], color: STEAM });

    // Stufe 2: längeres Rohr (Skalierung im animate), Richtrad aus Messing an der rechten Wange
    tier2(m, ORANGE);
    const WP = /** @type {Vec3} */ ([0.245, Y0 + 0.16, -0.06]);
    const wheel = m.part('wheel2', { parent: 'yaw', pivot: WP, minLevel: 2 });
    wheel.torus({ r: 0.075, tube: 0.016, seg: 8, tubeSeg: 3, at: [WP[0] + 0.02, WP[1], WP[2]], rot: [0, 0, HALF], color: BRASS, colorTop: BRASS_LIGHT });
    wheel.box({ size: [0.02, 0.15, 0.022], at: [WP[0] + 0.02, WP[1], WP[2]], color: BRASS_DARK });
    wheel.box({ size: [0.02, 0.022, 0.15], at: [WP[0] + 0.02, WP[1], WP[2]], color: BRASS_DARK });

    // Stufe 3: Zwillingsrohre mit Kupferringen
    tier3(m, ORANGE);
    const b3 = m.part('barrel3', { parent: 'yaw', pivot: [0.095, P[1], P[2]], minLevel: 3 });
    barrel(b3, 0.095, COPPER);

    m.point('muzzle', along(0.44), 'barrel');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        const k = f * f;
        const lvl = ctx.level;
        if (lvl >= 3) {
          pose.barrel.position.x -= 0.095;
          pose.barrel.scale.set(0.82, 1.1, 1.1);
          pose.barrel3.scale.set(0.82, 1.1, 1.1);
        } else if (lvl >= 2) {
          pose.barrel.scale.set(1, 1.14, 1.14);
        }
        // Rückstoß ins Bett, das ganze Bett hüpft
        pose.barrel.position.y -= k * 0.06 * dy;
        pose.barrel.position.z -= k * 0.06 * dz;
        if (lvl >= 3) {
          // Das zweite Rohr schießt in der Mitte des Nachladens nach.
          const c = ctx.charge;
          const f2 = c > 0.4 && c < 0.7 ? 1 - (c - 0.4) / 0.3 : 0;
          pose.barrel3.position.y -= f2 * f2 * 0.06 * dy;
          pose.barrel3.position.z -= f2 * f2 * 0.06 * dz;
        }
        pose.yaw.position.y += Math.sin(f * Math.PI) * 0.03;
        // Das Ventil bläst beim Schuss Dampf ab und dampft sonst leise vor sich hin.
        const idle = 0.35 + 0.15 * Math.sin((ctx.t * 0.7 + ctx.seed) * TAU);
        const puff = f > 0 ? 4 * f * (1 - f) * 1.6 : 0;
        pose.steam.scale.setScalar(Math.max(1e-3, Math.max(idle, puff)));
        pose.steam.position.y += (1 - f) * (f > 0 ? 0.1 : 0) + Math.sin(ctx.t * 1.3) * 0.01;
        if (lvl >= 2) pose.wheel2.rotation.x = ctx.charge * TAU;
      },
    });
  },

  // Bremser: Ölpumpe. Genieteter Öltank mit türkisem Band und Deckel, darauf eine drehbare Düse; dahinter ein kleiner
  // Pferdekopf-Pumpbock, der unablässig nickt, mit drehendem Gegengewicht und einer schillernden Öllache am Bohrloch.
  'tower.industrie.bremser': () => {
    const m = createModel('tower.industrie.bremser');
    const base = plinth(m, TEAL);
    // Öltank
    const TZ = 0.07;
    const TH = 0.3;
    base.cyl({ r: 0.175, h: TH, seg: 10, base: [0, TOP - 0.005, TZ], color: IRON, colorTop: IRON_LIGHT });
    base.cyl({ r: 0.181, h: 0.075, seg: 10, open: true, base: [0, TOP + 0.13, TZ], color: TEAL });
    base.cyl({ r: 0.18, h: 0.02, seg: 10, open: true, base: [0, TOP + 0.03, TZ], color: IRON_DARK });
    base.dome({ r: 0.175, seg: 10, rings: 2, at: [0, TOP + TH - 0.005, TZ], scale: [1, 0.38, 1], color: TEAL, colorTop: TEAL_LIGHT });

    // Pumpbock hinten, Schwengel entlang X
    const PZ = -0.25;
    const PY = TOP + 0.3;
    for (const s of [-1, 1]) rod(base, [0.0, TOP, PZ + s * 0.09], [0.0, PY, PZ], 0.026, WOOD_DARK, { seg: 4 });
    base.box({ size: [0.06, 0.04, 0.05], at: [0, PY, PZ], color: IRON });
    // Getriebekasten und Bohrloch mit Öllache
    base.box({ size: [0.1, 0.09, 0.1], base: [-0.21, TOP, PZ], color: IRON, colorTop: IRON_LIGHT });
    base.cyl({ r: 0.035, h: 0.08, seg: 6, base: [0.25, TOP, PZ], color: IRON, colorTop: IRON_LIGHT });
    base.sphere({ r: 0.1, detail: 1, at: [0.22, TOP + 0.004, PZ + 0.06], scale: [1.1, 0.1, 0.8], color: OIL, colorTop: OIL_SHINE });
    const beam = m.part('beam', { pivot: [0, PY + 0.02, PZ] });
    beam.box({ size: [0.5, 0.045, 0.05], at: [0.0, PY + 0.035, PZ], color: WOOD, colorTop: WOOD_LIGHT });
    beam.extrude({ points: [[0, 0.06], [0.05, 0.035], [0.065, -0.03], [0.055, -0.1], [0, -0.1]], depth: 0.06, at: [0.245, PY + 0.035, PZ], color: IRON, colorTop: IRON_LIGHT });
    beam.box({ size: [0.04, 0.05, 0.06], at: [-0.235, PY + 0.035, PZ], color: IRON });
    const crank = m.part('crank', { pivot: [-0.21, TOP + 0.07, PZ] });
    crank.box({ size: [0.2, 0.035, 0.03], at: [-0.21, TOP + 0.07, PZ + 0.065], color: IRON_DARK });
    crank.box({ size: [0.07, 0.07, 0.04], at: [-0.13, TOP + 0.07, PZ + 0.065], color: IRON, colorTop: IRON_LIGHT });
    crank.box({ size: [0.07, 0.07, 0.04], at: [-0.29, TOP + 0.07, PZ + 0.065], color: IRON, colorTop: IRON_LIGHT });

    // Drehbare Düse auf dem Tankdeckel
    const NY = TOP + TH + 0.06;
    const nozzle = m.part('nozzle', { pivot: [0, NY, TZ] });
    nozzle.cyl({ r: 0.075, rTop: 0.065, h: 0.06, seg: 8, base: [0, NY - 0.02, TZ], color: BRASS_DARK, colorTop: BRASS });
    nozzle.cyl({ r: 0.07, h: 0.022, seg: 8, base: [0, NY + 0.04, TZ], color: TEAL });
    /**
     * Gebogenes Düsenrohr.
     * @param {PartBuilder} p
     * @param {number} x
     * @returns {Vec3} Mündung
     */
    const pipe = (p, x) => {
      rod(p, [x, NY + 0.03, TZ], [x, NY + 0.13, TZ + 0.13], 0.032, BRASS, { seg: 6, colorTop: BRASS_LIGHT });
      rod(p, [x, NY + 0.12, TZ + 0.12], [x, NY + 0.13, TZ + 0.25], 0.03, BRASS, { seg: 6 });
      rod(p, [x, NY + 0.13, TZ + 0.24], [x, NY + 0.135, TZ + 0.29], 0.032, IRON, { rTop: 0.048, seg: 7 });
      return [x, NY + 0.135, TZ + 0.3];
    };
    const muzzle = pipe(nozzle, -0.03);

    // Stufe 2: zweiter kleiner Tank vorn rechts
    const t2 = tier2(m, TEAL);
    t2.cyl({ r: 0.085, h: 0.2, seg: 8, base: [0.26, TOP - 0.005, 0.12], color: IRON, colorTop: IRON_LIGHT });
    t2.cyl({ r: 0.09, h: 0.045, seg: 8, open: true, base: [0.26, TOP + 0.1, 0.12], color: TEAL });
    t2.dome({ r: 0.085, seg: 8, rings: 2, at: [0.26, TOP + 0.195, 0.12], scale: [1, 0.45, 1], color: TEAL, colorTop: TEAL_LIGHT });

    // Stufe 3: Druckkessel aus Messing vorn links, zweite Düse
    const t3 = tier3(m, TEAL);
    t3.lathe({ points: [[0, 0], [0.07, 0], [0.075, 0.12], [0.06, 0.2], [0.03, 0.24], [0, 0.245]], seg: 8, base: [-0.25, TOP - 0.005, 0.12], color: BRASS, colorTop: BRASS_LIGHT });
    t3.cyl({ r: 0.079, h: 0.035, seg: 8, open: true, base: [-0.25, TOP + 0.05, 0.12], color: TEAL });
    const p3 = m.part('pipe3', { parent: 'nozzle', pivot: [0, NY, TZ], minLevel: 3 });
    pipe(p3, 0.045);

    m.point('muzzle', muzzle, 'nozzle');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'nozzle');
        const f = ctx.fire;
        pose.nozzle.rotation.x -= f * f * 0.22;
        pose.nozzle.position.y += f * f * 0.012;
        // Der Pumpbock nickt gleichmäßig; das Gegengewicht dreht passend dazu.
        const phase = (ctx.t * 0.55 + ctx.seed) * TAU;
        pose.beam.rotation.z = Math.sin(phase) * 0.2;
        pose.crank.rotation.z = -phase;
      },
    });
  },

  // Panzerknacker: Stahlkanone. Schlanke Säulenlafette, violetter Schutzschild, sehr langes Stahlrohr mit Rücklaufzylinder,
  // Messing-Zielfernrohr und Richtsitz. Vor dem Schuss schiebt sich eine Granate in den Verschluss, dann gleitet das Rohr weit zurück.
  'tower.industrie.knacker': () => {
    const m = createModel('tower.industrie.knacker');
    const base = plinth(m, VIOLET);
    const Y0 = TOP + 0.2;
    base.cyl({ r: 0.2, rTop: 0.17, h: 0.04, seg: 10, base: [0, TOP - 0.005, 0], color: STEEL_DARK, colorTop: STEEL });
    base.cyl({ r: 0.13, rTop: 0.09, h: Y0 - TOP - 0.03, seg: 8, base: [0, TOP + 0.03, 0], color: STEEL_DARK, colorTop: STEEL });

    const turret = m.part('turret', { pivot: [0, Y0, 0] });
    turret.cyl({ r: 0.15, h: 0.04, seg: 10, base: [0, Y0, 0], color: STEEL_DARK, colorTop: STEEL });
    const GY = Y0 + 0.13;
    const GZ = -0.06;
    // Wiege mit Schildzapfen
    for (const s of [-1, 1]) turret.box({ size: [0.035, 0.12, 0.17], base: [s * 0.07, Y0 + 0.035, GZ], color: STEEL_DARK, colorTop: STEEL });
    // Schutzschild: schräge Frontplatte mit kurzen Seitenflügeln
    turret.box({ size: [0.3, 0.18, 0.026], at: [0, GY + 0.01, GZ + 0.11], rot: [-0.5, 0, 0], color: VIOLET_DARK, colorTop: VIOLET_LIGHT });
    for (const s of [-1, 1]) turret.box({ size: [0.026, 0.14, 0.13], at: [s * 0.15, GY - 0.02, GZ + 0.05], color: VIOLET_DARK, colorTop: VIOLET });
    // Richtsitz hinten links und Zielfernrohr
    rod(turret, [-0.08, Y0 + 0.03, GZ - 0.04], [-0.16, Y0 + 0.11, GZ - 0.17], 0.02, STEEL_DARK, { seg: 4 });
    turret.box({ size: [0.1, 0.025, 0.09], base: [-0.16, Y0 + 0.11, GZ - 0.18], color: LEATHER });
    turret.box({ size: [0.03, 0.07, 0.03], base: [-0.1, GY - 0.0, GZ - 0.02], color: STEEL_DARK });
    rod(turret, [-0.1, GY + 0.08, GZ - 0.13], [-0.1, GY + 0.085, GZ + 0.12], 0.024, BRASS, { rTop: 0.03, seg: 6, colorTop: BRASS_LIGHT });

    // Sehr langes Rohr mit Verschluss und Rücklaufzylinder (gleitet beim Schuss zurück)
    const barrel = m.part('barrel', { parent: 'turret', pivot: [0, GY, GZ] });
    rod(barrel, [0, GY, -0.3], [0, GY, 0.3], 0.047, GUN, { rTop: 0.033, seg: 8, colorTop: GUN_LIGHT });
    barrel.cyl({ r: 0.062, h: 0.1, seg: 8, at: [0, GY, -0.29], rot: [HALF, 0, 0], color: GUN_DARK, colorTop: GUN });
    barrel.cyl({ r: 0.057, h: 0.15, seg: 8, at: [0, GY, -0.14], rot: [HALF, 0, 0], color: GUN_DARK, colorTop: GUN });
    barrel.cyl({ r: 0.026, h: 0.3, seg: 6, at: [0, GY - 0.058, -0.1], rot: [HALF, 0, 0], color: STEEL_DARK });
    barrel.cyl({ r: 0.041, h: 0.03, seg: 8, at: [0, GY, 0.29], rot: [HALF, 0, 0], color: GUN_DARK });
    barrel.cyl({ r: 0.048, h: 0.035, seg: 8, open: true, at: [0, GY, 0.06], rot: [HALF, 0, 0], color: VIOLET });
    // Granate, die vor dem Schuss in den Verschluss gleitet
    const shell = m.part('shell', { parent: 'barrel', pivot: [0, GY, -0.39] });
    shell.cyl({ r: 0.032, h: 0.09, seg: 6, at: [0, GY, -0.39], rot: [HALF, 0, 0], color: BRASS, colorTop: BRASS_LIGHT });

    // Stufe 2: Mündungsbremse und Ringe
    tier2(m, VIOLET);
    const rings = m.part('rings2', { parent: 'barrel', pivot: [0, GY, GZ], minLevel: 2 });
    rings.cyl({ r: 0.048, rTop: 0.044, h: 0.075, seg: 8, at: [0, GY, 0.335], rot: [HALF, 0, 0], color: GUN_DARK, colorTop: GUN });
    rings.cyl({ r: 0.041, h: 0.022, seg: 8, open: true, at: [0, GY, 0.2], rot: [HALF, 0, 0], color: VIOLET });
    rings.cyl({ r: 0.044, h: 0.022, seg: 8, open: true, at: [0, GY, 0.13], rot: [HALF, 0, 0], color: GUN_DARK });

    // Stufe 3: gepanzerte Kuppel über dem Geschützstand
    tier3(m, VIOLET);
    const cupola = m.part('cupola3', { parent: 'turret', pivot: [0, Y0, 0], minLevel: 3 });
    cupola.dome({ r: 0.21, seg: 10, rings: 3, at: [0, Y0 + 0.02, GZ - 0.05], scale: [1, 0.85, 1.12], color: VIOLET_DARK, colorTop: VIOLET_LIGHT });
    cupola.cyl({ r: 0.06, h: 0.04, seg: 8, base: [0.03, Y0 + 0.19, GZ - 0.1], color: STEEL_DARK, colorTop: STEEL });

    m.point('muzzle', [0, GY, 0.37], 'barrel');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'turret', 'barrel', 0.2);
        const f = ctx.fire;
        const c = ctx.charge;
        // Laden: die Granate erscheint hinter dem Verschluss und gleitet hinein, das Rohr senkt sich kurz zum Richten.
        const show = smooth((c - 0.45) * 8) * (1 - smooth((c - 0.9) * 12));
        pose.shell.scale.setScalar(Math.max(1e-3, show));
        pose.shell.position.z += smooth((c - 0.6) / 0.28) * 0.13;
        const settle = smooth((c - 0.8) * 6) * (1 - f);
        pose.barrel.rotation.x += settle * 0.04;
        // Langer Rücklauf: das Rohr gleitet weit zurück und kommt langsam wieder.
        pose.barrel.position.z -= smooth(f * 1.25) * 0.11;
        pose.turret.position.y -= Math.sin(f * Math.PI) * 0.01;
      },
    });
  },

  // Brenner: Gasbrenner. Drehbarer Karren mit zwei roten Gasflaschen, Manometer und Kupferbogen zur Brennerdüse,
  // die eine kleine blaue Zündflamme trägt und hinter einem roten Hitzeschild sitzt.
  'tower.industrie.brenner': () => {
    const m = createModel('tower.industrie.brenner');
    plinth(m, RED);
    const yaw = m.part('yaw', { pivot: [0, TOP, 0] });
    yaw.box({ size: [0.4, 0.04, 0.42], base: [0, TOP, -0.06], color: WOOD, colorTop: WOOD_LIGHT });
    for (const s of [-1, 1]) yaw.box({ size: [0.03, 0.05, 0.43], base: [s * 0.19, TOP, -0.06], color: IRON });
    /**
     * Gasflasche mit Messingventil.
     * @param {PartBuilder} p
     * @param {number} x
     * @param {number} z
     */
    const bottle = (p, x, z) => {
      p.lathe({ points: [[0, 0], [0.075, 0], [0.078, 0.26], [0.06, 0.32], [0.028, 0.345], [0, 0.345]], seg: 8, base: [x, TOP + 0.045, z], color: RED_DARK, colorTop: RED_LIGHT });
      p.cyl({ r: 0.081, h: 0.03, seg: 8, open: true, base: [x, TOP + 0.1, z], color: BRASS });
      p.cyl({ r: 0.022, h: 0.055, seg: 5, base: [x, TOP + 0.385, z], color: BRASS, colorTop: BRASS_LIGHT });
      p.box({ size: [0.07, 0.015, 0.02], base: [x, TOP + 0.44, z], color: BRASS_DARK });
    };
    bottle(yaw, -0.13, -0.17);
    bottle(yaw, 0.13, -0.17);
    yaw.box({ size: [0.42, 0.035, 0.03], at: [0, TOP + 0.24, -0.255], color: IRON });
    // Manometer zwischen den Flaschen
    yaw.cyl({ r: 0.05, h: 0.03, seg: 8, at: [0, TOP + 0.46, -0.16], rot: [0.9, 0, 0], color: BRASS });
    yaw.cyl({ r: 0.04, h: 0.01, seg: 8, at: [0, TOP + 0.47, -0.145], rot: [0.9, 0, 0], color: PORCELAIN });
    // Kupferbogen von den Ventilen zum Brennerkopf
    yaw.torus({ r: 0.13, tube: 0.02, seg: 8, tubeSeg: 4, arc: Math.PI, at: [0, TOP + 0.33, -0.04], rot: [0, HALF, HALF], color: COPPER, colorTop: COPPER_LIGHT });
    rod(yaw, [-0.13, TOP + 0.44, -0.17], [0.13, TOP + 0.44, -0.17], 0.018, COPPER);
    // Brennerkopf mit Düse und Hitzeschild
    const NY = TOP + 0.2;
    const NX = -0.04;
    yaw.cyl({ r: 0.05, h: NY - TOP - 0.02, seg: 7, base: [NX, TOP + 0.04, 0.07], color: IRON, colorTop: IRON_LIGHT });
    yaw.sphere({ r: 0.06, detail: 0, at: [NX, NY, 0.07], color: BRASS, colorTop: BRASS_LIGHT });
    /**
     * Brennerdüse mit Schild.
     * @param {PartBuilder} p
     * @param {number} x
     * @returns {Vec3} Mündung
     */
    const burner = (p, x) => {
      rod(p, [x, NY, 0.06], [x, NY, 0.29], 0.045, BRASS, { rTop: 0.036, seg: 7, colorTop: BRASS_LIGHT });
      rod(p, [x, NY, 0.28], [x, NY, 0.35], 0.038, COPPER, { rTop: 0.066, seg: 8 });
      p.box({ size: [0.16, 0.14, 0.022], at: [x, NY + 0.02, 0.17], rot: [-0.2, 0, 0], color: RED, colorTop: RED_LIGHT });
      return [x, NY, 0.36];
    };
    const muzzle = burner(yaw, NX);
    const pilot = m.part('pilot', { parent: 'yaw', pivot: [NX, NY + 0.04, 0.34] });
    pilot.cone({ r: 0.022, h: 0.07, seg: 5, base: [NX, NY + 0.035, 0.34], color: PILOT, colorTop: PILOT_LIGHT, glow: true });

    // Stufe 2: dritte Gasflasche links
    tier2(m, RED);
    const b2 = m.part('bottle2', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 2 });
    bottle(b2, -0.25, 0.02);
    rod(b2, [-0.25, TOP + 0.44, 0.02], [-0.13, TOP + 0.44, -0.17], 0.018, COPPER);

    // Stufe 3: zweite Düse
    tier3(m, RED);
    const n3 = m.part('nozzle3', { parent: 'yaw', pivot: [0, TOP, 0], minLevel: 3 });
    n3.cyl({ r: 0.05, h: NY - TOP, seg: 7, base: [0.1, TOP + 0.04, 0.09], color: IRON, colorTop: IRON_LIGHT });
    burner(n3, 0.1);
    n3.cone({ r: 0.02, h: 0.06, seg: 5, base: [0.1, NY + 0.035, 0.34], color: PILOT, colorTop: PILOT_LIGHT, glow: true });

    m.point('muzzle', muzzle, 'yaw');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'yaw');
        const f = ctx.fire;
        const flick = Math.sin(ctx.t * 13 + ctx.seed * 9) * 0.15 + Math.sin(ctx.t * 19.7) * 0.1;
        pose.pilot.scale.setScalar(0.9 + flick + f * 0.8);
        pose.yaw.position.z -= f * f * 0.025;
        pose.yaw.position.y += Math.sin(f * Math.PI) * 0.008;
      },
    });
  },

  // Taktgeber: Telegrafenmast. Hoher Holzmast mit Querträger und Porzellanisolatoren, oben ein goldener Klopfer,
  // am Fuß eine kleine beleuchtete Telegrafenbude mit goldenem Dach. Im Takt blinken die Isolatoren golden.
  'tower.industrie.taktgeber': () => {
    const m = createModel('tower.industrie.taktgeber');
    const base = plinth(m, GOLD);
    const MX = 0.1;
    const MZ = -0.1;
    const MT = 1.42;
    const AY = 1.26;
    base.cyl({ r: 0.085, rTop: 0.07, h: 0.08, seg: 7, base: [MX, TOP - 0.005, MZ], color: STONE, colorTop: STONE_LIGHT });
    base.cyl({ r: 0.06, rTop: 0.045, h: MT - TOP, seg: 7, base: [MX, TOP, MZ], color: WOOD, colorTop: WOOD_LIGHT });
    base.cyl({ r: 0.064, h: 0.04, seg: 7, open: true, base: [MX, TOP + 0.5, MZ], color: GOLD });
    // Querträger mit Isolatoren
    base.box({ size: [0.52, 0.05, 0.06], at: [MX, AY, MZ], color: WOOD_DARK, colorTop: WOOD });
    for (const dx of [-0.21, -0.09, 0.09, 0.21]) {
      base.cyl({ r: 0.03, rTop: 0.026, h: 0.065, seg: 6, base: [MX + dx, AY + 0.025, MZ], color: PORCELAIN });
    }
    // Telegrafenbude vorn links
    const HX = -0.17;
    const HZ = 0.1;
    base.box({ size: [0.26, 0.22, 0.22], base: [HX, TOP - 0.005, HZ], color: WOOD, colorTop: WOOD_LIGHT });
    base.roof({ size: [0.32, 0.12, 0.29], base: [HX, TOP + 0.215, HZ], rot: [0, HALF, 0], color: GOLD, colorTop: GOLD_LIGHT });
    base.box({ size: [0.11, 0.08, 0.012], at: [HX + 0.04, TOP + 0.13, HZ + 0.112], color: WINDOW, glow: true });
    base.box({ size: [0.08, 0.16, 0.012], base: [HX - 0.08, TOP, HZ + 0.112], color: DARK });
    base.box({ size: [0.04, 0.12, 0.04], base: [HX + 0.07, TOP + 0.26, HZ - 0.05], color: BRICK });

    // Goldener Klopfer auf der Mastspitze
    const sounder = m.part('sounder', { pivot: [MX, MT, MZ] });
    sounder.box({ size: [0.12, 0.03, 0.08], base: [MX, MT - 0.005, MZ], color: WOOD_DARK });
    sounder.lathe({ points: [[0, 0], [0.1, 0], [0.088, 0.035], [0.06, 0.11], [0.03, 0.155], [0, 0.165]], seg: 8, base: [MX, MT + 0.02, MZ], color: GOLD, colorTop: GOLD_LIGHT });
    sounder.sphere({ r: 0.032, detail: 0, at: [MX, MT + 0.19, MZ], color: GOLD_LIGHT });
    // Leuchtpunkte, die im Takt aus den Isolatoren springen (dazwischen stecken sie unsichtbar im Porzellan)
    const beads = m.part('beads', { pivot: [MX, AY + 0.11, MZ] });
    for (const dx of [-0.21, -0.09, 0.09, 0.21]) beads.sphere({ r: 0.024, detail: 0, at: [MX + dx, AY + 0.11, MZ], color: GOLD, colorTop: GOLD_LIGHT, glow: true });

    // Stufe 2: höherer Mast mit zweitem Querträger
    const t2 = tier2(m, GOLD);
    const A2 = MT + 0.06;
    t2.cyl({ r: 0.045, rTop: 0.038, h: 0.22, seg: 7, base: [MX, MT - 0.01, MZ], color: WOOD, colorTop: WOOD_LIGHT });
    t2.box({ size: [0.36, 0.045, 0.055], at: [MX, A2, MZ], color: WOOD_DARK, colorTop: WOOD });
    for (const dx of [-0.13, 0.13]) t2.cyl({ r: 0.024, h: 0.055, seg: 6, base: [MX + dx, A2 + 0.022, MZ], color: PORCELAIN });

    // Stufe 3: Winkerarme aus Messing
    tier3(m, GOLD);
    const SY = 1.0;
    const sema = m.part('sema3', { pivot: [MX, SY, MZ + 0.06], minLevel: 3 });
    sema.box({ size: [0.5, 0.035, 0.025], at: [MX, SY, MZ + 0.065], color: BRASS, colorTop: BRASS_LIGHT });
    for (const s of [-1, 1]) sema.box({ size: [0.1, 0.07, 0.022], at: [MX + s * 0.21, SY, MZ + 0.068], color: GOLD, colorTop: GOLD_LIGHT });
    sema.cyl({ r: 0.03, h: 0.03, seg: 6, at: [MX, SY, MZ + 0.08], rot: [HALF, 0, 0], color: BRASS_DARK });

    return m.build({
      animate(pose, ctx) {
        // Im Takt (108 BPM) nickt der Klopfer und die Isolatoren blitzen golden auf.
        const beat = ctx.t * BEAT;
        const pb = beat - Math.floor(beat);
        const hit = (1 - pb) * (1 - pb) * (1 - pb);
        const lift = ctx.level >= 2 ? 0.22 : 0;
        pose.sounder.position.y += lift;
        pose.sounder.rotation.z = Math.sin(pb * Math.PI) * 0.12 * (Math.floor(beat) % 2 === 0 ? 1 : -1);
        pose.sounder.scale.setScalar(1 + hit * 0.12);
        pose.beads.position.y -= (1 - smooth(hit * 1.6)) * 0.07;
        if (ctx.level >= 3) {
          // Die Winkerarme wippen jeden zweiten Schlag in eine neue Stellung.
          const half = beat * 0.5;
          const step = Math.floor(half) % 4;
          const ease = smooth((half - Math.floor(half)) * 4);
          const from = step === 0 ? -0.5 : step === 1 ? 0.6 : step === 2 ? -0.2 : 0.3;
          const to = step === 0 ? 0.6 : step === 1 ? -0.2 : step === 2 ? 0.3 : -0.5;
          pose.sema3.rotation.z = from + (to - from) * ease;
        }
      },
    });
  },
};

