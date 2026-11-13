import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, BALANCE, STATION, allSkills, makeGame, addShip, countModules, emptyFitting } from './fitting.helpers.mjs';
import { calcShipStats } from '../js/systems/fitting/stats.js';
import { checkShipRequirements } from '../js/systems/fitting/validate.js';

const ALL5 = Object.fromEntries(Object.keys(DATA.skills).map((id) => [id, 5]));
const equip = (game, uid, slot, index, moduleId) => game.dispatch('fitting/equip', { uid, slot, index, moduleId });

test('Startfitting: Starterschiff hat 2 Miner, Stationslager die 5 Startmodule', () => {
  const game = makeGame();
  const ship = game.state.assets.ships[0];
  assert.deepEqual(ship.fitting.high, ['mod.miner_1', 'mod.miner_1', null]);
  assert.deepEqual(game.state.assets.stations[STATION].items, BALANCE.startItems);
  const s = game.select('fitting/stats', { uid: 'u1' });
  assert.equal(s.valid, true);
  assert.equal(s.mining.lasers, 2);
  assert.deepEqual(game.select('fitting/ships').map((x) => [x.uid, x.active, x.valid]), [['u1', true, true]]);
});

test('Einbau: Modul wandert aus dem Lager in den Slot, Event fitting/changed', () => {
  const game = makeGame({ skills: ALL5 });
  const events = [];
  game.on('fitting/changed', (p) => events.push(p));
  const res = equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s');
  assert.deepEqual(res, { ok: true });
  assert.equal(game.state.assets.ships[0].fitting.mid[0], 'mod.shield_extender_s');
  assert.equal(game.state.assets.stations[STATION].items['mod.shield_extender_s'], undefined);
  assert.deepEqual(events, [{ uid: 'u1' }]);
});

test('Slot-Typ-Trennung: kein Modul passt in einen falschen Slot-Typ (High ≠ Mid ≠ Low ≠ Rig)', () => {
  const game = makeGame({ skills: ALL5 });
  const type = DATA.ships['ship.pebble'];
  for (const mod of DATA.lists.modules.filter((m) => m.size === 'small')) {
    game.state.assets.stations[STATION].items[mod.id] = 1;
    for (const slot of ['high', 'mid', 'low', 'rig']) {
      if (slot === mod.slot) continue;
      const res = game.select('fitting/canFit', { uid: 'u1', slot, index: type.slots[slot] - 1, moduleId: mod.id });
      assert.equal(res.ok, false, `${mod.id} in ${slot}`);
      assert.equal(res.error, 'fit.slot_type', `${mod.id} in ${slot}`);
    }
  }
  assert.equal(equip(game, 'u1', 'low', 0, 'mod.miner_1').error, 'fit.slot_type'); // Miner (High) in Low
  assert.equal(equip(game, 'u1', 'rig', 0, 'mod.armor_plate_s').error, 'fit.slot_type');
});

test('Fehlerklasse fit.not_docked: unterwegs oder Schiff in anderer Station', () => {
  const game = makeGame({ skills: ALL5 });
  game.state.pilot.location.dockedStationId = null;
  assert.equal(equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s').error, 'fit.not_docked');
  assert.deepEqual(game.select('fitting/ships'), []);
  game.state.pilot.location.dockedStationId = STATION;
  game.state.assets.ships[0].stationId = 'cel.andere.station';
  assert.equal(equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s').error, 'fit.not_docked');
  assert.equal(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 }).error, 'fit.not_docked');
});

test('Fehlerklasse fit.slot_occupied', () => {
  const game = makeGame({ skills: ALL5 });
  game.state.assets.stations[STATION].items['mod.miner_1'] = 1;
  const res = equip(game, 'u1', 'high', 0, 'mod.miner_1');
  assert.equal(res.error, 'fit.slot_occupied');
  assert.equal(game.state.assets.stations[STATION].items['mod.miner_1'], 1);
});

