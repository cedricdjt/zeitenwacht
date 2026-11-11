// @ts-check
// Spuren künftiger und alter Wege: Auf einem Feld, das erst in einer späteren Stufe Weg wird, stecken kleine Zeichen am Rand
// der Spur (Steinzeit: Feldsteine; Rom und Mittelalter: Pflöcke mit Band; Zukunft: schlanke Pfosten mit leuchtender Spitze),
// auf einem alten Weg wachsen Grasbüschel ein. Alles bildet EIN mattes Netz und ein kleines Leuchtnetz (gemeinsame Materialien).
// Zeichen, die gerade nicht passen (anderes Zeitalter, anderer Zustand), sind in den Boden versenkt; beim Wechsel tauchen sie
// genau dann auf bzw. ab, wenn die Zeitwelle über ihr Feld läuft.

import * as THREE from 'three';
import { hash2 } from '../../util/noise.js';
import { PATH_FORMER, PATH_FUTURE } from '../terrain.js';

/** @import { AgeDef } from '../../types/content' */
/** @import { ModelMaterials } from '../instances.js' */
/** @import { Terrain } from '../terrain.js' */
/** @import { MapInfo } from './mapinfo.js' */

const KIND_STAKE = 0;
const KIND_RIBBON = 1;
const KIND_STONE = 2;
const KIND_TUFT = 3;
const KIND_TIP = 4;

/** Wie tief ein unpassendes Zeichen versenkt wird. */
const SINK = 0.34;

/** Art der Zeichen je Zeitalter; sonst 'stake'. */
const STYLE = /** @type {Record<string, 'stone' | 'stake' | 'beacon'>} */ ({ steinzeit: 'stone', zukunft: 'beacon', industrie: 'beacon' });
/** Werkstoff der Pflöcke je Zeitalter; sonst die helle Wegkante. */
const STAKE_COLORS = /** @type {Record<string, string>} */ ({
  rom: '#e9dcc4',
  mittelalter: '#9b7652',
  entdecker: '#a17a52',
  industrie: '#8a8590',
  zukunft: '#c8d2e4',
});
/** Farbe des Bandes am Pflock je Zeitalter. */
const RIBBON_COLORS = /** @type {Record<string, string>} */ ({ rom: '#c4553d', mittelalter: '#efe7d2', entdecker: '#d7a43c' });
/** Farbe der leuchtenden Spitze (Zukunft). */
const TIP_COLOR = new THREE.Color('#7fe6ff').multiplyScalar(1.6);

const colorA = new THREE.Color();
const colorB = new THREE.Color();

/**
 * @typedef {object} TraceSlot
 * @property {number} tile Index des Wegfeldes (Terrain.pathIndexOf)
 * @property {number} x
 * @property {number} z
 */

/**
 * Sammelt Dreiecke mit flachen Normalen.
 */
class Builder {
  constructor() {
    /** @type {number[]} */
    this.pos = [];
    /** @type {number[]} */
    this.nor = [];
    /** @type {number[]} */
    this.shade = [];
    /** @type {number[]} */
    this.kind = [];
    /** @type {number[]} */
    this.slot = [];
  }

  /**
   * @param {number[]} a @param {number[]} b @param {number[]} c
   * @param {number} kind @param {number} slot @param {number} shade
   */
  tri(a, b, c, kind, slot, shade) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.shade.push(shade);
      this.kind.push(kind);
      this.slot.push(slot);
    }
  }

  /**
   * Schräges Prisma bzw. Pyramide (rTop = 0) um (x, z).
   * @param {number} x @param {number} z @param {number} y0 @param {number} y1 @param {number} r0 @param {number} r1
   * @param {number} sides @param {number} rot @param {number} leanX @param {number} leanZ
   * @param {number} kind @param {number} slot
   */
  prism(x, z, y0, y1, r0, r1, sides, rot, leanX, leanZ, kind, slot) {
    /** @param {number} k @param {number} y @param {number} r */
    const ring = (k, y, r) => {
      const a = rot + (k / sides) * Math.PI * 2;
      const h = y - y0;
      return [x + Math.cos(a) * r + leanX * h, y, z + Math.sin(a) * r + leanZ * h];
    };
    const top = [x + leanX * (y1 - y0), y1, z + leanZ * (y1 - y0)];
    for (let k = 0; k < sides; k++) {
      const a0 = ring(k, y0, r0);
      const a1 = ring(k + 1, y0, r0);
      // Seiten etwas dunkler, je nach Richtung (gemaltes Licht von oben links).
      const shade = 0.82 + 0.12 * Math.cos(rot + ((k + 0.5) / sides) * Math.PI * 2 - 2.3);
      if (r1 <= 0) {
        this.tri(a0, top, a1, kind, slot, shade);
      } else {
        const b0 = ring(k, y1, r1);
        const b1 = ring(k + 1, y1, r1);
        this.tri(a0, b0, a1, kind, slot, shade);
        this.tri(a1, b0, b1, kind, slot, shade);
        this.tri(b0, top, b1, kind, slot, 1);
      }
    }
  }
}

