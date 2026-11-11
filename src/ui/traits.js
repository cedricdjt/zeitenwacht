// @ts-check
// Eigenschaften der Gegner, abgeleitet aus ihren Daten: Symbol, Name und ein Satz in Worten.
// Dazu, welche Turmrollen eine Eigenschaft kontern.

import { hitsFliers, isClassic } from '../sim/rules.js';
import { weaponForSlot } from './loadout.js';

/** @import { Content, EnemyDef, TowerArchetypeDef } from '../types/content' */

/**
 * @typedef {object} Trait
 * @property {string} id Kennung, zugleich Name des Symbols
 * @property {string} name
 * @property {string} text Erklärung in einem Satz
 * @property {string[]} counters Kennungen der Plätze, die helfen (nur solche, die es in den Inhalten gibt); welche Waffe das in
 *   einer Partie ist, sagt `counterWeapons`
 */

/** Stammdaten der Eigenschaften in der Reihenfolge ihrer Anzeige. */
/** @type {{ id: string, name: string, text: string, counters: string[] }[]} */
export const TRAIT_DEFS = [
  { id: 'boss', name: 'Boss', text: 'Sehr stark, Verlangsamung wirkt nur halb. Kommt er durch, kostet das viele Funken.', counters: ['knacker', 'bremser'] },
  { id: 'flying', name: 'Fliegend', text: 'Fliegt in gerader Luftlinie zur Flamme, über den Weg und alles darauf hinweg. Nur Türme mit dem Flügel-Zeichen treffen ihn.', counters: ['schuetze', 'knacker'] },
  { id: 'armored', name: 'Gepanzert', text: 'Rüstung schluckt einen Teil jedes Treffers. Schwere Treffer und Brand ignorieren sie.', counters: ['knacker', 'brenner'] },
  { id: 'shield', name: 'Schild', text: 'Eine Blase fängt Schaden ab und lädt sich nach kurzer Ruhe wieder auf. Brand verhindert das.', counters: ['brenner', 'knacker'] },
  { id: 'regen', name: 'Regeneriert', text: 'Heilt sich selbst, solange er nicht brennt.', counters: ['brenner', 'knacker'] },
  { id: 'healer', name: 'Heiler', text: 'Heilt andere Gegner in seiner Nähe. Zuerst ausschalten!', counters: ['knacker', 'brenner'] },
  { id: 'carrier', name: 'Träger', text: 'Setzt beim Zerstören seine Insassen an Ort und Stelle aus.', counters: ['werfer', 'brenner'] },
  { id: 'quick', name: 'Schnell', text: 'Deutlich schneller als die anderen. Verlangsamung bremst ihn aus.', counters: ['schuetze', 'bremser'] },
  { id: 'swarm', name: 'Schwarm', text: 'Einzeln schwach, aber sie kommen in Rudeln.', counters: ['werfer', 'brenner'] },
  { id: 'tough', name: 'Zäh', text: 'Hält sehr viel aus und braucht dafür länger.', counters: ['bremser', 'knacker'] },
  { id: 'steady', name: 'Standfest', text: 'Zäh gegen Verlangsamung: Bremsen wirkt bei ihm kaum.', counters: ['knacker', 'schuetze'] },
];

/** @type {WeakMap<EnemyDef, Trait[]>} */
const cache = new WeakMap();
/** @type {WeakMap<Content, Map<string, EnemyDef | null>>} */
const basicCache = new WeakMap();

/**
 * Der Standardgegner eines Zeitalters: ein Bodengegner ohne Besonderheiten, dessen Lebenspunkte dem Richtwert 1 am nächsten sind.
 * @param {Content} content
 * @param {string} ageId
 * @returns {EnemyDef | null}
 */
export function basicEnemy(content, ageId) {
  let map = basicCache.get(content);
  if (!map) {
    map = new Map();
    basicCache.set(content, map);
  }
  if (map.has(ageId)) return map.get(ageId) ?? null;
  /** @type {EnemyDef | null} */
  let best = null;
  let bestScore = Infinity;
  for (const def of Object.values(content.enemies)) {
    if (def.age !== ageId || def.boss) continue;
    let score = Math.abs(def.hp - 1);
    if (def.flying) score += 2;
    if (def.armor > 0 || def.shield > 0 || def.heal || def.spawns) score += 1;
    if (score < bestScore) {
      bestScore = score;
      best = def;
    }
  }
  map.set(ageId, best);
  return best;
}

