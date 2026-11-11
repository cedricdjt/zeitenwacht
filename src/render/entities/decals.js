// @ts-check
// Bodenmarken: weiche, unbeleuchtete Scheiben und Ringe knapp über dem Boden (Reichweite, Auswahl, Aura, Zielkreis,
// Schattenfleck unter Fliegern). Alle Marken eines Bildes stecken in EINEM instanzierten Zeichenaufruf.
// Je Bild: begin(), add() je Marke, end().

import * as THREE from 'three';

/** Arten von Bodenmarken (Wert des Parameters `style`). */
export const DECAL = Object.freeze({
  /** Gefüllte, weiche Scheibe mit hellerem Rand (Reichweite). p1 = Randbreite relativ zum Radius. */
  DISC: 0,
  /** Weich leuchtender Ring. p1 = Ringradius 0..1, p2 = Ringbreite 0..1. */
  RING: 1,
  /** Scheibe mit gestricheltem Rand (Zielkreis). p1 = Randbreite relativ zum Radius, p2 = Anzahl der Striche; `rotation` dreht die Striche. */
  DASHED: 2,
  /** Weicher Fleck, zur Mitte hin dichter (Schatten). */
  BLOB: 3,
  /** Lichtkranz am Boden (Superwaffe): weicher Ring mit drei helleren Bögen, die sich mit `rotation` drehen. p1 = Ringradius 0..1, p2 = Ringbreite 0..1. */
  HALO: 4,
});

/** Höhe der Marken über dem Boden: über der Grasnarbe (y = 0) und damit erst recht über dem abgesenkten Weg. */
export const DECAL_Y = 0.035;

