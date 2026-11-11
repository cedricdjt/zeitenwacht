// @ts-check
// Zeitgaben (docs/briefs/fusion.md, Abschnitt 9; docs/SIM.md, „Zeitgaben“): Angebot beim Zeitalterwechsel, Wahl, Wirkung auf
// Türme, Preise, Fähigkeit und Regeln, Speichern und Laden (auch mit offenem Angebot), Prüfung der Inhalte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rules from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { content as gameContent } from '../src/content/index.js';
import { addFusion, addTiles, makeContent } from './fixtures/content.mjs';
import { begin, digest, makeSim, mustBuild, near, ofType, setEnemy, steps, stepUntil, STILL } from './fixtures/harness.mjs';

/** @import { BoonDef, Content } from '../src/types/content' */
/** @import { SaveData, Sim, SimConfig } from '../src/types/sim' */

/** Zeitgaben der Tests, mit runden Zahlen. @type {BoonDef[]} */
const BOONS = [
  { id: 'wucht', name: 'Wucht', text: 'Schützen x2', icon: 'damage', effect: { towers: [{ roles: ['shooter'], mod: { mul: { damage: 2 } } }] } },
  { id: 'handel', name: 'Handel', text: 'Preise', icon: 'gold', effect: { economy: { build: 0.5, upgrade: 2, sell: 2, waveBonus: 2, bounty: 2, early: 2, modernize: 0.5, fuse: 0 } } },
  { id: 'glocke', name: 'Glocke', text: 'Glocke', icon: 'bell', effect: { ability: { cooldown: 0.5, rewind: 2 } } },
  { id: 'leben', name: 'Leben', text: '+5', icon: 'heart', effect: { grant: { lives: 5, gold: 10 } } },
  { id: 'opfer', name: 'Opfer', text: '-100', icon: 'heart', effect: { grant: { lives: -100 } } },
  { id: 'brand', name: 'Brand', text: 'springt', icon: 'fire', effect: { rules: { burnSpread: 2, burnOnSlowed: 0.5 } } },
  { id: 'riese', name: 'Riese', text: 'Bosse', icon: 'boss', effect: { rules: { bossDamage: 2, airDamage: 3 } } },
  { id: 'mega', name: 'Mega', text: 'Mega', icon: 'mega', effect: { rules: { megaLimit: 1 } } },
];

/**
 * Testinhalte mit Zeitgaben und leeren Wellen: Jede Welle endet im Zeitschritt nach ihrem Start.
 * @param {(content: Content) => void} [edit]
 * @returns {Content}
 */
function boonContent(edit) {
  const content = makeContent();
  content.boons = structuredClone(BOONS);
  content.waves = content.ages.map(() => [{ groups: /** @type {import('../src/types/content').SpawnGroup[]} */ ([]) }, { groups: [] }]);
  if (edit) edit(content);
  return content;
}

/**
 * @param {Content} content
 * @param {Partial<SimConfig>} [config]
 * @param {SaveData | null} [save]
 * @returns {Sim}
 */
function boonSim(content, config = {}, save = null) {
  return createSim({ content, mapId: 'straight', difficulty: 'normal', seed: 5, unlockAll: true, boonChoice: true, ...config }, save);
}

/**
 * Spielt leere Wellen, bis das nächste Zeitalter anbricht.
 * @param {Sim} sim
 */
function toAgeChange(sim) {
  const age = sim.state.age;
  while (sim.state.age === age) {
    if (sim.state.phase === 'build') {
      sim.state.lock = 0;
      const started = sim.startWave();
      assert.ok(started.ok, `Welle startet nicht: ${started.reason}`);
    }
    sim.step();
  }
}

/**
 * Eine Partie, die die genannten Zeitgaben schon besitzt (über einen Spielstand).
 * @param {Content} content
 * @param {string[]} boons
 * @param {Partial<SimConfig>} [config]
 * @returns {Sim}
 */
function owning(content, boons, config = {}) {
  const first = boonSim(content, config);
  const save = /** @type {SaveData} */ (first.save());
  return boonSim(content, config, { ...save, boons });
}

test('Ohne Zeitgaben in den Inhalten gibt es kein Angebot, und der Zufall der Partie bleibt unberührt', () => {
  const plain = boonContent((content) => delete content.boons);
  const a = boonSim(plain);
  toAgeChange(a);
  assert.deepEqual(a.state.boonOffer, []);
  assert.deepEqual(a.state.boons, []);
  assert.equal(a.startWave().ok, false); // nur die Sperre des Zeitalterwechsels
  a.state.lock = 0;
  assert.ok(a.startWave().ok);
});

