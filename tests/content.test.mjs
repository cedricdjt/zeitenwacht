// Prüft die Inhaltsdaten (src/content) auf Vollständigkeit und Stimmigkeit mit Spielentwurf und Verträgen.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ABILITIES, AGES, ARCHETYPES, BALANCE, ENEMIES, MAPS, WAVES, content } from '../src/content/index.js';
import { ACTIVE_AGES } from '../src/content/scope.js';
import { getGroundColor, getLightTheme } from '../src/content/themes.js';
import { buildPath, pathTiles, tileX, tileZ } from '../src/sim/path.js';
import { buildCost, fuseCost, towerStats, towerValue } from '../src/sim/rules.js';

const AGE_IDS = ['steinzeit', 'rom', 'mittelalter', 'entdecker', 'industrie', 'zukunft'];
const ROLE_IDS = ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber'];
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Die Inhalte aller sechs Zeitalter, soweit die Rechenregeln sie brauchen. */
const FULL = /** @type {import('../src/types/content').Content} */ (/** @type {unknown} */ ({ archetypes: ARCHETYPES, balance: BALANCE }));
/** Geschossmodelle laut Anhang A des Spielentwurfs. */
const SHOT_MODELS = ['kiesel', 'pfeil', 'bolzen', 'felsbrocken', 'tontopf', 'steinkugel', 'bombe', 'rakete', 'klecks', 'amphore', 'speer', 'eisenbolzen'].map((n) => `shot.${n}`);
/** Requisiten laut Anhang A, dazu je Zeitalter block, deko1, deko2. */
const PROPS = {
  steinzeit: ['urzeitbaum', 'farnbusch', 'findling', 'fellzelt', 'mammutrippen', 'malfels', 'lagerfeuer', 'trockengestell'],
  rom: ['zypresse', 'saeule', 'aquaedukt', 'olivenbaum', 'pergola', 'statue', 'amphoren', 'mosaik'],
  mittelalter: ['fachwerkhaus', 'windmuehle', 'tanne', 'heuhaufen', 'zinnenmauer', 'brunnen', 'marktstand', 'weizenfeld'],
  entdecker: ['palme', 'leuchtturm', 'steg', 'faesser', 'schatztruhe', 'kanonenkugeln', 'kontor', 'segelschiff'],
  industrie: ['fabrikhalle', 'schornstein', 'gaslaterne', 'gasometer', 'wasserturm', 'kohlehaufen', 'gueterwaggon', 'reihenhaus'],
  zukunft: ['windrad', 'solarfeld', 'farm', 'ladesaeule', 'holotafel', 'landeplatz', 'stadtbaum', 'wohnturm'],
};
/**
 * Gegner und Boss je Zeitalter laut Anhang A.
 * @type {Record<string, [string[], string]>}
 */
const CAST = {
  steinzeit: [['keule', 'wolf', 'frischling', 'nashorn'], 'mammut'],
  rom: [['plaenkler', 'reiter', 'legionaer', 'testudo'], 'feldherr'],
  mittelalter: [['knecht', 'strauchdieb', 'ritter', 'spielmann'], 'schwarzritter'],
  entdecker: [['pirat', 'aeffchen', 'kuerassier', 'papagei'], 'landgaleone'],
  industrie: [['halunke', 'hochrad', 'ballon', 'dampfwagen'], 'berta'],
  zukunft: [['wachroboter', 'roboterhund', 'drohne', 'schildwagen'], 'goliath'],
};

/**
 * Zwischenbosse der aktiven Zeitalter (Welle 5, in Welle 10 noch einmal als Geleit) und das Modell, das sie sich leihen.
 * @type {Record<string, [string, string]>}
 */
const MID_BOSS = {
  steinzeit: ['leitwolf', 'wolf'],
  rom: ['zenturio', 'legionaer'],
  mittelalter: ['raubritter', 'ritter'],
  entdecker: ['flint', 'papagei'],
  industrie: ['kohlenbaron', 'dampfwagen'],
  zukunft: ['prototyp', 'schildwagen'],
};

/**
 * @param {unknown} value
 * @param {string} where
 */
function assertHex(value, where) {
  assert.ok(typeof value === 'string' && HEX.test(value), `${where}: "${value}" ist keine Farbe der Form #rrggbb`);
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} where
 */
function assertRange(value, min, max, where) {
  assert.ok(typeof value === 'number' && Number.isFinite(value), `${where}: ${value} ist keine endliche Zahl`);
  assert.ok(value >= min && value <= max, `${where}: ${value} liegt nicht in [${min}, ${max}]`);
}

/**
 * @param {unknown} value
 * @param {string} where
 */
function assertText(value, where) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `${where}: Text fehlt`);
}

/**
 * Prüft jede Zahl in einem verschachtelten Wert auf Endlichkeit.
 * @param {unknown} value
 * @param {string} where
 */
function assertFiniteDeep(value, where) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: ${value} ist keine endliche Zahl`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertFiniteDeep(v, `${where}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFiniteDeep(v, `${where}.${k}`);
}

/**
 * @param {string[]} list
 * @param {string} where
 */
function assertUnique(list, where) {
  const seen = new Set();
  for (const item of list) {
    assert.ok(!seen.has(item), `${where}: "${item}" kommt doppelt vor`);
    seen.add(item);
  }
}

/**
 * Kampfwerte nach docs/SIM.md über alle sechs Zeitalter (die Regel selbst prüft tests/rules.test.mjs).
 * @param {import('../src/types/content').TowerArchetypeDef} arch
 * @param {number} tier
 * @param {number} level
 * @param {{ branch?: number, super?: boolean, gifts?: string[], giftBranches?: number[] }} [opts]
 */
function stats(arch, tier, level, opts) {
  return towerStats(FULL, arch, tier, level, opts);
}

/**
 * Gemeinsame Grenzen für jeden Stand eines Turms, auch für Superwaffen.
 * @param {import('../src/types/content').TowerStats} s
 * @param {string} where
 * @param {boolean} fused
 */
function assertSaneStats(s, where, fused) {
  assertFiniteDeep(s, where);
  assert.ok(s.cooldown > (s.attack === 'beam' ? 0.05 : 0.2), `${where}: cooldown ${s.cooldown}`);
  assertRange(s.range, 1, fused ? 10 : 8, `${where}: range`);
  assertRange(s.minRange, 0, 0, `${where}: kein Mindestabstand`);
  assertRange(s.slow, 0, 0.75, `${where}: slow`);
  assertRange(s.pierce, 0, 1, `${where}: pierce`);
  assertRange(s.splash, 0, fused ? 2.6 : 2, `${where}: splash`);
  assertRange(s.auraRate, 0, fused ? 0.75 : 0.6, `${where}: auraRate`);
  assertRange(s.auraDamage, 0, fused ? 0.6 : 0.3, `${where}: auraDamage`);
  assertRange(s.auraRange, 0, fused ? 0.6 : 0.3, `${where}: auraRange`);
  assertRange(s.chain, 0, fused ? 12 : 6, `${where}: chain`);
  assert.ok(Number.isInteger(s.chain), `${where}: chain ist nicht ganzzahlig`);
  assert.ok(s.damage >= 0 && s.dot >= 0, `${where}: Schaden`);
  if (s.attack === 'projectile') assertRange(s.projectileSpeed, 3, 20, `${where}: projectileSpeed`);
  if (s.attack === 'none') assert.ok(s.auraRate > 0 || s.auraDamage > 0 || s.auraRange > 0, `${where}: Unterstützer ohne Aura`);
  else {
    assert.ok(s.hitsGround || s.hitsAir, `${where}: trifft nichts`);
    assert.ok(s.auraRate === 0 && s.auraDamage === 0 && s.auraRange === 0, `${where}: Angreifer mit Aura`);
  }
  if (s.zone > 0) assert.ok(s.splash > 0 && (s.slow > 0 || s.dot > 0), `${where}: Bodenfeld ohne Radius oder Wirkung`);
  if (s.dot > 0) assert.ok(s.dotDuration > 0, `${where}: dotDuration`);
  if (s.slow > 0) assert.ok(s.slowDuration > 0, `${where}: slowDuration`);
  if (s.chain > 0) assert.ok(s.chainRange > 0, `${where}: chain ohne chainRange`);
}

/**
 * Schaden je Sekunde eines Schusses samt Brand auf ein Ziel.
 * @param {import('../src/types/content').TowerStats} s
 */
function dps(s) {
  return s.damage / s.cooldown + s.dot;
}

test('alle Zahlen der Inhalte sind endlich', () => {
  assertFiniteDeep(content, 'content');
});

test('Zeitalter: sechs in der Reihenfolge des Entwurfs, vollständig beschrieben', () => {
  assert.deepEqual(AGES.map((a) => a.id), AGE_IDS);
  AGES.forEach((age) => {
    const where = `Zeitalter "${age.id}"`;
    for (const key of /** @type {const} */ (['name', 'subtitle', 'tagline'])) assertText(age[key], `${where}.${key}`);
    assertHex(age.accent, `${where}.accent`);
    assert.equal(age.baseModel, `base.${age.id}`);
    const light = age.light;
    for (const key of /** @type {const} */ (['skyTop', 'skyHorizon', 'skyBottom', 'sunColor', 'hemiSky', 'hemiGround', 'fogColor'])) assertHex(light[key], `${where}.light.${key}`);
    assert.equal(light.fogColor, light.skyHorizon, `${where}: Nebelfarbe = Horizontfarbe`);
    assertRange(light.sunElevation, 30, 90, `${where}.light.sunElevation`);
    assertRange(light.sunAzimuth, -180, 180, `${where}.light.sunAzimuth`);
    assertRange(light.sunIntensity, 0.4, 3, `${where}.light.sunIntensity`);
    assertRange(light.hemiIntensity, 0.5, 2.5, `${where}.light.hemiIntensity`);
    assertRange(light.fogDensity, 0, 0.02, `${where}.light.fogDensity`);
    // Richtwert des Auftrags: Sonne auf waagerechter Fläche plus Umgebungslicht.
    const flat = light.sunIntensity * Math.sin((light.sunElevation * Math.PI) / 180) + light.hemiIntensity;
    assertRange(flat, age.id === 'zukunft' ? 1.6 : 2.6, age.id === 'zukunft' ? 2.4 : 3.5, `${where}: Helligkeit einer besonnten Fläche`);
    for (const [key, value] of Object.entries(age.terrain)) assertHex(value, `${where}.terrain.${key}`);
    assertHex(age.abyss.color, `${where}.abyss.color`);
    assertHex(age.abyss.color2, `${where}.abyss.color2`);
    assertHex(age.particles.color, `${where}.particles.color`);
    assertRange(age.particles.density, 0, 1, `${where}.particles.density`);
    assertRange(age.music.tempo, 60, 140, `${where}.music.tempo`);
    assertRange(age.music.root, 36, 72, `${where}.music.root`);
    assertRange(age.music.energy, 0, 1, `${where}.music.energy`);
    assert.ok(age.music.scale.length >= 5 && age.music.scale[0] === 0, `${where}.music.scale`);
    for (let i = 1; i < age.music.scale.length; i++) assert.ok(age.music.scale[i] > age.music.scale[i - 1] && age.music.scale[i] < 12, `${where}.music.scale steigt innerhalb einer Oktave`);
    assertRange(age.bloom, 0.2, 0.85, `${where}.bloom`);
    assertRange(age.scatterCount, 20, 120, `${where}.scatterCount`);
    assertRange(age.fieldCount, 10, 80, `${where}.fieldCount`);
  });
  // Die Sonne wandert von Osten über Süden nach Westen.
  const azimuths = AGES.slice(0, 5).map((a) => a.light.sunAzimuth);
  for (let i = 1; i < azimuths.length; i++) assert.ok(azimuths[i] < azimuths[i - 1], 'die Sonne wandert nach Westen');
  assertUnique(AGES.map((a) => a.name), 'Namen der Zeitalter');
});

