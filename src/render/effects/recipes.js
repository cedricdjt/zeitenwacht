// @ts-check
// Rezepte der Effektschicht: Welche Teilchen, Ringe und Leuchtflecken ein Ereignis auslöst.
// Alles hier ist rein optisch, darf Math.random() benutzen und alloziert beim Auslösen nichts
// (Vorlagen und Farben liegen auf Modulebene).

import * as THREE from 'three';
import { SHAPE_CORE, SHAPE_DOT, SHAPE_SOFT } from './batches.js';
import { BALL, CHIP, GLOW, PUFF } from './particles.js';

/** @import { DecalBatch } from './batches.js' */
/** @import { ParticleDef, ParticleSystem } from './particles.js' */

/**
 * Was die Rezepte von der Effektschicht brauchen.
 * @typedef {object} FxContext
 * @property {ParticleSystem} ps
 * @property {DecalBatch} decals
 * @property {(delay: number, type: number, x: number, y: number, z: number, scale: number, color: THREE.Color) => void} later
 *   Merkt einen Nachzügler vor, der nach `delay` Sekunden über runDelayed() ausgelöst wird.
 * @property {number} light Helligkeit des Umgebungslichts, 1 = Tageslicht (nachts deutlich weniger)
 * @property {number} comp Ausgleichsfaktor (>= 1) für beleuchtete Teilchen, die auch nachts ihre Farbe zeigen sollen (Zeitsand)
 */

/** @param {string} hex @returns {THREE.Color} */
const C = (hex) => new THREE.Color(hex);

const WHITE = C('#ffffff');
const WARM_WHITE = C('#fff1c9');
const FLASH_WARM = C('#ffcf8a');
const GOLD = C('#ffc94a');
const GOLD_DEEP = C('#f0a92e');
const SAND = C('#f1d48a');
const DUST = C('#f0e6d0');
const EMBER_RED = C('#e2491c');
const SOOT = C('#6f6a68');
const ASH = C('#c4c0bb');
const ICE = C('#cfefff');
const ICE_DEEP = C('#8fd0f5');
const DULL_RED = C('#b5483c');
const HEAL = C('#7fe08a');
const SHIELD = C('#6fe6dc');
const NET = C('#e9e2cf');
const CONFETTI = [C('#ff6b6b'), C('#ffd23f'), C('#4ecdc4'), C('#6c8cff'), C('#c77dff'), C('#7bd46a')];

const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();

// --- Arten der Nachzügler ---
export const LATER_SMOKE = 1;
export const LATER_SHIMMER = 2;
export const LATER_BOSS_BURST = 3;
export const LATER_MOTES = 4;
export const LATER_SAND = 5;
/** Eine Flamme auf der Front eines Feuerrings. */
export const LATER_FLAME = 6;
/** Ein Hauch Reif auf der Front eines Frostpulses. */
export const LATER_FROST = 7;
/** Ein Dampfwölkchen auf der Front eines Dampfpulses (Dampfkessel): steigt sanft auf. */
export const LATER_STEAM = 8;
/** Staubwölkchen auf der Front einer Stampfwelle (Stampfer). */
export const LATER_DUST = 9;

