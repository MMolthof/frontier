// MOCK für die Fitting-Ansicht (A5). Bildet die Selektoren/Actions aus MASTER_PLAN 3.9 nach, damit die
// Oberfläche ohne Agent 4 entwickelt und getestet werden kann. Die Zahlen sind ERFUNDEN und dienen nur
// der UI-Entwicklung – keine Referenz für die echte Stat-Pipeline (js/systems/fitting, A4).
// Browserfähig (keine Node-Imports): wird von tests und von js/ui/views/fitting/dev.html genutzt.
// Ersetzen: sobald A4 gemerged ist, nutzt die Ansicht das echte System ohne Änderung (Mock-Zeile aus dev.html entfernen).

import { createGame } from '../../js/core/game.js';
import { createTranslator } from '../../js/util/format.js';

const SLOTS = ['high', 'mid', 'low', 'rig'];
const DMG = ['em', 'th', 'kin', 'exp'];
const LAYERS = ['shield', 'armor', 'structure'];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number' && Number.isFinite(v)) out[path] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
  }
  return out;
}

function createMockSystem({ withLayout, preEquip, stock, extraShips, docked, skills }) {
  let tr = (k) => k;
  const errorMessage = (data, code) => data.i18n?.de?.strings?.[`error.${code}`] ?? code; // wie ein A4 ohne Text: Code als Rückfall

  const typeOf = (data, ship) => data.ships[ship.typeId];
  const level = (state, id) => state.pilot.skills[id]?.level ?? 0;
  const fitted = (ship) => SLOTS.flatMap((slot) => ship.fitting[slot].map((id, index) => (id ? { slot, index, id } : null)).filter(Boolean));

  function stats(state, data, ship) {
    const type = typeOf(data, ship);
    const mods = fitted(ship).map((f) => ({ ...f, def: data.modules[f.id] })).filter((m) => m.def);
    const sum = (fn) => mods.reduce((a, m) => a + fn(m.def), 0);
    const add = (stat) => mods.reduce((a, m) => a + (m.def.effects ?? []).filter((e) => e.stat === stat && e.op === 'add').reduce((x, e) => x + e.value, 0), 0);
    const mul = (stat) => mods.reduce((a, m) => a * (m.def.effects ?? []).filter((e) => e.stat === stat && e.op === 'mul').reduce((x, e) => x * e.value, 1), 1);
    const attr = type.attributes;
    const hp = { shield: attr.shield_hp + add('shield_hp'), armor: attr.armor_hp + add('armor_hp'), structure: attr.structure_hp + add('structure_hp') };
    const defense = {};
    let ehp = 0;
    for (const layer of LAYERS) {
      const res = Object.fromEntries(DMG.map((d) => [d, Math.min(0.95, attr[`${layer}_res_${d}`] ?? 0)]));
      defense[layer] = { hp: hp[layer], res };
      ehp += hp[layer] / (1 - DMG.reduce((a, d) => a + res[d], 0) / 4);
    }
    defense.ehp = Math.round(ehp);
    const weapons = mods.filter((m) => m.def.activation?.kind === 'attack');
    const dps = Object.fromEntries(DMG.map((d) => [d, weapons.reduce((a, m) => a + (m.def.activation.damage[d] ?? 0) / m.def.activation.cycleTicks, 0)]));
    dps.total = DMG.reduce((a, d) => a + dps[d], 0);
    const lasers = mods.filter((m) => m.def.activation?.kind === 'mine');
    const roleMul = (type.roleBonuses ?? []).filter((b) => b.stat === 'mining_yield').reduce((a, b) => a * b.value, 1);
    const m3PerTick = lasers.reduce((a, m) => a + m.def.activation.yieldM3 / m.def.activation.cycleTicks, 0) * roleMul * mul('mining_yield');
    const use = mods.reduce((a, m) => a + (m.def.activation?.capUse ?? 0) / (m.def.activation?.cycleTicks ?? 1), 0);
    const recharge = attr.capacitor / attr.cap_recharge_ticks;
    const stable = use <= recharge;
    const hardpoints = (id) => ({ used: mods.filter((m) => m.def.hardpoint === id).length, max: type.hardpoints?.[id] ?? 0 });
    const pg = { used: sum((d) => (d.slot === 'rig' ? 0 : d.fitting?.powergrid ?? 0)), max: type.fitting.powergrid };
    const cpu = { used: sum((d) => (d.slot === 'rig' ? 0 : d.fitting?.cpu ?? 0)), max: type.fitting.cpu };
    const cal = { used: sum((d) => d.fitting?.calibration ?? 0), max: type.fitting.calibration };
    const errors = [];
    for (const m of mods) {
      const unmet = Object.entries(m.def.requires ?? {}).filter(([id, lv]) => level(state, id) < lv);
      if (unmet.length) errors.push({ code: 'fit.skill', slot: m.slot, index: m.index, moduleId: m.id, message: errorMessage(data, 'fit.skill'), need: Object.fromEntries(unmet), have: null });
    }
    if (pg.used > pg.max) errors.push({ code: 'fit.powergrid', slot: null, index: null, moduleId: null, message: errorMessage(data, 'fit.powergrid'), need: pg.used, have: pg.max });
    if (cpu.used > cpu.max) errors.push({ code: 'fit.cpu', slot: null, index: null, moduleId: null, message: errorMessage(data, 'fit.cpu'), need: cpu.used, have: cpu.max });
    return {
      valid: errors.length === 0, errors,
      fitting: { pg, cpu, calibration: cal },
      slots: Object.fromEntries(SLOTS.map((s) => [s, { total: type.slots[s], used: ship.fitting[s].filter(Boolean).length, ...(s === 'high' ? { hardpoints: { turret: hardpoints('turret'), launcher: hardpoints('launcher') } } : {}) }])),
      defense,
      offense: { dps, rangeKm: weapons.reduce((a, m) => Math.max(a, m.def.activation.rangeKm ?? 0), 0), weapons: weapons.map((m) => ({ moduleId: m.id, dps: 0 })) },
      mining: { lasers: lasers.length, m3PerTick, oreHold: attr.ore_hold * mul('ore_hold'), cargo: attr.cargo },
      capacitor: { max: attr.capacitor, rechargePerTick: recharge, usePerTick: use, stable, stableForTicks: stable ? null : Math.floor(attr.capacitor / (use - recharge)) },
      nav: { speed: attr.speed, warpSpeed: attr.warp_speed, warpTicksPerAu: 1 / attr.warp_speed, signature: attr.signature, maxTargets: attr.max_targets, lockRangeKm: attr.lock_range_km },
      repair: { shieldPerTick: 0, armorPerTick: 0 }
    };
  }

  function check(state, data, ship, slot, index, moduleId) {
    const fail = (error, extra = {}) => ({ ok: false, error, message: errorMessage(data, error), ...extra });
    const stationId = state.pilot.location.dockedStationId;
    if (!stationId || ship.stationId !== stationId) return fail('fit.not_docked');
    const def = data.modules[moduleId];
    if (!def) return fail('fit.no_module');
    if (def.slot !== slot) return fail('fit.slot_type');
    if (ship.fitting[slot][index] !== null && ship.fitting[slot][index] !== undefined) return fail('fit.slot_occupied');
    const type = typeOf(data, ship);
    if (def.size !== type.hull) return fail('fit.size');
    const s = stats(state, data, ship);
    if (def.hardpoint) {
      const hp = s.slots.high.hardpoints[def.hardpoint];
      if (hp.used + 1 > hp.max) return fail('fit.hardpoints', { need: hp.used + 1, have: hp.max });
    }
    if (slot !== 'rig') {
      if (s.fitting.pg.used + (def.fitting.powergrid ?? 0) > s.fitting.pg.max) return fail('fit.powergrid', { need: s.fitting.pg.used + def.fitting.powergrid, have: s.fitting.pg.max });
      if (s.fitting.cpu.used + (def.fitting.cpu ?? 0) > s.fitting.cpu.max) return fail('fit.cpu', { need: s.fitting.cpu.used + def.fitting.cpu, have: s.fitting.cpu.max });
    } else if (s.fitting.calibration.used + (def.fitting.calibration ?? 0) > s.fitting.calibration.max) {
      return fail('fit.calibration', { need: s.fitting.calibration.used + def.fitting.calibration, have: s.fitting.calibration.max });
    }
    const unmet = Object.entries(def.requires ?? {}).filter(([id, lv]) => level(state, id) < lv);
    if (unmet.length) return fail('fit.skill', { need: Object.fromEntries(unmet) });
    if ((state.assets.stations[stationId]?.items?.[moduleId] ?? 0) < 1) return fail('fit.no_module');
    return { ok: true };
  }

  const shipOf = (state, uid) => state.assets.ships.find((s) => s.uid === uid);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  const selectors = {
    'fitting/ships': (state, data) => {
      const st = state.pilot.location.dockedStationId;
      if (!st) return [];
      return state.assets.ships.filter((s) => s.stationId === st).map((s) => ({
        uid: s.uid, typeId: s.typeId, name: s.name, stationId: s.stationId, active: s.uid === state.pilot.activeShipUid, valid: stats(state, data, s).valid
      }));
    },
    'fitting/stats': (state, data, { uid }) => { const s = shipOf(state, uid); return s ? stats(state, data, s) : undefined; },
    'fitting/canFit': (state, data, { uid, slot, index, moduleId }) => check(state, data, shipOf(state, uid), slot, index, moduleId),
    'fitting/preview': (state, data, { uid, slot, index, moduleId }) => {
      const ship = shipOf(state, uid);
      const before = stats(state, data, ship);
      const copy = clone(ship);
      let res = { ok: true };
      if (moduleId) {
        res = check(state, data, ship, slot, index, moduleId);
        if (res.ok) copy.fitting[slot][index] = moduleId;
      } else {
        copy.fitting[slot][index] = null;
      }
      const after = stats(state, data, copy);
      const b = flatten(before), a = flatten(after);
      const delta = {};
      for (const [k, v] of Object.entries(a)) if (v !== (b[k] ?? 0)) delta[k] = v - (b[k] ?? 0);
      return { check: res, stats: after, delta };
    },
    'fitting/moduleList': (state, data, { uid, slot, group, search }) => {
      const ship = shipOf(state, uid);
      const st = state.assets.stations[ship.stationId]?.items ?? {};
      const free = ship.fitting[slot].findIndex((x) => !x);
      return data.lists.modules.filter((m) => m.slot === slot && (!group || m.group === group) && (!search || m.name.toLowerCase().includes(search.toLowerCase())))
        .map((m) => ({
          moduleId: m.id, name: m.name, group: m.group, category: m.category, size: m.size, qtyInStation: st[m.id] ?? 0,
          check: check(state, data, ship, slot, free < 0 ? 0 : free, m.id), fitting: m.fitting
        }))
        .sort((x, y) => x.group.localeCompare(y.group) || x.name.localeCompare(y.name));
    },
    ...(withLayout ? { 'fitting/layout': (state, data, { uid }) => ({ uid, fitting: clone(shipOf(state, uid).fitting) }) } : {})
  };

  const actions = {
    'fitting/equip': (ctx, { uid, slot, index, moduleId }) => {
      const ship = shipOf(ctx.state, uid);
      if (!ship) return { ok: false, error: 'fit.not_docked', message: errorMessage(ctx.data, 'fit.not_docked') };
      const c = check(ctx.state, ctx.data, ship, slot, index, moduleId);
      if (!c.ok) return c;
      ctx.state.assets.stations[ship.stationId].items[moduleId] -= 1;
      ship.fitting[slot][index] = moduleId;
      ctx.emit('fitting/changed', { uid });
      return { ok: true };
    },
    'fitting/unequip': (ctx, { uid, slot, index, confirm }) => {
      const ship = shipOf(ctx.state, uid);
      const id = ship?.fitting[slot]?.[index];
      if (!id) return { ok: false, error: 'fit.no_module', message: errorMessage(ctx.data, 'fit.no_module') };
      if (slot === 'rig' && !confirm) return { ok: false, error: 'fit.rig_confirm', needsConfirm: true, message: errorMessage(ctx.data, 'fit.rig_confirm') };
      if (slot !== 'rig') {
        const items = ctx.state.assets.stations[ship.stationId].items;
        items[id] = (items[id] ?? 0) + 1;
      }
      ship.fitting[slot][index] = null;
      ctx.emit('fitting/changed', { uid });
      return { ok: true };
    },
    // Nur für dev.html/Tests:
    'mock/setDocked': (ctx, { docked: d }) => { ctx.state.pilot.location.dockedStationId = d ? ctx.state.pilot.location.celestialId : null; return { ok: true }; },
    'mock/setSkill': (ctx, { skillId, level: lv }) => { ctx.state.pilot.skills[skillId] = { sp: 0, level: lv }; return { ok: true }; },
    'mock/addStock': (ctx, { moduleId, qty }) => {
      const st = ctx.state.assets.stations[ctx.state.pilot.location.celestialId].items;
      st[moduleId] = (st[moduleId] ?? 0) + qty;
      return { ok: true };
    }
  };

  return {
    id: 'fitting',
    init(ctx) {
      tr = createTranslator(ctx.data.i18n?.de);
      void tr;
      const station = ctx.state.pilot.location.celestialId;
      const items = (ctx.state.assets.stations[station] ??= { items: {} }).items;
      ctx.data.lists.modules.forEach((m, i) => {
        const qty = stock === 'all' ? 2 : stock === 'none' ? 0 : i % 3 === 0 ? 0 : 2;
        if (qty && items[m.id] === undefined) items[m.id] = qty;
      });
      const starter = ctx.state.assets.ships[0];
      if (preEquip && starter && ctx.data.modules['mod.miner_1']) {
        starter.fitting.high = starter.fitting.high.map((x, i) => x ?? (i < 2 ? 'mod.miner_1' : null));
      }
      extraShips.forEach((typeId, i) => {
        const uid = `u${i + 2}`;
        if (!ctx.data.ships[typeId] || ctx.state.assets.ships.some((s) => s.uid === uid)) return;
        const t = ctx.data.ships[typeId];
        const empty = (n) => Array.from({ length: n }, () => null);
        ctx.state.assets.ships.push({
          uid, typeId, name: t.name, stationId: station,
          fitting: { high: empty(t.slots.high), mid: empty(t.slots.mid), low: empty(t.slots.low), rig: empty(t.slots.rig) },
          cargo: {}, oreHold: {}, damage: { shield: 0, armor: 0, structure: 0 }
        });
      });
      if (skills === 'all') for (const sk of ctx.data.lists.skills) ctx.state.pilot.skills[sk.id] = { sp: 0, level: sk.maxLevel ?? 5 };
      if (!docked) ctx.state.pilot.location.dockedStationId = null;
    },
    actions,
    selectors
  };
}

/**
 * @param {{data: object, docked?: boolean, withLayout?: boolean, preEquip?: boolean,
 *          stock?: 'most'|'all'|'none', skills?: 'starter'|'all', extraShips?: string[], now?: () => number, onWarn?: (m: string) => void}} options
 * @returns game (createGame) mit Mock-System „fitting“
 */
export function createFittingMock({
  data, docked = true, withLayout = false, preEquip = true, stock = 'most', skills = 'starter',
  extraShips = ['ship.dart', 'ship.warden'], now = () => 0, onWarn = () => {}
}) {
  return createGame({ data, systems: [createMockSystem({ withLayout, preEquip, stock, extraShips, docked, skills })], now, onWarn });
}
