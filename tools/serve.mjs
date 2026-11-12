// Statischer Entwicklungsserver ohne Abhängigkeiten.  Aufruf: node tools/serve.mjs [port]
// Erzeugt data/ext/index.json dynamisch (Dateiliste), weil Browser Verzeichnisse nicht listen können.
// Auf GitHub Pages gibt es das nicht: dort bleibt data/ext leer, der Lead faltet ext in die Basisdateien.

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

async function extIndex() {
  try {
    const names = await readdir(join(ROOT, 'data', 'ext'));
    return names.filter((n) => n.endsWith('.json') && n !== 'index.json').sort();
  } catch {
    return [];
  }
}

export function createAppServer(root = ROOT) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (rel.split(sep).includes('..')) { res.writeHead(403).end('Forbidden'); return; }
      if (rel === '' || rel.endsWith(sep)) rel += 'index.html';
      let file = join(root, rel);
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
      if (!info && rel === join('data', 'ext', 'index.json')) {
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(await extIndex()));
        return;
      }
      if (!info) { res.writeHead(404, { 'Content-Type': MIME['.txt'] }).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': MIME['.txt'] }).end(String(err.message));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);
  createAppServer().listen(port, () => console.log(`Tick Frontier: http://localhost:${port}/`));
}
