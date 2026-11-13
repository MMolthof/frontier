import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../js/util/format.js';
import { createTestData } from './harness.js';
import {
  SLOT_TYPES, ringLayout, ringOrder, nextInRing, barState, errorText, describeCheck, formatDeltaRows, describePath,
  buildPanel, normalizeFitting, buildCells, chooseTargetIndex, filterModules, listGroups, sortModules, costText
} from '../js/ui/views/fitting/model.js';

const { data } = createTestData();
const t = createTranslator(data.i18n.de);

test('ringLayout: kein Überlappen für ALLE Slot-Kombinationen 0–7 je Typ und für alle 14 Schiffe', () => {
  const minDist = (layout) => {
    let min = Infinity;
    for (let i = 0; i < layout.slots.length; i++) for (let j = i + 1; j < layout.slots.length; j++) {
      min = Math.min(min, Math.hypot(layout.slots[i].x - layout.slots[j].x, layout.slots[i].y - layout.slots[j].y));
    }
    return min;
  };
  for (let h = 0; h <= 7; h++) for (let m = 0; m <= 7; m++) for (let l = 0; l <= 7; l++) for (let r = 0; r <= 7; r++) {
    const layout = ringLayout({ high: h, mid: m, low: l, rig: r });
    assert.equal(layout.slots.length, h + m + l + r);
    assert.ok(minDist(layout) >= layout.slotSize - 1e-6, `Überlappung bei ${h}/${m}/${l}/${r}: ${minDist(layout)}`);
  }
  for (const ship of data.lists.ships) {
    const layout = ringLayout(ship.slots);
    assert.ok(minDist(layout) >= layout.slotSize - 1e-6, ship.id);
  }
});

test('ringLayout: High oben, Mid rechts, Low links, Rig unten; Leserichtung; Prozentwerte im Container', () => {
  const l = ringLayout({ high: 4, mid: 3, low: 3, rig: 3 });
  const c = l.size / 2;
  const of = (slot) => l.slots.filter((s) => s.slot === slot);
  assert.ok(of('high').every((s) => s.y < c));
  assert.ok(of('rig').every((s) => s.y > c));
  assert.ok(of('mid').every((s) => s.x > c));
  assert.ok(of('low').every((s) => s.x < c));
  const inc = (arr, k) => arr.every((s, i) => i === 0 || s[k] > arr[i - 1][k]);
  assert.ok(inc(of('high'), 'x') && inc(of('rig'), 'x'), 'High/Rig links→rechts');
  assert.ok(inc(of('mid'), 'y') && inc(of('low'), 'y'), 'Mid/Low oben→unten');
  assert.ok(l.slots.every((s) => s.xPct > 0 && s.xPct < 100 && s.yPct > 0 && s.yPct < 100));
  assert.equal(ringLayout({ high: 1 }).slots.length, 1);
  assert.deepEqual(ringLayout({}).slots, []);
});

test('Tastaturreihenfolge im Uhrzeigersinn und Pfeiltasten (mit Umlauf)', () => {
  const order = ringOrder({ high: 2, mid: 2, low: 2, rig: 2 });
  assert.deepEqual(order.map((o) => `${o.slot}${o.index}`), ['high0', 'high1', 'mid0', 'mid1', 'rig1', 'rig0', 'low1', 'low0']);
  assert.deepEqual(nextInRing(order, { slot: 'high', index: 1 }, 'ArrowRight'), { slot: 'mid', index: 0 });
  assert.deepEqual(nextInRing(order, { slot: 'high', index: 0 }, 'ArrowLeft'), { slot: 'low', index: 0 });
  assert.deepEqual(nextInRing(order, { slot: 'low', index: 0 }, 'ArrowDown'), { slot: 'high', index: 0 });
  assert.deepEqual(nextInRing(order, { slot: 'mid', index: 0 }, 'Home'), order[0]);
  assert.deepEqual(nextInRing(order, { slot: 'mid', index: 0 }, 'End'), order[7]);
  assert.equal(nextInRing(order, { slot: 'mid', index: 0 }, 'a'), null);
  assert.equal(nextInRing([], null, 'ArrowRight'), null);
  assert.deepEqual(nextInRing(order, null, 'ArrowRight'), order[0]);
});

test('barState: ok / warn ab 90 % / over; Grenzfälle', () => {
  assert.deepEqual(barState(10, 100), { ratio: 0.1, pct: 10, state: 'ok', over: 0 });
  assert.equal(barState(90, 100).state, 'warn');
  assert.equal(barState(100, 100).state, 'warn');
  const over = barState(104, 100);
  assert.equal(over.state, 'over'); assert.equal(over.ratio, 1); assert.equal(over.over, 4);
  assert.equal(barState(0, 0).state, 'ok');
  assert.equal(barState(5, 0).state, 'over');
  assert.equal(barState(NaN, undefined).state, 'ok');
});

