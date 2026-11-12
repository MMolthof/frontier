import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createAppServer } from '../tools/serve.mjs';
import { createFetchReader, loadData } from '../js/core/data-loader.js';
import { loadRegistry } from '../js/core/registry.js';
import { REPO_ROOT } from './harness.js';

let server, base;
const extFile = join(REPO_ROOT, 'data', 'ext', 'a1-servetest.json');

before(async () => {
  writeFileSync(extFile, JSON.stringify({ schema: 1, entries: [{ id: 'item.servetest', name: 'Test', volumeM3: 1, basePrice: 1, kind: 'misc' }] }));
  server = createAppServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
});
after(() => { server.close(); rmSync(extFile, { force: true }); });

test('index.html, JSON und Module werden mit passenden MIME-Typen ausgeliefert', async () => {
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
  const js = await fetch(`${base}js/core/game.js`);
  assert.match(js.headers.get('content-type'), /text\/javascript/);
  assert.equal((await fetch(`${base}nicht/da.js`)).status, 404);
});

test('Pfad-Traversal wird abgewiesen', async () => {
  const res = await fetch(`${base}..%2F..%2Fetc%2Fpasswd`);
  assert.ok([403, 404].includes(res.status));
});

test('Fetch-Reader + Server: loadData inkl. dynamischem data/ext/index.json und Registry', async () => {
  const reader = createFetchReader(base);
  const { data } = await loadData(reader, { onWarn: () => {} });
  assert.equal(data.balance.startShip, 'ship.pebble');
  assert.ok(data.items['item.servetest'], 'ext-Datei wurde über /data/ext/index.json gefunden');
  const reg = await loadRegistry(reader, { onWarn: () => {} });
  assert.deepEqual(reg.systems.map((s) => s.id), ['core-demo']);
});
