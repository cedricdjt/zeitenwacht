// @ts-check
// Selbstspieler für Vorführung und Rauchtest. Spielt wie der Bot „sensibel“ aus tools/balance.mjs: baut gemischte Rollen
// auf die Felder, die am meisten Weg (und im Zeitalter der Flieger die Luftlinie) abdecken, baut aus (feste, bewährte
// Zweige), modernisiert alles, plant Superwaffen als Dreigespann (Kern plus zwei Nachbarn), läutet die Zeitglocke, wenn
// ein Gegner fast am Ziel ist, und verbaut vor jedem Wellenstart, was übrig ist. Spät in der Partie macht er aus einer
// Superwaffe eine Megawaffe, wenn zwei ausgebaute Nachbarn schon bereitstehen und vor dem Wellenstart das Gold übrig ist;
// er spart nie dafür (tools/balance.mjs, Abschnitt 11: Sparen für die Megawaffe kostet mehr, als sie bringt). Gemessen über
// 3 Karten x 3 Startwerte je Schwierigkeit gegen `mega: false` (meist vor Welle 39 oder 40): Siege unverändert; übrige Funken
// Normal +24 in Summe (Flusstal 18/14/14 -> 18/20/20, Zwillingsfurt 10/4 -> 15/15), Gemütlich +4, Knifflig +2.
// Kommt ein Zeitalter mit Fliegern, plant er als nächste Superwaffe eine Flak (Rezept aus drei Schützen). Gemessen auf Normal,
// Startwert 1, gegen dieselben Inhalte ohne Rezept: Zangengriff verloren in Welle 36 -> gewonnen mit 5 Funken, Flusstal 14 -> 20,
// Schneckenhaus 9 -> 14, Felsenmeer, Kreuzweg und Zwillingsfurt unverändert.
// Freigeschaltete Rezepte (docs/briefs/fusion.md, 11): Ist eins für den Kern eines geplanten Dreigespanns frei und steht in
// RECIPE_OK, nimmt er dessen Zutaten; den Bauplan dazu wählt er mittelweit oben. Gemessen (6 Karten x 5 Startwerte, Normal und
// Knifflig, Gemütlich 3): Das Brennglas statt des geplanten Schützen-Strahls kostete auf Normal 2 Siege und 28 Funken (es
// verdrängte die Flak), daher nur das Belagerungsgeschütz; damit unverändert (es wird selten rechtzeitig frei).
// Er spielt ordentlich, aber nicht klug; ein aufmerksamer Mensch spielt deutlich besser.
// Besondere Bauplätze: Eine Anhöhe zählt mit ihrer echten Reichweite, Kraftquelle und Taktstein mit der Hälfte ihres Vorteils;
// ein Sumpf zählt nur so viel, wie sein Aufpreis erlaubt (gebaut wird dort nur, wenn das Feld deutlich besser ist). Ein
// Taktgeber, dem die Felder nichts bringen, lässt sie anderen.

import { samplePath, tileX, tileZ } from '../sim/path.js';
import { contentSlots, fusionRecipe, hitsFliers, isClassic, megaLimit, slotOf, tileDef, weaponById } from '../sim/rules.js';

/** @import { Sim, Tower } from '../types/sim' */

