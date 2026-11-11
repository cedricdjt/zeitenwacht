// @ts-check
// Dekoration der Insel: füllt die festen Plätze einer Karte mit den Modellen eines Zeitalters und zeichnet sie instanziert.
// Beim Wechsel des Zeitalters tauscht jeder Platz sein Modell, sobald die Zeitwelle ihn erreicht.

import * as THREE from 'three';
import { hasModel } from '../../content/models.js';
import { InstancedModel, makeAnimCtx } from '../instances.js';
import { valueNoise } from '../../util/noise.js';
import { makeRng } from '../../util/rng.js';

/** @import { AgeDef, ScatterRule } from '../../types/content' */
/** @import { ModelSpec } from '../../types/model' */
/** @import { ModelMaterials } from '../instances.js' */
/** @import { MapInfo, Spot } from './mapinfo.js' */

/**
 * @typedef {object} Instancer
 * @property {InstancedModel} model
 * @property {boolean} animated Das Modell bewegt sich und wird deshalb in jedem Bild neu befüllt
 * @property {boolean} fill In diesem Bild neu befüllen
 * @property {number} lastUse Zähler des letzten Bildes, in dem der Instancer befüllt wurde
 * @property {boolean} near Steht auf der Insel (darf Schatten werfen)
 * @property {number} height Höhe des Modells
 */

/**
 * @typedef {object} Item
 * @property {Instancer} inst
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} yaw
 * @property {number} scale
 * @property {number} seed
 * @property {number} spot Index des Platzes
 * @property {number} tile Index des Feldes (tz * width + tx) für Bodendeko auf dem Spielfeld, sonst -1
 */

/** Dauer des Zusammensinkens und des Aufploppens beim Tausch in Sekunden. */
const SQUASH_TIME = 0.2;
const POP_DELAY = 0.1;
const POP_TIME = 0.5;

/**
 * Weitere kleine Requisiten je Zeitalter, die gesperrte Felder neben dem eigentlichen Sperrmodell füllen dürfen
 * (Namen ohne 'prop.<zeitalter>.'). Jede Karte mischt davon zwei bis drei bei, ausgewählt aus ihrem Startwert;
 * so stehen auf einem Felsenmeer nicht 44 gleiche Brunnen.
 */
const BLOCK_EXTRAS = /** @type {Record<string, string[]>} */ ({
  steinzeit: ['findling', 'farnbusch', 'urzeitbaum', 'mammutrippen', 'malfels'],
  rom: ['saeule', 'amphoren', 'statue', 'olivenbaum'],
  mittelalter: ['heuhaufen', 'brunnen', 'tanne', 'zinnenmauer'],
  entdecker: ['faesser', 'kanonenkugeln', 'schatztruhe', 'palme'],
  industrie: ['kohlehaufen', 'gaslaterne', 'gueterwaggon'],
  zukunft: ['stadtbaum', 'ladesaeule', 'solarfeld', 'holotafel'],
});
/** Gewicht des eigentlichen Sperrmodells gegenüber einer Beimischung (diese je 1). */
const BLOCK_MAIN_WEIGHT = 2.2;
/** Höchste Höhe einer Beimischung auf einem gesperrten Feld (größere werden verkleinert), damit nichts den Weg verdeckt. */
const BLOCK_MAX_HEIGHT = 1.05;
/** Regeln ab diesem Gewicht stehen in jedem Zeitalter auf jeder Karte mindestens einmal, wenn ein passender Platz existiert. */
const MIN_GUARANTEED_WEIGHT = 0.3;
/** Größenbereich einer Regel ohne Angabe. @type {[number, number]} */
const DEFAULT_SCALE = [0.85, 1.2];

/** @typedef {{ rule: ScatterRule, index: number, radius: number, height: number }} Entry */

/**
 * Fester Zufallswert 0..1 aus zwei Ganzzahlen.
 * @param {number} a
 * @param {number} b
 */
