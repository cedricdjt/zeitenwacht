// @ts-check
// Karte „Nächste Welle“: Zusammensetzung der kommenden Welle als Vorschaubilder, großer Startknopf mit Frühstart-Prämie
// und der Schalter „Automatisch“. Während eine Welle läuft, zeigt sie, was noch kommt und was auf dem Feld ist.

import { button, el, setAttr, setClass, setText, setVisible } from './dom.js';
import { icon } from './icons.js';
import { enemyTip, isMidBoss, kbd, thumbImg, traitIcons } from './common.js';
import { modifierColor, modifierLine, modifierTip } from './boons.js';
import { num } from './texts.js';

/** @import { GameView } from '../types/app' */
/** @import { HudCtx } from './common.js' */

/**
 * @typedef {object} WavePanel
 * @property {HTMLElement} root
 * @property {HTMLButtonElement} startButton
 * @property {(view: GameView) => void} bind
 * @property {(view: GameView) => void} update
 * @property {(view: GameView) => boolean} needsFirstTower Ob der Start noch gesperrt ist, weil in der ersten Partie kein Turm steht
 * @property {(() => void) | null} onBlockedStart Klick auf den Startknopf, solange eine Zeitgabe zur Wahl steht
 */

/**
 * @param {HudCtx} ctx
 * @returns {WavePanel}
 */
