// Werft: Schiffe kaufen. Zeigt Preis, Slots, Skill-Anforderungen und ob du es schon fliegen könntest.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { button } from '../../components/button.js';
import { emptyState } from '../../components/empty-state.js';
import { shipArt } from '../../components/ship-art.js';
import { dockedOnly, liveView, msgLine } from '../live.js';
import { CATEGORY_LABEL, CLASS_LABEL } from '../labels.js';

const FILTERS = [['all', 'Alle'], ['mining', 'Bergbau'], ['combat', 'Kampf'], ['industrial', 'Industrie']];

function shipCard(s, game, ctl) {
  const type = game.data.ships[s.typeId];
  const slots = `H${s.slots.high} M${s.slots.mid} N${s.slots.low} R${s.slots.rig}`;
  const reqs = s.requires.map((r) => h('li', { class: r.ok ? 'v-req v-req--ok' : 'v-req v-req--no' }, `${r.ok ? 'erfüllt' : 'fehlt'}: ${r.name} ${r.level}${r.ok ? '' : ` (du: ${r.have})`}`));
  const afford = s.affordable;
  return card({ title: s.name, subtitle: `${CLASS_LABEL[s.className] ?? s.className} · ${CATEGORY_LABEL[s.category] ?? s.category}`, children: h('div', { class: 'l-stack' },
    h('div', { class: 'v-ship' }, shipArt({ ship: type, size: 120 }), h('div', { class: 'v-facts' },
      h('span', null, `Slots: ${slots}`), s.oreHold ? h('span', null, `Erzhalle: ${fmt(s.oreHold)} m³`) : null,
      h('span', null, `Waffenplätze: ${s.hardpoints.turret} Geschütz, ${s.hardpoints.launcher} Werfer`), h('strong', { class: 'u-isk' }, `${fmt(s.price)} ISK`))),
    s.description ? h('p', { class: 'u-mute' }, s.description) : null,
    h('ul', { class: 'v-reqs' }, ...reqs),
    s.canFly ? h('p', { class: 'v-req v-req--ok' }, 'Du kannst dieses Schiff fliegen.') : h('p', { class: 'u-mute' }, 'Kaufen kannst du es trotzdem. Fliegen kannst du es nach dem Skill-Training.'),
    button({ label: 'Kaufen', variant: 'primary', disabled: !afford, reason: 'Zu wenig ISK', onClick: () => ctl.run('ships/buy', { typeId: s.typeId }) })) });
}

export const view = liveView({
  id: 'shipyard', title: 'Werft', group: 'station', order: 24, enabled: dockedOnly,
  model(game, route, ui) {
    const station = game.data.celestials[game.state.pilot.location.dockedStationId];
    return { yard: Boolean(station?.services?.includes('shipyard')), stationName: station?.name ?? '–', ships: game.select('ships/shop'), cat: ui.cat ?? 'all', isk: game.state.account.isk, msg: ui.msg };
  },
  draw(m, game, route, ctl) {
    if (!m.yard) return emptyState({ icon: 'shipyard', title: 'Keine Werft', text: `${m.stationName} verkauft keine Schiffe. Suche eine Station mit Werft.` });
    const chips = FILTERS.map(([id, label]) => button({ label, variant: 'alt', pressed: m.cat === id, onClick: () => { ctl.ui.cat = id; ctl.repaint(); } }));
    const list = m.ships.filter((s) => m.cat === 'all' || s.category === m.cat);
    return h('div', { class: 'l-stack' },
      card({ title: `Werft ${m.stationName}`, subtitle: 'Gekaufte Schiffe parken in dieser Station. Zum Umsteigen: Hangar → Schiffe.', children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), h('div', { class: 'l-row' }, ...chips)) }),
      h('div', { class: 'l-grid l-grid--wide' }, ...list.map((s) => shipCard(s, game, ctl))));
  }
});
