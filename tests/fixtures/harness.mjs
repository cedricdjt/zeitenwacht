// @ts-check
// Gemeinsame Helfer der Simulationstests: Partie aus den Testinhalten bauen, Zeitschritte rechnen, Zustand vergleichen.

import { createSim } from '../../src/sim/sim.js';
import { hashString } from '../../src/util/rng.js';
import { makeContent, stats, tier } from './content.mjs';

/** @import { Content, Difficulty, EnemyDef, TowerArchetypeDef, TowerStats, WaveDef } from '../../src/types/content' */
/** @import { Enemy, SaveData, Sim, SimConfig, SimEvent, Tower } from '../../src/types/sim' */

/**
 * Baut eine Partie aus den Testinhalten. Ohne Angaben: Karte 'straight', normal, Startwert 1, alle Rollen frei.
 * @param {Partial<SimConfig> & { edit?: (content: Content) => void }} [options] `edit` verbiegt die Inhalte vor dem Start
 * @param {SaveData | null} [save]
 * @returns {Sim}
 */
export function makeSim(options = {}, save) {
  const { edit, ...config } = options;
  const content = config.content ?? makeContent();
  if (edit) edit(content);
  return createSim({ mapId: 'straight', difficulty: 'normal', seed: 1, unlockAll: true, ...config, content }, save);
}

/**
 * Ersetzt alle Wellen durch eine einzige (im ersten Zeitalter); die übrigen Zeitalter bekommen je eine leere Welle.
 * @param {Content} content
 * @param {WaveDef['groups']} groups
 */
export function oneWave(content, groups) {
  content.waves = content.ages.map((_, index) => [{ groups: index === 0 ? groups : [] }]);
}

/**
 * Legt einen Gegner in den Testinhalten an oder ändert ihn.
 * @param {Content} content
 * @param {string} id
 * @param {Partial<EnemyDef>} patch
 */
export function setEnemy(content, id, patch) {
  content.enemies[id] = { ...(content.enemies[id] ?? content.enemies.grunt), id, ...patch };
}

/**
 * Rechnet `count` Zeitschritte.
 * @param {Sim} sim
 * @param {number} count
 */
export function steps(sim, count) {
  for (let i = 0; i < count; i++) sim.step();
}

/**
 * Rechnet, bis die Bedingung gilt, höchstens `limit` Zeitschritte. Liefert die Zahl der gerechneten Schritte.
 * @param {Sim} sim
 * @param {() => boolean} done
 * @param {number} [limit]
 * @returns {number}
 */
export function stepUntil(sim, done, limit = 60 * 600) {
  let count = 0;
  while (!done()) {
    if (count >= limit) throw new Error(`Bedingung nach ${limit} Zeitschritten nicht erreicht`);
    sim.step();
    count += 1;
  }
  return count;
}

/**
 * Rechnet `count` Zeitschritte und sammelt alle Ereignisse ein.
 * @param {Sim} sim
 * @param {number} count
 * @returns {SimEvent[]}
 */
export function collect(sim, count) {
  /** @type {SimEvent[]} */
  const events = [];
  for (let i = 0; i < count; i++) {
    sim.step();
    const drained = sim.drainEvents();
    for (let j = 0; j < drained.length; j++) events.push(drained[j]);
  }
  return events;
}

/**
 * Ereignisse einer Art.
 * @template {SimEvent['type']} T
 * @param {SimEvent[]} events
 * @param {T} type
 * @returns {Extract<SimEvent, { type: T }>[]}
 */
export function ofType(events, type) {
  return /** @type {Extract<SimEvent, { type: T }>[]} */ (events.filter((event) => event.type === type));
}

/**
 * Der ganze Zustand als Text: Verweise auf Inhalte werden zu Kennungen, alles andere bleibt bitgenau.
 * @param {Sim} sim
 * @returns {string}
 */
export function snapshot(sim) {
  return JSON.stringify(sim.state, (key, value) => {
    if (key === 'def' || key === 'arch') return value.id;
    if (key === 'target') return value ? value.id : null;
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    return value;
  });
}

