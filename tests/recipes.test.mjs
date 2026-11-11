// @ts-check
// Rezepte der Superwaffen (docs/briefs/fusion.md, 8; docs/SIM.md, „Rezepte“): Die Flak aus drei Schützen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AGES, ARCHETYPES, content as GAME, fullContent as FULL } from '../src/content/index.js';
import { fusionRecipe, lockedRecipe, recipeById, recipeLook, towerStats } from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { checkContent } from '../src/sim/validate.js';
import { addFusion, addRecipes, makeContent } from './fixtures/content.mjs';
import { mustBuild } from './fixtures/harness.mjs';

/** @import { Content, FusionRecipe, TowerArchetypeDef } from '../src/types/content' */

const SCHUETZE = /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === 'schuetze'));

/**
 * Tiefe Kopie der Inhalte (nur Daten), damit ein Test sie verändern darf.
 * @param {Content} content
 * @returns {Content}
 */
function copy(content) {
  return structuredClone(content);
}

/**
 * Die Flak-Werte (Superwaffe) eines Schützen-Kerns.
 * @param {number} tier
 * @param {number} branch Zweig des Kerns
 * @param {number[]} giftBranches Zweige der beiden Schützen-Zutaten
 * @param {boolean} [mega]
 */
function flak(tier, branch, giftBranches, mega) {
  const gifts = mega ? ['schuetze', 'schuetze', 'werfer', 'knacker'] : ['schuetze', 'schuetze'];
  return towerStats(FULL, SCHUETZE, tier, 3, { branch, super: true, mega, gifts, giftBranches: mega ? [...giftBranches, 0, 0] : giftBranches });
}

test('fusionRecipe: Multimenge der ersten Zutaten, Reihenfolge und weitere Zutaten egal', () => {
  const recipe = fusionRecipe(SCHUETZE, ['schuetze', 'schuetze']);
  assert.ok(recipe);
  assert.equal(recipe?.id, 'flak');
  assert.equal(recipe?.name, 'Flak');
  assert.equal(fusionRecipe(SCHUETZE, ['schuetze', 'schuetze', 'werfer', 'knacker']), recipe, 'Megawaffe behält das Rezept');
  assert.equal(fusionRecipe(SCHUETZE, ['schuetze', 'werfer']), null);
  assert.equal(fusionRecipe(SCHUETZE, ['werfer', 'schuetze', 'schuetze', 'schuetze']), null, 'nur die ersten beiden zählen');
  assert.equal(fusionRecipe(SCHUETZE, ['schuetze']), null);
  assert.equal(fusionRecipe(SCHUETZE, []), null);
  assert.equal(fusionRecipe(SCHUETZE, undefined), null);
  for (const arch of ARCHETYPES) if (arch.id !== 'schuetze') assert.equal(fusionRecipe(arch, ['schuetze', 'schuetze']), null, arch.id);
  // Eine Multimenge aus zwei verschiedenen Rollen: Reihenfolge egal, Anzahl zählt.
  /** @type {FusionRecipe} */
  const mixed = { id: 'x', name: 'X', gifts: ['werfer', 'knacker'], core: {}, coreText: 'x' };
  const arch = /** @type {TowerArchetypeDef} */ ({ ...SCHUETZE, fusion: { ...SCHUETZE.fusion, recipes: [mixed] } });
  assert.equal(fusionRecipe(arch, ['knacker', 'werfer']), mixed);
  assert.equal(fusionRecipe(arch, ['werfer', 'werfer']), null);
  assert.equal(fusionRecipe(arch, ['knacker', 'knacker']), null);
});

test('Flak: Werte in jedem Zeitalter, Gaben wirken weiter, Megawaffe bleibt Flak', () => {
  for (let tier = 0; tier < AGES.length; tier++) {
    for (const branch of [0, 1]) {
      const s = flak(tier, branch, [0, 0]);
      const where = `Flak ${AGES[tier].id}, Kernzweig ${branch}`;
      assert.equal(s.attack, 'hitscan', `${where}: Angriffsart (auch gegen den tweak des Zeitalters)`);
      assert.ok(s.splash > 0.5 && s.splash < 1.2, `${where}: kleiner Radius ${s.splash}`);
      assert.equal(s.hitsAir, true, where);
      assert.equal(s.hitsGround, true, where);
      assert.equal(s.ramp, 0, where);
      // Gaben: Schnellfeuer (Doppelschuss) macht schneller, Zielfernrohr (Scharfschütze) weiter.
      const fast = flak(tier, branch, [0, 0]);
      const far = flak(tier, branch, [1, 1]);
      assert.ok(fast.cooldown < far.cooldown - 1e-9, `${where}: Schnellfeuer wirkt`);
      assert.ok(far.range > fast.range + 1e-9, `${where}: Zielfernrohr wirkt`);
      // Megawaffe: gleiche Art, stärker.
      const mega = flak(tier, branch, [0, 0], true);
      assert.equal(mega.attack, 'hitscan', `${where}: Megawaffe`);
      assert.ok(mega.damage > s.damage && mega.splash >= s.splash, `${where}: Megawaffe stärker`);
    }
  }
  // Andere Zutaten ergeben weiter den Strahl.
  assert.equal(towerStats(FULL, SCHUETZE, 0, 3, { branch: 0, super: true, gifts: ['schuetze', 'werfer'], giftBranches: [0, 0] }).attack, 'beam');
  assert.equal(towerStats(FULL, SCHUETZE, 0, 3, { branch: 0, super: true, mega: true, gifts: ['werfer', 'schuetze', 'schuetze', 'schuetze'] }).attack, 'beam');
});

