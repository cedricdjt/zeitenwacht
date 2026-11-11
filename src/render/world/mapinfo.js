// @ts-check
// Auswertung einer Karte für die Welt: Wegfelder, Plätze, bebaubare Felder, Lage von Basis und Eingängen
// und die festen PLÄTZE der Dekoration (einmal je Karte berechnet, unabhängig vom Zeitalter).

import * as THREE from 'three';
import { buildPath, pathTiles, tileX, tileZ } from '../../sim/path.js';
import { hash2 } from '../../util/noise.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION, CAMERA_FOV } from '../layout.js';
import { makeRng } from '../../util/rng.js';

/** @import { MapDef } from '../../types/content' */
/** @import { PathCurve } from '../../sim/path.js' */
/** @import { Terrain } from '../terrain.js' */

/** Höhe (y) der Oberfläche der Umgebung unter der Insel (Wolkenmeer, Wasser, Dunst, Lichtermeer). */
export const ABYSS_Y = -8.5;

/** Um so viele Felder steht das Basismodell hinter dem Basisfeld, wenn dieses außerhalb des Spielfelds liegt. */
export const BASE_SETBACK = 0.75;

/**
 * @typedef {object} MapInfo
 * @property {MapDef} map
 * @property {number} width
 * @property {number} height
 * @property {number} halfX
 * @property {number} halfZ
 * @property {(tx: number, tz: number) => boolean} isPath Weg in IRGENDEINER erreichbaren Stufe (Boden, Dekoration und Bauraster weichen allen aus)
 * @property {(tx: number, tz: number) => boolean} isSolid Plätze (Basis, Eingänge aller Stufen)
 * @property {(tx: number, tz: number) => boolean} isBlocked
 * @property {(tx: number, tz: number) => boolean} isBuildable im Spielfeld, kein Weg, nicht gesperrt, nicht Platz der Basis
 * @property {(tx: number, tz: number) => string} specialAt Art des besonderen Bauplatzes auf dem Feld oder ''
 * @property {{ tx: number, tz: number, x: number, z: number, kind: string }[]} special Die besonderen Bauplätze der Karte
 * @property {{ tx: number, tz: number, x: number, z: number, modelX: number, modelZ: number, yaw: number, inside: boolean }} base
 * @property {{ tx: number, tz: number, x: number, z: number, yaw: number, sets: number }[]} entrances Alle Tore aller Stufen;
 *   `sets` = Bitmaske der Sätze (Index in `sets`), in denen das Tor benutzt wird
 * @property {PathCurve[]} curves Kurven der Grundwege (Satz 0)
 * @property {PathSet[]} sets Erreichbare Sätze von Wegen, aufsteigend nach Zeitalter (wie Sim.pathStages)
 * @property {(age: number) => number} setOfAge Index des Satzes, der im Zeitalter `age` gilt
 * @property {(tx: number, tz: number) => number} setMask Bitmaske der Sätze, in denen das Feld Weg ist (0 = nie)
 * @property {(tx: number, tz: number) => number} links Richtungen, in die ein Weg das Feld verlässt (1 = -z, 2 = +x, 4 = +z, 8 = -x)
 */

/**
 * Ein Satz Wege, der ab einem Zeitalter gilt (siehe MapDef.stages und docs/SIM.md).
 * @typedef {object} PathSet
 * @property {number} from Zeitalter, ab dem der Satz gilt
 * @property {[number, number][][]} waypoints
 * @property {PathCurve[]} curves
 * @property {boolean} follow Flieger folgen dem Weg
 * @property {number[]} gates Index in `MapInfo.entrances` je Weg
 * @property {string} name Überschrift der Stufe ('' für die Grundwege)
 * @property {string} text
 */

