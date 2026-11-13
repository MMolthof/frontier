import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './harness.js';

// Kontrast (WCAG 2.x) der Farbpaare, die css/views/fitting.css für TEXT verwendet. Quelle der Farben: css/tokens.css.
const tokens = Object.fromEntries([...readFileSync(join(REPO_ROOT, 'css/tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(tokens[a]), lum(tokens[b])]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [Textfarbe, Hintergrund]: Text nur in diesen Kombinationen (Gold wird bewusst NICHT für Text genutzt, siehe unten)
const TEXT_PAIRS = [
  ['--ink', '--panel'], ['--ink', '--map'], ['--ink', '--acc2'], ['--mute', '--panel'], ['--mute', '--map'], ['--mute', '--acc2'],
  ['--ok', '--panel'], ['--ok', '--map'], ['--red', '--panel'], ['--red', '--map'], ['--panel', '--acc'], ['--panel', '--red']
];

test('Textpaare erreichen ≥ 4,5:1', () => {
  assert.ok(tokens['--ink'] && tokens['--panel'], 'Tokens gelesen');
  for (const [fg, bg] of TEXT_PAIRS) assert.ok(ratio(fg, bg) >= 4.5, `${fg} auf ${bg}: ${ratio(fg, bg).toFixed(2)}`);
});

test('Gold (--gold) wird im Fitting-CSS nicht als Textfarbe verwendet (nur 4,21:1 auf Weiß)', () => {
  assert.ok(ratio('--gold', '--panel') < 4.5, 'Annahme der Dokumentation');
  assert.ok(ratio('--gold', '--panel') >= 3, 'als Grafik/Rahmen ≥ 3:1');
  const css = readFileSync(join(REPO_ROOT, 'css/views/fitting.css'), 'utf8');
  const colorUses = [...css.matchAll(/(?:^|[;{\s])color:\s*var\(--gold\)/g)];
  assert.equal(colorUses.length, 0);
});

test('CSS nutzt nur Tokens aus css/tokens.css (plus lokale --c-fit-/--fit-/--slot Variablen)', () => {
  const css = readFileSync(join(REPO_ROOT, 'css/views/fitting.css'), 'utf8');
  const allTokens = new Set([...readFileSync(join(REPO_ROOT, 'css/tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const unknown = [...used].filter((v) => !allTokens.has(v) && !/^--(c-fit-|fit-|slot$)/.test(v));
  assert.deepEqual(unknown, []);
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'keine festen Hex-Farben');
  assert.equal(/\.c-(?!fit)/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'nur Präfix .c-fit-');
});
