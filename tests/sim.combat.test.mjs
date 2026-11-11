// @ts-check
// Simulation, Teil 2: Gegner (Verlangsamung, Brand, Heilung, Schild, Momente, Träger) und Türme (Zielwahl, Feuern, Angriffsarten,
// Einschlag, Treffer, Auren). Gerechnet wird auf der Karte 'straight': Der Weg läuft bei z = 0 von x = -6,5 nach x = 6,5,
// ein Gegner mit Strecke d steht bei x = d - 6,5; ein Turm auf Feld (tx, 2) steht bei (tx - 5,5; -1).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AGE_LOCK, SIM_DT } from '../src/sim/sim.js';
import { createSim } from '../src/sim/sim.js';
import { addFusion } from './fixtures/content.mjs';
import { STILL, addArch, begin, collect, makeSim, mustBuild, near, ofType, scene, snapshot, steps, stepUntil } from './fixtures/harness.mjs';

/** @import { WaveDef } from '../src/types/content' */
/** @import { SaveData, Sim, SimEvent, Tower } from '../src/types/sim' */

/**
 * Eine Welle, in der jeder genannte Gegner einmal sofort erscheint.
 * @param {...string} ids
 * @returns {WaveDef['groups']}
 */
function each(...ids) {
  return ids.map((enemy) => ({ enemy, count: 1, interval: 0, delay: 0 }));
}

/**
 * Rechnet `count` Zeitschritte und liefert je Zeitschritt die Ereignisse.
 * @param {Sim} sim
 * @param {number} count
 * @returns {SimEvent[][]}
 */
function perTick(sim, count) {
  /** @type {SimEvent[][]} */
  const ticks = [];
  for (let i = 0; i < count; i++) {
    sim.step();
    ticks.push(sim.drainEvents());
  }
  return ticks;
}

test('Treffer: Schild fängt vor der Rüstung ab, Rüstung zieht ab, Mindestschaden, pierce; ein damage-Ereignis je Gegner', () => {
  const sim = scene({
    enemies: { blank: STILL, panzer: { ...STILL, armor: 0.3 }, schild: { ...STILL, armor: 0.3, shield: 0.04 }, burg: { ...STILL, armor: 5 } },
    towers: { g10: { damage: 10, range: 1.2 }, halb: { damage: 10, range: 1.2, pierce: 0.5 }, ganz: { damage: 10, range: 1.2, pierce: 1 } },
    wave: each('blank', 'panzer', 'schild', 'burg'),
  });
  const [plain, tank, shielded, fort] = begin(sim, [2, 5, 8, 11]);
  assert.deepEqual([tank.armor, shielded.shield, shielded.maxShield, fort.armor], [3, 4, 4, 50]);
  const a = mustBuild(sim, 'g10', 1, 2);
  const b = mustBuild(sim, 'g10', 4, 2);
  const c = mustBuild(sim, 'halb', 4, 4);
  const d = mustBuild(sim, 'g10', 7, 2);
  const e = mustBuild(sim, 'g10', 10, 2);
  const f = mustBuild(sim, 'ganz', 10, 4);
  sim.drainEvents();
  sim.step();
  near(plain.hp, 90, 1e-9);
  near(tank.hp, 100 - 7 - 8.5, 1e-9, 'Rüstung 3, beim zweiten Turm zur Hälfte ignoriert');
  near(shielded.shield, 0, 0);
  near(shielded.hp, 97, 1e-9, 'Schild 4 fängt ab, vom Rest 6 zieht die Rüstung 3 ab');
  near(fort.hp, 100 - 1 - 10, 1e-9, 'Mindestschaden 10 %, und pierce 1 ignoriert die Rüstung ganz');
  for (const enemy of [plain, tank, shielded, fort]) assert.equal(enemy.sinceHit, 0);
  near(a.damageDealt, 10, 1e-9);
  near(b.damageDealt + c.damageDealt, 15.5, 1e-9);
  near(d.damageDealt, 7, 1e-9, 'Schild plus Lebenspunkte');
  near(e.damageDealt + f.damageDealt, 11, 1e-9);
  near(sim.state.stats.damageDealt, 43.5, 1e-9);
  const events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'damage').map((event) => [event.enemy.def.id, Math.round(event.amount * 10) / 10, event.shield]), [['blank', 10, false], ['panzer', 15.5, false], ['schild', 7, true], ['burg', 11, false]]);
  assert.equal(ofType(events, 'shot').length, 6);
  assert.equal(ofType(events, 'hit').length, 6);
  assert.deepEqual([a.lastShot, a.targetId, a.aimX, a.aimZ, a.aimFlying], [sim.state.time, plain.id, plain.x, plain.z, false]);
});

test('Treffer: gezählt wird höchstens der Bestand; der Turm bekommt den Abschuss, abgehandelt wird im selben Zeitschritt', () => {
  const sim = scene({ enemies: { klein: { ...STILL, hp: 1, bounty: 3 }, rest: STILL }, towers: { hammer: { damage: 1000, range: 1.2 } }, wave: each('klein', 'rest') });
  const [small] = begin(sim, [2, 9]);
  const tower = mustBuild(sim, 'hammer', 1, 2);
  const gold = sim.state.gold;
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  assert.equal(small.alive, false);
  assert.equal(small.hp, 0);
  near(tower.damageDealt, 20, 1e-9);
  assert.equal(tower.kills, 1);
  assert.equal(sim.state.gold, gold + 15);
  assert.equal(sim.state.enemies.length, 1);
  assert.deepEqual(events.map((event) => event.type), ['shot', 'hit', 'damage', 'kill', 'gold']);
  assert.deepEqual(ofType(events, 'kill')[0], { type: 'kill', enemy: small, bounty: 15, towerId: tower.id });
  assert.deepEqual(ofType(events, 'gold')[0], { type: 'gold', amount: 15, reason: 'bounty', x: small.x, z: small.z });
  assert.equal(sim.enemyById(small.id), null);
});

test('Verlangsamung: läuft ab, wird nur von einer gleich starken oder stärkeren ersetzt, slowResist schwächt sie', () => {
  const sim = scene({
    enemies: { laeufer: { boss: true, speed: 1 }, zaeh: { boss: true, speed: 1, slowResist: 0.5 }, immun: { boss: true, speed: 1, slowResist: 1 } },
    towers: {
      s30: { damage: 1, slow: 0.3, slowDuration: 2 },
      s20: { damage: 1, slow: 0.2, slowDuration: 10 },
      s30lang: { damage: 1, slow: 0.3, slowDuration: 5 },
      s50: { damage: 1, slow: 0.5, slowDuration: 0.5 },
      alle: { attack: 'pulse', damage: 1, slow: 0.4, slowDuration: 1 },
    },
    wave: each('laeufer'),
    edit: (c) => void c.waves[0].push({ groups: each('laeufer', 'zaeh', 'immun') }),
  });
  const [walker] = begin(sim, [1]);
  mustBuild(sim, 's30', 0, 0);
  sim.step();
  assert.deepEqual([walker.slow, walker.slowTime], [0.3, 2]);
  near(walker.speed, 1, 0, 'das Tempo ändert sich erst im nächsten Zeitschritt');
  sim.step();
  near(walker.speed, 0.7, 1e-12);
  near(walker.slowTime, 2 - SIM_DT, 1e-12);
  // Schwächer: ändert weder Stärke noch Dauer.
  mustBuild(sim, 's20', 1, 0);
  sim.step();
  assert.equal(walker.slow, 0.3);
  near(walker.slowTime, 2 - 2 * SIM_DT, 1e-12);
  // Gleich stark: Die längere Dauer gilt.
  mustBuild(sim, 's30lang', 2, 0);
  sim.step();
  assert.deepEqual([walker.slow, walker.slowTime], [0.3, 5]);
  // Stärker mit kürzerer Dauer: Stärke ersetzt, die Restdauer bleibt die längere.
  mustBuild(sim, 's50', 3, 0);
  sim.step();
  assert.equal(walker.slow, 0.5);
  near(walker.slowTime, 5 - SIM_DT, 1e-12);
  sim.step();
  near(walker.speed, 0.5, 1e-12);
  // Nach Ablauf ist die Verlangsamung weg: 5 s nach dem Treffer von s30lang.
  steps(sim, 297);
  assert.equal(walker.slow, 0.5);
  sim.step();
  assert.deepEqual([walker.slow, walker.slowTime, walker.speed], [0, 0, 1]);

  // Zweite Welle: Widerstand.
  for (const tower of sim.state.towers.slice()) sim.sell(tower.id);
  stepUntil(sim, () => sim.state.phase === 'build');
  const [plain, tough, immune] = begin(sim, [1, 1, 1]);
  mustBuild(sim, 'alle', 0, 0);
  sim.step();
  assert.deepEqual([plain.slow, tough.slow, immune.slow, immune.slowTime], [0.4, 0.2, 0, 0]);
  sim.step();
  near(tough.speed, 0.8, 1e-12);
  assert.equal(immune.speed, 1);
});