// --- Vorlagen ---
/** @type {ParticleDef} */
const DUST_PUFF = { kind: PUFF, life: 0.6, lifeVar: 0.25, size: 0.14, sizeEnd: 0.38, sizeVar: 0.3, color: DUST, alpha: 0.8, gravity: -0.25, drag: 3.4, spin: 1.2 };
/** @type {ParticleDef} */
const DUST_PUFF_MINOR = { ...DUST_PUFF, minor: true };
/** @type {ParticleDef} */
const TINT_PUFF = { ...DUST_PUFF, color: null, life: 0.7, sizeEnd: 0.4, alpha: 0.85 };
/** @type {ParticleDef} */
const SMOKE_PUFF = { kind: PUFF, life: 1.0, lifeVar: 0.25, size: 0.16, sizeEnd: 0.5, sizeVar: 0.3, color: SOOT, colorEnd: ASH, alpha: 0.6, gravity: -0.75, drag: 2.4, spin: 0.9 };
/** @type {ParticleDef} */
const SMOKE_WISP = { kind: PUFF, life: 0.55, lifeVar: 0.3, size: 0.06, sizeEnd: 0.2, sizeVar: 0.3, color: ASH, alpha: 0.5, gravity: -0.35, drag: 2, spin: 1, minor: true };
/** @type {ParticleDef} */
const STEAM_PUFF = { kind: PUFF, life: 0.8, lifeVar: 0.25, size: 0.14, sizeEnd: 0.5, sizeVar: 0.3, color: C('#f6f4ee'), alpha: 0.8, gravity: -0.9, drag: 3, spin: 1 };
/** @type {ParticleDef} */
const MIST_PUFF = { kind: PUFF, life: 0.7, lifeVar: 0.2, size: 0.12, sizeEnd: 0.4, sizeVar: 0.3, color: ICE, alpha: 0.6, gravity: -0.15, drag: 3.5, spin: 0.8 };
/** @type {ParticleDef} */
const MIST_PUFF_SOFT = { ...MIST_PUFF, color: null, life: 0.9, alpha: 0.42, minor: true };
/** @type {ParticleDef} */
const STEAM_RISE = { ...MIST_PUFF, color: null, life: 1.5, alpha: 0.38, minor: true };
/** @type {ParticleDef} */
const CHIP_DEF = { kind: CHIP, life: 0.75, lifeVar: 0.3, size: 0.075, sizeVar: 0.4, color: null, gravity: 9, drag: 0.4, spin: 9, bounce: true, minor: true };
/** @type {ParticleDef} */
const CONFETTI_DEF = { kind: CHIP, life: 1.7, lifeVar: 0.3, size: 0.09, sizeVar: 0.35, color: null, gravity: 3.2, drag: 1.6, spin: 11, bounce: true };
/** @type {ParticleDef} */
const SPARK = { kind: GLOW, life: 0.28, lifeVar: 0.4, size: 0.075, sizeEnd: 0.03, color: null, gain: 2.4, gainEnd: 1.3, alpha: 1, gravity: 4.5, drag: 2.6, stretch: 0.05, shape: SHAPE_CORE, solid: 0.35, minor: true };
/** @type {ParticleDef} */
const EMBER = { kind: GLOW, life: 0.65, lifeVar: 0.35, size: 0.07, sizeEnd: 0.025, color: C('#ffbe5c'), colorEnd: EMBER_RED, gain: 2.3, gainEnd: 1.1, alpha: 1, gravity: -0.9, drag: 1.6, solid: 0.4, minor: true };
/** @type {ParticleDef} */
const FLASH_GLOW = { kind: GLOW, life: 0.16, size: 0.4, sizeEnd: 0.8, color: null, gain: 1.5, gainEnd: 1.0, alpha: 0.5, solid: 0.7 };
/** @type {ParticleDef} */
const FLASH_BALL = { kind: BALL, life: 0.11, size: 0.08, sizeEnd: 0.26, color: WARM_WHITE, gain: 2.1 };
/** @type {ParticleDef} */
const FIREBALL = { kind: BALL, life: 0.46, lifeVar: 0.2, size: 0.14, sizeEnd: 0.6, sizeVar: 0.2, color: C('#ffd35a'), colorEnd: C('#c2410c'), gain: 1.45, gainEnd: 0.8, gravity: -0.5, drag: 3.2 };
/** @type {ParticleDef} */
const FIRE_CORE = { kind: BALL, life: 0.3, size: 0.12, sizeEnd: 0.42, color: C('#fff3b8'), colorEnd: C('#ffb23a'), gain: 2.0, gainEnd: 1.3, gravity: -0.9, drag: 3 };
/** @type {ParticleDef} */
const FLAME_BALL = { kind: BALL, life: 0.34, lifeVar: 0.3, size: 0.09, sizeEnd: 0.27, sizeVar: 0.3, color: C('#ffd866'), colorEnd: null, gain: 1.3, gainEnd: 0.82, gravity: -1.4, drag: 2.4 };
/** @type {ParticleDef} */
const FLAME_GLOW = { kind: GLOW, life: 0.36, lifeVar: 0.3, size: 0.24, sizeEnd: 0.5, sizeVar: 0.25, color: null, colorEnd: EMBER_RED, gain: 1.4, gainEnd: 0.8, alpha: 0.55, gravity: -1.3, drag: 2.6, solid: 0.5, minor: true };
/** @type {ParticleDef} */
const ENERGY_BALL = { kind: BALL, life: 0.22, size: 0.1, sizeEnd: 0.3, color: null, gain: 2.4, gainEnd: 1.4 };
/** @type {ParticleDef} */
const GLINT = { kind: GLOW, life: 0.75, lifeVar: 0.3, size: 0.15, sizeEnd: 0.04, sizeVar: 0.3, color: null, gain: 2.1, gainEnd: 1.4, alpha: 1, gravity: -0.7, drag: 2.2, solid: 0.45 };
/** @type {ParticleDef} */
const GLINT_MINOR = { ...GLINT, minor: true };
/** @type {ParticleDef} */
const SAND_MOTE = { kind: GLOW, life: 1.0, lifeVar: 0.3, size: 0.11, sizeEnd: 0.035, sizeVar: 0.35, color: GOLD, gain: 1.9, gainEnd: 1.3, alpha: 1, gravity: -0.55, drag: 2.4, solid: 0.5, minor: true };
/** @type {ParticleDef} */
const RISING_MOTE = { kind: GLOW, life: 1.5, lifeVar: 0.3, size: 0.14, sizeEnd: 0.04, sizeVar: 0.35, color: null, gain: 2.0, gainEnd: 1.3, alpha: 1, gravity: -0.9, drag: 0.9, solid: 0.45 };
/** @type {ParticleDef} */
const DROPLET = { kind: GLOW, life: 0.5, lifeVar: 0.25, size: 0.1, sizeEnd: 0.06, sizeVar: 0.3, color: null, gain: 1, alpha: 1, gravity: 8, drag: 0.5, solid: 1, shape: SHAPE_DOT, minor: true };
/** @type {ParticleDef} */
const COIN = { kind: GLOW, life: 0.95, lifeVar: 0.15, size: 0.13, sizeEnd: 0.11, color: C('#ffcf3a'), colorEnd: GOLD_DEEP, gain: 1.3, gainEnd: 1.15, alpha: 1, gravity: 9.5, drag: 0.3, solid: 1, shape: SHAPE_DOT, bounce: true };
/** @type {ParticleDef} */
const SHIMMER_GLOW = { kind: GLOW, life: 0.55, size: 0.35, sizeEnd: 0.75, color: GOLD, gain: 1.5, gainEnd: 1.1, alpha: 0.6, minor: true };

