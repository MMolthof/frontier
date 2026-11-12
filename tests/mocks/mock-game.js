// Mock-Game für UI-Tests und die Shell-Demo. DOM-frei, ohne Node-Importe (läuft in Node und im Browser).
// Bildet die Teile der Game-API nach, die die UI nutzt: state, data, select, dispatch, on, subscribe, advance, t, hasAction/hasSelector.
// Simuliert zusätzlich travel/warp, travel/dock, travel/undock und game/setSpeed, damit die Demo etwas zeigt.

const DEMO_DATA = {
  balance: { tickSeconds: 60, speeds: [0, 1, 5, 20], logMax: 200 },
  ships: {
    'ship.pebble': { id: 'ship.pebble', name: 'Pebble', category: 'mining', class: 'frigate', hull: 'small', slots: { high: 3, mid: 3, low: 1, rig: 2 }, hardpoints: { turret: 2, launcher: 0 } },
    'ship.dart': { id: 'ship.dart', name: 'Dart', category: 'combat', class: 'frigate', hull: 'small', slots: { high: 3, mid: 2, low: 2, rig: 2 }, hardpoints: { turret: 3, launcher: 0 } },
    'ship.anvil': { id: 'ship.anvil', name: 'Anvil', category: 'combat', class: 'cruiser', hull: 'medium', slots: { high: 5, mid: 4, low: 5, rig: 3 }, hardpoints: { turret: 4, launcher: 1 } },
    'ship.bulk': { id: 'ship.bulk', name: 'Bulk', category: 'industrial', class: 'hauler', hull: 'large', slots: { high: 1, mid: 3, low: 4, rig: 3 }, hardpoints: { turret: 0, launcher: 0 } }
  },
  systems: { 'sys.aldara': { id: 'sys.aldara', name: 'Aldara', security: 0.9, region: 'Kern' }, 'sys.brenn': { id: 'sys.brenn', name: 'Brenn', security: 0.4, region: 'Rand' } },
  celestials: {
    'cel.aldara.p1.station': { id: 'cel.aldara.p1.station', type: 'station', name: 'Aldara I – Orbitalwerft', au: 0.7 },
    'cel.aldara.belt1': { id: 'cel.aldara.belt1', type: 'belt', name: 'Aldara – Gürtel 1', au: 2.4 },
    'cel.aldara.p2': { id: 'cel.aldara.p2', type: 'planet', name: 'Aldara II', au: 1.6 },
    'cel.aldara.gate.brenn': { id: 'cel.aldara.gate.brenn', type: 'gate', name: 'Tor nach Brenn', au: 8.5 }
  },
  skills: { 'skill.mining': { id: 'skill.mining', name: 'Bergbau' } },
  ores: {}, items: {}, modules: {}, lists: {}
};

/**
 * @param {{docked?: boolean, emptyData?: boolean, now?: () => number}} [o]
 * emptyData: Sammlungen leer (wie im Browser ohne ships.json usw.).
 */
