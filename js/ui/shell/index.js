// Shell: baut Statusleiste, Neocom, Inhaltsbereich und Toast-Region und verbindet den Router.
// mount(root, game, { views, warnings }) ist der Vertrag mit boot.js (Master Plan 3.7).

import { clear, h } from '../../util/dom.js';
import { createToastRegion } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { tabs, updateTabs } from '../components/tabs.js';
import { createAccountView } from './pages/account.js';
import { NEOCOM_MODEL } from './neocom-model.js';
import { createNeocom } from './neocom.js';
import { createRouter } from './router.js';
import { buildHash } from './route.js';
import { createTopbar } from './topbar.js';
import { createTranslatorFor } from './translate.js';
import { errorToast, registerToasts } from './toasts.js';

/**
 * @param {any} root Wurzelelement (#app)
 * @param {object} game
 * @param {{views?: object[], warnings?: string[], env?: object}} [options] env: Injektion für Tests (win, location, raf, cancelRaf, doc, reload)
 */
export function mount(root, game, { views = [], warnings = [], env = {} } = {}) {
  const doc = env.doc ?? root.ownerDocument;
  const win = env.win ?? globalThis.window;
  const location = env.location ?? win.location;
  const raf = env.raf ?? ((fn) => win.requestAnimationFrame(fn));
  const cancelRaf = env.cancelRaf ?? ((id) => win.cancelAnimationFrame(id));
  const t = createTranslatorFor(game);

  const stale = doc.getElementById?.('boot-fallback');
  stale?.remove();

  const toasts = createToastRegion({ t });
  const notify = (kind, text) => toasts.push({ kind, text });
  const account = createAccountView(t, { notify, reload: env.reload ?? (() => win.location.reload()), modalRoot: root });
  const allViews = [...views, ...(views.some((v) => v.id === 'account') ? [] : [account])];

  const topbar = createTopbar({
    game, t, getWarnings: () => warnings,
    onWarnings: () => openModal({
      title: t('shell.warnings.title'), root, t,
      content: warnings.length ? h('ul', { class: 's-warn-list' }, warnings.map((w) => h('li', null, w))) : h('p', null, t('shell.warnings.none'))
    })
  });

  const heading = h('h1', { class: 'l-content__title', tabindex: '-1' });
  const viewRoot = h('div', { class: 'l-view' });
  const subtabHost = h('div', { class: 'l-subtabs' });
  let subtabEl = null;
  let subtabSig = '';

  let router = null;
  const navigate = (hash) => router.navigate(hash);
  const neocom = createNeocom({ model: NEOCOM_MODEL, views: allViews, game, t, navigate });

  function syncTabs(route) {
    const list = neocom.update(route);
    const sig = JSON.stringify(list);
    if (sig === subtabSig) return;
    subtabSig = sig;
    if (!list.length) { clear(subtabHost); subtabEl = null; return; }
    const active = (list.find((x) => x.active) ?? list[0]).id;
    const tabList = list.map((x) => ({ id: x.id, label: x.label, disabled: x.disabled, reason: x.reason }));
    const onSelect = (id) => { const target = list.find((x) => x.id === id); if (target) navigate(target.hash); };
    if (!subtabEl) { subtabEl = tabs({ tabs: tabList, active, onSelect, label: t('shell.nav.label') }); subtabHost.appendChild(subtabEl); }
    else updateTabs(subtabEl, { tabs: tabList, active, onSelect });
  }

  clear(root);
  root.appendChild(h('div', { class: 'l-app' },
    h('header', { class: 'l-topbar' }, topbar.el),
    h('div', { class: 'l-body' },
      h('aside', { class: 'l-neocom' }, neocom.el),
      h('main', { class: 'l-content', id: 'content' }, subtabHost, heading, viewRoot)),
    toasts.el));

  router = createRouter({
    game, views: allViews, viewRoot, heading, t, location, win, raf, cancelRaf, doc, notify,
    onRoute: (route) => { topbar.update(); syncTabs(route); },
    onWarn: (msg) => warnings.push(msg)
  });

  const offToasts = registerToasts(game, (toast) => toasts.push(toast), t);
  const offTop = game.subscribe(() => topbar.update());
  router.start();
  topbar.update();

  return {
    router, toasts, neocom, topbar,
    navigate: (path) => router.navigate(path),
    errorToast: (result) => toasts.push(errorToast(result, t)),
    destroy() { router.stop(); offToasts(); offTop(); clear(root); }
  };
}

export { buildHash };
