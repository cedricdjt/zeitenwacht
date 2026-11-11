// @ts-check
// Texte und Zahlenformate der Oberfläche an einem Ort. Alles Deutsch, kurz und freundlich.

import { formatNumber } from '../util/math.js';

/** @import { Difficulty, TargetMode } from '../types/content' */
/** @import { RejectReason } from '../types/sim' */

/** Geschütztes Leerzeichen. */
export const NBSP = ' ';
/** Schmales geschütztes Leerzeichen (vor Einheiten und Prozentzeichen). */
export const NNBSP = ' ';

export const GAME_TITLE = 'Zeitenwacht';
export const GAME_SUBTITLE = 'Hüter der Flamme';

/** Zielwahl in der Reihenfolge der Anzeige. */
/** @type {{ id: TargetMode, label: string, icon: string, hint: string }[]} */
export const TARGET_MODES = [
  { id: 'first', label: 'Erster', icon: 'first', hint: 'Zielt auf den Gegner, der der Flamme am nächsten ist.' },
  { id: 'last', label: 'Letzter', icon: 'last', hint: 'Zielt auf den hintersten Gegner in Reichweite.' },
  { id: 'strong', label: 'Stärkster', icon: 'strong', hint: 'Zielt auf den Gegner mit den meisten Lebenspunkten.' },
  { id: 'weak', label: 'Schwächster', icon: 'weak', hint: 'Zielt auf den Gegner mit den wenigsten Lebenspunkten.' },
  { id: 'near', label: 'Nächster', icon: 'near', hint: 'Zielt auf den Gegner, der dem Turm am nächsten ist.' },
];

/** Reihenfolge der Schwierigkeitsgrade. */
/** @type {Difficulty[]} */
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

/** Meldungen zu abgelehnten Befehlen. */
/** @type {Record<RejectReason, string>} */
export const REJECT_TEXT = {
  gold: 'Zu wenig Gold',
  outside: 'Hier kann nicht gebaut werden',
  path: 'Auf dem Weg kann nicht gebaut werden',
  blocked: 'Hier kann nicht gebaut werden',
  occupied: 'Hier steht schon ein Turm',
  locked: 'Diese Rolle ist noch nicht verfügbar',
  max: 'Schon auf dem höchsten Stand',
  phase: 'Das geht gerade nicht',
  cooldown: 'Die Zeitglocke lädt noch',
  level: 'Dafür müssen alle drei Türme auf Stufe 3 sein',
  adjacent: 'Die Zutaten müssen direkt neben dem Kern stehen',
  tier: 'Erst modernisieren: Alle drei müssen aus demselben Zeitalter sein',
  super: 'Megawaffen verschmelzen nicht weiter, Superwaffen sind keine Zutat',
  limit: 'Es darf nur eine Megawaffe zugleich geben',
  count: 'Wähle genau zwei Nachbartürme aus',
  branch: 'Wähle zuerst einen Ausbauzweig',
  boon: 'Wähle zuerst eine Zeitgabe',
  unknown: 'Das geht gerade nicht',
};

/**
 * Felder von Wegen, die sich mit dem Zeitalter wandeln (Sim.pathMark): Schild unter dem Zeiger und Meldung beim Bauversuch.
 * @type {Record<'future' | 'former', { name: string, text: string, reject: string }>}
 */
export const PATH_MARK_TEXT = {
  future: { name: 'Künftiger Weg', text: 'Hier verläuft später der Weg', reject: 'Hier verläuft später der Weg' },
  former: { name: 'Alter Weg', text: 'nicht bebaubar', reject: 'Alter Weg, nicht bebaubar' },
};

/** Zeitalter im Dativ mit Artikel, für „Ab dem Mittelalter …“. */
/** @type {Record<string, string>} */
export const AGE_DATIVE = {
  steinzeit: 'der Steinzeit',
  rom: 'dem Römischen Reich',
  mittelalter: 'dem Mittelalter',
  entdecker: 'dem Zeitalter der Entdecker',
  industrie: 'dem Industriezeitalter',
  zukunft: 'der Nahen Zukunft',
};

