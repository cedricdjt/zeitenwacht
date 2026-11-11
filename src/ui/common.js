// @ts-check
// Gemeinsame Bausteine der Spielanzeige: Vorschaubilder, Preisschild, Tastenkürzel, Kennzahlenliste, Hinweiskarten.

import { el, readableOnDark, retrigger } from './dom.js';
import { icon, iconSvg, roleIconName } from './icons.js';
import { statRows } from './stats.js';
import { num } from './texts.js';
import { counterArchetypes, enemyTraits } from './traits.js';

/** @import { Content, EnemyDef, TowerArchetypeDef, TowerStats } from '../types/content' */
/** @import { GameView, UiDeps } from '../types/app' */
/** @import { SimState } from '../types/sim' */
/** @import { FusionPick, GameActions } from '../game/fusion.js' */
/** @import { Tooltip } from './tooltip.js' */

/**
 * Was alle Teile der Spielanzeige brauchen.
 * @typedef {object} HudCtx
 * @property {UiDeps} deps
 * @property {Content} content
 * @property {Tooltip} tip
 * @property {(modelId: string, level?: number, size?: number, look?: { accent: string, marker: string, role?: string } | null) => string} thumb Vorschaubild als
 *   Daten-URL (mit `look` samt Erkennungszeichen einer Waffe des Pools); leer, wenn keins zu bekommen ist
 * @property {() => readonly string[] | null} [loadout] Bewaffnung der laufenden Partie (null im Menü)
 * @property {(text: string, kind?: 'info' | 'warn' | 'good') => void} toast
 */

/**
 * Laufende Zutatenwahl für eine Superwaffe (hängt die Spielsteuerung als `fusion` an den GameView) oder null.
 * @param {GameView} view
 * @returns {FusionPick | null}
 */
export function fusionOf(view) {
  return /** @type {GameView & { fusion?: FusionPick | null }} */ (view).fusion ?? null;
}

/**
 * Die Wünsche an die Spielsteuerung samt denen für Ausbauzweige und Superwaffen.
 * @param {UiDeps} deps
 * @returns {GameActions}
 */
export function actionsOf(deps) {
  return /** @type {GameActions} */ (deps.actions);
}

/**
 * Prüfzahl über alles an den Türmen, was die Möglichkeiten zum Verschmelzen ändert (Bestand, Stufe, Technikstand, Superwaffe, Zahl der Zeitgaben).
 * Ändert sie sich nicht, müssen Kandidatenlisten nicht neu bestimmt werden. Ohne Speicheranforderung, für jedes Bild geeignet.
 * @param {SimState} st
 * @returns {number}
 */
export function towerSignature(st) {
  // Die Zahl der Zeitgaben zählt mit: Eine Gabe kann die Höchstzahl der Megawaffen anheben.
  let h = st.towers.length + (st.phase === 'won' || st.phase === 'lost' ? 7 : 0) + st.boons.length * 131;
  for (let i = 0; i < st.towers.length; i++) {
    const t = st.towers[i];
    h = (Math.imul(h, 31) + t.id * 64 + t.tier * 8 + t.level * 2 + (t.super ? 1 : 0) + (t.mega ? 37 : 0)) | 0;
  }
  return h;
}

/**
 * Name und Wirkung der Gabe, die ein Turm dieser Rolle mit diesem Zweig als Zutat beisteuert
 * (`arch.branches[branch].gift`, sonst `arch.fusion.giftName`/`giftText`); null, wenn die Rolle nicht verschmelzen kann.
 * @param {TowerArchetypeDef} arch
 * @param {number} branch Zweig der Zutat (-1 = keiner)
 * @returns {{ name: string, text: string } | null}
 */
export function giftOf(arch, branch) {
  const chosen = arch.branches && branch >= 0 ? arch.branches[branch] : undefined;
  if (chosen && chosen.gift) return { name: chosen.gift.name, text: chosen.gift.text };
  return arch.fusion ? { name: arch.fusion.giftName, text: arch.fusion.giftText } : null;
}

/**
 * Wie viele Megawaffen gerade stehen.
 * @param {SimState} st
 * @returns {number}
 */
export function megaCount(st) {
  let n = 0;
  for (let i = 0; i < st.towers.length; i++) if (st.towers[i].mega) n += 1;
  return n;
}

/** @type {WeakMap<Content, Set<EnemyDef>>} */
const midBossCache = new WeakMap();

