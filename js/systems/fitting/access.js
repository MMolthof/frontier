// EINZIGER Zugriffspunkt auf fremde Teilbäume: Skill-Stufen, Docking-Status, Stationslager.
// Bevorzugt Selektoren anderer Systeme (skills/level, travel/isDocked), sonst direkter Lesezugriff
// auf state.pilot.* – so läuft das System heute und später ohne Umbau.

/** Ruft einen Selektor still ab; Fehler/unbekannt → undefined. */
function tryRead(select, type, args) {
  if (typeof select !== 'function') return undefined;
  try { return select(type, args); } catch { return undefined; }
}

/** Skill-Stufe eines Skills (Selektor skills/level, sonst state.pilot.skills). */
export function readSkillLevel(state, select, skillId) {
  const viaSelector = tryRead(select, 'skills/level', { skillId });
  const n = typeof viaSelector === 'number' ? viaSelector : viaSelector?.level;
  if (typeof n === 'number') return n;
  return state.pilot?.skills?.[skillId]?.level ?? 0;
}

/** Pilot-Sicht für calcShipStats: { skills: { id: { level } } } für alle bekannten Skills. */
export function readPilot(state, data, select) {
  const skills = {};
  const ids = new Set([...Object.keys(data.skills ?? {}), ...Object.keys(state.pilot?.skills ?? {})]);
  const probe = tryRead(select, 'skills/level', { skillId: [...ids][0] });
  const useSelector = probe !== undefined;
  for (const id of ids) {
    const level = useSelector ? readSkillLevel(state, select, id) : (state.pilot?.skills?.[id]?.level ?? 0);
    if (level > 0) skills[id] = { level };
  }
  return { skills };
}

/** Station, in der der Pilot angedockt ist (sonst null). */
export function readDockedStationId(state, select) {
  const id = state.pilot?.location?.dockedStationId ?? null;
  if (id === null) return null;
  const viaSelector = tryRead(select, 'travel/isDocked', {});
  if (viaSelector === false) return null;
  return id;
}

export function findShip(state, uid) {
  return (state.assets?.ships ?? []).find((s) => s.uid === uid) ?? null;
}

export function readStationItems(state, stationId) {
  return state.assets?.stations?.[stationId]?.items ?? {};
}

export function stockOf(state, stationId, itemId) {
  return readStationItems(state, stationId)[itemId] ?? 0;
}

/** Entnimmt 1 Stück aus dem Stationslager; false, wenn nichts da ist. */
export function takeFromStation(state, stationId, itemId) {
  const items = state.assets?.stations?.[stationId]?.items;
  if (!items || (items[itemId] ?? 0) < 1) return false;
  items[itemId] -= 1;
  if (items[itemId] === 0) delete items[itemId];
  return true;
}

export function giveToStation(state, stationId, itemId) {
  state.assets.stations ??= {};
  state.assets.stations[stationId] ??= { items: {} };
  const items = (state.assets.stations[stationId].items ??= {});
  items[itemId] = (items[itemId] ?? 0) + 1;
}
