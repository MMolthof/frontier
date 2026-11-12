// Ereignisbus: emit/on/off. Handler-Fehler brechen die Schleife nie ab.

export function createEmitter({ onError = () => {} } = {}) {
  /** @type {Map<string, Set<Function>>} */
  const handlers = new Map();

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = handlers.get(type);
    if (set) set.delete(fn);
  }

  function emit(type, payload = {}) {
    // Kopie, damit Handler sich während des Emits selbst abmelden dürfen. '*' hört auf alles.
    for (const key of [type, '*']) {
      const set = handlers.get(key);
      if (!set) continue;
      for (const fn of [...set]) {
        try {
          if (key === '*') fn(type, payload);
          else fn(payload, type);
        } catch (err) {
          onError(err, type);
        }
      }
    }
  }

  return { on, off, emit };
}
