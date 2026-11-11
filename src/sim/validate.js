// @ts-check
// Prüft Inhalte und Spielstände, bevor die Simulation damit rechnet. Fehlerhafte Daten sollen `createSim` mit einer
// verständlichen Meldung scheitern lassen, statt später als NaN, als hängende Welle oder als Absturz aufzufallen.

import { buildPath } from './path.js';
import { contentSlots, fusionRecipe, isClassic, slotOf, weaponById } from './rules.js';

/** @import { Balance, Content, DifficultyDef, MapDef, TowerArchetypeDef } from '../types/content' */
/** @import { SaveData, SimConfig } from '../types/sim' */
/** @import { PathCurve } from './path.js' */

/**
 * Ergebnis der Inhaltsprüfung.
 * @typedef {object} CheckedContent
 * @property {MapDef} map Die gewählte Karte
 * @property {DifficultyDef} difficulty Der gewählte Schwierigkeitsgrad
 * @property {PathCurve[]} paths Kurven der Grundwege der Karte (Stufe 0)
 * @property {PathSet[]} sets Alle Sätze von Wegen der Karte in Reihenfolge ihrer Stufe, beginnend mit den Grundwegen (Stufe 0)
 */

/** Balance-Listen mit einem Wert je Zeitalter. */
const AGE_LISTS = /** @type {const} */ (['ageDamage', 'ageCost', 'ageHp', 'ageBounty']);
/** Balance-Listen mit einem Wert je Ausbaustufe und ihre Mindestlänge. */
const LEVEL_LISTS = /** @type {const} */ ([['levelDamage', 3], ['levelRange', 3], ['levelCost', 2]]);
/** Einzelwerte der Balance. */
const BALANCE_NUMBERS = /** @type {const} */ ([
  'startGold', 'baseHp', 'baseBounty', 'baseDamage', 'waveHpGrowth', 'modernizeFactor', 'sellRefund', 'waveBonus', 'perfectBonus',
  'earlyBonus', 'earlyBonusTime', 'ageGift', 'burnOnSlowed', 'minDamage', 'shieldDelay', 'shieldRecharge',
]);
/** Zahlenfelder eines Schwierigkeitsgrads. */
const DIFFICULTY_NUMBERS = /** @type {const} */ (['hp', 'speed', 'gold', 'lives', 'income', 'score']);
/** Zahlenfelder eines Gegners, die nicht negativ sein dürfen. */
const ENEMY_NUMBERS = /** @type {const} */ (['hp', 'armor', 'shield', 'regen', 'bounty']);
/** Zahlenfelder einer Fähigkeit. */
const ABILITY_NUMBERS = /** @type {const} */ (['cooldown', 'radius', 'rewind', 'damage', 'slow', 'slowDuration']);
/** Zahlenfelder der Kampfwerte eines Turms; keines darf negativ sein. */
const STAT_NUMBERS = /** @type {const} */ ([
  'damage', 'cooldown', 'range', 'minRange', 'projectileSpeed', 'splash', 'slow', 'slowDuration', 'dot', 'dotDuration', 'pierce',
  'chain', 'chainRange', 'zone', 'ramp', 'rampTime', 'auraDamage', 'auraRate', 'auraRange',
]);
/** Freiwillige Zahlenfelder der Kampfwerte (Waffen des Pools): fehlen dürfen sie, negativ sein nicht. */
const OPTIONAL_NUMBERS = /** @type {const} */ (['push', 'mark', 'markDuration', 'auraBounty']);
/** Alle Zahlenfelder als schlichte Namensliste. @type {readonly string[]} */
const NUMERIC_NAMES = [...STAT_NUMBERS, ...OPTIONAL_NUMBERS];
/** Alle Felder der Kampfwerte außer `attack`. @type {readonly string[]} */
const STAT_NAMES = [...NUMERIC_NAMES, 'hitsAir', 'hitsGround', 'seek'];
/** Wahrheitswerte der Kampfwerte eines Turms. */
const STAT_FLAGS = /** @type {const} */ (['hitsAir', 'hitsGround']);
/** Erlaubte Angriffsarten. */
const ATTACKS = ['projectile', 'hitscan', 'beam', 'pulse', 'none'];
/** Erlaubte Zielwahlen. */
const TARGET_MODES = ['first', 'last', 'strong', 'weak', 'near'];
/** Erkennungszeichen einer Waffe (`WeaponLook.marker`). */
const MARKERS = ['none', 'crystal', 'vial', 'pennant', 'ring', 'orb', 'spikes'];
/** Aufgaben eines Platzes (`SlotDef.job`). */
const JOBS = ['area', 'slow', 'armor', 'burn', 'aura'];
/** Zahlenfelder eines Spielstands. */
const SAVE_NUMBERS = /** @type {const} */ (['rng', 'time', 'wave', 'gold', 'lives', 'score', 'abilityCooldown', 'nextId']);

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * Bezeichnung eines Zeitalters für Fehlermeldungen.
 * @param {Content} content
 * @param {number} age
 */
function ageLabel(content, age) {
  const def = content.ages[age];
  return `Zeitalter ${age} ("${def && def.id}")`;
}

/**
 * @param {Content} content
 */
function checkBalance(content) {
  const balance = content.balance;
  if (!isObject(balance)) throw new Error('Inhalte unvollständig: content.balance fehlt');
  for (const key of AGE_LISTS) {
    const list = balance[key];
    if (!Array.isArray(list)) throw new Error(`balance.${key} fehlt: Erwartet wird eine Liste mit einem Wert je Zeitalter`);
    for (let age = 0; age < content.ages.length; age++) {
      if (!isNumber(list[age])) throw new Error(`balance.${key} hat keinen Wert für ${ageLabel(content, age)}`);
    }
  }
  for (const [key, length] of LEVEL_LISTS) {
    const list = balance[key];
    if (!Array.isArray(list)) throw new Error(`balance.${key} fehlt: Erwartet wird eine Liste mit ${length} Werten`);
    for (let i = 0; i < length; i++) {
      if (!isNumber(list[i])) throw new Error(`balance.${key} braucht ${length} Zahlen, Wert ${i} fehlt`);
    }
  }
  for (const key of BALANCE_NUMBERS) {
    if (!isNumber(balance[key])) throw new Error(`balance.${key} fehlt oder ist keine Zahl`);
    if (balance[key] < 0) throw new Error(`balance.${key} darf nicht negativ sein, ist aber ${balance[key]}`);
  }
  if (!(balance.shieldRecharge > 0)) throw new Error(`balance.shieldRecharge muss größer als 0 sein, ist aber ${balance.shieldRecharge}`);
  if (balance.minDamage > 1) throw new Error(`balance.minDamage ist ein Anteil zwischen 0 und 1, ist aber ${balance.minDamage}`);
  if (balance.sellRefund > 1) throw new Error(`balance.sellRefund ist ein Anteil zwischen 0 und 1, ist aber ${balance.sellRefund}`);
  // Superwaffen: Ältere Inhalte ohne balance.fusion bleiben gültig, solange keine Rolle verschmelzen kann (siehe checkArchetypes).
  const fusion = /** @type {unknown} */ (balance.fusion);
  if (fusion !== undefined && fusion !== null) {
    if (!isObject(fusion)) throw new Error('balance.fusion muss ein Objekt mit parts, damage, range und fee sein');
    if (!Number.isInteger(fusion.parts) || /** @type {number} */ (fusion.parts) < 1 || /** @type {number} */ (fusion.parts) > 8) {
      throw new Error(`balance.fusion.parts muss eine ganze Zahl von 1 bis 8 sein (ein Kern hat acht Nachbarfelder), ist aber ${fusion.parts}`);
    }
    for (const key of /** @type {const} */ (['damage', 'range'])) {
      const value = fusion[key];
      if (!isNumber(value) || value <= 0) throw new Error(`balance.fusion.${key} muss eine Zahl größer als 0 sein, ist aber ${value}`);
    }
    if (!isNumber(fusion.fee) || fusion.fee < 0) throw new Error(`balance.fusion.fee muss eine Zahl ab 0 sein, ist aber ${fusion.fee}`);
    // Megawaffen: zweiter Schritt einer Superwaffe.
    if (!Number.isInteger(fusion.megaLimit) || /** @type {number} */ (fusion.megaLimit) < 0) {
      throw new Error(`balance.fusion.megaLimit muss eine ganze Zahl ab 0 sein (0 = keine Megawaffen), ist aber ${fusion.megaLimit}`);
    }
    for (const key of /** @type {const} */ (['megaDamage', 'megaRange'])) {
      const value = fusion[key];
      if (!isNumber(value) || value <= 0) throw new Error(`balance.fusion.${key} muss eine Zahl größer als 0 sein, ist aber ${value}`);
    }
    if (!isNumber(fusion.megaFee) || fusion.megaFee < 0) throw new Error(`balance.fusion.megaFee muss eine Zahl ab 0 sein, ist aber ${fusion.megaFee}`);
  }
  // Besondere Bauplätze: Ältere Inhalte ohne balance.tiles bleiben gültig, solange keine Karte welche nennt (siehe checkMap).
  const tiles = /** @type {unknown} */ (balance.tiles);
  if (tiles !== undefined && tiles !== null) {
    if (!isObject(tiles) || Array.isArray(tiles)) throw new Error('balance.tiles muss ein Objekt sein: je Art eines besonderen Bauplatzes ein Eintrag');
    for (const kind of Object.keys(tiles)) checkTileDef(tiles[kind], `balance.tiles.${kind}`);
  }
}

