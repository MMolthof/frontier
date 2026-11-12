import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUiEnv, fakeView } from './mocks/ui-env.mjs';
import { buildMenu, activeTabs, evalEnabled } from '../js/ui/shell/menu.js';
import { buildNeocom, NEOCOM_MODEL } from '../js/ui/shell/neocom-model.js';
import { createT } from '../js/ui/shell/translate.js';

const find = (menu, id) => menu.flatMap((m) => [m, ...(m.children ?? [])]).find((m) => m.id === id);

test('Menü: Station nur docked, Vermögen nie, fehlende Ansichten mit Grund, aktiv markiert', () => {
  const env = createUiEnv({ docked: true });
  const t = createT(env.game);
  const views = [fakeView('overview'), fakeView('system'), fakeView('hangar'), fakeView('account'), fakeView('fitting')];
  const docked = buildMenu(NEOCOM_MODEL, views, env.game, { t, route: { viewId: 'hangar', sub: null } });
  assert.equal(find(docked, 'hangar').enabled, true);
  assert.equal(find(docked, 'hangar').active, true);
  assert.equal(find(docked, 'market').enabled, false, 'View fehlt');
  assert.match(find(docked, 'market').reason, /noch nicht verfügbar/);
  assert.equal(find(docked, 'account.wealth').enabled, false);
  assert.match(find(docked, 'account.wealth').reason, /noch nicht verfügbar/);
  assert.equal(find(docked, 'station').expanded, true, 'Gruppe der aktiven Ansicht ist offen');
  assert.deepEqual(find(docked, 'hangar').subs.map((s) => s.id), ['items', 'ships']);

  env.game.state.pilot.location.dockedStationId = null;
  const space = buildMenu(NEOCOM_MODEL, views, env.game, { t });
  assert.equal(find(space, 'hangar').enabled, false);
  assert.equal(find(space, 'hangar').reason, 'Nur in der Station verfügbar.');
  assert.equal(find(space, 'station').enabled, false);
  assert.equal(find(space, 'fitting').enabled, true);
});

test('Menü: system-Untereinträge teilen die Ansicht; ohne sub ist der erste aktiv', () => {
  const env = createUiEnv();
  const t = createT(env.game);
  const views = [fakeView('system')];
  const a = buildMenu(NEOCOM_MODEL, views, env.game, { t, route: { viewId: 'system', sub: null } });
  assert.equal(find(a, 'system.overview').active, true);
  assert.equal(find(a, 'system.map').active, false);
  const b = buildMenu(NEOCOM_MODEL, views, env.game, { t, route: { viewId: 'system', sub: 'map' } });
  assert.equal(find(b, 'system.map').active, true);
  assert.equal(find(b, 'system.overview').active, false);
  assert.deepEqual(activeTabs(b).map((x) => x.id), ['system.overview', 'system.map', 'system.stars']);
  assert.equal(activeTabs(b).find((x) => x.active).id, 'system.map');
});

test('Menü: Ansichten außerhalb des Modells landen unter "Weitere"; enabled-Fehler und -Grund werden respektiert', () => {
  const env = createUiEnv();
  const t = createT(env.game);
  const views = [
    fakeView('combat'),
    fakeView('hidden', { enabled: () => false }),
    fakeView('boom', { enabled: () => { throw new Error('x'); } }),
    fakeView('fitting', { enabled: () => ({ enabled: false, reason: 'Schiff nicht im Hangar' }) })
  ];
  const menu = buildMenu(NEOCOM_MODEL, views, env.game, { t });
  const more = menu.find((m) => m.id === 'more');
  assert.deepEqual(more.children.map((c) => c.id), ['more.combat']);
  assert.equal(find(menu, 'fitting').reason, 'Schiff nicht im Hangar');
  assert.equal(evalEnabled(views[2], env.game, t).ok, false);
  assert.equal(evalEnabled(undefined, env.game, t).missing, true);
});


test('buildNeocom: reine Funktion mit Standardübersetzer', () => {
  const env = createUiEnv();
  const menu = buildNeocom(NEOCOM_MODEL, [fakeView('overview')], env.game);
  assert.equal(find(menu, 'overview').label, 'Übersicht');
  assert.equal(find(menu, 'overview').enabled, true);
  assert.equal(find(menu, 'fitting').enabled, false);
  assert.ok(createT({}));
});

test('Menü: enabled darf { ok } oder { enabled } liefern, subs über titleKey', () => {
  const env = createUiEnv();
  const t = createT(env.game);
  const okForm = fakeView('fitting', { enabled: () => ({ ok: false, reason: 'Grund A' }) });
  const menu = buildMenu(NEOCOM_MODEL, [okForm], env.game, { t });
  assert.equal(find(menu, 'fitting').reason, 'Grund A');
  const withSubs = fakeView('hangar', { subs: [{ id: 'x', titleKey: 'shell.nav.hangar.items' }] });
  const m2 = buildMenu([{ id: 'h', labelKey: 'shell.nav.hangar', icon: 'hangar', viewId: 'hangar' }], [withSubs], env.game, { t, route: { viewId: 'hangar', sub: null } });
  assert.equal(m2[0].subs[0].label, 'Items');
});
