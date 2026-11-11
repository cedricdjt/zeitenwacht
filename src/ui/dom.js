// @ts-check
// Kleine DOM-Helfer der Oberfläche. Alle Schreibzugriffe, die in jedem Bild vorkommen können, gehen über die
// „set…“-Funktionen: Sie merken sich den zuletzt geschriebenen Wert und fassen das DOM nur an, wenn er sich ändert.

/** @type {WeakMap<Element, string>} */
const lastText = new WeakMap();
/** @type {WeakMap<Element, Map<string, string>>} */
const lastAttr = new WeakMap();

/**
 * Erzeugt ein Element.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {(Node | string | null | undefined | false)[]} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/**
 * Erzeugt einen Knopf mit Beschriftung für Vorleseprogramme.
 * @param {string} className
 * @param {string} label aria-label
 * @param {(Node | string | null | undefined | false)[]} children
 * @returns {HTMLButtonElement}
 */
export function button(className, label, ...children) {
  const node = el('button', className, ...children);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  return node;
}

/**
 * Setzt den Text eines Elements, falls er sich geändert hat.
 * @param {Element} node
 * @param {string} text
 */
export function setText(node, text) {
  if (lastText.get(node) === text) return;
  lastText.set(node, text);
  node.textContent = text;
}

/**
 * Setzt oder entfernt ein Attribut, falls es sich geändert hat. `null` entfernt es.
 * @param {Element} node
 * @param {string} name
 * @param {string | null} value
 */
export function setAttr(node, name, value) {
  let map = lastAttr.get(node);
  if (!map) {
    map = new Map();
    lastAttr.set(node, map);
  }
  const key = value === null ? '\u0000' : value;
  if (map.get(name) === key) return;
  map.set(name, key);
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

/**
 * Schaltet eine Klasse, falls nötig.
 * @param {Element} node
 * @param {string} name
 * @param {boolean} on
 */
export function setClass(node, name, on) {
  if (node.classList.contains(name) !== on) node.classList.toggle(name, on);
}

/**
 * Setzt eine CSS-Variable oder Stileigenschaft, falls sie sich geändert hat.
 * @param {HTMLElement | SVGElement} node
 * @param {string} prop
 * @param {string} value
 */
export function setStyle(node, prop, value) {
  let map = lastAttr.get(node);
  if (!map) {
    map = new Map();
    lastAttr.set(node, map);
  }
  const key = 'style:' + prop;
  if (map.get(key) === value) return;
  map.set(key, value);
  node.style.setProperty(prop, value);
}

/**
 * Blendet ein Element über das Attribut `hidden` ein oder aus.
 * @param {HTMLElement} node
 * @param {boolean} visible
 */
export function setVisible(node, visible) {
  if (node.hidden === visible) node.hidden = !visible;
}

/**
 * Leert ein Element.
 * @param {Element} node
 */
export function clear(node) {
  node.textContent = '';
  lastText.delete(node);
}

/**
 * Startet eine CSS-Animation neu, die an einer Klasse hängt.
 * @param {HTMLElement} node
 * @param {string} className
 */
export function retrigger(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/**
 * Relative Leuchtdichte einer Farbe '#rrggbb' (WCAG).
 * @param {string} hex
 * @returns {number}
 */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return 0.2;
  let sum = 0;
  const weights = [0.2126, 0.7152, 0.0722];
  for (let i = 0; i < 3; i++) {
    const c = parseInt(m[i + 1], 16) / 255;
    sum += weights[i] * (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  }
  return sum;
}

/**
 * Gut lesbare Schriftfarbe auf einer Fläche in der gegebenen Farbe: dunkel auf hellen, hell auf dunklen Flächen.
 * @param {string} hex
 * @returns {string}
 */
export function textOn(hex) {
  const l = luminance(hex);
  // Kontrast gegen Fast-Schwarz (#14181f) und Fast-Weiß (#fffdf8) vergleichen.
  const dark = (l + 0.05) / (0.009 + 0.05);
  const light = (0.98 + 0.05) / (l + 0.05);
  return dark >= light ? '#14181f' : '#fffdf8';
}

/**
 * Hellt eine Farbe so weit auf, dass sie als Schrift oder Symbol auf dunklem Glas gut lesbar ist (mindestens etwa 4,5 : 1).
 * @param {string} hex
 * @returns {string}
 */
export function readableOnDark(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return '#f3efe6';
  let r = parseInt(m[1], 16);
  let g = parseInt(m[2], 16);
  let b = parseInt(m[3], 16);
  for (let i = 0; i < 12; i++) {
    const h = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    if (luminance(h) >= 0.3) return h;
    r += (255 - r) * 0.18;
    g += (255 - g) * 0.18;
    b += (255 - b) * 0.18;
  }
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
