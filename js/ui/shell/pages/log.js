// Protokoll (#/account/log): Einträge aus core/log, filterbar nach kind.

import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { emptyState } from '../../components/empty-state.js';
import { tabs, updateTabs } from '../../components/tabs.js';

const LIMIT = 200;

export function renderLogPage(root, game, t) {
  const refs = { filter: 'all', sig: '' };
  const list = h('div');
  const filterHost = h('div', { class: 'l-row' });
  root.appendChild(card({ title: t('log.title'), children: h('div', { class: 'l-stack' }, filterHost, list) }));
  refs.filterHost = filterHost; refs.list = list; refs.t = t;
  root.__log = refs;
  updateLogPage(root, game);
}

export function updateLogPage(root, game) {
  const refs = root.__log;
  const { t } = refs;
  const rows = game.select('core/log', { limit: LIMIT }) ?? [];
  const kinds = ['all', ...new Set(rows.map((r) => r.kind ?? 'info'))];
  if (!kinds.includes(refs.filter)) refs.filter = 'all';
  const sig = `${kinds.join(',')}|${refs.filter}|${rows.map((r) => `${r.tick}|${r.text}`).join('\n')}`;
  if (sig === refs.sig) return;
  refs.sig = sig;

  const tabList = kinds.map((k) => ({ id: k, label: k === 'all' ? t('log.filter.all') : k }));
  if (!refs.tabs) {
    refs.tabs = tabs({ tabs: tabList, active: refs.filter, label: t('log.filter'), onSelect: (id) => { refs.filter = id; refs.sig = ''; updateLogPage(root, game); } });
    refs.filterHost.appendChild(refs.tabs);
  } else updateTabs(refs.tabs, { tabs: tabList, active: refs.filter });

  const shown = refs.filter === 'all' ? rows : rows.filter((r) => (r.kind ?? 'info') === refs.filter);
  refs.list.replaceChildren(shown.length
    ? h('ul', { class: 's-log' }, shown.map((e) => h('li', { class: 's-log__row' }, h('span', { class: 'u-mute u-num' }, fmt(e.tick)), h('span', null, e.text))))
    : emptyState({ icon: 'log', title: t('log.none') }));
}