/** Tasten für die Anleitung. */
/** @type {{ keys: string[], text: string }[]} */
export const KEY_HELP = [
  { keys: ['1', '–', '6'], text: 'Turm wählen (noch einmal: abbrechen)' },
  { keys: ['Leertaste'], text: 'Nächste Welle starten' },
  { keys: ['U'], text: 'Gewählten Turm ausbauen (Stufe 3: Zweig wählen, Enter bestätigt)' },
  { keys: ['V'], text: 'Gewählten Turm mit zwei Nachbarn verschmelzen' },
  { keys: ['M'], text: 'Gewählten Turm modernisieren' },
  { keys: ['X'], text: 'Gewählten Turm verkaufen' },
  { keys: ['T'], text: 'Zielwahl wechseln' },
  { keys: ['F'], text: 'Zeitglocke läuten' },
  { keys: ['P'], text: 'Pause' },
  { keys: ['+', '−', 'Tab'], text: 'Spieltempo ändern' },
  { keys: ['Esc'], text: 'Abbrechen, einen Schritt zurück, Menü' },
  { keys: ['W', 'A', 'S', 'D'], text: 'Kamera bewegen' },
  { keys: ['Q', 'E'], text: 'Kamera drehen' },
  { keys: ['R'], text: 'Kamera zurücksetzen' },
];

/**
 * Ganze Zahl mit Tausenderpunkt.
 * @param {number} n
 * @returns {string}
 */
export function num(n) {
  return formatNumber(n);
}

/**
 * Zahl mit höchstens einer Nachkommastelle und deutschem Komma; ganze Zahlen ohne Nachkommastelle, große Zahlen mit Tausenderpunkt.
 * @param {number} x
 * @returns {string}
 */
export function num1(x) {
  if (Math.abs(x) >= 100) return formatNumber(x);
  const r = Math.round(x * 10) / 10;
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
  return r.toFixed(1).replace('.', ',');
}

/**
 * Zahl mit genau einer Nachkommastelle (für Reichweiten und Radien).
 * @param {number} x
 * @returns {string}
 */
export function fixed1(x) {
  return (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
}

/**
 * Anteil 0..1 als Prozentangabe.
 * @param {number} share
 * @returns {string}
 */
export function percent(share) {
  return Math.round(share * 100) + NNBSP + '%';
}

/**
 * Sekundenangabe, z. B. „3 s“ oder „2,5 s“.
 * @param {number} s
 * @returns {string}
 */
export function seconds(s) {
  return num1(s) + NNBSP + 's';
}

/**
 * Spielzeit als „12:34“ oder „1:02:03“.
 * @param {number} s Sekunden
 * @returns {string}
 */
export function clockTime(s) {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
}

/**
 * Schlüssel der Bestwerte.
 * @param {string} mapId
 * @param {Difficulty} difficulty
 * @returns {string}
 */
export function recordKey(mapId, difficulty) {
  return `${mapId}:${difficulty}`;
}

/** Zweite Wortteile, vor denen lange zusammengesetzte Namen umbrechen dürfen. */
const STEMS = [
  'schleuder', 'schütze', 'schwinger', 'schlange', 'schwarm', 'schaum', 'geschütz', 'werfer', 'werker', 'bläser', 'brenner', 'pfanne',
  'kanone', 'mörser', 'siphon', 'zeichen', 'rechner', 'sieder', 'pumpe', 'amphoren', 'nashorn', 'fahrer', 'ballon', 'wagen', 'roboter',
  'ritter', 'knecht', 'papagei', 'galeone', 'kröten', 'turm', 'mast', 'fass', 'hund', 'dieb', 'mann', 'trupp', 'zeit', 'alter',
];

/**
 * Fügt in lange zusammengesetzte Wörter weiche Trennstellen ein („Stein|schleuderer“), damit Namen auf schmalen Karten
 * an einer sinnvollen Stelle umbrechen statt mitten im Wort.
 * @param {string} name
 * @returns {string}
 */
export function soften(name) {
  return name.split(' ').map((word) => {
    if (word.length < 10 || word.includes('\u00ad')) return word;
    const lower = word.toLowerCase();
    let best = -1;
    for (const stem of STEMS) {
      const at = lower.indexOf(stem, 3);
      // Die Trennstelle soll möglichst mittig liegen und beide Teile lesbar lassen.
      if (at >= 3 && word.length - at >= 4 && lower[at - 1] !== '-' && (best < 0 || Math.abs(at - word.length / 2) < Math.abs(best - word.length / 2))) best = at;
    }
    return best > 0 ? word.slice(0, best) + '\u00ad' + word.slice(best) : word;
  }).join(' ');
}
