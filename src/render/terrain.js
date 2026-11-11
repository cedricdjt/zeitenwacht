// @ts-check
// Die schwebende Insel: Rasenfelder, abgesenkter Weg und Felswände als EIN Netz mit Vertexfarben.
// Die Farben lassen sich jederzeit neu setzen, auch als kreisförmige "Zeitwelle" beim Wechsel des Zeitalters.

import * as THREE from 'three';
import { fbm2, hash2, valueNoise } from '../util/noise.js';

/** @import { TerrainPalette } from '../types/content' */

/**
 * @typedef {object} TerrainLayout
 * @property {number} width Felder in X
 * @property {number} height Felder in Z
 * @property {(tx: number, tz: number) => boolean} isPath Ob ein Feld zum Weg gehört; wird auch für Felder im Uferstreifen (außerhalb des Spielfelds) gefragt
 * @property {(tx: number, tz: number) => boolean} [isSolid] Felder im Uferstreifen, die sicher Land sein müssen (z. B. der Platz der Basis)
 * @property {(tx: number, tz: number) => boolean} [pathFixed] Wegfeld, das in jeder Stufe Weg bleibt (ohne Angabe: alle). Nur die übrigen
 *   Wegfelder bekommen ein feineres, wandelbares Netz (siehe `setPathStates`).
 * @property {(tx: number, tz: number) => number} [pathLinks] Richtungen, in die ein Weg das Feld verlässt (Bitmaske: 1 = -z, 2 = +x,
 *   4 = +z, 8 = -x); daraus entsteht die Mittellinie der Spur eines künftigen oder alten Weges
 * @property {number} [seed]
 */

/** Zustand eines wandelbaren Wegfeldes: Weg, alter Weg (Gras wächst ein), künftiger Weg (zarte Spur). */
export const PATH_NOW = 0;
export const PATH_FORMER = 1;
export const PATH_FUTURE = 2;
/** Absenkung je Zustand als Anteil von PATH_DEPTH. */
const STATE_DEPTH = [1, 0.42, 0];
/** Unterteilung der wandelbaren Wegfelder je Seite (für Spur und Grasflecken). */
const SUB = 4;

const ROLE_STATIC = 0;
const ROLE_FLOOR = 1;
const ROLE_WALL_TOP = 2;
const ROLE_WALL_BOTTOM = 3;
const ROLE_KERB = 4;
/** Ein unsichtbarer Kantenstreifen liegt so tief unter seinem Boden. */
const KERB_HIDE = 0.014;

const KIND_GROUND = 0;
const KIND_PATH = 1;
const KIND_PATH_EDGE = 2;
const KIND_SOIL = 3;
const KIND_ROCK = 4;

/** Tiefe des Weges unter der Rasenkante. */
export const PATH_DEPTH = 0.06;
/** Breite und Höhe der hellen Kante, die den Weg säumt (Look-Regel: Der Weg hat immer eine helle Kante). */
const KERB_WIDTH = 0.075;
const KERB_HEIGHT = 0.008;
/**
 * Breite des Rasters rund um das Spielfeld in Feldern. Die Inselform selbst reicht höchstens etwa 3,1 Felder über das Spielfeld
 * hinaus; feste Felder (Platz der Basis, Eingänge) dürfen bis zu 3 Felder außerhalb liegen, danach bleibt Luft für den Rand.
 */
const MARGIN = 5;
/** Mittlere Breite des Uferstreifens in Feldern; die Uferlinie schwankt um etwa ein Feld darum. Dort steht die Dekoration der Zeitalter. */
const SHORE = 2.0;

/**
 * Vorzeichenbehafteter Abstand zu einem abgerundeten Rechteck (negativ = innen).
 * @param {number} x
 * @param {number} z
 * @param {number} hx
 * @param {number} hz
 * @param {number} r
 */
