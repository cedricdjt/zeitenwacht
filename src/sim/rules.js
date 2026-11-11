// @ts-check
// Reine Rechenregeln der Simulation ohne Zustand: Turmwerte, Kosten, Gegnerwerte, Prämien.
// Verbindlich beschrieben in docs/SIM.md, Abschnitt „Rechenregeln“. Auch Oberfläche und Bots rechnen hiermit,
// damit überall dieselben Zahlen stehen. Keine Funktion verändert ihre Eingaben.

import { hashString, makeRng } from '../util/rng.js';

/** @import { AbilityDef, BoonDef, BoonTowerMod, Content, Difficulty, DifficultyDef, EnemyDef, FusionRecipe, NumericStat, RecipeLook, SlotDef, SpecialTileDef, StatMod, TowerArchetypeDef, TowerStats, WaveModifierDef } from '../types/content' */

/**
 * Zusätze eines Turms über Rolle, Technikstand und Stufe hinaus.
 * @typedef {object} TowerOpts
 * @property {number} [branch] Gewählter Ausbauzweig (Index in `arch.branches`); fehlt er oder ist er -1, wirkt kein Zweig
 * @property {boolean} [super] true: Der Turm ist eine Superwaffe
 * @property {boolean} [mega] true: Die Superwaffe ist eine Megawaffe (wirkt nur zusammen mit `super`)
 * @property {readonly string[]} [gifts] Kennungen der Rollen der aufgenommenen Zutaten in der Reihenfolge der Aufnahme
 * @property {readonly number[]} [giftBranches] Ausbauzweig jeder Zutat (parallel zu `gifts`); fehlt ein Eintrag, gilt 0
 * @property {string} [tile] Art des besonderen Bauplatzes, auf dem der Turm steht (Schlüssel in `balance.tiles`), oder ''
 * @property {readonly string[]} [boons] Gewählte Zeitgaben (Kennungen aus `content.boons`); ein `Tower` bringt sie mit
 * @property {string} [modifier] Eigenart der laufenden Welle (Schlüssel in `content.modifiers`), deren `towers` wirkt, oder ''
 * @property {string} [recipe] Rezept einer STEHENDEN Superwaffe (`Tower.recipe`, '' = keins); hat Vorrang vor `recipes`
 * @property {readonly string[]} [recipes] Freigeschaltete Rezepte der Partie (`SimState.recipes`), für Vorschauen einer
 *   Verschmelzung, die es noch nicht gibt; ohne `recipe` und `recipes` wirken nur Rezepte ohne `locked`
 */

/**
 * Zusammengefasste Wirkung aller gewählten Zeitgaben (ohne Kampfwerte und einmalige Gaben): Faktoren 1 und Zuschläge 0,
 * wenn keine Gabe etwas daran ändert.
 * @typedef {object} BoonEffects
 * @property {number} bounty Faktor auf Kopfgelder
 * @property {number} waveBonus Faktor auf Wellenprämie und Makellos-Zuschlag
 * @property {number} early Faktor auf die Frühstart-Prämie
 * @property {number} build Faktor auf Baupreise
 * @property {number} upgrade Faktor auf Ausbaupreise
 * @property {number} modernize Faktor auf Modernisierungspreise
 * @property {number} fuse Faktor auf die Gebühr des Verschmelzens
 * @property {number} sell Faktor auf den Anteil beim Verkauf
 * @property {number} cooldown Faktor auf die Abklingzeit der Fähigkeit
 * @property {number} rewind Faktor auf den Rückwurf der Fähigkeit
 * @property {number} slowDuration Faktor auf die Dauer der Verlangsamung der Fähigkeit
 * @property {number} burnSpread Größter Radius, in dem Brand beim Tod überspringt (0 = nie)
 * @property {number} burnOnSlowed Zuschlag auf `balance.burnOnSlowed`
 * @property {number} airDamage Faktor auf Schaden und Brand gegen Flieger
 * @property {number} bossDamage Faktor auf Schaden und Brand gegen Bosse
 * @property {number} megaLimit Zusätzliche Megawaffen
 * @property {number} lives Summe der positiven einmaligen Leben (hebt `maxLives`)
 */

/**
 * Werte eines Gegners in einer bestimmten Welle.
 * @typedef {object} EnemyStats
 * @property {number} hp Lebenspunkte (ganze Zahl, mindestens 1)
 * @property {number} armor Rüstung in Schadenspunkten je Treffer
 * @property {number} shield Schildpunkte (ganze Zahl)
 * @property {number} bounty Kopfgeld in Gold (ganze Zahl, mindestens 1)
 * @property {number} speed Tempo in Feldern pro Sekunde
 */

/**
 * Lage einer Welle im Feldzug.
 * @typedef {object} WaveAge
 * @property {number} age Index des Zeitalters
 * @property {number} waveInAge Index der Welle innerhalb ihres Zeitalters
 */

/** Höchste Ausbaustufe eines Turms. */
export const MAX_LEVEL = 3;

/** Alle Felder von TowerStats; nur diese lassen sich über `levels` und `tweak` überschreiben. */
const STAT_KEYS = /** @type {readonly (keyof TowerStats)[]} */ ([
  'attack', 'damage', 'cooldown', 'range', 'minRange', 'projectileSpeed', 'splash', 'slow', 'slowDuration', 'dot', 'dotDuration',
  'pierce', 'chain', 'chainRange', 'zone', 'ramp', 'rampTime', 'hitsAir', 'hitsGround', 'auraDamage', 'auraRate', 'auraRange',
  'push', 'mark', 'markDuration', 'seek', 'auraBounty',
]);
/** Die freiwilligen Felder von TowerStats: `towerStats` liefert sie nur, wenn Waffe, Stufe, Zweig, Kern oder eine Gabe sie nennt. */
const OPTIONAL_KEYS = /** @type {readonly ('push' | 'mark' | 'markDuration' | 'seek' | 'auraBounty')[]} */ (['push', 'mark', 'markDuration', 'seek', 'auraBounty']);

/**
 * Überträgt die in `patch` gesetzten Felder nach `stats`. Felder mit dem Wert `undefined` gelten als nicht gesetzt.
 * @param {TowerStats} stats
 * @param {Partial<TowerStats> | null | undefined} patch
 */
function applyPatch(stats, patch) {
  if (!patch) return;
  const target = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (stats));
  const source = /** @type {Record<string, unknown>} */ (patch);
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i];
    const value = source[key];
    if (value !== undefined) target[key] = value;
  }
}

/**
 * Löst den Schwierigkeitsgrad auf: Erlaubt sind die Kennung ('easy' | 'normal' | 'hard') oder gleich die Definition.
 * @param {Content} content
 * @param {Difficulty | DifficultyDef} difficulty
 * @returns {DifficultyDef}
 */
function difficultyDef(content, difficulty) {
  return typeof difficulty === 'string' ? content.balance.difficulty[difficulty] : difficulty;
}

/**
 * Rundet auf das nächste Vielfache von 5, mindestens 5.
 * @param {number} x
 * @returns {number}
 */
