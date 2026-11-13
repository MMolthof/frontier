import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, createTestData } from './harness.js';
import { createTranslator } from '../js/util/format.js';
import { describePath, errorText } from '../js/ui/views/fitting/model.js';

const dir = join(REPO_ROOT, 'js/ui/views/fitting');
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const strings = JSON.parse(readFileSync(join(REPO_ROOT, 'data/i18n/de.json'), 'utf8')).strings;
const { data } = createTestData();
const t = createTranslator(data.i18n.de);

test('alle im Code verwendeten festen Schlüssel ui.fitting.* existieren in de.json', () => {
  const used = new Set();
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/['"`](ui\.fitting\.[A-Za-z0-9_.]*[A-Za-z0-9_])['"`]/g)) used.add(m[1]);
  }
  assert.ok(used.size > 60, `nur ${used.size} Schlüssel gefunden`);
  const missing = [...used].filter((k) => !(k in strings));
  assert.deepEqual(missing, []);
});

test('Schlüssel erfüllen das Schema-Muster und gehören zum Präfix ui.fitting.', () => {
  const mine = Object.keys(strings).filter((k) => k.startsWith('ui.fitting.'));
  assert.ok(mine.length > 100);
  for (const k of mine) assert.match(k, /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_äöüÄÖÜ]+)+$/);
  for (const v of mine.map((k) => strings[k])) assert.equal(typeof v, 'string');
});

test('jeder Fehlercode aus MASTER_PLAN 3.9 hat einen Text (error.* oder ui.fitting.err.*)', () => {
  const codes = ['fit.not_docked', 'fit.slot_type', 'fit.slot_occupied', 'fit.size', 'fit.hardpoints', 'fit.powergrid', 'fit.cpu',
    'fit.calibration', 'fit.skill', 'fit.no_module', 'fit.rig_confirm', 'ship.skill'];
  for (const code of codes) {
    const text = errorText(t, { error: code, message: code });
    assert.notEqual(text, t('ui.fitting.err.unknown'), `kein Text für ${code}`);
    assert.ok(text.length > 8 && !text.startsWith('error.'), code);
  }
});

test('alle bekannten Δ-Pfade haben ein Label (kein roher Pfad für Spieler sichtbar)', () => {
  const paths = ['fitting.pg.used', 'fitting.cpu.used', 'fitting.calibration.used', 'fitting.pg.max', 'fitting.cpu.max', 'fitting.calibration.max',
    'defense.ehp', 'defense.shield.hp', 'defense.armor.hp', 'defense.structure.hp', 'offense.dps.total', 'offense.rangeKm',
    'mining.m3PerTick', 'mining.lasers', 'mining.oreHold', 'mining.cargo', 'capacitor.max', 'capacitor.rechargePerTick',
    'capacitor.usePerTick', 'capacitor.stableForTicks', 'nav.speed', 'nav.warpSpeed', 'nav.warpTicksPerAu', 'nav.signature',
    'nav.maxTargets', 'nav.lockRangeKm', 'repair.shieldPerTick', 'repair.armorPerTick',
    'defense.shield.res.em', 'defense.armor.res.kin', 'defense.structure.res.exp', 'offense.dps.th', 'slots.mid.used', 'slots.high.hardpoints.launcher.used'];
  for (const p of paths) assert.notEqual(describePath(p, t).label, p, p);
});

test('keine festen deutschen Texte im Code (Umlaute in Zeichenketten außerhalb von Kommentaren)', () => {
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    const literals = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]);
    const bad = literals.filter((s) => /[äöüÄÖÜß]/.test(s));
    assert.deepEqual(bad, [], `${f}: ${bad.join(' | ')}`);
  }
});
