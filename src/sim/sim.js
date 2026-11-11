// @ts-check
// Deterministische Simulation einer Partie: Zustand, Zeitschritt, Befehle, Speichern und Laden.
// Verbindliche Regeln: docs/SIM.md. Vertrag: src/types/sim.d.ts.
//
// Zum Aufbau:
// - Alles lebt in der Closure von createSim(); nach außen gehen genau die Felder des Vertrags `Sim`.
// - Zufall kommt nur aus makeRng(config.seed). Kein Math.random, kein Date. Eine Map dient hier nur zum Nachschlagen
//   und wird nie durchlaufen, damit keine fremde Reihenfolge in den Verlauf einfließt.
// - Gerechnet wird nur mit + - * / und Math.sqrt (alle exakt gerundet), damit der Verlauf auf jeder Maschine derselbe ist.
// - In step() entstehen außer Ereignissen, neuen Gegnern, Geschossen und Bodenfeldern keine Objekte.
// - Gegner, Türme, Geschosse und Bodenfelder teilen sich einen Zähler für Kennungen; alle Listen bleiben nach Kennung geordnet.

import { hashString, makeRng } from '../util/rng.js';
import { samplePath, tileX, tileZ } from './path.js';
import * as rules from './rules.js';
import { checkContent, checkSave, checkSavedBoons, checkSavedRecipes, checkSavedTower } from './validate.js';

/** @import { AbilityDef, BoonDef, Content, EnemyDef, TargetMode, TowerArchetypeDef, TowerStats, WaveModifierDef } from '../types/content' */
/** @import { CommandResult, Enemy, FuseRecipeInfo, GameStats, PathMark, Projectile, RejectReason, SaveData, Sim, SimConfig, SimEvent, SimState, Tower, WavePreview, Zone } from '../types/sim' */
/** @import { BoonEffects, EnemyStats } from './rules.js' */
/** @import { PathCurve } from './path.js' */

/** Länge eines Zeitschritts in Sekunden. */
export const SIM_DT = 1 / 60;
/** Sekunden nach dem Anbruch eines Zeitalters, in denen sich keine Welle starten lässt. */
export const AGE_LOCK = 5;

/**
 * Toleranz für Uhren und Zeitvergleiche in Sekunden. Was beim Herunterzählen darunter fällt, gilt als abgelaufen;
 * so entscheiden nicht Rundungsreste von 1/60 darüber, ob etwas einen Zeitschritt früher oder später geschieht.
 */
const EPS = 1e-9;
/** Größter seitlicher Versatz eines Gegners zur Wegmitte in Feldern. */
const LANE = 0.28;
/** Um so viele Felder steht jeder weitere ausgesetzte Gegner eines Trägers weiter hinten. */
const CARGO_GAP = 0.25;
/** Faktor je Sprung einer Kette. */
const CHAIN_FALLOFF = 0.7;
/** Kürzeste Flugzeit eines Geschosses in Sekunden. */
const MIN_FLIGHT = 0.05;
/** Sekunden zwischen zwei Ereignissen `heal` desselben Heilers. */
const HEAL_EVENT_INTERVAL = 1;
/** Sekunden ohne Treffer, nach denen die Selbstheilung einsetzt. */
const REGEN_DELAY = 1;
/** Höchste Ausbaustufe. */
const MAX_LEVEL = rules.MAX_LEVEL;
/** Holt niemand die Ereignisse ab (Bots, Tests), wird die Liste ab dieser Länge verworfen, statt endlos zu wachsen. */
const EVENT_LIMIT = 20000;
/** Angebot an Zeitgaben, wenn `balance.boons` fehlt. */
const DEFAULT_OFFER = 3;
/** Wellen mit Eigenart je Zeitalter, wenn `balance.modifiers` fehlt. */
const DEFAULT_PER_AGE = 2;
/** Ab so vielen Gegnern in einer Gruppe gilt eine Welle als Schwarm (`WaveModifierDef.needs` 'swarm'). */
const SWARM = 8;
/** Kürzeste Restdauer eines übergesprungenen Brands in Sekunden. */
const SPREAD_MIN_TIME = 1;
/** Rückstoß: So lange (Sekunden) lässt sich ein Gegner nach einem Rückstoß nicht erneut zurückwerfen. */
const PUSH_GUARD = 1;
/** Rückstoß auf Bosse und Zwischenbosse: dieser Anteil. */
const PUSH_BOSS = 0.5;
/** Sucher: Eine Wirkung, die noch länger als so viele Sekunden hält, gilt als „trägt sie schon“. */
const SEEK_MARGIN = 0.5;

/** Feld ist Weg in irgendeiner erreichbaren Stufe der Karte (jetzt, früher oder künftig): nicht bebaubar. */
const TILE_PATH = 1;
const TILE_BLOCKED = 2;
/** @type {readonly PathCurve[]} */
const NO_PATHS = Object.freeze([]);

/** @type {readonly TargetMode[]} */
const TARGET_MODES = ['first', 'last', 'strong', 'weak', 'near'];
/** @type {readonly (keyof GameStats)[]} */
const TALLY_KEYS = ['kills', 'leaks', 'goldEarned', 'goldSpent', 'towersBuilt', 'towersSold', 'upgrades', 'modernizations', 'damageDealt', 'abilitiesUsed', 'perfectWaves', 'fusions', 'megas'];

/**
 * Gegner mit den internen Zusatzfeldern der Simulation. Wer den Zustand nur liest, braucht sie nie.
 * @typedef {Enemy & {
 *   baseSpeed: number,
 *   killer: number,
 *   dotOwner: number,
 *   burnTick: number,
 *   healClock: number,
 *   hurt: number,
 *   hurtShield: boolean,
 *   mark: number,
 *   vuln: number,
 *   vulnTime: number,
 *   pushAt: number,
 * }} SimEnemy
 * `baseSpeed` = Grundtempo aus `enemyStats` (ohne Verlangsamung und Schub);
 * `killer` = Kennung des Turms, dem der Abschuss gehört (-1 = keinem, z. B. Fähigkeit);
 * `dotOwner` = Turm, der den Schaden über Zeit zuletzt gesetzt hat (-1 = keiner);
 * `burnTick` = Zeitschritt, in dem der Gegner zuletzt gebrannt hat (-1 = nie);
 * `healClock` = Sekunden, bis dieser Heiler wieder ein Ereignis `heal` melden darf;
 * `hurt`/`hurtShield` = seit dem letzten Ereignis `damage` aufgelaufener Schaden und ob der Schild etwas abfing;
 * `mark` = Laufnummer der Kette, die diesen Gegner zuletzt getroffen hat;
 * `vuln`/`vulnTime` = Zeichen (mehr Schaden) und seine Restdauer; `pushAt` = `age` beim letzten Rückstoß (-Infinity = nie).
 */

/**
 * Beim Abschuss festgehaltene Werte eines Schusses.
 * @typedef {object} ShotValues
 * @property {number} towerId Kennung des Schützen oder -1 (Fähigkeit)
 * @property {TowerArchetypeDef} arch
 * @property {number} tier
 * @property {number} damage Schaden einschließlich Aura-Bonus
 * @property {number} splash
 * @property {number} slow
 * @property {number} slowDuration
 * @property {number} dot Schaden über Zeit je Sekunde einschließlich Aura-Bonus
 * @property {number} dotDuration
 * @property {number} pierce
 * @property {number} chain
 * @property {number} chainRange
 * @property {number} zone Dauer des Bodenfelds am Einschlagpunkt (0 = keines)
 * @property {number} push Rückstoß in Feldern (0 = keiner)
 * @property {number} mark Zeichen: Anteil mehr Schaden (0 = keins)
 * @property {number} markDuration
 * @property {boolean} hitsAir
 * @property {boolean} hitsGround
 */

/**
 * Geschoss mit den internen Zusatzfeldern der Simulation: die festgehaltenen Werte des Schusses und das verfolgte Ziel
 * als Objekt (null, sobald es nicht mehr lebt).
 * @typedef {Projectile & ShotValues & { target: SimEnemy | null }} SimProjectile
 */

/**
 * Bodenfeld mit den Werten, die es an Bodengegner weitergibt.
 * @typedef {Zone & { slow: number, slowDuration: number, dot: number, dotDuration: number }} SimZone
 */

/**
 * Turm im Spielstand: die Felder des Vertrags plus freiwillige Zusatzfelder, mit denen eine geladene Partie
 * bitgenau wie die ungespeicherte weiterläuft. Fehlen sie, gelten Kennungen in Listenreihenfolge und ein Turm in Ruhe.
 * `lastShot` ist null, wenn der Turm noch nie gefeuert hat (JSON kennt kein -Infinity).
 * @typedef {SaveData['towers'][number] & {
 *   id?: number,
 *   cooldown?: number,
 *   lastShot?: number | null,
 *   targetId?: number,
 *   aimX?: number,
 *   aimZ?: number,
 *   aimFlying?: boolean,
 *   beamTime?: number,
 * }} SavedTower
 */

/**
 * Fliegendes Geschoss im Spielstand (freiwilliges Zusatzfeld `projectiles`): die Felder des Geschosses, die Rolle als Kennung.
 * Rückstoß und Zeichen stehen nur darin, wenn sie nicht 0 sind (ältere Spielstände bleiben gleich).
 * @typedef {Omit<Projectile, 'arch'> & Omit<ShotValues, 'arch' | 'push' | 'mark' | 'markDuration'> & { arch: string, push?: number, mark?: number, markDuration?: number }} SavedProjectile
 */

/**
 * Spielstand, wie ihn `save()` liefert: der Vertrag `SaveData` plus freiwillige Zusatzfelder
 * (`tick`, `buildTime`, `lock`, `projectiles` und je Turm die Felder von `SavedTower`).
 * `createSim` lädt auch Spielstände ohne diese Zusatzfelder.
 * @typedef {Omit<SaveData, 'towers'> & {
 *   towers: SavedTower[],
 *   tick?: number,
 *   buildTime?: number,
 *   lock?: number,
 *   projectiles?: SavedProjectile[],
 * }} SimSave
 */

/**
 * Eigenschaften einer Welle, nach denen Eigenarten gezogen werden (`WaveModifierDef.needs`).
 * @param {Content} content
 * @param {import('../types/content').WaveDef} wave
 * @returns {{ boss: boolean, flying: boolean, ground: boolean, armored: boolean, shielded: boolean, swarm: boolean }}
 */
function waveTraits(content, wave) {
  const traits = { boss: false, flying: false, ground: false, armored: false, shielded: false, swarm: false };
  for (const group of wave.groups) {
    const def = content.enemies[group.enemy];
    if (!def || group.count <= 0) continue;
    if (def.boss) {
      traits.boss = true;
      continue;
    }
    if (def.flying) traits.flying = true;
    else traits.ground = true;
    if (def.armor > 0) traits.armored = true;
    if (def.shield > 0) traits.shielded = true;
    if (group.count >= SWARM) traits.swarm = true;
  }
  return traits;
}

/**
 * Zieht die Eigenarten der Wellen einer Partie (docs/SIM.md, „Wellen mit Eigenart“): je Zeitalter bis zu `perAge` Wellen,
 * nie die erste eines Zeitalters, nie eine mit Boss, nur Eigenarten, deren `needs` die Welle erfüllt. Eigener Zufallsgenerator
 * aus dem Startwert, damit der Spielstand nichts davon tragen muss und der Zufall der Partie unberührt bleibt.
 * @param {Content} content
 * @param {number} seed
 * @returns {string[]} je fortlaufender Welle die Kennung der Eigenart oder ''
 */
export function drawModifiers(content, seed) {
  /** @type {string[]} */
  const out = [];
  for (let age = 0; age < content.waves.length; age++) for (let w = 0; w < content.waves[age].length; w++) out.push('');
  const all = content.modifiers;
  if (!all) return out;
  const ids = Object.keys(all);
  if (ids.length === 0) return out;
  const perAge = content.balance.modifiers ? content.balance.modifiers.perAge : DEFAULT_PER_AGE;
  const draw = makeRng(hashString(`eigenart:${seed >>> 0}`));
  let first = 0;
  for (let age = 0; age < content.waves.length; age++) {
    const list = content.waves[age];
    /** @type {{ index: number, fits: string[] }[]} */
    const candidates = [];
    for (let w = 1; w < list.length; w++) {
      const traits = waveTraits(content, list[w]);
      if (traits.boss) continue;
      const fits = ids.filter((id) => (all[id].needs || []).every((need) => traits[need]));
      if (fits.length > 0) candidates.push({ index: first + w, fits });
    }
    /** @type {{ index: number, fits: string[] }[]} */
    const chosen = [];
    for (let k = 0; k < perAge && candidates.length > 0; k++) {
      const at = Math.floor(draw.next() * candidates.length);
      chosen.push(candidates[at]);
      candidates.splice(at, 1);
    }
    chosen.sort((a, b) => a.index - b.index);
    /** @type {string[]} */
    const used = [];
    for (const wave of chosen) {
      const fresh = wave.fits.filter((id) => !used.includes(id));
      const pool = fresh.length > 0 ? fresh : wave.fits;
      let total = 0;
      for (const id of pool) total += all[id].weight ?? 1;
      let r = draw.next() * total;
      let pick = pool[pool.length - 1];
      for (const id of pool) {
        r -= all[id].weight ?? 1;
        if (r < 0) {
          pick = id;
          break;
        }
      }
      used.push(pick);
      out[wave.index] = pick;
    }
    first += list.length;
  }
  return out;
}

/**
 * Eine Gruppe gleicher Gegner einer Welle, fertig aufgelöst.
 * @typedef {object} WaveGroup
 * @property {EnemyDef} def
 * @property {number} count
 * @property {number} interval
 * @property {number} delay
 * @property {number} path Index des Weges oder -1 = reihum durch alle Wege
 */

/**
 * Eine Welle des Feldzugs, fertig aufgelöst.
 * @typedef {object} WaveInfo
 * @property {number} age
 * @property {number} waveInAge
 * @property {WaveGroup[]} groups
 * @property {number} count Anzahl aller Gegner der Welle
 * @property {boolean} boss
 * @property {WavePreview} preview
 * @property {string} modifier Kennung der Eigenart oder ''
 */

/**
 * Löst alle Wellen des Feldzugs in fortlaufender Reihenfolge auf.
 * @param {Content} content Geprüfte Inhalte
 * @param {(age: number) => number} stageOf Stufe der Wege im Zeitalter (für die Vorschau)
 * @param {readonly string[]} mods Eigenart je fortlaufender Welle oder ''
 * @returns {WaveInfo[]}
 */
