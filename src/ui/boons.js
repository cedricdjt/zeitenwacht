// @ts-check
// Zeitgaben und Wellen mit Eigenart in der Oberfläche: die Wahl der Zeitgabe nach dem Boss eines Zeitalters (drei Karten unten
// in der Mitte, einklappbar, damit die Insel zu sehen bleibt), die kleinen Marken der gewählten Gaben, Schlagwort und Farbe einer
// Gabe aus ihrer Wirkung, die Kurzzeile einer Eigenart aus ihren Faktoren und die Frage, welche Gabe oder Eigenart die Zahlen
// eines Turms gerade verändert.

import { recipeById, towerStats } from '../sim/rules.js';
import { button, el, setVisible } from './dom.js';
import { icon, roleIconName } from './icons.js';
import { kbd } from './common.js';
import { statNames, statRows } from './stats.js';
import { num1 } from './texts.js';
import { bookOf, recipeFormula } from './recipes.js';

/** @import { GameView } from '../types/app' */
/** @import { BoonDef, Content, EnemyFactors, WaveModifierDef } from '../types/content' */
/** @import { Tower } from '../types/sim' */
/** @import { HudCtx } from './common.js' */

/** Farben der Schlagworte (ruhig, auf dunklem Glas gut lesbar). */
const TAG_COLOR = {
  feuer: '#F0894A',
  bremsen: '#6CC3E6',
  super: '#C49CF0',
  rezept: '#E8B4D8',
  flieger: '#8FD3F4',
  bosse: '#E9C46A',
  plaetze: '#9CCB6B',
  glocke: '#F2D27A',
  funken: '#F2795B',
  geld: '#F2C230',
};

/**
 * Schlagwort einer Zeitgabe, abgeleitet aus ihrer Wirkung: worum es bei ihr geht (Feuer, Superwaffen, Wirtschaft ...).
 * @param {Content} content
 * @param {BoonDef} def
 * @returns {{ label: string, icon: string, color: string }}
 */
export function boonTag(content, def) {
  const e = def.effect;
  const r = e.rules || {};
  const towers = e.towers || [];
  /** @type {(label: string, iconName: string, color: string) => { label: string, icon: string, color: string }} */
  const tag = (label, iconName, color) => ({ label, icon: iconName, color: typeof def.color === 'string' ? def.color : color });
  if (e.recipe) return tag('Rezept', 'recipe', TAG_COLOR.rezept);
  if (r.airDamage) return tag('Flieger', 'air', TAG_COLOR.flieger);
  if (r.bossDamage) return tag('Bosse', 'boss', TAG_COLOR.bosse);
  if (r.burnSpread || r.burnOnSlowed) return tag('Feuer', 'flame', TAG_COLOR.feuer);
  if (r.megaLimit || (e.economy && e.economy.fuse) || towers.some((t) => t.super || t.recipe)) return tag('Superwaffen', 'fuse', TAG_COLOR.super);
  if (towers.some((t) => t.tiles)) return tag('Bauplätze', 'map', TAG_COLOR.plaetze);
  // Gaben für bestimmte Waffen des Pools tragen den Namen der Waffe in der Farbe ihres Platzes.
  const weapons = towers.flatMap((t) => t.weapons || []);
  if (weapons.length > 0) {
    const arch = content.archetypes.find((a) => a.id === weapons[0]);
    if (arch) return tag(arch.name || arch.role, roleIconName(arch), arch.color);
  }
  const roles = towers.flatMap((t) => t.roles || []);
  if (roles.length > 0) {
    if (roles[0] === 'brenner') return tag('Feuer', 'flame', TAG_COLOR.feuer);
    if (roles[0] === 'bremser') return tag('Bremsen', 'slow', TAG_COLOR.bremsen);
    const arch = content.archetypes.find((a) => a.id === roles[0]);
    if (arch) return tag(arch.role, roleIconName(arch), arch.color);
  }
  if (e.ability) return tag('Zeitglocke', 'bell', TAG_COLOR.glocke);
  if (e.grant && (e.grant.lives || 0) > 0) return tag('Funken', 'heart', TAG_COLOR.funken);
  if (e.grant && e.grant.gold) return tag('Gold', 'coin', TAG_COLOR.geld);
  return tag('Wirtschaft', 'coin', TAG_COLOR.geld);
}

