// @ts-check
// Die Bühne: setzt Welt, Figuren und Effekte zu einem Bild zusammen und erfüllt nach außen den Vertrag `Stage`.

import * as THREE from 'three';
import { CameraRig } from './camera.js';
import { createEffectLayer } from './effects.js';
import { createEntityLayer } from './entities.js';
import { CAMERA_FOV } from './layout.js';
import { configureRenderer, createMaterials } from './look.js';
import { PostFx } from './post.js';
import { createThumbnailer } from './thumbnails.js';
import { createWorld } from './world.js';

/** @import { Quality, Settings, Stage, StageCallbacks } from '../types/app' */
/** @import { Content } from '../types/content' */
/** @import { RenderEnv, StageExtras } from '../types/render' */
/** @import { Sim, SimEvent } from '../types/sim' */

/** Sekunden, die die Menükulisse in einem Zeitalter verweilt. */
const ATTRACT_AGE_TIME = 9;
/** Bildzeit in Millisekunden, ab der die automatische Grafikstufe eine Stufe heruntergeht. */
const SLOW_FRAME_MS = 26;

/**
 * Erzeugt die Bühne auf einer Leinwand.
 * @param {HTMLCanvasElement} canvas
 * @param {Content} content
 * @param {StageCallbacks} callbacks
 * @returns {Stage & StageExtras}
 */
