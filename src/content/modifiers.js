// @ts-check
// Wellen mit Eigenart (docs/briefs/fusion.md, Abschnitt 10; Spielentwurf Kapitel 2.13): Je Partie tragen zwei Wellen jedes
// Zeitalters eine angekündigte Eigenart, nie die erste und nie eine mit (Zwischen-)Boss. Gezogen aus dem Startwert der Partie
// (src/sim/sim.js, drawModifiers). Eine Mischung aus „schwerer, aber lohnender“ und „anders, nicht schwerer“; nichts Unfaires.
// Reine Daten. Faktoren: 1 = unverändert. `needs` sorgt dafür, dass eine Eigenart nur Wellen trifft, für die sie Sinn ergibt.

/** @import { WaveModifierDef } from '../types/content' */

/** @type {Record<string, WaveModifierDef>} */
export const MODIFIERS = {
  nebel: {
    name: 'Nebel',
    icon: 'fog',
    color: '#B8C4CC',
    text: 'Dichter Nebel: Alle Türme reichen in dieser Welle 12 % weniger weit (Taktgeber der Stufe 1 erreichen ihre Ecknachbarn nicht). Dafür gibt es die anderthalbfache Wellenprämie.',
    towers: { mul: { range: 0.88 } },
    bonus: 1.5,
  },
  klare_sicht: {
    name: 'Klare Sicht',
    icon: 'sun',
    color: '#FFD86B',
    text: 'Fernsicht bis zum Horizont: Alle Türme reichen 15 % weiter, aber die Feuerdiebe kommen mit 15 % mehr Lebenspunkten.',
    towers: { mul: { range: 1.15 } },
    enemy: { hp: 1.15 },
  },
  eilmarsch: {
    name: 'Eilmarsch',
    icon: 'quick',
    color: '#F29C4B',
    text: 'Die Feuerdiebe haben es eilig: 20 % schneller, dafür 30 % mehr Kopfgeld.',
    enemy: { speed: 1.2, bounty: 1.3 },
  },
  tross: {
    name: 'Gepanzerter Tross',
    icon: 'armored',
    color: '#9AA3AD',
    needs: ['armored'],
    text: 'Frisch beschlagen: Gepanzerte tragen 60 % mehr Rüstung (Panzerknacker und Brand stört das nicht), alle bringen 25 % mehr Kopfgeld.',
    enemy: { armor: 1.6, bounty: 1.25 },
  },
  schildwall: {
    name: 'Schildwall',
    icon: 'shield',
    color: '#4FC6D9',
    needs: ['shielded'],
    text: 'Verstärkte Schilde: Wer einen Schild trägt, hat einen um 50 % stärkeren (Brand hält ihn weiter unten). 25 % mehr Kopfgeld.',
    enemy: { shield: 1.5, bounty: 1.25 },
  },
  zaehes_volk: {
    name: 'Zähes Volk',
    icon: 'tough',
    color: '#8C6A4F',
    text: 'Die Feuerdiebe sind gut genährt: 30 % mehr Lebenspunkte, dafür 50 % mehr Kopfgeld.',
    enemy: { hp: 1.3, bounty: 1.5 },
  },
  goldrausch: {
    name: 'Goldrausch',
    icon: 'coin',
    color: '#F2C230',
    needs: ['swarm'],
    text: 'Halb so stark, doppelt so gierig: anderthalbmal so viele Feuerdiebe in derselben Zeit, jeder mit 40 % weniger Lebenspunkten. Bosse bleiben, wie sie sind.',
    enemy: { count: 1.5, hp: 0.6 },
  },
  rueckenwind: {
    name: 'Rückenwind',
    icon: 'flying',
    color: '#8FD3F4',
    needs: ['flying'],
    text: 'Kräftiger Wind von hinten: Flieger sind 30 % schneller und bringen 40 % mehr Kopfgeld.',
    air: { speed: 1.3, bounty: 1.4 },
  },
  windstille: {
    name: 'Windstille',
    icon: 'air',
    color: '#CFE8F0',
    needs: ['flying'],
    text: 'Kein Lüftchen: Flieger sind 30 % langsamer, dafür zäher (25 % mehr Lebenspunkte).',
    air: { speed: 0.7, hp: 1.25 },
  },
};
