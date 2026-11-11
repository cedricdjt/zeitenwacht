// @ts-check
// Farbvarianten der Turmmodelle für die Waffen des Pools (docs/briefs/fusion.md, 12). Waffen eines Platzes teilen sich dessen
// Modell; damit man sie auf dem Spielfeld auseinanderhält, trägt die Waffe selbst (alles außer dem Sockel und den Stufenteilen)
// statt der Rollenfarbe die Akzentfarbe der Waffe. Das Band am Sockel bleibt in der Rollenfarbe: Es ist das Erkennungszeichen
// des Platzes. Umgefärbt werden nur Ecken, deren Farbton nahe an der Rollenfarbe liegt (Bemalung, Tuch, Leuchtflächen); Holz,
// Stein, Metall und Haut bleiben, wie sie sind.
//
// Kosten: Eine Variante ist ein eigenes Modell (eigene Farbpuffer, Lage- und Normalenpuffer geteilt) und damit ein eigener
// Satz Zeichenaufrufe, aber nur einer je Waffe und Zeitalter, nie einer je Turm. In einer Partie steht je Platz nur eine Waffe.

import * as THREE from 'three';

/** @import { ModelSpec, PartSpec } from '../../types/model' */
/** @import { TowerArchetypeDef } from '../../types/content' */

/** @type {Map<string, ModelSpec>} */
const cache = new Map();

/** Größter Abstand im Farbton (0..1 = ein Umlauf), bis zu dem eine Ecke als „Rollenfarbe“ gilt. */
const HUE_RANGE = 0.055;
/** Mindestsättigung einer Ecke, damit sie umgefärbt wird (Holz und Stein sind schwach gesättigt). */
const MIN_SAT = 0.42;

const hslRole = { h: 0, s: 0, l: 0 };
const hslAccent = { h: 0, s: 0, l: 0 };
const hslVertex = { h: 0, s: 0, l: 0 };
const tmp = new THREE.Color();

/**
 * Hexfarbe einer Akzentangabe.
 * @param {TowerArchetypeDef['look']} look
 * @returns {string | null}
 */
export function accentHex(look) {
  if (!look || !look.marker || look.marker === 'none') return null;
  return typeof look.accent === 'string' ? look.accent : '#' + new THREE.Color(look.accent).getHexString();
}

/**
 * Ob ein Teil das Erkennungszeichen des Platzes trägt (Sockel mit Rollenband, Stufenteile mit weiteren Bändern) und deshalb
 * unverändert bleibt.
 * @param {PartSpec} part
 * @returns {boolean}
 */
function keepsRole(part) {
  return part.name === 'base' || /^tier\d/.test(part.name);
}

/**
 * Färbt die Farbpuffer einer Geometrie um; liefert eine neue Geometrie, die Lage, Normalen und Index mit dem Original teilt,
 * oder das Original, wenn keine Ecke betroffen ist.
 * @param {THREE.BufferGeometry} geometry
 * @param {boolean} glow
 * @returns {THREE.BufferGeometry}
 */
function recolor(geometry, glow) {
  const source = /** @type {THREE.BufferAttribute} */ (geometry.getAttribute('color'));
  if (!source) return geometry;
  const src = /** @type {Float32Array} */ (source.array);
  const out = new Float32Array(src.length);
  let changed = 0;
  for (let i = 0; i < src.length; i += 3) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    // Leuchtfarben liegen über 1: zum Vergleichen auf 1 bringen, danach wieder hochrechnen.
    const peak = Math.max(r, g, b, 1e-6);
    const gain = peak > 1 ? peak : 1;
    tmp.setRGB(r / gain, g / gain, b / gain).getHSL(hslVertex);
    let dh = Math.abs(hslVertex.h - hslRole.h);
    dh = Math.min(dh, 1 - dh);
    if (dh > HUE_RANGE || hslVertex.s < MIN_SAT * (glow ? 0.6 : 1) || hslVertex.l < 0.04) continue;
    // Helligkeit relativ zur Rollenfarbe übernehmen (Schattierung und Leuchten bleiben), Farbton und Sättigung der Waffe.
    const l = Math.min(0.92, hslAccent.l * (hslVertex.l / Math.max(0.05, hslRole.l)));
    const s = Math.min(1, hslAccent.s * Math.min(1.15, hslVertex.s / Math.max(0.05, hslRole.s)));
    tmp.setHSL(hslAccent.h, s, l);
    out[i] = tmp.r * gain;
    out[i + 1] = tmp.g * gain;
    out[i + 2] = tmp.b * gain;
    changed++;
  }
  if (changed === 0) return geometry;
  const copy = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    copy.setAttribute(name, name === 'color' ? new THREE.BufferAttribute(out, 3) : geometry.getAttribute(name));
  }
  if (geometry.index) copy.setIndex(geometry.index);
  copy.boundingSphere = geometry.boundingSphere;
  copy.boundingBox = geometry.boundingBox;
  return copy;
}

/**
 * Das Turmmodell in der Farbe einer Waffe des Pools (je Modell, Rolle und Akzent einmal gebaut). Klassische Waffen (ohne
 * Zeichen) bekommen das unveränderte Modell.
 * @param {ModelSpec} spec
 * @param {TowerArchetypeDef} arch
 * @returns {ModelSpec}
 */
export function weaponVariant(spec, arch) {
  const accent = accentHex(arch.look);
  return accent ? recolorModel(spec, arch.color, accent) : spec;
}

/**
 * Das Modell mit der Rollenfarbe `role` außerhalb von Sockel und Stufenteilen in `accent` (je Modell und Farben einmal gebaut).
 * @param {ModelSpec} spec
 * @param {string} role
 * @param {string} accent
 * @returns {ModelSpec}
 */
export function recolorModel(spec, role, accent) {
  const key = `${spec.id}|${role}|${accent}`;
  const cached = cache.get(key);
  if (cached) return cached;
  tmp.set(role).getHSL(hslRole);
  tmp.set(accent).getHSL(hslAccent);
  // Sehr blasse Akzente (Leuchtfeuer, Eis) würden die Bemalung bloß ausbleichen: etwas Sättigung behalten.
  hslAccent.s = Math.max(hslAccent.s, 0.45);
  hslAccent.l = Math.min(hslAccent.l, 0.72);
  const parts = spec.parts.map((part) => {
    if (keepsRole(part)) return part;
    return {
      ...part,
      geometry: part.geometry ? recolor(part.geometry, false) : null,
      glowGeometry: part.glowGeometry ? recolor(part.glowGeometry, true) : null,
    };
  });
  /** @type {ModelSpec} */
  const variant = { ...spec, id: `${spec.id}|${accent}`, parts };
  cache.set(key, variant);
  return variant;
}
