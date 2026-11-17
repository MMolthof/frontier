// Schiffs-Anzeige im EVE-Stil: drei Ringe (Schild außen, Panzerung, Struktur) und innen die Capacitor-Anzeige. Werte 0–1.
import { h } from '../../util/dom.js';

const RINGS = [['shield', 52], ['armor', 44], ['structure', 36], ['cap', 27]];

export function shipGauge() {
  const rings = {};
  const children = [];
  for (const [name, r] of RINGS) {
    children.push(h('circle', { cx: 60, cy: 60, r, class: 'c-gauge__track' }));
    const arc = h('circle', { cx: 60, cy: 60, r, class: `c-gauge__arc c-gauge__${name}`, pathLength: '100', 'stroke-dasharray': '100 100', transform: 'rotate(-90 60 60)' });
    rings[name] = arc;
    children.push(arc);
  }
  const el = h('svg', { viewBox: '0 0 120 120', class: 'c-gauge', role: 'img', 'aria-label': 'Schild, Panzerung, Struktur und Capacitor' }, ...children);
  return {
    el,
    /** @param {{shield: number, armor: number, structure: number, cap: number}} v */
    update(v) {
      for (const [name] of RINGS) {
        const pct = Math.max(0, Math.min(1, Number.isFinite(v[name]) ? v[name] : 0)) * 100;
        const text = `${pct.toFixed(1)} 100`;
        if (rings[name].getAttribute('stroke-dasharray') !== text) rings[name].setAttribute('stroke-dasharray', text);
      }
    }
  };
}