test('errorText: message, sonst error.<code>, sonst ui.fitting.err.<code>, sonst Standardtext', () => {
  assert.equal(errorText(t, { error: 'fit.cpu', message: 'Eigener Text' }), 'Eigener Text');
  assert.equal(errorText(t, { error: 'fit.cpu', message: 'fit.cpu' }), t('error.fit.cpu'));      // nur der Code → kein Text
  assert.equal(errorText(t, { error: 'fit.size', message: 'error.fit.size' }), t('ui.fitting.err.fit.size'));
  assert.equal(errorText(t, { error: 'fit.hardpoints' }), t('ui.fitting.err.fit.hardpoints'));
  assert.equal(errorText(t, { error: 'x.unbekannt' }), t('ui.fitting.err.unknown'));
  assert.equal(errorText(t, undefined), t('ui.fitting.err.unknown'));
});

test('describeCheck: zu viel PG, Bedarf/Vorrat, Skills mit Namen', () => {
  assert.equal(describeCheck({ ok: true }, t, data), '');
  assert.match(describeCheck({ ok: false, error: 'fit.powergrid', need: 52, have: 48 }, t, data), /Nicht genug Powergrid\. \(4 zu viel\)/);
  assert.match(describeCheck({ ok: false, error: 'fit.hardpoints', need: 3, have: 2 }, t, data), /benötigt 3, verfügbar 2/);
  const skillText = describeCheck({ ok: false, error: 'fit.skill', need: { 'skill.gunnery': 2 } }, t, data);
  assert.match(skillText, new RegExp(`Benötigt: ${data.skills['skill.gunnery'].name} 2`));
  assert.equal(describeCheck({ ok: false, error: 'fit.slot_type' }, t, data), t('error.fit.slot_type'));
});

test('formatDeltaRows: nur Differenzen, Vorzeichen, Ton, Resist in Prozentpunkten, Reihenfolge', () => {
  const rows = formatDeltaRows({
    'mining.m3PerTick': 0.92, 'fitting.pg.used': 1, 'defense.ehp': 0, 'defense.shield.res.em': 0.1,
    'nav.signature': -5, 'offense.dps.total': 0.004, 'x.unbekannt': 2, 'slots.high.hardpoints.turret.used': 1, 'defense.ehp2': NaN
  }, t);
  const byPath = Object.fromEntries(rows.map((r) => [r.path, r]));
  assert.ok(!('defense.ehp' in byPath), 'Null-Differenz entfällt');
  assert.ok(!('offense.dps.total' in byPath), 'rundet auf 0 → entfällt');
  assert.ok(!('defense.ehp2' in byPath));
  assert.equal(byPath['mining.m3PerTick'].text, '+0,92 m³/Tick'); assert.equal(byPath['mining.m3PerTick'].tone, 'good');
  assert.equal(byPath['fitting.pg.used'].text, '+1,0 MW'); assert.equal(byPath['fitting.pg.used'].tone, 'bad');
  assert.equal(byPath['defense.shield.res.em'].text, '+10,0 %');
  assert.equal(byPath['defense.shield.res.em'].label, 'Schild-Resistenz EM');
  assert.equal(byPath['nav.signature'].text, '−5 m'); assert.equal(byPath['nav.signature'].tone, 'good');
  assert.equal(byPath['x.unbekannt'].tone, 'neutral'); assert.equal(byPath['x.unbekannt'].label, 'x.unbekannt');
  assert.equal(byPath['slots.high.hardpoints.turret.used'].label, 'Geschützplatz belegt');
  assert.deepEqual(rows.map((r) => r.path.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i), ['fitting', 'defense', 'mining', 'nav', 'slots', 'x']);
  assert.deepEqual(formatDeltaRows(undefined, t), []);
});

const stats = {
  valid: false,
  errors: [{ code: 'fit.powergrid', slot: null, index: null, message: 'Nicht genug Powergrid.', need: 52, have: 48 },
    { code: 'fit.skill', slot: 'high', index: 1, moduleId: 'mod.x', need: { 'skill.gunnery': 1 } }],
  fitting: { pg: { used: 52, max: 48 }, cpu: { used: 100, max: 270 }, calibration: { used: 380, max: 400 } },
  defense: {
    shield: { hp: 520, res: { em: 0, th: 0.2, kin: 0.4, exp: 0.5 } }, armor: { hp: 380, res: { em: 0.5, th: 0.35, kin: 0.25, exp: 0.1 } },
    structure: { hp: 420, res: { em: 0, th: 0, kin: 0, exp: 0 } }, ehp: 1650.4
  },
  offense: { dps: { total: 16, em: 0, th: 0, kin: 9, exp: 7 }, rangeKm: 6 },
  mining: { lasers: 2, m3PerTick: 1.84, oreHold: 5000, cargo: 150 },
  capacitor: { max: 320, rechargePerTick: 80, usePerTick: 10, stable: true, stableForTicks: null },
  nav: { speed: 335, warpSpeed: 3, warpTicksPerAu: 0.33, signature: 40, maxTargets: 3, lockRangeKm: 15 },
  repair: { shieldPerTick: 0, armorPerTick: 0 }
};