test('Brand: Schaden über Zeit ohne Rüstung, setzt sinceHit nicht zurück, erneuert sich statt sich zu stapeln', () => {
  const sim = scene({
    enemies: { burg: { ...STILL, armor: 5 }, zwei: STILL },
    towers: { fackel: { damage: 2, dot: 6, dotDuration: 2, range: 1.2 }, glut: { damage: 0, dot: 9, dotDuration: 1, range: 1.2 } },
    wave: each('burg', 'zwei'),
  });
  const [fort, twice] = begin(sim, [2, 8]);
  const torch = mustBuild(sim, 'fackel', 1, 2);
  mustBuild(sim, 'fackel', 7, 2);
  mustBuild(sim, 'fackel', 7, 4);
  sim.step();
  near(fort.hp, 99.8, 1e-9, 'der Treffer selbst: Mindestschaden 10 % von 2');
  assert.deepEqual([fort.dot, fort.dotTime, fort.sinceHit], [6, 2, 0]);
  assert.deepEqual([twice.dot, twice.dotTime], [6, 2], 'zwei Brenner stapeln nicht');
  near(twice.hp, 96, 1e-9);
  sim.drainEvents();
  const ticks = perTick(sim, 120);
  near(fort.hp, 99.8 - 12, 1e-9, '6 je Sekunde über 2 Sekunden, die Rüstung 50 zählt nicht');
  near(twice.hp, 96 - 12, 1e-9);
  near(fort.sinceHit, 2, 1e-9, 'sinceHit läuft weiter');
  assert.deepEqual([fort.dot, fort.dotTime], [0, 0]);
  near(torch.damageDealt, 0.2 + 12, 1e-9, 'Brandschaden zählt für den Urheber');
  for (const events of ticks) {
    const damage = ofType(events, 'damage');
    assert.equal(damage.length, 2);
    near(damage[0].amount, 6 * SIM_DT, 1e-12);
  }
  sim.step();
  near(fort.hp, 99.8 - 12, 1e-9, 'danach brennt nichts mehr');
  assert.equal(ofType(sim.drainEvents(), 'damage').length, 0);

  // Ein stärkerer Brand ersetzt den Wert, die längere Restdauer bleibt.
  for (const tower of sim.state.towers.slice()) sim.sell(tower.id);
  mustBuild(sim, 'fackel', 1, 2);
  sim.step();
  steps(sim, 30);
  mustBuild(sim, 'glut', 1, 4);
  sim.step();
  assert.equal(fort.dot, 9);
  near(fort.dotTime, 2 - 31 * SIM_DT, 1e-9);
});

test('Brand wirkt auf verlangsamte Gegner mit burnOnSlowed und geht erst durch den Schild', () => {
  const sim = scene({
    enemies: { ziel: STILL, schild: { ...STILL, shield: 0.05 } },
    towers: { zunder: { damage: 0, dot: 6, dotDuration: 2, slow: 0.5, slowDuration: 1, range: 1.2 }, fackel: { damage: 0, dot: 6, dotDuration: 2, range: 1.2 } },
    wave: each('ziel', 'schild'),
  });
  const [target, shielded] = begin(sim, [2, 8]);
  mustBuild(sim, 'zunder', 1, 2);
  mustBuild(sim, 'fackel', 7, 2);
  sim.step();
  assert.equal(target.hp, 100, 'Schaden 0: der Treffer selbst nimmt nichts');
  assert.deepEqual([target.slow, target.dot], [0.5, 6]);
  sim.step();
  near(target.hp, 100 - 6 * 1.5 * SIM_DT, 1e-12, 'verlangsamt: anderthalbfach');
  steps(sim, 119);
  // 59 Zeitschritte verlangsamt (1,5-fach), 61 nicht.
  near(target.hp, 100 - 59 * 6 * 1.5 * SIM_DT - 61 * 6 * SIM_DT, 1e-9);
  // Schild 5 brennt zuerst weg, der Rest geht auf die Lebenspunkte.
  near(shielded.shield, 0, 1e-9);
  near(shielded.hp, 100 - 7, 1e-9);
});

test('Brand: der Abschuss gehört dem Turm, der den Effekt zuletzt gesetzt hat', () => {
  const sim = scene({
    enemies: { opfer: { ...STILL, hp: 0.4, bounty: 1 }, rest: STILL },
    towers: { erster: { damage: 0, dot: 6, dotDuration: 2, range: 1.2 }, letzter: { damage: 0, dot: 3, dotDuration: 1, range: 1.2 } },
    wave: each('opfer', 'rest'),
  });
  const [victim] = begin(sim, [2, 11]);
  const first = mustBuild(sim, 'erster', 1, 2);
  steps(sim, 10);
  const last = mustBuild(sim, 'letzter', 1, 4);
  sim.drainEvents();
  const events = collect(sim, 100);
  assert.equal(victim.alive, false);
  assert.deepEqual([first.kills, last.kills], [0, 1]);
  assert.deepEqual(ofType(events, 'kill').map((event) => event.towerId), [last.id]);
  assert.ok(last.damageDealt > 0 && first.damageDealt > 0);
  near(first.damageDealt + last.damageDealt, 8, 1e-9);
});

test('Selbstheilung setzt eine Sekunde nach dem letzten Treffer ein; ein brennender Gegner heilt nicht', () => {
  const sim = scene({
    enemies: { troll: { ...STILL, regen: 0.1 }, brenntroll: { ...STILL, regen: 0.1 } },
    towers: { schlag: { damage: 30, range: 1.2 }, brand: { damage: 30, dot: 1, dotDuration: 3, range: 1.2 } },
    wave: each('troll', 'brenntroll'),
  });
  const [troll, burning] = begin(sim, [2, 8]);
  mustBuild(sim, 'schlag', 1, 2);
  mustBuild(sim, 'brand', 7, 2);
  sim.step();
  assert.equal(troll.hp, 70);
  steps(sim, 59);
  assert.equal(troll.hp, 70, 'noch keine volle Sekunde ohne Treffer');
  sim.step();
  near(troll.hp, 70 + 10 * SIM_DT, 1e-9, '10 % von 100 je Sekunde');
  steps(sim, 120);
  near(troll.hp, 70 + 121 * 10 * SIM_DT, 1e-9);
  // Der Brennende verliert 3 Sekunden lang 1 je Sekunde und heilt in dieser Zeit nicht.
  near(burning.hp, 70 - 3, 1e-9, 'auch im Zeitschritt des letzten Brandschadens heilt er nicht');
  sim.step();
  near(burning.hp, 70 - 3 + 10 * SIM_DT, 1e-9, 'danach setzt die Selbstheilung ein');
  steps(sim, 60 * 6);
  assert.equal(troll.hp, 100, 'höchstens maxHp');
});

test('Schild lädt nach shieldDelay ohne Treffer mit maxShield / shieldRecharge je Sekunde; Brand verhindert das Laden', () => {
  const sim = scene({
    enemies: { magier: { ...STILL, shield: 0.2 }, brennmagier: { ...STILL, shield: 0.2 } },
    towers: { schlag: { damage: 12, range: 1.2 }, brand: { damage: 12, dot: 0.6, dotDuration: 5, range: 1.2 } },
    wave: each('magier', 'brennmagier'),
  });
  const [mage, burning] = begin(sim, [2, 8]);
  mustBuild(sim, 'schlag', 1, 2);
  mustBuild(sim, 'brand', 7, 2);
  sim.step();
  assert.deepEqual([mage.shield, mage.hp], [8, 100]);
  steps(sim, 179);
  assert.equal(mage.shield, 8);
  sim.step();
  near(mage.shield, 8 + 10 * SIM_DT, 1e-9, '20 Schild in 2 Sekunden');
  steps(sim, 60);
  near(mage.shield, 8 + 61 * 10 * SIM_DT, 1e-9);
  near(burning.shield, 8 - 0.6 * 4, 1e-6, 'brennt seit 4 Sekunden und lädt nicht, obwohl der letzte Treffer länger als shieldDelay her ist');
  steps(sim, 60);
  near(burning.shield, 5, 1e-6, 'auch im Zeitschritt des letzten Brandschadens lädt er nicht');
  sim.step();
  near(burning.shield, 5 + 10 * SIM_DT, 1e-6, 'danach lädt er');
  steps(sim, 600);
  assert.deepEqual([mage.shield, burning.shield], [20, 20]);
  assert.equal(mage.hp, 100);
});

test('Heiler heilt andere im Umkreis, nicht sich selbst, keine Brennenden; ein Ereignis je Sekunde', () => {
  const sim = scene({
    enemies: { heiler: { ...STILL, heal: { radius: 1.5, perSecond: 0.1 } }, nah: STILL, brennt: STILL, fern: STILL },
    towers: { rundum: { attack: 'pulse', damage: 30 }, fackel: { damage: 0, dot: 0.5, dotDuration: 10, range: 1.2 } },
    wave: each('heiler', 'nah', 'brennt', 'fern'),
  });
  const [healer, close, burning, far] = begin(sim, [5, 6, 4, 8]);
  mustBuild(sim, 'rundum', 0, 0);
  mustBuild(sim, 'fackel', 3, 2);
  sim.step();
  assert.equal(burning.dotTime, 10, 'die Fackel erreicht nur den Gegner direkt vor ihr');
  assert.deepEqual([healer.hp, close.hp, far.hp, healer.dotTime, close.dotTime], [70, 70, 70, 0, 0]);
  sim.drainEvents();
  const events = collect(sim, 180);
  near(close.hp, 100, 1e-9, '10 % von 100 je Sekunde, 3 Sekunden');
  assert.equal(healer.hp, 70, 'nicht sich selbst');
  assert.equal(far.hp, 70, 'außerhalb des Radius');
  near(burning.hp, 70 - 0.5 * 3, 1e-9, 'brennt und wird nicht geheilt');
  assert.deepEqual(ofType(events, 'heal').map((event) => event.enemy), [healer, healer, healer]);
  // Alle in Reichweite sind voll oder brennen: kein Ereignis mehr.
  assert.equal(ofType(collect(sim, 120), 'heal').length, 0);
});

