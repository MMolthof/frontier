// Gemeinsame Hilfen für tests/fitting.*.test.mjs (keine Tests).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestData, createTestGame, REPO_ROOT } from './harness.js';
import { system as fitting } from '../js/systems/fitting/index.js';

export const BALANCE = JSON.parse(readFileSync(join(REPO_ROOT, 'data/balance.json'), 'utf8'));
export const { data: DATA } = createTestData();
export const STATION = BALANCE.startStation;

export const allSkills = (level) => Object.fromEntries(Object.keys(DATA.skills).map((id) => [id, { level }]));
export const pilotWith = (levels) => ({ skills: Object.fromEntries(Object.entries(levels).map(([id, level]) => [id, { level }])) });
export const emptyFitting = (type) => ({
  high: Array(type.slots.high).fill(null), mid: Array(type.slots.mid).fill(null),
  low: Array(type.slots.low).fill(null), rig: Array(type.slots.rig).fill(null)
});

/** Datenkopie mit zusätzlichen Modulen/Schiffen (Datenobjekte der Basis sind eingefroren). */
export function synthData({ modules = [], ships = [], skills = [] } = {}) {
  const add = (base, list) => ({ ...base, ...Object.fromEntries(list.map((e) => [e.id, e])) });
  return { ...DATA, modules: add(DATA.modules, modules), ships: add(DATA.ships, ships), skills: add(DATA.skills, skills) };
}

/** Spiel mit Startzustand wie im echten Spiel (startFitting/startItems aus balance.json). */
export function makeGame({ skills, items, withStartFitting = true, extraSystems = [] } = {}) {
  const game = createTestGame({ systems: [...extraSystems, fitting] });
  const s = game.state;
  const ship = s.assets.ships[0];
  if (withStartFitting) {
    for (const [slot, ids] of Object.entries(BALANCE.startFitting)) ids.forEach((id, i) => { ship.fitting[slot][i] = id; });
  }
  s.assets.stations[STATION].items = { ...(items ?? BALANCE.startItems) };
  if (skills) s.pilot.skills = Object.fromEntries(Object.entries(skills).map(([id, level]) => [id, { sp: 0, level }]));
  return game;
}

/** Zweites Schiff im Hangar der Startstation. */
export function addShip(game, typeId, uid = 'u2', fitting = null) {
  const type = DATA.ships[typeId];
  game.state.assets.ships.push({
    uid, typeId, name: type.name, stationId: STATION, fitting: fitting ?? emptyFitting(type), cargo: {}, oreHold: {},
    damage: { shield: 0, armor: 0, structure: 0 }
  });
  return uid;
}

/** Zählt jedes Modul (eingebaut + Lager) – Lagerbilanz. */
export function countModules(state) {
  const total = {};
  for (const ship of state.assets.ships) for (const list of Object.values(ship.fitting)) for (const id of list) if (id) total[id] = (total[id] ?? 0) + 1;
  for (const st of Object.values(state.assets.stations)) for (const [id, q] of Object.entries(st.items)) if (id.startsWith('mod.')) total[id] = (total[id] ?? 0) + q;
  return total;
}
