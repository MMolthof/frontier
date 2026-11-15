// Button. Varianten: primary (Standard), alt, danger, ghost; icon-only braucht ariaLabel.
// Deaktiviert wird per aria-disabled (bleibt fokussierbar, Grund per title/Tooltip); Klicks werden dann ignoriert.

import { h, setText } from '../../util/dom.js';
import { icon } from './icon.js';

const VARIANTS = ['primary', 'alt', 'danger', 'ghost'];

/**
 * @param {{label?: string, variant?: string, icon?: string, ariaLabel?: string, onClick?: (ev: any) => void,
 *   disabled?: boolean, pressed?: boolean, type?: string, reason?: string}} o
 */
export function button(o = {}) {
  const el = h('button', {
    type: o.type ?? 'button',
    class: ['c-btn', o.variant && o.variant !== 'primary' ? `c-btn--${VARIANTS.includes(o.variant) ? o.variant : 'alt'}` : null, o.icon && !o.label ? 'c-btn--icon' : null],
    'aria-label': o.ariaLabel ?? (o.icon && !o.label ? o.label : null)
  });
  const state = { onClick: o.onClick, disabled: false, label: null, labelEl: null };
  el.addEventListener('click', (ev) => {
    if (state.disabled) { ev.preventDefault(); return; }
    state.onClick?.(ev);
  });
  if (o.icon) el.appendChild(icon(o.icon));
  if (o.label !== undefined) {
    state.labelEl = h('span', { class: 'c-btn__label' }, o.label);
    el.appendChild(state.labelEl);
  }
  button.state.set(el, state);
  updateButton(el, o);
  return el;
}
button.state = new WeakMap();

/** Ändert Beschriftung, Zustand und Handler in place. */
export function updateButton(el, o = {}) {
  const state = button.state.get(el);
  if ('onClick' in o) state.onClick = o.onClick;
  if ('label' in o && state.labelEl) setText(state.labelEl, o.label);
  if ('disabled' in o || 'reason' in o) {
    state.disabled = Boolean(o.disabled);
    if (state.disabled) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    if (state.disabled && o.reason) el.setAttribute('title', o.reason); else el.removeAttribute('title');
  }
  if ('pressed' in o) {
    if (o.pressed === undefined || o.pressed === null) el.removeAttribute('aria-pressed');
    else el.setAttribute('aria-pressed', String(Boolean(o.pressed)));
  }
  return el;
}
