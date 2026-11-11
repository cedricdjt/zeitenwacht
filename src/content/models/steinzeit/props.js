// @ts-check
// Steinzeit: Requisiten und die Basis (Stammeshöhle mit der Flamme).
import * as A from '../../../render/anim.js';
import { createModel, tone } from '../../../render/kit.js';

/** @import { ModelFactory, Vec3 } from '../../../types/model' */
/** @import { PartBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben der Steinzeit ---
const ROCK = '#8f8b84';
const ROCK_DARK = '#76726c';
const ROCK_LIGHT = '#a5a199';
const MOSS = '#6f9a4e';
const MOSS_LIGHT = '#8fb85c';
const WOOD = '#8a5a35';
const WOOD_LIGHT = '#b07a4c';
const WOOD_DARK = '#6b4428';
const HIDE = '#c79a66';
const HIDE_LIGHT = '#dcb682';
const FUR = '#7c4b2a';
const BONE = '#efe6d2';
const BONE_SHADE = '#d9cdb2';
const OCHRE = '#e2603a';
const OCHRE_DARK = '#b8472f';
const DARK = '#2a2420';
const LEAF = '#3f8757';
const LEAF_TOP = '#79b85a';
const FERN = '#4c9a4f';
const FERN_TOP = '#9ccf62';
const FLAME = '#ff8a2e';
const FLAME_TOP = '#ffd870';
const FLAME_CORE = '#ffc24a';
const FLAME_CORE_TOP = '#fff0b0';
const EMBER = '#ff6a2a';

const TAU = Math.PI * 2;

/**
 * Feldstein: gedrückte, kantige Kugel.
 * @param {PartBuilder} p
 * @param {Vec3} at Mittelpunkt
 * @param {number} r
 * @param {Vec3} scale
 * @param {Vec3} rot
 * @param {string} [color]
 */
function stone(p, at, r, scale, rot, color = ROCK) {
  p.sphere({ r, detail: 0, at, scale, rot, color, faceJitter: 0.09 });
}

/**
 * Feuerstelle: Steinkranz, drei gekreuzte Scheite und Glut. Die Flamme selbst kommt als eigenes Teil dazu.
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} z
 * @param {number} r Radius des Steinkranzes
 * @param {number} stones Zahl der Steine
 */
function firePit(p, x, z, r, stones) {
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * TAU + 0.3;
    const s = r * (0.3 + 0.07 * ((i * 7) % 3));
    stone(p, [x + Math.sin(a) * r, s * 0.45, z + Math.cos(a) * r], s, [1, 0.75, 1], [i, i * 2.1, 0], i % 2 ? ROCK : ROCK_LIGHT);
  }
  // Aschebett und Glut
  p.cyl({ r: r * 0.8, h: 0.02, seg: 7, base: [x, 0.004, z], color: '#4a3b32' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    p.cyl({ r: r * 0.13, h: r * 1.55, seg: 5, base: [x + Math.sin(a) * r * 0.62, 0.02, z + Math.cos(a) * r * 0.62], rot: [0, a + Math.PI / 2, -0.95], color: WOOD_DARK, colorTop: WOOD });
  }
  p.sphere({ r: r * 0.36, detail: 0, at: [x, r * 0.2, z], scale: [1, 0.55, 1], color: EMBER, glow: 1.3 });
}

/**
 * Flamme aus zwei ineinander steckenden Kegeln; der Fuß liegt bei (x, y, z).
 * @param {PartBuilder} p
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {number} h
 */
