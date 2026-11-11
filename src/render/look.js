// @ts-check
// Der gemeinsame Look: Materialien, Licht, Himmel und Renderer-Einstellungen.
// Spiel und Modell-Betrachter benutzen dieselben Bausteine, damit Modelle überall gleich aussehen.

import * as THREE from 'three';

/** @import { ModelMaterials } from './instances.js' */
/** @import { LightTheme } from '../types/model' */

const DEG = Math.PI / 180;

/**
 * Die zwei Materialien, mit denen alle Modelle gezeichnet werden.
 * @returns {ModelMaterials}
 */
export function createMaterials() {
  return {
    matte: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
}

/**
 * Grundeinstellungen des Renderers (Farbraum, Tonwertkurve, Schatten).
 * @param {THREE.WebGLRenderer} renderer
 */
export function configureRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // "Neutral" lässt die Farben der Palette nahezu unverändert und staucht nur die Lichter.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

/**
 * Richtungsvektor zur Sonne.
 * @param {number} elevationDeg Höhe über dem Horizont in Grad
 * @param {number} azimuthDeg Himmelsrichtung in Grad (0 = +Z, 90 = +X)
 * @param {THREE.Vector3} target
 * @returns {THREE.Vector3}
 */
export function sunDirection(elevationDeg, azimuthDeg, target) {
  const e = elevationDeg * DEG;
  const a = azimuthDeg * DEG;
  return target.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/**
 * Aufgelöste Lichtstimmung mit Zahlen und THREE.Color statt Zeichenketten. Lässt sich zwischen zwei Stimmungen
 * überblenden (Zeitenwende), ohne in jedem Bild Farben zu parsen oder etwas anzulegen.
 */
export class LightState {
  constructor() {
    this.skyTop = new THREE.Color();
    this.skyHorizon = new THREE.Color();
    this.skyBottom = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.hemiSky = new THREE.Color();
    this.hemiGround = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.sunIntensity = 1;
    this.sunElevation = 45;
    this.sunAzimuth = 0;
    this.sunGlow = 1;
    this.hemiIntensity = 1;
    this.fillIntensity = 0.35;
    this.fogDensity = 0;
    this.exposure = 1;
    /** Sichtbarkeit der Sterne 0..1, abgeleitet aus der Dunkelheit des Himmels. */
    this.stars = 0;
  }

  /**
   * @param {LightTheme} theme
   * @returns {this}
   */
  set(theme) {
    this.skyTop.set(theme.skyTop);
    this.skyHorizon.set(theme.skyHorizon);
    this.skyBottom.set(theme.skyBottom ?? theme.skyHorizon);
    this.sunColor.set(theme.sunColor);
    this.hemiSky.set(theme.hemiSky);
    this.hemiGround.set(theme.hemiGround);
    this.fogColor.set(theme.fogColor);
    this.sunIntensity = theme.sunIntensity;
    this.sunElevation = theme.sunElevation;
    this.sunAzimuth = theme.sunAzimuth;
    this.sunGlow = theme.sunGlow ?? 1;
    this.hemiIntensity = theme.hemiIntensity;
    this.fillIntensity = theme.fillIntensity ?? 0.35;
    this.fogDensity = theme.fogDensity;
    this.exposure = theme.exposure ?? 1;
    const lum = this.skyTop.r * 0.2126 + this.skyTop.g * 0.7152 + this.skyTop.b * 0.0722;
    const k = Math.min(1, Math.max(0, (0.1 - lum) / 0.08));
    this.stars = k * k * (3 - 2 * k);
    return this;
  }

  /**
   * @param {LightState} other
   * @returns {this}
   */
  copyFrom(other) {
    return this.lerpStates(other, other, 0);
  }

  /**
   * Setzt diesen Zustand auf die Überblendung von a nach b.
   * @param {LightState} a
   * @param {LightState} b
   * @param {number} t 0..1
   * @returns {this}
   */
  lerpStates(a, b, t) {
    this.skyTop.lerpColors(a.skyTop, b.skyTop, t);
    this.skyHorizon.lerpColors(a.skyHorizon, b.skyHorizon, t);
    this.skyBottom.lerpColors(a.skyBottom, b.skyBottom, t);
    this.sunColor.lerpColors(a.sunColor, b.sunColor, t);
    this.hemiSky.lerpColors(a.hemiSky, b.hemiSky, t);
    this.hemiGround.lerpColors(a.hemiGround, b.hemiGround, t);
    this.fogColor.lerpColors(a.fogColor, b.fogColor, t);
    this.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
    this.sunElevation = a.sunElevation + (b.sunElevation - a.sunElevation) * t;
    // Die Sonne wandert auf dem kürzesten Weg um den Himmel.
    let d = (b.sunAzimuth - a.sunAzimuth) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    this.sunAzimuth = a.sunAzimuth + d * t;
    this.sunGlow = a.sunGlow + (b.sunGlow - a.sunGlow) * t;
    this.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
    this.fillIntensity = a.fillIntensity + (b.fillIntensity - a.fillIntensity) * t;
    this.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * t;
    this.exposure = a.exposure + (b.exposure - a.exposure) * t;
    this.stars = a.stars + (b.stars - a.stars) * t;
    return this;
  }
}

/** Himmelslicht, Sonne mit Schatten und ein schwaches Gegenlicht. */
export class LightRig {
  /**
   * @param {THREE.Scene} scene
   * @param {{ shadowSize?: number, radius?: number }} [opts] radius = halbe Ausdehnung des beleuchteten Bereichs in Feldern
   */
  constructor(scene, opts = {}) {
    this.radius = opts.radius ?? 12;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.fill = new THREE.DirectionalLight('#ffffff', 0.3);
    this.sun.castShadow = true;
    const size = opts.shadowSize ?? 2048;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    const cam = this.sun.shadow.camera;
    cam.left = -this.radius;
    cam.right = this.radius;
    cam.top = this.radius;
    cam.bottom = -this.radius;
    cam.near = 1;
    cam.far = this.radius * 5;
    cam.updateProjectionMatrix();
    this.dir = new THREE.Vector3();
    this._state = new LightState();
    /** Quader, den der Schatten abdecken soll (siehe fit()); null = Würfel mit Kantenlänge 2 * radius. @type {{ halfX: number, halfZ: number, bottom: number, top: number } | null} */
    this._fit = null;
    scene.add(this.hemi, this.sun, this.sun.target, this.fill);
  }

  /**
   * Übernimmt die Lichtstimmung eines Zeitalters.
   * @param {LightTheme} theme
   */
  apply(theme) {
    this.applyState(this._state.set(theme));
  }

  /**
   * Übernimmt eine aufgelöste (auch überblendete) Lichtstimmung.
   * @param {LightState} state
   */
  applyState(state) {
    sunDirection(state.sunElevation, state.sunAzimuth, this.dir);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(state.sunColor);
    this.sun.intensity = state.sunIntensity;
    this.hemi.color.copy(state.hemiSky);
    this.hemi.groundColor.copy(state.hemiGround);
    this.hemi.intensity = state.hemiIntensity;
    // Gegenlicht aus der entgegengesetzten Himmelsrichtung, damit Schattenseiten Zeichnung behalten.
    this.fill.position.set(-this.dir.x, 0.6, -this.dir.z).multiplyScalar(10);
    this.fill.color.copy(state.hemiSky);
    this.fill.intensity = state.fillIntensity;
    this._placeSun();
  }

  /**
   * Passt die Schattenkamera an einen Quader um den Ursprung an (die Insel samt allem, was auf ihr steht).
   * Je enger der Quader, desto schärfer die Schatten.
   * @param {number} halfX halbe Ausdehnung in X
   * @param {number} halfZ halbe Ausdehnung in Z
   * @param {number} top höchster Punkt, der Schatten werfen soll
   * @param {number} [bottom] tiefster Punkt, der Schatten empfangen soll
   */
  fit(halfX, halfZ, top, bottom = -0.3) {
    this._fit = { halfX, halfZ, bottom, top };
    this._placeSun();
  }

  /** Stellt Sonne und Schattenkamera passend zur aktuellen Richtung `dir` ein. */
  _placeSun() {
    const cam = this.sun.shadow.camera;
    const f = this._fit;
    if (!f) {
      this.sun.position.copy(this.dir).multiplyScalar(this.radius * 2.5);
      return;
    }
    // Achsen der Schattenkamera: z zeigt zur Sonne, x waagerecht, y ergänzt.
    const d = this.dir;
    const hl = Math.hypot(d.x, d.z) || 1e-6;
    const rx = d.z / hl;
    const rz = -d.x / hl;
    const ux = d.y * rz;
    const uy = d.z * rx - d.x * rz;
    const uz = -d.y * rx;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? f.halfX : -f.halfX;
      const y = i & 2 ? f.top : f.bottom;
      const z = i & 4 ? f.halfZ : -f.halfZ;
      const px = x * rx + z * rz;
      const py = x * ux + y * uy + z * uz;
      const pz = x * d.x + y * d.y + z * d.z;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    const dist = maxZ + 6;
    this.sun.position.copy(d).multiplyScalar(dist);
    cam.left = minX - 0.3;
    cam.right = maxX + 0.3;
    cam.bottom = minY - 0.3;
    cam.top = maxY + 0.3;
    cam.near = 1;
    cam.far = dist - minZ + 2;
    cam.updateProjectionMatrix();
  }

  /**
   * Schaltet den Schattenwurf der Sonne und die Größe der Schattenkarte.
   * @param {boolean} enabled
   * @param {number} [size] Kantenlänge der Schattenkarte in Pixeln
   */
  setShadows(enabled, size) {
    this.sun.castShadow = enabled;
    if (size && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  /** Entfernt die Lichter aus der Szene und gibt die Schattenkarte frei. */
  dispose() {
    for (const light of [this.hemi, this.sun, this.sun.target, this.fill]) light.removeFromParent();
    this.sun.shadow.map?.dispose();
  }
}

/** Himmelskuppel mit Farbverlauf und Sonnenscheibe; folgt der Kamera. */
export class SkyDome {
  constructor() {
    this.uniforms = {
      topColor: { value: new THREE.Color('#5aa7e0') },
      horizonColor: { value: new THREE.Color('#cfe6f2') },
      bottomColor: { value: new THREE.Color('#7fb2c9') },
      sunColor: { value: new THREE.Color('#fff2cc') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunGlow: { value: 1 },
      stars: { value: 0 },
    };
    this._state = new LightState();
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform float sunGlow;
        uniform float stars;
        varying vec3 vDir;
        float starHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = d.y >= 0.0
            ? mix(horizonColor, topColor, pow(d.y, 0.55))
            : mix(horizonColor, bottomColor, pow(-d.y, 0.45));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * sunGlow * (smoothstep(0.9990, 0.9996, s) * 1.2 + pow(s, 24.0) * 0.22);
          if (stars > 0.001 && d.y > 0.0) {
            // Ruhige, feste Sterne: ein Raster auf der Kugel, in wenigen Zellen sitzt ein weicher Punkt.
            vec3 g = d * 70.0;
            vec3 cell = floor(g);
            float h = starHash(cell);
            float dotSize = 0.10 + 0.22 * fract(h * 37.0);
            float star = step(0.955, h) * (1.0 - smoothstep(dotSize * 0.4, dotSize, length(fract(g) - 0.5)));
            col += vec3(0.85, 0.9, 1.0) * star * stars * smoothstep(0.02, 0.3, d.y) * (0.45 + 0.55 * fract(h * 91.0));
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), material);
    this.mesh.name = 'sky';
    this.mesh.scale.setScalar(400);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.onBeforeRender = (_renderer, _scene, camera) => {
      this.mesh.position.setFromMatrixPosition(camera.matrixWorld);
      this.mesh.updateMatrixWorld();
    };
  }

  /** @param {LightTheme} theme */
  apply(theme) {
    this.applyState(this._state.set(theme));
  }

  /**
   * Übernimmt eine aufgelöste (auch überblendete) Lichtstimmung.
   * @param {LightState} state
   */
  applyState(state) {
    this.uniforms.topColor.value.copy(state.skyTop);
    this.uniforms.horizonColor.value.copy(state.skyHorizon);
    this.uniforms.bottomColor.value.copy(state.skyBottom);
    this.uniforms.sunColor.value.copy(state.sunColor);
    this.uniforms.sunGlow.value = state.sunGlow;
    this.uniforms.stars.value = state.stars;
    sunDirection(state.sunElevation, state.sunAzimuth, this.uniforms.sunDir.value);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    /** @type {THREE.Material} */ (this.mesh.material).dispose();
  }
}

/**
 * Neutrale Tageslicht-Stimmung, solange kein Zeitalter gewählt ist (Modell-Betrachter, Tests).
 * @type {LightTheme}
 */
export const NEUTRAL_LIGHT = {
  skyTop: '#5aa7e0',
  skyHorizon: '#d4eaf3',
  skyBottom: '#8fc3d6',
  sunColor: '#fff1d0',
  sunIntensity: 2.2,
  sunElevation: 48,
  sunAzimuth: 100,
  hemiSky: '#e2f0ff',
  hemiGround: '#b9ab8c',
  hemiIntensity: 1.7,
  fillIntensity: 0.6,
  fogColor: '#d4eaf3',
  fogDensity: 0.004,
  exposure: 1.05,
};
