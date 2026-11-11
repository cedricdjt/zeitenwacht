// Prüft die Weggeometrie.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CORNER_RADIUS, buildPath, pathTiles, samplePath, tileX, tileZ } from '../src/sim/path.js';

const W = 18;
const H = 12;
const WAYPOINTS = /** @type {[number, number][]} */ ([[-1, 2], [5, 2], [5, 8], [10, 8], [10, 3], [14, 3], [14, 9], [17, 9]]);

test('pathTiles liefert jedes Feld genau einmal in Laufrichtung', () => {
  const tiles = pathTiles(WAYPOINTS);
  assert.deepEqual(tiles[0], [-1, 2]);
  assert.deepEqual(tiles[tiles.length - 1], [17, 9]);
  assert.equal(new Set(tiles.map((t) => t.join(','))).size, tiles.length);
  for (let i = 1; i < tiles.length; i++) {
    assert.equal(Math.abs(tiles[i][0] - tiles[i - 1][0]) + Math.abs(tiles[i][1] - tiles[i - 1][1]), 1);
  }
});

test('buildPath: Länge, Endpunkte und stetiger Verlauf', () => {
  const curve = buildPath(WAYPOINTS, W, H);
  const corners = WAYPOINTS.length - 2;
  const manhattan = pathTiles(WAYPOINTS).length - 1;
  const expected = manhattan - corners * (2 * CORNER_RADIUS - (Math.PI / 2) * CORNER_RADIUS);
  assert.ok(Math.abs(curve.length - expected) < 0.01, `Länge ${curve.length} statt ${expected}`);
  const out = { x: 0, z: 0, dx: 0, dz: 0 };
  samplePath(curve, 0, out);
  assert.ok(Math.abs(out.x - tileX(-1, W)) < 1e-6 && Math.abs(out.z - tileZ(2, H)) < 1e-6);
  samplePath(curve, curve.length + 5, out);
  assert.ok(Math.abs(out.x - tileX(17, W)) < 1e-6 && Math.abs(out.z - tileZ(9, H)) < 1e-6);
  let px = NaN;
  let pz = NaN;
  for (let d = 0; d <= curve.length; d += 0.05) {
    samplePath(curve, d, out);
    assert.ok(Math.abs(Math.hypot(out.dx, out.dz) - 1) < 1e-6, 'Richtung ist kein Einheitsvektor');
    if (!Number.isNaN(px)) {
      const step = Math.hypot(out.x - px, out.z - pz);
      assert.ok(step < 0.0501 && step > 0.045, `Schrittweite ${step} bei d=${d}`);
    }
    px = out.x;
    pz = out.z;
  }
});

test('buildPath: die Kurve bleibt innerhalb der Wegfelder', () => {
  const curve = buildPath(WAYPOINTS, W, H);
  const tiles = new Set(pathTiles(WAYPOINTS).map((t) => t.join(',')));
  const out = { x: 0, z: 0, dx: 0, dz: 0 };
  for (let d = 0; d <= curve.length; d += 0.02) {
    samplePath(curve, d, out);
    const key = `${Math.floor(out.x + W / 2)},${Math.floor(out.z + H / 2)}`;
    assert.ok(tiles.has(key), `Punkt bei d=${d.toFixed(2)} liegt auf Feld ${key} außerhalb des Weges`);
  }
});

test('ungültige Wege werden abgelehnt', () => {
  assert.throws(() => pathTiles([[0, 0]]));
  assert.throws(() => pathTiles([[0, 0], [2, 3]]));
  assert.throws(() => pathTiles([[0, 0], [0, 0]]));
  assert.throws(() => buildPath([[0, 0], [4, 0], [2, 0]], W, H));
});
