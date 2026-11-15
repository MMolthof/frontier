// Prüft die A2-Daten mit der Fitting-Engine (Auftrag A4, Punkt 6) und liefert je Schiff einen Referenz-Fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, BALANCE, allSkills, emptyFitting } from './fitting.helpers.mjs';
import { calcShipStats } from '../js/systems/fitting/stats.js';
import { checkEquip } from '../js/systems/fitting/validate.js';

const SLOTS = ['high', 'mid', 'low', 'rig'];
const ALL5 = { skills: allSkills(5) };
const NONE = { skills: {} };

// Plausibler Referenz-Fit je Schiff (je Rumpf, gleiche Größe wie der Rumpf). Unabhängig von tools/validate-data.mjs gepflegt.
const REF = {
  'ship.pebble': { high: ['mod.miner_1', 'mod.miner_1', 'mod.survey_scanner_s'], mid: ['mod.shield_extender_s', 'mod.cap_recharger_s', 'mod.afterburner_s'], low: ['mod.mining_upgrade_1'], rig: ['mod.rig_cargo_s', 'mod.rig_mining_s'] },
  'ship.digger': { high: ['mod.miner_1', 'mod.miner_1', 'mod.miner_1', 'mod.survey_scanner_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s', 'mod.cap_recharger_s'], low: ['mod.mining_upgrade_1', 'mod.mining_upgrade_1', 'mod.armor_plate_s'], rig: ['mod.rig_cargo_s', 'mod.rig_mining_s'] },
  'ship.delver': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.strip_miner_1'], mid: ['mod.shield_extender_m', 'mod.shield_booster_m'], low: ['mod.mining_upgrade_m1', 'mod.mining_upgrade_m1', 'mod.mining_upgrade_m1'], rig: ['mod.rig_cargo_m', 'mod.rig_mining_m', 'mod.rig_armor_m'] },
  'ship.vault': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.survey_scanner_m'], mid: ['mod.shield_extender_m', 'mod.afterburner_m', 'mod.cap_recharger_m'], low: ['mod.mining_upgrade_m1', 'mod.armor_plate_m'], rig: ['mod.rig_cargo_m', 'mod.rig_mining_m', 'mod.rig_power_m'] },
  'ship.bulwark': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.survey_scanner_m'], mid: ['mod.shield_extender_m', 'mod.shield_extender_m', 'mod.shield_booster_m', 'mod.shield_resist_m'], low: ['mod.armor_plate_m', 'mod.mining_upgrade_m1'], rig: ['mod.rig_cargo_m', 'mod.rig_shield_m', 'mod.rig_armor_m'] },
  'ship.dart': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.shield_booster_s', 'mod.afterburner_s'], low: ['mod.armor_plate_s', 'mod.armor_plate_s', 'mod.armor_plate_s'], rig: ['mod.rig_weapon_s', 'mod.rig_shield_s', 'mod.rig_nav_s'] },
  'ship.cinder': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s'], low: ['mod.armor_plate_s', 'mod.armor_plate_s', 'mod.armor_repairer_s', 'mod.gyrostabilizer_s'], rig: ['mod.rig_armor_s', 'mod.rig_weapon_s'] },
  'ship.sparrow': { high: ['mod.launcher_s', 'mod.launcher_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.shield_booster_s', 'mod.afterburner_s', 'mod.signal_amplifier_s'], low: ['mod.ballistic_control_s', 'mod.armor_plate_s'], rig: ['mod.rig_shield_s', 'mod.rig_nav_s'] },
  'ship.lance': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s'], low: ['mod.gyrostabilizer_s', 'mod.armor_plate_s', 'mod.armor_plate_s'], rig: ['mod.rig_weapon_s', 'mod.rig_nav_s'] },
  'ship.warden': { high: ['mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.launcher_m'], mid: ['mod.shield_extender_m', 'mod.afterburner_m', 'mod.cap_recharger_m'], low: ['mod.armor_plate_m', 'mod.armor_plate_m', 'mod.armor_repairer_m', 'mod.magnetic_stabilizer_m', 'mod.armor_resist_m'], rig: ['mod.rig_armor_m', 'mod.rig_weapon_m', 'mod.rig_nav_m'] },
  'ship.corvid': { high: ['mod.launcher_m', 'mod.launcher_m', 'mod.launcher_m', 'mod.launcher_m', 'mod.pulse_cannon_m'], mid: ['mod.shield_extender_m', 'mod.shield_extender_m', 'mod.shield_booster_m', 'mod.afterburner_m', 'mod.signal_amplifier_m'], low: ['mod.ballistic_control_m', 'mod.hull_reinforcement_m', 'mod.armor_plate_m'], rig: ['mod.rig_shield_m', 'mod.rig_nav_m', 'mod.rig_power_m'] },
  'ship.bastion': { high: ['mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.launcher_l'], mid: ['mod.shield_extender_l', 'mod.afterburner_l', 'mod.cap_recharger_l', 'mod.shield_booster_l'], low: ['mod.armor_plate_l', 'mod.armor_plate_l', 'mod.armor_repairer_l', 'mod.magnetic_stabilizer_l', 'mod.reactor_control_l'], rig: ['mod.rig_armor_l', 'mod.rig_weapon_l'] },
  'ship.sovereign': { high: ['mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.launcher_l'], mid: ['mod.shield_extender_l', 'mod.shield_extender_l', 'mod.afterburner_l', 'mod.cap_recharger_l', 'mod.shield_booster_l'], low: ['mod.armor_plate_l', 'mod.armor_plate_l', 'mod.armor_repairer_l', 'mod.magnetic_stabilizer_l', 'mod.magnetic_stabilizer_l', 'mod.reactor_control_l'], rig: ['mod.rig_armor_l', 'mod.rig_weapon_l'] },
  'ship.mule': { high: [], mid: ['mod.afterburner_m', 'mod.shield_extender_m', 'mod.cap_recharger_m'], low: ['mod.armor_plate_m', 'mod.hull_reinforcement_m', 'mod.coprocessor_m'], rig: ['mod.rig_cargo_m', 'mod.rig_cargo_m', 'mod.rig_nav_m'] }
};