/**
 * Zeitgabe nach Kennung (oder null).
 * @param {Content} content
 * @param {string} id
 * @returns {BoonDef | null}
 */
export function boonById(content, id) {
  return (content.boons || []).find((b) => b.id === id) || null;
}

/**
 * Tooltip einer Zeitgabe.
 * @param {Content} content
 * @param {BoonDef} def
 * @returns {HTMLElement}
 */
export function boonTip(content, def) {
  const tag = boonTag(content, def);
  return el('div', 'zw-tipcard', el('div', 'zw-tip-title', def.name), el('div', 'zw-tip-sub', `Zeitgabe · ${tag.label}`), el('p', 'zw-tip-text', tidy(def.text)));
}

/**
 * Kleine runde Marke einer Zeitgabe (Symbol in der Farbe ihres Schlagworts) mit Tooltip.
 * @param {HudCtx} ctx
 * @param {BoonDef} def
 * @param {string} [className]
 * @returns {HTMLElement}
 */
export function boonChip(ctx, def, className = 'zw-boonchip') {
  const tag = boonTag(ctx.content, def);
  const chip = el('span', className, icon(def.icon));
  chip.style.setProperty('--boon', tag.color);
  chip.tabIndex = 0;
  chip.setAttribute('aria-label', `Zeitgabe ${def.name}: ${def.text}`);
  ctx.tip.attach(chip, () => boonTip(ctx.content, def), { tap: true });
  return chip;
}

/**
 * Text aus den Daten für schmale Spalten: kein Umbruch zwischen Zahl und Prozentzeichen.
 * @param {string} text
 * @returns {string}
 */
export function tidy(text) {
  return text.replace(/ %/g, '\u202f%');
}

/**
 * Faktor als Änderung in Prozent („+20 %“, „−12 %“).
 * @param {number} f
 * @returns {string}
 */
function change(f) {
  return (f >= 1 ? '+' : '−') + Math.round(Math.abs(f - 1) * 100) + ' %';
}

/** @type {[keyof EnemyFactors, string][]} */
const ENEMY_LABELS = [['count', 'Anzahl'], ['hp', 'Lebenspunkte'], ['speed', 'Tempo'], ['armor', 'Rüstung'], ['shield', 'Schild'], ['bounty', 'Kopfgeld']];

/**
 * Teile der Kurzzeile zu Gegnerfaktoren.
 * @param {EnemyFactors | undefined} f
 * @returns {string[]}
 */
function factorParts(f) {
  /** @type {string[]} */
  const parts = [];
  if (!f) return parts;
  for (const [key, label] of ENEMY_LABELS) {
    const v = f[key];
    if (v === undefined || v === 1) continue;
    parts.push(key === 'count' ? `${label} ×${num1(v)}` : `${label} ${change(v)}`);
  }
  return parts;
}

/**
 * Kurzzeile einer Eigenart aus ihren Faktoren, z. B. „Reichweite −12 % · Wellenprämie ×1,5“.
 * @param {WaveModifierDef} def
 * @returns {string}
 */
export function modifierLine(def) {
  /** @type {string[]} */
  const parts = [];
  const mul = def.towers && def.towers.mul ? def.towers.mul : null;
  if (mul) {
    if (mul.range !== undefined && mul.range !== 1) parts.push(`Reichweite ${change(mul.range)}`);
    if (mul.damage !== undefined && mul.damage !== 1) parts.push(`Schaden ${change(mul.damage)}`);
    if (mul.cooldown !== undefined && mul.cooldown !== 1) parts.push(`Pause ${change(mul.cooldown)}`);
  }
  parts.push(...factorParts(def.enemy));
  const air = factorParts(def.air);
  if (air.length > 0) parts.push('Flieger: ' + air.join(', '));
  if (def.bonus !== undefined && def.bonus !== 1) parts.push(`Wellenprämie ×${num1(def.bonus)}`);
  return parts.join(' · ');
}

