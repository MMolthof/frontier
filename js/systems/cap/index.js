// System "cap": Energiespeicher des Piloten (nicht des Schiffs). Gespeichert in Prozent, damit ein Schiffswechsel ihn nicht auffüllt.
// Aktive Module (Bergbau) verbrauchen Cap; bei 0 % beginnt der Notbetrieb („Civilian Mode“): nur Zivilier-Module arbeiten,
// bis der Cap wieder `resumePct` erreicht hat. Warp und Tor-Sprung kosten ebenfalls Cap (im Notbetrieb nur Notflug zur Station).

const fail = (error, message) => ({ ok: false, error, message });
const activeShip = (state) => state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const DEFAULTS = { regenPctPerTick: 0.02, dockedFactor: 2, resumePct: 25, lowPct: 20, warpUnits: 8, jumpUnits: 12 };
export const capBalance = (data) => ({ ...DEFAULTS, ...(data.balance?.cap ?? {}) });

export function ensureCap(state) {
  state.pilot.cap ??= { pct: 100, civilian: false };
  return state.pilot.cap;
}

/** Energie-Kapazität des aktiven Schiffs in Einheiten (Basis für den Prozentverbrauch). */
function capMax(state, data) {
  const ship = activeShip(state);
  return data.ships?.[ship?.typeId]?.attributes?.capacitor ?? 100;
}

/** Aktive (nicht-zivile) Module: arbeiten nur bei vorhandenem Cap. */
export const isDrainModule = (mod) => Boolean(mod?.activation) && !mod.civilian;

/** Aktueller Zustand für Anzeige und andere Systeme. */
export function capStatus(state, data, select) {
  const cap = ensureCap(state);
  const bal = capBalance(data);
  const ship = activeShip(state);
  let usePerTick = 0;
  try { usePerTick = select?.('fitting/stats', { uid: ship?.uid })?.capacitor?.usePerTick ?? 0; } catch { /* ohne Fitting */ }
  const max = capMax(state, data);
  const docked = Boolean(state.pilot.location.dockedStationId);
  const regen = bal.regenPctPerTick * (docked ? bal.dockedFactor : 1);
  const fitted = Object.values(ship?.fitting ?? {}).flat().filter(Boolean).map((id) => data.modules?.[id]);
  return {
    pct: cap.pct, civilian: cap.civilian, mode: cap.civilian ? 'civilian' : cap.pct <= bal.lowPct ? 'low' : 'full',
    resumePct: bal.resumePct, lowPct: bal.lowPct, regenPctPerTick: regen, drainPctPerTick: (usePerTick / max) * 100,
    ticksToResume: cap.civilian ? Math.ceil(Math.max(0, bal.resumePct - cap.pct) / regen) : 0,
    ticksToFull: Math.ceil((100 - cap.pct) / regen),
    hasCivilianModule: fitted.some((m) => m?.civilian && m.activation)
  };
}

/** Kosten für Warp/Sprung: im Notbetrieb nur Notflug zu Stationen, sonst Prozent der Schiffskapazität. */
export function payTravel(ctx, kind, target) {
  const { state, data } = ctx;
  const cap = ensureCap(state);
  const bal = capBalance(data);
  if (cap.civilian) {
    if (kind === 'jump') return fail('cap.civilian_jump', 'Civilian Mode: Für Tor-Sprünge fehlt die Energie. Warpe zur Station und lade auf.');
    if (target?.type !== 'station') return fail('cap.civilian_warp', 'Civilian Mode: Nur noch Notflug zu Stationen möglich. Lade deinen Energiespeicher auf.');
    return { ok: true, costPct: 0 };
  }
  const costPct = ((kind === 'jump' ? bal.jumpUnits : bal.warpUnits) / capMax(state, data)) * 100;
  cap.pct = Math.max(0, cap.pct - costPct);
  if (cap.pct <= 0) enterCivilian(ctx);
  return { ok: true, costPct };
}

function enterCivilian(ctx) {
  const cap = ensureCap(ctx.state);
  cap.civilian = true;
  ctx.log('Energiespeicher leer: Civilian Mode. Nur Zivilier-Module arbeiten, bis der Speicher wieder aufgeladen ist.', 'warn');
  ctx.emit('cap/empty', {});
}

export const system = {
  id: 'cap',
  init(ctx) { ensureCap(ctx.state); },
  onTick(ctx) {
    const { state, data } = ctx;
    const cap = ensureCap(state);
    const bal = capBalance(data);
    const docked = Boolean(state.pilot.location.dockedStationId);
    let delta = bal.regenPctPerTick * (docked ? bal.dockedFactor : 1);
    if (!cap.civilian && state.mining.sessions.length) delta -= capStatus(state, data, ctx.select).drainPctPerTick;
    cap.pct = clamp(cap.pct + delta, 0, 100);
    if (!cap.civilian && cap.pct <= 0) enterCivilian(ctx);
    else if (cap.civilian && cap.pct >= bal.resumePct) {
      cap.civilian = false;
      ctx.log('Energiespeicher wieder ausreichend geladen: volle Leistung.', 'good');
      ctx.emit('cap/restored', {});
    }
  },
  actions: {},
  selectors: {
    'cap/status': (state, data, args, select) => capStatus(state, data, select)
  }
};
