import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestGame, createFakeClock } from './harness.js';
import { system as demo } from '../js/core/demo-system.js';

test('dispatch: Erfolg, Fehler mit Code, unbekannte Action, Ausnahme wird zu Fehlerresult', () => {
  const boom = { id: 'boom', actions: { 'boom/go': () => { throw new Error('kaputt'); } } };
  const game = createTestGame({ systems: [demo, boom] });
  assert.deepEqual(game.dispatch('demo/ping'), { ok: true, pong: true });
  assert.deepEqual(game.dispatch('demo/fail'), { ok: false, error: 'demo.always_fails', message: 'Absichtlicher Testfehler.' });
  assert.equal(game.dispatch('nix/nix').error, 'core.unknown_action');
  const res = game.dispatch('boom/go');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'core.action_failed');
  assert.ok(game.warnings.some((w) => /boom\/go/.test(w)));
});

test('Ticks laufen in Registry-Reihenfolge, core/ticked wird je Tick emittiert', () => {
  const order = [];
  const a = { id: 'a', onTick: (c) => order.push(`a${c.tick}`) };
  const b = { id: 'b', onTick: (c) => order.push(`b${c.tick}`) };
  const game = createTestGame({ systems: [a, b] });
  const ticks = [];
  game.on('core/ticked', (p) => ticks.push(p.tick));
  game.advance(2);
  assert.deepEqual(order, ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(ticks, [1, 2]);
  assert.equal(game.select('core/tick'), 2);
});

test('Fehler in onTick/init eines Systems stoppen die Schleife nicht', () => {
  const bad = { id: 'bad', init() { throw new Error('init'); }, onTick() { throw new Error('tick'); } };
  const game = createTestGame({ systems: [bad, demo] });
  game.advance(3);
  assert.equal(game.select('demo/ticks'), 3);
  assert.equal(game.warnings.filter((w) => /bad\./.test(w)).length, 4);
});

test('select: Systeme, Cross-Select im Selektor, unbekannter Selektor → undefined + Warnung', () => {
  const sys = { id: 's', selectors: { 's/double': (state, data, args, select) => select('demo/ticks') * 2 } };
  const game = createTestGame({ systems: [demo, sys] });
  game.advance(4);
  assert.equal(game.select('s/double'), 8);
  assert.equal(game.select('gibt/es/nicht'), undefined);
  assert.equal(game.warnings.filter((w) => /gibt\/es\/nicht/.test(w)).length, 1);
  game.select('gibt/es/nicht');
  assert.equal(game.warnings.filter((w) => /gibt\/es\/nicht/.test(w)).length, 1); // nur einmal
  assert.equal(game.hasSelector('demo/ticks'), true);
  assert.equal(game.hasAction('demo/ping'), true);
});

test('ctx: emit, select, log, rng, offline-Flag; Systemfehler bei doppelten IDs/Actions', () => {
  const seen = [];
  const sys = {
    id: 'ctxsys',
    actions: { 'ctxsys/run': (ctx) => { ctx.emit('ctxsys/ran', { r: ctx.rng.int(1, 6) }); ctx.log('lief', 'info'); return { ok: true, offline: ctx.offline }; } }
  };
  const dup = { id: 'ctxsys', actions: {} };
  const dupAction = { id: 'other', actions: { 'ctxsys/run': () => ({ ok: true }) } };
  const game = createTestGame({ systems: [sys, dup, dupAction] });
  game.on('ctxsys/ran', (p) => seen.push(p.r));
  const res = game.dispatch('ctxsys/run');
  assert.equal(res.offline, false);
  assert.equal(seen.length, 1);
  assert.ok(seen[0] >= 1 && seen[0] <= 6);
  assert.equal(game.select('core/log')[0].text, 'lief');
  assert.ok(game.warnings.some((w) => /Doppeltes System ctxsys/.test(w)));
  assert.ok(game.warnings.some((w) => /Doppelte Action ctxsys\/run/.test(w)));
});

test('subscribe: nach Tick-Block und erfolgreicher Action, nicht nach Fehler; unsubscribe', () => {
  const game = createTestGame({ systems: [demo] });
  let n = 0;
  const off = game.subscribe(() => n++);
  game.advance(5);
  assert.equal(n, 1);
  game.dispatch('demo/ping');
  assert.equal(n, 2);
  game.dispatch('demo/fail');
  assert.equal(n, 2);
  off();
  game.dispatch('demo/ping');
  assert.equal(n, 2);
});

test('Determinismus: gleicher Seed → identischer Zustand, auch über Save/Load-Grenze', () => {
  const roller = { id: 'roller', init: (c) => { c.state.rolls ??= []; }, onTick: (c) => c.state.rolls.push(c.rng.int(1, 1000)) };
  const run = (seed) => { const g = createTestGame({ systems: [roller], seed }); g.advance(50); return g; };
  assert.deepEqual(run(7).state, run(7).state);
  assert.notDeepEqual(run(7).state.rolls, run(8).state.rolls);

  const full = run(7); full.advance(50);
  const half = run(7);
  const reloaded = createTestGame({ systems: [roller], state: JSON.parse(JSON.stringify(half.state)), seed: 7 });
  reloaded.advance(50);
  assert.deepEqual(reloaded.state.rolls, full.state.rolls);
});

test('game/setSpeed validiert gegen erlaubte Geschwindigkeiten; game/new und game/reset', () => {
  const game = createTestGame({ systems: [demo], saves: true });
  assert.equal(game.dispatch('game/setSpeed', { scale: 5 }).ok, true);
  assert.equal(game.select('core/speed'), 5);
  assert.equal(game.dispatch('game/setSpeed', { scale: 7 }).error, 'core.bad_speed');
  assert.deepEqual(game.select('core/speeds'), [0, 1, 5, 20]);

  game.advance(3);
  game.dispatch('game/save');
  assert.equal(game.saves.exists(), true);
  game.dispatch('game/new', { seed: 5 });
  assert.equal(game.state.tick, 0);
  assert.equal(game.state.seed, 5);
  assert.equal(game.select('demo/ticks'), 0); // init lief erneut
  game.dispatch('game/reset');
  assert.equal(game.saves.exists(), false);
});

test('game/save ohne Speicher → core.no_storage; core/loaded wird emittiert', () => {
  const game = createTestGame({ systems: [demo] });
  assert.equal(game.dispatch('game/save').error, 'core.no_storage');
  const loaded = [];
  game.on('core/loaded', (p) => loaded.push(p));
  game.dispatch('game/new');
  assert.deepEqual(loaded, [{ fresh: true, tick: 0 }]);
});

test('Protokoll wird auf balance.logMax begrenzt', () => {
  const game = createTestGame({ systems: [{ id: 'l', onTick: (c) => c.log(`t${c.tick}`) }] });
  const max = game.data.balance.logMax ?? 200;
  game.advance(max + 50);
  assert.equal(game.state.log.length, max);
  assert.equal(game.select('core/log', { limit: 1 })[0].text, `t${max + 50}`);
});

test('Fake-Uhr fließt in ctx.now ein', () => {
  const clock = createFakeClock(5000);
  let seen = null;
  const game = createTestGame({ clock, systems: [{ id: 'n', onTick: (c) => { seen = c.now; } }] });
  game.advance(1);
  assert.equal(seen, 5000);
});
