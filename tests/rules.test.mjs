// @ts-check
// Prüft die reinen Rechenregeln (docs/SIM.md, Abschnitt „Rechenregeln“) gegen von Hand nachgerechnete Werte der Testinhalte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rules from '../src/sim/rules.js';
import { addFusion, addTiles, makeContent, tier } from './fixtures/content.mjs';
import { near } from './fixtures/harness.mjs';

/** @import { Content, TowerArchetypeDef } from '../src/types/content' */

/**
 * @param {Content} content
 * @param {string} id
 * @returns {TowerArchetypeDef}
 */
function archOf(content, id) {
  const arch = content.archetypes.find((candidate) => candidate.id === id);
  if (!arch) throw new Error(`Rolle ${id} fehlt in den Testinhalten`);
  return arch;
}

test('round5 rundet auf das nächste Vielfache von 5, mindestens 5', () => {
  assert.equal(rules.round5(0), 5);
  assert.equal(rules.round5(2), 5);
  assert.equal(rules.round5(7), 5);
  assert.equal(rules.round5(7.5), 10);
  assert.equal(rules.round5(12.4), 10);
  assert.equal(rules.round5(162), 160);
  assert.equal(rules.round5(163), 165);
  assert.equal(rules.round5(-40), 5);
});

test('waveAge und totalWaves zählen fortlaufend durch die Zeitalter', () => {
  const content = makeContent();
  assert.equal(rules.totalWaves(content), 9);
  assert.deepEqual(rules.waveAge(content, 0), { age: 0, waveInAge: 0 });
  assert.deepEqual(rules.waveAge(content, 2), { age: 0, waveInAge: 2 });
  assert.deepEqual(rules.waveAge(content, 3), { age: 1, waveInAge: 0 });
  assert.deepEqual(rules.waveAge(content, 4), { age: 1, waveInAge: 1 });
  assert.deepEqual(rules.waveAge(content, 8), { age: 2, waveInAge: 2 });
  content.waves[0].push({ groups: [] });
  assert.equal(rules.totalWaves(content), 10);
  assert.deepEqual(rules.waveAge(content, 3), { age: 0, waveInAge: 3 });
  assert.deepEqual(rules.waveAge(content, 4), { age: 1, waveInAge: 0 });
});

test('towerStats: Grundwerte, darüber Stufe, darüber Zeitalter, dann Skalierung', () => {
  const content = makeContent();
  const shooter = archOf(content, 'shooter');
  const before = JSON.stringify(shooter);

  const base = rules.towerStats(content, shooter, 0, 1);
  assert.equal(base.damage, 10);
  assert.equal(base.range, 3);
  assert.equal(base.cooldown, 1);
  assert.equal(base.attack, 'projectile');
  assert.deepEqual(Object.keys(base).sort(), Object.keys(shooter.stats).sort());

  const mid = rules.towerStats(content, shooter, 1, 2);
  assert.equal(mid.damage, 10 * 2 * 1.6);
  assert.equal(mid.range, 3 * 1.1);
  assert.equal(mid.cooldown, 1, 'cooldown skaliert nicht');
  assert.equal(mid.projectileSpeed, 8);

  const top = rules.towerStats(content, shooter, 2, 3);
  assert.equal(top.attack, 'hitscan', 'tweak des Zeitalters gilt');
  assert.equal(top.cooldown, 0.5, 'levels der Stufe gilt');
  assert.equal(top.damage, 10 * 4 * 2.5);
  assert.equal(top.range, 3 * 1.2);

  assert.equal(JSON.stringify(shooter), before, 'die Rolle bleibt unverändert');
  assert.notEqual(rules.towerStats(content, shooter, 0, 1), rules.towerStats(content, shooter, 0, 1), 'jedes Mal ein neues Objekt');

  // dot skaliert wie damage, dotDuration nicht.
  const burner = rules.towerStats(content, archOf(content, 'burner'), 1, 2);
  assert.equal(burner.dot, 8 * 2 * 1.6);
  assert.equal(burner.dotDuration, 3);
  assert.equal(burner.damage, 3 * 2 * 1.6);
  assert.equal(burner.splash, 0.9, 'splash skaliert nicht');

  // Stufenbesonderheit nur auf ihrer Stufe.
  const thrower = archOf(content, 'thrower');
  assert.equal(rules.towerStats(content, thrower, 0, 2).splash, 1);
  assert.equal(rules.towerStats(content, thrower, 0, 3).splash, 1.4);
  assert.equal(rules.towerStats(content, thrower, 0, 3).zone, 0);
  assert.equal(rules.towerStats(content, archOf(content, 'slower'), 2, 3).zone, 3, 'zone wird übernommen und skaliert nicht');
  assert.equal(rules.towerStats(content, archOf(content, 'slower'), 2, 3).slow, 0.3);
});

