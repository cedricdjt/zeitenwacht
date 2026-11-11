// @ts-check
// Industriezeitalter (um 1880): Requisiten und die Basis (Uhrturm-Kraftwerk mit der Flamme hinter dem Rundfenster).
// Abenddämmerung: roter Backstein, Messing, Kupfer, grünes Emaille, weißer Dampf und erleuchtete Fenster.
// Bewusst warm und freundlich, nicht grau: helle Steinbänder, leuchtende Fenster, grüne Türen.
import { createModel } from '../../../render/kit.js';

/** @import { ModelFactory, Pose, Vec3 } from '../../../types/model' */
/** @import { PartBuilder, ModelBuilder } from '../../../render/kit.js' */

// --- Gemeinsame Farben des Industriezeitalters ---
const BRICK = '#b0533a';
const BRICK_LIGHT = '#cf7352';
const BRICK_DARK = '#8c3f2e';
const CREAM = '#e6d4b4';
const CREAM_LIGHT = '#f6ead2';
const SLATE = '#5a5670';
const SLATE_LIGHT = '#857e9e';
const GREEN = '#2f6b5e';
const GREEN_LIGHT = '#4d9784';
const BRASS = '#d4a03e';
const BRASS_LIGHT = '#f2d06e';
const COPPER = '#c87533';
const COPPER_LIGHT = '#e8a066';
const IRON = '#3e3a44';
const IRON_LIGHT = '#69626f';
const COAL = '#34353c';
const COAL_LIGHT = '#6c7180';
const WOOD = '#8a5e3c';
const WOOD_LIGHT = '#b38254';
const COBBLE = '#9a929d';
const COBBLE_LIGHT = '#c4bcc6';
const OXIDE = '#a4472f';
const OXIDE_LIGHT = '#c9664a';
const STEAM = '#e6dfdc';
const STEAM_TOP = '#fbf7f2';
const OPENING = '#2e2730';
const WINDOW = '#ffc86a';
const WINDOW_TOP = '#ffe6a6';
const DIAL = '#fff1d0';
const FIRE = '#ff6a1c';
const FIRE_TOP = '#ffb43c';
const FIRE_CORE = '#ffd25a';
const FIRE_CORE_TOP = '#fff2b8';
const WEED = '#6f8a4a';
const WEED_TOP = '#a8c46a';

const TAU = Math.PI * 2;

/**
 * Bogenfenster als flacher Umriss (Rechteck mit Halbkreis oben), Fuß bei y = 0, Mitte bei x = 0.
 * @param {number} w Breite
 * @param {number} h Höhe bis zum Bogenansatz
 * @param {number} [seg] Stücke des Bogens
 * @returns {[number, number][]}
 */
function archOutline(w, h, seg = 5) {
  const r = w / 2;
  /** @type {[number, number][]} */
  const pts = [[-r, 0], [r, 0], [r, h]];
  for (let i = 1; i < seg; i++) {
    const a = (i / seg) * Math.PI;
    pts.push([Math.cos(a) * r, h + Math.sin(a) * r]);
  }
  pts.push([-r, h]);
  return pts;
}

/**
 * Leuchtendes Bogenfenster mit hellem Steinrahmen auf einer Wand. `ry` dreht die Fensterfläche (0 = Wand mit Normale +Z).
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z Mitte der Unterkante auf der Wandfläche
 * @param {number} w @param {number} h
 * @param {number} ry
 * @param {boolean} [lit]
 * @param {number} [seg] Stücke des Bogens (3 für kleine Requisiten)
 */
function archWindow(p, x, y, z, w, h, ry, lit = true, seg = 5) {
  const dx = Math.sin(ry);
  const dz = Math.cos(ry);
  p.extrude({ points: archOutline(w + 0.05, h, seg), depth: 0.016, at: [x + dx * 0.004, y - 0.025, z + dz * 0.004], rot: [0, ry, 0], color: CREAM, shade: 0 });
  if (lit) p.extrude({ points: archOutline(w, h, seg), depth: 0.016, at: [x + dx * 0.012, y, z + dz * 0.012], rot: [0, ry, 0], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.15 });
  else p.extrude({ points: archOutline(w, h, seg), depth: 0.016, at: [x + dx * 0.012, y, z + dz * 0.012], rot: [0, ry, 0], color: OPENING, shade: 0 });
}

/**
 * Rechteckiges Fenster mit hellem Sturz und Sims. `ry` wie bei archWindow.
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z Mitte der Unterkante auf der Wandfläche
 * @param {number} w @param {number} h
 * @param {number} ry
 * @param {boolean} [lit]
 */
function rectWindow(p, x, y, z, w, h, ry, lit = true) {
  const dx = Math.sin(ry);
  const dz = Math.cos(ry);
  if (lit) p.box({ size: [w, h, 0.016], base: [x + dx * 0.006, y, z + dz * 0.006], rot: [0, ry, 0], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.15 });
  else p.box({ size: [w, h, 0.016], base: [x + dx * 0.006, y, z + dz * 0.006], rot: [0, ry, 0], color: '#47465e', colorTop: '#6a6886', shade: 0 });
  p.box({ size: [w + 0.04, 0.025, 0.04], base: [x + dx * 0.012, y - 0.025, z + dz * 0.012], rot: [0, ry, 0], color: CREAM_LIGHT, shade: 0 });
  p.box({ size: [w + 0.03, 0.025, 0.026], base: [x + dx * 0.006, y + h, z + dz * 0.006], rot: [0, ry, 0], color: CREAM, shade: 0 });
}

/**
 * Rauch- oder Dampfwölkchen als eigenes Teil (Drehpunkt = Mitte der Wolke); bewegt wird es mit animPuff.
 * @param {ModelBuilder} m
 * @param {string} name
 * @param {Vec3} at
 * @param {number} r
 */
