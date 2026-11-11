// @ts-check
// Karten, die sich mit dem Zeitalter wandeln (docs/briefs/fusion.md, Abschnitt 7; docs/SIM.md, „Wege, die sich wandeln“):
// künftige Wegfelder, Wechsel beim Zeitalterwechsel, Erscheinen auf den neuen Wegen, Flugbahnen, Fähigkeit, Speichern und Laden,
// Prüfung der Inhalte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { samplePath, tileX, tileZ } from '../src/sim/path.js';
import { createSim } from '../src/sim/sim.js';
import { addStages, addTiles } from './fixtures/content.mjs';
import { addArch, digest, makeSim, mustBuild, near, ofType, snapshot, stepUntil } from './fixtures/harness.mjs';

/** @import { Content, SpawnGroup } from '../src/types/content' */
/** @import { Sim, SimEvent } from '../src/types/sim' */

/**
 * Partie auf der Karte `shift`.
 * @param {(content: Content) => void} [edit]
 * @param {number} [seed]
 * @returns {Sim}
 */
function stageSim(edit, seed = 1) {
  return makeSim({ mapId: 'shift', seed, edit: (content) => {
    addStages(content);
    if (edit) edit(content);
  } });
}

/**
 * Wellen ohne Gegner, damit Zeitalter schnell wechseln.
 * @param {Content} content
 */
function emptyWaves(content) {
  content.waves = content.ages.map(() => [{ groups: /** @type {SpawnGroup[]} */ ([]) }]);
}

/**
 * Startet die nächste Welle (wartet die Sperre ab) und rechnet bis zur nächsten Bauphase. Liefert alle Ereignisse.
 * @param {Sim} sim
 * @returns {SimEvent[]}
 */
function playWave(sim) {
  stepUntil(sim, () => sim.state.lock === 0);
  assert.deepEqual(sim.startWave(), { ok: true });
  /** @type {SimEvent[]} */
  const events = [];
  stepUntil(sim, () => {
    events.push(...sim.drainEvents());
    return sim.state.phase !== 'wave';
  });
  events.push(...sim.drainEvents());
  return events;
}

test('Ohne Stufen: eine Stufe 0, alle Wegfelder „path“, Vorschau mit Stufe 0', () => {
  const sim = makeSim({ mapId: 'bend' });
  assert.deepEqual(sim.pathStages, [0]);
  assert.equal(sim.pathStage(), 0);
  assert.deepEqual(sim.stagePaths(0), sim.paths);
  assert.deepEqual(sim.stagePaths(5), sim.paths);
  assert.deepEqual(sim.stageAirPaths(0), sim.airPaths);
  assert.deepEqual(sim.stagePaths(-1), []);
  assert.deepEqual(sim.stagePaths(0.5), []);
  assert.equal(sim.pathMark(4, 3), 'path');
  assert.equal(sim.pathMark(-1, 1), '');
  assert.equal(sim.pathMark(2, 3), '');
  assert.equal(sim.wavePreview()?.stage, 0);
});

test('Künftige Wege sind von Anfang an nicht bebaubar; Stufen jenseits der Zeitalter bleiben Bauland', () => {
  const sim = stageSim();
  assert.deepEqual(sim.pathStages, [0, 1, 2]);
  assert.equal(sim.pathStage(), 0);
  assert.equal(sim.paths.length, 1);
  assert.equal(sim.stagePaths(1).length, 2);
  assert.equal(sim.stagePaths(2).length, 1);
  assert.equal(sim.stagePaths(7), sim.stagePaths(2), 'jenseits der Partie gelten die Wege des letzten Zeitalters');
  assert.equal(sim.stageAirPaths(2)[0], sim.stagePaths(2)[0], 'Stufe 2: Flieger folgen dem Weg');
  assert.notEqual(sim.stageAirPaths(1)[1], sim.stagePaths(1)[1]);
  // (2, 5): unteres Tor ab Stufe 1; (8, 5): erst Stufe 2; (2, 1): jetzt Weg.
  assert.equal(sim.pathMark(2, 1), 'path');
  assert.equal(sim.pathMark(2, 5), 'future');
  assert.equal(sim.pathMark(8, 5), 'future');
  assert.equal(sim.pathMark(5, 6), '', 'Weg der nie erreichten Stufe 3');
  assert.deepEqual(sim.canBuild(2, 5), { ok: false, reason: 'path' });
  assert.deepEqual(sim.canBuild(9, 4), { ok: false, reason: 'path' });
  assert.deepEqual(sim.build('shooter', 8, 5), { ok: false, reason: 'path' });
  assert.deepEqual(sim.canBuild(5, 6), { ok: true });
  assert.deepEqual(sim.canBuild(11, 5), { ok: true });
  // Vorschau: Welle 0 läuft auf Stufe 0, die erste Welle des zweiten Zeitalters auf Stufe 1.
  const perAge = sim.content.waves[0].length;
  assert.equal(sim.wavePreview(0)?.stage, 0);
  assert.equal(sim.wavePreview(perAge)?.stage, 1);
  assert.equal(sim.wavePreview(2 * perAge)?.stage, 2);
});