test('Angebot beim Zeitalterwechsel: drei verschiedene Gaben, deterministisch; Welle gesperrt bis zur Wahl', () => {
  const sim = boonSim(boonContent());
  toAgeChange(sim);
  const offer = sim.state.boonOffer.slice();
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer).size, 3);
  for (const id of offer) assert.ok(BOONS.some((boon) => boon.id === id));
  const events = sim.drainEvents();
  const offered = ofType(events, 'boonOffer');
  assert.equal(offered.length, 1);
  assert.deepEqual(offered[0].offer, offer);
  // Gleicher Startwert, gleiches Angebot.
  const twin = boonSim(boonContent());
  toAgeChange(twin);
  assert.deepEqual(twin.state.boonOffer, offer);
  // Gesperrt: erst wählen.
  sim.state.lock = 0;
  assert.deepEqual(sim.startWave(), { ok: false, reason: 'boon' });
  assert.deepEqual(sim.chooseBoon('gibtsnicht'), { ok: false, reason: 'boon' });
  const notOffered = BOONS.find((boon) => !offer.includes(boon.id));
  assert.deepEqual(sim.chooseBoon(/** @type {BoonDef} */ (notOffered).id), { ok: false, reason: 'boon' });
  assert.deepEqual(sim.chooseBoon(offer[1]), { ok: true });
  assert.deepEqual(sim.state.boons, [offer[1]]);
  assert.deepEqual(sim.state.boonOffer, []);
  assert.deepEqual(ofType(sim.drainEvents(), 'boon').map((e) => e.id), [offer[1]]);
  assert.deepEqual(sim.chooseBoon(offer[0]), { ok: false, reason: 'phase' });
  assert.ok(sim.startWave().ok);
  // Das nächste Angebot nennt keine schon gewählte Gabe.
  sim.step();
  toAgeChange(sim);
  assert.ok(!sim.state.boonOffer.includes(offer[1]));
});

test('Ohne boonChoice wählt die Simulation sofort die erste angebotene Gabe; kein Angebot bleibt offen', () => {
  const sim = boonSim(boonContent(), { boonChoice: false });
  const twin = boonSim(boonContent());
  toAgeChange(sim);
  toAgeChange(twin);
  assert.deepEqual(sim.state.boonOffer, []);
  assert.deepEqual(sim.state.boons, [twin.state.boonOffer[0]]);
  const events = sim.drainEvents();
  assert.equal(ofType(events, 'boonOffer').length, 0);
  assert.equal(ofType(events, 'boon').length, 1);
  const types = events.map((e) => e.type);
  assert.ok(types.indexOf('age') < types.indexOf('boon'));
  sim.state.lock = 0;
  assert.ok(sim.startWave().ok);
});

test('Kleiner Vorrat: Das Angebot nimmt, was übrig ist; requires schließt Gaben aus', () => {
  const content = boonContent((c) => {
    c.boons = [
      { id: 'a', name: 'A', text: 'a', icon: 'x', effect: {} },
      { id: 'hoch', name: 'Hoch', text: 'h', icon: 'x', requires: { tiles: ['high'] }, effect: {} },
      { id: 'flug', name: 'Flug', text: 'f', icon: 'x', requires: { flying: true }, effect: {} },
    ];
    c.balance.tiles = { high: { name: 'Hügel', text: '', color: '#aaccee', icon: 'range', mod: {}, cost: 1 } };
  });
  const sim = boonSim(content);
  toAgeChange(sim);
  // Die Karte hat keinen Hügel, keine Welle bringt Flieger.
  assert.deepEqual(sim.state.boonOffer, ['a']);
  sim.chooseBoon('a');
  toAgeChange(sim);
  assert.deepEqual(sim.state.boonOffer, []);
  assert.equal(ofType(sim.drainEvents(), 'boonOffer').length, 1);
});

test('Kampfwerte: Gabe wirkt sofort auf stehende und künftige Türme; towerStats mit dem Turm als opts gibt dieselben Werte', () => {
  const content = boonContent((c) => {
    c.boons = [BOONS[0]];
  });
  const sim = boonSim(content);
  const shooter = mustBuild(sim, 'shooter', 2, 2);
  const thrower = mustBuild(sim, 'thrower', 3, 2);
  const before = shooter.stats.damage;
  const throwerBefore = thrower.stats.damage;
  toAgeChange(sim);
  assert.deepEqual(sim.state.boonOffer, ['wucht']);
  sim.chooseBoon('wucht');
  near(shooter.stats.damage, before * 2);
  near(thrower.stats.damage, throwerBefore);
  assert.deepEqual(rules.towerStats(content, shooter.arch, shooter.tier, shooter.level, shooter), shooter.stats);
  assert.equal(shooter.boons, sim.state.boons);
  const fresh = mustBuild(sim, 'shooter', 4, 2);
  near(fresh.stats.damage, rules.towerStats(content, fresh.arch, 1, 1).damage * 2);
});