export function round5(x) {
  const rounded = Math.round(x / 5) * 5;
  return rounded > 5 ? rounded : 5;
}

/**
 * Anzahl aller Wellen des Feldzugs.
 * @param {Content} content
 * @returns {number}
 */
export function totalWaves(content) {
  let total = 0;
  for (let age = 0; age < content.waves.length; age++) total += content.waves[age].length;
  return total;
}

/**
 * Zeitalter und Stelle im Zeitalter zu einem fortlaufenden Wellenindex (ab 0).
 * Ein Index hinter der letzten Welle bleibt im letzten Zeitalter und zählt dort weiter
 * (für `totalWaves(content)` also: letztes Zeitalter, `waveInAge` = Anzahl seiner Wellen).
 * @param {Content} content
 * @param {number} wave Fortlaufender Index der Welle, ganze Zahl >= 0
 * @returns {WaveAge}
 */
export function waveAge(content, wave) {
  const waves = content.waves;
  let age = 0;
  let waveInAge = wave;
  while (age < waves.length - 1 && waveInAge >= waves[age].length) {
    waveInAge -= waves[age].length;
    age += 1;
  }
  return { age, waveInAge };
}

/** Die Zahlenfelder von TowerStats; nur sie lassen sich über `mul` und `add` verändern. */
const NUMERIC_KEYS = /** @type {readonly NumericStat[]} */ ([
  'damage', 'cooldown', 'range', 'minRange', 'projectileSpeed', 'splash', 'slow', 'slowDuration', 'dot', 'dotDuration',
  'pierce', 'chain', 'chainRange', 'zone', 'ramp', 'rampTime', 'auraDamage', 'auraRate', 'auraRange',
  'push', 'mark', 'markDuration', 'auraBounty',
]);

/**
 * Wendet `mul` und danach `add` einer Veränderung an. `add.damage` und `add.dot` zählen in Standardschüssen (`shot`),
 * alle anderen Felder in ihrer eigenen Einheit. Kein Wert fällt unter 0. Ein freiwilliges Feld, das fehlt, bleibt bei `mul`
 * weg und entsteht bei `add` (als 0 plus Zuschlag).
 * @param {TowerStats} stats
 * @param {StatMod | null | undefined} mod
 * @param {number} shot Schaden eines Standardschusses im Technikstand des Turms
 */
function applyMulAdd(stats, mod, shot) {
  if (!mod) return;
  const mul = mod.mul;
  if (mul) {
    for (let i = 0; i < NUMERIC_KEYS.length; i++) {
      const key = NUMERIC_KEYS[i];
      const factor = mul[key];
      const value = stats[key];
      if (factor !== undefined && value !== undefined) stats[key] = value * factor;
    }
  }
  const add = mod.add;
  if (add) {
    for (let i = 0; i < NUMERIC_KEYS.length; i++) {
      const key = NUMERIC_KEYS[i];
      const amount = add[key];
      if (amount === undefined) continue;
      const value = (stats[key] || 0) + (key === 'damage' || key === 'dot' ? amount * shot : amount);
      stats[key] = value > 0 ? value : 0;
    }
  }
}

// ------------------------------------------------------------------------------------------- Waffen, Plätze, Bewaffnung
// docs/SIM.md, „Waffenpool“. Ein Platz hat die Kennung seiner klassischen Waffe; eine Waffe ohne `slot` ist ihr eigener Platz.

/** So viele Waffen einer gezogenen Bewaffnung treffen mindestens Flieger (soweit die Plätze das hergeben). */
export const LOADOUT_AIR = 2;
/** Versuche der Ziehung, bevor sie die letzte Ziehung von Hand nachbessert. */
const DRAW_TRIES = 64;

/**
 * Platz einer Waffe: `arch.slot`, ohne Angabe ihre eigene Kennung.
 * @param {TowerArchetypeDef} arch
 * @returns {string}
 */
export function slotOf(arch) {
  return typeof arch.slot === 'string' && arch.slot !== '' ? arch.slot : arch.id;
}

/**
 * Ob die Waffe die klassische ihres Platzes ist (ihre Kennung ist die des Platzes).
 * @param {TowerArchetypeDef} arch
 */
export function isClassic(arch) {
  return slotOf(arch) === arch.id;
}

/**
 * Die Waffe zu einer Kennung oder null.
 * @param {Content} content
 * @param {string} id
 * @returns {TowerArchetypeDef | null}
 */
