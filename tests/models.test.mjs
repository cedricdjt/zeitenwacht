// Prüft alle 3D-Modelle ohne Browser: Aufbau, Größe, Dreieckszahl und Animation.
// Aufruf: node --test tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getModel, listModelIds } from '../src/content/models.js';
import { computePartMatrices, makeAnimCtx, makePose } from '../src/render/instances.js';
import { Matrix4 } from 'three';

/** Grenzen je Modellart (erste Stelle der Kennung). */
const LIMITS = {
  tower: { triangles: 2600, halfWidth: 0.56, maxHeight: 2.7 },
  enemy: { triangles: 1500, halfWidth: 0.62, maxHeight: 1.5 },
  boss: { triangles: 3200, halfWidth: 1.2, maxHeight: 2.6 },
  prop: { triangles: 1400, halfWidth: 1.6, maxHeight: 3.2 },
  base: { triangles: 4500, halfWidth: 1.6, maxHeight: 3.6 },
  example: { triangles: 2600, halfWidth: 0.7, maxHeight: 2.7 },
  fx: { triangles: 1500, halfWidth: 2, maxHeight: 4 },
  shot: { triangles: 220, halfWidth: 0.6, maxHeight: 0.6 },
};

/** Stichproben für den Animationskontext. */
function sampleContexts() {
  const list = [];
  for (const t of [0, 0.37, 1.9, 12.5]) {
    for (const fire of [0, 0.5, 1]) {
      for (const level of [1, 2, 3]) {
        const ctx = makeAnimCtx();
        Object.assign(ctx, { t, seed: (t * 0.31) % 1, walk: t * 7, move: t === 0 ? 0 : 1, hp: 1 - fire * 0.6, hurt: fire, aimYaw: t - 2, aimPitch: fire * 0.4 - 0.2, fire, charge: 1 - fire, active: fire > 0 ? 1 : 0, level });
        list.push(ctx);
      }
    }
  }
  return list;
}

const ids = listModelIds();
assert.ok(ids.length > 0, 'keine Modelle registriert');

for (const id of ids) {
  test(`Modell ${id}`, () => {
    const spec = getModel(id);
    const kind = id.split('.')[0];
    const limit = LIMITS[/** @type {keyof typeof LIMITS} */ (kind)];
    assert.ok(limit, `unbekannte Modellart "${kind}" (erlaubt: ${Object.keys(LIMITS).join(', ')})`);

    assert.equal(spec.id, id);
    assert.ok(spec.triangles > 0 && spec.triangles <= limit.triangles, `${spec.triangles} Dreiecke, erlaubt sind höchstens ${limit.triangles}`);
    const { min, max } = spec.bounds;
    if (kind !== 'shot' && kind !== 'fx') assert.ok(min[1] >= -0.12, `Modell reicht ${(-min[1]).toFixed(2)} unter den Boden (erlaubt 0.12)`);
    assert.ok(max[1] <= limit.maxHeight, `Höhe ${max[1].toFixed(2)} über dem Limit ${limit.maxHeight}`);
    const half = Math.max(-min[0], max[0], -min[2], max[2]);
    assert.ok(half <= limit.halfWidth, `halbe Breite ${half.toFixed(2)} über dem Limit ${limit.halfWidth}`);

    // Teile: eindeutige Namen, Eltern vor Kindern, Geometrie mit Farben.
    const names = new Set();
    spec.parts.forEach((part, index) => {
      assert.ok(!names.has(part.name), `Teilname doppelt: ${part.name}`);
      names.add(part.name);
      assert.ok(part.parent < index, `Elternteil von ${part.name} muss vorher stehen`);
      for (const g of [part.geometry, part.glowGeometry]) {
        if (!g) continue;
        assert.ok(g.getAttribute('color'), `Teil ${part.name} ohne Vertexfarben`);
        assert.equal(g.index, null, `Teil ${part.name} ist indiziert`);
      }
    });

    // Animation: läuft für alle Stichproben, greift nur auf vorhandene Teile zu, liefert endliche Werte.
    const { pose, nodes } = makePose(spec);
    const guarded = new Proxy(pose, {
      get(target, key) {
        if (typeof key === 'string' && !(key in target)) return undefined;
        return target[/** @type {string} */ (key)];
      },
    });
    const root = new Matrix4();
    const out = spec.parts.map(() => new Matrix4());
    for (const ctx of sampleContexts()) {
      computePartMatrices(spec, guarded, nodes, root, ctx, out);
      for (let i = 0; i < out.length; i++) {
        for (const value of out[i].elements) assert.ok(Number.isFinite(value), `Animation erzeugt ungültige Werte in Teil ${spec.parts[i].name}`);
      }
    }
  });
}
