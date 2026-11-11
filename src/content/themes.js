// @ts-check
// Lichtstimmung und Bodenfarbe der Zeitalter für Werkzeuge wie den Modell-Betrachter. Liest aus den Zeitalter-Daten.

import { AGES } from './ages.js';

/** @import { AgeDef } from '../types/content' */
/** @import { LightTheme } from '../types/model' */

/**
 * @param {string} ageId
 * @returns {AgeDef | undefined}
 */
function findAge(ageId) {
  return AGES.find((age) => age.id === ageId);
}

/**
 * Lichtstimmung eines Zeitalters oder null, wenn es das Zeitalter nicht gibt.
 * @param {string} ageId
 * @returns {LightTheme | null}
 */
export function getLightTheme(ageId) {
  const age = findAge(ageId);
  return age ? age.light : null;
}

/**
 * Bodenfarbe eines Zeitalters als '#rrggbb' oder null.
 * @param {string} ageId
 * @returns {string | null}
 */
export function getGroundColor(ageId) {
  const age = findAge(ageId);
  if (!age) return null;
  const color = age.terrain.groundA;
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
}