/**
 * Prüft eine Art besonderer Bauplätze.
 * @param {unknown} def
 * @param {string} where Bezeichnung für Fehlermeldungen
 */
function checkTileDef(def, where) {
  if (!isObject(def)) throw new Error(`${where} ist kein Objekt (erwartet wird { name, text, color, icon, mod, cost })`);
  for (const key of /** @type {const} */ (['name', 'icon'])) {
    if (typeof def[key] !== 'string' || def[key] === '') throw new Error(`${where}: ${key} fehlt oder ist kein Text`);
  }
  if (typeof def.text !== 'string') throw new Error(`${where}: text fehlt oder ist kein Text`);
  if (typeof def.color !== 'string' && !isNumber(def.color)) throw new Error(`${where}: color fehlt oder ist keine Farbe`);
  checkMod(def.mod, `${where}.mod`);
  const set = isObject(def.mod) ? def.mod.set : undefined;
  if (set !== undefined && set !== null) throw new Error(`${where}.mod: set ist auf besonderen Bauplätzen nicht erlaubt (nur mul und add)`);
  if (!isNumber(def.cost) || def.cost <= 0) throw new Error(`${where}: cost muss eine Zahl größer als 0 sein (1 = unverändert), ist aber ${def.cost}`);
}

/**
 * @param {Balance} balance
 * @param {string} id
 * @returns {DifficultyDef}
 */
function checkDifficulty(balance, id) {
  const all = isObject(balance.difficulty) ? /** @type {Record<string, DifficultyDef>} */ (balance.difficulty) : {};
  const def = Object.prototype.hasOwnProperty.call(all, id) ? all[id] : undefined;
  if (!isObject(def)) throw new Error(`Unbekannter Schwierigkeitsgrad "${id}" (vorhanden: ${Object.keys(all).join(', ') || 'keiner'})`);
  for (const key of DIFFICULTY_NUMBERS) {
    if (!isNumber(def[key])) throw new Error(`Schwierigkeitsgrad "${id}": Feld ${key} fehlt oder ist keine Zahl`);
  }
  if (!Number.isInteger(def.lives) || def.lives < 1) throw new Error(`Schwierigkeitsgrad "${id}": lives muss eine ganze Zahl ab 1 sein, ist aber ${def.lives}`);
  if (!(def.hp > 0) || !(def.speed > 0)) throw new Error(`Schwierigkeitsgrad "${id}": hp und speed müssen größer als 0 sein, sind aber ${def.hp} und ${def.speed}`);
  return def;
}

/**
 * @param {Content} content
 */
function checkEnemies(content) {
  const enemies = content.enemies;
  if (!isObject(enemies)) throw new Error('Inhalte unvollständig: content.enemies fehlt');
  for (const id of Object.keys(enemies)) {
    const def = enemies[id];
    if (!isObject(def)) throw new Error(`Gegner "${id}" ist kein Objekt`);
    for (const key of ENEMY_NUMBERS) {
      if (!isNumber(def[key]) || def[key] < 0) throw new Error(`Gegner "${id}": ${key} muss eine Zahl ab 0 sein, ist aber ${def[key]}`);
    }
    if (!isNumber(def.speed) || def.speed <= 0) throw new Error(`Gegner "${id}": speed muss größer als 0 sein, ist aber ${def.speed}`);
    if (!isNumber(def.slowResist) || def.slowResist < 0 || def.slowResist > 1) throw new Error(`Gegner "${id}": slowResist muss zwischen 0 und 1 liegen, ist aber ${def.slowResist}`);
    if (!Number.isInteger(def.lives) || def.lives < 0) throw new Error(`Gegner "${id}": lives muss eine ganze Zahl ab 0 sein, ist aber ${def.lives}`);
    const cargo = def.spawns;
    if (cargo) {
      if (!Object.prototype.hasOwnProperty.call(enemies, cargo.enemy)) throw new Error(`Gegner "${id}": unbekannter Gegner "${cargo.enemy}" als Fracht (spawns)`);
      if (!Number.isInteger(cargo.count) || cargo.count < 0) throw new Error(`Gegner "${id}": spawns.count muss eine ganze Zahl ab 0 sein, ist aber ${cargo.count}`);
    }
    const heal = def.heal;
    if (heal && (!isNumber(heal.radius) || !isNumber(heal.perSecond))) throw new Error(`Gegner "${id}": heal braucht die Zahlen radius und perSecond`);
    const phases = def.phases;
    if (phases !== undefined && phases !== null) {
      if (!Array.isArray(phases)) throw new Error(`Gegner "${id}": phases muss eine Liste sein`);
      for (let p = 0; p < phases.length; p++) {
        const phase = phases[p];
        const where = `Gegner "${id}", Moment ${p}`;
        if (!isObject(phase) || !isNumber(phase.at) || phase.at <= 0 || phase.at >= 1) throw new Error(`${where}: at muss zwischen 0 und 1 liegen, ist aber ${phase && phase.at}`);
        if (p > 0 && phase.at > phases[p - 1].at) throw new Error(`${where}: Die Momente müssen absteigend nach at geordnet sein (${phases[p - 1].at} steht vor ${phase.at})`);
        if (phase.spawns) {
          if (!Object.prototype.hasOwnProperty.call(enemies, phase.spawns.enemy)) throw new Error(`${where}: unbekannter Gegner "${phase.spawns.enemy}" (spawns)`);
          if (!Number.isInteger(phase.spawns.count) || phase.spawns.count < 0) throw new Error(`${where}: spawns.count muss eine ganze Zahl ab 0 sein, ist aber ${phase.spawns.count}`);
        }
        if (phase.speed !== undefined) {
          if (!isNumber(phase.speed) || phase.speed <= 0) throw new Error(`${where}: speed muss größer als 0 sein, ist aber ${phase.speed}`);
          if (!isNumber(phase.duration) || phase.duration <= 0) throw new Error(`${where}: Zu speed gehört eine duration größer als 0, sie ist aber ${phase.duration}`);
        }
      }
    }
  }
  // Fracht, die selbst wieder Fracht aussetzt, darf keinen Kreis bilden, sonst endet eine Welle nie.
  for (const id of Object.keys(enemies)) {
    let current = enemies[id];
    for (let depth = 0; current.spawns && current.spawns.count > 0; depth++) {
      if (depth > Object.keys(enemies).length) throw new Error(`Gegner "${id}": Die Fracht (spawns) führt im Kreis auf sich selbst zurück`);
      current = enemies[current.spawns.enemy];
    }
  }
}

/**
 * @param {Content} content
 * @param {(age: number) => number} pathCountOf Anzahl der Wege der gewählten Karte im Zeitalter (Stufen wechseln sie)
 */
