// Test-Harness für Fachagenten (Node, ohne Browser).
//   import { createTestGame, createFakeClock } from '../harness.js';
//   const game = createTestGame({ systems: [system], extra: [{ entries: [...] }] });
//   game.advance(10);
// Standarddaten: data/balance.json, data/stats.json, data/examples/*.example.json (normative Beispiele).
// Eigene Testdaten: `extra` (ext-Dateien im Format { kind?, entries }) oder komplett eigenes `data`.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildData, ENTRY_KIND_NAMES } from '../js/core/data-loader.js';
import { createGame } from '../js/core/game.js';
import { createMemoryAdapter, createSaveManager } from '../js/core/save.js';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (rel) => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));

/** Deterministische Uhr für Tests. */
export function createFakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; return t; }, set: (ms) => { t = ms; } };
}

/**
 * Baut Daten aus Repo (Basisdateien, sofern vorhanden, sonst Beispiele) plus optionalen Extras.
 * Warnungen werden zurückgegeben, nie geworfen.
 */
export function createTestData({ extra = [], useExamples = true } = {}) {
  const manifest = readJson('data/manifest.json');
  const files = {};
  for (const file of manifest.files) {
    const base = `data/${file}`;
    const kind = file.replace(/\.json$/, '');
    if (existsSync(join(REPO_ROOT, base))) files[file] = readJson(base);
    else if (useExamples && ENTRY_KIND_NAMES.includes(kind) && existsSync(join(REPO_ROOT, `data/examples/${kind}.example.json`))) {
      files[file] = readJson(`data/examples/${kind}.example.json`);
    }
  }
  // Tests laufen mit den Vertragswerten (1 Tick = tickSeconds, leeres Starterschiff), unabhängig von Dev-Overrides.
  if (files['balance.json']) {
    const { liveTickMs, startFitting, ...contractBalance } = files['balance.json'];
    files['balance.json'] = contractBalance;
  }
  const ext = extra.map((json, i) => ({ path: `ext/test-${i}.json`, json: { schema: 1, ...json } }));
  return buildData({ manifest, files, ext });
}

/**
 * @param {{data?: object, systems?: object[], seed?: number, clock?: object, state?: object, extra?: object[], saves?: boolean}} [options]
 * @returns game (zusätzlich: game.clock, game.saves, game.warnings)
 */
export function createTestGame({ data, systems = [], seed = 1, clock = createFakeClock(), state, extra, saves = false } = {}) {
  const warnings = [];
  const testData = data ?? createTestData({ extra }).data;
  const manager = saves ? createSaveManager(createMemoryAdapter()) : null;
  const game = createGame({
    data: testData, systems, seed, now: clock.now, state, saves: manager, onWarn: (m) => warnings.push(m)
  });
  game.clock = clock;
  game.saves = manager;
  game.warnings = warnings;
  return game;
}
