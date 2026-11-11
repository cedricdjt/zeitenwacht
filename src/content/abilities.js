// @ts-check
// Die Zeitglocke (Spielentwurf Kapitel 2.7): die einzige Fähigkeit, die der Spieler von Hand auslöst.
// Je Zeitalter eine Ausprägung; sie unterscheiden sich nur im Begleittext. Reine Daten.

/** @import { AbilityDef } from '../types/content' */

/** Begleittexte je Zeitalter, in der Reihenfolge der Zeitalter. */
const DESCRIPTIONS = [
  'Ein hohler Stamm, ein Knochenschlägel, ein Schlag: Alle Feuerdiebe stolpern vier Sekunden ihres Weges zurück und trotten danach drei Sekunden lang nur halb so schnell.',
  'Die Bronzeglocke des Tempels schlägt: Alle Feuerdiebe werden vier Sekunden ihres Weges zurückgeworfen und marschieren danach drei Sekunden lang nur halb so schnell.',
  'Die Sturmglocke der Burg läutet: Alle Feuerdiebe werden vier Sekunden ihres Weges zurückgeworfen und schleichen danach drei Sekunden lang nur halb so schnell.',
  'Die Schiffsglocke schlägt acht Glasen: Alle Feuerdiebe werden vier Sekunden ihres Weges zurückgeworfen und torkeln danach drei Sekunden lang nur halb so schnell.',
  'Die Turmuhr des Kraftwerks schlägt rückwärts: Alle Feuerdiebe werden vier Sekunden ihres Weges zurückgeworfen und zuckeln danach drei Sekunden lang nur halb so schnell.',
  'Ein Zeitimpuls aus der Zentrale: Alle Feuerdiebe werden vier Sekunden ihres Weges zurückgeworfen und rollen danach drei Sekunden lang nur halb so schnell.',
];

/** @type {AbilityDef[]} */
export const ABILITIES = DESCRIPTIONS.map((description) => ({
  name: 'Zeitglocke',
  description: `${description} Bosse nur zwei Sekunden.`,
  icon: 'zeitglocke',
  cooldown: 75,
  // 0 = wirkt ohne Zielen auf jeden Gegner der Karte.
  radius: 0,
  rewind: 4,
  damage: 0,
  slow: 0.5,
  slowDuration: 3,
  hitsAir: true,
  effect: 'zeitglocke',
  color: '#F2C230',
  sound: 'metal',
}));
