// Schiffsbild aus dem Generator (Laufzeit, für jede Schiffs-id; unbekannte Klasse = Standardform).

import { h } from '../../util/dom.js';
import { shipTree } from './ship-svg.js';
import { svgToDom } from './svg-tree.js';
import { uiText } from './ui-strings.js';

/** @param {{ship?: object, size?: number, label?: string, t?: Function}} o */
export function shipArt(o = {}) {
  const t = uiText(o.t);
  const ship = o.ship ?? {};
  const name = o.label ?? t('ui.ship.alt', { name: ship.name ?? ship.id ?? '' });
  const svg = svgToDom(shipTree(ship));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', name);
  const width = o.size ?? 120;
  return h('span', { class: 'c-shipart', style: { width: `${width}px` } }, svg);
}
