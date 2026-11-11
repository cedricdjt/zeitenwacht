// @ts-check
// Simulation, Teil 3: lange Läufe. Determinismus, Speichern und Laden, ganze Partien, Bots, Leistung.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSim } from '../src/sim/sim.js';
import { makeRng } from '../src/util/rng.js';
import { addFusion, makeContent } from './fixtures/content.mjs';
import { buildSpots, collect, digest, greedyBot, makeSim, mustBuild, near, ofType, play, snapshot, steps, stepUntil } from './fixtures/harness.mjs';

/** @import { Content, TargetMode } from '../src/types/content' */
/** @import { SaveData, Sim, SimConfig, SimEvent, Tower } from '../src/types/sim' */

const MODES = /** @type {const} */ (['first', 'last', 'strong', 'weak', 'near']);

/**
 * Ein Spieler ohne Gedächtnis, der bunt durcheinander Befehle gibt: Was er tut, hängt nur vom Zeitschritt und vom Zustand ab.
 * Zwei Partien im selben Zustand bekommen also dieselben Befehle, auch nach dem Laden eines Spielstands.
 * @param {Sim} sim
 */
function scriptPlayer(sim) {
  const state = sim.state;
  const rng = makeRng(state.tick * 7919 + 13);
  const towers = state.towers;
  const archetypes = sim.content.archetypes;
  if (rng.chance(state.phase === 'build' ? 0.3 : 0.01)) sim.build(rng.pick(archetypes).id, rng.int(0, sim.map.width - 1), rng.int(0, sim.map.height - 1));
  if (towers.length > 0 && rng.chance(0.02)) sim.upgrade(rng.pick(towers).id, rng.int(0, 1));
  if (towers.length > 0 && rng.chance(0.05)) sim.modernize(rng.pick(towers).id);
  if (towers.length > 8 && rng.chance(0.004)) sim.sell(rng.pick(towers).id);
  if (towers.length > 0 && rng.chance(0.02)) sim.setTargetMode(rng.pick(towers).id, /** @type {TargetMode} */ (rng.pick(MODES)));
  if (state.enemies.length > 0 && rng.chance(0.01)) {
    const enemy = rng.pick(state.enemies);
    sim.useAbility(enemy.x, enemy.z);
  }
  if (state.phase === 'build' && rng.chance(0.01)) sim.startWave();
}

/**
 * Wie `scriptPlayer`, aber auf Superwaffen aus: baut dicht an dicht um wenige Kerne, baut zügig aus und verschmilzt, sobald
 * ein Kern zwei Zutaten findet, in der Bauphase wie mitten in der Welle. Entscheidet nur aus Zeitschritt und Zustand.
 * @param {Sim} sim
 */
function fusePlayer(sim) {
  const state = sim.state;
  const rng = makeRng(state.tick * 104729 + 7);
  const towers = state.towers;
  const roles = ['shooter', 'burner', 'slower', 'thrower', 'piercer', 'support'];
  if (rng.chance(0.2)) sim.build(rng.pick(roles), rng.int(1, 6), rng.int(0, 2));
  if (towers.length > 0 && rng.chance(0.3)) sim.upgrade(rng.pick(towers).id, rng.int(0, 1));
  if (towers.length > 0 && rng.chance(0.05)) sim.modernize(rng.pick(towers).id);
  if (towers.length > 0 && rng.chance(0.002)) sim.sell(rng.pick(towers).id);
  if (towers.length > 2 && rng.chance(0.1)) {
    const core = rng.pick(towers);
    const parts = sim.fuseCandidates(core.id);
    if (parts.length >= 2) sim.fuse(core.id, [parts[parts.length - 1].id, parts[0].id]);
  }
  if (state.phase === 'build' && rng.chance(0.004)) sim.startWave();
}

/**
 * Inhalte für lange gemischte Läufe: viel Gold und viele Leben, damit die Partie alle Wellen sieht.
 * @param {Content} content
 */
function rich(content) {
  content.balance.startGold = 1500;
  content.balance.difficulty.normal.lives = 500;
}

/**
 * Ereignisse als Text (Verweise werden zu Kennungen).
 * @param {SimEvent[]} events
 */
function eventText(events) {
  return JSON.stringify(events, (key, value) => {
    if (key === 'def' || key === 'arch') return value.id ?? value.name;
    if (key === 'enemy' || key === 'tower' || key === 'zone') return value.id;
    return value;
  });
}

/**
 * Prüft die Größen, die nie entgleisen dürfen.
 * @param {Sim} sim
 */
function sane(sim) {
  const s = sim.state;
  assert.ok(Number.isInteger(s.gold) && s.gold >= 0, `Gold ${s.gold}`);
  assert.ok(Number.isInteger(s.lives) && s.lives >= 0 && s.lives <= s.maxLives, `Leben ${s.lives}`);
  assert.ok(Number.isInteger(s.score) && s.score >= 0, `Punkte ${s.score}`);
  assert.ok(Number.isFinite(s.time) && s.lock >= 0 && s.abilityCooldown >= 0 && s.pending >= 0);
  for (const enemy of s.enemies) {
    const numbers = [enemy.hp, enemy.shield, enemy.dist, enemy.progress, enemy.x, enemy.z, enemy.px, enemy.pz, enemy.dx, enemy.dz, enemy.speed, enemy.slow, enemy.slowTime, enemy.dot, enemy.dotTime, enemy.boost, enemy.boostTime];
    assert.ok(numbers.every(Number.isFinite), `Gegner ${enemy.id} (${enemy.def.id}): ${numbers}`);
    assert.ok(enemy.hp >= 0 && enemy.hp <= enemy.maxHp && enemy.shield >= 0 && enemy.shield <= enemy.maxShield && enemy.progress >= 0 && enemy.progress <= 1 && enemy.slow >= 0 && enemy.slow < 1);
  }
  for (const tower of s.towers) {
    assert.ok(Number.isFinite(tower.cooldown) && Number.isFinite(tower.aimX) && Number.isFinite(tower.aimZ) && Number.isFinite(tower.damageDealt) && Number.isInteger(tower.invested));
  }
  for (const p of s.projectiles) assert.ok(Number.isFinite(p.t) && Number.isFinite(p.tx) && Number.isFinite(p.tz) && p.t >= p.pt);
  for (const zone of s.zones) assert.ok(zone.time > 0 && zone.time <= zone.duration);
}

