// @ts-check
// Umfang des Spiels: welche Zeitalter aktiv sind. Die Daten aller Zeitalter bleiben vollständig erhalten;
// hier wird nur ausgewählt, was eine Partie durchläuft. Ein weiteres Zeitalter freizugeben heißt, seine Kennung
// in ACTIVE_AGES einzutragen (und seine 3D-Modelle zu bauen).

/** @import { Content } from '../types/content' */

/** Aktive Zeitalter in Spielreihenfolge. */
export const ACTIVE_AGES = ['steinzeit', 'rom', 'mittelalter', 'entdecker', 'industrie', 'zukunft'];

/**
 * Schneidet vollständige Inhalte auf eine Auswahl von Zeitaltern zu.
 * Was an ein Zeitalter gebunden ist (Zeitalter, Turm-Ausprägungen, Wellen, Fähigkeiten, Gegner), wird ausgewählt;
 * die Skalierung der Balance gilt je POSITION in der Partie und wird deshalb von vorn gekürzt:
 * Das dritte gespielte Zeitalter ist so stark wie das dritte der vollen Liste, egal welches es ist.
 * @param {Content} full
 * @param {readonly string[]} ageIds
 * @returns {Content}
 */
export function selectAges(full, ageIds) {
  const index = ageIds.map((id) => {
    const i = full.ages.findIndex((age) => age.id === id);
    if (i < 0) throw new Error(`Unbekanntes Zeitalter in der Auswahl: ${id}`);
    return i;
  });
  const count = index.length;
  const active = new Set(ageIds);
  /** @template T @param {readonly T[]} list @returns {T[]} */
  const pick = (list) => index.map((i) => list[i]);
  /** @template T @param {readonly T[]} list @returns {T[]} */
  const head = (list) => list.slice(0, count);
  const b = full.balance;
  return {
    ages: pick(full.ages),
    archetypes: full.archetypes.map((arch) => ({ ...arch, tiers: pick(arch.tiers) })),
    enemies: Object.fromEntries(Object.entries(full.enemies).filter(([, enemy]) => active.has(enemy.age))),
    waves: pick(full.waves),
    maps: full.maps,
    abilities: pick(full.abilities),
    balance: { ...b, ageDamage: head(b.ageDamage), ageCost: head(b.ageCost), ageHp: head(b.ageHp), ageBounty: head(b.ageBounty) },
    // Plätze, Zeitgaben und Eigenarten der Wellen gelten für jedes Zeitalter und gehen unverändert mit.
    ...(full.slots ? { slots: full.slots } : {}),
    ...(full.boons ? { boons: full.boons } : {}),
    ...(full.modifiers ? { modifiers: full.modifiers } : {}),
  };
}

/**
 * Schneidet Inhalte auf eine Auswahl von Waffen zu (alle übrigen Daten bleiben). So entstehen die klassischen Inhalte aus dem Pool,
 * solange Oberfläche und Spielsteuerung den Waffenpool noch nicht kennen.
 * @param {Content} full
 * @param {readonly string[]} weaponIds
 * @returns {Content}
 */
export function selectWeapons(full, weaponIds) {
  for (const id of weaponIds) if (!full.archetypes.some((arch) => arch.id === id)) throw new Error(`Unbekannte Waffe in der Auswahl: ${id}`);
  return { ...full, archetypes: full.archetypes.filter((arch) => weaponIds.includes(arch.id)) };
}
