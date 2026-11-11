// @ts-check
// Kleine Markierungen an Türmen, gebaut mit dem Modell-Baukasten und gezeichnet wie alle Modelle (instanziert, gemeinsame Materialien):
// Stufenpunkte am Fuß des Turms, die schwebende Sanduhr über Türmen, deren Technik veraltet ist,
// sowie Lichtkranz und Gabenlichter der Superwaffen.

import { createModel } from '../kit.js';

/** @import { ModelSpec } from '../../types/model' */

/** @type {ModelSpec | null} */
let pip = null;
/** @type {ModelSpec | null} */
let hourglass = null;
/** @type {ModelSpec | null} */
let crown = null;
/** @type {ModelSpec | null} */
let orb = null;
/** @type {ModelSpec | null} */
let megaCrown = null;

/**
 * Stufenpunkt: ein kleiner goldener Stein, der knapp über dem Boden liegt. Ursprung = Auflagepunkt.
 * Mit `ctx.level = 2` erscheint stattdessen die Marke des zweiten Ausbauzweigs: ein türkisfarbener, eckiger Kristall
 * auf quadratischem Sockel (andere Farbe UND andere Form, damit er auch für Farbenblinde unterscheidbar bleibt).
 * @returns {ModelSpec}
 */
export function pipModel() {
  if (!pip) {
    const m = createModel('fx.entity.pip');
    const body = m.part('body', { maxLevel: 1 });
    body.cyl({ r: 0.05, rTop: 0.042, h: 0.022, seg: 8, base: [0, 0, 0], color: '#5a4630', shade: 0 });
    body.sphere({ r: 0.04, detail: 0, at: [0, 0.035, 0], scale: [1, 0.62, 1], color: '#ffc840', colorTop: '#fff0a8', glow: 1 });
    const alt = m.part('alt', { minLevel: 2, maxLevel: 2 });
    alt.box({ size: [0.105, 0.022, 0.105], base: [0, 0, 0], rot: [0, Math.PI / 4, 0], color: '#2f4a55', shade: 0 });
    alt.pyramid({ size: [0.085, 0.075, 0.085], base: [0, 0.02, 0], rot: [0, Math.PI / 4, 0], color: '#35d6e8', colorTop: '#e6fdff', glow: 1 });
    pip = m.build();
  }
  return pip;
}

/**
 * Sanduhr: zwei Glaskegel Spitze an Spitze zwischen Holzdeckeln. Ursprung = Mitte der Sanduhr.
 * Sie schwebt, dreht sich langsam und wird ab und zu gewendet.
 * @returns {ModelSpec}
 */
export function hourglassModel() {
  if (!hourglass) {
    const m = createModel('fx.entity.hourglass');
    const body = m.part('body');
    const wood = '#8a5a35';
    const glass = '#f4e7c4';
    body.cyl({ r: 0.07, h: 0.022, seg: 8, at: [0, 0.092, 0], color: wood });
    body.cyl({ r: 0.07, h: 0.022, seg: 8, at: [0, -0.092, 0], color: wood });
    body.cone({ r: 0.058, h: 0.085, seg: 8, base: [0, -0.081, 0], color: '#ffc45a', colorTop: glass, glow: 1 });
    body.cone({ r: 0.058, h: 0.085, seg: 8, base: [0, 0.081, 0], rot: [Math.PI, 0, 0], color: glass, colorTop: glass, glow: 1 });
    body.sphere({ r: 0.014, detail: 0, at: [0, 0, 0], color: '#ffc45a', glow: 1 });
    for (const [x, z] of [[0.055, 0], [-0.0275, 0.0476], [-0.0275, -0.0476]]) {
      body.cyl({ r: 0.007, h: 0.17, seg: 4, at: [x, 0, z], color: wood });
    }
    hourglass = m.build({
      animate(pose, ctx) {
        const t = ctx.t + ctx.seed * 7;
        pose.body.position.y = Math.sin(t * 1.7) * 0.025;
        pose.body.rotation.y = t * 0.6;
        // Alle sieben Sekunden einmal wenden.
        const turn = (t / 7) % 1;
        const u = turn > 0.9 ? (turn - 0.9) / 0.1 : 0;
        pose.body.rotation.z = Math.PI * u * u * (3 - 2 * u);
      },
    });
  }
  return hourglass;
}

