// Markt: Verkaufen (Erz, Mineralien, Module, Items mit Preisvorschau), Kaufen (Module, Rohstoffe, Munition) und Preisverlauf.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { meter } from '../../components/meter.js';
import { sparkline } from '../../components/sparkline.js';
import { emptyState } from '../../components/empty-state.js';
import { oreIcon } from '../../components/ore-icon.js';
import { moduleIcon } from '../../components/module-icon.js';
import { button } from '../../components/button.js';
import { MODCAT_LABEL, SIZE_LABEL, SLOT_LABEL } from '../labels.js';
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
const rowIcon = (r) => (r.kind === 'ore' ? oreIcon({ id: r.itemId, name: r.name }) : r.kind === 'module' ? moduleIcon(r.category ?? 'other', { size: 20 }) : null);

function tradeRow(r, game, ctl) {
  const q = qtyOf(ctl.ui, r);
  const input = h('input', { type: 'number', min: '1', class: 'v-qty', placeholder: 'Alle', value: ctl.ui.qty[r.itemId] ?? '', 'aria-label': `Menge ${r.name}` });
  const pv = h('span', { class: 'u-mute v-preview' }, preview(game, r, q));
  input.addEventListener('input', () => { ctl.ui.qty[r.itemId] = input.value; pv.textContent = preview(game, r, qtyOf(ctl.ui, r)); });
  return h('li', { class: 'v-trade' },
    h('div', { class: 'v-trade__name' }, h('span', { class: 'l-row' }, rowIcon(r), h('strong', null, r.name)),
      h('span', { class: 'u-mute' }, `${fmt(r.price, 1)} ISK${r.fixed ? ' (fester Rückkaufpreis)' : ''}`),
      r.fixed ? null : meter({ label: `Nachfrage ${r.name}`, value: r.demand, max: 1.6, text: `Nachfrage ${fmt(r.demand * 100)} %`, tone: r.demand < 0.7 ? 'warn' : 'default' })),
    h('div', { class: 'v-trade__stock u-num' }, `Lager: ${fmt(r.stock)}`),
    h('div', { class: 'l-row' }, input, actionButton({ label: 'Verkaufen', variant: 'primary', run: (type, payload) => { const res = ctl.run(type, payload); if (res.ok) ctl.ui.qty[r.itemId] = ''; return res; }, type: 'market/sell', payload: { itemId: r.itemId, qty: q }, disabled: !r.stock, reason: 'Nichts im Lager' })),
    pv);
}

function sellTab(m, game, ctl) {
  const section = (title, list) => (list.length ? [h('h3', { class: 'v-sec' }, title), h('ul', { class: 'v-trades' }, ...list.map((r) => tradeRow(r, game, ctl)))] : []);
  const body = [...section('Erz und Mineralien', m.rows), ...section('Module und Items', m.fixed)];
  return card({ title: `Verkaufen in ${m.stationName}`, subtitle: `Erz und Mineralien: der Preis sinkt mit jeder Menge und erholt sich. Module und Items: fester Rückkaufpreis. Gebühr ${fmt(m.fee * 100)} %. Zivilier-Module und Skillbücher haben keinen Handelswert.`,
    children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), body.length ? body : emptyState({ icon: 'market', title: 'Nichts zu verkaufen', text: 'Im Stationslager liegt nichts Handelbares. Entlade Erz im Hangar oder stelle Module her.' })) });
}

function modeChips(ctl, mode) {
  return h('div', { class: 'l-row' }, ...[['modules', 'Module'], ['items', 'Rohstoffe und Munition']].map(([id, label]) => button({ label, variant: 'alt', pressed: mode === id, onClick: () => { ctl.ui.mode = id; ctl.repaint(); } })));
}

function buyModules(m, ctl) {
  const slotChips = [['', 'Alle'], ['high', 'Hoch'], ['mid', 'Mittel'], ['low', 'Niedrig'], ['rig', 'Rigs']].map(([id, label]) => button({ label, variant: 'alt', pressed: (ctl.ui.slot ?? '') === id, onClick: () => { ctl.ui.slot = id; ctl.repaint(); } }));
  const catChips = [['', 'Alle Kategorien'], ...m.categories.map((c) => [c, MODCAT_LABEL[c] ?? c])].map(([id, label]) => button({ label, variant: 'ghost', pressed: (ctl.ui.cat ?? '') === id, onClick: () => { ctl.ui.cat = id; ctl.repaint(); } }));
  const search = h('input', { type: 'search', class: 'v-qty v-search', placeholder: 'Modul suchen …', value: ctl.ui.search ?? '', 'aria-label': 'Modul suchen' });
  search.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ctl.ui.search = search.value; ctl.repaint(); } });
  search.addEventListener('change', () => { ctl.ui.search = search.value; ctl.repaint(); });
  const rows = m.shop.slice(0, 60).map((x) => h('li', { class: 'v-mod' }, h('span', { class: 'v-mod__icon' }, moduleIcon(x.category, { size: 22 })),
    h('div', { class: 'v-mod__main' }, h('strong', null, x.name), h('span', { class: 'u-mute' }, ` ${SLOT_LABEL[x.slot]} · ${SIZE_LABEL[x.size] ?? x.size} · PG ${fmt(x.fitting.powergrid ?? 0)} · CPU ${fmt(x.fitting.cpu ?? 0)}`),
      x.requires.length ? h('span', { class: x.canUse ? 'v-req v-req--ok' : 'v-req v-req--no' }, x.requires.map((r) => `${r.name} ${r.level}${r.ok ? '' : ' (fehlt)'}`).join(', ')) : null),
    h('span', { class: 'u-isk v-mod__qty' }, `${fmt(x.price)} ISK`), h('span', { class: 'u-mute u-num v-mod__qty' }, x.owned ? `Lager: ${fmt(x.owned)}` : ''),
    button({ label: 'Kaufen', variant: 'primary', disabled: x.price > m.isk, reason: 'Zu wenig ISK', onClick: () => ctl.run('shop/buyModule', { moduleId: x.moduleId }) })));
  return h('div', { class: 'l-stack' }, h('div', { class: 'l-row' }, ...slotChips), h('div', { class: 'l-row' }, ...catChips), h('div', { class: 'l-row' }, search),
    rows.length ? h('ul', { class: 'v-mods' }, ...rows) : emptyState({ icon: 'market', title: 'Keine Treffer' }));
}