test('Fehlerklasse fit.size: Modulgröße muss Rumpfgröße entsprechen', () => {
  const game = makeGame({ skills: ALL5 });
  game.state.assets.stations[STATION].items['mod.shield_extender_m'] = 1;
  const res = equip(game, 'u1', 'mid', 0, 'mod.shield_extender_m');
  assert.equal(res.error, 'fit.size');
  assert.equal(res.need, 'small');
  assert.equal(res.have, 'medium');
});

test('Fehlerklasse fit.hardpoints: Pebble hat 2 Turret-Hardpoints, dritter Laser/Waffe scheitert', () => {
  const game = makeGame({ skills: ALL5 });
  game.state.assets.stations[STATION].items['mod.miner_1'] = 1;
  const res = equip(game, 'u1', 'high', 2, 'mod.miner_1');
  assert.equal(res.error, 'fit.hardpoints');
  assert.equal(res.need, 3);
  assert.equal(res.have, 2);
  assert.equal(res.message, 'Keine freien Waffenplätze mehr.');
  // Launcher: Pebble hat keinen
  game.state.assets.stations[STATION].items['mod.launcher_s'] = 1;
  assert.equal(equip(game, 'u1', 'high', 2, 'mod.launcher_s').error, 'fit.hardpoints');
});

test('Hardpoints je Typ: Hybrid-Rumpf (Dart: 3 Turret + 2 Launcher in 4 High-Slots)', () => {
  const game = makeGame({ skills: ALL5, items: { 'mod.autocannon_s': 4, 'mod.launcher_s': 3 } });
  const uid = addShip(game, 'ship.dart');
  for (let i = 0; i < 3; i++) assert.equal(equip(game, uid, 'high', i, 'mod.autocannon_s').ok, true);
  assert.equal(equip(game, uid, 'high', 3, 'mod.autocannon_s').error, 'fit.hardpoints'); // 4. Turret
  assert.equal(equip(game, uid, 'high', 3, 'mod.launcher_s').ok, true);
});

test('PG/CPU/Calibration werden verhindert – Grenzfälle mit synthetischem Schiff', async () => {
  const { synthData } = await import('./fitting.helpers.mjs');
  const { checkEquip } = await import('../js/systems/fitting/validate.js');
  const tiny = { ...DATA.ships['ship.pebble'], id: 'ship.t_tiny', fitting: { powergrid: 6, cpu: 30, calibration: 150 }, slots: { high: 3, mid: 3, low: 2, rig: 2 } };
  const data = synthData({ ships: [tiny] });
  const ship = { uid: 'x', typeId: tiny.id, stationId: 'S', fitting: emptyFitting(tiny) };
  const base = { ship, pilot: { skills: {} }, data, dockedStationId: 'S', stock: 9 }; // PG/CPU/Calibration werden vor dem Skill geprüft
  // PG: Panzerplatte 5 PG passt, zweite (10 > 6) nicht
  ship.fitting.low[0] = 'mod.armor_plate_s';
  let r = checkEquip({ ...base, slot: 'low', index: 1, moduleId: 'mod.armor_plate_s' });
  assert.deepEqual([r.ok, r.error, r.need, r.have], [false, 'fit.powergrid', 10, 6]);
  assert.equal(r.message, 'Nicht genug Powergrid.');
  // CPU: Schildextender 25 CPU passt, zweiter (50 > 30) nicht
  ship.fitting.low[0] = null;
  ship.fitting.mid[0] = 'mod.shield_extender_s';
  r = checkEquip({ ...base, slot: 'mid', index: 1, moduleId: 'mod.shield_extender_s' });
  assert.deepEqual([r.ok, r.error, r.need, r.have], [false, 'fit.cpu', 50, 30]);
  // Calibration: Rig 100 passt, zweiter (200 > 150) nicht
  ship.fitting.mid[0] = null;
  ship.fitting.rig[0] = 'mod.rig_cargo_s';
  r = checkEquip({ ...base, slot: 'rig', index: 1, moduleId: 'mod.rig_cargo_s' });
  assert.deepEqual([r.ok, r.error, r.need, r.have], [false, 'fit.calibration', 200, 150]);
});