/**
 * Lichtkranz einer Superwaffe: ein schmaler, weiß leuchtender Reif, der über dem Turm schwebt. Die Rollenfarbe kommt
 * als Einfärbung der Instanz. Ursprung = Mitte des Reifs, Radius 0,3.
 * @returns {ModelSpec}
 */
export function crownModel() {
  if (!crown) {
    const m = createModel('fx.entity.crown');
    m.part('body').torus({ r: 0.3, tube: 0.02, seg: 20, tubeSeg: 4, at: [0, 0, 0], color: '#ffffff', glow: 1 });
    crown = m.build();
  }
  return crown;
}

/**
 * Gabenlicht: eine kleine leuchtende Kugel, die um den Lichtkranz einer Superwaffe kreist (eine je aufgenommenem Turm,
 * eingefärbt in dessen Rollenfarbe). Ursprung = Mitte.
 * @returns {ModelSpec}
 */
export function orbModel() {
  if (!orb) {
    const m = createModel('fx.entity.orb');
    m.part('body').sphere({ r: 0.075, detail: 1, at: [0, 0, 0], color: '#e4e4e4', colorTop: '#ffffff', glow: 1 });
    orb = m.build();
  }
  return orb;
}

/**
 * Lichtkrone einer Megawaffe: ein breiterer Reif mit sechs aufrechten Zacken, auf jeder ein Lichtpunkt. Sie schwebt über dem
 * Lichtkranz und dreht sich gegenläufig; die Farbe (Gold) kommt als Einfärbung der Instanz. Ursprung = Mitte des Reifs, Radius 0,42.
 * @returns {ModelSpec}
 */
