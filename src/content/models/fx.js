// @ts-check
// Zeitlose Modelle, die in allen Zeitaltern gleich aussehen: das Zeitportal, aus dem die Feuerdiebe treten,
// und das Wölkchen, aus dem die Luftlinien der Flieger gepunktet werden.

import * as A from '../../render/anim.js';
import { createModel } from '../../render/kit.js';

/** @import { ModelFactory } from '../../types/model' */

const STONE = '#8c8894';
const STONE_DARK = '#6f6b7a';
const STONE_LIGHT = '#a9a5b0';
const MOSS = '#7f9a6a';
const RUNE = '#d9c8ff';
const FILM = '#6f5fd6';
const FILM_LIGHT = '#a99bff';
const SWIRL = '#e6dcff';

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Zeitportal: verwitterter Steinring auf einem Sockel, leuchtende Runen, innen ein langsam wirbelnder Schimmer.
  // Blickt nach +Z (dorthin treten die Gegner heraus). Etwa 1,15 breit und 1,4 hoch.
  'fx.portal': () => {
    const m = createModel('fx.portal');
    const cy = 0.76;
    const ringR = 0.47;

    const ring = m.part('ring');
    // Sockel: flache Stufe und zwei Fußsteine, leicht eingesunken, damit auf dem abgesenkten Weg nichts schwebt.
    ring.box({ size: [1.02, 0.14, 0.42], base: [0, -0.07, 0], color: STONE_DARK, faceJitter: 0.05 });
    ring.box({ size: [0.3, 0.26, 0.36], base: [-0.42, -0.02, 0], rot: [0, 0.12, 0.06], color: STONE, faceJitter: 0.08 });
    ring.box({ size: [0.3, 0.3, 0.36], base: [0.42, -0.02, 0], rot: [0, -0.1, -0.05], color: STONE, faceJitter: 0.08 });
    // Der Ring: zwölf Keilsteine statt eines glatten Wulstes, das wirkt gemauert und alt.
    const stones = 12;
    for (let i = 0; i < stones; i++) {
      const a = (i / stones) * Math.PI * 2 + Math.PI / stones;
      const x = Math.sin(a) * ringR;
      const y = cy + Math.cos(a) * ringR;
      const big = i % 3 === 0;
      ring.box({
        size: [0.27, big ? 0.2 : 0.17, big ? 0.3 : 0.25],
        at: [x, y, 0],
        rot: [0, 0, -a],
        color: i % 2 === 0 ? STONE : STONE_LIGHT,
        faceJitter: 0.07,
      });
    }
    // Schlussstein oben und etwas Moos.
    ring.box({ size: [0.22, 0.26, 0.34], at: [0, cy + ringR + 0.03, 0], color: STONE_LIGHT, faceJitter: 0.05 });
    ring.sphere({ r: 0.09, detail: 0, at: [-0.3, cy + ringR * 0.86, 0.06], scale: [1.3, 0.5, 1.2], color: MOSS, faceJitter: 0.08 });
    ring.sphere({ r: 0.08, detail: 0, at: [0.46, 0.27, 0.05], scale: [1.2, 0.5, 1.2], color: MOSS, faceJitter: 0.08 });
    // Runen: kleine leuchtende Plättchen auf Vorder- und Rückseite der großen Steine.
    for (let i = 0; i < stones; i += 3) {
      const a = (i / stones) * Math.PI * 2 + Math.PI / stones;
      const x = Math.sin(a) * ringR;
      const y = cy + Math.cos(a) * ringR;
      for (const z of [0.157, -0.157]) ring.box({ size: [0.05, 0.11, 0.012], at: [x, y, z], rot: [0, 0, -a], color: RUNE, glow: 1.25 });
    }
    for (const z of [0.177, -0.177]) ring.box({ size: [0.06, 0.06, 0.012], at: [0, cy + ringR + 0.03, z], rot: [0, 0, Math.PI / 4], color: RUNE, glow: 1.25 });

    // Schimmernder Film im Ring: eine flache Scheibe, zum Rand hin dunkler.
    const film = m.part('film', { pivot: [0, cy, 0] });
    film.cyl({ r: 0.4, h: 0.016, seg: 12, at: [0, cy, 0], rot: [Math.PI / 2, 0, 0], color: FILM, glow: 0.85 });
    film.cyl({ r: 0.25, h: 0.02, seg: 10, at: [0, cy, 0], rot: [Math.PI / 2, 0, 0], color: FILM_LIGHT, glow: 0.9 });

    // Zwei gegenläufige Wirbel aus kurzen Bögen.
    const swirlA = m.part('swirlA', { pivot: [0, cy, 0] });
    swirlA.torus({ r: 0.31, tube: 0.022, seg: 7, tubeSeg: 4, arc: 1.5, at: [0, cy, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1.3, 1], color: SWIRL, glow: 1.2 });
    swirlA.torus({ r: 0.31, tube: 0.022, seg: 7, tubeSeg: 4, arc: 1.1, at: [0, cy, 0], rot: [Math.PI / 2, Math.PI, 0], scale: [1, 1.3, 1], color: SWIRL, glow: 1.2 });
    const swirlB = m.part('swirlB', { pivot: [0, cy, 0] });
    swirlB.torus({ r: 0.17, tube: 0.02, seg: 6, tubeSeg: 4, arc: 1.9, at: [0, cy, 0], rot: [Math.PI / 2, 0.8, 0], scale: [1, 1.5, 1], color: '#ffffff', glow: 1.15 });
    swirlB.sphere({ r: 0.045, detail: 0, at: [0, cy, 0], scale: [1, 1, 0.5], color: '#ffffff', glow: 1.3 });

    m.point('center', [0, cy, 0]);
    return m.build({
      animate(pose, ctx) {
        A.spin(pose, 'swirlA', ctx.t * 0.55 + ctx.seed * 6, 'z');
        A.spin(pose, 'swirlB', -ctx.t * 0.9 - ctx.seed * 4, 'z');
        const breathe = 1 + Math.sin(ctx.t * 1.3 + ctx.seed * 9) * 0.035;
        pose.film.scale.set(breathe, breathe, 1);
      },
    });
  },

  // Wölkchen: drei weiche Ballen. Punktiert die Luftlinie der Flieger.
  'fx.wolke': () => {
    const m = createModel('fx.wolke');
    const puff = m.part('puff', { pivot: [0, 0, 0] });
    puff.sphere({ r: 0.15, detail: 1, at: [0, 0, 0], scale: [1.1, 0.8, 1], color: '#e4eaf3', colorTop: '#ffffff', shade: 0 });
    puff.sphere({ r: 0.11, detail: 1, at: [0.15, -0.02, 0.03], scale: [1.05, 0.8, 1], color: '#e0e7f1', colorTop: '#ffffff', shade: 0 });
    puff.sphere({ r: 0.095, detail: 1, at: [-0.15, -0.025, -0.03], scale: [1.05, 0.8, 1], color: '#e0e7f1', colorTop: '#fbfdff', shade: 0 });
    return m.build();
  },
};
