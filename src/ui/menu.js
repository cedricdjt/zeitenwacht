// @ts-check
// Menüs über der sich langsam drehenden Insel: Hauptmenü, neue Partie (Karte und Schwierigkeit), Anleitung, Einstellungen,
// Pause und Ergebnis. Immer ist höchstens ein Bildschirm zu sehen; Esc geht einen Schritt zurück.

import { button, el, readableOnDark, retrigger } from './dom.js';
import { icon, roleIconName } from './icons.js';
import { boonList } from './boons.js';
import { colorCss, tileChip, tileEffect } from './tiles.js';
import { tileDef } from '../sim/rules.js';
import { AGE_DATIVE, clockTime, DIFFICULTIES, GAME_SUBTITLE, GAME_TITLE, KEY_HELP, num, recordKey } from './texts.js';
import { TRAIT_DEFS } from './traits.js';
import { allRecipes, bookOf, coreName, FIND_TEXT, recipeFormula, recipeList, recipeNeeds, recipeParts, recipeRiddle, recipeWhere } from './recipes.js';
import { actionsOf, kbd, makeThumb, roleDot } from './common.js';
import { contentSlots, hitsFliers, isClassic } from '../sim/rules.js';
import { loadoutWeapons, weaponLine, weaponLook, weaponName } from './loadout.js';

/** @import { GameView, MenuInfo, Quality, ResultInfo, Settings, UiDeps } from '../types/app' */
/** @import { Content, Difficulty, MapDef } from '../types/content' */

/**
 * @typedef {object} MenuHost
 * @property {() => GameView | null} view Laufende Partie oder null
 * @property {() => void} resume Pausenmenü wurde geschlossen: weiterspielen
 */

/**
 * @typedef {object} Menus
 * @property {HTMLElement} root
 * @property {(info: MenuInfo) => void} showMain
 * @property {(visible: boolean) => void} showPause
 * @property {(info: ResultInfo) => void} showResult
 * @property {() => void} hide
 * @property {() => boolean} isOpen
 * @property {(event: KeyboardEvent) => boolean} key
 */

/** @typedef {'main' | 'maps' | 'help' | 'settings' | 'book' | 'pause' | 'result'} Screen */

/**
 * Stufen einer Karte, die in einer Partie erreicht werden und Wege bringen (wie Sim.pathStages ohne die 0).
 * @param {Content} content
 * @param {MapDef} map
 * @returns {{ age: number, paths: [number, number][][], name: string, text: string }[]}
 */
function laterStages(content, map) {
  /** @type {{ age: number, paths: [number, number][][], name: string, text: string }[]} */
  const out = [];
  const stages = map.stages ?? [];
  for (let i = 1; i < stages.length && i < content.ages.length; i++) {
    const stage = stages[i];
    if (stage && stage.paths) out.push({ age: i, paths: stage.paths, name: stage.name, text: stage.text });
  }
  return out;
}

/**
 * Gezeichnete Vorschau einer Karte aus ihren Wegen; besondere Bauplätze als kleine Marken in der Farbe ihrer Art.
 * Wege späterer Stufen erscheinen gestrichelt unter dem Grundweg, ihre neuen Tore als offene Ringe.
 * @param {Content} content
 * @param {MapDef} map
 * @returns {SVGSVGElement}
 */
function mapPreview(content, map) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `-1.6 -1.6 ${map.width + 3.2} ${map.height + 3.2}`);
  svg.setAttribute('class', 'zw-mapsvg');
  svg.setAttribute('aria-hidden', 'true');
  let html = `<rect class="zw-map-ground" x="0" y="0" width="${map.width}" height="${map.height}" rx="1.4"/>`;
  for (const [x, z] of map.blocked) html += `<rect class="zw-map-block" x="${x + 0.14}" y="${z + 0.14}" width="0.72" height="0.72" rx="0.24"/>`;
  for (const t of map.tiles ?? []) {
    const def = tileDef(content, t.kind);
    if (def) html += `<rect class="zw-map-tile" x="${t.tx + 0.1}" y="${t.tz + 0.1}" width="0.8" height="0.8" rx="0.26" fill="${colorCss(def.color)}"/>`;
  }
  /** @param {[number, number][]} path */
  const line = (path) => path.map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${x + 0.5} ${z + 0.5}`).join(' ');
  // Spätere Wege: gestrichelt, darüber deckt der Grundweg, was bleibt.
  const later = laterStages(content, map);
  /** @type {Set<string>} */
  const gates = new Set(map.paths.map((p) => `${p[0][0]},${p[0][1]}`));
  for (const stage of later) {
    for (const path of stage.paths) html += `<path class="zw-map-future" d="${line(path)}"/>`;
  }
  for (const stage of later) {
    for (const path of stage.paths) {
      const key = `${path[0][0]},${path[0][1]}`;
      if (gates.has(key)) continue;
      gates.add(key);
      html += `<circle class="zw-map-gate zw-map-gate-future" cx="${path[0][0] + 0.5}" cy="${path[0][1] + 0.5}" r="0.55"/>`;
    }
  }
  for (const path of map.paths) {
    const d = line(path);
    html += `<path class="zw-map-edge" d="${d}"/>`;
  }
  for (const path of map.paths) {
    const d = path.map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${x + 0.5} ${z + 0.5}`).join(' ');
    html += `<path class="zw-map-path" d="${d}"/>`;
  }
  for (const path of map.paths) {
    const [sx, sz] = path[0];
    html += `<circle class="zw-map-gate" cx="${sx + 0.5}" cy="${sz + 0.5}" r="0.62"/>`;
  }
  const end = map.paths[0][map.paths[0].length - 1];
  html += `<circle class="zw-map-flame" cx="${end[0] + 0.5}" cy="${end[1] + 0.5}" r="0.85"/>`;
  svg.innerHTML = html;
  return svg;
}

