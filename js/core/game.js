// Spiel-Fassade: dispatch/select/on/data (MASTER_PLAN 3.5). Kein DOM, keine Systemuhr:
// Die Uhr (`now`) wird von außen injiziert, Zufall kommt aus state.rngState.

import { createEmitter } from './events.js';
import { createStateRng } from './rng.js';
import { createInitialState, migrateState } from './state.js';
import { createTranslator } from '../util/format.js';

const DEFAULT_SPEEDS = [0, 1, 5, 20];

function normalizeResult(res) {
  if (res === undefined || res === null || res === true) return { ok: true };
  if (typeof res !== 'object') return { ok: true, value: res };
  if (res.ok === false) {
    const error = res.error ?? 'core.unknown_error';
    return { ...res, ok: false, error, message: res.message ?? error };
  }
  return { ...res, ok: true };
}

const fail = (error, message) => ({ ok: false, error, message: message ?? error });

/**
 * @param {object} options
 * @param {object} options.data            Ergebnis von loadData/buildData (read-only)
 * @param {object[]} [options.systems]     Systeme in Tick-Reihenfolge (Registry-Order)
 * @param {object} [options.state]         Geladener Zustand (sonst neuer Startzustand)
 * @param {number} [options.seed]
 * @param {() => number} [options.now]     Uhr in ms (Browser: Date.now; Tests: Fake-Uhr)
 * @param {object} [options.saves]         SaveManager (optional)
 * @param {(msg: string) => void} [options.onWarn]
 */
export function createGame(options) {
  const { data, systems = [], seed = 12345, now = () => 0, saves = null, onWarn = () => {} } = options;
  const events = createEmitter({ onError: (err, type) => onWarn(`Event-Handler für ${type} warf: ${err.message}`) });
  const subscribers = new Set();
  const runtime = { timeScale: 1, catchingUp: false };
  const actions = new Map();
  const selectors = new Map();
  const ordered = [];
  const warnedSelectors = new Set();
  const logMax = data.balance?.logMax ?? 200;
  const speeds = data.balance?.speeds ?? DEFAULT_SPEEDS;
  let state;

  function pushLog(text, kind = 'info') {
    state.log.push({ tick: state.tick, text, kind });
    if (state.log.length > logMax) state.log.splice(0, state.log.length - logMax);
  }

  function makeCtx({ offline = false } = {}) {
    return {
      state,
      data,
      rng: createStateRng(state),
      now: now(),
      tick: state.tick,
      offline,
      emit: (type, payload) => events.emit(type, payload),
      select: (type, args) => select(type, args),
      log: pushLog
    };
  }

  function notify() {
    for (const fn of [...subscribers]) {
      try { fn(); } catch (err) { onWarn(`Subscriber warf: ${err.message}`); }
    }
  }

  function select(type, args) {
    const fn = selectors.get(type);
    if (!fn) {
      if (!warnedSelectors.has(type)) {
        warnedSelectors.add(type);
        onWarn(`Unbekannter Selektor ${type} (System noch nicht geliefert?).`);
      }
      return undefined;
    }
    return fn(state, data, args, select);
  }

  function dispatch(type, payload = {}) {
    const fn = actions.get(type);
    if (!fn) return fail('core.unknown_action', `Unbekannte Action ${type}.`);
    let res;
    try {
      res = normalizeResult(fn(makeCtx(), payload));
    } catch (err) {
      onWarn(`Action ${type} warf: ${err.stack ?? err.message}`);
      return fail('core.action_failed', err.message);
    }
    if (res.ok) notify();
    return res;
  }

  function register(system) {
    if (!system || typeof system.id !== 'string') {
      onWarn('System ohne id übersprungen.');
      return;
    }
    if (ordered.some((s) => s.id === system.id)) {
      onWarn(`Doppeltes System ${system.id} übersprungen.`);
      return;
    }
    ordered.push(system);
    for (const [type, fn] of Object.entries(system.actions ?? {})) {
      if (actions.has(type)) onWarn(`Doppelte Action ${type} (${system.id}) ignoriert.`);
      else actions.set(type, fn);
    }
    for (const [type, fn] of Object.entries(system.selectors ?? {})) {
      if (selectors.has(type)) onWarn(`Doppelter Selektor ${type} (${system.id}) ignoriert.`);
      else selectors.set(type, fn);
    }
  }

  function initSystems(fresh) {
    for (const system of ordered) {
      try { system.init?.(makeCtx()); } catch (err) { onWarn(`System ${system.id}.init warf: ${err.stack ?? err.message}`); }
    }
    events.emit('core/loaded', { fresh, tick: state.tick });
  }

  function startFresh(newSeed, name) {
    state = createInitialState(data, newSeed, { name });
    state.lastRealTime = now();
    initSystems(true);
  }

  function advance(count, { offline = false } = {}) {
    const wasCatching = runtime.catchingUp;
    runtime.catchingUp = offline;
    try {
      for (let i = 0; i < count; i++) {
        state.tick += 1;
        const ctx = makeCtx({ offline });
        for (const system of ordered) {
          try { system.onTick?.(ctx); } catch (err) { onWarn(`System ${system.id}.onTick warf: ${err.stack ?? err.message}`); }
        }
        events.emit('core/ticked', { tick: state.tick });
      }
    } finally {
      runtime.catchingUp = wasCatching;
    }
    notify();
  }

  function save() {
    if (!saves) return fail('core.no_storage', 'Kein Speicher konfiguriert.');
    try {
      state.lastRealTime = now();
      saves.save(state, state.lastRealTime);
      return { ok: true };
    } catch (err) {
      return fail('core.save_failed', err.message);
    }
  }

  const coreSystem = {
    id: 'core',
    actions: {
      'game/new': (ctx, p) => { startFresh(p?.seed ?? seed, p?.name); return { ok: true }; },
      'game/save': () => save(),
      'game/reset': () => { saves?.clear(); startFresh(seed); return { ok: true }; },
      'game/setSpeed': (ctx, p) => {
        if (!speeds.includes(p?.scale)) return fail('core.bad_speed', `Geschwindigkeit ${p?.scale} nicht erlaubt.`);
        runtime.timeScale = p.scale;
        return { ok: true, scale: p.scale };
      }
    },
    selectors: {
      'core/tick': (s) => s.tick,
      'core/seed': (s) => s.seed,
      'core/speed': () => runtime.timeScale,
      'core/speeds': () => [...speeds],
      'core/isCatchingUp': () => runtime.catchingUp,
      'core/log': (s, d, args) => s.log.slice(-(args?.limit ?? 50)).reverse()
    }
  };

  register(coreSystem);
  systems.forEach(register);

  if (options.state) {
    state = migrateState(options.state);
    initSystems(false);
  } else {
    startFresh(seed);
  }

  return {
    get state() { return state; },
    data,
    runtime,
    dispatch,
    select,
    /** game.on(event, fn) → off() */
    on: events.on,
    /** Wird nach jedem Tick-Block und jeder erfolgreichen Action aufgerufen (UI-Refresh). → unsubscribe */
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    advance,
    save,
    t: createTranslator(data.i18n?.de),
    hasAction: (type) => actions.has(type),
    hasSelector: (type) => selectors.has(type),
    get systemIds() { return ordered.map((s) => s.id); }
  };
}