test('Wechsel beim Zeitalterwechsel: Ereignis paths direkt nach age, dieselben Listen mit neuem Inhalt, Felder wandeln sich', () => {
  const sim = stageSim(emptyWaves);
  const paths = sim.paths;
  const airPaths = sim.airPaths;
  const first = playWave(sim);
  const types = first.map((event) => event.type);
  const at = types.indexOf('age');
  assert.ok(at >= 0);
  assert.equal(types[at + 1], 'paths');
  assert.deepEqual(ofType(first, 'paths'), [{ type: 'paths', stage: 1 }]);
  assert.equal(sim.paths, paths, 'Sim.paths bleibt dasselbe Objekt');
  assert.equal(sim.airPaths, airPaths);
  assert.equal(sim.pathStage(), 1);
  assert.deepEqual(sim.paths, sim.stagePaths(1));
  assert.deepEqual(sim.airPaths, sim.stageAirPaths(1));
  assert.equal(sim.pathMark(2, 5), 'path');
  assert.equal(sim.pathMark(8, 5), 'future');
  assert.equal(sim.pathMark(2, 1), 'path');

  const second = playWave(sim);
  assert.deepEqual(ofType(second, 'paths'), [{ type: 'paths', stage: 2 }]);
  assert.equal(sim.pathStage(), 2);
  assert.equal(sim.paths.length, 1);
  assert.equal(sim.airPaths[0], sim.paths[0]);
  assert.equal(sim.pathMark(2, 1), 'former');
  assert.equal(sim.pathMark(6, 2), 'former');
  assert.equal(sim.pathMark(2, 5), 'path');
  assert.equal(sim.pathMark(10, 3), 'path');
  assert.deepEqual(sim.canBuild(2, 1), { ok: false, reason: 'path' }, 'alter Weg bleibt unbebaubar');
  assert.equal(sim.state.phase, 'build');
  playWave(sim);
  assert.equal(sim.state.phase, 'won');
});

test('Eine Stufe ohne Wege trägt nur Text: kein Wechsel, kein Ereignis paths', () => {
  const sim = stageSim((content) => {
    emptyWaves(content);
    const stages = /** @type {NonNullable<import('../src/types/content').MapDef['stages']>} */ (content.maps[content.maps.length - 1].stages);
    stages[1] = { name: 'Ruhe', text: 'Nichts ändert sich.' };
  });
  assert.deepEqual(sim.pathStages, [0, 2]);
  assert.equal(sim.pathMark(3, 4), '', 'Arm der weggefallenen Stufe 1 ist frei');
  assert.equal(ofType(playWave(sim), 'paths').length, 0);
  assert.equal(sim.pathStage(), 0);
  assert.equal(sim.stagePaths(1), sim.stagePaths(0));
  assert.deepEqual(ofType(playWave(sim), 'paths'), [{ type: 'paths', stage: 2 }]);
});

