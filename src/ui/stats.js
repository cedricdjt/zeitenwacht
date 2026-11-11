// @ts-check
// Kennzahlen eines Turms als Zeilen für Hinweiskarte und Turmkarte: nur die Zahlen, die für die Rolle zählen.

import { fixed1, num1, percent, seconds, NNBSP } from './texts.js';

/** @import { TowerStats } from '../types/content' */

/**
 * @typedef {object} StatRow
 * @property {string} icon
 * @property {string} label
 * @property {string} value
 * @property {string} next Wert nach Ausbau oder Modernisierung; leer, wenn er gleich bleibt oder kein Vergleich verlangt ist
 * @property {number} dir Richtung der Änderung: 1 = besser, -1 = schlechter, 0 = gleich oder nicht vergleichbar
 */

/**
 * Schüsse pro Sekunde; langsame Türme mit zwei Nachkommastellen, damit 0,29 nicht zu 0,3 wird.
 * @param {number} cooldown
 * @returns {string}
 */
function rate(cooldown) {
  const r = 1 / cooldown;
  const text = r < 1 ? r.toFixed(2) : r.toFixed(1);
  return text.replace('.', ',') + NNBSP + '/s';
}

/**
 * Ob der Turm überhaupt auf Gegner wirkt. Ein Taktgeber (attack 'none') schießt nicht; Schusswerte, die ihm eine Gabe
 * einträgt, bleiben wirkungslos und werden deshalb nicht gezeigt. Ebenso springt bei Flächenschaden nichts als Kette über.
 * @param {TowerStats} s
 * @returns {boolean}
 */
function shoots(s) {
  return s.attack !== 'none';
}

/**
 * Ob der Turm am Einschlag ein Bodenfeld hinterlässt (nicht beim Puls, der keinen Einschlag hat; ohne Radius kein Feld).
 * @param {TowerStats} s
 * @returns {boolean}
 */
function leavesZone(s) {
  return shoots(s) && s.attack !== 'pulse' && s.zone > 0 && s.splash > 0;
}

/**
 * Eine Pfütze des Bremsers: ein Bodenfeld ohne Treffer-Schaden. Ein Werfer mit Brandfeld trifft dagegen erst und lässt das Feld liegen.
 * @param {TowerStats} s
 * @returns {boolean}
 */
function isPuddle(s) {
  return leavesZone(s) && !(s.damage > 0);
}

/**
 * Wie die Zeilen heißen, wo die Werte es nicht selbst sagen.
 * @typedef {object} StatNames
 * @property {string} [dot] Name des Schadens über Zeit: 'Brand' (Standard), 'Gift' oder 'Glut' (aus `TowerArchetypeDef.dotKind`)
 */

/** Name der Zeile für Schaden über Zeit (wird je Aufruf von statRows gesetzt). */
let dotName = 'Brand';

/** Namen der Arten von Schaden über Zeit. */
const DOT_NAMES = { fire: 'Brand', poison: 'Gift', ember: 'Glut' };

/**
 * Was ein Ziel „trägt“, das ein Sucher meidet (docs/SIM.md, „Ziele“), in Worten: „Brand“, „Verlangsamung und Zeichen“ …
 * @param {TowerStats} s
 * @returns {string}
 */
function seekText(s) {
  /** @type {string[]} */
  const parts = [];
  if (s.dot > 0) parts.push(dotName);
  if (s.slow > 0) parts.push('Verlangsamung');
  if ((s.mark ?? 0) > 0) parts.push('Zeichen');
  if ((s.push ?? 0) > 0) parts.push('frischen Rückstoß');
  return parts.length > 0 ? 'Ziele ohne ' + parts.join(' und ') : 'neue Ziele';
}