function checkWaves(content, pathCountOf) {
  const waves = content.waves;
  const ages = content.ages;
  if (!Array.isArray(waves)) throw new Error('Inhalte unvollständig: content.waves fehlt');
  if (waves.length !== ages.length) {
    throw new Error(`content.waves hat ${waves.length} Einträge, es gibt aber ${ages.length} Zeitalter: Gebraucht wird genau eine Liste von Wellen je Zeitalter`);
  }
  for (let age = 0; age < waves.length; age++) {
    const list = waves[age];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${ageLabel(content, age)} hat keine Wellen`);
    const pathCount = pathCountOf(age);
    for (let w = 0; w < list.length; w++) {
      const where = `Welle ${w} in ${ageLabel(content, age)}`;
      const wave = list[w];
      if (!isObject(wave) || !Array.isArray(wave.groups)) throw new Error(`${where}: groups fehlt`);
      for (let g = 0; g < wave.groups.length; g++) {
        const group = wave.groups[g];
        if (!isObject(group)) throw new Error(`${where}, Gruppe ${g}: kein Objekt`);
        if (!Object.prototype.hasOwnProperty.call(content.enemies, group.enemy)) throw new Error(`${where}, Gruppe ${g}: unbekannter Gegner "${group.enemy}"`);
        if (!Number.isInteger(group.count) || group.count < 0) throw new Error(`${where}, Gruppe ${g}: count muss eine ganze Zahl ab 0 sein, ist aber ${group.count}`);
        if (!isNumber(group.interval) || group.interval < 0) throw new Error(`${where}, Gruppe ${g}: interval muss eine Zahl ab 0 sein, ist aber ${group.interval}`);
        if (!isNumber(group.delay) || group.delay < 0) throw new Error(`${where}, Gruppe ${g}: delay muss eine Zahl ab 0 sein, ist aber ${group.delay}`);
        if (group.path !== undefined && group.path !== null && (!Number.isInteger(group.path) || group.path < 0 || group.path >= pathCount)) {
          throw new Error(`${where}, Gruppe ${g}: Weg ${group.path} gibt es auf dieser Karte nicht (sie hat in diesem Zeitalter ${pathCount} ${pathCount === 1 ? 'Weg' : 'Wege'})`);
        }
      }
    }
  }
}

/**
 * Prüft Kampfwerte: vollständig (`partial` = false) oder nur die gesetzten Felder einer Abweichung (`partial` = true).
 * @param {unknown} stats
 * @param {string} where Bezeichnung für Fehlermeldungen
 * @param {boolean} partial
 */
function checkStats(stats, where, partial) {
  if (!isObject(stats)) throw new Error(`${where} fehlt oder ist kein Objekt`);
  if (!(partial && stats.attack === undefined) && !ATTACKS.includes(/** @type {string} */ (stats.attack))) {
    throw new Error(`${where}: unbekannte Angriffsart "${stats.attack}" (erlaubt: ${ATTACKS.join(', ')})`);
  }
  for (const key of STAT_NUMBERS) {
    const value = stats[key];
    if (partial && value === undefined) continue;
    if (!isNumber(value) || value < 0) throw new Error(`${where}: ${key} muss eine Zahl ab 0 sein, ist aber ${value}`);
  }
  for (const key of STAT_FLAGS) {
    const value = stats[key];
    if (partial && value === undefined) continue;
    if (typeof value !== 'boolean') throw new Error(`${where}: ${key} muss true oder false sein, ist aber ${value}`);
  }
  for (const key of OPTIONAL_NUMBERS) {
    const value = stats[key];
    if (value === undefined) continue;
    if (!isNumber(value) || value < 0) throw new Error(`${where}: ${key} muss eine Zahl ab 0 sein, ist aber ${value}`);
  }
  if (!partial && isNumber(stats.mark) && stats.mark > 0 && !(isNumber(stats.markDuration) && stats.markDuration > 0)) {
    throw new Error(`${where}: Ein Zeichen (mark) braucht eine Dauer markDuration größer 0`);
  }
  if (stats.seek !== undefined && typeof stats.seek !== 'boolean') throw new Error(`${where}: seek muss true oder false sein, ist aber ${stats.seek}`);
}

/**
 * Prüft eine Veränderung von Kampfwerten (Ausbauzweig, Kern oder Gabe einer Superwaffe).
 * @param {unknown} mod
 * @param {string} where Bezeichnung für Fehlermeldungen
 */
function checkMod(mod, where) {
  if (!isObject(mod)) throw new Error(`${where} fehlt oder ist kein Objekt (erwartet wird { set?, mul?, add? })`);
  for (const key of Object.keys(mod)) {
    if (key !== 'set' && key !== 'mul' && key !== 'add') throw new Error(`${where}: unbekanntes Feld "${key}" (erlaubt: set, mul, add)`);
  }
  if (mod.set !== undefined && mod.set !== null) {
    checkStats(mod.set, `${where}.set`, true);
    for (const key of Object.keys(/** @type {object} */ (mod.set))) {
      if (key !== 'attack' && !STAT_NAMES.includes(key)) throw new Error(`${where}.set: unbekannter Kampfwert "${key}"`);
    }
  }
  for (const part of /** @type {const} */ (['mul', 'add'])) {
    const values = mod[part];
    if (values === undefined || values === null) continue;
    if (!isObject(values)) throw new Error(`${where}.${part} ist kein Objekt`);
    for (const key of Object.keys(values)) {
      if (!NUMERIC_NAMES.includes(key)) throw new Error(`${where}.${part}: "${key}" ist kein Zahlenfeld der Kampfwerte`);
      const value = values[key];
      if (!isNumber(value)) throw new Error(`${where}.${part}.${key} muss eine Zahl sein, ist aber ${value}`);
      if (part === 'mul' && value < 0) throw new Error(`${where}.mul.${key} darf nicht negativ sein, ist aber ${value}`);
    }
  }
}

/**
 * Ob eine Veränderung dem Feld `key` einen Wert größer 0 gibt (über `set` oder `add`).
 * @param {Record<string, unknown>} mod
 * @param {string} key
 */
function modGives(mod, key) {
  const set = isObject(mod.set) ? mod.set[key] : undefined;
  const add = isObject(mod.add) ? mod.add[key] : undefined;
  return (isNumber(set) && set > 0) || (isNumber(add) && add > 0);
}

/**
 * Prüft Ausbauzweige und Verschmelzung einer Rolle. Beides ist freiwillig; ältere Inhalte ohne sie bleiben gültig.
 * @param {Content} content
 * @param {Record<string, unknown>} arch
 * @param {string} where
 */
function checkBranchesAndFusion(content, arch, where) {
  const branches = arch.branches;
  if (branches !== undefined && branches !== null) {
    if (!Array.isArray(branches) || branches.length !== 2) throw new Error(`${where}: branches muss genau zwei Ausbauzweige nennen`);
    for (let b = 0; b < branches.length; b++) {
      const branch = branches[b];
      if (!isObject(branch)) throw new Error(`${where}, branches[${b}] ist kein Objekt`);
      if (typeof branch.name !== 'string' || branch.name === '') throw new Error(`${where}, branches[${b}]: name fehlt`);
      checkMod(branch.mod, `${where}, branches[${b}].mod`);
      const branchGift = /** @type {unknown} */ (branch.gift);
      if (branchGift !== undefined && branchGift !== null) {
        const label = `${where}, branches[${b}].gift`;
        if (!isObject(branchGift)) throw new Error(`${label} ist kein Objekt`);
        if (typeof branchGift.name !== 'string' || branchGift.name === '') throw new Error(`${label}: name fehlt`);
        if (typeof branchGift.text !== 'string') throw new Error(`${label}: text fehlt`);
        checkMod(branchGift.mod, `${label}.mod`);
        checkGiftDurations(/** @type {Record<string, unknown>} */ (branchGift.mod), label);
      }
    }
  }
  const fusion = arch.fusion;
  if (fusion !== undefined && fusion !== null) {
    if (!isObject(fusion)) throw new Error(`${where}: fusion ist kein Objekt`);
    if (!isObject(content.balance.fusion)) throw new Error(`${where} kann verschmelzen (fusion), aber balance.fusion fehlt`);
    checkMod(fusion.core, `${where}, fusion.core`);
    checkMod(fusion.gift, `${where}, fusion.gift`);
    checkGiftDurations(/** @type {Record<string, unknown>} */ (fusion.gift), `${where}, fusion.gift`);
    if (fusion.recipes !== undefined && fusion.recipes !== null) checkRecipes(content, arch, fusion.recipes, where);
  }
}

/**
 * Prüft die Rezepte einer Kernrolle und ihre Darstellung je Zeitalter (`tiers[i].recipes`).
 * @param {Content} content
 * @param {Record<string, unknown>} arch
 * @param {unknown} recipes
 * @param {string} where
 */
function checkRecipes(content, arch, recipes, where) {
  if (!Array.isArray(recipes)) throw new Error(`${where}: fusion.recipes muss eine Liste von Rezepten sein`);
  const parts = /** @type {{ parts: number }} */ (content.balance.fusion).parts;
  /** @type {string[]} */
  const ids = [];
  /** @type {string[]} */
  const mixes = [];
  for (let r = 0; r < recipes.length; r++) {
    const recipe = recipes[r];
    const label = `${where}, fusion.recipes[${r}]`;
    if (!isObject(recipe)) throw new Error(`${label} ist kein Objekt`);
    if (typeof recipe.id !== 'string' || recipe.id === '') throw new Error(`${label}: id fehlt`);
    if (ids.includes(recipe.id)) throw new Error(`${label}: Das Rezept "${recipe.id}" ist doppelt vorhanden`);
    ids.push(recipe.id);
    if (typeof recipe.name !== 'string' || recipe.name === '') throw new Error(`${label}: name fehlt`);
    if (typeof recipe.coreText !== 'string' || recipe.coreText === '') throw new Error(`${label}: coreText fehlt`);
    if (recipe.locked !== undefined && typeof recipe.locked !== 'boolean') throw new Error(`${label}: locked muss true oder false sein`);
    if (recipe.ages !== undefined && (!Array.isArray(recipe.ages) || recipe.ages.some((a) => !Number.isInteger(a) || a < 0))) {
      throw new Error(`${label}: ages muss eine Liste ganzer Zahlen ab 0 sein (Positionen der Zeitalter)`);
    }
    checkMod(recipe.core, `${label}.core`);
    const gifts = recipe.gifts;
    if (!Array.isArray(gifts) || gifts.length !== parts) {
      throw new Error(`${label}: gifts muss genau ${parts} Rollen nennen (balance.fusion.parts)`);
    }
    for (const id of gifts) {
      const giver = content.archetypes.find((other) => other.id === id);
      if (!giver) throw new Error(`${label}: unbekannte Turmrolle "${id}" als Zutat`);
      if (!giver.fusion) throw new Error(`${label}: Die Rolle "${id}" kann nicht verschmelzen und taugt nicht als Zutat`);
    }
    const mix = gifts.slice().sort().join('+');
    if (mixes.includes(mix)) throw new Error(`${label}: Ein anderes Rezept dieser Rolle verlangt schon dieselben Zutaten (${mix})`);
    mixes.push(mix);
  }
  // Eine Waffe des Pools darf zusätzlich das Aussehen der Rezepte ihres Platzes (der klassischen Waffe) für sich festlegen.
  const self = /** @type {TowerArchetypeDef} */ (/** @type {unknown} */ (arch));
  const classic = isClassic(self) ? null : weaponById(content, slotOf(self));
  const shared = classic && classic.fusion && classic.fusion.recipes ? classic.fusion.recipes.map((r) => r.id) : [];
  const tiers = /** @type {unknown[]} */ (arch.tiers);
  for (let t = 0; t < tiers.length; t++) {
    const tier = tiers[t];
    if (!isObject(tier)) continue;
    const looks = tier.recipes;
    if (looks !== undefined && looks !== null && !isObject(looks)) throw new Error(`${where}, tiers[${t}].recipes ist kein Objekt`);
    for (const key of isObject(looks) ? Object.keys(looks) : []) {
      if (!ids.includes(key) && !shared.includes(key)) throw new Error(`${where}, tiers[${t}].recipes: unbekanntes Rezept "${key}"`);
    }
    for (const id of ids) {
      const look = isObject(looks) ? looks[id] : undefined;
      const label = `${where}, tiers[${t}].recipes.${id}`;
      if (!isObject(look)) throw new Error(`${label} fehlt: Jedes Zeitalter braucht Namen für das Rezept`);
      if (typeof look.superName !== 'string' || look.superName === '') throw new Error(`${label}: superName fehlt`);
      if (typeof look.megaName !== 'string' || look.megaName === '') throw new Error(`${label}: megaName fehlt`);
      const shot = look.superShot;
      if (shot !== undefined && (!isObject(shot) || typeof shot.kind !== 'string')) throw new Error(`${label}: superShot ist kein Angriffsbild mit kind`);
    }
  }
}

/**
 * Eine Gabe landet auch auf Kernen, die selbst weder brennen noch bremsen: Sie muss die Dauer mitbringen.
 * @param {Record<string, unknown>} gift
 * @param {string} label
 */
function checkGiftDurations(gift, label) {
  if (modGives(gift, 'dot') && !modGives(gift, 'dotDuration')) {
    throw new Error(`${label}: Die Gabe bringt Schaden über Zeit (dot), aber keine Dauer (dotDuration in set oder add)`);
  }
  if (modGives(gift, 'slow') && !modGives(gift, 'slowDuration')) {
    throw new Error(`${label}: Die Gabe bringt eine Verlangsamung (slow), aber keine Dauer (slowDuration in set oder add)`);
  }
}

/**
 * @param {Content} content
 */
function checkArchetypes(content) {
  const archetypes = content.archetypes;
  if (!Array.isArray(archetypes)) throw new Error('Inhalte unvollständig: content.archetypes fehlt');
  /** @type {Set<string>} */
  const seen = new Set();
  for (let i = 0; i < archetypes.length; i++) {
    const arch = archetypes[i];
    if (!isObject(arch) || typeof arch.id !== 'string') throw new Error(`Turmrolle ${i}: id fehlt`);
    const where = `Turmrolle "${arch.id}"`;
    if (seen.has(arch.id)) throw new Error(`${where} ist doppelt vorhanden`);
    seen.add(arch.id);
    if (!isNumber(arch.cost) || arch.cost < 0) throw new Error(`${where}: cost muss eine Zahl ab 0 sein, ist aber ${arch.cost}`);
    if (!Number.isInteger(arch.unlockWave) || arch.unlockWave < 0) throw new Error(`${where}: unlockWave muss eine ganze Zahl ab 0 sein, ist aber ${arch.unlockWave}`);
    if (arch.defaultMode !== undefined && !TARGET_MODES.includes(arch.defaultMode)) {
      throw new Error(`${where}: unbekannte Zielwahl "${arch.defaultMode}" in defaultMode (erlaubt: ${TARGET_MODES.join(', ')})`);
    }
    checkStats(arch.stats, `${where}, stats`, false);
    if (arch.levels !== undefined && arch.levels !== null) {
      if (!Array.isArray(arch.levels)) throw new Error(`${where}: levels muss eine Liste mit einem Eintrag je Stufe sein`);
      for (let l = 0; l < arch.levels.length; l++) {
        if (arch.levels[l] !== undefined && arch.levels[l] !== null) checkStats(arch.levels[l], `${where}, levels[${l}]`, true);
      }
    }
    if (!Array.isArray(arch.tiers)) throw new Error(`${where}: tiers fehlt`);
    let any = false;
    for (let t = 0; t < arch.tiers.length; t++) {
      const tier = arch.tiers[t];
      if (tier === null || tier === undefined) continue;
      if (!isObject(tier)) throw new Error(`${where}, tiers[${t}] ist kein Objekt`);
      any = true;
      if (tier.tweak !== undefined && tier.tweak !== null) checkStats(tier.tweak, `${where}, tiers[${t}].tweak`, true);
    }
    if (!any) throw new Error(`${where} hat in keinem Zeitalter eine Ausprägung (tiers)`);
    checkBranchesAndFusion(content, arch, where);
  }
  checkSlots(content);
}

/**
 * Prüft Plätze und Waffen des Pools (docs/SIM.md, „Waffenpool“): `content.slots` (freiwillig), jeder Platz hat seine klassische
 * Waffe, jede Waffe einen bekannten Platz; Waffen eines Platzes teilen Farbe, Name der Aufgabe, Symbol, Freischaltwelle und Modelle;
 * jede Waffe, die nicht klassisch ist, hat `look` und dieselben Zeitalter wie die klassische; jede erfüllt die Aufgabe des Platzes.
 * @param {Content} content
 */
function checkSlots(content) {
  const raw = /** @type {unknown} */ (content.slots);
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('content.slots muss eine nicht leere Liste von Plätzen sein');
    /** @type {string[]} */
    const ids = [];
    raw.forEach((slot, index) => {
      if (!isObject(slot) || typeof slot.id !== 'string' || slot.id === '') throw new Error(`Platz ${index}: id fehlt`);
      const where = `Platz "${slot.id}"`;
      if (ids.includes(slot.id)) throw new Error(`${where} ist doppelt vorhanden`);
      ids.push(slot.id);
      for (const key of /** @type {const} */ (['name', 'summary', 'color', 'icon'])) {
        if (typeof slot[key] !== 'string' || slot[key] === '') throw new Error(`${where}: ${key} fehlt oder ist kein Text`);
      }
      if (slot.job !== undefined && !JOBS.includes(/** @type {string} */ (slot.job))) throw new Error(`${where}: unbekannte Aufgabe "${slot.job}" in job (erlaubt: ${JOBS.join(', ')})`);
    });
  }
  const slots = contentSlots(content);
  for (const slot of slots) {
    const classic = weaponById(content, slot.id);
    if (!classic || slotOf(classic) !== slot.id) throw new Error(`Platz "${slot.id}" hat keine klassische Waffe (eine Waffe mit der Kennung "${slot.id}" auf diesem Platz)`);
  }
  for (const arch of content.archetypes) {
    const where = `Turmrolle "${arch.id}"`;
    const rawSlot = /** @type {unknown} */ (arch.slot);
    if (rawSlot !== undefined && (typeof rawSlot !== 'string' || rawSlot === '')) throw new Error(`${where}: slot muss die Kennung eines Platzes sein`);
    if (arch.name !== undefined && (typeof arch.name !== 'string' || arch.name === '')) throw new Error(`${where}: name muss ein nicht leerer Text sein`);
    const slot = slots.find((candidate) => candidate.id === slotOf(arch));
    if (!slot) throw new Error(`${where} gehört zum unbekannten Platz "${slotOf(arch)}" (content.slots)`);
    const classic = /** @type {TowerArchetypeDef} */ (weaponById(content, slot.id));
    checkLook(arch, where, !isClassic(arch));
    if (Array.isArray(content.slots)) {
      if (arch.color !== slot.color) throw new Error(`${where}: color muss die Farbe des Platzes "${slot.id}" sein (${slot.color})`);
      if (arch.role !== slot.name) throw new Error(`${where}: role muss der Name des Platzes "${slot.id}" sein ("${slot.name}")`);
      if (arch.icon !== slot.icon) throw new Error(`${where}: icon muss das Symbol des Platzes "${slot.id}" sein ("${slot.icon}")`);
    }
    if (slot.job !== undefined && !doesJob(arch, slot.job)) throw new Error(`${where} erfüllt die Aufgabe "${slot.job}" des Platzes "${slot.id}" nicht (geprüft an stats)`);
    if (isClassic(arch)) continue;
    if (arch.unlockWave !== classic.unlockWave) throw new Error(`${where}: unlockWave muss die des Platzes sein (${classic.unlockWave} wie "${classic.id}")`);
    const count = Math.max(arch.tiers.length, classic.tiers.length);
    for (let t = 0; t < count; t++) {
      const own = arch.tiers[t];
      const base = classic.tiers[t];
      const label = `${where}, ${ageLabel(content, t)}`;
      if (!base) {
        if (own) throw new Error(`${label}: Die Waffe hat eine Ausprägung, die klassische Waffe "${classic.id}" ihres Platzes nicht`);
        continue;
      }
      if (!own) throw new Error(`${label}: Ausprägung fehlt (die klassische Waffe "${classic.id}" hat eine)`);
      if (typeof own.name !== 'string' || own.name === '') throw new Error(`${label}: name fehlt`);
      if (typeof own.flavor !== 'string' || own.flavor === '') throw new Error(`${label}: flavor fehlt`);
      if (!isObject(own.shot) || typeof own.shot.kind !== 'string') throw new Error(`${label}: shot fehlt oder hat kein kind`);
      if (own.model !== base.model) throw new Error(`${label}: model muss vorerst das Modell des Platzes sein ("${base.model}"), ist aber "${own.model}"`);
      if (arch.fusion) {
        for (const key of /** @type {const} */ (['superName', 'megaName'])) {
          if (typeof own[key] !== 'string' || own[key] === '') throw new Error(`${label}: ${key} fehlt (die Waffe kann verschmelzen)`);
        }
      }
    }
  }
}

/**
 * Prüft `arch.look`; Pflicht, wenn `required`.
 * @param {TowerArchetypeDef} arch
 * @param {string} where
 * @param {boolean} required
 */
function checkLook(arch, where, required) {
  const look = /** @type {unknown} */ (arch.look);
  if (look === undefined || look === null) {
    if (required) throw new Error(`${where}: look fehlt (Akzentfarbe und Erkennungszeichen jeder Waffe des Pools)`);
    return;
  }
  if (!isObject(look)) throw new Error(`${where}: look ist kein Objekt`);
  if (typeof look.accent !== 'string' && !isNumber(look.accent)) throw new Error(`${where}: look.accent fehlt oder ist keine Farbe`);
  if (!MARKERS.includes(/** @type {string} */ (look.marker))) throw new Error(`${where}: unbekanntes Erkennungszeichen "${look.marker}" in look.marker (erlaubt: ${MARKERS.join(', ')})`);
}

/**
 * Ob die Werte der Stufe 1 die Aufgabe eines Platzes erfüllen (`SlotJob`).
 * @param {TowerArchetypeDef} arch
 * @param {string} job
 */
function doesJob(arch, job) {
  const s = arch.stats;
  if (job === 'area') return s.splash > 0 || s.attack === 'pulse';
  if (job === 'slow') return s.slow > 0;
  if (job === 'armor') return s.pierce > 0;
  if (job === 'burn') return s.dot > 0;
  return s.auraRate > 0 || s.auraDamage > 0 || s.auraRange > 0 || (s.auraBounty || 0) > 0 || (s.mark || 0) > 0;
}

/**
 * @param {Content} content
 */
function checkAbilities(content) {
  const abilities = content.abilities;
  if (!Array.isArray(abilities)) throw new Error('Inhalte unvollständig: content.abilities fehlt');
  for (let age = 0; age < content.ages.length; age++) {
    const def = abilities[age];
    if (!isObject(def)) throw new Error(`Für ${ageLabel(content, age)} fehlt die Fähigkeit (content.abilities)`);
    for (const key of ABILITY_NUMBERS) {
      if (!isNumber(def[key])) throw new Error(`Fähigkeit für ${ageLabel(content, age)}: ${key} fehlt oder ist keine Zahl`);
    }
  }
}

/**
 * Ein Satz Wege, der ab einem Zeitalter gilt (Stufe einer sich wandelnden Karte; die Grundwege sind Stufe 0).
 * @typedef {object} PathSet
 * @property {number} from Zeitalter (Index in map.stages), ab dem der Satz gilt
 * @property {PathCurve[]} paths Kurven der Wege
 * @property {[number, number][][]} waypoints Wegpunkte der Wege (für die Luftlinien)
 * @property {boolean} follow Ob Flieger den Wegen folgen
 */

/**
 * Baut die Kurven eines Satzes Wege und prüft die gemeinsamen Regeln: gültige Wegpunkte, alle enden auf dem Feld der Basis, kein
 * Weg über ein gesperrtes Feld. Für Stufen (`strict`) außerdem die Regeln aus MapDef.paths: Der Eingang liegt genau ein Feld
 * außerhalb des Spielfelds, alle übrigen Wegpunkte außer der Basis liegen im Spielfeld.
 * @param {MapDef} map
 * @param {unknown} list Die Wege
 * @param {string} label Bezeichnung für Fehlermeldungen, z. B. 'Karte "x"' oder 'Karte "x", Stufe 2'
 * @param {[number, number] | null} base Feld der Basis, auf dem alle Wege enden müssen; null = das Ende von Weg 0
 * @param {boolean} strict
 * @returns {PathCurve[]}
 */
function buildPathSet(map, list, label, base, strict) {
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${label} hat keinen Weg`);
  const { width, height } = map;
  /** @param {number} x @param {number} z */
  const inside = (x, z) => x >= 0 && x < width && z >= 0 && z < height;
  /** @param {number} x @param {number} z */
  const justOutside = (x, z) => !inside(x, z) && x >= -1 && x <= width && z >= -1 && z <= height && (x >= 0 && x < width) !== (z >= 0 && z < height);
  /** @type {Set<string>} */
  const blocked = new Set();
  for (const tile of map.blocked) blocked.add(`${tile[0]},${tile[1]}`);
  /** @type {PathCurve[]} */
  const paths = [];
  for (let i = 0; i < list.length; i++) {
    const waypoints = list[i];
    let curve;
    try {
      if (!Array.isArray(waypoints) || waypoints.some((point) => !Array.isArray(point) || point.length !== 2)) throw new Error('Wegpunkte müssen Felder [tx, tz] sein');
      curve = buildPath(waypoints, width, height);
    } catch (error) {
      throw new Error(`${label}, Weg ${i}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (strict) {
      const [ex, ez] = waypoints[0];
      if (!justOutside(ex, ez)) throw new Error(`${label}, Weg ${i}: Der Eingang (${ex}, ${ez}) muss genau ein Feld außerhalb des Spielfelds liegen`);
      for (let k = 1; k + 1 < waypoints.length; k++) {
        if (!inside(waypoints[k][0], waypoints[k][1])) throw new Error(`${label}, Weg ${i}: Wegpunkt ${k} (${waypoints[k][0]}, ${waypoints[k][1]}) liegt außerhalb des Spielfelds`);
      }
    }
    const tiles = curve.tiles;
    const [x, z] = tiles[tiles.length - 1];
    const [endX, endZ] = base ?? (paths.length > 0 ? paths[0].tiles[paths[0].tiles.length - 1] : [x, z]);
    if (x !== endX || z !== endZ) {
      throw new Error(base
        ? `${label}, Weg ${i}: Alle Wege aller Stufen müssen auf dem Feld der Basis (${endX}, ${endZ}) enden, dieser endet aber auf (${x}, ${z})`
        : `${label}: Alle Wege müssen auf demselben Feld enden, Weg 0 endet aber auf (${endX}, ${endZ}) und Weg ${i} auf (${x}, ${z})`);
    }
    for (const [tx, tz] of tiles) {
      if (blocked.has(`${tx},${tz}`)) throw new Error(`${label}, Weg ${i}: führt über das gesperrte Feld (${tx}, ${tz})`);
    }
    paths.push(curve);
  }
  return paths;
}

/**
 * Sucht die Karte, baut ihre Wege und die ihrer Stufen und prüft, dass alle auf demselben Feld enden.
 * @param {Content} content
 * @param {string} mapId
 * @returns {{ map: MapDef, paths: PathCurve[], sets: PathSet[] }}
 */
function checkMap(content, mapId) {
  const maps = content.maps;
  if (!Array.isArray(maps)) throw new Error('Inhalte unvollständig: content.maps fehlt');
  const map = maps.find((candidate) => candidate && candidate.id === mapId);
  if (!map) throw new Error(`Unbekannte Karte "${mapId}" (vorhanden: ${maps.map((candidate) => candidate && candidate.id).join(', ') || 'keine'})`);
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1) {
    throw new Error(`Karte "${mapId}": width und height müssen ganze Zahlen ab 1 sein, sind aber ${map.width} und ${map.height}`);
  }
  if (!Array.isArray(map.paths) || map.paths.length === 0) throw new Error(`Karte "${mapId}" hat keinen Weg`);
  if (!Array.isArray(map.blocked)) throw new Error(`Karte "${mapId}": blocked fehlt (leere Liste, wenn kein Feld gesperrt ist)`);
  for (let i = 0; i < map.blocked.length; i++) {
    const tile = map.blocked[i];
    if (!Array.isArray(tile) || !Number.isInteger(tile[0]) || !Number.isInteger(tile[1])) throw new Error(`Karte "${mapId}": blocked[${i}] ist kein Feld [tx, tz]`);
  }
  const paths = buildPathSet(map, map.paths, `Karte "${mapId}"`, null, false);
  const firstTiles = paths[0].tiles;
  const [endX, endZ] = firstTiles[firstTiles.length - 1];
  /** @type {PathSet[]} */
  const sets = [{ from: 0, paths, waypoints: map.paths, follow: map.flyersFollowPath === true }];
  const stages = /** @type {unknown} */ (map.stages);
  if (stages !== undefined && stages !== null) {
    if (!Array.isArray(stages)) throw new Error(`Karte "${mapId}": stages muss eine Liste sein (je Zeitalter eine Stufe oder null)`);
    for (let s = 0; s < stages.length; s++) {
      const stage = stages[s];
      if (stage === undefined || stage === null) continue;
      const label = `Karte "${mapId}", Stufe ${s}`;
      if (!isObject(stage)) throw new Error(`${label} ist kein Objekt { name, text, paths?, flyersFollowPath? } und nicht null`);
      if (typeof stage.name !== 'string' || stage.name.trim() === '') throw new Error(`${label}: name fehlt (Überschrift für den Zeitalterwechsel)`);
      if (typeof stage.text !== 'string' || stage.text.trim() === '') throw new Error(`${label}: text fehlt (ein bis zwei Sätze, was sich ändert)`);
      if (stage.flyersFollowPath !== undefined && typeof stage.flyersFollowPath !== 'boolean') throw new Error(`${label}: flyersFollowPath muss true oder false sein`);
      const hasPaths = stage.paths !== undefined && stage.paths !== null;
      if (s === 0 && (hasPaths || stage.flyersFollowPath !== undefined)) {
        throw new Error(`${label}: Stufe 0 sind die Grundwege der Karte (paths, flyersFollowPath); sie darf nur name und text tragen`);
      }
      if (!hasPaths && stage.flyersFollowPath === undefined) continue;
      const last = sets[sets.length - 1];
      const own = hasPaths ? buildPathSet(map, stage.paths, label, [endX, endZ], true) : null;
      sets.push({
        from: s,
        paths: own ?? last.paths,
        waypoints: own ? /** @type {[number, number][][]} */ (stage.paths) : last.waypoints,
        follow: typeof stage.flyersFollowPath === 'boolean' ? stage.flyersFollowPath : last.follow,
      });
    }
  }
  checkSpecialTiles(content, map, sets.flatMap((set) => set.paths), endX, endZ);
  return { map, paths, sets };
}

/**
 * Prüft die besonderen Bauplätze einer Karte: im Spielfeld, nicht auf dem Weg, nicht gesperrt (auch nicht am Platz der Basis),
 * jedes Feld nur einmal, nur bekannte Arten aus `balance.tiles`.
 * @param {Content} content
 * @param {MapDef} map
 * @param {PathCurve[]} paths
 * @param {number} baseX Feld der Basis
 * @param {number} baseZ
 */
function checkSpecialTiles(content, map, paths, baseX, baseZ) {
  const list = /** @type {unknown} */ (map.tiles);
  if (list === undefined || list === null) return;
  const mapId = map.id;
  if (!Array.isArray(list)) throw new Error(`Karte "${mapId}": tiles muss eine Liste von { tx, tz, kind } sein`);
  const kinds = isObject(content.balance.tiles) ? /** @type {Record<string, unknown>} */ (content.balance.tiles) : {};
  /** @type {Set<string>} */
  const path = new Set();
  for (let p = 0; p < paths.length; p++) for (const [x, z] of paths[p].tiles) path.add(`${x},${z}`);
  /** @type {Set<string>} */
  const blocked = new Set();
  for (const tile of map.blocked) blocked.add(`${tile[0]},${tile[1]}`);
  /** @type {Set<string>} */
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const where = `Karte "${mapId}": besonderes Feld ${i}`;
    if (!isObject(entry) || !Number.isInteger(entry.tx) || !Number.isInteger(entry.tz)) throw new Error(`${where} ist kein Feld { tx, tz, kind } mit ganzen Zahlen`);
    const tx = /** @type {number} */ (entry.tx);
    const tz = /** @type {number} */ (entry.tz);
    const at = `${where} (${tx}, ${tz})`;
    if (typeof entry.kind !== 'string' || !Object.prototype.hasOwnProperty.call(kinds, entry.kind)) {
      const known = Object.keys(kinds);
      throw new Error(`${at} hat die unbekannte Art "${entry.kind}" (bekannt: ${known.length > 0 ? known.join(', ') : 'keine, balance.tiles fehlt'})`);
    }
    if (tx < 0 || tx >= map.width || tz < 0 || tz >= map.height) throw new Error(`${at} liegt außerhalb des Spielfelds`);
    const key = `${tx},${tz}`;
    if (path.has(key)) throw new Error(`${at} liegt auf dem Weg (in irgendeiner Stufe der Karte)`);
    const nearBase = Math.abs(tx - baseX) <= 1 && Math.abs(tz - baseZ) <= 1 && baseX >= 0 && baseX < map.width && baseZ >= 0 && baseZ < map.height;
    if (blocked.has(key) || nearBase) throw new Error(`${at} liegt auf einem gesperrten Feld${nearBase ? ' (Platz der Basis)' : ''}`);
    if (seen.has(key)) throw new Error(`${at} ist doppelt genannt`);
    seen.add(key);
  }
}

/**
 * Prüft die Inhalte einer Partie und liefert Karte, Schwierigkeitsgrad und Wegkurven.
 * @param {Content} content
 * @param {string} mapId
 * @param {string} difficulty
 * @returns {CheckedContent}
 */
export function checkContent(content, mapId, difficulty) {
  if (!isObject(content)) throw new Error('Inhalte fehlen: SimConfig.content ist kein Objekt');
  if (!Array.isArray(content.ages) || content.ages.length === 0) throw new Error('Inhalte ohne Zeitalter: content.ages ist leer');
  checkBalance(content);
  const difficultyDef = checkDifficulty(content.balance, difficulty);
  const { map, paths, sets } = checkMap(content, mapId);
  checkEnemies(content);
  checkWaves(content, (age) => {
    let count = sets[0].paths.length;
    for (const set of sets) if (set.from <= age) count = set.paths.length;
    return count;
  });
  checkArchetypes(content);
  checkAbilities(content);
  checkBoons(content);
  checkModifiers(content);
  return { map, difficulty: difficultyDef, paths, sets };
}

/**
 * Prüft, dass `value` ein Objekt ist, das nur die genannten Zahlenfelder hat, jedes eine Zahl (mit `positive` größer als 0,
 * sonst ab 0).
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @param {string} where
 * @param {boolean} positive
 */
function checkFactors(value, keys, where, positive) {
  if (!isObject(value)) throw new Error(`${where} ist kein Objekt`);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${where}: unbekanntes Feld "${key}" (erlaubt: ${keys.join(', ')})`);
    const v = value[key];
    if (!isNumber(v) || (positive ? v <= 0 : v < 0)) throw new Error(`${where}.${key} muss eine Zahl ${positive ? 'größer als 0' : 'ab 0'} sein, ist aber ${v}`);
  }
}

/**
 * Prüft die Zeitgaben (`content.boons`, freiwillig) und `balance.boons`.
 * @param {Content} content
 */
function checkBoons(content) {
  const conf = /** @type {unknown} */ (content.balance.boons);
  if (conf !== undefined && conf !== null) {
    if (!isObject(conf) || !Number.isInteger(conf.offer) || /** @type {number} */ (conf.offer) < 1) {
      throw new Error(`balance.boons.offer muss eine ganze Zahl ab 1 sein, ist aber ${isObject(conf) ? conf.offer : conf}`);
    }
  }
  const list = /** @type {unknown} */ (content.boons);
  if (list === undefined || list === null) return;
  if (!Array.isArray(list)) throw new Error('content.boons muss eine Liste von Zeitgaben sein');
  // Filter `roles` nennen Plätze, `weapons` und `requires.weapons` Waffen.
  const roles = contentSlots(content).map((slot) => slot.id);
  const weapons = content.archetypes.map((arch) => arch.id);
  const kinds = isObject(content.balance.tiles) ? Object.keys(content.balance.tiles) : [];
  /** @type {string[]} */
  const recipes = [];
  /** Gesperrte Rezepte; jedes darf höchstens eine Gabe freischalten. @type {string[]} */
  const lockedIds = [];
  for (const arch of content.archetypes) {
    for (const recipe of arch.fusion?.recipes ?? []) {
      recipes.push(recipe.id);
      if (recipe.locked === true) lockedIds.push(recipe.id);
    }
  }
  /** @type {string[]} */
  const unlocking = [];
  /** @type {Set<string>} */
  const seen = new Set();
  list.forEach((boon, index) => {
    if (!isObject(boon)) throw new Error(`content.boons[${index}] ist kein Objekt`);
    if (typeof boon.id !== 'string' || boon.id === '') throw new Error(`content.boons[${index}]: id fehlt`);
    const where = `Zeitgabe "${boon.id}"`;
    if (seen.has(boon.id)) throw new Error(`${where} ist doppelt`);
    seen.add(boon.id);
    for (const key of /** @type {const} */ (['name', 'text', 'icon'])) {
      if (typeof boon[key] !== 'string' || boon[key] === '') throw new Error(`${where}: ${key} fehlt oder ist kein Text`);
    }
    if (boon.weight !== undefined && (!isNumber(boon.weight) || boon.weight <= 0)) throw new Error(`${where}: weight muss eine Zahl größer als 0 sein`);
    // Eine Zeitgabe, die nur Waffen verlangt, die diese Inhalte gar nicht haben (Inhalte ohne den ganzen Pool), kann nie angeboten
    // werden; ihre Verweise auf Waffen und Rezepte werden dann nicht geprüft.
    const needs = isObject(boon.requires) ? boon.requires.weapons : undefined;
    if (Array.isArray(needs) && needs.length > 0 && needs.every((w) => typeof w === 'string' && !weapons.includes(w))) return;
    if (boon.requires !== undefined) {
      if (!isObject(boon.requires)) throw new Error(`${where}: requires ist kein Objekt`);
      const need = boon.requires;
      for (const key of Object.keys(need)) if (!['tiles', 'flying', 'fusion', 'weapons'].includes(key)) throw new Error(`${where}.requires: unbekanntes Feld "${key}"`);
      if (need.weapons !== undefined && (!Array.isArray(need.weapons) || need.weapons.length === 0 || need.weapons.some((w) => !weapons.includes(w)))) throw new Error(`${where}.requires.weapons nennt eine unbekannte Waffe`);
      if (need.tiles !== undefined && (!Array.isArray(need.tiles) || need.tiles.some((k) => !kinds.includes(k)))) throw new Error(`${where}.requires.tiles nennt eine unbekannte Art`);
      for (const key of /** @type {const} */ (['flying', 'fusion'])) if (need[key] !== undefined && typeof need[key] !== 'boolean') throw new Error(`${where}.requires.${key} muss true oder false sein`);
    }
    const effect = boon.effect;
    if (!isObject(effect)) throw new Error(`${where}: effect fehlt oder ist kein Objekt`);
    for (const key of Object.keys(effect)) {
      if (!['towers', 'economy', 'ability', 'grant', 'rules', 'recipe'].includes(key)) throw new Error(`${where}.effect: unbekanntes Feld "${key}"`);
    }
    if (effect.recipe !== undefined) {
      const id = effect.recipe;
      if (typeof id !== 'string' || !recipes.includes(id)) throw new Error(`${where}.effect.recipe nennt das unbekannte Rezept "${id}"`);
      if (!lockedIds.includes(id)) throw new Error(`${where}.effect.recipe: Das Rezept "${id}" ist nicht gesperrt (locked), freischalten ist sinnlos`);
      if (unlocking.includes(id)) throw new Error(`${where}.effect.recipe: Das Rezept "${id}" schaltet schon eine andere Zeitgabe frei`);
      unlocking.push(id);
    }
    if (effect.towers !== undefined) {
      if (!Array.isArray(effect.towers)) throw new Error(`${where}.effect.towers muss eine Liste sein`);
      effect.towers.forEach((entry, k) => {
        const at = `${where}.effect.towers[${k}]`;
        if (!isObject(entry)) throw new Error(`${at} ist kein Objekt`);
        for (const key of Object.keys(entry)) {
          if (!['mod', 'hitsAir', 'roles', 'weapons', 'branch', 'tiles', 'super', 'recipe'].includes(key)) throw new Error(`${at}: unbekanntes Feld "${key}"`);
        }
        checkMod(entry.mod, `${at}.mod`);
        if (isObject(entry.mod) && entry.mod.set !== undefined) throw new Error(`${at}.mod: set ist für Zeitgaben nicht erlaubt (nur mul und add)`);
        if (entry.hitsAir !== undefined && entry.hitsAir !== true) throw new Error(`${at}.hitsAir darf nur true sein`);
        if (entry.roles !== undefined && (!Array.isArray(entry.roles) || entry.roles.some((r) => !roles.includes(r)))) throw new Error(`${at}.roles nennt eine unbekannte Rolle (erlaubt sind Plätze; einzelne Waffen nennt weapons)`);
        if (entry.weapons !== undefined && (!Array.isArray(entry.weapons) || entry.weapons.some((w) => !weapons.includes(w)))) throw new Error(`${at}.weapons nennt eine unbekannte Waffe`);
        if (entry.branch !== undefined && (!Number.isInteger(entry.branch) || /** @type {number} */ (entry.branch) < 0 || /** @type {number} */ (entry.branch) > 1)) throw new Error(`${at}.branch muss 0 oder 1 sein`);
        if (entry.tiles !== undefined && (!Array.isArray(entry.tiles) || entry.tiles.some((t) => !kinds.includes(t)))) throw new Error(`${at}.tiles nennt eine unbekannte Art`);
        if (entry.super !== undefined && typeof entry.super !== 'boolean') throw new Error(`${at}.super muss true oder false sein`);
        if (entry.recipe !== undefined && !recipes.includes(/** @type {string} */ (entry.recipe))) throw new Error(`${at}.recipe nennt das unbekannte Rezept "${entry.recipe}"`);
      });
    }
    if (effect.economy !== undefined) checkFactors(effect.economy, ['bounty', 'waveBonus', 'early', 'build', 'upgrade', 'modernize', 'fuse', 'sell'], `${where}.effect.economy`, false);
    if (effect.ability !== undefined) checkFactors(effect.ability, ['cooldown', 'rewind', 'slowDuration'], `${where}.effect.ability`, false);
    if (effect.grant !== undefined) {
      const grant = effect.grant;
      if (!isObject(grant)) throw new Error(`${where}.effect.grant ist kein Objekt`);
      for (const key of Object.keys(grant)) if (key !== 'lives' && key !== 'gold') throw new Error(`${where}.effect.grant: unbekanntes Feld "${key}"`);
      if (grant.lives !== undefined && !Number.isInteger(grant.lives)) throw new Error(`${where}.effect.grant.lives muss eine ganze Zahl sein`);
      if (grant.gold !== undefined && (!isNumber(grant.gold) || grant.gold < 0)) throw new Error(`${where}.effect.grant.gold muss eine Zahl ab 0 sein`);
    }
    if (effect.rules !== undefined) {
      checkFactors(effect.rules, ['burnSpread', 'burnOnSlowed', 'airDamage', 'bossDamage', 'megaLimit'], `${where}.effect.rules`, false);
      const megaLimit = /** @type {Record<string, unknown>} */ (effect.rules).megaLimit;
      if (megaLimit !== undefined && !Number.isInteger(megaLimit)) throw new Error(`${where}.effect.rules.megaLimit muss eine ganze Zahl sein`);
    }
  });
}

/** Erlaubte Bedingungen einer Eigenart. */
const MODIFIER_NEEDS = ['flying', 'ground', 'armored', 'shielded', 'swarm'];

/**
 * Prüft die Eigenarten der Wellen (`content.modifiers`, freiwillig) und `balance.modifiers`.
 * @param {Content} content
 */
function checkModifiers(content) {
  const conf = /** @type {unknown} */ (content.balance.modifiers);
  if (conf !== undefined && conf !== null) {
    if (!isObject(conf) || !Number.isInteger(conf.perAge) || /** @type {number} */ (conf.perAge) < 0) {
      throw new Error(`balance.modifiers.perAge muss eine ganze Zahl ab 0 sein, ist aber ${isObject(conf) ? conf.perAge : conf}`);
    }
  }
  const all = /** @type {unknown} */ (content.modifiers);
  if (all === undefined || all === null) return;
  if (!isObject(all) || Array.isArray(all)) throw new Error('content.modifiers muss ein Objekt sein: je Eigenart einer Welle ein Eintrag');
  for (const id of Object.keys(all)) {
    const def = all[id];
    const where = `Eigenart "${id}"`;
    if (!isObject(def)) throw new Error(`${where} ist kein Objekt`);
    for (const key of Object.keys(def)) {
      if (!['name', 'text', 'icon', 'color', 'enemy', 'air', 'towers', 'bonus', 'needs', 'weight'].includes(key)) throw new Error(`${where}: unbekanntes Feld "${key}"`);
    }
    for (const key of /** @type {const} */ (['name', 'text', 'icon'])) {
      if (typeof def[key] !== 'string' || def[key] === '') throw new Error(`${where}: ${key} fehlt oder ist kein Text`);
    }
    if (typeof def.color !== 'string' && !isNumber(def.color)) throw new Error(`${where}: color fehlt oder ist keine Farbe`);
    for (const part of /** @type {const} */ (['enemy', 'air'])) {
      if (def[part] !== undefined) checkFactors(def[part], ['hp', 'speed', 'armor', 'shield', 'bounty', 'count'], `${where}.${part}`, true);
    }
    if (def.towers !== undefined) {
      checkMod(def.towers, `${where}.towers`);
      if (isObject(def.towers) && def.towers.set !== undefined) throw new Error(`${where}.towers: set ist nicht erlaubt (nur mul und add)`);
    }
    if (def.bonus !== undefined && (!isNumber(def.bonus) || def.bonus < 0)) throw new Error(`${where}: bonus muss eine Zahl ab 0 sein`);
    if (def.weight !== undefined && (!isNumber(def.weight) || def.weight <= 0)) throw new Error(`${where}: weight muss eine Zahl größer als 0 sein`);
    if (def.needs !== undefined && (!Array.isArray(def.needs) || def.needs.some((n) => !MODIFIER_NEEDS.includes(n)))) {
      throw new Error(`${where}: needs kennt nur ${MODIFIER_NEEDS.join(', ')}`);
    }
  }
}

/**
 * Prüft Zeitgaben und offenes Angebot eines Spielstands und liefert sie (fehlen sie: keine). Bekannte, nicht doppelte Kennungen;
 * das Angebot nennt nichts schon Gewähltes und höchstens `balance.boons.offer` Gaben.
 * @param {SaveData} save
 * @param {Content} content
 * @returns {{ boons: string[], offer: string[] }}
 */
export function checkSavedBoons(save, content) {
  const known = (content.boons ?? []).map((boon) => boon.id);
  const size = content.balance.boons ? content.balance.boons.offer : 3;
  /** @param {unknown} raw @param {string} key */
  const list = (raw, key) => {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) throw new Error(`Spielstand unlesbar: ${key} muss eine Liste von Zeitgaben sein`);
    /** @type {string[]} */
    const out = [];
    for (const id of raw) {
      if (typeof id !== 'string' || !known.includes(id)) throw new Error(`Spielstand unlesbar: ${key} nennt die unbekannte Zeitgabe "${id}"`);
      if (out.includes(id)) throw new Error(`Spielstand unlesbar: ${key} nennt die Zeitgabe "${id}" doppelt`);
      out.push(id);
    }
    return out;
  };
  const boons = list(save.boons, 'boons');
  const offer = list(save.boonOffer, 'boonOffer');
  if (offer.length > size) throw new Error(`Spielstand unlesbar: boonOffer nennt ${offer.length} Zeitgaben (höchstens ${size})`);
  for (const id of offer) if (boons.includes(id)) throw new Error(`Spielstand unlesbar: Die Zeitgabe "${id}" ist gewählt und zugleich im Angebot`);
  return { boons, offer };
}

