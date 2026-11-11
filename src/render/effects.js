// @ts-check
// Die Effektschicht: Geschosse, Strahlen, Einschläge, Teilchen, Pfützen, schwebende Zahlen und Bildschirmwackeln.
// Sie liest den Zustand der Simulation und ihre Ereignisse und verändert ihn nie.
//
// Aufbau:
//   effects/batches.js    Zeichenstapel (Leuchtflecken und -striche, Bodenringe, Pfützen, Zahlen)
//   effects/particles.js  das Teilchensystem mit hartem Vorrat
//   effects/recipes.js    welche Teilchen ein Ereignis auslöst
//   diese Datei           Ereignisse deuten, Geschosse und Strahlen je Bild zeichnen
//
// Zeit: Effekte laufen in Spielzeit (bei Pause stehen sie), aber höchstens doppelt so schnell wie die echte Zeit,
// damit bei vierfachem Spieltempo nichts zu einem Flackern wird; dafür werden die Teilchen dann ausgedünnt.

import * as THREE from 'three';
import { getModel } from '../content/models.js';
import { TINTED_SHOTS } from '../content/models/shots.js';
import { DecalBatch, GlowBatch, SHAPE_CORE, SHAPE_SOFT, TextBatch, ZoneBatch, sceneLight } from './effects/batches.js';
import { ParticleSystem } from './effects/particles.js';
import * as recipes from './effects/recipes.js';
import { recipeLook } from '../sim/rules.js';
import { InstancedModel, makeAnimCtx } from './instances.js';
import { createModel } from './kit.js';
import { FLY_HEIGHT, PATH_DEPTH, enemyBaseY } from './layout.js';

/** @import { Quality, Settings } from '../types/app' */
/** @import { ShotVisual } from '../types/content' */
/** @import { ColorLike } from '../types/model' */
/** @import { EffectLayer, EntityLayer, RenderEnv, World } from '../types/render' */
/** @import { Enemy, Sim, SimEvent, Tower } from '../types/sim' */
/** @import { FxContext } from './effects/recipes.js' */

/** Größter Teilchenvorrat je Grafikstufe. */
const BUDGET = { high: 1500, medium: 1000, low: 600 };
/** Anteil der Teilchen je Grafikstufe. */
const DENSITY = { high: 1, medium: 0.8, low: 0.55 };
/** Größte Auslenkung der Kamera beim Wackeln in Feldern. */
const SHAKE_MAX = 0.12;
/** Höhe der Körpermitte eines Bodengegners, wenn die Figur selbst nicht mehr greifbar ist. */
const BODY_Y = 0.28;
/** Höhe, auf der Splitter und Münzen liegen bleiben (knapp über dem abgesenkten Weg). */
const FLOOR_Y = -PATH_DEPTH + 0.03;

const TEXT_GOLD = '#ffd84a';
const TEXT_GOLD_EDGE = '#5b3a0b';
/** Zuschlag einer Kopfgeld-Aura: helleres, fast weißes Gold mit grünlichem Rand, damit er sich vom Grundbetrag abhebt. */
const TEXT_BONUS = '#fff6b0';
const TEXT_BONUS_EDGE = '#2f5a14';
/** Staub beim Rückstoß. */
const DUST_PUSH = new THREE.Color('#d8c7a4');
const TEXT_RED = '#ff7867';
const TEXT_RED_EDGE = '#5a1612';
const TEXT_ALERT = '#ffb43c';

const MAX_DELAYED = 320;
/** Sekunden zwischen zwei Flächenringen eines Dauerstrahls mit Fläche (Brennglas). */
const AREA_BEAM_GAP = 0.8;
/** Ab dieser Pause zwischen zwei Schüssen gilt der Treffer einer Superwaffe als schwer (größerer Einschlag, leichtes Beben). */
const HEAVY_COOLDOWN = 3;
const MAX_STREAKS = 64;
const STREAK_FLOATS = 16;
const MAX_BOLTS = 24;
const BOLT_POINTS = 8;
const BOLT_FLOATS = BOLT_POINTS * 3 + 8;
const MAX_HANDS = 10;
/** Verschmelzung: Sekunden, bis die Lichter der Zutaten im Kern angekommen sind. Muss zu FUSE_DELAY in entities.js passen. */
const FUSE_FLIGHT = 0.6;
const MAX_FUSE_LIGHTS = 48;
const FUSE_FLOATS = 14;
const MAX_FUSE_ARRIVALS = 8;
/** Lichter je Zutat nach Grafikstufe. */
const FUSE_LIGHTS = { high: 7, medium: 6, low: 4 };
/** So viel größer fliegen die Geschosse einer Superwaffe. */
const SUPER_SHOT_SCALE = 1.3;
/** Sekunden, die die Stampfwelle bis zum Rand ihrer Reichweite braucht. */
const STOMP_LIFE = 0.42;
/** Kennung des Netzes, das ein Netzwerfer wirft (eigenes Modell dieser Schicht, siehe netModel). */
const NET_SHOT = 'fx.shot.net';
/** @type {import('../types/model').ModelSpec | null} */
let netSpec = null;

/**
 * Ein geworfenes Netz: Randseil, innerer Ring, drei gekreuzte Seile und sechs Gewichte am Rand, quer zur Flugrichtung (+Z).
 * Hell, damit es mit der Farbe des Schusses eingefärbt werden kann.
 * @returns {import('../types/model').ModelSpec}
 */
function netModel() {
  if (!netSpec) {
    const m = createModel(NET_SHOT);
    const body = m.part('body');
    const rope = '#f4ead2';
    body.torus({ r: 0.2, tube: 0.014, seg: 14, tubeSeg: 3, at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: rope });
    body.torus({ r: 0.105, tube: 0.01, seg: 10, tubeSeg: 3, at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], color: rope });
    for (let i = 0; i < 3; i++) body.box({ size: [0.4, 0.014, 0.014], at: [0, 0, 0], rot: [0, 0, (i / 3) * Math.PI], color: rope });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      body.sphere({ r: 0.028, detail: 0, at: [Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0], color: '#b9b2a4' });
    }
    netSpec = m.build();
  }
  return netSpec;
}
/** Sekunden zwischen zwei Taktringen einer Superwaffe ohne eigenen Angriff (Taktgeber-Kern; die Simulation meldet keine Schüsse). */
const BEAT_PERIOD = 2.4;
/** Lebensdauer der Bodenringe eines Pulses: gewöhnlich, Frostpuls (ruhiger) und Feuerring. */
const PULSE_LIFE = 0.55;
const FROST_LIFE = 0.85;
const FIRE_RING_LIFE = 0.62;
const STEAM_LIFE = 1.1;
const HAND_FLOATS = 10;

/** Arten von Leuchtstrichen mit eigener Lebensdauer. */
const STREAK_FADE = 0;
const STREAK_TRACER = 1;
const STREAK_COLUMN = 2;

/**
 * @typedef {object} ShotState Was sich die Schicht je fliegendem Geschoss merkt.
 * @property {number} sx @property {number} sy @property {number} sz Start (Mündung beim ersten Anblick)
 * @property {number} ty letzte bekannte Höhe des Ziels
 * @property {number} seed
 * @property {number} scale Größe (Geschosse einer Superwaffe sind größer)
 * @property {number} acc Zeit seit dem letzten Spurteilchen
 * @property {number} stamp Bildnummer des letzten Anblicks
 * @property {boolean} sup Geschoss einer Super- oder Megawaffe (zeigt `superShot`)
 * @property {ShotVisual | null} look Angriffsbild der Superwaffe (auch eines Rezepts), beim ersten Anblick bestimmt
 * @property {Tower['arch'] | null} arch @property {number} tier Rolle und Technikstand des Geschosses
 * @property {number} towerId Urheber
 * @property {number} tx @property {number} tz Zielpunkt beim letzten Anblick
 * @property {boolean} landed Ein Treffer wurde ihm schon zugeordnet
 */

/**
 * @typedef {object} BeamState Ein stehender Strahl eines Turms.
 * @property {number} mx @property {number} my @property {number} mz Mündung
 * @property {number} tx @property {number} ty @property {number} tz Auftreffpunkt
 * @property {number} strength 0..1
 * @property {number} hold Sekunden nach dem letzten Schuss, die der Strahl voll steht
 * @property {number} fade Sekunden zum Ausblenden
 * @property {boolean} continuous Dauerstrahl (folgt dem Ziel) statt einzelner Impulse
 * @property {boolean} sup Strahl einer Super- oder Megawaffe: wird mit der Zeit auf dem Ziel breiter und heller
 * @property {number} heat 0..1 geglättet: Anteil der erreichten Steigerung (ramp)
 * @property {THREE.Color} color
 * @property {THREE.Color} own Arbeitsfarbe (aufgeheizte Leitfarbe)
 */

/**
 * @typedef {object} FlameState Der laufende Flammenstoß eines Brenners.
 * @property {number} tx @property {number} ty @property {number} tz Ziel
 * @property {number} time Restdauer des Stoßes
 * @property {THREE.Color} color
 * @property {string} flavor
 */

/**
 * @param {RenderEnv} env
 * @param {EntityLayer} entities
 * @param {World} world
 * @returns {EffectLayer & { readonly debug: { particles: number, budget: number, glows: number, rings: number, texts: number, projectiles: number } }}
 */
