// Schiffssilhouette als DOM-freier Baum. viewBox 0 0 100 60, eine Akzentfarbe, Triebwerkspunkt in Gold.
// Form nach class, Detailgrad nach hull, Variante deterministisch aus der id (Hash).

import { hashString, round1, svgToString } from './svg-tree.js';

const CLASS_SHAPES = {
  frigate: { len: 48, w: 9, wing: 8 },
  destroyer: { len: 58, w: 7, wing: 6 },
  cruiser: { len: 62, w: 13, wing: 10 },
  battlecruiser: { len: 68, w: 15, wing: 12 },
  battleship: { len: 78, w: 18, wing: 14 },
  barge: { len: 60, w: 17, wing: 2 },
  hauler: { len: 64, w: 19, wing: 0 }
};
export const SHIP_CLASSES = Object.keys(CLASS_SHAPES);
const HULL_SCALE = { small: 0.85, medium: 1, large: 1.1, capital: 1.15 };
const HULL_DETAIL = { small: 0, medium: 1, large: 2, capital: 3 };
const MAX_HALF_HEIGHT = 26;

export function shipTree(ship = {}) {
  const shape = CLASS_SHAPES[ship.class] ?? CLASS_SHAPES.frigate;
  const key = String(ship.id ?? ship.name ?? 'ship');
  const variant = hashString(key) % 5;
  let scale = HULL_SCALE[ship.hull] ?? 1;
  const half = shape.w + shape.wing;
  if (half * scale > MAX_HALF_HEIGHT) scale = MAX_HALF_HEIGHT / half;
  const len = shape.len * scale;
  const w = shape.w * scale;
  const wing = shape.wing * scale;
  const x0 = 50 - len / 2;
  const x1 = 50 + len / 2;
  const tipX = x0 + len * 0.12 + variant * 1.5;
  const upper = [
    [x1, 30], [x1 - len * 0.25, 30 - w * 0.6], [x0 + len * 0.35, 30 - w],
    [tipX, 30 - w - wing], [x0, 30 - w * 0.5]
  ];
  const lower = upper.slice(1).reverse().map(([x, y]) => [x, 60 - y]);
  const points = [...upper, ...lower].map(([x, y]) => `${round1(x)},${round1(y)}`).join(' ');
  const details = HULL_DETAIL[ship.hull] ?? 1;
  const parts = [['polygon', { points, fill: 'var(--acc, #1f6f8b)' }]];
  for (let i = 0; i < details + (variant % 2); i++) {
    const x = round1(x0 + len * (0.3 + i * 0.15));
    parts.push(['line', { x1: x, y1: round1(30 - w * 0.7), x2: x, y2: round1(30 + w * 0.7), stroke: 'var(--panel, #ffffff)', 'stroke-width': 1, 'stroke-opacity': 0.7 }]);
  }
  parts.push(['ellipse', { cx: round1(x1 - len * 0.22), cy: 30, rx: round1(len * 0.07), ry: round1(Math.max(1.5, w * 0.22)), fill: 'var(--panel, #ffffff)', 'fill-opacity': 0.85 }]);
  parts.push(['circle', { cx: round1(x0 + 1), cy: 30, r: 2.5, fill: 'var(--gold, #a8700e)' }]);
  return ['svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 100 60', class: 'c-shipart__svg' }, ...parts];
}

export const shipSvgString = (ship) => svgToString(shipTree(ship));
