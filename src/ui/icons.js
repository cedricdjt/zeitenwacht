// @ts-check
// Symbole der Bedienoberfläche als eingebettete SVGs in einem einheitlichen Strichstil:
// Zeichenfläche 24 x 24, Strichstärke 1,8, runde Enden, Farbe = currentColor. Keine Emoji, keine Bilddateien.
// Elemente mit der Klasse „f“ sind gefüllt statt umrandet.

/** Geometrie je Symbolname (Inhalt eines <svg viewBox="0 0 24 24">). */
/** @type {Record<string, string>} */
const ICONS = {
  // --- Allgemeines ---
  dot: '<circle class="f" cx="12" cy="12" r="3.2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2l2.6 3.8-2.6 3.8-2.6-3.8z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  flame: '<path d="M12 3c.6 3.2 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2 .9-3.2 1.9-4.2.3 1.5 1 2.3 1.9 2.6C10.2 9 10.6 5.6 12 3z"/><path class="f" d="M12 19.2a2.2 2.2 0 0 0 2.2-2.2c0-1.4-1.3-2-2.2-3.4-.9 1.4-2.2 2-2.2 3.4a2.2 2.2 0 0 0 2.2 2.2z"/>',
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6 6.9 19.3l1-5.7-4.1-4 5.7-.8z"/>',
  starFull: '<path class="f" d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6 6.9 19.3l1-5.7-4.1-4 5.7-.8z"/>',
  wave: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  lock: '<path d="M6.5 11h11v8.5h-11zM8.8 11V8.2a3.2 3.2 0 0 1 6.4 0V11"/>',
  pause: '<path stroke-width="2.6" d="M9 6.5v11M15 6.5v11"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  fast: '<path d="M4.5 6.5v11l7.5-5.5zM12.5 6.5v11L20 12z"/>',
  gear: '<circle cx="12" cy="12" r="5.4"/><circle cx="12" cy="12" r="1.8"/><path d="M12 2.8v3.2M12 18v3.2M2.8 12H6M18 12h3.2M5.5 5.5l2.3 2.3M16.2 16.2l2.3 2.3M5.5 18.5l2.3-2.3M16.2 7.8l2.3-2.3"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  check: '<path d="M5.5 12.5l4.2 4.2 8.8-9.4"/>',
  soundOn: '<path d="M4 10v4h3.4l4.6 3.8V6.2L7.4 10zM15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  soundOff: '<path d="M4 10v4h3.4l4.6 3.8V6.2L7.4 10zM15.5 9.5l5 5M20.5 9.5l-5 5"/>',
  upgrade: '<path d="M6.5 12.5L12 7l5.5 5.5M6.5 18L12 12.5l5.5 5.5"/>',
  modernize: '<path d="M7 4h10M7 20h10M8.2 4c0 4.4 3.8 5.4 3.8 8s-3.8 3.6-3.8 8M15.8 4c0 4.4-3.8 5.4-3.8 8s3.8 3.6 3.8 8"/><path class="f" d="M10 18.8c.6-1.4 1.3-2 2-2.6.7.6 1.4 1.2 2 2.6z"/>',
  sell: '<path d="M12 4v9M8.5 9.5L12 13l3.5-3.5M5 15v3.5h14V15"/>',
  first: '<path d="M4 12h11M11.5 8l4 4-4 4M19.5 6v12"/>',
  last: '<path d="M20 12H9M12.5 8l-4 4 4 4M4.5 6v12"/>',
  strong: '<circle cx="12" cy="12" r="8"/><path d="M12 8.5v7M8.5 12h7"/>',
  weak: '<circle cx="12" cy="12" r="5"/><path d="M9.8 12h4.4"/>',
  near: '<circle cx="12" cy="12" r="6.2"/><path d="M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4"/><circle class="f" cx="12" cy="12" r="1.4"/>',
  ground: '<path d="M8 4h6v8.5c2.8.6 5 1.6 5 4V19H8zM8 15.8h10.6"/>',
  air: '<path d="M3 8.6c5-2.8 11-2.8 18 0-2 1.6-4 2.4-6 2.6 1 .4 2 .5 3 .4-2 2-5 2.6-8 2-3-.6-5.5-2.4-7-5z"/>',
  crown: '<path d="M4.5 17.5l-1-9 4.8 3.8L12 6l3.7 6.3 4.8-3.8-1 9zM5 20.2h14"/>',
  // Nebel: drei weiche Schwaden.
  fog: '<path d="M4 8.5c2-1.3 4-1.3 6 0s4 1.3 6 0M7 13c2.2-1.3 4.4-1.3 6.6 0s4.4 1.3 6.4 0M3.5 17.5c2-1.3 4-1.3 6 0s4 1.3 6 0"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
  moon: '<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0zM8 6H5c0 3 1.2 4.5 3.2 4.8M16 6h3c0 3-1.2 4.5-3.2 4.8M12 13.5V17M8.5 19.5h7M9.5 17h5v2.5h-5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle class="f" cx="12" cy="7.8" r="1.1"/>',
  auto: '<path d="M5 12a7 7 0 0 1 12-4.9M19 4.2v3.4h-3.4M19 12a7 7 0 0 1-12 4.9M5 19.8v-3.4h3.4"/>',
  camera: '<path d="M4 8.5h3l1.5-2.2h7L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.2"/>',
  gift: '<path d="M4.5 10.5h15V20h-15zM3.5 7.2h17v3.3h-17zM12 7.2V20M12 7.2c-1.5-3.6-5-3-4.5-.8.3 1 2 1 4.5.8zM12 7.2c1.5-3.6 5-3 4.5-.8-.3 1-2 1-4.5.8z"/>',
  map: '<path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2zM9 4.5v13M15 6.5v13"/>',
  recipe: '<path d="M7.5 4.5h10v12.8a2.2 2.2 0 0 1-2.2 2.2H6.7a2.2 2.2 0 0 1-2.2-2.2v-1.6h10.3v1.6a2.2 2.2 0 0 0 2.2 2.2M7.5 4.5a1.8 1.8 0 0 0-1.8 1.8v9.4M10 8.6h4.8M10 11.8h4.8"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.7a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.8-1.1 1.5v.5"/><circle class="f" cx="12" cy="16.8" r="1.1"/>',
  book: '<path d="M12 6.5c-2-1.6-4.8-2-7.5-1.5v13c2.7-.5 5.5-.1 7.5 1.5 2-1.6 4.8-2 7.5-1.5V5c-2.7-.5-5.5-.1-7.5 1.5zM12 6.5v13"/>',
  keyboard: '<path d="M3.5 7h17v10h-17zM7 10.5h1M11.5 10.5h1M16 10.5h1M8 13.8h8"/>',
  // --- Kennzahlen der Türme ---
  damage: '<path d="M12 3l1.9 5.3L19 6l-2.3 5.1L21 13l-4.6 1.5L18 20l-4.6-3-1.4 4-1.4-4L6 20l1.6-5.5L3 13l4.3-1.9L5 6l5.1 2.3z"/>',
  rate: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.6M10 3.5h4M17.6 7.4l1.4-1.4"/>',
  range: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 3"/><circle class="f" cx="12" cy="12" r="1.6"/><path d="M12 12h8.5"/>',
  // Sumpf: Schilf über welligem Wasser.
  marsh: '<path d="M3.5 18c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.2 0 2.8-1.2 4.2 0 2.8 1.2 4.2 0M9 15.5c-.4-3.4-.4-6.4 0-9.5M12.5 15c.3-3 1.2-5.2 3.2-7M7.5 15.2c-.9-1.9-2-3-3.4-3.6"/><path class="f" d="M9 9.6a1.2 2.4 0 1 0 0-4.8 1.2 2.4 0 1 0 0 4.8z"/>',
  splash: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.2" stroke-dasharray="4 3.2"/>',
  slow: '<path d="M12 3.5c3 3.8 5 6 5 8.6a5 5 0 0 1-10 0c0-2.6 2-4.8 5-8.6zM5 19.8c2-1.3 12-1.3 14 0"/>',
  burn: '<path d="M3 10h6v4H3zM9 10.4c4-2.6 8-3 12 1.6-4 4.6-8 4.2-12 1.6M12.5 12h4"/>',
  pierce: '<path d="M3 12h13M12.8 8.4l4.6 3.6-4.6 3.6M20.2 4.5v5M20.2 14.5v5"/>',
  chain: '<circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/>',
  aura: '<path d="M12 21V9.2M8.5 21h7M6.6 3.2a8 8 0 0 0 0 6M17.4 3.2a8 8 0 0 1 0 6"/><circle cx="12" cy="6.2" r="2.6"/>',
  acid: '<path d="M3.5 17.2c0-2 3.8-3.4 8.5-3.4s8.5 1.400 8.500 3.400-3.800 3.300-8.500 3.300-8.500-1.300-8.500-3.300z"/><path d="M12 3.200c1.700 2.200 2.800 3.500 2.800 5a2.800 2.800 0 0 1-5.600 0c0-1.500 1.100-2.800 2.800-5z"/><circle class="f" cx="8.200" cy="17" r="1"/><circle class="f" cx="15.200" cy="17.600" r="1.300"/><circle cx="18.600" cy="9.800" r="1.100"/>',
  fuse: '<circle cx="12" cy="13.600" r="4.600"/><circle class="f" cx="12" cy="13.600" r="1.500"/><circle cx="5" cy="5.600" r="2.100"/><circle cx="19" cy="5.600" r="2.100"/><path d="M6.600 7.300l2.300 2.700M17.400 7.300l-2.300 2.700M12 18.200v2.600M9.600 20.800h4.800"/>',
  // --- Eigenschaften der Gegner ---
  armored: '<path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6.3zM12 3.5v17"/>',
  flying: '<path d="M3 8.6c5-2.8 11-2.8 18 0-2 1.6-4 2.4-6 2.6 1 .4 2 .5 3 .4-2 2-5 2.6-8 2-3-.6-5.5-2.4-7-5z"/>',
  quick: '<path d="M4.5 7l5 5-5 5M12 7l5 5-5 5"/>',
  swarm: '<circle cx="7.2" cy="15.5" r="3.1"/><circle cx="16.8" cy="15.5" r="3.1"/><circle cx="12" cy="7.5" r="3.1"/>',
  regen: '<path d="M19 12a7 7 0 1 1-2.2-5.1M19.2 4.2v3.4h-3.4M12 9.4v5.2M9.4 12h5.2"/>',
  shield: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/><path d="M12 8.6l3 1.7v3.4l-3 1.7-3-1.7v-3.4z"/>',
  carrier: '<path d="M4.5 9.5h15V19h-15zM4.5 9.5l2.5-4h10l2.5 4"/><circle class="f" cx="8.6" cy="14.2" r="1.1"/><circle class="f" cx="12" cy="14.2" r="1.1"/><circle class="f" cx="15.4" cy="14.2" r="1.1"/>',
  healer: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  boss: '<path d="M4.5 17.5l-1-9 4.8 3.8L12 6l3.7 6.3 4.8-3.8-1 9zM5 20.2h14"/>',
  tough: '<path d="M8.5 9h7l3 10h-13zM10 9a2 2 0 1 1 4 0"/>',
  steady: '<path d="M12 4c3 3.8 5 6.2 5 8.8a5 5 0 0 1-10 0c0-2.6 2-5 5-8.8zM5 5l14 14"/>',
  // --- Zeitalter ---
  steinzeit: '<path d="M12 2.8l4.6 8.2-4.6 4.6L7.4 11zM12 15.6V21.2M9.4 18.2h5.2"/>',
  rom: '<path d="M5.5 4.8h13M5.5 19.2h13M7.5 4.8v2.4h9V4.8M7.5 19.2v-2.4h9v2.4M9 7.2v9.6M12 7.2v9.6M15 7.2v9.6"/>',
  mittelalter: '<path d="M6 20V9H4.5V4.5h3V7h3V4.5h3V7h3V4.5h3V9H18v11zM10.2 20v-4.2a1.8 1.8 0 0 1 3.6 0V20"/>',
  entdecker: '<circle cx="12" cy="5.3" r="2"/><path d="M12 7.3V20M8.8 10.8h6.4M12 20c-4 0-6.4-2.4-7-6M12 20c4 0 6.400-2.4 7-6"/>',
  industrie: '<path d="M3.5 20v-8.5l5 3v-3l5 3V5H18v15zM6.5 17.2h2M11 17.2h2"/>',
  zukunft: '<ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/><circle class="f" cx="12" cy="12" r="1.7"/>',
  // --- Turmrollen ---
  schuetze: '<path d="M5 19L18.8 5.2M18.8 5.2h-5.6M18.8 5.2v5.6M5 19l.8-4.2M5 19l4.2-.8"/>',
  werfer: '<path d="M3.5 18.5C5.5 8.5 11.5 6 15.4 11.6"/><circle class="f" cx="17.2" cy="14.4" r="2.7"/><path d="M12.5 19.8h9"/>',
  bremser: '<path d="M12 3.5c3 3.8 5 6 5 8.6a5 5 0 0 1-10 0c0-2.6 2-4.8 5-8.6zM5 19.8c2-1.3 12-1.3 14 0"/>',
  knacker: '<path d="M3 12h13M12.8 8.4l4.6 3.6-4.6 3.6M20.2 4.5v5M20.2 14.5v5"/>',
  brenner: '<path d="M3 10h6v4H3zM9 10.4c4-2.6 8-3 12 1.6-4 4.6-8 4.2-12 1.6M12.5 12h4"/>',
  taktgeber: '<path d="M12 21V9.2M8.5 21h7M6.6 3.2a8 8 0 0 0 0 6M17.4 3.2a8 8 0 0 1 0 6"/><circle cx="12" cy="6.2" r="2.6"/>',
  // --- Fähigkeit ---
  bell: '<path d="M5.8 16.6c1.3-1.4 1.8-3.2 1.8-5.7a4.4 4.4 0 0 1 8.8 0c0 2.5.5 4.300 1.8 5.7zM10.2 19.200a1.900 1.900 0 0 0 3.600 0M12 4.200v2.300"/>',
};