/**
 * Ob ein Boss ein Zwischenboss ist. Erkannt an den Wellendaten: Ein Zwischenboss tritt auch in einer Welle auf, die nicht die
 * letzte ihres Zeitalters ist (Welle 5; in Welle 10 läuft er im Gefolge mit); der Endboss erscheint nur in der letzten Welle.
 * @param {Content} content
 * @param {EnemyDef} def
 * @returns {boolean}
 */
export function isMidBoss(content, def) {
  if (!def.boss) return false;
  let set = midBossCache.get(content);
  if (!set) {
    set = new Set();
    for (const waves of content.waves) {
      for (let w = 0; w < waves.length - 1; w++) {
        for (const g of waves[w].groups) {
          const d = content.enemies[g.enemy];
          if (d && d.boss) set.add(d);
        }
      }
    }
    midBossCache.set(content, set);
  }
  return set.has(def);
}

/**
 * Bezeichnung eines Bosses: „Zwischenboss“ oder „Boss“.
 * @param {Content} content
 * @param {EnemyDef} def
 * @returns {string}
 */
export function bossLabel(content, def) {
  return isMidBoss(content, def) ? 'Zwischenboss' : 'Boss';
}

/**
 * Symbol in der Farbe einer Rolle (für Gaben und Zutaten).
 * @param {TowerArchetypeDef} arch
 * @param {string} [className]
 * @returns {HTMLElement}
 */
export function roleDot(arch, className) {
  const dot = el('span', 'zw-roledot' + (className ? ' ' + className : ''), icon(roleIconName(arch)));
  dot.style.setProperty('--role', arch.color);
  dot.style.setProperty('--role-text', readableOnDark(arch.color));
  return dot;
}

/**
 * Sichere Hülle um `deps.thumbnail`: Fehler (kein WebGL, unbekanntes Modell) ergeben ein leeres Bild statt eines Abbruchs.
 * @param {UiDeps} deps
 * @returns {(modelId: string, level?: number, size?: number, look?: { accent: string, marker: string, role?: string } | null) => string}
 */
export function makeThumb(deps) {
  let warned = false;
  return (modelId, level = 1, size = 128, look = null) => {
    try {
      // `look` ist nicht Teil des Vertrags `UiDeps.thumbnail`; die Spielsteuerung reicht die Angaben unverändert an die Bühne durch.
      const opts = look ? { size, level, look } : { size, level };
      return deps.thumbnail(modelId, /** @type {{ size: number, level: number }} */ (opts)) || '';
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('Vorschaubild nicht verfügbar:', error);
      }
      return '';
    }
  };
}

/**
 * Bild-Element für ein Vorschaubild.
 * @param {HudCtx} ctx
 * @param {string} modelId
 * @param {string} className
 * @param {number} [level]
 * @param {{ accent: string, marker: string, role?: string } | null} [look] Erkennungszeichen einer Waffe des Pools
 * @returns {HTMLImageElement}
 */
export function thumbImg(ctx, modelId, className, level = 1, look = null) {
  const img = el('img', className);
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  const src = ctx.thumb(modelId, level, 128, look);
  if (src) img.src = src;
  else img.classList.add('zw-noimg');
  return img;
}

/**
 * Preisschild: Münze und Betrag.
 * @param {number | string} amount
 * @param {string} [className]
 * @returns {HTMLSpanElement}
 */
export function price(amount, className) {
  const value = el('span', 'zw-price-n', typeof amount === 'number' ? num(amount) : amount);
  return el('span', 'zw-price' + (className ? ' ' + className : ''), icon('coin'), value);
}

/**
 * Tastenkürzel als kleine Taste.
 * @param {string} key
 * @returns {HTMLElement}
 */
