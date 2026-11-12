import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry } from '../js/core/registry.js';
import { createMemoryReader, createFsReader } from '../js/core/data-loader.js';
import { REPO_ROOT } from './harness.js';

const modules = {
  'systems/a.js': { system: { id: 'a' } },
  'systems/b.js': { system: { id: 'b' } },
  'systems/wrongid.js': { system: { id: 'anders' } },
  'ui/v.js': { view: { id: 'v' } }
};
const importer = async (path) => { if (!(path in modules)) throw new Error('Cannot find module'); return modules[path]; };

test('sortiert nach order, überspringt fehlende/falsche Module mit Warnung', async () => {
  const reader = createMemoryReader({
    'js/registry.json': {
      systems: [
        { id: 'b', path: 'systems/b.js', order: 20 },
        { id: 'a', path: 'systems/a.js', order: 10 },
        { id: 'missing', path: 'systems/missing.js', order: 5 },
        { id: 'wrong', path: 'systems/wrongid.js', order: 6 },
        { id: 'a', path: 'systems/a.js', order: 11 },
        { path: 'kaputt' }
      ],
      views: [{ id: 'v', path: 'ui/v.js', order: 1 }]
    }
  });
  const warns = [];
  const res = await loadRegistry(reader, { importer, onWarn: (m) => warns.push(m) });
  assert.deepEqual(res.systems.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(res.views.map((v) => v.id), ['v']);
  assert.equal(warns.length, 4);
  assert.match(warns.join('\n'), /missing.*nicht ladbar/);
  assert.match(warns.join('\n'), /exportiert kein system/);
  assert.match(warns.join('\n'), /doppelte system-id a/);
});

test('fehlende registry.json → leere Registry mit Warnung, kein Absturz', async () => {
  const res = await loadRegistry(createMemoryReader({}), { importer, onWarn: () => {} });
  assert.deepEqual([res.systems, res.views], [[], []]);
  assert.equal(res.warnings.length, 1);
});

test('echte js/registry.json lädt mit dem Standard-Importer (core-demo)', async () => {
  const res = await loadRegistry(createFsReader(REPO_ROOT), { onWarn: () => {} });
  assert.deepEqual(res.systems.map((s) => s.id), ['core-demo']);
});
