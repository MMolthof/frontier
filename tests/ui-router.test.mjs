import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUiEnv, fakeView } from './mocks/ui-env.mjs';
import { parseHash, buildHash } from '../js/ui/shell/route.js';
import { createRouter } from '../js/ui/shell/router.js';
import { createT } from '../js/ui/shell/translate.js';

test('Hash-Routen: Parsen, Bauen, Standard und Sonderzeichen', () => {
  assert.deepEqual(parseHash(''), { viewId: 'overview', sub: null });
  assert.deepEqual(parseHash('#/'), { viewId: 'overview', sub: null });
  assert.deepEqual(parseHash('#/hangar/items'), { viewId: 'hangar', sub: 'items' });
  assert.deepEqual(parseHash('#/mining'), { viewId: 'mining', sub: null });
  assert.equal(buildHash({ viewId: 'hangar', sub: 'items' }), '#/hangar/items');
  assert.equal(buildHash({ viewId: 'system', sub: null }), '#/system');
  assert.deepEqual(parseHash(buildHash({ viewId: 'a b', sub: 'ä' })), { viewId: 'a b', sub: 'ä' });
  assert.deepEqual(parseHash('#/%E0%A4%A'), { viewId: '%E0%A4%A', sub: null }, 'kaputte Kodierung wirft nicht');
});

function routerSetup(views, opts = {}) {
  const env = createUiEnv(opts);
  const notes = []; const warns = [];
  const heading = env.document.createElement('h1');
  const viewRoot = env.document.createElement('div');
  const router = createRouter({ game: env.game, views, viewRoot, heading, t: createT(env.game), location: env.location, win: env.window, raf: env.raf, cancelRaf: env.cancelRaf, doc: env.document, notify: (k, x) => notes.push({ k, x }), onWarn: (m) => warns.push(m) });
  return { env, router, notes, warns, heading, viewRoot };
}

test('Router: render genau einmal beim Betreten, Updates gebündelt per rAF', () => {
  const a = fakeView('overview'); const b = fakeView('fitting');
  const { env, router, heading, viewRoot } = routerSetup([a, b]);
  router.start();
  assert.equal(a.calls.render, 1);
  assert.equal(heading.textContent, 'Titel overview');
  assert.equal(env.document.activeElement, heading, 'Fokus auf die Überschrift');
  env.game.advance(1); env.game.advance(1); env.game.advance(1);
  assert.equal(a.calls.update, 0, 'noch nicht gelaufen');
  env.flush();
  assert.equal(a.calls.update, 1, 'drei Ticks, ein Update pro Frame');
  env.location.hash = '#/fitting';
  assert.equal(b.calls.render, 1);
  assert.equal(viewRoot.textContent, 'fitting');
  env.location.hash = '#/fitting/x';
  assert.equal(b.calls.render, 1, 'Sub-Wechsel rendert nicht neu');
  assert.equal(b.calls.update, 1);
  router.stop();
  env.game.advance(1);
  env.flush();
  assert.equal(a.calls.update, 1);
});

test('Router: unbekannte oder deaktivierte Ansicht leitet mit Hinweis zur Übersicht', () => {
  const a = fakeView('overview'); const locked = fakeView('fitting', { enabled: () => ({ enabled: false, reason: 'Nur im Hangar.' }) });
  const { env, router, notes } = routerSetup([a, locked]);
  router.start();
  env.location.hash = '#/fitting';
  assert.equal(env.location.hash, '#/overview');
  assert.match(notes[0].x, /Nur im Hangar/);
  env.location.hash = '#/gibtsnicht';
  assert.equal(env.location.hash, '#/overview');
  assert.match(notes[1].x, /noch nicht verfügbar/);
  assert.equal(router.currentViewId, 'overview');
});

test('Router: Fehler in render/update werden isoliert, Fehlerkarte erscheint, andere Ansichten laufen weiter', () => {
  const bad = fakeView('fitting', { render() { throw new Error('kaputt render'); } });
  const flaky = fakeView('mining', { update() { throw new Error('kaputt update'); } });
  const ok = fakeView('overview');
  const { env, router, warns, viewRoot } = routerSetup([ok, bad, flaky]);
  router.start();
  env.location.hash = '#/fitting';
  assert.match(viewRoot.textContent, /nicht angezeigt/);
  assert.ok(warns[0].includes('kaputt render'));
  env.location.hash = '#/mining';
  env.game.advance(1); env.flush();
  assert.match(viewRoot.textContent, /nicht angezeigt/);
  const count = warns.length;
  env.game.advance(1); env.flush();
  assert.equal(warns.length, count, 'ausgefallene Ansicht wird nicht in Dauerschleife aufgerufen');
  env.location.hash = '#/overview';
  assert.equal(viewRoot.textContent, 'overview', 'nach Wechsel funktioniert alles wieder');
});

test('Router: Ansicht wird unzulässig (undocked) und der Spieler landet in der Übersicht', () => {
  const hangar = fakeView('hangar', { enabled: (g) => Boolean(g.state.pilot.location.dockedStationId) });
  const { env, router, notes } = routerSetup([fakeView('overview'), hangar]);
  router.start();
  env.location.hash = '#/hangar';
  assert.equal(router.currentViewId, 'hangar');
  env.game.state.pilot.location.dockedStationId = null;
  env.game.advance(1); env.flush();
  assert.equal(env.location.hash, '#/overview');
  assert.equal(router.currentViewId, 'overview');
  assert.ok(notes.length >= 1);
});


test('Router: View-CSS wird pro View nur einmal angehängt, css:false schaltet ab', () => {
  const { env, router } = routerSetup([fakeView('overview', { css: false }), fakeView('fitting'), fakeView('mining')]);
  router.start();
  const links = () => env.document.head.children.filter((c) => c.tagName === 'link').map((c) => c.getAttribute('href'));
  assert.deepEqual(links(), []);
  env.location.hash = '#/fitting';
  env.location.hash = '#/mining';
  env.location.hash = '#/fitting';
  env.location.hash = '#/fitting/x';
  assert.deepEqual(links(), ['css/views/fitting.css', 'css/views/mining.css']);
});
