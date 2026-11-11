// @ts-check
// Simulation, Teil 1: Zustand zu Beginn, Wege und Luftlinien, Befehle, Wellenablauf, Wirtschaft, Punkte, Fähigkeit.
// Jeder Test nagelt eine Regel aus docs/SIM.md fest. Kampfregeln stehen in sim.combat.test.mjs, lange Läufe in sim.run.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rules from '../src/sim/rules.js';
import { AGE_LOCK, SIM_DT, createSim } from '../src/sim/sim.js';
import { addFusion, makeContent } from './fixtures/content.mjs';
import { STILL, addArch, begin, collect, makeSim, mustBuild, near, ofType, oneWave, scene, snapshot, steps, stepUntil } from './fixtures/harness.mjs';

/** @import { Content, WaveDef } from '../src/types/content' */
/** @import { Sim, SimEvent, Tower } from '../src/types/sim' */

/**
 * Rechnet `count` Zeitschritte und liefert alle Ereignisse mit dem Zeitschritt, in dem sie anfielen.
 * @param {Sim} sim
 * @param {number} count
 * @returns {{ tick: number, event: SimEvent }[]}
 */
function timeline(sim, count) {
  /** @type {{ tick: number, event: SimEvent }[]} */
  const list = [];
  for (let i = 0; i < count; i++) {
    sim.step();
    for (const event of sim.drainEvents()) list.push({ tick: sim.state.tick, event });
  }
  return list;
}

/**
 * Leere Wellen: `counts[i]` Wellen im i-ten Zeitalter. Eine leere Welle ist nach einem Zeitschritt überstanden.
 * @param {number[]} counts
 * @returns {(content: Content) => void}
 */
function emptyWaves(counts) {
  return (content) => {
    content.waves = counts.map((count) => Array.from({ length: count }, () => /** @type {WaveDef} */ ({ groups: [] })));
    content.balance.startGold = 100000;
  };
}

/**
 * Übersteht die (leere) laufende oder nächste Welle und wartet eine etwaige Sperre ab.
 * @param {Sim} sim
 */
function passWave(sim) {
  stepUntil(sim, () => sim.state.lock === 0);
  assert.deepEqual(sim.startWave(), { ok: true });
  stepUntil(sim, () => sim.state.phase !== 'wave');
  stepUntil(sim, () => sim.state.lock === 0);
}

test('Zustand zu Beginn', () => {
  const sim = makeSim({ mapId: 'bend' });
  const s = sim.state;
  assert.equal(s.gold, 200);
  assert.equal(s.lives, 20);
  assert.equal(s.maxLives, 20);
  assert.equal(s.phase, 'build');
  assert.equal(s.wave, 0);
  assert.equal(s.age, 0);
  assert.equal(s.waveInAge, 0);
  assert.equal(s.time, 0);
  assert.equal(s.tick, 0);
  assert.equal(s.score, 0);
  assert.equal(s.lock, 0);
  assert.equal(s.abilityCooldown, 0);
  assert.equal(s.pending, 0);
  assert.deepEqual([s.enemies.length, s.towers.length, s.projectiles.length, s.zones.length], [0, 0, 0, 0]);
  assert.equal(sim.totalWaves, 9);
  assert.equal(sim.map.id, 'bend');
  assert.equal(SIM_DT, 1 / 60);
  assert.equal(AGE_LOCK, 5);
  assert.equal(makeSim({ difficulty: 'hard' }).state.gold, 180);
  assert.equal(makeSim({ difficulty: 'hard' }).state.lives, 10);
  assert.equal(makeSim({ difficulty: 'easy' }).state.gold, 250);
  assert.equal(makeSim({ difficulty: 'easy' }).state.maxLives, 30);
  assert.equal(makeSim({ edit: (c) => void (c.balance.startGold = 101) , difficulty: 'easy' }).state.gold, 126, '126,25 wird gerundet');
});

test('createSim scheitert an fehlerhaften Inhalten mit verständlicher Meldung', () => {
  assert.throws(() => makeSim({ mapId: 'nirgendwo' }), /Unbekannte Karte "nirgendwo"/);
  assert.throws(() => makeSim({ edit: (c) => void c.waves[1][0].groups.push({ enemy: 'geist', count: 1, interval: 1, delay: 0 }) }), /unbekannter Gegner "geist"/);
  assert.throws(() => makeSim({ mapId: 'fork', edit: (c) => void (c.maps[1].paths[1] = [[-1, 5], [8, 5], [8, 4], [12, 4]]) }), /demselben Feld enden/);
  assert.throws(() => createSim({ content: makeContent(), mapId: 'bend', difficulty: /** @type {any} */ ('brutal'), seed: 1 }), /Schwierigkeitsgrad "brutal"/);
  assert.throws(() => makeSim({ edit: (c) => void delete (/** @type {any} */ (c.balance).burnOnSlowed) }), /burnOnSlowed/);
  assert.throws(() => makeSim({ edit: (c) => void delete (/** @type {any} */ (c.archetypes[0].stats).zone) }), /Turmrolle "shooter".*zone/);
  assert.throws(() => makeSim({ edit: (c) => void (c.enemies.wagon.spawns = { enemy: 'geist', count: 1 }) }), /Gegner "wagon".*"geist"/);
  assert.throws(() => makeSim({ edit: (c) => void (c.enemies.boss.phases = [{ at: 0.3 }, { at: 0.6 }]) }), /absteigend/);
  assert.throws(() => makeSim({ mapId: 'fork', edit: (c) => void (c.waves[0][0].groups[0].path = 2) }), /Weg 2 gibt es auf dieser Karte nicht/);
  assert.throws(() => makeSim({ edit: (c) => void c.abilities.pop() }), /fehlt die Fähigkeit/);
});

test('createSim prüft Ausbauzweige und Verschmelzung; Inhalte ohne sie bleiben gültig', () => {
  /** @param {(c: any) => void} change */
  const bad = (change) => () => makeSim({ edit: (c) => void (addFusion(c), change(c)) });
  assert.doesNotThrow(() => makeSim({ edit: (c) => void addFusion(c) }));
  assert.throws(bad((c) => void c.archetypes[0].branches.pop()), /Turmrolle "shooter": branches muss genau zwei Ausbauzweige nennen/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[1].name = '')), /branches\[1\]: name fehlt/);
  assert.throws(bad((c) => void delete c.archetypes[0].branches[0].mod), /branches\[0\]\.mod fehlt/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.plus = {})), /unbekanntes Feld "plus"/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.mul = { attack: 2 })), /mul: "attack" ist kein Zahlenfeld/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.mul = { cooldown: -1 })), /mul\.cooldown darf nicht negativ sein/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.add = { range: 'weit' })), /add\.range muss eine Zahl sein/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.set = { attack: 'laser' })), /set: unbekannte Angriffsart "laser"/);
  assert.throws(bad((c) => void (c.archetypes[0].branches[0].mod.set = { wucht: 3 })), /set: unbekannter Kampfwert "wucht"/);
  assert.throws(bad((c) => void delete c.archetypes[0].fusion.gift), /Turmrolle "shooter", fusion\.gift fehlt/);
  assert.throws(bad((c) => void (c.archetypes[0].fusion.core = { mul: { splash: 'x' } })), /fusion\.core\.mul\.splash muss eine Zahl sein/);
  assert.throws(bad((c) => void (c.archetypes[0].fusion.gift = { add: { dot: 1 } })), /Schaden über Zeit \(dot\), aber keine Dauer/);
  assert.throws(bad((c) => void (c.archetypes[0].fusion.gift = { set: { slow: 0.2 } })), /Verlangsamung \(slow\), aber keine Dauer/);
  assert.throws(bad((c) => void delete c.balance.fusion), /kann verschmelzen \(fusion\), aber balance\.fusion fehlt/);
  assert.throws(bad((c) => void (c.balance.fusion.parts = 0)), /balance\.fusion\.parts muss eine ganze Zahl von 1 bis 8 sein/);
  assert.throws(bad((c) => void (c.balance.fusion.parts = 9)), /balance\.fusion\.parts/);
  assert.throws(bad((c) => void (c.balance.fusion.damage = 0)), /balance\.fusion\.damage muss eine Zahl größer als 0 sein/);
  assert.throws(bad((c) => void delete c.balance.fusion.range), /balance\.fusion\.range/);
  assert.throws(bad((c) => void (c.balance.fusion.fee = -1)), /balance\.fusion\.fee muss eine Zahl ab 0 sein/);
  assert.throws(bad((c) => void (c.balance.fusion.megaLimit = 0.5)), /balance\.fusion\.megaLimit muss eine ganze Zahl ab 0 sein/);
  assert.throws(bad((c) => void delete c.balance.fusion.megaLimit), /balance\.fusion\.megaLimit/);
  assert.throws(bad((c) => void (c.balance.fusion.megaDamage = 0)), /balance\.fusion\.megaDamage muss eine Zahl größer als 0 sein/);
  assert.throws(bad((c) => void delete c.balance.fusion.megaRange), /balance\.fusion\.megaRange/);
  assert.throws(bad((c) => void (c.balance.fusion.megaFee = -1)), /balance\.fusion\.megaFee muss eine Zahl ab 0 sein/);
  assert.doesNotThrow(() => makeSim({ edit: (c) => void (addFusion(c), (c.balance.fusion.megaLimit = 0), (c.balance.fusion.megaFee = 0)) }));
  // Ältere Inhalte: weder Zweige noch Verschmelzung noch balance.fusion. Alles läuft, nur verschmelzen lässt sich nichts.
  const old = makeSim({ edit: (c) => void delete (/** @type {any} */ (c.balance).fusion) });
  const a = mustBuild(old, 'shooter', 1, 1);
  old.state.gold = 1000;
  old.upgrade(a.id);
  old.upgrade(a.id);
  assert.deepEqual([a.level, a.branch, a.super, a.gifts], [3, -1, false, []]);
  assert.deepEqual(old.canFuse(a.id, []), { ok: false, reason: 'super' });
  assert.deepEqual(old.fuseCandidates(a.id), []);
  assert.equal(old.fuseCost(a), 0);
});