test('Filter der Kampfwerte: Bauplatz, Zweig, Superwaffe, Rezept; Treffen von Fliegern; Grenzen für Rüstung und Verlangsamung', () => {
  const content = addTiles(addFusion(makeContent()));
  const shooter = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'shooter'));
  const thrower = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'thrower'));
  /** @type {import('../src/types/content').FusionRecipe} */
  const flak = { id: 'flak', name: 'Flak', gifts: ['shooter', 'shooter'], core: { mul: { damage: 1 } }, coreText: '' };
  /** @type {import('../src/types/content').FusionRecipe[]} */ (/** @type {any} */ (shooter.fusion).recipes = [flak]);
  content.boons = [
    { id: 'hoch', name: 'H', text: '', icon: 'x', effect: { towers: [{ tiles: ['high'], hitsAir: true, mod: { mul: { range: 2 } } }] } },
    { id: 'zweig', name: 'Z', text: '', icon: 'x', effect: { towers: [{ roles: ['shooter'], branch: 1, mod: { add: { damage: 1 } } }] } },
    { id: 'super', name: 'S', text: '', icon: 'x', effect: { towers: [{ super: true, mod: { mul: { damage: 3 } } }] } },
    { id: 'flak', name: 'F', text: '', icon: 'x', effect: { towers: [{ recipe: 'flak', mod: { mul: { splash: 2 } } }] } },
    { id: 'grenze', name: 'G', text: '', icon: 'x', effect: { towers: [{ mod: { add: { pierce: 5, slow: 5 } } }] } },
  ];
  const all = content.boons.map((b) => b.id);
  const plain = rules.towerStats(content, thrower, 0, 1, { tile: 'high' });
  const boosted = rules.towerStats(content, thrower, 0, 1, { tile: 'high', boons: ['hoch'] });
  assert.equal(plain.hitsAir, false);
  assert.equal(boosted.hitsAir, true);
  near(boosted.range, plain.range * 2);
  assert.equal(rules.towerStats(content, thrower, 0, 1, { tile: 'well', boons: ['hoch'] }).hitsAir, false);
  // Zweig 1 (Scharfschütze) bekommt +1 Standardschuss (10), Zweig 0 nicht.
  near(rules.towerStats(content, shooter, 0, 3, { branch: 1, boons: ['zweig'] }).damage, rules.towerStats(content, shooter, 0, 3, { branch: 1 }).damage + 10);
  near(rules.towerStats(content, shooter, 0, 3, { branch: 0, boons: ['zweig'] }).damage, rules.towerStats(content, shooter, 0, 3, { branch: 0 }).damage);
  // Superwaffe und Rezept.
  const fused = { branch: 0, super: true, gifts: ['thrower', 'burner'] };
  near(rules.towerStats(content, shooter, 0, 3, { ...fused, boons: ['super'] }).damage, rules.towerStats(content, shooter, 0, 3, fused).damage * 3);
  near(rules.towerStats(content, shooter, 0, 3, { branch: 0, boons: ['super'] }).damage, rules.towerStats(content, shooter, 0, 3, { branch: 0 }).damage);
  const flakOpts = { branch: 0, super: true, gifts: ['shooter', 'shooter'] };
  near(rules.towerStats(content, shooter, 0, 3, { ...flakOpts, boons: ['flak'] }).splash, rules.towerStats(content, shooter, 0, 3, flakOpts).splash * 2);
  near(rules.towerStats(content, shooter, 0, 3, { ...fused, boons: ['flak'] }).splash, rules.towerStats(content, shooter, 0, 3, fused).splash);
  const capped = rules.towerStats(content, shooter, 0, 1, { boons: all });
  assert.equal(capped.pierce, 1);
  assert.equal(capped.slow, rules.MAX_SLOW);
  // Ohne Gaben bleibt alles wie vorher (auch ohne opts).
  assert.deepEqual(rules.towerStats(content, shooter, 0, 1, { boons: [] }), rules.towerStats(content, shooter, 0, 1));
});

