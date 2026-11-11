// @ts-check
// Waffenpool (docs/briefs/fusion.md, 12; docs/SIM.md, „Waffenpool“): Plätze, Bewaffnung, Ziehung, Bauen, Speichern, Prüfung der
// Inhalte, Rezepte und Zeitgaben nach Platz und Waffe, und die beiden ersten Waffen des Pools (Frostturm, Giftschütze).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content as GAME, poolContent as POOL_GAME, POOL, SLOTS, ARCHETYPES } from '../src/content/index.js';
import { listModelIds } from '../src/content/models.js';
import {
  classicLoadout, contentSlots, drawLoadout, fusionRecipe, hitsFliers, isClassic, lockedRecipe, LOADOUT_AIR, recipeFits, recipeLook,
  recipeWeapons, resolveLoadout, slotOf, towerStats, weaponsOfSlot,
} from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { checkContent } from '../src/sim/validate.js';
import { addFusion, addPool, addRecipes, makeContent } from './fixtures/content.mjs';
import { makeSim } from './fixtures/harness.mjs';

/** @import { BoonDef, Content, TowerArchetypeDef } from '../src/types/content' */
/** @import { SaveData, Sim, SimEvent } from '../src/types/sim' */

/** Testinhalte mit Zweigen, Verschmelzung, Rezepten und kleinem Pool; viel Gold. */
function poolContent() {
  const content = addPool(addRecipes(addFusion(makeContent())));
  content.balance.startGold = 1e6;
  return content;
}

/** Plätze der Testinhalte in ihrer Reihenfolge (jede klassische Rolle ist ihr eigener Platz). */
const FIXTURE_CLASSIC = ['shooter', 'thrower', 'slower', 'burner', 'piercer', 'beamer', 'pulser', 'support', 'flak'];
/** Bewaffnung der Testinhalte mit beiden Waffen des Pools. */
const FIXTURE_POOL = ['sniper', 'thrower', 'frost', 'burner', 'piercer', 'beamer', 'pulser', 'support', 'flak'];

/** @param {Content} content */
const copy = (content) => /** @type {Content} */ (structuredClone(content));

/**
 * Baut und hebt einen Turm auf Stufe 3; scheitert der Bau, scheitert der Test.
 * @param {Sim} sim
 * @param {string} id
 * @param {number} tx
 * @param {number} tz
 */
function build3(sim, id, tx, tz) {
  const result = sim.build(id, tx, tz);
  assert.ok(result.ok, `${id} auf (${tx}, ${tz}): ${result.reason}`);
  const tower = /** @type {import('../src/types/sim').Tower} */ (sim.towerAt(tx, tz));
  assert.ok(sim.upgrade(tower.id).ok);
  assert.ok(sim.upgrade(tower.id).ok);
  return tower;
}

test('Ältere Inhalte ohne Plätze: jede Rolle ist ihr eigener Platz, die Bewaffnung sind alle Rollen, alles baut wie vorher', () => {
  const content = makeContent();
  assert.deepEqual(contentSlots(content).map((s) => s.id), FIXTURE_CLASSIC);
  assert.deepEqual(classicLoadout(content), FIXTURE_CLASSIC);
  for (const arch of content.archetypes) {
    assert.equal(slotOf(arch), arch.id);
    assert.ok(isClassic(arch));
  }
  const sim = makeSim();
  assert.deepEqual(sim.loadout, FIXTURE_CLASSIC);
  assert.ok(Object.isFrozen(sim.loadout));
  assert.ok(sim.build('shooter', 0, 0).ok);
  assert.ok(sim.build('flak', 1, 0).ok);
  // Spielstände tragen die Bewaffnung; ältere ohne sie laden klassisch.
  const save = /** @type {SaveData} */ (sim.save());
  assert.deepEqual(save.loadout, FIXTURE_CLASSIC);
  const { loadout: _, ...old } = save;
  assert.deepEqual(makeSim({}, /** @type {SaveData} */ (old)).loadout, FIXTURE_CLASSIC);
  // Die Ziehung kennt bei einer Waffe je Platz nur eine Möglichkeit.
  assert.deepEqual(drawLoadout(content, 99), FIXTURE_CLASSIC);
});

