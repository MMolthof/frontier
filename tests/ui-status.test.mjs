import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUiEnv } from './mocks/ui-env.mjs';
import { deriveActivity, securityBand, describeLocation } from '../js/ui/shell/status.js';

test('Status: Aktivität nach Priorität, Sicherheitsband, Standort', () => {
  const env = createUiEnv();
  const { state, data } = env.game;
  assert.equal(deriveActivity(state, data).kind, 'docked');
  state.mining.sessions = [{}];
  assert.equal(deriveActivity(state, data).kind, 'mining');
  state.pilot.warp = { fromId: 'cel.aldara.p1', toId: 'cel.aldara.belt1', ticksLeft: 3, ticksTotal: 10 };
  const warp = deriveActivity(state, data);
  assert.equal(warp.kind, 'warp');
  assert.equal(warp.target, 'Aldara – Gürtel 1');
  state.pilot.warp = null; state.mining.sessions = []; state.pilot.location.dockedStationId = null;
  assert.equal(deriveActivity(state, data).kind, 'space');
  assert.deepEqual([securityBand(1), securityBand(0.8), securityBand(0.5), securityBand(0.4), securityBand(0)], ['high', 'high', 'mid', 'low', 'low']);
  assert.equal(describeLocation(state, data).system, 'Aldara');
});