test('Zeitalter: Der Weg hebt sich vom Boden ab und hat eine helle Kante', () => {
  /** @param {string} hex */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  /** @param {string} hex */
  const luminance = (hex) => {
    const c = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (const age of AGES) {
    const t = age.terrain;
    const path = rgb(String(t.path));
    for (const ground of [t.groundA, t.groundB]) {
      // Die Paletten des Entwurfs trennen Weg und Boden teils über den Farbton statt über die Helligkeit;
      // geprüft wird deshalb der Farbabstand (0..441), die Helligkeit trägt die Kante.
      const g = rgb(String(ground));
      const distance = Math.hypot(path[0] - g[0], path[1] - g[1], path[2] - g[2]);
      assert.ok(distance >= 45, `Zeitalter "${age.id}": Weg ${t.path} und Boden ${ground} liegen zu dicht beieinander (${distance.toFixed(0)})`);
      assert.ok(luminance(String(t.pathEdge)) >= 1.15 * luminance(String(ground)), `Zeitalter "${age.id}": Die Wegkante ist nicht heller als der Boden ${ground}`);
    }
    assert.ok(luminance(String(t.pathEdge)) >= 1.25 * luminance(String(t.path)), `Zeitalter "${age.id}": Die Wegkante ist nicht deutlich heller als der Weg`);
  }
});

test('Dekoration: nur Requisiten des eigenen Zeitalters, mit Füller für gesperrte Felder und Bodendeko', () => {
  for (const age of AGES) {
    const allowed = new Set([...PROPS[/** @type {keyof typeof PROPS} */ (age.id)], 'block', 'deko1', 'deko2'].map((n) => `prop.${age.id}.${n}`));
    const zones = { shore: 0, rim: 0, field: 0, far: 0, block: 0 };
    for (const rule of age.scatter) {
      const where = `Zeitalter "${age.id}", Regel "${rule.model}"`;
      assert.ok(allowed.has(rule.model), `${where}: unbekanntes oder fremdes Requisit`);
      assert.ok(rule.weight > 0, `${where}: weight`);
      const scale = rule.scale ?? [0.85, 1.2];
      assert.ok(scale[0] > 0 && scale[0] <= scale[1], `${where}: scale`);
      assert.ok(rule.cluster === undefined || (Number.isInteger(rule.cluster) && rule.cluster >= 1), `${where}: cluster`);
      zones[rule.zone ?? 'shore'] += 1;
    }
    assert.ok(zones.block >= 1, `Zeitalter "${age.id}" braucht eine Regel für gesperrte Felder`);
    assert.ok(zones.field >= 2 && zones.field <= 3, `Zeitalter "${age.id}" braucht zwei oder drei Sorten Bodendeko`);
    assert.ok(zones.shore >= 4, `Zeitalter "${age.id}" braucht Dekoration am Ufer`);
    assert.ok(age.scatter.some((r) => r.model === `prop.${age.id}.block` && r.zone === 'block'));
    // Jedes Requisit des Anhangs kommt vor.
    for (const name of PROPS[/** @type {keyof typeof PROPS} */ (age.id)]) {
      assert.ok(age.scatter.some((r) => r.model === `prop.${age.id}.${name}`), `Zeitalter "${age.id}": Requisit "${name}" wird nirgends verstreut`);
    }
  }
});

test('Türme: sechs Rollen mit je sechs Ausprägungen, freigeschaltet mit den Wellen 1 bis 6', () => {
  assert.deepEqual(ARCHETYPES.map((a) => a.id), ROLE_IDS);
  assert.deepEqual(ARCHETYPES.map((a) => a.unlockWave), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(ARCHETYPES.map((a) => a.cost), [60, 90, 70, 110, 100, 120]);
  assert.deepEqual(ARCHETYPES.map((a) => a.color), ['#3D7DD8', '#E8842A', '#26B5A8', '#8A55D6', '#D8432F', '#F2C230']);
  /** @type {string[]} */
  const models = [];
  /** @type {string[]} */
  const names = [];
  for (const arch of ARCHETYPES) {
    const where = `Rolle "${arch.id}"`;
    assertText(arch.role, `${where}.role`);
    assertText(arch.summary, `${where}.summary`);
    assertText(arch.icon, `${where}.icon`);
    assert.equal(arch.tiers.length, AGES.length, `${where}: eine Ausprägung je Zeitalter`);
    assert.ok(arch.levels && arch.levels.length === 3, `${where}: levels`);
    arch.tiers.forEach((tier, age) => {
      assert.ok(tier, `${where}: Ausprägung für ${AGE_IDS[age]} fehlt`);
      if (!tier) return;
      const at = `${where}, ${AGE_IDS[age]}`;
      assertText(tier.name, `${at}.name`);
      assertText(tier.flavor, `${at}.flavor`);
      assert.equal(tier.model, `tower.${AGE_IDS[age]}.${arch.id}`);
      models.push(tier.model);
      names.push(tier.name);
      assertHex(tier.shot.color, `${at}.shot.color`);
      if (tier.shot.kind === 'model') {
        assert.ok(tier.shot.model && SHOT_MODELS.includes(tier.shot.model), `${at}: Geschossmodell "${tier.shot.model}" steht nicht im Anhang A`);
      } else {
        assert.equal(tier.shot.model, undefined, `${at}: Geschossmodell nur bei kind 'model'`);
      }
      if (tier.shot.arc !== undefined) assertRange(tier.shot.arc, 0, 2.5, `${at}.shot.arc`);
    });
  }
  assert.equal(models.length, 36);
  assertUnique(models, 'Turmmodelle');
  assertUnique(names, 'Turmnamen');
  // Jedes Geschossmodell des Anhangs wird benutzt.
  const used = new Set(ARCHETYPES.flatMap((a) => a.tiers.map((t) => t?.shot.model)));
  for (const model of SHOT_MODELS) assert.ok(used.has(model), `Geschossmodell "${model}" wird von keinem Turm benutzt`);
});

test('Türme: Werte aller Stände (Stufe 1, 2 und beide Zweige der Stufe 3) liegen in sinnvollen Bereichen', () => {
  for (const arch of ARCHETYPES) {
    for (let tier = 0; tier < AGES.length; tier++) {
      const s1 = stats(arch, tier, 1);
      const s2 = stats(arch, tier, 2);
      assertSaneStats(s1, `${arch.id}, ${AGE_IDS[tier]}, Stufe 1`, false);
      assertSaneStats(s2, `${arch.id}, ${AGE_IDS[tier]}, Stufe 2`, false);
      assert.ok(s1.chain === 0 || s1.splash === 0, `${arch.id}: Kette und Fläche zugleich`);
      // Ausbauen schwächt nie.
      assert.ok(dps(s2) >= dps(s1) - 1e-9, `${arch.id}, ${AGE_IDS[tier]}: Stufe 2 macht weniger Schaden je Sekunde`);
      for (const key of /** @type {const} */ (['dot', 'range', 'slow', 'splash', 'zone', 'auraRate', 'auraRange', 'auraDamage', 'chain'])) {
        assert.ok(s2[key] >= s1[key] - 1e-9, `${arch.id}, ${AGE_IDS[tier]}, Stufe 2: ${key} sinkt`);
      }
      for (const branch of [0, 1]) {
        const s3 = stats(arch, tier, 3, { branch });
        const where = `${arch.id}, ${AGE_IDS[tier]}, Stufe 3, Zweig ${branch}`;
        assertSaneStats(s3, where, false);
        assert.ok(s3.chain === 0 || s3.splash === 0, `${where}: Kette und Fläche zugleich`);
        // Ein Zweig darf tauschen (z. B. Schusspause gegen Wucht), aber nie unter die Stufe 2 fallen.
        assert.ok(dps(s3) >= dps(s2) * 1.2 - 1e-9 || s3.damage + s3.dot === 0, `${where}: kaum mehr Schaden je Sekunde als Stufe 2`);
        for (const key of /** @type {const} */ (['dot', 'range', 'slow', 'splash', 'zone', 'auraRate', 'auraRange', 'auraDamage', 'chain'])) {
          assert.ok(s3[key] >= s2[key] - 1e-9, `${where}: ${key} sinkt von ${s2[key]} auf ${s3[key]}`);
        }
        // Modernisieren schwächt nie.
        if (tier > 0) {
          const p = stats(arch, tier - 1, 3, { branch });
          assert.ok(dps(s3) >= dps(p) - 1e-9, `${where}: weniger Schaden je Sekunde als im Zeitalter davor`);
          for (const key of /** @type {const} */ (['range', 'slow', 'splash', 'zone', 'auraRate', 'auraRange', 'auraDamage', 'chain'])) {
            assert.ok(s3[key] >= p[key] - 1e-9, `${where}: ${key} sinkt beim Modernisieren`);
          }
        }
      }
    }
  }
});

test('Türme: die Rollen des Entwurfs (Kapitel 2.2)', () => {
  const [schuetze, werfer, bremser, knacker, brenner, taktgeber] = ARCHETYPES;
  // Schütze: 10 Schaden alle 1,25 s, Reichweite 3; ab den Entdeckern sofort; Doppelschuss: doppelte Feuerrate, insgesamt x2,5.
  assert.deepEqual([schuetze.stats.damage, schuetze.stats.cooldown, schuetze.stats.range, schuetze.stats.hitsAir], [10, 1.25, 3, true]);
  assert.deepEqual(AGE_IDS.map((_, t) => stats(schuetze, t, 1).attack), ['projectile', 'projectile', 'projectile', 'hitscan', 'hitscan', 'hitscan']);
  const s1 = stats(schuetze, 0, 1);
  const s3 = stats(schuetze, 0, 3, { branch: 0 });
  assert.equal(s3.cooldown, s1.cooldown / 2);
  assert.ok(Math.abs(s3.damage / s3.cooldown - 2.5 * (s1.damage / s1.cooldown)) < 1e-9);
  // Scharfschütze: seltener, härter, weiter.
  const sniper = stats(schuetze, 0, 3, { branch: 1 });
  assert.ok(sniper.cooldown >= 3 * s3.cooldown && sniper.damage >= 3 * s3.damage && sniper.range >= 1.3 * s3.range);
  // Werfer: 20 Schaden, alle 2,5 s, Reichweite 3,5, Radius 1,0, nur Boden. Großkaliber: Radius 1,4. Schnelllader: schneller.
  assert.deepEqual([werfer.stats.damage, werfer.stats.cooldown, werfer.stats.range, werfer.stats.splash, werfer.stats.hitsAir], [20, 2.5, 3.5, 1, false]);
  assert.deepEqual([stats(werfer, 0, 3, { branch: 0 }).splash, stats(werfer, 0, 3, { branch: 0 }).cooldown], [1.4, 2.5]);
  assert.equal(stats(werfer, 0, 3, { branch: 1 }).splash, 1);
  assert.ok(stats(werfer, 0, 3, { branch: 1 }).cooldown <= 0.7 * 2.5);
  // Bremser: Pfütze als Bodenfeld, kein Schaden.
  assert.deepEqual([bremser.stats.damage, bremser.stats.cooldown, bremser.stats.range, bremser.stats.splash, bremser.stats.zone, bremser.stats.slow, bremser.stats.slowDuration, bremser.stats.hitsAir], [0, 3.5, 2.5, 0.9, 3, 0.3, 1, false]);
  assert.deepEqual(AGE_IDS.map((_, t) => stats(bremser, t, 1).slow), [0.3, 0.35, 0.4, 0.45, 0.5, 0.55]);
  // Die Verlangsamung wächst je Zeitalter UND je Stufe (8 und 15 Punkte), in beiden Zweigen.
  for (const branch of [0, 1]) {
    AGE_IDS.forEach((_, t) => {
      assert.ok(Math.abs(stats(bremser, t, 2).slow - (0.3 + 0.05 * t + 0.08)) < 1e-9);
      assert.ok(Math.abs(stats(bremser, t, 3, { branch }).slow - (0.3 + 0.05 * t + 0.15)) < 1e-9);
    });
  }
  // Großer Teich: Radius 1,2 und 4 s. Ätzpfütze: normale Größe, dafür Schaden über Zeit.
  const pond = stats(bremser, 0, 3, { branch: 0 });
  const acid = stats(bremser, 0, 3, { branch: 1 });
  assert.deepEqual([pond.splash, pond.zone, pond.dot], [1.2, 4, 0]);
  assert.deepEqual([acid.splash, acid.zone], [0.9, 3]);
  assert.ok(acid.dot > 0 && acid.dotDuration > 0 && acid.damage === 0);
  assert.deepEqual(bremser.levels?.map((l) => l.slow), [undefined, 0.38, 0.45]);
  // Panzerknacker: 40 Schaden, alle 3,3 s, Reichweite 4,5, ignoriert Rüstung, zielt auf den Stärksten.
  // Durchschuss: ein zweiter Gegner. Kettenschlag: drei weitere, kürzere Sprünge, etwas schwächer.
  assert.deepEqual([knacker.stats.damage, knacker.stats.cooldown, knacker.stats.range, knacker.stats.pierce, knacker.stats.hitsAir, knacker.defaultMode], [40, 3.3, 4.5, 1, true, 'strong']);
  assert.deepEqual(AGE_IDS.map((_, t) => stats(knacker, t, 1).attack), ['projectile', 'projectile', 'projectile', 'hitscan', 'hitscan', 'hitscan']);
  assert.deepEqual([stats(knacker, 0, 1).chain, stats(knacker, 0, 2).chain, stats(knacker, 0, 3, { branch: 0 }).chain, stats(knacker, 0, 3, { branch: 1 }).chain], [0, 0, 1, 3]);
  assert.ok(stats(knacker, 0, 3, { branch: 1 }).chainRange < stats(knacker, 0, 3, { branch: 0 }).chainRange);
  assert.ok(stats(knacker, 0, 3, { branch: 1 }).damage < stats(knacker, 0, 3, { branch: 0 }).damage);
  // Brenner: sofortiger Flammenstoß mit Fläche und Brand.
  assert.deepEqual([brenner.stats.attack, brenner.stats.damage, brenner.stats.cooldown, brenner.stats.range, brenner.stats.splash, brenner.stats.dot, brenner.stats.dotDuration, brenner.stats.hitsAir], ['hitscan', 4, 1, 1.8, 0.9, 12, 3, false]);
  // Flächenbrand: Radius 1,2. Weißglut: kleiner Radius, Brand stärker und länger.
  const wide = stats(brenner, 0, 3, { branch: 0 });
  const hot = stats(brenner, 0, 3, { branch: 1 });
  assert.deepEqual([wide.splash, wide.dotDuration, hot.splash], [1.2, 3, 0.9]);
  assert.ok(hot.dot >= 1.3 * wide.dot && hot.dotDuration >= 2 * wide.dotDuration);
  assert.equal(stats(brenner, 5, 1).dot, 12 * 32);
  // Taktgeber: Aura auf die acht Nachbarfelder.
  assert.deepEqual([taktgeber.stats.attack, taktgeber.stats.range, taktgeber.stats.auraRate, taktgeber.stats.damage], ['none', 1.5, 0.2, 0]);
  assert.deepEqual(AGE_IDS.map((_, t) => stats(taktgeber, t, 1).auraRate), [0.2, 0.23, 0.26, 0.29, 0.32, 0.35]);
  assert.deepEqual(taktgeber.levels?.map((l) => l.auraRate), [undefined, 0.28, 0.35]);
  AGE_IDS.forEach((_, t) => assert.ok(Math.abs(stats(taktgeber, t, 3, { branch: 0 }).auraRate - (0.2 + 0.03 * t + 0.15)) < 1e-9));
  // Fernsicht gibt Reichweite, Kriegstrommel Schaden; nie beides.
  const far = stats(taktgeber, 0, 3, { branch: 0 });
  const drum = stats(taktgeber, 0, 3, { branch: 1 });
  assert.ok(far.auraRange > 0 && far.auraDamage === 0 && drum.auraDamage > 0 && drum.auraRange === 0);
  for (const s of [stats(taktgeber, 0, 1), stats(taktgeber, 0, 2), far, drum]) {
    assert.ok(s.range >= Math.SQRT2 && s.range < 2, 'die Aura erreicht genau die acht Nachbarfelder');
  }
});

test('Gegner: vier je Zeitalter und ein Boss, Kennungen und Modelle laut Anhang A', () => {
  const list = Object.values(ENEMIES);
  assert.equal(list.length, 30 + Object.keys(MID_BOSS).length);
  for (const [key, def] of Object.entries(ENEMIES)) assert.equal(def.id, key, `Gegner "${key}" trägt die Kennung "${def.id}"`);
  const mids = new Set(Object.values(MID_BOSS).map(([id]) => id));
  assertUnique(list.filter((d) => !mids.has(d.id)).map((d) => d.model), 'Gegnermodelle');
  // Zwischenbosse: Boss ohne eigenes Modell, sichtbar größer, zwischen Gegner und Endboss.
  for (const [age, [id, borrowed]] of Object.entries(MID_BOSS)) {
    const def = ENEMIES[id];
    assert.ok(def, `Zwischenboss "${id}" fehlt`);
    assert.deepEqual([def.age, def.model, def.boss], [age, `enemy.${age}.${borrowed}`, true]);
    assertRange(def.scale ?? 1, 1.5, 1.9, `Zwischenboss "${id}".scale`);
    const finalBoss = ENEMIES[CAST[age][1]];
    assert.ok(def.hp < finalBoss.hp && def.lives > 1 && def.lives < finalBoss.lives && def.bounty < finalBoss.bounty, `Zwischenboss "${id}": zwischen Gegner und Endboss`);
  }
  assertUnique(list.map((d) => d.name), 'Gegnernamen');
  for (const age of AGE_IDS) {
    const [normal, boss] = CAST[age];
    for (const id of normal) {
      assert.ok(ENEMIES[id], `Gegner "${id}" fehlt`);
      assert.deepEqual([ENEMIES[id].age, ENEMIES[id].model, ENEMIES[id].boss], [age, `enemy.${age}.${id}`, false]);
    }
    assert.ok(ENEMIES[boss], `Boss "${boss}" fehlt`);
    assert.deepEqual([ENEMIES[boss].age, ENEMIES[boss].model, ENEMIES[boss].boss], [age, `boss.${age}.${boss}`, true]);
    // Der erste Gegner jedes Zeitalters ist sein Standardgegner.
    const standard = ENEMIES[normal[0]];
    assert.deepEqual([standard.hp, standard.bounty, standard.armor, standard.lives], [1, 1, 0, 1]);
  }
  for (const def of list) {
    const where = `Gegner "${def.id}"`;
    assertText(def.name, `${where}.name`);
    assertText(def.description, `${where}.description`);
    assertHex(def.color, `${where}.color`);
    assertRange(def.hp, 0.2, 50, `${where}.hp`);
    assertRange(def.speed, 0.3, 4, `${where}.speed`);
    assertRange(def.armor, 0, 1.2, `${where}.armor`);
    assertRange(def.shield, 0, 1, `${where}.shield`);
    assertRange(def.regen, 0, 0, `${where}.regen (laut Entwurf keine Selbstheilung)`);
    assertRange(def.slowResist, 0, 1, `${where}.slowResist`);
    assertRange(def.lives, 1, 10, `${where}.lives`);
    assertRange(def.radius ?? 0.25, 0.1, 0.6, `${where}.radius`);
    // Mindestens 2 Gold in jedem Zeitalter, in dem der Gegner auftritt.
    const ageIndex = AGE_IDS.indexOf(def.age);
    assert.ok(Math.round(BALANCE.baseBounty * BALANCE.ageBounty[ageIndex] * def.bounty) >= 2, `${where}: Kopfgeld unter 2 Gold`);
    if (def.boss && Object.values(MID_BOSS).some(([id]) => id === def.id)) {
      // Ein Zwischenboss fliegt, wenn der Gegner fliegt, dessen Modell er trägt (Käpt'n Flint, der Riesenpapagei der Entdecker).
      const borrowed = Object.values(MID_BOSS).find(([id]) => id === def.id)?.[1] ?? '';
      assert.deepEqual([def.lives, def.slowResist, def.bounty, def.flying], [5, 0.5, 8, ENEMIES[borrowed].flying], `${where}: Werte eines Zwischenbosses`);
    } else if (def.boss) {
      assert.deepEqual([def.lives, def.slowResist, def.bounty, def.flying], [10, 0.5, 20, false], `${where}: Bosswerte`);
    } else if (def.hp !== 1 && def.id !== 'frischling') {
      assert.ok(Math.abs(def.bounty - def.hp * 0.8) < 1e-9, `${where}: Kopfgeld = Lebenspunkte x 0,8`);
    }
    for (const spawn of [def.spawns, ...(def.phases ?? []).map((p) => p.spawns)]) {
      if (!spawn) continue;
      assert.ok(ENEMIES[spawn.enemy], `${where}: setzt den unbekannten Gegner "${spawn.enemy}" aus`);
      assert.equal(ENEMIES[spawn.enemy].age, def.age, `${where}: Fracht aus fremdem Zeitalter`);
      assert.ok(!ENEMIES[spawn.enemy].boss && !ENEMIES[spawn.enemy].spawns, `${where}: Fracht darf weder Boss noch Träger sein`);
      assert.ok(Number.isInteger(spawn.count) && spawn.count > 0);
    }
    if (def.phases) {
      for (let i = 0; i < def.phases.length; i++) {
        assertRange(def.phases[i].at, 0.05, 0.95, `${where}.phases[${i}].at`);
        if (i > 0) assert.ok(def.phases[i].at < def.phases[i - 1].at, `${where}: phases absteigend nach at`);
        if (def.phases[i].speed !== undefined) assert.ok((def.phases[i].duration ?? 0) > 0, `${where}: Tempo-Schub ohne Dauer`);
      }
    }
    if (def.heal) assert.deepEqual(def.heal, { radius: 1.5, perSecond: 0.03 });
  }
  // Angekündigte Boss-Momente: genau diese vier, dazu der Kohlenbaron (Zwischenboss), der bei halber Kraft Hochräder freilässt. Die Landgaleone lässt früher los als der Goliath, damit ihre Papageien nicht erst
  // kurz vor der Flamme aufsteigen.
  assert.deepEqual(list.filter((d) => d.phases).map((d) => d.id).sort(), ['berta', 'goliath', 'kohlenbaron', 'landgaleone', 'schwarzritter']);
  assert.deepEqual(ENEMIES.goliath.phases?.map((p) => p.at), [0.75, 0.5, 0.25]);
  assert.deepEqual(ENEMIES.landgaleone.phases?.map((p) => [p.at, p.spawns?.enemy, p.spawns?.count]), [[0.85, 'papagei', 3], [0.6, 'papagei', 3], [0.35, 'papagei', 3]]);
  // Eigenschaften je Zeitalter.
  assert.deepEqual(list.filter((d) => d.flying).map((d) => d.id).sort(), ['ballon', 'drohne', 'flint', 'papagei']);
  assert.deepEqual(list.filter((d) => d.heal).map((d) => d.id), ['spielmann']);
  assert.deepEqual(list.filter((d) => d.shield > 0).map((d) => d.id).sort(), ['goliath', 'prototyp', 'schildwagen']);
  assert.deepEqual(list.filter((d) => d.spawns).map((d) => d.id).sort(), ['berta', 'dampfwagen', 'kohlenbaron']);
  assert.ok(list.filter((d) => d.age === 'steinzeit').every((d) => d.armor === 0), 'Rüstung gibt es erst ab Rom');
});

/**
 * Grobes Maß dafür, wie viel Druck ein Gegner macht: Lebenspunkte und Schild mal Tempo, dazu Zuschläge für Rüstung,
 * Heilen und Fliegen sowie seine Fracht.
 * @param {import('../src/types/content').EnemyDef} def
 * @returns {number}
 */
function threat(def) {
  let cargo = 0;
  for (const spawn of [def.spawns, ...(def.phases ?? []).map((p) => p.spawns)]) {
    if (spawn) cargo += spawn.count * threat(ENEMIES[spawn.enemy]);
  }
  return def.hp * (1 + def.shield) * def.speed * (1 + (def.armor / 0.3) * 0.5) * (def.heal ? 1.5 : 1) * (def.flying ? 1.3 : 1) + cargo;
}

test('Wellen: aktive Zeitalter haben zehn, ruhende sechs; Bosse nur in Welle 5 (Zwischenboss) und in der letzten', () => {
  assert.equal(WAVES.length, AGES.length);
  WAVES.forEach((list, age) => {
    const active = ACTIVE_AGES.includes(AGE_IDS[age]);
    assert.equal(list.length, active ? 10 : 6, `Zeitalter "${AGE_IDS[age]}": Zahl der Wellen`);
    const last = list.length - 1;
    /** @type {Set<string>} */
    const seenEarly = new Set();
    /** @type {string[]} */
    const shapes = [];
    list.forEach((wave, w) => {
      const where = `Zeitalter "${AGE_IDS[age]}", Welle ${w + 1}`;
      assertText(wave.hint, `${where}.hint`);
      assert.ok(wave.hint.length <= 90, `${where}: Hinweis zu lang`);
      assert.ok(wave.groups.length > 0, `${where}: keine Gegner`);
      let bosses = 0;
      let mid = 0;
      let end = 0;
      let start = Infinity;
      /** @type {Record<string, number>} */
      const counts = {};
      for (const group of wave.groups) {
        const def = ENEMIES[group.enemy];
        assert.ok(def, `${where}: unbekannter Gegner "${group.enemy}"`);
        assert.equal(def.age, AGE_IDS[age], `${where}: "${group.enemy}" gehört in ein anderes Zeitalter`);
        assert.ok(Number.isInteger(group.count) && group.count >= 1, `${where}: count`);
        assert.ok(group.delay >= 0 && group.interval >= 0, `${where}: delay/interval`);
        assert.ok(group.count === 1 || group.interval >= 0.3, `${where}: Gegner derselben Gruppe erscheinen zu dicht`);
        assert.equal(group.path, undefined, `${where}: Wellen gelten für alle Karten und nennen keinen Weg`);
        if (def.boss && def.id === CAST[AGE_IDS[age]][1]) bosses += group.count;
        if (def.boss && def.id !== CAST[AGE_IDS[age]][1]) {
          assert.equal(def.id, MID_BOSS[AGE_IDS[age]]?.[0], `${where}: fremder Boss "${def.id}"`);
          assert.ok(w === 4 || w === last, `${where}: Zwischenboss nur in Welle 5 und in der Bosswelle`);
          mid += group.count;
        }
        if (w < 4) seenEarly.add(def.id);
        counts[def.id] = (counts[def.id] ?? 0) + group.count;
        start = Math.min(start, group.delay);
        end = Math.max(end, group.delay + (group.count - 1) * group.interval);
      }
      assert.equal(bosses, w === last ? 1 : 0, `${where}: ${bosses} Bosse`);
      if (active && w === 4) assert.equal(mid, 1, `${where}: kein Zwischenboss`);
      assert.equal(start, 0, `${where}: Der erste Gegner erscheint sofort`);
      // Welle 1 folgt der ausdrücklichen Angabe des Entwurfs (8 Gegner, einer alle 2 s) und ist deshalb kürzer.
      assertRange(end, age === 0 && w === 0 ? 14 : 24, 45, `${where}: Dauer des Erscheinens`);
      shapes.push(Object.keys(counts).sort().map((id) => `${id}x${counts[id]}`).join(' '));
    });
    // Keine zwei Wellen eines Zeitalters haben dieselbe Zusammensetzung.
    assertUnique(shapes, `Zeitalter "${AGE_IDS[age]}": Zusammensetzung der Wellen`);
    assertUnique(list.map((wave) => wave.hint), `Zeitalter "${AGE_IDS[age]}": Hinweise`);
    // Eine neue Eigenschaft taucht nie erst nach Platz 4 auf.
    for (const id of CAST[AGE_IDS[age]][0]) {
      assert.ok(seenEarly.has(id), `Gegner "${id}" tritt erst nach Welle 4 seines Zeitalters auf`);
    }
    // Die erste Welle ist die leichteste, der Ansturm (vorletzte) die dichteste ohne Boss (grobes Maß für den Druck einer Welle).
    const load = list.map((wave) => wave.groups.reduce((sum, g) => sum + g.count * threat(ENEMIES[g.enemy]), 0));
    const shown = load.map((v) => v.toFixed(1)).join(' / ');
    assert.ok(load[0] <= 1.1 * Math.min(...load), `Zeitalter "${AGE_IDS[age]}": Die erste Welle ist nicht die leichteste (${shown})`);
    assert.equal(Math.max(...load.slice(0, last)), load[last - 1], `Zeitalter "${AGE_IDS[age]}": Der Ansturm ist nicht die dichteste Welle (${shown})`);
    if (active) {
      // Elite (Platz 6) und Brocken II (Platz 8): wenige Gegner; Tempo (Platz 7) und Ansturm (Platz 9): viele.
      const heads = list.map((wave) => wave.groups.reduce((sum, g) => sum + g.count, 0));
      assert.ok(heads[5] < heads[6] && heads[7] < heads[6] && heads[7] < heads[8], `Zeitalter "${AGE_IDS[age]}": Rhythmus der Plätze 6 bis 9 (${heads.join(' / ')})`);
      assert.equal(Math.max(...heads), heads[8], `Zeitalter "${AGE_IDS[age]}": Der Ansturm hat nicht die meisten Gegner (${heads.join(' / ')})`);
    }
  });
});

test('Wellen der Partie: jedes aktive Zeitalter hat zehn Wellen und endet mit seinem Boss', () => {
  assert.deepEqual(content.ages.map((a) => a.id), ACTIVE_AGES);
  assert.equal(content.waves.length, ACTIVE_AGES.length);
  content.waves.forEach((list, age) => {
    const id = ACTIVE_AGES[age];
    assert.equal(list.length, 10, `Zeitalter "${id}"`);
    const boss = CAST[id][1];
    list.forEach((wave, w) => {
      for (const group of wave.groups) {
        assert.ok(content.enemies[group.enemy], `Zeitalter "${id}", Welle ${w + 1}: Gegner "${group.enemy}" fehlt in den Inhalten der Partie`);
        assert.equal(content.enemies[group.enemy].age, id);
      }
      assert.equal(wave.groups.some((g) => g.enemy === boss), w === 9, `Zeitalter "${id}", Welle ${w + 1}: Boss "${boss}"`);
    });
  });
  // Die Lernkurve der ersten Partie: Die Wellen 1 bis 6 schalten je eine Rolle frei und bringen deren Anlass mit.
  const stone = content.waves[0];
  /** @param {number} w @param {string} enemy */
  const has = (w, enemy) => stone[w].groups.some((g) => g.enemy === enemy);
  assert.deepEqual(content.archetypes.map((a) => a.unlockWave), [0, 1, 2, 3, 4, 5]);
  assert.ok(stone[0].groups.every((g) => g.enemy === 'keule'), 'Welle 1: nur Keulenschwinger');
  assert.ok(has(1, 'frischling') && !has(1, 'wolf') && !has(1, 'nashorn'), 'Welle 2: Schwarm für den Werfer');
  assert.ok(has(2, 'wolf') && !has(2, 'nashorn'), 'Welle 3: Wölfe für den Bremser');
  assert.ok(has(3, 'nashorn'), 'Welle 4: Nashörner für den Panzerknacker');
  assert.ok(has(4, 'frischling') && has(4, 'wolf') && has(4, 'keule'), 'Welle 5: Menge für den Brenner');
});

test('Zweige: jede Rolle hat zwei vollständige, verschiedene Ausbauzweige', () => {
  /** @type {string[]} */
  const names = [];
  for (const arch of ARCHETYPES) {
    assert.ok(arch.branches && arch.branches.length === 2, `Rolle "${arch.id}": branches`);
    for (const [i, branch] of arch.branches.entries()) {
      const where = `Rolle "${arch.id}", Zweig ${i}`;
      assertText(branch.name, `${where}.name`);
      assertText(branch.summary, `${where}.summary`);
      assert.ok(branch.summary.length <= 130, `${where}: Beschreibung zu lang`);
      assertText(branch.icon, `${where}.icon`);
      assert.ok(/^[a-zA-Z]+$/.test(branch.icon), `${where}.icon`);
      assert.ok(branch.mod && (branch.mod.set || branch.mod.mul || branch.mod.add), `${where}: Zweig ohne Wirkung`);
      names.push(branch.name);
    }
    assert.notEqual(arch.branches[0].icon, arch.branches[1].icon, `Rolle "${arch.id}": beide Zweige tragen dasselbe Symbol`);
    // Die Zweige unterscheiden sich in den Werten, und keiner ist in jedem Feld mindestens so gut wie der andere.
    const a = stats(arch, 0, 3, { branch: 0 });
    const b = stats(arch, 0, 3, { branch: 1 });
    const keys = /** @type {const} */ (['damage', 'range', 'splash', 'slow', 'dot', 'dotDuration', 'chain', 'chainRange', 'zone', 'auraRate', 'auraRange', 'auraDamage']);
    const better = (/** @type {typeof a} */ x, /** @type {typeof a} */ y) => keys.some((k) => x[k] > y[k] + 1e-9) || x.cooldown < y.cooldown - 1e-9;
    assert.ok(better(a, b), `Rolle "${arch.id}": Zweig 0 ist nirgends besser als Zweig 1`);
    assert.ok(better(b, a), `Rolle "${arch.id}": Zweig 1 ist nirgends besser als Zweig 0`);
    // Was früher die Besonderheit der Stufe 3 war, steckt jetzt allein in Zweig 0.
    const plain = stats(arch, 0, 3);
    const l2 = stats(arch, 0, 2);
    for (const key of /** @type {const} */ (['splash', 'zone', 'chain', 'auraRange', 'auraDamage', 'cooldown', 'dotDuration'])) {
      assert.equal(plain[key], l2[key], `Rolle "${arch.id}": levels[2] setzt noch ${key}`);
    }
  }
  assertUnique(names, 'Namen der Zweige');
});

test('Superwaffen: Namen in allen 36 Ausprägungen, Kern und Gabe für jede Rolle', () => {
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const gifts = [];
  for (const arch of ARCHETYPES) {
    arch.tiers.forEach((tier, age) => {
      assert.ok(tier);
      if (!tier) return;
      assertText(tier.superName, `Rolle "${arch.id}", ${AGE_IDS[age]}.superName`);
      assert.ok(String(tier.superName).length <= 18, `Rolle "${arch.id}", ${AGE_IDS[age]}: Name "${tier.superName}" ist zu lang`);
      names.push(String(tier.superName));
      names.push(tier.name);
    });
    const fusion = arch.fusion;
    assert.ok(fusion, `Rolle "${arch.id}": fusion`);
    if (!fusion) continue;
    assert.ok(fusion.core && fusion.gift, `Rolle "${arch.id}": core/gift`);
    assertText(fusion.coreText, `Rolle "${arch.id}".fusion.coreText`);
    assert.ok(fusion.coreText.length <= 140, `Rolle "${arch.id}": Text des Kerns zu lang`);
    // Zwölf Gaben: je Zweig eine; fusion.gift ist die Gabe des Zweigs 0 (Spielstände ohne Zweig der Zutat).
    assert.equal(arch.branches?.length, 2, `Rolle "${arch.id}": zwei Zweige`);
    for (const [index, branch] of (arch.branches ?? []).entries()) {
      const gift = branch.gift;
      assert.ok(gift, `Rolle "${arch.id}", Zweig ${branch.name}: Gabe fehlt`);
      if (!gift) continue;
      assertText(gift.name, `Rolle "${arch.id}", Zweig ${branch.name}: gift.name`);
      assertText(gift.text, `Rolle "${arch.id}", Zweig ${branch.name}: gift.text`);
      assert.ok(gift.text.length <= 140, `Gabe ${gift.name}: Text zu lang (${gift.text.length})`);
      assert.ok(gift.mod.set || gift.mod.mul || gift.mod.add, `Gabe ${gift.name} ohne Wirkung`);
      // Gaben verändern Fläche und Aura nur per mul: kein Einzelschuss bekommt Fläche, kein Angreifer eine Aura.
      for (const part of [gift.mod.set, gift.mod.add]) {
        for (const key of ['splash', 'zone', 'auraRate', 'auraDamage', 'auraRange', 'attack', 'hitsAir', 'hitsGround', 'damage', 'cooldown', 'chainRange']) {
          assert.ok(!part || !(key in part) || (key === 'chainRange' && part === gift.mod.add), `Gabe ${gift.name} setzt oder addiert "${key}"`);
        }
      }
      if (index === 0) assert.deepEqual([fusion.gift, fusion.giftName, fusion.giftText], [gift.mod, gift.name, gift.text], `Rolle "${arch.id}": fusion.gift ist die Gabe des Zweigs 0`);
      gifts.push(gift.name);
    }
  }
  assert.equal(gifts.length, 12);
  assert.equal(names.length, 72);
  assertUnique(names, 'Namen der Türme und Superwaffen');
  assertUnique(gifts, 'Namen der Gaben');
  assert.deepEqual([BALANCE.fusion.parts, BALANCE.fusion.damage, BALANCE.fusion.range, BALANCE.fusion.fee], [2, 3, 1.2, 2.5]);
  // Gebühr: das 2,5-Fache des Baupreises der Kernrolle, auf 5 gerundet.
  assert.equal(fuseCost(FULL, ARCHETYPES[0], 0), 150);
  for (const arch of ARCHETYPES) {
    for (let tier = 0; tier < AGES.length; tier++) {
      const fee = fuseCost(FULL, arch, tier);
      assert.ok(fee > 0 && fee % 5 === 0 && Math.abs(fee - BALANCE.fusion.fee * buildCost(FULL, arch, tier)) <= 2.5 && fee < towerValue(FULL, arch, tier, 3), `Gebühr ${arch.id}, ${AGE_IDS[tier]}: ${fee}`);
    }
  }
});

test('Megawaffen: Namen in allen 36 Ausprägungen, eigene Zahlen in balance.fusion, Gebühr klar über der der Superwaffe', () => {
  /** @type {string[]} */
  const names = [];
  for (const arch of ARCHETYPES) {
    arch.tiers.forEach((tier, age) => {
      assert.ok(tier);
      if (!tier) return;
      const where = `Rolle "${arch.id}", ${AGE_IDS[age]}`;
      assertText(tier.megaName, `${where}.megaName`);
      assert.ok(String(tier.megaName).length <= 20, `${where}: Name "${tier.megaName}" ist zu lang`);
      assert.notEqual(tier.megaName, tier.superName, `${where}: megaName gleich superName`);
      names.push(String(tier.megaName), String(tier.superName), tier.name);
    });
  }
  assert.equal(names.length, 108);
  assertUnique(names, 'Namen der Türme, Superwaffen und Megawaffen');
  const fusion = BALANCE.fusion;
  assert.deepEqual([fusion.megaLimit, fusion.megaDamage, fusion.megaRange, fusion.megaFee], [1, 5, 1.35, 4]);
  assert.ok(fusion.megaDamage > fusion.damage && fusion.megaRange > fusion.range && fusion.megaFee > fusion.fee);
  for (const arch of ARCHETYPES) {
    for (let tier = 0; tier < AGES.length; tier++) {
      const fee = fuseCost(FULL, arch, tier, true);
      assert.ok(fee % 5 === 0 && Math.abs(fee - fusion.megaFee * buildCost(FULL, arch, tier)) <= 2.5 && fee > fuseCost(FULL, arch, tier), `Gebühr der Megawaffe ${arch.id}, ${AGE_IDS[tier]}: ${fee}`);
    }
  }
});

test('Superwaffen: jeder Kern greift anders an, alle Kombinationen aus Kern, Zweig und zwei der zwölf Gaben ergeben sinnvolle Werte', () => {
  /** Angriffsart als Superwaffe je Kernrolle (docs/briefs/fusion.md, 5.1). */
  const ATTACK = { schuetze: 'beam', werfer: 'projectile', bremser: 'pulse', knacker: 'hitscan', brenner: 'pulse', taktgeber: 'none' };
  /** Alle zwölf Gaben als [Rolle, Zweig]. */
  const GIFT_LIST = ARCHETYPES.flatMap((arch) => [0, 1].map((branch) => /** @type {[string, number]} */ ([arch.id, branch])));
  /** @param {[string, number]} g */
  const giftName = (g) => ARCHETYPES.find((a) => a.id === g[0])?.branches?.[g[1]].gift?.name ?? '';
  /**
   * Schaden je Sekunde auf ein Ziel, wie ihn die Angriffsart austeilt (Strahl: `damage` ist schon je Sekunde, ohne Aufheizen).
   * @param {ReturnType<typeof stats>} s
   */
  const dpsOf = (s) => (s.attack === 'beam' ? s.damage : s.damage / s.cooldown) + s.dot;
  /** Felder, die bei einer Angriffsart spürbar sind. */
  const FELT = {
    beam: ['damage', 'range', 'slow', 'slowDuration', 'dot', 'dotDuration', 'pierce', 'ramp', 'rampTime', 'chain', 'chainRange'],
    pulse: ['damage', 'cooldown', 'range', 'slow', 'slowDuration', 'dot', 'dotDuration', 'pierce'],
    projectile: ['damage', 'cooldown', 'range', 'splash', 'slow', 'slowDuration', 'dot', 'dotDuration', 'pierce', 'zone', 'chain', 'chainRange'],
    hitscan: ['damage', 'cooldown', 'range', 'splash', 'slow', 'slowDuration', 'dot', 'dotDuration', 'pierce', 'zone', 'chain', 'chainRange'],
    none: ['range', 'auraRate', 'auraDamage', 'auraRange'],
  };
  /**
   * Ob sich zwei Stände spürbar unterscheiden (Kette nur ohne Fläche, Bodenfeld nur mit Fläche: docs/SIM.md).
   * @param {ReturnType<typeof stats>} a
   * @param {ReturnType<typeof stats>} b
   */
  const differs = (a, b) => FELT[a.attack].some((/** @type {keyof typeof a} */ k) => {
    if ((k === 'chain' || k === 'chainRange') && (a.splash > 0 || a.chain === 0 && b.chain === 0)) return false;
    if (k === 'zone' && a.splash === 0) return false;
    return Math.abs(/** @type {number} */ (a[k]) - /** @type {number} */ (b[k])) > 1e-9;
  });
  let count = 0;
  for (const core of ARCHETYPES) {
    const attack = ATTACK[/** @type {keyof typeof ATTACK} */ (core.id)];
    for (const tier of [0, 1, AGES.length - 1]) {
      for (const branch of [0, 1]) {
        const base = stats(core, tier, 3, { branch });
        for (const g1 of GIFT_LIST) {
          for (const g2 of GIFT_LIST) {
            const s = towerStats(FULL, core, tier, 3, { branch, super: true, gifts: [g1[0], g2[0]], giftBranches: [g1[1], g2[1]] });
            const where = `Superwaffe ${core.id} (${AGE_IDS[tier]}, Zweig ${branch}) mit ${giftName(g1)} + ${giftName(g2)}`;
            assertSaneStats(s, where, true);
            count++;
            // Rezept Flak (tests/recipes.test.mjs): Schützen-Kern mit zwei Schützen trifft sofort mit Fläche statt als Strahl.
            const flak = core.id === 'schuetze' && g1[0] === 'schuetze' && g2[0] === 'schuetze';
            assert.equal(s.attack, flak ? 'hitscan' : attack, `${where}: Angriffsart`);
            assert.equal(s.hitsGround, base.hitsGround, `${where}: Boden`);
            assert.equal(s.hitsAir, base.hitsAir || core.id === 'bremser', `${where}: Flieger`);
            assert.ok(s.range >= 1.2 * base.range - 1e-9, `${where}: Reichweite`);
            if (attack === 'none') assert.equal(s.damage, 0, `${where}: Taktgeber greift an`);
            else if (core.id !== 'bremser') assert.ok(dpsOf(s) >= 2.5 * dpsOf(base) - 1e-9, `${where}: ${dpsOf(s)} je Sekunde gegen ${dpsOf(base)} des Kerns`);
          }
        }
      }
    }
  }
  assert.equal(count, 6 * 3 * 2 * 144);
  // Jede Gabe tut bei jedem Kern etwas, außer wo ihr Text es ausdrücklich ausnimmt.
  for (const core of ARCHETYPES) {
    for (const branch of [0, 1]) {
      const none = towerStats(FULL, core, 1, 3, { branch, super: true, gifts: [] });
      for (const g of GIFT_LIST) {
        const one = towerStats(FULL, core, 1, 3, { branch, super: true, gifts: [g[0]], giftBranches: [g[1]] });
        const gift = ARCHETYPES.find((a) => a.id === g[0])?.branches?.[g[1]].gift;
        const text = gift?.text ?? '';
        const exempt = (core.id === 'taktgeber' && /(Taktgebern|Taktgeber nützt)[^.]* nichts/.test(text))
          || (core.id === 'bremser' && branch === 0 && /reinem Frostpuls nichts/i.test(text));
        assert.equal(differs(none, one), !exempt, `Gabe "${gift?.name}" bei einem Kern "${core.id}" (Zweig ${branch}): Wirkung passt nicht zum Text`);
      }
    }
  }
  // Taktgeber-Kern: Der Takt reicht zwei Felder weit (nicht drei) und gibt Wucht.
  const beat = stats(ARCHETYPES[5], 0, 3, { branch: 0, super: true, gifts: [] });
  assert.ok(beat.range >= Math.hypot(2, 1) && beat.range < Math.hypot(2, 2), `Reichweite des Taktgeber-Kerns: ${beat.range}`);
  assert.ok(beat.auraDamage > 0);
  // Ein Bremser-Kern behält die Verlangsamung seines Zeitalters, auch mit „Kleber“, und sie hält länger.
  const bremser = ARCHETYPES[2];
  for (let tier = 0; tier < AGES.length; tier++) {
    const glue = stats(bremser, tier, 3, { branch: 0, super: true, gifts: ['bremser', 'bremser'] });
    assert.equal(glue.slow, stats(bremser, tier, 3, { branch: 0 }).slow);
    assert.ok(glue.slowDuration > stats(bremser, tier, 3, { branch: 0, super: true, gifts: [] }).slowDuration);
  }
  // Brandsatz: ein Brenner der Stufe 3 als Zugabe (2 Standardschüsse je Sekunde), 3 s lang.
  const fire = towerStats(FULL, ARCHETYPES[0], 1, 3, { branch: 0, super: true, gifts: ['brenner'], giftBranches: [0] });
  assert.deepEqual([fire.dot, fire.dotDuration], [2 * BALANCE.baseDamage * BALANCE.ageDamage[1], 3]);
  // Darstellung: Jede Ausprägung hat einen Angriff als Superwaffe, passend zur Angriffsart des Kerns.
  const KIND = { schuetze: 'beam', werfer: 'model', bremser: 'pulse', knacker: 'bolt', brenner: 'pulse', taktgeber: 'pulse' };
  for (const arch of ARCHETYPES) {
    for (const def of arch.tiers) assert.equal(def?.superShot?.kind, KIND[/** @type {keyof typeof KIND} */ (arch.id)], `${arch.id}: superShot`);
  }
});

test('Balance: Startmodell des Entwurfs, eine Zahl je Zeitalter', () => {
  for (const key of /** @type {const} */ (['ageDamage', 'ageCost', 'ageHp', 'ageBounty'])) {
    assert.equal(BALANCE[key].length, AGES.length, `balance.${key}`);
    assert.equal(BALANCE[key][0], 1, `balance.${key}[0]`);
    for (let i = 1; i < BALANCE[key].length; i++) assert.ok(BALANCE[key][i] > BALANCE[key][i - 1], `balance.${key} steigt`);
  }
  assert.deepEqual(BALANCE.ageDamage, [1, 2, 4, 8, 16, 32]);
  assert.deepEqual(BALANCE.ageCost, [1, 1.8, 3.2, 5.6, 10, 18]);
  // Standard-Lebenspunkte 25 / 260 / 645 / 1455 / 3140 / 6750 mal Druck je Position 1 / 0,85 / 1,15 / 1,2 / 1,8 / 2,15.
  assert.deepEqual(BALANCE.ageHp.map((f) => Math.round(f * BALANCE.baseHp)), [25, 221, 742, 1746, 5652, 14513]);
  assert.deepEqual(BALANCE.ageBounty.map((f) => Math.round(f * BALANCE.baseBounty)), [5, 9, 16, 28, 50, 90]);
  assert.deepEqual([BALANCE.startGold, BALANCE.baseHp, BALANCE.baseBounty, BALANCE.baseDamage], [150, 25, 5, 10]);
  assert.deepEqual([BALANCE.levelDamage, BALANCE.levelCost], [[1, 1.6, 2.5], [0.9, 1.3]]);
  assert.equal(BALANCE.levelRange.length, 3);
  assert.deepEqual([BALANCE.waveHpGrowth, BALANCE.modernizeFactor, BALANCE.sellRefund, BALANCE.burnOnSlowed, BALANCE.minDamage], [0.08, 0.3, 0.75, 1.5, 0.1]);
  // Wellenprämie 6 x G, Makellos und Frühstart je 2 x G, Zeitgeschenk 16 x G.
  assert.equal(BALANCE.waveBonus, 6);
  assert.ok(Math.abs(BALANCE.waveBonus * BALANCE.perfectBonus - 2) < 1e-9);
  assert.ok(Math.abs(BALANCE.waveBonus * BALANCE.earlyBonus - 2) < 1e-9);
  assert.deepEqual([BALANCE.earlyBonusTime, BALANCE.ageGift, BALANCE.shieldDelay], [12, 16, 3]);
  assertRange(BALANCE.shieldRecharge, 0.5, 6, 'balance.shieldRecharge');
  // Schwierigkeitsgrade (Kapitel 2.9).
  assert.deepEqual(Object.keys(BALANCE.difficulty).sort(), ['easy', 'hard', 'normal']);
  const d = BALANCE.difficulty;
  assert.deepEqual([d.easy.name, d.normal.name, d.hard.name], ['Gemütlich', 'Normal', 'Knifflig']);
  // Die Abstufung der Lebenspunkte; der gemeinsame Regler DRUCK (PRESSURE) steckt in allen dreien.
  assert.deepEqual([d.easy.hp, d.normal.hp, d.hard.hp].map((hp) => Math.round((100 * hp) / d.normal.hp) / 100), [0.8, 1, 1.25]);
  assert.deepEqual([d.easy.speed, d.normal.speed, d.hard.speed], [1, 1, 1.1]);
  assert.deepEqual([d.easy.lives, d.normal.lives, d.hard.lives], [30, 20, 15]);
  assert.deepEqual([d.easy, d.normal, d.hard].map((x) => Math.round(BALANCE.startGold * x.gold)), [190, 150, 140]);
  for (const def of Object.values(d)) {
    assertText(def.description, `Schwierigkeitsgrad "${def.name}".description`);
    assertRange(def.income, 0.5, 2, `Schwierigkeitsgrad "${def.name}".income`);
    assertRange(def.score, 0.5, 2, `Schwierigkeitsgrad "${def.name}".score`);
  }
  // Modernisieren ist immer billiger als verkaufen und neu bauen: 45 % Neuwert gegen 100 % Neuwert minus 75 % Altwert.
  for (let age = 1; age < AGES.length; age++) {
    const ratio = BALANCE.ageCost[age - 1] / BALANCE.ageCost[age];
    assert.ok(BALANCE.modernizeFactor < 1 - BALANCE.sellRefund * ratio, `Zeitalter ${age}: Verkaufen und neu bauen wäre billiger als modernisieren`);
  }
});

test('Zeitglocke: eine je Zeitalter, nur der Text unterscheidet sie', () => {
  assert.equal(ABILITIES.length, AGES.length);
  const { description: _first, ...reference } = ABILITIES[0];
  for (const ability of ABILITIES) {
    const { description, ...rest } = ability;
    assertText(description, 'Zeitglocke.description');
    assert.deepEqual(rest, reference);
  }
  assertUnique(ABILITIES.map((a) => a.description), 'Texte der Zeitglocke');
  const bell = ABILITIES[0];
  assert.deepEqual([bell.name, bell.cooldown, bell.radius, bell.rewind, bell.slow, bell.slowDuration, bell.damage, bell.hitsAir], ['Zeitglocke', 75, 0, 4, 0.5, 3, 0, true]);
  assertHex(bell.color, 'Zeitglocke.color');
});

/** Ausnahmen von den allgemeinen Kartenregeln: Das Felsenmeer ist absichtlich klein, voller Fels und knapp an Bauplätzen. */
const MAP_LIMITS = /** @type {Record<string, { size: [number, number], blocked: number, free: number, near: number, reserved: number }>} */ ({
  felsenmeer: { size: [16, 10], blocked: 50, free: 75, near: 60, reserved: 6 },
  // Die Karte für Könner wandelt sich zweimal und darf etwas mehr Bauland für künftige Wege opfern.
  zangengriff: { size: [18, 12], blocked: 16, free: 80, near: 40, reserved: 8 },
});
/** `reserved`: höchstens so viele Felder im Spielfeld, die erst in einer späteren Stufe Weg werden. */
const DEFAULT_LIMITS = { size: [18, 12], blocked: 16, free: 80, near: 40, reserved: 6 };
/** Schwierigkeitsangaben am Ende der Beschreibung, von leicht nach schwer. */
const MAP_LEVELS = ['Für den Einstieg.', 'Für Fortgeschrittene.', 'Für Könner.'];

test('Karten: die sechs Karten des Entwurfs erfüllen die Regeln von MapDef', () => {
  assert.deepEqual(MAPS.map((m) => m.id), ['flusstal', 'kreuzweg', 'zwillingsfurt', 'schneckenhaus', 'felsenmeer', 'zangengriff']);
  assert.deepEqual(MAPS.map((m) => m.paths.length), [1, 1, 2, 1, 1, 2]);
  /** @param {string} id */
  const byId = (id) => /** @type {import('../src/types/content').MapDef} */ (MAPS.find((m) => m.id === id));
  assert.deepEqual(byId('flusstal').paths[0], [[-1, 2], [14, 2], [14, 6], [3, 6], [3, 10], [18, 10]]);
  assert.deepEqual(byId('kreuzweg').paths[0], [[-1, 6], [12, 6], [12, 2], [6, 2], [6, 10], [18, 10]]);
  assert.deepEqual(byId('zwillingsfurt').paths[0], [[-1, 1], [3, 1], [3, 4], [7, 4], [7, 1], [10, 1], [10, 5], [14, 5], [14, 8], [18, 8]]);
  assert.deepEqual(byId('zwillingsfurt').paths[1], [[-1, 10], [3, 10], [3, 7], [7, 7], [7, 10], [10, 10], [10, 5], [14, 5], [14, 8], [18, 8]]);
  assert.deepEqual(byId('schneckenhaus').paths[0], [[-1, 1], [16, 1], [16, 10], [1, 10], [1, 5], [9, 5]]);
  assert.deepEqual(byId('zangengriff').paths[0], [[-1, 1], [6, 1], [6, 4], [2, 4], [2, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]]);
  assert.deepEqual(byId('zangengriff').paths[1], [[18, 1], [11, 1], [11, 4], [15, 4], [15, 7], [8, 7], [8, 9], [4, 9], [4, 11], [12, 11], [12, 12]]);
  assert.deepEqual(byId('felsenmeer').paths[0], [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 8], [12, 8], [12, 3], [16, 3]]);
  assertUnique(MAPS.map((m) => String(m.seed)), 'Startwerte der Karten');
  assertUnique(MAPS.map((m) => m.name), 'Namen der Karten');
  // Die Liste geht von leicht nach schwer, und jede Beschreibung sagt ehrlich, für wen die Karte ist.
  const levels = MAPS.map((m) => MAP_LEVELS.findIndex((hint) => m.description.endsWith(hint)));
  for (const [i, level] of levels.entries()) assert.ok(level >= 0, `Karte "${MAPS[i].id}": Beschreibung endet nicht mit ${MAP_LEVELS.join(' / ')}`);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] >= levels[i - 1], `Karte "${MAPS[i].id}" steht vor einer leichteren Karte`);
  for (const map of MAPS) {
    const where = `Karte "${map.id}"`;
    assertText(map.name, `${where}.name`);
    assertText(map.description, `${where}.description`);
    const limits = MAP_LIMITS[map.id] ?? DEFAULT_LIMITS;
    assert.deepEqual([map.width, map.height], limits.size);
    /** @param {number} x @param {number} z */
    const inside = (x, z) => x >= 0 && x < map.width && z >= 0 && z < map.height;
    /** @param {number} x @param {number} z */
    const justOutside = (x, z) => !inside(x, z) && x >= -1 && x <= map.width && z >= -1 && z <= map.height && (x >= 0 && x < map.width) !== (z >= 0 && z < map.height);
    const sets = pathSets(map);
    /** Alle Felder, die in irgendeiner erreichbaren Stufe Weg sind (nicht bebaubar). @type {Set<string>} */
    const pathSet = new Set();
    /** Wegfelder je Stufe. @type {Set<string>[]} */
    const stageSets = [];
    const end = map.paths[0][map.paths[0].length - 1];
    for (const { from, paths } of sets) {
      /** @type {Set<string>} */
      const own = new Set();
      stageSets.push(own);
      for (const [i, waypoints] of paths.entries()) {
        const at = `${where}${from > 0 ? `, Stufe ${from}` : ''}, Weg ${i}`;
        assert.ok(waypoints.length >= 2, `${at}: zu wenige Wegpunkte`);
        for (let k = 0; k < waypoints.length; k++) {
          const [x, z] = waypoints[k];
          assert.ok(Number.isInteger(x) && Number.isInteger(z), `${at}: Wegpunkt ${k} ist nicht ganzzahlig`);
          if (k > 0) {
            const [px, pz] = waypoints[k - 1];
            assert.ok((px === x) !== (pz === z), `${at}: Wegpunkte ${k - 1} und ${k} liegen nicht in einer Zeile oder Spalte`);
          }
          if (k === 0) assert.ok(justOutside(x, z), `${at}: Der Eingang (${x}, ${z}) liegt nicht genau ein Feld außerhalb`);
          else if (k === waypoints.length - 1) assert.ok(inside(x, z) || justOutside(x, z), `${at}: Die Basis (${x}, ${z}) liegt zu weit draußen`);
          else assert.ok(inside(x, z), `${at}: Wegpunkt ${k} (${x}, ${z}) liegt außerhalb`);
        }
        assert.deepEqual(waypoints[waypoints.length - 1], end, `${at}: Alle Wege enden auf demselben Feld`);
        const tiles = pathTiles(waypoints);
        // Innerhalb des Spielfelds liegt nur das erste Feld (und bei einer Basis außerhalb das letzte) draußen.
        tiles.forEach(([x, z], k) => {
          if (k > 0 && k < tiles.length - 1) assert.ok(inside(x, z), `${at}: Wegfeld (${x}, ${z}) liegt außerhalb`);
          pathSet.add(`${x},${z}`);
          own.add(`${x},${z}`);
        });
        const curve = buildPath(waypoints, map.width, map.height);
        // Abkürzungen späterer Stufen dürfen kürzer sein, aber nicht winzig.
        assert.ok(Number.isFinite(curve.length) && curve.length > (from > 0 ? 15 : 20), `${at}: buildPath liefert Länge ${curve.length}`);
        assert.ok(curve.xs.every(Number.isFinite) && curve.zs.every(Number.isFinite), `${at}: Kurve enthält ungültige Punkte`);
      }
    }
    // Stufen: Name und Text für die Karte des Zeitalterwechsels, sparsam mit neuen Wegfeldern.
    for (const [i, stage] of (map.stages ?? []).entries()) {
      if (!stage) continue;
      const at = `${where}, Stufe ${i}`;
      assert.ok(i > 0 && i < content.ages.length, `${at}: Stufe außerhalb der Zeitalter`);
      assert.ok(stage.name.length > 0 && stage.name.length <= 30, `${at}.name`);
      assert.ok(stage.text.length >= 40 && stage.text.length <= 160, `${at}.text ist ein bis zwei kurze Sätze`);
      assert.ok((stage.text.match(/[.!?](\s|$)/g) ?? []).length <= 2, `${at}.text hat mehr als zwei Sätze`);
    }
    const reserved = [...pathSet].filter((key) => {
      const [x, z] = key.split(',').map(Number);
      return !stageSets[0].has(key) && inside(x, z);
    });
    assert.ok(reserved.length <= limits.reserved, `${where}: ${reserved.length} Felder für künftige Wege reserviert`);
    // Gesperrte Felder: im Spielfeld, nicht auf einem Weg, nicht doppelt.
    assert.ok(map.blocked.length >= 4 && map.blocked.length <= limits.blocked, `${where}: ${map.blocked.length} gesperrte Felder`);
    assertUnique(map.blocked.map(([x, z]) => `${x},${z}`), `${where}: gesperrte Felder`);
    const blocked = new Set(map.blocked.map(([x, z]) => `${x},${z}`));
    for (const [x, z] of map.blocked) {
      assert.ok(inside(x, z), `${where}: gesperrtes Feld (${x}, ${z}) liegt außerhalb`);
      assert.ok(!pathSet.has(`${x},${z}`), `${where}: gesperrtes Feld (${x}, ${z}) liegt auf einem Weg`);
    }
    // Liegt die Basis im Spielfeld, sind ihre acht Nachbarfelder Platz der Basis.
    if (inside(end[0], end[1])) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) blocked.add(`${end[0] + dx},${end[1] + dz}`);
    }
    /** @param {number} tx @param {number} tz */
    const open = (tx, tz) => inside(tx, tz) && !pathSet.has(`${tx},${tz}`) && !blocked.has(`${tx},${tz}`);
    // Genug Bauplätze in Wegnähe (Wege jeder Stufe).
    stageSets.forEach((own, k) => {
      const at = `${where}${sets[k].from > 0 ? `, Stufe ${sets[k].from}` : ''}`;
      const pathCenters = [...own].map((key) => key.split(',').map(Number)).map(([x, z]) => [tileX(x, map.width), tileZ(z, map.height)]);
      let near = 0;
      let free = 0;
      let trios = 0;
      for (let x = 0; x < map.width; x++) {
        for (let z = 0; z < map.height; z++) {
          if (!open(x, z)) continue;
          free++;
          const cx = tileX(x, map.width);
          const cz = tileZ(z, map.height);
          if (pathCenters.some(([px, pz]) => Math.hypot(px - cx, pz - cz) <= 2.5)) near++;
          // Superwaffen brauchen einen Kern mit zwei bebaubaren Nachbarn: Es muss mehrere solche Plätze am Weg geben.
          let neighbours = 0;
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && open(x + dx, z + dz)) neighbours++;
          if (neighbours >= 2 && pathCenters.some(([px, pz]) => Math.hypot(px - cx, pz - cz) <= 2)) trios++;
        }
      }
      assert.ok(near >= limits.near, `${at}: nur ${near} Bauplätze in Wegnähe`);
      assert.ok(free >= limits.free, `${at}: nur ${free} freie Felder`);
      assert.ok(trios >= 8, `${at}: nur ${trios} Plätze für eine Superwaffe am Weg`);
    });
  }
});

