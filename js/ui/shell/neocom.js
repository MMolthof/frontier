// Neocom-DOM: baut aus dem Menümodell Buttons mit Roving-Tabindex und Tastatursteuerung.
// Einmal pro Update wird das Menü berechnet; nur bei geänderter Struktur/Zuständen wird neu aufgebaut.

import { h } from '../../util/dom.js';
import { icon } from '../components/icon.js';
import { tooltip } from '../components/tooltip.js';
import { buildMenu, activeTabs } from './menu.js';

/** @param {{model: object[], views: object[], game: object, t: Function, navigate: (hash: string) => void}} o */
export function createNeocom({ model, views, game, t, navigate }) {
  const expanded = new Set();
  const list = h('ul', { class: 's-neo__list' });
  const el = h('nav', { class: 's-neo', 'aria-label': t('shell.nav.label') }, list);
  let signature = '';
  let menu = [];
  let flat = [];
  let focusId = null; // Roving-Ziel
  const buttons = new Map();

  function flatten() {
    flat = [];
    for (const item of menu) {
      flat.push({ item, level: 1 });
      if (item.children && item.expanded) item.children.forEach((c) => {
        flat.push({ item: c, level: 2 });
        c.subs.forEach((s) => flat.push({ item: { ...s, id: `${c.id}#${s.id}`, sub: s.id, viewId: c.viewId, enabled: true, active: s.active, reason: null, children: null, isSub: true }, level: 3 }));
      });
      if (!item.children) item.subs.forEach((s) => flat.push({ item: { ...s, id: `${item.id}#${s.id}`, enabled: true, active: s.active, reason: null, children: null, isSub: true }, level: 2 }));
    }
  }

  function activate(item) {
    if (item.children) {
      if (expanded.has(item.id)) expanded.delete(item.id); else expanded.add(item.id);
      rebuild(currentRoute, true);
      return;
    }
    if (!item.enabled) return;
    navigate(item.hash);
  }

  function makeButton({ item, level }) {
    const isGroup = Boolean(item.children);
    const btn = h('button', {
      type: 'button', class: `s-neo__btn s-neo__btn--level${level}`, 'data-id': item.id,
      'aria-current': item.active && !isGroup ? 'page' : null,
      'aria-expanded': isGroup ? String(Boolean(item.expanded)) : null,
      'aria-disabled': !item.enabled ? 'true' : null,
      tabindex: item.id === focusId ? '0' : '-1'
    },
    item.icon ? icon(item.icon) : null,
    h('span', { class: 's-neo__label' }, item.label),
    !item.enabled && item.reason ? h('span', { class: 's-neo__reason u-mute' }, item.reason) : null,
    isGroup ? icon('chevron', { size: 12 }) : null);
    if (isGroup) btn.children[btn.children.length - 1].setAttribute('class', 'c-icon s-neo__chev');
    btn.addEventListener('click', () => activate(item));
    btn.addEventListener('focus', () => { focusId = item.id; });
    btn.addEventListener('keydown', (ev) => onKey(ev, item));
    buttons.set(item.id, btn);
    const tip = !item.enabled && item.reason ? item.reason : item.label;
    return h('li', { class: 's-neo__li' }, tooltip(btn, tip));
  }

  function onKey(ev, item) {
    const i = flat.findIndex((f) => f.item.id === item.id);
    const go = (target) => { if (!target) return; ev.preventDefault(); focusId = target.item.id; buttons.get(target.item.id)?.focus(); applyRoving(); };
    if (ev.key === 'ArrowDown') go(flat[(i + 1) % flat.length]);
    else if (ev.key === 'ArrowUp') go(flat[(i - 1 + flat.length) % flat.length]);
    else if (ev.key === 'Home') go(flat[0]);
    else if (ev.key === 'End') go(flat[flat.length - 1]);
    else if (ev.key === 'ArrowRight' && item.children && !item.expanded) { ev.preventDefault(); activate(item); }
    else if (ev.key === 'ArrowLeft' && item.children && item.expanded) { ev.preventDefault(); activate(item); }
  }

  function applyRoving() {
    for (const [id, btn] of buttons) btn.setAttribute('tabindex', id === focusId ? '0' : '-1');
  }

  let currentRoute = { viewId: 'overview', sub: null };

  function rebuild(route, force = false) {
    currentRoute = route;
    const next = buildMenu(model, views, game, { t, route, expanded });
    const nextSig = JSON.stringify(next);
    if (!force && nextSig === signature) return false;
    const hadFocus = el.ownerDocument.activeElement && el.contains(el.ownerDocument.activeElement);
    signature = nextSig;
    menu = next;
    flatten();
    if (!flat.some((f) => f.item.id === focusId)) focusId = (flat.find((f) => f.item.active) ?? flat[0])?.item.id ?? null;
    buttons.clear();
    list.replaceChildren();
    flat.forEach((f) => list.appendChild(makeButton(f)));
    if (hadFocus) buttons.get(focusId)?.focus();
    return true;
  }

  return {
    el,
    /** Berechnet das Menü neu; gibt die Tab-Daten für die schmale Ansicht zurück. */
    update(route) { rebuild(route); return activeTabs(menu); },
    get menu() { return menu; },
    get flat() { return flat; }
  };
}