export function createMockGame({ docked = true, emptyData = false } = {}) {
  const data = emptyData ? { balance: { tickSeconds: 60, speeds: [0, 1, 5, 20] }, ships: {}, systems: {}, celestials: {}, skills: {} } : structuredClone(DEMO_DATA);
  const state = {
    version: 1, tick: 0,
    account: { id: 'acc.1', name: 'Pilot', isk: 250000 },
    pilot: {
      location: { systemId: 'sys.aldara', celestialId: docked ? 'cel.aldara.p1.station' : 'cel.aldara.p2', dockedStationId: docked ? 'cel.aldara.p1.station' : null },
      activeShipUid: 'u1', warp: null, queue: [], skills: {}
    },
    assets: { ships: [{ uid: 'u1', typeId: 'ship.pebble', name: 'Pebble', stationId: docked ? 'cel.aldara.p1.station' : null, fitting: { high: [null, null, null], mid: [null, null, null], low: [null], rig: [null, null] }, cargo: {}, oreHold: {} }], stations: {} },
    world: { fields: {}, cans: [], markets: {} }, mining: { sessions: [] }, missions: { offers: {}, active: null }, log: []
  };
  const listeners = new Map();
  const subscribers = new Set();
  const runtime = { timeScale: 1, catchingUp: false };
  const speeds = data.balance.speeds;
  const emit = (type, payload) => (listeners.get(type) ?? []).forEach((fn) => fn(payload));
  const notify = () => subscribers.forEach((fn) => fn());
  const log = (text, kind = 'info') => { state.log.push({ tick: state.tick, text, kind }); };
  const nameOf = (id) => data.celestials[id]?.name ?? id;

  const actions = {
    'game/setSpeed': (p) => (speeds.includes(p?.scale) ? (runtime.timeScale = p.scale, { ok: true }) : { ok: false, error: 'core.bad_speed', message: 'Geschwindigkeit nicht erlaubt.' }),
    'game/save': () => ({ ok: true }),
    'game/reset': () => { state.tick = 0; state.log.length = 0; state.account.isk = 250000; return { ok: true }; },
    'travel/warp': (p) => {
      if (state.pilot.location.dockedStationId) return { ok: false, error: 'travel.docked', message: 'Im Hangar kann nicht gewarpt werden.' };
      const total = 6;
      state.pilot.warp = { fromId: state.pilot.location.celestialId, toId: p.celestialId, ticksLeft: total, ticksTotal: total };
      log(`Warp nach ${nameOf(p.celestialId)} gestartet.`, 'travel');
      return { ok: true };
    },
    'travel/dock': (p) => {
      state.pilot.location = { systemId: 'sys.aldara', celestialId: p.stationId, dockedStationId: p.stationId };
      emit('travel/docked', { stationId: p.stationId, name: nameOf(p.stationId) });
      log('Angedockt.', 'travel');
      return { ok: true };
    },
    'travel/undock': () => {
      const from = state.pilot.location.dockedStationId;
      state.pilot.location = { ...state.pilot.location, dockedStationId: null };
      emit('travel/undocked', { stationId: from, name: nameOf(from) });
      log('Ausgedockt.', 'travel');
      return { ok: true };
    }
  };
  const selectors = {
    'core/tick': () => state.tick,
    'core/speed': () => runtime.timeScale,
    'core/speeds': () => [...speeds],
    'core/isCatchingUp': () => runtime.catchingUp,
    'core/log': (args) => state.log.slice(-(args?.limit ?? 50)).reverse()
  };

  const game = {
    get state() { return state; },
    data, runtime,
    dispatch(type, payload = {}) {
      const fn = actions[type];
      if (!fn) return { ok: false, error: 'core.unknown_action', message: `Unbekannte Action ${type}.` };
      const res = fn(payload);
      if (res.ok) notify();
      return res;
    },
    select: (type, args) => selectors[type]?.(args),
    on(event, fn) { const list = listeners.get(event) ?? []; list.push(fn); listeners.set(event, list); return () => listeners.set(event, (listeners.get(event) ?? []).filter((f) => f !== fn)); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    advance(count = 1) {
      for (let i = 0; i < count; i++) {
        state.tick += 1;
        const warp = state.pilot.warp;
        if (warp) {
          warp.ticksLeft -= 1;
          if (warp.ticksLeft <= 0) {
            state.pilot.location = { ...state.pilot.location, celestialId: warp.toId };
            state.pilot.warp = null;
            emit('travel/arrived', { toId: warp.toId, name: nameOf(warp.toId) });
            log(`Angekommen: ${nameOf(warp.toId)}`, 'travel');
          }
        }
      }
      notify();
    },
    t: (key) => key,
    hasAction: (type) => type in actions,
    hasSelector: (type) => type in selectors,
    saves: null
  };
  return game;
}
