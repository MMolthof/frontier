// Tick-Schleife (Zeitraffer, Pause) und Offline-Nachholen. DOM-frei.

const POLL_MS = 250; // Takt der Schleife; die Tick-Zahl ergibt sich aus der verstrichenen Zeit.

/** Millisekunden pro Tick bei 1x. balance.liveTickMs (optional) überschreibt tickSeconds (Entwicklung). */
export function baseTickMs(data) {
  const b = data.balance ?? {};
  return b.liveTickMs ?? (b.tickSeconds ?? 60) * 1000;
}

/**
 * Holt verpasste Ticks nach (max. balance.offlineMaxTicks) und setzt lastRealTime.
 * @returns {{ticks: number, elapsedTicks: number, capped: boolean}}
 */
export function catchUp(game, nowMs) {
  const { state, data } = game;
  const max = data.balance?.offlineMaxTicks ?? 10080;
  if (!state.lastRealTime) {
    state.lastRealTime = nowMs;
    return { ticks: 0, elapsedTicks: 0, capped: false };
  }
  const elapsedTicks = Math.max(0, Math.floor((nowMs - state.lastRealTime) / baseTickMs(data)));
  const ticks = Math.min(elapsedTicks, max);
  if (ticks > 0) {
    game.advance(ticks, { offline: true });
    game.state.log.push({
      tick: game.state.tick,
      text: `${ticks} Ticks seit deinem letzten Besuch nachgeholt${elapsedTicks > ticks ? ` (von ${elapsedTicks}, begrenzt)` : ''}.`,
      kind: 'info'
    });
  }
  game.state.lastRealTime = nowMs;
  return { ticks, elapsedTicks, capped: elapsedTicks > ticks };
}

/**
 * Schleife, die game.advance je nach verstrichener Echtzeit und game.runtime.timeScale aufruft.
 * @param {{game: object, now: () => number, timers?: {setInterval: Function, clearInterval: Function}}} options
 */
export function createTickLoop({ game, now, timers = globalThis }) {
  let last = now();
  let acc = 0;
  let handle = null;

  /** Testbar ohne Timer: verarbeitet die Zeit bis nowMs. Liefert die Anzahl gerechneter Ticks. */
  function pump(nowMs) {
    const dt = Math.max(0, nowMs - last);
    last = nowMs;
    let ran = 0;
    const scale = game.runtime.timeScale;
    if (scale > 0) {
      acc += (dt * scale) / baseTickMs(game.data);
      const whole = Math.floor(acc);
      acc -= whole;
      ran = Math.min(whole, game.data.balance?.offlineMaxTicks ?? 10080);
      if (ran > 0) game.advance(ran);
    } else {
      acc = 0;
    }
    game.state.lastRealTime = nowMs;
    return ran;
  }

  return {
    pump,
    start() {
      if (handle !== null) return;
      last = now();
      handle = timers.setInterval(() => pump(now()), POLL_MS);
    },
    stop() {
      if (handle === null) return;
      timers.clearInterval(handle);
      handle = null;
    },
    get running() { return handle !== null; }
  };
}
