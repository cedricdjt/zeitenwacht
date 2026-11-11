// @ts-check
// Besondere Bauplätze in der Simulation (docs/briefs/fusion.md, Abschnitt 6; docs/SIM.md, „Besondere Bauplätze“):
// Auskunft, Werte, Preise, Erstattung, Verschmelzen, Speichern und Laden, Prüfung der Inhalte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rules from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { addFusion, addTiles, makeContent } from './fixtures/content.mjs';
import { makeSim, mustBuild, near, stepUntil } from './fixtures/harness.mjs';

/** @import { Content } from '../src/types/content' */
/** @import { Sim, Tower } from '../src/types/sim' */

/**
 * Partie auf der Karte `bend` mit Bauplätzen: high (2, 3), well (5, 3), mud (5, 4) und (6, 4).
 * @param {(content: Content) => void} [edit]
 * @returns {Sim}
 */
function tileSim(edit) {
  return makeSim({ mapId: 'bend', edit: (content) => {
    addTiles(addFusion(content));
    if (edit) edit(content);
  } });
}

/**
 * Baut einen Turm aus und wählt auf Stufe 3 den Zweig 0.
 * @param {Sim} sim
 * @param {Tower} tower
 */
function maxOut(sim, tower) {
  while (tower.level < 3) assert.deepEqual(sim.upgrade(tower.id, 0), { ok: true });
}

/**
 * Wellen ohne Gegner, damit Zeitalter schnell wechseln.
 * @param {Content} content
 */
function emptyWaves(content) {
  content.waves = content.ages.map(() => [{ groups: /** @type {import('../src/types/content').SpawnGroup[]} */ ([]) }]);
}

/**
 * Bringt eine Partie über die nächste Welle bis in die nächste freie Bauphase.
 * @param {Sim} sim
 */
function passWave(sim) {
  stepUntil(sim, () => sim.state.lock === 0);
  assert.deepEqual(sim.startWave(), { ok: true });
  stepUntil(sim, () => sim.state.phase !== 'wave');
  stepUntil(sim, () => sim.state.lock === 0);
}

test('tileAt nennt die Art je Feld, sonst einen leeren Text, auch außerhalb des Spielfelds', () => {
  const sim = tileSim();
  assert.equal(sim.tileAt(2, 3), 'high');
  assert.equal(sim.tileAt(5, 3), 'well');
  assert.equal(sim.tileAt(5, 4), 'mud');
  assert.equal(sim.tileAt(6, 4), 'mud');
  assert.equal(sim.tileAt(0, 2), '');
  assert.equal(sim.tileAt(-1, 3), '');
  assert.equal(sim.tileAt(12, 3), '');
  assert.equal(sim.tileAt(2.5, 3), '');
  // Ohne besondere Felder (Testinhalte ohne addTiles) gibt es keine.
  const plain = makeSim({ mapId: 'bend' });
  for (let tz = 0; tz < 7; tz++) for (let tx = 0; tx < 12; tx++) assert.equal(plain.tileAt(tx, tz), '');
});

test('Bau auf einem besonderen Feld: tile gesetzt, Werte mit Wirkung, Preis mit Faktor; canBuild bleibt unberührt', () => {
  const sim = tileSim();
  assert.deepEqual(sim.canBuild(5, 4), { ok: true });
  assert.equal(sim.buildCost('shooter'), 50);
  assert.equal(sim.buildCost('shooter', 5, 4), 75);
  assert.equal(sim.buildCost('shooter', 2, 3), 50);
  assert.equal(sim.buildCost('nobody', 5, 4), -1);
  sim.state.gold = 1000;
  const high = mustBuild(sim, 'shooter', 2, 3);
  assert.equal(high.tile, 'high');
  near(high.stats.range, 4.5);
  const well = mustBuild(sim, 'shooter', 5, 3);
  near(well.stats.damage, 30);
  const plain = mustBuild(sim, 'shooter', 0, 3);
  assert.equal(plain.tile, '');
  assert.deepEqual(plain.stats, rules.towerStats(sim.content, plain.arch, 0, 1));
  const gold = sim.state.gold;
  const mud = mustBuild(sim, 'shooter', 5, 4);
  assert.equal(mud.tile, 'mud');
  assert.equal(gold - sim.state.gold, 75);
  assert.equal(mud.invested, 75);
  assert.deepEqual(mud.stats, plain.stats);
  // Zu wenig Gold für den Aufschlag: abgelehnt, obwohl der Grundpreis reichen würde.
  sim.state.gold = 70;
  assert.deepEqual(sim.build('shooter', 6, 4), { ok: false, reason: 'gold' });
  assert.deepEqual(sim.build('shooter', 0, 4), { ok: true });
});

