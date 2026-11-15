// Eingebaute Shell-Ansicht "account" (die Registry enthält keine): Protokoll und Einstellungen.
// "Vermögen" bleibt deaktiviert (Spiellogik gehört einem Fachagenten).

import { clear, h } from '../../../util/dom.js';
import { card } from '../../components/card.js';
import { emptyState } from '../../components/empty-state.js';
import { renderLogPage, updateLogPage } from './log.js';
import { renderSettingsPage } from './settings.js';

const pageOf = (route) => (route.sub === 'settings' ? 'settings' : !route.sub || route.sub === 'log' ? 'log' : 'other');

export function createAccountView(t, ctx) {
  const render = (root, game, route) => {
    clear(root);
    root.__log = null;
    const page = h('div', { class: 's-page' });
    root.appendChild(page);
    root.__page = pageOf(route);
    root.__sub = route.sub;
    if (root.__page === 'settings') renderSettingsPage(page, game, t, ctx);
    else if (root.__page === 'log') { renderLogPage(page, game, t); root.__log = page.__log; }
    else page.appendChild(card({ title: t(`shell.nav.account.${route.sub}`), children: emptyState({ icon: 'lock', title: t('shell.reason.notyet') }) }));
    root.__pageEl = page;
  };
  return {
    id: 'account', title: t('shell.nav.account'), group: 'account', order: 900,
    css: false,
    render,
    update(root, game, route) {
      if (root.__sub !== route.sub && pageOf(route) !== root.__page) { render(root, game, route); return; }
      root.__sub = route.sub;
      if (root.__page === 'log') updateLogPage(root.__pageEl, game);
    }
  };
}