test('Determinismus: gleiche Konfiguration und gleiche Befehle ergeben bitgenau denselben Verlauf', () => {
  /** @type {Partial<SimConfig> & { edit: (content: Content) => void }} */
  const options = { mapId: 'fork', seed: 4242, edit: rich };
  const a = makeSim(options);
  const b = makeSim(options);
  let compared = 0;
  let zones = 0;
  let projectiles = 0;
  for (let i = 0; i < 60 * 600 && a.state.phase !== 'won' && a.state.phase !== 'lost'; i++) {
    scriptPlayer(a);
    scriptPlayer(b);
    a.step();
    b.step();
    assert.equal(eventText(a.drainEvents()), eventText(b.drainEvents()), `Ereignisse im Zeitschritt ${a.state.tick}`);
    zones += a.state.zones.length;
    projectiles += a.state.projectiles.length;
    if (i % 30 === 0) {
      assert.equal(digest(a), digest(b), `Zustand im Zeitschritt ${a.state.tick}`);
      sane(a);
      compared += 1;
    }
  }
  assert.equal(snapshot(a), snapshot(b));
  // Der Lauf war wirklich lang und gemischt.
  const stats = a.state.stats;
  assert.equal(a.state.phase, 'won', `Phase ${a.state.phase} in Welle ${a.state.wave}`);
  assert.ok(compared > 200, `${compared} Vergleiche`);
  assert.ok(stats.kills > 80 && stats.towersBuilt > 15 && stats.towersSold > 0 && stats.upgrades > 3 && stats.modernizations > 3 && stats.abilitiesUsed > 3, JSON.stringify(stats));
  assert.ok(zones > 0 && projectiles > 0);
  assert.ok(new Set(a.state.towers.map((tower) => tower.arch.id)).size >= 4, 'viele Rollen im Einsatz');
});

test('Determinismus: ein anderer Startwert gibt andere Bahnen, derselbe dieselben', () => {
  /** @param {number} seed */
  const lanes = (seed) => {
    const sim = makeSim({ mapId: 'bend', seed });
    sim.startWave();
    steps(sim, 400);
    return sim.state.enemies.map((enemy) => enemy.lane);
  };
  const one = lanes(1);
  assert.equal(one.length, 6);
  assert.deepEqual(lanes(1), one);
  const two = lanes(2);
  assert.ok(one.every((lane, index) => lane !== two[index]), 'alle Bahnen unterscheiden sich');
  // Und damit der ganze weitere Verlauf.
  const a = makeSim({ mapId: 'fork', seed: 1, edit: rich });
  const b = makeSim({ mapId: 'fork', seed: 2, edit: rich });
  for (let i = 0; i < 3000; i++) {
    scriptPlayer(a);
    scriptPlayer(b);
    a.step();
    b.step();
  }
  assert.notEqual(digest(a), digest(b));
});

test('Speichern und Laden: die geladene Partie verläuft bei gleichen Befehlen genau wie die ungespeicherte', () => {
  /** @type {SimConfig} */
  const config = { content: makeContent(), mapId: 'fork', difficulty: 'normal', seed: 77, unlockAll: true };
  rich(config.content);
  const a = createSim(config);
  /** Wellen, vor denen gespeichert und verglichen wurde. @type {number[]} */
  const boundaries = [];
  let lastWave = 0;
  let checked = 0;
  let withProjectiles = 0;
  let withCooldown = 0;
  let locked = 0;
  for (let guard = 0; guard < 60 * 900 && a.state.phase !== 'won' && a.state.phase !== 'lost'; guard++) {
    scriptPlayer(a);
    a.step();
    // Gespeichert wird in jeder Bauphase, die die Partie erreicht, während kein Vergleich läuft: meist in ihrem ersten Augenblick.
    if (!(a.state.phase === 'build' && a.state.wave > lastWave)) continue;
    const wave = a.state.wave;
    lastWave = wave;
    boundaries.push(wave);
    // Solange Bodenfelder liegen, gibt es keinen Spielstand.
    let save = a.save();
    while (save === null) {
      assert.ok(a.state.zones.length > 0 && a.state.phase === 'build');
      a.step();
      save = a.save();
    }
    if (a.state.projectiles.length > 0) withProjectiles += 1;
    if (a.state.abilityCooldown > 0) withCooldown += 1;
    if (a.state.lock > 0) locked += 1;
    const text = JSON.stringify(save);
    assert.deepEqual(JSON.parse(text), save, 'der Spielstand ist reines JSON');
    const b = createSim(config, JSON.parse(text));
    assert.equal(snapshot(b), snapshot(a), `Zustand direkt nach dem Laden vor Welle ${wave}`);
    assert.deepEqual([b.state.gold, b.state.lives, b.state.wave, b.state.age, b.state.score, b.state.abilityCooldown], [a.state.gold, a.state.lives, a.state.wave, a.state.age, a.state.score, a.state.abilityCooldown]);
    assert.deepEqual(b.state.stats, a.state.stats);
    assert.notEqual(b.state.stats, a.state.stats);
    assert.deepEqual(b.state.towers.map((t) => [t.id, t.arch.id, t.tier, t.level, t.tx, t.tz, t.mode, t.invested, t.kills, t.builtWave]), a.state.towers.map((t) => [t.id, t.arch.id, t.tier, t.level, t.tx, t.tz, t.mode, t.invested, t.kills, t.builtWave]));
    // Beide laufen mit denselben Befehlen weiter (auch über die nächsten Wellen) und müssen im Gleichschritt bleiben.
    a.drainEvents();
    b.drainEvents();
    for (let i = 0; i < 1500; i++) {
      scriptPlayer(a);
      scriptPlayer(b);
      a.step();
      b.step();
      assert.equal(eventText(a.drainEvents()), eventText(b.drainEvents()), `Ereignisse ${i} Zeitschritte nach dem Laden vor Welle ${wave}`);
      if (i % 40 === 0) assert.equal(snapshot(b), snapshot(a), `Zustand ${i} Zeitschritte nach dem Laden vor Welle ${wave}`);
    }
    assert.equal(snapshot(b), snapshot(a));
    assert.ok(b.state.wave > wave || b.state.phase !== 'build' || b.state.towers.length > 0, 'nach dem Laden wurde weitergespielt');
    checked += 1;
  }
  assert.ok(checked >= 4 && new Set(boundaries.map((wave) => a.content.waves[0].length <= wave ? (wave < 6 ? 1 : 2) : 0)).size === 3, `Spielstände vor den Wellen ${boundaries} (in allen drei Zeitaltern)`);
  assert.ok(withProjectiles > 0, 'mindestens ein Spielstand mit fliegenden Geschossen');
  assert.ok(withCooldown > 0, 'mindestens ein Spielstand mit ladender Fähigkeit');
  assert.ok(locked > 0, 'mindestens ein Spielstand während der Sperre nach einem Zeitalterwechsel');
});

