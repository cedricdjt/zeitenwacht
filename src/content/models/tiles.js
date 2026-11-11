// @ts-check
// Bodenzeichen der besonderen Bauplätze (docs/briefs/fusion.md, Abschnitt 6): je Art ein kleines Modell, das genau ein Feld
// (Mitte im Ursprung, ±0,5) bedeckt. Die Welt fügt alle Zeichen einer Karte zu einem Netz zusammen und färbt es je Zeitalter um.
//
// Die Teile tragen Rollen statt fester Farben:
//   'fix'    feste Farbe (Farbe der Art, Wasser, Schilf); Leuchtendes nur hier
//   'ground' Weiß bzw. ein Tönungsfaktor, malgenommen mit dem Boden des Zeitalters an diesem Feld
//   'sign'   Weiß bzw. Tönungsfaktor, malgenommen mit dem Werkstoff des Zeitalters (Feldstein, Marmor, Holz, Metall)
//   'mud'    nasser, dunkler Grund: Boden des Zeitalters, zur Farbe des Sumpfs gezogen und abgedunkelt
//   'soil'   Erde des Zeitalters (wie die Flanken der Insel)
//   'rock'   Fels des Zeitalters (wie die Felswände der Insel)
//   'accent' Farbe der Art; in dunklen Zeitaltern heller (die Welt hebt sie an, damit sie nachts leuchtet wie Neon)
//   'tint'   Boden des Zeitalters, deutlich zur Farbe der Art gezogen (ruhige Fläche in der Farbe der Art)
//
// Lesbar auch mit Turm: Ein Turmsockel deckt etwa einen Kreis von 0,45 um die Mitte; was die Art verrät, steht deshalb
// zusätzlich in den Ecken des Feldes. Form unterscheidet die Arten auch ohne Farbe: Bergspitzen (Anhöhe), leuchtende
// Kristalle (Kraftquelle), aufrechte Steinpfosten im Kreis (Taktstein), Schilfhalme mit Kolben (Sumpf).

import { createModel } from '../../render/kit.js';

/** @import { ModelBuilder } from '../../render/kit.js' */
/** @import { ColorLike, ModelSpec } from '../../types/model' */

/** Die Rollen der Teile in der Reihenfolge, in der die Welt sie nummeriert. */
export const MARK_ROLES = /** @type {const} */ (['fix', 'ground', 'sign', 'mud', 'tint', 'soil', 'accent', 'rock']);

const Q = Math.PI / 4;
/** Drehung, die ein Achteck mit seg 8 mit geraden Seiten an den Feldkanten ausrichtet. */
const OCT = Math.PI / 8;

/** Die vier Ecken eines Feldes (Vorzeichen). @type {[number, number][]} */
const CORNERS = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

/**
 * Anhöhe: zwei flache Absätze wie Höhenlinien, die das Feld scheinbar anheben (Flanken in der Erde des Zeitalters,
 * oben sein Boden mit einem Hauch Himmelblau), in den Ecken kleine Berggipfel im Fels des Zeitalters mit himmelblauer Kuppe.
 * @param {ModelBuilder} m
 * @param {ColorLike} color
 * @param {boolean} reduced
 */