test('Wirtschaft: Bau, Ausbau, Modernisieren, Gebühr, Verkauf, Wellenprämie, Kopfgeld und Frühstart mit den Faktoren', () => {
  const content = boonContent((c) => {
    addFusion(c);
    c.waves[1] = [{ groups: [{ enemy: 'grunt', count: 1, interval: 0, delay: 0 }] }, { groups: [] }];
    c.balance.startGold = 100000;
  });
  const plain = boonSim(content);
  const sim = owning(content, ['handel']);
  const shooter = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'shooter'));
  assert.equal(sim.buildCost('shooter'), rules.boonPrice(rules.buildCost(content, shooter, 0), 0.5));
  assert.equal(sim.buildCost('shooter'), 25);
  const tower = mustBuild(sim, 'shooter', 2, 2);
  assert.equal(tower.invested, 25);
  assert.equal(sim.upgradeCost(tower), rules.round5(rules.upgradeCost(content, shooter, 0, 1) * 2));
  sim.upgrade(tower.id);
  sim.upgrade(tower.id, 0);
  const part1 = mustBuild(sim, 'shooter', 3, 2);
  const part2 = mustBuild(sim, 'shooter', 1, 2);
  for (const t of [part1, part2]) {
    sim.upgrade(t.id);
    sim.upgrade(t.id, 0);
  }
  assert.equal(sim.fuseCost(tower), 0);
  const gold = sim.state.gold;
  assert.ok(sim.fuse(tower.id, [part1.id, part2.id]).ok);
  assert.equal(sim.state.gold, gold);
  // Verkauf: 75 % x 2, höchstens alles.
  sim.state.lock = 0;
  sim.startWave();
  sim.step();
  assert.equal(sim.sellValue(tower), tower.invested);
  // Wellenprämie doppelt, Modernisieren zum halben Preis, Kopfgeld doppelt, Frühstart doppelt.
  toAgeChange(sim);
  toAgeChange(plain);
  const bonusPlain = ofType(plain.drainEvents(), 'waveClear')[0].bonus;
  assert.equal(ofType(sim.drainEvents(), 'waveClear')[0].bonus, bonusPlain * 2);
  assert.equal(sim.modernizeCost(tower), rules.boonPrice(rules.modernizeCost(content, shooter, 1, 3, tower), 0.5));
  for (const s of [sim, plain]) {
    if (s.state.boonOffer.length > 0) s.chooseBoon(s.state.boonOffer[0]);
    s.state.lock = 0;
  }
  // Frühstart: gleiche Bauzeit, doppelte Prämie.
  steps(sim, 60);
  steps(plain, 60);
  assert.equal(sim.earlyBonus(), Math.round(plain.earlyBonus() * 2) || sim.earlyBonus());
  sim.startWave();
  stepUntil(sim, () => sim.state.enemies.length > 0);
  const values = rules.enemyStats(content, content.enemies.grunt, 1, 0, 'normal');
  assert.equal(sim.state.enemies[0].bounty, values.bounty * 2);
});

test('Fähigkeit: Abklingzeit und Rückwurf mit den Faktoren, sim.ability() zeigt die geänderte Glocke', () => {
  const content = boonContent();
  const sim = owning(content, ['glocke']);
  const def = sim.ability();
  assert.equal(def.cooldown, content.abilities[0].cooldown * 0.5);
  assert.equal(def.rewind, content.abilities[0].rewind * 2);
  assert.equal(def.name, content.abilities[0].name);
  sim.useAbility(0, 0);
  assert.equal(sim.state.abilityCooldown, def.cooldown);
  assert.equal(boonSim(content).ability(), content.abilities[0]);
});

test('Einmalige Gaben: Leben (auch maxLives) und Gold; abziehende Gaben lassen mindestens ein Leben', () => {
  const content = boonContent((c) => {
    c.boons = [BOONS[3]];
  });
  const sim = boonSim(content);
  toAgeChange(sim);
  const lives = sim.state.lives;
  const gold = sim.state.gold;
  sim.drainEvents();
  sim.chooseBoon('leben');
  assert.equal(sim.state.lives, lives + 5);
  assert.equal(sim.state.maxLives, 25);
  const amount = Math.round(10 * content.balance.baseBounty * content.balance.ageBounty[1]);
  assert.equal(sim.state.gold, gold + amount);
  const golds = ofType(sim.drainEvents(), 'gold');
  assert.deepEqual(golds.map((e) => [e.reason, e.amount]), [['boon', amount]]);
  // maxLives folgt beim Laden aus den Gaben.
  const loaded = boonSim(content, {}, sim.save());
  assert.equal(loaded.state.maxLives, 25);

  const poor = boonSim(boonContent((c) => {
    c.boons = [BOONS[4]];
  }));
  toAgeChange(poor);
  poor.chooseBoon('opfer');
  assert.equal(poor.state.lives, 1);
  assert.equal(poor.state.maxLives, 20);
});

