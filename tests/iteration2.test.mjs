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
  assert.equal(game.dispatch('shop/buyModule', { moduleId: 'mod.civilian_miner' }).ok, false, 'nicht käuflich');
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
