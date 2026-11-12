// Kleine Verlaufslinie (SVG). Rein darstellend.

import { h } from '../../util/dom.js';

/** Punkte für eine Polyline; flache Reihen liegen mittig. Rein, testbar. */
export function sparklinePoints(values, width = 120, height = 32, pad = 2) {
  const list = values.filter(Number.isFinite);
  if (!list.length) return '';
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min;
  return list.map((v, i) => {
    const x = list.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (list.length - 1);
    const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - 2 * pad);
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }).join(' ');
}

/** @param {{values: number[], width?: number, height?: number, label: string}} o */
export function sparkline(o) {
  const line = h('polyline', { class: 'c-spark__line', fill: 'none', 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
  const el = h('svg', { class: 'c-spark', role: 'img', width: o.width ?? 120, height: o.height ?? 32 }, line);
  el.__line = line;
  return updateSparkline(el, o);
}

export function updateSparkline(el, o) {
  const w = o.width ?? Number(el.getAttribute('width'));
  const hh = o.height ?? Number(el.getAttribute('height'));
  el.setAttribute('viewBox', `0 0 ${w} ${hh}`);
  el.setAttribute('aria-label', o.label);
  el.__line.setAttribute('points', sparklinePoints(o.values ?? [], w, hh));
  return el;
}