const placed = (ship, ref) => {
  const f = emptyFitting(ship);
  for (const slot of SLOTS) ref[slot].forEach((id, i) => { f[slot][i] = id; });
  return f;
};

test('Es gibt für alle 14 Schiffe einen Referenz-Fit', () => {
  assert.equal(DATA.lists.ships.length, 14);
  assert.deepEqual(Object.keys(REF).sort(), DATA.lists.ships.map((s) => s.id).sort());
});

for (const ship of DATA.lists.ships) {
  test(`Referenz-Fit ${ship.id}: gültig, Budgets eingehalten, Rolle plausibel (alle Skills Stufe 5)`, () => {
    const s = calcShipStats({ typeId: ship.id, fitting: placed(ship, REF[ship.id]) }, ALL5, DATA);
    assert.deepEqual(s.errors, [], `${ship.id}: ${JSON.stringify(s.errors)}`);
    assert.equal(s.valid, true);
    for (const k of ['pg', 'cpu', 'calibration']) assert.ok(s.fitting[k].used <= s.fitting[k].max, `${ship.id} ${k}`);
    assert.ok(s.capacitor.stable, `${ship.id}: Kapazität nicht stabil`);
    if (ship.category === 'mining') {
      assert.ok(s.mining.m3PerTick > 0 && s.mining.lasers >= 2 && s.offense.dps.total === 0);
      assert.ok(s.mining.oreHold > 0);
    } else if (ship.category === 'combat') {
      assert.ok(s.offense.dps.total > 0 && s.mining.lasers === 0 && s.mining.oreHold === 0);
      assert.ok(s.offense.rangeKm > 0);
    } else {
      assert.equal(s.offense.dps.total, 0);
      assert.ok(s.mining.cargo >= 10000);
    }
    assert.ok(s.defense.ehp > s.defense.shield.hp + s.defense.armor.hp + s.defense.structure.hp);
    for (const layer of ['shield', 'armor', 'structure']) for (const r of Object.values(s.defense[layer].res)) assert.ok(r >= 0 && r <= 0.95);
  });

  test(`Referenz-Fit ${ship.id}: lässt sich Modul für Modul einbauen, Fehlerfall ohne Skills ist nur fit.skill`, () => {
    const empty = { ...emptyFitting(ship) };
    const ref = REF[ship.id];
    const ships = { uid: 'x', typeId: ship.id, stationId: 'S', fitting: empty };
    for (const slot of SLOTS) {
      ref[slot].forEach((id, index) => {
        const r5 = checkEquip({ ship: ships, slot, index, moduleId: id, pilot: ALL5, data: DATA, dockedStationId: 'S', stock: 1 });
        assert.equal(r5.ok, true, `${ship.id} ${slot}[${index}] ${id}: ${r5.error}`);
        const r0 = checkEquip({ ship: ships, slot, index, moduleId: id, pilot: NONE, data: DATA, dockedStationId: 'S', stock: 1 });
        if (!r0.ok) assert.equal(r0.error, 'fit.skill', `${ship.id} ${id}`);
        ships.fitting[slot][index] = id;
      });
    }
  });
}

