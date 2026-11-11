// @ts-check
// Kleine, aber vollständige Inhalte für die Tests der Simulation: 3 Zeitalter mit je 3 Wellen, Turmrollen für jede
// Angriffsart und Sonderregel, Gegner für jede Eigenschaft, vier Karten, eine Fähigkeit je Zeitalter.
// Die Zahlen sind bewusst rund gewählt, damit sich die Regeln in den Tests von Hand nachrechnen lassen.
// `makeContent()` liefert bei jedem Aufruf eine frische, unabhängige Kopie; Tests dürfen sie nach Belieben verbiegen.

/** @import { AbilityDef, AgeDef, Balance, Content, EnemyDef, MapDef, StatMod, TowerArchetypeDef, TowerBranchDef, TowerFusionDef, TowerStats, TowerTierDef, WaveDef } from '../../src/types/content' */

/**
 * Ein Zeitalter; die Felder der Darstellung sind für die Simulation ohne Bedeutung und bleiben leer.
 * @param {string} id
 * @param {string} name
 * @returns {AgeDef}
 */
function age(id, name) {
  return /** @type {AgeDef} */ (/** @type {unknown} */ ({ id, name, subtitle: '', tagline: '', accent: '#ffffff', scatter: [], scatterCount: 0, fieldCount: 0, baseModel: `base.${id}`, bloom: 0 }));
}

/**
 * Kampfwerte: Standardwerte plus die genannten Abweichungen.
 * @param {Partial<TowerStats>} patch
 * @returns {TowerStats}
 */
export function stats(patch) {
  return {
    attack: 'projectile',
    damage: 0,
    cooldown: 1,
    range: 3,
    minRange: 0,
    projectileSpeed: 8,
    splash: 0,
    slow: 0,
    slowDuration: 0,
    dot: 0,
    dotDuration: 0,
    pierce: 0,
    chain: 0,
    chainRange: 0,
    zone: 0,
    ramp: 0,
    rampTime: 0,
    hitsAir: true,
    hitsGround: true,
    auraDamage: 0,
    auraRate: 0,
    auraRange: 0,
    ...patch,
  };
}

/**
 * Ausprägung einer Rolle in einem Zeitalter.
 * @param {string} name
 * @param {Partial<TowerStats>} [tweak]
 * @returns {TowerTierDef}
 */
export function tier(name, tweak) {
  /** @type {TowerTierDef} */
  const def = { name, flavor: '', model: `tower.${name}`, shot: { kind: 'none', color: '#ffffff', impact: 'none', sound: 'none' } };
  if (tweak) def.tweak = tweak;
  return def;
}

/**
 * @param {string} id
 * @param {number} cost
 * @param {number} unlockWave
 * @param {TowerStats} base
 * @param {(TowerTierDef | null)[]} tiers
 * @param {Partial<TowerArchetypeDef>} [extra]
 * @returns {TowerArchetypeDef}
 */
function arch(id, cost, unlockWave, base, tiers, extra) {
  return { id, role: id, summary: '', color: '#888888', icon: id, unlockWave, cost, stats: base, tiers, ...extra };
}

/**
 * Ein Gegner: schlichter Läufer plus die genannten Abweichungen.
 * @param {string} id
 * @param {Partial<EnemyDef>} patch
 * @returns {EnemyDef}
 */
function enemy(id, patch) {
  return {
    id,
    age: 'stone',
    name: id,
    description: '',
    model: `enemy.${id}`,
    boss: false,
    flying: false,
    hp: 1,
    speed: 1,
    armor: 0,
    shield: 0,
    regen: 0,
    slowResist: 0,
    bounty: 1,
    lives: 1,
    color: '#888888',
    ...patch,
  };
}

/**
 * @param {Partial<AbilityDef>} patch
 * @returns {AbilityDef}
 */
function ability(patch) {
  return { name: 'Fähigkeit', description: '', icon: 'bell', cooldown: 30, radius: 0, rewind: 0, damage: 0, slow: 0, slowDuration: 0, hitsAir: true, effect: 'explosion', color: '#ffffff', sound: 'none', ...patch };
}

/**
 * Frische Testinhalte.
 * @returns {Content}
 */