test('towerStats: tweak des Zeitalters schlägt levels; auf Zahlenfeldern bleibt der Zuwachs der Stufe erhalten; danach wird skaliert', () => {
  const content = makeContent();
  const shooter = archOf(content, 'shooter');
  shooter.levels = [{}, {}, { cooldown: 0.5, damage: 20, range: 4, attack: 'pulse' }];
  shooter.tiers[1].tweak = { cooldown: 0.75, damage: 30, attack: 'hitscan' };
  const stats = rules.towerStats(content, shooter, 1, 3);
  assert.equal(stats.cooldown, 0.25, 'tweak 0,75 plus Zuwachs der Stufe (0,5 - 1)');
  assert.equal(stats.damage, (30 + (20 - 10)) * 2 * 2.5);
  assert.equal(stats.range, 4 * 1.2, 'ohne tweak gilt der Stufenwert');
  assert.equal(stats.attack, 'hitscan', 'kein Zahlenfeld: tweak gewinnt');
  const low = rules.towerStats(content, shooter, 1, 1);
  assert.equal(low.cooldown, 0.75);
  assert.equal(low.damage, 30 * 2);
  const other = rules.towerStats(content, shooter, 0, 3);
  assert.equal(other.cooldown, 0.5);
  assert.equal(other.damage, 20 * 1 * 2.5);
  // Kein Wert fällt unter 0.
  shooter.tiers[1].tweak = { cooldown: 0.25 };
  assert.equal(rules.towerStats(content, shooter, 1, 3).cooldown, 0);
});

test('towerStats: Verlangsamung und Takt wachsen mit Zeitalter UND Stufe (tweak + (levels - stats))', () => {
  const content = makeContent();
  const slower = archOf(content, 'slower');
  slower.levels = [{}, { slow: 0.38 }, { slow: 0.45 }];
  [0.3, 0.35, 0.4].forEach((slow, age) => void (/** @type {import('../src/types/content').TowerTierDef} */ (slower.tiers[age]).tweak = { slow }));
  const expected = [[0.3, 0.38, 0.45], [0.35, 0.43, 0.5], [0.4, 0.48, 0.55]];
  for (let age = 0; age < 3; age++) {
    for (let level = 1; level <= 3; level++) {
      assert.ok(Math.abs(rules.towerStats(content, slower, age, level).slow - expected[age][level - 1]) < 1e-12, `Zeitalter ${age}, Stufe ${level}`);
    }
  }
  const support = archOf(content, 'support');
  support.levels = [{}, { auraRate: 0.28 }, { auraRate: 0.35 }];
  /** @type {import('../src/types/content').TowerTierDef} */ (support.tiers[2]).tweak = { auraRate: 0.26 };
  assert.ok(Math.abs(rules.towerStats(content, support, 2, 3).auraRate - 0.41) < 1e-12);
  assert.equal(rules.towerStats(content, support, 0, 3).auraRate, 0.35);
});

test('towerStats mit Ausbauzweig: nur auf Stufe 3, set vor der Skalierung, mul und add danach; ohne opts wie bisher', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  const plain = rules.towerStats(content, shooter, 0, 3);
  assert.deepEqual([plain.cooldown, plain.damage, plain.projectileSpeed], [0.5, 25, 8]);
  near(plain.range, 3.6);
  assert.deepEqual(rules.towerStats(content, shooter, 0, 3, {}), plain);
  assert.deepEqual(rules.towerStats(content, shooter, 0, 3, { branch: -1 }), plain);
  assert.deepEqual(rules.towerStats(content, shooter, 0, 2, { branch: 1 }), rules.towerStats(content, shooter, 0, 2), 'unter Stufe 3 wirkt kein Zweig');
  const double = rules.towerStats(content, shooter, 0, 3, { branch: 0 });
  assert.equal(double.cooldown, 0.25);
  assert.equal(double.damage, 25);
  const sniper = rules.towerStats(content, shooter, 1, 3, { branch: 1 });
  assert.equal(sniper.projectileSpeed, 16);
  assert.equal(sniper.damage, 10 * 2 * 2.5 * 2);
  assert.equal(sniper.cooldown, 1.5);
  near(sniper.range, 3 * 1.2 + 1);
  // add.dot zählt in Standardschüssen des Technikstands (baseDamage * ageDamage), nicht der Stufe.
  const acid = rules.towerStats(content, archOf(content, 'slower'), 2, 3, { branch: 1 });
  assert.equal(acid.dot, 0.5 * 10 * 4);
  assert.equal(acid.dotDuration, 2);
  // Rollen ohne Zweige ignorieren die Angabe.
  assert.deepEqual(rules.towerStats(content, archOf(content, 'burner'), 0, 3, { branch: 1 }), rules.towerStats(content, archOf(content, 'burner'), 0, 3));
});

