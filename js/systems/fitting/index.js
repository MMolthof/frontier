// System "fitting": Ausrüsten und Ausbauen von Modulen (MASTER_PLAN 3.5–3.9, 5.1, 5.2).
// Eigener Teilbaum: assets.ships[].fitting. Lesen/Schreiben des Stationslagers nur über access.js.

import { calcShipStats, moduleFittingCost } from './stats.js';
import { SLOTS, makeError } from './errors.js';
import { checkDocked, checkEquip, checkRemoval } from './validate.js';
import {
  findShip, giveToStation, readDockedStationId, readPilot, readStationItems, stockOf, takeFromStation
} from './access.js';

const failFrom = (res, extra = {}) => ({ ...res, ...extra });
const NOT_FOUND = (data) => ({ ok: false, ...pick(makeError(data, 'fit.not_docked')) });
function pick(e) { return { error: e.code, message: e.message, need: e.need, have: e.have }; }

/** Alle numerischen Blätter eines Stats-Objekts als flache Pfade (ohne errors/weapons). */
function flatten(value, prefix = '', out = {}) {
  if (typeof value === 'number') { out[prefix] = value; return out; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (k === 'errors' || k === 'weapons') continue;
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

export function statsDelta(before, after) {
  const a = flatten(before);
  const b = flatten(after);
  const delta = {};
  for (const [path, v] of Object.entries(b)) {
    const d = Math.round((v - (a[path] ?? 0)) * 1e6) / 1e6;
    if (Math.abs(d) > 1e-9) delta[path] = d;
  }
  return delta;
}

function context(state, data, select) {
  return { pilot: readPilot(state, data, select), dockedStationId: readDockedStationId(state, select) };
}

function firstFreeIndex(ship, slot) {
  const list = ship.fitting?.[slot] ?? [];
  const i = list.findIndex((m) => !m);
  return i === -1 ? 0 : i;
}

function equipCheck(state, data, select, { uid, slot, index, moduleId }, opts = {}) {
  const ship = findShip(state, uid);
  const { pilot, dockedStationId } = context(state, data, select);
  if (!ship) return NOT_FOUND(data);
  return checkEquip({
    ship, slot, index, moduleId, pilot, data, dockedStationId,
    stock: dockedStationId ? stockOf(state, dockedStationId, moduleId) : 0, ...opts
  });
}

function hypotheticalShip(ship, slot, index, moduleId) {
  const fitting = {};
  for (const s of SLOTS) fitting[s] = [...(ship.fitting?.[s] ?? [])];
  if (fitting[slot] && Number.isInteger(index) && index >= 0 && index < fitting[slot].length) fitting[slot][index] = moduleId;
  return { ...ship, fitting };
}

export const system = {
  id: 'fitting',
  init() {},
  onTick() {},
  actions: {
    'fitting/equip': (ctx, payload = {}) => {
      const { uid, slot, index, moduleId } = payload;
      const res = equipCheck(ctx.state, ctx.data, ctx.select, { uid, slot, index, moduleId });
      if (!res.ok) return res;
      const ship = findShip(ctx.state, uid);
      const stationId = readDockedStationId(ctx.state, ctx.select);
      if (!takeFromStation(ctx.state, stationId, moduleId)) return { ok: false, ...pick(makeError(ctx.data, 'fit.no_module')) };
      ship.fitting[slot][index] = moduleId;
      ctx.emit('fitting/changed', { uid });
      ctx.log(`${ship.name}: ${ctx.data.modules[moduleId].name} eingebaut.`, 'info');
      return { ok: true };
    },
    'fitting/unequip': (ctx, payload = {}) => {
      const { uid, slot, index, confirm } = payload;
      const ship = findShip(ctx.state, uid);
      const { pilot, dockedStationId } = context(ctx.state, ctx.data, ctx.select);
      if (!ship) return NOT_FOUND(ctx.data);
      const check = checkRemoval({ ship, slot, index, pilot, data: ctx.data, dockedStationId });
      if (!check.ok) return check;
      const moduleId = ship.fitting[slot][index];
      if (slot === 'rig' && confirm !== true) {
        return { ok: false, needsConfirm: true, ...pick(makeError(ctx.data, 'fit.rig_confirm', { slot, index, moduleId })) };
      }
      ship.fitting[slot][index] = null;
      const name = ctx.data.modules?.[moduleId]?.name ?? moduleId;
      if (slot === 'rig') {
        ctx.log(`${ship.name}: ${name} beim Ausbau zerstört.`, 'warn');
      } else {
        giveToStation(ctx.state, dockedStationId, moduleId);
        ctx.log(`${ship.name}: ${name} ausgebaut.`, 'info');
      }
      ctx.emit('fitting/changed', { uid });
      return { ok: true, destroyed: slot === 'rig' };
    }
  },
  selectors: {
    'fitting/ships': (state, data, args, select) => {
      const { pilot, dockedStationId } = context(state, data, select);
      if (!dockedStationId) return [];
      return (state.assets?.ships ?? [])
        .filter((s) => s.stationId === dockedStationId)
        .map((s) => ({
          uid: s.uid, typeId: s.typeId, name: s.name, stationId: s.stationId,
          active: s.uid === state.pilot?.activeShipUid,
          valid: calcShipStats(s, pilot, data).valid
        }));
    },
    'fitting/stats': (state, data, args, select) => {
      const ship = findShip(state, args?.uid);
      if (!ship || !data.ships?.[ship.typeId]) return null;
      return calcShipStats(ship, readPilot(state, data, select), data);
    },
    'fitting/preview': (state, data, args, select) => {
      const ship = findShip(state, args?.uid);
      if (!ship || !data.ships?.[ship.typeId]) return null;
      const { slot, index } = args;
      const moduleId = args.moduleId ?? null;
      const { pilot, dockedStationId } = context(state, data, select);
      const current = calcShipStats(ship, pilot, data);
      let check;
      if (moduleId === null) check = checkRemoval({ ship, slot, index, pilot, data, dockedStationId });
      else check = equipCheck(state, data, select, { uid: ship.uid, slot, index, moduleId });
      const stats = moduleId !== null && !data.modules?.[moduleId]
        ? current
        : calcShipStats(hypotheticalShip(ship, slot, index, moduleId), pilot, data);
      return { check, stats, delta: statsDelta(current, stats) };
    },
    'fitting/canFit': (state, data, args, select) => equipCheck(state, data, select, args ?? {}),
    'fitting/moduleList': (state, data, args, select) => {
      const ship = findShip(state, args?.uid);
      if (!ship || !data.ships?.[ship.typeId]) return [];
      const { slot, group, search, includeUnowned } = args;
      const { pilot, dockedStationId } = context(state, data, select);
      const stock = dockedStationId ? readStationItems(state, dockedStationId) : {};
      const needle = typeof search === 'string' ? search.trim().toLowerCase() : '';
      const index = firstFreeIndex(ship, slot);
      const cpuPenalty = calcPenalty(ship, pilot, data);
      const rows = [];
      for (const mod of data.lists?.modules ?? Object.values(data.modules)) {
        if (mod.slot !== slot) continue;
        if (group && mod.group !== group) continue;
        if (needle && !`${mod.name} ${mod.id}`.toLowerCase().includes(needle)) continue;
        const qty = stock[mod.id] ?? 0;
        if (qty < 1 && !includeUnowned) continue;
        const check = checkEquip({ ship, slot, index, moduleId: mod.id, pilot, data, dockedStationId, stock: qty });
        rows.push({
          moduleId: mod.id, name: mod.name, group: mod.group, category: mod.category, size: mod.size,
          qtyInStation: qty, check, fitting: moduleFittingCost(mod, cpuPenalty)
        });
      }
      return rows.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name, 'de'));
    }
  }
};

function calcPenalty(ship, pilot, data) {
  // Faktor der CPU-Strafe für Mining-Upgrades aus den Skill-Effekten des Piloten.
  let factor = 1;
  for (const skill of Object.values(data.skills ?? {})) {
    const lvl = pilot.skills?.[skill.id]?.level ?? 0;
    if (!lvl) continue;
    for (const e of skill.effects ?? []) if (e.stat === 'cpu_penalty_mining_upgrade' && e.op === 'mul') factor *= 1 + e.perLevel * lvl;
  }
  return factor;
}

export { calcShipStats, checkDocked };
