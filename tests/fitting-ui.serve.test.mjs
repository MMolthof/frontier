import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../tools/serve.mjs';

// Stellt sicher, dass dev.html und der komplette Import-Graph der Ansicht über den Projekt-Server erreichbar sind
// (ein toter Import wäre im Browser ein stiller Totalausfall) und dass das CSS/Assets-Layout stimmt.
let server, base;
before(async () => {
  server = createAppServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
});
after(() => server.close());

const importsOf = (src) => [...src.matchAll(/(?:import|from)\s*(?:[^'"]*?from\s*)?['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);

test('dev.html und alle (transitiven) Importe sind abrufbar; CSS und Tokens liegen vor', async () => {
  const html = await fetch(`${base}js/ui/views/fitting/dev.html`);
  assert.equal(html.status, 200); assert.match(html.headers.get('content-type'), /text\/html/);
  const seen = new Set();
  const queue = [`${base}js/ui/views/fitting/index.js`, `${base}tests/mocks/fitting-game.js`, `${base}js/core/data-loader.js`];
  while (queue.length) {
    const url = queue.pop();
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(url);
    assert.equal(res.status, 200, `nicht abrufbar: ${url}`);
    assert.match(res.headers.get('content-type'), /javascript/);
    for (const rel of importsOf(await res.text())) queue.push(new URL(rel, url).href);
  }
  assert.ok(seen.size >= 12, `Importgraph zu klein: ${seen.size}`);
  for (const css of ['css/tokens.css', 'css/views/fitting.css']) assert.equal((await fetch(`${base}${css}`)).status, 200, css);
  assert.equal((await fetch(`${base}data/i18n/de.json`)).status, 200);
});
