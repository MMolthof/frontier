// PLATZHALTER (nur Demo, nicht in der Registry): Referenz für eine Listen-Ansicht.
// Zeigt: Tabelle in place aktualisieren, route.sub auswerten, Aktionen nur per dispatch und nach hasAction.

import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { button, updateButton } from '../../components/button.js';
import { card } from '../../components/card.js';
import { icon } from '../../components/icon.js';
import { table, updateTable } from '../../components/table.js';
import { createT } from '../translate.js';

const TYPE_ICON = { station: 'station', planet: 'planet', moon: 'moon', belt: 'belt', gate: 'gate', star: 'star' };

function rowsOf(game) {
  return Object.values(game.data.celestials ?? {}).map((c) => ({ id: c.id, name: c.name, type: c.type, au: c.au ?? 0 }));
}

export const view = {
  id: 'system',
  title: 'Sonnensystem (Platzhalter)',
  group: 'main',
  order: 10,
  render(root, game, route) {
    const t = createT(game);
    const refs = { t, selected: null };
    refs.hint = h('p', { class: 'u-mute' }, 'Platzhalter-Ansicht: zeigt, wie eine Liste mit Aktionen gebaut wird. Auswahl per Klick oder Enter.');
    refs.sub = h('p', { class: 'u-mute u-num' });
    refs.table = table({
      caption: 'Himmelskörper im System', rowKey: (r) => r.id, rows: rowsOf(game), emptyText: 'Keine Himmelskörper bekannt.',
      onRowClick: (row) => { refs.selected = row; updateActions(); },
      columns: [
        { key: 'type', label: 'Typ', sortable: true, render: (r) => h('span', { class: 'l-row' }, icon(TYPE_ICON[r.type] ?? 'info'), r.type) },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'au', label: 'Distanz (AU)', align: 'right', sortable: true, render: (r) => fmt(r.au, 1) }
      ]
    });
    refs.warp = button({ label: 'Warpen', icon: 'warp', onClick: () => { const res = game.dispatch('travel/warp', { celestialId: refs.selected.id }); if (!res.ok) refs.msg.textContent = res.message; } });
    refs.dock = button({ label: 'Docken', icon: 'dock', variant: 'alt', onClick: () => game.dispatch('travel/dock', { stationId: refs.selected.id }) });
    refs.undock = button({ label: 'Ausdocken', icon: 'undock', variant: 'alt', onClick: () => game.dispatch('travel/undock') });
    refs.msg = h('p', { class: 'u-bad', role: 'status' });
    function updateActions() {
      const none = !refs.selected;
      const noSel = 'Erst eine Zeile wählen.';
      const missing = 'Diese Aktion ist noch nicht verfügbar.';
      const docked = Boolean(game.state.pilot.location.dockedStationId);
      updateButton(refs.warp, { disabled: none || !game.hasAction('travel/warp') || docked, reason: none ? noSel : !game.hasAction('travel/warp') ? missing : 'Im Hangar nicht möglich.' });
      updateButton(refs.dock, { disabled: none || !game.hasAction('travel/dock') || refs.selected?.type !== 'station' || docked, reason: none ? noSel : refs.selected?.type !== 'station' ? 'Nur an Stationen.' : missing });
      updateButton(refs.undock, { disabled: !docked || !game.hasAction('travel/undock'), reason: docked ? missing : 'Du bist nicht angedockt.' });
    }
    refs.updateActions = updateActions;
    root.__ph = refs;
    root.appendChild(h('div', { class: 'l-stack' }, card({ title: 'Überblick', subtitle: 'Platzhalter', children: h('div', { class: 'l-stack' }, refs.hint, refs.sub, h('div', { class: 'l-row' }, refs.warp, refs.dock, refs.undock), refs.msg, refs.table) })));
    this.update(root, game, route);
  },
  update(root, game, route) {
    const refs = root.__ph;
    refs.sub.textContent = `Unterseite: ${route?.sub ?? 'overview'}`;
    updateTable(refs.table, { rows: rowsOf(game) });
    refs.updateActions();
  }
};