test('Wege und Luftlinien: gerade Strecke vom Eingang zur Basis, oder der Weg selbst bei flyersFollowPath', () => {
  const sim = makeSim({ mapId: 'bend' });
  assert.equal(sim.paths.length, 1);
  assert.equal(sim.airPaths.length, 1);
  const air = sim.airPaths[0];
  assert.notEqual(air, sim.paths[0]);
  assert.deepEqual(Array.from(air.xs), [-6.5, 6.5]);
  assert.deepEqual(Array.from(air.zs), [-2, -1]);
  near(air.length, Math.hypot(13, 1), 1e-5);
  near(air.ds[1], air.length, 0);
  near(sim.paths[0].length, 20 - 4 * (1 - Math.PI / 4), 0.01);
  assert.ok(air.length < sim.paths[0].length);

  const fork = makeSim({ mapId: 'fork' });
  assert.equal(fork.airPaths.length, 2);
  assert.deepEqual([fork.airPaths[1].xs[0], fork.airPaths[1].zs[0], fork.airPaths[1].xs[1], fork.airPaths[1].zs[1]], [-6.5, 2, 6.5, 0]);

  const follow = makeSim({ mapId: 'bend', edit: (c) => void (c.maps[0].flyersFollowPath = true) });
  assert.equal(follow.airPaths[0], follow.paths[0]);
});

test('Flieger bewegen sich auf der Luftlinie, Läufer auf dem Weg; dist, progress und Durchkommen gelten je Kurve', () => {
  const sim = scene({
    map: 'bend',
    enemies: { vogel: { boss: true, flying: true, speed: 2, lives: 1 }, laeufer: { boss: true, speed: 2, lives: 1 } },
    wave: [{ enemy: 'vogel', count: 1, interval: 0, delay: 0 }, { enemy: 'laeufer', count: 1, interval: 0, delay: 0 }],
  });
  sim.startWave();
  steps(sim, 60);
  const [bird, walker] = sim.state.enemies;
  const air = sim.airPaths[0];
  near(bird.dist, 2, 1e-9);
  near(bird.x, -6.5 + (2 * 13) / air.length, 1e-5);
  near(bird.z, -2 + (2 * 1) / air.length, 1e-5);
  near(bird.progress, 2 / air.length, 1e-9);
  near(bird.dx, 13 / air.length, 1e-6);
  near(bird.dz, 1 / air.length, 1e-6);
  near(walker.dist, 2, 1e-9);
  near(walker.x, -4.5, 1e-5);
  near(walker.z, -2, 1e-6);
  near(walker.progress, 2 / sim.paths[0].length, 1e-9);
  // Vorige Lage für die Interpolation.
  near(walker.x - walker.px, 2 * SIM_DT, 1e-6);
  assert.equal(walker.pz, walker.z);
  // Der Flieger ist nach 13,04 Feldern am Ziel (Zeitschritt 392), der Läufer erst nach 19,14 (Zeitschritt 575).
  const leaks = timeline(sim, 600).filter((entry) => entry.event.type === 'leak');
  assert.deepEqual(leaks.map((entry) => [entry.tick, /** @type {any} */ (entry.event).enemy.def.id]), [[392, 'vogel'], [575, 'laeufer']]);
});

test('Mit flyersFollowPath folgt der Flieger dem Weg', () => {
  const sim = scene({
    map: 'bend',
    enemies: { vogel: { boss: true, flying: true, speed: 2 } },
    wave: [{ enemy: 'vogel', count: 1, interval: 0, delay: 0 }],
    edit: (c) => void (c.maps[0].flyersFollowPath = true),
  });
  sim.startWave();
  steps(sim, 60);
  near(sim.state.enemies[0].x, -4.5, 1e-5);
  near(sim.state.enemies[0].z, -2, 1e-6);
});

test('canBuild: outside, path, blocked, occupied; die Nachbarn einer Basis im Spielfeld sind gesperrt', () => {
  const sim = makeSim({ mapId: 'keep' });
  assert.deepEqual(sim.canBuild(-1, 3), { ok: false, reason: 'outside' });
  assert.deepEqual(sim.canBuild(12, 0), { ok: false, reason: 'outside' });
  assert.deepEqual(sim.canBuild(0, 7), { ok: false, reason: 'outside' });
  assert.deepEqual(sim.canBuild(2.5, 1), { ok: false, reason: 'outside' });
  assert.deepEqual(sim.canBuild(0, 3), { ok: false, reason: 'path' });
  assert.deepEqual(sim.canBuild(8, 3), { ok: false, reason: 'path' }, 'das Basisfeld gehört zum Weg');
  assert.deepEqual(sim.canBuild(7, 3), { ok: false, reason: 'path' }, 'Wegfeld neben der Basis bleibt Weg');
  assert.deepEqual(sim.canBuild(1, 1), { ok: false, reason: 'blocked' });
  for (const [tx, tz] of [[7, 2], [8, 2], [9, 2], [9, 3], [7, 4], [8, 4], [9, 4]]) {
    assert.deepEqual(sim.canBuild(tx, tz), { ok: false, reason: 'blocked' }, `Nachbarfeld (${tx}, ${tz}) der Basis`);
  }
  for (const [tx, tz] of [[10, 3], [6, 2], [6, 4], [8, 1], [8, 5], [0, 0], [11, 6]]) assert.deepEqual(sim.canBuild(tx, tz), { ok: true });
  mustBuild(sim, 'shooter', 6, 2);
  assert.deepEqual(sim.canBuild(6, 2), { ok: false, reason: 'occupied' });
  assert.equal(sim.towerAt(6, 2)?.arch.id, 'shooter');
  assert.equal(sim.towerAt(6, 4), null);
  assert.equal(sim.towerAt(-3, 99), null);

  // Liegt die Basis außerhalb, ist neben dem Wegende alles frei; map.blocked gilt trotzdem.
  const outside = makeSim({ mapId: 'straight' });
  assert.deepEqual(outside.canBuild(11, 2), { ok: true });
  assert.deepEqual(outside.canBuild(11, 4), { ok: true });
  assert.deepEqual(outside.canBuild(11, 3), { ok: false, reason: 'path' });
  assert.deepEqual(outside.canBuild(5, 0), { ok: false, reason: 'blocked' });
});

test('build: Ablehnungen ändern nichts, ein neuer Turm hat die Werte aus der Spezifikation', () => {
  const sim = makeSim({ mapId: 'straight', unlockAll: false });
  const before = JSON.stringify([sim.state.gold, sim.state.towers.length, sim.state.stats]);
  assert.deepEqual(sim.build('gibtsnicht', 1, 1), { ok: false, reason: 'unknown' });
  assert.deepEqual(sim.build('thrower', 1, 1), { ok: false, reason: 'locked' }, 'unlockWave 1, Welle 0');
  assert.deepEqual(sim.build('shooter', 1, 3), { ok: false, reason: 'path' });
  assert.deepEqual(sim.build('shooter', 5, 0), { ok: false, reason: 'blocked' });
  assert.deepEqual(sim.build('shooter', 40, 0), { ok: false, reason: 'outside' });
  sim.state.gold = 49;
  assert.deepEqual(sim.build('shooter', 1, 1), { ok: false, reason: 'gold' });
  sim.state.gold = 200;
  assert.equal(JSON.stringify([sim.state.gold, sim.state.towers.length, sim.state.stats]), before);
  assert.equal(sim.drainEvents().length, 0);

  assert.equal(sim.buildCost('shooter'), 50);
  assert.equal(sim.buildCost('gibtsnicht'), -1);
  assert.deepEqual(sim.build('shooter', 1, 1), { ok: true });
  const tower = sim.state.towers[0];
  assert.equal(sim.towerAt(1, 1), tower);
  assert.equal(sim.towerById(tower.id), tower);
  assert.equal(sim.towerById(987), null);
  assert.deepEqual(
    [tower.tier, tower.level, tower.mode, tower.cooldown, tower.builtWave, tower.invested, tower.tx, tower.tz, tower.x, tower.z, tower.targetId, tower.lastShot, tower.kills, tower.damageDealt, tower.beamTime],
    [0, 1, 'first', 0, 0, 50, 1, 1, -4.5, -2, -1, -Infinity, 0, 0, 0],
  );
  assert.deepEqual(tower.stats, rules.towerStats(sim.content, tower.arch, 0, 1));
  assert.equal(sim.state.gold, 150);
  assert.equal(sim.state.stats.goldSpent, 50);
  assert.equal(sim.state.stats.towersBuilt, 1);
  const events = sim.drainEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'build');
  assert.equal(/** @type {any} */ (events[0]).tower, tower);
  assert.deepEqual(sim.build('pulser', 1, 1), { ok: false, reason: 'occupied' });
  assert.equal(sim.drainEvents().length, 0, 'drainEvents leert die Liste');
});

test('build: Freischaltung nach Welle, unlockAll, fehlende Ausprägung, defaultMode', () => {
  const edit = emptyWaves([2, 1, 1]);
  const sim = makeSim({ unlockAll: false, edit });
  assert.deepEqual(sim.build('thrower', 1, 1), { ok: false, reason: 'locked' });
  assert.deepEqual(sim.build('slower', 1, 1), { ok: false, reason: 'locked' });
  passWave(sim);
  assert.equal(sim.state.wave, 1);
  assert.deepEqual(sim.build('thrower', 1, 1), { ok: true }, 'unlockWave 1 ist ab Welle 1 frei');
  assert.deepEqual(sim.build('slower', 2, 1), { ok: false, reason: 'locked' }, 'unlockWave 2 noch nicht');

  const all = makeSim({ unlockAll: true, edit });
  assert.deepEqual(all.build('slower', 1, 1), { ok: true });
  assert.equal(mustBuild(all, 'piercer', 2, 1).mode, 'strong', 'defaultMode der Rolle');
  assert.deepEqual(all.build('beamer', 3, 1), { ok: false, reason: 'locked' }, 'im ersten Zeitalter gibt es die Rolle nicht, auch nicht mit unlockAll');
  passWave(all);
  passWave(all);
  assert.equal(all.state.age, 1);
  const beamer = mustBuild(all, 'beamer', 3, 1);
  assert.equal(beamer.tier, 1, 'tier = aktuelles Zeitalter');
  assert.equal(beamer.builtWave, 2);
  assert.equal(beamer.invested, rules.buildCost(all.content, beamer.arch, 1));
});

