// @ts-check
// Der Waffenpool mit drei Waffen je Platz (docs/briefs/fusion.md, 12; docs/DESIGN.md 2.14): Vollständigkeit aller 18 Waffen,
// die Aufgabe jedes Platzes in jedem Zeitalter, eigene Superwaffen, Gaben, die auf jedem Kern etwas tun, die Flieger-Garantie der
// Ziehung, gewöhnliche Rezepte mit jeder Waffe ihres Platzes und die waffengebundenen Rezepte mit ihren Bauplänen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCHETYPES, POOL, SLOTS, poolContent as GAME } from '../src/content/index.js';
import { listModelIds } from '../src/content/models.js';
import { drawLoadout, fusionRecipe, giftMod, hitsFliers, recipeById, recipeFits, recipeLook, recipeWeapons, slotOf, towerStats, weaponsOfSlot } from '../src/sim/rules.js';
import { createSim } from '../src/sim/sim.js';
import { checkContent } from '../src/sim/validate.js';

/** @import { Content, StatMod, TowerArchetypeDef, TowerStats } from '../src/types/content' */

const KINDS = ['model', 'tracer', 'beam', 'bolt', 'flame', 'pulse'];
const MARKERS = ['crystal', 'vial', 'pennant', 'ring', 'orb', 'spikes'];
const AGES = GAME.ages.length;

/** @param {string} id */
const weapon = (id) => /** @type {TowerArchetypeDef} */ (GAME.archetypes.find((a) => a.id === id));

/** Alle Zahlen der Werte endlich und nicht negativ. @param {TowerStats} s @param {string} where */
function sane(s, where) {
  for (const [key, value] of Object.entries(s)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value) && value >= 0, `${where}: ${key} = ${value}`);
  }
  assert.ok(s.range > 0, `${where}: Reichweite`);
  if (s.attack !== 'none') assert.ok(s.cooldown > 0, `${where}: Pause`);
  assert.ok(s.pierce <= 1 && s.slow <= 0.9, `${where}: pierce ${s.pierce}, slow ${s.slow}`);
}

test('Pool: drei Waffen je Platz, die klassische vorn, alle 18 vollständig und gültig', () => {
  checkContent(GAME, GAME.maps[0].id, 'normal');
  assert.equal(GAME.archetypes.length, 18);
  assert.equal(POOL.length, 12);
  const models = new Set(listModelIds());
  /** @type {string[]} */
  const allNames = [];
  for (const slot of SLOTS) {
    const list = weaponsOfSlot(GAME, slot.id);
    assert.equal(list.length, 3, `Platz ${slot.id}`);
    assert.equal(list[0].id, slot.id);
    // Erkennungszeichen und Akzentfarbe unterscheiden die Waffen eines Platzes.
    const marks = list.slice(1).map((a) => a.look?.marker);
    assert.equal(new Set(marks).size, 2, `${slot.id}: Erkennungszeichen ${marks}`);
    assert.equal(new Set(list.slice(1).map((a) => String(a.look?.accent))).size, 2);
  }
  for (const arch of POOL) {
    const classic = /** @type {TowerArchetypeDef} */ (ARCHETYPES.find((a) => a.id === arch.slot));
    assert.ok(arch.name && arch.summary.length > 40 && arch.summary.length <= 170, `${arch.id}: Name und Text (${arch.summary.length})`);
    assert.ok(arch.look && MARKERS.includes(arch.look.marker), `${arch.id}: look`);
    assert.ok(arch.cost >= 50 && arch.cost <= 130, `${arch.id}: Preis ${arch.cost}`);
    assert.equal(arch.unlockWave, classic.unlockWave);
    assert.ok(arch.branches && arch.branches.length === 2, `${arch.id}: zwei Zweige`);
    for (const b of arch.branches) {
      assert.ok(b.name && b.summary && b.icon && b.mod, `${arch.id}: Zweig ${b.name}`);
      assert.ok(b.gift && b.gift.name && b.gift.text.length > 30 && b.gift.text.length <= 200, `${arch.id}: Gabe von ${b.name}`);
    }
    assert.notEqual(arch.branches[0].gift?.name, arch.branches[1].gift?.name);
    const fusion = /** @type {NonNullable<TowerArchetypeDef['fusion']>} */ (arch.fusion);
    assert.ok(fusion && fusion.core && fusion.coreText.length <= 170 && fusion.giftName && fusion.giftText, `${arch.id}: Kern`);
    assert.deepEqual(fusion.gift, arch.branches[0].gift?.mod, `${arch.id}: fusion.gift ist die Gabe von Zweig 0`);
    assert.equal(arch.tiers.length, AGES);
    arch.tiers.forEach((def, age) => {
      assert.ok(def, `${arch.id}: Zeitalter ${age}`);
      assert.equal(def.model, classic.tiers[age]?.model, `${arch.id}: Modell des Platzes`);
      assert.ok(models.has(def.model));
      assert.ok(def.flavor.length > 30 && def.flavor.length <= 140, `${arch.id} ${age}: Stimmungssatz (${def.flavor.length})`);
      for (const shot of [def.shot, def.superShot]) {
        assert.ok(shot && KINDS.includes(shot.kind), `${arch.id} ${age}: Angriffsbild`);
        if (shot.kind === 'model') assert.ok(shot.model && models.has(shot.model), `${arch.id}: Geschoss ${shot.model}`);
      }
      for (const name of [def.name, def.superName, def.megaName]) {
        assert.ok(name && name.length >= 4 && name.length <= 20, `${arch.id} ${age}: Name "${name}"`);
        allNames.push(/** @type {string} */ (name));
      }
    });
  }
  for (const arch of ARCHETYPES) for (const def of arch.tiers) if (def) allNames.push(def.name, String(def.superName), String(def.megaName));
  const doubles = allNames.filter((n, i) => allNames.indexOf(n) !== i);
  assert.deepEqual(doubles, [], 'Turm-, Superwaffen- und Megawaffen-Namen sind über alle Waffen eindeutig');
});

