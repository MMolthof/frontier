import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter, createSaveManager, parseSave, serializeSave, SaveError, SAVE_FORMAT } from '../js/core/save.js';
import { createTestGame, createTestData, createFakeClock } from './harness.js';
import { createGame } from '../js/core/game.js';
import { system as demo } from '../js/core/demo-system.js';
import { STATE_VERSION } from '../js/core/state.js';

test('Roundtrip: speichern, laden, weiterspielen identisch', () => {
  const game = createTestGame({ systems: [demo], saves: true });
  game.advance(30);
  game.dispatch('game/save');
  const loaded = game.saves.load();
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(game.state)));
  const again = createTestGame({ systems: [demo], state: loaded });
  again.advance(5); game.advance(5);
  assert.deepEqual(again.state, game.state);
});

test('load ohne Spielstand → null', () => {
  assert.equal(createSaveManager(createMemoryAdapter()).load(), null);
});

test('Fehlerfälle: kaputtes JSON, falsches Format, zu neue Version', () => {
  const code = (text) => { try { parseSave(text); } catch (e) { return e instanceof SaveError ? e.code : 'other'; } return 'none'; };
  assert.equal(code('{nope'), 'save.corrupt');
  assert.equal(code('{"format":"x","state":{}}'), 'save.bad_format');
  assert.equal(code(JSON.stringify({ format: SAVE_FORMAT, state: { version: STATE_VERSION + 5 } })), 'save.version_future');
  assert.equal(code(JSON.stringify({ format: SAVE_FORMAT, state: { foo: 1 } })), 'save.invalid');
});

test('Export/Import: importJson prüft und legt den Stand im Speicher ab', () => {
  const game = createTestGame({ systems: [demo], saves: true });
  game.advance(7);
  const text = game.saves.exportJson(game.state);
  const other = createSaveManager(createMemoryAdapter());
  const state = other.importJson(text);
  assert.equal(state.tick, 7);
  assert.equal(other.load().tick, 7);
  assert.throws(() => other.importJson('{}'), SaveError);
  assert.equal(JSON.parse(serializeSave(state)).format, SAVE_FORMAT);
});

test('Speicherfehler (Quota) werden von game.save als Result gemeldet', () => {
  const broken = createSaveManager({ get: () => null, set: () => { throw new Error('quota'); }, remove: () => {} });
  const clock = createFakeClock();
  const game = createGame({ data: createTestData().data, systems: [demo], saves: broken, now: clock.now });
  const res = game.save();
  assert.equal(res.ok, false);
  assert.equal(res.error, 'core.save_failed');
  assert.match(res.message, /quota/);
});