/**
 * Prüft die freigeschalteten Rezepte eines Spielstands und liefert sie (fehlen sie: keine). Bekannte, gesperrte, nicht doppelte
 * Kennungen.
 * @param {SaveData} save
 * @param {Content} content
 * @returns {string[]}
 */
export function checkSavedRecipes(save, content) {
  const raw = /** @type {unknown} */ (save.recipes);
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('Spielstand unlesbar: recipes muss eine Liste von Rezepten sein');
  /** @type {string[]} */
  const locked = [];
  for (const arch of content.archetypes) for (const recipe of arch.fusion?.recipes ?? []) if (recipe.locked === true) locked.push(recipe.id);
  /** @type {string[]} */
  const out = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !locked.includes(id)) throw new Error(`Spielstand unlesbar: recipes nennt "${id}", das kein gesperrtes Rezept ist`);
    if (out.includes(id)) throw new Error(`Spielstand unlesbar: recipes nennt das Rezept "${id}" doppelt`);
    out.push(id);
  }
  return out;
}

/**
 * Prüft die Eckdaten eines Spielstands gegen die Konfiguration der Partie. Die Türme prüft die Simulation selbst,
 * weil sie dazu Karte und Rollen kennen muss.
 * @param {SaveData} save
 * @param {SimConfig} config
 * @param {number} totalWaves Anzahl der Wellen des Feldzugs
 */
