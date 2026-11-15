// Erz-Symbol: Facettenform, Farbe aus --ore-1..8 per Hash der Erz-id. Kein Zufall.

import { hashString, svgToDom } from './svg-tree.js';

export const oreColorIndex = (oreId) => (hashString(String(oreId ?? 'ore')) % 8) + 1;

export function oreTree(ore = {}, { size = 18 } = {}) {
  const color = `var(--ore-${oreColorIndex(ore.id)})`;
  return ['svg', { class: 'c-ore', viewBox: '0 0 18 18', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' },
    ['polygon', { points: '9,1.5 15.5,5.5 15.5,12.5 9,16.5 2.5,12.5 2.5,5.5', fill: color }],
    ['polyline', { points: '2.5,5.5 9,9.5 15.5,5.5', fill: 'none', stroke: 'var(--panel, #ffffff)', 'stroke-width': 1, 'stroke-opacity': 0.8 }],
    ['line', { x1: 9, y1: 9.5, x2: 9, y2: 16.5, stroke: 'var(--panel, #ffffff)', 'stroke-width': 1, 'stroke-opacity': 0.8 }]];
}

export const oreIcon = (ore, options) => svgToDom(oreTree(ore, options));