function buildWaveTable(content, stageOf, mods) {
  /** @type {WaveInfo[]} */
  const table = [];
  for (let age = 0; age < content.waves.length; age++) {
    for (let waveInAge = 0; waveInAge < content.waves[age].length; waveInAge++) {
      const wave = content.waves[age][waveInAge];
      const modifier = rules.modifierDef(content, mods[table.length]);
      const many = modifier && modifier.enemy && modifier.enemy.count !== undefined ? modifier.enemy.count : 1;
      const manyAir = modifier && modifier.air && modifier.air.count !== undefined ? modifier.air.count : 1;
      /** @type {WaveGroup[]} */
      const groups = [];
      /** @type {{ def: EnemyDef, count: number, first: number, order: number }[]} */
      const kinds = [];
      let count = 0;
      let boss = false;
      for (let g = 0; g < wave.groups.length; g++) {
        const group = wave.groups[g];
        const def = content.enemies[group.enemy];
        // Eigenart mit `count`: mehr (oder weniger) Gegner je Gruppe in derselben Zeit; Bosse bleiben, wie sie sind.
        const factor = def.boss ? 1 : many * (def.flying ? manyAir : 1);
        const n = factor === 1 || group.count === 0 ? group.count : Math.max(1, Math.round(group.count * factor));
        const interval = n === group.count || n <= 1 ? group.interval : (group.interval * (group.count - 1)) / (n - 1);
        groups.push({ def, count: n, interval, delay: group.delay, path: group.path === undefined || group.path === null ? -1 : group.path });
        if (n === 0) continue;
        count += n;
        if (def.boss) boss = true;
        let kind = kinds.find((candidate) => candidate.def === def);
        if (!kind) {
          kind = { def, count: 0, first: group.delay, order: g };
          kinds.push(kind);
        }
        kind.count += n;
        if (group.delay < kind.first) kind.first = group.delay;
      }
      // Vorschau: je Gegnerart eine Zeile, geordnet nach dem ersten Erscheinen (bei Gleichstand nach der Stelle in `groups`).
      kinds.sort((a, b) => a.first - b.first || a.order - b.order);
      /** @type {WavePreview} */
      const preview = { wave: table.length, age, waveInAge, boss, hint: wave.hint || '', groups: kinds.map((kind) => Object.freeze({ def: kind.def, count: kind.count })), stage: stageOf(age) };
      if (modifier) preview.modifier = mods[table.length];
      Object.freeze(preview.groups);
      Object.freeze(preview);
      table.push({ age, waveInAge, groups, count, boss, preview, modifier: modifier ? mods[table.length] : '' });
    }
  }
  return table;
}

/**
 * Flugbahn zu einem Weg: die gerade Strecke vom ersten zum letzten Wegpunkt als Kurve mit zwei Stützpunkten.
 * `tiles` nennt nur Eingang und Basis, denn die Luftlinie belegt keine Felder.
 * @param {readonly (readonly [number, number])[]} waypoints
 * @param {number} width
 * @param {number} height
 * @returns {PathCurve}
 */
function buildAirPath(waypoints, width, height) {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const xs = new Float32Array([tileX(first[0], width), tileX(last[0], width)]);
  const zs = new Float32Array([tileZ(first[1], height), tileZ(last[1], height)]);
  const ds = new Float32Array(2);
  const dx = xs[1] - xs[0];
  const dz = zs[1] - zs[0];
  ds[1] = Math.sqrt(dx * dx + dz * dz);
  if (!(ds[1] > 0)) throw new Error('Eingang und Basis eines Weges liegen auf demselben Feld: Es gibt keine Luftlinie');
  return { xs, zs, ds, length: ds[1], tiles: [[first[0], first[1]], [last[0], last[1]]] };
}

/**
 * Strecke auf der Kurve, deren Punkt der Stelle (x, z) am nächsten liegt (bei Gleichstand die frühere).
 * @param {PathCurve} curve
 * @param {number} x
 * @param {number} z
 * @returns {number}
 */
function nearestDist(curve, x, z) {
  const { xs, zs, ds } = curve;
  let best = 0;
  let bestD2 = Infinity;
  for (let i = 0; i + 1 < xs.length; i++) {
    const ex = xs[i + 1] - xs[i];
    const ez = zs[i + 1] - zs[i];
    const len2 = ex * ex + ez * ez;
    let t = len2 > 0 ? ((x - xs[i]) * ex + (z - zs[i]) * ez) / len2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = xs[i] + ex * t - x;
    const dz = zs[i] + ez * t - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = ds[i] + (ds[i + 1] - ds[i]) * t;
    }
  }
  return best;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Zählt eine Uhr um einen Zeitschritt herunter; Reste unterhalb der Toleranz gelten als abgelaufen.
 * @param {number} seconds
 * @returns {number}
 */
function runDown(seconds) {
  const rest = seconds - SIM_DT;
  return rest < EPS ? 0 : rest;
}

/**
 * Erzeugt eine Partie.
 * @param {SimConfig} config
 * @param {SaveData | null} [save] Spielstand aus `Sim.save()`; ohne ihn beginnt eine neue Partie
 * @returns {Sim}
 */
