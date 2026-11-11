// @ts-check
// Rezepte in der Oberfläche (docs/briefs/fusion.md, 8 und 11): die Formel eines Rezepts als Rollensymbole (Kern + Zutaten),
// die Rätselzeile für noch nicht entdeckte Rezepte, das Rezeptbuch des Profils und die kurze Liste der in einer Partie
// freigeschalteten Rezepte. Das Buch selbst liegt in der Spielsteuerung (src/game/recipebook.js) und kommt über die Aktionen.
//
// Unentdeckte Rezepte verraten nur die Kernrolle und ob die Zutaten gleich oder verschieden sind, z. B. „Bremser als Kern,
// zwei gleiche Zutaten“; die Zutaten selbst bleiben Fragezeichen.

import { el } from './dom.js';
import { icon } from './icons.js';
import { actionsOf, roleDot } from './common.js';
import { isClassic, recipeFits, recipeWeapons, weaponById } from '../sim/rules.js';
import { slotHasChoice, weaponName } from './loadout.js';

/** @import { UiDeps } from '../types/app' */
/** @import { Content, FusionRecipe, TowerArchetypeDef } from '../types/content' */
/** @import { RecipeBook, RecipeFind } from '../game/recipebook.js' */

/** @typedef {{ recipe: FusionRecipe, arch: TowerArchetypeDef }} RecipeEntry */

/** Wie ein Rezept ins Buch kam, als Satzende („Zuerst …“). */
export const FIND_TEXT = /** @type {Record<RecipeFind, string>} */ ({
  boon: 'durch einen Bauplan',
  boss: 'durch einen makellos besiegten Zwischenboss',
  built: 'selbst verschmolzen',
  hint: 'beim Verschmelzen entdeckt',
});

/** Grund einer Freischaltung in der Partie, für die Ansage. */
export const REASON_TEXT = { boon: 'Bauplan', boss: 'Zwischenboss makellos besiegt' };

/**
 * Alle Rezepte in der Reihenfolge der Rollen, dann der Rezepte (die Flak zuerst).
 * @param {Content} content
 * @returns {RecipeEntry[]}
 */
export function allRecipes(content) {
  /** @type {RecipeEntry[]} */
  const out = [];
  for (const arch of content.archetypes) {
    for (const recipe of (arch.fusion && arch.fusion.recipes) || []) out.push({ recipe, arch });
  }
  return out;
}

/**
 * Das Rezeptbuch (leer, wenn die Spielsteuerung keins führt, etwa auf einer Testseite).
 * @param {UiDeps} deps
 * @returns {Readonly<RecipeBook>}
 */
export function bookOf(deps) {
  const a = actionsOf(deps);
  return typeof a.recipeBook === 'function' ? a.recipeBook() : {};
}

/**
 * Trägt ein Rezept ins Buch ein; true, wenn es neu ist.
 * @param {UiDeps} deps
 * @param {string} id
 * @param {RecipeFind} how
 * @returns {boolean}
 */
export function discover(deps, id, how) {
  const a = actionsOf(deps);
  return typeof a.discoverRecipe === 'function' ? a.discoverRecipe(id, how) : false;
}

/**
 * Ob ein Rezept in dieser Partie wirkt (nie gesperrt oder freigeschaltet).
 * @param {FusionRecipe} recipe
 * @param {readonly string[]} unlocked `SimState.recipes`
 * @returns {boolean}
 */
export function recipeOpen(recipe, unlocked) {
  return !recipe.locked || unlocked.includes(recipe.id);
}

/**
 * Name zu einer Zutat: eine Waffe des Pools heißt wie sie selbst, ein Platz wie seine Aufgabe.
 * @param {Content} content
 * @param {string} id
 * @returns {string}
 */
function roleName(content, id) {
  const arch = weaponById(content, id);
  if (!arch) return id;
  return isClassic(arch) ? arch.role : weaponName(arch);
}

/**
 * Dativ eines Namens („mit … Schützen“, „mit … Bremsern“); schwache Wörter auf -e bekommen auch im Singular ein -n.
 * @param {string} word
 * @param {boolean} plural
 * @returns {string}
 */
function dative(word, plural) {
  if (word.endsWith('e')) return word + 'n';
  return plural && !word.endsWith('n') ? word + 'n' : word;
}

/**
 * Name des Kerns eines Rezepts: die Waffe, bei der es steht (Waffen des Pools mit eigenem Namen, sonst die Aufgabe).
 * @param {TowerArchetypeDef} arch
 * @returns {string}
 */
export function coreName(arch) {
  return isClassic(arch) ? arch.role : weaponName(arch);
}

/** @param {number} n @returns {string} */
function countWord(n) {
  return ['keine', 'eine', 'zwei', 'drei', 'vier'][n] ?? String(n);
}

/**
 * Die Zutaten eines Rezepts in Worten, im Dativ nach „mit“, z. B. „zwei Schützen“ oder „Werfer und Brenner“. Hat ein Platz
 * mehrere Waffen, steht „beliebig“ dabei („zwei beliebigen Bremsern“); eine Zutat, die eine Waffe nennt, heißt wie sie.
 * @param {Content} content
 * @param {FusionRecipe} recipe
 * @returns {string}
 */
export function recipeParts(content, recipe) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const id of recipe.gifts) counts.set(id, (counts.get(id) ?? 0) + 1);
  /** @type {string[]} */
  const parts = [];
  for (const [id, n] of counts) {
    const arch = weaponById(content, id);
    const any = !!arch && isClassic(arch) && slotHasChoice(content, id);
    const word = roleName(content, id);
    if (n === 1) parts.push(any ? `einem beliebigen ${dative(word, false)}` : word);
    else parts.push(`${countWord(n)} ${any ? 'beliebigen ' : ''}${dative(word, true)}`);
  }
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1] : parts.join('');
}