export function checkSave(save, config, totalWaves) {
  if (!isObject(save)) throw new Error('Spielstand unlesbar: kein Objekt');
  if (save.version !== 1) throw new Error(`Spielstand hat die unbekannte Version ${save.version} (erwartet wird 1)`);
  if (save.mapId !== config.mapId) throw new Error(`Spielstand gehört zur Karte "${save.mapId}", geladen werden soll aber "${config.mapId}"`);
  if (save.difficulty !== config.difficulty) {
    throw new Error(`Spielstand gehört zum Schwierigkeitsgrad "${save.difficulty}", geladen werden soll aber "${config.difficulty}"`);
  }
  for (const key of SAVE_NUMBERS) {
    if (!isNumber(save[key])) throw new Error(`Spielstand unlesbar: Feld ${key} fehlt oder ist keine Zahl`);
  }
  if (!Number.isInteger(save.wave) || save.wave < 0 || save.wave >= totalWaves) {
    throw new Error(`Spielstand unlesbar: Welle ${save.wave} gibt es nicht (der Feldzug hat ${totalWaves} Wellen)`);
  }
  if (!Number.isInteger(save.lives) || save.lives < 1) throw new Error(`Spielstand unlesbar: lives muss eine ganze Zahl ab 1 sein, ist aber ${save.lives}`);
  if (!Number.isInteger(save.gold) || save.gold < 0) throw new Error(`Spielstand unlesbar: gold muss eine ganze Zahl ab 0 sein, ist aber ${save.gold}`);
  if (!Number.isInteger(save.score) || save.score < 0) throw new Error(`Spielstand unlesbar: score muss eine ganze Zahl ab 0 sein, ist aber ${save.score}`);
  if (!Array.isArray(save.towers)) throw new Error('Spielstand unlesbar: Feld towers fehlt');
  if (!isObject(save.stats)) throw new Error('Spielstand unlesbar: Feld stats fehlt');
}