test('towerStats einer Superwaffe: die acht Schritte in ihrer Reihenfolge', () => {
  const content = addFusion(makeContent());
  /** @type {import('../src/types/content').TowerArchetypeDef} */
  const probe = {
    ...archOf(content, 'shooter'),
    id: 'probe',
    stats: { ...archOf(content, 'shooter').stats, damage: 10, splash: 1 },
    levels: [{}, {}, { splash: 2 }],
    branches: [
      { name: 'A', summary: '', icon: 'a', mod: { set: { splash: 3, slow: 0.1, slowDuration: 1 }, mul: { damage: 2 }, add: { damage: 1 } } },
      { name: 'B', summary: '', icon: 'b', mod: {} },
    ],
    fusion: { core: { set: { splash: 4 }, mul: { damage: 3 }, add: { damage: 1 } }, coreText: '', gift: {}, giftName: '', giftText: '' },
    tiers: [tier('a'), tier('b', { slow: 0.5 }), tier('c')],
  };
  const g1 = { ...probe, id: 'g1', fusion: { core: {}, coreText: '', gift: { set: { splash: 5 }, mul: { damage: 2 }, add: { damage: 1 } }, giftName: '', giftText: '' } };
  const g2 = { ...probe, id: 'g2', fusion: { core: {}, coreText: '', gift: { set: { splash: 6 }, add: { damage: 1 } }, giftName: '', giftText: '' } };
  content.archetypes.push(probe, g1, g2);
  assert.equal(rules.towerStats(content, probe, 0, 3).splash, 2, 'Stufe über Grundwert');
  assert.equal(rules.towerStats(content, probe, 0, 3, { branch: 0 }).splash, 3, 'Zweig über Stufe');
  assert.equal(rules.towerStats(content, probe, 0, 3, { branch: 0, super: true, gifts: [] }).splash, 4, 'Kern über Zweig');
  assert.equal(rules.towerStats(content, probe, 0, 3, { branch: 0, super: true, gifts: ['g1', 'g2'] }).splash, 6, 'Gaben über Kern, die spätere gewinnt');
  assert.equal(rules.towerStats(content, probe, 0, 3, { branch: 0, super: true, gifts: ['g2', 'g1'] }).splash, 5);
  assert.equal(rules.towerStats(content, probe, 0, 3, { branch: 0 }).slow, 0.1);
  assert.equal(rules.towerStats(content, probe, 1, 3, { branch: 0, super: true, gifts: ['g1'] }).slow, 0.5, 'tweak des Zeitalters über allen set');
  // Schaden im Technikstand 1: 10 * 2 * 2,5 = 50; Zweig x2 = 100, +1 Standardschuss (20) = 120; Superwaffe x1,5 = 180;
  // Kern x3 = 540, +20 = 560; Gabe g1 x2 = 1120, +20 = 1140; Gabe g2 +20 = 1160.
  assert.equal(rules.towerStats(content, probe, 1, 3, { branch: 0 }).damage, 120);
  assert.equal(rules.towerStats(content, probe, 1, 3, { branch: 0, super: true, gifts: [] }).damage, 560);
  assert.equal(rules.towerStats(content, probe, 1, 3, { branch: 0, super: true, gifts: ['g1', 'g2'] }).damage, 1160);
  assert.equal(rules.towerStats(content, probe, 1, 3, { branch: 0, super: true, gifts: ['g2', 'g1'] }).damage, 1180, 'die Reihenfolge der Gaben zählt');
  near(rules.towerStats(content, probe, 1, 3, { branch: 1, super: true, gifts: [] }).range, 3 * 1.2 * 1.1);
  assert.throws(() => rules.towerStats(content, probe, 1, 3, { super: true, gifts: ['geist'] }), /Unbekannte Turmrolle "geist"/);
  // `gifts` ohne `super` wirkt nicht.
  assert.deepEqual(rules.towerStats(content, probe, 1, 3, { branch: 0, gifts: ['g1'] }), rules.towerStats(content, probe, 1, 3, { branch: 0 }));
});

