// Fitting-Balken (PG / CPU / Calibration): Wert/Max, bei Überschreitung rot UND mit Text "+n zu viel".

import { h, setText } from '../../util/dom.js';
import { fmt } from '../../util/format.js';
import { clamp } from '../../util/math.js';
import { uiText } from './ui-strings.js';

const parts = new WeakMap();
const num = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);

/** @param {{label: string, value: number, max: number, unit?: string, t?: Function}} o */
export function statBar(o) {
  const name = h('span', { class: 'c-statbar__name' });
  const bar = h('span', { class: 'c-statbar__bar' });
  const values = h('span', { class: 'c-statbar__values u-num' });
  const over = h('span', { class: 'c-statbar__over' });
  const el = h('div', { class: 'c-statbar', role: 'progressbar', 'aria-valuemin': 0 },
    h('span', { class: 'c-statbar__head' }, name, values, over), h('span', { class: 'c-meter__track' }, bar));
  parts.set(el, { name, bar, values, over });
  return updateStatBar(el, o);
}

export function updateStatBar(el, o) {
  const { name, bar, values, over } = parts.get(el);
  const t = uiText(o.t);
  const max = o.max ?? 0;
  const value = o.value ?? 0;
  const excess = Math.max(0, value - max);
  const unit = o.unit ? ` ${o.unit}` : '';
  setText(name, o.label);
  setText(values, `${num(value)} / ${num(max)}${unit}`);
  setText(over, excess > 0 ? t('ui.over', { n: num(excess) }) : '');
  el.setAttribute('class', `c-statbar${excess > 0 ? ' c-statbar--over' : ''}`);
  el.setAttribute('aria-label', o.label);
  el.setAttribute('aria-valuemax', String(max));
  el.setAttribute('aria-valuenow', String(value));
  el.setAttribute('aria-valuetext', `${num(value)} von ${num(max)}${unit}${excess > 0 ? `, ${t('ui.over', { n: num(excess) })}` : ''}`);
  const width = `${max > 0 ? clamp((value / max) * 100, 0, 100) : value > 0 ? 100 : 0}%`;
  if (bar.style.width !== width) bar.style.width = width;
  return el;
}
