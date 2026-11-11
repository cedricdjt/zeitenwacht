// @ts-check
// Spielanzeige (HUD): Vorräte, Sonnenbogen mit Zeitalter und Welle, Tempo, Bauleiste, Wellenkarte, Zeitglocke, Turmkarte,
// Ansagen, Meldungen, die Karte zur Zeitenwende und die Hinweise für die erste Partie.
// update() läuft in jedem Bild und schreibt nur ins DOM, wenn sich ein angezeigter Wert geändert hat.

import { tileX, tileZ } from '../sim/path.js';
import { isClassic, megaLimit, recipeById, recipeLook } from '../sim/rules.js';
import { weaponName } from './loadout.js';
import { button, el, retrigger, setAttr, setClass, setStyle, setText, setVisible } from './dom.js';
import { icon, iconBody } from './icons.js';
import { boonById, boonTag, createBoonChips, createBoonPick, modifierColor, modifierLine, modifierTip } from './boons.js';
import { createBuildBar } from './buildbar.js';
import { actionsOf, bossLabel, createToaster, enemyTip, fusionOf, isMidBoss, kbd, makeThumb, megaCount, price, roleTag, thumbImg, towerSignature, traitIcons } from './common.js';
import { createFuseMarks } from './fusemarks.js';
import { createTileLabel } from './tilelabel.js';
import { num, seconds, soften } from './texts.js';
import { createTooltip } from './tooltip.js';
import { createTowerPanel } from './towerpanel.js';
import { counterWeapons, enemyTraits } from './traits.js';
import { createWavePanel } from './wavepanel.js';
import { discover, REASON_TEXT, recipeAgeName, recipeFormula } from './recipes.js';

/** @import { GameView, UiDeps } from '../types/app' */
/** @import { AbilityDef, AgeDef, Content, EnemyDef } from '../types/content' */
/** @import { SimEvent } from '../types/sim' */
/** @import { HudCtx } from './common.js' */

const SEEN_KEY = 'zeitenwacht.hintsSeen';

/**
 * Welche einmaligen Hinweise schon gezeigt und befolgt wurden.
 * @returns {{ branch?: boolean, fuse?: boolean, mega?: boolean, tiles?: boolean }}
 */
function loadSeen() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}

/**
 * @typedef {object} HudHost
 * @property {() => void} openPauseMenu Pausenmenü öffnen
 * @property {(color: string) => void} setAccent Akzentfarbe der ganzen Oberfläche
 */

/**
 * @typedef {object} Hud
 * @property {HTMLElement} root
 * @property {(view: GameView) => void} bind
 * @property {() => void} hide
 * @property {(visible: boolean) => void} setVisible Blendet die Anzeige aus, ohne die Partie zu lösen (für den Ergebnisbildschirm)
 * @property {(dt: number) => void} update
 * @property {(events: readonly SimEvent[]) => void} handleEvents
 * @property {(text: string, kind?: 'info' | 'warn' | 'good') => void} toast
 * @property {(event: KeyboardEvent) => boolean} key Verarbeitet eine Taste; true, wenn sie verbraucht wurde
 * @property {(ageIndex: number, fromIndex: number, gift: number) => void} showAgeCard
 */

/** Tempostufen. */
const SPEEDS = [1, 2, 4];
/** Laufende Zähler für Gold, Funken und Punkte. */
/**
 * @typedef {object} Counter
 * @property {HTMLElement} node
 * @property {number} shown
 * @property {number} last
 */

/**
 * Lässt eine Zahl weich zum Zielwert laufen und schreibt sie nur, wenn sich die gerundete Anzeige ändert.
 * @param {Counter} c
 * @param {number} target
 * @param {number} dt
 */
function tick(c, target, dt) {
  if (c.shown !== target) {
    const d = target - c.shown;
    c.shown = Math.abs(d) < 0.6 ? target : c.shown + d * (1 - Math.exp(-dt * 11));
  }
  const r = Math.round(c.shown);
  if (r !== c.last) {
    c.last = r;
    c.node.textContent = num(r);
  }
}

/**
 * Jahreszahl aus dem Untertitel eines Zeitalters („um 10 000 v. Chr.“ → -10000); NaN, wenn keine zu finden ist.
 * @param {string} subtitle
 * @returns {number}
 */
function parseYear(subtitle) {
  const m = /(\d[\d\s.  ]*)/.exec(subtitle);
  if (!m) return NaN;
  const value = parseInt(m[1].replace(/[^\d]/g, ''), 10);
  return /v\.\s*Chr/.test(subtitle) ? -value : value;
}

/**
 * @param {number} year
 * @returns {string}
 */
function formatYear(year) {
  const y = Math.round(year);
  if (y < 0) return `um ${num(-y)} v. Chr.`;
  if (y < 1000) return `um ${y} n. Chr.`;
  return `um ${y}`;
}

/**
 * @param {UiDeps} deps
 * @param {HudHost} host
 * @returns {Hud}
 */
