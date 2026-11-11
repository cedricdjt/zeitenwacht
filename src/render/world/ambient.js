// @ts-check
// Schwebeteilchen in der Luft über der Insel (Pollen, Glühwürmchen, Blätter, Glut, Schnee ...).
// Ein einziges Punkte-Objekt; die Bewegung entsteht vollständig im Shader.

import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';

/** @import { AmbientParticles } from '../../types/content' */

const MAX_POINTS = 260;

/**
 * Kennwerte je Art.
 * rise = Steigen (+) oder Fallen (-) in Anteilen der Höhe des Luftraums je Sekunde, drift = waagerechte Drift in Anteilen je Sekunde,
 * wobble = Ausschlag des Taumelns in Feldern, freq = Tempo des Taumelns, size = Größe in Feldern, twinkle = Anteil des Blinkens,
 * gain = Leuchtkraft, add = 1 für leuchtende (additive) Teilchen, alpha = Deckkraft.
 * @type {Record<AmbientParticles['kind'], { rise: number, drift: [number, number], wobble: number, freq: number, size: number, twinkle: number, gain: number, add: number, alpha: number }>}
 */
const KINDS = {
  none: { rise: 0, drift: [0, 0], wobble: 0, freq: 0, size: 0, twinkle: 0, gain: 1, add: 0, alpha: 0 },
  pollen: { rise: 0.012, drift: [0.006, 0.002], wobble: 0.35, freq: 0.5, size: 0.06, twinkle: 0.2, gain: 1, add: 0, alpha: 0.75 },
  fireflies: { rise: 0, drift: [0.002, 0], wobble: 0.9, freq: 0.35, size: 0.085, twinkle: 0.9, gain: 1.7, add: 1, alpha: 1 },
  leaves: { rise: -0.045, drift: [0.02, 0.008], wobble: 0.5, freq: 0.9, size: 0.09, twinkle: 0, gain: 1, add: 0, alpha: 0.9 },
  dust: { rise: 0.004, drift: [0.004, 0.002], wobble: 0.25, freq: 0.3, size: 0.045, twinkle: 0.3, gain: 1, add: 0, alpha: 0.55 },
  embers: { rise: 0.07, drift: [0.008, 0], wobble: 0.3, freq: 1.2, size: 0.06, twinkle: 0.6, gain: 1.8, add: 1, alpha: 1 },
  smoke: { rise: 0.03, drift: [0.01, 0], wobble: 0.4, freq: 0.3, size: 0.32, twinkle: 0, gain: 1, add: 0, alpha: 0.16 },
  rain: { rise: -0.9, drift: [0.05, 0], wobble: 0, freq: 0, size: 0.04, twinkle: 0, gain: 1, add: 0, alpha: 0.5 },
  snow: { rise: -0.05, drift: [0.01, 0.004], wobble: 0.4, freq: 0.6, size: 0.065, twinkle: 0, gain: 1, add: 0, alpha: 0.9 },
  sparks: { rise: 0.12, drift: [0, 0], wobble: 0.5, freq: 2, size: 0.05, twinkle: 0.8, gain: 2, add: 1, alpha: 1 },
  petals: { rise: -0.035, drift: [0.015, 0.01], wobble: 0.6, freq: 0.8, size: 0.08, twinkle: 0, gain: 1, add: 0, alpha: 0.9 },
};

