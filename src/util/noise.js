// @ts-check
// Deterministisches 2D-Rauschen (Value Noise) ohne Abhängigkeiten.

/**
 * Pseudozufallswert in [0, 1) für ein Gitterfeld.
 * @param {number} ix
 * @param {number} iz
 * @param {number} seed
 */
export function hash2(ix, iz, seed) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Weiches Rauschen in [0, 1).
 * @param {number} x
 * @param {number} z
 * @param {number} seed
 */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * Zwei Oktaven Rauschen in [0, 1).
 * @param {number} x
 * @param {number} z
 * @param {number} seed
 */
export function fbm2(x, z, seed) {
  return valueNoise(x, z, seed) * 0.65 + valueNoise(x * 2.3 + 17.1, z * 2.3 - 9.4, seed + 101) * 0.35;
}
