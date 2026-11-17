// Meter / Fortschrittsbalken. role=progressbar, Breite nur dynamisch per Inline-Style.

import { h, setText } from '../../util/dom.js';
import { clamp } from '../../util/math.js';

const parts = new WeakMap();
const percentOf = (value, max) => (max > 0 ? clamp((value / max) * 100, 0, 100) : 0);

/** @param {{label: string, value: number, max: number, text?: string, tone?: 'default'|'ok'|'warn'|'bad'}} o */
export function meter(o) {
  const bar = h('span', { class: 'c-meter__bar' });
  const text = h('span', { class: 'c-meter__text u-num' });
  const el = h('div', { class: 'c-meter', role: 'progressbar', 'aria-valuemin': 0 },
    h('span', { class: 'c-meter__track' }, bar), text);
  parts.set(el, { bar, text });
  return updateMeter(el, o);
}

export function updateMeter(el, o) {
  const { bar, text } = parts.get(el);
  const max = o.max ?? 100;
  const value = clamp(o.value ?? 0, 0, max > 0 ? max : 0);
  el.setAttribute('aria-valuemax', String(max));
  el.setAttribute('aria-valuenow', String(value));
  if (o.label !== undefined) el.setAttribute('aria-label', o.label);
  if (o.text !== undefined) el.setAttribute('aria-valuetext', o.text);
  el.setAttribute('class', `c-meter${o.tone && o.tone !== 'default' ? ` c-meter--${o.tone}` : ''}`);
  const width = `${percentOf(value, max)}%`;
  if (bar.style.width !== width) bar.style.width = width;
  setText(text, o.text ?? `${Math.round(percentOf(value, max))} %`);
  return el;
}
