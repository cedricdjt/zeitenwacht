// @ts-check
// Kleines Schild an einem besonderen Bauplatz unter dem Zeiger (oder nach einem Tipp): Name und Wirkung des Felds,
// im Baumodus dazu der echte Preis dort und ob die gewählte Rolle überhaupt etwas davon hat. Auf einem Feld eines künftigen
// oder alten Weges (Karten, die sich mit dem Zeitalter wandeln) sagt es, was dort ist und warum dort nichts gebaut werden kann.
// update() läuft in jedem Bild und schreibt nur, wenn sich Inhalt oder Lage ändern.

import { tileX, tileZ } from '../sim/path.js';
import { tileDef } from '../sim/rules.js';
import { el, setClass, setVisible } from './dom.js';
import { icon } from './icons.js';
import { fusionOf } from './common.js';
import { AGE_DATIVE, num, PATH_MARK_TEXT } from './texts.js';
import { colorCss, tileChip, tileEffect, tileGain } from './tiles.js';

/** @import { GameView } from '../types/app' */
/** @import { HudCtx } from './common.js' */

/**
 * Rollenname im Dativ („dem Taktgeber“, „dem Schützen“).
 * @param {string} role
 * @returns {string}
 */
function dative(role) {
  return role.endsWith('e') ? role + 'n' : role;
}

/**
 * @param {HudCtx} ctx
 */