test('Flak: gegen ein einzelnes Ziel klar schwächer als der aufgeheizte Strahl, mit Fläche stärker', () => {
  for (let tier = 0; tier < AGES.length; tier++) {
    const f = flak(tier, 0, [0, 0]);
    const beam = towerStats(FULL, SCHUETZE, tier, 3, { branch: 0, super: true, gifts: ['werfer', 'knacker'], giftBranches: [0, 0] });
    const flakDps = f.damage / f.cooldown;
    const beamHot = beam.damage * (1 + beam.ramp);
    assert.ok(flakDps < 0.75 * beamHot, `${AGES[tier].id}: Flak ${flakDps} je Sekunde gegen aufgeheizten Strahl ${beamHot}`);
    // Drei Drohnen im Radius (Abstand bis zum halben Radius): mindestens das Doppelte des kalten Strahls.
    assert.ok(flakDps * (1 + 2 * 0.75) > 2 * beam.damage, `${AGES[tier].id}: Flak gegen einen Schwarm`);
  }
});

test('Flak: Namen und Salve in jedem Zeitalter, eindeutig', () => {
  /** @type {string[]} */
  const names = [];
  for (const arch of ARCHETYPES) {
    for (const def of arch.tiers) {
      if (!def) continue;
      names.push(def.name, String(def.superName), String(def.megaName));
    }
  }
  SCHUETZE.tiers.forEach((def, age) => {
    assert.ok(def);
    if (!def) return;
    const look = def.recipes?.flak;
    assert.ok(look, `${AGES[age].id}: Flak ohne Namen`);
    if (!look) return;
    assert.ok(look.superName.length > 2 && look.superName.length <= 18, `${AGES[age].id}: superName "${look.superName}"`);
    assert.ok(look.megaName.length > 2 && look.megaName.length <= 20, `${AGES[age].id}: megaName "${look.megaName}"`);
    assert.notEqual(look.superName, look.megaName);
    assert.ok(look.superShot && look.superShot.kind !== 'beam' && look.superShot.kind !== 'none', `${AGES[age].id}: Salve`);
    assert.ok(look.superShot?.impact !== 'none');
    names.push(look.superName, look.megaName);
    assert.equal(recipeLook(SCHUETZE, age, ['schuetze', 'schuetze']), look);
    assert.equal(recipeLook(SCHUETZE, age, ['schuetze', 'werfer']), null);
  });
  assert.equal(new Set(names).size, names.length, 'Namen doppelt');
  const recipe = /** @type {FusionRecipe} */ (fusionRecipe(SCHUETZE, ['schuetze', 'schuetze']));
  assert.ok(recipe.coreText.length <= 140 && /Flak/.test(recipe.coreText));
});

test('Prüfung der Inhalte: fehlerhafte Rezepte werden auf Deutsch abgelehnt', () => {
  checkContent(GAME, GAME.maps[0].id, 'normal');
  /**
   * @param {(content: Content, recipe: FusionRecipe) => void} edit
   * @param {RegExp} message
   */
  const rejects = (edit, message) => {
    const content = copy(GAME);
    const arch = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'schuetze'));
    const recipes = /** @type {FusionRecipe[]} */ (arch.fusion?.recipes);
    edit(content, recipes[0]);
    assert.throws(() => checkContent(content, content.maps[0].id, 'normal'), message);
  };
  rejects((_, r) => void (r.gifts = ['schuetze']), /gifts muss genau 2 Rollen nennen/);
  rejects((_, r) => void (r.gifts = ['schuetze', 'gibtsnicht']), /unbekannte Turmrolle "gibtsnicht"/);
  rejects((_, r) => void (r.name = ''), /name fehlt/);
  rejects((_, r) => void (r.coreText = ''), /coreText fehlt/);
  rejects((_, r) => void (r.core = /** @type {any} */ ({ mul: { damage: 'viel' } })), /muss eine Zahl sein/);
  rejects((content, r) => {
    const arch = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'schuetze'));
    arch.fusion?.recipes?.push({ ...r, id: 'flak2' });
  }, /dieselben Zutaten/);
  rejects((content) => {
    const arch = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'schuetze'));
    const def = arch.tiers[1];
    if (def) delete def.recipes;
  }, /recipes\.flak fehlt/);
  rejects((content) => {
    const arch = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'schuetze'));
    const def = arch.tiers[0];
    if (def && def.recipes) def.recipes.anders = def.recipes.flak;
  }, /unbekanntes Rezept "anders"/);
});