test('Pool: Jede Waffe erfüllt die Aufgabe ihres Platzes in jedem Zeitalter, auf jeder Stufe, in jedem Zweig; Werfer nie gegen Flieger', () => {
  for (const arch of GAME.archetypes) {
    const slot = slotOf(arch);
    for (let tier = 0; tier < AGES; tier++) {
      for (const [level, branch] of /** @type {const} */ ([[1, -1], [2, -1], [3, 0], [3, 1]])) {
        const s = towerStats(GAME, arch, tier, level, { branch });
        const where = `${arch.id} Zeitalter ${tier} Stufe ${level} Zweig ${branch}`;
        sane(s, where);
        if (slot === 'werfer') assert.ok((s.splash > 0 || s.attack === 'pulse') && !s.hitsAir, where);
        if (slot === 'bremser') assert.ok(s.slow > 0, where);
        if (slot === 'knacker') assert.ok(s.pierce > 0, where);
        if (slot === 'brenner') assert.ok(s.dot > 0 && s.dotDuration > 0, where);
        if (slot === 'taktgeber') assert.ok(s.auraRate > 0 || s.auraDamage > 0 || s.auraRange > 0 || (s.auraBounty ?? 0) > 0 || (s.mark ?? 0) > 0, where);
      }
    }
  }
  // Auch als Superwaffe trifft keine Waffe des Werfer-Platzes Flieger, mit welchen Zutaten auch immer.
  for (const arch of weaponsOfSlot(GAME, 'werfer')) {
    for (const other of GAME.archetypes) {
      for (const gb of [0, 1]) {
        const s = towerStats(GAME, arch, 3, 3, { branch: gb, super: true, gifts: [other.id, other.id], giftBranches: [gb, gb], recipes: GAME.archetypes.flatMap((a) => (a.fusion?.recipes ?? []).map((r) => r.id)) });
        assert.equal(s.hitsAir, false, `${arch.id} mit ${other.id}`);
      }
    }
  }
  // Wachsen mit Zeitalter und Stufe wie die klassischen: Netz bremst, Licht zeichnet stärker.
  assert.deepEqual([0, 5].map((t) => Math.round(100 * towerStats(GAME, weapon('netzwerfer'), t, 3, { branch: 0 }).slow)), [50, 75]);
  assert.deepEqual([0, 5].map((t) => Math.round(100 * (towerStats(GAME, weapon('leuchtfeuer'), t, 3, { branch: 0 }).mark ?? 0))), [25, 35]);
  assert.equal(towerStats(GAME, weapon('zahlmeister'), 4, 3, { branch: 0 }).auraBounty, 0.8);
});

test('Pool: Jede Superwaffe greift anders an als die übrigen 17, und Flieger trifft sie, wie ihr Text sagt', () => {
  /** @param {TowerStats} s */
  const shape = (s) => [s.attack, s.splash > 0, s.chain > 0, s.zone > 0, s.slow > 0, s.dot > 0, s.ramp > 0, (s.mark ?? 0) > 0, (s.push ?? 0) > 0,
    (s.auraBounty ?? 0) > 0, s.auraDamage > 0, s.hitsAir].join('|');
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const arch of GAME.archetypes) {
    // Zutaten, die keine Form ändern: zwei Taktgeber mit Fernsicht (Reichweite, Aura).
    const s = towerStats(GAME, arch, 2, 3, { branch: 0, super: true, gifts: ['taktgeber', 'taktgeber'], giftBranches: [0, 0] });
    sane(s, arch.id);
    const key = shape(s);
    assert.ok(!seen.has(key), `${arch.id} greift als Superwaffe an wie ${seen.get(key)}: ${key}`);
    seen.set(key, arch.id);
    const air = /Flieger|Luft/.test(/** @type {string} */ (arch.fusion?.coreText));
    if (s.hitsAir && s.attack !== 'none') assert.ok(air || hitsFliers(arch), `${arch.id}: trifft Flieger, sagt es aber nicht`);
  }
});