/** @param {number} a @param {number} b */
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Stößt `n` Teilchen ringförmig nach außen aus.
 * @param {ParticleSystem} ps
 * @param {ParticleDef} def
 * @param {number} n
 * @param {number} x @param {number} y @param {number} z
 * @param {number} speed waagerechte Geschwindigkeit
 * @param {number} up senkrechte Geschwindigkeit
 * @param {THREE.Color | null} color
 * @param {number} [scale]
 * @param {number} [radius] Startabstand von der Mitte
 */
function burst(ps, def, n, x, y, z, speed, up, color, scale = 1, radius = 0) {
  const count = ps.amount(n);
  const start = Math.random() * 6.283;
  for (let i = 0; i < count; i++) {
    const a = start + (i / count) * 6.283 + rand(-0.3, 0.3);
    const s = speed * rand(0.6, 1.2);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ps.emit(def, x + ca * radius, y + rand(-0.03, 0.03), z + sa * radius, ca * s, up * rand(0.5, 1.2), sa * s, color, scale);
  }
}

/**
 * Einschlag eines Treffers.
 * @param {FxContext} fx
 * @param {string} kind ShotVisual.impact
 * @param {number} x @param {number} y @param {number} z Trefferpunkt (y = Bodenhöhe bzw. Körpermitte)
 * @param {number} scale Größe: etwa 0.6 für Einzeltreffer, sonst abhängig vom Flächenradius
 * @param {THREE.Color} color Leitfarbe des Schusses
 * @param {number} amount Anteil 0..1 der Teilchen (Dauerfeuer zeigt nur einen Bruchteil)
 */
export function impact(fx, kind, x, y, z, scale, color, amount) {
  const ps = fx.ps;
  switch (kind) {
    case 'dust':
      burst(ps, amount < 1 ? DUST_PUFF_MINOR : DUST_PUFF, 4 * amount * scale + 1, x, y + 0.05, z, 1.1 * scale, 0.5, null, 0.75 + scale * 0.35);
      burst(ps, CHIP_DEF, 3 * amount * scale, x, y + 0.08, z, 1.6, 2.4, color, 0.9);
      break;
    case 'spark':
      burst(ps, SPARK, 6 * amount, x, y, z, 2.6, 1.6, WARM_WHITE, 1);
      if (amount >= 1) ps.emit(FLASH_GLOW, x, y, z, 0, 0, 0, WARM_WHITE, 0.6);
      break;
    case 'explosion': {
      // Blitz, Feuerball aus Low-Poly-Kugeln, der zu Rauch abkühlt, dazu Trümmer und Glut.
      ps.emit(FLASH_GLOW, x, y + 0.2, z, 0, 0, 0, FLASH_WARM, 1.5 * scale);
      ps.emit(FIREBALL, x, y + 0.16 * scale, z, 0, 0.4, 0, null, 1.2 * scale);
      burst(ps, FIREBALL, 4 * amount, x, y + 0.14 * scale, z, 1.5 * scale, 0.9, null, 0.66 * scale, 0.1 * scale);
      ps.emit(FIRE_CORE, x, y + 0.3 * scale, z, 0, 1.1, 0, null, scale);
      burst(ps, EMBER, 7 * amount, x, y + 0.15, z, 2.2 * scale, 2.2, null, 1);
      burst(ps, CHIP_DEF, 5 * amount, x, y + 0.1, z, 2.2 * scale, 3, SOOT, 1);
      fx.later(0.16, LATER_SMOKE, x, y + 0.25 * scale, z, scale, SOOT);
      break;
    }
    case 'fire':
      burst(ps, FLAME_BALL, 3 * amount + 0.5, x, y + 0.08, z, 0.7 * scale, 0.9, color, 1, 0.12 * scale);
      burst(ps, FLAME_GLOW, 3 * amount, x, y + 0.1, z, 0.6 * scale, 0.5, color, 1, 0.1);
      burst(ps, EMBER, 3 * amount, x, y + 0.12, z, 1.0, 1.4, null, 0.9);
      break;
    case 'frost':
      burst(ps, MIST_PUFF, 3 * amount * scale + 1, x, y + 0.08, z, 0.9 * scale, 0.25, null, 0.9);
      burst(ps, CHIP_DEF, 5 * amount, x, y + 0.1, z, 1.7, 2.2, ICE, 1);
      burst(ps, GLINT_MINOR, 4 * amount, x, y + 0.15, z, 1.0, 0.6, ICE_DEEP, 0.9);
      fx.decals.ring(x, z, 0.1, 0.55 * scale + 0.15, 0.4, ICE, 0.6 * amount, { y: Math.max(0.03, y), inner: 0.7, soft: 0.2, solid: 0.6 });
      break;
    case 'energy':
      ps.emit(ENERGY_BALL, x, y, z, 0, 0, 0, color, 0.8 + scale * 0.4);
      ps.emit(FLASH_GLOW, x, y, z, 0, 0, 0, color, 0.9);
      burst(ps, SPARK, 4 * amount, x, y, z, 2.0, 1.2, color, 1);
      fx.decals.ring(x, z, 0.08, 0.4 * scale + 0.2, 0.3, color, 0.55 * amount, { y: Math.max(0.03, y - 0.2), inner: 0.72, soft: 0.2, solid: 0.2, gain: 1.6 });
      break;
    case 'splash':
      // Flüssigkeit: Tropfen in der Farbe der Pfütze spritzen hoch und fallen zurück.
      burst(ps, DROPLET, 8 * amount, x, y + 0.06, z, 1.5 * scale, 2.6, color, 1, 0.1);
      burst(ps, TINT_PUFF, 2 * amount, x, y + 0.05, z, 0.8, 0.3, tmpColor.copy(color).lerp(WHITE, 0.45), 0.7);
      fx.decals.ring(x, z, 0.1, 0.7 * scale + 0.1, 0.35, tmpColor, 0.5 * amount, { y: Math.max(0.03, y), inner: 0.75, soft: 0.2 });
      break;
    case 'net':
      burst(ps, DUST_PUFF_MINOR, 3 * amount, x, y + 0.05, z, 0.9 * scale, 0.3, null, 0.8);
      fx.decals.ring(x, z, 0.15, 0.6 * scale + 0.1, 0.55, NET, 0.85 * amount, { y: Math.max(0.03, y), inner: 0.9, soft: 0.05, hold: 0.6 });
      fx.decals.ring(x, z, 0.08, 0.3 * scale + 0.05, 0.55, NET, 0.7 * amount, { y: Math.max(0.03, y), inner: 0.82, soft: 0.08, hold: 0.6 });
      break;
    default:
  }
}

