// Markt: Verkaufen (mit Preisvorschau und Slippage), Kaufen (folgt) und Preisverlauf.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { meter } from '../../components/meter.js';
import { sparkline } from '../../components/sparkline.js';
import { emptyState } from '../../components/empty-state.js';
import { oreIcon } from '../../components/ore-icon.js';
import { actionButton, dockedOnly, liveView, msgLine } from '../live.js';

const qtyOf = (ui, row) => {
  const v = Math.floor(Number(ui.qty[row.itemId]));
  return Math.min(row.stock, v > 0 ? v : row.stock);
};
const preview = (game, row, q) => {
  if (!q) return 'Nichts im Lager.';
  const r = game.select('market/quote', { itemId: row.itemId, qty: q });
  return r ? `${fmt(q)} Stück ≈ ${fmt(r.net)} ISK (Ø ${fmt(r.avg, 1)}), Preis danach ${fmt(r.priceAfter, 1)}` : '';
};

function sellTab(m, game, ctl) {
  const rows = m.rows.map((r) => {
    const q = qtyOf(ctl.ui, r);
    const input = h('input', { type: 'number', min: '1', class: 'v-qty', placeholder: 'Alle', value: ctl.ui.qty[r.itemId] ?? '', 'aria-label': `Menge ${r.name}` });
    const pv = h('span', { class: 'u-mute v-preview' }, preview(game, r, q));
    input.addEventListener('input', () => { ctl.ui.qty[r.itemId] = input.value; pv.textContent = preview(game, r, qtyOf(ctl.ui, r)); });
    return h('li', { class: 'v-trade' },
      h('div', { class: 'v-trade__name' }, h('span', { class: 'l-row' }, r.kind === 'ore' ? oreIcon({ id: r.itemId, name: r.name }) : null, h('strong', null, r.name)),
        h('span', { class: 'u-mute' }, `${fmt(r.price, 1)} ISK`), meter({ label: `Nachfrage ${r.name}`, value: r.demand, max: 1.6, text: `Nachfrage ${fmt(r.demand * 100)} %`, tone: r.demand < 0.7 ? 'warn' : 'default' })),
      h('div', { class: 'v-trade__stock u-num' }, `Lager: ${fmt(r.stock)}`),
      h('div', { class: 'l-row' }, input, actionButton({ label: 'Verkaufen', variant: 'primary', run: (type, payload) => { const res = ctl.run(type, payload); if (res.ok) ctl.ui.qty[r.itemId] = ''; return res; }, type: 'market/sell', payload: { itemId: r.itemId, qty: q }, disabled: !r.stock, reason: 'Nichts im Lager' })),
      pv);
  });
  return card({ title: `Verkaufen in ${m.stationName}`, subtitle: `Jeder Verkauf drückt den Preis, er erholt sich mit der Zeit. Gebühr ${fmt(m.fee * 100)} %.`, children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg),
    rows.length ? h('ul', { class: 'v-trades' }, rows) : emptyState({ icon: 'market', title: 'Kein Markt', text: 'Diese Station hat keinen Markt.' })) });
}

function historyTab(m) {
  return card({ title: 'Preisverlauf', subtitle: 'Letzte Ticks pro Ware in dieser Station.', children: m.rows.length ? h('ul', { class: 'v-trades' }, m.rows.map((r) => h('li', { class: 'v-hist' },
    h('div', null, h('strong', null, r.name), h('span', { class: 'u-mute' }, r.history.length > 1 ? ` · ${fmt(Math.min(...r.history), 1)} bis ${fmt(Math.max(...r.history), 1)} ISK` : '')),
    sparkline({ values: r.history, width: 260, height: 40, label: `Preisverlauf ${r.name}` })))) : emptyState({ title: 'Keine Daten' }) });
}

export const view = liveView({
  id: 'market', title: 'Markt', group: 'station', order: 21, enabled: dockedOnly,
  subs: [{ id: 'sell', labelKey: 'shell.nav.market.sell' }, { id: 'buy', labelKey: 'shell.nav.market.buy' }, { id: 'history', labelKey: 'shell.nav.market.history' }],
  model: (game, route, ui) => {
    const rows = game.select('market/rows').map((r) => ({ ...r, history: route.sub === 'history' ? r.history : [] }));
    return { sub: route.sub ?? 'sell', rows, fee: game.select('market/fee'), stationName: game.data.celestials[game.state.pilot.location.dockedStationId]?.name ?? '–', qty: ui.qty, msg: ui.msg };
  },
  draw: (m, game, route, ctl) => (m.sub === 'history' ? historyTab(m) : m.sub === 'buy'
    ? emptyState({ icon: 'market', title: 'Kaufen folgt', text: 'In Iteration 2 kommen Schiffe und Module zum Kauf dazu.' }) : sellTab(m, game, ctl))
});