test('Bewaffnung in der Konfiguration: klassisch, gezogen, als Liste in beliebiger Reihenfolge; Fehler auf Deutsch', () => {
  const content = poolContent();
  checkContent(content, 'straight', 'normal');
  assert.deepEqual(makeSim({ content }).loadout, FIXTURE_CLASSIC);
  assert.deepEqual(makeSim({ content, loadout: 'classic' }).loadout, FIXTURE_CLASSIC);
  assert.deepEqual(makeSim({ content, loadout: [...FIXTURE_POOL].reverse() }).loadout, FIXTURE_POOL);
  assert.deepEqual(makeSim({ content, loadout: 'random', seed: 5 }).loadout, drawLoadout(content, 5));
  assert.deepEqual(resolveLoadout(content, undefined, 1), FIXTURE_CLASSIC);
  const bad = (/** @type {any} */ loadout, /** @type {RegExp} */ message) => assert.throws(() => makeSim({ content, loadout }), message);
  bad(FIXTURE_POOL.slice(1), /Für den Platz "shooter" fehlt eine Waffe/);
  bad([...FIXTURE_POOL, 'shooter'], /Für den Platz "shooter" stehen zwei Waffen \("sniper" und "shooter"\)/);
  bad([...FIXTURE_POOL.slice(1), 'gibtsnicht'], /Die Waffe "gibtsnicht" gibt es nicht/);
  bad('alles', /Unbekannte Bewaffnung "alles"/);
});

test('Ziehung: deterministisch, je Platz eine Waffe, mindestens zwei gegen Flieger, Plätze ohne Wahl bleiben klassisch', () => {
  const content = poolContent();
  // Nur der Platz shooter hat mit sniper eine Waffe ohne Flieger; die Ziehung darf ihn dennoch nehmen.
  /** @type {Set<string>} */
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const ids = drawLoadout(content, seed);
    assert.deepEqual(ids, drawLoadout(content, seed));
    assert.equal(ids.length, FIXTURE_CLASSIC.length);
    ids.forEach((id, i) => assert.equal(slotOf(/** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === id))), FIXTURE_CLASSIC[i]));
    for (const id of ids) seen.add(id);
  }
  for (const id of ['shooter', 'sniper', 'slower', 'frost']) assert.ok(seen.has(id), `${id} wird nie gezogen`);
  // Flieger-Garantie: Hier treffen nur zwei Plätze überhaupt Flieger, einer davon nur mit seiner Pool-Waffe.
  const thin = poolContent();
  for (const arch of thin.archetypes) if (!['shooter', 'frost'].includes(arch.id)) arch.stats.hitsAir = false;
  checkContent(thin, 'straight', 'normal');
  let frostDrawn = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const ids = drawLoadout(thin, seed);
    const air = ids.filter((id) => hitsFliers(/** @type {TowerArchetypeDef} */ (thin.archetypes.find((a) => a.id === id))));
    assert.equal(air.length, LOADOUT_AIR, `Startwert ${seed}: ${ids.join(', ')}`);
    if (ids.includes('frost')) frostDrawn += 1;
  }
  assert.equal(frostDrawn, 40);
  // Gibt es weniger Flieger-Waffen, als die Garantie verlangt, nimmt die Ziehung, was es gibt, ohne zu hängen.
  for (const arch of thin.archetypes) if (arch.id === 'frost') arch.stats.hitsAir = false;
  assert.equal(drawLoadout(thin, 3).filter((id) => id === 'shooter').length, 1);
});