test('Simulation: drei Schützen verschmelzen zur Flak, der Spielstand braucht nichts Neues', () => {
  /** @type {Content} */
  const content = { ...GAME, balance: { ...GAME.balance, startGold: 1e7 } };
  const config = { content, mapId: GAME.maps[0].id, difficulty: /** @type {const} */ ('normal'), seed: 5, unlockAll: true };
  const sim = createSim(config);
  // Drei freie, benachbarte Felder in einer Reihe suchen.
  /** @type {number[] | null} */
  let spot = null;
  for (let tz = 0; tz < 20 && !spot; tz++) {
    for (let tx = 0; tx < 20 && !spot; tx++) {
      if ([0, 1, 2].every((d) => sim.canBuild(tx + d, tz).ok)) spot = [tx, tz];
    }
  }
  assert.ok(spot, 'kein Platz für drei Türme');
  if (!spot) return;
  const towers = [0, 1, 2].map((d) => {
    const result = sim.build('schuetze', /** @type {number[]} */ (spot)[0] + d, /** @type {number[]} */ (spot)[1]);
    assert.ok(result.ok, String(result.reason));
    const tower = sim.towerAt(/** @type {number[]} */ (spot)[0] + d, /** @type {number[]} */ (spot)[1]);
    assert.ok(tower);
    return /** @type {NonNullable<typeof tower>} */ (tower);
  });
  for (const t of towers) {
    assert.ok(sim.upgrade(t.id).ok);
    assert.ok(sim.upgrade(t.id, 0).ok);
  }
  const [a, core, b] = towers;
  assert.deepEqual(sim.fuse(core.id, [a.id, b.id]), { ok: true });
  assert.equal(core.stats.attack, 'hitscan');
  assert.ok(core.stats.splash > 0 && core.stats.hitsAir);
  assert.deepEqual(core.stats, towerStats(content, SCHUETZE, core.tier, 3, { branch: 0, super: true, gifts: ['schuetze', 'schuetze'], giftBranches: [0, 0], tile: core.tile }));
  const save = sim.save();
  assert.ok(save);
  const again = createSim(config, save ?? undefined);
  const loaded = again.towerById(core.id);
  assert.deepEqual(loaded?.stats, core.stats);
});

// ------------------------------------------------------------------------------------------- Gesperrte Rezepte (fusion.md, 11)
// Mit den Testinhalten (tests/fixtures/content.mjs, addRecipes): 'salve' frei, 'brennglas', 'teer', 'kanone' gesperrt.

/**
 * Testinhalte mit Verschmelzung und Rezepten, reichlich Gold.
 * @param {(content: Content) => void} [edit]
 * @returns {Content}
 */
function recipeContent(edit) {
  const content = addRecipes(addFusion(makeContent()));
  content.balance.startGold = 1e6;
  if (edit) edit(content);
  return content;
}

/**
 * @param {Content} content
 * @param {Partial<import('../src/types/sim').SimConfig>} [config]
 * @param {import('../src/types/sim').SaveData | null} [save]
 */
function recipeSim(content, config = {}, save = null) {
  return createSim({ content, mapId: 'straight', difficulty: 'normal', seed: 3, unlockAll: true, ...config }, save);
}

/**
 * Baut Kern und zwei Zutaten auf Stufe 3 nebeneinander (Kern in der Mitte) und liefert ihre Kennungen.
 * @param {import('../src/types/sim').Sim} sim
 * @param {string} core
 * @param {[string, string]} parts
 * @param {number} tx Feld des Kerns
 * @param {number} tz
 * @returns {[number, number, number]}
 */
function trio(sim, core, parts, tx, tz) {
  const towers = [mustBuild(sim, core, tx, tz), mustBuild(sim, parts[0], tx - 1, tz), mustBuild(sim, parts[1], tx + 1, tz)];
  for (const t of towers) {
    assert.ok(sim.upgrade(t.id).ok);
    assert.ok(sim.upgrade(t.id, 0).ok);
  }
  return [towers[0].id, towers[1].id, towers[2].id];
}