function hoehe(m, color, reduced) {
  const accent = m.part('accent');
  const tint = m.part('tint');
  const rock = m.part('rock');
  const soil = m.part('soil');
  // Zwei runde Absätze wie Höhenlinien: Flanken in der Erde des Zeitalters, oben sein Boden, zur Mitte sanft gewölbt.
  soil.cyl({ r: 0.54, rTop: 0.52, h: 0.045, seg: 8, base: [0, 0, 0], rot: [0, OCT, 0], color: '#ffffff', shade: 0.3, faceJitter: 0.05 });
  tint.cyl({ r: 0.521, h: 0.004, seg: 8, base: [0, 0.043, 0], rot: [0, OCT, 0], color: '#f4f8fb', shade: 0 });
  soil.cyl({ r: 0.35, rTop: 0.335, h: 0.04, seg: 10, base: [0, 0.045, 0], rot: [0, 0.3, 0], color: '#ffffff', shade: 0.3, faceJitter: 0.05 });
  tint.lathe({ points: [[0.336, 0], [0.22, 0.016], [0, 0.022]], seg: 10, base: [0, 0.083, 0], rot: [0, 0.3, 0], color: '#ffffff', shade: 0.08 });
  // Gipfel in den Ecken: groß und klein im Wechsel, mit blauer Kuppe.
  CORNERS.forEach(([sx, sz], i) => {
    const big = i % 2 === 0;
    const h = big ? 0.42 : 0.3;
    const r = big ? 0.13 : 0.105;
    const x = sx * 0.405;
    const z = sz * 0.405;
    const yaw = i * 0.7;
    rock.cone({ r, h: h * 0.5, seg: 5, base: [x, 0, z], rot: [0, yaw, 0], color: '#ffffff', shade: 0.3, faceJitter: 0.06 });
    accent.cone({ r: r * 0.52, h: h * 0.52, seg: 5, base: [x, h * 0.48 - 0.002, z], rot: [0, yaw, 0], color, shade: 0.05 });
    if (!reduced && big) {
      // Ein kleiner Nachbargipfel macht aus der Spitze ein Gebirge.
      const ox = x - sx * 0.02 - (sz > 0 ? 0.08 : -0.08) * sx * sz;
      const oz = z - sz * 0.085;
      rock.cone({ r: 0.065, h: 0.1, seg: 5, base: [ox, 0, oz], rot: [0, yaw + 1, 0], color: '#ffffff', shade: 0.3, faceJitter: 0.06 });
      accent.cone({ r: 0.026, h: 0.05, seg: 5, base: [ox, 0.098, oz], rot: [0, yaw + 1, 0], color, shade: 0.05 });
    }
  });
}

/**
 * Kraftquelle: rosa getönter Grund, in der Mitte eine leuchtende Quelle in einer Fassung im Werkstoff des Zeitalters,
 * in den Ecken leuchtende Kristalle.
 * @param {ModelBuilder} m
 * @param {ColorLike} color
 * @param {boolean} reduced
 */
function quelle(m, color, reduced) {
  const fix = m.part('fix');
  const sign = m.part('sign');
  const tint = m.part('tint');
  tint.cyl({ r: 0.54, h: 0.008, seg: 8, base: [0, 0, 0], rot: [0, OCT, 0], color: '#ffffff', shade: 0 });
  // Quelle: leuchtender Spiegel in einer Fassung.
  sign.cyl({ r: 0.25, rTop: 0.23, h: 0.04, seg: 10, base: [0, 0, 0], color: '#ffffff', shade: 0.25, faceJitter: 0.04 });
  fix.cyl({ r: 0.19, h: 0.012, seg: 10, base: [0, 0.034, 0], color, glow: 1.05 });
  fix.sphere({ r: 0.07, detail: 0, at: [0, 0.06, 0], scale: [1, 0.6, 1], color: '#ffd2ea', glow: 1.2 });
  CORNERS.forEach(([sx, sz], i) => {
    const x = sx * 0.37;
    const z = sz * 0.37;
    const lean = 0.3;
    // Lange Kristalle: Doppelspitze aus zwei vierseitigen Kegeln, nach außen geneigt.
    const yaw = i * 0.4;
    fix.cone({ r: 0.065, h: 0.38, seg: 4, base: [x, 0.03, z], rot: [sz * lean, yaw, -sx * lean], color, glow: 1 });
    fix.cone({ r: 0.065, h: 0.06, seg: 4, base: [x, 0.035, z], rot: [Math.PI + sz * lean, -yaw, sx * lean], color, glow: 0.75 });
    sign.sphere({ r: 0.075, detail: 0, at: [x, 0.015, z], scale: [1.15, 0.5, 1.15], rot: [0, i, 0], color: '#ffffff', faceJitter: 0.08 });
    if (!reduced) {
      const ox = x - sx * 0.075;
      const oz = z + sz * 0.02;
      fix.cone({ r: 0.04, h: 0.22, seg: 4, base: [ox, 0.01, oz], rot: [sz * 0.55, 0.3, -sx * 0.55], color: '#f7a8d2', glow: 0.95 });
    }
  });
}

