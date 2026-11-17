// System "travel": Warp zwischen Himmelskörpern, Docken, Abdocken, Tor-Sprung (MASTER_PLAN 3.6, 5.4).
// Eigener Teilbaum: pilot.location, pilot.warp. Wirkt auf ship.stationId und stoppt den Bergbau.

import { polarDistance } from '../../util/math.js';
import { layoutSystems } from './layout.js';
import { payTravel } from '../cap/index.js';

const fail = (error, message) => ({ ok: false, error, message });
const activeShip = (state) => state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);

function warpSpeed(state, data, select) {
  const ship = activeShip(state);
  let ws;
  try { ws = select?.('fitting/stats', { uid: ship?.uid })?.nav?.warpSpeed; } catch { /* Fitting-System fehlt */ }
  if (!(typeof ws === 'number' && ws > 0)) ws = data.ships?.[ship?.typeId]?.attributes?.warp_speed ?? 1;
  return ws * (data.balance?.travel?.warpScale ?? 1);
}

export const warpTicks = (from, to, speed) => Math.max(1, Math.ceil(polarDistance(from, to) / speed));

function stopMining(state) { state.mining.sessions = []; }

function actionsFor(cel, here, docked, warping) {
  if (warping) return [];
  const list = [];
  if (!here && !docked) list.push('warp');
  if (here && !docked && cel.type === 'station') list.push('dock');
  if (here && !docked && cel.type === 'gate') list.push('jump');
  if (here && !docked && cel.type === 'belt') list.push('mine');
  return list;
}

