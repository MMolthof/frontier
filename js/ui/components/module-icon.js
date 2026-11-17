// Modul-Symbole je Kategorie (24×24, currentColor). Reine Anzeige.
import { h } from '../../util/dom.js';

const L = (x1, y1, x2, y2) => ['line', { x1, y1, x2, y2 }];
const SHAPES = {
  mining: [['polygon', { points: '12,3 20,10 16,21 8,21 4,10' }], L(4, 10, 20, 10), L(12, 3, 12, 21)],
  weapon: [['circle', { cx: 12, cy: 12, r: 6 }], L(12, 2, 12, 8), L(12, 16, 12, 22), L(2, 12, 8, 12), L(16, 12, 22, 12)],
  shield: [['path', { d: 'M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z' }]],
  armor: [['rect', { x: 4, y: 5, width: 16, height: 14, rx: 2 }], L(4, 12, 20, 12), L(12, 5, 12, 19)],
  propulsion: [['polygon', { points: '4,17 12,4 20,17 12,13' }]],
  engineering: [['circle', { cx: 12, cy: 12, r: 4 }], L(12, 3, 12, 7), L(12, 17, 12, 21), L(3, 12, 7, 12), L(17, 12, 21, 12)],
  electronics: [['polygon', { points: '13,2 5,14 11,14 9,22 19,9 13,9' }]],
  scanner: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M5 12 A7 7 0 0 1 12 5' }], ['path', { d: 'M19 12 A7 7 0 0 1 12 19' }]],
  rig: [['polygon', { points: '12,3 20,8 20,16 12,21 4,16 4,8' }]],
  other: [['rect', { x: 5, y: 5, width: 14, height: 14, rx: 3 }]]
};

/** @param {string} category */
export function moduleIcon(category, { size = 22 } = {}) {
  const shapes = SHAPES[category] ?? SHAPES.other;
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, class: `c-modicon c-modicon--${SHAPES[category] ? category : 'other'}`, 'aria-hidden': 'true' },
    ...shapes.map(([tag, attrs]) => h(tag, attrs)));
}
