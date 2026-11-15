// Gemeinsamer Rahmen für Ansichten: baut den Inhalt neu, wenn sich das Modell ändert.
// Schutz gegen verlorene Klicks und Eingaben: Während ein Zeiger gedrückt ist oder ein Eingabefeld Fokus hat, wird nicht neu gezeichnet.

import { h } from '../../util/dom.js';
import { button } from '../components/button.js';
import { buildHash } from '../shell/route.js';

let pointerDown = false;
let installed = false;

function install(doc) {
  if (installed || !doc?.addEventListener) return;
  installed = true;
  doc.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  const release = () => { setTimeout(() => { pointerDown = false; }, 0); };
  doc.addEventListener('pointerup', release, true);
  doc.addEventListener('pointercancel', release, true);
}

const INPUT = /^(INPUT|SELECT|TEXTAREA)$/;

/**
 * @param {{id: string, title: string, group?: string, order?: number, subs?: object[], enabled?: Function,
 *   model: (game: any, route: any, ui: any) => object, draw: (model: any, game: any, route: any, ctl: any) => any}} spec
 */
export function liveView(spec) {
  const stores = new WeakMap();

  function paint(root, game, route, force) {
    const ui = stores.get(root);
    if (!ui) return;
    const active = root.ownerDocument?.activeElement;
    if (!force && ((active && root.contains(active) && INPUT.test(active.tagName)) || pointerDown)) return;
    const model = spec.model(game, route, ui);
    const sig = JSON.stringify([route.sub, model]);
    if (!force && sig === ui.sig) return;
    ui.sig = sig;
    const repaint = () => paint(root, game, route, true);
    const run = (type, payload) => {
      const res = game.dispatch(type, payload);
      const msg = res.ok ? null : res.message ?? 'Aktion nicht möglich.';
      if (msg !== ui.msg) { ui.msg = msg; repaint(); }
      return res;
    };
    root.replaceChildren(spec.draw(model, game, route, { ui, repaint, run }));
  }

  return {
    id: spec.id, title: spec.title, group: spec.group ?? 'main', order: spec.order ?? 50, css: 'css/views.css',
    enabled: spec.enabled,
    render(root, game, route) {
      install(root.ownerDocument);
      stores.set(root, { qty: {}, sel: null, msg: null, sig: null });
      paint(root, game, route, true);
    },
    update(root, game, route) { paint(root, game, route, false); }
  };
}

export const dockedOnly = (game) => (game.state.pilot.location.dockedStationId ? { ok: true } : { ok: false, reason: 'Nur in Stationen.' });
export const goto = (path) => { globalThis.location.hash = buildHash(path); };
export const msgLine = (msg) => (msg ? h('p', { class: 'v-msg', role: 'alert' }, msg) : null);

/** Kleiner Helfer: Button, der eine Action auslöst. */
export function actionButton({ label, icon, variant = 'alt', run, type, payload, disabled = false, reason }) {
  return button({ label, icon, variant, disabled, reason, onClick: () => run(type, payload) });
}