function puff(m, name, at, r) {
  m.part(name, { pivot: at }).sphere({ r, detail: 1, at, scale: [1, 0.85, 1], color: STEAM, colorTop: STEAM_TOP });
}

/**
 * Lässt ein Wölkchen aufsteigen, wachsen und oben vergehen; danach beginnt es unten klein von vorn (nahtlose Schleife).
 * @param {Pose} pose
 * @param {string} name
 * @param {number} phase beliebige laufende Zahl; nur der Nachkommaanteil zählt
 * @param {number} rise Steighöhe
 * @param {number} drift Abdrift in +X
 */
function animPuff(pose, name, phase, rise, drift) {
  const p = pose[name];
  if (!p) return;
  const f = phase - Math.floor(phase);
  p.position.y += f * rise;
  p.position.x += f * drift;
  p.position.z -= f * drift * 0.4;
  const s = Math.sin(Math.PI * Math.min(1, f * 1.15)) * (0.55 + f * 0.75);
  p.scale.setScalar(Math.max(1e-3, s));
}

/**
 * Schornsteinschaft: rund, verjüngt, Backstein mit hellen Ringen und dunklem Kopf.
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z Fuß
 * @param {number} r0 @param {number} r1 Radius unten bzw. oben
 * @param {number} h
 * @param {number} rings Anzahl der weißen Ringe
 * @returns {number} Höhe der Oberkante
 */
function chimneyShaft(p, x, y, z, r0, r1, h, rings) {
  p.cyl({ r: r0, rTop: r1, h, seg: 8, base: [x, y, z], color: BRICK_DARK, colorTop: BRICK_LIGHT });
  for (let i = 0; i < rings; i++) {
    const t = 0.55 + (i / Math.max(1, rings)) * 0.38;
    const rr = r0 + (r1 - r0) * t + 0.008;
    p.cyl({ r: rr, h: h * 0.045, seg: 8, base: [x, y + h * t, z], color: CREAM_LIGHT, shade: 0 });
  }
  p.cyl({ r: r1 + 0.02, rTop: r1 + 0.035, h: h * 0.05, seg: 8, base: [x, y + h, z], color: BRICK_DARK, colorTop: CREAM });
  return y + h * 1.05;
}

/**
 * Speichenrad, Achse entlang Z.
 * @param {PartBuilder} p
 * @param {number} x @param {number} y @param {number} z Radmitte
 * @param {number} r
 */
function wheel(p, x, y, z, r) {
  p.cyl({ r, h: 0.035, seg: 7, at: [x, y, z], rot: [Math.PI / 2, 0, 0], color: IRON_LIGHT, shade: 0 });
}

