// @ts-check
// Das Teilchensystem der Effektschicht: EIN Vorrat für alle Teilchen, gezeichnet mit vier Zeichenaufrufen.
//   CHIP = kantige, beleuchtete Splitter, die fallen und einmal aufspringen
//   PUFF = weiche, beleuchtete Low-Poly-Wölkchen (Staub, Rauch, Dampf), die wachsen und verblassen
//   BALL = unbeleuchtete, leuchtende Low-Poly-Kugeln (Feuerball, Mündungsblitz, Energiekern)
//   GLOW = Leuchtflecken (Funken, Glut, Glitzern); landen im GlowBatch
// Der Vorrat hat eine harte Obergrenze. Ist sie fast erreicht, fallen zuerst die unwichtigen Teilchen weg, nie die Bildrate.

import * as THREE from 'three';
import { SHAPE_SOFT } from './batches.js';

/** @import { ModelMaterials } from '../instances.js' */
/** @import { GlowBatch } from './batches.js' */

export const CHIP = 0;
export const PUFF = 1;
export const BALL = 2;
export const GLOW = 3;

/**
 * Vorlage einer Teilchenart. Wird einmal auf Modulebene angelegt und beim Ausstoßen nur gelesen.
 * @typedef {object} ParticleDef
 * @property {number} kind CHIP | PUFF | BALL | GLOW
 * @property {number} life Lebensdauer in Sekunden
 * @property {number} [lifeVar] zufällige Abweichung der Lebensdauer als Anteil (0.3 = ±30 %)
 * @property {number} size Größe (Durchmesser in Feldern) am Anfang
 * @property {number} [sizeEnd] Größe am Ende (Standard = size)
 * @property {number} [sizeVar] zufällige Abweichung der Größe als Anteil
 * @property {THREE.Color | null} [color] Anfangsfarbe; null = die beim Ausstoßen übergebene Farbe
 * @property {THREE.Color | null} [colorEnd] Endfarbe; null = die beim Ausstoßen übergebene Farbe; ohne Angabe = wie die Anfangsfarbe
 * @property {number} [gain] Helligkeitsfaktor am Anfang (über 1.2 leuchtet nach)
 * @property {number} [gainEnd] Helligkeitsfaktor am Ende
 * @property {number} [alpha] Deckkraft (PUFF, GLOW)
 * @property {number} [gravity] Fallbeschleunigung in Feldern/s² (negativ = steigt)
 * @property {number} [drag] Abbremsung je Sekunde (0 = keine)
 * @property {number} [spin] Drehgeschwindigkeit in rad/s (zufälliges Vorzeichen)
 * @property {number} [solid] GLOW: 0 = additiv, 1 = deckend
 * @property {number} [shape] GLOW: SHAPE_*
 * @property {number} [stretch] GLOW: Länge des Schweifs in Sekunden Flugstrecke (0 = runder Fleck)
 * @property {boolean} [bounce] springt am Boden einmal auf und bleibt liegen (Splitter, Münzen)
 * @property {boolean} [minor] unwichtig: entfällt, sobald der Vorrat knapp wird
 */

const FLOATS = 26;
const X = 0;
const Y = 1;
const Z = 2;
const VX = 3;
const VY = 4;
const VZ = 5;
const AGE = 6;
const LIFE = 7;
const S0 = 8;
const S1 = 9;
const R0 = 10;
const G0 = 11;
const B0 = 12;
const R1 = 13;
const G1 = 14;
const B1 = 15;
const ALPHA = 16;
const GRAV = 17;
const DRAG = 18;
const ROT = 19;
const SPIN = 20;
const FLOOR = 21;
const SOLID = 22;
const SHAPE = 23;
const STRETCH = 24;
const KIND = 25;

const white = new THREE.Color(1, 1, 1);

/**
 * Geometrie ohne Index mit hellen Vertexfarben (die gemeinsamen Materialien erwarten Vertexfarben).
 * @param {THREE.BufferGeometry} source
 * @param {number} [shade] Abdunklung zur Unterseite hin (gibt unbeleuchteten Kugeln Form)
 * @param {number} [jitter] zufällige Helligkeitsabweichung je Dreieck
 * @returns {THREE.BufferGeometry}
 */