test('Bauen nur aus der Bewaffnung (sonst locked); Spielstand trägt die Bewaffnung, Laden prüft Türme und Gaben', () => {
  const content = poolContent();
  const sim = makeSim({ content, loadout: FIXTURE_POOL });
  assert.deepEqual(sim.build('shooter', 0, 0), { ok: false, reason: 'locked' });
  assert.deepEqual(sim.build('slower', 0, 0), { ok: false, reason: 'locked' });
  assert.ok(sim.build('sniper', 0, 0).ok);
  assert.ok(sim.build('frost', 1, 0).ok);
  assert.deepEqual(sim.build('gibtsnicht', 2, 0), { ok: false, reason: 'unknown' });
  // Klassisch ist es umgekehrt.
  const classic = makeSim({ content });
  assert.deepEqual(classic.build('frost', 0, 0), { ok: false, reason: 'locked' });
  assert.ok(classic.build('slower', 0, 0).ok);
  // Speichern und Laden: Die Bewaffnung des Spielstands gilt, auch wenn die Konfiguration etwas anderes sagt.
  const save = /** @type {SaveData} */ (sim.save());
  assert.deepEqual(save.loadout, FIXTURE_POOL);
  const loaded = makeSim({ content, loadout: 'classic' }, JSON.parse(JSON.stringify(save)));
  assert.deepEqual(loaded.loadout, FIXTURE_POOL);
  assert.equal(JSON.stringify(loaded.save()), JSON.stringify(save));
  assert.deepEqual(loaded.build('shooter', 3, 0), { ok: false, reason: 'locked' });
  // Ein Turm außerhalb der Bewaffnung, eine kaputte Bewaffnung: abgelehnt.
  assert.throws(() => makeSim({ content }, { ...save, loadout: FIXTURE_CLASSIC }), /Waffe gehört nicht zur Bewaffnung des Spielstands/);
  assert.throws(() => makeSim({ content }, { ...save, loadout: ['sniper'] }), /Spielstand unlesbar: Bewaffnung unlesbar: Für den Platz "thrower" fehlt eine Waffe/);
  const { loadout: _, ...old } = save;
  assert.throws(() => makeSim({ content }, /** @type {SaveData} */ (old)), /\("sniper"\): Die Waffe gehört nicht zur Bewaffnung/);
});

