// Tooltip: wickelt ein Ziel-Element, Text erscheint bei Hover/Fokus (reines CSS), Esc blendet aus.

import { h, setText } from '../../util/dom.js';

let counter = 0;
const parts = new WeakMap();

/** @param {any} target fokussierbares Element @param {string} text */
export function tooltip(target, text) {
  const id = `c-tip-${++counter}`;
  const tip = h('span', { class: 'c-tip__text', role: 'tooltip', id }, text);
  const wrap = h('span', { class: 'c-tip' }, target, tip);
  target.setAttribute('aria-describedby', id);
  wrap.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') wrap.classList.add('c-tip--off'); });
  wrap.addEventListener('mouseleave', () => wrap.classList.remove('c-tip--off'));
  wrap.addEventListener('focusout', () => wrap.classList.remove('c-tip--off'));
  parts.set(wrap, { tip });
  return wrap;
}

export function updateTooltip(wrap, text) { setText(parts.get(wrap).tip, text); return wrap; }
