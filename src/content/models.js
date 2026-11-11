// @ts-check
// Verzeichnis aller 3D-Modelle. Modelle werden erst beim ersten Zugriff gebaut und dann wiederverwendet.
// Fehlt ein Modell, liefert getModel() einen schlichten Platzhalter, statt das Spiel anzuhalten.

import { createModel } from '../render/kit.js';
import { models as exampleModels } from './examples.js';
import { models as steinzeitTowers } from './models/steinzeit/towers.js';
import { models as steinzeitEnemies } from './models/steinzeit/enemies.js';
import { models as steinzeitProps } from './models/steinzeit/props.js';
import { models as romTowers } from './models/rom/towers.js';
import { models as romEnemies } from './models/rom/enemies.js';
import { models as romProps } from './models/rom/props.js';
import { models as mittelalterTowers } from './models/mittelalter/towers.js';
import { models as mittelalterEnemies } from './models/mittelalter/enemies.js';
import { models as mittelalterProps } from './models/mittelalter/props.js';
import { models as entdeckerTowers } from './models/entdecker/towers.js';
import { models as entdeckerEnemies } from './models/entdecker/enemies.js';
import { models as entdeckerProps } from './models/entdecker/props.js';
import { models as industrieTowers } from './models/industrie/towers.js';
import { models as industrieEnemies } from './models/industrie/enemies.js';
import { models as industrieProps } from './models/industrie/props.js';
import { models as zukunftTowers } from './models/zukunft/towers.js';
import { models as zukunftEnemies } from './models/zukunft/enemies.js';
import { models as zukunftProps } from './models/zukunft/props.js';
import { models as fxModels } from './models/fx.js';
import { models as shotModels } from './models/shots.js';

/** @import { ModelFactory, ModelSpec } from '../types/model' */

/** @type {Record<string, ModelFactory>} */
const FACTORIES = {
  ...exampleModels,
  ...shotModels,
  ...fxModels,
  ...steinzeitTowers,
  ...steinzeitEnemies,
  ...steinzeitProps,
  ...romTowers,
  ...romEnemies,
  ...romProps,
  ...mittelalterTowers,
  ...mittelalterEnemies,
  ...mittelalterProps,
  ...entdeckerTowers,
  ...entdeckerEnemies,
  ...entdeckerProps,
  ...industrieTowers,
  ...industrieEnemies,
  ...industrieProps,
  ...zukunftTowers,
  ...zukunftEnemies,
  ...zukunftProps,
};

/** @type {Map<string, ModelSpec>} */
const cache = new Map();
/** @type {Set<string>} */
const warned = new Set();

/**
 * Registriert weitere Modelle (z. B. die eines Zeitalters).
 * @param {Record<string, ModelFactory>} factories
 */
export function registerModels(factories) {
  for (const [id, factory] of Object.entries(factories)) {
    if (FACTORIES[id] && FACTORIES[id] !== factory) throw new Error(`Modell-Kennung doppelt vergeben: ${id}`);
    FACTORIES[id] = factory;
  }
}

/**
 * Ob das Modell wirklich vorhanden ist (kein Platzhalter).
 * @param {string} id
 * @returns {boolean}
 */
export function hasModel(id) {
  return Object.prototype.hasOwnProperty.call(FACTORIES, id);
}

/**
 * Schlichter Platzhalter in passender Größe für ein fehlendes Modell.
 * @param {string} id
 * @returns {ModelSpec}
 */
function buildPlaceholder(id) {
  const kind = id.split('.')[0];
  const m = createModel(id);
  const body = m.part('body');
  const c = '#c7b8d8';
  const c2 = '#8f7fae';
  switch (kind) {
    case 'tower': {
      body.cyl({ r: 0.36, rTop: 0.3, h: 0.5, seg: 6, base: [0, 0, 0], color: c2 });
      const top = m.part('top', { pivot: [0, 0.5, 0] });
      top.box({ size: [0.34, 0.3, 0.34], base: [0, 0.5, 0], color: c });
      top.box({ size: [0.1, 0.1, 0.4], at: [0, 0.68, 0.25], color: c2 });
      m.point('muzzle', [0, 0.68, 0.45], 'top');
      return m.build({
        animate(pose, ctx) {
          pose.top.rotation.y = ctx.aimYaw;
          pose.top.position.z = -ctx.fire * 0.05;
        },
      });
    }
    case 'enemy':
    case 'boss': {
      const s = kind === 'boss' ? 2.2 : 1;
      body.box({ size: [0.26 * s, 0.3 * s, 0.22 * s], base: [0, 0.08 * s, 0], color: c2 });
      body.sphere({ r: 0.11 * s, at: [0, 0.48 * s, 0.02 * s], color: c });
      body.box({ size: [0.16 * s, 0.03 * s, 0.03 * s], at: [0, 0.5 * s, 0.11 * s], color: '#2a2420' });
      return m.build({
        animate(pose, ctx) {
          pose.body.position.y = Math.abs(Math.sin(ctx.walk)) * 0.04 * Math.min(1, ctx.move);
        },
      });
    }
    case 'base':
      body.box({ size: [1.4, 0.8, 1.4], base: [0, 0, 0], color: c2 });
      body.pyramid({ size: [1.6, 0.7, 1.6], base: [0, 0.8, 0], color: c });
      return m.build();
    case 'shot':
      body.sphere({ r: 0.06, detail: 0, at: [0, 0, 0], color: '#5b4e43' });
      return m.build();
    default:
      body.sphere({ r: 0.2, detail: 0, at: [0, 0.14, 0], scale: [1, 0.7, 1], color: c, faceJitter: 0.08 });
      return m.build();
  }
}

/**
 * Liefert das gebaute Modell; für unbekannte Kennungen einen Platzhalter (mit einmaliger Warnung).
 * @param {string} id
 * @returns {ModelSpec}
 */
export function getModel(id) {
  let spec = cache.get(id);
  if (!spec) {
    const factory = FACTORIES[id];
    if (factory) {
      spec = factory();
      if (spec.id !== id) throw new Error(`Modell ${id} wurde mit der abweichenden Kennung ${spec.id} gebaut`);
    } else {
      if (!warned.has(id)) {
        warned.add(id);
        console.warn(`Modell fehlt, Platzhalter wird verwendet: ${id}`);
      }
      spec = buildPlaceholder(id);
    }
    cache.set(id, spec);
  }
  return spec;
}

/**
 * Alle registrierten Modell-Kennungen, optional gefiltert nach Anfang (z. B. 'tower.stone.').
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function listModelIds(prefix = '') {
  return Object.keys(FACTORIES).filter((id) => id.startsWith(prefix)).sort();
}