/** Andere gebräuchliche Namen für dieselben Symbole, damit Inhalte nicht an einer Schreibweise scheitern. */
/** @type {Record<string, string>} */
const ALIASES = {
  gold: 'coin', lives: 'flame', life: 'heart', funken: 'flame', score: 'star', time: 'clock', hourglass: 'modernize',
  sound: 'soundOn', mute: 'soundOff', settings: 'gear', help: 'book',
  strongest: 'strong', weakest: 'weak', nearest: 'near',
  stone: 'steinzeit', rome: 'rom', roman: 'rom', medieval: 'mittelalter', explorer: 'entdecker', explorers: 'entdecker',
  industry: 'industrie', industrial: 'industrie', future: 'zukunft',
  shooter: 'schuetze', arrow: 'schuetze', 'schütze': 'schuetze', thrower: 'werfer', mortar: 'werfer', bomb: 'werfer', area: 'werfer',
  slower: 'bremser', drop: 'bremser', puddle: 'bremser', sniper: 'knacker', panzerknacker: 'knacker', breaker: 'knacker', bolt: 'knacker',
  burner: 'brenner', fire: 'brenner', support: 'taktgeber', buff: 'taktgeber', beat: 'taktgeber', pulse: 'taktgeber', drum: 'taktgeber',
  zeitglocke: 'bell', glocke: 'bell', rewind: 'bell', ability: 'bell',
  armor: 'armored', gepanzert: 'armored', fliegend: 'flying', schnell: 'quick', schwarm: 'swarm',
  regeneriert: 'regen', schild: 'shield', 'träger': 'carrier', traeger: 'carrier', heiler: 'healer', 'zäh': 'tough', zaeh: 'tough',
  standfest: 'steady',
};

