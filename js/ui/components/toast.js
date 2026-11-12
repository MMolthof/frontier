// Toast-Region: aria-live, max. 4 gleichzeitig, Auto-Dismiss (injizierbare Timer), Esc und Schließen-Button.

import { h } from '../../util/dom.js';
import { button } from './button.js';
import { uiText } from './ui-strings.js';

const DEFAULT_TTL = { info: 5000, ok: 4000, warn: 7000, error: 9000 };

/**
 * @param {{root?: any, max?: number, t?: Function, timers?: {setTimeout: Function, clearTimeout: Function}}} o
 * @returns {{el: any, push: (toast: {kind?: string, text: string, ttl?: number}) => number, dismiss: (id: number) => void, count: () => number, clearAll: () => void}}
 */
export function createToastRegion(o = {}) {
  const t = uiText(o.t);
  const max = o.max ?? 4;
  const timers = o.timers ?? { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) };
  const el = h('div', { class: 'c-toasts', role: 'status', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const live = new Map();
  let nextId = 1;

  function dismiss(id) {
    const entry = live.get(id);
    if (!entry) return;
    if (entry.timer !== null) timers.clearTimeout(entry.timer);
    entry.node.remove();
    live.delete(id);
  }

  function push({ kind = 'info', text, ttl }) {
    const id = nextId++;
    const close = button({ icon: 'close', variant: 'ghost', ariaLabel: t('ui.close'), onClick: () => dismiss(id) });
    const node = h('div', { class: `c-toast c-toast--${kind}`, role: kind === 'error' ? 'alert' : null }, h('span', { class: 'c-toast__text' }, text), close);
    node.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); dismiss(id); } });
    el.appendChild(node);
    const wait = ttl ?? DEFAULT_TTL[kind] ?? DEFAULT_TTL.info;
    live.set(id, { node, timer: wait > 0 ? timers.setTimeout(() => dismiss(id), wait) : null });
    while (live.size > max) dismiss(live.keys().next().value);
    return id;
  }

  return { el, push, dismiss, count: () => live.size, clearAll: () => [...live.keys()].forEach(dismiss) };
}