export function createTileLabel(ctx) {
  const root = el('div', 'zw-tilelabel');
  root.hidden = true;
  root.setAttribute('role', 'status');
  const card = el('div', 'zw-tilelabel-card');
  root.append(card);
  const projected = { x: 0, y: 0, visible: false };
  let lastKey = '';
  let lastX = NaN;
  let lastY = NaN;
  let half = 0;
  let height = 0;
  /** Art des Felds, das gerade beschriftet ist ('' = keins). */
  let shownKind = '';

  function hide() {
    if (lastKey === '') return;
    lastKey = '';
    shownKind = '';
    setVisible(root, false);
  }

  /**
   * Inhalt neu aufbauen.
   * @param {GameView} v
   * @param {string} kind
   * @param {number} tx
   * @param {number} tz
   * @param {boolean} occupied
   */
  function build(v, kind, tx, tz, occupied) {
    const def = tileDef(v.content, kind);
    if (!def) return;
    card.textContent = '';
    card.style.setProperty('--tile', colorCss(def.color));
    card.append(el('div', 'zw-tilelabel-head', tileChip(def), el('b', 'zw-tilelabel-name', def.name), el('span', 'zw-tilelabel-fx', tileEffect(def))));
    const arch = v.buildArch ? v.content.archetypes.find((a) => a.id === v.buildArch) : null;
    if (!arch || occupied) return;
    const st = v.sim.state;
    const rows = tileGain(v.content, arch, st.age, kind);
    const hasMod = def.mod && ((def.mod.mul && Object.keys(def.mod.mul).length > 0) || (def.mod.add && Object.keys(def.mod.add).length > 0));
    if (rows.length > 0) {
      const line = el('div', 'zw-tilelabel-gain zw-up', icon('check'));
      line.append(rows.slice(0, 2).map((r) => `${r.label} ${r.value} → ${r.next}`).join(', '));
      card.append(line);
    } else if (hasMod) {
      card.append(el('div', 'zw-tilelabel-gain zw-tilelabel-none', icon('close'), `Dem ${dative(arch.role)} bringt das nichts`));
    }
    const plain = v.sim.buildCost(arch.id);
    const here = v.sim.buildCost(arch.id, tx, tz);
    if (here !== plain && here >= 0) {
      const short = st.gold < here;
      card.append(el('div', 'zw-tilelabel-price' + (here > plain ? ' zw-dear' : ''), icon('coin'),
        el('b', '', num(here)), el('span', '', ` statt ${num(plain)}`), short ? el('span', 'zw-tilelabel-short', ` · es fehlen ${num(here - st.gold)}`) : null));
    }
  }

  /**
   * Schild für ein Feld eines künftigen oder alten Weges.
   * @param {GameView} v
   * @param {'future' | 'former'} mark
   * @param {number} tx
   * @param {number} tz
   */
  function buildPath(v, mark, tx, tz) {
    const text = PATH_MARK_TEXT[mark];
    card.textContent = '';
    card.style.setProperty('--tile', mark === 'future' ? '#f3d58a' : '#9fb48a');
    card.append(el('div', 'zw-tilelabel-head', el('span', 'zw-tilelabel-trace zw-tilelabel-trace-' + mark), el('b', 'zw-tilelabel-name', text.name),
      el('span', 'zw-tilelabel-fx', text.text)));
    let line = mark === 'future' ? 'Ein Turm hier stünde ihm im Weg' : 'Hier laufen keine Gegner mehr';
    if (mark === 'future') {
      // Ab welchem Zeitalter: die nächste Stufe, deren Wege über das Feld laufen.
      const sim = v.sim;
      for (const stage of sim.pathStages) {
        if (stage <= sim.state.age) continue;
        if (sim.stagePaths(stage).some((c) => c.tiles.some(([x, z]) => x === tx && z === tz))) {
          const age = v.content.ages[stage];
          if (age) line = `Ab ${AGE_DATIVE[age.id] ?? age.name}`;
          break;
        }
      }
    }
    card.append(el('div', 'zw-tilelabel-gain zw-tilelabel-none', icon(mark === 'future' ? 'clock' : 'close'), mark === 'future' ? `${line} · nicht bebaubar` : line));
  }

  return {
    root,
    /** Art des beschrifteten Felds oder '' ('weg:future' bzw. 'weg:former' für Felder eines künftigen oder alten Weges). */
    get kind() {
      return shownKind;
    },
    /** @param {GameView} v */
    update(v) {
      const hover = v.hover;
      if (!hover || !hover.inside || v.abilityArmed || fusionOf(v) || v.paused) {
        hide();
        return;
      }
      const special = v.sim.tileAt(hover.tx, hover.tz);
      const mark = special ? '' : v.sim.pathMark(hover.tx, hover.tz);
      const pathMark = mark === 'future' || mark === 'former' ? mark : null;
      const kind = special || (pathMark ? 'weg:' + pathMark : '');
      if (!kind) {
        hide();
        return;
      }
      const tower = pathMark ? null : v.sim.towerAt(hover.tx, hover.tz);
      // Ein Turm auf dem Feld erzählt seine Geschichte selbst in der Turmkarte; im Baumodus bleibt das Schild trotzdem stehen.
      if (tower && !v.buildArch) {
        hide();
        return;
      }
      const st = v.sim.state;
      const here = v.buildArch && !pathMark ? v.sim.buildCost(v.buildArch, hover.tx, hover.tz) : 0;
      const key = `${kind}|${hover.tx},${hover.tz}|${v.buildArch ?? ''}|${st.age}|${tower ? 1 : 0}|${st.gold < here ? st.gold : -1}`;
      if (key !== lastKey) {
        const fresh = lastKey === '' || shownKind !== kind;
        lastKey = key;
        shownKind = kind;
        if (pathMark) buildPath(v, pathMark, hover.tx, hover.tz);
        else build(v, kind, hover.tx, hover.tz, !!tower);
        setVisible(root, true);
        setClass(root, 'zw-tilelabel-build', !!v.buildArch);
        if (fresh) {
          root.classList.remove('zw-tilelabel-in');
          void root.offsetWidth;
          root.classList.add('zw-tilelabel-in');
        }
        half = card.offsetWidth / 2;
        height = card.offsetHeight;
        lastX = NaN;
      }
      // Unter die Vorderkante des Felds, damit die Turmvorschau darüber frei bleibt; am Fensterrand bleibt das Schild ganz sichtbar.
      ctx.deps.project(tileX(hover.tx, v.sim.map.width), 0, tileZ(hover.tz, v.sim.map.height) + 0.5, projected);
      if (!projected.visible) {
        hide();
        return;
      }
      let y = projected.y + 14;
      if (y + height > window.innerHeight - 8) y = projected.y - height - 70;
      const x = Math.round(Math.min(Math.max(projected.x, half + 8), window.innerWidth - half - 8));
      y = Math.round(y);
      if (x !== lastX || y !== lastY) {
        lastX = x;
        lastY = y;
        root.style.transform = `translate(${x}px, ${y}px)`;
      }
    },
    hide,
  };
}