test('Ausbau und Verkauf auf dem Matsch: invested ist, was bezahlt wurde; der Verkauf gibt nie mehr zurück', () => {
  const sim = tileSim();
  sim.state.gold = 1000;
  const tower = mustBuild(sim, 'shooter', 5, 4);
  assert.equal(sim.upgradeCost(tower), 90);
  maxOut(sim, tower);
  assert.equal(tower.invested, 75 + 90 + 135);
  assert.equal(sim.state.gold, 1000 - 300);
  assert.equal(sim.state.stats.goldSpent, 300);
  // Vor der ersten Welle: volle Erstattung des Bezahlten.
  assert.equal(sim.sellValue(tower), 300);
  assert.deepEqual(sim.startWave(), { ok: true });
  assert.equal(sim.sellValue(tower), 225);
  const before = sim.state.gold;
  assert.deepEqual(sim.sell(tower.id), { ok: true });
  assert.equal(sim.state.gold - before, 225);
  // Das Feld bleibt Matsch: Ein neuer Turm dort kostet wieder den Aufschlag.
  assert.equal(sim.tileAt(5, 4), 'mud');
  assert.equal(sim.buildCost('shooter', 5, 4), 75);
});

test('Modernisieren auf dem Matsch kostet den Faktor mehr, die Wirkung des Feldes bleibt im neuen Zeitalter', () => {
  const sim = tileSim(emptyWaves);
  const mud = mustBuild(sim, 'shooter', 5, 4);
  const high = mustBuild(sim, 'shooter', 2, 3);
  passWave(sim);
  assert.equal(sim.state.age, 1);
  sim.state.gold = 1000;
  // Rom, Stufe 1: round5(90 * 0,45) = 40, auf Matsch 60.
  assert.equal(sim.modernizeCost(high), 40);
  assert.equal(sim.modernizeCost(mud), 60);
  assert.deepEqual(sim.modernize(mud.id), { ok: true });
  assert.equal(sim.state.gold, 940);
  assert.equal(mud.invested, 75 + 60);
  assert.deepEqual(sim.modernize(high.id), { ok: true });
  near(high.stats.range, rules.towerStats(sim.content, high.arch, 1, 1).range * 1.5);
  // Neubau in Rom auf Matsch: round5(90 * 1,5) = 135.
  assert.equal(sim.buildCost('shooter', 6, 4), 135);
});

