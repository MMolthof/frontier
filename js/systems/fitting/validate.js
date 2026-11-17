// Validierung nach MASTER_PLAN 5.1 (Reihenfolge = Fehlercode-Priorität). Rein und DOM-frei.
//   1 fit.not_docked  2 fit.slot_type  3 fit.slot_occupied  4 fit.size  5 fit.hardpoints
//   6 fit.powergrid, fit.cpu  7 fit.calibration  8 fit.skill  (zuletzt: fit.no_module = nicht im Stationslager)

import { SLOTS, levelOf, makeError } from './errors.js';
import { computeStats } from './stats.js';

const EPS = 1e-9;
const okResult = () => ({ ok: true });
const toResult = (e) => ({ ok: false, error: e.code, message: e.message, need: e.need, have: e.have, ...(e.skillId ? { skillId: e.skillId } : {}), ...(e.hardpoint ? { hardpoint: e.hardpoint } : {}) });

function cloneWith(ship, slot, index, moduleId) {
  const fitting = {};
  for (const s of SLOTS) fitting[s] = [...(ship.fitting?.[s] ?? [])];
  fitting[slot][index] = moduleId;
  return { ...ship, fitting };
}

/** Docking-Voraussetzung: Pilot angedockt und Schiff liegt im selben Hangar. */
export function checkDocked(data, ship, dockedStationId) {
  if (!ship || dockedStationId === null || dockedStationId === undefined || ship.stationId !== dockedStationId) {
    return toResult(makeError(data, 'fit.not_docked'));
  }
  return okResult();
}

/** Schiffsvoraussetzungen (Einsteigen): ship.skill. Für A8 (ships/board) exportiert. */
export function checkShipRequirements(shipType, pilot, data) {
  for (const [skillId, need] of Object.entries(shipType?.requires ?? {})) {
    const have = levelOf(pilot, skillId);
    if (have < need) return toResult(makeError(data, 'ship.skill', { need, have, skillId }));
  }
  return okResult();
}

/**
 * Kann moduleId in ship.fitting[slot][index] eingebaut werden?
 * @param {{ship, slot, index, moduleId, pilot, data, dockedStationId, stock?: number, skipDock?: boolean, skipStock?: boolean}} p
 */
export function checkEquip(p) {
  const { ship, slot, index, moduleId, pilot, data } = p;
  const err = (code, extra) => toResult(makeError(data, code, { slot, index, moduleId, ...extra }));
  if (!p.skipDock) {
    const dock = checkDocked(data, ship, p.dockedStationId);
    if (!dock.ok) return dock;
  }
  const type = data.ships?.[ship.typeId];
  const mod = data.modules?.[moduleId];
  if (!type || !mod) return err('fit.no_module');
  const list = ship.fitting?.[slot];
  if (!SLOTS.includes(slot) || !Array.isArray(list) || !Number.isInteger(index) || index < 0 || index >= list.length) {
    return err('fit.slot_type', { need: mod.slot, have: slot });
  }
  if (mod.slot !== slot) return err('fit.slot_type', { need: mod.slot, have: slot });
  if (list[index]) return err('fit.slot_occupied');
  if (mod.size !== type.hull) return err('fit.size', { need: type.hull, have: mod.size });

  const hyp = cloneWith(ship, slot, index, moduleId);
  const s = computeStats(hyp, pilot, data);
  if (mod.hardpoint && s.slots.high.hardpoints[mod.hardpoint]) {
    const hp = s.slots.high.hardpoints[mod.hardpoint];
    if (hp.used > hp.max) return err('fit.hardpoints', { need: hp.used, have: hp.max, hardpoint: mod.hardpoint });
  }
  if (s.fitting.pg.used > s.fitting.pg.max + EPS) return err('fit.powergrid', { need: s.fitting.pg.used, have: s.fitting.pg.max });
  if (s.fitting.cpu.used > s.fitting.cpu.max + EPS) return err('fit.cpu', { need: s.fitting.cpu.used, have: s.fitting.cpu.max });
  if (s.fitting.calibration.used > s.fitting.calibration.max + EPS) {
    return err('fit.calibration', { need: s.fitting.calibration.used, have: s.fitting.calibration.max });
  }
  for (const [skillId, need] of Object.entries(mod.requires ?? {})) {
    const have = levelOf(pilot, skillId);
    if (have < need) return err('fit.skill', { need, have, skillId });
  }
  if (!p.skipStock && (p.stock ?? 0) < 1) return err('fit.no_module', { need: 1, have: p.stock ?? 0 });
  return okResult();
}

/**
 * Darf der Slot geleert werden? Der Ausbau eines Moduls, das PG/CPU liefert (Reaktorsteuerung, Coprozessor,
 * Energienetz-Rig), ist verboten, wenn das Schiff danach überlastet wäre (ein bereits überlastetes Fitting bleibt ausbaubar).
 */
export function checkRemoval(p) {
  const { ship, slot, index, pilot, data } = p;
  const err = (code, extra) => toResult(makeError(data, code, { slot, index, ...extra }));
  if (!p.skipDock) {
    const dock = checkDocked(data, ship, p.dockedStationId);
    if (!dock.ok) return dock;
  }
  const list = ship.fitting?.[slot];
  if (!SLOTS.includes(slot) || !Array.isArray(list) || !Number.isInteger(index) || index < 0 || index >= list.length) {
    return err('fit.slot_type', { have: slot });
  }
  const moduleId = list[index];
  if (!moduleId) return err('fit.no_module');
  const before = computeStats(ship, pilot, data).fitting;
  const after = computeStats(cloneWith(ship, slot, index, null), pilot, data).fitting;
  for (const [code, key] of [['fit.powergrid', 'pg'], ['fit.cpu', 'cpu']]) {
    const wasOver = before[key].used > before[key].max + EPS;
    if (!wasOver && after[key].used > after[key].max + EPS) return err(code, { moduleId, need: after[key].used, have: after[key].max });
  }
  return okResult();
}