export function makeContent() {
  /** @type {TowerArchetypeDef[]} */
  const archetypes = [
    // Einzelgeschoss; Stufe 3 feuert doppelt so schnell (levels), im dritten Zeitalter trifft er sofort (tweak).
    arch('shooter', 50, 0, stats({ damage: 10, cooldown: 1, range: 3 }), [tier('sling'), tier('bow'), tier('rifle', { attack: 'hitscan' })], {
      levels: [{}, {}, { cooldown: 0.5 }],
    }),
    // Flächengeschoss mit Mindestabstand, nur Boden; Stufe 3 hat den größeren Radius.
    arch('thrower', 90, 1, stats({ damage: 14, cooldown: 2.5, range: 3.5, minRange: 1, projectileSpeed: 6, splash: 1, hitsAir: false }), [tier('rock'), tier('catapult'), tier('mortar')], {
      levels: [{}, {}, { splash: 1.4 }],
    }),
    // Bodenfeld mit Verlangsamung, ohne Schaden, nur Boden.
    arch('slower', 70, 2, stats({ damage: 0, cooldown: 3.5, range: 2.5, splash: 0.9, slow: 0.3, slowDuration: 1, zone: 3, hitsAir: false }), [tier('mud'), tier('oil'), tier('glue')]),
    // Sofortiger Flächentreffer mit Brand, nur Boden.
    arch('burner', 100, 3, stats({ attack: 'hitscan', damage: 3, cooldown: 1, range: 1.8, splash: 0.9, dot: 8, dotDuration: 3, hitsAir: false }), [tier('torch'), tier('fire'), tier('flamer')]),
    // Sofortiger Einzeltreffer, ignoriert Rüstung, springt einmal weiter, zielt von Haus aus auf den Stärksten.
    arch('piercer', 110, 3, stats({ attack: 'hitscan', damage: 45, cooldown: 3, range: 5, pierce: 1, chain: 1, chainRange: 2 }), [tier('spear'), tier('ballista'), tier('railgun')], {
      defaultMode: 'strong',
    }),
    // Dauerstrahl, dessen Schaden über 2 Sekunden auf das Doppelte wächst; im ersten Zeitalter gibt es ihn nicht.
    arch('beamer', 100, 4, stats({ attack: 'beam', damage: 20, cooldown: 0.1, range: 3, ramp: 1, rampTime: 2 }), [null, tier('lens'), tier('laser')]),
    // Rundumschlag auf alle Bodengegner in Reichweite.
    arch('pulser', 80, 0, stats({ attack: 'pulse', damage: 6, cooldown: 1.5, range: 1.6, hitsAir: false }), [tier('drum'), tier('gong'), tier('emitter')]),
    // Reiner Unterstützer mit allen drei Auren.
    arch('support', 120, 2, stats({ attack: 'none', range: 1.5, auraDamage: 0.25, auraRate: 0.2, auraRange: 0.1 }), [tier('totem'), tier('standard'), tier('relay')]),
    // Nur gegen Flieger.
    arch('flak', 60, 0, stats({ damage: 12, cooldown: 0.8, range: 4, projectileSpeed: 10, hitsGround: false }), [tier('net'), tier('crossbow'), tier('sam')]),
  ];

  /** @type {Record<string, EnemyDef>} */
  const enemies = {
    grunt: enemy('grunt', {}),
    runner: enemy('runner', { hp: 0.5, speed: 2, bounty: 0.6 }),
    knight: enemy('knight', { age: 'rome', hp: 2, speed: 0.8, armor: 0.5, bounty: 2 }),
    bird: enemy('bird', { flying: true, hp: 0.8, speed: 1.5 }),
    troll: enemy('troll', { age: 'rome', hp: 4, speed: 0.7, regen: 0.05, bounty: 3 }),
    mage: enemy('mage', { age: 'rome', hp: 2, speed: 0.9, shield: 0.5, bounty: 2 }),
    wagon: enemy('wagon', { age: 'rome', hp: 3, speed: 0.7, spawns: { enemy: 'grunt', count: 3 }, bounty: 2, lives: 2 }),
    healer: enemy('healer', { age: 'future', hp: 1.5, speed: 0.9, heal: { radius: 1.5, perSecond: 0.1 }, bounty: 2 }),
    golem: enemy('golem', { age: 'future', hp: 5, speed: 0.6, slowResist: 0.5, bounty: 4 }),
    // Boss mit beiden Arten von Momenten: Bei 2/3 setzt er zwei Läufer aus, bei 1/3 stürmt er 3 Sekunden lang doppelt so schnell.
    boss: enemy('boss', {
      boss: true,
      hp: 20,
      speed: 0.5,
      slowResist: 0.5,
      bounty: 20,
      lives: 10,
      phases: [{ at: 0.66, spawns: { enemy: 'runner', count: 2 } }, { at: 0.33, speed: 2, duration: 3 }],
    }),
  };

  /** @type {WaveDef[][]} */
  const waves = [
    [
      { groups: [{ enemy: 'grunt', count: 6, interval: 1, delay: 0 }], hint: 'Zum Aufwärmen' },
      { groups: [{ enemy: 'grunt', count: 6, interval: 1, delay: 0 }, { enemy: 'runner', count: 4, interval: 0.6, delay: 3 }] },
      { groups: [{ enemy: 'knight', count: 3, interval: 1.5, delay: 0 }, { enemy: 'bird', count: 3, interval: 1, delay: 2 }, { enemy: 'boss', count: 1, interval: 0, delay: 6 }], hint: 'Boss' },
    ],
    [
      { groups: [{ enemy: 'troll', count: 2, interval: 2, delay: 0 }, { enemy: 'mage', count: 3, interval: 1.5, delay: 1 }, { enemy: 'grunt', count: 6, interval: 0.8, delay: 4 }] },
      { groups: [{ enemy: 'wagon', count: 2, interval: 3, delay: 0 }, { enemy: 'healer', count: 2, interval: 3, delay: 0.5 }, { enemy: 'runner', count: 6, interval: 0.5, delay: 5 }] },
      { groups: [{ enemy: 'golem', count: 2, interval: 2, delay: 0 }, { enemy: 'bird', count: 4, interval: 1, delay: 2 }, { enemy: 'boss', count: 1, interval: 0, delay: 5 }] },
    ],
    [
      { groups: [{ enemy: 'knight', count: 6, interval: 1, delay: 0 }, { enemy: 'mage', count: 4, interval: 1.5, delay: 2 }] },
      { groups: [{ enemy: 'wagon', count: 3, interval: 2, delay: 0 }, { enemy: 'bird', count: 6, interval: 0.8, delay: 1 }, { enemy: 'healer', count: 2, interval: 2, delay: 2 }] },
      { groups: [{ enemy: 'golem', count: 3, interval: 2, delay: 0 }, { enemy: 'troll', count: 3, interval: 2, delay: 1 }, { enemy: 'runner', count: 8, interval: 0.5, delay: 4 }, { enemy: 'boss', count: 1, interval: 0, delay: 8 }] },
    ],
  ];

  /** @type {MapDef[]} */
  const maps = [
    // Ein Weg mit vier Ecken, Basis ein Feld außerhalb.
    { id: 'bend', name: 'Schleife', description: '', width: 12, height: 7, paths: [[[-1, 1], [4, 1], [4, 5], [9, 5], [9, 2], [12, 2]]], blocked: [[0, 0], [6, 3]], seed: 1 },
    // Zwei Wege, die sich vor der gemeinsamen Basis vereinen.
    { id: 'fork', name: 'Gabelung', description: '', width: 12, height: 7, paths: [[[-1, 1], [8, 1], [8, 3], [12, 3]], [[-1, 5], [8, 5], [8, 3], [12, 3]]], blocked: [[2, 3], [3, 3]], seed: 2 },
    // Die Basis liegt im Spielfeld; ihre acht Nachbarfelder sind gesperrt.
    { id: 'keep', name: 'Burghof', description: '', width: 12, height: 7, paths: [[[-1, 3], [8, 3]]], blocked: [[1, 1]], seed: 3 },
    // Ein schnurgerader Weg für Tests, die Strecken und Zeiten genau nachrechnen.
    { id: 'straight', name: 'Gerade', description: '', width: 12, height: 7, paths: [[[-1, 3], [12, 3]]], blocked: [[5, 0]], seed: 4 },
  ];

  /** @type {Balance} */
  const balance = {
    startGold: 200,
    baseHp: 20,
    baseBounty: 5,
    baseDamage: 10,
    ageDamage: [1, 2, 4],
    ageCost: [1, 1.8, 3.2],
    ageHp: [1, 2, 4],
    ageBounty: [1, 2, 3],
    waveHpGrowth: 0.1,
    levelDamage: [1, 1.6, 2.5],
    levelRange: [1, 1.1, 1.2],
    levelCost: [1.2, 1.8],
    modernizeFactor: 0.45,
    sellRefund: 0.75,
    waveBonus: 6,
    perfectBonus: 0.5,
    earlyBonus: 0.5,
    earlyBonusTime: 10,
    ageGift: 16,
    burnOnSlowed: 1.5,
    minDamage: 0.1,
    shieldDelay: 3,
    shieldRecharge: 2,
    // Superwaffen: Die Grundinhalte haben keine Rolle mit `fusion`; `addFusion()` rüstet Zweige und Gaben nach.
    fusion: { parts: 2, damage: 1.5, range: 1.1, fee: 0.5, megaLimit: 1, megaDamage: 2, megaRange: 1.2, megaFee: 1 },
    // Besondere Bauplätze: Die Grundinhalte haben keine; `addTiles()` rüstet Arten und Felder nach.
    tiles: {},
    difficulty: {
      easy: { name: 'Gemütlich', description: '', hp: 0.8, speed: 1, gold: 1.25, lives: 30, income: 1, score: 0.5 },
      normal: { name: 'Normal', description: '', hp: 1, speed: 1, gold: 1, lives: 20, income: 1, score: 1 },
      hard: { name: 'Knifflig', description: '', hp: 1.25, speed: 1.1, gold: 0.9, lives: 10, income: 0.8, score: 1.5 },
    },
  };

  /** @type {AbilityDef[]} */
  const abilities = [
    // Wirkt ohne Zielen auf alle: wirft 4 Sekunden zurück und verlangsamt.
    ability({ name: 'Zeitglocke', cooldown: 30, radius: 0, rewind: 4, slow: 0.5, slowDuration: 3 }),
    // Gezielter Schlag mit Schaden, nur am Boden.
    ability({ name: 'Steinschlag', cooldown: 20, radius: 1.5, damage: 5, hitsAir: false }),
    // Gezielter Schlag mit Schaden und Verlangsamung, auch gegen Flieger.
    ability({ name: 'Frostschlag', cooldown: 25, radius: 2, damage: 3, slow: 0.4, slowDuration: 2 }),
  ];

  return { ages: [age('stone', 'Steinzeit'), age('rome', 'Römisches Reich'), age('future', 'Nahe Zukunft')], archetypes, enemies, waves, maps, abilities, balance };
}

