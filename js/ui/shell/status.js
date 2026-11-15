// Abgeleitete Statusdaten für die Statusleiste und die Übersicht (rein, ohne DOM).

export function securityBand(security) {
  if (security >= 0.8) return 'high';
  if (security >= 0.5) return 'mid';
  return 'low';
}

const nameOf = (table, id) => table?.[id]?.name ?? id ?? '–';

/** @returns {{kind: 'warp'|'mining'|'docked'|'space', ticksLeft?: number, ticksTotal?: number, target?: string, count?: number}} Priorität: Warp, Bergbau, Station, All. */
export function deriveActivity(state, data) {
  const warp = state.pilot?.warp;
  if (warp) return { kind: 'warp', ticksLeft: warp.ticksLeft, ticksTotal: warp.ticksTotal, target: nameOf(data.celestials, warp.toId) };
  const sessions = state.mining?.sessions ?? [];
  if (sessions.length) return { kind: 'mining', count: sessions.length };
  if (state.pilot?.location?.dockedStationId) return { kind: 'docked' };
  return { kind: 'space' };
}

export function describeLocation(state, data) {
  const loc = state.pilot?.location ?? {};
  const system = data.systems?.[loc.systemId];
  return {
    system: system?.name ?? loc.systemId ?? '–',
    place: loc.celestialId ? nameOf(data.celestials, loc.celestialId) : null,
    security: typeof system?.security === 'number' ? system.security : null
  };
}

export function activeShip(state) {
  const uid = state.pilot?.activeShipUid;
  return (state.assets?.ships ?? []).find((s) => s.uid === uid) ?? null;
}