test('Prüfung der Inhalte: Plätze und Waffen des Pools, Meldungen auf Deutsch', () => {
  /**
   * @param {(content: Content) => void} edit
   * @param {RegExp} message
   */
  const rejects = (edit, message) => {
    const content = poolContent();
    edit(content);
    assert.throws(() => checkContent(content, 'straight', 'normal'), message);
  };
  /** @param {Content} c @param {string} id */
  const weapon = (c, id) => /** @type {TowerArchetypeDef} */ (c.archetypes.find((a) => a.id === id));
  rejects((c) => void delete weapon(c, 'frost').look, /Turmrolle "frost": look fehlt/);
  rejects((c) => void (/** @type {any} */ (weapon(c, 'frost').look).marker = 'krone'), /unbekanntes Erkennungszeichen "krone"/);
  rejects((c) => void (weapon(c, 'frost').slot = 'nirgends'), /Platz "nirgends" hat keine klassische Waffe/);
  rejects((c) => void (weapon(c, 'frost').unlockWave = 0), /unlockWave muss die des Platzes sein \(2 wie "slower"\)/);
  rejects((c) => void (weapon(c, 'frost').tiers[1] = null), /Turmrolle "frost", Zeitalter 1 \("rome"\): Ausprägung fehlt/);
  rejects((c) => void (/** @type {any} */ (weapon(c, 'frost').tiers[0]).model = 'tower.eigen'), /model muss vorerst das Modell des Platzes sein \("tower.mud"\)/);
  rejects((c) => void delete (/** @type {any} */ (weapon(c, 'frost').tiers[2])).superName, /superName fehlt \(die Waffe kann verschmelzen\)/);
  rejects((c) => void Object.assign(weapon(c, 'frost'), { slot: 'beamer', unlockWave: weapon(c, 'beamer').unlockWave }), /Die Waffe hat eine Ausprägung, die klassische Waffe "beamer" ihres Platzes nicht/);
  // Mit content.slots: Farbe, Name und Symbol des Platzes, bekannte Plätze, Aufgabe des Platzes.
  /** @param {Content} c */
  const withSlots = (c) => {
    c.slots = contentSlots(c).map((slot) => ({ ...slot, summary: `Aufgabe ${slot.id}` }));
    return c;
  };
  checkContent(withSlots(poolContent()), 'straight', 'normal');
  rejects((c) => void (withSlots(c), weapon(c, 'frost').color = '#123456'), /color muss die Farbe des Platzes "slower" sein/);
  rejects((c) => void (withSlots(c), weapon(c, 'frost').role = 'Eis'), /role muss der Name des Platzes "slower" sein/);
  rejects((c) => void (withSlots(c), (c.slots ?? []).pop()), /gehört zum unbekannten Platz "flak"/);
  rejects((c) => void (withSlots(c), ((c.slots ?? [])[2].job = 'slow'), (weapon(c, 'frost').stats.slow = 0)), /Turmrolle "frost" erfüllt die Aufgabe "slow" des Platzes "slower" nicht/);
  rejects((c) => void (withSlots(c), (/** @type {any} */ ((c.slots ?? [])[2]).job = 'eis')), /unbekannte Aufgabe "eis"/);
  // Zeitgaben: `roles` nennt Plätze, `weapons` Waffen.
  /** @type {(effect: BoonDef['effect']) => (c: Content) => void} */
  const boon = (effect) => (c) => void (c.boons = [{ id: 'g', name: 'G', text: 'g', icon: 'g', effect }]);
  checkContent(Object.assign(poolContent(), { boons: [{ id: 'g', name: 'G', text: 'g', icon: 'g', effect: { towers: [{ roles: ['slower'], weapons: ['frost'], mod: { mul: { range: 2 } } }] } }] }), 'straight', 'normal');
  rejects(boon({ towers: [{ roles: ['frost'], mod: {} }] }), /roles nennt eine unbekannte Rolle \(erlaubt sind Plätze/);
  rejects(boon({ towers: [{ weapons: ['eis'], mod: {} }] }), /weapons nennt eine unbekannte Waffe/);
  rejects((c) => void (c.boons = [{ id: 'g', name: 'G', text: 'g', icon: 'g', requires: { weapons: ['frost', 'eis'] }, effect: {} }]), /requires.weapons nennt eine unbekannte Waffe/);
  // Eine Zeitgabe nur für Waffen, die diese Inhalte nicht haben (klassische Inhalte, Bauplan eines waffengebundenen Rezepts), gilt
  // als nie angeboten: Ihre Verweise werden nicht geprüft.
  checkContent(Object.assign(poolContent(), { boons: [{ id: 'g', name: 'G', text: 'g', icon: 'g', requires: { weapons: ['eis'] }, effect: { recipe: 'gibtsnicht' } }] }), 'straight', 'normal');
});

test('Rezepte nach Platz: gewöhnliche Rezepte gelten für jede Waffe des Platzes, waffengebundene nur mit ihren Waffen', () => {
  const content = poolContent();
  /** @param {string} id */
  const weapon = (id) => /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === id));
  const [sniper, burner, shooter] = [weapon('sniper'), weapon('burner'), weapon('shooter')];
  // Salve (shooter + shooter + shooter) steht beim klassischen Schützen und gilt für jeden Kern des Platzes.
  assert.equal(fusionRecipe(sniper, ['sniper', 'shooter'], [], content)?.id, 'salve');
  assert.equal(fusionRecipe(shooter, ['sniper', 'sniper'], [], content)?.id, 'salve');
  // Ohne Inhalte nur die eigenen Rezepte und gleiche Kennungen (ältere Aufrufer, klassische Bewaffnung).
  assert.equal(fusionRecipe(shooter, ['shooter', 'shooter']), fusionRecipe(shooter, ['shooter', 'shooter'], undefined, content));
  assert.equal(fusionRecipe(shooter, ['sniper', 'sniper']), null);
  // Blitz steht beim Sniper: nur er als Kern; Plätze als Zutaten.
  assert.equal(fusionRecipe(sniper, ['frost', 'shooter'], [], content)?.id, 'blitz');
  assert.equal(fusionRecipe(shooter, ['frost', 'shooter'], [], content), null);
  // Teer (burner + slower + slower) trifft auch Frost; Eisfeuer (burner + frost + frost) ist spezifischer und geht vor.
  assert.equal(fusionRecipe(burner, ['frost', 'slower'], ['teer'], content)?.id, 'teer');
  assert.equal(fusionRecipe(burner, ['frost', 'frost'], ['teer', 'eisfeuer'], content)?.id, 'eisfeuer');
  assert.equal(fusionRecipe(burner, ['frost', 'frost'], ['teer'], content)?.id, 'teer');
  assert.equal(lockedRecipe(burner, ['frost', 'frost'], [], content)?.id, 'eisfeuer');
  assert.equal(lockedRecipe(burner, ['slower', 'slower'], [], content)?.id, 'teer');
  // Aussehen: zuerst beim Kern, dann bei der Waffe, bei der das Rezept steht.
  assert.equal(recipeLook(sniper, 1, ['sniper', 'sniper'], [], content)?.superName, 'salve1');
  assert.equal(recipeLook(sniper, 2, ['shooter', 'frost'], [], content)?.superName, 'blitz2');
  // Was eine Partie braucht, um ein Rezept zu bauen.
  assert.deepEqual(recipeWeapons(content, 'salve'), []);
  assert.deepEqual(recipeWeapons(content, 'blitz'), ['sniper']);
  assert.deepEqual(recipeWeapons(content, 'eisfeuer'), ['frost']);
  assert.ok(recipeFits(content, 'teer', FIXTURE_CLASSIC));
  assert.ok(!recipeFits(content, 'eisfeuer', FIXTURE_CLASSIC));
  assert.ok(recipeFits(content, 'eisfeuer', FIXTURE_POOL));
  assert.ok(!recipeFits(content, 'gibtsnicht', FIXTURE_POOL));
  // In der Simulation: Superwaffen aus Pool-Waffen bekommen die Rezepte ihres Platzes, die Werte folgen dem Rezept.
  const sim = makeSim({ content, loadout: FIXTURE_POOL });
  const core = build3(sim, 'sniper', 1, 1);
  const a = build3(sim, 'sniper', 2, 1);
  const b = build3(sim, 'sniper', 0, 1);
  assert.deepEqual(sim.fuseRecipe(core.id, [a.id, b.id]).recipe?.id, 'salve');
  assert.ok(sim.fuse(core.id, [a.id, b.id]).ok);
  assert.equal(core.recipe, 'salve');
  assert.equal(core.stats.attack, 'hitscan');
  assert.equal(core.stats.splash, 1);
  const core2 = build3(sim, 'sniper', 8, 1);
  const c = build3(sim, 'sniper', 9, 1);
  const d = build3(sim, 'frost', 7, 1);
  assert.ok(sim.fuse(core2.id, [c.id, d.id]).ok);
  assert.equal(core2.recipe, 'blitz');
  assert.equal(core2.stats.chain, 2);
  // Spielstand mit Rezept-Superwaffen aus dem Pool lädt gleich.
  const save = /** @type {SaveData} */ (sim.save());
  assert.equal(JSON.stringify(makeSim({ content }, JSON.parse(JSON.stringify(save))).save()), JSON.stringify(save));
});