/**
 * Effekt an der Mündung.
 * @param {FxContext} fx
 * @param {string} kind ShotVisual.muzzle
 * @param {number} x @param {number} y @param {number} z Mündung
 * @param {number} dx @param {number} dy @param {number} dz Schussrichtung (Einheitsvektor)
 * @param {THREE.Color} color
 */
export function muzzle(fx, kind, x, y, z, dx, dy, dz, color) {
  const ps = fx.ps;
  switch (kind) {
    case 'flash':
      ps.emit(FLASH_BALL, x + dx * 0.06, y + dy * 0.06, z + dz * 0.06, dx * 1.2, dy * 1.2, dz * 1.2, null, 1);
      ps.emit(FLASH_GLOW, x, y, z, 0, 0, 0, WARM_WHITE, 0.7);
      if (ps.amount(1)) ps.emit(SMOKE_WISP, x, y, z, dx * 0.8, dy * 0.8 + 0.3, dz * 0.8, null, 1);
      break;
    case 'smoke': {
      const n = ps.amount(3);
      for (let i = 0; i < n; i++) {
        const s = rand(0.5, 1.6);
        ps.emit(STEAM_PUFF, x, y, z, dx * s + rand(-0.25, 0.25), dy * s + rand(0.1, 0.5), dz * s + rand(-0.25, 0.25), null, 0.62);
      }
      break;
    }
    case 'spark': {
      const n = ps.amount(4);
      for (let i = 0; i < n; i++) {
        const s = rand(1.5, 3);
        ps.emit(SPARK, x, y, z, dx * s + rand(-0.7, 0.7), dy * s + rand(-0.2, 0.9), dz * s + rand(-0.7, 0.7), color, 1);
      }
      break;
    }
    case 'energy':
      ps.emit(FLASH_GLOW, x, y, z, 0, 0, 0, color, 0.7);
      ps.emit(ENERGY_BALL, x, y, z, 0, 0, 0, color, 0.55);
      break;
    default:
  }
}

/**
 * Ein Stoß der Flamme eines Brenners: Teilchen von der Mündung in Richtung Ziel.
 * @param {FxContext} fx
 * @param {number} n gewünschte Teilchenzahl in diesem Bild
 * @param {number} x @param {number} y @param {number} z Mündung
 * @param {number} dx @param {number} dy @param {number} dz Richtung (Einheitsvektor)
 * @param {number} reach Entfernung zum Ziel
 * @param {THREE.Color} color
 * @param {string} flavor ShotVisual.trail: 'spark' | 'fire' | 'smoke' | 'energy' | ...
 */
