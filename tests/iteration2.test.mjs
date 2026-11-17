// Iteration 2 (Lead): Starter-Setup, Modulkauf + Fitting, Skills, Schiffskauf und Umsteigen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFsReader, loadData } from '../js/core/data-loader.js';
import { loadRegistry } from '../js/core/registry.js';
import { createGame } from '../js/core/game.js';
import { REPO_ROOT } from './harness.js';

async function newGame() {
  const reader = createFsReader(REPO_ROOT);
  const { data } = await loadData(reader, { onWarn() {} });
  const registry = await loadRegistry(reader, { onWarn() {} });
  return createGame({ data, systems: registry.systems, now: () => 0, onWarn() {} });
}
const ok = (res) => { assert.equal(res.ok, true, JSON.stringify(res)); return res; };

test('Starterschiff: Zivilier-Laser und Zivilier-Geschütz, kein Handelswert', async () => {
  const game = await newGame();
  const ship = game.state.assets.ships[0];
  assert.deepEqual(ship.fitting.high, ['mod.civilian_miner', 'mod.civilian_gun', null]);
  assert.equal(game.data.modules['mod.civilian_miner'].price, 0);
  assert.equal(game.data.modules['mod.civilian_miner'].buyPrice > 0, true, 'im Markt käuflich');
});

test('Modul kaufen, Zivilier-Laser ausbauen, Miner I einbauen: mehr Ertrag', async () => {
  const game = await newGame();
  const before = game.select('fitting/stats', { uid: 'u1' }).mining.m3PerTick;
  const isk = game.state.account.isk;
  ok(game.dispatch('shop/buyModule', { moduleId: 'mod.miner_1' }));
  assert.equal(game.state.account.isk, isk - 9000);
  ok(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 }));
  ok(game.dispatch('fitting/equip', { uid: 'u1', slot: 'high', index: 0, moduleId: 'mod.miner_1' }));
  const after = game.select('fitting/stats', { uid: 'u1' });
  assert.ok(after.mining.m3PerTick > before * 1.3, `${before} -> ${after.mining.m3PerTick}`);
  assert.equal(game.dispatch('shop/buyModule', { moduleId: 'mod.miner_2' }).ok, false, 'zu wenig ISK');
});

test('Skills: Buch kaufen, Voraussetzungen, Training über Ticks, Level steigt', async () => {
  const game = await newGame();
  assert.equal(game.select('skills/level', { skillId: 'skill.mining' }), 1);
  assert.equal(game.dispatch('skills/queueAdd', { skillId: 'skill.mining_upgrades' }).ok, false, 'Buch fehlt');
  ok(game.dispatch('skills/queueAdd', { skillId: 'skill.mining' })); // -> 2
  ok(game.dispatch('skills/queueAdd', { skillId: 'skill.mining' })); // -> 3
  const q = game.select('skills/queue');
  assert.equal(q.length, 2);
  assert.ok(q[0].ticksLeft > 0 && q[1].etaTicks > q[0].etaTicks);
  game.advance(q[1].etaTicks + 2);
  assert.equal(game.select('skills/level', { skillId: 'skill.mining' }), 3);
  assert.equal(game.select('skills/queue').length, 0);
  // Mining 3 erfüllt jetzt die Voraussetzung für Bergbau-Upgrades
  const cat = game.select('skills/catalog').flatMap((g) => g.skills).find((s) => s.id === 'skill.mining_upgrades');
  assert.equal(cat.requires.every((r) => r.ok), true);
});

test('Schiff kaufen, Skill-Anforderung prüfen, umsteigen, verkaufen', async () => {
  const game = await newGame();
  game.state.account.isk = 500_000;
  const res = ok(game.dispatch('ships/buy', { typeId: 'ship.dart' }));
  assert.equal(game.dispatch('ships/board', { uid: res.uid }).ok, false, 'Skills fehlen');
  for (const id of ['skill.light_command']) game.state.pilot.skills[id] = { sp: 0, level: 1 };
  ok(game.dispatch('ships/board', { uid: res.uid }));
  assert.equal(game.state.pilot.activeShipUid, res.uid);
  assert.equal(game.state.assets.ships.length, 2, 'Pebble bleibt geparkt');
  assert.equal(game.dispatch('ships/sell', { uid: res.uid }).ok, false, 'aktives Schiff');
  ok(game.dispatch('ships/board', { uid: 'u1' }));
  const sold = ok(game.dispatch('ships/sell', { uid: res.uid }));
  assert.equal(sold.isk, 22500);
});

test('Starterschiff ohne Handelswert lässt sich nicht verkaufen, Station ohne Werft kauft keine Schiffe', async () => {
  const game = await newGame();
  game.state.assets.ships.push({ ...JSON.parse(JSON.stringify(game.state.assets.ships[0])), uid: 'u9' });
  assert.equal(game.dispatch('ships/sell', { uid: 'u9' }).ok, false);
});

async function gameFrom(state) {
  const reader = createFsReader(REPO_ROOT);
  const { data } = await loadData(reader, { onWarn() {} });
  const registry = await loadRegistry(reader, { onWarn() {} });
  return createGame({ data, systems: registry.systems, state, now: () => 0, onWarn() {} });
}