export function kbd(key) {
  const node = el('kbd', 'zw-kbd', key);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/**
 * Liste der Kennzahlen eines Turms.
 * @param {TowerStats} stats
 * @param {TowerStats | null} [next]
 * @param {import('./stats.js').StatNames} [names]
 * @returns {HTMLElement}
 */
export function statList(stats, next, names) {
  const list = el('dl', 'zw-stats');
  for (const row of statRows(stats, next, names)) {
    const dt = el('dt', '', icon(row.icon), row.label);
    const dd = el('dd', '', el('span', row.next ? 'zw-old' : '', row.value));
    if (row.next) dd.append(el('span', 'zw-arrow', '→'), el('span', row.dir < 0 ? 'zw-down' : 'zw-up', row.next));
    list.append(dt, dd);
  }
  return list;
}

/**
 * Symbole „trifft Boden“ / „trifft Flieger“.
 * @param {TowerStats} stats
 * @returns {HTMLElement | null}
 */
export function reachBadges(stats) {
  if (stats.attack === 'none') return null;
  const ground = el('span', 'zw-reach' + (stats.hitsGround ? '' : ' zw-off'), icon('ground'), stats.hitsGround ? 'trifft Boden' : 'trifft keine Bodengegner');
  const air = el('span', 'zw-reach' + (stats.hitsAir ? '' : ' zw-off'), icon('air'), stats.hitsAir ? 'trifft Flieger' : 'trifft keine Flieger');
  return el('div', 'zw-reaches', ground, air);
}

/**
 * Rollenmarke: farbiges Symbol und Name der Rolle.
 * @param {TowerArchetypeDef} arch
 * @param {boolean} [asSlot] Immer den Namen des Platzes zeigen
 * @returns {HTMLElement}
 */
export function roleTag(arch, asSlot = false) {
  // Waffen des Pools tragen ihren eigenen Namen (in der Farbe ihres Platzes); klassische (und mit `asSlot` alle) den der Aufgabe.
  const tag = el('span', 'zw-role', icon(roleIconName(arch)), !asSlot && arch.slot && arch.slot !== arch.id && arch.name ? arch.name : arch.role);
  if (arch.slot && arch.slot !== arch.id) tag.title = `${arch.name ?? arch.role} · ${arch.role}-Platz`;
  tag.style.setProperty('--role', arch.color);
  tag.style.setProperty('--role-text', readableOnDark(arch.color));
  return tag;
}

/**
 * Markup der Eigenschafts-Symbole eines Gegners.
 * @param {Content} content
 * @param {EnemyDef} def
 * @returns {HTMLElement | null}
 */
export function traitIcons(content, def) {
  const traits = enemyTraits(content, def);
  if (traits.length === 0) return null;
  const row = el('span', 'zw-traits');
  row.innerHTML = traits.map((t) => `<span class="zw-trait zw-trait-${t.id}">${iconSvg(t.id)}</span>`).join('');
  return row;
}

/**
 * Hinweiskarte zu einem Gegner: Name, Beschreibung, Eigenschaften in Worten und die Rollen, die helfen.
 * @param {HudCtx} ctx
 * @param {EnemyDef} def
 * @param {number} [count] Anzahl in der Welle
 * @returns {HTMLElement}
 */
export function enemyTip(ctx, def, count) {
  const card = el('div', 'zw-tipcard');
  const head = el('div', 'zw-tip-head', thumbImg(ctx, def.model, 'zw-tip-thumb'),
    el('div', '', el('div', 'zw-tip-title', def.name), el('div', 'zw-tip-sub', count ? `${num(count)} in dieser Welle` : def.boss ? bossLabel(ctx.content, def) : 'Gegner')));
  card.append(head);
  if (def.description) card.append(el('p', 'zw-tip-text', def.description));
  const traits = enemyTraits(ctx.content, def);
  if (traits.length > 0) {
    const list = el('ul', 'zw-tip-traits');
    for (const t of traits) {
      const item = el('li', 'zw-trait-' + t.id, icon(t.id), el('span', '', el('b', '', t.name), ' – ' + t.text));
      list.append(item);
    }
    card.append(list);
  }
  const counters = counterArchetypes(ctx.content, def, ctx.loadout ? ctx.loadout() : null);
  if (counters.length > 0) {
    const row = el('div', 'zw-tip-counters', el('span', 'zw-tip-label', 'Hilft dagegen'));
    for (const arch of counters) row.append(roleTag(arch));
    card.append(row);
  }
  return card;
}

/**
 * Kurze Meldungen in einem Behälter: höchstens drei zugleich, gleiche Texte kurz hintereinander werden nicht gestapelt.
 * @param {HTMLElement} container
 * @returns {(text: string, kind?: 'info' | 'warn' | 'good') => void}
 */
export function createToaster(container) {
  /** @type {{ text: string, time: number, node: HTMLElement } | null} */
  let last = null;
  return (text, kind = 'info') => {
    const now = performance.now();
    if (last && last.text === text && now - last.time < 1600 && last.node.isConnected) {
      retrigger(last.node, 'zw-nudge');
      return;
    }
    while (container.childElementCount >= 3 && container.firstElementChild) container.firstElementChild.remove();
    const node = el('div', `zw-toast zw-toast-${kind}`, icon(kind === 'good' ? 'check' : 'info'), text);
    container.append(node);
    last = { text, time: now, node };
    window.setTimeout(() => node.classList.add('zw-out'), 2200);
    window.setTimeout(() => node.remove(), 2600);
  };
}