/**
 * Prüfsumme des ganzen Zustands.
 * @param {Sim} sim
 * @returns {number}
 */
export function digest(sim) {
  return hashString(snapshot(sim));
}

/**
 * Legt eine Turmrolle für Tests an: Kosten 10, in jedem Zeitalter vorhanden, sofort treffend, sofern nichts anderes angegeben ist.
 * @param {Content} content
 * @param {string} id
 * @param {Partial<TowerStats>} patch
 * @param {Partial<TowerArchetypeDef>} [extra]
 */
export function addArch(content, id, patch, extra) {
  content.archetypes.push({
    id,
    role: id,
    summary: '',
    color: '#888888',
    icon: id,
    unlockWave: 0,
    cost: 10,
    stats: stats({ attack: 'hitscan', range: 30, cooldown: 1000, ...patch }),
    tiers: content.ages.map(() => tier(id)),
    ...extra,
  });
}

/**
 * Eine Versuchsanordnung: eigene Gegner und Turmrollen, eine einzige Welle, reichlich Gold. Die Welle ist noch nicht gestartet.
 * Gegner ohne weitere Angaben sind schlichte Läufer mit 100 Lebenspunkten (hp 5), Tempo 1.
 * @param {{
 *   map?: string,
 *   seed?: number,
 *   difficulty?: Difficulty,
 *   enemies?: Record<string, Partial<EnemyDef>>,
 *   towers?: Record<string, Partial<TowerStats>>,
 *   wave: WaveDef['groups'],
 *   edit?: (content: Content) => void,
 * }} spec
 * @returns {Sim}
 */
export function scene(spec) {
  return makeSim({
    mapId: spec.map ?? 'straight',
    seed: spec.seed ?? 1,
    difficulty: spec.difficulty ?? 'normal',
    edit: (content) => {
      for (const id of Object.keys(spec.enemies ?? {})) setEnemy(content, id, { hp: 5, ...spec.enemies[id] });
      for (const id of Object.keys(spec.towers ?? {})) addArch(content, id, spec.towers[id]);
      oneWave(content, spec.wave);
      content.balance.startGold = 100000;
      if (spec.edit) spec.edit(content);
    },
  });
}

/** Ein Gegner, der praktisch stillsteht (Tempo 0,000001), in der Wegmitte läuft und 100 Lebenspunkte hat. */
export const STILL = Object.freeze({ boss: true, hp: 5, speed: 1e-6 });

/**
 * Startet die Welle, lässt die Gegner der ersten Zeitschritte erscheinen und versetzt sie auf die genannten Strecken.
 * Die Lage stimmt nach dem nächsten Zeitschritt. Liefert die Gegner in Reihenfolge ihres Erscheinens.
 * @param {Sim} sim
 * @param {number[]} dists Strecke je Gegner
 * @returns {Enemy[]}
 */
export function begin(sim, dists) {
  const started = sim.startWave();
  if (!started.ok) throw new Error(`Welle startet nicht: ${started.reason}`);
  stepUntil(sim, () => sim.state.enemies.length >= dists.length, 6000);
  for (let i = 0; i < dists.length; i++) sim.state.enemies[i].dist = dists[i];
  sim.drainEvents();
  return sim.state.enemies.slice();
}

/**
 * Baut einen Turm und liefert ihn; scheitert der Bau, scheitert der Test.
 * @param {Sim} sim
 * @param {string} archId
 * @param {number} tx
 * @param {number} tz
 * @returns {Tower}
 */
export function mustBuild(sim, archId, tx, tz) {
  const result = sim.build(archId, tx, tz);
  if (!result.ok) throw new Error(`Bau von ${archId} auf (${tx}, ${tz}) abgelehnt: ${result.reason}`);
  const tower = sim.towerAt(tx, tz);
  if (!tower) throw new Error('Turm nach dem Bau nicht gefunden');
  return tower;
}

