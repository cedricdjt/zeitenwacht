// @ts-check
// Turmkarte: erscheint am Bildschirmrand, sobald ein Turm gewählt ist. Zeigt seine Werte, die Zielwahl und die Aktionen
// Ausbauen (auf Stufe 3 als Wahl zwischen zwei Zweigen), Modernisieren, Verschmelzen und Verkaufen, jeweils mit Preis und Taste.
// Während der Zutatenwahl für eine Superwaffe tritt an die Stelle der Aktionen das Verschmelzen-Blatt. Eine Superwaffe kann
// ein zweites Mal Zutaten aufnehmen und wird zur Megawaffe (höchstens `balance.fusion.megaLimit` zugleich).

import { fusionRecipe, lockedRecipe, megaLimit, recipeLook, tileDef, towerStats } from '../sim/rules.js';
import { button, el, readableOnDark, retrigger, setAttr, setClass, setText, setVisible } from './dom.js';
import { icon } from './icons.js';
import { actionsOf, fusionOf, giftOf, kbd, megaCount, price, reachBadges, roleDot, roleTag, statList, thumbImg, towerSignature } from './common.js';
import { boonTag, boonTip, modifierColor, modifierLine, modifierTip, statSources } from './boons.js';
import { attackChange, statNames, statRows } from './stats.js';
import { coreRecipes, weaponLine, weaponLook } from './loadout.js';
import { tileBadge, tileEffect } from './tiles.js';
import { num, num1, percent, TARGET_MODES } from './texts.js';
import { bookOf, discover, recipeFormula, recipeOpen, recipeParts } from './recipes.js';

/** @import { GameView } from '../types/app' */
/** @import { Content, TowerArchetypeDef, TowerStats } from '../types/content' */
/** @import { Tower } from '../types/sim' */
/** @import { FusionPick } from '../game/fusion.js' */
/** @import { HudCtx } from './common.js' */

/**
 * @typedef {object} TowerPanel
 * @property {HTMLElement} root
 * @property {HTMLButtonElement} modernizeButton
 * @property {HTMLButtonElement} fuseButton
 * @property {HTMLElement} branchBox Zweigwahl (für den einmaligen Hinweis)
 * @property {(view: GameView) => void} bind
 * @property {(view: GameView) => void} update
 * @property {(view: GameView) => void} cycleMode Taste T
 * @property {(view: GameView) => void} upgradeKey Taste U: ausbauen oder, vor Stufe 3, die Zweigwahl ansteuern
 * @property {(view: GameView) => void} fuseKey Taste V: Zutatenwahl öffnen
 * @property {(view: GameView) => boolean} confirmKey Eingabetaste: bestätigt das Verschmelzen; false, wenn nichts zu bestätigen war
 */

/**
 * Ein Aktionsknopf mit Symbol, Beschriftung, Unterzeile, Preis und Taste.
 * @param {string} className
 * @param {string} iconName
 * @param {string} label
 * @param {string} key
 */
function actionButton(className, iconName, label, key) {
  const sub = el('span', 'zw-act-sub');
  const priceTag = price('');
  const priceN = /** @type {HTMLElement} */ (priceTag.querySelector('.zw-price-n'));
  const labelEl = el('span', 'zw-act-label', label);
  const text = el('span', 'zw-act-text', labelEl, sub);
  const btn = button('zw-btn zw-act ' + className, label, icon(iconName), text, priceTag, kbd(key));
  return { btn, sub, priceTag, priceN, text, labelEl, lastCost: NaN, lastState: -1 };
}

/**
 * Name der Superwaffe (oder mit `mega` der Megawaffe), zu der ein Turm als Kern mit diesen Zutaten würde oder die er ist.
 * Ergeben Kern und Zutaten ein Rezept (etwa die Flak), gilt dessen Name.
 * @param {Content} content Inhalte der Partie (für die Rezepte nach Platz und Waffe)
 * @param {Tower} t
 * @param {boolean} [mega]
 * @param {readonly string[]} [gifts] Waffen der Zutaten; ohne Angabe die des Turms
 * @param {number} [tierIndex] Technikstand; ohne Angabe der des Turms
 * @param {readonly string[] | string} [unlocked] Freie Rezepte (Vorschau: `state.recipes`); ohne Angabe `t.recipe`
 * @returns {string}
 */
function superNameOf(content, t, mega, gifts, tierIndex, unlocked) {
  const index = tierIndex ?? t.tier;
  const tier = t.arch.tiers[index];
  if (!tier) return t.arch.role;
  const look = recipeLook(t.arch, index, gifts ?? t.gifts, unlocked ?? t.recipe, content);
  if (look) return mega ? look.megaName : look.superName;
  return (mega ? tier.megaName : '') || tier.superName || tier.name;
}

/**
 * Anzeigename eines Turms: Megawaffe, Superwaffe oder seine Ausprägung im Zeitalter.
 * @param {Content} content
 * @param {Tower} t
 * @returns {string}
 */
function towerName(content, t) {
  const tier = t.arch.tiers[t.tier];
  if (t.super) return superNameOf(content, t, t.mega);
  return tier ? tier.name : t.arch.role;
}

/**
 * @param {HudCtx} ctx
 * @returns {TowerPanel}
 */
