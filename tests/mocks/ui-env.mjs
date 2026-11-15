// Gemeinsame Test-Umgebung für Shell-Tests: Fake-DOM, steuerbare Location, manuelles rAF, Spiel aus dem Harness.

import { createFakeDom } from '../ui-fake-dom.mjs';
import { createTestGame } from '../harness.js';

export function createUiEnv({ docked = true, systems = [] } = {}) {
  const dom = createFakeDom();
  dom.install();
  const { document, window } = dom;
  const game = createTestGame({ systems });
  if (!docked) game.state.pilot.location.dockedStationId = null;

  const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const cancelRaf = (id) => { frames[id - 1] = null; };
  const flush = () => { const list = frames.splice(0).filter(Boolean); list.forEach((fn) => fn()); };

  let hash = '';
  const location = {
    get hash() { return hash; },
    set hash(v) { hash = v; window.dispatchEvent({ type: 'hashchange', bubbles: false, target: window }); }
  };
  const root = document.createElement('div');
  document.body.appendChild(root);
  return { dom, document, window, game, raf, cancelRaf, flush, location, root, env: { win: window, location, raf, cancelRaf, doc: document, reload: () => {} } };
}

/** Einfache Fake-Ansicht mit Zählern. */
export function fakeView(id, extra = {}) {
  const calls = { render: 0, update: 0 };
  return {
    id, title: `Titel ${id}`, group: 'test', order: 1, calls,
    render(root) { calls.render += 1; root.textContent = id; },
    update() { calls.update += 1; },
    ...extra
  };
}
