// @ts-check
// Waffenpool in der Oberfläche (docs/briefs/fusion.md, 12): Plätze, Bewaffnung einer Partie, Namen von Waffen und Plätzen,
// Rezepte eines Kerns, soweit die Bewaffnung sie bauen kann. Reine Hilfen ohne DOM.

import { contentSlots, isClassic, recipeFits, slotOf, weaponById, weaponsOfSlot } from '../sim/rules.js';

/** @import { Content, FusionRecipe, SlotDef, TowerArchetypeDef } from '../types/content' */

/**
 * Name einer Waffe über alle Zeitalter („Frostturm“); klassische Waffen ohne eigenen Namen heißen wie ihr Platz.
 * @param {TowerArchetypeDef} arch
 * @returns {string}
 */
export function weaponName(arch) {
  return arch.name || arch.role;
}

/**
 * Akzentfarbe und Erkennungszeichen einer Waffe für Vorschaubilder und Karten, oder null (klassische Waffen ohne Zeichen).
 * @param {TowerArchetypeDef} arch
 * @returns {{ accent: string, marker: string, role?: string } | null}
 */
export function weaponLook(arch) {
  const look = arch.look;
  if (!look || !look.marker || look.marker === 'none') return null;
  const accent = typeof look.accent === 'string' ? look.accent : '#' + Number(look.accent).toString(16).padStart(6, '0');
  return { accent, marker: look.marker, role: arch.color };
}

/**
 * Die Eigenart einer Waffe in einer Zeile, aus ihrer Beschreibung: der erste Satzteil (bis Doppelpunkt, Semikolon oder Punkt),
 * etwa „Stampft alle 2,6 s auf“ oder „Greift nicht an, zahlt aber“. `rest` ist der übrige Text (ohne Wiederholung).
 * @param {TowerArchetypeDef} arch
 * @returns {{ gist: string, rest: string }}
 */
export function weaponGist(arch) {
  const text = arch.summary;
  const m = text.match(/^(.{12,}?)(?::\s|;\s|\.\s|\.$)/);
  if (!m) return { gist: text, rest: '' };
  const rest = text.slice(m[0].length).trim();
  // Nach einem Doppelpunkt oder Semikolon geht es klein weiter; als eigener Satz groß beginnen.
  return { gist: m[1], rest: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '' };
}

/**
 * Zeile „Frostturm · Bremser-Platz“ für Waffen des Pools; bei klassischen Waffen nur die Aufgabe („Bremser“).
 * @param {TowerArchetypeDef} arch
 * @returns {string}
 */
export function weaponLine(arch) {
  return isClassic(arch) ? arch.role : `${weaponName(arch)} · ${arch.role}-Platz`;
}

/**
 * Ob ein Platz in diesen Inhalten mehr als eine Waffe hat (dann lohnt es, „beliebig“ dazuzusagen).
 * @param {Content} content
 * @param {string} slot
 * @returns {boolean}
 */
export function slotHasChoice(content, slot) {
  return weaponsOfSlot(content, slot).length > 1;
}

/**
 * Die Waffen einer Bewaffnung in Reihenfolge der Plätze (unbekannte Kennungen fallen weg).
 * @param {Content} content
 * @param {readonly string[]} loadout
 * @returns {TowerArchetypeDef[]}
 */
export function loadoutWeapons(content, loadout) {
  /** @type {TowerArchetypeDef[]} */
  const out = [];
  for (const id of loadout) {
    const arch = weaponById(content, id);
    if (arch) out.push(arch);
  }
  return out;
}

/**
 * Die Waffe, die eine Bewaffnung für einen Platz hat; ohne Bewaffnung (oder ohne Treffer) die klassische des Platzes.
 * @param {Content} content
 * @param {readonly string[] | null | undefined} loadout
 * @param {string} slot
 * @returns {TowerArchetypeDef | null}
 */
export function weaponForSlot(content, loadout, slot) {
  if (loadout) {
    for (const id of loadout) {
      const arch = weaponById(content, id);
      if (arch && slotOf(arch) === slot) return arch;
    }
  }
  const classic = weaponById(content, slot);
  return classic ?? weaponsOfSlot(content, slot)[0] ?? null;
}

/**
 * Der Platz zu einer Kennung (Platz oder Waffe) oder null.
 * @param {Content} content
 * @param {string} id
 * @returns {SlotDef | null}
 */
export function slotDef(content, id) {
  const arch = weaponById(content, id);
  const slot = arch ? slotOf(arch) : id;
  return contentSlots(content).find((s) => s.id === slot) ?? null;
}

/**
 * Ob ein Eintrag einer Rezeptzutat eine bestimmte Waffe meint (statt eines ganzen Platzes).
 * @param {Content} content
 * @param {string} entry
 * @returns {boolean}
 */
export function namesWeapon(content, entry) {
  const arch = weaponById(content, entry);
  return !!arch && !isClassic(arch);
}

/**
 * Rezepte, die für diesen Kern in Frage kommen: seine eigenen, bei einer Waffe des Pools danach die der klassischen Waffe
 * seines Platzes (docs/SIM.md, „Waffenpool“). Mit `loadout` nur, was diese Bewaffnung bauen kann.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {readonly string[]} [loadout]
 * @returns {FusionRecipe[]}
 */
export function coreRecipes(content, arch, loadout) {
  /** @type {FusionRecipe[]} */
  const out = [];
  const own = arch.fusion && arch.fusion.recipes ? arch.fusion.recipes : [];
  out.push(...own);
  if (!isClassic(arch)) {
    const classic = weaponById(content, slotOf(arch));
    if (classic && classic.fusion && classic.fusion.recipes) out.push(...classic.fusion.recipes);
  }
  return loadout ? out.filter((r) => recipeFits(content, r.id, loadout)) : out;
}