test('Regel: Brand springt beim Tod auf den nächsten Gegner über; Zunder wirkt stärker', () => {
  /** @param {string[]} boons */
  const make = (boons) => {
    const content = makeContent();
    content.boons = structuredClone(BOONS);
    setEnemy(content, 'still', STILL);
    content.waves = content.ages.map((_, i) => [{ groups: i === 0 ? [{ enemy: 'still', count: 3, interval: 0, delay: 0 }] : [] }]);
    return owning(content, boons);
  };
  for (const boons of [['brand'], []]) {
    const sim = make(boons);
    const [a, b, c] = begin(sim, [5, 6.5, 9]);
    sim.step();
    a.hp = 0.0001;
    a.dot = 10;
    a.dotTime = 0.5;
    sim.step();
    assert.equal(a.alive, false);
    if (boons.length > 0) {
      assert.equal(b.dot, 10);
      assert.equal(b.dotTime > 0.9, true);
      assert.equal(c.dot, 0);
    } else {
      assert.equal(b.dot, 0);
    }
  }
  // Zunder: 1,5 + 0,5 = doppelter Brand auf Verlangsamte.
  const sim = make(['brand']);
  const [a] = begin(sim, [5, 7, 9]);
  sim.step();
  a.dot = 6;
  a.dotTime = 10;
  a.slow = 0.5;
  a.slowTime = 10;
  const hp = a.hp;
  sim.step();
  near(hp - a.hp, 6 * 2 / 60, 1e-9);
});

test('Regel: Schaden gegen Bosse und Flieger mit Faktor; Megawaffen-Grenze steigt', () => {
  const content = makeContent();
  content.boons = structuredClone(BOONS);
  setEnemy(content, 'still', STILL);
  setEnemy(content, 'drone', { flying: true, hp: 10, speed: 1e-6, boss: false });
  content.waves = content.ages.map((_, i) => [{ groups: i === 0 ? [{ enemy: 'still', count: 1, interval: 0, delay: 0 }, { enemy: 'drone', count: 1, interval: 0, delay: 0 }] : [] }]);
  content.balance.startGold = 100000;
  for (const boons of [[], ['riese']]) {
    const sim = owning(content, boons);
    const [boss, drone] = begin(sim, [5, 5]);
    sim.step();
    const hp = [boss.hp, drone.hp];
    const tower = mustBuild(sim, 'shooter', 5, 2);
    tower.stats = { ...tower.stats, attack: 'hitscan', damage: 7, cooldown: 1000, range: 30 };
    tower.mode = 'strong';
    sim.step();
    near(hp[1] - drone.hp, 7 * (boons.length > 0 ? 3 : 1), 1e-9, 'Flieger');
    tower.mode = 'weak';
    tower.cooldown = 0;
    sim.step();
    near(hp[0] - boss.hp, 7 * (boons.length > 0 ? 2 : 1), 1e-9, 'Boss');
  }
  // Megawaffen: Grenze 0 in der Balance, eine mit der Gabe.
  for (const boons of [[], ['mega']]) {
    const sim = owning(boonContent((c) => {
      addFusion(c);
      /** @type {NonNullable<Content['balance']['fusion']>} */ (c.balance.fusion).megaLimit = 0;
      c.balance.startGold = 100000;
    }), boons);
    const ids = [[2, 1], [1, 1], [3, 1], [1, 0], [3, 0]].map(([tx, tz]) => {
      const tower = mustBuild(sim, 'thrower', tx, tz);
      sim.upgrade(tower.id);
      sim.upgrade(tower.id);
      return tower.id;
    });
    assert.ok(sim.fuse(ids[0], [ids[1], ids[2]]).ok);
    assert.deepEqual(sim.fuse(ids[0], [ids[3], ids[4]]), boons.length > 0 ? { ok: true } : { ok: false, reason: 'limit' });
  }
  // Im Spiel: eine Megawaffe, mit der Zeitgabe zwei.
  const megaBoon = gameContent.boons.find((b) => b.effect && b.effect.rules && b.effect.rules.megaLimit);
  assert.ok(megaBoon, 'eine Zeitgabe hebt die Höchstzahl der Megawaffen an');
  assert.equal(rules.megaLimit(gameContent, []), 1);
  assert.equal(rules.megaLimit(gameContent, [megaBoon.id]), 2);
  // Anzeige und Autopilot fragen dieselbe Höchstzahl ab wie die Sim (sonst sperrt die Anzeige, was die Sim erlaubt).
  const none = boonContent((c) => void (addFusion(c), (/** @type {NonNullable<Content['balance']['fusion']>} */ (c.balance.fusion).megaLimit = 0)));
  assert.deepEqual([rules.megaLimit(none, []), rules.megaLimit(none, ['mega']), rules.megaLimit(boonContent(), ['mega'])], [0, 1, 2]);
});

