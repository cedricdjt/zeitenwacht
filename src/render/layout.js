// @ts-check
// Gemeinsame Maße der Bühne, damit Welt, Figuren und Effekte dieselbe Geometrie annehmen.

import { PATH_DEPTH } from './terrain.js';

/** @import { Enemy } from '../types/sim' */

export { PATH_DEPTH };

/** Flughöhe fliegender Gegner über dem Boden (Unterkante des Modells). */
export const FLY_HEIGHT = 1.35;

/** Blickwinkel der Spielkamera in Grad. */
export const CAMERA_FOV = 30;

/** Ausgangsansicht der Kamera: Himmelsrichtung (0 = von Süden, +Z), Höhe über dem Horizont, beides in Grad. */
export const CAMERA_AZIMUTH = 18;
export const CAMERA_ELEVATION = 50;

/**
 * Höhe (y) der Standfläche eines Gegners: Läufer stehen auf dem abgesenkten Weg, Flieger schweben.
 * @param {Enemy} enemy
 * @returns {number}
 */
export function enemyBaseY(enemy) {
  return enemy.def.flying ? FLY_HEIGHT : -PATH_DEPTH;
}