function flameShape(p, x, y, z, r, h) {
  p.cone({ r, h, seg: 6, base: [x, y, z], color: FLAME, colorTop: FLAME_TOP, glow: true });
  p.cone({ r: r * 0.58, h: h * 0.62, seg: 5, base: [x + r * 0.12, y, z + r * 0.3], color: FLAME_CORE, colorTop: FLAME_CORE_TOP, glow: 1.9 });
  p.cone({ r: r * 0.45, h: h * 0.55, seg: 5, base: [x - r * 0.55, y, z - r * 0.1], rot: [0, 0, 0.25], color: FLAME, colorTop: FLAME_TOP, glow: true });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Stammeshöhle: Felskuppel mit dunklem Eingang, Fellvorhang, Stoßzähnen und bemaltem Totempfahl.
  // Die Flamme ist das große Lagerfeuer vor dem Eingang.
  'base.steinzeit': () => {
    const m = createModel('base.steinzeit');
    const rock = m.part('rock');
    // Felskuppel
    rock.lathe({ points: [[0, 0], [0.98, 0], [0.95, 0.3], [0.8, 0.68], [0.52, 0.98], [0.2, 1.12], [0, 1.15]], seg: 9, at: [0, 0, -0.25], rot: [0, 0.2, 0], color: ROCK, faceJitter: 0.08, shade: 0.2 });
    // Moospolster auf der Kuppe
    rock.sphere({ r: 0.5, detail: 1, at: [-0.08, 0.98, -0.34], scale: [1.05, 0.4, 0.95], color: MOSS, colorTop: MOSS_LIGHT, faceJitter: 0.07 });
    rock.sphere({ r: 0.26, detail: 0, at: [0.48, 0.7, -0.52], scale: [1, 0.45, 1], rot: [0.3, 0.4, -0.5], color: MOSS, faceJitter: 0.07 });
    // Felsbrocken am Fuß
    stone(rock, [-0.86, 0.2, -0.72], 0.36, [1, 0.85, 1], [0.3, 0.5, 0.1], ROCK_DARK);
    stone(rock, [0.92, 0.17, -0.5], 0.3, [1, 0.8, 1.1], [0.1, 1.3, 0.4], ROCK_DARK);
    stone(rock, [0.2, 0.16, -1.02], 0.3, [1.2, 0.8, 1], [0.6, 0.2, 0.2], ROCK_LIGHT);
    stone(rock, [0.98, 0.1, 0.12], 0.17, [1, 0.8, 1], [1, 0.3, 0.6], ROCK_LIGHT);
    // Zweiter Buckel bricht die Symmetrie der Kuppel
    rock.sphere({ r: 0.5, detail: 0, at: [0.5, 0.42, -0.62], scale: [1, 0.95, 1], rot: [0.3, 0.8, 0.2], color: ROCK, faceJitter: 0.09 });
    // Holzstapel rechts neben dem Eingang
    for (const [y, z, c] of /** @type {[number, number, string][]} */ ([[0.06, 0.22, WOOD], [0.06, 0.34, WOOD_DARK], [0.06, 0.46, WOOD], [0.16, 0.28, WOOD_LIGHT], [0.16, 0.4, WOOD]])) {
      rock.cyl({ r: 0.06, h: 0.4, seg: 5, at: [0.98, y, z + 0.28], rot: [0, 0, Math.PI / 2], color: c });
    }
    // Aufgespanntes Fell lehnt an der Ostflanke der Kuppel
    rock.box({ size: [0.03, 0.5, 0.44], at: [0.85, 0.5, 0.06], rot: [0, -0.35, 0.37], color: HIDE, colorTop: HIDE_LIGHT });
    rock.box({ size: [0.036, 0.09, 0.34], at: [0.85, 0.5, 0.06], rot: [0, -0.35, 0.37], color: OCHRE });
    // Portal: zwei Tragsteine und ein Deckstein, dahinter das dunkle Höhleninnere
    rock.box({ size: [0.2, 0.74, 0.34], base: [-0.4, 0, 0.56], rot: [0, 0.12, 0.06], color: ROCK_LIGHT, faceJitter: 0.07 });
    rock.box({ size: [0.2, 0.7, 0.34], base: [0.4, 0, 0.56], rot: [0, -0.1, -0.05], color: ROCK_LIGHT, faceJitter: 0.07 });
    rock.box({ size: [1.14, 0.22, 0.46], at: [0, 0.83, 0.54], rot: [0, 0.03, 0.03], color: ROCK_LIGHT, faceJitter: 0.08 });
    // Moos und ein Ockerband auf dem Deckstein (von oben gut sichtbar)
    rock.sphere({ r: 0.2, detail: 0, at: [0.36, 0.94, 0.5], scale: [1.1, 0.3, 0.9], rot: [0, 0.5, 0], color: MOSS, colorTop: MOSS_LIGHT, faceJitter: 0.07 });
    rock.box({ size: [0.5, 0.02, 0.1], at: [-0.22, 0.942, 0.56], rot: [0, 0.03, 0.03], color: OCHRE });
    // Ockerfarbene Zeichen auf dem Deckstein
    for (const x of [-0.36, -0.12, 0.12, 0.36]) {
      rock.box({ size: [0.09, 0.09, 0.02], at: [x, 0.82 + x * 0.03, 0.765], rot: [0, 0, Math.PI / 4], color: OCHRE });
    }
    // Stoßzähne rahmen den Eingang
    rock.torus({ r: 0.9, tube: 0.055, seg: 6, tubeSeg: 5, arc: 0.9, at: [-0.08, 0, 0.82], rot: [-Math.PI / 2, 0, 0], color: BONE_SHADE, colorTop: BONE, mirror: true });
    // Totempfahl links vorn
    const tx = -0.98;
    const tz = 0.1;
    rock.cyl({ r: 0.11, h: 0.4, seg: 6, base: [tx, 0, tz], color: WOOD, colorTop: WOOD_LIGHT });
    rock.cyl({ r: 0.125, h: 0.24, seg: 6, base: [tx, 0.4, tz], color: OCHRE_DARK, colorTop: OCHRE });
    rock.cyl({ r: 0.11, h: 0.26, seg: 6, base: [tx, 0.64, tz], color: BONE_SHADE, colorTop: BONE });
    rock.cyl({ r: 0.125, h: 0.24, seg: 6, base: [tx, 0.9, tz], color: '#3f6f9a', colorTop: '#5b8fbd' });
    rock.box({ size: [0.62, 0.14, 0.05], at: [tx, 1.2, tz], color: OCHRE, colorTop: '#f08a55' });
    rock.cyl({ r: 0.1, h: 0.2, seg: 6, base: [tx, 1.14, tz], color: WOOD_LIGHT });
    rock.sphere({ r: 0.12, detail: 0, at: [tx, 1.44, tz + 0.01], color: BONE });
    rock.cone({ r: 0.035, h: 0.16, seg: 4, base: [tx - 0.09, 1.48, tz], rot: [0, 0, 0.6], color: BONE });
    rock.cone({ r: 0.035, h: 0.16, seg: 4, base: [tx + 0.09, 1.48, tz], rot: [0, 0, -0.6], color: BONE });
    // Augen des Totems
    rock.box({ size: [0.04, 0.04, 0.02], at: [tx + 0.04, 0.78, tz + 0.105], color: DARK, mirror: false });
    rock.box({ size: [0.04, 0.04, 0.02], at: [tx - 0.04, 0.78, tz + 0.105], color: DARK });
    // Feuerstelle vor dem Eingang
    firePit(rock, 0, 0.98, 0.25, 8);

    // Fellvorhang, halb zur Seite gerafft
    const curtain = m.part('curtain', { pivot: [-0.3, 0.74, 0.67] });
    curtain.extrude({ points: [[-0.3, 0.04], [0.02, 0.1], [0.12, 0.42], [0.16, 0.74], [-0.3, 0.74]], depth: 0.03, at: [0, 0, 0.67], color: FUR, colorTop: HIDE });
    curtain.box({ size: [0.36, 0.05, 0.035], at: [-0.09, 0.52, 0.675], rot: [0, 0, 0.12], color: OCHRE });

    // Die Flamme
    const flame = m.part('flame', { pivot: [0, 0.06, 0.98] });
    flameShape(flame, 0, 0.06, 0.98, 0.2, 0.62);

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 9.1) * 0.05 + Math.sin(ctx.t * 14.7 + 1.3) * 0.03;
        f.scale.set(s * (1 - flick * 0.6), s * (1 + flick), s * (1 - flick * 0.6));
        f.rotation.y = ctx.t * 0.9;
        f.rotation.z = Math.sin(ctx.t * 3.3) * 0.05;
        A.sway(pose, ctx, 'curtain', 0.05, 0.3, 'z');
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Urzeitbaum: kräftiger Stamm, drei gestapelte, gedrückte Laubpolster.
  'prop.steinzeit.urzeitbaum': () => {
    const m = createModel('prop.steinzeit.urzeitbaum');
    const trunk = m.part('trunk');
    trunk.cyl({ r: 0.1, rTop: 0.06, h: 0.62, seg: 6, base: [0, 0, 0], color: WOOD_DARK, colorTop: WOOD });
    trunk.cone({ r: 0.16, h: 0.14, seg: 6, base: [0, 0, 0], color: WOOD_DARK });
    const crown = m.part('crown', { pivot: [0, 0.5, 0] });
    crown.sphere({ r: 0.42, detail: 1, at: [0, 0.68, 0], scale: [1, 0.48, 1], color: LEAF, colorTop: LEAF_TOP, faceJitter: 0.07 });
    crown.sphere({ r: 0.33, detail: 1, at: [0.03, 0.96, -0.02], scale: [1, 0.5, 1], rot: [0, 0.7, 0], color: LEAF, colorTop: LEAF_TOP, faceJitter: 0.07 });
    crown.sphere({ r: 0.22, detail: 1, at: [-0.02, 1.2, 0.02], scale: [1, 0.62, 1], rot: [0, 1.9, 0], color: tone(LEAF, 0.08), colorTop: '#8cc763', faceJitter: 0.07 });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.03, 0.22);
        A.sway(pose, ctx, 'crown', 0.02, 0.17, 'x');
      },
    });
  },

  // Farnbusch: aufgefächerte, flache Wedel.
  'prop.steinzeit.farnbusch': () => {
    const m = createModel('prop.steinzeit.farnbusch');
    const p = m.part('fern', { pivot: [0, 0, 0] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      const tilt = i % 2 ? 0.95 : 0.7;
      const len = i % 2 ? 0.4 : 0.48;
      p.cone({ r: 0.1, h: len, seg: 4, base: [Math.sin(a) * 0.03, 0, Math.cos(a) * 0.03], rot: [0, a - Math.PI / 2, -tilt], scale: [0.35, 1, 1], color: FERN, colorTop: FERN_TOP, faceJitter: 0.06 });
    }
    p.cone({ r: 0.07, h: 0.34, seg: 4, base: [0, 0, 0], color: FERN, colorTop: FERN_TOP });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'fern', 0.04, 0.3);
      },
    });
  },

  // Findling: gedrückter grauer Stein mit Mooskappe.
  'prop.steinzeit.findling': () => {
    const m = createModel('prop.steinzeit.findling');
    const p = m.part('rock');
    p.sphere({ r: 0.32, detail: 1, at: [0, 0.16, 0], scale: [1.15, 0.72, 0.95], rot: [0.15, 0.4, 0.1], color: ROCK, faceJitter: 0.1, shade: 0.22 });
    p.sphere({ r: 0.25, detail: 0, at: [-0.03, 0.32, 0], scale: [1.05, 0.36, 0.9], rot: [0.1, 0.9, 0.05], color: MOSS, colorTop: MOSS_LIGHT, faceJitter: 0.07 });
    stone(p, [0.3, 0.08, 0.17], 0.14, [1, 0.8, 1], [0.5, 1.1, 0.2], ROCK_DARK);
    return m.build();
  },

  // Fellzelt: Kegel mit braunen Streifen, oben ragen die Stangen heraus.
  'prop.steinzeit.fellzelt': () => {
    const m = createModel('prop.steinzeit.fellzelt');
    const p = m.part('tent');
    const turn = Math.PI / 7;
    p.cone({ r: 0.44, h: 0.78, seg: 7, base: [0, 0, 0], rot: [0, turn, 0], color: HIDE, colorTop: HIDE_LIGHT, faceJitter: 0.05 });
    // Streifen: zwei Bänder knapp über der Zeltwand
    p.cyl({ r: 0.375, rTop: 0.315, h: 0.11, seg: 7, open: true, base: [0, 0.14, 0], rot: [0, turn, 0], color: FUR });
    p.cyl({ r: 0.215, rTop: 0.16, h: 0.1, seg: 7, open: true, base: [0, 0.42, 0], rot: [0, turn, 0], color: OCHRE_DARK });
    // Stangen
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      p.cyl({ r: 0.02, h: 0.34, seg: 4, at: [0, 0.82, 0], rot: [0, a, 0.42], color: WOOD_DARK });
    }
    // Eingang
    p.extrude({ points: [[-0.13, 0], [0.13, 0], [0, 0.4]], depth: 0.02, base: [0, 0, 0.405], rot: [-0.5, 0, 0], color: DARK, shade: 0 });
    return m.build();
  },

  // Mammutrippen: vier elfenbeinfarbene Bögen in einer Reihe.
  'prop.steinzeit.mammutrippen': () => {
    const m = createModel('prop.steinzeit.mammutrippen');
    const p = m.part('ribs');
    const radii = [0.27, 0.34, 0.33, 0.25];
    for (let i = 0; i < 4; i++) {
      const z = -0.33 + i * 0.22;
      p.torus({ r: radii[i], tube: 0.04, seg: 7, tubeSeg: 5, arc: Math.PI, at: [0, 0, z], rot: [-Math.PI / 2 + (i - 1.5) * 0.08, 0, 0], color: BONE_SHADE, colorTop: BONE });
    }
    // Rückgrat
    p.cyl({ r: 0.045, h: 0.84, seg: 5, at: [0, 0.31, 0], rot: [Math.PI / 2, 0, 0], color: BONE });
    return m.build();
  },

  // Höhlenmalerei-Fels: aufrechte Platte mit ockerfarbenen Strichfiguren.
  'prop.steinzeit.malfels': () => {
    const m = createModel('prop.steinzeit.malfels');
    const p = m.part('slab');
    p.extrude({ points: [[-0.4, 0], [0.42, 0], [0.47, 0.45], [0.3, 0.82], [-0.1, 0.9], [-0.43, 0.6]], depth: 0.22, at: [0, 0, 0], color: ROCK_LIGHT, faceJitter: 0.06, shade: 0.2 });
    /**
     * Pinselstrich auf Vorder- und Rückseite der Platte.
     * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} [turn] @param {string} [color]
     */
    const paint = (x, y, w, h, turn = 0, color = OCHRE) => {
      p.box({ size: [w, h, 0.02], at: [x, y, 0.113], rot: [0, 0, turn], color, shade: 0 });
      p.box({ size: [w, h, 0.02], at: [-x, y, -0.113], rot: [0, 0, -turn], color, shade: 0 });
    };
    // Jäger mit Speer
    paint(-0.2, 0.44, 0.045, 0.2);
    paint(-0.2, 0.6, 0.085, 0.085);
    paint(-0.245, 0.28, 0.04, 0.15, -0.35);
    paint(-0.155, 0.28, 0.04, 0.15, 0.35);
    paint(-0.13, 0.5, 0.04, 0.16, -1.1);
    paint(-0.06, 0.5, 0.035, 0.34, -0.25, OCHRE_DARK);
    // Tier mit Horn
    paint(0.2, 0.36, 0.27, 0.13);
    paint(0.11, 0.25, 0.04, 0.11);
    paint(0.29, 0.25, 0.04, 0.11);
    paint(0.36, 0.42, 0.1, 0.1);
    paint(0.39, 0.5, 0.035, 0.1, -0.5);
    // Sonne
    paint(0.14, 0.66, 0.1, 0.1, Math.PI / 4, OCHRE_DARK);
    stone(p, [-0.36, 0.1, 0.05], 0.18, [1, 0.8, 1], [0.4, 0.3, 0.2], ROCK_DARK);
    stone(p, [0.38, 0.08, -0.06], 0.14, [1, 0.8, 1], [0.9, 1.3, 0.2], ROCK);
    return m.build();
  },

  // Lagerfeuer: Steinkranz, gekreuzte Scheite, kleine Flamme.
  'prop.steinzeit.lagerfeuer': () => {
    const m = createModel('prop.steinzeit.lagerfeuer');
    firePit(m.part('pit'), 0, 0, 0.2, 7);
    flameShape(m.part('flame', { pivot: [0, 0.05, 0] }), 0, 0.05, 0, 0.13, 0.4);
    return m.build({
      animate(pose, ctx) {
        const flick = Math.sin((ctx.t + ctx.seed * 5) * 9.1) * 0.06 + Math.sin(ctx.t * 14.7 + ctx.seed * 9) * 0.04;
        pose.flame.scale.set(1 - flick * 0.6, 1 + flick, 1 - flick * 0.6);
        pose.flame.rotation.y = ctx.t * 0.9 + ctx.seed * 6;
      },
    });
  },

  // Trockengestell: zwei Astgabeln, eine Querstange, drei Fische.
  'prop.steinzeit.trockengestell': () => {
    const m = createModel('prop.steinzeit.trockengestell');
    const p = m.part('rack');
    for (const x of [-0.36, 0.36]) {
      p.cyl({ r: 0.035, h: 0.5, seg: 5, base: [x, 0, 0], color: WOOD_DARK, colorTop: WOOD });
      p.cyl({ r: 0.028, h: 0.16, seg: 4, base: [x, 0.48, 0], rot: [0.55, 0, 0], color: WOOD });
      p.cyl({ r: 0.028, h: 0.16, seg: 4, base: [x, 0.48, 0], rot: [-0.55, 0, 0], color: WOOD });
    }
    p.cyl({ r: 0.028, h: 0.9, seg: 5, at: [0, 0.53, 0], rot: [0, 0, Math.PI / 2], color: WOOD_LIGHT });
    const fish = m.part('fish', { pivot: [0, 0.53, 0] });
    const colors = ['#9cc3d6', '#e08f62', '#b5d0dc'];
    for (let i = 0; i < 3; i++) {
      const x = -0.2 + i * 0.2;
      // Fisch hängt am Schwanz: Körper als Raute, Schwanzflosse oben
      fish.extrude({ points: [[0, 0], [0.085, 0.13], [0.03, 0.3], [0.09, 0.4], [0, 0.36], [-0.09, 0.4], [-0.03, 0.3], [-0.085, 0.13]], depth: 0.04, at: [x, 0.12, 0], color: colors[i], colorTop: tone(colors[i], 0.25) });
    }
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'fish', 0.12, 0.35, 'x');
      },
    });
  },

  // Sperrfeld: wuchtige Felsgruppe, die ein ganzes Feld füllt.
  'prop.steinzeit.block': () => {
    const m = createModel('prop.steinzeit.block');
    const p = m.part('rocks');
    p.sphere({ r: 0.44, detail: 0, at: [-0.05, 0.3, -0.06], scale: [1.05, 0.88, 1], rot: [0.2, 0.5, 0.1], color: ROCK, faceJitter: 0.1, shade: 0.22 });
    stone(p, [0.26, 0.17, 0.2], 0.27, [1, 0.9, 1], [0.4, 1.0, 0.2], ROCK_DARK);
    stone(p, [-0.3, 0.13, 0.25], 0.2, [1, 0.85, 1], [0.9, 0.2, 0.5], ROCK_LIGHT);
    stone(p, [0.25, 0.12, -0.28], 0.2, [1.1, 0.8, 1], [0.2, 2.0, 0.3], ROCK_LIGHT);
    p.sphere({ r: 0.3, detail: 0, at: [-0.06, 0.62, -0.06], scale: [1, 0.36, 0.95], rot: [0.1, 0.4, 0.05], color: MOSS, colorTop: MOSS_LIGHT, faceJitter: 0.07 });
    return m.build();
  },

  // Bodendeko 1: Grasbüschel.
  'prop.steinzeit.deko1': () => {
    const m = createModel('prop.steinzeit.deko1');
    const p = m.part('grass');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      p.cone({ r: 0.035, h: 0.13 + (i % 2) * 0.04, seg: 3, base: [Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04], rot: [0, a - Math.PI / 2, -0.35], color: '#5f9a4c', colorTop: '#a5d268' });
    }
    return m.build();
  },

  // Bodendeko 2: flache Kiesel mit einem kleinen Pilz.
  'prop.steinzeit.deko2': () => {
    const m = createModel('prop.steinzeit.deko2');
    const p = m.part('pebbles');
    stone(p, [-0.06, 0.02, 0.03], 0.07, [1.1, 0.4, 0.9], [0, 0.4, 0], ROCK_LIGHT);
    stone(p, [0.07, 0.015, -0.04], 0.05, [1, 0.4, 1.1], [0, 1.2, 0], ROCK);
    p.cyl({ r: 0.018, h: 0.06, seg: 4, base: [0.05, 0, 0.07], color: BONE });
    p.cone({ r: 0.045, h: 0.04, seg: 5, base: [0.05, 0.055, 0.07], color: OCHRE });
    return m.build();
  },
};