/**
 * Für waffengebundene Rezepte: welche Waffen es braucht und ob die Bewaffnung der laufenden Partie sie hat. null für Rezepte
 * nach Platz (die jede Bewaffnung bauen kann).
 * @param {Content} content
 * @param {FusionRecipe} recipe
 * @param {readonly string[] | null} loadout Bewaffnung der laufenden Partie oder null
 * @returns {{ names: string, fits: boolean | null } | null}
 */
export function recipeNeeds(content, recipe, loadout) {
  const weapons = recipeWeapons(content, recipe.id);
  if (weapons.length === 0) return null;
  const names = weapons.map((id) => roleName(content, id));
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1] : names[0];
  return { names: list, fits: loadout ? recipeFits(content, recipe.id, loadout) : null };
}

/**
 * Rätselzeile eines unentdeckten Rezepts: Kernrolle und ob die Zutaten gleich oder verschieden sind.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {FusionRecipe} recipe
 * @returns {string}
 */
export function recipeRiddle(content, arch, recipe) {
  const n = recipe.gifts.length;
  const same = recipe.gifts.every((g) => g === recipe.gifts[0]);
  return `${coreName(arch)} als Kern, ${countWord(n)} ${same ? 'gleiche' : 'verschiedene'} Zutaten`;
}

/**
 * Wo ein gesperrtes Rezept zu finden ist: Bauplan, dazu die Zeitalter, deren Zwischenboss es ziehen kann.
 * @param {Content} content
 * @param {FusionRecipe} recipe
 * @returns {string}
 */
export function recipeWhere(content, recipe) {
  if (!recipe.locked) return 'Immer verfügbar.';
  const ages = (recipe.ages || []).map((i) => content.ages[i]).filter(Boolean).map((a) => a.name);
  if (ages.length === 0) return 'Freizuschalten durch einen Bauplan.';
  const list = ages.length > 1 ? ages.slice(0, -1).join(', ') + ' oder ' + ages[ages.length - 1] : ages[0];
  return `Freizuschalten durch einen Bauplan oder den makellos besiegten Zwischenboss (${list}).`;
}

/**
 * Eine Waffe des Pools (statt eines ganzen Platzes) bekommt am Symbol einen Rand in ihrer Akzentfarbe.
 * @param {HTMLElement} dot
 * @param {TowerArchetypeDef} arch
 */
function markWeapon(dot, arch) {
  if (isClassic(arch) || !arch.look) return;
  dot.classList.add('zw-roledot-weapon');
  dot.style.setProperty('--weapon', String(arch.look.accent));
}

/**
 * Formel eines Rezepts: Kern als Rollensymbol, dann „+“ und die Zutaten. `hidden` zeigt statt der Zutaten Fragezeichen.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch Kernrolle
 * @param {FusionRecipe} recipe
 * @param {boolean} [hidden]
 * @returns {HTMLElement}
 */
export function recipeFormula(content, arch, recipe, hidden = false) {
  const box = el('span', 'zw-formula');
  box.setAttribute('aria-label', hidden ? `${coreName(arch)} als Kern, Zutaten unbekannt` : `${coreName(arch)} als Kern mit ${recipeParts(content, recipe)}`);
  const core = roleDot(arch, 'zw-formula-core');
  core.title = `Kern: ${coreName(arch)}`;
  markWeapon(core, arch);
  box.append(core, el('span', 'zw-formula-plus', '+'));
  for (const id of recipe.gifts) {
    const gift = content.archetypes.find((a) => a.id === id);
    if (hidden || !gift) {
      box.append(el('span', 'zw-roledot zw-formula-unknown', icon('question')));
    } else {
      const dot = roleDot(gift);
      dot.title = isClassic(gift) ? (slotHasChoice(content, gift.id) ? `beliebiger ${gift.role}` : gift.role) : `${weaponName(gift)} (${gift.role})`;
      markWeapon(dot, gift);
      box.append(dot);
    }
  }
  return box;
}

/**
 * Name der Rezept-Superwaffe in einem Zeitalter (oder der Kurzname des Rezepts).
 * @param {TowerArchetypeDef} arch
 * @param {FusionRecipe} recipe
 * @param {number} age
 * @returns {string}
 */
export function recipeAgeName(arch, recipe, age) {
  const tier = arch.tiers[age];
  const look = tier && tier.recipes ? tier.recipes[recipe.id] : undefined;
  return look ? look.superName : recipe.name;
}

/**
 * Die in einer Partie freigeschalteten Rezepte als kompakte Liste (Formel und Name) für Pause und Ergebnis; null ohne.
 * @param {Content} content
 * @param {readonly string[]} ids `SimState.recipes`
 * @param {number} age Zeitalter für die Namen
 * @returns {HTMLElement | null}
 */
export function recipeList(content, ids, age) {
  const all = allRecipes(content);
  const items = ids.map((id) => all.find((r) => r.recipe.id === id)).filter((r) => r !== undefined);
  if (items.length === 0) return null;
  const list = el('ul', 'zw-recipelist');
  list.setAttribute('aria-label', 'Freigeschaltete Rezepte');
  for (const { recipe, arch } of items) {
    const name = recipeAgeName(arch, recipe, age);
    const item = el('li', 'zw-recipelist-item', recipeFormula(content, arch, recipe),
      el('span', 'zw-recipelist-text', el('b', '', recipe.name), name !== recipe.name ? el('span', 'zw-recipelist-tag', name) : null));
    item.title = `${recipe.name}: ${recipe.coreText}`;
    list.append(item);
  }
  return list;
}