test('Erscheinen reihum über die Wege der Stufe; Gruppen mit festem Weg; Flieger auf der Flugbahn der Stufe', () => {
  const sim = stageSim((content) => {
    content.waves[0] = [{ groups: [] }];
    content.waves[1] = [{ groups: [{ enemy: 'grunt', count: 4, interval: 0.1, delay: 0 }, { enemy: 'bird', count: 1, interval: 0, delay: 0, path: 1 }] }];
    content.waves[2] = [{ groups: [{ enemy: 'bird', count: 1, interval: 0, delay: 0 }] }];
  });
  playWave(sim);
  stepUntil(sim, () => sim.state.lock === 0);
  sim.startWave();
  stepUntil(sim, () => sim.state.pending === 0);
  const grunts = sim.state.enemies.filter((enemy) => enemy.def.id === 'grunt');
  assert.deepEqual(grunts.map((enemy) => enemy.path), [0, 1, 0, 1]);
  const bird = /** @type {import('../src/types/sim').Enemy} */ (sim.state.enemies.find((enemy) => enemy.def.id === 'bird'));
  assert.equal(bird.path, 1);
  // Der Vogel fliegt die Luftlinie vom unteren Tor zur Basis.
  const air = sim.stageAirPaths(1)[1];
  near(air.xs[0], tileX(-1, 12));
  near(air.zs[0], tileZ(5, 7));
  // Der Läufer auf Weg 1 läuft auf der Kurve des unteren Tores.
  const walker = grunts[1];
  const s = samplePath(sim.paths[1], walker.dist, { x: 0, z: 0, dx: 0, dz: 0 });
  near(walker.x, s.x - s.dz * walker.lane, 1e-9);
  near(walker.z, s.z + s.dx * walker.lane, 1e-9);
  // Ein fester Weg 1 im ersten Zeitalter (dort gibt es nur einen Weg) ist ein Inhaltsfehler.
  assert.throws(() => stageSim((content) => {
    content.waves[0][0].groups[0].path = 1;
  }), /Weg 1 gibt es auf dieser Karte nicht \(sie hat in diesem Zeitalter 1 Weg\)/);
});

test('Die Zeitglocke wirft auch auf den Wegen der neuen Stufe entlang der eigenen Kurve zurück', () => {
  const sim = stageSim((content) => {
    content.waves[0] = [{ groups: [] }];
    content.waves[1] = [{ groups: [{ enemy: 'grunt', count: 2, interval: 0, delay: 0 }] }];
    content.abilities[1] = content.abilities[0];
  });
  playWave(sim);
  stepUntil(sim, () => sim.state.lock === 0);
  sim.startWave();
  stepUntil(sim, () => sim.state.enemies.length === 2);
  for (let i = 0; i < 200; i++) sim.step();
  const lower = /** @type {import('../src/types/sim').Enemy} */ (sim.state.enemies.find((enemy) => enemy.path === 1));
  const before = lower.dist;
  assert.ok(before > 3);
  assert.deepEqual(sim.useAbility(0, 0), { ok: true });
  assert.ok(lower.dist < before);
  const s = samplePath(sim.paths[1], lower.dist, { x: 0, z: 0, dx: 0, dz: 0 });
  near(lower.x, s.x - s.dz * lower.lane, 1e-9);
  near(lower.z, s.z + s.dx * lower.lane, 1e-9);
});

test('Geschosse im Flug und Bodenfelder am alten Weg überstehen den Wechsel; Speichern erst ohne Bodenfelder', () => {
  const sim = stageSim((content) => {
    content.waves[0] = [{ groups: [{ enemy: 'grunt', count: 3, interval: 0.4, delay: 0 }] }];
    content.waves[1] = [{ groups: [{ enemy: 'grunt', count: 2, interval: 0.5, delay: 0 }] }];
    content.balance.startGold = 10000;
    // Ein langsames Geschoss und ein Bodenfeld, das lange liegt.
    addArch(content, 'lob', { attack: 'projectile', damage: 500, cooldown: 0.3, range: 30, projectileSpeed: 0.5 });
    addArch(content, 'puddle', { attack: 'projectile', damage: 0, cooldown: 0.2, range: 30, projectileSpeed: 50, splash: 0.8, slow: 0.3, slowDuration: 1, zone: 20, hitsAir: false });
  });
  mustBuild(sim, 'lob', 4, 2);
  mustBuild(sim, 'puddle', 7, 2);
  sim.startWave();
  /** @type {SimEvent[]} */
  const events = [];
  stepUntil(sim, () => {
    events.push(...sim.drainEvents());
    return sim.state.phase === 'build';
  });
  events.push(...sim.drainEvents());
  assert.equal(ofType(events, 'paths').length, 1);
  assert.ok(sim.state.zones.length > 0, 'Bodenfelder am alten Weg liegen noch');
  assert.equal(sim.save(), null);
  // Weiterrechnen bis alles verflogen ist: keine Ausnahme, Geschosse ohne Ziel verpuffen.
  stepUntil(sim, () => sim.state.zones.length === 0 && sim.state.projectiles.length === 0, 60 * 60);
  assert.ok(sim.save() !== null);
  // Die nächste Welle läuft auf beiden Wegen.
  stepUntil(sim, () => sim.state.lock === 0);
  sim.startWave();
  stepUntil(sim, () => sim.state.pending === 0);
  assert.deepEqual(sim.state.enemies.map((enemy) => enemy.path), [0, 1]);
});