export class Traces {
  /** @param {ModelMaterials} materials */
  constructor(materials) {
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'path-traces';
    /** @type {THREE.Mesh | null} */
    this.matte = null;
    /** @type {THREE.Mesh | null} */
    this.glow = null;
    this.reduced = false;
    /** @type {MapInfo | null} */
    this.info = null;
    /** @type {Terrain | null} */
    this.terrain = null;
    /** @type {readonly AgeDef[]} */
    this.ages = [];
    /** @type {TraceSlot[]} */
    this.slots = [];
    // Je Vertex: Art, Platz, Grundhelligkeit, Ruhelage (y); dazu die Sichtbarkeit zweier Zeitalter/Zustände.
    this.kind = new Uint8Array(0);
    this.slotOf = new Uint16Array(0);
    this.shade = new Float32Array(0);
    this.baseY = new Float32Array(0);
    this.positions = new Float32Array(0);
    this.colors = new Float32Array(0);
    this.glowKind = new Uint8Array(0);
    this.glowSlot = new Uint16Array(0);
    this.glowBaseY = new Float32Array(0);
    this.glowPositions = new Float32Array(0);
    this.glowColors = new Float32Array(0);
    /** Zustände je Wegfeld: jetzt und vor dem laufenden Wechsel. */
    this.state = new Uint8Array(0);
    this.stateFrom = new Uint8Array(0);
    /** @type {AgeDef | null} */
    this.age = null;
    /** @type {AgeDef | null} */
    this.ageFrom = null;
    this.triangles = 0;
    /** @type {{ to: AgeDef | null, from: AgeDef | null, wave: { x: number, z: number, radius: number, softness?: number } | null }} */
    this.last = { to: null, from: null, wave: null };
    /** Anteil des neuen Kleides je Platz (Zwischenspeicher). */
    this._k = new Float32Array(0);
    /** Farben je Art im alten und neuen Kleid (Zwischenspeicher). */
    this._cTo = Array.from({ length: KIND_TIP + 1 }, () => new THREE.Color());
    this._cFrom = Array.from({ length: KIND_TIP + 1 }, () => new THREE.Color());
  }

  /**
   * @param {MapInfo} info
   * @param {Terrain} terrain
   * @param {readonly AgeDef[]} ages
   */
  build(info, terrain, ages) {
    this.info = info;
    this.terrain = terrain;
    this.ages = ages;
    this.state = new Uint8Array(terrain.pathCount);
    this.stateFrom = new Uint8Array(terrain.pathCount);
    this._rebuild();
  }

  /** Grafikstufe 'low': ohne Grasbüschel. @param {boolean} reduced */
  setReduced(reduced) {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (this.info) {
      this._rebuild();
      this._apply();
    }
  }