export function createTowerPanel(ctx) {
  const act = actionsOf(ctx.deps);
  const head = el('div', 'zw-tower-head');
  const closeBtn = button('zw-iconbtn zw-tower-close', 'Turmkarte schließen', icon('close'));
  const statsBox = el('div', 'zw-tower-stats');
  const giftsBox = el('div', 'zw-gifts');
  const modeRow = el('div', 'zw-seg zw-tower-modes');
  modeRow.setAttribute('role', 'radiogroup');
  modeRow.setAttribute('aria-label', 'Zielwahl');
  const modeHead = el('div', 'zw-tower-label', 'Zielwahl', kbd('T'));
  const modeBox = el('div', 'zw-tower-modebox', modeHead, modeRow);
  const killsN = el('b', '');
  const damageN = el('b', '');
  const record = el('div', 'zw-tower-record', el('span', '', icon('near'), killsN, ' besiegt'), el('span', '', icon('damage'), damageN, ' Schaden'));

  // Zweigwahl beim Ausbau auf Stufe 3: zwei gleichrangige Knöpfe, der Preis steht einmal darüber.
  const branchPrice = price('');
  const branchPriceN = /** @type {HTMLElement} */ (branchPrice.querySelector('.zw-price-n'));
  const branchNote = el('span', 'zw-branch-note');
  const branchHead = el('div', 'zw-tower-label zw-branch-head', el('span', 'zw-branch-title', 'Stufe 3: Wähle einen Zweig'), kbd('U'), branchNote, branchPrice);
  const branchOpts = el('div', 'zw-branch-opts');
  const branchBox = el('div', 'zw-branch', branchHead, branchOpts);
  branchBox.hidden = true;
  /** @type {HTMLButtonElement[]} */
  let branchButtons = [];

  const up = actionButton('zw-act-up', 'upgrade', 'Ausbauen', 'U');
  const mod = actionButton('zw-act-mod', 'modernize', 'Modernisieren', 'M');
  const fuse = actionButton('zw-act-fuse', 'fuse', 'Verschmelzen', 'V');
  const sell = actionButton('zw-act-sell', 'sell', 'Verkaufen', 'X');
  const modImg = el('img', 'zw-act-img');
  modImg.alt = '';
  mod.btn.insertBefore(modImg, mod.text);
  const actions = el('div', 'zw-tower-actions', mod.btn, fuse.btn, up.btn, sell.btn);
  const normalBox = el('div', 'zw-tower-normal', modeBox, record, branchBox, actions);

  // Verschmelzen-Blatt: Ergebnis, Zutaten zum An- und Abwählen, Abbrechen und Bestätigen.
  const fuseName = el('div', 'zw-fuse-name');
  const fuseCore = el('p', 'zw-fuse-core');
  const fuseRecipe = el('div', 'zw-attack-change zw-fuse-recipe');
  fuseRecipe.hidden = true;
  const fuseCount = el('span', 'zw-fuse-count');
  const fuseList = el('div', 'zw-fuse-list');
  fuseList.setAttribute('role', 'group');
  fuseList.setAttribute('aria-label', 'Zutaten');
  const fuseGoPrice = price('');
  const fuseGoPriceN = /** @type {HTMLElement} */ (fuseGoPrice.querySelector('.zw-price-n'));
  const fuseGo = button('zw-btn zw-primary zw-fuse-go', 'Verschmelzen bestätigen (Eingabetaste)', el('span', 'zw-fuse-go-label', 'Verschmelzen'), fuseGoPrice, kbd('↵'));
  const fuseCancel = button('zw-btn zw-fuse-cancel', 'Abbrechen (Esc)', 'Abbrechen');
  fuseCancel.title = 'Abbrechen (Esc)';
  const fuseKicker = el('div', 'zw-fuse-kicker', 'Verschmelzen zur Superwaffe');
  const fuseNote = el('p', 'zw-fuse-note', 'Die Zutaten gehen im Kern auf, ihre Felder werden frei.');
  const fuseIcon = el('span', 'zw-fuse-icon', icon('fuse'));
  const fuseBox = el('div', 'zw-fuse',
    el('div', 'zw-fuse-head', fuseIcon, el('div', 'zw-fuse-headtext', fuseKicker, fuseName)),
    fuseCore,
    fuseRecipe,
    el('div', 'zw-tower-label zw-fuse-label', 'Neue Zutaten', fuseCount),
    fuseList,
    fuseNote,
    el('div', 'zw-fuse-foot', fuseCancel, fuseGo));
  fuseBox.hidden = true;

  const tileRow = el('div', 'zw-tower-tile');
  tileRow.hidden = true;
  const colA = el('div', 'zw-tower-col zw-tower-col-a', head, tileRow, statsBox, giftsBox);
  const colB = el('div', 'zw-tower-col zw-tower-col-b', normalBox, fuseBox);
  const root = el('section', 'zw-tower zw-glass', closeBtn, colA, colB);
  root.setAttribute('aria-label', 'Gewählter Turm');
  root.hidden = true;

  /** @type {{ btn: HTMLButtonElement, id: import('../types/content').TargetMode }[]} */
  const modeButtons = TARGET_MODES.map((m) => {
    const btn = button('zw-seg-btn', m.label, icon(m.icon), el('span', 'zw-seg-text', m.label));
    btn.setAttribute('role', 'radio');
    btn.title = m.hint;
    btn.addEventListener('click', () => {
      if (view && view.selected) act.setTargetMode(view.selected.id, m.id);
    });
    modeRow.append(btn);
    return { btn, id: m.id };
  });

  /** @type {GameView | null} */
  let view = null;
  /** @type {'none' | 'upgrade' | 'modernize' | 'fuse' | 'branch0' | 'branch1'} */
  let preview = 'none';
  let lastId = -1;
  let lastTier = -1;
  let lastLevel = -1;
  let lastAge = -1;
  let lastBranch = -2;
  /** Zeitgaben und Eigenart, mit denen die Karte zuletzt gebaut wurde. */
  let lastBoonKey = '';
  let lastSuper = false;
  let lastMega = false;
  let lastPreview = '';
  let lastBuff = -1;
  let lastKills = -1;
  let lastDamage = -1;
  let lastRefundFull = -1;
  let lastSig = NaN;
  /** @type {FusionPick | null} */
  let lastFusion = null;
  let lastBranchState = -1;
  let lastFuseState = '';
  let lastGoState = -1;
  /** Mögliche Zutaten für den gewählten Turm als Kern und Nachbarn, die nur am Technikstand scheitern. */
  /** @type {Tower[]} */
  let candidates = [];
  let offTier = 0;
  /** Name der Super- oder Megawaffe, die mit den möglichen Zutaten entstünde. */
  let fuseResult = '';
  /** Unterzeilen der Knöpfe im Normalfall; werden mit dem Kopf der Karte neu bestimmt. */
  let upOk = '';
  let modOk = '';

  closeBtn.addEventListener('click', () => act.selectTower(null));
  up.btn.addEventListener('click', () => {
    if (view && view.selected) act.upgrade(view.selected.id);
  });
  mod.btn.addEventListener('click', () => {
    if (view && view.selected) act.modernize(view.selected.id);
  });
  sell.btn.addEventListener('click', () => {
    if (view && view.selected) act.sell(view.selected.id);
  });
  fuse.btn.addEventListener('click', () => {
    if (view) openFusion(view);
  });
  fuseCancel.addEventListener('click', () => act.fuseCancel());
  fuseGo.addEventListener('click', () => {
    if (view) confirmFusion(view);
  });
  /**
   * Vorschau der neuen Werte, solange der Zeiger auf einem Knopf ruht oder er den Fokus hat.
   * @param {HTMLElement} btn
   * @param {'upgrade' | 'modernize' | 'fuse' | 'branch0' | 'branch1'} kind
   */
  function hoverPreview(btn, kind) {
    const on = () => {
      preview = kind;
    };
    const off = () => {
      if (preview === kind) preview = 'none';
    };
    btn.addEventListener('pointerenter', on);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('focus', on);
    btn.addEventListener('blur', off);
  }
  hoverPreview(up.btn, 'upgrade');
  hoverPreview(mod.btn, 'modernize');
  hoverPreview(fuse.btn, 'fuse');

  /**
   * Ob der Ausbau dieses Turms eine Zweigwahl verlangt.
   * @param {Tower} t
   * @returns {boolean}
   */
  function needsBranch(t) {
    return t.level === 2 && !!t.arch.branches && !t.super;
  }

  /**
   * Ob der Turm Kern einer Superwaffe (oder als Superwaffe Kern einer Megawaffe) werden könnte, ohne Blick auf Nachbarn,
   * Gold und die Höchstzahl der Megawaffen.
   * @param {Tower} t
   * @param {GameView} v
   * @returns {boolean}
   */
  function canBeCore(t, v) {
    const rule = v.content.balance.fusion;
    if (t.level < 3 || t.mega || !t.arch.fusion || !rule) return false;
    return !t.super || megaLimit(v.content, v.sim.state.boons) > 0;
  }

  /**
   * Ob die Höchstzahl der Megawaffen erreicht ist.
   * @param {GameView} v
   * @returns {boolean}
   */
  function megaFull(v) {
    return megaCount(v.sim.state) >= megaLimit(v.content, v.sim.state.boons);
  }

  /**
   * Warum sich gerade nicht verschmelzen lässt, in einer Zeile; leer, wenn es geht.
   * @param {Tower} t
   * @param {GameView} v
   * @returns {string}
   */
  function fuseBlocker(t, v) {
    const need = v.content.balance.fusion.parts;
    if (t.super && megaFull(v)) {
      const limit = megaLimit(v.content, v.sim.state.boons);
      return limit === 1 ? 'Nur eine Megawaffe zugleich' : `Höchstens ${limit} Megawaffen zugleich`;
    }
    if (candidates.length < need) {
      const missing = need - candidates.length;
      if (candidates.length + offTier >= need) return 'Nachbarn erst modernisieren (gleiches Zeitalter)';
      if (candidates.length === 0) return `Braucht ${need} Nachbartürme auf Stufe 3`;
      return missing === 1 ? 'Braucht noch 1 Nachbarturm auf Stufe 3' : `Braucht noch ${missing} Nachbartürme auf Stufe 3`;
    }
    const fee = v.sim.fuseCost(t);
    if (v.sim.state.gold < fee) return `zu wenig Gold, es fehlen ${num(fee - v.sim.state.gold)}`;
    return '';
  }

  /** @param {GameView} v */
  function openFusion(v) {
    const t = v.selected;
    if (!t || !canBeCore(t, v)) return;
    const blocker = fuseBlocker(t, v);
    if (blocker) {
      ctx.toast(blocker, 'info');
      return;
    }
    preview = 'none';
    act.fuseBegin(t.id);
  }

  /**
   * @param {GameView} v
   * @returns {boolean}
   */
  function confirmFusion(v) {
    const f = fusionOf(v);
    if (!f) return false;
    const need = v.content.balance.fusion.parts;
    if (f.picked.length < need) {
      const missing = need - f.picked.length;
      ctx.toast(missing === 1 ? 'Wähle noch 1 Zutat' : `Wähle noch ${missing} Zutaten`, 'info');
      retrigger(fuseList, 'zw-nudge');
      return true;
    }
    act.fuseConfirm();
    return true;
  }

  /**
   * Kandidaten für das Verschmelzen neu bestimmen (nur wenn sich am Turmbestand etwas geändert hat).
   * @param {Tower} t
   * @param {GameView} v
   */
  function refreshCandidates(t, v) {
    candidates = canBeCore(t, v) ? v.sim.fuseCandidates(t.id) : [];
    // Name des Ergebnisses: Mit genau so vielen Kandidaten, wie nötig, steht fest, ob sie ein Rezept ergeben.
    fuseResult = superNameOf(v.content, t, t.super, giftsWith(t, candidates.length === v.content.balance.fusion.parts ? candidates : []));
    offTier = 0;
    if (!canBeCore(t, v)) return;
    const towers = v.sim.state.towers;
    for (let i = 0; i < towers.length; i++) {
      const o = towers[i];
      if (o !== t && o.tier !== t.tier && o.level >= 3 && !o.super && o.arch.fusion && Math.abs(o.tx - t.tx) <= 1 && Math.abs(o.tz - t.tz) <= 1) offTier += 1;
    }
  }

  /**
   * Die Werte nach der Aktion, auf der der Zeiger ruht (oder nach dem Verschmelzen mit den gewählten Zutaten); null = kein Vergleich.
   * @param {Tower} t
   * @param {GameView} v
   * @returns {TowerStats | null}
   */
  function nextStats(t, v) {
    const st = v.sim.state;
    const f = fusionOf(v);
    if (f && f.coreId === t.id) return fusedStats(t, v, pickedTowers(f, v));
    if (preview === 'upgrade' && t.level < 3 && !needsBranch(t)) return towerStats(v.content, t.arch, t.tier, t.level + 1, t);
    if (preview === 'branch0' && needsBranch(t)) return towerStats(v.content, t.arch, t.tier, 3, { branch: 0, tile: t.tile, boons: t.boons, modifier: t.modifier });
    if (preview === 'branch1' && needsBranch(t)) return towerStats(v.content, t.arch, t.tier, 3, { branch: 1, tile: t.tile, boons: t.boons, modifier: t.modifier });
    if (preview === 'modernize' && t.tier < st.age && t.arch.tiers[st.age]) return towerStats(v.content, t.arch, st.age, t.level, t);
    if (preview === 'fuse' && canBeCore(t, v)) {
      const need = v.content.balance.fusion.parts;
      return fusedStats(t, v, candidates.length === need ? candidates : []);
    }
    return null;
  }

  /**
   * Die gewählten Zutaten in Reihenfolge der Wahl.
   * @param {FusionPick} f
   * @param {GameView} v
   * @returns {Tower[]}
   */
  function pickedTowers(f, v) {
    /** @type {Tower[]} */
    const parts = [];
    for (const id of f.picked) {
      const part = v.sim.towerById(id);
      if (part) parts.push(part);
    }
    return parts;
  }

  /**
   * Werte des Kerns nach dem Verschmelzen mit diesen Zutaten: Superwaffe, oder Megawaffe, wenn der Kern schon Superwaffe ist.
   * @param {Tower} t
   * @param {GameView} v
   * @param {Tower[]} parts
   * @returns {TowerStats}
   */
  function fusedStats(t, v, parts) {
    const gifts = giftsWith(t, parts);
    const giftBranches = t.super ? t.giftBranches.slice() : [];
    for (const p of parts) giftBranches.push(p.branch);
    // Ein Kern, der schon Superwaffe ist, behält sein Rezept; ein neuer bekommt, was in dieser Partie frei ist.
    return towerStats(v.content, t.arch, t.tier, t.level, {
      branch: t.branch, super: true, mega: t.super, gifts, giftBranches, tile: t.tile, boons: t.boons, modifier: t.modifier,
      recipe: t.super ? t.recipe : undefined, recipes: v.sim.state.recipes,
    });
  }

  /**
   * Rollen der Zutaten nach dem Verschmelzen mit diesen Teilen (bei einer Superwaffe ihre bisherigen davor).
   * @param {Tower} t
   * @param {Tower[]} parts
   * @returns {string[]}
   */
  function giftsWith(t, parts) {
    const gifts = t.super ? t.gifts.slice() : [];
    for (const p of parts) gifts.push(p.arch.id);
    return gifts;
  }

  /**
   * Eine Gabe: Symbol in der Farbe der Rolle, Name und Wirkung (die Gabe des Zweigs, mit dem die Zutat ausgebaut war).
   * @param {TowerArchetypeDef} arch
   * @param {number} branch
   * @returns {HTMLElement | null}
   */
  function giftRow(arch, branch) {
    const gift = giftOf(arch, branch);
    if (!gift) return null;
    return el('div', 'zw-gift', roleDot(arch), el('div', 'zw-gift-text', el('b', 'zw-gift-name', gift.name), el('span', 'zw-gift-desc', gift.text)));
  }

  /**
   * @param {Tower} t
   * @param {GameView} v
   */
  function rebuildHead(t, v) {
    const st = v.sim.state;
    const tier = t.arch.tiers[t.tier];
    const outdated = t.tier < st.age && !!t.arch.tiers[st.age];
    head.textContent = '';
    const pips = el('span', 'zw-pips');
    pips.setAttribute('aria-label', `Stufe ${t.level} von 3`);
    for (let i = 1; i <= 3; i++) pips.append(el('i', i <= t.level ? 'zw-pip zw-pip-on' : 'zw-pip'));
    const ageName = v.content.ages[t.tier] ? v.content.ages[t.tier].name : '';
    const badges = el('div', 'zw-tower-badges');
    if (t.mega) badges.append(el('span', 'zw-badge zw-badge-mega', icon('crown'), 'Megawaffe'));
    else if (t.super) badges.append(el('span', 'zw-badge zw-badge-super', icon('fuse'), 'Superwaffe'));
    const branch = t.level >= 3 && t.arch.branches && t.branch >= 0 ? t.arch.branches[t.branch] : null;
    if (branch) {
      const chip = el('span', 'zw-badge zw-badge-branch', icon(branch.icon), branch.name);
      chip.tabIndex = 0;
      ctx.tip.attach(chip, () => el('div', 'zw-tipcard', el('div', 'zw-tip-title', branch.name), el('div', 'zw-tip-sub', 'Ausbauzweig der Stufe 3'), el('p', 'zw-tip-text', branch.summary)), { tap: true });
      badges.append(chip);
    }
    badges.append(el('span', 'zw-badge' + (outdated ? ' zw-badge-old' : ''), icon(outdated ? 'modernize' : 'check'), outdated ? `veraltet: ${ageName}` : ageName));
    // Besonderer Bauplatz: Marke mit Name und Wirkung; die Kennzahlen darunter enthalten ihn schon.
    const place = tileDef(v.content, t.tile);
    tileRow.textContent = '';
    if (place) {
      const chip = tileBadge(place);
      chip.tabIndex = 0;
      ctx.tip.attach(chip, () => el('div', 'zw-tipcard', el('div', 'zw-tip-title', place.name), el('div', 'zw-tip-sub', 'Besonderer Bauplatz · ' + tileEffect(place)),
        el('p', 'zw-tip-text', place.text)), { tap: true });
      tileRow.append(chip);
    }
    setVisible(tileRow, !!place);
    const name = towerName(v.content, t);
    const look = weaponLook(t.arch);
    // Waffen des Pools: „Frostturm · Bremser-Platz“ unter dem Namen, in der Akzentfarbe der Waffe.
    const weapon = look ? el('div', 'zw-tower-weapon', el('i', 'zw-weapon-dot'), weaponLine(t.arch)) : null;
    if (weapon && look) weapon.style.setProperty('--weapon', look.accent);
    head.append(
      thumbImg(ctx, tier ? tier.model : '', 'zw-tower-img', t.level, look),
      el('div', 'zw-tower-id', el('div', 'zw-tower-name', name), weapon, el('div', 'zw-tower-meta', roleTag(t.arch, true), pips), badges),
    );
    setClass(root, 'zw-tower-super', t.super);
    setClass(root, 'zw-tower-mega', t.mega);
    root.style.setProperty('--role', t.arch.color);
    root.style.setProperty('--role-text', readableOnDark(t.arch.color));
    // Gaben einer Superwaffe.
    giftsBox.textContent = '';
    if (t.super) {
      const recipe = fusionRecipe(t.arch, t.gifts, t.recipe, v.content);
      if (recipe) {
        giftsBox.append(el('div', 'zw-tower-label', 'Rezept'),
          el('div', 'zw-gift zw-recipe', icon('recipe'), el('div', 'zw-gift-text', el('b', 'zw-gift-name', recipe.name), el('span', 'zw-gift-desc', recipe.coreText))));
      }
      giftsBox.append(el('div', 'zw-tower-label', 'Gaben der Zutaten'));
      const shown = statRows(t.stats, null, statNames(t.arch, t.gifts, v.content)).map((r) => r.label + r.value).join('|');
      t.gifts.forEach((id, index) => {
        const arch = v.content.archetypes.find((a) => a.id === id);
        const row = arch ? giftRow(arch, t.giftBranches[index] ?? 0) : null;
        if (!row) return;
        // Eine Gabe, ohne die keine sichtbare Zahl anders wäre, wirkt bei diesem Kern nicht (etwa Flächenschaden beim Taktgeber).
        const without = towerStats(v.content, t.arch, t.tier, t.level, {
          branch: t.branch,
          super: true,
          mega: t.mega,
          gifts: t.gifts.filter((_, i) => i !== index),
          giftBranches: t.giftBranches.filter((_, i) => i !== index),
          recipe: t.recipe,
          tile: t.tile,
          boons: t.boons,
          modifier: t.modifier,
        });
        if (statRows(without, null, statNames(t.arch, t.gifts, v.content)).map((r) => r.label + r.value).join('|') === shown) {
          row.classList.add('zw-gift-inert');
          row.querySelector('.zw-gift-text')?.append(el('span', 'zw-gift-inert-note', 'wirkt bei diesem Turm nicht'));
        }
        giftsBox.append(row);
      });
    }
    setVisible(giftsBox, t.super && giftsBox.querySelectorAll('.zw-gift').length > 0);
    const target = t.arch.tiers[st.age];
    if (outdated && target) {
      const src = ctx.thumb(target.model, t.level, 128, look);
      if (src) modImg.src = src;
      setVisible(modImg, !!src);
      modOk = `wird zu: ${t.super ? superNameOf(v.content, t, t.mega, t.gifts, st.age) : target.name}`;
    } else {
      modOk = '';
    }
    upOk = `auf Stufe ${t.level + 1}`;
    setText(fuse.labelEl, t.super ? 'Zur Megawaffe verschmelzen' : 'Verschmelzen');
    setAttr(fuse.btn, 'aria-label', t.super ? 'Zur Megawaffe verschmelzen' : 'Verschmelzen');
    rebuildBranches(t, v);
  }

  /**
   * Die zwei Zweige als Knöpfe: Symbol, Name, ein Satz und die Zahlen, die sich ändern.
   * @param {Tower} t
   * @param {GameView} v
   */
  function rebuildBranches(t, v) {
    branchOpts.textContent = '';
    branchButtons = [];
    lastBranchState = -1;
    const branches = t.arch.branches;
    if (!needsBranch(t) || !branches) return;
    branches.forEach((b, index) => {
      const changes = el('span', 'zw-branch-changes');
      const rows = statRows(t.stats, towerStats(v.content, t.arch, t.tier, 3, { branch: index, tile: t.tile, boons: t.boons, modifier: t.modifier }), statNames(t.arch, t.gifts, v.content)).filter((r) => r.next);
      for (const r of rows.slice(0, 3)) changes.append(el('span', r.dir < 0 ? 'zw-down' : 'zw-up', `${r.label} ${r.next}`));
      const btn = button('zw-btn zw-branch-opt', `Zweig ${b.name}: ${b.summary}`, icon(b.icon),
        el('span', 'zw-branch-text', el('span', 'zw-branch-name', b.name), el('span', 'zw-branch-sum', b.summary), changes));
      btn.addEventListener('click', () => {
        if (view && view.selected) act.upgrade(view.selected.id, index);
      });
      hoverPreview(btn, index === 0 ? 'branch0' : 'branch1');
      branchOpts.append(btn);
      branchButtons.push(btn);
    });
  }

  /**
   * @param {Tower} t
   * @param {GameView} v
   */
  function rebuildStats(t, v) {
    statsBox.textContent = '';
    const next = nextStats(t, v);
    // Ändert sich die Art des Angriffs, steht das in Worten über den Zahlen.
    for (const line of attackChange(t.stats, next)) statsBox.append(el('div', 'zw-attack-change', icon('fuse'), line));
    const list = statList(t.stats, next, statNames(t.arch, t.gifts, v.content));
    statsBox.append(list);
    const reach = reachBadges(t.stats);
    if (reach) statsBox.append(reach);
    sourceMarks(t, v, list, reach);
    if (t.buffRate > 0 || t.buffDamage > 0 || t.buffRange > 0) {
      const parts = [];
      if (t.buffRate > 0) parts.push(`+${percent(t.buffRate)} Feuerrate`);
      if (t.buffDamage > 0) parts.push(`+${percent(t.buffDamage)} Schaden`);
      if (t.buffRange > 0) parts.push(`+${percent(t.buffRange)} Reichweite`);
      statsBox.append(el('div', 'zw-tower-buff', icon('aura'), 'Im Takt: ' + parts.join(', ')));
    }
  }

  /**
   * Woher Zahlen kommen: Zeitgaben und die Eigenart der laufenden Welle, die die gezeigten Werte verändern. Die betroffenen
   * Zeilen bekommen ein kleines Symbol, darunter steht eine Zeile mit Namen (Tooltip mit dem ganzen Text).
   * @param {Tower} t
   * @param {GameView} v
   * @param {HTMLElement} list
   * @param {HTMLElement | null} reach
   */
  function sourceMarks(t, v, list, reach) {
    if (t.boons.length === 0 && !t.modifier) return;
    const src = statSources(v.content, t);
    /** @type {{ icon: string, color: string, labels: string[], name: string, tip: () => HTMLElement }[]} */
    const items = src.boons.map((b) => {
      const tag = boonTag(v.content, b.def);
      return { icon: b.def.icon, color: tag.color, labels: b.labels, name: b.def.name, tip: () => boonTip(v.content, b.def) };
    });
    if (src.modifier) {
      const m = src.modifier.def;
      items.push({ icon: m.icon, color: modifierColor(m), labels: src.modifier.labels, name: `${m.name} (diese Welle)`, tip: () => modifierTip(m, 'Eigenart dieser Welle · ' + modifierLine(m)) });
    }
    if (items.length === 0) return;
    const terms = list.querySelectorAll('dt');
    for (const item of items) {
      for (const dt of terms) {
        if (!item.labels.includes(dt.textContent || '')) continue;
        const mark = el('span', 'zw-stat-src', icon(item.icon));
        mark.style.setProperty('--src', item.color);
        mark.title = item.name;
        dt.append(mark);
      }
      if (reach && item.labels.includes('Flieger')) {
        const mark = el('span', 'zw-stat-src', icon(item.icon));
        mark.style.setProperty('--src', item.color);
        reach.lastElementChild?.append(mark);
      }
    }
    const row = el('div', 'zw-tower-src', el('span', '', src.boons.length === 0 ? 'Eigenart:' : src.modifier ? 'Wirkt mit:' : src.boons.length > 1 ? 'Zeitgaben:' : 'Zeitgabe:'));
    for (const item of items) {
      const chip = el('span', 'zw-tower-src-item', icon(item.icon), item.name);
      chip.style.setProperty('--src', item.color);
      chip.tabIndex = 0;
      ctx.tip.attach(chip, item.tip, { tap: true });
      row.append(chip);
    }
    statsBox.append(row);
  }

  /**
   * Rezept-Zeilen im Verschmelzen-Blatt (nur beim ersten Schritt):
   * - die Zutaten erfüllen ein freies Rezept: „Rezept erfüllt“ mit Formel;
   * - sie erfüllen ein gesperrtes, das schon im Rezeptbuch steht: „noch nicht freigeschaltet“ und was stattdessen entsteht;
   * - sonst (auch bei einem gesperrten, das nicht im Buch steht: kein Wort davon) je bekanntes Rezept dieses Kerns eine Zeile,
   *   gesperrte nur, wenn sie im Buch stehen, und als gesperrt markiert.
   * Wer die Flak hier sieht, hat sie entdeckt (Rezeptbuch).
   * @param {Tower} t
   * @param {GameView} v
   * @param {readonly string[]} gifts
   * @param {import('../types/content').FusionRecipe | null} recipe
   */
  function rebuildRecipeHint(t, v, gifts, recipe) {
    fuseRecipe.textContent = '';
    setClass(fuseRecipe, 'zw-fuse-recipe-locked', false);
    // Nur Rezepte, die diese Partie bauen kann: eigene des Kerns und die seines Platzes; waffengebundene nur mit passender Bewaffnung.
    const all = !t.super && t.arch.fusion ? coreRecipes(v.content, t.arch, v.sim.loadout) : [];
    if (all.length === 0) {
      setVisible(fuseRecipe, false);
      return;
    }
    const book = bookOf(ctx.deps);
    const unlocked = v.sim.state.recipes;
    const locked = recipe ? null : lockedRecipe(t.arch, gifts, unlocked, v.content);
    if (recipe) {
      fuseRecipe.append(el('div', 'zw-fuse-recipe-row', icon('recipe'), el('span', 'zw-fuse-recipe-text', el('b', '', `Rezept erfüllt: ${recipe.name}`)),
        recipeFormula(v.content, t.arch, recipe)));
      if (!recipe.locked) discover(ctx.deps, recipe.id, 'hint');
    } else if (locked && book[locked.id]) {
      setClass(fuseRecipe, 'zw-fuse-recipe-locked', true);
      fuseRecipe.append(el('div', 'zw-fuse-recipe-row', icon('lock'),
        el('span', 'zw-fuse-recipe-text', el('b', '', `Rezept ${locked.name}: noch nicht freigeschaltet.`),
          ` Diese Zutaten ergeben jetzt die gewöhnliche Superwaffe ${superNameOf(v.content, t, false, gifts, undefined, unlocked)}.`),
        recipeFormula(v.content, t.arch, locked)));
    } else {
      for (const r of all) {
        const open = recipeOpen(r, unlocked);
        if (!open && !book[r.id]) continue;
        fuseRecipe.append(el('div', 'zw-fuse-recipe-row' + (open ? '' : ' zw-fuse-recipe-off'), icon(open ? 'recipe' : 'lock'),
          el('span', 'zw-fuse-recipe-text', el('b', '', `Rezept ${r.name}:`), ` mit ${recipeParts(v.content, r)}`, open ? '' : ' (noch gesperrt)'),
          recipeFormula(v.content, t.arch, r)));
        if (open && !r.locked) discover(ctx.deps, r.id, 'hint');
      }
    }
    setVisible(fuseRecipe, fuseRecipe.childNodes.length > 0);
  }

  /**
   * Das Verschmelzen-Blatt neu aufbauen: Name der Superwaffe, Zutaten als Schalter (gewählte zeigen ihre Gabe ausführlich).
   * @param {Tower} t
   * @param {FusionPick} f
   * @param {GameView} v
   */
  function rebuildFusion(t, f, v) {
    const rule = v.content.balance.fusion;
    const need = rule.parts;
    setText(fuseKicker, t.super ? 'Verschmelzen zur Megawaffe' : 'Verschmelzen zur Superwaffe');
    setClass(fuseBox, 'zw-fuse-mega', t.super);
    fuseIcon.textContent = '';
    fuseIcon.append(icon(t.super ? 'crown' : 'fuse'));
    const gifts = giftsWith(t, pickedTowers(f, v));
    const unlocked = v.sim.state.recipes;
    // Eine Superwaffe als Kern behält ihr Rezept; ein neuer Kern bekommt das Rezept, das in dieser Partie frei ist.
    const recipe = t.super ? fusionRecipe(t.arch, t.gifts, t.recipe, v.content) : fusionRecipe(t.arch, gifts, unlocked, v.content);
    setText(fuseName, superNameOf(v.content, t, t.super, gifts, undefined, t.super ? t.recipe : unlocked));
    rebuildRecipeHint(t, v, gifts, recipe);
    if (t.super) {
      const kept = t.gifts.map((id, i) => {
        const arch = v.content.archetypes.find((a) => a.id === id);
        const gift = arch ? giftOf(arch, t.giftBranches[i] ?? 0) : null;
        return gift ? gift.name : '';
      }).filter((n) => n !== '');
      const keptText = kept.length > 1 ? kept.slice(0, -1).join(', ') + ' und ' + kept[kept.length - 1] : kept.join('');
      setText(fuseCore, `Behält ${keptText ? 'ihre Gaben ' + keptText : 'ihre Gaben'}, nimmt zwei weitere auf und trifft noch einmal härter: Schaden ×${num1(rule.megaDamage)} statt ×${num1(rule.damage)} gegenüber dem Kern.`);
      fuseNote.textContent = megaLimit(v.content, v.sim.state.boons) === 1 ? 'Die Zutaten gehen in der Superwaffe auf, ihre Felder werden frei. Es kann nur eine Megawaffe geben.' : 'Die Zutaten gehen in der Superwaffe auf, ihre Felder werden frei.';
    } else {
      setText(fuseCore, recipe ? recipe.coreText : t.arch.fusion ? t.arch.fusion.coreText : '');
      fuseNote.textContent = 'Die Zutaten gehen im Kern auf, ihre Felder werden frei.';
    }
    // Der Kern behält sein Feld; die Felder der Zutaten werden mit ihrer Eigenschaft wieder frei.
    /** @type {string[]} */
    const freed = [];
    for (const part of pickedTowers(f, v)) {
      const def = tileDef(v.content, part.tile);
      if (def && !freed.includes(def.name)) freed.push(def.name);
    }
    const coreTile = tileDef(v.content, t.tile);
    /** @type {string[]} */
    const tileLines = [];
    if (freed.length === 1) tileLines.push(`Der Bauplatz ${freed[0]} unter der Zutat wird wieder frei.`);
    else if (freed.length > 1) tileLines.push(`Die Bauplätze ${freed.slice(0, -1).join(', ')} und ${freed[freed.length - 1]} unter den Zutaten werden wieder frei.`);
    if (coreTile) tileLines.push(`${t.super ? 'Die Megawaffe' : 'Die Superwaffe'} bleibt auf dem Bauplatz ${coreTile.name}.`);
    if (tileLines.length > 0) fuseNote.append(' ', el('span', 'zw-fuse-tiles', tileLines.join(' ')));
    setText(fuseCount, `${f.picked.length} / ${need}`);
    setClass(fuseCount, 'zw-full', f.picked.length === need);
    fuseList.textContent = '';
    for (const part of candidates) {
      const gift = giftOf(part.arch, part.branch);
      if (!gift) continue;
      const on = f.picked.includes(part.id);
      const tier = part.arch.tiers[part.tier];
      const branch = part.arch.branches && part.branch >= 0 ? part.arch.branches[part.branch] : null;
      const from = (tier ? tier.name : part.arch.role) + (branch ? ' · ' + branch.name : '');
      const chip = button('zw-fuse-chip' + (on ? ' zw-on' : ''), `${from}, Gabe ${gift.name}: ${gift.text}`,
        roleDot(part.arch),
        el('span', 'zw-fuse-chip-text',
          el('span', 'zw-fuse-chip-top', el('b', 'zw-gift-name', gift.name), el('span', 'zw-fuse-chip-from', from)),
          on ? el('span', 'zw-gift-desc', gift.text) : null),
        el('span', 'zw-fuse-check', icon('check')));
      chip.setAttribute('role', 'checkbox');
      chip.setAttribute('aria-checked', on ? 'true' : 'false');
      chip.style.setProperty('--role', part.arch.color);
      chip.addEventListener('click', () => act.fuseToggle(part.id));
      if (!on) ctx.tip.attach(chip, () => el('div', 'zw-tipcard', el('div', 'zw-tip-title', gift.name), el('div', 'zw-tip-sub', from), el('p', 'zw-tip-text', gift.text)));
      fuseList.append(chip);
    }
  }

  /**
   * Preis, Zustand und Unterzeile eines Aktionsknopfs auffrischen.
   * @param {ReturnType<typeof actionButton>} a
   * @param {number} cost Preis oder -1
   * @param {number} gold
   * @param {string} maxText Unterzeile, wenn es nichts mehr zu tun gibt
   * @param {string} okText Unterzeile im Normalfall
   */
  function refreshAction(a, cost, gold, maxText, okText) {
    const state = cost < 0 ? 2 : gold < cost ? 1 : 0;
    const missing = state === 1 ? cost - gold : 0;
    if (a.lastCost === cost && a.lastState === state * 1e7 + missing) return;
    a.lastCost = cost;
    a.lastState = state * 1e7 + missing;
    setText(a.priceN, cost >= 0 ? num(cost) : '');
    setVisible(a.priceTag, cost >= 0);
    setClass(a.btn, 'zw-disabled', state !== 0);
    setClass(a.btn, 'zw-poor', state === 1);
    setAttr(a.btn, 'aria-disabled', state !== 0 ? 'true' : null);
    if (state === 2) setText(a.sub, maxText);
    else if (state === 1) setText(a.sub, `zu wenig Gold, es fehlen ${num(missing)}`);
    else setText(a.sub, okText);
  }

  return {
    root,
    modernizeButton: mod.btn,
    fuseButton: fuse.btn,
    branchBox,
    bind(v) {
      view = v;
      lastId = -1;
      preview = 'none';
    },
    update(v) {
      view = v;
      const t = v.selected;
      setVisible(root, !!t);
      if (!t) {
        lastId = -1;
        preview = 'none';
        return;
      }
      const st = v.sim.state;
      const outdated = t.tier < st.age && !!t.arch.tiers[st.age];
      let stale = false;
      const boonKey = t.boons.length + '|' + t.modifier;
      if (t.id !== lastId || t.tier !== lastTier || t.level !== lastLevel || st.age !== lastAge || t.branch !== lastBranch || t.super !== lastSuper || t.mega !== lastMega || boonKey !== lastBoonKey) {
        lastBoonKey = boonKey;
        if (t.id !== lastId || t.level !== lastLevel || t.super !== lastSuper || t.mega !== lastMega) preview = 'none';
        lastId = t.id;
        lastTier = t.tier;
        lastLevel = t.level;
        lastAge = st.age;
        lastBranch = t.branch;
        lastSuper = t.super;
        lastMega = t.mega;
        up.lastCost = NaN;
        mod.lastCost = NaN;
        sell.lastCost = NaN;
        lastRefundFull = -1;
        lastKills = -1;
        lastDamage = -1;
        lastSig = NaN;
        lastFuseState = '';
        rebuildHead(t, v);
        stale = true;
      }
      const sig = towerSignature(st);
      let candidatesChanged = false;
      if (sig !== lastSig) {
        lastSig = sig;
        refreshCandidates(t, v);
        candidatesChanged = true;
      }
      const picking = fusionOf(v);
      const f = picking && picking.coreId === t.id ? picking : null;
      const buff = t.buffRate * 1e6 + t.buffDamage * 1e3 + t.buffRange;
      if (stale || preview !== lastPreview || buff !== lastBuff || f !== lastFusion || (candidatesChanged && (f || preview === 'fuse'))) {
        lastPreview = preview;
        lastBuff = buff;
        rebuildStats(t, v);
      }
      if (f !== lastFusion || (f && candidatesChanged)) {
        lastFusion = f;
        lastGoState = -1;
        if (f) rebuildFusion(t, f, v);
      }
      setVisible(fuseBox, !!f);
      setVisible(normalBox, !f);
      setClass(root, 'zw-tower-fusing', !!f);
      if (f) {
        const fee = v.sim.fuseCost(t);
        const need = v.content.balance.fusion.parts;
        const ready = f.picked.length === need && st.gold >= fee;
        const goState = fee * 4 + (ready ? 1 : 0) + (st.gold < fee ? 2 : 0);
        if (goState !== lastGoState) {
          lastGoState = goState;
          setText(fuseGoPriceN, num(fee));
          setVisible(fuseGoPrice, fee > 0);
          setClass(fuseGo, 'zw-disabled', !ready);
          setClass(fuseGo, 'zw-poor', st.gold < fee);
          setAttr(fuseGo, 'aria-disabled', ready ? null : 'true');
        }
        return;
      }
      const hasAttack = t.stats.attack !== 'none';
      setVisible(modeBox, hasAttack);
      setVisible(record, hasAttack);
      for (let i = 0; i < modeButtons.length; i++) {
        const on = modeButtons[i].id === t.mode;
        setClass(modeButtons[i].btn, 'zw-on', on);
        setAttr(modeButtons[i].btn, 'aria-checked', on ? 'true' : 'false');
      }
      if (t.kills !== lastKills) {
        lastKills = t.kills;
        setText(killsN, num(t.kills));
      }
      const dmg = Math.round(t.damageDealt);
      if (dmg !== lastDamage) {
        lastDamage = dmg;
        setText(damageN, num(dmg));
      }
      // Ausbau: unter Stufe 3 ein Knopf oder die Zweigwahl; auf Stufe 3 tritt bei verschmelzbaren Rollen „Verschmelzen“ an seine Stelle.
      const upCost = v.sim.upgradeCost(t);
      const branching = needsBranch(t) && upCost >= 0;
      const core = canBeCore(t, v);
      setVisible(branchBox, branching);
      setVisible(up.btn, !branching && !core && !t.super);
      setVisible(fuse.btn, core);
      setClass(actions, 'zw-sell-wide', branching || core || t.super);
      if (branching) {
        const missing = Math.max(0, upCost - st.gold);
        const state = upCost * 1e7 + missing;
        if (state !== lastBranchState) {
          lastBranchState = state;
          setText(branchPriceN, num(upCost));
          setText(branchNote, missing > 0 ? `es fehlen ${num(missing)}` : '');
          setClass(branchBox, 'zw-poor', missing > 0);
          for (const btn of branchButtons) {
            setClass(btn, 'zw-disabled', missing > 0);
            setAttr(btn, 'aria-disabled', missing > 0 ? 'true' : null);
          }
        }
      } else if (!core && !t.super) {
        refreshAction(up, upCost, st.gold, 'höchste Stufe', upOk);
      }
      if (core) {
        const fee = v.sim.fuseCost(t);
        const blocker = fuseBlocker(t, v);
        const state = fee + '|' + blocker + '|' + fuseResult;
        if (state !== lastFuseState) {
          lastFuseState = state;
          setText(fuse.priceN, num(fee));
          setVisible(fuse.priceTag, fee > 0 && !(t.super && megaFull(v)));
          setClass(fuse.btn, 'zw-disabled', blocker !== '');
          setClass(fuse.btn, 'zw-poor', blocker.startsWith('zu wenig'));
          setClass(fuse.btn, 'zw-live', blocker === '');
          setAttr(fuse.btn, 'aria-disabled', blocker !== '' ? 'true' : null);
          setText(fuse.sub, blocker || `wird zu: ${fuseResult}`);
        }
      }
      setVisible(mod.btn, outdated);
      if (outdated) refreshAction(mod, v.sim.modernizeCost(t), st.gold, 'auf dem neuesten Stand', modOk);
      const refund = v.sim.sellValue(t);
      const full = refund >= t.invested ? 1 : 0;
      if (sell.lastCost !== refund || lastRefundFull !== full) {
        sell.lastCost = refund;
        lastRefundFull = full;
        setText(sell.priceN, '+' + num(refund));
        setText(sell.sub, full ? 'volle Erstattung' : `${percent(v.content.balance.sellRefund)} zurück`);
      }
    },
    cycleMode(v) {
      const t = v.selected;
      if (!t || t.stats.attack === 'none' || fusionOf(v)) return;
      const index = TARGET_MODES.findIndex((m) => m.id === t.mode);
      const next = TARGET_MODES[(index + 1) % TARGET_MODES.length];
      act.setTargetMode(t.id, next.id);
    },
    upgradeKey(v) {
      const t = v.selected;
      if (!t || fusionOf(v)) return;
      if (needsBranch(t) && branchButtons.length > 0) {
        // Nie stillschweigend wählen: Die Taste wandert zwischen den beiden Zweigen, die Eingabetaste bestätigt.
        const at = branchButtons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
        branchButtons[(at + 1) % branchButtons.length].focus({ preventScroll: true });
        return;
      }
      if (t.mega) ctx.toast('Eine Megawaffe ist voll ausgebaut', 'info');
      else if (t.super && canBeCore(t, v)) ctx.toast('Eine Superwaffe wächst nur noch durch Verschmelzen zur Megawaffe (V)', 'info');
      else if (t.super) ctx.toast('Eine Superwaffe ist voll ausgebaut', 'info');
      else if (t.level >= 3 && canBeCore(t, v)) ctx.toast('Höchste Stufe – jetzt hilft nur noch Verschmelzen (V)', 'info');
      else act.upgrade(t.id);
    },
    fuseKey(v) {
      const t = v.selected;
      if (!t) return;
      if (fusionOf(v)) return;
      if (t.mega) ctx.toast('Eine Megawaffe lässt sich nicht weiter verschmelzen', 'info');
      else if (t.super && !canBeCore(t, v)) ctx.toast('Das ist schon eine Superwaffe', 'info');
      else if (!canBeCore(t, v)) ctx.toast(t.arch.fusion ? 'Verschmelzen geht erst auf Stufe 3' : 'Diese Rolle lässt sich nicht verschmelzen', 'info');
      else openFusion(v);
    },
    confirmKey(v) {
      // Liegt der Fokus auf einem Knopf, löst die Eingabetaste schon diesen aus.
      if (!fusionOf(v) || document.activeElement instanceof HTMLButtonElement) return false;
      return confirmFusion(v);
    },
  };
}