test('Speichern und Laden: direkt nach dem Wechsel und davor; der Verlauf gleicht dem ungespeicherten genau', () => {
  /** @param {Content} content */
  const edit = (content) => {
    content.balance.startGold = 2000;
  };
  /**
   * Spielt: Turm bauen, Wellen spielen; `hook` darf nach jeder Welle eingreifen (z. B. speichern).
   * @param {Sim} sim
   * @param {number} from erste Welle
   * @param {number} to Welle, vor der aufgehört wird
   */
  const run = (sim, from, to) => {
    for (let w = from; w < to && sim.state.phase === 'build'; w++) {
      for (const [tx, tz] of [[4, 2], [5, 4], [7, 4], [2, 4], [8, 6], [10, 2]]) sim.build('shooter', tx, tz);
      playWave(sim);
    }
  };
  const perAge = makeSim().content.waves[0].length;
  const reference = stageSim(edit, 7);
  run(reference, 0, perAge);
  assert.equal(reference.pathStage(), 1, 'Zeitalter 1 erreicht');
  const atSwitch = /** @type {import('../src/types/sim').SaveData} */ (reference.save());
  assert.ok(atSwitch, 'Spielstand direkt nach dem Wechsel');
  const loaded = stageSim(edit, 7);
  const copy = createSim(loaded.config, JSON.parse(JSON.stringify(atSwitch)));
  assert.equal(copy.pathStage(), 1);
  assert.deepEqual(copy.paths, reference.paths);
  assert.deepEqual(copy.airPaths, reference.airPaths);
  assert.equal(copy.pathMark(2, 5), 'path');
  assert.equal(snapshot(copy), snapshot(reference));
  run(reference, perAge, 3 * perAge);
  run(copy, perAge, 3 * perAge);
  assert.equal(digest(copy), digest(reference));
  assert.equal(copy.state.phase, reference.state.phase);

  // Gespeichert vor dem Wechsel (letzte Welle des ersten Zeitalters), geladen, durch den Wechsel gespielt.
  const early = stageSim(edit, 7);
  run(early, 0, perAge - 1);
  const before = /** @type {import('../src/types/sim').SaveData} */ (early.save());
  const resumed = createSim(early.config, JSON.parse(JSON.stringify(before)));
  assert.equal(resumed.pathStage(), 0);
  run(early, perAge - 1, perAge + 1);
  run(resumed, perAge - 1, perAge + 1);
  assert.equal(resumed.pathStage(), 1);
  assert.equal(digest(resumed), digest(early));

  // Ein Turm auf einem künftigen Wegfeld lässt sich nicht laden.
  const bad = JSON.parse(JSON.stringify(before));
  bad.towers.push({ ...bad.towers[0], id: 9999, tx: 8, tz: 5 });
  assert.throws(() => createSim(early.config, bad), /\(8, 5\), das nicht bebaubar ist \(path\)/);
});

test('Deterministisch: zwei Partien mit gleichen Befehlen über alle Stufen sind bitgleich', () => {
  /** @param {Sim} sim */
  const run = (sim) => {
    for (let w = 0; w < sim.totalWaves && sim.state.phase === 'build'; w++) {
      for (const [tx, tz] of [[4, 2], [5, 4], [7, 4], [2, 4], [8, 6], [10, 2], [7, 2]]) sim.build('shooter', tx, tz);
      for (const tower of sim.state.towers) if (sim.upgradeCost(tower) >= 0 && sim.upgradeCost(tower) <= sim.state.gold) sim.upgrade(tower.id);
      playWave(sim);
    }
  };
  const a = stageSim(undefined, 3);
  const b = stageSim(undefined, 3);
  run(a);
  run(b);
  assert.equal(digest(a), digest(b));
  assert.ok(a.state.wave > a.content.waves[0].length, 'mindestens ein Wechsel gespielt');
});

