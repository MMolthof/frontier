// Tab-Leiste (role=tablist) mit Pfeiltasten, Home/End und automatischer Aktivierung.

import { h, setText } from '../../util/dom.js';

const parts = new WeakMap();

/** @param {{tabs: {id: string, label: string, disabled?: boolean, reason?: string, controls?: string}[], active: string, onSelect: (id: string) => void, label?: string}} o */
export function tabs(o) {
  const el = h('div', { class: 'c-tabs', role: 'tablist', 'aria-label': o.label ?? null });
  const state = { o, els: new Map() };
  parts.set(el, state);
  el.addEventListener('keydown', (ev) => {
    const list = state.o.tabs.filter((tab) => !tab.disabled);
    const index = list.findIndex((tab) => tab.id === state.o.active);
    let next = null;
    if (ev.key === 'ArrowRight') next = list[(index + 1) % list.length];
    else if (ev.key === 'ArrowLeft') next = list[(index - 1 + list.length) % list.length];
    else if (ev.key === 'Home') next = list[0];
    else if (ev.key === 'End') next = list[list.length - 1];
    if (!next) return;
    ev.preventDefault();
    select(el, next.id, true);
  });
  return updateTabs(el, {});
}

function select(el, id, focus) {
  const state = parts.get(el);
  state.o.onSelect?.(id);
  updateTabs(el, { active: id });
  if (focus) state.els.get(id)?.focus();
}

export function updateTabs(el, patch) {
  const state = parts.get(el);
  Object.assign(state.o, patch);
  const seen = new Set();
  state.o.tabs.forEach((tab, index) => {
    seen.add(tab.id);
    let btn = state.els.get(tab.id);
    if (!btn) {
      btn = h('button', { type: 'button', role: 'tab', class: 'c-tab' });
      btn.addEventListener('click', () => { if (btn.getAttribute('aria-disabled') !== 'true') select(el, tab.id, false); });
      state.els.set(tab.id, btn);
    }
    setText(btn, tab.label);
    const active = tab.id === state.o.active;
    btn.setAttribute('aria-selected', String(active));
    btn.setAttribute('tabindex', active ? '0' : '-1');
    if (tab.disabled) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
    if (tab.disabled && tab.reason) btn.setAttribute('title', tab.reason); else btn.removeAttribute('title');
    if (tab.controls) btn.setAttribute('aria-controls', tab.controls);
    if (el.children[index] !== btn) el.insertBefore(btn, el.children[index] ?? null);
  });
  for (const [id, btn] of state.els) if (!seen.has(id)) { btn.remove(); state.els.delete(id); }
  return el;
}