test('upgrade: unknown, gold, max; Stufe und Werte steigen, invested wächst', () => {
  const sim = makeSim();
  const tower = mustBuild(sim, 'shooter', 1, 1);
  sim.drainEvents();
  assert.deepEqual(sim.upgrade(999), { ok: false, reason: 'unknown' });
  assert.equal(sim.upgradeCost(tower), 60);
  sim.state.gold = 59;
  assert.deepEqual(sim.upgrade(tower.id), { ok: false, reason: 'gold' });
  assert.equal(tower.level, 1);
  sim.state.gold = 1000;
  assert.deepEqual(sim.upgrade(tower.id), { ok: true });
  assert.equal(tower.level, 2);
  assert.equal(tower.stats.damage, 16);
  near(tower.stats.range, 3.3, 1e-12);
  assert.equal(tower.invested, 110);
  assert.equal(sim.state.gold, 940);
  assert.equal(sim.upgradeCost(tower), 90);
  assert.deepEqual(sim.upgrade(tower.id), { ok: true });
  assert.equal(tower.level, 3);
  assert.equal(tower.stats.cooldown, 0.5, 'Besonderheit der Stufe 3');
  assert.equal(tower.invested, 200);
  assert.equal(sim.upgradeCost(tower), -1);
  assert.deepEqual(sim.upgrade(tower.id), { ok: false, reason: 'max' });
  assert.equal(sim.state.gold, 850);
  assert.equal(sim.state.stats.upgrades, 2);
  const events = sim.drainEvents();
  assert.deepEqual(events.map((event) => event.type), ['upgrade', 'upgrade']);
});

/**
 * Partie mit Zweigen und Verschmelzung, leeren Wellen (je Zeitalter eine) und reichlich Gold.
 * @param {(content: Content) => void} [extra]
 */
function fusionSim(extra) {
  return makeSim({
    edit: (content) => {
      addFusion(content);
      emptyWaves([1, 1, 1])(content);
      if (extra) extra(content);
    },
  });
}

/**
 * Baut einen Turm und bringt ihn auf Stufe 3.
 * @param {Sim} sim
 * @param {string} archId
 * @param {number} tx
 * @param {number} tz
 * @param {number} [branch]
 * @returns {Tower}
 */
function build3(sim, archId, tx, tz, branch) {
  const tower = mustBuild(sim, archId, tx, tz);
  assert.deepEqual(sim.upgrade(tower.id), { ok: true });
  assert.deepEqual(sim.upgrade(tower.id, branch), { ok: true });
  return tower;
}

test('upgrade mit Ausbauzweig: branch für unbekannte Zweige, ohne Angabe Zweig 0, unter Stufe 3 und ohne Zweige ohne Bedeutung', () => {
  const sim = fusionSim();
  const a = mustBuild(sim, 'shooter', 1, 1);
  assert.equal(a.branch, -1);
  assert.deepEqual(sim.upgrade(a.id, 7), { ok: true }, 'auf Stufe 2 wird die Angabe ignoriert');
  assert.deepEqual([a.level, a.branch], [2, -1]);
  const gold = sim.state.gold;
  for (const wrong of [2, -1, 0.5, NaN]) assert.deepEqual(sim.upgrade(a.id, wrong), { ok: false, reason: 'branch' }, `Zweig ${wrong}`);
  assert.deepEqual(sim.upgrade(a.id, /** @type {any} */ ('1')), { ok: false, reason: 'branch' });
  assert.deepEqual([a.level, a.branch, sim.state.gold], [2, -1, gold]);
  assert.deepEqual(sim.upgrade(a.id, 1), { ok: true });
  assert.deepEqual([a.level, a.branch, a.invested], [3, 1, 200]);
  assert.equal(sim.state.gold, gold - 90, 'beide Zweige kosten dasselbe');
  assert.deepEqual(a.stats, rules.towerStats(sim.content, a.arch, 0, 3, { branch: 1 }));
  assert.equal(a.stats.cooldown, 1.5);
  assert.deepEqual(sim.upgrade(a.id, 0), { ok: false, reason: 'max' }, 'der Zweig lässt sich nicht mehr wechseln');
  const b = build3(sim, 'shooter', 2, 1);
  assert.equal(b.branch, 0);
  assert.equal(b.stats.cooldown, 0.25);
  const c = build3(sim, 'burner', 3, 1, 5);
  assert.equal(c.branch, -1, 'die Rolle hat keine Zweige');
  assert.deepEqual(c.stats, rules.towerStats(sim.content, c.arch, 0, 3));
});

test('fuse: jede Ablehnung mit ihrem Grund, und keine ändert etwas', () => {
  const sim = fusionSim();
  const core = build3(sim, 'shooter', 4, 1);
  const p1 = build3(sim, 'burner', 5, 1);
  const p2 = build3(sim, 'slower', 3, 2, 1);
  const far = build3(sim, 'thrower', 7, 1);
  const low = mustBuild(sim, 'shooter', 4, 2);
  sim.upgrade(low.id);
  const dull = build3(sim, 'pulser', 5, 2);
  passWave(sim);
  assert.equal(sim.state.age, 1);
  const newer = build3(sim, 'burner', 3, 0);
  assert.equal(newer.tier, 1);
  sim.drainEvents();
  const before = snapshot(sim);
  /**
   * @param {number} coreId
   * @param {any} parts
   * @param {string} reason
   */
  const refuse = (coreId, parts, reason) => {
    assert.deepEqual(sim.canFuse(coreId, parts), { ok: false, reason }, `canFuse ${coreId} ${JSON.stringify(parts)}`);
    assert.deepEqual(sim.fuse(coreId, parts), { ok: false, reason }, `fuse ${coreId} ${JSON.stringify(parts)}`);
  };
  refuse(999, [p1.id, p2.id], 'unknown');
  refuse(core.id, [p1.id, 999], 'unknown');
  refuse(dull.id, [p1.id, p2.id], 'super');
  refuse(core.id, [p1.id, dull.id], 'super');
  refuse(low.id, [p1.id, p2.id], 'level');
  refuse(core.id, [low.id, p1.id], 'level');
  refuse(core.id, [p1.id], 'count');
  refuse(core.id, [], 'count');
  refuse(core.id, [p1.id, p2.id, far.id], 'count');
  refuse(core.id, [p1.id, p1.id], 'count');
  refuse(core.id, [core.id, p1.id], 'count');
  refuse(core.id, null, 'count');
  refuse(core.id, [p1.id, newer.id], 'tier');
  refuse(core.id, [far.id, p1.id], 'adjacent');
  assert.equal(sim.fuseCost(core), 25);
  const gold = sim.state.gold;
  sim.state.gold = 24;
  refuse(core.id, [p1.id, p2.id], 'gold');
  sim.state.gold = gold;
  sim.state.phase = 'won';
  refuse(core.id, [p1.id, p2.id], 'phase');
  assert.deepEqual(sim.fuseCandidates(core.id), []);
  sim.state.phase = 'build';
  assert.equal(snapshot(sim), before);
  assert.deepEqual(sim.drainEvents(), []);
  // Auskünfte: nur benachbarte Türme der Stufe 3 mit gleichem Technikstand, deren Rolle verschmelzen kann.
  assert.deepEqual(sim.fuseCandidates(core.id).map((tower) => tower.id), [p1.id, p2.id]);
  assert.deepEqual(sim.fuseCandidates(low.id), []);
  assert.deepEqual(sim.fuseCandidates(dull.id), []);
  assert.deepEqual(sim.fuseCandidates(999), []);
  assert.deepEqual(sim.fuseCandidates(p1.id).map((tower) => tower.id), [core.id], 'jede Rolle mit fusion kann auch Kern sein');
  assert.deepEqual(sim.canFuse(core.id, [p1.id, p2.id]), { ok: true });
  assert.equal(snapshot(sim), before, 'canFuse führt nichts aus');
});

test('fuse: Zutaten verschwinden, der Kern wird zur Superwaffe mit Gaben, Gold und Abschüsse gehen auf ihn über', () => {
  const sim = fusionSim();
  const core = build3(sim, 'shooter', 4, 1);
  const p1 = build3(sim, 'burner', 5, 1);
  const p2 = build3(sim, 'slower', 3, 2, 1);
  const far = build3(sim, 'thrower', 7, 1);
  const low = build3(sim, 'shooter', 4, 2, 1);
  core.kills = 3;
  p1.kills = 4;
  p2.kills = 5;
  core.damageDealt = 10;
  p1.damageDealt = 20.5;
  passWave(sim);
  sim.drainEvents();
  const gold = sim.state.gold;
  const spent = sim.state.stats.goldSpent;
  const spots = [[p2.x, p2.z], [p1.x, p1.z]];
  assert.deepEqual(sim.fuse(core.id, [p2.id, p1.id]), { ok: true });
  assert.deepEqual([core.super, core.gifts, core.level, core.branch, core.tier], [true, ['slower', 'burner'], 3, 0, 0]);
  assert.equal(core.invested, 200 + 280 + 400 + 25, 'Kern, Zutaten und Gebühr');
  assert.deepEqual([core.kills, core.damageDealt], [12, 30.5]);
  assert.equal(sim.state.gold, gold - 25);
  assert.deepEqual([sim.state.stats.goldSpent, sim.state.stats.fusions, sim.state.stats.towersSold], [spent + 25, 1, 0]);
  assert.deepEqual(core.stats, rules.towerStats(sim.content, core.arch, 0, 3, { branch: 0, super: true, gifts: ['slower', 'burner'] }));
  assert.equal(core.stats.dot, 10);
  assert.equal(core.stats.slow, 0.25);
  assert.deepEqual(sim.state.towers.map((tower) => tower.id), [core.id, far.id, low.id]);
  assert.equal(sim.towerById(p1.id), null);
  assert.equal(sim.towerAt(5, 1), null);
  assert.equal(sim.towerAt(4, 1), core);
  assert.deepEqual(sim.canBuild(5, 1), { ok: true });
  assert.deepEqual(sim.canBuild(3, 2), { ok: true });
  const events = sim.drainEvents();
  assert.equal(events.length, 1);
  const event = ofType(events, 'fuse')[0];
  assert.equal(event.tower, core);
  assert.equal(event.fee, 25);
  assert.deepEqual(event.parts, [{ id: p2.id, arch: p2.arch, branch: 1, x: spots[0][0], z: spots[0][1] }, { id: p1.id, arch: p1.arch, branch: -1, x: spots[1][0], z: spots[1][1] }]);
  assert.deepEqual(core.giftBranches, [1, -1], 'Zweig jeder Zutat (Bremser Zweig 1, Brenner ohne Zweige)');
  assert.equal(event.mega, false);
  // Eine Superwaffe lässt sich nicht ausbauen und ist keine Zutat; als Kern nimmt sie nur Zutaten ihres Technikstands auf (Megawaffe).
  assert.equal(sim.upgradeCost(core), -1);
  assert.deepEqual(sim.upgrade(core.id, 1), { ok: false, reason: 'max' });
  const q1 = build3(sim, 'burner', 5, 1);
  const q2 = build3(sim, 'burner', 5, 0 + 2);
  assert.deepEqual(sim.fuse(core.id, [q1.id, q2.id]), { ok: false, reason: 'tier' });
  assert.deepEqual(sim.fuse(q1.id, [core.id, q2.id]), { ok: false, reason: 'super' });
  assert.deepEqual(sim.fuseCandidates(core.id).map((tower) => tower.id), [low.id]);
  assert.ok(!sim.fuseCandidates(q1.id).includes(core));
  // Verkauf wie bei jedem Turm: 75 % des investierten Goldes, abgerundet.
  assert.equal(sim.sellValue(core), Math.floor(905 * 0.75));
  const mine = sim.state.gold;
  assert.deepEqual(sim.sell(core.id), { ok: true });
  assert.equal(sim.state.gold, mine + 678);
  assert.equal(sim.towerAt(4, 1), null);
});

