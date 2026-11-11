// @ts-check
// Bedienoberfläche: HUD und Menüs als DOM über der 3D-Ansicht. Liest den Zustand der Partie aus dem GameView und schickt
// jeden Wunsch des Spielers über deps.actions an die Spielsteuerung; die Simulation wird hier nie direkt bedient.

import { el, readableOnDark, textOn } from './dom.js';
import { createToaster } from './common.js';
import { createHud } from './hud.js';
import { createMenus } from './menu.js';

/** @import { GameView, Ui, UiDeps } from '../types/app' */

/**
 * Baut die Oberfläche in `deps.root` auf.
 * @param {UiDeps} deps
 * @returns {Ui}
 */
export function createUi(deps) {
  const root = deps.root;
  root.classList.add('zw-root');
  /** @type {GameView | null} */
  let view = null;
  let accent = '';
  /** Ohne Weichzeichner hinter dem Glas (niedrige Grafikstufe). */
  let lowFx = false;

  /**
   * Akzentfarbe der ganzen Oberfläche; die Farbe gleitet per CSS zur neuen.
   * @param {string} color
   */
  function setAccent(color) {
    if (color === accent) return;
    accent = color;
    root.style.setProperty('--accent', color);
    root.style.setProperty('--on-accent', textOn(color));
    root.style.setProperty('--accent-text', readableOnDark(color));
  }

  function openPauseMenu() {
    if (!view) return;
    deps.actions.setPaused(true);
    hud.setVisible(true);
    menus.showPause(true);
  }

  const hud = createHud(deps, { openPauseMenu, setAccent });
  const menus = createMenus(deps, {
    view: () => view,
    resume: () => deps.actions.setPaused(false),
  });
  const menuToasts = el('div', 'zw-toasts zw-toasts-menu');
  menuToasts.setAttribute('role', 'status');
  const menuToast = createToaster(menuToasts);
  root.append(hud.root, menus.root, menuToasts);
  if (deps.content.ages[0]) setAccent(deps.content.ages[0].accent);

  // Nach einem Mausklick soll kein Knopf der Spielanzeige den Tastaturfokus behalten,
  // sonst würde die Leertaste ihn noch einmal auslösen, statt die Welle zu starten.
  hud.root.addEventListener('click', (event) => {
    const active = document.activeElement;
    if (event.detail > 0 && active instanceof HTMLElement && hud.root.contains(active)) active.blur();
  });
  // Kein Kontextmenü und keine Textauswahl auf der Spielanzeige.
  hud.root.addEventListener('contextmenu', (event) => event.preventDefault());

  /** @param {KeyboardEvent} event */
  function onKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if (menus.isOpen()) {
      if (typing && event.key !== 'Escape') return;
      if (menus.key(event)) event.preventDefault();
      return;
    }
    if (!view || typing) return;
    if (event.repeat && event.key !== '+' && event.key !== '-') {
      // Gehaltene Tasten lösen nichts mehrfach aus, sollen aber auch nicht den Browser bedienen.
      if (event.key === ' ' || event.key === 'Tab') event.preventDefault();
      return;
    }
    if (hud.key(event)) event.preventDefault();
  }
  window.addEventListener('keydown', onKey);

  return {
    showMenu(info) {
      view = null;
      hud.hide();
      if (deps.content.ages[0]) setAccent(deps.content.ages[0].accent);
      menus.showMain(info);
    },
    showGame(v) {
      view = v;
      menus.hide();
      const age = v.content.ages[v.sim.state.age];
      if (age) setAccent(age.accent);
      hud.bind(v);
      hud.update(0);
    },
    showPause(visible) {
      if (!view) return;
      menus.showPause(visible);
    },
    showResult(info) {
      hud.setVisible(false);
      menus.showResult(info);
    },
    update(dt) {
      if (!view) return;
      // Gegen unsinnige Zeitschritte gefeit sein (erstes Bild, Uhrensprünge).
      hud.update(dt > 0 ? Math.min(dt, 0.25) : 0);
      const low = deps.settings.quality === 'low';
      if (low !== lowFx) {
        lowFx = low;
        root.classList.toggle('zw-lowfx', low);
      }
    },
    handleEvents(events) {
      if (view && events.length > 0) hud.handleEvents(events);
    },
    toast(text, kind) {
      if (view && !menus.isOpen()) hud.toast(text, kind);
      else menuToast(text, kind);
    },
    get modal() {
      return menus.isOpen();
    },
  };
}
