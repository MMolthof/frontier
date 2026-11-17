import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, migrateState, STATE_VERSION, StateError } from '../js/core/state.js';
import { createTestData } from './harness.js';

const { data } = createTestData();

test('Startzustand folgt balance.json (ISK, Skills, Schiff, Station, Attribute)', () => {
  const s = createInitialState(data, 99);
  assert.equal(s.version, STATE_VERSION);
  assert.equal(s.seed, 99);
  assert.equal(s.account.isk, 10000);
  assert.equal(s.pilot.location.dockedStationId, 'cel.aldara.p1.station');
  assert.equal(s.pilot.location.systemId, 'sys.aldara');
  assert.deepEqual(s.pilot.attributes, { intelligence: 20, memory: 20, perception: 20, willpower: 20, charisma: 19 });
  assert.equal(s.pilot.skills['skill.mining'].level, 1);
  assert.equal(s.pilot.skills['skill.mining'].sp, 250);
  assert.equal(s.pilot.skills['skill.mining_frigate'].sp, 500); // Rank 2
  const ship = s.assets.ships[0];
  assert.equal(ship.typeId, 'ship.pebble');
  assert.deepEqual(ship.fitting.high, [null, null, null]);
  assert.equal(ship.fitting.rig.length, 2);
  assert.deepEqual(ship.damage, { shield: 520, armor: 380, structure: 420 });
  assert.deepEqual(s.assets.stations['cel.aldara.p1.station'], { items: {} });
});

test('optional balance.startFitting rüstet das Starterschiff vor', () => {
  const custom = { ...data, balance: { ...data.balance, startFitting: { high: ['mod.miner_1', 'mod.miner_1'] } } };
  assert.deepEqual(createInitialState(custom).assets.ships[0].fitting.high, ['mod.miner_1', 'mod.miner_1', null]);
});

test('Zustand ist JSON-sicher (Roundtrip identisch)', () => {
  const s = createInitialState(data, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('migrateState: gültig, ungültig, zu neu, fehlende Migration', () => {
  const s = createInitialState(data);
  assert.equal(migrateState(s), s);
  assert.throws(() => migrateState(null), (e) => e instanceof StateError && e.code === 'state.invalid');
  assert.throws(() => migrateState({ version: STATE_VERSION + 1 }), (e) => e.code === 'state.version_future');
  assert.throws(() => migrateState({ version: 0 }), (e) => e.code === 'state.no_migration');
});