/**
 * Die Sätze von Wegen einer Karte: die Grundwege (Stufe 0) und je Stufe mit `paths` deren Wege.
 * @param {import('../src/types/content').MapDef} map
 * @returns {{ from: number, paths: [number, number][][] }[]}
 */
function pathSets(map) {
  const sets = [{ from: 0, paths: map.paths }];
  for (const [i, stage] of (map.stages ?? []).entries()) if (stage && stage.paths) sets.push({ from: i, paths: stage.paths });
  return sets;
}

test('Karten: Stufen nach dem Entwurf - Einsteigerkarten wandeln sich wenig, der Zangengriff am meisten', () => {
  /** @param {string} id */
  const changes = (id) => pathSets(/** @type {import('../src/types/content').MapDef} */ (MAPS.find((m) => m.id === id))).length - 1;
  assert.ok(changes('flusstal') <= 1, 'Flusstal: höchstens eine Änderung');
  assert.equal(changes('kreuzweg'), 1);
  for (const id of ['zwillingsfurt', 'schneckenhaus', 'felsenmeer']) assert.ok(changes(id) >= 1 && changes(id) <= 2, `${id}: ein oder zwei Änderungen`);
  // Der Zangengriff wandelt sich nicht weniger als jede andere Karte und hat im letzten Zeitalter ein drittes Tor.
  for (const map of MAPS) assert.ok(changes('zangengriff') >= changes(map.id), `Zangengriff wandelt sich weniger als ${map.id}`);
  const zange = /** @type {import('../src/types/content').MapDef} */ (MAPS.find((m) => m.id === 'zangengriff'));
  const late = pathSets(zange).filter((set) => set.from < content.ages.length);
  assert.equal(late[late.length - 1].paths.length, 3);
  // Jede Stufe liegt in einem aktiven Zeitalter, keine schon in der Steinzeit.
  for (const map of MAPS) for (const set of pathSets(map).slice(1)) assert.ok(set.from > 0 && set.from < content.ages.length, `${map.id}: Stufe ${set.from}`);
});