export function createEffectLayer(env, entities, world) {
  const group = new THREE.Group();
  group.name = 'effects';
  env.scene.add(group);

  const glow = new GlowBatch(4096);
  const decals = new DecalBatch(96);
  const zones = new ZoneBatch(64);
  const text = new TextBatch(40);
  const ps = new ParticleSystem(env.materials, glow, BUDGET.high);
  group.add(zones.mesh, decals.mesh, ps.group, glow.mesh, text.mesh);

  /** @type {Sim | null} */
  let sim = null;
  /** @type {Quality} */
  let quality = 'high';
  let shakeEnabled = true;
  let textEnabled = true;
  /** Laufzeit der Effekte in Sekunden. */
  let time = 0;
  /** Geglättetes Spieltempo (simulierte je echte Sekunde). */
  let speed = 1;
  let idle = 0;
  let frame = 0;
  let lightTimer = 0;
  let trauma = 0;
  let shakeTime = 0;
  const shake = new THREE.Vector3();
  const debug = { particles: 0, budget: BUDGET.high, glows: 0, rings: 0, texts: 0, projectiles: 0 };

  // --- Arbeitswerte (werden wiederverwendet) ---
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vDir = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const quatSpin = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const unit = new THREE.Vector3(1, 1, 1);
  const shotScale = new THREE.Vector3(1, 1, 1);
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const tmpColor = new THREE.Color();
  const lightSum = new THREE.Color();
  const animCtx = makeAnimCtx();

  /** @type {Map<ColorLike, THREE.Color>} */
  const colors = new Map();
  /**
   * Farbe aus den Daten als (lineare) THREE.Color, zwischengespeichert.
   * @param {ColorLike} value
   * @returns {THREE.Color}
   */
  function colorOf(value) {
    let c = colors.get(value);
    if (!c) {
      c = new THREE.Color(value);
      colors.set(value, c);
    }
    return c;
  }

  const FIRE_FALLBACK = new THREE.Color('#ff8a3c');
  /** @type {Map<THREE.Color, THREE.Color>} */
  const fireColors = new Map();
  const hsl = { h: 0, s: 0, l: 0 };
  /**
   * Glutfarbe zu einer Leitfarbe: Feuerfarben bleiben, wie sie sind; eine Leitfarbe, die nicht nach Feuer aussieht
   * (grauer Fels, Tonkrug), weicht einem warmen Orange, damit Feuerspur, Brand und Brandfeld nicht grau glimmen.
   * @param {THREE.Color} color
   * @returns {THREE.Color}
   */
  function fireOf(color) {
    let c = fireColors.get(color);
    if (!c) {
      color.getHSL(hsl);
      const warm = hsl.h < 0.14 || hsl.h > 0.8;
      c = hsl.s >= 0.55 && hsl.l >= 0.35 && warm ? color : FIRE_FALLBACK.clone().lerp(color, warm && hsl.s > 0.3 ? 0.25 : 0);
      fireColors.set(color, c);
    }
    return c;
  }

  /**
   * Was ein Schuss eines Turms zeigt: Super- und Megawaffen zeigen `superShot`, sofern das Zeitalter eins angibt; ergeben
   * Kern und Zutaten ein Rezept (etwa die Flak), dessen Angriffsbild.
   * @param {Tower['arch']} arch
   * @param {number} tier
   * @param {boolean} sup
   * @param {readonly string[]} [gifts] Rollen der Zutaten der Superwaffe
   * @param {string} [recipe] `tower.recipe` der Superwaffe ('' = keins)
   * @returns {ShotVisual | null}
   */
  function visualOf(arch, tier, sup, gifts, recipe) {
    const def = arch.tiers[tier];
    if (!def) return null;
    if (!sup) return def.shot;
    const look = gifts && gifts.length > 0 ? recipeLook(arch, tier, gifts, recipe ?? '', sim ? sim.content : undefined) : null;
    if (look && look.superShot) return look.superShot;
    return def.superShot ? def.superShot : def.shot;
  }

  // --- Nachzügler: Teilchenschübe, die erst nach einer Verzögerung ausgelöst werden ---
  const laterTime = new Float32Array(MAX_DELAYED);
  const laterData = new Float32Array(MAX_DELAYED * 4);
  const laterType = new Uint8Array(MAX_DELAYED);
  /** @type {THREE.Color[]} */
  const laterColor = [];
  for (let i = 0; i < MAX_DELAYED; i++) laterColor.push(new THREE.Color());
  let laterCount = 0;

  /** @type {FxContext} */
  const fx = {
    ps,
    decals,
    light: 1,
    comp: 1,
    later(delay, type, x, y, z, scale, color) {
      if (laterCount >= MAX_DELAYED) return;
      const i = laterCount++;
      laterTime[i] = delay;
      laterType[i] = type;
      laterData[i * 4] = x;
      laterData[i * 4 + 1] = y;
      laterData[i * 4 + 2] = z;
      laterData[i * 4 + 3] = scale;
      laterColor[i].copy(color);
    },
  };

  /** @param {number} dt */
  function updateDelayed(dt) {
    for (let i = 0; i < laterCount; i++) {
      laterTime[i] -= dt;
      if (laterTime[i] > 0) continue;
      const k = i * 4;
      tmpColor.copy(laterColor[i]);
      const type = laterType[i];
      const x = laterData[k];
      const y = laterData[k + 1];
      const z = laterData[k + 2];
      const s = laterData[k + 3];
      // Letzten Eintrag an diese Stelle holen.
      laterCount--;
      if (i < laterCount) {
        laterTime[i] = laterTime[laterCount];
        laterType[i] = laterType[laterCount];
        laterData.copyWithin(k, laterCount * 4, laterCount * 4 + 4);
        laterColor[i].copy(laterColor[laterCount]);
      }
      i--;
      recipes.runDelayed(fx, type, x, y, z, s, tmpColor);
    }
  }

  // --- Leuchtstriche mit eigener Lebensdauer (Leuchtspuren, Lichtsäulen) ---
  // je Strich: ax ay az bx by bz Breite r g b Alter Dauer Form Art Deckkraft Alpha
  const streaks = new Float32Array(MAX_STREAKS * STREAK_FLOATS);
  let streakCount = 0;

  /**
   * @param {THREE.Vector3} a @param {THREE.Vector3} b
   * @param {number} width
   * @param {THREE.Color} color @param {number} gain
   * @param {number} life
   * @param {number} mode STREAK_*
   * @param {number} shape SHAPE_*
   * @param {number} [solid]
   * @param {number} [alpha]
   */
  function addStreak(a, b, width, color, gain, life, mode, shape, solid = 0, alpha = 1) {
    if (streakCount >= MAX_STREAKS) return;
    const k = streakCount++ * STREAK_FLOATS;
    streaks[k] = a.x;
    streaks[k + 1] = a.y;
    streaks[k + 2] = a.z;
    streaks[k + 3] = b.x;
    streaks[k + 4] = b.y;
    streaks[k + 5] = b.z;
    streaks[k + 6] = width;
    streaks[k + 7] = color.r * gain;
    streaks[k + 8] = color.g * gain;
    streaks[k + 9] = color.b * gain;
    streaks[k + 10] = 0;
    streaks[k + 11] = life;
    streaks[k + 12] = shape;
    streaks[k + 13] = mode;
    streaks[k + 14] = solid;
    streaks[k + 15] = alpha;
  }

  /** @param {number} dt */
  function updateStreaks(dt) {
    const d = streaks;
    for (let i = 0; i < streakCount; i++) {
      const k = i * STREAK_FLOATS;
      // Im ersten Bild noch nicht altern, damit auch ein sehr kurzer Strich mindestens einmal voll zu sehen ist.
      const age = d[k + 10];
      d[k + 10] = age + dt;
      const t = age / d[k + 11];
      if (t >= 1) {
        streakCount--;
        if (i < streakCount) d.copyWithin(k, streakCount * STREAK_FLOATS, (streakCount + 1) * STREAK_FLOATS);
        i--;
        continue;
      }
      const mode = d[k + 13];
      let ax = d[k];
      let ay = d[k + 1];
      let az = d[k + 2];
      let width = d[k + 6];
      let alpha = d[k + 15];
      if (mode === STREAK_TRACER) {
        // Das hintere Ende eilt dem Treffer nach: Der Strich schrumpft zum Ziel hin.
        const u = t * t * 0.85;
        ax += (d[k + 3] - ax) * u;
        ay += (d[k + 4] - ay) * u;
        az += (d[k + 5] - az) * u;
        alpha *= 1 - t * t;
      } else if (mode === STREAK_COLUMN) {
        const s = Math.sin(Math.PI * Math.min(1, t * 1.08));
        alpha *= s * (0.6 + 0.4 * s);
        width *= 0.75 + 0.35 * t;
      } else {
        alpha *= (1 - t) * (1 - t);
      }
      glow.streak(ax, ay, az, d[k + 3], d[k + 4], d[k + 5], width, d[k + 7], d[k + 8], d[k + 9], alpha, d[k + 14], d[k + 12]);
    }
  }

  // --- Blitze: gezackte Linien, je Schuss neu gewürfelt ---
  // je Blitz: Punkte (x y z) * BOLT_POINTS, dann Breite r g b Alter Dauer Punktzahl frei
  const bolts = new Float32Array(MAX_BOLTS * BOLT_FLOATS);
  let boltCount = 0;

  /**
   * @param {THREE.Vector3} a @param {THREE.Vector3} b
   * @param {THREE.Color} color
   * @param {number} life
   * @param {number} [soft] 1 = Kettenblitz einer Superwaffe: weicher, ohne Zittern, etwas länger sichtbar
   */
  function addBolt(a, b, color, life, soft = 0) {
    if (boltCount >= MAX_BOLTS) return;
    const k = boltCount++ * BOLT_FLOATS;
    const len = a.distanceTo(b);
    const n = Math.max(3, Math.min(BOLT_POINTS, 2 + Math.ceil(len / 0.45)));
    const amp = Math.min(0.22, len * 0.12);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const w = Math.sin(Math.PI * u) * amp;
      bolts[k + i * 3] = a.x + (b.x - a.x) * u + (Math.random() * 2 - 1) * w;
      bolts[k + i * 3 + 1] = a.y + (b.y - a.y) * u + (Math.random() * 2 - 1) * w;
      bolts[k + i * 3 + 2] = a.z + (b.z - a.z) * u + (Math.random() * 2 - 1) * w;
    }
    const m = k + BOLT_POINTS * 3;
    bolts[m] = 0.1;
    bolts[m + 1] = color.r;
    bolts[m + 2] = color.g;
    bolts[m + 3] = color.b;
    bolts[m + 4] = 0;
    bolts[m + 5] = life;
    bolts[m + 6] = n;
    bolts[m + 7] = soft;
  }

  /** @param {number} dt */
  function updateBolts(dt) {
    const d = bolts;
    for (let i = 0; i < boltCount; i++) {
      const k = i * BOLT_FLOATS;
      const m = k + BOLT_POINTS * 3;
      const age = d[m + 4];
      d[m + 4] = age + dt;
      const t = age / d[m + 5];
      if (t >= 1) {
        boltCount--;
        if (i < boltCount) d.copyWithin(k, boltCount * BOLT_FLOATS, (boltCount + 1) * BOLT_FLOATS);
        i--;
        continue;
      }
      const soft = d[m + 7] > 0;
      // Der Kettenblitz einer Superwaffe springt über viele Ziele: kein Zittern, ein weiches Ein- und Ausblenden,
      // damit die Kette als ruhiges Leuchten statt als Gewitter liest.
      const alpha = soft ? Math.min(1, age / 0.03) * (1 - t) * (1 - 0.5 * t) : (1 - t) * (0.8 + 0.2 * Math.sin(age * 95));
      const n = d[m + 6];
      const w = d[m] * (1 - 0.4 * t) * (soft ? 0.85 : 1);
      const core = soft ? 1.8 : 2.3;
      const r = d[m + 1];
      const g = d[m + 2];
      const b = d[m + 3];
      for (let p = 0; p + 1 < n; p++) {
        const q = k + p * 3;
        glow.streak(d[q], d[q + 1], d[q + 2], d[q + 3], d[q + 4], d[q + 5], w * (soft ? 3.2 : 2.6), r * 1.3, g * 1.3, b * 1.3, alpha * (soft ? 0.3 : 0.25), 0, SHAPE_SOFT);
        glow.streak(d[q], d[q + 1], d[q + 2], d[q + 3], d[q + 4], d[q + 5], w, r * core, g * core, b * core, alpha, 0.3, SHAPE_CORE);
      }
      const e = k + (n - 1) * 3;
      glow.blob(d[e], d[e + 1], d[e + 2], soft ? 0.42 : 0.36, r * 1.6, g * 1.6, b * 1.6, alpha * (soft ? 0.5 : 0.6));
    }
  }

  // --- Uhrzeiger: die treibenden Schwebeteilchen der Zeitglocke ---
  // je Zeiger: x y z vx vy Winkel Drehung Größe Alter Dauer
  const hands = new Float32Array(MAX_HANDS * HAND_FLOATS);
  let handCount = 0;

  /** @param {number} dt */
  function updateHands(dt) {
    const d = hands;
    const c = recipes.GOLD;
    for (let i = 0; i < handCount; i++) {
      const k = i * HAND_FLOATS;
      d[k + 8] += dt;
      const age = d[k + 8];
      if (age >= d[k + 9]) {
        handCount--;
        if (i < handCount) d.copyWithin(k, handCount * HAND_FLOATS, (handCount + 1) * HAND_FLOATS);
        i--;
        continue;
      }
      if (age < 0) continue;
      const t = age / d[k + 9];
      d[k] += d[k + 3] * dt;
      d[k + 1] += d[k + 4] * dt;
      d[k + 5] += d[k + 6] * dt;
      const alpha = Math.sin(Math.PI * t) ** 0.8;
      const x = d[k];
      const y = d[k + 1];
      const z = d[k + 2];
      const s = d[k + 7];
      const a = d[k + 5];
      // Großer und kleiner Zeiger in einer zur Kamera gewandten Ebene, dazu ein weicher Hof als Zifferblatt.
      glow.blob(x, y, z, s * 2.6, c.r * 1.3, c.g * 1.3, c.b * 1.3, alpha * 0.28, 0.2);
      glow.streak(x, y, z, x + Math.sin(a) * s, y + Math.cos(a) * s, z, 0.07, c.r * 1.9, c.g * 1.9, c.b * 1.9, alpha, 0.5, SHAPE_CORE);
      glow.streak(x, y, z, x + Math.sin(a * 0.25 + 2) * s * 0.62, y + Math.cos(a * 0.25 + 2) * s * 0.62, z, 0.08, c.r * 1.9, c.g * 1.9, c.b * 1.9, alpha, 0.5, SHAPE_CORE);
    }
  }

  // --- Verschmelzung: Lichter, die im Bogen von den Zutaten in den Kern fliegen ---
  // Läuft in echter Zeit wie die Animationen der Figurenschicht, damit Lichter und Anschwellen des Kerns zusammenpassen.
  // je Licht: sx sy sz tx ty tz Alter(negativ = wartet) Dauer Bogenhöhe Seitenversatz r g b Größe
  const fuseLights = new Float32Array(MAX_FUSE_LIGHTS * FUSE_FLOATS);
  let fuseLightCount = 0;
  // je Ankunft: Restzeit x z; die Farbe liegt daneben.
  const fuseArrivals = new Float32Array(MAX_FUSE_ARRIVALS * 3);
  /** @type {THREE.Color[]} */
  const fuseArrivalColor = [];
  for (let i = 0; i < MAX_FUSE_ARRIVALS; i++) fuseArrivalColor.push(new THREE.Color());
  const fuseArrivalMega = new Uint8Array(MAX_FUSE_ARRIVALS);
  let fuseArrivalCount = 0;

  /**
   * @param {Tower} core
   * @param {{ arch: { id: string, color: ColorLike }, x: number, z: number }[]} parts
   * @param {boolean} mega Zweite Verschmelzung zur Megawaffe: größere Feier (siehe updateFusion)
   */
  function onFuse(core, parts, mega) {
    const perPart = FUSE_LIGHTS[quality];
    const coreY = mega ? 0.8 : 0.65;
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      const color = colorOf(part.arch.color);
      recipes.fuseDissolve(fx, part.x, part.z, color);
      for (let i = 0; i < perPart && fuseLightCount < MAX_FUSE_LIGHTS; i++) {
        const k = fuseLightCount++ * FUSE_FLOATS;
        const a = Math.random() * 6.283;
        const delay = (i / perPart) * 0.22 + Math.random() * 0.03;
        fuseLights[k] = part.x + Math.cos(a) * 0.16;
        fuseLights[k + 1] = 0.25 + (i / perPart) * 0.75;
        fuseLights[k + 2] = part.z + Math.sin(a) * 0.16;
        fuseLights[k + 3] = core.x;
        fuseLights[k + 4] = coreY;
        fuseLights[k + 5] = core.z;
        fuseLights[k + 6] = -delay;
        fuseLights[k + 7] = FUSE_FLIGHT - delay;
        fuseLights[k + 8] = 0.55 + Math.random() * 0.5;
        fuseLights[k + 9] = (Math.random() - 0.5) * 0.7;
        fuseLights[k + 10] = color.r;
        fuseLights[k + 11] = color.g;
        fuseLights[k + 12] = color.b;
        fuseLights[k + 13] = 0.2 + Math.random() * 0.07;
      }
    }
    if (fuseArrivalCount < MAX_FUSE_ARRIVALS) {
      const i = fuseArrivalCount++;
      fuseArrivals[i * 3] = FUSE_FLIGHT;
      fuseArrivals[i * 3 + 1] = core.x;
      fuseArrivals[i * 3 + 2] = core.z;
      fuseArrivalColor[i].copy(colorOf(core.arch.color));
      fuseArrivalMega[i] = mega ? 1 : 0;
    }
  }

  /**
   * Punkt auf der Bahn eines Verschmelzungslichts.
   * @param {number} k Anfang des Lichts im Feld
   * @param {number} u Flugfortschritt 0..1
   * @param {THREE.Vector3} out
   */
  function fusePoint(k, u, out) {
    // Erst lösen sich die Lichter gemächlich, dann ziehen sie beschleunigt in den Kern.
    const e = u * (0.3 + 0.7 * u);
    const sx = fuseLights[k];
    const sz = fuseLights[k + 2];
    const dx = fuseLights[k + 3] - sx;
    const dz = fuseLights[k + 5] - sz;
    const bow = Math.sin(e * Math.PI);
    const side = fuseLights[k + 9] * bow;
    out.set(sx + dx * e - dz * side, fuseLights[k + 1] + (fuseLights[k + 4] - fuseLights[k + 1]) * e + fuseLights[k + 8] * bow, sz + dz * e + dx * side);
  }

  /** @param {number} dt echte Sekunden */
  function updateFusion(dt) {
    for (let i = 0; i < fuseLightCount; i++) {
      const k = i * FUSE_FLOATS;
      const age = fuseLights[k + 6] + dt;
      const life = fuseLights[k + 7];
      if (age >= life) {
        fuseLightCount--;
        if (i < fuseLightCount) fuseLights.copyWithin(k, fuseLightCount * FUSE_FLOATS, (fuseLightCount + 1) * FUSE_FLOATS);
        i--;
        continue;
      }
      fuseLights[k + 6] = age;
      if (age <= 0) continue;
      const u = age / life;
      fusePoint(k, u, vA);
      fusePoint(k, Math.max(0, u - 0.13), vB);
      const fade = Math.min(1, u * 6) * Math.min(1, (1 - u) * 5);
      const size = fuseLights[k + 13] * (0.6 + 0.4 * fade);
      const r = fuseLights[k + 10];
      const g = fuseLights[k + 11];
      const b = fuseLights[k + 12];
      glow.streak(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, size * 0.55, r * 1.3, g * 1.3, b * 1.3, 0.5 * fade, 0.2);
      glow.blob(vA.x, vA.y, vA.z, size, r * 1.9 + 0.25, g * 1.9 + 0.25, b * 1.9 + 0.25, fade, 0.45, SHAPE_CORE);
    }
    for (let i = 0; i < fuseArrivalCount; i++) {
      const k = i * 3;
      fuseArrivals[k] -= dt;
      if (fuseArrivals[k] > 0) continue;
      const mega = fuseArrivalMega[i] === 1;
      const x = fuseArrivals[k + 1];
      const z = fuseArrivals[k + 2];
      recipes.fuseArrive(fx, x, z, fuseArrivalColor[i], mega);
      if (mega) {
        // Megawaffe: eine hohe, weiche Lichtsäule in Gold mit hellem Kern, länger als die der Modernisierung,
        // dazu goldene Körnchen. Sie schwillt an und ab, statt aufzublitzen.
        vA.set(x, 0, z);
        vB.set(x, 5.2, z);
        addStreak(vA, vB, 1.25, recipes.GOLD, 1.2, 1.2, STREAK_COLUMN, SHAPE_SOFT, 0.1, 0.45);
        addStreak(vA, vB, 0.45, tmpColor.copy(fuseArrivalColor[i]).lerp(recipes.WHITE, 0.6), 1.5, 1.2, STREAK_COLUMN, SHAPE_SOFT, 0.1, 0.6);
        recipes.risingMotes(fx, x, 0.4, z, 6, 1.2);
      }
      fuseArrivalCount--;
      if (i < fuseArrivalCount) {
        fuseArrivals.copyWithin(k, fuseArrivalCount * 3, fuseArrivalCount * 3 + 3);
        fuseArrivalColor[i].copy(fuseArrivalColor[fuseArrivalCount]);
        fuseArrivalMega[i] = fuseArrivalMega[fuseArrivalCount];
      }
      i--;
    }
  }

  // --- Geschosse ---
  /** @type {Map<string, { inst: InstancedModel, tinted: boolean }>} */
  const shotModels = new Map();
  /** @type {Map<number, ShotState>} */
  const shotStates = new Map();
  /** @type {ShotState[]} */
  const shotPool = [];

  /**
   * @param {string} id
   * @returns {{ inst: InstancedModel, tinted: boolean }}
   */
  function shotModel(id) {
    let entry = shotModels.get(id);
    if (!entry) {
      const inst = new InstancedModel(id === NET_SHOT ? netModel() : getModel(id), env.materials, { capacity: 32, castShadow: true, receiveShadow: false });
      group.add(inst.group);
      entry = { inst, tinted: id === NET_SHOT || TINTED_SHOTS.includes(id) };
      shotModels.set(id, entry);
    }
    return entry;
  }

  /**
   * @param {ShotState} state
   * @param {number} id
   */
  function sweepShot(state, id) {
    if (state.stamp === frame) return;
    shotStates.delete(id);
    shotPool.push(state);
  }

  /**
   * @param {number} fdt
   * @param {number} alpha
   */
  function updateProjectiles(fdt, alpha) {
    shotModels.forEach(beginShotModel);
    if (!sim) {
      shotModels.forEach(endShotModel);
      return;
    }
    const list = sim.state.projectiles;
    debug.projectiles = list.length;
    // Viele Geschosse: Spuren ausdünnen.
    const thin = 1 + list.length / 50;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const tierDef = p.arch.tiers[p.tier];
      if (!tierDef) continue;
      let st = shotStates.get(p.id);
      if (!st) {
        st = shotPool.pop() ?? { sx: 0, sy: 0, sz: 0, ty: 0, seed: 0, scale: 1, acc: 0, stamp: 0, sup: false, look: null, arch: null, tier: 0, towerId: -1, tx: 0, tz: 0, landed: false };
        st.arch = p.arch;
        st.tier = p.tier;
        st.towerId = p.towerId;
        st.landed = false;
        const tower = sim.towerById(p.towerId);
        if (tower) entities.muzzleOf(tower, vA);
        else vA.set(p.sx, 0.8, p.sz);
        st.sx = vA.x;
        st.sy = vA.y;
        st.sz = vA.z;
        st.ty = p.targetFlying ? FLY_HEIGHT + 0.3 : p.targetId >= 0 ? BODY_Y : FLOOR_Y;
        st.seed = Math.random();
        st.sup = Boolean(tower && tower.super);
        st.look = tower && tower.super ? visualOf(p.arch, p.tier, true, tower.gifts, tower.recipe) : null;
        st.scale = st.sup ? SUPER_SHOT_SCALE : 1;
        st.acc = 0;
        shotStates.set(p.id, st);
      }
      st.stamp = frame;
      st.tx = p.tx;
      st.tz = p.tz;
      const shot = st.look ?? tierDef.shot;
      if (p.targetId >= 0) {
        const enemy = sim.enemyById(p.targetId);
        if (enemy && enemy.alive) st.ty = entities.enemyCenter(enemy, vB).y;
      }
      const u = Math.min(1, p.pt + (p.t - p.pt) * alpha);
      const arc = shot.arc ?? 0;
      const dx = p.tx - st.sx;
      const dy = st.ty - st.sy;
      const dz = p.tz - st.sz;
      const x = st.sx + dx * u;
      const y = st.sy + dy * u + arc * 4 * u * (1 - u);
      const z = st.sz + dz * u;
      // Flugrichtung = Ableitung der Bahn.
      vDir.set(dx, dy + arc * 4 * (1 - 2 * u), dz);
      const len = vDir.length();
      if (len > 1e-5) vDir.multiplyScalar(1 / len);
      else vDir.set(0, 0, 1);
      const color = colorOf(shot.color);
      if (shot.kind === 'model' && shot.model) {
        // Ein Netz (Netzwerfer) fliegt als sich entfaltendes, drehendes Netz statt als Stein, wie es die Angabe des Modells will.
        const net = shot.impact === 'net';
        const entry = shotModel(net ? NET_SHOT : shot.model);
        quat.setFromUnitVectors(axisZ, vDir);
        if (net) quat.multiply(quatSpin.setFromAxisAngle(axisZ, st.seed * 6.283 + u * p.duration * 5));
        else if (shot.tumble) quat.multiply(quatSpin.setFromAxisAngle(axisX, st.seed * 6.283 + u * p.duration * (7 + st.seed * 4)));
        const open = net ? 0.45 + 0.55 * Math.min(1, u * 1.8) : 1;
        matrix.compose(vPos.set(x, y, z), quat, st.scale === 1 && open === 1 ? unit : shotScale.setScalar(st.scale * open));
        animCtx.t = time;
        animCtx.seed = st.seed;
        if (entry.tinted) entry.inst.add(matrix, animCtx, color);
        else entry.inst.add(matrix, animCtx);
      } else if (shot.kind !== 'none') {
        // Geschoss ohne Modell: ein fliegender Leuchtpunkt.
        glow.blob(x, y, z, 0.22 * st.scale, color.r * 2, color.g * 2, color.b * 2, 1, 0.3, SHAPE_CORE);
        glow.streak(x, y, z, x - vDir.x * 0.4, y - vDir.y * 0.4, z - vDir.z * 0.4, 0.14 * st.scale, color.r * 1.6, color.g * 1.6, color.b * 1.6, 0.6);
      }
      const trail = shot.trail;
      if (trail && trail !== 'none') {
        if (trail === 'fire') {
          // Brennendes Geschoss: weicher Glutschein um das Modell und eine kurze Feuerfahne dahinter.
          const f = fireOf(color);
          glow.blob(x, y, z, 0.42 * st.scale, f.r * 1.5, f.g * 1.5, f.b * 1.5, 0.55);
          glow.streak(x, y, z, x - vDir.x * 0.55, y - vDir.y * 0.55, z - vDir.z * 0.55, 0.2 * st.scale, f.r * 1.7, f.g * 1.7, f.b * 1.7, 0.6);
        } else if (trail === 'energy' || trail === 'frost') {
          glow.streak(x, y, z, x - vDir.x * 0.45, y - vDir.y * 0.45, z - vDir.z * 0.45, 0.16, color.r * 1.7, color.g * 1.7, color.b * 1.7, 0.6);
        } else if (trail === 'spark') {
          glow.blob(x - vDir.x * 0.12, y - vDir.y * 0.12 + 0.05, z - vDir.z * 0.12, 0.2, color.r * 1.8, color.g * 1.8, color.b * 1.8, 0.55);
        }
        st.acc += fdt;
        const interval = 0.05 * thin;
        if (st.acc >= interval) {
          st.acc = st.acc % interval;
          recipes.trail(fx, trail, x - vDir.x * 0.16, y - vDir.y * 0.16, z - vDir.z * 0.16, trail === 'fire' ? fireOf(color) : color);
        }
      }
    }
    shotModels.forEach(endShotModel);
    shotStates.forEach(sweepShot);
  }

  /** @param {{ inst: InstancedModel }} entry */
  function beginShotModel(entry) {
    entry.inst.begin();
  }

  /** @param {{ inst: InstancedModel }} entry */
  function endShotModel(entry) {
    entry.inst.end();
  }

  // --- Strahlen ---
  /** @type {Map<number, BeamState>} */
  const beams = new Map();
  /** @type {BeamState[]} */
  const beamPool = [];
  let beamDt = 0;

  /**
   * @param {BeamState} beam
   * @param {number} id Kennung des Turms
   */
  function updateBeam(beam, id) {
    const tower = sim ? sim.towerById(id) : null;
    let on = false;
    if (sim && tower) {
      const visual = visualOf(tower.arch, tower.tier, tower.super, tower.gifts, tower.recipe);
      on = visual !== null && kindOf(visual, tower) === 'beam' && sim.state.time - tower.lastShot <= beam.hold;
      if (on && (beam.sup || tower.stats.ramp > 0)) {
        // Steigerung des Dauerstrahls: Er wird breiter und heller, je länger er auf demselben Ziel liegt (Superwaffen und
        // aufheizende Strahlen wie der Bohrer).
        const st = tower.stats;
        const wanted = st.ramp > 0 && st.rampTime > 0 ? Math.min(1, tower.beamTime / st.rampTime) : 0;
        beam.heat += (wanted - beam.heat) * Math.min(1, beamDt * 6);
      }
      if (on) {
        entities.muzzleOf(tower, vA);
        beam.mx = vA.x;
        beam.my = vA.y;
        beam.mz = vA.z;
        if (beam.continuous && tower.targetId >= 0) {
          const enemy = sim.enemyById(tower.targetId);
          if (enemy && enemy.alive) {
            entities.enemyCenter(enemy, vB);
            beam.tx = vB.x;
            beam.ty = vB.y;
            beam.tz = vB.z;
          }
        }
      }
    }
    beam.strength = on ? Math.min(1, Math.max(0.6, beam.strength + beamDt * 30)) : beam.strength - beamDt / beam.fade;
    if (beam.strength <= 0) {
      beams.delete(id);
      beamPool.push(beam);
      return;
    }
    const s = beam.strength;
    let c = beam.color;
    let pulse = 1 + 0.12 * Math.sin(time * 24 + id * 1.7);
    let wide = 1;
    let core = 2.2;
    let solid = 0.3;
    if (beam.sup) {
      // Superwaffe: ruhiger (langsameres, flacheres Atmen), mit der Steigerung breiter und zum Weiß hin heißer.
      const h = beam.heat;
      c = beam.own.copy(beam.color).lerp(recipes.WARM_WHITE, 0.3 * h);
      pulse = 1 + 0.07 * Math.sin(time * 9 + id * 1.7);
      wide = 1.15 + 0.7 * h;
      core = 1.9 + 0.35 * h;
      // Etwas deckender, damit ein blasser Sonnenstrahl auch auf hellem Boden (Rom, Mittelalter) zu sehen ist.
      solid = 0.55;
    } else if (beam.heat > 0.01) {
      // Aufheizender Strahl eines gewöhnlichen Turms (Bohrer): anfangs dünn, auf dem Ziel immer breiter und weißglühend.
      const h = beam.heat;
      c = beam.own.copy(beam.color).lerp(recipes.WARM_WHITE, 0.45 * h);
      wide = 0.75 + 0.85 * h;
      core = 2 + 0.6 * h;
      solid = 0.35 + 0.25 * h;
    }
    const w = 0.1 * pulse * (0.45 + 0.55 * s) * wide;
    glow.streak(beam.mx, beam.my, beam.mz, beam.tx, beam.ty, beam.tz, w * 3.4, c.r * 1.25, c.g * 1.25, c.b * 1.25, 0.3 * s, 0, SHAPE_SOFT);
    glow.streak(beam.mx, beam.my, beam.mz, beam.tx, beam.ty, beam.tz, w * 1.3, c.r * core, c.g * core, c.b * core, s, solid, SHAPE_CORE);
    // Glühen am Auftreffpunkt und an der Mündung.
    glow.blob(beam.tx, beam.ty, beam.tz, 0.55 * pulse * (0.85 + 0.35 * (wide - 0.95)), c.r * 1.7, c.g * 1.7, c.b * 1.7, 0.7 * s);
    glow.blob(beam.tx, beam.ty, beam.tz, 0.2, 2.2, 2.2, 2.2, 0.8 * s, 0.2, SHAPE_CORE);
    glow.blob(beam.mx, beam.my, beam.mz, 0.3 * (beam.sup ? 1.2 : 1), c.r * 1.7, c.g * 1.7, c.b * 1.7, 0.6 * s);
    if (on && Math.random() < beamDt * (beam.sup ? 10 : 16) * ps.density) recipes.beamSpark(fx, beam.tx, beam.ty, beam.tz, c);
  }

  // --- Flammenstöße ---
  /** @type {Map<number, FlameState>} */
  const flames = new Map();
  /** @type {FlameState[]} */
  const flamePool = [];

  /**
   * @param {FlameState} flame
   * @param {number} id Kennung des Turms
   */
  function updateFlame(flame, id) {
    const tower = sim ? sim.towerById(id) : null;
    flame.time -= beamDt;
    if (!tower || flame.time <= 0) {
      flames.delete(id);
      flamePool.push(flame);
      return;
    }
    entities.muzzleOf(tower, vA);
    vDir.set(flame.tx - vA.x, flame.ty - vA.y, flame.tz - vA.z);
    const reach = Math.max(0.3, vDir.length());
    vDir.multiplyScalar(1 / reach);
    recipes.flame(fx, beamDt * 120, vA.x, vA.y, vA.z, vDir.x, vDir.y, vDir.z, reach, flame.color, flame.flavor);
    // Weicher Leuchtkegel als Körper der Flamme.
    const c = flame.color;
    const k = Math.min(1, flame.time / 0.12);
    glow.streak(vA.x, vA.y, vA.z, vA.x + vDir.x * reach * 0.8, vA.y + vDir.y * reach * 0.8 + 0.05, vA.z + vDir.z * reach * 0.8, 0.5, c.r * 1.3, c.g * 1.3, c.b * 1.3, 0.3 * k, 0.5);
    glow.blob(vA.x, vA.y, vA.z, 0.3, 1.8, 1.4, 0.8, 0.5 * k, 0.4);
  }

  // --- Wackeln ---
  /** @param {number} amount 0..1; die Auslenkung wächst quadratisch */
  function addShake(amount) {
    if (shakeEnabled) trauma = Math.min(1, Math.max(trauma, amount));
  }

  // --- Helligkeit der Szene für die Pfützen ---
  /** @param {THREE.Object3D} object */
  function addLight(object) {
    if (!object.visible) return;
    const light = /** @type {THREE.Light} */ (object);
    if (/** @type {any} */ (object).isDirectionalLight) {
      const d = /** @type {THREE.DirectionalLight} */ (object);
      vA.copy(d.position).sub(d.target.position).normalize();
      const k = (Math.max(0, vA.y) * d.intensity) / Math.PI;
      lightSum.r += d.color.r * k;
      lightSum.g += d.color.g * k;
      lightSum.b += d.color.b * k;
    } else if (/** @type {any} */ (object).isHemisphereLight || /** @type {any} */ (object).isAmbientLight) {
      const k = light.intensity / Math.PI;
      lightSum.r += light.color.r * k;
      lightSum.g += light.color.g * k;
      lightSum.b += light.color.b * k;
    }
  }

  function sampleLight() {
    lightSum.setRGB(0, 0, 0);
    env.scene.traverse(addLight);
    if (lightSum.r + lightSum.g + lightSum.b < 0.01) lightSum.setRGB(1, 1, 1);
    sceneLight.value.setRGB(Math.min(1.25, lightSum.r), Math.min(1.25, lightSum.g), Math.min(1.25, lightSum.b));
    fx.light = Math.min(1, sceneLight.value.r * 0.3 + sceneLight.value.g * 0.6 + sceneLight.value.b * 0.1);
    fx.comp = Math.min(2.4, 1 / Math.max(fx.light, 0.3));
  }

  /**
   * Körpermitte eines Gegners per Kennung, sonst ein Punkt in üblicher Höhe über (x, z).
   * @param {number} id
   * @param {number} x @param {number} z
   * @param {boolean} flying
   * @param {THREE.Vector3} out
   */
  function targetPoint(id, x, z, flying, out) {
    const enemy = sim && id >= 0 ? sim.enemyById(id) : null;
    if (enemy) entities.enemyCenter(enemy, out);
    else out.set(x, flying ? FLY_HEIGHT + 0.3 : BODY_Y, z);
  }

  /**
   * Größe einer Figur relativ zum gewöhnlichen Gegner.
   * @param {Enemy} enemy
   */
  function sizeOf(enemy) {
    return Math.min(2, Math.max(0.7, ((enemy.def.radius ?? 0.25) / 0.25) ** 0.7 * (enemy.def.scale ?? 1) ** 0.5));
  }

  /**
   * @param {string} value
   * @param {number} x @param {number} y @param {number} z
   * @param {string} color @param {string} outline
   * @param {{ size?: number, life?: number, rise?: number }} [o]
   */
  function floatText(value, x, y, z, color, outline, o) {
    if (textEnabled) text.add(value, x, y, z, color, outline, o);
  }

  /**
   * Ein Turm hat gefeuert.
   * @param {Tower} tower
   * @param {number} targetId
   * @param {number} x @param {number} z
   * @param {boolean} flying
   */
  function onShot(tower, targetId, x, z, flying) {
    const shot = visualOf(tower.arch, tower.tier, tower.super, tower.gifts, tower.recipe);
    if (!shot) return;
    const sup = tower.super;
    const color = colorOf(shot.color);
    entities.muzzleOf(tower, vA);
    targetPoint(targetId, x, z, flying, vB);
    vDir.copy(vB).sub(vA);
    const dist = vDir.length();
    if (dist > 1e-4) vDir.multiplyScalar(1 / dist);
    else vDir.set(0, 0, 1);
    const continuous = tower.stats.attack === 'beam';
    switch (kindOf(shot, tower)) {
      case 'tracer':
        addStreak(vA, vB, 0.085, color, 2.3, 0.085, STREAK_TRACER, SHAPE_CORE, 0.35);
        break;
      case 'bolt':
        addBolt(vA, vB, color, sup ? 0.2 : 0.12, sup ? 1 : 0);
        break;
      case 'beam': {
        let beam = beams.get(tower.id);
        if (!beam) {
          beam = beamPool.pop() ?? { mx: 0, my: 0, mz: 0, tx: 0, ty: 0, tz: 0, strength: 0, hold: 0, fade: 0, continuous: false, sup: false, heat: 0, color, own: new THREE.Color() };
          beam.strength = 0;
          beam.heat = 0;
          beams.set(tower.id, beam);
        }
        beam.sup = sup;
        const cd = tower.stats.cooldown;
        beam.continuous = continuous;
        beam.hold = continuous ? Math.max(0.2, cd * 2.5) : Math.min(0.2, Math.max(0.08, cd * 0.1));
        beam.fade = continuous ? 0.12 : Math.min(0.35, Math.max(0.1, cd * 0.11));
        beam.color = color;
        beam.mx = vA.x;
        beam.my = vA.y;
        beam.mz = vA.z;
        beam.tx = vB.x;
        beam.ty = vB.y;
        beam.tz = vB.z;
        break;
      }
      case 'flame': {
        let flame = flames.get(tower.id);
        if (!flame) {
          flame = flamePool.pop() ?? { tx: 0, ty: 0, tz: 0, time: 0, color, flavor: 'fire' };
          flames.set(tower.id, flame);
        }
        flame.tx = vB.x;
        flame.ty = vB.y;
        flame.tz = vB.z;
        flame.time = Math.min(0.45, Math.max(0.15, tower.stats.cooldown * 0.5));
        flame.color = color;
        flame.flavor = shot.trail ?? 'fire';
        break;
      }
      case 'pulse':
        pulseRing(tower, shot, color);
        break;
      default:
    }
    if (shot.muzzle && shot.muzzle !== 'none' && !continuous) recipes.muzzle(fx, shot.muzzle, vA.x, vA.y, vA.z, vDir.x, vDir.y, vDir.z, color);
  }

  /**
   * Der nächste Turm mit Kopfgeld-Aura, in dessen (unverstärkter) Reichweite die Stelle liegt, oder null.
   * @param {number} x @param {number} z
   * @returns {Tower | null}
   */
  function bountyTower(x, z) {
    if (!sim) return null;
    /** @type {Tower | null} */
    let best = null;
    let bestD = Infinity;
    for (const t of sim.state.towers) {
      if (!((t.stats.auraBounty ?? 0) > 0)) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d <= t.stats.range + 1e-6 && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /**
   * Wie ein Schuss gezeichnet wird: Ein Dauerstrahl (`attack: 'beam'`) mit Leuchtspur-Bild (der Bohrer früher Zeitalter)
   * ist ein Strahl, der auf dem Ziel liegen bleibt und aufheizt, keine Folge einzelner Leuchtspuren.
   * @param {ShotVisual} shot
   * @param {Tower} tower
   * @returns {ShotVisual['kind']}
   */
  function kindOf(shot, tower) {
    return shot.kind === 'tracer' && tower.stats.attack === 'beam' ? 'beam' : shot.kind;
  }

  /**
   * Der Ring eines Pulses, der vom Turm bis zu seiner Reichweite über den Boden läuft. Frostpuls und Feuerring einer
   * Superwaffe sind langsamer und tragen auf ihrer Front Reifwölkchen bzw. kleine Flammen; der Taktring bleibt schlicht.
   * @param {Tower} tower
   * @param {ShotVisual} shot
   * @param {THREE.Color} color
   */
  function pulseRing(tower, shot, color) {
    const range = tower.stats.range * (1 + tower.buffRange);
    const x = tower.x;
    const z = tower.z;
    if (tower.super && shot.impact === 'frost') {
      // Frostpuls: ein kühler, klarer Rand, dahinter eine zarte Reiffläche, die stehen bleibt und langsam vergeht.
      decals.ring(x, z, 0.35, range, FROST_LIFE, color, 0.5, { inner: 0.94, soft: 0.035, gain: 1.15, solid: 0.6, hold: 0.45 });
      // Nachts leuchtet die Fläche additiv stärker hervor: mit dem Licht der Szene dämpfen.
      decals.ring(x, z, 0.3, range * 0.97, FROST_LIFE * 1.25, color, 0.16 * (0.4 + 0.6 * fx.light), { inner: 0.2, soft: 0.5, solid: 0.7, hold: 0.25 });
      recipes.pulseFront(fx, 'frost', x, z, range, FROST_LIFE, color, Math.min(14, range * 3.5));
    } else if (shot.impact === 'dust' && (tower.stats.push ?? 0) > 0) {
      // Stampfwelle (Stampfer): ein kurzer, erdfarbener Stoß über den Boden, Staub am Fuß und auf der Front, Splitter fliegen.
      const k = tower.super ? 1.25 : 1;
      decals.ring(x, z, 0.3, range, STOMP_LIFE * k, color, 0.6, { inner: 0.86, soft: 0.07, gain: 1.05, solid: 0.65, hold: 0.25 });
      decals.ring(x, z, 0.25, range * 0.8, STOMP_LIFE * k * 1.3, color, 0.14 * (0.4 + 0.6 * fx.light), { inner: 0.2, soft: 0.5, solid: 0.6, hold: 0.15 });
      recipes.impact(fx, 'dust', x, 0, z, 1.1 * k, color, 1);
      recipes.pulseFront(fx, 'dust', x, z, range, STOMP_LIFE * k, color, Math.min(14, Math.round(range * 5 * k)));
    } else if (shot.impact === 'frost') {
      // Kältewelle eines gewöhnlichen Turms (etwa des Frostturms): wie der Frostpuls, aber leiser und mit weniger Reif, denn
      // sie kommt alle paar Sekunden und von mehreren Türmen zugleich.
      decals.ring(x, z, 0.3, range, FROST_LIFE * 0.8, color, 0.42, { inner: 0.93, soft: 0.04, gain: 1.1, solid: 0.6, hold: 0.4 });
      decals.ring(x, z, 0.25, range * 0.95, FROST_LIFE, color, 0.1 * (0.4 + 0.6 * fx.light), { inner: 0.25, soft: 0.5, solid: 0.6, hold: 0.2 });
      recipes.pulseFront(fx, 'frost', x, z, range, FROST_LIFE * 0.8, color, Math.min(8, Math.round(range * 2.5)));
    } else if (tower.super && shot.trail === 'fire') {
      // Feuerring: ein warm glühender Rand mit kleinen Flammen darauf (ohne Füllung: sie färbte nachts die ganze Fläche ein).
      const fire = fireOf(color);
      decals.ring(x, z, 0.35, range, FIRE_RING_LIFE, fire, 0.5 * (0.65 + 0.35 * fx.light), { inner: 0.9, soft: 0.06, gain: 1.35, solid: 0.45, hold: 0.4 });
      recipes.pulseFront(fx, 'fire', x, z, range, FIRE_RING_LIFE, fire, Math.min(16, range * 4.5));
    } else if (tower.super && (shot.sound === 'steam' || (tower.stats.dot > 0 && tower.stats.slow === 0))) {
      // Dampfpuls (Dampfkessel; ein Puls, der verbrüht statt bremst): ein breiter, weicher Schleier statt eines scharfen Rands, auf der Front steigen Dampfwölkchen.
      const k = 0.4 + 0.6 * fx.light;
      decals.ring(x, z, 0.35, range, STEAM_LIFE, color, 0.32 * k, { inner: 0.78, soft: 0.16, gain: 1.05, solid: 0.5, hold: 0.35 });
      decals.ring(x, z, 0.3, range * 0.9, STEAM_LIFE * 1.2, color, 0.1 * k, { inner: 0.15, soft: 0.6, solid: 0.6, hold: 0.2 });
      recipes.pulseFront(fx, 'steam', x, z, range, STEAM_LIFE, color, Math.min(18, range * 4));
    } else {
      // Gewöhnlicher Puls; als Superwaffe (Taktring) etwas heller und mit einem zweiten, späteren Ring.
      const k = tower.super ? 1.15 : 1;
      // Schnelle Pulse (die Salve des Schnellschützen: alle 0,4 s) wären mit vollem Ring ein Flackern, nachts ein grelles:
      // je kürzer die Pause, desto zarter und kürzer der Ring, und ohne zweiten, späten Ring.
      const cd = tower.stats.cooldown / (1 + tower.buffRate);
      const quiet = Math.min(1, Math.max(0.3, cd / 1.5));
      const dim = quiet < 1 ? quiet * (0.55 + 0.45 * fx.light) : 1;
      decals.ring(x, z, 0.3, range, PULSE_LIFE * k * (quiet < 1 ? 0.7 : 1), color, 0.55 * dim, { inner: 0.93, soft: 0.04, gain: 1.2 * k, solid: 0.6, hold: 0.4 });
      decals.ring(x, z, 0.2, range * 0.96, PULSE_LIFE * k, color, 0.13 * dim, { inner: 0.55, soft: 0.3, solid: 0.5, hold: 0.3 });
      if (tower.super && quiet === 1) decals.ring(x, z, 0.3, range * 0.7, PULSE_LIFE, color, 0.35, { inner: 0.9, soft: 0.05, gain: 1.2, solid: 0.6, hold: 0.35, delay: 0.18 });
    }
  }

  // Super- und Megawaffen ohne eigenen Angriff (Taktgeber-Kern) schlagen ihren Takt sichtbar: Die Simulation meldet
  // keine Schüsse, also läuft hier je Turm ein ruhiger Taktring mit fester Periode.
  /** @type {Map<number, number>} */
  const beats = new Map();
  function updateBeats() {
    if (!sim) return;
    const towers = sim.state.towers;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      if (!tower.super || tower.stats.attack !== 'none') continue;
      const shot = visualOf(tower.arch, tower.tier, true, tower.gifts, tower.recipe);
      if (!shot || shot.kind !== 'pulse') continue;
      const n = Math.floor(time / BEAT_PERIOD + ((tower.id * 0.618) % 1));
      const last = beats.get(tower.id);
      if (last !== n) {
        beats.set(tower.id, n);
        if (last !== undefined) pulseRing(tower, shot, colorOf(shot.color));
      }
    }
  }

  /**
   * Ein Treffer ist eingeschlagen.
   * @param {ShotVisual} shot
   * @param {THREE.Color} role Rollenfarbe
   * @param {boolean} continuous Dauerstrahl
   * @param {number} x @param {number} z
   * @param {boolean} flying
   * @param {number} splash
   * @param {number} towerId Urheber, falls bekannt (-1 sonst)
   * @param {boolean} [heavy] seltener, schwerer Treffer
   */
  function onHit(shot, role, continuous, x, z, flying, splash, towerId, heavy = false) {
    // Der Ring eines 'pulse' ist schon beim Schuss gezeichnet worden.
    if (shot.kind === 'pulse') return;
    let area = splash > 0;
    // Ein Dauerstrahl mit Fläche (das Brennglas) meldet fünf Treffer je Sekunde: Der Ring erscheint dann nur alle
    // AREA_BEAM_GAP Sekunden und leiser, sonst flackert der Boden.
    let soft = 1;
    if (area && continuous) {
      const last = areaBeamRing.get(towerId);
      if (last !== undefined && time - last < AREA_BEAM_GAP && time >= last) area = false;
      else areaBeamRing.set(towerId, time);
      soft = 0.55;
    }
    const y = flying ? FLY_HEIGHT + 0.3 : area ? 0.02 : BODY_Y;
    const scale = (area ? Math.min(1.9, Math.max(0.75, 0.5 + splash * 0.65)) : 0.6) * (heavy ? 1.7 : 1);
    ps.floor = FLOOR_Y;
    const color = colorOf(shot.color);
    recipes.impact(fx, shot.impact, x, y, z, scale, shot.impact === 'fire' ? fireOf(color) : color, continuous ? 0.25 : 1);
    if (area) {
      // Den wahren Radius des Flächenschadens kurz zeigen.
      tmpColor.copy(role).lerp(recipes.WHITE, 0.35);
      decals.ring(x, z, splash * 0.62, splash, soft < 1 ? 0.8 : 0.5, tmpColor, soft * 0.6 * (0.5 + 0.5 * fx.light), { y: flying ? FLY_HEIGHT : 0.03, inner: 0.93, soft: 0.035, fill: 0.2, hold: 0.45, solid: 0.9 });
      if (heavy) {
        // Ein zweiter, weiterer Staubring und ein kurzes, leichtes Beben.
        decals.ring(x, z, splash * 0.8, splash * 2.2, 0.9, tmpColor.copy(role).lerp(recipes.WARM_WHITE, 0.6), 0.45 * (0.5 + 0.5 * fx.light), { y: 0.03, inner: 0.9, soft: 0.06, fill: 0.12, hold: 0.3, solid: 0.7 });
        addShake(0.3);
      }
      if (shot.impact === 'explosion' && splash >= 1) {
        const d = Math.hypot(x - world.base.x, z - world.base.z);
        if (d < 3.5) addShake(0.5);
      }
    }
  }

  /**
   * Die Zeitglocke (und jede unbekannte Fähigkeit): Ein goldener Ring läuft von der Flamme über die ganze Insel.
   */
  function onAbility() {
    const bx = world.base.x;
    const bz = world.base.z;
    const reach = Math.hypot(bx, bz) + world.radius + 1.5;
    const life = 1.15;
    const gold = recipes.GOLD;
    decals.ring(bx, bz, 0.5, reach, life, gold, 0.9, { y: 0.07, inner: 0.972, soft: 0.012, gain: 1.45, solid: 0.55, hold: 0.55 });
    decals.ring(bx, bz, 0.3, reach * 0.985, life, gold, 0.17, { y: 0.06, inner: 0.8, soft: 0.18, gain: 1.1, solid: 0.4, hold: 0.45 });
    decals.ring(bx, bz, 0.3, reach * 0.6, life * 0.9, gold, 0.3, { y: 0.065, inner: 0.955, soft: 0.025, gain: 1.25, solid: 0.5, hold: 0.4, delay: 0.22 });
    // Schimmer auf jedem Gegner in dem Moment, in dem der Ring ihn erreicht (der Ring wächst mit 1 - (1 - t)^3).
    if (sim) {
      const list = sim.state.enemies;
      for (let i = 0; i < list.length; i++) {
        const enemy = list[i];
        entities.enemyCenter(enemy, vA);
        const d = Math.min(0.999, Math.max(0, (Math.hypot(vA.x - bx, vA.z - bz) - 0.5) / (reach - 0.5)));
        fx.later(life * (1 - Math.cbrt(1 - d)), recipes.LATER_SHIMMER, vA.x, vA.y, vA.z, sizeOf(enemy), gold);
      }
    }
    // Ein paar treibende Uhrzeiger über der Insel.
    handCount = 0;
    for (let i = 0; i < 7; i++) {
      const k = handCount++ * HAND_FLOATS;
      const a = (i / 7) * 6.283 + Math.random();
      const r = 1.5 + Math.random() * Math.max(2, world.radius * 0.5);
      hands[k] = bx * 0.35 + Math.cos(a) * r;
      hands[k + 1] = 1.1 + Math.random() * 1.2;
      hands[k + 2] = bz * 0.35 + Math.sin(a) * r * 0.7;
      hands[k + 3] = (Math.random() - 0.5) * 0.3;
      hands[k + 4] = 0.25 + Math.random() * 0.2;
      hands[k + 5] = Math.random() * 6.283;
      hands[k + 6] = -(5 + Math.random() * 4);
      hands[k + 7] = 0.26 + Math.random() * 0.1;
      hands[k + 8] = -(0.1 + i * 0.07);
      hands[k + 9] = 1.5 + Math.random() * 0.4;
    }
    recipes.risingMotes(fx, bx, 0.8, bz, 5, 1.2);
    addShake(0.6);
  }

  // 'hit' und 'chain' nennen nur Rolle und Technikstand, nicht den Turm. Wer sie ausgelöst hat, folgt aus der Reihenfolge
  // der Ereignisse: Ein sofort treffender Schuss (hitscan, beam, pulse) meldet 'shot', dann seine 'chain', ein 'zone' und
  // zuletzt 'hit'; ein Geschoss meldet beim Einschlag 'chain', 'zone' (mit der Kennung des Turms) und 'hit'.
  /** @type {Tower | null} */
  let source = null;
  /** Zuschlag einer Kopfgeld-Aura zum gerade behandelten Abschuss (siehe handleEvents), sonst 0. */
  let bountyExtra = 0;
  /** Wann ein Dauerstrahl mit Fläche zuletzt seinen Ring gezeigt hat, je Turm. @type {Map<number, number>} */
  const areaBeamRing = new Map();

  /**
   * Ob ein 'hit' oder 'chain' dieser Rolle und dieses Technikstands vom zuletzt gemeldeten Turm stammt und der eine
   * Super- oder Megawaffe ist.
   * @param {Tower['arch']} arch
   * @param {number} tier
   */
  function fromSuper(arch, tier) {
    return source !== null && source.super && source.arch === arch && source.tier === tier;
  }

  /**
   * Der Turm einer Super- oder Megawaffe, deren gerade gesehenes Geschoss bei (x, z) eingeschlagen ist (der 'hit' eines
   * Geschosses nennt keinen Turm), oder null. So zeigen auch Würfe einer Superwaffe ihren eigenen Einschlag.
   * @param {Tower['arch']} arch @param {number} tier @param {number} x @param {number} z
   * @returns {Tower | null}
   */
  function landedSuper(arch, tier, x, z) {
    if (!sim) return null;
    /** @type {ShotState | null} */
    let best = null;
    let bestD = 0.8;
    shotStates.forEach((st) => {
      if (!st.sup || st.landed || st.arch !== arch || st.tier !== tier) return;
      const d = Math.hypot(st.tx - x, st.tz - z);
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    });
    if (!best) return null;
    const st = /** @type {ShotState} */ (best);
    st.landed = true;
    return sim.towerById(st.towerId);
  }

  /** @param {SimEvent} e */
  function handleEvent(e) {
    switch (e.type) {
      case 'shot':
        onShot(e.tower, e.targetId, e.x, e.z, e.flying);
        source = e.tower.stats.attack === 'projectile' ? null : e.tower;
        break;
      case 'zone': {
        const tower = sim ? sim.towerById(e.zone.towerId) : null;
        source = tower && tower.arch === e.zone.arch ? tower : null;
        break;
      }
      case 'hit': {
        if (source === null) source = landedSuper(e.arch, e.tier, e.x, e.z);
        const sup = fromSuper(e.arch, e.tier);
        const shot = visualOf(e.arch, e.tier, sup, sup && source ? source.gifts : undefined, source ? source.recipe : undefined);
        const continuous = source !== null && source.arch === e.arch ? source.stats.attack === 'beam' : e.arch.stats.attack === 'beam';
        // Seltene, schwere Treffer einer Superwaffe (das Belagerungsgeschütz) schlagen größer ein.
        const heavy = sup && source !== null && source.stats.cooldown >= HEAVY_COOLDOWN;
        if (shot) onHit(shot, colorOf(e.arch.color), continuous, e.x, e.z, e.flying, e.splash, source ? source.id : -1, heavy);
        source = null;
        break;
      }
      case 'chain': {
        const sup = fromSuper(e.arch, e.tier);
        const shot = visualOf(e.arch, e.tier, sup, sup && source ? source.gifts : undefined, source ? source.recipe : undefined);
        if (!shot) break;
        const y = e.flying ? FLY_HEIGHT + 0.3 : BODY_Y;
        vA.set(e.fromX, y, e.fromZ);
        vB.set(e.toX, y, e.toZ);
        const color = colorOf(shot.color);
        if (shot.kind === 'tracer') addStreak(vA, vB, 0.07, color, 2.2, 0.085, STREAK_TRACER, SHAPE_CORE, 0.35);
        else addBolt(vA, vB, color, sup ? 0.2 : 0.12, sup ? 1 : 0);
        if (sup && shot.impact !== 'none') recipes.impact(fx, shot.impact, vB.x, vB.y, vB.z, 0.45, color, 0.35);
        break;
      }
      case 'damage': {
        const enemy = e.enemy;
        // Nur spürbare Treffer zeigen Splitter; Brand und Dauerstrahl ticken sonst in jedem Zeitschritt.
        if (e.amount < enemy.maxHp * 0.05 && Math.random() > 0.04) break;
        entities.enemyCenter(enemy, vA);
        recipes.damage(fx, vA.x, vA.y, vA.z, colorOf(enemy.def.color), e.shield, FLOOR_Y, sizeOf(enemy));
        break;
      }
      case 'kill': {
        const enemy = e.enemy;
        const boss = enemy.def.boss;
        const size = sizeOf(enemy);
        entities.enemyCenter(enemy, vA);
        recipes.kill(fx, vA.x, vA.y, vA.z, size, colorOf(enemy.def.color), boss, FLOOR_Y);
        if (!boss && e.bounty > 0) recipes.coin(fx, vA.x, vA.y, vA.z, FLOOR_Y);
        const extra = Math.min(bountyExtra, e.bounty);
        if (e.bounty - extra > 0) floatText(`+${e.bounty - extra}`, vA.x, vA.y + 0.3 * size, vA.z, TEXT_GOLD, TEXT_GOLD_EDGE, boss ? { size: 0.8, life: 1.5, rise: 1.2 } : undefined);
        if (extra > 0) {
          // Zuschlag des Zahlmeisters: eigene, hellere Zahl schräg darüber und eine zweite Münze.
          floatText(`+${extra}`, vA.x + 0.26, vA.y + 0.62 * size + 0.1, vA.z, TEXT_BONUS, TEXT_BONUS_EDGE, { size: boss ? 0.7 : 0.5, life: boss ? 1.6 : 1.25, rise: 1.0 });
          recipes.coin(fx, vA.x + 0.12, vA.y + 0.1, vA.z, FLOOR_Y);
          // Und der Zahlmeister, der zahlt (der nächste Turm mit Kopfgeld-Aura in Reichweite), funkelt kurz golden.
          const payer = bountyTower(enemy.x, enemy.z);
          if (payer) recipes.risingMotes(fx, payer.x, 0.5, payer.z, 1, 0.8);
        }
        if (boss) addShake(0.92);
        break;
      }
      case 'leak': {
        const bx = world.base.x;
        const bz = world.base.z;
        recipes.leak(fx, bx, 0.5, bz);
        floatText(`-${e.enemy.def.lives}`, bx, 1.5, bz, TEXT_RED, TEXT_RED_EDGE, { size: 0.62, life: 1.1 });
        break;
      }
      case 'phase': {
        const enemy = e.enemy;
        const size = sizeOf(enemy);
        entities.enemyCenter(enemy, vA);
        recipes.phase(fx, vA.x, vA.y, vA.z, size, enemyBaseY(enemy));
        floatText('!', vA.x, vA.y + 0.55 * size, vA.z, TEXT_ALERT, TEXT_RED_EDGE, { size: 0.95, life: 1.2, rise: 0.45 });
        break;
      }
      case 'spawn':
        recipes.spawn(fx, e.enemy.x, enemyBaseY(e.enemy), e.enemy.z, sizeOf(e.enemy));
        break;
      case 'build':
        recipes.build(fx, e.tower.x, e.tower.z);
        break;
      case 'upgrade':
        recipes.upgrade(fx, e.tower.x, e.tower.z, colorOf(e.tower.arch.color));
        break;
      case 'modernize': {
        // Kurze Lichtsäule mit aufsteigenden Körnchen.
        const x = e.tower.x;
        const z = e.tower.z;
        vA.set(x, 0, z);
        vB.set(x, 3.4, z);
        addStreak(vA, vB, 1.0, recipes.GOLD, 1.25, 0.8, STREAK_COLUMN, SHAPE_SOFT, 0.1, 0.5);
        addStreak(vA, vB, 0.4, recipes.WARM_WHITE, 1.7, 0.8, STREAK_COLUMN, SHAPE_SOFT, 0.1, 0.7);
        recipes.risingMotes(fx, x, 0.2, z, 5, 1);
        decals.ring(x, z, 0.3, 0.95, 0.6, recipes.GOLD, 0.8, { inner: 0.82, soft: 0.1, gain: 1.5, solid: 0.5 });
        break;
      }
      case 'fuse':
        onFuse(e.tower, e.parts, e.mega === true);
        break;
      case 'sell':
        recipes.sell(fx, e.tower.x, e.tower.z);
        if (e.refund > 0) floatText(`+${e.refund}`, e.tower.x, 1.0, e.tower.z, TEXT_GOLD, TEXT_GOLD_EDGE);
        break;
      case 'ability':
        onAbility();
        break;
      case 'age':
        recipes.risingMotes(fx, world.base.x, 0.6, world.base.z, 9, 1.4);
        break;
      case 'push': {
        // Rückstoß: Staub an den Füßen dort, wo der Gegner getroffen wurde, und ein kurzer Staubring, wo er landet.
        const enemy = e.enemy;
        const floor = enemyBaseY(enemy);
        if (enemy.def.flying) break;
        recipes.impact(fx, 'dust', e.x, floor, e.z, 0.55 * sizeOf(enemy), DUST_PUSH, 0.6);
        decals.ring(enemy.x, enemy.z, 0.1, 0.32 * sizeOf(enemy) + 0.12, 0.35, DUST_PUSH, 0.5, { y: Math.max(0.03, floor), inner: 0.7, soft: 0.2, solid: 0.5 });
        break;
      }
      case 'heal':
        if (Math.random() < 0.12) {
          entities.enemyCenter(e.enemy, vA);
          recipes.heal(fx, vA.x, vA.y, vA.z);
        }
        break;
      default:
    }
  }

  /** @param {number} fdt */
  function updateZones(fdt) {
    zones.begin();
    if (sim) {
      const list = sim.state.zones;
      for (let i = 0; i < list.length; i++) {
        const zone = list[i];
        const tower = sim.towerById(zone.towerId);
        const shot = visualOf(zone.arch, zone.tier, Boolean(tower && tower.super && tower.arch === zone.arch), tower ? tower.gifts : undefined, tower ? tower.recipe : undefined);
        if (!shot) continue;
        const burning = shot.impact === 'fire';
        // Schnell ausbreiten (mit leichtem Überschwingen), in der letzten halben Sekunde wegschrumpfen.
        const age = zone.duration - zone.time;
        const a = Math.min(1, age / 0.28);
        const appear = 1 + 2.2 * (a - 1) ** 3 + 1.2 * (a - 1) ** 2;
        const v = Math.min(1, Math.max(0, zone.time / 0.5));
        const vanish = v * v * (3 - 2 * v);
        const radius = zone.radius * appear * (0.25 + 0.75 * vanish);
        const seed = (zone.id * 0.618) % 1;
        if (burning) {
          // Brandfeld: Glutfarbe statt Geschossfarbe, dazu dann und wann eine kleine Flamme, die ruhig aufsteigt.
          const fire = fireOf(colorOf(shot.color));
          // Bremst das Feld auch (Teerfeuer, oder ein Brandfeld mit Kleber), liegt brennender Teer statt verkohltem Boden.
          const tar = tower !== null && tower.stats.slow > 0 && tower.arch === zone.arch;
          zones.add(zone.x, -PATH_DEPTH + 0.014, zone.z, radius, fire, colorOf(zone.arch.color), seed + (tar ? 4 : 2), Math.min(1, v * 2.5));
          if (zone.time > 0.4 && Math.random() < fdt * radius * 5 * ps.density) {
            const a = Math.random() * 6.283;
            const r = Math.sqrt(Math.random()) * radius * 0.8;
            fx.later(0, recipes.LATER_FLAME, zone.x + Math.cos(a) * r, -PATH_DEPTH + 0.06, zone.z + Math.sin(a) * r, 0.75, fire);
          }
        } else {
          zones.add(zone.x, -PATH_DEPTH + 0.014, zone.z, radius, colorOf(shot.color), colorOf(zone.arch.color), seed, Math.min(1, v * 2.5));
        }
      }
    }
    zones.end(time);
  }

  function clear() {
    ps.clear();
    decals.clear();
    text.clear();
    laterCount = 0;
    streakCount = 0;
    boltCount = 0;
    handCount = 0;
    fuseLightCount = 0;
    fuseArrivalCount = 0;
    beats.clear();
    areaBeamRing.clear();
    source = null;
    beams.forEach((beam) => beamPool.push(beam));
    beams.clear();
    flames.forEach((flame) => flamePool.push(flame));
    flames.clear();
    shotStates.forEach((state) => shotPool.push(state));
    shotStates.clear();
    trauma = 0;
    shake.set(0, 0, 0);
  }

  return {
    group,
    shake,
    debug,

    bind(newSim) {
      sim = newSim;
      clear();
      // Ringe auf dem Boden enden weich am Ufer: Die Insel reicht rund um das Spielfeld etwa zwei Felder weiter.
      if (sim) decals.clip.set(sim.map.width / 2 + 1.0, sim.map.height / 2 + 1.0, 1.0);
      else decals.clip.set(1e4, 1e4, 1);
      speed = 1;
      idle = 0;
    },

    handleEvents(events) {
      if (!sim) return;
      source = null;
      for (let i = 0; i < events.length; i++) {
        // Der Zuschlag einer Kopfgeld-Aura steht im Goldereignis direkt nach dem Abschuss: vorher nachsehen, damit die Zahl
        // über dem Gegner Grundbetrag und Zuschlag getrennt zeigen kann.
        const e = events[i];
        const next = events[i + 1];
        bountyExtra = e.type === 'kill' && next && next.type === 'gold' && next.reason === 'bounty' && next.extra ? next.extra : 0;
        handleEvent(e);
      }
      bountyExtra = 0;
      source = null;
    },

    update(dt, simDt, alpha) {
      frame++;
      dt = Math.min(dt, 0.1);
      // Zeit der Effekte: Spielzeit, geglättet (Zeitschritte kommen ungleichmäßig) und auf doppeltes Tempo begrenzt.
      const finished = !sim || sim.state.phase === 'won' || sim.state.phase === 'lost';
      if (finished) {
        speed = 1;
      } else if (simDt > 0) {
        idle = 0;
        speed += (simDt / Math.max(dt, 1e-4) - speed) * Math.min(1, dt * 14);
      } else {
        idle += dt;
        if (idle > 0.12) speed = 0;
        else speed += (0 - speed) * Math.min(1, dt * 14);
      }
      const fdt = dt * Math.min(speed, 2);
      time += fdt;

      // Dichte der Teilchen: Grafikstufe, Spieltempo und Andrang.
      const load = ps.count / ps.budget;
      ps.density = DENSITY[quality] * (speed > 1.5 ? 0.55 : 1) * (load > 0.5 ? Math.max(0.3, 1 - (load - 0.5) * 1.4) : 1);

      lightTimer -= dt;
      if (lightTimer <= 0) {
        lightTimer = 0.4;
        sampleLight();
      }

      glow.begin();
      updateBeats();
      updateDelayed(fdt);
      updateProjectiles(fdt, alpha);
      beamDt = fdt;
      beams.forEach(updateBeam);
      flames.forEach(updateFlame);
      updateStreaks(fdt);
      updateBolts(fdt);
      updateHands(fdt);
      updateFusion(dt);
      ps.update(fdt);
      glow.end();
      decals.update(fdt);
      text.update(fdt);
      updateZones(fdt);

      // Wackeln klingt in echter Zeit ab.
      if (trauma > 0) {
        trauma = Math.max(0, trauma - dt * 2.6);
        shakeTime += dt;
        const a = SHAKE_MAX * trauma * trauma;
        shake.set(Math.sin(shakeTime * 43) * a, Math.sin(shakeTime * 57 + 1.3) * a * 0.7, Math.cos(shakeTime * 37 + 0.6) * a * 0.6);
      } else {
        shake.set(0, 0, 0);
      }

      debug.particles = ps.count;
      debug.budget = ps.budget;
      debug.glows = glow.count;
      debug.rings = decals.live;
      debug.texts = text.live;
    },

    applySettings(/** @type {Settings} */ settings) {
      shakeEnabled = settings.shake;
      textEnabled = settings.floatingText;
      if (!shakeEnabled) trauma = 0;
      if (!textEnabled) text.clear();
    },

    setQuality(q) {
      quality = q;
      ps.budget = BUDGET[q];
    },

    dispose() {
      clear();
      env.scene.remove(group);
      shotModels.forEach((entry) => {
        group.remove(entry.inst.group);
        entry.inst.dispose();
      });
      shotModels.clear();
      ps.dispose();
      glow.dispose();
      decals.dispose();
      zones.dispose();
      text.dispose();
    },
  };
}
