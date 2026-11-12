// Minimaler DOM-Builder. Nur im Browser verwenden, nie in js/core oder js/systems.

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'use', 'title', 'linearGradient', 'stop', 'clipPath'
]);

function applyAttr(el, key, value) {
  if (value === null || value === undefined || value === false) return;
  if (key === 'class' || key === 'className') {
    el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value));
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(el.style, value); // nur für dynamische Werte (z. B. Breiten)
  } else if (key === 'dataset' && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) el.dataset[k] = String(v);
  } else if (key.startsWith('on') && typeof value === 'function') {
    el.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
    if (key in el) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  } else {
    el.setAttribute(key, value === true ? '' : String(value));
  }
}

function appendChild(el, child) {
  if (child === null || child === undefined || child === false || child === true) return;
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(el, c));
  } else if (typeof child === 'object' && 'nodeType' in child) {
    el.appendChild(child);
  } else {
    el.appendChild(el.ownerDocument.createTextNode(String(child)));
  }
}

/**
 * h('button', { class: 'c-btn', onClick: fn }, 'Text') → HTMLElement (SVG-Tags werden als SVG erzeugt).
 * @param {string} tag
 * @param {Record<string, any>|null} [attrs]
 * @param {...any} children
 */
export function h(tag, attrs, ...children) {
  const doc = globalThis.document;
  const el = SVG_TAGS.has(tag) ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && !('nodeType' in attrs)) {
    for (const [k, v] of Object.entries(attrs)) applyAttr(el, k, v);
  } else if (attrs !== null && attrs !== undefined) {
    children.unshift(attrs);
  }
  children.forEach((c) => appendChild(el, c));
  return el;
}

/** Entfernt alle Kinder. */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Textinhalt nur ändern, wenn er sich unterscheidet (vermeidet unnötige Layouts). */
export function setText(el, text) {
  const next = String(text);
  if (el.textContent !== next) el.textContent = next;
}