test('Momente: jede Schwelle tritt einmal ein; spawns setzt Gegner aus, speed gibt einen Tempo-Schub auf Zeit', () => {
  const sim = scene({
    enemies: { boss: { hp: 20, speed: 0.5, bounty: 20 } },
    towers: { schlag: { damage: 140, range: 40 } },
    wave: each('boss'),
  });
  const [boss] = begin(sim, [3]);
  assert.equal(boss.maxHp, 400);
  mustBuild(sim, 'schlag', 0, 0);
  sim.step();
  assert.deepEqual([boss.hp, boss.phase], [260, 0], 'geprüft wird im nächsten Zeitschritt nach dem Schaden über Zeit');
  sim.drainEvents();
  sim.step();
  let events = sim.drainEvents();
  assert.equal(boss.phase, 1);
  assert.deepEqual(ofType(events, 'phase'), [{ type: 'phase', enemy: boss, index: 0 }]);
  const runners = ofType(events, 'spawn').map((event) => event.enemy);
  assert.deepEqual(runners.map((enemy) => [enemy.def.id, enemy.path, enemy.hp]), [['runner', 0, 10], ['runner', 0, 10]]);
  near(runners[0].dist, boss.dist - 0.5 * SIM_DT, 1e-9, 'an der Stelle des Bosses vor dessen Bewegung');
  near(runners[1].dist, runners[0].dist - 0.25, 1e-12, 'der zweite 0,25 Felder dahinter');
  assert.ok(runners[0].id > boss.id && runners[1].id > runners[0].id);
  assert.deepEqual(sim.state.enemies, [boss, ...runners]);
  assert.ok(runners.every((enemy) => enemy.lane !== 0 && Math.abs(enemy.lane) <= 0.28));
  steps(sim, 30);
  assert.equal(ofType(sim.drainEvents(), 'phase').length, 0, 'kein zweites Mal');

  // Zweite Schwelle: Schub.
  sim.setTargetMode(mustBuild(sim, 'schlag', 1, 0).id, 'strong');
  sim.step();
  assert.equal(boss.hp, 120);
  assert.deepEqual([boss.boost, boss.speed], [1, 0.5]);
  sim.drainEvents();
  const before = boss.dist;
  sim.step();
  events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'phase'), [{ type: 'phase', enemy: boss, index: 1 }]);
  assert.deepEqual([boss.phase, boss.boost, boss.boostTime, boss.speed], [2, 2, 3, 1]);
  near(boss.dist, before + 1 * SIM_DT, 1e-12, 'der Schub gilt schon für die Bewegung dieses Zeitschritts');
  steps(sim, 179);
  assert.deepEqual([boss.boost, boss.speed], [2, 1]);
  near(boss.dist, before + 180 * SIM_DT, 1e-9, 'genau 3 Sekunden doppeltes Tempo');
  sim.step();
  assert.deepEqual([boss.boost, boss.boostTime, boss.speed], [1, 0, 0.5]);
});

test('Momente: mehrere Schwellen in einem Zeitschritt treten nacheinander ein; Schub und Verlangsamung multiplizieren sich', () => {
  const sim = scene({
    enemies: { boss: { hp: 20, speed: 0.5 } },
    towers: { schlag: { damage: 300, range: 40, slow: 0.5, slowDuration: 10 } },
    wave: each('boss'),
  });
  const [boss] = begin(sim, [0.1]);
  mustBuild(sim, 'schlag', 0, 0);
  sim.step();
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'phase').map((event) => event.index), [0, 1]);
  assert.equal(boss.phase, 2);
  near(boss.slow, 0.25, 0, 'slowResist 0,5');
  near(boss.speed, 0.5 * 2 * 0.75, 1e-12);
  const runners = ofType(events, 'spawn').map((event) => event.enemy);
  assert.equal(runners.length, 2);
  assert.equal(runners[1].dist, 0, 'nicht hinter den Eingang zurück');
});

test('Zielwahl: first, last, strong, weak, near; bei Gleichstand die kleinere Kennung; Ausrichtung folgt dem Ziel', () => {
  const sim = scene({
    enemies: { a: STILL, b: { ...STILL, hp: 3 }, c: { ...STILL, hp: 2, shield: 0.5 }, d: STILL, vogel: { ...STILL, flying: true, hp: 10 } },
    towers: { seher: { damage: 0 }, kurz: { damage: 0, range: 2 }, weit: { damage: 0, minRange: 2 }, luft: { damage: 0, hitsGround: false }, boden: { damage: 0, hitsAir: false }, blind: { damage: 0, range: 0.5 } },
    wave: each('a', 'b', 'c', 'd', 'vogel'),
  });
  const [a, b, c, d, bird] = begin(sim, [2, 4, 6, 8, 2]);
  assert.deepEqual([a.hp, b.hp, c.hp + c.shield, d.hp], [100, 60, 60, 100]);
  // Turm bei (-1,5; -1): Abstände zu a..d sind 3,16 / 1,41 / 1,41 / 3,16.
  const boden = mustBuild(sim, 'boden', 4, 2);
  const expected = /** @type {const} */ ([['first', d], ['last', a], ['strong', a], ['weak', b], ['near', b]]);
  for (const [mode, target] of expected) {
    sim.setTargetMode(boden.id, mode);
    sim.step();
    assert.equal(boden.targetId, target.id, mode);
    assert.deepEqual([boden.aimX, boden.aimZ, boden.aimFlying], [target.x, target.z, false], `Ausrichtung ${mode}`);
  }
  assert.equal(ofType(sim.drainEvents(), 'shot').length, 1, 'gefeuert wurde nur einmal, gezielt in jedem Zeitschritt');

  const seher = mustBuild(sim, 'seher', 4, 1);
  sim.setTargetMode(seher.id, 'strong');
  sim.step();
  assert.equal(seher.targetId, bird.id, 'der Flieger hat die meisten Lebenspunkte');
  assert.equal(seher.aimFlying, true);
  const luft = mustBuild(sim, 'luft', 5, 2);
  const kurz = mustBuild(sim, 'kurz', 4, 4);
  const weit = mustBuild(sim, 'weit', 3, 2);
  const blind = mustBuild(sim, 'blind', 11, 6);
  sim.setTargetMode(weit.id, 'near');
  sim.step();
  assert.equal(luft.targetId, bird.id, 'hitsGround false: nur der Flieger');
  assert.equal(kurz.targetId, c.id, 'Reichweite 2: nur b und c, der vordere ist c');
  // Turm bei (-2,5; -1): b steht 1,0 entfernt (zu nah), a und der Flieger 2,24 (kleinere Kennung: a), c 2,24.
  assert.equal(weit.targetId, a.id, 'minRange 2 schließt den Nächsten aus');
  assert.equal(blind.targetId, -1);
  assert.deepEqual([blind.aimX, blind.aimZ], [blind.x, blind.z + 1], 'ohne Ziel bleibt die Ausrichtung stehen');
  assert.equal(blind.lastShot, -Infinity);
});

test('Ohne Ziel: targetId -1, die letzte Ausrichtung bleibt, cooldown bleibt bei höchstens 0 stehen und spart nichts an', () => {
  const sim = scene({
    enemies: { erster: { ...STILL, hp: 0.5 }, zweiter: { hp: 50, speed: 1, boss: true } },
    towers: { flinte: { damage: 10, cooldown: 0.5, range: 3 } },
    wave: [{ enemy: 'erster', count: 1, interval: 0, delay: 0 }, { enemy: 'zweiter', count: 1, interval: 0, delay: 4 }],
  });
  const tower = mustBuild(sim, 'flinte', 0, 2);
  steps(sim, 100);
  assert.equal(tower.cooldown, 0, 'in Ruhe läuft nichts ins Negative');
  sim.startWave();
  sim.step();
  const first = sim.state.enemies.length;
  assert.equal(first, 0, 'der erste Gegner (10 Lebenspunkte) fällt mit dem ersten Schuss');
  const aim = [tower.aimX, tower.aimZ];
  near(tower.cooldown, 0.5, 1e-12);
  steps(sim, 200);
  assert.equal(tower.targetId, -1);
  assert.deepEqual([tower.aimX, tower.aimZ], aim);
  assert.ok(tower.cooldown <= 1e-9 && tower.cooldown > -SIM_DT, `cooldown ${tower.cooldown}`);
  // Der zweite Gegner erscheint im Zeitschritt 240 der Welle (hier Index 38) in Reichweite: ein Schuss sofort, der nächste erst nach der Feuerpause.
  sim.drainEvents();
  const ticks = perTick(sim, 100).map((events, index) => (ofType(events, 'shot').length > 0 ? index : -1)).filter((index) => index >= 0);
  assert.deepEqual(ticks, [38, 68, 98]);
});