test('fuse und Verkauf: volle Erstattung nur, wenn Kern UND Zutaten vor der noch nicht begonnenen Welle gebaut wurden', () => {
  const sim = fusionSim();
  const old = build3(sim, 'burner', 5, 1);
  // Alles in derselben Bauphase gebaut: Der Fehlkauf lässt sich samt Gebühr rückgängig machen.
  const a = build3(sim, 'shooter', 1, 1);
  const a1 = build3(sim, 'shooter', 2, 1);
  const a2 = build3(sim, 'shooter', 1, 2);
  const start = sim.state.gold;
  assert.deepEqual(sim.fuse(a.id, [a1.id, a2.id]), { ok: true });
  assert.equal(a.invested, 625);
  assert.equal(sim.sellValue(a), 625);
  sim.sell(a.id);
  assert.equal(sim.state.gold, start + 600, 'alles zurück, auch die Gebühr von 25');
  passWave(sim);
  // Neuer Kern, alte Zutat: Die Superwaffe gilt als so alt wie ihr ältester Teil.
  const core = build3(sim, 'shooter', 4, 1);
  assert.equal(core.tier, 1);
  assert.deepEqual(sim.modernize(old.id), { ok: true });
  const fresh = build3(sim, 'burner', 4, 2);
  assert.equal(core.builtWave, 1);
  assert.deepEqual(sim.fuse(core.id, [old.id, fresh.id]), { ok: true });
  assert.equal(core.builtWave, 0);
  assert.equal(sim.sellValue(core), Math.floor(core.invested * 0.75));
});

test('modernize einer Superwaffe: Anteil am Neuwert von Kern und Zutaten im neuen Zeitalter; Gaben und Zweig bleiben', () => {
  const sim = fusionSim();
  const core = build3(sim, 'shooter', 4, 1, 1);
  const p1 = build3(sim, 'burner', 5, 1);
  const p2 = build3(sim, 'slower', 3, 2);
  assert.deepEqual(sim.fuse(core.id, [p1.id, p2.id]), { ok: true });
  assert.equal(sim.modernizeCost(core), -1);
  assert.deepEqual(sim.modernize(core.id), { ok: false, reason: 'max' });
  passWave(sim);
  assert.equal(sim.modernizeCost(core), 710, '45 % von 360 + 720 + 500');
  assert.equal(sim.modernizeCost(core), rules.modernizeCost(sim.content, core.arch, 1, 3, core));
  const invested = core.invested;
  sim.state.gold = 709;
  assert.deepEqual(sim.modernize(core.id), { ok: false, reason: 'gold' });
  sim.state.gold = 710;
  assert.deepEqual(sim.modernize(core.id), { ok: true });
  assert.equal(sim.state.gold, 0);
  assert.deepEqual([core.tier, core.level, core.branch, core.super, core.gifts, core.invested], [1, 3, 1, true, ['burner', 'slower'], invested + 710]);
  assert.deepEqual(core.stats, rules.towerStats(sim.content, core.arch, 1, 3, { branch: 1, super: true, gifts: ['burner', 'slower'] }));
  assert.equal(core.stats.dot, 20, 'die Gabe zählt nun in Standardschüssen des neuen Technikstands');
  assert.equal(sim.modernizeCost(core), -1);
});

test('fuse zur Megawaffe: jede Ablehnung mit ihrem Grund in fester Reihenfolge, Höchstzahl und ihre Freigabe durch Verkauf', () => {
  const sim = fusionSim();
  sim.state.gold = 100000;
  const a = build3(sim, 'shooter', 2, 1);
  const a1 = build3(sim, 'burner', 1, 1);
  const a2 = build3(sim, 'slower', 3, 1);
  assert.deepEqual(sim.fuse(a.id, [a1.id, a2.id]), { ok: true });
  const m1 = build3(sim, 'thrower', 2, 0);
  const m2 = build3(sim, 'piercer', 1, 0);
  const low = mustBuild(sim, 'shooter', 3, 0);
  sim.upgrade(low.id);
  const far = build3(sim, 'thrower', 6, 1);
  const b = build3(sim, 'shooter', 9, 1);
  const b1 = build3(sim, 'burner', 10, 1);
  const b2 = build3(sim, 'burner', 8, 1);
  assert.deepEqual(sim.fuse(b.id, [b1.id, b2.id]), { ok: true });
  passWave(sim);
  const newer = build3(sim, 'burner', 1, 2);
  assert.equal(newer.tier, 1);
  sim.drainEvents();
  const before = snapshot(sim);
  /**
   * @param {number} coreId
   * @param {any} parts
   * @param {string} reason
   */
  const refuse = (coreId, parts, reason) => {
    assert.deepEqual(sim.canFuse(coreId, parts), { ok: false, reason }, `canFuse ${coreId} ${JSON.stringify(parts)}`);
    assert.deepEqual(sim.fuse(coreId, parts), { ok: false, reason }, `fuse ${coreId} ${JSON.stringify(parts)}`);
  };
  refuse(999, [m1.id, m2.id], 'unknown');
  refuse(a.id, [m1.id], 'count');
  refuse(a.id, [], 'count');
  refuse(a.id, [m1.id, m2.id, far.id], 'count');
  refuse(a.id, [m1.id, m1.id], 'count');
  refuse(a.id, [a.id, m1.id], 'count');
  refuse(a.id, null, 'count');
  refuse(a.id, [m1.id, 999], 'unknown');
  refuse(a.id, [b.id, m1.id], 'super');
  refuse(a.id, [low.id, m1.id], 'level');
  refuse(a.id, [m1.id, newer.id], 'tier');
  refuse(a.id, [far.id, m1.id], 'adjacent');
  assert.equal(sim.fuseCost(a), 50, 'megaFee 1 mal Baukosten 50 statt fee 0,5');
  const gold = sim.state.gold;
  sim.state.gold = 49;
  refuse(a.id, [m1.id, m2.id], 'gold');
  sim.state.gold = gold;
  sim.state.phase = 'won';
  refuse(a.id, [m1.id, m2.id], 'phase');
  assert.deepEqual(sim.fuseCandidates(a.id), []);
  sim.state.phase = 'build';
  assert.equal(snapshot(sim), before);
  assert.deepEqual(sim.drainEvents(), []);
  assert.deepEqual(sim.fuseCandidates(a.id).map((tower) => tower.id), [m1.id, m2.id]);
  assert.deepEqual(sim.canFuse(a.id, [m1.id, m2.id]), { ok: true });
  assert.equal(snapshot(sim), before, 'canFuse führt nichts aus');
  // Die erste Megawaffe entsteht; danach ist sie kein Kern mehr (super) und die Höchstzahl erreicht (limit).
  assert.deepEqual(sim.fuse(a.id, [m2.id, m1.id]), { ok: true });
  assert.equal(a.mega, true);
  refuse(a.id, [], 'super');
  refuse(b.id, [], 'limit');
  refuse(b.id, [999, 998], 'limit');
  assert.deepEqual(sim.fuseCandidates(a.id), []);
  assert.deepEqual(sim.fuseCandidates(b.id), []);
  // Eine Superwaffe bleibt Zutat-untauglich, auch für einen gewöhnlichen Kern.
  refuse(newer.id, [b.id, a.id], 'super');
  // Verkauf der Megawaffe gibt den Platz frei: B scheitert nun erst an den Zutaten.
  assert.deepEqual(sim.sell(a.id), { ok: true });
  refuse(b.id, [], 'count');
  // Mit megaLimit 0 gibt es keine Megawaffen.
  const none = fusionSim((content) => void (content.balance.fusion.megaLimit = 0));
  none.state.gold = 100000;
  const c = build3(none, 'shooter', 2, 1);
  const c1 = build3(none, 'shooter', 1, 1);
  const c2 = build3(none, 'shooter', 3, 1);
  assert.deepEqual(none.fuse(c.id, [c1.id, c2.id]), { ok: true });
  build3(none, 'shooter', 2, 0);
  assert.deepEqual(none.canFuse(c.id, []), { ok: false, reason: 'limit' });
  assert.deepEqual(none.fuseCandidates(c.id), []);
});