const VERTEX = /* glsl */ `
  attribute vec4 aPlace;   // x, y, z, Radius
  attribute vec4 aColor;   // r, g, b (linear), Deckkraft
  attribute vec4 aStyle;   // Art, Drehung, p1, p2
  varying vec2 vUv;
  varying vec4 vColor;
  varying vec4 vStyle;
  void main() {
    vUv = position.xz;
    vColor = aColor;
    vStyle = aStyle;
    vec3 world = aPlace.xyz + vec3(position.x, 0.0, position.z) * aPlace.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;

const FRAGMENT = /* glsl */ `
  uniform float uGain;
  varying vec2 vUv;
  varying vec4 vColor;
  varying vec4 vStyle;
  void main() {
    float r = length(vUv);
    float aa = max(fwidth(r) * 1.5, 0.002);
    float outer = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    float style = vStyle.x;
    float a = 0.0;
    vec3 col = vColor.rgb;
    if (style < 0.5) {
      // Scheibe: zarte Füllung, die zum Rand hin etwas dichter wird, dazu ein weicher heller Saum.
      float w = max(vStyle.z, aa * 2.0);
      float rim = smoothstep(1.0 - w * 2.2, 1.0 - w * 0.35, r);
      a = (0.13 + 0.10 * r * r + rim * 0.5) * outer;
      col = mix(col, vec3(1.0), rim * 0.35);
    } else if (style < 1.5) {
      float d = (r - vStyle.z) / max(vStyle.w, 0.001);
      a = exp(-d * d) * outer;
      col = mix(col, vec3(1.0), exp(-d * d * 4.0) * 0.4);
    } else if (style < 2.5) {
      float w = max(vStyle.z, aa * 2.0);
      float rim = smoothstep(1.0 - w * 2.0, 1.0 - w * 0.8, r);
      float ang = atan(vUv.y, vUv.x) + vStyle.y;
      float s = sin(ang * vStyle.w);
      float fw = max(fwidth(s), 0.02);
      float dash = smoothstep(-fw, fw, s + 0.25);
      a = (0.10 + 0.06 * r * r + rim * dash * 0.7) * outer;
      col = mix(col, vec3(1.0), rim * dash * 0.4);
    } else if (style < 3.5) {
      float f = 1.0 - smoothstep(0.0, 1.0, r);
      a = f * f * (3.0 - 2.0 * f);
    } else {
      float d = (r - vStyle.z) / max(vStyle.w, 0.001);
      float arc = 0.5 + 0.5 * sin(atan(vUv.y, vUv.x) * 3.0 + vStyle.y);
      // Zarte Füllung innerhalb des Rings, die zur Mitte hin ausläuft.
      float glowIn = smoothstep(vStyle.z * 0.35, vStyle.z, r) * step(r, vStyle.z) * 0.22;
      a = (exp(-d * d) * (0.5 + 0.5 * arc) + glowIn) * outer;
      col = mix(col, vec3(1.0), exp(-d * d * 4.0) * arc * 0.45);
    }
    gl_FragColor = vec4(col * uGain, a * vColor.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Sammelt die Bodenmarken eines Bildes und zeichnet sie in einem Aufruf. */
export class GroundDecals {
  /** @param {number} [capacity] Anfangsgröße; wächst bei Bedarf */
  constructor(capacity = 128) {
    this.capacity = 0;
    this.count = 0;
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, -1, 0, 1, 1, 0, 1, 1, 0, -1], 3));
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.place = new Float32Array(0);
    this.color = new Float32Array(0);
    this.style = new Float32Array(0);
    /** uGain: Helligkeit der Marken; die Figurenschicht senkt sie in dunklen Lichtstimmungen, damit nichts blendet. */
    this.uniforms = { uGain: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'entities:decals';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this._allocate(capacity);
  }

  /** @param {number} capacity */
  _allocate(capacity) {
    const place = new Float32Array(capacity * 4);
    const color = new Float32Array(capacity * 4);
    const style = new Float32Array(capacity * 4);
    place.set(this.place);
    color.set(this.color);
    style.set(this.style);
    this.place = place;
    this.color = color;
    this.style = style;
    for (const [name, array] of /** @type {[string, Float32Array][]} */ ([['aPlace', place], ['aColor', color], ['aStyle', style]])) {
      const attribute = new THREE.InstancedBufferAttribute(array, 4);
      attribute.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attribute);
    }
    // Neue Attribute brauchen neue GPU-Puffer; three legt sie beim nächsten Zeichnen an.
    this.capacity = capacity;
  }

  /** Beginnt ein neues Bild. */
  begin() {
    this.count = 0;
  }

  /**
   * Fügt eine Marke hinzu.
   * @param {number} x
   * @param {number} z
   * @param {number} radius Radius in Feldern
   * @param {THREE.Color} color Farbe (linear, wie THREE.Color sie hält)
   * @param {number} alpha Deckkraft 0..1
   * @param {number} style Wert aus DECAL
   * @param {number} [p1]
   * @param {number} [p2]
   * @param {number} [rotation] Drehung des Strichmusters in Radiant
   * @param {number} [lift] zusätzliche Höhe (Marken, die übereinander liegen sollen)
   */
  add(x, z, radius, color, alpha, style, p1 = 0, p2 = 0, rotation = 0, lift = 0) {
    if (radius <= 0 || alpha <= 0) return;
    if (this.count >= this.capacity) this._allocate(this.capacity * 2);
    const o = this.count++ * 4;
    this.place[o] = x;
    this.place[o + 1] = DECAL_Y + lift;
    this.place[o + 2] = z;
    this.place[o + 3] = radius;
    this.color[o] = color.r;
    this.color[o + 1] = color.g;
    this.color[o + 2] = color.b;
    this.color[o + 3] = alpha;
    this.style[o] = style;
    this.style[o + 1] = rotation;
    this.style[o + 2] = p1;
    this.style[o + 3] = p2;
  }

  /** Schließt das Bild ab und lädt die Daten hoch. */
  end() {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;
    /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute('aPlace')).needsUpdate = true;
    /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute('aColor')).needsUpdate = true;
    /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute('aStyle')).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