test('Superwaffen im langen Lauf: deterministisch, verschmolzen in Bauphase und Welle, Speichern und Laden bitgenau', () => {
  /** @type {SimConfig} */
  const config = { content: addFusion(makeContent()), mapId: 'straight', difficulty: 'normal', seed: 31, unlockAll: true };
  config.content.balance.startGold = 20000;
  config.content.balance.difficulty.normal.lives = 5000;
  const a = createSim(config);
  const twin = createSim(config);
  let inWave = 0;
  let inBuild = 0;
  let checked = 0;
  let modernized = 0;
  let megaSaves = 0;
  let megaInWave = 0;
  let lastWave = 0;
  /** @param {SimEvent[]} events */
  const note = (events) => {
    for (const event of events) {
      if (event.type === 'fuse') {
        if (a.state.phase === 'wave' && event.mega) megaInWave += 1;
        if (a.state.phase === 'wave') inWave += 1;
        else inBuild += 1;
      }
      if (event.type === 'modernize' && event.tower.super) modernized += 1;
    }
    return events;
  };
  for (let guard = 0; guard < 60 * 600 && a.state.phase !== 'won' && a.state.phase !== 'lost'; guard++) {
    fusePlayer(a);
    fusePlayer(twin);
    a.step();
    twin.step();
    note(a.drainEvents());
    twin.drainEvents();
    sane(a);
    if (guard % 500 === 0) assert.equal(digest(twin), digest(a), `Zeitschritt ${guard}`);
    if (!(a.state.phase === 'build' && a.state.wave > lastWave && a.state.zones.length === 0)) continue;
    lastWave = a.state.wave;
    if (!a.state.towers.some((tower) => tower.super)) continue;
    const save = /** @type {SaveData} */ (a.save());
    const text = JSON.stringify(save);
    assert.ok(save.towers.some((tower) => tower.super === true && Array.isArray(tower.gifts) && tower.gifts.length === (tower.mega ? 4 : 2)));
    if (save.towers.some((tower) => tower.mega === true)) megaSaves += 1;
    const b = createSim(config, JSON.parse(text));
    assert.equal(snapshot(b), snapshot(a), `Zustand direkt nach dem Laden vor Welle ${lastWave}`);
    for (let i = 0; i < 600; i++) {
      fusePlayer(a);
      fusePlayer(twin);
      fusePlayer(b);
      a.step();
      twin.step();
      b.step();
      assert.equal(eventText(note(a.drainEvents())), eventText(b.drainEvents()), `Ereignisse ${i} Zeitschritte nach dem Laden vor Welle ${lastWave}`);
      twin.drainEvents();
    }
    assert.equal(snapshot(b), snapshot(a));
    checked += 1;
  }
  assert.equal(snapshot(twin), snapshot(a));
  assert.equal(a.state.stats.fusions + a.state.stats.megas, inWave + inBuild);
  assert.ok(a.state.stats.megas >= 1 && megaSaves >= 1 && megaInWave >= 1, `${a.state.stats.megas} Megawaffen (${megaInWave} in der Welle), ${megaSaves} Spielstände mit Megawaffe`);
  assert.ok(inWave >= 2 && inBuild >= 2, `${inBuild} Superwaffen in der Bauphase, ${inWave} in der Welle`);
  assert.ok(checked >= 3, `${checked} Spielstände mit Superwaffen verglichen`);
  assert.ok(modernized >= 1, 'mindestens eine Superwaffe wurde modernisiert');
  // Buchführung: Jeder Turm steht genau auf seinem Feld, die Liste bleibt nach Kennung geordnet.
  for (let i = 0; i < a.state.towers.length; i++) {
    const tower = a.state.towers[i];
    assert.equal(a.towerAt(tower.tx, tower.tz), tower);
    assert.ok(i === 0 || a.state.towers[i - 1].id < tower.id);
    assert.equal(tower.super, tower.gifts.length > 0);
  }
});

