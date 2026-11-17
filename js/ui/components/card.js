// Karte: Kopf (Titel, optional Untertitel und Aktionen) und Inhalt.

import { h } from '../../util/dom.js';

/** @param {{title?: string, subtitle?: string, actions?: any, children?: any, tag?: string, id?: string, className?: string}} o */
export function card(o = {}) {
  const head = o.title || o.actions
    ? h('div', { class: 'c-card__head' },
      h('div', { class: 'c-card__heading' },
        o.title ? h('h2', { class: 'c-card__title' }, o.title) : null,
        o.subtitle ? h('p', { class: 'c-card__sub u-mute' }, o.subtitle) : null),
      o.actions ? h('div', { class: 'c-card__actions' }, o.actions) : null)
    : null;
  return h(o.tag ?? 'section', { class: ['c-card', o.className], id: o.id }, head, h('div', { class: 'c-card__body' }, o.children));
}