function whiteGeometry(source, shade = 0, jitter = 0) {
  const g = source.index ? source.toNonIndexed() : source;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  let face = 1;
  for (let i = 0; i < position.count; i++) {
    // Fester "Zufall" je Dreieck, damit die Geometrie bei jedem Start gleich aussieht.
    if (i % 3 === 0) face = 1 + (((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1) * jitter * 0.5;
    const v = (1 - shade * (0.5 - position.getY(i))) * face;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {number} capacity
 * @param {string} name
 * @returns {THREE.InstancedMesh}
 */
function makeMesh(geometry, material, capacity, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  return mesh;
}

/**
 * @param {THREE.BufferAttribute} attr
 * @param {number} count
 */
function upload(attr, count) {
  if (count === 0) return;
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}

export class ParticleSystem {
  /**
   * @param {ModelMaterials} materials
   * @param {GlowBatch} glow
   * @param {number} capacity Größter Vorrat (höchste Grafikstufe)
   */
  constructor(materials, glow, capacity) {
    this.capacity = capacity;
    /** Aktuelle Obergrenze (je nach Grafikstufe), höchstens `capacity`. */
    this.budget = capacity;
    /** Anteil 0..1 der tatsächlich ausgestoßenen Teilchen (ausgedünnt bei hohem Spieltempo und großem Andrang). */
    this.density = 1;
    /** Bodenhöhe für Splitter, die nach dieser Zuweisung ausgestoßen werden. */
    this.floor = 0;
    this.count = 0;
    /** Zähler je Art im letzten Bild. */
    this.drawn = [0, 0, 0, 0];
    this.data = new Float32Array(capacity * FLOATS);
    this.glow = glow;
    this.group = new THREE.Group();
    this.group.name = 'fx:particles';

    this.chipGeometry = whiteGeometry(new THREE.TetrahedronGeometry(0.5, 0));
    this.ballGeometry = whiteGeometry(new THREE.IcosahedronGeometry(0.5, 1), 0.38, 0.14);
    this.puffGeometry = whiteGeometry(new THREE.IcosahedronGeometry(0.5, 1));
    this.puffAlpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.puffAlpha.setUsage(THREE.DynamicDrawUsage);
    this.puffGeometry.setAttribute('instAlpha', this.puffAlpha);

    // Wölkchen: beleuchtet wie alle Modelle, aber durchscheinend mit einer Deckkraft je Exemplar.
    this.puffMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, depthWrite: false });
    this.puffMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float instAlpha;\nvarying float vInstAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstAlpha = instAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vInstAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vInstAlpha;');
    };

    this.chips = makeMesh(this.chipGeometry, materials.matte, capacity, 'fx:chips');
    this.balls = makeMesh(this.ballGeometry, materials.glow, capacity, 'fx:balls');
    this.puffs = makeMesh(this.puffGeometry, this.puffMaterial, capacity, 'fx:puffs');
    this.puffs.renderOrder = 20;
    this.group.add(this.chips, this.balls, this.puffs);
  }

  /**
   * Rundet eine gewünschte Teilchenzahl gemäß der aktuellen Dichte (zufällig, damit auch kleine Zahlen im Mittel stimmen).
   * @param {number} n
   * @returns {number}
   */
  amount(n) {
    const v = n * this.density;
    const whole = Math.floor(v);
    return whole + (Math.random() < v - whole ? 1 : 0);
  }

  /**
   * Stößt ein Teilchen aus.
   * @param {ParticleDef} def
   * @param {number} x @param {number} y @param {number} z
   * @param {number} vx @param {number} vy @param {number} vz
   * @param {THREE.Color | null} [color] Farbe für Vorlagen ohne eigene Farbe
   * @param {number} [scale] Größenfaktor
   * @returns {boolean} false, wenn der Vorrat erschöpft ist
   */
  emit(def, x, y, z, vx, vy, vz, color = null, scale = 1) {
    const n = this.count;
    if (n >= this.budget) return false;
    if (def.minor && n > this.budget * 0.7) return false;
    this.count = n + 1;
    const d = this.data;
    const k = n * FLOATS;
    const sizeVar = def.sizeVar ? 1 + (Math.random() * 2 - 1) * def.sizeVar : 1;
    const c0 = def.color ?? color ?? white;
    const c1 = def.colorEnd === undefined ? c0 : (def.colorEnd ?? color ?? c0);
    const g0 = def.gain ?? 1;
    const g1 = def.gainEnd ?? g0;
    d[k + X] = x;
    d[k + Y] = y;
    d[k + Z] = z;
    d[k + VX] = vx;
    d[k + VY] = vy;
    d[k + VZ] = vz;
    d[k + AGE] = 0;
    d[k + LIFE] = def.life * (def.lifeVar ? 1 + (Math.random() * 2 - 1) * def.lifeVar : 1);
    d[k + S0] = def.size * sizeVar * scale;
    d[k + S1] = (def.sizeEnd ?? def.size) * sizeVar * scale;
    d[k + R0] = c0.r * g0;
    d[k + G0] = c0.g * g0;
    d[k + B0] = c0.b * g0;
    d[k + R1] = c1.r * g1;
    d[k + G1] = c1.g * g1;
    d[k + B1] = c1.b * g1;
    d[k + ALPHA] = def.alpha ?? 1;
    d[k + GRAV] = def.gravity ?? 0;
    d[k + DRAG] = def.drag ?? 0;
    d[k + ROT] = Math.random() * 6.283;
    d[k + SPIN] = (def.spin ?? 0) * (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8);
    d[k + FLOOR] = def.bounce ? this.floor : -1e9;
    d[k + SOLID] = def.solid ?? 0;
    d[k + SHAPE] = def.shape ?? SHAPE_SOFT;
    d[k + STRETCH] = def.stretch ?? 0;
    d[k + KIND] = def.kind;
    return true;
  }

  /**
   * Schreibt alle Teilchen um `dt` fort und befüllt die Zeichenstapel. Leuchtflecken landen im GlowBatch,
   * der dafür bereits mit begin() geöffnet sein muss.
   * @param {number} dt
   */
  update(dt) {
    const d = this.data;
    const glow = this.glow;
    const chipM = this.chips.instanceMatrix.array;
    const chipC = /** @type {THREE.InstancedBufferAttribute} */ (this.chips.instanceColor).array;
    const ballM = this.balls.instanceMatrix.array;
    const ballC = /** @type {THREE.InstancedBufferAttribute} */ (this.balls.instanceColor).array;
    const puffM = this.puffs.instanceMatrix.array;
    const puffC = /** @type {THREE.InstancedBufferAttribute} */ (this.puffs.instanceColor).array;
    const puffA = this.puffAlpha.array;
    let nChip = 0;
    let nBall = 0;
    let nPuff = 0;
    let nGlow = 0;
    let n = this.count;
    for (let i = 0; i < n; i++) {
      const k = i * FLOATS;
      const age = d[k + AGE] + dt;
      const life = d[k + LIFE];
      if (age >= life) {
        // Letztes Teilchen an diese Stelle holen und noch einmal prüfen.
        n--;
        if (i < n) d.copyWithin(k, n * FLOATS, (n + 1) * FLOATS);
        i--;
        continue;
      }
      d[k + AGE] = age;
      const t = age / life;
      const kind = d[k + KIND];
      // Bewegung
      const drag = d[k + DRAG];
      if (drag > 0) {
        const f = Math.max(0, 1 - drag * dt);
        d[k + VX] *= f;
        d[k + VY] *= f;
        d[k + VZ] *= f;
      }
      d[k + VY] -= d[k + GRAV] * dt;
      let x = d[k + X] + d[k + VX] * dt;
      let y = d[k + Y] + d[k + VY] * dt;
      let z = d[k + Z] + d[k + VZ] * dt;
      if (y < d[k + FLOOR] && d[k + VY] < 0) {
        // Einmal weich aufspringen, dann liegen bleiben.
        y = d[k + FLOOR];
        d[k + VY] *= -0.38;
        d[k + VX] *= 0.55;
        d[k + VZ] *= 0.55;
        d[k + SPIN] *= 0.5;
        if (d[k + VY] < 0.5) {
          d[k + VY] = 0;
          d[k + GRAV] = 0;
          d[k + VX] = 0;
          d[k + VZ] = 0;
          d[k + SPIN] = 0;
        }
      }
      d[k + X] = x;
      d[k + Y] = y;
      d[k + Z] = z;
      const rot = d[k + ROT] + d[k + SPIN] * dt;
      d[k + ROT] = rot;
      // Farbe
      const r = d[k + R0] + (d[k + R1] - d[k + R0]) * t;
      const g = d[k + G0] + (d[k + G1] - d[k + G0]) * t;
      const b = d[k + B0] + (d[k + B1] - d[k + B0]) * t;
      const grow = 1 - (1 - t) * (1 - t) * (1 - t);

      if (kind === GLOW) {
        const size = d[k + S0] + (d[k + S1] - d[k + S0]) * t;
        const fade = Math.min(1, age / 0.04) * (1 - t * t);
        const stretch = d[k + STRETCH];
        if (stretch > 0) {
          glow.streak(x, y, z, x - d[k + VX] * stretch, y - d[k + VY] * stretch, z - d[k + VZ] * stretch, size, r, g, b, d[k + ALPHA] * fade, d[k + SOLID], d[k + SHAPE]);
        } else {
          glow.streak(x, y, z, x, y, z, size, r, g, b, d[k + ALPHA] * fade, d[k + SOLID], d[k + SHAPE]);
        }
        nGlow++;
        continue;
      }

      /** @type {ArrayLike<number> & { [n: number]: number }} */
      let m;
      let c;
      let o;
      let s;
      if (kind === CHIP) {
        s = d[k + S0] * (t < 0.7 ? Math.min(1, age / 0.04) : (1 - t) / 0.3);
        m = chipM;
        c = chipC;
        o = nChip++;
      } else if (kind === BALL) {
        // Schnell aufblähen, im letzten Drittel in sich zusammenfallen.
        const shrink = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
        s = (d[k + S0] + (d[k + S1] - d[k + S0]) * grow) * shrink * (2 - shrink);
        m = ballM;
        c = ballC;
        o = nBall++;
      } else {
        s = d[k + S0] + (d[k + S1] - d[k + S0]) * grow;
        const fade = Math.min(1, age / 0.06) * (1 - t) * (1 - t) * (1 + 2 * t);
        puffA[nPuff] = d[k + ALPHA] * fade;
        m = puffM;
        c = puffC;
        o = nPuff++;
      }
      // Matrix: Drehung um Y (und bei Splittern zusätzlich um X) mal Größe.
      const cy = Math.cos(rot) * s;
      const sy = Math.sin(rot) * s;
      const o16 = o * 16;
      if (kind === CHIP) {
        const a = rot * 0.7;
        const cx = Math.cos(a);
        const sx = Math.sin(a);
        // R = Ry(rot) * Rx(a), spaltenweise
        m[o16] = cy;
        m[o16 + 1] = 0;
        m[o16 + 2] = -sy;
        m[o16 + 4] = sy * sx;
        m[o16 + 5] = cx * s;
        m[o16 + 6] = cy * sx;
        m[o16 + 8] = sy * cx;
        m[o16 + 9] = -sx * s;
        m[o16 + 10] = cy * cx;
      } else {
        m[o16] = cy;
        m[o16 + 1] = 0;
        m[o16 + 2] = -sy;
        m[o16 + 4] = 0;
        m[o16 + 5] = kind === PUFF ? s * 0.86 : s;
        m[o16 + 6] = 0;
        m[o16 + 8] = sy;
        m[o16 + 9] = 0;
        m[o16 + 10] = cy;
      }
      m[o16 + 3] = 0;
      m[o16 + 7] = 0;
      m[o16 + 11] = 0;
      m[o16 + 12] = x;
      m[o16 + 13] = y;
      m[o16 + 14] = z;
      m[o16 + 15] = 1;
      const o3 = o * 3;
      c[o3] = r;
      c[o3 + 1] = g;
      c[o3 + 2] = b;
    }
    this.count = n;
    this.drawn[CHIP] = nChip;
    this.drawn[PUFF] = nPuff;
    this.drawn[BALL] = nBall;
    this.drawn[GLOW] = nGlow;
    this._finish(this.chips, nChip);
    this._finish(this.balls, nBall);
    this._finish(this.puffs, nPuff);
    upload(this.puffAlpha, nPuff);
  }

  /**
   * @param {THREE.InstancedMesh} mesh
   * @param {number} count
   */
  _finish(mesh, count) {
    mesh.count = count;
    mesh.visible = count > 0;
    upload(mesh.instanceMatrix, count);
    upload(/** @type {THREE.InstancedBufferAttribute} */ (mesh.instanceColor), count);
  }

  clear() {
    this.count = 0;
    for (const mesh of [this.chips, this.balls, this.puffs]) {
      mesh.count = 0;
      mesh.visible = false;
    }
  }

  dispose() {
    this.group.remove(this.chips, this.balls, this.puffs);
    this.chips.dispose();
    this.balls.dispose();
    this.puffs.dispose();
    this.chipGeometry.dispose();
    this.ballGeometry.dispose();
    this.puffGeometry.dispose();
    this.puffMaterial.dispose();
  }
}