/**
 * Eigenschaften eines Gegners (wird je Gegnerart einmal berechnet).
 * @param {Content} content
 * @param {EnemyDef} def
 * @returns {Trait[]}
 */
export function enemyTraits(content, def) {
  const cached = cache.get(def);
  if (cached) return cached;
  const basic = basicEnemy(content, def.age);
  const baseSpeed = basic ? basic.speed : 1;
  const baseHp = basic ? basic.hp : 1;
  const baseBounty = basic ? basic.bounty : 1;
  /** @type {Set<string>} */
  const ids = new Set();
  if (def.boss) ids.add('boss');
  if (def.flying) ids.add('flying');
  if (def.armor > 0) ids.add('armored');
  if (def.shield > 0) ids.add('shield');
  if (def.regen > 0) ids.add('regen');
  if (def.heal) ids.add('healer');
  if (def.spawns) ids.add('carrier');
  if (!def.boss && def.speed >= baseSpeed * 1.3) ids.add('quick');
  if (!def.boss && def.hp <= baseHp * 0.5 && def.bounty <= baseBounty * 0.6) ids.add('swarm');
  if (!def.boss && def.hp >= baseHp * 2.5 && def.speed <= baseSpeed) ids.add('tough');
  if (!def.boss && def.slowResist >= 0.5) ids.add('steady');
  /** @type {Trait[]} */
  const traits = [];
  for (const t of TRAIT_DEFS) {
    if (!ids.has(t.id)) continue;
    traits.push({ id: t.id, name: t.name, text: t.text, counters: counterRoles(content, t.id, t.counters) });
  }
  cache.set(def, traits);
  return traits;
}

/**
 * Rollen, die eine Eigenschaft kontern, soweit es sie in den Inhalten gibt. Für Flieger zählt, was die Daten sagen.
 * @param {Content} content
 * @param {string} traitId
 * @param {string[]} preferred
 * @returns {string[]}
 */
function counterRoles(content, traitId, preferred) {
  if (traitId === 'flying') {
    // Plätze, deren klassische Waffe Flieger trifft; in einer Partie gilt, was ihre Bewaffnung trifft (counterWeapons).
    const air = content.archetypes.filter((a) => isClassic(a) && hitsFliers(a)).map((a) => a.id);
    if (air.length > 0) return air.slice(0, 3);
  }
  return preferred.filter((id) => content.archetypes.some((a) => a.id === id));
}

/**
 * Waffen, die gegen eine Eigenschaft helfen: je Platz aus `trait.counters` die Waffe der Bewaffnung (ohne Bewaffnung die
 * klassische). Gegen Flieger zählen in einer Partie die Waffen ihrer Bewaffnung, die Flieger treffen.
 * @param {Content} content
 * @param {Trait} trait
 * @param {readonly string[] | null | undefined} loadout
 * @returns {TowerArchetypeDef[]}
 */
export function counterWeapons(content, trait, loadout) {
  /** @type {TowerArchetypeDef[]} */
  const out = [];
  if (trait.id === 'flying' && loadout) {
    for (const id of loadout) {
      const arch = content.archetypes.find((a) => a.id === id);
      if (arch && hitsFliers(arch) && out.length < 3) out.push(arch);
    }
    return out;
  }
  for (const slot of trait.counters) {
    const arch = weaponForSlot(content, loadout, slot);
    if (arch && !out.includes(arch)) out.push(arch);
  }
  return out;
}

/**
 * Waffen, die gegen einen Gegner helfen: die Konter seiner Eigenschaften in ihrer Reihenfolge, ohne Doppelte, höchstens drei.
 * @param {Content} content
 * @param {EnemyDef} def
 * @param {readonly string[] | null} [loadout] Bewaffnung der Partie; ohne Angabe die klassischen Waffen
 * @returns {TowerArchetypeDef[]}
 */
export function counterArchetypes(content, def, loadout) {
  /** @type {TowerArchetypeDef[]} */
  const out = [];
  for (const trait of enemyTraits(content, def)) {
    for (const arch of counterWeapons(content, trait, loadout)) {
      if (!out.includes(arch) && out.length < 3) out.push(arch);
    }
  }
  return out;
}
