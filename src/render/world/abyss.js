// @ts-check
// Die Umgebung unter und um die schwebende Insel: Wolkenmeer, Wasserfläche, Dunst oder das Lichtermeer einer Stadt.
// Eine gemeinsame Grundfläche trägt Farbe, Wellengang, den Schatten der Insel und den hellen Saum unter ihr;
// darüber liegen je nach Art Wolkenballen, Dunstschichten oder Lichtpunkte. Alle Arten lassen sich weich überblenden.
// Alles läuft im Shader: Je Bild werden nur ein paar Uniforms gesetzt.

import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';
import { ABYSS_Y } from './mapinfo.js';

/** @import { AbyssTheme } from '../../types/content' */
/** @import { LightState } from '../look.js' */

/** @typedef {AbyssTheme['kind']} AbyssKind */

const DISC_RADIUS = 430;
const PUFF_FIELD = 170;
const CLOUD_BOX = 60;

/** Kennwerte der Grundfläche je Art: Mischung der Grundfarbe aus color/color2, Saum, Schatten, Wellengang, Glitzern. */
const KIND_PARAMS = {
  clouds: { mix: 0.5, foam: 0.3, shadow: 0.3, wave: 0, glint: 0 },
  sea: { mix: 0, foam: 0.5, shadow: 0.28, wave: 1, glint: 1 },
  mist: { mix: -0.35, foam: 0.3, shadow: 0.22, wave: 0, glint: 0 },
  city: { mix: 0, foam: 0.07, shadow: 0, wave: 0, glint: 0 },
};

const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 col, float dist) {
    float f = dist * uFogDensity;
    return mix(uFogColor, col, exp(-f * f));
  }`;

const ISLAND_GLSL = /* glsl */ `
  uniform vec2 uIsland;
  // Vorzeichenbehafteter Abstand zum abgerundeten Umriss der Insel (negativ = darunter).
  float islandDistance(vec2 p, float grow) {
    vec2 h = uIsland + grow;
    float r = 3.5;
    vec2 q = abs(p) - h + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }`;

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }`;

/** Radius des fein unterteilten Innenbereichs der Grundfläche. */
const LATTICE_RADIUS = 66;

/**
 * Grundfläche: innen ein leicht verwackeltes Gitter aus gleichseitigen Dreiecken (sichtbare Low-Poly-Wellen),
 * außen ein flacher Ring bis zum Horizont. Das Attribut `aWave` blendet den Wellengang zum Rand des Gitters aus,
 * so dass beide Teile nahtlos aneinanderliegen.
 * @returns {THREE.BufferGeometry}
 */
function buildDisc() {
  const rng = makeRng(77);
  const cell = 2.1;
  const rowHeight = cell * Math.sqrt(3) / 2;
  const rows = Math.ceil((LATTICE_RADIUS * 2) / rowHeight) + 1;
  const cols = Math.ceil((LATTICE_RADIUS * 2) / cell) + 2;
  /** @type {number[]} */
  const positions = [];
  /** @type {number[]} */
  const wave = [];
  /** @type {number[]} */
  const index = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -LATTICE_RADIUS - cell + i * cell + (j % 2) * cell * 0.5 + rng.range(-0.3, 0.3) * cell;
      const z = -LATTICE_RADIUS + j * rowHeight + rng.range(-0.3, 0.3) * cell;
      positions.push(x, 0, z);
      const r = Math.hypot(x, z);
      const k = Math.min(1, Math.max(0, (LATTICE_RADIUS - 6 - r) / 22));
      wave.push(k * k * (3 - 2 * k));
    }
  }
  /** @param {number} a @param {number} b @param {number} c */
  const tri = (a, b, c) => {
    // Dreiecke ganz außerhalb des Kreises weglassen; dort liegt der Ring.
    let outside = 0;
    for (const v of [a, b, c]) if (Math.hypot(positions[v * 3], positions[v * 3 + 2]) > LATTICE_RADIUS) outside++;
    if (outside < 3) index.push(a, b, c);
  };
  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i + 1 < cols; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (j % 2 === 0) {
        tri(a, c, b);
        tri(b, c, d);
      } else {
        tri(a, c, d);
        tri(a, d, b);
      }
    }
  }
  // Ring: knapp unter dem Gitter, damit sich die Überlappung nicht streitet.
  const segments = 72;
  const radii = [LATTICE_RADIUS - 8, 120, 220, DISC_RADIUS];
  const first = positions.length / 3;
  for (let k = 0; k < radii.length; k++) {
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const a = (sIdx / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * radii[k], -0.03, Math.sin(a) * radii[k]);
      wave.push(0);
    }
  }
  for (let k = 0; k + 1 < radii.length; k++) {
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const s1 = (sIdx + 1) % segments;
      const a = first + k * segments + sIdx;
      const b = first + k * segments + s1;
      const c = first + (k + 1) * segments + sIdx;
      const d = first + (k + 1) * segments + s1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aWave', new THREE.Float32BufferAttribute(wave, 1));
  geometry.setIndex(index);
  return geometry;
}

