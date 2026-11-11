// @ts-check
// Instanziertes Zeichnen von Modellen: ein Zeichenaufruf je Modellteil, egal wie viele Exemplare.

import * as THREE from 'three';

/** @import { AnimCtx, ModelSpec, Pose, PoseNode } from '../types/model' */

/**
 * @typedef {object} ModelMaterials
 * @property {THREE.Material} matte Beleuchtetes Material mit Vertexfarben
 * @property {THREE.Material} glow Unbeleuchtetes Material mit Vertexfarben
 */

const localMatrix = new THREE.Matrix4();
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const white = new THREE.Color(1, 1, 1);

/**
 * Leerer Animationskontext; nicht benötigte Felder bleiben 0.
 * @returns {AnimCtx}
 */
export function makeAnimCtx() {
  return { t: 0, seed: 0, walk: 0, move: 0, hp: 1, hurt: 0, aimYaw: 0, aimPitch: 0, fire: 0, charge: 1, active: 0, level: 1 };
}

/**
 * Pose mit einem Knoten je Teil.
 * @param {ModelSpec} spec
 * @returns {{ pose: Pose, nodes: PoseNode[] }}
 */
export function makePose(spec) {
  /** @type {Pose} */
  const pose = {};
  /** @type {PoseNode[]} */
  const nodes = [];
  for (const part of spec.parts) {
    const node = { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) };
    pose[part.name] = node;
    nodes.push(node);
  }
  return { pose, nodes };
}

/**
 * Setzt die Pose zurück, ruft die Animation des Modells auf und berechnet die Weltmatrix jedes Teils.
 * @param {ModelSpec} spec
 * @param {Pose} pose
 * @param {PoseNode[]} nodes
 * @param {THREE.Matrix4} root Weltmatrix der Instanz
 * @param {AnimCtx} ctx
 * @param {THREE.Matrix4[]} out Weltmatrizen je Teil (gleiche Reihenfolge wie spec.parts)
 */
export function computePartMatrices(spec, pose, nodes, root, ctx, out) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.position.set(0, 0, 0);
    n.rotation.set(0, 0, 0);
    n.scale.set(1, 1, 1);
  }
  if (spec.animate) spec.animate(pose, ctx);
  for (let i = 0; i < spec.parts.length; i++) {
    const part = spec.parts[i];
    const n = nodes[i];
    tmpPos.set(part.offset[0] + n.position.x, part.offset[1] + n.position.y, part.offset[2] + n.position.z);
    localMatrix.compose(tmpPos, tmpQuat.setFromEuler(n.rotation), n.scale);
    out[i].multiplyMatrices(part.parent >= 0 ? out[part.parent] : root, localMatrix);
  }
}

/** Zeichnet beliebig viele Exemplare eines Modells. Jedes Bild: begin(), add() je Exemplar, end(). */
export class InstancedModel {
  /**
   * @param {ModelSpec} spec
   * @param {ModelMaterials} materials
   * @param {{ capacity?: number, castShadow?: boolean, receiveShadow?: boolean }} [opts]
   */
  constructor(spec, materials, opts = {}) {
    this.spec = spec;
    this.materials = materials;
    this.castShadow = opts.castShadow ?? true;
    this.receiveShadow = opts.receiveShadow ?? true;
    this.group = new THREE.Group();
    this.group.name = `inst:${spec.id}`;
    this.capacity = 0;
    this.count = 0;
    /** @type {{ matte: THREE.InstancedMesh | null, glow: THREE.InstancedMesh | null }[]} */
    this.meshes = [];
    const { pose, nodes } = makePose(spec);
    this.pose = pose;
    this.nodes = nodes;
    /** Weltmatrizen der Teile des zuletzt hinzugefügten Exemplars. @type {THREE.Matrix4[]} */
    this.world = spec.parts.map(() => new THREE.Matrix4());
    this.visible = new Uint8Array(spec.parts.length);
    this._allocate(opts.capacity ?? 8);
  }

  /** @param {number} capacity */
  _allocate(capacity) {
    const old = this.meshes;
    this.meshes = this.spec.parts.map((part, index) => {
      /** @type {{ matte: THREE.InstancedMesh | null, glow: THREE.InstancedMesh | null }} */
      const entry = { matte: null, glow: null };
      for (const key of /** @type {const} */ (['matte', 'glow'])) {
        const geometry = key === 'matte' ? part.geometry : part.glowGeometry;
        if (!geometry) continue;
        const mesh = new THREE.InstancedMesh(geometry, this.materials[key], capacity);
        mesh.name = `${this.spec.id}:${part.name}:${key}`;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = this.castShadow && key === 'matte';
        mesh.receiveShadow = this.receiveShadow && key === 'matte';
        mesh.frustumCulled = false;
        mesh.count = 0;
        const previous = old[index]?.[key];
        if (previous) {
          // Bereits geschriebene Exemplare dieses Bildes übernehmen.
          mesh.instanceMatrix.array.set(previous.instanceMatrix.array.subarray(0, this.count * 16));
          if (previous.instanceColor) mesh.instanceColor.array.set(previous.instanceColor.array.subarray(0, this.count * 3));
          this.group.remove(previous);
          previous.dispose();
        }
        this.group.add(mesh);
        entry[key] = mesh;
      }
      return entry;
    });
    this.capacity = capacity;
  }