/** Bau-Reihenfolge (zyklisch). */
const MIX = ['schuetze', 'werfer', 'bremser', 'knacker', 'brenner', 'taktgeber', 'schuetze', 'knacker', 'werfer', 'brenner', 'schuetze', 'taktgeber', 'bremser', 'knacker'];
/** Bau-Reihenfolge ab dem ersten Zeitalter mit Fliegern. */
const LATE = ['schuetze', 'knacker', 'schuetze', 'brenner', 'schuetze', 'werfer', 'knacker', 'taktgeber'];
/** Ausbauzweig je Rolle. @type {Record<string, number>} */
const BRANCH = { schuetze: 1, werfer: 0, bremser: 1, knacker: 1, brenner: 0, taktgeber: 1 };
/** Geplante Superwaffen: Kern, zwei Zutaten, ab welcher Welle (0-basiert). */
const FUSIONS = /** @type {const} */ ([
  { core: 'knacker', gifts: ['schuetze', 'brenner'], from: 6 },
  { core: 'schuetze', gifts: ['werfer', 'knacker'], from: 12 },
  { core: 'knacker', gifts: ['schuetze', 'taktgeber'], from: 20 },
  { core: 'schuetze', gifts: ['brenner', 'knacker'], from: 28 },
]);
/**
 * Kommen im Zeitalter einer geplanten Schützen-Superwaffe oder im nächsten Flieger, wird sie stattdessen zur Flak (Rezept aus
 * drei Schützen); ihre Zutaten nehmen dann den Doppelschuss (Gabe Schnellfeuer), der Kern behält den Scharfschützen (Reichweite).
 */
const FLAK_GIFTS = /** @type {const} */ (['schuetze', 'schuetze']);
/** Ab dieser Welle im Zeitalter vor dem ersten mit Fliegern plant er die Flak. */
const FLAK_LEAD = 5;
/**
 * Vorliebe bei Zeitgaben, die liebste zuerst (wie BOON_ORDER in tools/balance.mjs, vorn aber, was seiner Spielweise hilft:
 * Superwaffen, Scharfschützen, Panzerknacker, Flak). Was hier fehlt, kommt nach der Reihenfolge des Angebots.
 */
const BOON_ORDER = [
  'meisterwerk', 'adlerauge', 'kettenreaktion', 'sperrfeuer', 'riesentoeter', 'zeitreise', 'schmelztiegel', 'ortskunde',
  'kopfgeldjaeger', 'bauplan_belagerung', 'baumeister', 'veredler', 'goldener_handel', 'ewige_flamme', 'glockengiesser', 'pulverfass', 'zaehe_masse',
  'zunder', 'lauffeuer', 'glutherz', 'gleichschritt', 'hoehenluft', 'moorgeister', 'wanderbaumeister', 'zweite_krone',
];
/** Rezepte, die er statt eines geplanten Dreigespanns mit demselben Kern nimmt, sobald sie freigeschaltet sind. */
const RECIPE_OK = ['belagerung'];
/** Ab dieser Welle (0-basiert) darf eine Superwaffe zur Megawaffe werden. */
const MEGA_FROM = 24;
/** Zielstufe im Mittel: 1 + LEVEL_RATE * Welle, höchstens 3. */
const LEVEL_RATE = 0.09;

/**
 * @typedef {{ core: string, gifts: readonly string[], from: number }} FusionPlan
 * @typedef {{ plan: FusionPlan, key: FusionPlan, ids: number[], spots: [number, number][], done: boolean }} Plan
 */

/**
 * Erzeugt einen Selbstspieler für eine Partie. `act()` einmal pro Bild (oder seltener) aufrufen.
 * @param {Sim} sim
 * @param {{ mega?: boolean }} [options] `mega: false` verzichtet auf die Megawaffe (zum Vergleich)
 * @returns {{ act: () => void }}
 */