export function weaponById(content, id) {
  const list = content.archetypes;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/**
 * Waffe zu einer Kennung; scheitert mit Meldung, wenn es sie nicht gibt.
 * @param {Content} content
 * @param {string} id
 * @returns {TowerArchetypeDef}
 */
function archOf(content, id) {
  const arch = weaponById(content, id);
  if (!arch) throw new Error(`Unbekannte Turmrolle "${id}" als Zutat einer Superwaffe`);
  return arch;
}

/**
 * Die Plätze der Inhalte in Reihenfolge der Bauleiste: `content.slots`, ohne Angabe je Platz (in Reihenfolge des ersten Auftretens
 * unter den Waffen) ein Eintrag mit Name, Text, Farbe und Symbol seiner klassischen Waffe (sonst seiner ersten).
 * @param {Content} content
 * @returns {readonly SlotDef[]}
 */
export function contentSlots(content) {
  if (Array.isArray(content.slots)) return content.slots;
  /** @type {SlotDef[]} */
  const out = [];
  for (const arch of content.archetypes) {
    const id = slotOf(arch);
    if (out.some((slot) => slot.id === id)) continue;
    const head = weaponById(content, id) || arch;
    out.push({ id, name: head.role, summary: head.summary, color: head.color, icon: head.icon });
  }
  return out;
}

/**
 * Alle Waffen eines Platzes in der Reihenfolge von `content.archetypes` (die klassische steht vorn, wenn sie dort vorn steht).
 * @param {Content} content
 * @param {string} slot
 * @returns {TowerArchetypeDef[]}
 */
export function weaponsOfSlot(content, slot) {
  return content.archetypes.filter((arch) => slotOf(arch) === slot);
}

/**
 * Ob eine Waffe schon auf Stufe 1 Flieger bekämpfen kann (`stats.hitsAir`, ein Angriff und Schaden oder Brand; ein Turm, der
 * Flieger nur zeichnet oder bremst, zählt nicht).
 * @param {TowerArchetypeDef} arch
 */
export function hitsFliers(arch) {
  const s = arch.stats;
  return s.hitsAir === true && s.attack !== 'none' && (s.damage > 0 || s.dot > 0);
}

/**
 * Die klassische Bewaffnung: je Platz die Waffe mit seiner Kennung (fehlt sie, die erste Waffe des Platzes).
 * @param {Content} content
 * @returns {string[]} Kennungen in der Reihenfolge der Plätze
 */
export function classicLoadout(content) {
  return contentSlots(content).map((slot) => {
    const own = weaponById(content, slot.id);
    if (own && slotOf(own) === slot.id) return own.id;
    const first = weaponsOfSlot(content, slot.id)[0];
    return first ? first.id : slot.id;
  });
}

/**
 * Zieht eine Bewaffnung aus dem Startwert (docs/SIM.md, „Waffenpool“): je Platz gleichverteilt eine seiner Waffen, mit eigenem
 * Zufallsgenerator `makeRng(hashString('waffen:' + (seed >>> 0)))`. Treffen weniger als `LOADOUT_AIR` Waffen Flieger (soweit die
 * Plätze so viele hergeben), wird neu gezogen; nach 64 Versuchen wird die letzte Ziehung nachgebessert (Plätze in Reihenfolge
 * bekommen ihre erste Flieger-Waffe). Gleicher Startwert, gleiche Inhalte: gleiche Bewaffnung.
 * @param {Content} content
 * @param {number} seed
 * @returns {string[]} Kennungen in der Reihenfolge der Plätze
 */
export function drawLoadout(content, seed) {
  const slots = contentSlots(content);
  const lists = slots.map((slot) => weaponsOfSlot(content, slot.id));
  let possible = 0;
  for (const list of lists) if (list.some(hitsFliers)) possible += 1;
  const need = possible < LOADOUT_AIR ? possible : LOADOUT_AIR;
  const draw = makeRng(hashString(`waffen:${seed >>> 0}`));
  /** @type {TowerArchetypeDef[]} */
  let picks = [];
  for (let attempt = 0; attempt < DRAW_TRIES; attempt++) {
    picks = lists.map((list) => list[Math.floor(draw.next() * list.length)]);
    if (picks.filter(hitsFliers).length >= need) return picks.map((arch) => arch.id);
  }
  let air = picks.filter(hitsFliers).length;
  for (let i = 0; i < lists.length && air < need; i++) {
    if (hitsFliers(picks[i])) continue;
    const swap = lists[i].find(hitsFliers);
    if (!swap) continue;
    picks[i] = swap;
    air += 1;
  }
  return picks.map((arch) => arch.id);
}

/**
 * Prüft eine Bewaffnung: genau eine bekannte Waffe je Platz. Liefert die Kennungen in der Reihenfolge der Plätze oder wirft mit
 * deutscher Meldung.
 * @param {Content} content
 * @param {readonly string[]} ids
 * @returns {string[]}
 */
export function orderLoadout(content, ids) {
  if (!Array.isArray(ids)) throw new Error('Bewaffnung unlesbar: Sie muss eine Liste von Waffen sein');
  const slots = contentSlots(content);
  /** @type {(string | null)[]} */
  const out = new Array(slots.length).fill(null);
  for (const id of ids) {
    const arch = typeof id === 'string' ? weaponById(content, id) : null;
    if (!arch) throw new Error(`Bewaffnung unlesbar: Die Waffe "${id}" gibt es nicht`);
    const at = slots.findIndex((slot) => slot.id === slotOf(arch));
    if (at < 0) throw new Error(`Bewaffnung unlesbar: Die Waffe "${id}" gehört zu keinem Platz`);
    if (out[at] !== null) throw new Error(`Bewaffnung unlesbar: Für den Platz "${slots[at].id}" stehen zwei Waffen ("${out[at]}" und "${id}")`);
    out[at] = id;
  }
  const missing = slots.findIndex((_, i) => out[i] === null);
  if (missing >= 0) throw new Error(`Bewaffnung unlesbar: Für den Platz "${slots[missing].id}" fehlt eine Waffe`);
  return /** @type {string[]} */ (out);
}

/**
 * Löst `SimConfig.loadout` auf: ohne Angabe oder 'classic' die klassische Bewaffnung, 'random' die Ziehung aus `seed`, eine Liste
 * geprüft und nach Plätzen geordnet.
 * @param {Content} content
 * @param {'classic' | 'random' | readonly string[] | undefined} spec
 * @param {number} seed
 * @returns {string[]}
 */
export function resolveLoadout(content, spec, seed) {
  if (spec === undefined || spec === null || spec === 'classic') return classicLoadout(content);
  if (spec === 'random') return drawLoadout(content, seed);
  if (typeof spec === 'string') throw new Error(`Unbekannte Bewaffnung "${spec}" (erlaubt: 'classic', 'random' oder eine Liste von Waffen)`);
  return orderLoadout(content, spec);
}

// ------------------------------------------------------------------------------------------- Gaben und Rezepte

/**
 * Die Gabe einer Zutat dieser Rolle mit diesem Zweig: `arch.branches[branch].gift.mod`, sonst `arch.fusion.gift`, sonst null.
 * @param {TowerArchetypeDef} giver
 * @param {number} branch
 * @returns {StatMod | null}
 */
export function giftMod(giver, branch) {
  const chosen = giver.branches && branch >= 0 ? giver.branches[branch] : undefined;
  if (chosen && chosen.gift) return chosen.gift.mod;
  return giver.fusion ? giver.fusion.gift : null;
}

/**
 * Ob ein Rezept als freigeschaltet gilt: Rezepte ohne `locked` immer; gesperrte nur, wenn `unlocked` sie nennt (eine Liste
 * freigeschalteter Rezepte) oder ist (die Kennung im `Tower.recipe` einer stehenden Superwaffe).
 * @param {FusionRecipe} recipe
 * @param {RecipeUnlocks} unlocked
 */
function isOpen(recipe, unlocked) {
  if (recipe.locked !== true) return true;
  if (unlocked === undefined || unlocked === null) return false;
  return typeof unlocked === 'string' ? unlocked === recipe.id : unlocked.includes(recipe.id);
}

/**
 * Ob ein Eintrag von `FusionRecipe.gifts` (Platz oder Waffe) die Zutat `gift` (Kennung ihrer Waffe) trifft. Ohne Inhalte zählt nur
 * Gleichheit (so rechnen ältere Aufrufer wie bisher: bei der klassischen Bewaffnung ist die Waffe der Platz).
 * @param {string} entry
 * @param {string} gift
 * @param {Content | undefined} content
 */
function entryHits(entry, gift, content) {
  if (entry === gift) return true;
  if (!content) return false;
  const named = weaponById(content, entry);
  if (!named || !isClassic(named)) return false;
  const giver = weaponById(content, gift);
  return giver !== null && slotOf(giver) === entry;
}

/**
 * Ob die ersten `want.length` Zutaten als Multimenge zu `want` passen (jeder Eintrag trifft genau eine Zutat, `entryHits`).
 * @param {readonly string[]} want
 * @param {readonly string[]} gifts
 * @param {Content | undefined} content
 */
function sameMix(want, gifts, content) {
  const n = want.length;
  if (gifts.length < n) return false;
  /** @type {(i: number, used: number) => boolean} */
  const match = (i, used) => {
    if (i === n) return true;
    for (let j = 0; j < n; j++) {
      if ((used & (1 << j)) !== 0 || !entryHits(want[i], gifts[j], content)) continue;
      if (match(i + 1, used | (1 << j))) return true;
    }
    return false;
  };
  return match(0, 0);
}

/**
 * Freigeschaltete Rezepte: eine Liste (`SimState.recipes`, für Vorschauen) oder die Kennung im `Tower.recipe` einer stehenden
 * Superwaffe ('' = keins). Ohne Angabe gelten nur Rezepte ohne `locked`.
 * @typedef {readonly string[] | string | undefined | null} RecipeUnlocks
 */

/**
 * Ein Rezept samt der Waffe, bei der es steht.
 * @typedef {{ recipe: FusionRecipe, owner: TowerArchetypeDef }} RecipeEntry
 */

/**
 * Wie waffengebunden ein Rezept ist: Anzahl der Zutaten, die eine Waffe statt eines Platzes nennen, plus 1, wenn es bei einer nicht
 * klassischen Waffe steht. Spezifischere Rezepte gehen vor.
 * @param {Content} content
 * @param {RecipeEntry} entry
 */
function specificity(content, entry) {
  let n = isClassic(entry.owner) ? 0 : 1;
  for (const id of entry.recipe.gifts) {
    const named = weaponById(content, id);
    if (named && !isClassic(named)) n += 1;
  }
  return n;
}

/**
 * Rezepte, die für einen Kern dieser Waffe in Frage kommen. Ohne Inhalte: die eigenen. Mit Inhalten: die eigenen (waffengebunden,
 * wenn die Waffe nicht klassisch ist) und die der klassischen Waffe ihres Platzes, die spezifischeren zuerst, sonst in
 * Reihenfolge der Liste.
 * @param {TowerArchetypeDef} arch
 * @param {Content | undefined} content
 * @returns {RecipeEntry[]}
 */
function recipeEntries(arch, content) {
  /** @type {RecipeEntry[]} */
  const out = [];
  const own = arch.fusion ? arch.fusion.recipes : undefined;
  if (own) for (const recipe of own) out.push({ recipe, owner: arch });
  if (!content) return out;
  if (!isClassic(arch)) {
    const classic = weaponById(content, slotOf(arch));
    const shared = classic && classic.fusion ? classic.fusion.recipes : undefined;
    if (classic && shared) for (const recipe of shared) out.push({ recipe, owner: classic });
  }
  if (out.length < 2) return out;
  const ranked = out.map((entry, index) => ({ entry, index, rank: specificity(content, entry) }));
  ranked.sort((a, b) => b.rank - a.rank || a.index - b.index);
  return ranked.map((r) => r.entry);
}

/**
 * Das wirkende Rezept samt seiner Waffe, oder null.
 * @param {TowerArchetypeDef} arch
 * @param {readonly string[] | undefined} gifts
 * @param {RecipeUnlocks} unlocked
 * @param {Content | undefined} content
 * @returns {RecipeEntry | null}
 */
function findRecipe(arch, gifts, unlocked, content) {
  if (!gifts) return null;
  for (const entry of recipeEntries(arch, content)) {
    if (isOpen(entry.recipe, unlocked) && sameMix(entry.recipe.gifts, gifts, content)) return entry;
  }
  return null;
}

/**
 * Das Rezept, das eine Superwaffe mit diesem Kern und diesen Zutaten ergibt, oder null (docs/SIM.md, „Rezepte“ und „Waffenpool“).
 * Verglichen werden die ersten `recipe.gifts.length` Zutaten (das ist `balance.fusion.parts`) als Multimenge; Reihenfolge und Zweige
 * zählen nicht. Ein Eintrag des Rezepts, der einen Platz nennt, trifft jede Waffe dieses Platzes, einer, der eine Waffe nennt, nur
 * sie. Eine Megawaffe behält so das Rezept ihrer ersten Verschmelzung.
 * Ein gesperrtes Rezept (`locked`) zählt nur, wenn `unlocked` es freigibt:
 * - Vorschau einer Verschmelzung: `fusionRecipe(arch, gifts, sim.state.recipes, sim.content)`;
 * - stehende Superwaffe: `fusionRecipe(t.arch, t.gifts, t.recipe, sim.content)` (ihr beim Verschmelzen festgelegtes Rezept).
 * Ohne `content` kennt die Funktion nur die Rezepte der Waffe selbst und vergleicht Kennungen (wie vor dem Waffenpool); das
 * genügt für die klassische Bewaffnung, nicht für Waffen des Pools.
 * @param {TowerArchetypeDef} arch Waffe des Kerns
 * @param {readonly string[] | undefined} gifts Waffen der Zutaten in Reihenfolge der Aufnahme
 * @param {RecipeUnlocks} [unlocked] Freigeschaltete Rezepte; ohne Angabe nur Rezepte ohne `locked`
 * @param {Content} [content] Inhalte der Partie (für Plätze und die Rezepte des Platzes)
 * @returns {FusionRecipe | null}
 */
export function fusionRecipe(arch, gifts, unlocked, content) {
  const found = findRecipe(arch, gifts, unlocked, content);
  return found ? found.recipe : null;
}

/**
 * Das gesperrte Rezept, das diese Zutaten treffen, solange es nicht freigeschaltet ist; null, wenn ein freigeschaltetes Rezept
 * wirkt oder die Zutaten keines treffen. Für die Vorschau „noch nicht freigeschaltet“.
 * @param {TowerArchetypeDef} arch Waffe des Kerns
 * @param {readonly string[] | undefined} gifts
 * @param {RecipeUnlocks} [unlocked] wie bei `fusionRecipe`
 * @param {Content} [content] wie bei `fusionRecipe`
 * @returns {FusionRecipe | null}
 */
export function lockedRecipe(arch, gifts, unlocked, content) {
  if (!gifts || findRecipe(arch, gifts, unlocked, content) !== null) return null;
  for (const entry of recipeEntries(arch, content)) {
    if (!isOpen(entry.recipe, unlocked) && sameMix(entry.recipe.gifts, gifts, content)) return entry.recipe;
  }
  return null;
}

/**
 * Das Rezept zu einer Kennung (in allen Waffen) samt der Waffe, bei der es steht (bei gewöhnlichen Rezepten die klassische Waffe
 * des Kern-Platzes), oder null.
 * @param {Content} content
 * @param {string} id
 * @returns {{ recipe: FusionRecipe, arch: TowerArchetypeDef } | null}
 */
export function recipeById(content, id) {
  for (const arch of content.archetypes) {
    const list = arch.fusion ? arch.fusion.recipes : undefined;
    if (!list) continue;
    for (const recipe of list) if (recipe.id === id) return { recipe, arch };
  }
  return null;
}

/**
 * Waffen, die eine Partie haben muss, um das Rezept zu bauen: die Waffe, bei der es steht, wenn sie nicht klassisch ist, und jede
 * Zutat, die eine Waffe statt eines Platzes nennt. Leer für gewöhnliche Rezepte (jede Bewaffnung hat jeden Platz).
 * @param {Content} content
 * @param {string} id Kennung des Rezepts
 * @returns {string[]}
 */
export function recipeWeapons(content, id) {
  const found = recipeById(content, id);
  if (!found) return [];
  /** @type {string[]} */
  const out = [];
  if (!isClassic(found.arch)) out.push(found.arch.id);
  for (const entry of found.recipe.gifts) {
    const named = weaponById(content, entry);
    if (named && !isClassic(named) && !out.includes(entry)) out.push(entry);
  }
  return out;
}

/**
 * Ob eine Partie mit dieser Bewaffnung das Rezept bauen kann (alle `recipeWeapons` sind darin). Unbekannte Rezepte: false.
 * @param {Content} content
 * @param {string} id
 * @param {readonly string[]} loadout
 */
export function recipeFits(content, id, loadout) {
  if (!recipeById(content, id)) return false;
  return recipeWeapons(content, id).every((weapon) => loadout.includes(weapon));
}

/**
 * Namen und Angriffsbild der Rezept-Superwaffe in diesem Zeitalter, oder null (kein Rezept oder keine Angabe im Zeitalter).
 * Gesucht wird zuerst in der Ausprägung des Kerns, dann in der der Waffe, bei der das Rezept steht.
 * Stehende Superwaffe: `recipeLook(t.arch, t.tier, t.gifts, t.recipe, sim.content)`; Vorschau: `recipeLook(arch, tier, gifts,
 * sim.state.recipes, sim.content)`. Ohne `content` wie bei `fusionRecipe` nur für die klassische Bewaffnung.
 * @param {TowerArchetypeDef} arch Waffe des Kerns
 * @param {number} tier Technikstand
 * @param {readonly string[] | undefined} gifts Waffen der Zutaten
 * @param {RecipeUnlocks} [unlocked] wie bei `fusionRecipe`
 * @param {Content} [content] wie bei `fusionRecipe`
 * @returns {RecipeLook | null}
 */
export function recipeLook(arch, tier, gifts, unlocked, content) {
  const found = findRecipe(arch, gifts, unlocked, content);
  if (!found) return null;
  const id = found.recipe.id;
  for (const source of [arch, found.owner]) {
    const def = source.tiers[tier];
    if (def && def.recipes && Object.prototype.hasOwnProperty.call(def.recipes, id)) return def.recipes[id];
  }
  return null;
}

/**
 * Das Rezept eines Turms oder einer geplanten Verschmelzung nach `opts`: `opts.recipe` (stehende Superwaffe), sonst
 * `opts.recipes` (freigeschaltete der Partie).
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {TowerOpts} opts
 * @returns {FusionRecipe | null}
 */
function recipeOf(content, arch, opts) {
  return fusionRecipe(arch, opts.gifts, opts.recipe !== undefined ? opts.recipe : opts.recipes, content);
}

/**
 * Die Veränderung des Kerns einer Superwaffe: die des Rezepts, sonst `fusion.core`, sonst null.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {TowerOpts} opts
 * @returns {StatMod | null}
 */
function coreMod(content, arch, opts) {
  if (!arch.fusion) return null;
  const recipe = recipeOf(content, arch, opts);
  return recipe ? recipe.core : arch.fusion.core || null;
}

/**
 * Der Ausbauzweig, der für diese Stufe und Angabe wirkt, oder null.
 * @param {TowerArchetypeDef} arch
 * @param {number} level
 * @param {TowerOpts | undefined} opts
 */
function branchOf(arch, level, opts) {
  if (!opts || level < MAX_LEVEL || !arch.branches) return null;
  const index = opts.branch;
  if (index === undefined || index < 0) return null;
  return arch.branches[index] || null;
}

/**
 * Die Art eines besonderen Bauplatzes oder null (leere Kennung, unbekannte Art, Inhalte ohne `balance.tiles`).
 * @param {Content} content
 * @param {string | undefined} kind Schlüssel in `balance.tiles`
 * @returns {SpecialTileDef | null}
 */
export function tileDef(content, kind) {
  const all = content.balance.tiles;
  if (!kind || !all || !Object.prototype.hasOwnProperty.call(all, kind)) return null;
  return all[kind];
}

/**
 * Preis auf einem besonderen Bauplatz: `round5(price * cost)` mit dem Kostenfaktor der Art; bei Faktor 1, ohne Art oder bei
 * einem Preis <= 0 bleibt der Preis unverändert (0 bleibt 0, -1 für „gibt es nicht“ bleibt -1).
 * @param {Content} content
 * @param {string | undefined} kind
 * @param {number} price Preis ohne Aufschlag
 * @returns {number}
 */
export function tilePrice(content, kind, price) {
  const def = tileDef(content, kind);
  if (!def || def.cost === 1 || !(price > 0)) return price;
  return round5(price * def.cost);
}

/**
 * Kampfwerte eines Turms ohne Aura-Boni. Verbindliche Reihenfolge (docs/SIM.md, „Rechenregeln“):
 * 1. `arch.stats`, 2. `arch.levels[level - 1]`, 3. `set` des Ausbauzweigs (Stufe 3 mit Zweig), 4. bei Superwaffen `fusion.core.set`
 * der Kernrolle und das `set` der Gabe jeder Zutat in Reihenfolge (`giftMod`: Gabe ihres Zweigs, sonst `fusion.gift`),
 * 5. `arch.tiers[tier].tweak` (ein Zahlenfeld, das auch die Stufe setzt, bekommt den Zuwachs der Stufe obendrauf:
 * `tweak + (levels - stats)`; bei Superwaffen gewinnt für `attack` das `set` des Kerns über den `tweak`), 6. Skalierung: `damage` und `dot` mal
 * `ageDamage[tier] * levelDamage[level - 1]`, `range` mal `levelRange[level - 1]`, 7. `mul`, dann `add` des Zweigs,
 * 8. bei Superwaffen `damage` und `dot` mal `balance.fusion.damage`, `range` mal `balance.fusion.range`, dann `mul`/`add`
 * des Kerns, dann `mul`/`add` jeder Zutat in Reihenfolge, danach `pierce <= 1` und `slow <= MAX_SLOW`. Bei Megawaffen (`super` und `mega`) gelten dort `balance.fusion.megaDamage`
 * und `megaRange` statt `damage` und `range`; die Gaben aller vier Zutaten wirken in Reihenfolge, die des Kerns einmal.
 * 9. `mul`/`add` des besonderen Bauplatzes `balance.tiles[opts.tile].mod`, 10. `mul`/`add` (und `hitsAir`) der passenden
 * Einträge `effect.towers` der Zeitgaben aus `opts.boons`, 11. `mul`/`add` der Eigenart der Welle `opts.modifier`; danach,
 * falls 10 oder 11 etwas geändert haben, `pierce <= 1` und `slow <= MAX_SLOW`.
 * Ergeben Kern und Zutaten ein Rezept (`fusionRecipe` mit `opts.recipe`, sonst `opts.recipes`, und den Inhalten, also auch nach Platz;
 * gesperrte Rezepte nur, wenn dort freigegeben), tritt dessen `core` in 4., 5. und 8. an die Stelle von `fusion.core`.
 * Filter `roles` einer Zeitgabe vergleichen den Platz der Waffe (`slotOf`), `weapons` die Waffe.
 * Ohne `opts` gelten die Werte eines Turms ohne Zweig und ohne Verschmelzung.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} tier Technikstand (Index des Zeitalters)
 * @param {number} level Ausbaustufe 1..3
 * @param {TowerOpts} [opts] Ausbauzweig, Verschmelzung und besonderer Bauplatz
 * @returns {TowerStats} Neues Objekt mit genau den Feldern von TowerStats
 */
export function towerStats(content, arch, tier, level, opts) {
  const balance = content.balance;
  const base = arch.stats;
  /** @type {TowerStats} */
  const stats = {
    attack: base.attack,
    damage: base.damage,
    cooldown: base.cooldown,
    range: base.range,
    minRange: base.minRange,
    projectileSpeed: base.projectileSpeed,
    splash: base.splash,
    slow: base.slow,
    slowDuration: base.slowDuration,
    dot: base.dot,
    dotDuration: base.dotDuration,
    pierce: base.pierce,
    chain: base.chain,
    chainRange: base.chainRange,
    zone: base.zone,
    ramp: base.ramp,
    rampTime: base.rampTime,
    hitsAir: base.hitsAir,
    hitsGround: base.hitsGround,
    auraDamage: base.auraDamage,
    auraRate: base.auraRate,
    auraRange: base.auraRange,
  };
  for (let i = 0; i < OPTIONAL_KEYS.length; i++) {
    const key = OPTIONAL_KEYS[i];
    if (base[key] !== undefined) /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (stats))[key] = base[key];
  }
  // 2. Stufe
  const levelPatch = arch.levels ? arch.levels[level - 1] : undefined;
  applyPatch(stats, levelPatch);
  // 3. Zweig
  const branch = branchOf(arch, level, opts);
  if (branch && branch.mod) applyPatch(stats, branch.mod.set);
  // 4. Verschmelzung
  const fused = opts !== undefined && opts.super === true;
  /** @type {(StatMod | null)[]} */
  const giftMods = [];
  const core = fused ? coreMod(content, arch, opts) : null;
  if (fused) {
    if (core) applyPatch(stats, core.set);
    const gifts = opts.gifts || [];
    const giftBranches = opts.giftBranches || [];
    for (let i = 0; i < gifts.length; i++) {
      const giver = archOf(content, gifts[i]);
      const b = giftBranches[i];
      const mod = giftMod(giver, b === undefined ? 0 : b);
      giftMods.push(mod);
      if (mod) applyPatch(stats, mod.set);
    }
  }
  // 5. Zeitalter; der Zuwachs der Stufe auf einem Zahlenfeld bleibt dabei erhalten.
  const tierDef = arch.tiers[tier];
  const tweak = tierDef ? tierDef.tweak : undefined;
  if (tweak) {
    applyPatch(stats, tweak);
    if (levelPatch) {
      for (let i = 0; i < NUMERIC_KEYS.length; i++) {
        const key = NUMERIC_KEYS[i];
        const levelValue = levelPatch[key];
        const tweakValue = tweak[key];
        if (levelValue === undefined || tweakValue === undefined) continue;
        const value = tweakValue + (levelValue - (base[key] || 0));
        stats[key] = value > 0 ? value : 0;
      }
    }
    // Bei Superwaffen bestimmt der Kern die Angriffsart, auch wenn das Zeitalter sie sonst setzt.
    const coreAttack = core && core.set ? core.set.attack : undefined;
    if (coreAttack !== undefined) stats.attack = coreAttack;
  }
  // 6. Skalierung
  const damageFactor = balance.ageDamage[tier] * balance.levelDamage[level - 1];
  stats.damage *= damageFactor;
  stats.dot *= damageFactor;
  stats.range *= balance.levelRange[level - 1];
  // 7. und 8.
  const shot = balance.baseDamage * balance.ageDamage[tier];
  if (branch) applyMulAdd(stats, branch.mod, shot);
  if (fused) {
    const fusion = balance.fusion;
    if (fusion) {
      const mega = opts.mega === true;
      const damage = mega ? fusion.megaDamage : fusion.damage;
      const range = mega ? fusion.megaRange : fusion.range;
      stats.damage *= damage;
      stats.dot *= damage;
      stats.range *= range;
    }
    applyMulAdd(stats, core, shot);
    for (let i = 0; i < giftMods.length; i++) applyMulAdd(stats, giftMods[i], shot);
    // Gaben addieren Durchschlag und Verlangsamung: mehr als ganz geht nicht, ganz anhalten auch nicht.
    if (stats.pierce > 1) stats.pierce = 1;
    if (stats.slow > MAX_SLOW) stats.slow = MAX_SLOW;
  }
  // 9. Besonderer Bauplatz
  const place = opts ? tileDef(content, opts.tile) : null;
  if (place) applyMulAdd(stats, place.mod, shot);
  if (!opts) return stats;
  // 10. Zeitgaben, in Reihenfolge der Wahl
  const boons = opts.boons;
  let touched = false;
  if (boons && boons.length > 0) {
    for (let i = 0; i < boons.length; i++) {
      const boon = boonDef(content, boons[i]);
      const list = boon && boon.effect ? boon.effect.towers : undefined;
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        const entry = list[k];
        if (!boonMatches(content, entry, arch, level, fused, opts)) continue;
        applyMulAdd(stats, entry.mod, shot);
        if (entry.hitsAir === true) stats.hitsAir = true;
        touched = true;
      }
    }
  }
  // 11. Eigenart der laufenden Welle
  const modifier = modifierDef(content, opts.modifier);
  if (modifier && modifier.towers) {
    applyMulAdd(stats, modifier.towers, shot);
    touched = true;
  }
  if (touched) {
    // Grenzen: mehr als ganz kann Rüstung nicht ignoriert werden, und nichts bringt einen Gegner ganz zum Stehen.
    if (stats.pierce > 1) stats.pierce = 1;
    if (stats.slow > MAX_SLOW) stats.slow = MAX_SLOW;
  }
  return stats;
}