test('buildPanel: Balken-Zustände, HP, Resist-Matrix 4×3, sichtbare Abschnitte, Probleme', () => {
  const p = buildPanel(stats, t, data);
  assert.deepEqual(p.budget.map((b) => [b.id, b.state]), [['pg', 'over'], ['cpu', 'ok'], ['calibration', 'warn']]);
  assert.equal(p.budget[0].text, '52,0 / 48,0 MW'); assert.equal(p.budget[0].overText, '(4,0 zu viel)');
  assert.equal(p.budget[2].text, '380 / 400');
  assert.equal(p.ehpText, '1.650 HP');
  assert.equal(p.resist.rows.length, 4); assert.ok(p.resist.rows.every((r) => r.cells.length === 3));
  assert.equal(p.resist.rows[3].cells[0].text, '50 %');          // Explosiv / Schild
  assert.deepEqual(p.sections.map((s) => s.id), ['offense', 'mining', 'capacitor', 'nav']);   // Reparatur leer → ausgeblendet
  assert.equal(p.sections[2].rows.at(-1).text, 'stabil');
  assert.equal(p.valid, false);
  assert.match(p.errors[0].text, /4 zu viel/);
  assert.match(p.errors[1].text, new RegExp(data.skills['skill.gunnery'].name));
});

test('buildPanel ist robust gegen fehlende Felder', () => {
  const p = buildPanel(undefined, t);
  assert.equal(p.budget.length, 3); assert.equal(p.ehpText, '0 HP'); assert.equal(p.resist.rows.length, 4);
  assert.deepEqual(p.sections.map((s) => s.id), ['capacitor', 'nav']);
  assert.equal(p.valid, true);
  const unstable = buildPanel({ capacitor: { stable: false, stableForTicks: 42 } }, t);
  assert.match(unstable.sections[0].rows.at(-1).text, /42 Ticks/);
});

test('normalizeFitting/buildCells/chooseTargetIndex', () => {
  const counts = { high: 3, mid: 1, low: 0, rig: 2 };
  const f = normalizeFitting({ fitting: { high: ['mod.miner_1'], rig: [null, 'mod.rig_cargo_s'] } }, counts);
  assert.deepEqual(f.high, ['mod.miner_1', null, null]); assert.deepEqual(f.mid, [null]); assert.deepEqual(f.low, []);
  assert.deepEqual(normalizeFitting(null, counts).rig, [null, null]);
  const cells = buildCells(f, data, [{ slot: 'high', index: 0, text: 'kaputt' }]);
  assert.equal(cells.high[0].name, data.modules['mod.miner_1'].name);
  assert.equal(cells.high[0].invalid, true); assert.equal(cells.high[0].issue, 'kaputt');
  assert.equal(cells.high[1].moduleId, null);
  assert.equal(chooseTargetIndex(cells.high, null), 1);
  assert.equal(chooseTargetIndex(cells.high, 2), 2);
  assert.equal(chooseTargetIndex(cells.high, 0), 1, 'belegter Wunsch-Slot → erster freier');
  assert.equal(chooseTargetIndex(cells.low, null), -1);
});

const items = [
  { moduleId: 'm1', name: 'Zeta Miner', group: 'mining_laser', category: 'mining', qtyInStation: 0, check: { ok: false } },
  { moduleId: 'm2', name: 'Alpha Kanone', group: 'projectile_turret', category: 'weapon', qtyInStation: 2, check: { ok: true } },
  { moduleId: 'm3', name: 'Beta Miner', group: 'mining_laser', category: 'mining', qtyInStation: 1, check: { ok: true } }
];

test('Modulliste: Sortierung nach Gruppe/Name, Filter, Suche, Gruppen mit Anzahl', () => {
  assert.deepEqual(sortModules(items, t).map((m) => m.moduleId), ['m3', 'm1', 'm2']);   // Bergbaulaser < Projektil…
  assert.deepEqual(filterModules(items, { group: 'mining_laser' }, t).map((m) => m.moduleId), ['m3', 'm1']);
  assert.deepEqual(filterModules(items, { onlyUsable: true }, t).map((m) => m.moduleId), ['m3', 'm2']);
  assert.deepEqual(filterModules(items, { inStockOnly: true }, t).map((m) => m.moduleId), ['m3', 'm2']);
  assert.deepEqual(filterModules(items, { search: '  ALPHA ' }, t).map((m) => m.moduleId), ['m2']);
  assert.deepEqual(filterModules(items, { search: 'bergbau' }, t).map((m) => m.moduleId), ['m3', 'm1'], 'Suche auch in Gruppe/Kategorie');
  assert.deepEqual(filterModules(items, {}, t).length, 3);
  assert.deepEqual(listGroups(items, t).map((g) => [g.id, g.count]), [['mining_laser', 2], ['projectile_turret', 1]]);
  assert.equal(items[0].moduleId, 'm1', 'Eingabe wird nicht verändert');
});

test('costText und describePath', () => {
  assert.equal(costText({ powergrid: 1, cpu: 20 }, t), 'PG 1 · CPU 20');
  assert.equal(costText({ calibration: 100 }, t), 'Cal. 100');
  assert.equal(describePath('nav.speed', t).label, 'Geschwindigkeit');
  assert.deepEqual(SLOT_TYPES, ['high', 'mid', 'low', 'rig']);
});