test('Spielstand mit Superwaffen: neue Felder im Spielstand, alte Spielstände ohne sie, kaputte mit verständlicher Meldung', () => {
  const sim = makeSim({ edit: (c) => void (addFusion(c), (c.balance.startGold = 5000)) });
  /**
   * @param {string} archId
   * @param {number} tx
   * @param {number} tz
   * @param {number} [branch]
   */
  const build3 = (archId, tx, tz, branch) => {
    const tower = mustBuild(sim, archId, tx, tz);
    sim.upgrade(tower.id);
    sim.upgrade(tower.id, branch);
    return tower;
  };
  const core = build3('shooter', 4, 1, 1);
  const p1 = build3('burner', 5, 1);
  const p2 = build3('slower', 3, 2);
  const sniper = build3('shooter', 8, 1, 1);
  const double = build3('shooter', 9, 1);
  const young = mustBuild(sim, 'shooter', 10, 1);
  const plainBurner = build3('burner', 1, 1);
  assert.deepEqual(sim.fuse(core.id, [p1.id, p2.id]), { ok: true });
  const save = /** @type {SaveData} */ (sim.save());
  assert.deepEqual(save.towers.map((t) => [t.arch, t.level, t.branch, t.super, t.gifts]), [
    ['shooter', 3, 1, true, ['burner', 'slower']],
    ['shooter', 3, 1, false, []],
    ['shooter', 3, 0, false, []],
    ['shooter', 1, -1, false, []],
    ['burner', 3, -1, false, []],
  ]);
  assert.equal(save.stats.fusions, 1);
  assert.notEqual(save.towers[0].gifts, core.gifts, 'der Spielstand teilt keine Listen mit dem Zustand');
  /** @param {(copy: any) => void} [change] */
  const load = (change) => {
    const copy = JSON.parse(JSON.stringify(save));
    if (change) change(copy);
    return makeSim({ edit: (c) => void addFusion(c) }, copy);
  };
  const loaded = load();
  assert.equal(snapshot(loaded), snapshot(sim));
  const again = /** @type {Tower} */ (loaded.towerAt(4, 1));
  assert.deepEqual([again.super, again.gifts, again.branch, again.invested], [true, ['burner', 'slower'], 1, core.invested]);
  assert.deepEqual(again.stats, core.stats);
  assert.deepEqual(loaded.upgrade(again.id), { ok: false, reason: 'max' });
  assert.equal(loaded.sellValue(again), core.invested, 'in derselben Bauphase gebaut');
  // Alter Spielstand ohne die neuen Felder: Stufe 3 mit Zweigen bekommt Zweig 0, nichts ist Superwaffe, fusions zählt ab 0.
  const old = load((copy) => {
    for (const tower of copy.towers) {
      delete tower.branch;
      delete tower.super;
      delete tower.gifts;
    }
    delete copy.stats.fusions;
  });
  assert.deepEqual(old.state.towers.map((t) => [t.arch.id, t.level, t.branch, t.super, t.gifts]), [
    ['shooter', 3, 0, false, []],
    ['shooter', 3, 0, false, []],
    ['shooter', 3, 0, false, []],
    ['shooter', 1, -1, false, []],
    ['burner', 3, -1, false, []],
  ]);
  assert.equal(old.state.stats.fusions, 0);
  assert.deepEqual(old.towerById(sniper.id)?.stats, double.stats, 'ohne Angabe gilt Zweig 0');
  assert.deepEqual(old.towerById(young.id)?.stats, young.stats);
  assert.deepEqual(old.towerById(plainBurner.id)?.stats, plainBurner.stats);
  // -1 auf Stufe 3 einer Rolle mit Zweigen (Spielstand aus der Zeit vor den Zweigen) gilt ebenfalls als Zweig 0.
  assert.equal(load((copy) => void (copy.towers[2].branch = -1)).state.towers[2].branch, 0);
  // Ein Spielstand mit Superwaffe lässt sich mit Inhalten ohne Verschmelzung nicht laden.
  assert.throws(() => makeSim({}, JSON.parse(JSON.stringify(save))), /Turm 0 \("shooter"\) nennt den Ausbauzweig 1, hat aber keine Ausbauzweige/);
  assert.throws(() => load((copy) => void (copy.towers[1].branch = 2)), /Turm 1 \("shooter"\) hat den unbekannten Ausbauzweig 2/);
  assert.throws(() => load((copy) => void (copy.towers[1].branch = 0.5)), /ungültigen Ausbauzweig 0.5/);
  assert.throws(() => load((copy) => void (copy.towers[3].branch = 0)), /nennt den Ausbauzweig 0, hat aber erst Stufe 1/);
  assert.throws(() => load((copy) => void (copy.towers[4].branch = 1)), /Turm 4 \("burner"\) nennt den Ausbauzweig 1, hat aber keine Ausbauzweige/);
  assert.throws(() => load((copy) => void (copy.towers[0].super = 'ja')), /super muss true oder false sein/);
  assert.throws(() => load((copy) => void (copy.towers[0].gifts = 'burner')), /gifts muss eine Liste von Rollen sein/);
  assert.throws(() => load((copy) => void (copy.towers[0].gifts = [])), /Superwaffe gespeichert, nennt aber keine Gaben/);
  assert.throws(() => load((copy) => void (copy.towers[0].gifts = ['burner', 'geist'])), /unbekannte Rolle "geist" als Gabe/);
  assert.throws(() => load((copy) => void (copy.towers[0].gifts = ['burner', 'pulser'])), /Rolle "pulser" als Gabe, die nicht verschmelzen kann/);
  assert.throws(() => load((copy) => void (copy.towers[1].gifts = ['burner'])), /nennt Gaben \(gifts\), ist aber keine Superwaffe/);
  assert.throws(() => load((copy) => void (copy.towers[3].super = true, (copy.towers[3].gifts = ['burner']))), /als Superwaffe gespeichert, hat aber erst Stufe 1/);
  assert.throws(() => makeSim({ edit: (c) => void (addFusion(c), delete c.archetypes[0].fusion) }, JSON.parse(JSON.stringify(save))), /die Rolle kann nicht verschmelzen/);
});

