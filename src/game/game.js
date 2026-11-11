// @ts-check
// Spielsteuerung: verbindet Simulation, Bühne, Oberfläche und Ton. Enthält die Spielschleife, den Menüfluss,
// die Umsetzung der Spielerwünsche in Befehle an die Simulation sowie Speichern und Bestwerte.

import { createAudio } from '../audio/audio.js';
import { createStage } from '../render/stage.js';
import { classicLoadout, drawLoadout, waveAge } from '../sim/rules.js';
import { SIM_DT, createSim } from '../sim/sim.js';
import { PATH_MARK_TEXT, REJECT_TEXT } from '../ui/texts.js';
import { createUi } from '../ui/ui.js';
import { createAutoplay } from './autoplay.js';
import { createFusionControl } from './fusion.js';
import { addToRecipeBook, loadRecipeBook } from './recipebook.js';
import { loadValue, removeValue, saveValue } from './storage.js';

/** @import { MenuInfo, Records, ResultInfo, Settings, StageCallbacks } from '../types/app' */
/** @import { FusionView, GameActions } from './fusion.js' */
/** @import { Content, Difficulty } from '../types/content' */
/** @import { RejectReason, SaveData, Sim, SimEvent } from '../types/sim' */

/** Höchstzahl der Zeitschritte je Bild; schützt vor einer Aufholjagd nach einem Hänger. */
const MAX_STEPS = 12;
/** Sekunden zwischen Wellenende und automatischem Start der nächsten Welle. */
const AUTO_START_DELAY = 3;
/**
 * So viele zu Ende gespielte Partien (Sieg oder Niederlage), bis eine neue Partie von selbst zufällige Waffen zieht. Davor startet
 * sie mit der klassischen Bewaffnung, auf die sich die Einstiegshinweise und die Anleitung beziehen. Wer die Hinweise schon
 * abgeschlossen hat oder die Art selbst wählt, bekommt sofort, was er will.
 */
const CLASSIC_GAMES = 2;

/**
 * Profil über alle Partien (localStorage 'profile').
 * @typedef {object} Profile
 * @property {'random' | 'classic'} [loadoutMode] Zuletzt selbst gewählte Art der Bewaffnung
 * @property {number} [finished] Zu Ende gespielte Partien
 */

/**
 * Bewaffnung der nächsten Partie, wie der Bildschirm „Neues Spiel“ sie zeigt.
 * @typedef {object} LoadoutPlan
 * @property {'random' | 'classic'} mode
 * @property {number} seed Startwert der nächsten Partie (aus ihm stammt die Ziehung)
 * @property {readonly string[]} ids Eine Waffe je Platz in Reihenfolge der Plätze
 */

/** @returns {number} */
function freshSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

/** @type {Settings} */
const DEFAULT_SETTINGS = {
  quality: 'auto',
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  muted: false,
  shake: true,
  autoStart: false,
  floatingText: true,
  tutorialDone: false,
};

/**
 * Startet die Anwendung auf einer Leinwand und einem Wurzelelement für die Oberfläche.
 * @param {{ canvas: HTMLCanvasElement, uiRoot: HTMLElement, content: Content }} deps
 */
