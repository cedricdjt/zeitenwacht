// @ts-check
// Referenzmodelle: zeigen Stil, Maßstab und Arbeitsweise des Baukastens.
// Sie sind die Messlatte für alle Modelle im Spiel und werden im Spiel selbst nicht verwendet.

import * as A from '../render/anim.js';
import { createModel } from '../render/kit.js';

/** @import { ModelFactory } from '../types/model' */

const ROCK = '#8f8b84';
const ROCK_DARK = '#76726c';
const WOOD = '#8a5a35';
const WOOD_LIGHT = '#b07a4c';
const SKIN = '#e3b48d';
const FUR = '#7c4b2a';
const FUR_LIGHT = '#a36a3e';
const HAIR = '#3a281c';
const BONE = '#efe6d2';
const DARK = '#2a1e16';

/** @type {Record<string, ModelFactory>} */
export const models = {
  // Turm: Steinschleuderer auf einem Holzpodest. Die Figur dreht sich zum Ziel, der Arm holt aus und wirft.
  'example.slinger': () => {
    const m = createModel('example.slinger');

    const base = m.part('base');
    base.sphere({ r: 0.36, detail: 0, at: [0, 0.1, 0], scale: [1.1, 0.5, 1.05], color: ROCK, faceJitter: 0.08 });
    base.sphere({ r: 0.2, detail: 0, at: [-0.26, 0.09, 0.22], scale: [1, 0.7, 1], rot: [0, 0.6, 0], color: ROCK_DARK, faceJitter: 0.08 });
    base.sphere({ r: 0.17, detail: 0, at: [0.28, 0.07, -0.2], scale: [1, 0.7, 1], rot: [0.3, 1.2, 0], color: ROCK_DARK, faceJitter: 0.08 });
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      base.cyl({ r: 0.04, h: 0.66, seg: 5, base: [x * 1.15, 0.04, z * 1.15], rot: [-z * 0.22, 0, x * 0.22], color: WOOD });
    }
    base.box({ size: [0.68, 0.06, 0.68], at: [0, 0.7, 0], color: WOOD_LIGHT });
    base.box({ size: [0.7, 0.05, 0.05], at: [0, 0.83, -0.32], color: WOOD });
    base.box({ size: [0.05, 0.05, 0.7], at: [-0.32, 0.83, 0], color: WOOD });
    base.box({ size: [0.05, 0.05, 0.7], at: [0.32, 0.83, 0], color: WOOD });
    for (const [x, z] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) {
      base.cyl({ r: 0.03, h: 0.16, seg: 5, base: [x, 0.72, z], color: WOOD });
    }
    // Steinvorrat
    base.sphere({ r: 0.055, detail: 0, at: [-0.2, 0.775, -0.2], color: '#a09c95' });
    base.sphere({ r: 0.05, detail: 0, at: [-0.12, 0.77, -0.23], color: '#8d8982' });
    base.sphere({ r: 0.045, detail: 0, at: [-0.19, 0.765, -0.11], color: '#97938c' });

    const figure = m.part('figure', { pivot: [0, 0.73, 0] });
    figure.box({ size: [0.06, 0.1, 0.07], base: [-0.05, 0.73, 0], color: SKIN });
    figure.box({ size: [0.06, 0.1, 0.07], base: [0.05, 0.73, 0], color: SKIN });
    figure.box({ size: [0.2, 0.17, 0.13], base: [0, 0.82, 0], color: FUR, colorTop: FUR_LIGHT });
    figure.sphere({ r: 0.095, at: [0, 1.08, 0.01], color: SKIN });
    figure.dome({ r: 0.104, seg: 6, rings: 2, at: [0, 1.085, -0.012], color: HAIR });
    figure.box({ size: [0.022, 0.026, 0.012], at: [0.035, 1.08, 0.098], color: DARK, mirror: true });
    figure.box({ size: [0.05, 0.14, 0.05], at: [-0.125, 0.9, 0], rot: [0, 0, -0.15], color: SKIN });

    const arm = m.part('arm', { pivot: [0.125, 0.97, 0], parent: 'figure' });
    arm.box({ size: [0.05, 0.16, 0.05], at: [0.125, 0.89, 0], color: SKIN });
    arm.sphere({ r: 0.04, detail: 0, at: [0.125, 0.79, 0.01], color: '#a09c95' });

    // Stufe 2: Fackel
    const deco2 = m.part('deco2', { minLevel: 2 });
    deco2.cyl({ r: 0.022, h: 0.34, seg: 5, base: [-0.32, 0.86, 0.32], color: WOOD });
    deco2.cone({ r: 0.055, h: 0.14, seg: 5, base: [-0.32, 1.19, 0.32], color: '#ff9a3c', colorTop: '#ffe08a', glow: true });
    // Stufe 3: Banner mit Schädel
    const deco3 = m.part('deco3', { minLevel: 3 });
    deco3.cyl({ r: 0.022, h: 0.74, seg: 5, base: [0.32, 0.86, -0.32], color: WOOD });
    deco3.box({ size: [0.02, 0.26, 0.2], at: [0.32, 1.42, -0.2], color: '#b8472f', colorTop: '#d4603f' });
    deco3.sphere({ r: 0.055, detail: 0, at: [0.32, 1.64, -0.32], color: BONE });

    m.point('muzzle', [0.125, 1.15, 0.12], 'figure');
    return m.build({
      animate(pose, ctx) {
        A.aim(pose, ctx, 'figure');
        // Ausholen während des Ladens, nach vorn schnellen beim Wurf.
        const windUp = ctx.charge * ctx.charge * (3 - 2 * ctx.charge);
        pose.arm.rotation.x = (-0.4 + 2.6 * windUp) * ctx.active - ctx.fire * 1.5;
        pose.figure.position.y = ctx.fire * 0.03;
      },
    });
  },

  // Gegner: Keulenträger. Gedrungene Proportionen mit großem Kopf, damit er aus der Ferne lesbar bleibt.
  'example.clubman': () => {
    const m = createModel('example.clubman');
    const body = m.part('body', { pivot: [0, 0.15, 0] });
    body.box({ size: [0.24, 0.2, 0.17], base: [0, 0.14, 0], color: FUR, colorTop: FUR_LIGHT });
    body.box({ size: [0.25, 0.04, 0.18], at: [0, 0.18, 0], color: DARK });

    const head = m.part('head', { pivot: [0, 0.34, 0], parent: 'body' });
    head.sphere({ r: 0.115, at: [0, 0.45, 0.01], color: SKIN });
    head.dome({ r: 0.126, seg: 6, rings: 2, at: [0, 0.455, -0.015], color: HAIR });
    head.box({ size: [0.026, 0.03, 0.014], at: [0.042, 0.45, 0.118], color: DARK, mirror: true });

    m.part('legL', { pivot: [-0.065, 0.15, 0] }).box({ size: [0.08, 0.15, 0.09], base: [-0.065, 0, 0], color: SKIN });
    m.part('legR', { pivot: [0.065, 0.15, 0] }).box({ size: [0.08, 0.15, 0.09], base: [0.065, 0, 0], color: SKIN });
    m.part('armL', { pivot: [-0.155, 0.32, 0], parent: 'body' }).box({ size: [0.065, 0.17, 0.065], at: [-0.155, 0.245, 0], color: SKIN });
    const armR = m.part('armR', { pivot: [0.155, 0.32, 0], parent: 'body' });
    armR.box({ size: [0.065, 0.17, 0.065], at: [0.155, 0.245, 0], color: SKIN });
    armR.cyl({ r: 0.05, rTop: 0.025, h: 0.26, seg: 6, at: [0.155, 0.22, 0.12], rot: [-1.15, 0, 0], color: WOOD, colorTop: WOOD_LIGHT });

    return m.build({
      stride: 0.5,
      animate(pose, ctx) {
        A.walkBiped(pose, ctx, { swing: 0.75 });
        A.flinch(pose, ctx, 'body');
        pose.head.rotation.z = Math.sin(ctx.walk) * 0.06;
      },
    });
  },

  // Requisit: Laubbaum.
  'example.tree': () => {
    const m = createModel('example.tree');
    const trunk = m.part('trunk');
    trunk.cyl({ r: 0.07, rTop: 0.045, h: 0.42, seg: 6, base: [0, 0, 0], color: '#7a5233', colorTop: '#946a45' });
    const crown = m.part('crown', { pivot: [0, 0.4, 0] });
    crown.sphere({ r: 0.3, detail: 1, at: [0, 0.62, 0], scale: [1, 0.85, 1], color: '#4f9a4a', colorTop: '#86c35c', faceJitter: 0.07 });
    crown.sphere({ r: 0.2, detail: 1, at: [0.17, 0.83, 0.06], color: '#5aa651', colorTop: '#93cc63', faceJitter: 0.07 });
    crown.sphere({ r: 0.17, detail: 1, at: [-0.16, 0.8, -0.08], color: '#58a44f', colorTop: '#8fc960', faceJitter: 0.07 });
    return m.build({
      animate(pose, ctx) {
        A.sway(pose, ctx, 'crown', 0.035, 0.25);
      },
    });
  },

  // Requisit: Felsgruppe.
  'example.rock': () => {
    const m = createModel('example.rock');
    const p = m.part('rock').sphere({ r: 0.24, detail: 0, at: [0, 0.12, 0], scale: [1.1, 0.75, 0.9], rot: [0.2, 0.4, 0], color: ROCK, faceJitter: 0.1 });
    p.sphere({ r: 0.14, detail: 0, at: [0.22, 0.07, 0.12], scale: [1, 0.8, 1], rot: [0.5, 1.1, 0.2], color: ROCK_DARK, faceJitter: 0.1 });
    p.sphere({ r: 0.1, detail: 0, at: [-0.2, 0.05, 0.16], rot: [1, 0.3, 0.6], color: '#9a968e', faceJitter: 0.1 });
    return m.build();
  },
};