test('towerStats einer Superwaffe: Gaben geben einem Turm Brand und Verlangsamung, die er von Haus aus nicht hat', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  const before = JSON.stringify(content.archetypes);
  const stats = rules.towerStats(content, shooter, 1, 3, { branch: 0, super: true, gifts: ['burner', 'slower'] });
  assert.equal(stats.damage, 10 * 2 * 2.5 * 1.5 * 1.2);
  near(stats.range, 3 * 1.2 * 1.1);
  assert.equal(stats.cooldown, 0.25);
  assert.equal(stats.dot, 1 * 10 * 2, 'ein Standardschuss des Technikstands je Sekunde');
  assert.equal(stats.dotDuration, 3);
  assert.equal(stats.slow, 0.25);
  assert.equal(stats.slowDuration, 1.5);
  // Dreimal dieselbe Rolle: Gaben stapeln sich.
  assert.equal(rules.towerStats(content, shooter, 0, 3, { branch: 0, super: true, gifts: ['shooter', 'shooter'] }).cooldown, 0.25 * 0.75 * 0.75);
  // Ein Brenner als Kern: sein eigener Brand wächst mit der Superwaffe und dem Kern, die Gabe kommt obendrauf.
  const burner = rules.towerStats(content, archOf(content, 'burner'), 0, 3, { super: true, gifts: ['burner', 'piercer'] });
  assert.equal(burner.dot, 8 * 2.5 * 1.5 * 1.5 + 10);
  assert.equal(burner.dotDuration, 6);
  assert.equal(burner.pierce, 1);
  near(burner.range, 1.8 * 1.2 * 1.1 * 1.15);
  // Ein Unterstützer als Kern: doppelte Schadens-Aura, die Schadens-Gabe läuft ins Leere.
  const support = rules.towerStats(content, archOf(content, 'support'), 0, 3, { branch: 1, super: true, gifts: ['support', 'shooter'] });
  assert.equal(support.auraDamage, (0.25 + 0.15) * 2);
  assert.equal(support.auraRange, 0);
  assert.equal(support.damage, 0);
  assert.equal(JSON.stringify(content.archetypes), before, 'die Inhalte bleiben unverändert');
});

test('towerStats: der Zweig der Zutat wählt die Gabe; bei Superwaffen gewinnt die Angriffsart des Kerns über das Zeitalter', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  const thrower = archOf(content, 'thrower');
  const base = rules.towerStats(content, thrower, 0, 3, { super: true, gifts: ['shooter'] });
  assert.deepEqual(rules.towerStats(content, thrower, 0, 3, { super: true, gifts: ['shooter'], giftBranches: [0] }), base, 'ohne Angabe Zweig 0');
  const scope = rules.towerStats(content, thrower, 0, 3, { super: true, gifts: ['shooter'], giftBranches: [1] });
  near(scope.range, base.range * 1.5);
  near(scope.cooldown, base.cooldown / 0.75, 1e-9, 'die Gabe des Zweigs ersetzt fusion.gift');
  // Rollen ohne Zweige (-1) und Zweige ohne eigene Gabe geben fusion.gift.
  const plain = rules.towerStats(content, shooter, 0, 3, { super: true, gifts: ['thrower', 'slower'], giftBranches: [-1, 1] });
  assert.deepEqual(plain, rules.towerStats(content, shooter, 0, 3, { super: true, gifts: ['thrower', 'slower'] }));
  assert.equal(rules.giftMod(shooter, 1), shooter.branches?.[1].gift?.mod);
  assert.equal(rules.giftMod(shooter, 0), shooter.fusion?.gift);
  assert.equal(rules.giftMod(thrower, -1), thrower.fusion?.gift);
  // Angriffsart: Das Zeitalter setzt 'hitscan', der Kern 'beam'. Gewöhnliche Türme folgen dem Zeitalter, Superwaffen dem Kern.
  const probe = { ...shooter, id: 'probe', tiers: [tier('a', { attack: 'hitscan' })], fusion: { core: { set: { attack: /** @type {const} */ ('beam'), ramp: 1, rampTime: 2 } }, coreText: '', gift: {}, giftName: '', giftText: '' } };
  content.archetypes.push(probe);
  assert.equal(rules.towerStats(content, probe, 0, 3).attack, 'hitscan');
  assert.equal(rules.towerStats(content, probe, 0, 3, { super: true, gifts: [] }).attack, 'beam');
  assert.equal(rules.towerStats(content, probe, 0, 3, { super: true, gifts: [] }).ramp, 1);
});