/**
 * Die erreichbaren Sätze von Wegen einer Karte, wie die Simulation sie bildet: Satz 0 sind die Grundwege; jede Stufe mit
 * `paths` oder `flyersFollowPath` bringt ab ihrem Zeitalter einen neuen Satz (fehlende Angaben erbt sie vom vorigen).
 * @param {MapDef} map
 * @param {number} [ageCount] Zahl der Zeitalter der Partie; spätere Stufen werden nie erreicht
 * @returns {{ from: number, waypoints: [number, number][][], follow: boolean, name: string, text: string }[]}
 */
export function stageSets(map, ageCount = Infinity) {
  /** @type {{ from: number, waypoints: [number, number][][], follow: boolean, name: string, text: string }[]} */
  const sets = [{ from: 0, waypoints: map.paths, follow: Boolean(map.flyersFollowPath), name: '', text: '' }];
  const stages = map.stages ?? [];
  for (let i = 1; i < stages.length && i < ageCount; i++) {
    const stage = stages[i];
    if (!stage || (!stage.paths && stage.flyersFollowPath === undefined)) continue;
    const prev = sets[sets.length - 1];
    sets.push({ from: i, waypoints: stage.paths ?? prev.waypoints, follow: stage.flyersFollowPath ?? prev.follow, name: stage.name, text: stage.text });
  }
  return sets;
}

/**
 * @typedef {object} Spot
 * @property {'shore' | 'rim' | 'field' | 'far' | 'block'} zone
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} room Freier Radius um den Platz in Feldern
 * @property {number} yaw Grundausrichtung (Gebautes blickt zum Spielfeld bzw. am Rand nach außen)
 * @property {number} seed Ganzzahliger Startwert des Platzes
 * @property {number} tx Feld des Platzes (nur 'field' und 'block'), sonst -99
 * @property {number} tz
 * @property {number} rank Reihenfolge innerhalb seiner Gruppe: Ein Zeitalter füllt die Plätze mit den kleinsten Rängen zuerst
 * @property {number} span Halbe Länge einer Reihe entlang der Inselkante (nur Randreihen, sonst 0): Dort stehen Gruppen
 *   (Aquädukt, Mauer, Baumreihe) nebeneinander statt im Kreis
 * @property {boolean} [inView] Ferne Kulisse, die die Ausgangsansicht der Spielkamera zeigt
 */

/**
 * @param {number} tx
 * @param {number} tz
 */
function key(tx, tz) {
  return (tz + 64) * 256 + (tx + 64);
}

/**
 * Wertet eine Karte aus.
 * @param {MapDef} map
 * @param {number} [ageCount] Zahl der Zeitalter der Partie (begrenzt die erreichbaren Stufen)
 * @returns {MapInfo}
 */
