import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUiEnv } from './mocks/ui-env.mjs';
import { createMockGame } from './mocks/mock-game.js';
import { mount } from '../js/ui/shell/index.js';
import { view as overviewView } from '../js/ui/views/overview/index.js';

function mountSetup(opts) {
  const env = createUiEnv(opts);
  const ui = mount(env.root, env.game, { views: [overviewView, ...(opts?.views ?? [])], warnings: ['Testwarnung'], env: env.env });
  return { env, ui };
}

test('Mount: Shell mit Übersicht, Neocom, Statusleiste; Ticks aktualisieren Knoten in place', () => {
  const { env, ui } = mountSetup({ docked: true });
  const text = () => env.root.textContent;
  assert.match(text(), /Pebble/);
  assert.match(text(), /Aldara/);
  assert.equal(env.root.querySelectorAll('nav').length, 1);
  assert.equal(env.root.querySelectorAll('h1')[0].textContent, 'Übersicht');
  const tickNode = env.root.querySelector('.s-top__item .u-num');
  const before = env.root.querySelectorAll('.c-card').length;
  const nodeBefore = env.root.querySelectorAll('.c-card')[0];
  env.game.advance(5); env.flush();
  assert.equal(env.root.querySelectorAll('.c-card').length, before);
  assert.equal(env.root.querySelectorAll('.c-card')[0], nodeBefore, 'Karten bleiben erhalten');
  assert.ok(env.root.querySelector('.s-top__item .u-num') === tickNode);
  assert.match(text(), /5/);
  ui.destroy();
});

test('Mount: Neocom per Tastatur, Auswahl navigiert, deaktivierte zeigen Grund', () => {
  const { env } = mountSetup({ docked: false, views: [{ id: 'fitting', title: 'Fitting', group: 'x', order: 1, render(r) { r.textContent = 'FIT'; }, update() {} }] });
  const buttons = () => env.root.querySelectorAll('.s-neo__btn');
  const byId = (id) => buttons().find((b) => b.getAttribute('data-id') === id);
  const overviewBtn = byId('overview');
  assert.equal(overviewBtn.getAttribute('aria-current'), 'page');
  assert.equal(overviewBtn.getAttribute('tabindex'), '0');
  assert.equal(buttons().filter((b) => b.getAttribute('tabindex') === '0').length, 1, 'Roving Tabindex');
  const station = byId('station');
  assert.equal(station.getAttribute('aria-disabled'), 'true');
  assert.match(station.textContent, /Nur in der Station/);
  overviewBtn.focus();
  env.dom.key(overviewBtn.parentNode.parentNode.parentNode.parentNode, 'ArrowDown');
  byId('overview').dispatchEvent({ type: 'keydown', key: 'ArrowDown', bubbles: true, preventDefault() {}, target: byId('overview') });
  assert.equal(env.document.activeElement.getAttribute('data-id'), 'system');
  byId('fitting').click();
  assert.equal(env.location.hash, '#/fitting');
  assert.equal(env.root.querySelector('.l-view').textContent, 'FIT');
  assert.equal(byId('fitting').getAttribute('aria-current'), 'page');
  byId('mining').click();
  assert.equal(byId('mining').getAttribute('aria-expanded'), 'true');
  byId('station').click();
  assert.equal(env.location.hash, '#/fitting', 'deaktivierte Gruppe navigiert nicht');
});

test('Mount: Andocken schaltet Station frei, Statusleiste zeigt Warp und Nachholen', () => {
  const hangar = { id: 'hangar', title: 'Hangar', group: 'x', order: 1, render() {}, update() {} };
  const { env } = mountSetup({ docked: false, views: [hangar] });
  const station = () => env.root.querySelectorAll('.s-neo__btn').find((b) => b.getAttribute('data-id') === 'station');
  assert.equal(station().getAttribute('aria-disabled'), 'true');
  env.game.state.pilot.location.dockedStationId = 'cel.aldara.p1.station';
  env.game.advance(1); env.flush();
  assert.equal(station().getAttribute('aria-disabled'), null);
  env.game.state.pilot.warp = { fromId: 'cel.aldara.p1', toId: 'cel.aldara.belt1', ticksLeft: 4, ticksTotal: 8 };
  env.game.advance(1); env.flush();
  assert.match(env.root.textContent, /Warp nach Aldara – Gürtel 1/);
  const meter = env.root.querySelector('[role="progressbar"]');
  assert.equal(meter.getAttribute('aria-valuenow'), '4');
});