export function megaCrownModel() {
  if (!megaCrown) {
    const m = createModel('fx.entity.megacrown');
    const body = m.part('body');
    const r = 0.42;
    body.torus({ r, tube: 0.017, seg: 24, tubeSeg: 4, at: [0, 0, 0], color: '#ffffff', glow: 1 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      body.cone({ r: 0.03, h: 0.13, seg: 5, base: [x, 0, z], color: '#ffffff', glow: 1 });
      body.sphere({ r: 0.028, detail: 0, at: [x, 0.155, z], color: '#ffffff', glow: 1 });
    }
    megaCrown = m.build();
  }
  return megaCrown;
}

// ------------------------------------------------------------------------------------------- Erkennungszeichen der Waffen
// Waffen eines Platzes teilen sich dessen Modell (docs/briefs/fusion.md, 12). Ein kleines Zeichen in der Akzentfarbe der Waffe
// (`arch.look`) macht sie unterscheidbar: am Turm im Spielfeld (entities.js, instanziert wie die Stufenpunkte) und gleich
// im Vorschaubild (thumbnails.js). Die Akzentfarbe steckt in den Leuchtflächen des Zeichens; es ist ruhig und bewegt sich sacht.

/** Bekannte Zeichen; alles andere (auch 'none') zeichnet nichts. */
export const WEAPON_MARKERS = /** @type {const} */ (['crystal', 'vial', 'pennant', 'ring', 'orb', 'spikes']);

/** @type {Map<string, ModelSpec>} */
const weaponMarks = new Map();
/** Größe der Zeichen gegenüber ihrem Modell (siehe placeWeaponMarker). */
const MARK_SIZE = 1.6;

/**
 * Mischt eine Farbe zu Weiß (k > 0) oder Schwarz (k < 0); Ergebnis als '#rrggbb'.
 * @param {string} hex
 * @param {number} k
 * @returns {string}
 */
function shadeHex(hex, k) {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Ob es zu einer Angabe `look.marker` ein Zeichen gibt.
 * @param {string | undefined} marker
 * @returns {boolean}
 */
export function hasWeaponMarker(marker) {
  return typeof marker === 'string' && /** @type {readonly string[]} */ (WEAPON_MARKERS).includes(marker);
}

/**
 * Das Zeichen einer Waffe als Modell in ihrer Akzentfarbe (je Zeichen und Farbe einmal gebaut), oder null ohne Zeichen.
 * Ursprung: siehe `placeWeaponMarker` (schwebende Zeichen um ihre Mitte, stehende auf ihrem Fuß).
 * @param {string | undefined} marker
 * @param {string} accent
 * @returns {ModelSpec | null}
 */
export function weaponMarkerModel(marker, accent) {
  if (!hasWeaponMarker(marker)) return null;
  const key = `${marker}|${accent}`;
  const cached = weaponMarks.get(key);
  if (cached) return cached;
  const m = createModel(`fx.entity.mark.${marker}`);
  const body = m.part('body');
  // Die Akzentfarbe soll lesbar bleiben: oben nur leicht aufgehellt, unten etwas satter.
  const light = shadeHex(accent, 0.3);
  const deep = shadeHex(accent, -0.25);
  const wood = '#7a5434';
  /** @type {import('../../types/model').BuildOpts} */
  let opts = {};
  // Jedes Zeichen hat eine eigene Gestalt UND eine eigene Ruhebewegung, damit es sich auch in der Ferne (ein Turm ist aus der
  // Standardansicht kaum 30 Pixel hoch) und bei ähnlichen Akzentfarben von den anderen abhebt: Der Kristall dreht sich auf der
  // Stelle, die Kugel kreist, die Zackenkrone dreht sich langsam, der Ring taumelt um den Turm, die Phiolen blubbern, der Wimpel weht.
  switch (marker) {
    case 'crystal': {
      // Kristallgruppe: ein hoher Doppelkristall mit drei schräg abstehenden Splittern; schwebt über der Spitze und dreht sich.
      body.pyramid({ size: [0.12, 0.24, 0.12], base: [0, 0, 0], color: accent, colorTop: light, glow: 1 });
      body.pyramid({ size: [0.12, 0.11, 0.12], base: [0, 0, 0], rot: [Math.PI, 0, 0], color: deep, colorTop: accent, glow: 1 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const x = Math.sin(a) * 0.075;
        const z = Math.cos(a) * 0.075;
        body.pyramid({ size: [0.06, 0.15, 0.06], base: [x, -0.05, z], rot: [Math.cos(a) * 0.55, a, -Math.sin(a) * 0.55], color: deep, colorTop: light, glow: 1 });
      }
      opts = { animate(pose, ctx) { pose.body.rotation.y = ctx.t * 0.9 + ctx.seed * 6; pose.body.position.y = Math.sin(ctx.t * 1.6 + ctx.seed * 6) * 0.03; } };
      break;
    }
    case 'orb':
      // Leuchtkugel mit schräg stehendem Reif, die in einem kleinen Kreis über der Spitze schwebt.
      body.sphere({ r: 0.115, detail: 1, at: [0, 0, 0], color: deep, colorTop: light, glow: 1 });
      body.sphere({ r: 0.042, detail: 0, at: [0.04, 0.06, 0.075], color: '#fffaf0', glow: 1 });
      body.torus({ r: 0.19, tube: 0.017, seg: 22, tubeSeg: 4, at: [0, 0, 0], rot: [0.55, 0, 0.3], color: shadeHex(accent, -0.35), glow: 1 });
      opts = {
        animate(pose, ctx) {
          const a = ctx.t * 1.1 + ctx.seed * 6;
          pose.body.position.set(Math.sin(a) * 0.07, Math.sin(ctx.t * 1.9 + ctx.seed * 4) * 0.025, Math.cos(a) * 0.07);
          pose.body.rotation.y = -ctx.t * 0.8;
        },
      };
      break;
    case 'spikes':
      // Zackenkrone: ein Reif mit acht nach außen geneigten Zacken (abwechselnd hoch und niedrig), oben auf dem Turm.
      body.torus({ r: 0.16, tube: 0.022, seg: 18, tubeSeg: 4, at: [0, 0.012, 0], color: deep, glow: 1 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const h = i % 2 === 0 ? 0.19 : 0.11;
        body.cone({ r: 0.038, h, seg: 4, base: [Math.sin(a) * 0.16, 0.01, Math.cos(a) * 0.16], rot: [Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32], color: accent, colorTop: light, glow: 1 });
      }
      opts = { animate(pose, ctx) { pose.body.rotation.y = ctx.t * 0.35 + ctx.seed * 6; } };
      break;
    case 'ring':
      // Leuchtring, der um die Mitte des Turms taumelt (wie ein schräger Planetenring), mit drei kleinen Lichtern darauf.
      // Ein dunkler Saum unter dem Reif hält ihn auch vor hellen Sockeln und Mauern lesbar.
      body.torus({ r: 0.3, tube: 0.024, seg: 32, tubeSeg: 4, at: [0, 0, 0], color: accent, colorTop: light, glow: 1 });
      body.torus({ r: 0.3, tube: 0.016, seg: 32, tubeSeg: 3, at: [0, -0.022, 0], color: shadeHex(accent, -0.6), glow: 1 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        body.sphere({ r: 0.042, detail: 0, at: [Math.sin(a) * 0.3, 0.004, Math.cos(a) * 0.3], color: light, glow: 1 });
      }
      opts = {
        animate(pose, ctx) {
          const p = ctx.t * 0.7 + ctx.seed * 6;
          pose.body.rotation.set(Math.cos(p) * 0.3, ctx.t * 0.9, Math.sin(p) * 0.3);
          pose.body.position.y = Math.sin(ctx.t * 1.3 + ctx.seed * 3) * 0.02;
        },
      };
      break;
    case 'vial': {
      // Drei Phiolen auf einem kleinen Holzgestell an der vorderen Ecke: bauchiges Glas mit leuchtender Flüssigkeit, Hals und
      // Korken. Aus der großen steigt ab und zu ein Bläschen auf.
      body.box({ size: [0.3, 0.03, 0.13], base: [0, 0, 0], color: wood, shade: 0 });
      /** @type {[number, number][]} */
      const flasks = [[-0.095, 0.058], [0.0, 0.085], [0.1, 0.05]];
      for (const [x, r] of flasks) {
        body.sphere({ r, detail: 1, at: [x, 0.03 + r * 0.95, 0], color: deep, colorTop: light, glow: 1 });
        body.cyl({ r: r * 0.36, rTop: r * 0.42, h: r * 0.9, seg: 6, base: [x, 0.03 + r * 1.75, 0], color: '#e8f4f6', glow: 1 });
        body.cyl({ r: r * 0.46, rTop: r * 0.4, h: r * 0.42, seg: 6, base: [x, 0.03 + r * 2.6, 0], color: '#a06a3c' });
      }
      const bubble = m.part('bubble', { pivot: [0, 0.3, 0] });
      bubble.sphere({ r: 0.026, detail: 0, at: [0, 0.3, 0], color: light, glow: 1 });
      opts = {
        animate(pose, ctx) {
          pose.body.rotation.z = Math.sin(ctx.t * 1.1 + ctx.seed * 6) * 0.04;
          const u = (ctx.t * 0.55 + ctx.seed) % 1;
          pose.bubble.position.set(Math.sin(u * 9) * 0.015, u * 0.22, 0);
          const k = Math.sin(u * Math.PI);
          pose.bubble.scale.set(k, k, k);
        },
      };
      break;
    }
    case 'pennant':
    default: {
      // Banner an einer Stange neben dem Turm; das Tuch weht in zwei Gliedern. Stange 1 hoch (wird mit dem Turm skaliert).
      body.cyl({ r: 0.05, h: 0.03, seg: 6, base: [0, 0, 0], color: '#5a4630', shade: 0 });
      body.cyl({ r: 0.016, h: 1.02, seg: 5, base: [0, 0, 0], color: wood });
      body.sphere({ r: 0.036, detail: 0, at: [0, 1.04, 0], color: light, glow: 1 });
      const flag = m.part('flag', { pivot: [0, 0.98, 0] });
      flag.extrude({ points: [[0, 0], [0, -0.3], [0.26, -0.27], [0.26, -0.03]], depth: 0.014, at: [0, 0.98, 0], color: accent, glow: 1 });
      const tail = m.part('tail', { pivot: [0.26, 0.98, 0], parent: 'flag' });
      tail.extrude({ points: [[0.26, -0.03], [0.26, -0.27], [0.5, -0.15]], depth: 0.014, at: [0, 0.98, 0], color: light, glow: 1 });
      opts = {
        animate(pose, ctx) {
          const w = ctx.t * 1.8 + ctx.seed * 6;
          pose.flag.rotation.y = 0.3 + Math.sin(w) * 0.28;
          pose.tail.rotation.y = Math.sin(w - 1.1) * 0.45;
        },
      };
      break;
    }
  }
  const spec = m.build(opts);
  weaponMarks.set(key, spec);
  return spec;
}

/**
 * Wo das Zeichen einer Waffe am Turm sitzt, relativ zum Fußpunkt des Turms: `fx`/`fz` ist die Richtung der Feldkante, die zur
 * Kamera zeigt (dort liegen auch die Stufenpunkte), `top` die Höhe des gezeichneten Turms. Schwebende Zeichen stehen über der
 * Spitze, der Ring liegt am Boden, Phiole und Wimpel stehen an einer vorderen bzw. seitlichen Ecke des Feldes.
 * @param {string} marker
 * @param {number} top Höhe des Turms (schon mit der Größe einer Super- oder Megawaffe)
 * @param {number} fx
 * @param {number} fz
 * @param {number} big Größe des Turms (1 = gewöhnlich)
 * @param {{ x: number, y: number, z: number, s: number }} out
 */
export function placeWeaponMarker(marker, top, fx, fz, big, out) {
  out.x = 0;
  out.z = 0;
  // Im Spielfeld sind Türme aus der Standardansicht nur gut 25 Pixel hoch: Die Zeichen sind deshalb größer, als sie neben dem
  // Modell wirken, damit Farbe und Form auf einen Blick lesbar bleiben.
  out.s = MARK_SIZE;
  switch (marker) {
    case 'crystal':
      // Über dem Lichtkranz einer Super- oder Megawaffe, nicht in ihm; die Splitter hängen unter die Mitte.
      out.y = top + 0.3 + (big - 1) * 0.9;
      break;
    case 'orb':
      out.y = top + 0.3 + (big - 1) * 0.9;
      break;
    case 'spikes':
      out.y = top - 0.06;
      out.s = MARK_SIZE * Math.min(1.4, big);
      break;
    case 'ring':
      // Um die Mitte des Turms, etwas weiter als sein Sockel.
      out.y = top * 0.5;
      out.s = 1.5 * big;
      break;
    case 'vial':
      // Vordere Ecke, seitlich neben den Stufenpunkten.
      out.x = fx * 0.36 + fz * 0.3;
      out.z = fz * 0.36 - fx * 0.3;
      out.y = 0;
      out.s = MARK_SIZE * 1.3;
      break;
    case 'pennant':
    default:
      // Hintere seitliche Ecke: Die Stange ragt neben dem Turm auf, das Banner weht über seiner Spitze.
      out.x = -fx * 0.3 - fz * 0.36;
      out.z = -fz * 0.3 + fx * 0.36;
      out.y = 0;
      out.s = Math.max(0.9, Math.min(1.9, top + 0.4));
      break;
  }
}