/**
 * Die besonderen Bauplätze einer Karte als kleine Legende: Marke, Name und Anzahl je Art.
 * @param {Content} content
 * @param {MapDef} map
 * @returns {HTMLElement | null}
 */
function tileLegend(content, map) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const t of map.tiles ?? []) if (tileDef(content, t.kind)) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  if (counts.size === 0) return null;
  const list = el('div', 'zw-map-legend');
  for (const [kind, n] of counts) {
    const def = /** @type {import('../types/content').SpecialTileDef} */ (tileDef(content, kind));
    const chip = el('span', 'zw-map-legend-item', tileChip(def), el('span', '', (n > 1 ? `${n} × ` : '') + def.name), el('small', '', tileEffect(def)));
    list.append(chip);
  }
  return list;
}

/**
 * Was sich an den Wegen einer Karte im Lauf der Partie ändert, je Stufe eine Zeile („Ab dem Mittelalter: Das Nordtor“).
 * @param {Content} content
 * @param {MapDef} map
 * @returns {HTMLElement | null}
 */
function stageLegend(content, map) {
  const later = laterStages(content, map);
  if (later.length === 0) return null;
  const list = el('div', 'zw-map-stages');
  for (const stage of later) {
    const age = content.ages[stage.age];
    const item = el('div', 'zw-map-stage', el('span', 'zw-map-stage-chip'), el('b', '', `Ab ${AGE_DATIVE[age.id] ?? age.name}:`), ` ${stage.name}`);
    item.title = stage.text;
    list.append(item);
  }
  return list;
}

/**
 * Schalter (an/aus) als Zeile.
 * @param {string} label
 * @param {string} hint
 * @param {boolean} on
 * @param {(on: boolean) => void} change
 * @returns {HTMLElement}
 */
function switchRow(label, hint, on, change) {
  const box = el('span', 'zw-switch-box');
  const btn = button('zw-switch' + (on ? ' zw-on' : ''), label, box);
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  let state = on;
  btn.addEventListener('click', () => {
    state = !state;
    btn.classList.toggle('zw-on', state);
    btn.setAttribute('aria-checked', state ? 'true' : 'false');
    change(state);
  });
  return el('div', 'zw-set-row', el('div', 'zw-set-label', el('span', '', label), hint ? el('small', '', hint) : null), btn);
}

/**
 * Schieberegler 0..1 als Zeile.
 * @param {string} label
 * @param {number} value
 * @param {(value: number) => void} change
 * @returns {HTMLElement}
 */
function sliderRow(label, value, change) {
  const input = el('input', 'zw-slider');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  input.setAttribute('aria-label', label);
  const out = el('span', 'zw-set-value', input.value + ' %');
  const sync = () => {
    input.style.setProperty('--fill', input.value + '%');
    out.textContent = input.value + ' %';
  };
  sync();
  input.addEventListener('input', () => {
    sync();
    change(Number(input.value) / 100);
  });
  return el('div', 'zw-set-row', el('div', 'zw-set-label', el('span', '', label)), el('div', 'zw-set-slider', input, out));
}

/**
 * @param {UiDeps} deps
 * @param {MenuHost} host
 * @returns {Menus}
 */