/** Höchste Verlangsamung, die Zeitgaben und Eigenarten zulassen. */
export const MAX_SLOW = 0.9;

/**
 * Ob eine Kampfwert-Änderung einer Zeitgabe auf diesen Turm passt (alle angegebenen Filter). `roles` nennt Plätze, `weapons` Waffen.
 * @param {Content} content
 * @param {BoonTowerMod} entry
 * @param {TowerArchetypeDef} arch
 * @param {number} level
 * @param {boolean} fused
 * @param {TowerOpts} opts
 */
function boonMatches(content, entry, arch, level, fused, opts) {
  if (entry.roles && !entry.roles.includes(slotOf(arch))) return false;
  if (entry.weapons && !entry.weapons.includes(arch.id)) return false;
  if (entry.super !== undefined && entry.super !== fused) return false;
  if (entry.branch !== undefined) {
    const own = level >= MAX_LEVEL && opts.branch !== undefined ? opts.branch : -1;
    if (own !== entry.branch) return false;
  }
  if (entry.tiles && !(opts.tile && entry.tiles.includes(opts.tile))) return false;
  if (entry.recipe !== undefined) {
    const recipe = fused ? recipeOf(content, arch, opts) : null;
    if (!recipe || recipe.id !== entry.recipe) return false;
  }
  return true;
}