test('Feuern: cooldown += Feuerpause hält die Feuerrate exakt, auch wenn sie kein Vielfaches des Zeitschritts ist', () => {
  const sim = scene({ enemies: { ziel: { ...STILL, hp: 5000 } }, towers: { mg: { damage: 1, cooldown: 0.07 }, takt: { damage: 1, cooldown: 1 } }, wave: each('ziel') });
  begin(sim, [5]);
  const mg = mustBuild(sim, 'mg', 0, 0);
  const takt = mustBuild(sim, 'takt', 1, 0);
  sim.drainEvents();
  const shots = ofType(collect(sim, 600), 'shot');
  const fast = shots.filter((event) => event.tower === mg).length;
  // Schüsse zu den Zeiten 0, 0,07, 0,14, ... innerhalb von 599/60 Sekunden: 143. Mit „cooldown = Feuerpause“ wären es 120.
  assert.ok(fast >= 142 && fast <= 144, `${fast} Schüsse in 10 Sekunden`);
  assert.equal(shots.filter((event) => event.tower === takt).length, 10);
  near(mg.damageDealt, fast, 1e-9);
});

test('Auren: nur der stärkste Spender je Bonusart, nie der Turm selbst, Auren verändern keine Auren, Neuberechnung bei Änderungen', () => {
  const sim = scene({
    enemies: { ziel: { ...STILL, hp: 500 } },
    towers: {
      stark: { attack: 'none', range: 1.5, auraDamage: 0.5 },
      schwach: { attack: 'none', range: 1.5, auraDamage: 0.2, auraRate: 0.25 },
      weiter: { attack: 'none', range: 1.5, auraRange: 0.5 },
      g: { damage: 10, cooldown: 1, range: 2, dot: 4, dotDuration: 1 },
    },
    wave: each('ziel'),
    edit: (c) => {
      const stark = c.archetypes.find((arch) => arch.id === 'stark');
      if (stark) stark.levels = [{}, { auraDamage: 0.8 }, {}];
    },
  });
  const g = mustBuild(sim, 'g', 4, 1);
  assert.deepEqual([g.buffDamage, g.buffRate, g.buffRange], [0, 0, 0]);
  const stark = mustBuild(sim, 'stark', 5, 1);
  assert.deepEqual([g.buffDamage, g.buffRate, g.buffRange], [0.5, 0, 0]);
  assert.equal(stark.buffDamage, 0, 'verstärkt sich nicht selbst');
  const schwach = mustBuild(sim, 'schwach', 4, 0);
  assert.deepEqual([g.buffDamage, g.buffRate], [0.5, 0.25], 'der stärkste Schadensbonus zählt, addiert wird nicht');
  assert.deepEqual([stark.buffDamage, schwach.buffDamage], [0.2, 0.5], 'Unterstützer verstärken einander (Abstand 1,41 <= 1,5)');
  // Ein Turm zwei Felder neben `stark` liegt außerhalb von 1,5 und bleibt es, auch wenn `stark` selbst +50 % Reichweite bekommt.
  const far = mustBuild(sim, 'g', 7, 1);
  mustBuild(sim, 'weiter', 5, 2);
  assert.equal(stark.buffRange, 0.5);
  assert.equal(far.buffDamage, 0, 'Auren verändern keine Auren');
  assert.equal(g.buffRange, 0.5);

  // Wirkung: Schaden, Brand, Feuerpause, Reichweite.
  // g steht bei (-1,5; -2), das Ziel bei Strecke 7 = (0,5; 0): Abstand 2,83, erreichbar nur mit Reichweite 2 * 1,5 = 3.
  // Der ferne Turm bei (1,5; -2) hat keinen Reichweitenbonus und kommt mit 2,0 nicht bis zum Ziel in 2,24.
  const [target] = begin(sim, [7]);
  sim.step();
  assert.equal(g.targetId, target.id, 'Reichweite 2 * (1 + 0,5) = 3');
  assert.equal(far.targetId, -1);
  near(target.maxHp - target.hp, 15, 1e-9, 'g trifft mit 10 * 1,5');
  assert.equal(target.dot, 6, 'Brand 4 * 1,5');
  near(g.cooldown, 0.8, 1e-12, 'Feuerpause 1 / 1,25');
  assert.equal(far.cooldown, 0);
  sim.drainEvents();
  const shots = perTick(sim, 100).map((events, index) => (ofType(events, 'shot').some((event) => event.tower === g) ? index : -1)).filter((index) => index >= 0);
  assert.deepEqual(shots, [47, 95], 'alle 48 Zeitschritte');

  // Neuberechnung: Ausbau, Verkauf.
  sim.upgrade(stark.id);
  assert.equal(g.buffDamage, 0.8);
  sim.sell(stark.id);
  assert.deepEqual([g.buffDamage, g.buffRate, g.buffRange], [0.2, 0.25, 0.5]);
  sim.sell(schwach.id);
  assert.deepEqual([g.buffDamage, g.buffRate], [0, 0]);
});

test('Auren werden auch beim Modernisieren neu berechnet', () => {
  const sim = makeSim({
    edit: (c) => {
      c.waves = [[{ groups: [] }], [{ groups: [] }], [{ groups: [] }]];
      c.balance.startGold = 10000;
      const support = c.archetypes.find((arch) => arch.id === 'support');
      if (support && support.tiers[1]) support.tiers[1].tweak = { auraDamage: 0.6 };
    },
  });
  const shooter = mustBuild(sim, 'shooter', 1, 1);
  const support = mustBuild(sim, 'support', 2, 1);
  assert.deepEqual([shooter.buffDamage, shooter.buffRate, shooter.buffRange], [0.25, 0.2, 0.1]);
  sim.startWave();
  stepUntil(sim, () => sim.state.phase === 'build');
  assert.deepEqual(sim.modernize(support.id), { ok: true });
  assert.equal(shooter.buffDamage, 0.6);
});

test('Geschoss: Flugzeit max(0,05; Abstand / Tempo), Werte beim Abschuss festgehalten, trifft auch nach dem Verkauf des Turms', () => {
  const sim = scene({
    enemies: { ziel: STILL, nah: STILL },
    towers: { bogen: { attack: 'projectile', damage: 10, projectileSpeed: 2, range: 4 }, blitz: { attack: 'projectile', damage: 10, projectileSpeed: 1000, range: 1.2 } },
    wave: each('ziel', 'nah'),
    edit: (c) => {
      const bogen = c.archetypes.find((arch) => arch.id === 'bogen');
      if (bogen) bogen.levels = [{}, { damage: 50 }, {}];
    },
  });
  const [target, close] = begin(sim, [6, 11]);
  const bow = mustBuild(sim, 'bogen', 2, 2);
  const quick = mustBuild(sim, 'blitz', 10, 2);
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  assert.equal(sim.state.projectiles.length, 2);
  const [arrow, bolt] = sim.state.projectiles;
  assert.deepEqual([arrow.towerId, arrow.arch, arrow.tier, arrow.sx, arrow.sz, arrow.tx, arrow.tz, arrow.targetId, arrow.targetFlying], [bow.id, bow.arch, 0, bow.x, bow.z, target.x, target.z, target.id, false]);
  near(arrow.duration, Math.sqrt(10) / 2, 1e-6);
  assert.equal(bolt.duration, 0.05, 'Mindestflugzeit');
  assert.equal(arrow.pt, 0);
  near(arrow.t, SIM_DT / arrow.duration, 1e-12);
  assert.deepEqual(events.map((event) => event.type), ['shot', 'shot']);
  assert.deepEqual(ofType(events, 'shot')[0], { type: 'shot', tower: bow, targetId: target.id, x: target.x, z: target.z, flying: false });
  // Der schnelle Schuss braucht 3 Zeitschritte.
  sim.step();
  assert.equal(close.hp, 100);
  sim.step();
  near(close.hp, 90, 1e-9);
  assert.deepEqual(sim.drainEvents().map((event) => event.type), ['hit', 'damage']);
  // Ausbau und Verkauf ändern das fliegende Geschoss nicht.
  sim.upgrade(bow.id);
  assert.equal(bow.stats.damage, 50 * 1.6);
  sim.sell(bow.id);
  sim.sell(quick.id);
  sim.drainEvents();
  // Flugzeit 1,58 s = 94,9 Zeitschritte: Einschlag im 95. Zeitschritt nach dem Abschuss.
  steps(sim, 91);
  assert.equal(target.hp, 100);
  assert.equal(sim.state.projectiles.length, 1);
  near(arrow.t - arrow.pt, SIM_DT / arrow.duration, 1e-12);
  sim.step();
  near(target.hp, 90, 1e-9, 'Schaden des Abschusses (10), nicht der Stufe 2 (80)');
  assert.equal(sim.state.projectiles.length, 0);
  const impact = sim.drainEvents();
  assert.deepEqual(impact.map((event) => event.type), ['hit', 'damage']);
  assert.deepEqual(impact[0], { type: 'hit', arch: bow.arch, tier: 0, x: target.x, z: target.z, flying: false, splash: 0 });
  near(sim.state.stats.damageDealt, 20, 1e-9, 'zählt weiter für die Statistik, auch ohne Turm');
});

