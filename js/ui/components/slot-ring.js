// Slot-Ring: High oben, Mid rechts, Rig unten, Low links; Silhouette in der Mitte.
// Geometrie ist rein berechnet (slotRingGeometry) und ohne Überlappung für 0-8 Slots je Typ.

import { h } from '../../util/dom.js';
import { shipArt } from './ship-art.js';
import { uiText } from './ui-strings.js';

const ORDER = ['high', 'mid', 'rig', 'low'];
const CENTER_ANGLE = { high: -90, mid: 0, rig: 90, low: 180 };
const SIZES = [40, 36, 32, 28, 24, 20, 16, 12];
const GAP_PX = 4;
const RADIUS = 120;
const deg = (rad) => (rad * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

function stepFor(size, radius) { return deg(2 * Math.asin(Math.min(1, (size + GAP_PX) / (2 * radius)))); }

/** @returns {{size: number, radius: number, box: number, slots: {type: string, index: number, angle: number, x: number, y: number, size: number}[]}} Koordinaten relativ zur Mitte */
export function slotRingGeometry(counts = {}, { radius = RADIUS } = {}) {
  const n = Object.fromEntries(ORDER.map((type) => [type, Math.max(0, Math.min(8, counts[type] ?? 0))]));
  const size = SIZES.find((s) => {
    const step = stepFor(s, radius);
    return ORDER.every((type) => n[type] === 0 || (n[type] - 1) * step + step <= 90);
  }) ?? 12;
  const step = stepFor(size, radius);
  const slots = [];
  for (const type of ORDER) {
    for (let i = 0; i < n[type]; i++) {
      const angle = CENTER_ANGLE[type] + (i - (n[type] - 1) / 2) * step;
      slots.push({ type, index: i, angle: Math.round(angle * 10) / 10, x: Math.round(radius * Math.cos(rad(angle)) * 10) / 10, y: Math.round(radius * Math.sin(rad(angle)) * 10) / 10, size });
    }
  }
  return { size, radius, box: 2 * radius + size + 8, slots };
}

export const slotRingLayout = (counts, options) => slotRingGeometry(counts, options).slots;

const parts = new WeakMap();

function slotLabel(t, type, index, item) {
  const base = `${t(`ui.slot.${type}`)} ${index + 1}`;
  if (!item) return `${base}, ${t('ui.slot.empty')}`;
  return `${base}, ${item.invalid ? `${t('ui.slot.invalid')}: ` : `${t('ui.slot.filled')}: `}${item.label ?? item.id}`;
}

/**
 * @param {{slots: Record<string, ({id?: string, label?: string, invalid?: boolean}|null)[]>, ship?: object,
 *   hardpoints?: {turret: number, launcher: number}, onSelect?: (type: string, index: number) => void, readOnly?: boolean, t?: Function}} o
 * Ändert sich die Slotanzahl, baut updateSlotRing den Ring neu auf (selten: Schiffswechsel).
 */
export function slotRing(o) {
  const el = h('div', { class: 'c-slotring', role: 'group' });
  parts.set(el, { o, key: null, buttons: new Map() });
  return updateSlotRing(el, o);
}

export function updateSlotRing(el, patch) {
  const state = parts.get(el);
  Object.assign(state.o, patch);
  const o = state.o;
  const t = uiText(o.t);
  const counts = Object.fromEntries(ORDER.map((type) => [type, (o.slots?.[type] ?? []).length]));
  const key = JSON.stringify(counts);
  if (key !== state.key) {
    state.key = key;
    state.buttons.clear();
    const geo = slotRingGeometry(counts);
    el.replaceChildren();
    el.style.width = `${geo.box}px`;
    el.style.height = `${geo.box}px`;
    el.appendChild(h('div', { class: 'c-slotring__center' }, shipArt({ ship: o.ship, size: 120, t: o.t }), h('p', { class: 'c-slotring__hp u-mute' })));
    state.hp = el.children[0].children[1];
    for (const s of geo.slots) {
      const btn = h('button', { type: 'button', class: `c-slot c-slot--${s.type}`, style: { width: `${s.size}px`, height: `${s.size}px`, left: `${geo.box / 2 + s.x - s.size / 2}px`, top: `${geo.box / 2 + s.y - s.size / 2}px` } });
      btn.addEventListener('click', () => { if (!state.o.readOnly) state.o.onSelect?.(s.type, s.index); });
      state.buttons.set(`${s.type}:${s.index}`, btn);
      el.appendChild(btn);
    }
  }
  for (const [id, btn] of state.buttons) {
    const [type, index] = id.split(':');
    const item = o.slots?.[type]?.[Number(index)] ?? null;
    const cls = `c-slot c-slot--${type}${item ? ' c-slot--filled' : ''}${item?.invalid ? ' c-slot--invalid' : ''}`;
    if (btn.getAttribute('class') !== cls) btn.setAttribute('class', cls);
    const label = slotLabel(t, type, Number(index), item);
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
    if (o.readOnly) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
  }
  if (o.hardpoints && state.hp) {
    const text = t('ui.hardpoints', { turret: o.hardpoints.turret, launcher: o.hardpoints.launcher });
    if (state.hp.textContent !== text) state.hp.textContent = text;
  }
  el.setAttribute('aria-label', o.ship?.name ?? '');
  return el;
}