/**
 * Tooltip einer Eigenart.
 * @param {WaveModifierDef} def
 * @param {string} sub
 * @returns {HTMLElement}
 */
export function modifierTip(def, sub) {
  return el('div', 'zw-tipcard', el('div', 'zw-tip-title', def.name), el('div', 'zw-tip-sub', sub), el('p', 'zw-tip-text', tidy(def.text)));
}

/**
 * Farbe einer Eigenart als CSS-Wert.
 * @param {WaveModifierDef} def
 * @returns {string}
 */
export function modifierColor(def) {
  return typeof def.color === 'string' ? def.color : '#' + Number(def.color).toString(16).padStart(6, '0');
}

/**
 * Bezeichnungen der Kennzahlen, deren Anzeige sich mit diesen Optionen gegenüber den Werten des Turms unterscheidet.
 * @param {Content} content
 * @param {Tower} t
 * @param {string[]} boons
 * @param {string} modifier
 * @returns {string[]}
 */
function changedRows(content, t, boons, modifier) {
  const without = towerStats(content, t.arch, t.tier, t.level, {
    branch: t.branch, super: t.super, mega: t.mega, gifts: t.gifts, giftBranches: t.giftBranches, recipe: t.recipe, tile: t.tile, boons, modifier,
  });
  /** @type {Map<string, string>} */
  const before = new Map();
  for (const r of statRows(without, null, statNames(t.arch, t.gifts, content))) before.set(r.label, r.value);
  /** @type {string[]} */
  const labels = [];
  for (const r of statRows(t.stats, null, statNames(t.arch, t.gifts, content))) if (before.get(r.label) !== r.value) labels.push(r.label);
  if (without.hitsAir !== t.stats.hitsAir) labels.push('Flieger');
  return labels;
}

/**
 * Welche Zeitgaben und welche Eigenart der Welle die angezeigten Zahlen dieses Turms verändern, und an welchen Zeilen.
 * @param {Content} content
 * @param {Tower} t
 * @returns {{ boons: { def: BoonDef, labels: string[] }[], modifier: { def: WaveModifierDef, labels: string[] } | null }}
 */
export function statSources(content, t) {
  /** @type {{ def: BoonDef, labels: string[] }[]} */
  const boons = [];
  for (const id of t.boons) {
    const def = boonById(content, id);
    if (!def || !def.effect.towers) continue;
    const labels = changedRows(content, t, t.boons.filter((b) => b !== id), t.modifier);
    if (labels.length > 0) boons.push({ def, labels });
  }
  let modifier = null;
  const mod = t.modifier && content.modifiers ? content.modifiers[t.modifier] : undefined;
  if (mod && mod.towers) {
    const labels = changedRows(content, t, t.boons.slice(), '');
    if (labels.length > 0) modifier = { def: mod, labels };
  }
  return { boons, modifier };
}

/**
 * @typedef {object} BoonPick
 * @property {HTMLElement} root Blatt mit den drei Karten (liegt unten in der Mitte über der Bauleiste)
 * @property {HTMLElement} pill Eingeklappte Fassung: Knopf „Zeitgabe wählen“
 * @property {(v: GameView, blocked: boolean) => void} update Jedes Bild; `blocked` = gerade verdeckt (Karte der Zeitenwende)
 * @property {() => void} expand Aufklappen (etwa nach einem Klick auf den gesperrten Startknopf)
 * @property {(event: KeyboardEvent) => boolean} key Tasten 1 bis 3 und Esc, solange das Blatt offen ist
 * @property {boolean} open Angebot offen und Blatt aufgeklappt
 * @property {boolean} pending Angebot offen (auf- oder eingeklappt)
 */

/** Wie lange nach dem Erscheinen Klicks und Tasten noch nichts wählen (gegen versehentliches Wählen). */
const GUARD_MS = 450;

/**
 * Die Wahl der Zeitgabe.
 * @param {HudCtx} ctx
 * @param {{ choose: (id: string) => void, showAge: () => void }} host
 * @returns {BoonPick}
 */
