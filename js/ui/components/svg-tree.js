// DOM-freier SVG-Baum: ['g', { attrs }, child, ...]. Kinder sind weitere Knoten oder Text.
// svgToString: für Dateien und Tests (mit Escaping). svgToDom: über h().

import { h } from '../../util/dom.js';

const esc = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function split(node) {
  const [tag, second, ...rest] = node;
  const hasAttrs = second && typeof second === 'object' && !Array.isArray(second);
  return { tag, attrs: hasAttrs ? second : {}, children: hasAttrs ? rest : [second, ...rest].filter((c) => c !== undefined) };
}

export function svgToString(node) {
  if (node === null || node === undefined || node === false) return '';
  if (!Array.isArray(node)) return esc(node);
  const { tag, attrs, children } = split(node);
  const attrText = Object.entries(attrs)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => ` ${k}="${esc(v === true ? '' : v)}"`).join('');
  const inner = children.map(svgToString).join('');
  return children.length ? `<${tag}${attrText}>${inner}</${tag}>` : `<${tag}${attrText}/>`;
}

export function svgToDom(node) {
  if (node === null || node === undefined || node === false) return null;
  if (!Array.isArray(node)) return String(node);
  const { tag, attrs, children } = split(node);
  return h(tag, attrs, children.map(svgToDom));
}

/** Kleiner deterministischer Hash (FNV-1a, uint32). Kein Zufall. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export const round1 = (n) => Math.round(n * 10) / 10;