test('fusionRecipe, lockedRecipe, recipeLook: gesperrte Rezepte nur mit Freischaltung', () => {
  const content = recipeContent();
  const shooter = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'shooter'));
  const piercer = /** @type {TowerArchetypeDef} */ (content.archetypes.find((a) => a.id === 'piercer'));
  const glass = ['thrower', 'burner'];
  assert.equal(fusionRecipe(shooter, glass), null, 'ohne Angabe wirkt kein gesperrtes Rezept');
  assert.equal(fusionRecipe(shooter, glass, []), null);
  assert.equal(fusionRecipe(shooter, glass, ['teer'])?.id, undefined);
  assert.equal(fusionRecipe(shooter, glass, ['brennglas'])?.id, 'brennglas', 'Liste der Partie');
  assert.equal(fusionRecipe(shooter, ['burner', 'thrower', 'shooter', 'shooter'], 'brennglas')?.id, 'brennglas', 'Kennung einer stehenden Waffe');
  assert.equal(fusionRecipe(shooter, glass, ''), null);
  // Ein Rezept ohne Sperre wirkt immer, auch mit '' oder einer fremden Liste.
  for (const unlocked of [undefined, '', [], ['kanone'], 'brennglas']) assert.equal(fusionRecipe(shooter, ['shooter', 'shooter'], unlocked)?.id, 'salve');
  assert.equal(lockedRecipe(shooter, glass, [])?.id, 'brennglas');
  assert.equal(lockedRecipe(shooter, glass, ['brennglas']), null);
  assert.equal(lockedRecipe(shooter, ['shooter', 'shooter'], []), null, 'die Salve ist nie gesperrt');
  assert.equal(lockedRecipe(shooter, ['shooter', 'thrower'], []), null);
  assert.equal(lockedRecipe(piercer, ['support', 'support'])?.id, 'kanone');
  assert.equal(recipeLook(shooter, 1, glass, []), null);
  assert.equal(recipeLook(shooter, 1, glass, ['brennglas'])?.superName, 'brennglas1');
  assert.equal(recipeLook(shooter, 2, ['shooter', 'shooter'])?.superName, 'salve2');
  assert.equal(recipeById(content, 'teer')?.arch.id, 'burner');
  assert.equal(recipeById(content, 'gibtsnicht'), null);
  // towerStats: `recipe` (stehende Waffe) vor `recipes` (Vorschau); ohne beides die gewöhnliche Superwaffe.
  const opts = { branch: 0, super: true, gifts: glass, giftBranches: [-1, -1] };
  assert.equal(towerStats(content, shooter, 0, 3, opts).attack, 'projectile');
  assert.equal(towerStats(content, shooter, 0, 3, { ...opts, recipes: ['brennglas'] }).attack, 'beam');
  assert.equal(towerStats(content, shooter, 0, 3, { ...opts, recipe: 'brennglas' }).attack, 'beam');
  assert.equal(towerStats(content, shooter, 0, 3, { ...opts, recipe: '', recipes: ['brennglas'] }).attack, 'projectile', 'recipe hat Vorrang');
});

test('Verschmelzen: gesperrt ergibt die gewöhnliche Superwaffe, Freischalten verwandelt nichts, Megawaffe behält das Rezept', () => {
  const content = recipeContent((c) => {
    c.boons = [{ id: 'plan', name: 'Bauplan', text: 'Brennglas', icon: 'recipe', effect: { recipe: 'brennglas' } }];
  });
  const sim = recipeSim(content, { boonChoice: true });
  const [core, a, b] = trio(sim, 'shooter', ['thrower', 'burner'], 2, 1);
  assert.deepEqual(sim.fuseRecipe(core, [a, b]), { recipe: null, locked: recipeById(content, 'brennglas')?.recipe });
  assert.deepEqual(sim.fuseRecipe(core, [a, 999]), { recipe: null, locked: null });
  assert.deepEqual(sim.fuse(core, [a, b]), { ok: true });
  const plain = /** @type {import('../src/types/sim').Tower} */ (sim.towerById(core));
  assert.equal(plain.recipe, '');
  assert.equal(plain.stats.attack, 'projectile', 'gewöhnliche Superwaffe');
  // Freischalten (hier über den Spielstand mit offenem Angebot einer Rezept-Gabe).
  const save = /** @type {import('../src/types/sim').SaveData} */ (sim.save());
  const later = recipeSim(content, { boonChoice: true }, { ...save, boonOffer: ['plan'] });
  later.drainEvents();
  assert.deepEqual(later.chooseBoon('plan'), { ok: true });
  assert.deepEqual(later.drainEvents().filter((e) => e.type === 'boon' || e.type === 'recipe'), [{ type: 'boon', id: 'plan' }, { type: 'recipe', id: 'brennglas', reason: 'boon' }]);
  assert.deepEqual(later.state.recipes, ['brennglas']);
  const old = /** @type {import('../src/types/sim').Tower} */ (later.towerById(core));
  assert.equal(old.recipe, '');
  assert.equal(old.stats.attack, 'projectile', 'die stehende Superwaffe bleibt, was sie ist');
  assert.equal(recipeLook(old.arch, old.tier, old.gifts, old.recipe), null);
  // Eine neue Verschmelzung derselben Mischung ergibt jetzt das Rezept.
  const [core2, c, d] = trio(later, 'shooter', ['burner', 'thrower'], 2, 5);
  assert.deepEqual(later.fuseRecipe(core2, [c, d]), { recipe: recipeById(content, 'brennglas')?.recipe, locked: null });
  assert.deepEqual(later.fuse(core2, [c, d]), { ok: true });
  const glass = /** @type {import('../src/types/sim').Tower} */ (later.towerById(core2));
  assert.equal(glass.recipe, 'brennglas');
  assert.equal(glass.stats.attack, 'beam');
  assert.equal(recipeLook(glass.arch, glass.tier, glass.gifts, glass.recipe)?.superName, 'brennglas0');
  // Megawaffe: Die alte gewöhnliche Superwaffe bleibt gewöhnlich, die Rezept-Waffe bleibt Rezept.
  const [e, f] = [mustBuild(later, 'shooter', 1, 0), mustBuild(later, 'shooter', 2, 0)];
  for (const t of [e, f]) {
    later.upgrade(t.id);
    later.upgrade(t.id, 0);
  }
  assert.deepEqual(later.fuseRecipe(core, [e.id, f.id]), { recipe: null, locked: null });
  assert.deepEqual(later.fuse(core, [e.id, f.id]), { ok: true });
  assert.equal(old.mega && old.recipe, '');
  assert.equal(old.stats.attack, 'projectile');
  // Speichern und Laden: Rezepte der Partie und je Turm.
  const again = recipeSim(content, { boonChoice: true }, /** @type {import('../src/types/sim').SaveData} */ (later.save()));
  assert.deepEqual(again.state.recipes, ['brennglas']);
  assert.equal(again.towerById(core2)?.recipe, 'brennglas');
  assert.equal(again.towerById(core)?.recipe, '');
  assert.deepEqual(again.towerById(core2)?.stats, glass.stats);
});

