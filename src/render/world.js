// @ts-check
// Die Welt: schwebende Insel, Licht und Himmel, Umgebung, Dekoration, Basis und Portale sowie die Zeitwelle,
// die beim Wechsel des Zeitalters über die Insel rollt. Erfüllt den Vertrag `World` aus src/types/render.d.ts.

import * as THREE from 'three';
import { getModel } from '../content/models.js';
import { InstancedModel, makeAnimCtx } from './instances.js';
import { LightRig, LightState, SkyDome } from './look.js';
import { PATH_FORMER, PATH_FUTURE, PATH_NOW, Terrain } from './terrain.js';
import { Abyss } from './world/abyss.js';
import { Ambient } from './world/ambient.js';
import { Dressing } from './world/dressing.js';
import { analyzeMap, computeSpots } from './world/mapinfo.js';
import { SpecialMarks } from './world/marks.js';
import { Overlays } from './world/overlays.js';
import { Traces } from './world/traces.js';

/** @import { Quality } from '../types/app' */
/** @import { AgeDef, MapDef } from '../types/content' */
/** @import { ModelSpec } from '../types/model' */
/** @import { RenderEnv, World } from '../types/render' */
/** @import { MapInfo, Spot } from './world/mapinfo.js' */

/**
 * @typedef {object} WorldOptions
 * @property {(id: string) => ModelSpec} [resolveModel] Ersetzt getModel(), z. B. um fehlende Modelle für Probeaufnahmen zu vertreten
 */

/** Anteil der Dauer, nach dem die Wellenfront den fernsten Punkt der Insel erreicht hat. */
const FRONT_SHARE = 0.74;
/** Zeitpunkt (Anteil der Dauer), zu dem die Basis sich verwandelt. */
const BASE_SWAP_AT = 0.76;
/** Die Front läuft anfangs schneller und wird nach außen etwas langsamer. */
const FRONT_EASE = 1.5;
/** Größe eines Tores, das erst in einer späteren Stufe benutzt wird: ein kleiner, ruhender Wirbel. */
const DORMANT_PORTAL = 0.34;

const mat = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tint = new THREE.Color();

/** @param {number} u */
function smooth(u) {
  const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return t * t * (3 - 2 * t);
}

/** Federndes Aufploppen mit deutlichem Überschwingen (für die Basis). @param {number} u */
function bounce(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 + Math.exp(-5.5 * u) * Math.sin(u * 11 - Math.PI / 2);
}