  /** Beginnt ein neues Bild. */
  begin() {
    this.count = 0;
  }

  /**
   * Fügt ein Exemplar hinzu.
   * @param {THREE.Matrix4} root Weltmatrix (Position, Blickrichtung, Größe)
   * @param {AnimCtx} ctx
   * @param {THREE.Color} [tint] Multiplikative Einfärbung; Werte über 1 hellen auf (Trefferblitz)
   * @returns {number} Index des Exemplars
   */
  add(root, ctx, tint = white) {
    if (this.count >= this.capacity) this._allocate(this.capacity * 2);
    const index = this.count++;
    computePartMatrices(this.spec, this.pose, this.nodes, root, ctx, this.world);
    const level = ctx.level || 1;
    for (let i = 0; i < this.meshes.length; i++) {
      const part = this.spec.parts[i];
      // Ein Teil ist nur sichtbar, wenn auch sein Elternteil sichtbar ist.
      const visible = level >= part.minLevel && level <= part.maxLevel && (part.parent < 0 || this.visible[part.parent] === 1);
      this.visible[i] = visible ? 1 : 0;
      const matrix = visible ? this.world[i] : zeroMatrix;
      const entry = this.meshes[i];
      if (entry.matte) {
        entry.matte.setMatrixAt(index, matrix);
        entry.matte.setColorAt(index, tint);
      }
      if (entry.glow) {
        entry.glow.setMatrixAt(index, matrix);
        entry.glow.setColorAt(index, tint);
      }
    }
    return index;
  }

  /**
   * Weltposition eines benannten Modellpunkts für das zuletzt mit add() hinzugefügte Exemplar.
   * @param {string} name
   * @param {THREE.Vector3} target
   * @returns {boolean} false, wenn das Modell den Punkt nicht kennt
   */
  pointWorld(name, target) {
    const point = this.spec.points[name];
    if (!point) return false;
    target.set(point.local[0], point.local[1], point.local[2]);
    if (point.part >= 0) target.applyMatrix4(this.world[point.part]);
    return true;
  }

  /** Schließt das Bild ab und lädt die Daten hoch. */
  end() {
    for (const entry of this.meshes) {
      for (const mesh of [entry.matte, entry.glow]) {
        if (!mesh) continue;
        mesh.count = this.count;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** Gibt die GPU-Puffer der Instanzen frei (die Geometrien gehören dem ModelSpec und bleiben erhalten). */
  dispose() {
    for (const entry of this.meshes) {
      for (const mesh of [entry.matte, entry.glow]) {
        if (!mesh) continue;
        this.group.remove(mesh);
        mesh.dispose();
      }
    }
    this.meshes = [];
  }
}

/**
 * Baut aus einem Modell eine gewöhnliche Objekt-Hierarchie (für Bauvorschau, Vorschaubilder, Einzelstücke).
 * Die zurückgegebene Funktion `update(ctx)` spielt die Animation des Modells ab.
 * @param {ModelSpec} spec
 * @param {ModelMaterials} materials
 * @param {{ level?: number, castShadow?: boolean, receiveShadow?: boolean }} [opts]
 * @returns {{ object: THREE.Group, update: (ctx: AnimCtx) => void }}
 */
export function createModelObject(spec, materials, opts = {}) {
  const object = new THREE.Group();
  object.name = spec.id;
  const { pose, nodes } = makePose(spec);
  /** @type {THREE.Group[]} */
  const groups = [];
  spec.parts.forEach((part, i) => {
    const g = new THREE.Group();
    g.name = part.name;
    g.position.set(part.offset[0], part.offset[1], part.offset[2]);
    for (const key of /** @type {const} */ (['matte', 'glow'])) {
      const geometry = key === 'matte' ? part.geometry : part.glowGeometry;
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, materials[key]);
      mesh.castShadow = (opts.castShadow ?? true) && key === 'matte';
      mesh.receiveShadow = (opts.receiveShadow ?? true) && key === 'matte';
      g.add(mesh);
    }
    (part.parent >= 0 ? groups[part.parent] : object).add(g);
    groups.push(g);
  });
  /** @param {AnimCtx} ctx */
  const update = (ctx) => {
    for (const n of nodes) {
      n.position.set(0, 0, 0);
      n.rotation.set(0, 0, 0);
      n.scale.set(1, 1, 1);
    }
    if (spec.animate) spec.animate(pose, ctx);
    const level = ctx.level || 1;
    for (let i = 0; i < groups.length; i++) {
      const part = spec.parts[i];
      const n = nodes[i];
      const g = groups[i];
      g.position.set(part.offset[0] + n.position.x, part.offset[1] + n.position.y, part.offset[2] + n.position.z);
      g.rotation.copy(n.rotation);
      g.scale.copy(n.scale);
      g.visible = level >= part.minLevel && level <= part.maxLevel;
    }
  };
  const initial = makeAnimCtx();
  initial.level = opts.level ?? 1;
  update(initial);
  return { object, update };
}