test('Spielstände: Rezepte werden geprüft; ältere ohne Angabe leiten das Rezept aus den freigeschalteten ab', () => {
  const content = recipeContent();
  const sim = recipeSim(content);
  const [core, a, b] = trio(sim, 'piercer', ['support', 'support'], 2, 1);
  const [salve, s1, s2] = trio(sim, 'shooter', ['shooter', 'shooter'], 2, 5);
  sim.fuse(core, [a, b]);
  sim.fuse(salve, [s1, s2]);
  assert.equal(sim.towerById(salve)?.recipe, 'salve', 'ein freies Rezept steht im Turm');
  const save = /** @type {import('../src/types/sim').SaveData} */ (sim.save());
  assert.deepEqual(save.recipes, []);
  /** @param {(s: any) => void} edit */
  const loaded = (edit) => {
    const copy = structuredClone(save);
    edit(copy);
    return recipeSim(content, {}, copy);
  };
  // Älterer Spielstand ohne `recipe`: abgeleitet aus `recipes` des Spielstands.
  const old = loaded((s) => {
    for (const t of s.towers) delete t.recipe;
    s.recipes = ['kanone'];
  });
  assert.equal(old.towerById(core)?.recipe, 'kanone');
  assert.equal(old.towerById(salve)?.recipe, 'salve');
  const none = loaded((s) => {
    for (const t of s.towers) delete t.recipe;
    delete s.recipes;
  });
  assert.equal(none.towerById(core)?.recipe, '');
  assert.deepEqual(none.state.recipes, []);
  assert.throws(() => loaded((s) => void (s.recipes = ['gibtsnicht'])), /kein gesperrtes Rezept/);
  assert.throws(() => loaded((s) => void (s.recipes = ['salve'])), /kein gesperrtes Rezept/);
  assert.throws(() => loaded((s) => void (s.recipes = ['teer', 'teer'])), /doppelt/);
  assert.throws(() => loaded((s) => void (s.towers.find((/** @type {any} */ t) => t.id === core).recipe = 'brennglas')), /nicht passt/);
  assert.throws(() => loaded((s) => void (s.towers[0].recipe = 5)), /recipe muss/);
});

/**
 * Inhalte für Zwischenbosse: je Zeitalter eine leere Welle, eine Welle mit einem Zwischenboss und eine leere Schlusswelle;
 * der Turm 'zap' trifft die ganze Karte sofort.
 * @param {(content: Content) => void} [edit]
 */
function bossContent(edit) {
  return recipeContent((content) => {
    content.enemies.mini = { ...content.enemies.boss, id: 'mini', hp: 0.5, speed: 3, lives: 5, phases: [] };
    content.waves = content.ages.map(() => [{ groups: [] }, { groups: [{ enemy: 'mini', count: 1, interval: 0, delay: 0 }] }, { groups: [{ enemy: 'mini', count: 1, interval: 0, delay: 0 }] }]);
    content.archetypes.push({ ...content.archetypes[0], id: 'zap', fusion: undefined, branches: undefined, stats: { ...content.archetypes[0].stats, attack: 'hitscan', damage: 1e6, cooldown: 0.1, range: 30 } });
    if (edit) edit(content);
  });
}

/**
 * Spielt die Wellen der Partie bis zum Ende und sammelt die Ereignisse `recipe`.
 * @param {import('../src/types/sim').Sim} sim
 */
function playAll(sim) {
  /** @type {any[]} */
  const unlocks = [];
  for (let guard = 0; guard < 60 * 600 && sim.state.phase !== 'won' && sim.state.phase !== 'lost'; guard++) {
    if (sim.state.phase === 'build') {
      sim.state.lock = 0;
      assert.ok(sim.startWave().ok);
    }
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'recipe') unlocks.push({ ...e, wave: sim.state.wave });
  }
  return unlocks;
}