test('Karten: Die Simulation erreicht jede Stufe, und kein besonderes Feld liegt auf einem künftigen Weg', async () => {
  const { createSim } = await import('../src/sim/sim.js');
  for (const map of MAPS) {
    const sim = createSim({ content, mapId: map.id, difficulty: 'normal', seed: 1 });
    assert.deepEqual(sim.pathStages, pathSets(map).map((set) => set.from), `${map.id}: Stufen`);
    for (const t of map.tiles ?? []) assert.equal(sim.pathMark(t.tx, t.tz), '', `${map.id}: besonderes Feld (${t.tx}, ${t.tz})`);
  }
});

test('Karten: Ein Weg kreuzt sich nur auf dem Kreuzweg, und dort rechtwinklig auf einer Geraden', () => {
  for (const map of MAPS) {
    for (const [i, waypoints] of pathSets(map).flatMap((set) => set.paths).entries()) {
      const tiles = pathTiles(waypoints);
      /** @type {Map<string, number>} */
      const seen = new Map();
      /** @type {number[][]} Indexpaare der doppelt belaufenen Felder */
      const twice = [];
      tiles.forEach(([x, z], k) => {
        const key = `${x},${z}`;
        const first = seen.get(key);
        if (first === undefined) seen.set(key, k);
        else twice.push([first, k]);
      });
      if (map.id !== 'kreuzweg') {
        assert.equal(twice.length, 0, `Karte "${map.id}", Weg ${i}: Der Weg berührt sich selbst`);
        continue;
      }
      // Auf dem Kreuzweg kreuzt sich der Grundweg; ein Weg einer späteren Stufe darf die Kreuzung auch auslassen.
      if (i > 0 && twice.length === 0) continue;
      assert.equal(twice.length, 1, 'Kreuzweg: genau eine Kreuzung');
      const [a, b] = twice[0];
      // Beide Durchgänge laufen geradeaus über das Feld (keine Ecke auf der Kreuzung), und zwar quer zueinander.
      /** @param {number} k */
      const dir = (k) => [tiles[k + 1][0] - tiles[k - 1][0], tiles[k + 1][1] - tiles[k - 1][1]];
      const [ax, az] = dir(a);
      const [bx, bz] = dir(b);
      assert.ok(Math.abs(ax) + Math.abs(az) === 2 && (ax === 0 || az === 0), 'Kreuzweg: erster Durchgang biegt auf der Kreuzung ab');
      assert.ok(Math.abs(bx) + Math.abs(bz) === 2 && (bx === 0 || bz === 0), 'Kreuzweg: zweiter Durchgang biegt auf der Kreuzung ab');
      assert.equal(ax * bx + az * bz, 0, 'Kreuzweg: Die Durchgänge kreuzen sich nicht rechtwinklig');
      // Die Durchgänge liegen weit genug auseinander, dass ein Turm an der Kreuzung wirklich zweimal schießt.
      assert.ok(b - a >= 12, `Kreuzweg: nur ${b - a} Felder zwischen den Durchgängen`);
    }
  }
});