/** Grundfläche. */
function createSurface() {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uWave: { value: 0 },
    uGlint: { value: 0 },
    uFoam: { value: 0 },
    uShadow: { value: 0 },
    uCity: { value: 0 },
    uIsland: { value: new THREE.Vector2(11, 8) },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.006 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float aWave;
      uniform float uTime;
      uniform float uWave;
      varying vec3 vWorld;
      varying float vHeight;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.42 + uTime * 0.7) * cos(p.z * 0.36 + uTime * 0.55)
                + 0.55 * sin(p.x * 0.93 - p.z * 0.71 + uTime * 1.1)
                + 0.35 * sin(p.z * 1.4 + p.x * 0.3 - uTime * 0.9);
        w *= aWave;
        vHeight = w;
        p.y += w * 0.17 * uWave;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uWave;
      uniform float uGlint;
      uniform float uFoam;
      uniform float uShadow;
      uniform float uCity;
      varying vec3 vWorld;
      varying float vHeight;
      ${FOG_GLSL}
      ${ISLAND_GLSL}
      void main() {
        // Flächennormale aus den Ableitungen: jede Facette bekommt eine eigene Helligkeit.
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        if (n.y < 0.0) n = -n;
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 v = toCam / dist;
        vec3 l = normalize(uSunDir);
        float facet = dot(n, normalize(vec3(l.x, 0.0, l.z) * 0.9 + vec3(0.0, 0.45, 0.0)));
        vec3 col = uColor * (1.0 + (facet - 0.44) * 1.15 * uWave);
        // Wellenkämme etwas heller.
        col = mix(col, uColor2, smoothstep(0.6, 1.7, vHeight) * 0.2 * uWave);
        // Glitzern der Sonne auf einzelnen Facetten.
        float spec = pow(max(dot(reflect(-l, n), v), 0.0), 90.0);
        col += uSunColor * spec * 0.7 * uGlint;

        // Schatten der Insel, in Sonnenrichtung versetzt.
        vec2 offset = l.xz / max(l.y, 0.25) * ${(-ABYSS_Y).toFixed(1)};
        float shade = 1.0 - smoothstep(-4.0, 3.0, islandDistance(vWorld.xz + offset, -1.0));
        col *= 1.0 - shade * uShadow;
        // Heller Saum unter der Insel: Gischt, aufgehellte Wolken, Lichtschein.
        float d = islandDistance(vWorld.xz, -1.2);
        float ring = d + sin(atan(vWorld.z, vWorld.x) * 5.0 + uTime * 0.35) * 0.35;
        float foam = exp(-ring * ring / 1.6) * (0.8 + 0.2 * sin(uTime * 0.6 + d));
        foam += (1.0 - smoothstep(-6.0, 0.5, d)) * 0.3;
        col = mix(col, uColor2, clamp(foam, 0.0, 1.0) * uFoam);

        float r = length(vWorld.xz);
        if (uCity > 0.001) {
          // Stadt bei Nacht: Die dichten Viertel schimmern schwach, damit die Ebene nicht tot wirkt.
          vec2 p = vWorld.xz;
          float district = 0.5 + 0.5 * sin(p.x * 0.045 + 1.3) * cos(p.y * 0.052 - 0.4) + 0.25 * sin((p.x + p.y) * 0.11);
          col += uColor2 * uCity * 0.03 * clamp(district, 0.0, 1.2) * (1.0 - smoothstep(70.0, 150.0, r));
        }
        col = applyFog(col, dist);
        float alpha = 1.0 - smoothstep(${(DISC_RADIUS * 0.5).toFixed(1)}, ${(DISC_RADIUS * 0.97).toFixed(1)}, r);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(buildDisc(), material);
  mesh.name = 'abyss:surface';
  mesh.position.y = ABYSS_Y;
  mesh.frustumCulled = false;
  mesh.renderOrder = -900;
  return { mesh, uniforms };
}