export class Ambient {
  constructor() {
    const rng = makeRng(31);
    const positions = new Float32Array(MAX_POINTS * 3);
    const random = new Float32Array(MAX_POINTS * 3);
    for (let i = 0; i < MAX_POINTS * 3; i++) {
      positions[i] = rng.next();
      random[i] = rng.next();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(random, 3));
    this.uniforms = {
      uTime: { value: 0 },
      uMin: { value: new THREE.Vector3(-12, 0.25, -9) },
      uSize: { value: new THREE.Vector3(24, 5, 18) },
      uColor: { value: new THREE.Color('#ffffff') },
      uRise: { value: 0 },
      uDrift: { value: new THREE.Vector2() },
      uWobble: { value: 0 },
      uFreq: { value: 0 },
      uPointSize: { value: 0.05 },
      uTwinkle: { value: 0 },
      uGain: { value: 1 },
      uAdd: { value: 0 },
      uOpacity: { value: 0 },
      uScale: { value: 800 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      // Vormultipliziertes Alpha: Mit Alpha 0 addiert sich die Farbe (Leuchten), mit Alpha 1 deckt sie.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        attribute vec3 aRandom;
        uniform float uTime;
        uniform vec3 uMin;
        uniform vec3 uSize;
        uniform float uRise;
        uniform vec2 uDrift;
        uniform float uWobble;
        uniform float uFreq;
        uniform float uPointSize;
        uniform float uTwinkle;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = fract(p.y + uTime * uRise * (0.6 + aRandom.x * 0.8));
          p.x = fract(p.x + uTime * uDrift.x * (0.7 + aRandom.z * 0.6));
          p.z = fract(p.z + uTime * uDrift.y * (0.7 + aRandom.y * 0.6));
          float phase = aRandom.y * 6.2832;
          float f = uTime * uFreq;
          vec3 wobble = vec3(
            sin(f * (0.7 + aRandom.z) + phase) + 0.5 * sin(f * 0.37 + phase * 2.3),
            0.45 * sin(f * 0.8 * (0.6 + aRandom.x) + phase * 1.7),
            cos(f * (0.8 + aRandom.y) + phase * 0.6) + 0.5 * cos(f * 0.29 + phase)) * uWobble;
          vec3 world = uMin + p * uSize + wobble;
          vec4 view = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = max(1.5, uPointSize * (0.65 + aRandom.x * 0.7) * uScale * 1.87 / -view.z);
          // An Ober- und Unterkante des Luftraums ein- und ausblenden, damit nichts springt.
          float edge = smoothstep(0.0, 0.12, p.y) * (1.0 - smoothstep(0.85, 1.0, p.y));
          edge *= smoothstep(0.0, 0.06, p.x) * (1.0 - smoothstep(0.94, 1.0, p.x)) * smoothstep(0.0, 0.06, p.z) * (1.0 - smoothstep(0.94, 1.0, p.z));
          float blink = sin(uTime * (0.5 + aRandom.z * 0.9) + phase * 3.0);
          float twinkle = mix(1.0, smoothstep(-0.2, 0.9, blink), uTwinkle);
          vAlpha = edge * twinkle;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uGain;
        uniform float uAdd;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.18, 0.5, length(c))) * vAlpha * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * uGain * a, a * (1.0 - uAdd));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.name = 'ambient';
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.points.visible = false;
    /** @type {AmbientParticles} */
    this.from = { kind: 'none', color: '#ffffff', density: 0 };
    /** @type {AmbientParticles} */
    this.to = this.from;
    /** @type {AmbientParticles | null} */
    this.applied = null;
    this.t = 1;
    this.enabled = true;
  }

  /**
   * Luftraum über der Insel.
   * @param {number} halfX
   * @param {number} halfZ
   */
  setIsland(halfX, halfZ) {
    this.uniforms.uMin.value.set(-halfX - 1, 0.25, -halfZ - 1);
    this.uniforms.uSize.value.set(halfX * 2 + 2, 5.2, halfZ * 2 + 2);
  }

  /**
   * Setzt die Teilchen sofort.
   * @param {AmbientParticles} particles
   */
  set(particles) {
    this.from = particles;
    this.to = particles;
    this.t = 1;
  }

  /**
   * Beginnt den Wechsel zu anderen Teilchen: Die alten blenden aus, dann die neuen ein (`blend(t)` führt).
   * @param {AmbientParticles} particles
   */
  beginBlend(particles) {
    this.from = this.to;
    this.to = particles;
    this.t = 0;
  }

  /** @param {number} t 0..1 */
  blend(t) {
    this.t = t;
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * @param {number} time Uhr der Welt
   * @param {number} pixelHeight Höhe des Zeichenpuffers in Pixeln
   */
  update(time, pixelHeight) {
    const same = this.from === this.to;
    const current = same || this.t >= 0.5 ? this.to : this.from;
    const fade = same ? 1 : this.t >= 0.5 ? this.t * 2 - 1 : 1 - this.t * 2;
    const params = KINDS[current.kind] ?? KINDS.none;
    const u = this.uniforms;
    if (this.applied !== current) {
      this.applied = current;
      u.uColor.value.set(current.color);
      u.uRise.value = params.rise;
      u.uDrift.value.set(params.drift[0], params.drift[1]);
      u.uWobble.value = params.wobble;
      u.uFreq.value = params.freq;
      u.uPointSize.value = params.size;
      u.uTwinkle.value = params.twinkle;
      u.uGain.value = params.gain;
      u.uAdd.value = params.add;
      this.points.geometry.setDrawRange(0, Math.min(MAX_POINTS, Math.round(MAX_POINTS * Math.min(1, Math.max(0, current.density)))));
    }
    const opacity = this.enabled ? params.alpha * fade : 0;
    u.uOpacity.value = opacity;
    u.uTime.value = time;
    u.uScale.value = pixelHeight;
    this.points.visible = opacity > 0.004 && current.density > 0;
  }

  dispose() {
    this.points.geometry.dispose();
    /** @type {THREE.Material} */ (this.points.material).dispose();
    this.points.removeFromParent();
  }
}