export function createAutoplay(sim, options) {
  const allowMega = !options || options.mega !== false;
  const { width, height } = sim.map;
  // Wege, die sich wandeln (map.stages), wie `makeBot` in tools/balance.mjs: bewertet wird die Abdeckung der jetzt geltenden
  // Wege, im Zeitalter direkt vor einem Wechsel zusätzlich mit Gewicht AHEAD die der kommenden. Nach dem Wechsel wird neu
  // bewertet; Türme, die keinen Weg mehr erreichen, verkauft er, und Pläne für Dreigespanne, von denen noch nichts steht, verwirft er.
  const AHEAD = 0.3;
  const out = { x: 0, z: 0, dx: 0, dz: 0 };
  /**
   * Wegpunkte (alle 0,25 Felder) von Kurven.
   * @param {readonly import('../sim/path.js').PathCurve[]} curves
   * @returns {[number, number][]}
   */
  const sampleCurves = (curves) => {
    /** @type {[number, number][]} */
    const list = [];
    for (const c of curves) {
      for (let d = 0; d < c.length; d += 0.25) {
        samplePath(c, d, out);
        list.push([out.x, out.z]);
      }
    }
    return list;
  };
  /** @type {[number, number][]} */
  let ground = [];
  /** @type {[number, number][]} */
  let air = [];
  /** Wege der nächsten Stufe (leer, wenn keine kommt) und ihr Zeitalter. @type {[number, number][]} */
  let groundAhead = [];
  /** @type {[number, number][]} */
  let airAhead = [];
  let aheadFrom = -1;
  let stage = -1;
  const refresh = () => {
    stage = sim.pathStage();
    ground = sampleCurves(sim.paths);
    air = sampleCurves(sim.airPaths);
    aheadFrom = sim.pathStages.find((from) => from > sim.state.age) ?? -1;
    groundAhead = aheadFrom >= 0 ? sampleCurves(sim.stagePaths(aheadFrom)) : [];
    airAhead = aheadFrom >= 0 ? sampleCurves(sim.stageAirPaths(aheadFrom)) : [];
    scoreCache.clear();
  };
  const content = sim.content;
  const airFrom = content.waves.findIndex((list) => list.some((w) => w.groups.some((g) => content.enemies[g.enemy]?.flying)));
  const isLate = () => airFrom >= 0 && sim.state.age >= airFrom;
  /** @type {Record<string, import('../types/content').TowerArchetypeDef>} */
  const archs = Object.fromEntries(content.archetypes.map((a) => [a.id, a]));
  // Waffenpool: Die Strategie denkt in Plätzen (Kennung des Platzes = seiner klassischen Waffe); gebaut wird die Waffe, die die
  // Partie für den Platz gezogen hat (wie W() in tools/balance.mjs). Mit der klassischen Bewaffnung ist W die Gleichheit.
  const slotIds = contentSlots(content).map((slot) => slot.id);
  /** @param {string} id Platz (oder schon eine Waffe) @returns {string} */
  const W = (id) => {
    const at = slotIds.indexOf(id);
    return at >= 0 && sim.loadout[at] ? sim.loadout[at] : id;
  };
  /** Späte Rollen: Plätze, die Flieger treffen sollen, deren gezogene Waffe es aber nicht kann, weichen auf Plätze aus, die es können. */
  const airSlots = slotIds.filter((id) => id !== 'taktgeber' && archs[W(id)] && hitsFliers(archs[W(id)]));
  let airTurn = 0;
  const lateRoles = LATE.map((role) => {
    const classic = archs[role];
    const weapon = archs[W(role)];
    if (!classic || !weapon || !hitsFliers(classic) || hitsFliers(weapon) || airSlots.length === 0) return role;
    return airSlots[airTurn++ % airSlots.length];
  });
  /** @type {{ tx: number, tz: number }[]} */
  const tiles = [];
  for (let tz = 0; tz < height; tz++) for (let tx = 0; tx < width; tx++) if (sim.canBuild(tx, tz).ok) tiles.push({ tx, tz });
  /** @type {Map<string, number>} */
  const scoreCache = new Map();
  refresh();

  /**
   * Abdeckung eines Feldes für eine Rolle: Wegpunkte in Reichweite; die Luftlinie zählt im Flieger-Zeitalter anderthalbfach.
   * Im Zeitalter direkt vor einem Wechsel der Wege zählen die kommenden Wege mit Gewicht AHEAD dazu.
   * @param {string} role @param {number} tx @param {number} tz
   * @returns {number}
   */
  function score(role, tx, tz) {
    const late = isLate();
    const ahead = aheadFrom >= 0 && aheadFrom === sim.state.age + 1;
    const key = `${role}:${tx}:${tz}:${late}:${ahead}`;
    let v = scoreCache.get(key);
    if (v === undefined) {
      v = 0;
      const arch = archs[W(role)];
      if (arch && role !== 'taktgeber') {
        const place = tileDef(content, sim.tileAt(tx, tz));
        const reach = place && place.mod.mul && place.mod.mul.range ? place.mod.mul.range : 1;
        const range = arch.stats.range * 1.08 * reach;
        const x = tileX(tx, width);
        const z = tileZ(tz, height);
        for (const [px, pz] of ground) if (Math.hypot(px - x, pz - z) <= range) v += 1;
        if (late && arch.stats.hitsAir) for (const [px, pz] of air) if (Math.hypot(px - x, pz - z) <= range) v += 1.5;
        if (ahead) {
          for (const [px, pz] of groundAhead) if (Math.hypot(px - x, pz - z) <= range) v += AHEAD;
          if (late && arch.stats.hitsAir) for (const [px, pz] of airAhead) if (Math.hypot(px - x, pz - z) <= range) v += 1.5 * AHEAD;
        }
      }
      scoreCache.set(key, v);
    }
    return v;
  }

  /** @param {number} tx @param {number} tz */
  const free = (tx, tz) => sim.canBuild(tx, tz).ok;

  /**
   * Gewicht eines besonderen Bauplatzes für eine Rolle (1 = gewöhnliches Feld). Die Reichweite steckt schon in `score`.
   * @param {string} role @param {number} tx @param {number} tz
   * @returns {number}
   */
  function placeWeight(role, tx, tz) {
    const place = tileDef(content, sim.tileAt(tx, tz));
    if (!place) return 1;
    const mul = place.mod.mul ?? {};
    let w = 1;
    if (role === 'taktgeber') {
      if (Object.keys(mul).length > 0) w *= 0.9;
    } else {
      if (mul.damage) w *= 1 + 0.5 * (mul.damage - 1);
      if (mul.cooldown) w *= 1 + 0.5 * (1 / mul.cooldown - 1);
    }
    if (place.cost > 1) w /= place.cost;
    return w;
  }

  /**
   * Bestes freies Feld für eine Rolle; ein Taktgeber nur dort, wo er mehrere ausgebaute Nachbarn hat.
   * @param {string} role
   * @returns {{ tx: number, tz: number } | null}
   */
  function bestSpot(role) {
    let best = null;
    let bestV = 0;
    for (const t of tiles) {
      if (!free(t.tx, t.tz)) continue;
      let v = 0;
      if (role === 'taktgeber') {
        for (const o of sim.state.towers) {
          if (slotOf(o.arch) !== 'taktgeber' && Math.abs(o.tx - t.tx) <= 1 && Math.abs(o.tz - t.tz) <= 1) v += o.level * (o.super ? 3 : 1);
        }
        v += score('schuetze', t.tx, t.tz) * 0.01;
        v *= placeWeight(role, t.tx, t.tz);
      } else {
        v = score(role, t.tx, t.tz) * placeWeight(role, t.tx, t.tz);
      }
      if (v > bestV) {
        bestV = v;
        best = t;
      }
    }
    if (role === 'taktgeber' && bestV < 3) return null;
    return best;
  }

  /**
   * Platz für ein Dreigespann: ein Kernfeld mit zwei freien Nachbarn, Abdeckung maximal.
   * @param {FusionPlan} plan
   * @returns {[number, number][] | null}
   */
  function trioSpot(plan) {
    let best = null;
    let bestV = 0;
    for (const c of tiles) {
      if (!free(c.tx, c.tz)) continue;
      const nb = tiles.filter((t) => !(t.tx === c.tx && t.tz === c.tz) && Math.abs(t.tx - c.tx) <= 1 && Math.abs(t.tz - c.tz) <= 1 && free(t.tx, t.tz));
      if (nb.length < 2) continue;
      const [g0, g1] = plan.gifts;
      // Zutaten gehen im Kern auf; für sie zählt ein Feld nur über seinen Preis (ein Sumpf verteuert ihren Ausbau).
      /** @param {string} role @param {{ tx: number, tz: number }} t */
      const gift = (role, t) => score(role, t.tx, t.tz) * Math.min(1, placeWeight(role, t.tx, t.tz));
      nb.sort((a, b) => gift(g0, b) - gift(g0, a));
      const a = nb[0];
      const rest = nb.slice(1).sort((p, q) => gift(g1, q) - gift(g1, p));
      const b = rest[0];
      const v = score(plan.core, c.tx, c.tz) * placeWeight(plan.core, c.tx, c.tz) * 2 + gift(g0, a) * 0.3 + gift(g1, b) * 0.3;
      if (v > bestV) {
        bestV = v;
        best = /** @type {[number, number][]} */ ([[c.tx, c.tz], [a.tx, a.tz], [b.tx, b.tz]]);
      }
    }
    return best;
  }

  /** @param {Tower} t @param {number} [branch] Zweig statt des üblichen der Rolle */
  const up = (t, branch) => sim.upgrade(t.id, t.level === 2 ? branch ?? BRANCH[/** @type {keyof typeof BRANCH} */ (slotOf(t.arch))] ?? 0 : undefined).ok;

  /** Die Flak als eigener Plan, sofern die Schützen-Rolle das Rezept kennt und die Partie Flieger hat. */
  /** @type {FusionPlan | null} */
  const flakPlan = archs[W('schuetze')] && fusionRecipe(archs[W('schuetze')], FLAK_GIFTS.map(W), undefined, content) && airFrom >= 0 ? { core: 'schuetze', gifts: FLAK_GIFTS, from: 0 } : null;

  /**
   * Ist in dieser Partie ein Rezept für den Kern eines geplanten Dreigespanns freigeschaltet, nimmt er dessen Zutaten statt
   * der geplanten (der Kern bleibt, wie er ihn ohnehin bauen wollte).
   * @param {FusionPlan} f
   * @returns {FusionPlan}
   */
  function withRecipe(f) {
    const arch = archs[W(f.core)];
    const list = arch && arch.fusion && arch.fusion.recipes ? arch.fusion.recipes.slice() : [];
    // Waffen des Pools kennen auch die Rezepte der klassischen Waffe ihres Platzes.
    const classic = arch && !isClassic(arch) ? weaponById(content, slotOf(arch)) : null;
    if (classic && classic.fusion && classic.fusion.recipes) list.push(...classic.fusion.recipes);
    const recipe = list.find((r) => r.locked && sim.state.recipes.includes(r.id) && RECIPE_OK.includes(r.id));
    return recipe ? { core: f.core, gifts: recipe.gifts, from: f.from } : f;
  }

  /** @type {Plan[]} */
  const plans = [];
  let next = 0;
  /** Spielzeit der letzten Ausgabe während einer Welle. */
  let lastSpend = -1;

  /**
   * Treibt ein Dreigespann voran: bauen, ausbauen, verschmelzen. Liefert die Kosten des nächsten unbezahlbaren Schritts (0 = fertig).
   * @param {Plan} p
   * @returns {number}
   */
  function trioStep(p) {
    const s = sim.state;
    const roles = [p.plan.core, ...p.plan.gifts];
    const flak = fusionRecipe(archs[W(p.plan.core)], p.plan.gifts.map(W), undefined, content) !== null;
    for (let i = 0; i < 3; i++) {
      if (p.ids[i] >= 0 && sim.towerById(p.ids[i])) continue;
      if (p.ids[i] >= 0) {
        p.done = true;
        return 0;
      }
      const [tx, tz] = p.spots[i];
      const cost = sim.buildCost(W(roles[i]), tx, tz);
      if (cost > s.gold) return cost;
      if (!sim.build(W(roles[i]), tx, tz).ok) {
        p.done = true;
        return 0;
      }
      p.ids[i] = /** @type {Tower} */ (sim.towerAt(tx, tz)).id;
    }
    const trio = /** @type {Tower[]} */ (p.ids.map((id) => sim.towerById(id)));
    for (const t of trio) {
      while (t.level < 3) {
        const cost = sim.upgradeCost(t);
        if (cost > s.gold || !up(t, flak && t !== trio[0] ? 0 : undefined)) return cost;
      }
    }
    if (trio.some((t) => t.tier !== trio[0].tier)) return 0;
    const fee = sim.fuseCost(trio[0]);
    if (fee > s.gold) return fee;
    sim.fuse(trio[0].id, [trio[1].id, trio[2].id]);
    p.done = true;
    return 0;
  }

  /**
   * Macht in der Bauphase aus einer Superwaffe eine Megawaffe, wenn zwei Nachbarn auf Stufe 3 im selben Zeitalter schon
   * bereitstehen (er baut dafür nichts neu) und die Gebühr bezahlbar ist. Unter mehreren Zutaten gibt er die mit dem
   * geringsten bisherigen Schaden.
   */
  function tryMega() {
    const s = sim.state;
    const rule = content.balance.fusion;
    if (!allowMega || s.phase !== 'build' || s.wave < MEGA_FROM || !rule) return;
    if (s.towers.filter((t) => t.mega).length >= megaLimit(content, s.boons)) return;
    const need = rule.parts;
    for (const core of s.towers) {
      if (!core.super || core.mega || core.tier < s.age) continue;
      const parts = sim.fuseCandidates(core.id);
      if (parts.length < need || s.gold < sim.fuseCost(core)) continue;
      parts.sort((a, b) => a.damageDealt - b.damageDealt);
      sim.fuse(core.id, parts.slice(0, need).map((t) => t.id));
      return;
    }
  }

  /**
   * Gibt Gold aus: modernisieren, Superwaffen, bauen und ausbauen.
   * @param {boolean} eager vor dem Wellenstart: Übriges verbauen, statt auf einen teuren Ausbau zu sparen
   */
  function spend(eager) {
    const s = sim.state;
    // 1. Modernisieren, teuerste zuerst; solange etwas Wichtiges veraltet ist, wird dafür gespart.
    const old = s.towers.filter((t) => t.tier < s.age).sort((a, b) => sim.modernizeCost(b) - sim.modernizeCost(a));
    let blocked = false;
    for (const t of old) {
      const c = sim.modernizeCost(t);
      if (c >= 0 && c <= s.gold) sim.modernize(t.id);
      else if (s.gold >= 0.5 * c) blocked = true;
    }
    if (blocked) return;
    // 2. Spät eine Megawaffe, wenn Zutaten und Gold schon da sind; dann Superwaffen nach Plan, für deren nächsten Schritt
    // zur Hälfte zurückgelegt wird.
    tryMega();
    let floor = 0;
    // Die Flak kommt als nächste Superwaffe dran, sobald Flieger im laufenden Zeitalter kommen oder es auf die zweite Hälfte
    // des Zeitalters davor zugeht.
    let flak = flakPlan ? plans.find((q) => q.key === flakPlan) : undefined;
    if (flakPlan && !flak && !plans.some((q) => !q.done) && (s.age >= airFrom || (s.age + 1 === airFrom && s.waveInAge >= FLAK_LEAD))) {
      const spots = trioSpot(flakPlan);
      if (spots) {
        flak = { plan: flakPlan, key: flakPlan, ids: [-1, -1, -1], spots, done: false };
        plans.push(flak);
      }
    }
    if (flak && !flak.done) {
      const need = trioStep(flak);
      if (need > 0) floor = need * 0.5;
    }
    for (const f of FUSIONS) {
      if (flak && !flak.done) break;
      if (s.wave < f.from) continue;
      let p = plans.find((q) => q.key === f);
      if (!p) {
        if (plans.some((q) => !q.done)) break;
        const plan = withRecipe(f);
        const spots = trioSpot(plan);
        if (!spots) continue;
        p = { plan, key: f, ids: [-1, -1, -1], spots, done: false };
        plans.push(p);
      }
      if (p.done) continue;
      const need = trioStep(p);
      if (need > 0) floor = need * 0.5;
      break;
    }
    // 3. Bauen oder ausbauen: Die Zielstufe steigt mit der Welle.
    const reserved = new Set(plans.filter((q) => !q.done).flatMap((q) => q.ids));
    for (let guard = 0; guard < 30; guard++) {
      const budget = s.gold - floor;
      const fighters = s.towers.filter((t) => !t.super);
      const avg = fighters.reduce((sum, t) => sum + t.level, 0) / Math.max(1, fighters.length);
      const target = Math.min(3, 1 + LEVEL_RATE * s.wave);
      /** @type {Tower | null} */
      let cand = null;
      for (const t of fighters) {
        if (t.level >= 3 || reserved.has(t.id)) continue;
        if (!cand || sim.upgradeCost(t) < sim.upgradeCost(cand)) cand = t;
      }
      const roles = isLate() ? lateRoles : MIX;
      let spot = null;
      let role = '';
      for (let k = 0; k < roles.length && !spot; k++) {
        role = roles[(next + k) % roles.length];
        spot = bestSpot(role);
        if (spot) next += k;
      }
      const canUp = cand !== null && sim.upgradeCost(cand) <= budget;
      const price = spot ? sim.buildCost(W(role), spot.tx, spot.tz) : 0;
      const canBuild = spot !== null && price <= budget;
      const wantUp = cand !== null && (avg < target || spot === null);
      if (wantUp && canUp && cand) {
        up(cand);
      } else if (spot && canBuild && (!wantUp || budget > 2 * price || eager)) {
        sim.build(W(role), spot.tx, spot.tz);
        next++;
      } else if (cand && canUp && (eager || budget > 2 * sim.upgradeCost(cand))) {
        up(cand);
      } else {
        return;
      }
    }
  }

  return {
    act() {
      const s = sim.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      if (s.phase === 'wave') {
        // Zeitglocke, wenn ein Gegner fast am Ziel ist (ein Boss etwas früher).
        if (s.abilityCooldown <= 0) {
          for (const e of s.enemies) {
            if (e.alive && e.progress > (e.def.boss ? 0.6 : 0.8)) {
              sim.useAbility(0, 0);
              break;
            }
          }
        }
        // Während der Welle höchstens zweimal je Sekunde Spielzeit, egal wie oft act() gerufen wird.
        if (s.time - lastSpend >= 0.5) {
          lastSpend = s.time;
          spend(false);
        }
        return;
      }
      if (s.phase !== 'build') return;
      // Ein offenes Angebot an Zeitgaben hält die Partie an; er wählt sofort nach seiner Vorliebe.
      if (s.boonOffer.length > 0) {
        const pick = BOON_ORDER.find((id) => s.boonOffer.includes(id)) ?? s.boonOffer[0];
        sim.chooseBoon(pick);
      }
      if (sim.pathStage() !== stage) {
        refresh();
        // Pläne, von denen noch nichts steht, galten dem alten Weg.
        for (let i = plans.length - 1; i >= 0; i--) if (!plans[i].done && plans[i].ids.every((id) => id < 0)) plans.splice(i, 1);
        // Türme, die keinen der neuen Wege mehr erreichen, bringen nichts mehr (Superwaffen und Taktgeber bleiben).
        const reserved = new Set(plans.filter((q) => !q.done).flatMap((q) => q.ids));
        for (const t of s.towers.slice()) {
          if (t.super || slotOf(t.arch) === 'taktgeber' || reserved.has(t.id)) continue;
          const x = tileX(t.tx, width);
          const z = tileZ(t.tz, height);
          const range = t.stats.range * (1 + t.buffRange);
          const reach = ground.some(([px, pz]) => Math.hypot(px - x, pz - z) <= range) || (t.stats.hitsAir && air.some(([px, pz]) => Math.hypot(px - x, pz - z) <= range));
          if (!reach) sim.sell(t.id);
        }
      }
      if (s.lock > 0) return;
      spend(true);
      if (s.towers.length > 0) sim.startWave();
    },
  };
}