export function createMenus(deps, host) {
  const panel = el('div', 'zw-screen');
  const dialogBox = el('div', 'zw-dialog');
  dialogBox.hidden = true;
  const root = el('div', 'zw-modal', el('div', 'zw-scrim'), panel, dialogBox);
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  /** @type {Screen[]} */
  let stack = [];
  /** @type {MenuInfo} */
  let menuInfo = { save: null, records: {} };
  /** @type {ResultInfo | null} */
  let resultInfo = null;
  let chosenMap = deps.content.maps[0] ? deps.content.maps[0].id : '';
  /** @type {Difficulty} */
  let chosenDifficulty = 'normal';
  /** @type {(() => void) | null} */
  let dialogCancel = null;
  /** Ob die letzte Eingabe von der Tastatur kam. */
  let keyboard = false;
  window.addEventListener('keydown', () => {
    keyboard = true;
  }, true);
  window.addEventListener('pointerdown', () => {
    keyboard = false;
  }, true);

  /** @returns {Settings} */
  const settings = () => deps.settings;
  const thumb = makeThumb(deps);

  /**
   * Großer Menüknopf mit Symbol und optionaler Unterzeile.
   * @param {string} label
   * @param {string} iconName
   * @param {() => void} action
   * @param {{ primary?: boolean, sub?: string, key?: string }} [opts]
   * @returns {HTMLButtonElement}
   */
  function menuButton(label, iconName, action, opts = {}) {
    const btn = button('zw-btn zw-menu-btn' + (opts.primary ? ' zw-primary' : ''), label, icon(iconName),
      el('span', 'zw-menu-btn-text', el('span', '', label), opts.sub ? el('small', '', opts.sub) : null), opts.key ? kbd(opts.key) : null);
    btn.addEventListener('click', action);
    return btn;
  }

  /**
   * Kopfzeile eines Unterbildschirms mit Zurück-Knopf.
   * @param {string} title
   * @returns {HTMLElement}
   */
  function subHead(title) {
    const back = button('zw-iconbtn', 'Zurück (Esc)', icon('back'));
    back.addEventListener('click', () => goBack());
    return el('header', 'zw-sub-head', back, el('h2', 'zw-h2', title));
  }

  /**
   * Rückfrage vor Aktionen, die die Partie beenden.
   * @param {string} text
   * @param {string} yes
   * @param {() => void} action
   */
  function confirm(text, yes, action) {
    dialogBox.textContent = '';
    const cancel = button('zw-btn', 'Abbrechen', 'Abbrechen');
    const ok = button('zw-btn zw-primary', yes, yes);
    const close = () => {
      dialogBox.hidden = true;
      dialogCancel = null;
    };
    cancel.addEventListener('click', close);
    ok.addEventListener('click', () => {
      close();
      action();
    });
    dialogBox.append(el('div', 'zw-dialog-card zw-glass', el('p', 'zw-dialog-text', text), el('div', 'zw-dialog-actions', cancel, ok)));
    dialogBox.hidden = false;
    dialogCancel = close;
    if (keyboard) ok.focus({ preventScroll: true });
  }

  // ----- Bildschirme -----

  function renderMain() {
    const list = el('nav', 'zw-menu-list');
    const save = menuInfo.save;
    if (save) {
      const map = deps.content.maps.find((m) => m.id === save.mapId);
      const diff = deps.content.balance.difficulty[save.difficulty];
      const sub = `${map ? map.name : save.mapId} · ${diff ? diff.name : save.difficulty} · Welle ${Math.min(save.wave + 1, save.totalWaves)} / ${save.totalWaves} · ${save.ageName}`;
      list.append(menuButton('Fortsetzen', 'play', () => deps.actions.continueGame(), { primary: true, sub }));
    }
    list.append(menuButton('Neues Spiel', 'flame', () => open('maps'), { primary: !save }));
    list.append(menuButton('Anleitung', 'book', () => open('help')));
    list.append(menuButton('Rezeptbuch', 'recipe', () => open('book'), { sub: bookCount() }));
    list.append(menuButton('Einstellungen', 'gear', () => open('settings')));
    const mark = el('span', 'zw-title-mark', icon('flame'));
    panel.append(el('div', 'zw-main zw-glass',
      el('header', 'zw-main-head', mark, el('h1', 'zw-title', GAME_TITLE), el('p', 'zw-subtitle', GAME_SUBTITLE)),
      list,
      el('p', 'zw-main-foot', 'Ein Tag durch die Geschichte – von der Steinzeit bis in die nahe Zukunft.')));
  }

  function renderMaps() {
    const content = deps.content;
    // Links eine knappe Liste aller Karten, rechts die gewählte groß mit Beschreibung und ihren besonderen Bauplätzen,
    // darunter die Schwierigkeit: Alles passt bei 1280 × 800 ohne Rollen auf den Schirm.
    const maps = el('div', 'zw-choice zw-maplist');
    maps.setAttribute('role', 'radiogroup');
    maps.setAttribute('aria-label', 'Karte');
    const diffs = el('div', 'zw-choice zw-diffs');
    diffs.setAttribute('role', 'radiogroup');
    diffs.setAttribute('aria-label', 'Schwierigkeit');
    const detail = el('div', 'zw-map-detail');
    /** @type {{ btn: HTMLButtonElement, map: MapDef, record: HTMLElement }[]} */
    const mapCards = [];
    /** @type {{ btn: HTMLButtonElement, id: Difficulty }[]} */
    const diffCards = [];
    let shownMap = '';

    /**
     * @param {MapDef} map
     * @param {boolean} long
     * @returns {HTMLElement[]}
     */
    const recordText = (map, long) => {
      const rec = menuInfo.records[recordKey(map.id, chosenDifficulty)];
      if (rec && rec.score > 0) return [icon(rec.won ? 'trophy' : 'star'), el('span', '', `${long ? 'Bestwert ' : ''}${num(rec.score)}` + (rec.won ? ' · gewonnen' : ` · Welle ${rec.wave}`))];
      return [el('span', '', long ? 'Noch kein Bestwert' : 'kein Bestwert')];
    };

    const refresh = () => {
      for (const c of mapCards) {
        const on = c.map.id === chosenMap;
        c.btn.classList.toggle('zw-on', on);
        c.btn.setAttribute('aria-checked', on ? 'true' : 'false');
        c.record.textContent = '';
        c.record.append(...recordText(c.map, false));
      }
      for (const c of diffCards) {
        const on = c.id === chosenDifficulty;
        c.btn.classList.toggle('zw-on', on);
        c.btn.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      const map = content.maps.find((m) => m.id === chosenMap) ?? content.maps[0];
      if (!map) return;
      const key = map.id + ':' + chosenDifficulty;
      if (key === shownMap) return;
      const fresh = !shownMap.startsWith(map.id + ':');
      shownMap = key;
      detail.textContent = '';
      detail.append(
        el('span', 'zw-map-detail-art', mapPreview(content, map)),
        el('div', 'zw-map-detail-text',
          el('div', 'zw-map-detail-name', map.name),
          el('p', 'zw-map-detail-desc', map.description),
          tileLegend(content, map),
          stageLegend(content, map),
          el('div', 'zw-pick-record zw-map-detail-record', ...recordText(map, true))));
      if (fresh) retrigger(detail, 'zw-map-detail-in');
    };

    content.maps.forEach((map) => {
      const record = el('span', 'zw-mapitem-record');
      const btn = button('zw-pick zw-mapitem', map.name, el('span', 'zw-mapitem-art', mapPreview(content, map)),
        el('span', 'zw-mapitem-text', el('span', 'zw-mapitem-name', map.name), record));
      btn.setAttribute('role', 'radio');
      btn.addEventListener('click', () => {
        chosenMap = map.id;
        refresh();
      });
      mapCards.push({ btn, map, record });
      maps.append(btn);
    });
    for (const id of DIFFICULTIES) {
      const def = content.balance.difficulty[id];
      if (!def) continue;
      const gold = Math.round(content.balance.startGold * def.gold);
      const btn = button('zw-pick zw-pick-diff', def.name, el('span', 'zw-pick-name', def.name), el('span', 'zw-pick-text', def.description),
        el('span', 'zw-pick-facts', el('span', '', icon('flame'), `${def.lives} Funken`), el('span', '', icon('coin'), `${num(gold)} Gold`)));
      btn.setAttribute('role', 'radio');
      btn.addEventListener('click', () => {
        chosenDifficulty = id;
        refresh();
      });
      diffCards.push({ btn, id });
      diffs.append(btn);
    }
    refresh();
    const weapons = loadoutSection();
    const go = button('zw-btn zw-primary zw-go', "Los geht's", "Los geht’s", icon('play'));
    go.addEventListener('click', () => deps.actions.newGame(chosenMap, chosenDifficulty));
    panel.append(el('div', 'zw-sub zw-glass zw-sub-wide zw-newgame', subHead('Neues Spiel'),
      el('div', 'zw-sub-body',
        el('div', 'zw-newgame-top',
          el('section', 'zw-newgame-maps', el('h3', 'zw-h3', 'Karte'), maps),
          detail),
        el('h3', 'zw-h3', 'Schwierigkeit'), diffs,
        weapons),
      el('footer', 'zw-sub-foot', go)));
  }

  /**
   * „Waffen dieser Partie“: die sechs Waffen der nächsten Partie in Reihenfolge der Plätze (Bild, Name, Farbe des Platzes,
   * Flügel, wenn sie Flieger trifft), dazu „Zufall“ oder „Klassisch“ und „Neu ziehen“. Die Spielsteuerung hält die Ziehung;
   * genau sie bekommt die Partie. Ohne Spielsteuerung dafür (Testseite) entfällt der Abschnitt.
   * @returns {HTMLElement | null}
   */
  function loadoutSection() {
    const act = actionsOf(deps);
    if (typeof act.loadoutPlan !== 'function') return null;
    const content = deps.content;
    const row = el('div', 'zw-loadout');
    row.setAttribute('role', 'list');
    row.setAttribute('aria-label', 'Waffen dieser Partie');
    const info = el('p', 'zw-loadout-info');
    const seg = el('div', 'zw-seg zw-loadout-mode');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Art der Bewaffnung');
    const modes = /** @type {const} */ ([['random', 'Zufall'], ['classic', 'Klassisch']]);
    const modeButtons = modes.map(([id, label]) => {
      const b = button('zw-seg-btn', label, label);
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => show(act.setLoadoutMode(id)));
      seg.append(b);
      return { b, id };
    });
    const redraw = button('zw-btn zw-loadout-redraw', 'Neu ziehen', icon('auto'), el('span', '', 'Neu ziehen'));
    redraw.addEventListener('click', () => {
      show(act.redrawLoadout());
      retrigger(row, 'zw-loadout-in');
    });
    let defaultInfo = '';

    /** @param {import('../game/fusion.js').LoadoutPlanView} plan */
    function show(plan) {
      for (const { b, id } of modeButtons) {
        b.classList.toggle('zw-on', id === plan.mode);
        b.setAttribute('aria-checked', id === plan.mode ? 'true' : 'false');
      }
      redraw.title = plan.mode === 'classic' ? 'Zufällige Waffen ziehen' : 'Andere Waffen ziehen';
      row.textContent = '';
      const slots = contentSlots(content);
      loadoutWeapons(content, plan.ids).forEach((arch, i) => {
        const tier = arch.tiers.find((t) => t !== null) ?? null;
        const img = el('img', 'zw-loadout-img');
        img.alt = '';
        img.draggable = false;
        const src = tier ? thumb(tier.model, 1, 96, weaponLook(arch)) : '';
        if (src) img.src = src;
        const air = hitsFliers(arch) ? el('span', 'zw-loadout-air', icon('air')) : null;
        if (air) air.title = 'trifft Flieger';
        const slot = slots[i];
        const text = `${weaponLine(arch)}${hitsFliers(arch) ? ' · trifft Flieger' : ''} – ${arch.summary}`;
        const chip = button('zw-loadout-item', text, el('span', 'zw-loadout-stripe'), el('span', 'zw-loadout-art', img, air),
          el('span', 'zw-loadout-name', weaponName(arch)), el('span', 'zw-loadout-slot', isClassic(arch) ? 'klassisch' : slot ? slot.name : arch.role));
        chip.setAttribute('role', 'listitem');
        chip.title = text;
        chip.style.setProperty('--role', arch.color);
        chip.style.setProperty('--role-text', readableOnDark(arch.color));
        const look = weaponLook(arch);
        if (look) chip.style.setProperty('--weapon', look.accent);
        const tell = () => {
          info.textContent = '';
          info.append(el('b', '', weaponLine(arch)), ' – ' + arch.summary);
        };
        chip.addEventListener('pointerenter', tell);
        chip.addEventListener('focus', tell);
        chip.addEventListener('click', tell);
        chip.addEventListener('pointerleave', () => {
          info.textContent = defaultInfo;
        });
        row.append(chip);
      });
      const air = loadoutWeapons(content, plan.ids).filter(hitsFliers).length;
      defaultInfo = plan.mode === 'classic'
        ? 'Die sechs ursprünglichen Waffen – so, wie die Anleitung sie beschreibt.'
        : `Für jeden Platz eine zufällige Waffe; ${air === 1 ? 'eine trifft' : `${air} treffen`} Flieger. Zeig auf eine Waffe für mehr.`;
      info.textContent = defaultInfo;
    }
    show(act.loadoutPlan());
    return el('section', 'zw-loadout-box',
      el('div', 'zw-loadout-head', el('h3', 'zw-h3', 'Waffen dieser Partie'), seg, redraw),
      row, info);
  }

  function renderHelp() {
    const roles = el('ul', 'zw-help-list');
    for (const slot of contentSlots(deps.content)) {
      const mark = el('span', 'zw-help-mark', icon(slot.icon));
      mark.style.setProperty('--role', slot.color);
      mark.style.setProperty('--role-text', readableOnDark(slot.color));
      roles.append(el('li', '', mark, el('div', '', el('b', '', slot.name), el('span', '', ' – ' + slot.summary))));
    }
    const traits = el('ul', 'zw-help-list zw-help-traits');
    for (const t of TRAIT_DEFS) {
      traits.append(el('li', '', el('span', 'zw-help-mark zw-trait zw-trait-' + t.id, icon(t.id)), el('div', '', el('b', '', t.name), el('span', '', ' – ' + t.text))));
    }
    const keys = el('ul', 'zw-help-keys');
    for (const k of KEY_HELP) {
      const row = el('li', '', el('span', 'zw-help-keycaps', ...k.keys.map((key) => (key === '–' ? el('span', '', '–') : kbd(key)))), el('span', '', k.text));
      keys.append(row);
    }
    const steps = el('ol', 'zw-help-steps',
      el('li', '', el('span', 'zw-help-mark', icon('coin')), el('div', '', el('b', '', 'Bauen'), el('span', '', ' – Wähle unten eine Turmkarte und klicke auf ein freies Feld neben dem Weg.'))),
      el('li', '', el('span', 'zw-help-mark', icon('upgrade')), el('div', '', el('b', '', 'Ausbauen'), el('span', '', ' – Klicke einen Turm an. Jede der drei Stufen macht ihn stärker, die dritte bringt eine Besonderheit.'))),
      el('li', '', el('span', 'zw-help-mark', icon('modernize')), el('div', '', el('b', '', 'Modernisieren'), el('span', '', ' – Nach jeder Zeitenwende bleiben deine Türme stehen, sind aber veraltet. Ein Klick holt sie in die neue Zeit; Stufe und Zielwahl bleiben.'))),
      el('li', '', el('span', 'zw-help-mark', icon('bell')), el('div', '', el('b', '', 'Zeitglocke'), el('span', '', ' – Dein Notknopf: wirft alle Gegner ein Stück zurück und bremst sie kurz.'))));
    panel.append(el('div', 'zw-sub zw-glass zw-sub-wide', subHead('Anleitung'),
      el('div', 'zw-sub-body zw-help',
        el('section', 'zw-help-goal', el('h3', 'zw-h3', 'Das Ziel'),
          el('p', '', 'Bewache die Flamme. Feuerdiebe ziehen den Weg entlang, und jeder, der sie erreicht, stiehlt Funken. Sind alle Funken fort, verlischt die Flamme. Halte durch – einen Tag lang, durch sechs Zeitalter.')),
        el('section', '', el('h3', 'zw-h3', 'So geht’s'), steps),
        el('section', '', el('h3', 'zw-h3', 'Die sechs Plätze'), el('p', 'zw-help-note', 'Jede Partie zieht für jeden Platz eine Waffe: Die Aufgabe bleibt, die Art wechselt. „Klassisch“ spielt mit den sechs ursprünglichen.'), roles),
        el('section', '', el('h3', 'zw-h3', 'Eigenschaften der Gegner'), traits),
        el('section', 'zw-help-keysbox', el('h3', 'zw-h3', 'Tasten'), keys))));
  }

  function renderSettings() {
    const s = settings();
    const act = deps.actions;
    /** @type {{ id: Quality | 'auto', label: string }[]} */
    const qualities = [{ id: 'auto', label: 'Automatisch' }, { id: 'low', label: 'Niedrig' }, { id: 'medium', label: 'Mittel' }, { id: 'high', label: 'Hoch' }];
    const seg = el('div', 'zw-seg zw-set-quality');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Grafik');
    const qButtons = qualities.map((q) => {
      const b = button('zw-seg-btn' + (s.quality === q.id ? ' zw-on' : ''), q.label, q.label);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', s.quality === q.id ? 'true' : 'false');
      b.addEventListener('click', () => {
        act.changeSettings({ quality: q.id });
        for (const other of qButtons) {
          other.classList.toggle('zw-on', other === b);
          other.setAttribute('aria-checked', other === b ? 'true' : 'false');
        }
      });
      seg.append(b);
      return b;
    });
    const hints = button('zw-btn', 'Hinweise erneut zeigen', icon('info'), 'Hinweise erneut zeigen');
    const hintNote = el('small', '', s.tutorialDone ? 'Die Einstiegshinweise sind abgeschlossen.' : 'Die Hinweise sind eingeschaltet.');
    hints.disabled = !s.tutorialDone;
    hints.addEventListener('click', () => {
      act.changeSettings({ tutorialDone: false });
      hints.disabled = true;
      hintNote.textContent = 'Die Hinweise erscheinen in der nächsten Partie wieder.';
    });
    panel.append(el('div', 'zw-sub zw-glass', subHead('Einstellungen'),
      el('div', 'zw-sub-body zw-settings',
        el('h3', 'zw-h3', 'Bild'),
        el('div', 'zw-set-row zw-set-row-wrap', el('div', 'zw-set-label', el('span', '', 'Grafik'), el('small', '', '„Automatisch“ richtet sich nach der Bildrate.')), seg),
        switchRow('Bildschirmwackeln', 'Sanftes Wackeln, wenn ein Boss fällt.', s.shake, (on) => act.changeSettings({ shake: on })),
        switchRow('Schwebende Zahlen', 'Schaden und Gold über den Köpfen einblenden.', s.floatingText, (on) => act.changeSettings({ floatingText: on })),
        el('h3', 'zw-h3', 'Ton'),
        sliderRow('Gesamt', s.masterVolume, (v) => act.changeSettings({ masterVolume: v })),
        sliderRow('Effekte', s.sfxVolume, (v) => act.changeSettings({ sfxVolume: v })),
        sliderRow('Musik', s.musicVolume, (v) => act.changeSettings({ musicVolume: v })),
        switchRow('Ton aus', '', s.muted, (on) => act.changeSettings({ muted: on })),
        el('h3', 'zw-h3', 'Spiel'),
        switchRow('Wellen automatisch starten', 'Die nächste Welle beginnt von selbst.', s.autoStart, (on) => act.changeSettings({ autoStart: on })),
        el('div', 'zw-set-row zw-set-row-wrap', el('div', 'zw-set-label', el('span', '', 'Einstieg'), hintNote), hints))));
  }

  /** @returns {string} Zähler „3 / 8 entdeckt“ */
  function bookCount() {
    const book = bookOf(deps);
    const all = allRecipes(deps.content);
    return `${all.filter((r) => book[r.recipe.id]).length} / ${all.length} entdeckt`;
  }

  /**
   * Das Rezeptbuch: alle Rezepte als Karten. Entdeckte mit Name, Formel, Wirkung und wie sie zuerst gefunden wurden;
   * unentdeckte als Schattenkarte mit Kernrolle, Fragezeichen und einer Rätselzeile. In einer laufenden Partie sind die dort
   * freigeschalteten Rezepte markiert.
   */
  function renderBook() {
    const content = deps.content;
    const book = bookOf(deps);
    const view = host.view();
    const open = view ? view.sim.state.recipes : [];
    const grid = el('div', 'zw-book');
    for (const { recipe, arch } of allRecipes(content)) {
      const entry = book[recipe.id];
      // Waffengebundene Rezepte: welche Waffen sie brauchen und ob die laufende Partie sie gezogen hat.
      const needs = recipeNeeds(content, recipe, view ? view.sim.loadout : null);
      const needLine = needs ? el('div', 'zw-bookcard-needs' + (needs.fits === false ? ' zw-off' : ''), icon(needs.fits === false ? 'lock' : 'fuse'),
        `Nur mit ${needs.names}` + (needs.fits === false ? ' – in dieser Partie nicht gezogen' : needs.fits ? ' – in dieser Partie gezogen' : '')) : null;
      const card = el('article', 'zw-bookcard' + (entry ? '' : ' zw-bookcard-unknown') + (needs && needs.fits === false ? ' zw-bookcard-off' : ''));
      card.style.setProperty('--role', arch.color);
      card.style.setProperty('--role-text', readableOnDark(arch.color));
      if (entry) {
        const ageName = entry.age >= 0 && content.ages[entry.age] ? ` (${content.ages[entry.age].name})` : '';
        const inGame = view && (!needs || needs.fits !== false) && (!recipe.locked || open.includes(recipe.id));
        card.append(
          el('div', 'zw-bookcard-head', recipeFormula(content, arch, recipe),
            inGame ? el('span', 'zw-bookcard-flag', icon('check'), view && recipe.locked ? 'in dieser Partie frei' : 'immer frei') : null),
          el('h3', 'zw-bookcard-name', recipe.name),
          el('div', 'zw-bookcard-mix', `${coreName(arch)} als Kern mit ${recipeParts(content, recipe)}`),
          ...(needLine ? [needLine] : []),
          el('p', 'zw-bookcard-text', recipe.coreText),
          el('div', 'zw-bookcard-foot', recipe.locked ? `Zuerst ${FIND_TEXT[entry.how]}${ageName}.` : 'Immer verfügbar, ohne Freischalten.'));
      } else {
        card.append(
          el('div', 'zw-bookcard-head', recipeFormula(content, arch, recipe, true)),
          el('h3', 'zw-bookcard-name', 'Unbekanntes Rezept'),
          el('div', 'zw-bookcard-mix', recipeRiddle(content, arch, recipe)),
          ...(needLine ? [needLine] : []),
          el('p', 'zw-bookcard-text', recipeWhere(content, recipe)));
      }
      grid.append(card);
    }
    panel.append(el('div', 'zw-sub zw-glass zw-sub-wide zw-booksub', subHead('Rezeptbuch'),
      el('div', 'zw-sub-body',
        el('p', 'zw-book-intro', el('b', 'zw-book-count', bookCount()), ' · Ein Rezept wirkt nur, wenn es in der laufenden Partie freigeschaltet ist: durch einen Bauplan oder einen Zwischenboss, der ohne Funkenverlust fällt. Das Buch merkt sich, was du schon kennst.'),
        grid)));
  }

  /**
   * Die in der laufenden Partie freigeschalteten Rezepte als Abschnitt (null ohne).
   * @param {GameView | null} view
   * @param {string} title
   * @returns {HTMLElement | null}
   */
  function recipeSection(view, title) {
    const list = view ? recipeList(view.content, view.sim.state.recipes, view.sim.state.age) : null;
    return list ? el('div', 'zw-boonsect', el('div', 'zw-boonsect-head', icon('recipe'), title), list) : null;
  }

  /**
   * Die Waffen der laufenden Partie als knappe Zeile (Pause und Ergebnis): je Platz ein Punkt in seiner Farbe und der Name.
   * @param {GameView | null} view
   * @returns {HTMLElement | null}
   */
  function loadoutLine(view) {
    if (!view) return null;
    const list = el('div', 'zw-loadout-line');
    for (const arch of loadoutWeapons(view.content, view.sim.loadout)) {
      const item = el('span', 'zw-loadout-chip', roleDot(arch), weaponName(arch));
      item.title = `${weaponLine(arch)} – ${arch.summary}`;
      list.append(item);
    }
    return el('div', 'zw-boonsect', el('div', 'zw-boonsect-head', icon('fuse'), 'Waffen dieser Partie'), list);
  }

  function renderPause() {
    const view = host.view();
    let sub = '';
    if (view) {
      const st = view.sim.state;
      const age = view.content.ages[st.age];
      sub = `${view.sim.map.name} · Welle ${Math.min(st.wave + 1, view.sim.totalWaves)} / ${view.sim.totalWaves}${age ? ' · ' + age.name : ''}`;
    }
    const list = el('nav', 'zw-menu-list',
      menuButton('Weiter', 'play', () => goBack(), { primary: true, key: 'Esc' }),
      menuButton('Neu starten', 'auto', () => confirm('Die Partie neu beginnen? Der bisherige Fortschritt dieser Partie geht verloren.', 'Neu starten', () => deps.actions.restart())),
      menuButton('Einstellungen', 'gear', () => open('settings')),
      menuButton('Anleitung', 'book', () => open('help')),
      menuButton('Rezeptbuch', 'recipe', () => open('book'), { sub: bookCount() }),
      menuButton('Zum Hauptmenü', 'back', () => confirm('Zurück zum Hauptmenü? Dein Spielstand vom Beginn dieser Welle bleibt erhalten.', 'Zum Hauptmenü', () => deps.actions.quitToMenu())));
    const boons = view ? boonList(view.content, view.sim.state.boons) : null;
    panel.append(el('div', 'zw-main zw-pause zw-glass', el('header', 'zw-main-head', el('h2', 'zw-title zw-title-small', 'Pause'), sub ? el('p', 'zw-subtitle', sub) : null),
      loadoutLine(view),
      boons ? el('div', 'zw-boonsect', el('div', 'zw-boonsect-head', icon('gift'), 'Deine Zeitgaben'), boons) : null,
      recipeSection(view, 'Freigeschaltete Rezepte'), list));
  }

  /**
   * Die Zeitgaben der Partie auf dem Ergebnisbildschirm (null ohne Gaben).
   * @param {GameView | null} view
   * @returns {HTMLElement | null}
   */
  function resultBoons(view) {
    const list = view ? boonList(view.content, view.sim.state.boons) : null;
    return list ? el('div', 'zw-boonsect', el('div', 'zw-boonsect-head', icon('gift'), 'Zeitgaben dieser Partie'), list) : null;
  }

  function renderResult() {
    const info = resultInfo;
    if (!info) return;
    const view = host.view();
    const head = el('header', 'zw-result-head');
    if (info.won) {
      const lives = view ? view.sim.state.lives : 0;
      const stars = 1 + (lives >= 10 ? 1 : 0) + (lives >= 18 ? 1 : 0);
      const row = el('div', 'zw-stars');
      row.setAttribute('aria-label', `${stars} von 3 Sternen`);
      for (let i = 1; i <= 3; i++) row.append(icon(i <= stars ? 'starFull' : 'star', i <= stars ? 'zw-star-on' : ''));
      head.append(row, el('div', 'zw-result-kicker', 'Sieg'), el('h2', 'zw-title zw-title-small', 'Die Flamme brennt weiter'),
        el('p', 'zw-subtitle', `Du hast sie durch alle ${info.totalWaves} Wellen getragen – von der Steinzeit bis ins Zeitalter „${info.ageName}“.`));
    } else {
      head.append(el('span', 'zw-title-mark zw-title-mark-dim', icon('flame')), el('div', 'zw-result-kicker', 'Für heute ist Schluss'),
        el('h2', 'zw-title zw-title-small', 'Die Flamme ist erloschen'),
        el('p', 'zw-subtitle', `Du hast sie bis in die Welle ${info.wave} von ${info.totalWaves} getragen, ins Zeitalter „${info.ageName}“. Beim nächsten Mal brennt sie länger.`));
    }
    const score = el('div', 'zw-result-score', el('span', 'zw-result-score-n', num(info.score)), el('span', 'zw-result-score-l', 'Punkte'));
    const note = el('div', 'zw-result-record' + (info.newRecord ? ' zw-new' : ''));
    if (info.newRecord) note.append(icon('trophy'), 'Neuer Bestwert!');
    else if (info.best > 0) note.append(icon('trophy'), `Bestwert: ${num(info.best)}`);
    const s = info.stats;
    /** @type {[string, string, string][]} */
    const cells = [
      ['near', 'Besiegt', num(s.kills)],
      ['flame', 'Entwischt', num(s.leaks)],
      ['starFull', 'Makellos', num(s.perfectWaves) + (s.perfectWaves === 1 ? ' Welle' : ' Wellen')],
      ['wave', 'Welle', `${num(info.won ? info.totalWaves : info.wave)} / ${num(info.totalWaves)}`],
      // Zwölf Zellen passen ins Raster: Die Welle kam zurück, dafür entfiel „Ausgegeben“ (fast gleich „Verdient“);
      // Super- und Megawaffen teilen sich eine Zelle.
      ['coin', 'Gold verdient', num(s.goldEarned)],
      ['damage', 'Schaden', num(s.damageDealt)],
      ['schuetze', 'Türme gebaut', num(s.towersBuilt)],
      ['upgrade', 'Ausbauten', num(s.upgrades)],
      ['modernize', 'Modernisiert', num(s.modernizations)],
      ['bell', 'Zeitglocke', num(s.abilitiesUsed) + '×'],
      ['clock', 'Spielzeit', clockTime(info.time)],
      ['fuse', 'Super / Mega', `${num(s.fusions ?? 0)} / ${num(s.megas ?? 0)}`],
    ];
    const grid = el('dl', 'zw-result-grid');
    for (const [ic, label, value] of cells) grid.append(el('div', 'zw-result-cell', icon(ic), el('dt', '', label), el('dd', '', value)));
    const again = button('zw-btn zw-primary', 'Noch einmal', icon('auto'), 'Noch einmal');
    again.addEventListener('click', () => deps.actions.restart());
    const menu = button('zw-btn', 'Hauptmenü', 'Hauptmenü');
    menu.addEventListener('click', () => deps.actions.quitToMenu());
    panel.append(el('div', 'zw-sub zw-glass zw-result' + (info.won ? ' zw-won' : ' zw-lost'), head,
      el('div', 'zw-result-top', score, note), grid, loadoutLine(view), resultBoons(view), recipeSection(view, 'Rezepte dieser Partie'), el('footer', 'zw-sub-foot zw-result-foot', menu, again)));
  }

  function render() {
    panel.textContent = '';
    dialogBox.hidden = true;
    dialogCancel = null;
    const screen = stack[stack.length - 1];
    root.hidden = !screen;
    if (!screen) return;
    root.dataset.screen = screen;
    root.dataset.base = stack[0];
    switch (screen) {
      case 'main': renderMain(); break;
      case 'maps': renderMaps(); break;
      case 'help': renderHelp(); break;
      case 'settings': renderSettings(); break;
      case 'book': renderBook(); break;
      case 'pause': renderPause(); break;
      case 'result': renderResult(); break;
      default: break;
    }
    // Nur wer mit der Tastatur unterwegs ist, bekommt den Fokus gesetzt; sonst stünde ein Fokusrahmen im Bild.
    const first = /** @type {HTMLElement | null} */ (panel.querySelector('.zw-primary') || panel.querySelector('button'));
    if (first && keyboard) first.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  /** @param {Screen} screen */
  function open(screen) {
    stack.push(screen);
    render();
  }

  function goBack() {
    if (dialogCancel) {
      dialogCancel();
      return;
    }
    if (stack.length > 1) {
      stack.pop();
      render();
    } else if (stack[0] === 'pause') {
      stack = [];
      render();
      host.resume();
    }
  }

  return {
    root,
    showMain(info) {
      menuInfo = info;
      if (info.save) {
        chosenMap = info.save.mapId;
        chosenDifficulty = info.save.difficulty;
      }
      stack = ['main'];
      render();
    },
    showPause(visible) {
      if (visible) {
        if (stack[0] === 'pause') return;
        stack = ['pause'];
        render();
      } else if (stack[0] === 'pause') {
        stack = [];
        render();
      }
    },
    showResult(info) {
      resultInfo = info;
      stack = ['result'];
      render();
    },
    hide() {
      stack = [];
      render();
    },
    isOpen: () => stack.length > 0,
    key(event) {
      if (event.key === 'Escape') {
        goBack();
        return true;
      }
      if ((event.key === 'p' || event.key === 'P') && stack.length === 1 && stack[0] === 'pause' && !dialogCancel) {
        goBack();
        return true;
      }
      return false;
    },
  };
}
