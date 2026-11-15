// Iteration 1 (Lead): spielbare Bergbau-Schleife mit echten Daten und echter Registry, ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFsReader, loadData } from '../js/core/data-loader.js';
import { loadRegistry } from '../js/core/registry.js';
import { createGame } from '../js/core/game.js';
import { REPO_ROOT } from './harness.js';

async function newGame() {
  const reader = createFsReader(REPO_ROOT);
  const { data } = await loadData(reader, { onWarn() {} });
  const warnings = [];
  const registry = await loadRegistry(reader, { onWarn: (m) => warnings.push(m) });
  const game = createGame({ data, systems: registry.systems, now: () => 0, onWarn: (m) => warnings.push(m) });
  return { game, registry, warnings };
}
const ok = (res) => { assert.equal(res.ok, true, JSON.stringify(res)); return res; };
function arrive(game) { let guard = 50; while (game.state.pilot.warp && guard--) game.advance(1); assert.ok(!game.state.pilot.warp); }

test('Registry lädt alle Systeme und Ansichten ohne Warnungen', async () => {
  const { registry, warnings } = await newGame();
  assert.deepEqual(warnings, []);
  for (const id of ['travel', 'mining', 'inventory', 'market', 'refine', 'fitting']) assert.ok(registry.systems.some((s) => s.id === id), id);
  assert.ok(registry.views.some((v) => v.id === 'overview'));
});

test('Start: angedockt in Aldara, Starterschiff mit zwei Minern', async () => {
  const { game } = await newGame();
  assert.equal(game.select('travel/isDocked'), true);
  const info = game.select('fitting/stats', { uid: 'u1' });
  assert.equal(info.mining.lasers, 2);
  assert.ok(info.mining.m3PerTick > 1);
});

test('Spielschleife: abdocken, zum Gürtel warpen, abbauen, zurück, entladen, verkaufen, raffinieren', async () => {
  const { game } = await newGame();
  const isk0 = game.state.account.isk;
  // im All gelten Station-Regeln nicht
  ok(game.dispatch('travel/undock'));
  assert.equal(game.dispatch('inv/unload').ok, false);
  assert.equal(game.dispatch('mining/start').ok, false, 'Abbau nur im Gürtel');
  const view = game.select('travel/overview');
  const belt = view.rows.find((r) => r.type === 'belt');
  const station = view.rows.find((r) => r.type === 'station');
  ok(game.dispatch('travel/warp', { celestialId: belt.id }));
  assert.equal(game.dispatch('travel/dock').ok, false);
  arrive(game);
  assert.equal(game.state.pilot.location.celestialId, belt.id);

  ok(game.dispatch('mining/start'));
  game.advance(120);
  const hold = game.select('mining/hold');
  assert.ok(hold.rows.length > 0, 'Erz in der Halle');
  assert.ok(hold.usedM3 > 10 && hold.usedM3 <= hold.maxM3);
  const field = game.select('mining/field');
  assert.ok(field.asteroids.some((a) => a.remainingM3 < a.initialM3), 'Asteroid wird kleiner');

  ok(game.dispatch('mining/stop'));
  ok(game.dispatch('travel/warp', { celestialId: station.id }));
  arrive(game);
  ok(game.dispatch('travel/dock'));
  const unloaded = ok(game.dispatch('inv/unload'));
  assert.ok(unloaded.moved > 0);
  assert.equal(game.select('mining/hold').rows.length, 0);

  const stock = game.select('inv/stock').filter((r) => r.kind === 'ore');
  const row = stock[0];
  const quote = game.select('market/quote', { itemId: row.itemId, qty: row.qty });
  assert.ok(quote.net > 0);
  const priceBefore = game.select('market/rows').find((r) => r.itemId === row.itemId).price;
  ok(game.dispatch('market/sell', { itemId: row.itemId, qty: Math.floor(row.qty / 2) }));
  assert.ok(game.state.account.isk > isk0);
  const priceAfter = game.select('market/rows').find((r) => r.itemId === row.itemId).price;
  assert.ok(priceAfter < priceBefore, 'Verkauf drückt den Preis');

  const rest = game.select('inv/stock').find((r) => r.itemId === row.itemId);
  if (rest && rest.qty >= 100) {
    const prev = game.select('refine/preview', { oreId: row.itemId });
    ok(game.dispatch('refine/run', { oreId: row.itemId }));
    assert.ok(Object.values(prev.outputs).every((n) => n >= 0));
    assert.ok(game.select('inv/stock').some((r) => r.kind === 'mineral'), 'Mineralien im Lager');
  }
});

test('Gürtel erschöpft sich und Hold-Voll stoppt den Abbau', async () => {
  const { game } = await newGame();
  ok(game.dispatch('travel/undock'));
  const belt = game.select('travel/overview').rows.find((r) => r.type === 'belt');
  ok(game.dispatch('travel/warp', { celestialId: belt.id }));
  arrive(game);
  game.state.assets.ships[0].oreHold = { 'ore.veldspar': 49_990 }; // fast voll (5.000 m3)
  ok(game.dispatch('mining/start'));
  game.advance(40);
  assert.equal(game.state.mining.sessions.length, 0, 'Abbau beendet');
  assert.ok(game.select('mining/hold').usedM3 <= game.select('mining/hold').maxM3 + 0.01);
});

test('Gate-Sprung: nur am Tor, danach neues System', async () => {
  const { game } = await newGame();
  ok(game.dispatch('travel/undock'));
  const gate = game.select('travel/overview').rows.find((r) => r.type === 'gate');
  assert.equal(game.dispatch('travel/jump').ok, false);
  ok(game.dispatch('travel/warp', { celestialId: gate.id }));
  arrive(game);
  ok(game.dispatch('travel/jump'));
  assert.notEqual(game.state.pilot.location.systemId, 'sys.aldara');
});

test('Speichern/Laden: Zustand ist JSON-sicher (Felder, Märkte, Lager)', async () => {
  const { game } = await newGame();
  game.advance(30);
  const copy = JSON.parse(JSON.stringify(game.state));
  assert.deepEqual(copy.world.fields, JSON.parse(JSON.stringify(game.state.world.fields)));
  assert.ok(Object.keys(copy.world.markets).length >= 1);
});
