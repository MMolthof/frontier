// Modal mit Fokusfalle, Esc zum Schließen, Fokus-Rückgabe. Dialog-Rolle: alertdialog für Bestätigungen.

import { h } from '../../util/dom.js';
import { button } from './button.js';
import { focusableWithin } from './focus.js';
import { uiText } from './ui-strings.js';

let counter = 0;

/**
 * @param {{title: string, content?: any, actions?: {label: string, variant?: string, value?: any}[], role?: 'dialog'|'alertdialog',
 *   root?: any, t?: Function, initialFocus?: 'first'|'last'}} o
 * @returns {{el: any, close: (value?: any) => void, closed: Promise<any>}}
 */
export function openModal(o) {
  const t = uiText(o.t);
  const doc = globalThis.document;
  const root = o.root ?? doc.body;
  const previous = doc.activeElement;
  const titleId = `c-modal-title-${++counter}`;
  let resolve;
  const closed = new Promise((r) => { resolve = r; });
  let done = false;
  const close = (value) => {
    if (done) return;
    done = true;
    overlay.remove();
    if (previous && typeof previous.focus === 'function') previous.focus();
    resolve(value);
  };
  const actions = (o.actions ?? [{ label: t('ui.close'), value: undefined }]).map((a) =>
    button({ label: a.label, variant: a.variant, onClick: () => close(a.value) }));
  const box = h('div', { class: 'c-modal', role: o.role ?? 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('h2', { class: 'c-modal__title', id: titleId }, o.title),
    h('div', { class: 'c-modal__body' }, o.content),
    h('div', { class: 'c-modal__actions' }, actions));
  const overlay = h('div', { class: 'c-modal__overlay' }, box);
  overlay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); close(undefined); return; }
    if (ev.key !== 'Tab') return;
    const list = focusableWithin(box);
    if (!list.length) { ev.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    const active = doc.activeElement;
    if (ev.shiftKey && (active === first || !box.contains(active))) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && (active === last || !box.contains(active))) { ev.preventDefault(); first.focus(); }
  });
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(undefined); });
  root.appendChild(overlay);
  const list = focusableWithin(box);
  (o.initialFocus === 'last' ? list[list.length - 1] : list[0])?.focus();
  return { el: overlay, close, closed };
}

/** Bestätigungsdialog für zerstörende Aktionen. Löst mit true/false auf; Abbrechen ist vorfokussiert. */
export function confirm(o) {
  const t = uiText(o.t);
  const modal = openModal({
    title: o.title, role: 'alertdialog', root: o.root, t: o.t,
    content: h('p', null, o.message),
    actions: [
      { label: o.cancelLabel ?? t('ui.cancel'), variant: 'alt', value: false },
      { label: o.confirmLabel ?? t('ui.confirm'), variant: o.danger ? 'danger' : 'primary', value: true }
    ],
    initialFocus: 'first'
  });
  return modal.closed.then((value) => value === true);
}

export { confirm as confirmDialog };
