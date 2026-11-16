// Hangar: Schiffsfracht und Stationslager (Items) sowie die Schiffsliste.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { table } from '../../components/table.js';
import { emptyState } from '../../components/empty-state.js';
import { shipArt } from '../../components/ship-art.js';
import { oreIcon } from '../../components/ore-icon.js';
import { actionButton, dockedOnly, goto, liveView, msgLine } from '../live.js';
import { CLASS_LABEL } from '../labels.js';

const KIND = { ore: 'Erz', mineral: 'Mineral', module: 'Modul', item: 'Item', loot: 'Beute', skillbook: 'Skillbuch', ammo: 'Munition' };
const icon = (r) => (r.kind === 'ore' ? oreIcon({ id: r.itemId ?? r.oreId, name: r.name }) : null);

function itemsTab(m, ctl) {
  const ship = card({ title: `Schiffsfracht (${m.shipName})`, subtitle: 'Erzhalle des aktiven Schiffs', children: m.hold.rows.length ? table({ caption: 'Schiffsfracht', rows: m.hold.rows, rowKey: (r) => r.oreId, columns: [
    { key: 'name', label: 'Erz', render: (r) => h('span', { class: 'l-row' }, oreIcon({ id: r.oreId, name: r.name }), r.name) },
    { key: 'units', label: 'Einheiten', align: 'right', render: (r) => fmt(r.units) },
    { key: 'act', label: '', render: (r) => actionButton({ label: 'Ins Lager', variant: 'alt', run: ctl.run, type: 'inv/unload', payload: { oreId: r.oreId } }) }] })
    : emptyState({ icon: 'ore', title: 'Keine Ladung', text: 'Baue Erz ab und kehre zur Station zurück.' }) });
  const stock = card({ title: `Stationslager: ${m.stationName}`, subtitle: 'Sicher gelagert, nur in dieser Station zugänglich.', children: m.stock.length ? table({ caption: 'Stationslager', rows: m.stock, rowKey: (r) => r.itemId, columns: [
    { key: 'name', label: 'Item', render: (r) => h('span', { class: 'l-row' }, icon(r), r.name) },
    { key: 'kind', label: 'Art', render: (r) => KIND[r.kind] ?? r.kind },
    { key: 'qty', label: 'Menge', align: 'right', render: (r) => fmt(r.qty) },
    { key: 'act', label: '', render: (r) => (r.kind === 'ore' ? actionButton({ label: 'Ins Schiff', variant: 'alt', run: ctl.run, type: 'inv/load', payload: { oreId: r.itemId } }) : null) }] })
    : emptyState({ icon: 'hangar', title: 'Lager leer' }) });
  const all = card({ title: 'Alle Lagerorte', children: m.locs.length ? h('ul', { class: 'v-list' }, m.locs.map((l) => h('li', null, h('strong', null, l.name), h('span', { class: 'u-mute' }, ` – ${l.items} Einträge`)))) : h('p', { class: 'u-mute' }, 'Noch nichts eingelagert.') });
  return h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), h('div', { class: 'l-grid l-grid--wide' }, ship, stock),
    h('div', { class: 'l-row' }, actionButton({ label: 'Alles entladen', icon: 'hangar', variant: 'primary', run: ctl.run, type: 'inv/unloadAll', disabled: !m.hold.rows.length, reason: 'Nichts zu entladen' })), all);
}

function shipsTab(m, ctl) {
  return h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), h('div', { class: 'l-grid' }, ...m.ships.map((s) => card({ title: s.name, subtitle: `${CLASS_LABEL[s.className] ?? s.className} · ${s.stationName}`, children: h('div', { class: 'l-stack' },
    h('div', { class: 'v-ship' }, shipArt({ ship: s.type, size: 110 }), h('div', { class: 'v-facts' },
      h('span', null, `Module: ${s.fitted}/${s.slots}`), h('span', null, `Erzhalle: ${fmt(s.oreHold)} m³`), s.active ? h('strong', null, 'Aktives Schiff') : null,
      !s.canFly ? h('span', { class: 'v-req v-req--no' }, `Skills fehlen: ${s.missing.map((x) => `${x.name} ${x.level}`).join(', ')}`) : null)),
    h('div', { class: 'l-row' },
      s.active ? null : actionButton({ label: 'Einsteigen', variant: 'primary', run: ctl.run, type: 'ships/board', payload: { uid: s.uid }, disabled: !s.here || !s.canFly, reason: !s.here ? 'Parkt in einer anderen Station' : 'Skills fehlen' }),
      actionButton({ label: 'Fitting', variant: 'alt', run: () => goto({ viewId: 'fitting' }) }),
      s.active || !s.sellValue ? null : actionButton({ label: `Verkaufen (${fmt(s.sellValue)} ISK)`, variant: 'ghost', run: ctl.run, type: 'ships/sell', payload: { uid: s.uid }, disabled: !s.here, reason: 'Nur in der Station, in der es parkt' }))) }))));
}

export const view = liveView({
  id: 'hangar', title: 'Hangar', group: 'station', order: 20, enabled: dockedOnly,
  subs: [{ id: 'items', labelKey: 'shell.nav.hangar.items' }, { id: 'ships', labelKey: 'shell.nav.hangar.ships' }],
  model(game, route, ui) {
    const st = game.state;
    const stationId = st.pilot.location.dockedStationId;
    return {
      sub: route.sub ?? 'items', stationName: game.data.celestials[stationId]?.name ?? '–', hold: game.select('mining/hold'), stock: game.select('inv/stock'), locs: game.select('inv/locations'),
      shipName: st.assets.ships.find((s) => s.uid === st.pilot.activeShipUid)?.name ?? '–',
      ships: game.select('ships/list').map((s) => { const type = game.data.ships[s.typeId] ?? {}; return { ...s, type: { ...type, name: s.name }, oreHold: type.attributes?.ore_hold ?? 0 }; }), msg: ui.msg
    };
  },
  draw: (m, game, route, ctl) => (m.sub === 'ships' ? shipsTab(m, ctl) : itemsTab(m, ctl))
});
