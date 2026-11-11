// @ts-check
// Lebensbalken: kleine, zur Kamera gedrehte Balken über verletzten Gegnern, alle in EINEM instanzierten Zeichenaufruf.
// Dunkler Grund, Füllung von Grün über Gelb nach Rot, eine helle Spur für eben verlorene Lebenspunkte und ein
// zweiter dünner Balken für Schilde. Die Balken behalten auf dem Bildschirm ihre Größe (in Grenzen) und werden
// ohne Tiefentest zuletzt gezeichnet, verschwinden also nie in Modellen.
// Je Bild: begin(), add() je Balken, end(camera, viewportHeight).

import * as THREE from 'three';

/** Breite und Höhe des Balkens eines gewöhnlichen Gegners in Bildpunkten (CSS-Pixel). */
const BAR_WIDTH = 34;
const BAR_HEIGHT = 6;
/** Höhe des Schildbalkens und sein Abstand zum Lebensbalken in Bildpunkten. */
const SHIELD_HEIGHT = 4;
const SHIELD_GAP = 1;
/** Grenzen der Balkenbreite in Feldern, damit die Balken beim Zoomen weder riesig noch winzig werden. */
const MIN_WORLD_WIDTH = 0.42;
const MAX_WORLD_WIDTH = 1.0;

const VERTEX = /* glsl */ `
  uniform float uPixel;      // Feldbreite eines Bildpunkts in Entfernung 1
  uniform vec2 uUnitRange;   // kleinste und größte Feldbreite eines Bildpunkts
  uniform vec4 uLayout;      // Breite, Höhe, Schildhöhe, Schildabstand in Bildpunkten
  attribute vec3 aAnchor;    // Weltpunkt über dem Kopf
  attribute vec4 aBar;       // Leben 0..1, Spur 0..1, Schild 0..1 (negativ = keiner), Größenfaktor
  varying vec2 vPx;          // Ort im Balken in Bildpunkten
  varying vec2 vSize;        // Größe des ganzen Rechtecks in Bildpunkten
  varying vec4 vBar;
  void main() {
    vec4 mv = viewMatrix * vec4(aAnchor, 1.0);
    float unit = clamp(-mv.z * uPixel, uUnitRange.x, uUnitRange.y);
    float extra = aBar.z >= 0.0 ? uLayout.z + uLayout.w : 0.0;
    vec2 size = vec2(uLayout.x * aBar.w, uLayout.y * sqrt(aBar.w) + extra);
    vSize = size;
    vPx = position.xy * size;
    vBar = aBar;
    mv.xy += vec2((position.x - 0.5) * size.x, position.y * size.y + 3.0) * unit;
    gl_Position = projectionMatrix * mv;
  }`;

const FRAGMENT = /* glsl */ `
  uniform vec4 uLayout;
  varying vec2 vPx;
  varying vec2 vSize;
  varying vec4 vBar;

  // Abstand zu einem Rechteck mit runden Ecken (negativ = innen).
  float roundBox(vec2 p, vec2 center, vec2 halfSize, float radius) {
    vec2 q = abs(p - center) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    float extra = vBar.z >= 0.0 ? uLayout.z + uLayout.w : 0.0;
    float mainH = vSize.y - extra;
    float aa = max(fwidth(vPx.y), 0.35);
    vec3 dark = vec3(0.016, 0.014, 0.022);
    vec3 col = dark;
    float alpha = 0.0;

    // Lebensbalken: dunkler Grund mit runden Ecken, darin die Füllung.
    float dBack = roundBox(vPx, vec2(vSize.x * 0.5, mainH * 0.5), vec2(vSize.x * 0.5, mainH * 0.5), mainH * 0.5);
    float back = 1.0 - smoothstep(-aa, aa, dBack);
    float pad = 1.25;
    float inner = 1.0 - smoothstep(-aa, aa, roundBox(vPx, vec2(vSize.x * 0.5, mainH * 0.5), vec2(vSize.x * 0.5 - pad, mainH * 0.5 - pad), mainH * 0.5 - pad));
    float x = (vPx.x - pad) / (vSize.x - pad * 2.0);
    float hp = clamp(vBar.x, 0.0, 1.0);
    vec3 green = vec3(0.155, 0.63, 0.10);
    vec3 yellow = vec3(0.90, 0.62, 0.065);
    vec3 red = vec3(0.82, 0.10, 0.065);
    vec3 fill = hp > 0.5 ? mix(yellow, green, (hp - 0.5) * 2.0) : mix(red, yellow, hp * 2.0);
    // Oben ein wenig heller, damit der Balken plastisch wirkt.
    fill *= 0.86 + 0.28 * smoothstep(0.0, mainH, vPx.y);
    float ax = max(fwidth(x), 0.004);
    float inHp = 1.0 - smoothstep(hp - ax, hp + ax, x);
    float inLag = 1.0 - smoothstep(vBar.y - ax, vBar.y + ax, x);
    vec3 body = mix(vec3(0.07, 0.065, 0.085), vec3(1.0, 0.93, 0.78), inLag * 0.9);
    body = mix(body, fill, inHp);
    col = mix(dark, body, inner);
    alpha = back * 0.9;

    // Schildbalken darüber.
    if (vBar.z >= 0.0) {
      float y0 = mainH + uLayout.w;
      vec2 c = vec2(vSize.x * 0.5, y0 + uLayout.z * 0.5);
      vec2 h = vec2(vSize.x * 0.5 - 2.0, uLayout.z * 0.5);
      float sBack = 1.0 - smoothstep(-aa, aa, roundBox(vPx, c, h, h.y));
      float sInner = 1.0 - smoothstep(-aa, aa, roundBox(vPx, c, h - 1.0, h.y - 1.0));
      float sx = (vPx.x - 3.0) / (vSize.x - 6.0);
      float inShield = 1.0 - smoothstep(vBar.z - ax, vBar.z + ax, sx);
      vec3 sCol = mix(vec3(0.05, 0.07, 0.11), vec3(0.30, 0.74, 1.0), inShield);
      col = mix(col, mix(dark, sCol, sInner), sBack);
      alpha = max(alpha, sBack * 0.9);
    }
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }`;