export function createHud(deps, host) {
  const root = el('div', 'zw-hud');
  root.hidden = true;
  const tip = createTooltip(deps.root);
  const toasts = el('div', 'zw-toasts');
  toasts.setAttribute('role', 'status');
  toasts.setAttribute('aria-live', 'polite');

  const toast = createToaster(toasts);

  /** @type {HudCtx} */
  const ctx = { deps, content: deps.content, tip, thumb: makeThumb(deps), toast, loadout: () => (view ? view.sim.loadout : null) };

  // ----- oben links: Funken, Gold, Punkte -----
  const livesN = el('span', 'zw-res-n');
  const goldN = el('span', 'zw-res-n');
  const scoreN = el('span', 'zw-res-n');
  const livesItem = el('div', 'zw-res-item zw-res-lives', icon('flame'), livesN);
  const goldItem = el('div', 'zw-res-item zw-res-gold', icon('coin'), goldN);
  const scoreItem = el('div', 'zw-res-item zw-res-score', icon('star'), scoreN);
  livesItem.title = 'Funken: Jeder Gegner, der die Flamme erreicht, stiehlt welche.';
  goldItem.title = 'Gold';
  scoreItem.title = 'Punkte';
  const resources = el('div', 'zw-res zw-glass', livesItem, goldItem, scoreItem);
  // Gewählte Zeitgaben als kleine Marken unter den Vorräten.
  const boonChips = createBoonChips(ctx);
  const topLeft = el('div', 'zw-topleft', resources, boonChips.root);
  /** @type {Counter} */
  const livesC = { node: livesN, shown: 0, last: NaN };
  /** @type {Counter} */
  const goldC = { node: goldN, shown: 0, last: NaN };
  /** @type {Counter} */
  const scoreC = { node: scoreN, shown: 0, last: NaN };

  // ----- oben Mitte: Sonnenbogen -----
  const arcBox = el('div', 'zw-arc');
  const emblem = el('span', 'zw-emblem');
  const ageName = el('span', 'zw-age-name');
  const waveText = el('span', 'zw-age-wave');
  const pips = el('span', 'zw-agepips');
  const ageLine = el('div', 'zw-age-line', emblem, el('div', 'zw-age-text', ageName, el('div', 'zw-age-sub', waveText, pips)));
  const agePanel = el('div', 'zw-age zw-glass', arcBox, ageLine);
  const bossName = el('span', 'zw-boss-name');
  const bossFill = el('span', 'zw-boss-fill');
  const bossBar = el('div', 'zw-boss zw-glass', icon('crown'), bossName, el('span', 'zw-boss-track', bossFill));
  bossBar.hidden = true;
  // Läuft ein zweiter Boss mit (der Zwischenboss im Gefolge des Endbosses), zeigt eine schmale Zeile darunter die übrigen.
  const bossMinorName = el('span', 'zw-boss-name');
  const bossMinorFill = el('span', 'zw-boss-fill');
  const bossMinor = el('div', 'zw-boss zw-boss-minor zw-glass', bossMinorName, el('span', 'zw-boss-track', bossMinorFill));
  bossMinor.hidden = true;
  const pausedChip = el('div', 'zw-paused zw-glass', icon('pause'), 'Pausiert', kbd('P'));
  pausedChip.hidden = true;
  const banners = el('div', 'zw-banners');
  banners.setAttribute('role', 'status');
  banners.setAttribute('aria-live', 'polite');
  // Eigenart der laufenden Welle (Nebel, Eilmarsch ...): kleine Marke unter dem Sonnenbogen, solange die Welle läuft.
  const modBadgeName = el('span', 'zw-modbadge-name');
  const modBadgeIcon = el('span', 'zw-modbadge-icon');
  const modBadge = el('div', 'zw-modbadge zw-glass', modBadgeIcon, modBadgeName);
  modBadge.hidden = true;
  modBadge.tabIndex = 0;
  let modBadgeId = '';
  tip.attach(modBadge, () => {
    const def = modBadgeId && deps.content.modifiers ? deps.content.modifiers[modBadgeId] : undefined;
    return def ? modifierTip(def, 'Eigenart dieser Welle · ' + modifierLine(def)) : null;
  }, { tap: true });
  const center = el('div', 'zw-center', agePanel, modBadge, bossBar, bossMinor, pausedChip, banners);

  // ----- oben rechts: Tempo und Menü -----
  const pauseBtn = button('zw-seg-btn zw-pausebtn', 'Pause (P)', icon('pause'));
  pauseBtn.title = 'Pause (P)';
  const speedButtons = SPEEDS.map((s) => {
    const b = button('zw-seg-btn', `Tempo ${s}-fach`, `${s}×`);
    b.title = `Tempo ${s}× (+ / −)`;
    b.addEventListener('click', () => {
      if (!view) return;
      deps.actions.setSpeed(s);
      if (view.paused) deps.actions.setPaused(false);
    });
    return b;
  });
  const speedSeg = el('div', 'zw-seg zw-speed', pauseBtn, ...speedButtons);
  speedSeg.setAttribute('role', 'group');
  speedSeg.setAttribute('aria-label', 'Spieltempo');
  const menuBtn = button('zw-iconbtn zw-menubtn', 'Menü (Esc)', icon('menu'));
  menuBtn.title = 'Menü (Esc)';
  const controls = el('div', 'zw-ctl zw-glass', speedSeg, menuBtn);
  pauseBtn.addEventListener('click', () => {
    if (view) deps.actions.setPaused(!view.paused);
  });
  menuBtn.addEventListener('click', () => host.openPauseMenu());

  const top = el('div', 'zw-top', topLeft, center, controls);

  // ----- unten links: Zeitglocke, „Alle modernisieren“, Turmkarte -----
  const abilityIcon = el('span', 'zw-ability-icon');
  const abilityName = el('span', 'zw-ability-name');
  const abilityState = el('span', 'zw-ability-state');
  const abilityBtn = button('zw-ability', 'Zeitglocke (F)', el('span', 'zw-ability-ring'), abilityIcon, kbd('F'));
  const abilityBox = el('div', 'zw-abilitybox', abilityBtn, el('div', 'zw-ability-text zw-glass', abilityName, abilityState));
  const modAllCount = el('span', 'zw-modall-count');
  const modAllPrice = price('');
  const modAllPriceN = /** @type {HTMLElement} */ (modAllPrice.querySelector('.zw-price-n'));
  const modAll = button('zw-btn zw-modall zw-glass', 'Alle Türme modernisieren', icon('modernize'), el('span', 'zw-modall-text', 'Alle modernisieren', modAllCount), modAllPrice);
  modAll.hidden = true;
  const towerPanel = createTowerPanel(ctx);
  const fuseMarks = createFuseMarks(ctx);
  const tileLabel = createTileLabel(ctx);
  const left = el('div', 'zw-left', towerPanel.root, modAll, abilityBox);

  const buildBar = createBuildBar(ctx);
  const wavePanel = createWavePanel(ctx);
  const right = el('div', 'zw-right', wavePanel.root);
  // Wahl der Zeitgabe: liegt über der Bauleiste; eingeklappt bleibt ein Knopf darüber.
  const boonPick = createBoonPick(ctx, {
    choose: (id) => act.chooseBoon(id),
    showAge: () => {
      if (view) showAgeCard(view.sim.state.age, view.sim.state.age - 1, 0);
    },
  });
  wavePanel.onBlockedStart = () => boonPick.expand();
  const mid = el('div', 'zw-mid', toasts, boonPick.pill, buildBar.root, boonPick.root);
  const bottom = el('div', 'zw-bottom', left, mid, right);

  // ----- Zeitenwende, Hinweise, Randschimmer -----
  const ageCard = el('div', 'zw-agecard');
  ageCard.hidden = true;
  const hint = el('div', 'zw-hint');
  hint.hidden = true;
  const hintText = el('span', 'zw-hint-text');
  hint.append(hintText, el('i', 'zw-hint-arrow'));
  const vignette = el('div', 'zw-vignette');

  root.append(vignette, fuseMarks.root, tileLabel.root, top, bottom, ageCard, hint);

  /** @type {GameView | null} */
  let view = null;
  let lastAge = -1;
  let lastWave = -1;
  let lastPhase = '';
  /** @type {AbilityDef | null} */
  let lastAbility = null;
  let lastCdStep = -1;
  let lastCdSec = -1;
  let lastModCount = -1;
  let lastModTotal = -1;
  let lastBossHp = -1;
  /** @type {EnemyDef | null} */
  let lastBossDef = null;
  let lastMinorHp = -1;
  let lastMinorKey = '';
  /** Punkte des Sonnenbogens und ihre Lage; `boss` 0 = keiner, 1 = Zwischenboss, 2 = Endboss. */
  /** @type {{ node: SVGElement, x: number, y: number, boss: number }[]} */
  let arcDots = [];
  /** @type {SVGElement[]} */
  let arcAges = [];
  /** @type {SVGElement | null} */
  let arcSun = null;
  /** Bosswellen je Welle: 0 = keine, 1 = Zwischenboss, 2 = Endboss. @type {number[]} */
  let bossWaves = [];
  /** Farbe der Eigenart je Welle ('' = keine). @type {string[]} */
  let modWaves = [];
  /** Sekunden, die die Zeitenwende-Karte schon zu sehen ist; < 0 = nicht sichtbar. */
  let ageCardTime = -1;
  /** @type {{ from: number, to: number, node: HTMLElement, final: string, last: number } | null} */
  let yearRoll = null;
  /** Ziel des Hinweises für die erste Partie. */
  let hintStep = '';
  let hintX = NaN;
  let hintY = NaN;
  let hintHalf = 0;
  /** @type {{ tx: number, tz: number } | null} */
  let hintTile = null;
  const projected = { x: 0, y: 0, visible: false };
  const act = actionsOf(deps);
  /** Einmalige Hinweise zu Ausbauzweigen und Superwaffen (über Partien hinweg gemerkt). */
  const seen = loadSeen();
  let featureSig = NaN;
  /** Kennung eines Turms, der gerade mit zwei Nachbarn verschmelzen könnte; -1 = keiner. */
  let fusableId = -1;
  /** Kennung einer Superwaffe, die gerade zur Megawaffe werden könnte; -1 = keine. */
  let megableId = -1;
  /** Seit wann der Hinweis „Megawaffe möglich“ auf dem Feld steht; -1 = noch nie. */
  let megaHintSince = -1;
  /** Seit wann der Hinweis „Verschmelzen möglich“ auf dem Feld steht; -1 = noch nie. */
  let fuseHintSince = -1;
  /** Seit wann der Hinweis auf die besonderen Bauplätze steht; -1 = noch nie. */
  let tileHintSince = -1;
  /** Feld, auf das der Hinweis zu den besonderen Bauplätzen zeigt. @type {{ tx: number, tz: number } | null} */
  let hintTileSpot = null;

  abilityBtn.addEventListener('click', () => useAbility());
  modAll.addEventListener('click', () => deps.actions.modernizeAll());
  tip.attach(abilityBtn, () => {
    if (!view) return null;
    const a = view.sim.ability();
    return el('div', 'zw-tipcard', el('div', 'zw-tip-title', a.name), el('p', 'zw-tip-text', a.description),
      el('p', 'zw-tip-flavor', `Abklingzeit ${seconds(a.cooldown)}`));
  });

  function useAbility() {
    if (!view) return;
    const st = view.sim.state;
    if (st.abilityCooldown > 0) {
      toast(`${view.sim.ability().name} lädt noch`, 'info');
      return;
    }
    if (view.sim.ability().radius > 0) deps.actions.armAbility(!view.abilityArmed);
    else deps.actions.armAbility(true);
  }

  /**
   * Welche Art Boss eine Welle bringt: 0 = keinen, 1 = nur einen Zwischenboss, 2 = einen Endboss.
   * @param {Content} content
   * @param {number} age
   * @param {number} waveInAge
   * @returns {number}
   */
  function bossKind(content, age, waveInAge) {
    const wave = content.waves[age][waveInAge];
    let kind = 0;
    for (const g of wave.groups) {
      const def = content.enemies[g.enemy];
      if (def && def.boss) kind = Math.max(kind, isMidBoss(content, def) ? 1 : 2);
    }
    return kind;
  }

  /**
   * Klassen eines Punkts im Sonnenbogen.
   * @param {number} boss
   * @returns {string}
   */
  function arcDotClass(boss) {
    return boss === 2 ? 'zw-arc-dot zw-arc-boss' : boss === 1 ? 'zw-arc-dot zw-arc-boss zw-arc-mid' : 'zw-arc-dot';
  }

  /**
   * Baut den Sonnenbogen: ein flacher Bogen aus einem Punkt je Welle, darüber die Symbole der Zeitalter. Wellen mit Eigenart
   * tragen einen feinen Ring in deren Farbe.
   * @param {Content} content
   * @param {import('../types/sim').Sim} sim
   */
  function buildArc(content, sim) {
    const W = 440;
    const H = 66;
    const pad = 14;
    const gap = 0.9;
    const ages = content.waves.length;
    let total = 0;
    for (const waves of content.waves) total += waves.length;
    const steps = Math.max(1, total - 1 + (ages - 1) * gap);
    const step = (W - pad * 2) / steps;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'zw-arc-svg');
    svg.setAttribute('aria-hidden', 'true');
    arcDots = [];
    arcAges = [];
    bossWaves = [];
    modWaves = [];
    /** @param {number} x */
    const arcY = (x) => H - 9 - Math.sin(Math.PI * ((x - pad) / (W - pad * 2))) * 24;
    let index = 0;
    for (let a = 0; a < ages; a++) {
      const first = pad + (index + a * gap) * step;
      const count = content.waves[a].length;
      const lastX = first + (count - 1) * step;
      const cx = (first + lastX) / 2;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'zw-arc-age');
      g.setAttribute('transform', `translate(${(cx - 9).toFixed(1)} ${(arcY(cx) - 29).toFixed(1)}) scale(0.75)`);
      g.innerHTML = iconBody(content.ages[a] ? content.ages[a].id : 'dot');
      svg.append(g);
      arcAges.push(g);
      for (let w = 0; w < count; w++) {
        const x = first + w * step;
        const y = arcY(x);
        const boss = bossKind(content, a, w);
        const preview = sim.wavePreview(index - sim.state.wave);
        const mod = preview && preview.modifier && content.modifiers ? content.modifiers[preview.modifier] : undefined;
        modWaves.push(mod ? modifierColor(mod) : '');
        if (mod) {
          const ring = document.createElementNS(NS, 'circle');
          ring.setAttribute('cx', x.toFixed(1));
          ring.setAttribute('cy', y.toFixed(1));
          ring.setAttribute('r', '4.6');
          ring.setAttribute('class', 'zw-arc-mod');
          ring.style.stroke = modifierColor(mod);
          svg.append(ring);
        }
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        dot.setAttribute('r', boss === 2 ? '3.4' : boss === 1 ? '2.85' : '2.3');
        dot.setAttribute('class', arcDotClass(boss));
        svg.append(dot);
        arcDots.push({ node: dot, x, y, boss });
        bossWaves.push(boss);
        index += 1;
      }
    }
    const sun = document.createElementNS(NS, 'g');
    sun.setAttribute('class', 'zw-arc-sun');
    sun.innerHTML = '<circle class="zw-arc-halo" r="9"/><circle class="zw-arc-disc" r="5"/><path class="zw-arc-moon" d="M3.6 1.6A4.6 4.6 0 0 1-2 -4 4.6 4.6 0 1 0 3.600 1.600z"/>';
    svg.append(sun);
    arcSun = sun;
    arcBox.textContent = '';
    arcBox.append(svg);
  }

  /**
   * Zeitalter, Welle und Bogen auffrischen (nur wenn sich Welle, Phase oder Zeitalter geändert haben).
   * @param {GameView} v
   */
  function refreshWave(v) {
    const st = v.sim.state;
    const content = v.content;
    const age = content.ages[st.age];
    const total = v.sim.totalWaves;
    const done = st.phase === 'won' ? total : st.wave;
    const current = Math.min(st.wave, total - 1);
    if (age) {
      emblem.innerHTML = `<svg class="zw-icon" viewBox="0 0 24 24" aria-hidden="true">${iconBody(age.id)}</svg>`;
      setText(ageName, age.name);
    }
    const shown = Math.min(st.wave + 1, total);
    setText(waveText, st.phase === 'won' ? `Alle ${total} Wellen geschafft` : `Welle ${shown} / ${total}${age ? ' · ' + age.subtitle : ''}`);
    for (let i = 0; i < arcDots.length; i++) {
      const d = arcDots[i];
      const state = i < done ? ' zw-done' : i === current && st.phase !== 'won' ? ' zw-now' : '';
      setAttr(d.node, 'class', arcDotClass(d.boss) + state);
    }
    for (let a = 0; a < arcAges.length; a++) {
      setAttr(arcAges[a], 'class', 'zw-arc-age' + (a < st.age ? ' zw-done' : a === st.age ? ' zw-now' : ''));
    }
    if (arcSun && arcDots[current]) {
      setStyle(arcSun, 'transform', `translate(${arcDots[current].x.toFixed(1)}px, ${arcDots[current].y.toFixed(1)}px)`);
      setAttr(arcSun, 'class', 'zw-arc-sun' + (st.age === content.ages.length - 1 ? ' zw-night' : '') + (st.phase === 'wave' ? ' zw-run' : ''));
    }
    // Kompakte Fassung: nur die Wellen des laufenden Zeitalters.
    const count = content.waves[st.age] ? content.waves[st.age].length : 0;
    if (pips.childElementCount !== count) {
      pips.textContent = '';
      for (let i = 0; i < count; i++) pips.append(el('i', 'zw-agepip'));
    }
    const base = current - st.waveInAge;
    for (let i = 0; i < count; i++) {
      const node = /** @type {HTMLElement} */ (pips.children[i]);
      const w = base + i;
      setAttr(node, 'class', 'zw-agepip' + (bossWaves[w] === 2 ? ' zw-agepip-boss' : bossWaves[w] === 1 ? ' zw-agepip-boss zw-agepip-mid' : '') + (modWaves[w] ? ' zw-agepip-mod' : '') + (w < done ? ' zw-done' : w === current && st.phase !== 'won' ? ' zw-now' : ''));
      setStyle(node, '--mod', modWaves[w] || '');
    }
  }

  /**
   * Ansage oben in der Mitte: gleitet herein und verschwindet von selbst.
   * @param {string} text
   * @param {string} [iconName]
   * @param {string} [sub]
   * @param {string} [kind]
   * @param {string} [color] Farbe des Symbols und des Rands (Zeitgabe, Eigenart)
   */
  function announce(text, iconName, sub, kind = '', color = '') {
    while (banners.childElementCount >= 2 && banners.firstElementChild) banners.firstElementChild.remove();
    const node = el('div', 'zw-banner zw-glass' + (kind ? ' zw-banner-' + kind : ''), iconName ? icon(iconName) : null,
      el('span', 'zw-banner-text', text), sub ? el('span', 'zw-banner-sub', sub) : null);
    if (color) node.style.setProperty('--tone', color);
    banners.append(node);
    const long = kind === 'boss' || kind === 'mega' || kind === 'boon';
    window.setTimeout(() => node.classList.add('zw-out'), long ? 2800 : 2000);
    window.setTimeout(() => node.remove(), long ? 3200 : 2400);
  }

  /**
   * Ansage eines in dieser Partie freigeschalteten Rezepts: Name, Formel als Rollensymbole, Grund; dazu, ob es neu im
   * Rezeptbuch ist. Bleibt etwas länger stehen als die gewöhnlichen Ansagen.
   * @param {Content} content
   * @param {string} id
   * @param {'boon' | 'boss'} reason
   * @param {number} age
   * @param {boolean} fresh Neu im Rezeptbuch
   */
  function announceRecipe(content, id, reason, age, fresh) {
    const found = recipeById(content, id);
    if (!found) return;
    const { recipe, arch } = found;
    while (banners.childElementCount >= 2 && banners.firstElementChild) banners.firstElementChild.remove();
    const ageName = recipeAgeName(arch, recipe, age);
    const node = el('div', 'zw-banner zw-banner-recipe zw-glass', icon('recipe'),
      el('span', 'zw-banner-col',
        el('span', 'zw-banner-kicker', 'Neues Rezept · ' + REASON_TEXT[reason]),
        el('span', 'zw-banner-text', recipe.name + (ageName !== recipe.name ? ` · ${ageName}` : '')),
        el('span', 'zw-banner-sub', recipeFormula(content, arch, recipe), fresh ? el('span', 'zw-banner-new', 'Neu im Rezeptbuch') : null)));
    banners.append(node);
    window.setTimeout(() => node.classList.add('zw-out'), 4200);
    window.setTimeout(() => node.remove(), 4600);
  }

  buildBar.onUnlock = (archId) => {
    const arch = deps.content.archetypes.find((a) => a.id === archId);
    if (arch) announce(isClassic(arch) ? `Neue Rolle: ${arch.role}` : `Neu: ${weaponName(arch)} (${arch.role})`, 'check', arch.summary, 'role');
  };

  /**
   * Gegner eines Zeitalters in der Reihenfolge ihres ersten Erscheinens, Zwischenbosse danach, der Endboss zuletzt.
   * @param {Content} content
   * @param {number} ageIndex
   * @returns {EnemyDef[]}
   */
  function enemiesOfAge(content, ageIndex) {
    /** @type {EnemyDef[]} */
    const list = [];
    for (const wave of content.waves[ageIndex] || []) {
      for (const g of wave.groups) {
        const def = content.enemies[g.enemy];
        if (def && !list.includes(def)) list.push(def);
      }
    }
    const mid = list.filter((d) => d.boss && isMidBoss(content, d));
    return list.filter((d) => !d.boss).concat(mid, list.filter((d) => d.boss && !mid.includes(d)));
  }

  /**
   * Die Karte zur Zeitenwende.
   * @param {number} ageIndex
   * @param {number} fromIndex
   * @param {number} gift
   */
  function showAgeCard(ageIndex, fromIndex, gift) {
    const content = deps.content;
    const age = content.ages[ageIndex];
    if (!age) return;
    const from = content.ages[fromIndex];
    tip.hide();
    ageCard.textContent = '';
    const year = el('span', 'zw-agecard-year', age.subtitle);
    const head = el('div', 'zw-agecard-head',
      (() => {
        const e = el('span', 'zw-emblem zw-emblem-big');
        e.innerHTML = `<svg class="zw-icon" viewBox="0 0 24 24" aria-hidden="true">${iconBody(age.id)}</svg>`;
        return e;
      })(),
      el('div', '', el('div', 'zw-agecard-kicker', 'Ein neues Zeitalter bricht an'), el('h2', 'zw-agecard-name', age.name), year));
    const card = el('div', 'zw-agecard-card zw-glass', head, el('p', 'zw-agecard-tagline', age.tagline));

    // Neue Gegner, der Boss als Umriss.
    const foes = enemiesOfAge(content, ageIndex);
    /** @type {Set<string>} */
    const known = new Set();
    for (let a = 0; a < ageIndex; a++) for (const d of enemiesOfAge(content, a)) for (const t of enemyTraits(content, d)) known.add(t.id);
    if (foes.length > 0) {
      const row = el('div', 'zw-agecard-foes');
      for (const def of foes) {
        const chip = button('zw-foe zw-foe-big' + (def.boss ? ' zw-foe-boss zw-foe-shadow' : ''), def.name,
          thumbImg(ctx, def.model, 'zw-foe-img'), el('span', 'zw-foe-name', def.boss ? bossLabel(content, def) : soften(def.name)), traitIcons(content, def));
        tip.attach(chip, () => enemyTip(ctx, def), { tap: true });
        chip.addEventListener('click', (event) => event.stopPropagation());
        row.append(chip);
      }
      card.append(row);
      // Die eine neue Eigenschaft dieses Zeitalters und was dagegen hilft.
      for (const def of foes) {
        const fresh = enemyTraits(content, def).find((t) => !known.has(t.id) && t.id !== 'boss');
        if (!fresh || ageIndex === 0) continue;
        const line = el('div', 'zw-agecard-new', el('span', 'zw-trait zw-trait-' + fresh.id, icon(fresh.id)),
          el('span', 'zw-agecard-newtext', el('b', '', `Neu: ${fresh.name}. `), fresh.text));
        const helps = el('span', 'zw-agecard-helps');
        for (const arch of counterWeapons(content, fresh, view ? view.sim.loadout : null)) helps.append(roleTag(arch));
        if (helps.childElementCount > 0) line.append(helps);
        card.append(line);
        break;
      }
    }
    // Karten, die sich mit dem Zeitalter wandeln: Was sich am Weg ändert (map.stages), mit dem Hinweis auf das leuchtende Stück.
    const stage = view ? view.sim.map.stages?.[ageIndex] : null;
    if (stage && view) {
      const changes = view.sim.pathStages.includes(ageIndex);
      card.append(el('div', 'zw-agecard-paths', icon('map'),
        el('span', 'zw-agecard-pathtext', el('b', '', stage.name), ' ', stage.text,
          changes ? el('small', 'zw-agecard-pathhint', ' Das neue Wegstück leuchtet auf der Insel. Türme bleiben, wo sie sind.') : null)));
    }
    const foot = el('div', 'zw-agecard-foot');
    if (gift > 0) foot.append(el('span', 'zw-agecard-gift', icon('gift'), el('span', '', 'Zeitgeschenk '), price('+' + num(gift))));
    foot.append(el('span', 'zw-agecard-hint', icon('modernize'), 'Deine Türme bleiben stehen – veraltete lassen sich jetzt modernisieren.'));
    // Wartet eine Zeitgabe, führt die Karte zu ihr: erst sehen, was kommt, dann wählen.
    const offer = view ? view.sim.state.boonOffer.length > 0 : false;
    const go = offer
      ? button('zw-btn zw-primary zw-agecard-go', 'Weiter zur Zeitgabe', icon('gift'), 'Weiter zur Zeitgabe')
      : button('zw-btn zw-primary zw-agecard-go', 'Weiter', 'Weiter');
    foot.append(go);
    card.append(foot);
    ageCard.append(card);
    ageCard.hidden = false;
    ageCardTime = 0;
    card.addEventListener('click', hideAgeCard);
    // Die Jahreszahl rollt wie ein Zählwerk von der alten zur neuen.
    const y0 = from ? parseYear(from.subtitle) : NaN;
    const y1 = parseYear(age.subtitle);
    yearRoll = Number.isFinite(y0) && Number.isFinite(y1) ? { from: y0, to: y1, node: year, final: age.subtitle, last: NaN } : null;
    if (yearRoll) year.textContent = formatYear(y0);
  }

  function hideAgeCard() {
    if (ageCardTime < 0) return;
    ageCardTime = -1;
    yearRoll = null;
    tip.hide();
    const card = ageCard.firstElementChild;
    if (card) card.classList.add('zw-out');
    window.setTimeout(() => {
      if (ageCardTime < 0) {
        ageCard.hidden = true;
        ageCard.textContent = '';
      }
    }, 260);
  }

  /**
   * Wählt für den Hinweis „Bau hier einen Turm“ ein bebaubares Feld an der Innenseite der ersten Biegung.
   * @param {GameView} v
   * @returns {{ tx: number, tz: number } | null}
   */
  function findHintTile(v) {
    const path = v.sim.map.paths[0];
    if (!path || path.length < 2) return null;
    const bend = path.length > 2 ? path[1] : path[0];
    const after = path.length > 2 ? path[2] : path[1];
    const before = path[0];
    const sx = Math.sign(before[0] - bend[0]);
    const sz = Math.sign(after[1] - bend[1]);
    const ax = Math.sign(after[0] - bend[0]);
    const bz = Math.sign(before[1] - bend[1]);
    // Innenseite der Biegung zuerst, dann die übrigen Nachbarn.
    /** @type {[number, number][]} */
    const candidates = [[sx + ax, sz + bz], [sx + ax, 0], [0, sz + bz], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 1], [-1, 2], [-2, -1], [1, 2]];
    for (const [dx, dz] of candidates) {
      if (dx === 0 && dz === 0) continue;
      const tx = bend[0] + dx;
      const tz = bend[1] + dz;
      if (v.sim.canBuild(tx, tz).ok) return { tx, tz };
    }
    for (let tz = 0; tz < v.sim.map.height; tz++) {
      for (let tx = 0; tx < v.sim.map.width; tx++) if (v.sim.canBuild(tx, tz).ok) return { tx, tz };
    }
    return null;
  }

  /**
   * Setzt den Hinweis an eine Bildschirmstelle (Spitze des Pfeils); schreibt nur bei Änderung.
   * @param {string} step
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {boolean} below Hinweis hängt unter dem Punkt statt darüber
   */
  function placeHint(step, text, x, y, below) {
    if (hintStep !== step) {
      hintStep = step;
      setText(hintText, text);
      setVisible(hint, true);
      setClass(hint, 'zw-hint-below', below);
      retrigger(hint, 'zw-hint-in');
      hintX = NaN;
      hintHalf = hintText.offsetWidth / 2;
    }
    // Der Hinweis bleibt ganz im Fenster, auch wenn sein Ziel am Rand liegt.
    const rx = Math.round(Math.min(Math.max(x, hintHalf + 8), window.innerWidth - hintHalf - 8));
    const ry = Math.round(y);
    if (rx !== hintX || ry !== hintY) {
      hintX = rx;
      hintY = ry;
      hint.style.transform = `translate(${rx}px, ${ry}px)`;
    }
  }

  function clearHint() {
    if (hintStep === '') return;
    hintStep = '';
    setVisible(hint, false);
  }

  /**
   * @param {HTMLElement} target
   * @param {string} step
   * @param {string} text
   */
  function hintAt(target, step, text) {
    const r = target.getBoundingClientRect();
    if (r.width === 0) {
      clearHint();
      return;
    }
    placeHint(step, text, r.left + r.width / 2, r.top - 6, false);
  }

  /**
   * Merkt sich einen einmaligen Hinweis als erledigt.
   * @param {'branch' | 'fuse' | 'mega' | 'tiles'} id
   */
  function markSeen(id) {
    if (seen[id]) return;
    seen[id] = true;
    if (hintStep === id || hintStep === id + '-btn') clearHint();
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      // nur für diese Sitzung merken
    }
  }

  /**
   * Ein Turm, der jetzt Kern einer Superwaffe werden könnte (nur neu bestimmt, wenn sich am Turmbestand etwas ändert).
   * @param {GameView} v
   * @returns {import('../types/sim').Tower | null}
   */
  function findFusable(v) {
    refreshFusable(v);
    return fusableId >= 0 ? v.sim.towerById(fusableId) : null;
  }

  /**
   * Eine Superwaffe, die jetzt zur Megawaffe werden könnte (Nachbarn bereit, Höchstzahl nicht erreicht).
   * @param {GameView} v
   * @returns {import('../types/sim').Tower | null}
   */
  function findMegable(v) {
    refreshFusable(v);
    return megableId >= 0 ? v.sim.towerById(megableId) : null;
  }

  /**
   * Bestimmt Kerne für Super- und Megawaffe neu, wenn sich am Turmbestand etwas geändert hat.
   * @param {GameView} v
   */
  function refreshFusable(v) {
    const st = v.sim.state;
    const sig = towerSignature(st);
    if (sig === featureSig) return;
    featureSig = sig;
    fusableId = -1;
    megableId = -1;
    const rule = v.content.balance.fusion;
    const need = rule.parts;
    const megaOpen = megaCount(st) < megaLimit(v.content, st.boons);
    for (let i = 0; i < st.towers.length; i++) {
      const t = st.towers[i];
      if (t.level < 3 || t.mega || !t.arch.fusion) continue;
      if (t.super ? !megaOpen || megableId >= 0 : fusableId >= 0) continue;
      if (v.sim.fuseCandidates(t.id).length < need) continue;
      if (t.super) megableId = t.id;
      else fusableId = t.id;
    }
  }

  /**
   * Einmalige Hinweise zu den Ausbauzweigen und zum Verschmelzen. Sie erscheinen, wenn die Sache zum ersten Mal möglich ist,
   * und verschwinden für immer, sobald der Spieler sie getan hat.
   * @param {GameView} v
   * @returns {boolean} ob ein Hinweis steht
   */
  function featureHints(v) {
    const st = v.sim.state;
    // Wer die Zutatenwahl einmal geöffnet hat, kennt das Verschmelzen (und mit einer Superwaffe als Kern die Megawaffe).
    const picking = fusionOf(v);
    if (picking) {
      markSeen('fuse');
      const core = v.sim.towerById(picking.coreId);
      if (core && core.super) markSeen('mega');
    }
    if (st.phase === 'won' || st.phase === 'lost' || v.buildArch || picking) return false;
    const sel = v.selected;
    if (!seen.tiles && !sel && tileHint(v)) return true;
    if (!seen.branch && sel && sel.level === 2 && sel.arch.branches && !towerPanel.branchBox.hidden) {
      hintAt(towerPanel.branchBox, 'branch', 'Neu: Auf Stufe 3 wählst du einen Zweig');
      return true;
    }
    if (seen.fuse) return megaHint(v);
    if (sel && !sel.super && !towerPanel.fuseButton.hidden && towerPanel.fuseButton.classList.contains('zw-live')) {
      hintAt(towerPanel.fuseButton, 'fuse-btn', 'Drei Türme auf Stufe 3 werden eine Superwaffe');
      return true;
    }
    if (sel) return false;
    const core = findFusable(v);
    if (core) {
      deps.project(core.x, 1.6, core.z, projected);
      if (projected.visible) {
        // Wird der Hinweis lange übergangen, tritt er für immer ab; das Spielfeld soll nicht dauerhaft beschriftet sein.
        const now = performance.now();
        if (fuseHintSince < 0) fuseHintSince = now;
        if (now - fuseHintSince > 25000) {
          markSeen('fuse');
          return false;
        }
        placeHint('fuse', 'Verschmelzen möglich – Turm anklicken', projected.x, projected.y, false);
        return true;
      }
    }
    return false;
  }

  /**
   * Einmaliger Hinweis auf die besonderen Bauplätze, sobald einer in der Bauphase zu sehen ist. Er verschwindet für immer,
   * sobald der Zeiger (oder ein Tipp) auf einem solchen Feld war, oder nach einer Weile von selbst.
   * @param {GameView} v
   * @returns {boolean} ob ein Hinweis steht
   */
  function tileHint(v) {
    const st = v.sim.state;
    const spots = v.sim.map.tiles;
    if (!spots || spots.length === 0 || st.phase !== 'build') return false;
    if (hintStep !== 'tiles' && hintTileSpot) hintTileSpot = null;
    if (!hintTileSpot) {
      // Ein freies Feld, das gut im Bild liegt: das der Bildmitte am nächsten.
      let best = Infinity;
      for (const t of spots) {
        if (v.sim.towerAt(t.tx, t.tz) || !v.sim.tileAt(t.tx, t.tz)) continue;
        deps.project(tileX(t.tx, v.sim.map.width), 0.15, tileZ(t.tz, v.sim.map.height), projected);
        if (!projected.visible) continue;
        const dx = projected.x - window.innerWidth / 2;
        const dy = projected.y - window.innerHeight * 0.45;
        if (Math.abs(dx) > window.innerWidth * 0.42 || projected.y < window.innerHeight * 0.18 || projected.y > window.innerHeight * 0.75) continue;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          hintTileSpot = { tx: t.tx, tz: t.tz };
        }
      }
      if (!hintTileSpot) return false;
    }
    deps.project(tileX(hintTileSpot.tx, v.sim.map.width), 0.15, tileZ(hintTileSpot.tz, v.sim.map.height), projected);
    if (!projected.visible) return false;
    const now = performance.now();
    if (tileHintSince < 0) tileHintSince = now;
    if (now - tileHintSince > 20000) {
      markSeen('tiles');
      return false;
    }
    placeHint('tiles', 'Besonderer Bauplatz – zeig darauf', projected.x, projected.y - 10, false);
    return true;
  }

  /**
   * Einmaliger Hinweis auf die Megawaffe, sobald eine Superwaffe zum ersten Mal zwei ausgebaute Nachbarn hat.
   * @param {GameView} v
   * @returns {boolean} ob ein Hinweis steht
   */
  function megaHint(v) {
    if (seen.mega) return false;
    const sel = v.selected;
    if (sel && sel.super && !sel.mega && !towerPanel.fuseButton.hidden && towerPanel.fuseButton.classList.contains('zw-live')) {
      hintAt(towerPanel.fuseButton, 'mega-btn', 'Neu: Mit zwei weiteren Türmen wird sie zur Megawaffe');
      return true;
    }
    if (sel) return false;
    const core = findMegable(v);
    if (!core) return false;
    deps.project(core.x, 1.9, core.z, projected);
    if (!projected.visible) return false;
    const now = performance.now();
    if (megaHintSince < 0) megaHintSince = now;
    if (now - megaHintSince > 25000) {
      markSeen('mega');
      return false;
    }
    placeHint('mega', 'Megawaffe möglich – Superwaffe anklicken', projected.x, projected.y, false);
    return true;
  }

  /**
   * Hinweise der ersten Partie: höchstens einer zugleich, jeder verschwindet, sobald die Sache getan ist.
   * @param {GameView} v
   */
  function updateHints(v) {
    if (ageCardTime >= 0 || boonPick.pending) {
      clearHint();
      return;
    }
    if (v.settings.tutorialDone) {
      if (!featureHints(v)) clearHint();
      return;
    }
    const st = v.sim.state;
    if (st.phase === 'won' || st.phase === 'lost') {
      clearHint();
      return;
    }
    if (st.towers.length === 0 && st.wave === 0 && st.phase === 'build') {
      if (!v.buildArch) {
        const card = buildBar.firstOpenCard();
        if (card) hintAt(card, 'choose', 'Wähle einen Turm');
        else clearHint();
        return;
      }
      if (!hintTile) hintTile = findHintTile(v);
      if (hintTile) {
        deps.project(tileX(hintTile.tx, v.sim.map.width), 0.2, tileZ(hintTile.tz, v.sim.map.height), projected);
        if (projected.visible) {
          placeHint('place', 'Bau hier einen Turm', projected.x, projected.y - 14, false);
          return;
        }
      }
      clearHint();
      return;
    }
    if (st.wave === 0 && st.phase === 'build' && st.towers.length > 0) {
      hintAt(wavePanel.startButton, 'start', 'Starte die Welle');
      return;
    }
    if (st.age >= 1 && st.phase === 'build') {
      const sel = v.selected;
      if (sel && sel.tier < st.age && sel.arch.tiers[st.age]) {
        hintAt(towerPanel.root, 'modernize-btn', 'Hol ihn in die neue Zeit');
        return;
      }
      for (let i = 0; i < st.towers.length; i++) {
        const t = st.towers[i];
        if (t.tier < st.age && t.arch.tiers[st.age]) {
          deps.project(t.x, 1.3, t.z, projected);
          if (projected.visible) {
            placeHint('modernize', 'Alten Turm anklicken', projected.x, projected.y, false);
            return;
          }
        }
      }
    }
    if (!featureHints(v)) clearHint();
  }

  return {
    root,
    toast,
    showAgeCard,
    bind(v) {
      view = v;
      setVisible(root, true);
      const st = v.sim.state;
      buildArc(v.content, v.sim);
      boonChips.reset();
      buildBar.bind(v);
      wavePanel.bind(v);
      towerPanel.bind(v);
      fuseMarks.clear();
      featureSig = NaN;
      lastAge = -1;
      lastWave = -1;
      lastPhase = '';
      lastAbility = null;
      lastCdStep = -1;
      lastCdSec = -1;
      lastModCount = -1;
      lastModTotal = -1;
      lastBossHp = -1;
      lastBossDef = null;
      lastMinorHp = -1;
      lastMinorKey = '';
      hintTile = null;
      hintTileSpot = null;
      tileLabel.hide();
      clearHint();
      ageCardTime = -1;
      ageCard.hidden = true;
      ageCard.textContent = '';
      banners.textContent = '';
      toasts.textContent = '';
      livesC.shown = st.lives;
      goldC.shown = st.gold;
      scoreC.shown = st.score;
      livesC.last = goldC.last = scoreC.last = NaN;
    },
    setVisible(visible) {
      if (view) setVisible(root, visible);
      if (!visible) {
        tip.hide();
        clearHint();
      }
    },
    hide() {
      view = null;
      fuseMarks.clear();
      tileLabel.hide();
      setVisible(root, false);
      tip.hide();
      clearHint();
    },
    update(dt) {
      const v = view;
      if (!v) return;
      const st = v.sim.state;
      // Vorräte
      tick(livesC, st.lives, dt * 2);
      tick(goldC, st.gold, dt);
      tick(scoreC, st.score, dt);
      setClass(livesItem, 'zw-low', st.lives <= Math.max(3, st.maxLives * 0.25));
      // Zeitalter und Welle
      if (st.age !== lastAge) {
        lastAge = st.age;
        const age = v.content.ages[st.age];
        if (age) host.setAccent(age.accent);
        lastWave = -1;
      }
      if (st.wave !== lastWave || st.phase !== lastPhase) {
        lastWave = st.wave;
        lastPhase = st.phase;
        refreshWave(v);
      }
      // Boss
      // Der Boss mit den meisten Lebenspunkten führt; weitere (der Zwischenboss im Gefolge) teilen sich die schmale Zeile.
      /** @type {import('../types/sim').Enemy | null} */
      let boss = null;
      /** @type {import('../types/sim').Enemy | null} */
      let minor = null;
      let minorCount = 0;
      let minorHp = 0;
      let minorMax = 0;
      for (let i = 0; i < st.enemies.length; i++) {
        const e = st.enemies[i];
        if (!e.def.boss || !e.alive) continue;
        if (!boss || e.maxHp > boss.maxHp) {
          if (boss) {
            minorCount += 1;
            minorHp += boss.hp;
            minorMax += boss.maxHp;
            if (!minor || boss.maxHp > minor.maxHp) minor = boss;
          }
          boss = e;
        } else {
          minorCount += 1;
          minorHp += e.hp;
          minorMax += e.maxHp;
          if (!minor || e.maxHp > minor.maxHp) minor = e;
        }
      }
      setVisible(bossBar, !!boss);
      setVisible(bossMinor, !!minor);
      if (minor) {
        const key = minorCount + minor.def.id;
        if (key !== lastMinorKey) {
          lastMinorKey = key;
          setText(bossMinorName, (minorCount > 1 ? `${minorCount} × ` : '') + minor.def.name);
        }
        const hp = Math.max(0, Math.round((minorHp / Math.max(1, minorMax)) * 200));
        if (hp !== lastMinorHp) {
          lastMinorHp = hp;
          bossMinorFill.style.transform = `scaleX(${hp / 200})`;
        }
      } else {
        lastMinorHp = -1;
        lastMinorKey = '';
      }
      if (boss) {
        if (boss.def !== lastBossDef) {
          lastBossDef = boss.def;
          setText(bossName, boss.def.name);
        }
        const hp = Math.max(0, Math.round((boss.hp / boss.maxHp) * 200));
        if (hp !== lastBossHp) {
          lastBossHp = hp;
          bossFill.style.transform = `scaleX(${hp / 200})`;
        }
      } else {
        lastBossHp = -1;
      }
      setVisible(pausedChip, v.paused);
      // Tempo
      setClass(pauseBtn, 'zw-on', v.paused);
      setAttr(pauseBtn, 'aria-pressed', v.paused ? 'true' : 'false');
      for (let i = 0; i < SPEEDS.length; i++) {
        const on = !v.paused && v.speed === SPEEDS[i];
        setClass(speedButtons[i], 'zw-on', on);
        setAttr(speedButtons[i], 'aria-pressed', on ? 'true' : 'false');
      }
      // Zeitglocke
      const ability = v.sim.ability();
      if (ability !== lastAbility) {
        lastAbility = ability;
        abilityIcon.innerHTML = `<svg class="zw-icon" viewBox="0 0 24 24" aria-hidden="true">${iconBody(ability.icon)}</svg>`;
        setText(abilityName, ability.name);
        setAttr(abilityBtn, 'aria-label', `${ability.name} (F)`);
        lastCdSec = -1;
      }
      const cd = st.abilityCooldown;
      const cdStep = ability.cooldown > 0 ? Math.ceil((cd / ability.cooldown) * 180) : 0;
      if (cdStep !== lastCdStep) {
        lastCdStep = cdStep;
        abilityBtn.style.setProperty('--cd', (cdStep / 180).toFixed(4));
        setClass(abilityBtn, 'zw-ready', cdStep === 0);
      }
      const cdSec = Math.ceil(cd);
      if (cdSec !== lastCdSec) {
        lastCdSec = cdSec;
        setText(abilityState, cdSec > 0 ? `noch ${seconds(cdSec)}` : 'bereit');
      }
      setClass(abilityBtn, 'zw-armed', v.abilityArmed);
      // Alle modernisieren
      let modCount = 0;
      let modTotal = 0;
      for (let i = 0; i < st.towers.length; i++) {
        const t = st.towers[i];
        if (t.tier < st.age && t.arch.tiers[st.age]) {
          const c = v.sim.modernizeCost(t);
          if (c >= 0) {
            modCount += 1;
            modTotal += c;
          }
        }
      }
      if (modCount !== lastModCount || modTotal !== lastModTotal) {
        lastModCount = modCount;
        lastModTotal = modTotal;
        setVisible(modAll, modCount > 0);
        setText(modAllCount, modCount > 0 ? ` (${modCount})` : '');
        setText(modAllPriceN, num(modTotal));
      }
      setClass(modAll, 'zw-poor', modCount > 0 && st.gold < modTotal);
      boonChips.update(v);
      boonPick.update(v, ageCardTime >= 0);
      setClass(root, 'zw-boonpick-open', boonPick.open);
      if (st.modifier !== modBadgeId) {
        modBadgeId = st.modifier;
        const def = modBadgeId && v.content.modifiers ? v.content.modifiers[modBadgeId] : undefined;
        if (def) {
          modBadgeIcon.textContent = '';
          modBadgeIcon.append(icon(def.icon));
          setText(modBadgeName, def.name);
          modBadge.style.setProperty('--mod', modifierColor(def));
          setAttr(modBadge, 'aria-label', `Eigenart dieser Welle: ${def.name}. ${def.text}`);
        }
        setVisible(modBadge, !!def);
      }
      buildBar.update(v);
      wavePanel.update(v);
      towerPanel.update(v);
      fuseMarks.update(v);
      tileLabel.update(v);
      if (tileLabel.kind && !tileLabel.kind.startsWith('weg:') && !seen.tiles) markSeen('tiles');
      setClass(root, 'zw-has-tower', !!v.selected);
      setClass(root, 'zw-fusing', !!fusionOf(v));
      setClass(root, 'zw-building', !!v.buildArch);
      // Zeitenwende-Karte
      if (ageCardTime >= 0) {
        ageCardTime += dt;
        if (yearRoll) {
          const k = Math.min(1, Math.max(0, (ageCardTime - 0.5) / 1.6));
          const eased = 1 - Math.pow(1 - k, 3);
          if (k >= 1) {
            yearRoll.node.textContent = yearRoll.final;
            yearRoll = null;
          } else {
            const y = Math.round(yearRoll.from + (yearRoll.to - yearRoll.from) * eased);
            if (y !== yearRoll.last) {
              yearRoll.last = y;
              yearRoll.node.textContent = formatYear(y);
            }
          }
        }
        // Mit offener Zeitgabe bleibt die Karte, bis der Spieler weiterklickt: Er soll lesen können, was kommt.
        if (st.lock <= 0 && ageCardTime > 6 && st.boonOffer.length === 0) hideAgeCard();
      }
      updateHints(v);
    },
    handleEvents(events) {
      const v = view;
      if (!v) return;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        switch (e.type) {
          case 'waveStart': {
            // Bringt die Welle mehrere Bosse, wird der stärkste angesagt (der Endboss vor dem Zwischenboss im Gefolge).
            /** @type {EnemyDef | null} */
            let bossDef = null;
            if (e.boss) {
              for (const g of v.sim.wavePreview(0)?.groups ?? []) if (g.def.boss && (!bossDef || g.def.hp > bossDef.hp)) bossDef = g.def;
            }
            const modDef = e.modifier && v.content.modifiers ? v.content.modifiers[e.modifier] : undefined;
            if (bossDef) announce(`${bossLabel(v.content, bossDef)}: ${bossDef.name}`, 'crown', `Welle ${e.wave + 1}`, 'boss');
            else if (modDef) announce(`Welle ${e.wave + 1}: ${modDef.name}`, modDef.icon, modifierLine(modDef), 'mod', modifierColor(modDef));
            else announce(`Welle ${e.wave + 1}`, 'wave', e.early > 0 ? `Frühstart +${num(e.early)} Gold` : '');
            break;
          }
          case 'waveClear':
            announce(e.perfect ? 'Makellos!' : 'Welle geschafft', e.perfect ? 'starFull' : 'check', e.bonus > 0 ? `+${num(e.bonus)} Gold` : '', e.perfect ? 'perfect' : 'good');
            break;
          case 'age':
            showAgeCard(e.to, e.from, e.gift);
            break;
          case 'boon': {
            const def = boonById(v.content, e.id);
            if (def) {
              const tag = boonTag(v.content, def);
              announce(def.name, def.icon, `Zeitgabe gewählt · ${tag.label}`, 'boon', tag.color);
            }
            if (def && def.effect.grant && (def.effect.grant.lives || 0) !== 0) retrigger(livesItem, (def.effect.grant.lives || 0) > 0 ? 'zw-gain' : 'zw-hurt');
            break;
          }
          case 'recipe':
            // Ins Rezeptbuch, bevor die Spielsteuerung es tut: So weiß die Ansage, ob es neu ist.
            announceRecipe(v.content, e.id, e.reason, v.sim.state.age, discover(deps, e.id, e.reason));
            break;
          case 'leak':
            retrigger(livesItem, 'zw-hurt');
            retrigger(vignette, 'zw-vignette-on');
            break;
          case 'gold':
            if (e.reason === 'sell' || e.reason === 'age' || e.reason === 'wave' || e.reason === 'boon') retrigger(goldItem, 'zw-gain');
            break;
          case 'modernize':
            if (!v.settings.tutorialDone) deps.actions.changeSettings({ tutorialDone: true });
            break;
          case 'upgrade':
            if (e.tower.level >= 3 && e.tower.branch >= 0) markSeen('branch');
            break;
          case 'fuse': {
            markSeen('fuse');
            const tier = e.tower.arch.tiers[e.tower.tier];
            // Ein Rezept (etwa die Flak) bringt eigene Namen mit.
            const look = recipeLook(e.tower.arch, e.tower.tier, e.tower.gifts, e.tower.recipe, v.sim.content);
            if (e.mega) {
              markSeen('mega');
              announce(look ? look.megaName : tier ? tier.megaName || tier.superName || tier.name : 'Megawaffe', 'crown', 'Megawaffe geschmiedet', 'mega');
            } else {
              announce(look ? look.superName : tier ? tier.superName || tier.name : 'Superwaffe', 'fuse', 'Superwaffe geschmiedet', 'good');
            }
            break;
          }
          default:
            break;
        }
      }
    },
    key(event) {
      const v = view;
      if (!v) return false;
      const k = event.key;
      const code = event.code;
      if (ageCardTime >= 0) {
        // Jede Taste schließt zuerst nur die Karte; mit offener Zeitgabe zählt sie nicht schon als Wahl.
        hideAgeCard();
        if (k === 'Escape' || k === 'Enter' || k === ' ' || v.sim.state.boonOffer.length > 0) return true;
      }
      if (boonPick.key(event)) return true;
      if (code.startsWith('Digit') || code.startsWith('Numpad')) {
        const n = parseInt(code.replace('Digit', '').replace('Numpad', ''), 10);
        if (n >= 1 && n <= v.sim.loadout.length) {
          buildBar.chooseByIndex(n - 1, v);
          return true;
        }
      }
      switch (k) {
        case 'Escape':
          if (tip.isOpen()) tip.hide();
          if (fusionOf(v)) act.fuseCancel();
          else if (v.buildArch) deps.actions.chooseBuild(null);
          else if (v.abilityArmed) deps.actions.armAbility(false);
          else if (v.selected) deps.actions.selectTower(null);
          else host.openPauseMenu();
          return true;
        case ' ':
          if (boonPick.pending) {
            boonPick.expand();
            toast('Erst eine Zeitgabe wählen', 'info');
          } else if (wavePanel.needsFirstTower(v)) toast('Erst einen Turm bauen', 'info');
          else deps.actions.startWave();
          return true;
        case 'u':
        case 'U':
          towerPanel.upgradeKey(v);
          return true;
        case 'v':
        case 'V':
          towerPanel.fuseKey(v);
          return true;
        case 'Enter':
          return towerPanel.confirmKey(v);
        case 'm':
        case 'M':
          if (v.selected) deps.actions.modernize(v.selected.id);
          return true;
        case 'x':
        case 'X':
        case 'Delete':
          if (v.selected) deps.actions.sell(v.selected.id);
          return true;
        case 't':
        case 'T':
          towerPanel.cycleMode(v);
          return true;
        case 'f':
        case 'F':
          useAbility();
          return true;
        case 'p':
        case 'P':
          deps.actions.setPaused(!v.paused);
          return true;
        case 'r':
        case 'R':
          deps.actions.resetCamera();
          return true;
        case '+':
        case '=':
        case '-':
        case '_':
        case 'Tab': {
          const i = Math.max(0, SPEEDS.indexOf(v.speed));
          let n = i;
          if (k === 'Tab') n = event.shiftKey ? (i + SPEEDS.length - 1) % SPEEDS.length : (i + 1) % SPEEDS.length;
          else if (k === '+' || k === '=') n = Math.min(SPEEDS.length - 1, i + 1);
          else n = Math.max(0, i - 1);
          deps.actions.setSpeed(SPEEDS[n]);
          return true;
        }
        default:
          return false;
      }
    },
  };
}