test('PG-Priorität vor CPU, Slot-Typ vor allem anderen, Skill zuletzt', async () => {
  const { synthData } = await import('./fitting.helpers.mjs');
  const { checkEquip } = await import('../js/systems/fitting/validate.js');
  const tiny = { ...DATA.ships['ship.pebble'], id: 'ship.t_tiny2', fitting: { powergrid: 0, cpu: 0, calibration: 0 } };
  const data = synthData({ ships: [tiny] });
  const ship = { uid: 'x', typeId: tiny.id, stationId: 'S', fitting: emptyFitting(tiny) };
  const base = { ship, pilot: { skills: {} }, data, dockedStationId: 'S', stock: 1 };
  // Schildextender: PG 1 und CPU 25 überschreiten, Skill fehlt → powergrid zuerst
  assert.equal(checkEquip({ ...base, slot: 'mid', index: 0, moduleId: 'mod.shield_extender_s' }).error, 'fit.powergrid');
  // Falscher Slot-Typ gewinnt gegen Größe/PG/Skill
  assert.equal(checkEquip({ ...base, slot: 'low', index: 0, moduleId: 'mod.shield_extender_m' }).error, 'fit.slot_type');
  // Größe vor PG
  assert.equal(checkEquip({ ...base, slot: 'mid', index: 0, moduleId: 'mod.shield_extender_m' }).error, 'fit.size');
});

test('Fehlerklasse fit.skill: Skill-Anforderung blockiert den Einbau (need/have/skillId)', () => {
  const game = makeGame(); // Startskills: nur Raumschiffkommando, Bergbau, Bergbaufregatte
  const res = equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'fit.skill');
  assert.equal(res.skillId, 'skill.shield_management');
  assert.equal(res.need, 1);
  assert.equal(res.have, 0);
  assert.equal(game.state.assets.ships[0].fitting.mid[0], null);
  assert.equal(game.state.assets.stations[STATION].items['mod.shield_extender_s'], 1);
  // mit Skill geht es
  game.state.pilot.skills['skill.shield_management'] = { sp: 250, level: 1 };
  assert.equal(equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s').ok, true);
});

test('Fehlerklasse fit.no_module: nicht im Stationslager / unbekannte ID', () => {
  const game = makeGame({ skills: ALL5, items: {} });
  const res = equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s');
  assert.equal(res.error, 'fit.no_module');
  assert.equal(equip(game, 'u1', 'mid', 0, 'mod.gibt_es_nicht').error, 'fit.no_module');
  assert.equal(equip(game, 'u1', 'mid', 7, 'mod.shield_extender_s').error, 'fit.slot_type'); // Position existiert nicht
});

test('Startmodule des Teststarts: Einbau scheitert korrekt an Skills bzw. Hardpoints (Dokumentation des Ist-Zustands)', () => {
  const game = makeGame();
  const reasons = {};
  const slotOf = { 'mod.mining_upgrade_1': ['low', 0], 'mod.shield_extender_s': ['mid', 0], 'mod.armor_plate_s': ['low', 0], 'mod.autocannon_s': ['high', 2], 'mod.rig_cargo_s': ['rig', 0] };
  for (const [id, [slot, index]] of Object.entries(slotOf)) reasons[id] = game.select('fitting/canFit', { uid: 'u1', slot, index, moduleId: id }).error;
  assert.deepEqual(reasons, {
    'mod.mining_upgrade_1': 'fit.skill', 'mod.shield_extender_s': 'fit.skill', 'mod.armor_plate_s': 'fit.skill',
    'mod.autocannon_s': 'fit.hardpoints', 'mod.rig_cargo_s': 'fit.skill'
  });
});