test('Speichern und Laden mit offenem Angebot: Angebot, Gaben und Verlauf bleiben gleich; fehlerhafte Angaben werden abgelehnt', () => {
  const content = boonContent((c) => {
    c.waves[1] = [{ groups: [{ enemy: 'grunt', count: 4, interval: 1, delay: 0 }] }, { groups: [] }];
  });
  const sim = boonSim(content);
  mustBuild(sim, 'shooter', 2, 2);
  toAgeChange(sim);
  const save = /** @type {SaveData} */ (sim.save());
  assert.deepEqual(save.boonOffer, sim.state.boonOffer);
  const loaded = boonSim(content, {}, JSON.parse(JSON.stringify(save)));
  assert.deepEqual(loaded.state.boonOffer, sim.state.boonOffer);
  assert.equal(digest(loaded), digest(sim));
  for (const s of [sim, loaded]) {
    s.chooseBoon(s.state.boonOffer[2]);
    s.state.lock = 0;
    s.startWave();
    steps(s, 600);
  }
  assert.equal(digest(loaded), digest(sim));
  assert.throws(() => boonSim(content, {}, { ...save, boons: ['gibtsnicht'] }), /unbekannte Zeitgabe/);
  assert.throws(() => boonSim(content, {}, { ...save, boons: ['wucht', 'wucht'] }), /doppelt/);
  assert.throws(() => boonSim(content, {}, { ...save, boons: [save.boonOffer?.[0] ?? ''], boonOffer: save.boonOffer }), /zugleich im Angebot/);
  // Ältere Spielstände ohne Zeitgaben laden ohne Gaben.
  const { boons, boonOffer, ...old } = save;
  assert.deepEqual(boonSim(content, {}, /** @type {SaveData} */ (old)).state.boons, []);
});

test('Prüfung der Inhalte: Zeitgaben mit unbekannten Rollen, set, doppelter Kennung oder falschen Feldern scheitern', () => {
  /** @param {(content: Content) => void} edit */
  const fails = (edit) => assert.throws(() => boonSim(boonContent(edit)));
  fails((c) => (/** @type {BoonDef[]} */ (c.boons)[0].effect = { towers: [{ roles: ['gibtsnicht'], mod: {} }] }));
  fails((c) => (/** @type {BoonDef[]} */ (c.boons)[0].effect = { towers: [{ mod: { set: { damage: 1 } } }] }));
  fails((c) => /** @type {BoonDef[]} */ (c.boons).push({ ...BOONS[0] }));
  fails((c) => (/** @type {any} */ (c.boons)[0].effect = { zauber: 1 }));
  fails((c) => (/** @type {any} */ (c.boons)[0].effect = { economy: { build: -1 } }));
  fails((c) => (/** @type {any} */ (c.boons)[0].name = ''));
  fails((c) => (c.balance.boons = { offer: 0 }));
  boonSim(boonContent((c) => (c.balance.boons = { offer: 2 })));
});

test('Spielinhalte: Zeitgaben gültig, deutsch, mit Symbol und Zahlen im Text', () => {
  // Baupläne (Rezepte freischalten) zählen nicht mit; sie prüft tests/recipes.test.mjs.
  const boons = (gameContent.boons ?? []).filter((boon) => boon.effect.recipe === undefined);
  assert.ok(boons.length >= 18 && boons.length <= 24, `${boons.length} Zeitgaben`);
  for (const boon of boons) {
    assert.ok(boon.text.length > 20, boon.id);
    assert.match(boon.text, /\d|zwei|doppelt|Hälfte/, `${boon.id}: Text ohne Zahl`);
  }
  for (const map of gameContent.maps) createSim({ content: gameContent, mapId: map.id, difficulty: 'normal', seed: 1 });
});