test('Geschoss: stirbt das Ziel im Flug, fliegt es zum letzten Punkt; der Einzelschuss verpufft, der Flächenschuss schlägt dort ein', () => {
  const sim = scene({
    enemies: { opfer: { ...STILL, hp: 1 }, zuschauer: STILL },
    towers: { pfeil: { attack: 'projectile', damage: 10, projectileSpeed: 1, range: 1.2 }, bombe: { attack: 'projectile', damage: 10, projectileSpeed: 1, range: 1.2, splash: 1 } },
    wave: each('opfer', 'zuschauer'),
    edit: (c) => void (c.abilities[0] = { ...c.abilities[1], radius: 0.2, damage: 100, cooldown: 0 }),
  });
  const [victim, watcher] = begin(sim, [6, 6.3]);
  // Beide Türme stehen ein Feld neben dem Opfer: Flugzeit 1 Sekunde.
  sim.setTargetMode(mustBuild(sim, 'pfeil', 5, 2).id, 'weak');
  sim.setTargetMode(mustBuild(sim, 'bombe', 5, 4).id, 'weak');
  sim.step();
  const [arrow, bomb] = sim.state.projectiles;
  assert.deepEqual([arrow.targetId, bomb.targetId], [victim.id, victim.id]);
  steps(sim, 20);
  assert.deepEqual([arrow.tx, arrow.tz], [victim.x, victim.z]);
  const last = [victim.x, victim.z];
  sim.useAbility(victim.x, victim.z);
  assert.equal(victim.alive, false);
  assert.equal(watcher.hp, 100);
  sim.step();
  assert.deepEqual([arrow.targetId, bomb.targetId], [-1, -1]);
  assert.deepEqual([arrow.tx, arrow.tz, bomb.tx, bomb.tz], [...last, ...last]);
  sim.drainEvents();
  const events = collect(sim, 45);
  assert.equal(sim.state.projectiles.length, 0);
  assert.deepEqual(ofType(events, 'hit').map((event) => [event.splash, event.x, event.z]), [[0, ...last], [1, ...last]]);
  near(watcher.hp, 100 - 10 * (1 - (0.5 * 0.3) / 1), 1e-5, 'nur die Bombe trifft den Zuschauer, 0,3 Felder neben dem Einschlag');
  assert.equal(ofType(events, 'damage').length, 1);
});

test('Geschoss: der Zielpunkt wandert mit dem Ziel; kommt es im Flug durch, endet die Verfolgung ohne Schaden', () => {
  const sim = scene({
    enemies: { flitzer: { boss: true, speed: 2, hp: 50 } },
    towers: { hinten: { attack: 'projectile', damage: 10, projectileSpeed: 0.5, range: 3 } },
    wave: each('flitzer'),
  });
  const [racer] = begin(sim, [10]);
  mustBuild(sim, 'hinten', 10, 2);
  sim.step();
  const [shell] = sim.state.projectiles;
  assert.equal(shell.targetId, racer.id);
  for (let i = 0; i < 30; i++) {
    sim.step();
    assert.deepEqual([shell.tx, shell.tz], [racer.x, racer.z]);
    assert.ok(shell.t > shell.pt);
  }
  sim.drainEvents();
  const events = collect(sim, 200);
  assert.equal(ofType(events, 'leak').length, 1);
  assert.equal(shell.targetId, -1);
  near(shell.tx, 6.5, 0.05, 'letzter bekannter Punkt: das Wegende');
  assert.equal(ofType(events, 'hit').length, 1);
  assert.equal(ofType(events, 'damage').length, 0);
  assert.equal(sim.state.projectiles.length, 0);
  assert.equal(sim.state.lives, 19);
  assert.equal(sim.state.phase, 'build');
});

test('Flächenschaden: Faktor 1 - 0,5 * d / splash, nur passende Gegner im Radius', () => {
  const sim = scene({
    enemies: { e: STILL, vogel: { ...STILL, flying: true } },
    towers: { moerser: { damage: 20, splash: 2, hitsAir: false } },
    wave: [{ enemy: 'e', count: 4, interval: 0, delay: 0 }, { enemy: 'vogel', count: 1, interval: 0, delay: 0 }],
  });
  const [e1, e2, e3, e4, bird] = begin(sim, [5.9, 6, 7, 8, 8]);
  const tower = mustBuild(sim, 'moerser', 0, 0);
  sim.drainEvents();
  sim.step();
  assert.equal(tower.targetId, e4.id);
  near(e4.hp, 80, 1e-4, 'im Mittelpunkt voll');
  near(e3.hp, 85, 1e-4, 'd = 1: Faktor 0,75');
  near(e2.hp, 90, 1e-4, 'd = 2: Faktor 0,5');
  assert.equal(e1.hp, 100, 'd = 2,1: außerhalb');
  assert.equal(bird.hp, 100, 'hitsAir false');
  const events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'hit'), [{ type: 'hit', arch: tower.arch, tier: 0, x: e4.x, z: e4.z, flying: false, splash: 2 }]);
  assert.equal(ofType(events, 'damage').length, 3);
  assert.equal(ofType(events, 'chain').length, 0);
});

test('Kette: springt zum nächsten noch nicht Getroffenen im Umkreis des zuletzt Getroffenen, mit 0,7^k, nie zweimal auf denselben', () => {
  const sim = scene({
    enemies: { e: STILL, vogel: { ...STILL, flying: true } },
    towers: { kette: { damage: 40, chain: 3, chainRange: 1.5, hitsAir: false }, mitFlaeche: { damage: 40, chain: 3, chainRange: 1.5, splash: 0.1 } },
    wave: [{ enemy: 'e', count: 4, interval: 0, delay: 0 }, { enemy: 'vogel', count: 1, interval: 0, delay: 0 }],
  });
  // d ganz hinten, dann c, b und vorn a; der Flieger steht zwischen a und b.
  const [d, c, b, a, bird] = begin(sim, [3, 6.2, 7, 8, 7.5]);
  const tower = mustBuild(sim, 'kette', 0, 0);
  sim.drainEvents();
  sim.step();
  near(a.hp, 60, 1e-9, 'Ziel voll');
  near(b.hp, 100 - 40 * 0.7, 1e-9, 'erster Sprung: b ist 1,0 von a entfernt, c mit 1,8 zu weit');
  near(c.hp, 100 - 40 * 0.49, 1e-9, 'zweiter Sprung von b aus: a ist näher, aber schon getroffen');
  assert.equal(d.hp, 100, 'kein dritter Sprung: niemand in Reichweite');
  assert.equal(bird.hp, 100, 'passt nicht zur Bauart');
  let events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'chain'), [
    { type: 'chain', arch: tower.arch, tier: 0, fromX: a.x, fromZ: a.z, toX: b.x, toZ: b.z, flying: false },
    { type: 'chain', arch: tower.arch, tier: 0, fromX: b.x, fromZ: b.z, toX: c.x, toZ: c.z, flying: false },
  ]);
  assert.equal(ofType(events, 'hit').length, 1);
  near(tower.damageDealt, 40 + 28 + 19.6, 1e-9);

  // Gleicher Abstand: die kleinere Kennung. c (bei 7) und a (bei 9) sind von b (bei 8) gleich weit weg.
  sim.sell(tower.id);
  a.dist = 9;
  b.dist = 8;
  c.dist = 7;
  sim.step();
  const second = mustBuild(sim, 'kette', 0, 0);
  sim.setTargetMode(second.id, 'weak');
  sim.drainEvents();
  sim.step();
  assert.equal(second.targetId, a.id, 'a ist der Schwächste (60)');
  events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'chain').map((event) => event.toX), [b.x, c.x], 'a -> b -> c; von b aus ist nur c noch nicht getroffen');
  // Mit Flächenschaden gibt es keine Kette.
  sim.sell(second.id);
  mustBuild(sim, 'mitFlaeche', 0, 0);
  sim.drainEvents();
  sim.step();
  assert.equal(ofType(sim.drainEvents(), 'chain').length, 0);
});

test('Kette: bei gleichem Abstand gewinnt die kleinere Kennung', () => {
  const sim = scene({ enemies: { e: STILL }, towers: { kette: { damage: 10, chain: 1, chainRange: 1.5 } }, wave: [{ enemy: 'e', count: 3, interval: 0, delay: 0 }] });
  const [left, right, middle] = begin(sim, [6, 8, 7]);
  const tower = mustBuild(sim, 'kette', 0, 0);
  sim.setTargetMode(tower.id, 'weak');
  middle.hp = 50;
  sim.step();
  assert.equal(tower.targetId, middle.id);
  assert.deepEqual([left.hp, right.hp], [93, 100], 'links und rechts gleich weit, links hat die kleinere Kennung');
});