export function createStage(canvas, content, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  configureRenderer(renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1.6, 1, 700);
  /** @type {RenderEnv} */
  const env = { scene, camera, renderer, materials: createMaterials(), content };
  const world = createWorld(env);
  const entities = createEntityLayer(env);
  const effects = createEffectLayer(env, entities, world);
  const rig = new CameraRig(camera, canvas, callbacks);
  const thumbnailer = createThumbnailer();
  const projected = new THREE.Vector3();

  /** @type {Sim | null} */
  let sim = null;
  /** @type {PostFx | null} */
  let post = null;
  /** Gewünschte Stufe aus den Einstellungen und die tatsächlich aktive. @type {Quality | 'auto'} */
  let wanted = 'auto';
  /** @type {Quality} */
  let quality = 'high';
  let attract = false;
  let attractTime = 0;
  let attractAge = 0;
  let frames = 0;
  let fpsTime = 0;
  let slowTime = 0;
  let width = 0;
  let height = 0;
  /** @type {{ fps: number, drawCalls: number, triangles: number, quality: Quality }} */
  const info = { fps: 60, drawCalls: 0, triangles: 0, quality: 'high' };

  /** @param {Quality} q */
  function setQuality(q) {
    quality = q;
    info.quality = q;
    renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : q === 'medium' ? Math.min(window.devicePixelRatio, 1.5) : 1);
    renderer.shadowMap.enabled = q !== 'low';
    world.setQuality(q);
    entities.setQuality(q);
    effects.setQuality(q);
    if (q === 'high' && !post) post = new PostFx(renderer, scene, camera);
    if (q !== 'high' && post) {
      post.dispose();
      post = null;
    }
    width = 0; // erzwingt die Größenanpassung im nächsten Bild
  }

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (post) post.setSize(w, h, renderer.getPixelRatio());
    const map = sim ? sim.map : content.maps[0];
    rig.setHome(map.width, map.height);
  }

  /** Seit dem letzten Wechsel der Wege hat noch keine Welle begonnen: Das neue Stück leuchtet. */
  let freshPaths = false;

  /**
   * Wege, die sich wandeln: Vor dem Wechsel atmet das kommende Stück ruhig (ab der Bauphase vor der letzten Welle des
   * Zeitalters), danach pulsiert das neue, bis die erste Welle darauf beginnt.
   */
  function updatePathHint() {
    if (!sim || sim.pathStages.length < 2) {
      world.setPathHint(null);
      return;
    }
    const s = sim.state;
    const now = sim.pathStage();
    if (freshPaths && s.phase === 'build') {
      world.setPathHint({ stage: now, kind: 'new' });
      return;
    }
    const next = s.phase === 'build' || s.phase === 'wave' ? sim.wavePreview(1) : null;
    if (next && next.stage !== now) world.setPathHint({ stage: next.stage, kind: 'coming' });
    else world.setPathHint(null);
  }

  /** Zeigt die Luftlinien, wenn die anstehende oder laufende Welle Flieger enthält. */
  function updateFlightLines() {
    if (!sim) {
      world.setFlightLines(false);
      return;
    }
    const preview = sim.wavePreview(0);
    world.setFlightLines(Boolean(preview && preview.groups.some((g) => g.def.flying)));
  }

  /** @type {Stage & StageExtras} */
  const stage = {
    load(newSim) {
      sim = newSim;
      attract = false;
      rig.setAttract(false);
      world.build(sim.map, sim.state.age);
      entities.bind(sim);
      effects.bind(sim);
      for (const tower of sim.state.towers) world.setTileOccupied(tower.tx, tower.tz, true);
      world.setFlame(sim.state.lives / sim.state.maxLives);
      world.setGridVisible(false);
      updateFlightLines();
      freshPaths = false;
      updatePathHint();
      width = 0;
      resize();
      rig.setInteractive(true);
      rig.intro();
    },

    unload() {
      sim = null;
      entities.bind(null);
      effects.bind(null);
      world.setFlightLines(false);
      world.setGridVisible(false);
      world.setPathHint(null);
      world.highlightSpecialTile(null);
    },

    showAttract() {
      stage.unload();
      attract = true;
      attractTime = 0;
      attractAge = 0;
      world.build(content.maps[0], 0);
      world.setFlame(1);
      width = 0;
      resize();
      rig.setAttract(true);
    },

    handleEvents(events) {
      entities.handleEvents(events);
      effects.handleEvents(events);
      if (!sim) return;
      for (let i = 0; i < events.length; i++) {
        const e = /** @type {SimEvent} */ (events[i]);
        switch (e.type) {
          case 'age':
            world.transitionTo(e.to, { x: world.base.x, z: world.base.z });
            break;
          case 'paths':
            freshPaths = true;
            updatePathHint();
            updateFlightLines();
            break;
          case 'leak':
            world.hitBase();
            world.setFlame(sim.state.lives / sim.state.maxLives);
            break;
          case 'build':
            world.setTileOccupied(e.tower.tx, e.tower.tz, true);
            break;
          case 'sell':
            world.setTileOccupied(e.tower.tx, e.tower.tz, false);
            break;
          case 'waveStart':
            freshPaths = false;
            updateFlightLines();
            updatePathHint();
            break;
          case 'waveClear':
            updateFlightLines();
            updatePathHint();
            break;
          default:
        }
      }
    },

    render(dt, simDt, alpha) {
      resize();
      if (attract) {
        attractTime += dt;
        if (attractTime >= ATTRACT_AGE_TIME) {
          attractTime = 0;
          attractAge = (attractAge + 1) % content.ages.length;
          world.transitionTo(attractAge, { x: world.base.x, z: world.base.z });
        }
      }
      rig.update(dt);
      world.update(dt);
      entities.update(dt, simDt, alpha);
      effects.update(dt, simDt, alpha);
      renderer.toneMappingExposure = world.exposure;
      camera.position.add(effects.shake);
      camera.updateMatrixWorld();
      if (post) {
        post.setBloom(world.bloom);
        post.render(dt);
      } else {
        renderer.render(scene, camera);
      }
      camera.position.sub(effects.shake);
      info.drawCalls = renderer.info.render.calls;
      info.triangles = renderer.info.render.triangles;

      // Bildrate messen; bei "Automatisch" eine Stufe heruntergehen, wenn es dauerhaft ruckelt.
      frames++;
      fpsTime += dt;
      if (fpsTime >= 1) {
        info.fps = Math.round(frames / fpsTime);
        const frameMs = (fpsTime / frames) * 1000;
        frames = 0;
        fpsTime = 0;
        slowTime = frameMs > SLOW_FRAME_MS ? slowTime + 1 : 0;
        if (wanted === 'auto' && slowTime >= 4 && quality !== 'low') {
          slowTime = 0;
          setQuality(quality === 'high' ? 'medium' : 'low');
        }
      }
    },

    resize() {
      width = 0;
      resize();
    },

    applySettings(settings) {
      const next = /** @type {Settings} */ (settings).quality;
      if (next !== wanted) {
        wanted = next;
        slowTime = 0;
        setQuality(next === 'auto' ? 'high' : next);
      }
      effects.applySettings(settings);
    },

    setBuildPreview(preview) {
      entities.setBuildPreview(preview);
    },
    setSelectedTower(tower) {
      entities.setSelectedTower(tower);
    },
    setAbilityCursor(cursor) {
      entities.setAbilityCursor(cursor);
    },
    setGridVisible(visible) {
      world.setGridVisible(visible);
    },
    highlightSpecialTile(tile) {
      world.highlightSpecialTile(tile);
    },

    project(x, y, z, out) {
      projected.set(x, y, z).project(camera);
      out.x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      out.y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      out.visible = projected.z > -1 && projected.z < 1;
    },

    thumbnail(modelId, opts) {
      // `opts.look` (Erkennungszeichen einer Waffe) reicht die Oberfläche über die Spielsteuerung durch.
      return thumbnailer.render(modelId, /** @type {import('./thumbnails.js').ThumbnailOptions | undefined} */ (opts));
    },

    resetCamera() {
      rig.reset();
    },

    get info() {
      return info;
    },

    dispose() {
      rig.dispose();
      effects.dispose();
      entities.dispose();
      world.dispose();
      thumbnailer.dispose();
      if (post) post.dispose();
      renderer.dispose();
    },
  };

  setQuality('high');
  resize();
  return stage;
}