function roundedRect(x, z, hx, hz, r) {
  const qx = Math.abs(x) - hx + r;
  const qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

export class Terrain {
  /**
   * @param {TerrainLayout} layout
   * @param {THREE.Material} material Beleuchtetes Material mit Vertexfarben (siehe createMaterials().matte)
   */
  constructor(layout, material) {
    this.layout = layout;
    this.seed = layout.seed ?? 1;
    const { width, height } = layout;
    const seed = this.seed;
    const halfX = width / 2;
    const halfZ = height / 2;

    /** @type {number[]} */
    const positions = [];
    /** Art der Fläche je Vertex. @type {number[]} */
    const kinds = [];
    /** Mischwert groundA/groundB bzw. Helligkeitsfaktor je Vertex. @type {number[]} */
    const mixes = [];
    /** Helligkeitsfaktor je Vertex. @type {number[]} */
    const gains = [];
    // Wandelbare Wegfelder: Rolle je Vertex, eigenes Feld, bis zu drei Bezugsfelder, Nähe zur Mittellinie der Spur, Rauschen.
    /** @type {number[]} */
    const roles = [];
    /** @type {number[]} */
    const owners = [];
    /** @type {number[]} */
    const refA = [];
    /** @type {number[]} */
    const refB = [];
    /** @type {number[]} */
    const refC = [];
    /** @type {number[]} */
    const traces = [];
    /** @type {number[]} */
    const noises = [];
    /** Rolle der nächsten Vertices (gesetzt von `dyn`), damit die Hilfsfunktionen ohne lange Parameterlisten auskommen. */
    const cur = { role: ROLE_STATIC, tile: -1, a: -1, b: -1, c: -1 };
    /** @param {number} role @param {number} tile @param {number} a @param {number} b @param {number} c */
    const dyn = (role, tile, a = -1, b = -1, c = -1) => {
      cur.role = role;
      cur.tile = tile;
      cur.a = a;
      cur.b = b;
      cur.c = c;
    };

    /**
     * @param {number} x @param {number} y @param {number} z
     * @param {number} kind @param {number} mix @param {number} gain
     * @param {number} [trace] @param {number} [noise]
     */
    const push = (x, y, z, kind, mix, gain, trace = 0, noise = 0) => {
      positions.push(x, y, z);
      kinds.push(kind);
      mixes.push(mix);
      gains.push(gain);
      roles.push(cur.role);
      owners.push(cur.tile);
      refA.push(cur.a);
      refB.push(cur.b);
      refC.push(cur.c);
      traces.push(trace);
      noises.push(noise);
    };

    /**
     * Waagerechtes Viereck der hellen Wegkante; die Reihenfolge der Ecken wird so gewählt, dass die Fläche nach oben zeigt.
     * @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1
     * @param {number} x2 @param {number} z2 @param {number} x3 @param {number} z3
     */
    const kerb = (x0, z0, x1, z1, x2, z2, x3, z3) => {
      const up = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0) > 0;
      const y = KERB_HEIGHT;
      push(x0, y, z0, KIND_PATH_EDGE, 0, 1);
      if (up) {
        push(x1, y, z1, KIND_PATH_EDGE, 0, 1);
        push(x2, y, z2, KIND_PATH_EDGE, 0, 1);
      } else {
        push(x2, y, z2, KIND_PATH_EDGE, 0, 1);
        push(x1, y, z1, KIND_PATH_EDGE, 0, 1);
      }
      push(x0, y, z0, KIND_PATH_EDGE, 0, 1);
      if (up) {
        push(x2, y, z2, KIND_PATH_EDGE, 0, 1);
        push(x3, y, z3, KIND_PATH_EDGE, 0, 1);
      } else {
        push(x3, y, z3, KIND_PATH_EDGE, 0, 1);
        push(x2, y, z2, KIND_PATH_EDGE, 0, 1);
      }
    };

    // --- Inselform: Abstandsfeld auf den Gitterpunkten ---
    const gx0 = -MARGIN;
    const gz0 = -MARGIN;
    const nx = width + MARGIN * 2;
    const nz = height + MARGIN * 2;
    /** Ob ein Feld sicher Land sein muss: Wegfelder und ausdrücklich feste Felder, auch im Uferstreifen. @param {number} tx @param {number} tz */
    const mustBeLand = (tx, tz) => layout.isPath(tx, tz) || (layout.isSolid ? layout.isSolid(tx, tz) : false);
    /** @param {number} ix @param {number} iz Gitterpunkt in Feldkoordinaten (0..width, 0..height im Spielfeld) */
    const field = (ix, iz) => {
      const x = ix - halfX;
      const z = iz - halfZ;
      let f = roundedRect(x, z, halfX + SHORE, halfZ + SHORE, 3.4) + (fbm2(ix * 0.37, iz * 0.37, seed) - 0.5) * 2.1;
      // Das Spielfeld selbst gehört immer zur Insel.
      if (ix >= -0.5 && ix <= width + 0.5 && iz >= -0.5 && iz <= height + 0.5) f = Math.min(f, -0.6);
      // Ebenso alle Gitterpunkte, die an ein festes Feld grenzen.
      else if (mustBeLand(ix - 1, iz - 1) || mustBeLand(ix, iz - 1) || mustBeLand(ix - 1, iz) || mustBeLand(ix, iz)) f = Math.min(f, -0.6);
      return f;
    };
    const fieldCache = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) fieldCache[j * (nx + 1) + i] = field(i + gx0, j + gz0);
    /** @param {number} i @param {number} j */
    const f = (i, j) => fieldCache[j * (nx + 1) + i];

    /** Randkanten der Insel als Liste [x1, z1, x2, z2], so gerichtet, dass die Wand nach außen zeigt. @type {number[]} */
    const rim = [];

    // --- Wegfelder durchnummerieren; wandelbar sind die, die nicht in jeder Stufe Weg sind ---
    /** @type {Map<number, number>} */
    const pathIndex = new Map();
    /** @type {number[]} */
    const pathTx = [];
    /** @type {number[]} */
    const pathTz = [];
    /** @type {boolean[]} */
    const pathFixed = [];
    /** @param {number} tx @param {number} tz */
    const tileKey = (tx, tz) => (tz + 128) * 512 + (tx + 128);
    for (let tz = gz0; tz < gz0 + nz; tz++) {
      for (let tx = gx0; tx < gx0 + nx; tx++) {
        if (!layout.isPath(tx, tz)) continue;
        pathIndex.set(tileKey(tx, tz), pathTx.length);
        pathTx.push(tx);
        pathTz.push(tz);
        pathFixed.push(layout.pathFixed ? layout.pathFixed(tx, tz) : true);
      }
    }
    /** @param {number} tx @param {number} tz @returns {number} Index des Wegfeldes oder -1 */
    const pidx = (tx, tz) => pathIndex.get(tileKey(tx, tz)) ?? -1;
    /** Wegfeld, das in jeder Stufe Weg ist. @param {number} tx @param {number} tz */
    const fixedAt = (tx, tz) => {
      const p = pidx(tx, tz);
      return p >= 0 && pathFixed[p];
    };
    /**
     * Nähe eines Punktes (lokal 0..1 im Feld) zur Mittellinie der Spur: 1 auf ihr, 0 weit weg.
     * @param {number} links @param {number} u @param {number} v
     */
    const traceAt = (links, u, v) => {
      let d = Math.hypot(u - 0.5, v - 0.5);
      /** @type {[number, number, number][]} */
      const dirs = [[1, 0.5, 0], [2, 1, 0.5], [4, 0.5, 1], [8, 0, 0.5]];
      for (const [bit, ex, ez] of dirs) {
        if (!(links & bit)) continue;
        // Abstand zur Strecke Mitte -> Kantenmitte.
        const sx = ex - 0.5;
        const sz = ez - 0.5;
        const t = Math.max(0, Math.min(1, ((u - 0.5) * sx + (v - 0.5) * sz) / (sx * sx + sz * sz)));
        d = Math.min(d, Math.hypot(u - 0.5 - sx * t, v - 0.5 - sz * t));
      }
      const k = Math.min(1, Math.max(0, (d - 0.1) / 0.3));
      return 1 - k * k * (3 - 2 * k);
    };

    /** @param {number} tx @param {number} tz */
    const groundMix = (tx, tz) => fbm2(tx * 0.21 + 3.3, tz * 0.21 - 1.7, seed + 7);
    /** @param {number} tx @param {number} tz */
    const tileGain = (tx, tz) => 1 + (((tx + tz) & 1) === 0 ? 0.018 : -0.018) + (hash2(tx, tz, seed + 3) - 0.5) * 0.03;

    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const tx = i + gx0;
        const tz = j + gz0;
        const x0 = tx - halfX;
        const z0 = tz - halfZ;
        const isPath = layout.isPath(tx, tz);
        const v = [f(i, j), f(i + 1, j), f(i + 1, j + 1), f(i, j + 1)];
        const corner = [
          [x0, z0],
          [x0 + 1, z0],
          [x0 + 1, z0 + 1],
          [x0, z0 + 1],
        ];
        const inside = v.map((value) => value < 0);
        const insideCount = inside.filter(Boolean).length;
        if (insideCount === 0) continue;

        const mix = groundMix(tx, tz);
        const gain = tileGain(tx, tz);

        if (insideCount === 4) {
          const p = isPath ? pidx(tx, tz) : -1;
          if (!isPath) {
            dyn(ROLE_STATIC, -1);
            push(x0, 0, z0, KIND_GROUND, mix, gain);
            push(x0, 0, z0 + 1, KIND_GROUND, mix, gain);
            push(x0 + 1, 0, z0 + 1, KIND_GROUND, mix, gain);
            push(x0, 0, z0, KIND_GROUND, mix, gain);
            push(x0 + 1, 0, z0 + 1, KIND_GROUND, mix, gain);
            push(x0 + 1, 0, z0, KIND_GROUND, mix, gain);
            continue;
          }
          const fixed = pathFixed[p];
          const y = -PATH_DEPTH;
          if (fixed) {
            const pm = hash2(tx, tz, seed + 11);
            dyn(ROLE_STATIC, p);
            push(x0, y, z0, KIND_PATH, pm, gain);
            push(x0, y, z0 + 1, KIND_PATH, pm, gain);
            push(x0 + 1, y, z0 + 1, KIND_PATH, pm, gain);
            push(x0, y, z0, KIND_PATH, pm, gain);
            push(x0 + 1, y, z0 + 1, KIND_PATH, pm, gain);
            push(x0 + 1, y, z0, KIND_PATH, pm, gain);
          } else {
            // Wandelbares Feld: feiner unterteilt, damit Spur und Grasflecken eine Form bekommen. `mix` ist hier der Boden des Feldes.
            const links = layout.pathLinks ? layout.pathLinks(tx, tz) : 0;
            dyn(ROLE_FLOOR, p);
            /** @param {number} a @param {number} b */
            const sub = (a, b) => {
              const u = a / SUB;
              const v = b / SUB;
              const wx = x0 + u;
              const wz = z0 + v;
              push(wx, y, wz, KIND_PATH, mix, gain, traceAt(links, u, v), hash2(Math.round(wx * 8), Math.round(wz * 8), seed + 41));
            };
            for (let b = 0; b < SUB; b++) {
              for (let a = 0; a < SUB; a++) {
                sub(a, b);
                sub(a, b + 1);
                sub(a + 1, b + 1);
                sub(a, b);
                sub(a + 1, b + 1);
                sub(a + 1, b);
              }
            }
          }
          // Kanten zum höher liegenden Boden.
          /** @type {[number, number, number, number, number, number][]} dx, dz der Nachbarzelle und die Kante x1,z1,x2,z2 */
          const edges = [
            [0, -1, x0 + 1, z0, x0, z0],
            [1, 0, x0 + 1, z0 + 1, x0 + 1, z0],
            [0, 1, x0, z0 + 1, x0 + 1, z0 + 1],
            [-1, 0, x0, z0, x0, z0 + 1],
          ];
          for (const [dx, dz, ax, az, bx, bz] of edges) {
            const ntx = tx + dx;
            const ntz = tz + dz;
            const q = pidx(ntx, ntz);
            // Zwischen zwei Feldern, die immer Weg sind, und von einem wandelbaren zu einem festen Wegfeld gibt es nie eine Stufe.
            if (q >= 0 && pathFixed[q]) continue;
            const live = !fixed || q >= 0;
            const ox = dx * KERB_WIDTH;
            const oz = dz * KERB_WIDTH;
            if (!live) dyn(ROLE_STATIC, p);
            const top = (/** @type {number} */ x, /** @type {number} */ z) => {
              if (live) dyn(ROLE_WALL_TOP, p, q);
              push(x, 0, z, KIND_PATH_EDGE, 0, 1);
            };
            const bottom = (/** @type {number} */ x, /** @type {number} */ z) => {
              if (live) dyn(ROLE_WALL_BOTTOM, p, q);
              push(x, -PATH_DEPTH, z, KIND_PATH_EDGE, 0, 0.9);
            };
            top(ax, az);
            bottom(bx, bz);
            bottom(ax, az);
            top(ax, az);
            top(bx, bz);
            bottom(bx, bz);
            // Helle Kante: ein schmaler, kaum erhabener Streifen auf dem Nachbarfeld entlang des Weges.
            if (live) dyn(ROLE_KERB, p, q);
            else dyn(ROLE_STATIC, p);
            kerb(ax, az, bx, bz, bx + ox, bz + oz, ax + ox, az + oz);
            // An Außenecken des Weges das fehlende Eckstück ergänzen.
            /** @type {[number, number, number, number][]} */
            const ends = [
              [ax, az, ax - bx, az - bz],
              [bx, bz, bx - ax, bz - az],
            ];
            for (const [ex, ez, sx, sz] of ends) {
              // Jede Ecke nur einmal, von der Kante aus, deren Richtung "kleiner" ist.
              if (dx === 0) continue;
              // (sx, sz) zeigt entlang der Kante über ihr Ende hinaus; dort liegt das Nachbarfeld in dieser Richtung.
              const along = pidx(tx + sx, tz + sz);
              const diag = pidx(tx + sx + dx, tz + sz + dz);
              if ((along >= 0 && pathFixed[along]) || (diag >= 0 && pathFixed[diag])) continue;
              if (!live && along < 0 && diag < 0) {
                dyn(ROLE_STATIC, p);
              } else {
                dyn(ROLE_KERB, p, diag, q, along);
              }
              kerb(ex, ez, ex + ox, ez, ex + ox, ez + sz * KERB_WIDTH, ex, ez + sz * KERB_WIDTH);
            }
          }
          dyn(ROLE_STATIC, -1);
          continue;
        }

        // Randzelle: Vieleck aus den inneren Ecken und den Schnittpunkten der Kanten (Marching Squares).
        /** @type {[number, number][]} */
        const poly = [];
        /** @type {boolean[]} */
        const isCut = [];
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          if (inside[k]) {
            poly.push([corner[k][0], corner[k][1]]);
            isCut.push(false);
          }
          if (inside[k] !== inside[k2]) {
            const t = v[k] / (v[k] - v[k2]);
            poly.push([corner[k][0] + (corner[k2][0] - corner[k][0]) * t, corner[k][1] + (corner[k2][1] - corner[k][1]) * t]);
            isCut.push(true);
          }
        }
        // Die Ecken laufen von oben gesehen im Uhrzeigersinn; der Fächer wird umgekehrt ausgegeben, damit die Normale nach +Y zeigt.
        for (let k = 1; k + 1 < poly.length; k++) {
          push(poly[0][0], 0, poly[0][1], KIND_GROUND, mix, gain);
          push(poly[k + 1][0], 0, poly[k + 1][1], KIND_GROUND, mix, gain);
          push(poly[k][0], 0, poly[k][1], KIND_GROUND, mix, gain);
        }
        // Inselrand: aufeinanderfolgende Schnittpunkte bilden eine Randkante.
        let cx = 0;
        let cz = 0;
        for (const p of poly) {
          cx += p[0];
          cz += p[1];
        }
        cx /= poly.length;
        cz /= poly.length;
        for (let k = 0; k < poly.length; k++) {
          const k2 = (k + 1) % poly.length;
          if (!isCut[k] || !isCut[k2]) continue;
          const a = poly[k];
          const b = poly[k2];
          const mx = (a[0] + b[0]) / 2;
          const mz = (a[1] + b[1]) / 2;
          // So ausrichten, dass die Wand (a0, b0, b1) nach außen zeigt.
          const cross = (b[0] - a[0]) * (cz - mz) - (b[1] - a[1]) * (cx - mx);
          if (cross > 0) rim.push(a[0], a[1], b[0], b[1]);
          else rim.push(b[0], b[1], a[0], a[1]);
        }
      }
    }

    // --- Flanken: Erdschicht, Fels, nach unten zulaufend ---
    /** @param {number} x @param {number} z @param {number} level 0..4 */
    const ring = (x, z, level) => {
      if (level === 0) return [x, 0, z];
      if (level === 1) return [x, -0.22, z];
      const n = valueNoise(x * 0.9 + 5, z * 0.9 + 2, seed + 21);
      const n2 = valueNoise(x * 1.7 - 3, z * 1.7 + 8, seed + 22);
      if (level === 2) {
        // Leicht überhängende Felswand.
        const k = 0.985 - n2 * 0.03;
        return [x * k, -1.25 - n * 0.7, z * k];
      }
      if (level === 3) {
        const k = 0.86 - n * 0.08;
        return [x * k, -2.6 - n2 * 1.1, z * k];
      }
      const k = 0.42 - n2 * 0.2;
      return [x * k, -4.6 - n * 2.4, z * k];
    };
    const bands = [
      { kind: KIND_SOIL, gainTop: 1, gainBottom: 0.9 },
      { kind: KIND_ROCK, gainTop: 1.04, gainBottom: 0.9 },
      { kind: KIND_ROCK, gainTop: 0.9, gainBottom: 0.72 },
      { kind: KIND_ROCK, gainTop: 0.72, gainBottom: 0.5 },
    ];
    for (let e = 0; e < rim.length; e += 4) {
      const ax = rim[e];
      const az = rim[e + 1];
      const bx = rim[e + 2];
      const bz = rim[e + 3];
      const jitter = 0.92 + hash2(Math.round(ax * 10), Math.round(az * 10), seed + 31) * 0.16;
      for (let level = 0; level < bands.length; level++) {
        const band = bands[level];
        const a0 = ring(ax, az, level);
        const b0 = ring(bx, bz, level);
        const a1 = ring(ax, az, level + 1);
        const b1 = ring(bx, bz, level + 1);
        push(a0[0], a0[1], a0[2], band.kind, 0, band.gainTop * jitter);
        push(b0[0], b0[1], b0[2], band.kind, 0, band.gainTop * jitter);
        push(b1[0], b1[1], b1[2], band.kind, 0, band.gainBottom * jitter);
        push(a0[0], a0[1], a0[2], band.kind, 0, band.gainTop * jitter);
        push(b1[0], b1[1], b1[2], band.kind, 0, band.gainBottom * jitter);
        push(a1[0], a1[1], a1[2], band.kind, 0, band.gainBottom * jitter);
      }
    }

    this.positions = new Float32Array(positions);
    this.kinds = new Uint8Array(kinds);
    this.mixes = new Float32Array(mixes);
    this.gains = new Float32Array(gains);
    this.colors = new Float32Array(positions.length);
    // --- Wandelbare Wegfelder ---
    /** Zahl der Wegfelder (aller Stufen). */
    this.pathCount = pathTx.length;
    this.pathTx = Int16Array.from(pathTx);
    this.pathTz = Int16Array.from(pathTz);
    this.pathFixed = Uint8Array.from(pathFixed, (b) => (b ? 1 : 0));
    this._pathIndex = pathIndex;
    this._tileKey = tileKey;
    /** Je-Feld-Helligkeit des Weges (wie bei festen Wegfeldern). */
    this.pathHash = Float32Array.from(pathTx, (x, i) => hash2(x, pathTz[i], seed + 11));
    /** Zustand je Wegfeld (PATH_NOW, PATH_FORMER, PATH_FUTURE) und der Zustand vor dem laufenden Wechsel. */
    this.state = new Uint8Array(this.pathCount);
    this.stateFrom = new Uint8Array(this.pathCount);
    /** Zählt jede Änderung der Zustände (für die Zwischenspeicher der Zeitwelle). */
    this._stateVersion = 0;
    // Vertices, deren Höhe oder Farbe vom Zustand abhängt.
    /** @type {number[]} */
    const dynList = [];
    for (let i = 0; i < roles.length; i++) if (roles[i] !== ROLE_STATIC || (owners[i] >= 0 && !pathFixed[owners[i]])) dynList.push(i);
    this.dyn = Int32Array.from(dynList);
    this.dynRole = Uint8Array.from(dynList, (i) => roles[i]);
    this.dynTile = Int16Array.from(dynList, (i) => owners[i]);
    this.dynA = Int16Array.from(dynList, (i) => refA[i]);
    this.dynB = Int16Array.from(dynList, (i) => refB[i]);
    this.dynC = Int16Array.from(dynList, (i) => refC[i]);
    this.dynTrace = Float32Array.from(dynList, (i) => traces[i]);
    this.dynNoise = Float32Array.from(dynList, (i) => noises[i]);
    /** Höhe der wandelbaren Vertices vor und nach dem laufenden Wechsel. */
    this._yFrom = new Float32Array(dynList.length);
    this._yTo = new Float32Array(dynList.length);
    /** Index in `dyn` je Vertex (-1 = fest). */
    this._dynOf = new Int32Array(roles.length).fill(-1);
    for (let k = 0; k < dynList.length; k++) this._dynOf[dynList[k]] = k;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
    this.colorAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', this.colorAttribute);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'terrain';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    /** Größter Abstand eines Vertex vom Ursprung in der XZ-Ebene (für Übergänge). */
    this.radius = 0;
    for (let i = 0; i < this.positions.length; i += 3) this.radius = Math.max(this.radius, Math.hypot(this.positions[i], this.positions[i + 2]));
    /** Punkte auf dem Inselrand [x, z, x, z, ...]; nützlich zum Platzieren von Dekoration. */
    this.rim = new Float32Array(rim);
    this._fieldCache = fieldCache;
    this._groundMix = groundMix;
    this._tileGain = tileGain;
    this._nx = nx;
    this._gx0 = gx0;
    this._gz0 = gz0;
    /** Zwischenspeicher der Farben beider Paletten während einer Zeitwelle. */
    this._waveTo = new Float32Array(0);
    this._waveFrom = new Float32Array(0);
    /** @type {TerrainPalette | null} */
    this._waveToPalette = null;
    /** @type {TerrainPalette | null} */
    this._waveFromPalette = null;
    this._waveToVersion = -1;
    this._waveFromVersion = -1;
    /** Ob die Höhen der wandelbaren Vertices während der Welle nachgeführt werden müssen. */
    this._morph = false;
    /** Zuletzt ohne Welle gesetzte Palette (für `setPathStates`). @type {TerrainPalette | null} */
    this._palette = null;
    this._placeDyn(this.state, this._yTo);
    this._applyY(this._yTo);
  }

  /**
   * Index eines Wegfeldes (aller Stufen) oder -1.
   * @param {number} tx
   * @param {number} tz
   */
  pathIndexOf(tx, tz) {
    return this._pathIndex.get(this._tileKey(tx, tz)) ?? -1;
  }

  /**
   * Setzt die Zustände der Wegfelder sofort (ohne Übergang). Index wie `pathIndexOf`; feste Felder bleiben immer Weg.
   * @param {ArrayLike<number>} states
   */
  setPathStates(states) {
    for (let p = 0; p < this.pathCount; p++) this.state[p] = this.pathFixed[p] ? PATH_NOW : states[p] ?? PATH_NOW;
    this.stateFrom.set(this.state);
    this._stateVersion++;
    this._morph = false;
    this._placeDyn(this.state, this._yTo);
    this._applyY(this._yTo);
    if (this._palette) this.setPalette(this._palette);
  }

  /**
   * Beginnt einen Wechsel der Zustände: Die folgenden Aufrufe von `setPalette` mit Welle zeigen innerhalb des Wellenradius schon
   * die neuen Zustände (Weg senkt sich ein, alter Weg hebt sich und vergrast), außerhalb noch die alten.
   * Ein Aufruf von `setPalette` ohne Welle schließt den Wechsel ab.
   * @param {ArrayLike<number>} states
   */
  changePathStates(states) {
    this.stateFrom.set(this.state);
    let changed = false;
    for (let p = 0; p < this.pathCount; p++) {
      const next = this.pathFixed[p] ? PATH_NOW : states[p] ?? PATH_NOW;
      if (next !== this.state[p]) changed = true;
      this.state[p] = next;
    }
    this._stateVersion++;
    this._placeDyn(this.stateFrom, this._yFrom);
    this._placeDyn(this.state, this._yTo);
    this._morph = changed;
  }

  /**
   * Höhen der wandelbaren Vertices für einen Satz Zustände.
   * @param {Uint8Array} states
   * @param {Float32Array} out
   */
  _placeDyn(states, out) {
    const n = this.dyn.length;
    /** @param {number} t */
    const w = (t) => (t < 0 ? 0 : STATE_DEPTH[states[t]]);
    for (let k = 0; k < n; k++) {
      const role = this.dynRole[k];
      const tile = this.dynTile[k];
      const a = this.dynA[k];
      let y;
      if (role === ROLE_FLOOR) y = -PATH_DEPTH * w(tile);
      else if (role === ROLE_WALL_TOP) y = -PATH_DEPTH * w(a);
      else if (role === ROLE_WALL_BOTTOM) y = -PATH_DEPTH * Math.max(w(tile), w(a));
      else if (role === ROLE_KERB) {
        const s = Math.min(1, Math.max(0, (w(tile) - Math.max(w(a), w(this.dynB[k]), w(this.dynC[k]))) / 0.5));
        y = -PATH_DEPTH * w(a) + (KERB_HEIGHT + KERB_HIDE) * s - KERB_HIDE;
      } else {
        y = this.positions[this.dyn[k] * 3 + 1];
      }
      out[k] = y;
    }
  }

  /** @param {Float32Array} ys */
  _applyY(ys) {
    const n = this.dyn.length;
    const pos = this.positions;
    for (let k = 0; k < n; k++) pos[this.dyn[k] * 3 + 1] = ys[k];
    const attr = this.mesh.geometry.getAttribute('position');
    attr.needsUpdate = true;
  }

  /**
   * Geometrie der Oberseite (Boden und Weg, ohne Flanken) als eigenes Netz, um `lift` angehoben.
   * Für Lichteffekte, die genau der Inselform folgen sollen.
   * @param {number} [lift]
   * @returns {THREE.BufferGeometry}
   */
  topGeometry(lift = 0.02) {
    /** @type {number[]} */
    const out = [];
    const n = this.kinds.length;
    for (let i = 0; i < n; i += 3) {
      const kind = this.kinds[i];
      if (kind !== KIND_GROUND && kind !== KIND_PATH) continue;
      for (let k = 0; k < 3; k++) {
        // Wandelbare Wegfelder liegen je nach Zustand verschieden tief: der Saum liegt dort auf Höhe des Bodens.
        const y = this._dynOf[i + k] >= 0 ? 0 : this.positions[(i + k) * 3 + 1];
        out.push(this.positions[(i + k) * 3], y + lift, this.positions[(i + k) * 3 + 2]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Füllt ein Farbfeld mit den Farben aller Vertices für eine Palette und einen Satz Zustände der Wegfelder.
   * @param {TerrainPalette} palette
   * @param {Float32Array} out
   * @param {Uint8Array} states
   */
  _fillColors(palette, out, states) {
    // Die sechs Farben der Palette nur einmal auflösen, nicht je Vertex.
    const p = [new THREE.Color(palette.groundA), new THREE.Color(palette.groundB), new THREE.Color(palette.path), new THREE.Color(palette.pathEdge), new THREE.Color(palette.soil), new THREE.Color(palette.rock)];
    const n = this.kinds.length;
    for (let i = 0; i < n; i++) {
      const mix = this.mixes[i];
      const gain = this.gains[i];
      let r;
      let g;
      let b;
      switch (this.kinds[i]) {
        case KIND_GROUND:
          r = p[0].r + (p[1].r - p[0].r) * mix;
          g = p[0].g + (p[1].g - p[0].g) * mix;
          b = p[0].b + (p[1].b - p[0].b) * mix;
          break;
        case KIND_PATH: {
          const k = 0.96 + mix * 0.08;
          r = p[2].r * k;
          g = p[2].g * k;
          b = p[2].b * k;
          break;
        }
        case KIND_PATH_EDGE:
          r = p[3].r;
          g = p[3].g;
          b = p[3].b;
          break;
        case KIND_SOIL:
          r = p[4].r;
          g = p[4].g;
          b = p[4].b;
          break;
        default:
          r = p[5].r;
          g = p[5].g;
          b = p[5].b;
      }
      out[i * 3] = r * gain;
      out[i * 3 + 1] = g * gain;
      out[i * 3 + 2] = b * gain;
    }
    // Wandelbare Wegfelder: Weg, alter Weg mit einwachsendem Gras, künftiger Weg als zarte Spur im Boden.
    const m = this.dyn.length;
    // Mittlerer Boden für die verblassende Kante des alten Weges.
    const gr = (p[0].r + p[1].r) / 2;
    const gg = (p[0].g + p[1].g) / 2;
    const gb = (p[0].b + p[1].b) / 2;
    // Die Spur ist etwas heller und wärmer als der Weg, damit sie auch auf dunklem Boden (Nacht) zu lesen ist.
    const lum = 0.2126 * p[2].r + 0.7152 * p[2].g + 0.0722 * p[2].b;
    const groundLum = 0.2126 * gr + 0.7152 * gg + 0.0722 * gb;
    const lift = lum < groundLum * 1.25 ? 1.35 : 1;
    for (let k = 0; k < m; k++) {
      const tile = this.dynTile[k];
      if (tile < 0) continue;
      const state = states[tile];
      const i = this.dyn[k];
      const j = i * 3;
      const role = this.dynRole[k];
      if (role === ROLE_FLOOR) {
        const gain = this.gains[i];
        const mix = this.mixes[i];
        const br = (p[0].r + (p[1].r - p[0].r) * mix) * gain;
        const bg = (p[0].g + (p[1].g - p[0].g) * mix) * gain;
        const bb = (p[0].b + (p[1].b - p[0].b) * mix) * gain;
        const h = 0.96 + this.pathHash[tile] * 0.08;
        const pr = p[2].r * h * gain;
        const pg = p[2].g * h * gain;
        const pb = p[2].b * h * gain;
        const trace = this.dynTrace[k];
        const noise = this.dynNoise[k];
        let t;
        if (state === PATH_NOW) t = 1;
        else if (state === PATH_FORMER) {
          // Gras kriecht vom Rand her ein, in der Mitte bleiben Flecken des alten Belags.
          const grass = Math.min(1, Math.max(0, 0.18 + 0.55 * (1 - trace) + (noise - 0.5) * 0.7));
          t = 1 - grass * 0.85;
        } else {
          // Künftiger Weg: eine schmale, ausgetretene Spur, unregelmäßig.
          t = trace * (0.26 + noise * 0.16);
        }
        const tl = state === PATH_FUTURE ? lift : 1;
        out[j] = br + (pr * tl - br) * t;
        out[j + 1] = bg + (pg * tl - bg) * t;
        out[j + 2] = bb + (pb * tl - bb) * t;
      } else if (role === ROLE_KERB && state === PATH_FORMER) {
        out[j] = p[3].r + (gr - p[3].r) * 0.55;
        out[j + 1] = p[3].g + (gg - p[3].g) * 0.55;
        out[j + 2] = p[3].b + (gb - p[3].b) * 0.55;
      }
    }
  }

  /**
   * Farbton des Bodens auf einem Feld, wie ihn `setPalette` setzt: Mischwert zwischen groundA und groundB und Helligkeitsfaktor.
   * Für Dinge, die genau im Boden eines Feldes erscheinen sollen (Bodenzeichen der besonderen Bauplätze).
   * @param {number} tx
   * @param {number} tz
   * @returns {{ mix: number, gain: number }}
   */
  groundTone(tx, tz) {
    return { mix: this._groundMix(tx, tz), gain: this._tileGain(tx, tz) };
  }

  /**
   * Abstandswert der Inselform an einer Weltposition; negativ = auf der Insel, je kleiner desto weiter innen.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  shoreDistance(x, z) {
    const { width, height } = this.layout;
    const fx = x + width / 2 - this._gx0;
    const fz = z + height / 2 - this._gz0;
    const nx = this._nx;
    const nz = (this._fieldCache.length / (nx + 1)) - 1;
    if (fx < 0 || fz < 0 || fx >= nx || fz >= nz) return 10;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const c = this._fieldCache;
    const a = c[j * (nx + 1) + i];
    const b = c[j * (nx + 1) + i + 1];
    const d = c[(j + 1) * (nx + 1) + i];
    const e = c[(j + 1) * (nx + 1) + i + 1];
    return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
  }

  /**
   * Färbt das Gelände. Mit `from` und `wave` entsteht ein Übergang: Innerhalb des Wellenradius gilt bereits `to`.
   * Der Aufruf mit Welle ist billig genug für jedes Bild (die Farben beider Paletten werden zwischengespeichert,
   * solange dieselben Palettenobjekte übergeben werden).
   * @param {TerrainPalette} to
   * @param {TerrainPalette} [from]
   * @param {{ x: number, z: number, radius: number, softness?: number, glow?: number }} [wave] glow = Aufhellung des Bodens an der Wellenfront (0 = keine)
   */
  setPalette(to, from, wave) {
    const n = this.kinds.length;
    const colors = this.colors;
    if (!from || !wave) {
      if (this._morph || this.stateFrom.some((v, i) => v !== this.state[i])) {
        // Ein Wechsel der Wege ist abgeschlossen.
        this.stateFrom.set(this.state);
        this._morph = false;
        this._applyY(this._yTo);
      }
      this._fillColors(to, colors, this.state);
      this._palette = to;
      this._waveToPalette = null;
      this._waveFromPalette = null;
      this.colorAttribute.needsUpdate = true;
      return;
    }
    if (this._waveTo.length !== n * 3) {
      this._waveTo = new Float32Array(n * 3);
      this._waveFrom = new Float32Array(n * 3);
      this._waveToPalette = null;
      this._waveFromPalette = null;
    }
    if (this._waveToPalette !== to || this._waveToVersion !== this._stateVersion) {
      this._fillColors(to, this._waveTo, this.state);
      this._waveToPalette = to;
      this._waveToVersion = this._stateVersion;
    }
    if (this._waveFromPalette !== from || this._waveFromVersion !== this._stateVersion) {
      this._fillColors(from, this._waveFrom, this.stateFrom);
      this._waveFromPalette = from;
      this._waveFromVersion = this._stateVersion;
    }
    const a = this._waveFrom;
    const b = this._waveTo;
    const pos = this.positions;
    const soft = wave.softness ?? 1.5;
    const glow = wave.glow ?? 0;
    const wx = wave.x;
    const wz = wave.z;
    const radius = wave.radius;
    const morph = this._morph;
    const dynOf = this._dynOf;
    const yFrom = this._yFrom;
    const yTo = this._yTo;
    for (let i = 0; i < n; i++) {
      const dx = pos[i * 3] - wx;
      const dz = pos[i * 3 + 2] - wz;
      const u = (radius - Math.sqrt(dx * dx + dz * dz)) / soft;
      const j = i * 3;
      if (morph) {
        const d = dynOf[i];
        if (d >= 0) {
          // Weg und Kanten heben bzw. senken sich im Gleichschritt mit der Farbe.
          const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
          pos[j + 1] = yFrom[d] + (yTo[d] - yFrom[d]) * t * t * (3 - 2 * t);
        }
      }
      if (u >= 1.6) {
        colors[j] = b[j];
        colors[j + 1] = b[j + 1];
        colors[j + 2] = b[j + 2];
        continue;
      }
      if (u <= -0.6) {
        colors[j] = a[j];
        colors[j + 1] = a[j + 1];
        colors[j + 2] = a[j + 2];
        continue;
      }
      const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
      const k = t * t * (3 - 2 * t);
      // Lichtsaum: am hellsten knapp hinter der Front, weich nach beiden Seiten auslaufend.
      const e = (u - 0.5) / 1.1;
      const lift = glow > 0 ? glow * Math.max(0, 1 - e * e) : 0;
      const gain = 1 + lift;
      const add = lift * 0.12;
      colors[j] = (a[j] + (b[j] - a[j]) * k) * gain + add;
      colors[j + 1] = (a[j + 1] + (b[j + 1] - a[j + 1]) * k) * gain + add;
      colors[j + 2] = (a[j + 2] + (b[j + 2] - a[j + 2]) * k) * gain + add * 0.8;
    }
    if (morph) this.mesh.geometry.getAttribute('position').needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

/**
 * Mittelpunkt eines Feldes in Weltkoordinaten.
 * @param {number} tx
 * @param {number} tz
 * @param {number} width Felder in X
 * @param {number} height Felder in Z
 * @param {{ x: number, z: number }} out
 */
export function tileCenter(tx, tz, width, height, out) {
  out.x = tx - width / 2 + 0.5;
  out.z = tz - height / 2 + 0.5;
  return out;
}