  _clear() {
    for (const mesh of [this.matte, this.glow]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.matte = null;
    this.glow = null;
    this.triangles = 0;
  }

  _rebuild() {
    this._clear();
    const info = this.info;
    const terrain = this.terrain;
    if (!info || !terrain) return;
    const seed = info.map.seed | 0;
    const matte = new Builder();
    const glow = new Builder();
    /** @type {TraceSlot[]} */
    const slots = [];
    for (let p = 0; p < terrain.pathCount; p++) {
      if (terrain.pathFixed[p]) continue;
      const tx = terrain.pathTx[p];
      const tz = terrain.pathTz[p];
      const mask = info.setMask(tx, tz);
      // Zeichen nur für Zustände, die das Feld in irgendeinem Satz wirklich annimmt.
      let everFuture = false;
      let everFormer = false;
      for (let set = 0; set < info.sets.length; set++) {
        if (mask & (1 << set)) continue;
        if (mask >>> (set + 1) !== 0) everFuture = true;
        else if (mask & ((1 << set) - 1)) everFormer = true;
      }
      const cx = tx - info.width / 2 + 0.5;
      const cz = tz - info.height / 2 + 0.5;
      const links = info.links(tx, tz);
      // Die Spur läuft längs (Richtung z) oder quer; die Zeichen stehen links und rechts von ihr, leicht versetzt.
      const alongZ = (links & 5) !== 0 && (links & 10) === 0 ? true : (links & 10) !== 0 && (links & 5) === 0 ? false : (tx + tz) % 2 === 0;
      if (everFuture) {
        const flip = (tx * 3 + tz) % 2 === 0 ? 1 : -1;
        for (const side of [-1, 1]) {
          const h = hash2(tx * 2 + side, tz, seed + 61);
          const across = 0.37 + h * 0.05;
          const along = side * flip * (0.16 + h * 0.08);
          const x = cx + (alongZ ? across * side : along);
          const z = cz + (alongZ ? along : across * side);
          const slot = slots.length;
          slots.push({ tile: p, x, z });
          const rot = h * Math.PI;
          const leanX = (hash2(tx, tz * 2 + side, seed + 62) - 0.5) * 0.35;
          const leanZ = (hash2(tx + 7, tz * 2 + side, seed + 63) - 0.5) * 0.35;
          // Pflock mit Band (Rom, Mittelalter) bzw. Pfosten (Zukunft).
          matte.prism(x, z, -0.02, 0.19, 0.026, 0.02, 4, rot, leanX, leanZ, KIND_STAKE, slot);
          matte.prism(x + leanX * 0.13, z + leanZ * 0.13, 0.13, 0.165, 0.031, 0.03, 4, rot, leanX, leanZ, KIND_RIBBON, slot);
          glow.prism(x + leanX * 0.21, z + leanZ * 0.21, 0.19, 0.25, 0.026, 0, 4, rot, leanX, leanZ, KIND_TIP, slot);
          // Feldsteine (Steinzeit): ein flacher und ein kleiner daneben.
          matte.prism(x, z, -0.02, 0.045 + h * 0.02, 0.075, 0.04, 5, rot, 0, 0, KIND_STONE, slot);
          matte.prism(x + 0.08 * side, z - 0.05 * side, -0.02, 0.03, 0.04, 0.02, 5, rot + 1, 0, 0, KIND_STONE, slot);
        }
      }
      if (everFormer && !this.reduced) {
        // Grasbüschel, die in den alten Weg wachsen, eher am Rand.
        for (let k = 0; k < 3; k++) {
          const h1 = hash2(tx * 5 + k, tz * 3, seed + 71);
          const h2 = hash2(tx * 3, tz * 5 + k, seed + 72);
          const x = cx + (h1 - 0.5) * 0.78;
          const z = cz + (h2 - 0.5) * 0.78;
          const slot = slots.length;
          slots.push({ tile: p, x, z });
          for (let b = 0; b < 3; b++) {
            const a = (b / 3) * Math.PI * 2 + h1 * 3;
            matte.prism(x + Math.cos(a) * 0.025, z + Math.sin(a) * 0.025, -0.075, 0.075 + 0.04 * h2, 0.018, 0, 3, a, Math.cos(a) * 0.35, Math.sin(a) * 0.35, KIND_TUFT, slot);
          }
        }
      }
    }
    this.slots = slots;
    this._k = new Float32Array(slots.length);
    const count = matte.kind.length;
    const glowCount = glow.kind.length;
    this.triangles = (count + glowCount) / 3;
    this.kind = Uint8Array.from(matte.kind);
    this.slotOf = Uint16Array.from(matte.slot);
    this.shade = Float32Array.from(matte.shade);
    this.positions = Float32Array.from(matte.pos);
    this.baseY = new Float32Array(count);
    for (let i = 0; i < count; i++) this.baseY[i] = this.positions[i * 3 + 1];
    this.colors = new Float32Array(count * 3);
    this.glowKind = Uint8Array.from(glow.kind);
    this.glowSlot = Uint16Array.from(glow.slot);
    this.glowPositions = Float32Array.from(glow.pos);
    this.glowBaseY = new Float32Array(glowCount);
    for (let i = 0; i < glowCount; i++) this.glowBaseY[i] = this.glowPositions[i * 3 + 1];
    this.glowColors = new Float32Array(glowCount * 3);
    for (let i = 0; i < glowCount; i++) {
      this.glowColors[i * 3] = TIP_COLOR.r;
      this.glowColors[i * 3 + 1] = TIP_COLOR.g;
      this.glowColors[i * 3 + 2] = TIP_COLOR.b;
    }
    if (count > 0) {
      const geometry = new THREE.BufferGeometry();
      const position = new THREE.BufferAttribute(this.positions, 3);
      position.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', position);
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(matte.nor, 3));
      const color = new THREE.BufferAttribute(this.colors, 3);
      color.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('color', color);
      geometry.computeBoundingSphere();
      this.matte = new THREE.Mesh(geometry, this.materials.matte);
      this.matte.name = 'path-traces:matte';
      this.matte.castShadow = true;
      this.matte.receiveShadow = true;
      this.group.add(this.matte);
    }
    if (glowCount > 0) {
      const geometry = new THREE.BufferGeometry();
      const position = new THREE.BufferAttribute(this.glowPositions, 3);
      position.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', position);
      geometry.setAttribute('color', new THREE.BufferAttribute(this.glowColors, 3));
      geometry.computeBoundingSphere();
      this.glow = new THREE.Mesh(geometry, this.materials.glow);
      this.glow.name = 'path-traces:glow';
      this.group.add(this.glow);
    }
  }