test('fuse zur Megawaffe: vier Gaben, Gold, Abschüsse, Ereignis; modernisieren und verkaufen; danach ist Platz für die nächste', () => {
  const sim = fusionSim();
  sim.state.gold = 100000;
  const core = build3(sim, 'shooter', 2, 1, 1);
  const p1 = build3(sim, 'burner', 1, 1);
  const p2 = build3(sim, 'slower', 3, 1);
  assert.deepEqual(sim.fuse(core.id, [p1.id, p2.id]), { ok: true });
  const m1 = build3(sim, 'thrower', 2, 0);
  const m2 = build3(sim, 'piercer', 1, 0);
  core.kills = 2;
  m1.kills = 3;
  m1.damageDealt = 7.5;
  passWave(sim);
  sim.drainEvents();
  const gold = sim.state.gold;
  const spent = sim.state.stats.goldSpent;
  const invested = core.invested + m1.invested + m2.invested + 50;
  const kills = core.kills + m1.kills + m2.kills;
  assert.deepEqual(sim.fuse(core.id, [m2.id, m1.id]), { ok: true });
  assert.deepEqual([core.super, core.mega, core.gifts, core.level, core.branch, core.tier], [true, true, ['burner', 'slower', 'piercer', 'thrower'], 3, 1, 0]);
  assert.deepEqual([core.invested, core.kills], [invested, kills]);
  assert.equal(sim.state.gold, gold - 50);
  assert.deepEqual([sim.state.stats.goldSpent, sim.state.stats.fusions, sim.state.stats.megas], [spent + 50, 1, 1]);
  const opts = { branch: 1, super: true, mega: true, gifts: ['burner', 'slower', 'piercer', 'thrower'] };
  assert.deepEqual(core.stats, rules.towerStats(sim.content, core.arch, 0, 3, opts));
  const superStats = rules.towerStats(sim.content, core.arch, 0, 3, { branch: 1, super: true, gifts: ['burner', 'slower', 'piercer', 'thrower'] });
  near(core.stats.damage, superStats.damage * 2 / 1.5);
  near(core.stats.range, superStats.range * 1.2 / 1.1);
  assert.equal(core.stats.pierce, 1, 'Gabe des Knackers');
  assert.equal(sim.towerAt(2, 0), null);
  assert.equal(sim.towerById(m2.id), null);
  assert.deepEqual(sim.canBuild(1, 0), { ok: true });
  const events = sim.drainEvents();
  assert.equal(events.length, 1);
  const event = ofType(events, 'fuse')[0];
  assert.deepEqual([event.tower, event.fee, event.mega, event.parts.map((part) => part.id)], [core, 50, true, [m2.id, m1.id]]);
  assert.deepEqual(sim.upgrade(core.id), { ok: false, reason: 'max' });
  // Modernisieren: Anteil am Neuwert von Kern und allen vier Gaben-Rollen im neuen Zeitalter.
  const cost = sim.modernizeCost(core);
  assert.equal(cost, rules.modernizeCost(sim.content, core.arch, 1, 3, opts));
  assert.ok(cost > rules.modernizeCost(sim.content, core.arch, 1, 3, { ...opts, mega: false, gifts: ['burner', 'slower'] }));
  assert.deepEqual(sim.modernize(core.id), { ok: true });
  assert.deepEqual([core.tier, core.mega, core.gifts.length, core.invested], [1, true, 4, invested + cost]);
  assert.deepEqual(core.stats, rules.towerStats(sim.content, core.arch, 1, 3, opts));
  // Verkaufen wie jeden Turm; der Zähler megas bleibt, der Platz wird frei.
  const value = Math.floor(core.invested * 0.75);
  assert.equal(sim.sellValue(core), value);
  const before = sim.state.gold;
  assert.deepEqual(sim.sell(core.id), { ok: true });
  assert.equal(sim.state.gold, before + value);
  const next = build3(sim, 'burner', 9, 1);
  const n1 = build3(sim, 'shooter', 10, 1);
  const n2 = build3(sim, 'shooter', 8, 1);
  const n3 = build3(sim, 'support', 9, 0);
  const n4 = build3(sim, 'slower', 9, 2);
  assert.deepEqual(sim.fuse(next.id, [n1.id, n2.id]), { ok: true });
  assert.equal(sim.fuseCost(next), rules.fuseCost(sim.content, next.arch, 1, true));
  assert.deepEqual(sim.fuse(next.id, [n3.id, n4.id]), { ok: true });
  assert.deepEqual([next.mega, sim.state.stats.fusions, sim.state.stats.megas], [true, 2, 2]);
});

test('fuse und Auren: Boni werden neu berechnet; eine Superwaffe ist ein Turm auf einem Feld und wird verstärkt wie jeder andere', () => {
  const sim = fusionSim();
  const core = build3(sim, 'shooter', 4, 1);
  const aura = build3(sim, 'support', 5, 1);
  const p2 = build3(sim, 'burner', 3, 1);
  const mate = mustBuild(sim, 'shooter', 6, 1);
  assert.deepEqual([core.buffDamage, mate.buffDamage, mate.buffRate], [0.25, 0.25, 0.2]);
  near(core.buffRange, 0.25);
  // Der Unterstützer geht als Zutat im Kern auf: Seine Aura ist fort, seine Gabe (+25 % Schaden) steckt im Kern.
  assert.deepEqual(sim.fuse(core.id, [aura.id, p2.id]), { ok: true });
  assert.deepEqual([core.buffDamage, core.buffRate, core.buffRange, mate.buffDamage, mate.buffRate, mate.buffRange], [0, 0, 0, 0, 0, 0]);
  assert.equal(core.stats.damage, 25 * 1.5 * 1.2 * 1.25);
  // Ein neuer Unterstützer verstärkt die Superwaffe wie jeden Turm; als Kern einer Superwaffe strahlt er doppelt.
  const giver = build3(sim, 'support', 5, 1, 1);
  assert.equal(core.buffDamage, 0.4);
  const g1 = build3(sim, 'thrower', 5, 2);
  const g2 = build3(sim, 'thrower', 6, 2);
  assert.deepEqual(sim.fuse(giver.id, [g1.id, g2.id]), { ok: true });
  assert.equal(giver.stats.auraDamage, 0.8);
  assert.deepEqual([core.buffDamage, mate.buffDamage], [0.8, 0.8]);
  assert.equal(giver.buffDamage, 0, 'Auren verändern den Spender nicht');
});

test('modernize: Preis ist ein fester Anteil des Neuwerts im aktuellen Zeitalter; Stufe bleibt, Werte neu', () => {
  const sim = makeSim({
    edit: (content) => {
      emptyWaves([1, 1, 1, 1])(content);
      content.ages.push({ ...content.ages[2], id: 'later' });
      content.abilities.push(content.abilities[2]);
      for (const key of /** @type {const} */ (['ageDamage', 'ageCost', 'ageHp', 'ageBounty'])) content.balance[key].push(content.balance[key][2] * 2);
      for (const arch of content.archetypes) arch.tiers.push(arch.tiers[2]);
      addArch(content, 'luecke', { damage: 5 });
      content.archetypes[content.archetypes.length - 1].tiers[1] = null;
    },
  });
  const a = mustBuild(sim, 'shooter', 1, 1);
  const b = mustBuild(sim, 'shooter', 2, 1);
  const gap = mustBuild(sim, 'luecke', 3, 1);
  sim.upgrade(a.id);
  sim.upgrade(a.id);
  assert.equal(a.invested, 200);
  assert.equal(sim.modernizeCost(a), -1);
  assert.deepEqual(sim.modernize(a.id), { ok: false, reason: 'max' }, 'schon auf dem Stand des Zeitalters');
  assert.deepEqual(sim.modernize(4711), { ok: false, reason: 'unknown' });

  passWave(sim);
  assert.equal(sim.state.age, 1);
  sim.drainEvents();
  assert.equal(sim.modernizeCost(a), 160, '45 % von 360');
  assert.equal(sim.modernizeCost(gap), -1);
  assert.deepEqual(sim.modernize(gap.id), { ok: false, reason: 'max' }, 'die Rolle hat in diesem Zeitalter keine Ausprägung');
  sim.state.gold = 159;
  assert.deepEqual(sim.modernize(a.id), { ok: false, reason: 'gold' });
  assert.equal(a.tier, 0);
  sim.state.gold = 5000;
  a.beamTime = 1.5;
  assert.deepEqual(sim.modernize(a.id), { ok: true });
  assert.deepEqual([a.tier, a.level, a.invested, a.beamTime, sim.state.gold], [1, 3, 360, 0, 4840]);
  assert.deepEqual(a.stats, rules.towerStats(sim.content, a.arch, 1, 3));
  assert.equal(a.stats.damage, 50);
  const events = sim.drainEvents();
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].type, /** @type {any} */ (events[0]).fromTier, /** @type {any} */ (events[0]).tower], ['modernize', 0, a]);
  assert.deepEqual(sim.modernize(a.id), { ok: false, reason: 'max' });
  assert.equal(sim.state.stats.modernizations, 1);

  // Ein Zeitalter überspringen kostet dasselbe wie der Schritt vom Vorgänger: Es zählt nur das Ziel.
  passWave(sim);
  assert.equal(sim.state.age, 2);
  assert.equal(sim.modernizeCost(b), 70, '45 % von 160, obwohl der Turm zwei Zeitalter zurückliegt');
  assert.equal(sim.modernizeCost(a), 290, '45 % von 640');
  assert.equal(sim.modernizeCost(b), rules.modernizeCost(sim.content, b.arch, 2, 1));
  assert.deepEqual(sim.modernize(b.id), { ok: true });
  assert.equal(b.tier, 2, 'direkt auf den aktuellen Stand');
  assert.equal(b.stats.attack, 'hitscan');
  assert.equal(b.invested, 120);
  assert.deepEqual(sim.modernize(gap.id), { ok: true });
  assert.equal(gap.tier, 2);
  // Ausbau kostet zum Preis des Zeitalters, auf dessen Stand der Turm ist.
  assert.equal(sim.upgradeCost(b), rules.upgradeCost(sim.content, b.arch, 2, 1));
});

test('sell: volle Erstattung nur vor der Welle, für die gebaut wurde; sonst abgerundeter Anteil', () => {
  const sim = scene({ wave: [{ enemy: 'grunt', count: 1, interval: 0, delay: 3 }], edit: (c) => void c.waves[0].push({ groups: [] }) });
  const start = sim.state.gold;
  const tower = mustBuild(sim, 'shooter', 1, 1);
  sim.upgrade(tower.id);
  assert.equal(sim.sellValue(tower), 110, 'Fehlkauf samt Ausbau');
  sim.drainEvents();
  assert.deepEqual(sim.sell(999), { ok: false, reason: 'unknown' });
  assert.deepEqual(sim.sell(tower.id), { ok: true });
  assert.equal(sim.state.gold, start);
  assert.equal(sim.state.towers.length, 0);
  assert.equal(sim.towerAt(1, 1), null);
  assert.equal(sim.towerById(tower.id), null);
  assert.deepEqual(sim.canBuild(1, 1), { ok: true });
  assert.equal(sim.state.stats.towersSold, 1);
  const events = sim.drainEvents();
  assert.deepEqual(events.map((event) => event.type), ['sell', 'gold']);
  assert.deepEqual([/** @type {any} */ (events[0]).tower, /** @type {any} */ (events[0]).refund], [tower, 110]);
  assert.deepEqual(events[1], { type: 'gold', amount: 110, reason: 'sell', x: tower.x, z: tower.z });
  assert.deepEqual(sim.sell(tower.id), { ok: false, reason: 'unknown' });

  const early = mustBuild(sim, 'shooter', 1, 1);
  assert.deepEqual(sim.startWave(), { ok: true });
  assert.equal(sim.sellValue(early), 37, 'floor(50 * 0,75) sobald die Welle läuft');
  const during = mustBuild(sim, 'shooter', 2, 1);
  assert.equal(during.builtWave, 0);
  assert.equal(sim.sellValue(during), 37, 'während einer Welle gebaut: kein Fehlkauf');
  stepUntil(sim, () => sim.state.phase === 'build');
  assert.equal(sim.state.wave, 1);
  assert.equal(sim.sellValue(early), 37);
  assert.equal(sim.sellValue(during), 37);
  const fresh = mustBuild(sim, 'thrower', 3, 1);
  assert.equal(fresh.builtWave, 1);
  assert.equal(sim.sellValue(fresh), 90);
  const gold = sim.state.gold;
  assert.deepEqual(sim.sell(early.id), { ok: true });
  assert.equal(sim.state.gold, gold + 37);
  assert.deepEqual(sim.state.towers.map((t) => t.id), [during.id, fresh.id], 'Reihenfolge der übrigen bleibt');
});