/** @type {Record<string, ModelFactory>} */
export const models = {
  // ------------------------------------------------------------------------------------------------ Basis
  // Uhrturm-Kraftwerk: Backsteinhalle mit leuchtenden Bogenfenstern und Laternenaufsatz, vorn links der Uhrturm
  // mit erleuchteten Zifferblättern und dem Eingang (+Z), hinten links der rauchende Schornstein. Die Flamme ist
  // die Feuerglut hinter dem großen Rundfenster im rechten Giebel (+X), der Spielkamera von hinten rechts zugewandt.
  'base.industrie': () => {
    const m = createModel('base.industrie');
    const c = m.part('works');
    const y0 = 0.07;
    // Gepflasterter Hof mit Backsteinkante
    c.box({ size: [2.24, y0 - 0.02, 2.2], base: [0, 0, 0], color: BRICK_DARK, colorTop: BRICK });
    c.box({ size: [2.12, 0.03, 2.08], base: [0, y0 - 0.03, 0], color: COBBLE, colorTop: COBBLE_LIGHT });

    // Kesselhalle (First entlang X), die rechte Stirnseite (+X) zeigt das Rundfenster mit der Flamme.
    const hx = 0.14;
    const hz = -0.16;
    const HW = 1.14;
    const HD = 0.9;
    const HH = 0.62;
    c.box({ size: [HW + 0.04, 0.08, HD + 0.04], base: [hx, y0, hz], color: CREAM, colorTop: CREAM_LIGHT });
    c.box({ size: [HW, HH, HD], base: [hx, y0, hz], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    c.box({ size: [HW + 0.05, 0.05, HD + 0.05], base: [hx, y0 + HH - 0.02, hz], color: CREAM_LIGHT, shade: 0 });
    const ry0 = y0 + HH + 0.03;
    const RH = 0.44;
    c.roof({ size: [HW + 0.06, RH, HD + 0.14], base: [hx, ry0, hz], color: SLATE, colorTop: SLATE_LIGHT });
    // Backsteingiebel an beiden Stirnseiten, knapp unter der Dachfläche
    for (const s of [1, -1]) {
      const gx = hx + s * (HW / 2 + 0.02);
      const k = RH / ((HD + 0.14) / 2);
      c.extrude({ points: [[-HD / 2, 0], [HD / 2, 0], [HD / 2, 0.07 * k], [0, RH - 0.04], [-HD / 2, 0.07 * k]], depth: 0.05, at: [gx, ry0 - 0.005, hz], rot: [0, Math.PI / 2, 0], color: BRICK, colorTop: BRICK_LIGHT });
    }
    // Laternenaufsatz auf dem First: Fensterband unter grünem Dach
    c.box({ size: [0.66, 0.2, 0.22], base: [hx - 0.08, ry0 + RH - 0.1, hz], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.1 });
    for (let i = 0; i < 4; i++) c.box({ size: [0.035, 0.2, 0.23], base: [hx - 0.33 + i * 0.167, ry0 + RH - 0.1, hz], color: GREEN });
    c.roof({ size: [0.72, 0.12, 0.28], base: [hx - 0.08, ry0 + RH + 0.1, hz], color: GREEN, colorTop: GREEN_LIGHT });
    // Bogenfenster an den Längsseiten
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        archWindow(c, hx - 0.36 + i * 0.36, y0 + 0.13, hz + s * HD / 2, 0.16, 0.24, s > 0 ? 0 : Math.PI, true, 3);
      }
    }
    // Rundfenster im rechten Giebel: Steinkranz, dunkle Öffnung, Messingring und -kreuz; die Glut dahinter ist die Flamme.
    const wx = hx + HW / 2 + 0.07;
    const wy = y0 + HH + 0.06;
    const wz = hz;
    const WR = 0.33;
    c.cyl({ r: WR + 0.06, h: 0.03, seg: 12, at: [wx, wy, wz], rot: [0, 0, Math.PI / 2], color: CREAM, colorTop: CREAM_LIGHT });
    c.cyl({ r: WR, h: 0.04, seg: 12, at: [wx + 0.004, wy, wz], rot: [0, 0, Math.PI / 2], color: OPENING, shade: 0 });
    c.torus({ r: WR, tube: 0.034, seg: 12, tubeSeg: 4, at: [wx + 0.045, wy, wz], rot: [0, 0, Math.PI / 2], color: BRASS, colorTop: BRASS_LIGHT });
    for (let i = 0; i < 2; i++) {
      c.box({ size: [0.02, WR * 2, 0.02], at: [wx + 0.055, wy, wz], rot: [(i / 2) * Math.PI, 0, 0], color: BRASS, shade: 0 });
    }
    // Ofentür unter dem Rundfenster
    c.box({ size: [0.03, 0.2, 0.26], base: [hx + HW / 2 + 0.01, y0 + 0.02, wz], color: IRON, colorTop: IRON_LIGHT });

    // Kesselhaus-Anbau links mit Pultdach und Kupferrohr in die Halle
    c.box({ size: [0.34, 0.42, 0.5], base: [-0.6, y0, -0.32], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    c.wedge({ size: [0.4, 0.14, 0.4], base: [-0.62, y0 + 0.42, -0.32], rot: [0, -Math.PI / 2, 0], scale: [1.4, 1, 1], color: SLATE, colorTop: SLATE_LIGHT });
    rectWindow(c, -0.6, y0 + 0.16, -0.32 - 0.25, 0.12, 0.14, Math.PI);
    c.cyl({ r: 0.035, h: 0.24, seg: 6, at: [-0.4, y0 + 0.52, -0.6], rot: [0, 0, Math.PI / 2], color: COPPER, colorTop: COPPER_LIGHT });

    // Schornstein hinten links mit quadratischem Sockel
    const cx = -0.72;
    const cz = -0.76;
    c.box({ size: [0.34, 0.3, 0.34], base: [cx, y0, cz], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    c.box({ size: [0.38, 0.05, 0.38], base: [cx, y0 + 0.3, cz], color: CREAM_LIGHT, shade: 0 });
    const ctop = chimneyShaft(c, cx, y0 + 0.35, cz, 0.135, 0.09, 1.8, 2);

    // Uhrturm vorn links mit Eingang
    const tx = -0.6;
    const tz = 0.5;
    const TW = 0.46;
    const TH = 1.5;
    c.box({ size: [TW + 0.06, 0.12, TW + 0.06], base: [tx, y0, tz], color: CREAM, colorTop: CREAM_LIGHT });
    c.box({ size: [TW, TH, TW], base: [tx, y0, tz], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    c.box({ size: [TW + 0.04, 0.05, TW + 0.04], base: [tx, y0 + 0.78, tz], color: CREAM_LIGHT, shade: 0 });
    // Uhrgeschoss mit erleuchteten Zifferblättern auf allen vier Seiten
    const cy0 = y0 + TH;
    c.box({ size: [TW + 0.08, 0.04, TW + 0.08], base: [tx, cy0 - 0.02, tz], color: CREAM_LIGHT, shade: 0 });
    c.box({ size: [TW + 0.04, 0.4, TW + 0.04], base: [tx, cy0, tz], color: CREAM, colorTop: CREAM_LIGHT });
    c.box({ size: [TW + 0.1, 0.05, TW + 0.1], base: [tx, cy0 + 0.4, tz], color: CREAM_LIGHT, shade: 0 });
    const dy = cy0 + 0.2;
    const dr = 0.16;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      const nx = Math.sin(a);
      const nz = Math.cos(a);
      const fx = tx + nx * (TW / 2 + 0.02);
      const fz = tz + nz * (TW / 2 + 0.02);
      c.cyl({ r: dr + 0.03, h: 0.014, seg: 10, at: [fx + nx * 0.004, dy, fz + nz * 0.004], rot: [Math.PI / 2, 0, -a], color: BRASS, colorTop: BRASS_LIGHT });
      c.cyl({ r: dr, h: 0.014, seg: 10, at: [fx + nx * 0.012, dy, fz + nz * 0.012], rot: [Math.PI / 2, 0, -a], color: DIAL, glow: 1.05 });
      // Zeiger: zehn nach acht
      c.box({ size: [0.026, 0.11, 0.012], at: [fx + nx * 0.024 - nz * 0.03, dy + 0.02, fz + nz * 0.024 + nx * 0.03], rot: [0, a, 1.05], color: IRON, shade: 0 });
      c.box({ size: [0.022, 0.15, 0.012], at: [fx + nx * 0.027 + nz * 0.05, dy + 0.03, fz + nz * 0.027 - nx * 0.05], rot: [0, a, -1.05], color: IRON, shade: 0 });
    }
    // Turmdach: grünes Emaille-Zeltdach mit Messingspitze
    const ry1 = cy0 + 0.45;
    c.pyramid({ size: [TW + 0.14, 0.5, TW + 0.14], base: [tx, ry1, tz], color: GREEN, colorTop: GREEN_LIGHT });
    c.cyl({ r: 0.018, h: 0.22, seg: 5, base: [tx, ry1 + 0.46, tz], color: BRASS });
    c.sphere({ r: 0.045, detail: 0, at: [tx, ry1 + 0.56, tz], color: BRASS_LIGHT });
    // Eingang vorn: Bogen mit grüner Tür, darüber und ringsum erleuchtete Fenster
    archWindow(c, tx, y0 + 0.02, tz + TW / 2, 0.2, 0.2, 0, false, 3);
    c.box({ size: [0.17, 0.22, 0.02], base: [tx, y0 + 0.02, tz + TW / 2 + 0.018], color: GREEN, colorTop: GREEN_LIGHT });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      rectWindow(c, tx + Math.sin(a) * TW / 2, y0 + 0.95, tz + Math.cos(a) * TW / 2, 0.12, 0.26, a);
    }

    // Hof hinten rechts: Kohlenhaufen und Lore
    c.cone({ r: 0.24, h: 0.2, seg: 7, base: [0.62, y0, -0.86], scale: [1.25, 1, 1], color: COAL, colorTop: COAL_LIGHT, faceJitter: 0.16 });
    c.cone({ r: 0.14, h: 0.13, seg: 6, base: [0.92, y0, -0.72], color: COAL, colorTop: COAL_LIGHT, faceJitter: 0.16 });
    c.box({ size: [0.26, 0.12, 0.18], base: [0.3, y0 + 0.06, -0.86], color: GREEN, colorTop: GREEN_LIGHT });
    c.box({ size: [0.2, 0.04, 0.12], base: [0.3, y0 + 0.165, -0.86], color: COAL, colorTop: COAL_LIGHT });
    for (const x of [0.22, 0.38]) c.cyl({ r: 0.045, h: 0.2, seg: 6, at: [x, y0 + 0.05, -0.86], rot: [Math.PI / 2, 0, 0], color: IRON, colorTop: IRON_LIGHT });
    // Gaslaterne vorn rechts
    const lx = 0.95;
    const lz = 0.85;
    c.cyl({ r: 0.05, h: 0.08, seg: 6, base: [lx, y0, lz], color: GREEN });
    c.cyl({ r: 0.026, h: 0.66, seg: 5, base: [lx, y0, lz], color: GREEN, colorTop: GREEN_LIGHT });
    c.cyl({ r: 0.055, rTop: 0.085, h: 0.14, seg: 4, base: [lx, y0 + 0.66, lz], rot: [0, Math.PI / 4, 0], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.3 });
    c.pyramid({ size: [0.17, 0.08, 0.17], base: [lx, y0 + 0.8, lz], color: GREEN, colorTop: GREEN_LIGHT });

    // Dampfmaschine vorn rechts: Bett, grüner Zylinder mit Messingkappe, großes Schwungrad (dreht sich)
    const ex = 0.42;
    const ez = 0.62;
    c.box({ size: [0.5, 0.08, 0.3], base: [ex, y0, ez], color: CREAM, colorTop: CREAM_LIGHT });
    c.cyl({ r: 0.08, h: 0.24, seg: 7, at: [ex - 0.06, y0 + 0.17, ez], rot: [0, 0, Math.PI / 2], color: GREEN, colorTop: GREEN_LIGHT });
    c.cyl({ r: 0.09, h: 0.03, seg: 7, at: [ex - 0.18, y0 + 0.17, ez], rot: [0, 0, Math.PI / 2], color: BRASS, colorTop: BRASS_LIGHT });
    c.cyl({ r: 0.035, h: 0.1, seg: 5, base: [ex - 0.06, y0 + 0.24, ez], color: BRASS_LIGHT });
    c.box({ size: [0.05, 0.24, 0.05], base: [ex + 0.14, y0 + 0.08, ez - 0.07], color: IRON });
    const fwy = y0 + 0.3;
    const fwx = ex + 0.14;
    const fly = m.part('flywheel', { pivot: [fwx, fwy, ez] });
    fly.torus({ r: 0.24, tube: 0.035, seg: 10, tubeSeg: 4, at: [fwx, fwy, ez], rot: [Math.PI / 2, 0, 0], color: OXIDE, colorTop: OXIDE_LIGHT });
    for (let i = 0; i < 3; i++) fly.box({ size: [0.03, 0.46, 0.025], at: [fwx, fwy, ez], rot: [0, 0, (i / 3) * Math.PI], color: OXIDE });
    fly.cyl({ r: 0.05, h: 0.07, seg: 6, at: [fwx, fwy, ez], rot: [Math.PI / 2, 0, 0], color: BRASS, colorTop: BRASS_LIGHT });

    // Die Flamme: Feuerglut hinter dem Rundfenster, helle Flammenzungen davor
    const flame = m.part('flame', { pivot: [wx, wy, wz] });
    flame.cyl({ r: WR - 0.015, h: 0.02, seg: 12, at: [wx + 0.022, wy, wz], rot: [0, 0, Math.PI / 2], color: FIRE, colorTop: FIRE_TOP, glow: 1.2 });
    /** @type {[number, number][]} */
    const tongues = [[-0.24, -0.22], [0.24, -0.22], [0.23, 0.0], [0.13, 0.1], [0.08, 0.3], [0.0, 0.11], [-0.07, 0.24], [-0.13, 0.04], [-0.23, 0.12]];
    flame.extrude({ points: tongues, depth: 0.012, at: [wx + 0.036, wy, wz], rot: [0, Math.PI / 2, 0], color: FIRE_CORE, colorTop: FIRE_CORE_TOP, glow: 1.4 });

    // Rauch aus dem Schornstein
    for (const name of ['smoke1', 'smoke2', 'smoke3']) puff(m, name, [cx, ctop + 0.12, cz], 0.18);

    return m.build({
      animate(pose, ctx) {
        const f = pose.flame;
        const s = 0.45 + 0.55 * ctx.hp;
        const flick = Math.sin(ctx.t * 8.3) * 0.04 + Math.sin(ctx.t * 13.1 + 1.7) * 0.03;
        f.scale.set(s, s * (1 + flick), s * (1 - flick * 0.5));
        pose.flywheel.rotation.z = -ctx.t * 1.6;
        const r = ctx.t * 0.28;
        animPuff(pose, 'smoke1', r, 0.7, 0.3);
        animPuff(pose, 'smoke2', r + 0.333, 0.7, 0.3);
        animPuff(pose, 'smoke3', r + 0.667, 0.7, 0.3);
      },
    });
  },

  // ------------------------------------------------------------------------------------------------ Requisiten
  // Reihenhaus: schmales Backsteinhaus, First entlang X, damit Reihen nahtlos aneinanderschließen.
  // Grüne Haustür mit leuchtendem Oberlicht, erleuchtete Fenster vorn und hinten, Kaminkopf auf dem First.
  'prop.industrie.reihenhaus': () => {
    const m = createModel('prop.industrie.reihenhaus');
    const p = m.part('house');
    const W = 0.46;
    const D = 0.54;
    const H = 0.6;
    p.box({ size: [W, 0.06, D + 0.02], base: [0, 0, 0], color: CREAM, colorTop: CREAM_LIGHT });
    p.box({ size: [W, H, D], base: [0, 0.04, 0], color: BRICK, colorTop: BRICK_LIGHT });
    p.box({ size: [W + 0.004, 0.03, D + 0.03], base: [0, 0.34, 0], color: CREAM_LIGHT, shade: 0 });
    p.roof({ size: [W + 0.004, 0.28, D + 0.12], base: [0, H + 0.04, 0], color: SLATE, colorTop: SLATE_LIGHT });
    // Kaminkopf mit zwei Tonrohren
    p.box({ size: [0.12, 0.2, 0.14], base: [0.14, H + 0.2, 0], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    p.box({ size: [0.15, 0.03, 0.17], base: [0.14, H + 0.4, 0], color: CREAM_LIGHT, shade: 0 });
    for (const z of [-0.03, 0.03]) p.cyl({ r: 0.022, h: 0.06, seg: 5, base: [0.14, H + 0.43, z], color: COPPER, colorTop: COPPER_LIGHT });
    // Vorderseite (+Z): Tür, Erdgeschossfenster, zwei Fenster oben
    const fz = D / 2;
    p.box({ size: [0.15, 0.27, 0.02], base: [-0.11, 0.04, fz + 0.002], color: CREAM_LIGHT, shade: 0 });
    p.box({ size: [0.11, 0.22, 0.02], base: [-0.11, 0.04, fz + 0.01], color: GREEN, colorTop: GREEN_LIGHT });
    p.box({ size: [0.11, 0.035, 0.02], base: [-0.11, 0.265, fz + 0.008], color: WINDOW, glow: 1.2 });
    p.sphere({ r: 0.012, detail: 0, at: [-0.14, 0.15, fz + 0.024], color: BRASS_LIGHT });
    p.box({ size: [0.17, 0.03, 0.06], base: [-0.11, 0, fz + 0.03], color: CREAM });
    rectWindow(p, 0.1, 0.13, fz, 0.13, 0.16, 0);
    rectWindow(p, -0.11, 0.41, fz, 0.11, 0.14, 0);
    rectWindow(p, 0.1, 0.41, fz, 0.11, 0.14, 0, false);
    // Rückseite (-Z)
    rectWindow(p, -0.1, 0.13, -fz, 0.12, 0.16, Math.PI, false);
    rectWindow(p, 0.1, 0.13, -fz, 0.12, 0.16, Math.PI);
    rectWindow(p, 0.0, 0.41, -fz, 0.12, 0.14, Math.PI);
    return m.build();
  },

  // Gaslaterne: grüner Gussmast mit Leiterstütze, gläserner Laternenkorb, der warm leuchtet, Messingspitze.
  'prop.industrie.gaslaterne': () => {
    const m = createModel('prop.industrie.gaslaterne');
    const p = m.part('lamp');
    p.cyl({ r: 0.075, rTop: 0.06, h: 0.06, seg: 6, base: [0, 0, 0], color: GREEN, colorTop: GREEN_LIGHT });
    p.cyl({ r: 0.05, rTop: 0.032, h: 0.16, seg: 6, base: [0, 0.06, 0], color: GREEN, colorTop: GREEN_LIGHT });
    p.cyl({ r: 0.03, h: 0.6, seg: 5, base: [0, 0.2, 0], color: GREEN, colorTop: GREEN_LIGHT });
    p.box({ size: [0.2, 0.025, 0.025], base: [0, 0.66, 0], color: GREEN });
    p.cyl({ r: 0.06, rTop: 0.045, h: 0.04, seg: 6, base: [0, 0.79, 0], color: BRASS, colorTop: BRASS_LIGHT });
    // Laternenkorb: oben weiter als unten, leuchtendes Glas unter grünem Dach mit Messingspitze
    p.cyl({ r: 0.08, rTop: 0.125, h: 0.2, seg: 4, base: [0, 0.83, 0], rot: [0, Math.PI / 4, 0], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.4 });
    p.pyramid({ size: [0.25, 0.12, 0.25], base: [0, 1.03, 0], color: GREEN, colorTop: GREEN_LIGHT });
    p.sphere({ r: 0.03, detail: 0, at: [0, 1.17, 0], color: BRASS_LIGHT });
    return m.build();
  },

  // Fabrikhalle: Backsteinhalle mit Sheddach (drei Zähne mit leuchtenden Oberlichtern nach vorn), großen Bogenfenstern
  // und grünem Tor. Flach genug für die Ferne.
  'prop.industrie.fabrikhalle': () => {
    const m = createModel('prop.industrie.fabrikhalle');
    const p = m.part('hall');
    const W = 0.66;
    const D = 0.6;
    const H = 0.36;
    p.box({ size: [W + 0.03, 0.05, D + 0.03], base: [0, 0, 0], color: CREAM, colorTop: CREAM_LIGHT });
    p.box({ size: [W, H, D], base: [0, 0.03, 0], color: BRICK, colorTop: BRICK_LIGHT });
    p.box({ size: [W + 0.03, 0.035, D + 0.03], base: [0, H + 0.01, 0], color: CREAM_LIGHT, shade: 0 });
    // Sheddach: Schrägen hinten, senkrechte Glasflächen vorn (+Z)
    const n = 3;
    const td = D / n;
    for (let i = 0; i < n; i++) {
      const z = -D / 2 + td * (i + 0.5);
      p.wedge({ size: [W - 0.02, 0.18, td], base: [0, H + 0.04, z], color: SLATE, colorTop: SLATE_LIGHT });
      p.box({ size: [W - 0.08, 0.11, 0.012], base: [0, H + 0.065, z + td / 2 + 0.004], color: WINDOW, colorTop: WINDOW_TOP, glow: 1.15 });
    }
    // Front: grünes Tor unter Bogen, je ein Bogenfenster
    archWindow(p, 0, 0.03, D / 2, 0.2, 0.14, 0, false, 3);
    p.box({ size: [0.18, 0.15, 0.02], base: [0, 0.03, D / 2 + 0.014], color: GREEN, colorTop: GREEN_LIGHT });
    for (const x of [-0.22, 0.22]) archWindow(p, x, 0.1, D / 2, 0.11, 0.13, 0, true, 3);
    // Seiten und Rückseite
    for (const s of [1, -1]) {
      for (const z of [-0.15, 0.15]) archWindow(p, s * W / 2, 0.1, z, 0.11, 0.13, s * Math.PI / 2, true, 3);
    }
    for (const x of [-0.18, 0.18]) archWindow(p, x, 0.1, -D / 2, 0.11, 0.13, Math.PI, true, 3);
    return m.build();
  },

  // Kohlehaufen: dunkler Haufen mit bläulichem Glanz im Holzverschlag, Schaufel steckt darin, kupferner Kohleneimer davor.
  'prop.industrie.kohlehaufen': () => {
    const m = createModel('prop.industrie.kohlehaufen');
    const p = m.part('heap');
    // Hölzerner Verschlag hinten und links: warme Farbe und klare Kante um die dunkle Kohle
    p.box({ size: [0.62, 0.16, 0.05], base: [0, 0, -0.27], color: WOOD, colorTop: WOOD_LIGHT });
    p.box({ size: [0.05, 0.16, 0.5], base: [-0.3, 0, -0.02], color: WOOD, colorTop: WOOD_LIGHT });
    for (const [x, z] of /** @type {[number, number][]} */ ([[0.3, -0.27], [-0.3, -0.27], [-0.3, 0.23]])) {
      p.box({ size: [0.06, 0.22, 0.06], base: [x, 0, z], color: WOOD_LIGHT, colorTop: CREAM });
    }
    p.cone({ r: 0.28, h: 0.26, seg: 7, base: [-0.04, 0, -0.04], scale: [1.1, 1, 1], color: COAL, colorTop: COAL_LIGHT, faceJitter: 0.18 });
    p.cone({ r: 0.17, h: 0.16, seg: 6, base: [0.17, 0, 0.13], color: COAL, colorTop: COAL_LIGHT, faceJitter: 0.18 });
    for (const [x, z, r] of /** @type {Vec3[]} */ ([[0.27, -0.1, 0.05], [0.05, 0.27, 0.045], [-0.14, 0.2, 0.04]])) {
      p.sphere({ r, detail: 0, at: [x, r * 0.6, z], color: COAL_LIGHT, faceJitter: 0.15 });
    }
    // Schaufel: heller Holzstiel mit Griff, Blatt steckt im Haufen
    p.cyl({ r: 0.022, h: 0.4, seg: 4, base: [0.02, 0.12, 0.02], rot: [0.3, 0, -0.55], color: WOOD_LIGHT, colorTop: CREAM });
    p.box({ size: [0.1, 0.03, 0.03], at: [0.23, 0.46, 0.13], rot: [0.3, 0, -0.55], color: CREAM });
    p.box({ size: [0.14, 0.15, 0.02], at: [-0.03, 0.12, 0.0], rot: [0.3, 0, -0.55], color: IRON_LIGHT, shade: 0 });
    // Kupferner Kohleneimer vorn
    p.cyl({ r: 0.07, rTop: 0.085, h: 0.14, seg: 7, base: [-0.17, 0, 0.24], color: COPPER, colorTop: COPPER_LIGHT });
    p.cyl({ r: 0.07, h: 0.02, seg: 7, base: [-0.17, 0.12, 0.24], color: COAL, shade: 0 });
    return m.build();
  },

  // Güterwaggon: ochsenblutroter gedeckter Wagen mit heller Schiebetür und rundem Dach auf einem Gleisstück.
  'prop.industrie.gueterwaggon': () => {
    const m = createModel('prop.industrie.gueterwaggon');
    const p = m.part('wagon');
    // Gleisstück: Schwellen und Schienen (Länge entlang X)
    for (const x of [-0.36, -0.12, 0.12, 0.36]) p.box({ size: [0.08, 0.03, 0.36], base: [x, 0, 0], color: WOOD, colorTop: WOOD_LIGHT });
    p.box({ size: [0.96, 0.03, 0.03], base: [0, 0.03, 0.12], color: IRON_LIGHT, shade: 0 });
    p.box({ size: [0.96, 0.03, 0.03], base: [0, 0.03, -0.12], color: IRON_LIGHT, shade: 0 });
    // Räder und Fahrgestell
    for (const x of [-0.22, 0.22]) {
      for (const z of [-0.13, 0.13]) wheel(p, x, 0.14, z, 0.08);
    }
    p.box({ size: [0.74, 0.07, 0.22], base: [0, 0.15, 0], color: IRON, colorTop: IRON_LIGHT });
    for (const x of [-0.39, 0.39]) {
      for (const z of [-0.09, 0.09]) p.cyl({ r: 0.03, h: 0.06, seg: 5, at: [x, 0.19, z], rot: [0, 0, Math.PI / 2], color: BRASS, colorTop: BRASS_LIGHT });
    }
    // Kasten, Tür, Dach
    p.box({ size: [0.72, 0.3, 0.34], base: [0, 0.22, 0], color: OXIDE, colorTop: OXIDE_LIGHT });
    for (const s of [1, -1]) {
      p.box({ size: [0.2, 0.27, 0.02], base: [0, 0.23, s * 0.175], color: CREAM, colorTop: CREAM_LIGHT });
      p.box({ size: [0.02, 0.27, 0.025], base: [0, 0.23, s * 0.178], color: OXIDE, shade: 0 });
      p.box({ size: [0.14, 0.04, 0.012], base: [-0.24, 0.44, s * 0.175], color: CREAM_LIGHT, shade: 0 });
    }
    p.cyl({ r: 0.2, h: 0.76, seg: 10, at: [0, 0.46, 0], rot: [0, 0, Math.PI / 2], scale: [0.3, 1, 1], color: CREAM, colorTop: CREAM_LIGHT });
    return m.build();
  },

  // Wasserturm: hölzerner Tank mit Eisenreifen auf vier Beinen, Kupferkegeldach, Ausleger mit Füllrohr, Leiter.
  'prop.industrie.wasserturm': () => {
    const m = createModel('prop.industrie.wasserturm');
    const p = m.part('tower');
    const L = 0.17;
    const legH = 0.66;
    for (const x of [-L, L]) {
      for (const z of [-L, L]) {
        p.cyl({ r: 0.06, h: 0.05, seg: 5, base: [x * 1.12, 0, z * 1.12], color: CREAM, colorTop: CREAM_LIGHT });
        p.box({ size: [0.05, legH, 0.05], base: [x * 1.12, 0.03, z * 1.12], rot: [z > 0 ? -0.06 : 0.06, 0, x > 0 ? 0.06 : -0.06], color: GREEN, colorTop: GREEN_LIGHT });
      }
    }
    // Querstreben
    for (const s of [1, -1]) {
      p.box({ size: [0.4, 0.03, 0.03], at: [0, 0.3, s * L * 1.06], color: GREEN });
      p.box({ size: [0.03, 0.03, 0.4], at: [s * L * 1.06, 0.3, 0], color: GREEN });
    }
    // Tank
    const ty = 0.68;
    p.cyl({ r: 0.29, h: 0.04, seg: 8, base: [0, ty, 0], color: IRON, colorTop: IRON_LIGHT });
    p.cyl({ r: 0.26, h: 0.34, seg: 8, base: [0, ty + 0.04, 0], color: WOOD, colorTop: WOOD_LIGHT });
    for (const y of [0.1, 0.26]) p.cyl({ r: 0.268, h: 0.03, seg: 8, base: [0, ty + 0.04 + y, 0], color: IRON, colorTop: IRON_LIGHT });
    // Kegeldach aus Kupfer mit Messingknauf
    p.cone({ r: 0.31, h: 0.22, seg: 8, base: [0, ty + 0.38, 0], color: COPPER, colorTop: COPPER_LIGHT });
    p.sphere({ r: 0.035, detail: 0, at: [0, ty + 0.62, 0], color: BRASS_LIGHT });
    // Füllrohr nach vorn mit Lederschlauch
    p.cyl({ r: 0.03, h: 0.28, seg: 5, at: [0, ty + 0.12, 0.36], rot: [Math.PI / 2, 0, 0], color: IRON_LIGHT });
    p.cyl({ r: 0.025, h: 0.16, seg: 5, base: [0, ty - 0.04, 0.49], color: WOOD });
    // Leiter seitlich
    for (const z of [-0.05, 0.05]) p.box({ size: [0.018, 0.72, 0.018], base: [0.29, 0.02, z], rot: [0, 0, 0.03], color: WOOD_LIGHT });
    for (let i = 0; i < 5; i++) p.box({ size: [0.016, 0.016, 0.1], at: [0.29 - i * 0.003, 0.12 + i * 0.13, 0], color: WOOD_LIGHT });
    return m.build();
  },

  // Gasometer: weiter Glockenbehälter in einem grünen Führungsgerüst mit drei Ringen. Die Glocke hebt und senkt sich langsam.
  'prop.industrie.gasometer': () => {
    const m = createModel('prop.industrie.gasometer');
    const p = m.part('frame');
    const R = 0.42;
    p.cyl({ r: R + 0.02, h: 0.1, seg: 10, base: [0, 0, 0], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    p.cyl({ r: R + 0.04, h: 0.03, seg: 10, base: [0, 0.1, 0], color: CREAM_LIGHT, shade: 0 });
    const cols = 6;
    const colH = 0.82;
    for (let i = 0; i < cols; i++) {
      const a = (i / cols) * TAU + Math.PI / 6;
      p.box({ size: [0.045, colH, 0.045], base: [Math.sin(a) * R, 0.1, Math.cos(a) * R], rot: [0, a, 0], color: GREEN, colorTop: GREEN_LIGHT });
    }
    for (const y of [0.38, 0.62, 0.9]) p.torus({ r: R, tube: 0.022, seg: 10, tubeSeg: 3, at: [0, y, 0], color: GREEN_LIGHT, shade: 0 });
    // Glocke
    const bell = m.part('bell', { pivot: [0, 0.1, 0] });
    bell.cyl({ r: R - 0.06, h: 0.5, seg: 10, base: [0, 0.12, 0], color: '#8f9a8c', colorTop: '#c3cbb9' });
    bell.cyl({ r: R - 0.055, h: 0.04, seg: 10, base: [0, 0.44, 0], color: OXIDE, colorTop: OXIDE_LIGHT });
    bell.dome({ r: R - 0.06, seg: 10, rings: 2, base: [0, 0.62, 0], scale: [1, 0.25, 1], color: '#b3bca8', colorTop: '#d6dccb' });
    return m.build({
      animate(pose, ctx) {
        pose.bell.position.y += (Math.sin((ctx.t * 0.05 + ctx.seed) * TAU) * 0.5 + 0.5) * 0.12 - 0.06;
      },
    });
  },

  // Schornstein: hoher, verjüngter Backsteinschlot mit weißen Ringen auf quadratischem Sockel; zwei Rauchwölkchen.
  'prop.industrie.schornstein': () => {
    const m = createModel('prop.industrie.schornstein');
    const p = m.part('stack');
    p.box({ size: [0.34, 0.28, 0.34], base: [0, 0, 0], color: BRICK_DARK, colorTop: BRICK_LIGHT });
    p.box({ size: [0.38, 0.05, 0.38], base: [0, 0.28, 0], color: CREAM_LIGHT, shade: 0 });
    const top = chimneyShaft(p, 0, 0.33, 0, 0.14, 0.09, 1.45, 3);
    for (const name of ['smoke1', 'smoke2', 'smoke3']) puff(m, name, [0, top + 0.1, 0], 0.16);
    return m.build({
      animate(pose, ctx) {
        const r = ctx.t * 0.3 + ctx.seed;
        animPuff(pose, 'smoke1', r, 0.6, 0.22);
        animPuff(pose, 'smoke2', r + 0.333, 0.6, 0.22);
        animPuff(pose, 'smoke3', r + 0.667, 0.6, 0.22);
      },
    });
  },

  // Sperrfeld: Ziegellager mit zwei Ziegelstapeln auf Paletten, einem großen grünen Gussrohr und einer Kabeltrommel.
  'prop.industrie.block': () => {
    const m = createModel('prop.industrie.block');
    const p = m.part('yard');
    p.box({ size: [0.84, 0.035, 0.76], base: [0, 0, 0], color: COBBLE, colorTop: COBBLE_LIGHT });
    // Ziegelstapel
    for (const [x, z, h, a] of /** @type {[number, number, number, number][]} */ ([[-0.2, -0.16, 0.24, 0.1], [0.08, -0.2, 0.16, -0.08]])) {
      p.box({ size: [0.26, 0.04, 0.24], base: [x, 0.035, z], rot: [0, a, 0], color: WOOD, colorTop: WOOD_LIGHT });
      p.box({ size: [0.24, h, 0.22], base: [x, 0.075, z], rot: [0, a, 0], color: BRICK, colorTop: BRICK_LIGHT });
      p.box({ size: [0.245, 0.012, 0.225], base: [x, 0.075 + h * 0.5, z], rot: [0, a, 0], color: CREAM, shade: 0 });
    }
    // Gussrohr, liegend
    p.cyl({ r: 0.11, h: 0.56, seg: 8, at: [0.02, 0.145, 0.2], rot: [0, 0.15, Math.PI / 2], color: GREEN, colorTop: GREEN_LIGHT });
    p.cyl({ r: 0.07, h: 0.565, seg: 8, at: [0.02, 0.145, 0.2], rot: [0, 0.15, Math.PI / 2], color: OPENING, shade: 0 });
    p.cyl({ r: 0.13, h: 0.05, seg: 8, at: [0.29, 0.145, 0.16], rot: [0, 0.15, Math.PI / 2], color: GREEN_LIGHT, shade: 0 });
    // Kabeltrommel
    p.cyl({ r: 0.15, h: 0.03, seg: 8, at: [0.3, 0.185, -0.1], rot: [Math.PI / 2, 0, 0.3], color: WOOD_LIGHT });
    p.cyl({ r: 0.09, h: 0.12, seg: 8, at: [0.3, 0.185, -0.1], rot: [Math.PI / 2, 0, 0.3], color: COPPER, colorTop: COPPER_LIGHT });
    return m.build();
  },

  // Bodendeko 1: Pflasterreste (helle Steine) mit Unkraut dazwischen.
  'prop.industrie.deko1': () => {
    const m = createModel('prop.industrie.deko1');
    const p = m.part('cobbles');
    for (const [x, z, a] of /** @type {Vec3[]} */ ([[-0.08, -0.05, 0.2], [0.07, -0.08, -0.1], [-0.02, 0.08, 0.5], [0.13, 0.07, 0.1]])) {
      p.box({ size: [0.11, 0.03, 0.09], base: [x, 0, z], rot: [0, a, 0], color: COBBLE, colorTop: COBBLE_LIGHT });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      p.cone({ r: 0.028, h: 0.12, seg: 3, base: [-0.13 + Math.sin(a) * 0.025, 0, 0.1 + Math.cos(a) * 0.025], rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], color: WEED, colorTop: WEED_TOP });
    }
    return m.build();
  },

  // Bodendeko 2: Büschel mit orangefarbenen Ringelblumen.
  'prop.industrie.deko2': () => {
    const m = createModel('prop.industrie.deko2');
    const p = m.part('tuft');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      p.cone({ r: 0.03, h: 0.13 + (i % 2) * 0.04, seg: 3, base: [Math.sin(a) * 0.035, 0, Math.cos(a) * 0.035], rot: [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4], color: WEED, colorTop: WEED_TOP });
    }
    for (const [x, z, h] of /** @type {Vec3[]} */ ([[0.07, 0.03, 0.15], [-0.05, 0.07, 0.12], [0.0, -0.08, 0.17]])) {
      p.cyl({ r: 0.01, h, seg: 3, base: [x, 0, z], color: WEED });
      p.sphere({ r: 0.035, detail: 0, at: [x, h + 0.01, z], scale: [1, 0.6, 1], color: '#f08a2a', colorTop: '#ffc35a' });
    }
    return m.build();
  },
};