  /**
   * Zustände der Wegfelder sofort setzen (Index wie Terrain.pathIndexOf).
   * @param {ArrayLike<number>} states
   */
  setStates(states) {
    this.state.set(states);
    this.stateFrom.set(states);
    this._apply();
  }

  /**
   * Wechsel der Zustände beginnen; die folgenden `setPalette` mit Welle führen ihn mit der Front aus.
   * @param {ArrayLike<number>} states
   */
  changeStates(states) {
    this.stateFrom.set(this.state);
    this.state.set(states);
  }

  /**
   * Sichtbarkeit (0 oder 1) einer Art von Zeichen in einem Zustand und Zeitalter.
   * @param {number} kind
   * @param {number} state
   * @param {AgeDef | null} age
   */
  _visible(kind, state, age) {
    if (kind === KIND_TUFT) return state === PATH_FORMER ? 1 : 0;
    if (state !== PATH_FUTURE || !age) return 0;
    const style = STYLE[age.id] ?? 'stake';
    if (kind === KIND_STONE) return style === 'stone' ? 1 : 0;
    if (kind === KIND_TIP) return style === 'beacon' ? 1 : 0;
    if (kind === KIND_RIBBON) return style === 'stake' ? 1 : 0;
    return style === 'stone' ? 0 : 1;
  }

  /**
   * Farbe einer Art von Zeichen im Kleid eines Zeitalters.
   * @param {number} kind
   * @param {AgeDef} age
   * @param {THREE.Color} out
   */
  _color(kind, age, out) {
    const p = age.terrain;
    if (kind === KIND_TUFT) {
      // Etwas frischer als der Boden ringsum, damit das Einwachsen zu lesen ist.
      out.set(p.groundB).lerp(colorB.set(p.groundA), 0.3).multiplyScalar(1.12);
    } else if (kind === KIND_STONE) {
      out.set(p.rock).lerp(colorB.set(p.pathEdge), 0.35);
    } else if (kind === KIND_RIBBON) {
      out.set(RIBBON_COLORS[age.id] ?? p.pathEdge);
    } else {
      out.set(STAKE_COLORS[age.id] ?? p.pathEdge);
    }
    return out;
  }

