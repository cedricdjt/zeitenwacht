// @ts-check
// Wellen mit Eigenart (docs/briefs/fusion.md, Abschnitt 10; docs/SIM.md, „Wellen mit Eigenart“): Ziehung aus dem Startwert,
// Vorschau und Ereignis, Wirkung auf Gegner und Türme nur während der Welle, Prämie, Speichern und Laden, Prüfung der Inhalte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rules from '../src/sim/rules.js';
import { createSim, drawModifiers } from '../src/sim/sim.js';
import { content as gameContent } from '../src/content/index.js';
import { addFusion, makeContent } from './fixtures/content.mjs';
import { digest, makeSim, mustBuild, near, ofType, steps, stepUntil } from './fixtures/harness.mjs';

/** @import { Content, WaveModifierDef } from '../src/types/content' */
/** @import { SaveData, Sim } from '../src/types/sim' */

/**
 * Testinhalte mit genau einer Eigenart, die in jedem Zeitalter die einzige mögliche Welle (die zweite) trifft.
 * @param {WaveModifierDef} def
 * @param {(content: Content) => void} [edit]
 * @returns {Content}
 */
function withModifier(def, edit) {
  const content = makeContent();
  content.modifiers = { probe: def };
  content.balance.modifiers = { perAge: 1 };
  content.balance.startGold = 100000;
  if (edit) edit(content);
  return content;
}

/** @param {Partial<WaveModifierDef>} patch @returns {WaveModifierDef} */
const mod = (patch) => ({ name: 'Probe', text: 'Probe', icon: 'fog', color: '#cccccc', ...patch });

/**
 * Rechnet bis zur Bauphase vor der Welle `wave`, ohne dass Gegner durchkommen (Leben unbegrenzt hoch).
 * @param {Sim} sim
 * @param {number} wave
 */
function skipTo(sim, wave) {
  sim.state.lives = 1e9;
  while (sim.state.wave < wave) {
    if (sim.state.phase === 'build') {
      sim.state.lock = 0;
      if (sim.state.boonOffer.length > 0) sim.chooseBoon(sim.state.boonOffer[0]);
      sim.startWave();
    }
    sim.step();
  }
  sim.state.lock = 0;
}

test('Ziehung: deterministisch je Startwert, nie die erste Welle eines Zeitalters, nie eine Bosswelle, needs wird beachtet', () => {
  const content = gameContent;
  const a = drawModifiers(content, 7);
  assert.deepEqual(drawModifiers(content, 7), a);
  assert.equal(a.length, rules.totalWaves(content));
  let differs = false;
  for (const seed of [1, 2, 3, 11, 13, 17, 19, 23]) {
    const list = drawModifiers(content, seed);
    if (list.join() !== a.join()) differs = true;
    let index = 0;
    for (let age = 0; age < content.waves.length; age++) {
      let count = 0;
      const used = new Set();
      for (let w = 0; w < content.waves[age].length; w++, index++) {
        const id = list[index];
        if (id === '') continue;
        count += 1;
        assert.notEqual(w, 0, `Zeitalter ${age}: erste Welle mit Eigenart`);
        const defs = content.waves[age][w].groups.map((g) => content.enemies[g.enemy]);
        assert.ok(!defs.some((d) => d.boss), `Zeitalter ${age}, Welle ${w}: Bosswelle mit Eigenart`);
        const def = /** @type {WaveModifierDef} */ (rules.modifierDef(content, id));
        if (def.needs?.includes('flying')) assert.ok(defs.some((d) => d.flying), `${id} ohne Flieger`);
        if (def.needs?.includes('armored')) assert.ok(defs.some((d) => d.armor > 0), `${id} ohne Rüstung`);
        if (def.needs?.includes('shielded')) assert.ok(defs.some((d) => d.shield > 0), `${id} ohne Schild`);
        assert.ok(!used.has(id), `${id} zweimal in einem Zeitalter`);
        used.add(id);
      }
      assert.equal(count, content.balance.modifiers?.perAge ?? 2, `Zeitalter ${age}`);
    }
  }
  assert.ok(differs, 'Verschiedene Startwerte sollten verschiedene Eigenarten bringen');
  // Ohne Eigenarten in den Inhalten: keine, und der Zufall der Partie bleibt unberührt.
  assert.ok(drawModifiers(makeContent(), 7).every((id) => id === ''));
});