test('Superwaffe auf einem besonderen Feld: Der Kern behält sein Feld, Gebühr mit dessen Faktor, Zutaten-Felder werden frei', () => {
  const sim = tileSim();
  sim.state.gold = 5000;
  // Kern auf der Quelle (5, 3), Zutaten auf dem Matsch (5, 4) und (6, 4).
  const core = mustBuild(sim, 'shooter', 5, 3);
  const a = mustBuild(sim, 'thrower', 5, 4);
  const b = mustBuild(sim, 'burner', 6, 4);
  for (const tower of [core, a, b]) maxOut(sim, tower);
  assert.equal(a.invested, rules.towerValue(sim.content, a.arch, 0, 3) * 1.5);
  assert.equal(sim.fuseCost(core), 25, 'Quelle ohne Aufschlag');
  const paid = core.invested + a.invested + b.invested;
  const gold = sim.state.gold;
  assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
  assert.equal(gold - sim.state.gold, 25);
  assert.equal(core.invested, paid + 25);
  assert.equal(core.tile, 'well');
  const fused = rules.towerStats(sim.content, core.arch, 0, 3, { ...core, tile: '' });
  near(core.stats.damage, 2 * fused.damage + 10);
  assert.deepEqual(core.stats, rules.towerStats(sim.content, core.arch, 0, 3, core));
  // Die Felder der Zutaten sind frei und bleiben Matsch.
  assert.equal(sim.towerAt(5, 4), null);
  assert.deepEqual(sim.canBuild(6, 4), { ok: true });
  assert.equal(sim.tileAt(6, 4), 'mud');
  // Ein Kern auf dem Matsch zahlt die Gebühr mit Aufschlag, auch die der Megawaffe.
  const mudCore = mustBuild(sim, 'shooter', 6, 4);
  const c = mustBuild(sim, 'shooter', 7, 3);
  const d = mustBuild(sim, 'shooter', 7, 4);
  for (const tower of [mudCore, c, d]) maxOut(sim, tower);
  assert.equal(sim.fuseCost(mudCore), 40);
  const before = sim.state.gold;
  assert.deepEqual(sim.fuse(mudCore.id, [c.id, d.id]), { ok: true });
  assert.equal(before - sim.state.gold, 40);
  assert.equal(sim.fuseCost(mudCore), 75);
  // Verkauf vor der ersten Welle: alles Bezahlte, nicht mehr.
  assert.equal(sim.sellValue(mudCore), mudCore.invested);
});

test('Speichern und Laden: Das Feld folgt aus der Lage, Werte und Verlauf gleichen sich genau', () => {
  const sim = tileSim((content) => {
    content.waves[0][0] = { groups: [{ enemy: 'grunt', count: 8, interval: 0.7, delay: 0 }] };
  });
  sim.state.gold = 2000;
  const high = mustBuild(sim, 'shooter', 2, 3);
  const mud = mustBuild(sim, 'shooter', 5, 4);
  mustBuild(sim, 'burner', 5, 3);
  maxOut(sim, mud);
  const data = sim.save();
  assert.ok(data);
  for (const entry of data.towers) assert.equal(Object.prototype.hasOwnProperty.call(entry, 'tile'), false, 'tile steht nicht im Spielstand');
  const loaded = createSim(sim.config, JSON.parse(JSON.stringify(data)));
  const highAgain = /** @type {Tower} */ (loaded.towerAt(2, 3));
  const mudAgain = /** @type {Tower} */ (loaded.towerAt(5, 4));
  assert.equal(highAgain.tile, 'high');
  assert.equal(mudAgain.tile, 'mud');
  assert.deepEqual(highAgain.stats, high.stats);
  assert.deepEqual(mudAgain.stats, mud.stats);
  assert.equal(mudAgain.invested, mud.invested);
  assert.equal(loaded.upgradeCost(highAgain), sim.upgradeCost(high));
  assert.deepEqual(loaded.save(), sim.save());
  // Gleicher Verlauf über eine ganze Welle.
  for (const game of [sim, loaded]) {
    assert.deepEqual(game.startWave(), { ok: true });
    stepUntil(game, () => game.state.phase !== 'wave');
  }
  assert.deepEqual(loaded.save(), sim.save());
  assert.equal(loaded.state.towers.map((t) => t.damageDealt).join(), sim.state.towers.map((t) => t.damageDealt).join());
});

test('Inhalte ohne besondere Felder bleiben gültig, auch ganz ohne balance.tiles', () => {
  const content = makeContent();
  delete (/** @type {Partial<Content['balance']>} */ (content.balance)).tiles;
  const sim = createSim({ content, mapId: 'bend', difficulty: 'normal', seed: 1 });
  assert.equal(sim.tileAt(2, 3), '');
  const tower = mustBuild(sim, 'shooter', 2, 3);
  assert.equal(tower.tile, '');
  assert.equal(tower.invested, 50);
});

