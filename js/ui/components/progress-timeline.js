// Horizontale Segmente (z. B. Skill-Queue) mit Beschriftung und Rest-Ticks.

import { h, setText } from '../../util/dom.js';
import { fmtTicks } from '../../util/format.js';

const parts = new WeakMap();

/** @param {{segments: {id: string, label: string, ticks: number, active?: boolean}[], label?: string, tickSeconds?: number}} o */
export function progressTimeline(o) {
  const el = h('ol', { class: 'c-timeline' });
  parts.set(el, { items: new Map() });
  return updateProgressTimeline(el, o);
}

export function updateProgressTimeline(el, o) {
  const { items } = parts.get(el);
  if (o.label) el.setAttribute('aria-label', o.label);
  const total = Math.max(1, o.segments.reduce((acc, s) => acc + Math.max(0, s.ticks), 0));
  const seen = new Set();
  o.segments.forEach((seg, index) => {
    seen.add(seg.id);
    let item = items.get(seg.id);
    if (!item) {
      const name = h('span', { class: 'c-timeline__name' });
      const time = h('span', { class: 'c-timeline__time u-mute u-num' });
      item = { li: h('li', { class: 'c-timeline__seg' }, h('span', { class: 'c-timeline__bar' }), name, time), name, time };
      items.set(seg.id, item);
    }
    setText(item.name, seg.label);
    setText(item.time, fmtTicks(seg.ticks, o.tickSeconds));
    item.li.setAttribute('class', `c-timeline__seg${seg.active ? ' c-timeline__seg--active' : ''}`);
    const flex = String(Math.max(0.1, seg.ticks / total));
    if (item.li.style.flexGrow !== flex) item.li.style.flexGrow = flex;
    if (el.children[index] !== item.li) el.insertBefore(item.li, el.children[index] ?? null);
  });
  for (const [id, item] of items) if (!seen.has(id)) { item.li.remove(); items.delete(id); }
  return el;
}