/**
 * Rüstet die Testinhalte mit Ausbauzweigen und Verschmelzung aus (docs/briefs/fusion.md). Getrennt von `makeContent()`,
 * damit die übrigen Tests weiter mit Türmen ohne Zweige rechnen. Runde Zahlen zum Nachrechnen:
 * - shooter: Zweig 0 halbiert die Feuerpause, Zweig 1 ist der Scharfschütze; Kern +20 % Schaden; Gabe Feuerpause x0,75,
 *   als Scharfschütze (Zweig 1) stattdessen die Gabe „Zielfernrohr“ (Reichweite x1,5).
 * - thrower: keine Zweige; Kern +0,2 Radius; Gabe +0,5 Radius.
 * - slower: Zweig 0 großer Teich, Zweig 1 Ätzpfütze; Kern Feld hält 1,5-mal so lang; Gabe „Kleber“ (25 % für 1,5 s).
 * - burner: keine Zweige; Kern Brand x1,5; Gabe „Brandsatz“ (1 Standardschuss Brand je Sekunde für 3 s).
 * - piercer: keine Zweige; Kern ein Sprung mehr; Gabe ignoriert Rüstung ganz, +15 % Reichweite.
 * - support: Zweig 0 mehr Reichweiten-Aura, Zweig 1 mehr Schadens-Aura; Kern doppelte Schadens-Aura; Gabe +25 % Schaden.
 * - pulser, beamer, flak: können nicht verschmelzen.
 * @param {Content} content
 * @returns {Content} dieselben Inhalte
 */
