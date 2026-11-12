// Event-Toast-Tabelle (Master Plan 5.5). Rein: toastFor(event, payload, t) -> {kind, text} oder null.

const str = (value) => String(value ?? '–');

const MAP = {
  'travel/arrived': { kind: 'info', key: 'toast.travel.arrived', params: (p) => ({ place: str(p.name ?? p.celestialName ?? p.celestialId ?? p.toId) }) },
  'travel/docked': { kind: 'ok', key: 'toast.travel.docked', params: (p) => ({ place: str(p.name ?? p.stationName ?? p.stationId) }) },
  'travel/undocked': { kind: 'info', key: 'toast.travel.undocked', params: (p) => ({ place: str(p.name ?? p.stationName ?? p.stationId) }) },
  'travel/jumped': { kind: 'info', key: 'toast.travel.jumped', params: (p) => ({ place: str(p.name ?? p.systemName ?? p.systemId ?? p.toSystemId) }) },
  'mining/holdFull': { kind: 'warn', key: 'toast.mining.holdFull', params: () => ({}) },
  'mining/asteroidDepleted': { kind: 'info', key: 'toast.mining.depleted', params: () => ({}) },
  'skills/completed': { kind: 'ok', key: 'toast.skills.completed', params: (p) => ({ name: str(p.name ?? p.skillName ?? p.skillId) }) },
  'missions/completed': { kind: 'ok', key: 'toast.missions.completed', params: (p) => ({ name: str(p.name ?? p.title ?? p.missionId) }) },
  'missions/failed': { kind: 'error', key: 'toast.missions.failed', params: (p) => ({ name: str(p.name ?? p.title ?? p.missionId) }) },
  'ships/destroyed': { kind: 'error', key: 'toast.ships.destroyed', params: (p) => ({ name: str(p.name ?? p.shipName ?? p.uid) }) },
  'skills/queueEmpty': { kind: 'warn', key: 'toast.skills.queueEmpty', params: () => ({}) },
  'mining/fieldRespawned': { kind: 'info', key: 'toast.mining.respawned', params: () => ({}) },
  'market/bought': { kind: 'ok', key: 'toast.market.bought', params: (p) => ({ name: str(p.name ?? p.itemName ?? p.itemId) }) },
  'refine/done': { kind: 'ok', key: 'toast.refine.done', params: () => ({}) },
  'combat/playerDestroyed': { kind: 'error', key: 'toast.combat.destroyed', params: () => ({}) },
  'market/sold': { kind: 'ok', key: 'toast.market.sold', params: (p) => ({ name: str(p.name ?? p.itemName ?? p.itemId) }) }
};

export const TOAST_EVENTS = Object.keys(MAP);

export function toastFor(event, payload, t) {
  const entry = MAP[event];
  if (!entry) return null;
  return { kind: entry.kind, text: t(entry.key, entry.params(payload ?? {})) };
}

/** Hängt alle Event-Toasts an game.on; liefert off(). */
export function registerToasts(game, push, t) {
  const offs = TOAST_EVENTS.map((event) => game.on(event, (payload) => {
    const toast = toastFor(event, payload, t);
    if (toast) push(toast);
  }));
  return () => offs.forEach((off) => off());
}

/** Text für Fehlerergebnisse von game.dispatch (Result mit ok:false). */
export function errorToast(result, t) {
  return { kind: 'error', text: result?.message ? t('toast.error', { message: result.message }) : t('toast.unknown.error') };
}