test('Spielstand mit Megawaffe: mega und vier Gaben gespeichert, alte Spielstände ohne mega, kaputte mit verständlicher Meldung', () => {
  const sim = makeSim({ edit: (c) => void (addFusion(c), (c.balance.startGold = 20000)) });
  /**
   * @param {string} archId
   * @param {number} tx
   * @param {number} tz
   */
  const build3 = (archId, tx, tz) => {
    const tower = mustBuild(sim, archId, tx, tz);
    sim.upgrade(tower.id);
    sim.upgrade(tower.id);
    return tower;
  };
  const core = build3('shooter', 2, 1);
  const p1 = build3('burner', 1, 1);
  const p2 = build3('slower', 3, 1);
  assert.deepEqual(sim.fuse(core.id, [p1.id, p2.id]), { ok: true });
  const m1 = build3('thrower', 2, 0);
  const m2 = build3('piercer', 1, 0);
  assert.deepEqual(sim.fuse(core.id, [m1.id, m2.id]), { ok: true });
  const other = build3('shooter', 8, 1);
  const o1 = build3('shooter', 9, 1);
  const o2 = build3('shooter', 7, 1);
  assert.deepEqual(sim.fuse(other.id, [o1.id, o2.id]), { ok: true });
  build3('burner', 8, 0);
  build3('burner', 9, 0);
  const save = /** @type {SaveData} */ (sim.save());
  assert.deepEqual(save.towers.map((t) => [t.arch, t.super, t.mega, t.gifts]), [
    ['shooter', true, true, ['burner', 'slower', 'thrower', 'piercer']],
    ['shooter', true, false, ['shooter', 'shooter']],
    ['burner', false, false, []],
    ['burner', false, false, []],
  ]);
  assert.deepEqual([save.stats.fusions, save.stats.megas], [2, 1]);
  assert.deepEqual(save.towers.map((t) => t.giftBranches), [[-1, 0, -1, -1], [0, 0], [], []], 'Zweig jeder Zutat, -1 für Rollen ohne Zweige');
  /** @param {(copy: any) => void} [change] */
  const load = (change) => {
    const copy = JSON.parse(JSON.stringify(save));
    if (change) change(copy);
    return makeSim({ edit: (c) => void addFusion(c) }, copy);
  };
  const loaded = load();
  assert.equal(snapshot(loaded), snapshot(sim));
  const again = /** @type {Tower} */ (loaded.towerAt(2, 1));
  assert.deepEqual([again.super, again.mega, again.gifts, again.invested], [true, true, core.gifts, core.invested]);
  assert.deepEqual(again.stats, core.stats);
  // Die Höchstzahl gilt auch nach dem Laden.
  const twin = /** @type {Tower} */ (loaded.towerAt(8, 1));
  assert.deepEqual(loaded.canFuse(twin.id, loaded.fuseCandidates(core.id).map((t) => t.id)), { ok: false, reason: 'limit' });
  assert.deepEqual(loaded.sell(again.id), { ok: true });
  const parts = loaded.fuseCandidates(twin.id).map((t) => t.id);
  assert.equal(parts.length, 2);
  assert.deepEqual(loaded.fuse(twin.id, parts), { ok: true });
  // Alter Spielstand ohne mega (Superwaffe und gewöhnliche Türme) und ohne stats.megas: mega = false, megas zählt ab 0.
  const old = load((copy) => {
    copy.towers.splice(0, 1);
    for (const tower of copy.towers) delete tower.mega;
    delete copy.stats.megas;
  });
  assert.deepEqual(old.state.towers.map((t) => [t.super, t.mega]), [[true, false], [false, false], [false, false]]);
  assert.equal(old.state.stats.megas, 0);
  assert.deepEqual(old.towerAt(8, 1)?.stats, other.stats);
  assert.equal(old.fuseCandidates(old.state.towers[0].id).length, 2, 'die alte Superwaffe kann zur Megawaffe werden');
  // Ohne giftBranches (Spielstand vor den Zweig-Gaben): Zweig 0, für Rollen ohne Zweige -1; die Werte bleiben gleich.
  const noBranches = load((copy) => void copy.towers.forEach((/** @type {any} */ t) => delete t.giftBranches));
  assert.deepEqual(noBranches.state.towers.map((t) => t.giftBranches), [[-1, 0, -1, -1], [0, 0], [], []]);
  assert.equal(snapshot(noBranches), snapshot(sim));
  // Ein Scharfschütze als Zutat bringt seine eigene Gabe mit (Testinhalte: Reichweite x1,5 statt Feuerpause x0,75).
  const sniper = load((copy) => void (copy.towers[1].giftBranches = [1, 0]));
  near(/** @type {Tower} */ (sniper.towerAt(8, 1)).stats.range, other.stats.range * 1.5);
  // Kaputte Spielstände.
  assert.throws(() => load((copy) => void (copy.towers[1].giftBranches = [0])), /giftBranches muss eine Liste mit so vielen Einträgen wie gifts sein/);
  assert.throws(() => load((copy) => void (copy.towers[1].giftBranches = [2, 0])), /für die Gabe "shooter" den ungültigen Zweig 2/);
  assert.throws(() => load((copy) => void (copy.towers[0].giftBranches = [1, 0, -1, -1])), /für die Gabe "burner" den ungültigen Zweig 1/);
  assert.throws(() => load((copy) => void delete copy.towers[0].mega), /Turm 0 \("shooter"\) nennt 4 Gaben, ist aber keine Megawaffe/);
  assert.throws(() => load((copy) => void (copy.towers[0].mega = 'ja')), /mega muss true oder false sein/);
  assert.throws(() => load((copy) => void (copy.towers[1].mega = true)), /als Megawaffe gespeichert, nennt aber nur 2 Gaben \(eine Megawaffe hat mehr als 2\)/);
  assert.throws(() => load((copy) => void (copy.towers[2].mega = true)), /als Megawaffe gespeichert, aber nicht als Superwaffe/);
});