test('Strahl: Schaden je Takt wächst mit der Dauer auf demselben Ziel, hält sein Ziel und beginnt beim Wechsel von vorn', () => {
  const sim = scene({
    enemies: { dick: { ...STILL, hp: 50 }, zweiter: { ...STILL, hp: 49.5 } },
    towers: { strahl: { attack: 'beam', damage: 20, cooldown: 0.1, ramp: 1, rampTime: 2, range: 3 } },
    wave: each('dick', 'zweiter'),
  });
  const [big, other] = begin(sim, [6, 6.5]);
  assert.deepEqual([big.hp, other.hp], [1000, 990]);
  const tower = mustBuild(sim, 'strahl', 5, 2);
  sim.setTargetMode(tower.id, 'strong');
  sim.drainEvents();
  sim.step();
  assert.equal(tower.targetId, big.id);
  near(big.hp, 1000 - 2, 1e-9, 'erster Takt ohne Zuwachs: 20 * 0,1');
  assert.equal(tower.beamTime, 0);
  steps(sim, 6);
  near(tower.beamTime, 0.1, 1e-9);
  near(big.hp, 1000 - 2 - 2 * 1.05, 1e-9, 'zweiter Takt nach 0,1 s: Faktor 1 + 0,1 / 2');
  steps(sim, 114);
  // 21 Takte in 2 Sekunden: 2 * (21 + 0,05 * (0 + 1 + ... + 20)) = 63.
  near(big.hp, 1000 - 63, 1e-6);
  assert.equal(tower.targetId, big.id, 'hält sein Ziel, obwohl inzwischen der andere der Stärkste ist');
  assert.equal(other.hp, 990);
  steps(sim, 60);
  near(big.hp, 1000 - 63 - 10 * 4, 1e-6, 'danach das Doppelte: 4 je Takt');
  assert.equal(ofType(sim.drainEvents(), 'shot').length, 31, 'ein shot-Ereignis je Takt');
  // Das Ziel verschwindet aus der Reichweite: Wechsel, der Zuwachs beginnt von vorn.
  big.dist = 12;
  const before = other.hp;
  sim.step();
  assert.deepEqual([tower.targetId, tower.beamTime], [other.id, 0]);
  steps(sim, 5);
  const firstBeat = before - other.hp;
  assert.ok(firstBeat >= 2 && firstBeat < 2.2, `erster Takt auf dem neuen Ziel wieder fast ohne Zuwachs: ${firstBeat} statt 4`);
  assert.ok(tower.beamTime < 0.11);
  // Ohne Ziel fällt die Strahldauer auf 0.
  other.dist = 12;
  sim.step();
  assert.deepEqual([tower.targetId, tower.beamTime], [-1, 0]);
});

test('Rundumschlag: trifft alle gültigen Gegner in Reichweite voll, braucht mindestens einen, meldet hit am Turm', () => {
  const sim = scene({
    enemies: { e: STILL, vogel: { ...STILL, flying: true } },
    towers: { puls: { attack: 'pulse', damage: 30, range: 2, cooldown: 1, hitsAir: false } },
    wave: [{ enemy: 'e', count: 3, interval: 0, delay: 0 }, { enemy: 'vogel', count: 1, interval: 0, delay: 0 }],
  });
  // Turm bei (-1,5; -1): Abstände 1,0 / 1,80 / 2,24 (zu weit); der Flieger steht direkt davor.
  const [a, b, c, bird] = begin(sim, [5, 6.5, 7, 5]);
  const tower = mustBuild(sim, 'puls', 4, 2);
  sim.drainEvents();
  sim.step();
  assert.deepEqual([a.hp, b.hp, c.hp, bird.hp], [70, 70, 100, 100]);
  const events = sim.drainEvents();
  assert.equal(ofType(events, 'shot').length, 1);
  assert.deepEqual(ofType(events, 'hit'), [{ type: 'hit', arch: tower.arch, tier: 0, x: tower.x, z: tower.z, flying: false, splash: 2 }]);
  assert.equal(ofType(events, 'damage').length, 2);
  // Kein gültiger Gegner in Reichweite: kein Schuss, die Feuerpause bleibt stehen.
  a.dist = 11;
  b.dist = 11;
  bird.dist = 5;
  steps(sim, 120);
  assert.equal(ofType(sim.drainEvents(), 'shot').length, 0);
  assert.equal(tower.targetId, -1);
  assert.ok(tower.cooldown <= 1e-9);
});

test('Viele Tode in einem Zeitschritt: alle werden in Reihenfolge ihrer Kennung abgehandelt, die Welle endet im selben Schritt', () => {
  const sim = scene({
    enemies: { e: { ...STILL, hp: 1 } },
    towers: { puls: { attack: 'pulse', damage: 30 } },
    wave: [{ enemy: 'e', count: 12, interval: 0, delay: 0 }],
  });
  const all = begin(sim, Array.from({ length: 12 }, (_, i) => 1 + i * 0.5));
  const tower = mustBuild(sim, 'puls', 4, 2);
  const gold = sim.state.gold;
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  assert.deepEqual(ofType(events, 'kill').map((event) => event.enemy.id), all.map((enemy) => enemy.id));
  assert.equal(tower.kills, 12);
  assert.equal(sim.state.stats.kills, 12);
  assert.equal(sim.state.enemies.length, 0);
  assert.equal(sim.state.phase, 'build');
  assert.equal(sim.state.gold, gold + 12 * 5 + 45 + 160, 'Kopfgelder, Wellenprämie mit Zuschlag, Zeitgeschenk');
  const types = events.map((event) => event.type);
  assert.ok(types.indexOf('waveClear') > types.lastIndexOf('kill'));
  assert.ok(Number.isInteger(sim.state.gold));
});

test('Träger: setzt beim Tod seine Fracht aus, je 0,25 Felder weiter hinten, mit den Werten der laufenden Welle', () => {
  const sim = scene({
    enemies: { wagen: { boss: true, speed: 1e-6, hp: 1, bounty: 2, spawns: { enemy: 'grunt', count: 3 } } },
    towers: { hammer: { damage: 1000, range: 1.2 } },
    wave: each('wagen'),
  });
  const [wagon] = begin(sim, [3]);
  mustBuild(sim, 'hammer', 2, 2);
  const gold = sim.state.gold;
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  const cargo = ofType(events, 'spawn').map((event) => event.enemy);
  assert.deepEqual(cargo.map((enemy) => [enemy.def.id, enemy.path, enemy.hp, enemy.bounty, enemy.alive]), Array(3).fill(['grunt', 0, 20, 5, true]));
  near(cargo[0].dist, wagon.dist, 1e-12);
  near(cargo[1].dist, wagon.dist - 0.25, 1e-12);
  near(cargo[2].dist, wagon.dist - 0.5, 1e-12);
  assert.ok(cargo.every((enemy) => Math.abs(enemy.lane) <= 0.28 && enemy.lane !== 0));
  assert.ok(cargo[0].id > wagon.id && cargo[1].id > cargo[0].id && cargo[2].id > cargo[1].id);
  assert.deepEqual(sim.state.enemies, cargo, 'der Träger ist entfernt, die Fracht lebt');
  assert.equal(sim.state.gold, gold + 10);
  assert.equal(sim.state.phase, 'wave', 'die Welle endet nicht, solange die Fracht lebt');
  assert.deepEqual(events.map((event) => event.type), ['shot', 'hit', 'damage', 'kill', 'gold', 'spawn', 'spawn', 'spawn']);
  // Die Fracht läuft weiter und kommt durch.
  stepUntil(sim, () => sim.state.phase !== 'wave');
  assert.deepEqual([sim.state.lives, sim.state.stats.leaks, sim.state.stats.kills], [17, 3, 1]);
});

test('Träger am Eingang und auf dem letzten Feld: Fracht nicht hinter den Eingang, kurz vor dem Ziel kommt sie eben durch', () => {
  const sim = scene({
    enemies: { wagen: { boss: true, speed: 1e-6, hp: 1, spawns: { enemy: 'grunt', count: 3 } } },
    towers: { hammer: { damage: 1000, range: 1.5 } },
    wave: [{ enemy: 'wagen', count: 2, interval: 0, delay: 0 }],
  });
  begin(sim, [0.3, 12.95]);
  mustBuild(sim, 'hammer', 0, 2);
  mustBuild(sim, 'hammer', 11, 2);
  sim.step();
  assert.deepEqual(sim.state.enemies.map((enemy) => Math.round(enemy.dist * 100) / 100), [0.3, 0.05, 0, 12.95, 12.7, 12.45]);
  steps(sim, 40);
  assert.equal(sim.state.lives, 17, 'die drei am Wegende sind durchgekommen');
  assert.equal(sim.state.enemies.length, 3);
  assert.equal(sim.state.phase, 'wave');
  assert.ok(sim.state.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.progress)));
});

test('Fliegender Träger setzt Läufer an der nächstgelegenen Stelle des Weges aus', () => {
  const sim = scene({
    map: 'bend',
    enemies: { ballon: { boss: true, flying: true, speed: 1e-6, hp: 1, spawns: { enemy: 'grunt', count: 2 } } },
    towers: { hammer: { damage: 1000 } },
    wave: each('ballon'),
  });
  const [balloon] = begin(sim, [3]);
  mustBuild(sim, 'hammer', 1, 0);
  sim.step();
  const [first, second] = sim.state.enemies;
  // Der Ballon steht auf der Luftlinie bei etwa (-3,51; -1,77), der Weg läuft dort bei z = -2.
  near(first.x, balloon.x, 1e-3);
  near(first.z, -2 + first.lane, 1e-3);
  near(first.dist, balloon.x + 6.5, 1e-3);
  near(second.dist, first.dist - 0.25, 1e-9);
  assert.equal(first.path, 0);
});

