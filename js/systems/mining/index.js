// System "mining": Asteroidenfelder, Laser-Zyklen, Erzhalle (MASTER_PLAN 5.5). Eigene Teilbäume: world.fields, mining.sessions, ship.oreHold.
// Ertragswerte kommen aus calcShipStats (fitting/stats); ohne Fitting-System greift ein Notbehelf über die Schiffsdaten.

import { ensureFields, respawnFields } from './field.js';

const fail = (error, message) => ({ ok: false, error, message });
const activeShip = (state) => state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);

function beltHere(state, data) {
  const loc = state.pilot.location;
  if (loc.dockedStationId || state.pilot.warp) return null;
  const cel = data.celestials[loc.celestialId];
  return cel?.type === 'belt' ? cel : null;
}

const holdUsed = (ship, data) => Object.entries(ship.oreHold ?? {}).reduce((sum, [id, n]) => sum + n * (data.ores?.[id]?.volumeM3 ?? 0.1), 0);

/** Laser-Kennzahlen des aktiven Schiffs: { lasers, perLaserPerTick, cycleTicks, critChance, holdMax }. */
export function laserInfo(state, data, select) {
  const ship = activeShip(state);
  let stats = null;
  const civilian = Boolean(state.pilot.cap?.civilian);
  try { stats = select?.('fitting/stats', { uid: ship?.uid, civilianOnly: civilian }); } catch { /* ohne Fitting */ }
  const mods = (ship?.fitting?.high ?? []).map((id) => data.modules?.[id]).filter((m) => m?.activation?.kind === 'mine' && (!civilian || m.civilian));
  const lasers = stats?.mining?.lasers ?? mods.length;
  const perTick = stats?.mining?.m3PerTick ?? mods.reduce((s, m) => s + m.activation.yieldM3 / m.activation.cycleTicks, 0);
  return {
    lasers, perLaserPerTick: lasers ? perTick / lasers : 0, cycleTicks: mods[0]?.activation.cycleTicks ?? 5,
    critChance: stats?.mining?.critChance ?? 0,
    holdMax: stats?.mining?.oreHold ?? data.ships?.[ship?.typeId]?.attributes?.ore_hold ?? 0
  };
}

function pickTarget(field, data) {
  const list = [...field.asteroids].sort((a, b) => (data.ores?.[b.oreId]?.basePrice ?? 0) - (data.ores?.[a.oreId]?.basePrice ?? 0) || b.remainingM3 - a.remainingM3);
  return list[0] ?? null;
}

function retarget(ctx, field, goneId) {
  const next = pickTarget(field, ctx.data);
  ctx.state.mining.sessions = next
    ? ctx.state.mining.sessions.map((s) => (s.asteroidId === goneId ? { ...s, asteroidId: next.id } : s))
    : ctx.state.mining.sessions.filter((s) => s.asteroidId !== goneId);
}

function runCycle(ctx, session, field, ship, info) {
  const { state, data, rng } = ctx;
  const ast = field.asteroids.find((a) => a.id === session.asteroidId);
  if (!ast) { retarget(ctx, field, session.asteroidId); return; }
  const ore = data.ores[ast.oreId];
  const crit = info.critChance > 0 && rng.chance(info.critChance);
  const wanted = info.perLaserPerTick * info.cycleTicks * (crit ? (data.balance?.mining?.critMultiplier ?? 2) : 1);
  const free = info.holdMax - holdUsed(ship, data);
  const m3 = Math.min(wanted, ast.remainingM3, free);
  const units = Math.floor(m3 / ore.volumeM3);
  if (units > 0) {
    ast.remainingM3 = Math.max(0, ast.remainingM3 - units * ore.volumeM3);
    ship.oreHold[ast.oreId] = (ship.oreHold[ast.oreId] ?? 0) + units;
    ctx.emit('mining/cycle', { oreId: ast.oreId, units, crit });
  }
  if (ast.remainingM3 < ore.volumeM3) {
    field.asteroids = field.asteroids.filter((a) => a.id !== ast.id);
    ctx.log(`Asteroid (${ore.name}) erschöpft.`);
    ctx.emit('mining/asteroidDepleted', { asteroidId: ast.id });
    retarget(ctx, field, ast.id);
  }
}

