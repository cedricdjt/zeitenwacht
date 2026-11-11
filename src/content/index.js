// @ts-check
// Alle Inhalte des Spiels zusammen: das, was die Simulation, die Bühne, die Oberfläche und der Ton als `content` bekommen.
// Reine Daten, kein three.js, kein DOM; läuft auch in Node.

import { ABILITIES } from './abilities.js';
import { AGES } from './ages.js';
import { BALANCE } from './balance.js';
import { BOONS } from './boons.js';
import { ENEMIES } from './enemies.js';
import { MAPS } from './maps.js';
import { MODIFIERS } from './modifiers.js';
import { ACTIVE_AGES, selectAges, selectWeapons } from './scope.js';
import { ARCHETYPES, POOL, SLOTS, WEAPONS } from './towers.js';
import { WAVES } from './waves.js';

/** @import { Content } from '../types/content' */

/** Die Daten aller Zeitalter, auch der noch nicht aktiven, mit allen Waffen des Pools. @type {Content} */
export const fullContent = {
  ages: AGES,
  archetypes: WEAPONS,
  slots: SLOTS,
  enemies: ENEMIES,
  waves: WAVES,
  maps: MAPS,
  abilities: ABILITIES,
  balance: BALANCE,
  boons: BOONS,
  modifiers: MODIFIERS,
};

/**
 * Was eine Partie mit Waffenpool durchläuft: die aktiven Zeitalter aus scope.js und alle Waffen. Die Bewaffnung einer Partie wählt
 * `SimConfig.loadout` ('classic', 'random' oder eine Liste; docs/SIM.md, „Waffenpool“).
 * @type {Content}
 */
export const poolContent = selectAges(fullContent, ACTIVE_AGES);

/**
 * Was eine Partie heute durchläuft: die aktiven Zeitalter und nur die sechs klassischen Waffen. Übergang, bis Oberfläche,
 * Spielsteuerung, Selbstspieler und Darstellung den Waffenpool kennen; danach nimmt das Spiel `poolContent`.
 * @type {Content}
 */
export const content = selectWeapons(poolContent, ARCHETYPES.map((arch) => arch.id));

export { ABILITIES, AGES, ARCHETYPES, BALANCE, BOONS, ENEMIES, MAPS, MODIFIERS, POOL, SLOTS, WAVES, WEAPONS };
