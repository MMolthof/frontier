import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtIsk, fmtTicks, createTranslator } from '../js/util/format.js';
import { clamp, lerp, polarDistance } from '../js/util/math.js';

test('fmt nutzt de-DE und Nachkommastellen', () => {
  assert.equal(fmt(1234567), '1.234.567');
  assert.equal(fmt(1234.5, 1), '1.234,5');
  assert.equal(fmt(NaN), '–');
  assert.equal(fmtIsk(10000.4), '10.000 ISK');
});

test('fmtTicks: 1 Tick = 1 Minute', () => {
  assert.equal(fmtTicks(0), '0 min');
  assert.equal(fmtTicks(125), '2 h 5 min');
  assert.equal(fmtTicks(1440), '1 d');
  assert.equal(fmtTicks(1440 + 61), '1 d 1 h 1 min');
});

test('createTranslator: flach, strings-Wrapper, Platzhalter, Rückfall auf Schlüssel', () => {
  const t = createTranslator({ strings: { 'a.b': 'Hallo {name}' } });
  assert.equal(t('a.b', { name: 'Welt' }), 'Hallo Welt');
  assert.equal(t('fehlt.x'), 'fehlt.x');
  assert.equal(createTranslator({ 'x.y': 'Z' })('x.y'), 'Z');
});

test('math: clamp, lerp, polarDistance', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(lerp(0, 10, 0.25), 2.5);
  assert.equal(polarDistance({ au: 0, angleDeg: 0 }, { au: 2.4, angleDeg: 120 }), 2.4);
  assert.ok(Math.abs(polarDistance({ au: 1, angleDeg: 0 }, { au: 1, angleDeg: 180 }) - 2) < 1e-9);
  assert.ok(Math.abs(polarDistance({ au: 1, angleDeg: 0 }, { au: 1, angleDeg: 0 })) < 1e-9);
});
