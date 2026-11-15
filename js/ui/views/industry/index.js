// Industrie: Raffinerie (Erz → Mineralien). Produktion folgt in einer späteren Iteration.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { emptyState } from '../../components/empty-state.js';
import { oreIcon } from '../../components/ore-icon.js';
import { actionButton, dockedOnly, liveView, msgLine } from '../live.js';

function refineryTab(m, ctl) {
  const ores = m.ores.map((o) => h('li', { class: 'v-trade' },
    h('div', { class: 'v-trade__name' }, h('span', { class: 'l-row' }, oreIcon({ id: o.id, name: o.name }), h('strong', null, o.name)), h('span', { class: 'u-mute' }, `Ausbeute ${fmt(o.efficiency * 100)} %`)),
    h('div', { class: 'v-trade__stock u-num' }, `Lager: ${fmt(o.stock)}`),
    h('div', { class: 'u-mute' }, o.batches > 0 ? `${fmt(o.batches)} Durchläufe → ${Object.entries(o.outputs).map(([id, n]) => `${fmt(n)} ${m.names[id] ?? id}`).join(', ')}` : `Mindestens ${fmt(o.batchSize)} Einheiten nötig.`),
    actionButton({ label: 'Raffinieren', variant: 'primary', run: ctl.run, type: 'refine/run', payload: { oreId: o.id }, disabled: o.batches <= 0, reason: `Mindestens ${o.batchSize} Einheiten` })));
  return h('div', { class: 'l-stack' },
    card({ title: `Raffinerie ${m.stationName}`, subtitle: 'Verarbeitet Erz aus dem Stationslager zu Mineralien. Skills erhöhen die Ausbeute.', children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg),
      ores.length ? h('ul', { class: 'v-trades' }, ores) : emptyState({ icon: 'ore', title: 'Kein Erz im Lager', text: 'Baue Erz ab und entlade es im Hangar.' })) }),
    card({ title: 'Mineralien im Lager', children: m.minerals.length ? h('ul', { class: 'v-list' }, m.minerals.map((x) => h('li', null, h('strong', null, x.name), h('span', { class: 'u-num' }, ` ${fmt(x.qty)}`)))) : h('p', { class: 'u-mute' }, 'Noch keine Mineralien.') }));
}

export const view = liveView({
  id: 'industry', title: 'Industrie', group: 'station', order: 23, enabled: dockedOnly,
  subs: [{ id: 'refinery', labelKey: 'shell.nav.industry.refinery' }, { id: 'production', labelKey: 'shell.nav.industry.production' }],
  model(game, route, ui) {
    const stock = game.select('inv/stock');
    const names = Object.fromEntries(Object.values(game.data.items).map((i) => [i.id, i.name]));
    const ores = stock.filter((r) => r.kind === 'ore').map((r) => {
      const p = game.select('refine/preview', { oreId: r.itemId });
      return { id: r.itemId, name: r.name, stock: r.qty, efficiency: p.efficiency, batches: p.batches, batchSize: p.batchSize, outputs: p.outputs };
    });
    return { sub: route.sub ?? 'refinery', ores, names, minerals: stock.filter((r) => r.kind === 'mineral'), stationName: game.data.celestials[game.state.pilot.location.dockedStationId]?.name ?? '–', msg: ui.msg };
  },
  draw: (m, game, route, ctl) => (m.sub === 'production' ? emptyState({ icon: 'industry', title: 'Produktion folgt', text: 'Blaupausen und Herstellung kommen in einer späteren Iteration.' }) : refineryTab(m, ctl))
});