test('Bodenfeld: entsteht am Einschlag mit Radius splash, verlangsamt Bodengegner darin ohne Treffer, läuft nach zone Sekunden ab', () => {
  const sim = scene({
    enemies: { koeder: STILL, laeufer: { boss: true, speed: 1, regen: 0.01 }, vogel: { ...STILL, flying: true } },
    towers: { pfuetze: { damage: 0, splash: 0.9, slow: 0.3, slowDuration: 1, zone: 3, range: 1.2, hitsAir: false } },
    wave: each('koeder', 'laeufer', 'vogel'),
  });
  const [bait, walker, bird] = begin(sim, [6, 4, 6]);
  walker.hp = 50;
  const tower = mustBuild(sim, 'pfuetze', 5, 2);
  sim.drainEvents();
  sim.step();
  const events = sim.drainEvents();
  assert.equal(sim.state.zones.length, 1);
  const zone = sim.state.zones[0];
  assert.deepEqual(ofType(events, 'zone'), [{ type: 'zone', zone }]);
  assert.deepEqual([zone.arch, zone.tier, zone.towerId, zone.x, zone.z, zone.radius, zone.duration], [tower.arch, 0, tower.id, bait.x, bait.z, 0.9, 3]);
  near(zone.time, 3 - SIM_DT, 1e-12, 'wirkt und altert schon im Zeitschritt des Einschlags');
  assert.deepEqual(events.map((event) => event.type), ['shot', 'zone', 'hit']);
  assert.deepEqual([bait.slow, bait.sinceHit], [0.3, 0], 'der Einschlag selbst ist ein Treffer mit Schaden 0');
  assert.equal(bait.hp, 100);
  assert.deepEqual([bird.slow, bird.sinceHit], [0, Infinity], 'Flieger berührt weder Einschlag noch Feld');
  assert.equal(sim.save(), null, 'mit liegendem Bodenfeld gibt es keinen Spielstand');

  // Der Läufer erreicht den Rand des Feldes (Strecke 5,1) nach 1,1 Sekunden.
  steps(sim, 59);
  assert.equal(walker.slow, 0);
  steps(sim, 30);
  assert.deepEqual([walker.slow, walker.slowTime], [0.3, 1], 'im Feld wird die Verlangsamung in jedem Zeitschritt erneuert');
  near(walker.speed, 0.7, 1e-12);
  assert.equal(walker.sinceHit, Infinity, 'das Feld ändert sinceHit nicht');
  assert.ok(walker.hp > 50, 'und unterbricht darum die Selbstheilung nicht');
  assert.equal(bird.slow, 0);
  // Nach genau 3 Sekunden (180 Zeitschritten) ist das Feld weg.
  steps(sim, 89);
  assert.equal(sim.state.zones.length, 1);
  sim.step();
  assert.equal(sim.state.zones.length, 0);
  // Die Verlangsamung hält noch slowDuration an.
  near(walker.slowTime, 1, 1e-12);
  steps(sim, 59);
  assert.equal(walker.slow, 0.3);
  sim.step();
  assert.deepEqual([walker.slow, walker.speed], [0, 1]);
});

test('Bodenfeld gibt Brand weiter (mit dem Schadensbonus des Turms beim Abschuss); Türme mit Bodenfeld bevorzugen Gegner außerhalb', () => {
  const sim = scene({
    enemies: { e: STILL },
    towers: {
      teer: { damage: 0, splash: 0.9, slow: 0.3, slowDuration: 1, dot: 4, dotDuration: 0.5, zone: 3, cooldown: 1, hitsAir: false },
      stark: { attack: 'none', range: 1.5, auraDamage: 0.5 },
    },
    wave: [{ enemy: 'e', count: 3, interval: 0, delay: 0 }],
  });
  const [back, front, outside] = begin(sim, [4, 8, 4.6]);
  const tower = mustBuild(sim, 'teer', 0, 0);
  const aura = mustBuild(sim, 'stark', 1, 0);
  sim.drainEvents();
  const shots = ofType(collect(sim, 121), 'shot').map((event) => event.targetId);
  // Erst der Vorderste; dann steht er in einem Feld, also der Vorderste außerhalb; der dritte Gegner steht im Feld des zweiten
  // Schusses (0,6 neben dem Einschlag), also gibt es keinen freien mehr und es zählt wieder die Zielwahl unter allen.
  assert.deepEqual(shots, [front.id, outside.id, front.id]);
  assert.equal(sim.state.zones.length, 3);
  assert.equal(back.dot, 6, 'Brand des Feldes: 4 * 1,5');
  assert.equal(back.dotTime, 0.5);
  // Der Bonus ist beim Abschuss festgehalten: Ohne Aura brennen die liegenden Felder unverändert weiter.
  sim.sell(aura.id);
  steps(sim, 30);
  assert.equal(back.dot, 6);
  const dealt = tower.damageDealt;
  steps(sim, 30);
  assert.ok(tower.damageDealt > dealt, 'der Brandschaden des Feldes zählt für den Turm');
});

test('Bodenfelder bleiben über Wellenende und Zeitalterwechsel liegen; solange eines liegt, gibt es keinen Spielstand', () => {
  const sim = scene({
    enemies: { e: STILL },
    towers: { teich: { damage: 1000, splash: 0.9, slow: 0.3, slowDuration: 1, zone: 3, range: 1.2 } },
    wave: each('e'),
  });
  begin(sim, [6]);
  mustBuild(sim, 'teich', 5, 2);
  sim.drainEvents();
  sim.step();
  const types = sim.drainEvents().map((event) => event.type);
  assert.ok(types.includes('zone') && types.includes('waveClear') && types.includes('age'), String(types));
  assert.deepEqual([sim.state.phase, sim.state.wave, sim.state.age, sim.state.lock], ['build', 1, 1, AGE_LOCK]);
  assert.equal(sim.state.zones.length, 1, 'das Feld liegt weiter');
  assert.equal(sim.save(), null);
  steps(sim, 178);
  assert.equal(sim.state.zones.length, 1);
  assert.equal(sim.save(), null);
  sim.step();
  assert.equal(sim.state.zones.length, 0, 'und läuft auch in der Bauphase nach 3 Sekunden ab');
  assert.ok(sim.save());
});

test('Zielwahl über das Raster findet dasselbe Ziel wie das Durchsuchen aller Gegner, auch am Rand und außerhalb des Spielfelds', () => {
  /** @type {[string, number, number, 'first' | 'last' | 'strong' | 'weak' | 'near', boolean, boolean][]} */
  const kinds = [
    ['nah', 0.7, 0, 'first', true, true],
    ['kurz', 1.6, 0, 'last', true, true],
    ['mittel', 3.2, 1, 'strong', true, false],
    ['weit', 5.5, 2, 'weak', false, true],
    ['alles', 30, 0, 'near', true, true],
    ['ring', 4, 2.5, 'first', true, true],
  ];
  const sim = makeSim({
    mapId: 'fork',
    seed: 21,
    edit: (c) => {
      for (const [id, range, minRange, defaultMode, hitsAir, hitsGround] of kinds) addArch(c, id, { damage: 0, range, minRange, hitsAir, hitsGround, cooldown: 0.5 }, { defaultMode });
      c.enemies.grunt.lives = 0;
      c.enemies.bird.lives = 0;
      c.waves = c.ages.map((_, index) => [{ groups: index > 0 ? [] : [{ enemy: 'grunt', count: 60, interval: 0.25, delay: 0 }, { enemy: 'bird', count: 30, interval: 0.5, delay: 0.1 }, { enemy: 'runner', count: 30, interval: 0.4, delay: 0.2 }] }]);
      c.enemies.runner.lives = 0;
      c.balance.startGold = 100000;
    },
  });
  // Türme über die ganze Karte verteilt, auch in den Ecken und am Rand.
  /** @type {[number, number][]} */
  const spots = [[0, 0], [11, 0], [0, 6], [11, 6], [0, 3], [5, 3], [10, 2], [7, 2], [4, 0], [6, 6], [1, 2], [9, 4]];
  spots.forEach(([tx, tz], index) => mustBuild(sim, kinds[index % kinds.length][0], tx, tz));
  sim.startWave();
  let withTarget = 0;
  let ties = 0;
  for (let i = 0; i < 1500 && sim.state.phase === 'wave'; i++) {
    sim.step();
    for (const tower of sim.state.towers) {
      const s = tower.stats;
      const range = s.range * (1 + tower.buffRange);
      let best = null;
      let bestKey = 0;
      for (const enemy of sim.state.enemies) {
        if (!enemy.alive || (enemy.def.flying ? !s.hitsAir : !s.hitsGround)) continue;
        const d2 = (enemy.x - tower.x) ** 2 + (enemy.z - tower.z) ** 2;
        if (d2 > range * range || d2 < s.minRange * s.minRange) continue;
        const key = tower.mode === 'first' ? enemy.progress : tower.mode === 'last' ? -enemy.progress : tower.mode === 'strong' ? enemy.hp + enemy.shield : tower.mode === 'weak' ? -(enemy.hp + enemy.shield) : -d2;
        if (best !== null && key === bestKey) ties += 1;
        if (best === null || key > bestKey) {
          best = enemy;
          bestKey = key;
        }
      }
      assert.equal(tower.targetId, best ? best.id : -1, `Zeitschritt ${sim.state.tick}, Turm ${tower.arch.id} auf (${tower.tx}, ${tower.tz})`);
      if (best) withTarget += 1;
    }
  }
  assert.ok(withTarget > 5000 && ties > 1000, `${withTarget} Ziele, ${ties} Gleichstände`);
  assert.ok(sim.state.enemies.some((enemy) => enemy.x < -6 || enemy.x > 6) || sim.state.stats.leaks > 0, 'Gegner standen auch außerhalb des Spielfelds');
});

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

