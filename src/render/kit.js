// @ts-check
// Modell-Baukasten: setzt Low-Poly-Modelle aus eingefärbten Grundkörpern zusammen.
//
// Konventionen (gelten für ALLE Modelle im Spiel):
//   * 1 Einheit = 1 Spielfeld. Y zeigt nach oben, der Boden liegt bei y = 0.
//   * Der Modellursprung ist die Mitte der Standfläche auf dem Boden.
//   * Vorwärts ist +Z (Gegner laufen in +Z, Türme zielen in Ruhe nach +Z).
//   * Alle Koordinaten der Primitive und Drehpunkte werden im MODELLRAUM angegeben,
//     auch bei Kind-Teilen. Der Baukasten rechnet sie in das Teil-System um.
//   * Ein Modell besteht aus wenigen starren Teilen. Jedes Teil dreht sich um seinen `pivot`.
//
// Beispiel:
//   const m = createModel('enemy.demo');
//   m.part('body', { pivot: [0, 0.3, 0] })
//     .box({ size: [0.3, 0.3, 0.4], at: [0, 0.35, 0], color: '#a67c52' });
//   m.part('head', { pivot: [0, 0.5, 0.15], parent: 'body' })
//     .sphere({ r: 0.12, at: [0, 0.55, 0.2], color: '#e0b08a' });
//   return m.build({ animate(pose, ctx) { pose.head.rotation.y = Math.sin(ctx.t) * 0.3; } });

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashString, makeRng } from '../util/rng.js';

/** @import { BoxOpts, BuildOpts, CapsuleOpts, ConeOpts, CylOpts, DomeOpts, ExtrudeOpts, LatheOpts, ModelPoint, ModelSpec, PartOpts, PartSpec, PrimOpts, PyramidOpts, SphereOpts, TorusOpts, Vec3 } from '../types/model' */

const colorA = new THREE.Color();
const colorB = new THREE.Color();
const quat = new THREE.Quaternion();
const euler = new THREE.Euler();
const box3 = new THREE.Box3();

/** Standard-Helligkeitsfaktor für leuchtende Flächen. */
const GLOW_GAIN = 1.6;

/**
 * Entfernt Index und unbenutzte Attribute, damit sich alle Geometrien zusammenfügen lassen.
 * @param {THREE.BufferGeometry} geometry
 * @returns {THREE.BufferGeometry}
 */