test('setTargetMode: unknown für fremde Türme und unbekannte Zielwahl', () => {
  const sim = makeSim();
  const tower = mustBuild(sim, 'shooter', 1, 1);
  assert.deepEqual(sim.setTargetMode(77, 'last'), { ok: false, reason: 'unknown' });
  assert.deepEqual(sim.setTargetMode(tower.id, /** @type {any} */ ('lustig')), { ok: false, reason: 'unknown' });
  assert.equal(tower.mode, 'first');
  for (const mode of /** @type {const} */ (['last', 'strong', 'weak', 'near', 'first'])) {
    assert.deepEqual(sim.setTargetMode(tower.id, mode), { ok: true });
    assert.equal(tower.mode, mode);
  }
});

test('startWave, Wellenende, Zeitalterwechsel und Sperre', () => {
  const sim = makeSim({ edit: emptyWaves([2, 1, 1]) });
  const gold = sim.state.gold;
  assert.deepEqual(sim.startWave(), { ok: true });
  assert.equal(sim.state.phase, 'wave');
  assert.deepEqual(sim.drainEvents(), [{ type: 'waveStart', wave: 0, age: 0, waveInAge: 0, boss: false, early: 0 }]);
  assert.deepEqual(sim.startWave(), { ok: false, reason: 'phase' });
  sim.step();
  // Welle 0 überstanden, die nächste liegt im selben Zeitalter: Prämie 30 plus Makellos-Zuschlag 15, kein Geschenk, keine Sperre.
  assert.deepEqual(sim.drainEvents(), [
    { type: 'gold', amount: 45, reason: 'wave', x: 6.5, z: 0 },
    { type: 'waveClear', wave: 0, bonus: 45, perfect: true },
  ]);
  assert.deepEqual([sim.state.phase, sim.state.wave, sim.state.age, sim.state.waveInAge, sim.state.lock, sim.state.buildTime], ['build', 1, 0, 1, 0, 0]);
  assert.equal(sim.state.gold, gold + 45);
  assert.equal(sim.state.stats.goldEarned, 45);
  assert.equal(sim.state.stats.perfectWaves, 1);
  sim.step();
  near(sim.state.buildTime, SIM_DT, 1e-12);

  assert.deepEqual(sim.startWave(), { ok: true });
  sim.drainEvents();
  sim.step();
  // Die nächste Welle gehört zum zweiten Zeitalter.
  assert.deepEqual(sim.drainEvents(), [
    { type: 'gold', amount: 45, reason: 'wave', x: 6.5, z: 0 },
    { type: 'waveClear', wave: 1, bonus: 45, perfect: true },
    { type: 'age', from: 0, to: 1, gift: 160 },
    { type: 'gold', amount: 160, reason: 'age', x: 6.5, z: 0 },
  ]);
  assert.deepEqual([sim.state.phase, sim.state.wave, sim.state.age, sim.state.waveInAge, sim.state.lock], ['build', 2, 1, 0, AGE_LOCK]);
  assert.deepEqual(sim.startWave(), { ok: false, reason: 'phase' }, 'gesperrt');
  assert.equal(sim.ability(), sim.content.abilities[1]);
  steps(sim, 299);
  assert.ok(sim.state.lock > 0);
  assert.equal(sim.state.buildTime, 0, 'buildTime wächst erst nach der Sperre');
  assert.equal(sim.earlyBonus(), 30, 'volle Frühstart-Prämie des neuen Zeitalters, solange gesperrt ist');
  assert.deepEqual(sim.startWave(), { ok: false, reason: 'phase' });
  sim.step();
  assert.equal(sim.state.lock, 0);
  near(sim.state.buildTime, SIM_DT, 1e-12);
  sim.drainEvents();
  assert.deepEqual(sim.startWave(), { ok: true });
  const start = ofType(sim.drainEvents(), 'waveStart')[0];
  assert.deepEqual([start.wave, start.age, start.waveInAge], [2, 1, 0]);
});

test('earlyBonus: nichts vor der ersten Welle, schmilzt über earlyBonusTime, wird beim Start gutgeschrieben', () => {
  const sim = makeSim({ edit: emptyWaves([3, 1, 1]) });
  assert.equal(sim.earlyBonus(), 0, 'vor der allerersten Welle');
  sim.startWave();
  assert.equal(ofType(sim.drainEvents(), 'gold').length, 0);
  assert.equal(sim.earlyBonus(), 0, 'während der Welle');
  sim.step();
  assert.equal(sim.earlyBonus(), 15, 'round(30 * 0,5 * 1)');
  steps(sim, 240);
  assert.equal(sim.earlyBonus(), 9, 'nach 4 von 10 Sekunden: 15 * 0,6');
  const gold = sim.state.gold;
  const earned = sim.state.stats.goldEarned;
  sim.drainEvents();
  assert.deepEqual(sim.startWave(), { ok: true });
  assert.equal(sim.state.gold, gold + 9);
  assert.equal(sim.state.stats.goldEarned, earned + 9);
  assert.deepEqual(sim.drainEvents(), [
    { type: 'gold', amount: 9, reason: 'early', x: 6.5, z: 0 },
    { type: 'waveStart', wave: 1, age: 0, waveInAge: 1, boss: false, early: 9 },
  ]);
  sim.step();
  assert.equal(sim.earlyBonus(), 15);
  steps(sim, 570);
  assert.equal(sim.earlyBonus(), 1, 'nach 9,5 Sekunden: 15 * 0,05 = 0,75');
  steps(sim, 60);
  assert.equal(sim.earlyBonus(), 0, 'nach Ablauf nie negativ');
  const late = sim.state.gold;
  sim.drainEvents();
  sim.startWave();
  assert.equal(sim.state.gold, late);
  assert.deepEqual(sim.drainEvents().map((event) => event.type), ['waveStart'], 'kein Gold-Ereignis bei Prämie 0');
});

test('wavePreview fasst je Gegnerart zusammen, in Reihenfolge des ersten Erscheinens', () => {
  const sim = makeSim({ mapId: 'bend' });
  const first = sim.wavePreview();
  assert.deepEqual([first?.wave, first?.age, first?.waveInAge, first?.boss, first?.hint], [0, 0, 0, false, 'Zum Aufwärmen']);
  assert.deepEqual(first?.groups.map((group) => [group.def.id, group.count]), [['grunt', 6]]);
  const boss = sim.wavePreview(2);
  assert.equal(boss?.boss, true);
  assert.deepEqual(boss?.groups.map((group) => [group.def.id, group.count]), [['knight', 3], ['bird', 3], ['boss', 1]]);
  assert.deepEqual([sim.wavePreview(3)?.age, sim.wavePreview(3)?.waveInAge, sim.wavePreview(8)?.wave], [1, 0, 8]);
  assert.equal(sim.wavePreview(9), null);
  assert.equal(sim.wavePreview(-1), null);
  const mixed = makeSim({
    edit: (c) => oneWave(c, [{ enemy: 'grunt', count: 2, interval: 1, delay: 5 }, { enemy: 'runner', count: 3, interval: 1, delay: 1 }, { enemy: 'grunt', count: 4, interval: 1, delay: 9 }]),
  });
  assert.deepEqual(mixed.wavePreview()?.groups.map((group) => [group.def.id, group.count]), [['runner', 3], ['grunt', 6]]);
});

test('Erscheinen: der k-te Gegner einer Gruppe kommt zur Wellenzeit delay + k * interval; pending zählt herunter', () => {
  const sim = scene({ wave: [{ enemy: 'grunt', count: 3, interval: 0.5, delay: 2 }, { enemy: 'runner', count: 2, interval: 1, delay: 0 }] });
  steps(sim, 7);
  sim.startWave();
  assert.equal(sim.state.pending, 5);
  const boss = ofType(sim.drainEvents(), 'waveStart')[0];
  assert.equal(boss.boss, false);
  const spawns = timeline(sim, 200).filter((entry) => entry.event.type === 'spawn');
  assert.deepEqual(spawns.map((entry) => [entry.tick - 7, /** @type {any} */ (entry.event).enemy.def.id]), [[1, 'runner'], [60, 'runner'], [120, 'grunt'], [150, 'grunt'], [180, 'grunt']]);
  assert.equal(sim.state.pending, 0);
  // Kennungen steigen in der Reihenfolge des Erscheinens.
  const ids = spawns.map((entry) => /** @type {any} */ (entry.event).enemy.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, 5);

  const one = scene({ wave: [{ enemy: 'grunt', count: 3, interval: 1, delay: 1 }] });
  one.startWave();
  steps(one, 59);
  assert.deepEqual([one.state.pending, one.state.enemies.length], [3, 0]);
  one.step();
  assert.deepEqual([one.state.pending, one.state.enemies.length], [2, 1]);
  // Ein neuer Gegner startet bei dist 0 und läuft noch im selben Zeitschritt los.
  const enemy = one.state.enemies[0];
  near(enemy.dist, SIM_DT, 1e-12);
  near(enemy.age, SIM_DT, 1e-12);
  assert.deepEqual([enemy.hp, enemy.maxHp, enemy.shield, enemy.slow, enemy.dot, enemy.phase, enemy.boost, enemy.alive, enemy.path], [20, 20, 0, 0, 0, 0, 1, true, 0]);
  near(enemy.px, -6.5, 1e-6);
  near(enemy.x, -6.5 + SIM_DT, 1e-6);
  assert.equal(one.enemyById(enemy.id), enemy);
  assert.equal(one.enemyById(555), null);
});