test('Superwaffe: Gaben setzen einen Gegner in Brand und bremsen ihn, obwohl der Kern beides von Haus aus nicht kann', () => {
  /** @param {boolean} fused */
  const run = (fused) => {
    const sim = scene({ enemies: { dummy: { ...STILL, hp: 500 } }, wave: each('dummy'), edit: (c) => void addFusion(c) });
    const core = build3(sim, 'shooter', 5, 2);
    const a = build3(sim, 'burner', 4, 1);
    const b = build3(sim, 'slower', 6, 1);
    if (fused) assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
    else for (const part of [a, b]) sim.sell(part.id);
    const [enemy] = begin(sim, [6]);
    stepUntil(sim, () => enemy.hp < enemy.maxHp, 600);
    return { sim, core, enemy };
  };
  const plain = run(false);
  assert.deepEqual([plain.enemy.dot, plain.enemy.dotTime, plain.enemy.slow], [0, 0, 0]);
  const { sim, core, enemy } = run(true);
  assert.equal(core.stats.attack, 'projectile');
  assert.equal(enemy.maxHp - enemy.hp, 25 * 1.5 * 1.2, 'erster Treffer der Superwaffe');
  assert.equal(enemy.dot, 10, 'Brandsatz: ein Standardschuss je Sekunde');
  near(enemy.dotTime, 3, 1e-9);
  assert.equal(enemy.slow, 0.25, 'Kleber');
  near(enemy.slowTime, 1.5, 1e-9);
  // Der Brand zählt für die Superwaffe und wirkt auf den Verlangsamten anderthalbfach.
  const hp = enemy.hp;
  const dealt = core.damageDealt;
  sim.step();
  near(hp - enemy.hp, 10 * 1.5 * SIM_DT, 1e-9);
  near(core.damageDealt - dealt, 10 * 1.5 * SIM_DT, 1e-9);
});

test('Verschmelzen mitten in der Welle: Geschosse, Bodenfelder und Brände der Zutaten gehören fortan dem Kern', () => {
  // Der Kern (Flak) schießt nie auf Bodengegner: Was nach dem Verschmelzen noch brennt, stammt von den aufgenommenen Brennern.
  const sim = scene({
    enemies: { dummy: STILL },
    wave: each('dummy'),
    edit: (c) => {
      addFusion(c);
      const flak = c.archetypes.find((arch) => arch.id === 'flak');
      if (flak) flak.fusion = { core: {}, coreText: '', gift: {}, giftName: '', giftText: '' };
    },
  });
  const core = build3(sim, 'flak', 5, 2);
  const a = build3(sim, 'burner', 4, 2);
  const b = build3(sim, 'burner', 6, 2);
  const [enemy] = begin(sim, [6]);
  stepUntil(sim, () => enemy.dotTime > 0, 600);
  enemy.hp = 30;
  const dealtByParts = a.damageDealt + b.damageDealt;
  assert.ok(dealtByParts > 0);
  sim.drainEvents();
  assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
  assert.equal(sim.state.towers.length, 1);
  const events = collect(sim, 200);
  assert.equal(ofType(events, 'shot').length, 0, 'der Kern feuert nicht auf Bodengegner');
  const kills = ofType(events, 'kill');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].towerId, core.id, 'der Abschuss durch den Brand der Zutat zählt für die Superwaffe');
  assert.equal(core.kills, 1);
  near(core.damageDealt, dealtByParts + 30, 1e-9);
  near(core.damageDealt, sim.state.stats.damageDealt, 1e-9);
});

test('Megawaffe mitten in der Welle: Brände der Zutaten gehören fortan ihr; deterministisch, nach der Welle speicherbar und gleich geladen', () => {
  const play = () => {
    const sim = scene({
      enemies: { dummy: STILL },
      wave: each('dummy'),
      edit: (c) => {
        addFusion(c);
        const flak = c.archetypes.find((arch) => arch.id === 'flak');
        if (flak) flak.fusion = { core: {}, coreText: '', gift: {}, giftName: '', giftText: '' };
      },
    });
    const core = build3(sim, 'flak', 5, 2);
    const f1 = build3(sim, 'flak', 4, 1);
    const f2 = build3(sim, 'flak', 6, 1);
    assert.deepEqual(sim.fuse(core.id, [f1.id, f2.id]), { ok: true });
    const a = build3(sim, 'burner', 4, 2);
    const b = build3(sim, 'burner', 6, 2);
    const [enemy] = begin(sim, [6]);
    stepUntil(sim, () => enemy.dotTime > 0, 600);
    enemy.hp = 30;
    const dealtByParts = a.damageDealt + b.damageDealt;
    assert.ok(dealtByParts > 0);
    sim.drainEvents();
    assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
    const fused = ofType(sim.drainEvents(), 'fuse');
    assert.deepEqual([fused.length, fused[0].mega, core.mega, core.gifts], [1, true, true, ['flak', 'flak', 'burner', 'burner']]);
    assert.equal(sim.state.towers.length, 1);
    const events = collect(sim, 200);
    const kills = ofType(events, 'kill');
    assert.equal(kills.length, 1);
    assert.equal(kills[0].towerId, core.id, 'der Abschuss durch den Brand der Zutat zählt für die Megawaffe');
    near(core.damageDealt, dealtByParts + 30, 1e-9);
    return sim;
  };
  const one = play();
  const two = play();
  assert.equal(snapshot(one), snapshot(two));
  stepUntil(one, () => one.state.phase === 'build' && one.state.zones.length === 0 && one.state.lock === 0);
  assert.deepEqual([one.state.stats.fusions, one.state.stats.megas], [1, 1]);
  const loaded = createSim(one.config, JSON.parse(JSON.stringify(one.save())));
  assert.equal(snapshot(loaded), snapshot(one));
});

test('Verschmelzen mitten in der Welle: fliegende Geschosse und liegende Bodenfelder; deterministisch und nach dem Laden gleich', () => {
  const play = () => {
    const sim = scene({ enemies: { dummy: { ...STILL, hp: 40 }, late: { hp: 5 } }, wave: [...each('dummy'), { enemy: 'late', count: 3, interval: 1, delay: 8 }], edit: (c) => void addFusion(c) });
    const core = build3(sim, 'shooter', 5, 2, 1);
    const a = build3(sim, 'shooter', 4, 2);
    const b = build3(sim, 'slower', 6, 2, 1);
    const far = build3(sim, 'thrower', 8, 2);
    const [enemy] = begin(sim, [6]);
    stepUntil(sim, () => sim.state.zones.some((zone) => zone.towerId === b.id) && sim.state.projectiles.some((p) => p.towerId === a.id), 2000);
    const flying = sim.state.projectiles.filter((p) => p.towerId === a.id || p.towerId === b.id);
    const lying = sim.state.zones.filter((zone) => zone.towerId === b.id);
    const target = core.targetId;
    assert.equal(target, enemy.id);
    sim.drainEvents();
    assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
    assert.ok(flying.length > 0 && lying.length > 0);
    assert.ok(flying.every((p) => p.towerId === core.id) && lying.every((zone) => zone.towerId === core.id));
    assert.ok(flying.every((p) => sim.state.projectiles.includes(p)), 'die Geschosse fliegen weiter');
    assert.ok(flying.some((p) => p.arch === a.arch), 'Rolle und Technikstand des Schützen bleiben für die Darstellung');
    assert.equal(core.targetId, target, 'der Kern behält sein Ziel');
    assert.deepEqual(sim.state.towers.map((tower) => tower.id), [core.id, far.id]);
    assert.equal(sim.save(), null);
    return { sim, core, far };
  };
  const one = play();
  const two = play();
  const eventsOne = collect(one.sim, 400);
  collect(two.sim, 400);
  assert.equal(snapshot(one.sim), snapshot(two.sim), 'gleiche Befehle, gleicher Verlauf');
  assert.ok(ofType(eventsOne, 'hit').length > 0 && ofType(eventsOne, 'shot').some((event) => event.tower === one.core), 'die Superwaffe feuert weiter');
  for (const event of [...ofType(eventsOne, 'kill')]) assert.ok(event.towerId === one.core.id || event.towerId === one.far.id);
  near(one.core.damageDealt + one.far.damageDealt, one.sim.state.stats.damageDealt, 1e-6);
  // Nach der Welle: speichern, laden, weiterspielen.
  const { sim } = one;
  stepUntil(sim, () => sim.state.phase === 'build' && sim.state.zones.length === 0 && sim.state.lock === 0);
  assert.equal(sim.state.stats.fusions, 1);
  const save = /** @type {SaveData} */ (sim.save());
  const loaded = createSim(sim.config, JSON.parse(JSON.stringify(save)));
  assert.equal(snapshot(loaded), snapshot(sim));
  for (const game of [sim, loaded]) {
    game.startWave();
    steps(game, 30);
  }
  assert.equal(snapshot(loaded), snapshot(sim));
});