/** @type {{ icon: string, label: (s: TowerStats) => string, show: (s: TowerStats) => boolean, fmt: (s: TowerStats) => string, val: (s: TowerStats) => number }[]} */
const ROWS = [
  {
    icon: 'damage',
    label: (s) => (s.attack === 'pulse' ? 'Schaden je Puls' : 'Schaden'),
    show: (s) => s.attack !== 'none' && s.damage > 0,
    fmt: (s) => num1(s.damage) + (s.attack === 'beam' ? NNBSP + '/s' : ''),
    val: (s) => s.damage,
  },
  {
    icon: 'rate',
    label: (s) => (s.attack === 'pulse' ? 'Puls' : 'Feuerrate'),
    show: (s) => s.attack !== 'none' && s.attack !== 'beam' && s.cooldown > 0,
    fmt: (s) => (s.attack === 'pulse' ? 'alle ' + seconds(s.cooldown) : rate(s.cooldown)),
    val: (s) => 1 / s.cooldown,
  },
  {
    icon: 'range',
    label: (s) => (s.attack === 'none' ? 'Wirkungskreis' : s.attack === 'pulse' ? 'Pulsradius' : 'Reichweite'),
    show: (s) => s.range > 0,
    fmt: (s) => fixed1(s.range),
    val: (s) => s.range,
  },
  {
    icon: 'splash',
    label: (s) => (isPuddle(s) ? 'Pfütze' : 'Flächenschaden'),
    show: (s) => shoots(s) && s.attack !== 'pulse' && s.splash > 0,
    fmt: (s) => 'Radius ' + fixed1(s.splash) + (isPuddle(s) ? ' · ' + seconds(s.zone) : ''),
    val: (s) => s.splash * 100 + s.zone,
  },
  {
    icon: 'flame',
    label: (s) => (s.dot > 0 ? dotName + 'feld' : 'Bodenfeld'),
    show: (s) => leavesZone(s) && !isPuddle(s),
    fmt: (s) => 'liegt ' + seconds(s.zone),
    val: (s) => s.zone,
  },
  {
    icon: 'slow',
    label: () => 'Verlangsamung',
    show: (s) => shoots(s) && s.slow > 0,
    fmt: (s) => percent(s.slow) + (s.slowDuration > 0 && !leavesZone(s) ? ' · ' + seconds(s.slowDuration) : ''),
    val: (s) => s.slow,
  },
  {
    icon: 'flame',
    label: (s) => (isPuddle(s) ? 'Pfützenschaden' : dotName),
    show: (s) => shoots(s) && s.dot > 0 && s.dotDuration > 0,
    fmt: (s) => num1(s.dot) + NNBSP + '/s · ' + seconds(s.dotDuration),
    val: (s) => s.dot * s.dotDuration,
  },
  { icon: 'pierce', label: () => 'Rüstungsdurchschlag', show: (s) => shoots(s) && s.pierce > 0, fmt: (s) => percent(s.pierce), val: (s) => s.pierce },
  // Freiwillige Felder der Waffen des Pools (docs/SIM.md, „Türme und Angriffe“).
  {
    icon: 'back',
    label: () => 'Rückstoß',
    show: (s) => shoots(s) && (s.push ?? 0) > 0,
    // Zwei Nachkommastellen, wo es sie braucht: 0,35 Felder sind keine 0,4.
    fmt: (s) => String(Math.round((s.push ?? 0) * 100) / 100).replace('.', ',') + ((s.push ?? 0) === 1 ? ' Feld' : ' Felder') + ' · Bosse halb',
    val: (s) => s.push ?? 0,
  },
  {
    icon: 'weak',
    label: () => 'Zeichen',
    show: (s) => shoots(s) && (s.mark ?? 0) > 0,
    fmt: (s) => '+' + percent(s.mark ?? 0) + ' Schaden' + ((s.markDuration ?? 0) > 0 ? ' · ' + seconds(s.markDuration ?? 0) : ''),
    val: (s) => (s.mark ?? 0) * 100 + (s.markDuration ?? 0),
  },
  {
    icon: 'coin',
    label: () => 'Kopfgeld im Kreis',
    show: (s) => (s.auraBounty ?? 0) > 0,
    fmt: (s) => '+' + percent(s.auraBounty ?? 0),
    val: (s) => s.auraBounty ?? 0,
  },
  { icon: 'near', label: () => 'Bevorzugt', show: (s) => shoots(s) && s.seek === true, fmt: (s) => seekText(s), val: () => 1 },
  {
    icon: 'chain',
    label: () => 'Kette',
    show: (s) => shoots(s) && s.attack !== 'pulse' && s.chain > 0 && !(s.splash > 0),
    fmt: (s) => '+' + s.chain + (s.chain === 1 ? ' Ziel' : ' Ziele'),
    val: (s) => s.chain,
  },
  {
    icon: 'upgrade',
    label: () => 'Aufheizen',
    show: (s) => s.attack === 'beam' && s.ramp > 0,
    fmt: (s) => 'bis ×' + num1(1 + s.ramp) + (s.rampTime > 0 ? ' in ' + seconds(s.rampTime) : ''),
    val: (s) => s.ramp,
  },
  { icon: 'aura', label: () => 'Takt für Nachbarn', show: (s) => s.auraRate > 0, fmt: (s) => '+' + percent(s.auraRate) + ' Feuerrate', val: (s) => s.auraRate },
  { icon: 'damage', label: () => 'Aura', show: (s) => s.auraDamage > 0, fmt: (s) => '+' + percent(s.auraDamage) + ' Schaden', val: (s) => s.auraDamage },
  { icon: 'range', label: () => 'Aura', show: (s) => s.auraRange > 0, fmt: (s) => '+' + percent(s.auraRange) + ' Reichweite', val: (s) => s.auraRange },
];