test('Wellen je Zeitalter: nichts hängt an einer festen Anzahl; ungleich lange Zeitalter laufen bis zum Sieg', () => {
  const counts = [4, 1, 7];
  const content = makeContent();
  content.waves = counts.map((count, age) => Array.from({ length: count }, (_, w) => ({ groups: [{ enemy: w % 2 ? 'runner' : 'grunt', count: 2 + w, interval: 0.3, delay: 0 }], hint: `${age}/${w}` })));
  content.balance.startGold = 100000;
  const sim = createSim({ content, mapId: 'straight', difficulty: 'normal', seed: 3, unlockAll: true });
  assert.equal(sim.totalWaves, 12);
  assert.deepEqual(sim.wavePreview(4)?.hint, '1/0');
  assert.deepEqual([sim.wavePreview(11)?.age, sim.wavePreview(11)?.waveInAge, sim.wavePreview(12)], [2, 6, null]);
  for (let tx = 2; tx < 10; tx++) {
    for (const tz of [2, 4]) {
      const tower = mustBuild(sim, 'shooter', tx, tz);
      sim.upgrade(tower.id);
      sim.upgrade(tower.id);
    }
  }
  /** @type {[number, number, number][]} */
  const starts = [];
  /** @type {number[]} */
  const ageAt = [];
  /** @type {number[]} */
  const hp = [];
  for (let guard = 0; guard < 60 * 1200 && sim.state.phase !== 'won' && sim.state.phase !== 'lost'; guard++) {
    if (sim.state.phase === 'build' && sim.state.lock === 0) {
      for (const tower of sim.state.towers) sim.modernize(tower.id);
      sim.startWave();
    }
    sim.step();
    for (const event of sim.drainEvents()) {
      if (event.type === 'waveStart') starts.push([event.wave, event.age, event.waveInAge]);
      if (event.type === 'age') ageAt.push(sim.state.wave);
      // Die Welle eines Gegners ist die zuletzt gestartete: Im dritten Zeitalter treffen die Türme sofort, der letzte Gegner
      // kann im Zeitschritt seines Erscheinens fallen, und `state.wave` zählt dann schon weiter.
      if (event.type === 'spawn' && hp.length < starts.length) hp[starts.length - 1] = event.enemy.maxHp / event.enemy.def.hp;
    }
    const preview = sim.wavePreview(0);
    if (preview) assert.deepEqual([sim.state.age, sim.state.waveInAge], [preview.age, preview.waveInAge]);
  }
  assert.equal(sim.state.phase, 'won');
  assert.deepEqual([sim.state.wave, sim.state.age], [12, 2]);
  assert.deepEqual(starts, [[0, 0, 0], [1, 0, 1], [2, 0, 2], [3, 0, 3], [4, 1, 0], [5, 2, 0], [6, 2, 1], [7, 2, 2], [8, 2, 3], [9, 2, 4], [10, 2, 5], [11, 2, 6]]);
  assert.deepEqual(ageAt, [4, 5], 'Zeitalterwechsel nach 4 und nach 4 + 1 Wellen');
  // Lebenspunkte wachsen je Welle im Zeitalter um 10 %, auch über die sechste Welle hinaus.
  const expected = [20, 22, 24, 26, 40, 80, 88, 96, 104, 112, 120, 128];
  assert.deepEqual(hp, expected);
  assert.equal(sim.state.stats.perfectWaves, 12);
});

test('Speichern: nur in der Bauphase; ein Spielstand nach Vertrag (ohne Zusatzfelder) lässt sich laden und weiterspielen', () => {
  const sim = makeSim({ mapId: 'bend', seed: 5, edit: (c) => void (c.balance.startGold = 600) });
  const tower = mustBuild(sim, 'piercer', 3, 2);
  mustBuild(sim, 'shooter', 5, 2);
  sim.upgrade(tower.id);
  sim.setTargetMode(tower.id, 'weak');
  sim.startWave();
  assert.equal(sim.save(), null, 'während der Welle');
  stepUntil(sim, () => sim.state.phase === 'build');
  stepUntil(sim, () => sim.state.projectiles.length === 0);
  const full = /** @type {SaveData} */ (sim.save());
  assert.ok(full);
  assert.deepEqual([full.version, full.mapId, full.difficulty, full.seed, full.wave, full.gold, full.lives, full.score], [1, 'bend', 'normal', 5, 1, sim.state.gold, sim.state.lives, sim.state.score]);
  /** @type {SaveData} */
  const plain = {
    version: 1,
    mapId: full.mapId,
    difficulty: full.difficulty,
    seed: full.seed,
    rng: full.rng,
    time: full.time,
    wave: full.wave,
    gold: full.gold,
    lives: full.lives,
    score: full.score,
    abilityCooldown: full.abilityCooldown,
    nextId: full.nextId,
    towers: full.towers.map((t) => ({ arch: t.arch, tier: t.tier, level: t.level, tx: t.tx, tz: t.tz, mode: t.mode, invested: t.invested, kills: t.kills, damageDealt: t.damageDealt, builtWave: t.builtWave })),
    stats: full.stats,
  };
  const loaded = makeSim({ mapId: 'bend', seed: 5 }, plain);
  assert.deepEqual([loaded.state.phase, loaded.state.wave, loaded.state.age, loaded.state.waveInAge, loaded.state.gold, loaded.state.lives, loaded.state.score], ['build', 1, 0, 1, sim.state.gold, sim.state.lives, sim.state.score]);
  assert.deepEqual(loaded.state.stats, sim.state.stats);
  const restored = loaded.towerAt(3, 2);
  assert.deepEqual([restored?.arch.id, restored?.level, restored?.mode, restored?.invested, restored?.kills, restored?.builtWave], ['piercer', 2, 'weak', tower.invested, tower.kills, 0]);
  assert.deepEqual(restored?.stats, tower.stats);
  assert.deepEqual(loaded.canBuild(3, 2), { ok: false, reason: 'occupied' });
  // Die Bahnen der nächsten Welle stimmen überein: Der Zufallsgenerator steht an derselben Stelle.
  // (Die Türme der geladenen Partie beginnen ohne Rest ihrer Feuerpause, darum zählen die Bahnen beim Erscheinen und nicht die Überlebenden.)
  sim.drainEvents();
  sim.startWave();
  loaded.startWave();
  const lanesBefore = ofType(collect(sim, 400), 'spawn').map((event) => event.enemy.lane);
  const lanesAfter = ofType(collect(loaded, 400), 'spawn').map((event) => event.enemy.lane);
  assert.equal(lanesBefore.length, 10);
  assert.deepEqual(lanesAfter, lanesBefore);
  // Neue Kennungen kollidieren nicht mit alten.
  const ids = [...loaded.state.towers, ...loaded.state.enemies, ...loaded.state.projectiles].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  play(loaded, greedyBot(loaded), 60 * 600, sane);
  assert.ok(loaded.state.phase === 'won' || loaded.state.phase === 'lost');
});