export function createWavePanel(ctx) {
  const title = el('span', 'zw-wave-title');
  const bossTagText = el('span', '', 'Boss');
  const bossTag = el('span', 'zw-wave-boss', icon('crown'), bossTagText);
  const hint = el('div', 'zw-wave-hint');
  // Wege, die sich mit dem Zeitalter wandeln: Warnung eine Welle vorher, Hinweis auf der ersten Welle danach.
  const pathNoteText = el('span', '');
  const pathNote = el('div', 'zw-wave-path', icon('map'), pathNoteText);
  pathNote.hidden = true;
  // Eigenart der Welle (Nebel, Eilmarsch ...): Symbol, Name und eine Zeile in ihrer Farbe, anders als die Wegwarnung.
  const modIcon = el('span', 'zw-wave-mod-icon');
  const modName = el('b', 'zw-wave-mod-name');
  const modLine = el('span', 'zw-wave-mod-line');
  const modNote = el('div', 'zw-wave-mod', modIcon, el('span', 'zw-wave-mod-text', modName, modLine));
  modNote.hidden = true;
  modNote.tabIndex = 0;
  /** @type {import('../types/content').WaveModifierDef | null} */
  let modDef = null;
  ctx.tip.attach(modNote, () => (modDef ? modifierTip(modDef, 'Eigenart dieser Welle') : null), { tap: true });
  const groups = el('div', 'zw-wave-groups');
  const startLabel = el('span', 'zw-start-label', 'Welle starten');
  const bonusN = el('span', 'zw-price-n');
  const bonus = el('span', 'zw-start-bonus zw-price', '+', icon('coin'), bonusN);
  // Leertaste als kleines Symbol statt Wort: spart Platz auf dem Knopf.
  const spaceKey = kbd('');
  spaceKey.classList.add('zw-kbd-space');
  spaceKey.innerHTML = '<svg viewBox="0 0 20 8" aria-hidden="true"><path d="M2 1v5h16V1"/></svg>';
  const startButton = button('zw-btn zw-primary zw-start', 'Welle starten (Leertaste)', icon('play'), startLabel, bonus, spaceKey);
  const status = el('div', 'zw-wave-status');
  const statusField = el('span', 'zw-wave-count');
  const statusPending = el('span', 'zw-wave-count');
  status.append(el('span', 'zw-wave-stat', statusField, ' auf dem Feld'), el('span', 'zw-wave-stat', statusPending, ' folgen'));
  const autoBox = el('span', 'zw-switch-box');
  const auto = button('zw-switch', 'Nächste Welle automatisch starten', autoBox, el('span', 'zw-switch-label', 'Automatisch'));
  auto.setAttribute('role', 'switch');
  const foot = el('div', 'zw-wave-foot', startButton, status);
  const root = el('section', 'zw-wave zw-glass', el('header', 'zw-wave-head', title, bossTag, auto), modNote, pathNote, hint, groups, foot);
  root.setAttribute('aria-label', 'Nächste Welle');

  /** @type {GameView | null} */
  let view = null;
  let lastKey = -1;
  let lastBonus = -1;
  let lastAlive = -1;
  let lastPending = -1;

  startButton.addEventListener('click', () => {
    if (!view) return;
    if (view.sim.state.boonOffer.length > 0 && api.onBlockedStart) api.onBlockedStart();
    else ctx.deps.actions.startWave();
  });
  auto.addEventListener('click', () => {
    if (view) ctx.deps.actions.changeSettings({ autoStart: !view.settings.autoStart });
  });

  /**
   * @param {GameView} v
   * @returns {boolean}
   */
  function needsFirstTower(v) {
    const st = v.sim.state;
    return !v.settings.tutorialDone && st.wave === 0 && st.phase === 'build' && st.towers.length === 0;
  }

  /**
   * Baut Titel und Gegnerbilder neu auf.
   * @param {GameView} v
   */
  function rebuild(v) {
    const st = v.sim.state;
    const preview = v.sim.wavePreview(0);
    groups.textContent = '';
    if (!preview) return;
    const running = st.phase === 'wave';
    setText(title, running ? `Welle ${preview.wave + 1} läuft` : `Nächste Welle: ${preview.wave + 1}`);
    setVisible(bossTag, preview.boss);
    // Nur Zwischenbosse in der Welle: kleiner angekündigt als der Endboss.
    const mid = preview.boss && preview.groups.every((g) => !g.def.boss || isMidBoss(v.content, g.def));
    setText(bossTagText, mid ? 'Zwischenboss' : 'Boss');
    setClass(bossTag, 'zw-wave-boss-mid', mid);
    setText(hint, preview.hint || '');
    setVisible(hint, !!preview.hint);
    // Ändert sich der Weg nach dieser Welle, oder läuft diese Welle als erste auf einem neuen Weg?
    const sim = v.sim;
    const now = sim.pathStage();
    const after = sim.wavePreview(1);
    let note = '';
    let soon = false;
    if (after && after.stage !== now) {
      const stage = sim.map.stages?.[after.stage];
      note = stage ? `Nach dieser Welle ändert sich der Weg: ${stage.name}` : 'Nach dieser Welle ändert sich der Weg';
      soon = true;
    } else if (now > 0 && st.age === now && st.waveInAge === 0) {
      const stage = sim.map.stages?.[now];
      note = stage ? `Neuer Weg: ${stage.name}` : 'Neuer Weg';
    }
    setText(pathNoteText, note);
    setVisible(pathNote, note !== '');
    setClass(pathNote, 'zw-wave-path-soon', soon);
    const mod = preview.modifier && v.content.modifiers ? v.content.modifiers[preview.modifier] : undefined;
    modDef = mod || null;
    if (mod) {
      modIcon.textContent = '';
      modIcon.append(icon(mod.icon));
      setText(modName, mod.name);
      setText(modLine, modifierLine(mod));
      modNote.style.setProperty('--mod', modifierColor(mod));
      setAttr(modNote, 'aria-label', `Eigenart dieser Welle: ${mod.name}. ${mod.text}`);
    }
    setVisible(modNote, !!mod);
    for (const group of preview.groups) {
      const def = group.def;
      const chip = button('zw-foe' + (def.boss ? ' zw-foe-boss' : ''), `${group.count} × ${def.name}`,
        thumbImg(ctx, def.model, 'zw-foe-img'), el('span', 'zw-foe-n', '×' + num(group.count)), traitIcons(v.content, def));
      ctx.tip.attach(chip, () => enemyTip(ctx, def, group.count), { tap: true });
      groups.append(chip);
    }
  }

  /** @type {WavePanel} */
  const api = {
    root,
    startButton,
    needsFirstTower,
    onBlockedStart: null,
    bind(v) {
      view = v;
      lastKey = -1;
      lastBonus = -1;
      lastAlive = -1;
      lastPending = -1;
    },
    update(v) {
      view = v;
      const st = v.sim.state;
      const over = st.phase === 'won' || st.phase === 'lost' || st.wave >= v.sim.totalWaves;
      setVisible(root, !over);
      if (over) return;
      const running = st.phase === 'wave';
      const key = st.wave * 2 + (running ? 1 : 0);
      if (key !== lastKey) {
        lastKey = key;
        rebuild(v);
      }
      setVisible(startButton, !running);
      setVisible(status, running);
      if (running) {
        const alive = st.enemies.length;
        if (alive !== lastAlive) {
          lastAlive = alive;
          setText(statusField, num(alive));
        }
        if (st.pending !== lastPending) {
          lastPending = st.pending;
          setText(statusPending, num(st.pending));
        }
      } else {
        const locked = st.lock > 0;
        const waiting = needsFirstTower(v);
        const boon = st.boonOffer.length > 0;
        setClass(startButton, 'zw-disabled', locked || waiting || boon);
        setClass(startButton, 'zw-start-boon', boon);
        setAttr(startButton, 'aria-disabled', locked || waiting || boon ? 'true' : null);
        setAttr(startButton, 'title', boon ? 'Die nächste Welle startet, sobald du eine Zeitgabe gewählt hast' : null);
        setText(startLabel, boon ? 'Erst Zeitgabe wählen' : locked ? 'Zeitenwende …' : waiting ? 'Erst einen Turm bauen' : 'Welle starten');
        const b = locked || waiting || boon ? 0 : v.sim.earlyBonus();
        if (b !== lastBonus) {
          lastBonus = b;
          setText(bonusN, num(b));
          setVisible(bonus, b > 0);
          setAttr(bonus, 'title', b > 0 ? 'Frühstart-Prämie: schmilzt, solange du wartest' : null);
        }
      }
      const on = v.settings.autoStart;
      setClass(auto, 'zw-on', on);
      setAttr(auto, 'aria-checked', on ? 'true' : 'false');
    },
  };
  return api;
}