export function flame(fx, n, x, y, z, dx, dy, dz, reach, color, flavor) {
  const ps = fx.ps;
  const count = ps.amount(n);
  // Tempo so, dass die Teilchen (mit ihrer Abbremsung) etwa das Ziel erreichen.
  const speed = reach * 4.4 + 0.5;
  for (let i = 0; i < count; i++) {
    const s = speed * rand(0.7, 1.1);
    const spread = 0.24 * s;
    const vx = dx * s + rand(-spread, spread);
    const vy = dy * s + rand(-spread, spread) * 0.6 + 0.5;
    const vz = dz * s + rand(-spread, spread);
    const r = Math.random();
    if (flavor === 'energy') {
      if (r < 0.5) ps.emit(ENERGY_BALL, x, y, z, vx, vy, vz, color, 0.6);
      else ps.emit(FLAME_GLOW, x, y, z, vx, vy, vz, color, 0.9);
    } else if (flavor === 'spark') {
      if (r < 0.45) ps.emit(SPARK, x, y, z, vx * 1.15, vy * 1.15 + 0.6, vz * 1.15, r < 0.2 ? WARM_WHITE : color, 1.1);
      else if (r < 0.75) ps.emit(FLAME_BALL, x, y, z, vx, vy, vz, color, 0.8);
      else ps.emit(EMBER, x, y, z, vx, vy + 0.4, vz, null, 1);
    } else {
      if (r < 0.5) ps.emit(FLAME_BALL, x, y, z, vx, vy, vz, color, 1);
      else if (r < 0.85) ps.emit(FLAME_GLOW, x, y, z, vx, vy, vz, color, 1);
      else if (flavor === 'smoke') ps.emit(SMOKE_WISP, x + dx * reach * 0.8, y + dy * reach * 0.8, z + dz * reach * 0.8, vx * 0.15, 0.7, vz * 0.15, null, 1.2);
      else ps.emit(EMBER, x, y, z, vx, vy + 0.4, vz, null, 1);
    }
  }
}

/**
 * Spur hinter einem fliegenden Geschoss (ein Aufruf je fälligem Spurteilchen).
 * @param {FxContext} fx
 * @param {string} kind ShotVisual.trail
 * @param {number} x @param {number} y @param {number} z
 * @param {THREE.Color} color
 */
export function trail(fx, kind, x, y, z, color) {
  const ps = fx.ps;
  switch (kind) {
    case 'smoke':
      ps.emit(SMOKE_WISP, x, y, z, rand(-0.1, 0.1), rand(0, 0.2), rand(-0.1, 0.1), null, 1);
      break;
    case 'spark':
      ps.emit(SPARK, x, y, z, rand(-0.6, 0.6), rand(0, 1), rand(-0.6, 0.6), color, 0.8);
      break;
    case 'fire':
      ps.emit(EMBER, x, y, z, rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3), null, 1);
      break;
    case 'energy':
    case 'frost':
      ps.emit(GLINT_MINOR, x, y, z, rand(-0.2, 0.2), rand(-0.1, 0.3), rand(-0.2, 0.2), kind === 'frost' ? ICE : color, 0.7);
      break;
    default:
  }
}

/**
 * Ein Gegner zerstäubt zu Zeitsand; Bosse feierlich, groß und langsam, mit Konfetti.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z Körpermitte
 * @param {number} size Größe der Figur (1 = gewöhnlicher Gegner)
 * @param {THREE.Color} color Hauptfarbe der Figur
 * @param {boolean} boss
 * @param {number} floor Bodenhöhe unter der Figur
 */
export function kill(fx, x, y, z, size, color, boss, floor) {
  const ps = fx.ps;
  ps.floor = floor;
  // Zeitsand: goldene Wolke mit einem Hauch der Figurenfarbe.
  tmpColor2.copy(color).lerp(SAND, 0.68).multiplyScalar(fx.comp);
  if (!boss) {
    burst(ps, TINT_PUFF, 4 + size, x, y, z, 0.75 * size, 0.45, tmpColor2, 0.8 * size, 0.05);
    burst(ps, SAND_MOTE, 7, x, y + 0.05, z, 0.8 * size, 0.9, null, 1, 0.08);
    burst(ps, CHIP_DEF, 3, x, y, z, 1.4, 2.6, color, 1);
    return;
  }
  burst(ps, TINT_PUFF, 9, x, y, z, 1.5, 0.6, tmpColor2, 1.7, 0.2);
  burst(ps, SAND_MOTE, 16, x, y, z, 1.6, 1.4, null, 1.4, 0.2);
  burst(ps, COIN, 10, x, y + 0.2, z, 1.5, 4.6, null, 1, 0.15);
  for (let i = 0; i < 3; i++) fx.later(0.12 + i * 0.2, LATER_BOSS_BURST, x, y, z, 1, color);
  for (let i = 0; i < 6; i++) fx.later(0.1 + i * 0.14, LATER_SAND, x, y, z, 1, tmpColor2);
  fx.decals.ring(x, z, 0.3, 2.3, 0.9, GOLD, 0.55, { y: floor + 0.09, inner: 0.9, soft: 0.07, gain: 1.15, solid: 0.6 });
  fx.decals.ring(x, z, 0.2, 1.6, 1.1, GOLD, 0.4, { y: floor + 0.09, inner: 0.86, soft: 0.1, gain: 1.1, solid: 0.6, delay: 0.25 });
}