test('Kosten: Bau, Ausbau, Neuwert, Modernisierung', () => {
  const content = makeContent();
  const shooter = archOf(content, 'shooter');
  const thrower = archOf(content, 'thrower');
  assert.equal(rules.buildCost(content, shooter, 0), 50);
  assert.equal(rules.buildCost(content, shooter, 1), 90);
  assert.equal(rules.buildCost(content, shooter, 2), 160);
  assert.equal(rules.buildCost(content, thrower, 1), 160, '162 wird auf 160 gerundet');
  assert.equal(rules.buildCost(content, thrower, 2), 290, '288 wird auf 290 gerundet');

  assert.equal(rules.upgradeCost(content, shooter, 0, 1), 60);
  assert.equal(rules.upgradeCost(content, shooter, 0, 2), 90);
  assert.equal(rules.upgradeCost(content, shooter, 0, 3), -1, 'für Stufe 3 gibt es keinen Ausbau');
  assert.equal(rules.upgradeCost(content, shooter, 1, 1), 110, '90 * 1,2 = 108 wird auf 110 gerundet');
  assert.equal(rules.upgradeCost(content, shooter, 1, 2), 160);
  assert.equal(rules.upgradeCost(content, thrower, 1, 1), 190, 'Ausbau rechnet mit den gerundeten Baukosten: 160 * 1,2 = 192');

  assert.equal(rules.towerValue(content, shooter, 0, 1), 50);
  assert.equal(rules.towerValue(content, shooter, 0, 2), 110);
  assert.equal(rules.towerValue(content, shooter, 0, 3), 200);
  assert.equal(rules.towerValue(content, shooter, 1, 3), 360);
  assert.equal(rules.towerValue(content, shooter, 2, 2), 350);

  // Fester Anteil des Neuwerts im Zielzeitalter, egal woher der Turm kommt.
  assert.equal(rules.modernizeCost(content, shooter, 1, 1), 40, '90 * 0,45 = 40,5');
  assert.equal(rules.modernizeCost(content, shooter, 1, 3), 160, '360 * 0,45 = 162');
  assert.equal(rules.modernizeCost(content, shooter, 2, 1), 70, '160 * 0,45 = 72');
  assert.equal(rules.modernizeCost(content, shooter, 2, 2), 160, '350 * 0,45 = 157,5');
  assert.equal(rules.modernizeCost.length, 5, 'kein Ausgangs-Technikstand in der Rechnung (Rolle, Ziel, Stufe, Zusätze)');
});

test('Kosten einer Superwaffe: Neuwert samt Zutaten, Modernisierung, Gebühr', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  // Stufe 3 im ersten Zeitalter: shooter 50 + 60 + 90 = 200, burner 100 + 120 + 180 = 400, slower 70 + 85 + 125 = 280.
  assert.equal(rules.towerValue(content, shooter, 0, 3, { super: true, gifts: ['burner', 'slower'] }), 880);
  assert.equal(rules.towerValue(content, shooter, 0, 3, { branch: 1 }), 200, 'der Zweig kostet nichts extra');
  assert.equal(rules.towerValue(content, shooter, 0, 3, { gifts: ['burner'] }), 200, 'gifts ohne super zählt nicht');
  // Im zweiten Zeitalter: shooter 360, burner 180 + 215 + 325 = 720, slower 125 + 150 + 225 = 500; 45 % von 1580 = 711.
  assert.equal(rules.modernizeCost(content, shooter, 1, 3, { super: true, gifts: ['burner', 'slower'] }), 710);
  assert.equal(rules.modernizeCost(content, shooter, 1, 3, { super: true, gifts: ['shooter', 'shooter'] }), 485, '45 % von 1080 = 486');
  assert.equal(rules.fuseCost(content, shooter, 0), 25, 'die Hälfte der Baukosten des Kerns');
  assert.equal(rules.fuseCost(content, shooter, 1), 45);
  assert.equal(rules.fuseCost(content, archOf(content, 'burner'), 2), 160);
  content.balance.fusion.fee = 0;
  assert.equal(rules.fuseCost(content, shooter, 0), 0, 'ohne Gebühr kostenlos, nicht mindestens 5');
  delete (/** @type {any} */ (content.balance).fusion);
  assert.equal(rules.fuseCost(content, shooter, 0), 0);
});