test('Laden scheitert an unpassenden oder kaputten Spielständen mit verständlicher Meldung', () => {
  const sim = makeSim({ mapId: 'bend' });
  mustBuild(sim, 'shooter', 3, 2);
  const save = /** @type {SaveData} */ (sim.save());
  /** @param {(copy: any) => void} change */
  const broken = (change) => {
    const copy = JSON.parse(JSON.stringify(save));
    change(copy);
    return copy;
  };
  assert.throws(() => makeSim({ mapId: 'fork' }, save), /Spielstand gehört zur Karte "bend"/);
  assert.throws(() => makeSim({ mapId: 'bend', difficulty: 'hard' }, save), /Schwierigkeitsgrad "normal"/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.version = 2))), /Version 2/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.wave = 99))), /Welle 99 gibt es nicht/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.towers[0].arch = 'geist'))), /unbekannte Rolle "geist"/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.towers[0].tz = 1))), /nicht bebaubar ist \(path\)/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void copy.towers.push(copy.towers[0]))), /occupied|Kennung/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void delete copy.gold)), /gold/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.gold = 12.5))), /gold muss eine ganze Zahl ab 0 sein/);
  assert.throws(() => makeSim({ mapId: 'bend' }, broken((copy) => void (copy.gold = -5))), /gold muss eine ganze Zahl ab 0 sein/);
  assert.doesNotThrow(() => makeSim({ mapId: 'bend' }, save));
});

test('Geskriptete Partie bis zum Sieg', () => {
  /** @type {Record<number, [string, ...(string | number)[]][]>} */
  const script = {
    0: [['build', 'shooter', 2, 2], ['build', 'shooter', 3, 2], ['build', 'flak', 3, 3]],
    1: [['build', 'shooter', 5, 3], ['build', 'shooter', 8, 3]],
    2: [['build', 'shooter', 10, 3], ['upgrade', 2, 2]],
    3: [['modernize', 2, 2], ['modernize', 3, 2], ['modernize', 3, 3], ['modernize', 5, 3], ['modernize', 8, 3], ['modernize', 10, 3]],
    4: [['build', 'thrower', 5, 4], ['build', 'flak', 6, 4]],
    5: [['build', 'piercer', 7, 4], ['build', 'burner', 8, 4]],
    6: [['modernize', 2, 2], ['modernize', 3, 2], ['modernize', 3, 3], ['modernize', 5, 3], ['modernize', 8, 3], ['modernize', 10, 3], ['modernize', 5, 4]],
    7: [['modernize', 6, 4], ['modernize', 7, 4], ['modernize', 8, 4]],
    8: [['build', 'shooter', 10, 4], ['build', 'slower', 2, 3], ['upgrade', 2, 2]],
  };
  const sim = makeSim({ mapId: 'bend', seed: 3, unlockAll: false });
  /** @type {SimEvent['type'][]} */
  const milestones = [];
  for (let wave = 0; wave < sim.totalWaves; wave++) {
    assert.deepEqual([sim.state.phase, sim.state.wave], ['build', wave]);
    stepUntil(sim, () => sim.state.lock === 0);
    for (const [command, ...args] of script[wave]) {
      /** @type {{ ok: boolean, reason?: string }} */
      let result;
      if (command === 'build') result = sim.build(String(args[0]), Number(args[1]), Number(args[2]));
      else {
        const tower = sim.towerAt(Number(args[0]), Number(args[1]));
        assert.ok(tower, `Turm auf (${args}) fehlt`);
        result = command === 'upgrade' ? sim.upgrade(tower.id) : sim.modernize(tower.id);
      }
      assert.deepEqual(result, { ok: true }, `Welle ${wave}: ${command} ${args}`);
    }
    assert.deepEqual(sim.startWave(), { ok: true });
    while (sim.state.phase === 'wave') {
      sim.step();
      sane(sim);
      for (const event of sim.drainEvents()) if (event.type === 'age' || event.type === 'won' || event.type === 'lost') milestones.push(event.type);
    }
  }
  assert.equal(sim.state.phase, 'won');
  assert.deepEqual(milestones, ['age', 'age', 'won']);
  assert.deepEqual([sim.state.wave, sim.state.age, sim.state.lives], [9, 2, 20]);
  assert.equal(sim.state.stats.perfectWaves, 9);
  assert.equal(sim.state.stats.leaks, 0);
  // Punkte: Abschüsse plus 3 * (150 + 300 + 450) für neun makellose Wellen plus 250 je Leben.
  const kills = sim.state.score - 3 * 900 - 250 * 20;
  assert.ok(kills > 0 && Number.isInteger(kills));
  assert.equal(sim.state.stats.goldEarned - sim.state.stats.goldSpent + 200, sim.state.gold, 'Goldbilanz ohne Verkäufe');
});

test('Geskriptete Partie bis zur Niederlage: ein einzelner Turm reicht nicht', () => {
  const sim = makeSim({ mapId: 'bend', seed: 3, unlockAll: false });
  mustBuild(sim, 'shooter', 2, 2);
  /** @type {string[]} */
  const types = [];
  for (let i = 0; i < 60 * 300 && sim.state.phase !== 'lost' && sim.state.phase !== 'won'; i++) {
    if (sim.state.phase === 'build') sim.startWave();
    sim.step();
    sane(sim);
    for (const event of sim.drainEvents()) types.push(event.type);
  }
  assert.equal(sim.state.phase, 'lost');
  assert.equal(sim.state.lives, 0);
  assert.equal(types[types.length - 1], 'lost');
  assert.equal(types.filter((type) => type === 'lost').length, 1);
  assert.ok(sim.state.wave < sim.totalWaves);
  assert.ok(sim.state.stats.leaks > 0 && sim.state.stats.kills > 0);
});

test('Ein kleiner gieriger Bot gewinnt den Feldzug auf normal; wer nie baut, verliert', () => {
  for (const mapId of ['bend', 'fork', 'keep']) {
    const sim = makeSim({ mapId, difficulty: 'normal', unlockAll: false, seed: 11 });
    play(sim, greedyBot(sim), 60 * 60 * 20, sane);
    assert.equal(sim.state.phase, 'won', `${mapId}: Phase ${sim.state.phase} in Welle ${sim.state.wave}`);
    assert.ok(sim.state.lives > 0);
    assert.ok(sim.state.towers.length >= 8);
  }
  const idle = makeSim({ mapId: 'bend', difficulty: 'normal', unlockAll: false, seed: 11 });
  play(idle, (sim) => void (sim.state.phase === 'build' && sim.startWave()), 60 * 60 * 20, sane);
  assert.equal(idle.state.phase, 'lost');
  assert.equal(idle.state.wave, 2, 'spätestens der erste Boss kostet die letzten Leben');
  assert.equal(idle.state.stats.kills, 0);
  // Zwei Wellenprämien (je 6 Kopfgelder zu 5, nicht makellos) und zweimal die volle Frühstart-Prämie (die Hälfte davon) vor Welle 1 und 2.
  assert.equal(idle.state.gold, 200 + 30 + 30 + 15 + 15, 'nur Wellenprämien und Frühstart');
});

