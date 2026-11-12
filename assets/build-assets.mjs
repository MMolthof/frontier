// Erzeugt statische SVG-Dateien aus den Generatoren (Node, ohne DOM).
//   node assets/build-assets.mjs
// - assets/ships/<id>.svg           je Schiff aus data/ships.json (falls vorhanden, sonst data/examples/ships.example.json)
// - assets/ships/_fallback-<class>.svg   je Klasse
// - assets/icons/<name>.svg         alle Icons
// Zur Laufzeit zeichnet die UI Schiffe immer über den Generator; die Dateien sind für Vorschau und externe Nutzung.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_NAMES, iconTree, shipTree, SHIP_CLASSES, svgToString } from '../js/ui/components/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (rel) => { const p = join(ROOT, 'assets', rel); mkdirSync(dirname(p), { recursive: true }); return p; };

function loadShips() {
  const candidates = ['data/ships.json', 'data/examples/ships.example.json'];
  const file = candidates.find((rel) => existsSync(join(ROOT, rel)));
  if (!file) return { file: null, ships: [] };
  const json = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  const ships = Array.isArray(json) ? json : json.entries ?? Object.values(json);
  return { file, ships: ships.filter((s) => s && typeof s.id === 'string') };
}

const withFile = (tree, extra) => { const [tag, attrs, ...rest] = tree; return [tag, { ...extra, ...attrs }, ...rest]; };

const { file, ships } = loadShips();
let count = 0;
for (const ship of ships) {
  writeFileSync(out(`ships/${ship.id}.svg`), `${svgToString(shipTree(ship))}\n`);
  count += 1;
}
for (const cls of SHIP_CLASSES) {
  writeFileSync(out(`ships/_fallback-${cls}.svg`), `${svgToString(shipTree({ id: `_fallback-${cls}`, class: cls, hull: 'medium' }))}\n`);
  count += 1;
}
for (const name of ICON_NAMES) {
  writeFileSync(out(`icons/${name}.svg`), `${svgToString(withFile(iconTree(name), { xmlns: 'http://www.w3.org/2000/svg', color: '#16222b' }))}\n`);
  count += 1;
}
console.log(`${count} Dateien geschrieben (Schiffe aus ${file ?? 'keiner Quelle'}: ${ships.length}).`);