export function analyzeMap(map, ageCount = Infinity) {
  const { width, height } = map;
  /** Bitmaske der Sätze je Feld. @type {Map<number, number>} */
  const pathSet = new Map();
  /** Richtungen je Feld. @type {Map<number, number>} */
  const linkSet = new Map();
  /** @type {Set<number>} */
  const solidSet = new Set();
  /** @type {Set<number>} */
  const blockedSet = new Set();
  /** @type {Set<number>} */
  const plazaInside = new Set();
  for (const [tx, tz] of map.blocked) blockedSet.add(key(tx, tz));

  /** @type {MapInfo['entrances']} */
  const entrances = [];
  /** @type {PathSet[]} */
  const sets = [];
  stageSets(map, ageCount).forEach((def, si) => {
    /** @type {PathSet} */
    const set = { from: def.from, waypoints: def.waypoints, curves: [], follow: def.follow, gates: [], name: def.name, text: def.text };
    sets.push(set);
    for (const waypoints of def.waypoints) {
      const tiles = pathTiles(waypoints);
      for (let i = 0; i < tiles.length; i++) {
        const [tx, tz] = tiles[i];
        const k = key(tx, tz);
        pathSet.set(k, (pathSet.get(k) ?? 0) | (1 << si));
        // Richtungen zum vorigen und nächsten Feld des Weges.
        let links = linkSet.get(k) ?? 0;
        for (const o of [tiles[i - 1], tiles[i + 1]]) {
          if (!o) continue;
          const dx = o[0] - tx;
          const dz = o[1] - tz;
          links |= dz < 0 ? 1 : dx > 0 ? 2 : dz > 0 ? 4 : 8;
        }
        linkSet.set(k, links);
      }
      set.curves.push(si === 0 || def.waypoints !== sets[si - 1].waypoints ? buildPath(waypoints, width, height) : sets[si - 1].curves[set.curves.length]);
      const [ex, ez] = waypoints[0];
      const dx = Math.sign(waypoints[1][0] - ex);
      const dz = Math.sign(waypoints[1][1] - ez);
      let gate = entrances.findIndex((e) => e.tx === ex && e.tz === ez);
      if (gate < 0) {
        gate = entrances.length;
        entrances.push({ tx: ex, tz: ez, x: tileX(ex, width), z: tileZ(ez, height), yaw: Math.atan2(dx, dz), sets: 0 });
      }
      entrances[gate].sets |= 1 << si;
      set.gates.push(gate);
      // Kleiner Platz um das Portal: das Eingangsfeld, das Feld dahinter und jeweils die seitlichen Nachbarn.
      for (let back = 0; back <= 1; back++) {
        for (let side = -1; side <= 1; side++) solidSet.add(key(ex - dx * back + dz * side, ez - dz * back + dx * side));
      }
    }
  });
  const curves = sets[0].curves;

  const first = map.paths[0];
  const [bx, bz] = first[first.length - 1];
  const [px, pz] = first[first.length - 2];
  const dirX = Math.sign(bx - px);
  const dirZ = Math.sign(bz - pz);
  const inside = bx >= 0 && bx < width && bz >= 0 && bz < height;
  const setback = inside ? 0 : BASE_SETBACK;
  const base = {
    tx: bx,
    tz: bz,
    x: tileX(bx, width),
    z: tileZ(bz, height),
    modelX: tileX(bx, width) + dirX * setback,
    modelZ: tileZ(bz, height) + dirZ * setback,
    // Die Basis blickt dem ankommenden Weg entgegen.
    yaw: Math.atan2(-dirX, -dirZ),
    inside,
  };
  // Platz der Basis: 3 x 3 Felder; liegt die Basis außerhalb, beginnt er am Basisfeld und reicht zwei Felder nach hinten.
  const cx = inside ? bx : bx + dirX;
  const cz = inside ? bz : bz + dirZ;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      solidSet.add(key(cx + i, cz + j));
      if (inside) plazaInside.add(key(cx + i, cz + j));
    }
  }

  /** @param {number} tx @param {number} tz */
  const isPath = (tx, tz) => pathSet.has(key(tx, tz));
  /** @param {number} tx @param {number} tz */
  const setMask = (tx, tz) => pathSet.get(key(tx, tz)) ?? 0;
  /** @param {number} tx @param {number} tz */
  const links = (tx, tz) => linkSet.get(key(tx, tz)) ?? 0;
  /** @param {number} age */
  const setOfAge = (age) => {
    let index = 0;
    for (let i = 1; i < sets.length; i++) if (sets[i].from <= age) index = i;
    return index;
  };
  /** @param {number} tx @param {number} tz */
  const isSolid = (tx, tz) => solidSet.has(key(tx, tz));
  /** @param {number} tx @param {number} tz */
  const isBlocked = (tx, tz) => blockedSet.has(key(tx, tz));
  /** @param {number} tx @param {number} tz */
  const isBuildable = (tx, tz) =>
    tx >= 0 && tx < width && tz >= 0 && tz < height && !pathSet.has(key(tx, tz)) && !blockedSet.has(key(tx, tz)) && !plazaInside.has(key(tx, tz));

  /** @type {Map<number, string>} */
  const specialSet = new Map();
  /** @type {MapInfo['special']} */
  const special = [];
  for (const tile of map.tiles ?? []) {
    if (!isBuildable(tile.tx, tile.tz) || specialSet.has(key(tile.tx, tile.tz))) continue;
    specialSet.set(key(tile.tx, tile.tz), tile.kind);
    special.push({ tx: tile.tx, tz: tile.tz, x: tileX(tile.tx, width), z: tileZ(tile.tz, height), kind: tile.kind });
  }
  /** @param {number} tx @param {number} tz */
  const specialAt = (tx, tz) => specialSet.get(key(tx, tz)) ?? '';

  return { map, width, height, halfX: width / 2, halfZ: height / 2, isPath, isSolid, isBlocked, isBuildable, specialAt, special, base, entrances, curves, sets, setOfAge, setMask, links };
}

