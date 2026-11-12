// 18-px-Inline-Icons, Strichstärke 1,5, currentColor. DOM-freier Baum plus DOM-Wrapper.

import { svgToDom } from './svg-tree.js';

const P = (d) => ['path', { d }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];
const R = (x, y, w, h, rx = 1) => ['rect', { x, y, width: w, height: h, rx }];

const SHAPES = {
  overview: [R(2, 2, 6, 6), R(10, 2, 6, 6), R(2, 10, 6, 6), R(10, 10, 6, 6)],
  system: [C(9, 9, 2), ['ellipse', { cx: 9, cy: 9, rx: 7, ry: 3.5 }], C(14.5, 7.2, 0.6)],
  station: [R(3, 3, 12, 12, 2), P('M3 9h12M9 3v12')],
  hangar: [P('M2 15V8l7-5 7 5v7'), P('M6 15v-4h6v4')],
  market: [P('M2 6h14l-1 3H3z'), P('M3 9v6h12V9'), P('M7 15v-3h4v3')],
  missions: [R(3, 2.5, 12, 13, 1.5), P('M6 6.5h6M6 9.5h6M6 12.5h3')],
  industry: [P('M2 15V8l4 2V8l4 2V4h3v11z'), P('M2 15h14')],
  shipyard: [P('M2 12l7-8 7 8z'), P('M4 15h10')],
  fitting: [C(9, 9, 6.5), C(9, 9, 2), P('M9 2.5v2M9 13.5v2M2.5 9h2M13.5 9h2')],
  mining: [P('M3 14l7-7'), P('M8 4c3-1 6 0 7 3-3-1-5-1-7-3z'), P('M9 9l4 4')],
  skills: [P('M9 2l2 4.5 5 .6-3.7 3.3 1 4.9L9 12.8 4.7 15.3l1-4.9L2 7.1l5-.6z')],
  account: [C(9, 6, 3), P('M3 15c.7-3 3-4.5 6-4.5s5.300 1.500 6 4.500')],
  log: [P('M4 3h10v12H4z'), P('M6.500 6.500h5M6.500 9h5M6.500 11.500h3')],
  settings: [P('M3 5h12M3 9h12M3 13h12'), C(6, 5, 1.5), C(12, 9, 1.5), C(7, 13, 1.5)],
  warp: [P('M2 9h9'), P('M8 5l5 4-5 4'), P('M14 5v8')],
  dock: [P('M3 14V8h12v6'), P('M9 3v7'), P('M6.500 7.500L9 10l2.500-2.500')],
  undock: [P('M3 14V8h12v6'), P('M9 10V3'), P('M6.500 5.500L9 3l2.500 2.500')],
  gate: [['ellipse', { cx: 9, cy: 9, rx: 6, ry: 6.500 }], ['ellipse', { cx: 9, cy: 9, rx: 2.500, ry: 3 }]],
  planet: [C(9, 9, 5), P('M2 11c4 2 10-1 14-4')],
  moon: [P('M12.500 3.500A6.500 6.500 0 1 0 14.500 12 5.500 5.500 0 0 1 12.500 3.500z')],
  belt: [C(4, 11, 1.200), C(8, 7, 1.500), C(12, 10, 1), C(14, 5, 1.200), C(6, 14, 1)],
  star: [C(9, 9, 2.500), P('M9 2v2.500M9 13.500V16M2 9h2.500M13.500 9H16')],
  anomaly: [C(9, 9, 6.500), C(9, 9, 3.200), C(9, 9, .6)],
  ore: [P('M9 2l5.500 4v6L9 16l-5.500-4V6z'), P('M3.500 6L9 9l5.500-3M9 9v7')],
  cargo: [P('M2.500 5.500L9 2.500l6.500 3v7L9 15.500l-6.500-3z'), P('M2.500 5.500L9 8.500l6.500-3M9 8.500v7')],
  shield: [P('M9 2l6 2v5c0 3.500-2.500 5.500-6 7-3.500-1.500-6-3.500-6-7V4z')],
  armor: [P('M9 2l6 2.500v5L9 16 3 9.500v-5z'), P('M9 5.500v6')],
  structure: [R(3, 3, 12, 12, 1), P('M3 3l12 12M15 3L3 15')],
  cap: [P('M10 2L5 10h4l-1 6 5-8H9z')],
  speed: [P('M3 13a6.500 6.500 0 1 1 12 0'), P('M9 13l3-4')],
  warning: [P('M9 2.500L16 15H2z'), P('M9 7v4'), C(9, 13, .5)],
  check: [P('M3.500 9.500l3.500 3.500 7.500-8')],
  close: [P('M4 4l10 10M14 4L4 14')],
  chevron: [P('M7 4l5 5-5 5')],
  lock: [R(4, 8, 10, 7, 1.500), P('M6 8V6a3 3 0 0 1 6 0v2')],
  info: [C(9, 9, 6.500), P('M9 8v4.500'), C(9, 5.700, .5)],
  search: [C(8, 8, 5), P('M12 12l4 4')],
  save: [P('M3 3h9l3 3v9H3z'), P('M6 3v4h5V3'), P('M6 15v-4h6v4')],
  import: [P('M9 2v9'), P('M5.500 7.500L9 11l3.500-3.500'), P('M3 14h12')],
  export: [P('M9 11V2'), P('M5.500 5.500L9 2l3.500 3.500'), P('M3 14h12')]
};

export const ICON_NAMES = Object.keys(SHAPES);

/** Baum für ein Icon. Unbekannte Namen liefern ein neutrales Info-Icon. */
export function iconTree(name, { size = 18, title = null } = {}) {
  const shapes = SHAPES[name] ?? SHAPES.info;
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': 'true' };
  return ['svg', {
    class: 'c-icon', viewBox: '0 0 18 18', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    focusable: 'false', ...a11y
  }, ...shapes];
}

export const icon = (name, options) => svgToDom(iconTree(name, options));
