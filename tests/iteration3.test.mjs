// Iteration 3a (Lead): Energiespeicher (Cap) des Piloten, Notbetrieb „Civilian Mode“, Warpkosten.
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
const ok = (res) => assert.equal(res.ok, true, res.message);
const row = (game, type) => game.select('travel/overview').rows.find((r) => r.type === type);
function flyTo(game, type) {
  ok(game.dispatch('travel/warp', { celestialId: row(game, type).id }));
  const pctAfterDispatch = game.state.pilot.cap.pct;
  game.advance(400);
  return pctAfterDispatch;
}
/** Gekauften Bergbaulaser I zusätzlich zum Zivilier-Laser einbauen (verbraucht Cap). */
function proMiner(game) {
  game.state.account.isk = 1e9;
  game.state.pilot.skills['skill.mining'] = { level: 5 };
  ok(game.dispatch('shop/buyModule', { moduleId: 'mod.miner_1' }));
  ok(game.dispatch('fitting/equip', { uid: 'u1', slot: 'high', index: 2, moduleId: 'mod.miner_1' })); // dritter Turret-Platz
}

test('Cap startet bei 100 % und gehört zum Piloten', async () => {
  const game = await newGame();
  const st = game.select('cap/status');
  assert.equal(st.pct, 100);
  assert.equal(st.mode, 'full');
  assert.equal(game.state.pilot.cap.pct, 100);
});

test('Bergbau mit richtigem Laser verbraucht Cap; leer = Civilian Mode mit schwächerem Ertrag', async () => {
  const game = await newGame();
  proMiner(game);
  ok(game.dispatch('travel/undock'));
  assert.ok(flyTo(game, 'belt') < 100, 'Warp kostet Cap');
  const full = game.select('mining/field').lasers;
  const pctAfterWarp = game.state.pilot.cap.pct;
  ok(game.dispatch('mining/start'));
  game.advance(50);
  assert.ok(game.state.pilot.cap.pct < pctAfterWarp, 'Abbau verbraucht Cap');
  game.state.pilot.cap.pct = 0.05;
  game.advance(5);
  const st = game.select('cap/status');
  assert.equal(st.civilian, true);
  assert.equal(st.mode, 'civilian');
  const info = game.select('mining/field');
  assert.equal(full, 2);
  assert.equal(info.lasers, 1, 'im Notbetrieb arbeitet nur der Zivilier-Laser');
  const hold = () => Object.values(game.state.assets.ships[0].oreHold ?? {}).reduce((a, b) => a + b, 0);
  const before = hold();
  game.advance(20);
  assert.ok(hold() > before, 'Notbetrieb baut weiter ab (langsam)');
});

test('Notbetrieb endet erst bei resumePct', async () => {
  const game = await newGame();
  game.state.pilot.cap = { pct: 24.99, civilian: true };
  game.advance(1);
  assert.equal(game.state.pilot.cap.civilian, false, 'über 25 % wieder volle Leistung');
  game.state.pilot.cap = { pct: 10, civilian: true };
  game.advance(1);
  assert.equal(game.state.pilot.cap.civilian, true);
});

test('Notbetrieb: nur Notflug zu Stationen, keine Tor-Sprünge', async () => {
  const game = await newGame();
  ok(game.dispatch('travel/undock'));
  flyTo(game, 'gate');
  game.state.pilot.cap = { pct: 0, civilian: true };
  assert.equal(game.dispatch('travel/jump').error, 'cap.civilian_jump');
  const warpBelt = game.dispatch('travel/warp', { celestialId: row(game, 'belt').id });
  assert.equal(warpBelt.ok, false);
  assert.equal(warpBelt.error, 'cap.civilian_warp');
  ok(game.dispatch('travel/warp', { celestialId: row(game, 'station').id }));
  game.advance(400);
  assert.equal(game.state.pilot.location.celestialId, row(game, 'station').id);
});

test('Schiffswechsel füllt den Cap nicht auf', async () => {
  const game = await newGame();
  game.state.account.isk = 1e9;
  game.state.pilot.cap = { pct: 12, civilian: false };
  game.state.pilot.skills['skill.spaceship_command'] = { level: 3 };
  const mule = game.data.lists.ships.find((s) => s.price > 0 && s.requires && Object.keys(s.requires).length === 1);
  if (mule) { game.dispatch('ships/buy', { typeId: mule.id }); game.dispatch('ships/board', { uid: game.state.assets.ships.at(-1).uid }); }
  assert.ok(game.state.pilot.cap.pct <= 12.5, 'Prozent bleibt beim Piloten');
});

test('Angedockt lädt der Cap schneller auf', async () => {
  const game = await newGame();
  game.state.pilot.cap = { pct: 50, civilian: false };
  game.advance(100);
  const docked = game.state.pilot.cap.pct - 50;
  ok(game.dispatch('travel/undock'));
  game.state.pilot.cap = { pct: 50, civilian: false };
  game.advance(100);
  const space = game.state.pilot.cap.pct - 50;
  assert.ok(docked > space * 1.5, `angedockt ${docked} vs All ${space}`);
});

test('Alter Spielstand mit fehlenden Slot-Listen wird repariert und lässt sich ausrüsten', async () => {
  const reader = createFsReader(REPO_ROOT);
  const { data } = await loadData(reader, { onWarn() {} });
  const registry = await loadRegistry(reader, { onWarn() {} });
  const first = createGame({ data, systems: registry.systems, now: () => 0, onWarn() {} });
  const saved = JSON.parse(JSON.stringify(first.state));
  saved.assets.ships[0].fitting = { high: [], mid: [], low: [], rig: [] };
  saved.flags.starterLoadout = true;
  saved.assets.stations[saved.pilot.location.dockedStationId].items = { 'mod.civilian_miner': 1, 'mod.civilian_gun': 1 };
  const game = createGame({ data, systems: registry.systems, now: () => 0, onWarn() {}, state: saved });
  assert.deepEqual(game.state.assets.ships[0].fitting.high, [null, null, null]);
  ok(game.dispatch('fitting/equip', { uid: 'u1', slot: 'high', index: 0, moduleId: 'mod.civilian_miner' }));
  ok(game.dispatch('fitting/equip', { uid: 'u1', slot: 'high', index: 1, moduleId: 'mod.civilian_gun' }));
  const noKeys = JSON.parse(JSON.stringify(first.state));
  noKeys.assets.ships[0].fitting = {};
  const g2 = createGame({ data, systems: registry.systems, now: () => 0, onWarn() {}, state: noKeys });
  assert.equal(g2.state.assets.ships[0].fitting.rig.length, 2);
});
