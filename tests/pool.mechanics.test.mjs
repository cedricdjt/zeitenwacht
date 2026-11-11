// @ts-check
// Mechaniken der Waffen des Pools (docs/SIM.md, „Türme und Angriffe“): Rückstoß (`push`), Zeichen (`mark`), Sucher (`seek`) und
// Kopfgeld-Aura (`auraBounty`), dazu ihre Rechenregeln (freiwillige Felder in `towerStats`) und ihre Prüfung.
// Karte 'straight': Ein Gegner mit Strecke d steht bei x = d - 6,5; ein Turm auf Feld (tx, 2) steht bei (tx - 5,5; -1).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hitsFliers, towerStats } from '../src/sim/rules.js';
import { checkContent } from '../src/sim/validate.js';
import { makeContent, stats } from './fixtures/content.mjs';
import { STILL, addArch, begin, mustBuild, near, ofType, scene, steps } from './fixtures/harness.mjs';

/** @import { WaveDef } from '../src/types/content' */

/** Ein Läufer, der praktisch steht, aber kein Boss ist. */
const STAND = Object.freeze({ hp: 5, speed: 1e-6 });

/**
 * @param {...string} ids
 * @returns {WaveDef['groups']}
 */
function each(...ids) {
  return ids.map((enemy) => ({ enemy, count: 1, interval: 0, delay: 0 }));
}

test('Rückstoß: wirft zurück, Bosse halb, einmal je Sekunde, nie vor den Anfang; Ereignis push', () => {
  const sim = scene({
    enemies: { laeufer: STAND, boss: STILL, vorn: STAND },
    towers: { stoss: { damage: 1, cooldown: 0.25, push: 0.6 } },
    wave: each('laeufer', 'boss', 'vorn'),
  });
  const [runner, boss, front] = begin(sim, [5, 8, 0.2]);
  mustBuild(sim, 'stoss', 1, 2);
  mustBuild(sim, 'stoss', 2, 2);
  mustBuild(sim, 'stoss', 3, 2);
  sim.drainEvents();
  sim.step();
  // Drei Türme feuern im selben Zeitschritt; jeder trifft sein Ziel (Modus first: das am weitesten vorn ist der Boss bei 8).
  // Darum zielen alle drei auf den Boss: Nur der erste Treffer stößt ihn (halb), die anderen prallen am Schutz ab.
  const pushes = ofType(sim.drainEvents(), 'push');
  assert.equal(pushes.length, 1);
  near(pushes[0].distance, 0.3, 1e-9, 'Boss halb');
  near(boss.dist, 8 - 0.3, 1e-5);
  assert.equal(boss.px, boss.x);
  assert.equal(runner.dist > 4.99, true);
  // Eine Sekunde später ist er wieder stoßbar.
  steps(sim, 59);
  assert.equal(ofType(sim.drainEvents(), 'push').length, 0, 'Schutz hält eine Sekunde');
  steps(sim, 2);
  assert.ok(ofType(sim.drainEvents(), 'push').length >= 1);
  // Ein Gegner am Anfang des Weges wird nicht vor den Anfang geworfen.
  const sim2 = scene({ enemies: { vorn: STAND }, towers: { stoss: { damage: 1, cooldown: 0.25, push: 0.6 } }, wave: each('vorn') });
  const [only] = begin(sim2, [0.2]);
  mustBuild(sim2, 'stoss', 1, 2);
  sim2.step();
  near(only.dist, 0, 1e-9);
  near(front.dist, 0.2, 1e-5);
});

test('Rückstoß auf Fläche und Puls: jeder Getroffene, Tote nicht; ein Projektil trägt ihn', () => {
  const sim = scene({
    enemies: { a: STAND, b: STAND, zart: { ...STAND, hp: 0.01 } },
    towers: { welle: { attack: 'pulse', damage: 1, range: 30, push: 0.5 } },
    wave: each('a', 'b', 'zart'),
  });
  const [a, b, soft] = begin(sim, [4, 6, 8]);
  mustBuild(sim, 'welle', 5, 2);
  sim.drainEvents();
  sim.step();
  near(a.dist, 3.5, 1e-5);
  near(b.dist, 5.5, 1e-5);
  assert.equal(soft.alive, false);
  assert.equal(ofType(sim.drainEvents(), 'push').length, 2, 'der Tote wird nicht zurückgeworfen');
  const sim2 = scene({ enemies: { a: STAND }, towers: { wurf: { attack: 'projectile', projectileSpeed: 10, damage: 1, splash: 1, push: 0.4 } }, wave: each('a') });
  const [target] = begin(sim2, [4]);
  mustBuild(sim2, 'wurf', 2, 2);
  steps(sim2, 60);
  near(target.dist, 3.6, 1e-4);
});

