import { h } from '../../util/dom.js';
import { icon } from './icon.js';

/** @param {{title?: string, text?: string, icon?: string, action?: any}} o */
export function emptyState(o = {}) {
  return h('div', { class: 'c-empty' },
    h('span', { class: 'c-empty__icon' }, icon(o.icon ?? 'info', { size: 24 })),
    o.title ? h('p', { class: 'c-empty__title' }, o.title) : null,
    o.text ? h('p', { class: 'c-empty__text u-mute' }, o.text) : null,
    o.action ?? null);
}