  /**
   * Färbt die Zeichen und setzt ihre Höhe. Mit `from` und `wave` wie Terrain.setPalette: innerhalb des Wellenradius gilt
   * bereits `to` (Zeitalter und neue Zustände).
   * @param {AgeDef} to
   * @param {AgeDef} [from]
   * @param {{ x: number, z: number, radius: number, softness?: number }} [wave]
   */
  setPalette(to, from, wave) {
    this.last.to = to;
    this.last.from = from ?? null;
    this.last.wave = wave ?? null;
    if (!from || !wave) this.stateFrom.set(this.state);
    this._apply();
  }

  _apply() {
    const to = this.last.to;
    if (!to) return;
    const from = this.last.from ?? to;
    const wave = this.last.wave;
    const slots = this.slots;
    // Je Platz der Anteil des neuen Kleides (0 = alt, 1 = neu), aus der Lage der Wellenfront.
    const k = this._k;
    k.fill(1);
    if (wave) {
      const soft = wave.softness ?? 1.5;
      for (let s = 0; s < slots.length; s++) {
        const u = (wave.radius - Math.hypot(slots[s].x - wave.x, slots[s].z - wave.z)) / soft;
        const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
        k[s] = t * t * (3 - 2 * t);
      }
    }
    const cTo = this._cTo;
    const cFrom = this._cFrom;
    for (let kind = 0; kind <= KIND_TIP; kind++) {
      this._color(kind, to, cTo[kind]);
      this._color(kind, from, cFrom[kind]);
    }
    const n = this.kind.length;
    for (let i = 0; i < n; i++) {
      const s = this.slotOf[i];
      const kind = this.kind[i];
      const tile = slots[s].tile;
      const vFrom = this._visible(kind, this.stateFrom[tile], from);
      const vTo = this._visible(kind, this.state[tile], to);
      const kk = k[s];
      const v = vFrom + (vTo - vFrom) * kk;
      this.positions[i * 3 + 1] = this.baseY[i] - (1 - v) * SINK;
      colorA.copy(cFrom[kind]).lerp(cTo[kind], kk);
      const shade = this.shade[i];
      this.colors[i * 3] = colorA.r * shade;
      this.colors[i * 3 + 1] = colorA.g * shade;
      this.colors[i * 3 + 2] = colorA.b * shade;
    }
    const g = this.glowKind.length;
    for (let i = 0; i < g; i++) {
      const s = this.glowSlot[i];
      const tile = slots[s].tile;
      const vFrom = this._visible(KIND_TIP, this.stateFrom[tile], from);
      const vTo = this._visible(KIND_TIP, this.state[tile], to);
      const v = vFrom + (vTo - vFrom) * k[s];
      this.glowPositions[i * 3 + 1] = this.glowBaseY[i] - (1 - v) * SINK;
    }
    if (this.matte) {
      this.matte.geometry.getAttribute('position').needsUpdate = true;
      this.matte.geometry.getAttribute('color').needsUpdate = true;
    }
    if (this.glow) this.glow.geometry.getAttribute('position').needsUpdate = true;
  }

  /**
   * @param {number} time Uhr der Welt
   * @param {number} dt
   * @param {boolean} waving true, solange eine Zeitwelle die Zeichen ohnehin in jedem Bild setzt
   */
  update(time, dt, waving) {
    void dt;
    void waving;
    if (!this.glow) return;
    // Die Spitzen der Zukunft pulsieren ruhig und versetzt, wie Baustellenlichter in der Nacht.
    const colors = this.glowColors;
    const g = this.glowKind.length;
    for (let i = 0; i < g; i++) {
      const s = this.glowSlot[i];
      const f = 0.7 + 0.3 * Math.max(0, Math.sin(time * 2.1 - s * 0.9));
      colors[i * 3] = TIP_COLOR.r * f;
      colors[i * 3 + 1] = TIP_COLOR.g * f;
      colors[i * 3 + 2] = TIP_COLOR.b * f;
    }
    this.glow.geometry.getAttribute('color').needsUpdate = true;
  }

  dispose() {
    this._clear();
    this.group.removeFromParent();
  }
}