test('Zwischenboss ohne Funkenverlust: ein gesperrtes Rezept seines Zeitalters, deterministisch, nicht beim Schlussboss', () => {
  const content = bossContent();
  /** @type {Set<string>} */
  const first = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const sim = recipeSim(content, { seed });
    mustBuild(sim, 'zap', 6, 0);
    const unlocks = playAll(sim);
    assert.equal(sim.state.phase, 'won');
    // Drei Zeitalter, drei Zwischenbosse, drei gesperrte Rezepte: jedes Zeitalter schaltet eins frei, nach `waveClear`.
    assert.deepEqual(unlocks.map((u) => [u.reason, u.wave]), [['boss', 2], ['boss', 5], ['boss', 8]], `Startwert ${seed}`);
    assert.ok(['brennglas', 'kanone'].includes(unlocks[0].id), 'Teer erst ab dem zweiten Zeitalter');
    assert.deepEqual([...sim.state.recipes].sort(), ['brennglas', 'kanone', 'teer']);
    first.add(unlocks[0].id);
    // Gleicher Startwert, gleiche Ziehung.
    const twin = recipeSim(content, { seed });
    mustBuild(twin, 'zap', 6, 0);
    assert.deepEqual(playAll(twin), unlocks);
  }
  assert.equal(first.size, 2, 'die Ziehung hängt vom Startwert ab');
  // Mit Funkenverlust (kein Turm: der Zwischenboss kommt durch) gibt es nichts.
  const lost = recipeSim(content, { seed: 1 });
  assert.deepEqual(playAll(lost), []);
  assert.deepEqual(lost.state.recipes, []);
  // Sind alle frei, gibt es nichts mehr.
  const full = recipeSim(content, { seed: 1 }, { .../** @type {import('../src/types/sim').SaveData} */ (recipeSim(content).save()), recipes: ['teer', 'kanone', 'brennglas'] });
  mustBuild(full, 'zap', 6, 0);
  assert.deepEqual(playAll(full), []);
});

test('Rezept-Gaben: höchstens eine je Angebot, keine für freigeschaltete Rezepte, Prüfung der Inhalte', () => {
  /** @type {import('../src/types/content').BoonDef[]} */
  const boons = [
    { id: 'plan_glas', name: 'Bauplan Brennglas', text: 'x', icon: 'recipe', weight: 5, effect: { recipe: 'brennglas' } },
    { id: 'plan_teer', name: 'Bauplan Teer', text: 'x', icon: 'recipe', weight: 5, effect: { recipe: 'teer' } },
    { id: 'plan_kanone', name: 'Bauplan Kanone', text: 'x', icon: 'recipe', weight: 5, effect: { recipe: 'kanone' } },
    ...['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, text: id, icon: 'x', effect: { economy: { bounty: 1 } } })),
  ];
  const content = recipeContent((c) => {
    c.boons = boons;
    c.waves = c.ages.map(() => [{ groups: /** @type {import('../src/types/content').SpawnGroup[]} */ ([]) }]);
  });
  const isPlan = (/** @type {string} */ id) => id.startsWith('plan_');
  let seen = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const sim = recipeSim(content, { seed, boonChoice: true });
    sim.startWave();
    for (let i = 0; i < 5 && sim.state.boonOffer.length === 0; i++) sim.step();
    assert.equal(sim.state.boonOffer.length, 3);
    const plans = sim.state.boonOffer.filter(isPlan).length;
    assert.ok(plans <= 1, `Startwert ${seed}: ${sim.state.boonOffer.join(', ')}`);
    seen += plans;
    // Mit allen Rezepten frei: keine Rezept-Gabe mehr.
    const save = /** @type {import('../src/types/sim').SaveData} */ (recipeSim(content, { seed, boonChoice: true }).save());
    const done = recipeSim(content, { seed, boonChoice: true }, { ...save, recipes: ['brennglas', 'teer', 'kanone'] });
    done.startWave();
    for (let i = 0; i < 5 && done.state.boonOffer.length === 0; i++) done.step();
    assert.equal(done.state.boonOffer.filter(isPlan).length, 0);
  }
  assert.ok(seen >= 10, 'bei hohem Gewicht fast immer eine');
  // Prüfung der Inhalte.
  /** @param {any} effect @param {RegExp} message */
  const rejects = (effect, message) => {
    const bad = recipeContent((c) => void (c.boons = [{ id: 'x', name: 'x', text: 'x', icon: 'x', effect }]));
    assert.throws(() => checkContent(bad, 'straight', 'normal'), message);
  };
  rejects({ recipe: 'gibtsnicht' }, /unbekannte Rezept "gibtsnicht"/);
  rejects({ recipe: 'salve' }, /nicht gesperrt/);
  const twice = recipeContent((c) => void (c.boons = [boons[0], { ...boons[0], id: 'y' }]));
  assert.throws(() => checkContent(twice, 'straight', 'normal'), /schaltet schon eine andere/);
  const badRecipe = recipeContent((c) => void (/** @type {any} */ (c.archetypes[0].fusion?.recipes?.[1]).locked = 'ja'));
  assert.throws(() => checkContent(badRecipe, 'straight', 'normal'), /locked muss true oder false/);
  const badAge = recipeContent((c) => void (/** @type {any} */ (c.archetypes[0].fusion?.recipes?.[1]).ages = [1, -1]));
  assert.throws(() => checkContent(badAge, 'straight', 'normal'), /ages muss eine Liste/);
});