/**
 * Berechnet die festen Plätze der Dekoration einer Karte. Deterministisch aus `map.seed`.
 * @param {MapInfo} info
 * @param {Terrain} terrain
 * @returns {Spot[]}
 */
export function computeSpots(info, terrain) {
  const { width, height, halfX, halfZ, map } = info;
  const rng = makeRng((map.seed | 0) * 7919 + 13);
  /** @type {Spot[]} */
  const spots = [];

  /**
   * Abstand eines Punktes zum nächsten Feld, das frei bleiben muss (Weg, Plätze, Spielfeld); groß, wenn keines in der Nähe ist.
   * @param {number} x @param {number} z @param {number} reach
   */
  const keepOutDistance = (x, z, reach) => {
    // Das Spielfeld als Ganzes.
    const fx = Math.max(Math.abs(x) - halfX, 0);
    const fz = Math.max(Math.abs(z) - halfZ, 0);
    let best = Math.hypot(fx, fz);
    const t0x = Math.floor(x + halfX - reach);
    const t1x = Math.floor(x + halfX + reach);
    const t0z = Math.floor(z + halfZ - reach);
    const t1z = Math.floor(z + halfZ + reach);
    for (let tz = t0z; tz <= t1z; tz++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        if (!info.isPath(tx, tz) && !info.isSolid(tx, tz)) continue;
        const cx = tx - halfX + 0.5;
        const cz = tz - halfZ + 0.5;
        const d = Math.hypot(Math.max(Math.abs(x - cx) - 0.5, 0), Math.max(Math.abs(z - cz) - 0.5, 0));
        if (d < best) best = d;
      }
    }
    return best;
  };

  /**
   * Ob ein Kreis ganz auf der Insel liegt.
   * @param {number} x @param {number} z @param {number} r @param {number} inset zusätzlicher Abstand zur Kante
   */
  const onLand = (x, z, r, inset) => {
    if (terrain.shoreDistance(x, z) > -(inset + r * 0.75)) return false;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      if (terrain.shoreDistance(x + Math.cos(a) * r, z + Math.sin(a) * r) > -inset) return false;
    }
    return true;
  };

  /** Belegte Kreise in Ufer und Rand, gegen die auf Überlappung geprüft wird (eine Randreihe belegt mehrere). @type {{ x: number, z: number, room: number }[]} */
  const placed = [];
  /** @param {number} x @param {number} z @param {number} r */
  const overlaps = (x, z, r) => {
    // Kleines darf etwas enger an seine Nachbarn rücken als Großes.
    const slack = r < 0.5 ? 0.86 : 0.94;
    for (const s of placed) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < (s.room + r) * slack) return true;
    }
    return false;
  };

  /** Gebautes blickt grob zum Spielfeld: auf eine der vier Himmelsrichtungen gerundet, leicht verdreht. @param {number} x @param {number} z */
  const yawToField = (x, z) => {
    const ox = Math.abs(x) - halfX;
    const oz = Math.abs(z) - halfZ;
    const base = ox > oz ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : z > 0 ? Math.PI : 0;
    return base + rng.range(-0.22, 0.22);
  };

  /**
   * @param {Spot['zone']} zone @param {number} x @param {number} y @param {number} z @param {number} room @param {number} yaw
   * @param {number} [tx] @param {number} [tz]
   * @returns {Spot}
   */
  const make = (zone, x, y, z, room, yaw, tx = -99, tz = -99) => ({ zone, x, y, z, room, yaw, seed: Math.floor(rng.next() * 0x7fffffff), tx, tz, rank: 0, span: 0 });

  // --- Ufer: große Plätze zuerst, sie tragen die Komposition ---
  const ext = 4;
  /** @param {number} r @param {number} attempts @param {number} limit */
  const throwDarts = (r, attempts, limit) => {
    /** @type {Spot[]} */
    const out = [];
    for (let n = 0; n < attempts && out.length < limit; n++) {
      const x = rng.range(-halfX - ext, halfX + ext);
      const z = rng.range(-halfZ - ext, halfZ + ext);
      if (Math.abs(x) < halfX + r && Math.abs(z) < halfZ + r) continue;
      if (!onLand(x, z, r, r < 0.5 ? 0.1 : 0.16)) continue;
      if (keepOutDistance(x, z, r + 1.2) < r + 0.1) continue;
      if (overlaps(x, z, r)) continue;
      const spot = make('shore', x, 0, z, r, yawToField(x, z));
      placed.push(spot);
      out.push(spot);
    }
    return out;
  };
  const large = throwDarts(1.0, 1600, 10);

  // --- Rand: direkt an der Kante, Blick nach außen ---
  const edges = terrain.rim.length / 4;
  const rimRoom = 0.42;
  /**
   * Ein zufälliger Punkt knapp innerhalb der Kante mit der Richtung nach außen, oder null.
   * @returns {{ x: number, z: number, gx: number, gz: number } | null}
   */
  const rimPoint = () => {
    const e = Math.floor(rng.next() * edges) * 4;
    const mx = (terrain.rim[e] + terrain.rim[e + 2]) / 2;
    const mz = (terrain.rim[e + 1] + terrain.rim[e + 3]) / 2;
    // Nach außen zeigt der Anstieg des Abstandsfeldes.
    const eps = 0.35;
    let gx = terrain.shoreDistance(mx + eps, mz) - terrain.shoreDistance(mx - eps, mz);
    let gz = terrain.shoreDistance(mx, mz + eps) - terrain.shoreDistance(mx, mz - eps);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-4) return null;
    gx /= gl;
    gz /= gl;
    return { x: mx - gx * 0.62, z: mz - gz * 0.62, gx, gz };
  };
  /** @param {number} x @param {number} z @param {number} r */
  const rimFree = (x, z, r) =>
    !(Math.abs(x) < halfX + r && Math.abs(z) < halfZ + r) && onLand(x, z, r * 0.7, 0.08) && keepOutDistance(x, z, r + 1.2) >= r + 0.1 && !overlaps(x, z, r);

  // Randreihen: gerade Stücke der Kante, auf denen eine Gruppe nebeneinander steht (Aquädukt, Mauer, Baumreihe).
  // Sie kommen vor den mittelgroßen Plätzen, sonst bleibt selten ein langes freies Stück übrig.
  /** @type {Spot[]} */
  const runs = [];
  const RUN_SPAN = 1.35;
  for (let n = 0; n < edges * 2 && runs.length < 3; n++) {
    const p = rimPoint();
    if (!p) continue;
    // Entlang der Kante: lokale x-Achse eines Modells mit Blick nach außen.
    const yaw = Math.atan2(p.gx, p.gz);
    const tx = Math.cos(yaw);
    const tz = -Math.sin(yaw);
    let ok = true;
    for (let k = -3; k <= 3 && ok; k++) {
      const s = (k / 3) * RUN_SPAN;
      const x = p.x + tx * s;
      const z = p.z + tz * s;
      // Die ganze Reihe bleibt nah an der Kante und auf festem Grund.
      if (!rimFree(x, z, rimRoom) || terrain.shoreDistance(x, z) < -1.25) ok = false;
    }
    // Abstand zwischen den Reihen, damit sie nicht zu einer Wand zusammenwachsen.
    if (!ok || runs.some((r) => Math.hypot(r.x - p.x, r.z - p.z) < 7)) continue;
    const spot = make('rim', p.x, 0, p.z, rimRoom, yaw);
    spot.span = RUN_SPAN;
    for (let k = -3; k <= 3; k++) placed.push({ x: p.x + tx * (k / 3) * RUN_SPAN, z: p.z + tz * (k / 3) * RUN_SPAN, room: rimRoom });
    runs.push(spot);
  }

  const medium = throwDarts(0.62, 2600, 36);

  /** @type {Spot[]} */
  const rim = [];
  for (let n = 0; n < edges * 3 && rim.length < 20; n++) {
    const p = rimPoint();
    if (!p || !rimFree(p.x, p.z, rimRoom)) continue;
    const spot = make('rim', p.x, 0, p.z, rimRoom, Math.atan2(p.gx, p.gz));
    placed.push(spot);
    rim.push(spot);
  }

  const small = throwDarts(0.34, 3000, 44);

  // Reihenfolge: große Plätze zuerst, dann der Rest bunt gemischt. So bleibt die Komposition gleich, egal wie viele ein Zeitalter füllt.
  /** @param {Spot[]} list */
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  };
  const rest = shuffle([...medium, ...rim, ...small]);
  // Mittelgroße und Randplätze gleichmäßig vor die kleinen ziehen: abwechselnd einreihen.
  const ordered = [...shuffle(large), ...runs, ...rest];
  ordered.forEach((spot, index) => {
    spot.rank = index;
    spots.push(spot);
  });

  // --- Gesperrte Felder: je eines ---
  for (const [tx, tz] of map.blocked) {
    if (info.isPath(tx, tz)) continue;
    const quarter = Math.floor(hash2(tx, tz, map.seed + 5) * 4) * (Math.PI / 2);
    spots.push(make('block', tileX(tx, width), 0, tileZ(tz, height), 0.5, quarter + rng.range(-0.12, 0.12), tx, tz));
  }

  // --- Spielfeld: ein möglicher Platz je bebaubarem Feld, leicht aus der Mitte gerückt ---
  /** @type {Spot[]} */
  const field = [];
  for (let tz = 0; tz < height; tz++) {
    for (let tx = 0; tx < width; tx++) {
      // Besondere Bauplätze tragen ihr eigenes Bodenzeichen und bleiben frei von Bodendeko.
      if (!info.isBuildable(tx, tz) || info.specialAt(tx, tz) !== '') continue;
      const x = tileX(tx, width) + rng.range(-0.24, 0.24);
      const z = tileZ(tz, height) + rng.range(-0.24, 0.24);
      field.push(make('field', x, 0, z, 0.24, rng.range(0, Math.PI * 2), tx, tz));
    }
  }
  shuffle(field).forEach((spot, index) => {
    spot.rank = index;
    spots.push(spot);
  });

  // --- Ferne Kulisse ---
  // Zuerst Plätze, die die Ausgangsansicht des Spiels zeigt: neben und hinter der Insel, nie davor (dort verdeckten sie das
  // Spielfeld) und nie hinter ihr versteckt. Ihr `room` ist die erlaubte Höhe. Danach ein weiter Ring für herausgezoomte Ansichten.
  /** @type {Spot[]} */
  const near = [];
  const camera = homeCamera(width, height);
  const H_NEAR = 3.4;
  for (let n = 0; n < 240 && near.length < 5; n++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(Math.max(halfX, halfZ) + 8, Math.max(halfX, halfZ) + 30);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (terrain.shoreDistance(x, z) < 9) continue;
    if (near.some((s) => Math.hypot(s.x - x, s.z - z) < 9)) continue;
    if (!farVisible(camera, terrain, x, z, H_NEAR)) continue;
    near.push(make('far', x, ABYSS_Y, z, H_NEAR, Math.atan2(-x, -z) + rng.range(-1.2, 1.2)));
  }
  near.forEach((spot, index) => {
    spot.inView = true;
    spot.rank = index;
    spots.push(spot);
  });
  const farCount = 12;
  /** @type {Spot[]} */
  const far = [];
  for (let k = 0; k < farCount; k++) {
    const a = ((k + rng.range(-0.3, 0.3)) / farCount) * Math.PI * 2;
    const r = rng.range(40, 60);
    far.push(make('far', Math.sin(a) * r, ABYSS_Y, Math.cos(a) * r, 40, a + Math.PI + rng.range(-0.5, 0.5)));
  }
  shuffle(far).forEach((spot, index) => {
    spot.rank = near.length + index;
    spots.push(spot);
  });

  return spots;
}