test('Ausbau: Modul kommt ins Stationslager zurück, Slot leer', () => {
  const game = makeGame({ skills: ALL5 });
  const res = game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 });
  assert.deepEqual(res, { ok: true, destroyed: false });
  assert.equal(game.state.assets.ships[0].fitting.high[0], null);
  assert.equal(game.state.assets.stations[STATION].items['mod.miner_1'], 1);
  assert.equal(game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 }).error, 'fit.no_module'); // leer
});

test('Rig-Ausbau zerstört den Rig und braucht confirm:true', () => {
  const game = makeGame({ skills: ALL5 });
  assert.equal(equip(game, 'u1', 'rig', 0, 'mod.rig_cargo_s').ok, true);
  const before = JSON.stringify(game.state);
  const res = game.dispatch('fitting/unequip', { uid: 'u1', slot: 'rig', index: 0 });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'fit.rig_confirm');
  assert.equal(res.needsConfirm, true);
  assert.equal(JSON.stringify(game.state), before);
  const events = [];
  game.on('fitting/changed', (p) => events.push(p));
  const done = game.dispatch('fitting/unequip', { uid: 'u1', slot: 'rig', index: 0, confirm: true });
  assert.deepEqual(done, { ok: true, destroyed: true });
  assert.equal(game.state.assets.ships[0].fitting.rig[0], null);
  assert.equal(game.state.assets.stations[STATION].items['mod.rig_cargo_s'], undefined); // zerstört, nicht zurückgelegt
  assert.deepEqual(events, [{ uid: 'u1' }]);
});

test('Ausbau eines PG-Lieferanten, der das Schiff überlasten würde, wird verhindert', async () => {
  const { synthData } = await import('./fitting.helpers.mjs');
  const { checkRemoval } = await import('../js/systems/fitting/validate.js');
  const provider = { id: 'mod.t_pgprov', name: 'T', slot: 'low', group: 'reactor_control', category: 'engineering', size: 'small', fitting: { powergrid: 0, cpu: 0 }, requires: {}, effects: [{ stat: 'powergrid_bonus', op: 'mul', value: 1.5, stackingGroup: 'powergrid_bonus' }], price: 1 };
  const tiny = { ...DATA.ships['ship.dart'], id: 'ship.t_rc', fitting: { powergrid: 10, cpu: 300, calibration: 400 } };
  const data = synthData({ ships: [tiny], modules: [provider] });
  const ship = { uid: 'x', typeId: tiny.id, stationId: 'S', fitting: emptyFitting(tiny) };
  ship.fitting.low = ['mod.t_pgprov', 'mod.armor_plate_s', 'mod.armor_plate_s']; // 10 PG von 15
  ship.fitting.mid = ['mod.afterburner_s', null, null]; // +4 → 14 von 15
  const p = { ship, pilot: { skills: {} }, data, dockedStationId: 'S' };
  const r = checkRemoval({ ...p, slot: 'low', index: 0 });
  assert.deepEqual([r.ok, r.error, r.need, r.have], [false, 'fit.powergrid', 14, 10]);
  assert.equal(checkRemoval({ ...p, slot: 'low', index: 1 }).ok, true); // Verbraucher darf raus
});