/** @implements {World} */
class WorldImpl {
  /**
   * @param {RenderEnv} env
   * @param {WorldOptions} opts
   */
  constructor(env, opts) {
    this.env = env;
    this.resolveModel = opts.resolveModel ?? getModel;
    this.group = new THREE.Group();
    this.group.name = 'world';
    // Für Messungen von außen (Entwicklungsseiten, Leistungsanalyse): die Welt zu ihrer Gruppe finden.
    this.group.userData.world = this;
    env.scene.add(this.group);

    this.rig = new LightRig(env.scene, { radius: 16 });
    this.sky = new SkyDome();
    this.group.add(this.sky.mesh);
    this.fog = new THREE.FogExp2(0xffffff, 0.004);
    env.scene.fog = this.fog;
    this.lightFrom = new LightState();
    this.lightTo = new LightState();
    this.light = new LightState();

    this.abyss = new Abyss();
    this.group.add(this.abyss.group);
    this.dressing = new Dressing(env.materials, this.resolveModel);
    this.group.add(this.dressing.group);
    this.marks = new SpecialMarks(env.materials);
    this.group.add(this.marks.group);
    this.overlays = new Overlays(env.materials, this.resolveModel);
    this.group.add(this.overlays.group);
    this.traces = new Traces(env.materials);
    this.group.add(this.traces.group);
    this.ambient = new Ambient();
    this.group.add(this.ambient.points);

    /** @type {Terrain | null} */
    this.terrain = null;
    /** @type {MapInfo | null} */
    this.info = null;
    /** @type {MapDef | null} */
    this.map = null;
    /** @type {Spot[]} */
    this.spots = [];
    /** @type {Quality} */
    this.quality = 'high';

    /** Modelle der Basen (je Kennung eines) und das Portal. @type {Map<string, InstancedModel>} */
    this.baseModels = new Map();
    /** @type {InstancedModel[]} */
    this.baseModelList = [];
    /** @type {InstancedModel | null} */
    this.portalModel = null;
    this.ctx = makeAnimCtx();
    this.flame = 1;
    this.flameShown = 1;
    this.hit = 0;

    this.time = 0;
    this.timeFrozen = false;
    this._ageIndex = 0;
    this._fromAge = 0;
    this._exposure = 1;
    this._bloom = 0.3;
    this._radius = 12;
    this._base = { x: 0, z: 0 };
    /** @type {{ x: number, z: number }[]} */
    this._entrances = [];
    /** Zustand der Zeitwelle. */
    this.tr = { active: false, frozen: false, time: 0, duration: 4.5, x: 0, z: 0, maxR: 20 };
    /** Satz der Wege (Index in info.sets), den die Insel zeigt, und der vor dem laufenden Wechsel. */
    this._set = 0;
    this._setFrom = 0;
    /** Satz, dessen neue Wegstücke nach dem Wechsel aufleuchten sollen (-1 = keiner), und der Hinweis von außen. */
    this._pulseSet = -1;
    /** @type {{ stage: number, kind: 'coming' | 'new' } | null} */
    this._hint = null;
    /** Größe je Tor (weich nachgeführt außerhalb einer Zeitwelle). @type {number[]} */
    this._gateScale = [];
    this._wave = { x: 0, z: 0, radius: 0, progress: 0 };
    this._waveArg = { x: 0, z: 0, radius: 0, softness: 1.6, glow: 0.5 };
    /** Vorbereitung des nächsten Zeitalters in ruhigen Momenten (Modelle bauen, Schichten anlegen), je Aufruf ein Schritt. @type {(() => void)[]} */
    this._warm = [];
    this._warmScheduled = false;
    this._disposed = false;

    /** Zusätzliche Griffe für die Entwicklungsseite; nicht Teil des Vertrags. */
    this.debug = {
      /** Friert die laufende Zeitwelle beim Fortschritt p (0..1) ein. @param {number} p */
      seekTransition: (p) => {
        if (!this.tr.active) return;
        this.tr.time = Math.min(0.9999, Math.max(0, p)) * this.tr.duration;
        this.tr.frozen = true;
      },
      /** Hält die Uhr der Welt bei t Sekunden an (Animation der Umgebung und der Requisiten); Ein- und Ausblendungen laufen weiter. @param {number} t */
      freezeTime: (t) => {
        this.time = t;
        this.timeFrozen = true;
      },
      /** @returns {{ items: number, spots: number, markTriangles: number, traceTriangles: number, set: number }} */
      stats: () => ({ items: this.dressing.count, spots: this.spots.length, markTriangles: this.marks.triangles, traceTriangles: this.traces.triangles, set: this._set }),
    };
  }

  /** @returns {AgeDef} */
  get age() {
    return this.env.content.ages[this._ageIndex];
  }

  get ageIndex() {
    return this._ageIndex;
  }

  get exposure() {
    return this._exposure;
  }

  get bloom() {
    return this._bloom;
  }

  get radius() {
    return this._radius;
  }

  get base() {
    return this._base;
  }

  get entrances() {
    return this._entrances;
  }

  get wave() {
    return this.tr.active ? this._wave : null;
  }