/**
 * Kamera der Ausgangsansicht des Spiels für eine Karte (wie `GameCamera.setHome`, Seitenverhältnis 16:10).
 * @param {number} width
 * @param {number} height
 * @returns {THREE.PerspectiveCamera}
 */
function homeCamera(width, height) {
  const DEG = Math.PI / 180;
  const aspect = 1.6;
  const half = Math.tan((CAMERA_FOV * DEG) / 2);
  const needH = (width / 2 + 3.2) / (half * aspect);
  const needV = ((height / 2 + 3.2) * Math.sin(CAMERA_ELEVATION * DEG) + 1.2) / (half * 0.76);
  const distance = Math.max(needH, needV) * 1.04;
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 1, 700);
  const az = CAMERA_AZIMUTH * DEG;
  const el = CAMERA_ELEVATION * DEG;
  camera.position.set(Math.sin(az) * Math.cos(el) * distance, Math.sin(el) * distance, 0.6 + Math.cos(az) * Math.cos(el) * distance);
  camera.lookAt(0, 0, 0.6);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * Ob eine Säule der Höhe `h` auf der Umgebung bei (x, z) in der Ausgangsansicht zu sehen ist, ohne die Insel zu verdecken:
 * Fuß und Spitze liegen im Bild, der Blick dorthin streift die Insel nicht, und dahinter liegt keine Insel.
 * @param {THREE.PerspectiveCamera} camera
 * @param {Terrain} terrain
 * @param {number} x
 * @param {number} z
 * @param {number} h
 */