test('Vorschau, Ereignis und Zustand nennen die Eigenart; nach der Welle ist sie vorbei', () => {
  const sim = makeSim({ content: withModifier(mod({ bonus: 2 })), seed: 3 });
  assert.equal(sim.wavePreview(0)?.modifier, undefined);
  assert.equal(sim.wavePreview(1)?.modifier, 'probe');
  skipTo(sim, 1);
  assert.equal(sim.state.modifier, '');
  sim.drainEvents();
  sim.startWave();
  const start = ofType(sim.drainEvents(), 'waveStart')[0];
  assert.equal(start.modifier, 'probe');
  assert.equal(sim.state.modifier, 'probe');
  stepUntil(sim, () => sim.state.phase === 'build');
  assert.equal(sim.state.modifier, '');
});

test('Gegner: Faktoren auf Lebenspunkte, Tempo, Rüstung, Schild und Kopfgeld; air nur für Flieger', () => {
  const content = withModifier(mod({ enemy: { hp: 2, speed: 1.5, armor: 3, shield: 2, bounty: 2 }, air: { speed: 2, hp: 0.5 } }), (c) => {
    c.waves[0][1] = { groups: [{ enemy: 'knight', count: 1, interval: 0, delay: 0 }, { enemy: 'mage', count: 1, interval: 0, delay: 0 }, { enemy: 'bird', count: 1, interval: 0, delay: 0 }] };
  });
  const sim = makeSim({ content });
  skipTo(sim, 1);
  sim.startWave();
  stepUntil(sim, () => sim.state.enemies.length === 3);
  const [knight, mage, bird] = sim.state.enemies;
  const base = (/** @type {string} */ id) => rules.enemyStats(content, content.enemies[id], 0, 1, 'normal');
  assert.equal(knight.maxHp, base('knight').hp * 2);
  near(knight.armor, base('knight').armor * 3);
  near(knight.speed, base('knight').speed * 1.5);
  assert.equal(knight.bounty, base('knight').bounty * 2);
  assert.equal(mage.maxShield, Math.round(mage.maxHp * content.enemies.mage.shield * 2));
  assert.equal(bird.maxHp, base('bird').hp);
  near(bird.speed, base('bird').speed * 3);
});

test('Gegner: count vervielfacht die Gruppen in derselben Zeit, auch in der Vorschau; Bosse bleiben', () => {
  const content = withModifier(mod({ enemy: { count: 1.5 } }));
  const sim = makeSim({ content });
  const plain = makeSim({ content: makeContent() });
  const preview = /** @type {import('../src/types/sim').WavePreview} */ (sim.wavePreview(1));
  const before = /** @type {import('../src/types/sim').WavePreview} */ (plain.wavePreview(1));
  assert.deepEqual(preview.groups.map((g) => g.count), before.groups.map((g) => Math.round(g.count * 1.5)));
  skipTo(sim, 1);
  sim.startWave();
  assert.equal(sim.state.pending, 9 + 6);
});

test('Türme: Die Eigenart gilt nur während der Welle, auch für Türme, die in der Welle gebaut, ausgebaut oder verschmolzen werden', () => {
  const content = withModifier(mod({ towers: { mul: { range: 0.5, damage: 2 } } }), (c) => {
    addFusion(c);
    c.waves[0][1] = { groups: [{ enemy: 'grunt', count: 3, interval: 20, delay: 0 }] };
  });
  const sim = makeSim({ content });
  const early = mustBuild(sim, 'shooter', 2, 2);
  skipTo(sim, 1);
  const range = early.stats.range;
  sim.startWave();
  near(early.stats.range, range * 0.5);
  assert.equal(early.modifier, 'probe');
  assert.deepEqual(rules.towerStats(content, early.arch, early.tier, early.level, early), early.stats);
  // In der Welle gebaut, ausgebaut, verschmolzen.
  const core = mustBuild(sim, 'thrower', 6, 2);
  const a = mustBuild(sim, 'thrower', 5, 2);
  const b = mustBuild(sim, 'thrower', 7, 2);
  for (const t of [core, a, b]) {
    sim.upgrade(t.id);
    sim.upgrade(t.id);
  }
  assert.ok(sim.fuse(core.id, [a.id, b.id]).ok);
  const thrower = /** @type {import('../src/types/content').TowerArchetypeDef} */ (content.archetypes.find((t) => t.id === 'thrower'));
  const normal = rules.towerStats(content, thrower, 0, 3, { super: true, gifts: ['thrower', 'thrower'], giftBranches: [-1, -1] });
  near(core.stats.damage, normal.damage * 2);
  stepUntil(sim, () => sim.state.phase === 'build');
  near(early.stats.range, range);
  assert.equal(early.modifier, '');
  assert.deepEqual(core.stats, normal);
});

