// @ts-check
// Kleine Bibliothek wiederkehrender Bewegungen für ModelSpec.animate().
// Alle Funktionen verändern nur die übergebene Pose und allozieren nichts.
// Teile, die es im Modell nicht gibt, werden stillschweigend übersprungen.

/** @import { AnimCtx, Pose } from '../types/model' */

const TAU = Math.PI * 2;

/**
 * Laufzyklus für Zweibeiner. Beine schwingen gegenläufig um X, Arme entgegengesetzt, der Rumpf wippt.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {{ legL?: string, legR?: string, armL?: string, armR?: string, body?: string, swing?: number, armSwing?: number, bob?: number, sway?: number }} [o]
 */
export function walkBiped(pose, ctx, o = {}) {
  const k = Math.min(1, ctx.move);
  const s = Math.sin(ctx.walk);
  const swing = (o.swing ?? 0.65) * k;
  const armSwing = (o.armSwing ?? 0.5) * k;
  const legL = pose[o.legL ?? 'legL'];
  const legR = pose[o.legR ?? 'legR'];
  const armL = pose[o.armL ?? 'armL'];
  const armR = pose[o.armR ?? 'armR'];
  const body = pose[o.body ?? 'body'];
  if (legL) legL.rotation.x = s * swing;
  if (legR) legR.rotation.x = -s * swing;
  if (armL) armL.rotation.x = -s * armSwing;
  if (armR) armR.rotation.x = s * armSwing;
  if (body) {
    body.position.y += Math.abs(Math.cos(ctx.walk)) * (o.bob ?? 0.025) * k;
    body.rotation.z += s * (o.sway ?? 0.04) * k;
  }
}

/**
 * Laufzyklus für Vierbeiner: diagonale Beinpaare schwingen gemeinsam.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {{ legFL?: string, legFR?: string, legBL?: string, legBR?: string, body?: string, head?: string, swing?: number, bob?: number, nod?: number }} [o]
 */
export function walkQuadruped(pose, ctx, o = {}) {
  const k = Math.min(1, ctx.move);
  const s = Math.sin(ctx.walk);
  const swing = (o.swing ?? 0.55) * k;
  const fl = pose[o.legFL ?? 'legFL'];
  const fr = pose[o.legFR ?? 'legFR'];
  const bl = pose[o.legBL ?? 'legBL'];
  const br = pose[o.legBR ?? 'legBR'];
  const body = pose[o.body ?? 'body'];
  const head = pose[o.head ?? 'head'];
  if (fl) fl.rotation.x = s * swing;
  if (br) br.rotation.x = s * swing;
  if (fr) fr.rotation.x = -s * swing;
  if (bl) bl.rotation.x = -s * swing;
  if (body) body.position.y += Math.abs(Math.cos(ctx.walk)) * (o.bob ?? 0.02) * k;
  if (head) head.rotation.x += Math.sin(ctx.walk * 2) * (o.nod ?? 0.06) * k;
}

/**
 * Sanftes Schweben auf und ab (Flieger, Drohnen, Magie).
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [amp] Hub in Feldern
 * @param {number} [freq] Schwingungen pro Sekunde
 */
export function hover(pose, ctx, part, amp = 0.05, freq = 0.8) {
  const p = pose[part];
  if (p) p.position.y += Math.sin((ctx.t * freq + ctx.seed) * TAU) * amp;
}

/**
 * Dauerdrehung eines Teils (Rotor, Rad, Radar).
 * @param {Pose} pose
 * @param {string} part
 * @param {number} angle Winkel in Radiant, z. B. ctx.t * 12
 * @param {'x' | 'y' | 'z'} [axis]
 */
export function spin(pose, part, angle, axis = 'y') {
  const p = pose[part];
  if (p) p.rotation[axis] += angle;
}

/**
 * Richtet einen Turm aus: `yawPart` dreht sich um Y zum Ziel, `pitchPart` (optional, Kind von yawPart) neigt sich.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} yawPart
 * @param {string} [pitchPart]
 * @param {number} [maxPitch] größte Neigung in Radiant
 */
export function aim(pose, ctx, yawPart, pitchPart, maxPitch = 0.7) {
  const y = pose[yawPart];
  if (y) y.rotation.y += ctx.aimYaw;
  if (pitchPart) {
    const p = pose[pitchPart];
    if (p) p.rotation.x -= Math.max(-maxPitch, Math.min(maxPitch, ctx.aimPitch));
  }
}

/**
 * Rückstoß: das Teil schnellt beim Schuss entlang seiner lokalen -Z-Achse zurück.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [dist] Weg in Feldern
 */
export function recoil(pose, ctx, part, dist = 0.08) {
  const p = pose[part];
  if (p) p.position.z -= ctx.fire * ctx.fire * dist;
}

/**
 * Kurzes Aufblähen beim Schuss (Mündungsblitz, Energiekugel): skaliert das Teil mit ctx.fire.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [rest] Skalierung in Ruhe (0 = unsichtbar)
 * @param {number} [peak] Skalierung im Moment des Schusses
 */
export function flash(pose, ctx, part, rest = 0, peak = 1) {
  const p = pose[part];
  if (p) p.scale.setScalar(Math.max(1e-4, rest + (peak - rest) * ctx.fire));
}

/**
 * Atmen/Pulsieren: leichte gleichmäßige Größenänderung.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [amp]
 * @param {number} [freq] Schwingungen pro Sekunde
 */
export function pulse(pose, ctx, part, amp = 0.04, freq = 0.5) {
  const p = pose[part];
  if (p) p.scale.multiplyScalar(1 + Math.sin((ctx.t * freq + ctx.seed) * TAU) * amp);
}

/**
 * Wippen im Wind oder Flattern (Fahnen, Federn, Baumkronen): pendelt um eine Achse.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [amp] Ausschlag in Radiant
 * @param {number} [freq] Schwingungen pro Sekunde
 * @param {'x' | 'y' | 'z'} [axis]
 */
export function sway(pose, ctx, part, amp = 0.1, freq = 0.5, axis = 'z') {
  const p = pose[part];
  if (p) p.rotation[axis] += Math.sin((ctx.t * freq + ctx.seed) * TAU) * amp;
}

/**
 * Zusammenzucken bei einem Treffer: das Teil duckt sich kurz.
 * @param {Pose} pose
 * @param {AnimCtx} ctx
 * @param {string} part
 * @param {number} [amount]
 */
export function flinch(pose, ctx, part, amount = 0.12) {
  const p = pose[part];
  if (p && ctx.hurt > 0) {
    p.scale.y *= 1 - ctx.hurt * amount;
    p.scale.x *= 1 + ctx.hurt * amount * 0.5;
    p.scale.z *= 1 + ctx.hurt * amount * 0.5;
  }
}