test('Zeitgaben: roles nach Platz, weapons nach Waffe; Baupläne und requires.weapons nur, wenn die Bewaffnung passt', () => {
  const content = poolContent();
  /** @param {string} id */
  const weapon = (id) => /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === id));
  /** @type {BoonDef[]} */
  const boons = [
    { id: 'kalt', name: 'Kalt', text: 'x', icon: 'x', effect: { towers: [{ roles: ['slower'], mod: { mul: { range: 2 } } }] } },
    { id: 'eis', name: 'Eis', text: 'x', icon: 'x', effect: { towers: [{ weapons: ['frost'], mod: { mul: { cooldown: 0.5 } } }] } },
    { id: 'plan_eis', name: 'Plan Eis', text: 'x', icon: 'x', effect: { recipe: 'eisfeuer' } },
    { id: 'nur_frost', name: 'Nur Frost', text: 'x', icon: 'x', requires: { weapons: ['frost'] }, effect: { grant: { gold: 1 } } },
    { id: 'plan_teer', name: 'Plan Teer', text: 'x', icon: 'x', weight: 0.001, effect: { recipe: 'teer' } },
  ];
  content.boons = boons;
  content.balance.boons = { offer: 5 };
  const frost = weapon('frost');
  const slower = weapon('slower');
  const base = towerStats(content, frost, 0, 1, { boons: [] });
  assert.equal(towerStats(content, frost, 0, 1, { boons: ['kalt'] }).range, base.range * 2);
  assert.equal(towerStats(content, frost, 0, 1, { boons: ['eis'] }).cooldown, base.cooldown * 0.5);
  assert.equal(towerStats(content, slower, 0, 1, { boons: ['eis'] }).cooldown, towerStats(content, slower, 0, 1).cooldown);
  // Angebot beim Zeitalterwechsel: leere Wellen, damit es schnell geht.
  content.waves = content.ages.map(() => [{ groups: /** @type {import('../src/types/content').SpawnGroup[]} */ ([]) }]);
  /** @param {readonly string[] | 'classic'} loadout */
  const offer = (loadout) => {
    const sim = makeSim({ content, loadout, boonChoice: true });
    assert.ok(sim.startWave().ok);
    for (let i = 0; i < 600 && sim.state.boonOffer.length === 0; i++) sim.step();
    return sim.state.boonOffer.slice().sort();
  };
  assert.deepEqual(offer('classic'), ['eis', 'kalt', 'plan_teer']);
  // Mit Frost: die Gabe für Frost und Eisfeuer dazu; höchstens ein Bauplan je Angebot (Teer ist fast nie zuerst gezogen).
  assert.deepEqual(offer(FIXTURE_POOL), ['eis', 'kalt', 'nur_frost', 'plan_eis']);
});

