// @ts-check
// Anzeigen, die auf der Insel liegen oder über ihr schweben: das Bauraster, der Lichtsaum der Zeitwelle,
// die gepunkteten Luftlinien der Flieger (je Satz der Wege) und das Leuchten neuer oder kommender Wegstücke.

import * as THREE from 'three';
import { samplePath } from '../../sim/path.js';
import { InstancedModel, makeAnimCtx } from '../instances.js';
import { FLY_HEIGHT } from '../layout.js';
import { PATH_DEPTH, PATH_NOW } from '../terrain.js';

/** @import { ModelSpec } from '../../types/model' */
/** @import { ModelMaterials } from '../instances.js' */
/** @import { Terrain } from '../terrain.js' */
/** @import { MapInfo } from './mapinfo.js' */

const mat = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const sample = { x: 0, z: 0, dx: 0, dz: 1 };

/** Abstand der Wölkchen auf einer Luftlinie in Feldern. */
const PUFF_SPACING = 0.85;

export class Overlays {
  /**
   * @param {ModelMaterials} materials
   * @param {(id: string) => ModelSpec} resolveModel
   */
  constructor(materials, resolveModel) {
    this.group = new THREE.Group();
    this.group.name = 'overlays';
    /** @type {MapInfo | null} */
    this.info = null;

    // --- Bauraster ---
    this.gridUniforms = { uFade: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') } };
    this.gridMaterial = new THREE.ShaderMaterial({
      uniforms: this.gridUniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: /* glsl */ `
        attribute float aOn;
        varying vec2 vUv;
        varying float vOn;
        varying vec2 vWorld;
        void main() {
          vUv = uv;
          vOn = aOn;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vOn;
        varying vec2 vWorld;
        void main() {
          // Abgerundetes Quadrat je Feld: zarte Kontur, an den Ecken etwas kräftiger, kaum gefüllt.
          vec2 p = abs(vUv - 0.5);
          float r = 0.13;
          vec2 q = p - (0.43 - r);
          float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
          float line = 1.0 - smoothstep(0.012, 0.045, abs(d + 0.022));
          float corner = smoothstep(0.2, 0.42, min(p.x, p.y));
          float fill = 1.0 - smoothstep(-0.03, 0.0, d);
          // Eine sanfte Welle läuft diagonal über das Raster, damit es lebt und nicht wie eine Tabelle wirkt.
          float shimmer = 0.85 + 0.15 * sin(uTime * 1.6 - (vWorld.x + vWorld.y) * 0.55);
          float alpha = (line * (0.16 + 0.3 * corner) + fill * 0.045) * shimmer * uFade * vOn;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(uColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    /** @type {THREE.Mesh | null} */
    this.grid = null;
    /** @type {THREE.BufferAttribute | null} */
    this.gridOn = null;
    /** Position des ersten Vertex je Feld im Raster-Netz (Index = tz * width + tx), -1 = kein Baufeld. */
    this.gridSlot = new Int32Array(0);
    this.gridTarget = 0;
    this.gridFade = 0;

    // --- Lichtsaum der Zeitwelle ---
    this.waveUniforms = {
      uOrigin: { value: new THREE.Vector2() },
      uRadius: { value: 0 },
      uStrength: { value: 0 },
      uColor: { value: new THREE.Color('#ffe7ad') },
    };
    this.waveMaterial = new THREE.ShaderMaterial({
      uniforms: this.waveUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uOrigin;
        uniform float uRadius;
        uniform float uStrength;
        uniform vec3 uColor;
        varying vec2 vWorld;
        void main() {
          float d = length(vWorld - uOrigin) - uRadius;
          // Heller, schmaler Kern, weicher Hof davor und ein langes sanftes Nachleuchten dahinter.
          float core = exp(-d * d / 0.07);
          float halo = exp(-d * d / 1.1);
          float trail = d < 0.0 ? exp(d / 2.6) * 0.16 : 0.0;
          float a = (core * 0.7 + halo * 0.3 + trail) * uStrength;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    /** @type {THREE.Mesh | null} */
    this.wave = null;

    // --- Luftlinien ---
    this.puffs = new InstancedModel(resolveModel('fx.wolke'), materials, { capacity: 64, castShadow: false, receiveShadow: false });
    this.group.add(this.puffs.group);
    this.puffs.group.visible = false;
    this.flightTarget = 0;
    this.flightFade = 0;
    /** Luftlinien als Strecken bzw. Kurven: Länge und Abtastfunktion. @type {{ length: number, at: (d: number) => void }[]} */
    this.lines = [];
    /** Luftlinien je Satz der Wege. @type {{ length: number, at: (d: number) => void }[][]} */
    this.setLines = [];
    this.ctx = makeAnimCtx();

    // --- Leuchten neuer oder kommender Wegstücke ---
    this.glowUniforms = { uStrength: { value: 0 }, uColor: { value: new THREE.Color('#ffe9b0') } };
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: this.glowUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      vertexShader: /* glsl */ `
        attribute float aLevel;
        attribute float aLinks;
        varying vec2 vUv;
        varying float vLevel;
        varying float vLinks;
        void main() {
          vUv = uv;
          vLevel = aLevel;
          vLinks = aLinks;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vLevel;
        varying float vLinks;
        float seg(vec2 p, vec2 b) {
          vec2 a = vec2(0.5);
          vec2 s = b - a;
          float t = clamp(dot(p - a, s) / dot(s, s), 0.0, 1.0);
          return length(p - a - s * t);
        }
        void main() {
          float links = floor(vLinks + 0.5);
          float d = length(vUv - 0.5);
          if (mod(links, 2.0) > 0.5) d = min(d, seg(vUv, vec2(0.5, 0.0)));
          if (mod(floor(links / 2.0), 2.0) > 0.5) d = min(d, seg(vUv, vec2(1.0, 0.5)));
          if (mod(floor(links / 4.0), 2.0) > 0.5) d = min(d, seg(vUv, vec2(0.5, 1.0)));
          if (mod(floor(links / 8.0), 2.0) > 0.5) d = min(d, seg(vUv, vec2(0.0, 0.5)));
          // Heller Kern auf der Mittellinie, weicher Hof bis an die Kanten des Weges.
          float core = 1.0 - smoothstep(0.04, 0.2, d);
          float halo = 1.0 - smoothstep(0.1, 0.5, d);
          float a = (core * 0.55 + halo * 0.45) * vLevel * uStrength;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    /** @type {THREE.Mesh | null} */
    this.glow = null;
    /** @type {THREE.BufferAttribute | null} */
    this.glowLevel = null;
    /** @type {Terrain | null} */
    this.terrain = null;
    /** Ziel und aktueller Wert je Wegfeld (Index wie Terrain.pathIndexOf). */
    this.glowTarget = new Float32Array(0);
    this.glowNow = new Float32Array(0);
    /** 0 = aus, 1 = neues Stück (pulsiert, dann leise), 2 = kommendes Stück (atmet). */
    this.glowMode = 0;
    /** Sekunden seit Beginn der Hervorhebung (negativ = wartet noch). */
    this.glowTime = 0;
    this.glowFade = 0;
  }

  /**
   * Baut Raster, Lichtsaum und Luftlinien für eine Karte.
   * @param {MapInfo} info
   * @param {Terrain} terrain
   */
  build(info, terrain) {
    this.info = info;
    if (this.grid) {
      this.group.remove(this.grid);
      this.grid.geometry.dispose();
    }
    if (this.wave) {
      this.group.remove(this.wave);
      this.wave.geometry.dispose();
    }
    const { width, height } = info;
    /** @type {number[]} */
    const positions = [];
    /** @type {number[]} */
    const uvs = [];
    this.gridSlot = new Int32Array(width * height).fill(-1);
    let vertex = 0;
    const y = 0.012;
    for (let tz = 0; tz < height; tz++) {
      for (let tx = 0; tx < width; tx++) {
        if (!info.isBuildable(tx, tz)) continue;
        const x0 = tx - width / 2;
        const z0 = tz - height / 2;
        positions.push(x0, y, z0, x0, y, z0 + 1, x0 + 1, y, z0 + 1, x0, y, z0, x0 + 1, y, z0 + 1, x0 + 1, y, z0);
        uvs.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
        this.gridSlot[tz * width + tx] = vertex;
        vertex += 6;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.gridOn = new THREE.BufferAttribute(new Float32Array(vertex).fill(1), 1);
    this.gridOn.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aOn', this.gridOn);
    this.grid = new THREE.Mesh(geometry, this.gridMaterial);
    this.grid.name = 'grid';
    this.grid.renderOrder = 4;
    this.grid.visible = this.gridFade > 0.003;
    this.group.add(this.grid);

    this.wave = new THREE.Mesh(terrain.topGeometry(0.02), this.waveMaterial);
    this.wave.name = 'wave';
    this.wave.renderOrder = 5;
    this.wave.visible = false;
    this.group.add(this.wave);

    // Luftlinien je Satz: gerade vom Eingang zur Basis, oder dem Weg entlang, wenn die Karte bzw. Stufe das verlangt.
    this.setLines = info.sets.map((set) =>
      set.gates.map((gate, i) => {
        const entrance = info.entrances[gate];
        if (set.follow) {
          const curve = set.curves[i];
          return { length: curve.length, at: (/** @type {number} */ d) => void samplePath(curve, d, sample) };
        }
        const dx = info.base.x - entrance.x;
        const dz = info.base.z - entrance.z;
        const length = Math.hypot(dx, dz);
        return {
          length,
          at: (/** @type {number} */ d) => {
            sample.x = entrance.x + (dx * d) / length;
            sample.z = entrance.z + (dz * d) / length;
            sample.dx = dx / length;
            sample.dz = dz / length;
          },
        };
      }));
    this.lines = this.setLines[0] ?? [];

    // Leuchten der Wegstücke: ein Viereck je Wegfeld aller Stufen.
    if (this.glow) {
      this.group.remove(this.glow);
      this.glow.geometry.dispose();
    }
    this.terrain = terrain;
    const n = terrain.pathCount;
    /** @type {number[]} */
    const gp = [];
    /** @type {number[]} */
    const guv = [];
    /** @type {number[]} */
    const glinks = [];
    for (let p = 0; p < n; p++) {
      const x0 = terrain.pathTx[p] - width / 2;
      const z0 = terrain.pathTz[p] - height / 2;
      gp.push(x0, 0, z0, x0, 0, z0 + 1, x0 + 1, 0, z0 + 1, x0, 0, z0, x0 + 1, 0, z0 + 1, x0 + 1, 0, z0);
      guv.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
      const l = info.links(terrain.pathTx[p], terrain.pathTz[p]);
      for (let k = 0; k < 6; k++) glinks.push(l);
    }
    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    glowGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
    glowGeometry.setAttribute('aLinks', new THREE.Float32BufferAttribute(glinks, 1));
    this.glowLevel = new THREE.BufferAttribute(new Float32Array(n * 6), 1);
    this.glowLevel.setUsage(THREE.DynamicDrawUsage);
    glowGeometry.setAttribute('aLevel', this.glowLevel);
    this.glow = new THREE.Mesh(glowGeometry, this.glowMaterial);
    this.glow.name = 'path-glow';
    this.glow.renderOrder = 5;
    this.glow.visible = false;
    this.group.add(this.glow);
    this.glowTarget = new Float32Array(n);
    this.glowNow = new Float32Array(n);
    this.glowMode = 0;
    this.glowFade = 0;
  }

  /**
   * Luftlinien eines Satzes der Wege zeigen.
   * @param {number} set
   */
  setPathSet(set) {
    this.lines = this.setLines[set] ?? this.setLines[0] ?? [];
  }

  /**
   * Wegstücke leuchten lassen.
   * @param {Float32Array | null} levels je Wegfeld (Index wie Terrain.pathIndexOf) 0..1; null = aus
   * @param {number} mode 1 = neues Stück (pulsiert einige Male, dann leise), 2 = kommendes Stück (atmet ruhig)
   * @param {number} [delay] Sekunden bis zum Beginn
   */
  setHighlight(levels, mode, delay = 0) {
    if (!levels) {
      this.glowTarget.fill(0);
      return;
    }
    this.glowTarget.set(levels.subarray(0, this.glowTarget.length));
    this.glowMode = mode;
    this.glowTime = -delay;
  }

  /** @param {boolean} visible */
  setGrid(visible) {
    this.gridTarget = visible ? 1 : 0;
  }

  /** @param {boolean} visible */
  setFlightLines(visible) {
    this.flightTarget = visible ? 1 : 0;
  }

  /**
   * Belegte Felder zeigen kein Raster.
   * @param {number} tx
   * @param {number} tz
   * @param {boolean} occupied
   */
  setTileOccupied(tx, tz, occupied) {
    const info = this.info;
    if (!info || !this.gridOn || tx < 0 || tz < 0 || tx >= info.width || tz >= info.height) return;
    const slot = this.gridSlot[tz * info.width + tx];
    if (slot < 0) return;
    const array = /** @type {Float32Array} */ (this.gridOn.array);
    for (let k = 0; k < 6; k++) array[slot + k] = occupied ? 0 : 1;
    this.gridOn.needsUpdate = true;
  }

  /**
   * Lichtsaum der Zeitwelle setzen; strength 0 blendet ihn aus.
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} strength
   */
  setWave(x, z, radius, strength) {
    this.waveUniforms.uOrigin.value.set(x, z);
    this.waveUniforms.uRadius.value = radius;
    this.waveUniforms.uStrength.value = strength;
    if (this.wave) this.wave.visible = strength > 0.004;
  }

  /**
   * @param {number} time Uhr der Welt
   * @param {number} dt
   */
  update(time, dt) {
    const k = Math.min(1, dt * 6);
    this.gridFade += (this.gridTarget - this.gridFade) * k;
    if (Math.abs(this.gridTarget - this.gridFade) < 0.003) this.gridFade = this.gridTarget;
    this.gridUniforms.uFade.value = this.gridFade;
    this.gridUniforms.uTime.value = time;
    if (this.grid) this.grid.visible = this.gridFade > 0.003;

    this._updateGlow(dt);

    this.flightFade += (this.flightTarget - this.flightFade) * Math.min(1, dt * 4);
    if (Math.abs(this.flightTarget - this.flightFade) < 0.003) this.flightFade = this.flightTarget;
    const fade = this.flightFade;
    const puffs = this.puffs;
    puffs.group.visible = fade > 0.003;
    if (fade <= 0.003) return;
    puffs.begin();
    const ctx = this.ctx;
    ctx.t = time;
    const flow = (time * 0.4) % PUFF_SPACING;
    for (let li = 0; li < this.lines.length; li++) {
      const line = this.lines[li];
      const start = 0.7;
      const end = line.length - 0.9;
      for (let d = start + flow; d < end; d += PUFF_SPACING) {
        line.at(d);
        // An beiden Enden wachsen bzw. schrumpfen die Wölkchen: Sie quellen aus dem Portal und vergehen vor der Basis.
        const taper = Math.min(1, (d - start) / 1.2, (end - d) / 1.2);
        const index = Math.round((d - flow - start) / PUFF_SPACING);
        // Einblenden der Reihe nach vom Eingang her.
        const reveal = Math.min(1, Math.max(0, fade * (1 + line.length * 0.08) - d * 0.08));
        const s = taper * reveal * (0.9 + 0.12 * Math.sin(time * 1.7 + index * 1.3 + li));
        if (s <= 0.01) continue;
        pos.set(sample.x, FLY_HEIGHT - 0.12 + Math.sin(time * 1.1 + d * 1.9) * 0.04, sample.z);
        quat.setFromAxisAngle(UP, Math.atan2(sample.dx, sample.dz) + Math.PI / 2 + index * 2.4);
        scl.set(s, s, s);
        mat.compose(pos, quat, scl);
        ctx.seed = (index * 0.37) % 1;
        puffs.add(mat, ctx);
      }
    }
    puffs.end();
  }

  /**
   * Leuchten der Wegstücke fortschreiben: weich ein- und ausblenden, pulsieren bzw. atmen.
   * @param {number} dt
   */
  _updateGlow(dt) {
    const glow = this.glow;
    const attr = this.glowLevel;
    const terrain = this.terrain;
    if (!glow || !attr || !terrain) return;
    this.glowTime += dt;
    const started = this.glowTime >= 0;
    let any = false;
    let moving = false;
    const step = Math.min(1, dt * 2.5);
    const array = /** @type {Float32Array} */ (attr.array);
    const pos = /** @type {THREE.BufferAttribute} */ (glow.geometry.getAttribute('position'));
    const pa = /** @type {Float32Array} */ (pos.array);
    for (let p = 0; p < this.glowNow.length; p++) {
      const target = started ? this.glowTarget[p] : 0;
      let v = this.glowNow[p];
      if (v !== target) {
        v += (target - v) * step;
        if (Math.abs(target - v) < 0.004) v = target;
        this.glowNow[p] = v;
        moving = true;
        for (let k = 0; k < 6; k++) array[p * 6 + k] = v;
        // Auf dem Belag des Feldes liegen: eingesenkt, wenn es jetzt Weg ist.
        const y = (terrain.state[p] === PATH_NOW ? -PATH_DEPTH : 0) + 0.012;
        for (let k = 0; k < 6; k++) pa[(p * 6 + k) * 3 + 1] = y;
      }
      if (v > 0.004) any = true;
    }
    if (moving) {
      attr.needsUpdate = true;
      pos.needsUpdate = true;
    }
    glow.visible = any;
    if (!any) return;
    const t = Math.max(0, this.glowTime);
    let strength;
    if (this.glowMode === 1) {
      // Dreimal deutlich aufleuchten, dann leise weiterglimmen.
      const pulse = t < 3.6 ? Math.pow(Math.sin((Math.PI * t) / 1.2), 2) : 0;
      strength = 0.32 + 0.06 * Math.sin(t * 2.2) + 0.68 * pulse;
    } else {
      strength = 0.3 + 0.12 * Math.sin(t * 2.0);
    }
    this.glowUniforms.uStrength.value = strength;
  }

  dispose() {
    this.glow?.geometry.dispose();
    this.glowMaterial.dispose();
    this.grid?.geometry.dispose();
    this.wave?.geometry.dispose();
    this.gridMaterial.dispose();
    this.waveMaterial.dispose();
    this.puffs.dispose();
    this.group.removeFromParent();
  }
}