/**
 * Ob eine Veränderung Schaden über Zeit einträgt.
 * @param {import('../types/content').StatMod | undefined} mod
 * @returns {boolean}
 */
function addsDot(mod) {
  return !!mod && ((mod.add?.dot ?? 0) > 0 || (mod.set?.dot ?? 0) > 0);
}

/**
 * Wie der Schaden über Zeit eines Turms heißt: nach `dotKind` der Waffe, die ihn bringt. Hat die Waffe selbst (oder ihr Zweig)
 * keinen, zählt die erste Gabe, die ihn einträgt (eine Superwaffe mit der Gabe des Giftschützen vergiftet). Ohne Angabe: Brand.
 * @param {import('../types/content').TowerArchetypeDef} arch
 * @param {readonly string[]} [gifts] Gaben einer Superwaffe (Kennungen der Waffen)
 * @param {{ archetypes: readonly import('../types/content').TowerArchetypeDef[] }} [content]
 * @returns {StatNames}
 */
export function statNames(arch, gifts, content) {
  const own = arch.dotKind ?? 'fire';
  /** @type {readonly import('../types/content').TowerBranchDef[]} */
  const branches = arch.branches ?? [];
  const ownDot = arch.stats.dot > 0 || branches.some((b) => addsDot(b.mod)) || addsDot(arch.fusion?.core);
  if (!ownDot && gifts && content) {
    for (const id of gifts) {
      const g = content.archetypes.find((a) => a.id === id);
      if (!g) continue;
      /** @type {readonly import('../types/content').TowerBranchDef[]} */
      const giftBranches = g.branches ?? [];
      const giftsDot = addsDot(g.fusion?.gift) || giftBranches.some((b) => addsDot(b.gift?.mod));
      if (giftsDot) return { dot: DOT_NAMES[g.dotKind ?? 'fire'] };
    }
  }
  return { dot: DOT_NAMES[own] };
}

/**
 * Die Angriffsweise in Worten (für den Hinweis, dass sie sich ändert); gleiche Schlüssel heißen gleiche Weise.
 * @param {TowerStats} s
 * @returns {{ key: string, text: string }}
 */