export function addFusion(content) {
  /**
   * @param {string} name
   * @param {StatMod} mod
   * @returns {TowerBranchDef}
   */
  const branch = (name, mod) => ({ name, summary: '', icon: name, mod });
  /**
   * @param {StatMod} core
   * @param {StatMod} gift
   * @returns {TowerFusionDef}
   */
  const fusion = (core, gift) => ({ core, coreText: '', gift, giftName: 'Gabe', giftText: '' });
  /** @param {string} id */
  const role = (id) => /** @type {TowerArchetypeDef} */ (content.archetypes.find((candidate) => candidate.id === id));

  role('shooter').branches = [
    branch('Doppelschuss', { mul: { cooldown: 0.5 } }),
    { ...branch('Scharfschütze', { set: { projectileSpeed: 16 }, mul: { damage: 2, cooldown: 3 }, add: { range: 1 } }), gift: { mod: { mul: { range: 1.5 } }, name: 'Zielfernrohr', text: '' } },
  ];
  role('shooter').fusion = fusion({ mul: { damage: 1.2 } }, { mul: { cooldown: 0.75 } });
  role('thrower').fusion = fusion({ add: { splash: 0.2 } }, { add: { splash: 0.5 } });
  role('slower').branches = [
    branch('Großer Teich', { set: { splash: 1.2, zone: 4 } }),
    branch('Ätzpfütze', { set: { dotDuration: 2 }, add: { dot: 0.5 } }),
  ];
  role('slower').fusion = fusion({ mul: { zone: 1.5 } }, { set: { slow: 0.25, slowDuration: 1.5 } });
  role('burner').fusion = fusion({ mul: { dot: 1.5 } }, { add: { dot: 1, dotDuration: 3 } });
  role('piercer').fusion = fusion({ add: { chain: 1 } }, { set: { pierce: 1 }, mul: { range: 1.15 } });
  role('support').branches = [
    branch('Fernsicht', { add: { auraRange: 0.15 } }),
    branch('Kriegstrommel', { set: { auraRange: 0 }, add: { auraDamage: 0.15 } }),
  ];
  role('support').fusion = fusion({ mul: { auraDamage: 2 } }, { mul: { damage: 1.25 } });
  return content;
}

