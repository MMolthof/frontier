// PLATZHALTER (nur Demo, nicht in der Registry): Referenz für das Fitting-Layout.
// Alle Werte sind FESTE MOCK-DATEN. Echte Werte kommen vom Fitting-System über Selektoren.

import { h } from '../../../util/dom.js';
import { card } from '../../components/card.js';
import { resistMatrix } from '../../components/resist-matrix.js';
import { slotRing, updateSlotRing } from '../../components/slot-ring.js';
import { statBar } from '../../components/stat-bar.js';
import { meter } from '../../components/meter.js';

const MOCK = {
  ship: { id: 'ship.pebble', name: 'Pebble', class: 'frigate', hull: 'small' },
  slots: {
    high: [{ id: 'mod.miner_1', label: 'Miner I' }, { id: 'mod.miner_1', label: 'Miner I' }, null],
    mid: [null, null, { id: 'mod.bad', label: 'Zu großes Modul', invalid: true }],
    low: [{ id: 'mod.plate', label: 'Panzerplatte' }],
    rig: [null, null]
  },
  hardpoints: { turret: 2, launcher: 0 },
  stats: { shield_res_em: 0, shield_res_th: 0.2, shield_res_kin: 0.4, shield_res_exp: 0.5, armor_res_em: 0.5, armor_res_th: 0.45, armor_res_kin: 0.25, armor_res_exp: 0.1, structure_res_em: 0, structure_res_th: 0, structure_res_kin: 0, structure_res_exp: 0 }
};

export const view = {
  id: 'fitting',
  title: 'Fitting (Platzhalter)',
  group: 'main',
  order: 30,
  render(root) {
    const picked = h('p', { class: 'u-mute', role: 'status' }, 'Klicke einen Slot (mit der Tastatur: Tab, dann Enter).');
    const ring = slotRing({ ship: MOCK.ship, slots: MOCK.slots, hardpoints: MOCK.hardpoints, onSelect: (type, index) => { picked.textContent = `Slot gewählt: ${type} ${index + 1}`; } });
    root.__ph = { ring };
    root.appendChild(h('div', { class: 'l-grid' },
      card({ title: 'Slots', subtitle: 'Platzhalter mit festen Mock-Daten', children: h('div', { class: 'l-stack' }, ring, picked) }),
      card({ title: 'Werte', subtitle: 'Mock', children: h('div', { class: 'l-stack' },
        statBar({ label: 'Powergrid', value: 36, max: 48, unit: 'MW' }),
        statBar({ label: 'CPU', value: 300, max: 270, unit: 'tf' }),
        statBar({ label: 'Calibration', value: 200, max: 400 }),
        meter({ label: 'Capacitor', value: 240, max: 320, text: '240 / 320' }),
        resistMatrix({ stats: MOCK.stats })) })));
  },
  update(root) { updateSlotRing(root.__ph.ring, {}); }
};
