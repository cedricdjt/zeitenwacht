// @ts-check
// Figurenschicht: zeichnet alle Türme und Gegner der laufenden Partie samt allem, was an ihnen hängt
// (Lebensbalken, Schildblasen, Stufenpunkte, Markierungen, Bauvorschau, Reichweiten- und Zielkreise).
// Sie liest den Zustand der Simulation in jedem Bild neu und verändert ihn nie.
//
// Aufbau: je Modell-Kennung ein InstancedModel (bei Bedarf angelegt, bleibt bis zum Ende bestehen); je Gegner und Turm
// ein kleines Ansichtsobjekt mit dem, was die Simulation nicht kennt (geglättete Blickrichtung, Laufphase, Abklingzeiten).
// In update() wird nichts alloziert: Ansichten, Vektoren und Farben werden wiederverwendet.

import * as THREE from 'three';
import { getModel } from '../content/models.js';
import { tileX, tileZ } from '../sim/path.js';
import { towerStats } from '../sim/rules.js';
import { HealthBars } from './entities/bars.js';
import { DECAL, DECAL_Y, GroundDecals } from './entities/decals.js';
import { crownModel, hourglassModel, megaCrownModel, orbModel, pipModel, placeWeaponMarker, weaponMarkerModel } from './entities/markers.js';
import { GlowShells, SHELL } from './entities/shells.js';
import { accentHex, weaponVariant } from './entities/variants.js';
import { InstancedModel, createModelObject, makeAnimCtx } from './instances.js';
import { FLY_HEIGHT, PATH_DEPTH, enemyBaseY } from './layout.js';

/** @import { Quality } from '../types/app' */
/** @import { TowerArchetypeDef } from '../types/content' */
/** @import { AnimCtx, ModelSpec } from '../types/model' */
/** @import { EntityLayer, RenderEnv } from '../types/render' */
/** @import { Enemy, Sim, SimEvent, Tower } from '../types/sim' */

const TAU = Math.PI * 2;

// --- Stellschrauben -------------------------------------------------------------------------------------------------
/** Sekunden, in denen sich ein Stampfer vor dem Stoß anhebt (simulierte Zeit). */
const STOMP_WINDUP = 0.35;
/** Sekunden, in denen ein zurückgeworfener Gegner von der alten Lage zur neuen gleitet (simulierte Zeit). */
const PUSH_TIME = 0.22;
/** Sekunden, in denen ein Gegner beim Erscheinen aufwächst. */
const SPAWN_TIME = 0.3;
/** Sekunden, in denen das Zusammenzucken nach einem Treffer abklingt (simulierte Zeit). */
const HURT_TIME = 0.25;
/** Ein Schadensereignis gilt als direkter Treffer, wenn der letzte Treffer höchstens so viele Sekunden zurückliegt. */
const DIRECT_HIT_WINDOW = 0.04;
/** Sekunden, die ein besiegter Gegner noch zusammensinkt, statt in einem Bild zu verschwinden. */
const DEATH_TIME = 0.12;
/** Sekunden, über die `fire` nach einem Schuss abklingt (simulierte Zeit). */
const FIRE_TIME = 0.3;
/** Drehgeschwindigkeit der Türme in Radiant pro Sekunde (schnell feuernde drehen schneller, siehe turnRate()). */
const TURN_RATE = 10;
/** Dauer der Turm-Animationen in Sekunden (echte Zeit). */
const BUILD_TIME = 0.55;
const UPGRADE_TIME = 0.5;
const MODERNIZE_TIME = 0.62;
const SELL_TIME = 0.28;
/** Verschmelzung: So lange lösen sich die Zutaten auf (echte Sekunden) ... */
const ABSORB_TIME = 0.5;
/** ... und nach so vielen Sekunden (wenn die Lichter der Effektschicht ankommen) schwillt der Kern an. Muss zu FUSE_FLIGHT in effects.js passen. */
const FUSE_DELAY = 0.6;
const FUSE_TIME = FUSE_DELAY + 0.9;
/** Größe einer Superwaffe gegenüber dem gewöhnlichen Turm. */
const SUPER_SCALE = 1.28;
/** Größe einer Megawaffe gegenüber dem gewöhnlichen Turm. */
const MEGA_SCALE = 1.5;
/** Höhenversatz der Schattenflecken unter Läufern: knapp über dem abgesenkten Weg statt über der Grasnarbe. */
const BLOB_LIFT = -PATH_DEPTH - DECAL_Y + 0.02;
/** Angenommene Höhe der Mündung über dem Boden, für die Neigung zu Fliegern. */
const MUZZLE_HEIGHT = 0.8;

/**
 * Was die Schicht sich je Gegner merkt.
 * @typedef {object} EnemyView
 * @property {number} id
 * @property {number} seed Zufallswert 0..1, fest je Gegner
 * @property {InstancedModel} inst
 * @property {boolean} fresh true bis zum ersten Zeichnen
 * @property {number} stamp Nummer des Bildes, in dem die Ansicht zuletzt gezeichnet wurde
 * @property {number} x Zuletzt gezeichnete Position (Standfläche)
 * @property {number} y
 * @property {number} z
 * @property {number} centerY Höhe der Körpermitte
 * @property {number} yaw Geglättete Blickrichtung
 * @property {number} bank Schräglage der Flieger
 * @property {number} walk Laufphase
 * @property {number} hurt 1 nach einem Treffer, klingt ab
 * @property {number} shieldHit 1 nach einem Treffer auf den Schild, klingt ab
 * @property {number} heal 1 nach einer Heilung, klingt ab
 * @property {number} hpLag Nachlaufender Lebensstand für die helle Spur im Balken
 * @property {number} scale Zuletzt gezeichnete Größe
 * @property {number} hp Zuletzt gezeichneter Lebensstand 0..1
 * @property {number} t Zuletzt gezeichnete Lebenszeit
 * @property {number} mark Einblenden des Zeichens (Verwundbarkeit) 0..1
 * @property {number} push 1 nach einem Rückstoß, klingt in PUSH_TIME ab
 * @property {number} pushX Versatz der Figur zur alten Lage beim Rückstoß (x), gleitet mit `push` auf 0
 * @property {number} pushZ
 */

/**
 * Was die Schicht sich je Turm merkt.
 * @typedef {object} TowerView
 * @property {number} id
 * @property {number} seed
 * @property {number} stamp
 * @property {boolean} drawn Ob der Turm schon einmal gezeichnet wurde (dann gilt `muzzle`)
 * @property {number} yaw Geglättete Zielrichtung
 * @property {number} pitch Geglättete Neigung
 * @property {number} active Geglättet 0..1
 * @property {number} t Simulierte Sekunden seit dem Erscheinen
 * @property {number} mark Eingeblendete Größe der Sanduhr 0..1
 * @property {number} superK Anteil 0..1 (mit Überschwingen), zu dem der Turm als Superwaffe gewachsen ist
 * @property {number} megaK Anteil 0..1 (mit Überschwingen), zu dem die Superwaffe zur Megawaffe gewachsen ist
 * @property {number} fuse Echte Sekunden seit der Verschmelzung oder -1
 * @property {number} kick 1 im Moment eines Schusses, klingt ab; beschleunigt das Nachführen
 * @property {'none' | 'build' | 'upgrade' | 'modernize'} anim Laufende Animation
 * @property {number} animT Sekunden seit Beginn der Animation
 * @property {string} oldModel Modell vor der Modernisierung
 * @property {THREE.Vector3} muzzle Mündung in der zuletzt gezeichneten Pose
 * @property {string} modelId Zuletzt gezeichnetes Modell
 * @property {number} level Zuletzt gezeichnete Stufe
 * @property {number} x
 * @property {number} z
 */

/**
 * Ein Nachbild: ein verkaufter Turm, der zusammenfaltet, oder ein besiegter Gegner, der zusammensinkt.
 * @typedef {object} Ghost
 * @property {InstancedModel} inst
 * @property {number} id Kennung des Gegners (für enemyCenter) oder -1
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} centerY
 * @property {number} yaw Drehung der Figur (Gegner) bzw. Zielrichtung (Turm)
 * @property {number} pitch
 * @property {number} scale
 * @property {number} level
 * @property {number} walk
 * @property {number} seed
 * @property {number} lifeT Lebenszeit der Figur (ctx.t)
 * @property {number} hp
 * @property {number} t Sekunden seit Beginn des Verschwindens
 * @property {number} duration
 * @property {THREE.Color | null} color Rollenfarbe, in die sich eine Zutat beim Verschmelzen auflöst
 */

/**
 * Kürzeste Drehung von `from` nach `to` im Bereich -PI..PI.
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

/**
 * Über das Ziel hinausschwingendes Aufwachsen 0..1.
 * @param {number} u 0..1
 * @returns {number}
 */