test('towerStats einer Megawaffe: vier Gaben in Reihenfolge, megaDamage und megaRange statt damage und range, Kern einmal', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  const g1 = { ...shooter, id: 'g1', fusion: { core: {}, coreText: '', gift: { set: { splash: 5 }, mul: { damage: 2 }, add: { damage: 1 } }, giftName: '', giftText: '' } };
  const g2 = { ...shooter, id: 'g2', fusion: { core: {}, coreText: '', gift: { set: { splash: 6 }, add: { damage: 1 } }, giftName: '', giftText: '' } };
  content.archetypes.push(g1, g2);
  const before = JSON.stringify(content.archetypes);
  // Technikstand 1, Zweig 0: 10 * 2 * 2,5 = 50; Megawaffe x2 = 100; Kern x1,2 = 120 (nur einmal);
  // g1 x2 = 240, +20 = 260; g2 +20 = 280; g2 +20 = 300; g1 x2 = 600, +20 = 620.
  const mega = { branch: 0, super: true, mega: true, gifts: ['g1', 'g2', 'g2', 'g1'] };
  const stats = rules.towerStats(content, shooter, 1, 3, mega);
  near(stats.damage, 620);
  assert.equal(stats.splash, 5, 'das set der zuletzt aufgenommenen Gabe gewinnt');
  near(stats.range, 3 * 1.2 * 1.2, 1e-6, 'megaRange statt range');
  near(rules.towerStats(content, shooter, 1, 3, { ...mega, gifts: ['g1', 'g1', 'g2', 'g2'] }).damage, ((120 * 2 + 20) * 2 + 20) + 40, 1e-6, 'die Reihenfolge zählt');
  // Mit vier echten Gaben: Feuerpause zweimal x0,75, Brand und Verlangsamung.
  const real = rules.towerStats(content, shooter, 0, 3, { branch: 0, super: true, mega: true, gifts: ['burner', 'slower', 'shooter', 'shooter'] });
  near(real.cooldown, 0.25 * 0.75 * 0.75);
  near(real.damage, rules.towerStats(content, shooter, 0, 3, { branch: 0 }).damage * 2 * 1.2);
  assert.equal(real.dot, 10);
  assert.equal(real.slow, 0.25);
  // `mega` ohne `super` wirkt nicht; `super` ohne `mega` rechnet wie eine Superwaffe, auch mit vier Gaben.
  assert.deepEqual(rules.towerStats(content, shooter, 1, 3, { branch: 0, mega: true }), rules.towerStats(content, shooter, 1, 3, { branch: 0 }));
  near(rules.towerStats(content, shooter, 1, 3, { branch: 0, super: true, gifts: [] }).damage, 50 * 1.5 * 1.2);
  near(rules.towerStats(content, shooter, 1, 3, { branch: 0, super: true, mega: true, gifts: [] }).damage, 50 * 2 * 1.2);
  assert.equal(JSON.stringify(content.archetypes), before, 'die Inhalte bleiben unverändert');
});

test('Kosten einer Megawaffe: Neuwert samt vier Zutaten, Modernisierung, Gebühr megaFee', () => {
  const content = addFusion(makeContent());
  const shooter = archOf(content, 'shooter');
  const opts = { super: true, mega: true, gifts: ['burner', 'slower', 'shooter', 'shooter'] };
  assert.equal(rules.towerValue(content, shooter, 0, 3, opts), 200 + 400 + 280 + 200 + 200);
  // Im zweiten Zeitalter: 360 + 720 + 500 + 360 + 360 = 2300; 45 % = 1035.
  assert.equal(rules.modernizeCost(content, shooter, 1, 3, opts), 1035);
  assert.equal(rules.fuseCost(content, shooter, 0, true), 50, 'megaFee 1 mal Baukosten 50');
  assert.equal(rules.fuseCost(content, shooter, 1, true), 90);
  assert.equal(rules.fuseCost(content, shooter, 0, false), 25, 'ohne mega die Gebühr der Superwaffe');
  content.balance.fusion.megaFee = 0;
  assert.equal(rules.fuseCost(content, shooter, 0, true), 0);
  assert.equal(rules.fuseCost(content, shooter, 0), 25);
});

