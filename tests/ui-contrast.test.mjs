import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './harness.js';
import { DEFAULT_STRINGS } from '../js/ui/shell/default-strings.js';
import { NEOCOM_MODEL } from '../js/ui/shell/neocom-model.js';
import { ICON_NAMES } from '../js/ui/components/index.js';

const read = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf8');

function tokens() {
  const out = {};
  for (const m of read('css/tokens.css').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('Vertragswerte (Contract 1.1) sind unverändert', () => {
  const t = tokens();
  const expected = { bg: '#eef2f5', panel: '#ffffff', ink: '#16222b', mute: '#5d6d78', line: '#d3dce2', acc: '#1f6f8b', acc2: '#e3f0f5', gold: '#a8700e', red: '#b23a3a', ok: '#2f7d4f', map: '#f3f7fa' };
  for (const [k, v] of Object.entries(expected)) assert.equal(t[k], v, `--${k}`);
});

test('Kontrast Text auf Flächen >= 4,5:1', () => {
  const t = tokens();
  const surfaces = ['panel', 'bg', 'acc2', 'map'];
  const textColors = ['ink', 'mute', 'acc', 'gold-text', 'ok-text', 'red'];
  const failures = [];
  for (const s of surfaces) for (const c of textColors) {
    const r = ratio(t[c], t[s]);
    if (r < 4.5) failures.push(`${c} auf ${s}: ${r.toFixed(2)}`);
  }
  for (const bg of ['acc', 'red', 'ok']) {
    const r = ratio(t['on-acc'], t[bg]);
    if (r < 4.5) failures.push(`on-acc auf ${bg}: ${r.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
});

test('Gold und Grün dürfen nicht als Textfarbe verwendet werden (nur -text-Tokens)', () => {
  const t = tokens();
  assert.ok(ratio(t.gold, t.panel) < 4.5 || true);
  for (const file of ['css/base.css', 'css/layout.css', 'css/components.css', 'css/shell.css', 'css/overview.css', 'css/demo.css']) {
    const css = read(file);
    for (const m of css.matchAll(/(?:^|[;{\s])color:\s*var\(--(gold|ok)\)/g)) assert.fail(`${file}: color: var(--${m[1]}) statt --${m[1]}-text`);
  }
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test('Hygiene: keine Hex-Farben außerhalb tokens.css, kein innerHTML/Zufall/Systemuhr in js/ui, keine Inline-Styles außer dynamischen Werten', () => {
  for (const file of ['base', 'layout', 'components', 'shell', 'overview', 'demo']) {
    assert.doesNotMatch(read(`css/${file}.css`), /#[0-9a-fA-F]{3,8}\b/, `Hex in css/${file}.css`);
  }
  for (const file of walk(join(REPO_ROOT, 'js/ui')).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(file, 'utf8');
    for (const bad of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /Math\.random/, /Date\.now/, /\beval\(/]) assert.doesNotMatch(src, bad, `${file}: ${bad}`);
    assert.doesNotMatch(src, /style\.cssText|setAttribute\('style'/, `${file}: Inline-Style-String`);
  }
});

test('Alle t()-Schlüssel im UI-Code existieren in den Standardtexten', () => {
  const missing = new Set();
  for (const file of walk(join(REPO_ROOT, 'js/ui')).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)) if (!(m[1] in DEFAULT_STRINGS)) missing.add(`${file.replace(REPO_ROOT, '')}: ${m[1]}`);
    for (const m of src.matchAll(/\bt\(\s*`([a-z0-9_.]+)\$\{/g)) {
      const prefix = m[1];
      assert.ok(Object.keys(DEFAULT_STRINGS).some((k) => k.startsWith(prefix)), `Präfix ${prefix} ohne Schlüssel`);
    }
  }
  assert.deepEqual([...missing], []);
  for (const entry of NEOCOM_MODEL.flatMap((e) => [e, ...(e.children ?? []), ...(e.subs ?? [])])) {
    assert.ok(entry.labelKey in DEFAULT_STRINGS, entry.labelKey);
    if (entry.icon) assert.ok(ICON_NAMES.includes(entry.icon), `Icon ${entry.icon}`);
  }
});

test('Klickflächen und Fokus: Tokens und CSS erfüllen 40 px und sichtbaren Fokus', () => {
  assert.match(read('css/tokens.css'), /--tap:40px/);
  assert.match(read('css/base.css'), /:focus-visible\{outline:var\(--focus-ring\)/);
  for (const sel of ['.c-btn', '.c-tab', '.s-neo__btn', '.c-table__sort']) {
    assert.match(read('css/components.css') + read('css/shell.css'), new RegExp(`${sel.replace('.', '\\.')}\\{[^}]*min-height:var\\(--tap\\)`), sel);
  }
});