test('Leistung: 200 Gegner, 80 gemischte Türme, 2000 Zeitschritte; der schnellste Block von 250 bleibt unter 0,5 ms je Schritt', (t) => {
  // Eine große Karte mit einem Schlangenweg (81 Felder). Ein steter Strom zäher Gegner aller Eigenschaften hält gut 200
  // gleichzeitig auf dem Weg; dazwischen laufen schwache, die laufend fallen, damit auch Abschüsse und Kopfgelder anfallen.
  const sim = makeSim({
    mapId: 'serpent',
    seed: 9,
    edit: (content) => {
      content.maps.push({
        id: 'serpent',
        name: 'Schlange',
        description: '',
        width: 20,
        height: 12,
        paths: [[[-1, 1], [18, 1], [18, 4], [1, 4], [1, 7], [18, 7], [18, 10], [-1, 10]]],
        blocked: [],
        flyersFollowPath: true,
        seed: 5,
      });
      const tough = { hp: 1e6, speed: 1, lives: 0, bounty: 1 };
      Object.assign(content.enemies.knight, tough);
      Object.assign(content.enemies.mage, tough);
      Object.assign(content.enemies.troll, tough);
      Object.assign(content.enemies.healer, tough);
      Object.assign(content.enemies.golem, tough);
      Object.assign(content.enemies.bird, tough);
      Object.assign(content.enemies.grunt, { lives: 0 });
      content.waves = content.ages.map((_, index) => [
        {
          groups:
            index > 0
              ? []
              : [
                  { enemy: 'knight', count: 4000, interval: 2.4, delay: 0 },
                  { enemy: 'mage', count: 4000, interval: 2.4, delay: 0.4 },
                  { enemy: 'troll', count: 4000, interval: 2.4, delay: 0.8 },
                  { enemy: 'healer', count: 4000, interval: 2.4, delay: 1.2 },
                  { enemy: 'golem', count: 4000, interval: 2.4, delay: 1.6 },
                  { enemy: 'bird', count: 4000, interval: 2.4, delay: 2 },
                  { enemy: 'grunt', count: 8000, interval: 0.5, delay: 0.2 },
                ],
        },
      ]);
      content.balance.startGold = 1e6;
      // Den Strahler gibt es hier schon im ersten Zeitalter.
      const beamer = content.archetypes.find((arch) => arch.id === 'beamer');
      if (beamer) beamer.tiers[0] = beamer.tiers[1];
    },
  });
  const kinds = sim.content.archetypes.map((arch) => arch.id);
  const spots = buildSpots(sim, 2.5);
  assert.ok(spots.length >= 80, `${spots.length} Bauplätze`);
  for (let i = 0; i < 80; i++) mustBuild(sim, kinds[i % kinds.length], spots[i][0], spots[i][1]);
  for (let i = 0; i < 80; i += 3) sim.upgrade(sim.state.towers[i].id);
  assert.equal(new Set(sim.state.towers.map((tower) => tower.arch.id)).size, kinds.length);
  sim.startWave();
  // Einlaufen, bis der Weg voll besetzt ist.
  for (let i = 0; i < 60 * 82; i++) {
    sim.step();
    sim.drainEvents();
  }
  // Gemessen wird in Blöcken; es zählt der schnellste. Laufen alle Testdateien nebeneinander, teilen sie sich die Kerne, und
  // einzelne Blöcke geraten in fremde Last. Der schnellste Block zeigt, was der Zeitschritt wirklich kostet, und eine echte
  // Verschlechterung des Codes trifft jeden Block. Der Mittelwert über alles steht zur Auskunft in der Diagnose.
  const BLOCK = 250;
  const STEPS = 2000;
  let best = Infinity;
  let blockStart = 0;
  let enemies = 0;
  let projectiles = 0;
  let zones = 0;
  let events = 0;
  let fewest = Infinity;
  const killsBefore = sim.state.stats.kills;
  const start = performance.now();
  for (let i = 0; i < STEPS; i++) {
    if (i % BLOCK === 0) blockStart = performance.now();
    sim.step();
    if (i % BLOCK === BLOCK - 1) best = Math.min(best, (performance.now() - blockStart) / BLOCK);
    events += sim.drainEvents().length;
    const count = sim.state.enemies.length;
    enemies += count;
    if (count < fewest) fewest = count;
    projectiles += sim.state.projectiles.length;
    zones += sim.state.zones.length;
  }
  const mean = (performance.now() - start) / STEPS;
  sane(sim);
  t.diagnostic(
    `Schrittzeit im schnellsten Block ${best.toFixed(4)} ms, im Mittel (mit Buchführung des Tests) ${mean.toFixed(4)} ms bei im Mittel ${(enemies / STEPS).toFixed(0)} Gegnern (mindestens ${fewest}), ${sim.state.towers.length} Türmen, ` +
      `${(projectiles / STEPS).toFixed(0)} Geschossen, ${(zones / STEPS).toFixed(0)} Bodenfeldern, ${(events / STEPS).toFixed(0)} Ereignissen je Schritt, ${sim.state.stats.kills - killsBefore} Abschüssen`,
  );
  assert.equal(sim.state.phase, 'wave');
  assert.equal(sim.state.towers.length, 80);
  assert.ok(fewest >= 200, `mindestens ${fewest} Gegner gleichzeitig`);
  assert.ok(projectiles > 0 && zones > 0 && sim.state.stats.kills > killsBefore);
  assert.ok(best < 0.5, `Schrittzeit im schnellsten Block ${best.toFixed(4)} ms (Mittel ${mean.toFixed(4)} ms)`);
});