test('Mount: Konto-Einstellungen, Reset-Bestätigung, Warnungsdialog', async () => {
  const { env } = mountSetup({ docked: true });
  env.location.hash = '#/account/settings';
  const buttons = () => env.root.querySelectorAll('.l-view button');
  const reset = buttons().find((b) => b.textContent === 'Spiel zurücksetzen');
  assert.ok(reset);
  const exportBtn = buttons().find((b) => b.textContent === 'Spielstand exportieren');
  assert.equal(exportBtn.getAttribute('aria-disabled'), 'true', 'ohne SaveManager am Game deaktiviert mit Grund');
  env.game.state.account.isk = 777;
  reset.click();
  const overlay = env.root.querySelector('.c-modal__overlay');
  assert.ok(overlay);
  overlay.querySelectorAll('button')[0].click();
  await new Promise((r) => setImmediate(r));
  assert.equal(env.game.state.account.isk, 777, 'Abbrechen setzt nichts zurück');
  env.root.querySelector('.s-top button[aria-label="Warnungen"]').click();
  assert.match(env.root.querySelector('.c-modal__overlay').textContent, /Testwarnung/);
  env.location.hash = '#/account/wealth';
  assert.match(env.root.querySelector('.l-view').textContent, /noch nicht verfügbar/);
});

function mockEnv(options) {
  const env = createUiEnv();
  const game = createMockGame(options);
  const ui = mount(env.root, game, { views: [overviewView], warnings: [], env: env.env });
  return { env, game, ui };
}

test('Mount mit Mock-Game: läuft ohne Fehler, nur Übersicht, alle anderen Einträge deaktiviert mit Begründung', () => {
  const { env } = mockEnv({ docked: true });
  const disabled = env.root.querySelectorAll('.s-neo__btn').filter((b) => b.getAttribute('aria-disabled') === 'true');
  assert.ok(disabled.length >= 4);
  for (const b of disabled) assert.ok(b.querySelector('.s-neo__reason'), `Grund fehlt bei ${b.getAttribute('data-id')}`);
  const fitting = disabled.find((b) => b.getAttribute('data-id') === 'fitting');
  assert.match(fitting.querySelector('.s-neo__reason').textContent, /Ansicht noch nicht verfügbar/);
});

test('Mount mit leeren Datensammlungen: Fallbacktexte statt Absturz', () => {
  const { env, game } = mockEnv({ docked: false, emptyData: true });
  assert.match(env.root.querySelector('.l-view').textContent, /Pebble|ship\.pebble/);
  game.state.pilot.queue = [{ skillId: 'skill.unbekannt', level: 2 }];
  game.state.pilot.location.systemId = 'sys.unbekannt';
  game.advance(1); env.flush();
  assert.match(env.root.querySelector('.l-view').textContent, /skill\.unbekannt/);
  assert.match(env.root.textContent, /sys\.unbekannt/);
});

test('Mount: Warp im Mock-Game zeigt Fortschritt, Toast bei Ankunft, destroy räumt auf', () => {
  const { env, game, ui } = mockEnv({ docked: false });
  game.dispatch('travel/warp', { celestialId: 'cel.aldara.belt1' });
  game.advance(2); env.flush();
  assert.match(env.root.textContent, /Warp nach Aldara – Gürtel 1/);
  game.advance(4); env.flush();
  assert.match(env.root.querySelector('.c-toasts').textContent, /Angekommen: Aldara – Gürtel 1/);
  ui.destroy();
  assert.equal(env.root.children.length, 0);
  game.advance(1); env.flush();
});

test('Mount: Geschwindigkeits-Buttons rufen game/setSpeed und zeigen aria-pressed', () => {
  const { env, game } = mockEnv({ docked: true });
  const btn = env.root.querySelectorAll('.s-speed button').find((b) => b.getAttribute('aria-label') === 'Geschwindigkeit auf 5x stellen');
  btn.click(); env.flush();
  assert.equal(game.select('core/speed'), 5);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
});