test('Prüfung der Stufen: gleiche Regeln wie für Wege, gemeinsame Basis, keine Sperre und kein besonderes Feld auf einem Weg', () => {
  /**
   * @param {(content: Content, stages: any[]) => void} edit
   * @param {RegExp} message
   */
  const refuse = (edit, message) => assert.throws(() => stageSim((content) => {
    const map = content.maps[content.maps.length - 1];
    edit(content, /** @type {any[]} */ (map.stages));
  }), message);
  refuse((_, stages) => void (stages[1].paths[1] = [[-1, 5], [3, 5], [3, 4], [12, 4]]), /Stufe 1, Weg 1: Alle Wege aller Stufen müssen auf dem Feld der Basis \(12, 3\) enden/);
  refuse((_, stages) => void (stages[2].paths[0] = [[0, 5], [9, 5], [9, 3], [12, 3]]), /Stufe 2, Weg 0: Der Eingang \(0, 5\) muss genau ein Feld außerhalb/);
  refuse((_, stages) => void (stages[2].paths[0] = [[-1, 5], [9, 5], [9, 7], [10, 7], [10, 3], [12, 3]]), /Stufe 2, Weg 0: Wegpunkt 2 \(9, 7\) liegt außerhalb/);
  refuse((_, stages) => void (stages[2].paths[0] = [[-1, 5], [9, 4], [12, 3]]), /Stufe 2, Weg 0: Wegpunkte 0 und 1 müssen in einer Zeile oder Spalte liegen/);
  refuse((content) => void content.maps[content.maps.length - 1].blocked.push([5, 5]), /Stufe 2, Weg 0: führt über das gesperrte Feld \(5, 5\)/);
  refuse((_, stages) => void (stages[1].paths = []), /Stufe 1 hat keinen Weg/);
  refuse((_, stages) => void (stages[1].name = ''), /Stufe 1: name fehlt/);
  refuse((_, stages) => void (stages[2].text = undefined), /Stufe 2: text fehlt/);
  refuse((_, stages) => void (stages[0] = { name: 'Anfang', text: 'x', paths: stages[1].paths }), /Stufe 0 sind die Grundwege/);
  refuse((_, stages) => void (stages[2].flyersFollowPath = 'ja'), /flyersFollowPath muss true oder false sein/);
  refuse((_, stages) => void (stages[1] = 5), /Stufe 1 ist kein Objekt/);
  refuse((content) => void (content.maps[content.maps.length - 1].stages = /** @type {any} */ ({})), /stages muss eine Liste sein/);
  // Besondere Felder: auch nicht auf dem Weg einer späteren oder nie erreichten Stufe.
  refuse((content) => {
    addTiles(content);
    content.maps[content.maps.length - 1].tiles = [{ tx: 8, tz: 5, kind: 'high' }];
  }, /besonderes Feld 0 \(8, 5\) liegt auf dem Weg/);
  refuse((content) => {
    addTiles(content);
    content.maps[content.maps.length - 1].tiles = [{ tx: 5, tz: 6, kind: 'high' }];
  }, /\(5, 6\) liegt auf dem Weg/);
  // Stufe 0 mit Text, eine Stufe mit nur flyersFollowPath und Stufen weit jenseits der Zeitalter sind erlaubt.
  const ok = stageSim((content) => {
    const stages = /** @type {any[]} */ (content.maps[content.maps.length - 1].stages);
    stages[0] = { name: 'Anfang', text: 'So beginnt es.' };
    stages[2] = { name: 'Flug', text: 'Die Vögel folgen dem Weg.', flyersFollowPath: true };
    stages[9] = { name: 'Fern', text: 'Kommt nie.', paths: [[[-1, 6], [11, 6], [11, 3], [12, 3]]] };
  });
  assert.deepEqual(ok.pathStages, [0, 1, 2]);
  assert.equal(ok.stagePaths(2)[1], ok.stagePaths(1)[1], 'dieselben Kurven, nur die Flugbahnen wechseln');
  assert.equal(ok.stageAirPaths(2)[1], ok.stagePaths(2)[1]);
  assert.notEqual(ok.stageAirPaths(1)[1], ok.stagePaths(1)[1]);
});
