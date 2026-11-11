// @ts-check
// Das Rezeptbuch: Welche Rezepte der Spieler schon einmal entdeckt hat, über alle Partien hinweg (docs/briefs/fusion.md, 11).
// Es ist Wissen und Sammlung, keine Freischaltung: Jede Partie schaltet ihre Rezepte neu frei (`SimState.recipes`).
// Gespeichert im Profil des Browsers (storage.js), nie im Spielstand der Simulation.

import { loadValue, saveValue } from './storage.js';

const KEY = 'recipebook';
const VERSION = 1;

/**
 * Wie ein Rezept zum ersten Mal ins Buch kam: Bauplan (Zeitgabe), Zwischenboss ohne Funkenverlust, gebaut (die Flak) oder
 * nur gesehen (der Hinweis auf die Flak im Verschmelzen-Blatt).
 * @typedef {'boon' | 'boss' | 'built' | 'hint'} RecipeFind
 */

/**
 * Eintrag im Rezeptbuch.
 * @typedef {object} RecipeBookEntry
 * @property {RecipeFind} how
 * @property {number} age Position des Zeitalters, in dem es geschah (ab 0), -1 = unbekannt
 * @property {number} time Zeitpunkt (ms seit 1970)
 */

/** @typedef {Record<string, RecipeBookEntry>} RecipeBook */

const FINDS = ['boon', 'boss', 'built', 'hint'];

/**
 * Liest das Buch aus dem Profil. Verträgt fehlende, alte und kaputte Daten: Eine bloße Liste von Kennungen (denkbare
 * Vorform) zählt als „gesehen“, unlesbare Einträge fallen weg.
 * @returns {RecipeBook}
 */
export function loadRecipeBook() {
  /** @type {unknown} */
  const raw = loadValue(KEY, null);
  /** @type {RecipeBook} */
  const book = {};
  if (Array.isArray(raw)) {
    for (const id of raw) if (typeof id === 'string' && id) book[id] = { how: 'hint', age: -1, time: 0 };
    return book;
  }
  if (!raw || typeof raw !== 'object') return book;
  const found = /** @type {{ found?: unknown }} */ (raw).found;
  if (!found || typeof found !== 'object') return book;
  for (const [id, entry] of Object.entries(/** @type {Record<string, unknown>} */ (found))) {
    if (!id) continue;
    const e = /** @type {Partial<RecipeBookEntry> | null} */ (entry && typeof entry === 'object' ? entry : null);
    const how = e && typeof e.how === 'string' && FINDS.includes(e.how) ? e.how : 'hint';
    const age = e && typeof e.age === 'number' && Number.isFinite(e.age) ? Math.floor(e.age) : -1;
    const time = e && typeof e.time === 'number' && Number.isFinite(e.time) ? e.time : 0;
    book[id] = { how: /** @type {RecipeFind} */ (how), age, time };
  }
  return book;
}

/**
 * Schreibt das Buch ins Profil.
 * @param {RecipeBook} book
 */
export function saveRecipeBook(book) {
  saveValue(KEY, { version: VERSION, found: book });
}

/**
 * Trägt ein Rezept ein, falls es noch fehlt, und speichert. Ein Fund, der mehr verrät als ein bloßer Blick („gesehen“),
 * ersetzt einen früheren Blick, sonst bleibt der erste Eintrag.
 * @param {RecipeBook} book
 * @param {string} id
 * @param {RecipeFind} how
 * @param {number} age
 * @returns {boolean} true, wenn das Rezept neu im Buch ist
 */
export function addToRecipeBook(book, id, how, age) {
  const had = book[id];
  if (had && !(had.how === 'hint' && how !== 'hint')) return false;
  book[id] = { how, age, time: Date.now() };
  saveRecipeBook(book);
  return !had;
}