/**
 * Taktstein: eine runde Scheibe wie ein Zifferblatt im Werkstoff des Zeitalters mit hellen Strichen, darum acht
 * aufrechte Pfosten mit cremeweißer Kappe, die vier in den Ecken hoch.
 * @param {ModelBuilder} m
 * @param {ColorLike} color
 * @param {boolean} reduced
 */
function takt(m, color, reduced) {
  const accent = m.part('accent');
  const sign = m.part('sign');
  const tint = m.part('tint');
  // Zifferblatt: flache Scheibe, Rand in der Farbe der Art, Striche wie Stunden.
  tint.cyl({ r: 0.54, h: 0.008, seg: 8, base: [0, 0, 0], rot: [0, OCT, 0], color: '#ffffff', shade: 0 });
  sign.cyl({ r: 0.4, h: 0.02, seg: 16, base: [0, 0.006, 0], color: '#ffffff', shade: 0.2 });
  if (!reduced) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const r = 0.33;
      const long = k % 3 === 0;
      accent.box({ size: [0.03, 0.008, long ? 0.1 : 0.06], base: [Math.cos(a) * r, 0.024, Math.sin(a) * r], rot: [0, Math.PI / 2 - a, 0], color, shade: 0 });
    }
  }
  for (let k = 0; k < 8; k++) {
    const corner = k % 2 === 0;
    if (!corner && reduced) continue;
    const a = (k / 8) * Math.PI * 2 + Q;
    const r = corner ? 0.57 : 0.46;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = corner ? 0.34 : 0.15;
    const w = corner ? 0.12 : 0.08;
    sign.box({ size: [w, h, w * 0.8], base: [x, 0, z], rot: [0, -a, 0], color: '#ffffff', shade: 0.25, faceJitter: 0.05 });
    accent.box({ size: [w * 1.1, 0.045, w * 0.9], base: [x, h, z], rot: [0, -a, 0], color, shade: 0 });
  }
}

/**
 * Sumpf: dunkler, nasser Grund mit unruhigem Umriss und rötlich-brauner Uferkante, Pfützen, Schilf mit Kolben in drei Ecken
 * und Trittsteine bzw. Bohlen im Werkstoff des Zeitalters.
 * @param {ModelBuilder} m
 * @param {ColorLike} color
 * @param {boolean} reduced
 */
