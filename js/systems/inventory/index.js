// System "inventory": Erz zwischen Schiffs-Erzhalle und Stationslager bewegen (nur angedockt). MASTER_PLAN 5.4.
// Das Stationslager liegt in assets.stations[stationId].items und gehört dem Account.

const fail = (error, message) => ({ ok: false, error, message });
const activeShip = (state) => state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;

function holdMax(state, data, select) {
  const ship = activeShip(state);
  let stats = null;
  try { stats = select?.('fitting/stats', { uid: ship?.uid }); } catch { /* ohne Fitting */ }
  return stats?.mining?.oreHold ?? data.ships?.[ship?.typeId]?.attributes?.ore_hold ?? 0;
}
const volume = (data, id) => data.ores?.[id]?.volumeM3 ?? data.items?.[id]?.volumeM3 ?? 0.1;
const nameOf = (data, id) => data.ores?.[id]?.name ?? data.items?.[id]?.name ?? data.modules?.[id]?.name ?? id;

export const system = {
  id: 'inventory',
  actions: {
    'inv/unload': (ctx, p) => {
      const { state } = ctx;
      const station = dockedId(state);
      if (!station) return fail('inv.not_docked', 'Lager nur in Stationen: Warpe zu einer Station und docke an.');
      const ship = activeShip(state);
      const ids = p?.oreId ? [p.oreId] : Object.keys(ship.oreHold);
      let moved = 0;
      for (const id of ids) {
        const n = ship.oreHold[id] ?? 0;
        if (n <= 0) continue;
        stockOf(state, station)[id] = (stockOf(state, station)[id] ?? 0) + n;
        delete ship.oreHold[id];
        moved += n;
      }
      if (moved) { ctx.log(`${moved} Einheiten Erz ins Stationslager entladen.`); ctx.emit('inv/changed', { stationId: station }); }
      return { ok: true, moved };
    },
    'inv/unloadAll': (ctx) => system.actions['inv/unload'](ctx, {}),
    'inv/load': (ctx, p) => {
      const { state, data } = ctx;
      const station = dockedId(state);
      if (!station) return fail('inv.not_docked', 'Lager nur in Stationen.');
      const id = p?.oreId;
      if (!data.ores?.[id]) return fail('inv.bad_item', 'Nur Erz kann in die Erzhalle geladen werden.');
      const ship = activeShip(state);
      const used = Object.entries(ship.oreHold).reduce((s, [k, n]) => s + n * volume(data, k), 0);
      const free = Math.max(0, holdMax(state, data, ctx.select) - used);
      const have = stockOf(state, station)[id] ?? 0;
      const n = Math.min(have, Math.floor(free / volume(data, id)), Math.max(1, Math.floor(p?.units ?? have)));
      if (n <= 0) return fail('inv.no_space', 'Kein Platz in der Erzhalle oder nichts im Lager.');
      stockOf(state, station)[id] = have - n;
      ship.oreHold[id] = (ship.oreHold[id] ?? 0) + n;
      ctx.emit('inv/changed', { stationId: station });
      return { ok: true, moved: n };
    }
  },
  selectors: {
    /** Lager der Station, an der der Pilot angedockt ist: [{ itemId, name, kind, qty, volumeM3 }] */
    'inv/stock': (state, data) => {
      const station = dockedId(state);
      if (!station) return [];
      return Object.entries(stockOf(state, station)).filter(([, q]) => q > 0).map(([itemId, qty]) => ({
        itemId, qty, name: nameOf(data, itemId), kind: data.ores?.[itemId] ? 'ore' : data.items?.[itemId]?.kind ?? (data.modules?.[itemId] ? 'module' : 'item'),
        volumeM3: volume(data, itemId)
      })).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    },
    /** Lagerorte mit Inhalt über alle Stationen. */
    'inv/locations': (state, data) => Object.entries(state.assets.stations).map(([id, s]) => ({
      stationId: id, name: data.celestials[id]?.name ?? id, items: Object.entries(s.items).filter(([, q]) => q > 0).length
    })).filter((x) => x.items > 0)
  }
};