/**
 * Löst einen vorgemerkten Nachzügler aus.
 * @param {FxContext} fx
 * @param {number} type LATER_*
 * @param {number} x @param {number} y @param {number} z
 * @param {number} scale
 * @param {THREE.Color} color
 */
export function runDelayed(fx, type, x, y, z, scale, color) {
  const ps = fx.ps;
  switch (type) {
    case LATER_SMOKE:
      burst(ps, SMOKE_PUFF, 4 * scale + 1, x, y, z, 0.7 * scale, 0.9, null, 0.8 + scale * 0.35, 0.12 * scale);
      break;
    case LATER_SHIMMER:
      ps.emit(SHIMMER_GLOW, x, y, z, 0, 0.3, 0, null, scale);
      burst(ps, SAND_MOTE, 3, x, y, z, 0.5, 0.8, null, 1, 0.1);
      break;
    case LATER_BOSS_BURST: {
      // Konfetti in bunten Farben, in hohem Bogen.
      ps.floor = y - 0.6;
      const n = ps.amount(14);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283;
        const s = rand(0.8, 2.4);
        ps.emit(CONFETTI_DEF, x + rand(-0.2, 0.2), y + 0.3, z + rand(-0.2, 0.2), Math.cos(a) * s, rand(3, 5.5), Math.sin(a) * s, CONFETTI[(Math.random() * CONFETTI.length) | 0], 1);
      }
      burst(ps, GLINT, 6, x, y + 0.3, z, 1.6, 2.2, GOLD, 1.2, 0.2);
      break;
    }
    case LATER_SAND:
      // Wirbel aus Zeitsand, der langsam aufsteigt.
      burst(ps, TINT_PUFF, 3, x, y + 0.1, z, 0.9, 0.9, color, 1.4, 0.35);
      burst(ps, SAND_MOTE, 6, x, y + 0.2, z, 1.1, 1.6, null, 1.3, 0.3);
      break;
    case LATER_MOTES:
      burst(ps, RISING_MOTE, 5, x, y, z, 0.35, 1.5, color, scale, 0.5);
      break;
    case LATER_FLAME:
      ps.emit(FLAME_BALL, x, y, z, rand(-0.12, 0.12), rand(0.25, 0.6), rand(-0.12, 0.12), color, scale);
      if (Math.random() < 0.45) ps.emit(EMBER, x, y + 0.05, z, rand(-0.2, 0.2), rand(0.3, 0.8), rand(-0.2, 0.2), null, 0.9);
      break;
    case LATER_STEAM:
      ps.emit(STEAM_RISE, x, y, z, rand(-0.1, 0.1), rand(0.35, 0.75), rand(-0.1, 0.1), color, scale);
      if (Math.random() < 0.5) ps.emit(STEAM_RISE, x + rand(-0.15, 0.15), y + 0.1, z + rand(-0.15, 0.15), 0, rand(0.5, 0.9), 0, color, scale * 0.7);
      break;
    case LATER_DUST:
      ps.emit(DUST_PUFF_MINOR, x, y, z, rand(-0.15, 0.15), rand(0.15, 0.4), rand(-0.15, 0.15), null, scale);
      if (Math.random() < 0.5) ps.emit(CHIP_DEF, x, y + 0.05, z, rand(-0.4, 0.4), rand(0.8, 1.4), rand(-0.4, 0.4), color, 0.8);
      break;
    case LATER_FROST:
      ps.emit(MIST_PUFF_SOFT, x, y, z, rand(-0.08, 0.08), rand(0.05, 0.2), rand(-0.08, 0.08), color, scale);
      if (Math.random() < 0.35) ps.emit(GLINT_MINOR, x, y + 0.08, z, 0, rand(0.2, 0.5), 0, color, 0.65);
      break;
    default:
  }
}

/**
 * Ein Gegner ist durchgekommen: kurzes, dumpfes Aufleuchten an der Basis.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 */
export function leak(fx, x, y, z) {
  const ps = fx.ps;
  burst(ps, TINT_PUFF, 4, x, y, z, 0.8, 0.5, tmpColor.copy(DULL_RED).lerp(ASH, 0.5), 0.9, 0.1);
  burst(ps, EMBER, 5, x, y, z, 0.9, 1.5, null, 1.1, 0.1);
  ps.emit(FLASH_GLOW, x, y, z, 0, 0, 0, DULL_RED, 1.3);
  fx.decals.ring(x, z, 0.3, 1.2, 0.45, DULL_RED, 0.5, { inner: 0.8, soft: 0.15, solid: 0.7 });
}

/**
 * Angekündigter Moment eines Gegners: ein Stoß Dampf bzw. Staub rund um die Figur.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z Körpermitte
 * @param {number} size
 * @param {number} floor
 */
