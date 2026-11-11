// @ts-check
// Hinweiskarten (Tooltips): erscheinen beim Überfahren mit der Maus, bei Tastaturfokus und auf Touch-Geräten
// bei langem Druck (oder, wo ein Element sonst nichts tut, bei einfachem Tippen). Es gibt immer höchstens eine.

import { el } from './dom.js';

/**
 * @typedef {object} TooltipOptions
 * @property {boolean} [tap] Auf Touch-Geräten schon bei einfachem Tippen öffnen (für Elemente ohne eigene Aktion)
 * @property {'top' | 'left'} [side] Bevorzugte Seite (Standard: oberhalb)
 */

/**
 * @typedef {object} Tooltip
 * @property {(target: HTMLElement, build: () => Node | null, opts?: TooltipOptions) => void} attach
 * @property {() => void} hide
 * @property {() => boolean} isOpen
 */

const LONG_PRESS_MS = 420;
const HOVER_DELAY_MS = 140;

/**
 * @param {HTMLElement} host Element, in dem die Hinweiskarte liegt
 * @returns {Tooltip}
 */
export function createTooltip(host) {
  const box = el('div', 'zw-tip zw-glass');
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  host.append(box);
  /** @type {HTMLElement | null} */
  let current = null;
  let timer = 0;
  /** Zeitpunkt, bis zu dem ein Klick auf das Ziel geschluckt wird (nach langem Druck). */
  let swallowUntil = 0;

  /**
   * @param {HTMLElement} target
   * @param {() => Node | null} build
   * @param {'top' | 'left'} side
   */
  function show(target, build, side) {
    const content = build();
    if (!content) return;
    box.textContent = '';
    box.append(content);
    box.hidden = false;
    box.classList.remove('zw-tip-in');
    current = target;
    const r = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 10;
    let x = r.left + r.width / 2 - b.width / 2;
    let y = r.top - b.height - gap;
    if (side === 'left' && r.left - b.width - gap >= 8) {
      x = r.left - b.width - gap;
      y = r.top + r.height / 2 - b.height / 2;
    } else if (y < 8) {
      y = r.bottom + gap;
      if (y + b.height > vh - 8) y = Math.max(8, vh - b.height - 8);
    }
    x = Math.max(8, Math.min(x, vw - b.width - 8));
    y = Math.max(8, Math.min(y, vh - b.height - 8));
    box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    void box.offsetWidth;
    box.classList.add('zw-tip-in');
  }

  function hide() {
    window.clearTimeout(timer);
    timer = 0;
    if (!current && box.hidden) return;
    current = null;
    box.hidden = true;
    box.classList.remove('zw-tip-in');
  }

  // Ein Druck irgendwo anders schließt die Karte.
  window.addEventListener('pointerdown', (event) => {
    if (current && !(event.target instanceof Node && current.contains(event.target))) hide();
  }, true);
  window.addEventListener('blur', hide);

  return {
    attach(target, build, opts = {}) {
      const side = opts.side ?? 'top';
      target.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse') return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => show(target, build, side), HOVER_DELAY_MS);
      });
      target.addEventListener('pointerleave', (event) => {
        if (event.pointerType !== 'mouse') return;
        if (current === target || timer) hide();
      });
      target.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        window.clearTimeout(timer);
        if (opts.tap) return;
        timer = window.setTimeout(() => {
          show(target, build, side);
          swallowUntil = performance.now() + 900;
        }, LONG_PRESS_MS);
      });
      target.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse') return;
        if (opts.tap) {
          if (current === target) hide();
          else show(target, build, side);
          return;
        }
        if (current !== target) {
          window.clearTimeout(timer);
          timer = 0;
        }
      });
      target.addEventListener('pointercancel', () => {
        if (current !== target) window.clearTimeout(timer);
      });
      target.addEventListener('click', (event) => {
        // Nach einem langen Druck soll das Loslassen nicht auch noch die Aktion auslösen.
        if (performance.now() < swallowUntil && current === target) {
          event.stopImmediatePropagation();
          event.preventDefault();
          swallowUntil = 0;
        } else if (current === target && !opts.tap) {
          hide();
        }
      }, true);
      target.addEventListener('focus', () => {
        if (target.matches(':focus-visible')) show(target, build, side);
      });
      target.addEventListener('blur', () => {
        if (current === target) hide();
      });
      target.addEventListener('contextmenu', (event) => event.preventDefault());
    },
    hide,
    isOpen: () => current !== null,
  };
}