/**
 * Rüstet die Testinhalte mit besonderen Bauplätzen aus (docs/briefs/fusion.md, Abschnitt 6). Runde Zahlen zum Nachrechnen:
 * - `high`: Reichweite x1,5, Preise unverändert;
 * - `well`: Schaden und Brand x2, plus 1 Standardschuss Schaden;
 * - `mud`: alle Preise x1,5, Werte unverändert.
 * Auf der Karte `bend`: high (2, 3), well (5, 3), mud (5, 4) und (6, 4); auf `keep` well (1, 0).
 * @param {Content} content
 * @returns {Content} dieselben Inhalte
 */
export function addTiles(content) {
  content.balance.tiles = {
    high: { name: 'Hügel', text: '', color: '#aaccee', icon: 'range', mod: { mul: { range: 1.5 } }, cost: 1 },
    well: { name: 'Quelle', text: '', color: '#ee66aa', icon: 'damage', mod: { mul: { damage: 2, dot: 2 }, add: { damage: 1 } }, cost: 1 },
    mud: { name: 'Matsch', text: '', color: '#aa8855', icon: 'marsh', mod: {}, cost: 1.5 },
  };
  const map = (/** @type {string} */ id) => /** @type {MapDef} */ (content.maps.find((candidate) => candidate.id === id));
  map('bend').tiles = [{ tx: 2, tz: 3, kind: 'high' }, { tx: 5, tz: 3, kind: 'well' }, { tx: 5, tz: 4, kind: 'mud' }, { tx: 6, tz: 4, kind: 'mud' }];
  map('keep').tiles = [{ tx: 1, tz: 0, kind: 'well' }];
  return content;
}