export const system = {
  id: 'travel',
  actions: {
    'travel/warp': (ctx, p) => {
      const { state, data } = ctx;
      const loc = state.pilot.location;
      if (state.pilot.warp) return fail('travel.busy', 'Du befindest dich bereits im Warp.');
      if (loc.dockedStationId) return fail('travel.docked', 'Erst abdocken, dann warpen.');
      const to = data.celestials[p?.celestialId];
      const from = data.celestials[loc.celestialId];
      if (!to || to.systemId !== loc.systemId) return fail('travel.bad_target', 'Das Ziel liegt nicht in diesem Sonnensystem.');
      if (!from || from.id === to.id) return fail('travel.same_place', 'Du bist bereits dort.');
      const paid = payTravel(ctx, 'warp', to);
      if (!paid.ok) return paid;
      const ticks = warpTicks(from, to, warpSpeed(state, data, ctx.select));
      stopMining(state);
      state.pilot.warp = { fromId: from.id, toId: to.id, ticksLeft: ticks, ticksTotal: ticks };
      loc.celestialId = null;
      ctx.log(`Warp nach ${to.name} (${ticks} Ticks).`);
      ctx.emit('travel/warpStarted', { toId: to.id, ticks });
      return { ok: true, ticks };
    },
    'travel/dock': (ctx, p) => {
      const { state, data } = ctx;
      const loc = state.pilot.location;
      const cel = data.celestials[p?.stationId ?? loc.celestialId];
      if (state.pilot.warp || loc.dockedStationId) return fail('travel.busy', 'Jetzt nicht möglich.');
      if (!cel || cel.type !== 'station' || loc.celestialId !== cel.id) return fail('travel.not_at_station', 'Du musst zuerst zu einer Station warpen.');
      loc.dockedStationId = cel.id;
      const ship = activeShip(state);
      if (ship) ship.stationId = cel.id;
      stopMining(state);
      ctx.log(`Angedockt: ${cel.name}.`);
      ctx.emit('travel/docked', { stationId: cel.id, name: cel.name });
      return { ok: true };
    },
    'travel/undock': (ctx) => {
      const { state, data } = ctx;
      const loc = state.pilot.location;
      if (!loc.dockedStationId) return fail('travel.not_docked', 'Du bist nicht angedockt.');
      const name = data.celestials[loc.dockedStationId]?.name ?? loc.dockedStationId;
      loc.dockedStationId = null;
      const ship = activeShip(state);
      if (ship) ship.stationId = null;
      ctx.log(`Abgedockt: ${name}.`);
      ctx.emit('travel/undocked', { stationId: loc.celestialId, name });
      return { ok: true };
    },
    'travel/jump': (ctx, p) => {
      const { state, data } = ctx;
      const loc = state.pilot.location;
      if (state.pilot.warp || loc.dockedStationId) return fail('travel.busy', 'Jetzt nicht möglich.');
      const gate = data.celestials[p?.gateId ?? loc.celestialId];
      if (!gate || gate.type !== 'gate' || gate.id !== loc.celestialId) return fail('travel.not_at_gate', 'Du musst zuerst zu einem Sternentor warpen.');
      const out = data.celestials[gate.toGate];
      if (!out) return fail('travel.no_exit', 'Das Gegentor fehlt.');
      const paid = payTravel(ctx, 'jump', gate);
      if (!paid.ok) return paid;
      loc.systemId = out.systemId;
      loc.celestialId = out.id;
      stopMining(state);
      ctx.log(`Sprung nach ${data.systems[out.systemId].name}.`);
      ctx.emit('travel/jumped', { systemId: out.systemId, name: data.systems[out.systemId].name });
      return { ok: true };
    }
  },
  onTick(ctx) {
    const { state, data } = ctx;
    const warp = state.pilot.warp;
    if (!warp) return;
    warp.ticksLeft -= 1;
    if (warp.ticksLeft > 0) return;
    state.pilot.location.celestialId = warp.toId;
    state.pilot.warp = null;
    ctx.log(`Angekommen: ${data.celestials[warp.toId]?.name ?? warp.toId}.`);
    ctx.emit('travel/arrived', { celestialId: warp.toId, name: data.celestials[warp.toId]?.name });
  },
  selectors: {
    'travel/isDocked': (state) => Boolean(state.pilot.location.dockedStationId),
    'travel/here': (state, data) => data.celestials[state.pilot.location.celestialId] ?? null,
    /** Liste aller Himmelskörper des aktuellen Systems mit Distanz, Warpdauer und möglichen Aktionen. */
    'travel/overview': (state, data, args, select) => {
      const loc = state.pilot.location;
      const system = data.systems[loc.systemId];
      if (!system) return { systemId: null, rows: [] };
      const from = data.celestials[loc.celestialId] ?? data.celestials[state.pilot.warp?.fromId];
      const speed = warpSpeed(state, data, select);
      const docked = Boolean(loc.dockedStationId);
      const warping = Boolean(state.pilot.warp);
      const rows = system.celestials.map((cel) => {
        const here = cel.id === loc.celestialId;
        const dist = from ? polarDistance(from, cel) : cel.au;
        return {
          id: cel.id, name: cel.name, type: cel.type, subtype: cel.subtype ?? null, au: cel.au, angleDeg: cel.angleDeg,
          fieldId: cel.fieldId ?? null, to: cel.to ?? null, parent: cel.parent ?? null, services: cel.services ?? [],
          here, distanceAu: Math.round(dist * 100) / 100, warpTicks: here ? 0 : warpTicks(from ?? { au: 0, angleDeg: 0 }, cel, speed),
          actions: actionsFor(cel, here, docked, warping)
        };
      }).sort((a, b) => a.distanceAu - b.distanceAu);
      return { systemId: system.id, name: system.name, security: system.security, docked, warping, rows };
    },
    /** Systeme mit Position und Nachbarn für die Sternkarte. */
    'travel/stars': (state, data) => {
      const pos = layoutSystems(data);
      const here = state.pilot.location.systemId;
      return Object.values(data.systems).filter((s) => pos[s.id]).map((s) => ({
        id: s.id, name: s.name, security: s.security, here: s.id === here, x: pos[s.id].x, y: pos[s.id].y,
        neighbors: s.celestials.filter((c) => c.type === 'gate').map((c) => c.to)
      }));
    }
  }
};