export function phase(fx, x, y, z, size, floor) {
  burst(fx.ps, STEAM_PUFF, 10, x, y, z, 1.7 * size, 0.6, null, 1.1 * size, 0.25 * size);
  burst(fx.ps, DUST_PUFF, 6, x, floor + 0.08, z, 2.2 * size, 0.3, null, 1.1, 0.3 * size);
  fx.decals.ring(x, z, 0.3 * size, 1.5 * size, 0.5, WHITE, 0.6, { y: floor + 0.09, inner: 0.82, soft: 0.12, solid: 0.8 });
}

/**
 * Welle an einem Portal, wenn ein Gegner erscheint.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 * @param {number} size
 */
export function spawn(fx, x, y, z, size) {
  fx.decals.ring(x, z, 0.12, 0.5 * size + 0.15, 0.55, tmpColor.set('#bfeaff'), 0.55, { y: y + 0.035, inner: 0.72, soft: 0.2, solid: 0.5, gain: 1.2 });
  burst(fx.ps, GLINT_MINOR, 2, x, y + 0.25, z, 0.4, 0.8, tmpColor, 0.8, 0.15);
}

/**
 * Staubring um ein frisch bebautes Feld.
 * @param {FxContext} fx
 * @param {number} x @param {number} z
 */
export function build(fx, x, z) {
  burst(fx.ps, DUST_PUFF, 9, x, 0.07, z, 1.5, 0.35, null, 1, 0.38);
  fx.decals.ring(x, z, 0.35, 0.85, 0.42, DUST, 0.75, { inner: 0.7, soft: 0.2, solid: 0.9 });
}

/**
 * Funkeln in der Rollenfarbe um einen ausgebauten Turm.
 * @param {FxContext} fx
 * @param {number} x @param {number} z
 * @param {THREE.Color} color Rollenfarbe
 */
export function upgrade(fx, x, z, color) {
  const ps = fx.ps;
  const n = ps.amount(18);
  tmpColor.copy(color).lerp(WHITE, 0.25);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 * 2;
    const r = 0.42;
    ps.emit(GLINT, x + Math.cos(a) * r, 0.15 + (i / n) * 1.2, z + Math.sin(a) * r, -Math.sin(a) * 0.5, rand(0.5, 1.2), Math.cos(a) * 0.5, tmpColor, 1.15);
  }
  fx.decals.ring(x, z, 0.3, 0.75, 0.5, tmpColor, 0.7, { inner: 0.84, soft: 0.1, gain: 1.4, solid: 0.5 });
}

/**
 * Verschmelzung, Beginn: Eine Zutat löst sich in ein paar aufsteigende Funken ihrer Rollenfarbe auf.
 * @param {FxContext} fx
 * @param {number} x @param {number} z
 * @param {THREE.Color} color Rollenfarbe der Zutat
 */
export function fuseDissolve(fx, x, z, color) {
  tmpColor.copy(color).lerp(WHITE, 0.2);
  burst(fx.ps, GLINT_MINOR, 5, x, 0.45, z, 0.35, 0.9, tmpColor, 0.9, 0.22);
  fx.decals.ring(x, z, 0.5, 0.2, 0.5, tmpColor, 0.6, { inner: 0.8, soft: 0.14, solid: 0.5 });
}

/**
 * Verschmelzung, Ankunft der Lichter im Kern: ein weiches Aufleuchten, ein Ring, der sich ausbreitet, und ein paar
 * aufsteigende Funken. Eine kleine Feier, keine Explosion.
 * @param {FxContext} fx
 * @param {number} x @param {number} z
 * @param {THREE.Color} color Rollenfarbe des Kerns
 * @param {boolean} [mega] Megawaffe: weitere, langsamere Ringe, ein goldener Ring dazu und mehr Funken, die höher steigen
 */
export function fuseArrive(fx, x, z, color, mega = false) {
  const ps = fx.ps;
  tmpColor.copy(color).lerp(WHITE, 0.3);
  if (mega) {
    ps.emit(FLASH_GLOW, x, 0.8, z, 0, 0.2, 0, tmpColor, 2.1);
    fx.decals.ring(x, z, 0.4, 2.5, 1.05, tmpColor, 0.8, { inner: 0.9, soft: 0.07, gain: 1.3, solid: 0.5, hold: 0.35 });
    fx.decals.ring(x, z, 0.35, 1.7, 0.95, GOLD, 0.75, { inner: 0.86, soft: 0.1, gain: 1.35, solid: 0.5, delay: 0.14 });
    fx.decals.ring(x, z, 0.3, 1.1, 0.8, WARM_WHITE, 0.45, { inner: 0.6, soft: 0.25, solid: 0.4, delay: 0.05 });
  } else {
    ps.emit(FLASH_GLOW, x, 0.6, z, 0, 0.2, 0, tmpColor, 1.5);
    fx.decals.ring(x, z, 0.35, 1.55, 0.75, tmpColor, 0.85, { inner: 0.86, soft: 0.1, gain: 1.3, solid: 0.5 });
    fx.decals.ring(x, z, 0.3, 1.0, 0.6, WARM_WHITE, 0.5, { inner: 0.8, soft: 0.16, solid: 0.4, delay: 0.1 });
  }
  const n = ps.amount(mega ? 20 : 12);
  const lift = mega ? 1.35 : 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rand(-0.3, 0.3);
    const r = rand(0.25, 0.5) * lift;
    ps.emit(RISING_MOTE, x + Math.cos(a) * r, rand(0.3, 1.0) * lift, z + Math.sin(a) * r, Math.cos(a) * 0.3, rand(0.9, 1.7) * lift, Math.sin(a) * 0.3, i % 3 === 0 ? GOLD : tmpColor, 0.85);
  }
}