test('Pool: Jede der 36 Gaben verändert jeden angreifenden Kern, und keine bricht ihn', () => {
  /** Eine Zutat ohne Gabe, zum Vergleich. @type {TowerArchetypeDef} */
  const blank = { ...weapon('taktgeber'), id: 'leer', slot: 'taktgeber', branches: undefined, fusion: { core: {}, coreText: '', gift: {}, giftName: '', giftText: '' } };
  /** @type {Content} */
  const content = { ...GAME, archetypes: [...GAME.archetypes, blank] };
  /** @type {string[]} */
  const idle = [];
  for (const giver of GAME.archetypes) {
    for (const branch of [0, 1]) {
      const mod = /** @type {StatMod} */ (giftMod(giver, branch));
      assert.ok(mod, `${giver.id} Zweig ${branch}: Gabe`);
      for (const core of GAME.archetypes) {
        const plain = towerStats(content, core, 3, 3, { branch: 0, super: true, gifts: ['leer', 'leer'], giftBranches: [0, 0] });
        const given = towerStats(content, core, 3, 3, { branch: 0, super: true, gifts: [giver.id, 'leer'], giftBranches: [branch, 0] });
        sane(given, `${core.id} mit ${giver.id}/${branch}`);
        if (plain.attack === 'none') continue;
        if (JSON.stringify(plain) === JSON.stringify(given)) idle.push(`${giver.id}/${branch} -> ${core.id}`);
      }
    }
  }
  assert.deepEqual(idle, [], 'Gaben ohne Wirkung auf einen angreifenden Kern');
});

test('Ziehung: über 1000 Startwerte je Platz jede Waffe etwa gleich oft, immer mindestens zwei gegen Flieger', () => {
  /** @type {Record<string, number>} */
  const count = {};
  for (let seed = 1; seed <= 1000; seed++) {
    const ids = drawLoadout(GAME, seed);
    assert.equal(ids.length, 6);
    assert.ok(ids.filter((id) => hitsFliers(weapon(id))).length >= 2, `Startwert ${seed}: ${ids}`);
    for (const id of ids) count[id] = (count[id] ?? 0) + 1;
  }
  for (const arch of GAME.archetypes) assert.ok(count[arch.id] > 180 && count[arch.id] < 480, `${arch.id}: ${count[arch.id]} von 1000`);
  // Welche Waffen zählen als Flieger-Waffe (Schaden oder Brand gegen Flieger schon auf Stufe 1)?
  assert.deepEqual(GAME.archetypes.filter(hitsFliers).map((a) => a.id).sort(),
    ['brandpfeil', 'frostturm', 'giftschuetze', 'knacker', 'schnellschuetze', 'schuetze', 'spalter']);
});

test('Rezepte: jedes gewöhnliche Rezept mit jeder Waffe seiner Plätze; Ergebnis gesund, gleiche Reichweite wie mit der klassischen', () => {
  const unlocked = GAME.archetypes.flatMap((a) => (a.fusion?.recipes ?? []).map((r) => r.id));
  for (const classic of ARCHETYPES) {
    for (const recipe of classic.fusion?.recipes ?? []) {
      for (const core of weaponsOfSlot(GAME, classic.id)) {
        const own = (core.fusion?.recipes ?? []).some((r) => r.gifts.join() === recipe.gifts.join());
        for (const a of weaponsOfSlot(GAME, recipe.gifts[0])) {
          for (const b of weaponsOfSlot(GAME, recipe.gifts[1])) {
            const gifts = [a.id, b.id];
            const found = fusionRecipe(core, gifts, unlocked, GAME);
            // Ein waffengebundenes Rezept mit denselben Plätzen geht vor (Kopfgeldjäger vor Kommandoposten).
            if (!own) assert.equal(found?.id, recipe.id, `${core.id} + ${gifts}`);
            const s = towerStats(GAME, core, 2, 3, { branch: 0, super: true, gifts, giftBranches: [0, 0], recipes: unlocked });
            sane(s, `${recipe.id}: ${core.id} + ${gifts}`);
            if (found?.id === recipe.id) {
              assert.ok(recipeLook(core, 2, gifts, unlocked, GAME), `${recipe.id}: Aussehen für ${core.id}`);
              if (classic.id === 'werfer') assert.equal(s.hitsAir, false, `${recipe.id} mit ${core.id}`);
            }
          }
        }
      }
      // Die Reichweite eines Rezepts hängt nicht von der Waffe des Kerns ab (je Waffe ein Zweig, der die Reichweite nicht ändert).
      const ranges = weaponsOfSlot(GAME, classic.id).map((core) => {
        const gifts = [weaponsOfSlot(GAME, recipe.gifts[0])[0].id, weaponsOfSlot(GAME, recipe.gifts[1])[0].id];
        const found = fusionRecipe(core, gifts, unlocked, GAME);
        const branch = core.branches?.[0].mod.mul?.range !== undefined ? 1 : 0;
        return found?.id === recipe.id ? Math.round(100 * towerStats(GAME, core, 2, 3, { branch, super: true, gifts, giftBranches: [0, 0], recipes: unlocked }).range) : -1;
      }).filter((r) => r > 0);
      if (!['werfer', 'taktgeber'].includes(classic.id)) assert.equal(new Set(ranges).size, 1, `${recipe.id}: Reichweiten ${ranges}`);
    }
  }
});

