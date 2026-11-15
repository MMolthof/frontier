import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcShipStats, combineEffects, penaltyWeight, MAX_RESIST } from '../js/systems/fitting/stats.js';
import { DATA, BALANCE, allSkills, pilotWith, synthData, emptyFitting } from './fitting.helpers.mjs';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b}`);
const W = [1, 0.869120, 0.570583, 0.282955, 0.105993]; // exp(-(i/2.67)^2)

// Testschiff: pebble-Werte, viele Slots, kein Kosten-Limit
const TEST_SHIP = {
  ...DATA.ships['ship.pebble'], id: 'ship.t_big', name: 'T', slots: { high: 3, mid: 6, low: 8, rig: 3 },
  hardpoints: { turret: 3, launcher: 0 }, fitting: { powergrid: 1000, cpu: 1000, calibration: 400 }, bonuses: [], roleBonuses: []
};
// Lance ohne Hüll-/Rollenboni: reine Modul- und Skill-Werte
const LANCE0 = { ...DATA.ships['ship.lance'], id: 'ship.t_lance', bonuses: [], roleBonuses: [] };
const mod = (id, slot, effects, extra = {}) => ({
  id, name: id, slot, group: extra.group ?? `g_${id}`, category: 'rig', size: 'small', fitting: { powergrid: 0, cpu: 0 }, requires: {}, effects, price: 1, ...extra
});

function statsWith(moduleDefs, { shipDef = TEST_SHIP, pilot = {}, place } = {}) {
  const data = synthData({ modules: moduleDefs, ships: [shipDef] });
  const fitting = emptyFitting(shipDef);
  moduleDefs.forEach((m) => { const slot = place?.(m) ?? m.slot; const i = fitting[slot].indexOf(null); fitting[slot][i] = m.id; });
  return calcShipStats({ typeId: shipDef.id, fitting }, pilot, data);
}

test('Stacking-Gewichte: 1 / 0,87 / 0,57 / 0,28 / 0,11', () => {
  W.forEach((w, i) => close(penaltyWeight(i), w, 1e-5, `i=${i}`));
  [1, 0.87, 0.57, 0.28, 0.11].forEach((w, i) => close(penaltyWeight(i), w, 0.006));
});

test('combineEffects mul: gleiche Gruppe sortiert absteigend nach Stärke, bestraft', () => {
  const r = combineEffects([{ value: 1.05, group: 'g' }, { value: 1.2, group: 'g' }, { value: 1.1, group: 'g' }], 'mul');
  close(r, (1 + 0.2 * W[0]) * (1 + 0.1 * W[1]) * (1 + 0.05 * W[2]), 1e-6);
});

test('combineEffects add: gleiche Gruppe bestraft (Summe der gewichteten Werte)', () => {
  close(combineEffects([{ value: 0.1, group: 'g' }, { value: 0.16, group: 'g' }, { value: 0.12, group: 'g' }], 'add'), 0.16 * W[0] + 0.12 * W[1] + 0.1 * W[2], 1e-6);
});

test('combineEffects: ohne Gruppe keine Strafe, verschiedene Gruppen unabhängig', () => {
  close(combineEffects([{ value: 1.1 }, { value: 1.1 }], 'mul'), 1.21, 1e-9);
  close(combineEffects([{ value: 1.1, group: 'a' }, { value: 1.1, group: 'b' }], 'mul'), 1.21, 1e-9);
  close(combineEffects([{ value: 5 }, { value: 5 }], 'add'), 10, 1e-9);
});

test('Gold: mul-Stacking auf mining_yield (Mining-Upgrade, 1…5 Module)', () => {
  const up = (n) => Array.from({ length: n }, (_, i) => mod(`mod.t_up${n}_${i}`, 'low', [{ stat: 'mining_yield', op: 'mul', value: 1.1, stackingGroup: 'mining_yield' }]));
  const base = (extra) => {
    const data = synthData({ modules: extra, ships: [TEST_SHIP] });
    const f = emptyFitting(TEST_SHIP);
    f.high[0] = 'mod.miner_1'; f.high[1] = 'mod.miner_1';
    extra.forEach((m, i) => { f.low[i] = m.id; });
    return calcShipStats({ typeId: TEST_SHIP.id, fitting: f }, {}, data).mining.m3PerTick;
  };
  const raw = (2 * 2.3) / 5; // 0,92 m³/Tick, keine Skills, keine Boni
  close(base([]), raw, 1e-9);
  let factor = 1; // Produkt der gewichteten Einzelfaktoren (1 + 0,1·w_i)
  for (let n = 1; n <= 5; n++) {
    factor *= 1 + 0.1 * W[n - 1];
    close(base(up(n)), raw * factor, 1e-5, `n=${n}`);
  }
});

test('Gold: add-Stacking (Schildresistenz-Module) und Resist-Klemme 0,95', () => {
  const r = (v, i) => mod(`mod.t_res${i}`, 'mid', ['em', 'th', 'kin', 'exp'].map((t) => ({ stat: `shield_res_${t}`, op: 'add', value: v, stackingGroup: 'shield_resist' })));
  const three = statsWith([r(0.16, 0), r(0.12, 1), r(0.1, 2)]);
  const baseRes = TEST_SHIP.attributes;
  const gain = 0.16 * W[0] + 0.12 * W[1] + 0.1 * W[2];
  close(three.defense.shield.res.em, baseRes.shield_res_em + gain, 1e-6);
  close(three.defense.shield.res.exp, Math.min(MAX_RESIST, baseRes.shield_res_exp + gain), 1e-6);
  // Klemme: Skills + Module treiben exp auf > 0,95
  const many = statsWith([r(0.16, 0), r(0.16, 1), r(0.16, 2), r(0.16, 3)], { pilot: pilotWith({ 'skill.tactical_shield_manipulation': 5 }) });
  assert.equal(many.defense.shield.res.exp, 0.95);
  assert.ok(many.defense.shield.res.em <= 0.95);
  for (const t of ['em', 'th', 'kin', 'exp']) assert.ok(many.defense.shield.res[t] <= 0.95);
});

test('Skill-Resistenz (add) wird nie bestraft und addiert sich zu Basis und Modulen', () => {
  const s = statsWith([], { pilot: pilotWith({ 'skill.tactical_shield_manipulation': 5 }) });
  close(s.defense.shield.res.em, TEST_SHIP.attributes.shield_res_em + 0.05, 1e-9);
});

test('Hardpoint-Reihenfolge: add vor mul; Hüll-/Rollenboni und Skills ohne Strafe', () => {
  // Pebble: Rollenbonus x2, Hüllenbonus 5 %/Stufe (mining_frigate), Skill mining 5 %/Stufe (nur mining_laser)
  const f = emptyFitting(DATA.ships['ship.pebble']);
  f.high[0] = 'mod.miner_1';
  const s = calcShipStats({ typeId: 'ship.pebble', fitting: f }, pilotWith({ 'skill.mining': 4, 'skill.mining_frigate': 3 }), DATA);
  close(s.mining.m3PerTick, (2.3 / 5) * 2 * (1 + 0.05 * 3) * (1 + 0.05 * 4), 1e-9);
});

test('Gold: Starterschiff mit Startfitting und Startskills ≈ 2,0286 m³/Tick', () => {
  const ship = { typeId: BALANCE.startShip, fitting: BALANCE.startFitting };
  const s = calcShipStats(ship, pilotWith(BALANCE.startSkills), DATA);
  close(s.mining.m3PerTick, 0.92 * 2 * 1.05 * 1.05, 1e-9);
  assert.equal(s.mining.lasers, 2);
  assert.equal(s.valid, true);
  assert.deepEqual(s.slots.high.hardpoints.turret, { used: 2, max: 2 });
  assert.equal(s.slots.high.used, 2);
  assert.equal(s.fitting.pg.used, 2);
  assert.equal(s.fitting.cpu.used, 40);
});

test('Mul-Stats haben Basis 1,0: powergrid_bonus/cpu_bonus skalieren PG und CPU', () => {
  const rc = mod('mod.t_rc', 'low', [{ stat: 'powergrid_bonus', op: 'mul', value: 1.1, stackingGroup: 'powergrid_bonus' }]);
  const s0 = statsWith([]);
  const s1 = statsWith([rc]);
  close(s0.fitting.pg.max, 1000);
  close(s1.fitting.pg.max, 1100);
  const sk = statsWith([rc], { pilot: pilotWith({ 'skill.power_grid_management': 4, 'skill.electronics': 2 }) });
  close(sk.fitting.pg.max, 1000 * 1.1 * (1 + 0.05 * 4), 0.01);
  close(sk.fitting.cpu.max, 1000 * (1 + 0.05 * 2), 0.01);
});

test('Calibration: Basis + Rigging (add, 10 je Stufe)', () => {
  close(statsWith([], { pilot: pilotWith({ 'skill.rigging': 5 }) }).fitting.calibration.max, 450);
});

test('Mining-Upgrade: CPU-Verbrauch × cpu_penalty_mining_upgrade (Skill Mining-Upgrades senkt)', () => {
  const f = emptyFitting(TEST_SHIP);
  f.low[0] = 'mod.mining_upgrade_1';
  const data = synthData({ ships: [TEST_SHIP] });
  const none = calcShipStats({ typeId: TEST_SHIP.id, fitting: f }, {}, data);
  const skilled = calcShipStats({ typeId: TEST_SHIP.id, fitting: f }, pilotWith({ 'skill.mining_upgrades': 5 }), data);
  close(none.fitting.cpu.used, 20);
  close(skilled.fitting.cpu.used, 20 * 0.75);
});

test('Waffen: DPS = Schaden · Multiplikator · rof / cycleTicks; appliesTo trennt Waffengruppen', () => {
  const data = synthData({ ships: [LANCE0] });
  const f = emptyFitting(LANCE0);
  f.high[0] = 'mod.autocannon_s'; // kin 9 + exp 7, Zyklus 1
  f.high[1] = 'mod.pulse_cannon_s';
  const s = calcShipStats({ typeId: LANCE0.id, fitting: f }, pilotWith({ 'skill.gunnery': 5, 'skill.projectile_turrets': 4, 'skill.rapid_firing': 5 }), data);
  const rof = 1 + 0.04 * 5;
  const gun = 1 + 0.02 * 5;
  const projectile = 16 * gun * (1 + 0.05 * 4) * rof;
  const pulse = (DATA.modules['mod.pulse_cannon_s'].activation.damage.em + DATA.modules['mod.pulse_cannon_s'].activation.damage.th + DATA.modules['mod.pulse_cannon_s'].activation.damage.kin + DATA.modules['mod.pulse_cannon_s'].activation.damage.exp) * gun * rof;
  close(s.offense.weapons[0].dps, projectile, 1e-6);
  close(s.offense.weapons[1].dps, pulse, 1e-6);
  close(s.offense.dps.total, projectile + pulse, 1e-6);
  close(s.offense.dps.kin + s.offense.dps.exp + s.offense.dps.em + s.offense.dps.th, s.offense.dps.total, 1e-6);
});

test('Waffenmodule derselben Gruppe stacken mit Strafe, Module anderer Gruppe nicht', () => {
  const data = synthData({ ships: [LANCE0] });
  const f = emptyFitting(LANCE0);
  f.high[0] = 'mod.autocannon_s';
  f.low[0] = 'mod.gyrostabilizer_s'; f.low[1] = 'mod.gyrostabilizer_s'; f.low[2] = 'mod.heat_sink_s';
  const s = calcShipStats({ typeId: LANCE0.id, fitting: f }, {}, data);
  const g = DATA.modules['mod.gyrostabilizer_s'].effects[0].value;
  close(s.offense.weapons[0].dps, 16 * (1 + (g - 1) * W[0]) * (1 + (g - 1) * W[1]), 1e-4);
});

test('Verteidigung: HP aus Basis + add, Skill-mul, EHP aus Mittel-Resist', () => {
  const f = emptyFitting(DATA.ships['ship.pebble']);
  f.mid[0] = 'mod.shield_extender_s'; // +150
  const s = calcShipStats({ typeId: 'ship.pebble', fitting: f }, pilotWith({ 'skill.shield_management': 2 }), DATA);
  close(s.defense.shield.hp, (520 + 150) * 1.1, 1e-9);
  const res = DATA.ships['ship.pebble'].attributes;
  const avg = (l) => (res[`${l}_res_em`] + res[`${l}_res_th`] + res[`${l}_res_kin`] + res[`${l}_res_exp`]) / 4;
  close(s.defense.ehp, s.defense.shield.hp / (1 - avg('shield')) + 380 / (1 - avg('armor')) + 420, 1e-6);
});

test('Kapazität: Verbrauch, Nachladen, Stabilität', () => {
  const f = emptyFitting(DATA.ships['ship.pebble']);
  f.mid[2] = 'mod.afterburner_s'; // capUse 1, Zyklus 1
  const s = calcShipStats({ typeId: 'ship.pebble', fitting: f }, {}, DATA);
  close(s.capacitor.usePerTick, 1);
  close(s.capacitor.rechargePerTick, 320 / 4);
  assert.equal(s.capacitor.stable, true);
  assert.equal(s.capacitor.stableForTicks, null);
  const heavy = { ...TEST_SHIP, attributes: { ...TEST_SHIP.attributes, capacitor: 100, cap_recharge_ticks: 10 } };
  const hungry = mod('mod.t_hungry', 'mid', [], { activation: { kind: 'boost', cycleTicks: 1, capUse: 30 } });
  const u = statsWith([hungry], { shipDef: heavy });
  assert.equal(u.capacitor.stable, false);
  assert.equal(u.capacitor.stableForTicks, Math.floor(100 / (30 - 10)));
});

test('Navigation und Mining-Felder in Form von MASTER_PLAN 3.9', () => {
  const s = calcShipStats({ typeId: 'ship.pebble', fitting: emptyFitting(DATA.ships['ship.pebble']) }, {}, DATA);
  assert.deepEqual(Object.keys(s.nav).sort(), ['lockRangeKm', 'maxTargets', 'signature', 'speed', 'warpSpeed', 'warpTicksPerAu']);
  assert.deepEqual(Object.keys(s).sort(), ['capacitor', 'defense', 'errors', 'fitting', 'mining', 'nav', 'offense', 'repair', 'slots', 'valid']);
  for (const k of ['lasers', 'm3PerTick', 'oreHold', 'cargo']) assert.ok(k in s.mining);
  assert.equal(s.nav.maxTargets, 3);
  close(s.nav.warpTicksPerAu, 1 / 3, 1e-9);
});

test('calcShipStats ist rein: gleiche Eingabe → gleiche Ausgabe, Eingaben bleiben unverändert', () => {
  const ship = { typeId: 'ship.warden', fitting: { high: ['mod.rail_cannon_m', null, null, null, null], mid: [null, null, null], low: ['mod.armor_plate_m', null, null, null, null], rig: [null, null, null] } };
  const pilot = pilotWith({ 'skill.gunnery': 3 });
  const before = JSON.stringify([ship, pilot]);
  const a = calcShipStats(ship, pilot, DATA);
  const b = calcShipStats(ship, pilot, DATA);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify([ship, pilot]), before);
  assert.doesNotThrow(() => JSON.stringify(a));
});

test('Pilot ohne Skills und Pilot mit Zahlen-Stufen werden akzeptiert', () => {
  const ship = { typeId: 'ship.pebble', fitting: emptyFitting(DATA.ships['ship.pebble']) };
  assert.doesNotThrow(() => calcShipStats(ship, {}, DATA));
  assert.doesNotThrow(() => calcShipStats(ship, undefined, DATA));
  const a = calcShipStats({ ...ship, fitting: { ...ship.fitting, mid: ['mod.shield_extender_s', null, null] } }, { skills: { 'skill.shield_management': 2 } }, DATA);
  close(a.defense.shield.hp, (520 + 150) * 1.1, 1e-9);
});