test('Lagerbilanz: Modul wird nie dupliziert oder geht verloren (Ein-/Ausbau-Folge)', () => {
  const game = makeGame({ skills: ALL5 });
  const start = countModules(game.state);
  const ops = [
    ['equip', { uid: 'u1', slot: 'mid', index: 0, moduleId: 'mod.shield_extender_s' }],
    ['equip', { uid: 'u1', slot: 'low', index: 0, moduleId: 'mod.armor_plate_s' }],
    ['equip', { uid: 'u1', slot: 'mid', index: 0, moduleId: 'mod.shield_extender_s' }], // belegt → Fehler
    ['unequip', { uid: 'u1', slot: 'mid', index: 0 }],
    ['equip', { uid: 'u1', slot: 'mid', index: 1, moduleId: 'mod.shield_extender_s' }],
    ['unequip', { uid: 'u1', slot: 'high', index: 1 }],
    ['equip', { uid: 'u1', slot: 'high', index: 1, moduleId: 'mod.miner_1' }],
    ['equip', { uid: 'u1', slot: 'high', index: 2, moduleId: 'mod.miner_1' }] // kein Bestand mehr / Hardpoint
  ];
  for (const [kind, payload] of ops) {
    game.dispatch(`fitting/${kind}`, payload);
    assert.deepEqual(countModules(game.state), start, `${kind} ${JSON.stringify(payload)}`);
  }
  for (const q of Object.values(game.state.assets.stations[STATION].items)) assert.ok(q > 0 && Number.isInteger(q));
});

test('Fehlschläge ändern den State nie', () => {
  const game = makeGame();
  const before = JSON.stringify(game.state);
  for (const p of [
    { uid: 'u1', slot: 'mid', index: 0, moduleId: 'mod.shield_extender_s' }, // Skill
    { uid: 'u1', slot: 'low', index: 0, moduleId: 'mod.miner_1' },
    { uid: 'nix', slot: 'mid', index: 0, moduleId: 'mod.shield_extender_s' }
  ]) assert.equal(equip(game, p.uid, p.slot, p.index, p.moduleId).ok, false);
  assert.equal(JSON.stringify(game.state), before);
});

test('preview verändert den State nie; delta zeigt Differenzen nach Pfad', () => {
  const game = makeGame({ skills: ALL5 });
  const before = JSON.stringify(game.state);
  const pv = game.select('fitting/preview', { uid: 'u1', slot: 'low', index: 0, moduleId: 'mod.mining_upgrade_1' });
  assert.equal(JSON.stringify(game.state), before);
  assert.equal(pv.check.ok, true);
  assert.ok(pv.delta['mining.m3PerTick'] > 0);
  assert.ok(pv.delta['fitting.cpu.used'] > 0);
  assert.ok(!('nav.speed' in pv.delta));
  const cur = game.select('fitting/stats', { uid: 'u1' });
  assert.ok(Math.abs(pv.stats.mining.m3PerTick - cur.mining.m3PerTick - pv.delta['mining.m3PerTick']) < 1e-6);
  // Preview ohne Modul (Ausbau eines Miners)
  const out = game.select('fitting/preview', { uid: 'u1', slot: 'high', index: 0, moduleId: null });
  assert.equal(out.check.ok, true);
  assert.ok(out.delta['mining.m3PerTick'] < 0);
  assert.equal(JSON.stringify(game.state), before);
  // Preview eines nicht ausrüstbaren Moduls zeigt check mit Grund
  const bad = game.select('fitting/preview', { uid: 'u1', slot: 'mid', index: 0, moduleId: 'mod.launcher_s' });
  assert.equal(bad.check.error, 'fit.slot_type');
  assert.equal(JSON.stringify(game.state), before);
});