function farVisible(camera, terrain, x, z, h) {
  const v = new THREE.Vector3();
  for (const y of [ABYSS_Y, ABYSS_Y + h]) {
    v.set(x, y, z).project(camera);
    // Ganz im Bild und in dessen oberem Teil: weiter vorn wirkte die Kulisse groß und drängte sich an die Insel.
    if (Math.abs(v.x) > 0.84 || v.y < -0.25 || v.y > 0.86 || v.z > 1) return false;
  }
  const c = camera.position;
  for (const y of [ABYSS_Y + 0.3, ABYSS_Y + h * 0.5, ABYSS_Y + h]) {
    // Strahl von der Kamera durch den Punkt und weit darüber hinaus: Insel davor heißt verdeckt, Insel dahinter heißt,
    // die Kulisse stünde vor dem Spielfeld.
    for (let k = 1; k <= 60; k++) {
      const t = k / 30;
      const px = c.x + (x - c.x) * t;
      const py = c.y + (y - c.y) * t;
      const pz = c.z + (z - c.z) * t;
      if (py < -3.5) break;
      // Mit Abstand: im Bild bleibt Wasser zwischen Insel und Kulisse, sonst scheint sie an der Kante zu kleben.
      if (py < 0.8 && terrain.shoreDistance(px, pz) < 2.2) return false;
    }
  }
  return true;
}