  /**
   * @param {MapDef} map
   * @param {number} ageIndex
   */
  build(map, ageIndex) {
    const ages = this.env.content.ages;
    const index = Math.min(ages.length - 1, Math.max(0, ageIndex | 0));
    this.tr.active = false;
    if (this.terrain) {
      this.group.remove(this.terrain.mesh);
      this.terrain.dispose();
    }
    const info = analyzeMap(map, ages.length);
    this.info = info;
    this.map = map;
    const all = (1 << info.sets.length) - 1;
    const terrain = new Terrain({
      width: map.width,
      height: map.height,
      isPath: info.isPath,
      isSolid: info.isSolid,
      pathFixed: (tx, tz) => info.setMask(tx, tz) === all,
      pathLinks: info.links,
      seed: map.seed,
    }, this.env.materials.matte);
    this.terrain = terrain;
    this.group.add(terrain.mesh);
    this._radius = terrain.radius;
    this._base = { x: info.base.x, z: info.base.z };
    this._entrances = info.entrances.map((e) => ({ x: e.x, z: e.z }));

    // Schattenkamera eng um die Oberseite der Insel legen.
    let extX = 0;
    let extZ = 0;
    const p = terrain.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i + 1] < -0.3) continue;
      extX = Math.max(extX, Math.abs(p[i]));
      extZ = Math.max(extZ, Math.abs(p[i + 2]));
    }
    this.rig.fit(extX + 0.2, extZ + 0.2, 3.6, -0.4);
    this.abyss.setIsland(extX, extZ);
    this.abyss.set(ages[index].abyss);
    this.ambient.setIsland(extX, extZ);
    this.ambient.set(ages[index].particles);
    this.overlays.build(info, terrain);
    this.overlays.setWave(0, 0, 0, 0);
    this._set = info.setOfAge(index);
    this._setFrom = this._set;
    this._pulseSet = -1;
    this._hint = null;
    terrain.setPathStates(this._statesFor(this._set));
    this.overlays.setPathSet(this._set);
    this.overlays.setHighlight(null, 0);
    this.traces.build(info, terrain, ages);
    this.traces.setStates(this._statesFor(this._set));
    this._gateScale = info.entrances.map((e) => this._gateTarget(e.sets, this._set));

    this.spots = computeSpots(info, terrain);
    this.dressing.setMap(info, this.spots, ages);
    this._ageIndex = index;
    this._fromAge = index;
    this.dressing.setAge(index);
    terrain.setPalette(ages[index].terrain);
    this.marks.setReduced(this.quality === 'low');
    this.marks.build(info, terrain, this.env.content.balance.tiles);
    this.marks.setPalette(ages[index]);
    this.traces.setPalette(ages[index]);
    this.lightTo.set(ages[index].light);
    this.lightFrom.copyFrom(this.lightTo);
    this._applyLight(1);
    this._bloom = ages[index].bloom;
    this.setQuality(this.quality);
    this.hit = 0;
    this._queueWarm(index + 1);
  }

  /**
   * Bereitet das Zeitalter `index` schrittweise vor, damit das erste Bild seiner Zeitwelle nicht stockt: Ohne das baute
   * es alle neuen Requisiten, die Basis und gegebenenfalls das Lichtermeer auf einmal (bis über 100 ms).
   * @param {number} index
   */
  _queueWarm(index) {
    const age = this.env.content.ages[index];
    this._warm.length = 0;
    if (!age) return;
    for (const rule of age.scatter) this._warm.push(() => void this.resolveModel(rule.model));
    this._warm.push(() => void this._baseModel(age.baseModel));
    this._warm.push(() => this.abyss.prepare(age.abyss.kind));
    this._warm.push(() => this.dressing.prepare(index));
  }

  /** Führt einen Schritt der Vorbereitung aus, wenn der Browser Luft hat (sonst im nächsten Bild). */
  _pumpWarm() {
    if (this._warmScheduled || this._warm.length === 0 || this.tr.active) return;
    this._warmScheduled = true;
    const run = () => {
      this._warmScheduled = false;
      if (this._disposed || this.tr.active) return;
      const task = this._warm.shift();
      if (task) task();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 0);
  }

  /**
   * Zustand jedes Wegfeldes der Insel, wenn der Satz `set` gilt (wie Sim.pathMark: Weg, künftiger Weg, alter Weg).
   * @param {number} set
   * @returns {Uint8Array}
   */
  _statesFor(set) {
    const terrain = this.terrain;
    const info = this.info;
    if (!terrain || !info) return new Uint8Array(0);
    const out = new Uint8Array(terrain.pathCount);
    for (let p = 0; p < terrain.pathCount; p++) {
      const mask = info.setMask(terrain.pathTx[p], terrain.pathTz[p]);
      out[p] = mask & (1 << set) ? PATH_NOW : mask >>> (set + 1) !== 0 ? PATH_FUTURE : PATH_FORMER;
    }
    return out;
  }

  /**
   * Größe eines Tores im Satz `set`: benutzt 1, erst später benutzt ein kleiner ruhender Wirbel, nie wieder benutzt 0.
   * @param {number} mask Bitmaske der Sätze, in denen das Tor benutzt wird
   * @param {number} set
   */
  _gateTarget(mask, set) {
    if (mask & (1 << set)) return 1;
    return mask >>> (set + 1) !== 0 ? DORMANT_PORTAL : 0;
  }

  /** Stufe (Zeitalter, ab dem der Satz gilt), deren Wege die Insel jetzt zeigt. */
  get pathStage() {
    return this.info ? this.info.sets[this._set].from : 0;
  }

  /**
   * Hebt Wegstücke hervor: 'coming' = die Stücke, die mit der Stufe `stage` neu hinzukommen (sanftes Atmen, vor dem Wechsel);
   * 'new' = die Stücke, die die jetzt geltende Stufe gegenüber der vorigen neu hat (pulsiert nach dem Wechsel einige Male
   * und leuchtet dann leise weiter). null nimmt die Hervorhebung zurück.
   * @param {{ stage: number, kind: 'coming' | 'new' } | null} hint
   */
  setPathHint(hint) {
    const info = this.info;
    const terrain = this.terrain;
    if (!info || !terrain) return;
    const prev = this._hint;
    if (prev === hint || (prev && hint && prev.stage === hint.stage && prev.kind === hint.kind)) return;
    this._hint = hint ? { stage: hint.stage, kind: hint.kind } : null;
    if (!hint) {
      this.overlays.setHighlight(null, 0);
      return;
    }
    const target = info.setOfAge(hint.stage);
    const base = hint.kind === 'coming' ? this._set : target - 1;
    if (base < 0 || target === base) {
      this.overlays.setHighlight(null, 0);
      return;
    }
    const levels = new Float32Array(terrain.pathCount);
    let any = false;
    for (let p = 0; p < terrain.pathCount; p++) {
      const mask = info.setMask(terrain.pathTx[p], terrain.pathTz[p]);
      if (mask & (1 << target) && !(mask & (1 << base))) {
        levels[p] = 1;
        any = true;
      }
    }
    // Nach einem Wechsel pulsiert das neue Stück erst, wenn die Zeitwelle durch ist.
    const delay = hint.kind === 'new' && this.tr.active ? Math.max(0, this.tr.duration * FRONT_SHARE - this.tr.time) : 0;
    this.overlays.setHighlight(any ? levels : null, hint.kind === 'new' ? 1 : 2, delay);
  }

  /**
   * Überblendet Licht, Himmel, Nebel, Belichtung und Bloom zwischen altem und neuem Zeitalter.
   * @param {number} t 0..1
   */
  _applyLight(t) {
    const ages = this.env.content.ages;
    this.light.lerpStates(this.lightFrom, this.lightTo, t);
    this.rig.applyState(this.light);
    this.sky.applyState(this.light);
    this.fog.color.copy(this.light.fogColor);
    this.fog.density = this.light.fogDensity;
    this._exposure = this.light.exposure;
    const a = ages[this._fromAge].bloom;
    this._bloom = a + (ages[this._ageIndex].bloom - a) * t;
  }

  /**
   * @param {number} ageIndex
   * @param {{ duration?: number, x?: number, z?: number }} [opts]
   */
  transitionTo(ageIndex, opts = {}) {
    const terrain = this.terrain;
    const info = this.info;
    if (!terrain || !info) return;
    const ages = this.env.content.ages;
    const index = Math.min(ages.length - 1, Math.max(0, ageIndex | 0));
    if (this.tr.active) this._finishTransition();
    const tr = this.tr;
    tr.duration = Math.max(0.05, opts.duration ?? 4.5);
    tr.x = opts.x ?? info.base.x;
    tr.z = opts.z ?? info.base.z;
    tr.time = 0;
    tr.frozen = false;
    tr.active = true;
    // Fernster Punkt der Insel vom Ursprung der Welle aus.
    tr.maxR = Math.hypot(tr.x, tr.z) + terrain.radius + 0.5;
    this._fromAge = this._ageIndex;
    this._ageIndex = index;
    this.lightFrom.copyFrom(this.light);
    this.lightTo.set(ages[index].light);
    this.abyss.beginBlend(ages[index].abyss);
    this.ambient.beginBlend(ages[index].particles);
    // Die Wege wechseln mit der Zeitwelle, wenn das neue Zeitalter einen anderen Satz bringt.
    const set = info.setOfAge(index);
    this._setFrom = this._set;
    if (set !== this._set) {
      this._set = set;
      const states = this._statesFor(set);
      terrain.changePathStates(states);
      this.traces.changeStates(states);
      this.overlays.setPathSet(set);
    }
    const frontTime = tr.duration * FRONT_SHARE;
    this.dressing.beginSwap(index, (spot) => {
      const jitter = ((spot.seed % 1000) / 1000) * 0.14;
      if (spot.zone === 'far') return tr.duration * (0.4 + 0.3 * ((spot.seed % 97) / 97));
      const d = Math.min(1, Math.hypot(spot.x - tr.x, spot.z - tr.z) / tr.maxR);
      return (1 - Math.pow(1 - d, 1 / FRONT_EASE)) * frontTime + jitter;
    });
    this._wave.x = tr.x;
    this._wave.z = tr.z;
    this._wave.radius = 0;
    this._wave.progress = 0;
  }

  /** Bringt eine laufende Zeitwelle sofort in ihren Endzustand. */
  _finishTransition() {
    const tr = this.tr;
    if (!tr.active) return;
    tr.active = false;
    tr.frozen = false;
    const age = this.age;
    if (this.terrain) this.terrain.setPalette(age.terrain);
    this.marks.setPalette(age);
    this.traces.setPalette(age);
    this._setFrom = this._set;
    this.dressing.finishSwap();
    this.abyss.set(age.abyss);
    this.ambient.set(age.particles);
    this.overlays.setWave(0, 0, 0, 0);
    this._fromAge = this._ageIndex;
    this.lightFrom.copyFrom(this.lightTo);
    this._applyLight(1);
    this._queueWarm(this._ageIndex + 1);
  }

  /** @param {number} dt */
  update(dt) {
    const terrain = this.terrain;
    const info = this.info;
    if (!terrain || !info) return;
    const tr = this.tr;
    const ages = this.env.content.ages;
    if (!tr.frozen && !this.timeFrozen) this.time += dt;
    let swapTime = -1;
    if (tr.active) {
      if (!tr.frozen) tr.time += dt;
      if (tr.time >= tr.duration) {
        this._finishTransition();
      } else {
        const p = tr.time / tr.duration;
        const u = Math.min(1, p / FRONT_SHARE);
        const radius = (1 - Math.pow(1 - u, FRONT_EASE)) * tr.maxR;
        this._wave.radius = radius;
        this._wave.progress = p;
        const arg = this._waveArg;
        this._applyLight(smooth(p));
        this.abyss.blend(smooth(p));
        this.ambient.blend(p);
        // Der Lichtsaum blendet rasch ein und klingt aus, sobald die Front die Insel verlässt.
        const strength = Math.min(1, p / 0.05) * (1 - smooth((u - 0.86) / 0.14));
        this.overlays.setWave(tr.x, tr.z, radius, strength);
        arg.glow = 0.3 * strength;
        arg.x = tr.x;
        arg.z = tr.z;
        arg.radius = radius;
        terrain.setPalette(ages[this._ageIndex].terrain, ages[this._fromAge].terrain, arg);
        this.marks.setPalette(ages[this._ageIndex], ages[this._fromAge], arg);
        this.traces.setPalette(ages[this._ageIndex], ages[this._fromAge], arg);
        swapTime = tr.time;
      }
    }
    const pixelHeight = this.env.renderer.domElement.height;
    this.abyss.setViewport(pixelHeight);
    this.abyss.update(this.time, this.light);
    this.ambient.update(this.time, pixelHeight);
    this.overlays.update(this.time, dt);
    this.marks.update(this.time, dt, swapTime >= 0);
    this.traces.update(this.time, dt, swapTime >= 0);
    this.dressing.update(this.time, dt, swapTime);
    this._updateBase(dt);
    this._pumpWarm();
  }

  /**
   * @param {string} id
   * @returns {InstancedModel}
   */
  _baseModel(id) {
    let model = this.baseModels.get(id);
    if (!model) {
      model = new InstancedModel(this.resolveModel(id), this.env.materials, { capacity: 1 });
      this.baseModels.set(id, model);
      this.baseModelList.push(model);
      this.group.add(model.group);
    }
    return model;
  }

  /**
   * Zeichnet Basis und Portale.
   * @param {number} dt
   */
  _updateBase(dt) {
    const info = this.info;
    if (!info) return;
    const ages = this.env.content.ages;
    const tr = this.tr;
    const ctx = this.ctx;
    this.hit = Math.max(0, this.hit - dt / 0.45);
    this.flameShown += (this.flame - this.flameShown) * Math.min(1, dt * 5);
    const hit = this.hit;

    // Basis: während der Welle sinkt die alte zusammen, die neue federt heraus.
    let oldScale = 0;
    let newScale = 1;
    if (tr.active) {
      const swapAt = tr.duration * BASE_SWAP_AT;
      const k = (tr.time - swapAt) / (tr.duration * 0.045);
      oldScale = k >= 1 ? 0 : 1 - smooth(k);
      newScale = bounce((tr.time - swapAt - tr.duration * 0.045) / (tr.duration * 0.19));
    }
    const current = this._baseModel(ages[this._ageIndex].baseModel);
    const previous = tr.active && oldScale > 0 ? this._baseModel(ages[this._fromAge].baseModel) : null;
    for (let i = 0; i < this.baseModelList.length; i++) {
      const model = this.baseModelList[i];
      model.begin();
      const scale = model === current ? (previous === current ? 1 : newScale) : model === previous ? oldScale : 0;
      if (scale > 0.001) {
        // Treffer: kurzes Zusammenzucken und warmes Aufleuchten.
        const flinch = 1 - Math.sin(hit * Math.PI) * 0.07 * hit;
        const wobble = Math.sin(hit * 28) * 0.035 * hit;
        pos.set(info.base.modelX, 0, info.base.modelZ);
        quat.setFromAxisAngle(UP, info.base.yaw + wobble);
        const squash = model === previous ? scale * scale : scale;
        scl.set(scale * (2 - flinch), squash * flinch, scale * (2 - flinch));
        mat.compose(pos, quat, scl);
        ctx.t = this.time;
        ctx.seed = 0.37;
        ctx.hp = this.flameShown;
        ctx.hurt = hit;
        ctx.level = 1;
        tint.setRGB(1 + hit * 0.55, 1 + hit * 0.3, 1 + hit * 0.18);
        model.add(mat, ctx, tint);
      }
      model.end();
      model.group.visible = model.count > 0;
    }

    // Portale: zeitlos, sie pulsieren kurz, wenn die Wellenfront sie erreicht. Ein Tor, das erst später benutzt wird, ruht als
    // kleiner Wirbel; öffnet es sich, wächst es mit der Front heran, ein Tor, das nicht mehr gebraucht wird, vergeht.
    if (!this.portalModel) {
      this.portalModel = new InstancedModel(this.resolveModel('fx.portal'), this.env.materials, { capacity: 3 });
      this.group.add(this.portalModel.group);
    }
    const portal = this.portalModel;
    const coming = this._hint && this._hint.kind === 'coming' ? info.setOfAge(this._hint.stage) : -1;
    portal.begin();
    for (let i = 0; i < info.entrances.length; i++) {
      const e = info.entrances[i];
      let s = this._gateScale[i] ?? 1;
      const target = this._gateTarget(e.sets, this._set);
      if (tr.active && this._setFrom !== this._set) {
        // Wechsel mit der Front: kurz nachdem sie das Tor erreicht hat.
        const from = this._gateTarget(e.sets, this._setFrom);
        const d = Math.hypot(e.x - tr.x, e.z - tr.z) - this._wave.radius;
        const k = Math.min(1, Math.max(0, -d / 2.2));
        s = target > from ? from + (target - from) * bounce(k) : from + (target - from) * smooth(k);
        this._gateScale[i] = s;
      } else {
        s += (target - s) * Math.min(1, dt * 3);
        if (Math.abs(target - s) < 0.002) s = target;
        this._gateScale[i] = s;
      }
      // Ein ruhendes Tor, das mit der nächsten Stufe aufgeht, atmet sichtbar.
      if (coming >= 0 && target < 1 && e.sets & (1 << coming)) s *= 1.25 + 0.12 * Math.sin(this.time * 2.4);
      if (tr.active) {
        const d = Math.hypot(e.x - tr.x, e.z - tr.z) - this._wave.radius;
        s *= 1 + Math.max(0, 1 - Math.abs(d) / 1.6) * 0.14;
      }
      if (s < 0.01) continue;
      pos.set(e.x, 0, e.z);
      quat.setFromAxisAngle(UP, e.yaw);
      scl.set(s, s, s);
      mat.compose(pos, quat, scl);
      ctx.t = this.time;
      ctx.seed = i * 0.41 + 0.1;
      ctx.hp = 1;
      ctx.hurt = 0;
      portal.add(mat, ctx);
    }
    portal.end();
  }

  /**
   * @param {number} tx
   * @param {number} tz
   * @param {boolean} occupied
   */
  setTileOccupied(tx, tz, occupied) {
    this.dressing.setTileOccupied(tx, tz, occupied);
    this.overlays.setTileOccupied(tx, tz, occupied);
  }

  /**
   * Hebt das Bodenzeichen eines besonderen Bauplatzes sanft hervor (heller, Leuchtendes etwas kräftiger), etwa solange
   * der Zeiger darüber steht. Ein gewöhnliches Feld oder null nimmt die Hervorhebung zurück.
   * @param {{ tx: number, tz: number } | null} tile
   */
  highlightSpecialTile(tile) {
    this.marks.setHover(tile ? tile.tx : -999, tile ? tile.tz : -999);
  }

  /** @param {boolean} visible */
  setGridVisible(visible) {
    this.overlays.setGrid(visible);
  }

  /** @param {boolean} visible */
  setFlightLines(visible) {
    this.overlays.setFlightLines(visible);
  }

  /** @param {number} fraction */
  setFlame(fraction) {
    this.flame = Math.min(1, Math.max(0, fraction));
  }

  /** @param {Quality} quality */
  setQuality(quality) {
    this.quality = quality;
    this.rig.setShadows(quality !== 'low', quality === 'high' ? 2048 : 1024);
    // Mittlere Stufe: etwas lichter (die Dekoration trägt dort gut ein Drittel der Dreiecke der Szene, mit Schatten).
    this.dressing.setDensity(quality === 'low' ? 0.5 : quality === 'medium' ? 0.8 : 1);
    // Unterhalb von 'high': ferne Kulisse nur im Bild der Ausgangsansicht, niedrige Requisiten ohne Schlagschatten.
    this.dressing.setFarAll(quality === 'high');
    this.dressing.setShadowMinHeight(quality === 'high' ? 0 : 0.5);
    this.abyss.setDetail(quality === 'low' ? 0.5 : 1);
    this.ambient.setEnabled(quality !== 'low');
    this.marks.setReduced(quality === 'low');
    this.traces.setReduced(quality === 'low');
  }

  hitBase() {
    this.hit = 1;
  }

  dispose() {
    this.tr.active = false;
    this._disposed = true;
    this._warm.length = 0;
    this.dressing.dispose();
    this.marks.dispose();
    this.traces.dispose();
    this.abyss.dispose();
    this.overlays.dispose();
    this.ambient.dispose();
    for (const model of this.baseModels.values()) model.dispose();
    this.baseModels.clear();
    this.baseModelList = [];
    this.portalModel?.dispose();
    this.portalModel = null;
    if (this.terrain) {
      this.terrain.dispose();
      this.terrain = null;
    }
    this.sky.dispose();
    this.rig.dispose();
    if (this.env.scene.fog === this.fog) this.env.scene.fog = null;
    this.group.removeFromParent();
  }
}

/**
 * Erzeugt die Welt. Sie hängt sich selbst in die Szene; `build()` errichtet die Insel für eine Karte.
 * @param {RenderEnv} env
 * @param {WorldOptions} [opts]
 * @returns {World & { debug: WorldImpl['debug'] }}
 */
export function createWorld(env, opts = {}) {
  return new WorldImpl(env, opts);
}