export function createBoonPick(ctx, host) {
  const cards = el('div', 'zw-boonpick-cards');
  cards.setAttribute('role', 'group');
  cards.setAttribute('aria-label', 'Zeitgaben zur Wahl');
  const collapse = button('zw-btn zw-boonpick-fold', 'Einklappen und die Insel ansehen', icon('back'), el('span', '', 'Insel ansehen'));
  collapse.title = 'Einklappen und die Insel ansehen (Esc)';
  const ageLink = button('zw-boonpick-agelink', 'Was das neue Zeitalter bringt', icon('info'), el('span', '', 'Was kommt?'));
  const head = el('div', 'zw-boonpick-head',
    el('span', 'zw-boonpick-mark', icon('gift')),
    el('div', 'zw-boonpick-headtext', el('div', 'zw-boonpick-kicker', 'Zeitgabe · gilt bis zum Ende der Partie'), el('div', 'zw-boonpick-title', 'Wähle eine Gabe')),
    ageLink, collapse);
  const foot = el('div', 'zw-boonpick-foot', 'Klicken oder Taste ', kbd('1'), '–', kbd('3'), ' · Die nächste Welle startet erst nach der Wahl.');
  const root = el('section', 'zw-boonpick zw-glass', head, cards, foot);
  root.setAttribute('aria-label', 'Zeitgabe wählen');
  root.hidden = true;
  const pillIcons = el('span', 'zw-boonpick-pillicons');
  const pill = button('zw-btn zw-boonpick-pill zw-glass', 'Zeitgabe wählen', icon('gift'), el('span', 'zw-boonpick-pilltext', 'Zeitgabe wählen'), pillIcons);
  pill.hidden = true;

  let offerKey = '';
  /** @type {string[]} */
  let offer = [];
  let collapsed = false;
  let shownAt = 0;
  let wasOpen = false;
  /** @type {HTMLButtonElement[]} */
  let buttons = [];

  collapse.addEventListener('click', () => {
    collapsed = true;
  });
  ageLink.addEventListener('click', () => host.showAge());
  pill.addEventListener('click', () => api.expand());

  /** @param {number} index */
  function choose(index) {
    if (performance.now() - shownAt < GUARD_MS) return;
    const id = offer[index];
    if (id) host.choose(id);
  }

  /**
   * Bauplan-Karte: Formel des Rezepts als Rollensymbole und was die Wahl freischaltet; steht das Rezept noch nicht im
   * Rezeptbuch, sagt die Karte, dass es neu ist (die Wahl ist ja gerade die Wahl dieses Wissens).
   * @param {GameView} v
   * @param {BoonDef} def
   * @returns {HTMLElement | null}
   */
  function recipeRow(v, def) {
    const id = def.effect.recipe;
    const found = id ? recipeById(v.content, id) : null;
    if (!found) return null;
    const known = !!bookOf(ctx.deps)[found.recipe.id];
    return el('span', 'zw-boon-formula', recipeFormula(v.content, found.arch, found.recipe),
      el('span', 'zw-boon-formula-text', 'Schaltet frei: ', el('b', '', found.recipe.name), known ? null : el('span', 'zw-boon-new', 'neu fürs Rezeptbuch')));
  }

  /** @param {GameView} v */
  function rebuild(v) {
    cards.textContent = '';
    pillIcons.textContent = '';
    buttons = [];
    offer.forEach((id, index) => {
      const def = boonById(v.content, id);
      if (!def) return;
      const tag = boonTag(v.content, def);
      const btn = button('zw-boon' + (def.effect.recipe ? ' zw-boon-recipe' : ''), `${def.name} wählen (Taste ${index + 1}): ${def.text}`,
        el('span', 'zw-boon-top', el('span', 'zw-boon-icon', icon(def.icon)), el('span', 'zw-boon-tag', icon(tag.icon), tag.label), kbd(String(index + 1))),
        el('span', 'zw-boon-name', def.name),
        recipeRow(v, def),
        el('span', 'zw-boon-text', tidy(def.text)));
      btn.style.setProperty('--boon', tag.color);
      btn.style.animationDelay = `${0.08 * index}s`;
      btn.addEventListener('click', () => choose(index));
      cards.append(btn);
      buttons.push(btn);
      const mini = el('span', 'zw-boonpick-pillicon', icon(def.icon));
      mini.style.setProperty('--boon', tag.color);
      pillIcons.append(mini);
    });
  }

  const api = {
    root,
    pill,
    open: false,
    pending: false,
    /** @param {GameView} v @param {boolean} blocked */
    update(v, blocked) {
      const st = v.sim.state;
      const key = st.phase === 'build' ? st.boonOffer.join(',') : '';
      if (key !== offerKey) {
        offerKey = key;
        offer = st.boonOffer.slice();
        collapsed = false;
        if (key) rebuild(v);
      }
      api.pending = key !== '';
      api.open = api.pending && !blocked && !collapsed;
      if (api.open && !wasOpen) shownAt = performance.now();
      wasOpen = api.open;
      setVisible(root, api.open);
      setVisible(pill, api.pending && !blocked && collapsed);
    },
    expand() {
      collapsed = false;
    },
    /** @param {KeyboardEvent} event */
    key(event) {
      if (!api.open) return false;
      const code = event.code;
      if (code.startsWith('Digit') || code.startsWith('Numpad')) {
        const n = parseInt(code.replace('Digit', '').replace('Numpad', ''), 10);
        if (n >= 1 && n <= buttons.length) {
          choose(n - 1);
          return true;
        }
        return true;
      }
      if (event.key === 'Escape') {
        collapsed = true;
        return true;
      }
      if (event.key === ' ') {
        ctx.toast('Erst eine Zeitgabe wählen', 'info');
        return true;
      }
      return false;
    },
  };
  return api;
}