/**
 * Fügt die Karte `shift` hinzu, deren Wege sich mit dem Zeitalter wandeln (docs/briefs/fusion.md, Abschnitt 7). 12 x 7 Felder,
 * Basis (12, 3) außerhalb, gesperrt (0, 0):
 * - Stufe 0 (stone): ein Weg oben herum [-1,1] → (6,1) → (6,3) → Basis.
 * - Stufe 1 (rome): zwei Wege, der alte und ein zweites Tor unten [-1,5] → (3,5) → (3,3) → Basis.
 * - Stufe 2 (future): nur ein Weg unten [-1,5] → (9,5) → (9,3) → Basis; Flieger folgen dem Weg.
 * - Stufe 3: jenseits der drei Zeitalter, nie erreicht; ihr Weg durch Zeile 6 bleibt bebaubar.
 * @param {Content} content
 * @returns {Content} dieselben Inhalte
 */
export function addStages(content) {
  content.maps.push({
    id: 'shift',
    name: 'Wandel',
    description: '',
    width: 12,
    height: 7,
    paths: [[[-1, 1], [6, 1], [6, 3], [12, 3]]],
    blocked: [[0, 0]],
    stages: [
      null,
      { name: 'Das zweite Tor', text: 'Unten öffnet sich ein zweites Tor.', paths: [[[-1, 1], [6, 1], [6, 3], [12, 3]], [[-1, 5], [3, 5], [3, 3], [12, 3]]] },
      { name: 'Der Umweg', text: 'Nur noch das untere Tor.', paths: [[[-1, 5], [9, 5], [9, 3], [12, 3]]], flyersFollowPath: true },
      { name: 'Nie erreicht', text: 'Diese Stufe kommt nie.', paths: [[[-1, 6], [11, 6], [11, 3], [12, 3]]] },
    ],
    seed: 5,
  });
  return content;
}

/**
 * Rüstet Testinhalte, die schon `addFusion()` hinter sich haben, mit Rezepten aus (docs/briefs/fusion.md, 8 und 11):
 * - 'salve': shooter + shooter + shooter, nie gesperrt (wie die Flak): Sofort-Treffer mit Radius 1, trifft alles.
 * - 'brennglas': shooter + thrower + burner, gesperrt, Zwischenbosse der Zeitalter 0 bis 2: Strahl.
 * - 'teer': burner + slower + slower, gesperrt, Zwischenbosse der Zeitalter 1 und 2: Bodenfeld mit Brand.
 * - 'kanone': piercer + support + support, gesperrt, Zwischenbosse der Zeitalter 0 bis 2: Reichweite x3.
 * Je Zeitalter heißen die Rezepte `<id><Index>` (Megawaffe `<id>Mega<Index>`).
 * @param {Content} content
 * @returns {Content} dieselben Inhalte
 */
export function addRecipes(content) {
  /** @param {string} id */
  const role = (id) => /** @type {TowerArchetypeDef} */ (content.archetypes.find((candidate) => candidate.id === id));
  /**
   * @param {string} core
   * @param {import('../../src/types/content').FusionRecipe} recipe
   */
  const add = (core, recipe) => {
    const arch = role(core);
    const fusion = /** @type {TowerFusionDef} */ (arch.fusion);
    fusion.recipes = [...(fusion.recipes ?? []), recipe];
    arch.tiers.forEach((def, i) => {
      if (def) def.recipes = { ...(def.recipes ?? {}), [recipe.id]: { superName: `${recipe.id}${i}`, megaName: `${recipe.id}Mega${i}` } };
    });
  };
  add('shooter', { id: 'salve', name: 'Salve', gifts: ['shooter', 'shooter'], core: { set: { attack: 'hitscan', splash: 1 } }, coreText: 'Salve' });
  add('shooter', { id: 'brennglas', name: 'Brennglas', gifts: ['thrower', 'burner'], core: { set: { attack: 'beam', cooldown: 0.1 } }, coreText: 'Strahl', locked: true, ages: [0, 1, 2] });
  add('burner', { id: 'teer', name: 'Teer', gifts: ['slower', 'slower'], core: { set: { attack: 'projectile', zone: 4, slow: 0.3, slowDuration: 1 } }, coreText: 'Teer', locked: true, ages: [1, 2] });
  add('piercer', { id: 'kanone', name: 'Kanone', gifts: ['support', 'support'], core: { mul: { range: 3 } }, coreText: 'Kanone', locked: true, ages: [0, 1, 2] });
  return content;
}

