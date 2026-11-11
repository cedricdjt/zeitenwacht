// @ts-check
// Bauleiste: eine Karte je Platz mit der Waffe, die die Partie für ihn gezogen hat (Sim.loadout), und dem Vorschaubild ihrer
// Ausprägung im aktuellen Zeitalter samt Erkennungszeichen der Waffe.

import { towerStats } from '../sim/rules.js';
import { button, el, readableOnDark, retrigger, setAttr, setClass, setText, setVisible } from './dom.js';
import { icon, roleIconName } from './icons.js';
import { price, reachBadges, roleTag, statList } from './common.js';
import { num, soften } from './texts.js';
import { loadoutWeapons, weaponGist, weaponLine, weaponLook } from './loadout.js';
import { statNames } from './stats.js';

/** @import { GameView } from '../types/app' */
/** @import { TowerArchetypeDef } from '../types/content' */
/** @import { HudCtx } from './common.js' */

/**
 * @typedef {object} BuildCard
 * @property {TowerArchetypeDef} arch
 * @property {number} index
 * @property {HTMLButtonElement} btn
 * @property {HTMLImageElement} img
 * @property {HTMLElement} name
 * @property {HTMLElement} priceN
 * @property {HTMLElement} miss
 * @property {HTMLElement} lockText
 * @property {HTMLElement} air
 * @property {number} lastAge
 * @property {number} lastLocked -1 = unbekannt, 0 = frei, 1 = gesperrt
 * @property {number} lastCost
 * @property {number} lastMissing
 */

/**
 * @typedef {object} BuildBar
 * @property {HTMLElement} root
 * @property {(view: GameView) => void} bind
 * @property {(view: GameView) => void} update
 * @property {() => HTMLElement | null} firstOpenCard Erste baubare Karte (Ziel des Einstiegshinweises)
 * @property {(index: number, view: GameView) => void} chooseByIndex Taste 1..6
 * @property {(archId: string) => void} onUnlock Wird gesetzt: meldet eine frisch freigeschaltete Rolle
 */

/**
 * @param {HudCtx} ctx
 * @returns {BuildBar}
 */