test('Zwischenboss: waffengebundene Rezepte kommen nur in den Pool, wenn die Bewaffnung sie bauen kann', () => {
  const content = poolContent();
  content.enemies.mini = { ...content.enemies.boss, id: 'mini', hp: 0.5, speed: 3, lives: 5, phases: [] };
  content.waves = content.ages.map(() => [{ groups: /** @type {import('../src/types/content').SpawnGroup[]} */ ([]) }, { groups: [{ enemy: 'mini', count: 1, interval: 0, delay: 0 }] }, { groups: [{ enemy: 'mini', count: 1, interval: 0, delay: 0 }] }]);
  content.archetypes.push({ ...content.archetypes[0], id: 'zap', fusion: undefined, branches: undefined, stats: { ...content.archetypes[0].stats, attack: 'hitscan', damage: 1e6, cooldown: 0.1, range: 30 } });
  /** @param {readonly string[] | 'classic'} loadout @param {number} seed */
  const play = (loadout, seed) => {
    const sim = makeSim({ content, loadout, seed });
    assert.ok(sim.build('zap', 6, 0).ok);
    for (let guard = 0; guard < 60 * 600 && sim.state.phase !== 'won' && sim.state.phase !== 'lost'; guard++) {
      if (sim.state.phase === 'build') {
        sim.state.lock = 0;
        sim.startWave();
      }
      sim.step();
    }
    assert.equal(sim.state.phase, 'won');
    return sim.state.recipes.slice();
  };
  /** @type {Set<string>} */
  const pooled = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const classic = play('classic', seed);
    assert.equal(classic.length, 3);
    assert.ok(!classic.includes('eisfeuer'), `Startwert ${seed}: ${classic.join(', ')}`);
    for (const id of play([...FIXTURE_POOL, 'zap'], seed)) pooled.add(id);
  }
  assert.ok(pooled.has('eisfeuer'), 'mit Frost in der Bewaffnung kann der Zwischenboss Eisfeuer bringen');
});

test('Echte Inhalte: sechs Plätze, klassische Inhalte und Pool mit klassischer Bewaffnung verlaufen gleich', () => {
  assert.deepEqual(SLOTS.map((s) => s.id), ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber']);
  assert.deepEqual(GAME.archetypes.map((a) => a.id), SLOTS.map((s) => s.id));
  assert.deepEqual(classicLoadout(POOL_GAME), SLOTS.map((s) => s.id));
  checkContent(POOL_GAME, POOL_GAME.maps[0].id, 'normal');
  for (const slot of SLOTS) assert.ok(weaponsOfSlot(POOL_GAME, slot.id)[0].id === slot.id, `klassische Waffe von ${slot.id} vorn`);
  // Ziehung über viele Startwerte: je Platz eine Waffe, mindestens zwei gegen Flieger, beide Pilotwaffen kommen vor.
  /** @type {Set<string>} */
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const ids = drawLoadout(POOL_GAME, seed);
    assert.equal(ids.length, 6);
    const air = ids.filter((id) => hitsFliers(/** @type {TowerArchetypeDef} */ (POOL_GAME.archetypes.find((a) => a.id === id))));
    assert.ok(air.length >= 2, `Startwert ${seed}`);
    for (const id of ids) seen.add(id);
  }
  for (const arch of POOL_GAME.archetypes) assert.ok(seen.has(arch.id), `${arch.id} wird nie gezogen`);
  // Gleiche Befehle, gleicher Verlauf: klassische Inhalte gegen Pool-Inhalte mit klassischer Bewaffnung.
  /** @param {Content} content */
  const play = (content) => {
    const sim = createSim({ content: { ...content, balance: { ...content.balance, startGold: 5000 } }, mapId: 'flusstal', difficulty: 'normal', seed: 7, unlockAll: true });
    let built = 0;
    for (let tz = 0; tz < sim.map.height && built < 6; tz++) {
      for (let tx = 0; tx < sim.map.width && built < 6; tx++) {
        if (sim.canBuild(tx, tz).ok && sim.build(sim.loadout[built % 6], tx, tz).ok) built += 1;
      }
    }
    for (let wave = 0; wave < 3; wave++) {
      sim.state.lock = 0;
      assert.ok(sim.startWave().ok);
      for (let i = 0; i < 60 * 300 && sim.state.phase === 'wave'; i++) sim.step();
    }
    return JSON.stringify(sim.save());
  };
  assert.equal(play(POOL_GAME), play(GAME));
});