test('enemyStats: Werte nach dem Zeitalter der Welle, nicht nach def.age', () => {
  const content = makeContent();
  const e = content.enemies;
  assert.deepEqual(rules.enemyStats(content, e.grunt, 0, 0, 'normal'), { hp: 20, armor: 0, shield: 0, bounty: 5, speed: 1 });
  // Ritter (def.age 'rome') in der dritten Welle des zweiten Zeitalters auf „knifflig“.
  const knight = rules.enemyStats(content, e.knight, 1, 2, 'hard');
  assert.equal(knight.hp, 120, '20 * 2 * 1,2 * 2 * 1,25');
  assert.equal(knight.armor, 10, '0,5 * 10 * 2');
  assert.equal(knight.bounty, 16, '5 * 2 * 2 * 0,8');
  assert.equal(knight.speed, 0.8 * 1.1);
  // Derselbe Ritter im ersten Zeitalter ist ein Gegner des ersten Zeitalters.
  assert.equal(rules.enemyStats(content, e.knight, 0, 0, 'normal').hp, 40);
  assert.equal(rules.enemyStats(content, e.knight, 0, 0, 'normal').armor, 5);
  // Schild als Anteil der gerundeten Lebenspunkte.
  const mage = rules.enemyStats(content, e.mage, 0, 1, 'normal');
  assert.equal(mage.hp, 44);
  assert.equal(mage.shield, 22);
  assert.equal(rules.enemyStats(content, e.runner, 0, 0, 'normal').bounty, 3);
  assert.equal(rules.enemyStats(content, e.grunt, 2, 2, 'easy').hp, 77, '20 * 4 * 1,2 * 0,8 = 76,8');
  // Untergrenzen.
  const tiny = { ...e.grunt, hp: 0.001, bounty: 0.001 };
  assert.equal(rules.enemyStats(content, tiny, 0, 0, 'normal').hp, 1);
  assert.equal(rules.enemyStats(content, tiny, 0, 0, 'normal').bounty, 1);
  // Der Schwierigkeitsgrad darf auch als Definition übergeben werden.
  assert.deepEqual(rules.enemyStats(content, e.knight, 1, 2, content.balance.difficulty.hard), knight);
});

test('Prämien: Welle, Makellos-Zuschlag, Zeitgeschenk, Schaden der Fähigkeit', () => {
  const content = makeContent();
  assert.equal(rules.waveBonus(content, 0, 'normal'), 30);
  assert.equal(rules.waveBonus(content, 1, 'normal'), 60);
  assert.equal(rules.waveBonus(content, 2, 'hard'), 72);
  assert.equal(rules.perfectBonus(content, 0, 'normal'), 15);
  assert.equal(rules.perfectBonus(content, 2, 'hard'), 36);
  assert.equal(rules.ageGift(content, 1, 'normal'), 160);
  assert.equal(rules.ageGift(content, 2, 'hard'), 192);
  assert.equal(rules.abilityDamage(content, content.abilities[1], 1), 100);
  assert.equal(rules.abilityDamage(content, content.abilities[1], 2), 200);
  assert.equal(rules.abilityDamage(content, content.abilities[0], 0), 0);
  content.balance.waveBonus = 6.3;
  assert.equal(rules.waveBonus(content, 0, 'normal'), 32, '31,5 wird gerundet');
});

// --- Besondere Bauplätze (docs/briefs/fusion.md, Abschnitt 6) ------------------------------------------------------

test('Bauplätze: tileDef und tilePrice; leere, unbekannte Arten und Inhalte ohne balance.tiles wirken nicht', () => {
  const content = addTiles(makeContent());
  assert.equal(rules.tileDef(content, 'high'), content.balance.tiles.high);
  assert.equal(rules.tileDef(content, ''), null);
  assert.equal(rules.tileDef(content, 'nirgends'), null);
  assert.equal(rules.tileDef(content, undefined), null);
  assert.equal(rules.tileDef(content, 'toString'), null, 'nur eigene Schlüssel');
  // Matsch: Faktor 1,5, auf 5 gerundet; Preise <= 0 (0 = kostenlos, -1 = gibt es nicht) bleiben.
  assert.equal(rules.tilePrice(content, 'mud', 50), 75);
  assert.equal(rules.tilePrice(content, 'mud', 25), 40);
  assert.equal(rules.tilePrice(content, 'mud', 0), 0);
  assert.equal(rules.tilePrice(content, 'mud', -1), -1);
  assert.equal(rules.tilePrice(content, 'high', 55), 55, 'Faktor 1');
  assert.equal(rules.tilePrice(content, '', 55), 55);
  const bare = makeContent();
  delete (/** @type {Partial<Content['balance']>} */ (bare.balance)).tiles;
  assert.equal(rules.tileDef(bare, 'mud'), null);
  assert.equal(rules.buildCost(bare, archOf(bare, 'shooter'), 0, 'mud'), 50);
});