/** Sammelt die Lebensbalken eines Bildes und zeichnet sie in einem Aufruf. */
export class HealthBars {
  /** @param {number} [capacity] Anfangsgröße; wächst bei Bedarf */
  constructor(capacity = 128) {
    this.capacity = 0;
    this.count = 0;
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.anchor = new Float32Array(0);
    this.bar = new Float32Array(0);
    this.uniforms = {
      uPixel: { value: 0.001 },
      uUnitRange: { value: new THREE.Vector2(MIN_WORLD_WIDTH / BAR_WIDTH, MAX_WORLD_WIDTH / BAR_WIDTH) },
      uLayout: { value: new THREE.Vector4(BAR_WIDTH, BAR_HEIGHT, SHIELD_HEIGHT, SHIELD_GAP) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'entities:bars';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this._allocate(capacity);
  }

  /** @param {number} capacity */
  _allocate(capacity) {
    const anchor = new Float32Array(capacity * 3);
    const bar = new Float32Array(capacity * 4);
    anchor.set(this.anchor);
    bar.set(this.bar);
    this.anchor = anchor;
    this.bar = bar;
    const a = new THREE.InstancedBufferAttribute(anchor, 3);
    const b = new THREE.InstancedBufferAttribute(bar, 4);
    a.setUsage(THREE.DynamicDrawUsage);
    b.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aAnchor', a);
    this.geometry.setAttribute('aBar', b);
    this.capacity = capacity;
  }

  /** Beginnt ein neues Bild. */
  begin() {
    this.count = 0;
  }

  /**
   * Fügt einen Balken hinzu.
   * @param {number} x Weltpunkt knapp über dem Kopf der Figur
   * @param {number} y
   * @param {number} z
   * @param {number} hp Lebenspunkte 0..1
   * @param {number} lag Nachlaufender Wert 0..1 (helle Spur zwischen hp und lag)
   * @param {number} shield Schild 0..1 oder negativ, wenn die Figur keinen Schild hat
   * @param {number} size Größenfaktor (1 = gewöhnlicher Gegner, Bosse größer)
   */
  add(x, y, z, hp, lag, shield, size) {
    if (this.count >= this.capacity) this._allocate(this.capacity * 2);
    const i = this.count++;
    const o3 = i * 3;
    const o4 = i * 4;
    this.anchor[o3] = x;
    this.anchor[o3 + 1] = y;
    this.anchor[o3 + 2] = z;
    this.bar[o4] = hp;
    this.bar[o4 + 1] = lag;
    this.bar[o4 + 2] = shield;
    this.bar[o4 + 3] = size;
  }

  /**
   * Schließt das Bild ab und lädt die Daten hoch.
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} viewportHeight Höhe der Zeichenfläche in CSS-Pixeln
   */
  end(camera, viewportHeight) {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;
    this.uniforms.uPixel.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / (Math.max(1, viewportHeight) * camera.zoom);
    /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute('aAnchor')).needsUpdate = true;
    /** @type {THREE.InstancedBufferAttribute} */ (this.geometry.getAttribute('aBar')).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