/**
 * Prüft die Felder `branch`, `super`, `mega` und `gifts` eines gespeicherten Turms und liefert sie aufgelöst. Fehlen sie (ältere
 * Spielstände), gilt: kein Zweig unter Stufe 3, Zweig 0 auf Stufe 3 einer Rolle mit Zweigen, keine Superwaffe, keine Megawaffe,
 * keine Gaben. Eine Superwaffe nennt höchstens `balance.fusion.parts` Gaben, eine Megawaffe mehr als das.
 * @param {SaveData['towers'][number]} entry Der gespeicherte Turm; Rolle, Technikstand und Stufe sind schon geprüft
 * @param {TowerArchetypeDef} arch Seine Rolle
 * @param {Content} content
 * @param {string} where Bezeichnung für Fehlermeldungen, z. B. 'Spielstand unlesbar: Turm 3'
 * @param {readonly string[]} [unlocked] Freigeschaltete Rezepte des Spielstands (für Superwaffen ohne gespeichertes `recipe`)
 * @param {readonly string[]} [loadout] Bewaffnung der Partie; Turm und Gaben müssen daraus stammen (ohne Angabe ungeprüft)
 * @returns {{ branch: number, super: boolean, mega: boolean, gifts: string[], giftBranches: number[], recipe: string }}
 */