test('Prämie: bonus vervielfacht Wellenprämie samt Makellos-Zuschlag', () => {
  const content = withModifier(mod({ bonus: 1.5 }), (c) => {
    c.waves[0][1] = { groups: [] };
  });
  const sim = makeSim({ content });
  skipTo(sim, 1);
  sim.drainEvents();
  sim.startWave();
  sim.step();
  const clear = ofType(sim.drainEvents(), 'waveClear')[0];
  assert.equal(clear.bonus, Math.round((rules.waveBonus(content, 0, 'normal') + rules.perfectBonus(content, 0, 'normal')) * 1.5));
});

test('Speichern und Laden: Die Eigenarten folgen aus dem Startwert, der Verlauf bleibt bitgenau gleich', () => {
  const content = withModifier(mod({ towers: { mul: { range: 0.8 } }, enemy: { hp: 1.5, speed: 1.2 } }));
  const sim = makeSim({ content, seed: 9 });
  mustBuild(sim, 'shooter', 2, 2);
  mustBuild(sim, 'shooter', 6, 4);
  skipTo(sim, 1);
  const save = /** @type {SaveData} */ (sim.save());
  const loaded = makeSim({ content, seed: 9 }, JSON.parse(JSON.stringify(save)));
  assert.equal(loaded.wavePreview(0)?.modifier, 'probe');
  for (const s of [sim, loaded]) {
    s.startWave();
    steps(s, 900);
  }
  assert.equal(digest(loaded), digest(sim));
});

test('Prüfung der Inhalte: Eigenarten mit set, unbekannten Feldern, Faktor 0 oder unbekannter Bedingung scheitern', () => {
  /** @param {(content: Content) => void} edit */
  const fails = (edit) => assert.throws(() => makeSim({ content: withModifier(mod({}), edit) }));
  fails((c) => (/** @type {any} */ (c.modifiers).probe.towers = { set: { range: 1 } }));
  fails((c) => (/** @type {any} */ (c.modifiers).probe.zauber = 1));
  fails((c) => (/** @type {any} */ (c.modifiers).probe.enemy = { hp: 0 }));
  fails((c) => (/** @type {any} */ (c.modifiers).probe.needs = ['regen']));
  fails((c) => (/** @type {any} */ (c.modifiers).probe.name = ''));
  fails((c) => (c.balance.modifiers = { perAge: -1 }));
  makeSim({ content: withModifier(mod({ needs: ['flying', 'swarm'], air: { speed: 0.5 } })) });
});

test('Spielinhalte: sieben bis neun Eigenarten, jede auf mindestens einer Karte und einem Startwert gezogen', () => {
  const all = gameContent.modifiers ?? {};
  const ids = Object.keys(all);
  assert.ok(ids.length >= 7 && ids.length <= 9, `${ids.length} Eigenarten`);
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const id of drawModifiers(gameContent, seed)) seen.add(id);
  for (const id of ids) {
    assert.ok(seen.has(id), `${id} wird nie gezogen`);
    assert.match(all[id].text, /\d/, `${id}: Text ohne Zahl`);
  }
  for (const map of gameContent.maps) createSim({ content: gameContent, mapId: map.id, difficulty: 'hard', seed: 2 });
});