test('Bauplätze: Kostenfaktor auf Bau, Ausbau, Modernisieren und Gebühr; der Neuwert bleibt ohne Aufschlag', () => {
  const content = addTiles(addFusion(makeContent()));
  const shooter = archOf(content, 'shooter');
  // Steinzeit: Bau 50, Ausbau 60 und 90; auf Matsch das 1,5-Fache.
  assert.equal(rules.buildCost(content, shooter, 0, 'mud'), 75);
  assert.equal(rules.buildCost(content, shooter, 0, 'high'), 50);
  assert.equal(rules.buildCost(content, shooter, 0, ''), 50);
  assert.equal(rules.upgradeCost(content, shooter, 0, 1, 'mud'), 90);
  assert.equal(rules.upgradeCost(content, shooter, 0, 2, 'mud'), 135);
  assert.equal(rules.upgradeCost(content, shooter, 0, 3, 'mud'), -1);
  // Rom, Stufe 1: Neuwert 90, Modernisieren round5(90 * 0,45) = 40, auf Matsch round5(40 * 1,5) = 60.
  assert.equal(rules.towerValue(content, shooter, 1, 1, { tile: 'mud' }), 90);
  assert.equal(rules.modernizeCost(content, shooter, 1, 1), 40);
  assert.equal(rules.modernizeCost(content, shooter, 1, 1, { tile: 'mud' }), 60);
  // Gebühr: 0,5 * 50 = 25 -> 40; Megawaffe 1 * 50 = 50 -> 75.
  assert.equal(rules.fuseCost(content, shooter, 0, false, 'mud'), 40);
  assert.equal(rules.fuseCost(content, shooter, 0, true, 'mud'), 75);
  assert.equal(rules.fuseCost(content, shooter, 0, false, 'well'), 25);
  // Eine Gebühr von 0 bleibt 0.
  content.balance.fusion.fee = 0;
  assert.equal(rules.fuseCost(content, shooter, 0, false, 'mud'), 0);
});

test('Bauplätze: Die Wirkung kommt ganz zuletzt, auch nach der Verschmelzung; ein Turm passt weiter als opts', () => {
  const content = addTiles(addFusion(makeContent()));
  const shooter = archOf(content, 'shooter');
  const plain = rules.towerStats(content, shooter, 0, 1);
  const high = rules.towerStats(content, shooter, 0, 1, { tile: 'high' });
  near(high.range, plain.range * 1.5);
  assert.equal(high.damage, plain.damage);
  // Quelle: Schaden x2 plus ein Standardschuss (10 in der Steinzeit, 20 in Rom).
  near(rules.towerStats(content, shooter, 0, 1, { tile: 'well' }).damage, 2 * 10 + 10);
  near(rules.towerStats(content, shooter, 1, 2, { tile: 'well' }).damage, 2 * rules.towerStats(content, shooter, 1, 2).damage + 20);
  assert.deepEqual(rules.towerStats(content, shooter, 0, 1, { tile: 'mud' }), plain, 'Matsch ändert keine Werte');
  assert.deepEqual(rules.towerStats(content, shooter, 0, 1, { tile: 'nirgends' }), plain);
  // Superwaffe auf der Quelle: erst alles andere samt Gaben, dann x2 und + Standardschuss.
  const fused = { branch: 0, super: true, gifts: ['burner', 'thrower'], giftBranches: [-1, -1] };
  const core = rules.towerStats(content, shooter, 0, 3, fused);
  const onWell = rules.towerStats(content, shooter, 0, 3, { ...fused, tile: 'well' });
  near(onWell.damage, 2 * core.damage + 10);
  near(onWell.dot, 2 * core.dot);
  assert.equal(onWell.splash, core.splash);
  // Megawaffe auf der Anhöhe: Reichweite nach megaRange noch einmal x1,5.
  const mega = { ...fused, mega: true, gifts: ['burner', 'thrower', 'piercer', 'support'], giftBranches: [-1, -1, -1, 0] };
  near(rules.towerStats(content, shooter, 0, 3, { ...mega, tile: 'high' }).range, rules.towerStats(content, shooter, 0, 3, mega).range * 1.5);
  // Ein Turm als opts: sein Feld zählt mit.
  const tower = { branch: 0, super: false, mega: false, gifts: /** @type {string[]} */ ([]), giftBranches: /** @type {number[]} */ ([]), tile: 'high' };
  near(rules.towerStats(content, shooter, 0, 3, tower).range, rules.towerStats(content, shooter, 0, 3, { branch: 0 }).range * 1.5);
});