test('Pilotwaffen Frostturm und Giftschütze: vollständig, ehrlich, Modelle und Geschosse gibt es', () => {
  const models = new Set(listModelIds());
  const kinds = ['model', 'tracer', 'beam', 'bolt', 'flame', 'pulse', 'none'];
  assert.deepEqual(POOL.slice(0, 2).map((a) => a.id), ['frostturm', 'giftschuetze']);
  for (const arch of POOL) {
    const classic = /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === arch.slot));
    assert.ok(classic, `${arch.id}: Platz ${arch.slot}`);
    assert.ok(arch.name && arch.look && arch.look.marker !== 'none', arch.id);
    assert.equal(arch.tiers.length, 6);
    assert.ok(arch.branches && arch.branches.every((b) => b.gift && b.gift.name && b.gift.text), `${arch.id}: Zweige mit Gaben`);
    assert.ok(arch.fusion && arch.fusion.coreText, `${arch.id}: Kern`);
    const names = new Set();
    arch.tiers.forEach((def, age) => {
      assert.ok(def, `${arch.id}: Zeitalter ${age}`);
      assert.equal(def.model, classic.tiers[age]?.model);
      assert.ok(models.has(def.model), `${arch.id}: Modell ${def.model}`);
      for (const shot of [def.shot, def.superShot]) {
        assert.ok(shot && kinds.includes(shot.kind), `${arch.id}: Angriffsbild in Zeitalter ${age}`);
        if (shot.kind === 'model') assert.ok(shot.model && models.has(shot.model), `${arch.id}: Geschoss ${shot.model}`);
      }
      for (const name of [def.name, def.superName, def.megaName]) {
        assert.ok(name && !names.has(name), `${arch.id}: Name ${name} fehlt oder doppelt`);
        names.add(name);
      }
    });
  }
  // Der Frostturm bremst auch Flieger und hat einen anderen Kern als der Bremser; der Giftschütze vergiftet Flieger.
  const [frost, gift] = POOL;
  const bremser = /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === 'bremser'));
  const f = towerStats(POOL_GAME, frost, 2, 1);
  assert.ok(f.slow > 0 && f.hitsAir && f.attack === 'pulse');
  assert.notEqual(towerStats(POOL_GAME, frost, 2, 3, { branch: 0, super: true, gifts: ['bremser', 'werfer'], giftBranches: [0, 0] }).attack,
    towerStats(POOL_GAME, bremser, 2, 3, { branch: 0, super: true, gifts: ['bremser', 'werfer'], giftBranches: [0, 0] }).attack);
  const g = towerStats(POOL_GAME, gift, 2, 1);
  assert.ok(g.dot > 0 && g.dotDuration > 0 && g.hitsAir);
  // Die Flak gilt auch mit dem Giftschützen als Kern oder Zutat (gewöhnliches Rezept des Platzes).
  assert.equal(fusionRecipe(gift, ['giftschuetze', 'giftschuetze'], [], POOL_GAME)?.id, 'flak');
});
