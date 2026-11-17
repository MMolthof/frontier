// Resistenzen: 4 Schadensarten x 3 Schichten. Eingabe: fertige Brüche 0-1 mit Feldnamen aus data/stats.json
// (shield_res_em ...). Ausgabe: formatierte Prozent plus Balken. Farbe ist nie alleiniger Träger.

import { h, setText } from '../../util/dom.js';
import { fmt } from '../../util/format.js';
import { uiText } from './ui-strings.js';

export const DAMAGE_TYPES = ['em', 'th', 'kin', 'exp'];
export const LAYERS = ['shield', 'armor', 'structure'];

const parts = new WeakMap();
const percent = (fraction) => `${fmt((Number.isFinite(fraction) ? fraction : 0) * 100, 0)} %`;

/** @param {{stats: Record<string, number>, t?: Function}} o */
export function resistMatrix(o) {
  const t = uiText(o.t);
  const cells = {};
  const rows = LAYERS.map((layer) => h('tr', null,
    h('th', { scope: 'row' }, t(`ui.layer.${layer}`)),
    DAMAGE_TYPES.map((type) => {
      const text = h('span', { class: 'u-num' });
      const bar = h('span', { class: 'c-resist__bar' });
      cells[`${layer}_res_${type}`] = { text, bar };
      return h('td', { class: 'c-resist__cell' }, text, h('span', { class: 'c-resist__track' }, bar));
    })));
  const el = h('div', { class: 'c-table-wrap' }, h('table', { class: 'c-table c-resist' },
    h('caption', { class: 'u-sr' }, t('ui.res.caption')),
    h('thead', null, h('tr', null, h('td'), DAMAGE_TYPES.map((type) => h('th', { scope: 'col' }, t(`ui.res.${type}`))))),
    h('tbody', null, rows)));
  parts.set(el, cells);
  return updateResistMatrix(el, o);
}

export function updateResistMatrix(el, o) {
  const cells = parts.get(el);
  for (const [key, { text, bar }] of Object.entries(cells)) {
    const value = o.stats?.[key] ?? 0;
    setText(text, percent(value));
    const width = `${Math.max(0, Math.min(100, value * 100))}%`;
    if (bar.style.width !== width) bar.style.width = width;
  }
  return el;
}