test('Erscheinen: ohne path reihum durch alle Wege, mit path auf diesem Weg; Bosswelle wird angekündigt', () => {
  const sim = scene({
    map: 'fork',
    wave: [{ enemy: 'grunt', count: 5, interval: 0.1, delay: 0 }, { enemy: 'runner', count: 2, interval: 0.1, delay: 0, path: 1 }, { enemy: 'boss', count: 1, interval: 0, delay: 0, path: 0 }],
  });
  sim.startWave();
  assert.equal(ofType(sim.drainEvents(), 'waveStart')[0].boss, true);
  steps(sim, 40);
  const byKind = /** @param {string} id */ (id) => sim.state.enemies.filter((enemy) => enemy.def.id === id).map((enemy) => enemy.path);
  assert.deepEqual(byKind('grunt'), [0, 1, 0, 1, 0]);
  assert.deepEqual(byKind('runner'), [1, 1]);
  assert.deepEqual(byKind('boss'), [0]);
  // Weg 0 beginnt bei z = -2, Weg 1 bei z = +2.
  for (const enemy of sim.state.enemies) near(enemy.z, enemy.path === 0 ? -2 : 2, 0.2800001);
});

test('lane: zufällig in [-0,28; 0,28], Bosse in der Wegmitte; die Lage ist Wegpunkt plus lane mal Normale', () => {
  const sim = scene({ wave: [{ enemy: 'grunt', count: 40, interval: 0.05, delay: 0 }, { enemy: 'boss', count: 2, interval: 0.5, delay: 0 }] });
  sim.startWave();
  steps(sim, 150);
  const lanes = sim.state.enemies.filter((enemy) => !enemy.def.boss).map((enemy) => enemy.lane);
  assert.equal(lanes.length, 40);
  assert.ok(lanes.every((lane) => lane >= -0.28 && lane <= 0.28));
  assert.ok(new Set(lanes).size >= 39, 'die Bahnen unterscheiden sich');
  assert.ok(Math.min(...lanes) < -0.14 && Math.max(...lanes) > 0.14, 'die Breite wird genutzt');
  for (const enemy of sim.state.enemies) {
    if (enemy.def.boss) assert.equal(enemy.lane, 0);
    // Gerader Weg in +x: Normale (-dz, dx) = (0, 1).
    near(enemy.z, enemy.lane, 1e-6);
    near(enemy.x, -6.5 + enemy.dist, 1e-5);
    assert.deepEqual([enemy.dx, enemy.dz], [1, 0]);
    near(enemy.progress, enemy.dist / 13, 1e-12);
  }
});

test('Gegnerwerte richten sich nach dem Zeitalter der Welle und dem Schwierigkeitsgrad', () => {
  const sim = makeSim({
    difficulty: 'hard',
    edit: (content) => {
      content.waves = [[{ groups: [] }], [{ groups: [] }, { groups: [{ enemy: 'knight', count: 1, interval: 0, delay: 0 }, { enemy: 'mage', count: 1, interval: 0, delay: 0 }, { enemy: 'grunt', count: 1, interval: 0, delay: 0 }] }], [{ groups: [] }]];
    },
  });
  passWave(sim);
  passWave(sim);
  sim.startWave();
  sim.step();
  const [knight, mage, grunt] = sim.state.enemies;
  assert.deepEqual([sim.state.age, sim.state.waveInAge], [1, 1]);
  assert.deepEqual([knight.hp, knight.maxHp, knight.armor, knight.bounty], [110, 110, 10, 16], 'hp 20 * 2 * 1,1 * 2 * 1,25; Rüstung 0,5 * 10 * 2');
  near(knight.speed, 0.8 * 1.1, 1e-12);
  assert.deepEqual([mage.hp, mage.shield, mage.maxShield], [110, 55, 55]);
  assert.deepEqual([grunt.hp, grunt.bounty], [55, 8], 'der Steinzeit-Gegner (def.age stone) zählt hier als Gegner des zweiten Zeitalters');
  assert.deepEqual(rules.enemyStats(sim.content, grunt.def, 1, 1, 'hard'), { hp: 55, armor: 0, shield: 0, bounty: 8, speed: 1.1 });
});

test('Durchkommen: kostet def.lives, bringt kein Kopfgeld; ein durchgekommener Träger setzt nichts aus', () => {
  const sim = scene({ wave: [{ enemy: 'grunt', count: 1, interval: 0, delay: 0 }, { enemy: 'wagon', count: 1, interval: 0, delay: 0 }] });
  const gold = sim.state.gold;
  sim.startWave();
  const events = collect(sim, 60 * 25);
  assert.equal(sim.state.lives, 17);
  assert.deepEqual(ofType(events, 'leak').map((event) => [event.enemy.def.id, event.lives, event.enemy.alive]), [['grunt', 1, false], ['wagon', 2, false]]);
  assert.equal(ofType(events, 'spawn').length, 2, 'keine Fracht');
  assert.equal(ofType(events, 'kill').length, 0);
  assert.deepEqual(ofType(events, 'waveClear'), [{ type: 'waveClear', wave: 0, bonus: 30, perfect: false }]);
  assert.deepEqual(ofType(events, 'gold').map((event) => [event.reason, event.amount]), [['wave', 30], ['age', 160]], 'kein Kopfgeld, kein Makellos-Zuschlag');
  assert.equal(sim.state.gold, gold + 30 + 160);
  assert.deepEqual([sim.state.stats.leaks, sim.state.stats.kills, sim.state.stats.perfectWaves], [2, 0, 0]);
  assert.equal(sim.state.score, 100, 'überstandene Welle ohne Makellos-Faktor');
  // Der Läufer mit Tempo 1 erreicht das Ende des 13 Felder langen Weges im Zeitschritt 780.
  const again = scene({ wave: [{ enemy: 'grunt', count: 1, interval: 0, delay: 0 }] });
  again.startWave();
  steps(again, 779);
  assert.equal(again.state.enemies.length, 1);
  again.step();
  assert.deepEqual([again.state.enemies.length, again.state.lives, again.state.phase], [0, 19, 'build']);
});

test('Niederlage: lives sinkt nicht unter 0, der Zeitschritt endet sofort, danach geschieht nichts mehr', () => {
  const sim = scene({
    enemies: { dicker: { boss: true, speed: 2, lives: 10 }, hinterher: { speed: 1 } },
    wave: [{ enemy: 'dicker', count: 1, interval: 0, delay: 0 }, { enemy: 'hinterher', count: 1, interval: 0, delay: 0 }],
    edit: (c) => void (c.balance.difficulty.normal.lives = 3),
  });
  const tower = mustBuild(sim, 'shooter', 1, 1);
  sim.startWave();
  sim.step();
  const [boss, follower] = sim.state.enemies.slice();
  const events = collect(sim, 60 * 8);
  assert.equal(sim.state.phase, 'lost');
  assert.equal(sim.state.lives, 0);
  assert.deepEqual(ofType(events, 'leak').map((event) => event.lives), [3], 'verloren gehen nur die Leben, die es noch gab');
  assert.equal(events[events.length - 1].type, 'lost');
  assert.equal(events[events.length - 2].type, 'leak', 'nach dem Durchkommen folgt im selben Zeitschritt nichts mehr');
  assert.equal(sim.state.tick, 390, '13 Felder bei Tempo 2');
  near(boss.age, 390 * SIM_DT, 1e-9);
  near(follower.age, 389 * SIM_DT, 1e-9, 'der Gegner hinter dem Durchgekommenen wurde im letzten Zeitschritt nicht mehr bewegt');
  assert.deepEqual(sim.state.enemies, [follower]);
  // Nichts geht mehr.
  const frozen = JSON.stringify([sim.state.tick, sim.state.time, sim.state.gold, follower.dist]);
  steps(sim, 50);
  assert.equal(JSON.stringify([sim.state.tick, sim.state.time, sim.state.gold, follower.dist]), frozen);
  assert.equal(sim.drainEvents().length, 0);
  for (const result of [sim.build('shooter', 2, 1), sim.upgrade(tower.id), sim.modernize(tower.id), sim.sell(tower.id), sim.setTargetMode(tower.id, 'last'), sim.startWave(), sim.useAbility(0, 0), sim.canBuild(2, 1)]) {
    assert.deepEqual(result, { ok: false, reason: 'phase' });
  }
  assert.equal(sim.earlyBonus(), 0);
  assert.equal(sim.save(), null);
});

test('Sieg und Punkte: Abschuss 10 * (Zeitalter + 1) * bounty, Welle 100 * (Zeitalter + 1), makellos x1,5, Sieg 250 je Leben', () => {
  for (const [difficulty, expected] of /** @type {const} */ ([['normal', 20 + 5 + 150 + 300 + 450 + 5000], ['hard', 30 + 8 + 225 + 450 + 675 + 3750]])) {
    const sim = scene({
      difficulty,
      towers: { kanone: { damage: 1000, cooldown: 0.1 } },
      wave: [{ enemy: 'grunt', count: 2, interval: 1, delay: 0 }, { enemy: 'kleiner', count: 1, interval: 0, delay: 0 }],
      edit: (c) => void (c.enemies.kleiner = { ...c.enemies.grunt, id: 'kleiner', bounty: 0.5 }),
    });
    const tower = mustBuild(sim, 'kanone', 0, 2);
    sim.startWave();
    const events = collect(sim, 200);
    assert.equal(sim.state.phase, 'build');
    assert.equal(sim.state.stats.kills, 3);
    assert.equal(tower.kills, 3);
    passWave(sim);
    assert.deepEqual([sim.state.phase, sim.state.age], ['build', 2]);
    sim.drainEvents();
    sim.startWave();
    sim.step();
    assert.equal(sim.state.phase, 'won');
    assert.equal(sim.state.wave, sim.totalWaves);
    assert.equal(sim.state.score, expected, difficulty);
    const last = sim.drainEvents();
    assert.deepEqual(last.map((event) => event.type), ['gold', 'waveStart', 'gold', 'waveClear', 'won'], 'Frühstart-Prämie, Start, Wellenprämie, Sieg');
    assert.ok(Number.isInteger(sim.state.score));
    // Kopfgeld: 5 Gold je Standardgegner (knifflig: mal 0,8), mindestens 1.
    const bounty = difficulty === 'normal' ? [5, 3, 5] : [4, 2, 4];
    assert.deepEqual(ofType(events, 'kill').map((event) => [event.bounty, event.towerId]), bounty.map((b) => [b, tower.id]));
    const tick = sim.state.tick;
    steps(sim, 10);
    assert.equal(sim.state.tick, tick, 'nach dem Sieg geschieht nichts');
    assert.deepEqual(sim.startWave(), { ok: false, reason: 'phase' });
    assert.deepEqual(sim.build('shooter', 3, 1), { ok: false, reason: 'phase' });
    assert.equal(sim.save(), null);
  }
});