// ------------------------------------------------------------------------------------------- Die Rezepte der Spielinhalte

/** Rollennamen, wie die Texte sie nennen. */
const ROLE_WORDS = { schuetze: 'Schütze', werfer: 'Werfer', bremser: 'Bremser', knacker: 'Panzerknacker', brenner: 'Brenner', taktgeber: 'Taktgeber' };

test('Spielinhalte: acht Rezepte, nur die Flak frei, je eins für jedes Zeitalter mit Pool, Namen und Angriffsbild in allen sechs Zeitaltern', () => {
  /** @type {{ arch: TowerArchetypeDef, recipe: FusionRecipe }[]} */
  const all = [];
  for (const arch of ARCHETYPES) for (const recipe of arch.fusion?.recipes ?? []) all.push({ arch, recipe });
  assert.ok(all.length >= 7 && all.length <= 9, `${all.length} Rezepte`);
  assert.deepEqual(all.filter((r) => r.recipe.locked !== true).map((r) => r.recipe.id), ['flak'], 'nur die Flak ist nie gesperrt');
  // Jede Kernrolle hat mindestens ein Rezept.
  for (const role of Object.keys(ROLE_WORDS)) assert.ok(all.some((r) => r.arch.id === role), `kein Rezept mit Kern ${role}`);
  // Pools der Zwischenbosse: Rom, Mittelalter und Entdecker (Positionen 1 bis 3) haben je mindestens drei, Steinzeit und Zukunft keins.
  for (let position = 0; position < 5; position++) {
    const pool = all.filter((r) => r.recipe.ages?.includes(position)).length;
    if (position === 0 || position === 4) assert.equal(pool, 0, `Position ${position}`);
    else assert.ok(pool >= 3, `Position ${position}: ${pool} Rezepte im Pool`);
  }
  for (const { recipe } of all) if (recipe.locked) assert.ok(recipe.ages && recipe.ages.length > 0, `${recipe.id}: in keinem Pool`);
  /** @type {string[]} */
  const names = [];
  for (const arch of ARCHETYPES) for (const def of arch.tiers) if (def) names.push(def.name, String(def.superName), String(def.megaName));
  for (const { arch, recipe } of all) {
    assert.ok(recipe.coreText.length <= 150, `${recipe.id}: coreText zu lang (${recipe.coreText.length})`);
    assert.ok(recipe.coreText.includes(recipe.name) || recipe.id === 'flak', `${recipe.id}: coreText nennt den Namen nicht`);
    arch.tiers.forEach((def, age) => {
      const look = def?.recipes?.[recipe.id];
      assert.ok(look, `${recipe.id} ${AGES[age].id}: ohne Namen`);
      if (!look) return;
      assert.ok(look.superName.length > 2 && look.superName.length <= 18, `${recipe.id} ${AGES[age].id}: superName "${look.superName}"`);
      assert.ok(look.megaName.length > 2 && look.megaName.length <= 20, `${recipe.id} ${AGES[age].id}: megaName "${look.megaName}"`);
      assert.ok(look.superShot && ['model', 'tracer', 'beam', 'bolt', 'flame', 'pulse'].includes(look.superShot.kind), `${recipe.id} ${AGES[age].id}: Angriffsbild`);
      if (look.superShot?.kind === 'model') assert.ok(look.superShot.model?.startsWith('shot.'), `${recipe.id}: Geschossmodell`);
      names.push(look.superName, look.megaName);
    });
  }
  assert.equal(new Set(names).size, names.length, `Namen doppelt: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
});

test('Spielinhalte: je gesperrtem Rezept genau ein Bauplan, der Rezept und Zutaten ehrlich nennt', () => {
  /** @type {FusionRecipe[]} */
  const locked = [];
  for (const arch of ARCHETYPES) for (const recipe of arch.fusion?.recipes ?? []) if (recipe.locked) locked.push(recipe);
  // Baupläne waffengebundener Rezepte (Waffen des Pools) prüft tests/pool.content.test.mjs; die klassischen Inhalte kennen sie nicht.
  const plans = (GAME.boons ?? []).filter((boon) => boon.effect.recipe !== undefined && recipeById(GAME, boon.effect.recipe) !== null);
  assert.deepEqual(plans.map((b) => b.effect.recipe).sort(), locked.map((r) => r.id).sort());
  for (const boon of plans) {
    const found = /** @type {NonNullable<ReturnType<typeof recipeById>>} */ (recipeById(GAME, String(boon.effect.recipe)));
    assert.ok(boon.name.includes(found.recipe.name), `${boon.id}: Name nennt das Rezept nicht`);
    assert.ok(boon.text.includes(ROLE_WORDS[/** @type {keyof typeof ROLE_WORDS} */ (found.arch.id)]), `${boon.id}: Kern fehlt im Text`);
    for (const gift of found.recipe.gifts) assert.ok(boon.text.includes(ROLE_WORDS[/** @type {keyof typeof ROLE_WORDS} */ (gift)]), `${boon.id}: Zutat ${gift} fehlt im Text`);
    assert.match(boon.text, /neue Verschmelzungen/, `${boon.id}: sagt nicht, dass stehende Waffen bleiben`);
    assert.ok((boon.weight ?? 1) < 1, `${boon.id}: Baupläne sind seltener als gewöhnliche Gaben`);
    assert.equal(boon.requires?.fusion, true, boon.id);
  }
});

test('Spielinhalte: jedes Rezept greift anders an als die gewöhnliche Superwaffe seiner Mischung, Werfer treffen nie Flieger', () => {
  /** @param {import('../src/types/content').TowerStats} s */
  const shape = (s) => `${s.attack}|${s.zone > 0}|${s.splash > 0}|${s.minRange > 0}|${s.hitsAir}|${s.hitsGround}|${s.slow > 0}|${s.dot > 0}|${s.ramp > 0}`;
  for (const arch of ARCHETYPES) {
    // Die gewöhnliche Superwaffe derselben Mischung: die Rolle ohne Rezepte (auch die nie gesperrte Flak wirkt dann nicht).
    const bare = /** @type {TowerArchetypeDef} */ ({ ...arch, fusion: { ...arch.fusion, recipes: [] } });
    for (const recipe of arch.fusion?.recipes ?? []) {
      for (let tier = 0; tier < AGES.length; tier++) {
        for (const branch of [0, 1]) {
          for (const gb of [[0, 0], [1, 1], [0, 1]]) {
            const opts = { branch, super: true, gifts: recipe.gifts, giftBranches: gb };
            const plain = towerStats(FULL, bare, tier, 3, opts);
            const s = towerStats(FULL, arch, tier, 3, { ...opts, recipe: recipe.id });
            const where = `${recipe.id} ${AGES[tier].id} Zweig ${branch} Gaben ${gb}`;
            for (const [key, value] of Object.entries(s)) if (typeof value === 'number') assert.ok(Number.isFinite(value) && value >= 0, `${where}: ${key} = ${value}`);
            assert.notEqual(shape(s), shape(plain), `${where}: wie die gewöhnliche Superwaffe`);
            if (arch.id === 'werfer') assert.equal(s.hitsAir, false, `${where}: Ein Werfer trifft nie Flieger`);
            if (s.attack !== 'none') assert.ok(s.attack === 'pulse' || s.damage > 0, `${where}: ohne Schaden`);
            // Mega: gleiche Art, stärker.
            const mega = towerStats(FULL, arch, tier, 3, { ...opts, mega: true, gifts: [...recipe.gifts, 'schuetze', 'schuetze'], giftBranches: [...gb, 0, 0], recipe: recipe.id });
            assert.equal(mega.attack, s.attack, `${where}: Megawaffe`);
          }
        }
      }
    }
  }
  // Eigenheiten, auf die sich Texte und Spieler verlassen.
  const of = (/** @type {string} */ id, /** @type {number} */ tier = 3) => {
    const found = /** @type {NonNullable<ReturnType<typeof recipeById>>} */ (recipeById(FULL, id));
    return towerStats(FULL, found.arch, tier, 3, { branch: 0, super: true, gifts: found.recipe.gifts, giftBranches: [0, 0], recipe: id });
  };
  const teer = of('teerfeuer');
  assert.ok(teer.attack === 'projectile' && teer.zone >= 4 && teer.dot > 0 && teer.slow > 0 && !teer.hitsAir);
  const siege = of('belagerung');
  assert.ok(siege.minRange >= 2 && !siege.hitsAir && siege.pierce === 1 && siege.cooldown >= 5);
  const steam = of('dampfkessel');
  assert.ok(steam.attack === 'pulse' && steam.hitsAir && steam.slow === 0 && steam.dot > 0);
  const post = of('kommando');
  assert.ok(post.attack === 'hitscan' && post.hitsAir && !post.hitsGround && post.auraRate > 0 && post.auraDamage === 0);
  const shell = of('panzergranate');
  assert.ok(shell.zone === 0 && shell.dot === 0 && shell.pierce === 1 && !shell.hitsAir);
  const glass = of('brennglas');
  assert.ok(glass.attack === 'beam' && glass.ramp === 0 && glass.splash > 0 && glass.dot > 0 && glass.hitsAir);
  const chain = of('fesselstrahl');
  assert.ok(chain.attack === 'beam' && chain.slow >= 0.4 && chain.hitsAir && chain.zone === 0 && chain.splash === 0);
});