/**
 * Die Zeitgabe zu einer Kennung oder null.
 * @param {Content} content
 * @param {string} id
 * @returns {BoonDef | null}
 */
export function boonDef(content, id) {
  const list = content.boons;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/**
 * Die Eigenart einer Welle zu einer Kennung oder null (leere Kennung, unbekannt, Inhalte ohne `modifiers`).
 * @param {Content} content
 * @param {string | undefined} id
 * @returns {WaveModifierDef | null}
 */
export function modifierDef(content, id) {
  const all = content.modifiers;
  if (!id || !all || !Object.prototype.hasOwnProperty.call(all, id)) return null;
  return all[id];
}

/**
 * Fasst die Wirkung der gewählten Zeitgaben zusammen (docs/SIM.md, „Zeitgaben“). Faktoren multiplizieren sich, Zuschläge
 * addieren sich, `burnSpread` nimmt den größten Radius.
 * @param {Content} content
 * @param {readonly string[]} boons
 * @returns {BoonEffects}
 */
export function boonEffects(content, boons) {
  /** @type {BoonEffects} */
  const out = { bounty: 1, waveBonus: 1, early: 1, build: 1, upgrade: 1, modernize: 1, fuse: 1, sell: 1, cooldown: 1, rewind: 1, slowDuration: 1, burnSpread: 0, burnOnSlowed: 0, airDamage: 1, bossDamage: 1, megaLimit: 0, lives: 0 };
  for (let i = 0; i < boons.length; i++) {
    const boon = boonDef(content, boons[i]);
    if (!boon || !boon.effect) continue;
    const { economy, ability, rules, grant } = boon.effect;
    if (economy) {
      for (const key of /** @type {const} */ (['bounty', 'waveBonus', 'early', 'build', 'upgrade', 'modernize', 'fuse', 'sell'])) {
        const f = economy[key];
        if (f !== undefined) out[key] *= f;
      }
    }
    if (ability) {
      for (const key of /** @type {const} */ (['cooldown', 'rewind', 'slowDuration'])) {
        const f = ability[key];
        if (f !== undefined) out[key] *= f;
      }
    }
    if (rules) {
      if (rules.burnSpread !== undefined && rules.burnSpread > out.burnSpread) out.burnSpread = rules.burnSpread;
      if (rules.burnOnSlowed !== undefined) out.burnOnSlowed += rules.burnOnSlowed;
      if (rules.airDamage !== undefined) out.airDamage *= rules.airDamage;
      if (rules.bossDamage !== undefined) out.bossDamage *= rules.bossDamage;
      if (rules.megaLimit !== undefined) out.megaLimit += rules.megaLimit;
    }
    if (grant && grant.lives !== undefined && grant.lives > 0) out.lives += grant.lives;
  }
  return out;
}

/**
 * Wie viele Megawaffen zugleich stehen dürfen: `balance.fusion.megaLimit` plus die Zuschläge der gewählten Zeitgaben
 * (`effect.rules.megaLimit`), nie unter 0; 0 ohne `balance.fusion`. Sim, Anzeige und Autopilot fragen alle hier.
 * @param {Content} content
 * @param {readonly string[]} boons
 * @returns {number}
 */
export function megaLimit(content, boons) {
  const fusion = content.balance.fusion;
  if (!fusion) return 0;
  let limit = fusion.megaLimit;
  for (let i = 0; i < boons.length; i++) {
    const boon = boonDef(content, boons[i]);
    const extra = boon && boon.effect && boon.effect.rules ? boon.effect.rules.megaLimit : undefined;
    if (extra !== undefined) limit += extra;
  }
  return limit > 0 ? limit : 0;
}

/**
 * Preis mit dem Faktor der Zeitgaben: `round5(price * factor)`; bei Faktor 1 oder einem Preis <= 0 bleibt der Preis
 * (0 bleibt 0, -1 für „gibt es nicht“ bleibt -1). Ein Faktor 0 macht den Preis 0.
 * @param {number} price
 * @param {number} factor
 * @returns {number}
 */
export function boonPrice(price, factor) {
  if (factor === 1 || !(price > 0)) return price;
  if (!(factor > 0)) return 0;
  return round5(price * factor);
}

/**
 * Die Fähigkeit mit den Änderungen der Zeitgaben: dieselbe Definition, wenn sich nichts ändert, sonst eine Kopie mit
 * `cooldown`, `rewind` und `slowDuration` mal ihren Faktoren.
 * @param {AbilityDef} def
 * @param {BoonEffects} effects
 * @returns {AbilityDef}
 */
export function boonAbility(def, effects) {
  if (effects.cooldown === 1 && effects.rewind === 1 && effects.slowDuration === 1) return def;
  return { ...def, cooldown: def.cooldown * effects.cooldown, rewind: def.rewind * effects.rewind, slowDuration: def.slowDuration * effects.slowDuration };
}

/**
 * Baukosten einer Rolle im Technikstand `tier`; mit `tile` auf diesem besonderen Bauplatz (`tilePrice`).
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} tier
 * @param {string} [tile] Art des besonderen Bauplatzes oder ''
 * @returns {number}
 */
export function buildCost(content, arch, tier, tile) {
  const price = round5(arch.cost * content.balance.ageCost[tier]);
  return tile ? tilePrice(content, tile, price) : price;
}

/**
 * Kosten des Ausbaus von `level` auf `level + 1`. Beide Ausbauzweige kosten dasselbe.
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} tier
 * @param {number} level Aktuelle Stufe 1..3
 * @param {string} [tile] Art des besonderen Bauplatzes oder ''
 * @returns {number} Kosten in Gold; -1 ab Stufe 3, denn dann gibt es keinen Ausbau mehr
 */
export function upgradeCost(content, arch, tier, level, tile) {
  if (level >= MAX_LEVEL) return -1;
  const price = round5(buildCost(content, arch, tier) * content.balance.levelCost[level - 1]);
  return tile ? tilePrice(content, tile, price) : price;
}

/**
 * Neuwert eines Turms: Baukosten plus alle Ausbaukosten bis zur Stufe `level`. Für eine Superwaffe (`opts.super`) der Neuwert
 * des Kerns auf Stufe 3 plus der Neuwert auf Stufe 3 jeder Zutat-Rolle im selben Technikstand; die Gebühr zählt nicht mit.
 * Ohne Aufschlag eines besonderen Bauplatzes (`opts.tile` wirkt hier nicht, erst in `modernizeCost`).
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} tier
 * @param {number} level Stufe 1..3
 * @param {TowerOpts} [opts]
 * @returns {number}
 */
export function towerValue(content, arch, tier, level, opts) {
  const fused = opts !== undefined && opts.super === true;
  const top = fused ? MAX_LEVEL : level;
  let value = buildCost(content, arch, tier);
  for (let l = 1; l < top && l < MAX_LEVEL; l++) value += upgradeCost(content, arch, tier, l);
  if (fused && opts.gifts) {
    for (let i = 0; i < opts.gifts.length; i++) value += towerValue(content, archOf(content, opts.gifts[i]), tier, MAX_LEVEL);
  }
  return value;
}

/**
 * Kosten, einen Turm der Stufe `level` auf den Technikstand `toTier` zu bringen: ein fester Anteil dessen, was er dort
 * neu kosten würde (bei einer Superwaffe samt ihrer Zutaten), unabhängig davon, wie viele Zeitalter er überspringt.
 * Auf einem besonderen Bauplatz (`opts.tile`) danach mit dessen Kostenfaktor (`tilePrice`).
 * @param {Content} content
 * @param {TowerArchetypeDef} arch
 * @param {number} toTier Zieltechnikstand (Index des Zeitalters)
 * @param {number} level Stufe 1..3 (bleibt beim Modernisieren erhalten)
 * @param {TowerOpts} [opts]
 * @returns {number}
 */
export function modernizeCost(content, arch, toTier, level, opts) {
  const price = round5(towerValue(content, arch, toTier, level, opts) * content.balance.modernizeFactor);
  return opts && opts.tile ? tilePrice(content, opts.tile, price) : price;
}

/**
 * Gebühr für das Verschmelzen mit einem Kern dieser Rolle und dieses Technikstands: zur Superwaffe
 * `round5(balance.fusion.fee * buildCost)`, zur Megawaffe (`mega`, der Kern ist schon Superwaffe)
 * `round5(balance.fusion.megaFee * buildCost)`; 0 bei Faktor 0 oder ohne `balance.fusion`. Steht der Kern auf einem besonderen
 * Bauplatz (`tile`), gilt danach dessen Kostenfaktor (`tilePrice`).
 * @param {Content} content
 * @param {TowerArchetypeDef} arch Rolle des Kerns
 * @param {number} tier Technikstand des Kerns
 * @param {boolean} [mega] true: Gebühr des zweiten Schritts zur Megawaffe
 * @param {string} [tile] Art des besonderen Bauplatzes des Kerns oder ''
 * @returns {number}
 */
export function fuseCost(content, arch, tier, mega, tile) {
  const fusion = content.balance.fusion;
  if (!fusion) return 0;
  const fee = mega === true ? fusion.megaFee : fusion.fee;
  if (!(fee > 0)) return 0;
  const price = round5(fee * buildCost(content, arch, tier));
  return tile ? tilePrice(content, tile, price) : price;
}

/**
 * Werte eines Gegners in einer Welle. Maßgeblich ist das Zeitalter der Welle, in der er erscheint, nicht `def.age`.
 * @param {Content} content
 * @param {EnemyDef} def
 * @param {number} age Index des Zeitalters der Welle
 * @param {number} waveInAge Index der Welle innerhalb des Zeitalters
 * @param {Difficulty | DifficultyDef} difficulty Kennung des Schwierigkeitsgrads oder seine Definition
 * @returns {EnemyStats}
 */
export function enemyStats(content, def, age, waveInAge, difficulty) {
  const balance = content.balance;
  const diff = difficultyDef(content, difficulty);
  const hp = Math.max(1, Math.round(balance.baseHp * balance.ageHp[age] * (1 + balance.waveHpGrowth * waveInAge) * def.hp * diff.hp));
  return {
    hp,
    armor: def.armor * balance.baseDamage * balance.ageDamage[age],
    shield: Math.round(hp * def.shield),
    bounty: Math.max(1, Math.round(balance.baseBounty * balance.ageBounty[age] * def.bounty * diff.income)),
    speed: def.speed * diff.speed,
  };
}

/**
 * Prämie für eine überstandene Welle: `balance.waveBonus` Standard-Kopfgelder des Zeitalters.
 * @param {Content} content
 * @param {number} age Index des Zeitalters der Welle
 * @param {Difficulty | DifficultyDef} difficulty Kennung des Schwierigkeitsgrads oder seine Definition
 * @returns {number}
 */
export function waveBonus(content, age, difficulty) {
  const balance = content.balance;
  return Math.round(balance.waveBonus * balance.baseBounty * balance.ageBounty[age] * difficultyDef(content, difficulty).income);
}

/**
 * Makellos-Zuschlag auf die Wellenprämie, wenn in der Welle kein Leben verloren ging.
 * @param {Content} content
 * @param {number} age Index des Zeitalters der Welle
 * @param {Difficulty | DifficultyDef} difficulty
 * @returns {number}
 */
export function perfectBonus(content, age, difficulty) {
  return Math.round(waveBonus(content, age, difficulty) * content.balance.perfectBonus);
}

/**
 * Gold-Geschenk beim Anbruch des Zeitalters `age`: `balance.ageGift` Standard-Kopfgelder des neuen Zeitalters.
 * @param {Content} content
 * @param {number} age Index des NEUEN Zeitalters
 * @param {Difficulty | DifficultyDef} difficulty
 * @returns {number}
 */
export function ageGift(content, age, difficulty) {
  const balance = content.balance;
  return Math.round(balance.ageGift * balance.baseBounty * balance.ageBounty[age] * difficultyDef(content, difficulty).income);
}

/**
 * Schaden der Fähigkeit in einem Zeitalter.
 * @param {Content} content
 * @param {AbilityDef} def
 * @param {number} age Index des Zeitalters
 * @returns {number}
 */
export function abilityDamage(content, def, age) {
  return def.damage * content.balance.baseDamage * content.balance.ageDamage[age];
}

/**
 * Gegnerwerte mit der Eigenart der Welle und dem Kopfgeld-Faktor der Zeitgaben (docs/SIM.md, „Wellen mit Eigenart“):
 * `hp = max(1, round(hp * f.hp))`, Schild aus den neuen Lebenspunkten (`round(hp * def.shield * f.shield)`), Rüstung und Tempo
 * mal Faktor, `bounty = max(1, round(bounty * f.bounty * boonBounty))`. Für Flieger wirken `air` und `enemy` zusammen.
 * @param {EnemyStats} values Werte aus `enemyStats`
 * @param {EnemyDef} def
 * @param {WaveModifierDef | null} modifier
 * @param {number} boonBounty Faktor der Zeitgaben auf Kopfgelder
 * @returns {EnemyStats}
 */
export function modifiedEnemyStats(values, def, modifier, boonBounty) {
  const all = modifier ? modifier.enemy : undefined;
  const air = modifier && def.flying ? modifier.air : undefined;
  /** @param {'hp' | 'speed' | 'armor' | 'shield' | 'bounty'} key */
  const factor = (key) => (all && all[key] !== undefined ? all[key] : 1) * (air && air[key] !== undefined ? air[key] : 1);
  const fHp = factor('hp');
  const hp = fHp === 1 ? values.hp : Math.max(1, Math.round(values.hp * fHp));
  const fShield = factor('shield');
  const shield = fHp === 1 && fShield === 1 ? values.shield : Math.round(hp * def.shield * fShield);
  const fBounty = factor('bounty') * boonBounty;
  return {
    hp,
    armor: values.armor * factor('armor'),
    shield,
    bounty: fBounty === 1 ? values.bounty : Math.max(1, Math.round(values.bounty * fBounty)),
    speed: values.speed * factor('speed'),
  };
}
