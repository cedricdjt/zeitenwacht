// @ts-check
// Dauerhafte Daten im Browser (Einstellungen, Bestwerte, Spielstand). Fällt lautlos auf den Arbeitsspeicher zurück,
// wenn localStorage nicht verfügbar ist (privates Fenster, gesperrte Websitedaten).

const PREFIX = 'zeitenwacht.';
/** @type {Map<string, string>} */
const memory = new Map();

/**
 * Liest einen gespeicherten Wert.
 * @template T
 * @param {string} key
 * @param {T} fallback Wird geliefert, wenn nichts gespeichert ist oder der Inhalt unlesbar ist
 * @returns {T}
 */
export function loadValue(key, fallback) {
  let raw = null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (raw === null) raw = memory.get(key) ?? null;
  if (raw === null) return fallback;
  try {
    return /** @type {T} */ (JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/**
 * Speichert einen Wert (als JSON).
 * @param {string} key
 * @param {unknown} value
 */
export function saveValue(key, value) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Nur im Arbeitsspeicher behalten.
  }
}

/**
 * Löscht einen Wert.
 * @param {string} key
 */
export function removeValue(key) {
  memory.delete(key);
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // nichts zu tun
  }
}
