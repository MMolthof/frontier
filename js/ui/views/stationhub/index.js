// Stations-Hub (wie das Stationsmenü in EVE): Dienste der Station als Kacheln, aktives Schiff, Abdocken.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { icon } from '../../components/icon.js';
import { shipArt } from '../../components/ship-art.js';
import { moduleIcon } from '../../components/module-icon.js';
import { actionButton, dockedOnly, goto, liveView, msgLine } from '../live.js';
import { CLASS_LABEL } from '../labels.js';

const SERVICES = [
  { id: 'hangar', icon: 'hangar', title: 'Hangar', text: 'Erz und Module im Stationslager, Schiffe parken.', route: { viewId: 'hangar', sub: 'items' }, need: 'hangar' },
  { id: 'market', icon: 'market', title: 'Markt', text: 'Erz verkaufen, Module kaufen, Preisverlauf.', route: { viewId: 'market', sub: 'sell' }, need: 'market' },
  { id: 'shipyard', icon: 'shipyard', title: 'Werft', text: 'Neue Schiffe kaufen.', route: { viewId: 'shipyard' }, need: 'shipyard' },
  { id: 'industry', icon: 'industry', title: 'Raffinerie', text: 'Erz zu Mineralien verarbeiten.', route: { viewId: 'industry', sub: 'refinery' }, need: 'refinery' },
  { id: 'fitting', icon: 'fitting', title: 'Fitting', text: 'Module ein- und ausbauen.', route: { viewId: 'fitting' }, need: null },
  { id: 'skills', icon: 'skills', title: 'Skills', text: 'Fähigkeiten trainieren.', route: { viewId: 'skills', sub: 'training' }, need: null },
  { id: 'missions', icon: 'missions', title: 'Missionen', text: 'Aufträge der Agenten. Folgt in Iteration 3.', route: null, need: 'missions' }
];

export const view = liveView({
  id: 'stationhub', title: 'Station', group: 'station', order: 19, enabled: dockedOnly,
  model(game, route, ui) {
    const st = game.state;
    const stationId = st.pilot.location.dockedStationId;
    const cel = game.data.celestials[stationId];
    const sys = game.data.systems[st.pilot.location.systemId];
    const ship = st.assets.ships.find((s) => s.uid === st.pilot.activeShipUid);
    const type = game.data.ships[ship?.typeId] ?? {};
    return {
      name: cel?.name ?? '–', system: sys?.name ?? '–', security: sys?.security ?? 0, services: cel?.services ?? [], isk: st.account.isk,
      ship: { name: ship?.name ?? '–', type: { ...type, name: ship?.name }, className: CLASS_LABEL[type.class] ?? type.class ?? '', modules: Object.values(ship?.fitting ?? {}).flat().filter(Boolean).map((id) => ({ id, name: game.data.modules[id]?.name ?? id, category: game.data.modules[id]?.category })) },
      hold: Object.values(ship?.oreHold ?? {}).reduce((a, b) => a + b, 0), msg: ui.msg
    };
  },
  draw(m, game, route, ctl) {
    const tiles = SERVICES.filter((s) => s.id === 'missions' || !s.need || m.services.includes(s.need)).map((s) => {
      const off = !s.route;
      const el = h('button', { type: 'button', class: `v-tile${off ? ' v-tile--off' : ''}`, 'aria-disabled': off ? 'true' : null },
        h('span', { class: 'v-tile__icon' }, icon(s.icon, { size: 28 })), h('strong', null, s.title), h('span', { class: 'u-mute' }, s.text));
      if (!off) el.addEventListener('click', () => goto(s.route));
      return el;
    });
    return h('div', { class: 'l-stack' },
      card({ title: m.name, subtitle: `${m.system} · Sicherheit ${fmt(m.security, 1)} · Du bist angedockt und in Sicherheit.`, children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg),
        h('div', { class: 'l-row' }, actionButton({ label: 'Abdocken', icon: 'undock', variant: 'primary', run: ctl.run, type: 'travel/undock' }), h('span', { class: 'u-mute' }, 'Im All kannst du warpen und Erz abbauen.'))) }),
      h('div', { class: 'v-tiles' }, ...tiles),
      card({ title: 'Aktives Schiff', children: h('div', { class: 'v-ship' }, shipArt({ ship: m.ship.type, size: 130 }), h('div', { class: 'v-facts' },
        h('strong', null, m.ship.name), h('span', { class: 'u-mute' }, m.ship.className), h('span', null, `Erz an Bord: ${fmt(m.hold)} Einheiten`),
        h('span', { class: 'v-modrow' }, ...m.ship.modules.map((x) => h('span', { class: 'v-modchip', title: x.name }, moduleIcon(x.category, { size: 18 }), x.name))))) }));
  }
});