function attackStyle(s) {
  if (s.attack === 'none') {
    return s.auraDamage > 0 ? { key: 'aura-damage', text: 'Gibt Nachbarn künftig auch mehr Wucht' } : { key: 'aura', text: 'Stärkt künftig nur noch Nachbarn' };
  }
  if (s.attack === 'beam') return { key: 'beam', text: 'Schießt künftig als Dauerstrahl, der sich aufheizt' };
  if (s.attack === 'pulse') {
    if (s.dot > 0 && s.slow > 0) return { key: 'pulse-both', text: 'Sendet künftig einen Puls rund um den Turm, der bremst und brennt' };
    if (s.dot > 0) return { key: 'pulse-fire', text: 'Lodert künftig als Feuerring rund um den Turm' };
    if (s.slow > 0) return { key: 'pulse-frost', text: 'Sendet künftig einen Frostpuls rund um den Turm' };
    return { key: 'pulse', text: 'Wirkt künftig als Puls rund um den Turm' };
  }
  if (isPuddle(s)) return { key: 'puddle', text: 'Legt künftig Pfützen' };
  if (leavesZone(s)) return { key: 'field', text: s.dot > 0 ? 'Hinterlässt künftig ein Brandfeld am Einschlag' : 'Hinterlässt künftig ein Bodenfeld am Einschlag' };
  if (s.chain >= 2 && !(s.splash > 0)) return { key: 'chain', text: 'Springt künftig als Kettenblitz von Gegner zu Gegner' };
  if (s.splash > 0) return { key: 'area', text: s.hitsAir ? 'Schießt künftig Salven, die im Umkreis zerplatzen, am Boden und in der Luft' : 'Trifft künftig alles im Umkreis des Einschlags' };
  return { key: 'shot', text: 'Schießt künftig auf einzelne Ziele' };
}

/**
 * Was sich an der Art des Angriffs ändert, in kurzen Sätzen (leer, wenn nichts): neue Angriffsweise, neue Ziele in der Luft.
 * @param {TowerStats} stats
 * @param {TowerStats | null} next
 * @returns {string[]}
 */
export function attackChange(stats, next) {
  /** @type {string[]} */
  const lines = [];
  if (!next) return lines;
  const before = attackStyle(stats);
  const after = attackStyle(next);
  if (before.key !== after.key) lines.push(after.text);
  if (next.attack !== 'none' && next.hitsAir && !(stats.hitsAir && stats.attack !== 'none')) lines.push('Trifft künftig auch Flieger');
  if (next.seek && !stats.seek) lines.push('Sucht künftig Ziele, die seine Wirkung noch nicht tragen');
  return lines;
}

/**
 * Zeilen der Kennzahlen. Mit `next` (Werte nach Ausbau oder Modernisierung) trägt jede Zeile, die sich ändert, den neuen Wert;
 * Zeilen, die erst durch `next` entstehen, erscheinen mit einem Strich als altem Wert.
 * @param {TowerStats} stats
 * @param {TowerStats | null} [next]
 * @param {StatNames} [names]
 * @returns {StatRow[]}
 */
export function statRows(stats, next, names) {
  dotName = (names && names.dot) || 'Brand';
  /** @type {StatRow[]} */
  const rows = [];
  for (const row of ROWS) {
    const has = row.show(stats);
    const hasNext = next ? row.show(next) : false;
    if (!has && !hasNext) continue;
    const value = has ? row.fmt(stats) : '–';
    // Eine Zeile, die mit `next` entfällt (etwa die Pfütze, wenn der Turm künftig pulst), endet in einem Strich.
    const gone = !!next && has && !hasNext;
    const nextValue = gone ? '–' : next && hasNext ? row.fmt(next) : '';
    const changed = nextValue !== '' && nextValue !== value;
    const dir = gone ? -1 : changed && next ? (has ? Math.sign(row.val(next) - row.val(stats)) : 1) : 0;
    rows.push({ icon: row.icon, label: row.label(has ? stats : /** @type {TowerStats} */ (next)), value, next: changed ? nextValue : '', dir });
  }
  return rows;
}
