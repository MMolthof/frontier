// Speichern/Laden über ein Adapter-Interface { get, set, remove } (Strings, synchron).
// Der localStorage-Adapter liegt in js/util/browser.js, damit js/core DOM-/Storage-frei bleibt.

import { migrateState, StateError, STATE_VERSION } from './state.js';

export const SAVE_FORMAT = 'tick-frontier-save';
export const SAVE_KEY = 'tick-frontier/save';

export class SaveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

export function createMemoryAdapter(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (key) => (store.has(key) ? store.get(key) : null),
    set: (key, value) => { store.set(key, String(value)); },
    remove: (key) => { store.delete(key); }
  };
}

export function serializeSave(state, savedAt = state.lastRealTime) {
  return JSON.stringify({ format: SAVE_FORMAT, version: STATE_VERSION, savedAt, state });
}

/** Text → { state, savedAt } (migriert). Wirft SaveError mit code. */
export function parseSave(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SaveError('save.corrupt', 'Spielstand ist kein gültiges JSON.');
  }
  if (!doc || doc.format !== SAVE_FORMAT || typeof doc.state !== 'object') {
    throw new SaveError('save.bad_format', 'Datei ist kein Tick-Frontier-Spielstand.');
  }
  try {
    return { state: migrateState(doc.state), savedAt: doc.savedAt ?? doc.state.lastRealTime ?? 0 };
  } catch (err) {
    if (err instanceof StateError) throw new SaveError(err.code.replace('state.', 'save.'), err.message);
    throw err;
  }
}

export function createSaveManager(adapter, { key = SAVE_KEY } = {}) {
  return {
    save(state, savedAt) { adapter.set(key, serializeSave(state, savedAt)); },
    /** @returns {object|null} Zustand oder null, wenn nichts gespeichert ist. */
    load() {
      const text = adapter.get(key);
      return text === null || text === undefined ? null : parseSave(text).state;
    },
    exists: () => adapter.get(key) !== null && adapter.get(key) !== undefined,
    clear() { adapter.remove(key); },
    exportJson: (state) => serializeSave(state),
    /** Prüft und übernimmt einen exportierten Spielstand in den Speicher; liefert den Zustand. */
    importJson(text) {
      const { state, savedAt } = parseSave(text);
      adapter.set(key, serializeSave(state, savedAt));
      return state;
    }
  };
}