test('Daten: Referenz-Fits nutzen ihre Slots vollständig im Rahmen der Schiffsdefinition', () => {
  for (const ship of DATA.lists.ships) for (const slot of SLOTS) assert.ok(REF[ship.id][slot].length <= ship.slots[slot], `${ship.id} ${slot}`);
});

test('Daten: jedes Modul ist allein auf mindestens einem Schiff seiner Größe ausrüstbar (alle Skills 5)', () => {
  for (const m of DATA.lists.modules) {
    const candidates = DATA.lists.ships.filter((s) => s.hull === m.size && s.slots[m.slot] > 0 && (!m.hardpoint || s.hardpoints[m.hardpoint] > 0));
    assert.ok(candidates.length > 0, `${m.id}: kein Rumpf mit passender Größe/Slot/Hardpoint`);
    const fits = candidates.some((s) => checkEquip({ ship: { uid: 'x', typeId: s.id, stationId: 'S', fitting: emptyFitting(s) }, slot: m.slot, index: 0, moduleId: m.id, pilot: ALL5, data: DATA, dockedStationId: 'S', stock: 1 }).ok);
    assert.ok(fits, `${m.id} passt auf keinen Rumpf (PG/CPU/Calibration zu hoch)`);
  }
});

test('Daten: Slot-Typ je Gruppe eindeutig; Hardpoint nur im High-Slot; Rigs nur mit Calibration 50–200 und permanent', () => {
  const slotOf = {};
  for (const m of DATA.lists.modules) {
    assert.ok(SLOTS.includes(m.slot));
    assert.equal(slotOf[m.group] ?? m.slot, m.slot, `Gruppe ${m.group} in mehreren Slot-Typen`);
    slotOf[m.group] = m.slot;
    if (m.hardpoint) assert.equal(m.slot, 'high', m.id);
    if (m.slot === 'rig') {
      assert.equal(m.permanent, true, m.id);
      assert.ok(m.fitting.calibration >= 50 && m.fitting.calibration <= 200, m.id);
      assert.ok(!m.fitting.powergrid && !m.fitting.cpu, `${m.id}: Rig mit PG/CPU`);
    } else assert.ok(!m.fitting.calibration, `${m.id}: Calibration nur für Rigs`);
  }
});

test('Daten: Hardpoint-Summen und Slot-Summen der Schiffe', () => {
  for (const s of DATA.lists.ships) {
    assert.ok(s.hardpoints.turret <= s.slots.high && s.hardpoints.launcher <= s.slots.high, s.id);
    assert.ok(s.hardpoints.turret + s.hardpoints.launcher >= (s.category === 'combat' ? 1 : 0), s.id);
    if (s.category === 'mining') assert.equal(s.hardpoints.launcher, 0, s.id);
    assert.equal(s.fitting.calibration, 400, s.id);
  }
});