/**
 * Wolkenballen als ein instanziertes Netz. `sea` = Wolkenmeer unter der Insel, sonst einzelne Wolken auf Inselhöhe.
 * @param {boolean} sea
 * @param {number} halfX
 * @param {number} halfZ
 */
function createPuffs(sea, halfX, halfZ) {
  const rng = makeRng(sea ? 4711 : 1213);
  /** @type {THREE.Matrix4[]} */
  const matrices = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  /** @param {number} x @param {number} y @param {number} z @param {number} w @param {number} h */
  const add = (x, y, z, w, h) => {
    e.set(rng.range(-0.25, 0.25), rng.range(0, 6.28), rng.range(-0.25, 0.25));
    m.compose(p.set(x, y, z), q.setFromEuler(e), s.set(w, h, w * rng.range(0.75, 1.1)));
    matrices.push(m.clone());
  };
  if (sea) {
    // Dicht um die Insel, nach außen lichter; jeder Ballen bekommt ein, zwei kleinere Begleiter.
    for (let n = 0; n < 190; n++) {
      const r = 6 + Math.pow(rng.next(), 1.6) * (PUFF_FIELD - 8);
      const a = rng.range(0, Math.PI * 2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const size = rng.range(3.2, 6.5) * (1 + r / 260);
      const y = ABYSS_Y + rng.range(-0.4, 0.5);
      add(x, y, z, size, size * rng.range(0.34, 0.5));
      const companions = rng.int(1, 2);
      for (let k = 0; k < companions; k++) {
        const b = rng.range(0, Math.PI * 2);
        const cs = size * rng.range(0.45, 0.7);
        add(x + Math.cos(b) * size * 0.7, y + rng.range(0, 0.5), z + Math.sin(b) * size * 0.7, cs, cs * rng.range(0.4, 0.6));
      }
    }
  } else {
    // Wenige Wolken auf Inselhöhe: hinter und neben der Insel etwas höher, vor ihr nur tief, damit nichts das Spielfeld verdeckt.
    for (let n = 0; n < 11; n++) {
      const back = n % 3 !== 0;
      const z = back ? -rng.range(halfZ + 7, halfZ + 34) : rng.range(halfZ + 9, halfZ + 26);
      const y = back ? rng.range(0.5, 7) : rng.range(-6, -3);
      const x = rng.range(-CLOUD_BOX, CLOUD_BOX);
      const size = rng.range(1.6, 2.8);
      add(x, y, z, size * 1.2, size * 0.5);
      add(x + size * 0.95, y + size * 0.08, z + rng.range(-0.4, 0.4), size * 0.8, size * 0.4);
      add(x - size * 0.9, y - size * 0.02, z + rng.range(-0.4, 0.4), size * 0.7, size * 0.34);
      if (rng.chance(0.6)) add(x + size * 0.2, y + size * 0.28, z + rng.range(-0.3, 0.3), size * 0.75, size * 0.42);
    }
    void halfX;
  }
  const uniforms = {
    uTime: { value: 0 },
    uWeight: { value: 0 },
    uLit: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uWrap: { value: sea ? PUFF_FIELD : CLOUD_BOX },
    uSpeed: { value: sea ? 0.35 : 0.5 },
    uRound: { value: sea ? 1 : 0 },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.006 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWeight;
      uniform float uWrap;
      uniform float uSpeed;
      uniform float uRound;
      varying vec3 vWorld;
      varying float vUp;
      void main() {
        vec3 origin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        // Langsame Drift entlang x, am Rand des Feldes laufen die Ballen wieder herein.
        float x = mod(origin.x + uTime * uSpeed + uWrap, 2.0 * uWrap) - uWrap;
        float edge = mix(abs(x), length(vec2(x, origin.z)), uRound);
        float grow = uWeight * (1.0 - smoothstep(uWrap * 0.8, uWrap, edge));
        // Sanftes Atmen, je Ballen versetzt.
        grow *= 1.0 + 0.04 * sin(uTime * 0.4 + origin.z * 1.7 + origin.x);
        vec3 local = (instanceMatrix * vec4(position, 0.0)).xyz * grow;
        vec3 world = vec3(x, origin.y, origin.z) + local;
        vWorld = world;
        vUp = position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uSunDir;
      varying vec3 vWorld;
      varying float vUp;
      ${FOG_GLSL}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 l = normalize(uSunDir + vec3(0.0, 0.8, 0.0));
        float light = clamp(dot(n, l) * 0.5 + 0.5, 0.0, 1.0);
        light = mix(light, smoothstep(-0.7, 0.9, vUp), 0.45);
        vec3 col = mix(uShade, uLit, light);
        col = applyFog(col, length(cameraPosition - vWorld));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, matrices.length);
  matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = sea ? 'abyss:cloudsea' : 'abyss:clouds';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, uniforms, full: matrices.length };
}

/** Dunstschichten: drei große, weich gemusterte Schleier übereinander. */
function createMist() {
  const uniforms = {
    uTime: { value: 0 },
    uWeight: { value: 0 },
    uColor: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uIsland: { value: new THREE.Vector2(11, 8) },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.006 },
  };
  const layers = 3;
  const positions = [];
  const layer = [];
  const index = [];
  const size = 240;
  for (let k = 0; k < layers; k++) {
    const y = 1.3 + k * 1.5;
    const base = k * 4;
    positions.push(-size, y, -size, size, y, -size, size, y, size, -size, y, size);
    layer.push(k, k, k, k);
    index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 1));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float aLayer;
      varying vec3 vWorld;
      varying float vLayer;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vLayer = aLayer;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWeight;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      varying vec3 vWorld;
      varying float vLayer;
      ${FOG_GLSL}
      ${ISLAND_GLSL}
      ${NOISE_GLSL}
      void main() {
        vec2 p = vWorld.xz;
        float drift = uTime * (0.25 + vLayer * 0.12);
        float scale = 0.05 + vLayer * 0.022;
        float n = vnoise(p * scale + vec2(drift * 0.1, vLayer * 7.3)) * 0.65 + vnoise(p * scale * 2.7 - vec2(drift * 0.16, 3.1)) * 0.35;
        // Obere Schichten sind lichter und reißen stärker auf.
        float cover = smoothstep(0.3 + vLayer * 0.07, 0.72, n);
        float alpha = cover * (0.8 - vLayer * 0.16);
        // Um die Felsflanken herum bleibt der Dunst offen, damit keine Schnittkanten entstehen.
        alpha *= smoothstep(-1.5 - vLayer * 1.2, 2.5, islandDistance(p, -3.0 - vLayer * 1.5));
        float r = length(p);
        alpha *= 1.0 - smoothstep(110.0, 230.0, r);
        vec3 col = mix(uColor, uColor2, smoothstep(0.4, 0.8, n) * (0.55 + vLayer * 0.22));
        col = applyFog(col, length(cameraPosition - vWorld));
        gl_FragColor = vec4(col, alpha * uWeight);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'abyss:mist';
  mesh.position.y = ABYSS_Y;
  mesh.frustumCulled = false;
  mesh.renderOrder = -890;
  return { mesh, uniforms };
}