function normalize(geometry) {
  let g = geometry;
  if (g.index) {
    g = geometry.toNonIndexed();
    geometry.dispose();
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.clearGroups();
  return g;
}

/**
 * Nicht indizierte Geometrie aus einer Dreiecksliste.
 * @param {number[]} positions
 * @returns {THREE.BufferGeometry}
 */
function fromTriangles(positions) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Spiegelt eine nicht indizierte Geometrie an der YZ-Ebene (x wird zu -x) und dreht dabei die Dreiecke um,
 * damit die Vorderseiten außen bleiben.
 * @param {THREE.BufferGeometry} source
 * @returns {THREE.BufferGeometry}
 */
function mirrorX(source) {
  const g = source.clone();
  for (const name of ['position', 'normal', 'color']) {
    const attr = /** @type {THREE.BufferAttribute | undefined} */ (g.getAttribute(name));
    if (!attr) continue;
    const a = /** @type {Float32Array} */ (attr.array);
    const flip = name !== 'color';
    for (let i = 0; i < a.length; i += 9) {
      if (flip) {
        a[i] = -a[i];
        a[i + 3] = -a[i + 3];
        a[i + 6] = -a[i + 6];
      }
      // Zweiten und dritten Eckpunkt des Dreiecks tauschen.
      for (let k = 0; k < 3; k++) {
        const tmp = a[i + 3 + k];
        a[i + 3 + k] = a[i + 6 + k];
        a[i + 6 + k] = tmp;
      }
    }
    attr.needsUpdate = true;
  }
  return g;
}

/** Teil eines Modells; sammelt Primitive. Alle Methoden geben das Teil zurück und lassen sich verketten. */
export class PartBuilder {
  /**
   * @param {ModelBuilder} model
   * @param {string} name
   * @param {{ pivot: Vec3, parent: string | null, minLevel: number, maxLevel: number }} opts
   */
  constructor(model, name, opts) {
    this.model = model;
    this.name = name;
    this.opts = opts;
    /** @type {THREE.BufferGeometry[]} */
    this.matte = [];
    /** @type {THREE.BufferGeometry[]} */
    this.glow = [];
  }

  /**
   * Färbt, platziert und speichert ein Primitiv.
   * @param {THREE.BufferGeometry} raw Geometrie im lokalen System des Primitivs
   * @param {PrimOpts} o
   * @param {number} bottomY y-Koordinate der Unterseite im lokalen System
   * @returns {this}
   */
  _add(raw, o, bottomY) {
    const g = normalize(raw);
    const defaults = this.model.defaultOpts;
    const rng = this.model.rng;
    const position = /** @type {THREE.BufferAttribute} */ (g.getAttribute('position'));
    const count = position.count;

    // --- Vertexfarben (im linearen Arbeitsfarbraum) ---
    g.computeBoundingBox();
    const bb = /** @type {THREE.Box3} */ (g.boundingBox);
    const minY = bb.min.y;
    const spanY = Math.max(bb.max.y - minY, 1e-6);
    colorA.set(o.color ?? '#ffffff');
    const hasTop = o.colorTop !== undefined;
    if (hasTop) colorB.set(/** @type {import('three').ColorRepresentation} */ (o.colorTop));
    const shade = o.shade ?? defaults.shade;
    const faceJitter = o.faceJitter ?? defaults.faceJitter;
    const jitter = o.jitter ?? defaults.jitter;
    const gain = (o.glow ? (typeof o.glow === 'number' ? o.glow : GLOW_GAIN) : 1) * (jitter ? 1 + (rng.next() * 2 - 1) * jitter : 1);
    const colors = new Float32Array(count * 3);
    let faceGain = 1;
    for (let i = 0; i < count; i++) {
      if (faceJitter && i % 3 === 0) faceGain = 1 + (rng.next() * 2 - 1) * faceJitter;
      const t = (position.getY(i) - minY) / spanY;
      let r;
      let gr;
      let b;
      if (hasTop) {
        r = colorA.r + (colorB.r - colorA.r) * t;
        gr = colorA.g + (colorB.g - colorA.g) * t;
        b = colorA.b + (colorB.b - colorA.b) * t;
      } else {
        const k = 1 - shade * (1 - t);
        r = colorA.r * k;
        gr = colorA.g * k;
        b = colorA.b * k;
      }
      const k2 = gain * faceGain;
      colors[i * 3] = r * k2;
      colors[i * 3 + 1] = gr * k2;
      colors[i * 3 + 2] = b * k2;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // --- Lage im Modellraum ---
    const s = o.scale ?? 1;
    const sx = typeof s === 'number' ? s : s[0];
    const sy = typeof s === 'number' ? s : s[1];
    const sz = typeof s === 'number' ? s : s[2];
    if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
    const rot = o.rot;
    if (o.base) {
      g.translate(0, -bottomY * sy, 0);
      if (rot) g.applyQuaternion(quat.setFromEuler(euler.set(rot[0], rot[1], rot[2])));
      g.translate(o.base[0], o.base[1], o.base[2]);
    } else {
      if (rot) g.applyQuaternion(quat.setFromEuler(euler.set(rot[0], rot[1], rot[2])));
      const at = o.at ?? [0, 0, 0];
      g.translate(at[0], at[1], at[2]);
    }
    const list = o.glow ? this.glow : this.matte;
    list.push(g);
    if (o.mirror) list.push(mirrorX(g));
    return this;
  }

  /** Quader. @param {BoxOpts} o */
  box(o) {
    return this._add(new THREE.BoxGeometry(o.size[0], o.size[1], o.size[2]), o, -o.size[1] / 2);
  }

  /** Zylinder oder Kegelstumpf (mit `rTop`), Achse entlang Y. @param {CylOpts} o */
  cyl(o) {
    return this._add(new THREE.CylinderGeometry(o.rTop ?? o.r, o.r, o.h, o.seg ?? 8, 1, o.open ?? false), o, -o.h / 2);
  }

  /** Kegel, Spitze nach +Y. @param {ConeOpts} o */
  cone(o) {
    return this._add(new THREE.ConeGeometry(o.r, o.h, o.seg ?? 8), o, -o.h / 2);
  }

  /** Low-Poly-Kugel (Ikosaeder). Mit `scale` wird daraus ein Ellipsoid. @param {SphereOpts} o */
  sphere(o) {
    return this._add(new THREE.IcosahedronGeometry(o.r, o.detail ?? 1), o, -o.r);
  }

  /** Kapsel: Zylinder mit runden Enden, Achse entlang Y. Gut für Gliedmaßen und weiche Körper. @param {CapsuleOpts} o */
  capsule(o) {
    return this._add(new THREE.CapsuleGeometry(o.r, o.h, 2, o.seg ?? 6), o, -(o.h / 2 + o.r));
  }

  /** Halbkugel, flache Seite unten bei lokal y = 0. @param {DomeOpts} o */
  dome(o) {
    return this._add(new THREE.SphereGeometry(o.r, o.seg ?? 8, o.rings ?? 3, 0, Math.PI * 2, 0, Math.PI / 2), o, 0);
  }

  /** Ring; liegt flach (Achse entlang Y). Für Räder mit `rot` aufstellen. @param {TorusOpts} o */
  torus(o) {
    const g = new THREE.TorusGeometry(o.r, o.tube, o.tubeSeg ?? 5, o.seg ?? 12, o.arc ?? Math.PI * 2);
    g.rotateX(Math.PI / 2);
    return this._add(g, o, -o.tube);
  }

  /** Vierseitige Pyramide mit rechteckiger Grundfläche. @param {PyramidOpts} o */
  pyramid(o) {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, o.size[1], 4);
    g.rotateY(Math.PI / 4);
    g.scale(o.size[0], 1, o.size[2]);
    return this._add(g, o, -o.size[1] / 2);
  }

  /** Satteldach: dreieckiger Querschnitt, First entlang X. size = [Länge x, Höhe y, Spannweite z]. @param {BoxOpts} o */
  roof(o) {
    const w = o.size[0] / 2;
    const h = o.size[1] / 2;
    const d = o.size[2] / 2;
    // prettier-ignore
    const g = fromTriangles([
      -w, -h, d,  w, -h, d,  w, h, 0,   -w, -h, d,  w, h, 0,  -w, h, 0,     // Dachfläche +Z
      w, -h, -d,  -w, -h, -d,  -w, h, 0,   w, -h, -d,  -w, h, 0,  w, h, 0,  // Dachfläche -Z
      -w, -h, -d,  -w, -h, d,  -w, h, 0,                                    // Giebel -X
      w, -h, d,  w, -h, -d,  w, h, 0,                                       // Giebel +X
      -w, -h, -d,  w, -h, -d,  w, -h, d,   -w, -h, -d,  w, -h, d,  -w, -h, d, // Boden
    ]);
    return this._add(g, o, -h);
  }

  /** Keil/Rampe: flach bei -Z, volle Höhe bei +Z. size = [Breite x, Höhe y, Tiefe z]. @param {BoxOpts} o */
  wedge(o) {
    const w = o.size[0] / 2;
    const h = o.size[1] / 2;
    const d = o.size[2] / 2;
    // prettier-ignore
    const g = fromTriangles([
      -w, -h, -d,  w, h, d,  w, -h, -d,   -w, -h, -d,  -w, h, d,  w, h, d,   // Schräge
      -w, -h, d,  w, -h, d,  w, h, d,   -w, -h, d,  w, h, d,  -w, h, d,      // Rückwand +Z
      -w, -h, -d,  -w, -h, d,  -w, h, d,                                     // Seite -X
      w, -h, -d,  w, h, d,  w, -h, d,                                        // Seite +X
      -w, -h, -d,  w, -h, -d,  w, -h, d,   -w, -h, -d,  w, -h, d,  -w, -h, d, // Boden
    ]);
    return this._add(g, o, -h);
  }

  /** Flacher Umriss (XY-Ebene) mit Dicke entlang Z: Schilde, Flügel, Klingen, Fahnen. @param {ExtrudeOpts} o */
  extrude(o) {
    const shape = new THREE.Shape(o.points.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: o.depth, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -o.depth / 2);
    let minY = Infinity;
    for (const p of o.points) minY = Math.min(minY, p[1]);
    return this._add(g, o, minY);
  }

  /** Rotationskörper um die Y-Achse aus einem Profil [Radius, Höhe]: Vasen, Kuppeln, Fässer. Profil mit Radius 0 beginnen und enden lassen, sonst bleibt der Körper offen. @param {LatheOpts} o */
  lathe(o) {
    const g = new THREE.LatheGeometry(o.points.map(([r, y]) => new THREE.Vector2(r, y)), o.seg ?? 8);
    let minY = Infinity;
    for (const p of o.points) minY = Math.min(minY, p[1]);
    return this._add(g, o, minY);
  }
}

/** Baut ein Modell aus Teilen. Erzeugen mit createModel(id). */
export class ModelBuilder {
  /** @param {string} id */
  constructor(id) {
    this.id = id;
    /** @type {PartBuilder[]} */
    this.partList = [];
    /** @type {Map<string, PartBuilder>} */
    this.partMap = new Map();
    /** @type {{ name: string, pos: Vec3, part: string | null }[]} */
    this.pointList = [];
    this.defaultOpts = { shade: 0.14, faceJitter: 0, jitter: 0 };
    this.rng = makeRng(hashString(id));
  }

  /**
   * Standardwerte für alle danach hinzugefügten Primitive.
   * @param {{ shade?: number, faceJitter?: number, jitter?: number }} o
   * @returns {this}
   */
  defaults(o) {
    Object.assign(this.defaultOpts, o);
    return this;
  }

  /**
   * Legt ein Teil an (oder liefert das vorhandene Teil gleichen Namens).
   * @param {string} name
   * @param {PartOpts} [opts]
   * @returns {PartBuilder}
   */
  part(name, opts = {}) {
    const existing = this.partMap.get(name);
    if (existing) return existing;
    const parent = opts.parent ?? null;
    if (parent !== null && !this.partMap.has(parent)) {
      throw new Error(`Modell ${this.id}: Elternteil "${parent}" von "${name}" muss vorher angelegt werden`);
    }
    const p = new PartBuilder(this, name, {
      pivot: opts.pivot ?? [0, 0, 0],
      parent,
      minLevel: opts.minLevel ?? 1,
      maxLevel: opts.maxLevel ?? 99,
    });
    this.partList.push(p);
    this.partMap.set(name, p);
    return p;
  }

  /**
   * Benannter Punkt im Modellraum, der sich mit einem Teil mitbewegt (z. B. 'muzzle' am Rohr).
   * @param {string} name
   * @param {Vec3} pos Position im Modellraum (Ruhepose)
   * @param {string | null} [part] Teil, an dem der Punkt hängt; ohne Angabe am Modellursprung
   * @returns {this}
   */
  point(name, pos, part = null) {
    if (part !== null && !this.partMap.has(part)) throw new Error(`Modell ${this.id}: Punkt "${name}" verweist auf unbekanntes Teil "${part}"`);
    this.pointList.push({ name, pos, part });
    return this;
  }

  /**
   * Schließt das Modell ab.
   * @param {BuildOpts} [opts]
   * @returns {ModelSpec}
   */
  build(opts = {}) {
    if (this.partList.length === 0) throw new Error(`Modell ${this.id}: keine Teile`);
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let radius = 0;
    let triangles = 0;
    /** @type {PartSpec[]} */
    const parts = [];
    for (const p of this.partList) {
      const pivot = p.opts.pivot;
      const parentIndex = p.opts.parent === null ? -1 : this.partList.indexOf(/** @type {PartBuilder} */ (this.partMap.get(p.opts.parent)));
      const parentPivot = parentIndex >= 0 ? this.partList[parentIndex].opts.pivot : [0, 0, 0];
      /** @type {(THREE.BufferGeometry | null)[]} */
      const merged = [];
      for (const list of [p.matte, p.glow]) {
        if (list.length === 0) {
          merged.push(null);
          continue;
        }
        const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
        if (!g) throw new Error(`Modell ${this.id}: Teil "${p.name}" liess sich nicht zusammenfügen`);
        if (list.length > 1) for (const item of list) item.dispose();
        // Ausdehnung im Modellraum erfassen, dann in das Teil-System verschieben.
        const pos = /** @type {THREE.BufferAttribute} */ (g.getAttribute('position'));
        box3.setFromBufferAttribute(pos);
        min.min(box3.min);
        max.max(box3.max);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          const y = pos.getY(i);
          if (!Number.isFinite(x + y + z)) throw new Error(`Modell ${this.id}: Teil "${p.name}" enthält ungültige Koordinaten`);
          radius = Math.max(radius, Math.hypot(x, z));
        }
        triangles += pos.count / 3;
        g.translate(-pivot[0], -pivot[1], -pivot[2]);
        g.computeBoundingBox();
        g.computeBoundingSphere();
        merged.push(g);
      }
      parts.push({
        name: p.name,
        parent: parentIndex,
        offset: [pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]],
        pivot: [pivot[0], pivot[1], pivot[2]],
        geometry: merged[0],
        glowGeometry: merged[1],
        minLevel: p.opts.minLevel,
        maxLevel: p.opts.maxLevel,
      });
    }
    if (triangles === 0) throw new Error(`Modell ${this.id}: keine Geometrie`);

    /** @type {Record<string, ModelPoint>} */
    const points = {};
    for (const pt of this.pointList) {
      const index = pt.part === null ? -1 : parts.findIndex((p) => p.name === pt.part);
      const pivot = index >= 0 ? parts[index].pivot : [0, 0, 0];
      points[pt.name] = { part: index, local: [pt.pos[0] - pivot[0], pt.pos[1] - pivot[1], pt.pos[2] - pivot[2]] };
    }

    return {
      id: this.id,
      parts,
      points,
      animate: opts.animate ?? null,
      bounds: { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z], radius, height: max.y },
      triangles,
      stride: opts.stride ?? 0.6,
    };
  }
}

