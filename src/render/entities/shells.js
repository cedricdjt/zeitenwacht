// @ts-check
// Leuchthüllen: durchscheinende, weich leuchtende Körper in einem instanzierten Zeichenaufruf.
// Art 0 = Blase (Rand leuchtet, Mitte fast klar): Schilde der Gegner.
// Art 1 = Lichtsäule (Kern leuchtet, Rand läuft weich aus): Modernisierung eines Turms.
// Je Bild: begin(), add() je Hülle, end().

import * as THREE from 'three';

export const SHELL = Object.freeze({ BUBBLE: 0, COLUMN: 1 });

const VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScale;
  attribute vec4 aColor;   // r, g, b (linear), Stärke
  attribute float aKind;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec4 vColor;
  varying float vKind;
  varying float vHeight;
  void main() {
    vec3 world = aCenter + position * aScale;
    // Normale der gestreckten Kugel (Ellipsoid): Ort durch das Quadrat der Halbachsen.
    vNormal = normalize(position / max(aScale, vec3(1e-4)));
    vView = normalize(cameraPosition - world);
    vColor = aColor;
    vKind = aKind;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;

const FRAGMENT = /* glsl */ `
  uniform float uGain;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec4 vColor;
  varying float vKind;
  varying float vHeight;
  void main() {
    float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float a;
    vec3 col = vColor.rgb;
    if (vKind < 0.5) {
      float rim = pow(1.0 - facing, 2.2);
      a = (0.10 + rim * 0.85) * vColor.a;
      col = mix(col, vec3(1.0), rim * 0.45);
    } else {
      float core = facing * facing;
      float ends = 1.0 - smoothstep(0.35, 1.0, abs(vHeight));
      a = core * ends * vColor.a;
      col = mix(col, vec3(1.0), core * 0.5);
    }
    gl_FragColor = vec4(col * uGain, clamp(a, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Sammelt die Leuchthüllen eines Bildes und zeichnet sie in einem Aufruf. */
export class GlowShells {
  /** @param {number} [capacity] Anfangsgröße; wächst bei Bedarf */
  constructor(capacity = 32) {
    this.capacity = 0;
    this.count = 0;
    const sphere = new THREE.IcosahedronGeometry(1, 3);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', sphere.getAttribute('position'));
    this.center = new Float32Array(0);
    this.scale = new Float32Array(0);
    this.color = new Float32Array(0);
    this.kind = new Float32Array(0);
    /** uGain: Helligkeit der Hüllen; die Figurenschicht senkt sie in dunklen Lichtstimmungen, damit nichts blendet. */
    this.uniforms = { uGain: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'entities:shells';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this._allocate(capacity);
  }

  /** @param {number} capacity */
  _allocate(capacity) {
    const center = new Float32Array(capacity * 3);
    const scale = new Float32Array(capacity * 3);
    const color = new Float32Array(capacity * 4);
    const kind = new Float32Array(capacity);
    center.set(this.center);
    scale.set(this.scale);
    color.set(this.color);
    kind.set(this.kind);
    this.center = center;
    this.scale = scale;
    this.color = color;
    this.kind = kind;
    for (const [name, array, size] of /** @type {[string, Float32Array, number][]} */ ([['aCenter', center, 3], ['aScale', scale, 3], ['aColor', color, 4], ['aKind', kind, 1]])) {
      const attribute = new THREE.InstancedBufferAttribute(array, size);
      attribute.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attribute);
    }
    this.capacity = capacity;
  }

  /** Beginnt ein neues Bild. */
  begin() {
    this.count = 0;
  }

  /**
   * Fügt eine Hülle hinzu.
   * @param {number} x Mittelpunkt
   * @param {number} y
   * @param {number} z
   * @param {number} sx Halbachsen
   * @param {number} sy
   * @param {number} sz
   * @param {THREE.Color} color
   * @param {number} strength Leuchtstärke 0..1 (darüber heller)
   * @param {number} kind Wert aus SHELL
   */
  add(x, y, z, sx, sy, sz, color, strength, kind) {
    if (strength <= 0.002) return;
    if (this.count >= this.capacity) this._allocate(this.capacity * 2);
    const i = this.count++;
    const o3 = i * 3;
    const o4 = i * 4;
    this.center[o3] = x;
    this.center[o3 + 1] = y;
    this.center[o3 + 2] = z;
    this.scale[o3] = sx;
    this.scale[o3 + 1] = sy;
    this.scale[o3 + 2] = sz;
    this.color[o4] = color.r;
    this.color[o4 + 1] = color.g;
    this.color[o4 + 2] = color.b;
    this.color[o4 + 3] = strength;
    this.kind[i] = kind;
  }

  /** Schließt das Bild ab und lädt die Daten hoch. */
  end() {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;
    for (const name of ATTRIBUTES) /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute(name)).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const ATTRIBUTES = ['aCenter', 'aScale', 'aColor', 'aKind'];
