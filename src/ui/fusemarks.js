// @ts-check
// Marken über dem Spielfeld während der Zutatenwahl für eine Superwaffe: Über jedem Turm, der Zutat sein kann, schwebt ein
// runder Schalter in der Farbe seiner Rolle; gewählte tragen einen Haken. Die Marken folgen der Kamera.

import { button, el, setAttr, setClass, setVisible } from './dom.js';
import { icon, roleIconName } from './icons.js';
import { actionsOf, fusionOf, giftOf, towerSignature } from './common.js';

/** @import { GameView } from '../types/app' */
/** @import { Tower } from '../types/sim' */
/** @import { FusionPick } from '../game/fusion.js' */
/** @import { HudCtx } from './common.js' */

/**
 * @param {HudCtx} ctx
 * @returns {{ root: HTMLElement, update: (view: GameView) => void, clear: () => void }}
 */
export function createFuseMarks(ctx) {
  const root = el('div', 'zw-fusemarks');
  root.hidden = true;
  const act = actionsOf(ctx.deps);
  /** @type {{ tower: Tower, btn: HTMLButtonElement, x: number, y: number }[]} */
  let marks = [];
  /** @type {FusionPick | null} */
  let last = null;
  let lastCore = -1;
  let lastSig = NaN;
  const projected = { x: 0, y: 0, visible: false };

  /**
   * @param {FusionPick} f
   * @param {GameView} v
   */
  function rebuild(f, v) {
    root.textContent = '';
    marks = v.sim.fuseCandidates(f.coreId).map((tower) => {
      const gift = giftOf(tower.arch, tower.branch);
      const btn = button('zw-fusemark', `Zutat: ${gift ? gift.name : tower.arch.role}`, icon(roleIconName(tower.arch)), el('span', 'zw-fusemark-check', icon('check')));
      btn.setAttribute('role', 'checkbox');
      btn.style.setProperty('--role', tower.arch.color);
      btn.addEventListener('click', () => act.fuseToggle(tower.id));
      root.append(btn);
      return { tower, btn, x: NaN, y: NaN };
    });
  }

  return {
    root,
    update(v) {
      const f = fusionOf(v);
      setVisible(root, !!f);
      if (!f) {
        if (last) {
          last = null;
          lastCore = -1;
          marks = [];
          root.textContent = '';
        }
        return;
      }
      const sig = towerSignature(v.sim.state);
      if (f.coreId !== lastCore || sig !== lastSig) {
        lastCore = f.coreId;
        lastSig = sig;
        rebuild(f, v);
        last = null;
      }
      if (f !== last) {
        last = f;
        for (const m of marks) {
          const on = f.picked.includes(m.tower.id);
          setClass(m.btn, 'zw-on', on);
          setAttr(m.btn, 'aria-checked', on ? 'true' : 'false');
        }
      }
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        ctx.deps.project(m.tower.x, 1.7, m.tower.z, projected);
        const x = projected.visible ? Math.round(projected.x) : -9999;
        const y = projected.visible ? Math.round(projected.y) : -9999;
        if (x !== m.x || y !== m.y) {
          m.x = x;
          m.y = y;
          m.btn.style.transform = `translate(${x}px, ${y}px)`;
        }
      }
    },
    clear() {
      last = null;
      lastCore = -1;
      marks = [];
      root.textContent = '';
      root.hidden = true;
    },
  };
}