/**
 * Rüstet Testinhalte, die schon `addFusion()` und `addRecipes()` hinter sich haben, mit einem kleinen Waffenpool aus
 * (docs/briefs/fusion.md, 12; docs/SIM.md, „Waffenpool“). Ohne `content.slots`: Jede klassische Rolle ist ihr eigener Platz.
 * - 'frost' (Platz slower): Puls um den Turm, bremst 40 % für 2 s, auch Flieger; Kern: Kette; Gabe Reichweite x1,2.
 * - 'sniper' (Platz shooter): harter Einzelschuss, nur Boden; Kern +50 % Schaden; Gabe Schaden x1,3.
 * - Rezept 'eisfeuer' bei burner (klassisch, gilt für jeden Kern des Platzes burner): Zutaten frost + frost, gesperrt, Zwischenbosse
 *   der Zeitalter 0 bis 2: waffengebunden an 'frost'.
 * - Rezept 'blitz' bei sniper: Zutaten shooter + slower (Plätze), frei: waffengebunden an 'sniper' als Kern.
 * @param {Content} content
 * @returns {Content} dieselben Inhalte
 */
export function addPool(content) {
  /** @param {string} id */
  const role = (id) => /** @type {TowerArchetypeDef} */ (content.archetypes.find((candidate) => candidate.id === id));
  /**
   * Ausprägungen mit dem Modell des Platzes und eigenen Namen.
   * @param {string} slot
   * @param {string} name
   * @returns {(TowerTierDef | null)[]}
   */
  const tiersOf = (slot, name) => role(slot).tiers.map((def, i) => (def ? { ...tier(`${name}${i}`), flavor: `${name} im Zeitalter ${i}`, model: def.model, superName: `${name}Super${i}`, megaName: `${name}Mega${i}` } : null));
  /** @type {TowerArchetypeDef} */
  const frost = {
    id: 'frost',
    slot: 'slower',
    name: 'Frost',
    role: 'slower',
    summary: '',
    color: '#888888',
    icon: 'slower',
    look: { accent: '#aaddff', marker: 'crystal' },
    unlockWave: role('slower').unlockWave,
    cost: 60,
    stats: stats({ attack: 'pulse', damage: 1, cooldown: 2, range: 1.6, slow: 0.4, slowDuration: 2 }),
    tiers: tiersOf('slower', 'frost'),
    fusion: { core: { set: { attack: 'hitscan', chain: 3, chainRange: 2 } }, coreText: '', gift: { mul: { range: 1.2 } }, giftName: 'Eis', giftText: '' },
  };
  /** @type {TowerArchetypeDef} */
  const sniper = {
    id: 'sniper',
    slot: 'shooter',
    name: 'Sniper',
    role: 'shooter',
    summary: '',
    color: '#888888',
    icon: 'shooter',
    look: { accent: '#ffaa66', marker: 'pennant' },
    unlockWave: role('shooter').unlockWave,
    cost: 50,
    stats: stats({ damage: 30, cooldown: 3, range: 5, hitsAir: false }),
    tiers: tiersOf('shooter', 'sniper'),
    fusion: {
      core: { mul: { damage: 1.5 } },
      coreText: '',
      gift: { mul: { damage: 1.3 } },
      giftName: 'Kimme',
      giftText: '',
      recipes: [{ id: 'blitz', name: 'Blitz', gifts: ['shooter', 'slower'], core: { set: { attack: 'hitscan', chain: 2, chainRange: 2 } }, coreText: 'Blitz' }],
    },
  };
  sniper.tiers.forEach((def, i) => {
    if (def) def.recipes = { blitz: { superName: `blitz${i}`, megaName: `blitzMega${i}` } };
  });
  content.archetypes.push(frost, sniper);
  const burner = role('burner');
  const fusion = /** @type {TowerFusionDef} */ (burner.fusion);
  fusion.recipes = [...(fusion.recipes ?? []), { id: 'eisfeuer', name: 'Eisfeuer', gifts: ['frost', 'frost'], core: { set: { attack: 'pulse' } }, coreText: 'Eisfeuer', locked: true, ages: [0, 1, 2] }];
  burner.tiers.forEach((def, i) => {
    if (def) def.recipes = { ...(def.recipes ?? {}), eisfeuer: { superName: `eisfeuer${i}`, megaName: `eisfeuerMega${i}` } };
  });
  return content;
}