test('Werkzeuge: Lichtstimmung und Bodenfarbe je Zeitalter', () => {
  for (const age of AGES) {
    assert.equal(getLightTheme(age.id), age.light);
    assert.equal(getGroundColor(age.id), age.terrain.groundA);
  }
  assert.equal(getLightTheme('gibtsnicht'), null);
  assert.equal(getGroundColor('gibtsnicht'), null);
});

const simFile = fileURLToPath(new URL('../src/sim/sim.js', import.meta.url));
test('Simulation nimmt die Inhalte für jede Karte und jeden Schwierigkeitsgrad an', { skip: existsSync(simFile) ? false : 'src/sim/sim.js gibt es noch nicht' }, async () => {
  const { createSim } = await import('../src/sim/sim.js');
  for (const map of MAPS) {
    for (const difficulty of /** @type {const} */ (['easy', 'normal', 'hard'])) {
      const sim = createSim({ content, mapId: map.id, difficulty, seed: 1 });
      assert.ok(sim, `createSim für Karte "${map.id}", ${difficulty}`);
      assert.equal(sim.state.gold, Math.round(BALANCE.startGold * BALANCE.difficulty[difficulty].gold));
      assert.equal(sim.state.lives, BALANCE.difficulty[difficulty].lives);
    }
  }
});

