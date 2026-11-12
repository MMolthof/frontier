import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildData, loadData, createMemoryReader, createFsReader, kindOfId } from '../js/core/data-loader.js';
import { REPO_ROOT } from './harness.js';

const manifest = { schema: 1, contract: '1.0', files: ['balance.json', 'ships.json', 'ores.json', 'systems.json', 'i18n/de.json'] };
const ship = (id, extra = {}) => ({ id, name: id, category: 'mining', class: 'frigate', slots: { high: 1, mid: 0, low: 0, rig: 0 }, ...extra });

test('Indizes, Listen, Celestial-/Field-Index, Balance, i18n; Ergebnis ist eingefroren', () => {
  const { data, warnings } = buildData({
    manifest,
    files: {
      'balance.json': { tickSeconds: 60 },
      'ships.json': { entries: [ship('ship.a')] },
      'ores.json': { entries: [{ id: 'ore.v', name: 'V', volumeM3: 0.1 }] },
      'systems.json': { entries: [{ id: 'sys.x', name: 'X', celestials: [{ id: 'cel.x.1', type: 'planet' }], fields: [{ id: 'field.x.1' }] }] },
      'i18n/de.json': { 'a.b': 'c' }
    }
  });
  assert.deepEqual(warnings, []);
  assert.equal(data.ships['ship.a'].name, 'ship.a');
  assert.equal(data.lists.ships.length, 1);
  assert.equal(data.celestials['cel.x.1'].systemId, 'sys.x');
  assert.equal(data.fields['field.x.1'].systemId, 'sys.x');
  assert.equal(data.balance.tickSeconds, 60);
  assert.equal(data.i18n.de['a.b'], 'c');
  assert.ok(Object.isFrozen(data.ships['ship.a']));
  assert.throws(() => { 'use strict'; data.ships['ship.a'].name = 'neu'; }, TypeError);
});

test('Warnungen: fehlende Datei, doppelte ID, Präfix, Pflicht- und unbekannte Felder', () => {
  const { data, warnings } = buildData({
    manifest: { files: ['ships.json', 'ores.json'] },
    files: { 'ships.json': { entries: [ship('ship.a'), ship('ship.a'), ship('bad.id'), { id: 'ship.c', foo: 1 }] } }
  });
  const text = warnings.join('\n');
  assert.match(text, /ores\.json fehlt/);
  assert.match(text, /Doppelte ID ship\.a/);
  assert.match(text, /bad\.id passt nicht zum Präfix/);
  assert.match(text, /ship\.c: Pflichtfelder fehlen/);
  assert.match(text, /ship\.c: unbekannte Felder ignoriert: foo/);
  assert.equal(data.lists.ships.filter((s) => s.id === 'ship.a').length, 1);
});

test('ext: Sammlung per ID-Präfix oder kind; bei doppelter ID gewinnt die Basis', () => {
  const { data, warnings } = buildData({
    manifest: { files: ['ships.json'] },
    files: { 'ships.json': { entries: [ship('ship.a', { name: 'Basis' })] } },
    ext: [{ path: 'ext/a4-x.json', json: { entries: [ship('ship.a', { name: 'Ext' }), ship('ship.b'), { id: 'nonsense' }] } }]
  });
  assert.equal(data.ships['ship.a'].name, 'Basis');
  assert.ok(data.ships['ship.b']);
  assert.match(warnings.join('\n'), /Doppelte ID ship\.a/);
  assert.match(warnings.join('\n'), /Sammlung für nonsense nicht bestimmbar/);
  assert.equal(kindOfId('mod.x'), 'modules');
  assert.equal(kindOfId('cel.x'), null);
});

test('loadData über Memory-Reader inkl. data/ext und nicht lesbarer Dateien', async () => {
  const reader = createMemoryReader({
    'data/manifest.json': manifest,
    'data/balance.json': { startIsk: 1 },
    'data/ships.json': { entries: [ship('ship.a')] },
    'data/ext/a4-test.json': { entries: [ship('ship.ext')] }
  });
  const got = [];
  const { data, warnings } = await loadData(reader, { onWarn: (m) => got.push(m) });
  assert.ok(data.ships['ship.ext']);
  assert.equal(data.balance.startIsk, 1);
  assert.ok(warnings.some((w) => /ores\.json nicht lesbar/.test(w)));
  assert.equal(got.length, warnings.length);
});

test('loadData liest das echte Repo über den Fs-Reader ohne Absturz', async () => {
  const { data } = await loadData(createFsReader(REPO_ROOT), { onWarn: () => {} });
  assert.equal(data.contract, '1.0');
  assert.equal(data.balance.startShip, 'ship.pebble');
  assert.ok(data.lists.stats.length > 30);
});

test('normative Beispieldateien laden ohne Pflicht-/Unbekannt-Warnungen', async () => {
  const kinds = ['ships', 'modules', 'skills', 'ores', 'systems', 'missions', 'npcs'];
  const files = {};
  for (const k of kinds) files[`${k}.json`] = (await import(`../data/examples/${k}.example.json`, { with: { type: 'json' } })).default;
  const { warnings } = buildData({ manifest: { files: Object.keys(files) }, files });
  assert.deepEqual(warnings, []);
});