export const system = {
  id: 'mining',
  init(ctx) { ensureFields(ctx.state, ctx.data, ctx.rng); },
  actions: {
    'mining/start': (ctx, p) => {
      const { state, data } = ctx;
      const belt = beltHere(state, data);
      if (!belt) return fail('mining.not_at_belt', 'Du musst im Asteroidengürtel sein (Abbau nur außerhalb der Station).');
      const ship = activeShip(state);
      const info = laserInfo(state, data, ctx.select);
      if (!info.lasers) return fail('mining.no_laser', 'Dein Schiff hat keinen Bergbaulaser eingebaut.');
      if (holdUsed(ship, data) >= info.holdMax - 0.1) return fail('mining.hold_full', 'Die Erzhalle ist voll. Fliege zur Station und entlade.');
      const field = state.world.fields[belt.fieldId];
      const target = field?.asteroids.find((a) => a.id === p?.asteroidId) ?? (field ? pickTarget(field, data) : null);
      if (!target) return fail('mining.empty_field', 'Dieses Feld ist leer. Es füllt sich nach einiger Zeit wieder.');
      state.mining.sessions = Array.from({ length: info.lasers }, (_, laser) => ({ laser, asteroidId: target.id, cycleLeft: info.cycleTicks }));
      ctx.log(`Abbau gestartet (${info.lasers} Laser auf ${data.ores[target.oreId].name}).`);
      return { ok: true };
    },
    'mining/target': (ctx, p) => {
      const { state, data } = ctx;
      const belt = beltHere(state, data);
      if (!belt) return fail('mining.not_at_belt', 'Du musst im Asteroidengürtel sein.');
      const field = state.world.fields[belt.fieldId];
      const info = laserInfo(state, data, ctx.select);
      if (!field?.asteroids.some((a) => a.id === p?.asteroidId)) return fail('mining.bad_target', 'Unbekannter Asteroid.');
      const laser = Number(p?.laser);
      if (!(laser >= 0 && laser < info.lasers)) return fail('mining.bad_laser', 'Unbekannter Laser.');
      const sessions = state.mining.sessions.filter((s) => s.laser !== laser);
      sessions.push({ laser, asteroidId: p.asteroidId, cycleLeft: info.cycleTicks });
      state.mining.sessions = sessions.sort((a, b) => a.laser - b.laser);
      return { ok: true };
    },
    'mining/stop': (ctx) => {
      if (ctx.state.mining.sessions.length) ctx.log('Abbau gestoppt.');
      ctx.state.mining.sessions = [];
      return { ok: true };
    }
  },
  onTick(ctx) {
    const { state, data } = ctx;
    ensureFields(state, data, ctx.rng);
    for (const id of respawnFields(state, data, ctx.rng)) ctx.emit('mining/fieldRespawned', { fieldId: id });
    if (!state.mining.sessions.length) return;
    const belt = beltHere(state, data);
    if (!belt) { state.mining.sessions = []; return; }
    const field = state.world.fields[belt.fieldId];
    const ship = activeShip(state);
    const info = laserInfo(state, data, ctx.select);
    for (const session of [...state.mining.sessions]) {
      session.cycleLeft -= 1;
      if (session.cycleLeft > 0) continue;
      session.cycleLeft = info.cycleTicks;
      runCycle(ctx, session, field, ship, info);
    }
    if (state.mining.sessions.length && holdUsed(ship, data) >= info.holdMax - 0.1) {
      state.mining.sessions = [];
      ctx.log('Erzhalle voll, Abbau beendet.', 'warn');
      ctx.emit('mining/holdFull', {});
    }
    if (!field.asteroids.length) field.emptySince ??= state.tick;
  },
  selectors: {
    /** Gürtel am Standort: { atBelt, fieldId, name, asteroids[], respawnIn, lasers, sessions } */
    'mining/field': (state, data, args, select) => {
      const belt = beltHere(state, data);
      const info = laserInfo(state, data, select);
      const belts = (data.systems[state.pilot.location.systemId]?.celestials ?? []).filter((c) => c.type === 'belt').map((c) => ({ id: c.id, name: c.name }));
      if (!belt) return { atBelt: false, belts, lasers: info.lasers };
      const field = state.world.fields[belt.fieldId] ?? { asteroids: [], emptySince: null };
      const def = data.fields[belt.fieldId];
      const respawnIn = !field.asteroids.length && field.emptySince !== null ? Math.max(0, (def?.respawnTicks ?? 0) - (state.tick - field.emptySince)) : null;
      const asteroids = field.asteroids.map((a) => ({
        id: a.id, oreId: a.oreId, name: data.ores[a.oreId]?.name ?? a.oreId, remainingM3: Math.round(a.remainingM3), initialM3: a.initialM3,
        pct: a.initialM3 ? a.remainingM3 / a.initialM3 : 0,
        lasers: state.mining.sessions.filter((s) => s.asteroidId === a.id).map((s) => s.laser)
      }));
      return {
        atBelt: true, fieldId: belt.fieldId, name: belt.name, belts, asteroids, respawnIn, lasers: info.lasers,
        perLaserPerTick: info.perLaserPerTick, cycleTicks: info.cycleTicks, mining: state.mining.sessions.length > 0,
        sessions: state.mining.sessions.map((s) => ({ ...s }))
      };
    },
    /** Erzhalle des aktiven Schiffs: { usedM3, maxM3, rows[{oreId,name,units,m3}] } */
    'mining/hold': (state, data, args, select) => {
      const ship = activeShip(state);
      const info = laserInfo(state, data, select);
      const rows = Object.entries(ship?.oreHold ?? {}).filter(([, n]) => n > 0).map(([oreId, units]) => ({
        oreId, name: data.ores[oreId]?.name ?? oreId, units, m3: Math.round(units * (data.ores[oreId]?.volumeM3 ?? 0.1) * 10) / 10
      }));
      return { usedM3: Math.round(holdUsed(ship ?? { oreHold: {} }, data) * 10) / 10, maxM3: info.holdMax, rows };
    }
  }
};
