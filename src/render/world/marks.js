// @ts-check
// Bodenzeichen der besonderen Bauplätze (Anhöhe, Kraftquelle, Taktstein, Sumpf). Alle Zeichen einer Karte bilden EIN Netz
// mit Vertexfarben (gemeinsames mattes Material) und ein kleines Netz für das Leuchtende (gemeinsames Leuchtmaterial).
// Die Farben folgen dem Zeitalter wie der Boden selbst: Während der Zeitwelle färbt sich jedes Zeichen genau dann um,
// wenn die Front den Boden darunter umfärbt, ohne Aufploppen.

import * as THREE from 'three';
import { MARK_ROLES, tileMarkModel } from '../../content/models/tiles.js';

/** @import { AgeDef, SpecialTileDef } from '../../types/content' */
/** @import { ModelMaterials } from '../instances.js' */
/** @import { Terrain } from '../terrain.js' */
/** @import { MapInfo } from './mapinfo.js' */

const ROLE_FIX = 0;
const ROLE_GROUND = 1;
const ROLE_SIGN = 2;
const ROLE_MUD = 3;
const ROLE_TINT = 4;
const ROLE_SOIL = 5;
const ROLE_ACCENT = 6;
const ROLE_ROCK = 7;
/** Aufhellung der Farbakzente in dunklen Zeitaltern (die Nacht der Zukunft): sie wirken dort wie Neon. */
const ACCENT_GAIN = /** @type {Record<string, number>} */ ({ zukunft: 2.2, industrie: 1.3 });
/** Wie stark die getönte Fläche zur Farbe der Art gezogen wird, je Art. */
const TINT = /** @type {Record<string, number>} */ ({ sumpf: 0.7, hoehe: 0.3 });
const TINT_DEFAULT = 0.42;

/** Werkstoff der kleinen Zeichen je Zeitalter (Feldstein, Marmor, Holz, Holz, Eisen, Metall). Sonst die helle Wegkante. */
const SIGN_COLORS = /** @type {Record<string, string>} */ ({
  steinzeit: '#a89e8e',
  rom: '#f1eadc',
  mittelalter: '#a27d56',
  entdecker: '#ab855b',
  industrie: '#7d7880',
  zukunft: '#bcc8dc',
});

const colorA = new THREE.Color();
const colorB = new THREE.Color();
const colorK = new THREE.Color();
const vec = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const quat = new THREE.Quaternion();

/**
 * @typedef {object} MarkTile
 * @property {number} tx
 * @property {number} tz
 * @property {string} kind
 * @property {number} mix Mischwert des Bodens (groundA/groundB) auf dem Feld
 * @property {number} gain Helligkeitsfaktor des Bodens auf dem Feld
 * @property {THREE.Color} color Farbe der Art (linear)
 * @property {number} phase Versatz der Leuchtanimation
 */

export class SpecialMarks {
  /** @param {ModelMaterials} materials */
  constructor(materials) {
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.name = 'special-tiles';
    /** @type {THREE.Mesh | null} */
    this.matte = null;
    /** @type {THREE.Mesh | null} */
    this.glow = null;
    /** @type {MarkTile[]} */
    this.tiles = [];
    this.reduced = false;
    /** @type {MapInfo | null} */
    this.info = null;
    /** @type {Terrain | null} */
    this.terrain = null;
    /** @type {Record<string, SpecialTileDef>} */
    this.defs = {};

    // Je Vertex des matten Netzes: Grundfarbe aus dem Modell, Rolle, Feld; dazu die zwischengespeicherten Farben zweier Zeitalter.
    this.base = new Float32Array(0);
    this.role = new Uint8Array(0);
    this.tileOf = new Uint16Array(0);
    this.positions = new Float32Array(0);
    this.colors = new Float32Array(0);
    this._to = new Float32Array(0);
    this._from = new Float32Array(0);
    /** @type {AgeDef | null} */
    this._toAge = null;
    /** @type {AgeDef | null} */
    this._fromAge = null;
    // Leuchtendes: Grundfarbe und Feld je Vertex.
    this.glowBase = new Float32Array(0);
    this.glowTile = new Uint16Array(0);
    this.glowColors = new Float32Array(0);

    /** Hervorhebung je Feld (0..1, weich nachgeführt) und Ziel. */
    this.hover = new Float32Array(0);
    this.hoverTarget = -1;
    this.hoverMoving = false;
    /** Zuletzt gesetzte Färbung, um sie bei Hervorhebung erneut anzuwenden. @type {{ to: AgeDef | null, from: AgeDef | null, wave: { x: number, z: number, radius: number, softness?: number, glow?: number } | null }} */
    this.last = { to: null, from: null, wave: null };
  }