test('moduleList: nur Lagerbestand, auch nicht ausrüstbare mit Grund; Filter, Suche, Sortierung', () => {
  const game = makeGame(); // Startskills → fast nichts ausrüstbar
  const mid = game.select('fitting/moduleList', { uid: 'u1', slot: 'mid' });
  assert.deepEqual(mid.map((r) => r.moduleId), ['mod.shield_extender_s']);
  assert.equal(mid[0].qtyInStation, 1);
  assert.equal(mid[0].check.error, 'fit.skill');
  assert.deepEqual(Object.keys(mid[0]).sort(), ['category', 'check', 'fitting', 'group', 'moduleId', 'name', 'qtyInStation', 'size']);
  assert.deepEqual(Object.keys(mid[0].fitting).sort(), ['calibration', 'cpu', 'powergrid']);
  assert.equal(game.select('fitting/moduleList', { uid: 'u1', slot: 'mid', group: 'afterburner' }).length, 0);
  assert.equal(game.select('fitting/moduleList', { uid: 'u1', slot: 'mid', search: 'schild' }).length, 1);
  assert.equal(game.select('fitting/moduleList', { uid: 'u1', slot: 'mid', search: 'xyz' }).length, 0);
  const all = game.select('fitting/moduleList', { uid: 'u1', slot: 'mid', includeUnowned: true });
  assert.ok(all.length > 10);
  assert.ok(all.every((r) => DATA.modules[r.moduleId].slot === 'mid'));
  const sorted = [...all].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name, 'de'));
  assert.deepEqual(all.map((r) => r.moduleId), sorted.map((r) => r.moduleId));
  const unowned = all.find((r) => r.qtyInStation === 0);
  assert.ok(unowned.check.ok === false);
});

test('Selektoren: fitting/stats für unbekannte uid → null; moduleList ohne Dock → leer-sicher', () => {
  const game = makeGame();
  assert.equal(game.select('fitting/stats', { uid: 'nix' }), null);
  assert.deepEqual(game.select('fitting/moduleList', { uid: 'nix', slot: 'mid' }), []);
  game.state.pilot.location.dockedStationId = null;
  const rows = game.select('fitting/moduleList', { uid: 'u1', slot: 'mid' });
  assert.deepEqual(rows, []);
});

test('Access: bevorzugt Selektoren skills/level und travel/isDocked, sonst state.pilot', () => {
  const fakeSkills = { id: 'skills', selectors: { 'skills/level': (s, d, args) => (args.skillId === 'skill.shield_management' ? 3 : 0) } };
  const fakeTravel = { id: 'travel', selectors: { 'travel/isDocked': () => false } };
  const game = makeGame({ extraSystems: [fakeSkills] });
  assert.equal(equip(game, 'u1', 'mid', 0, 'mod.shield_extender_s').ok, true); // Skill nur über Selektor vorhanden
  const g2 = makeGame({ extraSystems: [fakeTravel], skills: ALL5 });
  assert.equal(equip(g2, 'u1', 'mid', 0, 'mod.shield_extender_s').error, 'fit.not_docked');
});

test('Schiffsvoraussetzungen (ship.skill) für ships/board', () => {
  const ok = checkShipRequirements(DATA.ships['ship.pebble'], { skills: { 'skill.spaceship_command': { level: 1 }, 'skill.mining_frigate': { level: 1 } } }, DATA);
  assert.equal(ok.ok, true);
  const bad = checkShipRequirements(DATA.ships['ship.warden'], { skills: {} }, DATA);
  assert.equal(bad.error, 'ship.skill');
  assert.equal(bad.message, 'Dir fehlen Skills für dieses Schiff.');
});

test('stats.errors: ungültiges Fitting listet alle Fehler (Slot-Typ, Größe, Skill, Hardpoints, PG)', () => {
  const bad = { typeId: 'ship.pebble', fitting: { high: ['mod.miner_1', 'mod.miner_1', 'mod.miner_1'], mid: ['mod.miner_1', null, null], low: [null], rig: [null, null] } };
  const s = calcShipStats(bad, { skills: {} }, DATA);
  assert.equal(s.valid, false);
  const codes = s.errors.map((e) => e.code);
  for (const c of ['fit.slot_type', 'fit.skill', 'fit.hardpoints']) assert.ok(codes.includes(c), c);
  for (const e of s.errors) assert.deepEqual(Object.keys(e).filter((k) => ['code', 'slot', 'index', 'moduleId', 'message', 'need', 'have'].includes(k)).sort(), ['code', 'have', 'index', 'message', 'moduleId', 'need', 'slot']);
});