/**
 * Marken der gewählten Zeitgaben (oben links unter den Vorräten). Neu gewählte leuchten kurz auf.
 * @param {HudCtx} ctx
 */
export function createBoonChips(ctx) {
  const root = el('div', 'zw-boonchips');
  root.setAttribute('aria-label', 'Zeitgaben');
  root.hidden = true;
  /** Angezeigte Kennungen; null = nach dem Binden noch nichts gezeigt (dann leuchtet nichts auf). @type {string | null} */
  let shown = null;
  let count = 0;
  return {
    root,
    /** @param {GameView} v */
    update(v) {
      const boons = v.sim.state.boons;
      const key = boons.join(',');
      if (key === shown) return;
      const grew = shown !== null && boons.length === count + 1;
      shown = key;
      count = boons.length;
      root.textContent = '';
      boons.forEach((id, index) => {
        const def = boonById(v.content, id);
        if (!def) return;
        const chip = boonChip(ctx, def);
        if (grew && index === boons.length - 1) chip.classList.add('zw-boonchip-new');
        root.append(chip);
      });
      setVisible(root, boons.length > 0);
    },
    /** Nach einem neuen Spiel oder Laden: ohne Aufleuchten neu aufbauen. */
    reset() {
      shown = null;
      count = 0;
    },
  };
}

/**
 * Gewählte Zeitgaben als kompakte Liste (Symbol, Name, Schlagwort; der Text als Hinweis beim Zeigen) für den Ergebnis- und
 * den Pausenbildschirm; null ohne Gaben.
 * @param {Content} content
 * @param {readonly string[]} boons
 * @returns {HTMLElement | null}
 */
export function boonList(content, boons) {
  if (boons.length === 0) return null;
  const list = el('ul', 'zw-boonlist');
  list.setAttribute('aria-label', 'Zeitgaben');
  for (const id of boons) {
    const def = boonById(content, id);
    if (!def) continue;
    const tag = boonTag(content, def);
    const mark = el('span', 'zw-boonchip', icon(def.icon));
    mark.style.setProperty('--boon', tag.color);
    const item = el('li', 'zw-boonlist-item', mark, el('span', 'zw-boonlist-text', el('b', '', def.name), el('span', 'zw-boonlist-tag', tag.label)));
    item.title = `${def.name}: ${def.text}`;
    list.append(item);
  }
  return list;
}