function sumpf(m, color, reduced) {
  const fix = m.part('fix');
  const mud = m.part('mud');
  const sign = m.part('sign');
  const tint = m.part('tint');
  // Unruhiger Umriss aus flachen Flecken: außen die Uferkante (zur Farbe der Art getönt), innen der nasse Grund.
  /** @type {[number, number, number, number][]} x, z, Radius, Streckung */
  const blobs = [
    [0, 0, 0.36, 1],
    [0.2, -0.16, 0.24, 1.2],
    [-0.19, 0.17, 0.25, 0.85],
    [-0.2, -0.2, 0.2, 1],
    [0.2, 0.2, 0.19, 1.1],
    [0.32, 0.31, 0.15, 1],
    [-0.31, -0.32, 0.15, 1.1],
    [-0.31, 0.3, 0.14, 0.9],
    [0.3, -0.3, 0.14, 1],
  ];
  blobs.forEach(([x, z, r, k], i) => {
    tint.cyl({ r: r + 0.055, h: 0.006, seg: 9, base: [x, 0, z], scale: [k, 1, 1 / k], rot: [0, i * 0.9, 0], color: '#ffffff', shade: 0 });
    mud.cyl({ r, h: 0.006, seg: 9, base: [x, 0.004, z], scale: [k, 1, 1 / k], rot: [0, i * 0.9, 0], color: '#ffffff', shade: 0 });
  });
  // Pfützen: helles, leicht bläuliches Wasser.
  fix.cyl({ r: 0.12, h: 0.004, seg: 9, base: [-0.1, 0.009, -0.13], scale: [1.35, 1, 0.9], color: '#a7bcc6', shade: 0 });
  fix.cyl({ r: 0.085, h: 0.004, seg: 8, base: [0.15, 0.009, 0.12], scale: [1, 1, 1.35], color: '#b2c4cb', shade: 0 });
  // Trittsteine bzw. Bohlen.
  sign.box({ size: [0.17, 0.03, 0.1], base: [0.03, 0.006, -0.03], rot: [0, 0.5, 0], color: '#ffffff', shade: 0.25, faceJitter: 0.06 });
  if (!reduced) sign.box({ size: [0.14, 0.03, 0.09], base: [-0.16, 0.006, 0.1], rot: [0, 0.2, 0], color: '#ffffff', shade: 0.25, faceJitter: 0.06 });
  // Schilf in drei Ecken.
  const reed = '#6f8443';
  const reedTop = '#b9c46e';
  const head = '#6a3f2c';
  const tufts = reduced ? [CORNERS[0], CORNERS[2]] : [CORNERS[0], CORNERS[1], CORNERS[2]];
  tufts.forEach(([sx, sz], i) => {
    const x = sx * 0.37;
    const z = sz * 0.37;
    const blades = reduced ? 4 : 6;
    for (let k = 0; k < blades; k++) {
      const a = (k / blades) * Math.PI * 2 + i;
      const ox = Math.cos(a) * 0.045;
      const oz = Math.sin(a) * 0.045;
      const h = 0.29 + ((k * 37 + i * 11) % 7) * 0.016;
      fix.cone({ r: 0.017, h, seg: 3, base: [x + ox, 0, z + oz], rot: [oz * 4, a, -ox * 4], color: reed, colorTop: reedTop });
    }
    // Rohrkolben.
    fix.capsule({ r: 0.025, h: 0.06, seg: 5, base: [x + 0.01, 0.27, z - 0.01], rot: [0.12, 0, -0.1], color: head, shade: 0.1 });
    if (!reduced) fix.capsule({ r: 0.022, h: 0.05, seg: 5, base: [x - 0.04, 0.21, z + 0.03], rot: [-0.15, 0, 0.2], color: head, shade: 0.1 });
  });
}

const BUILDERS = { hoehe, quelle, takt, sumpf };

/** @type {Map<string, ModelSpec>} */
const cache = new Map();

/**
 * Modell des Bodenzeichens einer Art. Unbekannte Arten erhalten ein schlichtes Zeichen in ihrer Farbe (vier Eckpfosten).
 * @param {string} kind Kennung der Art ('hoehe', 'quelle', 'takt', 'sumpf' ...)
 * @param {ColorLike} color Farbe der Art aus `balance.tiles[kind].color`
 * @param {boolean} reduced schlichtere Fassung für die niedrige Grafikstufe
 * @returns {ModelSpec}
 */
export function tileMarkModel(kind, color, reduced) {
  const key = `${kind}|${color}|${reduced ? 1 : 0}`;
  let spec = cache.get(key);
  if (!spec) {
    const m = createModel(`fx.tile.${kind}${reduced ? '.low' : ''}`);
    const build = /** @type {Record<string, (m: ModelBuilder, color: ColorLike, reduced: boolean) => void>} */ (BUILDERS)[kind];
    if (build) build(m, color, reduced);
    else {
      const fix = m.part('fix');
      for (const [sx, sz] of CORNERS) fix.box({ size: [0.07, 0.16, 0.07], base: [sx * 0.4, 0, sz * 0.4], color });
    }
    spec = m.build();
    cache.set(key, spec);
  }
  return spec;
}
