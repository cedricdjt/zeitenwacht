// @ts-check
// Weggeometrie: macht aus Wegpunkten auf dem Feldraster eine glatte Kurve mit abgerundeten Ecken.
// Reine Rechenlogik ohne Abhängigkeiten; wird von Simulation, Darstellung und Tests benutzt.

/**
 * @typedef {object} PathCurve
 * @property {Float32Array} xs Welt-X der Stützpunkte
 * @property {Float32Array} zs Welt-Z der Stützpunkte
 * @property {Float32Array} ds Aufsummierte Weglänge bis zu jedem Stützpunkt
 * @property {number} length Gesamtlänge in Feldern
 * @property {[number, number][]} tiles Alle Felder des Weges in Laufrichtung (auch solche außerhalb des Spielfelds)
 */

/**
 * @typedef {object} PathSample
 * @property {number} x
 * @property {number} z
 * @property {number} dx Laufrichtung (Einheitsvektor)
 * @property {number} dz
 */

/** Radius der abgerundeten Ecken in Feldern. */
export const CORNER_RADIUS = 0.5;
const ARC_STEPS = 8;

/**
 * Welt-X des Mittelpunkts einer Feldspalte.
 * @param {number} tx
 * @param {number} width Felder in X
 */
export function tileX(tx, width) {
  return tx - width / 2 + 0.5;
}

/**
 * Welt-Z des Mittelpunkts einer Feldzeile.
 * @param {number} tz
 * @param {number} height Felder in Z
 */
export function tileZ(tz, height) {
  return tz - height / 2 + 0.5;
}

/**
 * Feldspalte zu einer Welt-X-Koordinate (kann außerhalb des Spielfelds liegen).
 * @param {number} x
 * @param {number} width
 */
export function worldToTileX(x, width) {
  return Math.floor(x + width / 2);
}

/**
 * Feldzeile zu einer Welt-Z-Koordinate.
 * @param {number} z
 * @param {number} height
 */
export function worldToTileZ(z, height) {
  return Math.floor(z + height / 2);
}

/**
 * Alle Felder entlang der Wegpunkte, ohne Doppelte an den Ecken.
 * @param {readonly (readonly [number, number])[]} waypoints Felder [tx, tz]; aufeinanderfolgende Punkte liegen in einer Zeile oder Spalte
 * @returns {[number, number][]}
 */
export function pathTiles(waypoints) {
  if (waypoints.length < 2) throw new Error('Ein Weg braucht mindestens zwei Wegpunkte');
  /** @type {[number, number][]} */
  const tiles = [[waypoints[0][0], waypoints[0][1]]];
  for (let i = 0; i + 1 < waypoints.length; i++) {
    const [ax, az] = waypoints[i];
    const [bx, bz] = waypoints[i + 1];
    if (!Number.isInteger(ax) || !Number.isInteger(az) || !Number.isInteger(bx) || !Number.isInteger(bz)) throw new Error('Wegpunkte müssen ganzzahlige Felder sein');
    if ((ax !== bx && az !== bz) || (ax === bx && az === bz)) throw new Error(`Wegpunkte ${i} und ${i + 1} müssen in einer Zeile oder Spalte liegen und verschieden sein`);
    const sx = Math.sign(bx - ax);
    const sz = Math.sign(bz - az);
    const steps = Math.abs(bx - ax) + Math.abs(bz - az);
    for (let s = 1; s <= steps; s++) tiles.push([ax + sx * s, az + sz * s]);
  }
  return tiles;
}

/**
 * Baut die Kurve für einen Weg.
 * @param {readonly (readonly [number, number])[]} waypoints
 * @param {number} width Felder in X
 * @param {number} height Felder in Z
 * @returns {PathCurve}
 */
export function buildPath(waypoints, width, height) {
  const tiles = pathTiles(waypoints);
  /** @type {number[]} */
  const xs = [];
  /** @type {number[]} */
  const zs = [];
  const n = waypoints.length;
  /** @param {number} x @param {number} z */
  const add = (x, z) => {
    const last = xs.length - 1;
    if (last >= 0 && Math.abs(xs[last] - x) < 1e-9 && Math.abs(zs[last] - z) < 1e-9) return;
    xs.push(x);
    zs.push(z);
  };
  add(tileX(waypoints[0][0], width), tileZ(waypoints[0][1], height));
  for (let i = 1; i + 1 < n; i++) {
    const px = tileX(waypoints[i][0], width);
    const pz = tileZ(waypoints[i][1], height);
    const inX = Math.sign(waypoints[i][0] - waypoints[i - 1][0]);
    const inZ = Math.sign(waypoints[i][1] - waypoints[i - 1][1]);
    const outX = Math.sign(waypoints[i + 1][0] - waypoints[i][0]);
    const outZ = Math.sign(waypoints[i + 1][1] - waypoints[i][1]);
    if (inX === outX && inZ === outZ) continue; // gerade weiter
    if (inX === -outX && inZ === -outZ) throw new Error(`Wegpunkt ${i}: Kehrtwende auf der Stelle ist nicht erlaubt`);
    const r = CORNER_RADIUS;
    const startX = px - inX * r;
    const startZ = pz - inZ * r;
    const cx = startX + outX * r;
    const cz = startZ + outZ * r;
    // Viertelkreis um (cx, cz) von (start) nach (p + out * r).
    const a0 = Math.atan2(startZ - cz, startX - cx);
    const a1 = Math.atan2(pz + outZ * r - cz, px + outX * r - cx);
    let delta = a1 - a0;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    for (let s = 0; s <= ARC_STEPS; s++) {
      const a = a0 + (delta * s) / ARC_STEPS;
      add(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  }
  add(tileX(waypoints[n - 1][0], width), tileZ(waypoints[n - 1][1], height));

  const ds = new Float32Array(xs.length);
  for (let i = 1; i < xs.length; i++) ds[i] = ds[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  return { xs: new Float32Array(xs), zs: new Float32Array(zs), ds, length: ds[ds.length - 1], tiles };
}

/**
 * Position und Laufrichtung an einer Stelle des Weges.
 * @param {PathCurve} curve
 * @param {number} dist Zurückgelegte Strecke; wird auf [0, Länge] begrenzt
 * @param {PathSample} out
 * @returns {PathSample}
 */
export function samplePath(curve, dist, out) {
  const { xs, zs, ds } = curve;
  const d = dist <= 0 ? 0 : dist >= curve.length ? curve.length : dist;
  // Binäre Suche nach dem Abschnitt [lo, lo + 1], der d enthält.
  let lo = 0;
  let hi = ds.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ds[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = ds[hi] - ds[lo];
  const t = seg > 0 ? (d - ds[lo]) / seg : 0;
  const ex = xs[hi] - xs[lo];
  const ez = zs[hi] - zs[lo];
  const len = Math.hypot(ex, ez) || 1;
  out.x = xs[lo] + ex * t;
  out.z = zs[lo] + ez * t;
  out.dx = ex / len;
  out.dz = ez / len;
  return out;
}
