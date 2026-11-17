import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRng, createStateRng, seedToState } from '../js/core/rng.js';

test('gleicher Seed → gleiche Folge, anderer Seed → andere', () => {
  const a = createSeededRng(7), b = createSeededRng(7), c = createSeededRng(8);
  const sa = Array.from({ length: 5 }, () => a.float());
  assert.deepEqual(sa, Array.from({ length: 5 }, () => b.float()));
  assert.notDeepEqual(sa, Array.from({ length: 5 }, () => c.float()));
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test('State-RNG setzt den Strom nach JSON-Roundtrip exakt fort', () => {
  const state = { rngState: seedToState(42) };
  const rng = createStateRng(state);
  rng.float(); rng.float();
  const copy = JSON.parse(JSON.stringify(state));
  assert.equal(createStateRng(copy).float(), rng.float());
});

test('int, chance, pick, weighted, shuffle', () => {
  const rng = createSeededRng(1);
  for (let i = 0; i < 200; i++) {
    const v = rng.int(3, 5);
    assert.ok(v >= 3 && v <= 5 && Number.isInteger(v));
  }
  assert.equal(rng.chance(0), false);
  assert.equal(rng.chance(1), true);
  assert.ok(['a', 'b'].includes(rng.pick(['a', 'b'])));
  assert.equal(rng.weighted({ x: 0, y: 5 }), 'y');
  assert.equal(rng.weighted({}), null);
  assert.deepEqual(rng.shuffle([1, 2, 3, 4]).sort(), [1, 2, 3, 4]);
});

test('weighted folgt grob den Gewichten', () => {
  const rng = createSeededRng(3);
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 4000; i++) counts[rng.weighted({ a: 75, b: 25 })]++;
  assert.ok(counts.a > 2700 && counts.a < 3300, `a=${counts.a}`);
});
