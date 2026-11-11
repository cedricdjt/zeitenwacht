// Deterministischer Zufall. Die Simulation und die Dekoration der Welt dürfen
// niemals Math.random() verwenden, damit Läufe reproduzierbar bleiben.

/**
 * @typedef {object} Rng
 * @property {() => number} next Gleichverteilte Zahl in [0, 1).
 * @property {(lo: number, hi: number) => number} range Gleichverteilte Zahl in [lo, hi).
 * @property {(lo: number, hi: number) => number} int Ganze Zahl in [lo, hi] (beide Grenzen eingeschlossen).
 * @property {<T>(items: readonly T[]) => T} pick Zufälliges Element.
 * @property {(p: number) => boolean} chance true mit Wahrscheinlichkeit p.
 * @property {() => number} getState Interner Zustand (zum Speichern).
 * @property {(state: number) => void} setState Zustand wiederherstellen.
 */

/**
 * Erzeugt einen mulberry32-Generator.
 * @param {number} seed
 * @returns {Rng}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    getState: () => a,
    setState: (state) => {
      a = state >>> 0;
    },
  };
}

/**
 * FNV-1a-Hash einer Zeichenkette als vorzeichenlose 32-Bit-Zahl.
 * @param {string} text
 * @returns {number}
 */
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