/**
 * Ob es ein Symbol dieses Namens gibt (auch über einen Zweitnamen).
 * @param {string | null | undefined} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  if (!name) return false;
  return Object.prototype.hasOwnProperty.call(ICONS, name) || Object.prototype.hasOwnProperty.call(ALIASES, name);
}

/**
 * Löst einen Symbolnamen auf; Unbekanntes wird zum neutralen Punkt.
 * @param {string | null | undefined} name
 * @returns {string}
 */
function resolve(name) {
  if (name && Object.prototype.hasOwnProperty.call(ICONS, name)) return name;
  if (name && Object.prototype.hasOwnProperty.call(ALIASES, name)) return ALIASES[name];
  const lower = name ? name.toLowerCase() : '';
  if (lower && Object.prototype.hasOwnProperty.call(ICONS, lower)) return lower;
  if (lower && Object.prototype.hasOwnProperty.call(ALIASES, lower)) return ALIASES[lower];
  return 'dot';
}

/**
 * SVG-Markup eines Symbols. Unbekannte Namen ergeben einen neutralen Punkt, nie einen Fehler.
 * @param {string | null | undefined} name
 * @param {string} [extraClass] zusätzliche CSS-Klassen
 * @returns {string}
 */
export function iconSvg(name, extraClass) {
  const id = resolve(name);
  return `<svg class="zw-icon${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[id]}</svg>`;
}

/**
 * Nur die Geometrie eines Symbols (Inhalt für ein eigenes <svg> oder <g>, Zeichenfläche 24 x 24).
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function iconBody(name) {
  return ICONS[resolve(name)];
}

/**
 * Ein Symbol als fertiges Element.
 * @param {string | null | undefined} name
 * @param {string} [extraClass]
 * @returns {HTMLElement}
 */
export function icon(name, extraClass) {
  const span = document.createElement('span');
  span.className = 'zw-ic';
  span.innerHTML = iconSvg(name, extraClass);
  return span;
}

/**
 * Symbol einer Turmrolle: erst der Name aus den Daten, sonst die Kennung der Rolle, sonst der Punkt.
 * @param {{ id: string, icon: string }} arch
 * @returns {string} auflösbarer Symbolname
 */
export function roleIconName(arch) {
  if (hasIcon(arch.icon)) return arch.icon;
  if (hasIcon(arch.id)) return arch.id;
  return 'dot';
}

/**
 * Namen aller Symbole (für die Übersicht auf der Testseite).
 * @returns {string[]}
 */
export function listIcons() {
  return Object.keys(ICONS);
}