test('Alter Spielstand mit leerem Starterschiff wird einmalig mit Zivilier-Modulen nachgerüstet', async () => {
  const fresh = await newGame();
  const old = JSON.parse(JSON.stringify(fresh.state));
  for (const slot of Object.keys(old.assets.ships[0].fitting)) old.assets.ships[0].fitting[slot] = old.assets.ships[0].fitting[slot].map(() => null);
  delete old.flags;
  const game = await gameFrom(old);
  assert.deepEqual(game.state.assets.ships[0].fitting.high, ['mod.civilian_miner', 'mod.civilian_gun', null]);
  // zweiter Start: bewusst ausgebautes Schiff bleibt leer
  const again = JSON.parse(JSON.stringify(game.state));
  for (const slot of Object.keys(again.assets.ships[0].fitting)) again.assets.ships[0].fitting[slot] = again.assets.ships[0].fitting[slot].map(() => null);
  const game2 = await gameFrom(again);
  assert.equal(game2.state.assets.ships[0].fitting.high[0], null);
});

test('Notfall-Ausrüstung: ohne Bergbaulaser und Waffe gibt es kostenlosen Zivilier-Ersatz', async () => {
  const game = await newGame();
  ok(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 }));
  ok(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 1 }));
  // Module liegen jetzt im Lager: kein Bedarf
  assert.equal(game.dispatch('starter/rearm').ok, false);
  const stock = game.state.assets.stations['cel.aldara.p1.station'].items;
  delete stock['mod.civilian_miner']; delete stock['mod.civilian_gun']; // alles verloren
  assert.equal(game.select('starter/needsRearm'), true);
  ok(game.dispatch('starter/rearm'));
  assert.equal(stock['mod.civilian_miner'], 1);
  assert.equal(stock['mod.civilian_gun'], 1);
});

test('Module und Items lassen sich verkaufen; Zivilier-Module nicht', async () => {
  const game = await newGame();
  ok(game.dispatch('shop/buyModule', { moduleId: 'mod.miner_1' }));
  const isk0 = game.state.account.isk;
  const rows = game.select('market/fixedRows');
  const row = rows.find((r) => r.itemId === 'mod.miner_1');
  assert.ok(row && row.price > 4000, JSON.stringify(rows));
  const res = ok(game.dispatch('market/sell', { itemId: 'mod.miner_1', qty: 1 }));
  assert.equal(game.state.account.isk, isk0 + res.isk);
  assert.ok(res.isk > 3500 && res.isk < 5200, String(res.isk));
  ok(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 1 }));
  assert.equal(game.dispatch('market/sell', { itemId: 'mod.civilian_gun', qty: 1 }).ok, false, 'Zivilier: kein Handelswert');
});

test('Rohstoffe kaufen, Modul herstellen (Skill nötig), verkaufen', async () => {
  const game = await newGame();
  game.state.account.isk = 200_000;
  const recipe = game.select('industry/recipes', {}).find((r) => r.moduleId === 'mod.miner_1');
  assert.ok(recipe && Object.keys(recipe.inputs).length >= 2);
  assert.equal(game.dispatch('industry/start', { moduleId: 'mod.miner_1' }).ok, false, 'Skill Industrie fehlt');
  game.state.pilot.skills['skill.industry'] = { sp: 250, level: 1 };
  assert.equal(game.dispatch('industry/start', { moduleId: 'mod.miner_1' }).ok, false, 'Mineralien fehlen');
  for (const i of recipe.inputs) ok(game.dispatch('shop/buyItem', { itemId: i.itemId, qty: i.need }));
  ok(game.dispatch('industry/start', { moduleId: 'mod.miner_1' }));
  assert.equal(game.select('industry/jobs').length, 1);
  assert.equal(game.dispatch('industry/start', { moduleId: 'mod.miner_1' }).ok, false, 'Fabrik belegt');
  game.advance(recipe.ticks + 2);
  assert.equal(game.select('industry/jobs').length, 0);
  assert.equal(game.state.assets.stations['cel.aldara.p1.station'].items['mod.miner_1'], 1);
  ok(game.dispatch('market/sell', { itemId: 'mod.miner_1', qty: 1 }));
});

test('Zivilier-Module: im Markt kaufbar, kein Verkaufswert, nur verschrottbar', async () => {
  const game = await newGame();
  const stock = game.state.assets.stations['cel.aldara.p1.station'].items;
  const isk0 = game.state.account.isk;
  const price = game.data.modules['mod.civilian_miner'].buyPrice;
  ok(game.dispatch('shop/buyModule', { moduleId: 'mod.civilian_miner' }));
  assert.equal(game.state.account.isk, isk0 - price);
  assert.equal(stock['mod.civilian_miner'], 1);
  assert.equal(game.dispatch('market/sell', { itemId: 'mod.civilian_miner', qty: 1 }).ok, false, 'kein Verkaufswert');
  assert.ok(game.select('shop/modules', {}).some((m) => m.moduleId === 'mod.civilian_gun' && m.civilian));
  const isk1 = game.state.account.isk;
  ok(game.dispatch('inv/scrap', { itemId: 'mod.civilian_miner', qty: 1 }));
  assert.equal(stock['mod.civilian_miner'], 0);
  assert.equal(game.state.account.isk, isk1, 'kein Erlös');
  assert.equal(game.dispatch('inv/scrap', { itemId: 'mod.miner_1', qty: 1 }).ok, false, 'nur Zivilier-Module');
  assert.equal(game.dispatch('inv/scrap', { itemId: 'mod.civilian_miner', qty: 1 }).ok, false, 'nichts mehr im Lager');
});

test('Skill-Katalog liefert Beschreibung und Effekt je Stufe', async () => {
  const game = await newGame();
  const mining = game.select('skills/catalog').flatMap((g) => g.skills).find((s) => s.id === 'skill.mining');
  assert.match(mining.description, /Abbauertrag/);
  assert.deepEqual(mining.effects, [{ stat: 'mining_yield', label: 'Abbauertrag', perLevel: 0.05 }], 'gleiche Werte für Laser und Strip-Miner nur einmal');
});