test('Zeichen: mehr Schaden von allem (auch Brand), das stärkste zählt, läuft ab', () => {
  const sim = scene({
    enemies: { ziel: STAND },
    towers: { zeichner: { damage: 0, cooldown: 1000, mark: 0.5, markDuration: 2 }, schwach: { damage: 0, cooldown: 1000, mark: 0.2, markDuration: 5 } },
    wave: each('ziel'),
  });
  const [target] = begin(sim, [5]);
  mustBuild(sim, 'zeichner', 1, 2);
  sim.step();
  assert.deepEqual([target.vuln, target.vulnTime], [0.5, 2]);
  // Ein schwächeres Zeichen ersetzt das starke nicht und verlängert es nicht.
  mustBuild(sim, 'schwach', 2, 2);
  sim.step();
  assert.equal(target.vuln, 0.5);
  near(/** @type {number} */ (target.vulnTime), 2 - 1 / 60, 1e-9);
  // Ein Treffer von 10 nimmt 15, Brand 6 je Sekunde nimmt 9 je Sekunde.
  const sim2 = scene({
    enemies: { ziel: STAND },
    towers: { zeichner: { damage: 0, cooldown: 1000, mark: 0.5, markDuration: 10 }, hammer: { damage: 10, cooldown: 1000 }, glut: { damage: 0, cooldown: 1000, dot: 6, dotDuration: 1 } },
    wave: each('ziel'),
  });
  const [t2] = begin(sim2, [5]);
  mustBuild(sim2, 'zeichner', 1, 2);
  sim2.step();
  mustBuild(sim2, 'hammer', 2, 2);
  sim2.step();
  near(t2.hp, 100 - 15, 1e-9, 'Treffer mit Zeichen');
  mustBuild(sim2, 'glut', 3, 2);
  steps(sim2, 61);
  near(t2.hp, 100 - 15 - 9, 0.2, 'Brand mit Zeichen');
  // Ablauf: nach markDuration ist das Zeichen weg.
  steps(sim, 2 * 60);
  assert.deepEqual([target.vuln, target.vulnTime], [0, 0]);
});

test('Sucher: nimmt zuerst Ziele ohne seine Wirkung, sonst das beste; ohne seek wie bisher', () => {
  for (const [name, effect] of /** @type {const} */ ([['dot', { dot: 5, dotDuration: 4 }], ['slow', { slow: 0.3, slowDuration: 4 }], ['mark', { mark: 0.2, markDuration: 4 }], ['push', { push: 0.1 }]])) {
    const sim = scene({
      enemies: { e: STAND },
      towers: { sucher: { damage: 0.01, cooldown: 1 / 3, seek: true, ...effect }, stur: { damage: 0.01, cooldown: 1 / 3, ...effect } },
      wave: each('e', 'e', 'e'),
    });
    const foes = begin(sim, [9, 7, 5]);
    const seeker = mustBuild(sim, 'sucher', 1, 2);
    const plain = mustBuild(sim, 'stur', 2, 4);
    /** @type {number[]} */
    const seekerTargets = [];
    /** @type {number[]} */
    const plainTargets = [];
    for (let i = 0; i < 3; i++) {
      sim.step();
      seekerTargets.push(seeker.targetId);
      plainTargets.push(plain.targetId);
      steps(sim, 19);
    }
    // Der sture Turm (Modus first) bleibt beim vordersten; der Sucher wandert weiter, solange es Gegner ohne die Wirkung gibt.
    assert.deepEqual(plainTargets, [foes[0].id, foes[0].id, foes[0].id], name);
    assert.equal(new Set(seekerTargets).size, 3, `${name}: ${seekerTargets}`);
  }
});