function easeOutBack(u) {
  const c = 1.9;
  const v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} u
 * @returns {number}
 */
function smooth(a, b, u) {
  const k = u <= a ? 0 : u >= b ? 1 : (u - a) / (b - a);
  return k * k * (3 - 2 * k);
}

/**
 * Stabiler Zufallswert 0..1 aus einer Kennung.
 * @param {number} id
 * @returns {number}
 */
function seedOf(id) {
  const s = Math.sin(id * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Baut die Figurenschicht.
 * @param {RenderEnv} env
 * @returns {EntityLayer}
 */
export function createEntityLayer(env) {
  const group = new THREE.Group();
  group.name = 'entities';
  env.scene.add(group);

  /** @type {Sim | null} */
  let sim = null;
  let frame = 0;
  /** Echte Sekunden seit dem Anlegen, für das Pulsieren der Markierungen. */
  let clock = 0;
  let shadows = true;

  // --- Zeichner ------------------------------------------------------------------------------------------------------
  /** @type {Map<string, InstancedModel>} */
  const instances = new Map();
  /** Kennungen der Farbvarianten (Modell|Waffe) und die Waffe dazu. @type {Map<string, TowerArchetypeDef>} */
  const variantArch = new Map();
  /** Kennungen der Ausprägungen je Waffe des Pools, einmal berechnet. @type {Map<TowerArchetypeDef, string[]>} */
  const variantIds = new Map();
  /** @type {InstancedModel[]} */
  const instanceList = [];
  const pips = new InstancedModel(pipModel(), env.materials, { capacity: 64, castShadow: false, receiveShadow: false });
  const hourglasses = new InstancedModel(hourglassModel(), env.materials, { capacity: 32, castShadow: false, receiveShadow: false });
  // Superwaffen: Lichtkranz über dem Turm und je Gabe ein kreisendes Licht (je ein Zeichenaufruf für alle).
  const crowns = new InstancedModel(crownModel(), env.materials, { capacity: 8, castShadow: false, receiveShadow: false });
  const orbs = new InstancedModel(orbModel(), env.materials, { capacity: 16, castShadow: false, receiveShadow: false });
  // Megawaffen: zusätzlich eine Lichtkrone mit Zacken (ein Zeichenaufruf für alle).
  const megaCrowns = new InstancedModel(megaCrownModel(), env.materials, { capacity: 2, castShadow: false, receiveShadow: false });
  const markerList = [pips, hourglasses, crowns, orbs, megaCrowns];
  /** Erkennungszeichen der Waffen (`arch.look`), je Zeichen und Akzentfarbe ein Zeichner. @type {Map<string, InstancedModel>} */
  const weaponMarks = new Map();
  /** Lage eines Erkennungszeichens relativ zum Turm (wiederverwendet). */
  const markAt = { x: 0, y: 0, z: 0, s: 1 };

  /**
   * Zeichner für das Erkennungszeichen einer Waffe oder null (klassische Waffen und unbekannte Zeichen).
   * @param {TowerArchetypeDef} arch
   * @returns {InstancedModel | null}
   */
  function weaponMarkFor(arch) {
    const look = arch.look;
    if (!look || !look.marker || look.marker === 'none') return null;
    const accent = typeof look.accent === 'string' ? look.accent : '#' + new THREE.Color(look.accent).getHexString();
    const key = `${look.marker}|${accent}`;
    let inst = weaponMarks.get(key);
    if (inst === undefined) {
      const spec = weaponMarkerModel(look.marker, accent);
      if (!spec) return null;
      inst = new InstancedModel(spec, env.materials, { capacity: 8, castShadow: false, receiveShadow: false });
      inst.begin();
      weaponMarks.set(key, inst);
      markerList.push(inst);
      group.add(inst.group);
    }
    return inst;
  }
  const decals = new GroundDecals();
  const shells = new GlowShells();
  const bars = new HealthBars();
  group.add(pips.group, hourglasses.group, crowns.group, orbs.group, megaCrowns.group, decals.mesh, shells.mesh, bars.mesh);

  /**
   * Zeichner für ein Modell; wird beim ersten Bedarf angelegt und bleibt bestehen.
   * @param {string} id
   * @returns {InstancedModel}
   */
  function instanceFor(id) {
    let inst = instances.get(id);
    if (!inst) {
      // Waffen des Pools: das Modell des Platzes in der Farbe der Waffe (siehe towerModelId).
      const weapon = variantArch.get(id);
      const base = getModel(weapon ? id.slice(0, id.indexOf('|')) : id);
      inst = new InstancedModel(weapon ? weaponVariant(base, weapon) : base, env.materials, { capacity: 16, castShadow: shadows });
      inst.begin();
      instances.set(id, inst);
      instanceList.push(inst);
      group.add(inst.group);
    }
    return inst;
  }

  // --- Ansichten -----------------------------------------------------------------------------------------------------
  /** @type {Map<number, EnemyView>} */
  const enemyViews = new Map();
  /** @type {EnemyView[]} */
  const enemyList = [];
  /** @type {EnemyView[]} */
  const enemyPool = [];
  /** @type {Map<number, TowerView>} */
  const towerViews = new Map();
  /** @type {TowerView[]} */
  const towerList = [];
  /** @type {Ghost[]} */
  const dying = [];
  /** @type {Ghost[]} */
  const folding = [];
  /** Zutaten einer Verschmelzung, die sich gerade auflösen. @type {Ghost[]} */
  const absorbing = [];
  /** @type {Ghost[]} */
  const ghostPool = [];
  /** Rollenfarben als THREE.Color, je Rollenkennung einmal angelegt. @type {Map<string, THREE.Color>} */
  const roleColors = new Map();

  /**
   * @param {string} archId
   * @returns {THREE.Color}
   */
  function roleColor(archId) {
    let c = roleColors.get(archId);
    if (!c) {
      const arch = env.content.archetypes.find((a) => a.id === archId);
      c = new THREE.Color(arch ? arch.color : '#ffffff');
      roleColors.set(archId, c);
    }
    return c;
  }

  // --- Wiederverwendete Rechenobjekte ----------------------------------------------------------------------------------
  const ctx = makeAnimCtx();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const tint = new THREE.Color();
  const viewport = new THREE.Vector2();
  const tmpColor = new THREE.Color();

  const COLOR_SHIELD = new THREE.Color('#8fdcff');
  /** Fadenkreuz eines gezeichneten (verwundbaren) Gegners. */
  const COLOR_MARK = new THREE.Color('#ff4f7e');
  const COLOR_SHADOW = new THREE.Color('#1c2433');
  const COLOR_BUFF = new THREE.Color('#ffdf8a');
  const COLOR_UPGRADE = new THREE.Color('#fff0b0');
  const COLOR_TIME = new THREE.Color('#c8f0ff');
  /** Die Lichtsäule darf überstrahlen (Werte über 1). */
  const COLOR_COLUMN = new THREE.Color('#a8e6ff').multiplyScalar(1.25);
  const COLOR_VALID = new THREE.Color('#7fe08a');
  const COLOR_INVALID = new THREE.Color('#ff7d6a');
  const COLOR_ABILITY = new THREE.Color('#ffe7a0');
  const COLOR_WHITE = new THREE.Color('#ffffff');
  const COLOR_GOLD = new THREE.Color('#ffd36a');

  // --- Bauvorschau, Auswahl, Zielkreis ---------------------------------------------------------------------------------
  // Die Vorschau ist ein Einzelstück und bekommt eigene, durchscheinende Materialien.
  const previewMaterials = {
    matte: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.62 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62 }),
  };
  const previewRoot = new THREE.Group();
  previewRoot.name = 'entities:preview';
  previewRoot.visible = false;
  previewRoot.renderOrder = 5;
  group.add(previewRoot);
  /** @type {Map<string, { object: THREE.Group, update: (ctx: AnimCtx) => void }>} */
  const previewObjects = new Map();
  const preview = {
    active: false,
    x: 0,
    z: 0,
    valid: false,
    range: 0,
    /** @type {{ object: THREE.Group, update: (ctx: AnimCtx) => void } | null} */
    model: null,
    /** Sekunden seit dem Wechsel des Feldes, für ein weiches Aufsetzen. */
    t: 0,
  };
  const previewCtx = makeAnimCtx();
  const selection = { id: -1, color: new THREE.Color('#ffffff'), t: 0 };
  const ability = { active: false, x: 0, z: 0, radius: 0 };

  // Helligkeit der Lichtstimmung: Unbeleuchtete Marken und Hüllen würden in dunklen Zeitaltern blenden, also werden sie
  // mit dem Licht der Szene gedimmt. Die Lichter der Szene werden gelegentlich neu gesucht, ihre Werte in jedem Bild gelesen.
  /** @type {THREE.Light[]} */
  const lights = [];
  /** @param {THREE.Object3D} object */
  const collectLight = (object) => {
    if (/** @type {THREE.Light} */ (object).isLight) lights.push(/** @type {THREE.Light} */ (object));
  };
  let gain = 1;

  /**
   * @param {THREE.Color} c
   * @returns {number}
   */
  function luminance(c) {
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }

  /**
   * Schätzt, wie hell eine waagerechte Fläche beleuchtet ist (etwa 0,8 am Tag), und führt die Helligkeit der Marken nach.
   * @param {number} dt
   */
  function updateGain(dt) {
    if (frame % 60 === 1) {
      lights.length = 0;
      env.scene.traverse(collectLight);
    }
    if (lights.length === 0) return;
    let sum = 0;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (!light.visible) continue;
      const lum = luminance(light.color) * light.intensity;
      const hemi = /** @type {THREE.HemisphereLight} */ (light);
      if (hemi.isHemisphereLight) sum += (lum + luminance(hemi.groundColor) * light.intensity) * 0.5;
      else if (/** @type {THREE.DirectionalLight} */ (light).isDirectionalLight) sum += lum * 0.6;
      else if (/** @type {THREE.AmbientLight} */ (light).isAmbientLight) sum += lum;
    }
    const wanted = Math.max(0.4, Math.min(1, 0.3 + (0.9 * sum) / Math.PI));
    gain += (wanted - gain) * (frame <= 2 ? 1 : Math.min(1, dt * 4));
    decals.uniforms.uGain.value = gain;
    shells.uniforms.uGain.value = gain;
  }

  // Kamerazugewandte Kante eines Feldes, an der die Stufenpunkte liegen (je Bild neu bestimmt).
  let pipEdgeX = 0;
  let pipEdgeZ = 1;

  /**
   * Setzt den gemeinsamen Animationskontext auf Ruhewerte zurück.
   * @returns {AnimCtx}
   */
  function resetCtx() {
    ctx.t = 0;
    ctx.seed = 0;
    ctx.walk = 0;
    ctx.move = 0;
    ctx.hp = 1;
    ctx.hurt = 0;
    ctx.aimYaw = 0;
    ctx.aimPitch = 0;
    ctx.fire = 0;
    ctx.charge = 1;
    ctx.active = 0;
    ctx.level = 1;
    return ctx;
  }

  /** @returns {Ghost} */
  function takeGhost() {
    return ghostPool.pop() ?? { inst: pips, id: -1, x: 0, y: 0, z: 0, centerY: 0, yaw: 0, pitch: 0, scale: 1, level: 1, walk: 0, seed: 0, lifeT: 0, hp: 0, t: 0, duration: 1, color: null };
  }

  /**
   * @param {Enemy} enemy
   * @returns {EnemyView}
   */
  function enemyView(enemy) {
    let view = enemyViews.get(enemy.id);
    if (view) return view;
    view = enemyPool.pop() ?? { id: 0, seed: 0, inst: pips, fresh: true, stamp: 0, x: 0, y: 0, z: 0, centerY: 0, yaw: 0, bank: 0, walk: 0, hurt: 0, shieldHit: 0, heal: 0, hpLag: 1, scale: 1, hp: 1, t: 0, mark: 0, push: 0, pushX: 0, pushZ: 0 };
    view.id = enemy.id;
    view.seed = seedOf(enemy.id);
    view.inst = instanceFor(enemy.def.model);
    view.fresh = true;
    view.stamp = frame;
    view.x = enemy.x;
    view.y = enemyBaseY(enemy);
    view.z = enemy.z;
    view.centerY = view.y + view.inst.spec.bounds.height * 0.5 * (enemy.def.scale ?? 1);
    view.yaw = Math.atan2(enemy.dx, enemy.dz);
    view.bank = 0;
    view.walk = view.seed * TAU;
    view.hurt = 0;
    view.shieldHit = 0;
    view.heal = 0;
    view.mark = 0;
    view.push = 0;
    view.pushX = 0;
    view.pushZ = 0;
    view.hpLag = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    view.scale = enemy.def.scale ?? 1;
    view.hp = view.hpLag;
    view.t = enemy.age;
    enemyViews.set(enemy.id, view);
    enemyList.push(view);
    return view;
  }

  /**
   * @param {Tower} tower
   * @returns {TowerView}
   */
  function towerView(tower) {
    let view = towerViews.get(tower.id);
    if (view) return view;
    view = {
      id: tower.id,
      seed: seedOf(tower.id + 0.5),
      stamp: frame,
      drawn: false,
      yaw: Math.atan2(tower.aimX - tower.x, tower.aimZ - tower.z),
      pitch: 0,
      active: 0,
      t: 0,
      kick: 0,
      mark: 0,
      superK: tower.super ? 1 : 0,
      megaK: tower.mega ? 1 : 0,
      fuse: -1,
      anim: 'none',
      animT: 0,
      oldModel: '',
      muzzle: new THREE.Vector3(tower.x, MUZZLE_HEIGHT, tower.z),
      modelId: '',
      level: tower.level,
      x: tower.x,
      z: tower.z,
    };
    towerViews.set(tower.id, view);
    towerList.push(view);
    return view;
  }

  /**
   * Modell-Kennung der Ausprägung, die ein Turm gerade hat.
   * @param {TowerArchetypeDef} arch
   * @param {number} tier
   * @returns {string}
   */
  function towerModelId(arch, tier) {
    const def = arch.tiers[tier];
    if (!def) return `tower.unknown.${arch.id}`;
    if (!arch.look || arch.look.marker === 'none') return def.model;
    // Waffe des Pools: eigene Farbvariante des geteilten Modells, je Waffe und Ausprägung eine Kennung (einmal angelegt).
    let ids = variantIds.get(arch);
    if (!ids) {
      ids = arch.tiers.map((t) => (t && accentHex(arch.look) ? `${t.model}|${arch.id}` : t ? t.model : ''));
      variantIds.set(arch, ids);
      for (const id of ids) if (id.includes('|')) variantArch.set(id, arch);
    }
    return ids[tier] || def.model;
  }

  /** Leert alle Ansichten und Nachbilder. */
  function clearViews() {
    for (const view of enemyList) enemyPool.push(view);
    enemyList.length = 0;
    enemyViews.clear();
    towerList.length = 0;
    towerViews.clear();
    for (const ghost of dying) ghostPool.push(ghost);
    for (const ghost of folding) ghostPool.push(ghost);
    for (const ghost of absorbing) ghostPool.push(ghost);
    absorbing.length = 0;
    dying.length = 0;
    folding.length = 0;
    selection.id = -1;
    preview.active = false;
    ability.active = false;
  }

  // --- Ereignisse ------------------------------------------------------------------------------------------------------

  /** @param {readonly SimEvent[]} events */
  function handleEvents(events) {
    if (!sim) return;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'damage': {
          // Schaden über Zeit meldet die Simulation in jedem Zeitschritt; er färbt die Figur, lässt sie aber nicht zucken.
          // Ein echter Treffer setzt `sinceHit` zurück. Unter Dauerfeuer zuckt die Figur in Abständen statt ununterbrochen.
          const view = enemyViews.get(ev.enemy.id);
          if (view && ev.enemy.sinceHit < DIRECT_HIT_WINDOW) {
            if (view.hurt < 0.4) view.hurt = 1;
            if (ev.shield && view.shieldHit < 0.5) view.shieldHit = 1;
          }
          break;
        }
        case 'heal': {
          const view = enemyViews.get(ev.enemy.id);
          if (view) view.heal = 1;
          break;
        }
        case 'push': {
          // Rückstoß: Die Simulation setzt den Gegner sofort zurück; die Figur gleitet in PUSH_TIME von der alten Lage dorthin,
          // mit kleinem Hüpfer und nach hinten geneigt (siehe drawEnemies).
          const view = enemyViews.get(ev.enemy.id);
          if (view && !view.fresh) {
            view.push = 1;
            view.pushX = view.x - ev.enemy.x;
            view.pushZ = view.z - ev.enemy.z;
          }
          break;
        }
        case 'kill': {
          const view = enemyViews.get(ev.enemy.id);
          if (view && !view.fresh) {
            const ghost = takeGhost();
            ghost.inst = view.inst;
            ghost.id = view.id;
            ghost.x = view.x;
            ghost.y = view.y;
            ghost.z = view.z;
            ghost.centerY = view.centerY;
            ghost.yaw = view.yaw;
            ghost.pitch = view.bank;
            ghost.scale = view.scale;
            ghost.level = 1;
            ghost.walk = view.walk;
            ghost.seed = view.seed;
            ghost.lifeT = view.t;
            ghost.hp = 0;
            ghost.t = 0;
            ghost.duration = DEATH_TIME;
            dying.push(ghost);
          }
          break;
        }
        case 'shot': {
          const view = towerViews.get(ev.tower.id);
          if (view) view.kick = 1;
          break;
        }
        case 'build': {
          const view = towerView(ev.tower);
          view.anim = 'build';
          view.animT = 0;
          break;
        }
        case 'upgrade': {
          const view = towerView(ev.tower);
          view.anim = 'upgrade';
          view.animT = 0;
          break;
        }
        case 'modernize': {
          const view = towerView(ev.tower);
          view.anim = 'modernize';
          view.animT = 0;
          view.oldModel = towerModelId(ev.tower.arch, ev.fromTier);
          break;
        }
        case 'sell': {
          const view = towerViews.get(ev.tower.id);
          if (view && view.drawn) {
            const ghost = takeGhost();
            ghost.inst = instanceFor(view.modelId);
            ghost.id = -1;
            ghost.x = view.x;
            ghost.y = 0;
            ghost.z = view.z;
            ghost.centerY = 0;
            ghost.yaw = view.yaw;
            ghost.pitch = view.pitch;
            ghost.scale = 1;
            ghost.level = view.level;
            ghost.walk = 0;
            ghost.seed = view.seed;
            ghost.lifeT = view.t;
            ghost.hp = 1;
            ghost.t = 0;
            ghost.duration = SELL_TIME;
            folding.push(ghost);
          }
          if (selection.id === ev.tower.id) selection.id = -1;
          break;
        }
        case 'fuse': {
          // Der Kern schwillt an, sobald die Lichter angekommen sind; die Zutaten sind schon aus dem Zustand
          // verschwunden und lösen sich als Nachbilder auf.
          // Bei der zweiten Verschmelzung (Megawaffe) bleibt die Superwaffe stehen und wächst nur weiter.
          const core = towerView(ev.tower);
          core.fuse = 0;
          core.superK = ev.mega ? 1 : 0;
          core.megaK = 0;
          for (let k = 0; k < ev.parts.length; k++) {
            const part = ev.parts[k];
            const view = towerViews.get(part.id);
            const ghost = takeGhost();
            ghost.inst = instanceFor(view && view.drawn ? view.modelId : towerModelId(part.arch, ev.tower.tier));
            ghost.id = -1;
            ghost.x = part.x;
            ghost.y = 0;
            ghost.z = part.z;
            ghost.centerY = 0;
            ghost.yaw = view ? view.yaw : 0;
            ghost.pitch = view ? view.pitch : 0;
            ghost.scale = 1;
            ghost.level = 3;
            ghost.walk = 0;
            ghost.seed = view ? view.seed : 0;
            ghost.lifeT = view ? view.t : 0;
            ghost.hp = 1;
            ghost.t = 0;
            ghost.duration = ABSORB_TIME;
            ghost.color = roleColor(part.arch.id);
            absorbing.push(ghost);
            if (selection.id === part.id) selection.id = -1;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // --- Gegner ----------------------------------------------------------------------------------------------------------

  /**
   * @param {Sim} s
   * @param {number} simDt
   * @param {number} alpha
   */
  function drawEnemies(s, simDt, alpha) {
    const enemies = s.state.enemies;
    const turn = 1 - Math.exp(-simDt * 14);
    const bankEase = 1 - Math.exp(-simDt * 5);
    const lagEase = 1 - Math.exp(-simDt * 4.5);
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const def = e.def;
      const view = enemyView(e);
      const inst = view.inst;
      const spec = inst.spec;
      const baseScale = def.scale ?? 1;
      view.stamp = frame;

      // Ort: zwischen vorigem und aktuellem Zeitschritt; nach einem Rückstoß gleitet die Figur von der alten Lage dorthin.
      let x = e.px + (e.x - e.px) * alpha;
      let z = e.pz + (e.z - e.pz) * alpha;
      let shove = 0;
      if (view.push > 0) {
        view.push = Math.max(0, view.push - simDt / PUSH_TIME);
        const u = 1 - view.push;
        const slide = 1 - (1 - u) * (1 - u) * (1 - u);
        x += view.pushX * (1 - slide);
        z += view.pushZ * (1 - slide);
        shove = Math.sin(u * Math.PI);
      }
      const targetYaw = Math.atan2(e.dx, e.dz);
      let yawStep = 0;
      if (view.fresh) {
        view.yaw = targetYaw;
      } else {
        const moved = Math.hypot(x - view.x, z - view.z);
        if (moved > 1.2) {
          // Sprung (zurückgeworfen durch die Zeitglocke): nicht hinterherlaufen, sondern neu ansetzen.
          view.yaw = targetYaw;
        } else if (shove > 0) {
          // Rückstoß: rückwärts gleiten, nicht rückwärts laufen.
          yawStep = angleDelta(view.yaw, targetYaw) * turn;
          view.yaw += yawStep;
        } else {
          view.walk += (TAU * moved) / Math.max(0.05, spec.stride * baseScale);
          yawStep = angleDelta(view.yaw, targetYaw) * turn;
          view.yaw += yawStep;
        }
      }
      view.fresh = false;
      if (view.hurt > 0) view.hurt = Math.max(0, view.hurt - simDt / HURT_TIME);
      if (view.shieldHit > 0) view.shieldHit = Math.max(0, view.shieldHit - simDt / 0.35);
      if (view.heal > 0) view.heal = Math.max(0, view.heal - simDt / 0.6);

      // Höhe: Läufer stehen auf dem abgesenkten Weg, Flieger schweben, wippen und legen sich in die Kurve.
      let y = enemyBaseY(e);
      let bank = 0;
      if (def.flying) {
        const phase = e.age * 1.9 + view.seed * TAU;
        y += Math.sin(phase) * 0.06;
        const rate = simDt > 0 ? yawStep / simDt : 0;
        const wanted = Math.max(-0.45, Math.min(0.45, -rate * 0.16)) + Math.sin(phase * 0.6 + 1.3) * 0.05;
        view.bank += (wanted - view.bank) * bankEase;
        bank = view.bank;
      }

      const grow = e.age >= SPAWN_TIME ? 1 : easeOutBack(e.age / SPAWN_TIME);
      const size = baseScale * grow;
      // Rückstoß: kleiner Hüpfer und nach hinten gekippt (Bosse kaum).
      if (shove > 0) y += shove * 0.09 * (def.boss ? 0.4 : 1);
      euler.set(-shove * (def.boss ? 0.12 : 0.38), view.yaw, bank);
      matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler), scaleVec.set(size, size, size));

      const hp = e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 1;
      resetCtx();
      ctx.t = e.age;
      ctx.seed = view.seed;
      ctx.walk = view.walk;
      ctx.move = def.speed > 0 ? e.speed / def.speed : 0;
      ctx.hp = hp;
      ctx.hurt = view.hurt;

      // Einfärbung: verlangsamt = kühl, brennend/vergiftet = warm flackernd, Heilung = grünlich, Treffer = kurz heller.
      let r = 1;
      let g = 1;
      let b = 1;
      if (e.slow > 0) {
        const k = Math.min(1, 0.35 + e.slow * 1.3);
        r += (0.5 - r) * k;
        g += (0.78 - g) * k;
        b += (1.3 - b) * k;
      }
      if (e.dot > 0) {
        const flicker = 0.5 + 0.3 * Math.sin(e.age * 13 + view.seed * 40) + 0.2 * Math.sin(e.age * 23.7 + view.seed * 17);
        const k = 0.4 + 0.35 * flicker;
        r *= 1 + 0.5 * k;
        g *= 1 - 0.18 * k;
        b *= 1 - 0.55 * k;
      }
      if (view.heal > 0) {
        r -= 0.12 * view.heal;
        g += 0.3 * view.heal;
        b -= 0.05 * view.heal;
      }
      const flash = view.hurt * view.hurt * 0.75;
      inst.add(matrix, ctx, tint.setRGB(r + flash, g + flash, b + flash));

      const height = spec.bounds.max[1] * size;
      const centerY = y + spec.bounds.height * 0.5 * size;
      view.x = x;
      view.y = y;
      view.z = z;
      view.centerY = centerY;
      view.scale = size;
      view.hp = hp;
      view.t = e.age;

      // Schattenfleck: unter Fliegern immer (er zeigt, über welcher Stelle sie schweben), unter Läufern als Ersatz,
      // wenn die Grafikstufe keine echten Schatten zeichnet (dann knapp über dem abgesenkten Weg, unter den Füßen).
      if (def.flying) decals.add(x, z, Math.max(0.16, spec.bounds.radius * size * 0.95), COLOR_SHADOW, 0.3 * grow, DECAL.BLOB);
      else if (!shadows) decals.add(x, z, Math.max(0.2, spec.bounds.radius * size * 1.5), COLOR_SHADOW, 0.5 * grow, DECAL.BLOB, 0, 0, 0, BLOB_LIFT);

      // Schild: Blase um die Figur, Helligkeit nach Schildstand, flackert bei Treffern.
      let shield = -1;
      if (e.maxShield > 0) {
        shield = Math.max(0, Math.min(1, e.shield / e.maxShield));
        if (e.shield > 0) {
          const hit = view.shieldHit;
          const flickerHit = hit > 0 ? hit * (0.45 + 0.35 * Math.sin(e.age * 55 + view.seed * 9)) : 0;
          const strength = (0.3 + 0.55 * shield) * (1 + 0.06 * Math.sin(e.age * 2.6 + view.seed * 30)) + flickerHit;
          const rad = Math.max(spec.bounds.radius * 1.12, spec.bounds.height * 0.5) * size + 0.06;
          const radY = spec.bounds.height * 0.6 * size + 0.07;
          const swell = 1 + hit * 0.06;
          shells.add(x, centerY, z, rad * swell, radY * swell, rad * swell, COLOR_SHIELD, strength, SHELL.BUBBLE);
        }
      }

      // Zeichen (Verwundbarkeit): ein ruhig kreisendes Fadenkreuz am Boden unter der Figur, solange `vulnTime` läuft. Es rastet
      // beim Zeichnen von außen ein und blendet in der letzten halben Sekunde aus. Am Boden stört es weder Balken noch Schild,
      // Tropfen oder Flammen an der Figur.
      const vuln = e.vuln ?? 0;
      const vulnTime = e.vulnTime ?? 0;
      if (vuln > 0 && vulnTime > 0) view.mark = Math.min(1, view.mark + simDt / 0.22);
      else view.mark = 0;
      if (view.mark > 0) {
        const lock = 1 + 0.7 * (1 - view.mark) * (1 - view.mark);
        const fade = Math.min(1, vulnTime / 0.5) * Math.min(1, view.mark * 1.6);
        const rad = Math.max(0.2, spec.bounds.radius * size * 1.35 + 0.08) * lock;
        decals.add(x, z, rad, COLOR_MARK, 0.95 * fade, DECAL.DASHED, 0.16, 4, clock * 1.4 + view.seed * TAU, 0.006);
      }

      // Lebensbalken nur für Verletzte (oder angekratzte Schilde).
      view.hpLag = hp >= view.hpLag ? hp : view.hpLag + (hp - view.hpLag) * lagEase;
      if (hp < 0.999 || (shield >= 0 && shield < 0.999)) {
        bars.add(x, y + height + 0.07, z, hp, view.hpLag, shield, def.boss ? 1.9 : 1);
      }
    }

    // Ansichten verschwundener Gegner zurückgeben.
    for (let i = enemyList.length - 1; i >= 0; i--) {
      const view = enemyList[i];
      if (view.stamp === frame) continue;
      enemyViews.delete(view.id);
      enemyList[i] = enemyList[enemyList.length - 1];
      enemyList.pop();
      enemyPool.push(view);
    }
  }

  /**
   * Besiegte Gegner sinken kurz in sich zusammen.
   * @param {number} simDt
   * @param {number} dt
   */
  function drawDying(simDt, dt) {
    for (let i = dying.length - 1; i >= 0; i--) {
      const ghost = dying[i];
      // Läuft mit der simulierten Zeit, bei Pause aber mit der echten weiter, damit nichts stehen bleibt.
      ghost.t += simDt > 0 ? simDt : dt;
      const u = ghost.t / ghost.duration;
      if (u >= 1) {
        dying[i] = dying[dying.length - 1];
        dying.pop();
        ghostPool.push(ghost);
        continue;
      }
      const wide = ghost.scale * (1 + 0.3 * u) * (1 - u * u * u);
      const tall = ghost.scale * (1 - u) * (1 - u);
      euler.set(0, ghost.yaw, ghost.pitch);
      matrix.compose(position.set(ghost.x, ghost.y, ghost.z), quaternion.setFromEuler(euler), scaleVec.set(wide, tall, wide));
      resetCtx();
      ctx.t = ghost.lifeT;
      ctx.seed = ghost.seed;
      ctx.walk = ghost.walk;
      ctx.hp = 0;
      ctx.hurt = 1;
      const glow = 1.35 + u * 0.4;
      ghost.inst.add(matrix, ctx, tint.setRGB(glow, glow, glow));
    }
  }

  // --- Türme -----------------------------------------------------------------------------------------------------------

  /**
   * Drehgeschwindigkeit eines Turms: Wer schnell feuert, dreht schneller, damit der Schuss sichtbar in die richtige Richtung geht.
   * @param {number} cooldown Sekunden zwischen zwei Schüssen
   * @returns {number}
   */
  function turnRate(cooldown) {
    if (!(cooldown > 0)) return TURN_RATE * 2;
    return Math.max(TURN_RATE, Math.min(32, 4.5 / cooldown));
  }

  /**
   * Ob es für den Turm im aktuellen Zeitalter eine neuere Ausprägung gibt.
   * @param {Tower} tower
   * @param {number} age
   * @returns {boolean}
   */
  function isOutdated(tower, age) {
    const tiers = tower.arch.tiers;
    for (let k = Math.min(age, tiers.length - 1); k > tower.tier; k--) if (tiers[k]) return true;
    return false;
  }

  /**
   * @param {Sim} s
   * @param {number} dt
   * @param {number} simDt
   */
  function drawTowers(s, dt, simDt) {
    const towers = s.state.towers;
    const time = s.state.time;
    const age = s.state.age;
    const activeEase = 1 - Math.exp(-simDt * 7);
    const pitchEase = 1 - Math.exp(-simDt * 9);
    const markEase = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const view = towerView(t);
      view.stamp = frame;
      view.t += simDt;
      const modelId = towerModelId(t.arch, t.tier);
      const inst = instanceFor(modelId);
      const spec = inst.spec;
      const stats = t.stats;
      const cooldown = stats.cooldown / (1 + t.buffRate);

      // Ausrichten auf die letzte bekannte Zielposition.
      const ax = t.aimX - t.x;
      const az = t.aimZ - t.z;
      const dist = Math.hypot(ax, az);
      if (view.kick > 0) view.kick = Math.max(0, view.kick - simDt / 0.12);
      if (dist > 0.01) {
        const delta = angleDelta(view.yaw, Math.atan2(ax, az));
        const rate = turnRate(cooldown) * (1 + view.kick * 3);
        const eased = delta * (1 - Math.exp(-simDt * rate * 2.5));
        const limit = rate * simDt;
        view.yaw += eased > limit ? limit : eased < -limit ? -limit : eased;
        const wantedPitch = t.aimFlying ? Math.atan2(FLY_HEIGHT + 0.3 - MUZZLE_HEIGHT, dist) : 0;
        view.pitch += (wantedPitch - view.pitch) * pitchEase;
      }
      view.active += ((t.targetId >= 0 ? 1 : 0) - view.active) * activeEase;

      // Animationen: Bau, Ausbau, Modernisierung. Alle kurz und federnd, keine hält das Spiel auf.
      let lift = 0;
      let wide = 1;
      let tall = 1;
      let bright = 1;
      if (view.anim !== 'none') {
        view.animT += dt;
        const u = view.animT;
        if (view.anim === 'build') {
          const fall = 0.16;
          if (u < fall) {
            const k = u / fall;
            lift = 0.75 * (1 - k * k);
            wide = 0.9;
            tall = 1.1;
          } else {
            const q = Math.exp(-(u - fall) * 9) * Math.cos((u - fall) * 21) * 0.26;
            tall = 1 - q;
            wide = 1 + q * 0.55;
          }
          const k = Math.min(1, u / 0.1);
          wide *= 0.55 + 0.45 * k;
          tall *= 0.55 + 0.45 * k;
          if (u >= BUILD_TIME) view.anim = 'none';
        } else if (view.anim === 'upgrade') {
          const q = Math.exp(-u * 7.5) * Math.sin(u * 21) * 0.2;
          tall = 1 + q;
          wide = 1 - q * 0.5;
          lift = u < 0.24 ? Math.sin((u / 0.24) * Math.PI) * 0.1 : 0;
          bright = 1 + 0.5 * Math.max(0, 1 - u / 0.3);
          const k = u / UPGRADE_TIME;
          decals.add(t.x, t.z, 0.45 + 0.6 * Math.sqrt(k), COLOR_UPGRADE, (1 - k) * (1 - k) * 0.9, DECAL.RING, 0.82, 0.12);
          if (u >= UPGRADE_TIME) view.anim = 'none';
        } else {
          // Modernisierung: Das alte Modell zieht sich zu einer Lichtsäule zusammen, das neue wächst daraus hervor.
          const k = Math.min(1, u / MODERNIZE_TIME);
          const column = Math.sin(Math.PI * Math.pow(k, 0.8));
          const top = Math.max(spec.bounds.max[1], 1) + 0.9;
          shells.add(t.x, top * 0.5, t.z, 0.22 + 0.3 * column, top * 0.62, 0.22 + 0.3 * column, COLOR_COLUMN, column * 1.8, SHELL.COLUMN);
          decals.add(t.x, t.z, 0.5 + 0.5 * k, COLOR_TIME, column * 0.8, DECAL.RING, 0.8, 0.14);
          const shrink = smooth(0, 0.24, u);
          if (shrink < 1 && view.oldModel) {
            const old = instanceFor(view.oldModel);
            const w = (1 - shrink) * (1 - shrink);
            matrix.compose(position.set(t.x, 0, t.z), quaternion.identity(), scaleVec.set(w, 1 + shrink * 0.35, w));
            resetCtx();
            ctx.t = view.t;
            ctx.seed = view.seed;
            ctx.aimYaw = view.yaw;
            ctx.aimPitch = view.pitch;
            ctx.level = t.level;
            const glow = 1 + shrink * 1.2;
            old.add(matrix, ctx, tint.setRGB(glow, glow, glow));
          }
          const g = u - 0.2;
          if (g <= 0) {
            wide = 0;
            tall = 0;
          } else {
            const spring = 1 - Math.exp(-g * 10) * Math.cos(g * 17);
            wide = spring;
            tall = 0.4 + 0.6 * spring + Math.exp(-g * 8) * 0.25;
            bright = 1 + 1.1 * Math.exp(-g * 7);
          }
          if (u >= MODERNIZE_TIME) view.anim = 'none';
        }
      }

      // Stampfer (Puls mit Rückstoß): hebt sich kurz vor dem Stoß an und stampft dann federnd auf.
      if (view.anim === 'none' && stats.attack === 'pulse' && (stats.push ?? 0) > 0) {
        const since = time - t.lastShot;
        if (since >= 0 && since < 0.45) {
          const q = Math.exp(-since * 9) * Math.cos(since * 24) * 0.17;
          tall *= 1 - q;
          wide *= 1 + q * 0.6;
        } else if (t.targetId >= 0 && t.cooldown > 0 && t.cooldown < STOMP_WINDUP) {
          const k = 1 - t.cooldown / STOMP_WINDUP;
          const e = k * k * (3 - 2 * k);
          lift += 0.13 * e;
          tall *= 1 + 0.07 * e;
          wide *= 1 - 0.04 * e;
        }
      }

      // Superwaffe: größer gezeichnet. Bei der Verschmelzung holt der Kern erst Luft und schwillt dann federnd an.
      if (t.super) {
        if (view.fuse >= 0) {
          view.fuse += dt;
          const g = view.fuse - FUSE_DELAY;
          let k = 0;
          if (g <= 0) {
            const q = Math.sin((view.fuse / FUSE_DELAY) * Math.PI) * 0.05;
            wide *= 1 - q;
            tall *= 1 + q * 0.6;
          } else {
            k = 1 - Math.exp(-g * (t.mega ? 6 : 7.5)) * Math.cos(g * (t.mega ? 11 : 13));
            bright += 0.7 * Math.exp(-g * 6);
          }
          view.superK = t.mega ? 1 : k;
          view.megaK = t.mega ? k : 0;
          if (view.fuse >= FUSE_TIME) view.fuse = -1;
        } else {
          view.superK = 1;
          view.megaK = t.mega ? 1 : 0;
        }
      } else {
        view.superK = 0;
        view.megaK = 0;
        view.fuse = -1;
      }
      const big = 1 + (SUPER_SCALE - 1) * view.superK + (MEGA_SCALE - SUPER_SCALE) * view.megaK;
      wide *= big;
      tall *= big;

      matrix.compose(position.set(t.x, lift, t.z), quaternion.identity(), scaleVec.set(wide, tall, wide));
      resetCtx();
      ctx.t = view.t;
      ctx.seed = view.seed;
      ctx.aimYaw = view.yaw;
      ctx.aimPitch = view.pitch;
      const sinceShot = time - t.lastShot;
      ctx.fire = sinceShot >= 0 && sinceShot < FIRE_TIME ? 1 - sinceShot / FIRE_TIME : 0;
      ctx.charge = stats.attack === 'beam' || stats.attack === 'none' || !(cooldown > 0) ? 1 : Math.max(0, Math.min(1, 1 - t.cooldown / cooldown));
      ctx.active = view.active;
      ctx.level = t.level;
      inst.add(matrix, ctx, tint.setRGB(bright, bright, bright));

      // Mündung der eben gezeichneten Pose merken.
      const muzzle = spec.points.muzzle;
      if (muzzle) {
        inst.pointWorld('muzzle', view.muzzle);
        if (muzzle.part < 0) view.muzzle.applyMatrix4(matrix);
      } else {
        view.muzzle.set(t.x, lift + spec.bounds.max[1] * 0.8 * tall, t.z);
      }
      view.drawn = true;
      view.modelId = modelId;
      view.level = t.level;
      view.x = t.x;
      view.z = t.z;

      const settled = wide > 0.6 ? 1 : 0;
      const top = spec.bounds.max[1] * big;
      // Stufenpunkte an der kamerazugewandten Kante des Feldes: zwei für Stufe 2, drei für Stufe 3.
      if (t.level >= 2 && settled) {
        const n = Math.min(3, t.level);
        // Unter dem größeren Sockel einer Superwaffe wären die Punkte verdeckt: weiter nach außen.
        const edge = 0.43 + 0.13 * Math.min(1, view.superK) + 0.06 * Math.min(1, view.megaK);
        const pop = view.anim === 'upgrade' ? Math.min(1, easeOutBack(Math.min(1, view.animT / 0.3))) : 1;
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * 0.13;
          // Der neueste Punkt (der letzte) springt beim Ausbau auf.
          const size = k === n - 1 ? pop : 1;
          matrix.compose(position.set(t.x + pipEdgeX * edge + pipEdgeZ * off, 0, t.z + pipEdgeZ * edge + pipEdgeX * off), quaternion.identity(), scaleVec.set(size, size, size));
          resetCtx();
          // Der dritte Punkt zeigt den Ausbauzweig: Zweig 1 trägt einen türkisfarbenen Kristall statt des goldenen Steins.
          if (k === 2 && t.branch === 1) ctx.level = 2;
          pips.add(matrix, ctx);
        }
      }
      // Erkennungszeichen der Waffe (Waffen eines Platzes teilen sich das Modell): in ihrer Akzentfarbe, mit der Lichtstimmung
      // geführt wie die Lichter der Superwaffen. Klassische Waffen haben keins.
      const mark = settled ? weaponMarkFor(t.arch) : null;
      if (mark) {
        const look = /** @type {NonNullable<TowerArchetypeDef['look']>} */ (t.arch.look);
        placeWeaponMarker(look.marker, top, pipEdgeX, pipEdgeZ, big, markAt);
        matrix.compose(position.set(t.x + markAt.x, markAt.y, t.z + markAt.z), quaternion.identity(), scaleVec.set(markAt.s, markAt.s, markAt.s));
        resetCtx();
        ctx.t = clock;
        ctx.seed = view.seed;
        const lum = 0.62 + 0.5 * gain;
        mark.add(matrix, ctx, tint.setRGB(lum, lum, lum));
      }
      // Veraltete Technik: eine kleine Sanduhr schwebt über dem Turm.
      const outdated = settled === 1 && isOutdated(t, age);
      view.mark += ((outdated ? 1 : 0) - view.mark) * markEase;
      if (view.mark > 0.02) {
        const size = 1.5 * (outdated ? easeOutBack(view.mark) : view.mark);
        matrix.compose(position.set(t.x, top + 0.34 + 0.3 * view.superK + 0.25 * view.megaK, t.z), quaternion.identity(), scaleVec.set(size, size, size));
        resetCtx();
        ctx.t = clock;
        ctx.seed = view.seed;
        hourglasses.add(matrix, ctx);
      }
      if (!shadows) decals.add(t.x, t.z, Math.max(0.6, spec.bounds.radius * 1.55) * big, COLOR_SHADOW, 0.5, DECAL.BLOB);
      // Superwaffe: ruhiger Lichtkranz in der Rollenfarbe am Boden und über dem Turm, darauf je Gabe ein kreisendes Licht
      // in der Farbe der aufgenommenen Rolle. Alles dreht sich langsam und gleichmäßig, nichts flackert.
      if (view.superK > 0.02 && settled) {
        const k = Math.min(1, view.superK);
        const role = roleColor(t.arch.id);
        const breath = 0.5 + 0.5 * Math.sin(clock * 1.3 + view.seed * TAU);
        const spin = clock * 0.5 + view.seed * TAU;
        decals.add(t.x, t.z, 0.88 * (0.6 + 0.4 * view.superK), tmpColor.copy(role).lerp(COLOR_WHITE, 0.2), (0.85 + 0.12 * breath) * k, DECAL.HALO, 0.8, 0.1, spin, 0.002);
        // Unbeleuchtete Lichter würden nachts blenden und am hellen Morgen verblassen: mit der Lichtstimmung führen.
        const lum = 0.62 + 0.5 * gain;
        const crownY = top + 0.2 + Math.sin(clock * 1.1 + view.seed * TAU) * 0.025;
        const crownR = Math.max(0.3, Math.min(0.4, spec.bounds.radius * big * 0.8));
        if (shadows) {
          const size = (crownR / 0.3) * view.superK;
          euler.set(Math.sin(clock * 0.7 + view.seed * 5) * 0.07, spin, Math.cos(clock * 0.6 + view.seed * 3) * 0.07);
          matrix.compose(position.set(t.x, crownY, t.z), quaternion.setFromEuler(euler), scaleVec.set(size, size, size));
          resetCtx();
          tint.copy(role).lerp(COLOR_WHITE, 0.18).multiplyScalar(lum * 1.2);
          crowns.add(matrix, ctx, tint);
        }
        // Megawaffe: ein zweiter, gegenläufiger Lichtkranz in Gold am Boden und eine Lichtkrone mit Zacken über dem Reif.
        const mk = Math.min(1, Math.max(0, view.megaK));
        if (mk > 0.02) {
          tmpColor.copy(COLOR_GOLD).lerp(role, 0.2);
          decals.add(t.x, t.z, 1.08 * (0.7 + 0.3 * view.megaK), tmpColor, (0.7 + 0.1 * breath) * mk, DECAL.HALO, 0.85, 0.075, -spin * 1.4 + 1.0, 0.003);
          if (shadows) {
            const size = ((crownR + 0.06) / 0.42) * view.megaK;
            euler.set(Math.cos(clock * 0.5 + view.seed * 4) * 0.05, -spin * 0.8, Math.sin(clock * 0.45 + view.seed * 2) * 0.05);
            matrix.compose(position.set(t.x, crownY + 0.1, t.z), quaternion.setFromEuler(euler), scaleVec.set(size, size, size));
            resetCtx();
            tint.copy(COLOR_GOLD).lerp(COLOR_WHITE, 0.15).multiplyScalar(lum * 1.2);
            megaCrowns.add(matrix, ctx, tint);
          }
        }
        const gifts = t.gifts;
        const n = gifts.length;
        for (let g = 0; g < n; g++) {
          const a = clock * 0.9 + view.seed * TAU + (g / n) * TAU;
          const size = view.superK;
          matrix.compose(position.set(t.x + Math.sin(a) * crownR, crownY + Math.sin(a * 2 + g) * 0.02, t.z + Math.cos(a) * crownR), quaternion.identity(), scaleVec.set(size, size, size));
          resetCtx();
          tint.copy(roleColor(gifts[g])).multiplyScalar(lum * 1.15);
          orbs.add(matrix, ctx, tint);
        }
      }
      // Von einer Aura gestärkt: schwach leuchtender Ring am Fuß.
      if (t.buffDamage > 0 || t.buffRate > 0 || t.buffRange > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 2.2 + view.seed * TAU);
        decals.add(t.x, t.z, 0.62, COLOR_BUFF, 0.5 + 0.2 * pulse, DECAL.RING, 0.8, 0.11 + 0.03 * pulse);
      }
    }

    // Ansichten verschwundener Türme entfernen.
    for (let i = towerList.length - 1; i >= 0; i--) {
      const view = towerList[i];
      if (view.stamp === frame) continue;
      towerViews.delete(view.id);
      towerList[i] = towerList[towerList.length - 1];
      towerList.pop();
    }
  }

  /**
   * Verkaufte Türme falten sich rasch zusammen.
   * @param {number} dt
   */
  function drawFolding(dt) {
    for (let i = folding.length - 1; i >= 0; i--) {
      const ghost = folding[i];
      ghost.t += dt;
      const u = ghost.t / ghost.duration;
      if (u >= 1) {
        folding[i] = folding[folding.length - 1];
        folding.pop();
        ghostPool.push(ghost);
        continue;
      }
      const tall = (1 - u) * (1 - u);
      const wide = (1 + 0.22 * Math.sin(u * Math.PI)) * (1 - u * u * u * u);
      matrix.compose(position.set(ghost.x, 0, ghost.z), quaternion.identity(), scaleVec.set(wide, tall, wide));
      resetCtx();
      ctx.t = ghost.lifeT;
      ctx.seed = ghost.seed;
      ctx.aimYaw = ghost.yaw;
      ctx.aimPitch = ghost.pitch;
      ctx.level = ghost.level;
      ghost.inst.add(matrix, ctx);
    }
  }

  /**
   * Zutaten einer Verschmelzung: Sie hellen sich in ihrer Rollenfarbe auf, werden schmal und sinken in sich zusammen,
   * während die Effektschicht ihre Lichter zum Kern fliegen lässt.
   * @param {number} dt
   */
  function drawAbsorbing(dt) {
    for (let i = absorbing.length - 1; i >= 0; i--) {
      const ghost = absorbing[i];
      ghost.t += dt;
      const u = ghost.t / ghost.duration;
      if (u >= 1) {
        absorbing[i] = absorbing[absorbing.length - 1];
        absorbing.pop();
        ghostPool.push(ghost);
        continue;
      }
      const s = u * u * (3 - 2 * u);
      const wide = (1 - s) * (1 + 0.1 * Math.sin(u * Math.PI));
      const tall = 1 - s * s;
      matrix.compose(position.set(ghost.x, 0.1 * s, ghost.z), quaternion.identity(), scaleVec.set(wide, tall, wide));
      resetCtx();
      ctx.t = ghost.lifeT;
      ctx.seed = ghost.seed;
      ctx.aimYaw = ghost.yaw;
      ctx.aimPitch = ghost.pitch;
      ctx.level = ghost.level;
      const glow = Math.min(1, u * 2.2);
      tint.setRGB(1, 1, 1);
      if (ghost.color) tint.lerp(tmpColor.copy(ghost.color).multiplyScalar(1.9), glow * 0.75);
      ghost.inst.add(matrix, ctx, tint);
      if (ghost.color) decals.add(ghost.x, ghost.z, 0.62 * (1 - 0.5 * s), ghost.color, (1 - u) * Math.min(1, u * 6) * 0.8, DECAL.RING, 0.8, 0.12);
    }
  }

  // --- Bauvorschau, Auswahl, Zielkreis ---------------------------------------------------------------------------------

  /**
   * @param {Sim} s
   * @param {number} dt
   */
  function drawOverlays(s, dt) {
    // Auswahl: Reichweite in der Farbe der Rolle und ein sanft pulsierender Ring am Fuß.
    if (selection.id >= 0) {
      const tower = s.towerById(selection.id);
      if (tower) {
        selection.t += dt;
        const open = easeOutBack(Math.min(1, selection.t / 0.22));
        // Auren (auch die Kopfgeld-Aura) wirken im unverstärkten Umkreis (docs/SIM.md, „Auren“, „Kopfgeld-Aura“).
        const st = tower.stats;
        const aura = st.attack === 'none' || (st.auraBounty ?? 0) > 0;
        const range = st.range * (aura ? 1 : 1 + tower.buffRange);
        if (range > 0) decals.add(tower.x, tower.z, range * (0.9 + 0.1 * open), selection.color, 0.85 * Math.min(1, selection.t / 0.15), DECAL.DISC, 0.07 / range);
        const pulse = 0.5 + 0.5 * Math.sin(clock * 3.4);
        decals.add(tower.x, tower.z, 0.66 + 0.04 * pulse, tmpColor.copy(selection.color).lerp(COLOR_WHITE, 0.55), 0.7 + 0.25 * pulse, DECAL.RING, 0.8, 0.1, 0, 0.004);
      } else {
        selection.id = -1;
      }
    }

    // Bauvorschau: durchscheinendes Modell und Reichweite, grünlich oder rötlich.
    previewRoot.visible = preview.active;
    if (preview.active) {
      preview.t += dt;
      const color = preview.valid ? COLOR_VALID : COLOR_INVALID;
      const settle = easeOutBack(Math.min(1, preview.t / 0.16));
      if (preview.range > 0) decals.add(preview.x, preview.z, preview.range, color, 0.9, DECAL.DISC, 0.07 / preview.range);
      decals.add(preview.x, preview.z, 0.6, color, 0.75, DECAL.RING, 0.82, 0.12, 0, 0.004);
      if (preview.model) {
        const bob = Math.sin(clock * 2.4) * 0.015;
        previewRoot.position.set(preview.x, 0.02 + bob + (1 - settle) * 0.12, preview.z);
        previewRoot.scale.setScalar(0.9 + 0.1 * settle);
        previewCtx.t = clock;
        previewCtx.level = 1;
        previewCtx.charge = 1;
        preview.model.update(previewCtx);
      }
    }

    // Zielkreis der Fähigkeit: Scheibe mit langsam drehendem, gestricheltem Rand.
    if (ability.active) {
      const dashes = Math.max(10, Math.round(ability.radius * 9));
      decals.add(ability.x, ability.z, ability.radius, COLOR_ABILITY, 0.9, DECAL.DASHED, 0.065 / Math.max(0.3, ability.radius), dashes, clock * 0.35);
      decals.add(ability.x, ability.z, 0.16, COLOR_ABILITY, 0.8, DECAL.BLOB, 0, 0, 0, 0.004);
    }
  }

  // --- Schnittstelle ---------------------------------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} simDt
   * @param {number} alpha
   */
  function update(dt, simDt, alpha) {
    frame++;
    clock += dt;
    for (let i = 0; i < instanceList.length; i++) instanceList[i].begin();
    for (let i = 0; i < markerList.length; i++) markerList[i].begin();
    decals.begin();
    shells.begin();
    bars.begin();

    updateGain(dt);
    if (sim) {
      // Kante des Feldes, die der Kamera am nächsten liegt (dort liegen die Stufenpunkte gut sichtbar).
      const m = env.camera.matrixWorld.elements;
      if (Math.abs(m[10]) >= Math.abs(m[8])) {
        pipEdgeX = 0;
        pipEdgeZ = m[10] >= 0 ? 1 : -1;
      } else {
        pipEdgeX = m[8] >= 0 ? 1 : -1;
        pipEdgeZ = 0;
      }
      drawOverlays(sim, dt);
      drawEnemies(sim, simDt, alpha);
      drawDying(simDt, dt);
      drawTowers(sim, dt, simDt);
      drawFolding(dt);
      drawAbsorbing(dt);
    } else {
      previewRoot.visible = false;
    }

    for (let i = 0; i < instanceList.length; i++) instanceList[i].end();
    for (let i = 0; i < markerList.length; i++) markerList[i].end();
    decals.end();
    shells.end();
    bars.end(env.camera, env.renderer.getSize(viewport).y);
  }

  /** @param {Sim | null} next */
  function bind(next) {
    sim = next;
    clearViews();
    previewRoot.visible = false;
    // Sofort leeren, damit bis zum nächsten update() nichts Altes stehen bleibt.
    for (let i = 0; i < instanceList.length; i++) {
      instanceList[i].begin();
      instanceList[i].end();
    }
    for (const inst of markerList) {
      inst.begin();
      inst.end();
    }
    decals.begin();
    decals.end();
    shells.begin();
    shells.end();
    bars.begin();
    bars.end(env.camera, 1);
  }

  /** @param {{ archId: string, tx: number, tz: number, valid: boolean } | null} p */
  function setBuildPreview(p) {
    if (!p || !sim) {
      preview.active = false;
      return;
    }
    const s = sim;
    const arch = s.content.archetypes.find((a) => a.id === p.archId);
    if (!arch) {
      preview.active = false;
      return;
    }
    const x = tileX(p.tx, s.map.width);
    const z = tileZ(p.tz, s.map.height);
    if (!preview.active || x !== preview.x || z !== preview.z) preview.t = 0;
    preview.active = true;
    preview.x = x;
    preview.z = z;
    preview.valid = p.valid;
    const age = s.state.age;
    const tier = arch.tiers[age];
    preview.range = tier ? towerStats(s.content, arch, age, 1).range : arch.stats.range;
    /** @type {{ object: THREE.Group, update: (ctx: AnimCtx) => void } | null} */
    let model = null;
    if (tier) {
      // Je Modell und Erkennungszeichen eine Vorschau: Waffen eines Platzes teilen sich das Modell, nicht das Zeichen.
      const look = arch.look && arch.look.marker !== 'none' ? arch.look : null;
      const key = look ? `${tier.model}|${look.marker}|${String(look.accent)}` : tier.model;
      model = previewObjects.get(key) ?? null;
      if (!model) {
        const spec = weaponVariant(getModel(tier.model), arch);
        model = createModelObject(spec, previewMaterials, { level: 1, castShadow: false, receiveShadow: false });
        const markSpec = look ? weaponMarkerModel(look.marker, typeof look.accent === 'string' ? look.accent : '#' + new THREE.Color(look.accent).getHexString()) : null;
        if (look && markSpec) {
          const mark = createModelObject(markSpec, previewMaterials, { level: 1, castShadow: false, receiveShadow: false });
          placeWeaponMarker(look.marker, spec.bounds.max[1], 0, 1, 1, markAt);
          mark.object.position.set(markAt.x, markAt.y, markAt.z);
          mark.object.scale.setScalar(markAt.s);
          model.object.add(mark.object);
        }
        model.object.traverse((o) => {
          o.renderOrder = 5;
        });
        previewObjects.set(key, model);
      }
    }
    if (model !== preview.model) {
      if (preview.model) previewRoot.remove(preview.model.object);
      if (model) previewRoot.add(model.object);
      preview.model = model;
    }
    const color = p.valid ? COLOR_VALID : COLOR_INVALID;
    // Aufgehellt, damit die Vertexfarben des Modells erkennbar bleiben und nur einen Stich bekommen.
    previewMaterials.matte.color.copy(color).lerp(COLOR_WHITE, 0.35);
    previewMaterials.glow.color.copy(previewMaterials.matte.color);
  }

  /** @param {Tower | null} tower */
  function setSelectedTower(tower) {
    if (!tower) {
      selection.id = -1;
      return;
    }
    if (selection.id !== tower.id) selection.t = 0;
    selection.id = tower.id;
    selection.color.set(tower.arch.color);
  }

  /** @param {{ x: number, z: number, radius: number } | null} cursor */
  function setAbilityCursor(cursor) {
    if (!cursor || !(cursor.radius > 0)) {
      ability.active = false;
      return;
    }
    ability.active = true;
    ability.x = cursor.x;
    ability.z = cursor.z;
    ability.radius = cursor.radius;
  }

  /**
   * @param {Tower} tower
   * @param {THREE.Vector3} out
   * @returns {boolean}
   */
  function muzzleOf(tower, out) {
    const view = towerViews.get(tower.id);
    if (!view || !view.drawn) {
      out.set(tower.x, MUZZLE_HEIGHT, tower.z);
      return false;
    }
    out.copy(view.muzzle);
    return true;
  }

  /**
   * @param {Enemy} enemy
   * @param {THREE.Vector3} out
   * @returns {THREE.Vector3}
   */
  function enemyCenter(enemy, out) {
    const view = enemyViews.get(enemy.id);
    if (view && !view.fresh) return out.set(view.x, view.centerY, view.z);
    for (let i = 0; i < dying.length; i++) {
      const ghost = dying[i];
      if (ghost.id === enemy.id) return out.set(ghost.x, ghost.centerY, ghost.z);
    }
    const spec = getModel(enemy.def.model);
    return out.set(enemy.x, enemyBaseY(enemy) + spec.bounds.height * 0.5 * (enemy.def.scale ?? 1), enemy.z);
  }

  /** @param {Quality} quality */
  function setQuality(quality) {
    shadows = quality !== 'low';
    for (const inst of instanceList) {
      inst.castShadow = shadows;
      for (const entry of inst.meshes) if (entry.matte) entry.matte.castShadow = shadows;
    }
  }

  function dispose() {
    clearViews();
    env.scene.remove(group);
    for (const inst of instanceList) inst.dispose();
    instanceList.length = 0;
    instances.clear();
    for (const inst of markerList) inst.dispose();
    decals.dispose();
    shells.dispose();
    bars.dispose();
    previewMaterials.matte.dispose();
    previewMaterials.glow.dispose();
    previewObjects.clear();
  }

  return { group, bind, handleEvents, update, setBuildPreview, setSelectedTower, setAbilityCursor, muzzleOf, enemyCenter, setQuality, dispose };
}