/**
 * Beginnt ein neues Modell.
 * @param {string} id Eindeutige Kennung, z. B. 'tower.stone.shooter'
 * @returns {ModelBuilder}
 */
export function createModel(id) {
  return new ModelBuilder(id);
}

/**
 * Hellt eine Farbe auf (amount > 0) oder dunkelt sie ab (amount < 0), jeweils im Bereich -1..1.
 * @param {import('../types/model').ColorLike} color
 * @param {number} amount
 * @returns {string} '#rrggbb'
 */
export function tone(color, amount) {
  colorA.set(color);
  const hsl = { h: 0, s: 0, l: 0 };
  colorA.getHSL(hsl);
  const l = amount >= 0 ? hsl.l + (1 - hsl.l) * amount : hsl.l * (1 + amount);
  colorA.setHSL(hsl.h, hsl.s, l);
  return '#' + colorA.getHexString();
}

/**
 * Mischt zwei Farben. t = 0 ergibt a, t = 1 ergibt b.
 * @param {import('../types/model').ColorLike} a
 * @param {import('../types/model').ColorLike} b
 * @param {number} t
 * @returns {string} '#rrggbb'
 */
export function mix(a, b, t) {
  colorA.set(a);
  colorB.set(b);
  colorA.lerp(colorB, t);
  return '#' + colorA.getHexString();
}