test('Daten: Effekte nennen nur bekannte Stats; appliesTo nennt nur vorhandene Modulgruppen', () => {
  const stats = new Set(DATA.lists.stats.map((s) => s.id));
  const groups = new Set(DATA.lists.modules.map((m) => m.group));
  const check = (where, e) => {
    assert.ok(stats.has(e.stat), `${where}: unbekannter Stat ${e.stat}`);
    if (e.appliesTo?.moduleGroup) assert.ok(groups.has(e.appliesTo.moduleGroup), `${where}: Gruppe ${e.appliesTo.moduleGroup}`);
    if (e.op === 'mul' && 'value' in e && where.startsWith('mod.')) assert.ok(e.stackingGroup, `${where}: mul ohne stackingGroup`);
  };
  for (const m of DATA.lists.modules) for (const e of m.effects ?? []) check(m.id, e);
  for (const k of DATA.lists.skills) for (const e of k.effects ?? []) check(k.id, e);
  for (const s of DATA.lists.ships) for (const e of [...s.bonuses, ...s.roleBonuses]) check(s.id, e);
});

test('Daten: Skill-Erreichbarkeit – Modul- und Schiffs-Anforderungen verweisen auf vorhandene Skills, Stufen 1–5, Voraussetzungen ohne Zyklus', () => {
  const closure = (requires, acc = {}) => {
    for (const [id, lvl] of Object.entries(requires ?? {})) {
      assert.ok(DATA.skills[id], `Skill ${id} fehlt`);
      assert.ok(lvl >= 1 && lvl <= 5, `${id} Stufe ${lvl}`);
      if ((acc[id] ?? 0) >= lvl) continue;
      acc[id] = lvl;
      closure(DATA.skills[id].requires, acc);
    }
    return acc;
  };
  for (const m of DATA.lists.modules) closure(m.requires);
  for (const s of DATA.lists.ships) closure(s.requires);
  for (const s of DATA.lists.ships) for (const b of s.bonuses) assert.ok(DATA.skills[b.skill], `${s.id}: Bonus-Skill ${b.skill}`);
});

test('Daten: Tier-2 ist nie schwächer und teurer als Tier 1; Größenstufen s < m < l steigen in Preis und Kosten', () => {
  const strength = (m) => [...(m.effects ?? []).map((e) => Math.abs(e.op === 'mul' ? e.value - 1 : e.value)), ...Object.values(m.activation?.damage ?? {}), m.activation?.amount ?? 0, m.activation?.yieldM3 ?? 0];
  for (const m of DATA.lists.modules.filter((x) => x.id.endsWith('_t2'))) {
    const base = DATA.modules[m.id.slice(0, -3)];
    assert.ok(base, `${m.id}: Basis fehlt`);
    assert.ok(m.price > base.price, `${m.id}: Preis`);
    strength(m).forEach((v, i) => assert.ok(v >= strength(base)[i] - 1e-9, `${m.id}: schwächer`));
  }
  for (const fam of new Set(DATA.lists.modules.map((m) => m.id.replace(/_(s|m|l)(_t2)?$/, '')))) {
    const rows = ['s', 'm', 'l'].map((x) => DATA.modules[`${fam}_${x}`]).filter(Boolean);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].price >= rows[i - 1].price, `${fam}: Preis`);
      for (const k of ['powergrid', 'cpu']) assert.ok((rows[i].fitting[k] ?? 0) >= (rows[i - 1].fitting[k] ?? 0), `${fam}: ${k}`);
    }
  }
});

test('Daten: Startfitting von balance.json ist gültig und braucht nur Startskills', () => {
  const ship = DATA.ships[BALANCE.startShip];
  const pilot = { skills: Object.fromEntries(Object.entries(BALANCE.startSkills).map(([id, level]) => [id, { level }])) };
  const f = emptyFitting(ship);
  for (const [slot, ids] of Object.entries(BALANCE.startFitting)) ids.forEach((id, i) => { f[slot][i] = id; });
  const s = calcShipStats({ typeId: ship.id, fitting: f }, pilot, DATA);
  assert.deepEqual(s.errors, []);
});