test('Kopfgeld-Aura: Tote im Umkreis bringen mehr, es zählt der stärkste, Ereignis gold mit extra', () => {
  const sim = scene({
    enemies: { nah: { ...STAND, hp: 0.01, bounty: 4 }, fern: { ...STAND, hp: 0.01, bounty: 4 } },
    towers: {
      killer: { damage: 100, cooldown: 0.1, range: 30 },
      bank: { attack: 'none', range: 2, auraBounty: 0.5, hitsGround: false },
      kleinbank: { attack: 'none', range: 3, auraBounty: 0.25, hitsGround: false },
    },
    wave: each('nah', 'fern'),
  });
  begin(sim, [5, 11]);
  mustBuild(sim, 'bank', 4, 2);
  mustBuild(sim, 'kleinbank', 3, 2);
  const gold = sim.state.gold;
  mustBuild(sim, 'killer', 1, 4);
  const paid = sim.state.gold;
  sim.drainEvents();
  steps(sim, 20);
  const events = sim.drainEvents();
  const golds = ofType(events, 'gold').filter((e) => e.reason === 'bounty');
  // Kopfgeld je Gegner 4 x 5 = 20 Gold: fern (x = 4,5, stirbt zuerst) ohne Aura, nah (x = -1,5, in beiden Umkreisen) +50 %.
  assert.deepEqual(golds.map((e) => [e.amount, e.extra]), [[20, undefined], [30, 10]]);
  assert.deepEqual(ofType(events, 'kill').map((e) => e.bounty), [20, 30]);
  assert.ok(gold > paid);
});

test('Rechenregeln: freiwillige Felder nur, wenn genannt; add legt an, mul nicht; Flieger zählen nur mit Schaden', () => {
  const content = makeContent();
  addArch(content, 'plain', { damage: 5 });
  addArch(content, 'stoss', { damage: 5, push: 0.4, seek: true });
  const plain = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'plain'));
  const pusher = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'stoss'));
  const s0 = towerStats(content, plain, 0, 1);
  assert.equal('push' in s0 || 'mark' in s0 || 'seek' in s0 || 'auraBounty' in s0, false);
  const s1 = towerStats(content, pusher, 1, 1);
  assert.deepEqual([s1.push, s1.seek], [0.4, true]);
  plain.branches = [
    { name: 'a', summary: '', icon: 'x', mod: { add: { mark: 0.2, markDuration: 2 }, mul: { push: 2 } } },
    { name: 'b', summary: '', icon: 'x', mod: { set: { push: 0.3 }, mul: { push: 2 } } },
  ];
  const a = towerStats(content, plain, 0, 3, { branch: 0 });
  assert.deepEqual([a.mark, a.markDuration, 'push' in a], [0.2, 2, false]);
  near(/** @type {number} */ (towerStats(content, plain, 0, 3, { branch: 1 }).push), 0.6);
  // Ein Turm, der Flieger nur zeichnet, zählt nicht als Flieger-Waffe.
  const marker = { ...plain, stats: stats({ attack: 'pulse', damage: 0, hitsAir: true, mark: 0.2, markDuration: 2 }) };
  assert.equal(hitsFliers(marker), false);
  assert.equal(hitsFliers({ ...plain, stats: stats({ attack: 'pulse', damage: 1, hitsAir: true }) }), true);
});

test('Prüfung: freiwillige Felder nicht negativ, Zeichen mit Dauer, seek ein Wahrheitswert', () => {
  /** @param {Partial<import('../src/types/content').TowerStats>} patch */
  const check = (patch) => {
    const content = makeContent();
    addArch(content, 'x', patch);
    checkContent(content, 'straight', 'normal');
  };
  check({ push: 0.5, mark: 0.2, markDuration: 2, seek: true, auraBounty: 0.3 });
  assert.throws(() => check({ push: -1 }), /push muss eine Zahl ab 0 sein/);
  assert.throws(() => check({ mark: 0.2 }), /Zeichen \(mark\) braucht eine Dauer/);
  assert.throws(() => check({ seek: /** @type {any} */ ('ja') }), /seek muss true oder false sein/);
});