test('Punkte: Abschüsse und Wellen zählen mit dem Zeitalter der Welle, alles mal difficulty.score und gerundet', () => {
  // Je Zeitalter eine Welle mit einem Gegner: Läufer (bounty 1), Ritter (bounty 2), Renner (bounty 0,6).
  for (const [difficulty, expected] of /** @type {const} */ ([['normal', [10 + 150, 40 + 300, 18 + 450 + 5000]], ['hard', [15 + 225, 60 + 450, 27 + 675 + 3750]]])) {
    const sim = makeSim({
      difficulty,
      edit: (c) => {
        addArch(c, 'kanone', { damage: 1e6, cooldown: 0.1 });
        c.waves = [['grunt'], ['knight'], ['runner']].map(([enemy]) => [{ groups: [{ enemy, count: 1, interval: 0, delay: 0 }] }]);
      },
    });
    mustBuild(sim, 'kanone', 0, 2);
    let score = 0;
    for (let age = 0; age < 3; age++) {
      stepUntil(sim, () => sim.state.lock === 0);
      assert.deepEqual([sim.state.age, sim.state.score], [age, score]);
      sim.startWave();
      stepUntil(sim, () => sim.state.phase !== 'wave');
      score += expected[age];
      assert.equal(sim.state.score, score, `${difficulty}, Zeitalter ${age}`);
    }
    assert.equal(sim.state.phase, 'won');
  }
});

test('Fähigkeit ohne Zielen: wirft jeden Gegner zurück (Bosse halb), verlangsamt mit slowResist, lädt dann ab', () => {
  const sim = scene({
    enemies: { laeufer: { speed: 1 }, chef: { boss: true, speed: 1 }, vogel: { flying: true, speed: 1 }, zaeh: { speed: 1, slowResist: 0.5 }, spaet: { speed: 1 } },
    wave: [
      { enemy: 'laeufer', count: 1, interval: 0, delay: 0 },
      { enemy: 'chef', count: 1, interval: 0, delay: 0 },
      { enemy: 'vogel', count: 1, interval: 0, delay: 0 },
      { enemy: 'zaeh', count: 1, interval: 0, delay: 0 },
      { enemy: 'spaet', count: 1, interval: 0, delay: 5 },
    ],
  });
  sim.startWave();
  steps(sim, 360);
  const [walker, boss, bird, tough, late] = sim.state.enemies;
  near(walker.dist, 6, 1e-9);
  near(late.dist, 61 / 60, 1e-9, 'erschienen im Zeitschritt 300, seither 61 Schritte gelaufen');
  sim.drainEvents();
  assert.deepEqual(sim.useAbility(NaN, NaN), { ok: true }, 'bei radius 0 ist der Ort ohne Bedeutung');
  near(walker.dist, 2, 1e-9, 'Tempo 1 * 4 Sekunden zurück');
  near(boss.dist, 4, 1e-9, 'Bosse nur um die Hälfte');
  near(bird.dist, 2, 1e-9, 'hitsAir: auch Flieger');
  assert.equal(late.dist, 0, 'nicht hinter den Eingang');
  // Lage und progress sofort neu, px/pz auf der neuen Lage.
  near(walker.x, -4.5, 1e-5);
  assert.deepEqual([walker.px, walker.pz], [walker.x, walker.z]);
  near(walker.progress, 2 / 13, 1e-9);
  assert.equal(late.progress, 0);
  assert.deepEqual([walker.slow, walker.slowTime, boss.slow, tough.slow, tough.slowTime], [0.5, 3, 0.5, 0.25, 3]);
  assert.equal(walker.sinceHit, Infinity, 'ohne Schaden gilt das nicht als Treffer');
  assert.equal(walker.hp, walker.maxHp);
  assert.equal(sim.state.abilityCooldown, 30);
  assert.equal(sim.state.stats.abilitiesUsed, 1);
  const events = sim.drainEvents();
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].type, /** @type {any} */ (events[0]).def], ['ability', sim.content.abilities[0]]);
  // Lädt 30 Sekunden.
  assert.deepEqual(sim.useAbility(0, 0), { ok: false, reason: 'cooldown' });
  near(walker.dist, 2, 1e-9);
  assert.equal(sim.state.stats.abilitiesUsed, 1);
  sim.step();
  near(walker.speed, 0.5, 1e-12);
  near(tough.speed, 0.75, 1e-12);
  steps(sim, 1798);
  assert.ok(sim.state.abilityCooldown > 0);
  assert.deepEqual(sim.useAbility(0, 0), { ok: false, reason: 'cooldown' });
  sim.step();
  assert.equal(sim.state.abilityCooldown, 0);
});

test('Fähigkeit: Zurückwerfen rechnet mit dem Grundtempo, auch bei verlangsamten Gegnern; Flieger nur mit hitsAir', () => {
  const sim = scene({
    enemies: { laeufer: { speed: 1.5 }, vogel: { flying: true, speed: 1.5 } },
    wave: [{ enemy: 'laeufer', count: 1, interval: 0, delay: 0 }, { enemy: 'vogel', count: 1, interval: 0, delay: 0 }],
    edit: (c) => void (c.abilities[0] = { ...c.abilities[0], cooldown: 0, rewind: 2, hitsAir: false }),
  });
  sim.startWave();
  steps(sim, 240);
  const [walker, bird] = sim.state.enemies;
  near(walker.dist, 6, 1e-9);
  assert.deepEqual(sim.useAbility(0, 0), { ok: true });
  near(walker.dist, 3, 1e-9);
  near(bird.dist, 6, 1e-9, 'ohne hitsAir bleibt der Flieger unberührt');
  assert.equal(bird.slow, 0);
  sim.step();
  near(walker.speed, 0.75, 1e-12);
  assert.equal(sim.state.abilityCooldown, 0, 'cooldown 0: sofort wieder bereit');
  const dist = walker.dist;
  assert.deepEqual(sim.useAbility(0, 0), { ok: true });
  near(walker.dist, dist - 3, 1e-9, 'Grundtempo 1,5 * 2 Sekunden, nicht das verlangsamte Tempo');
});

test('Fähigkeit mit Zielen: Schaden ohne Rüstungsabzug im Umkreis, Abschüsse zählen für keinen Turm', () => {
  const sim = scene({
    enemies: { panzer: { ...STILL, armor: 5 }, fern: { ...STILL }, vogel: { ...STILL, flying: true }, klein: { ...STILL, hp: 1, bounty: 2 } },
    wave: ['panzer', 'fern', 'vogel', 'klein'].map((enemy) => ({ enemy, count: 1, interval: 0, delay: 0 })),
    edit: (c) => void (c.abilities[0] = { ...c.abilities[1], cooldown: 0 }),
  });
  const [tank, far, bird, small] = begin(sim, [3, 6, 3, 4.4]);
  const bystander = mustBuild(sim, 'support', 0, 2);
  sim.step();
  sim.drainEvents();
  assert.equal(tank.armor, 50);
  assert.deepEqual(sim.useAbility(NaN, 0), { ok: false, reason: 'unknown' }, 'eine gezielte Fähigkeit braucht einen Ort');
  assert.deepEqual(sim.useAbility(-3.5, 0), { ok: true });
  near(tank.hp, 50, 1e-9, '5 * 10 * 1 Schaden, Rüstung zählt nicht');
  assert.equal(tank.sinceHit, 0);
  assert.equal(far.hp, 100, 'außerhalb des Radius 1,5');
  assert.equal(bird.hp, 100, 'hitsAir false');
  assert.equal(small.alive, false, 'am Rand des Radius (Abstand 1,4) getroffen');
  near(sim.state.stats.damageDealt, 70, 1e-9);
  const ability = sim.drainEvents();
  assert.deepEqual(ability.map((event) => event.type), ['ability']);
  assert.deepEqual([/** @type {any} */ (ability[0]).x, /** @type {any} */ (ability[0]).z], [-3.5, 0]);
  const gold = sim.state.gold;
  sim.step();
  const events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'kill').map((event) => [event.enemy, event.bounty, event.towerId]), [[small, 10, -1]]);
  assert.deepEqual(ofType(events, 'damage').map((event) => [event.enemy.def.id, Math.round(event.amount), event.shield]), [['panzer', 50, false], ['klein', 20, false]]);
  assert.equal(sim.state.gold, gold + 10);
  assert.equal(bystander.kills, 0);
  assert.equal(sim.state.stats.kills, 1);
  assert.equal(sim.state.enemies.includes(small), false);
});

test('Fähigkeit mit Schaden und Verlangsamung trifft auch in der Bauphase ins Leere und lädt trotzdem', () => {
  const sim = makeSim({ edit: (c) => void (c.abilities[0] = c.abilities[2]) });
  assert.deepEqual(sim.useAbility(0, 0), { ok: true });
  assert.equal(sim.state.abilityCooldown, 25);
  steps(sim, 60);
  near(sim.state.abilityCooldown, 24, 1e-9);
});

test('Kennungen werden nie doppelt vergeben: Türme, Gegner, Geschosse und Bodenfelder teilen sich einen Zähler', () => {
  const sim = makeSim({ mapId: 'bend', edit: (c) => void (c.balance.startGold = 5000) });
  /** @type {number[]} */
  const ids = [];
  mustBuild(sim, 'shooter', 3, 2);
  mustBuild(sim, 'slower', 3, 0);
  mustBuild(sim, 'thrower', 5, 2);
  const sold = mustBuild(sim, 'flak', 5, 4);
  sim.sell(sold.id);
  mustBuild(sim, 'flak', 5, 4);
  const seen = new Set();
  /** @param {{ id: number }[]} list */
  const note = (list) => {
    for (const item of list) {
      if (!seen.has(item)) {
        seen.add(item);
        ids.push(item.id);
      }
    }
  };
  ids.push(sold.id);
  for (let wave = 0; wave < 2; wave++) {
    sim.startWave();
    while (sim.state.phase === 'wave') {
      sim.step();
      note(sim.state.towers);
      note(sim.state.projectiles);
      note(sim.state.zones);
      for (const event of sim.drainEvents()) if (event.type === 'spawn') ids.push(event.enemy.id);
    }
  }
  assert.ok(ids.length > 40, `${ids.length} Kennungen gesammelt`);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => Number.isInteger(id) && id > 0));
});