/**
 * Vergleicht zwei Zahlen mit Toleranz.
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tolerance]
 * @param {string} [label]
 */
export function near(actual, expected, tolerance = 1e-6, label = '') {
  if (!(Math.abs(actual - expected) <= tolerance)) throw new Error(`${label ? `${label}: ` : ''}erwartet ${expected}, erhalten ${actual}`);
}

/**
 * Felder neben dem Weg, die besten zuerst: sortiert nach der Zahl der Wegfelder im Umkreis `range` (bei Gleichstand nach tz, tx).
 * @param {Sim} sim
 * @param {number} [range]
 * @returns {[number, number][]}
 */
export function buildSpots(sim, range = 2.5) {
  /** @type {{ tx: number, tz: number, score: number }[]} */
  const spots = [];
  for (let tz = 0; tz < sim.map.height; tz++) {
    for (let tx = 0; tx < sim.map.width; tx++) {
      if (!sim.canBuild(tx, tz).ok) continue;
      let score = 0;
      for (const curve of sim.paths) {
        for (const [px, pz] of curve.tiles) if (Math.hypot(px - tx, pz - tz) <= range) score += 1;
      }
      if (score > 0) spots.push({ tx, tz, score });
    }
  }
  spots.sort((a, b) => b.score - a.score || a.tz - b.tz || a.tx - b.tx);
  return spots.map((spot) => [spot.tx, spot.tz]);
}

/**
 * Ein kleiner gieriger Spieler: modernisiert, baut reihum nach einer festen Wunschliste auf die besten Felder, baut aus,
 * startet die Welle und läutet die Fähigkeit, sobald ein Gegner weit gekommen ist. Entscheidet nur aus dem Zustand,
 * also deterministisch. Aufruf einmal je Zeitschritt vor `sim.step()`.
 * @param {Sim} sim
 * @returns {(sim: Sim) => void}
 */
export function greedyBot(sim) {
  const wishes = ['shooter', 'shooter', 'thrower', 'flak', 'piercer', 'burner', 'shooter', 'slower', 'support', 'beamer'];
  const spots = buildSpots(sim);
  let next = 0;
  return (game) => {
    const state = game.state;
    if (state.phase === 'wave') {
      if (state.abilityCooldown === 0) {
        for (const enemy of state.enemies) {
          if (enemy.alive && enemy.progress > 0.75) {
            game.useAbility(enemy.x, enemy.z);
            break;
          }
        }
      }
      return;
    }
    if (state.phase !== 'build' || state.lock > 0) return;
    for (const tower of state.towers) if (game.modernizeCost(tower) >= 0) game.modernize(tower.id);
    for (let tries = 0; tries < 40; tries++) {
      const spot = spots.find(([tx, tz]) => game.canBuild(tx, tz).ok);
      if (!spot) break;
      let built = false;
      for (let k = 0; k < wishes.length && !built; k++) {
        const wish = wishes[(next + k) % wishes.length];
        const result = game.build(wish, spot[0], spot[1]);
        if (result.ok) {
          built = true;
          next = (next + k + 1) % wishes.length;
        } else if (result.reason === 'gold') {
          break;
        }
      }
      if (!built) break;
    }
    for (const tower of state.towers) {
      const cost = game.upgradeCost(tower);
      if (cost >= 0 && cost <= state.gold) game.upgrade(tower.id);
    }
    game.startWave();
  };
}

/**
 * Spielt mit einem Spieler bis zum Ende der Partie (oder bis `limit` Zeitschritte um sind).
 * @param {Sim} sim
 * @param {(sim: Sim) => void} player
 * @param {number} [limit]
 * @param {(sim: Sim) => void} [check] Prüfung nach jedem Zeitschritt
 */
export function play(sim, player, limit = 60 * 60 * 30, check) {
  for (let i = 0; i < limit && sim.state.phase !== 'won' && sim.state.phase !== 'lost'; i++) {
    player(sim);
    sim.step();
    sim.drainEvents();
    if (check) check(sim);
  }
}