test('Waffengebundene Rezepte: gesperrt, nur mit ihren Waffen, je Zeitalter benannt, je ein Bauplan, nur angeboten, wenn sie passen', () => {
  const bound = POOL.flatMap((arch) => (arch.fusion?.recipes ?? []).map((recipe) => ({ arch, recipe })));
  assert.deepEqual(bound.map((b) => b.recipe.id).sort(), ['feuerwalze', 'harpune', 'kopfgeld', 'nebelwerfer', 'sonnenlanze']);
  /** @type {string[]} */
  const names = [];
  for (const { arch, recipe } of bound) {
    assert.equal(recipe.locked, true, recipe.id);
    assert.ok(recipe.ages && recipe.ages.length > 0 && recipe.ages.every((a) => a >= 1 && a <= 3), `${recipe.id}: Pool der Zwischenbosse`);
    assert.ok(recipe.coreText.includes(recipe.name) && recipe.coreText.length <= 160, `${recipe.id}: Text`);
    assert.ok(recipeWeapons(GAME, recipe.id).includes(arch.id));
    const classic = ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber'];
    assert.equal(recipeFits(GAME, recipe.id, classic), false, `${recipe.id} passt nicht zur klassischen Bewaffnung`);
    const fits = classic.map((id) => (id === slotOf(arch) ? arch.id : id === 'schuetze' && recipe.id === 'nebelwerfer' ? 'giftschuetze' : id));
    assert.equal(recipeFits(GAME, recipe.id, fits), true, `${recipe.id} passt mit ${fits}`);
    const gifts = recipe.gifts.map((g) => (weapon(g) && slotOf(weapon(g)) !== g ? g : weaponsOfSlot(GAME, g)[0].id));
    assert.equal(fusionRecipe(arch, gifts, [recipe.id], GAME)?.id, recipe.id);
    assert.equal(fusionRecipe(arch, gifts, [], GAME)?.id === recipe.id, false, 'gesperrt');
    for (let age = 0; age < AGES; age++) {
      const look = arch.tiers[age]?.recipes?.[recipe.id];
      assert.ok(look && look.superName.length <= 18 && look.megaName.length <= 20 && look.superShot && KINDS.includes(look.superShot.kind), `${recipe.id} ${age}`);
      names.push(look.superName, look.megaName);
      const s = towerStats(GAME, arch, age, 3, { branch: 1, super: true, gifts, giftBranches: [1, 1], recipe: recipe.id });
      sane(s, `${recipe.id} ${age}`);
    }
    const plan = (GAME.boons ?? []).find((b) => b.effect.recipe === recipe.id);
    assert.ok(plan && plan.name.includes(recipe.name) && /neue Verschmelzungen/.test(plan.text) && (plan.weight ?? 1) < 1, `${recipe.id}: Bauplan`);
    assert.ok(plan.text.includes(/** @type {string} */ (arch.name)), `${recipe.id}: Bauplan nennt die Waffe`);
    assert.deepEqual(plan.requires?.weapons, [arch.id]);
  }
  assert.equal(new Set(names).size, names.length, 'Namen der waffengebundenen Rezepte eindeutig');
  // Ein Bauplan kommt nur ins Angebot, wenn die Bewaffnung das Rezept bauen kann: über viele Partien nie ohne den Kern.
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const seed of seeds) {
    const sim = createSim({ content: GAME, mapId: GAME.maps[0].id, difficulty: 'normal', seed, unlockAll: true, boonChoice: true, loadout: 'random' });
    for (const boon of GAME.boons ?? []) {
      const id = boon.effect.recipe;
      if (id && recipeById(GAME, id) && !recipeFits(GAME, id, sim.loadout)) assert.ok(!sim.state.boonOffer.includes(boon.id));
    }
  }
});
