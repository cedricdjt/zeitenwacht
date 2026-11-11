// @ts-check
// Besondere Bauplätze (Anhöhe, Kraftquelle, Taktstein, Sumpf) in der Oberfläche: Wirkung in wenigen Worten, farbige Marke,
// und ob eine Turmrolle dort überhaupt etwas gewinnt. Die Zahlen kommen aus `balance.tiles` und `towerStats`, nie von Hand.

import { towerStats } from '../sim/rules.js';
import { el, readableOnDark } from './dom.js';
import { icon } from './icons.js';
import { statRows } from './stats.js';
import { NNBSP } from './texts.js';

/** @import { Content, SpecialTileDef, TowerArchetypeDef } from '../types/content' */
/** @import { StatRow } from './stats.js' */

/** Wörter für die Kampfwerte, die ein Feld verändern kann. */
/** @type {Record<string, string>} */
const STAT_WORDS = {
  damage: 'Schaden',
  dot: 'Brand',
  range: 'Reichweite',
  cooldown: 'Nachladen',
  splash: 'Flächenradius',
  slow: 'Verlangsamung',
  pierce: 'Rüstungsdurchschlag',
};

/**
 * Farbe als CSS-Wert ('#rrggbb' bleibt, eine Zahl wird zu '#rrggbb').
 * @param {string | number} color
 * @returns {string}
 */
export function colorCss(color) {
  return typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
}

/**
 * Prozent mit Vorzeichen und schmalem Leerzeichen („+20 %“, „−15 %“).
 * @param {number} factor
 * @returns {string}
 */
function signedPercent(factor) {
  const p = Math.round((factor - 1) * 100);
  return (p < 0 ? '−' : '+') + Math.abs(p) + NNBSP + '%';
}

/**
 * Die Wirkung eines Felds in wenigen Worten, aus den Daten abgeleitet: „Reichweite +20 %“, „Schaden und Brand +20 %“,
 * „Nachladen −15 %“, „alle Preise +35 %“.
 * @param {SpecialTileDef} def
 * @returns {string}
 */
export function tileEffect(def) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  const mul = def.mod && def.mod.mul ? def.mod.mul : {};
  for (const [key, f] of Object.entries(mul)) {
    if (typeof f !== 'number' || f === 1) continue;
    const pct = signedPercent(f);
    const list = groups.get(pct) ?? [];
    list.push(STAT_WORDS[key] ?? key);
    groups.set(pct, list);
  }
  /** @type {string[]} */
  const parts = [];
  for (const [pct, words] of groups) parts.push(`${words.join(' und ')} ${pct}`);
  const add = def.mod && def.mod.add ? def.mod.add : {};
  for (const [key, v] of Object.entries(add)) {
    if (typeof v === 'number' && v !== 0) parts.push(`${STAT_WORDS[key] ?? key} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
  }
  if (def.cost !== 1) parts.push(`${parts.length ? 'Preise' : 'alle Preise'} ${signedPercent(def.cost)}`);
  return parts.length ? parts.join(', ') : 'ohne Wirkung';
}

/**
 * Kleine runde Marke in der Farbe des Felds mit seinem Symbol.
 * @param {SpecialTileDef} def
 * @returns {HTMLElement}
 */
export function tileChip(def) {
  const chip = el('span', 'zw-tilechip', icon(def.icon));
  chip.style.setProperty('--tile', colorCss(def.color));
  return chip;
}

/**
 * Plakette für die Turmkarte: Marke, Name und Wirkung.
 * @param {SpecialTileDef} def
 * @returns {HTMLElement}
 */
export function tileBadge(def) {
  const badge = el('span', 'zw-badge zw-badge-tile', icon(def.icon), def.name, el('span', 'zw-badge-tile-fx', tileEffect(def)));
  const color = colorCss(def.color);
  badge.style.setProperty('--tile', color);
  badge.style.setProperty('--tile-text', readableOnDark(color));
  return badge;
}

/**
 * Wie viele Nachbarfelder ein Wirkungskreis dieses Radius (in Feldern, von Feldmitte zu Feldmitte) erreicht.
 * @param {number} radius
 * @returns {number}
 */
function neighbours(radius) {
  const r2 = radius * radius + 1e-6;
  const n = Math.ceil(radius);
  let count = 0;
  for (let dz = -n; dz <= n; dz++) {
    for (let dx = -n; dx <= n; dx++) if ((dx !== 0 || dz !== 0) && dx * dx + dz * dz <= r2) count += 1;
  }
  return count;
}

/**
 * Was ein neu gebauter Turm dieser Rolle (Stufe 1, Technikstand `tier`) auf dem Feld gewinnt: die geänderten Kennzahlen
 * (mit `next`). Leer, wenn er nichts gewinnt. Ein Taktgeber gewinnt mit mehr Wirkungskreis nur dann etwas, wenn der
 * Kreis dadurch mehr Nachbarfelder erreicht.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} tier
 * @param {string} kind
 * @returns {StatRow[]}
 */
export function tileGain(content, arch, tier, kind) {
  if (!arch.tiers[tier]) return [];
  const plain = towerStats(content, arch, tier, 1);
  const there = towerStats(content, arch, tier, 1, { tile: kind });
  let rows = statRows(plain, there).filter((r) => r.next !== '');
  if (plain.attack === 'none' && neighbours(plain.range) === neighbours(there.range)) rows = rows.filter((r) => r.icon !== 'range');
  return rows;
}
