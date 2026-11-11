// @ts-check
// Kleine Rechenhelfer ohne Abhängigkeiten (auch in der Simulation verwendbar).

/**
 * Begrenzt v auf [lo, hi].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Lineare Überblendung von a nach b.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Weicher Übergang 0..1 zwischen den Kanten e0 und e1.
 * @param {number} e0
 * @param {number} e1
 * @param {number} x
 */
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Bildratenunabhängiges Annähern von a an b. rate = Anteil pro Sekunde (größer = schneller).
 * @param {number} a
 * @param {number} b
 * @param {number} rate
 * @param {number} dt
 */
export function damp(a, b, rate, dt) {
  return b + (a - b) * Math.exp(-rate * dt);
}

/**
 * Kürzeste Winkeldifferenz von a nach b in Radiant, Ergebnis in (-PI, PI].
 * @param {number} a
 * @param {number} b
 */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Nähert den Winkel a dem Winkel b auf dem kürzesten Weg an.
 * @param {number} a
 * @param {number} b
 * @param {number} rate
 * @param {number} dt
 */
export function dampAngle(a, b, rate, dt) {
  return a + angleDelta(a, b) * (1 - Math.exp(-rate * dt));
}

/**
 * Sanftes Ein- und Ausblenden (kubisch).
 * @param {number} t 0..1
 */
export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Überschwingendes Einblenden, gut für aufploppende Objekte.
 * @param {number} t 0..1
 */
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Formatiert eine Zahl mit deutschem Tausenderpunkt.
 * @param {number} n
 */
export function formatNumber(n) {
  return Math.round(n).toLocaleString('de-DE');
}