export function createGame(deps) {
  const { content } = deps;
  /** @type {Settings} */
  const settings = { ...DEFAULT_SETTINGS, ...loadValue('settings', {}) };
  /** @type {Records} */
  const records = loadValue('records', {});
  /** Rezeptbuch des Profils (docs/briefs/fusion.md, 11): Wissen über alle Partien, schaltet nichts frei. */
  const recipeBook = loadRecipeBook();
  /** @type {Profile} */
  const profile = loadValue('profile', {});

  /** @returns {'random' | 'classic'} Art der Bewaffnung, mit der der Bildschirm „Neues Spiel“ öffnet */
  function defaultMode() {
    if (profile.loadoutMode === 'random' || profile.loadoutMode === 'classic') return profile.loadoutMode;
    return settings.tutorialDone || (profile.finished ?? 0) >= CLASSIC_GAMES ? 'random' : 'classic';
  }

  /**
   * Neue Bewaffnung für die nächste Partie: neuer Startwert, daraus die Ziehung (oder die klassische).
   * @param {'random' | 'classic'} mode
   * @returns {LoadoutPlan}
   */
  function makePlan(mode) {
    const seed = freshSeed();
    return { mode, seed, ids: mode === 'classic' ? classicLoadout(content) : drawLoadout(content, seed) };
  }
  /** @type {LoadoutPlan} */
  let plan = makePlan(defaultMode());

  /** @type {'menu' | 'playing' | 'result'} */
  let mode = 'menu';
  /** @type {Sim | null} */
  let sim = null;
  /** @type {FusionView | null} */
  let view = null;
  /** @type {ReturnType<typeof createAutoplay> | null} */
  let autoplay = null;
  let acc = 0;
  let lastTime = 0;
  let autoTimer = 0;
  let saveWanted = false;
  let frameCount = 0;

  /** @type {StageCallbacks} */
  const stageCallbacks = {
    onHover(tile) {
      if (!view) return;
      view.hover = tile;
      refreshPreview();
    },
    onClick(tile, secondary) {
      if (!sim || !view || mode !== 'playing' || ui.modal) return;
      audio.unlock();
      if (secondary) {
        if (view.fusion) actions.fuseCancel();
        else if (view.buildArch) actions.chooseBuild(null);
        else if (view.abilityArmed) actions.armAbility(false);
        else actions.selectTower(null);
        return;
      }
      if (view.abilityArmed) {
        const result = sim.useAbility(tile.x, tile.z);
        if (!result.ok) reject(result.reason);
        actions.armAbility(false);
        return;
      }
      if (view.buildArch) {
        if (!tile.inside) return;
        const archId = view.buildArch;
        const result = sim.build(archId, tile.tx, tile.tz);
        if (!result.ok) {
          // Künftige und alte Wegfelder sehen aus wie Boden; die Meldung sagt, warum dort nichts geht.
          const mark = result.reason === 'path' ? sim.pathMark(tile.tx, tile.tz) : '';
          if (mark === 'future' || mark === 'former') {
            ui.toast(PATH_MARK_TEXT[mark].reject, 'warn');
            audio.ui('error');
          } else {
            reject(result.reason);
          }
          return;
        }
        audio.ui('build');
        // Im Baumodus bleiben, solange das Gold für einen weiteren Turm dieser Rolle reicht (auf einem gewöhnlichen Feld;
        // ein teurer Sumpf daneben soll den Baumodus nicht beenden).
        if (sim.state.gold < sim.buildCost(archId)) actions.chooseBuild(null);
        else refreshPreview();
        return;
      }
      const tower = tile.inside ? sim.towerAt(tile.tx, tile.tz) : null;
      if (view.fusion) {
        // Während der Zutatenwahl wählt ein Klick auf einen passenden Nachbarn ihn an oder ab; alles andere bleibt ohne Folgen.
        if (tower && tower.id !== view.fusion.coreId && !fusion.toggle(tower.id)) reject('adjacent');
        return;
      }
      actions.selectTower(tower && view.selected !== tower ? tower.id : null);
      // Ein Tipp auf ein leeres Feld zählt als Zeigen: So erklärt sich ein besonderer Bauplatz auch ohne Maus.
      if (!tower) view.hover = tile;
    },
  };

  const stage = createStage(deps.canvas, content, stageCallbacks);
  const audio = createAudio();

  /** @param {RejectReason | undefined} reason */
  function reject(reason) {
    ui.toast(REJECT_TEXT[reason ?? 'unknown'], 'warn');
    audio.ui('error');
  }

  const fusion = createFusionControl({
    sim: () => sim,
    view: () => view,
    reject,
    changed: () => audio.ui('click'),
    fused: () => audio.ui('upgrade'),
  });

  /** Zuletzt hervorgehobener besonderer Bauplatz ('' = keiner). */
  let litTile = '';

  /** Bauvorschau, Zielkreis und Hervorhebung des besonderen Bauplatzes an das Feld unter dem Zeiger anpassen. */
  function refreshPreview() {
    if (!sim || !view) return;
    const tile = view.hover;
    const special = tile && tile.inside && sim.tileAt(tile.tx, tile.tz) !== '' ? tile : null;
    const lit = special ? `${special.tx},${special.tz}` : '';
    if (lit !== litTile) {
      litTile = lit;
      stage.highlightSpecialTile(special ? { tx: special.tx, tz: special.tz } : null);
    }
    if (view.buildArch && tile && tile.inside) {
      const valid = sim.canBuild(tile.tx, tile.tz).ok && sim.state.gold >= sim.buildCost(view.buildArch, tile.tx, tile.tz);
      stage.setBuildPreview({ archId: view.buildArch, tx: tile.tx, tz: tile.tz, valid });
    } else {
      stage.setBuildPreview(null);
    }
    if (view.abilityArmed && tile) stage.setAbilityCursor({ x: tile.x, z: tile.z, radius: sim.ability().radius });
    else stage.setAbilityCursor(null);
  }

  /** @returns {MenuInfo} */
  function menuInfo() {
    /** @type {SaveData | null} */
    const save = loadValue('save', null);
    let summary = null;
    if (save && content.maps.some((m) => m.id === save.mapId)) {
      const total = content.waves.reduce((n, list) => n + list.length, 0);
      const age = waveAge(content, Math.min(save.wave, total - 1)).age;
      summary = { mapId: save.mapId, difficulty: save.difficulty, wave: save.wave + 1, totalWaves: total, ageName: content.ages[age].name };
    }
    return { save: summary, records };
  }

  function toMenu() {
    mode = 'menu';
    sim = null;
    view = null;
    autoplay = null;
    litTile = '';
    stage.showAttract();
    audio.setAge(null);
    audio.setPaused(false);
    ui.showMenu(menuInfo());
  }

  /**
   * Beginnt eine Partie mit einer fertigen Simulation.
   * @param {Sim} newSim
   */
  function begin(newSim) {
    sim = newSim;
    view = { sim, content, settings, speed: 1, paused: false, buildArch: null, selected: null, abilityArmed: false, hover: null, fusion: null };
    mode = 'playing';
    acc = 0;
    autoTimer = 0;
    saveWanted = false;
    autoplay = null;
    litTile = '';
    stage.load(sim);
    stage.applySettings(settings);
    audio.setAge(content.ages[sim.state.age].id);
    audio.setSpeed(1);
    audio.setPaused(false);
    ui.showGame(view);
  }

  /** Schreibt den Spielstand, sobald die Simulation einen hergibt (nur in Ruhephasen ohne liegende Bodenfelder). */
  function trySave() {
    if (!sim || !saveWanted) return;
    const save = sim.save();
    if (save) {
      saveValue('save', save);
      saveWanted = false;
    }
  }

  /** @param {boolean} won */
  function finish(won) {
    if (!sim || !view) return;
    mode = 'result';
    removeValue('save');
    const s = sim.state;
    const key = `${sim.map.id}:${sim.config.difficulty}`;
    const previous = records[key];
    const best = previous ? previous.score : 0;
    const waveReached = Math.min(s.wave + (won ? 0 : 1), sim.totalWaves);
    if (!previous || s.score > previous.score) {
      records[key] = { score: s.score, wave: waveReached, won: won || Boolean(previous && previous.won) };
      saveValue('records', records);
    } else if (won && !previous.won) {
      previous.won = true;
      saveValue('records', records);
    }
    if (won && !settings.tutorialDone) actions.changeSettings({ tutorialDone: true });
    profile.finished = (profile.finished ?? 0) + 1;
    saveValue('profile', profile);
    if (!profile.loadoutMode) plan = makePlan(defaultMode());
    actions.chooseBuild(null);
    actions.selectTower(null);
    audio.ui(won ? 'victory' : 'defeat');
    /** @type {ResultInfo} */
    const info = {
      won,
      score: s.score,
      best,
      newRecord: s.score > best,
      wave: waveReached,
      totalWaves: sim.totalWaves,
      ageName: content.ages[s.age].name,
      time: s.time,
      stats: s.stats,
    };
    ui.showResult(info);
  }

  /** @param {readonly SimEvent[]} events */
  function onEvents(events) {
    if (!sim || !view) return;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.type) {
        case 'waveClear':
          saveWanted = true;
          autoTimer = 0;
          break;
        case 'age':
          audio.setAge(content.ages[e.to].id);
          break;
        case 'boonOffer':
          // Das offene Angebot gehört in den Spielstand, damit es nach dem Laden wieder erscheint.
          saveWanted = true;
          break;
        case 'boon':
          saveWanted = true;
          // Neue Werte sofort zeigen: Reichweitenring des gewählten Turms und die Bauvorschau.
          if (view.selected) stage.setSelectedTower(view.selected);
          refreshPreview();
          break;
        case 'sell':
          if (view.selected === e.tower) actions.selectTower(null);
          break;
        case 'recipe':
          // Die Oberfläche hat es für ihre Ansage schon eingetragen; doppelt schadet nicht.
          actions.discoverRecipe(e.id, e.reason);
          break;
        case 'fuse':
          if (e.tower.recipe) actions.discoverRecipe(e.tower.recipe, 'built');
          // Der Kern bleibt gewählt; die Bühne soll seine neue Reichweite zeigen.
          if (view.selected === e.tower) stage.setSelectedTower(e.tower);
          else if (view.selected && e.parts.some((part) => view !== null && view.selected !== null && part.id === view.selected.id)) actions.selectTower(null);
          break;
        case 'won':
          finish(true);
          return;
        case 'lost':
          finish(false);
          return;
        default:
      }
    }
  }

  /** @type {GameActions} */
  const actions = {
    newGame(mapId, difficulty) {
      audio.unlock();
      // Die Partie bekommt genau die Bewaffnung, die der Bildschirm gezeigt hat; die nächste zieht neu.
      const { seed, ids } = plan;
      plan = makePlan(plan.mode);
      begin(createSim({ content, mapId, difficulty, seed, loadout: ids, unlockAll: settings.tutorialDone, boonChoice: true }));
    },
    loadoutPlan() {
      return plan;
    },
    setLoadoutMode(next) {
      profile.loadoutMode = next;
      saveValue('profile', profile);
      if (next !== plan.mode) plan = makePlan(next);
      return plan;
    },
    redrawLoadout() {
      plan = makePlan(plan.mode === 'classic' ? 'random' : plan.mode);
      if (profile.loadoutMode !== 'random') {
        profile.loadoutMode = 'random';
        saveValue('profile', profile);
      }
      return plan;
    },
    continueGame() {
      audio.unlock();
      /** @type {SaveData | null} */
      const save = loadValue('save', null);
      if (!save) {
        ui.showMenu(menuInfo());
        return;
      }
      try {
        begin(createSim({ content, mapId: save.mapId, difficulty: save.difficulty, seed: save.seed, unlockAll: settings.tutorialDone, boonChoice: true }, save));
      } catch (err) {
        console.error('Spielstand konnte nicht geladen werden', err);
        removeValue('save');
        ui.showMenu(menuInfo());
        ui.toast('Der Spielstand ließ sich nicht laden', 'warn');
      }
    },
    restart() {
      if (!sim) return;
      // Noch einmal mit derselben Bewaffnung, aber neuem Zufall.
      const mapId = sim.map.id;
      const difficulty = sim.config.difficulty;
      const loadout = sim.loadout.slice();
      removeValue('save');
      audio.unlock();
      begin(createSim({ content, mapId, difficulty, seed: freshSeed(), loadout, unlockAll: settings.tutorialDone, boonChoice: true }));
    },
    quitToMenu() {
      trySave();
      toMenu();
    },
    setPaused(paused) {
      if (!view || mode !== 'playing') return;
      view.paused = paused;
      audio.setPaused(paused);
      ui.showPause(paused);
    },
    setSpeed(speed) {
      if (!view) return;
      view.speed = speed === 2 || speed === 4 ? speed : 1;
      audio.setSpeed(view.speed);
    },
    startWave() {
      if (!sim || mode !== 'playing') return;
      const result = sim.startWave();
      if (!result.ok) reject(result.reason);
    },
    chooseBoon(id) {
      if (!sim || mode !== 'playing') return;
      const result = sim.chooseBoon(id);
      if (result.ok) audio.ui('upgrade');
      else reject(result.reason);
    },
    chooseBuild(archId) {
      if (!sim || !view) return;
      if (archId && archId === view.buildArch) archId = null;
      if (archId) {
        const arch = content.archetypes.find((a) => a.id === archId);
        const locked = !arch || !sim.loadout.includes(archId) || !arch.tiers[sim.state.age] || (!sim.config.unlockAll && sim.state.wave < arch.unlockWave);
        if (locked) {
          reject('locked');
          return;
        }
        view.selected = null;
        view.fusion = null;
        stage.setSelectedTower(null);
        view.abilityArmed = false;
      }
      view.buildArch = archId;
      stage.setGridVisible(Boolean(archId));
      refreshPreview();
    },
    selectTower(towerId) {
      if (!sim || !view) return;
      const tower = towerId === null ? null : sim.towerById(towerId);
      if (tower && view.buildArch) {
        view.buildArch = null;
        stage.setGridVisible(false);
        stage.setBuildPreview(null);
      }
      if (tower && tower !== view.selected) audio.ui('select');
      if (tower !== view.selected) view.fusion = null;
      view.selected = tower;
      stage.setSelectedTower(tower);
    },
    upgrade(towerId, branch) {
      if (!sim) return;
      const tower = sim.towerById(towerId);
      // Der Schritt auf Stufe 3 verlangt eine Entscheidung; ohne sie wird nie stillschweigend ein Zweig genommen.
      if (tower && tower.level === 2 && tower.arch.branches && branch === undefined) {
        reject('branch');
        return;
      }
      const result = sim.upgrade(towerId, branch);
      if (result.ok) audio.ui('upgrade');
      else reject(result.reason);
    },
    modernize(towerId) {
      if (!sim) return;
      const result = sim.modernize(towerId);
      if (result.ok) audio.ui('modernize');
      else reject(result.reason);
    },
    modernizeAll() {
      if (!sim) return;
      const s = sim.state;
      const old = s.towers.filter((t) => t.tier < s.age).sort((a, b) => sim.modernizeCost(a) - sim.modernizeCost(b));
      let done = 0;
      for (const tower of old) {
        if (sim.modernize(tower.id).ok) done++;
      }
      if (done > 0) {
        audio.ui('modernize');
        ui.toast(done === 1 ? '1 Turm modernisiert' : `${done} Türme modernisiert`, 'good');
      } else if (old.length > 0) {
        reject('gold');
      }
    },
    sell(towerId) {
      if (!sim) return;
      const result = sim.sell(towerId);
      if (result.ok) audio.ui('sell');
      else reject(result.reason);
    },
    setTargetMode(towerId, targetMode) {
      if (!sim) return;
      const result = sim.setTargetMode(towerId, targetMode);
      if (result.ok) audio.ui('click');
    },
    fuseBegin(coreId) {
      if (!sim || !view || mode !== 'playing') return;
      if (!view.selected || view.selected.id !== coreId) actions.selectTower(coreId);
      fusion.begin(coreId);
    },
    fuseToggle(towerId) {
      fusion.toggle(towerId);
    },
    fuseCancel() {
      fusion.cancel();
    },
    fuseConfirm() {
      fusion.confirm();
    },
    armAbility(armed) {
      if (!sim || !view || mode !== 'playing') return;
      if (!armed) {
        view.abilityArmed = false;
        refreshPreview();
        return;
      }
      if (sim.state.abilityCooldown > 0) {
        reject('cooldown');
        return;
      }
      if (sim.ability().radius <= 0) {
        // Fähigkeit ohne Zielen: sofort auslösen.
        const result = sim.useAbility(0, 0);
        if (!result.ok) reject(result.reason);
        return;
      }
      actions.chooseBuild(null);
      view.fusion = null;
      view.abilityArmed = true;
      refreshPreview();
    },
    changeSettings(patch) {
      Object.assign(settings, patch);
      saveValue('settings', settings);
      stage.applySettings(settings);
      audio.applySettings(settings);
    },
    resetCamera() {
      stage.resetCamera();
    },
    recipeBook() {
      return recipeBook;
    },
    discoverRecipe(id, how) {
      return addToRecipeBook(recipeBook, id, how, sim ? sim.state.age : -1);
    },
  };

  const ui = createUi({
    root: deps.uiRoot,
    content,
    actions,
    settings,
    thumbnail: (modelId, opts) => stage.thumbnail(modelId, opts),
    project: (x, y, z, out) => stage.project(x, y, z, out),
  });

  /** @param {number} now */
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    let simulated = 0;
    if (mode === 'playing' && sim && view && !view.paused) {
      if (autoplay) autoplay.act();
      acc += dt * view.speed;
      let steps = 0;
      while (acc >= SIM_DT && steps < MAX_STEPS && mode === 'playing') {
        sim.step();
        acc -= SIM_DT;
        steps++;
        simulated += SIM_DT;
        const events = sim.drainEvents();
        if (events.length > 0) {
          stage.handleEvents(events);
          audio.handleEvents(events);
          ui.handleEvents(events);
          onEvents(events);
        }
      }
      if (steps === MAX_STEPS) acc = 0;
      trySave();
      // Automatischer Wellenstart, wenn der Spieler ihn eingeschaltet hat.
      if (mode === 'playing' && settings.autoStart && sim.state.phase === 'build' && sim.state.lock <= 0 && sim.state.wave > 0) {
        autoTimer += dt;
        if (autoTimer >= AUTO_START_DELAY) {
          autoTimer = 0;
          sim.startWave();
        }
      }
    }
    stage.render(dt, simulated, mode === 'playing' && view && !view.paused ? acc / SIM_DT : 1);
    ui.update(dt);
    frameCount++;
    if (frameCount === 3) {
      const boot = document.getElementById('boot');
      if (boot) boot.classList.add('boot-done');
      Object.assign(window, { __ready: true });
    }
    requestAnimationFrame(frame);
  }

  // Ton erst nach der ersten Eingabe (Vorgabe der Browser); Pause, wenn das Fenster in den Hintergrund geht.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('resize', () => stage.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing' && view && !view.paused && !autoplay) actions.setPaused(true);
  });

  return {
    /** Zeigt das Hauptmenü und startet die Bildschleife. */
    start() {
      stage.applySettings(settings);
      audio.applySettings(settings);
      toMenu();
      // Schnellstart für Tests: ?auto=<karte>&difficulty=normal&seed=1&bot=1&speed=4&quality=low&loadout=random
      // (loadout: 'classic' (Standard; mit bot=1 'random'), 'random' (Ziehung aus dem Startwert) oder Waffen mit Komma getrennt)
      const query = new URLSearchParams(window.location.search);
      const auto = query.get('auto');
      if (query.get('quality')) stage.applySettings({ ...settings, quality: /** @type {Settings['quality']} */ (query.get('quality')) });
      if (auto) {
        const map = content.maps.find((m) => m.id === auto) ?? content.maps[0];
        const difficulty = /** @type {Difficulty} */ (query.get('difficulty') ?? 'normal');
        const seed = Number(query.get('seed') ?? 1) >>> 0;
        // Mit dem Selbstspieler (bot=1, etwa tools/smoke.mjs) ohne Angabe eine gezogene Bewaffnung, damit Rauchtests den Pool sehen.
        const spec = query.get('loadout') ?? (query.get('bot') === '1' ? 'random' : 'classic');
        const loadout = spec === 'random' || spec === 'classic' ? spec : spec.split(',').filter((id) => id !== '');
        begin(createSim({ content, mapId: map.id, difficulty, seed, loadout, unlockAll: query.get('unlock') === '1' || settings.tutorialDone, boonChoice: true }));
        if (query.get('bot') === '1' && sim) autoplay = createAutoplay(sim);
        if (view) view.speed = Number(query.get('speed') ?? 1) || 1;
      }
      lastTime = performance.now();
      requestAnimationFrame(frame);
    },
    /** Für Tests und die Konsole. */
    debug: {
      get sim() {
        return sim;
      },
      get view() {
        return view;
      },
      get mode() {
        return mode;
      },
      stage,
      actions,
      /** @param {boolean} on */
      bot(on) {
        autoplay = on && sim ? createAutoplay(sim) : null;
      },
      /** Rechnet die Partie ohne Darstellung um so viele Sekunden vor (mit Selbstspieler, falls eingeschaltet). @param {number} seconds */
      skip(seconds) {
        if (!sim) return;
        const steps = Math.round(seconds / SIM_DT);
        for (let i = 0; i < steps && mode === 'playing'; i++) {
          if (autoplay && i % 30 === 0) autoplay.act();
          sim.step();
          const events = sim.drainEvents();
          if (events.length > 0) {
            stage.handleEvents(events);
            ui.handleEvents(events);
            onEvents(events);
          }
        }
      },
    },
  };
}