/**
 * Der Ring eines Pulses (Frostpuls, Feuerring) bekommt auf seiner Front kleine Flammen bzw. Reifwölkchen, jeweils in dem
 * Moment, in dem der Bodenring die Stelle erreicht (Ringe wachsen mit 1 - (1 - t)^3, siehe DecalBatch).
 * @param {FxContext} fx
 * @param {'fire' | 'frost' | 'steam' | 'dust'} kind
 * @param {number} x @param {number} z Mitte (Turm)
 * @param {number} range Endradius des Rings
 * @param {number} life Lebensdauer des Rings
 * @param {THREE.Color} color
 * @param {number} count gewünschte Anzahl der Stellen (wird nach Teilchendichte ausgedünnt)
 */
export function pulseFront(fx, kind, x, z, range, life, color, count) {
  const n = Math.max(3, Math.round(count * fx.ps.density));
  const type = kind === 'fire' ? LATER_FLAME : kind === 'steam' ? LATER_STEAM : kind === 'dust' ? LATER_DUST : LATER_FROST;
  const start = Math.random() * 6.283;
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * 6.283 + rand(-0.2, 0.2);
    const f = rand(0.72, 0.96);
    const delay = life * (1 - Math.cbrt(1 - f));
    const r = range * f;
    fx.later(delay, type, x + Math.cos(a) * r, kind === 'fire' ? 0.06 : 0.04, z + Math.sin(a) * r, kind === 'fire' ? 0.85 : kind === 'steam' ? 1.25 : 0.9, color);
  }
}

/**
 * Aufsteigende goldene Körnchen (Modernisierung, Anbruch eines Zeitalters).
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 * @param {number} waves Anzahl der Schübe
 * @param {number} scale
 * @param {THREE.Color} [color]
 */
export function risingMotes(fx, x, y, z, waves, scale, color = GOLD) {
  for (let i = 0; i < waves; i++) fx.later(i * 0.11, LATER_MOTES, x, y, z, scale, color);
}

/**
 * Ein Turm zerfällt beim Verkauf in ein paar hüpfende Münzen.
 * @param {FxContext} fx
 * @param {number} x @param {number} z
 */
export function sell(fx, x, z) {
  fx.ps.floor = 0;
  burst(fx.ps, COIN, 6, x, 0.5, z, 1.1, 3.6, null, 1, 0.1);
  burst(fx.ps, DUST_PUFF, 6, x, 0.3, z, 1.0, 0.5, null, 1.1, 0.25);
}

/**
 * Eine einzelne hüpfende Münze am Ort eines Sieges.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 * @param {number} floor
 */
export function coin(fx, x, y, z, floor) {
  fx.ps.floor = floor;
  fx.ps.emit(COIN, x, y, z, rand(-0.5, 0.5), rand(3, 3.8), rand(-0.5, 0.5), null, 1);
}

/**
 * Kleine Splitter in der Farbe eines getroffenen Gegners (bzw. türkises Flimmern auf seinem Schild).
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 * @param {THREE.Color} color
 * @param {boolean} shield
 * @param {number} floor
 * @param {number} [size] Größe der Figur (1 = gewöhnlicher Gegner)
 */
export function damage(fx, x, y, z, color, shield, floor, size = 1) {
  fx.ps.floor = floor;
  // Große Figuren (Bosse) splittern etwas größer und weiter, damit der Treffer zu ihrer Größe passt.
  const k = Math.sqrt(size);
  if (shield) burst(fx.ps, GLINT_MINOR, 2, x, y, z, 1.0 * k, 0.6, SHIELD, 0.8 * k, 0.15 * size);
  else burst(fx.ps, CHIP_DEF, 2, x, y, z, 1.3 * k, 2.2, color, 0.85 * k, 0.05 * (size - 1));
}

/**
 * Ein grünes Fünkchen über einem geheilten Gegner.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 */
export function heal(fx, x, y, z) {
  fx.ps.emit(GLINT_MINOR, x + rand(-0.15, 0.15), y + 0.2, z + rand(-0.15, 0.15), 0, 0.7, 0, HEAL, 0.9);
}

/**
 * Funken am Auftreffpunkt eines Dauerstrahls.
 * @param {FxContext} fx
 * @param {number} x @param {number} y @param {number} z
 * @param {THREE.Color} color
 */
export function beamSpark(fx, x, y, z, color) {
  fx.ps.emit(SPARK, x, y, z, rand(-1.4, 1.4), rand(0.3, 1.8), rand(-1.4, 1.4), color, 0.9);
}

export { GOLD, WARM_WHITE, WHITE, SHAPE_CORE, SHAPE_SOFT };