export function checkSavedTower(entry, arch, content, where, unlocked, loadout) {
  const label = `${where} ("${arch.id}")`;
  if (loadout && !loadout.includes(arch.id)) throw new Error(`${label}: Die Waffe gehört nicht zur Bewaffnung des Spielstands (${loadout.join(', ')})`);
  const top = entry.level >= 3;
  const count = top && Array.isArray(arch.branches) ? arch.branches.length : 0;
  /** @type {unknown} */
  const rawBranch = entry.branch;
  let branch = count > 0 ? 0 : -1;
  if (rawBranch !== undefined && rawBranch !== null) {
    if (typeof rawBranch !== 'number' || !Number.isInteger(rawBranch) || rawBranch < -1) throw new Error(`${label} hat den ungültigen Ausbauzweig ${rawBranch}`);
    if (count === 0 && rawBranch !== -1) {
      throw new Error(`${label} nennt den Ausbauzweig ${rawBranch}, hat aber ${top ? 'keine Ausbauzweige' : `erst Stufe ${entry.level}`}`);
    }
    if (count > 0 && rawBranch >= count) throw new Error(`${label} hat den unbekannten Ausbauzweig ${rawBranch} (vorhanden: 0 bis ${count - 1})`);
    // -1 auf Stufe 3 einer Rolle mit Zweigen stammt aus einem Spielstand vor den Zweigen: Es gilt Zweig 0.
    if (rawBranch >= 0) branch = rawBranch;
  }
  /** @type {unknown} */
  const rawSuper = entry.super;
  if (rawSuper !== undefined && rawSuper !== null && typeof rawSuper !== 'boolean') throw new Error(`${label}: super muss true oder false sein, ist aber ${rawSuper}`);
  const fused = rawSuper === true;
  /** @type {unknown} */
  const rawGifts = entry.gifts;
  if (rawGifts !== undefined && rawGifts !== null && !Array.isArray(rawGifts)) throw new Error(`${label}: gifts muss eine Liste von Rollen sein`);
  const gifts = Array.isArray(rawGifts) ? rawGifts.slice() : [];
  /** @type {unknown} */
  const rawMega = entry.mega;
  if (rawMega !== undefined && rawMega !== null && typeof rawMega !== 'boolean') throw new Error(`${label}: mega muss true oder false sein, ist aber ${rawMega}`);
  const mega = rawMega === true;
  if (!fused) {
    if (mega) throw new Error(`${label} ist als Megawaffe gespeichert, aber nicht als Superwaffe`);
    if (gifts.length > 0) throw new Error(`${label} nennt Gaben (gifts), ist aber keine Superwaffe`);
    if (entry.recipe !== undefined && entry.recipe !== null && entry.recipe !== '') throw new Error(`${label} nennt ein Rezept, ist aber keine Superwaffe`);
    return { branch, super: false, mega: false, gifts: [], giftBranches: [], recipe: '' };
  }
  if (!top) throw new Error(`${label} ist als Superwaffe gespeichert, hat aber erst Stufe ${entry.level}`);
  if (!arch.fusion || !isObject(content.balance.fusion)) throw new Error(`${label} ist als Superwaffe gespeichert, aber die Rolle kann nicht verschmelzen`);
  if (gifts.length === 0) throw new Error(`${label} ist als Superwaffe gespeichert, nennt aber keine Gaben (gifts)`);
  const parts = /** @type {{ parts: number }} */ (content.balance.fusion).parts;
  if (mega && gifts.length <= parts) throw new Error(`${label} ist als Megawaffe gespeichert, nennt aber nur ${gifts.length} Gaben (eine Megawaffe hat mehr als ${parts})`);
  if (!mega && gifts.length > parts) throw new Error(`${label} nennt ${gifts.length} Gaben, ist aber keine Megawaffe (eine Superwaffe hat höchstens ${parts})`);
  /** @type {unknown} */
  const rawGiftBranches = entry.giftBranches;
  if (rawGiftBranches !== undefined && rawGiftBranches !== null && (!Array.isArray(rawGiftBranches) || rawGiftBranches.length !== gifts.length)) {
    throw new Error(`${label}: giftBranches muss eine Liste mit so vielen Einträgen wie gifts sein`);
  }
  /** @type {number[]} */
  const giftBranches = [];
  for (let g = 0; g < gifts.length; g++) {
    const giver = content.archetypes.find((candidate) => candidate.id === gifts[g]);
    if (!giver) throw new Error(`${label} nennt die unbekannte Rolle "${gifts[g]}" als Gabe`);
    if (!giver.fusion) throw new Error(`${label} nennt die Rolle "${giver.id}" als Gabe, die nicht verschmelzen kann`);
    if (loadout && !loadout.includes(giver.id)) throw new Error(`${label} nennt die Waffe "${giver.id}" als Gabe, die nicht zur Bewaffnung des Spielstands gehört`);
    const own = Array.isArray(giver.branches) ? giver.branches.length : 0;
    // Ältere Spielstände ohne giftBranches: Zweig 0 (bzw. -1 für Rollen ohne Zweige).
    let b = own > 0 ? 0 : -1;
    if (Array.isArray(rawGiftBranches)) {
      const raw = /** @type {unknown} */ (rawGiftBranches[g]);
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < -1 || raw >= Math.max(own, 1) || (own === 0 && raw > -1 && raw !== 0)) {
        throw new Error(`${label} nennt für die Gabe "${giver.id}" den ungültigen Zweig ${raw}`);
      }
      if (own > 0 && raw >= 0) b = raw;
    }
    giftBranches.push(b);
  }
  // Rezept: gespeichert (es muss zu Kern und ersten Zutaten passen) oder, bei älteren Spielständen, nach den freigeschalteten.
  /** @type {unknown} */
  const rawRecipe = entry.recipe;
  let recipe = '';
  if (rawRecipe === undefined || rawRecipe === null) {
    const found = fusionRecipe(arch, gifts, unlocked ?? [], content);
    recipe = found ? found.id : '';
  } else {
    if (typeof rawRecipe !== 'string') throw new Error(`${label}: recipe muss eine Kennung oder '' sein`);
    const found = fusionRecipe(arch, gifts, rawRecipe, content);
    if (rawRecipe !== '' && (!found || found.id !== rawRecipe)) throw new Error(`${label} nennt das Rezept "${rawRecipe}", das zu Kern und Zutaten nicht passt`);
    // Ein Rezept ohne Sperre (die Flak) gilt immer, auch wenn '' gespeichert ist.
    recipe = found ? found.id : '';
  }
  return { branch, super: true, mega, gifts, giftBranches, recipe };
}
