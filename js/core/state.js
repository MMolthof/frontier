// Spielzustand: Startzustand, Versionierung, Migration. Alles JSON-sicher.

import { seedToState } from './rng.js';

export const STATE_VERSION = 1;

export class StateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StateError';
    this.code = code;
  }
}

/** Migrationen: Schlüssel = Quellversion, Funktion liefert den Zustand der Version+1. */
export const MIGRATIONS = {};

// Startskills brauchen eine SP-Zahl passend zu ihrer Stufe. Die maßgebliche Formel gehört A5
// (spForLevel); hier dieselbe Formel mit Werten aus balance.skills, nur für den Startzustand.
function startSp(rank, level, skillsBalance) {
  const base = skillsBalance?.baseSp ?? 250;
  const exp = skillsBalance?.levelExponent ?? 2.5;
  return level <= 0 ? 0 : Math.ceil(base * rank * 2 ** (exp * (level - 1)));
}

function emptyFitting(shipType) {
  const slots = shipType?.slots ?? {};
  const make = (n) => Array.from({ length: n ?? 0 }, () => null);
  return { high: make(slots.high), mid: make(slots.mid), low: make(slots.low), rig: make(slots.rig) };
}

/**
 * @param {object} data   Ergebnis von loadData/buildData
 * @param {number} [seed]
 * @param {{name?: string}} [options]
 */
export function createInitialState(data, seed = 12345, options = {}) {
  const b = data.balance ?? {};
  const shipType = data.ships?.[b.startShip];
  const fitting = emptyFitting(shipType);
  // Optional: balance.startFitting = { high: ['mod.miner_1', ...] } (Starterschiff vorausgerüstet).
  for (const [slot, ids] of Object.entries(b.startFitting ?? {})) {
    (ids ?? []).forEach((id, i) => { if (fitting[slot] && i < fitting[slot].length) fitting[slot][i] = id; });
  }
  const attrs = shipType?.attributes ?? {};

  const skills = {};
  for (const [id, level] of Object.entries(b.startSkills ?? {})) {
    skills[id] = { sp: startSp(data.skills?.[id]?.rank ?? 1, level, b.skills), level };
  }

  return {
    version: STATE_VERSION,
    tick: 0,
    lastRealTime: 0,
    seed,
    rngState: seedToState(seed),
    account: { id: 'acc.1', name: options.name ?? 'Pilot', isk: b.startIsk ?? 0 },
    pilot: {
      attributes: { ...(b.attributes?.start ?? { intelligence: 20, memory: 20, perception: 20, willpower: 20, charisma: 19 }) },
      skills,
      queue: [],
      standings: {},
      location: {
        systemId: b.startSystem ?? null,
        celestialId: b.startStation ?? null,
        dockedStationId: b.startStation ?? null
      },
      activeShipUid: 'u1',
      warp: null
    },
    assets: {
      ships: [{
        uid: 'u1',
        typeId: b.startShip ?? null,
        name: shipType?.name ?? 'Starterschiff',
        stationId: b.startStation ?? null,
        fitting,
        cargo: {},
        oreHold: {},
        damage: { shield: attrs.shield_hp ?? 0, armor: attrs.armor_hp ?? 0, structure: attrs.structure_hp ?? 0 }
      }],
      stations: b.startStation ? { [b.startStation]: { items: {} } } : {}
    },
    world: { fields: {}, cans: [], markets: {} },
    mining: { sessions: [] },
    missions: { offers: {}, active: null },
    log: []
  };
}

/** Prüft und migriert einen geladenen Zustand auf STATE_VERSION. Wirft StateError. */
export function migrateState(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') {
    throw new StateError('state.invalid', 'Zustand ohne gültige version.');
  }
  if (raw.version > STATE_VERSION) {
    throw new StateError('state.version_future', `Zustand hat Version ${raw.version}, bekannt ist nur ${STATE_VERSION}.`);
  }
  let state = raw;
  while (state.version < STATE_VERSION) {
    const step = MIGRATIONS[state.version];
    if (!step) throw new StateError('state.no_migration', `Keine Migration von Version ${state.version}.`);
    state = step(state);
  }
  return state;
}