test('Besondere Bauplätze: vier Arten mit ehrlichem Text, eigener Farbe und Symbol; je Karte drei bis sechs Felder', () => {
  const tiles = BALANCE.tiles;
  assert.deepEqual(Object.keys(tiles), ['hoehe', 'quelle', 'takt', 'sumpf']);
  /** @param {string} hex */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  /** @param {string} a @param {string} b */
  const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  const grounds = AGES.flatMap((age) => [String(age.terrain.groundA), String(age.terrain.groundB)]);
  const colors = [];
  for (const [id, def] of Object.entries(tiles)) {
    const where = `balance.tiles.${id}`;
    assert.ok(def.name.length > 0 && def.name.length <= 14, `${where}.name`);
    assert.ok(def.text.length >= 30 && def.text.length <= 140, `${where}.text ist ein bis zwei kurze Sätze`);
    assert.ok(/^[a-zA-Z]+$/.test(def.icon), `${where}.icon`);
    assertHex(def.color, `${where}.color`);
    const color = String(def.color);
    colors.push(color);
    for (const arch of ARCHETYPES) assert.ok(distance(color, String(arch.color)) > 80, `${where}.color zu nah an der Rollenfarbe von ${arch.id}`);
    for (const ground of grounds) assert.ok(distance(color, ground) > 60, `${where}.color zu nah am Boden ${ground}`);
    assert.ok(def.cost > 0 && def.cost <= 2, `${where}.cost`);
    assert.equal(def.mod.set, undefined, `${where}: kein set`);
    // Ehrliche Zahl im Text.
    const mul = def.mod.mul ?? {};
    const percent = def.cost !== 1 ? Math.round((def.cost - 1) * 100)
      : mul.range ? Math.round((mul.range - 1) * 100) : mul.damage ? Math.round((mul.damage - 1) * 100) : Math.round((1 - (mul.cooldown ?? 1)) * 100);
    assert.ok(def.text.includes(`${percent} %`), `${where}.text nennt ${percent} %`);
  }
  for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) assert.ok(distance(colors[i], colors[j]) > 60, `Farben ${colors[i]} und ${colors[j]} zu ähnlich`);
  // Wem ein Feld nichts bringt, sagt der Text.
  assert.match(tiles.quelle.text, /Taktgebern bringt das nichts/);
  assert.match(tiles.takt.text, /Taktgebern .*nichts/);
  assert.match(tiles.hoehe.text, /Taktgeber/);
  for (const map of MAPS) {
    const list = map.tiles ?? [];
    assert.ok(list.length >= 3 && list.length <= 6, `${map.id}: ${list.length} besondere Felder`);
    for (const t of list) assert.ok(Object.hasOwn(tiles, t.kind), `${map.id}: Art ${t.kind}`);
    assert.ok(new Set(list.map((t) => t.kind)).size >= 3, `${map.id}: mindestens drei verschiedene Arten`);
  }
});
