import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmitter } from '../js/core/events.js';

test('on/emit/off und Rückgabe-Abmelder', () => {
  const bus = createEmitter();
  const got = [];
  const off = bus.on('x/y', (p) => got.push(p.n));
  bus.emit('x/y', { n: 1 });
  off();
  bus.emit('x/y', { n: 2 });
  assert.deepEqual(got, [1]);
});

test('Wildcard bekommt Typ und Payload; Fehler in Handlern brechen nichts ab', () => {
  const errors = [];
  const bus = createEmitter({ onError: (e) => errors.push(e.message) });
  const seen = [];
  bus.on('*', (type, p) => seen.push([type, p.v]));
  bus.on('a/b', () => { throw new Error('boom'); });
  bus.on('a/b', (p) => seen.push(['second', p.v]));
  bus.emit('a/b', { v: 9 });
  assert.deepEqual(errors, ['boom']);
  assert.deepEqual(seen, [['second', 9], ['a/b', 9]]);
});

test('Handler darf sich während emit abmelden', () => {
  const bus = createEmitter();
  let calls = 0;
  const off = bus.on('t', () => { calls++; off(); });
  bus.emit('t'); bus.emit('t');
  assert.equal(calls, 1);
});