test('Prüfung der Inhalte: besondere Felder nur im Spielfeld, nicht auf Weg oder Sperre, einmalig, bekannte Art', () => {
  /**
   * @param {(content: Content) => void} edit
   * @param {string} mapId
   * @param {RegExp} message
   */
  const refuse = (edit, mapId, message) => {
    const content = addTiles(makeContent());
    edit(content);
    assert.throws(() => createSim({ content, mapId, difficulty: 'normal', seed: 1 }), message);
  };
  /** @param {Content} content @param {string} id */
  const map = (content, id) => /** @type {import('../src/types/content').MapDef} */ (content.maps.find((m) => m.id === id));
  /** @param {{ tx: number, tz: number, kind: string }[]} tiles @returns {(content: Content) => void} */
  const onBend = (tiles) => (content) => {
    map(content, 'bend').tiles = tiles;
  };
  refuse(onBend([{ tx: 4, tz: 3, kind: 'high' }]), 'bend', /\(4, 3\) liegt auf dem Weg/);
  refuse(onBend([{ tx: 6, tz: 3, kind: 'high' }]), 'bend', /\(6, 3\) liegt auf einem gesperrten Feld/);
  refuse(onBend([{ tx: 12, tz: 3, kind: 'high' }]), 'bend', /außerhalb des Spielfelds/);
  refuse(onBend([{ tx: 2, tz: -1, kind: 'high' }]), 'bend', /außerhalb des Spielfelds/);
  refuse(onBend([{ tx: 2, tz: 3, kind: 'high' }, { tx: 2, tz: 3, kind: 'well' }]), 'bend', /\(2, 3\) ist doppelt genannt/);
  refuse(onBend([{ tx: 2, tz: 3, kind: 'lava' }]), 'bend', /unbekannte Art "lava" \(bekannt: high, well, mud\)/);
  refuse(onBend([{ tx: 2.5, tz: 3, kind: 'high' }]), 'bend', /kein Feld \{ tx, tz, kind \}/);
  refuse((content) => {
    /** @type {any} */ (map(content, 'bend')).tiles = { tx: 2, tz: 3, kind: 'high' };
  }, 'bend', /tiles muss eine Liste/);
  // Der Platz der Basis im Spielfeld ist gesperrt (Burghof: Basis auf (8, 3)).
  refuse((content) => {
    map(content, 'keep').tiles = [{ tx: 7, tz: 2, kind: 'well' }];
  }, 'keep', /\(7, 2\) liegt auf einem gesperrten Feld \(Platz der Basis\)/);
  // Eine Karte mit Feldern braucht balance.tiles.
  refuse((content) => {
    delete (/** @type {Partial<Content['balance']>} */ (content.balance)).tiles;
  }, 'bend', /unbekannte Art "high" \(bekannt: keine, balance\.tiles fehlt\)/);
  // Die Arten selbst.
  refuse((content) => {
    content.balance.tiles.high.mod = { set: { range: 9 } };
  }, 'straight', /balance\.tiles\.high\.mod: set ist auf besonderen Bauplätzen nicht erlaubt/);
  refuse((content) => {
    content.balance.tiles.mud.cost = 0;
  }, 'straight', /balance\.tiles\.mud: cost muss eine Zahl größer als 0 sein/);
  refuse((content) => {
    content.balance.tiles.mud.name = '';
  }, 'straight', /balance\.tiles\.mud: name fehlt/);
  refuse((content) => {
    content.balance.tiles.well.mod = /** @type {any} */ ({ mul: { wucht: 2 } });
  }, 'straight', /balance\.tiles\.well\.mod\.mul: "wucht" ist kein Zahlenfeld/);
  refuse((content) => {
    /** @type {any} */ (content.balance).tiles = [];
  }, 'straight', /balance\.tiles muss ein Objekt sein/);
  // Gültig: die Felder aus addTiles.
  assert.doesNotThrow(() => createSim({ content: addTiles(makeContent()), mapId: 'bend', difficulty: 'normal', seed: 1 }));
});