/** Lichtermeer: tausende kleine Lichter entlang eines Straßenrasters, als ein einziges Punkte-Objekt. */
function createCity() {
  const rng = makeRng(2050);
  /** @type {number[]} */
  const pts = [];
  const block = 3;
  const reach = 120;
  /** Viertel: weiche Flecken, in denen die Stadt dichter oder dunkler (Parks, Wasser) ist. @param {number} x @param {number} z */
  const district = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.052 - 0.4) + 0.25 * Math.sin((x + z) * 0.11);
  /** @param {number} x @param {number} z @param {number} size @param {number} tone */
  const light = (x, z, size, tone) => pts.push(x, z, size, tone);
  // Straßen: Lichterketten auf einem Raster; jede vierte Straße ist eine helle Hauptstraße.
  for (let dir = 0; dir < 2; dir++) {
    for (let line = -Math.floor(reach / block); line <= Math.floor(reach / block); line++) {
      const main = ((line % 4) + 4) % 4 === 0;
      const step = main ? 0.5 : 1;
      const c = line * block;
      for (let d = -reach; d <= reach; d += step) {
        const x = dir === 0 ? c : d;
        const z = dir === 0 ? d : c;
        const r = Math.hypot(x, z);
        if (r > reach || r < 4) continue;
        const keep = (main ? 0.95 : 0.55) * Math.min(1, district(x, z) + (main ? 0.5 : 0.05)) * (1 - 0.6 * (r / reach));
        if (rng.next() > keep) continue;
        light(x + rng.range(-0.08, 0.08), z + rng.range(-0.08, 0.08), main ? rng.range(0.85, 1.1) : rng.range(0.5, 0.75), main ? rng.range(0.1, 0.5) : rng.range(0.3, 0.9));
      }
    }
  }
  // Fenster: Häufchen im Inneren der Blöcke, vor allem in den dichten Vierteln.
  for (let n = 0; n < 7000; n++) {
    const r = 5 + Math.pow(rng.next(), 1.25) * (reach - 5);
    const a = rng.range(0, Math.PI * 2);
    const bx = (Math.floor((Math.cos(a) * r) / block) + 0.5) * block;
    const bz = (Math.floor((Math.sin(a) * r) / block) + 0.5) * block;
    if (rng.next() > district(bx, bz) + 0.15) continue;
    light(bx + rng.range(-1, 1), bz + rng.range(-1, 1), rng.chance(0.06) ? rng.range(1.2, 1.6) : rng.range(0.4, 0.8), rng.range(0.25, 1));
  }
  // Bis zum Horizont: verstreute Lichter ferner Vororte.
  for (let n = 0; n < 2600; n++) {
    const r = reach * 0.8 + Math.pow(rng.next(), 1.5) * 220;
    const a = rng.range(0, Math.PI * 2);
    light(Math.cos(a) * r, Math.sin(a) * r, rng.range(0.9, 2.2), rng.range(0.2, 1));
  }
  // Mischen, damit eine halbierte Zeichenmenge (niedrige Grafikstufe) gleichmäßig ausdünnt.
  const count = pts.length / 4;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  const positions = new Float32Array(count * 3);
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const k = order[i] * 4;
    positions[i * 3] = pts[k];
    positions[i * 3 + 1] = 0.06;
    positions[i * 3 + 2] = pts[k + 1];
    data[i * 3] = pts[k + 2];
    data[i * 3 + 1] = pts[k + 3];
    data[i * 3 + 2] = rng.next();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aData', new THREE.BufferAttribute(data, 3));
  const uniforms = {
    uTime: { value: 0 },
    uWeight: { value: 0 },
    uColor: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uScale: { value: 600 },
    uFogDensity: { value: 0.006 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 aData;
      uniform float uTime;
      uniform float uWeight;
      uniform float uScale;
      uniform float uFogDensity;
      varying float vTone;
      varying float vBright;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = viewMatrix * world;
        float dist = -view.z;
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(aData.x * uScale * 0.3 / dist, 1.6, 9.0);
        vTone = aData.y;
        float twinkle = 0.8 + 0.2 * sin(uTime * (0.6 + aData.z * 1.6) + aData.z * 40.0);
        float f = dist * uFogDensity * 0.8;
        // Die Lichter gehen der Reihe nach an bzw. aus, wenn die Stadt ein- oder ausgeblendet wird.
        float on = smoothstep(aData.z * 0.7, aData.z * 0.7 + 0.3, uWeight);
        vBright = twinkle * exp(-f * f) * on;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uColor2;
      varying float vTone;
      varying float vBright;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = 1.0 - smoothstep(0.12, 0.5, length(c));
        // Die meisten Lichter tragen die Leuchtfarbe, einige sind fast weiß, wenige gedämpft.
        vec3 col = mix(uColor2, vec3(1.0), smoothstep(0.75, 1.0, vTone) * 0.7);
        col = mix(col, uColor2 * 0.55 + uColor, smoothstep(0.35, 0.0, vTone) * 0.5);
        gl_FragColor = vec4(col * 1.15 * a * vBright, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'abyss:city';
  points.position.y = ABYSS_Y;
  points.frustumCulled = false;
  points.renderOrder = -880;
  return { points, uniforms, full: count };
}

export class Abyss {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'abyss';
    this.surface = createSurface();
    this.group.add(this.surface.mesh);
    this.halfX = 11;
    this.halfZ = 8;
    /** @type {ReturnType<typeof createPuffs> | null} */
    this.cloudSea = null;
    /** @type {ReturnType<typeof createPuffs> | null} */
    this.clouds = null;
    /** @type {ReturnType<typeof createMist> | null} */
    this.mist = null;
    /** @type {ReturnType<typeof createCity> | null} */
    this.city = null;
    /** @type {AbyssKind} */
    this.kindFrom = 'clouds';
    /** @type {AbyssKind} */
    this.kindTo = 'clouds';
    this.colorFrom = new THREE.Color();
    this.color2From = new THREE.Color();
    this.colorTo = new THREE.Color();
    this.color2To = new THREE.Color();
    this.t = 1;
    this.detail = 1;
    this.pixelHeight = 800;
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this._white = new THREE.Color(1, 1, 1);
  }

  /**
   * Maße der Insel (halbe Ausdehnung in Feldern) für Schatten, Saum und die Lage der Wolken.
   * @param {number} halfX
   * @param {number} halfZ
   */
  setIsland(halfX, halfZ) {
    this.halfX = halfX;
    this.halfZ = halfZ;
    this.surface.uniforms.uIsland.value.set(halfX, halfZ);
    if (this.mist) this.mist.uniforms.uIsland.value.set(halfX, halfZ);
    if (this.clouds) {
      this.group.remove(this.clouds.mesh);
      this.clouds.mesh.geometry.dispose();
      /** @type {THREE.Material} */ (this.clouds.mesh.material).dispose();
      this.clouds.mesh.dispose();
      this.clouds = null;
    }
  }

  /**
   * Setzt die Umgebung sofort.
   * @param {AbyssTheme} theme
   */
  set(theme) {
    this.kindFrom = theme.kind;
    this.kindTo = theme.kind;
    this.colorTo.set(theme.color);
    this.color2To.set(theme.color2);
    this.colorFrom.copy(this.colorTo);
    this.color2From.copy(this.color2To);
    this.t = 1;
  }

  /**
   * Beginnt die Überblendung vom aktuellen Zustand zu einer neuen Umgebung; `blend(t)` führt sie.
   * @param {AbyssTheme} theme
   */
  beginBlend(theme) {
    this.kindFrom = this.kindTo;
    this.colorFrom.copy(this.colorTo);
    this.color2From.copy(this.color2To);
    this.kindTo = theme.kind;
    this.colorTo.set(theme.color);
    this.color2To.set(theme.color2);
    this.t = 0;
  }

  /** @param {number} t 0..1 */
  blend(t) {
    this.t = t;
  }

  /**
   * Feinheit: 1 = alles, 0.5 = halb so viele Wolkenballen und Lichter.
   * @param {number} detail
   */
  setDetail(detail) {
    this.detail = detail;
    if (this.cloudSea) this.cloudSea.mesh.count = Math.round(this.cloudSea.full * detail);
    if (this.city) this.city.points.geometry.setDrawRange(0, Math.round(this.city.full * detail));
  }

  /**
   * Gewicht einer Art im aktuellen Überblendzustand.
   * @param {AbyssKind} kind
   */
  _weight(kind) {
    if (this.kindFrom === this.kindTo) return kind === this.kindTo ? 1 : 0;
    if (kind === this.kindTo) return this.t;
    if (kind === this.kindFrom) return 1 - this.t;
    return 0;
  }

  /**
   * Farben einer Schicht: Bleibt die Art gleich, wandern die Farben; wechselt sie, behält jede Schicht ihre eigenen.
   * @param {AbyssKind} kind
   * @param {THREE.Color} out
   * @param {THREE.Color} out2
   */
  _colors(kind, out, out2) {
    if (this.kindFrom === this.kindTo) {
      out.lerpColors(this.colorFrom, this.colorTo, this.t);
      out2.lerpColors(this.color2From, this.color2To, this.t);
    } else if (kind === this.kindTo) {
      out.copy(this.colorTo);
      out2.copy(this.color2To);
    } else {
      out.copy(this.colorFrom);
      out2.copy(this.color2From);
    }
  }

  /**
   * @param {number} time Uhr der Welt
   * @param {LightState} light aktuelle (überblendete) Lichtstimmung
   */
  update(time, light) {
    const t = this.t;
    const a = KIND_PARAMS[this.kindFrom];
    const b = KIND_PARAMS[this.kindTo];
    const c = this._c;
    const c2 = this._c2;
    const fogDensity = Math.max(light.fogDensity * 0.85, 0.0055);
    const e = (light.sunElevation * Math.PI) / 180;
    const az = (light.sunAzimuth * Math.PI) / 180;
    sunDir.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));

    // Grundfläche: Farbe und Kennwerte wandern von der alten zur neuen Art.
    const su = this.surface.uniforms;
    su.uTime.value = time;
    su.uColor.value.copy(this.colorFrom).lerp(this.color2From, a.mix);
    c.copy(this.colorTo).lerp(this.color2To, b.mix);
    su.uColor.value.lerp(c, t);
    su.uColor2.value.lerpColors(this.color2From, this.color2To, t);
    su.uWave.value = a.wave + (b.wave - a.wave) * t;
    su.uGlint.value = (a.glint + (b.glint - a.glint) * t) * Math.min(1, light.sunIntensity / 2) * (1 - light.stars);
    su.uFoam.value = a.foam + (b.foam - a.foam) * t;
    su.uShadow.value = (a.shadow + (b.shadow - a.shadow) * t) * Math.min(1, light.sunIntensity / 2);
    su.uCity.value = this._weight('city');
    su.uSunColor.value.copy(light.sunColor);
    su.uSunDir.value.copy(sunDir);
    su.uFogColor.value.copy(light.fogColor);
    su.uFogDensity.value = fogDensity;

    // Wolkenmeer
    const wClouds = this._weight('clouds');
    if (wClouds > 0) this.prepare('clouds');
    if (this.cloudSea) {
      const u = this.cloudSea.uniforms;
      this.cloudSea.mesh.visible = wClouds > 0;
      if (wClouds > 0) {
        this._colors('clouds', c, c2);
        u.uTime.value = time;
        u.uWeight.value = wClouds * (2 - wClouds);
        u.uLit.value.copy(c);
        u.uShade.value.copy(c2);
        u.uSunDir.value.copy(sunDir);
        u.uFogColor.value.copy(light.fogColor);
        u.uFogDensity.value = fogDensity;
      }
    }

    // Dunst
    const wMist = this._weight('mist');
    if (wMist > 0) this.prepare('mist');
    if (this.mist) {
      const u = this.mist.uniforms;
      this.mist.mesh.visible = wMist > 0;
      if (wMist > 0) {
        this._colors('mist', c, c2);
        u.uTime.value = time;
        u.uWeight.value = wMist;
        u.uColor.value.copy(c);
        u.uColor2.value.copy(c2);
        u.uFogColor.value.copy(light.fogColor);
        u.uFogDensity.value = fogDensity;
      }
    }

    // Lichtermeer
    const wCity = this._weight('city');
    if (wCity > 0) this.prepare('city');
    if (this.city) {
      const u = this.city.uniforms;
      this.city.points.visible = wCity > 0;
      if (wCity > 0) {
        this._colors('city', c, c2);
        u.uTime.value = time;
        u.uWeight.value = wCity;
        u.uScale.value = this.pixelHeight;
        u.uColor.value.copy(c);
        u.uColor2.value.copy(c2);
        u.uFogDensity.value = fogDensity;
      }
    }

    // Einzelne Wolken auf Inselhöhe: nur solange es hell ist.
    const day = (1 - light.stars) * Math.min(1, Math.max(0, (light.sunIntensity - 0.9) / 1.2));
    if (day > 0.01 && !this.clouds) {
      this.clouds = createPuffs(false, this.halfX, this.halfZ);
      this.group.add(this.clouds.mesh);
    }
    if (this.clouds) {
      const u = this.clouds.uniforms;
      this.clouds.mesh.visible = day > 0.01;
      if (day > 0.01) {
        u.uTime.value = time;
        u.uWeight.value = day;
        // Die Wolken nehmen die Farbe des Himmelslichts an: oben hell, unten in der Farbe des Horizonts.
        u.uLit.value.copy(light.hemiSky).lerp(this._white, 0.55);
        u.uShade.value.copy(light.skyHorizon).lerp(light.hemiSky, 0.35).multiplyScalar(0.92);
        u.uSunDir.value.copy(sunDir);
        u.uFogColor.value.copy(light.fogColor);
        u.uFogDensity.value = fogDensity;
      }
    }
  }

  /**
   * Legt die Schicht einer Art an, falls sie fehlt (unsichtbar, bis update() sie braucht). Das Lichtermeer kostet beim
   * ersten Mal einige zehn Millisekunden; die Welt ruft dies vor einer Zeitenwende in ruhigen Bildern auf.
   * @param {AbyssKind} kind
   */
  prepare(kind) {
    if (kind === 'clouds' && !this.cloudSea) {
      this.cloudSea = createPuffs(true, this.halfX, this.halfZ);
      this.cloudSea.mesh.count = Math.round(this.cloudSea.full * this.detail);
      this.cloudSea.mesh.visible = false;
      this.group.add(this.cloudSea.mesh);
    } else if (kind === 'mist' && !this.mist) {
      this.mist = createMist();
      this.mist.uniforms.uIsland.value.set(this.halfX, this.halfZ);
      this.mist.mesh.visible = false;
      this.group.add(this.mist.mesh);
    } else if (kind === 'city' && !this.city) {
      this.city = createCity();
      this.city.points.geometry.setDrawRange(0, Math.round(this.city.full * this.detail));
      this.city.points.visible = false;
      this.group.add(this.city.points);
    }
  }

  /**
   * Scheinbare Größe der Lichtpunkte an die Höhe des Bildes anpassen.
   * @param {number} pixelHeight Höhe des Zeichenpuffers in Pixeln
   */
  setViewport(pixelHeight) {
    this.pixelHeight = pixelHeight;
  }

  dispose() {
    this.group.traverse((object) => {
      const mesh = /** @type {THREE.Mesh} */ (object);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) /** @type {THREE.Material} */ (mesh.material).dispose();
    });
    this.group.removeFromParent();
  }
}

const sunDir = new THREE.Vector3();