export function createBuildBar(ctx) {
  const root = el('div', 'zw-build');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Türme bauen');
  /** @type {BuildCard[]} */
  let cards = [];
  /** @type {GameView | null} */
  let view = null;
  let firstUpdate = true;

  /**
   * Ob die Rolle gerade nicht baubar ist.
   * @param {TowerArchetypeDef} arch
   * @param {GameView} v
   * @returns {boolean}
   */
  function isLocked(arch, v) {
    const st = v.sim.state;
    if (!arch.tiers[st.age]) return true;
    return !v.sim.config.unlockAll && st.wave < arch.unlockWave;
  }

  /**
   * Text unter dem Schloss: ab wann es die Rolle gibt.
   * @param {TowerArchetypeDef} arch
   * @param {GameView} v
   * @returns {string}
   */
  function lockLabel(arch, v) {
    const st = v.sim.state;
    const ages = v.content.ages;
    let firstAge = st.age;
    if (!v.sim.config.unlockAll && st.wave < arch.unlockWave) {
      // Zeitalter der Freischaltwelle bestimmen.
      let rest = arch.unlockWave;
      let age = 0;
      while (age < v.content.waves.length - 1 && rest >= v.content.waves[age].length) {
        rest -= v.content.waves[age].length;
        age += 1;
      }
      if (age === st.age && arch.tiers[age]) return `ab Welle ${arch.unlockWave + 1}`;
      firstAge = age;
    }
    for (let a = Math.max(firstAge, st.age); a < ages.length; a++) {
      if (arch.tiers[a]) return a === st.age ? `ab Welle ${arch.unlockWave + 1}` : `ab ${ages[a].name}`;
    }
    return 'nicht mehr verfügbar';
  }

  /**
   * Unterzeile mit Waffe und Platz für Waffen des Pools („Frostturm · Bremser-Platz“); klassische brauchen keine.
   * @param {TowerArchetypeDef} arch
   * @returns {HTMLElement | null}
   */
  function weaponSub(arch) {
    const look = weaponLook(arch);
    if (!look) return null;
    const sub = el('div', 'zw-tip-sub zw-weapon-sub', el('i', 'zw-weapon-dot'), weaponLine(arch));
    sub.style.setProperty('--weapon', look.accent);
    return sub;
  }

  /**
   * Beschreibung der Waffe mit ihrer Eigenart vorn als hervorgehobene Zeile: Was sie von den anderen Waffen ihres Platzes
   * unterscheidet, steht so auf einen Blick da (bei Waffen des Pools in ihrer Akzentfarbe).
   * @param {TowerArchetypeDef} arch
   * @returns {HTMLElement}
   */
  function gistText(arch) {
    const { gist, rest } = weaponGist(arch);
    const head = el('span', 'zw-tip-gist', gist + (rest ? '.' : ''));
    const look = weaponLook(arch);
    if (look) head.style.setProperty('--weapon', look.accent);
    return el('p', 'zw-tip-text', head, rest ? ' ' + rest : '');
  }

  /**
   * @param {BuildCard} card
   * @returns {HTMLElement | null}
   */
  function buildTip(card) {
    if (!view) return null;
    const st = view.sim.state;
    const arch = card.arch;
    const tier = arch.tiers[st.age];
    const box = el('div', 'zw-tipcard');
    if (!tier || isLocked(arch, view)) {
      box.append(el('div', 'zw-tip-head', el('div', '', roleTag(arch, true), weaponSub(arch), el('div', 'zw-tip-sub', lockLabel(arch, view)))));
      box.append(gistText(arch));
      return box;
    }
    // Mit den Zeitgaben (ohne besonderen Bauplatz), damit der Tooltip zeigt, was ein neuer Turm wirklich kann.
    const stats = towerStats(view.content, arch, st.age, 1, { boons: st.boons, modifier: st.modifier });
    box.append(el('div', 'zw-tip-head', el('div', '', roleTag(arch, true), el('div', 'zw-tip-title', tier.name), weaponSub(arch))));
    box.append(gistText(arch));
    if (tier.flavor) box.append(el('p', 'zw-tip-flavor', tier.flavor));
    box.append(statList(stats, null, statNames(arch)));
    const reach = reachBadges(stats);
    if (reach) box.append(reach);
    return box;
  }

  /**
   * @param {BuildCard} card
   */
  function onClick(card) {
    if (!view) return;
    if (isLocked(card.arch, view)) {
      ctx.toast(`${weaponLine(card.arch)}: ${lockLabel(card.arch, view)}`, 'info');
      return;
    }
    ctx.deps.actions.chooseBuild(view.buildArch === card.arch.id ? null : card.arch.id);
  }

  /** @type {BuildBar} */
  const api = {
    root,
    bind(v) {
      view = v;
      firstUpdate = true;
      root.textContent = '';
      cards = loadoutWeapons(v.content, v.sim.loadout).map((arch, index) => {
        const img = el('img', 'zw-card-img');
        img.alt = '';
        img.draggable = false;
        const name = el('span', 'zw-card-name');
        const priceTag = price('');
        const priceN = /** @type {HTMLElement} */ (priceTag.querySelector('.zw-price-n'));
        const miss = el('span', 'zw-card-miss');
        const lockText = el('span', 'zw-card-locktext');
        const air = el('span', 'zw-card-air', icon('air'));
        air.title = 'trifft Flieger';
        const key = el('kbd', 'zw-kbd zw-card-key', String(index + 1));
        key.setAttribute('aria-hidden', 'true');
        const art = el('span', 'zw-card-art', img, el('span', 'zw-card-roleicon', icon(roleIconName(arch))), el('span', 'zw-card-lock', icon('lock')), miss);
        const btn = button('zw-card', arch.role, el('span', 'zw-card-stripe'), key, air, art, name, priceTag, lockText);
        btn.style.setProperty('--role', arch.color);
        btn.style.setProperty('--role-text', readableOnDark(arch.color));
        const look = weaponLook(arch);
        if (look) {
          btn.classList.add('zw-card-pool');
          btn.style.setProperty('--weapon', look.accent);
        }
        /** @type {BuildCard} */
        const card = { arch, index, btn, img, name, priceN, miss, lockText, air, lastAge: -1, lastLocked: -1, lastCost: -2, lastMissing: -1 };
        btn.addEventListener('click', () => onClick(card));
        ctx.tip.attach(btn, () => buildTip(card));
        root.append(btn);
        return card;
      });
    },
    update(v) {
      view = v;
      const st = v.sim.state;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const arch = card.arch;
        const locked = isLocked(arch, v) ? 1 : 0;
        if (card.lastAge !== st.age || card.lastLocked !== locked) {
          const wasLocked = card.lastLocked;
          card.lastAge = st.age;
          card.lastLocked = locked;
          const tier = arch.tiers[st.age];
          setClass(card.btn, 'zw-locked', locked === 1);
          const src = tier ? ctx.thumb(tier.model, 1, 128, weaponLook(arch)) : '';
          if (src) card.img.src = src;
          setClass(card.btn, 'zw-noimg', !src);
          setText(card.name, soften(tier ? tier.name : arch.role));
          setText(card.lockText, locked ? lockLabel(arch, v) : '');
          setVisible(card.air, !locked && !!tier && towerStats(v.content, arch, st.age, 1).hitsAir);
          setAttr(card.btn, 'aria-label', locked ? `${weaponLine(arch)}, gesperrt, ${lockLabel(arch, v)}` : `${tier ? tier.name : arch.role} (${weaponLine(arch)}), Taste ${card.index + 1}`);
          if (wasLocked === 1 && locked === 0 && !firstUpdate) {
            retrigger(card.btn, 'zw-card-new');
            api.onUnlock(arch.id);
          }
          card.lastCost = -2;
          card.lastMissing = -1;
        }
        const cost = locked ? -1 : v.sim.buildCost(arch.id);
        if (card.lastCost !== cost) {
          card.lastCost = cost;
          setText(card.priceN, cost >= 0 ? num(cost) : '');
        }
        const missing = cost >= 0 ? Math.max(0, cost - st.gold) : 0;
        if (card.lastMissing !== missing) {
          card.lastMissing = missing;
          setClass(card.btn, 'zw-poor', missing > 0);
          setText(card.miss, missing > 0 ? `fehlen ${num(missing)}` : '');
        }
        setClass(card.btn, 'zw-chosen', v.buildArch === arch.id);
        setAttr(card.btn, 'aria-pressed', v.buildArch === arch.id ? 'true' : 'false');
      }
      firstUpdate = false;
    },
    firstOpenCard() {
      if (!view) return null;
      for (const card of cards) if (!isLocked(card.arch, view)) return card.btn;
      return null;
    },
    chooseByIndex(index, v) {
      view = v;
      const card = cards[index];
      if (card) onClick(card);
    },
    onUnlock() {},
  };
  return api;
}