  /**
   * Baut die Zeichen einer Karte.
   * @param {MapInfo} info
   * @param {Terrain} terrain
   * @param {Record<string, SpecialTileDef> | undefined} defs `content.balance.tiles`
   */
  build(info, terrain, defs) {
    this.info = info;
    this.terrain = terrain;
    this.defs = defs ?? {};
    this._rebuild();
  }

  /** Grafikstufe 'low': schlichtere Zeichen. @param {boolean} reduced */
  setReduced(reduced) {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (this.info) {
      this._rebuild();
      if (this.last.to) this.setPalette(this.last.to, this.last.from ?? undefined, this.last.wave ?? undefined);
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
  }

  _rebuild() {
    this._clear();
    const info = this.info;
    const terrain = this.terrain;
    if (!info || !terrain) return;
    /** @type {MarkTile[]} */
    const tiles = [];
    /** @type {{ tile: number, spec: import('../../types/model').ModelSpec, yaw: number }[]} */
    const placed = [];
    for (const s of info.special) {
      const def = this.defs[s.kind];
      const color = def?.color ?? '#ffffff';
      const tone = terrain.groundTone(s.tx, s.tz);
      // Jedes Feld um eine zufällige Vierteldrehung verdreht: Ecken bleiben Ecken, die Zeichen gleichen sich nicht aufs Haar.
      const yaw = (Math.floor(((s.tx * 73856093) ^ (s.tz * 19349663) ^ (info.map.seed | 0)) >>> 0) % 4) * (Math.PI / 2);
      tiles.push({ tx: s.tx, tz: s.tz, kind: s.kind, mix: tone.mix, gain: tone.gain, color: new THREE.Color(color), phase: (s.tx * 0.73 + s.tz * 1.31) % (Math.PI * 2) });
      placed.push({ tile: tiles.length - 1, spec: tileMarkModel(s.kind, color, this.reduced), yaw });
    }
    this.tiles = tiles;
    this.hover = new Float32Array(tiles.length);
    if (tiles.length === 0) return;

    let matteCount = 0;
    let glowCount = 0;
    for (const p of placed) {
      for (const part of p.spec.parts) {
        if (part.geometry) matteCount += part.geometry.getAttribute('position').count;
        if (part.glowGeometry) glowCount += part.glowGeometry.getAttribute('position').count;
      }
    }
    const positions = new Float32Array(matteCount * 3);
    const normals = new Float32Array(matteCount * 3);
    this.base = new Float32Array(matteCount * 3);
    this.role = new Uint8Array(matteCount);
    this.tileOf = new Uint16Array(matteCount);
    const glowPositions = new Float32Array(glowCount * 3);
    this.glowBase = new Float32Array(glowCount * 3);
    this.glowTile = new Uint16Array(glowCount);

    let mi = 0;
    let gi = 0;
    for (const p of placed) {
      const t = info.special[p.tile];
      quat.setFromAxisAngle(UP, p.yaw);
      for (const part of p.spec.parts) {
        const role = Math.max(0, MARK_ROLES.indexOf(/** @type {typeof MARK_ROLES[number]} */ (part.name)));
        for (const glow of [false, true]) {
          const g = glow ? part.glowGeometry : part.geometry;
          if (!g) continue;
          const pos = g.getAttribute('position');
          const nor = g.getAttribute('normal');
          const col = g.getAttribute('color');
          for (let i = 0; i < pos.count; i++) {
            vec.set(pos.getX(i) + part.pivot[0], pos.getY(i) + part.pivot[1], pos.getZ(i) + part.pivot[2]).applyQuaternion(quat);
            if (glow) {
              glowPositions[gi * 3] = vec.x + t.x;
              glowPositions[gi * 3 + 1] = vec.y;
              glowPositions[gi * 3 + 2] = vec.z + t.z;
              this.glowBase[gi * 3] = col.getX(i);
              this.glowBase[gi * 3 + 1] = col.getY(i);
              this.glowBase[gi * 3 + 2] = col.getZ(i);
              this.glowTile[gi] = p.tile;
              gi++;
            } else {
              positions[mi * 3] = vec.x + t.x;
              positions[mi * 3 + 1] = vec.y;
              positions[mi * 3 + 2] = vec.z + t.z;
              vec.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyQuaternion(quat);
              normals[mi * 3] = vec.x;
              normals[mi * 3 + 1] = vec.y;
              normals[mi * 3 + 2] = vec.z;
              this.base[mi * 3] = col.getX(i);
              this.base[mi * 3 + 1] = col.getY(i);
              this.base[mi * 3 + 2] = col.getZ(i);
              this.role[mi] = role;
              this.tileOf[mi] = p.tile;
              mi++;
            }
          }
        }
      }
    }
    this.positions = positions;
    this.colors = new Float32Array(matteCount * 3);
    this._to = new Float32Array(matteCount * 3);
    this._from = new Float32Array(matteCount * 3);
    this._toAge = null;
    this._fromAge = null;

    if (matteCount > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      const color = new THREE.BufferAttribute(this.colors, 3);
      color.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('color', color);
      geometry.computeBoundingSphere();
      this.matte = new THREE.Mesh(geometry, this.materials.matte);
      this.matte.name = 'special-tiles:matte';
      this.matte.castShadow = true;
      this.matte.receiveShadow = true;
      this.group.add(this.matte);
    }
    if (glowCount > 0) {
      this.glowColors = new Float32Array(glowCount * 3);
      this.glowColors.set(this.glowBase);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
      const color = new THREE.BufferAttribute(this.glowColors, 3);
      color.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('color', color);
      geometry.computeBoundingSphere();
      this.glow = new THREE.Mesh(geometry, this.materials.glow);
      this.glow.name = 'special-tiles:glow';
      this.group.add(this.glow);
    }
  }

  /**
   * Farben aller Vertices im Kleid eines Zeitalters.
   * @param {AgeDef} age
   * @param {Float32Array} out
   */
  _fill(age, out) {
    const p = age.terrain;
    const sign = colorK.set(SIGN_COLORS[age.id] ?? p.pathEdge);
    const sr = sign.r;
    const sg = sign.g;
    const sb = sign.b;
    colorB.set(p.soil);
    const or = colorB.r;
    const og = colorB.g;
    const ob = colorB.b;
    colorB.set(p.rock);
    const kr = colorB.r;
    const kg = colorB.g;
    const kb = colorB.b;
    colorA.set(p.groundA);
    colorB.set(p.groundB);
    // Je Feld: Boden und nasser Grund.
    const n = this.tiles.length;
    const ground = new Float32Array(n * 3);
    const mud = new Float32Array(n * 3);
    const tint = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) {
      const t = this.tiles[j];
      const r = (colorA.r + (colorB.r - colorA.r) * t.mix) * t.gain;
      const g = (colorA.g + (colorB.g - colorA.g) * t.mix) * t.gain;
      const b = (colorA.b + (colorB.b - colorA.b) * t.mix) * t.gain;
      ground[j * 3] = r;
      ground[j * 3 + 1] = g;
      ground[j * 3 + 2] = b;
      // Nass und dunkel, zur Farbe der Art gezogen; auf dunklem Boden (Nacht) nicht noch dunkler als dieser.
      const k = 0.5;
      mud[j * 3] = Math.max(r * 0.55, (r * 0.62 * (1 - k) + t.color.r * 0.5 * k));
      mud[j * 3 + 1] = Math.max(g * 0.55, (g * 0.62 * (1 - k) + t.color.g * 0.5 * k) * 0.92);
      mud[j * 3 + 2] = Math.max(b * 0.55, (b * 0.62 * (1 - k) + t.color.b * 0.5 * k) * 0.92);
      const w = TINT[t.kind] ?? TINT_DEFAULT;
      tint[j * 3] = r + (t.color.r - r) * w;
      tint[j * 3 + 1] = g + (t.color.g - g) * w;
      tint[j * 3 + 2] = b + (t.color.b - b) * w;
    }
    const base = this.base;
    const count = this.role.length;
    const accent = ACCENT_GAIN[age.id] ?? 1;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const role = this.role[i];
      if (role === ROLE_FIX || role === ROLE_ACCENT) {
        const k = role === ROLE_ACCENT ? accent : 1;
        out[j] = base[j] * k;
        out[j + 1] = base[j + 1] * k;
        out[j + 2] = base[j + 2] * k;
      } else if (role === ROLE_SOIL) {
        // Erde, ein wenig zur Farbe der Art gezogen und nie dunkler als der Boden daneben (Nacht der Zukunft).
        const t = this.tileOf[i];
        const c = this.tiles[t].color;
        const t3 = t * 3;
        out[j] = base[j] * Math.max(or + (c.r - or) * 0.2, ground[t3] * 0.9);
        out[j + 1] = base[j + 1] * Math.max(og + (c.g - og) * 0.2, ground[t3 + 1] * 0.9);
        out[j + 2] = base[j + 2] * Math.max(ob + (c.b - ob) * 0.2, ground[t3 + 2] * 0.9);
      } else if (role === ROLE_ROCK) {
        // Fels, nie dunkler als der Boden daneben.
        const t3 = this.tileOf[i] * 3;
        out[j] = base[j] * Math.max(kr, ground[t3] * 1.1);
        out[j + 1] = base[j + 1] * Math.max(kg, ground[t3 + 1] * 1.1);
        out[j + 2] = base[j + 2] * Math.max(kb, ground[t3 + 2] * 1.1);
      } else if (role === ROLE_SIGN) {
        out[j] = base[j] * sr;
        out[j + 1] = base[j + 1] * sg;
        out[j + 2] = base[j + 2] * sb;
      } else {
        const src = role === ROLE_MUD ? mud : role === ROLE_TINT ? tint : ground;
        const t = this.tileOf[i] * 3;
        out[j] = base[j] * src[t];
        out[j + 1] = base[j + 1] * src[t + 1];
        out[j + 2] = base[j + 2] * src[t + 2];
      }
    }
  }

  /**
   * Färbt die Zeichen. Mit `from` und `wave` wie Terrain.setPalette: innerhalb des Wellenradius gilt bereits `to`.
   * @param {AgeDef} to
   * @param {AgeDef} [from]
   * @param {{ x: number, z: number, radius: number, softness?: number, glow?: number }} [wave]
   */
  setPalette(to, from, wave) {
    this.last.to = to;
    this.last.from = from ?? null;
    this.last.wave = wave ?? null;
    if (!this.matte) return;
    const colors = this.colors;
    if (this._toAge !== to) {
      this._fill(to, this._to);
      this._toAge = to;
    }
    const n = this.role.length;
    const hover = this.hover;
    const tileOf = this.tileOf;
    if (!from || !wave) {
      const b = this._to;
      for (let i = 0; i < n; i++) {
        const k = 1 + hover[tileOf[i]] * 0.32;
        const j = i * 3;
        colors[j] = b[j] * k;
        colors[j + 1] = b[j + 1] * k;
        colors[j + 2] = b[j + 2] * k;
      }
    } else {
      if (this._fromAge !== from) {
        this._fill(from, this._from);
        this._fromAge = from;
      }
      const a = this._from;
      const b = this._to;
      const pos = this.positions;
      const soft = wave.softness ?? 1.5;
      const glow = wave.glow ?? 0;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        const dx = pos[j] - wave.x;
        const dz = pos[j + 2] - wave.z;
        // Dieselbe Rechnung wie für den Boden (terrain.js), damit Zeichen und Boden im Gleichschritt umfärben.
        const u = (wave.radius - Math.sqrt(dx * dx + dz * dz)) / soft;
        const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
        const k = t * t * (3 - 2 * t);
        const e = (u - 0.5) / 1.1;
        const lift = glow > 0 && u > -0.6 && u < 1.6 ? glow * Math.max(0, 1 - e * e) : 0;
        const gain = (1 + lift) * (1 + hover[tileOf[i]] * 0.32);
        const add = lift * 0.12;
        colors[j] = (a[j] + (b[j] - a[j]) * k) * gain + add;
        colors[j + 1] = (a[j + 1] + (b[j + 1] - a[j + 1]) * k) * gain + add;
        colors[j + 2] = (a[j + 2] + (b[j + 2] - a[j + 2]) * k) * gain + add * 0.8;
      }
    }
    const attr = this.matte.geometry.getAttribute('color');
    attr.needsUpdate = true;
  }

  /**
   * Hebt das Zeichen auf einem Feld sanft hervor (z. B. solange der Zeiger darüber steht); null oder ein gewöhnliches Feld
   * nimmt die Hervorhebung zurück.
   * @param {number} tx
   * @param {number} tz
   */
  setHover(tx, tz) {
    const index = this.tiles.findIndex((t) => t.tx === tx && t.tz === tz);
    if (index === this.hoverTarget) return;
    this.hoverTarget = index;
    this.hoverMoving = true;
  }

  /**
   * Leuchtanimation und Hervorhebung.
   * @param {number} time Uhr der Welt
   * @param {number} dt
   * @param {boolean} waving true, solange eine Zeitwelle die Farben ohnehin in jedem Bild setzt
   */
  update(time, dt, waving) {
    if (this.hoverMoving) {
      let moving = false;
      const step = Math.min(1, dt * 8);
      for (let j = 0; j < this.hover.length; j++) {
        const target = j === this.hoverTarget ? 1 : 0;
        const v = this.hover[j];
        if (v === target) continue;
        const next = v + Math.sign(target - v) * step;
        this.hover[j] = target === 1 ? Math.min(1, next) : Math.max(0, next);
        if (this.hover[j] !== target) moving = true;
      }
      this.hoverMoving = moving;
      if (!waving && this.last.to) this.setPalette(this.last.to);
    }
    if (!this.glow) return;
    // Sanftes, gemeinsames Atmen des Leuchtenden; jedes Feld etwas versetzt.
    const out = this.glowColors;
    const base = this.glowBase;
    const n = this.glowTile.length;
    for (let i = 0; i < n; i++) {
      const tile = this.glowTile[i];
      const k = (0.86 + 0.14 * Math.sin(time * 1.4 + this.tiles[tile].phase)) * (1 + this.hover[tile] * 0.3);
      const j = i * 3;
      out[j] = base[j] * k;
      out[j + 1] = base[j + 1] * k;
      out[j + 2] = base[j + 2] * k;
    }
    this.glow.geometry.getAttribute('color').needsUpdate = true;
  }

  /** Zahl der Dreiecke (für Messungen). */
  get triangles() {
    return (this.role.length + this.glowTile.length) / 3;
  }

  dispose() {
    this._clear();
    this.group.removeFromParent();
  }
}
