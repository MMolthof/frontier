import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestGame, createFakeClock } from './harness.js';
import { system as demo } from '../js/core/demo-system.js';
import { catchUp, createTickLoop, baseTickMs } from '../js/core/tick.js';

const TICK = 60_000;

test('baseTickMs: tickSeconds, optional liveTickMs überschreibt', () => {
  assert.equal(baseTickMs({ balance: { tickSeconds: 60 } }), 60_000);
  assert.equal(baseTickMs({ balance: { tickSeconds: 60, liveTickMs: 3000 } }), 3000);
});

test('Schleife: 1x, 5x, 20x und Pause (pump ohne Timer)', () => {
  const clock = createFakeClock(0);
  const game = createTestGame({ systems: [demo], clock });
  const loop = createTickLoop({ game, now: clock.now });

  assert.equal(loop.pump(clock.advance(TICK)), 1);               // 1x
  game.dispatch('game/setSpeed', { scale: 5 });
  assert.equal(loop.pump(clock.advance(TICK)), 5);               // 5x
  game.dispatch('game/setSpeed', { scale: 20 });
  assert.equal(loop.pump(clock.advance(TICK)), 20);              // 20x
  game.dispatch('game/setSpeed', { scale: 0 });
  assert.equal(loop.pump(clock.advance(10 * TICK)), 0);          // Pause
  assert.equal(game.select('demo/ticks'), 26);
  assert.equal(game.state.lastRealTime, clock.now());
});

test('Schleife sammelt Bruchteile über mehrere Pumps', () => {
  const clock = createFakeClock(0);
  const game = createTestGame({ systems: [demo], clock });
  const loop = createTickLoop({ game, now: clock.now });
  game.dispatch('game/setSpeed', { scale: 20 });
  let ran = 0;
  for (let i = 0; i < 12; i++) ran += loop.pump(clock.advance(250)); // 12 × 250 ms = 3 s
  assert.equal(ran, 1); // 3000 ms × 20 / 60000 ms = 1 Tick (Bruchteile werden gesammelt)
});

test('start/stop nutzen injizierte Timer', () => {
  const clock = createFakeClock(0);
  const game = createTestGame({ systems: [demo], clock });
  let cb = null, cleared = false;
  const timers = { setInterval: (fn) => { cb = fn; return 1; }, clearInterval: () => { cleared = true; } };
  const loop = createTickLoop({ game, now: clock.now, timers });
  loop.start(); loop.start();
  assert.equal(loop.running, true);
  clock.advance(TICK); cb();
  assert.equal(game.select('demo/ticks'), 1);
  loop.stop();
  assert.equal(cleared, true);
  assert.equal(loop.running, false);
});

test('Offline-Nachholen: verstrichene Ticks, Protokoll, lastRealTime', () => {
  const clock = createFakeClock(0);
  const game = createTestGame({ systems: [demo], clock });
  game.state.lastRealTime = 1;
  const res = catchUp(game, 1 + 1000 * TICK + 5);
  assert.deepEqual(res, { ticks: 1000, elapsedTicks: 1000, capped: false });
  assert.equal(game.select('demo/ticks'), 1000);
  assert.equal(game.state.lastRealTime, 1 + 1000 * TICK + 5);
  assert.match(game.select('core/log')[0].text, /1\.000|1000 Ticks/);
});

test('Offline-Nachholen ist auf balance.offlineMaxTicks (10.080) begrenzt', () => {
  const game = createTestGame({ systems: [demo] });
  game.state.lastRealTime = 1;
  const res = catchUp(game, 1 + 20000 * TICK);
  assert.equal(res.ticks, 10080);
  assert.equal(res.capped, true);
  assert.equal(game.state.tick, 10080);
});

test('Nachholen läuft mit offline-Flag und ohne UI-Spam bei neuem Spiel', () => {
  const flags = [];
  const game = createTestGame({ systems: [{ id: 'f', onTick: (c) => flags.push(c.offline) }] });
  assert.deepEqual(catchUp(game, 5000), { ticks: 0, elapsedTicks: 0, capped: false }); // lastRealTime war 0
  game.state.lastRealTime = 1;
  catchUp(game, 1 + 3 * TICK);
  assert.deepEqual(flags, [true, true, true]);
  assert.equal(game.select('core/isCatchingUp'), false);
});

test('Performance: 1.000 Ticks im Zeitraffer unter 2 s', () => {
  const game = createTestGame({ systems: [demo] });
  const t0 = performance.now();
  game.advance(1000);
  assert.ok(performance.now() - t0 < 2000);
});