export function createSim(config, save) {
  if (typeof config !== 'object' || config === null) throw new Error('createSim braucht eine SimConfig');
  const content = config.content;
  const checked = checkContent(content, config.mapId, config.difficulty);
  const map = checked.map;
  const diff = checked.difficulty;
  const balance = content.balance;
  const width = map.width;
  const height = map.height;
  const unlockAll = config.unlockAll === true;
  const rng = makeRng(config.seed);

  // --- Wege und ihre Stufen ---------------------------------------------------------------------
  // Eine Karte mit `map.stages` wechselt ihre Wege beim Zeitalterwechsel. Erreichbar sind nur Stufen vor dem letzten Zeitalter
  // der Partie; jede bringt einen Satz Wege samt Flugbahnen mit. `paths` und `airPaths` sind die Listen des Vertrags: dieselben
  // Objekte über die ganze Partie, ihr Inhalt wechselt (switchPaths).
  const ageCount = content.ages.length;
  const sets = checked.sets.filter((set) => set.from < ageCount);
  /** Je erreichbarem Satz die Kurven der Wege (eingefroren, für stagePaths). @type {(readonly PathCurve[])[]} */
  const setPaths = sets.map((set) => Object.freeze(set.paths.slice()));
  /** Je erreichbarem Satz die Flugbahnen: die gerade Luftlinie je Weg oder, wenn Flieger dem Weg folgen, der Weg selbst. @type {(readonly PathCurve[])[]} */
  const setAirPaths = sets.map((set) => {
    /** @type {PathCurve[]} */
    const air = [];
    for (let p = 0; p < set.paths.length; p++) {
      if (set.follow) {
        air.push(set.paths[p]);
        continue;
      }
      try {
        air.push(buildAirPath(set.waypoints[p], width, height));
      } catch (error) {
        throw new Error(`Karte "${map.id}"${set.from > 0 ? `, Stufe ${set.from}` : ''}, Weg ${p}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return Object.freeze(air);
  });
  /** Zeitalter, ab denen ein Satz Wege gilt (Sim.pathStages). */
  const pathStages = Object.freeze(sets.map((set) => set.from));
  /**
   * Index des Satzes, der im Zeitalter `age` gilt.
   * @param {number} age
   * @returns {number}
   */
  const setOfAge = (age) => {
    let index = 0;
    for (let i = 1; i < sets.length; i++) if (sets[i].from <= age) index = i;
    return index;
  };
  /** Index des jetzt geltenden Satzes in `sets`. */
  let activeSet = 0;
  /** Kurven aller Wege, die jetzt gelten. @type {PathCurve[]} */
  const paths = setPaths[0].slice();
  /** Flugbahnen dazu. @type {PathCurve[]} */
  const airPaths = setAirPaths[0].slice();

  // --- Feste Tabellen -------------------------------------------------------------------------

  /** Je Feld: TILE_PATH (Weg in irgendeiner erreichbaren Stufe) und/oder TILE_BLOCKED. */
  const tileFlags = new Uint8Array(width * height);
  /** Je Feld: Bit i gesetzt = das Feld gehört zum Satz Wege i (für pathMark). */
  const tileSets = new Uint32Array(width * height);
  /**
   * @param {number} tx
   * @param {number} tz
   */
  const inField = (tx, tz) => Number.isInteger(tx) && Number.isInteger(tz) && tx >= 0 && tx < width && tz >= 0 && tz < height;
  for (let set = 0; set < sets.length; set++) {
    const list = sets[set].paths;
    for (let p = 0; p < list.length; p++) {
      const tiles = list[p].tiles;
      for (let i = 0; i < tiles.length; i++) {
        if (!inField(tiles[i][0], tiles[i][1])) continue;
        const index = tiles[i][1] * width + tiles[i][0];
        tileFlags[index] |= TILE_PATH;
        tileSets[index] |= 1 << set;
      }
    }
  }
  for (let i = 0; i < map.blocked.length; i++) {
    if (inField(map.blocked[i][0], map.blocked[i][1])) tileFlags[map.blocked[i][1] * width + map.blocked[i][0]] |= TILE_BLOCKED;
  }
  // Die Basis ist das gemeinsame Endfeld aller Wege. Liegt sie im Spielfeld, sind ihre acht Nachbarfelder ihr Platz.
  const baseTile = paths[0].tiles[paths[0].tiles.length - 1];
  if (inField(baseTile[0], baseTile[1])) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx !== 0 || dz !== 0) && inField(baseTile[0] + dx, baseTile[1] + dz)) tileFlags[(baseTile[1] + dz) * width + baseTile[0] + dx] |= TILE_BLOCKED;
      }
    }
  }
  /** Je Feld die Art des besonderen Bauplatzes (Schlüssel in balance.tiles) oder ''. Geprüft in validate.js. @type {string[]} */
  const tileKinds = new Array(width * height).fill('');
  const specialTiles = map.tiles || [];
  for (let i = 0; i < specialTiles.length; i++) tileKinds[specialTiles[i].tz * width + specialTiles[i].tx] = specialTiles[i].kind;
  /** Ort für Gold ohne eigenen Schauplatz (Prämien, Geschenke): die Basis. */
  const baseX = tileX(baseTile[0], width);
  const baseZ = tileZ(baseTile[1], height);
  /** Je Feld der Turm, der dort steht. @type {(Tower | null)[]} */
  const towerGrid = new Array(width * height).fill(null);

  /** Eigenart je fortlaufender Welle, gezogen aus dem Startwert. */
  const waveMods = drawModifiers(content, config.seed);
  const waves = buildWaveTable(content, (age) => sets[setOfAge(age)].from, waveMods);
  const total = waves.length;
  let maxGroups = 0;
  for (let i = 0; i < total; i++) if (waves[i].groups.length > maxGroups) maxGroups = waves[i].groups.length;
  /** Je Gruppe der laufenden Welle: Anzahl der schon Erschienenen. */
  const spawned = new Int32Array(maxGroups);
  /** Wellenprämie und Makellos-Zuschlag je Zeitalter. */
  const waveBonusByAge = content.ages.map((_, age) => rules.waveBonus(content, age, diff));
  const perfectBonusByAge = content.ages.map((_, age) => rules.perfectBonus(content, age, diff));

  /** @type {Map<string, TowerArchetypeDef>} */
  const archById = new Map();
  for (let i = 0; i < content.archetypes.length; i++) archById.set(content.archetypes[i].id, content.archetypes[i]);
  /**
   * Bewaffnung der Partie (Sim.loadout): je Platz eine Waffe. Ein Spielstand bringt seine mit (ältere: die klassische), sonst gilt
   * `config.loadout` (ohne Angabe die klassische, 'random' die Ziehung aus dem Startwert mit eigenem Zufall).
   */
  const loadout = Object.freeze(pickLoadout());
  /** @returns {string[]} */
  function pickLoadout() {
    if (save === undefined || save === null) return rules.resolveLoadout(content, config.loadout, config.seed);
    const saved = /** @type {unknown} */ (/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (save)).loadout);
    if (saved === undefined || saved === null) return rules.classicLoadout(content);
    try {
      return rules.orderLoadout(content, /** @type {string[]} */ (saved));
    } catch (error) {
      throw new Error(`Spielstand unlesbar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /** Regeln des Verschmelzens; ohne sie (ältere Inhalte) gibt es keine Superwaffen. */
  const fusionRule = balance.fusion || null;
  /** true: Der Aufrufer wählt Zeitgaben selbst (SimConfig.boonChoice); sonst nimmt die Simulation sofort die erste angebotene. */
  const boonChoice = config.boonChoice === true;
  const boonOfferSize = balance.boons ? balance.boons.offer : DEFAULT_OFFER;
  /** Zeitalter, deren Wellen Flieger bringen, je fortlaufender Welle: ob ab hier noch Flieger kommen. */
  const fliersFrom = new Uint8Array(waves.length + 1);
  for (let i = waves.length - 1; i >= 0; i--) fliersFrom[i] = fliersFrom[i + 1] || (waves[i].groups.some((g) => g.def.flying && g.count > 0) ? 1 : 0);

  // --- Zustand --------------------------------------------------------------------------------

  /** @type {SimEnemy[]} */
  const enemies = [];
  /** @type {Tower[]} */
  const towers = [];
  /** @type {SimProjectile[]} */
  const projectiles = [];
  /** @type {SimZone[]} */
  const zones = [];
  /** Türme mit Kopfgeld-Aura (`auraBounty > 0`), neu bei jedem `refreshAuras`. @type {Tower[]} */
  const bankers = [];
  /** Gewählte Zeitgaben (auch `tower.boons` jedes Turms). @type {string[]} */
  const boonList = [];
  /** Offenes Angebot. @type {string[]} */
  const boonOffer = [];
  /** In dieser Partie freigeschaltete Rezepte (SimState.recipes). @type {string[]} */
  const recipeList = [];
  /** Zusammengefasste Wirkung der Zeitgaben. */
  let effects = rules.boonEffects(content, boonList);
  /** Die Fähigkeit je Zeitalter mit den Änderungen der Zeitgaben (neu nach jeder Wahl). @type {AbilityDef[]} */
  let abilityDefs = content.abilities.slice();
  /** Eigenart der laufenden Welle, wenn sie Türme verändert, sonst ''. */
  let towerModifier = '';
  /** @type {GameStats} */
  const tally = { kills: 0, leaks: 0, goldEarned: 0, goldSpent: 0, towersBuilt: 0, towersSold: 0, upgrades: 0, modernizations: 0, damageDealt: 0, abilitiesUsed: 0, perfectWaves: 0, fusions: 0, megas: 0 };
  /** @type {SimState} */
  const state = {
    time: 0,
    tick: 0,
    phase: 'build',
    gold: Math.round(balance.startGold * diff.gold),
    lives: diff.lives,
    maxLives: diff.lives,
    score: 0,
    wave: 0,
    age: waves[0].age,
    waveInAge: waves[0].waveInAge,
    buildTime: 0,
    lock: 0,
    pending: 0,
    abilityCooldown: 0,
    enemies,
    towers,
    projectiles,
    zones,
    stats: tally,
    boons: boonList,
    boonOffer,
    modifier: '',
    recipes: recipeList,
  };

  /** Nächste freie Kennung; Türme, Gegner, Geschosse und Bodenfelder teilen sich einen Zähler. */
  let nextId = 1;
  /** @type {SimEvent[]} */
  let events = [];
  /** Zeitschritte seit dem Start der laufenden Welle. */
  let waveTick = 0;
  /** Leben beim Start der laufenden Welle (für `perfect`). */
  let livesAtWaveStart = state.lives;
  /** Laufnummer der letzten Kette (siehe SimEnemy.mark). */
  let chainStamp = 0;
  /** Gegnerwerte der laufenden Welle je Gegnerart. @type {Map<EnemyDef, EnemyStats>} */
  const waveStats = new Map();
  /** Ausgesetzte Gegner (Fracht, Momente), bis sie hinten an die Gegnerliste kommen. @type {SimEnemy[]} */
  const cargo = [];
  /** Wiederverwendetes Ergebnis von samplePath. */
  const sample = { x: 0, z: 0, dx: 0, dz: 0 };
  /** Wiederverwendete Werte für Schüsse ohne Geschoss (hitscan, beam, pulse, Fähigkeit). @type {ShotValues} */
  const shot = { towerId: -1, arch: content.archetypes[0], tier: 0, damage: 0, splash: 0, slow: 0, slowDuration: 0, dot: 0, dotDuration: 0, pierce: 0, chain: 0, chainRange: 0, zone: 0, push: 0, mark: 0, markDuration: 0, hitsAir: true, hitsGround: true };

  // Schnappschuss der Gegner für Zielwahl und Bodenfelder: Lage und Flugeigenschaft je Listenplatz. Er wird nach Schritt 3
  // aufgenommen und gilt bis zum Aufräumen, denn so lange ändern sich weder die Lagen noch die Plätze in der Gegnerliste.
  let capacity = 256;
  let ex = new Float64Array(capacity);
  let ez = new Float64Array(capacity);
  let ef = new Uint8Array(capacity);
  /** Anzahl der Gegner im Schnappschuss (0 = keiner aufgenommen). */
  let snapCount = 0;
  // Raster über dem Schnappschuss, damit ein Turm nur die Gegner in seiner Nähe ansehen muss: Zellen von einem Feld Kantenlänge,
  // rundum ein Feld Rand; was weiter draußen liegt, zählt zur Randzelle. Die Listenplätze stehen nach Zellen sortiert in
  // `cellItems`; die Zelle c belegt dort die Stellen cellStart[c] bis cellStart[c + 1] - 1. Nebeneinanderliegende Zellen einer
  // Zeile bilden also einen zusammenhängenden Abschnitt.
  const gridW = width + 2;
  const gridH = height + 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const cellStart = new Int32Array(gridW * gridH + 1);
  const cellFill = new Int32Array(gridW * gridH);
  let cellItems = new Int32Array(capacity);
  let ecell = new Int32Array(capacity);

  // --- Kleine Helfer --------------------------------------------------------------------------

  /** @param {SimEvent} event */
  function emit(event) {
    events.push(event);
  }

  /** @returns {CommandResult} */
  function accept() {
    return { ok: true };
  }

  /**
   * @param {RejectReason} reason
   * @returns {CommandResult}
   */
  function reject(reason) {
    return { ok: false, reason };
  }

  function isOver() {
    return state.phase === 'won' || state.phase === 'lost';
  }

  /**
   * Turm zu einer Kennung (die Liste ist nach Kennung geordnet).
   * @param {number} id
   * @returns {Tower | null}
   */
  function findTower(id) {
    let lo = 0;
    let hi = towers.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const tower = towers[mid];
      if (tower.id === id) return tower;
      if (tower.id < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }

  /**
   * Gegner zu einer Kennung (die Liste ist nach Kennung geordnet).
   * @param {number} id
   * @returns {SimEnemy | null}
   */
  function findEnemy(id) {
    let lo = 0;
    let hi = enemies.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const enemy = enemies[mid];
      if (enemy.id === id) return enemy;
      if (enemy.id < id) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }

  /**
   * Warum auf dem Feld nicht gebaut werden kann, oder null.
   * @param {number} tx
   * @param {number} tz
   * @returns {RejectReason | null}
   */
  function siteProblem(tx, tz) {
    if (!inField(tx, tz)) return 'outside';
    const index = tz * width + tx;
    if (tileFlags[index] & TILE_PATH) return 'path';
    if (tileFlags[index] & TILE_BLOCKED) return 'blocked';
    if (towerGrid[index] !== null) return 'occupied';
    return null;
  }

  /**
   * Setzt die Wege des Satzes `set` in Kraft (Inhalt von `paths` und `airPaths`). Nur ohne lebende Gegner aufrufen: Gegner merken
   * sich den Index ihres Weges, nicht die Kurve.
   * @param {number} set
   */
  function switchPaths(set) {
    activeSet = set;
    paths.length = 0;
    airPaths.length = 0;
    const list = setPaths[set];
    const air = setAirPaths[set];
    for (let i = 0; i < list.length; i++) {
      paths.push(list[i]);
      airPaths.push(air[i]);
    }
  }

  /** @returns {number} Stufe, deren Wege jetzt gelten */
  function pathStage() {
    return sets[activeSet].from;
  }

  /**
   * @param {number} stage
   * @returns {readonly PathCurve[]}
   */
  function stagePaths(stage) {
    return Number.isInteger(stage) && stage >= 0 ? setPaths[setOfAge(stage)] : NO_PATHS;
  }

  /**
   * @param {number} stage
   * @returns {readonly PathCurve[]}
   */
  function stageAirPaths(stage) {
    return Number.isInteger(stage) && stage >= 0 ? setAirPaths[setOfAge(stage)] : NO_PATHS;
  }

  /**
   * @param {number} tx
   * @param {number} tz
   * @returns {PathMark}
   */
  function pathMark(tx, tz) {
    if (!inField(tx, tz)) return '';
    const mask = tileSets[tz * width + tx];
    if (mask === 0) return '';
    if (mask & (1 << activeSet)) return 'path';
    return mask >>> (activeSet + 1) !== 0 ? 'future' : 'former';
  }

  // --- Gegner ---------------------------------------------------------------------------------

  /**
   * Kurve, auf der sich ein Gegner dieser Art auf dem Weg `path` bewegt.
   * @param {EnemyDef} def
   * @param {number} path
   * @returns {PathCurve}
   */
  function curveFor(def, path) {
    return def.flying ? airPaths[path] : paths[path];
  }

  /**
   * Setzt Lage, Richtung und Fortschritt eines Gegners aus `dist` und `lane`.
   * @param {SimEnemy} enemy
   * @param {PathCurve} curve
   */
  function place(enemy, curve) {
    samplePath(curve, enemy.dist, sample);
    enemy.dx = sample.dx;
    enemy.dz = sample.dz;
    enemy.x = sample.x - sample.dz * enemy.lane;
    enemy.z = sample.z + sample.dx * enemy.lane;
    enemy.progress = enemy.dist >= curve.length ? 1 : enemy.dist / curve.length;
  }

  /**
   * Erzeugt einen Gegner mit den Werten der laufenden Welle; in die Gegnerliste trägt ihn der Aufrufer ein.
   * Bosse laufen in der Wegmitte und verbrauchen keine Zufallszahl.
   * @param {EnemyDef} def
   * @param {number} path Index des Weges
   * @param {number} dist Zurückgelegte Strecke beim Erscheinen
   * @returns {SimEnemy}
   */
  function makeEnemy(def, path, dist) {
    let values = waveStats.get(def);
    if (values === undefined) {
      values = rules.enemyStats(content, def, state.age, state.waveInAge, diff);
      const modifier = rules.modifierDef(content, state.modifier);
      if (modifier || effects.bounty !== 1) values = rules.modifiedEnemyStats(values, def, modifier, effects.bounty);
      waveStats.set(def, values);
    }
    /** @type {SimEnemy} */
    const enemy = {
      id: nextId++,
      def,
      hp: values.hp,
      maxHp: values.hp,
      shield: values.shield,
      maxShield: values.shield,
      armor: values.armor,
      path,
      dist,
      progress: 0,
      lane: def.boss ? 0 : rng.range(-LANE, LANE),
      x: 0,
      z: 0,
      px: 0,
      pz: 0,
      dx: 1,
      dz: 0,
      speed: values.speed,
      slow: 0,
      slowTime: 0,
      dot: 0,
      dotTime: 0,
      sinceHit: Infinity,
      age: 0,
      bounty: values.bounty,
      phase: 0,
      boost: 1,
      boostTime: 0,
      alive: true,
      baseSpeed: values.speed,
      killer: -1,
      dotOwner: -1,
      burnTick: -1,
      healClock: 0,
      hurt: 0,
      hurtShield: false,
      mark: 0,
      vuln: 0,
      vulnTime: 0,
      pushAt: -Infinity,
    };
    place(enemy, curveFor(def, path));
    enemy.px = enemy.x;
    enemy.pz = enemy.z;
    return enemy;
  }

  /**
   * Setzt Gegner an der Stelle von `parent` aus (Fracht eines Trägers, Moment eines Bosses): gleicher Weg, gleiche Strecke,
   * jeder weitere ein Stück weiter hinten. Bewegt sich die Fracht auf einer anderen Kurve als ihr Träger (Flieger setzt
   * Läufer aus oder umgekehrt), beginnt sie an der Stelle ihrer Kurve, die dem Träger am nächsten liegt.
   * Die Neuen warten in `cargo`, bis der Aufrufer sie an die Gegnerliste hängt.
   * @param {SimEnemy} parent
   * @param {{ enemy: string, count: number }} load
   */
  function release(parent, load) {
    const def = content.enemies[load.enemy];
    const curve = curveFor(def, parent.path);
    const from = curve === curveFor(parent.def, parent.path) ? parent.dist : nearestDist(curve, parent.x, parent.z);
    for (let k = 0; k < load.count; k++) {
      const dist = from - CARGO_GAP * k;
      const child = makeEnemy(def, parent.path, dist > 0 ? dist : 0);
      cargo.push(child);
      emit({ type: 'spawn', enemy: child });
    }
  }

  /** Hängt die wartenden ausgesetzten Gegner hinten an die Gegnerliste (ihre Kennungen sind die größten). */
  function admitCargo() {
    for (let i = 0; i < cargo.length; i++) enemies.push(cargo[i]);
    cargo.length = 0;
  }

  /** Schritt 2: lässt alle fälligen Gegner der laufenden Welle erscheinen (Gruppen in Listenreihenfolge). */
  function spawnDue() {
    const groups = waves[state.wave].groups;
    const now = waveTick * SIM_DT + EPS;
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      let k = spawned[g];
      while (k < group.count && group.delay + k * group.interval <= now) {
        const enemy = makeEnemy(group.def, group.path >= 0 ? group.path : k % paths.length, 0);
        enemies.push(enemy);
        state.pending -= 1;
        emit({ type: 'spawn', enemy });
        k += 1;
      }
      spawned[g] = k;
    }
  }

  /**
   * Schaden über Zeit für einen Zeitschritt: erst Schild, dann Lebenspunkte, ohne Rüstung und ohne `sinceHit` anzutasten.
   * Auf verlangsamte Gegner wirkt er mit `balance.burnOnSlowed`. Schaden und Abschuss zählen für den Turm, der den Effekt
   * zuletzt gesetzt hat.
   * @param {SimEnemy} enemy
   */
  function burn(enemy) {
    let rest = enemy.dot * (enemy.slow > 0 ? balance.burnOnSlowed + effects.burnOnSlowed : 1) * SIM_DT;
    if (enemy.def.flying) rest *= effects.airDamage;
    if (enemy.def.boss) rest *= effects.bossDamage;
    if (enemy.vuln > 0) rest *= 1 + enemy.vuln;
    let dealt = 0;
    enemy.burnTick = state.tick;
    if (enemy.shield > 0) {
      const absorbed = enemy.shield < rest ? enemy.shield : rest;
      enemy.shield -= absorbed;
      rest -= absorbed;
      dealt = absorbed;
      if (absorbed > 0) enemy.hurtShield = true;
    }
    if (rest > 0) {
      const lost = enemy.hp < rest ? enemy.hp : rest;
      enemy.hp -= lost;
      dealt += lost;
    }
    if (dealt <= 0) return;
    const owner = findTower(enemy.dotOwner);
    enemy.hurt += dealt;
    tally.damageDealt += dealt;
    if (owner !== null) owner.damageDealt += dealt;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      enemy.killer = enemy.dotOwner;
      if (owner !== null) owner.kills += 1;
    }
  }

  /**
   * Heilt alle lebenden, nicht brennenden Gegner der Listenplätze [from, to) im Umkreis des Heilers.
   * „Brennend“ heißt: hat in diesem Zeitschritt gebrannt oder wird es noch (wer später an der Reihe ist).
   * @param {SimEnemy} healer
   * @param {number} from
   * @param {number} to
   * @param {number} radius2 Quadrat des Radius
   * @param {number} share Anteil der maximalen Lebenspunkte je Zeitschritt
   * @returns {boolean} ob jemand geheilt wurde
   */
  function healRange(healer, from, to, radius2, share) {
    let healed = false;
    const tick = state.tick;
    for (let j = from; j < to; j++) {
      const other = enemies[j];
      if (!other.alive || other.hp >= other.maxHp || other.dotTime > 0 || other.burnTick === tick) continue;
      const dx = other.x - healer.x;
      const dz = other.z - healer.z;
      if (dx * dx + dz * dz > radius2) continue;
      const hp = other.hp + share * other.maxHp;
      other.hp = hp < other.maxHp ? hp : other.maxHp;
      healed = true;
    }
    return healed;
  }

  /**
   * Schritt 3: Gegner in Reihenfolge ihrer Kennung. Durchgekommene werden dabei aus der Liste verdichtet;
   * die Plätze [0, kept) sind schon behandelt und behalten, die Plätze hinter `i` noch unberührt.
   * @returns {boolean} false, wenn die Partie dabei verloren ging (der Zeitschritt endet dann sofort)
   */
  function stepEnemies() {
    const count = enemies.length;
    let kept = 0;
    for (let i = 0; i < count; i++) {
      const enemy = enemies[i];
      if (enemy.alive) {
        const def = enemy.def;
        enemy.sinceHit += SIM_DT;
        enemy.age += SIM_DT;

        // Verlangsamung und Tempo-Schub laufen ab.
        if (enemy.slowTime > 0) enemy.slowTime = runDown(enemy.slowTime);
        if (enemy.slowTime === 0) enemy.slow = 0;
        if (enemy.boostTime > 0) enemy.boostTime = runDown(enemy.boostTime);
        if (enemy.boostTime === 0) enemy.boost = 1;
        enemy.speed = enemy.baseSpeed * enemy.boost * (1 - enemy.slow);
        if (enemy.vulnTime > 0) {
          enemy.vulnTime = runDown(enemy.vulnTime);
          if (enemy.vulnTime === 0) enemy.vuln = 0;
        }

        // Schaden über Zeit. Wer in diesem Zeitschritt brennt, heilt nicht und lädt nicht.
        const burning = enemy.dotTime > 0;
        if (burning) {
          burn(enemy);
          enemy.dotTime = runDown(enemy.dotTime);
          if (enemy.dotTime === 0) enemy.dot = 0;
        }

        if (enemy.alive) {
          if (!burning) {
            // Selbstheilung
            if (def.regen > 0 && enemy.hp < enemy.maxHp && enemy.sinceHit >= REGEN_DELAY - EPS) {
              const hp = enemy.hp + def.regen * enemy.maxHp * SIM_DT;
              enemy.hp = hp < enemy.maxHp ? hp : enemy.maxHp;
            }
            // Schild
            if (enemy.shield < enemy.maxShield && enemy.sinceHit >= balance.shieldDelay - EPS) {
              const shield = enemy.shield + (enemy.maxShield / balance.shieldRecharge) * SIM_DT;
              enemy.shield = shield < enemy.maxShield ? shield : enemy.maxShield;
            }
          }

          // Heiler
          const heal = def.heal;
          if (heal) {
            if (enemy.healClock > 0) enemy.healClock = runDown(enemy.healClock);
            const radius2 = heal.radius * heal.radius;
            const share = heal.perSecond * SIM_DT;
            const before = healRange(enemy, 0, kept, radius2, share);
            const after = healRange(enemy, i + 1, count, radius2, share);
            if ((before || after) && enemy.healClock === 0) {
              enemy.healClock = HEAL_EVENT_INTERVAL;
              emit({ type: 'heal', enemy });
            }
          }

          // Momente: Jede Schwelle tritt einmal ein, mehrere in einem Zeitschritt nacheinander.
          const phases = def.phases;
          if (phases) {
            while (enemy.phase < phases.length && enemy.hp <= phases[enemy.phase].at * enemy.maxHp) {
              const moment = phases[enemy.phase];
              const index = enemy.phase;
              enemy.phase += 1;
              emit({ type: 'phase', enemy, index });
              if (moment.spawns) release(enemy, moment.spawns);
              if (moment.speed !== undefined && moment.speed > 0) {
                enemy.boost = moment.speed;
                enemy.boostTime = moment.duration !== undefined && moment.duration > 0 ? moment.duration : 0;
                if (enemy.boostTime === 0) enemy.boost = 1;
                enemy.speed = enemy.baseSpeed * enemy.boost * (1 - enemy.slow);
              }
            }
          }

          // Bewegung
          const curve = def.flying ? airPaths[enemy.path] : paths[enemy.path];
          enemy.px = enemy.x;
          enemy.pz = enemy.z;
          enemy.dist += enemy.speed * SIM_DT;
          place(enemy, curve);

          if (enemy.dist >= curve.length - EPS) {
            // Durchgekommen: kostet Leben, bringt kein Kopfgeld und verlässt die Liste sofort.
            enemy.alive = false;
            const lost = def.lives < state.lives ? def.lives : state.lives;
            state.lives -= lost;
            tally.leaks += 1;
            emit({ type: 'leak', enemy, lives: lost });
            if (state.lives <= 0) {
              for (let j = i + 1; j < count; j++) enemies[kept++] = enemies[j];
              enemies.length = kept;
              admitCargo();
              state.phase = 'lost';
              emit({ type: 'lost' });
              return false;
            }
            continue;
          }
        }
      }
      enemies[kept++] = enemy;
    }
    enemies.length = kept;
    admitCargo();
    return true;
  }

  // --- Treffer --------------------------------------------------------------------------------

  /**
   * Regel 4: Verlangsamung. Nur eine mindestens gleich starke ersetzt die laufende; schwächere verändern nichts.
   * @param {SimEnemy} enemy
   * @param {number} slow
   * @param {number} duration
   */
  function applySlow(enemy, slow, duration) {
    const effective = slow * (1 - enemy.def.slowResist);
    if (effective > 0 && effective >= enemy.slow) {
      enemy.slow = effective;
      if (duration > enemy.slowTime) enemy.slowTime = duration;
    }
  }

  /**
   * Regel 5: Schaden über Zeit. Erneuert sich, statt sich zu stapeln; der letzte Urheber wird gemerkt.
   * @param {SimEnemy} enemy
   * @param {number} dot Schaden je Sekunde einschließlich Aura-Bonus
   * @param {number} duration
   * @param {number} towerId
   */
  function applyDot(enemy, dot, duration, towerId) {
    if (dot > enemy.dot) enemy.dot = dot;
    if (duration > enemy.dotTime) enemy.dotTime = duration;
    enemy.dotOwner = towerId;
  }

  /**
   * Zeichen: Nur ein mindestens gleich starkes ersetzt das laufende; die Restdauer wächst auf die neue Dauer.
   * @param {SimEnemy} enemy
   * @param {number} mark
   * @param {number} duration
   */
  function applyMark(enemy, mark, duration) {
    if (mark >= enemy.vuln) {
      enemy.vuln = mark;
      if (duration > enemy.vulnTime) enemy.vulnTime = duration;
    }
  }

  /**
   * Rückstoß: wirft den Gegner auf seinem Weg zurück (Bosse um PUSH_BOSS), höchstens einmal je PUSH_GUARD Sekunden, nie vor den Anfang.
   * @param {SimEnemy} enemy Lebender Gegner
   * @param {number} push Felder
   * @param {number} towerId
   */
  function applyPush(enemy, push, towerId) {
    if (enemy.age - enemy.pushAt < PUSH_GUARD - EPS) return;
    const want = enemy.def.boss ? push * PUSH_BOSS : push;
    const distance = enemy.dist < want ? enemy.dist : want;
    enemy.pushAt = enemy.age;
    if (!(distance > 0)) return;
    const x = enemy.x;
    const z = enemy.z;
    enemy.dist -= distance;
    place(enemy, curveFor(enemy.def, enemy.path));
    enemy.px = enemy.x;
    enemy.pz = enemy.z;
    emit({ type: 'push', enemy, distance, towerId, x, z });
  }

  /**
   * Ein Treffer mit Rohschaden `raw` (Faktoren für Fläche und Kette sind schon eingerechnet).
   * @param {SimEnemy} enemy Lebender Gegner
   * @param {number} raw
   * @param {ShotValues} src Werte des Schusses
   * @param {Tower | null} tower Schütze, falls es ihn (noch) gibt
   */
  function applyHit(enemy, raw, src, tower) {
    let rest = raw;
    // Zeitgaben gegen Flieger und Bosse
    if (enemy.def.flying) rest *= effects.airDamage;
    if (enemy.def.boss) rest *= effects.bossDamage;
    // Zeichen eines anderen (früheren) Treffers
    if (enemy.vuln > 0) rest *= 1 + enemy.vuln;
    let dealt = 0;
    // 1. Schild
    if (enemy.shield > 0 && rest > 0) {
      const absorbed = enemy.shield < rest ? enemy.shield : rest;
      enemy.shield -= absorbed;
      rest -= absorbed;
      dealt = absorbed;
      enemy.hurtShield = true;
    }
    // 2. Lebenspunkte: Rüstung zieht ab, ein Mindestanteil kommt immer an.
    if (rest > 0) {
      const floor = rest * balance.minDamage;
      const reduced = rest - enemy.armor * (1 - src.pierce);
      let lost = reduced > floor ? reduced : floor;
      if (lost > enemy.hp) lost = enemy.hp;
      enemy.hp -= lost;
      dealt += lost;
    }
    // 3.
    enemy.sinceHit = 0;
    // 4. und 5.
    if (src.slow > 0) applySlow(enemy, src.slow, src.slowDuration);
    if (src.dot > 0) applyDot(enemy, src.dot, src.dotDuration, src.towerId);
    // Zeichen und Rückstoß der Waffen des Pools (nach dem Schaden: Der zeichnende Treffer selbst zählt noch ohne Zeichen).
    if (src.mark > 0) applyMark(enemy, src.mark, src.markDuration);
    if (src.push > 0 && enemy.hp > 0) applyPush(enemy, src.push, src.towerId);
    // 6. Buchführung
    if (dealt > 0) {
      enemy.hurt += dealt;
      tally.damageDealt += dealt;
      if (tower !== null) tower.damageDealt += dealt;
    }
    // 7. Tod; abgehandelt wird er beim Aufräumen.
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      enemy.killer = src.towerId;
      if (tower !== null) tower.kills += 1;
    }
  }

  /**
   * Kette: springt vom zuletzt Getroffenen zum nächsten noch nicht getroffenen, passenden lebenden Gegner
   * (bei gleichem Abstand zu dem mit der kleineren Kennung).
   * @param {SimEnemy} first Das zuerst getroffene Ziel
   * @param {ShotValues} src
   * @param {Tower | null} tower
   */
  function chainFrom(first, src, tower) {
    chainStamp += 1;
    first.mark = chainStamp;
    const range2 = src.chainRange * src.chainRange;
    let last = first;
    let factor = 1;
    for (let jump = 0; jump < src.chain; jump++) {
      /** @type {SimEnemy | null} */
      let next = null;
      let best = 0;
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy.alive || enemy.mark === chainStamp || (enemy.def.flying ? !src.hitsAir : !src.hitsGround)) continue;
        const dx = enemy.x - last.x;
        const dz = enemy.z - last.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > range2) continue;
        if (next === null || d2 < best) {
          next = enemy;
          best = d2;
        }
      }
      if (next === null) break;
      factor *= CHAIN_FALLOFF;
      next.mark = chainStamp;
      emit({ type: 'chain', arch: src.arch, tier: src.tier, fromX: last.x, fromZ: last.z, toX: next.x, toZ: next.z, flying: next.def.flying });
      applyHit(next, src.damage * factor, src, tower);
      last = next;
    }
  }

  /**
   * Einschlag am Punkt (x, z) mit dem Ziel `target`.
   * @param {number} x
   * @param {number} z
   * @param {SimEnemy | null} target Ziel des Schusses; null, wenn es nicht mehr lebt
   * @param {ShotValues} src
   * @param {Tower | null} tower Schütze, falls es ihn (noch) gibt
   * @param {boolean} flying Ob das Ziel flog (für die Darstellung)
   */
  function impact(x, z, target, src, tower, flying) {
    const radius = src.splash;
    if (radius > 0) {
      const radius2 = radius * radius;
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy.alive || (enemy.def.flying ? !src.hitsAir : !src.hitsGround)) continue;
        const dx = enemy.x - x;
        const dz = enemy.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius2) continue;
        applyHit(enemy, src.damage * (1 - (0.5 * Math.sqrt(d2)) / radius), src, tower);
      }
    } else if (target !== null && target.alive) {
      applyHit(target, src.damage, src, tower);
      if (src.chain > 0) chainFrom(target, src, tower);
    }
    if (src.zone > 0) {
      /** @type {SimZone} */
      const zone = {
        id: nextId++,
        arch: src.arch,
        tier: src.tier,
        towerId: src.towerId,
        x,
        z,
        radius,
        time: src.zone,
        duration: src.zone,
        slow: src.slow,
        slowDuration: src.slowDuration,
        dot: src.dot,
        dotDuration: src.dotDuration,
      };
      zones.push(zone);
      emit({ type: 'zone', zone });
    }
    emit({ type: 'hit', arch: src.arch, tier: src.tier, x, z, flying, splash: radius });
  }

  // --- Türme ----------------------------------------------------------------------------------

  /** Berechnet alle Aura-Boni neu: je Bonusart zählt der stärkste andere Spender in dessen unverstärkter Reichweite. */
  function refreshAuras() {
    bankers.length = 0;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      if ((tower.stats.auraBounty || 0) > 0) bankers.push(tower);
      tower.buffDamage = 0;
      tower.buffRate = 0;
      tower.buffRange = 0;
    }
    for (let i = 0; i < towers.length; i++) {
      const giver = towers[i];
      const s = giver.stats;
      if (!(s.auraDamage > 0 || s.auraRate > 0 || s.auraRange > 0)) continue;
      const range2 = s.range * s.range;
      for (let j = 0; j < towers.length; j++) {
        if (j === i) continue;
        const tower = towers[j];
        const dx = tower.x - giver.x;
        const dz = tower.z - giver.z;
        if (dx * dx + dz * dz > range2) continue;
        if (s.auraDamage > tower.buffDamage) tower.buffDamage = s.auraDamage;
        if (s.auraRate > tower.buffRate) tower.buffRate = s.auraRate;
        if (s.auraRange > tower.buffRange) tower.buffRange = s.auraRange;
      }
    }
  }

  /**
   * Ob der Gegner für den Turm ein gültiges Ziel ist.
   * @param {Tower} tower
   * @param {SimEnemy} enemy
   * @param {number} range Wirksame Reichweite
   */
  function isValidTarget(tower, enemy, range) {
    const s = tower.stats;
    if (!enemy.alive || (enemy.def.flying ? !s.hitsAir : !s.hitsGround)) return false;
    const dx = enemy.x - tower.x;
    const dz = enemy.z - tower.z;
    const d2 = dx * dx + dz * dz;
    return d2 <= range * range && d2 >= s.minRange * s.minRange;
  }

  /**
   * Ob ein Bodengegner in einem liegenden Bodenfeld steht (Flieger stehen in keinem).
   * @param {SimEnemy} enemy
   */
  function inZone(enemy) {
    if (enemy.def.flying) return false;
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const dx = enemy.x - zone.x;
      const dz = enemy.z - zone.z;
      if (dx * dx + dz * dz <= zone.radius * zone.radius) return true;
    }
    return false;
  }

  /**
   * Sucher: ob der Gegner die Wirkung des Turms schon trägt (noch länger als SEEK_MARGIN), bzw. nach einem Rückstoß noch geschützt ist.
   * @param {SimEnemy} enemy
   * @param {TowerStats} s Werte des Turms
   */
  function carries(enemy, s) {
    if (s.dot > 0 && enemy.dotTime > SEEK_MARGIN) return true;
    if (s.slow > 0 && enemy.slowTime > SEEK_MARGIN) return true;
    if ((s.mark || 0) > 0 && enemy.vulnTime > SEEK_MARGIN) return true;
    if ((s.push || 0) > 0 && enemy.age - enemy.pushAt < PUSH_GUARD) return true;
    return false;
  }

  /**
   * Nimmt den Schnappschuss der Gegner auf und sortiert ihre Listenplätze in das Raster ein (Zählsortierung, ohne neue Objekte).
   */
  function snapshotEnemies() {
    const count = enemies.length;
    snapCount = count;
    if (count > capacity) {
      while (capacity < count) capacity *= 2;
      ex = new Float64Array(capacity);
      ez = new Float64Array(capacity);
      ef = new Uint8Array(capacity);
      cellItems = new Int32Array(capacity);
      ecell = new Int32Array(capacity);
    }
    cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const enemy = enemies[i];
      const x = enemy.x;
      const z = enemy.z;
      ex[i] = x;
      ez[i] = z;
      ef[i] = enemy.def.flying ? 1 : 0;
      let cx = Math.floor(x + halfW) + 1;
      let cz = Math.floor(z + halfH) + 1;
      if (cx < 0) cx = 0;
      else if (cx >= gridW) cx = gridW - 1;
      if (cz < 0) cz = 0;
      else if (cz >= gridH) cz = gridH - 1;
      const cell = cz * gridW + cx;
      ecell[i] = cell;
      cellStart[cell + 1] += 1;
    }
    const cells = gridW * gridH;
    for (let c = 0; c < cells; c++) {
      cellFill[c] = cellStart[c];
      cellStart[c + 1] += cellStart[c];
    }
    for (let i = 0; i < count; i++) cellItems[cellFill[ecell[i]]++] = i;
  }

  /**
   * Erste Rasterspalte (bzw. -zeile), in der ein Gegner mit der Koordinate `v` liegen kann.
   * @param {number} v Weltkoordinate
   * @param {number} half Halbe Ausdehnung des Spielfelds in dieser Richtung
   * @param {number} size Anzahl der Rasterzellen in dieser Richtung
   */
  function cellOf(v, half, size) {
    const c = Math.floor(v + half) + 1;
    return c < 0 ? 0 : c >= size ? size - 1 : c;
  }

  /**
   * Zielwahl nach dem Modus des Turms über den Schnappschuss der Gegner. Bei Gleichstand gewinnt die kleinere Kennung
   * (das ist der kleinere Listenplatz, denn die Liste ist nach Kennung geordnet).
   * Ein Turm, der Bodenfelder legt, nimmt den Besten unter denen, die in keinem Feld stehen, solange es einen gibt; ein Sucher
   * (`seek`) ebenso unter denen, die seine Wirkung nicht tragen (`carries`).
   * @param {Tower} tower
   * @param {number} range Wirksame Reichweite
   * @returns {SimEnemy | null}
   */
  function selectTarget(tower, range) {
    const s = tower.stats;
    const x = tower.x;
    const z = tower.z;
    const range2 = range * range;
    const min2 = s.minRange * s.minRange;
    const air = s.hitsAir;
    const ground = s.hitsGround;
    const mode = tower.mode;
    const kind = mode === 'first' ? 0 : mode === 'last' ? 1 : mode === 'strong' ? 2 : mode === 'weak' ? 3 : 4;
    const prefer = s.zone > 0 && zones.length > 0;
    const seek = s.seek === true;
    let best = -1;
    let bestKey = 0;
    let free = -1;
    let freeKey = 0;
    const cx0 = cellOf(x - range, halfW, gridW);
    const cx1 = cellOf(x + range, halfW, gridW);
    const cz0 = cellOf(z - range, halfH, gridH);
    const cz1 = cellOf(z + range, halfH, gridH);
    for (let cz = cz0; cz <= cz1; cz++) {
      const row = cz * gridW;
      const end = cellStart[row + cx1 + 1];
      for (let n = cellStart[row + cx0]; n < end; n++) {
        const i = cellItems[n];
        const dx = ex[i] - x;
        const dz = ez[i] - z;
        const d2 = dx * dx + dz * dz;
        if (d2 > range2 || d2 < min2) continue;
        if (ef[i] === 1 ? !air : !ground) continue;
        const enemy = enemies[i];
        if (!enemy.alive) continue;
        let key;
        if (kind === 0) key = enemy.progress;
        else if (kind === 1) key = -enemy.progress;
        else if (kind === 2) key = enemy.hp + enemy.shield;
        else if (kind === 3) key = -(enemy.hp + enemy.shield);
        else key = -d2;
        if (best === -1 || key > bestKey || (key === bestKey && i < best)) {
          best = i;
          bestKey = key;
        }
        if ((prefer || seek) && (free === -1 || key > freeKey || (key === freeKey && i < free)) && !(prefer && inZone(enemy)) && !(seek && carries(enemy, s))) {
          free = i;
          freeKey = key;
        }
      }
    }
    return free !== -1 ? enemies[free] : best !== -1 ? enemies[best] : null;
  }

  /**
   * Überträgt die Werte eines Turms in die wiederverwendeten Schusswerte.
   * @param {Tower} tower
   * @param {number} damage Schaden dieses Schusses einschließlich Aura-Bonus
   */
  function loadShot(tower, damage) {
    const s = tower.stats;
    shot.towerId = tower.id;
    shot.arch = tower.arch;
    shot.tier = tower.tier;
    shot.damage = damage;
    shot.splash = s.splash;
    shot.slow = s.slow;
    shot.slowDuration = s.slowDuration;
    shot.dot = s.dot * (1 + tower.buffDamage);
    shot.dotDuration = s.dotDuration;
    shot.pierce = s.pierce;
    shot.chain = s.chain;
    shot.chainRange = s.chainRange;
    shot.zone = s.zone;
    shot.push = s.push || 0;
    shot.mark = s.mark || 0;
    shot.markDuration = s.markDuration || 0;
    shot.hitsAir = s.hitsAir;
    shot.hitsGround = s.hitsGround;
  }

  /**
   * Der Turm feuert auf sein Ziel.
   * @param {Tower} tower
   * @param {SimEnemy} target
   * @param {number} range Wirksame Reichweite
   */
  function fire(tower, target, range) {
    const s = tower.stats;
    const damage = s.damage * (1 + tower.buffDamage);
    let period = s.cooldown;
    tower.lastShot = state.time;
    emit({ type: 'shot', tower, targetId: target.id, x: target.x, z: target.z, flying: target.def.flying });
    switch (s.attack) {
      case 'projectile': {
        const dx = target.x - tower.x;
        const dz = target.z - tower.z;
        const flight = s.projectileSpeed > 0 ? Math.sqrt(dx * dx + dz * dz) / s.projectileSpeed : 0;
        projectiles.push({
          id: nextId++,
          towerId: tower.id,
          arch: tower.arch,
          tier: tower.tier,
          sx: tower.x,
          sz: tower.z,
          tx: target.x,
          tz: target.z,
          targetId: target.id,
          targetFlying: target.def.flying,
          t: 0,
          pt: 0,
          duration: flight > MIN_FLIGHT ? flight : MIN_FLIGHT,
          damage,
          splash: s.splash,
          slow: s.slow,
          slowDuration: s.slowDuration,
          dot: s.dot * (1 + tower.buffDamage),
          dotDuration: s.dotDuration,
          pierce: s.pierce,
          chain: s.chain,
          chainRange: s.chainRange,
          zone: s.zone,
          push: s.push || 0,
          mark: s.mark || 0,
          markDuration: s.markDuration || 0,
          hitsAir: s.hitsAir,
          hitsGround: s.hitsGround,
          target,
        });
        break;
      }
      case 'hitscan':
        loadShot(tower, damage);
        impact(target.x, target.z, target, shot, tower, target.def.flying);
        break;
      case 'beam': {
        // Der Schadenstakt ist stats.cooldown, mindestens aber ein Zeitschritt (schützt vor cooldown = 0).
        period = s.cooldown > SIM_DT ? s.cooldown : SIM_DT;
        let ramp = 0;
        if (s.ramp > 0) ramp = s.rampTime > 0 && tower.beamTime < s.rampTime ? (s.ramp * tower.beamTime) / s.rampTime : s.ramp;
        loadShot(tower, damage * period * (1 + ramp));
        impact(target.x, target.z, target, shot, tower, target.def.flying);
        break;
      }
      case 'pulse': {
        loadShot(tower, damage);
        const range2 = range * range;
        const min2 = s.minRange * s.minRange;
        for (let i = 0; i < snapCount; i++) {
          const dx = ex[i] - tower.x;
          const dz = ez[i] - tower.z;
          const d2 = dx * dx + dz * dz;
          if (d2 > range2 || d2 < min2) continue;
          if (ef[i] === 1 ? !s.hitsAir : !s.hitsGround) continue;
          const enemy = enemies[i];
          if (enemy.alive) applyHit(enemy, damage, shot, tower);
        }
        emit({ type: 'hit', arch: tower.arch, tier: tower.tier, x: tower.x, z: tower.z, flying: false, splash: range });
        break;
      }
      default:
        break;
    }
    tower.cooldown += period / (1 + tower.buffRate);
  }

  /** Schritt 4: Türme in Reihenfolge ihrer Kennung. */
  function stepTowers() {
    const count = snapCount;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      const s = tower.stats;
      if (s.attack === 'none') {
        tower.targetId = -1;
        continue;
      }
      // Die Feuerpause läuft herunter und bleibt bei höchstens 0 stehen, bis es ein Ziel gibt.
      if (tower.cooldown > EPS) tower.cooldown -= SIM_DT;
      if (count === 0) {
        tower.targetId = -1;
        tower.beamTime = 0;
        continue;
      }
      const range = s.range * (1 + tower.buffRange);
      /** @type {SimEnemy | null} */
      let target = null;
      if (s.attack === 'beam') {
        // Der Strahl hält sein Ziel, solange es gültig ist.
        if (tower.targetId !== -1) {
          const held = findEnemy(tower.targetId);
          if (held !== null && isValidTarget(tower, held, range)) target = held;
        }
        if (target !== null) {
          tower.beamTime += SIM_DT;
        } else {
          tower.beamTime = 0;
          target = selectTarget(tower, range);
        }
      } else {
        target = selectTarget(tower, range);
      }
      if (target === null) {
        tower.targetId = -1;
        continue;
      }
      tower.targetId = target.id;
      tower.aimX = target.x;
      tower.aimZ = target.z;
      tower.aimFlying = target.def.flying;
      if (tower.cooldown <= EPS) fire(tower, target, range);
    }
  }

  // --- Geschosse und Bodenfelder --------------------------------------------------------------

  /** Schritt 5a: Geschosse fliegen weiter und schlagen bei t >= 1 ein; fertige werden aus der Liste verdichtet. */
  function stepProjectiles() {
    const count = projectiles.length;
    let kept = 0;
    for (let i = 0; i < count; i++) {
      const p = projectiles[i];
      p.pt = p.t;
      p.t += SIM_DT / p.duration;
      const target = p.target;
      if (target !== null && target.alive) {
        p.tx = target.x;
        p.tz = target.z;
      } else if (p.targetId !== -1) {
        // Das Ziel lebt nicht mehr oder ist durchgekommen: Das Geschoss fliegt auf den letzten bekannten Punkt.
        p.target = null;
        p.targetId = -1;
      }
      if (p.t >= 1 - EPS) {
        p.t = 1;
        impact(p.tx, p.tz, p.target, p, findTower(p.towerId), p.targetFlying);
      } else {
        projectiles[kept++] = p;
      }
    }
    projectiles.length = kept;
  }

  /**
   * Schritt 5b: Jedes Bodenfeld gibt seine Verlangsamung und seinen Schaden über Zeit an die Bodengegner in seinem Radius
   * weiter (ohne Schaden und ohne `sinceHit` zu ändern), dann läuft seine Zeit ab; abgelaufene werden verdichtet.
   */
  function stepZones() {
    const count = zones.length;
    let kept = 0;
    for (let i = 0; i < count; i++) {
      const zone = zones[i];
      if (snapCount > 0 && (zone.slow > 0 || zone.dot > 0)) {
        const radius = zone.radius;
        const radius2 = radius * radius;
        const cx0 = cellOf(zone.x - radius, halfW, gridW);
        const cx1 = cellOf(zone.x + radius, halfW, gridW);
        const cz0 = cellOf(zone.z - radius, halfH, gridH);
        const cz1 = cellOf(zone.z + radius, halfH, gridH);
        for (let cz = cz0; cz <= cz1; cz++) {
          const row = cz * gridW;
          const end = cellStart[row + cx1 + 1];
          for (let n = cellStart[row + cx0]; n < end; n++) {
            const j = cellItems[n];
            if (ef[j] === 1) continue;
            const dx = ex[j] - zone.x;
            const dz = ez[j] - zone.z;
            if (dx * dx + dz * dz > radius2) continue;
            const enemy = enemies[j];
            if (!enemy.alive) continue;
            if (zone.slow > 0) applySlow(enemy, zone.slow, zone.slowDuration);
            if (zone.dot > 0) applyDot(enemy, zone.dot, zone.dotDuration, zone.towerId);
          }
        }
      }
      zone.time = runDown(zone.time);
      if (zone.time > 0) zones[kept++] = zone;
    }
    zones.length = kept;
  }

  // --- Aufräumen und Wellenende ---------------------------------------------------------------

  /** Schritt 6: meldet den Schaden dieses Zeitschritts, handelt Tote in Reihenfolge ihrer Kennung ab und verdichtet die Liste. */
  function cleanUp() {
    const count = enemies.length;
    let kept = 0;
    for (let i = 0; i < count; i++) {
      const enemy = enemies[i];
      if (enemy.hurt > 0) {
        emit({ type: 'damage', enemy, amount: enemy.hurt, shield: enemy.hurtShield });
        enemy.hurt = 0;
        enemy.hurtShield = false;
      }
      if (enemy.alive) {
        enemies[kept++] = enemy;
        continue;
      }
      const extra = bankers.length > 0 ? bountyExtra(enemy) : 0;
      const bounty = enemy.bounty + extra;
      state.gold += bounty;
      tally.goldEarned += bounty;
      tally.kills += 1;
      state.score += Math.round(10 * (state.age + 1) * enemy.def.bounty * diff.score);
      emit({ type: 'kill', enemy, bounty, towerId: enemy.killer });
      emit(extra > 0 ? { type: 'gold', amount: bounty, reason: 'bounty', x: enemy.x, z: enemy.z, extra } : { type: 'gold', amount: bounty, reason: 'bounty', x: enemy.x, z: enemy.z });
      if (effects.burnSpread > 0 && enemy.dot > 0 && enemy.dotTime > 0) spreadBurn(enemy);
      if (enemy.def.spawns) release(enemy, enemy.def.spawns);
    }
    enemies.length = kept;
    admitCargo();
  }

  /**
   * Kopfgeld-Aura: der Zuschlag (ganze Goldstücke) für einen Gegner, der hier stirbt; es zählt der stärkste Turm mit `auraBounty`,
   * dessen unverstärkte Reichweite die Lage des Gegners erreicht.
   * @param {SimEnemy} enemy
   * @returns {number}
   */
  function bountyExtra(enemy) {
    let best = 0;
    for (let i = 0; i < bankers.length; i++) {
      const s = bankers[i].stats;
      const share = s.auraBounty || 0;
      if (share <= best) continue;
      const dx = enemy.x - bankers[i].x;
      const dz = enemy.z - bankers[i].z;
      if (dx * dx + dz * dz <= s.range * s.range) best = share;
    }
    return best > 0 ? Math.round(enemy.bounty * best) : 0;
  }

  /**
   * Zeitgabe mit `burnSpread`: Der Brand eines sterbenden Gegners springt auf den nächsten lebenden Gegner im Radius über
   * (bei gleichem Abstand der mit der kleineren Kennung), mit seiner Stärke und Restdauer (mindestens SPREAD_MIN_TIME), für
   * denselben Urheber.
   * @param {SimEnemy} dead
   */
  function spreadBurn(dead) {
    const radius2 = effects.burnSpread * effects.burnSpread;
    /** @type {SimEnemy | null} */
    let next = null;
    let best = 0;
    for (let i = 0; i < enemies.length; i++) {
      const other = enemies[i];
      if (!other.alive) continue;
      const dx = other.x - dead.x;
      const dz = other.z - dead.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius2 || (next !== null && d2 >= best)) continue;
      next = other;
      best = d2;
    }
    if (next !== null) applyDot(next, dead.dot, dead.dotTime > SPREAD_MIN_TIME ? dead.dotTime : SPREAD_MIN_TIME, dead.dotOwner);
  }

  /**
   * Rechnet die Kampfwerte aller Türme neu (nach einer Zeitgabe oder beim Wechsel der Eigenart einer Welle) und dann die Auren.
   */
  function restatAll() {
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      tower.modifier = towerModifier;
      tower.stats = rules.towerStats(content, tower.arch, tower.tier, tower.level, tower);
    }
    refreshAuras();
  }

  /**
   * Zieht beim Zeitalterwechsel das Angebot an Zeitgaben aus dem Zufall der Partie: bis zu `balance.boons.offer` verschiedene,
   * noch nicht gewählte Gaben, deren `requires` erfüllt ist, gewichtet nach `weight`.
   */
  function offerBoons() {
    const all = content.boons;
    if (!all || all.length === 0) return;
    /** @type {BoonDef[]} */
    const pool = [];
    for (let i = 0; i < all.length; i++) {
      const boon = all[i];
      if (boonList.includes(boon.id)) continue;
      // Eine Gabe, die ein Rezept freischaltet, nur solange es gesperrt ist und nur, wenn die Bewaffnung es bauen kann.
      const unlocks = boon.effect ? boon.effect.recipe : undefined;
      if (unlocks !== undefined && (!recipeLocked(unlocks) || !rules.recipeFits(content, unlocks, loadout))) continue;
      const need = boon.requires;
      if (need) {
        if (need.fusion && !fusionRule) continue;
        if (need.weapons && !need.weapons.some((id) => loadout.includes(id))) continue;
        if (need.flying && !fliersFrom[state.wave]) continue;
        if (need.tiles && !(map.tiles || []).some((t) => /** @type {string[]} */ (need.tiles).includes(t.kind))) continue;
      }
      pool.push(boon);
    }
    boonOffer.length = 0;
    for (let k = 0; k < boonOfferSize && pool.length > 0; k++) {
      let total = 0;
      for (let i = 0; i < pool.length; i++) total += pool[i].weight ?? 1;
      let r = rng.next() * total;
      let at = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight ?? 1;
        if (r < 0) {
          at = i;
          break;
        }
      }
      const picked = pool[at];
      boonOffer.push(picked.id);
      pool.splice(at, 1);
      // Höchstens eine Rezept-Gabe je Angebot: Ist eine gezogen, fallen die übrigen aus dem Rest.
      if (picked.effect && picked.effect.recipe !== undefined) {
        for (let i = pool.length - 1; i >= 0; i--) if (pool[i].effect && pool[i].effect.recipe !== undefined) pool.splice(i, 1);
      }
    }
    if (boonOffer.length === 0) return;
    if (boonChoice) emit({ type: 'boonOffer', offer: boonOffer.slice() });
    else takeBoon(boonOffer[0]);
  }

  /**
   * Nimmt eine Zeitgabe: Liste, Angebot, einmalige Gaben, Werte aller Türme, Fähigkeit.
   * @param {string} id
   */
  function takeBoon(id) {
    const boon = /** @type {BoonDef} */ (rules.boonDef(content, id));
    boonList.push(id);
    boonOffer.length = 0;
    effects = rules.boonEffects(content, boonList);
    abilityDefs = content.abilities.map((def) => rules.boonAbility(def, effects));
    const grant = boon.effect.grant;
    if (grant) {
      const lives = grant.lives ?? 0;
      if (lives > 0) {
        state.lives += lives;
        state.maxLives += lives;
      } else if (lives < 0) {
        state.lives = state.lives + lives > 1 ? state.lives + lives : 1;
      }
      const gold = grant.gold ? Math.round(grant.gold * balance.baseBounty * balance.ageBounty[state.age] * diff.income) : 0;
      if (gold > 0) {
        state.gold += gold;
        tally.goldEarned += gold;
      }
      emit({ type: 'boon', id });
      if (gold > 0) emit({ type: 'gold', amount: gold, reason: 'boon', x: baseX, z: baseZ });
    } else {
      emit({ type: 'boon', id });
    }
    const unlocks = boon.effect.recipe;
    if (unlocks !== undefined && recipeLocked(unlocks)) unlockRecipe(unlocks, 'boon');
    restatAll();
  }

  /**
   * Ob ein Rezept dieser Kennung existiert, gesperrt ist und in dieser Partie noch nicht freigeschaltet wurde.
   * @param {string} id
   */
  function recipeLocked(id) {
    const found = rules.recipeById(content, id);
    return found !== null && found.recipe.locked === true && !recipeList.includes(id);
  }

  /**
   * Schaltet ein Rezept für den Rest der Partie frei. Stehende Superwaffen bleiben, was sie sind.
   * @param {string} id
   * @param {'boon' | 'boss'} reason
   */
  function unlockRecipe(id, reason) {
    recipeList.push(id);
    emit({ type: 'recipe', id, reason });
  }

  /**
   * Belohnung für einen Zwischenboss ohne Funkenverlust: ein noch gesperrtes Rezept, dessen `ages` die Position des Zeitalters
   * nennt, gezogen mit eigenem Zufall aus Startwert und Welle (der Zufall der Partie bleibt unberührt).
   * @param {number} wave Fortlaufender Index der überstandenen Welle
   * @param {number} age Position ihres Zeitalters
   */
  function bossRecipe(wave, age) {
    /** @type {string[]} */
    const pool = [];
    for (let a = 0; a < content.archetypes.length; a++) {
      const list = content.archetypes[a].fusion ? content.archetypes[a].fusion?.recipes : undefined;
      if (!list) continue;
      for (const recipe of list) {
        if (recipe.locked === true && recipe.ages !== undefined && recipe.ages.includes(age) && !recipeList.includes(recipe.id) && rules.recipeFits(content, recipe.id, loadout)) pool.push(recipe.id);
      }
    }
    if (pool.length === 0) return;
    const draw = makeRng(hashString(`rezept:${config.seed >>> 0}:${wave}`));
    unlockRecipe(pool[Math.floor(draw.next() * pool.length)], 'boss');
  }

  /** Schritt 7: Die laufende Welle ist überstanden. */
  function finishWave() {
    // Geschosse, deren Ziel nicht mehr lebt, vergessen es schon jetzt (das täte der nächste Zeitschritt ebenso), damit ein
    // Spielstand der Bauphase dem geladenen Zustand genau gleicht.
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.target !== null && !p.target.alive) {
        p.target = null;
        p.targetId = -1;
      }
    }
    const cleared = state.wave;
    const age = state.age;
    const perfect = state.lives === livesAtWaveStart;
    const modifier = rules.modifierDef(content, state.modifier);
    const bonusFactor = effects.waveBonus * (modifier && modifier.bonus !== undefined ? modifier.bonus : 1);
    const plain = waveBonusByAge[age] + (perfect ? perfectBonusByAge[age] : 0);
    const bonus = bonusFactor === 1 ? plain : Math.round(plain * bonusFactor);
    // Die Eigenart endet mit der Welle; Türme, die sie verändert hat, bekommen ihre Werte zurück.
    state.modifier = '';
    if (towerModifier !== '') {
      towerModifier = '';
      restatAll();
    }
    state.gold += bonus;
    tally.goldEarned += bonus;
    if (perfect) tally.perfectWaves += 1;
    state.score += Math.round(100 * (age + 1) * (perfect ? 1.5 : 1) * diff.score);
    if (bonus > 0) emit({ type: 'gold', amount: bonus, reason: 'wave', x: baseX, z: baseZ });
    emit({ type: 'waveClear', wave: cleared, bonus, perfect });
    // Zwischenboss (Welle mit Boss, nicht die letzte ihres Zeitalters) ohne Funkenverlust: ein Rezept wird frei.
    const info = waves[cleared];
    if (perfect && info.boss && cleared + 1 < total && waves[cleared + 1].age === age) bossRecipe(cleared, age);
    state.wave = cleared + 1;
    if (state.wave >= total) {
      state.phase = 'won';
      state.waveInAge = rules.waveAge(content, state.wave).waveInAge;
      state.score += Math.round(250 * state.lives * diff.score);
      emit({ type: 'won' });
      return;
    }
    const next = waves[state.wave];
    state.phase = 'build';
    state.buildTime = 0;
    state.waveInAge = next.waveInAge;
    if (next.age !== age) {
      const gift = rules.ageGift(content, next.age, diff);
      state.age = next.age;
      state.gold += gift;
      tally.goldEarned += gift;
      state.lock = AGE_LOCK;
      emit({ type: 'age', from: age, to: next.age, gift });
      // Wechsel der Wege: Es lebt kein Gegner, nichts läuft auf den alten Kurven.
      const set = setOfAge(next.age);
      if (set !== activeSet) {
        switchPaths(set);
        emit({ type: 'paths', stage: sets[set].from });
      }
      if (gift > 0) emit({ type: 'gold', amount: gift, reason: 'age', x: baseX, z: baseZ });
      offerBoons();
    }
  }

  // --- Zeitschritt ----------------------------------------------------------------------------

  function step() {
    if (isOver()) return;
    if (events.length > EVENT_LIMIT) events.length = 0;
    // 1. Uhren
    state.time += SIM_DT;
    state.tick += 1;
    if (state.lock > 0) state.lock = runDown(state.lock);
    if (state.abilityCooldown > 0) state.abilityCooldown = runDown(state.abilityCooldown);
    if (state.phase === 'build') {
      if (state.lock === 0) state.buildTime += SIM_DT;
    } else {
      // 2. Erscheinen
      waveTick += 1;
      spawnDue();
    }
    // 3. Gegner
    if (enemies.length > 0 && !stepEnemies()) return;
    // 4. Türme
    if (enemies.length > 0) snapshotEnemies();
    else snapCount = 0;
    stepTowers();
    // 5. Geschosse, dann Bodenfelder
    if (projectiles.length > 0) stepProjectiles();
    if (zones.length > 0) stepZones();
    // 6. Aufräumen
    if (enemies.length > 0) cleanUp();
    // 7. Wellenende
    if (state.phase === 'wave' && state.pending === 0 && enemies.length === 0) finishWave();
  }

  function drainEvents() {
    const drained = events;
    events = [];
    return drained;
  }

  // --- Auskünfte ------------------------------------------------------------------------------

  /**
   * @param {number} tx
   * @param {number} tz
   * @returns {CommandResult}
   */
  function canBuild(tx, tz) {
    if (isOver()) return reject('phase');
    const problem = siteProblem(tx, tz);
    return problem === null ? accept() : reject(problem);
  }

  /**
   * @param {string} archId
   * @param {number} [tx] Feld; mit Angabe zählt der Kostenfaktor eines besonderen Bauplatzes dort
   * @param {number} [tz]
   * @returns {number} Baukosten im aktuellen Zeitalter; -1 für eine unbekannte Rolle
   */
  function buildCostOf(archId, tx, tz) {
    const arch = archById.get(archId);
    if (!arch) return -1;
    return rules.boonPrice(rules.buildCost(content, arch, state.age, tx === undefined || tz === undefined ? '' : tileAt(tx, tz)), effects.build);
  }

  /**
   * @param {Tower} tower
   * @returns {number}
   */
  function upgradeCostOf(tower) {
    return rules.boonPrice(rules.upgradeCost(content, tower.arch, tower.tier, tower.level, tower.tile), effects.upgrade);
  }

  /**
   * @param {Tower} tower
   * @returns {number}
   */
  function modernizeCostOf(tower) {
    if (tower.tier >= state.age || !tower.arch.tiers[state.age]) return -1;
    return rules.boonPrice(rules.modernizeCost(content, tower.arch, state.age, tower.level, tower), effects.modernize);
  }

  /**
   * Gebühr des Verschmelzens mit diesem Turm als Kern; für eine Superwaffe die Gebühr des Schritts zur Megawaffe.
   * @param {Tower} tower
   * @returns {number}
   */
  function fuseCostOf(tower) {
    return rules.boonPrice(rules.fuseCost(content, tower.arch, tower.tier, tower.super, tower.tile), effects.fuse);
  }

  /**
   * Anzahl der Megawaffen, die gerade stehen.
   * @returns {number}
   */
  function megaCount() {
    let count = 0;
    for (let i = 0; i < towers.length; i++) if (towers[i].mega) count += 1;
    return count;
  }

  /**
   * Warum der Turm kein Kern sein kann, oder null. Eine Superwaffe ist Kern einer Megawaffe, solange sie keine ist
   * und die Höchstzahl der Megawaffen (`balance.fusion.megaLimit`) nicht erreicht ist.
   * @param {Tower} core
   * @returns {RejectReason | null}
   */
  function coreProblem(core) {
    if (!core.arch.fusion || !fusionRule) return 'super';
    if (core.super) {
      if (core.mega) return 'super';
      if (megaCount() >= rules.megaLimit(content, boonList)) return 'limit';
      return null;
    }
    if (core.level < MAX_LEVEL) return 'level';
    return null;
  }

  /**
   * Warum der Turm keine Zutat für diesen Kern sein kann, oder null.
   * @param {Tower} core
   * @param {Tower} part
   * @returns {RejectReason | null}
   */
  function partProblem(core, part) {
    if (part.super || !part.arch.fusion) return 'super';
    if (part.level < MAX_LEVEL) return 'level';
    if (part.tier !== core.tier) return 'tier';
    const dx = part.tx - core.tx;
    const dz = part.tz - core.tz;
    if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return 'adjacent';
    return null;
  }

  /**
   * Prüft das Verschmelzen in fester Reihenfolge: Kern (`unknown`, `super`, `level`; bei einer Superwaffe als Kern
   * `super` für eine Megawaffe, dann `limit`), Liste der Zutaten (`count`),
   * jede Zutat der Reihe nach (`unknown`, `super`, `level`, `tier`, `adjacent`), zuletzt die Gebühr (`gold`).
   * @param {number} coreId
   * @param {number[]} partIds
   * @returns {RejectReason | null}
   */
  function fuseProblem(coreId, partIds) {
    if (isOver()) return 'phase';
    const core = findTower(coreId);
    if (core === null) return 'unknown';
    const problem = coreProblem(core);
    if (problem !== null) return problem;
    if (!Array.isArray(partIds) || !fusionRule || partIds.length !== fusionRule.parts) return 'count';
    for (let i = 0; i < partIds.length; i++) {
      if (partIds[i] === coreId) return 'count';
      for (let j = 0; j < i; j++) if (partIds[j] === partIds[i]) return 'count';
    }
    for (let i = 0; i < partIds.length; i++) {
      const part = findTower(partIds[i]);
      if (part === null) return 'unknown';
      const flaw = partProblem(core, part);
      if (flaw !== null) return flaw;
    }
    if (state.gold < fuseCostOf(core)) return 'gold';
    return null;
  }

  /**
   * @param {number} coreId
   * @param {number[]} partIds
   * @returns {CommandResult}
   */
  function canFuse(coreId, partIds) {
    const problem = fuseProblem(coreId, partIds);
    return problem === null ? accept() : reject(problem);
  }

  /**
   * Türme, die jetzt Zutat für diesen Kern sein können, in Reihenfolge ihrer Kennung.
   * @param {number} coreId
   * @returns {Tower[]}
   */
  function fuseCandidates(coreId) {
    /** @type {Tower[]} */
    const list = [];
    if (isOver()) return list;
    const core = findTower(coreId);
    if (core === null || coreProblem(core) !== null) return list;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      if (tower !== core && partProblem(core, tower) === null) list.push(tower);
    }
    return list;
  }

  /**
   * @param {Tower} tower
   * @returns {number}
   */
  function sellValue(tower) {
    // Fehlkauf: Solange die Welle, vor der gebaut wurde, nicht begonnen hat, gibt es alles zurück.
    if (state.phase === 'build' && tower.builtWave === state.wave) return tower.invested;
    const share = balance.sellRefund * effects.sell;
    return Math.floor(tower.invested * (share < 1 ? share : 1) + EPS);
  }

  /**
   * @param {number} tx
   * @param {number} tz
   * @returns {Tower | null}
   */
  function towerAt(tx, tz) {
    if (!Number.isInteger(tx) || !Number.isInteger(tz) || tx < 0 || tx >= width || tz < 0 || tz >= height) return null;
    return towerGrid[tz * width + tx];
  }

  /**
   * @param {number} tx
   * @param {number} tz
   * @returns {string} Art des besonderen Bauplatzes oder ''
   */
  function tileAt(tx, tz) {
    return inField(tx, tz) ? tileKinds[tz * width + tx] : '';
  }

  /**
   * @param {number} [offset]
   * @returns {WavePreview | null}
   */
  /**
   * @param {number} coreId
   * @param {number[]} partIds
   * @returns {FuseRecipeInfo}
   */
  function fuseRecipe(coreId, partIds) {
    const core = findTower(coreId);
    if (core === null || !Array.isArray(partIds)) return { recipe: null, locked: null };
    if (core.super) return { recipe: rules.fusionRecipe(core.arch, core.gifts, core.recipe, content), locked: null };
    /** @type {string[]} */
    const gifts = [];
    for (let i = 0; i < partIds.length; i++) {
      const part = findTower(partIds[i]);
      if (part === null) return { recipe: null, locked: null };
      gifts.push(part.arch.id);
    }
    return { recipe: rules.fusionRecipe(core.arch, gifts, recipeList, content), locked: rules.lockedRecipe(core.arch, gifts, recipeList, content) };
  }

  function wavePreview(offset = 0) {
    const index = state.wave + offset;
    if (!Number.isInteger(index) || index < 0 || index >= total) return null;
    return waves[index].preview;
  }

  function earlyBonus() {
    if (state.phase !== 'build' || state.wave === 0) return 0;
    const span = balance.earlyBonusTime;
    const left = span > 0 ? 1 - state.buildTime / span : 0;
    if (!(left > 0)) return 0;
    const bonus = Math.round(waveBonusByAge[state.age] * balance.earlyBonus * left * effects.early);
    return bonus > 0 ? bonus : 0;
  }

  function ability() {
    return abilityDefs[state.age];
  }

  // --- Befehle --------------------------------------------------------------------------------

  /**
   * @param {string} archId
   * @param {number} tx
   * @param {number} tz
   * @returns {CommandResult}
   */
  function build(archId, tx, tz) {
    if (isOver()) return reject('phase');
    const arch = archById.get(archId);
    if (!arch) return reject('unknown');
    const age = state.age;
    if (!loadout.includes(archId) || (!unlockAll && state.wave < arch.unlockWave) || !arch.tiers[age]) return reject('locked');
    const problem = siteProblem(tx, tz);
    if (problem !== null) return reject(problem);
    const tile = tileKinds[tz * width + tx];
    const cost = rules.boonPrice(rules.buildCost(content, arch, age, tile), effects.build);
    if (state.gold < cost) return reject('gold');
    const x = tileX(tx, width);
    const z = tileZ(tz, height);
    /** @type {Tower} */
    const tower = {
      id: nextId++,
      arch,
      tier: age,
      level: 1,
      branch: -1,
      super: false,
      mega: false,
      gifts: [],
      giftBranches: [],
      recipe: '',
      tx,
      tz,
      tile,
      x,
      z,
      boons: boonList,
      modifier: towerModifier,
      stats: rules.towerStats(content, arch, age, 1, { tile, boons: boonList, modifier: towerModifier }),
      buffDamage: 0,
      buffRate: 0,
      buffRange: 0,
      mode: arch.defaultMode !== undefined ? arch.defaultMode : 'first',
      cooldown: 0,
      targetId: -1,
      aimX: x,
      aimZ: z + 1,
      aimFlying: false,
      lastShot: -Infinity,
      beamTime: 0,
      invested: cost,
      kills: 0,
      damageDealt: 0,
      builtWave: state.wave,
    };
    state.gold -= cost;
    tally.goldSpent += cost;
    tally.towersBuilt += 1;
    towers.push(tower);
    towerGrid[tz * width + tx] = tower;
    refreshAuras();
    emit({ type: 'build', tower });
    return accept();
  }

  /**
   * @param {number} towerId
   * @param {number} [branch] Ausbauzweig beim Ausbau auf Stufe 3 (ohne Angabe Zweig 0); sonst ohne Bedeutung
   * @returns {CommandResult}
   */
  function upgrade(towerId, branch) {
    if (isOver()) return reject('phase');
    const tower = findTower(towerId);
    if (tower === null) return reject('unknown');
    if (tower.level >= MAX_LEVEL) return reject('max');
    let chosen = -1;
    const branches = tower.arch.branches;
    if (tower.level + 1 === MAX_LEVEL && branches) {
      chosen = branch === undefined || branch === null ? 0 : branch;
      if (!Number.isInteger(chosen) || chosen < 0 || chosen >= branches.length) return reject('branch');
    }
    const cost = upgradeCostOf(tower);
    if (state.gold < cost) return reject('gold');
    state.gold -= cost;
    tally.goldSpent += cost;
    tally.upgrades += 1;
    tower.invested += cost;
    tower.level += 1;
    tower.branch = chosen;
    tower.stats = rules.towerStats(content, tower.arch, tower.tier, tower.level, tower);
    refreshAuras();
    emit({ type: 'upgrade', tower });
    return accept();
  }

  /**
   * Verschmilzt den Kern mit den Zutaten zu einer Superwaffe, eine Superwaffe als Kern zu einer Megawaffe
   * (docs/SIM.md, „Superwaffen“ und „Megawaffen“).
   * @param {number} coreId
   * @param {number[]} partIds
   * @returns {CommandResult}
   */
  function fuse(coreId, partIds) {
    const problem = fuseProblem(coreId, partIds);
    if (problem !== null) return reject(problem);
    const core = /** @type {Tower} */ (findTower(coreId));
    const fee = fuseCostOf(core);
    const mega = core.super;
    /** @type {{ id: number, arch: TowerArchetypeDef, branch: number, x: number, z: number }[]} */
    const parts = [];
    /** @type {string[]} */
    const gifts = core.gifts.slice();
    const giftBranches = core.giftBranches.slice();
    let invested = fee;
    for (let i = 0; i < partIds.length; i++) {
      const part = /** @type {Tower} */ (findTower(partIds[i]));
      parts.push({ id: part.id, arch: part.arch, branch: part.branch, x: part.x, z: part.z });
      gifts.push(part.arch.id);
      giftBranches.push(part.branch);
      invested += part.invested;
      core.kills += part.kills;
      core.damageDealt += part.damageDealt;
      // Die volle Erstattung eines Fehlkaufs gibt es nur, wenn alle Teile vor derselben, noch nicht begonnenen Welle gebaut wurden.
      if (part.builtWave < core.builtWave) core.builtWave = part.builtWave;
      towerGrid[part.tz * width + part.tx] = null;
    }
    // Zutaten aus der Liste verdichten; die Reihenfolge der übrigen bleibt.
    let kept = 0;
    for (let i = 0; i < towers.length; i++) {
      const tower = towers[i];
      if (tower !== core && partIds.includes(tower.id)) continue;
      towers[kept++] = tower;
    }
    towers.length = kept;
    // Was die Zutaten noch in der Welt haben, gehört von nun an dem Kern: fliegende Geschosse, Bodenfelder, Brände.
    for (let i = 0; i < projectiles.length; i++) if (partIds.includes(projectiles[i].towerId)) projectiles[i].towerId = core.id;
    for (let i = 0; i < zones.length; i++) if (partIds.includes(zones[i].towerId)) zones[i].towerId = core.id;
    for (let i = 0; i < enemies.length; i++) if (partIds.includes(enemies[i].dotOwner)) enemies[i].dotOwner = core.id;
    for (let i = 0; i < cargo.length; i++) if (partIds.includes(cargo[i].dotOwner)) cargo[i].dotOwner = core.id;
    state.gold -= fee;
    tally.goldSpent += fee;
    if (mega) tally.megas += 1;
    else tally.fusions += 1;
    core.invested += invested;
    core.super = true;
    core.mega = mega;
    core.gifts = gifts;
    core.giftBranches = giftBranches;
    // Das Rezept legt der erste Schritt fest, nach den jetzt freigeschalteten Rezepten; die Megawaffe behält es.
    if (!mega) {
      const recipe = rules.fusionRecipe(core.arch, gifts, recipeList, content);
      core.recipe = recipe ? recipe.id : '';
    }
    core.stats = rules.towerStats(content, core.arch, core.tier, core.level, core);
    core.beamTime = 0;
    refreshAuras();
    emit({ type: 'fuse', tower: core, parts, fee, mega });
    return accept();
  }

  /**
   * @param {number} towerId
   * @returns {CommandResult}
   */
  function modernize(towerId) {
    if (isOver()) return reject('phase');
    const tower = findTower(towerId);
    if (tower === null) return reject('unknown');
    const age = state.age;
    if (tower.tier >= age || !tower.arch.tiers[age]) return reject('max');
    const cost = modernizeCostOf(tower);
    if (state.gold < cost) return reject('gold');
    const fromTier = tower.tier;
    state.gold -= cost;
    tally.goldSpent += cost;
    tally.modernizations += 1;
    tower.invested += cost;
    tower.tier = age;
    tower.stats = rules.towerStats(content, tower.arch, age, tower.level, tower);
    tower.beamTime = 0;
    refreshAuras();
    emit({ type: 'modernize', tower, fromTier });
    return accept();
  }

  /**
   * @param {number} towerId
   * @returns {CommandResult}
   */
  function sell(towerId) {
    if (isOver()) return reject('phase');
    const tower = findTower(towerId);
    if (tower === null) return reject('unknown');
    const refund = sellValue(tower);
    const index = towers.indexOf(tower);
    for (let i = index + 1; i < towers.length; i++) towers[i - 1] = towers[i];
    towers.length -= 1;
    towerGrid[tower.tz * width + tower.tx] = null;
    state.gold += refund;
    tally.towersSold += 1;
    refreshAuras();
    emit({ type: 'sell', tower, refund });
    emit({ type: 'gold', amount: refund, reason: 'sell', x: tower.x, z: tower.z });
    return accept();
  }

  /**
   * @param {number} towerId
   * @param {TargetMode} mode
   * @returns {CommandResult}
   */
  function setTargetMode(towerId, mode) {
    if (isOver()) return reject('phase');
    const tower = findTower(towerId);
    if (tower === null || !TARGET_MODES.includes(mode)) return reject('unknown');
    tower.mode = mode;
    return accept();
  }

  /** @returns {CommandResult} */
  function startWave() {
    if (state.phase !== 'build') return reject('phase');
    if (boonOffer.length > 0) return reject('boon');
    if (state.lock > 0) return reject('phase');
    const wave = waves[state.wave];
    const early = earlyBonus();
    if (early > 0) {
      state.gold += early;
      tally.goldEarned += early;
      emit({ type: 'gold', amount: early, reason: 'early', x: baseX, z: baseZ });
    }
    state.phase = 'wave';
    state.pending = wave.count;
    waveTick = 0;
    spawned.fill(0);
    waveStats.clear();
    // Zu Beginn einer Welle lebt kein Gegner, also trägt auch keiner mehr eine alte Laufnummer: Der Zähler beginnt neu,
    // damit eine geladene Partie auch in ihren inneren Feldern genau wie die ungespeicherte verläuft.
    chainStamp = 0;
    livesAtWaveStart = state.lives;
    // Eigenart der Welle: gilt für die Gegner der Welle (makeEnemy) und, mit `towers`, für alle Türme, bis die Welle endet.
    state.modifier = wave.modifier;
    const modifier = rules.modifierDef(content, wave.modifier);
    if (modifier && modifier.towers) {
      towerModifier = wave.modifier;
      restatAll();
    }
    /** @type {SimEvent} */
    const event = { type: 'waveStart', wave: state.wave, age: wave.age, waveInAge: wave.waveInAge, boss: wave.boss, early };
    if (wave.modifier !== '') event.modifier = wave.modifier;
    emit(event);
    return accept();
  }

  /**
   * @param {string} id
   * @returns {CommandResult}
   */
  function chooseBoon(id) {
    if (isOver() || boonOffer.length === 0) return reject('phase');
    if (!boonOffer.includes(id)) return reject('boon');
    takeBoon(id);
    return accept();
  }

  /**
   * Löst die Fähigkeit des aktuellen Zeitalters aus. Bei `radius == 0` wirkt sie auf die ganze Karte und (x, z) ist ohne Bedeutung.
   * @param {number} x
   * @param {number} z
   * @returns {CommandResult}
   */
  function useAbility(x, z) {
    if (isOver()) return reject('phase');
    const def = abilityDefs[state.age];
    const global = !(def.radius > 0);
    if (global) {
      if (!Number.isFinite(x)) x = baseX;
      if (!Number.isFinite(z)) z = baseZ;
    } else if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return reject('unknown');
    }
    if (state.abilityCooldown > 0) return reject('cooldown');
    const damage = rules.abilityDamage(content, def, state.age);
    // Die Fähigkeit trifft wie ein Schuss ohne Schützen, der Rüstung ganz ignoriert. Verlangsamt wird getrennt (Regel 4),
    // damit eine Fähigkeit ohne Schaden `sinceHit` nicht anrührt.
    shot.towerId = -1;
    shot.tier = state.age;
    shot.damage = damage;
    shot.splash = 0;
    shot.slow = 0;
    shot.slowDuration = 0;
    shot.dot = 0;
    shot.dotDuration = 0;
    shot.pierce = 1;
    shot.chain = 0;
    shot.chainRange = 0;
    shot.zone = 0;
    shot.push = 0;
    shot.mark = 0;
    shot.markDuration = 0;
    shot.hitsAir = def.hitsAir;
    shot.hitsGround = true;
    state.abilityCooldown = def.cooldown > 0 ? def.cooldown : 0;
    tally.abilitiesUsed += 1;
    emit({ type: 'ability', def, x, z });
    const radius2 = def.radius * def.radius;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || (enemy.def.flying && !def.hitsAir)) continue;
      if (!global) {
        const dx = enemy.x - x;
        const dz = enemy.z - z;
        if (dx * dx + dz * dz > radius2) continue;
      }
      if (damage > 0) {
        applyHit(enemy, damage, shot, null);
        if (!enemy.alive) continue;
      }
      if (def.rewind > 0) {
        const dist = enemy.dist - enemy.baseSpeed * def.rewind * (enemy.def.boss ? 0.5 : 1);
        enemy.dist = dist > 0 ? dist : 0;
        place(enemy, curveFor(enemy.def, enemy.path));
        enemy.px = enemy.x;
        enemy.pz = enemy.z;
      }
      if (def.slow > 0) applySlow(enemy, def.slow, def.slowDuration);
    }
    return accept();
  }

  // --- Speichern und Laden --------------------------------------------------------------------

  /** @returns {SimSave | null} */
  function saveGame() {
    if (state.phase !== 'build' || zones.length > 0) return null;
    return {
      version: 1,
      mapId: map.id,
      difficulty: config.difficulty,
      seed: config.seed,
      rng: rng.getState(),
      time: state.time,
      wave: state.wave,
      gold: state.gold,
      lives: state.lives,
      score: state.score,
      abilityCooldown: state.abilityCooldown,
      nextId,
      towers: towers.map((tower) => ({
        arch: tower.arch.id,
        tier: tower.tier,
        level: tower.level,
        branch: tower.branch,
        super: tower.super,
        mega: tower.mega,
        gifts: tower.gifts.slice(),
        giftBranches: tower.giftBranches.slice(),
        recipe: tower.recipe,
        tx: tower.tx,
        tz: tower.tz,
        mode: tower.mode,
        invested: tower.invested,
        kills: tower.kills,
        damageDealt: tower.damageDealt,
        builtWave: tower.builtWave,
        id: tower.id,
        cooldown: tower.cooldown,
        lastShot: tower.lastShot === -Infinity ? null : tower.lastShot,
        targetId: tower.targetId,
        aimX: tower.aimX,
        aimZ: tower.aimZ,
        aimFlying: tower.aimFlying,
        beamTime: tower.beamTime,
      })),
      stats: { ...tally },
      boons: boonList.slice(),
      boonOffer: boonOffer.slice(),
      recipes: recipeList.slice(),
      loadout: loadout.slice(),
      tick: state.tick,
      buildTime: state.buildTime,
      lock: state.lock,
      projectiles: projectiles.map((p) => ({
        id: p.id,
        towerId: p.towerId,
        arch: p.arch.id,
        tier: p.tier,
        sx: p.sx,
        sz: p.sz,
        tx: p.tx,
        tz: p.tz,
        targetId: p.targetId,
        targetFlying: p.targetFlying,
        t: p.t,
        pt: p.pt,
        duration: p.duration,
        damage: p.damage,
        splash: p.splash,
        slow: p.slow,
        slowDuration: p.slowDuration,
        dot: p.dot,
        dotDuration: p.dotDuration,
        pierce: p.pierce,
        chain: p.chain,
        chainRange: p.chainRange,
        zone: p.zone,
        ...(p.push > 0 ? { push: p.push } : {}),
        ...(p.mark > 0 ? { mark: p.mark, markDuration: p.markDuration } : {}),
        hitsAir: p.hitsAir,
        hitsGround: p.hitsGround,
      })),
    };
  }

  /**
   * Stellt den Zustand aus einem Spielstand wieder her.
   * @param {SaveData} input
   */
  function restore(input) {
    checkSave(input, config, total);
    const data = /** @type {SimSave} */ (input);
    rng.setState(data.rng);
    state.time = data.time;
    state.tick = Number.isInteger(data.tick) && data.tick >= 0 ? data.tick : Math.round(data.time / SIM_DT);
    state.wave = data.wave;
    state.age = waves[data.wave].age;
    state.waveInAge = waves[data.wave].waveInAge;
    // Die Stufe der Wege folgt aus dem Zeitalter der Welle.
    const set = setOfAge(state.age);
    if (set !== activeSet) switchPaths(set);
    state.gold = data.gold;
    state.lives = data.lives;
    state.score = data.score;
    state.abilityCooldown = data.abilityCooldown > 0 ? data.abilityCooldown : 0;
    state.buildTime = Math.max(0, numberOr(data.buildTime, 0));
    state.lock = Math.max(0, numberOr(data.lock, 0));
    for (let i = 0; i < TALLY_KEYS.length; i++) tally[TALLY_KEYS[i]] = numberOr(data.stats[TALLY_KEYS[i]], 0);
    livesAtWaveStart = state.lives;
    // Zeitgaben: Ihre einmaligen Gaben stecken schon in Gold und Leben; `maxLives` folgt aus den Gaben.
    const saved = checkSavedBoons(data, content);
    for (const id of saved.boons) boonList.push(id);
    for (const id of saved.offer) boonOffer.push(id);
    effects = rules.boonEffects(content, boonList);
    abilityDefs = content.abilities.map((def) => rules.boonAbility(def, effects));
    state.maxLives = diff.lives + effects.lives;
    for (const id of checkSavedRecipes(data, content)) recipeList.push(id);

    let lastId = 0;
    for (let i = 0; i < data.towers.length; i++) {
      const entry = data.towers[i];
      const where = `Spielstand unlesbar: Turm ${i}`;
      if (typeof entry !== 'object' || entry === null) throw new Error(`${where} ist kein Objekt`);
      const arch = archById.get(entry.arch);
      if (!arch) throw new Error(`${where} hat die unbekannte Rolle "${entry.arch}"`);
      if (!Number.isInteger(entry.tier) || entry.tier < 0 || entry.tier >= content.ages.length || !arch.tiers[entry.tier]) {
        throw new Error(`${where} ("${arch.id}") hat den unbekannten Technikstand ${entry.tier}`);
      }
      if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_LEVEL) throw new Error(`${where} ("${arch.id}") hat die unbekannte Stufe ${entry.level}`);
      const problem = siteProblem(entry.tx, entry.tz);
      if (problem !== null) throw new Error(`${where} ("${arch.id}") steht auf dem Feld (${entry.tx}, ${entry.tz}), das nicht bebaubar ist (${problem})`);
      if (!TARGET_MODES.includes(entry.mode)) throw new Error(`${where} ("${arch.id}") hat die unbekannte Zielwahl "${entry.mode}"`);
      const id = entry.id === undefined ? lastId + 1 : entry.id;
      if (!Number.isInteger(id) || id <= lastId) throw new Error(`${where} ("${arch.id}") hat die ungültige Kennung ${id}`);
      lastId = id;
      const extra = checkSavedTower(entry, arch, content, where, recipeList, loadout);
      // Der besondere Bauplatz folgt aus der Lage und steht nicht im Spielstand.
      const tile = tileKinds[entry.tz * width + entry.tx];
      const x = tileX(entry.tx, width);
      const z = tileZ(entry.tz, height);
      /** @type {Tower} */
      const tower = {
        id,
        arch,
        tier: entry.tier,
        level: entry.level,
        branch: extra.branch,
        super: extra.super,
        mega: extra.mega,
        gifts: extra.gifts,
        giftBranches: extra.giftBranches,
        recipe: extra.recipe,
        tx: entry.tx,
        tz: entry.tz,
        tile,
        x,
        z,
        boons: boonList,
        modifier: '',
        stats: rules.towerStats(content, arch, entry.tier, entry.level, { ...extra, tile, boons: boonList }),
        buffDamage: 0,
        buffRate: 0,
        buffRange: 0,
        mode: entry.mode,
        cooldown: numberOr(entry.cooldown, 0),
        targetId: numberOr(entry.targetId, -1),
        aimX: numberOr(entry.aimX, x),
        aimZ: numberOr(entry.aimZ, z + 1),
        aimFlying: entry.aimFlying === true,
        lastShot: numberOr(entry.lastShot, -Infinity),
        beamTime: Math.max(0, numberOr(entry.beamTime, 0)),
        invested: numberOr(entry.invested, 0),
        kills: numberOr(entry.kills, 0),
        damageDealt: numberOr(entry.damageDealt, 0),
        builtWave: numberOr(entry.builtWave, 0),
      };
      towers.push(tower);
      towerGrid[tower.tz * width + tower.tx] = tower;
    }

    const flying = Array.isArray(data.projectiles) ? data.projectiles : [];
    for (let i = 0; i < flying.length; i++) {
      const entry = flying[i];
      const where = `Spielstand unlesbar: Geschoss ${i}`;
      if (typeof entry !== 'object' || entry === null) throw new Error(`${where} ist kein Objekt`);
      const arch = archById.get(entry.arch);
      if (!arch) throw new Error(`${where} hat die unbekannte Rolle "${entry.arch}"`);
      if (!Number.isInteger(entry.id) || entry.id < 1) throw new Error(`${where} hat die ungültige Kennung ${entry.id}`);
      if (!(numberOr(entry.duration, 0) > 0)) throw new Error(`${where} hat keine gültige Flugzeit`);
      projectiles.push({
        id: entry.id,
        towerId: numberOr(entry.towerId, -1),
        arch,
        tier: numberOr(entry.tier, 0),
        sx: numberOr(entry.sx, 0),
        sz: numberOr(entry.sz, 0),
        tx: numberOr(entry.tx, 0),
        tz: numberOr(entry.tz, 0),
        targetId: numberOr(entry.targetId, -1),
        targetFlying: entry.targetFlying === true,
        t: numberOr(entry.t, 0),
        pt: numberOr(entry.pt, 0),
        duration: entry.duration,
        damage: numberOr(entry.damage, 0),
        splash: numberOr(entry.splash, 0),
        slow: numberOr(entry.slow, 0),
        slowDuration: numberOr(entry.slowDuration, 0),
        dot: numberOr(entry.dot, 0),
        dotDuration: numberOr(entry.dotDuration, 0),
        pierce: numberOr(entry.pierce, 0),
        chain: numberOr(entry.chain, 0),
        chainRange: numberOr(entry.chainRange, 0),
        zone: numberOr(entry.zone, 0),
        push: numberOr(entry.push, 0),
        mark: numberOr(entry.mark, 0),
        markDuration: numberOr(entry.markDuration, 0),
        hitsAir: entry.hitsAir === true,
        hitsGround: entry.hitsGround === true,
        target: null,
      });
      if (entry.id > lastId) lastId = entry.id;
    }
    nextId = data.nextId > lastId ? data.nextId : lastId + 1;
    refreshAuras();
  }

  if (save !== undefined && save !== null) restore(save);

  /** @type {Sim} */
  const sim = {
    config,
    content,
    map,
    paths,
    airPaths,
    pathStages,
    totalWaves: total,
    loadout,
    state,
    step,
    drainEvents,
    build,
    upgrade,
    fuse,
    modernize,
    sell,
    setTargetMode,
    startWave,
    useAbility,
    chooseBoon,
    canBuild,
    buildCost: buildCostOf,
    upgradeCost: upgradeCostOf,
    modernizeCost: modernizeCostOf,
    canFuse,
    fuseCandidates,
    fuseCost: fuseCostOf,
    fuseRecipe,
    sellValue,
    towerAt,
    tileAt,
    pathStage,
    stagePaths,
    stageAirPaths,
    pathMark,
    towerById: findTower,
    enemyById: findEnemy,
    wavePreview,
    earlyBonus,
    ability,
    save: saveGame,
  };
  return sim;
}