function buyItems(m, ctl) {
  const rows = m.items.map((x) => {
    const input = h('input', { type: 'number', min: '1', class: 'v-qty', value: ctl.ui.buyQty?.[x.itemId] ?? '100', 'aria-label': `Menge ${x.name}` });
    input.addEventListener('input', () => { (ctl.ui.buyQty ??= {})[x.itemId] = input.value; });
    const qty = () => Math.max(1, Math.floor(Number(input.value)) || 1);
    return h('li', { class: 'v-mod' }, h('span', { class: 'v-mod__icon' }, null),
      h('div', { class: 'v-mod__main' }, h('strong', null, x.name), h('span', { class: 'u-mute' }, x.kind === 'mineral' ? ' Mineral' : ' Munition')),
      h('span', { class: 'u-isk v-mod__qty' }, `${fmt(x.price)} ISK je Stück`), h('span', { class: 'u-mute u-num v-mod__qty' }, x.owned ? `Lager: ${fmt(x.owned)}` : ''),
      h('span', { class: 'l-row' }, input, button({ label: 'Kaufen', variant: 'primary', onClick: () => ctl.run('shop/buyItem', { itemId: x.itemId, qty: qty() }) })));
  });
  return rows.length ? h('ul', { class: 'v-mods' }, ...rows) : emptyState({ icon: 'market', title: 'Keine Ware' });
}

function buyTab(m, ctl) {
  const mode = ctl.ui.mode ?? 'modules';
  return card({ title: `Kaufen in ${m.stationName}`, subtitle: 'Käufe landen im Stationslager. Module baust du im Fitting ein, Mineralien brauchst du für die Herstellung. Zivilier-Module sind nicht käuflich.', children: h('div', { class: 'l-stack' },
    msgLine(ctl.ui.msg), modeChips(ctl, mode), mode === 'items' ? buyItems(m, ctl) : buyModules(m, ctl)) });
}

function historyTab(m) {
  return card({ title: 'Preisverlauf', subtitle: 'Erz und Mineralien: letzte Ticks pro Ware in dieser Station.', children: m.rows.length ? h('ul', { class: 'v-trades' }, m.rows.map((r) => h('li', { class: 'v-hist' },
    h('div', null, h('strong', null, r.name), h('span', { class: 'u-mute' }, r.history.length > 1 ? ` · ${fmt(Math.min(...r.history), 1)} bis ${fmt(Math.max(...r.history), 1)} ISK` : '')),
    sparkline({ values: r.history, width: 260, height: 40, label: `Preisverlauf ${r.name}` })))) : emptyState({ title: 'Keine Daten' }) });
}

export const view = liveView({
  id: 'market', title: 'Markt', group: 'station', order: 21, enabled: dockedOnly,
  model: (game, route, ui) => {
    const sub = route.sub ?? 'sell';
    const mode = ui.mode ?? 'modules';
    const rows = game.select('market/rows').map((r) => ({ ...r, history: sub === 'history' ? r.history : [] }));
    const buy = sub === 'buy';
    return { sub, rows, fixed: sub === 'sell' ? game.select('market/fixedRows') : [], fee: game.select('market/fee'), isk: game.state.account.isk, qty: ui.qty, mode,
      shop: buy && mode === 'modules' ? game.select('shop/modules', { slot: ui.slot || undefined, category: ui.cat || undefined, search: ui.search || undefined }) : [],
      categories: buy && mode === 'modules' ? game.select('shop/categories') : [], items: buy && mode === 'items' ? game.select('shop/items', {}) : [],
      stationName: game.data.celestials[game.state.pilot.location.dockedStationId]?.name ?? '–', msg: ui.msg };
  },
  draw: (m, game, route, ctl) => (m.sub === 'history' ? historyTab(m) : m.sub === 'buy' ? buyTab(m, ctl) : sellTab(m, game, ctl))
});