function hashUnit(a, b) {
  let h = Math.imul(a ^ Math.imul(b + 1, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return (h >>> 8) / 16777216;
}

const mat = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ctx = makeAnimCtx();

/** @param {number} u */
function easeOutBack(u) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  const v = u - 1;
  return 1 + c3 * v * v * v + c1 * v * v;
}

export class Dressing {
  /**
   * @param {ModelMaterials} materials
   * @param {(id: string) => ModelSpec} resolveModel
   */
  constructor(materials, resolveModel) {
    this.materials = materials;
    this.resolveModel = resolveModel;
    this.group = new THREE.Group();
    this.group.name = 'dressing';
    /** @type {Map<string, Instancer>} */
    this.instancers = new Map();
    /** Dieselben Instancer als Liste, damit die Schleifen je Bild nichts anlegen. @type {Instancer[]} */
    this.instancerList = [];
    /** @type {MapInfo | null} */
    this.info = null;
    /** @type {Spot[]} */
    this.spots = [];
    /** @type {AgeDef[]} */
    this.ages = [];
    /** @type {Item[]} */
    this.items = [];
    /** Die Dekoration des vorigen Zeitalters, solange die Zeitwelle läuft. @type {Item[] | null} */
    this.oldItems = null;
    /** Zeitpunkt des Tauschs je Platz in Sekunden seit Beginn der Welle. */
    this.swapTimes = new Float32Array(0);
    this.ageIndex = 0;
    this.density = 1;
    /** Belegung der Felder: aktueller Wert 0..1 (1 = Deko verschwunden) und Zielwert. */
    this.occupied = new Float32Array(0);
    this.occupiedTarget = new Uint8Array(0);
    this.occupancyMoving = false;
    this.frame = 0;
    /** Erzwingt im nächsten Bild das Neubefüllen aller Instanzen. */
    this.dirty = true;
    /** Regeln des aktuellen Zeitalters, die auf dieser Karte keinen passenden Platz fanden (für die Testseite). @type {string[]} */
    this.unplaced = [];
    /** Ferne Kulisse auch außerhalb der Ausgangsansicht (nur hohe Grafikstufe). */
    this.farAll = true;
    /** Zahl der Plätze der fernen Kulisse, die die Ausgangsansicht zeigt (sie haben die kleinsten Ränge). */
    this.inViewCount = 0;
    /** Requisiten unter dieser Höhe werfen keinen Schatten. */
    this.shadowMinHeight = 0;
  }

  /**
   * @param {string} id
   * @param {'far' | 'field' | 'near'} group
   * @returns {Instancer}
   */
  _instancer(id, group) {
    const spec = this.resolveModel(id);
    const k = `${spec.id}|${group}`;
    let inst = this.instancers.get(k);
    if (!inst) {
      // Ferne Kulisse liegt außerhalb der Schattenkarte, flache Bodendeko braucht keinen Schlagschatten,
      // auf mittlerer Stufe auch niedrige Requisiten nicht (siehe setShadowMinHeight).
      const near = group === 'near';
      const height = spec.bounds.height;
      const model = new InstancedModel(spec, this.materials, { capacity: 16, castShadow: near && height >= this.shadowMinHeight, receiveShadow: group !== 'far' });
      model.group.visible = false;
      this.group.add(model.group);
      inst = { model, animated: spec.animate !== null, fill: true, lastUse: -1, near, height };
      this.instancers.set(k, inst);
      this.instancerList.push(inst);
    }
    return inst;
  }

  /**
   * Übernimmt eine Karte mit ihren Plätzen; die Dekoration entsteht erst mit setAge().
   * @param {MapInfo} info
   * @param {Spot[]} spots
   * @param {AgeDef[]} ages
   */
  setMap(info, spots, ages) {
    this.info = info;
    this.spots = spots;
    this.inViewCount = spots.filter((spot) => spot.inView).length;
    this.ages = ages;
    this.items = [];
    this.oldItems = null;
    this.swapTimes = new Float32Array(spots.length);
    this.occupied = new Float32Array(info.width * info.height);
    this.occupiedTarget = new Uint8Array(info.width * info.height);
    this.occupancyMoving = false;
    this.dirty = true;
  }

  /**
   * Füllt die Plätze für ein Zeitalter. Erst wählt jeder Platz gewichtet eine Sorte, dann bekommt jede Regel, die dabei
   * leer ausging, mindestens einen passenden Platz (von einer Sorte, die mehrfach steht); erst danach entstehen die Exemplare.
   * @param {number} ageIndex
   * @returns {Item[]}
   */
  _fill(ageIndex) {
    const age = this.ages[ageIndex];
    const info = this.info;
    /** @type {Item[]} */
    const items = [];
    this.unplaced = [];
    if (!age || !info) return items;
    /** @type {Record<string, Entry[]>} */
    const byZone = { shore: [], rim: [], field: [], far: [], block: [] };
    age.scatter.forEach((rule, index) => {
      const zone = rule.zone ?? 'shore';
      const spec = this.resolveModel(rule.model);
      byZone[zone].push({ rule, index, radius: Math.max(0.05, spec.bounds.radius), height: Math.max(0.05, spec.bounds.height) });
    });
    if (byZone.block.length === 0) {
      const spec = this.resolveModel(`prop.${age.id}.block`);
      byZone.block.push({ rule: { model: `prop.${age.id}.block`, weight: 1, zone: 'block', scale: [1, 1] }, index: 99, radius: Math.max(0.05, spec.bounds.radius), height: spec.bounds.height });
    }
    this._blockExtras(age, ageIndex, info.map.seed | 0, byZone.block);
    const shoreCount = Math.round(age.scatterCount * this.density);
    const fieldCount = Math.round(age.fieldCount * this.density);
    // Ohne `farAll` nur die Kulisse, die die Ausgangsansicht zeigt: der Ring dahinter kostet Dreiecke, die man selten sieht.
    const farCount = this.farAll ? 99 : this.inViewCount;
    const mapSeed = info.map.seed | 0;

    /** @param {Spot} spot */
    const rulesOf = (spot) => (spot.zone === 'rim' && byZone.rim.length === 0 ? byZone.shore : byZone[spot.zone]);
    /** @param {Spot} spot */
    const active = (spot) => {
      const zone = spot.zone;
      if (zone === 'shore' || zone === 'rim') return spot.rank < shoreCount;
      if (zone === 'field') return spot.rank < fieldCount;
      if (zone === 'far') return spot.rank < farCount;
      return true;
    };
    /** Kleinster Fußabdruck einer Regel. @param {Entry} entry */
    const minFootprint = (entry) => entry.radius * (entry.rule.scale ?? DEFAULT_SCALE)[0];
    /** Ob eine Sorte auf den Platz passt (Ufer und Rand prüfen die Größe, die übrigen verkleinern notfalls). @param {Entry} entry @param {Spot} spot */
    const fits = (entry, spot) => (spot.zone === 'shore' || spot.zone === 'rim' ? minFootprint(entry) <= spot.room * 1.12 : true);

    // --- 1. Wahl je Platz ---
    /** @type {(Entry | null)[]} */
    const choice = new Array(this.spots.length).fill(null);
    /** @type {(ReturnType<typeof makeRng> | null)[]} */
    const rngs = new Array(this.spots.length).fill(null);
    for (let si = 0; si < this.spots.length; si++) {
      const spot = this.spots[si];
      const zone = spot.zone;
      if (!active(spot)) continue;
      const rules = rulesOf(spot);
      if (rules.length === 0) continue;
      const rng = makeRng((spot.seed ^ Math.imul(ageIndex + 1, 0x9e3779b1)) >>> 0);
      const fitted = zone === 'shore' || zone === 'rim';

      // Gewichtete Wahl unter den Sorten, die auf den Platz passen.
      let total = 0;
      let smallest = rules[0];
      /** @type {number[]} */
      const weights = [];
      for (const entry of rules) {
        const footprint = minFootprint(entry);
        if (footprint < minFootprint(smallest)) smallest = entry;
        let w = entry.rule.weight;
        const cluster = entry.rule.cluster ?? 1;
        if (fitted) {
          if (!fits(entry, spot)) w = 0;
          // Große Plätze bevorzugen große Dinge.
          else w *= 0.25 + Math.pow(Math.min(1, footprint / spot.room), 1.5) * 3;
          // Randreihen tragen Gruppen; lange Gruppen (Aquädukt, Mauer) stehen lieber in einer Reihe als einzeln.
          if (spot.span > 0) w *= cluster > 1 ? 1 + cluster : 0.4;
          else if (zone === 'rim' && cluster >= 3) w *= 0.45;
        }
        if (w > 0 && cluster > 1 && zone !== 'block' && spot.span === 0) {
          // Sorten, die gern in Gruppen stehen, häufen sich in Flecken über die Insel.
          const n = valueNoise(spot.x * 0.23 + entry.index * 7.3, spot.z * 0.23 - entry.index * 3.1, mapSeed + 40 + ageIndex);
          const k = Math.min(1, Math.max(0, (n - 0.38) / 0.3));
          w *= 0.3 + 2.4 * k * k * (3 - 2 * k);
        }
        weights.push(w);
        total += w;
      }
      let chosen = smallest;
      if (total > 0) {
        let pick = rng.next() * total;
        for (let k = 0; k < rules.length; k++) {
          pick -= weights[k];
          if (pick < 0) {
            chosen = rules[k];
            break;
          }
        }
      } else if (zone === 'far') continue;
      choice[si] = chosen;
      rngs[si] = rng;
    }

    // --- 2. Jede Regel mit nennenswertem Gewicht steht mindestens einmal ---
    /** @type {Map<Entry, number>} */
    const uses = new Map();
    for (const entry of choice) if (entry) uses.set(entry, (uses.get(entry) ?? 0) + 1);
    for (const zone of /** @type {const} */ (['shore', 'rim', 'far', 'field', 'block'])) {
      for (const entry of byZone[zone]) {
        if (entry.index >= 99 || entry.rule.weight < MIN_GUARANTEED_WEIGHT || (uses.get(entry) ?? 0) > 0) continue;
        // Bester Platz: eine Sorte, die mehrfach steht, räumt ihn; am liebsten ein Platz, den die Regel gut ausfüllt.
        let best = -1;
        let bestScore = -Infinity;
        let spare = -1;
        for (let si = 0; si < this.spots.length; si++) {
          const spot = this.spots[si];
          if (rulesOf(spot) !== byZone[zone] || !fits(entry, spot)) continue;
          const current = choice[si];
          if (!current) {
            // Ein freier Platz außerhalb des Budgets nur als Notlösung: der mit dem kleinsten Rang.
            if (spare < 0 || spot.rank < this.spots[spare].rank) spare = si;
            continue;
          }
          if ((uses.get(current) ?? 0) < 2) continue;
          const fill = zone === 'shore' || zone === 'rim' ? Math.min(1, minFootprint(entry) / spot.room) : 1;
          // Sichtbare Kulisse zuerst, Reihen für Gruppen, dazu ein fester Zufall je Platz und Zeitalter.
          const score = fill + (spot.inView ? 2 : 0) + (spot.span > 0 ? ((entry.rule.cluster ?? 1) > 1 ? 1 : -1) : 0) + hashUnit(spot.seed, ageIndex) * 0.3;
          if (score > bestScore) {
            bestScore = score;
            best = si;
          }
        }
        const si = best >= 0 ? best : spare;
        if (si < 0) {
          this.unplaced.push(`${entry.rule.model} (${zone})`);
          continue;
        }
        const previous = choice[si];
        if (previous) uses.set(previous, (uses.get(previous) ?? 1) - 1);
        choice[si] = entry;
        uses.set(entry, 1);
        if (!rngs[si]) rngs[si] = makeRng((this.spots[si].seed ^ Math.imul(ageIndex + 1, 0x9e3779b1)) >>> 0);
      }
    }

    // --- 3. Exemplare ---
    for (let si = 0; si < this.spots.length; si++) {
      const chosen = choice[si];
      const rng = rngs[si];
      if (!chosen || !rng) continue;
      const spot = this.spots[si];
      const zone = spot.zone;
      const fitted = zone === 'shore' || zone === 'rim';
      const range = chosen.rule.scale ?? DEFAULT_SCALE;
      let scale = range[0] + (range[1] - range[0]) * rng.next();
      const limit = zone === 'field' ? 0.42 : zone === 'block' ? 0.6 : zone === 'far' ? 1e9 : spot.room * 1.12;
      if (chosen.radius * scale > limit) scale = limit / chosen.radius;
      // Ferne Kulisse im Bild bleibt niedrig genug, um nie über die Insel zu ragen.
      if (zone === 'far' && chosen.height * scale > spot.room) scale = spot.room / chosen.height;
      const footprint = chosen.radius * scale;
      const inst = this._instancer(chosen.rule.model, zone === 'far' ? 'far' : zone === 'field' ? 'field' : 'near');
      const tile = zone === 'field' ? spot.tz * info.width + spot.tx : -1;

      // Wie viele Exemplare der Platz aufnimmt.
      let count = 1;
      const cluster = chosen.rule.cluster ?? 1;
      const spacing = footprint * 2 * 0.96;
      if (cluster > 1 && zone !== 'block') {
        const ratio = footprint / spot.room;
        const capacity = spot.span > 0 ? Math.floor((spot.span * 2) / spacing) + 1 : zone === 'far' ? (spot.inView ? 2 : 6) : ratio > 0.62 ? 1 : ratio > 0.45 ? 2 : ratio > 0.32 ? 3 : 5;
        count = Math.max(1, Math.min(capacity, Math.round(cluster * (0.55 + rng.next() * 0.45))));
        if (spot.span > 0) count = Math.max(Math.min(2, capacity), count);
      }
      if (spot.span > 0 && count > 1) {
        // Randreihe: nebeneinander entlang der Kante, gleich groß und gleich ausgerichtet (Bögen schließen aneinander an).
        const tx = Math.cos(spot.yaw);
        const tz = -Math.sin(spot.yaw);
        const loose = cluster >= 3 ? 0 : 0.12;
        for (let k = 0; k < count; k++) {
          const s = (k - (count - 1) / 2) * spacing * (1 + loose);
          const j = loose * rng.range(-0.5, 0.5);
          items.push({ inst, x: spot.x + tx * s - tz * j, y: spot.y, z: spot.z + tz * s + tx * j, yaw: spot.yaw + loose * rng.range(-2, 2), scale: scale * (1 + loose * rng.range(-0.5, 0.5)), seed: rng.next(), spot: si, tile });
        }
      } else if (count === 1) {
        const slack = fitted ? Math.max(0, spot.room - footprint) * 0.4 : 0;
        const a = rng.next() * Math.PI * 2;
        let builtYaw = zone === 'field' ? rng.next() * Math.PI * 2 : spot.yaw;
        let x = spot.x + Math.cos(a) * slack;
        let z = spot.z + Math.sin(a) * slack;
        if (zone === 'block') {
          // Gesperrte Felder: beliebig gedreht, leicht verschoben und in der Größe gestreut, damit Gleiches nicht in Reih und Glied steht.
          builtYaw = rng.next() * Math.PI * 2;
          scale *= rng.range(0.9, 1.05);
          const r = rng.range(0, 0.06);
          x += Math.cos(builtYaw * 3) * r;
          z += Math.sin(builtYaw * 3) * r;
        }
        items.push({ inst, x, y: spot.y, z, yaw: builtYaw, scale, seed: rng.next(), spot: si, tile });
      } else {
        // Ferne Kulisse rückt zu lockeren Gruppen zusammen, auf der Insel füllt die Gruppe ihren Platz.
        const ring = zone === 'far' ? footprint * 1.25 * Math.sqrt(count) : Math.max(footprint * 0.9, spot.room - footprint * 0.85);
        const a0 = rng.next() * Math.PI * 2;
        for (let k = 0; k < count; k++) {
          const a = a0 + (k / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
          const r = ring * rng.range(0.82, 1);
          const s = scale * rng.range(0.82, 1.08);
          items.push({ inst, x: spot.x + Math.cos(a) * r, y: spot.y, z: spot.z + Math.sin(a) * r, yaw: spot.yaw + rng.range(-0.5, 0.5), scale: s, seed: rng.next(), spot: si, tile });
        }
      }
    }
    return items;
  }

  /**
   * Mischt den Sperrfeldern einer Karte zwei bis drei weitere Requisiten des Zeitalters bei (deterministisch aus dem
   * Startwert der Karte). Das eigentliche Sperrmodell bleibt das häufigste.
   * @param {AgeDef} age
   * @param {number} ageIndex
   * @param {number} mapSeed
   * @param {Entry[]} list Regeln der Zone 'block'; wird ergänzt
   */
  _blockExtras(age, ageIndex, mapSeed, list) {
    const names = (BLOCK_EXTRAS[age.id] ?? []).filter((name) => hasModel(`prop.${age.id}.${name}`));
    if (names.length === 0) return;
    const rng = makeRng((Math.imul(mapSeed, 2654435761) ^ Math.imul(ageIndex + 7, 40503)) >>> 0);
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = names[i];
      names[i] = names[j];
      names[j] = t;
    }
    const take = Math.min(names.length, rng.next() < 0.5 ? 2 : 3);
    const mainWeight = list.reduce((sum, entry) => sum + entry.rule.weight, 0);
    for (const entry of list) entry.rule = { ...entry.rule, weight: (entry.rule.weight / mainWeight) * BLOCK_MAIN_WEIGHT };
    for (let k = 0; k < take; k++) {
      const model = `prop.${age.id}.${names[k]}`;
      const spec = this.resolveModel(model);
      const fit = Math.min(1, BLOCK_MAX_HEIGHT / Math.max(0.1, spec.bounds.height), 0.5 / Math.max(0.05, spec.bounds.radius));
      list.push({ rule: { model, weight: 1, zone: 'block', scale: [0.82 * fit, 1.02 * fit] }, index: 100 + k, radius: Math.max(0.05, spec.bounds.radius), height: spec.bounds.height });
    }
  }

  /**
   * Setzt die Dekoration sofort auf ein Zeitalter.
   * @param {number} ageIndex
   */
  setAge(ageIndex) {
    this.ageIndex = ageIndex;
    this.items = this._fill(ageIndex);
    this.oldItems = null;
    this.dirty = true;
  }

  /**
   * Beginnt den Tausch zum neuen Zeitalter. `swapTimes[i]` ist der Zeitpunkt (Sekunden seit Beginn der Welle),
   * zu dem Platz i getauscht wird.
   * @param {number} ageIndex
   * @param {(spot: Spot) => number} swapTimeOf
   */
  beginSwap(ageIndex, swapTimeOf) {
    this.oldItems = this.items;
    this.ageIndex = ageIndex;
    this.items = this._fill(ageIndex);
    for (let i = 0; i < this.spots.length; i++) this.swapTimes[i] = swapTimeOf(this.spots[i]);
    this.dirty = true;
  }

  /** Schließt einen laufenden Tausch sofort ab. */
  finishSwap() {
    this.oldItems = null;
    this.dirty = true;
  }

  /**
   * Dichte der Dekoration (1 = voll, 0.5 = niedrige Grafikstufe).
   * @param {number} density
   */
  setDensity(density) {
    if (density === this.density) return;
    this.density = density;
    if (this.info) {
      this.items = this._fill(this.ageIndex);
      this.dirty = true;
    }
  }

  /**
   * Ferne Kulisse rundum (true) oder nur, was die Ausgangsansicht zeigt.
   * @param {boolean} all
   */
  setFarAll(all) {
    if (all === this.farAll) return;
    this.farAll = all;
    if (this.info) {
      this.items = this._fill(this.ageIndex);
      this.dirty = true;
    }
  }

  /**
   * Requisiten unter dieser Höhe werfen keinen Schatten (0 = alle auf der Insel).
   * @param {number} height
   */
  setShadowMinHeight(height) {
    if (height === this.shadowMinHeight) return;
    this.shadowMinHeight = height;
    for (const inst of this.instancerList) {
      const cast = inst.near && inst.height >= height;
      inst.model.castShadow = cast;
      for (const entry of inst.model.meshes) if (entry.matte) entry.matte.castShadow = cast;
    }
  }

  /**
   * Bereitet ein Zeitalter vor, ohne es zu zeigen: baut seine Modelle und legt die Instancer an. So kostet der erste
   * Bild der Zeitwelle keine Modellbauten mehr.
   * @param {number} ageIndex
   */
  prepare(ageIndex) {
    if (!this.info || !this.ages[ageIndex]) return;
    const unplaced = this.unplaced;
    this._fill(ageIndex);
    this.unplaced = unplaced;
  }

  /**
   * @param {number} tx
   * @param {number} tz
   * @param {boolean} occupied
   */
  setTileOccupied(tx, tz, occupied) {
    const info = this.info;
    if (!info || tx < 0 || tz < 0 || tx >= info.width || tz >= info.height) return;
    this.occupiedTarget[tz * info.width + tx] = occupied ? 1 : 0;
    this.occupancyMoving = true;
  }

  /**
   * Befüllt die Instanzen.
   * @param {number} time Uhr der Welt in Sekunden (treibt die Animation der Requisiten)
   * @param {number} dt
   * @param {number} swapTime Sekunden seit Beginn der Zeitwelle; negativ, wenn keine läuft
   */
  update(time, dt, swapTime) {
    this.frame++;
    const swapping = swapTime >= 0 && this.oldItems !== null;
    let all = this.dirty || swapping;
    this.dirty = false;

    if (this.occupancyMoving) {
      let moving = false;
      const step = Math.min(1, dt * 7);
      for (let i = 0; i < this.occupied.length; i++) {
        const target = this.occupiedTarget[i];
        const value = this.occupied[i];
        if (value === target) continue;
        const next = value + Math.sign(target - value) * step;
        this.occupied[i] = target === 1 ? Math.min(1, next) : Math.max(0, next);
        if (this.occupied[i] !== target) moving = true;
      }
      this.occupancyMoving = moving;
      // Im letzten Schritt noch einmal alles schreiben, damit der Endzustand in den Puffern steht.
      all = true;
    }

    const list = this.instancerList;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      inst.fill = all || inst.animated;
      if (inst.fill) inst.model.begin();
    }

    ctx.t = time;
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const inst = item.inst;
      if (!inst.fill) continue;
      inst.lastUse = this.frame;
      let sxz = item.scale;
      let sy = item.scale;
      if (swapping) {
        const u = (swapTime - this.swapTimes[item.spot] - POP_DELAY) / POP_TIME;
        if (u <= 0) continue;
        if (u < 1) {
          const e = easeOutBack(u);
          sxz *= e;
          // Etwas höher hinausschießen als in die Breite: das Aufploppen wirkt federnd.
          sy *= e + Math.sin(u * Math.PI) * (1 - u) * 0.35;
        }
      }
      if (item.tile >= 0) {
        const o = this.occupied[item.tile];
        if (o >= 1) continue;
        if (o > 0) {
          const k = 1 - o;
          sxz *= k;
          sy *= k * k;
        }
      }
      pos.set(item.x, item.y, item.z);
      quat.setFromAxisAngle(UP, item.yaw);
      scl.set(sxz, sy, sxz);
      mat.compose(pos, quat, scl);
      ctx.seed = item.seed;
      inst.model.add(mat, ctx);
    }

    if (swapping && this.oldItems) {
      const old = this.oldItems;
      for (let i = 0; i < old.length; i++) {
        const item = old[i];
        const k = (swapTime - this.swapTimes[item.spot]) / SQUASH_TIME;
        if (k >= 1) continue;
        let sxz = item.scale;
        let sy = item.scale;
        if (k > 0) {
          sxz *= (1 - k) * (1 + 0.7 * k);
          sy *= (1 - k) * (1 - k);
        }
        if (item.tile >= 0) {
          const o = this.occupied[item.tile];
          if (o >= 1) continue;
          sxz *= 1 - o;
          sy *= 1 - o;
        }
        item.inst.lastUse = this.frame;
        pos.set(item.x, item.y, item.z);
        quat.setFromAxisAngle(UP, item.yaw);
        scl.set(sxz, sy, sxz);
        mat.compose(pos, quat, scl);
        ctx.seed = item.seed;
        item.inst.model.add(mat, ctx);
      }
    }

    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      if (!inst.fill) continue;
      inst.model.end();
      // Modelle, die das aktuelle Zeitalter nicht benutzt, kosten keinen Zeichenaufruf.
      inst.model.group.visible = inst.model.count > 0;
    }
  }

  /** Zahl der gezeichneten Exemplare (für Messungen). */
  get count() {
    let n = 0;
    for (const inst of this.instancers.values()) n += inst.model.count;
    return n;
  }

  dispose() {
    for (const inst of this.instancers.values()) inst.model.dispose();
    this.instancers.clear();
    this.instancerList = [];
    this.group.removeFromParent();
    this.items = [];
    this.oldItems = null;
  }
}
