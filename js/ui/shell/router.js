// Router: Hash -> Ansicht. render() einmal beim Betreten, update() gebündelt nach game.subscribe (rAF).
// Fehler in einer Ansicht werden isoliert (Fehlerkarte), der Rest läuft weiter.
// Alles Browserspezifische (location, rAF, document) wird injiziert, damit Tests ohne Browser laufen.

import { clear, h } from '../../util/dom.js';
import { card } from '../components/card.js';
import { evalEnabled } from './menu.js';
import { buildHash, DEFAULT_VIEW, parseHash } from './route.js';

/**
 * @param {{game: object, views: object[], viewRoot: any, heading: any, t: Function,
 *   location: {hash: string}, win: {addEventListener: Function, removeEventListener: Function},
 *   raf: (fn: () => void) => any, cancelRaf: (id: any) => void, doc?: any,
 *   notify?: (kind: string, text: string) => void, onRoute?: (route: object) => void, onWarn?: (msg: string) => void}} o
 */
export function createRouter(o) {
  const { game, viewRoot, heading, t, location, win, raf, cancelRaf, doc, notify = () => {}, onRoute = () => {}, onWarn = () => {} } = o;
  const views = new Map(o.views.map((v) => [v.id, v]));
  const loadedCss = new Set();
  let current = null; // { view, route, failed }
  let frame = null;
  let unsubscribe = null;
  let started = false;

  const redirect = (reason) => {
    notify('warn', t('shell.redirect', { reason }));
    location.hash = buildHash({ viewId: DEFAULT_VIEW, sub: null });
  };

  function loadCss(view) {
    const href = view.css === false ? null : view.css ?? `css/views/${view.id}.css`;
    if (!href || !doc || loadedCss.has(href)) return;
    loadedCss.add(href);
    const link = doc.createElement('link'); // fehlende Datei wird vom Browser still toleriert
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    doc.head.appendChild(link);
  }

  function showError(view, err) {
    onWarn(`Ansicht ${view.id} warf: ${err?.stack ?? err?.message ?? err}`);
    clear(viewRoot);
    viewRoot.appendChild(card({ title: t('shell.view.error'), children: [h('p', { class: 'u-bad' }, String(err?.message ?? err)), h('p', { class: 'u-mute' }, t('shell.view.error.hint'))] }));
    if (current) current.failed = true;
  }

  function enter(view, route) {
    current = { view, route, failed: false };
    clear(viewRoot);
    loadCss(view);
    if (doc) doc.title = `${view.title} · ${t('shell.title')}`;
    heading.textContent = view.title;
    try { view.render(viewRoot, game, route); } catch (err) { showError(view, err); }
    onRoute(route);
    if (typeof heading.focus === 'function') heading.focus();
  }

  function resolve() {
    const route = parseHash(location.hash);
    const view = views.get(route.viewId);
    const state = evalEnabled(view, game, t);
    if (!state.ok) {
      if (route.viewId !== DEFAULT_VIEW) { redirect(state.reason); return; }
      if (!view) { current = null; clear(viewRoot); viewRoot.appendChild(card({ title: t('shell.view.error'), children: state.reason })); return; }
    }
    if (current && current.view === view) {
      current.route = route;
      onRoute(route);
      if (!current.failed) {
        try { view.update(viewRoot, game, route); } catch (err) { showError(view, err); }
      }
      return;
    }
    enter(view, route);
  }

  function tick() {
    frame = null;
    if (!current) { resolve(); return; }
    const state = evalEnabled(current.view, game, t);
    if (!state.ok && current.view.id !== DEFAULT_VIEW) { redirect(state.reason); return; }
    onRoute(current.route);
    if (current.failed) return;
    try { current.view.update(viewRoot, game, current.route); } catch (err) { showError(current.view, err); }
  }

  const schedule = () => { if (frame === null) frame = raf(tick); };
  const onHash = () => resolve();

  return {
    start() {
      if (started) return;
      started = true;
      win.addEventListener('hashchange', onHash);
      unsubscribe = game.subscribe(schedule);
      resolve();
    },
    stop() {
      win.removeEventListener('hashchange', onHash);
      unsubscribe?.();
      if (frame !== null) cancelRaf(frame);
      frame = null; started = false;
    },
    navigate(path) { location.hash = typeof path === 'string' ? path : buildHash(path); },
    /** Für Tests und Shell: sofortiges Auflösen/Aktualisieren ohne rAF. */
    refresh() { if (frame !== null) { cancelRaf(frame); frame = null; } tick(); },
    get route() { return current?.route ?? parseHash(location.hash); },
    get currentViewId() { return current?.view.id ?? null; }
  };
}
